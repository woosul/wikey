/**
 * §5.6.6 Step A — Subscription REST direct shared abstraction.
 *
 * 3 vendor (Google / OpenAI / Anthropic) subscription REST direct path 의 통합
 * abstraction. PoC reference: `docs/spikes/phase-5/5.6.6/poc-{vendor}.mjs`.
 *
 * Spec 1.2 invariants:
 *   - I1: tool use 0 (transport-level — request body 안 tools field 부재)
 *   - I4: OAuth2 standard `grant_type=refresh_token`
 *   - I5: 401 → force refresh + retry 1회 (caller 분기)
 *   - I6: 429/5xx → 즉시 fail (no backoff retry)
 *   - I10: token 본문 conversation/log/Notice 노출 0
 *   - I12: Karpathy Simplicity — ≤ 150 LOC
 *   - I17: refresh response rotation 보존 + atomic write (tmp + rename)
 */

import { writeFile, rename } from 'node:fs/promises'
import { SubscriptionFallbackError } from './llm-client.js'

// Re-export §5.6.4 SubscriptionFallbackError so vendor clients can throw
// without re-importing across files (Karpathy Surgical — no new error class).
export { SubscriptionFallbackError } from './llm-client.js'

/** Vendor identifier used as cache key + matrix selector. */
export type SubscriptionVendor = 'google' | 'openai' | 'anthropic'

/** REST option matrix mapping target vendor (Spec §1.3.1). */
export type RESTMappingVendor = 'gemini' | 'openai' | 'anthropic'

/**
 * In-memory token state. `raw` carries the full vendor-specific JSON so refresh
 * write-back can `{...existing, ...refreshed}` preserve unknown fields (I17).
 */
export interface TokenState {
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresAtMs: number
  readonly raw: unknown
}

/**
 * Common REST call options passed by LLMClient to vendor clients.
 * 6 LLMCallOptions fields (Spec §1.3.1 matrix) plus AbortSignal / timeout.
 */
export interface RESTCallOptions {
  readonly timeout?: number // default 600_000 (§5.6.4 mirror)
  readonly signal?: AbortSignal
  readonly temperature?: number
  readonly seed?: number
  readonly maxTokens?: number
  readonly responseMimeType?: 'application/json' | 'text/plain'
  readonly jsonMode?: boolean
  readonly thinkingBudget?: number
}

/** Result of a single REST call. */
export interface RESTCallResult {
  readonly text: string
  readonly model: string
  readonly latencyMs: number
  readonly usage?: Record<string, unknown>
}

/** Vendor REST client contract (B/C/D each implement this). */
export interface SubscriptionRESTClient {
  loadToken(): Promise<TokenState>
  refreshIfNeeded(state: TokenState): Promise<TokenState>
  call(prompt: string, model: string, opts: RESTCallOptions): Promise<RESTCallResult>
}

/** Refresh threshold — vendor token within 60s of expiry triggers refresh. */
export const REFRESH_THRESHOLD_MS = 60_000

/**
 * Per-vendor refresh promise share (R6 race mitigation). Concurrent calls for
 * the same vendor reuse a single in-flight refresh; promise is removed when
 * settled (success or failure).
 */
const refreshPromiseCache = new Map<SubscriptionVendor, Promise<TokenState>>()

/**
 * Spec §1.2 I5/R6 mitigation: refresh only when expiry is within 60s; share
 * the in-flight promise per vendor to avoid duplicate refreshes.
 */
export async function refreshIfNeededShared(
  vendor: SubscriptionVendor,
  state: TokenState,
  refreshFn: (state: TokenState) => Promise<TokenState>,
): Promise<TokenState> {
  const now = Date.now()
  if (state.expiresAtMs - now > REFRESH_THRESHOLD_MS) return state
  const existing = refreshPromiseCache.get(vendor)
  if (existing) return existing
  const promise = refreshFn(state).finally(() => refreshPromiseCache.delete(vendor))
  refreshPromiseCache.set(vendor, promise)
  return promise
}

/**
 * Spec §1.2 I6 + §1.5 AC-S9/S10/S10b/S11: classify HTTP failure into a typed
 * SubscriptionFallbackError. Returns `null` for 401 — caller handles
 * refresh-and-retry; returns `null` for non-classified status so caller can
 * surface the original.
 */
export function classifyHTTPFailure(status: number): SubscriptionFallbackError | null {
  if (status === 401) return null
  if (status === 429) {
    return new SubscriptionFallbackError('quota-exceeded', `vendor returned 429`)
  }
  if (status >= 500 && status < 600) {
    return new SubscriptionFallbackError('server-error', `vendor returned ${status}`)
  }
  return null
}

/** Per-vendor mapped options handed to fetch body builders. */
export interface VendorMappedOptions {
  readonly body: Record<string, unknown>
  readonly generationConfig?: Record<string, unknown>
}

/**
 * Spec §1.3.1 REST option matrix — single source for vendor-specific option
 * translation. Unsupported fields silently ignore (debug log only). jsonMode on
 * Anthropic throws `SubscriptionFallbackError('jsonMode-unsupported')` per
 * §5.6.4 v0.7 R2.
 */
export function mapOptionsToRESTOptions(
  vendor: RESTMappingVendor,
  opts: RESTCallOptions,
): VendorMappedOptions {
  if (vendor === 'gemini') return mapGeminiOptions(opts)
  if (vendor === 'openai') return mapOpenAIOptions(opts)
  return mapAnthropicOptions(opts)
}

function mapGeminiOptions(opts: RESTCallOptions): VendorMappedOptions {
  const generationConfig: Record<string, unknown> = {}
  if (opts.temperature !== undefined) generationConfig.temperature = opts.temperature
  if (opts.seed !== undefined) generationConfig.seed = opts.seed
  if (opts.maxTokens !== undefined) generationConfig.maxOutputTokens = opts.maxTokens
  if (opts.responseMimeType !== undefined) generationConfig.responseMimeType = opts.responseMimeType
  if (opts.jsonMode === true) generationConfig.responseMimeType = 'application/json'
  if (opts.thinkingBudget !== undefined) generationConfig.thinkingBudget = opts.thinkingBudget
  return { body: {}, generationConfig }
}

function mapOpenAIOptions(opts: RESTCallOptions): VendorMappedOptions {
  const body: Record<string, unknown> = {}
  if (opts.temperature !== undefined) body.temperature = opts.temperature
  if (opts.seed !== undefined) body.seed = opts.seed
  // §5.6.6 v0.7 live fix 2026-05-15 — the private Codex backend
  // (chatgpt.com/backend-api/codex/responses) rejects `max_output_tokens`
  // with HTTP 400 {"detail":"Unsupported parameter: max_output_tokens"}.
  // Drop the parameter (silent ignore + debug log). Vendor-imposed cap.
  if (opts.maxTokens !== undefined) {
    debugIgnoredOptions('openai', { ...opts, maxTokens: opts.maxTokens } as Record<string, unknown>)
  }
  if (opts.jsonMode === true) body.text = { format: 'json_object' }
  // responseMimeType / thinkingBudget unsupported on OpenAI — silent ignore.
  if (opts.responseMimeType !== undefined || opts.thinkingBudget !== undefined) {
    debugIgnoredOptions('openai', opts)
  }
  return { body }
}

function mapAnthropicOptions(opts: RESTCallOptions): VendorMappedOptions {
  if (opts.jsonMode === true) {
    throw new SubscriptionFallbackError(
      'jsonMode-unsupported',
      'anthropic subscription does not support jsonMode',
    )
  }
  const body: Record<string, unknown> = {}
  if (opts.temperature !== undefined) body.temperature = opts.temperature
  if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens
  // seed / responseMimeType / thinkingBudget unsupported — silent ignore.
  if (
    opts.seed !== undefined ||
    opts.responseMimeType !== undefined ||
    opts.thinkingBudget !== undefined
  ) {
    debugIgnoredOptions('anthropic', opts)
  }
  return { body }
}

function debugIgnoredOptions(vendor: RESTMappingVendor, opts: RESTCallOptions): void {
  const ignored: string[] = []
  if (vendor === 'openai') {
    if (opts.responseMimeType !== undefined) ignored.push('responseMimeType')
    if (opts.thinkingBudget !== undefined) ignored.push('thinkingBudget')
  } else if (vendor === 'anthropic') {
    if (opts.seed !== undefined) ignored.push('seed')
    if (opts.responseMimeType !== undefined) ignored.push('responseMimeType')
    if (opts.thinkingBudget !== undefined) ignored.push('thinkingBudget')
  }
  if (ignored.length > 0) {
    console.debug(`[subscription-rest] ${vendor} ignoring unsupported options: ${ignored.join(', ')}`)
  }
}

/**
 * Spec §1.2 I17: atomic file write — `writeFile(tmp) + rename(tmp, target)`.
 * Single `writeFile(target)` is NOT atomic (truncation race + crash partial
 * write). Caller passes already-serialized JSON string.
 */
export async function atomicWriteJSON(targetPath: string, json: string): Promise<void> {
  const tmp = `${targetPath}.tmp-${process.pid}-${Date.now()}`
  await writeFile(tmp, json, 'utf-8')
  await rename(tmp, targetPath)
}

/** Test-only: reset the vendor refresh promise cache between cases. */
export function __resetRefreshCache(): void {
  refreshPromiseCache.clear()
}
