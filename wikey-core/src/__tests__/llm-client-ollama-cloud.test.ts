/**
 * §5.6.5 Step A — Ollama Cloud LLMClient dispatch unit tests.
 *
 * RED phase tests (todox A1~A5, A7, A8):
 *   - A1: LLMProvider type accepts 'ollama-cloud' literal (compile-time + runtime).
 *   - A2: callOllama dispatches cloud-suffix model to localhost:11434 + emits debug log.
 *   - A3: HTTP 401 → onAuthFallback('auth-missing') + throw.
 *   - A4: timeout opt forwarded as AbortController-compatible value.
 *   - A5: response body "quota exceeded" / "monthly limit reached" → 'quota-exceeded'.
 *   - A7: provider='ollama' + cloud model → cloud branch (auto-dispatch via isCloudModel).
 *         provider='ollama-cloud' + local-only model → mismatch throw.
 *   - A8: regression — provider='ollama' + local model emits NO cloud debug log
 *         and hits same localhost:11434 endpoint (transport variant (a) confirmed).
 *
 * PoC §0 paradigm LOCK (2026-05-14, SUMMARY.md §2 + §6 #2):
 *   - callOllamaCloud separate function REJECTED — single callOllama with
 *     internal cloud branch + isCloudModel(modelId) helper.
 *   - Endpoint identical: `localhost:11434/api/chat` for both local and cloud.
 *   - provider key 'ollama-cloud' = UI subsection + credential separation only.
 */

import { describe, it, expect, vi } from 'vitest'
import { LLMClient } from '../llm-client.js'
import type {
  HttpClient,
  HttpRequestOptions,
  HttpResponse,
  LLMProvider,
  WikeyConfig,
  AuthFallbackInfo,
} from '../types.js'

function mockHttpClient(
  responseBody: string,
  status = 200,
): { client: HttpClient; calls: Array<{ url: string; opts: HttpRequestOptions }> } {
  const calls: Array<{ url: string; opts: HttpRequestOptions }> = []
  return {
    client: {
      async request(url: string, opts: HttpRequestOptions): Promise<HttpResponse> {
        calls.push({ url, opts })
        return { status, body: responseBody }
      },
    },
    calls,
  }
}

const baseConfig: WikeyConfig = {
  WIKEY_BASIC_MODEL: 'gemini',
  WIKEY_SEARCH_BACKEND: 'basic',
  WIKEY_MODEL: 'wikey',
  WIKEY_QMD_TOP_N: 5,
  GEMINI_API_KEY: 'test-gemini-key',
  ANTHROPIC_API_KEY: 'test-anthropic-key',
  OPENAI_API_KEY: 'test-openai-key',
  OLLAMA_URL: 'http://localhost:11434',
  INGEST_PROVIDER: '',
  LINT_PROVIDER: '',
  SUMMARIZE_PROVIDER: '',
  CONTEXTUAL_MODEL: 'gemma4',
  COST_LIMIT: 50,
  GEMINI_AUTH_MODE: 'api',
  ANTHROPIC_AUTH_MODE: 'api',
  OPENAI_AUTH_MODE: 'api',
}

const ollamaResponse = JSON.stringify({
  message: { content: 'cloud says hello' },
})

describe('§5.6.5 Step A — LLMProvider type (A1)', () => {
  it("accepts 'ollama-cloud' literal as LLMProvider", () => {
    // Compile-time check: this assignment must type-check.
    const provider: LLMProvider = 'ollama-cloud'
    expect(provider).toBe('ollama-cloud')
  })

  it('rejects invalid provider strings at runtime via switch default', async () => {
    const { client } = mockHttpClient(ollamaResponse)
    const llm = new LLMClient(client, baseConfig)
    // @ts-expect-error — invalid provider literal
    await expect(llm.call('test', { provider: 'invalid-provider' })).rejects.toThrow(
      /Unknown provider/,
    )
  })
})

describe('§5.6.5 Step A — Cloud dispatch via callOllama (A2)', () => {
  it("provider='ollama-cloud' + cloud model → POST localhost:11434/api/chat", async () => {
    const { client, calls } = mockHttpClient(ollamaResponse)
    const llm = new LLMClient(client, baseConfig)
    await llm.call('test prompt', {
      provider: 'ollama-cloud',
      model: 'deepseek-v3.1:671b-cloud',
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('http://localhost:11434/api/chat')
    const body = JSON.parse(calls[0].opts.body!)
    expect(body.model).toBe('deepseek-v3.1:671b-cloud')
    expect(body.stream).toBe(false)
  })

  it("provider='ollama-cloud' uses jsonMode native (format:json) for M1~M4", async () => {
    const { client, calls } = mockHttpClient(ollamaResponse)
    const llm = new LLMClient(client, baseConfig)
    await llm.call('test', {
      provider: 'ollama-cloud',
      model: 'gpt-oss:120b-cloud',
      jsonMode: true,
    })
    const body = JSON.parse(calls[0].opts.body!)
    expect(body.format).toBe('json')
  })
})

describe('§5.6.5 Step A — Auth failure detection (A3, A5)', () => {
  it('HTTP 401 response surfaces onAuthFallback("auth-missing") then throws', async () => {
    const { client } = mockHttpClient(
      JSON.stringify({ error: 'You need to be signed in' }),
      401,
    )
    const llm = new LLMClient(client, baseConfig)
    const calls: AuthFallbackInfo[] = []

    await expect(
      llm.call('test', {
        provider: 'ollama-cloud',
        model: 'deepseek-v3.1:671b-cloud',
        onAuthFallback: (info) => calls.push(info),
      }),
    ).rejects.toThrow()

    expect(calls).toHaveLength(1)
    expect(calls[0].provider).toBe('ollama-cloud')
    expect(calls[0].reason).toBe('auth-missing')
  })

  it('response body "quota exceeded" → onAuthFallback("quota-exceeded") then throws', async () => {
    const { client } = mockHttpClient(
      JSON.stringify({ error: 'monthly limit reached: quota exceeded' }),
      429,
    )
    const llm = new LLMClient(client, baseConfig)
    const calls: AuthFallbackInfo[] = []

    await expect(
      llm.call('test', {
        provider: 'ollama-cloud',
        model: 'deepseek-v3.1:671b-cloud',
        onAuthFallback: (info) => calls.push(info),
      }),
    ).rejects.toThrow()

    expect(calls).toHaveLength(1)
    expect(calls[0].reason).toBe('quota-exceeded')
  })
})

describe('§5.6.5 Step A — Timeout propagation (A4)', () => {
  it('passes opts.timeout to httpClient (600000ms default §5.6.4 v0.6 mirror)', async () => {
    const { client, calls } = mockHttpClient(ollamaResponse)
    const llm = new LLMClient(client, baseConfig)
    await llm.call('test', {
      provider: 'ollama-cloud',
      model: 'deepseek-v3.1:671b-cloud',
      timeout: 600_000,
    })
    expect(calls[0].opts.timeout).toBe(600_000)
  })
})

describe('§5.6.5 Step A — Automatic dispatch (A7)', () => {
  it("provider='ollama' + cloud model identifier → cloud dispatch (auto via isCloudModel)", async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const { client, calls } = mockHttpClient(ollamaResponse)
    const llm = new LLMClient(client, baseConfig)
    await llm.call('test', {
      provider: 'ollama',
      model: 'qwen3-coder:480b-cloud',
    })

    // Same endpoint, but cloud branch active (PoC §0 paradigm).
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('http://localhost:11434/api/chat')

    // Cloud debug log emitted exactly when isCloudModel(model) === true.
    const cloudLogs = debugSpy.mock.calls.filter((c) =>
      String(c[0] ?? '').includes('cloud dispatch'),
    )
    expect(cloudLogs.length).toBeGreaterThanOrEqual(1)
    debugSpy.mockRestore()
  })

  it("provider='ollama-cloud' + local-only model → mismatch throw", async () => {
    const { client } = mockHttpClient(ollamaResponse)
    const llm = new LLMClient(client, baseConfig)
    await expect(
      llm.call('test', {
        provider: 'ollama-cloud',
        model: 'qwen3:8b', // local-only, mismatch
      }),
    ).rejects.toThrow(/local-only|mismatch|not a cloud model/i)
  })
})

describe('§5.6.5 Step A — Local regression — no cloud debug log (A8)', () => {
  it("provider='ollama' + local model qwen3:8b → no cloud debug, same endpoint", async () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const { client, calls } = mockHttpClient(ollamaResponse)
    const llm = new LLMClient(client, baseConfig)
    await llm.call('test', {
      provider: 'ollama',
      model: 'qwen3:8b',
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('http://localhost:11434/api/chat')

    const cloudLogs = debugSpy.mock.calls.filter((c) =>
      String(c[0] ?? '').includes('cloud dispatch'),
    )
    expect(cloudLogs.length).toBe(0)
    debugSpy.mockRestore()
  })

  it('M5 mistral-large-3 cloud response with ```json``` wrap → stripped to raw JSON', async () => {
    const wrapped = JSON.stringify({
      message: { content: '```json\n{"status":"ok"}\n```' },
    })
    const { client } = mockHttpClient(wrapped)
    const llm = new LLMClient(client, baseConfig)
    const result = await llm.call('test', {
      provider: 'ollama-cloud',
      model: 'mistral-large-3:675b-cloud',
      jsonMode: true,
    })
    expect(result.trim()).toBe('{"status":"ok"}')
  })
})
