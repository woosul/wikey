import { FuzzySuggestModal, Notice, TFile } from 'obsidian'
import type WikeyPlugin from './main'
import { ingest } from 'wikey-core'
import { WIKEY_CHAT_VIEW } from './sidebar-chat'

export function registerCommands(plugin: WikeyPlugin): void {
  // Cmd+Shift+I: Ingest current note
  plugin.addCommand({
    id: 'ingest-current-note',
    name: 'Ingest current note',
    hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'i' }],
    checkCallback: (checking) => {
      const file = plugin.app.workspace.getActiveFile()
      if (!file) return false
      if (checking) return true
      runIngest(plugin, file.path)
      return true
    },
  })

  // Command palette: Ingest file (picker)
  plugin.addCommand({
    id: 'ingest-file',
    name: 'Ingest file...',
    callback: () => {
      new IngestFileSuggestModal(plugin).open()
    },
  })

  // Obsidian URI protocol
  plugin.registerObsidianProtocolHandler('wikey', async (params) => {
    if (params.query) {
      await plugin.activateChatView()
      // Trigger query in chat view after a short delay for view to mount
      setTimeout(() => {
        const leaves = plugin.app.workspace.getLeavesOfType(WIKEY_CHAT_VIEW)
        if (leaves.length > 0) {
          const view = leaves[0].view as any
          if (view.inputEl) {
            view.inputEl.value = params.query
            view.handleSend?.()
          }
        }
      }, 300)
    }

    if (params.ingest) {
      runIngest(plugin, params.ingest)
    }
  })
}

async function runIngest(plugin: WikeyPlugin, sourcePath: string): Promise<void> {
  // Warn if outside raw/
  if (!sourcePath.startsWith('raw/')) {
    new Notice(`⚠️ 이 파일은 raw/ 디렉토리 밖에 있습니다: ${sourcePath}`)
  }

  try {
    const config = plugin.buildConfig()
    const basePath = (plugin.app.vault.adapter as any).basePath ?? ''
    const result = await ingest(
      sourcePath,
      plugin.wikiFS,
      config,
      plugin.httpClient,
      (progress) => {
        new Notice(`${progress.step}/${progress.total} ${progress.message}`)
      },
      { basePath },
    )

    const createdNames = [
      result.sourcePage.filename,
      ...result.entities.map((e) => e.filename),
      ...result.concepts.map((c) => c.filename),
    ]
    const links = createdNames.map((f) => `[[${f.replace('.md', '')}]]`).join(', ')

    new Notice(`인제스트 완료: ${createdNames.length}개 페이지 — ${links}`)
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    if (msg.includes('API') && msg.includes('key')) {
      new Notice('인제스트 실패: API 키를 확인하세요 (설정 → Wikey)')
    } else {
      new Notice(`인제스트 실패: ${msg}`)
    }
  }
}

class IngestFileSuggestModal extends FuzzySuggestModal<TFile> {
  constructor(private readonly plugin: WikeyPlugin) {
    super(plugin.app)
    this.setPlaceholder('인제스트할 파일을 선택하세요...')
  }

  getItems(): TFile[] {
    return this.plugin.app.vault.getMarkdownFiles().filter(
      (f) => !f.path.startsWith('wiki/') && !f.path.startsWith('.'),
    )
  }

  getItemText(file: TFile): string {
    return file.path
  }

  onChooseItem(file: TFile): void {
    runIngest(this.plugin, file.path)
  }
}
