/**
 * §5.6.6 Step C — OpenAI subscription REST direct client.
 *
 * 출처: docs/spikes/phase-5/5.6.6/poc-openai.mjs (Session 44 PoC, A0
 * APPROVED_LOCAL_ONLY 2026-05-14).
 * OpenAI private Codex backend (chatgpt.com/backend-api/codex/responses).
 * 공식 api.openai.com/v1/responses 아님 — ChatGPT subscription quota 전용.
 *
 * Spec invariants (phase-5-spec-5.6.6 §1.2): I1 transport tools 0 / I4 OAuth2 /
 * I5 401 retry-once / I6 429/5xx fail-fast / I10 token 노출 0 / I11 PoC 1:1 /
 * I17 rotation + atomic write.
 *
 * Acceptance (§1.5): AC-S2/S6/S10b/S12-openai/S13/S14/S15/S19-openai/S22.
 */

import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { notifyDriftIfAny, type DriftNotice } from './subscription-rest-version-guard.js'
import { vendorFetch } from './subscription-rest-fetcher.js'
import {
  SubscriptionFallbackError,
  type RESTCallOptions,
  type RESTCallResult,
  type SubscriptionRESTClient,
  type TokenState,
  atomicWriteJSON,
  classifyHTTPFailure,
  mapOptionsToRESTOptions,
  refreshIfNeededShared,
} from './subscription-rest-shared.js'

// Vendor CLI bundle 추출 (Spec §1.7, A0 APPROVED_LOCAL_ONLY).
// 출처: codex Mach-O binary strings — PoC poc-openai.mjs line 16~21 1:1.
// codex post-impl v0.7 — GitHub secret scanning 회피. 실 값은 vendor CLI bundle
// 추출 후 env (WIKEY_OPENAI_OAUTH_CLIENT_ID) 로 inject. 미설정 시 throw.
function readOpenAIOAuthClientId(): string {
  const id = process.env.WIKEY_OPENAI_OAUTH_CLIENT_ID
  if (!id) {
    throw new SubscriptionFallbackError(
      'auth-missing',
      'OpenAI OAuth client_id missing — set WIKEY_OPENAI_OAUTH_CLIENT_ID (extract from @openai/codex bundle, see docs/spikes/phase-5/5.6.6/SPIKE.md)',
    )
  }
  return id
}
const TOKEN_REFRESH_URL = 'https://auth.openai.com/oauth/token'
const CHATGPT_BASE = 'https://chatgpt.com/backend-api'
const RESPONSES_PATH = '/codex/responses'
const AUTH_PATH = join(homedir(), '.codex', 'auth.json')
const DEFAULT_TIMEOUT_MS = 600_000

/** Internal sentinel — first 401 from /responses triggers caller retry. */
class OpenAIRetryAfterRefresh extends Error {
  constructor() { super('openai-401-retry'); this.name = 'OpenAIRetryAfterRefresh' }
}

interface AuthFile {
  readonly tokens?: Record<string, unknown>
  readonly [k: string]: unknown
}

/**
 * Parse `~/.codex/auth.json` into TokenState. PoC supports both nested
 * (`{tokens:{access_token,...}}`) and flat shapes. `raw` preserves both shells
 * for refresh write-back round-trip (I17).
 */
function authToTokenState(parsed: AuthFile): TokenState {
  const tokens: Record<string, unknown> = (parsed.tokens && typeof parsed.tokens === 'object')
    ? (parsed.tokens as Record<string, unknown>)
    : (parsed as Record<string, unknown>)
  return {
    accessToken: String(tokens.access_token ?? ''),
    refreshToken: String(tokens.refresh_token ?? ''),
    // ~/.codex/auth.json has no expiry field — trust the existing token until
    // the server returns 401, which triggers force-refresh (Spec §1.5 AC-S6).
    expiresAtMs: 0,
    raw: { full: parsed, tokens },
  }
}

export class OpenAIRESTClient implements SubscriptionRESTClient {
  /**
   * codex post-impl F2 MID fix v0.6 — wire version-guard into production (AC-S24).
   * Baseline = sha256("https://chatgpt.com/backend-api/codex/responses").
   */
  constructor(onDrift?: (notice: DriftNotice) => void) {
    notifyDriftIfAny('openai', `${CHATGPT_BASE}${RESPONSES_PATH}`, onDrift)
  }

  async loadToken(): Promise<TokenState> {
    const parsed = JSON.parse(await readFile(AUTH_PATH, 'utf-8')) as AuthFile
    return authToTokenState(parsed)
  }

  async refreshIfNeeded(state: TokenState): Promise<TokenState> {
    // expiresAtMs=0 means refreshIfNeededShared always considers it expired,
    // which is undesirable — codex CLI semantics are "trust until 401". Bypass
    // the shared scheduler here; refresh is driven by 401 path in call().
    return state
  }

  async call(prompt: string, model: string, opts: RESTCallOptions): Promise<RESTCallResult> {
    const state = await this.loadToken()
    try {
      return await this.callResponses(prompt, model, state, opts)
    } catch (err) {
      if (!(err instanceof OpenAIRetryAfterRefresh)) throw err
      const refreshed = await this.forceRefresh(state)
      return this.callResponses(prompt, model, refreshed, opts, true)
    }
  }

  /**
   * OAuth2 refresh + atomic write-back to ~/.codex/auth.json (I4 + I17).
   * Caller drives this from the 401 path (no expiry check).
   */
  private async forceRefresh(state: TokenState): Promise<TokenState> {
    return refreshIfNeededShared('openai', { ...state, expiresAtMs: 0 }, async (s) => {
      if (!s.refreshToken) {
        throw new SubscriptionFallbackError('auth-missing',
          'OpenAI subscription: no refresh_token in auth.json — please re-login (codex login)')
      }
      const res = await vendorFetch(TOKEN_REFRESH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: readOpenAIOAuthClientId(),
          grant_type: 'refresh_token',
          refresh_token: s.refreshToken,
        }).toString(),
      })
      if (!res.ok) {
        throw new SubscriptionFallbackError('auth-missing',
          `OpenAI token refresh failed (status=${res.status}) — please re-login`)
      }
      const refreshed = (await res.json()) as Record<string, unknown>
      // I17 — round-trip both top-level (full) and tokens shell unknown fields.
      const raw = s.raw as { full: AuthFile; tokens: Record<string, unknown> }
      const newTokens = {
        ...raw.tokens,
        access_token: refreshed.access_token ?? raw.tokens.access_token,
        refresh_token: refreshed.refresh_token ?? raw.tokens.refresh_token,
        id_token: refreshed.id_token ?? raw.tokens.id_token,
      }
      const newFull: AuthFile = { ...raw.full, tokens: newTokens }
      await atomicWriteJSON(AUTH_PATH, JSON.stringify(newFull, null, 2))
      return authToTokenState(newFull)
    })
  }

  /** POST chatgpt.com/backend-api/codex/responses + SSE stream parse. */
  private async callResponses(
    prompt: string, model: string, state: TokenState,
    opts: RESTCallOptions, retried = false,
  ): Promise<RESTCallResult> {
    const mapped = mapOptionsToRESTOptions('openai', opts)
    // Note (codex F7 v0.4): `instructions` carries no raw 'tools' substring;
    // transport invariant is `Object.keys(body).includes('tools') === false`,
    // not raw text grep on `instructions`.
    const body: Record<string, unknown> = {
      model,
      instructions: 'Answer concisely.',
      input: [
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: prompt }] },
      ],
      store: false,
      stream: true,
      ...mapped.body,
    }

    const ac = new AbortController()
    const timeoutMs = opts.timeout ?? DEFAULT_TIMEOUT_MS
    const timer = setTimeout(() => ac.abort(), timeoutMs)
    const onExternalAbort = () => ac.abort()
    opts.signal?.addEventListener('abort', onExternalAbort)
    const t0 = Date.now()

    const accountId = (state.raw as { tokens: Record<string, unknown> }).tokens.account_id
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${state.accessToken}`,
      'OpenAI-Beta': 'responses=experimental',
      Originator: 'codex_cli_rs',
      Accept: 'text/event-stream',
    }
    if (typeof accountId === 'string' && accountId.length > 0) {
      headers['chatgpt-account-id'] = accountId
    }

    let res: Response
    try {
      res = await vendorFetch(`${CHATGPT_BASE}${RESPONSES_PATH}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: ac.signal,
      })
    } catch (err) {
      // codex post-impl F3 MID fix v0.6 — timer/listener cleanup on fetch error path
      // (success path defers cleanup to parseSSEResponse — SSE body stalls must
      // still trigger timeout, AC-S12-openai).
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onExternalAbort)
      if ((err as Error)?.name === 'AbortError' || ac.signal.aborted) {
        throw new SubscriptionFallbackError('timeout',
          `OpenAI /responses aborted (timeout=${timeoutMs}ms or external signal)`)
      }
      throw err
    }

    if (!res.ok) {
      // codex post-impl F3 MID fix v0.6 — non-OK response path cleanup.
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onExternalAbort)
      if (res.status === 401) {
        if (retried) {
          throw new SubscriptionFallbackError('auth-missing',
            'OpenAI subscription: 401 after refresh + retry — please re-login (codex login)')
        }
        throw new OpenAIRetryAfterRefresh()
      }
      // §5.6.6 v0.7 follow-up — include vendor response body in error message
      // so 400 / 5xx diagnosis is possible (in-chat error block shows the
      // exact vendor rejection reason). Token values are never in error body.
      let vendorBody = ''
      try { vendorBody = (await res.text()).slice(0, 500) } catch { /* ignore */ }
      throw classifyHTTPFailure(res.status) ?? new SubscriptionFallbackError(
        'server-error',
        `OpenAI /responses failed (status=${res.status})${vendorBody ? `: ${vendorBody}` : ''}`)
    }

    // codex post-impl F3 MID fix v0.6 — SSE body consumption may stall;
    // parseSSEResponse owns timer/listener cleanup so opts.timeout still fires.
    return this.parseSSEResponse(res.body, model, t0, ac, opts, timer, onExternalAbort)
  }

  /**
   * Parse SSE stream — PoC poc-openai.mjs line 96~127 1:1. Collects
   * `response.output_text.delta` events; extracts usage + model from
   * `response.completed`. Other event types (e.g. tool_use / function_call —
   * transport invariant: should never appear) are ignored.
   */
  private async parseSSEResponse(
    stream: ReadableStream<Uint8Array> | NodeJS.ReadableStream | null,
    model: string,
    t0: number,
    ac: AbortController,
    opts: RESTCallOptions,
    timer: ReturnType<typeof setTimeout>,
    onExternalAbort: () => void,
  ): Promise<RESTCallResult> {
    if (!stream) {
      throw new SubscriptionFallbackError('server-error', 'OpenAI /responses returned empty body')
    }
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let collectedText = ''
    let usage: Record<string, unknown> | undefined
    let modelEcho = model
    try {
      for await (const chunk of stream as AsyncIterable<Uint8Array>) {
        if (ac.signal.aborted) {
          throw new SubscriptionFallbackError('timeout',
            'OpenAI /responses aborted mid-stream (timeout or external signal)')
        }
        buffer += decoder.decode(chunk, { stream: true })
        let idx: number
        while ((idx = buffer.indexOf('\n\n')) !== -1) {
          const event = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          const dataLines = event.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6))
          if (dataLines.length === 0) continue
          const dataStr = dataLines.join('\n')
          if (dataStr === '[DONE]') continue
          let evt: { type?: string; delta?: unknown; response?: { usage?: unknown; model?: unknown } }
          try { evt = JSON.parse(dataStr) } catch { continue }
          if (evt.type === 'response.output_text.delta' && typeof evt.delta === 'string') {
            collectedText += evt.delta
          } else if (evt.type === 'response.completed') {
            usage = (evt.response?.usage as Record<string, unknown> | undefined) ?? usage
            modelEcho = (typeof evt.response?.model === 'string' ? evt.response.model : modelEcho)
          } else if (evt.type === 'response.created') {
            modelEcho = (typeof evt.response?.model === 'string' ? evt.response.model : modelEcho)
          }
        }
      }
    } catch (err) {
      // codex post-impl F3 MID fix v0.6 — AbortError (stream stall + timeout fired)
      // surface as SubscriptionFallbackError('timeout'), AC-S12-openai.
      if ((err as Error)?.name === 'AbortError' || ac.signal.aborted) {
        throw new SubscriptionFallbackError('timeout',
          'OpenAI /responses aborted mid-stream (timeout or external signal)')
      }
      throw err
    } finally {
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onExternalAbort)
    }
    return { text: collectedText, model: modelEcho, latencyMs: Date.now() - t0, usage }
  }
}
