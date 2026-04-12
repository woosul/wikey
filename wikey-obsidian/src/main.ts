import { Plugin, WorkspaceLeaf, requestUrl } from 'obsidian'
import type { HttpClient, HttpRequestOptions, HttpResponse, WikiFS, WikeyConfig } from 'wikey-core'
import { LLMClient, parseWikeyConf } from 'wikey-core'
import { WikeyChatView, WIKEY_CHAT_VIEW } from './sidebar-chat'
import { WikeySettingTab } from './settings-tab'
import { WikeyStatusBar } from './status-bar'
import { registerCommands } from './commands'

interface WikeySettings {
  basicModel: string
  geminiApiKey: string
  anthropicApiKey: string
  openaiApiKey: string
  ollamaUrl: string
  qmdPath: string
  costLimit: number
}

const DEFAULT_SETTINGS: WikeySettings = {
  basicModel: 'ollama',
  geminiApiKey: '',
  anthropicApiKey: '',
  openaiApiKey: '',
  ollamaUrl: 'http://localhost:11434',
  qmdPath: '',
  costLimit: 50,
}

export type { WikeySettings }

export default class WikeyPlugin extends Plugin {
  settings: WikeySettings = DEFAULT_SETTINGS
  wikiFS!: WikiFS
  httpClient!: HttpClient
  llmClient!: LLMClient
  chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
  private statusBar!: WikeyStatusBar

  async onload() {
    await this.loadSettings()

    this.wikiFS = new ObsidianWikiFS(this)
    this.httpClient = new ObsidianHttpClient()
    this.llmClient = new LLMClient(this.httpClient, this.buildConfig())

    this.registerView(WIKEY_CHAT_VIEW, (leaf) => new WikeyChatView(leaf, this))

    this.addRibbonIcon('search', 'Wikey', () => this.activateChatView())

    this.addSettingTab(new WikeySettingTab(this.app, this))

    this.statusBar = new WikeyStatusBar(this)
    this.statusBar.register()

    registerCommands(this)
  }

  onunload() {
    // cleanup handled by Obsidian
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
    this.llmClient = new LLMClient(this.httpClient, this.buildConfig())
  }

  buildConfig(): WikeyConfig {
    return {
      WIKEY_BASIC_MODEL: this.settings.basicModel,
      WIKEY_SEARCH_BACKEND: 'basic',
      WIKEY_MODEL: 'wikey',
      WIKEY_QMD_TOP_N: 5,
      GEMINI_API_KEY: this.settings.geminiApiKey,
      ANTHROPIC_API_KEY: this.settings.anthropicApiKey,
      OPENAI_API_KEY: this.settings.openaiApiKey,
      OLLAMA_URL: this.settings.ollamaUrl,
      INGEST_PROVIDER: '',
      LINT_PROVIDER: '',
      SUMMARIZE_PROVIDER: '',
      CONTEXTUAL_MODEL: 'gemma4',
      COST_LIMIT: this.settings.costLimit,
    }
  }

  async activateChatView() {
    const existing = this.app.workspace.getLeavesOfType(WIKEY_CHAT_VIEW)
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0])
      return
    }

    const leaf = this.app.workspace.getRightLeaf(false)
    if (leaf) {
      await leaf.setViewState({ type: WIKEY_CHAT_VIEW, active: true })
      this.app.workspace.revealLeaf(leaf)
    }
  }
}

class ObsidianWikiFS implements WikiFS {
  constructor(private readonly plugin: WikeyPlugin) {}

  async read(path: string): Promise<string> {
    const file = this.plugin.app.vault.getAbstractFileByPath(path)
    if (!file) throw new Error(`File not found: ${path}`)
    return this.plugin.app.vault.read(file as any)
  }

  async write(path: string, content: string): Promise<void> {
    const existing = this.plugin.app.vault.getAbstractFileByPath(path)
    if (existing) {
      await this.plugin.app.vault.modify(existing as any, content)
    } else {
      const dir = path.substring(0, path.lastIndexOf('/'))
      if (dir && !this.plugin.app.vault.getAbstractFileByPath(dir)) {
        await this.plugin.app.vault.createFolder(dir)
      }
      await this.plugin.app.vault.create(path, content)
    }
  }

  async exists(path: string): Promise<boolean> {
    return this.plugin.app.vault.getAbstractFileByPath(path) !== null
  }

  async list(dir: string): Promise<string[]> {
    const folder = this.plugin.app.vault.getAbstractFileByPath(dir)
    if (!folder) return []
    const children = (folder as any).children
    if (!Array.isArray(children)) return []
    return children.map((c: any) => c.path as string)
  }
}

class ObsidianHttpClient implements HttpClient {
  async request(url: string, opts: HttpRequestOptions): Promise<HttpResponse> {
    // localhost/Ollama → Node.js http 직접 호출 (Obsidian requestUrl CORS 우회)
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      return this.requestViaNode(url, opts)
    }

    // 외부 API (Gemini, Anthropic, OpenAI) → Obsidian requestUrl
    const response = await requestUrl({
      url,
      method: opts.method,
      headers: opts.headers as Record<string, string>,
      body: opts.body,
    })
    return {
      status: response.status,
      body: typeof response.text === 'string' ? response.text : JSON.stringify(response.json),
    }
  }

  private requestViaNode(url: string, opts: HttpRequestOptions): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
      const http = require('node:http') as typeof import('node:http')
      const parsed = new URL(url)
      const req = http.request({
        hostname: parsed.hostname,
        port: parsed.port || 80,
        path: parsed.pathname + parsed.search,
        method: opts.method,
        headers: opts.headers as Record<string, string>,
      }, (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8')
          resolve({ status: res.statusCode ?? 0, body })
        })
      })
      req.on('error', reject)
      if (opts.body) req.write(opts.body)
      req.end()
    })
  }
}
