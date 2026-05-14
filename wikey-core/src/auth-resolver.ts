/**
 * §5.6.4 — auth mode resolver + fallback trigger detector.
 *
 * Plan: docs/planning/phase-5/phase-5-todox-5.6.4-llm-subscription.md §3.2 / §5.2 A2.
 *
 * `resolveAuthMode` collapses the user's per-provider mode preference
 * (`none` / `subscription` / `api`) + credential presence into the binary
 * AuthPath the caller actually executes. v0.7 (2026-05-14) — 'auto' polished
 * out: explicit user choice replaces silent subscription→API fallback so
 * API-key spend never happens without consent.
 *
 * `detectFallbackTrigger` still classifies a subscription-path failure into
 * the AuthFallbackInfo.reason union — but the classification now feeds UI
 * notices (no automatic retry on the API path). Users surface the failure,
 * then manually switch mode if they want the API key path.
 */

import type {
  AuthMode,
  AuthPath,
  AuthFallbackInfo,
  SubscriptionProvider,
  WikeyConfig,
} from './types.js'

export interface CredentialPresence {
  readonly hasSubscription: boolean
  readonly hasApiKey: boolean
}

const AUTH_MODE_KEY: Record<SubscriptionProvider, keyof WikeyConfig> = {
  gemini: 'GEMINI_AUTH_MODE',
  anthropic: 'ANTHROPIC_AUTH_MODE',
  openai: 'OPENAI_AUTH_MODE',
  // §5.6.5 v0.5 — ollama-cloud joined SubscriptionProvider.
  'ollama-cloud': 'OLLAMA_CLOUD_AUTH_MODE',
}

/**
 * Read raw config value + migrate legacy 'auto' → 'subscription' (user plan v0.7
 * backward-compat). Unknown / undefined values fall through to the v0.7 default
 * ('subscription') — matches Settings UI default.
 */
function readAuthMode(provider: SubscriptionProvider, config: WikeyConfig): AuthMode {
  const value = config[AUTH_MODE_KEY[provider]] as AuthMode | 'auto' | undefined
  if (value === 'none' || value === 'subscription' || value === 'api') return value
  // Legacy 'auto' values written before v0.7 migrate to 'subscription' (the
  // closest non-fallback semantic — subscription-first remains the default
  // user expectation when API key spend gate is implicit).
  if (value === 'auto') return 'subscription'
  return 'subscription'
}

/**
 * §5.6.4 commit 15 (2026-05-14) — Pure read of the user's configured AuthPath
 * (subscription / api) without touching credential presence. Used by LLM call
 * sites (canonicalizer, ingest-pipeline.callLLMWithRetry) to look up the
 * `CLI_OPTION_SUPPORT[provider][path].jsonMode` cell *before* dispatching, so
 * unsupported subscription paths can strip the `jsonMode` flag and rely on a
 * prompt-instructed JSON contract instead of triggering a CLI error.
 *
 * Behavior:
 *   - reads WikeyConfig.{PROVIDER}_AUTH_MODE
 *   - legacy 'auto' → 'subscription' (matches `readAuthMode` migration)
 *   - 'none' → 'subscription' (gate is `resolveAuthMode` — this helper is
 *     a *path lookup* only, not a permission check)
 *   - default (undefined) → 'subscription' (matches Settings UI default)
 *
 * Pure function — no fs / network / credential presence read.
 */
export function getConfiguredAuthPath(
  provider: SubscriptionProvider,
  config: WikeyConfig,
): AuthPath {
  const mode = readAuthMode(provider, config)
  return mode === 'api' ? 'api' : 'subscription'
}

/**
 * §5.2 A2 v0.7 — 6-row truth table (auto polished out). Throws when the
 * requested mode lacks the required credential, or when mode='none'.
 *
 *   authMode='none'                                   → throw (provider disabled)
 *   authMode='subscription' + hasSubscription=true    → 'subscription'
 *   authMode='subscription' + hasSubscription=false   → throw
 *   authMode='api' + hasApiKey=true                   → 'api'
 *   authMode='api' + hasApiKey=false                  → throw
 */
export function resolveAuthMode(
  provider: SubscriptionProvider,
  config: WikeyConfig,
  presence: CredentialPresence,
): AuthPath {
  const mode = readAuthMode(provider, config)

  if (mode === 'none') {
    throw new Error(`Provider ${provider} is disabled (auth mode = none)`)
  }

  if (mode === 'subscription') {
    if (!presence.hasSubscription) {
      throw new Error(`No subscription credential for ${provider}`)
    }
    return 'subscription'
  }

  // mode === 'api'
  if (!presence.hasApiKey) {
    throw new Error(`No API key for ${provider}`)
  }
  return 'api'
}

// ── §5.6.6 — per-provider subscription mode resolver ─────────────────────

/** Subset of SubscriptionProvider that has a REST direct paradigm (Spec §1.1). */
export type RESTSubscriptionProvider = 'gemini' | 'anthropic' | 'openai'

const SUBSCRIPTION_MODE_KEY: Record<RESTSubscriptionProvider, keyof WikeyConfig> = {
  gemini: 'GEMINI_SUBSCRIPTION_MODE',
  anthropic: 'ANTHROPIC_SUBSCRIPTION_MODE',
  openai: 'OPENAI_SUBSCRIPTION_MODE',
}

const REST_DISABLE_ENV: Record<RESTSubscriptionProvider, string> = {
  gemini: 'WIKEY_GEMINI_REST_DISABLE',
  anthropic: 'WIKEY_ANTHROPIC_REST_DISABLE',
  openai: 'WIKEY_OPENAI_REST_DISABLE',
}

/**
 * §5.6.6 — resolve per-provider subscription mode (cli / rest / pending).
 *
 * Priority (highest first):
 *   1. Kill-switch env `WIKEY_<PROVIDER>_REST_DISABLE=1` → forced 'cli' (Spec I16).
 *   2. `config.<PROVIDER>_SUBSCRIPTION_MODE`            → caller's choice.
 *   3. 'pending'                                         → Step A0 Legal Gate
 *      not yet decided. Caller (llm-client.ts) translates to a 'cli' fallback
 *      with a Notice (Spec §1.3.2 defaultModeForApprovalState).
 *
 * Pure function — no fs / network access. `ollama-cloud` is intentionally
 * excluded (§5.6.5 uses HTTP API + Bearer header, not the REST direct
 * paradigm — separate cycle).
 */
export function resolveSubscriptionMode(
  provider: RESTSubscriptionProvider,
  config: WikeyConfig,
): 'cli' | 'rest' | 'pending' {
  if (process.env[REST_DISABLE_ENV[provider]] === '1') return 'cli'
  const value = config[SUBSCRIPTION_MODE_KEY[provider]] as
    | 'cli'
    | 'rest'
    | 'pending'
    | undefined
  if (value === 'cli' || value === 'rest' || value === 'pending') return value
  return 'pending'
}

/**
 * §3.9 — classify a subscription-path failure signal into AuthFallbackInfo.reason.
 *
 * v0.7 (2026-05-14) — classification still drives the onAuthFallback callback so
 * the UI can surface a Notice ("Subscription quota exceeded — switch to API key
 * mode?"), but no automatic retry happens on the API path. Users decide.
 *
 * Inputs:
 *   - `status` : HTTP status when subscription path used an HTTP client (rare;
 *                primary path is CLI spawn so 0 by default).
 *   - `stderr` : merged stderr from `spawnCliPrompt`.
 *   - `body`   : optional response body (HTTP path).
 *
 * Order of evaluation:
 *   1. Auth-missing (CLI not logged in) — distinct from quota (no retry on
 *      same path will succeed). Sources: gemini "auth login" / claude "/login"
 *      / codex "login".
 *   2. Quota / rate limit / 401 / 429 — surfaced for Notice mapping.
 *   3. Timeout / spawn errors — typed by the spawn wrapper, not here.
 *   4. null = no actionable trigger (caller surfaces original error).
 */
export function detectFallbackTrigger(input: {
  readonly status: number
  readonly stderr: string
  readonly body: string
}): AuthFallbackInfo['reason'] | null {
  const stderr = input.stderr.toLowerCase()
  const body = input.body.toLowerCase()

  // 1. Auth-missing — CLI explicitly states "not logged in" / "please log in".
  //    Source: gemini --help auth subcommand / claude /login banner / codex login status.
  if (
    /not logged in/.test(stderr) ||
    /please (?:log|sign)\s*in/.test(stderr) ||
    /authentication required/.test(stderr) ||
    /run [`'"]?(?:gemini|claude|codex)[^`'"]* (?:auth )?login/.test(stderr)
  ) {
    return 'auth-missing'
  }

  // 2. Quota / rate limit — HTTP 401 / 429 or stderr keywords.
  //    Sources:
  //      - Anthropic API docs: 429 rate_limit_error, 401 invalid_api_key
  //      - OpenAI API docs:    429 rate_limit_exceeded, 401 invalid_authentication
  //      - Gemini quota error: "quota exceeded" in stderr (vertex / studio)
  if (input.status === 401 || input.status === 429) return 'quota-exceeded'
  if (/rate.?limit/.test(stderr) || /rate.?limit/.test(body)) return 'quota-exceeded'
  if (/quota.*exceed/.test(stderr) || /quota.*exceed/.test(body)) return 'quota-exceeded'

  return null
}
