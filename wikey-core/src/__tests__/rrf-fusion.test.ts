/**
 * §5.7.7 Step B2 RED — Spec 3 (RRF fusion) — 6 AC.
 *
 * Module under test: `wikey-core/src/search/rrf-fusion.ts` (NEW, Step C2).
 *
 * Function signature (spec):
 *   rrfFuse(
 *     bm25Results: SearchResult[],
 *     vectorResults: SearchResult[],
 *     opts: { k: number, topN: number }
 *   ): SearchResult[]
 *
 * Formula (Invariant I11):
 *   score(doc) = sum_{r in [bm25, vector]} (doc in r ? 1/(k + rank_in_r(doc)) : 0)
 *   rank starts at 1 (논문 권고 — 1-indexed).
 *
 * AC mapping (Spec 1.3):
 *   AC-RRF1 Happy 양쪽 ranking      — A = B > C = D, 합산 score 정확
 *   AC-RRF2 Happy vector only        — bm25 빈, vector [A,B] → score = 1/(60+rank)
 *   AC-RRF3 Happy bm25 only          — vector 빈, bm25 [A] → score = 1/61
 *   AC-RRF4 Edge empty               — 양쪽 빈 → []
 *   AC-RRF5 Edge k=30                — score scaling 다름 (k=60 vs k=30)
 *   AC-RRF6 Edge tie                 — same score → BM25 rank 우선 (I14)
 */

import { describe, it, expect } from 'vitest'
import type { SearchResult } from '../types.js'
import { rrfFuse } from '../search/rrf-fusion.js'

function r(path: string, score = 1, snippet = ''): SearchResult {
  return { path, score, snippet }
}

describe('§5.7.7 Spec 3 — RRF fusion (6 AC)', () => {
  it('AC-RRF1 (Happy 양쪽 ranking): bm25=[A,B,C], vector=[B,A,D] → A=1/61+1/62, B=1/62+1/61, C=1/63, D=1/63 → A=B>C=D', () => {
    expect(rrfFuse, 'rrfFuse export from search/rrf-fusion.ts').toBeDefined()
    const bm25 = [r('A'), r('B'), r('C')]
    const vec = [r('B'), r('A'), r('D')]
    const out = rrfFuse(bm25, vec, { k: 60, topN: 10 })
    expect(out).toHaveLength(4)
    // by-path lookup
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byPath = new Map<string, any>(out.map((x: any) => [x.path, x]))
    const expectedA = 1 / 61 + 1 / 62
    const expectedB = 1 / 62 + 1 / 61
    const expectedC = 1 / 63
    const expectedD = 1 / 63
    expect(byPath.get('A')!.score).toBeCloseTo(expectedA, 6)
    expect(byPath.get('B')!.score).toBeCloseTo(expectedB, 6)
    expect(byPath.get('C')!.score).toBeCloseTo(expectedC, 6)
    expect(byPath.get('D')!.score).toBeCloseTo(expectedD, 6)
    // ordering: A=B 먼저 (둘은 동일 score, tie-break BM25 우선 → A 먼저), C/D 다음
    expect(out[0].path).toBe('A')
    expect(out[1].path).toBe('B')
  })

  it('AC-RRF2 (Happy vector only): bm25=[], vector=[A,B] → A=1/61, B=1/62', () => {
    expect(rrfFuse).toBeDefined()
    const out = rrfFuse([], [r('A'), r('B')], { k: 60, topN: 10 })
    expect(out).toHaveLength(2)
    expect(out[0].path).toBe('A')
    expect(out[0].score).toBeCloseTo(1 / 61, 6)
    expect(out[1].path).toBe('B')
    expect(out[1].score).toBeCloseTo(1 / 62, 6)
  })

  it('AC-RRF3 (Happy bm25 only): vector=[], bm25=[A] → A=1/61', () => {
    expect(rrfFuse).toBeDefined()
    const out = rrfFuse([r('A')], [], { k: 60, topN: 10 })
    expect(out).toHaveLength(1)
    expect(out[0].path).toBe('A')
    expect(out[0].score).toBeCloseTo(1 / 61, 6)
  })

  it('AC-RRF4 (Edge empty): 양쪽 모두 빈 list → 빈 list', () => {
    expect(rrfFuse).toBeDefined()
    const out = rrfFuse([], [], { k: 60, topN: 10 })
    expect(out).toEqual([])
  })

  it('AC-RRF5 (Edge k=30): 동일 ranking k=60 vs k=30 → score scaling 다름', () => {
    expect(rrfFuse).toBeDefined()
    const bm25 = [r('A'), r('B')]
    const vec = [r('A'), r('B')]
    const out60 = rrfFuse(bm25, vec, { k: 60, topN: 10 })
    const out30 = rrfFuse(bm25, vec, { k: 30, topN: 10 })
    // 같은 path 의 score 가 k=30 시 더 큼 (1/(30+1) > 1/(60+1))
    const a60 = out60.find((x: SearchResult) => x.path === 'A')!.score
    const a30 = out30.find((x: SearchResult) => x.path === 'A')!.score
    expect(a30).toBeGreaterThan(a60)
    expect(a60).toBeCloseTo(1 / 61 + 1 / 61, 6)
    expect(a30).toBeCloseTo(1 / 31 + 1 / 31, 6)
  })

  it('AC-RRF6 (Edge tie I14): same score → BM25 rank 우선 (정확 매칭 우선 정책)', () => {
    expect(rrfFuse).toBeDefined()
    // bm25 = [A,B], vector = [B,A] → A score = 1/61+1/62 = B score = 1/62+1/61. tie.
    // I14 = same-score tie 시 BM25 우선. A 가 BM25 rank 1 → A 먼저.
    const out = rrfFuse([r('A'), r('B')], [r('B'), r('A')], { k: 60, topN: 10 })
    expect(out[0].path).toBe('A')
    expect(out[1].path).toBe('B')
    // tie-break 가 stable — 두 score 는 정확히 동일
    expect(out[0].score).toBeCloseTo(out[1].score, 9)
  })
})
