/**
 * §5.6.4.1 Step A3-1 — provider-cli-options 48-cell matrix RED (v0.6 #1g G1).
 *
 * Plan reference:
 *   - plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md §3.7 (nested shape table)
 *
 * Matrix axes:
 *   3 SubscriptionProvider × 2 AuthPath × 8 LLMCliOptionField = 48 cells.
 *
 * Expected matrix mirrors plan §3.7:
 *   - api      row: 'native' for every supported option, 'unsupported'/'na' otherwise.
 *   - subscription row: 'flag' for model (CLI accepts --model/-m), 'ignore' for
 *     temperature/maxTokens/seed/thinkingBudget, 'unsupported' for jsonMode +
 *     responseMimeType, 'native' for timeout (spawn AbortController).
 */

import { describe, it, expect } from 'vitest'
import {
  CLI_OPTION_SUPPORT,
  CLI_VERSION_SNAPSHOT,
  mapOptionsToCliArgs,
} from '../provider-cli-options.js'
import type { LLMCliOptionField, SubscriptionProvider, AuthPath } from '../types.js'

const PROVIDERS: readonly SubscriptionProvider[] = ['gemini', 'anthropic', 'openai']
const PATHS: readonly AuthPath[] = ['api', 'subscription']
const FIELDS: readonly LLMCliOptionField[] = [
  'model',
  'temperature',
  'maxTokens',
  'seed',
  'responseMimeType',
  'jsonMode',
  'thinkingBudget',
  'timeout',
]

// Plan §3.7 truth table (cell = SupportLevel literal).
// Read row-major: provider → path → field → expected level.
const EXPECTED: Record<SubscriptionProvider, Record<AuthPath, Record<LLMCliOptionField, string>>> = {
  gemini: {
    api: {
      model: 'native',
      temperature: 'native',
      maxTokens: 'native',
      seed: 'native',
      responseMimeType: 'native',
      jsonMode: 'native',
      thinkingBudget: 'native',
      timeout: 'native',
    },
    subscription: {
      model: 'flag',
      temperature: 'ignore',
      maxTokens: 'ignore',
      seed: 'ignore',
      responseMimeType: 'unsupported',
      jsonMode: 'unsupported',
      thinkingBudget: 'ignore',
      timeout: 'native',
    },
  },
  anthropic: {
    api: {
      model: 'native',
      temperature: 'native',
      maxTokens: 'native',
      seed: 'unsupported',
      responseMimeType: 'unsupported',
      jsonMode: 'native',
      thinkingBudget: 'na',
      timeout: 'native',
    },
    subscription: {
      model: 'flag',
      temperature: 'ignore',
      maxTokens: 'ignore',
      seed: 'ignore',
      responseMimeType: 'unsupported',
      jsonMode: 'unsupported',
      thinkingBudget: 'na',
      timeout: 'native',
    },
  },
  openai: {
    api: {
      model: 'native',
      temperature: 'native',
      maxTokens: 'native',
      seed: 'unsupported',
      responseMimeType: 'native',
      jsonMode: 'native',
      thinkingBudget: 'na',
      timeout: 'native',
    },
    subscription: {
      model: 'flag',
      temperature: 'ignore',
      maxTokens: 'ignore',
      seed: 'ignore',
      responseMimeType: 'unsupported',
      jsonMode: 'unsupported',
      thinkingBudget: 'na',
      timeout: 'native',
    },
  },
}

describe('§5.6.4 CLI_OPTION_SUPPORT — 48-cell SubscriptionProvider golden (regression scope)', () => {
  // §5.6.5 Step C (2026-05-14) widened the matrix to 4 rows (added
  // ollama-cloud). This test still covers the 3 SubscriptionProvider rows
  // byte-equal to v0.7 — the ollama-cloud row is asserted in
  // provider-cli-options-ollama-cloud.test.ts.
  it('cardinality: 4 rows total (3 SubscriptionProvider + ollama-cloud), each with 2 paths × 8 fields', () => {
    expect(Object.keys(CLI_OPTION_SUPPORT).sort()).toEqual(['anthropic', 'gemini', 'ollama-cloud', 'openai'])
    for (const p of PROVIDERS) {
      expect(Object.keys(CLI_OPTION_SUPPORT[p]).sort()).toEqual(['api', 'subscription'])
      for (const path of PATHS) {
        expect(Object.keys(CLI_OPTION_SUPPORT[p][path]).sort()).toEqual([...FIELDS].sort())
      }
    }
  })

  // 48 assertions — one per cell.
  for (const provider of PROVIDERS) {
    for (const path of PATHS) {
      for (const field of FIELDS) {
        it(`cell: ${provider}.${path}.${field} === ${EXPECTED[provider][path][field]}`, () => {
          expect(CLI_OPTION_SUPPORT[provider][path][field]).toBe(EXPECTED[provider][path][field])
        })
      }
    }
  }
})

describe('§5.6.4 CLI_VERSION_SNAPSHOT — PoC pinned (2026-05-13)', () => {
  it('contains 3 providers with semver triplet + probedAt', () => {
    expect(CLI_VERSION_SNAPSHOT.gemini).toEqual({
      major: 0,
      minor: 40,
      patch: 1,
      probedAt: '2026-05-13',
    })
    expect(CLI_VERSION_SNAPSHOT.anthropic).toEqual({
      major: 2,
      minor: 1,
      patch: 140,
      probedAt: '2026-05-13',
    })
    expect(CLI_VERSION_SNAPSHOT.openai).toEqual({
      major: 0,
      minor: 128,
      patch: 0,
      probedAt: '2026-05-13',
    })
  })
})

describe('§5.6.4 mapOptionsToCliArgs — opts → CLI args + unsupported sentinel', () => {
  it('gemini subscription: opts.model → ["-m", model] flag', () => {
    const result = mapOptionsToCliArgs('gemini', 'subscription', { model: 'gemini-2.5-flash' })
    expect(result.args).toEqual(['-m', 'gemini-2.5-flash'])
    expect(result.unsupported).toBeNull()
  })

  it('claude subscription: opts.model → ["--model", model]', () => {
    const result = mapOptionsToCliArgs('anthropic', 'subscription', { model: 'claude-sonnet-4-5' })
    expect(result.args).toEqual(['--model', 'claude-sonnet-4-5'])
  })

  it('codex subscription: opts.model → ["-m", model]', () => {
    const result = mapOptionsToCliArgs('openai', 'subscription', { model: 'gpt-5' })
    expect(result.args).toEqual(['-m', 'gpt-5'])
  })

  it('subscription + jsonMode → unsupported sentinel surfaced', () => {
    const result = mapOptionsToCliArgs('gemini', 'subscription', { jsonMode: true })
    expect(result.unsupported).toBe('jsonMode')
  })

  it('subscription + temperature → silent ignore (no args, no sentinel)', () => {
    const result = mapOptionsToCliArgs('gemini', 'subscription', { temperature: 0.5 })
    expect(result.args).toEqual([])
    expect(result.unsupported).toBeNull()
    // WIKEY_DEBUG_AUTH=1 stderr warning — surfaced via warnings array
    expect(result.warnings.some((w) => /temperature/.test(w))).toBe(true)
  })
})
