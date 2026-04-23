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
      text: `영향 페이지 ${impact.pages.length}건 / registry 레코드 ${
        impact.registryRecord ? 1 : 0
      }건 / backlink ${impact.backlinks}건`,
    })

    if (impact.pages.length > 0) {
      const list = summary.createEl('ul')
      for (const p of impact.pages.slice(0, 20)) list.createEl('li', { text: p })
      if (impact.pages.length > 20) {
        summary.createEl('p', {
          text: `… +${impact.pages.length - 20}건 더`,
        })
      }
    }

    contentEl.createEl('p', {
      text: `확인하려면 아래에 정확히 "${this.opts.confirmPhrase}" 를 입력하세요.`,
    })

    let confirmBtn: HTMLButtonElement | null = null
    new Setting(contentEl)
      .setName('확인 문자열')
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
              new Notice('삭제 완료')
              this.close()
            } catch (err: any) {
              new Notice(`삭제 실패: ${err?.message ?? err}`)
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
  'wiki+registry': 'wiki + registry (raw/ 유지)',
  'wiki-only': 'wiki 만 (registry 유지)',
  'registry-only': 'registry + source_id 만 (wiki 콘텐츠 유지)',
  'qmd-index': 'qmd 인덱스만 (reindex 재빌드)',
  settings: '설정만 (data.json → DEFAULT_SETTINGS)',
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
      text: `파일 ${preview.files.length}건${
        preview.bytes > 0 ? ` / ${formatBytes(preview.bytes)}` : ''
      } 영향`,
    })

    if (preview.files.length > 0) {
      const list = contentEl.createEl('ul')
      for (const p of preview.files.slice(0, 30)) list.createEl('li', { text: p })
      if (preview.files.length > 30) {
        contentEl.createEl('p', { text: `… +${preview.files.length - 30}건 더` })
      }
    }

    const phrase = confirmPhraseForScope(this.opts.scope)
    contentEl.createEl('p', {
      text: `확인하려면 "${phrase}" 를 정확히 입력하세요.`,
    })

    let confirmBtn: HTMLButtonElement | null = null
    new Setting(contentEl)
      .setName('확인 문자열')
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
              new Notice('리셋 완료')
              this.close()
            } catch (err: any) {
              new Notice(`리셋 실패: ${err?.message ?? err}`)
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
