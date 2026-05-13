/**
 * §5.6.4.1 Step A2 — auth-resolver RED.
 *
 * Plan reference:
 *   - plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md §3.2 I1/I3, §5.2 A2 결정표
 *
 * Spec — `resolveAuthMode(provider, config, presence) → 'subscription' | 'api'`
 *   8-row truth table (plan §5.2 A2):
 *     authMode='subscription' + hasSubscription=true              → 'subscription'
 *     authMode='subscription' + hasSubscription=false             → throw
 *     authMode='api' + hasApiKey=true                             → 'api'
 *     authMode='api' + hasApiKey=false                            → throw
 *     authMode='auto' + hasSubscription=true  + hasApiKey=true    → 'subscription'
 *     authMode='auto' + hasSubscription=true  + hasApiKey=false   → 'subscription'
 *     authMode='auto' + hasSubscription=false + hasApiKey=true    → 'api'
 *     authMode='auto' + hasSubscription=false + hasApiKey=false   → throw
 *
 * Spec — `detectFallbackTrigger(stderr, status, body) → reason | null`
 *   AC-S4 / S5 / S6: quota / 401 / 429 / "rate limit" → 'quota-exceeded'
 *   401 + "not logged in" → 'auth-missing'
 *   no trigger → null
 */

import { describe, it, expect } from 'vitest'
import type { WikeyConfig, SubscriptionProvider } from '../types.js'
import {
  resolveAuthMode,
  detectFallbackTrigger,
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
    GEMINI_AUTH_MODE: 'auto',
    ANTHROPIC_AUTH_MODE: 'auto',
    OPENAI_AUTH_MODE: 'auto',
    ...overrides,
  }
}

function presence(hasSubscription: boolean, hasApiKey: boolean): CredentialPresence {
  return { hasSubscription, hasApiKey }
}

const PROVIDERS: readonly SubscriptionProvider[] = ['gemini', 'anthropic', 'openai']

describe('§5.6.4 resolveAuthMode — 8-row truth table', () => {
  it('row 1: force-subscription + hasSubscription → "subscription"', () => {
    for (const p of PROVIDERS) {
      const cfg = makeConfig({
        GEMINI_AUTH_MODE: 'subscription',
        ANTHROPIC_AUTH_MODE: 'subscription',
        OPENAI_AUTH_MODE: 'subscription',
      })
      expect(resolveAuthMode(p, cfg, presence(true, false))).toBe('subscription')
    }
  })

  it('row 2: force-subscription + no subscription → throw', () => {
    const cfg = makeConfig({ GEMINI_AUTH_MODE: 'subscription' })
    expect(() => resolveAuthMode('gemini', cfg, presence(false, true))).toThrow(
      /No subscription credential.*gemini/i,
    )
  })

  it('row 3: force-api + hasApiKey → "api"', () => {
    for (const p of PROVIDERS) {
      const cfg = makeConfig({
        GEMINI_AUTH_MODE: 'api',
        ANTHROPIC_AUTH_MODE: 'api',
        OPENAI_AUTH_MODE: 'api',
      })
      expect(resolveAuthMode(p, cfg, presence(true, true))).toBe('api')
    }
  })

  it('row 4: force-api + no api key → throw', () => {
    const cfg = makeConfig({ ANTHROPIC_AUTH_MODE: 'api' })
    expect(() => resolveAuthMode('anthropic', cfg, presence(true, false))).toThrow(
      /No API key.*anthropic/i,
    )
  })

  it('row 5: auto + both → subscription wins', () => {
    const cfg = makeConfig()
    expect(resolveAuthMode('gemini', cfg, presence(true, true))).toBe('subscription')
  })

  it('row 6: auto + subscription only → "subscription"', () => {
    const cfg = makeConfig()
    expect(resolveAuthMode('openai', cfg, presence(true, false))).toBe('subscription')
  })

  it('row 7: auto + api only → "api"', () => {
    const cfg = makeConfig()
    expect(resolveAuthMode('anthropic', cfg, presence(false, true))).toBe('api')
  })

  it('row 8: auto + neither → throw', () => {
    const cfg = makeConfig()
    expect(() => resolveAuthMode('gemini', cfg, presence(false, false))).toThrow(
      /No credential.*gemini/i,
    )
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
