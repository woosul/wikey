/**
 * §5.6.6 Step C — OpenAI REST client tests (T-C1 ~ T-C12).
 *
 * Spec / Todox reference:
 *   - phase-5-spec-5.6.6-subscription-rest.md §1.5 AC-S2/S6/S10b/S12-openai/
 *     S13/S14/S15/S19-openai/S22/S23
 *   - phase-5-todox-5.6.6-subscription-rest.md §3 (Step C)
 *   - docs/spikes/phase-5/5.6.6/poc-openai.mjs (canonical PoC)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── module-level mocks ────────────────────────────────────────────────────
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(async () => {}),
  rename: vi.fn(async () => {}),
}))

import { readFile, writeFile, rename } from 'node:fs/promises'
import { OpenAIRESTClient } from '../openai-rest-client.js'
import {
  SubscriptionFallbackError,
  __resetRefreshCache,
} from '../subscription-rest-shared.js'

// ── auth file fixtures ────────────────────────────────────────────────────

function makeAuth(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    OPENAI_API_KEY: null,
    last_refresh: '2026-05-14T00:00:00Z',
    tokens: {
      access_token: 'eyJ.codex-access.fresh',
      refresh_token: 'rt-codex-1',
      id_token: 'idt-1',
      account_id: 'acct-abc-123',
      ...overrides,
    },
  }
}

// ── SSE stream helper ─────────────────────────────────────────────────────

function sseStream(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(c) {
      for (const e of events) c.enqueue(encoder.encode(e))
      c.close()
    },
  })
}

function sseEvent(obj: Record<string, unknown>): string {
  return `data: ${JSON.stringify(obj)}\n\n`
}

// ── fetch mock helpers ────────────────────────────────────────────────────

interface MockResponse {
  ok: boolean
  status: number
  body?: ReadableStream<Uint8Array> | null
  json?: () => Promise<unknown>
  text?: () => Promise<string>
}

function mkSSE(events: string[]): MockResponse {
  return { ok: true, status: 200, body: sseStream(events) }
}

function mkErr(status: number, body: unknown = {}): MockResponse {
  return {
    ok: false,
    status,
    body: null,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

function mkJSON(status: number, body: unknown): MockResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    body: null,
    json: async () => body,
    text: async () => JSON.stringify(body),
  }
}

interface FetchCall {
  url: string
  init: RequestInit
}

function captureFetch(responses: MockResponse[]): { calls: FetchCall[]; restore: () => void } {
  const calls: FetchCall[] = []
  let i = 0
  const original = globalThis.fetch
  globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    const r = responses[i++]
    if (!r) throw new Error(`no mock response for fetch call #${calls.length}`)
    return r as unknown as Response
  }) as typeof fetch
  return { calls, restore: () => { globalThis.fetch = original } }
}

// ── lifecycle ─────────────────────────────────────────────────────────────

beforeEach(() => {
  __resetRefreshCache()
  vi.mocked(readFile).mockReset()
  vi.mocked(writeFile).mockReset()
  vi.mocked(rename).mockReset()
  vi.mocked(readFile).mockResolvedValue(JSON.stringify(makeAuth()))
  vi.mocked(writeFile).mockResolvedValue(undefined)
  vi.mocked(rename).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── T-C1 — SSE happy path (AC-S2) ─────────────────────────────────────────

describe('§5.6.6 Step C — SSE happy path (AC-S2)', () => {
  it('T-C1: multi delta events → text collected and concatenated', async () => {
    const events = [
      sseEvent({ type: 'response.created', response: { model: 'gpt-5-codex' } }),
      sseEvent({ type: 'response.output_text.delta', delta: 'Hello' }),
      sseEvent({ type: 'response.output_text.delta', delta: ', ' }),
      sseEvent({ type: 'response.output_text.delta', delta: 'world' }),
      sseEvent({
        type: 'response.completed',
        response: {
          model: 'gpt-5-codex',
          usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
        },
      }),
    ]
    const { restore } = captureFetch([mkSSE(events)])
    try {
      const client = new OpenAIRESTClient()
      const result = await client.call('hi', 'gpt-5-codex', {})
      expect(result.text).toBe('Hello, world')
      expect(result.model).toBe('gpt-5-codex')
      expect(typeof result.latencyMs).toBe('number')
    } finally {
      restore()
    }
  })
})

// ── T-C2 — response.completed usage extract (AC-S2 + AC-S15) ──────────────

describe('§5.6.6 Step C — usage extract on response.completed (AC-S15)', () => {
  it('T-C2: result.usage carries input_tokens/output_tokens', async () => {
    const events = [
      sseEvent({ type: 'response.output_text.delta', delta: '4' }),
      sseEvent({
        type: 'response.completed',
        response: {
          model: 'gpt-5-codex',
          usage: { input_tokens: 10, output_tokens: 1, total_tokens: 11 },
        },
      }),
    ]
    const { restore } = captureFetch([mkSSE(events)])
    try {
      const client = new OpenAIRESTClient()
      const result = await client.call('2+2', 'gpt-5-codex', {})
      expect(result.usage).toBeDefined()
      expect(result.usage?.input_tokens).toBe(10)
      expect(result.usage?.output_tokens).toBe(1)
      expect(result.text).toBe('4')
    } finally {
      restore()
    }
  })
})

// ── T-C3 — 401 force refresh + retry (AC-S6) ──────────────────────────────

describe('§5.6.6 Step C — 401 force refresh + retry (AC-S6)', () => {
  it('T-C3: first 401 triggers refresh + retry; second call SSE OK', async () => {
    const refreshedResp = {
      access_token: 'eyJ.codex-access.rotated',
      refresh_token: 'rt-codex-2',
      id_token: 'idt-2',
    }
    const okEvents = [
      sseEvent({ type: 'response.output_text.delta', delta: 'ok' }),
      sseEvent({ type: 'response.completed', response: { model: 'gpt-5-codex', usage: {} } }),
    ]
    const { calls, restore } = captureFetch([
      mkErr(401, { error: 'invalid_token' }),
      mkJSON(200, refreshedResp),
      mkSSE(okEvents),
    ])
    try {
      const client = new OpenAIRESTClient()
      const result = await client.call('hi', 'gpt-5-codex', {})
      expect(result.text).toBe('ok')
      // 1) responses 401 / 2) refresh / 3) responses OK.
      expect(calls).toHaveLength(3)
      expect(calls[0].url).toContain('/codex/responses')
      expect(calls[1].url).toBe('https://auth.openai.com/oauth/token')
      expect(calls[2].url).toContain('/codex/responses')
      // Bearer token on retry = rotated.
      const retryAuth = (calls[2].init.headers as Record<string, string>).Authorization
      expect(retryAuth).toBe('Bearer eyJ.codex-access.rotated')
    } finally {
      restore()
    }
  })
})

// ── T-C4 — atomic write-back to ~/.codex/auth.json (AC-S6) ────────────────

describe('§5.6.6 Step C — atomic write-back on refresh (AC-S6)', () => {
  it('T-C4: writeFile(tmp) + rename(tmp, target) called exactly once each', async () => {
    const refreshedResp = {
      access_token: 'eyJ.codex-access.rotated',
      refresh_token: 'rt-codex-2',
      id_token: 'idt-2',
    }
    const okEvents = [
      sseEvent({ type: 'response.completed', response: { model: 'gpt-5-codex', usage: {} } }),
    ]
    const { restore } = captureFetch([
      mkErr(401, {}),
      mkJSON(200, refreshedResp),
      mkSSE(okEvents),
    ])
    try {
      const client = new OpenAIRESTClient()
      await client.call('hi', 'gpt-5-codex', {})
      expect(writeFile).toHaveBeenCalledTimes(1)
      expect(rename).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })
})

// ── T-C5 — 429 → quota-exceeded (AC-S10b) ─────────────────────────────────

describe('§5.6.6 Step C — 429 quota-exceeded (AC-S10b)', () => {
  it('T-C5: 429 from /responses → throws SubscriptionFallbackError(quota-exceeded)', async () => {
    const { restore } = captureFetch([mkErr(429, { error: 'rate_limit' })])
    try {
      const client = new OpenAIRESTClient()
      await expect(client.call('hi', 'gpt-5-codex', {})).rejects.toMatchObject({
        reason: 'quota-exceeded',
      })
    } finally {
      restore()
    }
  })
})

// ── T-C6 — account_id missing → graceful (R4) ─────────────────────────────

describe('§5.6.6 Step C — account_id missing graceful (R4)', () => {
  it('T-C6: no chatgpt-account-id header when account_id absent', async () => {
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(makeAuth({ account_id: undefined })))
    const events = [
      sseEvent({ type: 'response.output_text.delta', delta: 'x' }),
      sseEvent({ type: 'response.completed', response: { model: 'gpt-5-codex', usage: {} } }),
    ]
    const { calls, restore } = captureFetch([mkSSE(events)])
    try {
      const client = new OpenAIRESTClient()
      await client.call('hi', 'gpt-5-codex', {})
      const headers = calls[0].init.headers as Record<string, string>
      expect(headers).not.toHaveProperty('chatgpt-account-id')
      // Authorization still present.
      expect(headers.Authorization).toBe('Bearer eyJ.codex-access.fresh')
    } finally {
      restore()
    }
  })
})

// ── T-C6b — transport-level tool field absence (AC-S13) ───────────────────

describe('§5.6.6 Step C — transport-level tool field absence (AC-S13)', () => {
  it('T-C6b: request body has no `tools` field; no tool_use/function_call events; instructions raw text has no "tools"', async () => {
    const events = [
      sseEvent({ type: 'response.output_text.delta', delta: 'x' }),
      sseEvent({ type: 'response.completed', response: { model: 'gpt-5-codex', usage: {} } }),
    ]
    const { calls, restore } = captureFetch([mkSSE(events)])
    try {
      const client = new OpenAIRESTClient()
      await client.call('hi', 'gpt-5-codex', {})
      const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>
      // Schema field check (codex F7 v0.4) — Object.keys form, no raw substring grep.
      expect(Object.keys(body).includes('tools')).toBe(false)
      // SSE event stream had no tool_use / function_call events (asserted by
      // event fixture composition above).
      // Instructions raw text intentionally drops "Do not use any tools" wording.
      expect(String(body.instructions)).not.toMatch(/tools/)
    } finally {
      restore()
    }
  })
})

// ── T-C7 — refresh rotation + unknown field round-trip (AC-S22) ───────────

describe('§5.6.6 Step C — refresh rotation + round-trip (AC-S22)', () => {
  it('T-C7: new refresh_token + new id_token written back; unknown field preserved', async () => {
    const initialAuth = {
      OPENAI_API_KEY: null,
      last_refresh: '2026-05-14T00:00:00Z',
      vendor_custom_field: 'top-level-preserved',
      tokens: {
        access_token: 'eyJ.codex-access.fresh',
        refresh_token: 'rt-codex-1',
        id_token: 'idt-1',
        account_id: 'acct-abc-123',
        tokens_custom_field: 'inner-preserved',
      },
    }
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(initialAuth))
    const refreshedResp = {
      access_token: 'eyJ.codex-access.rotated',
      refresh_token: 'rt-codex-2', // ROTATED
      id_token: 'idt-2',            // ROTATED
    }
    const okEvents = [
      sseEvent({ type: 'response.completed', response: { model: 'gpt-5-codex', usage: {} } }),
    ]
    const { restore } = captureFetch([
      mkErr(401, {}),
      mkJSON(200, refreshedResp),
      mkSSE(okEvents),
    ])
    try {
      const client = new OpenAIRESTClient()
      await client.call('hi', 'gpt-5-codex', {})
      const writeCall = vi.mocked(writeFile).mock.calls[0]
      const written = JSON.parse(String(writeCall[1])) as Record<string, unknown>
      const tokens = written.tokens as Record<string, unknown>
      expect(tokens.access_token).toBe('eyJ.codex-access.rotated')
      expect(tokens.refresh_token).toBe('rt-codex-2')
      expect(tokens.id_token).toBe('idt-2')
      expect(tokens.account_id).toBe('acct-abc-123')
      // Unknown field round-trip preserved (I17).
      expect(tokens.tokens_custom_field).toBe('inner-preserved')
      expect(written.vendor_custom_field).toBe('top-level-preserved')
      expect(written.last_refresh).toBe('2026-05-14T00:00:00Z')
    } finally {
      restore()
    }
  })
})

// ── T-C8 — OPENAI_API_KEY untouched (AC-S14) ──────────────────────────────

describe('§5.6.6 Step C — API key access 0 (AC-S14)', () => {
  it('T-C8: openai-rest-client.ts source never reads process.env.OPENAI_API_KEY (grep audit)', async () => {
    const { readFile: realReadFile } = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
    const path = await import('node:path')
    const url = await import('node:url')
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    const src = await realReadFile(path.join(here, '..', 'openai-rest-client.ts'), 'utf-8')
    expect(src).not.toMatch(/process\.env\.OPENAI_API_KEY/)
    expect(src).not.toMatch(/process\.env\.GEMINI_API_KEY/)
    expect(src).not.toMatch(/process\.env\.ANTHROPIC_API_KEY/)
  })
})

// ── T-C9 — usage field precise extraction (AC-S15) ────────────────────────

describe('§5.6.6 Step C — usage field precise extract (AC-S15)', () => {
  it('T-C9: input_tokens / output_tokens read verbatim from response.completed', async () => {
    const events = [
      sseEvent({ type: 'response.output_text.delta', delta: 'a' }),
      sseEvent({
        type: 'response.completed',
        response: {
          model: 'gpt-5-codex',
          usage: {
            input_tokens: 123,
            output_tokens: 45,
            total_tokens: 168,
            input_tokens_details: { cached_tokens: 0 },
          },
        },
      }),
    ]
    const { restore } = captureFetch([mkSSE(events)])
    try {
      const client = new OpenAIRESTClient()
      const result = await client.call('hi', 'gpt-5-codex', {})
      expect(result.usage?.input_tokens).toBe(123)
      expect(result.usage?.output_tokens).toBe(45)
      expect(result.usage?.total_tokens).toBe(168)
    } finally {
      restore()
    }
  })
})

// ── T-C10 — kill-switch (deferred to Step E T-E7c) ────────────────────────

describe('§5.6.6 Step C — kill-switch (AC-S23-openai)', () => {
  it.skip('T-C10: WIKEY_OPENAI_REST_DISABLE forces cli path — deferred to Step E T-E7c (llm-client integration)', () => {
    // Client constructor itself ignores env; kill-switch lives at the
    // llm-client.ts subscriptionMode resolver. See Step E T-E7c.
  })
})

// ── T-C11 — SSE timeout AbortController (AC-S12-openai) ───────────────────

describe('§5.6.6 Step C — SSE timeout AbortController (AC-S12-openai)', () => {
  it('T-C11: external signal abort during fetch → SubscriptionFallbackError(timeout)', async () => {
    const original = globalThis.fetch
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const err = new Error('aborted')
          err.name = 'AbortError'
          reject(err)
        })
      })
    }) as typeof fetch
    try {
      const ac = new AbortController()
      const client = new OpenAIRESTClient()
      const pending = client.call('hi', 'gpt-5-codex', { signal: ac.signal })
      setTimeout(() => ac.abort(), 10)
      await expect(pending).rejects.toMatchObject({ reason: 'timeout' })
    } finally {
      globalThis.fetch = original
    }
  })
})

// ── T-C12 — token-leak audit (AC-S19-openai) ──────────────────────────────

describe('§5.6.6 Step C — token-leak audit (AC-S19-openai)', () => {
  it('T-C12: no accessToken/refreshToken/account_id body emitted via console.*', async () => {
    const spies = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    }
    const events = [
      sseEvent({ type: 'response.output_text.delta', delta: 'x' }),
      sseEvent({ type: 'response.completed', response: { model: 'gpt-5-codex', usage: {} } }),
    ]
    const { restore } = captureFetch([mkSSE(events)])
    try {
      const client = new OpenAIRESTClient()
      await client.call('hi', 'gpt-5-codex', {})
      const allCalls = [
        ...spies.log.mock.calls,
        ...spies.warn.mock.calls,
        ...spies.error.mock.calls,
        ...spies.debug.mock.calls,
      ]
      const secrets = ['eyJ.codex-access.fresh', 'rt-codex-1', 'acct-abc-123']
      for (const args of allCalls) {
        const joined = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
        for (const s of secrets) expect(joined).not.toContain(s)
      }
    } finally {
      restore()
    }
  })
})
