/**
 * §5.6.6 Step Fix (Session 45 cycle #2, M1 R8) — fetcher injection point for
 * vendor REST clients (Google / OpenAI / Anthropic).
 *
 * Background: Spec §2 R8 originally assumed Node 18+ fetch and Obsidian Electron
 * renderer fetch share the same behavior. Live verification on 2026-05-15 found
 * Electron renderer's `fetch` is blocked by Chromium CORS preflight when
 * targeting the three vendor private OAuth endpoints (`cloudcode-pa.googleapis.com`,
 * `chatgpt.com/backend-api/codex/responses`, `api.anthropic.com/v1/messages`).
 *
 * Surgical fix: 3 vendor REST clients call `vendorFetch(...)` instead of
 * `fetch(...)`. Default = `globalThis.fetch` (Node tests + non-Obsidian CLI
 * users see no change). Obsidian plugin startup overrides via
 * `setSubscriptionRESTFetcher(nodeHttpsFetch)` — a Node `https` module wrapper
 * that runs outside the Chromium fetch sandbox.
 *
 * Module-level mutable state is intentional and lower-overhead than
 * dependency-injecting through SubscriptionDeps + per-client constructor args
 * (Karpathy Simplicity). The setter is called once at plugin startup; tests
 * leave the default in place and continue mocking `global.fetch`.
 */

/** Fetcher contract — minimal subset of `typeof fetch` used by REST clients. */
export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>

let activeFetcher: Fetcher = (input, init) => globalThis.fetch(input, init)

/**
 * Override the active fetcher (called once at Obsidian plugin startup).
 * Tests should not call this; the default delegating to `globalThis.fetch`
 * keeps existing `global.fetch = vi.fn()` mocks working.
 */
export function setSubscriptionRESTFetcher(fn: Fetcher): void {
  activeFetcher = fn
}

/** Reset to the default `globalThis.fetch` delegate (used by test cleanup). */
export function resetSubscriptionRESTFetcher(): void {
  activeFetcher = (input, init) => globalThis.fetch(input, init)
}

/** Proxy used by Google / OpenAI / Anthropic REST clients. */
export function vendorFetch(input: string, init?: RequestInit): Promise<Response> {
  return activeFetcher(input, init)
}
