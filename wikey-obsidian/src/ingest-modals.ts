import { App, Modal, Setting } from 'obsidian'
import type { IngestPlan } from 'wikey-core'

/**
 * Unified Ingest Flow Modal (llm-wiki.md "stay involved" UX).
 *
 * One modal, three phases:
 *   1. brief       — LLM brief + user guide input + verify toggle
 *   2. processing  — spinner + live progress (extract runs in background)
 *   3. preview     — extraction plan + approve/cancel
 *
 * If verify toggle is OFF, modal auto-closes after phase 2.
 * If user closes the modal mid-flow, the current phase resolves as cancel.
 */

export type FlowPhase = 'brief' | 'processing' | 'preview' | 'done'

export interface BriefOutcome {
  readonly action: 'proceed' | 'skip-session' | 'cancel'
  readonly guideHint: string
  readonly verifyResults: boolean
}

const STEP_LABELS: ReadonlyArray<{ key: FlowPhase; label: string }> = [
  { key: 'brief', label: 'Brief' },
  { key: 'processing', label: 'Processing' },
  { key: 'preview', label: 'Preview' },
]

export class IngestFlowModal extends Modal {
  private phase: FlowPhase = 'brief'
  private guideHint = ''
  private verifyResults: boolean
  private plan: IngestPlan | null = null
  private progressMessage = 'Extracting...'
  private progressStep = 0
  private progressTotal = 4
  private progressSubStep: number | undefined
  private progressSubTotal: number | undefined
  private brief: string
  /** True until setBrief() is called with the real LLM brief. Shows a loading state. */
  private briefLoading = true

  /** Set by processing-phase [Back] click. runIngest checks this to decide whether to loop back. */
  backRequested = false

  private briefResolver: ((o: BriefOutcome) => void) | null = null
  private previewResolver: ((approved: boolean) => void) | null = null

  // DOM holders
  private stepperEl!: HTMLElement
  private bodyEl!: HTMLElement

  // Drag / resize state
  private dragOffsetX = 0
  private dragOffsetY = 0
  private dragging = false
  private resizing = false
  private resizeStartX = 0
  private resizeStartY = 0
  private resizeStartW = 0
  private resizeStartH = 0
  // Detached event cleanups (run in onClose — avoid Modal.register() because Modal
  // does not reliably extend Component across Obsidian versions).
  private cleanups: Array<() => void> = []

  constructor(
    app: App,
    private readonly sourcePath: string,
    initialBrief: string,
    private readonly defaultVerify: boolean,
  ) {
    super(app)
    this.verifyResults = defaultVerify
    this.brief = initialBrief
    this.briefLoading = !initialBrief
  }

  /** Inject the LLM-generated brief after modal is open (so runIngest can open modal immediately). */
  setBrief(brief: string) {
    this.brief = brief
    this.briefLoading = false
    if (this.phase === 'brief') this.rerender()
  }

  /** Returns once the user acts on the Brief phase (or closes the modal). */
  awaitBrief(): Promise<BriefOutcome> {
    return new Promise((resolve) => {
      this.briefResolver = resolve
    })
  }

  /** Switch to processing phase; call from runIngest just before extract starts. */
  showProcessing(message = 'Extracting with LLM...') {
    this.phase = 'processing'
    this.progressMessage = message
    this.progressStep = 1
    this.progressTotal = 4
    this.rerender()
  }

  /** Update processing phase: step/total + message + optional sub-progress within a step. */
  updateProgress(step: number, total: number, message: string, subStep?: number, subTotal?: number) {
    this.progressStep = step
    this.progressTotal = total
    this.progressMessage = message
    this.progressSubStep = subStep
    this.progressSubTotal = subTotal
    if (this.phase === 'processing') this.patchProgress()
  }

  private computeFractionPct(): number {
    if (this.progressTotal <= 0) return 0
    // If sub-progress is provided, interpolate between step-1 and step.
    if (this.progressSubStep != null && this.progressSubTotal && this.progressSubTotal > 0) {
      const fraction = Math.min(1, Math.max(0, this.progressSubStep / this.progressSubTotal))
      return Math.round(((this.progressStep - 1 + fraction) / this.progressTotal) * 100)
    }
    return Math.round((this.progressStep / this.progressTotal) * 100)
  }

  private patchProgress() {
    const msgEl = this.bodyEl?.querySelector('.wikey-modal-progress-msg') as HTMLElement | null
    const pctEl = this.bodyEl?.querySelector('.wikey-modal-progress-pct') as HTMLElement | null
    const barEl = this.bodyEl?.querySelector('.wikey-modal-progress-fill') as HTMLElement | null
    const pct = this.computeFractionPct()
    if (msgEl) msgEl.setText(`${this.progressStep}/${this.progressTotal} · ${this.progressMessage}`)
    if (pctEl) pctEl.setText(`${pct}%`)
    if (barEl) barEl.style.width = `${pct}%`
  }

  /** Switch to preview phase; resolves when user approves/cancels (or closes modal). */
  awaitPreview(plan: IngestPlan): Promise<boolean> {
    this.plan = plan
    this.phase = 'preview'
    this.rerender()
    return new Promise((resolve) => {
      this.previewResolver = resolve
    })
  }

  /** Reset modal to Brief phase after user hit [Back] during processing. Preserves guideHint. */
  resetForBack() {
    this.backRequested = false
    this.phase = 'brief'
    this.plan = null
    this.progressStep = 0
    this.rerender()
  }

  /** Mark flow as done and close (success path with verify=OFF or after approve+write). */
  finish() {
    this.phase = 'done'
    this.close()
  }

  // ── Rendering ──

  onOpen() {
    const { contentEl, modalEl } = this
    contentEl.addClass('wikey-ingest-flow-modal')
    modalEl.addClass('wikey-ingest-flow-modal-wrap')

    // Force actual modal container width (Obsidian's default max-width is too tight).
    try { this.applyModalSize() } catch (err) { console.warn('[Wikey modal] applyModalSize failed:', err) }

    // ── Content first: the modal must render even if optional features (drag/resize) throw ──
    const titleEl = contentEl.createEl('h3', { text: 'Ingest', cls: 'wikey-modal-drag-handle' })
    const fn = contentEl.createDiv({ cls: 'wikey-modal-subtitle' })
    fn.setText(this.sourcePath.split('/').pop() ?? this.sourcePath)

    this.stepperEl = contentEl.createDiv({ cls: 'wikey-modal-stepper' })
    this.bodyEl = contentEl.createDiv({ cls: 'wikey-modal-body' })

    this.rerender()

    // ── Optional enhancements: window resize, drag, resize handle (wrapped in try/catch) ──
    try {
      const onWinResize = () => this.applyModalSize()
      window.addEventListener('resize', onWinResize)
      this.cleanups.push(() => window.removeEventListener('resize', onWinResize))

      const handle = contentEl.createDiv({
        cls: 'wikey-modal-resize-handle',
        attr: { 'aria-label': 'Resize modal', title: 'Drag to resize' },
      })
      this.wireDragAndResize(titleEl, handle)
    } catch (err) {
      console.warn('[Wikey modal] drag/resize setup failed (non-fatal):', err)
    }
  }

  private applyModalSize() {
    const targetW = Math.min(760, Math.floor(window.innerWidth * 0.92))
    this.modalEl.style.setProperty('--dialog-max-width', `${targetW}px`)
    this.modalEl.style.setProperty('--dialog-width', `${targetW}px`)
    this.modalEl.style.width = `${targetW}px`
    // 높이는 Obsidian 기본 centering + contentEl 자연 확장에 맡긴다.
    // (maxHeight 직접 설정 시 centering과 충돌해 content가 0 크기로 축소되는 이슈 있음)
  }

  private wireDragAndResize(dragHandle: HTMLElement, resizeHandle: HTMLElement) {
    // ── Drag ──
    dragHandle.addEventListener('mousedown', (e) => {
      this.dragging = true
      const rect = this.modalEl.getBoundingClientRect()
      this.dragOffsetX = e.clientX - rect.left
      this.dragOffsetY = e.clientY - rect.top
      // Switch from centered (auto margins) to absolute positioning
      this.modalEl.style.position = 'fixed'
      this.modalEl.style.left = `${rect.left}px`
      this.modalEl.style.top = `${rect.top}px`
      this.modalEl.style.margin = '0'
      e.preventDefault()
    })
    const onMove = (e: MouseEvent) => {
      if (this.dragging) {
        const maxX = window.innerWidth - 80
        const maxY = window.innerHeight - 40
        const x = Math.max(-80, Math.min(maxX, e.clientX - this.dragOffsetX))
        const y = Math.max(0, Math.min(maxY, e.clientY - this.dragOffsetY))
        this.modalEl.style.left = `${x}px`
        this.modalEl.style.top = `${y}px`
      }
      if (this.resizing) {
        const dx = e.clientX - this.resizeStartX
        const dy = e.clientY - this.resizeStartY
        const newW = Math.max(480, Math.min(window.innerWidth - 40, this.resizeStartW + dx))
        const newH = Math.max(360, Math.min(window.innerHeight - 40, this.resizeStartH + dy))
        // CSS vars take precedence over inline style on Obsidian's `.modal`
        this.modalEl.style.setProperty('--dialog-max-width', `${newW}px`)
        this.modalEl.style.setProperty('--dialog-max-height', `${newH}px`)
        this.modalEl.style.width = `${newW}px`
        this.modalEl.style.maxHeight = `${newH}px`
        this.modalEl.style.height = `${newH}px`
      }
    }
    const onUp = () => {
      this.dragging = false
      this.resizing = false
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    this.cleanups.push(() => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    })

    // ── Resize ──
    resizeHandle.addEventListener('mousedown', (e) => {
      this.resizing = true
      const rect = this.modalEl.getBoundingClientRect()
      this.resizeStartX = e.clientX
      this.resizeStartY = e.clientY
      this.resizeStartW = rect.width
      this.resizeStartH = rect.height
      e.preventDefault()
      e.stopPropagation()
    })
  }

  private rerender() {
    this.renderStepper()
    this.bodyEl.empty()
    switch (this.phase) {
      case 'brief':
        this.renderBriefPhase()
        break
      case 'processing':
        this.renderProcessingPhase()
        break
      case 'preview':
        this.renderPreviewPhase()
        break
      case 'done':
        break
    }
  }

  private renderStepper() {
    this.stepperEl.empty()
    const activeIdx = STEP_LABELS.findIndex((s) => s.key === this.phase)
    STEP_LABELS.forEach((step, idx) => {
      const item = this.stepperEl.createDiv({
        cls: 'wikey-modal-step'
          + (idx < activeIdx ? ' wikey-modal-step-done' : '')
          + (idx === activeIdx ? ' wikey-modal-step-active' : ''),
      })
      const dot = item.createDiv({ cls: 'wikey-modal-step-dot' })
      dot.setText(idx < activeIdx ? '✓' : String(idx + 1))
      item.createSpan({ cls: 'wikey-modal-step-label', text: step.label })
      if (idx < STEP_LABELS.length - 1) {
        this.stepperEl.createDiv({ cls: 'wikey-modal-step-sep' })
      }
    })
  }

  private renderBriefPhase() {
    const briefLabel = this.bodyEl.createEl('div', { cls: 'wikey-modal-label', text: 'LLM brief' })
    briefLabel.createEl('span', { cls: 'wikey-modal-hint', text: ' (자율 요약)' })
    const briefBox = this.bodyEl.createDiv({ cls: 'wikey-modal-brief' })
    if (this.briefLoading) {
      briefBox.addClass('wikey-modal-brief-loading')
      briefBox.empty()
      const spinner = briefBox.createSpan({ cls: 'wikey-modal-inline-spinner' })
      briefBox.createSpan({ text: ' LLM이 요약을 생성 중입니다... (보통 10~30초)' })
    } else {
      briefBox.setText(this.brief || '(brief 미생성 — 네트워크 또는 LLM 오류)')
    }

    const guideLabel = this.bodyEl.createEl('div', { cls: 'wikey-modal-label', text: '강조할 점 / 방향' })
    guideLabel.createEl('span', { cls: 'wikey-modal-hint', text: ' (선택, 비워도 됨)' })
    const textarea = this.bodyEl.createEl('textarea', { cls: 'wikey-modal-textarea' })
    textarea.rows = 4
    textarea.placeholder = '예: "SiC MOSFET 중 트렌치 구조에 집중. 측정 데이터는 엔티티로 분리하지 말 것."'
    textarea.value = this.guideHint
    textarea.addEventListener('input', () => {
      this.guideHint = textarea.value
    })
    setTimeout(() => textarea.focus(), 50)

    new Setting(this.bodyEl)
      .setName('Verify results before writing')
      .setDesc('추출 완료 후 생성될 페이지 목록을 확인하고 승인 (Step 3).')
      .addToggle((t) =>
        t.setValue(this.verifyResults).onChange((v) => {
          this.verifyResults = v
        }),
      )

    const btnRow = this.bodyEl.createDiv({ cls: 'wikey-modal-button-row' })
    const proceedBtn = btnRow.createEl('button', { text: 'Proceed', cls: 'mod-cta' })
    proceedBtn.addEventListener('click', () => this.resolveBrief('proceed'))
    const skipBtn = btnRow.createEl('button', { text: 'Skip briefs this session' })
    skipBtn.addEventListener('click', () => this.resolveBrief('skip-session'))
    const cancelBtn = btnRow.createEl('button', { text: 'Cancel' })
    cancelBtn.addEventListener('click', () => this.resolveBrief('cancel'))
  }

  private renderProcessingPhase() {
    const wrap = this.bodyEl.createDiv({ cls: 'wikey-modal-processing' })
    wrap.createDiv({ cls: 'wikey-modal-spinner' })

    const pct = this.computeFractionPct()

    const msgLine = wrap.createDiv({ cls: 'wikey-modal-progress-line' })
    msgLine.createEl('span', {
      cls: 'wikey-modal-progress-msg',
      text: `${this.progressStep}/${this.progressTotal} · ${this.progressMessage}`,
    })
    msgLine.createEl('span', { cls: 'wikey-modal-progress-pct', text: `${pct}%` })

    const barOuter = wrap.createDiv({ cls: 'wikey-modal-progress-bar' })
    const barFill = barOuter.createDiv({ cls: 'wikey-modal-progress-fill' })
    barFill.style.width = `${pct}%`

    if (this.guideHint.trim()) {
      const guideEcho = wrap.createDiv({ cls: 'wikey-modal-guide-echo' })
      guideEcho.createEl('div', { cls: 'wikey-modal-label', text: '적용된 가이드' })
      const box = guideEcho.createDiv({ cls: 'wikey-modal-brief' })
      box.setText(this.guideHint.trim())
    }
    const btnRow = this.bodyEl.createDiv({ cls: 'wikey-modal-button-row' })
    const backBtn = btnRow.createEl('button', { text: 'Back' })
    backBtn.addEventListener('click', () => {
      // Return to Brief phase; runIngest loop detects backRequested and restarts.
      this.backRequested = true
      this.resetForBack()
    })
  }

  private renderPreviewPhase() {
    if (!this.plan) return

    if (this.plan.guideReflection) {
      this.bodyEl.createEl('div', { cls: 'wikey-modal-label', text: 'Guide 반영' })
      const reflBox = this.bodyEl.createDiv({ cls: 'wikey-modal-reflection' })
      reflBox.setText(this.plan.guideReflection)
    }

    this.bodyEl.createEl('div', { cls: 'wikey-modal-label', text: '생성/업데이트될 페이지' })
    const list = this.bodyEl.createDiv({ cls: 'wikey-modal-plan-list' })
    this.renderPlanItem(list, this.plan.sourcePage.filename, this.plan.sourcePage.existed)

    if (this.plan.entities.length > 0) {
      list.createDiv({ cls: 'wikey-modal-plan-group', text: `entities (${this.plan.entities.length})` })
      for (const e of this.plan.entities) this.renderPlanItem(list, e.filename, e.existed, true)
    }
    if (this.plan.concepts.length > 0) {
      list.createDiv({ cls: 'wikey-modal-plan-group', text: `concepts (${this.plan.concepts.length})` })
      for (const c of this.plan.concepts) this.renderPlanItem(list, c.filename, c.existed, true)
    }

    const metaRow = this.bodyEl.createDiv({ cls: 'wikey-modal-meta' })
    metaRow.setText(
      `index.md ${this.plan.indexAdditions}건 추가 · log.md ${this.plan.hasLogEntry ? '1건 추가' : '추가 없음'}`,
    )

    const btnRow = this.bodyEl.createDiv({ cls: 'wikey-modal-button-row' })
    const approveBtn = btnRow.createEl('button', { text: 'Approve & Write', cls: 'mod-cta' })
    approveBtn.addEventListener('click', () => this.resolvePreview(true))
    const cancelBtn = btnRow.createEl('button', { text: 'Cancel (discard)' })
    cancelBtn.addEventListener('click', () => this.resolvePreview(false))
    setTimeout(() => approveBtn.focus(), 50)
  }

  private renderPlanItem(parent: HTMLElement, filename: string, existed: boolean, indent = false) {
    const row = parent.createDiv({ cls: 'wikey-modal-plan-item' + (indent ? ' wikey-modal-plan-indent' : '') })
    row.createEl('span', { cls: 'wikey-modal-plan-name', text: filename })
    row.createEl('span', {
      cls: existed ? 'wikey-modal-plan-badge wikey-modal-plan-update' : 'wikey-modal-plan-badge wikey-modal-plan-new',
      text: existed ? '업데이트' : '신규',
    })
  }

  // ── Resolvers ──

  private resolveBrief(action: BriefOutcome['action']) {
    if (!this.briefResolver) return
    const r = this.briefResolver
    this.briefResolver = null
    r({ action, guideHint: this.guideHint, verifyResults: this.verifyResults })
    if (action === 'cancel') this.close()
    // proceed/skip-session: modal stays open; caller will transition to processing phase
  }

  private resolvePreview(approved: boolean) {
    if (!this.previewResolver) return
    const r = this.previewResolver
    this.previewResolver = null
    r(approved)
    if (!approved) this.close()
    // approved: caller will call finish() after writes complete
  }

  onClose() {
    // Run deferred cleanups (window/document listeners)
    for (const fn of this.cleanups) {
      try { fn() } catch { /* ignore */ }
    }
    this.cleanups = []

    // Modal was closed mid-flow — cancel any pending phase resolvers
    if (this.briefResolver) {
      const r = this.briefResolver
      this.briefResolver = null
      r({ action: 'cancel', guideHint: this.guideHint, verifyResults: this.verifyResults })
    }
    if (this.previewResolver) {
      const r = this.previewResolver
      this.previewResolver = null
      r(false)
    }
    this.contentEl.empty()
  }
}
