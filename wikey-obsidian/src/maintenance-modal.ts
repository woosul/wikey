/**
 * §5.19 Wiki maintenance Modal — single component, mode prop branching.
 * Spec: phase-5-spec-5.19-wiki-maintenance-suite.md v0.3 §1.5. View rendering
 * lives in maintenance-modal-views.ts; this file owns lifecycle + dispatch +
 * apply-fix orchestration. applyFix opens in-modal step-2 confirm-checkbox
 * (Finding 3 / Spec I7) — runRecovery fires only on the [실행] click. All
 * runner methods receive AbortController.signal (Finding 4).
 */

import { App, Modal } from 'obsidian'
import {
  appendProgressLine as renderProgressLine,
  renderFindingsList,
  renderStep2Confirm,
  renderStep3Complete,
  renderStep3InProgress,
  renderUnhealthySummary,
  type UnhealthyIssue,
} from './maintenance-modal-views'

/**
 * §5.19 v0.4 (R9) — Recovery mode retired. 3 modes only:
 *   - status / refactoring → key-value render
 *   - check → findings list (Apply fix → step-2 sha-grouped confirm → runRecovery)
 *
 * `MaintenanceRunner.runRecovery` is preserved as the underlying executor that
 * Check's Apply fix delegates to (Spec 2 I-FIX-2 / `applyWikiRecovery` core API
 * still wired through the runner).
 */
export type MaintenanceMode = 'status' | 'check' | 'refactoring'

export interface MaintenanceFinding {
  readonly kind: string
  readonly path?: string
  readonly detail?: string
  /** §5.19 — dangling sha collected from `dangling-cross-link` findings, fed to applyWikiRecovery. */
  readonly sha?: string
  /**
   * §5.19 v0.4 Batch 5 (R8 / G1 / I-FIX-1) — canonical case-insensitive slug
   * for broken-wikilink findings. Present iff wikey-core's `detectBrokenWikilinks`
   * classified the finding as `fixKind: 'case-insensitive'` — Step 2 confirm
   * uses this as the auto-fix replacement target.
   */
  readonly autoFixSlug?: string
  /**
   * §5.19 v0.4 Batch 6 (R12) — full classification kind so Step 2 confirm can
   * route fuzzy rows into a `<select>` dropdown and no-match rows into a
   * "manual review" checkbox (instead of dropping them silently).
   */
  readonly fixKind?: 'case-insensitive' | 'fuzzy' | 'no-match'
  /** §5.19 v0.4 Batch 6 (R12) — top-3 fuzzy candidates for the dropdown UI. */
  readonly candidates?: readonly { slug: string; similarity: number }[]
}

/** Runtime hook bridging the modal to wikey-core (Spec 1~4). Tests omit it. */
export interface MaintenanceRunner {
  runStatus?: (signal: AbortSignal) => Promise<Record<string, unknown>>
  runCheck?: (signal: AbortSignal) => Promise<readonly MaintenanceFinding[]>
  runRecovery?: (
    signal: AbortSignal,
    payload: { danglingShas: readonly string[] },
  ) => Promise<{ changedPages: readonly string[] }>
  /**
   * §5.19 v0.4 Batch 5 — broken wikilink fix (mode a). Each request carries
   * (source, brokenTarget, replacement); the wikey-core helper resolves these
   * into `applyBrokenWikilinkFix({ confirm: true, fixes })`.
   */
  runBrokenLinkFix?: (
    signal: AbortSignal,
    payload: {
      fixes: readonly { source: string; brokenTarget: string; replacement: string }[]
    },
  ) => Promise<{ changedFiles: number; changedLinks: number }>
  runRefactoring?: (signal: AbortSignal) => Promise<Record<string, unknown>>
}

export interface MaintenanceModalOptions {
  readonly mode: MaintenanceMode
  readonly runner?: MaintenanceRunner
}

const SIGKILL_TIMEOUT_MS = 5000

export class MaintenanceModal extends Modal {
  readonly mode: MaintenanceMode
  readonly abortController: AbortController
  /** SIGKILL fallback hook fired 5s after close() if SIGTERM wasn't ack'd. */
  onSigKill: () => void = () => {}

  private readonly runner: MaintenanceRunner
  private headerEl: HTMLElement | null = null
  private bodyEl: HTMLElement | null = null
  private footerEl: HTMLElement | null = null
  private progressEl: HTMLElement | null = null
  private actionEl: HTMLElement | null = null
  private running = false
  private collectedFindings: readonly MaintenanceFinding[] = []

  constructor(app: App, _plugin: unknown, opts: MaintenanceModalOptions) {
    super(app)
    this.mode = opts.mode
    this.runner = opts.runner ?? {}
    this.abortController = new AbortController()
  }

  /**
   * §5.19 v0.4 Batch 2 (R1/R2/R3/R5) — 3-layer modal structure: sticky header
   * (title + close x) / scrollable body (progress + log) / sticky footer
   * (action buttons, horizontal-centered). The previous flat `.modal-content`
   * was wholly scrollable; the new layout keeps title + action affordances in
   * view while the middle scrolls.
   */
  override onOpen(): void {
    this.contentEl.empty()
    this.contentEl.addClass('wikey-maintenance-modal')
    this.contentEl.addClass('wikey-maintenance-modal-root')

    // R1 — sticky header (title + Obsidian-provided `.modal-close-button` x icon).
    this.headerEl = this.contentEl.createDiv({ cls: 'wikey-maintenance-modal-header' })
    this.headerEl.createEl('h3', {
      cls: 'wikey-maintenance-modal-title',
      text: MODE_TITLES[this.mode],
    })

    // R3 — scrollable middle. Progress region (stdout tail) lives here.
    this.bodyEl = this.contentEl.createDiv({ cls: 'wikey-maintenance-modal-body' })
    this.progressEl = this.bodyEl.createDiv({ cls: 'wikey-maintenance-modal-progress' })

    // R2/R5 — sticky footer with horizontal-centered action buttons. `actionEl`
    // hosts every step view (findings list / confirm / step-3 complete) so all
    // footer buttons (Apply fix / Cancel / Close / 실행 / 취소) inherit the
    // footer's `justify-content: center` layout automatically.
    this.footerEl = this.contentEl.createDiv({ cls: 'wikey-maintenance-modal-footer' })
    this.actionEl = this.footerEl.createDiv({ cls: 'wikey-maintenance-modal-action' })

    void this.dispatchMode()
  }

  private async dispatchMode(): Promise<void> {
    try {
      // status/refactoring → key-value render; check → findings list (Apply
      // fix opens in-modal step-2 confirm → runRecovery on [실행] click).
      // v0.4 (R9): recovery mode retired — Check absorbs the fix path.
      if (this.mode === 'status' || this.mode === 'refactoring') {
        await this.runKeyValueMode(
          this.mode === 'status' ? this.runner.runStatus : this.runner.runRefactoring,
        )
      } else {
        await this.runFindingsMode()
      }
    } catch (err) {
      if ((err as { name?: string })?.name === 'AbortError') return
      this.appendProgressLine(`[error] ${String(err)}`)
    }
  }

  private async runKeyValueMode(
    runner: ((signal: AbortSignal) => Promise<Record<string, unknown>>) | undefined,
  ): Promise<void> {
    if (!runner) return
    this.markRunning(true)
    const result = await runner(this.abortController.signal)
    this.markRunning(false)
    for (const [k, v] of Object.entries(result)) {
      const display = Array.isArray(v) ? v.length : String(v)
      this.appendProgressLine(`${k}: ${display}`)
    }
    // §5.19 v0.4 (R6/R10/I-HEALTH-1) — Status / Refactoring modes show issue
    // summary instead of "All healthy" when any metric > 0. Previously every
    // key-value mode routed through `renderFindings([])` (empty findings →
    // "All healthy" placeholder) regardless of underlying counts, contradicting
    // master cdp readings of brokenLinkCount=6,936 + duplicates>0.
    const issues = this.collectUnhealthyIssues(result)
    if (issues.length === 0) {
      this.renderFindings([])
    } else {
      this.renderUnhealthy(issues)
    }
  }

  /**
   * Build the per-metric `UnhealthyIssue` list for the current mode. Returns
   * `[]` when the vault is healthy (so the caller falls back to the "All
   * healthy" view). Counts not present in `result` are treated as 0.
   */
  private collectUnhealthyIssues(
    result: Record<string, unknown>,
  ): readonly UnhealthyIssue[] {
    const num = (key: string): number => {
      const v = result[key]
      return typeof v === 'number' ? v : 0
    }
    const arrLen = (key: string): number => {
      const v = result[key]
      return Array.isArray(v) ? v.length : 0
    }
    if (this.mode === 'status') {
      const broken = num('brokenLinkCount')
      const dangling = num('danglingCrossLinkCount')
      const stale = num('staleTombstoneCount')
      const orphan = num('orphanCount')
      if (broken === 0 && dangling === 0 && stale === 0 && orphan === 0) return []
      return [
        { label: 'broken', count: broken },
        { label: 'dangling', count: dangling },
        { label: 'stale tombstone', count: stale },
        { label: 'orphan', count: orphan },
      ]
    }
    if (this.mode === 'refactoring') {
      const dup = arrLen('duplicates')
      const low = arrLen('lowUtility')
      if (dup === 0 && low === 0) return []
      return [
        { label: 'duplicates', count: dup },
        { label: 'lowUtility', count: low },
      ]
    }
    return []
  }

  private renderUnhealthy(issues: readonly UnhealthyIssue[]): void {
    if (!this.actionEl) return
    this.actionEl.empty()
    renderUnhealthySummary(this.actionEl, issues, () => {
      this.close()
    })
  }

  private async runFindingsMode(): Promise<void> {
    if (!this.runner.runCheck) return
    this.markRunning(true)
    const findings = await this.runner.runCheck(this.abortController.signal)
    this.markRunning(false)
    this.collectedFindings = findings
    this.renderFindings(findings)
  }

  override close(): void {
    if (this.running) {
      const proceed = window.confirm('Work in progress. Cancel?')
      if (!proceed) return
      this.scheduleSigKill()
    }
    this.abortController.abort()
    super.close()
  }

  /** AC-UI-3 — append a stdout/stderr line to the progress region. */
  appendProgressLine(line: string): void {
    renderProgressLine(this.progressEl, line)
  }

  /**
   * AC-UI-4 — render findings list with Apply-fix / Close branching.
   *
   * §5.19 v0.4 (R4 fix) — the healthy-state Close button now dismisses the
   * modal (previously inert; only the title-bar `x` worked).
   */
  renderFindings(findings: readonly MaintenanceFinding[]): void {
    if (!this.actionEl) return
    this.collectedFindings = findings
    renderFindingsList(this.actionEl, findings, {
      onApplyFix: () => {
        void this.applyFix()
      },
      onClose: () => {
        this.close()
      },
    })
  }

  /**
   * AC-UI-5 + Finding 3 (cycle #4) + §5.19 v0.4 Batch 5 (R8 / G1) — open
   * in-modal step-2 confirm. Multi-mode (mode a + mode b absorbed):
   *   - dangling-cross-link → sha-grouped checkbox → `runRecovery({ danglingShas })`
   *   - broken-wikilink w/ autoFixSlug → source/target row → `runBrokenLinkFix({ fixes })`
   * `onExecute` payload carries both selections; `executeFix` dispatches each to
   * the right runner. Either runner missing → that mode silently skipped (back-
   * compat: legacy tests with only `runRecovery` wired still pass).
   */
  async applyFix(): Promise<void> {
    if (!this.actionEl) return
    renderStep2Confirm(this.actionEl, this.collectedFindings, {
      onExecute: (payload) => {
        void this.executeFix(payload)
      },
      onCancel: () => {
        this.renderFindings(this.collectedFindings)
      },
    })
  }

  /**
   * Step 3 — multi-mode fix execution. Wired from the [실행] click in step-2.
   * Aggregates `changedFiles` across mode a (broken wikilink) + mode b (dangling
   * sha cleanup). On per-runner error the other mode still attempts (matches
   * recovery.ts §5.19 cycle #5 partial-state visibility).
   */
  private async executeFix(payload: {
    selectedShas: readonly string[]
    brokenFixes: readonly { source: string; brokenTarget: string; replacement: string }[]
  }): Promise<void> {
    if (!this.actionEl) return
    renderStep3InProgress(this.actionEl)
    this.markRunning(true)
    let totalChangedFiles = 0
    try {
      if (payload.brokenFixes.length > 0 && this.runner.runBrokenLinkFix) {
        try {
          const result = await this.runner.runBrokenLinkFix(this.abortController.signal, {
            fixes: payload.brokenFixes,
          })
          totalChangedFiles += result.changedFiles
          this.appendProgressLine(
            `[fix-link] ${result.changedLinks} links / ${result.changedFiles} pages`,
          )
        } catch (err) {
          if ((err as { name?: string })?.name === 'AbortError') throw err
          this.appendProgressLine(`[fix-link error] ${String(err)}`)
        }
      }
      if (payload.selectedShas.length > 0 && this.runner.runRecovery) {
        try {
          const result = await this.runner.runRecovery(this.abortController.signal, {
            danglingShas: payload.selectedShas,
          })
          totalChangedFiles += result.changedPages.length
          this.appendProgressLine(`[recovery] ${result.changedPages.length} pages changed`)
        } catch (err) {
          if ((err as { name?: string })?.name === 'AbortError') throw err
          this.appendProgressLine(`[recovery error] ${String(err)}`)
        }
      }
      this.markRunning(false)
      renderStep3Complete(this.actionEl, totalChangedFiles, () => {
        this.close()
      })
    } catch (err) {
      this.markRunning(false)
      if ((err as { name?: string })?.name === 'AbortError') return
      this.appendProgressLine(`[fix error] ${String(err)}`)
    }
  }

  /** AC-UI-6 helper — mark subprocess running so close() prompts confirm. */
  markRunning(running: boolean): void {
    this.running = running
  }

  private scheduleSigKill(): void {
    const timer = setTimeout(() => {
      this.onSigKill()
    }, SIGKILL_TIMEOUT_MS)
    // Don't clear on abort — production wants SIGKILL fallback even on abort.
    this.abortController.signal.addEventListener('abort', () => { void timer }, { once: true })
  }
}

/**
 * §5.19 v0.4 Batch 4 (R9) — sticky-header title per mode. Recovery mode was
 * retired; Check's Fix link multi-mode now hosts the dangling-sha cleanup
 * flow the standalone Recovery modal used to render.
 */
const MODE_TITLES: Record<MaintenanceMode, string> = {
  status: 'Wiki status',
  check: 'Wiki check',
  refactoring: 'Refactoring suggestions',
}
