/**
 * conflict-modal.ts — §5.3.1/§5.3.2 (plan v11) plugin GUI for ingest conflicts.
 *
 * Triggered when ingest() detects sidecar-user-edit / source-page-user-edit /
 * legacy-no-sidecar-hash conflicts AND the caller passes onConflict. Provides
 * the user 3 explicit choices:
 *
 *   • overwrite  — proceed with full force re-ingest (LOSES user edits to sidecar/page)
 *   • preserve   — protect mode (default): write new sidecar to <base>.md.new,
 *                  merge user marker H2 blocks into source page
 *   • cancel     — throw IngestCancelledByUserError; user resolves manually
 *
 * The default (P2-3): plugin auto-injects this modal when caller did not specify
 * onConflict — so silent auto-protect is never the default GUI experience.
 */

import { App, Modal } from 'obsidian'
import type { ConflictInfo } from 'wikey-core'

export type ConflictChoice = 'overwrite' | 'preserve' | 'cancel'

export class ConflictModal extends Modal {
  private resolveCb: (choice: ConflictChoice) => void
  private decided = false

  constructor(
    app: App,
    private readonly info: ConflictInfo,
    resolveCb: (choice: ConflictChoice) => void,
  ) {
    super(app)
    this.resolveCb = resolveCb
  }

  onOpen(): void {
    const { contentEl } = this
    contentEl.empty()
    contentEl.createEl('h3', { text: 'Wikey — 인제스트 충돌 감지' })

    const conflicts = this.info.decision.conflicts.join(', ')
    const reason = this.info.decision.reason
    contentEl.createEl('p', {
      text: `충돌 종류: ${conflicts}`,
      cls: 'wikey-conflict-summary',
    })
    contentEl.createEl('p', { text: `사유: ${reason}` })

    if (this.info.diff?.sidecar) {
      const pre = contentEl.createEl('pre', {
        cls: 'wikey-conflict-diff',
      })
      pre.style.maxHeight = '200px'
      pre.style.overflow = 'auto'
      pre.setText(this.info.diff.sidecar.slice(0, 800))
    }

    const buttonRow = contentEl.createEl('div', { cls: 'wikey-conflict-buttons' })
    buttonRow.style.display = 'flex'
    buttonRow.style.gap = '0.5em'
    buttonRow.style.marginTop = '1em'

    const preserveBtn = buttonRow.createEl('button', { text: '사용자 수정 보존 (preserve)' })
    preserveBtn.addEventListener('click', () => this.choose('preserve'))

    const overwriteBtn = buttonRow.createEl('button', { text: '덮어쓰기 (overwrite)' })
    overwriteBtn.addEventListener('click', () => this.choose('overwrite'))

    const cancelBtn = buttonRow.createEl('button', { text: '취소 (cancel)' })
    cancelBtn.addEventListener('click', () => this.choose('cancel'))
  }

  private choose(choice: ConflictChoice): void {
    if (this.decided) return
    this.decided = true
    this.resolveCb(choice)
    this.close()
  }

  onClose(): void {
    if (!this.decided) {
      // Window dismissed — treat as cancel.
      this.decided = true
      this.resolveCb('cancel')
    }
    this.contentEl.empty()
  }
}

/**
 * Default callback factory. plugin runIngestCore uses this when no caller-supplied
 * onConflict is provided. Returns a Promise<ConflictChoice>.
 */
export function createDefaultConflictCallback(app: App) {
  return (info: ConflictInfo): Promise<ConflictChoice> =>
    new Promise((resolve) => {
      new ConflictModal(app, info, resolve).open()
    })
}
