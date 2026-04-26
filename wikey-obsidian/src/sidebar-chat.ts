import { ItemView, MarkdownRenderer, Notice, WorkspaceLeaf } from 'obsidian'
import type WikeyPlugin from './main'
import {
  query, resolveProvider, classifyFile, classifyFileAsync, moveFile, movePair,
  fetchModelList,
  resolveSourceSync, loadRegistry,
  pairedSidecarSet, hasSidecar, filterOutPairedSidecars,
  recountAuditAfterPairedExclude,
  buildSuggestionCardModel, acceptSuggestion, rejectSuggestionFromPanel,
  appendStandardDecomposition,
  emptyStore,
} from 'wikey-core'
import type {
  Citation, ResolvedSource, SourceRegistry,
  Suggestion, SuggestionStore,
} from 'wikey-core'
import { runIngest, IngestFileSuggestModal } from './commands'
import type { IngestRunResult } from './commands'

export const WIKEY_CHAT_VIEW = 'wikey-chat'

interface ChatMessage {
  readonly role: 'user' | 'assistant' | 'error'
  readonly content: string
  /** §4.3.2 Part B: assistant 메시지에 첨부된 page→sourceIds 매핑. */
  readonly citations?: readonly Citation[]
}

// Bootstrap SVG icons (inline, 16x16)
const ICONS = {
  chat: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M2.678 11.894a1 1 0 0 1 .287.801 11 11 0 0 1-.398 2c1.395-.323 2.247-.697 2.634-.893a1 1 0 0 1 .71-.074A8 8 0 0 0 8 14c3.996 0 7-2.807 7-6s-3.004-6-7-6-7 2.808-7 6c0 1.468.617 2.83 1.678 3.894m-.493 3.905a22 22 0 0 1-.713.129c-.2.032-.352-.176-.273-.362a10 10 0 0 0 .244-.637l.003-.01c.248-.72.45-1.548.524-2.319C.743 11.37 0 9.76 0 8c0-3.866 3.582-7 8-7s8 3.134 8 7-3.582 7-8 7a9 9 0 0 1-2.347-.306c-.52.263-1.639.742-3.468 1.105"/></svg>',
  dashboard: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M4 11H2v3h2zm5-4H7v7h2zm5-5v12h-2V2zm-2-1a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zM6 7a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1zm-5 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1z"/></svg>',
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

type PanelName = 'chat' | 'dashboard' | 'audit' | 'ingest' | 'help' | 'suggestions'

const PROVIDER_PRETTY_NAMES: Readonly<Record<string, string>> = {
  gemini: 'Google Gemini',
  anthropic: 'Anthropic Claude',
  'claude-code': 'Anthropic Claude',
  openai: 'OpenAI Codex',
  ollama: 'Local (Ollama)',
}

function prettyProvider(p: string): string {
  return PROVIDER_PRETTY_NAMES[p] ?? p
}

const PROVIDER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'ollama', label: 'Local (Ollama)' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'anthropic', label: 'Anthropic Claude' },
  { value: 'openai', label: 'OpenAI Codex' },
  { value: 'claude-code', label: 'Anthropic Claude' },
]

/**
 * Row progress with chunk-level subStep interpolation.
 *
 * Step weights: [0, 5, 80, 90, 100]  (Reading → LLM → Creating → Indexing)
 * When step 2 (LLM) reports subStep/subTotal (e.g. chunk i of N), interpolate
 * between 5% and 80% so long documents show smooth progress instead of being
 * stuck at the step-2 flat weight.
 */
/**
 * §4.3.2 Part B — citation 보조 링크 버튼 factory.
 * CSS (`.wikey-citation-link`) 가 크기·투명도·간격을 제어. UI 레이어 분리.
 */
function buildCitationButton(resolved: ResolvedSource): HTMLElement {
  const btn = document.createElement('a') as HTMLAnchorElement
  btn.className = 'wikey-citation-link'
  btn.textContent = '📄'
  const filename = resolved.displayLabel.split('/').pop() ?? resolved.displayLabel
  if (resolved.tombstoned) {
    btn.classList.add('wikey-citation-tombstone')
    btn.setAttribute('aria-label', `원본 삭제됨: ${filename}`)
    btn.setAttribute('title', `${filename} (registry tombstone)`)
  } else {
    btn.setAttribute('aria-label', `원본 파일 열기: ${filename}`)
    btn.setAttribute('title', filename)
  }
  if (resolved.openUri) btn.setAttribute('data-href', resolved.openUri)
  return btn
}

function computeRowPct(step: number, subStep?: number, subTotal?: number): number {
  const weights = [0, 5, 80, 90, 100]
  if (step === 2 && subStep != null && subTotal && subTotal > 0) {
    const fraction = Math.min(1, Math.max(0, subStep / subTotal))
    return Math.round(weights[1] + (weights[2] - weights[1]) * fraction)
  }
  return weights[step] ?? Math.round((step / 4) * 100)
}

export class WikeyChatView extends ItemView {
  private messagesEl!: HTMLElement
  private inputEl!: HTMLTextAreaElement
  private sendBtn!: HTMLButtonElement
  private ingestPanel: HTMLElement | null = null
  private activePanel: PanelName = 'chat'
  private panelBtns: Record<string, HTMLElement> = {}
  private inputWrapper!: HTMLElement
  private modelRow!: HTMLElement
  private providerSelect!: HTMLSelectElement
  private modelSelect!: HTMLSelectElement
  private readonlyModelBar!: HTMLElement

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: WikeyPlugin,
  ) {
    super(leaf)
  }

  getViewType(): string { return WIKEY_CHAT_VIEW }
  getDisplayText(): string { return 'Wikey' }
  getIcon(): string { return 'book-open' }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement
    container.empty()
    container.addClass('wikey-chat-container')

    // ── Header ──
    const header = container.createDiv({ cls: 'wikey-chat-header' })
    header.createEl('span', { text: 'Wikey', cls: 'wikey-chat-title' })
    const actions = header.createDiv({ cls: 'wikey-chat-header-actions' })

    this.panelBtns.chat = this.makeHeaderBtn(actions, ICONS.chat, 'Chat', () => this.selectPanel('chat'))
    this.panelBtns.dashboard = this.makeHeaderBtn(actions, ICONS.dashboard, 'Dashboard', () => this.selectPanel('dashboard'))
    this.panelBtns.ingest = this.makeHeaderBtn(actions, ICONS.plus, 'Ingest', () => this.selectPanel('ingest'))
    this.panelBtns.audit = this.makeHeaderBtn(actions, ICONS.audit, 'Audit', () => this.selectPanel('audit'))
    this.panelBtns.help = this.makeHeaderBtn(actions, ICONS.question, 'Help', () => this.selectPanel('help'))
    this.makeHeaderBtn(actions, ICONS.reload, 'Reload', () => (this.app as any).commands?.executeCommandById?.('app:reload'))
    this.makeHeaderBtn(actions, ICONS.close, 'Close', () => this.leaf.detach())

    // ── Messages ──
    this.messagesEl = container.createDiv({ cls: 'wikey-chat-messages' })
    for (const msg of this.plugin.chatHistory) this.renderMessage(msg)

    // ── Input Area (chat 패널 전용) ──
    this.inputWrapper = container.createDiv({ cls: 'wikey-chat-input-wrapper' })
    const inputArea = this.inputWrapper.createDiv({ cls: 'wikey-chat-input-area' })

    this.inputEl = inputArea.createEl('textarea', {
      cls: 'wikey-chat-input',
      attr: { placeholder: 'Ask a question… (type /clear to reset)', rows: '3' },
    })

    this.sendBtn = inputArea.createEl('button', { cls: 'wikey-chat-send-btn' })
    this.sendBtn.innerHTML = ICONS.send

    this.inputEl.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.handleSend() }
    })
    this.sendBtn.addEventListener('click', () => this.handleSend())

    // ── Model Row (provider + model select, chat/audit/ingest 공용) ──
    this.modelRow = container.createDiv({ cls: 'wikey-chat-model-row' })
    const config = this.plugin.buildConfig()
    const { provider, model: currentModel } = resolveProvider('default', config)

    this.modelRow.createEl('span', { text: 'AI Model', cls: 'wikey-chat-model-label' })
    this.modelRow.createEl('span', { text: ':', cls: 'wikey-chat-model-sep' })

    this.providerSelect = this.modelRow.createEl('select', { cls: 'wikey-select wikey-chat-provider-select' })
    for (const opt of PROVIDER_OPTIONS) {
      const o = this.providerSelect.createEl('option', { text: opt.label, attr: { value: opt.value } })
      if (opt.value === provider) o.selected = true
    }
    this.modelRow.createEl('span', { text: '\u2014', cls: 'wikey-chat-model-sep' })

    this.modelSelect = this.modelRow.createEl('select', { cls: 'wikey-select' })
    const savedModel = this.plugin.settings.cloudModel || currentModel
    this.modelSelect.createEl('option', { text: savedModel, attr: { value: savedModel } })

    this.providerSelect.addEventListener('change', async () => {
      const newProvider = this.providerSelect.value
      this.plugin.settings.basicModel = newProvider
      this.plugin.settings.cloudModel = ''
      if (!this.plugin.settings.ingestProvider) this.plugin.settings.ingestModel = ''
      await this.plugin.saveSettings()
      this.modelSelect.empty()
      this.modelSelect.createEl('option', { text: '(loading…)', attr: { value: '' } })
      await this.loadModelList(newProvider, this.modelSelect, '')
      this.plugin.settings.cloudModel = this.modelSelect.value
      await this.plugin.saveSettings()
      this.refreshReadonlyModelBar()
    })

    this.modelSelect.addEventListener('change', async () => {
      this.plugin.settings.cloudModel = this.modelSelect.value
      await this.plugin.saveSettings()
      this.refreshReadonlyModelBar()
    })

    this.loadModelList(provider, this.modelSelect, savedModel)

    // ── Readonly Model Bar (비-chat 패널 전용) ──
    this.readonlyModelBar = container.createDiv({ cls: 'wikey-readonly-model-bar' })
    this.refreshReadonlyModelBar()

    if (this.plugin.chatHistory.length === 0) this.showWelcome()
    this.applyPanelVisibility()
    this.updatePanelBtnStates()
  }

  private refreshReadonlyModelBar() {
    if (!this.readonlyModelBar) return
    this.readonlyModelBar.empty()
    const { provider, model } = resolveProvider('default', this.plugin.buildConfig())
    const effectiveModel = this.plugin.settings.cloudModel || model
    this.readonlyModelBar.createEl('span', { text: 'Default AI Model', cls: 'wikey-readonly-model-label' })
    this.readonlyModelBar.createEl('span', { text: ' : ' })
    this.readonlyModelBar.createEl('span', { text: prettyProvider(provider), cls: 'wikey-readonly-model-value' })
    this.readonlyModelBar.createEl('span', { text: ' | ' })
    this.readonlyModelBar.createEl('span', { text: effectiveModel, cls: 'wikey-readonly-model-value' })
  }

  private applyPanelVisibility() {
    const isChat = this.activePanel === 'chat'
    this.messagesEl.style.display = isChat ? '' : 'none'
    if (this.inputWrapper) this.inputWrapper.style.display = isChat ? '' : 'none'
    if (this.modelRow) this.modelRow.style.display = isChat ? '' : 'none'
    if (this.readonlyModelBar) {
      this.readonlyModelBar.style.display = isChat ? 'none' : ''
      if (!isChat) this.refreshReadonlyModelBar()
    }
  }

  async onClose() { /* cleanup */ }

  // ── Header Helpers ──

  private makeHeaderBtn(parent: HTMLElement, icon: string, label: string, onClick: () => void): HTMLElement {
    const btn = parent.createEl('button', { cls: 'wikey-header-btn', attr: { 'aria-label': label, title: label } })
    btn.innerHTML = icon
    btn.addEventListener('click', onClick)
    return btn
  }

  // ── Panel Select (exclusive, re-click = no-op) ──

  private selectPanel(name: PanelName) {
    if (this.activePanel === name) return
    this.closeActivePanel()
    this.activePanel = name
    if (name === 'dashboard') this.openDashboard()
    else if (name === 'audit') this.openAuditPanel()
    else if (name === 'ingest') this.openIngestPanel()
    else if (name === 'help') this.openHelp()
    else if (name === 'suggestions') this.openSuggestionsPanel()
    // chat: 별도 DOM 마운트 불필요 (messagesEl이 chat view 자체)
    this.updatePanelBtnStates()
    this.applyPanelVisibility()
    this.syncWelcomeVisibility()
  }

  private auditPanel: HTMLElement | null = null
  // §5.4.2 AC6 — Suggestions panel (extraction-graph driven standard candidates).
  private suggestionsPanel: HTMLElement | null = null

  private closeActivePanel() {
    if (this.dashboardPanel) {
      this.dashboardPanel.remove()
      this.dashboardPanel = null
    }
    if (this.auditPanel) {
      this.auditPanel.remove()
      this.auditPanel = null
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
    if (this.suggestionsPanel) {
      this.suggestionsPanel.remove()
      this.suggestionsPanel = null
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
    this.plugin.settings = { ...this.plugin.settings, savedChatHistory: [] }
    this.plugin.saveSettings()
    this.messagesEl.empty()
    if (this.activePanel !== 'chat') {
      this.closeActivePanel()
      this.activePanel = 'chat'
    }
    this.updatePanelBtnStates()
    this.applyPanelVisibility()
    this.showWelcome()
  }

  private showWelcome() {
    const w = this.messagesEl.createDiv({ cls: 'wikey-chat-welcome' })
    w.createEl('p', { text: 'Ask anything about your wiki.' })
    w.createEl('p', { text: 'e.g. "Key specs of DJI O3?", "Compare RAG vs LLM Wiki"', cls: 'wikey-chat-welcome-hint' })
  }

  /** 비-chat 패널이 열려 있으면 welcome 숨김, chat 복귀 + 대화 비어 있으면 복원 */
  private syncWelcomeVisibility() {
    const hasPanel = this.activePanel !== 'chat'
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

    if (question === '/clear') {
      this.inputEl.value = ''
      this.clearChat()
      return
    }

    this.messagesEl.querySelector('.wikey-chat-welcome')?.remove()

    const userMsg: ChatMessage = { role: 'user', content: question }
    this.plugin.chatHistory.push(userMsg)
    this.plugin.scheduleChatSave()
    this.renderMessage(userMsg)

    this.inputEl.value = ''
    this.setInputEnabled(false)

    const loadingEl = this.messagesEl.createDiv({ cls: 'wikey-chat-loading' })
    loadingEl.createEl('span', { text: 'Generating answer...' })
    this.scrollToBottom()

    try {
      const config = this.plugin.buildConfig()
      const basePath = (this.app.vault.adapter as any).basePath ?? ''
      const result = await query(question, config, this.plugin.httpClient, {
        basePath, wikiFS: this.plugin.wikiFS,
        execEnv: this.plugin.getExecEnv(),
        nodePath: this.plugin.settings.detectedNodePath,
        // §5.3 follow-up — 사용자 설정 (raw / sidecar / hidden)
        originalLinkMode: this.plugin.settings.originalLinkMode,
      })
      loadingEl.remove()
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: result.answer,
        citations: result.citations,
      }
      this.plugin.chatHistory.push(assistantMsg)
      this.plugin.scheduleChatSave()
      this.renderMessage(assistantMsg)
    } catch (err: any) {
      loadingEl.remove()
      console.error('[Wikey] query error:', err)
      let fullError: string
      if (err == null) fullError = '[Wikey] Unknown error'
      else if (err instanceof Error) fullError = `${err.name}: ${err.message}\n${err.stack ?? ''}`
      else if (typeof err === 'object') fullError = JSON.stringify(err, null, 2)
      else fullError = String(err)
      if (!fullError?.trim()) fullError = '[Wikey] Empty error — check Cmd+Option+I console'
      const errorMsg: ChatMessage = { role: 'error', content: fullError }
      this.plugin.chatHistory.push(errorMsg)
      this.plugin.scheduleChatSave()
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
      if (msg.citations && msg.citations.length > 0) {
        // Schedule after render so wikilinks are in DOM before citation attach.
        void this.attachCitationBacklinks(contentEl, msg.citations).catch((err) =>
          console.warn('[Wikey] citation attach failed:', err),
        )
      }
      this.addMessageActions(msgEl, msg.content)
    }

    this.scrollToBottom()
  }

  /**
   * §4.3.2 Part B — 각 wikilink 뒤에 원본 파일 보조 링크 (`📄`) 를 attach.
   * citation 없는 링크는 건드리지 않음. 한 페이지가 여러 source 에서 왔으면
   * 각 source 별 아이콘을 나란히 배치 (대부분 1개).
   */
  private async attachCitationBacklinks(
    container: HTMLElement,
    citations: readonly Citation[],
  ): Promise<void> {
    const byBase = new Map<string, Citation>()
    for (const c of citations) {
      const base = c.wikiPagePath.split('/').pop()?.replace(/\.md$/i, '').toLowerCase() ?? ''
      if (base) byBase.set(base, c)
    }
    if (byBase.size === 0) return

    const wikilinks = Array.from(container.querySelectorAll<HTMLAnchorElement>('a.internal-link'))
    if (wikilinks.length === 0) return

    let registry: SourceRegistry
    try {
      registry = await loadRegistry(this.plugin.wikiFS)
    } catch (err) {
      console.warn('[Wikey] loadRegistry failed for citations:', err)
      return
    }
    const vaultName = this.app.vault.getName()
    const basePath = (this.app.vault.adapter as any).basePath ?? undefined

    for (const link of wikilinks) {
      if (link.classList.contains('wikey-citation-attached')) continue
      const href = link.getAttribute('data-href') ?? link.textContent ?? ''
      const base = (href.split('/').pop() ?? '').replace(/\.md$/i, '').toLowerCase()
      const citation = byBase.get(base)
      if (!citation) continue

      for (const sourceId of citation.sourceIds) {
        const resolved = resolveSourceSync(sourceId, registry, { vaultName, absoluteBasePath: basePath })
        if (!resolved) continue
        const btn = buildCitationButton(resolved)
        btn.addEventListener('click', (e) => {
          e.preventDefault()
          e.stopPropagation()
          this.openResolvedSource(resolved)
        })
        link.insertAdjacentElement('afterend', btn)
        link.classList.add('wikey-citation-attached')
      }
    }
  }

  private openResolvedSource(resolved: ResolvedSource) {
    if (resolved.tombstoned) {
      new Notice(`원본 삭제됨 — ${resolved.displayLabel} (registry tombstone)`)
      return
    }
    if (!resolved.openUri) {
      new Notice('원본 경로를 확인할 수 없습니다 (registry 미등록)')
      return
    }
    try {
      if (resolved.kind === 'external') {
        // uri-hash:* ⇒ external URI (http(s)/file:/mailto:). window.open + noopener.
        window.open(resolved.openUri, '_blank', 'noopener')
        return
      }
      // Internal vault file: currentPath is vault-relative — Obsidian handles the routing.
      if (resolved.currentPath) {
        this.app.workspace.openLinkText(resolved.currentPath, '')
      } else {
        window.open(resolved.openUri, '_blank', 'noopener')
      }
    } catch (err) {
      console.error('[Wikey] openResolvedSource failed:', err)
      new Notice(`원본 열기 실패 — ${(err as Error).message}`)
    }
  }

  private addMessageActions(msgEl: HTMLElement, content: string) {
    const actions = msgEl.createDiv({ cls: 'wikey-msg-actions' })

    // Copy
    const copyBtn = this.makeActionBtn(actions, ICONS.clipboard, 'Copy')
    copyBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(content)
      new Notice('Copied')
      copyBtn.addClass('wikey-msg-action-active')
      setTimeout(() => copyBtn.removeClass('wikey-msg-action-active'), 1500)
    })

    // Thumbs up
    const upBtn = this.makeActionBtn(actions, ICONS.thumbUp, 'Like')
    upBtn.addEventListener('click', () => {
      this.saveFeedback(content, 'up')
      upBtn.addClass('wikey-msg-action-active')
      new Notice('Feedback saved')
    })

    // Thumbs down
    const downBtn = this.makeActionBtn(actions, ICONS.thumbDown, 'Dislike')
    downBtn.addEventListener('click', () => {
      this.saveFeedback(content, 'down')
      downBtn.addClass('wikey-msg-action-active')
      new Notice('Feedback saved')
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
    const helpMd = `## Wikey Guide

**Ask Questions**
Ask anything about your wiki in natural language.
e.g. "Key specs of DJI O3?", "Compare RAG vs LLM Wiki"

**Ingest** (Source → Wiki)
- \`Cmd+Shift+I\`: Ingest current note
- \`[+]\` button: Select or drag & drop files
- Add files to \`raw/inbox/\` → auto-detected

**Wikilinks**
Click [[page name]] in answers to navigate to the wiki page.

**Settings**
\`Cmd+,\` → Wikey tab to manage models, API keys, Ollama connection.`

    MarkdownRenderer.render(this.app, helpMd, helpEl, '', this.plugin)
  }

  // ── Suggestions (§5.4.2 Stage 2) ──

  private async loadSuggestionStoreFromVault(): Promise<SuggestionStore> {
    const path = '.wikey/suggestions.json'
    try {
      if (!(await this.plugin.wikiFS.exists(path))) return emptyStore()
      const raw = await this.plugin.wikiFS.read(path)
      const parsed = JSON.parse(raw) as Partial<SuggestionStore>
      if (parsed.version !== 1) return emptyStore()
      return {
        version: 1,
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        negativeCache: Array.isArray(parsed.negativeCache) ? parsed.negativeCache : [],
      }
    } catch (err) {
      console.warn('[Wikey suggestions] load failed:', err)
      return emptyStore()
    }
  }

  private async saveSuggestionStoreToVault(store: SuggestionStore): Promise<void> {
    await this.plugin.wikiFS.write('.wikey/suggestions.json', JSON.stringify(store, null, 2) + '\n')
  }

  private async openSuggestionsPanel() {
    this.suggestionsPanel = createDiv({ cls: 'wikey-chat-suggestions' })
    this.messagesEl.parentElement?.insertBefore(this.suggestionsPanel, this.messagesEl)
    const panel = this.suggestionsPanel
    panel.createEl('h3', { text: '🔔 표준 분해 후보' })

    const store = await this.loadSuggestionStoreFromVault()
    const pending = store.suggestions.filter((s) => s.state.kind === 'pending')
    if (pending.length === 0) {
      panel.createEl('p', { text: '대기 중인 제안이 없습니다.' })
      return
    }
    for (const s of pending) this.renderSuggestionCard(panel, s)
  }

  private renderSuggestionCard(parent: HTMLElement, s: Suggestion) {
    const model = buildSuggestionCardModel(s)
    const card = parent.createDiv({ cls: 'wikey-suggestion-card' })
    card.createEl('h4', { text: model.title })
    card.createEl('p', { text: `${model.confidenceLabel} · ${model.summary}` })
    const list = card.createEl('ul')
    for (const slug of model.componentSlugs) list.createEl('li', { text: slug })
    if (model.evidenceLines.length > 0) {
      const ev = card.createEl('details')
      ev.createEl('summary', { text: 'Evidence' })
      for (const line of model.evidenceLines) ev.createEl('div', { text: line })
    }
    const actions = card.createDiv({ cls: 'wikey-suggestion-actions' })
    const acceptBtn = actions.createEl('button', { text: 'Accept' })
    const editBtn = actions.createEl('button', { text: 'Edit' })
    const rejectBtn = actions.createEl('button', { text: 'Reject' })
    acceptBtn.disabled = !model.actions.accept
    editBtn.disabled = !model.actions.edit
    rejectBtn.disabled = !model.actions.reject

    acceptBtn.addEventListener('click', async () => {
      try {
        const result = await appendStandardDecomposition(this.plugin.wikiFS, s)
        if (!result.appended) {
          new Notice(`schema.yaml not updated: ${result.reason ?? 'unknown'}`)
        }
        const store = await this.loadSuggestionStoreFromVault()
        const next = acceptSuggestion(store, s.id)
        await this.saveSuggestionStoreToVault(next)
        card.remove()
        new Notice(`Accepted suggestion: ${s.umbrella_slug}`)
      } catch (err) {
        new Notice(`Accept failed: ${(err as Error).message}`)
      }
    })

    rejectBtn.addEventListener('click', async () => {
      try {
        const store = await this.loadSuggestionStoreFromVault()
        const next = rejectSuggestionFromPanel(store, s.id)
        await this.saveSuggestionStoreToVault(next)
        card.remove()
        new Notice(`Rejected suggestion: ${s.umbrella_slug}`)
      } catch (err) {
        new Notice(`Reject failed: ${(err as Error).message}`)
      }
    })

    editBtn.addEventListener('click', () => {
      // Edit modal deferred to §5.4.5 cycle smoke (out of Stage 2 scope).
      new Notice('Edit modal: deferred to §5.4.5 live cycle smoke')
    })
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

    // ── Wiki Stats ──
    const wikiSection = el.createDiv({ cls: 'wikey-dashboard-section' })
    const wikiHeader = wikiSection.createDiv({ cls: 'wikey-dashboard-section-header' })
    wikiHeader.createEl('h3', { text: 'Wiki' })
    const wikiInfo = wikiHeader.createEl('span', {
      cls: 'wikey-dashboard-info',
      text: '?',
      attr: {
        'aria-label': 'Why more pages than raw sources?',
        title:
          '왜 Wiki > Raw인가?\n\n' +
          'raw 소스 1개는 wiki 페이지 5~15개로 분해됩니다 (llm-wiki.md).\n\n' +
          '• entities: 인물/제품/도구 (여러 소스에서 재사용)\n' +
          '• concepts: 이론/방법론\n' +
          '• sources: 원본 1개당 요약 1개\n' +
          '• analyses: 쿼리 합성 결과\n\n' +
          '분할 이유: 검색 정확도 + 재사용 + 백링크 그래프\n' +
          '상세: docs/ingest-decomposition.md',
      },
    })
    wikiInfo.addEventListener('click', async () => {
      const file = this.app.vault.getAbstractFileByPath('docs/ingest-decomposition.md')
      if (file) {
        await this.app.workspace.getLeaf(false).openFile(file as any)
      } else {
        new Notice('docs/ingest-decomposition.md 없음')
      }
    })

    const categories: Record<string, number> = { entities: 0, concepts: 0, sources: 0, analyses: 0 }
    for (const cat of Object.keys(categories)) {
      const folder = vault.getAbstractFileByPath(`wiki/${cat}`)
      if (folder && (folder as any).children) {
        categories[cat] = (folder as any).children.filter((c: any) => c.extension === 'md').length
      }
    }

    // Meta skeleton (wiki/{index,log,overview}.md) 은 시스템 파일 — content 가 아니므로
    // Total 및 stat card 에 포함하지 않음. reset 직후 Total=0 이 되도록.
    const totalWiki = Object.values(categories).reduce((a, b) => a + b, 0)

    const wikiGrid = wikiSection.createDiv({ cls: 'wikey-dashboard-grid' })
    this.addStatCard(wikiGrid, String(totalWiki), 'Total')
    this.addStatCard(wikiGrid, String(categories.entities), 'Entities')
    this.addStatCard(wikiGrid, String(categories.concepts), 'Concepts')
    this.addStatCard(wikiGrid, String(categories.sources), 'Sources')
    this.addStatCard(wikiGrid, String(categories.analyses), 'Analyses')

    // ── Raw Sources (audit 기반 단일 소스) ──
    const rawSection = el.createDiv({ cls: 'wikey-dashboard-section' })
    rawSection.createEl('h3', { text: 'Raw Sources' })
    this.renderRawSourcesDashboard(rawSection)

    // ── Tags Top-10 ──
    const tagSection = el.createDiv({ cls: 'wikey-dashboard-section' })
    tagSection.createEl('h3', { text: 'Tags Top-10' })

    const tagRanking = this.collectTagRanking()
    if (tagRanking.length === 0) {
      tagSection.createEl('span', { text: 'No tag data', cls: 'wikey-dashboard-empty' })
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

    // ── Recent Queries ──
    const querySection = el.createDiv({ cls: 'wikey-dashboard-section' })
    querySection.createEl('h3', { text: 'Recent Queries' })

    const recentQueries = this.plugin.chatHistory
      .filter((m) => m.role === 'user')
      .slice(-5)
      .reverse()

    if (recentQueries.length === 0) {
      querySection.createEl('span', { text: 'No queries yet', cls: 'wikey-dashboard-empty' })
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

    // ── Graph View ──
    const graphSection = el.createDiv({ cls: 'wikey-dashboard-section' })
    const graphBtn = graphSection.createEl('button', { cls: 'wikey-dashboard-graph-btn', text: 'Open Graph View' })
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
      this.addStatCard(grid, String(data.total_documents), 'Total Docs')
      this.addStatCard(grid, String(data.ingested), 'Ingested')
      this.addStatCard(grid, String(data.missing), 'Missing')
    } catch {
      container.createEl('span', { text: 'Audit failed', cls: 'wikey-dashboard-empty' })
    }
  }

  private renderRawSourcesDashboard(container: HTMLElement) {
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

      // §5.2.0 v4 (2026-04-25 사용자 요청): paired sidecar `<base>.<ext>.md` 를
      // dashboard 카운트에서도 제외 (audit panel §5.2.0 와 동일 정책).
      // 원본.ext + 원본.md 를 하나의 원본으로 취급. UI 레이어 처리, audit-ingest.py
      // raw output (registry/wiki) 는 source-of-truth 로 유지.
      const recount = recountAuditAfterPairedExclude({
        ingested: data.ingested_files ?? [],
        missing: data.files ?? [],
        unsupported: data.unsupported_files ?? [],
      })
      const folders = recount.folders

      // Row 1: Total / Ingested / Missing
      const grid = container.createDiv({ cls: 'wikey-dashboard-grid' })
      this.addStatCard(grid, String(recount.totalFiles), 'Total Files')
      this.addAccentStatCard(grid, String(recount.ingested.length), 'Ingested')
      this.addStatCard(grid, String(recount.missing.length), 'Missing')

      // Row 2: PARA folders as "ingested/total".
      // `_delayed` 는 보류 상태 — ingest 대상 아님. Dashboard 노출 금지.
      const paraMap: Array<{ key: string; label: string }> = [
        { key: '0_inbox', label: 'Inbox' },
        { key: '1_projects', label: 'Projects' },
        { key: '2_areas', label: 'Areas' },
        { key: '3_resources', label: 'Resources' },
        { key: '4_archive', label: 'Archive' },
      ]
      const paraGrid = container.createDiv({ cls: 'wikey-dashboard-grid' })
      paraGrid.style.marginTop = '6px'
      for (const { key, label } of paraMap) {
        const f = folders[key]
        if (f) {
          const card = paraGrid.createDiv({ cls: 'wikey-dashboard-card' })
          const valEl = card.createDiv({ cls: 'wikey-dashboard-card-value' })
          valEl.createEl('span', { text: String(f.ingested), attr: { style: 'color: var(--interactive-accent)' } })
          valEl.createEl('span', { text: ' / ' })
          valEl.createEl('span', { text: String(f.total) })
          card.createEl('div', { text: label, cls: 'wikey-dashboard-card-label' })
        } else {
          this.addStatCard(paraGrid, '0', label)
        }
      }

    } catch {
      const rawStats = this.collectRawStats()
      const grid = container.createDiv({ cls: 'wikey-dashboard-grid' })
      this.addStatCard(grid, String(rawStats.total), 'Folders')
      this.addStatCard(grid, String(rawStats.inbox), 'Inbox')
      this.addStatCard(grid, String(rawStats.projects), 'Projects')
      this.addStatCard(grid, String(rawStats.areas), 'Areas')
      this.addStatCard(grid, String(rawStats.resources), 'Resources')
      this.addStatCard(grid, String(rawStats.archive), 'Archive')
    }
  }

  private openAuditPanel() {
    this.auditPanel = createDiv({ cls: 'wikey-audit-panel' })
    this.messagesEl.parentElement?.insertBefore(this.auditPanel, this.messagesEl)
    this.renderAuditSection(this.auditPanel)
  }

  private auditSelections: Set<string> = new Set()

  private renderAuditSection(container: HTMLElement) {
    const { execFileSync } = require('node:child_process') as typeof import('node:child_process')
    const { join } = require('node:path') as typeof import('node:path')
    const basePath = (this.app.vault.adapter as any).basePath ?? ''
    const env = this.plugin.getExecEnv()

    // Phase 4 D.0.d — audit-ingest.py 신규 필드: unsupported_files / capabilities / entries
    let auditData: {
      total_documents: number
      ingested: number
      missing: number
      unsupported?: number
      files: string[]
      ingested_files: string[]
      unsupported_files?: string[]
      capabilities?: { doclingInstalled: boolean; unhwpInstalled: boolean; generatedAt: string; source: string }
    }
    try {
      const script = join(basePath, 'scripts/audit-ingest.py')
      const stdout = execFileSync('python3', [script, '--json'], {
        cwd: basePath, timeout: 10000, env, encoding: 'utf-8',
      })
      auditData = JSON.parse(stdout)
    } catch {
      container.createEl('span', { text: 'Audit script failed', cls: 'wikey-dashboard-empty' })
      return
    }

    // Phase 4 D.0.d — converter 미설치 시 상단 경고 배너.
    const caps = auditData.capabilities
    if (caps && (!caps.doclingInstalled || !caps.unhwpInstalled)) {
      const banner = container.createDiv({ cls: 'wikey-audit-banner-warn' })
      const parts: string[] = []
      if (!caps.doclingInstalled) parts.push('Docling (PDF/DOCX/PPTX/XLSX/HTML/image) — `uv tool install docling`')
      if (!caps.unhwpInstalled) parts.push('unhwp (HWP/HWPX) — `pip install unhwp`')
      banner.setText(`⚠ 일부 포맷 변환기가 설치되지 않았습니다. 아래 빨간 행은 인제스트 불가: ${parts.join(' / ')}`)
    }

    // §5.2.0 — paired sidecar.md (`<base>.<ext>.md` from docling/unhwp converter)
    // is hidden from rows + excluded from counts. The original `<base>.<ext>` row
    // gets a [md] badge instead. Filter at render time, source-of-truth (registry,
    // wiki/, audit-ingest.py output) is unchanged.
    const auditAllSet = new Set<string>([
      ...auditData.files,
      ...(auditData.ingested_files ?? []),
      ...(auditData.unsupported_files ?? []),
    ])
    const auditPaired = pairedSidecarSet([...auditAllSet])
    const dropPaired = (xs: readonly string[]) => xs.filter((x) => !auditPaired.has(x))
    auditData = {
      ...auditData,
      files: dropPaired(auditData.files),
      ingested_files: dropPaired(auditData.ingested_files ?? []),
      unsupported_files: dropPaired(auditData.unsupported_files ?? []),
    }
    auditData.ingested = auditData.ingested_files.length
    auditData.missing = auditData.files.length
    // §5.2.0 v2 (사용자 요청 2026-04-25): paired (sidecar.md 존재) 인데 audit
    // missing 분류 = broken state (registry/wiki reset 됐거나 sidecar 만 남고
    // ingested 안 됨). badge 오렌지로 시각 경고.
    const ingestedSet = new Set<string>(auditData.ingested_files)
    auditData.unsupported = (auditData.unsupported_files ?? []).length
    auditData.total_documents = auditData.ingested + auditData.missing + (auditData.unsupported ?? 0)

    const unsupportedSet = new Set(auditData.unsupported_files ?? [])

    // ── Audit UI state (filter/view/search) ──
    type AuditMode = 'all' | 'missing' | 'ingested'
    let auditMode: AuditMode = 'missing'
    let viewMode: 'list' | 'tree' = 'list'
    let searchQuery = ''
    const treeExpand: Map<string, boolean> = new Map()

    // ── Top bar: clickable stat chips + status ──
    const topBar = container.createDiv({ cls: 'wikey-audit-summary-row' })
    const statsLeft = topBar.createDiv({ cls: 'wikey-audit-stats-left' })
    const statTotal = statsLeft.createEl('span', { cls: 'wikey-audit-stat wikey-audit-stat-clickable' })
    const statIngested = statsLeft.createEl('span', { cls: 'wikey-audit-stat wikey-audit-stat-ok wikey-audit-stat-clickable' })
    const statMissing = statsLeft.createEl('span', { cls: 'wikey-audit-stat wikey-audit-stat-warn wikey-audit-stat-clickable' })
    const statusRight = topBar.createEl('span', { cls: 'wikey-audit-status-right' })

    const updateSummaryStats = () => {
      statTotal.empty()
      statTotal.createEl('span', { text: 'All ' })
      statTotal.createEl('span', { text: String(auditData.total_documents), cls: 'wikey-stat-number' })
      statIngested.empty()
      statIngested.createEl('span', { text: 'Ingested ' })
      statIngested.createEl('span', { text: String(auditData.ingested), cls: 'wikey-stat-number' })
      statMissing.empty()
      statMissing.createEl('span', { text: 'Missing ' })
      statMissing.createEl('span', { text: String(auditData.missing), cls: 'wikey-stat-number' })
      statTotal.toggleClass('wikey-audit-stat-active', auditMode === 'all')
      statIngested.toggleClass('wikey-audit-stat-active', auditMode === 'ingested')
      statMissing.toggleClass('wikey-audit-stat-active', auditMode === 'missing')
    }
    updateSummaryStats()

    const updateStatus = (text: string, accent = false) => {
      statusRight.empty()
      if (accent) {
        const parts = text.split(/(\d+[\d/]*)/)
        for (const p of parts) {
          if (/^\d/.test(p)) statusRight.createEl('span', { text: p, cls: 'wikey-stat-number-white' })
          else statusRight.createEl('span', { text: p })
        }
      } else {
        statusRight.setText(text)
      }
    }

    if (auditData.total_documents === 0) {
      container.createEl('span', { text: 'No raw documents found.', cls: 'wikey-dashboard-empty' })
      return
    }

    this.auditSelections = new Set()

    // ── Filter row: [Folder select] [Search...] ........ [List | Tree] ──
    const filterRow = container.createDiv({ cls: 'wikey-audit-filter' })
    filterRow.createEl('span', { text: 'Folder', cls: 'wikey-audit-filter-label' })
    const folderSelect = filterRow.createEl('select', { cls: 'wikey-select' })

    const activeFiles = (): string[] => {
      const ingested = auditData.ingested_files ?? []
      const unsupported = auditData.unsupported_files ?? []
      if (auditMode === 'missing') return [...auditData.files, ...unsupported]
      if (auditMode === 'ingested') return ingested
      return [...auditData.files, ...unsupported, ...ingested]
    }

    const rebuildFolderOptions = () => {
      const currentVal = folderSelect.value
      folderSelect.empty()
      const files = activeFiles()
      folderSelect.createEl('option', { text: `All (${files.length})`, attr: { value: '' } })
      for (const { folder, count } of this.extractFolders(files)) {
        folderSelect.createEl('option', { text: `${folder} (${count})`, attr: { value: folder } })
      }
      folderSelect.value = currentVal
    }
    rebuildFolderOptions()

    // Search input — middle of row
    const searchInput = filterRow.createEl('input', {
      cls: 'wikey-audit-search',
      attr: { type: 'text', placeholder: 'Search filename...' },
    }) as HTMLInputElement

    // View toggle — right-aligned (margin-left: auto via CSS)
    const viewToggle = filterRow.createDiv({ cls: 'wikey-audit-view-toggle' })
    const listBtn = viewToggle.createEl('button', { text: 'List', cls: 'wikey-audit-view-btn wikey-audit-view-active' })
    const treeBtn = viewToggle.createEl('button', { text: 'Tree', cls: 'wikey-audit-view-btn' })

    // ── 전체선택 + 목록 (스크롤 영역) ──
    const listArea = container.createDiv({ cls: 'wikey-audit-list-area' })

    const selectAllRow = listArea.createDiv({ cls: 'wikey-audit-selectall' })
    const selectAllCb = selectAllRow.createEl('input', { attr: { type: 'checkbox' }, cls: 'wikey-audit-cb' })
    selectAllRow.createEl('span', { text: 'Select All', cls: 'wikey-audit-selectall-label' })
    // Right-side total count (reflects current mode + folder + search filters)
    const selectAllTotal = selectAllRow.createEl('span', { cls: 'wikey-audit-selectall-total' })
    const updateSelectAllTotal = (n: number) => {
      selectAllTotal.empty()
      selectAllTotal.createEl('span', { text: 'Total | ', cls: 'wikey-audit-selectall-total-label' })
      selectAllTotal.createEl('span', { text: String(n), cls: 'wikey-audit-selectall-total-number' })
    }

    const listEl = listArea.createDiv({ cls: 'wikey-audit-list' })
    const rowMap = new Map<string, HTMLElement>()

    // ── 하단 고정: [Ingest/Cancel] + [Delay] (상단) / provider + model (하단) ──
    // Ingest 버튼은 상단(applyBar)에 유지, provider/model은 그 아래(providerBar)로
    // 배치해 Ingest 패널과 동일한 레이아웃 공유.
    const bottomBar = container.createDiv({ cls: 'wikey-audit-bottom' })
    const applyBar = bottomBar.createDiv({ cls: 'wikey-audit-apply-bar' })

    const applyBtn = applyBar.createEl('button', { text: 'Ingest', cls: 'wikey-audit-apply-btn' })
    const delayBtn = applyBar.createEl('button', { text: 'Delay', cls: 'wikey-audit-delay-action-btn' })
    applyBtn.setAttr('disabled', 'true')
    delayBtn.setAttr('disabled', 'true')

    // Provider/Model row — bottom of panel, shared layout with Ingest panel
    const providerBar = bottomBar.createDiv({ cls: 'wikey-audit-apply-bar wikey-provider-model-bar' })
    const providerSelect = providerBar.createEl('select', { cls: 'wikey-select' })
    const providerOptions = [
      { value: '', text: 'DEFAULT' },
      { value: 'ollama', text: 'Local' },
      { value: 'gemini', text: 'Google Gemini' },
      { value: 'openai', text: 'OpenAI Codex' },
      { value: 'anthropic', text: 'Anthropic Claude' },
    ]
    const currentIngestProvider = this.plugin.settings.ingestProvider || ''
    for (const opt of providerOptions) {
      const el = providerSelect.createEl('option', { text: opt.text, attr: { value: opt.value } })
      if (opt.value === currentIngestProvider) el.selected = true
    }

    const modelSelect = providerBar.createEl('select', { cls: 'wikey-select' })
    const savedIngestModel = this.plugin.settings.ingestModel || ''
    modelSelect.createEl('option', { text: 'DEFAULT', attr: { value: '' } })

    const loadModels = async (provider: string) => {
      const config = this.plugin.buildConfig()
      const models = await fetchModelList(provider as any, config, this.plugin.httpClient)
      modelSelect.empty()
      const defaultOpt = modelSelect.createEl('option', { text: 'DEFAULT', attr: { value: '' } })
      if (!savedIngestModel) defaultOpt.selected = true
      for (const m of models) {
        const opt = modelSelect.createEl('option', { text: m, attr: { value: m } })
        if (m === savedIngestModel) opt.selected = true
      }
    }
    loadModels(providerSelect.value)
    providerSelect.addEventListener('change', () => loadModels(providerSelect.value))

    // 주의: Converter 수동 선택 및 Force re-convert 체크박스 의도적으로 제거.
    // - 변환기 선택 → 자동 로직 (한국어 공백 소실 > 30% OR 스캔 PDF 감지 → force-ocr 재시도)
    // - 캐시 무효화 → ingest 워크플로우가 자동 흐름이라 사용자가 결과 검토 후 재변환 판단할 틈 없음.
    //   필요 시 ~/.cache/wikey/convert/ 직접 삭제.

    let cancelRequested = false

    const getFiltered = (): string[] => {
      let files = activeFiles()
      const f = folderSelect.value
      if (f) files = files.filter((p) => p.includes(f))
      if (searchQuery) {
        // Normalize to NFC for Korean filename matching (macOS filesystem uses NFD; JS strings are NFC).
        const q = searchQuery.normalize('NFC').toLowerCase()
        files = files.filter((p) => p.normalize('NFC').toLowerCase().includes(q))
      }
      return files
    }

    const updateApply = () => {
      const count = this.auditSelections.size
      updateStatus(`${count} selected`, true)
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

      updateSelectAllTotal(filtered.length)

      const allChecked = filtered.length > 0 && filtered.every((f) => this.auditSelections.has(f))
      ;(selectAllCb as HTMLInputElement).checked = allChecked

      if (viewMode === 'tree') {
        renderTree(listEl, filtered)
        updateApply()
        return
      }

      const { statSync: statSyncFn, existsSync: existsSyncFn } = require('node:fs') as typeof import('node:fs')

      for (const filePath of filtered) {
        const name = filePath.split('/').pop() ?? filePath
        const parentDir = filePath.split('/').slice(0, -1).join('/')
        const isUnsupported = unsupportedSet.has(filePath)
        const row = listEl.createDiv({
          cls: isUnsupported ? 'wikey-audit-row wikey-audit-row-unsupported' : 'wikey-audit-row',
        })
        if (isUnsupported) {
          row.setAttr('title', '이 파일 형식을 변환할 converter 가 설치되지 않았습니다. 상단 경고 참조.')
        }
        rowMap.set(filePath, row)

        const cb = row.createEl('input', { attr: { type: 'checkbox' }, cls: 'wikey-audit-cb' })
        if (isUnsupported) cb.setAttr('disabled', 'true')
        ;(cb as HTMLInputElement).checked = !isUnsupported && this.auditSelections.has(filePath)

        const info = row.createDiv({ cls: 'wikey-audit-info' })

        // Line 1: filename + file size (right)
        const nameLine = info.createDiv({ cls: 'wikey-audit-name-line' })
        const nameWrap = nameLine.createDiv({ cls: 'wikey-audit-name-wrap' })
        const nameSpan = nameWrap.createEl('span', { text: name, cls: 'wikey-audit-name' })
        // §5.2.0: paired sidecar.md badge — 파일명 right with 8px margin (wrap gap).
        // Tooltip 은 filename + badge 양쪽에 부착 (UX: hover 영역 넓힘).
        if (hasSidecar(filePath, auditAllSet)) {
          const sidecarFull = join(basePath, `${filePath}.md`)
          const isBroken = !ingestedSet.has(filePath)
          const baseTooltip = this.buildSidecarTooltip(sidecarFull, `${name}.md`)
          const tooltip = isBroken
            ? `⚠ ingest 결과 (registry/wiki) 없음 — sidecar 만 남은 broken state\n${baseTooltip}`
            : baseTooltip
          nameSpan.setAttr('title', tooltip)
          const badgeCls = isBroken
            ? 'wikey-pair-sidecar-badge wikey-pair-sidecar-badge-broken'
            : 'wikey-pair-sidecar-badge'
          const badge = nameWrap.createEl('span', { text: 'md', cls: badgeCls })
          badge.setAttr('title', tooltip)
        }
        const fullPath = join(basePath, filePath)
        let fileSizeKb = 0
        if (existsSyncFn(fullPath)) {
          try { fileSizeKb = Math.round(statSyncFn(fullPath).size / 1024) } catch { /* skip */ }
        }
        const sizeLabel = fileSizeKb >= 1024 ? `${(fileSizeKb / 1024).toFixed(1)}MB` : `${fileSizeKb}KB`
        nameLine.createEl('span', { text: sizeLabel, cls: 'wikey-audit-filesize' })

        // Line 2: folder + (time while ingesting) + recommended model (right)
        const pathLine = info.createDiv({ cls: 'wikey-audit-path-line' })
        pathLine.createEl('span', { text: parentDir, cls: 'wikey-audit-path' })
        // Inline time — hidden until ingest starts, sits next to folder path
        pathLine.createEl('span', { cls: 'wikey-audit-time', attr: { style: 'display:none' } })
        const recommend = fileSizeKb > 1024 ? 'Cloud' : 'Local'
        pathLine.createEl('span', { text: recommend, cls: `wikey-audit-recommend wikey-audit-recommend-${recommend.toLowerCase()}` })

        const toggleCb = () => {
          if ((cb as HTMLInputElement).checked) this.auditSelections.add(filePath)
          else this.auditSelections.delete(filePath)
          updateApply()
          const all = getFiltered().every((f) => this.auditSelections.has(f))
          ;(selectAllCb as HTMLInputElement).checked = all
        }

        cb.addEventListener('change', toggleCb)

        // 행 클릭 시 체크박스 토글 (체크박스 자체 클릭은 제외).
        // Unsupported 파일은 checkbox disabled 뿐 아니라 row 전체 클릭도 무효화한다
        // — 그렇지 않으면 행 hit-target 을 통해 auditSelections 에 진입할 수 있다 (C3 위반).
        row.addEventListener('click', (e) => {
          if (e.target === cb) return
          if (isUnsupported) return
          ;(cb as HTMLInputElement).checked = !(cb as HTMLInputElement).checked
          toggleCb()
        })
      }
      updateApply()
    }

    // ── Tree view: group filtered files by folder path (raw/ top-level hidden) ──
    const renderTree = (parent: HTMLElement, files: string[]) => {
      type Node = { name: string; fullPath: string; isDir: boolean; files: string[]; children: Map<string, Node> }
      const root: Node = { name: '', fullPath: '', isDir: true, files: [], children: new Map() }
      for (const f of files) {
        const segs = f.split('/')
        const fileName = segs[segs.length - 1]
        let cur = root
        for (let i = 0; i < segs.length - 1; i++) {
          const seg = segs[i]
          const p = segs.slice(0, i + 1).join('/')
          if (!cur.children.has(seg)) {
            cur.children.set(seg, { name: seg, fullPath: p, isDir: true, files: [], children: new Map() })
          }
          cur = cur.children.get(seg)!
        }
        cur.files.push(fileName)
      }

      const chevronSvg = (open: boolean): string =>
        `<svg class="wikey-audit-tree-chev ${open ? 'wikey-audit-tree-chev-open' : ''}" viewBox="0 0 12 12" width="12" height="12"><path d="M4 2 L8 6 L4 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`

      const renderNode = (node: Node, depth: number) => {
        const sortedDirs = [...node.children.entries()].sort(([a], [b]) => a.localeCompare(b))
        for (const [, child] of sortedDirs) {
          const isOpen = treeExpand.get(child.fullPath) ?? depth < 2
          const dirRow = parent.createDiv({ cls: 'wikey-audit-tree-dir' })
          dirRow.style.paddingLeft = `${depth * 14}px`
          const caret = dirRow.createEl('span', { cls: 'wikey-audit-tree-caret' })
          caret.innerHTML = chevronSvg(isOpen)
          const fileCount = countFiles(child)
          dirRow.createEl('span', { cls: 'wikey-audit-tree-dir-name', text: child.name })
          dirRow.createEl('span', { cls: 'wikey-audit-tree-count', text: `(${fileCount})` })
          dirRow.addEventListener('click', () => {
            treeExpand.set(child.fullPath, !isOpen)
            renderList()
          })
          if (isOpen) renderNode(child, depth + 1)
        }
        for (const fileName of node.files.sort()) {
          const fullRel = node.fullPath ? `${node.fullPath}/${fileName}` : fileName
          const isUnsupported = unsupportedSet.has(fullRel)
          const row = parent.createDiv({
            cls: isUnsupported ? 'wikey-audit-tree-file wikey-audit-row-unsupported' : 'wikey-audit-tree-file',
          })
          if (isUnsupported) {
            row.setAttr('title', '이 파일 형식을 변환할 converter 가 설치되지 않았습니다. 상단 경고 참조.')
          }
          row.style.paddingLeft = `${depth * 14 + 14}px`
          const cb = row.createEl('input', { attr: { type: 'checkbox' }, cls: 'wikey-audit-cb' })
          if (isUnsupported) cb.setAttr('disabled', 'true')
          ;(cb as HTMLInputElement).checked = !isUnsupported && this.auditSelections.has(fullRel)
          // wrap filename + badge so badge sits 8px right of filename text.
          const treeNameWrap = row.createDiv({ cls: 'wikey-audit-name-wrap' })
          const treeName = treeNameWrap.createEl('span', { cls: 'wikey-audit-tree-file-name', text: fileName })
          if (hasSidecar(fullRel, auditAllSet)) {
            const sidecarFull = join(basePath, `${fullRel}.md`)
            const isBroken = !ingestedSet.has(fullRel)
            const baseTooltip = this.buildSidecarTooltip(sidecarFull, `${fileName}.md`)
            const tooltip = isBroken
              ? `⚠ ingest 결과 (registry/wiki) 없음 — sidecar 만 남은 broken state\n${baseTooltip}`
              : baseTooltip
            treeName.setAttr('title', tooltip)
            const badgeCls = isBroken
              ? 'wikey-pair-sidecar-badge wikey-pair-sidecar-badge-broken'
              : 'wikey-pair-sidecar-badge'
            const badge = treeNameWrap.createEl('span', { text: 'md', cls: badgeCls })
            badge.setAttr('title', tooltip)
          }
          rowMap.set(fullRel, row)
          const toggle = () => {
            if ((cb as HTMLInputElement).checked) this.auditSelections.add(fullRel)
            else this.auditSelections.delete(fullRel)
            updateApply()
          }
          cb.addEventListener('change', toggle)
          row.addEventListener('click', (e) => {
            if (e.target === cb) return
            if (isUnsupported) return
            ;(cb as HTMLInputElement).checked = !(cb as HTMLInputElement).checked
            toggle()
          })
        }
      }

      const countFiles = (n: Node): number => {
        let c = n.files.length
        for (const ch of n.children.values()) c += countFiles(ch)
        return c
      }

      // Hide top-level "raw/" — start rendering from its children
      const rawNode = root.children.get('raw')
      if (rawNode) renderNode(rawNode, 0)
      else renderNode(root, 0)
    }

    // Stat chip toggle (all ⇄ missing ⇄ ingested)
    const switchMode = (mode: AuditMode) => {
      if (auditMode === mode) return
      auditMode = mode
      this.auditSelections = new Set()
      rebuildFolderOptions()
      updateSummaryStats()
      renderList()
      // In ingested mode, disable ingest/delay actions (already ingested). In all, enable — user can pick missing.
      const readOnly = auditMode === 'ingested'
      if (readOnly) {
        applyBtn.setAttr('disabled', 'true')
        delayBtn.setAttr('disabled', 'true')
        applyBtn.addClass('wikey-audit-readonly')
      } else {
        applyBtn.removeClass('wikey-audit-readonly')
        updateApply()
      }
    }
    statTotal.addEventListener('click', () => switchMode('all'))
    statMissing.addEventListener('click', () => switchMode('missing'))
    statIngested.addEventListener('click', () => switchMode('ingested'))

    // View toggle
    listBtn.addEventListener('click', () => {
      if (viewMode === 'list') return
      viewMode = 'list'
      listBtn.addClass('wikey-audit-view-active')
      treeBtn.removeClass('wikey-audit-view-active')
      renderList()
    })
    treeBtn.addEventListener('click', () => {
      if (viewMode === 'tree') return
      viewMode = 'tree'
      treeBtn.addClass('wikey-audit-view-active')
      listBtn.removeClass('wikey-audit-view-active')
      renderList()
    })

    // Search input — debounced
    let searchTimer: ReturnType<typeof setTimeout> | null = null
    searchInput.addEventListener('input', () => {
      if (searchTimer) clearTimeout(searchTimer)
      searchTimer = setTimeout(() => {
        searchQuery = searchInput.value.trim()
        renderList()
      }, 120)
    })

    selectAllCb.addEventListener('change', () => {
      // C3 guard: Select All 은 unsupported 파일을 선택 범위에서 배제한다. 그렇지 않으면
      // UI 가 체크박스 disabled 상태여도 auditSelections 에 추가돼 Ingest 버튼이 처리 시도한다.
      const filtered = getFiltered().filter((f) => !unsupportedSet.has(f))
      const checked = (selectAllCb as HTMLInputElement).checked
      for (const f of filtered) {
        if (checked) this.auditSelections.add(f)
        else this.auditSelections.delete(f)
      }
      renderList()
    })

    folderSelect.addEventListener('change', renderList)

    // ── Ingest / Cancel ──
    applyBtn.addEventListener('click', async () => {
      // Cancel mode
      if (applyBtn.getText() === 'Cancel') {
        cancelRequested = true
        applyBtn.setAttr('disabled', 'true')
        updateStatus('Cancelling...', false)
        return
      }

      // C3 defensive gate: auditSelections 에 stale 하게 남은 unsupported 항목은 여기서 마지막
      // 으로 필터. Select All / row-click guard 가 있지만 data 변경 (capabilities.json 재생성
      // 등) 이후 UI 재-render 이전의 race 를 방어한다. 수가 줄면 Notice 로 알린다.
      const rawSelected = [...this.auditSelections]
      const selected = rawSelected.filter((f) => !unsupportedSet.has(f))
      const skipped = rawSelected.length - selected.length
      if (skipped > 0) {
        new Notice(`미지원 파일 ${skipped}개 건너뜀 — docling/unhwp 설치 후 재시도`, 5000)
        for (const f of rawSelected) {
          if (unsupportedSet.has(f)) this.auditSelections.delete(f)
        }
      }
      if (selected.length === 0) return

      // Switch to Cancel mode
      cancelRequested = false
      applyBtn.setText('Cancel')
      applyBtn.removeClass('wikey-audit-apply-btn')
      applyBtn.addClass('wikey-audit-cancel-btn')
      delayBtn.setAttr('disabled', 'true')
      providerSelect.setAttr('disabled', 'true')
      modelSelect.setAttr('disabled', 'true')

      // Apply selected provider + model ONLY when user explicitly overrode them.
      // Empty value = "(use Default Model)" → leave plugin.settings untouched so
      // resolveProvider picks the Default Model Provider + PROVIDER_CHAT_DEFAULTS model.
      const selectedProvider = providerSelect.value
      const selectedModel = modelSelect.value
      const origBasic = this.plugin.settings.basicModel
      const origIngestProvider = this.plugin.settings.ingestProvider
      const origIngestModel = this.plugin.settings.ingestModel
      if (selectedProvider) {
        this.plugin.settings.basicModel = selectedProvider
        this.plugin.settings.ingestProvider = selectedProvider
      }
      if (selectedModel) this.plugin.settings.ingestModel = selectedModel
      this.plugin.llmClient = new (await import('wikey-core')).LLMClient(
        this.plugin.httpClient, this.plugin.buildConfig(),
      )

      let done = 0
      let failed = 0
      let cancelled = 0
      const succeeded: string[] = []

      for (const f of selected) {
        if (cancelRequested) {
          cancelled = selected.length - done
          break
        }

        const row = rowMap.get(f)
        const timeEl = row?.querySelector('.wikey-audit-time') as HTMLElement | null
        let timerInterval: ReturnType<typeof setInterval> | null = null
        const fileStart = Date.now()
        let rowSpinner: HTMLElement | null = null

        if (row) {
          row.removeClass('wikey-audit-row-done')
          row.addClass('wikey-audit-row-active')
          row.style.setProperty('--progress', '0%')
          row.scrollIntoView({ block: 'nearest' })
          // Loading spinner next to filename until brief/extract starts (first progress tick)
          const nameEl = row.querySelector('.wikey-audit-name') as HTMLElement | null
          if (nameEl) {
            rowSpinner = document.createElement('span')
            rowSpinner.className = 'wikey-row-spinner'
            nameEl.insertAdjacentElement('afterend', rowSpinner)
          }
        }

        // Show live time counter
        if (timeEl) {
          timeEl.style.display = ''
          timeEl.addClass('wikey-ingest-fp-active')
          timerInterval = setInterval(() => {
            const elapsed = Math.round((Date.now() - fileStart) / 1000)
            timeEl.setText(`${elapsed}s`)
          }, 1000)
        }

        updateStatus(`${done + 1}/${selected.length} processing...`, true)

        let spinnerRemoved = false
        const result = await runIngest(this.plugin, f, (step, _total, _msg, subStep, subTotal) => {
          if (!spinnerRemoved && rowSpinner) {
            rowSpinner.remove()
            rowSpinner = null
            spinnerRemoved = true
          }
          if (row) {
            const pct = computeRowPct(step, subStep, subTotal)
            row.style.setProperty('--progress', `${pct}%`)
          }
        }, {
          autoMoveFromInbox: true,
        })
        if (rowSpinner) {
          rowSpinner.remove()
          rowSpinner = null
        }

        // Stop timer
        if (timerInterval) clearInterval(timerInterval)
        const fileElapsed = Math.round((Date.now() - fileStart) / 1000)

        if (row) {
          row.removeClass('wikey-audit-row-active')
          row.style.removeProperty('--progress')

          if (result.success) {
            row.addClass('wikey-audit-row-done')
            // Change filename to green (keep in list, don't remove)
            const nameEl = row.querySelector('.wikey-audit-name') as HTMLElement | null
            if (nameEl) nameEl.addClass('wikey-audit-name-done')
          } else if (result.cancelled) {
            // User cancelled — silent, no red fail state (just reset)
            row.addClass('wikey-audit-row-cancelled')
          } else {
            row.addClass('wikey-audit-row-fail')
            if (result.error) {
              // 에러 메시지는 info column 내부 (path-line 하단) 에 삽입해
              // filename 공간을 침범하지 않고 하단 메시지 공간만 사용한다.
              const infoEl = row.querySelector('.wikey-audit-info') as HTMLElement | null
              const errEl = (infoEl ?? row).createDiv({ cls: 'wikey-audit-error' })
              errEl.setText(result.error.length > 80 ? result.error.slice(0, 80) + '...' : result.error)
            }
          }

          // Show final elapsed time
          if (timeEl) {
            timeEl.removeClass('wikey-ingest-fp-active')
            timeEl.addClass(result.success ? 'wikey-ingest-fp-done' : 'wikey-ingest-fp-fail')
            const min = Math.floor(fileElapsed / 60)
            const sec = fileElapsed % 60
            timeEl.setText(min > 0 ? `${min}m ${sec}s` : `${sec}s`)
          }
        }

        if (result.success) {
          succeeded.push(f)
          auditData.ingested++
          auditData.missing = auditData.files.length - succeeded.length
          // Move from missing list → ingested list (for stat chip switching)
          const idx = auditData.files.indexOf(f)
          if (idx >= 0) auditData.files.splice(idx, 1)
          auditData.ingested_files = [...(auditData.ingested_files ?? []), f]
          updateSummaryStats()
        } else if (result.cancelled) {
          cancelled++
        } else {
          failed++
        }
        done++
      }

      // Restore settings
      this.plugin.settings.basicModel = origBasic
      this.plugin.settings.ingestProvider = origIngestProvider
      this.plugin.settings.ingestModel = origIngestModel
      await this.plugin.saveSettings()

      // Restore button
      applyBtn.setText('Ingest')
      applyBtn.removeClass('wikey-audit-cancel-btn')
      applyBtn.addClass('wikey-audit-apply-btn')
      providerSelect.removeAttribute('disabled')
      modelSelect.removeAttribute('disabled')

      let msg = ''
      if (cancelled > 0) msg = `Done ${succeeded.length} / Cancelled ${cancelled}`
      else if (failed > 0) msg = `Done ${succeeded.length} / Failed ${failed}`
      else msg = `${succeeded.length} completed`
      updateStatus(msg, true)
      new Notice(msg)

      // Don't remove completed rows — keep them visible with green names.
      // Clear selection for succeeded files; keep failed/cancelled files selected
      // so the user can retry with a single click on [Ingest].
      const succeededSet = new Set(succeeded)
      for (const f of [...this.auditSelections]) {
        if (succeededSet.has(f)) this.auditSelections.delete(f)
      }
      rebuildFolderOptions()
      renderList()
      updateApply()
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

      new Notice(`${moved} moved → raw/_delayed/`)
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

  private addAccentStatCard(parent: HTMLElement, value: string, label: string) {
    const card = parent.createDiv({ cls: 'wikey-dashboard-card' })
    card.createEl('div', { text: value, cls: 'wikey-dashboard-card-value', attr: { style: 'color: var(--interactive-accent)' } })
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

    // ── Drop zone with header ──
    const dropHeader = this.ingestPanel.createDiv({ cls: 'wikey-ingest-drop-header' })
    dropHeader.createEl('span', { text: 'Insert file to inbox', cls: 'wikey-ingest-drop-title' })
    const addToInboxBtn = dropHeader.createEl('button', { cls: 'wikey-ingest-add-btn', text: 'Add' })
    addToInboxBtn.setAttr('disabled', 'true')
    addToInboxBtn.addEventListener('click', () => this.addPendingToInbox())

    const dropZone = this.ingestPanel.createDiv({ cls: 'wikey-ingest-dropzone' })
    dropZone.createEl('span', { text: 'Drag files here', cls: 'wikey-ingest-drop-label' })

    // Hidden native file input
    const fileInput = dropZone.createEl('input', {
      attr: { type: 'file', multiple: 'true', accept: '.md,.txt,.pdf' },
      cls: 'wikey-ingest-file-input',
    })
    const browseBtn = dropZone.createEl('button', { cls: 'wikey-ingest-browse-btn', text: 'Browse' })
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

  private updateAddBtnState() {
    const btn = this.ingestPanel?.querySelector('.wikey-ingest-add-btn') as HTMLButtonElement | null
    if (!btn) return
    if (this.pendingFiles.length === 0) btn.setAttr('disabled', 'true')
    else btn.removeAttribute('disabled')
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
    if (container) {
      container.empty()
      if (this.pendingFiles.length > 0) {
        const el = container as HTMLElement
        el.createEl('div', { text: `Selected (${this.pendingFiles.length})`, cls: 'wikey-ingest-section-label' })
        for (const f of this.pendingFiles) {
          const row = el.createDiv({ cls: 'wikey-ingest-file-row' })
          row.createEl('span', { text: f.name, cls: 'wikey-ingest-file-name' })
          const sizeKb = (f.size / 1024).toFixed(1)
          row.createEl('span', { text: `${sizeKb} KB`, cls: 'wikey-ingest-file-size' })
        }
      }
    }
    this.updateAddBtnState()
  }

  private async addPendingToInbox() {
    if (this.pendingFiles.length === 0) {
      new Notice('Select files to add')
      return
    }

    const progressEl = this.ingestPanel?.querySelector('.wikey-ingest-progress') as HTMLElement
    if (progressEl) progressEl.setText('Copying to inbox...')

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
    if (progressEl) progressEl.setText(`${count} files added to inbox`)
    new Notice(`${count} files added to inbox`)
  }

  private getInboxPath(): string {
    const basePath = (this.app.vault.adapter as any).basePath ?? ''
    const { join } = require('node:path') as typeof import('node:path')
    return join(basePath, 'raw/0_inbox')
  }

  /**
   * §5.2.0 — paired sidecar.md tooltip = ingest 실행일 (sidecar 생성일) 1줄.
   * 사용자 요청 (2026-04-25): 한 줄, `yyyy-mm-dd HH:MM` 형식만.
   * frontmatter `created` 우선, 없으면 fs mtime.
   */
  private buildSidecarTooltip(sidecarFullPath: string, _sidecarName: string): string {
    const { existsSync, statSync, readFileSync } = require('node:fs') as typeof import('node:fs')
    try {
      if (!existsSync(sidecarFullPath)) return ''
      try {
        const head = readFileSync(sidecarFullPath, { encoding: 'utf-8' }).slice(0, 4096)
        const m = head.match(/^created:\s*['"]?([^'"\n]+)['"]?\s*$/m)
        if (m) return m[1].trim().slice(0, 19).replace('T', ' ')
      } catch { /* fall through to mtime */ }
      const mtime = statSync(sidecarFullPath).mtime
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${mtime.getFullYear()}-${pad(mtime.getMonth() + 1)}-${pad(mtime.getDate())} ${pad(mtime.getHours())}:${pad(mtime.getMinutes())}`
    } catch {
      return ''
    }
  }

  private listInboxFilesRaw(): string[] {
    const { readdirSync, existsSync } = require('node:fs') as typeof import('node:fs')
    const inboxDir = this.getInboxPath()
    if (!existsSync(inboxDir)) return []
    return readdirSync(inboxDir)
      .filter((f: string) => !f.startsWith('.'))
      .sort()
  }

  private listInboxFiles(): string[] {
    return filterOutPairedSidecars(this.listInboxFilesRaw())
  }

  private async ingestInbox() {
    const files = this.listInboxFiles()
    if (files.length === 0) {
      new Notice('No files to ingest in inbox')
      return
    }
    // Select all and trigger ingest via inbox panel
    this.inboxSelections = new Set(files.slice(0, 30))
    await this.ingestSelectedInboxFiles()
  }

  private inboxSelections: Set<string> = new Set()
  private inboxRowMap: Map<string, HTMLElement> = new Map()
  // Preserve fail state across re-renders. Cleared on manual retry or 10min TTL.
  private inboxFailState: Map<string, { error: string; timestamp: number }> = new Map()

  private async ingestSelectedInboxFiles() {
    const selected = [...this.inboxSelections]
    if (selected.length === 0) return

    const summaryEl = this.ingestPanel?.querySelector('.wikey-inbox-apply-summary') as HTMLElement | null
    const moveBtn = this.ingestPanel?.querySelector('.wikey-inbox-move-btn') as HTMLButtonElement | null
    const ingestBtn = this.ingestPanel?.querySelector('.wikey-inbox-ingest-btn') as HTMLButtonElement | null

    if (moveBtn) moveBtn.setAttr('disabled', 'true')
    if (ingestBtn) ingestBtn.setAttr('disabled', 'true')

    let done = 0
    let failed = 0

    for (const f of selected) {
      const row = this.inboxRowMap.get(f)
      if (row) {
        row.removeClass('wikey-audit-row-done')
        row.addClass('wikey-audit-row-active')
        row.style.setProperty('--progress', '0%')
        row.scrollIntoView({ block: 'nearest' })
      }

      if (summaryEl) {
        summaryEl.empty()
        summaryEl.createEl('span', { text: `${done + 1}/${selected.length}`, cls: 'wikey-stat-number-white' })
        summaryEl.createEl('span', { text: ' processing...' })
      }

      const result = await runIngest(this.plugin, `raw/0_inbox/${f}`, (step, _total, _msg, subStep, subTotal) => {
        if (row) {
          const pct = computeRowPct(step, subStep, subTotal)
          row.style.setProperty('--progress', `${pct}%`)
        }
      })

      if (row) {
        row.removeClass('wikey-audit-row-active')
        row.addClass(result.success ? 'wikey-audit-row-done' : 'wikey-audit-row-fail')
        row.style.removeProperty('--progress')

        if (!result.success && result.error) {
          const infoEl = row.querySelector('.wikey-audit-info') as HTMLElement | null
          const errEl = (infoEl ?? row).createDiv({ cls: 'wikey-audit-error' })
          errEl.setText(result.error.length > 80 ? result.error.slice(0, 80) + '...' : result.error)
        }
      }

      if (result.success) done++
      else failed++
    }

    const msg = failed > 0
      ? `Done ${done} / Failed ${failed}`
      : `${done} files ingested`
    if (summaryEl) { summaryEl.empty(); summaryEl.setText(msg) }
    new Notice(msg)

    this.inboxSelections = new Set()
    setTimeout(() => this.renderInboxStatus(), 2000)
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
    const inboxAllSet = new Set(this.listInboxFilesRaw())

    // Title: "inbox | N" with styled number (paired sidecar.md excluded)
    const titleEl = inboxDiv.createDiv({ cls: 'wikey-ingest-section-label' })
    titleEl.createEl('span', { text: 'inbox | ' })
    titleEl.createEl('span', { text: String(files.length), cls: 'wikey-stat-number-white' })

    if (files.length === 0) {
      inboxDiv.createEl('span', { text: 'Empty', cls: 'wikey-ingest-inbox-empty' })
      return
    }

    this.inboxSelections = new Set()
    this.inboxRowMap = new Map()

    const basePath = (this.app.vault.adapter as any).basePath ?? ''
    const { existsSync, statSync } = require('node:fs') as typeof import('node:fs')
    const { join } = require('node:path') as typeof import('node:path')

    // Select all row
    const selectAllRow = inboxDiv.createDiv({ cls: 'wikey-audit-selectall' })
    const selectAllCb = selectAllRow.createEl('input', { attr: { type: 'checkbox' }, cls: 'wikey-audit-cb' })
    selectAllRow.createEl('span', { text: 'Select All', cls: 'wikey-audit-selectall-label' })

    // File list (scrollable)
    const listArea = inboxDiv.createDiv({ cls: 'wikey-audit-list-area' })
    const listEl = listArea.createDiv({ cls: 'wikey-audit-list' })

    const displayFiles = files.slice(0, 30)

    const paraFolders = [
      { value: 'auto', label: 'Auto' },
      { value: 'raw/1_projects', label: 'Project' },
      { value: 'raw/2_areas', label: 'Area' },
      { value: 'raw/3_resources', label: 'Resource' },
      { value: 'raw/4_archive', label: 'Archive' },
    ]

    // Bottom bar (2 rows for consistency with Audit panel)
    // Row 1 (top): Action — PARA select + Ingest + Delay (버튼 위치 고정)
    // Row 2 (bottom): Provider + Model (공간의 맨 아래)
    const bottomBar = inboxDiv.createDiv({ cls: 'wikey-audit-bottom' })

    // Row 1: Action
    const applyBar = bottomBar.createDiv({ cls: 'wikey-audit-apply-bar' })
    const applySummary = applyBar.createEl('span', { cls: 'wikey-audit-apply-summary wikey-inbox-apply-summary' })

    const classifySelect = applyBar.createEl('select', { cls: 'wikey-select' })
    for (const opt of paraFolders) {
      classifySelect.createEl('option', { text: opt.label, attr: { value: opt.value } })
    }

    const moveBtn = applyBar.createEl('button', { text: 'Ingest', cls: 'wikey-audit-apply-btn wikey-inbox-move-btn' })
    const delayBtn = applyBar.createEl('button', { text: 'Delay', cls: 'wikey-audit-delay-action-btn wikey-inbox-delay-btn' })
    moveBtn.setAttr('disabled', 'true')
    delayBtn.setAttr('disabled', 'true')

    // Row 2: Provider + Model (empty value → use Default Model from settings)
    const providerBar = bottomBar.createDiv({ cls: 'wikey-audit-apply-bar wikey-provider-model-bar' })
    const inboxProviderSelect = providerBar.createEl('select', { cls: 'wikey-select' })
    const inboxProviderOptions = [
      { value: '', text: 'DEFAULT' },
      { value: 'ollama', text: 'Local' },
      { value: 'gemini', text: 'Google Gemini' },
      { value: 'openai', text: 'OpenAI Codex' },
      { value: 'anthropic', text: 'Anthropic Claude' },
    ]
    const curInboxProvider = this.plugin.settings.ingestProvider || ''
    for (const opt of inboxProviderOptions) {
      const el = inboxProviderSelect.createEl('option', { text: opt.text, attr: { value: opt.value } })
      if (opt.value === curInboxProvider) el.selected = true
    }

    const inboxModelSelect = providerBar.createEl('select', { cls: 'wikey-select' })
    const savedInboxModel = this.plugin.settings.ingestModel || ''
    inboxModelSelect.createEl('option', { text: 'DEFAULT', attr: { value: '' } })

    const loadInboxModels = async (provider: string) => {
      inboxModelSelect.empty()
      const def = inboxModelSelect.createEl('option', { text: 'DEFAULT', attr: { value: '' } })
      if (!savedInboxModel) def.selected = true
      if (!provider) return
      try {
        const models = await (await import('wikey-core')).fetchModelList(provider as any, this.plugin.buildConfig(), this.plugin.httpClient)
        for (const m of models) {
          const opt = inboxModelSelect.createEl('option', { text: m, attr: { value: m } })
          if (m === savedInboxModel) opt.selected = true
        }
      } catch { /* API unavailable — keep default option only */ }
    }
    loadInboxModels(inboxProviderSelect.value)
    inboxProviderSelect.addEventListener('change', () => loadInboxModels(inboxProviderSelect.value))

    const updateApply = () => {
      const count = this.inboxSelections.size
      applySummary.empty()
      applySummary.createEl('span', { text: String(count), cls: 'wikey-stat-number-white' })
      applySummary.createEl('span', { text: ' selected' })
      if (count === 0) {
        moveBtn.setAttr('disabled', 'true')
        delayBtn.setAttr('disabled', 'true')
      } else {
        moveBtn.removeAttribute('disabled')
        delayBtn.removeAttribute('disabled')
      }
    }

    for (const f of displayFiles) {
      const fullPath = join(basePath, 'raw/0_inbox', f)
      const isDir = existsSync(fullPath) && statSync(fullPath).isDirectory()
      const hint = classifyFile(f, isDir)
      let fileSizeKb = 0
      if (!isDir && existsSync(fullPath)) {
        try { fileSizeKb = Math.round(statSync(fullPath).size / 1024) } catch { /* skip */ }
      }
      const sizeLabel = fileSizeKb >= 1024 ? `${(fileSizeKb / 1024).toFixed(1)}MB` : `${fileSizeKb}KB`
      const recommend = fileSizeKb > 1024 ? 'Cloud' : 'Local'

      const row = listEl.createDiv({ cls: 'wikey-audit-row' })
      this.inboxRowMap.set(f, row)

      const cb = row.createEl('input', { attr: { type: 'checkbox' }, cls: 'wikey-audit-cb' })

      const info = row.createDiv({ cls: 'wikey-audit-info' })
      const nameLine = info.createDiv({ cls: 'wikey-audit-name-line' })
      const nameWrap = nameLine.createDiv({ cls: 'wikey-audit-name-wrap' })
      const nameSpan = nameWrap.createEl('span', { text: f, cls: 'wikey-audit-name' })
      if (hasSidecar(f, inboxAllSet)) {
        const sidecarPath = join(basePath, 'raw/0_inbox', `${f}.md`)
        const tooltip = this.buildSidecarTooltip(sidecarPath, `${f}.md`)
        nameSpan.setAttr('title', tooltip)
        const badge = nameWrap.createEl('span', { text: 'md', cls: 'wikey-pair-sidecar-badge' })
        badge.setAttr('title', tooltip)
      }
      if (!isDir) nameLine.createEl('span', { text: sizeLabel, cls: 'wikey-audit-filesize' })
      const pathLine = info.createDiv({ cls: 'wikey-audit-path-line' })
      pathLine.createEl('span', { text: hint.hint, cls: 'wikey-audit-path' })
      if (!isDir) pathLine.createEl('span', { text: recommend, cls: `wikey-audit-recommend wikey-audit-recommend-${recommend.toLowerCase()}` })

      // Preserve prior fail state across re-renders (TTL 10min, cleared on retry)
      const failInfo = this.inboxFailState.get(f)
      if (failInfo && Date.now() - failInfo.timestamp < 10 * 60 * 1000) {
        row.addClass('wikey-audit-row-fail')
        const errEl = info.createDiv({ cls: 'wikey-audit-error' })
        errEl.setText(failInfo.error.length > 100 ? failInfo.error.slice(0, 100) + '...' : failInfo.error)
      } else if (failInfo) {
        this.inboxFailState.delete(f)
      }

      const toggleCb = () => {
        if ((cb as HTMLInputElement).checked) this.inboxSelections.add(f)
        else this.inboxSelections.delete(f)
        updateApply()
        const allChecked = displayFiles.every((x) => this.inboxSelections.has(x))
        ;(selectAllCb as HTMLInputElement).checked = allChecked
      }

      cb.addEventListener('change', toggleCb)
      row.addEventListener('click', (e) => {
        if (e.target === cb) return
        ;(cb as HTMLInputElement).checked = !(cb as HTMLInputElement).checked
        toggleCb()
      })
    }

    if (files.length > 30) {
      listEl.createEl('div', { text: `... and ${files.length - 30} more`, cls: 'wikey-audit-path', attr: { style: 'padding:4px' } })
    }

    // Select all handler
    selectAllCb.addEventListener('change', () => {
      const checked = (selectAllCb as HTMLInputElement).checked
      for (const f of displayFiles) {
        if (checked) this.inboxSelections.add(f)
        else this.inboxSelections.delete(f)
      }
      listEl.querySelectorAll('.wikey-audit-cb').forEach((el) => {
        (el as HTMLInputElement).checked = checked
      })
      updateApply()
    })

    // Ingest-then-move handler (llm-wiki.md stay-involved: fail → file stays in inbox for retry)
    moveBtn.addEventListener('click', async () => {
      const selected = [...this.inboxSelections]
      if (selected.length === 0) return
      const dest = classifySelect.value

      // Retry semantics: clear prior fail state before re-attempting
      for (const f of selected) this.inboxFailState.delete(f)

      // Apply inbox provider/model overrides (empty = Default Model). Restore at the end.
      const overrideProvider = inboxProviderSelect.value
      const overrideModel = inboxModelSelect.value
      const origBasicModel = this.plugin.settings.basicModel
      const origIngestProvider = this.plugin.settings.ingestProvider
      const origIngestModel = this.plugin.settings.ingestModel
      if (overrideProvider) {
        this.plugin.settings.basicModel = overrideProvider
        this.plugin.settings.ingestProvider = overrideProvider
      }
      if (overrideModel) this.plugin.settings.ingestModel = overrideModel

      moveBtn.setAttr('disabled', 'true')
      delayBtn.setAttr('disabled', 'true')

      // Resolve PARA destination per file (but do NOT move yet).
      //   auto          → classifyFileAsync (rules + needsThirdLevel 시 LLM fallback)
      //   수동 PARA     → classifyFileAsync(paraRoot=선택PARA) — sub-folder 는 동일 경로로 CLASSIFY.md/LLM 이 결정, PARA prefix 만 고정
      const plan: Array<{ name: string; dest: string }> = []
      for (const f of selected) {
        const fullPath = join(basePath, 'raw/0_inbox', f)
        const isDir = existsSync(fullPath) && statSync(fullPath).isDirectory()
        const paraRoot = dest === 'auto' ? undefined : dest
        const hint = await classifyFileAsync(f, isDir, {
          wikiFS: this.plugin.wikiFS,
          httpClient: this.plugin.httpClient,
          config: this.plugin.buildConfig(),
        }, { paraRoot })
        const targetDest = hint.destination || paraRoot || ''
        if (targetDest) plan.push({ name: f, dest: targetDest })
      }

      if (plan.length === 0) {
        new Notice('No destination resolved')
        this.renderInboxStatus()
        return
      }

      let done = 0
      let failed = 0
      for (const { name, dest: fileDest } of plan) {
        const row = this.inboxRowMap.get(name)
        let rowSpinner: HTMLElement | null = null
        if (row) {
          row.removeClass('wikey-audit-row-done')
          row.addClass('wikey-audit-row-active')
          row.style.setProperty('--progress', '0%')
          row.scrollIntoView({ block: 'nearest' })
          // Add loading spinner next to filename (until modal opens / extract starts)
          const nameEl = row.querySelector('.wikey-audit-name') as HTMLElement | null
          if (nameEl) {
            rowSpinner = document.createElement('span')
            rowSpinner.className = 'wikey-row-spinner'
            nameEl.insertAdjacentElement('afterend', rowSpinner)
          }
        }

        applySummary.empty()
        applySummary.createEl('span', { text: `${done + 1}/${plan.length}`, cls: 'wikey-stat-number-white' })
        applySummary.createEl('span', { text: ' ingesting...' })

        // Phase 1: Ingest from inbox (file stays in place if ingest fails)
        const ingestPath = `raw/0_inbox/${name}`
        let spinnerRemoved = false
        const result = await runIngest(
          this.plugin,
          ingestPath,
          (step, _total, _msg, subStep, subTotal) => {
            // First progress tick = modal/extract started → remove row spinner
            if (!spinnerRemoved && rowSpinner) {
              rowSpinner.remove()
              rowSpinner = null
              spinnerRemoved = true
            }
            if (row) {
              const pct = computeRowPct(step, subStep, subTotal)
              row.style.setProperty('--progress', `${pct}%`)
            }
          },
        )
        // Safety: always clean up spinner after runIngest completes
        if (rowSpinner) {
          rowSpinner.remove()
          rowSpinner = null
        }

        // Phase 2: §4.2 S2-4 — movePair 로 원본+sidecar 동반 이동 + registry 갱신 + frontmatter rewrite.
        if (result.success) {
          try {
            const moveResult = await movePair({
              basePath,
              sourceVaultPath: ingestPath,
              destDir: fileDest,
              wikiFS: this.plugin.wikiFS,
              renameGuard: this.plugin.renameGuard,
            })
            console.info(
              `[Wikey] post-ingest movePair: ${ingestPath} → ${fileDest} sidecar=${moveResult.movedSidecar}${moveResult.sidecarSkipReason ? ` [${moveResult.sidecarSkipReason}]` : ''}`,
            )
          } catch (err) {
            console.warn('[Wikey] post-ingest move failed:', name, err)
          }
        }

        if (row) {
          row.removeClass('wikey-audit-row-active')
          row.addClass(result.success ? 'wikey-audit-row-done' : 'wikey-audit-row-fail')
          row.style.removeProperty('--progress')
          if (!result.success && result.error) {
            const infoEl = row.querySelector('.wikey-audit-info') as HTMLElement | null
            const errEl = (infoEl ?? row).createDiv({ cls: 'wikey-audit-error' })
            errEl.setText(result.error.length > 80 ? result.error.slice(0, 80) + '...' : result.error)
          }
        }

        if (result.success) {
          done++
          this.inboxFailState.delete(name)
        } else if (result.cancelled) {
          // User cancelled — silent, no fail state, file remains in inbox
        } else {
          failed++
          if (result.error) {
            this.inboxFailState.set(name, { error: result.error, timestamp: Date.now() })
          }
        }
      }

      const msg = failed > 0
        ? `Done ${done} / Failed ${failed}`
        : `${done} files ingested`
      applySummary.empty()
      applySummary.setText(msg)
      new Notice(msg)

      // Restore provider/model overrides (if user picked them for this run only)
      this.plugin.settings.basicModel = origBasicModel
      this.plugin.settings.ingestProvider = origIngestProvider
      this.plugin.settings.ingestModel = origIngestModel
      await this.plugin.saveSettings()

      this.inboxSelections = new Set()
      setTimeout(() => this.renderInboxStatus(), 2000)
    })

    // Delay handler (move to _delayed)
    delayBtn.addEventListener('click', () => {
      const selected = [...this.inboxSelections]
      if (selected.length === 0) return
      const { renameSync, mkdirSync } = require('node:fs') as typeof import('node:fs')
      const delayedDir = join(basePath, 'raw/_delayed')
      if (!existsSync(delayedDir)) mkdirSync(delayedDir, { recursive: true })
      let moved = 0
      for (const f of selected) {
        try { renameSync(join(basePath, 'raw/0_inbox', f), join(delayedDir, f)); moved++ } catch { /* skip */ }
      }
      new Notice(`${moved} moved → raw/_delayed/`)
      this.inboxSelections = new Set()
      this.renderInboxStatus()
    })

    updateApply()
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
