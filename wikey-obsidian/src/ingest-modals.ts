import { App, Modal, Setting } from 'obsidian'
import type { IngestPlan } from 'wikey-core'

/**
 * Unified Ingest Flow Modal (llm-wiki.md "stay involved" UX).
 *
 * One modal, four phases:
 *   1. converting — spinner + progress (source → markdown 변환; md/txt 도 read 단계 표시)
 *   2. brief       — LLM brief + user guide input + verify toggle
 *   3. processing  — spinner + live progress (extract runs in background)
 *   4. preview     — extraction plan + approve/cancel
 *
 * If verify toggle is OFF, modal auto-closes after phase 3.
 * If user closes the modal mid-flow, the current phase resolves as cancel.
 */

export type FlowPhase = 'converting' | 'brief' | 'processing' | 'preview' | 'done'

export interface BriefOutcome {
  readonly action: 'proceed' | 'skip-session' | 'cancel'
  readonly guideHint: string
  readonly verifyResults: boolean
}

const STEP_LABELS: ReadonlyArray<{ key: FlowPhase; label: string }> = [
  { key: 'converting', label: 'Converting' },
  { key: 'brief', label: 'Brief' },
  { key: 'processing', label: 'Processing' },
  { key: 'preview', label: 'Preview' },
]

export class IngestFlowModal extends Modal {
  private phase: FlowPhase = 'converting'
  private guideHint = ''
  private verifyResults: boolean
  private plan: IngestPlan | null = null
  private progressMessage = 'Converting source...'
  private progressStep = 1
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
    // 변환 단계에서 brief 결과 도착 시 자동 'brief' 전환 (옵션 C 4단계 stepper).
    if (this.phase === 'converting' || this.phase === 'brief') {
      this.phase = 'brief'
      this.progressStep = 2
      this.rerender()
    }
  }

  /** Switch to converting phase; called immediately after modal.open() so user sees progress. */
  showConverting(message = 'Converting source...') {
    this.phase = 'converting'
    this.progressMessage = message
    this.progressStep = 1
    this.progressTotal = 4
    this.briefLoading = true
    this.rerender()
  }

  /** Switch to brief phase; called once conversion completes (LLM brief still loading). */
  showBrief(message = 'Generating brief...') {
    this.phase = 'brief'
    this.progressMessage = message
    this.progressStep = 2
    this.progressTotal = 4
    if (!this.brief) this.briefLoading = true
    this.rerender()
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
    this.progressStep = 3
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
    if (this.phase === 'processing' || this.phase === 'converting') this.patchProgress()
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

    // Block accidental dismissal (backdrop click + ESC) while LLM extraction is running.
    // Only the explicit Cancel/Back/Approve buttons should close the modal mid-flow.
    const containerEl = (this as unknown as { containerEl?: HTMLElement }).containerEl
    if (containerEl) {
      const backdropGuard = (e: MouseEvent) => {
        // Backdrop = click on container itself (not on modal content)
        if (e.target === containerEl) {
          e.stopPropagation()
          e.preventDefault()
        }
      }
      containerEl.addEventListener('mousedown', backdropGuard, true)
      containerEl.addEventListener('click', backdropGuard, true)
      this.cleanups.push(() => {
        containerEl.removeEventListener('mousedown', backdropGuard, true)
        containerEl.removeEventListener('click', backdropGuard, true)
      })
    }
    const escGuard = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
      }
    }
    document.addEventListener('keydown', escGuard, true)
    this.cleanups.push(() => document.removeEventListener('keydown', escGuard, true))

    // [X] close button guard: during processing, confirm before closing.
    // Use capture phase so we can stopPropagation/preventDefault before
    // Obsidian's built-in close handler fires.
    const closeBtn = modalEl.querySelector('.modal-close-button') as HTMLElement | null
    if (closeBtn) {
      const closeGuard = (e: MouseEvent) => {
        if (this.phase === 'processing' || this.phase === 'converting') {
          const ok = window.confirm('Ingest in progress. Close anyway?')
          if (!ok) {
            e.stopPropagation()
            e.preventDefault()
            e.stopImmediatePropagation()
          }
        }
      }
      closeBtn.addEventListener('click', closeGuard, true)
      this.cleanups.push(() => closeBtn.removeEventListener('click', closeGuard, true))
    }

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

      // Attach resize handle to modalEl (not contentEl) so it sits at the true
      // outer corner — contentEl has padding that pushes the handle inward.
      const handle = modalEl.createDiv({
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
    // §5.10.3.10 옵션 C: init height + maxHeight 1 회 설정 — 모든 phase (converting/brief/
    // processing/preview) 동일 modal 크기 유지 + Preview 의 큰 plan list 도 modal 자체
    // 변동 X (body overflow scroll 흡수). 사용자 resize 시 wireDragAndResize 의 onMove
    // 가 갱신해 우선. body overflow-y:auto + button row sticky bottom 으로 progress/button
    // 안 가려짐. init 시 1 회만 — 이미 height 가 set 돼있으면 skip.
    if (!this.modalEl.style.height) {
      const targetH = Math.min(672, Math.floor(window.innerHeight * 0.82))
      this.modalEl.style.height = `${targetH}px`
      this.modalEl.style.maxHeight = `${targetH}px`
    }
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
      case 'converting':
        this.renderConvertingPhase()
        break
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

  private renderConvertingPhase() {
    const wrap = this.bodyEl.createDiv({ cls: 'wikey-modal-converting' })

    // Converting 단계: 원본.ext → sidecar.md (변환 진행 indicator).
    const fileName = this.sourcePath.split('/').pop() ?? this.sourcePath
    const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : ''
    const fileLabel = wrap.createDiv({ cls: 'wikey-modal-file-label' })
    fileLabel.createEl('span', { cls: 'wikey-modal-file-original', text: fileName })
    if (ext && ext !== 'md' && ext !== 'txt') {
      const convertedName = `${fileName}.md`
      fileLabel.createEl('span', { cls: 'wikey-modal-file-sep', text: '→' })
      fileLabel.createEl('span', { cls: 'wikey-modal-file-converted', text: convertedName })
    }

    // §5.10.3.10 옵션 C 보강: spinner 를 file label 과 progress bar 사이 중앙 배치.
    const spinnerCenter = wrap.createDiv({ cls: 'wikey-modal-spinner-center' })
    spinnerCenter.createDiv({ cls: 'wikey-modal-spinner' })

    const pct = this.computeFractionPct()
    const progressGroup = wrap.createDiv({ cls: 'wikey-modal-progress-group' })
    const msgLine = progressGroup.createDiv({ cls: 'wikey-modal-progress-line' })
    msgLine.createEl('span', {
      cls: 'wikey-modal-progress-msg',
      text: `${this.progressStep}/${this.progressTotal} · ${this.progressMessage}`,
    })
    msgLine.createEl('span', { cls: 'wikey-modal-progress-pct', text: `${pct}%` })
    const barOuter = progressGroup.createDiv({ cls: 'wikey-modal-progress-bar' })
    const barFill = barOuter.createDiv({ cls: 'wikey-modal-progress-fill' })
    barFill.style.width = `${pct}%`

    // Cancel only — converting 단계에서 Back 으로 돌아갈 phase 없음.
    const btnRow = this.bodyEl.createDiv({ cls: 'wikey-modal-button-row wikey-modal-button-row-bottom' })
    const cancelBtn = btnRow.createEl('button', { text: 'Cancel' })
    cancelBtn.addEventListener('click', () => {
      // briefResolver 가 아직 set 되기 전이면 close 만 호출 (commands.ts 의 awaitBrief 가 onClose 의
      // null briefResolver fallback 으로 cancel resolve). set 됐으면 명시 cancel resolve.
      if (this.briefResolver) {
        const r = this.briefResolver
        this.briefResolver = null
        r({ action: 'cancel', guideHint: this.guideHint, verifyResults: this.verifyResults })
      }
      this.close()
    })
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
    briefLabel.createEl('span', { cls: 'wikey-modal-hint', text: ' (auto summary)' })
    const briefBox = this.bodyEl.createDiv({ cls: 'wikey-modal-brief' })
    if (this.briefLoading) {
      briefBox.addClass('wikey-modal-brief-loading')
      briefBox.empty()
      const spinner = briefBox.createSpan({ cls: 'wikey-modal-inline-spinner' })
      briefBox.createSpan({ text: ' LLM is generating brief... (usually 10–30s)' })
    } else {
      briefBox.setText(this.brief || '(brief unavailable — network or LLM error)')
    }

    // §5.10.4 D-wide: "Active schema" 4+3 type 강제 표시 폐기. LLM 자율 type 분류로 전환 후
    // 고정된 7-type union 이 아니라 도메인별 자유 string. UX 안내는 "LLM 자율 type" 명시로 단순화.
    const schemaLine = this.bodyEl.createDiv({ cls: 'wikey-modal-schema-line' })
    schemaLine.createSpan({ cls: 'wikey-modal-schema-label', text: 'Type classification: ' })
    schemaLine.createSpan({ cls: 'wikey-modal-schema-types', text: 'LLM 자율 (예: organization / person / methodology / algorithm / dataset / event 등)' })

    const guideLabel = this.bodyEl.createEl('div', { cls: 'wikey-modal-label', text: 'Focus / direction' })
    guideLabel.createEl('span', { cls: 'wikey-modal-hint', text: ' (optional)' })
    const textarea = this.bodyEl.createEl('textarea', { cls: 'wikey-modal-textarea' })
    textarea.rows = 4
    textarea.placeholder = 'e.g. "Focus on trench-structure SiC MOSFETs. Don\'t split measurement data into separate entities."'
    textarea.value = this.guideHint
    textarea.addEventListener('input', () => {
      this.guideHint = textarea.value
    })
    setTimeout(() => textarea.focus(), 50)

    new Setting(this.bodyEl)
      .setName('Verify results before writing')
      .setDesc('Review the list of pages to create after extraction (Step 3).')
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

    // §5.10.3.10 옵션 C 보강: Processing 단계는 변환 끝났으므로 sidecar.md (= 처리 대상 markdown)
    // 만 accent 표시. 원본.ext 는 미표시 — "또 변환 중인가?" 사용자 혼란 방지.
    const fileName = this.sourcePath.split('/').pop() ?? this.sourcePath
    const ext = fileName.includes('.') ? fileName.split('.').pop()!.toLowerCase() : ''
    const processedName = ext && ext !== 'md' && ext !== 'txt' ? `${fileName}.md` : fileName
    const fileLabel = wrap.createDiv({ cls: 'wikey-modal-file-label' })
    fileLabel.createEl('span', { cls: 'wikey-modal-file-converted', text: processedName })

    // Spinner 를 file label 과 progress bar 사이 중앙 배치 (§5.10.3.10 spec).
    const spinnerCenter = wrap.createDiv({ cls: 'wikey-modal-spinner-center' })
    spinnerCenter.createDiv({ cls: 'wikey-modal-spinner' })

    // 사용자 가이드 (있으면) 는 spinner 직후, progress 위.
    if (this.guideHint.trim()) {
      const guideEcho = wrap.createDiv({ cls: 'wikey-modal-guide-echo' })
      guideEcho.createEl('div', { cls: 'wikey-modal-label', text: 'Applied guide' })
      const box = guideEcho.createDiv({ cls: 'wikey-modal-brief' })
      box.setText(this.guideHint.trim())
    }

    // §5.2.0 v2: progress 그룹 (msg line + bar) 을 wrap 하단으로 push (CSS margin-top: auto).
    const pct = this.computeFractionPct()
    const progressGroup = wrap.createDiv({ cls: 'wikey-modal-progress-group' })

    const msgLine = progressGroup.createDiv({ cls: 'wikey-modal-progress-line' })
    msgLine.createEl('span', {
      cls: 'wikey-modal-progress-msg',
      text: `${this.progressStep}/${this.progressTotal} · ${this.progressMessage}`,
    })
    msgLine.createEl('span', { cls: 'wikey-modal-progress-pct', text: `${pct}%` })

    const barOuter = progressGroup.createDiv({ cls: 'wikey-modal-progress-bar' })
    const barFill = barOuter.createDiv({ cls: 'wikey-modal-progress-fill' })
    barFill.style.width = `${pct}%`

    const btnRow = this.bodyEl.createDiv({ cls: 'wikey-modal-button-row wikey-modal-button-row-bottom' })
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
      this.bodyEl.createEl('div', { cls: 'wikey-modal-label', text: 'Guide reflection' })
      const reflBox = this.bodyEl.createDiv({ cls: 'wikey-modal-reflection' })
      reflBox.setText(this.plan.guideReflection)
    }

    this.bodyEl.createEl('div', { cls: 'wikey-modal-label', text: 'Pages to create / update' })
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
      `index.md +${this.plan.indexAdditions} entries · log.md ${this.plan.hasLogEntry ? '+1 entry' : 'no change'}`,
    )

    const btnRow = this.bodyEl.createDiv({ cls: 'wikey-modal-button-row' })
    const approveBtn = btnRow.createEl('button', { text: 'Approve & Write', cls: 'mod-cta' })
    const cancelBtn = btnRow.createEl('button', { text: 'Cancel' })
    // §5.3 follow-up — 사용자가 클릭 후 가시 피드백 부재로 반복 클릭하는 문제 차단:
    //   1) 두 버튼 즉시 disable (race 방지)
    //   2) Approve 라벨을 "Writing..." 으로 변경 + spinner-aware class 추가
    //   3) caller 가 finish() 호출하면 modal close 됨 (별도 cleanup 불필요)
    approveBtn.addEventListener('click', () => {
      if (approveBtn.disabled) return
      approveBtn.disabled = true
      cancelBtn.disabled = true
      approveBtn.setText('Writing...')
      approveBtn.addClass('wikey-modal-btn-busy')
      this.resolvePreview(true)
    })
    cancelBtn.addEventListener('click', () => {
      if (cancelBtn.disabled) return
      cancelBtn.disabled = true
      approveBtn.disabled = true
      this.resolvePreview(false)
    })
    setTimeout(() => approveBtn.focus(), 50)
  }

  private renderPlanItem(parent: HTMLElement, filename: string, existed: boolean, indent = false) {
    const row = parent.createDiv({ cls: 'wikey-modal-plan-item' + (indent ? ' wikey-modal-plan-indent' : '') })
    row.createEl('span', { cls: 'wikey-modal-plan-name', text: filename })
    row.createEl('span', {
      cls: existed ? 'wikey-modal-plan-badge wikey-modal-plan-update' : 'wikey-modal-plan-badge wikey-modal-plan-new',
      text: existed ? 'update' : 'new',
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
