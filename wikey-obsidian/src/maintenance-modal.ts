/**
 * §5.19 Wiki maintenance Modal — single component, mode prop branching.
 * Spec: phase-5-spec-5.19-wiki-maintenance-suite.md v0.3 §1.5. View rendering
 * lives in maintenance-modal-views.ts; this file owns lifecycle + dispatch +
 * apply-fix orchestration. applyFix opens in-modal step-2 confirm-checkbox
 * (Finding 3 / Spec I7) — runRecovery fires only on the [실행] click. All
 * runner methods receive AbortController.signal (Finding 4).
 */

import { App, Modal } from 'obsidian'
import { appendProgressLine as renderProgressLine, renderFindingsList, renderStep2Confirm, renderStep3Complete, renderStep3InProgress } from './maintenance-modal-views'

export type MaintenanceMode = 'status' | 'check' | 'recovery' | 'refactoring'

export interface MaintenanceFinding {
  readonly kind: string
  readonly path?: string
  readonly detail?: string
  /** §5.19 — dangling sha collected from `dangling-cross-link` findings, fed to applyWikiRecovery. */
  readonly sha?: string
}

/** Runtime hook bridging the modal to wikey-core (Spec 1~4). Tests omit it. */
export interface MaintenanceRunner {
  runStatus?: (signal: AbortSignal) => Promise<Record<string, unknown>>
  runCheck?: (signal: AbortSignal) => Promise<readonly MaintenanceFinding[]>
  runRecovery?: (
    signal: AbortSignal,
    payload: { danglingShas: readonly string[] },
  ) => Promise<{ changedPages: readonly string[] }>
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

  override onOpen(): void {
    this.contentEl.empty()
    this.contentEl.addClass('wikey-maintenance-modal')

    const header = this.contentEl.createDiv({ cls: 'wikey-maintenance-modal-header' })
    header.createEl('h3', { text: this.headerLabel() })

    this.progressEl = this.contentEl.createDiv({ cls: 'wikey-maintenance-modal-progress' })
    this.actionEl = this.contentEl.createDiv({ cls: 'wikey-maintenance-modal-action' })
    void this.dispatchMode()
  }

  private async dispatchMode(): Promise<void> {
    try {
      // status/refactoring → key-value render; check/recovery → findings list
      // (recovery direct-entry re-runs check first, then prompts on Apply fix).
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
    this.renderFindings([])
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
      const proceed = window.confirm('작업이 진행 중입니다. 중단하시겠습니까?')
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

  /** AC-UI-4 — render findings list with Apply-fix / Close branching. */
  renderFindings(findings: readonly MaintenanceFinding[]): void {
    if (!this.actionEl) return
    this.collectedFindings = findings
    renderFindingsList(this.actionEl, findings, {
      onApplyFix: () => {
        void this.applyFix()
      },
    })
  }

  /**
   * AC-UI-5 + Finding 3 (cycle #4) — open in-modal step-2 confirm.
   *
   * The view groups findings by sha (1 row per dangling sha with page-count
   * label) so a checked sha = scrub every page bearing it. `onExecute` thus
   * delivers the *sha list* directly — no extra page→sha aggregation here.
   * runRecovery fires only on [실행] (Spec I7 silent fix 0).
   */
  async applyFix(): Promise<void> {
    if (!this.actionEl) return
    renderStep2Confirm(this.actionEl, this.collectedFindings, {
      onExecute: (selectedShas) => {
        void this.executeRecovery(selectedShas)
      },
      onCancel: () => {
        this.renderFindings(this.collectedFindings)
      },
    })
  }

  /** Step 3 — Recovery execution. Wired from the [실행] click in step-2. */
  private async executeRecovery(danglingShas: readonly string[]): Promise<void> {
    if (!this.actionEl) return
    if (!this.runner.runRecovery) return
    renderStep3InProgress(this.actionEl)
    this.markRunning(true)
    try {
      const result = await this.runner.runRecovery(this.abortController.signal, { danglingShas })
      this.markRunning(false)
      this.appendProgressLine(`[recovery] 변경 페이지 ${result.changedPages.length}개`)
      renderStep3Complete(this.actionEl, result.changedPages.length)
    } catch (err) {
      this.markRunning(false)
      if ((err as { name?: string })?.name === 'AbortError') return
      this.appendProgressLine(`[recovery error] ${String(err)}`)
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

  private headerLabel(): string {
    return HEADER_LABELS[this.mode]
  }
}

const HEADER_LABELS: Record<MaintenanceMode, string> = {
  status: 'Wiki status',
  check: 'Wiki check',
  recovery: 'Wiki recovery',
  refactoring: 'Refactoring suggestions',
}
