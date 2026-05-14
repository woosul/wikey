/**
 * §5.6.5 옵션 A v2 — module-level Ollama usage notification hook.
 *
 * Why a singleton hook (not an LLMCallOptions callback): the statusbar chip
 * cares about *every* callOllama dispatch regardless of caller. Threading
 * `onOllamaUsage` through every call site (canonicalizer, ingest-pipeline,
 * sidebar-chat, scripts) would add boilerplate to ~10 functions for one
 * UI concern. A singleton emitter keeps wikey-core obsidian-free (I10)
 * while letting wikey-obsidian wire `setOllamaUsageListener` exactly once
 * at plugin onload.
 *
 * No accumulation here — listener decides what to render (local model
 * name only, cloud model + quota, hide, etc). User raise 2026-05-14:
 * 자체 누적 의미 없음.
 */

export interface OllamaUsageInfo {
  readonly provider: 'ollama' | 'ollama-cloud'
  readonly model: string
  /** prompt_eval_count from /api/chat response (cloud server echo). 0 when missing. */
  readonly promptTokens: number
  /** eval_count from /api/chat response. 0 when missing. */
  readonly evalTokens: number
  /** total_duration in ns (Ollama API standard). 0 when missing. */
  readonly totalDurationNs: number
}

let listener: ((info: OllamaUsageInfo) => void) | undefined

export function setOllamaUsageListener(
  fn: ((info: OllamaUsageInfo) => void) | undefined,
): void {
  listener = fn
}

export function notifyOllamaUsage(info: OllamaUsageInfo): void {
  if (listener) {
    try {
      listener(info)
    } catch {
      // Listener errors must not affect the LLM call result; swallow.
    }
  }
}

/** Test-only — clear the listener between specs to avoid cross-test leak. */
export function __clearOllamaUsageListener(): void {
  listener = undefined
}
