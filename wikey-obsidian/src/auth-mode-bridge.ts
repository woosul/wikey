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

// ── §5.6.6 — Subscription mode bridge (cli / rest / pending) ──────────────

type SubscriptionMode = 'cli' | 'rest' | 'pending'

/**
 * Env var names that override per-provider subscription mode. Listed so the
 * security test in build-config-subscription-mode.test.ts can verify the
 * scripts-runner inject list never leaks these (parity with AUTH_MODE_ENV_KEYS).
 */
export const SUBSCRIPTION_MODE_ENV_KEYS = [
  'WIKEY_GEMINI_SUBSCRIPTION_MODE',
  'WIKEY_ANTHROPIC_SUBSCRIPTION_MODE',
  'WIKEY_OPENAI_SUBSCRIPTION_MODE',
] as const

function normalizeSubMode(
  raw: string | undefined,
  fallback: SubscriptionMode,
): SubscriptionMode {
  if (raw === 'cli' || raw === 'rest' || raw === 'pending') return raw
  return fallback
}

function resolveSubMode(
  envValue: string | undefined,
  settingsValue: SubscriptionMode | undefined,
): SubscriptionMode {
  // env: only valid §5.6.6 values are accepted (no silent acceptance of typos).
  if (envValue === 'cli' || envValue === 'rest' || envValue === 'pending') return envValue
  // settings: legacy installs (pre-§5.6.6) carry no field — fall back to 'pending'
  // so resolveSubscriptionMode in wikey-core surfaces Step A0 not-decided state.
  return normalizeSubMode(settingsValue, 'pending')
}

export interface SubscriptionModesConfigSlice {
  readonly GEMINI_SUBSCRIPTION_MODE: SubscriptionMode
  readonly ANTHROPIC_SUBSCRIPTION_MODE: SubscriptionMode
  readonly OPENAI_SUBSCRIPTION_MODE: SubscriptionMode
}

/**
 * §5.6.6 — Build the subscription-mode triplet to merge into WikeyConfig.
 * Called by buildConfig() in main.ts and verified by
 * build-config-subscription-mode.test.ts. Override priority:
 *
 *   1. process.env.WIKEY_<PROVIDER>_SUBSCRIPTION_MODE  (test / CI / dev)
 *   2. settings.<provider>SubscriptionMode             (Settings UI / data.json)
 *   3. 'pending'                                       (Step A0 not yet applied)
 *
 * Kill-switch envs (WIKEY_<PROVIDER>_REST_DISABLE=1) are honored in
 * wikey-core/auth-resolver.ts:resolveSubscriptionMode, *not* here — that
 * forces 'cli' regardless of what this bridge resolves, matching Spec I16.
 */
export function buildSubscriptionModesForConfig(
  settings: WikeySettings,
): SubscriptionModesConfigSlice {
  return {
    GEMINI_SUBSCRIPTION_MODE: resolveSubMode(
      process.env.WIKEY_GEMINI_SUBSCRIPTION_MODE,
      settings.geminiSubscriptionMode,
    ),
    ANTHROPIC_SUBSCRIPTION_MODE: resolveSubMode(
      process.env.WIKEY_ANTHROPIC_SUBSCRIPTION_MODE,
      settings.anthropicSubscriptionMode,
    ),
    OPENAI_SUBSCRIPTION_MODE: resolveSubMode(
      process.env.WIKEY_OPENAI_SUBSCRIPTION_MODE,
      settings.openaiSubscriptionMode,
    ),
  }
}
