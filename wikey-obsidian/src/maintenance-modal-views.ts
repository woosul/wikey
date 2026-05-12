/**
 * §5.19 MaintenanceModal — view rendering helpers (split from
 * `maintenance-modal.ts`, cycle #3 BLUE refactor 2026-05-12).
 *
 * The modal class owns the lifecycle (onOpen / dispatch / close / abort). All
 * mode-agnostic DOM rendering (findings list / step-2 confirm checkbox /
 * step-3 progress / healthy state) lives here so the modal file stays under
 * the 200 LOC budget (spec §3 v0.3 Dependencies).
 *
 * No state — every function takes the target element + raw data and returns
 * either void (renders) or a primitive (callback hook results). The modal owns
 * AbortController + running flag + findings array.
 */
import type { MaintenanceFinding } from './maintenance-modal'

/** AC-UI-3 — append a single stdout/stderr line to the progress region. */
export function appendProgressLine(progressEl: HTMLElement | null, line: string): void {
  if (!progressEl) return
  progressEl.createDiv({ cls: 'wikey-maintenance-modal-log-line', text: line })
}

/**
 * AC-UI-4 — render the findings list (or "All healthy" placeholder). Returns
 * the apply-fix button element when findings>0 so the modal can wire its click
 * handler — separating DOM construction from click semantics keeps the modal
 * class lean.
 */
export interface FindingsViewHooks {
  /** Click on the apply-fix button (only when findings>0). */
  readonly onApplyFix: () => void
}

export function renderFindingsList(
  actionEl: HTMLElement,
  findings: readonly MaintenanceFinding[],
  hooks: FindingsViewHooks,
): void {
  actionEl.empty()
  if (findings.length === 0) {
    renderHealthyView(actionEl)
    return
  }
  renderFindingsTable(actionEl, findings)
  const btnRow = actionEl.createDiv({ cls: 'wikey-maintenance-modal-action-buttons' })
  const applyBtn = btnRow.createEl('button', {
    text: 'Apply fix',
    cls: 'wikey-maintenance-modal-apply-btn',
  })
  applyBtn.addEventListener('click', () => {
    hooks.onApplyFix()
  })
  btnRow.createEl('button', { text: 'Cancel', cls: 'wikey-maintenance-modal-cancel-btn' })
}

function renderHealthyView(actionEl: HTMLElement): void {
  actionEl.createEl('div', { text: 'All healthy', cls: 'wikey-maintenance-modal-healthy' })
  actionEl.createEl('button', { text: 'Close', cls: 'wikey-maintenance-modal-close-btn' })
}

function renderFindingsTable(
  actionEl: HTMLElement,
  findings: readonly MaintenanceFinding[],
): void {
  const list = actionEl.createEl('ul', { cls: 'wikey-maintenance-modal-finding-list' })
  for (const f of findings) {
    const li = list.createEl('li')
    const parts = [f.kind, f.path, f.detail].filter((s) => !!s)
    li.textContent = parts.join(' — ')
  }
}

/**
 * AC-UI-5 / Finding 3 (cycle #4) — step-2 confirm checkbox UI.
 *
 * Findings are **grouped by sha** (not by page) — 1 row per dangling sha with
 * its page count surfaced as `({n} 페이지 점유)`. Rationale: a single dangling
 * sha (e.g. §5.18 `sha256:679cf2dd6db75e3a`) commonly spans dozens of pages;
 * page-level rows would let a user uncheck N-1 of them while the recovery API
 * still scrubs every page bearing that sha — breaking Spec I7 (confirm 의무).
 * The checkbox is now the unit of recovery action so user intent and applied
 * change agree 1:1.
 *
 * `onExecute` receives the still-checked **sha list**, ready to feed straight
 * into `applyWikiRecovery({ danglingShas })`.
 */
export interface ConfirmViewHooks {
  readonly onExecute: (selectedShas: readonly string[]) => void
  readonly onCancel: () => void
}

interface ShaGroup {
  readonly sha: string
  readonly pageCount: number
}

function groupDanglingFindingsBySha(
  findings: readonly MaintenanceFinding[],
): readonly ShaGroup[] {
  const counts = new Map<string, number>()
  const order: string[] = []
  for (const f of findings) {
    if (f.kind !== 'dangling-cross-link') continue
    const sha = f.sha ?? f.detail
    if (!sha || !sha.startsWith('sha256:')) continue
    if (!counts.has(sha)) order.push(sha)
    counts.set(sha, (counts.get(sha) ?? 0) + 1)
  }
  return order.map((sha) => ({ sha, pageCount: counts.get(sha) ?? 0 }))
}

export function renderStep2Confirm(
  actionEl: HTMLElement,
  findings: readonly MaintenanceFinding[],
  hooks: ConfirmViewHooks,
): void {
  actionEl.empty()
  actionEl.createEl('div', {
    cls: 'wikey-maintenance-modal-step-2',
    text: 'Step 2 — 다음 항목을 정리합니다:',
  })

  const groups = groupDanglingFindingsBySha(findings)
  const list = actionEl.createEl('ul', { cls: 'wikey-maintenance-modal-confirm-list' })
  const checkboxes: Array<{ input: HTMLInputElement; sha: string }> = []
  for (const g of groups) {
    const li = list.createEl('li')
    const label = li.createEl('label', { cls: 'wikey-maintenance-modal-confirm-row' })
    // `type` via `attr` for compatibility with the obsidian-mock applyOpts
    // helper (which doesn't surface a `type` shorthand). Real Obsidian's
    // createEl supports both shapes; the attr form is the lowest common path.
    const input = label.createEl('input', { attr: { type: 'checkbox' } }) as HTMLInputElement
    input.checked = true
    label.appendChild(
      document.createTextNode(` ${g.sha} (${g.pageCount} 페이지 점유)`),
    )
    checkboxes.push({ input, sha: g.sha })
  }

  const btnRow = actionEl.createDiv({ cls: 'wikey-maintenance-modal-action-buttons' })
  const execBtn = btnRow.createEl('button', {
    text: '실행',
    cls: 'wikey-maintenance-modal-execute-btn',
  })
  execBtn.addEventListener('click', () => {
    const selectedShas = checkboxes.filter((c) => c.input.checked).map((c) => c.sha)
    hooks.onExecute(selectedShas)
  })
  const cancelBtn = btnRow.createEl('button', {
    text: '취소',
    cls: 'wikey-maintenance-modal-cancel-btn',
  })
  cancelBtn.addEventListener('click', () => {
    hooks.onCancel()
  })
}

/** AC-UI-5 — step-3 in-progress marker (transition between confirm + complete). */
export function renderStep3InProgress(actionEl: HTMLElement): void {
  actionEl.empty()
  actionEl.createEl('div', {
    cls: 'wikey-maintenance-modal-step-3-running',
    text: 'Step 3 — 진행 중 (fixing 적용)…',
  })
}

/** AC-UI-5 — step-3 complete + Close button. */
export function renderStep3Complete(actionEl: HTMLElement, changedPagesCount: number): void {
  actionEl.empty()
  actionEl.createEl('div', {
    cls: 'wikey-maintenance-modal-step-3',
    text: `Step 3 — 완료 (${changedPagesCount} pages updated)`,
  })
  actionEl.createEl('button', { text: 'Close', cls: 'wikey-maintenance-modal-close-btn' })
}

