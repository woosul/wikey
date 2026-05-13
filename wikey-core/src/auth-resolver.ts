/**
 * §5.6.4 — auth mode resolver + fallback trigger detector.
 *
 * Plan: plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md §3.2 / §5.2 A2.
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
