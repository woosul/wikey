/**
 * §5.6.5 옵션 A v2 — Ollama usage statusbar chip (CodexBar paradigm).
 *
 * Behavior (user spec 2026-05-14):
 *   - 로딩된 모델 없음 → chip hidden (display:none)
 *   - 로컬 ollama 호출 → chip = `● <model>`            (모델명만)
 *   - 클라우드 ollama 호출 → chip = `● <model>|5h:NN%|7d:NN%`
 *
 * `●` indicator is a unicode geometric character (NOT an emoji — user
 * raise 2026-05-14: emoji 금지), styled with a light-purple color via
 * CSS class `wikey-statusbar-ollama-dot`.
 *
 * The chip state is in-memory only; process restart hides the chip
 * until the next callOllama dispatch. Cloud quota figures come from the
 * 5-minute poll of ollama.com/settings (fetcher; gated on
 * `ollamaCloudSessionCookie` being set).
 */

export interface OllamaUsageChipState {
  /** Last provider seen by `markOllamaUsage`. Undefined = chip hidden. */
  readonly provider?: 'ollama' | 'ollama-cloud'
  /** Last model dispatched. */
  readonly model?: string
  /** Cloud quota — only populated when provider='ollama-cloud' AND fetch succeeded. */
  readonly sessionPct?: number
  readonly weeklyPct?: number
}

/**
 * Format the chip text from current state. Returns empty string when no
 * ollama model has been used yet (caller hides the chip).
 */
export function formatOllamaChipText(state: OllamaUsageChipState): string {
  if (!state.provider || !state.model) return ''
  if (state.provider === 'ollama') {
    return `● ${state.model}`
  }
  // ollama-cloud — append quota when available; fall back to model-only
  // until the first ollama.com poll resolves (cookie configured + page
  // parses successfully).
  if (state.sessionPct !== undefined && state.weeklyPct !== undefined) {
    return `● ${state.model}|5h:${state.sessionPct}%|7d:${state.weeklyPct}%`
  }
  return `● ${state.model}`
}

/**
 * Render the chip into `host`, replacing its previous contents. Caller
 * is responsible for the host's display:none toggle when text is empty.
 *
 * The DOM shape is split so the `●` dot can carry its own color class
 * (wikey-statusbar-ollama-dot — light purple per user spec). The rest of
 * the text inherits the statusbar's default styling.
 */
export function renderOllamaChip(host: HTMLElement, state: OllamaUsageChipState): void {
  host.empty()
  const text = formatOllamaChipText(state)
  if (text.length === 0) {
    host.style.display = 'none'
    return
  }
  host.style.display = ''

  // Split at the first space so '●' becomes a styled span and the rest
  // (model | quota) renders as plain statusbar text.
  const spaceIdx = text.indexOf(' ')
  const dot = spaceIdx >= 0 ? text.slice(0, spaceIdx) : text
  const rest = spaceIdx >= 0 ? text.slice(spaceIdx) : ''

  host.createSpan({ cls: 'wikey-statusbar-ollama-dot', text: dot })
  if (rest.length > 0) {
    host.createSpan({ cls: 'wikey-statusbar-ollama-text', text: rest })
  }
}
