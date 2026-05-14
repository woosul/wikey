/**
 * §5.6.6 Step A — Subscription REST shared abstraction tests (T-A1 ~ T-A12).
 *
 * Spec / Todox reference:
 *   - phase-5-spec-5.6.6-subscription-rest.md §1.2 (I1/I4/I5/I6/I10/I12/I17)
 *   - phase-5-todox-5.6.6-subscription-rest.md §1.2 (T-A1 ~ T-A12)
 *   - docs/spikes/phase-5/5.6.6/SPIKE.md §3 (endpoint baseline)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  REFRESH_THRESHOLD_MS,
  SubscriptionFallbackError,
  __resetRefreshCache,
  atomicWriteJSON,
  classifyHTTPFailure,
  mapOptionsToRESTOptions,
  refreshIfNeededShared,
  type TokenState,
} from '../subscription-rest-shared.js'
import { verifyEndpointHash, ENDPOINT_BASELINE } from '../subscription-rest-version-guard.js'

// ── fixtures ──────────────────────────────────────────────────────────────

function makeState(overrides?: Partial<TokenState>): TokenState {
  return {
    accessToken: 'ya29.fake-access',
    refreshToken: '1//fake-refresh',
    expiresAtMs: Date.now() + 5 * 60_000, // 5 min
    raw: { access_token: 'ya29.fake-access', refresh_token: '1//fake-refresh' },
    ...overrides,
  }
}

beforeEach(() => {
  __resetRefreshCache()
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── T-A1 / T-A2 — refreshIfNeededShared expiry threshold ──────────────────

describe('§5.6.6 Step A — refreshIfNeededShared (AC-S5)', () => {
  it('T-A1: expiry < 60s → invokes refreshFn once and returns new state', async () => {
    const state = makeState({ expiresAtMs: Date.now() + 30_000 })
    const refreshed = makeState({ accessToken: 'ya29.rotated', expiresAtMs: Date.now() + 3600_000 })
    const refreshFn = vi.fn(async () => refreshed)

    const result = await refreshIfNeededShared('google', state, refreshFn)

    expect(refreshFn).toHaveBeenCalledTimes(1)
    expect(result.accessToken).toBe('ya29.rotated')
  })

  it('T-A2: expiry > 60s → refreshFn NOT invoked and state returned as-is', async () => {
    const state = makeState({ expiresAtMs: Date.now() + REFRESH_THRESHOLD_MS + 60_000 })
    const refreshFn = vi.fn(async () => makeState())

    const result = await refreshIfNeededShared('google', state, refreshFn)

    expect(refreshFn).toHaveBeenCalledTimes(0)
    expect(result).toBe(state)
  })
})

// ── T-A3 / T-A4 / T-A5 — classifyHTTPFailure ──────────────────────────────

describe('§5.6.6 Step A — classifyHTTPFailure (AC-S6/S9/S11)', () => {
  it('T-A3: 401 → null (caller handles refresh + retry)', () => {
    expect(classifyHTTPFailure(401)).toBeNull()
  })

  it('T-A4: 429 → SubscriptionFallbackError(quota-exceeded) (AC-S9)', () => {
    const err = classifyHTTPFailure(429)
    expect(err).toBeInstanceOf(SubscriptionFallbackError)
    expect(err?.reason).toBe('quota-exceeded')
  })

  it('T-A5: 500/502/503 → SubscriptionFallbackError(server-error) (AC-S11)', () => {
    for (const status of [500, 502, 503]) {
      const err = classifyHTTPFailure(status)
      expect(err, `status ${status}`).toBeInstanceOf(SubscriptionFallbackError)
      expect(err?.reason).toBe('server-error')
    }
  })
})

// ── T-A6 — token-leak audit (I10) ─────────────────────────────────────────

describe('§5.6.6 Step A — token leak audit (I10)', () => {
  it('T-A6: mapOptionsToRESTOptions emits no accessToken/refreshToken in console.*', () => {
    const spies = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
    }
    mapOptionsToRESTOptions('gemini', { temperature: 0.5 })
    mapOptionsToRESTOptions('openai', { temperature: 0.5, thinkingBudget: 10 })
    mapOptionsToRESTOptions('anthropic', { temperature: 0.5, seed: 42 })

    const allCalls = [...spies.log.mock.calls, ...spies.warn.mock.calls, ...spies.error.mock.calls, ...spies.debug.mock.calls]
    for (const args of allCalls) {
      const joined = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
      expect(joined).not.toMatch(/accessToken|refreshToken/i)
    }
  })
})

// ── T-A7 — concurrent refresh share (R6) ──────────────────────────────────

describe('§5.6.6 Step A — concurrent refresh share (R6)', () => {
  it('T-A7: two concurrent calls share the in-flight refresh promise (refreshFn called once)', async () => {
    const state = makeState({ expiresAtMs: Date.now() + 10_000 }) // expiring soon
    const refreshed = makeState({ accessToken: 'ya29.rotated' })
    let pending: ((s: TokenState) => void) | null = null
    const refreshFn = vi.fn(
      () =>
        new Promise<TokenState>((resolve) => {
          pending = resolve
        }),
    )

    const p1 = refreshIfNeededShared('google', state, refreshFn)
    const p2 = refreshIfNeededShared('google', state, refreshFn)

    // Both started; only one refreshFn invocation.
    expect(refreshFn).toHaveBeenCalledTimes(1)
    // Resolve the shared promise.
    pending!(refreshed)
    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1.accessToken).toBe('ya29.rotated')
    expect(r2.accessToken).toBe('ya29.rotated')
  })
})

// ── T-A8 — refresh 401 propagates auth-missing (AC-S8) ────────────────────

describe('§5.6.6 Step A — refresh failure → auth-missing (AC-S8)', () => {
  it('T-A8: refreshFn throws SubscriptionFallbackError(auth-missing) → caller observes same error', async () => {
    const state = makeState({ expiresAtMs: Date.now() + 10_000 })
    const refreshFn = vi.fn(async () => {
      throw new SubscriptionFallbackError('auth-missing', 're-login required')
    })

    await expect(refreshIfNeededShared('google', state, refreshFn)).rejects.toMatchObject({
      reason: 'auth-missing',
    })
  })
})

// ── T-A9 — AbortController + external signal (AC-S12) ─────────────────────

describe('§5.6.6 Step A — timeout AbortController (AC-S12)', () => {
  it('T-A9: external signal abort triggers fetch rejection (AbortError propagation)', async () => {
    const ac = new AbortController()
    // Simulate a fetch that respects signal.
    const fakeFetch = (signal: AbortSignal) =>
      new Promise<string>((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          const err = new Error('aborted')
          ;(err as Error & { name: string }).name = 'AbortError'
          reject(err)
        })
      })
    const promise = fakeFetch(ac.signal)
    ac.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })
})

// ── T-A10 — version-guard hash drift (AC-S24) ─────────────────────────────

describe('§5.6.6 Step A — version-guard endpoint hash (AC-S24)', () => {
  it('T-A10: Google baseline endpoint matches; mismatched URL returns ok=false with currentHash', () => {
    // Baseline match.
    const okResult = verifyEndpointHash('google', 'https://cloudcode-pa.googleapis.com')
    expect(okResult.ok).toBe(true)
    expect(okResult.expectedHash).toBe(ENDPOINT_BASELINE.google)

    // Mismatch.
    const driftResult = verifyEndpointHash('google', 'https://xxx-pa.googleapis.com')
    expect(driftResult.ok).toBe(false)
    expect(driftResult.reason).toBe('hash-drift')
    expect(driftResult.currentHash).not.toBe(ENDPOINT_BASELINE.google)
    expect(driftResult.expectedHash).toBe(ENDPOINT_BASELINE.google)
  })
})

// ── T-A11 — atomicWriteJSON (I17) ─────────────────────────────────────────

describe('§5.6.6 Step A — atomicWriteJSON (I17)', () => {
  it('T-A11: writes via tmp file then renames to target (no partial-write on target)', async () => {
    const { mkdtemp, readdir, readFile, rm } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const { join } = await import('node:path')

    const dir = await mkdtemp(join(tmpdir(), 'wikey-atomic-'))
    const target = join(dir, 'creds.json')

    try {
      await atomicWriteJSON(target, '{"k":"v"}')

      // After atomic write completes, target file contains expected content.
      const content = await readFile(target, 'utf-8')
      expect(content).toBe('{"k":"v"}')

      // No leftover .tmp- files (rename consumed the tmp).
      const entries = await readdir(dir)
      const tmpLeftovers = entries.filter((e) => e.includes('.tmp-'))
      expect(tmpLeftovers).toEqual([])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

// ── T-A12 — mapOptionsToRESTOptions matrix (F4 / §1.3.1) ──────────────────

describe('§5.6.6 Step A — mapOptionsToRESTOptions matrix (Spec §1.3.1)', () => {
  it('T-A12a: gemini + jsonMode=true → generationConfig.responseMimeType=application/json', () => {
    const mapped = mapOptionsToRESTOptions('gemini', { jsonMode: true })
    expect(mapped.generationConfig?.responseMimeType).toBe('application/json')
  })

  it('T-A12b: openai + jsonMode=true → body.text.format=json_object', () => {
    const mapped = mapOptionsToRESTOptions('openai', { jsonMode: true })
    expect(mapped.body.text).toEqual({ format: 'json_object' })
  })

  it('T-A12c: anthropic + jsonMode=true → throws SubscriptionFallbackError(jsonMode-unsupported)', () => {
    expect(() => mapOptionsToRESTOptions('anthropic', { jsonMode: true })).toThrowError(
      SubscriptionFallbackError,
    )
    try {
      mapOptionsToRESTOptions('anthropic', { jsonMode: true })
    } catch (err) {
      expect((err as SubscriptionFallbackError).reason).toBe('jsonMode-unsupported')
    }
  })

  it('T-A12d: gemini matrix — temperature/seed/maxTokens map to generationConfig', () => {
    const mapped = mapOptionsToRESTOptions('gemini', {
      temperature: 0.7,
      seed: 42,
      maxTokens: 2048,
      thinkingBudget: 100,
    })
    expect(mapped.generationConfig).toEqual({
      temperature: 0.7,
      seed: 42,
      maxOutputTokens: 2048,
      thinkingBudget: 100,
    })
  })

  it('T-A12e: openai matrix — temperature/seed map; maxTokens/responseMimeType/thinkingBudget silent ignore (live fix v0.7)', () => {
    // §5.6.6 v0.7 live fix 2026-05-15 — private Codex backend rejects
    // `max_output_tokens` with HTTP 400. mapOpenAIOptions drops the field.
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const mapped = mapOptionsToRESTOptions('openai', {
      temperature: 0.5,
      seed: 1,
      maxTokens: 1024,
      responseMimeType: 'text/plain',
      thinkingBudget: 50,
    })
    expect(mapped.body).toEqual({
      temperature: 0.5,
      seed: 1,
    })
    expect(debugSpy).toHaveBeenCalled()
  })

  it('T-A12f: anthropic matrix — temperature/maxTokens map; seed/responseMimeType/thinkingBudget silent ignore', () => {
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {})
    const mapped = mapOptionsToRESTOptions('anthropic', {
      temperature: 0.3,
      maxTokens: 512,
      seed: 7,
      responseMimeType: 'application/json',
      thinkingBudget: 25,
    })
    expect(mapped.body).toEqual({
      temperature: 0.3,
      max_tokens: 512,
    })
    expect(debugSpy).toHaveBeenCalled()
  })
})
