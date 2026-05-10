/**
 * §5.7.7 Step C2 — Reciprocal Rank Fusion (Spec 3, pure function).
 *
 * Formula (I11):
 *   score(doc) = sum_{r in [bm25, vector]} (doc in r ? 1/(k + rank_in_r(doc)) : 0)
 *   rank starts at 1 (논문 권고 — 1-indexed).
 *
 * Tie-break (I14): same fused score → BM25 rank 우선 (정확 매칭 우선).
 */

import type { SearchResult } from '../types.js'

export interface RrfFuseOptions {
  /** RRF k constant (논문 default = 60). settings UI customizable (Spec I12). */
  readonly k: number
  /** Top-N cut after fusion. */
  readonly topN: number
}

interface FusedEntry {
  result: SearchResult
  fusedScore: number
  bm25Rank: number | undefined
  vectorRank: number | undefined
}

/**
 * Combine two ranked SearchResult lists into a single RRF-fused list.
 *
 * The resulting `SearchResult.score` is overwritten with the fused score so callers
 * get a comparable scalar across hybrid runs. Per-layer ranks are surfaced as the
 * SearchResult-direct optional fields (§5.7.8 mirror, Spec 1.2 Outputs Finding 5):
 * `bm25Rank`, `vectorRank`, `rrfScore`.
 */
export function rrfFuse(
  bm25Results: readonly SearchResult[],
  vectorResults: readonly SearchResult[],
  opts: RrfFuseOptions,
): SearchResult[] {
  const { k, topN } = opts
  const fused = new Map<string, FusedEntry>()

  function accumulate(
    list: readonly SearchResult[],
    field: 'bm25Rank' | 'vectorRank',
  ): void {
    for (let i = 0; i < list.length; i += 1) {
      const r = list[i]
      const rank = i + 1
      const reciprocal = 1 / (k + rank)
      const existing = fused.get(r.path)
      if (existing) {
        existing.fusedScore += reciprocal
        existing[field] = rank
      } else {
        fused.set(r.path, {
          result: r,
          fusedScore: reciprocal,
          bm25Rank: field === 'bm25Rank' ? rank : undefined,
          vectorRank: field === 'vectorRank' ? rank : undefined,
        })
      }
    }
  }

  accumulate(bm25Results, 'bm25Rank')
  accumulate(vectorResults, 'vectorRank')

  // Sort: fused score desc, tie-break by BM25 rank asc (I14 — 정확 매칭 우선).
  const ordered = Array.from(fused.values()).sort((a, b) => {
    if (b.fusedScore !== a.fusedScore) return b.fusedScore - a.fusedScore
    const ar = a.bm25Rank ?? Number.POSITIVE_INFINITY
    const br = b.bm25Rank ?? Number.POSITIVE_INFINITY
    return ar - br
  })

  return ordered.slice(0, topN).map((e) => ({
    ...e.result,
    score: e.fusedScore,
    bm25Rank: e.bm25Rank,
    vectorRank: e.vectorRank,
    rrfScore: e.fusedScore,
  }))
}
