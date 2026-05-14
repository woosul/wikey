/**
 * §5.6.4 commit 15 (2026-05-14) — adaptive jsonMode dispatch helper.
 *
 * User raise (2026-05-14): real ingest with anthropic subscription threw
 * "anthropic subscription does not support jsonMode" because canonicalizer +
 * ingest-pipeline LLM helpers unconditionally set `jsonMode: true`.
 *
 * Single source of truth for the matrix lookup + prompt prefix used by both
 * `canonicalizer.callLLMWithRetry` and `ingest-pipeline.callLLMWithRetry`.
 *
 * Behavior:
 *   - `config` absent → legacy `jsonMode:true` retained (backward-compat for
 *     unit tests that mock the LLM but do not thread a full WikeyConfig)
 *   - provider = 'ollama' → native (out of the subscription CLI matrix)
 *   - provider × configured AuthPath cell in CLI_OPTION_SUPPORT === 'native'
 *     → native (Gemini API, Anthropic API, OpenAI API today)
 *   - otherwise → unsupported (subscription CLIs that lack a JSON-mode flag)
 *
 * Fallback 0 policy (per user decision 2026-05-14): when unsupported, the
 * caller STRIPS the jsonMode/responseMimeType flags AND prefixes the prompt
 * with an 'Output ONLY a valid JSON object' instruction. No try/catch + retry
 * on API path — the user switches mode via the Settings dropdown if needed.
 */

import type { CliOptionMatrixProvider, SubscriptionProvider, WikeyConfig } from './types.js'
import { getConfiguredAuthPath } from './auth-resolver.js'
import { CLI_OPTION_SUPPORT } from './provider-cli-options.js'

/**
 * Steers subscription CLIs that cannot enforce JSON natively (anthropic /
 * openai / gemini -p) to emit raw JSON. `extractJsonBlock` then parses via
 * its 3-tier (fenced / bare-object / range) handler.
 */
export const JSON_ONLY_PROMPT_PREFIX =
  'Output ONLY a valid JSON object. No markdown. No code fence. No prose. Just raw JSON.\n\n'

/**
 * Resolve whether the LLM call site can rely on a native jsonMode flag.
 * See module header for the truth table.
 */
export function resolveJsonModeNative(provider: string, config?: WikeyConfig): boolean {
  if (!config) return true
  // §5.6.5 v0.5 — local Ollama still has no CLI matrix row at all (callOllama
  // bypasses the matrix), so we short-circuit before the lookup. ollama-cloud
  // now lives inside SubscriptionProvider and flows through the generic
  // matrix lookup with the rest.
  if (provider === 'ollama') return true
  const sub = provider as SubscriptionProvider
  const matrixRow = CLI_OPTION_SUPPORT[sub] as
    | (typeof CLI_OPTION_SUPPORT)[CliOptionMatrixProvider]
    | undefined
  if (!matrixRow) return true
  const authPath = getConfiguredAuthPath(sub, config)
  return matrixRow[authPath].jsonMode === 'native'
}

/**
 * Assemble LLMCallOptions for a JSON-returning LLM call.
 *
 * When `jsonModeNative === false` the jsonMode + responseMimeType flags are
 * both omitted — subscription CLIs that reject those flags will then succeed.
 * Gemini's `responseMimeType: 'application/json'` is preserved only on the
 * native path (gemini api in current matrix).
 */
export function buildAdaptiveLlmOpts(
  provider: string,
  model: string,
  jsonModeNative: boolean,
  detOpts: { temperature?: number; seed?: number },
): Record<string, unknown> {
  if (!jsonModeNative) {
    return { provider, model, ...detOpts }
  }
  return provider === 'gemini'
    ? { provider, model, responseMimeType: 'application/json' as const, jsonMode: true, ...detOpts }
    : { provider, model, jsonMode: true, ...detOpts }
}
