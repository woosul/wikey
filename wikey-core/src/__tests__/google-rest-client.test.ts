/**
 * §5.6.6 Step B — Google REST client tests (T-B1 ~ T-B11).
 *
 * Spec / Todox reference:
 *   - phase-5-spec-5.6.6-subscription-rest.md §1.5 AC-S1/S4/S5/S9/S13/S14/S15/S22
 *     + S6b (401-twice) + S12-google (timeout) + S19-google (no token leak)
 *   - phase-5-todox-5.6.6-subscription-rest.md §2.2 (T-B1 ~ T-B11)
 *   - docs/spikes/phase-5/5.6.6/poc-google.mjs (canonical PoC)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── module-level mocks ────────────────────────────────────────────────────
// node:fs/promises mocks let us drive token loading and writeback without
// touching real ~/.gemini/oauth_creds.json. atomicWriteJSON calls
// writeFile(tmp) + rename(tmp, target).
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(async () => {}),
  rename: vi.fn(async () => {}),
}))

// crypto.randomUUID — keep stable across tests for deterministic body assertions.
vi.mock('node:crypto', async () => {
  const actual = await vi.importActual<typeof import('node:crypto')>('node:crypto')
  return { ...actual, randomUUID: vi.fn(() => '00000000-0000-0000-0000-000000000001') }
})

import { readFile, writeFile, rename } from 'node:fs/promises'
import {
  GoogleRESTClient,
  __resetProjectCache,
} from '../google-rest-client.js'
import {
  SubscriptionFallbackError,
  __resetRefreshCache,
} from '../subscription-rest-shared.js'

// ── fetch mock helpers ────────────────────────────────────────────────────

interface MockResponse {
  ok: boolean
  status: number
  json?: () => Promise<unknown>
  text?: () => Promise<string>
}

function mkRes(status: number, body: unknown): MockResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
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
  return {
    calls,
    restore: () => {
      globalThis.fetch = original
    },
  }
}

// Default creds: fresh (1 hour to expiry), real refresh_token present.
function makeFreshCreds(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    access_token: 'ya29.fresh-access',
    refresh_token: '1//refresh-token-1',
    token_type: 'Bearer',
    scope: 'openid email profile',
    expiry_date: Date.now() + 60 * 60_000,
    ...overrides,
  }
}

const LOAD_CODE_ASSIST_OK = {
  cloudaicompanionProject: 'proj-abc-123',
  currentTier: { name: 'free' },
}

const GENERATE_OK = {
  response: {
    candidates: [{ content: { parts: [{ text: 'world' }] } }],
    usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 2, totalTokenCount: 3 },
    modelVersion: 'gemini-2.5-flash',
  },
}

// ── lifecycle ─────────────────────────────────────────────────────────────

beforeEach(() => {
  __resetRefreshCache()
  __resetProjectCache()
  vi.mocked(readFile).mockReset()
  vi.mocked(writeFile).mockReset()
  vi.mocked(rename).mockReset()
  vi.mocked(readFile).mockResolvedValue(JSON.stringify(makeFreshCreds()))
  vi.mocked(writeFile).mockResolvedValue(undefined)
  vi.mocked(rename).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.GOOGLE_CLOUD_PROJECT
})

// ── T-B1 — happy path (AC-S1) ─────────────────────────────────────────────

describe('§5.6.6 Step B — happy path (AC-S1)', () => {
  it('T-B1: call("hello", "gemini-2.5-flash") → response text "world"', async () => {
    const { calls, restore } = captureFetch([mkRes(200, LOAD_CODE_ASSIST_OK), mkRes(200, GENERATE_OK)])
    try {
      const client = new GoogleRESTClient()
      const result = await client.call('hello', 'gemini-2.5-flash', {})
      expect(result.text).toBe('world')
      expect(result.model).toBe('gemini-2.5-flash')
      expect(typeof result.latencyMs).toBe('number')
      expect(calls).toHaveLength(2)
      expect(calls[0].url).toContain(':loadCodeAssist')
      expect(calls[1].url).toContain(':generateContent')
    } finally {
      restore()
    }
  })
})

// ── T-B2 — project resolve cache (AC-S4) ──────────────────────────────────

describe('§5.6.6 Step B — project resolve cache (AC-S4)', () => {
  it('T-B2: second call uses cached projectId → loadCodeAssist invoked 0 times', async () => {
    const { calls, restore } = captureFetch([
      mkRes(200, LOAD_CODE_ASSIST_OK),
      mkRes(200, GENERATE_OK),
      mkRes(200, GENERATE_OK),
    ])
    try {
      const client = new GoogleRESTClient()
      await client.call('q1', 'gemini-2.5-flash', {})
      await client.call('q2', 'gemini-2.5-flash', {})
      // 1 loadCodeAssist + 2 generateContent = 3 fetches total.
      expect(calls).toHaveLength(3)
      const loadCalls = calls.filter((c) => c.url.includes(':loadCodeAssist'))
      expect(loadCalls).toHaveLength(1)
    } finally {
      restore()
    }
  })
})

// ── T-B3 — token refresh + write-back (AC-S5) ─────────────────────────────

describe('§5.6.6 Step B — token refresh + write-back (AC-S5)', () => {
  it('T-B3: expiry < 60s → POST oauth2.googleapis.com/token + atomic write-back', async () => {
    // Override creds to be near-expiry.
    vi.mocked(readFile).mockResolvedValueOnce(
      JSON.stringify(makeFreshCreds({ expiry_date: Date.now() + 30_000 })),
    )
    const refreshedResp = {
      access_token: 'ya29.rotated-access',
      expires_in: 3600,
      token_type: 'Bearer',
      id_token: 'idtoken-new',
      scope: 'openid email profile',
    }
    const { calls, restore } = captureFetch([
      mkRes(200, refreshedResp), // refresh
      mkRes(200, LOAD_CODE_ASSIST_OK),
      mkRes(200, GENERATE_OK),
    ])
    try {
      const client = new GoogleRESTClient()
      await client.call('hello', 'gemini-2.5-flash', {})
      // Refresh fetch first.
      expect(calls[0].url).toBe('https://oauth2.googleapis.com/token')
      expect(calls[0].init.method).toBe('POST')
      const body = String(calls[0].init.body ?? '')
      expect(body).toContain('grant_type=refresh_token')
      expect(body).toContain('refresh_token=1%2F%2Frefresh-token-1')
      // Atomic write: writeFile(tmp) + rename(tmp, target).
      expect(writeFile).toHaveBeenCalledTimes(1)
      expect(rename).toHaveBeenCalledTimes(1)
    } finally {
      restore()
    }
  })
})

// ── T-B4 — 429 → quota-exceeded (AC-S9) ───────────────────────────────────

describe('§5.6.6 Step B — 429 quota-exceeded (AC-S9)', () => {
  it('T-B4: 429 from generateContent → throws SubscriptionFallbackError(quota-exceeded)', async () => {
    const { restore } = captureFetch([mkRes(200, LOAD_CODE_ASSIST_OK), mkRes(429, { error: 'RESOURCE_EXHAUSTED' })])
    try {
      const client = new GoogleRESTClient()
      await expect(client.call('hello', 'gemini-2.5-flash', {})).rejects.toMatchObject({
        reason: 'quota-exceeded',
      })
    } finally {
      restore()
    }
  })
})

// ── T-B5 — transport-level tool 0 (AC-S13) ────────────────────────────────

describe('§5.6.6 Step B — transport-level tool field absence (AC-S13)', () => {
  it('T-B5: request body has no `tools` / `tool_config` / `function_declarations` schema fields', async () => {
    const { calls, restore } = captureFetch([mkRes(200, LOAD_CODE_ASSIST_OK), mkRes(200, GENERATE_OK)])
    try {
      const client = new GoogleRESTClient()
      await client.call('hello', 'gemini-2.5-flash', {})
      const generateCall = calls.find((c) => c.url.includes(':generateContent'))!
      const parsed = JSON.parse(String(generateCall.init.body)) as Record<string, unknown>
      // Schema field check — Object.keys form, no raw substring grep.
      expect(Object.keys(parsed).includes('tools')).toBe(false)
      expect(Object.keys(parsed).includes('tool_config')).toBe(false)
      expect(Object.keys(parsed).includes('function_declarations')).toBe(false)
      const request = parsed.request as Record<string, unknown>
      expect(Object.keys(request).includes('tools')).toBe(false)
      expect(Object.keys(request).includes('tool_config')).toBe(false)
      expect(Object.keys(request).includes('function_declarations')).toBe(false)
    } finally {
      restore()
    }
  })
})

// ── T-B6 — GEMINI_API_KEY untouched (AC-S14) ──────────────────────────────
// Node hardens `process.env` against accessor descriptors (TypeError on
// Object.defineProperty getter), so we use a static source grep audit per
// Spec §1.5 AC-S14 "grep audit" alternative — single source of truth.

describe('§5.6.6 Step B — API key access 0 (AC-S14)', () => {
  it('T-B6: google-rest-client.ts source never reads process.env.GEMINI_API_KEY (grep audit)', async () => {
    const { readFile: realReadFile } = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
    const path = await import('node:path')
    const url = await import('node:url')
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    const src = await realReadFile(path.join(here, '..', 'google-rest-client.ts'), 'utf-8')
    expect(src).not.toMatch(/process\.env\.GEMINI_API_KEY/)
    expect(src).not.toMatch(/process\.env\.ANTHROPIC_API_KEY/)
    expect(src).not.toMatch(/process\.env\.OPENAI_API_KEY/)
  })
})

// ── T-B7 — refresh rotation + unknown field round-trip (AC-S22) ───────────

describe('§5.6.6 Step B — refresh rotation + round-trip (AC-S22)', () => {
  it('T-B7: new refresh_token + unknown field round-tripped to creds file', async () => {
    const initial = makeFreshCreds({
      expiry_date: Date.now() + 30_000,
      vendor_custom_field: 'preserved-value', // unknown — must round-trip
    })
    vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(initial))
    const refreshedResp = {
      access_token: 'ya29.rotated',
      refresh_token: '1//refresh-token-2', // ROTATED
      id_token: 'idtoken-v2',
      expires_in: 3600,
      token_type: 'Bearer',
    }
    const { restore } = captureFetch([
      mkRes(200, refreshedResp),
      mkRes(200, LOAD_CODE_ASSIST_OK),
      mkRes(200, GENERATE_OK),
    ])
    try {
      const client = new GoogleRESTClient()
      await client.call('q1', 'gemini-2.5-flash', {})
      // Inspect last writeFile call: the serialized creds JSON written to tmp path.
      const writeCall = vi.mocked(writeFile).mock.calls[0]
      const writtenJson = JSON.parse(String(writeCall[1])) as Record<string, unknown>
      expect(writtenJson.refresh_token).toBe('1//refresh-token-2')
      expect(writtenJson.access_token).toBe('ya29.rotated')
      expect(writtenJson.id_token).toBe('idtoken-v2')
      // Unknown field round-trip preserved (I17).
      expect(writtenJson.vendor_custom_field).toBe('preserved-value')
    } finally {
      restore()
    }
  })
})

// ── T-B8 — usageMetadata extract (AC-S15) ─────────────────────────────────

describe('§5.6.6 Step B — usageMetadata extract (AC-S15)', () => {
  it('T-B8: result.usage carries promptTokenCount/candidatesTokenCount', async () => {
    const { restore } = captureFetch([mkRes(200, LOAD_CODE_ASSIST_OK), mkRes(200, GENERATE_OK)])
    try {
      const client = new GoogleRESTClient()
      const result = await client.call('hello', 'gemini-2.5-flash', {})
      expect(result.usage).toBeDefined()
      expect(result.usage?.promptTokenCount).toBe(1)
      expect(result.usage?.candidatesTokenCount).toBe(2)
    } finally {
      restore()
    }
  })
})

// ── T-B9 — timeout AbortController (AC-S12-google) ────────────────────────

describe('§5.6.6 Step B — timeout AbortController (AC-S12-google)', () => {
  it('T-B9: external signal abort → SubscriptionFallbackError(timeout)', async () => {
    // generateContent fetch that respects the abort signal and rejects when fired.
    const original = globalThis.fetch
    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = String(url)
      if (urlStr.includes(':loadCodeAssist')) {
        return mkRes(200, LOAD_CODE_ASSIST_OK) as unknown as Response
      }
      // generateContent — wait until aborted.
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
      const client = new GoogleRESTClient()
      const pending = client.call('hello', 'gemini-2.5-flash', { signal: ac.signal })
      // Fire external abort shortly after.
      setTimeout(() => ac.abort(), 10)
      await expect(pending).rejects.toMatchObject({ reason: 'timeout' })
    } finally {
      globalThis.fetch = original
    }
  })
})

// ── T-B10 — 401-twice → auth-missing (AC-S6b) ─────────────────────────────

describe('§5.6.6 Step B — 401-twice → auth-missing (AC-S6b)', () => {
  it('T-B10: first 401 triggers refresh+retry; second 401 throws auth-missing — no infinite retry', async () => {
    const refreshedResp = {
      access_token: 'ya29.rotated',
      refresh_token: '1//refresh-token-2',
      expires_in: 3600,
      token_type: 'Bearer',
    }
    // 1) loadCodeAssist OK / 2) generateContent 401 / 3) refresh OK / 4) loadCodeAssist OK (new token) /
    // 5) generateContent 401 → escalate.
    const { calls, restore } = captureFetch([
      mkRes(200, LOAD_CODE_ASSIST_OK),
      mkRes(401, { error: 'UNAUTHENTICATED' }),
      mkRes(200, refreshedResp),
      mkRes(200, LOAD_CODE_ASSIST_OK),
      mkRes(401, { error: 'UNAUTHENTICATED' }),
    ])
    try {
      const client = new GoogleRESTClient()
      await expect(client.call('hello', 'gemini-2.5-flash', {})).rejects.toMatchObject({
        reason: 'auth-missing',
      })
      // No 6th call — bounded retry budget = 1.
      expect(calls.length).toBeLessThanOrEqual(5)
    } finally {
      restore()
    }
  })
})

// ── T-B11 — token-leak audit (AC-S19-google) ──────────────────────────────

describe('§5.6.6 Step B — token-leak audit (AC-S19-google)', () => {
  it('T-B11: no accessToken/refreshToken body emitted via console.*', async () => {
    const spies = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    }
    const { restore } = captureFetch([mkRes(200, LOAD_CODE_ASSIST_OK), mkRes(200, GENERATE_OK)])
    try {
      const client = new GoogleRESTClient()
      await client.call('hello', 'gemini-2.5-flash', {})
      const allCalls = [
        ...spies.log.mock.calls,
        ...spies.warn.mock.calls,
        ...spies.error.mock.calls,
        ...spies.debug.mock.calls,
      ]
      const secrets = ['ya29.fresh-access', '1//refresh-token-1']
      for (const args of allCalls) {
        const joined = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
        for (const s of secrets) {
          expect(joined).not.toContain(s)
        }
      }
    } finally {
      restore()
    }
  })
})
