import { Modal } from 'obsidian'
import type WikeyPlugin from './main'

const UPDATE_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

export class WikeyStatusBar {
  private statusEl: HTMLElement | null = null
  private intervalId: ReturnType<typeof setInterval> | null = null
  private debounceTimer: ReturnType<typeof setTimeout> | null = null

  constructor(private readonly plugin: WikeyPlugin) {}

  private debouncedUpdate(): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    this.debounceTimer = setTimeout(() => this.update(), 500)
  }

  register(): void {
    this.statusEl = this.plugin.addStatusBarItem()
    this.statusEl.addClass('wikey-status-bar')
    this.statusEl.addEventListener('click', () => this.showDetailModal())

    // vault가 완전히 로드된 후 첫 카운트 실행
    this.plugin.app.workspace.onLayoutReady(() => {
      this.update()
      this.intervalId = setInterval(() => this.update(), UPDATE_INTERVAL_MS)
    })

    // vault 파일 변경 시 실시간 갱신
    this.plugin.registerEvent(
      this.plugin.app.vault.on('create', () => this.debouncedUpdate()),
    )
    this.plugin.registerEvent(
      this.plugin.app.vault.on('delete', () => this.debouncedUpdate()),
    )
    this.plugin.registerEvent(
      this.plugin.app.vault.on('rename', () => this.debouncedUpdate()),
    )

    this.plugin.register(() => {
      if (this.intervalId) clearInterval(this.intervalId)
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
    })
  }

  update(): void {
    if (!this.statusEl) return

    const pageCount = this.countWikiPages()
    this.statusEl.setText(`📚 ${pageCount} pages`)
  }

  private countWikiPages(): number {
    const wikiFolder = this.plugin.app.vault.getAbstractFileByPath('wiki')
    if (!wikiFolder) return 0

    let count = 0
    const walk = (folder: any) => {
      if (!folder.children) return
      for (const child of folder.children) {
        if (child.extension === 'md') count++
        if (child.children) walk(child)
      }
    }
    walk(wikiFolder)
    return count
  }

  private showDetailModal(): void {
    const modal = new WikeyStatsModal(this.plugin)
    modal.open()
  }
}

class WikeyStatsModal extends Modal {
  constructor(private readonly plugin: WikeyPlugin) {
    super(plugin.app)
  }

  onOpen(): void {
    const { contentEl } = this
    contentEl.createEl('h2', { text: 'Wikey 통계' })

    const stats = this.collectStats()

    const table = contentEl.createEl('table')
    for (const [label, value] of stats) {
      const row = table.createEl('tr')
      row.createEl('td', { text: label })
      row.createEl('td', { text: String(value) })
    }
  }

  onClose(): void {
    this.contentEl.empty()
  }

  private collectStats(): Array<[string, string | number]> {
    const vault = this.plugin.app.vault
    const counts: Record<string, number> = {
      entities: 0,
      concepts: 0,
      sources: 0,
      analyses: 0,
    }

    for (const category of Object.keys(counts)) {
      const folder = vault.getAbstractFileByPath(`wiki/${category}`)
      if (folder && (folder as any).children) {
        counts[category] = (folder as any).children.filter(
          (c: any) => c.extension === 'md',
        ).length
      }
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0)

    // Meta pages (index, log, overview)
    const metaFolder = vault.getAbstractFileByPath('wiki')
    let metaCount = 0
    if (metaFolder && (metaFolder as any).children) {
      metaCount = (metaFolder as any).children.filter(
        (c: any) => c.extension === 'md',
      ).length
    }

    return [
      ['엔티티', counts.entities],
      ['개념', counts.concepts],
      ['소스', counts.sources],
      ['분석', counts.analyses],
      ['메타 (index, log 등)', metaCount],
      ['총 위키 페이지', total + metaCount],
    ]
  }
}
