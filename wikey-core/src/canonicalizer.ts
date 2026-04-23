import type { LLMClient } from './llm-client.js'
import type {
  CanonicalizedResult, EntityType, ConceptType, Mention, SchemaOverride, WikiPage,
} from './types.js'
import {
  ENTITY_TYPES, CONCEPT_TYPES, isValidEntityType, isValidConceptType,
  detectAntiPattern, buildSchemaPromptBlock,
} from './schema.js'
import { normalizeBase } from './wiki-ops.js'

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

/**
 * v7 §4.5.1.4: Entity/Concept boundary pins — overrides LLM's category choice
 * for slugs that oscillated between pools across runs.
 *
 * Pins: mqtt=entity (tool), restful-api=concept (standard), pms=entity (product).
 * `mqtt` is a protocol tool, `restful-api` is a named architectural standard,
 * `project-management-system` is a product category that LLM sometimes classified
 * as methodology.
 *
 * Applied AFTER schema validation as a post-processing step, not via schema
 * extension — the existing `.wikey/schema.yaml` only supports type vocabulary
 * extension, not per-instance classification.
 */
export const FORCED_CATEGORIES: Readonly<Record<string, {
  category: 'entity' | 'concept'
  type: EntityType | ConceptType
}>> = {
  // §4.5.1.4 (original pins)
  mqtt: { category: 'entity', type: 'tool' },
  'restful-api': { category: 'concept', type: 'standard' },
  'project-management-system': { category: 'entity', type: 'product' },

  // §4.5.1.6.4 — 30-run PMS data (2026-04-22) showed the slugs below flipping
  // between entity and concept pools across runs. All are industry-standard
  // *categories* or *methodologies*, not specific products, so the canonical
  // axis is concept; the `type` field matches schema sub-type conventions.
  'enterprise-resource-planning': { category: 'concept', type: 'standard' },
  'supply-chain-management': { category: 'concept', type: 'methodology' },
  'manufacturing-execution-system': { category: 'concept', type: 'standard' },
  'product-lifecycle-management': { category: 'concept', type: 'methodology' },
  'advanced-planning-and-scheduling': { category: 'concept', type: 'methodology' },
  'electronic-approval': { category: 'concept', type: 'methodology' },
  // SSO-API stays entity/tool (schema: tool = "소프트웨어/프로토콜"); matches
  // the §4.5.1.4 canonicalizer test where LLM emits `type: 'tool'`.
  'single-sign-on-api': { category: 'entity', type: 'tool' },
  'tcp-ip': { category: 'concept', type: 'standard' },
  'virtual-private-network': { category: 'concept', type: 'standard' },
  'bill-of-materials': { category: 'concept', type: 'standard' },
}

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
 * §4.5.1.7.2 PMBOK 10 knowledge areas 결정화 (작업 규칙 #7) 는 **단일 표준 하드코딩** 이다
 * (Phase 5 §5.6 Stage 0 사전 검증 성격). 실측으로 효과가 확증되면 이 블록은 self-extending
 * 구조로 이행한다 — 실행 로드맵은 `plan/phase-5-todo.md §5.6`, 철학 선언은
 * `wiki/analyses/self-extending-wiki.md`. 다음 표준 (ISO/ITIL/GDPR 등) 이 들어와도
 * **여기에 블록을 더 추가하지 말고** §5.6 Stage 1 (schema.yaml 로더화) 먼저 착수.
 * 누적 하드코딩 3 개 넘기 전에 이행.
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

  const schemaBlock = buildSchemaPromptBlock(schemaOverride)

  if (overridePrompt && overridePrompt.trim()) {
    return overridePrompt
      .replaceAll('{{SOURCE_FILENAME}}', sourceFilename)
      .replaceAll('{{GUIDE_BLOCK}}', guideBlock)
      .replaceAll('{{SCHEMA_BLOCK}}', schemaBlock)
      .replaceAll('{{EXISTING_BLOCK}}', existingBlock)
      .replaceAll('{{MENTIONS_BLOCK}}', mentionsBlock)
      .replaceAll('{{MENTIONS_COUNT}}', String(mentions.length))
  }

  return `당신은 wikey LLM Wiki의 canonicalizer입니다. chunk LLM이 추출한 mention 리스트를 받아 schema에 맞춰 분류하고 canonical filename으로 통합합니다.

Source: ${sourceFilename}
${guideBlock}
${schemaBlock}

## 작업 규칙

1. **분류**: 각 mention을 위 7개 타입 중 하나로 분류. 어디에도 안 맞으면 entities/concepts 출력에서 **제외** (자동 dropped 처리됨).
2. **약어↔풀네임 통합**: \`pms\`와 \`project-management-system\`이 같은 mention이면 풀네임 1개만 출력 (약어는 \`aliases\`에).
3. **기존 페이지 재사용**: 위 "기존 wiki 페이지" 목록과 매칭되면 filename은 기존 base 그대로 사용 (예: \`goodstream-co-ltd\` 발견 → \`goodstream\`로 새로 만들지 말 것).
4. **거부 패턴 자동 제외**: 한국어 라벨, X-management/X-service 같은 단순 기능명, 비즈니스 객체(quotation/order 등)는 schema 위반이므로 제외.
5. **filename 형식**: \`name\` 필드는 base name만 (소문자, 하이픈 구분, .md/디렉토리 prefix 금지).
6. **description**: 1~2문장, 산업 표준 정의 위주 (기능 설명 X).
7. **PMBOK 10 knowledge areas 개별 추출** (concepts 결정화): 본문에 PMBOK / 프로젝트 관리 지식체계 맥락이 등장하면 다음 10 영역은 각각 **별도 concept** 로 추출하고 상위 \`project-management-body-of-knowledge\` 하나로 묶지 말 것. 본문에 해당 영역이 직접 언급되지 않으면 추출하지 않는다 (hallucination 금지): \`project-integration-management\`, \`project-scope-management\`, \`project-schedule-management\` (또는 \`project-time-management\`), \`project-cost-management\`, \`project-quality-management\`, \`project-resource-management\` (또는 \`project-human-resource-management\`), \`project-communications-management\`, \`project-risk-management\`, \`project-procurement-management\`, \`project-stakeholder-management\`. 각 영역 type 은 \`methodology\`.

## 입력 mention (${mentions.length}개)

${mentionsBlock}

## 출력 형식

JSON only:
\`\`\`json
{
  "entities": [
    {"name": "goodstream-co-ltd", "type": "organization", "description": "주식회사 굿스트림. 소프트웨어 개발/제조업.", "aliases": ["goodstream"]}
  ],
  "concepts": [
    {"name": "project-management-body-of-knowledge", "type": "standard", "description": "PMI가 제정한 프로젝트 관리 표준 지식체계.", "aliases": ["pmbok"]}
  ],
  "index_additions": [
    "- [[goodstream-co-ltd]] — 주식회사 굿스트림 (소스: 1개)"
  ],
  "log_entry": "- 엔티티 생성: [[goodstream-co-ltd]]\\n- 개념 생성: [[project-management-body-of-knowledge]]"
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

  // v7 §4.5.1.4: apply E/C boundary pins (after schema validation + dedup)
  const pinned = applyForcedCategories(entities, concepts, sourceFilename, today)

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

/**
 * v7 §4.5.1.4: Post-process entity/concept pools against FORCED_CATEGORIES.
 * If a pinned slug lands in the wrong pool, move it with its pinned type.
 * Also de-duplicates if same canonical already in the target pool.
 */
function applyForcedCategories(
  entities: WikiPage[], concepts: WikiPage[],
  sourceFilename: string, today: string,
): { entities: WikiPage[]; concepts: WikiPage[] } {
  const outE: WikiPage[] = []
  const outC: WikiPage[] = []
  const targetBases = { entity: new Set<string>(), concept: new Set<string>() }

  const placeIntoTarget = (page: WikiPage, forced: { category: 'entity' | 'concept'; type: EntityType | ConceptType }) => {
    const base = normalizeBase(page.filename)
    const pool = forced.category === 'entity' ? outE : outC
    const seen = targetBases[forced.category]
    if (seen.has(base)) return
    seen.add(base)
    // Rebuild with forced type so front-matter matches the new category
    const isEntity = forced.category === 'entity'
    const type = forced.type
    const description = extractDescription(page.content)
    const newPage: WikiPage = {
      filename: page.filename,
      category: isEntity ? 'entities' : 'concepts',
      entityType: isEntity ? (type as EntityType) : undefined,
      conceptType: !isEntity ? (type as ConceptType) : undefined,
      content: buildPageContent({
        name: base, type: type as string,
        description: description || '(설명 없음)',
        category: forced.category, sourceFilename, today,
      }),
    }
    pool.push(newPage)
  }

  // Pass 1: entities pool → classify into outE (default) or outC (pinned concept)
  for (const p of entities) {
    const base = normalizeBase(p.filename)
    const forced = FORCED_CATEGORIES[base]
    if (forced) {
      placeIntoTarget(p, forced)
    } else {
      if (targetBases.entity.has(base)) continue
      targetBases.entity.add(base)
      outE.push(p)
    }
  }
  // Pass 2: concepts pool → classify into outC (default) or outE (pinned entity)
  for (const p of concepts) {
    const base = normalizeBase(p.filename)
    // Skip if already placed by pin in entity pool
    if (targetBases.entity.has(base)) continue
    const forced = FORCED_CATEGORIES[base]
    if (forced) {
      placeIntoTarget(p, forced)
    } else {
      if (targetBases.concept.has(base)) continue
      targetBases.concept.add(base)
      outC.push(p)
    }
  }

  return { entities: outE, concepts: outC }
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

function validateAndBuildPage(
  raw: { name?: string; type?: string; description?: string },
  category: 'entity' | 'concept',
  sourceFilename: string,
  today: string,
  schemaOverride?: SchemaOverride,
): PageBuildOk | PageBuildFail {
  const name = (raw.name ?? '').trim()
  if (!name) return { ok: false, reason: 'empty name' }

  // v7 §4.5.1.4: normalize LLM output through slug alias map BEFORE anti-pattern check,
  // so variant spellings collapse to one canonical slug deterministically.
  const base = canonicalizeSlug(normalizeBase(name))
  const antiPattern = detectAntiPattern(base)
  if (antiPattern) return { ok: false, reason: antiPattern }

  const type = (raw.type ?? '').trim()
  if (category === 'entity' && !isValidEntityType(type, schemaOverride)) {
    return { ok: false, reason: `invalid entity type "${type}"` }
  }
  if (category === 'concept' && !isValidConceptType(type, schemaOverride)) {
    return { ok: false, reason: `invalid concept type "${type}"` }
  }

  const description = (raw.description ?? '').trim() || '(설명 없음)'

  const page: WikiPage = {
    filename: `${base}.md`,
    category: category === 'entity' ? 'entities' : 'concepts',
    entityType: category === 'entity' ? (type as EntityType) : undefined,
    conceptType: category === 'concept' ? (type as ConceptType) : undefined,
    content: buildPageContent({ name: base, type, description, category, sourceFilename, today }),
  }
  return { ok: true, page }
}

function buildPageContent(args: {
  name: string; type: string; description: string;
  category: 'entity' | 'concept'; sourceFilename: string; today: string;
}): string {
  const { name, type, description, category, sourceFilename, today } = args
  const typeField = category === 'entity' ? `entity_type: ${type}` : `concept_type: ${type}`
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

## 출처

- [[${sourceFilename.replace(/\.[^.]+$/, '')}]]
`
}

function computeDropReason(mention: Mention): string {
  const base = normalizeBase(mention.name)
  const antiPattern = detectAntiPattern(base)
  if (antiPattern) return antiPattern
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
