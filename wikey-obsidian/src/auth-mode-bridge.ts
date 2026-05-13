/**
 * §5.6.4.1 A5 — auth-mode bridge between Obsidian plugin Settings and wikey-core WikeyConfig.
 *
 * Plan: plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md §3.4 / §5.2 A5.
 *
 * Override priority (highest first):
 *   1. process.env.WIKEY_<PROVIDER>_AUTH_MODE  (test / CI / dev override)
 *   2. settings.<provider>AuthMode             (loaded from credentials.json `auth.<provider>.mode`)
 *   3. 'auto'                                  (default)
 *
 * Invalid env values fall through to settings (no silent acceptance — see test).
 *
 * Why a separate module: buildConfig() in main.ts is hot path code. The auth
 * mode merge logic is tested in build-config-auth-mode.test.ts and re-used
 * verbatim from main.ts to keep one source of truth.
 */

import type { WikeySettings } from './main.js'

type AuthMode = 'subscription' | 'api' | 'auto'

/**
 * Env var names listed for security-test purposes (case 2 — must NOT appear
 * in scripts-runner env inject list). Used by build-config-auth-mode.test.ts.
 */
export const AUTH_MODE_ENV_KEYS = [
  'WIKEY_GEMINI_AUTH_MODE',
  'WIKEY_ANTHROPIC_AUTH_MODE',
  'WIKEY_OPENAI_AUTH_MODE',
] as const

function resolveMode(envValue: string | undefined, settingsValue: AuthMode): AuthMode {
  if (envValue === 'subscription' || envValue === 'api' || envValue === 'auto') return envValue
  return settingsValue
}

export interface AuthModesConfigSlice {
  readonly GEMINI_AUTH_MODE: AuthMode
  readonly ANTHROPIC_AUTH_MODE: AuthMode
  readonly OPENAI_AUTH_MODE: AuthMode
}

/**
 * Build the auth-mode triplet to merge into WikeyConfig.
 * Called by buildConfig() in main.ts:1561 and verified by build-config-auth-mode.test.ts.
 */
export function buildAuthModesForConfig(settings: WikeySettings): AuthModesConfigSlice {
  return {
    GEMINI_AUTH_MODE: resolveMode(process.env.WIKEY_GEMINI_AUTH_MODE, settings.geminiAuthMode),
    ANTHROPIC_AUTH_MODE: resolveMode(process.env.WIKEY_ANTHROPIC_AUTH_MODE, settings.anthropicAuthMode),
    OPENAI_AUTH_MODE: resolveMode(process.env.WIKEY_OPENAI_AUTH_MODE, settings.openaiAuthMode),
  }
}
