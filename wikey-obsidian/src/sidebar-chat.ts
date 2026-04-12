import { ItemView, MarkdownRenderer, Notice, WorkspaceLeaf } from 'obsidian'
import type WikeyPlugin from './main'
import { query, resolveProvider, classifyFile, moveFile, fetchModelList } from 'wikey-core'
import { runIngest, IngestFileSuggestModal } from './commands'
import type { IngestRunResult } from './commands'

export const WIKEY_CHAT_VIEW = 'wikey-chat'

interface ChatMessage {
  readonly role: 'user' | 'assistant' | 'error'
  readonly content: string
}

// Bootstrap SVG icons (inline, 16x16)
const ICONS = {
  dashboard: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4 11H2v3h2zm5-4H7v7h2zm5-5h-2v12h2zm-2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM6 7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zm-5 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1z"/></svg>',
  audit: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z"/><path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0"/></svg>',
  plus: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4"/></svg>',
  question: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/><path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286m1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94"/></svg>',
  trash: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/></svg>',
  reload: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/></svg>',
  close: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/></svg>',
  send: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16"><path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471z"/></svg>',
  clipboard: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1z"/><path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0z"/></svg>',
  thumbUp: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M8.864.046C7.908-.193 7.02.53 6.956 1.466c-.072 1.051-.23 2.016-.428 2.59-.125.36-.479 1.013-1.04 1.639-.557.623-1.282 1.178-2.131 1.41C2.685 7.288 2 7.87 2 8.72v4.001c0 .845.682 1.464 1.448 1.545 1.07.114 1.564.415 2.068.723l.048.03c.272.165.578.348.97.484.397.136.861.217 1.466.217h3.5c.937 0 1.599-.477 1.934-1.064a1.86 1.86 0 0 0 .254-.912c0-.152-.023-.312-.077-.464.201-.263.38-.578.488-.901.11-.33.172-.762.004-1.149.069-.13.12-.269.159-.403.077-.27.113-.568.113-.857 0-.288-.036-.585-.113-.856a2 2 0 0 0-.138-.362 1.9 1.9 0 0 0 .234-1.734c-.206-.592-.682-1.1-1.2-1.272-.847-.282-1.803-.276-2.516-.211a10 10 0 0 0-.443.05 9.4 9.4 0 0 0-.062-4.509A1.38 1.38 0 0 0 8.864.046M11.5 14.721H8c-.51 0-.863-.069-1.14-.164-.281-.097-.506-.228-.776-.393l-.04-.024c-.555-.339-1.198-.731-2.49-.868-.333-.036-.554-.29-.554-.55V8.72c0-.254.226-.543.62-.65 1.095-.3 1.977-.996 2.614-1.708.635-.71 1.064-1.475 1.238-1.978.243-.7.407-1.768.482-2.85.025-.362.36-.594.667-.518l.262.066c.16.04.258.143.288.255a8.34 8.34 0 0 1-.145 4.725.5.5 0 0 0 .595.644l.003-.001.014-.003.058-.014a9 9 0 0 1 1.036-.157c.663-.06 1.457-.054 2.11.164.175.058.45.3.57.65.107.308.087.67-.266 1.022l-.353.353.353.354c.043.043.105.141.154.315.048.167.075.37.075.581 0 .212-.027.414-.075.582-.05.174-.111.272-.154.315l-.353.353.353.354c.047.047.109.177.005.488a2.2 2.2 0 0 1-.505.805l-.353.353.353.354c.006.005.041.05.041.17a.9.9 0 0 1-.121.416c-.165.288-.503.56-1.066.56z"/></svg>',
  thumbDown: '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M8.864 15.674c-.956.24-1.843-.484-1.908-1.42-.072-1.05-.23-2.015-.428-2.59-.125-.36-.479-1.012-1.04-1.638-.557-.624-1.282-1.179-2.131-1.41C2.685 8.432 2 7.85 2 7V3c0-.845.682-1.464 1.448-1.546 1.07-.113 1.564-.415 2.068-.723l.048-.029c.272-.166.578-.349.97-.484C6.931.08 7.395 0 8 0h3.5c.937 0 1.599.478 1.934 1.064.164.287.254.607.254.913 0 .152-.023.312-.077.464.201.262.38.577.488.9.11.33.172.762.004 1.15.069.13.12.268.159.403.077.27.113.567.113.856s-.036.586-.113.856c-.035.12-.08.244-.138.363.394.571.418 1.2.234 1.733-.206.592-.682 1.1-1.2 1.272-.847.283-1.803.276-2.516.211a10 10 0 0 1-.443-.05 9.36 9.36 0 0 1-.062 4.51c-.138.508-.55.848-1.012.964zM11.5 1H8c-.51 0-.863.068-1.14.163-.281.097-.506.229-.776.393l-.04.025c-.555.338-1.198.73-2.49.868-.333.035-.554.29-.554.55V7c0 .255.226.543.62.65 1.095.3 1.977.997 2.614 1.709.635.71 1.064 1.475 1.238 1.977.243.7.407 1.768.482 2.85.025.362.36.595.667.518l.262-.065c.16-.04.258-.144.288-.255a8.34 8.34 0 0 0-.145-4.726.5.5 0 0 1 .595-.643h.003l.014.004.058.013a9 9 0 0 0 1.036.157c.663.06 1.457.054 2.11-.163.175-.059.45-.301.57-.651.107-.308.087-.67-.266-1.021L12.793 7l.353-.354c.043-.042.105-.14.154-.315.048-.167.075-.37.075-.581s-.027-.414-.075-.581c-.05-.174-.111-.273-.154-.315l-.353-.354.353-.354c.047-.047.109-.176.005-.488a2.2 2.2 0 0 0-.505-.804l-.353-.354.353-.354c.006-.005.041-.05.041-.17a.9.9 0 0 0-.121-.415C12.4 1.272 12.063 1 11.5 1"/></svg>',
  folder: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.54 3.87.5 3a2 2 0 0 1 2-2h3.672a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 9.828 3H14a2 2 0 0 1 2 2v1.5a.5.5 0 0 1-1 0V5a1 1 0 0 0-1-1H9.828a3 3 0 0 1-2.12-.879l-.83-.828A1 1 0 0 0 6.172 2H2.5a1 1 0 0 0-1 .981z"/><path d="M14.5 5.5a.5.5 0 0 0-.468.324L12.78 9H3.22l-1.252-3.176A.5.5 0 0 0 1.5 5.5a.5.5 0 0 0-.49.412L.008 11.91a.5.5 0 0 0 .49.588h15.004a.5.5 0 0 0 .49-.588l-1.002-5.998A.5.5 0 0 0 14.5 5.5"/></svg>',
}

type PanelName = 'dashboard' | 'audit' | 'ingest' | 'help' | null

export class WikeyChatView extends ItemView {
  private messagesEl!: HTMLElement
  private inputEl!: HTMLTextAreaElement
  private sendBtn!: HTMLButtonElement
  private ingestPanel: HTMLElement | null = null
  private activePanel: PanelName = null
  private panelBtns: Record<string, HTMLElement> = {}

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: WikeyPlugin,
  ) {
    super(leaf)
  }

  getViewType(): string { return WIKEY_CHAT_VIEW }
  getDisplayText(): string { return 'Wikey' }
  getIcon(): string { return 'search' }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement
    container.empty()
    container.addClass('wikey-chat-container')

    // ── Header ──
    const header = container.createDiv({ cls: 'wikey-chat-header' })
    header.createEl('span', { text: 'Wikey', cls: 'wikey-chat-title' })
    const actions = header.createDiv({ cls: 'wikey-chat-header-actions' })

    this.panelBtns.dashboard = this.makeHeaderBtn(actions, ICONS.dashboard, '대시보드', () => this.togglePanel('dashboard'))
    this.panelBtns.audit = this.makeHeaderBtn(actions, ICONS.audit, '미인제스트', () => this.togglePanel('audit'))
    this.panelBtns.ingest = this.makeHeaderBtn(actions, ICONS.plus, '인제스트', () => this.togglePanel('ingest'))
    this.panelBtns.help = this.makeHeaderBtn(actions, ICONS.question, '도움말', () => this.togglePanel('help'))
    this.makeHeaderBtn(actions, ICONS.trash, '대화 초기화', () => this.clearChat())
    this.makeHeaderBtn(actions, ICONS.reload, '리로드', () => (this.app as any).commands?.executeCommandById?.('app:reload'))
    this.makeHeaderBtn(actions, ICONS.close, '닫기', () => this.leaf.detach())

    // ── Messages ──
    this.messagesEl = container.createDiv({ cls: 'wikey-chat-messages' })
    for (const msg of this.plugin.chatHistory) this.renderMessage(msg)

    // ── Input Area ──
    const inputWrapper = container.createDiv({ cls: 'wikey-chat-input-wrapper' })
    const inputArea = inputWrapper.createDiv({ cls: 'wikey-chat-input-area' })

    this.inputEl = inputArea.createEl('textarea', {
      cls: 'wikey-chat-input',
      attr: { placeholder: '질문을 입력하세요...', rows: '3' },
    })

    this.sendBtn = inputArea.createEl('button', { cls: 'wikey-chat-send-btn' })
    this.sendBtn.innerHTML = ICONS.send

    this.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleSend() }
    })
    this.sendBtn.addEventListener('click', () => this.handleSend())

    // Model selector: "AI Model : PROVIDER — model-name (V)"
    const modelRow = inputWrapper.createDiv({ cls: 'wikey-chat-model-row' })
    const config = this.plugin.buildConfig()
    const { provider, model: currentModel } = resolveProvider('default', config)

    modelRow.createEl('span', { text: 'AI Model', cls: 'wikey-chat-model-label' })
    modelRow.createEl('span', { text: ':', cls: 'wikey-chat-model-sep' })
    modelRow.createEl('span', { text: provider.toUpperCase(), cls: 'wikey-chat-provider-label' })
    modelRow.createEl('span', { text: '\u2014', cls: 'wikey-chat-model-sep' })

    const modelSelect = modelRow.createEl('select', { cls: 'wikey-select' })
    // 현재 모델을 초기 옵션으로 추가 (API 로드 전)
    const savedModel = this.plugin.settings.cloudModel || currentModel
    modelSelect.createEl('option', { text: savedModel, attr: { value: savedModel } })

    modelSelect.addEventListener('change', async () => {
      this.plugin.settings.cloudModel = modelSelect.value
      await this.plugin.saveSettings()
    })

    // 비동기로 API에서 모델 목록 로드
    this.loadModelList(provider, modelSelect, savedModel)

    if (this.plugin.chatHistory.length === 0) this.showWelcome()
  }

  async onClose() { /* cleanup */ }

  // ── Header Helpers ──

  private makeHeaderBtn(parent: HTMLElement, icon: string, label: string, onClick: () => void): HTMLElement {
    const btn = parent.createEl('button', { cls: 'wikey-header-btn', attr: { 'aria-label': label, title: label } })
    btn.innerHTML = icon
    btn.addEventListener('click', onClick)
    return btn
  }

  // ── Panel Toggle (exclusive) ──

  private togglePanel(name: PanelName) {
    if (this.activePanel === name) {
      // 같은 패널 재클릭 → 닫기
      this.closeActivePanel()
      this.activePanel = null
    } else {
      // 다른 패널 → 기존 닫고 새로 열기
      this.closeActivePanel()
      this.activePanel = name
      if (name === 'dashboard') this.openDashboard()
      else if (name === 'audit') this.openAuditPanel()
      else if (name === 'ingest') this.openIngestPanel()
      else if (name === 'help') this.openHelp()
    }
    this.updatePanelBtnStates()
    this.syncWelcomeVisibility()
  }

  private auditPanel: HTMLElement | null = null

  private closeActivePanel() {
    if (this.dashboardPanel) {
      this.dashboardPanel.remove()
      this.dashboardPanel = null
    }
    if (this.auditPanel) {
      this.auditPanel.remove()
      this.auditPanel = null
      this.messagesEl.style.display = ''
    }
    if (this.helpPanel) {
      this.helpPanel.remove()
      this.helpPanel = null
    }
    if (this.ingestPanel) {
      this.ingestPanel.remove()
      this.ingestPanel = null
      this.pendingFiles = []
    }
  }

  private updatePanelBtnStates() {
    for (const [key, btn] of Object.entries(this.panelBtns)) {
      if (key === this.activePanel) btn.addClass('wikey-header-btn-active')
      else btn.removeClass('wikey-header-btn-active')
    }
  }

  // ── Chat Actions ──

  private clearChat() {
    this.plugin.chatHistory = []
    this.messagesEl.empty()
    this.activePanel = null
    this.updatePanelBtnStates()
    this.showWelcome()
  }

  private showWelcome() {
    const w = this.messagesEl.createDiv({ cls: 'wikey-chat-welcome' })
    w.createEl('p', { text: '위키에 대해 질문해보세요.' })
    w.createEl('p', { text: '예: "DJI O3의 주요 스펙은?", "RAG와 LLM Wiki 비교"', cls: 'wikey-chat-welcome-hint' })
  }

  /** 특수 패널이 열려 있으면 welcome 숨김, 모두 닫히고 대화 비어 있으면 복원 */
  private syncWelcomeVisibility() {
    const hasPanel = this.activePanel !== null
    const welcomeEl = this.messagesEl.querySelector('.wikey-chat-welcome') as HTMLElement | null

    if (hasPanel) {
      if (welcomeEl) welcomeEl.style.display = 'none'
    } else if (this.plugin.chatHistory.length === 0) {
      if (welcomeEl) {
        welcomeEl.style.display = ''
      } else {
        this.showWelcome()
      }
    }
  }

  private async handleSend() {
    const question = this.inputEl.value.trim()
    if (!question) return

    this.messagesEl.querySelector('.wikey-chat-welcome')?.remove()

    const userMsg: ChatMessage = { role: 'user', content: question }
    this.plugin.chatHistory.push(userMsg)
    this.renderMessage(userMsg)

    this.inputEl.value = ''
    this.setInputEnabled(false)

    const loadingEl = this.messagesEl.createDiv({ cls: 'wikey-chat-loading' })
    loadingEl.createEl('span', { text: '답변을 생성하고 있습니다...' })
    this.scrollToBottom()

    try {
      const config = this.plugin.buildConfig()
      const basePath = (this.app.vault.adapter as any).basePath ?? ''
      const result = await query(question, config, this.plugin.httpClient, {
        basePath, wikiFS: this.plugin.wikiFS,
        execEnv: this.plugin.getExecEnv(),
        nodePath: this.plugin.settings.detectedNodePath,
      })
      loadingEl.remove()
      const assistantMsg: ChatMessage = { role: 'assistant', content: result.answer }
      this.plugin.chatHistory.push(assistantMsg)
      this.renderMessage(assistantMsg)
    } catch (err: any) {
      loadingEl.remove()
      console.error('[Wikey] query error:', err)
      let fullError: string
      if (err == null) fullError = '[Wikey] Unknown error'
      else if (err instanceof Error) fullError = `${err.name}: ${err.message}\n${err.stack ?? ''}`
      else if (typeof err === 'object') fullError = JSON.stringify(err, null, 2)
      else fullError = String(err)
      if (!fullError?.trim()) fullError = '[Wikey] Empty error — Cmd+Option+I 콘솔 확인'
      const errorMsg: ChatMessage = { role: 'error', content: fullError }
      this.plugin.chatHistory.push(errorMsg)
      this.renderMessage(errorMsg)
    } finally {
      this.setInputEnabled(true)
      this.scrollToBottom()
      this.inputEl.focus()
    }
  }

  // ── Message Rendering ──

  private renderMessage(msg: ChatMessage) {
    if (msg.role === 'error') {
      const el = this.messagesEl.createDiv({ cls: 'wikey-chat-error' })
      el.createEl('pre', { cls: 'wikey-chat-error-detail', text: msg.content })
      this.scrollToBottom()
      return
    }

    const msgEl = this.messagesEl.createDiv({
      cls: `wikey-chat-message wikey-chat-${msg.role}`,
    })

    if (msg.role === 'user') {
      msgEl.createEl('div', { cls: 'wikey-chat-content', text: msg.content })
    } else {
      const contentEl = msgEl.createDiv({ cls: 'wikey-chat-content' })
      this.renderMarkdown(msg.content, contentEl)
      this.addMessageActions(msgEl, msg.content)
    }

    this.scrollToBottom()
  }

  private addMessageActions(msgEl: HTMLElement, content: string) {
    const actions = msgEl.createDiv({ cls: 'wikey-msg-actions' })

    // Copy
    const copyBtn = this.makeActionBtn(actions, ICONS.clipboard, '복사')
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(content)
      new Notice('복사됨')
      copyBtn.addClass('wikey-msg-action-active')
      setTimeout(() => copyBtn.removeClass('wikey-msg-action-active'), 1500)
    })

    // Thumbs up
    const upBtn = this.makeActionBtn(actions, ICONS.thumbUp, '좋아요')
    upBtn.addEventListener('click', () => {
      this.saveFeedback(content, 'up')
      upBtn.addClass('wikey-msg-action-active')
      new Notice('피드백 저장됨')
    })

    // Thumbs down
    const downBtn = this.makeActionBtn(actions, ICONS.thumbDown, '나빠요')
    downBtn.addEventListener('click', () => {
      this.saveFeedback(content, 'down')
      downBtn.addClass('wikey-msg-action-active')
      new Notice('피드백 저장됨')
    })
  }

  private makeActionBtn(parent: HTMLElement, icon: string, label: string): HTMLElement {
    const btn = parent.createEl('button', { cls: 'wikey-msg-action-btn', attr: { 'aria-label': label, title: label } })
    btn.innerHTML = icon
    return btn
  }

  private saveFeedback(answer: string, vote: 'up' | 'down') {
    const lastQuestion = [...this.plugin.chatHistory].reverse().find((m) => m.role === 'user')
    const entry = {
      question: lastQuestion?.content ?? '',
      answer: answer.slice(0, 200),
      vote,
      timestamp: new Date().toISOString(),
    }
    if (!this.plugin.settings.feedback) (this.plugin.settings as any).feedback = []
    ;(this.plugin.settings as any).feedback.push(entry)
    this.plugin.saveSettings()
  }

  // ── Help ──

  private helpPanel: HTMLElement | null = null

  private openHelp() {
    this.helpPanel = createDiv({ cls: 'wikey-chat-help' })
    this.messagesEl.parentElement?.insertBefore(this.helpPanel, this.messagesEl)
    const helpEl = this.helpPanel
    const helpMd = `## Wikey 사용 가이드

**질문하기**
위키에 대해 자연어로 질문하세요.
예: "DJI O3의 주요 스펙은?", "RAG와 LLM Wiki 비교"

**인제스트** (소스 → 위키 변환)
- \`Cmd+Shift+I\`: 현재 노트 인제스트
- 상단 \`[+]\` 버튼: 파일 선택 또는 드래그&드롭
- \`raw/inbox/\`에 파일 추가 → 자동 감지

**위키링크**
답변의 [[페이지명]]을 클릭하면 해당 위키 페이지로 이동해요.

**설정**
\`Cmd+,\` → Wikey 탭에서 모델, API 키, Ollama 연결을 관리해요.`

    MarkdownRenderer.render(this.app, helpMd, helpEl, '', this.plugin)
  }

  // ── Dashboard ──

  private dashboardPanel: HTMLElement | null = null

  private openDashboard() {
    this.dashboardPanel = createDiv({ cls: 'wikey-dashboard' })
    this.messagesEl.parentElement?.insertBefore(this.dashboardPanel, this.messagesEl)
    this.renderDashboardContent(this.dashboardPanel)
  }

  private renderDashboardContent(el: HTMLElement) {
    const vault = this.app.vault

    // ── wiki/ 현황 ──
    const wikiSection = el.createDiv({ cls: 'wikey-dashboard-section' })
    wikiSection.createEl('h3', { text: 'Wiki 현황' })

    const categories: Record<string, number> = { entities: 0, concepts: 0, sources: 0, analyses: 0 }
    for (const cat of Object.keys(categories)) {
      const folder = vault.getAbstractFileByPath(`wiki/${cat}`)
      if (folder && (folder as any).children) {
        categories[cat] = (folder as any).children.filter((c: any) => c.extension === 'md').length
      }
    }

    const metaFolder = vault.getAbstractFileByPath('wiki')
    let metaCount = 0
    if (metaFolder && (metaFolder as any).children) {
      metaCount = (metaFolder as any).children.filter((c: any) => c.extension === 'md').length
    }

    const totalWiki = Object.values(categories).reduce((a, b) => a + b, 0) + metaCount

    const wikiGrid = wikiSection.createDiv({ cls: 'wikey-dashboard-grid' })
    this.addStatCard(wikiGrid, String(totalWiki), '총 페이지')
    this.addStatCard(wikiGrid, String(categories.entities), 'Entities')
    this.addStatCard(wikiGrid, String(categories.concepts), 'Concepts')
    this.addStatCard(wikiGrid, String(categories.sources), 'Sources')
    this.addStatCard(wikiGrid, String(categories.analyses), 'Analyses')
    this.addStatCard(wikiGrid, String(metaCount), 'Meta')

    // ── raw/ 현황 ──
    const rawSection = el.createDiv({ cls: 'wikey-dashboard-section' })
    rawSection.createEl('h3', { text: 'Raw 소스 현황' })

    const rawStats = this.collectRawStats()
    const rawGrid = rawSection.createDiv({ cls: 'wikey-dashboard-grid' })
    this.addStatCard(rawGrid, String(rawStats.total), '총 파일')
    this.addStatCard(rawGrid, String(rawStats.inbox), 'Inbox 대기')
    this.addStatCard(rawGrid, String(rawStats.projects), 'Projects')
    this.addStatCard(rawGrid, String(rawStats.areas), 'Areas')
    this.addStatCard(rawGrid, String(rawStats.resources), 'Resources')
    this.addStatCard(rawGrid, String(rawStats.archive), 'Archive')

    // ── 태그 랭킹 Top-10 ──
    const tagSection = el.createDiv({ cls: 'wikey-dashboard-section' })
    tagSection.createEl('h3', { text: '태그 랭킹 Top-10' })

    const tagRanking = this.collectTagRanking()
    if (tagRanking.length === 0) {
      tagSection.createEl('span', { text: '태그 데이터 없음', cls: 'wikey-dashboard-empty' })
    } else {
      const tagList = tagSection.createDiv({ cls: 'wikey-dashboard-tag-list' })
      for (const { tag, count } of tagRanking.slice(0, 10)) {
        const row = tagList.createDiv({ cls: 'wikey-dashboard-tag-row' })
        row.createEl('span', { text: `#${tag}`, cls: 'wikey-dashboard-tag-name' })
        const barOuter = row.createDiv({ cls: 'wikey-dashboard-tag-bar' })
        const maxCount = tagRanking[0].count
        const pct = Math.round((count / maxCount) * 100)
        const barInner = barOuter.createDiv({ cls: 'wikey-dashboard-tag-fill' })
        barInner.style.width = `${pct}%`
        row.createEl('span', { text: String(count), cls: 'wikey-dashboard-tag-count' })
      }
    }

    // ── 최근 질문 ──
    const querySection = el.createDiv({ cls: 'wikey-dashboard-section' })
    querySection.createEl('h3', { text: '최근 질문' })

    const recentQueries = this.plugin.chatHistory
      .filter((m) => m.role === 'user')
      .slice(-5)
      .reverse()

    if (recentQueries.length === 0) {
      querySection.createEl('span', { text: '질문 기록 없음', cls: 'wikey-dashboard-empty' })
    } else {
      for (const q of recentQueries) {
        const qEl = querySection.createDiv({ cls: 'wikey-dashboard-query' })
        qEl.setText(q.content.length > 60 ? q.content.slice(0, 60) + '...' : q.content)
        qEl.addEventListener('click', () => {
          this.inputEl.value = q.content
          this.inputEl.focus()
        })
      }
    }

    // ── 미인제스트 통계 (요약만) ──
    const auditSummarySection = el.createDiv({ cls: 'wikey-dashboard-section' })
    auditSummarySection.createEl('h3', { text: '미인제스트 문서' })
    this.renderAuditSummaryOnly(auditSummarySection)

    // ── Graph View 열기 ──
    const graphSection = el.createDiv({ cls: 'wikey-dashboard-section' })
    const graphBtn = graphSection.createEl('button', { cls: 'wikey-dashboard-graph-btn', text: 'Graph View 열기' })
    graphBtn.addEventListener('click', () => {
      (this.app as any).commands?.executeCommandById?.('graph:open')
    })
  }

  private renderAuditSummaryOnly(container: HTMLElement) {
    const { execFileSync } = require('node:child_process') as typeof import('node:child_process')
    const { join } = require('node:path') as typeof import('node:path')
    const basePath = (this.app.vault.adapter as any).basePath ?? ''
    const env = this.plugin.getExecEnv()

    try {
      const script = join(basePath, 'scripts/audit-ingest.py')
      const stdout = execFileSync('python3', [script, '--json'], {
        cwd: basePath, timeout: 10000, env, encoding: 'utf-8',
      })
      const data = JSON.parse(stdout)
      const grid = container.createDiv({ cls: 'wikey-dashboard-grid' })
      this.addStatCard(grid, String(data.total_documents), '문서 총')
      this.addStatCard(grid, String(data.ingested), '인제스트됨')
      this.addStatCard(grid, String(data.missing), '미인제스트')

      if (data.missing > 0) {
        const hint = container.createDiv({ cls: 'wikey-dashboard-empty' })
        hint.setText(`${data.missing}개 미처리 — ☑ 아이콘으로 관리`)
      }
    } catch {
      container.createEl('span', { text: 'audit 실행 실패', cls: 'wikey-dashboard-empty' })
    }
  }

  private openAuditPanel() {
    this.auditPanel = createDiv({ cls: 'wikey-audit-panel' })
    this.messagesEl.parentElement?.insertBefore(this.auditPanel, this.messagesEl)
    this.messagesEl.style.display = 'none'
    this.renderAuditSection(this.auditPanel)
  }

  private auditSelections: Set<string> = new Set()

  private renderAuditSection(container: HTMLElement) {
    const { execFileSync } = require('node:child_process') as typeof import('node:child_process')
    const { join } = require('node:path') as typeof import('node:path')
    const basePath = (this.app.vault.adapter as any).basePath ?? ''
    const env = this.plugin.getExecEnv()

    let auditData: { total_documents: number; ingested: number; missing: number; files: string[] }
    try {
      const script = join(basePath, 'scripts/audit-ingest.py')
      const stdout = execFileSync('python3', [script, '--json'], {
        cwd: basePath, timeout: 10000, env, encoding: 'utf-8',
      })
      auditData = JSON.parse(stdout)
    } catch {
      container.createEl('span', { text: 'audit 스크립트 실행 실패', cls: 'wikey-dashboard-empty' })
      return
    }

    // 요약 (동적 갱신)
    const summaryRow = container.createDiv({ cls: 'wikey-audit-summary-row' })
    const statTotal = summaryRow.createEl('span', { cls: 'wikey-audit-stat' })
    const statIngested = summaryRow.createEl('span', { cls: 'wikey-audit-stat wikey-audit-stat-ok' })
    const statMissing = summaryRow.createEl('span', { cls: 'wikey-audit-stat wikey-audit-stat-warn' })

    const updateSummaryStats = () => {
      statTotal.setText(`총 ${auditData.total_documents}`)
      statIngested.setText(`인제스트 ${auditData.ingested}`)
      statMissing.setText(`미처리 ${auditData.missing}`)
    }
    updateSummaryStats()

    if (auditData.missing === 0) {
      container.createEl('span', { text: '모든 문서가 인제스트되어 있습니다.', cls: 'wikey-dashboard-empty' })
      return
    }

    this.auditSelections = new Set()

    // ── 폴더 필터 ──
    const filterRow = container.createDiv({ cls: 'wikey-audit-filter' })
    filterRow.createEl('span', { text: '폴더', cls: 'wikey-audit-filter-label' })
    const folderSelect = filterRow.createEl('select', { cls: 'wikey-select' })

    const rebuildFolderOptions = () => {
      const currentVal = folderSelect.value
      folderSelect.empty()
      folderSelect.createEl('option', { text: `전체 (${auditData.files.length})`, attr: { value: '' } })
      for (const { folder, count } of this.extractFolders(auditData.files)) {
        folderSelect.createEl('option', { text: `${folder} (${count})`, attr: { value: folder } })
      }
      folderSelect.value = currentVal
    }
    rebuildFolderOptions()

    // ── 전체선택 + 목록 (스크롤 영역) ──
    const listArea = container.createDiv({ cls: 'wikey-audit-list-area' })

    const selectAllRow = listArea.createDiv({ cls: 'wikey-audit-selectall' })
    const selectAllCb = selectAllRow.createEl('input', { attr: { type: 'checkbox' }, cls: 'wikey-audit-cb' })
    selectAllRow.createEl('span', { text: '전체 선택', cls: 'wikey-audit-selectall-label' })

    const listEl = listArea.createDiv({ cls: 'wikey-audit-list' })
    const rowMap = new Map<string, HTMLElement>()

    // ── 하단 고정 영역 ──
    const bottomBar = container.createDiv({ cls: 'wikey-audit-bottom' })
    const applyBar = bottomBar.createDiv({ cls: 'wikey-audit-apply-bar' })
    const applySummary = applyBar.createEl('span', { cls: 'wikey-audit-apply-summary' })
    const providerSelect = applyBar.createEl('select', { cls: 'wikey-select' })
    const providerOptions = [
      { value: 'ollama', text: 'ollama (로컬)' },
      { value: 'gemini', text: 'gemini' },
      { value: 'anthropic', text: 'anthropic' },
      { value: 'openai', text: 'openai' },
    ]
    const currentBasic = this.plugin.settings.basicModel || 'ollama'
    for (const opt of providerOptions) {
      const el = providerSelect.createEl('option', { text: opt.text, attr: { value: opt.value } })
      if (opt.value === currentBasic) el.selected = true
    }
    const applyBtn = applyBar.createEl('button', { text: '적용', cls: 'wikey-audit-apply-btn' })
    const delayBtn = applyBar.createEl('button', { text: '보류', cls: 'wikey-audit-delay-action-btn' })
    applyBtn.setAttr('disabled', 'true')
    delayBtn.setAttr('disabled', 'true')

    const getFiltered = (): string[] => {
      const f = folderSelect.value
      return f ? auditData.files.filter((p) => p.includes(f)) : auditData.files
    }

    const updateApply = () => {
      const count = this.auditSelections.size
      applySummary.setText(`${count}개 선택됨`)
      if (count === 0) {
        applyBtn.setAttr('disabled', 'true')
        delayBtn.setAttr('disabled', 'true')
      } else {
        applyBtn.removeAttribute('disabled')
        delayBtn.removeAttribute('disabled')
      }
    }

    const renderList = () => {
      listEl.empty()
      rowMap.clear()
      const filtered = getFiltered()

      const allChecked = filtered.length > 0 && filtered.every((f) => this.auditSelections.has(f))
      ;(selectAllCb as HTMLInputElement).checked = allChecked

      for (const filePath of filtered) {
        const name = filePath.split('/').pop() ?? filePath
        const parentDir = filePath.split('/').slice(-2, -1)[0] ?? ''
        const row = listEl.createDiv({ cls: 'wikey-audit-row' })
        rowMap.set(filePath, row)

        const cb = row.createEl('input', { attr: { type: 'checkbox' }, cls: 'wikey-audit-cb' })
        ;(cb as HTMLInputElement).checked = this.auditSelections.has(filePath)

        const info = row.createDiv({ cls: 'wikey-audit-info' })
        info.createEl('span', { text: name, cls: 'wikey-audit-name' })
        info.createEl('span', { text: parentDir, cls: 'wikey-audit-path' })

        const toggleCb = () => {
          if ((cb as HTMLInputElement).checked) this.auditSelections.add(filePath)
          else this.auditSelections.delete(filePath)
          updateApply()
          const all = getFiltered().every((f) => this.auditSelections.has(f))
          ;(selectAllCb as HTMLInputElement).checked = all
        }

        cb.addEventListener('change', toggleCb)

        // 행 클릭 시 체크박스 토글 (체크박스 자체 클릭은 제외)
        row.addEventListener('click', (e) => {
          if (e.target === cb) return
          ;(cb as HTMLInputElement).checked = !(cb as HTMLInputElement).checked
          toggleCb()
        })
      }
      updateApply()
    }

    selectAllCb.addEventListener('change', () => {
      const filtered = getFiltered()
      const checked = (selectAllCb as HTMLInputElement).checked
      for (const f of filtered) {
        if (checked) this.auditSelections.add(f)
        else this.auditSelections.delete(f)
      }
      renderList()
    })

    folderSelect.addEventListener('change', renderList)

    // ── 적용 (인제스트) ──
    applyBtn.addEventListener('click', async () => {
      const selected = [...this.auditSelections]
      if (selected.length === 0) return

      applyBtn.setAttr('disabled', 'true')
      delayBtn.setAttr('disabled', 'true')

      const selectedProvider = providerSelect.value
      const origModel = this.plugin.settings.basicModel
      this.plugin.settings.basicModel = selectedProvider
      this.plugin.llmClient = new (await import('wikey-core')).LLMClient(
        this.plugin.httpClient, this.plugin.buildConfig(),
      )

      let done = 0
      let failed = 0
      const succeeded: string[] = []

      for (const f of selected) {
        const row = rowMap.get(f)

        if (row) {
          row.removeClass('wikey-audit-row-done')
          row.addClass('wikey-audit-row-active')
          row.style.setProperty('--progress', '0%')
          row.scrollIntoView({ block: 'nearest' })
        }

        applySummary.setText(`${done + 1}/${selected.length} 처리 중...`)

        const stepWeights = [0, 5, 80, 90, 100]
        const result = await runIngest(this.plugin, f, (step, _total) => {
          if (row) {
            const pct = stepWeights[step] ?? Math.round((step / 4) * 100)
            row.style.setProperty('--progress', `${pct}%`)
          }
        })

        if (row) {
          row.removeClass('wikey-audit-row-active')
          row.addClass(result.success ? 'wikey-audit-row-done' : 'wikey-audit-row-fail')
          row.style.removeProperty('--progress')

          // 에러 시 에러 메시지 행에 표시
          if (!result.success && result.error) {
            const errEl = row.createDiv({ cls: 'wikey-audit-error' })
            errEl.setText(result.error.length > 80 ? result.error.slice(0, 80) + '...' : result.error)
          }
        }

        if (result.success) {
          succeeded.push(f)
          // 파일별 즉시 카운터 갱신
          auditData.ingested++
          auditData.files = auditData.files.filter((x) => x !== f)
          auditData.missing = auditData.files.length
          updateSummaryStats()
        } else {
          failed++
        }
        done++
      }

      this.plugin.settings.basicModel = origModel
      await this.plugin.saveSettings()

      const msg = failed > 0
        ? `성공 ${succeeded.length} / 실패 ${failed} (${selectedProvider})`
        : `${succeeded.length}개 완료 (${selectedProvider})`
      applySummary.setText(msg)
      new Notice(msg)

      this.auditSelections = new Set()
      rebuildFolderOptions()
      // 성공한 행은 제거, 실패한 행은 유지
      setTimeout(() => renderList(), 2000)
    })

    // ── 보류 (_delayed 이동) ──
    delayBtn.addEventListener('click', () => {
      const selected = [...this.auditSelections]
      if (selected.length === 0) return

      const { renameSync, mkdirSync, existsSync } = require('node:fs') as typeof import('node:fs')
      const delayedDir = join(basePath, 'raw/_delayed')
      if (!existsSync(delayedDir)) mkdirSync(delayedDir, { recursive: true })

      let moved = 0
      for (const f of selected) {
        const name = f.split('/').pop() ?? f
        try { renameSync(join(basePath, f), join(delayedDir, name)); moved++ } catch { /* skip */ }
      }

      new Notice(`${moved}개 → raw/_delayed/`)
      const processed = new Set(selected)
      auditData.files = auditData.files.filter((f) => !processed.has(f))
      auditData.total_documents -= moved
      auditData.missing = auditData.files.length
      this.auditSelections = new Set()
      updateSummaryStats()
      rebuildFolderOptions()
      renderList()
    })

    renderList()
  }

  private extractFolders(files: string[]): Array<{ folder: string; count: number }> {
    const counts: Record<string, number> = {}
    for (const f of files) {
      // raw/3_resources/30_manual/101_build_rccar/... → 101_build_rccar
      const parts = f.split('/')
      // 3단계 이상이면 PARA 카테고리 하위 폴더 사용
      const key = parts.length >= 4 ? parts.slice(0, 4).join('/') : parts.slice(0, 3).join('/')
      counts[key] = (counts[key] ?? 0) + 1
    }
    return Object.entries(counts)
      .map(([folder, count]) => ({ folder, count }))
      .sort((a, b) => b.count - a.count)
  }

  private addStatCard(parent: HTMLElement, value: string, label: string) {
    const card = parent.createDiv({ cls: 'wikey-dashboard-card' })
    card.createEl('div', { text: value, cls: 'wikey-dashboard-card-value' })
    card.createEl('div', { text: label, cls: 'wikey-dashboard-card-label' })
  }

  private collectRawStats(): { total: number; inbox: number; projects: number; areas: number; resources: number; archive: number } {
    const { readdirSync, existsSync } = require('node:fs') as typeof import('node:fs')
    const { join } = require('node:path') as typeof import('node:path')
    const basePath = (this.app.vault.adapter as any).basePath ?? ''

    // 최상위 항목만 카운트 (서브폴더 = 1개 문서 묶음으로 취급)
    const countTopLevel = (dir: string): number => {
      const full = join(basePath, dir)
      if (!existsSync(full)) return 0
      return readdirSync(full)
        .filter((f: string) => !f.startsWith('.') && !f.startsWith('_'))
        .length
    }

    const inbox = countTopLevel('raw/0_inbox')
    const projects = countTopLevel('raw/1_projects')
    const areas = countTopLevel('raw/2_areas')
    const resources = countTopLevel('raw/3_resources')
    const archive = countTopLevel('raw/4_archive')

    return {
      total: inbox + projects + areas + resources + archive,
      inbox, projects, areas, resources, archive,
    }
  }

  private collectTagRanking(): Array<{ tag: string; count: number }> {
    const vault = this.app.vault
    const tagCounts: Record<string, number> = {}

    const wikiFiles = vault.getMarkdownFiles().filter((f) => f.path.startsWith('wiki/'))
    for (const file of wikiFiles) {
      const cache = this.app.metadataCache.getFileCache(file)
      const fm = cache?.frontmatter
      if (!fm?.tags) continue
      const tags: string[] = Array.isArray(fm.tags) ? fm.tags : [fm.tags]
      for (const t of tags) {
        const tag = String(t).trim()
        if (tag) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1
      }
    }

    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
  }

  // ── Ingest Panel ──

  private pendingFiles: File[] = []

  private openIngestPanel() {
    this.ingestPanel = createDiv({ cls: 'wikey-ingest-panel' })
    this.messagesEl.parentElement?.insertBefore(this.ingestPanel, this.messagesEl)

    // ── Action buttons (top) ──
    const actionsBar = this.ingestPanel.createDiv({ cls: 'wikey-ingest-actions' })

    const addBtn = actionsBar.createEl('button', { cls: 'wikey-ingest-action-btn', text: 'Add to inbox' })
    addBtn.addEventListener('click', () => this.addPendingToInbox())

    const ingestBtn = actionsBar.createEl('button', { cls: 'wikey-ingest-action-btn', text: 'Ingest inbox' })
    ingestBtn.addEventListener('click', () => this.ingestInbox())

    const addIngestBtn = actionsBar.createEl('button', { cls: 'wikey-ingest-action-btn wikey-ingest-action-primary', text: 'Add + Ingest' })
    addIngestBtn.addEventListener('click', async () => {
      await this.addPendingToInbox()
      await this.ingestInbox()
    })

    // ── Drop zone ──
    const dropZone = this.ingestPanel.createDiv({ cls: 'wikey-ingest-dropzone' })
    dropZone.createEl('span', { text: '파일을 여기에 드래그하세요', cls: 'wikey-ingest-drop-label' })

    // Hidden native file input
    const fileInput = dropZone.createEl('input', {
      attr: { type: 'file', multiple: 'true', accept: '.md,.txt,.pdf' },
      cls: 'wikey-ingest-file-input',
    })
    const browseBtn = dropZone.createEl('button', { cls: 'wikey-ingest-browse-btn', text: '파일 탐색기' })
    browseBtn.addEventListener('click', () => fileInput.click())
    fileInput.addEventListener('change', () => {
      if (fileInput.files) this.onFilesSelected(fileInput.files)
    })

    // Drag/drop
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.addClass('wikey-ingest-dragover') })
    dropZone.addEventListener('dragleave', () => dropZone.removeClass('wikey-ingest-dragover'))
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault()
      dropZone.removeClass('wikey-ingest-dragover')
      if (e.dataTransfer?.files) this.onFilesSelected(e.dataTransfer.files)
    })

    // ── Pending files list ──
    this.ingestPanel.createDiv({ cls: 'wikey-ingest-pending' })

    // ── Inbox status ──
    this.renderInboxStatus()

    // ── Progress area ──
    this.ingestPanel.createDiv({ cls: 'wikey-ingest-progress' })
  }

  private onFilesSelected(fileList: FileList) {
    for (let i = 0; i < fileList.length; i++) {
      const f = fileList[i]
      if (!this.pendingFiles.some((p) => p.name === f.name)) {
        this.pendingFiles.push(f)
      }
    }
    this.renderPendingFiles()
  }

  private renderPendingFiles() {
    const container = this.ingestPanel?.querySelector('.wikey-ingest-pending')
    if (!container) return
    container.empty()

    if (this.pendingFiles.length === 0) return

    const el = container as HTMLElement
    el.createEl('div', { text: `선택된 파일 (${this.pendingFiles.length})`, cls: 'wikey-ingest-section-label' })
    for (const f of this.pendingFiles) {
      const row = el.createDiv({ cls: 'wikey-ingest-file-row' })
      row.createEl('span', { text: f.name, cls: 'wikey-ingest-file-name' })
      const sizeKb = (f.size / 1024).toFixed(1)
      row.createEl('span', { text: `${sizeKb} KB`, cls: 'wikey-ingest-file-size' })
    }
  }

  private async addPendingToInbox() {
    if (this.pendingFiles.length === 0) {
      new Notice('추가할 파일을 선택하세요')
      return
    }

    const progressEl = this.ingestPanel?.querySelector('.wikey-ingest-progress') as HTMLElement
    if (progressEl) progressEl.setText('inbox에 복사 중...')

    const basePath = (this.app.vault.adapter as any).basePath ?? ''
    const { join } = require('node:path') as typeof import('node:path')
    const { writeFileSync, mkdirSync, existsSync } = require('node:fs') as typeof import('node:fs')

    const inboxDir = join(basePath, 'raw/0_inbox')
    if (!existsSync(inboxDir)) mkdirSync(inboxDir, { recursive: true })

    let count = 0
    for (const f of this.pendingFiles) {
      try {
        const buffer = await f.arrayBuffer()
        writeFileSync(join(inboxDir, f.name), Buffer.from(buffer))
        count++
      } catch (err: any) {
        console.error('[Wikey] file copy failed:', f.name, err)
      }
    }

    this.pendingFiles = []
    this.renderPendingFiles()
    this.renderInboxStatus()
    if (progressEl) progressEl.setText(`${count}개 파일 inbox에 추가됨`)
    new Notice(`${count}개 파일이 inbox에 추가됨`)
  }

  private getInboxPath(): string {
    const basePath = (this.app.vault.adapter as any).basePath ?? ''
    const { join } = require('node:path') as typeof import('node:path')
    return join(basePath, 'raw/0_inbox')
  }

  private listInboxFiles(): string[] {
    const { readdirSync, existsSync } = require('node:fs') as typeof import('node:fs')
    const inboxDir = this.getInboxPath()
    if (!existsSync(inboxDir)) return []
    return readdirSync(inboxDir)
      .filter((f: string) => !f.startsWith('.'))
      .sort()
  }

  private async ingestInbox() {
    const progressContainer = this.ingestPanel?.querySelector('.wikey-ingest-progress') as HTMLElement
    if (!progressContainer) return

    const files = this.listInboxFiles()
    if (files.length === 0) {
      new Notice('inbox에 인제스트할 파일이 없습니다')
      return
    }

    // 파일별 프로그레스 UI 생성
    progressContainer.empty()
    progressContainer.createEl('div', { text: `인제스트 (${files.length}개 파일)`, cls: 'wikey-ingest-section-label' })

    const fileRows: Array<{ label: HTMLElement; bar: HTMLElement; status: HTMLElement }> = []
    for (const name of files) {
      const row = progressContainer.createDiv({ cls: 'wikey-ingest-file-progress' })
      const label = row.createEl('div', { text: name, cls: 'wikey-ingest-fp-name' })
      const barOuter = row.createDiv({ cls: 'wikey-ingest-progress-bar' })
      const barInner = barOuter.createDiv({ cls: 'wikey-ingest-progress-fill' })
      const status = row.createEl('div', { cls: 'wikey-ingest-fp-status', text: '대기' })
      fileRows.push({ label, bar: barInner, status })
    }

    // 순차 실행
    const results: IngestRunResult[] = []
    for (let i = 0; i < files.length; i++) {
      const name = files[i]
      const row = fileRows[i]
      row.status.setText('처리 중...')
      row.status.addClass('wikey-ingest-fp-active')

      const result = await runIngest(this.plugin, `raw/0_inbox/${name}`, (step, total) => {
        const pct = ((step / total) * 100).toFixed(0)
        row.bar.style.width = `${pct}%`
      })

      row.bar.style.width = '100%'
      row.status.removeClass('wikey-ingest-fp-active')

      if (result.success) {
        row.status.setText(`${result.createdPages.length}개 페이지`)
        row.status.addClass('wikey-ingest-fp-done')
        // 결과 링크 추가
        const linksEl = row.label.parentElement!.createDiv({ cls: 'wikey-ingest-fp-links' })
        for (const page of result.createdPages) {
          const link = linksEl.createEl('a', {
            text: `[[${page.replace('.md', '')}]]`,
            cls: 'wikey-wikilink',
            attr: { 'data-href': page.replace('.md', '') },
          })
          link.addEventListener('click', (e) => {
            e.preventDefault()
            const href = link.getAttribute('data-href')
            if (href) this.app.workspace.openLinkText(href, '')
          })
        }
      } else {
        row.status.setText('실패')
        row.status.addClass('wikey-ingest-fp-fail')
      }

      results.push(result)
    }

    this.renderInboxStatus()
  }

  private renderInboxStatus() {
    const existing = this.ingestPanel?.querySelector('.wikey-ingest-inbox')
    if (existing) existing.remove()

    const container = this.ingestPanel
    if (!container) return

    const progressEl = container.querySelector('.wikey-ingest-progress')
    const inboxDiv = createDiv({ cls: 'wikey-ingest-inbox' })
    if (progressEl) container.insertBefore(inboxDiv, progressEl)
    else container.appendChild(inboxDiv)

    const files = this.listInboxFiles()

    inboxDiv.createEl('div', {
      text: `inbox (${files.length}개)`,
      cls: 'wikey-ingest-section-label',
    })

    if (files.length === 0) {
      inboxDiv.createEl('span', { text: '비어있음', cls: 'wikey-ingest-inbox-empty' })
      return
    }

    const basePath = (this.app.vault.adapter as any).basePath ?? ''
    const paraFolders = [
      { value: '', label: '분류...' },
      { value: 'raw/1_projects', label: 'Projects' },
      { value: 'raw/2_areas', label: 'Areas' },
      { value: 'raw/3_resources', label: 'Resources' },
      { value: 'raw/4_archive', label: 'Archive' },
    ]

    for (const f of files.slice(0, 10)) {
      const { existsSync, statSync } = require('node:fs') as typeof import('node:fs')
      const { join } = require('node:path') as typeof import('node:path')
      const fullPath = join(basePath, 'raw/0_inbox', f)
      const isDir = existsSync(fullPath) && statSync(fullPath).isDirectory()
      const hint = classifyFile(f, isDir)

      const row = inboxDiv.createDiv({ cls: 'wikey-classify-row' })
      const info = row.createDiv({ cls: 'wikey-classify-info' })
      info.createEl('span', { text: f, cls: 'wikey-classify-name' })
      info.createEl('span', { text: hint.hint, cls: 'wikey-classify-hint' })

      const select = row.createEl('select', { cls: 'wikey-select' })
      for (const opt of paraFolders) {
        const optEl = select.createEl('option', { text: opt.label, attr: { value: opt.value } })
        if (hint.destination && opt.value && hint.destination.startsWith(opt.value)) {
          optEl.selected = true
        }
      }

      const moveBtn = row.createEl('button', { text: '이동', cls: 'wikey-classify-move-btn' })
      moveBtn.addEventListener('click', () => {
        const dest = select.value
        if (!dest) { new Notice('분류 폴더를 선택하세요'); return }
        try {
          moveFile(basePath, `raw/0_inbox/${f}`, dest)
          new Notice(`${f} → ${dest}`)
          this.renderInboxStatus()
        } catch (err: any) {
          new Notice(`이동 실패: ${err?.message ?? err}`)
        }
      })
    }
    if (files.length > 10) {
      inboxDiv.createEl('div', { text: `... 외 ${files.length - 10}개`, cls: 'wikey-classify-row' })
    }
  }

  // ── Markdown ──

  private renderMarkdown(content: string, el: HTMLElement) {
    MarkdownRenderer.render(this.app, content, el, '', this.plugin)

    el.querySelectorAll('a.internal-link').forEach((link) => {
      link.addEventListener('click', (e: Event) => {
        e.preventDefault()
        const href = (link as HTMLAnchorElement).getAttribute('data-href')
        if (href) this.app.workspace.openLinkText(href, '')
      })
    })

    el.querySelectorAll('p, li, td').forEach((node) => {
      const html = node.innerHTML
      const replaced = html.replace(
        /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
        (_, target, display) =>
          `<a class="internal-link wikey-wikilink" data-href="${target}">${display || target}</a>`,
      )
      if (replaced !== html) {
        node.innerHTML = replaced
        node.querySelectorAll('.wikey-wikilink').forEach((link) => {
          link.addEventListener('click', (e: Event) => {
            e.preventDefault()
            const href = (link as HTMLAnchorElement).getAttribute('data-href')
            if (href) this.app.workspace.openLinkText(href, '')
          })
        })
      }
    })
  }

  // ── Utils ──

  private setInputEnabled(enabled: boolean) {
    this.inputEl.disabled = !enabled
    this.sendBtn.disabled = !enabled
  }

  private scrollToBottom() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight
  }

  private async loadModelList(provider: string, selectEl: HTMLSelectElement, currentModel: string) {
    const config = this.plugin.buildConfig()
    const models = await fetchModelList(provider as any, config, this.plugin.httpClient)

    if (models.length === 0) return

    selectEl.empty()
    for (const m of models) {
      const opt = selectEl.createEl('option', { text: m, attr: { value: m } })
      if (m === currentModel) opt.selected = true
    }

    // 현재 모델이 목록에 없으면 첫 번째 선택
    if (!models.includes(currentModel) && models.length > 0) {
      selectEl.value = models[0]
    }
  }
}
