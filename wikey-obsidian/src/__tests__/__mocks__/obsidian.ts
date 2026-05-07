/**
 * §5.15.A: Obsidian 1.7.x API mock layer (v0 minimum 5 인터페이스).
 *
 * 본 mock 은 vitest.config.ts 의 `resolve.alias.obsidian` 에 의해 wikey-obsidian
 * 의 모든 `import { ... } from 'obsidian'` 호출에 주입. plan §2.1 의 minimum 5
 * 인터페이스 (App / Vault / TFile / Notice / ItemView) 만 cover. 향후 test 추가 시
 * 점진적 확장 (Karpathy Simplicity First — 처음부터 15 인터페이스 mock 시 over-engineering).
 *
 * 의도적 제한 (의도적 유지):
 *   - 실제 Obsidian 의 EventRef / EventEmitter chain 미구현
 *   - MarkdownRenderer / FuzzySuggestModal 등 미사용 인터페이스 미포함
 *   - file.path 만 expose (frontmatter cache 등 미구현)
 *
 * 확장 시: 본 file 에 신규 mock class 추가 + 해당 test 가 의존 명시.
 */

// ── TFile ──

export class TFile {
  path: string
  basename: string
  extension: string
  name: string
  constructor(path: string) {
    this.path = path
    const segments = path.split('/')
    this.name = segments[segments.length - 1]
    const dotIdx = this.name.lastIndexOf('.')
    if (dotIdx > 0) {
      this.basename = this.name.slice(0, dotIdx)
      this.extension = this.name.slice(dotIdx + 1)
    } else {
      this.basename = this.name
      this.extension = ''
    }
  }
}

export class TFolder {
  path: string
  name: string
  children: Array<TFile | TFolder> = []
  constructor(path: string) {
    this.path = path
    const segments = path.split('/')
    this.name = segments[segments.length - 1] || path
  }
}

// ── Vault (minimal) ──

export class Vault {
  private files = new Map<string, string>()

  async read(file: TFile): Promise<string> {
    const content = this.files.get(file.path)
    if (content === undefined) throw new Error(`ENOENT: ${file.path}`)
    return content
  }

  async write(file: TFile, content: string): Promise<void> {
    this.files.set(file.path, content)
  }

  async create(path: string, content: string): Promise<TFile> {
    const f = new TFile(path)
    this.files.set(path, content)
    return f
  }

  async delete(file: TFile): Promise<void> {
    this.files.delete(file.path)
  }

  getAbstractFileByPath(path: string): TFile | null {
    if (!this.files.has(path)) return null
    return new TFile(path)
  }

  getMarkdownFiles(): TFile[] {
    const out: TFile[] = []
    for (const path of this.files.keys()) {
      if (path.endsWith('.md')) out.push(new TFile(path))
    }
    return out
  }

  /** Test helper — vault 내용 직접 set */
  __setFile(path: string, content: string): TFile {
    this.files.set(path, content)
    return new TFile(path)
  }

  /** Test helper — vault 내용 read (test assertion 용) */
  __getFile(path: string): string | undefined {
    return this.files.get(path)
  }

  /** Test helper — 모든 파일 path */
  __listAll(): string[] {
    return Array.from(this.files.keys()).sort()
  }
}

// ── App ──

export class App {
  vault: Vault
  workspace = {
    getActiveFile(): TFile | null { return null },
    onLayoutReady(cb: () => void): void { cb() },
  }
  constructor(vault?: Vault) {
    this.vault = vault ?? new Vault()
  }
}

// ── Notice ──

export class Notice {
  message: string
  /** Test helper — 마지막으로 띄운 Notice 들 (assertion 용) */
  static __log: string[] = []
  constructor(message: string, _timeout?: number) {
    this.message = message
    Notice.__log.push(message)
  }
  hide(): void { /* no-op */ }
  setMessage(m: string): this { this.message = m; return this }
}

// ── ItemView (minimal lifecycle) ──

export interface WorkspaceLeaf {
  view: ItemView | null
}

export class ItemView {
  containerEl: HTMLElement
  leaf: WorkspaceLeaf
  app: App | null = null

  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf
    this.containerEl = document.createElement('div')
    // Obsidian ItemView 는 contentEl 을 children[1] 로 expose. happy-dom 에서 동등 구조 시뮬레이션.
    const headerEl = document.createElement('div')
    const contentEl = document.createElement('div')
    this.containerEl.appendChild(headerEl)
    this.containerEl.appendChild(contentEl)
  }

  getViewType(): string { return '' }
  getDisplayText(): string { return '' }
  getIcon(): string { return '' }
  async onOpen(): Promise<void> { /* override */ }
  async onClose(): Promise<void> { /* override */ }
}

// ── 기타 자주 import 되는 minimal stubs ──

export class Plugin {
  app: App
  manifest: { id: string; name: string; version: string }
  constructor(app: App, manifest: { id: string; name: string; version: string }) {
    this.app = app
    this.manifest = manifest
  }
  async onload(): Promise<void> { /* override */ }
  async onunload(): Promise<void> { /* override */ }
  registerEvent(_eventRef: unknown): void { /* no-op */ }
  registerInterval(_id: number): void { /* no-op */ }
  addCommand(_cmd: unknown): void { /* no-op */ }
  addRibbonIcon(_icon: string, _title: string, _cb: () => void): void { /* no-op */ }
}

export class Modal {
  app: App
  contentEl: HTMLElement
  titleEl: HTMLElement
  modalEl: HTMLElement
  constructor(app: App) {
    this.app = app
    this.modalEl = document.createElement('div')
    this.titleEl = document.createElement('div')
    this.contentEl = document.createElement('div')
    this.modalEl.appendChild(this.titleEl)
    this.modalEl.appendChild(this.contentEl)
  }
  open(): void { /* override */ }
  close(): void { /* override */ }
  onOpen(): void { /* override */ }
  onClose(): void { /* override */ }
}

export class Setting {
  containerEl: HTMLElement
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl
  }
  setName(_name: string): this { return this }
  setDesc(_desc: string): this { return this }
  addText(_cb: (text: { setValue(v: string): unknown; onChange(cb: (v: string) => void): unknown }) => void): this {
    return this
  }
  addToggle(_cb: (toggle: { setValue(v: boolean): unknown; onChange(cb: (v: boolean) => void): unknown }) => void): this {
    return this
  }
  addButton(_cb: (btn: { setButtonText(t: string): unknown; onClick(cb: () => void): unknown }) => void): this {
    return this
  }
}

export function setIcon(_el: HTMLElement, _icon: string): void {
  // happy-dom 환경에서는 Obsidian 의 lucide icon DOM 이 없음 — no-op
}

export interface MarkdownPostProcessorContext {
  sourcePath: string
}

export class MarkdownRenderer {
  static async renderMarkdown(
    markdown: string,
    el: HTMLElement,
    _sourcePath: string,
    _component?: unknown,
  ): Promise<void> {
    // Minimal: <p> 으로 wrap (실제 markdown rendering 은 plugin runtime 만)
    const p = document.createElement('p')
    p.textContent = markdown
    el.appendChild(p)
  }
}
