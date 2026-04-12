import { ItemView, MarkdownRenderer, WorkspaceLeaf } from 'obsidian'
import type WikeyPlugin from './main'
import { query, resolveProvider } from 'wikey-core'

export const WIKEY_CHAT_VIEW = 'wikey-chat'

interface ChatMessage {
  readonly role: 'user' | 'assistant'
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

    this.sendBtn = inputArea.createEl('button', {
      cls: 'wikey-chat-send-btn',
      text: '↩',
    })

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
      const result = await query(question, config, this.plugin.httpClient)

      loadingEl.remove()

      const assistantMsg: ChatMessage = { role: 'assistant', content: result.answer }
      this.plugin.chatHistory.push(assistantMsg)
      this.renderMessage(assistantMsg)
    } catch (err: any) {
      loadingEl.remove()

      const errorMsg = this.getErrorMessage(err)
      const errorEl = this.messagesEl.createDiv({ cls: 'wikey-chat-error' })
      errorEl.createEl('span', { text: errorMsg })
    } finally {
      this.setInputEnabled(true)
      this.scrollToBottom()
      this.inputEl.focus()
    }
  }

  private renderMessage(msg: ChatMessage) {
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

    // Also handle [[wikilink]] in plain text that MarkdownRenderer might not convert
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

  private getErrorMessage(err: any): string {
    const msg = err?.message ?? String(err)
    if (msg.includes('API') && msg.includes('key')) {
      return '⚠️ API 키가 설정되지 않았습니다. 설정 탭에서 키를 입력하세요.'
    }
    if (msg.includes('qmd')) {
      return '⚠️ qmd를 찾을 수 없습니다. 설정에서 경로를 확인하세요.'
    }
    if (msg.includes('fetch') || msg.includes('network') || msg.includes('ECONNREFUSED')) {
      return '⚠️ 네트워크 오류. Ollama 서버가 실행 중인지 확인하세요.'
    }
    return `⚠️ 오류: ${msg}`
  }
}
