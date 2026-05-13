/**
 * §5.6.4.5 Step E — 3-provider integration smoke (routing matrix).
 *
 * Plan: plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md §5.6 E2
 *       (routing matrix 6 case = 3 SubscriptionProvider × 2 AuthPath).
 *
 * Why this exists (separate from per-provider 16-case suites): the per-provider
 * suites exercise each provider in isolation (one provider has both creds,
 * others irrelevant). The matrix here pins down the *coexistence* invariant —
 * a single LLMClient instance with all 3 providers carrying both subscription
 * credential AND API key resolves each provider independently, in line with
 * its own AUTH_MODE config (auto → subscription / api → API path).
 *
 * Covers:
 *   AC-S7  — 3 providers all registered, all `auto` → each picks subscription.
 *   AC-S8  — per-provider force-api isolates routing (other 2 stay on subscription).
 *
 * 6 cases:
 *   gemini    + auto   → subscription path
 *   anthropic + auto   → subscription path
 *   openai    + auto   → subscription path
 *   gemini    + api    → API path
 *   anthropic + api    → API path
 *   openai    + api    → API path
 */

import { describe, it, expect } from 'vitest'
import { LLMClient, type SubscriptionDeps } from '../llm-client.js'
import type {
  HttpClient,
  HttpRequestOptions,
  HttpResponse,
  SubscriptionProvider,
  WikeyConfig,
} from '../types.js'
import { CLI_DEFAULT_BINARY, type SpawnCliResult, type SpawnCliOptions } from '../cli-spawn.js'

// ── fixtures ──────────────────────────────────────────────────────────────

const FAKE_HOME = '/fake/home'

/**
 * Files that exist in the mocked filesystem when "subscription credential
 * present" is true for the corresponding provider. Mirrors the real disk
 * layout each `checkXxxPresence` probes:
 *   - gemini:    ~/.gemini/oauth_creds.json + CLI binary
 *   - anthropic: CLI binary only (Keychain-stored token, not file-probeable)
 *   - openai:    ~/.codex/auth.json + CLI binary
 */
function makeFsExists(providersWithSubscription: Set<SubscriptionProvider>) {
  const present = new Set<string>()
  if (providersWithSubscription.has('gemini')) {
    present.add(`${FAKE_HOME}/.gemini/oauth_creds.json`)
    present.add(CLI_DEFAULT_BINARY.gemini)
  }
  if (providersWithSubscription.has('anthropic')) {
    present.add(CLI_DEFAULT_BINARY.anthropic)
  }
  if (providersWithSubscription.has('openai')) {
    present.add(`${FAKE_HOME}/.codex/auth.json`)
    present.add(CLI_DEFAULT_BINARY.openai)
  }
  return (p: string): boolean => present.has(p)
}

interface SpawnRecord {
  provider: SubscriptionProvider
  prompt: string
}

/**
 * Subscription stdout fixtures — minimal valid form for each parser:
 *   - gemini:    plain body (parseSubscriptionOutput strips the optional
 *                "Loaded cached credentials.\n" header, then trim)
 *   - anthropic: plain body (raw.trim())
 *   - openai:    marker-based (`\ncodex\n` ↔ `\ntokens used` sandwich)
 */
const SUBSCRIPTION_STDOUT: Record<SubscriptionProvider, string> = {
  gemini: 'gemini-subscription-result',
  anthropic: 'anthropic-subscription-result',
  openai: '\ncodex\nopenai-subscription-result\ntokens used\n42\n',
}

const SUBSCRIPTION_CLEAN: Record<SubscriptionProvider, string> = {
  gemini: 'gemini-subscription-result',
  anthropic: 'anthropic-subscription-result',
  openai: 'openai-subscription-result',
}

/**
 * API response body per provider, shaped like the real HTTP endpoint so the
 * existing callXxxApi parsers extract the text the same way they do for real
 * traffic. Lifted from each per-provider test suite for shape parity.
 */
const API_BODY: Record<SubscriptionProvider, string> = {
  gemini: JSON.stringify({
    candidates: [{ content: { parts: [{ text: 'gemini-api-result' }] } }],
  }),
  anthropic: JSON.stringify({
    content: [{ type: 'text', text: 'anthropic-api-result' }],
  }),
  openai: JSON.stringify({
    choices: [{ message: { content: 'openai-api-result' } }],
  }),
}

const API_CLEAN: Record<SubscriptionProvider, string> = {
  gemini: 'gemini-api-result',
  anthropic: 'anthropic-api-result',
  openai: 'openai-api-result',
}

interface MatrixHarness {
  llm: LLMClient
  httpCalls: { url: string; opts: HttpRequestOptions }[]
  spawnCalls: SpawnRecord[]
}

/**
 * Build an LLMClient with all 3 providers carrying both subscription credential
 * AND API key. Per-provider AUTH_MODE controls which path each call resolves to.
 */
function makeMatrixClient(authModes: Record<SubscriptionProvider, 'auto' | 'api'>): MatrixHarness {
  const httpCalls: { url: string; opts: HttpRequestOptions }[] = []
  const spawnCalls: SpawnRecord[] = []

  const httpClient: HttpClient = {
    async request(url: string, opts: HttpRequestOptions): Promise<HttpResponse> {
      httpCalls.push({ url, opts })
      // Match against the substring that uniquely identifies each provider's API
      // endpoint — avoids hard-coding the full URL and works whether or not
      // future endpoints add query strings.
      if (url.includes('generativelanguage.googleapis.com')) {
        return { status: 200, body: API_BODY.gemini }
      }
      if (url.includes('api.anthropic.com')) {
        return { status: 200, body: API_BODY.anthropic }
      }
      if (url.includes('api.openai.com')) {
        return { status: 200, body: API_BODY.openai }
      }
      throw new Error(`unexpected HTTP url in routing matrix: ${url}`)
    },
  }

  const deps: SubscriptionDeps = {
    homeDir: () => FAKE_HOME,
    fileExists: makeFsExists(new Set<SubscriptionProvider>(['gemini', 'anthropic', 'openai'])),
    spawnCliPrompt: async (
      provider: SubscriptionProvider,
      prompt: string,
      _opts?: SpawnCliOptions,
    ): Promise<SpawnCliResult> => {
      spawnCalls.push({ provider, prompt })
      return {
        stdout: SUBSCRIPTION_STDOUT[provider],
        stderr: '',
        exitCode: 0,
        aborted: false,
      }
    },
  }

  const config: WikeyConfig = {
    WIKEY_BASIC_MODEL: 'gemini',
    WIKEY_SEARCH_BACKEND: 'basic',
    WIKEY_MODEL: 'wikey',
    WIKEY_QMD_TOP_N: 5,
    GEMINI_API_KEY: 'sk-gem-test',
    ANTHROPIC_API_KEY: 'sk-ant-test',
    OPENAI_API_KEY: 'sk-oai-test',
    OLLAMA_URL: 'http://localhost:11434',
    INGEST_PROVIDER: '',
    LINT_PROVIDER: '',
    SUMMARIZE_PROVIDER: '',
    CONTEXTUAL_MODEL: 'gemma4',
    COST_LIMIT: 50,
    GEMINI_AUTH_MODE: authModes.gemini,
    ANTHROPIC_AUTH_MODE: authModes.anthropic,
    OPENAI_AUTH_MODE: authModes.openai,
  }

  return { llm: new LLMClient(httpClient, config, deps), httpCalls, spawnCalls }
}

// ── tests ─────────────────────────────────────────────────────────────────

describe('§5.6.4.5 Step E — 3-provider routing matrix (subscription / api)', () => {
  it.each<SubscriptionProvider>(['gemini', 'anthropic', 'openai'])(
    'auto + both creds → %s resolves to subscription path (spawn=1 / HTTP=0)',
    async (provider) => {
      const harness = makeMatrixClient({ gemini: 'auto', anthropic: 'auto', openai: 'auto' })
      const result = await harness.llm.call('q', { provider })
      expect(result).toBe(SUBSCRIPTION_CLEAN[provider])
      // Subscription path = 1 spawn for this provider, 0 HTTP calls.
      expect(harness.spawnCalls).toEqual([{ provider, prompt: 'q' }])
      expect(harness.httpCalls).toHaveLength(0)
    },
  )

  it.each<SubscriptionProvider>(['gemini', 'anthropic', 'openai'])(
    'force-api + both creds → %s resolves to API path (spawn=0 / HTTP=1)',
    async (provider) => {
      const harness = makeMatrixClient({ gemini: 'api', anthropic: 'api', openai: 'api' })
      const result = await harness.llm.call('q', { provider })
      expect(result).toBe(API_CLEAN[provider])
      // API path = 0 spawns, 1 HTTP call for this provider.
      expect(harness.spawnCalls).toHaveLength(0)
      expect(harness.httpCalls).toHaveLength(1)
    },
  )

  it('AC-S7 — all 3 providers in auto independently pick subscription (no cross-talk)', async () => {
    const harness = makeMatrixClient({ gemini: 'auto', anthropic: 'auto', openai: 'auto' })

    const [g, a, o] = await Promise.all([
      harness.llm.call('q', { provider: 'gemini' }),
      harness.llm.call('q', { provider: 'anthropic' }),
      harness.llm.call('q', { provider: 'openai' }),
    ])

    expect(g).toBe(SUBSCRIPTION_CLEAN.gemini)
    expect(a).toBe(SUBSCRIPTION_CLEAN.anthropic)
    expect(o).toBe(SUBSCRIPTION_CLEAN.openai)

    // 3 spawns (1 per provider), 0 HTTP calls — subscription-only resolution.
    expect(harness.spawnCalls).toHaveLength(3)
    expect(new Set(harness.spawnCalls.map((c) => c.provider))).toEqual(
      new Set(['gemini', 'anthropic', 'openai']),
    )
    expect(harness.httpCalls).toHaveLength(0)
  })

  it('AC-S8 — per-provider force-api isolates routing (gemini=api, others=auto)', async () => {
    const harness = makeMatrixClient({ gemini: 'api', anthropic: 'auto', openai: 'auto' })

    const [g, a, o] = await Promise.all([
      harness.llm.call('q', { provider: 'gemini' }),
      harness.llm.call('q', { provider: 'anthropic' }),
      harness.llm.call('q', { provider: 'openai' }),
    ])

    expect(g).toBe(API_CLEAN.gemini)
    expect(a).toBe(SUBSCRIPTION_CLEAN.anthropic)
    expect(o).toBe(SUBSCRIPTION_CLEAN.openai)

    // Only anthropic + openai spawned. Gemini hit HTTP exactly once.
    expect(new Set(harness.spawnCalls.map((c) => c.provider))).toEqual(
      new Set(['anthropic', 'openai']),
    )
    expect(harness.httpCalls).toHaveLength(1)
    expect(harness.httpCalls[0].url).toContain('generativelanguage.googleapis.com')
  })
})
