/**
 * §5.6.5 Step C — ollama-cloud row added to CLI_OPTION_SUPPORT matrix.
 *
 * Shape:
 *   - 4 CliOptionMatrixProvider (gemini/anthropic/openai/ollama-cloud)
 *   - 2 AuthPath (api/subscription)
 *   - 8 LLMCliOptionField
 *   = 64 cells total (was 48 in §5.6.4).
 *
 * Test coverage (todox §5.6.5.3 Step C):
 *   - C1: matrix shape literal — Object.keys(CLI_OPTION_SUPPORT).length === 4
 *   - C2: resolveJsonModeNative ollama vs ollama-cloud branching
 *   - C3: gemini/anthropic/openai cells byte-equal to §5.6.4 v0.7 (no regression)
 *   - C4: PoC §0 §4 — ollama-cloud.api cells reflect /api/chat HTTP body shape
 */

import { describe, it, expect } from 'vitest'
import {
  CLI_OPTION_SUPPORT,
  CLI_VERSION_SNAPSHOT,
} from '../provider-cli-options.js'
import { resolveJsonModeNative } from '../adaptive-json-mode.js'
import type { WikeyConfig } from '../types.js'

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
  GEMINI_AUTH_MODE: 'api',
  ANTHROPIC_AUTH_MODE: 'api',
  OPENAI_AUTH_MODE: 'api',
}

describe('§5.6.5 Step C — CLI_OPTION_SUPPORT 64-cell matrix', () => {
  it('C1: row count is 4 (gemini/anthropic/openai/ollama-cloud)', () => {
    const rows = Object.keys(CLI_OPTION_SUPPORT).sort()
    expect(rows).toEqual(['anthropic', 'gemini', 'ollama-cloud', 'openai'])
    expect(rows).toHaveLength(4)
  })

  it('C1: total cell count is 64 (4 × 2 × 8)', () => {
    let count = 0
    for (const provider of Object.keys(CLI_OPTION_SUPPORT)) {
      const row = CLI_OPTION_SUPPORT[provider as keyof typeof CLI_OPTION_SUPPORT]
      for (const path of Object.keys(row)) {
        const pathRow = row[path as keyof typeof row]
        count += Object.keys(pathRow).length
      }
    }
    expect(count).toBe(64)
  })

  it('C3 regression: gemini.api.jsonMode unchanged', () => {
    expect(CLI_OPTION_SUPPORT.gemini.api.jsonMode).toBe('native')
    expect(CLI_OPTION_SUPPORT.gemini.subscription.jsonMode).toBe('unsupported')
  })

  it('C3 regression: anthropic.api.jsonMode + .subscription.jsonMode unchanged', () => {
    expect(CLI_OPTION_SUPPORT.anthropic.api.jsonMode).toBe('native')
    expect(CLI_OPTION_SUPPORT.anthropic.subscription.jsonMode).toBe('unsupported')
  })

  it('C3 regression: openai.api.jsonMode + .subscription.jsonMode unchanged', () => {
    expect(CLI_OPTION_SUPPORT.openai.api.jsonMode).toBe('native')
    expect(CLI_OPTION_SUPPORT.openai.subscription.jsonMode).toBe('unsupported')
  })

  it("C4: ollama-cloud.api.jsonMode = 'native' (PoC §0 §4 LOCK, format:json supported)", () => {
    expect(CLI_OPTION_SUPPORT['ollama-cloud'].api.jsonMode).toBe('native')
  })

  it("C4 (v0.5): ollama-cloud.subscription column mirrors api semantics (HTTP body, no CLI flag surface)", () => {
    // §5.6.5 v0.5 — ollama-cloud joined SubscriptionProvider (user lock
    // 2026-05-14, "다른 LLM과 동일한 구조"). Both auth paths still hit
    // /api/chat directly, so the subscription column carries the same
    // native/na cells as the api column.
    const subRow = CLI_OPTION_SUPPORT['ollama-cloud'].subscription
    expect(subRow.model).toBe('native')
    expect(subRow.temperature).toBe('native')
    expect(subRow.maxTokens).toBe('native')
    expect(subRow.jsonMode).toBe('native')
    expect(subRow.timeout).toBe('native')
    expect(subRow.seed).toBe('na')
    expect(subRow.responseMimeType).toBe('na')
    expect(subRow.thinkingBudget).toBe('na')
  })

  it('C4: ollama-cloud.api reflects /api/chat HTTP body (model/temperature/maxTokens/timeout native)', () => {
    const apiRow = CLI_OPTION_SUPPORT['ollama-cloud'].api
    expect(apiRow.model).toBe('native')
    expect(apiRow.temperature).toBe('native')
    expect(apiRow.maxTokens).toBe('native')
    expect(apiRow.timeout).toBe('native')
    // seed / responseMimeType / thinkingBudget — Ollama API has no such field
    expect(apiRow.seed).toBe('na')
    expect(apiRow.responseMimeType).toBe('na')
    expect(apiRow.thinkingBudget).toBe('na')
  })

  it('C1: CLI_VERSION_SNAPSHOT includes ollama version (PoC §0 §0)', () => {
    expect(CLI_VERSION_SNAPSHOT.ollama).toBeDefined()
    expect(CLI_VERSION_SNAPSHOT.ollama.major).toBe(0)
    expect(CLI_VERSION_SNAPSHOT.ollama.minor).toBe(22)
    expect(CLI_VERSION_SNAPSHOT.ollama.probedAt).toBe('2026-05-14')
  })
})

describe('§5.6.5 Step C — resolveJsonModeNative branching', () => {
  it("C2: 'ollama' (local) → true (short-circuit, no matrix lookup)", () => {
    expect(resolveJsonModeNative('ollama', baseConfig)).toBe(true)
  })

  it("C2: 'ollama-cloud' → true (matrix lookup, api.jsonMode === 'native')", () => {
    expect(resolveJsonModeNative('ollama-cloud', baseConfig)).toBe(true)
  })

  it("C2: 'gemini' + AUTH_MODE='api' → true (matrix lookup)", () => {
    expect(resolveJsonModeNative('gemini', baseConfig)).toBe(true)
  })

  it("C2: 'anthropic' + AUTH_MODE='subscription' → false (CLI cannot enforce JSON)", () => {
    const config: WikeyConfig = { ...baseConfig, ANTHROPIC_AUTH_MODE: 'subscription' }
    expect(resolveJsonModeNative('anthropic', config)).toBe(false)
  })

  it("C2: config absent → true (backward-compat for tests that don't thread config)", () => {
    expect(resolveJsonModeNative('ollama-cloud')).toBe(true)
    expect(resolveJsonModeNative('gemini')).toBe(true)
  })
})
