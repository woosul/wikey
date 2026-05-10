/**
 * §5.7.8 plumbing — `QueryOptions.{filter,rewriter,expander,vaultHint}` propagation
 * through `execOramaSearch` to `OramaIndexHandle.search`.
 *
 * The plumbing test stubs `getOramaIndex` via the cachePath override pattern + a fixture
 * wiki dir, then asserts that the layer instances passed in `opts` reach
 * `handle.search` (verified by metadata fields populated on the result).
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

import { execOramaSearch } from '../query-pipeline.js'
import {
  QueryIntentFilter,
  type FilterLLM,
} from '../search/query-intent-filter.js'
import { resetOramaIndexForTest } from '../search/orama-index-singleton.js'
import type { KoreanTokenizerHandle, SearchResultWithMetadata } from '../search/orama-index.js'
import type { WikeyConfig, HttpClient } from '../types.js'

const FILTER_PROMPT = readFileSync(
  join(__dirname, '..', 'prompts', 'query-intent-filter.prompt.md'),
  'utf-8',
)

function whitespaceTokenizer(): KoreanTokenizerHandle {
  return {
    tokenize: (text: string) => text.toLowerCase().split(/\s+/u).filter((s) => s.length > 0),
    close: () => undefined,
  }
}

const baseConfig: WikeyConfig = {
  WIKEY_BASIC_MODEL: 'gemini',
  WIKEY_SEARCH_BACKEND: 'basic',
  WIKEY_SEARCH_ENGINE: 'orama',
  WIKEY_MODEL: 'gemini-2.5-flash',
  WIKEY_QMD_TOP_N: 5,
  WIKEY_SEARCH_TOP_N: 5,
  GEMINI_API_KEY: 'test-key',
  ANTHROPIC_API_KEY: '',
  OPENAI_API_KEY: '',
  OLLAMA_URL: '',
  INGEST_PROVIDER: '',
  LINT_PROVIDER: '',
  SUMMARIZE_PROVIDER: '',
  CONTEXTUAL_MODEL: 'gemma',
  COST_LIMIT: 50,
}

const httpClient: HttpClient = {
  async request() {
    // execOramaSearch may invoke `extractEnglishKeywords` for Korean queries; we keep the
    // queries ASCII so this stub is never reached. Return a benign empty body.
    return { status: 200, body: '{}' }
  },
}

let tmpRoot = ''
let cachePath = ''
let basePath = ''

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'wikey-plumbing-'))
  cachePath = join(tmpRoot, 'cache.json')
  basePath = join(tmpRoot, 'project')
  const wikiDir = join(basePath, 'wiki', 'concepts')
  mkdirSync(wikiDir, { recursive: true })
  writeFileSync(
    join(wikiDir, 'bm25.md'),
    '---\ntitle: BM25\n---\nBM25 algorithm body.',
    'utf-8',
  )
  resetOramaIndexForTest()
})
afterEach(() => {
  resetOramaIndexForTest()
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true })
})

describe('query-pipeline plumbing — filter / rewriter / expander forwarding', () => {
  it('No layer opts → legacy SearchResult shape (backward compat I7)', async () => {
    const results = await execOramaSearch('bm25', baseConfig, basePath, {
      basePath,
      tokenizerOverride: whitespaceTokenizer(),
      oramaCachePath: cachePath,
    }, httpClient)
    expect(results.length).toBeGreaterThan(0)
    const first = results[0] as SearchResultWithMetadata
    expect(first.filterDecision).toBeUndefined()
  })

  it('opts.filter forwarded → SearchResult carries filterDecision metadata', async () => {
    let calls = 0
    const llm: FilterLLM = {
      async call() {
        calls += 1
        return JSON.stringify({ tokens: [{ token: 'bm25', role: 'intent-core', keep: true }] })
      },
    }
    const filter = new QueryIntentFilter({
      llm,
      promptTemplate: FILTER_PROMPT,
      tokenize: (q: string) => q.split(/\s+/u).filter((t) => t.length > 0),
    })
    const results = await execOramaSearch('bm25', baseConfig, basePath, {
      basePath,
      tokenizerOverride: whitespaceTokenizer(),
      oramaCachePath: cachePath,
      filter,
    }, httpClient)
    expect(calls).toBe(1)
    expect(results.length).toBeGreaterThan(0)
    const first = results[0] as SearchResultWithMetadata
    expect(first.filterDecision).toBeDefined()
    expect(first.filterDecision?.filtered).toEqual(['bm25'])
  })
})
