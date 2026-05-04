import type { LLMClient } from './llm-client.js'
import type {
  CanonicalizedResult, Mention, SchemaOverride, WikiPage,
} from './types.js'
// Phase 5 §5.10.3 R1+R2 (D-wide): ENTITY_TYPES / CONCEPT_TYPES / isValidEntityType /
// isValidConceptType / detectAntiPattern / buildSchemaPromptBlock 폐기. LLM 자율 type 분류.
import { buildStandardDecompositionBlock } from './schema.js'
import { normalizeBase } from './wiki-ops.js'
import {
  EXAMPLE_ORG_BASE, EXAMPLE_ORG_ALIAS, EXAMPLE_ORG_KO, EXAMPLE_ORG_DESC_KO,
  EXAMPLE_CONCEPT_BASE, EXAMPLE_CONCEPT_ALIAS,
} from './example-placeholders.js'

/**
 * Phase C v6: Stage 2 Canonicalizer.
 *
 * Single document-global LLM call that:
 *   1. Takes all mentions from chunk LLMs (Stage 1) + existing wiki page list
 *   2. Maps each mention to canonical entity/concept under schema constraints
 *   3. Resolves abbreviation↔fullname pairs and existing-page reuse
 *   4. Drops mentions that violate schema or anti-patterns
 *
 * Key invariants:
 *   - Output filenames are normalized base names (no path, no .md → wiki-ops adds .md)
 *   - Each kept page has an explicit entityType or conceptType
 *   - Schema validation + anti-pattern check both apply (defense in depth)
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
  // (Pool axis is pinned in FORCED_CATEGORIES; see §4.5.1.6.4.)
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

export function canonicalizeSlug(base: string): string {
  return SLUG_ALIASES[base] ?? base
}

// Phase 5 §5.10.3 R2 (D-wide LLM-only ontology): FORCED_CATEGORIES 폐기.
// 변경 전: 30-run PMS 측정 oscillation 안정화 위해 slug 별 entity/concept 강제 pin.
// 변경 후: LLM 자율 분류. determinism 측정은 슬러그별 pin 이 아닌 LLM 자체 안정성 측정.
// minimal alias normalization (SLUG_ALIASES, canonicalizeSlug, dedupAcronymsCrossPool) 만 잔존.

export interface CanonicalizeArgs {
  readonly llm: LLMClient
  readonly mentions: readonly Mention[]
  readonly existingEntityBases: readonly string[]
  readonly existingConceptBases: readonly string[]
  readonly sourceFilename: string
  readonly today: string
  readonly guideHint?: string
  readonly provider: string
  readonly model: string
  /** v7-5: user-defined schema extension from `.wikey/schema.yaml`. */
  readonly schemaOverride?: SchemaOverride
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
}

interface RawCanonical {
  entities?: Array<{ name?: string; type?: string; description?: string; aliases?: string[] }>
  concepts?: Array<{ name?: string; type?: string; description?: string; aliases?: string[] }>
  index_additions?: string[]
  log_entry?: string
}

export async function canonicalize(args: CanonicalizeArgs): Promise<CanonicalizedResult> {
  const { llm, mentions, existingEntityBases, existingConceptBases,
          sourceFilename, today, guideHint, provider, model, schemaOverride, deterministic, overridePrompt } = args

  if (mentions.length === 0) {
    return { entities: [], concepts: [], dropped: [] }
  }

  const prompt = buildCanonicalizerPrompt({
    mentions, existingEntityBases, existingConceptBases,
    sourceFilename, guideHint, schemaOverride, overridePrompt,
  })

  const raw = await callLLMWithRetry(llm, prompt, provider, model, deterministic)
  return assembleCanonicalResult(raw, mentions, sourceFilename, today, schemaOverride)
}

// ── Prompt construction ──

interface PromptArgs {
  mentions: readonly Mention[]
  existingEntityBases: readonly string[]
  existingConceptBases: readonly string[]
  sourceFilename: string
  guideHint?: string
  schemaOverride?: SchemaOverride
  /** §4.3.1: optional Stage 3 full prompt override. Variables substituted as documented above. */
  overridePrompt?: string
}

/**
 * §4.5.1.7.2 PMBOK 10 knowledge areas 결정화 (작업 규칙 #7) 는 §5.4.1 Stage 1 진입과
 * 함께 schema.yaml 로 이전됨 — `BUILTIN_STANDARD_DECOMPOSITIONS` 가 코드 default 로
 * PMBOK 을 자동 적용하고, `.wikey/schema.yaml` 의 `standard_decompositions:` entry 가
 * built-in append (F1) 또는 `[]` explicit disable. 다음 표준 (ISO/ITIL/GDPR 등) 은
 * 사용자가 vault yaml 에 entry 만 추가하면 자동 통합 — 여기 블록을 더 추가하지 말 것.
 */
export function buildCanonicalizerPrompt(args: PromptArgs): string {
  const { mentions, existingEntityBases, existingConceptBases, sourceFilename, guideHint, schemaOverride, overridePrompt } = args

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

  // Phase 5 §5.10.3 R2 (D-wide): schemaBlock 폐기. LLM 자율 type 분류.
  const decompositionBlock = buildStandardDecompositionBlock(schemaOverride)

  if (overridePrompt && overridePrompt.trim()) {
    return overridePrompt
      .replaceAll('{{SOURCE_FILENAME}}', sourceFilename)
      .replaceAll('{{GUIDE_BLOCK}}', guideBlock)
      .replaceAll('{{SCHEMA_BLOCK}}', '')   // Phase 5 §5.10.3 R2: schema gate 폐기.
      .replaceAll('{{STANDARD_DECOMPOSITION_BLOCK}}', decompositionBlock)
      .replaceAll('{{EXISTING_BLOCK}}', existingBlock)
      .replaceAll('{{MENTIONS_BLOCK}}', mentionsBlock)
      .replaceAll('{{MENTIONS_COUNT}}', String(mentions.length))
  }

  const decompositionSection = decompositionBlock ? `\n${decompositionBlock}\n` : ''

  // Phase 5 §5.10.3 R2 (D-wide): schema 7-type 강제 prompt 폐기. LLM 자율 type 분류.
  return `당신은 wikey LLM Wiki의 canonicalizer입니다. chunk LLM이 추출한 mention 리스트를 받아 entity/concept 으로 분류하고 canonical filename 으로 통합합니다.

Source: ${sourceFilename}
${guideBlock}

## 작업 규칙

1. **분류**: 각 mention 을 entity (조직·인물·제품·도구 등 고유명사) 또는 concept (이론·방법론·표준·문서유형 등 추상명사) 으로 자율 분류. type 필드는 자유 string (예: organization / person / product / tool / standard / methodology / document_type / algorithm / dataset / metric 등). 어디에도 안 맞으면 entities/concepts 출력에서 **제외**.
2. **약어↔풀네임 통합**: \`pms\`와 \`project-management-system\`이 같은 mention이면 풀네임 1개만 출력 (약어는 \`aliases\`에).
3. **기존 페이지 재사용**: 위 "기존 wiki 페이지" 목록과 매칭되면 filename은 기존 base 그대로 사용 (예: \`${EXAMPLE_ORG_BASE}\` 발견 → \`${EXAMPLE_ORG_ALIAS}\`로 새로 만들지 말 것).
4. **filename 형식**: \`name\` 필드는 base name만 (소문자, 하이픈 구분, .md/디렉토리 prefix 금지).
5. **description**: 1~2문장, 의미 위주.
${decompositionSection}
## 입력 mention (${mentions.length}개)

${mentionsBlock}

## 출력 형식

JSON only:
\`\`\`json
{
  "entities": [
    {"name": "${EXAMPLE_ORG_BASE}", "type": "organization", "description": "${EXAMPLE_ORG_DESC_KO}", "aliases": ["${EXAMPLE_ORG_ALIAS}"]}
  ],
  "concepts": [
    {"name": "${EXAMPLE_CONCEPT_BASE}", "type": "standard", "description": "PMI가 제정한 프로젝트 관리 표준 지식체계.", "aliases": ["${EXAMPLE_CONCEPT_ALIAS}"]}
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

function assembleCanonicalResult(
  raw: RawCanonical,
  mentions: readonly Mention[],
  sourceFilename: string,
  today: string,
  schemaOverride?: SchemaOverride,
): CanonicalizedResult {
  const dropped: Array<{ mention: Mention; reason: string }> = []
  const keptBases = new Set<string>()
  const entities: WikiPage[] = []
  const concepts: WikiPage[] = []

  for (const e of raw.entities ?? []) {
    const result = validateAndBuildPage(e, 'entity', sourceFilename, today, schemaOverride)
    if (!result.ok) continue
    entities.push(result.page)
    keptBases.add(normalizeBase(result.page.filename))
    for (const alias of e.aliases ?? []) keptBases.add(canonicalizeSlug(normalizeBase(alias)))
  }

  for (const c of raw.concepts ?? []) {
    const result = validateAndBuildPage(c, 'concept', sourceFilename, today, schemaOverride)
    if (!result.ok) continue
    // Cross-pool dedup: if entity with same base already kept, skip concept
    if (keptBases.has(normalizeBase(result.page.filename))) continue
    concepts.push(result.page)
    keptBases.add(normalizeBase(result.page.filename))
    for (const alias of c.aliases ?? []) keptBases.add(canonicalizeSlug(normalizeBase(alias)))
  }

  // Phase 5 §5.10.3 R2 (D-wide): applyForcedCategories 폐기. LLM 분류 그대로 통과.
  // §5.2.1: inject `## 관련` cross-links between same-cycle entity ↔ concept pages.
  // Deterministic policy: every entity links to all concepts in the cycle (and vice versa).
  // Empty other-pool → no `## 관련` H2 (no empty section). Sorted alphabetically.
  const pinned = applyCrossLinks(entities, concepts, sourceFilename, today)

  // Track dropped mentions: anything in `mentions` whose canonical base didn't survive
  const pinnedBases = new Set<string>()
  for (const p of pinned.entities) pinnedBases.add(normalizeBase(p.filename))
  for (const p of pinned.concepts) pinnedBases.add(normalizeBase(p.filename))
  for (const m of mentions) {
    const base = canonicalizeSlug(normalizeBase(m.name))
    if (pinnedBases.has(base)) continue
    const reason = computeDropReason(m)
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

// Phase 5 §5.10.3 R2 (D-wide): applyForcedCategories + FORCED_CATEGORIES 폐기. LLM 자율 분류 그대로 통과.
// `mqtt`/`restful-api`/`pms` 같은 boundary pin 도 모두 폐기. 측정 안정성은 LLM 자체 안정성에 의존.

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

// Phase 5 §5.10.3 R2 (D-wide): validateAndBuildPage 의 anti-pattern + type validation 폐기.
// LLM 자율 출력 통과. minimal alias normalization (canonicalizeSlug) 만 잔존.
function validateAndBuildPage(
  raw: { name?: string; type?: string; description?: string },
  category: 'entity' | 'concept',
  sourceFilename: string,
  today: string,
  _schemaOverride?: SchemaOverride,
): PageBuildOk | PageBuildFail {
  const name = (raw.name ?? '').trim()
  if (!name) return { ok: false, reason: 'empty name' }

  // alias normalization (variant spellings collapse to canonical slug, deterministic)
  const base = canonicalizeSlug(normalizeBase(name))

  const type = (raw.type ?? '').trim()
  if (!type) return { ok: false, reason: 'empty type' }

  const description = (raw.description ?? '').trim() || '(설명 없음)'

  const page: WikiPage = {
    filename: `${base}.md`,
    category: category === 'entity' ? 'entities' : 'concepts',
    entityType: category === 'entity' ? type : undefined,
    conceptType: category === 'concept' ? type : undefined,
    content: buildPageContent({ name: base, type, description, category, sourceFilename, today }),
  }
  return { ok: true, page }
}

function buildPageContent(args: {
  name: string; type: string; description: string;
  category: 'entity' | 'concept'; sourceFilename: string; today: string;
  relatedLinks?: readonly string[];
}): string {
  const { name, type, description, category, sourceFilename, today, relatedLinks } = args
  const typeField = category === 'entity' ? `entity_type: ${type}` : `concept_type: ${type}`
  // §5.2.1: optional `## 관련` H2 sandwiched between description and `## 출처`.
  // Empty/undefined relatedLinks → section omitted (no empty H2).
  const relatedSection = relatedLinks && relatedLinks.length > 0
    ? `## 관련

${relatedLinks.map((b) => `- [[${b}]]`).join('\n')}

`
    : ''
  // §5.3 follow-up #11 — entity/concept '## 출처' wikilink 표준화.
  // 이전: [[<basename without ext>]] 형식 — Obsidian wikilink resolver 가 .md 파일만 매칭하므로
  //       paired pdf/hwp 등의 sidecar (`<base>.<ext>.md`) basename 과 안 맞아 unresolved.
  // 변경: alias `[[<sidecar path>|<basename without ext>]]` — sidecar 파일 규칙 derive
  //       (`.md`/`.txt` 자체, 그 외 `<base>.<ext>.md`). sidecar 가 vault 에 있으면 resolve OK,
  //       화면 display 는 raw basename 으로 짧게.
  const lowerSrc = sourceFilename.toLowerCase()
  const sidecarRef =
    lowerSrc.endsWith('.md') || lowerSrc.endsWith('.txt')
      ? sourceFilename
      : `${sourceFilename}.md`
  const sourceDisplay = sourceFilename.replace(/\.[^.]+$/, '')
  return `---
title: ${name}
type: ${category}
${typeField}
created: ${today}
updated: ${today}
sources: [${sourceFilename}]
tags: []
---

# ${name}

${description}

${relatedSection}## 출처

- [[${sidecarRef}|${sourceDisplay}]]
`
}

/**
 * §5.2.1 — inject `## 관련` cross-link section into entity/concept pages.
 *
 * Policy (option B, deterministic): every entity in the same ingest cycle links to
 * every concept in that cycle (and vice versa). Self-links and entity↔entity /
 * concept↔concept links are not generated. Empty other-pool → page is unchanged
 * (no empty H2). Bullets sorted alphabetically by base.
 */
function applyCrossLinks(
  entities: WikiPage[],
  concepts: WikiPage[],
  sourceFilename: string,
  today: string,
): { entities: WikiPage[]; concepts: WikiPage[] } {
  const entityBases = entities.map((p) => normalizeBase(p.filename)).sort()
  const conceptBases = concepts.map((p) => normalizeBase(p.filename)).sort()
  const rebuild = (page: WikiPage, related: readonly string[]): WikiPage => {
    if (related.length === 0) return page
    const ownBase = normalizeBase(page.filename)
    const filtered = related.filter((b) => b !== ownBase)
    if (filtered.length === 0) return page
    const isEntity = page.category === 'entities'
    const type = isEntity ? page.entityType : page.conceptType
    if (!type) return page
    return {
      ...page,
      content: buildPageContent({
        name: ownBase,
        type: type as string,
        description: extractDescription(page.content) || '(설명 없음)',
        category: isEntity ? 'entity' : 'concept',
        sourceFilename,
        today,
        relatedLinks: filtered,
      }),
    }
  }
  return {
    entities: entities.map((p) => rebuild(p, conceptBases)),
    concepts: concepts.map((p) => rebuild(p, entityBases)),
  }
}

function computeDropReason(mention: Mention): string {
  // Phase 5 §5.10.3 R2 (D-wide): detectAntiPattern 폐기. LLM 자율 분류.
  if (!mention.type_hint || mention.type_hint === 'unknown') return 'no type_hint'
  return 'rejected by canonicalizer LLM'
}

// ── LLM helpers ──

async function callLLMWithRetry(
  llm: LLMClient, prompt: string, provider: string, model: string,
  deterministic?: boolean,
): Promise<RawCanonical> {
  const detOpts = deterministic ? { temperature: 0, seed: 42 } : {}
  for (let attempt = 0; attempt <= MAX_JSON_RETRIES; attempt++) {
    const llmOpts = provider === 'gemini'
      ? { provider: provider as any, model, responseMimeType: 'application/json' as const, jsonMode: true, ...detOpts }
      : { provider: provider as any, model, jsonMode: true, ...detOpts }
    const response = await llm.call(prompt, llmOpts)
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
