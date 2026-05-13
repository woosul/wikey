/**
 * §5.6.4.2 Step B — Gemini subscription wiring (LLMClient.callGemini routing).
 *
 * Plan: plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md §5.3 Step B (B1~B6) +
 *       §3.3 AC-S1~S4 (Google) + §3.9 onAuthFallback wiring.
 *
 * 16 cases:
 *   1. AC-S1 subscription only `auto`             → spawn=1 / API=0
 *   2. AC-S2 API only                             → spawn=0 / API=1
 *   3. AC-S3 both registered `auto`               → spawn=1 / API=0
 *   4. AC-S4 both + subscription 401              → API fallback + onAuthFallback('quota-exceeded')
 *   5. AC-S4-quota subscription quota stderr      → API fallback + onAuthFallback('quota-exceeded')
 *   6. force-api → spawn=0 / API=1
 *   7. force-subscription + no creds              → throws (resolveAuthMode)
 *   8. spawn timeout (aborted)                    → onAuthFallback('timeout') + API fallback (auto)
 *   9. AC-S9 model option forwarded (mapOptionsToCliArgs '-m', value)
 *  10. AC-S10 jsonMode unsupported                → onAuthFallback('jsonMode-unsupported') + API
 *  11. AC-S11 temperature silent ignore           → no arg in spawn (gemini subscription)
 *  12. AC-S12 abort signal propagation            → external signal passed through opts.timeout
 *  13. core ↔ UI 결합 0                            → `from 'obsidian'` grep absent in llm-client.ts
 *  14. onAuthFallback NOT invoked on success      → spawn happy path, callback never called
 *  15. credential presence detection              → oauth_creds.json + binary both required
 *  16. CLI binary missing                         → onAuthFallback('spawn-failed') + API fallback
 */

import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LLMClient, SubscriptionFallbackError, type SubscriptionDeps } from '../llm-client.js'
import type {
  AuthFallbackInfo,
  HttpClient,
  HttpRequestOptions,
  HttpResponse,
  LLMCallOptions,
  WikeyConfig,
} from '../types.js'
import { CLI_DEFAULT_BINARY, type SpawnCliResult, type SpawnCliOptions } from '../cli-spawn.js'
import type { SubscriptionProvider } from '../types.js'

// ── fixtures ──────────────────────────────────────────────────────────────

const baseConfig: WikeyConfig = {
  WIKEY_BASIC_MODEL: 'gemini',
  WIKEY_SEARCH_BACKEND: 'basic',
  WIKEY_MODEL: 'wikey',
  WIKEY_QMD_TOP_N: 5,
  GEMINI_API_KEY: '',
  ANTHROPIC_API_KEY: '',
  OPENAI_API_KEY: '',
  OLLAMA_URL: 'http://localhost:11434',
  INGEST_PROVIDER: '',
  LINT_PROVIDER: '',
  SUMMARIZE_PROVIDER: '',
  CONTEXTUAL_MODEL: 'gemma4',
  COST_LIMIT: 50,
  GEMINI_AUTH_MODE: 'auto',
}

interface HttpCall {
  url: string
  opts: HttpRequestOptions
}

function mockHttp(body: string, status = 200): { client: HttpClient; calls: HttpCall[] } {
  const calls: HttpCall[] = []
  return {
    client: {
      async request(url: string, opts: HttpRequestOptions): Promise<HttpResponse> {
        calls.push({ url, opts })
        return { status, body }
      },
    },
    calls,
  }
}

const GEMINI_API_BODY = JSON.stringify({
  candidates: [{ content: { parts: [{ text: 'api-result' }] } }],
})

interface SpawnCall {
  provider: SubscriptionProvider
  prompt: string
  opts: SpawnCliOptions | undefined
}

interface PresenceFlags {
  oauth: boolean
  binary: boolean
}

function makeDeps(
  presence: PresenceFlags,
  spawnImpl: (call: SpawnCall) => Promise<SpawnCliResult>,
): { deps: SubscriptionDeps; spawnCalls: SpawnCall[] } {
  const spawnCalls: SpawnCall[] = []
  const fakeHome = '/fake/home'
  return {
    spawnCalls,
    deps: {
      homeDir: () => fakeHome,
      fileExists: (p: string): boolean => {
        if (p === join(fakeHome, '.gemini', 'oauth_creds.json')) return presence.oauth
        if (p === CLI_DEFAULT_BINARY.gemini) return presence.binary
        return false
      },
      spawnCliPrompt: async (provider, prompt, opts) => {
        const call: SpawnCall = { provider, prompt, opts }
        spawnCalls.push(call)
        return await spawnImpl(call)
      },
    },
  }
}

function spawnSuccess(stdout: string): (c: SpawnCall) => Promise<SpawnCliResult> {
  return async () => ({ stdout, stderr: '', exitCode: 0, aborted: false })
}

function spawnExit(exitCode: number, stderr: string): (c: SpawnCall) => Promise<SpawnCliResult> {
  return async () => ({ stdout: '', stderr, exitCode, aborted: false })
}

// ── tests ─────────────────────────────────────────────────────────────────

describe('§5.6.4.2 Step B — LLMClient.callGemini subscription routing', () => {
  it('AC-S1 — subscription only + auto → spawn=1 / API=0', async () => {
    const http = mockHttp(GEMINI_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { oauth: true, binary: true },
      spawnSuccess('Loaded cached credentials.\nhello from subscription'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig, GEMINI_API_KEY: '' }, deps)
    const result = await llm.call('q', { provider: 'gemini' })
    expect(result).toBe('hello from subscription')
    expect(spawnCalls).toHaveLength(1)
    expect(http.calls).toHaveLength(0)
  })

  it('AC-S2 — API only → spawn=0 / API=1', async () => {
    const http = mockHttp(GEMINI_API_BODY)
    const { deps, spawnCalls } = makeDeps({ oauth: false, binary: false }, spawnSuccess('unused'))
    const llm = new LLMClient(http.client, { ...baseConfig, GEMINI_API_KEY: 'k' }, deps)
    const result = await llm.call('q', { provider: 'gemini' })
    expect(result).toBe('api-result')
    expect(spawnCalls).toHaveLength(0)
    expect(http.calls).toHaveLength(1)
  })

  it('AC-S3 — both registered + auto → subscription wins (spawn=1 / API=0)', async () => {
    const http = mockHttp(GEMINI_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { oauth: true, binary: true },
      spawnSuccess('subscription wins'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig, GEMINI_API_KEY: 'k' }, deps)
    await llm.call('q', { provider: 'gemini' })
    expect(spawnCalls).toHaveLength(1)
    expect(http.calls).toHaveLength(0)
  })

  it('AC-S4 — both + subscription exit 401 → onAuthFallback("quota-exceeded") + API fallback', async () => {
    const http = mockHttp(GEMINI_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { oauth: true, binary: true },
      spawnExit(1, 'rate limit exceeded'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig, GEMINI_API_KEY: 'k' }, deps)
    const fallbacks: AuthFallbackInfo[] = []
    const result = await llm.call('q', {
      provider: 'gemini',
      onAuthFallback: (info) => fallbacks.push(info),
    })
    expect(result).toBe('api-result')
    expect(spawnCalls).toHaveLength(1)
    expect(http.calls).toHaveLength(1)
    expect(fallbacks).toHaveLength(1)
    expect(fallbacks[0]).toMatchObject({ provider: 'gemini', reason: 'quota-exceeded' })
  })

  it('AC-S4-quota — stderr "quota exceeded" → onAuthFallback("quota-exceeded") + API fallback', async () => {
    const http = mockHttp(GEMINI_API_BODY)
    const { deps } = makeDeps(
      { oauth: true, binary: true },
      spawnExit(1, 'gemini-api: quota exceeded for project xyz'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig, GEMINI_API_KEY: 'k' }, deps)
    const fallbacks: AuthFallbackInfo[] = []
    await llm.call('q', { provider: 'gemini', onAuthFallback: (i) => fallbacks.push(i) })
    expect(fallbacks[0]?.reason).toBe('quota-exceeded')
  })

  it('force-api → spawn=0 / API=1 even when subscription registered', async () => {
    const http = mockHttp(GEMINI_API_BODY)
    const { deps, spawnCalls } = makeDeps({ oauth: true, binary: true }, spawnSuccess('skipped'))
    const cfg: WikeyConfig = { ...baseConfig, GEMINI_AUTH_MODE: 'api', GEMINI_API_KEY: 'k' }
    const llm = new LLMClient(http.client, cfg, deps)
    await llm.call('q', { provider: 'gemini' })
    expect(spawnCalls).toHaveLength(0)
    expect(http.calls).toHaveLength(1)
  })

  it('force-subscription + no creds → throws (resolveAuthMode)', async () => {
    const http = mockHttp(GEMINI_API_BODY)
    const { deps } = makeDeps({ oauth: false, binary: false }, spawnSuccess('unused'))
    const cfg: WikeyConfig = { ...baseConfig, GEMINI_AUTH_MODE: 'subscription', GEMINI_API_KEY: 'k' }
    const llm = new LLMClient(http.client, cfg, deps)
    await expect(llm.call('q', { provider: 'gemini' })).rejects.toThrow(
      /No subscription credential/i,
    )
  })

  it('spawn aborted (timeout) + auto + API key → onAuthFallback("timeout") + API fallback', async () => {
    const http = mockHttp(GEMINI_API_BODY)
    const { deps } = makeDeps({ oauth: true, binary: true }, async () => ({
      stdout: '',
      stderr: '',
      exitCode: null,
      aborted: true,
    }))
    const cfg: WikeyConfig = { ...baseConfig, GEMINI_API_KEY: 'k' }
    const llm = new LLMClient(http.client, cfg, deps)
    const fallbacks: AuthFallbackInfo[] = []
    const result = await llm.call('q', {
      provider: 'gemini',
      onAuthFallback: (i) => fallbacks.push(i),
    })
    expect(result).toBe('api-result')
    expect(fallbacks[0]?.reason).toBe('timeout')
  })

  it('AC-S9 — model option forwarded as `-m <model>` in spawn extraArgs', async () => {
    const http = mockHttp(GEMINI_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { oauth: true, binary: true },
      spawnSuccess('with-model'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig }, deps)
    await llm.call('q', { provider: 'gemini', model: 'gemini-2.5-flash' })
    expect(spawnCalls[0]?.opts?.extraArgs).toEqual(['-m', 'gemini-2.5-flash'])
  })

  it('AC-S10 — jsonMode requested + auto + API key → onAuthFallback("jsonMode-unsupported") + API fallback', async () => {
    const http = mockHttp(GEMINI_API_BODY)
    const { deps, spawnCalls } = makeDeps({ oauth: true, binary: true }, spawnSuccess('skipped'))
    const cfg: WikeyConfig = { ...baseConfig, GEMINI_API_KEY: 'k' }
    const llm = new LLMClient(http.client, cfg, deps)
    const fallbacks: AuthFallbackInfo[] = []
    const result = await llm.call('q', {
      provider: 'gemini',
      jsonMode: true,
      onAuthFallback: (i) => fallbacks.push(i),
    })
    expect(result).toBe('api-result')
    // spawn never invoked because mapOptionsToCliArgs returned unsupported sentinel
    expect(spawnCalls).toHaveLength(0)
    expect(fallbacks[0]?.reason).toBe('jsonMode-unsupported')
  })

  it('AC-S11 — temperature silently ignored (no arg in extraArgs)', async () => {
    const http = mockHttp(GEMINI_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { oauth: true, binary: true },
      spawnSuccess('temp-ignored'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig }, deps)
    await llm.call('q', { provider: 'gemini', temperature: 0.7 })
    const args = spawnCalls[0]?.opts?.extraArgs ?? []
    expect(args.find((a) => a.includes('temp'))).toBeUndefined()
    expect(args).toEqual([]) // no model + no temp → empty args
  })

  it('AC-S12 — opts.timeout forwarded to spawn (timeoutMs)', async () => {
    const http = mockHttp(GEMINI_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { oauth: true, binary: true },
      spawnSuccess('with-timeout'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig }, deps)
    await llm.call('q', { provider: 'gemini', timeout: 12345 })
    expect(spawnCalls[0]?.opts?.timeoutMs).toBe(12345)
  })

  it('core ↔ UI 결합 0 — llm-client.ts contains no `from "obsidian"` import', () => {
    // Grep guard so future edits cannot accidentally pull `Notice` / `Modal` from obsidian
    // into wikey-core. The plugin layer (main.ts) owns Notice surfacing via onAuthFallback.
    const src = readFileSync(join(__dirname, '..', 'llm-client.ts'), 'utf-8')
    expect(src).not.toMatch(/from\s+['"]obsidian['"]/)
    // Match `new Notice(` / `: Notice ` patterns (actual API usage); JSDoc prose "Notice"
    // is tolerated. The plugin's main.ts is the sole Notice surface.
    expect(src).not.toMatch(/\bnew\s+Notice\s*\(/)
  })

  it('onAuthFallback NOT invoked on success', async () => {
    const http = mockHttp(GEMINI_API_BODY)
    const { deps } = makeDeps({ oauth: true, binary: true }, spawnSuccess('clean response'))
    const llm = new LLMClient(http.client, { ...baseConfig, GEMINI_API_KEY: 'k' }, deps)
    const fallbacks: AuthFallbackInfo[] = []
    const result = await llm.call('q', {
      provider: 'gemini',
      onAuthFallback: (i) => fallbacks.push(i),
    })
    expect(result).toBe('clean response')
    expect(fallbacks).toHaveLength(0)
  })

  it('checkGeminiPresence — oauth + binary both required', async () => {
    const http = mockHttp(GEMINI_API_BODY)
    // oauth only (binary missing) → hasSubscription=false → falls to API path
    const { deps: oauthOnly, spawnCalls: callsA } = makeDeps(
      { oauth: true, binary: false },
      spawnSuccess('unused'),
    )
    const llmA = new LLMClient(http.client, { ...baseConfig, GEMINI_API_KEY: 'k' }, oauthOnly)
    expect(llmA.checkGeminiPresence()).toEqual({ hasSubscription: false, hasApiKey: true })
    await llmA.call('q', { provider: 'gemini' })
    expect(callsA).toHaveLength(0)

    // binary only (oauth missing) → hasSubscription=false
    const { deps: binOnly } = makeDeps({ oauth: false, binary: true }, spawnSuccess('unused'))
    const llmB = new LLMClient(http.client, { ...baseConfig, GEMINI_API_KEY: 'k' }, binOnly)
    expect(llmB.checkGeminiPresence()).toEqual({ hasSubscription: false, hasApiKey: true })

    // both present → hasSubscription=true
    const { deps: both } = makeDeps({ oauth: true, binary: true }, spawnSuccess('unused'))
    const llmC = new LLMClient(http.client, { ...baseConfig }, both)
    expect(llmC.checkGeminiPresence()).toEqual({ hasSubscription: true, hasApiKey: false })
  })

  it('CLI binary missing (spawn ENOENT) → onAuthFallback("spawn-failed") + API fallback', async () => {
    const http = mockHttp(GEMINI_API_BODY)
    // Force binary presence true so resolveAuthMode picks subscription, then spawn throws ENOENT.
    const { deps } = makeDeps({ oauth: true, binary: true }, async () => {
      const err = new Error('spawn ENOENT') as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    })
    const cfg: WikeyConfig = { ...baseConfig, GEMINI_API_KEY: 'k' }
    const llm = new LLMClient(http.client, cfg, deps)
    const fallbacks: AuthFallbackInfo[] = []
    const result = await llm.call('q', {
      provider: 'gemini',
      onAuthFallback: (i) => fallbacks.push(i),
    })
    expect(result).toBe('api-result')
    expect(fallbacks[0]?.reason).toBe('spawn-failed')
  })
})

describe('§5.6.4.2 Step B — SubscriptionFallbackError shape', () => {
  it('carries reason + message + optional cause', () => {
    const cause = new Error('underlying')
    const err = new SubscriptionFallbackError('timeout', 'wrap', cause)
    expect(err.reason).toBe('timeout')
    expect(err.message).toBe('wrap')
    expect(err.cause).toBe(cause)
    expect(err.name).toBe('SubscriptionFallbackError')
  })
})

// Suppress unused import warning for type-only types referenced in JSDoc.
const _types: LLMCallOptions = {}
void _types
