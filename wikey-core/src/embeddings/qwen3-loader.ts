/**
 * §5.7.7 Step C1 — Qwen3-Embedding 0.6B local loader (Spec 1).
 *
 * Q1 LOCKED v1.0: ollama embedding API path. wikey-core 의 기존 ollama (chat /
 * canonicalize) endpoint pattern 재사용 — 신규 native dep 0 (Karpathy #2).
 *
 * Endpoints:
 *   POST {ollamaUrl}/api/embeddings   body { model, prompt: text } → { embedding: number[] }
 *   GET  {ollamaUrl}/api/tags         → { models: [{ name, size }] }
 *   POST {ollamaUrl}/api/pull         body { name } → { status: 'success' }
 *
 * Invariants (phase-5-spec-5.7.7 §1.1):
 *   I2 lazy connect      — factory 호출 시점까지 endpoint 미호출.
 *   I3 graceful disconnect — fetch fail (ECONNREFUSED 등) → embed 시 undefined 반환.
 *   I4 cancellable        — requestOpts.signal honored via AbortController.
 *   I5 deterministic dim  — response embedding 길이 ≠ EMBEDDING_DIM → throw + status 'failed'.
 *   I6 timeout            — embed default 5000ms, AbortController abort → throw.
 */

import { EMBEDDING_DIM, EMBEDDING_MODEL_DEFAULT } from './embedding-config.js'

export type Qwen3InstallStatus = 'idle' | 'downloading' | 'installed' | 'failed'

export interface Qwen3LoaderOptions {
  /** Ollama base URL. wikey.conf `OLLAMA_URL` mirror — default `http://localhost:11434`. */
  readonly ollamaUrl?: string
  /** Ollama model tag. default = `dengcao/Qwen3-Embedding-0.6B:Q8_0`. */
  readonly model?: string
  /** embed() 호출당 timeout (ms). default = 5000. */
  readonly timeoutMs?: number
}

export interface Qwen3Loader {
  /** I2 — true = at least one successful embed observed. */
  isLoaded(): boolean
  /** Spec 1.1 AC-Q2 — model 존재 여부 1 회 health check. */
  checkInstallStatus(): Promise<Qwen3InstallStatus>
  /** Spec 1.1 AC-Q3 — model 부재 시 자동 ollama pull + 재 health check. */
  ensureInstalled(): Promise<Qwen3InstallStatus>
  /**
   * Spec 1.1 — text → Float32Array(EMBEDDING_DIM).
   *   undefined: ollama 미동작 (I3 graceful disconnect, fail-open).
   *   throw    : timeout (I6) / dim mismatch (I5) / caller abort (I4).
   *
   * §5.7.7 cycle #2 codex catch — public AbortSignal (R6 + I4 invariant).
   * caller (runOramaIngest reindex / benchmark / search hybrid path) 가 abort signal
   * 전파 시 internal timeout AbortController 와 OR 결합으로 즉시 abort.
   */
  embed(text: string, opts?: { signal?: AbortSignal }): Promise<Float32Array | undefined>
  /** current install status (lazy — 마지막 checkInstallStatus / ensureInstalled / embed 결과 mirror). */
  status(): Qwen3InstallStatus
}

/** Detect "fetch failed: ECONNREFUSED" / network-level errors. graceful disconnect 영역. */
function isNetworkError(err: unknown): boolean {
  if (!err) return false
  const msg = err instanceof Error ? err.message : String(err)
  return /ECONNREFUSED|ENOTFOUND|fetch failed|network|getaddrinfo/iu.test(msg)
}

export function createQwen3Loader(opts: Qwen3LoaderOptions = {}): Qwen3Loader {
  const ollamaUrl = (opts.ollamaUrl ?? 'http://localhost:11434').replace(/\/$/, '')
  const model = opts.model ?? EMBEDDING_MODEL_DEFAULT
  const timeoutMs = opts.timeoutMs ?? 5000

  let loaded = false
  let installStatus: Qwen3InstallStatus = 'idle'

  async function listModels(): Promise<readonly string[] | undefined> {
    try {
      const res = await fetch(`${ollamaUrl}/api/tags`)
      if (!res.ok) return undefined
      const json = (await res.json()) as { models?: Array<{ name?: string }> }
      return (json.models ?? []).map((m) => m.name ?? '').filter(Boolean)
    } catch (err) {
      if (isNetworkError(err)) return undefined
      return undefined
    }
  }

  function isMatch(installed: readonly string[]): boolean {
    // Match either exact tag or model prefix (e.g. user pulled a different quant).
    return installed.some((n) => n === model || n.startsWith(model.split(':')[0]))
  }

  async function checkInstallStatus(): Promise<Qwen3InstallStatus> {
    const models = await listModels()
    if (models === undefined) {
      installStatus = 'failed'
      return installStatus
    }
    installStatus = isMatch(models) ? 'installed' : 'idle'
    return installStatus
  }

  async function ensureInstalled(): Promise<Qwen3InstallStatus> {
    const initial = await checkInstallStatus()
    if (initial === 'installed') return initial
    // Auto-pull (Q5 LOCKED v1.2).
    // §5.7.7 cycle #4 codex HIGH #3 fix — `stream: false` + body consume 의무.
    // 이전: stream default (true) → fetch resolve on headers, pull 진행 중 listModels()
    // 가 false 반환 → 사용자 auto-OFF false positive. fix: stream:false + await text()
    // 으로 pull 완료 대기 (분 단위 blocking — caller 가 'downloading' UI 표시 의무).
    installStatus = 'downloading'
    try {
      const res = await fetch(`${ollamaUrl}/api/pull`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: model, stream: false }),
      })
      if (!res.ok) {
        installStatus = 'failed'
        return installStatus
      }
      // Consume body fully — guarantees pull completion before tags re-check.
      await res.text()
      // Re-check tags to confirm.
      const after = await listModels()
      if (after === undefined) {
        installStatus = 'failed'
        return installStatus
      }
      installStatus = isMatch(after) ? 'installed' : 'failed'
      return installStatus
    } catch {
      installStatus = 'failed'
      return installStatus
    }
  }

  async function embed(
    text: string,
    embedOpts?: { signal?: AbortSignal },
  ): Promise<Float32Array | undefined> {
    // I6 timeout via AbortController. §5.7.7 cycle #2 — caller signal OR-merge.
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    const callerSignal = embedOpts?.signal
    if (callerSignal?.aborted) ctrl.abort()
    const onCallerAbort = (): void => ctrl.abort()
    callerSignal?.addEventListener('abort', onCallerAbort, { once: true })
    try {
      const res = await fetch(`${ollamaUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, prompt: text }),
        signal: ctrl.signal,
      })
      if (!res.ok) {
        // HTTP-level failure is still a hard error (model exists but request rejected).
        installStatus = 'failed'
        throw new Error(`Qwen3 embed HTTP ${res.status}`)
      }
      const json = (await res.json()) as { embedding?: number[] }
      const arr = json.embedding
      if (!Array.isArray(arr)) {
        installStatus = 'failed'
        throw new Error('Qwen3 embed response missing embedding array')
      }
      // I5 deterministic dim.
      if (arr.length !== EMBEDDING_DIM) {
        installStatus = 'failed'
        throw new Error(
          `Qwen3 embed dimension mismatch — expected ${EMBEDDING_DIM}, got ${arr.length}`,
        )
      }
      loaded = true
      installStatus = 'installed'
      return Float32Array.from(arr)
    } catch (err) {
      // Re-throw abort / dim errors. I3 graceful disconnect = undefined for network errors only.
      if (err instanceof Error) {
        const name = (err as Error & { name?: string }).name
        if (name === 'AbortError' || /abort|timeout/iu.test(err.message)) {
          throw err
        }
        if (/dim|dimension/iu.test(err.message) || /Qwen3 embed HTTP/u.test(err.message)) {
          throw err
        }
      }
      if (isNetworkError(err)) return undefined
      // Unknown — preserve fail-open contract for unexpected non-error throws.
      return undefined
    } finally {
      clearTimeout(timer)
      callerSignal?.removeEventListener('abort', onCallerAbort)
    }
  }

  return {
    isLoaded: () => loaded,
    checkInstallStatus,
    ensureInstalled,
    embed,
    status: () => installStatus,
  }
}
