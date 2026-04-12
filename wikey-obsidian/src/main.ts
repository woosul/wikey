import { Notice, Plugin, WorkspaceLeaf, requestUrl } from 'obsidian'
import type { HttpClient, HttpRequestOptions, HttpResponse, WikiFS, WikeyConfig } from 'wikey-core'
import { LLMClient } from 'wikey-core'
import { WikeyChatView, WIKEY_CHAT_VIEW } from './sidebar-chat'
import { WikeySettingTab } from './settings-tab'
import { WikeyStatusBar } from './status-bar'
import { registerCommands } from './commands'
import { detectEnvironment, buildExecEnv } from './env-detect'
import type { EnvStatus } from './env-detect'

interface WikeySettings {
  basicModel: string
  cloudModel: string
  geminiApiKey: string
  anthropicApiKey: string
  openaiApiKey: string
  ollamaUrl: string
  qmdPath: string
  costLimit: number
  advancedLLM: boolean
  ingestProvider: string
  lintProvider: string
  summarizeProvider: string
  // 자동 탐지된 환경 (수동 편집 불필요)
  detectedShellPath: string
  detectedNodePath: string
  detectedPythonPath: string
  feedback: Array<{ question: string; answer: string; vote: string; timestamp: string }>
}

const DEFAULT_SETTINGS: WikeySettings = {
  basicModel: 'ollama',
  cloudModel: '',
  geminiApiKey: '',
  anthropicApiKey: '',
  openaiApiKey: '',
  ollamaUrl: 'http://localhost:11434',
  qmdPath: '',
  costLimit: 50,
  advancedLLM: false,
  ingestProvider: '',
  lintProvider: '',
  summarizeProvider: '',
  detectedShellPath: '',
  detectedNodePath: '',
  detectedPythonPath: '',
  feedback: [],
}

export type { WikeySettings }

export default class WikeyPlugin extends Plugin {
  settings: WikeySettings = DEFAULT_SETTINGS
  wikiFS!: WikiFS
  httpClient!: HttpClient
  llmClient!: LLMClient
  envStatus: EnvStatus | null = null
  chatHistory: Array<{ role: 'user' | 'assistant' | 'error'; content: string }> = []
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

    // 환경 자동 탐지 (백그라운드)
    this.runEnvDetection()

    // raw/ 파일 감시 (시작 직후 vault 인덱싱 무시 + 배치 알림)
    const startTime = Date.now()
    const STARTUP_GRACE_MS = 10_000
    let bypassBatch: string[] = []
    let bypassTimer: ReturnType<typeof setTimeout> | null = null

    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (!file.path.startsWith('raw/')) return
        if (Date.now() - startTime < STARTUP_GRACE_MS) return

        const name = file.path.split('/').pop() ?? file.path
        const isDoc = /\.(md|txt|pdf)$/i.test(file.path)

        if (file.path.startsWith('raw/0_inbox/')) {
          if (isDoc) {
            new Notice(`inbox에 새 파일: ${name} — [+] 버튼으로 인제스트하세요.`)
          }
        } else if (isDoc && !file.path.includes('/_')) {
          bypassBatch.push(name)
          console.log('[Wikey] inbox 우회 감지:', file.path)
          if (bypassTimer) clearTimeout(bypassTimer)
          bypassTimer = setTimeout(() => {
            const count = bypassBatch.length
            if (count === 1) {
              new Notice(`⚠ ${bypassBatch[0]}이 inbox를 거치지 않고 추가됨.\n인제스트 없이는 검색되지 않습니다.`, 8000)
            } else {
              new Notice(`⚠ ${count}개 문서가 inbox를 거치지 않고 추가됨.\n👁 아이콘에서 확인하세요.`, 8000)
            }
            bypassBatch = []
          }, 2000)
        }
      }),
    )
  }

  onunload() {
    // cleanup handled by Obsidian
  }

  async runEnvDetection() {
    const basePath = (this.app.vault.adapter as any).basePath ?? ''
    console.log('[Wikey] 환경 탐지 시작...')
    this.envStatus = await detectEnvironment(basePath, this.settings.ollamaUrl)

    // 탐지 결과 저장
    this.settings.detectedShellPath = this.envStatus.shellPath
    this.settings.detectedNodePath = this.envStatus.nodePath
    this.settings.detectedPythonPath = this.envStatus.pythonPath
    if (!this.settings.qmdPath && this.envStatus.qmdPath) {
      this.settings.qmdPath = this.envStatus.qmdPath
    }
    await this.saveData(this.settings)

    console.log('[Wikey] 환경 탐지 완료:', {
      node: this.envStatus.nodePath,
      python: this.envStatus.pythonPath,
      qmd: this.envStatus.qmdPath,
      ollama: this.envStatus.ollamaRunning,
      models: this.envStatus.ollamaModels,
      issues: this.envStatus.issues,
    })

    if (this.envStatus.issues.length > 0) {
      new Notice(`Wikey: ${this.envStatus.issues[0]}`)
    }
  }

  getExecEnv(): Record<string, string> {
    return buildExecEnv(this.settings.detectedShellPath || process.env.PATH || '')
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
      WIKEY_MODEL: this.settings.cloudModel || 'wikey',
      WIKEY_QMD_TOP_N: 5,
      GEMINI_API_KEY: this.settings.geminiApiKey,
      ANTHROPIC_API_KEY: this.settings.anthropicApiKey,
      OPENAI_API_KEY: this.settings.openaiApiKey,
      OLLAMA_URL: this.settings.ollamaUrl,
      INGEST_PROVIDER: this.settings.advancedLLM ? this.settings.ingestProvider : '',
      LINT_PROVIDER: this.settings.advancedLLM ? this.settings.lintProvider : '',
      SUMMARIZE_PROVIDER: this.settings.advancedLLM ? this.settings.summarizeProvider : '',
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
    // localhost/Ollama → Node.js http 직접 호출
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      return this.requestViaNode(url, opts)
    }

    // 외부 API → Obsidian requestUrl
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
