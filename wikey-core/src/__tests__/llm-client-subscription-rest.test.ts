/**
 * §5.6.6 Step E — llm-client.ts integration RED → GREEN.
 *
 * Plan: docs/planning/phase-5/phase-5-todox-5.6.6-subscription-rest.md §5
 * Spec: docs/planning/phase-5/phase-5-spec-5.6.6-subscription-rest.md
 *   §1.1 Goal — per-provider `subscriptionMode = 'cli' | 'rest' | 'pending'`
 *   §1.2 I7  — cli regression preserved
 *   §1.2 I16 — kill-switch env per-vendor independent
 *   §1.3 Inputs — `WikeyConfig.<PROVIDER>_SUBSCRIPTION_MODE` UPPERCASE
 *   §1.3.1 REST option matrix — LLMCallOptions pass-through to RESTCallOptions
 *
 * Cases:
 *   T-E1  AC-S16 — mode='rest' → RESTClient.call invoked, spawnCliPrompt 0
 *   T-E2  AC-S16 — mode='cli'  → spawn 1, RESTClient.call 0 (regression)
 *   T-E3  Spec §1.3.2 — mode='pending' → silent cli fallback
 *   T-E4  AC-S20 — gemini='rest' + anthropic='cli' + openai='rest' mixed
 *   T-E5  AC-S14 — REST path never reads process.env.*_API_KEY
 *   T-E6  AC-S17 — authMode='api' overrides subscription mode (HTTPS API only)
 *   T-E7a AC-S23-gemini — WIKEY_GEMINI_REST_DISABLE=1 forces cli
 *   T-E7b AC-S23-anthropic — WIKEY_ANTHROPIC_REST_DISABLE=1 forces cli
 *   T-E7c AC-S23-openai — WIKEY_OPENAI_REST_DISABLE=1 forces cli
 *   T-E11 AC-S25 — LLMCallOptions → RESTCallOptions pass-through (6 fields)
 */

import { describe, it, expect, afterEach } from 'vitest'
import { join } from 'node:path'
import { LLMClient, type SubscriptionDeps } from '../llm-client.js'
import type {
  HttpClient,
  HttpRequestOptions,
  HttpResponse,
  WikeyConfig,
} from '../types.js'
import type {
  RESTCallOptions,
  RESTCallResult,
  SubscriptionRESTClient,
  TokenState,
} from '../subscription-rest-shared.js'
import {
  CLI_DEFAULT_BINARY,
  type SpawnCliOptions,
  type SpawnCliResult,
} from '../cli-spawn.js'
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
  GEMINI_AUTH_MODE: 'subscription',
  ANTHROPIC_AUTH_MODE: 'subscription',
  OPENAI_AUTH_MODE: 'subscription',
}

const HTTP_NEVER_CALLED: HttpClient = {
  async request(): Promise<HttpResponse> {
    throw new Error('HTTP not expected on this path')
  },
}

interface SpawnCall {
  provider: SubscriptionProvider
  prompt: string
  opts: SpawnCliOptions | undefined
}

interface RESTCall {
  prompt: string
  model: string
  opts: RESTCallOptions
}

interface MakeDepsArgs {
  oauthExists?: boolean
  binaryExists?: boolean
  spawnResult?: SpawnCliResult
  restResult?: RESTCallResult
}

/** Build a spy `SubscriptionDeps` with REST clients for all 3 vendors. */
function makeRESTDeps(args: MakeDepsArgs = {}): {
  deps: SubscriptionDeps
  spawnCalls: SpawnCall[]
  geminiRESTCalls: RESTCall[]
  anthropicRESTCalls: RESTCall[]
  openaiRESTCalls: RESTCall[]
} {
  const spawnCalls: SpawnCall[] = []
  const geminiRESTCalls: RESTCall[] = []
  const anthropicRESTCalls: RESTCall[] = []
  const openaiRESTCalls: RESTCall[] = []
  const fakeHome = '/fake/home'
  const restResult = args.restResult ?? {
    text: 'rest-answer',
    model: 'rest-model',
    latencyMs: 1234,
  }

  const makeRESTClient = (
    sink: RESTCall[],
  ): SubscriptionRESTClient => ({
    async loadToken(): Promise<TokenState> {
      return { accessToken: 'fake', refreshToken: 'fake', expiresAtMs: Date.now() + 3_600_000, raw: {} }
    },
    async refreshIfNeeded(s: TokenState): Promise<TokenState> {
      return s
    },
    async call(prompt: string, model: string, opts: RESTCallOptions): Promise<RESTCallResult> {
      sink.push({ prompt, model, opts })
      return restResult
    },
  })

  return {
    spawnCalls,
    geminiRESTCalls,
    anthropicRESTCalls,
    openaiRESTCalls,
    deps: {
      homeDir: () => fakeHome,
      fileExists: (p: string): boolean => {
        if (p === join(fakeHome, '.gemini', 'oauth_creds.json')) return args.oauthExists ?? true
        if (p === join(fakeHome, '.codex', 'auth.json')) return args.oauthExists ?? true
        if (p === CLI_DEFAULT_BINARY.gemini) return args.binaryExists ?? true
        if (p === CLI_DEFAULT_BINARY.anthropic) return args.binaryExists ?? true
        if (p === CLI_DEFAULT_BINARY.openai) return args.binaryExists ?? true
        return false
      },
      spawnCliPrompt: async (provider, prompt, spawnOpts) => {
        spawnCalls.push({ provider, prompt, opts: spawnOpts })
        return args.spawnResult ?? { stdout: 'cli-answer', stderr: '', exitCode: 0, aborted: false }
      },
      googleRESTClient: makeRESTClient(geminiRESTCalls),
      anthropicRESTClient: makeRESTClient(anthropicRESTCalls),
      openaiRESTClient: makeRESTClient(openaiRESTCalls),
    },
  }
}

function clearRestDisableEnv(): void {
  delete process.env.WIKEY_GEMINI_REST_DISABLE
  delete process.env.WIKEY_ANTHROPIC_REST_DISABLE
  delete process.env.WIKEY_OPENAI_REST_DISABLE
}

afterEach(() => {
  clearRestDisableEnv()
})

// ── tests ─────────────────────────────────────────────────────────────────

describe('§5.6.6 Step E — LLMClient REST/CLI dispatch by GEMINI_SUBSCRIPTION_MODE', () => {
  it('T-E1 AC-S16 — mode=rest → RESTClient.call invoked, spawnCliPrompt skipped', async () => {
    const { deps, spawnCalls, geminiRESTCalls } = makeRESTDeps()
    const cfg: WikeyConfig = { ...baseConfig, GEMINI_SUBSCRIPTION_MODE: 'rest' }
    const llm = new LLMClient(HTTP_NEVER_CALLED, cfg, deps)
    const result = await llm.call('q', { provider: 'gemini' })
    expect(result).toBe('rest-answer')
    expect(geminiRESTCalls).toHaveLength(1)
    expect(spawnCalls).toHaveLength(0)
  })

  it('T-E2 AC-S16 — mode=cli → spawnCliPrompt invoked (regression), RESTClient skipped', async () => {
    const { deps, spawnCalls, geminiRESTCalls } = makeRESTDeps()
    const cfg: WikeyConfig = { ...baseConfig, GEMINI_SUBSCRIPTION_MODE: 'cli' }
    const llm = new LLMClient(HTTP_NEVER_CALLED, cfg, deps)
    const result = await llm.call('q', { provider: 'gemini' })
    expect(result).toBe('cli-answer')
    expect(spawnCalls).toHaveLength(1)
    expect(spawnCalls[0].provider).toBe('gemini')
    expect(geminiRESTCalls).toHaveLength(0)
  })

  it('T-E3 Spec §1.3.2 — mode=pending → silent cli fallback (no RESTClient call)', async () => {
    const { deps, spawnCalls, geminiRESTCalls } = makeRESTDeps()
    const cfg: WikeyConfig = { ...baseConfig, GEMINI_SUBSCRIPTION_MODE: 'pending' }
    const llm = new LLMClient(HTTP_NEVER_CALLED, cfg, deps)
    await llm.call('q', { provider: 'gemini' })
    expect(spawnCalls).toHaveLength(1)
    expect(geminiRESTCalls).toHaveLength(0)
  })
})

describe('§5.6.6 Step E — per-provider mixed dispatch (AC-S20)', () => {
  it('T-E4 — gemini=rest + anthropic=cli + openai=rest → each path used once', async () => {
    const { deps, spawnCalls, geminiRESTCalls, anthropicRESTCalls, openaiRESTCalls } =
      makeRESTDeps()
    const cfg: WikeyConfig = {
      ...baseConfig,
      GEMINI_SUBSCRIPTION_MODE: 'rest',
      ANTHROPIC_SUBSCRIPTION_MODE: 'cli',
      OPENAI_SUBSCRIPTION_MODE: 'rest',
    }
    const llm = new LLMClient(HTTP_NEVER_CALLED, cfg, deps)
    await llm.call('q1', { provider: 'gemini' })
    await llm.call('q2', { provider: 'anthropic' })
    await llm.call('q3', { provider: 'openai' })
    expect(geminiRESTCalls).toHaveLength(1)
    expect(anthropicRESTCalls).toHaveLength(0)
    expect(openaiRESTCalls).toHaveLength(1)
    expect(spawnCalls).toHaveLength(1)
    expect(spawnCalls[0].provider).toBe('anthropic')
  })
})

describe('§5.6.6 Step E — REST path environment isolation (AC-S14)', () => {
  it('T-E5 — REST path dispatches to RESTClient even with API key envs set (no callXxxApi)', async () => {
    // Spec AC-S14 = "REST path never reads process.env.*_API_KEY". Direct
    // env-access spying is not possible (Node forbids accessor descriptors on
    // process.env). Instead: prove the *dispatch* never enters callXxxApi by
    // pointing httpClient.request at a fail-fast stub. If REST mode wins,
    // 0 HTTPS API requests fire, regardless of env API keys being set.
    const httpFailFast: HttpClient = {
      async request(): Promise<HttpResponse> {
        throw new Error('callXxxApi reached — env API key path leaked into REST mode')
      },
    }
    const origs = {
      g: process.env.GEMINI_API_KEY,
      a: process.env.ANTHROPIC_API_KEY,
      o: process.env.OPENAI_API_KEY,
    }
    try {
      process.env.GEMINI_API_KEY = 'env-poison-gemini'
      process.env.ANTHROPIC_API_KEY = 'env-poison-anthropic'
      process.env.OPENAI_API_KEY = 'env-poison-openai'
      const { deps, geminiRESTCalls, anthropicRESTCalls, openaiRESTCalls } = makeRESTDeps()
      const cfg: WikeyConfig = {
        ...baseConfig,
        // GEMINI_API_KEY left empty so callGeminiApi (which reads
        // this.config.GEMINI_API_KEY, not env) would throw if mistakenly
        // entered — extra belt for the dispatch invariant.
        GEMINI_API_KEY: '',
        ANTHROPIC_API_KEY: '',
        OPENAI_API_KEY: '',
        GEMINI_SUBSCRIPTION_MODE: 'rest',
        ANTHROPIC_SUBSCRIPTION_MODE: 'rest',
        OPENAI_SUBSCRIPTION_MODE: 'rest',
      }
      const llm = new LLMClient(httpFailFast, cfg, deps)
      await llm.call('q', { provider: 'gemini' })
      await llm.call('q', { provider: 'anthropic' })
      await llm.call('q', { provider: 'openai' })
      expect(geminiRESTCalls).toHaveLength(1)
      expect(anthropicRESTCalls).toHaveLength(1)
      expect(openaiRESTCalls).toHaveLength(1)
    } finally {
      const restore = (k: 'GEMINI_API_KEY' | 'ANTHROPIC_API_KEY' | 'OPENAI_API_KEY',
                        v: string | undefined): void => {
        if (v === undefined) delete process.env[k]
        else process.env[k] = v
      }
      restore('GEMINI_API_KEY', origs.g)
      restore('ANTHROPIC_API_KEY', origs.a)
      restore('OPENAI_API_KEY', origs.o)
    }
  })
})

describe('§5.6.6 Step E — authMode=api unaffected by subscription mode (AC-S17)', () => {
  it('T-E6 — authMode=api + SUBSCRIPTION_MODE=rest → callGeminiApi (HTTPS), 0 spawn, 0 REST', async () => {
    const httpCalls: { url: string; opts: HttpRequestOptions }[] = []
    const apiBody = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'api-answer' }] } }],
    })
    const apiHttp: HttpClient = {
      async request(url: string, opts: HttpRequestOptions): Promise<HttpResponse> {
        httpCalls.push({ url, opts })
        return { status: 200, body: apiBody }
      },
    }
    const { deps, spawnCalls, geminiRESTCalls } = makeRESTDeps()
    const cfg: WikeyConfig = {
      ...baseConfig,
      GEMINI_AUTH_MODE: 'api',
      GEMINI_API_KEY: 'fake-key',
      GEMINI_SUBSCRIPTION_MODE: 'rest', // Should be ignored — authMode=api wins.
    }
    const llm = new LLMClient(apiHttp, cfg, deps)
    const result = await llm.call('q', { provider: 'gemini' })
    expect(result).toBe('api-answer')
    expect(httpCalls).toHaveLength(1)
    expect(httpCalls[0].url).toContain('generativelanguage.googleapis.com')
    expect(spawnCalls).toHaveLength(0)
    expect(geminiRESTCalls).toHaveLength(0)
  })
})

describe('§5.6.6 Step E — kill-switch env per-vendor independent (AC-S23)', () => {
  it('T-E7a — WIKEY_GEMINI_REST_DISABLE=1 forces cli (others unaffected)', async () => {
    process.env.WIKEY_GEMINI_REST_DISABLE = '1'
    const { deps, spawnCalls, geminiRESTCalls, anthropicRESTCalls } = makeRESTDeps()
    const cfg: WikeyConfig = {
      ...baseConfig,
      GEMINI_SUBSCRIPTION_MODE: 'rest',
      ANTHROPIC_SUBSCRIPTION_MODE: 'rest',
    }
    const llm = new LLMClient(HTTP_NEVER_CALLED, cfg, deps)
    await llm.call('q', { provider: 'gemini' })
    await llm.call('q', { provider: 'anthropic' })
    expect(spawnCalls).toHaveLength(1)
    expect(spawnCalls[0].provider).toBe('gemini')
    expect(geminiRESTCalls).toHaveLength(0)
    expect(anthropicRESTCalls).toHaveLength(1)
  })

  it('T-E7b — WIKEY_ANTHROPIC_REST_DISABLE=1 forces cli (others unaffected)', async () => {
    process.env.WIKEY_ANTHROPIC_REST_DISABLE = '1'
    const { deps, spawnCalls, geminiRESTCalls, anthropicRESTCalls } = makeRESTDeps()
    const cfg: WikeyConfig = {
      ...baseConfig,
      GEMINI_SUBSCRIPTION_MODE: 'rest',
      ANTHROPIC_SUBSCRIPTION_MODE: 'rest',
    }
    const llm = new LLMClient(HTTP_NEVER_CALLED, cfg, deps)
    await llm.call('q', { provider: 'gemini' })
    await llm.call('q', { provider: 'anthropic' })
    expect(spawnCalls).toHaveLength(1)
    expect(spawnCalls[0].provider).toBe('anthropic')
    expect(anthropicRESTCalls).toHaveLength(0)
    expect(geminiRESTCalls).toHaveLength(1)
  })

  it('T-E7c — WIKEY_OPENAI_REST_DISABLE=1 forces cli (others unaffected)', async () => {
    process.env.WIKEY_OPENAI_REST_DISABLE = '1'
    const { deps, spawnCalls, geminiRESTCalls, openaiRESTCalls } = makeRESTDeps()
    const cfg: WikeyConfig = {
      ...baseConfig,
      GEMINI_SUBSCRIPTION_MODE: 'rest',
      OPENAI_SUBSCRIPTION_MODE: 'rest',
    }
    const llm = new LLMClient(HTTP_NEVER_CALLED, cfg, deps)
    await llm.call('q', { provider: 'gemini' })
    await llm.call('q', { provider: 'openai' })
    expect(spawnCalls).toHaveLength(1)
    expect(spawnCalls[0].provider).toBe('openai')
    expect(openaiRESTCalls).toHaveLength(0)
    expect(geminiRESTCalls).toHaveLength(1)
  })
})

describe('§5.6.6 Step E — LLMCallOptions pass-through to RESTCallOptions (AC-S25)', () => {
  it('T-E11 — 6 fields (temperature/seed/maxTokens/responseMimeType/jsonMode/thinkingBudget) forwarded', async () => {
    const { deps, geminiRESTCalls } = makeRESTDeps()
    const cfg: WikeyConfig = { ...baseConfig, GEMINI_SUBSCRIPTION_MODE: 'rest' }
    const llm = new LLMClient(HTTP_NEVER_CALLED, cfg, deps)
    await llm.call('q', {
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      temperature: 0.5,
      seed: 42,
      maxTokens: 1024,
      jsonMode: true,
      responseMimeType: 'application/json',
      thinkingBudget: 100,
      timeout: 30_000,
    })
    expect(geminiRESTCalls).toHaveLength(1)
    const opts = geminiRESTCalls[0].opts
    expect(opts.temperature).toBe(0.5)
    expect(opts.seed).toBe(42)
    expect(opts.maxTokens).toBe(1024)
    expect(opts.jsonMode).toBe(true)
    expect(opts.responseMimeType).toBe('application/json')
    expect(opts.thinkingBudget).toBe(100)
    expect(opts.timeout).toBe(30_000)
    // model forwarded as the second positional argument, not on opts.
    expect(geminiRESTCalls[0].model).toBe('gemini-2.5-flash')
  })
})
