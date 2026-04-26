/**
 * §5.4 Stage 3 — in-source self-declaration.
 *
 * 소스 본문이 "이 표준은 다음 N 영역을 갖습니다: A, B, C..." 같이 enumerate 하면
 * section-index.ts 의 `headingPattern === 'standard-overview'` 섹션을 감지 →
 * deterministic structured decomposition extraction → runtime-scope (해당 ingest
 * 세션만) 또는 사용자 승인 후 persist.
 *
 * - AC9  mergeRuntimeIntoOverride: SchemaOverride 위에 runtime entries append
 * - AC11 extractSelfDeclaration: numbered/bullet list ≥ 5 items 패턴 매칭
 * - AC12 elevateToReview / persistDeclaration: persistChoice 상태 전이
 * - AC13 shouldStage3ProposeRuntime: Stage 2 suggestion 충돌 처리
 * - AC14 false positive guard: marketing keyword silent drop + slug 길이 검사
 *
 * spec: plan/phase-5-todox-5.4-integration.md §3.3 (line 560-776)
 */

import type {
  SchemaOverride,
  SelfDeclaration,
  StandardDecomposition,
  StandardDecompositionComponent,
  SuggestionStore,
} from './types.js'
import type { Section } from './section-index.js'
import { canonicalizeSlug } from './canonicalizer.js'

// ── 상수 ────────────────────────────────────────────────────────────────────

/** §3.3.5 (b) — body enumerate 최소 임계 */
const MIN_LIST_ITEMS = 5

/** §3.3.5 (c) — component slug 최소 길이 (false positive 방지) */
const MIN_COMPONENT_SLUG_LEN = 5

/**
 * §3.3.5 (a) — marketing-specific keyword. 본문에 등장 시 silent drop (v1).
 * v2 deferral: 추가 keyword + LLM 분류기.
 */
const MARKETING_KEYWORDS = [
  /\bfeature(s)?\b/i,
  /\bbenefit(s)?\b/i,
  /핵심\s*기능/,
  /주요\s*기능/,
]

// ── helpers ─────────────────────────────────────────────────────────────────

/**
 * Section title 에서 umbrella 표시명 추출. e.g.,
 *   "ISO 27001 개요" → "ISO 27001"
 *   "PMBOK 영역" → "PMBOK"
 *   "Body of Knowledge" → "Body of Knowledge" (suffix 없으면 원문)
 */
function inferUmbrellaName(title: string): string {
  const stripped = title.replace(
    /\s*(개요|overview|introduction|구조|structure|architecture|구성|composition|영역|domain|area|지식체계|body of knowledge|knowledge\s+area)\s*$/i,
    '',
  ).trim()
  return stripped.length > 0 ? stripped : title.trim()
}

/**
 * 본문 한 줄에서 numbered list (1. ...) 또는 bullet list (- ...) 항목을 추출.
 * 괄호/대괄호 부속 설명은 제거 (`A (description)` → `A`).
 */
function extractListItem(line: string): string | null {
  const m = line.match(/^\s*(?:\d+\.|-)\s+(.+?)(?:\s*[(\[].*)?$/)
  if (!m) return null
  const item = m[1].trim()
  return item.length > 0 ? item : null
}

/**
 * Display 문자열을 slug 으로 정규화. 한글은 그대로 유지, 영문은 소문자, 공백·구분자는
 * 하이픈. 마지막에 alias map 적용.
 */
function toSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[\s_/]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
  return canonicalizeSlug(base)
}

// ── AC9 — mergeRuntimeIntoOverride ───────────────────────────────────────────

/**
 * SchemaOverride 위에 runtime SelfDeclaration[] 을 append.
 *
 * 분기:
 * - runtime 비어있음 → override 그대로 (early return)
 * - empty-explicit → runtime 무시 (사용자 명시 disable, 의도 보존)
 * - empty-all-skipped → runtime 만 (BUILTIN 은 builder 가 add)
 * - present → user yaml + runtime append
 * - override undefined → runtime 만으로 신규 override
 *
 * spec: plan §3.3.3 line 709-741
 */
export function mergeRuntimeIntoOverride(
  override: SchemaOverride | undefined,
  runtime: readonly SelfDeclaration[],
): SchemaOverride | undefined {
  if (runtime.length === 0) return override

  const runtimeItems: StandardDecomposition[] = runtime.map((sd) => ({
    name: sd.umbrella_name,
    aliases: [],
    umbrella_slug: sd.umbrella_slug,
    components: sd.components,
    rule: sd.rule,
    require_explicit_mention: sd.require_explicit_mention,
    origin: 'self-declared' as const,
  }))

  const baseState = override?.standardDecompositions

  // 사용자 명시 disable — runtime 도 무시 (의도 보존)
  if (baseState?.kind === 'empty-explicit') return override

  let newItems: readonly StandardDecomposition[]
  if (!baseState || baseState.kind === 'empty-all-skipped') {
    newItems = runtimeItems
  } else {
    // baseState.kind === 'present'
    newItems = [...baseState.items, ...runtimeItems]
  }

  return {
    entityTypes: override?.entityTypes ?? [],
    conceptTypes: override?.conceptTypes ?? [],
    standardDecompositions: { kind: 'present', items: newItems },
  }
}

// ── AC11 — extractSelfDeclaration ────────────────────────────────────────────

/**
 * 'standard-overview' 섹션에서 deterministic pattern matching 으로 SelfDeclaration
 * 추출. v1 = pattern-matching only. LLM 호출 옵션은 v2 deferral.
 *
 * 반환 null 조건:
 * - section.headingPattern !== 'standard-overview'
 * - listItems.length < MIN_LIST_ITEMS (= 5)
 * - 본문에 marketing keyword 등장 (AC14)
 * - component slug 중 하나가 MIN_COMPONENT_SLUG_LEN 미만 (AC14)
 *
 * spec: plan §3.3.2 line 626-679 + §3.3.5 line 757-766
 */
export function extractSelfDeclaration(
  section: Section,
  source: string,
  _options: { llm?: false } = {},
): SelfDeclaration | null {
  if (section.headingPattern !== 'standard-overview') return null

  // AC14 (a): marketing keyword 본문 → silent drop
  if (MARKETING_KEYWORDS.some((re) => re.test(section.body))) return null

  const lines = section.body.split('\n')
  const listItems: string[] = []
  for (const line of lines) {
    const item = extractListItem(line)
    if (item !== null) listItems.push(item)
  }
  if (listItems.length < MIN_LIST_ITEMS) return null

  const components: StandardDecompositionComponent[] = listItems.map((item) => ({
    slug: toSlug(item),
    type: 'methodology',
  }))

  // AC14 (c): component slug 길이 < MIN_COMPONENT_SLUG_LEN → silent drop
  if (components.some((c) => c.slug.length < MIN_COMPONENT_SLUG_LEN)) return null

  const umbrella_name = inferUmbrellaName(section.title)
  const umbrella_slug = toSlug(umbrella_name)

  return {
    umbrella_slug,
    umbrella_name,
    components,
    rule: 'decompose',
    require_explicit_mention: true,
    source,
    section_idx: section.idx,
    section_title: section.title,
    extractor: 'pattern-matching',
    extractedAt: new Date().toISOString(),
    persistChoice: { kind: 'runtime-only' },
  }
}

// ── AC12 — persistChoice transitions ────────────────────────────────────────

/**
 * runtime-only → pending-user-review 전이 (re-ingest 시 자동 elevation).
 * Immutable: 신규 SelfDeclaration 반환.
 */
export function elevateToReview(declaration: SelfDeclaration): SelfDeclaration {
  return { ...declaration, persistChoice: { kind: 'pending-user-review' } }
}

/**
 * pending-user-review → persisted 전이 (사용자 accept 시 schema.yaml append 후).
 * Immutable: 신규 SelfDeclaration 반환.
 */
export function persistDeclaration(
  declaration: SelfDeclaration,
  persistedAt: string,
): SelfDeclaration {
  return { ...declaration, persistChoice: { kind: 'persisted', persistedAt } }
}

// ── AC13 — Stage 2 suggestion 충돌 처리 ─────────────────────────────────────

/**
 * Stage 2 suggestion store 와 비교해 Stage 3 가 runtime SelfDeclaration 을
 * 제안할지 결정.
 *
 * 분기 (spec §3.2.8 line 537-557 + §3.3.4 line 746-755):
 * - matching 없음 (신규) → true
 * - state.kind === 'accepted' → false (이미 schema.yaml 에 있음)
 * - state.kind === 'rejected' → false (negativeCache)
 * - state.kind === 'pending' → true (Stage 3 evidence 추가 가능)
 * - state.kind === 'edited' → true (사용자가 수정 중)
 */
export function shouldStage3ProposeRuntime(
  store: SuggestionStore,
  umbrella_slug: string,
): boolean {
  const matching = store.suggestions.find((s) => s.umbrella_slug === umbrella_slug)
  if (matching === undefined) return true
  if (matching.state.kind === 'accepted') return false
  if (matching.state.kind === 'rejected') return false
  return true
}
