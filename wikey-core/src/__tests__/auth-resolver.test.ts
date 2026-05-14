/**
 * §5.6.4 v0.7 — auth-resolver test (user plan 2026-05-14).
 *
 * Plan reference:
 *   - docs/planning/phase-5/phase-5-todox-5.6.4-llm-subscription.md §3.2 I1/I3, §5.2 A2 결정표
 *
 * v0.7 — 'auto' polished out. 'none' added (provider disabled).
 *
 * Spec — `resolveAuthMode(provider, config, presence) → 'subscription' | 'api'`
 *   6-row truth table:
 *     authMode='none'                                     → throw (disabled)
 *     authMode='subscription' + hasSubscription=true      → 'subscription'
 *     authMode='subscription' + hasSubscription=false     → throw
 *     authMode='api' + hasApiKey=true                     → 'api'
 *     authMode='api' + hasApiKey=false                    → throw
 *     legacy authMode='auto' (migrated)                   → resolves as 'subscription'
 *
 * Spec — `detectFallbackTrigger(stderr, status, body) → reason | null`
 *   classification unchanged in v0.7 — callback fires for UI Notice, but the
 *   runtime no longer auto-retries on the API path.
 */

import { describe, it, expect } from 'vitest'
import type { WikeyConfig, SubscriptionProvider } from '../types.js'
import {
  resolveAuthMode,
  detectFallbackTrigger,
  getConfiguredAuthPath,
  type CredentialPresence,
} from '../auth-resolver.js'

function makeConfig(overrides: Partial<WikeyConfig> = {}): WikeyConfig {
  return {
    WIKEY_BASIC_MODEL: 'ollama',
    WIKEY_SEARCH_BACKEND: 'basic',
    WIKEY_MODEL: 'wikey',
    WIKEY_QMD_TOP_N: 8,
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
    ...overrides,
  }
}

function presence(hasSubscription: boolean, hasApiKey: boolean): CredentialPresence {
  return { hasSubscription, hasApiKey }
}

const PROVIDERS: readonly SubscriptionProvider[] = ['gemini', 'anthropic', 'openai']

describe('§5.6.4 v0.7 resolveAuthMode — 6-row truth table', () => {
  it('row 1: none → throw (provider disabled, regardless of credentials)', () => {
    for (const p of PROVIDERS) {
      const cfg = makeConfig({
        GEMINI_AUTH_MODE: 'none',
        ANTHROPIC_AUTH_MODE: 'none',
        OPENAI_AUTH_MODE: 'none',
      })
      expect(() => resolveAuthMode(p, cfg, presence(true, true))).toThrow(
        new RegExp(`Provider ${p} is disabled.*none`, 'i'),
      )
    }
  })

  it('row 2: subscription + hasSubscription → "subscription"', () => {
    for (const p of PROVIDERS) {
      const cfg = makeConfig({
        GEMINI_AUTH_MODE: 'subscription',
        ANTHROPIC_AUTH_MODE: 'subscription',
        OPENAI_AUTH_MODE: 'subscription',
      })
      expect(resolveAuthMode(p, cfg, presence(true, false))).toBe('subscription')
    }
  })

  it('row 3: subscription + no subscription → throw', () => {
    const cfg = makeConfig({ GEMINI_AUTH_MODE: 'subscription' })
    expect(() => resolveAuthMode('gemini', cfg, presence(false, true))).toThrow(
      /No subscription credential.*gemini/i,
    )
  })

  it('row 4: api + hasApiKey → "api"', () => {
    for (const p of PROVIDERS) {
      const cfg = makeConfig({
        GEMINI_AUTH_MODE: 'api',
        ANTHROPIC_AUTH_MODE: 'api',
        OPENAI_AUTH_MODE: 'api',
      })
      expect(resolveAuthMode(p, cfg, presence(true, true))).toBe('api')
    }
  })

  it('row 5: api + no api key → throw', () => {
    const cfg = makeConfig({ ANTHROPIC_AUTH_MODE: 'api' })
    expect(() => resolveAuthMode('anthropic', cfg, presence(true, false))).toThrow(
      /No API key.*anthropic/i,
    )
  })

  it('row 6: legacy "auto" value migrates to "subscription" semantics', () => {
    // Older stored configs may still carry 'auto' if the disk-side migration
    // failed (e.g. read-only filesystem). Resolver-side migration preserves the
    // subscription-first user intent without re-introducing the silent API
    // fallback.
    const cfg = makeConfig({
      GEMINI_AUTH_MODE: 'auto' as unknown as 'subscription',
    })
    expect(resolveAuthMode('gemini', cfg, presence(true, true))).toBe('subscription')
    expect(() => resolveAuthMode('gemini', cfg, presence(false, true))).toThrow(
      /No subscription credential/i,
    )
  })

  it('row 7: undefined / missing AUTH_MODE defaults to "subscription"', () => {
    // Strip the field entirely (covers fresh installs / legacy configs that
    // omit the key). Resolver applies the v0.7 default.
    const cfg = makeConfig()
    const stripped: WikeyConfig = { ...cfg, GEMINI_AUTH_MODE: undefined }
    expect(resolveAuthMode('gemini', stripped, presence(true, false))).toBe('subscription')
  })
})

describe('§5.6.4 commit 15 getConfiguredAuthPath — pure path lookup (no presence)', () => {
  it('subscription mode → "subscription"', () => {
    const cfg = makeConfig({ ANTHROPIC_AUTH_MODE: 'subscription' })
    expect(getConfiguredAuthPath('anthropic', cfg)).toBe('subscription')
  })

  it('api mode → "api"', () => {
    const cfg = makeConfig({ OPENAI_AUTH_MODE: 'api' })
    expect(getConfiguredAuthPath('openai', cfg)).toBe('api')
  })

  it('undefined / missing AUTH_MODE defaults to "subscription"', () => {
    const cfg = makeConfig()
    const stripped: WikeyConfig = { ...cfg, GEMINI_AUTH_MODE: undefined }
    expect(getConfiguredAuthPath('gemini', stripped)).toBe('subscription')
  })

  it('legacy "auto" value migrates to "subscription"', () => {
    const cfg = makeConfig({ ANTHROPIC_AUTH_MODE: 'auto' as unknown as 'subscription' })
    expect(getConfiguredAuthPath('anthropic', cfg)).toBe('subscription')
  })
})

describe('§5.6.4 detectFallbackTrigger — quota / auth / network signals', () => {
  it('HTTP 401 → "quota-exceeded" (subscription quota / token expiry)', () => {
    expect(detectFallbackTrigger({ status: 401, stderr: '', body: '' })).toBe('quota-exceeded')
  })

  it('HTTP 429 → "quota-exceeded"', () => {
    expect(detectFallbackTrigger({ status: 429, stderr: '', body: 'too many requests' })).toBe(
      'quota-exceeded',
    )
  })

  it('stderr contains "rate limit" → "quota-exceeded"', () => {
    expect(
      detectFallbackTrigger({ status: 0, stderr: 'Error: rate limit reached for this model', body: '' }),
    ).toBe('quota-exceeded')
  })

  it('stderr "quota exceeded" → "quota-exceeded"', () => {
    expect(detectFallbackTrigger({ status: 0, stderr: 'quota exceeded', body: '' })).toBe(
      'quota-exceeded',
    )
  })

  it('stderr "not logged in" → "auth-missing" (CLI never authenticated)', () => {
    expect(
      detectFallbackTrigger({ status: 0, stderr: 'Please log in: gemini auth login', body: '' }),
    ).toBe('auth-missing')
  })

  it('no trigger pattern → null', () => {
    expect(detectFallbackTrigger({ status: 200, stderr: '', body: 'OK' })).toBeNull()
  })
})
