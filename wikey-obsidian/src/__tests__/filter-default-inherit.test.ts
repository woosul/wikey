/**
 * §5.7.8 Cycle #1 Finding 1 + Cycle #2 Finding 2 — exercise the *real* implementation
 * path used by the runtime. `buildFilterCallOptionsFromSettings` is the pure helper
 * that the plugin's private `buildFilterCallOptions` thin-wraps; if either branch
 * (override / DEFAULT inherit) is silently removed, this test FAILs.
 */

import { describe, it, expect } from 'vitest'
import type { WikeyConfig } from 'wikey-core'
import {
  buildFilterCallOptionsFromSettings,
  type FilterCallOptionsInputs,
} from '../main'

function configWith(basicModel: string, anthropicKey = ''): WikeyConfig {
  return {
    WIKEY_BASIC_MODEL: basicModel,
    WIKEY_SEARCH_BACKEND: 'basic',
    WIKEY_SEARCH_ENGINE: 'orama',
    WIKEY_MODEL: '',
    WIKEY_QMD_TOP_N: 5,
    GEMINI_API_KEY: '',
    ANTHROPIC_API_KEY: anthropicKey,
    OPENAI_API_KEY: '',
    OLLAMA_URL: '',
    INGEST_PROVIDER: '',
    LINT_PROVIDER: '',
    SUMMARIZE_PROVIDER: '',
    CONTEXTUAL_MODEL: 'gemma',
    COST_LIMIT: 50,
  }
}

const baseSettings: FilterCallOptionsInputs = {
  advancedQueryTuningProvider: '',
  advancedQueryTuningModel: '',
  advancedQueryTuningTemperature: 0.0,
  advancedQueryTuningMaxTokens: 500,
  advancedQueryTuningTimeoutMs: 5000,
}

describe('buildFilterCallOptionsFromSettings — Q1 LOCKED DEFAULT inherit', () => {
  it("DEFAULT (override empty) + basicModel='ollama' → provider=ollama (inherit)", () => {
    const out = buildFilterCallOptionsFromSettings(baseSettings, configWith('ollama'))
    expect(out.provider).toBe('ollama')
    expect(typeof out.model).toBe('string')
    expect((out.model ?? '').length).toBeGreaterThan(0)
  })

  it("DEFAULT + basicModel='gemini' → provider=gemini (inherit)", () => {
    const out = buildFilterCallOptionsFromSettings(baseSettings, configWith('gemini'))
    expect(out.provider).toBe('gemini')
  })

  it("DEFAULT + basicModel='claude-code' + ANTHROPIC_API_KEY set → provider=anthropic", () => {
    const out = buildFilterCallOptionsFromSettings(
      baseSettings,
      configWith('claude-code', 'sk-test'),
    )
    expect(out.provider).toBe('anthropic')
  })

  it("DEFAULT + basicModel='claude-code' + no API key → provider=ollama (resolveProvider fallback)", () => {
    const out = buildFilterCallOptionsFromSettings(baseSettings, configWith('claude-code'))
    expect(out.provider).toBe('ollama')
  })

  it("Explicit override provider='openai' wins over DEFAULT", () => {
    const out = buildFilterCallOptionsFromSettings(
      { ...baseSettings, advancedQueryTuningProvider: 'openai', advancedQueryTuningModel: 'gpt-4o' },
      configWith('ollama'),
    )
    expect(out.provider).toBe('openai')
    expect(out.model).toBe('gpt-4o')
  })

  it('Explicit override provider w/o model → model undefined (provider default kicks in at LLMClient)', () => {
    const out = buildFilterCallOptionsFromSettings(
      { ...baseSettings, advancedQueryTuningProvider: 'gemini' },
      configWith('ollama'),
    )
    expect(out.provider).toBe('gemini')
    expect(out.model).toBeUndefined()
  })

  it('temperature / maxTokens / timeout fields forwarded verbatim', () => {
    const out = buildFilterCallOptionsFromSettings(
      {
        ...baseSettings,
        advancedQueryTuningTemperature: 0.7,
        advancedQueryTuningMaxTokens: 800,
        advancedQueryTuningTimeoutMs: 3000,
      },
      configWith('ollama'),
    )
    expect(out.temperature).toBe(0.7)
    expect(out.maxTokens).toBe(800)
    expect(out.timeout).toBe(3000)
  })

  // §5.7.9 AC-3 — gemini-2.5 thinking opt-out for advanced query tuning.
  // 4 layer (filter / rewriter / expander / analyzer) 모두 결정적 짧은 JSON,
  // thinking 모드 활성 시 maxTokens 다 소진 → 응답 절단 → 'llm-fail' fallback.
  it('thinkingBudget=0 always present (gemini-2.5 compatibility)', () => {
    const out = buildFilterCallOptionsFromSettings(baseSettings, configWith('gemini'))
    expect(out.thinkingBudget).toBe(0)
  })

  it('thinkingBudget=0 even with explicit override (other providers ignore the field)', () => {
    const out = buildFilterCallOptionsFromSettings(
      { ...baseSettings, advancedQueryTuningProvider: 'openai', advancedQueryTuningModel: 'gpt-4o' },
      configWith('gemini'),
    )
    expect(out.thinkingBudget).toBe(0)
  })
})
