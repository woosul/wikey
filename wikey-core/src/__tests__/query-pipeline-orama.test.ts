/**
 * §5.7.4 RED — query-pipeline Orama integration tests.
 *
 * AC-Q2: warm p50 search-only latency ≤ 50ms (LLM synthesis 제외, execOramaSearch 단독).
 * AC-Q4: cross-lingual extraction (Ollama 영문 keyword) 보존 — containsKorean true 시 호출.
 * AC-Q5: production query path (query()) 가 engine='orama' 시 execOramaSearch 호출 + SearchResult shape.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execOramaSearch, query } from '../query-pipeline.js'
import { resetOramaIndexForTest } from '../search/orama-index-singleton.js'
import type { HttpClient, WikeyConfig } from '../types.js'

function makeConfig(overrides: Partial<WikeyConfig> = {}): WikeyConfig {
  return {
    WIKEY_BASIC_MODEL: 'ollama',
    WIKEY_SEARCH_BACKEND: 'basic',
    WIKEY_SEARCH_ENGINE: 'orama',
    WIKEY_MODEL: '',
    WIKEY_QMD_TOP_N: 5,
    GEMINI_API_KEY: '',
    ANTHROPIC_API_KEY: '',
    OPENAI_API_KEY: '',
    OLLAMA_URL: 'http://localhost:11434',
    INGEST_PROVIDER: '',
    LINT_PROVIDER: '',
    SUMMARIZE_PROVIDER: '',
    CONTEXTUAL_MODEL: 'gemma3:4b',
    COST_LIMIT: 50,
    ...overrides,
  }
}

let tmpRoot = ''
let basePath = ''
let cachePath = ''

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'wikey-qpo-'))
  basePath = tmpRoot
  cachePath = join(tmpRoot, 'orama-cache.json')
  mkdirSync(join(basePath, 'wiki', 'concepts'), { recursive: true })
  mkdirSync(join(basePath, 'wiki', 'entities'), { recursive: true })
  // Fixture pages — small corpus.
  writeFileSync(
    join(basePath, 'wiki', 'concepts', 'bm25.md'),
    '---\ntitle: BM25\n---\nBM25 algorithm scores documents by term frequency.',
    'utf-8',
  )
  writeFileSync(
    join(basePath, 'wiki', 'concepts', 'orama.md'),
    '---\ntitle: Orama\n---\nOrama is an in-process search engine for JavaScript.',
    'utf-8',
  )
  writeFileSync(
    join(basePath, 'wiki', 'concepts', 'rag.md'),
    '---\ntitle: RAG\n---\n검색 증강 생성 RAG combines retrieval with LLM synthesis.',
    'utf-8',
  )
  resetOramaIndexForTest()
})

afterEach(() => {
  resetOramaIndexForTest()
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true })
})

function makeNoopHttpClient(): HttpClient {
  return {
    request: async () => ({ status: 500, body: 'no http expected' }),
  }
}

describe('query-pipeline Orama integration', () => {
  it('AC-Q2: warm p50 search-only latency ≤ 50ms (execOramaSearch direct)', async () => {
    const config = makeConfig()
    // Ingest first so cache is warm.
    await execOramaSearch('warmup', config, basePath, {
      oramaCachePath: cachePath,
      execEnv: process.env as Record<string, string>,
      tokenizerOverride: {
        tokenize: (t: string) => t.toLowerCase().split(/\s+/u).filter(Boolean),
        close: () => undefined,
      },
    }, makeNoopHttpClient())
    const samples = 5
    const latencies: number[] = []
    for (let i = 0; i < samples; i++) {
      const t0 = Date.now()
      await execOramaSearch('orama', config, basePath, {
        oramaCachePath: cachePath,
        execEnv: process.env as Record<string, string>,
        tokenizerOverride: {
          tokenize: (t: string) => t.toLowerCase().split(/\s+/u).filter(Boolean),
          close: () => undefined,
        },
      }, makeNoopHttpClient())
      latencies.push(Date.now() - t0)
    }
    const sorted = [...latencies].sort((a, b) => a - b)
    const p50 = sorted[Math.floor(sorted.length / 2)]
    expect(p50).toBeLessThanOrEqual(50)
  })

  it('AC-Q4: containsKorean(question) true → cross-lingual English keyword extraction invoked', async () => {
    const config = makeConfig()
    let ollamaCalled = false
    const httpClient: HttpClient = {
      request: async (url) => {
        // Ollama generate endpoint
        if (url.includes('11434') || url.includes('ollama')) {
          ollamaCalled = true
          return {
            status: 200,
            body: JSON.stringify({ response: 'rag retrieval augmented' }),
          }
        }
        return { status: 500, body: 'unexpected' }
      },
    }
    const results = await execOramaSearch(
      '검색 증강 생성에 대해 알려줘',
      config,
      basePath,
      {
        oramaCachePath: cachePath,
        execEnv: process.env as Record<string, string>,
        tokenizerOverride: {
          tokenize: (t: string) => t.toLowerCase().split(/\s+/u).filter(Boolean),
          close: () => undefined,
        },
      },
      httpClient,
    )
    expect(ollamaCalled).toBe(true)
    expect(Array.isArray(results)).toBe(true)
  })

  it('AC-Q5: query() with engine=orama returns SearchResult[] (production path)', async () => {
    const config = makeConfig()
    // LLM call mock — query() will synthesize an answer.
    const httpClient: HttpClient = {
      request: async () => ({
        status: 200,
        body: JSON.stringify({ response: 'answer text' }),
      }),
    }
    const result = await query('orama search engine', config, httpClient, {
      basePath,
      execEnv: process.env as Record<string, string>,
      oramaCachePath: cachePath,
      tokenizerOverride: {
        tokenize: (t: string) => t.toLowerCase().split(/\s+/u).filter(Boolean),
        close: () => undefined,
      },
    })
    expect(result).toBeDefined()
    expect(typeof result.answer).toBe('string')
    expect(Array.isArray(result.sources)).toBe(true)
    if (result.sources.length > 0) {
      const first = result.sources[0]
      expect(typeof first.path).toBe('string')
      expect(first.path).toMatch(/^wiki\//)
      expect(typeof first.score).toBe('number')
    }
  })
})

// Silence vitest unused-import warnings in this RED scaffold
void vi
