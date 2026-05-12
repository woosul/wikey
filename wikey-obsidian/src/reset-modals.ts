/**
 * reset-modals.ts — Phase 4.5.2 (본체 필수).
 *
 * 삭제·초기화 확인 모달. 순수 UI — 실제 fs/registry 변경은 호출자가 수행.
 * 모든 Modal 은 타이핑 확인(`DEL <id>` / `RESET <SCOPE>`)을 강제.
 */

import { App, Modal, Notice, Setting } from 'obsidian'
import type {
  DeletionImpact,
  ResetPreview,
  ResetScope,
} from 'wikey-core'

// ─────────────────────────────────────────────────────────────
//  Delete confirmation
// ─────────────────────────────────────────────────────────────

export interface DeleteImpactModalOpts {
  readonly title: string
  readonly confirmPhrase: string  // e.g. `DEL sha256:abcd1234`
  readonly impact: DeletionImpact
  readonly onConfirm: () => Promise<void>
}

export class DeleteImpactModal extends Modal {
  private typed = ''
  constructor(app: App, private readonly opts: DeleteImpactModalOpts) {
    super(app)
  }

  onOpen(): void {
    const { contentEl } = this
    contentEl.empty()
    contentEl.createEl('h2', { text: this.opts.title })

    const impact = this.opts.impact
    const summary = contentEl.createEl('div')
    summary.createEl('p', {
      text: `Affected: ${impact.pages.length} pages / ${
        impact.registryRecord ? 1 : 0
      } registry records / ${impact.backlinks} backlinks`,
    })

    if (impact.pages.length > 0) {
      const list = summary.createEl('ul')
      for (const p of impact.pages.slice(0, 20)) list.createEl('li', { text: p })
      if (impact.pages.length > 20) {
        summary.createEl('p', {
          text: `… +${impact.pages.length - 20} more`,
        })
      }
    }

    contentEl.createEl('p', {
      text: `Type exactly "${this.opts.confirmPhrase}" below to confirm.`,
    })

    let confirmBtn: HTMLButtonElement | null = null
    new Setting(contentEl)
      .setName('Confirmation phrase')
      .addText((t) => {
        t.onChange((v) => {
          this.typed = v
          if (confirmBtn) confirmBtn.disabled = v !== this.opts.confirmPhrase
        })
      })

    new Setting(contentEl)
      .addButton((b) => {
        confirmBtn = b.buttonEl
        b.setButtonText('Confirm delete')
          .setWarning()
          .setDisabled(true)
          .onClick(async () => {
            if (this.typed !== this.opts.confirmPhrase) return
            b.setDisabled(true)
            try {
              await this.opts.onConfirm()
              new Notice('Delete complete')
              this.close()
            } catch (err: any) {
              new Notice(`Delete failed: ${err?.message ?? err}`)
              b.setDisabled(false)
            }
          })
      })
      .addButton((b) =>
        b.setButtonText('Cancel').onClick(() => this.close()),
      )
  }

  onClose(): void {
    this.contentEl.empty()
  }
}

// ─────────────────────────────────────────────────────────────
//  Reset confirmation (5-way scope)
// ─────────────────────────────────────────────────────────────

export interface ResetModalOpts {
  readonly scope: ResetScope
  readonly preview: ResetPreview
  readonly onConfirm: () => Promise<void>
}

const SCOPE_LABELS: Record<ResetScope, string> = {
  'wiki+registry': 'wiki + registry (raw/ kept)',
  'wiki-only': 'wiki only (registry kept)',
  'registry-only': 'registry + source_id only (wiki content kept)',
  'qmd-index': 'qmd index only (rebuilt on reindex)',
  settings: 'settings only (data.json → DEFAULT_SETTINGS)',
}

export class ResetImpactModal extends Modal {
  private typed = ''
  constructor(app: App, private readonly opts: ResetModalOpts) {
    super(app)
  }

  onOpen(): void {
    const { contentEl } = this
    contentEl.empty()
    contentEl.createEl('h2', { text: `Reset: ${SCOPE_LABELS[this.opts.scope]}` })

    const preview = this.opts.preview
    contentEl.createEl('p', {
      text: `Affected: ${preview.files.length} files${
        preview.bytes > 0 ? ` / ${formatBytes(preview.bytes)}` : ''
      }`,
    })

    if (preview.files.length > 0) {
      const list = contentEl.createEl('ul')
      for (const p of preview.files.slice(0, 30)) list.createEl('li', { text: p })
      if (preview.files.length > 30) {
        contentEl.createEl('p', { text: `… +${preview.files.length - 30} more` })
      }
    }

    const phrase = confirmPhraseForScope(this.opts.scope)
    contentEl.createEl('p', {
      text: `Type exactly "${phrase}" to confirm.`,
    })

    let confirmBtn: HTMLButtonElement | null = null
    new Setting(contentEl)
      .setName('Confirmation phrase')
      .addText((t) =>
        t.onChange((v) => {
          this.typed = v
          if (confirmBtn) confirmBtn.disabled = v !== phrase
        }),
      )

    new Setting(contentEl)
      .addButton((b) => {
        confirmBtn = b.buttonEl
        b.setButtonText('Confirm reset')
          .setWarning()
          .setDisabled(true)
          .onClick(async () => {
            if (this.typed !== phrase) return
            b.setDisabled(true)
            try {
              await this.opts.onConfirm()
              new Notice('Reset complete')
              this.close()
            } catch (err: any) {
              new Notice(`Reset failed: ${err?.message ?? err}`)
              b.setDisabled(false)
            }
          })
      })
      .addButton((b) =>
        b.setButtonText('Cancel').onClick(() => this.close()),
      )
  }

  onClose(): void {
    this.contentEl.empty()
  }
}

export function confirmPhraseForScope(scope: ResetScope): string {
  return `RESET ${scope.toUpperCase()}`
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}
