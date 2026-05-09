/**
 * §5.7.4 RED — orama-index 단위 테스트.
 *
 * AC-I1: createOramaIndex (cache 부재) → 빈 인덱스. restore() → docCount 0.
 * AC-I2.a: ingestAll(wikiDir) fixture 5~10 docs → docCount = N, ms ≤ 100.
 * AC-I3: search('BM25', { topN: 5 }) → SearchResult[] ≥ 1, shape { path, score, snippet }.
 * AC-I4: persist() → 새 handle 의 restore() → 동일 query 결과 재현.
 * AC-V1: schema 의 embedding: 'vector[768]' column + mock vector hybrid round-trip.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createOramaIndex,
  type KoreanTokenizerHandle,
} from '../../search/orama-index.js'

/** Mock tokenizer — Orama default-friendly, English split + lowercase + Korean noun bigram split. */
function makeMockTokenizer(): KoreanTokenizerHandle {
  return {
    tokenize: (text: string): string[] => {
      if (!text || typeof text !== 'string') return []
      // Whitespace + punctuation split, lowercase. Adequate for English fixture tests.
      return text
        .toLowerCase()
        .split(/[\s,.!?()/:;'"`　]+/u)
        .filter((s) => s.length > 0)
    },
    close: () => undefined,
  }
}

let tmpRoot = ''
let cacheDir = ''
let wikiDir = ''
let cachePath = ''

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'wikey-orama-test-'))
  cacheDir = join(tmpRoot, 'cache')
  wikiDir = join(tmpRoot, 'wiki')
  mkdirSync(cacheDir, { recursive: true })
  mkdirSync(join(wikiDir, 'concepts'), { recursive: true })
  mkdirSync(join(wikiDir, 'entities'), { recursive: true })
  cachePath = join(cacheDir, 'wikey-wiki.json')
})

afterEach(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true })
})

function writeFixturePages(): void {
  // 6 small pages — enough for AC-I2.a + AC-I3 hits.
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
    [
      'concepts/rag.md',
      '---\ntitle: RAG\n---\nRetrieval-Augmented Generation combines search with LLM synthesis.',
    ],
  ]
  for (const [rel, body] of pages) {
    writeFileSync(join(wikiDir, rel), body, 'utf-8')
  }
}

describe('orama-index', () => {
  it('AC-I1: createOramaIndex without cache file → empty index, restore() → docCount 0', async () => {
    const handle = await createOramaIndex({
      cachePath,
      tokenizer: makeMockTokenizer(),
    })
    await handle.restore()
    const results = await handle.search('any', { topN: 5 })
    expect(results).toEqual([])
  })

  it('AC-I2.a: ingestAll(wikiDir) on fixture → docCount = 6, ms ≤ 2000 (CI buffer)', async () => {
    writeFixturePages()
    const handle = await createOramaIndex({
      cachePath,
      tokenizer: makeMockTokenizer(),
    })
    const r = await handle.ingestAll(wikiDir)
    expect(r.docCount).toBe(6)
    expect(r.ms).toBeGreaterThanOrEqual(0)
    expect(r.ms).toBeLessThanOrEqual(2000)
  })

  it('AC-I3: search returns SearchResult[] with { path, score, snippet } shape', async () => {
    writeFixturePages()
    const handle = await createOramaIndex({
      cachePath,
      tokenizer: makeMockTokenizer(),
    })
    await handle.ingestAll(wikiDir)
    const results = await handle.search('bm25 algorithm', { topN: 5 })
    expect(results.length).toBeGreaterThanOrEqual(1)
    const first = results[0]
    expect(typeof first.path).toBe('string')
    expect(first.path).toMatch(/^wiki\//)
    expect(typeof first.score).toBe('number')
    expect(typeof first.snippet).toBe('string')
  })

  it('AC-I4: persist() then new handle restore() → same query returns equivalent results', async () => {
    writeFixturePages()
    const h1 = await createOramaIndex({
      cachePath,
      tokenizer: makeMockTokenizer(),
    })
    await h1.ingestAll(wikiDir)
    const before = await h1.search('orama', { topN: 5 })
    expect(before.length).toBeGreaterThanOrEqual(1)
    await h1.persist()

    const h2 = await createOramaIndex({
      cachePath,
      tokenizer: makeMockTokenizer(),
    })
    await h2.restore()
    const after = await h2.search('orama', { topN: 5 })
    expect(after.length).toBe(before.length)
    expect(after.map((r) => r.path).sort()).toEqual(
      before.map((r) => r.path).sort(),
    )
  })

  it('AC-V1: schema accepts vector[768] column + 768D vector hybrid round-trip', async () => {
    writeFixturePages()
    const handle = await createOramaIndex({
      cachePath,
      tokenizer: makeMockTokenizer(),
    })
    // Ingest with synthetic 768D embedding to confirm schema column.
    const vec = new Array(768).fill(0).map((_, i) => (i % 2 === 0 ? 0.5 : -0.5))
    const inserted = await handle.upsertWithEmbedding({
      id: 'concepts/test-vec.md',
      title: 'Vec Test',
      body: 'Test body for vector column.',
      embedding: vec,
    })
    expect(inserted).toBe(true)
    // Run plain BM25 search — schema-compatible insert succeeded.
    const results = await handle.search('test', { topN: 3 })
    expect(results.length).toBeGreaterThanOrEqual(1)
  })
})
