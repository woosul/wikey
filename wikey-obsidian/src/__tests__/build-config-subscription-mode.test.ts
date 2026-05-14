/**
 * §5.6.6 Step E — subscription-mode bridge (cli / rest / pending).
 *
 * Plan: docs/planning/phase-5/phase-5-todox-5.6.6-subscription-rest.md §5
 * Spec: docs/planning/phase-5/phase-5-spec-5.6.6-subscription-rest.md
 *   §1.3 Inputs — WikeyConfig.<PROVIDER>_SUBSCRIPTION_MODE 3 fields
 *   §1.3.2 — default 'pending' when Step A0 not yet wired into Settings
 *   §1.5 AC-S23 — kill-switch precedence (env → wikey-core resolver, not here)
 *
 * Mirrors build-config-auth-mode.test.ts conventions:
 *   - env > settings > default
 *   - invalid env values fall through to settings (no silent acceptance)
 *   - env keys exposed for security-test parity with AUTH_MODE_ENV_KEYS
 */

import { describe, it, expect } from 'vitest'
import type { WikeySettings } from '../main.js'
import {
  buildSubscriptionModesForConfig,
  SUBSCRIPTION_MODE_ENV_KEYS,
} from '../auth-mode-bridge.js'

function makeSettings(overrides: Partial<WikeySettings> = {}): WikeySettings {
  // Same minimum-populated shape as build-config-auth-mode.test.ts so the two
  // bridges can be tested with identical fixtures. Only the subscription-mode
  // and auth-mode fields actually matter for these assertions.
  return {
    basicModel: 'ollama',
    cloudModel: '',
    geminiApiKey: '',
    anthropicApiKey: '',
    openaiApiKey: '',
    geminiAuthMode: 'subscription',
    anthropicAuthMode: 'subscription',
    openaiAuthMode: 'subscription',
    geminiSubscriptionMode: 'rest',
    anthropicSubscriptionMode: 'rest',
    openaiSubscriptionMode: 'rest',
    ollamaUrl: 'http://localhost:11434',
    qmdPath: '',
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
    ollamaCloudApiKey: '',
    ollamaCloudAuthMode: 'subscription',
    ...overrides,
  }
}

describe('§5.6.6 — buildSubscriptionModesForConfig (3 vendors)', () => {
  it('passes settings values through verbatim (rest / cli / pending mix)', () => {
    const cfg = buildSubscriptionModesForConfig(
      makeSettings({
        geminiSubscriptionMode: 'rest',
        anthropicSubscriptionMode: 'cli',
        openaiSubscriptionMode: 'pending',
      }),
    )
    expect(cfg.GEMINI_SUBSCRIPTION_MODE).toBe('rest')
    expect(cfg.ANTHROPIC_SUBSCRIPTION_MODE).toBe('cli')
    expect(cfg.OPENAI_SUBSCRIPTION_MODE).toBe('pending')
  })

  it("legacy install missing the field falls back to 'pending' (Spec §1.3.2)", () => {
    // Simulate a data.json saved before §5.6.6 by stripping the new fields.
    const settings = makeSettings()
    const legacy = { ...settings } as WikeySettings
    delete (legacy as { geminiSubscriptionMode?: unknown }).geminiSubscriptionMode
    delete (legacy as { anthropicSubscriptionMode?: unknown }).anthropicSubscriptionMode
    delete (legacy as { openaiSubscriptionMode?: unknown }).openaiSubscriptionMode
    const cfg = buildSubscriptionModesForConfig(legacy)
    expect(cfg.GEMINI_SUBSCRIPTION_MODE).toBe('pending')
    expect(cfg.ANTHROPIC_SUBSCRIPTION_MODE).toBe('pending')
    expect(cfg.OPENAI_SUBSCRIPTION_MODE).toBe('pending')
  })

  it('env keys are exposed for security-test parity with AUTH_MODE_ENV_KEYS', () => {
    expect(SUBSCRIPTION_MODE_ENV_KEYS).toEqual([
      'WIKEY_GEMINI_SUBSCRIPTION_MODE',
      'WIKEY_ANTHROPIC_SUBSCRIPTION_MODE',
      'WIKEY_OPENAI_SUBSCRIPTION_MODE',
    ])
  })
})

describe('§5.6.6 — env override priority (env > settings > pending)', () => {
  it('WIKEY_GEMINI_SUBSCRIPTION_MODE=cli overrides settings.geminiSubscriptionMode=rest', () => {
    const orig = process.env.WIKEY_GEMINI_SUBSCRIPTION_MODE
    try {
      process.env.WIKEY_GEMINI_SUBSCRIPTION_MODE = 'cli'
      const cfg = buildSubscriptionModesForConfig(
        makeSettings({ geminiSubscriptionMode: 'rest' }),
      )
      expect(cfg.GEMINI_SUBSCRIPTION_MODE).toBe('cli')
    } finally {
      if (orig === undefined) delete process.env.WIKEY_GEMINI_SUBSCRIPTION_MODE
      else process.env.WIKEY_GEMINI_SUBSCRIPTION_MODE = orig
    }
  })

  it('invalid env value (e.g. "foo") falls through to settings (no silent acceptance)', () => {
    const orig = process.env.WIKEY_ANTHROPIC_SUBSCRIPTION_MODE
    try {
      process.env.WIKEY_ANTHROPIC_SUBSCRIPTION_MODE = 'foo'
      const cfg = buildSubscriptionModesForConfig(
        makeSettings({ anthropicSubscriptionMode: 'rest' }),
      )
      expect(cfg.ANTHROPIC_SUBSCRIPTION_MODE).toBe('rest')
    } finally {
      if (orig === undefined) delete process.env.WIKEY_ANTHROPIC_SUBSCRIPTION_MODE
      else process.env.WIKEY_ANTHROPIC_SUBSCRIPTION_MODE = orig
    }
  })

  it('3-vendor independence — gemini env override does not affect anthropic/openai', () => {
    const orig = process.env.WIKEY_GEMINI_SUBSCRIPTION_MODE
    try {
      process.env.WIKEY_GEMINI_SUBSCRIPTION_MODE = 'cli'
      const cfg = buildSubscriptionModesForConfig(
        makeSettings({
          geminiSubscriptionMode: 'rest',
          anthropicSubscriptionMode: 'rest',
          openaiSubscriptionMode: 'rest',
        }),
      )
      expect(cfg.GEMINI_SUBSCRIPTION_MODE).toBe('cli')
      expect(cfg.ANTHROPIC_SUBSCRIPTION_MODE).toBe('rest')
      expect(cfg.OPENAI_SUBSCRIPTION_MODE).toBe('rest')
    } finally {
      if (orig === undefined) delete process.env.WIKEY_GEMINI_SUBSCRIPTION_MODE
      else process.env.WIKEY_GEMINI_SUBSCRIPTION_MODE = orig
    }
  })
})
