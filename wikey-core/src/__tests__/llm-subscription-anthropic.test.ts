/**
 * §5.6.4.3 Step C — Anthropic Claude subscription wiring (LLMClient.callAnthropic routing).
 *
 * Plan: plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md §5.4 Step C +
 *       §3.3 AC-S5 (Anthropic) + §3.9 onAuthFallback wiring.
 *
 * Mirror of llm-subscription-gemini.test.ts (provider='anthropic').
 *
 * Key Anthropic-specific differences vs Gemini:
 *   - presence detection = CLI binary existence only (no oauth_creds file —
 *     claude CLI stores tokens in macOS Keychain, inaccessible to fs.existsSync).
 *     `hasSubscription` therefore equals "binary present"; first-call 401 ↔
 *     "Please login" stderr is the runtime signal for missing subscription.
 *   - CLI base argv = ['-p'] (claude reads prompt from stdin)
 *   - subscription model flag = '--model <id>' (double-dash long form)
 *   - parseSubscriptionOutput('anthropic', raw) = raw.trim() (no header strip)
 *
 * 16 cases:
 *   1. AC-S5 subscription only `auto`             → spawn=1 / API=0
 *   2. AC-S5-api-only API only                    → spawn=0 / API=1
 *   3. AC-S5-both-auto both + auto                → spawn=1 / API=0
 *   4. AC-S5-quota subscription exit-1 + stderr quota → API fallback + onAuthFallback
 *   5. AC-S5-not-logged-in subscription stderr "Please login" → onAuthFallback('auth-missing')
 *   6. force-api → spawn=0 / API=1
 *   7. force-subscription + no binary             → throws (resolveAuthMode)
 *   8. spawn timeout (aborted)                    → onAuthFallback('timeout') + API fallback
 *   9. AC-S9 model option forwarded as --model <id>
 *  10. AC-S10 jsonMode unsupported                → onAuthFallback('jsonMode-unsupported') + API
 *  11. AC-S11 temperature silent ignore in CLI args (Anthropic API path supports natively)
 *  12. AC-S12 opts.timeout forwarded to spawn (timeoutMs)
 *  13. core ↔ UI 결합 0 (`from "obsidian"` / `new Notice(`) absent in llm-client.ts
 *  14. onAuthFallback NOT invoked on success
 *  15. checkAnthropicPresence — binary-only detection (no oauth_creds file probe)
 *  16. CLI binary missing (ENOENT) → onAuthFallback('spawn-failed') + API fallback
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LLMClient, type SubscriptionDeps } from '../llm-client.js'
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
  WIKEY_BASIC_MODEL: 'anthropic',
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
  ANTHROPIC_AUTH_MODE: 'auto',
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

// Anthropic API response shape: { content: [{ text: '...' }] }
const ANTHROPIC_API_BODY = JSON.stringify({
  content: [{ text: 'api-result' }],
})

interface SpawnCall {
  provider: SubscriptionProvider
  prompt: string
  opts: SpawnCliOptions | undefined
}

interface PresenceFlags {
  binary: boolean
}

/**
 * Anthropic presence = CLI binary only. Unlike Gemini, claude CLI stores auth
 * tokens in macOS Keychain (~/.config/claude is empty for OAuth users), so
 * fs.existsSync cannot probe the "logged in" state. The runtime detects missing
 * subscription via spawn stderr ("Please login").
 */
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
        if (p === CLI_DEFAULT_BINARY.anthropic) return presence.binary
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

describe('§5.6.4.3 Step C — LLMClient.callAnthropic subscription routing', () => {
  it('AC-S5 — subscription only + auto → spawn=1 / API=0', async () => {
    const http = mockHttp(ANTHROPIC_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { binary: true },
      spawnSuccess('hello from claude subscription'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig, ANTHROPIC_API_KEY: '' }, deps)
    const result = await llm.call('q', { provider: 'anthropic' })
    expect(result).toBe('hello from claude subscription')
    expect(spawnCalls).toHaveLength(1)
    expect(http.calls).toHaveLength(0)
  })

  it('AC-S5-api-only — API only → spawn=0 / API=1', async () => {
    const http = mockHttp(ANTHROPIC_API_BODY)
    const { deps, spawnCalls } = makeDeps({ binary: false }, spawnSuccess('unused'))
    const llm = new LLMClient(http.client, { ...baseConfig, ANTHROPIC_API_KEY: 'k' }, deps)
    const result = await llm.call('q', { provider: 'anthropic' })
    expect(result).toBe('api-result')
    expect(spawnCalls).toHaveLength(0)
    expect(http.calls).toHaveLength(1)
  })

  it('AC-S5-both-auto — both registered + auto → subscription wins (spawn=1 / API=0)', async () => {
    const http = mockHttp(ANTHROPIC_API_BODY)
    const { deps, spawnCalls } = makeDeps({ binary: true }, spawnSuccess('subscription wins'))
    const llm = new LLMClient(http.client, { ...baseConfig, ANTHROPIC_API_KEY: 'k' }, deps)
    await llm.call('q', { provider: 'anthropic' })
    expect(spawnCalls).toHaveLength(1)
    expect(http.calls).toHaveLength(0)
  })

  it('AC-S5-quota — subscription exit 1 + "rate limit" stderr → onAuthFallback("quota-exceeded") + API fallback', async () => {
    const http = mockHttp(ANTHROPIC_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { binary: true },
      spawnExit(1, 'anthropic: rate limit exceeded'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig, ANTHROPIC_API_KEY: 'k' }, deps)
    const fallbacks: AuthFallbackInfo[] = []
    const result = await llm.call('q', {
      provider: 'anthropic',
      onAuthFallback: (info) => fallbacks.push(info),
    })
    expect(result).toBe('api-result')
    expect(spawnCalls).toHaveLength(1)
    expect(http.calls).toHaveLength(1)
    expect(fallbacks).toHaveLength(1)
    expect(fallbacks[0]).toMatchObject({ provider: 'anthropic', reason: 'quota-exceeded' })
  })

  it('AC-S5-not-logged-in — subscription stderr "Please login" → onAuthFallback("auth-missing") + API fallback', async () => {
    const http = mockHttp(ANTHROPIC_API_BODY)
    const { deps } = makeDeps(
      { binary: true },
      spawnExit(1, 'Please login: run `claude /login`'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig, ANTHROPIC_API_KEY: 'k' }, deps)
    const fallbacks: AuthFallbackInfo[] = []
    const result = await llm.call('q', {
      provider: 'anthropic',
      onAuthFallback: (i) => fallbacks.push(i),
    })
    expect(result).toBe('api-result')
    expect(fallbacks[0]?.reason).toBe('auth-missing')
  })

  it('force-api → spawn=0 / API=1 even when binary present', async () => {
    const http = mockHttp(ANTHROPIC_API_BODY)
    const { deps, spawnCalls } = makeDeps({ binary: true }, spawnSuccess('skipped'))
    const cfg: WikeyConfig = { ...baseConfig, ANTHROPIC_AUTH_MODE: 'api', ANTHROPIC_API_KEY: 'k' }
    const llm = new LLMClient(http.client, cfg, deps)
    await llm.call('q', { provider: 'anthropic' })
    expect(spawnCalls).toHaveLength(0)
    expect(http.calls).toHaveLength(1)
  })

  it('force-subscription + no binary → throws (resolveAuthMode)', async () => {
    const http = mockHttp(ANTHROPIC_API_BODY)
    const { deps } = makeDeps({ binary: false }, spawnSuccess('unused'))
    const cfg: WikeyConfig = {
      ...baseConfig,
      ANTHROPIC_AUTH_MODE: 'subscription',
      ANTHROPIC_API_KEY: 'k',
    }
    const llm = new LLMClient(http.client, cfg, deps)
    await expect(llm.call('q', { provider: 'anthropic' })).rejects.toThrow(
      /No subscription credential/i,
    )
  })

  it('spawn aborted (timeout) + auto + API key → onAuthFallback("timeout") + API fallback', async () => {
    const http = mockHttp(ANTHROPIC_API_BODY)
    const { deps } = makeDeps({ binary: true }, async () => ({
      stdout: '',
      stderr: '',
      exitCode: null,
      aborted: true,
    }))
    const cfg: WikeyConfig = { ...baseConfig, ANTHROPIC_API_KEY: 'k' }
    const llm = new LLMClient(http.client, cfg, deps)
    const fallbacks: AuthFallbackInfo[] = []
    const result = await llm.call('q', {
      provider: 'anthropic',
      onAuthFallback: (i) => fallbacks.push(i),
    })
    expect(result).toBe('api-result')
    expect(fallbacks[0]?.reason).toBe('timeout')
  })

  it('AC-S9 — model option forwarded as `--model <id>` in spawn extraArgs', async () => {
    const http = mockHttp(ANTHROPIC_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { binary: true },
      spawnSuccess('with-model'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig }, deps)
    await llm.call('q', { provider: 'anthropic', model: 'claude-sonnet-4-5' })
    // claude CLI uses long-form `--model <id>` (not `-m`); mirrors SUBSCRIPTION_MODEL_FLAG.anthropic
    expect(spawnCalls[0]?.opts?.extraArgs).toEqual(['--model', 'claude-sonnet-4-5'])
  })

  it('AC-S10 — jsonMode requested + auto + API key → onAuthFallback("jsonMode-unsupported") + API fallback', async () => {
    const http = mockHttp(ANTHROPIC_API_BODY)
    const { deps, spawnCalls } = makeDeps({ binary: true }, spawnSuccess('skipped'))
    const cfg: WikeyConfig = { ...baseConfig, ANTHROPIC_API_KEY: 'k' }
    const llm = new LLMClient(http.client, cfg, deps)
    const fallbacks: AuthFallbackInfo[] = []
    const result = await llm.call('q', {
      provider: 'anthropic',
      jsonMode: true,
      onAuthFallback: (i) => fallbacks.push(i),
    })
    expect(result).toBe('api-result')
    // spawn skipped because mapOptionsToCliArgs returned `unsupported: 'jsonMode'`
    expect(spawnCalls).toHaveLength(0)
    expect(fallbacks[0]?.reason).toBe('jsonMode-unsupported')
  })

  it('AC-S11 — temperature silently ignored in CLI args (subscription path)', async () => {
    const http = mockHttp(ANTHROPIC_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { binary: true },
      spawnSuccess('temp-ignored'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig }, deps)
    await llm.call('q', { provider: 'anthropic', temperature: 0.7 })
    const args = spawnCalls[0]?.opts?.extraArgs ?? []
    expect(args.find((a) => a.includes('temp'))).toBeUndefined()
    expect(args).toEqual([]) // no model + no temp arg → empty args
  })

  it('AC-S12 — opts.timeout forwarded to spawn (timeoutMs)', async () => {
    const http = mockHttp(ANTHROPIC_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { binary: true },
      spawnSuccess('with-timeout'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig }, deps)
    await llm.call('q', { provider: 'anthropic', timeout: 12345 })
    expect(spawnCalls[0]?.opts?.timeoutMs).toBe(12345)
  })

  it('core ↔ UI 결합 0 — llm-client.ts contains no `from "obsidian"` import or `new Notice(`', () => {
    // Same grep gate as Gemini test; the plugin layer (main.ts) owns Notice surfacing
    // via onAuthFallback callback. wikey-core must remain runtime-environment-agnostic.
    const src = readFileSync(join(__dirname, '..', 'llm-client.ts'), 'utf-8')
    expect(src).not.toMatch(/from\s+['"]obsidian['"]/)
    expect(src).not.toMatch(/\bnew\s+Notice\s*\(/)
  })

  it('onAuthFallback NOT invoked on success', async () => {
    const http = mockHttp(ANTHROPIC_API_BODY)
    const { deps } = makeDeps({ binary: true }, spawnSuccess('clean claude response'))
    const llm = new LLMClient(http.client, { ...baseConfig, ANTHROPIC_API_KEY: 'k' }, deps)
    const fallbacks: AuthFallbackInfo[] = []
    const result = await llm.call('q', {
      provider: 'anthropic',
      onAuthFallback: (i) => fallbacks.push(i),
    })
    expect(result).toBe('clean claude response')
    expect(fallbacks).toHaveLength(0)
  })

  it('checkAnthropicPresence — binary-only detection (keychain not probed)', async () => {
    const http = mockHttp(ANTHROPIC_API_BODY)
    // binary absent → hasSubscription=false → falls to API path
    const { deps: noBinary, spawnCalls: callsA } = makeDeps(
      { binary: false },
      spawnSuccess('unused'),
    )
    const llmA = new LLMClient(http.client, { ...baseConfig, ANTHROPIC_API_KEY: 'k' }, noBinary)
    expect(llmA.checkAnthropicPresence()).toEqual({ hasSubscription: false, hasApiKey: true })
    await llmA.call('q', { provider: 'anthropic' })
    expect(callsA).toHaveLength(0)

    // binary present → hasSubscription=true (keychain auth state probed at first call)
    const { deps: withBinary } = makeDeps({ binary: true }, spawnSuccess('unused'))
    const llmB = new LLMClient(http.client, { ...baseConfig }, withBinary)
    expect(llmB.checkAnthropicPresence()).toEqual({ hasSubscription: true, hasApiKey: false })
  })

  it('CLI binary missing (spawn ENOENT) → onAuthFallback("spawn-failed") + API fallback', async () => {
    const http = mockHttp(ANTHROPIC_API_BODY)
    // Force binary presence true so resolveAuthMode picks subscription, then spawn throws ENOENT.
    const { deps } = makeDeps({ binary: true }, async () => {
      const err = new Error('spawn ENOENT') as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    })
    const cfg: WikeyConfig = { ...baseConfig, ANTHROPIC_API_KEY: 'k' }
    const llm = new LLMClient(http.client, cfg, deps)
    const fallbacks: AuthFallbackInfo[] = []
    const result = await llm.call('q', {
      provider: 'anthropic',
      onAuthFallback: (i) => fallbacks.push(i),
    })
    expect(result).toBe('api-result')
    expect(fallbacks[0]?.reason).toBe('spawn-failed')
  })
})

// Suppress unused import warning for type-only types referenced in JSDoc.
const _types: LLMCallOptions = {}
void _types
