/**
 * §5.6.4.4 Step D — OpenAI Codex subscription wiring (LLMClient.callOpenAI routing).
 *
 * Plan: docs/planning/phase-5/phase-5-todox-5.6.4-llm-subscription.md §5.5 Step D +
 *       §3.3 AC-S6 (OpenAI) + §4.0.7 codex marker-based parser.
 *
 * v0.7 (user plan 2026-05-14) — 'auto' polished out. Subscription failures throw
 * after invoking onAuthFallback (UI Notice). Force-api / force-subscription /
 * none semantics unchanged.
 *
 * Key OpenAI-specific differences vs Anthropic/Gemini:
 *   - presence detection = CLI binary existence AND ~/.codex/auth.json existence
 *     (codex login persists OAuth token to ~/.codex/auth.json — probeable via
 *     fs.existsSync, unlike claude Keychain).
 *   - CLI base argv = ['exec', '-'] (codex reads prompt from stdin via `codex exec -`)
 *   - subscription model flag = '-m <id>' (single dash, short form)
 *   - parseSubscriptionOutput('openai', raw) = marker-based extraction
 *     (`\ncodex\n` ↔ `\ntokens used` sandwich; v0.7 #1h H1)
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
  OPENAI_AUTH_MODE: 'subscription',
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

const OPENAI_API_BODY = JSON.stringify({
  choices: [{ message: { content: 'api-result' } }],
})

interface SpawnCall {
  provider: SubscriptionProvider
  prompt: string
  opts: SpawnCliOptions | undefined
}

interface PresenceFlags {
  authFile: boolean
  binary: boolean
}

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
const CODEX_GOLDEN_RAW = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'planning', 'phase-5', 'fixtures', 'cycle-codex-golden', 'codex-ok-hi.raw.txt'),
  'utf-8',
)
const CODEX_GOLDEN_CLEAN = readFileSync(
  join(__dirname, '..', '..', '..', 'docs', 'planning', 'phase-5', 'fixtures', 'cycle-codex-golden', 'codex-ok-hi.clean.txt'),
  'utf-8',
).trim()

// ── tests ─────────────────────────────────────────────────────────────────

describe('§5.6.4.4 Step D — LLMClient.callOpenAI subscription routing (v0.7)', () => {
  it('AC-S6 — subscription only + mode=subscription → spawn=1 / API=0', async () => {
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

  it('AC-S6-api-only — API only + mode=api → spawn=0 / API=1', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    const { deps, spawnCalls } = makeDeps({ authFile: false, binary: false }, spawnSuccess('unused'))
    const cfg: WikeyConfig = { ...baseConfig, OPENAI_AUTH_MODE: 'api', OPENAI_API_KEY: 'k' }
    const llm = new LLMClient(http.client, cfg, deps)
    const result = await llm.call('q', { provider: 'openai' })
    expect(result).toBe('api-result')
    expect(spawnCalls).toHaveLength(0)
    expect(http.calls).toHaveLength(1)
  })

  it('AC-S6-both — both registered + mode=subscription → spawn=1 / API=0', async () => {
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

  it('mode=subscription + exit 1 + "rate limit" stderr → onAuthFallback("quota-exceeded") + throws', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { authFile: true, binary: true },
      spawnExit(1, 'codex: rate limit exceeded'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig, OPENAI_API_KEY: 'k' }, deps)
    const fallbacks: AuthFallbackInfo[] = []
    await expect(
      llm.call('q', { provider: 'openai', onAuthFallback: (info) => fallbacks.push(info) }),
    ).rejects.toThrow()
    expect(spawnCalls).toHaveLength(1)
    expect(http.calls).toHaveLength(0)
    expect(fallbacks).toHaveLength(1)
    expect(fallbacks[0]).toMatchObject({ provider: 'openai', reason: 'quota-exceeded' })
  })

  it('mode=subscription + stderr "not logged in" → onAuthFallback("auth-missing") + throws', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    const { deps } = makeDeps(
      { authFile: true, binary: true },
      spawnExit(1, 'Error: not logged in. Run `codex login`'),
    )
    const llm = new LLMClient(http.client, { ...baseConfig, OPENAI_API_KEY: 'k' }, deps)
    const fallbacks: AuthFallbackInfo[] = []
    await expect(
      llm.call('q', { provider: 'openai', onAuthFallback: (i) => fallbacks.push(i) }),
    ).rejects.toThrow()
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

  it('mode=subscription + spawn aborted (timeout) → onAuthFallback("timeout") + throws', async () => {
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
    await expect(
      llm.call('q', { provider: 'openai', onAuthFallback: (i) => fallbacks.push(i) }),
    ).rejects.toThrow()
    expect(http.calls).toHaveLength(0)
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
    expect(spawnCalls[0]?.opts?.extraArgs).toEqual(['-m', 'gpt-5'])
  })

  it('mode=subscription + jsonMode → onAuthFallback("jsonMode-unsupported") + throws', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    const { deps, spawnCalls } = makeDeps(
      { authFile: true, binary: true },
      spawnSuccess('skipped'),
    )
    const cfg: WikeyConfig = { ...baseConfig, OPENAI_API_KEY: 'k' }
    const llm = new LLMClient(http.client, cfg, deps)
    const fallbacks: AuthFallbackInfo[] = []
    await expect(
      llm.call('q', {
        provider: 'openai',
        jsonMode: true,
        onAuthFallback: (i) => fallbacks.push(i),
      }),
    ).rejects.toThrow()
    expect(spawnCalls).toHaveLength(0)
    expect(http.calls).toHaveLength(0)
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
    expect(args).toEqual([])
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
    const src = readFileSync(join(__dirname, '..', 'llm-client.ts'), 'utf-8')
    expect(src).not.toMatch(/from\s+['"]obsidian['"]/)
    expect(src).not.toMatch(/\bnew\s+Notice\s*\(/)
  })

  it('onAuthFallback NOT invoked on success — golden raw stdout → clean body (marker-based)', async () => {
    const http = mockHttp(OPENAI_API_BODY)
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
    expect(result).not.toMatch(/OpenAI Codex/)
    expect(result).not.toMatch(/user prompt:/i)
    expect(result).not.toMatch(/workdir:/)
    expect(result).not.toMatch(/tokens used/)
    expect(result).not.toMatch(/^model:/m)
  })

  it('checkOpenAIPresence — auth.json + binary both required for hasSubscription', async () => {
    const http = mockHttp(OPENAI_API_BODY)

    // both missing → hasSubscription=false. mode='api' to keep call legal.
    const { deps: none, spawnCalls: callsA } = makeDeps(
      { authFile: false, binary: false },
      spawnSuccess('unused'),
    )
    const cfgApi: WikeyConfig = { ...baseConfig, OPENAI_AUTH_MODE: 'api', OPENAI_API_KEY: 'k' }
    const llmA = new LLMClient(http.client, cfgApi, none)
    expect(llmA.checkOpenAIPresence()).toEqual({ hasSubscription: false, hasApiKey: true })
    await llmA.call('q', { provider: 'openai' })
    expect(callsA).toHaveLength(0)

    // binary present but auth.json absent → hasSubscription=false
    const { deps: binOnly } = makeDeps({ authFile: false, binary: true }, spawnSuccess('unused'))
    const llmB = new LLMClient(http.client, { ...baseConfig }, binOnly)
    expect(llmB.checkOpenAIPresence()).toEqual({ hasSubscription: false, hasApiKey: false })

    // auth.json present but binary absent → hasSubscription=false
    const { deps: authOnly } = makeDeps({ authFile: true, binary: false }, spawnSuccess('unused'))
    const llmC = new LLMClient(http.client, { ...baseConfig }, authOnly)
    expect(llmC.checkOpenAIPresence()).toEqual({ hasSubscription: false, hasApiKey: false })

    // both present → hasSubscription=true
    const { deps: both } = makeDeps({ authFile: true, binary: true }, spawnSuccess('unused'))
    const llmD = new LLMClient(http.client, { ...baseConfig, OPENAI_API_KEY: 'k' }, both)
    expect(llmD.checkOpenAIPresence()).toEqual({ hasSubscription: true, hasApiKey: true })
  })

  it('mode=subscription + CLI binary missing (spawn ENOENT) → onAuthFallback("spawn-failed") + throws', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    const { deps } = makeDeps({ authFile: true, binary: true }, async () => {
      const err = new Error('spawn ENOENT') as NodeJS.ErrnoException
      err.code = 'ENOENT'
      throw err
    })
    const cfg: WikeyConfig = { ...baseConfig, OPENAI_API_KEY: 'k' }
    const llm = new LLMClient(http.client, cfg, deps)
    const fallbacks: AuthFallbackInfo[] = []
    await expect(
      llm.call('q', { provider: 'openai', onAuthFallback: (i) => fallbacks.push(i) }),
    ).rejects.toThrow()
    expect(http.calls).toHaveLength(0)
    expect(fallbacks[0]?.reason).toBe('spawn-failed')
  })

  it('mode=none → throws (provider disabled)', async () => {
    const http = mockHttp(OPENAI_API_BODY)
    const { deps, spawnCalls } = makeDeps({ authFile: true, binary: true }, spawnSuccess('unused'))
    const cfg: WikeyConfig = { ...baseConfig, OPENAI_AUTH_MODE: 'none', OPENAI_API_KEY: 'k' }
    const llm = new LLMClient(http.client, cfg, deps)
    await expect(llm.call('q', { provider: 'openai' })).rejects.toThrow(
      /Provider openai is disabled/i,
    )
    expect(spawnCalls).toHaveLength(0)
    expect(http.calls).toHaveLength(0)
  })
})

// Suppress unused import warning for type-only types referenced in JSDoc.
const _types: LLMCallOptions = {}
void _types
