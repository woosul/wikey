import type { LLMClient } from './llm-client.js'
import type {
  CanonicalizedResult, Mention, SubscriptionProvider, WikeyConfig, WikiPage,
} from './types.js'
// §5.10.4 D-wide: schema gate · anti-pattern detector · standard decomposition 모두 폐기.
// canonicalizer = LLM 자율 type 분류 + canonicalizeSlug alias normalization 만.
import { normalizeBase } from './wiki-ops.js'
import { sanitizeWikilinkTarget } from './wikilink-safe.js'
import {
  EXAMPLE_ORG_BASE, EXAMPLE_ORG_ALIAS, EXAMPLE_ORG_KO, EXAMPLE_ORG_DESC_KO,
  EXAMPLE_CONCEPT_BASE, EXAMPLE_CONCEPT_ALIAS,
} from './example-placeholders.js'
import {
  DEFAULT_PROMOTION_THRESHOLD,
  DEFAULT_CHARS_PER_PAGE,
  DEFAULT_CEILING_MIN,
  type PromotionThresholdConfig,
} from './promotion-config.js'
import {
  JSON_ONLY_PROMPT_PREFIX,
  buildAdaptiveLlmOpts,
  resolveJsonModeNative,
} from './adaptive-json-mode.js'

/**
 * Stage 3 Canonicalizer (D-wide). Single document-global LLM call that:
 *   1. Takes all mentions from chunk LLMs (Stage 2) + existing wiki page list
 *   2. Maps each mention to canonical entity/concept under LLM 자율 type 분류
 *   3. Resolves abbreviation↔fullname pairs and existing-page reuse
 *   4. Drops only on empty name or empty type (LLM 자체가 거부 가이드 적용)
 *
 * Invariants:
 *   - Output filenames are normalized base names (no path, no .md → wiki-ops adds .md)
 *   - Each kept page has explicit entityType or conceptType (free string, LLM 자율)
 *   - Minimal alias normalization (SLUG_ALIASES + .wikey/schema.yaml `aliases:`)
 */

const MAX_JSON_RETRIES = 2

/**
 * v7 §4.5.1.4: Slug alias map — collapses naming-level variance observed
 * across 5-run determinism measurements (PMS PDF, 2026-04-21).
 *
 * Scope:
 *   1. Transliteration variants (Korean → English canonical)
 *   2. Abbreviation ↔ fullname unification within one canonical slug
 *   3. DB/SW convention collapsed to spelled-out form
 *
 * Each entry maps ALIAS → CANONICAL. The canonical is the target slug; it
 * should itself appear NOT as a key (otherwise remapping is idempotent by
 * fallthrough but clutters the table).
 *
 * Decision log (2026-04-21):
 *   - `alimtalk` chosen as canonical for KakaoTalk-official spelling; `allimtok` /
 *     `alrimtok` are romanization drift.
 *   - `single-sign-on-api` chosen as canonical (protocol noun = API form); standalone
 *     `single-sign-on` collapses here too because v7 measurements only observed it
 *     as the API surface, not as the abstract method.
 *   - `integrated-member-database` over `-db`: avoid abbreviation in slug (consistent
 *     with wikey convention of spelled-out forms except for industry-standard acronyms
 *     like `pmbok`/`erp`).
 */
export const SLUG_ALIASES: Readonly<Record<string, string>> = {
  // §4.5.1.4 (original pins)
  allimtok: 'alimtalk',
  alrimtok: 'alimtalk',
  'sso-api': 'single-sign-on-api',
  'single-sign-on': 'single-sign-on-api',
  'integrated-member-db': 'integrated-member-database',

  // §4.5.1.6.3 — 30-run PMS data (2026-04-22) added variants:
  //
  // Alimtalk 5-variant: KakaoTalk official spelling is `alimtalk`;
  // `allim-talk` / `allimtalk` / `kakao-alimtalk` were all observed in N=30.
  'allim-talk': 'alimtalk',
  allimtalk: 'alimtalk',
  'kakao-alimtalk': 'alimtalk',

  // ERP/SCM: drop trailing `-system` so the canonical slug is the methodology name.
  // (§5.10.4 D-wide: pool axis pinning — FORCED_CATEGORIES 폐기. LLM 자율 type.)
  'erp-system': 'enterprise-resource-planning',
  'enterprise-resource-planning-system': 'enterprise-resource-planning',
  'supply-chain-management-system': 'supply-chain-management',

  // MES family: "point of production (system)" is a Korean synonym for MES;
  // collapse to `manufacturing-execution-system` so variants don't split.
  'point-of-production-system': 'manufacturing-execution-system',
  'point-of-production': 'manufacturing-execution-system',

  // BOM family — engineering/electronic variants collapse into the generic
  // industry-standard term. If the wiki later needs to distinguish eBOM from
  // mBOM we'll re-split then; for now N=30 showed all five spellings as
  // low-confidence variance.
  'e-bom': 'bill-of-materials',
  'e-bill-of-materials': 'bill-of-materials',
  'electronic-bill-of-materials': 'bill-of-materials',
  'engineering-bill-of-materials': 'bill-of-materials',

  // Electronic approval — Korean business workflow. Drop the `-system` suffix.
  'electronic-approval-system': 'electronic-approval',

  // Standards with spelled-out aliases — prefer the short industry-recognised form.
  'representational-state-transfer-api': 'restful-api',
  'transmission-control-protocol-internet-protocol': 'tcp-ip',
  'message-queuing-telemetry-transport': 'mqtt',
}

export function canonicalizeSlug(base: string, userAliases?: Readonly<Record<string, string>>): string {
  // §5.10.4 P2-2: user-defined aliases (.wikey/schema.yaml `aliases:`) check first,
  // built-in SLUG_ALIASES second, then identity. Variant lookup is by exact base —
  // canonicalizer's normalizeBase() runs before this.
  if (userAliases && userAliases[base]) return userAliases[base]
  return SLUG_ALIASES[base] ?? base
}

// §5.10.3 R2 (D-wide LLM-only ontology): FORCED_CATEGORIES + entity/concept pin 폐기.
// minimal alias normalization (SLUG_ALIASES, canonicalizeSlug) 만 잔존.

export interface CanonicalizeArgs {
  readonly llm: LLMClient
  readonly mentions: readonly Mention[]
  readonly existingEntityBases: readonly string[]
  readonly existingConceptBases: readonly string[]
  /**
   * Source filename incl. extension — frontmatter `sources:` 배열 등재용.
   * PII guard ON 시 ingest-pipeline 의 sanitizeForLlmPrompt 가 mask 적용된 형식 전달
   * (예: `___-test-mask.pdf`). LLM body 에 PII 누출 방지.
   */
  readonly sourceFilename: string
  /**
   * §5.13.A1: PII-mask 적용 안 된 원본 raw basename (예: `사업자등록증_홍길동_123456.pdf`).
   * concept/entity 페이지 `## 출처` 의 raw wikilink target 으로 사용 — Obsidian basename
   * matcher 가 raw/<bucket>/<rawSourceFilename> 매칭 + validate-wiki.sh §5.13.B2 link 자체
   * 매칭 PASS. PII guard 흐름과 무관한 원본 raw 파일 jump 1 클릭 보장.
   */
  readonly rawSourceFilename: string
  /**
   * §5.12: wiki/sources/<sourcePageBase>.md 단일 진실 소스 base. ingest-pipeline 이
   * `normalizeBase(summaryParsed.source_page.filename)` derive 후 주입. canonicalizer
   * 는 raw sourceFilename 기반 derive 안 함 — 받은 base 그대로 사용 (LLM emit drift 방어).
   */
  readonly sourcePageBase: string
  readonly today: string
  readonly guideHint?: string
  readonly provider: string
  readonly model: string
  /** §5.10.4 P2-2: user-defined aliases from `.wikey/schema.yaml` `aliases:` block. */
  readonly userAliases?: Readonly<Record<string, string>>
  /**
   * §4.5.1.6.1: inject temperature=0 + seed=42 into canonicalizer LLM calls when true.
   * Mirrors the flag plumbed through ingest-pipeline extraction calls.
   */
  readonly deterministic?: boolean
  /**
   * §4.3.1: optional Stage 3 prompt override. If present, replaces the entire
   * bundled canonicalizer prompt. Substituted variables:
   *   {{SOURCE_FILENAME}} {{GUIDE_BLOCK}} {{SCHEMA_BLOCK}}
   *   {{EXISTING_BLOCK}} {{MENTIONS_BLOCK}} {{MENTIONS_COUNT}}
   * User responsibility: keep the JSON output schema section — canonicalizer assumes
   * `entities/concepts/index_additions/log_entry` top-level keys.
   */
  readonly overridePrompt?: string
  /**
   * §5.11 page promotion threshold: full source body for deterministic occurrence
   * count gate. When provided, entity/concept whose name + alias substring count
   * < promotionThreshold in this body is dropped (single-mention noise filter).
   * Optional — when absent, gate is skipped (backward compatible with existing tests).
   */
  readonly sourceBody?: string
  /**
   * §5.15.B: per-call promotion threshold override (default = DEFAULT_PROMOTION_THRESHOLD = 2).
   * 사용자가 `.wikey/promotion-threshold.yaml` 의 `default:` 로 지정 → ingest-pipeline 이
   * `loadPromotionThreshold` 결과를 본 인자로 전달. unit test 는 직접 인자 전달.
   * 값 < 1 은 caller 책임 (loader 가 fallback 보장).
   */
  readonly promotionThreshold?: number
  /**
   * §5.6.4 commit 15 (2026-05-14): optional WikeyConfig for adaptive jsonMode
   * dispatch. When present, canonicalizer LLM call looks up
   * `CLI_OPTION_SUPPORT[provider][configuredAuthPath].jsonMode` — unsupported
   * (anthropic/openai subscription) strips the jsonMode flag and prefixes the
   * prompt with an 'Output ONLY valid JSON' instruction. Absent (default):
   * legacy `jsonMode:true` behavior — preserves existing test expectations.
   */
  readonly config?: WikeyConfig
}

interface RawCanonical {
  entities?: RawPage[]
  concepts?: RawPage[]
  index_additions?: string[]
  log_entry?: string
}

export async function canonicalize(args: CanonicalizeArgs): Promise<CanonicalizedResult> {
  const { llm, mentions, existingEntityBases, existingConceptBases,
          sourceFilename, rawSourceFilename, sourcePageBase, today, guideHint, provider, model, userAliases,
          deterministic, overridePrompt, sourceBody, promotionThreshold, config } = args

  if (mentions.length === 0) {
    return { entities: [], concepts: [], dropped: [] }
  }

  const prompt = buildCanonicalizerPrompt({
    mentions, existingEntityBases, existingConceptBases,
    sourceFilename, guideHint, overridePrompt,
  })

  const raw = await callLLMWithRetry(llm, prompt, provider, model, deterministic, config)
  return assembleCanonicalResult(
    raw, mentions, sourceFilename, rawSourceFilename, sourcePageBase, today,
    userAliases, sourceBody, promotionThreshold,
  )
}

// ── Prompt construction ──

interface PromptArgs {
  mentions: readonly Mention[]
  existingEntityBases: readonly string[]
  existingConceptBases: readonly string[]
  sourceFilename: string
  guideHint?: string
  /** §4.3.1: optional Stage 3 full prompt override. Variables substituted as documented above. */
  overridePrompt?: string
}

/**
 * §5.10.4 D-wide: schema gate 폐기. canonicalizer prompt 는 mention list + 기존 wiki
 * page list + alias guide 만 받음. LLM 이 type 자율 분류.
 */
export function buildCanonicalizerPrompt(args: PromptArgs): string {
  const { mentions, existingEntityBases, existingConceptBases, sourceFilename, guideHint, overridePrompt } = args

  const guideBlock = guideHint?.trim()
    ? `\n## 사용자 강조 지시 (우선 준수)\n\n> ${guideHint.trim()}\n`
    : ''

  // Existing pages — single flat list (v3 lesson: don't expose entity/concept split)
  const allExisting = Array.from(new Set([...existingEntityBases, ...existingConceptBases])).sort()
  const existingBlock = allExisting.length > 0
    ? `\n## 기존 wiki 페이지 (${allExisting.length}개) — 동일 대상 발견 시 filename 그대로 재사용\n${allExisting.slice(0, 80).map((x) => `\`${x}\``).join(', ')}\n`
    : ''

  // Mentions — compact JSON list
  const mentionsBlock = mentions.map((m, i) => {
    const evidence = m.evidence.slice(0, 200).replace(/\s+/g, ' ').trim()
    return `${i + 1}. \`${m.name}\` (hint: ${m.type_hint ?? 'unknown'}) — ${evidence}`
  }).join('\n')

  // §5.10.4 D-wide: schemaBlock + standardDecompositionBlock 폐기. LLM 자율 type 분류.
  // SCHEMA_BLOCK / STANDARD_DECOMPOSITION_BLOCK substitution 은 deprecated override
  // prompt 와의 backward compat 만 유지 (변환 시 빈 문자열).
  if (overridePrompt && overridePrompt.trim()) {
    return overridePrompt
      .replaceAll('{{SOURCE_FILENAME}}', sourceFilename)
      .replaceAll('{{GUIDE_BLOCK}}', guideBlock)
      .replaceAll('{{SCHEMA_BLOCK}}', '')
      .replaceAll('{{STANDARD_DECOMPOSITION_BLOCK}}', '')
      .replaceAll('{{EXISTING_BLOCK}}', existingBlock)
      .replaceAll('{{MENTIONS_BLOCK}}', mentionsBlock)
      .replaceAll('{{MENTIONS_COUNT}}', String(mentions.length))
  }

  return `당신은 wikey LLM Wiki의 canonicalizer입니다. chunk LLM이 추출한 mention 리스트를 받아 entity/concept 으로 분류하고 canonical filename 으로 통합합니다.

Source: ${sourceFilename}
${guideBlock}

## 작업 규칙

1. **분류**: 각 mention 을 entity (조직·인물·제품·도구 등 고유명사) 또는 concept (이론·방법론·표준·문서유형 등 추상명사) 으로 자율 분류. type 필드는 자유 string (예: organization / person / product / tool / standard / methodology / document_type / algorithm / dataset / metric 등). 어디에도 안 맞으면 entities/concepts 출력에서 **제외**.
2. **약어↔풀네임 통합**: \`pms\`와 \`project-management-system\`이 같은 mention이면 풀네임 1개만 출력 (약어는 \`aliases\`에).
3. **기존 페이지 재사용**: 위 "기존 wiki 페이지" 목록과 매칭되면 filename은 기존 base 그대로 사용 (예: \`${EXAMPLE_ORG_BASE}\` 발견 → \`${EXAMPLE_ORG_ALIAS}\`로 새로 만들지 말 것).
4. **filename 형식**: \`name\` 필드는 base name만 (소문자, 하이픈 구분, .md/디렉토리 prefix 금지).
5. **description**: 1~2문장, 의미 위주.
6. **display_name (원문 표기)**: \`display_name\` 필드는 **mention evidence 의 원문에 등장한 표기 그대로** (한국어 / 일본어 / 중국어 / 영문 — 본문 언어 따라). 페이지 frontmatter \`title\` 과 H1 으로 사용됨. evidence 가 한국어면 한국어 표기, 영문이면 영문 표기. 빈 값이면 \`name\` (영문 slug) fallback.
7. **다국어 alias**: \`aliases\` 배열에 **다른 언어 / 다른 표기** 명시. evidence 가 한국어면 영문 표기를 alias 로 (없으면 base name 자동 등록). 영문이면 한국어 표기 alias 로. 약어·풀네임 변형도 모두 alias.
8. **promotion threshold (§5.11 v3)**: 페이지 의도·관련도 기준으로 entity/concept 결정.
   - **포함**: 페이지 의도(주제)와 1-hop 직접 관련 + action/property/relation 서술이 있는 명사. 다른 mention 이 cross-reference 하는 hub.
   - **제외 (의미적 약한 관련 — paradigm 의 본질 차단 대상)**:
     - 단순 출처 (예: "개최 장소: X", "출처: Y", "발급기관")
     - 단순 행사 장소, 단순 인용
     - **parenthetical 1회 acronym** — \`풀네임(ACRONYM)\` 패턴이 한 문장 안에서만 등장 (예: "탐색적 데이터 분석(EDA) 지원") → 거부
     - **단순 list element / enumeration only** — \`A, B, C 등\` 또는 \`Data Lake(RDB, TSDB)\` 같이 다른 항목들과 *나열* 만 되고 본문에서 자체 action/property/relation 서술 부재 → 거부
     - **acronym only 1~2 mention + 서술 부재** — 약어 자체로만 등장하고 본문에서 그 acronym 의 *기능·동작·역할* 설명 부재 → 거부
     - 단편 사실 (날짜·일정·단순 위치) 자체. 페이지 의도와 약한 관련의 고유명사
   - **포함 예시 (긍정)**:
     - "RLHF 메커니즘 — 사용자가 수정한 SQL을 학습 데이터로 활용" (action 서술 명시 → promote)
     - "RBAC — 부서별, 직급별 접근 가능한 테이블과 컬럼을 세밀하게 관리" (property 서술 → promote)
   - **거부 예시 (부정)**:
     - "Data Lake(RDB, TSDB)는 물론..." (parenthetical enumeration only → 거부)
     - "탐색적 데이터 분석(EDA) 지원" (parenthetical 1회 + 서술 부재 → 거부)
   - **수량 제한 없음** — **수가 적어도 (1~3개만 출력해도)** OK. 본문 의미에 비례한 promotion 만 — wiki noise 방지.
9. **원문 언어 중심 + 반대 언어 alias (§5.11 v2)**:
   - **한국어 source** (sourceFilename 또는 mention evidence 의 한글 비중 ≥ 30%) → \`name\` = 한국어 base, \`aliases\` = [영어 transliteration / 표준 영문 약어]
   - **영어 source** → \`name\` = 영어 base, \`aliases\` = [한국어 transliteration / 한국어 표기]
   - 예 (한국어 source): \`{"name": "전라남도-테크노파크", "aliases": ["jeonnam-technopark", "JTP"]}\`
   - 예 (영어 source): \`{"name": "project-management-institute", "aliases": ["프로젝트관리협회", "PMI"]}\`

## 입력 mention (${mentions.length}개)

${mentionsBlock}

## §5.21 wikilink rule (LLM 출력 description 본문 적용)

description 본문 안 \`[[X]]\` wikilink 작성 시: target X 는 canonical slug (소문자, 하이픈 구분) 만 사용. raw filename 또는 file extension (\`.md\` / \`.pdf\` / \`.docx\` / \`.hwp\` / \`.pptx\` / \`.txt\`) 포함 금지. 공백 / 한글 raw 형식 금지. 예: \`[[gpt-4o]]\` ✅, \`[[GPT-4o]]\` ❌, \`[[some-source.pdf]]\` ❌.

## 출력 형식

JSON only:
\`\`\`json
{
  "entities": [
    {"name": "${EXAMPLE_ORG_BASE}", "display_name": "${EXAMPLE_ORG_KO}", "type": "organization", "description": "${EXAMPLE_ORG_DESC_KO}", "aliases": ["${EXAMPLE_ORG_ALIAS}"]}
  ],
  "concepts": [
    {"name": "${EXAMPLE_CONCEPT_BASE}", "display_name": "PMBOK", "type": "standard", "description": "PMI가 제정한 프로젝트 관리 표준 지식체계.", "aliases": ["${EXAMPLE_CONCEPT_ALIAS}", "프로젝트 관리 지식체계"]}
  ],
  "index_additions": [
    "- [[${EXAMPLE_ORG_BASE}]] — ${EXAMPLE_ORG_KO} (소스: 1개)"
  ],
  "log_entry": "- 엔티티 생성: [[${EXAMPLE_ORG_BASE}]]\\n- 개념 생성: [[${EXAMPLE_CONCEPT_BASE}]]"
}
\`\`\`

규칙 위반 mention은 **entities/concepts에서 빼면 됨** (별도 dropped 필드 X — 코드가 자동 추적).`
}

// ── Response assembly ──

/**
 * §5.11 page promotion threshold — Layer 2 deterministic gate. mention name +
 * alias 의 sourceBody 등장 횟수가 threshold 미만이면 drop.
 * length ≤ 1 candidate (단일 문자) 는 false positive 방지로 제외.
 * sourceBody 미전달 시 gate skip (backward compatible).
 *
 * §5.11 v3 (2026-05-07): *unique sentence position* 카운트 — 한 sentence 안에
 * multiple alias 매칭은 1 카운트. v2 의 raw substring 합산으로 인한 alias 카운트
 * inflation 차단 (예: `탐색적 데이터 분석(EDA)` 한 문장이 `eda` + `탐색적 데이터
 * 분석` 둘 다 매칭되어 2 카운트로 promote 되던 회귀). paradigm 의도 = "서로 다른
 * location 에서 ≥ N mention".
 *
 * §5.15.B (2026-05-07): threshold 가 hardcoded const 가 아닌 인자 — caller
 * (`canonicalize` args.promotionThreshold) 가 `.wikey/promotion-threshold.yaml`
 * default 값을 전달. 미전달 / undefined → DEFAULT_PROMOTION_THRESHOLD.
 */

/**
 * §5.11 v3: sentence boundary 로 split. 한국어/영어 구분자 모두 cover.
 * - `. ! ? 。 ！ ？` (영어 + 한중일 마침표)
 * - `\n\n` (paragraph break)
 * - `:`, `—`, `;` 등은 sentence 안 sub-clause 라 sentence boundary 로 안 침
 */
function splitSentences(text: string): readonly string[] {
  return text
    .split(/(?:[.!?。！？]+\s+|\n{2,}|\n(?=#{1,6}\s)|\n(?=[-*+]\s))/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function countOccurrences(name: string, aliases: readonly string[], sourceBody: string): number {
  const base = [name, ...aliases].map((s) => s.trim()).filter((s) => s.length > 1)
  // §5.11 v2 한국어 대응 — 하이픈 ↔ 공백 변형 모두 substring search
  const candidates = Array.from(
    new Set(base.flatMap((c) => (c.includes('-') ? [c, c.replace(/-/g, ' ')] : [c]))),
  ).map((c) => c.toLowerCase()).filter((c) => c.length > 0)
  if (candidates.length === 0) return 0
  // §5.11 v3: sentence-level unique 카운트. 각 sentence 안에서 candidate 중 *하나라도*
  // 매칭되면 1 카운트. 한 sentence 안 multiple alias 가 매칭되어도 합산 X.
  const sentences = splitSentences(sourceBody.toLowerCase())
  let total = 0
  for (const sentence of sentences) {
    if (candidates.some((c) => sentence.includes(c))) {
      total += 1
    }
  }
  return total
}

interface RawPage { name?: string; display_name?: string; type?: string; description?: string; aliases?: string[] }

/**
 * §5.11 promotion gate — entity/concept 공통 substring-count drop logic.
 * sourceBody 미전달 → 모두 allowed (gate skip). 통과한 raw page 와
 * dropped reason map (canonical base 별) 분리 반환.
 */
function applyPromotionGate(
  rawPages: readonly RawPage[],
  sourceBody: string | undefined,
  threshold: number,
  userAliases?: Readonly<Record<string, string>>,
): { allowed: readonly RawPage[]; drops: Map<string, string> } {
  if (sourceBody === undefined) {
    return { allowed: rawPages, drops: new Map() }
  }
  const drops = new Map<string, string>()
  const allowed: RawPage[] = []
  for (const p of rawPages) {
    const occ = countOccurrences(p.name ?? '', p.aliases ?? [], sourceBody)
    if (occ < threshold) {
      const reason = `single-mention (${occ} occurrence) — not promoted to page`
      drops.set(canonicalizeSlug(normalizeBase(p.name ?? ''), userAliases), reason)
      for (const alias of p.aliases ?? []) {
        drops.set(canonicalizeSlug(normalizeBase(alias), userAliases), reason)
      }
      continue
    }
    allowed.push(p)
  }
  return { allowed, drops }
}

/**
 * Build a single category (entity or concept) — promotion gate → validateAndBuildPage.
 * Mutates `keptBases` for cross-pool collision detection.
 *
 * Entity pass: 모든 valid 결과 push (entity 간 base 충돌은 caller 가 다루지 않음 — LLM
 * 이 중복 emit 시 마지막 것만 wiki 에 write 됨, 동작 변경 X 보존).
 * Concept pass: cross-pool dedup 적용 — entity 와 같은 base 면 skip.
 */
function buildCategoryPages(
  rawPages: readonly RawPage[],
  category: 'entity' | 'concept',
  sourceFilename: string,
  rawSourceFilename: string,
  sourcePageBase: string,
  promotionThreshold: number,
  today: string,
  sourceBody: string | undefined,
  keptBases: Set<string>,
  userAliases?: Readonly<Record<string, string>>,
): { pages: WikiPage[]; drops: Map<string, string> } {
  const { allowed, drops } = applyPromotionGate(rawPages, sourceBody, promotionThreshold, userAliases)
  const pages: WikiPage[] = []
  const dedupeAgainstKept = category === 'concept'
  for (const p of allowed) {
    const result = validateAndBuildPage(p, category, sourceFilename, rawSourceFilename, sourcePageBase, today, userAliases)
    if (!result.ok) continue
    const base = normalizeBase(result.page.filename)
    if (dedupeAgainstKept && keptBases.has(base)) continue
    pages.push(result.page)
    keptBases.add(base)
    for (const alias of p.aliases ?? []) keptBases.add(canonicalizeSlug(normalizeBase(alias), userAliases))
  }
  return { pages, drops }
}

function assembleCanonicalResult(
  raw: RawCanonical,
  mentions: readonly Mention[],
  sourceFilename: string,
  rawSourceFilename: string,
  sourcePageBase: string,
  today: string,
  userAliases?: Readonly<Record<string, string>>,
  sourceBody?: string,
  promotionThreshold?: number,
): CanonicalizedResult {
  const threshold = promotionThreshold ?? DEFAULT_PROMOTION_THRESHOLD
  const keptBases = new Set<string>()
  const entityResult = buildCategoryPages(
    raw.entities ?? [], 'entity', sourceFilename, rawSourceFilename, sourcePageBase, threshold, today, sourceBody, keptBases, userAliases,
  )
  const conceptResult = buildCategoryPages(
    raw.concepts ?? [], 'concept', sourceFilename, rawSourceFilename, sourcePageBase, threshold, today, sourceBody, keptBases, userAliases,
  )
  // §5.11 — promotion drops 는 canon.dropped 의 reason 에 정확 표기를 위해 보존
  // (computeDropReason fallback 이 single-mention 을 generic "not in LLM output" 으로
  // 잘못 라벨링하지 않도록).
  const promotionDrops = new Map<string, string>([...entityResult.drops, ...conceptResult.drops])

  // §5.2.1 cross-link injection — every entity ↔ every concept (sorted, deterministic).
  // Empty other-pool → page unchanged (no empty `## 관련` H2).
  const pinned = applyCrossLinks(entityResult.pages, conceptResult.pages, sourceFilename, rawSourceFilename, sourcePageBase, today)

  // Track dropped mentions: anything in `mentions` whose canonical base didn't survive.
  const pinnedBases = new Set<string>()
  for (const p of pinned.entities) pinnedBases.add(normalizeBase(p.filename))
  for (const p of pinned.concepts) pinnedBases.add(normalizeBase(p.filename))
  const dropped: Array<{ mention: Mention; reason: string }> = []
  for (const m of mentions) {
    const base = canonicalizeSlug(normalizeBase(m.name), userAliases)
    if (pinnedBases.has(base)) continue
    // §5.11: prefer the precise promotion-threshold reason over the generic fallback.
    const reason = promotionDrops.get(base) ?? computeDropReason(m)
    dropped.push({ mention: m, reason })
  }

  return {
    entities: pinned.entities,
    concepts: pinned.concepts,
    dropped,
    indexAdditions: raw.index_additions,
    logEntry: raw.log_entry,
  }
}

function extractDescription(content: string): string {
  // Front-matter ends at the second '---'; description is the first non-empty paragraph after `# title`
  const parts = content.split(/\n---\n/)
  const body = parts.length >= 2 ? parts.slice(1).join('\n---\n') : content
  const lines = body.split('\n')
  let seenTitle = false
  for (const ln of lines) {
    const t = ln.trim()
    if (!seenTitle) { if (t.startsWith('# ')) seenTitle = true; continue }
    if (!t) continue
    if (t.startsWith('## ') || t.startsWith('- ')) break
    return t
  }
  return ''
}

interface PageBuildOk { ok: true; page: WikiPage }
interface PageBuildFail { ok: false; reason: string }

/**
 * §5.10.4 D-wide: anti-pattern + type validation 폐기. minimal validation
 * (empty name / empty type) + canonicalizeSlug alias normalization 만.
 *
 * §5.10.4 follow-up: display_name (원문 표기) 가 있으면 frontmatter title 로 사용,
 * 없으면 base slug fallback. aliases 는 raw + base 자동 합집합 (title 자체는 제외).
 */
function validateAndBuildPage(
  raw: RawPage,
  category: 'entity' | 'concept',
  sourceFilename: string,
  rawSourceFilename: string,
  sourcePageBase: string,
  today: string,
  userAliases?: Readonly<Record<string, string>>,
): PageBuildOk | PageBuildFail {
  const name = (raw.name ?? '').trim()
  if (!name) return { ok: false, reason: 'empty name' }
  const type = (raw.type ?? '').trim()
  if (!type) return { ok: false, reason: 'empty type' }

  const base = canonicalizeSlug(normalizeBase(name), userAliases)
  const description = (raw.description ?? '').trim() || '(설명 없음)'
  const displayTitle = (raw.display_name ?? '').trim() || base
  const aliases = Array.from(new Set([
    ...(raw.aliases ?? []).map((a) => a.trim()).filter(Boolean),
    base,
  ].filter((a) => a !== displayTitle)))

  const page: WikiPage = {
    filename: `${base}.md`,
    category: category === 'entity' ? 'entities' : 'concepts',
    entityType: category === 'entity' ? type : undefined,
    conceptType: category === 'concept' ? type : undefined,
    content: buildPageContent({
      name: base, title: displayTitle, aliases, type, description, category,
      sourceFilename, rawSourceFilename, sourcePageBase, today,
    }),
  }
  return { ok: true, page }
}

function buildPageContent(args: {
  name: string; title?: string; aliases?: readonly string[];
  type: string; description: string;
  category: 'entity' | 'concept';
  sourceFilename: string;
  rawSourceFilename: string;
  sourcePageBase: string; today: string;
  relatedLinks?: readonly string[];
}): string {
  const { name, type, description, category, sourceFilename, rawSourceFilename, sourcePageBase, today, relatedLinks } = args
  const titleValue = (args.title ?? name).trim() || name
  const aliasesField = args.aliases && args.aliases.length > 0
    ? `aliases: [${args.aliases.map((a) => JSON.stringify(a)).join(', ')}]\n`
    : ''
  const typeField = category === 'entity' ? `entity_type: ${type}` : `concept_type: ${type}`
  // §5.2.1: optional `## 관련` H2 sandwiched between description and `## 출처`.
  // Empty/undefined relatedLinks → section omitted (no empty H2).
  const relatedSection = relatedLinks && relatedLinks.length > 0
    ? `## 관련

${relatedLinks.map((b) => `- [[${b}]]`).join('\n')}

`
    : ''
  // §5.12 — `## 출처` 첫 줄 wikilink 가 wiki/sources/<sourcePageBase>.md 단일 진실 소스 매칭.
  // §5.13.A1 — 둘째 줄 raw wikilink `[[<rawSourceFilename>|원문]]` 추가. Obsidian basename
  //   matcher 가 raw/<bucket>/<rawSourceFilename> 매칭 + validate-wiki.sh §5.13.B2 link 자체
  //   매칭 PASS. PII guard ON 시 sourceFilename 은 mask 적용된 형식이라 raw wikilink target
  //   으로 부적합 → rawSourceFilename (mask 안 된 원본) 별도 사용.
  // §5.16 follow-up — rawSourceFilename 은 caller 가 `sanitizeWikilinkTarget` 통과한 상태
  //   라고 가정 (commands.ts::runIngest 진입 시 vault rename 적용). target 안 wikilink-unsafe
  //   character 0 invariant. caller 미적용 시 본 함수가 추가 sanitize fallback 으로 안전.
  const sourceDisplay = sourceFilename.replace(/\.[^.]+$/, '')
  const safeRawTarget = sanitizeWikilinkTarget(rawSourceFilename)
  return `---
title: ${titleValue}
type: ${category}
${typeField}
${aliasesField}created: ${today}
updated: ${today}
sources: [${sourceFilename}]
tags: []
---

# ${titleValue}

${description}

${relatedSection}## 출처

- [[${sourcePageBase}|${sourceDisplay}]]
- [[${safeRawTarget}|원문]]
`
}

/**
 * §5.2.1 — rebuild a single page with `## 관련` cross-link section. `related` 가
 * 비어 있거나 self-only 면 page 그대로 반환. type 누락 시도 그대로 반환.
 *
 * §5.10.4 P2-1: rebuild 시 frontmatter 의 title + aliases 보존 — display_name
 * 원문 보존이 cross-link 단계에서 영문 slug 으로 회귀하지 않도록.
 */
function rebuildPageWithCrossLinks(
  page: WikiPage,
  related: readonly string[],
  sourceFilename: string,
  rawSourceFilename: string,
  sourcePageBase: string,
  today: string,
): WikiPage {
  if (related.length === 0) return page
  const ownBase = normalizeBase(page.filename)
  const filtered = related.filter((b) => b !== ownBase)
  if (filtered.length === 0) return page
  const isEntity = page.category === 'entities'
  const type = isEntity ? page.entityType : page.conceptType
  if (!type) return page
  const preservedTitle = extractFrontmatterScalar(page.content, 'title')
  const preservedAliases = extractFrontmatterList(page.content, 'aliases')
  return {
    ...page,
    content: buildPageContent({
      name: ownBase,
      title: preservedTitle,
      aliases: preservedAliases,
      type,
      description: extractDescription(page.content) || '(설명 없음)',
      category: isEntity ? 'entity' : 'concept',
      sourceFilename,
      rawSourceFilename,
      sourcePageBase,
      today,
      relatedLinks: filtered,
    }),
  }
}

/**
 * §5.2.1 — inject `## 관련` cross-link section into entity/concept pages.
 *
 * Policy (option B, deterministic): every entity in a single ingest cycle links to
 * every concept in that cycle (and vice versa). Self-links and intra-pool links not
 * generated. Empty other-pool → page unchanged (no empty H2). Bullets sorted by base.
 */
function applyCrossLinks(
  entities: WikiPage[],
  concepts: WikiPage[],
  sourceFilename: string,
  rawSourceFilename: string,
  sourcePageBase: string,
  today: string,
): { entities: WikiPage[]; concepts: WikiPage[] } {
  const entityBases = entities.map((p) => normalizeBase(p.filename)).sort()
  const conceptBases = concepts.map((p) => normalizeBase(p.filename)).sort()
  return {
    entities: entities.map((p) => rebuildPageWithCrossLinks(p, conceptBases, sourceFilename, rawSourceFilename, sourcePageBase, today)),
    concepts: concepts.map((p) => rebuildPageWithCrossLinks(p, entityBases, sourceFilename, rawSourceFilename, sourcePageBase, today)),
  }
}

/** Extract a scalar frontmatter field. Naive single-line parser (no anchors / multiline). */
function extractFrontmatterScalar(content: string, key: string): string | undefined {
  const re = new RegExp(`^${key}:[ \\t]+(.+)$`, 'm')
  const m = content.match(re)
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : undefined
}

/** Extract a flow-style list field: `aliases: ["a", "b"]` or `aliases: [a, b]`. */
function extractFrontmatterList(content: string, key: string): readonly string[] {
  const re = new RegExp(`^${key}:[ \\t]+\\[(.*)\\]$`, 'm')
  const m = content.match(re)
  if (!m) return []
  return m[1]
    .split(',')
    .map((s) => s.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean)
}

function computeDropReason(mention: Mention): string {
  if (!mention.type_hint || mention.type_hint === 'unknown') return 'no type_hint'
  return 'rejected by canonicalizer LLM'
}

// ── LLM helpers ──

async function callLLMWithRetry(
  llm: LLMClient, prompt: string, provider: string, model: string,
  deterministic?: boolean,
  config?: WikeyConfig,
): Promise<RawCanonical> {
  const detOpts = deterministic ? { temperature: 0, seed: 42 } : {}
  // §5.6.4 commit 15: see adaptive-json-mode.ts for matrix + fallback rules.
  const jsonModeNative = resolveJsonModeNative(provider, config)
  const effectivePrompt = jsonModeNative ? prompt : `${JSON_ONLY_PROMPT_PREFIX}${prompt}`
  for (let attempt = 0; attempt <= MAX_JSON_RETRIES; attempt++) {
    const llmOpts = buildAdaptiveLlmOpts(provider, model, jsonModeNative, detOpts)
    const response = await llm.call(effectivePrompt, llmOpts)
    const parsed = extractJsonBlock(response)
    if (parsed) return parsed
  }
  throw new Error('Canonicalizer JSON parse failed — max retries exceeded')
}

function extractJsonBlock(response: string): RawCanonical | null {
  // Try fenced JSON block
  const fenced = response.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) {
    try { return JSON.parse(fenced[1]) } catch { /* fall through */ }
  }
  // Try bare JSON object
  const start = response.indexOf('{')
  if (start < 0) return null
  // Naive: take from first { to last }
  const end = response.lastIndexOf('}')
  if (end < 0) return null
  try { return JSON.parse(response.slice(start, end + 1)) } catch { return null }
}

// ── §5.17 Spec 1 — promotion threshold ceiling outlier cap ──

/** Minimal proposal shape used by `applyCeilingCap` (decoupled from full ProposalPage). */
export interface ProposalForCeiling {
  readonly name: string
  readonly confidence: number
  readonly mentionPosition: number
  readonly aliases?: readonly string[]
}

/** Telemetry struct returned alongside `applyCeilingCap.selected` (Spec 1 T12). */
export interface PromotionDecision {
  readonly inputCharLen: number
  readonly proposedCount: number
  readonly selectedCount: number
  readonly ceiling: number
  readonly charsPerPage: number
  readonly reason: string
}

/**
 * §5.17 Spec 1 — typical 분해는 LLM 자율, large outlier (case A 류) 만 cap.
 *   formula  = max(ceilingMin, floor(inputCharLen / charsPerPage))
 *   ceiling  = absolute !== undefined ? min(absolute, formula) : formula
 *   final    = min(proposedCount, ceiling)
 *
 * Cap 시 confidence 내림차순 + tie-break mentionPosition 오름차순 (first-mention 우선).
 * I3 (hardcoded list 0건): name list / category mapping 사용 X — confidence/position 만.
 */
export function applyCeilingCap<T extends ProposalForCeiling>(args: {
  readonly inputCharLen: number
  readonly proposed: readonly T[]
  readonly config: PromotionThresholdConfig
}): { selected: T[]; decision: PromotionDecision } {
  const { inputCharLen, proposed, config } = args
  const charsPerPage = config.ceiling?.charsPerPage ?? DEFAULT_CHARS_PER_PAGE
  const ceilingMin = config.ceilingMin ?? DEFAULT_CEILING_MIN
  const absolute = config.ceiling?.absolute
  const proposedCount = proposed.length

  const formula = Math.max(ceilingMin, Math.floor(inputCharLen / charsPerPage))
  const ceilingRaw = absolute !== undefined ? Math.min(absolute, formula) : formula
  const ceiling = Math.min(proposedCount, ceilingRaw)

  let selected: T[]
  let reason: string
  if (proposedCount <= ceilingRaw) {
    selected = [...proposed]
    reason = proposedCount === 0 ? 'no-proposal' : 'no-cap'
  } else {
    // confidence desc + mentionPosition asc tie-break.
    selected = [...proposed].sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence
      return a.mentionPosition - b.mentionPosition
    }).slice(0, ceiling)
    reason = absolute !== undefined && absolute < formula ? 'absolute-cap' : 'formula-cap'
  }

  return {
    selected,
    decision: {
      inputCharLen, proposedCount, selectedCount: selected.length,
      ceiling, charsPerPage, reason,
    },
  }
}
