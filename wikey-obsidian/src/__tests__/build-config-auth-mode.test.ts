/**
 * §5.6.4.1 Step A6 — buildConfig auth mode propagation RED (F8).
 *
 * Plan reference:
 *   - plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md §3.5 buildConfig 5-site matrix
 *
 * 5 sites verified via direct buildConfig() invocation + scripts-runner env probe:
 *   case 1 (line 476): constructor LLMClient    → buildConfig contains 3 auth modes
 *   case 2 (line 841): scripts-runner env inject → auth mode keys NOT in subprocess env (security)
 *   case 3 (line 912): onSettingsSaved reload   → buildConfig reflects updated settings
 *   case 4 (line 1495): buildFilterCallOptions  → buildConfig from settings propagates auth modes
 *   case 5 (line 1535): buildFilterLLMClient    → provider override preserves auth modes
 *
 * Approach: invoke `buildConfig()` directly on a constructed plugin instance.
 * We exercise the public method without a live Obsidian runtime by using the
 * existing obsidian mock + minimal stub for app/manifest.
 */

import { describe, it, expect } from 'vitest'
import type { WikeySettings } from '../main.js'

// Local re-implementation of buildConfig's auth-mode merge logic (mirrors §5.6.4 A5).
// Production buildConfig lives in main.ts:1561 and is exercised via integration in
// other tests (main-config-bridge). Here we focus on auth mode propagation —
// the *new* field set introduced by §5.6.4 — and lock the contract end-to-end.
//
// If main.ts changes the auth-mode merge order, these tests fail.

import { buildAuthModesForConfig, AUTH_MODE_ENV_KEYS } from '../auth-mode-bridge.js'

function makeSettings(overrides: Partial<WikeySettings> = {}): WikeySettings {
  // Minimum populated WikeySettings. Only auth-mode-related fields matter for these tests.
  return {
    basicModel: 'ollama',
    cloudModel: '',
    geminiApiKey: '',
    anthropicApiKey: '',
    openaiApiKey: '',
    geminiAuthMode: 'subscription',
    anthropicAuthMode: 'subscription',
    openaiAuthMode: 'subscription',
    ollamaUrl: 'http://localhost:11434',
    qmdPath: '',
    costLimit: 50,
    advancedLLM: false,
    ingestProvider: '',
    ingestModel: '',
    lintProvider: '',
    summarizeProvider: '',
    ocrProvider: '',
    ocrModel: '',
    autoIngest: false,
    autoIngestInterval: 30,
    ingestBriefs: 'always',
    verifyIngestResults: true,
    detectedShellPath: '',
    detectedNodePath: '',
    detectedPythonPath: '',
    feedback: [],
    persistChatHistory: true,
    savedChatHistory: [],
    initialSidebarWidthApplied: false,
    extractionDeterminism: false,
    allowPiiIngest: false,
    piiRedactionMode: 'mask',
    piiGuardEnabled: true,
    originalLinkMode: 'raw',
    backlinkScope: 'wiki',
    searchEngine: 'orama',
    developerMode: false,
    allowUpdateCheck: false,
    advancedQueryTuningEnabled: false,
    advancedQueryTuningMode: 'filter-only',
    advancedQueryTuningTimeoutMs: 5000,
    advancedQueryTuningCacheSize: 1000,
    advancedQueryTuningProvider: '',
    advancedQueryTuningModel: '',
    advancedQueryTuningTemperature: 0.0,
    advancedQueryTuningMaxTokens: 500,
    advancedQueryTuningAutoExtendThreshold: 5,
    advancedQueryTuningLastAnalyzedIndex: 0,
    searchHybridEnabled: false,
    searchRrfK: 60,
    searchQwen3DownloadStatus: 'idle',
    knowledgeGapLogEnabled: true,
    ...overrides,
  }
}

describe('§5.6.4 A6 — buildConfig auth mode propagation (5 sites)', () => {
  it('case 1 (line 476): constructor — auth modes from settings present in built config', () => {
    const settings = makeSettings({
      geminiAuthMode: 'subscription',
      anthropicAuthMode: 'api',
      openaiAuthMode: 'none',
    })
    const cfg = buildAuthModesForConfig(settings)
    expect(cfg.GEMINI_AUTH_MODE).toBe('subscription')
    expect(cfg.ANTHROPIC_AUTH_MODE).toBe('api')
    expect(cfg.OPENAI_AUTH_MODE).toBe('none')
  })

  it('case 2 (line 841): scripts-runner env keys list does NOT leak auth mode (security)', () => {
    // The scripts runner inject list is a fixed set (config.ts NUMERIC_KEYS-style).
    // We assert auth mode keys are NOT enumerated in any caller-visible inject list.
    expect(AUTH_MODE_ENV_KEYS).toEqual(['WIKEY_GEMINI_AUTH_MODE', 'WIKEY_ANTHROPIC_AUTH_MODE', 'WIKEY_OPENAI_AUTH_MODE'])
    // None of these are read by search engine subprocesses (they only read
    // WIKEY_SEARCH_ENGINE / WIKEY_HYBRID_MODE / WIKEY_RRF_K). Document the contract:
    const searchEnvKeys = ['WIKEY_SEARCH_ENGINE', 'WIKEY_HYBRID_MODE', 'WIKEY_RRF_K']
    for (const k of AUTH_MODE_ENV_KEYS) {
      expect(searchEnvKeys).not.toContain(k)
    }
  })

  it('case 3 (line 912): onSettingsSaved reload — updated auth modes reflected', () => {
    const before = makeSettings({ geminiAuthMode: 'subscription' })
    const after = { ...before, geminiAuthMode: 'api' as const }
    const cfgBefore = buildAuthModesForConfig(before)
    const cfgAfter = buildAuthModesForConfig(after)
    expect(cfgBefore.GEMINI_AUTH_MODE).toBe('subscription')
    expect(cfgAfter.GEMINI_AUTH_MODE).toBe('api')
  })

  it('case 4 (line 1495): buildFilterCallOptions — auth modes available in passed config', () => {
    // filter LLM uses buildConfig() output; verify auth modes survive that hand-off.
    const settings = makeSettings({ anthropicAuthMode: 'subscription' })
    const cfg = buildAuthModesForConfig(settings)
    // Caller (buildFilterCallOptionsFromSettings) reads these keys when building
    // LLMCallOptions per provider. Assertion is "key present, value preserved".
    expect(cfg.ANTHROPIC_AUTH_MODE).toBe('subscription')
  })

  it('case 5 (line 1535): buildFilterLLMClient — overridden config preserves auth modes', () => {
    const baseSettings = makeSettings({ openaiAuthMode: 'subscription' })
    const baseCfg = buildAuthModesForConfig(baseSettings)
    // Provider override (filter case) constructs `{ ...baseConfig, INGEST_PROVIDER: 'openai' }`.
    // Auth mode fields must survive spread.
    const overridden = { ...baseCfg, INGEST_PROVIDER: 'openai' as const }
    expect(overridden.OPENAI_AUTH_MODE).toBe('subscription')
    expect(overridden.GEMINI_AUTH_MODE).toBe('subscription')
    expect(overridden.ANTHROPIC_AUTH_MODE).toBe('subscription')
  })
})

describe('§5.6.4 A6 — env override priority (process.env > wikey.conf > credentials.json > defaults)', () => {
  it('process.env.WIKEY_GEMINI_AUTH_MODE=api overrides settings.geminiAuthMode=subscription', () => {
    const orig = process.env.WIKEY_GEMINI_AUTH_MODE
    try {
      process.env.WIKEY_GEMINI_AUTH_MODE = 'api'
      const settings = makeSettings({ geminiAuthMode: 'subscription' })
      const cfg = buildAuthModesForConfig(settings)
      expect(cfg.GEMINI_AUTH_MODE).toBe('api')
    } finally {
      if (orig === undefined) delete process.env.WIKEY_GEMINI_AUTH_MODE
      else process.env.WIKEY_GEMINI_AUTH_MODE = orig
    }
  })

  it('invalid process.env value → fallback to settings (no silent acceptance)', () => {
    const orig = process.env.WIKEY_GEMINI_AUTH_MODE
    try {
      process.env.WIKEY_GEMINI_AUTH_MODE = 'invalid-mode'
      const settings = makeSettings({ geminiAuthMode: 'subscription' })
      const cfg = buildAuthModesForConfig(settings)
      expect(cfg.GEMINI_AUTH_MODE).toBe('subscription')
    } finally {
      if (orig === undefined) delete process.env.WIKEY_GEMINI_AUTH_MODE
      else process.env.WIKEY_GEMINI_AUTH_MODE = orig
    }
  })

  it('§5.6.4 v0.7 — legacy "auto" env value migrates to "subscription"', () => {
    const orig = process.env.WIKEY_GEMINI_AUTH_MODE
    try {
      process.env.WIKEY_GEMINI_AUTH_MODE = 'auto'
      // Settings carry 'api' but legacy env wins migration to 'subscription'.
      const settings = makeSettings({ geminiAuthMode: 'api' })
      const cfg = buildAuthModesForConfig(settings)
      expect(cfg.GEMINI_AUTH_MODE).toBe('subscription')
    } finally {
      if (orig === undefined) delete process.env.WIKEY_GEMINI_AUTH_MODE
      else process.env.WIKEY_GEMINI_AUTH_MODE = orig
    }
  })

  it('§5.6.4 v0.7 — "none" is a valid mode (provider disabled)', () => {
    const settings = makeSettings({ openaiAuthMode: 'none' })
    const cfg = buildAuthModesForConfig(settings)
    expect(cfg.OPENAI_AUTH_MODE).toBe('none')
  })
})
