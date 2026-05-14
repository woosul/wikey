/**
 * §5.6.6 Step D — Anthropic REST client tests (T-D1 ~ T-D15).
 *
 * Spec / Todox reference:
 *   - phase-5-spec-5.6.6-subscription-rest.md §1.5 AC-S3/S6c/S7/S8/S10/
 *     S12-anthropic/S13/S14/S15/S19-anthropic/S22 + §2 R3/R10
 *   - phase-5-todox-5.6.6-subscription-rest.md §4 (T-D1 ~ T-D15)
 *   - docs/spikes/phase-5/5.6.6/poc-anthropic.mjs (canonical PoC)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// ── module-level mocks ────────────────────────────────────────────────────
// execFileSync drives Keychain read/write deterministically; userInfo()
// stabilises the `-a $USER` argv across CI / local envs.
vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}))
vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os')
  return { ...actual, userInfo: vi.fn(() => ({ username: 'tester', uid: 501, gid: 20, shell: null, homedir: '/Users/tester' })) }
})

import { execFileSync } from 'node:child_process'
import { SubscriptionFallbackError, __resetRefreshCache } from '../subscription-rest-shared.js'

// ── platform stubbing helper (T-D12) ───────────────────────────────────────
//
// `process.platform` is a getter — we use Object.defineProperty with
// `configurable: true` and restore in afterEach via savePlatform/restorePlatform.

let savedPlatform: PropertyDescriptor | undefined
function stubPlatform(value: NodeJS.Platform): void {
  savedPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
  Object.defineProperty(process, 'platform', { value, configurable: true, writable: false })
}
function restorePlatform(): void {
  if (savedPlatform) {
    Object.defineProperty(process, 'platform', savedPlatform)
    savedPlatform = undefined
  }
}

// ── Keychain JSON fixtures ────────────────────────────────────────────────

function makeKeychainJSON(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    claudeAiOauth: {
      accessToken: 'sk-ant-fresh-access',
      refreshToken: 'sk-ant-refresh-1',
      expiresAt: Date.now() + 60 * 60_000, // 1h from now
      scopes: ['user:inference'],
      subscriptionType: 'max',
      rateLimitTier: 'standard',
      ...overrides,
    },
  })
}

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

interface FetchCall { url: string; init: RequestInit }

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

// Default messages 200 response body.
const MESSAGES_OK = {
  id: 'msg_01',
  model: 'claude-sonnet-4-5',
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: 'hello world' }],
  usage: { input_tokens: 5, output_tokens: 3, service_tier: 'standard' },
}

// ── lifecycle ─────────────────────────────────────────────────────────────

beforeEach(() => {
  __resetRefreshCache()
  // Default: macOS, Keychain returns fresh creds, write succeeds.
  stubPlatform('darwin')
  const m = vi.mocked(execFileSync)
  m.mockReset()
  m.mockImplementation((cmd, args) => {
    const a = args as readonly string[]
    if (cmd === 'security' && a?.[0] === 'find-generic-password') {
      return makeKeychainJSON()
    }
    if (cmd === 'security' && a?.[0] === 'add-generic-password') {
      return Buffer.from('')
    }
    return Buffer.from('')
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  restorePlatform()
})

// Lazy import so the platform stub applies before module evaluation in T-D12.
async function importClient(): Promise<typeof import('../anthropic-rest-client.js')> {
  return import('../anthropic-rest-client.js')
}

// ── T-D1 — Keychain happy path (AC-S3) ────────────────────────────────────

describe('§5.6.6 Step D — Keychain happy path (AC-S3)', () => {
  it('T-D1: Keychain JSON loaded → messages OK → text returned', async () => {
    const { restore } = captureFetch([mkRes(200, MESSAGES_OK)])
    try {
      const { AnthropicRESTClient } = await importClient()
      const client = new AnthropicRESTClient()
      const result = await client.call('hi', 'claude-sonnet-4-5', {})
      expect(result.text).toBe('hello world')
      expect(result.model).toBe('claude-sonnet-4-5')
      expect(typeof result.latencyMs).toBe('number')
    } finally { restore() }
  })
})

// ── T-D2 — token refresh + Keychain write-back (AC-S7) ────────────────────

describe('§5.6.6 Step D — token refresh + Keychain write-back (AC-S7)', () => {
  it('T-D2: expiry within 60s → refresh + security add-generic-password -U', async () => {
    const expiringJSON = makeKeychainJSON({ expiresAt: Date.now() + 30_000 })
    vi.mocked(execFileSync).mockImplementationOnce(() => expiringJSON)
    const refreshedResp = {
      access_token: 'sk-ant-fresh-access-rotated',
      refresh_token: 'sk-ant-refresh-2',
      expires_in: 3600,
    }
    const { calls, restore } = captureFetch([
      mkRes(200, refreshedResp),
      mkRes(200, MESSAGES_OK),
    ])
    try {
      const { AnthropicRESTClient } = await importClient()
      const client = new AnthropicRESTClient()
      await client.call('hi', 'claude-sonnet-4-5', {})
      // call 1: refresh / call 2: messages
      expect(calls).toHaveLength(2)
      expect(calls[0].url).toBe('https://console.anthropic.com/v1/oauth/token')
      expect(calls[1].url).toBe('https://api.anthropic.com/v1/messages')
      // Keychain write — single `add-generic-password -U` (atomic).
      const writeCalls = vi.mocked(execFileSync).mock.calls.filter(
        (c) => (c[1] as readonly string[])?.[0] === 'add-generic-password',
      )
      expect(writeCalls).toHaveLength(1)
      expect(writeCalls[0][1] as readonly string[]).toContain('-U')
      expect(writeCalls[0][1] as readonly string[]).toContain('-s')
      expect(writeCalls[0][1] as readonly string[]).toContain('Claude Code-credentials')
    } finally { restore() }
  })
})

// ── T-D3 — refresh itself 401 → auth-missing (AC-S8) ──────────────────────

describe('§5.6.6 Step D — refresh itself 401 → auth-missing (AC-S8)', () => {
  it('T-D3: refresh response 401 → SubscriptionFallbackError(auth-missing), no infinite retry', async () => {
    const expiringJSON = makeKeychainJSON({ expiresAt: Date.now() + 30_000 })
    vi.mocked(execFileSync).mockImplementationOnce(() => expiringJSON)
    const { calls, restore } = captureFetch([
      mkRes(401, { error: 'invalid_grant' }),
    ])
    try {
      const { AnthropicRESTClient } = await importClient()
      const client = new AnthropicRESTClient()
      await expect(client.call('hi', 'claude-sonnet-4-5', {}))
        .rejects.toMatchObject({ reason: 'auth-missing' })
      // Exactly one refresh attempt — no infinite retry.
      expect(calls).toHaveLength(1)
    } finally { restore() }
  })
})

// ── T-D4 — Keychain entry not found ───────────────────────────────────────

describe('§5.6.6 Step D — Keychain entry not found', () => {
  it('T-D4: security find exit 1 → SubscriptionFallbackError(auth-missing)', async () => {
    vi.mocked(execFileSync).mockImplementationOnce(() => {
      const err = new Error('security: SecKeychainSearchCopyNext: The specified item could not be found in the keychain.') as Error & { status?: number }
      err.status = 1
      throw err
    })
    const { AnthropicRESTClient } = await importClient()
    const client = new AnthropicRESTClient()
    await expect(client.call('hi', 'claude-sonnet-4-5', {}))
      .rejects.toMatchObject({ reason: 'auth-missing' })
  })
})

// ── T-D5 — anthropic-beta + version + Bearer headers ──────────────────────

describe('§5.6.6 Step D — fetch headers verbatim', () => {
  it('T-D5: anthropic-beta=oauth-2025-04-20 + anthropic-version=2023-06-01 + Bearer <token>', async () => {
    const { calls, restore } = captureFetch([mkRes(200, MESSAGES_OK)])
    try {
      const { AnthropicRESTClient } = await importClient()
      const client = new AnthropicRESTClient()
      await client.call('hi', 'claude-sonnet-4-5', {})
      const headers = calls[0].init.headers as Record<string, string>
      expect(headers['anthropic-beta']).toBe('oauth-2025-04-20')
      expect(headers['anthropic-version']).toBe('2023-06-01')
      expect(headers.Authorization).toBe('Bearer sk-ant-fresh-access')
      expect(headers['Content-Type']).toBe('application/json')
    } finally { restore() }
  })
})

// ── T-D6 — transport-level tool field absence (AC-S13) ────────────────────

describe('§5.6.6 Step D — transport-level tool field absence (AC-S13)', () => {
  it('T-D6: request body has no `tools` field; response content has no `tool_use` type', async () => {
    const responseWithoutToolUse = {
      ...MESSAGES_OK,
      content: [{ type: 'text', text: 'plain answer' }],
    }
    const { calls, restore } = captureFetch([mkRes(200, responseWithoutToolUse)])
    try {
      const { AnthropicRESTClient } = await importClient()
      const client = new AnthropicRESTClient()
      const result = await client.call('hi', 'claude-sonnet-4-5', {})
      // Schema field check (AC-S13 transport-level, no raw substring grep).
      const body = JSON.parse(String(calls[0].init.body)) as Record<string, unknown>
      expect(Object.keys(body).includes('tools')).toBe(false)
      expect(Object.keys(body).includes('tool_choice')).toBe(false)
      // Response content has no tool_use type.
      expect(result.text).toBe('plain answer')
    } finally { restore() }
  })
})

// ── T-D7 — token-leak audit (I10 / AC-S19-anthropic) ──────────────────────

describe('§5.6.6 Step D — token-leak audit (I10 + AC-S19-anthropic)', () => {
  it('T-D7: no accessToken/refreshToken body emitted via console.*', async () => {
    const spies = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    }
    const { restore } = captureFetch([mkRes(200, MESSAGES_OK)])
    try {
      const { AnthropicRESTClient } = await importClient()
      const client = new AnthropicRESTClient()
      await client.call('hi', 'claude-sonnet-4-5', {})
      const allCalls = [
        ...spies.log.mock.calls,
        ...spies.warn.mock.calls,
        ...spies.error.mock.calls,
        ...spies.debug.mock.calls,
      ]
      const secrets = ['sk-ant-fresh-access', 'sk-ant-refresh-1']
      for (const args of allCalls) {
        const joined = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
        for (const s of secrets) expect(joined).not.toContain(s)
      }
    } finally { restore() }
  })
})

// ── T-D8 — refresh rotation + unknown field round-trip (AC-S22) ───────────

describe('§5.6.6 Step D — refresh rotation + round-trip (AC-S22)', () => {
  it('T-D8: rotated refresh_token + unknown fields preserved in Keychain write-back', async () => {
    const initialKeychain = JSON.stringify({
      claudeAiOauth: {
        accessToken: 'sk-ant-fresh-access',
        refreshToken: 'sk-ant-refresh-1',
        expiresAt: Date.now() + 30_000,
        scopes: ['user:inference'],
        subscriptionType: 'max',
        rateLimitTier: 'standard',
        custom_inner_field: 'inner-preserved',
      },
      vendor_top_field: 'top-preserved',
    })
    vi.mocked(execFileSync).mockImplementationOnce(() => initialKeychain)
    const refreshedResp = {
      access_token: 'sk-ant-fresh-access-rotated',
      refresh_token: 'sk-ant-refresh-2', // ROTATED
      expires_in: 3600,
    }
    const { restore } = captureFetch([
      mkRes(200, refreshedResp),
      mkRes(200, MESSAGES_OK),
    ])
    try {
      const { AnthropicRESTClient } = await importClient()
      const client = new AnthropicRESTClient()
      await client.call('hi', 'claude-sonnet-4-5', {})
      const writeCall = vi.mocked(execFileSync).mock.calls.find(
        (c) => (c[1] as readonly string[])?.[0] === 'add-generic-password',
      )
      expect(writeCall).toBeDefined()
      const argv = writeCall![1] as readonly string[]
      const wIdx = argv.indexOf('-w')
      const writtenJSON = argv[wIdx + 1]
      const written = JSON.parse(writtenJSON) as Record<string, unknown>
      const oauth = written.claudeAiOauth as Record<string, unknown>
      expect(oauth.accessToken).toBe('sk-ant-fresh-access-rotated')
      expect(oauth.refreshToken).toBe('sk-ant-refresh-2')
      // Round-trip preservation (I17).
      expect(oauth.subscriptionType).toBe('max')
      expect(oauth.rateLimitTier).toBe('standard')
      expect(oauth.custom_inner_field).toBe('inner-preserved')
      expect(written.vendor_top_field).toBe('top-preserved')
    } finally { restore() }
  })
})

// ── T-D9 — 429 → quota-exceeded (AC-S10) ──────────────────────────────────

describe('§5.6.6 Step D — 429 quota-exceeded (AC-S10)', () => {
  it('T-D9: 429 from /v1/messages → SubscriptionFallbackError(quota-exceeded)', async () => {
    const { restore } = captureFetch([mkRes(429, { error: 'rate_limit' })])
    try {
      const { AnthropicRESTClient } = await importClient()
      const client = new AnthropicRESTClient()
      await expect(client.call('hi', 'claude-sonnet-4-5', {}))
        .rejects.toMatchObject({ reason: 'quota-exceeded' })
    } finally { restore() }
  })
})

// ── T-D10 — ANTHROPIC_API_KEY untouched (AC-S14) ──────────────────────────

describe('§5.6.6 Step D — API key access 0 (AC-S14)', () => {
  it('T-D10: anthropic-rest-client.ts source never reads process.env.{ANTHROPIC,OPENAI,GEMINI}_API_KEY', async () => {
    const { readFile: realReadFile } = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises')
    const path = await import('node:path')
    const url = await import('node:url')
    const here = path.dirname(url.fileURLToPath(import.meta.url))
    const src = await realReadFile(path.join(here, '..', 'anthropic-rest-client.ts'), 'utf-8')
    expect(src).not.toMatch(/process\.env\.ANTHROPIC_API_KEY/)
    expect(src).not.toMatch(/process\.env\.OPENAI_API_KEY/)
    expect(src).not.toMatch(/process\.env\.GEMINI_API_KEY/)
  })
})

// ── T-D11 — usage field precise extraction (AC-S15) ───────────────────────

describe('§5.6.6 Step D — usage field precise extract (AC-S15)', () => {
  it('T-D11: usage.input_tokens / output_tokens / service_tier readable', async () => {
    const body = {
      ...MESSAGES_OK,
      usage: {
        input_tokens: 42,
        output_tokens: 17,
        service_tier: 'standard',
        cache_creation_input_tokens: 0,
      },
    }
    const { restore } = captureFetch([mkRes(200, body)])
    try {
      const { AnthropicRESTClient } = await importClient()
      const client = new AnthropicRESTClient()
      const result = await client.call('hi', 'claude-sonnet-4-5', {})
      expect(result.usage?.input_tokens).toBe(42)
      expect(result.usage?.output_tokens).toBe(17)
      expect(result.usage?.service_tier).toBe('standard')
    } finally { restore() }
  })
})

// ── T-D12 — R10 macOS-only constructor check ──────────────────────────────

describe('§5.6.6 Step D — R10 macOS-only constructor check', () => {
  it('T-D12: process.platform !== "darwin" → SubscriptionFallbackError(spawn-failed)', async () => {
    stubPlatform('linux')
    const { AnthropicRESTClient } = await importClient()
    // Shape-based assertion (not `toThrow(class)` — vi.resetModules in sibling
    // tests can yield a different class realm; we verify name + reason + msg).
    let caught: unknown
    try { new AnthropicRESTClient() } catch (err) { caught = err }
    expect(caught).toBeDefined()
    const e = caught as { name?: string; reason?: string; message?: string }
    expect(e.name).toBe('SubscriptionFallbackError')
    expect(e.reason).toBe('spawn-failed')
    expect(e.message).toMatch(/macOS Keychain/)
    expect(e.message).toMatch(/cli mode/)
  })

  it('T-D12b: process.platform=win32 → same SubscriptionFallbackError', async () => {
    stubPlatform('win32')
    const { AnthropicRESTClient } = await importClient()
    let caught: unknown
    try { new AnthropicRESTClient() } catch (err) { caught = err }
    expect(caught).toBeDefined()
    const e = caught as { name?: string; reason?: string }
    expect(e.name).toBe('SubscriptionFallbackError')
    expect(e.reason).toBe('spawn-failed')
  })
})

// ── T-D13 — timeout AbortController (AC-S12-anthropic) ────────────────────

describe('§5.6.6 Step D — timeout AbortController (AC-S12-anthropic)', () => {
  it('T-D13: external signal abort during fetch → SubscriptionFallbackError(timeout)', async () => {
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
      const { AnthropicRESTClient } = await importClient()
      const client = new AnthropicRESTClient()
      const pending = client.call('hi', 'claude-sonnet-4-5', { signal: ac.signal })
      setTimeout(() => ac.abort(), 10)
      await expect(pending).rejects.toMatchObject({ reason: 'timeout' })
    } finally { globalThis.fetch = original }
  })
})

// ── T-D14 — 401-twice → auth-missing, atomic Keychain write (AC-S6c) ──────

describe('§5.6.6 Step D — 401-twice → auth-missing (AC-S6c)', () => {
  it('T-D14: first 401 → force refresh → second 401 → auth-missing, no infinite retry, Keychain write atomic', async () => {
    const refreshedResp = {
      access_token: 'sk-ant-fresh-access-rotated',
      refresh_token: 'sk-ant-refresh-2',
      expires_in: 3600,
    }
    const { calls, restore } = captureFetch([
      mkRes(401, {}),                 // messages 1st 401
      mkRes(200, refreshedResp),      // refresh OK
      mkRes(401, {}),                 // messages 2nd 401 → throw
    ])
    try {
      const { AnthropicRESTClient } = await importClient()
      const client = new AnthropicRESTClient()
      await expect(client.call('hi', 'claude-sonnet-4-5', {}))
        .rejects.toMatchObject({ reason: 'auth-missing' })
      // Exactly 3 fetch calls: messages / refresh / messages-retry. No 4th.
      expect(calls).toHaveLength(3)
      // Keychain write happened exactly once (single `-U`, atomic — AC-S6c / I17).
      const writeCalls = vi.mocked(execFileSync).mock.calls.filter(
        (c) => (c[1] as readonly string[])?.[0] === 'add-generic-password',
      )
      expect(writeCalls).toHaveLength(1)
      expect(writeCalls[0][1] as readonly string[]).toContain('-U')
    } finally { restore() }
  })
})

// ── T-D15 — token-leak audit, stdout/stderr (AC-S19-anthropic strict) ─────

describe('§5.6.6 Step D — stdout/stderr token-leak audit (AC-S19-anthropic)', () => {
  it('T-D15: refresh + write cycle emits no accessToken/refreshToken via console.*', async () => {
    const expiringJSON = makeKeychainJSON({ expiresAt: Date.now() + 30_000 })
    vi.mocked(execFileSync).mockImplementationOnce(() => expiringJSON)
    const spies = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    }
    const refreshedResp = {
      access_token: 'sk-ant-fresh-access-rotated',
      refresh_token: 'sk-ant-refresh-2',
      expires_in: 3600,
    }
    const { restore } = captureFetch([
      mkRes(200, refreshedResp),
      mkRes(200, MESSAGES_OK),
    ])
    try {
      const { AnthropicRESTClient } = await importClient()
      const client = new AnthropicRESTClient()
      await client.call('hi', 'claude-sonnet-4-5', {})
      const allCalls = [
        ...spies.log.mock.calls,
        ...spies.warn.mock.calls,
        ...spies.error.mock.calls,
        ...spies.debug.mock.calls,
      ]
      const secrets = [
        'sk-ant-fresh-access', 'sk-ant-fresh-access-rotated',
        'sk-ant-refresh-1', 'sk-ant-refresh-2',
      ]
      for (const args of allCalls) {
        const joined = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
        for (const s of secrets) expect(joined).not.toContain(s)
      }
    } finally { restore() }
  })
})
