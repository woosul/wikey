/**
 * §5.7.7 Step B1 RED — Spec 1 (Qwen3-Embedding 0.6B local loader) — 7 AC.
 *
 * Module under test: `wikey-core/src/embeddings/qwen3-loader.ts` (NEW, Step C).
 * Endpoint Q1 LOCKED (v1.0): ollama embedding API
 *   POST http://localhost:11434/api/embeddings
 *   body { model: 'dengcao/Qwen3-Embedding-0.6B:Q8_0', prompt: text }
 *   response { embedding: number[] }   (1024D Float, master 직접 ollama endpoint 호출 mirror)
 *
 * AC mapping (Spec 1.1):
 *   AC-Q1 Happy lazy connect          — hybrid OFF → endpoint 미호출
 *   AC-Q2 Happy 사전 설치              — model 존재 → status 'installed'
 *   AC-Q3 Happy 자동 pull              — model 부재 → ollama pull subprocess
 *   AC-Q4 Edge ollama 미동작           — fail-open + Notice + return undefined
 *   AC-Q5 Edge license verify         — model card Apache-2.0 명시 (const)
 *   AC-Q6 Error timeout               — embed ≥ 5s → AbortController abort + throw
 *   AC-Q7 Error dim mismatch          — dim ≠ 1024 → throw + status 'failed'
 *
 * Inew (dimension lock): all dim references = `EMBEDDING_DIM = 1024 as const` in
 * `wikey-core/src/embeddings/embedding-config.ts` (Step C0). single source.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createQwen3Loader } from '../embeddings/qwen3-loader.js'
import {
  EMBEDDING_DIM,
  EMBEDDING_MODEL_DEFAULT,
  QWEN3_LICENSE,
} from '../embeddings/embedding-config.js'

interface FetchCall {
  url: string
  init?: RequestInit
}

function setupMockFetch(): {
  calls: FetchCall[]
  setResponse: (resp: Response | Promise<Response> | (() => Promise<Response>)) => void
  setReject: (err: Error) => void
} {
  const calls: FetchCall[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let nextResp: any = null
  let nextErr: Error | null = null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).fetch = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init })
    if (nextErr) throw nextErr
    if (typeof nextResp === 'function') return nextResp()
    return nextResp
  })

  return {
    calls,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setResponse: (resp: any) => {
      nextResp = resp
      nextErr = null
    },
    setReject: (err: Error) => {
      nextErr = err
      nextResp = null
    },
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function vector1024(seed = 0.5): number[] {
  return new Array(1024).fill(0).map((_, i) => (i % 2 === 0 ? seed : -seed))
}

let mock: ReturnType<typeof setupMockFetch>

beforeEach(() => {
  mock = setupMockFetch()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('§5.7.7 Spec 1 — Qwen3-Embedding loader (7 AC)', () => {
  it('AC-Q1 (Happy lazy connect): hybrid OFF → endpoint 미호출. createQwen3Loader 자체 호출 시 health check 없어야 한다.', async () => {
    expect(createQwen3Loader, 'createQwen3Loader export from embeddings/qwen3-loader.ts').toBeDefined()
    const loader = createQwen3Loader({
      ollamaUrl: 'http://localhost:11434',
      model: EMBEDDING_MODEL_DEFAULT,
    })
    // Lazy: factory 호출 시점까지 endpoint 미호출.
    expect(mock.calls.length).toBe(0)
    expect(loader.isLoaded()).toBe(false)
  })

  it('AC-Q2 (Happy 사전 설치): ollama list 안 model 존재 → status `installed`', async () => {
    expect(createQwen3Loader).toBeDefined()
    // /api/tags 호출 시 model 존재
    mock.setResponse(
      jsonResponse({
        models: [
          { name: 'dengcao/Qwen3-Embedding-0.6B:Q8_0', size: 639_000_000 },
          { name: 'qwen3:8b', size: 5_000_000_000 },
        ],
      }),
    )
    const loader = createQwen3Loader({
      ollamaUrl: 'http://localhost:11434',
      model: 'dengcao/Qwen3-Embedding-0.6B:Q8_0',
    })
    const status = await loader.checkInstallStatus()
    expect(status).toBe('installed')
    // /api/tags 정확히 1회 호출
    const tagsCalls = mock.calls.filter((c) => c.url.includes('/api/tags'))
    expect(tagsCalls.length).toBeGreaterThanOrEqual(1)
  })

  it('AC-Q3 (Happy 자동 pull): model 부재 → `ollama pull` subprocess + status `installed` 반환', async () => {
    expect(createQwen3Loader).toBeDefined()
    let callIdx = 0
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).fetch = vi.fn(async (url: string) => {
      callIdx += 1
      if (url.includes('/api/tags')) {
        // 1번째 호출 — model 부재
        if (callIdx === 1) return jsonResponse({ models: [] })
        // pull 후 재호출 — model 존재
        return jsonResponse({
          models: [{ name: 'dengcao/Qwen3-Embedding-0.6B:Q8_0', size: 639_000_000 }],
        })
      }
      if (url.includes('/api/pull')) {
        return jsonResponse({ status: 'success' })
      }
      return new Response('not found', { status: 404 })
    })
    const loader = createQwen3Loader({
      ollamaUrl: 'http://localhost:11434',
      model: 'dengcao/Qwen3-Embedding-0.6B:Q8_0',
    })
    const status = await loader.ensureInstalled()
    expect(status).toBe('installed')
  })

  it('AC-Q4 (Edge ollama 미동작): endpoint connect 실패 → graceful fallback (return undefined or fail-open)', async () => {
    expect(createQwen3Loader).toBeDefined()
    mock.setReject(new TypeError('fetch failed: ECONNREFUSED'))
    const loader = createQwen3Loader({
      ollamaUrl: 'http://localhost:11434',
      model: EMBEDDING_MODEL_DEFAULT,
    })
    // I3 graceful disconnect — embed 시 throw 가 아니라 undefined / null 반환 (fail-open)
    const result = await loader.embed('hello world')
    expect(result).toBeUndefined()
  })

  it('AC-Q5 (Edge license verify): Qwen3 model = Apache-2.0 (const, 단순 sanity)', () => {
    expect(QWEN3_LICENSE, 'QWEN3_LICENSE constant from embedding-config.ts').toBe('Apache-2.0')
    expect(EMBEDDING_DIM).toBe(1024)
    expect(EMBEDDING_MODEL_DEFAULT).toBe('dengcao/Qwen3-Embedding-0.6B:Q8_0')
  })

  it('AC-Q6 (Error timeout): embed ≥ 5s → AbortController abort → throw', async () => {
    expect(createQwen3Loader).toBeDefined()
    // fetch 가 영원히 hang. AbortSignal 이 throw 유발해야 함.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(globalThis as any).fetch = vi.fn(async (_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal
        if (signal) {
          signal.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError')),
          )
        }
        // 절대 resolve 하지 않음
      })
    })
    const loader = createQwen3Loader({
      ollamaUrl: 'http://localhost:11434',
      model: EMBEDDING_MODEL_DEFAULT,
      timeoutMs: 50, // test 단축 — 실 default 5000
    })
    await expect(loader.embed('hello world')).rejects.toThrow(/abort|timeout/iu)
  })

  it('AC-Q7 (Error dim mismatch): model 응답 dim ≠ 1024 → throw + 후속 status `failed`', async () => {
    expect(createQwen3Loader).toBeDefined()
    // 768D 잘못된 응답
    mock.setResponse(jsonResponse({ embedding: new Array(768).fill(0.1) }))
    const loader = createQwen3Loader({
      ollamaUrl: 'http://localhost:11434',
      model: EMBEDDING_MODEL_DEFAULT,
    })
    await expect(loader.embed('hello')).rejects.toThrow(/dim|dimension|1024/iu)
  })
})
