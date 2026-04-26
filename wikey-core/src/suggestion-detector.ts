import type {
  CandidatePattern,
  IngestRecord,
  StandardDecompositionComponent,
  SuggestionEvidence,
} from './types.js'
import { BUILTIN_STANDARD_DECOMPOSITIONS } from './schema.js'

/**
 * §5.4.2 AC3 — co-occurrence detector.
 * §5.4.2 AC4 — suffix-cluster detector.
 * §5.4.2 AC5 — confidence formula.
 *
 * All thresholds (`minSiblings=3`, `minSources=2`, `minPrefixLen=5`,
 * confidence cutoff 0.6 in callers) are alpha defaults. Plan §3.2.2 line 359
 * mandates baseline calibration after §5.4.5 live cycle smoke before any
 * hardening — do not tune thresholds in this module.
 */

const DEFAULT_MIN_SIBLINGS = 3
const DEFAULT_MIN_PREFIX_LEN = 5
const DEFAULT_MIN_SOURCES = 2
const DEFAULT_SUFFIX_WHITELIST: readonly string[] = [
  '-management', '-control', '-principle', '-domain', '-practice', '-area',
]

/** Set of every BUILTIN component slug (and aliases) — used for `overlapsWithBuiltin`. */
const BUILTIN_COMPONENT_SLUGS: ReadonlySet<string> = (() => {
  const s = new Set<string>()
  for (const d of BUILTIN_STANDARD_DECOMPOSITIONS) {
    s.add(d.umbrella_slug)
    for (const c of d.components) {
      s.add(c.slug)
      for (const a of c.aliases ?? []) s.add(a)
    }
  }
  return s
})()

function overlapsBuiltin(slugs: readonly string[]): boolean {
  return slugs.some((s) => BUILTIN_COMPONENT_SLUGS.has(s))
}

/**
 * Greatest common prefix that ends on a separator boundary (`-` or `_`).
 * Returns '' when nothing meaningful is shared.
 */
function commonPrefixOnBoundary(slugs: readonly string[]): string {
  if (slugs.length < 2) return ''
  let prefix = slugs[0]
  for (let i = 1; i < slugs.length; i++) {
    let j = 0
    const cur = slugs[i]
    while (j < prefix.length && j < cur.length && prefix[j] === cur[j]) j++
    prefix = prefix.slice(0, j)
    if (!prefix) return ''
  }
  // Trim back to the last separator so we don't cut a word in half.
  const lastSep = Math.max(prefix.lastIndexOf('-'), prefix.lastIndexOf('_'))
  if (lastSep <= 0) return ''
  return prefix.slice(0, lastSep + 1)
}

/**
 * AC3 — within a single ingest, group concept slugs by their longest common
 * boundary prefix. Any group with ≥ `minSiblings` distinct slugs and a
 * prefix ≥ `minPrefixLen` chars yields one CandidatePattern.
 */
export function detectCoOccurrence(
  ingest: IngestRecord,
  minSiblings: number = DEFAULT_MIN_SIBLINGS,
  minPrefixLen: number = DEFAULT_MIN_PREFIX_LEN,
): readonly CandidatePattern[] {
  const slugs = Array.from(new Set(ingest.concepts.map((c) => c.slug)))
  if (slugs.length < minSiblings) return []

  // Group by first-segment-of-prefix candidate (everything up to the first '-').
  // For every cluster of ≥ minSiblings slugs sharing a long common prefix, emit one pattern.
  const buckets = new Map<string, string[]>()
  for (const slug of slugs) {
    const dash = slug.indexOf('-')
    const head = dash > 0 ? slug.slice(0, dash) : slug
    if (!buckets.has(head)) buckets.set(head, [])
    buckets.get(head)!.push(slug)
  }

  const out: CandidatePattern[] = []
  for (const group of buckets.values()) {
    if (group.length < minSiblings) continue
    const prefix = commonPrefixOnBoundary(group)
    if (prefix.length < minPrefixLen) continue

    const components: StandardDecompositionComponent[] = group.map((slug) => {
      const found = ingest.concepts.find((c) => c.slug === slug)
      return { slug, type: found?.type ?? 'methodology' }
    })
    const evidence: SuggestionEvidence[] = [{
      source: ingest.source,
      mentions: [...group].sort(),
      observedAt: ingest.ingestedAt,
    }]
    out.push({
      umbrella_slug: prefix,
      components,
      support_count: 1,
      unique_suffixes: countUniqueSuffixes(group, prefix),
      mention_count: group.length,
      overlapsWithBuiltin: overlapsBuiltin(group),
      evidence,
    })
  }
  return out
}

function countUniqueSuffixes(slugs: readonly string[], prefix: string): number {
  const suffixes = new Set<string>()
  for (const slug of slugs) {
    const tail = slug.startsWith(prefix) ? slug.slice(prefix.length) : slug
    // Use the leading sub-segment of the tail as the "suffix shape".
    const dash = tail.indexOf('-')
    const shape = dash >= 0 ? tail.slice(0, dash) : tail
    suffixes.add(shape)
  }
  return suffixes.size
}

/**
 * AC4 — across multiple sources, group concept slugs by trailing whitelisted
 * suffix. Emit one CandidatePattern per suffix that appears in ≥ `minSources`
 * distinct sources.
 */
export function detectSuffixCluster(
  history: readonly IngestRecord[],
  minSources: number = DEFAULT_MIN_SOURCES,
  suffixWhitelist: readonly string[] = DEFAULT_SUFFIX_WHITELIST,
): readonly CandidatePattern[] {
  const out: CandidatePattern[] = []

  for (const suffix of suffixWhitelist) {
    const sourcesWithSuffix = new Map<string, string[]>()  // source → slugs
    let totalMentions = 0
    for (const record of history) {
      const matches = record.concepts.filter((c) => c.slug.endsWith(suffix))
      if (matches.length === 0) continue
      sourcesWithSuffix.set(record.source, matches.map((m) => m.slug))
      totalMentions += matches.length
    }
    if (sourcesWithSuffix.size < minSources) continue

    const allSlugs: string[] = []
    const evidence: SuggestionEvidence[] = []
    for (const [source, slugs] of sourcesWithSuffix.entries()) {
      allSlugs.push(...slugs)
      const recordRef = history.find((r) => r.source === source)
      evidence.push({
        source,
        mentions: [...slugs].sort(),
        observedAt: recordRef?.ingestedAt ?? '',
      })
    }
    const uniqueSlugs = Array.from(new Set(allSlugs))
    const components: StandardDecompositionComponent[] = uniqueSlugs.map((slug) => {
      const t = history
        .flatMap((r) => r.concepts)
        .find((c) => c.slug === slug)?.type ?? 'methodology'
      return { slug, type: t }
    })

    // suffix cluster 의 umbrella_slug — 사용자 영구 결정 (2026-04-26 §5.4 follow-up):
    // components 의 first word (- 전) 가 모두 같으면 그 prefix 사용 (예: PMBOK 만 ingest →
    // 'project' + '-management' = 'project-management', 의미있는 default).
    // mixed 인 경우 fallback 'cluster' (사용자가 Edit modal 로 변경 권장).
    // parser regex /^[a-z][a-z0-9-]*$/ 일치 보장 (post-impl Cycle #1 F1 round-trip).
    const suffixBase = suffix.replace(/^-/, '')
    const firstWords = uniqueSlugs.map((s) => s.split('-')[0])
    const allFirstSame = firstWords.length > 0 && firstWords.every((w) => w === firstWords[0])
    const prefix = allFirstSame ? firstWords[0] : 'cluster'
    out.push({
      umbrella_slug: `${prefix}-${suffixBase}`,
      components,
      support_count: sourcesWithSuffix.size,
      unique_suffixes: 1,                 // single suffix by construction
      mention_count: totalMentions,
      overlapsWithBuiltin: overlapsBuiltin(uniqueSlugs),
      evidence,
    })
  }
  return out
}

/**
 * AC5 — confidence ∈ [0,1] combining four weighted signals.
 *
 * formula (plan §3.2.2 line 350-356):
 *   0.4 * min(support_count/5, 1)
 * + 0.3 * (unique_suffixes ≤ 1 ? 1 : 0.5)
 * + 0.2 * min(mention_count/20, 1)
 * + 0.1 * (overlapsWithBuiltin ? 0 : 1)
 *
 * NOTE: 0.6 cutoff + min* thresholds are alpha defaults; calibration deferred
 * to §5.4.5 baseline (plan §3.2.2 line 359).
 */
export function computeConfidence(p: CandidatePattern): number {
  const support = Math.min(p.support_count / 5, 1.0)
  const suffix_homogeneity = p.unique_suffixes <= 1 ? 1.0 : 0.5
  const mention_density = Math.min(p.mention_count / 20, 1.0)
  const builtinOverlap = p.overlapsWithBuiltin ? 0.0 : 1.0
  return 0.4 * support + 0.3 * suffix_homogeneity + 0.2 * mention_density + 0.1 * builtinOverlap
}
