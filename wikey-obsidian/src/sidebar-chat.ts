import { ItemView, MarkdownRenderer, Notice, WorkspaceLeaf } from 'obsidian'
import type WikeyPlugin from './main'
import { query, resolveProvider } from 'wikey-core'
import { runIngest, IngestFileSuggestModal } from './commands'

export const WIKEY_CHAT_VIEW = 'wikey-chat'

interface ChatMessage {
  readonly role: 'user' | 'assistant' | 'error'
  readonly content: string
}

// Bootstrap SVG icons (inline, 16x16)
const ICONS = {
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

export class WikeyChatView extends ItemView {
  private messagesEl!: HTMLElement
  private inputEl!: HTMLTextAreaElement
  private sendBtn!: HTMLButtonElement
  private ingestPanel: HTMLElement | null = null
  private helpVisible = false

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

    this.makeHeaderBtn(actions, ICONS.plus, '인제스트', () => this.toggleIngestPanel())
    this.makeHeaderBtn(actions, ICONS.question, '도움말', () => this.toggleHelp())
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

    // Model tag
    const modelTag = inputWrapper.createDiv({ cls: 'wikey-chat-model-tag' })
    const config = this.plugin.buildConfig()
    const { provider, model } = resolveProvider('default', config)
    modelTag.setText(`${provider}:${model}`)

    if (this.plugin.chatHistory.length === 0) this.showWelcome()
  }

  async onClose() { /* cleanup */ }

  // ── Header Helpers ──

  private makeHeaderBtn(parent: HTMLElement, icon: string, label: string, onClick: () => void) {
    const btn = parent.createEl('button', { cls: 'wikey-header-btn', attr: { 'aria-label': label, title: label } })
    btn.innerHTML = icon
    btn.addEventListener('click', onClick)
  }

  // ── Chat Actions ──

  private clearChat() {
    this.plugin.chatHistory = []
    this.messagesEl.empty()
    this.showWelcome()
  }

  private showWelcome() {
    const w = this.messagesEl.createDiv({ cls: 'wikey-chat-welcome' })
    w.createEl('p', { text: '위키에 대해 질문해보세요.' })
    w.createEl('p', { text: '예: "DJI O3의 주요 스펙은?", "RAG와 LLM Wiki 비교"', cls: 'wikey-chat-welcome-hint' })
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

  private toggleHelp() {
    this.helpVisible = !this.helpVisible
    const existing = this.messagesEl.querySelector('.wikey-chat-help')
    if (existing) { existing.remove(); return }

    const helpEl = this.messagesEl.createDiv({ cls: 'wikey-chat-help' })
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
    helpEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Ingest Panel ──

  private pendingFiles: File[] = []

  private toggleIngestPanel() {
    if (this.ingestPanel) {
      this.ingestPanel.remove()
      this.ingestPanel = null
      this.pendingFiles = []
      return
    }

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
    const progressEl = this.ingestPanel?.querySelector('.wikey-ingest-progress') as HTMLElement
    const files = this.listInboxFiles()

    if (files.length === 0) {
      new Notice('inbox에 인제스트할 파일이 없습니다')
      return
    }

    for (let i = 0; i < files.length; i++) {
      const name = files[i]
      if (progressEl) progressEl.setText(`인제스트 중 (${i + 1}/${files.length}): ${name}`)
      await runIngest(this.plugin, `raw/0_inbox/${name}`)
    }

    if (progressEl) progressEl.setText(`완료: ${files.length}개 파일 인제스트`)
    this.renderInboxStatus()
    new Notice(`${files.length}개 파일 인제스트 완료`)
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

    for (const f of files.slice(0, 10)) {
      inboxDiv.createEl('div', { text: `• ${f}`, cls: 'wikey-ingest-file-row' })
    }
    if (files.length > 10) {
      inboxDiv.createEl('div', { text: `... 외 ${files.length - 10}개`, cls: 'wikey-ingest-file-row' })
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
}
