/**
 * §5.6.4 — LLMCallOptions × provider × auth-path support matrix.
 *
 * Plan: plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md §3.7 (nested shape, 48 cells).
 *
 * Sources for cell values:
 *   - gemini  --help (v0.40.1)  → only `-m <model>` flag forwards
 *   - claude  --help (v2.1.140) → only `--model <id>` flag forwards
 *   - codex   --help (v0.128.0) → only `-m <id>` flag forwards
 *   - Gemini API docs   (v1beta /generateContent) — generationConfig fields
 *   - Anthropic API     (v1/messages)             — model + max_tokens + temperature
 *   - OpenAI API        (v1/chat/completions)     — model + temperature + max_tokens + response_format
 *
 * SupportLevel taxonomy (plan §3.7):
 *   - 'native'      : provider forwards option verbatim (API path or matching CLI flag)
 *   - 'flag'        : subscription CLI accepts a CLI flag (mapOptionsToCliArgs emits it)
 *   - 'ignore'      : subscription CLI silently drops the option; debug warning surfaced
 *   - 'unsupported' : neither path supports it AND caller must fall back / throw (jsonMode)
 *   - 'na'          : option is N/A for this provider entirely (e.g. thinkingBudget on Anthropic)
 */

import type {
  AuthPath,
  LLMCallOptions,
  LLMCliOptionField,
  SubscriptionProvider,
  CliOptionMatrixProvider,
} from './types.js'

export type SupportLevel = 'native' | 'flag' | 'ignore' | 'unsupported' | 'na'

/**
 * §3.7 matrix — 4 providers × 2 paths × 8 fields = 64 cells.
 *
 * §5.6.5 Step C (2026-05-14) — ollama-cloud row added (PoC §0 §4 LOCK).
 * Cloud uses SSH+signin auth, no CLI OAuth path → subscription column all 'na'.
 * The api column reflects the `/api/chat` HTTP body fields callOllama already
 * builds (model / temperature / num_predict / format:json), with 'na' for
 * Ollama-internal absent concepts (seed, responseMimeType).
 */
export const CLI_OPTION_SUPPORT: Record<
  CliOptionMatrixProvider,
  Record<AuthPath, Record<LLMCliOptionField, SupportLevel>>
> = {
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
  // §5.6.5 v0.5 — ollama-cloud row (user lock 2026-05-14, "다른 LLM과 동일한
  // 구조"). api column = `/api/chat` HTTP body fields callOllama wires
  // (Bearer header when AUTH_MODE='api'). subscription column = no CLI flag
  // surface — `ollama signin` only registers the SSH key; the actual chat
  // call still hits `/api/chat` with no auth header (relies on the local
  // signin state). Mirrors the gemini/anthropic/openai subscription-row
  // semantics: model='flag' is conceptual (caller bakes the model into the
  // HTTP body, no CLI arg); the rest are 'native' / 'na' as appropriate.
  'ollama-cloud': {
    api: {
      model: 'native',           // body.model
      temperature: 'native',     // body.options.temperature
      maxTokens: 'native',       // body.options.num_predict
      seed: 'na',                // Ollama API has no deterministic seed field
      responseMimeType: 'na',    // not a concept in /api/chat
      jsonMode: 'native',        // body.format='json' (M5 markdown-wrap stripped post-fetch)
      thinkingBudget: 'na',      // body.think bool only, no numeric budget
      timeout: 'native',         // HTTP request timeout
    },
    subscription: {
      model: 'native',           // body.model (signin path also uses /api/chat)
      temperature: 'native',
      maxTokens: 'native',
      seed: 'na',
      responseMimeType: 'na',
      jsonMode: 'native',
      thinkingBudget: 'na',
      timeout: 'native',
    },
  },
}

/**
 * CLI version snapshot — PoC pinned 2026-05-13.
 * `scripts/check-cli-versions.sh --strict` compares runtime `--version` against this
 * snapshot; drift detection forces matrix review (plan §3.7.1).
 */
export const CLI_VERSION_SNAPSHOT = {
  gemini: { major: 0, minor: 40, patch: 1, probedAt: '2026-05-13' },
  anthropic: { major: 2, minor: 1, patch: 140, probedAt: '2026-05-13' },
  openai: { major: 0, minor: 128, patch: 0, probedAt: '2026-05-13' },
  // §5.6.5 Step C — PoC §0 §0 probe (master direct, 2026-05-14).
  ollama: { major: 0, minor: 22, patch: 1, probedAt: '2026-05-14' },
} as const

/**
 * Per-subscription-CLI model flag. CLI flag *name* differs by binary:
 *   - gemini : `-m <model>`         (single dash, short flag)
 *   - claude : `--model <id>`       (double dash, long flag)
 *   - codex  : `-m <id>`            (single dash, short flag)
 */
const SUBSCRIPTION_MODEL_FLAG: Record<SubscriptionProvider, string> = {
  gemini: '-m',
  anthropic: '--model',
  openai: '-m',
  // §5.6.5 v0.5 — ollama-cloud subscription path doesn't shell out for chat;
  // the model is baked into the HTTP body (callOllama). Kept for type
  // completeness; not consumed by mapOptionsToCliArgs.
  'ollama-cloud': '',
}

export interface MapOptionsResult {
  /** Args appended to the CLI base argv (after `-p` / `exec -` etc.). */
  readonly args: string[]
  /** Stderr-style warnings emitted when WIKEY_DEBUG_AUTH=1; safe to ignore otherwise. */
  readonly warnings: string[]
  /** Sentinel: caller MUST fall back to API path when `jsonMode` requested on subscription. */
  readonly unsupported: 'jsonMode' | null
}

/**
 * Translate LLMCallOptions into CLI args for the chosen subscription provider.
 *
 * Caller contract:
 *   - api path: this function is a no-op (returns empty args). API path uses
 *     LLMCallOptions natively via HTTP body — no CLI translation needed.
 *   - subscription path:
 *       - `model` → flag forwarded
 *       - `temperature` / `maxTokens` / `seed` / `thinkingBudget` → silent ignore + warning
 *       - `jsonMode` / `responseMimeType==='application/json'` → unsupported sentinel
 *         (caller calls onAuthFallback({reason:'jsonMode-unsupported'}) + API path)
 */
export function mapOptionsToCliArgs(
  provider: SubscriptionProvider,
  path: AuthPath,
  opts: LLMCallOptions,
): MapOptionsResult {
  const args: string[] = []
  const warnings: string[] = []
  let unsupported: 'jsonMode' | null = null

  if (path !== 'subscription') {
    return { args, warnings, unsupported }
  }

  if (opts.model !== undefined && opts.model !== '') {
    args.push(SUBSCRIPTION_MODEL_FLAG[provider], opts.model)
  }

  if (opts.jsonMode === true || opts.responseMimeType === 'application/json') {
    unsupported = 'jsonMode'
  }

  if (opts.temperature !== undefined) {
    warnings.push(`[${provider}/subscription] temperature option ignored — CLI does not accept it`)
  }
  if (opts.maxTokens !== undefined) {
    warnings.push(`[${provider}/subscription] maxTokens option ignored — CLI does not accept it`)
  }
  if (opts.seed !== undefined) {
    warnings.push(`[${provider}/subscription] seed option ignored — CLI does not accept it`)
  }
  if (opts.thinkingBudget !== undefined && CLI_OPTION_SUPPORT[provider].subscription.thinkingBudget === 'ignore') {
    warnings.push(`[${provider}/subscription] thinkingBudget option ignored — CLI does not accept it`)
  }

  return { args, warnings, unsupported }
}
