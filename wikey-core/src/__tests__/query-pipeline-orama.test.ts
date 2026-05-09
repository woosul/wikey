/**
 * §5.7.4 RED — query-pipeline Orama integration tests.
 *
 * AC-Q2: warm p50 search-only latency ≤ 50ms (LLM synthesis 제외, execOramaSearch 단독).
 * AC-Q4: cross-lingual extraction (Ollama 영문 keyword) 보존 — containsKorean true 시 호출.
 * AC-Q5: production query path (query()) 가 engine='orama' 시 execOramaSearch 호출 + SearchResult shape.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execPath } from 'node:process'
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

/**
 * AC-F1.b — `WIKEY_SEARCH_ENGINE=qmd` 환경 → query() 가 findQmdBin + qmd subprocess 호출.
 *
 * Codex post-impl LOW #6 fix — 기존 main-config-bridge test 는 *config parsing* 만
 * 검증, 실제 qmd subprocess 호출 path 는 미검증. 본 통합 test 는:
 *   - tmp basePath 안 stub `tools/qmd/dist/cli/qmd.js` 작성 (process.execPath 로 실행)
 *   - stub 가 fixture JSON stdout 출력 (qmd.js 의 query 결과 형식)
 *   - query() 호출 시 stub 호출 → parseQmdOutput → SearchResult[] 변환
 *   - LLM mock (httpClient) 으로 답변 합성
 *   - result.sources[*].path 가 'wiki/' prefix 포함 + score 보존 확증
 *
 * 본 test 는 mock execFile 대신 실제 subprocess 호출을 *fast stub script* 로 격리. 100ms
 * 미만 의 실 spawn → integration shape 의 정확한 검증 (vi.mock 으로는 unmock 누락 시
 * 다른 test 에 leak 위험).
 */
describe('query-pipeline qmd legacy integration (AC-F1.b)', () => {
  it('query() with WIKEY_SEARCH_ENGINE=qmd → findQmdBin + qmd subprocess + parseQmdOutput', async () => {
    const config = makeConfig({ WIKEY_SEARCH_ENGINE: 'qmd', WIKEY_QMD_TOP_N: 3 })

    // Stub qmd.js — emits one JSON result. findQmdBin 는 tools/qmd/dist/cli/qmd.js 1순위.
    const qmdDir = join(basePath, 'tools', 'qmd', 'dist', 'cli')
    mkdirSync(qmdDir, { recursive: true })
    const stubPath = join(qmdDir, 'qmd.js')
    // qmd query 의 stdout JSON shape: [{file, score, snippet}]. parseQmdOutput 가
    // file 의 'qmd://wikey-wiki/' prefix 제거 + 'wiki/' 접두사 보장.
    writeFileSync(
      stubPath,
      `// stub qmd.js for integration test (AC-F1.b)
const fixture = JSON.stringify([
  { file: 'qmd://wikey-wiki/concepts/bm25.md', score: 0.92, snippet: 'BM25 algorithm' },
  { file: 'concepts/orama.md', score: 0.81, snippet: 'Orama is in-process' },
])
process.stdout.write(fixture)
`,
      'utf-8',
    )
    chmodSync(stubPath, 0o644)

    // LLM mock — synthesis path will call provider once.
    const httpClient: HttpClient = {
      request: async () => ({
        status: 200,
        body: JSON.stringify({ response: 'BM25 ranks documents.' }),
      }),
    }

    const result = await query('BM25 ranking', config, httpClient, {
      basePath,
      execEnv: process.env as Record<string, string>,
      // findQmdBin 가 isJs=true 분기일 때 nodePath 로 process.execPath 사용.
      nodePath: execPath,
    })

    expect(result).toBeDefined()
    expect(typeof result.answer).toBe('string')
    expect(Array.isArray(result.sources)).toBe(true)
    // 2 sources from stub, parseQmdOutput 가 wiki/ prefix 보장.
    expect(result.sources.length).toBe(2)
    const first = result.sources[0]
    expect(first.path).toBe('wiki/concepts/bm25.md')
    expect(first.score).toBe(0.92)
    expect(first.snippet).toContain('BM25')
    const second = result.sources[1]
    expect(second.path).toBe('wiki/concepts/orama.md')
    expect(second.score).toBe(0.81)
  }, 30000)

  it('query() with engine=qmd + qmd binary missing → findQmdBin throws + Step 1/4 error', async () => {
    const config = makeConfig({ WIKEY_SEARCH_ENGINE: 'qmd' })
    // tools/qmd/ absent → findQmdBin throws.

    const httpClient: HttpClient = {
      request: async () => ({ status: 500, body: 'no llm expected' }),
    }

    await expect(
      query('any', config, httpClient, {
        basePath,
        execEnv: process.env as Record<string, string>,
      }),
    ).rejects.toThrow(/Step 1\/4 qmd 탐색/)
  })
})
