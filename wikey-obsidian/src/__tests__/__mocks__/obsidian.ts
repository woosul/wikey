/**
 * §5.15.A: Obsidian 1.7.x API mock layer (Cycle 1 minimum 5 인터페이스 + Cycle 2 확장).
 *
 * 본 mock 은 vitest.config.ts 의 `resolve.alias.obsidian` 에 의해 wikey-obsidian
 * 의 모든 `import { ... } from 'obsidian'` 호출에 주입. Cycle 1 = App / Vault /
 * TFile / Notice / ItemView 5 인터페이스 + Plugin / Modal / Setting / setIcon /
 * MarkdownRenderer stub. Cycle 2 (2026-05-08): FuzzySuggestModal + HTMLElement
 * DOM augmentation (setText / addClass / createDiv 등 — Obsidian 의 prototype
 * 확장을 happy-dom 환경에서 polyfill).
 *
 * 의도적 제한 (의도적 유지):
 *   - 실제 Obsidian 의 EventRef / EventEmitter chain 미구현
 *   - file.path 만 expose (frontmatter cache 등 미구현)
 *   - MarkdownRenderer 는 plain text wrap 만 (실 markdown rendering 은 plugin runtime)
 *
 * 확장 시: 본 file 에 신규 mock class 추가 + 해당 test 가 의존 명시.
 */

// ── HTMLElement augmentation (Obsidian prototype 확장 polyfill) ──
// Obsidian 1.7.x 는 HTMLElement.prototype 에 setText / addClass / createDiv 등을
// monkey-patch 한다. happy-dom 환경에서는 native HTMLElement 만 가용 → 본 mock 이
// import 될 때 (vitest alias 적용) 즉시 prototype 확장 적용.

declare global {
  interface HTMLElement {
    setText(text: string): void
    addClass(...classes: string[]): void
    removeClass(...classes: string[]): void
    hasClass(c: string): boolean
    toggleClass(c: string, value?: boolean): void
    empty(): void
    detach(): void
    show(): void
    hide(): void
    createDiv(opts?: string | { cls?: string | string[]; text?: string; attr?: Record<string, string> }): HTMLDivElement
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K,
      opts?: string | { cls?: string | string[]; text?: string; attr?: Record<string, string>; href?: string; value?: string },
    ): HTMLElementTagNameMap[K]
    createSpan(opts?: string | { cls?: string | string[]; text?: string }): HTMLSpanElement
  }
}

function applyOpts(
  el: HTMLElement,
  opts?: string | { cls?: string | string[]; text?: string; attr?: Record<string, string>; href?: string; value?: string },
): void {
  if (typeof opts === 'string') {
    if (opts) el.classList.add(...opts.split(/\s+/).filter((s) => s.length > 0))
    return
  }
  if (!opts) return
  if (opts.cls) {
    const classes = Array.isArray(opts.cls) ? opts.cls : opts.cls.split(/\s+/).filter((s) => s.length > 0)
    if (classes.length > 0) el.classList.add(...classes)
  }
  if (opts.text !== undefined) el.textContent = opts.text
  if (opts.attr) {
    for (const [k, v] of Object.entries(opts.attr)) el.setAttribute(k, v)
  }
  if (opts.href !== undefined && el instanceof HTMLAnchorElement) el.href = opts.href
  // §5.6.6 Step F — `<option value="...">` shape. Production Obsidian's createEl
  // forwards opts.value to HTMLOptionElement; mirror so option DOM is queryable
  // by .value / select.value setter (settings-tab.renderSubscriptionModeRow).
  if (opts.value !== undefined && el instanceof HTMLOptionElement) el.value = opts.value
}

// happy-dom 의 HTMLElement.prototype — 1회만 augment (idempotent guard)
const proto = HTMLElement.prototype as unknown as Record<string, unknown>
if (typeof proto.setText !== 'function') {
  proto.setText = function (this: HTMLElement, text: string): void { this.textContent = text }
  proto.addClass = function (this: HTMLElement, ...classes: string[]): void {
    for (const c of classes) if (c) this.classList.add(c)
  }
  proto.removeClass = function (this: HTMLElement, ...classes: string[]): void {
    for (const c of classes) if (c) this.classList.remove(c)
  }
  proto.hasClass = function (this: HTMLElement, c: string): boolean { return this.classList.contains(c) }
  proto.toggleClass = function (this: HTMLElement, c: string, value?: boolean): void {
    if (value === undefined) this.classList.toggle(c)
    else this.classList.toggle(c, value)
  }
  proto.empty = function (this: HTMLElement): void {
    while (this.firstChild) this.removeChild(this.firstChild)
  }
  proto.detach = function (this: HTMLElement): void { this.parentElement?.removeChild(this) }
  proto.show = function (this: HTMLElement): void { (this.style as CSSStyleDeclaration).display = '' }
  proto.hide = function (this: HTMLElement): void { (this.style as CSSStyleDeclaration).display = 'none' }
  proto.createDiv = function (
    this: HTMLElement,
    opts?: string | { cls?: string | string[]; text?: string; attr?: Record<string, string> },
  ): HTMLDivElement {
    const div = document.createElement('div')
    applyOpts(div, opts)
    this.appendChild(div)
    return div
  }
  proto.createEl = function <K extends keyof HTMLElementTagNameMap>(
    this: HTMLElement,
    tag: K,
    opts?: string | { cls?: string | string[]; text?: string; attr?: Record<string, string>; href?: string },
  ): HTMLElementTagNameMap[K] {
    const el = document.createElement(tag)
    applyOpts(el as HTMLElement, opts)
    this.appendChild(el)
    return el
  }
  proto.createSpan = function (
    this: HTMLElement,
    opts?: string | { cls?: string | string[]; text?: string },
  ): HTMLSpanElement {
    const span = document.createElement('span')
    applyOpts(span, opts)
    this.appendChild(span)
    return span
  }
}

// Obsidian global `createDiv` — production exposes this as a global; happy-dom
// callers (sidebar-chat.openHelp etc.) expect window.createDiv to exist. Mirror
// the HTMLElement.prototype.createDiv shape but as a free function returning
// a detached element. (§5.19 UI test fix.)
declare global {
  // eslint-disable-next-line no-var
  var createDiv: (
    opts?: string | { cls?: string | string[]; text?: string; attr?: Record<string, string> },
  ) => HTMLDivElement
}
if (typeof (globalThis as { createDiv?: unknown }).createDiv !== 'function') {
  ;(globalThis as { createDiv: (opts?: unknown) => HTMLDivElement }).createDiv = (
    opts?: unknown,
  ): HTMLDivElement => {
    const div = document.createElement('div')
    applyOpts(
      div,
      opts as string | { cls?: string | string[]; text?: string; attr?: Record<string, string> } | undefined,
    )
    return div
  }
}

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
  // §5.7.8 — minimal `adapter` surface used by the plugin's `basePath` lookup and
  // `runQueryAnalysis` prompt-override read. Tests can mutate `adapter.basePath`
  // directly; `exists/read` default to "no override" so production paths are taken.
  adapter: {
    basePath: string
    exists: (p: string) => Promise<boolean>
    read: (p: string) => Promise<string>
    write: (p: string, c: string) => Promise<void>
  } = {
    basePath: '',
    async exists() { return false },
    async read() { throw new Error('mock vault adapter read — not stubbed') },
    async write() { /* no-op */ },
  }

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
  addSettingTab(_tab: unknown): void { /* no-op */ }
  registerView(_type: string, _factory: (leaf: unknown) => ItemView): void { /* no-op */ }
  registerObsidianProtocolHandler(_action: string, _cb: (params: Record<string, string>) => void): void { /* no-op */ }
  async loadData(): Promise<unknown> { return {} }
  async saveData(_data: unknown): Promise<void> { /* no-op */ }
}

// §5.7.8 — minimal `PluginSettingTab` stub so `main.ts → settings-tab.ts` import chain
// resolves under happy-dom. The tab class is never opened in unit tests (we assert on
// settings-tab source via grep). Constructor + display() are sufficient.
export class PluginSettingTab {
  app: App
  containerEl: HTMLElement
  constructor(app: App, _plugin: unknown) {
    this.app = app
    this.containerEl = document.createElement('div')
  }
  display(): void { /* override */ }
  hide(): void { /* override */ }
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

// ── FuzzySuggestModal (commands.ts dep) ──
// Cycle 2 추가: commands.ts 의 IngestFileSuggestModal / DeleteSourceSuggestModal 가
// FuzzySuggestModal<T> 상속. test 환경에서 commands.ts import 시 evaluate 가능하도록
// minimum stub. 실제 fuzzy filter / open behavior 미구현 (test 가 실 modal interaction
// 사용 안 함 — commands.ts module 만 evaluate).

export interface FuzzyMatch<T> {
  item: T
  match: { score: number; matches: number[][] }
}

export class FuzzySuggestModal<T> extends Modal {
  constructor(app: App) {
    super(app)
  }
  getItems(): T[] { return [] }
  getItemText(_item: T): string { return '' }
  onChooseItem(_item: T, _evt: MouseEvent | KeyboardEvent): void { /* override */ }
  setPlaceholder(_text: string): void { /* no-op */ }
}

export class Setting {
  containerEl: HTMLElement
  /** Created DOM container so tests can query the Setting rendering. */
  settingEl: HTMLDivElement
  /** Most recently constructed Setting's dropdown handle (test helper). */
  static __lastDropdown?: {
    el: HTMLSelectElement
    options: Array<{ value: string; text: string }>
    onChangeCb?: (value: string) => unknown
  }
  /** Setting.controlEl exposes the `.setting-item-control` lazy-created div
   *  (matches Obsidian's `Setting` class surface used by code that does
   *  `setting.controlEl.appendChild(customSelect)`). */
  get controlEl(): HTMLElement {
    let control = this.settingEl.querySelector('.setting-item-control') as HTMLElement | null
    if (!control) {
      control = document.createElement('div')
      control.classList.add('setting-item-control')
      this.settingEl.appendChild(control)
    }
    return control
  }
  constructor(containerEl: HTMLElement) {
    this.containerEl = containerEl
    this.settingEl = document.createElement('div')
    this.settingEl.classList.add('setting-item')
    containerEl.appendChild(this.settingEl)
  }
  setName(name: string): this {
    const info = this.settingEl.querySelector('.setting-item-info') ?? this.settingEl.appendChild((() => {
      const d = document.createElement('div')
      d.classList.add('setting-item-info')
      return d
    })())
    let nameEl = info.querySelector('.setting-item-name') as HTMLElement | null
    if (!nameEl) {
      nameEl = document.createElement('div')
      nameEl.classList.add('setting-item-name')
      info.appendChild(nameEl)
    }
    nameEl.textContent = name
    return this
  }
  setDesc(desc: string): this {
    const info = this.settingEl.querySelector('.setting-item-info') ?? this.settingEl.appendChild((() => {
      const d = document.createElement('div')
      d.classList.add('setting-item-info')
      return d
    })())
    let descEl = info.querySelector('.setting-item-description') as HTMLElement | null
    if (!descEl) {
      descEl = document.createElement('div')
      descEl.classList.add('setting-item-description')
      info.appendChild(descEl)
    }
    descEl.textContent = desc
    return this
  }
  addText(_cb: (text: { setValue(v: string): unknown; onChange(cb: (v: string) => void): unknown }) => void): this {
    return this
  }
  addToggle(_cb: (toggle: { setValue(v: boolean): unknown; onChange(cb: (v: boolean) => void): unknown }) => void): this {
    return this
  }
  addButton(_cb: (btn: { setButtonText(t: string): unknown; onClick(cb: () => void): unknown }) => void): this {
    return this
  }
  addDropdown(cb: (dropdown: DropdownHandle) => void): this {
    const control = document.createElement('div')
    control.classList.add('setting-item-control')
    this.settingEl.appendChild(control)
    const select = document.createElement('select')
    select.classList.add('dropdown')
    control.appendChild(select)
    const options: Array<{ value: string; text: string }> = []
    const handle: DropdownHandle = {
      addOption(value: string, text: string): DropdownHandle {
        const opt = document.createElement('option')
        opt.value = value
        opt.textContent = text
        select.appendChild(opt)
        options.push({ value, text })
        return handle
      },
      setValue(v: string): DropdownHandle {
        select.value = v
        return handle
      },
      onChange(fn: (v: string) => unknown): DropdownHandle {
        select.addEventListener('change', () => { void fn(select.value) })
        Setting.__lastDropdown = { el: select, options, onChangeCb: fn }
        return handle
      },
      getValue(): string { return select.value },
      selectEl: select,
    }
    Setting.__lastDropdown = { el: select, options }
    cb(handle)
    return this
  }
}

export interface DropdownHandle {
  addOption(value: string, text: string): DropdownHandle
  setValue(v: string): DropdownHandle
  onChange(fn: (v: string) => unknown): DropdownHandle
  getValue(): string
  selectEl: HTMLSelectElement
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

  // Obsidian 1.5+ surface — `MarkdownRenderer.render(app, md, el, path, component)`.
  // Test path mirrors `renderMarkdown` shape.
  static async render(
    _app: unknown,
    markdown: string,
    el: HTMLElement,
    _sourcePath: string,
    _component?: unknown,
  ): Promise<void> {
    const p = document.createElement('p')
    p.textContent = markdown
    el.appendChild(p)
  }
}
