/**
 * §5.7.8 Spec 2 — orama-index search() with optional filter / rewriter / expander wrapper.
 * AC-F5: 3-layer wrapper integration + backward-compat (no opts → legacy path).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  readFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  createOramaIndex,
  type KoreanTokenizerHandle,
  type SearchResultWithMetadata,
} from '../../search/orama-index.js'
import { QueryIntentFilter } from '../../search/query-intent-filter.js'
import { QueryRewriter } from '../../search/query-rewriter.js'
import { QueryExpander } from '../../search/query-expander.js'

function makeMockTokenizer(): KoreanTokenizerHandle {
  return {
    tokenize: (text: string): string[] => {
      if (!text) return []
      return text.toLowerCase().split(/[\s,.!?()/:;'"`　]+/u).filter((s) => s.length > 0)
    },
    close: () => undefined,
  }
}

function whitespaceTokenize(query: string): string[] {
  return query.split(/\s+/u).filter((t) => t.length > 0)
}

const FILTER_PROMPT = readFileSync(
  join(__dirname, '..', '..', 'prompts', 'query-intent-filter.prompt.md'), 'utf-8',
)
const REWRITER_PROMPT = readFileSync(
  join(__dirname, '..', '..', 'prompts', 'query-rewriter.prompt.md'), 'utf-8',
)
const EXPANDER_PROMPT = readFileSync(
  join(__dirname, '..', '..', 'prompts', 'query-expander.prompt.md'), 'utf-8',
)

let tmpRoot = ''
let cachePath = ''
let wikiDir = ''

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'wikey-orama-filter-'))
  cachePath = join(tmpRoot, 'cache.json')
  wikiDir = join(tmpRoot, 'wiki', 'concepts')
  mkdirSync(wikiDir, { recursive: true })
  writeFileSync(
    join(wikiDir, 'bm25.md'),
    '---\ntitle: BM25\n---\nBM25 algorithm for ranking documents.',
    'utf-8',
  )
  writeFileSync(
    join(wikiDir, 'orama.md'),
    '---\ntitle: Orama\n---\nOrama is an in-process search engine.',
    'utf-8',
  )
})
afterEach(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true })
})

describe('orama-index search() — AC-F5 layer integration', () => {
  it('Backward compat: no filter/rewriter/expander → legacy SearchResult shape', async () => {
    const handle = await createOramaIndex({ cachePath, tokenizer: makeMockTokenizer() })
    await handle.ingestAll(join(tmpRoot, 'wiki'))
    const results = await handle.search('bm25', { topN: 3 })
    expect(results.length).toBeGreaterThan(0)
    const first = results[0] as SearchResultWithMetadata
    expect(first.filterDecision).toBeUndefined()
    expect(first.rewriteDecision).toBeUndefined()
    expect(first.expandDecision).toBeUndefined()
  })

  it('With filter only: filterDecision attached to results', async () => {
    const handle = await createOramaIndex({ cachePath, tokenizer: makeMockTokenizer() })
    await handle.ingestAll(join(tmpRoot, 'wiki'))
    const filter = new QueryIntentFilter({
      llm: { async call() { return JSON.stringify({ tokens: [{ token: 'bm25', role: 'intent-core', keep: true }] }) } },
      promptTemplate: FILTER_PROMPT,
      tokenize: whitespaceTokenize,
    })
    const results = await handle.search('bm25', { topN: 3, filter })
    expect(results.length).toBeGreaterThan(0)
    const first = results[0] as SearchResultWithMetadata
    expect(first.filterDecision).toBeDefined()
    expect(first.filterDecision?.filtered).toEqual(['bm25'])
  })

  it('With all three layers: every metadata field populated', async () => {
    const handle = await createOramaIndex({ cachePath, tokenizer: makeMockTokenizer() })
    await handle.ingestAll(join(tmpRoot, 'wiki'))
    const filter = new QueryIntentFilter({
      llm: { async call() { return JSON.stringify({ tokens: [{ token: 'bm25', role: 'intent-core', keep: true }] }) } },
      promptTemplate: FILTER_PROMPT,
      tokenize: whitespaceTokenize,
    })
    const rewriter = new QueryRewriter({
      llm: { async call() { return JSON.stringify({ rewrittenQuery: 'bm25', changes: [] }) } },
      promptTemplate: REWRITER_PROMPT,
    })
    const expander = new QueryExpander({
      llm: { async call() {
        return JSON.stringify({ hypotheticalDoc: 'BM25 is a ranking function.', multiQueries: ['bm25 ranking', 'best matching 25', 'tf-idf bm25'] })
      } },
      promptTemplate: EXPANDER_PROMPT,
    })
    const results = await handle.search('bm25', { topN: 3, filter, rewriter, expander })
    expect(results.length).toBeGreaterThan(0)
    const first = results[0] as SearchResultWithMetadata
    expect(first.filterDecision).toBeDefined()
    expect(first.rewriteDecision).toBeDefined()
    expect(first.expandDecision).toBeDefined()
  })

  it('Filter throws → search proceeds with original query (graceful degrade I8)', async () => {
    const handle = await createOramaIndex({ cachePath, tokenizer: makeMockTokenizer() })
    await handle.ingestAll(join(tmpRoot, 'wiki'))
    // Build a filter whose internal LLM throws — but the filter itself swallows + returns
    // a fail-open decision. Search call should still produce results.
    const filter = new QueryIntentFilter({
      llm: { async call() { throw new Error('llm down') } },
      promptTemplate: FILTER_PROMPT,
      tokenize: whitespaceTokenize,
    })
    const results = await handle.search('bm25', { topN: 3, filter })
    expect(results.length).toBeGreaterThan(0)
    const first = results[0] as SearchResultWithMetadata
    expect(first.filterDecision?.fallback).toBe('llm-fail')
  })
})
