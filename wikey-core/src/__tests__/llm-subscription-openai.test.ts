/**
 * §5.6.4.4 Step D — OpenAI Codex subscription wiring (LLMClient.callOpenAI routing).
 *
 * Plan: plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md §5.5 Step D +
 *       §3.3 AC-S6 (OpenAI) + §4.0.7 codex marker-based parser.
 *
 * Mirror of llm-subscription-anthropic.test.ts (provider='openai', CLI='codex').
 *
 * Key OpenAI-specific differences vs Anthropic/Gemini:
 *   - presence detection = CLI binary existence AND ~/.codex/auth.json existence
 *     (codex login persists OAuth token to ~/.codex/auth.json — probeable via
 *     fs.existsSync, unlike claude Keychain).
 *   - CLI base argv = ['exec', '-'] (codex reads prompt from stdin via `codex exec -`)
 *   - subscription model flag = '-m <id>' (single dash, short form)
 *   - parseSubscriptionOutput('openai', raw) = marker-based extraction
 *     (`\ncodex\n` ↔ `\ntokens used` sandwich; v0.7 #1h H1)
 *
 * 16 cases:
 *   1. AC-S6 subscription only + auto          → spawn=1 / API=0
 *   2. AC-S6-api-only API only                 → spawn=0 / API=1
 *   3. AC-S6-both-auto both + auto             → spawn=1 / API=0
 *   4. AC-S6-quota subscription exit-1 + stderr quota → API fallback + onAuthFallback
 *   5. AC-S6-auth-missing subscription stderr "not logged in" → onAuthFallback('auth-missing')
 *   6. force-api → spawn=0 / API=1
 *   7. force-subscription + no creds          → throws (resolveAuthMode)
 *   8. spawn timeout (aborted)                 → onAuthFallback('timeout') + API fallback
 *   9. AC-S9 model option forwarded as -m <id>
 *  10. AC-S10 jsonMode unsupported            → onAuthFallback('jsonMode-unsupported') + API
 *  11. AC-S11 temperature silent ignore in CLI args (OpenAI API path supports natively)
 *  12. AC-S12 opts.timeout forwarded to spawn (timeoutMs)
 *  13. core ↔ UI 결합 0 (`from "obsidian"` / `new Notice(`) absent in llm-client.ts
 *  14. onAuthFallback NOT invoked on success — golden raw stdout → clean body (marker-based)
 *  15. checkOpenAIPresence — auth.json + binary both required for hasSubscription=true
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
  WIKEY_BASIC_MODEL: 'openai',
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
  OPENAI_AUTH_MODE: 'auto',
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

// OpenAI Chat Completions API response shape: { choices: [{ message: { content: '...' } }] }
const OPENAI_API_BODY = JSON.stringify({
  choices: [{ message: { content: 'api-result' } }],
})

interface SpawnCall {
  provider: SubscriptionProvider
  prompt: string
  opts: SpawnCliOptions | undefined
}

interface PresenceFlags {
  /** ~/.codex/auth.json present (codex login persists OAuth here). */
  authFile: boolean
  /** /usr/local/bin/codex (CLI binary) present. */
  binary: boolean
}

/**
 * OpenAI presence = auth.json AND CLI binary. Unlike Anthropic (Keychain) we
 * can probe the auth token file directly. Unlike Gemini, the path is
 * ~/.codex/auth.json (not oauth_creds.json).
 */
function makeDeps(
  presence: PresenceFlags,
  spawnImpl: (call: SpawnCall) => Promise<SpawnCliResult>,
): { deps: SubscriptionDeps; spawnCalls: SpawnCall[] } {
  const spawnCalls: SpawnCall[] = []
  const fakeHome = '/fake/home'
  const authPath = `${fakeHome}/.codex/auth.json`
  return {
    spawnCalls,
    deps: {
      homeDir: () => fakeHome,
      fileExists: (p: string): boolean => {
        if (p === CLI_DEFAULT_BINARY.openai) return presence.binary
        if (p === authPath) return presence.authFile
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

// Golden codex stdout (master-captured 2026-05-13, plan §4.0.7 H1).
// Banner + metadata block + user prompt + `\ncodex\n` marker + response body + `\ntokens used` footer.
// parseSubscriptionOutput('openai', raw) must extract the body between markers only.
const CODEX_GOLDEN_RAW = readFileSync(
  join(__dirname, '..', '..', '..', 'plan', 'phase-5', 'fixtures', 'cycle-codex-golden', 'codex-ok-hi.raw.txt'),
  'utf-8',
)
const CODEX_GOLDEN_CLEAN = readFileSync(
  join(__dirname, '..', '..', '..', 'plan', 'phase-5', 'fixtures', 'cycle-codex-golden', 'codex-ok-hi.clean.txt'),
  'utf-8',
).trim()

// ── tests ─────────────────────────────────────────────────────────────────

describe('§5.6.4.4 Step D — LLMClient.callOpenAI subscription routing', () => {
  it('AC-S6 — subscription only + auto → spawn=1 / API=0', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { authFile: true, binary: true },
      spawnSuccess('\ncodex\nhello from codex\ntokens used\n42\n'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig, OPENAI_API_KEY: '' }, deps)
    const result = await llm.call('q', { provider: 'openai' })
    expect(result).toBe('hello from codex')
    expect(spawnCalls).toHaveLength(1)
    expect(http.calls).toHaveLength(0)
  })

  it('AC-S6-api-only — API only → spawn=0 / API=1', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    const { deps, spawnCalls } = makeDeps({ authFile: false, binary: false }, spawnSuccess('unused'))
    const llm = new LLMClient(http.client, { ...baseConfig, OPENAI_API_KEY: 'k' }, deps)
    const result = await llm.call('q', { provider: 'openai' })
    expect(result).toBe('api-result')
    expect(spawnCalls).toHaveLength(0)
    expect(http.calls).toHaveLength(1)
  })

  it('AC-S6-both-auto — both registered + auto → subscription wins (spawn=1 / API=0)', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { authFile: true, binary: true },
      spawnSuccess('\ncodex\nsubscription wins\ntokens used\n10\n'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig, OPENAI_API_KEY: 'k' }, deps)
    await llm.call('q', { provider: 'openai' })
    expect(spawnCalls).toHaveLength(1)
    expect(http.calls).toHaveLength(0)
  })

  it('AC-S6-quota — subscription exit 1 + "rate limit" stderr → onAuthFallback("quota-exceeded") + API fallback', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { authFile: true, binary: true },
      spawnExit(1, 'codex: rate limit exceeded'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig, OPENAI_API_KEY: 'k' }, deps)
    const fallbacks: AuthFallbackInfo[] = []
    const result = await llm.call('q', {
      provider: 'openai',
      onAuthFallback: (info) => fallbacks.push(info),
    })
    expect(result).toBe('api-result')
    expect(spawnCalls).toHaveLength(1)
    expect(http.calls).toHaveLength(1)
    expect(fallbacks).toHaveLength(1)
    expect(fallbacks[0]).toMatchObject({ provider: 'openai', reason: 'quota-exceeded' })
  })

  it('AC-S6-auth-missing — subscription stderr "not logged in" → onAuthFallback("auth-missing") + API fallback', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    const { deps } = makeDeps(
      { authFile: true, binary: true },
      spawnExit(1, 'Error: not logged in. Run `codex login`'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig, OPENAI_API_KEY: 'k' }, deps)
    const fallbacks: AuthFallbackInfo[] = []
    const result = await llm.call('q', {
      provider: 'openai',
      onAuthFallback: (i) => fallbacks.push(i),
    })
    expect(result).toBe('api-result')
    expect(fallbacks[0]?.reason).toBe('auth-missing')
  })

  it('force-api → spawn=0 / API=1 even when subscription creds present', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { authFile: true, binary: true },
      spawnSuccess('skipped'),
    )
    const cfg: WikeyConfig = { ...baseConfig, OPENAI_AUTH_MODE: 'api', OPENAI_API_KEY: 'k' }
    const llm = new LLMClient(http.client, cfg, deps)
    await llm.call('q', { provider: 'openai' })
    expect(spawnCalls).toHaveLength(0)
    expect(http.calls).toHaveLength(1)
  })

  it('force-subscription + no creds → throws (resolveAuthMode)', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    const { deps } = makeDeps({ authFile: false, binary: false }, spawnSuccess('unused'))
    const cfg: WikeyConfig = {
      ...baseConfig,
      OPENAI_AUTH_MODE: 'subscription',
      OPENAI_API_KEY: 'k',
    }
    const llm = new LLMClient(http.client, cfg, deps)
    await expect(llm.call('q', { provider: 'openai' })).rejects.toThrow(
      /No subscription credential/i,
    )
  })

  it('spawn aborted (timeout) + auto + API key → onAuthFallback("timeout") + API fallback', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    const { deps } = makeDeps({ authFile: true, binary: true }, async () => ({
      stdout: '',
      stderr: '',
      exitCode: null,
      aborted: true,
    }))
    const cfg: WikeyConfig = { ...baseConfig, OPENAI_API_KEY: 'k' }
    const llm = new LLMClient(http.client, cfg, deps)
    const fallbacks: AuthFallbackInfo[] = []
    const result = await llm.call('q', {
      provider: 'openai',
      onAuthFallback: (i) => fallbacks.push(i),
    })
    expect(result).toBe('api-result')
    expect(fallbacks[0]?.reason).toBe('timeout')
  })

  it('AC-S9 — model option forwarded as `-m <id>` in spawn extraArgs', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { authFile: true, binary: true },
      spawnSuccess('\ncodex\nwith-model\ntokens used\n5\n'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig }, deps)
    await llm.call('q', { provider: 'openai', model: 'gpt-5' })
    // codex CLI uses short-form `-m <id>` (mirrors SUBSCRIPTION_MODEL_FLAG.openai).
    expect(spawnCalls[0]?.opts?.extraArgs).toEqual(['-m', 'gpt-5'])
  })

  it('AC-S10 — jsonMode requested + auto + API key → onAuthFallback("jsonMode-unsupported") + API fallback', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { authFile: true, binary: true },
      spawnSuccess('skipped'),
    )
    const cfg: WikeyConfig = { ...baseConfig, OPENAI_API_KEY: 'k' }
    const llm = new LLMClient(http.client, cfg, deps)
    const fallbacks: AuthFallbackInfo[] = []
    const result = await llm.call('q', {
      provider: 'openai',
      jsonMode: true,
      onAuthFallback: (i) => fallbacks.push(i),
    })
    expect(result).toBe('api-result')
    // spawn skipped because mapOptionsToCliArgs returned `unsupported: 'jsonMode'`
    expect(spawnCalls).toHaveLength(0)
    expect(fallbacks[0]?.reason).toBe('jsonMode-unsupported')
  })

  it('AC-S11 — temperature silently ignored in CLI args (subscription path)', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { authFile: true, binary: true },
      spawnSuccess('\ncodex\ntemp-ignored\ntokens used\n3\n'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig }, deps)
    await llm.call('q', { provider: 'openai', temperature: 0.7 })
    const args = spawnCalls[0]?.opts?.extraArgs ?? []
    expect(args.find((a) => a.includes('temp'))).toBeUndefined()
    expect(args).toEqual([]) // no model + no temp arg → empty args
  })

  it('AC-S12 — opts.timeout forwarded to spawn (timeoutMs)', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { authFile: true, binary: true },
      spawnSuccess('\ncodex\nwith-timeout\ntokens used\n2\n'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig }, deps)
    await llm.call('q', { provider: 'openai', timeout: 12345 })
    expect(spawnCalls[0]?.opts?.timeoutMs).toBe(12345)
  })

  it('core ↔ UI 결합 0 — llm-client.ts contains no `from "obsidian"` import or `new Notice(`', () => {
    // Same grep gate as Gemini/Anthropic tests; the plugin layer (main.ts) owns Notice
    // surfacing via onAuthFallback callback. wikey-core must remain runtime-agnostic.
    const src = readFileSync(join(__dirname, '..', 'llm-client.ts'), 'utf-8')
    expect(src).not.toMatch(/from\s+['"]obsidian['"]/)
    expect(src).not.toMatch(/\bnew\s+Notice\s*\(/)
  })

  it('onAuthFallback NOT invoked on success — golden raw stdout → clean body (marker-based)', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    // Use the master-captured golden raw stdout as the spawn stdout to confirm
    // the marker-based parser extracts the body (not the banner / prompt / footer).
    const { deps } = makeDeps(
      { authFile: true, binary: true },
      spawnSuccess(CODEX_GOLDEN_RAW),
    )
    const llm = new LLMClient(http.client, { ...baseConfig, OPENAI_API_KEY: 'k' }, deps)
    const fallbacks: AuthFallbackInfo[] = []
    const result = await llm.call('q', {
      provider: 'openai',
      onAuthFallback: (i) => fallbacks.push(i),
    })
    expect(result).toBe(CODEX_GOLDEN_CLEAN)
    expect(fallbacks).toHaveLength(0)
    // Marker-based parser guarantees no banner / metadata / prompt sentinel / footer leak.
    expect(result).not.toMatch(/OpenAI Codex/)
    expect(result).not.toMatch(/user prompt:/i)
    expect(result).not.toMatch(/workdir:/)
    expect(result).not.toMatch(/tokens used/)
    expect(result).not.toMatch(/^model:/m)
  })

  it('checkOpenAIPresence — auth.json + binary both required for hasSubscription', async () => {
    const http = mockHttp(OPENAI_API_BODY)

    // both missing → hasSubscription=false → API path
    const { deps: none, spawnCalls: callsA } = makeDeps(
      { authFile: false, binary: false },
      spawnSuccess('unused'),
    )
    const llmA = new LLMClient(http.client, { ...baseConfig, OPENAI_API_KEY: 'k' }, none)
    expect(llmA.checkOpenAIPresence()).toEqual({ hasSubscription: false, hasApiKey: true })
    await llmA.call('q', { provider: 'openai' })
    expect(callsA).toHaveLength(0)

    // binary present but auth.json absent → hasSubscription=false (incomplete login)
    const { deps: binOnly } = makeDeps({ authFile: false, binary: true }, spawnSuccess('unused'))
    const llmB = new LLMClient(http.client, { ...baseConfig }, binOnly)
    expect(llmB.checkOpenAIPresence()).toEqual({ hasSubscription: false, hasApiKey: false })

    // auth.json present but binary absent → hasSubscription=false (CLI not installed)
    const { deps: authOnly } = makeDeps({ authFile: true, binary: false }, spawnSuccess('unused'))
    const llmC = new LLMClient(http.client, { ...baseConfig }, authOnly)
    expect(llmC.checkOpenAIPresence()).toEqual({ hasSubscription: false, hasApiKey: false })

    // both present → hasSubscription=true
    const { deps: both } = makeDeps({ authFile: true, binary: true }, spawnSuccess('unused'))
    const llmD = new LLMClient(http.client, { ...baseConfig, OPENAI_API_KEY: 'k' }, both)
    expect(llmD.checkOpenAIPresence()).toEqual({ hasSubscription: true, hasApiKey: true })
  })

  it('CLI binary missing (spawn ENOENT) → onAuthFallback("spawn-failed") + API fallback', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    // Force binary presence true so resolveAuthMode picks subscription, then spawn throws ENOENT.
    const { deps } = makeDeps({ authFile: true, binary: true }, async () => {
      const err = new Error('spawn ENOENT') as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    })
    const cfg: WikeyConfig = { ...baseConfig, OPENAI_API_KEY: 'k' }
    const llm = new LLMClient(http.client, cfg, deps)
    const fallbacks: AuthFallbackInfo[] = []
    const result = await llm.call('q', {
      provider: 'openai',
      onAuthFallback: (i) => fallbacks.push(i),
    })
    expect(result).toBe('api-result')
    expect(fallbacks[0]?.reason).toBe('spawn-failed')
  })
})

// Suppress unused import warning for type-only types referenced in JSDoc.
const _types: LLMCallOptions = {}
void _types
