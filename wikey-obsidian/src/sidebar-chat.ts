import { ItemView, MarkdownRenderer, WorkspaceLeaf } from 'obsidian'
import type WikeyPlugin from './main'
import { query } from 'wikey-core'

export const WIKEY_CHAT_VIEW = 'wikey-chat'

interface ChatMessage {
  readonly role: 'user' | 'assistant' | 'error'
  readonly content: string
}

export class WikeyChatView extends ItemView {
  private messagesEl!: HTMLElement
  private inputEl!: HTMLTextAreaElement
  private sendBtn!: HTMLButtonElement
  private abortController: AbortController | null = null

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: WikeyPlugin,
  ) {
    super(leaf)
  }

  getViewType(): string {
    return WIKEY_CHAT_VIEW
  }

  getDisplayText(): string {
    return 'Wikey'
  }

  getIcon(): string {
    return 'search'
  }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement
    container.empty()
    container.addClass('wikey-chat-container')

    // Header
    const header = container.createDiv({ cls: 'wikey-chat-header' })
    header.createEl('span', { text: 'Wikey', cls: 'wikey-chat-title' })

    const headerActions = header.createDiv({ cls: 'wikey-chat-header-actions' })

    // Clear button
    const clearBtn = headerActions.createEl('button', {
      cls: 'wikey-header-btn',
      attr: { 'aria-label': '대화 초기화' },
    })
    clearBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/></svg>'
    clearBtn.addEventListener('click', () => this.clearChat())

    // Reload button
    const reloadBtn = headerActions.createEl('button', {
      cls: 'wikey-header-btn',
      attr: { 'aria-label': '플러그인 리로드' },
    })
    reloadBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/><path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/></svg>'
    reloadBtn.addEventListener('click', () => {
      (this.app as any).commands?.executeCommandById?.('app:reload')
    })

    // Close button
    const closeBtn = headerActions.createEl('button', {
      cls: 'wikey-header-btn',
      attr: { 'aria-label': '사이드바 닫기' },
    })
    closeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2.146 2.854a.5.5 0 1 1 .708-.708L8 7.293l5.146-5.147a.5.5 0 0 1 .708.708L8.707 8l5.147 5.146a.5.5 0 0 1-.708.708L8 8.707l-5.146 5.147a.5.5 0 0 1-.708-.708L7.293 8z"/></svg>'
    closeBtn.addEventListener('click', () => this.leaf.detach())

    // Messages area
    this.messagesEl = container.createDiv({ cls: 'wikey-chat-messages' })

    // Restore history
    for (const msg of this.plugin.chatHistory) {
      this.renderMessage(msg)
    }

    // Input area
    const inputArea = container.createDiv({ cls: 'wikey-chat-input-area' })

    this.inputEl = inputArea.createEl('textarea', {
      cls: 'wikey-chat-input',
      attr: { placeholder: '질문을 입력하세요...', rows: '2' },
    })

    this.sendBtn = inputArea.createEl('button', { cls: 'wikey-chat-send-btn' })
    this.sendBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M15.964.686a.5.5 0 0 0-.65-.65L.767 5.855H.766l-.452.18a.5.5 0 0 0-.082.887l.41.26.001.002 4.995 3.178 3.178 4.995.002.002.26.41a.5.5 0 0 0 .886-.083zm-1.833 1.89L6.637 10.07l-.215-.338a.5.5 0 0 0-.154-.154l-.338-.215 7.494-7.494 1.178-.471z"/></svg>'

    this.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this.handleSend()
      }
    })

    this.sendBtn.addEventListener('click', () => this.handleSend())

    if (this.plugin.chatHistory.length === 0) {
      this.showWelcome()
    }
  }

  async onClose() {
    this.abortController?.abort()
  }

  private clearChat() {
    this.plugin.chatHistory = []
    this.messagesEl.empty()
    this.showWelcome()
  }

  private showWelcome() {
    const welcome = this.messagesEl.createDiv({ cls: 'wikey-chat-welcome' })
    welcome.createEl('p', { text: '위키에 대해 질문해보세요.' })
    welcome.createEl('p', {
      text: '예: "ESC란?", "RAG와 LLM Wiki의 차이점"',
      cls: 'wikey-chat-welcome-hint',
    })
  }

  private async handleSend() {
    const question = this.inputEl.value.trim()
    if (!question) return

    // Clear welcome
    const welcome = this.messagesEl.querySelector('.wikey-chat-welcome')
    if (welcome) welcome.remove()

    // Show user message
    const userMsg: ChatMessage = { role: 'user', content: question }
    this.plugin.chatHistory.push(userMsg)
    this.renderMessage(userMsg)

    this.inputEl.value = ''
    this.setInputEnabled(false)

    // Show loading
    const loadingEl = this.messagesEl.createDiv({ cls: 'wikey-chat-loading' })
    loadingEl.createEl('span', { text: '답변을 생성하고 있습니다...' })
    this.scrollToBottom()

    // Abort previous if still running
    this.abortController?.abort()
    this.abortController = new AbortController()

    try {
      const config = this.plugin.buildConfig()
      const basePath = (this.app.vault.adapter as any).basePath ?? ''
      const result = await query(question, config, this.plugin.httpClient, {
        basePath,
        wikiFS: this.plugin.wikiFS,
      })

      loadingEl.remove()

      const assistantMsg: ChatMessage = { role: 'assistant', content: result.answer }
      this.plugin.chatHistory.push(assistantMsg)
      this.renderMessage(assistantMsg)
    } catch (err: any) {
      loadingEl.remove()
      console.error('[Wikey] query error:', err)

      // Show FULL error in UI for debugging
      const fullError = err?.stack ?? err?.message ?? String(err)
      const errorMsg: ChatMessage = { role: 'error', content: fullError }
      this.plugin.chatHistory.push(errorMsg)
      this.renderMessage(errorMsg)
    } finally {
      this.setInputEnabled(true)
      this.scrollToBottom()
      this.inputEl.focus()
    }
  }

  private renderMessage(msg: ChatMessage) {
    if (msg.role === 'error') {
      const errorEl = this.messagesEl.createDiv({ cls: 'wikey-chat-error' })
      const pre = errorEl.createEl('pre', { cls: 'wikey-chat-error-detail' })
      pre.textContent = msg.content
      this.scrollToBottom()
      return
    }

    const msgEl = this.messagesEl.createDiv({
      cls: `wikey-chat-message wikey-chat-${msg.role}`,
    })

    if (msg.role === 'user') {
      msgEl.createEl('div', { cls: 'wikey-chat-label', text: 'Q' })
      msgEl.createEl('div', { cls: 'wikey-chat-content', text: msg.content })
    } else {
      msgEl.createEl('div', { cls: 'wikey-chat-label', text: 'A' })
      const contentEl = msgEl.createDiv({ cls: 'wikey-chat-content' })
      this.renderMarkdown(msg.content, contentEl)
    }

    this.scrollToBottom()
  }

  private renderMarkdown(content: string, el: HTMLElement) {
    MarkdownRenderer.render(this.app, content, el, '', this.plugin)

    // Make wikilinks clickable
    el.querySelectorAll('a.internal-link').forEach((link) => {
      link.addEventListener('click', (e: Event) => {
        e.preventDefault()
        const href = (link as HTMLAnchorElement).getAttribute('data-href')
        if (href) {
          this.app.workspace.openLinkText(href, '')
        }
      })
    })

    // Also handle [[wikilink]] in plain text
    el.querySelectorAll('p, li, td').forEach((node) => {
      const html = node.innerHTML
      const replaced = html.replace(
        /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
        (_match, target, display) => {
          const text = display || target
          return `<a class="internal-link wikey-wikilink" data-href="${target}">${text}</a>`
        },
      )
      if (replaced !== html) {
        node.innerHTML = replaced
        node.querySelectorAll('.wikey-wikilink').forEach((link) => {
          link.addEventListener('click', (e: Event) => {
            e.preventDefault()
            const href = (link as HTMLAnchorElement).getAttribute('data-href')
            if (href) {
              this.app.workspace.openLinkText(href, '')
            }
          })
        })
      }
    })
  }

  private setInputEnabled(enabled: boolean) {
    this.inputEl.disabled = !enabled
    this.sendBtn.disabled = !enabled
  }

  private scrollToBottom() {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight
  }
}
