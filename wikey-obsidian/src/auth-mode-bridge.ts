/**
 * §5.6.4 A5 — auth-mode bridge between Obsidian plugin Settings and wikey-core WikeyConfig.
 *
 * Plan: docs/planning/phase-5/phase-5-todox-5.6.4-llm-subscription.md §3.4 / §5.2 A5.
 *
 * v0.7 (user plan 2026-05-14) — 'auto' polished out. AuthMode union becomes
 * `'none' | 'subscription' | 'api'`. Legacy 'auto' values from older configs
 * migrate to 'subscription' at this boundary (single migration point so the
 * runtime never sees 'auto').
 *
 * Override priority (highest first):
 *   1. process.env.WIKEY_<PROVIDER>_AUTH_MODE  (test / CI / dev override)
 *   2. settings.<provider>AuthMode             (loaded from credentials.json `auth.<provider>.mode`)
 *   3. 'subscription'                          (v0.7 default)
 *
 * Invalid env values fall through to settings (no silent acceptance — see test).
 * Legacy 'auto' values are migrated, not rejected (backward-compat).
 *
 * Why a separate module: buildConfig() in main.ts is hot path code. The auth
 * mode merge logic is tested in build-config-auth-mode.test.ts and re-used
 * verbatim from main.ts to keep one source of truth.
 */

import type { WikeySettings } from './main.js'

type AuthMode = 'none' | 'subscription' | 'api'

/**
 * Env var names listed for security-test purposes (case 2 — must NOT appear
 * in scripts-runner env inject list). Used by build-config-auth-mode.test.ts.
 */
export const AUTH_MODE_ENV_KEYS = [
  'WIKEY_GEMINI_AUTH_MODE',
  'WIKEY_ANTHROPIC_AUTH_MODE',
  'WIKEY_OPENAI_AUTH_MODE',
] as const

/**
 * Migrate legacy 'auto' values (written by v0.6 and earlier) to 'subscription'.
 * Single migration point so the runtime never observes 'auto'.
 */
function normalizeMode(raw: string | undefined, fallback: AuthMode): AuthMode {
  if (raw === 'none' || raw === 'subscription' || raw === 'api') return raw
  if (raw === 'auto') return 'subscription'
  return fallback
}

function resolveMode(envValue: string | undefined, settingsValue: AuthMode): AuthMode {
  // env: only valid v0.7 values are accepted from env (avoid silent acceptance
  // of typos). Legacy 'auto' from env *is* migrated for symmetry with disk reads.
  if (envValue === 'none' || envValue === 'subscription' || envValue === 'api') return envValue
  if (envValue === 'auto') return 'subscription'
  // settings: same migration so a data.json carrying 'auto' from an older
  // install (before loadCredentials migration ran) still resolves cleanly.
  return normalizeMode(settingsValue, 'subscription')
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
