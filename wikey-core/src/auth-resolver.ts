/**
 * §5.6.4 — auth mode resolver + fallback trigger detector.
 *
 * Plan: plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md §3.2 / §5.2 A2.
 *
 * `resolveAuthMode` collapses the 3-state user preference (`subscription` /
 * `api` / `auto`) + credential presence into the binary AuthPath the caller
 * actually executes. `detectFallbackTrigger` classifies a subscription path
 * failure into the AuthFallbackInfo.reason union so the LLMClient can decide
 * whether to retry on the API path.
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

function readAuthMode(provider: SubscriptionProvider, config: WikeyConfig): AuthMode {
  const value = config[AUTH_MODE_KEY[provider]] as AuthMode | undefined
  if (value === 'subscription' || value === 'api' || value === 'auto') return value
  return 'auto'
}

/**
 * §5.2 A2 8-row truth table. Throws when the requested mode lacks the required
 * credential (force-subscription without subscription / force-api without key /
 * auto with neither).
 */
export function resolveAuthMode(
  provider: SubscriptionProvider,
  config: WikeyConfig,
  presence: CredentialPresence,
): AuthPath {
  const mode = readAuthMode(provider, config)

  if (mode === 'subscription') {
    if (!presence.hasSubscription) {
      throw new Error(`No subscription credential for ${provider}`)
    }
    return 'subscription'
  }

  if (mode === 'api') {
    if (!presence.hasApiKey) {
      throw new Error(`No API key for ${provider}`)
    }
    return 'api'
  }

  // 'auto'
  if (presence.hasSubscription) return 'subscription'
  if (presence.hasApiKey) return 'api'
  throw new Error(`No credential for ${provider} (neither subscription nor API key)`)
}

/**
 * §3.9 — classify a subscription-path failure signal into AuthFallbackInfo.reason.
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
 *   2. Quota / rate limit / 401 / 429 — fallback target.
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
