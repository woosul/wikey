/**
 * §5.6.6 Step A — Subscription REST endpoint version guard.
 *
 * Spec §1.5 AC-S24 + §2 R1 mitigation: vendor CLI bundle endpoint URL may
 * change without notice. This guard computes the sha256 hash of the current
 * endpoint URL and compares with the Session 45 baseline (see
 * `docs/spikes/phase-5/5.6.6/SPIKE.md §3`). Mismatch → Notice only (throw 0 —
 * production regression 0). Caller surfaces via `onDrift` callback.
 */

import { createHash } from 'node:crypto'
import type { SubscriptionVendor } from './subscription-rest-shared.js'

/**
 * Session 45 measured baseline (2026-05-14, `docs/spikes/phase-5/5.6.6/SPIKE.md`).
 * Reproduce: `echo -n "<endpoint>" | shasum -a 256`.
 */
export const ENDPOINT_BASELINE: Record<SubscriptionVendor, string> = {
  google: 'e82c46235e87015f6d07e3f6ea66e67a3d48dc80289b6f08840c1e8c021c9bbe',
  openai: '1897faf097db8edfa5c0c6765abb12be180ed7aff633203298e6c0c28fcb16e5',
  anthropic: 'dd9dd182b406f181aa1efb245fd4182c6588c3430bcab8d7db04199ab682acbc',
}

export interface VerifyResult {
  readonly ok: boolean
  readonly currentHash: string
  readonly expectedHash: string
  readonly reason?: 'hash-drift'
}

/**
 * Compute sha256 hash of the current vendor endpoint URL and compare with the
 * baseline. Pure function (no I/O); caller decides whether to emit Notice.
 */
export function verifyEndpointHash(
  vendor: SubscriptionVendor,
  currentURL: string,
): VerifyResult {
  const currentHash = createHash('sha256').update(currentURL).digest('hex')
  const expectedHash = ENDPOINT_BASELINE[vendor]
  if (currentHash === expectedHash) {
    return { ok: true, currentHash, expectedHash }
  }
  return { ok: false, currentHash, expectedHash, reason: 'hash-drift' }
}

/** Notice payload emitted to caller (UI Notice in Obsidian, debug log elsewhere). */
export interface DriftNotice {
  readonly vendor: SubscriptionVendor
  readonly currentURL: string
  readonly currentHash: string
  readonly expectedHash: string
}

/**
 * Convenience: verify and invoke `onDrift` only on mismatch. Throw 0 —
 * production regression 0 (Spec AC-S24).
 */
export function notifyDriftIfAny(
  vendor: SubscriptionVendor,
  currentURL: string,
  onDrift?: (notice: DriftNotice) => void,
): VerifyResult {
  const result = verifyEndpointHash(vendor, currentURL)
  if (!result.ok && onDrift) {
    onDrift({
      vendor,
      currentURL,
      currentHash: result.currentHash,
      expectedHash: result.expectedHash,
    })
  }
  return result
}
