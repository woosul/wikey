/**
 * §5.6.6 Step D — Anthropic subscription REST direct client.
 *
 * 출처: docs/spikes/phase-5/5.6.6/poc-anthropic.mjs (Session 44 PoC, A0
 * APPROVED_LOCAL_ONLY 2026-05-14). PoC 5 함수 → client 5 method 1:1.
 * macOS Keychain (`Claude Code-credentials`) + api.anthropic.com OAuth Bearer.
 * R10: macOS only — Linux/Windows constructor throws (Step E cli fallback).
 *
 * Spec invariants (§1.2): I1 transport tools 0 / I4 OAuth2 / I5 401 retry-once
 * / I6 429/5xx fail-fast / I10 token 노출 0 / I11 PoC 1:1 / I17 rotation +
 * atomic Keychain write (single `-U` add-generic-password).
 * AC (§1.5): S3/S6c/S7/S8/S10/S12-anthropic/S13/S14/S15/S19-anthropic/S22.
 */

import { execFileSync } from 'node:child_process'
import { userInfo } from 'node:os'
import {
  SubscriptionFallbackError,
  type RESTCallOptions,
  type RESTCallResult,
  type SubscriptionRESTClient,
  type TokenState,
  classifyHTTPFailure,
  mapOptionsToRESTOptions,
  refreshIfNeededShared,
} from './subscription-rest-shared.js'
import { notifyDriftIfAny, type DriftNotice } from './subscription-rest-version-guard.js'
import { vendorFetch } from './subscription-rest-fetcher.js'

// Vendor CLI bundle 추출 (Spec §1.7, A0 APPROVED_LOCAL_ONLY).
// 출처: /opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/cli.js
// PoC poc-anthropic.mjs line 15~19 1:1.
const KEYCHAIN_SERVICE = 'Claude Code-credentials'
// codex post-impl v0.7 — GitHub secret scanning 회피. 실 값은 vendor CLI bundle
// 추출 후 env (WIKEY_ANTHROPIC_OAUTH_CLIENT_ID) 로 inject. 미설정 시 throw.
function readAnthropicOAuthClientId(): string {
  const id = process.env.WIKEY_ANTHROPIC_OAUTH_CLIENT_ID
  if (!id) {
    throw new SubscriptionFallbackError(
      'auth-missing',
      'Anthropic OAuth client_id missing — set WIKEY_ANTHROPIC_OAUTH_CLIENT_ID (extract from @anthropic-ai/claude-code bundle, see docs/spikes/phase-5/5.6.6/SPIKE.md)',
    )
  }
  return id
}
const TOKEN_REFRESH_URL = 'https://console.anthropic.com/v1/oauth/token'
const API_BASE = 'https://api.anthropic.com'
const MESSAGES_PATH = '/v1/messages'
const ANTHROPIC_BETA = 'oauth-2025-04-20'
const ANTHROPIC_VERSION = '2023-06-01'
const DEFAULT_MAX_TOKENS = 1024
const DEFAULT_TIMEOUT_MS = 600_000
const SYSTEM_PROMPT = "You are Claude Code, Anthropic's official CLI for Claude."

interface KeychainShape {
  claudeAiOauth?: Record<string, unknown>
  [k: string]: unknown
}

function keychainToTokenState(parsed: KeychainShape): TokenState {
  const oauth = parsed.claudeAiOauth ?? {}
  return {
    accessToken: String(oauth.accessToken ?? ''),
    refreshToken: String(oauth.refreshToken ?? ''),
    expiresAtMs: Number(oauth.expiresAt ?? 0),
    raw: parsed,
  }
}

export class AnthropicRESTClient implements SubscriptionRESTClient {
  constructor(onDrift?: (notice: DriftNotice) => void) {
    // R10: macOS-only check. Linux/Windows fall back to cli mode via the
    // llm-client.ts subscriptionMode resolver (Step E).
    if (process.platform !== 'darwin') {
      throw new SubscriptionFallbackError(
        'spawn-failed',
        'Anthropic REST mode requires macOS Keychain — please use cli mode',
      )
    }
    // codex post-impl F2 MID fix v0.6 — wire version-guard into production (AC-S24).
    // Baseline = sha256("https://api.anthropic.com/v1/messages").
    notifyDriftIfAny('anthropic', `${API_BASE}${MESSAGES_PATH}`, onDrift)
  }

  async loadToken(): Promise<TokenState> {
    const username = userInfo().username
    let raw: string
    try {
      raw = execFileSync('security',
        ['find-generic-password', '-a', username, '-w', '-s', KEYCHAIN_SERVICE],
        { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
    } catch {
      throw new SubscriptionFallbackError('auth-missing',
        'Anthropic Keychain entry not found — please re-login (claude /login)')
    }
    try { return keychainToTokenState(JSON.parse(raw) as KeychainShape) } catch {
      throw new SubscriptionFallbackError('auth-missing',
        'Anthropic Keychain entry malformed — please re-login (claude /login)')
    }
  }

  async refreshIfNeeded(state: TokenState): Promise<TokenState> {
    return refreshIfNeededShared('anthropic', state, (s) => this.doRefresh(s))
  }

  async call(prompt: string, model: string, opts: RESTCallOptions): Promise<RESTCallResult> {
    const state = await this.refreshIfNeeded(await this.loadToken())
    try {
      return await this.callMessages(prompt, model, state, opts)
    } catch (err) {
      // I5 — first 401 → force refresh + single retry. 2nd 401 → auth-missing.
      if (!(err instanceof AnthropicRetryAfterRefresh)) throw err
      const refreshed = await this.doRefresh(state)
      return this.callMessages(prompt, model, refreshed, opts, true)
    }
  }

  /** OAuth2 refresh + atomic Keychain write-back (I4 + I17). */
  private async doRefresh(state: TokenState): Promise<TokenState> {
    if (!state.refreshToken) {
      throw new SubscriptionFallbackError('auth-missing',
        'Anthropic Keychain: no refresh_token — please re-login (claude /login)')
    }
    const res = await vendorFetch(TOKEN_REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: state.refreshToken,
        client_id: readAnthropicOAuthClientId(),
      }).toString(),
    })
    if (!res.ok) {
      throw new SubscriptionFallbackError('auth-missing',
        `Anthropic token refresh failed (status=${res.status}) — please re-login`)
    }
    const refreshed = (await res.json()) as Record<string, unknown>
    // I17 — round-trip unknown fields via shallow merge of inner oauth shell.
    const parsed = (state.raw && typeof state.raw === 'object') ? state.raw as KeychainShape : {}
    const oldOauth = (parsed.claudeAiOauth ?? {}) as Record<string, unknown>
    const newOauth: Record<string, unknown> = {
      ...oldOauth,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? oldOauth.refreshToken,
      expiresAt: Date.now() + (Number(refreshed.expires_in ?? 0) - 30) * 1000,
    }
    const newParsed: KeychainShape = { ...parsed, claudeAiOauth: newOauth }
    this.saveToKeychain(newParsed)
    return keychainToTokenState(newParsed)
  }

  /**
   * Atomic Keychain write via single `add-generic-password -U` (update or
   * insert). PoC poc-anthropic.mjs line 41~46 1:1. `execFileSync` (not
   * `execSync`) keeps argv direct — no shell-quoted JSON injection risk.
   */
  private saveToKeychain(parsed: KeychainShape): void {
    try {
      execFileSync('security',
        ['add-generic-password', '-U', '-a', userInfo().username,
          '-s', KEYCHAIN_SERVICE, '-w', JSON.stringify(parsed)],
        { stdio: ['ignore', 'ignore', 'ignore'] })
    } catch (err) {
      throw new SubscriptionFallbackError('auth-missing',
        `Anthropic Keychain write failed: ${(err as Error).message} — re-login required`)
    }
  }

  /** POST api.anthropic.com/v1/messages — PoC poc-anthropic.mjs line 85~111 1:1. */
  private async callMessages(
    prompt: string, model: string, state: TokenState,
    opts: RESTCallOptions, retried = false,
  ): Promise<RESTCallResult> {
    const mapped = mapOptionsToRESTOptions('anthropic', opts)
    const body: Record<string, unknown> = {
      model,
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
      ...mapped.body,
    }

    const ac = new AbortController()
    const timeoutMs = opts.timeout ?? DEFAULT_TIMEOUT_MS
    const timer = setTimeout(() => ac.abort(), timeoutMs)
    const onExternalAbort = () => ac.abort()
    opts.signal?.addEventListener('abort', onExternalAbort)
    const t0 = Date.now()

    let res: Response
    try {
      res = await vendorFetch(`${API_BASE}${MESSAGES_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${state.accessToken}`,
          'anthropic-beta': ANTHROPIC_BETA,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
        signal: ac.signal,
      })
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' || ac.signal.aborted) {
        throw new SubscriptionFallbackError('timeout',
          `Anthropic /v1/messages aborted (timeout=${timeoutMs}ms or external signal)`)
      }
      throw err
    } finally {
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onExternalAbort)
    }

    const latencyMs = Date.now() - t0
    if (!res.ok) {
      if (res.status === 401) {
        if (retried) {
          throw new SubscriptionFallbackError('auth-missing',
            'Anthropic subscription: 401 after refresh + retry — please re-login (claude /login)')
        }
        throw new AnthropicRetryAfterRefresh()
      }
      throw classifyHTTPFailure(res.status) ?? new SubscriptionFallbackError(
        'server-error', `Anthropic /v1/messages failed (status=${res.status})`)
    }

    const data = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>
      model?: string
      usage?: Record<string, unknown>
    }
    const text = Array.isArray(data.content)
      ? data.content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('')
      : ''
    return { text, model: data.model ?? model, latencyMs, usage: data.usage }
  }
}

/** Internal sentinel — first 401 from /v1/messages triggers caller retry. */
class AnthropicRetryAfterRefresh extends Error {
  constructor() { super('anthropic-401-retry'); this.name = 'AnthropicRetryAfterRefresh' }
}
