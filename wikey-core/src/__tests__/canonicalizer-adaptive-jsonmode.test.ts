/**
 * §5.6.4 commit 15 (2026-05-14) — canonicalizer adaptive jsonMode dispatch.
 *
 * User raise (2026-05-14): real ingest with anthropic subscription threw
 * "anthropic subscription does not support jsonMode" because canonicalizer
 * unconditionally set `jsonMode: true` on every LLM call.
 *
 * Fix spec — when `config` is supplied:
 *   - lookup CLI_OPTION_SUPPORT[provider][configuredAuthPath].jsonMode
 *   - 'native' → keep legacy `jsonMode: true` + (Gemini) responseMimeType
 *   - 'unsupported' → strip both flags + prepend 'Output ONLY a valid JSON object'
 *
 * Provider × mode matrix (truth source: provider-cli-options.ts CLI_OPTION_SUPPORT):
 *   gemini subscription    → unsupported (Gemini CLI -p mode has no JSON flag)
 *   gemini api             → native
 *   anthropic subscription → unsupported (`claude -p` no JSON-mode flag)
 *   anthropic api          → native
 *   openai subscription    → unsupported (`codex exec` no JSON-mode flag)
 *   openai api             → native
 *   ollama (out of subscription matrix) → native (legacy behavior preserved)
 *
 * NOTE: The original §5.6.4 commit 15 task brief listed gemini subscription as
 * 'native' — that was a user-side assumption. The actual matrix from PoC CLI
 * probing (2026-05-13) shows gemini -p ignores generationConfig, so it's
 * 'unsupported' too. Tests follow the matrix code, not the brief.
 */

import { describe, it, expect, vi } from 'vitest'
import { canonicalize } from '../canonicalizer.js'
import type { Mention, WikeyConfig } from '../types.js'
import type { LLMClient } from '../llm-client.js'

function makeCapturingLLM(jsonResponse: string): {
  llm: LLMClient
  capturedOpts: any[]
  capturedPrompts: string[]
} {
  const capturedOpts: any[] = []
  const capturedPrompts: string[] = []
  const llm = {
    call: vi.fn().mockImplementation(async (prompt: string, opts: any) => {
      capturedPrompts.push(prompt)
      capturedOpts.push(opts)
      return '```json\n' + jsonResponse + '\n```'
    }),
  } as unknown as LLMClient
  return { llm, capturedOpts, capturedPrompts }
}

const baseArgs = {
  existingEntityBases: [],
  existingConceptBases: [],
  sourceFilename: 'jsonmode-test.pdf',
  rawSourceFilename: 'jsonmode-test.pdf',
  sourcePageBase: 'source-jsonmode-test',
  today: '2026-05-14',
  model: 'flash-or-equivalent',
}

const someMention: Mention[] = [{ name: 'x', type_hint: 'organization', evidence: 'y' }]

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

describe('§5.6.4 commit 15 — canonicalizer adaptive jsonMode', () => {
  it('case 1: gemini subscription → unsupported (no jsonMode, prompt prefix added)', async () => {
    const { llm, capturedOpts, capturedPrompts } = makeCapturingLLM('{"entities":[],"concepts":[]}')
    const config = makeConfig({ GEMINI_AUTH_MODE: 'subscription' })
    await canonicalize({
      ...baseArgs, llm, provider: 'gemini', mentions: someMention, config,
    })
    expect(capturedOpts[0].jsonMode).toBeUndefined()
    expect(capturedOpts[0].responseMimeType).toBeUndefined()
    expect(capturedPrompts[0].startsWith('Output ONLY a valid JSON object')).toBe(true)
  })

  it('case 2: anthropic subscription → unsupported (no jsonMode, prompt prefix added)', async () => {
    const { llm, capturedOpts, capturedPrompts } = makeCapturingLLM('{"entities":[],"concepts":[]}')
    const config = makeConfig({ ANTHROPIC_AUTH_MODE: 'subscription' })
    await canonicalize({
      ...baseArgs, llm, provider: 'anthropic', mentions: someMention, config,
    })
    expect(capturedOpts[0].jsonMode).toBeUndefined()
    expect(capturedOpts[0].responseMimeType).toBeUndefined()
    expect(capturedPrompts[0].startsWith('Output ONLY a valid JSON object')).toBe(true)
  })

  it('case 3: anthropic api → native (jsonMode flag, no prompt prefix)', async () => {
    const { llm, capturedOpts, capturedPrompts } = makeCapturingLLM('{"entities":[],"concepts":[]}')
    const config = makeConfig({ ANTHROPIC_AUTH_MODE: 'api' })
    await canonicalize({
      ...baseArgs, llm, provider: 'anthropic', mentions: someMention, config,
    })
    expect(capturedOpts[0].jsonMode).toBe(true)
    expect(capturedPrompts[0].startsWith('Output ONLY')).toBe(false)
  })

  it('case 4: openai subscription → unsupported (no jsonMode, prompt prefix added)', async () => {
    const { llm, capturedOpts, capturedPrompts } = makeCapturingLLM('{"entities":[],"concepts":[]}')
    const config = makeConfig({ OPENAI_AUTH_MODE: 'subscription' })
    await canonicalize({
      ...baseArgs, llm, provider: 'openai', mentions: someMention, config,
    })
    expect(capturedOpts[0].jsonMode).toBeUndefined()
    expect(capturedOpts[0].responseMimeType).toBeUndefined()
    expect(capturedPrompts[0].startsWith('Output ONLY a valid JSON object')).toBe(true)
  })

  it('case 5: gemini api → native (jsonMode flag)', async () => {
    const { llm, capturedOpts } = makeCapturingLLM('{"entities":[],"concepts":[]}')
    const config = makeConfig({ GEMINI_AUTH_MODE: 'api' })
    await canonicalize({
      ...baseArgs, llm, provider: 'gemini', mentions: someMention, config,
    })
    expect(capturedOpts[0].jsonMode).toBe(true)
    expect(capturedOpts[0].responseMimeType).toBe('application/json')
  })

  it('case 6: ollama (out of subscription matrix) → legacy jsonMode behavior preserved', async () => {
    const { llm, capturedOpts, capturedPrompts } = makeCapturingLLM('{"entities":[],"concepts":[]}')
    const config = makeConfig()
    await canonicalize({
      ...baseArgs, llm, provider: 'ollama', mentions: someMention, config,
    })
    expect(capturedOpts[0].jsonMode).toBe(true)
    expect(capturedPrompts[0].startsWith('Output ONLY')).toBe(false)
  })

  it('config absent → legacy jsonMode:true behavior (backward compat for unit tests)', async () => {
    const { llm, capturedOpts, capturedPrompts } = makeCapturingLLM('{"entities":[],"concepts":[]}')
    await canonicalize({
      ...baseArgs, llm, provider: 'anthropic', mentions: someMention,
      // no config — legacy path
    })
    expect(capturedOpts[0].jsonMode).toBe(true)
    expect(capturedPrompts[0].startsWith('Output ONLY')).toBe(false)
  })
})
