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
      runIngest(plugin, file.path, (s, t, m) => new Notice(`${s}/${t} ${m}`)).then((r) => {
        if (r.success) new Notice(`인제스트 완료: ${r.createdPages.length}개 페이지`)
        else new Notice(`인제스트 실패: ${r.error}`)
      })
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

export interface IngestRunResult {
  success: boolean
  sourcePath: string
  createdPages: string[]
  error?: string
}

export async function runIngest(
  plugin: WikeyPlugin,
  sourcePath: string,
  onProgress?: (step: number, total: number, message: string) => void,
): Promise<IngestRunResult> {
  try {
    const config = plugin.buildConfig()
    const basePath = (plugin.app.vault.adapter as any).basePath ?? ''
    const result = await ingest(
      sourcePath,
      plugin.wikiFS,
      config,
      plugin.httpClient,
      (progress) => {
        onProgress?.(progress.step, progress.total, progress.message)
      },
      { basePath },
    )

    const createdPages = [
      result.sourcePage.filename,
      ...result.entities.map((e) => e.filename),
      ...result.concepts.map((c) => c.filename),
    ]

    // inbox 파일이면 processed로 이동
    if (sourcePath.startsWith('raw/0_inbox/')) {
      moveToProcessed(basePath, sourcePath)
    }

    return { success: true, sourcePath, createdPages }
  } catch (err: any) {
    const msg = err?.message ?? String(err)
    return { success: false, sourcePath, createdPages: [], error: msg }
  }
}

function moveToProcessed(basePath: string, sourcePath: string): void {
  const { join } = require('node:path') as typeof import('node:path')
  const { renameSync, mkdirSync, existsSync } = require('node:fs') as typeof import('node:fs')

  const processedDir = join(basePath, 'raw/0_inbox/_processed')
  if (!existsSync(processedDir)) mkdirSync(processedDir, { recursive: true })

  const fileName = sourcePath.split('/').pop() ?? sourcePath
  const src = join(basePath, sourcePath)
  const dst = join(processedDir, fileName)

  try {
    renameSync(src, dst)
  } catch {
    // 이동 실패해도 인제스트 결과에 영향 없음
  }
}

export class IngestFileSuggestModal extends FuzzySuggestModal<TFile> {
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
