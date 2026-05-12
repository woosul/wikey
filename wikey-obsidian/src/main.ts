import { Notice, Plugin, TFile, WorkspaceLeaf, requestUrl } from 'obsidian'
import type { HttpClient, HttpRequestOptions, HttpResponse, WikiFS, WikeyConfig } from 'wikey-core'
import {
  LLMClient,
  parseWikeyConf,
  CONTEXTUAL_DEFAULT_MODEL,
  RenameGuard,
  reconcileExternalRename,
  handleExternalDelete,
  loadRegistry,
  saveRegistry,
  registryReconcile,
  buildCapabilityMap,
  dumpCapabilityMap,
  defaultCapabilityCachePath,
  createKoreanTokenizer,
  disposeOramaIndex,
  detectUpstreamUpdates,
  analyzeUpdate,
  QueryAnalyzer,
  appendEntriesToSuite,
  QueryIntentFilter,
  QueryRewriter,
  QueryExpander,
  QueryFilterCache,
  loadVaultQueryConfig,
  EMPTY_VAULT_QUERY_HINT,
  BUNDLED_QUERY_INTENT_FILTER_PROMPT,
  BUNDLED_QUERY_REWRITER_PROMPT,
  BUNDLED_QUERY_EXPANDER_PROMPT,
  BUNDLED_QUERY_ANALYZER_PROMPT,
  resolveProvider,
  type QueryAnswerPair,
  type AnalyzeResult,
  type VaultQueryHint,
  type LoadVaultQueryConfigResult,
} from 'wikey-core'
import type {
  KoreanTokenizerHandle,
  UpdateCheckResult,
  UpdateItemDescriptor,
  UpdateAnalysis,
} from 'wikey-core'
import { shouldDetectUpstreamUpdates } from './update-onload-gate'

// ── Phase 4 D.0.d (v6 §4.2.5) ──
// create listener + inbox 우회 감지 + audit 스캔이 공통 기준으로 쓸 문서 확장자 정규식.
// core `DOCLING_DOC_FORMATS` + pdf + hwp/hwpx + md/txt 의 union. 런타임 capability map
// 이 특정 ext 를 unsupported 로 표시해도 여기선 scan 후보까지는 포함 (UI 가 빨간 행으로 표시).
export const DOC_EXT_RE = /\.(md|txt|pdf|hwp|hwpx|docx|pptx|xlsx|csv|html|htm|png|jpg|jpeg|tiff|tif)$/i
import { WikeyChatView, WIKEY_CHAT_VIEW } from './sidebar-chat'
import { WikeySettingTab } from './settings-tab'
import { WikeyStatusBar } from './status-bar'
import { registerCommands } from './commands'
import { detectEnvironment, buildExecEnv } from './env-detect'
import type { EnvStatus } from './env-detect'
import { ensureParaFolders } from './setup-para'

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
  // Stay-involved 모달 (llm-wiki.md "guide the LLM on what to emphasize")
  ingestBriefs: 'always' | 'session' | 'never'
  verifyIngestResults: boolean
  // 자동 탐지된 환경 (수동 편집 불필요)
  detectedShellPath: string
  detectedNodePath: string
  detectedPythonPath: string
  feedback: Array<{ question: string; answer: string; vote: string; timestamp: string }>
  persistChatHistory: boolean
  savedChatHistory: ReadonlyArray<{ role: 'user' | 'assistant' | 'error'; content: string }>
  // 최초 1회 사이드바 초기 폭을 500px로 설정 — 이후엔 사용자 리사이즈 존중
  initialSidebarWidthApplied: boolean
  // §4.5.1.6.1 — extraction determinism toggle. When true, ingest pipeline
  // injects temperature=0 + seed=42 into all LLM calls. Primarily used by
  // measure-determinism.sh; can also be enabled via wikey.conf for prod runs.
  extractionDeterminism: boolean
  // ── Phase 4 D.0.c (v6 §4.1.2): PII 2-layer gate ──
  // Basic: allowPiiIngest (default false → block) + piiRedactionMode (default 'mask').
  // Advanced: piiGuardEnabled (default true → detect). false = 검사 skip (공시용 문서).
  allowPiiIngest: boolean
  piiRedactionMode: 'display' | 'mask' | 'hide'
  piiGuardEnabled: boolean
  // ── §5.3 follow-up — 답변 끝 "원본:" footer 표시 모드 ──
  // 'raw'     : 입력 원본 (pdf 면 pdf, md 면 md). default
  // 'sidecar' : sidecar 파일 (paired 면 .md, 단독 md 면 자체)
  // 'hidden'  : footer 미출력
  originalLinkMode: 'raw' | 'sidecar' | 'hidden'
  // ── §5.18 v0.5 — backlink section scope (사용자 raise 2026-05-12) ──
  // 'wiki'     : wiki/ 페이지만 (default, wikey 3계층 지식 자산 layer)
  // 'extended' : wiki/ + 다른 폴더 (plan/, activity/, 사용자 메모) — raw/ 는
  //              항상 제외 (wiki/ 와 중복). "단순 참조" 가시화 opt-in.
  backlinkScope: 'wiki' | 'extended'
  // ── §5.7.4 검색 backend engine ──
  // 'orama' (default): in-process Orama + Kiwi WASM tokenizer
  // 'qmd' (회귀): tools/qmd/ vendored CLI subprocess
  searchEngine: 'orama' | 'qmd'
  // ── §5.7.5 Developer mode (settings 토글, opt-in) ──
  // developerMode = settings 의 [developer] 섹션 표시 여부 (default false).
  // allowUpdateCheck = plugin onload 시 외부 source fetch 동의 (default false).
  developerMode: boolean
  allowUpdateCheck: boolean
  // ── §5.7.8 Advanced query tuning (LLM per-query dynamic stopword paradigm) ──
  // All eight fields are opt-in (default OFF / DEFAULTS) so existing users see no
  // behavior change (Spec invariant I7 / I16). See `renderAdvancedQueryTuningSection`
  // in settings-tab.ts and the §1.4 default 권고 안내문구 for control semantics.
  advancedQueryTuningEnabled: boolean
  advancedQueryTuningMode: 'off' | 'filter-only' | 'filter-rewrite' | 'filter-rewrite-expand'
  advancedQueryTuningTimeoutMs: number
  advancedQueryTuningCacheSize: number
  advancedQueryTuningProvider: string
  advancedQueryTuningModel: string
  advancedQueryTuningTemperature: number
  advancedQueryTuningMaxTokens: number
  /** §5.7.8 Spec 3 Q6 v1.3 — auto-extend trigger threshold (1~50). */
  advancedQueryTuningAutoExtendThreshold: number
  /**
   * §5.7.8 Spec 3 I11 — high-water mark cursor. Index into `chatHistory` immediately
   * past the last (query, answer) pair already analysed. Used by the auto-extend
   * trigger to avoid double-analysing pairs across reloads. Default 0.
   */
  advancedQueryTuningLastAnalyzedIndex: number
  // ── §5.7.7 Hybrid search (BM25 + Qwen3-Embedding + RRF) ──
  // Default OFF (Spec I15 backward compat). Sub-control of advancedQueryTuningEnabled
  // (master OFF → hybrid hidden, Q9 LOCKED v1.2). Toggle 단일 — mode dropdown 폐기 (Q10).
  searchHybridEnabled: boolean
  /** §5.7.7 Spec 1.3 — RRF k value (default 60, 논문 권고; settings UI customizable). */
  searchRrfK: number
  /** §5.7.7 Spec 1.4 I19 — Qwen3-Embedding model download status (4 phase). */
  searchQwen3DownloadStatus: 'idle' | 'downloading' | 'installed' | 'failed'
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
  ingestBriefs: 'always',
  verifyIngestResults: true,
  detectedShellPath: '',
  detectedNodePath: '',
  detectedPythonPath: '',
  feedback: [],
  persistChatHistory: true,
  savedChatHistory: [],
  initialSidebarWidthApplied: false,
  extractionDeterminism: false,
  allowPiiIngest: false,
  piiRedactionMode: 'mask',
  piiGuardEnabled: true,
  originalLinkMode: 'raw',
  backlinkScope: 'wiki',
  searchEngine: 'orama',
  developerMode: false,
  allowUpdateCheck: false,
  // §5.7.8 — advanced query tuning defaults. OFF / DEFAULTS to preserve I7 backward compat.
  advancedQueryTuningEnabled: false,
  advancedQueryTuningMode: 'filter-only',
  advancedQueryTuningTimeoutMs: 5000,
  advancedQueryTuningCacheSize: 1000,
  advancedQueryTuningProvider: '',
  advancedQueryTuningModel: '',
  advancedQueryTuningTemperature: 0.0,
  advancedQueryTuningMaxTokens: 500,
  advancedQueryTuningAutoExtendThreshold: 5,
  advancedQueryTuningLastAnalyzedIndex: 0,
  // §5.7.7 Hybrid search defaults — OFF / 60 / 'idle' (Spec I15 backward compat).
  searchHybridEnabled: false,
  searchRrfK: 60,
  searchQwen3DownloadStatus: 'idle',
}

export type { WikeySettings }

/**
 * §5.7.8 Spec 3 I11 helper — count the (user → assistant) pairs in `history` whose
 * *user* index is ≥ `cursor`. Exported (and pure) so the auto-extend trigger and unit
 * tests share one definition. Returning a number rather than the pairs themselves
 * keeps the trigger path allocation-free for the common "below threshold" case.
 */
export function countQueryAnswerPairs(
  history: ReadonlyArray<{ role: 'user' | 'assistant' | 'error'; content: string }>,
  cursor: number,
): number {
  let count = 0
  for (let i = Math.max(0, cursor); i < history.length - 1; i += 1) {
    const cur = history[i]
    const next = history[i + 1]
    if (
      cur.role === 'user' &&
      next.role === 'assistant' &&
      cur.content.trim().length > 0 &&
      next.content.trim().length > 0
    ) {
      count += 1
    }
  }
  return count
}

/**
 * §5.7.8 Spec 4 + Cycle #1 Finding 1 + Cycle #2 Finding 2 — pure helper that resolves
 * the filter LLMCallOptions from settings + base wikey config. Extracted from
 * `WikeyPlugin.buildFilterCallOptions` so the test surface exercises the *real* logic
 * (Q1 LOCKED DEFAULT inherit) and a regression in either branch is caught by unit tests.
 *
 * Provider/model precedence:
 *   1. Explicit override (`advancedQueryTuningProvider` non-empty) → use as-is.
 *   2. DEFAULT (override empty) → `resolveProvider('default', baseConfig)` so the user's
 *      `WIKEY_BASIC_MODEL` (ollama / claude-code / gemini …) is inherited verbatim
 *      instead of LLMClient's hardcoded `'gemini'` fallback.
 *
 * Settings shape is narrow (only the 5 advanced-query-tuning fields the helper needs)
 * to keep the public signature stable across future settings additions.
 */
export interface FilterCallOptionsInputs {
  readonly advancedQueryTuningProvider: string
  readonly advancedQueryTuningModel: string
  readonly advancedQueryTuningTemperature: number
  readonly advancedQueryTuningMaxTokens: number
  readonly advancedQueryTuningTimeoutMs: number
}

export interface FilterCallOptionsResult {
  provider?: 'gemini' | 'anthropic' | 'openai' | 'ollama'
  model?: string
  temperature: number
  maxTokens: number
  timeout: number
  /** §5.7.9 I2 — gemini-2.5 thinking opt-out for advanced query tuning. */
  thinkingBudget?: number
}

/**
 * §5.7.8 Cycle #3 F1 — `runQueryAnalysis` return shape. Carries the analyzer's own
 * outcome AND the suite-append result so the auto-extend trigger does not have to
 * read a plugin-global field (which races under concurrent runs).
 */
export interface RunQueryAnalysisResult {
  readonly entries: AnalyzeResult['entries']
  // Cycle #6 F1 — fallback union widened to include `'invalidated'` (returned when
  // the append-time generation guard aborts side effects). Forward declaration of
  // AnalyzerFallbackTag below — TypeScript hoists the type alias through the file.
  readonly fallback: AnalyzerFallbackTag
  readonly latencyMs: number
  readonly appendOutcome: SuiteAppendOutcome
  readonly entriesAppended: number
}

/**
 * §5.7.8 Cycle #2 Finding 1 — cursor-advance decision for auto-extend.
 *
 * Returns true only when the analyzer reports `'none'` (success) AND the suite append
 * (when entries were produced) raised no error. `runQueryAnalysis` swallows append
 * errors via `console.warn`, so we additionally require the caller to pass the
 * observed append outcome.
 *
 * Pure helper — exposed for unit tests and the auto-extend trigger to share one
 * definition. No I/O / no side effects.
 */
export type AnalyzerFallbackTag = 'none' | 'llm-fail' | 'timeout' | 'invalidated'
export type SuiteAppendOutcome = 'ok' | 'append-error' | 'no-entries' | 'skipped'

export function shouldAdvanceAutoExtendCursor(
  analyzerFallback: AnalyzerFallbackTag,
  suiteAppend: SuiteAppendOutcome,
): boolean {
  if (analyzerFallback !== 'none') return false
  if (suiteAppend === 'append-error') return false
  if (suiteAppend === 'skipped') return false
  return true
}

/**
 * §5.7.8 Cycle #6 F1 — generation token for `runQueryAnalysis`. The auto-extend
 * trigger captures its dispatch generation and asks the analyzer to abort the
 * suite-append + Notice side effects when the live counter has drifted (e.g. by
 * a `clearChat()` between dispatch and analyzer resolution).
 *
 * The token is intentionally simple — caller-supplied `gen` snapshot + `current()`
 * accessor so the analyzer reads the fresh value at the moment of the check.
 * Manual triggers (commands.ts / settings-tab.ts) omit the token → never aborted.
 */
export interface GenerationToken {
  readonly gen: number
  readonly current: () => number
}

export function buildFilterCallOptionsFromSettings(
  settings: FilterCallOptionsInputs,
  baseConfig: WikeyConfig,
): FilterCallOptionsResult {
  const overrideProvider = settings.advancedQueryTuningProvider
  const overrideModel = settings.advancedQueryTuningModel
  let provider: FilterCallOptionsResult['provider']
  let model: string | undefined

  if (overrideProvider) {
    provider = overrideProvider as FilterCallOptionsResult['provider']
    model = overrideModel || undefined
  } else {
    // DEFAULT — inherit vault's basic model via resolveProvider.
    try {
      const resolved = resolveProvider('default', baseConfig)
      provider = resolved.provider
      model = overrideModel || resolved.model
    } catch (err) {
      // resolveProvider should never throw on 'default'; this is paranoia.
      console.warn('[Wikey] resolveProvider("default") failed:', err)
    }
  }
  return {
    provider,
    model,
    temperature: settings.advancedQueryTuningTemperature,
    maxTokens: settings.advancedQueryTuningMaxTokens,
    timeout: settings.advancedQueryTuningTimeoutMs,
    // §5.7.9 I2 — advanced query tuning 4 layer (filter / rewriter / expander /
    // analyzer) 모두 결정적 짧은 JSON. thinking off 로 gemini-2.5-* 호환 + cost 절약.
    thinkingBudget: 0,
  }
}

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
  /** Session-only: set to true when user clicks "Skip briefs this session" in Stage 1 modal. Cleared on reload. */
  skipIngestBriefsThisSession = false
  private statusBar!: WikeyStatusBar
  private chatSaveTimer: ReturnType<typeof setTimeout> | null = null
  /**
   * §4.2.4 S4-1: movePair 가 발행 예정 rename 을 pre-register 하고, vault listener 가
   * 매칭되면 consume + skip — double-move 재귀 방지.
   */
  renameGuard: RenameGuard = new RenameGuard()

  // Phase 4 D.0.e (v6 §4.3) — idempotent flag. onLayoutReady 가 한 번 이상 호출될 수 있고,
  // 1500ms fallback 이 실제 layout-ready 보다 먼저 돌 수 있어 재진입 방어 필요.
  private startupReconcileDone = false

  // §5.7.8 — lazy plugin-scope singletons for the LLM-driven query layers. Constructed
  // on first ON-toggled query; nullified on settings change so a new provider/model
  // takes effect without an Obsidian reload. Cache file root persists across reloads.
  private queryFilterCache: QueryFilterCache | null = null
  private queryFilterCacheCapacity = 0
  private queryFilterInstance: QueryIntentFilter | null = null

  // §5.7.8 Cycle #5 F1 (a) — auto-extend generation counter. Bumped at every dispatch
  // and at every invalidation event (e.g. `clearChat`). Each in-flight analyzer captures
  // its generation at dispatch time; the success path writes the cursor only when the
  // captured generation still matches `autoExtendGeneration` — late-completing runs from
  // an invalidated session no-op cleanly.
  autoExtendGeneration = 0
  private queryRewriterInstance: QueryRewriter | null = null
  private queryExpanderInstance: QueryExpander | null = null
  private queryFilterLLMSignature = '' // provider|model|temp|maxTokens — invalidates layers on change.
  private vaultQueryConfigCache: LoadVaultQueryConfigResult | null = null
  // (§5.7.8 Cycle #2 F1 plugin-global `lastQueryAnalysisAppendOutcome` field removed
  // in Cycle #3 F1 — replaced by per-call return value on `runQueryAnalysis` to avoid
  // races when concurrent auto-extend runs overlap.)

  // §5.7.4 codex cycle #1 HIGH-1 fix — production query 의 Korean tokenizer lazy promise
  // cache. 첫 query 시 init (1~2s), 후속 호출은 await 만. onunload 시 close.
  private koreanTokenizerPromise: Promise<KoreanTokenizerHandle | null> | null = null

  // §5.7.5 — upstream update detect cache. onload 1회 fetch 후 settings UI 표시.
  updateCheckResult: UpdateCheckResult | null = null
  // §5.7.5 — [분석] 버튼 결과 cache (kind → analysis). 사용자가 명시 reset 까지 보존.
  updateAnalyses: Map<string, UpdateAnalysis> = new Map()

  /**
   * Lazy 진입점. 첫 호출 시 plugin folder 의 `kiwi-wasm.wasm` + `~/.cache/wikey/kiwi-models/cong/base`
   * 검사 + Kiwi WASM init. 부재 환경 또는 init 실패 시 null 반환 (sidebar 가 graceful 빈 결과).
   */
  async getKoreanTokenizer(): Promise<KoreanTokenizerHandle | null> {
    if (this.koreanTokenizerPromise) return this.koreanTokenizerPromise
    this.koreanTokenizerPromise = (async () => {
      const path = require('node:path') as typeof import('node:path')
      const fs = require('node:fs') as typeof import('node:fs')
      const os = require('node:os') as typeof import('node:os')
      const wasmPath = path.join(this.basePath, this.manifest.dir ?? '', 'kiwi-wasm.wasm')
      const modelDir = path.join(os.homedir(), '.cache', 'wikey', 'kiwi-models', 'cong', 'base')
      if (!fs.existsSync(wasmPath)) {
        console.warn(`[Wikey] kiwi-wasm.wasm not found at ${wasmPath} — Korean tokenizer disabled`)
        return null
      }
      if (!fs.existsSync(modelDir)) {
        new Notice('[Wikey] Kiwi 사전이 없습니다. ./scripts/download-kiwi-models.sh 실행을 권고합니다.', 8000)
        console.warn(`[Wikey] Kiwi modelDir not found at ${modelDir}`)
        return null
      }
      try {
        const wasmBinary = new Uint8Array(fs.readFileSync(wasmPath))
        return await createKoreanTokenizer({ wasmPath, wasmBinary, modelDir })
      } catch (err) {
        console.error('[Wikey] createKoreanTokenizer failed:', err)
        return null
      }
    })()
    return this.koreanTokenizerPromise
  }

  async onload() {
    await this.loadSettings()

    this.wikiFS = new ObsidianWikiFS(this)
    this.httpClient = new ObsidianHttpClient()
    this.llmClient = new LLMClient(this.httpClient, this.buildConfig())

    this.registerView(WIKEY_CHAT_VIEW, (leaf) => new WikeyChatView(leaf, this))

    this.addRibbonIcon('book-open', 'Wikey', () => this.activateChatView())

    this.addSettingTab(new WikeySettingTab(this.app, this))

    this.statusBar = new WikeyStatusBar(this)
    this.statusBar.register()

    registerCommands(this)

    // 환경 자동 탐지 (백그라운드)
    this.runEnvDetection()

    // §5.7.5 — upstream update detect (재시작 1회, opt-in).
    // developerMode + allowUpdateCheck 양쪽 토글 시만 호출 (사용자 결정 #2 = opt-in).
    if (shouldDetectUpstreamUpdates(this.settings)) {
      void this.runUpstreamUpdateCheck().catch((err) => {
        console.warn('[Wikey] upstream update check failed:', err)
      })
    }

    // PARA 기본 폴더 구조 idempotent 보장 (신규 vault에 배포)
    void ensureParaFolders(this.app).then((r) => {
      if (r.created > 0) {
        console.info(`[Wikey] PARA folders initialized: ${r.created} created, ${r.existed} existed`)
      }
    }).catch((err) => console.warn('[Wikey] PARA folders setup failed:', err))

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

    // §4.2.4 S4-1: vault.on('rename') — registry + frontmatter 동기화
    //   movePair 가 발행한 self-rename 은 renameGuard.consume 으로 skip.
    //   사용자 UI 이동은 reconcileExternalRename 로 처리 + sidecar 동행.
    const renameDebouncers = new Map<string, ReturnType<typeof setTimeout>>()
    this.registerEvent(
      this.app.vault.on('rename', (file, oldPath) => {
        if (!file.path.startsWith('raw/') && !oldPath.startsWith('raw/')) return
        if (Date.now() - startTime < STARTUP_GRACE_MS) return
        if (this.renameGuard.consume(file.path)) return

        const pending = renameDebouncers.get(oldPath)
        if (pending) clearTimeout(pending)
        renameDebouncers.set(
          oldPath,
          setTimeout(() => {
            renameDebouncers.delete(oldPath)
            void this.handleVaultRename(oldPath, file.path)
          }, 200),
        )
      }),
    )

    // §4.2.4 S4-2: vault.on('delete') — tombstone + source 페이지 banner
    this.registerEvent(
      this.app.vault.on('delete', (file) => {
        if (!file.path.startsWith('raw/')) return
        if (Date.now() - startTime < STARTUP_GRACE_MS) return
        if (this.renameGuard.consume(file.path)) return
        void this.handleVaultDelete(file.path)
      }),
    )

    // §4.2.4 S4-3: onload reconcile — bash/Finder 외부 이동/삭제 누락 복구.
    // Phase 4 D.0.e (v6 §4.3): onLayoutReady 로 이관 — vault metadata cache 가 준비된 뒤
    // 실행해야 TFile 조회가 안정적. 1500ms fallback 은 onLayoutReady 가 이상 이벤트로 누락된
    // 케이스 (Obsidian 재설치 직후 등) 방어. idempotent flag 로 이중 실행 차단.
    const triggerReconcile = (origin: string): void => {
      if (this.startupReconcileDone) return
      this.startupReconcileDone = true
      console.info(`[Wikey] startup reconcile triggered by ${origin}`)
      void this.runStartupReconcile().catch((err) =>
        console.warn('[Wikey] startup reconcile failed:', err),
      )
    }
    this.app.workspace.onLayoutReady(() => triggerReconcile('onLayoutReady'))
    setTimeout(() => triggerReconcile('delayed-fallback-1500ms'), 1500)

    this.registerEvent(
      this.app.vault.on('create', (file) => {
        if (!file.path.startsWith('raw/')) return
        if (Date.now() - startTime < STARTUP_GRACE_MS) return
        // Phase 4 D.0.g (v6 §4.5.1): movePair 가 pre-register 한 예정 create 를 consume.
        // rename 의 역방향 — 원본과 sidecar 를 함께 이동할 때 destination 의 create 이벤트가
        // "우회 감지" 로 오탐되는 현상 (C6.1) 방지. renameGuard TTL 5s default 유지.
        if (this.renameGuard.consume(file.path)) return

        const name = file.path.split('/').pop() ?? file.path
        const isDoc = DOC_EXT_RE.test(file.path)

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

  // §4.2.4 S4-1: external rename handler — registry + frontmatter + sidecar 자동 동행
  private async handleVaultRename(oldPath: string, newPath: string): Promise<void> {
    try {
      const newSidecar = /\.md$/i.test(newPath) ? undefined : `${newPath}.md`

      // Sidecar auto-follow: movePair 가 아니라 사용자가 UI 에서 원본만 이동한 경우,
      // 동반 sidecar (<original>.md) 가 여전히 oldPath+'.md' 에 남아 있을 수 있다.
      if (newSidecar) {
        const oldSidecar = `${oldPath}.md`
        const sidecarFile = this.app.vault.getAbstractFileByPath(oldSidecar)
        if (sidecarFile && sidecarFile instanceof TFile) {
          try {
            this.renameGuard.register(newSidecar) // 재귀 이벤트 skip
            await this.app.fileManager.renameFile(sidecarFile, newSidecar)
          } catch (err) {
            console.warn('[Wikey] sidecar follow-rename failed:', oldSidecar, err)
          }
        }
      }

      const result = await reconcileExternalRename({
        wikiFS: this.wikiFS,
        oldVaultPath: oldPath,
        newVaultPath: newPath,
        newSidecarVaultPath: newSidecar,
      })
      if (result.sourceId) {
        console.info(
          `[Wikey] vault rename reconciled: ${oldPath} → ${newPath} (id=${result.sourceId.slice(0, 20)}, pages=${result.rewrittenPages.length})`,
        )
      }
    } catch (err) {
      console.warn('[Wikey] handleVaultRename failed:', oldPath, err)
    }
  }

  // §4.2.4 S4-2: external delete handler — tombstone + banner
  private async handleVaultDelete(path: string): Promise<void> {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const result = await handleExternalDelete({
        wikiFS: this.wikiFS,
        deletedVaultPath: path,
        at: today,
      })
      if (result.sourceId) {
        console.info(
          `[Wikey] vault delete tombstoned: ${path} (id=${result.sourceId.slice(0, 20)}, banners=${result.bannersAdded.length})`,
        )
      }
    } catch (err) {
      console.warn('[Wikey] handleVaultDelete failed:', path, err)
    }
  }

  // §4.2.4 S4-3: startup reconcile — bash/Finder 외부 이동/삭제 복구.
  //   대용량 볼트 보호: 50MB 초과 파일은 hash 재계산 skip.
  private async runStartupReconcile(): Promise<void> {
    const registry = await loadRegistry(this.wikiFS)
    if (Object.keys(registry).length === 0) return

    const MAX_BYTES = 50 * 1024 * 1024
    const walker = async () => {
      const out: Array<{ vault_path: string; bytes: Uint8Array }> = []
      const files = this.app.vault.getFiles()
      for (const f of files) {
        if (!f.path.startsWith('raw/')) continue
        if (f.stat && f.stat.size > MAX_BYTES) continue
        try {
          const buf = await this.app.vault.readBinary(f)
          out.push({ vault_path: f.path, bytes: new Uint8Array(buf) })
        } catch (err) {
          console.warn('[Wikey] reconcile readBinary failed:', f.path, err)
        }
      }
      return out
    }
    const updated = await registryReconcile(registry, walker)
    if (updated !== registry) {
      await saveRegistry(this.wikiFS, updated)
      const before = Object.values(registry).filter((r) => !r.tombstone).length
      const after = Object.values(updated).filter((r) => !r.tombstone).length
      console.info(
        `[Wikey] startup reconcile complete — active=${after} (was ${before}), ${Object.keys(updated).length} total`,
      )
    }
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
        // auto-ingest = "batch with less supervision" mode — skip stay-involved modals
        const result = await runIngest(this, relPath, undefined, { skipBriefModal: true, skipPreviewModal: true })
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
    // §5.7.4 — Kiwi tokenizer dispose (Kiwi WASM heap free). 미초기화 시 no-op.
    if (this.koreanTokenizerPromise) {
      this.koreanTokenizerPromise.then((t) => t?.close()).catch(() => {/* ignore */})
      this.koreanTokenizerPromise = null
    }
    // §5.7.4 codex cycle #2 LOW-9 — Orama singleton cache 도 invalidate (closed tokenizer
    // reference 보존 회피). plugin reload 시 fresh handle.
    disposeOramaIndex()
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
    // §5.7.5 C6 — searchEngine 전달. orama default 시 qmd inline block + ABI scan skip.
    this.envStatus = await detectEnvironment(
      basePath,
      this.settings.ollamaUrl,
      this.settings.searchEngine,
    )

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

    // Phase 4 D.0.d (v6 §4.2.2): runtime capability map 을 ~/.cache/wikey/capabilities.json
    // 에 덤프. audit-ingest.py 가 동일 경로 read — TS/UI/Python 이 한 소스로 동기화.
    try {
      const map = buildCapabilityMap({
        hasDocling: this.envStatus.hasDocling,
        hasUnhwp: this.envStatus.hasUnhwp,
      })
      const cachePath = defaultCapabilityCachePath()
      await dumpCapabilityMap(map, cachePath)
      console.log(`[Wikey] capability map dumped → ${cachePath} (docling=${map.doclingInstalled}, unhwp=${map.unhwpInstalled})`)
    } catch (err) {
      console.warn('[Wikey] capability map dump failed:', err)
    }
  }

  /**
   * §5.7.5 — plugin onload 시 upstream update fetch (재시작 1회).
   *
   * 호출 조건: developerMode && allowUpdateCheck (사용자 결정 #2 = opt-in).
   * fetch DI = obsidian `requestUrl` 을 thin wrap.
   */
  async runUpstreamUpdateCheck(): Promise<void> {
    const fetcher = async (url: string): Promise<string> => {
      const r = await requestUrl({ url, method: 'GET' })
      return r.text
    }
    this.updateCheckResult = await detectUpstreamUpdates({
      basePath: this.basePath,
      allowNetwork: true,
      fetch: fetcher,
    })
    console.log(
      `[Wikey] upstream update check: ${this.updateCheckResult.items.length} items` +
        ` (errors=${this.updateCheckResult.errors.length})`,
    )
  }

  /**
   * §5.7.5 — [분석] 버튼 backend. settings-tab UI 가 호출.
   *
   * LLM provider = wikey 기본 BYOAI (사용자 결정 #3 = `buildConfig` default provider).
   */
  async runUpdateAnalysis(item: UpdateItemDescriptor): Promise<void> {
    const fetcher = async (url: string): Promise<string> => {
      const r = await requestUrl({ url, method: 'GET' })
      return r.text
    }
    const llm = {
      generate: async (prompt: string): Promise<string> => {
        // §5.7.5 라이브 smoke fix — LLMClient public API = `call(prompt, opts?)`,
        // not `callLLM` (verified in wikey-core/src/llm-client.ts:14). 사용자 결정 #3
        // (buildConfig default provider) mirror — opts omit → default `gemini`.
        return await this.llmClient.call(prompt)
      },
    }
    const analysis = await analyzeUpdate({ item, llm, fetch: fetcher })
    this.updateAnalyses.set(item.kind, analysis)
  }

  getExecEnv(): Record<string, string> {
    const env = buildExecEnv(
      this.settings.detectedShellPath || process.env.PATH || '',
      this.settings.detectedNodePath || undefined,
    )
    // §5.7.4 — WIKEY_SEARCH_ENGINE 을 buildConfig() 와 같은 우선순위로 inject so that
    // scripts-runner / cmdReindex 가 받는 env 에도 반영. process.env override > wikey.conf > 'orama'.
    const cfg = this.buildConfig()
    if (cfg.WIKEY_SEARCH_ENGINE) {
      env.WIKEY_SEARCH_ENGINE = cfg.WIKEY_SEARCH_ENGINE
    }
    // §5.7.7 cycle #3 codex HIGH #2 fix — Hybrid mode + Ollama URL forward to subprocess
    // (Full Reindex CLI path). Without these, plugin Full Reindex builds BM25-only cache
    // even when Settings shows Hybrid ON. cmdReindex reads WIKEY_HYBRID_MODE === 'on' to
    // auto-enable opts.hybrid (parity with `--hybrid` CLI flag).
    if (cfg.WIKEY_HYBRID_MODE) {
      env.WIKEY_HYBRID_MODE = cfg.WIKEY_HYBRID_MODE
    }
    if (cfg.WIKEY_RRF_K !== undefined) {
      env.WIKEY_RRF_K = String(cfg.WIKEY_RRF_K)
    }
    if (cfg.OLLAMA_URL) {
      env.OLLAMA_URL = cfg.OLLAMA_URL
    }
    // §5.7.4 codex cycle #2 HIGH-8 — Kiwi WASM/사전 path inject. Obsidian CJS bundle 의
    // `import.meta` empty 회피 — plugin folder + cache modelDir 명시 forward.
    const path = require('node:path') as typeof import('node:path')
    const os = require('node:os') as typeof import('node:os')
    env.WIKEY_KIWI_WASM_PATH = path.join(this.basePath, this.manifest.dir ?? '', 'kiwi-wasm.wasm')
    env.WIKEY_KIWI_MODEL_DIR = path.join(os.homedir(), '.cache', 'wikey', 'kiwi-models', 'cong', 'base')
    return env
  }

  async loadSettings() {
    // 1. data.json (플러그인 상태)
    const existing = (await this.loadData()) ?? {}
    this.settings = Object.assign({}, DEFAULT_SETTINGS, existing)

    // 1b. 누락된 기본값을 data.json에 명시적으로 저장해 디버깅/감사 시 stale한 `missing` 필드 혼동 제거.
    const missingKeys = Object.keys(DEFAULT_SETTINGS).filter((k) => !(k in existing))
    if (missingKeys.length > 0) {
      console.info(`[Wikey] persisting ${missingKeys.length} default settings: ${missingKeys.join(', ')}`)
      await this.saveData(this.settings)
    }

    // 2. wikey.conf (공유 설정 — CLI와 동일 소스)
    this.loadFromWikeyConf()

    // 3. credentials.json (API 키)
    this.loadCredentials()

    // 4. 대화 히스토리는 세션별 초기화 (재시작/reload 시 빈 상태 — §4.0 요구)
    this.chatHistory = []

    // §5.7.8 Cycle #4 F1 — auto-extend cursor recovery. The cursor is an absolute
    // index into `chatHistory`; after the per-session reset above (or any external
    // mutation that shrinks history), a stale cursor would silently disable the
    // auto-extend trigger. Cap to current length defensively + persist.
    const cursor = this.settings.advancedQueryTuningLastAnalyzedIndex ?? 0
    if (cursor > this.chatHistory.length) {
      this.settings = {
        ...this.settings,
        advancedQueryTuningLastAnalyzedIndex: this.chatHistory.length,
      }
      await this.saveData(this.buildPluginOnlyData())
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

    // §5.7.8 — invalidate the cached vault config + filter layers so a settings change
    // (provider override, mode toggle, vault yaml edit) takes effect on the next query.
    this.vaultQueryConfigCache = null
    this.queryFilterInstance = null
    this.queryRewriterInstance = null
    this.queryExpanderInstance = null
    this.queryFilterLLMSignature = ''
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

      // §5.7.4 — WIKEY_SEARCH_ENGINE 인식. invalid 값 default 'orama' + console.warn.
      const rawEngine = conf.WIKEY_SEARCH_ENGINE
      let parsedEngine: 'orama' | 'qmd' = this.settings.searchEngine
      if (rawEngine !== undefined) {
        if (rawEngine === 'orama' || rawEngine === 'qmd') {
          parsedEngine = rawEngine
        } else {
          console.warn(
            `[Wikey] wikey.conf: invalid WIKEY_SEARCH_ENGINE=${String(rawEngine)} — fallback to 'orama'`,
          )
          parsedEngine = 'orama'
        }
      }

      // §5.7.7 cycle #5 codex MED #2 fix — wikey.conf 의 hybrid field 도 read.
      // 이전: write-only (saveToWikeyConf) 였음 — CLI / 외부 편집 변경이 plugin 안 무시됨.
      // §5.7.7 cycle #6 codex MED #2 fix — conf hybrid='on' 시 master toggle 도 자동 ON.
      // 사용자가 CLI 에서 conf 직접 편집해 ON 한 의도가 plugin reload 시 silent revert
      // (master OFF 라 buildConfig effective OFF + 다음 save 'off' 덮어쓰기) 되던 회귀 회피.
      const rawHybrid = conf.WIKEY_HYBRID_MODE
      const hybridFromConf =
        rawHybrid === 'on' ? true : rawHybrid === 'off' ? false : this.settings.searchHybridEnabled
      const rawRrfK = conf.WIKEY_RRF_K
      const rrfKFromConf =
        typeof rawRrfK === 'number' && rawRrfK > 0
          ? rawRrfK
          : typeof rawRrfK === 'string' && Number.isFinite(Number(rawRrfK)) && Number(rawRrfK) > 0
            ? Number(rawRrfK)
            : this.settings.searchRrfK

      // §5.7.7 cycle #6 codex MED #2 fix — conf hybrid 'on' 의도면 master toggle 도 ON.
      // CLI 또는 외부 편집 의도가 plugin 안 silent revert 되지 않도록 auto-promote.
      // §5.7.7 cycle #7 codex MED fix — auto-promote 시 query tuning mode='off' 강제.
      // master ON + default mode='filter-only' 가 LLM filter 활성 → cloud LLM 호출/비용
      // 동반 side effect (사용자 의도 "hybrid only" 초과). hybrid 만 effective 보장.
      const advancedFromConf =
        rawHybrid === 'on' ? true : this.settings.advancedQueryTuningEnabled
      const masterWasOff =
        rawHybrid === 'on' && this.settings.advancedQueryTuningEnabled === false
      const modeFromConf: WikeySettings['advancedQueryTuningMode'] = masterWasOff
        ? 'off'
        : this.settings.advancedQueryTuningMode

      this.settings = {
        ...this.settings,
        basicModel: (conf.WIKEY_BASIC_MODEL as string) || this.settings.basicModel,
        cloudModel: (conf.WIKEY_MODEL as string) || this.settings.cloudModel,
        ollamaUrl: (conf.OLLAMA_URL as string) || this.settings.ollamaUrl,
        costLimit: (conf.COST_LIMIT as number) || this.settings.costLimit,
        ingestProvider: (conf.INGEST_PROVIDER as string) || '',
        lintProvider: (conf.LINT_PROVIDER as string) || '',
        summarizeProvider: (conf.SUMMARIZE_PROVIDER as string) || '',
        extractionDeterminism: conf.WIKEY_EXTRACTION_DETERMINISM === true || this.settings.extractionDeterminism,
        searchEngine: parsedEngine,
        searchHybridEnabled: hybridFromConf,
        searchRrfK: rrfKFromConf,
        advancedQueryTuningEnabled: advancedFromConf,
        advancedQueryTuningMode: modeFromConf,
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
        // §5.7.7 cycle #3 codex HIGH #2 fix — Hybrid wiring conf bridge (CLI parity).
        // §5.7.7 cycle #5 codex HIGH #1 fix — sub-control gate: master toggle ON 시만 'on'.
        WIKEY_HYBRID_MODE:
          (this.settings.advancedQueryTuningEnabled && this.settings.searchHybridEnabled)
            ? 'on' : 'off',
        WIKEY_RRF_K: String(this.settings.searchRrfK ?? 60),
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
      // D.0.c PII gate (user trust setting) — must persist across reloads.
      allowPiiIngest: this.settings.allowPiiIngest,
      piiRedactionMode: this.settings.piiRedactionMode,
      piiGuardEnabled: this.settings.piiGuardEnabled,
      // §5.7.5 — Developer mode (settings 토글, opt-in).
      developerMode: this.settings.developerMode,
      allowUpdateCheck: this.settings.allowUpdateCheck,
      // §5.7.8 — Advanced query tuning (8 fields). Persisted in data.json so each
      // plugin reload restores the user-chosen mode / provider / threshold values.
      advancedQueryTuningEnabled: this.settings.advancedQueryTuningEnabled,
      advancedQueryTuningMode: this.settings.advancedQueryTuningMode,
      advancedQueryTuningTimeoutMs: this.settings.advancedQueryTuningTimeoutMs,
      advancedQueryTuningCacheSize: this.settings.advancedQueryTuningCacheSize,
      advancedQueryTuningProvider: this.settings.advancedQueryTuningProvider,
      advancedQueryTuningModel: this.settings.advancedQueryTuningModel,
      advancedQueryTuningTemperature: this.settings.advancedQueryTuningTemperature,
      advancedQueryTuningMaxTokens: this.settings.advancedQueryTuningMaxTokens,
      advancedQueryTuningAutoExtendThreshold: this.settings.advancedQueryTuningAutoExtendThreshold,
      advancedQueryTuningLastAnalyzedIndex: this.settings.advancedQueryTuningLastAnalyzedIndex,
      // §5.7.7 cycle #3 codex HIGH #2 fix — Hybrid search persistence (data.json).
      // 이전 cycle 누락 — Settings 토글 후 reload 시 default OFF 으로 회복하던 회귀.
      searchHybridEnabled: this.settings.searchHybridEnabled,
      searchRrfK: this.settings.searchRrfK,
      searchQwen3DownloadStatus: this.settings.searchQwen3DownloadStatus,
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
      this.commitChatSave()
    }, 2000)
  }

  /**
   * §5.7.8 — synchronous chat-save commit. Used both by the 2s debounce timer (above)
   * and by `maybeTriggerAutoExtend` to flush any pending pair durable-save *before*
   * advancing the auto-extend cursor — avoiding the race where a crash leaves the
   * cursor advanced but the (query, answer) pair window unsaved (Cycle #2 F1 fix).
   */
  private commitChatSave(): Promise<void> {
    if (this.chatSaveTimer) {
      clearTimeout(this.chatSaveTimer)
      this.chatSaveTimer = null
    }
    if (!this.settings.persistChatHistory) return Promise.resolve()
    const MAX = 100
    const trimmed = this.chatHistory.length > MAX ? this.chatHistory.slice(-MAX) : [...this.chatHistory]
    this.settings = { ...this.settings, savedChatHistory: trimmed }
    return Promise.resolve(this.saveData(this.buildPluginOnlyData())).then(() => undefined)
  }

  /**
   * §5.7.8 Spec 3 — extract `(query, answer)` pairs from the in-memory chat history.
   * Pairs are formed by adjacent `user` → `assistant` messages; orphans are skipped.
   *
   * Cycle #3 F2 fix — accepts a `fromIndex` cursor so callers can request only the
   * post-cursor window. Without this, the auto-extend trigger would re-feed every
   * already-analysed pair into the LLM after each cursor advance.
   */
  collectChatPairs(fromIndex: number = 0): QueryAnswerPair[] {
    const pairs: QueryAnswerPair[] = []
    const start = Math.max(0, fromIndex)
    for (let i = start; i < this.chatHistory.length - 1; i += 1) {
      const cur = this.chatHistory[i]
      const next = this.chatHistory[i + 1]
      if (cur.role === 'user' && next.role === 'assistant' && cur.content.trim() && next.content.trim()) {
        pairs.push({ query: cur.content.trim(), answer: next.content.trim() })
      }
    }
    return pairs
  }

  /**
   * §5.7.8 — vault-local auto-extended suite. Lives at `<vault>/.wikey/auto-extended-suite.json`
   * so the 51-query `wikey-core/eval/benchmark-suite.json` baseline (committed, regression
   * gate) is never mutated by runtime usage. Both files share the runner schema, so a
   * future merge step can union them.
   */
  private autoExtendedSuiteAbsolutePath(): string {
    const path = require('node:path') as typeof import('node:path')
    return path.join(this.basePath, '.wikey', 'auto-extended-suite.json')
  }

  /**
   * Ensure the auto-extended suite file exists with the runner-compatible shape so that
   * `appendEntriesToSuite` can mutate it without bootstrapping logic each call.
   */
  private ensureAutoExtendedSuite(suitePath: string): void {
    const fs = require('node:fs') as typeof import('node:fs')
    const path = require('node:path') as typeof import('node:path')
    if (fs.existsSync(suitePath)) return
    fs.mkdirSync(path.dirname(suitePath), { recursive: true })
    fs.writeFileSync(
      suitePath,
      JSON.stringify({
        version: 1,
        collection: 'wikey-wiki',
        created: new Date().toISOString().slice(0, 10),
        _doc: '§5.7.8 Spec 3 — auto-extended benchmark entries from real chat sessions. Mirrors the runner schema so it can be unioned with the canonical 51-query suite.',
        queries: [],
      }, null, 2),
      'utf-8',
    )
  }

  /**
   * §5.7.8 Spec 3 + AC-S4 — run the LLM analyzer on accumulated chat pairs and append
   * any returned entries to the **vault-local** auto-extended suite. The 51-query
   * canonical baseline at `wikey-core/eval/benchmark-suite.json` is never mutated.
   *
   * Provider/model resolution (Cycle #1 F1):
   *   - When the user has not chosen an override (advancedQueryTuningProvider/Model
   *     both empty), `resolveProvider('default', config)` inherits the vault's basic
   *     model — so a user with `basicModel='ollama'` runs the analyzer locally.
   *   - When the override is set, the explicit provider/model is honoured (BYOAI).
   *
   * Cycle #3 fixes:
   *   - F1: returns `RunQueryAnalysisResult` (the analyzer output **plus** the
   *     append outcome and entriesAppended count) so `maybeTriggerAutoExtend` reads
   *     its own run's outcome — no plugin-global field, no race when concurrent
   *     auto-extend runs overlap.
   *   - F2: accepts `fromIndex` cursor and forwards to `collectChatPairs`. The
   *     auto-extend trigger now passes the high-water mark so previously analysed
   *     pairs do not enter the LLM again.
   *
   * Cycle #6 F1 — optional `generationToken`. When supplied (auto-extend path), the
   * analyzer re-checks the token immediately before mutating the vault suite file or
   * showing a Notice. A `clearChat()` (or other invalidation) between dispatch and
   * analyzer resolution drifts the live counter; the side effects are skipped and the
   * caller receives `fallback='invalidated'` + `appendOutcome='skipped'`. Manual
   * triggers (commands.ts / settings-tab.ts) omit the token and always run end-to-end.
   *
   * Fail-open: any analyzer or filesystem error is swallowed + Notice + console.warn.
   */
  async runQueryAnalysis(
    suitePath?: string,
    fromIndex?: number,
    generationToken?: GenerationToken,
  ): Promise<RunQueryAnalysisResult> {
    const pairs = this.collectChatPairs(fromIndex)
    if (pairs.length === 0) {
      new Notice('[Wikey] No (query, answer) pairs in chat history to analyze.')
      return {
        entries: [],
        fallback: 'none',
        latencyMs: 0,
        appendOutcome: 'no-entries',
        entriesAppended: 0,
      }
    }
    // Vault override → bundled fallback. Spec 6 lets users ship their own prompt at
    // `.wikey/prompts/query-analyzer.prompt.md`; absent, the inlined bundle is used.
    let promptTemplate = BUNDLED_QUERY_ANALYZER_PROMPT
    try {
      const overridePath = '.wikey/prompts/query-analyzer.prompt.md'
      if (await this.wikiFS.exists(overridePath)) {
        promptTemplate = await this.wikiFS.read(overridePath)
      }
    } catch (err) {
      console.warn('[Wikey] query-analyzer prompt override read failed, using bundled:', err)
    }
    const callOptions = this.buildFilterCallOptions()
    const analyzer = new QueryAnalyzer({
      llm: this.buildFilterLLMClient(),
      promptTemplate,
      llmCallOptions: callOptions,
    })
    let result: AnalyzeResult
    try {
      result = await analyzer.analyze(pairs)
    } catch (err) {
      console.warn('[Wikey] runQueryAnalysis analyzer threw:', err)
      new Notice('[Wikey] Query analysis failed — see console.')
      return {
        entries: [],
        fallback: 'llm-fail',
        latencyMs: 0,
        appendOutcome: 'no-entries',
        entriesAppended: 0,
      }
    }
    // Cycle #6 F1 — re-check generation **before** any side effect. If the dispatch
    // generation has drifted (e.g. clearChat() bumped the counter), skip the suite
    // append + Notice and surface `'invalidated'` + `'skipped'` to the caller. Vault
    // file is left untouched; the user does not see a stale "X queries analyzed" toast
    // for a session they already cleared.
    if (generationToken && generationToken.gen !== generationToken.current()) {
      console.info(
        `[Wikey] auto-extend invalidated before append (gen ${generationToken.gen} != ${generationToken.current()}); skip suite mutation + Notice.`,
      )
      return {
        entries: result.entries,
        fallback: 'invalidated',
        latencyMs: result.latencyMs,
        appendOutcome: 'skipped',
        entriesAppended: 0,
      }
    }
    // Default suite path — vault-local auto-extended file. Caller may still override.
    const targetSuite = suitePath ?? this.autoExtendedSuiteAbsolutePath()
    let added = 0
    let appendOutcome: SuiteAppendOutcome = 'no-entries'
    if (result.entries.length > 0) {
      try {
        this.ensureAutoExtendedSuite(targetSuite)
        added = appendEntriesToSuite(targetSuite, result.entries).added
        appendOutcome = 'ok'
      } catch (err) {
        console.warn('[Wikey] appendEntriesToSuite failed:', err)
        appendOutcome = 'append-error'
      }
    }
    new Notice(
      `[Wikey] Query analysis: ${pairs.length} pairs analyzed, ${result.entries.length} entries, ${added} added to suite.`,
    )
    return {
      entries: result.entries,
      fallback: result.fallback,
      latencyMs: result.latencyMs,
      appendOutcome,
      entriesAppended: added,
    }
  }

  /**
   * §5.7.8 Spec 3 I11 — auto-extend trigger. Called after each chat completion. Counts
   * (query, answer) pairs accumulated since the last analysis and, when the threshold
   * is reached, kicks off a fire-and-forget analyzer run.
   *
   * Cursor advancement (Cycle #2 F1 fix):
   *   - The cursor advances **only when the analyzer reports success**
   *     (`fallback === 'none'`). On `'llm-fail'` / `'timeout'` / append errors the
   *     window of pairs stays available for the next attempt.
   *   - Before advancing the cursor we flush any pending chat-save debounce so the
   *     pair-window is durably persisted *before* the cursor move — avoiding the
   *     crash race where a cursor moves past pairs that were never written to disk.
   *
   * Fail-open: catches every error path + warns; never throws (Spec invariant I8).
   */
  maybeTriggerAutoExtend(): void {
    if (!this.settings.advancedQueryTuningEnabled) return
    if (this.settings.advancedQueryTuningMode === 'off') return

    // Cycle #4 F1 / Cycle #5 F1 (c) defensive — reset the cursor when it has run past
    // chatHistory.length (loadSettings cap missed, external data.json edit) AND when a
    // chat reset wiped history but a stale (non-zero) cursor remains. Both states leave
    // the trigger silently disabled.
    let cursor = this.settings.advancedQueryTuningLastAnalyzedIndex
    const cursorOutOfRange = cursor > this.chatHistory.length
    const cursorLeftBehind = this.chatHistory.length === 0 && cursor !== 0
    if (cursorOutOfRange || cursorLeftBehind) {
      console.warn(
        `[Wikey] auto-extend cursor (${cursor}) inconsistent with chatHistory.length (${this.chatHistory.length}); resetting to 0.`,
      )
      cursor = 0
      this.settings = { ...this.settings, advancedQueryTuningLastAnalyzedIndex: 0 }
      void this.saveData(this.buildPluginOnlyData())
    }
    const newPairs = countQueryAnswerPairs(this.chatHistory, cursor)
    const threshold = Math.max(1, this.settings.advancedQueryTuningAutoExtendThreshold || 5)
    if (newPairs < threshold) return

    const snapshotLength = this.chatHistory.length
    // Cycle #5 F1 (a) — capture the generation at dispatch time. If `clearChat` (or any
    // future invalidation) bumps `autoExtendGeneration` while this run is in flight,
    // the success path will see a mismatch and exit without writing the cursor.
    const myGen = ++this.autoExtendGeneration
    // Cycle #6 F1 — pass the generation token through to `runQueryAnalysis` so the
    // suite mutation + Notice are also skipped on invalidation, not just the cursor
    // write. `current` is a closure that reads the *live* counter at the moment the
    // analyzer is about to mutate the vault file.
    const generationToken: GenerationToken = {
      gen: myGen,
      current: () => this.autoExtendGeneration,
    }
    // Cycle #3 F2 — pass the cursor so the analyzer only sees pairs accumulated since
    // the last successful run. Cycle #3 F1 — read the append outcome from the per-call
    // return value (no plugin-global field; concurrent runs do not interfere).
    void this.runQueryAnalysis(undefined, cursor, generationToken)
      .then(async (result) => {
        // Cycle #5 F1 (a) — invalidation guard. A `clearChat()` (or any other event that
        // bumps the generation counter) between dispatch and resolution means this run's
        // snapshot no longer reflects the live history. Drop silently.
        if (myGen !== this.autoExtendGeneration) {
          console.info(
            `[Wikey] auto-extend run invalidated (gen ${myGen} != ${this.autoExtendGeneration}); cursor unchanged.`,
          )
          return
        }
        if (!shouldAdvanceAutoExtendCursor(result.fallback, result.appendOutcome)) {
          console.info(
            `[Wikey] auto-extend skipped cursor advance (fallback=${result.fallback}, append=${result.appendOutcome}); window preserved.`,
          )
          return
        }
        // Flush any pending chat-save debounce *before* moving the cursor. This avoids
        // a crash race where the cursor lands ahead of an unsaved pair window.
        try { await this.commitChatSave() } catch { /* best-effort */ }
        // Cycle #5 F1 (b) — monotonic guard. With overlapping runs, a slow earlier run
        // could otherwise resolve after a faster later run and clobber the cursor with
        // a smaller value. We only advance when the new snapshot is strictly greater
        // than the persisted cursor.
        const currentCursor = this.settings.advancedQueryTuningLastAnalyzedIndex
        if (snapshotLength <= currentCursor) {
          console.info(
            `[Wikey] auto-extend cursor regression skipped (snapshot=${snapshotLength}, cursor=${currentCursor}); monotonic invariant preserved.`,
          )
          return
        }
        this.settings = {
          ...this.settings,
          advancedQueryTuningLastAnalyzedIndex: snapshotLength,
        }
        await this.saveData(this.buildPluginOnlyData())
      })
      .catch((err) => {
        console.warn('[Wikey] auto-extend background run failed:', err)
      })
  }

  /**
   * §5.7.8 Spec 2 / Spec 4 / Spec 6 — build the per-call `QueryOptions` overlay that
   * routes the query through the LLM filter / rewriter / expander layers.
   *
   *  - Returns an empty object when the master toggle is OFF, mode='off', or the
   *    caller passed `skipFilter` (e.g. `!nofilter` per-query override). This preserves
   *    the legacy single-query BM25 path (Spec invariant I7).
   *  - Each layer is constructed lazily; provider / model / temperature / maxTokens
   *    changes invalidate the cached instances via the LLM signature.
   *  - Vault config is loaded once and reused. Both `.wikey/query-filter.yaml` and
   *    the optional `.wikey/prompts/*.prompt.md` overrides are honoured.
   *  - All construction failures are swallowed + logged (Spec invariant I8 — search
   *    must never error out because of layer setup).
   */
  async getQueryLayerOpts(skipFilter = false): Promise<{
    filter?: QueryIntentFilter
    rewriter?: QueryRewriter
    expander?: QueryExpander
    vaultHint?: VaultQueryHint
  }> {
    if (skipFilter) return {}
    if (!this.settings.advancedQueryTuningEnabled) return {}
    if (this.settings.advancedQueryTuningMode === 'off') return {}

    try {
      const cache = this.ensureQueryFilterCache()
      const filterLLM = this.buildFilterLLMClient()
      const signature = this.computeFilterLLMSignature()
      if (signature !== this.queryFilterLLMSignature) {
        this.queryFilterInstance = null
        this.queryRewriterInstance = null
        this.queryExpanderInstance = null
        this.queryFilterLLMSignature = signature
      }

      const vaultConfig = await this.ensureVaultQueryConfig()
      const callOptions = this.buildFilterCallOptions()
      const filter = (this.queryFilterInstance ??= new QueryIntentFilter({
        llm: filterLLM,
        cache,
        promptTemplate: vaultConfig.filterPromptOverride ?? BUNDLED_QUERY_INTENT_FILTER_PROMPT,
        tokenize: (q: string) => q.split(/\s+/u).filter((t) => t.length > 0),
        llmCallOptions: callOptions,
        timeoutMs: this.settings.advancedQueryTuningTimeoutMs,
      }))

      const mode = this.settings.advancedQueryTuningMode
      let rewriter: QueryRewriter | undefined
      let expander: QueryExpander | undefined

      if (mode === 'filter-rewrite' || mode === 'filter-rewrite-expand') {
        rewriter = (this.queryRewriterInstance ??= new QueryRewriter({
          llm: filterLLM,
          cache,
          promptTemplate: vaultConfig.rewriterPromptOverride ?? BUNDLED_QUERY_REWRITER_PROMPT,
          llmCallOptions: callOptions,
          timeoutMs: this.settings.advancedQueryTuningTimeoutMs,
        }))
      }
      if (mode === 'filter-rewrite-expand') {
        expander = (this.queryExpanderInstance ??= new QueryExpander({
          llm: filterLLM,
          cache,
          promptTemplate: vaultConfig.expanderPromptOverride ?? BUNDLED_QUERY_EXPANDER_PROMPT,
          llmCallOptions: callOptions,
          timeoutMs: this.settings.advancedQueryTuningTimeoutMs,
        }))
      }

      return { filter, rewriter, expander, vaultHint: vaultConfig.hint }
    } catch (err) {
      // I8 fail-open — layer setup failure must not block search.
      console.warn('[Wikey] getQueryLayerOpts setup failed, falling back to legacy path:', err)
      return {}
    }
  }

  /**
   * §5.7.8 Spec 4 + Finding 1 fix (Cycle #1) — thin wrapper over the pure
   * `buildFilterCallOptionsFromSettings` helper (Cycle #2 F2 fix).
   * Logic + tests live with the helper; this method only forwards plugin state.
   */
  private buildFilterCallOptions(): FilterCallOptionsResult {
    return buildFilterCallOptionsFromSettings(this.settings, this.buildConfig())
  }

  /**
   * §5.7.8 — compute a string signature of the filter-LLM-affecting settings. When the
   * user changes provider / model / temperature / maxTokens / timeout, the cached
   * `QueryIntentFilter` (etc.) instances are invalidated so the next query rebuilds them.
   */
  private computeFilterLLMSignature(): string {
    return [
      this.settings.advancedQueryTuningProvider,
      this.settings.advancedQueryTuningModel,
      this.settings.advancedQueryTuningTemperature,
      this.settings.advancedQueryTuningMaxTokens,
      this.settings.advancedQueryTuningTimeoutMs,
    ].join('|')
  }

  /** Lazy-init the per-namespace LRU cache rooted at `~/.cache/wikey/query-intent-cache`. */
  private ensureQueryFilterCache(): QueryFilterCache {
    const capacity = Math.max(1, this.settings.advancedQueryTuningCacheSize || 1000)
    if (!this.queryFilterCache || capacity !== this.queryFilterCacheCapacity) {
      const os = require('node:os') as typeof import('node:os')
      const path = require('node:path') as typeof import('node:path')
      const root = path.join(os.homedir(), '.cache', 'wikey', 'query-intent-cache')
      this.queryFilterCache = new QueryFilterCache({ root, capacity })
      this.queryFilterCacheCapacity = capacity
    }
    return this.queryFilterCache
  }

  /**
   * Build the filter-specific LLMClient. When the user chose a provider/model override
   * we route through a *separate* LLMClient instance so other wikey LLM call sites
   * (canonicalizer, ingest, answer synthesis) keep their own providers (Spec I19).
   */
  private buildFilterLLMClient(): LLMClient {
    const providerOverride = this.settings.advancedQueryTuningProvider
    const modelOverride = this.settings.advancedQueryTuningModel
    if (!providerOverride && !modelOverride) return this.llmClient
    const baseConfig = this.buildConfig()
    const overriddenConfig: WikeyConfig = {
      ...baseConfig,
      WIKEY_BASIC_MODEL: providerOverride || baseConfig.WIKEY_BASIC_MODEL,
      WIKEY_MODEL: modelOverride || baseConfig.WIKEY_MODEL,
    }
    return new LLMClient(this.httpClient, overriddenConfig)
  }

  /** Cache the vault `.wikey/query-filter.yaml` + prompt overrides for the session. */
  private async ensureVaultQueryConfig(): Promise<LoadVaultQueryConfigResult> {
    if (this.vaultQueryConfigCache) return this.vaultQueryConfigCache
    try {
      this.vaultQueryConfigCache = await loadVaultQueryConfig({
        exists: (p: string) => this.wikiFS.exists(p),
        read: (p: string) => this.wikiFS.read(p),
      })
    } catch (err) {
      console.warn('[Wikey] loadVaultQueryConfig failed, using empty hint:', err)
      this.vaultQueryConfigCache = {
        hint: EMPTY_VAULT_QUERY_HINT,
      }
    }
    return this.vaultQueryConfigCache
  }

  buildConfig(): WikeyConfig {
    // Effective provider for ingest: ingestProvider → basicModel fallback
    const effectiveProvider = (this.settings.ingestProvider || this.settings.basicModel || 'ollama').toLowerCase()
    // Model validation: drop ingestModel if it doesn't match the effective provider.
    // Empty string lets wikey-core resolveProvider pick provider-default (e.g. gemini-2.5-flash).
    const rawModel = this.settings.ingestModel || this.settings.cloudModel || ''
    const validatedModel = isModelCompatible(rawModel, effectiveProvider) ? rawModel : ''
    // §5.7.4 — search engine override priority: process.env > wikey.conf > DEFAULTS('orama')
    const envEngine = process.env.WIKEY_SEARCH_ENGINE
    const searchEngine: 'orama' | 'qmd' =
      envEngine === 'orama' || envEngine === 'qmd' ? envEngine : this.settings.searchEngine
    // §5.7.7 cycle #2 codex HIGH #1 fix — hybrid wiring config bridge.
    // settings.searchHybridEnabled → WIKEY_HYBRID_MODE 'on'|'off' (env override priority).
    // settings.searchRrfK → WIKEY_RRF_K (default 60, I12 settings UI customizable).
    // §5.7.7 cycle #5 codex HIGH #1 fix — Q9 sub-control invariant (I16): hybrid 는
    // master toggle (advancedQueryTuningEnabled) ON 시에만 effective. 사용자 mental
    // model "Hybrid 는 Advanced query tuning 의 sub-control" 일관 — UI 가 hide 시
    // 효과도 OFF.
    // §5.7.7 cycle #6 codex HIGH #1 fix — env 'on' 으로 master gate bypass 회피.
    // env 는 force-OFF 만 가능 (안전한 disable). force-ON 시도해도 master 가 OFF 면
    // effective OFF. CLI 등 외부에서 hybrid 강제 활성 의도면 master toggle 도 ON 의무.
    const envHybrid = process.env.WIKEY_HYBRID_MODE
    const effectiveHybrid =
      this.settings.advancedQueryTuningEnabled && this.settings.searchHybridEnabled
    const hybridMode: 'on' | 'off' =
      envHybrid === 'off' ? 'off' : effectiveHybrid ? 'on' : 'off'
    const envRrfK = process.env.WIKEY_RRF_K
    const rrfKParsed = envRrfK ? Number.parseInt(envRrfK, 10) : (this.settings.searchRrfK ?? 60)
    const rrfK = Number.isFinite(rrfKParsed) && rrfKParsed > 0 ? rrfKParsed : 60
    return {
      WIKEY_BASIC_MODEL: this.settings.basicModel,
      WIKEY_SEARCH_BACKEND: 'basic',
      WIKEY_SEARCH_ENGINE: searchEngine,
      WIKEY_HYBRID_MODE: hybridMode,
      WIKEY_RRF_K: rrfK,
      WIKEY_MODEL: validatedModel,
      WIKEY_QMD_TOP_N: 5,
      WIKEY_SEARCH_TOP_N: 5,
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
      WIKEY_EXTRACTION_DETERMINISM: this.settings.extractionDeterminism || undefined,
    }
  }

  async activateChatView() {
    const existing = this.app.workspace.getLeavesOfType(WIKEY_CHAT_VIEW)
    if (existing.length > 0) {
      this.app.workspace.revealLeaf(existing[0])
      await this.applyInitialSidebarWidth()
      return
    }

    const leaf = this.app.workspace.getRightLeaf(false)
    if (leaf) {
      await leaf.setViewState({ type: WIKEY_CHAT_VIEW, active: true })
      this.app.workspace.revealLeaf(leaf)
      await this.applyInitialSidebarWidth()
    }
  }

  private async applyInitialSidebarWidth() {
    if (this.settings.initialSidebarWidthApplied) return
    ;(this.app.workspace as any).rightSplit?.setSize?.(500)
    this.settings = { ...this.settings, initialSidebarWidthApplied: true }
    await this.saveSettings()
  }
}

class ObsidianWikiFS implements WikiFS {
  constructor(private readonly plugin: WikeyPlugin) {}

  async read(path: string): Promise<string> {
    const file = this.plugin.app.vault.getAbstractFileByPath(path)
    if (file) return this.plugin.app.vault.read(file as any)
    // Hidden folders (e.g. .wikey/) are not indexed by Obsidian's vault — fall back to adapter
    const { adapter } = this.plugin.app.vault
    if (await adapter.exists(path)) return adapter.read(path)
    throw new Error(`File not found: ${path}`)
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
    if (this.plugin.app.vault.getAbstractFileByPath(path) !== null) return true
    // Hidden folders (e.g. .wikey/) bypass Obsidian's vault metadata — check adapter
    return this.plugin.app.vault.adapter.exists(path)
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

    // §5.15.E F2: Obsidian requestUrl 은 timeout 옵션 미지원 → Promise.race + setTimeout
    // 으로 caller-side timeout 적용. background fetch 는 계속 진행 (Obsidian internal abort
    // 미가용) 하지만 ingest pipeline 은 명확한 Error throw 받아 fail 처리 가능.
    const timeoutMs = opts.timeout ?? 300_000
    let timer: ReturnType<typeof setTimeout> | undefined
    const requestPromise = requestUrl({
      url,
      method: opts.method,
      headers: opts.headers as Record<string, string>,
      body: opts.body,
    })
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`HTTP request timeout after ${timeoutMs}ms: ${url}`)),
        timeoutMs,
      )
    })
    try {
      const response = await Promise.race([requestPromise, timeoutPromise])
      return {
        status: response.status,
        body: typeof response.text === 'string' ? response.text : JSON.stringify(response.json),
      }
    } finally {
      if (timer) clearTimeout(timer)
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
