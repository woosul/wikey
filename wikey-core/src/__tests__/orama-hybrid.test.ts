/**
 * §5.7.7 Step B3 RED — Spec 2 (Orama vector integration) — 6 AC + Spec 5 incremental.
 *
 * Mode under test: `createOramaIndex({ ..., embedder })` factory option (Step C3/C4 추가).
 *
 * Spec 2 의 hybrid mode 활성 시:
 *   - search(q, { mode: 'hybrid' }) → BM25 + vector → RRF fused
 *   - SearchResult 가 옵셔널 metadata 직접 field — bm25Rank? / vectorRank? / rrfScore?
 *   - mode = 'fulltext' (default) → vector layer 미호출 (embedder 호출 횟수 = 0)
 *   - embedding fail → BM25-only fallback + console warn
 *   - dim ≠ 1024 → 본 page hybrid skip + BM25 record 정상 insert (페이지별 fail-open)
 *
 * Mock embedder signature (Step C 가 정의할 형태):
 *   type EmbedderFn = (text: string) => Promise<Float32Array>
 *
 * AC mapping (Spec 1.2):
 *   AC-O1 Happy cold reindex          — 모든 doc 의 embedding 비-null
 *   AC-O2 Happy incremental ingest    — 신규 page 1 → embedding 생성, 기존 영향 0
 *   AC-O3 Happy hybrid search         — BM25 + vector → RRF, metadata 비-null
 *   AC-O4 Edge mode = fulltext        — embedder 호출 횟수 = 0
 *   AC-O5 Edge embedding fail         — fail-open + BM25-only + console warn
 *   AC-O6 Error vector dim mismatch   — page 본 hybrid skip, BM25 정상
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createOramaIndex,
  type KoreanTokenizerHandle,
} from '../search/orama-index.js'

function makeMockTokenizer(): KoreanTokenizerHandle {
  return {
    tokenize: (text: string): string[] => {
      if (!text || typeof text !== 'string') return []
      return text
        .toLowerCase()
        .split(/[\s,.!?()/:;'"`　]+/u)
        .filter((s) => s.length > 0)
    },
    close: () => undefined,
  }
}

/** Stable mock embedder — text → 1024D Float32Array (text length 기반 deterministic). */
function makeMockEmbedder(): {
  fn: (text: string) => Promise<Float32Array>
  callCount: () => number
  calls: string[]
} {
  const calls: string[] = []
  return {
    fn: async (text: string) => {
      calls.push(text)
      const v = new Float32Array(1024)
      const seed = text.length
      for (let i = 0; i < 1024; i++) {
        v[i] = ((seed + i) % 7) / 10 - 0.3
      }
      return v
    },
    callCount: () => calls.length,
    calls,
  }
}

let tmpRoot = ''
let cacheDir = ''
let wikiDir = ''
let cachePath = ''

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'wikey-orama-hybrid-test-'))
  cacheDir = join(tmpRoot, 'cache')
  wikiDir = join(tmpRoot, 'wiki')
  mkdirSync(cacheDir, { recursive: true })
  mkdirSync(join(wikiDir, 'concepts'), { recursive: true })
  mkdirSync(join(wikiDir, 'entities'), { recursive: true })
  cachePath = join(cacheDir, 'wikey-wiki.json')
})

afterEach(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function writeFixturePages(): void {
  const pages: Array<[string, string]> = [
    [
      'concepts/bm25.md',
      '---\ntitle: BM25\n---\nBM25 algorithm scores documents by term frequency.',
    ],
    [
      'concepts/orama.md',
      '---\ntitle: Orama\n---\nOrama is an in-process search engine for JavaScript.',
    ],
    [
      'concepts/kiwi.md',
      '---\ntitle: Kiwi\n---\nKiwi NLP is a Korean morphological analyzer.',
    ],
    [
      'entities/karpathy.md',
      '---\ntitle: Andrej Karpathy\n---\nKarpathy authored the LLM Wiki gist.',
    ],
    [
      'entities/obsidian.md',
      '---\ntitle: Obsidian\n---\nObsidian is a markdown-based knowledge graph editor.',
    ],
  ]
  for (const [rel, body] of pages) {
    writeFileSync(join(wikiDir, rel), body, 'utf-8')
  }
}

describe('§5.7.7 Spec 2 — Orama hybrid integration (6 AC)', () => {
  it('AC-O1 (Happy cold reindex): 5 docs fixture → embedder 가 모든 doc 에 호출되어 embedding 생성', async () => {
    writeFixturePages()
    const embedder = makeMockEmbedder()
    // Step C — createOramaIndex 가 embedder 옵션을 수용해야 한다.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle = await (createOramaIndex as any)({
      cachePath,
      tokenizer: makeMockTokenizer(),
      embedder: embedder.fn,
    })
    await handle.ingestAll(wikiDir)
    // 5 docs → embedder 5 회 호출 (page-level whole-document embedding, Q4 LOCKED)
    expect(embedder.callCount()).toBe(5)
  })

  it('AC-O2 (Happy incremental ingest): 신규 page 1개 → embedding 1회 추가 호출, 기존 영향 0', async () => {
    writeFixturePages()
    const embedder = makeMockEmbedder()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle = await (createOramaIndex as any)({
      cachePath,
      tokenizer: makeMockTokenizer(),
      embedder: embedder.fn,
    })
    await handle.ingestAll(wikiDir)
    const beforeCount = embedder.callCount()
    expect(beforeCount).toBe(5)
    // 신규 페이지 ingest — upsertWithEmbedding 가 embedder 호출
    writeFileSync(
      join(wikiDir, 'concepts/rag.md'),
      '---\ntitle: RAG\n---\nRetrieval-Augmented Generation combines search with LLM.',
      'utf-8',
    )
    const ok = await handle.upsertWithEmbedding({
      id: 'concepts/rag.md',
      title: 'RAG',
      body: 'Retrieval-Augmented Generation combines search with LLM.',
    })
    expect(ok).toBe(true)
    // 기존 5 + 신규 1 = 6
    expect(embedder.callCount()).toBe(6)
  })

  it('AC-O3 (Happy hybrid search): mode=hybrid → BM25 + vector → RRF, metadata bm25Rank/vectorRank/rrfScore 비-null', async () => {
    writeFixturePages()
    const embedder = makeMockEmbedder()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle = await (createOramaIndex as any)({
      cachePath,
      tokenizer: makeMockTokenizer(),
      embedder: embedder.fn,
    })
    await handle.ingestAll(wikiDir)
    const results = await handle.search('orama search', { topN: 5, mode: 'hybrid' })
    expect(results.length).toBeGreaterThanOrEqual(1)
    // 첫 결과 — RRF fused metadata 가 SearchResult 직접 field 로 주입되어야 함 (Spec 1.2 Outputs)
    const first = results[0]
    expect(first.path).toMatch(/^wiki\//)
    expect(typeof first.score).toBe('number')
    // Spec 1.2 Outputs (v1.1 Finding 5): bm25Rank? / vectorRank? / rrfScore? 옵셔널 직접 field
    // hybrid mode 시점에 셋 중 최소 하나 이상 비-null 이어야 함.
    const hasMetadata =
      typeof first.bm25Rank === 'number' ||
      typeof first.vectorRank === 'number' ||
      typeof first.rrfScore === 'number'
    expect(hasMetadata, 'hybrid result should expose bm25Rank/vectorRank/rrfScore').toBe(true)
  })

  it('AC-O4 (Edge mode=fulltext default): embedder 옵션 수용 + ingest 시점 호출 + search 시점 미호출', async () => {
    writeFixturePages()
    const embedder = makeMockEmbedder()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle = await (createOramaIndex as any)({
      cachePath,
      tokenizer: makeMockTokenizer(),
      embedder: embedder.fn,
    })
    await handle.ingestAll(wikiDir)
    // ingest 시점에 5 docs → embedder 5회 (Spec 1.2 I9 incremental embedding)
    // 본 사항이 Step C 미구현이면 0 → RED.
    expect(embedder.callCount()).toBe(5)
    const ingestCalls = embedder.callCount()
    // fulltext (default) — search 시 query embedding 미호출
    const results = await handle.search('bm25 algorithm', { topN: 5 })
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(embedder.callCount()).toBe(ingestCalls)
  })

  it('AC-O5 (Edge embedding fail at search): hybrid + embedder throw → BM25-only fallback + console warn', async () => {
    writeFixturePages()
    let firstQueryCall = true
    const embedder = {
      fn: async (text: string): Promise<Float32Array> => {
        // ingest 시점은 OK, query embedding 시점은 throw
        if (firstQueryCall && text === 'bm25 algorithm') {
          firstQueryCall = false
          throw new Error('ollama down')
        }
        const v = new Float32Array(1024)
        for (let i = 0; i < 1024; i++) v[i] = (i % 7) / 10 - 0.3
        return v
      },
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle = await (createOramaIndex as any)({
      cachePath,
      tokenizer: makeMockTokenizer(),
      embedder: embedder.fn,
    })
    await handle.ingestAll(wikiDir)
    // hybrid query — embedder throw 시 fail-open: BM25-only 결과 정상
    const results = await handle.search('bm25 algorithm', { topN: 5, mode: 'hybrid' })
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(warn).toHaveBeenCalled()
  })

  it('AC-O6 (Error vector dim mismatch): insert 시 dim ≠ 1024 → 본 page hybrid skip, BM25 record 정상 insert (페이지별 fail-open)', async () => {
    writeFixturePages()
    let dimMismatchCalled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const badEmbedder = async (_text: string) => {
      // 768D — wrong dim
      dimMismatchCalled = true
      return new Float32Array(768)
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle = await (createOramaIndex as any)({
      cachePath,
      tokenizer: makeMockTokenizer(),
      embedder: badEmbedder,
    })
    // dim mismatch → hybrid skip + BM25 record 는 정상 insert
    await handle.ingestAll(wikiDir)
    expect(dimMismatchCalled).toBe(true)
    // BM25-only path 에서 검색은 정상 동작 (page record 살아있음)
    const results = await handle.search('orama', { topN: 5 })
    expect(results.length).toBeGreaterThanOrEqual(1)
    // 페이지별 fail-open 의 console warn 발생 (Spec 1.2 I10)
    expect(warn).toHaveBeenCalled()
  })
})
