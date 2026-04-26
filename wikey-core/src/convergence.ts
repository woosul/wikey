/**
 * §5.4 Stage 4 — cross-source convergence.
 *
 * 여러 source 가 같은 표준의 다른 컴포넌트를 mention 할 때 wiki 전체 mention
 * graph 를 batch 분석하여 canonical decomposition 을 도출한다. Stage 1+2+3
 * 결정 위에 cross-source 통합 layer.
 *
 * - AC15  ConvergedDecomposition / SourceMention / MentionCluster (types.ts)
 * - AC16  clusterMentionsAcrossSources: cosine similarity ≥ 0.75 agglomerative
 * - AC17  arbitrate: union (default, 비용 0) 또는 LLM (mock 가능 caller 주입)
 * - AC18  createConvergencePass: run-convergence-pass.mjs CLI entry-point
 * - AC19  mergeAllSources: priority chain — base (yaml/suggested/persisted/converged) > runtime
 * - AC20  runConvergencePass: precondition check (≥ 3 standards × 2 sources)
 *
 * spec: plan/phase-5-todox-5.4-integration.md §3.4 (line 778-981)
 */

import type {
  ConvergedDecomposition,
  IngestRecord,
  MentionCluster,
  SchemaOverride,
  SelfDeclaration,
  SourceMention,
  StandardDecompositionComponent,
} from './types.js'
import { mergeRuntimeIntoOverride } from './self-declaration.js'

// ── 상수 ────────────────────────────────────────────────────────────────────

/** §3.4.2 line 813 — agglomerative clustering 임계 */
const COSINE_THRESHOLD = 0.75

/** §3.4.4 line 940 — 의미있는 convergence 가능 최소 mention diversity */
const MIN_DISTINCT_STANDARDS = 3
const MIN_DISTINCT_SOURCES = 2

/** §3.4.3 line 915 — token budget 기본값 (Stage 1 v7 §4.3 와 일관) */
const DEFAULT_TOKEN_BUDGET = 50000

// ── helpers ─────────────────────────────────────────────────────────────────

function cosine(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let na = 0
  let nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  if (na === 0 || nb === 0) return 0
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

/**
 * mention slug → set of source paths that mentioned it.
 * Used by clusterMentionsAcrossSources for source_count tally.
 */
function buildSlugToSources(history: readonly IngestRecord[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const rec of history) {
    const slugs = new Set<string>()
    for (const c of rec.concepts) slugs.add(c.slug)
    for (const e of rec.entities) slugs.add(e.slug)
    for (const slug of slugs) {
      const existing = map.get(slug) ?? new Set<string>()
      existing.add(rec.source)
      map.set(slug, existing)
    }
  }
  return map
}

// ── AC16 — clusterMentionsAcrossSources ────────────────────────────────────

/**
 * Page-level (alpha) agglomerative clustering by cosine similarity ≥ 0.75.
 *
 * Embeddings are injected (no qmd dependency) so unit tests can mock them.
 * Real callers fetch them from the qmd vector index inside
 * run-convergence-pass.mjs.
 *
 * v1 plan 한계 (plan §3.4.2 line 833): page-level only — mention-level
 * granularity 는 v2 deferral. arbitration_confidence 임계 + 사용자 review modal
 * 이 false convergence guard.
 *
 * spec: plan §3.4.2 (line 808-833)
 */
export function clusterMentionsAcrossSources(
  history: readonly IngestRecord[],
  embeddings: ReadonlyMap<string, readonly number[]>,
): readonly MentionCluster[] {
  const slugToSources = buildSlugToSources(history)
  const slugs = Array.from(slugToSources.keys())
  if (slugs.length === 0) return []

  // Simple agglomerative: each slug starts in its own cluster, merge any pair
  // with cosine ≥ COSINE_THRESHOLD (using their embeddings) until no further
  // merges occur. v1 alpha — chain-merge by first match (not optimal linkage,
  // but predictable for cycle-#1 alpha scope).
  const clusters: string[][] = slugs.map((s) => [s])

  let merged = true
  while (merged) {
    merged = false
    outer: for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        // Compare any-to-any across the two clusters; merge if any pair >= threshold.
        let shouldMerge = false
        for (const a of clusters[i]) {
          const va = embeddings.get(a)
          if (!va) continue
          for (const b of clusters[j]) {
            const vb = embeddings.get(b)
            if (!vb) continue
            if (cosine(va, vb) >= COSINE_THRESHOLD) {
              shouldMerge = true
              break
            }
          }
          if (shouldMerge) break
        }
        if (shouldMerge) {
          clusters[i] = [...clusters[i], ...clusters[j]]
          clusters.splice(j, 1)
          merged = true
          break outer
        }
      }
    }
  }

  return clusters.map((memberSlugs, idx) => {
    const sources = new Set<string>()
    let mentionCount = 0
    for (const slug of memberSlugs) {
      const srcs = slugToSources.get(slug)
      if (!srcs) continue
      for (const s of srcs) sources.add(s)
      mentionCount += srcs.size
    }
    return Object.freeze({
      cluster_id: `c${idx + 1}`,
      mention_slugs: Object.freeze([...memberSlugs]) as readonly string[],
      source_count: sources.size,
      mention_count: mentionCount,
    })
  })
}

// ── AC17 — arbitrate ────────────────────────────────────────────────────────

interface LlmJsonResponse {
  readonly is_standard?: boolean
  readonly umbrella_name?: string
  readonly umbrella_slug?: string
  readonly components?: readonly StandardDecompositionComponent[]
  readonly arbitration_confidence?: number
  readonly arbitration_reasoning?: string
}

function buildArbitrationPrompt(cluster: MentionCluster): string {
  // spec: plan §3.4.2 line 839-870 — prompt shape (LLM JSON contract aligned
  // with ConvergedDecomposition TS type, codex Cycle #2 정정).
  const lines = cluster.mention_slugs.map((s) => `- ${s}`).join('\n')
  return [
    '다음은 mention graph 의 한 cluster 입니다. 같은 표준의 다른 측면일 가능성이 높습니다.',
    '',
    'cluster mentions:',
    lines,
    '',
    '질문: 이 cluster 가 같은 표준 (umbrella) 의 components 인지 판정하고, 그렇다면 JSON 으로 답변:',
    '{',
    '  "is_standard": true | false,',
    '  "umbrella_name": "...",',
    '  "umbrella_slug": "...",',
    '  "components": [{"slug":"...", "type":"..."}],',
    '  "arbitration_confidence": 0.0~1.0,',
    '  "arbitration_reasoning": "..."',
    '}',
  ].join('\n')
}

/**
 * cluster → ConvergedDecomposition.
 *
 * - method = 'union' (default): LLM 호출 0 비용. converged_components =
 *   cluster.mention_slugs map → StandardDecompositionComponent (default type
 *   'methodology'). arbitration_confidence = 1.0, arbitration_log = undefined.
 * - method = 'llm': llmCaller 호출 (필수). LLM JSON parse → 응답에서
 *   umbrella_name / umbrella_slug / components / arbitration_confidence /
 *   arbitration_reasoning 모두 추출.
 *
 * spec: plan §3.4.2 (line 835-895)
 */
export async function arbitrate(
  cluster: MentionCluster,
  method: 'union' | 'llm',
  _tokenBudget: number,
  llmCaller?: (prompt: string) => Promise<string>,
): Promise<ConvergedDecomposition> {
  const convergedAt = new Date().toISOString()

  if (method === 'union') {
    const converged_components: StandardDecompositionComponent[] = cluster.mention_slugs.map(
      (slug) => ({ slug, type: 'methodology' }),
    )
    const umbrella_slug = cluster.mention_slugs[0] ?? cluster.cluster_id
    const umbrella_name = umbrella_slug
    return {
      umbrella_slug,
      umbrella_name,
      converged_components,
      source_mentions: [],
      arbitration_method: 'union',
      arbitration_confidence: 1.0,
      convergedAt,
    }
  }

  // method === 'llm'
  if (!llmCaller) {
    throw new Error("arbitrate: method='llm' requires llmCaller injection")
  }
  const prompt = buildArbitrationPrompt(cluster)
  const raw = await llmCaller(prompt)
  let parsed: LlmJsonResponse
  try {
    parsed = JSON.parse(raw) as LlmJsonResponse
  } catch (err) {
    throw new Error(
      `arbitrate: failed to parse LLM JSON response — ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  return {
    umbrella_slug: parsed.umbrella_slug ?? cluster.mention_slugs[0] ?? cluster.cluster_id,
    umbrella_name: parsed.umbrella_name ?? parsed.umbrella_slug ?? cluster.cluster_id,
    converged_components: parsed.components ?? [],
    source_mentions: [],
    arbitration_method: 'llm',
    arbitration_confidence: typeof parsed.arbitration_confidence === 'number'
      ? parsed.arbitration_confidence
      : 0,
    arbitration_log: parsed.arbitration_reasoning,
    convergedAt,
  }
}

// ── AC18 — createConvergencePass (CLI entry-point factory) ─────────────────

export interface ConvergencePassConfig {
  readonly history: string
  readonly qmdDb: string
  readonly output: string
  readonly arbitration: 'union' | 'llm'
  readonly tokenBudget: number
}

/**
 * Parse run-convergence-pass.mjs CLI args → ConvergencePassConfig.
 *
 * Defaults match the reindex.sh hook block (plan §3.4.3 line 906-916):
 *   --arbitration "${WIKEY_ARBITRATION_METHOD:-union}"
 *   --token-budget "${WIKEY_CONVERGENCE_TOKEN_BUDGET:-50000}"
 *
 * The mjs wrapper reads sys.argv and forwards to this factory; unit tests
 * exercise this function directly (no shell coupling).
 */
export function createConvergencePass(args: readonly string[]): ConvergencePassConfig {
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag)
    if (idx < 0 || idx + 1 >= args.length) return undefined
    return args[idx + 1]
  }
  const history = get('--history')
  const qmdDb = get('--qmd-db')
  const output = get('--output')
  if (!history) throw new Error('createConvergencePass: --history required')
  if (!qmdDb) throw new Error('createConvergencePass: --qmd-db required')
  if (!output) throw new Error('createConvergencePass: --output required')

  const arbRaw = get('--arbitration') ?? 'union'
  if (arbRaw !== 'union' && arbRaw !== 'llm') {
    throw new Error(`createConvergencePass: --arbitration must be 'union'|'llm' (got ${arbRaw})`)
  }
  const budgetRaw = get('--token-budget')
  const tokenBudget = budgetRaw ? Number(budgetRaw) : DEFAULT_TOKEN_BUDGET
  if (!Number.isFinite(tokenBudget) || tokenBudget <= 0) {
    throw new Error(`createConvergencePass: --token-budget must be positive (got ${budgetRaw})`)
  }

  return { history, qmdDb, output, arbitration: arbRaw, tokenBudget }
}

// ── AC19 — mergeAllSources ─────────────────────────────────────────────────

/**
 * Priority chain merge (plan §3.4.5 line 949-959):
 *   1. user-yaml > 2. accepted suggestion > 3. persisted self-declaration >
 *   4. user-accepted converged > 5. (v2 deferral) > 6. runtime-only > 7. BUILTIN
 *
 * Priorities 1~4 already live in `baseOverride` (Stage 2/3/4 writers
 * append to schema.yaml). Priority 6 (runtime-only) is injected here via the
 * Stage 3 helper. BUILTIN (priority 7) is added by buildStandardDecompositionBlock.
 *
 * Conflict (plan §3.4.5 line 961-964): 같은 umbrella_slug → 높은 priority 만
 * (base wins). 같은 component slug 다른 umbrella → first-wins (Stage 1 v7
 * §3.2.3 규칙) — append 순서가 우선순위 따름.
 *
 * spec: plan §3.4.5 (line 947-981)
 */
export function mergeAllSources(
  baseOverride: SchemaOverride | undefined,
  runtimeSelfDeclarations: readonly SelfDeclaration[],
): SchemaOverride | undefined {
  // base wins for duplicate umbrella_slug — drop runtime entries that collide.
  let filteredRuntime: readonly SelfDeclaration[] = runtimeSelfDeclarations
  const baseState = baseOverride?.standardDecompositions
  if (baseState?.kind === 'present') {
    const baseSlugs = new Set(baseState.items.map((i) => i.umbrella_slug))
    filteredRuntime = runtimeSelfDeclarations.filter(
      (sd) => !baseSlugs.has(sd.umbrella_slug),
    )
  }
  return mergeRuntimeIntoOverride(baseOverride, filteredRuntime)
}

// ── AC20 — runConvergencePass (precondition + pipeline) ────────────────────

export interface RunConvergencePassOptions {
  readonly arbitration: 'union' | 'llm'
  readonly tokenBudget: number
  readonly embeddings: ReadonlyMap<string, readonly number[]>
  readonly llmCaller?: (prompt: string) => Promise<string>
  /** §3.4.3 line 928 — minimum source_count per cluster to trigger arbitration. */
  readonly minSourceCount?: number
  /** §3.4.3 line 930 — minimum arbitration_confidence to keep a result. */
  readonly minConfidence?: number
}

/**
 * Top-level pipeline used by run-convergence-pass.mjs.
 *
 * Precondition (plan §3.4.4 line 940-942): mention-history needs ≥ 3 distinct
 * standards × 2 distinct sources. Below threshold → return [] + console.warn.
 * exit 0 (no error) — the script is opt-in (default off via env in reindex.sh).
 *
 * spec: plan §3.4.3 (line 919-935) + §3.4.4 (line 937-945)
 */
export async function runConvergencePass(
  history: readonly IngestRecord[],
  options: RunConvergencePassOptions,
): Promise<readonly ConvergedDecomposition[]> {
  // Precondition: count distinct mention slugs (proxy for "standards") and
  // distinct sources.
  const distinctSources = new Set(history.map((r) => r.source))
  const distinctSlugs = new Set<string>()
  for (const r of history) {
    for (const c of r.concepts) distinctSlugs.add(c.slug)
    for (const e of r.entities) distinctSlugs.add(e.slug)
  }
  if (
    distinctSlugs.size < MIN_DISTINCT_STANDARDS ||
    distinctSources.size < MIN_DISTINCT_SOURCES
  ) {
    console.warn(
      `insufficient mention diversity for convergence: ${distinctSlugs.size} standards × ${distinctSources.size} sources, threshold ${MIN_DISTINCT_STANDARDS} × ${MIN_DISTINCT_SOURCES}`,
    )
    return []
  }

  const minSourceCount = options.minSourceCount ?? MIN_DISTINCT_SOURCES
  const minConfidence = options.minConfidence ?? 0.7

  const clusters = clusterMentionsAcrossSources(history, options.embeddings)
  const sourcesBySlug = buildSlugToSources(history)
  const converged: ConvergedDecomposition[] = []
  for (const cluster of clusters) {
    if (cluster.source_count < minSourceCount) continue
    const result = await arbitrate(
      cluster,
      options.arbitration,
      options.tokenBudget,
      options.llmCaller,
    )
    if (result.arbitration_confidence < minConfidence) continue

    // Attach source_mentions derived from history (alpha — page-level).
    const source_mentions: SourceMention[] = []
    const seenSources = new Set<string>()
    for (const slug of cluster.mention_slugs) {
      const srcs = sourcesBySlug.get(slug)
      if (!srcs) continue
      for (const s of srcs) {
        if (seenSources.has(s)) continue
        seenSources.add(s)
        source_mentions.push({
          source: s,
          mentioned_components: cluster.mention_slugs.filter((m) =>
            (sourcesBySlug.get(m) ?? new Set<string>()).has(s),
          ),
          is_umbrella_only: false,
        })
      }
    }
    converged.push({ ...result, source_mentions })
  }
  return converged
}
