/**
 * §5.6.6 Step B — Google subscription REST direct client.
 *
 * 출처: docs/spikes/phase-5/5.6.6/poc-google.mjs (Session 44 PoC, A0
 * APPROVED_LOCAL_ONLY 2026-05-14). PoC 5 함수 (loadCreds / refreshTokenIfExpired
 * / callCodeAssist / resolveProjectId / generateContent) → client 5 method 1:1.
 *
 * Spec invariants (phase-5-spec-5.6.6 §1.2): I1 transport tools 0 / I4 OAuth2 /
 * I5 401 retry-once / I6 429/5xx fail-fast / I8 storage 보존 / I10 token 노출 0 /
 * I11 PoC 1:1 / I17 rotation + atomic write.
 *
 * Acceptance (§1.5): AC-S1/S4/S5/S6b/S9/S12-google/S13/S14/S15/S19-google/S22.
 */

import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
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
import { notifyDriftIfAny, type DriftNotice } from './subscription-rest-version-guard.js'
import { vendorFetch } from './subscription-rest-fetcher.js'

// Vendor CLI bundle 추출 (Spec §1.7, A0 APPROVED_LOCAL_ONLY). OAuth client_id /
// client_secret는 vendor CLI bundle 안 public values지만 GitHub secret scanning
// push protection 회피를 위해 환경변수 또는 bundle 직접 read 로 resolve.
// Production fallback: process.env.WIKEY_GEMINI_OAUTH_{CLIENT_ID,CLIENT_SECRET}
// (사용자가 vendor CLI 추출 후 1회 설정). 미설정 시 throw.
function readGeminiOAuthCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.WIKEY_GEMINI_OAUTH_CLIENT_ID
  const clientSecret = process.env.WIKEY_GEMINI_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new SubscriptionFallbackError(
      'auth-missing',
      'Gemini OAuth credentials missing — set WIKEY_GEMINI_OAUTH_CLIENT_ID + WIKEY_GEMINI_OAUTH_CLIENT_SECRET (extract from @google/gemini-cli bundle, see docs/spikes/phase-5/5.6.6/SPIKE.md)',
    )
  }
  return { clientId, clientSecret }
}
const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com'
const API_VERSION = 'v1internal'
const TOKEN_REFRESH_URL = 'https://oauth2.googleapis.com/token'
const CREDS_PATH = join(homedir(), '.gemini', 'oauth_creds.json')
const DEFAULT_TIMEOUT_MS = 600_000

/** Per-accessToken → projectId cache (AC-S4 — second call skips loadCodeAssist). */
const projectIdCache = new Map<string, string>()

/** Internal sentinel — first 401 from generateContent triggers caller retry. */
class GoogleRetryAfterRefresh extends Error {
  constructor() { super('google-401-retry'); this.name = 'GoogleRetryAfterRefresh' }
}

type Creds = Record<string, unknown>

function credsToTokenState(creds: Creds): TokenState {
  return {
    accessToken: String(creds.access_token ?? ''),
    refreshToken: String(creds.refresh_token ?? ''),
    expiresAtMs: Number(creds.expiry_date ?? 0),
    raw: creds,
  }
}

export class GoogleRESTClient implements SubscriptionRESTClient {
  /**
   * codex post-impl F2 MID fix v0.6 — wire version-guard into production (AC-S24).
   * onDrift callback fires when bundle endpoint sha256 differs from baseline.
   * Throw 0 — production regression 0; caller surfaces Notice.
   */
  constructor(onDrift?: (notice: DriftNotice) => void) {
    notifyDriftIfAny('google', CODE_ASSIST_ENDPOINT, onDrift)
  }

  async loadToken(): Promise<TokenState> {
    return credsToTokenState(JSON.parse(await readFile(CREDS_PATH, 'utf-8')) as Creds)
  }

  async refreshIfNeeded(state: TokenState): Promise<TokenState> {
    return refreshIfNeededShared('google', state, (s) => this.doRefresh(s))
  }

  async call(prompt: string, model: string, opts: RESTCallOptions): Promise<RESTCallResult> {
    const state = await this.refreshIfNeeded(await this.loadToken())
    let projectId = await this.resolveProjectId(state.accessToken)
    try {
      return await this.generateContent(prompt, model, projectId, state, opts)
    } catch (err) {
      // I5 — first 401 → refresh + single retry. 2nd 401 (retried=true) → throw auth-missing.
      if (!(err instanceof GoogleRetryAfterRefresh)) throw err
      const refreshed = await this.doRefresh(state)
      projectId = await this.resolveProjectId(refreshed.accessToken)
      return this.generateContent(prompt, model, projectId, refreshed, opts, true)
    }
  }

  /** OAuth2 refresh + atomic write-back to ~/.gemini/oauth_creds.json (I4 + I17). */
  private async doRefresh(state: TokenState): Promise<TokenState> {
    if (!state.refreshToken) {
      throw new SubscriptionFallbackError('auth-missing',
        'Google subscription: no refresh_token in creds — please re-login (gemini /auth)')
    }
    const { clientId, clientSecret } = readGeminiOAuthCredentials()
    const res = await vendorFetch(TOKEN_REFRESH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: state.refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    })
    if (!res.ok) {
      throw new SubscriptionFallbackError('auth-missing',
        `Google token refresh failed (status=${res.status}) — please re-login`)
    }
    const refreshed = (await res.json()) as Creds
    // I17 — round-trip unknown fields via shallow merge; refresh response overrides.
    const oldCreds: Creds = (state.raw && typeof state.raw === 'object') ? state.raw as Creds : {}
    const newCreds: Creds = {
      ...oldCreds,
      ...refreshed,
      expiry_date: Date.now() + (Number(refreshed.expires_in ?? 0) - 30) * 1000,
    }
    await atomicWriteJSON(CREDS_PATH, JSON.stringify(newCreds, null, 2))
    return credsToTokenState(newCreds)
  }

  /** loadCodeAssist → cloudaicompanionProject; cache hit skips (AC-S4). */
  private async resolveProjectId(accessToken: string): Promise<string> {
    if (process.env.GOOGLE_CLOUD_PROJECT) return process.env.GOOGLE_CLOUD_PROJECT
    const cached = projectIdCache.get(accessToken)
    if (cached) return cached
    const res = await vendorFetch(`${CODE_ASSIST_ENDPOINT}/${API_VERSION}:loadCodeAssist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        cloudaicompanionProject: undefined,
        metadata: { ideType: 'IDE_UNSPECIFIED', platform: 'PLATFORM_UNSPECIFIED', pluginType: 'GEMINI' },
      }),
    })
    if (!res.ok) {
      throw classifyHTTPFailure(res.status) ?? new SubscriptionFallbackError(
        'server-error', `Google loadCodeAssist failed (status=${res.status})`)
    }
    const projId = ((await res.json()) as Creds).cloudaicompanionProject
    if (typeof projId !== 'string' || projId.length === 0) {
      throw new SubscriptionFallbackError('auth-missing',
        'Google subscription: no cloudaicompanionProject — onboarding required')
    }
    projectIdCache.set(accessToken, projId)
    return projId
  }

  /** POST cloudcode-pa.googleapis.com/v1internal:generateContent (PoC line 125~141 1:1). */
  private async generateContent(
    prompt: string, model: string, projectId: string,
    state: TokenState, opts: RESTCallOptions, retried = false,
  ): Promise<RESTCallResult> {
    const mapped = mapOptionsToRESTOptions('gemini', opts)
    const request: Record<string, unknown> = { contents: [{ role: 'user', parts: [{ text: prompt }] }] }
    if (mapped.generationConfig && Object.keys(mapped.generationConfig).length > 0) {
      request.generationConfig = mapped.generationConfig
    }
    const body = { model, project: projectId, user_prompt_id: randomUUID(), request }

    // Internal timeout + external signal pass-through (AC-S12-google).
    const ac = new AbortController()
    const timeoutMs = opts.timeout ?? DEFAULT_TIMEOUT_MS
    const timer = setTimeout(() => ac.abort(), timeoutMs)
    const onExternalAbort = () => ac.abort()
    opts.signal?.addEventListener('abort', onExternalAbort)
    const t0 = Date.now()

    let res: Response
    try {
      res = await vendorFetch(`${CODE_ASSIST_ENDPOINT}/${API_VERSION}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${state.accessToken}` },
        body: JSON.stringify(body),
        signal: ac.signal,
      })
    } catch (err) {
      if ((err as Error)?.name === 'AbortError' || ac.signal.aborted) {
        throw new SubscriptionFallbackError('timeout',
          `Google generateContent aborted (timeout=${timeoutMs}ms or external signal)`)
      }
      throw err
    } finally {
      clearTimeout(timer)
      opts.signal?.removeEventListener('abort', onExternalAbort)
    }

    const latencyMs = Date.now() - t0
    if (!res.ok) {
      // I5 — first 401 signals retry; second 401 (retried) escalates to auth-missing.
      if (res.status === 401) {
        if (retried) {
          throw new SubscriptionFallbackError('auth-missing',
            'Google subscription: 401 after refresh + retry — please re-login (gemini /auth)')
        }
        throw new GoogleRetryAfterRefresh()
      }
      throw classifyHTTPFailure(res.status) ?? new SubscriptionFallbackError(
        'server-error', `Google generateContent failed (status=${res.status})`)
    }

    const data = (await res.json()) as {
      response?: {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
        usageMetadata?: Record<string, unknown>
      }
    }
    const parts = data?.response?.candidates?.[0]?.content?.parts ?? []
    const text = parts.map((p) => p.text).filter(Boolean).join('\n')
    return { text, model, latencyMs, usage: data?.response?.usageMetadata }
  }
}

/** Test-only: reset the project resolve cache between cases. */
export function __resetProjectCache(): void {
  projectIdCache.clear()
}
