import { Notice, Plugin, WorkspaceLeaf, requestUrl } from 'obsidian'
import type { HttpClient, HttpRequestOptions, HttpResponse, WikiFS, WikeyConfig } from 'wikey-core'
import { LLMClient, parseWikeyConf, CONTEXTUAL_DEFAULT_MODEL } from 'wikey-core'
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
  ingestModel: string
  lintProvider: string
  summarizeProvider: string
  // OCR (markitdown-ocr fallback). 빈 값이면 basicModel로 resolve.
  ocrProvider: string
  ocrModel: string
  // 자동 인제스트 (inbox file watcher)
  autoIngest: boolean
  autoIngestInterval: 0 | 10 | 30 | 60  // 0 = immediately, others = seconds debounce
  // 자동 탐지된 환경 (수동 편집 불필요)
  detectedShellPath: string
  detectedNodePath: string
  detectedPythonPath: string
  feedback: Array<{ question: string; answer: string; vote: string; timestamp: string }>
  persistChatHistory: boolean
  savedChatHistory: ReadonlyArray<{ role: 'user' | 'assistant' | 'error'; content: string }>
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
  ingestModel: '',
  lintProvider: '',
  summarizeProvider: '',
  ocrProvider: '',
  ocrModel: '',
  autoIngest: false,
  autoIngestInterval: 30,
  detectedShellPath: '',
  detectedNodePath: '',
  detectedPythonPath: '',
  feedback: [],
  persistChatHistory: true,
  savedChatHistory: [],
}

export type { WikeySettings }

/**
 * Heuristic check: does `model` belong to `provider`'s model family?
 * Defensive guard against stale settings where model/provider mismatch.
 */
function isModelCompatible(model: string, provider: string): boolean {
  if (!model) return true
  const m = model.toLowerCase()
  switch (provider) {
    case 'gemini':
      return m.startsWith('gemini-') || m.startsWith('gemma-')
    case 'openai':
    case 'codex':
      return m.startsWith('gpt-') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')
    case 'anthropic':
    case 'claude-code':
      return m.startsWith('claude-')
    case 'ollama':
    case 'local':
      // Ollama hosts any non-cloud model (qwen, gemma4:*, llama, phi, etc.)
      return !m.startsWith('gemini-') && !m.startsWith('gemma-') && !m.startsWith('gpt-')
        && !m.startsWith('claude-') && !m.startsWith('o1') && !m.startsWith('o3') && !m.startsWith('o4')
    default:
      return true
  }
}

export default class WikeyPlugin extends Plugin {
  settings: WikeySettings = DEFAULT_SETTINGS
  wikiFS!: WikiFS
  httpClient!: HttpClient
  llmClient!: LLMClient
  envStatus: EnvStatus | null = null
  chatHistory: Array<{ role: 'user' | 'assistant' | 'error'; content: string }> = []
  private statusBar!: WikeyStatusBar
  private chatSaveTimer: ReturnType<typeof setTimeout> | null = null

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

    // 자동 인제스트 디바운스 큐 (설정 off면 미사용)
    const autoQueue: string[] = []
    let autoTimer: ReturnType<typeof setTimeout> | null = null

    const scheduleAutoIngest = () => {
      if (autoTimer) clearTimeout(autoTimer)
      const interval = this.settings.autoIngestInterval
      const delayMs = interval === 0 ? 0 : interval * 1000
      autoTimer = setTimeout(() => void this.flushAutoIngestQueue(autoQueue), delayMs)
    }

    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (!file.path.startsWith('raw/')) return
        if (Date.now() - startTime < STARTUP_GRACE_MS) return

        const name = file.path.split('/').pop() ?? file.path
        const isDoc = /\.(md|txt|pdf)$/i.test(file.path)

        if (file.path.startsWith('raw/0_inbox/')) {
          if (!isDoc) return
          if (this.settings.autoIngest) {
            const relPath = file.path
            if (!autoQueue.includes(relPath)) autoQueue.push(relPath)
            console.log('[Wikey] auto-ingest queued:', relPath, 'interval=', this.settings.autoIngestInterval)
            scheduleAutoIngest()
          } else {
            new Notice(`inbox에 새 파일: ${name} — [+] 버튼에서 인제스트하세요.`)
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

  async flushAutoIngestQueue(queue: string[]): Promise<void> {
    const { runIngest } = await import('./commands')
    const batch = queue.splice(0, queue.length)
    if (batch.length === 0) return
    console.info(`[Wikey] auto-ingest flushing ${batch.length} file(s)`)
    new Notice(`Auto-ingest: ${batch.length}개 파일 처리 시작`)
    let ok = 0
    let fail = 0
    for (const relPath of batch) {
      try {
        const result = await runIngest(this, relPath)
        if (result.success) ok++
        else fail++
      } catch (err: unknown) {
        console.error('[Wikey] auto-ingest error:', relPath, err)
        fail++
      }
    }
    new Notice(`Auto-ingest 완료: ${ok} 성공 / ${fail} 실패`)
  }

  onunload() {
    if (this.chatSaveTimer) {
      clearTimeout(this.chatSaveTimer)
      this.chatSaveTimer = null
    }
    if (this.settings.persistChatHistory) {
      const MAX = 100
      const trimmed = this.chatHistory.length > MAX ? this.chatHistory.slice(-MAX) : [...this.chatHistory]
      this.settings = { ...this.settings, savedChatHistory: trimmed }
      this.saveData(this.buildPluginOnlyData())
    }
  }

  async runEnvDetection() {
    const basePath = this.basePath
    console.log('[Wikey] 환경 탐지 시작...')
    this.envStatus = await detectEnvironment(basePath, this.settings.ollamaUrl)

    // 탐지 결과 저장
    this.settings = {
      ...this.settings,
      detectedShellPath: this.envStatus.shellPath,
      detectedNodePath: this.envStatus.nodePath,
      detectedPythonPath: this.envStatus.pythonPath,
      qmdPath: (!this.settings.qmdPath && this.envStatus.qmdPath) ? this.envStatus.qmdPath : this.settings.qmdPath,
    }
    await this.saveData(this.buildPluginOnlyData())

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
    // 1. data.json (플러그인 상태)
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())

    // 2. wikey.conf (공유 설정 — CLI와 동일 소스)
    this.loadFromWikeyConf()

    // 3. credentials.json (API 키)
    this.loadCredentials()

    // 4. 대화 히스토리 복원
    if (this.settings.persistChatHistory && this.settings.savedChatHistory?.length) {
      this.chatHistory = [...this.settings.savedChatHistory]
    }
  }

  async saveSettings() {
    // 1. 공유 설정 → wikey.conf
    this.saveToWikeyConf()

    // 2. API 키 → credentials.json (항상 — bash와 공유)
    this.saveCredentials()

    // 3. 플러그인 상태 → data.json
    await this.saveData(this.buildPluginOnlyData())

    this.llmClient = new LLMClient(this.httpClient, this.buildConfig())
  }

  private get credentialsPath(): string {
    const os = require('node:os') as typeof import('node:os')
    const path = require('node:path') as typeof import('node:path')
    return path.join(os.homedir(), '.config', 'wikey', 'credentials.json')
  }

  private get basePath(): string {
    return (this.app.vault.adapter as any).basePath ?? ''
  }

  private loadFromWikeyConf(): void {
    try {
      const fs = require('node:fs') as typeof import('node:fs')
      const path = require('node:path') as typeof import('node:path')
      const confPath = path.join(this.basePath, 'wikey.conf')
      const content = fs.readFileSync(confPath, 'utf-8')
      const conf = parseWikeyConf(content) as Record<string, unknown>

      this.settings = {
        ...this.settings,
        basicModel: (conf.WIKEY_BASIC_MODEL as string) || this.settings.basicModel,
        cloudModel: (conf.WIKEY_MODEL as string) || this.settings.cloudModel,
        ollamaUrl: (conf.OLLAMA_URL as string) || this.settings.ollamaUrl,
        costLimit: (conf.COST_LIMIT as number) || this.settings.costLimit,
        ingestProvider: (conf.INGEST_PROVIDER as string) || '',
        lintProvider: (conf.LINT_PROVIDER as string) || '',
        summarizeProvider: (conf.SUMMARIZE_PROVIDER as string) || '',
      }
    } catch {
      // wikey.conf 없음 — data.json 값 유지
    }
  }

  private saveToWikeyConf(): void {
    try {
      const fs = require('node:fs') as typeof import('node:fs')
      const path = require('node:path') as typeof import('node:path')
      const confPath = path.join(this.basePath, 'wikey.conf')
      let content = fs.readFileSync(confPath, 'utf-8')

      const updates: Record<string, string> = {
        WIKEY_BASIC_MODEL: this.settings.basicModel,
        WIKEY_MODEL: this.settings.cloudModel || 'wikey',
        OLLAMA_URL: this.settings.ollamaUrl,
        COST_LIMIT: String(this.settings.costLimit),
      }
      if (this.settings.advancedLLM) {
        if (this.settings.ingestProvider) updates.INGEST_PROVIDER = this.settings.ingestProvider
        if (this.settings.lintProvider) updates.LINT_PROVIDER = this.settings.lintProvider
        if (this.settings.summarizeProvider) updates.SUMMARIZE_PROVIDER = this.settings.summarizeProvider
      }

      for (const [key, value] of Object.entries(updates)) {
        const regex = new RegExp(`^(#\\s*)?${key}=.*$`, 'm')
        if (regex.test(content)) {
          content = content.replace(regex, `${key}=${value}`)
        } else {
          content += `\n${key}=${value}`
        }
      }

      fs.writeFileSync(confPath, content)
    } catch {
      // wikey.conf 없으면 무시
    }
  }

  private buildPluginOnlyData(): Record<string, unknown> {
    return {
      persistChatHistory: this.settings.persistChatHistory,
      savedChatHistory: this.settings.savedChatHistory,
      feedback: this.settings.feedback,
      advancedLLM: this.settings.advancedLLM,
      detectedShellPath: this.settings.detectedShellPath,
      detectedNodePath: this.settings.detectedNodePath,
      detectedPythonPath: this.settings.detectedPythonPath,
      qmdPath: this.settings.qmdPath,
    }
  }

  loadCredentials(): void {
    try {
      const fs = require('node:fs') as typeof import('node:fs')
      const raw = fs.readFileSync(this.credentialsPath, 'utf-8')
      const data = JSON.parse(raw)
      this.settings = {
        ...this.settings,
        geminiApiKey: data.geminiApiKey ?? '',
        anthropicApiKey: data.anthropicApiKey ?? '',
        openaiApiKey: data.openaiApiKey ?? '',
      }
    } catch {
      // 파일 없음 — 초기 상태
    }
  }

  saveCredentials(): void {
    const fs = require('node:fs') as typeof import('node:fs')
    const path = require('node:path') as typeof import('node:path')
    const dir = path.dirname(this.credentialsPath)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(
      this.credentialsPath,
      JSON.stringify(
        {
          geminiApiKey: this.settings.geminiApiKey,
          anthropicApiKey: this.settings.anthropicApiKey,
          openaiApiKey: this.settings.openaiApiKey,
        },
        null,
        2,
      ),
    )
  }

  scheduleChatSave() {
    if (!this.settings.persistChatHistory) return
    if (this.chatSaveTimer) clearTimeout(this.chatSaveTimer)
    this.chatSaveTimer = setTimeout(() => {
      const MAX = 100
      const trimmed = this.chatHistory.length > MAX ? this.chatHistory.slice(-MAX) : [...this.chatHistory]
      this.settings = { ...this.settings, savedChatHistory: trimmed }
      this.saveData(this.buildPluginOnlyData())
    }, 2000)
  }

  buildConfig(): WikeyConfig {
    // Effective provider for ingest: ingestProvider → basicModel fallback
    const effectiveProvider = (this.settings.ingestProvider || this.settings.basicModel || 'ollama').toLowerCase()
    // Model validation: drop ingestModel if it doesn't match the effective provider.
    // Empty string lets wikey-core resolveProvider pick provider-default (e.g. gemini-2.5-flash).
    const rawModel = this.settings.ingestModel || this.settings.cloudModel || ''
    const validatedModel = isModelCompatible(rawModel, effectiveProvider) ? rawModel : ''
    return {
      WIKEY_BASIC_MODEL: this.settings.basicModel,
      WIKEY_SEARCH_BACKEND: 'basic',
      WIKEY_MODEL: validatedModel,
      WIKEY_QMD_TOP_N: 5,
      GEMINI_API_KEY: this.settings.geminiApiKey,
      ANTHROPIC_API_KEY: this.settings.anthropicApiKey,
      OPENAI_API_KEY: this.settings.openaiApiKey,
      OLLAMA_URL: this.settings.ollamaUrl,
      INGEST_PROVIDER: this.settings.ingestProvider || '',
      LINT_PROVIDER: this.settings.advancedLLM ? this.settings.lintProvider : '',
      SUMMARIZE_PROVIDER: this.settings.advancedLLM ? this.settings.summarizeProvider : '',
      CONTEXTUAL_MODEL: CONTEXTUAL_DEFAULT_MODEL,
      COST_LIMIT: this.settings.costLimit,
      OCR_PROVIDER: this.settings.ocrProvider || undefined,
      OCR_MODEL: this.settings.ocrModel || undefined,
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
    const { vault } = this.plugin.app
    const dir = path.substring(0, path.lastIndexOf('/'))
    if (dir && !(await vault.adapter.exists(dir))) {
      await vault.createFolder(dir)
    }
    const existing = vault.getAbstractFileByPath(path)
    if (existing) {
      await vault.modify(existing as any, content)
      return
    }
    try {
      await vault.create(path, content)
    } catch (err: any) {
      // Race: file created between our check and create call (concurrent ingest,
      // or Obsidian metadata cache lag). Re-fetch and modify as upsert.
      if (/already exists/i.test(err?.message ?? '')) {
        const refetched = vault.getAbstractFileByPath(path)
        if (refetched) {
          await vault.modify(refetched as any, content)
          return
        }
        // File exists on disk but not in vault — write via adapter as last resort.
        await vault.adapter.write(path, content)
        return
      }
      throw err
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
