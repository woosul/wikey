import { App, Modal, Notice, PluginSettingTab, Setting, TFile, requestUrl } from 'obsidian'
import {
  validateWiki, checkPii, reindexWiki, reindexCheck,
  INGEST_PROMPT_PATH, STAGE1_SUMMARY_PROMPT_PATH, STAGE2_MENTION_PROMPT_PATH, STAGE3_CANONICALIZE_PROMPT_PATH,
  BUNDLED_INGEST_PROMPT, BUNDLED_STAGE2_MENTION_PROMPT,
  loadEffectiveIngestPrompt, loadEffectiveStage2Prompt, loadEffectiveStage3Prompt,
  fetchModelList, ANTHROPIC_PING_MODEL,
  previewReset,
  resolveCliBinary,
} from 'wikey-core'
import type { LLMProvider, ResetScope } from 'wikey-core'
import type WikeyPlugin from './main'
import { ResetImpactModal } from './reset-modals'
import { executeReset } from './commands'
import { renderDeveloperUpdateItems } from './settings-tab-developer'

/**
 * §5.6.4 v0.7 — provider subsection spec (single source of truth for the three
 * provider blocks rendered in the LLM Model Authentication section). Bundles the per-provider
 * literals (heading text, CLI commands, settings field names, placeholder)
 * so the shared `renderProviderSubsection` stays provider-agnostic.
 */
interface ProviderSubsectionSpec {
  // §5.6.5 v0.5 (2026-05-14) — ollama-cloud joins the three subscription
  // providers using the same Auth Mode + Subscription + API Key shape
  // (user lock 2026-05-14: "다른 LLM과 동일한 구조").
  readonly provider: 'gemini' | 'anthropic' | 'openai' | 'ollama-cloud'
  readonly heading: string
  readonly apiKeyField:
    | 'geminiApiKey'
    | 'anthropicApiKey'
    | 'openaiApiKey'
    | 'ollamaCloudApiKey'
  readonly authModeField:
    | 'geminiAuthMode'
    | 'anthropicAuthMode'
    | 'openaiAuthMode'
    | 'ollamaCloudAuthMode'
  readonly apiKeyPlaceholder: string
  readonly signInLabel: string
  readonly signInCommand: string
  readonly signOutCommand: string
  readonly detectSubscription: () => boolean
}

export class WikeySettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: WikeyPlugin) {
    super(app, plugin)
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    containerEl.createEl('h2', { text: 'Wikey Settings' })

    this.renderEnvStatusSection(containerEl)
    this.renderBasicModelSection(containerEl)
    this.renderIngestModelSection(containerEl)
    this.renderIngestPromptSection(containerEl)
    this.renderSchemaOverrideSection(containerEl)
    this.renderGeneralSection(containerEl)
    this.renderApiKeysSection(containerEl)
    this.renderSearchSection(containerEl)
    this.renderAdvancedQueryTuningSection(containerEl)
    this.renderToolsSection(containerEl)
    this.renderResetSection(containerEl)
    this.renderAdvancedSection(containerEl)
    // Developer (advanced) — settings 맨 하단. developerMode ON 시만 표시.
    this.renderDeveloperSection(containerEl)
  }

  /**
   * Re-render the entire settings tab while preserving the user's current
   * scroll position. Toggles that change visible-control count (Advanced query
   * tuning master toggle, Developer mode, OCR provider, Per-task LLM Override,
   * provider/model swaps) call this instead of `this.display()` to avoid
   * the page jumping back to the top after a click.
   */
  private refreshPreservingScroll(): void {
    const scroller = this.containerEl.closest('.vertical-tab-content') as HTMLElement | null
      ?? (this.containerEl.parentElement as HTMLElement | null)
    const top = scroller?.scrollTop ?? 0
    this.display()
    if (scroller) scroller.scrollTop = top
  }

  // ── Section: Developer (advanced) ──
  // Heading + master toggle 항상 표시. master toggle ON 시에만 Allow toggle +
  // Update items 가 expand. (사용자 raise 2026-05-10: master ON/OFF 가 Developer
  // section 안에 있어야 자연스러움 — General 으로부터 분리)
  private renderDeveloperSection(containerEl: HTMLElement): void {
    const section = containerEl.createDiv({ cls: 'wikey-settings-developer-section' })
    section.createEl('h3', { text: 'Developer (advanced)' })

    new Setting(section)
      .setName('Developer mode')
      .setDesc('OFF (default) — hide vendor / dep / model upstream update tracking. ON — reveal the items below.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.developerMode)
          .onChange(async (value) => {
            this.plugin.settings.developerMode = value
            await this.plugin.saveSettings()
            this.refreshPreservingScroll()
          }),
      )

    if (!this.plugin.settings.developerMode) return

    new Setting(section)
      .setName('Allow upstream update check (network)')
      .setDesc('OFF (default) — skip external network calls. ON — fetch npm registry / GitHub releases / Ollama tags once on restart.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.allowUpdateCheck)
          .onChange(async (value) => {
            this.plugin.settings.allowUpdateCheck = value
            await this.plugin.saveSettings()
          }),
      )

    const items = this.plugin.updateCheckResult?.items ?? []
    if (items.length === 0) {
      section.createEl('p', {
        text: 'No update items reported (allow-toggle off or first launch).',
        cls: 'wikey-settings-status-desc',
      })
    } else {
      renderDeveloperUpdateItems(section, {
        items,
        analyses: this.plugin.updateAnalyses,
        onAnalyze: (item) => {
          void this.plugin.runUpdateAnalysis(item).then(() => this.refreshPreservingScroll())
        },
      })
    }
  }

  // ── §5.7.8 Section: Advanced query tuning (LLM per-query dynamic stopword paradigm) ──
  // Spec §1.4 default 권고 (Q5 LOCKED) — toggle / mode / timeout / cache size / provider
  // dropdown + model dropdown / advanced (temperature, max_tokens) / auto-extend threshold.
  // Default OFF (I16 / I7 backward compat). Provider override scoped to the filter LLM
  // only — other wikey LLM call sites (canonicalizer, ingest, etc.) are unaffected (I19).
  private renderAdvancedQueryTuningSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Advanced query tuning' })
    containerEl.createDiv({
      cls: 'wikey-settings-status-desc wikey-advanced-query-tuning-desc',
      text:
        'LLM analyzes each query semantically (domain marker / intent core / generic noise / disambiguator)' +
        ' to drop words that do not help retrieval, and improves recall with synonym rewrite and a HyDE-style answer expansion.' +
        ' Unlike static stoplists, the same word can be kept or dropped depending on the query intent.' +
        ' Budget: < 600 LLM tokens per query, p95 latency ≤ 1500ms (0 on cache hit).',
    })

    // Master toggle — ON/OFF. OFF 시 하단 controls 미표시 (expand/collapse).
    new Setting(containerEl)
      .setName('Enable advanced query tuning')
      .setDesc('OFF (default) — keeps the existing BM25 path. ON — adds 1~3 LLM calls per query and expands the options below.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.advancedQueryTuningEnabled)
          .onChange(async (v) => {
            this.plugin.settings.advancedQueryTuningEnabled = v
            await this.plugin.saveSettings()
            this.refreshPreservingScroll()
          }),
      )

    if (!this.plugin.settings.advancedQueryTuningEnabled) return

    this.renderStandardDropdown(
      containerEl,
      'Mode',
      'Layer combination — off / filter-only / filter+rewrite / filter+rewrite+expand.',
      [
        { value: 'off', label: 'off' },
        { value: 'filter-only', label: 'filter-only' },
        { value: 'filter-rewrite', label: 'filter + rewrite' },
        { value: 'filter-rewrite-expand', label: 'filter + rewrite + expand' },
      ],
      this.plugin.settings.advancedQueryTuningMode,
      async (v) => {
        this.plugin.settings.advancedQueryTuningMode =
          v as typeof this.plugin.settings.advancedQueryTuningMode
        await this.plugin.saveSettings()
      },
    )

    new Setting(containerEl)
      .setName('Filter timeout (ms)')
      .setDesc('LLM call timeout per layer. Exceed → fail-open + original query.')
      .addText((t) =>
        t
          .setValue(String(this.plugin.settings.advancedQueryTuningTimeoutMs))
          .onChange(async (v) => {
            const n = Number(v)
            if (Number.isFinite(n) && n > 0) {
              this.plugin.settings.advancedQueryTuningTimeoutMs = n
              await this.plugin.saveSettings()
            }
          }),
      )

    new Setting(containerEl)
      .setName('Cache size (entries)')
      .setDesc('Per-namespace LRU capacity (filter / rewrite / expand each).')
      .addText((t) =>
        t
          .setValue(String(this.plugin.settings.advancedQueryTuningCacheSize))
          .onChange(async (v) => {
            const n = Number(v)
            if (Number.isFinite(n) && n > 0) {
              this.plugin.settings.advancedQueryTuningCacheSize = n
              await this.plugin.saveSettings()
            }
          }),
      )

    // Filter LLM — provider + model in one row (matches Default / Ingest / OCR).
    const filterProvider =
      (this.plugin.settings.advancedQueryTuningProvider ||
        this.plugin.settings.basicModel ||
        'ollama') as LLMProvider
    this.renderProviderModelPair(
      containerEl,
      'Filter LLM Provider / Model',
      'BYOAI — used only for the search-time filter. DEFAULT inherits the Default Model.',
      [
        { value: '', label: 'DEFAULT' },
        { value: 'ollama', label: 'Local (Ollama)' },
        { value: 'gemini', label: 'Google Gemini' },
        { value: 'anthropic', label: 'Anthropic Claude' },
        { value: 'openai', label: 'OpenAI Codex' },
      ],
      this.plugin.settings.advancedQueryTuningProvider,
      async (v) => {
        const prev = this.plugin.settings.advancedQueryTuningProvider
        this.plugin.settings.advancedQueryTuningProvider = v
        if (v !== prev) {
          this.plugin.settings.advancedQueryTuningModel = ''
          new Notice('Filter model cleared (provider changed).')
        }
        await this.plugin.saveSettings()
        this.refreshPreservingScroll()
      },
      filterProvider,
      this.plugin.settings.advancedQueryTuningModel || '',
      async (v) => {
        this.plugin.settings.advancedQueryTuningModel = v
        await this.plugin.saveSettings()
      },
    )

    new Setting(containerEl)
      .setName('Temperature')
      .setDesc('Temperature for filter / rewrite / expand calls. 0.0 = deterministic.')
      .addText((t) =>
        t
          .setValue(String(this.plugin.settings.advancedQueryTuningTemperature))
          .onChange(async (v) => {
            const n = Number(v)
            if (Number.isFinite(n) && n >= 0) {
              this.plugin.settings.advancedQueryTuningTemperature = n
              await this.plugin.saveSettings()
            }
          }),
      )

    new Setting(containerEl)
      .setName('Max tokens')
      .setDesc('LLM response max_tokens. 500 default.')
      .addText((t) =>
        t
          .setValue(String(this.plugin.settings.advancedQueryTuningMaxTokens))
          .onChange(async (v) => {
            const n = Number(v)
            if (Number.isFinite(n) && n > 0) {
              this.plugin.settings.advancedQueryTuningMaxTokens = n
              await this.plugin.saveSettings()
            }
          }),
      )

    new Setting(containerEl)
      .setName('Auto-extend threshold (queries)')
      .setDesc('Append the LLM analysis result to the benchmark suite automatically once this many (query, answer) pairs accumulate. Recommended: 1~50.')
      .addText((t) =>
        t
          .setValue(String(this.plugin.settings.advancedQueryTuningAutoExtendThreshold))
          .onChange(async (v) => {
            const n = Number(v)
            if (Number.isInteger(n) && n >= 1 && n <= 50) {
              this.plugin.settings.advancedQueryTuningAutoExtendThreshold = n
              await this.plugin.saveSettings()
            }
          }),
      )

    new Setting(containerEl)
      .setName('Run query analysis (manual trigger)')
      .setDesc('Analyze accumulated (query, answer) pairs from chat now and append the result to the benchmark suite.')
      .addButton((b) =>
        b.setButtonText('Run now').onClick(async () => {
          await this.plugin.runQueryAnalysis()
        }),
      )

    // ── §5.7.7 Hybrid search (BM25 + Qwen3-Embedding + RRF) ──
    // Sub-control of master toggle (Q9 LOCKED v1.2). Default OFF (Spec I15 backward
    // compat). Toggle 단일 (Q10 LOCKED v1.1) — mode dropdown 폐기, binary state 충분.
    containerEl.createEl('h4', { text: 'Hybrid search (BM25 + vector)' })
    containerEl.createDiv({
      cls: 'wikey-settings-status-desc',
      text:
        'Combine BM25 keyword + Qwen3-Embedding 0.6B vector search via RRF fusion.' +
        ' Requires Ollama + dengcao/Qwen3-Embedding-0.6B:Q8_0 (639MB, Apache-2.0, 1024D).' +
        ' Cold reindex p95 ≤ 5min (CPU). Default OFF (existing BM25-only path preserved).',
    })

    new Setting(containerEl)
      .setName('Enable hybrid search')
      .setDesc('OFF (default) — BM25-only. ON — adds Qwen3 embedding generation per page + per query, then RRF-fuses both rankings.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.searchHybridEnabled)
          .onChange(async (v) => {
            this.plugin.settings.searchHybridEnabled = v
            await this.plugin.saveSettings()
            // §5.7.7 cycle #2 codex MED #5 fix — I19 download status reactive.
            // OFF → idle (cleanup). ON → checkInstallStatus 후 status 갱신. ensureInstalled
            // 미동작 (auto-pull)은 명시 button 으로 분리 (사용자 실수 통제 + ollama pull 시간).
            // ollama 미동작 시 status='failed' + auto OFF (사용자 mental model 명확화).
            if (!v) {
              this.plugin.settings.searchQwen3DownloadStatus = 'idle'
              await this.plugin.saveSettings()
            } else {
              try {
                const { createQwen3Loader } = await import('wikey-core')
                const loader = createQwen3Loader({ ollamaUrl: this.plugin.settings.ollamaUrl })
                // §5.7.7 cycle #3 codex MED #3 fix — ensureInstalled (auto-pull) 사용.
                // checkInstallStatus 만 하면 model 부재 시 'idle' 반환 → 'installed' 외 모두
                // 인지 가능하나 'idle' 상태에서 Hybrid ON 가능 → 첫 query 시 BM25 silent
                // fallback. ensureInstalled 가 자동 ollama pull 진행 (Q5 LOCKED v1.2). 'failed'
                // 또는 'idle' (pull 후에도 미설치) → auto-OFF + Notice.
                this.plugin.settings.searchQwen3DownloadStatus = 'downloading'
                await this.plugin.saveSettings()
                // §5.7.7 cycle #4 codex HIGH #3 fix — UI badge 즉시 표시 (pull 분 단위).
                this.refreshPreservingScroll()
                const st = await loader.ensureInstalled()
                this.plugin.settings.searchQwen3DownloadStatus = st
                if (st !== 'installed') {
                  // 'idle'/'failed' — auto-OFF (user mental model: "Hybrid ON requires Qwen3").
                  this.plugin.settings.searchHybridEnabled = false
                }
                await this.plugin.saveSettings()
              } catch (err) {
                this.plugin.settings.searchQwen3DownloadStatus = 'failed'
                this.plugin.settings.searchHybridEnabled = false
                await this.plugin.saveSettings()
                // eslint-disable-next-line no-console
                console.warn('[wikey] Qwen3 ensureInstalled failed:', err)
              }
            }
            this.refreshPreservingScroll()
          }),
      )

    if (this.plugin.settings.searchHybridEnabled) {
      new Setting(containerEl)
        .setName('RRF k value')
        .setDesc('Reciprocal Rank Fusion constant (default 60, per the paper). Smaller k → top ranks weighted more.')
        .addText((t) =>
          t
            .setValue(String(this.plugin.settings.searchRrfK))
            .onChange(async (v) => {
              const n = Number(v)
              if (Number.isInteger(n) && n >= 1 && n <= 200) {
                this.plugin.settings.searchRrfK = n
                await this.plugin.saveSettings()
              }
            }),
        )

      // Qwen3 model download status badge (4 phase: idle / downloading / installed / failed).
      const statusRow = containerEl.createDiv({ cls: 'wikey-settings-status-row' })
      const statusLabelWrap = statusRow.createDiv({ cls: 'wikey-settings-status-label-wrap' })
      statusLabelWrap.createEl('span', {
        text: 'Qwen3-Embedding 0.6B',
        cls: 'wikey-settings-status-label',
      })
      statusLabelWrap.createEl('span', {
        text: 'Embedding model (Q8_0, 1024D, 639MB). Auto-pull via `ollama pull` on first hybrid query.',
        cls: 'wikey-settings-status-desc',
      })
      const status = this.plugin.settings.searchQwen3DownloadStatus
      const statusBadgeCls =
        status === 'installed'
          ? 'wikey-status-ok'
          : status === 'downloading'
            ? 'wikey-status-neutral'
            : status === 'failed'
              ? 'wikey-status-error'
              : 'wikey-status-neutral'
      const statusText =
        status === 'installed'
          ? 'Installed'
          : status === 'downloading'
            ? 'Downloading...'
            : status === 'failed'
              ? 'Failed (check Ollama)'
              : 'Not installed'
      statusRow.createEl('span', {
        text: statusText,
        cls: `wikey-settings-status-badge ${statusBadgeCls}`,
      })
    }
  }

  // ── Section: Reset (Phase 4.5.2) ──
  private renderResetSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Reset' })
    containerEl.createEl('p', {
      text: 'Reset the selected scope. Preview is shown first; you must type "RESET <SCOPE>" to confirm before anything is deleted.',
      cls: 'wikey-settings-status-label',
    })

    let selectedScope: ResetScope = 'wiki+registry'

    new Setting(containerEl)
      .setName('Scope')
      .setDesc('Choose what to reset. raw/ is never touched.')
      .addDropdown((dd) => {
        dd.addOption('wiki+registry', 'wiki + registry')
        dd.addOption('wiki-only', 'wiki only')
        dd.addOption('registry-only', 'registry only')
        dd.addOption('qmd-index', 'qmd index')
        dd.addOption('settings', 'settings (data.json)')
        dd.setValue(selectedScope)
        dd.onChange((v) => {
          selectedScope = v as ResetScope
        })
      })
      .addButton((b) =>
        b.setButtonText('Preview & Reset')
          .setWarning()
          .onClick(async () => {
            const preview = await previewReset({ wikiFS: this.plugin.wikiFS, scope: selectedScope })
            new ResetImpactModal(this.plugin.app, {
              scope: selectedScope,
              preview,
              onConfirm: async () => {
                await executeReset(this.plugin, selectedScope, preview.files)
              },
            }).open()
          }),
      )
  }

  // ── Section 1: Environment Status ──
  private renderEnvStatusSection(containerEl: HTMLElement): void {
    // Header row: title + Re-detect button on right
    const headerRow = containerEl.createDiv({ cls: 'wikey-settings-section-header' })
    headerRow.createEl('h3', { text: 'Environment' })
    const headerBtn = headerRow.createEl('button', { text: 'Re-detect', cls: 'wikey-settings-section-btn' })
    headerBtn.addEventListener('click', async () => {
      headerBtn.textContent = 'Detecting...'
      headerBtn.setAttr('disabled', 'true')
      await this.plugin.runEnvDetection()
      this.display()
    })

    const env = this.plugin.envStatus
    const statusContainer = containerEl.createDiv({ cls: 'wikey-settings-status-group' })

    if (!env) {
      statusContainer.createEl('p', { text: 'Detecting environment...', cls: 'wikey-settings-status-label' })
      return
    }

    const items: Array<{ label: string; value: string; ok: boolean; desc: string; optional?: boolean }> = [
      { label: 'Node.js', value: env.nodePath || 'Not found', ok: !!env.nodePath, desc: 'Runtime for wikey-core search engine' },
      { label: 'Python3', value: env.pythonPath || 'Not found', ok: !!env.pythonPath, desc: 'Required for Korean tokenizer & PDF processing' },
      { label: 'kiwipiepy', value: env.hasKiwipiepy ? 'Installed' : 'Not installed', ok: env.hasKiwipiepy, desc: 'Korean morpheme analyzer for search accuracy' },
      // §5.7.7 — wikey in-process search engine (Orama + Kiwi WASM). required.
      { label: 'wikiNLP', value: env.hasWikiNlp ? 'Installed' : 'Not found', ok: env.hasWikiNlp, desc: 'In-process search engine: Orama BM25 + Kiwi WASM tokenizer (1024D vector ready)' },
      // §5.7.7 — qmd 격하 (legacy fallback, opt-in via Search engine setting).
      { label: 'qmd', value: env.qmdPath || 'Not configured', ok: !!env.qmdPath, optional: true, desc: 'Legacy fallback search engine (opt-in via Search engine setting)' },
      { label: 'Ollama', value: env.ollamaRunning ? `Running (${env.ollamaModels.length} models)` : 'Not running', ok: env.ollamaRunning, desc: 'Local LLM server for private inference' },
      { label: 'Qwen3 8B', value: env.hasQwen3 ? 'Installed' : 'Optional', ok: env.hasQwen3, optional: true, desc: 'Ingest option (5.2GB, fast, JSON reliable)' },
      { label: 'Qwen3.6:35b-a3b', value: env.hasQwen36 ? 'Installed' : 'Optional', ok: env.hasQwen36, optional: true, desc: 'Ingest high-quality option (24GB MoE, ≥48GB RAM)' },
      { label: 'Gemma4', value: env.hasGemma4 ? 'Installed' : 'Optional', ok: env.hasGemma4, optional: true, desc: 'Query/CR synthesis option (not used for ingest)' },
      // §5.7.7 — Qwen3-Embedding 0.6B (hybrid search vector embedding).
      { label: 'Qwen3-Embedding 0.6B', value: env.hasQwen3Embedding ? 'Installed' : 'Optional', ok: env.hasQwen3Embedding, optional: true, desc: 'Hybrid search vector embedding (Q8_0, 1024D, 639MB). Required when Hybrid search ON' },
      { label: 'Docling', value: env.hasDocling ? `v${env.doclingVersion}` : 'Not installed', ok: env.hasDocling, desc: 'Main converter — PDF/DOCX/PPTX/XLSX/HTML/image (TableFormer + ocrmac). uv tool install docling' },
      { label: 'unhwp', value: env.hasUnhwp ? 'Installed' : 'Optional', ok: env.hasUnhwp, optional: true, desc: 'HWP/HWPX (Hangul) converter. pip install unhwp' },
      { label: 'MarkItDown', value: env.hasMarkitdown ? 'Installed' : 'Optional', ok: env.hasMarkitdown, optional: true, desc: 'Fallback converter (used when docling is unavailable)' },
      { label: 'MarkItDown OCR', value: env.hasMarkitdownOcr ? 'Installed' : 'Optional', ok: env.hasMarkitdownOcr, optional: true, desc: 'Scanned-PDF OCR fallback (markitdown-ocr + openai SDK, uses Ollama vision model)' },
    ]

    for (const item of items) {
      const row = statusContainer.createDiv({ cls: 'wikey-settings-status-row' })
      const labelWrap = row.createDiv({ cls: 'wikey-settings-status-label-wrap' })
      const labelEl = labelWrap.createEl('span', { text: item.label, cls: 'wikey-settings-status-label' })
      if (!item.optional) {
        labelEl.createEl('span', { cls: 'wikey-settings-status-required-dot', attr: { 'aria-label': 'required', title: 'Required' } })
      }
      labelWrap.createEl('span', { text: item.desc, cls: 'wikey-settings-status-desc' })
      const badgeCls = item.ok
        ? 'wikey-status-ok'
        : item.optional
          ? 'wikey-status-neutral'
          : 'wikey-status-error'
      row.createEl('span', {
        text: item.value,
        cls: `wikey-settings-status-badge ${badgeCls}`,
      })
    }

    if (env.issues.length > 0) {
      const issueBox = containerEl.createDiv({ cls: 'wikey-settings-warning' })
      issueBox.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/></svg> ${env.issues.join(' | ')}`
    }

    new Setting(containerEl)
      .setName('Ollama URL')
      .setDesc('Ollama server address')
      .addText((text) =>
        text
          .setPlaceholder('http://localhost:11434')
          .setValue(this.plugin.settings.ollamaUrl)
          .onChange(async (value) => {
            this.plugin.settings.ollamaUrl = value
            await this.plugin.saveSettings()
          }),
      )

    if (!env.ollamaRunning) {
      new Setting(containerEl)
        .setDesc('Install and run Ollama to use local models.')
        .addButton((btn) => btn.setButtonText('Ollama Install Guide').onClick(() => window.open('https://ollama.com')))
    }

    if (!env.hasDocling) {
      new Setting(containerEl)
        .setDesc('Docling is the main document converter. Falls back to MarkItDown when unavailable.')
        .addButton((btn) =>
          btn.setButtonText('Docling Install Guide').onClick(() =>
            window.open('https://docling-project.github.io/docling/installation/'),
          ),
        )
    }

    if (!env.hasUnhwp && env.pythonPath) {
      new Setting(containerEl)
        .setDesc('Install unhwp to ingest HWP/HWPX (Hangul) documents.')
        .addButton((btn) =>
          btn.setButtonText('Install unhwp').onClick(async () => {
            btn.setButtonText('Installing...')
            btn.setDisabled(true)
            try {
              const { execFile: ef } = require('node:child_process') as typeof import('node:child_process')
              const { promisify: p } = require('node:util') as typeof import('node:util')
              const execAsync = p(ef)
              const shellPath = this.plugin.envStatus?.shellPath ?? process.env.PATH ?? ''
              await execAsync('pip3', ['install', 'unhwp'], {
                timeout: 120000,
                env: { ...process.env, PATH: shellPath } as Record<string, string>,
              })
              btn.setButtonText('Installed')
              btn.buttonEl.addClass('wikey-btn-success')
              new Notice('unhwp installed successfully')
              setTimeout(() => this.display(), 2000)
            } catch (err: any) {
              btn.setButtonText('Failed')
              btn.buttonEl.addClass('wikey-btn-error')
              new Notice(`Install failed: ${err?.message ?? err}`)
              setTimeout(() => { btn.setButtonText('Install unhwp'); btn.setDisabled(false); btn.buttonEl.removeClass('wikey-btn-error') }, 3000)
            }
          }),
        )
    }

    if (!env.hasMarkitdown && env.pythonPath) {
      new Setting(containerEl)
        .setDesc('Install MarkItDown (fallback converter when docling is unavailable).')
        .addButton((btn) =>
          btn.setButtonText('Install MarkItDown').onClick(async () => {
            btn.setButtonText('Installing...')
            btn.setDisabled(true)
            try {
              const { execFile: ef } = require('node:child_process') as typeof import('node:child_process')
              const { promisify: p } = require('node:util') as typeof import('node:util')
              const execAsync = p(ef)
              const shellPath = this.plugin.envStatus?.shellPath ?? process.env.PATH ?? ''
              await execAsync('pip3', ['install', 'markitdown[pdf]'], {
                timeout: 120000,
                env: { ...process.env, PATH: shellPath } as Record<string, string>,
              })
              btn.setButtonText('Installed')
              btn.buttonEl.addClass('wikey-btn-success')
              new Notice('MarkItDown installed successfully')
              setTimeout(() => this.display(), 2000)
            } catch (err: any) {
              btn.setButtonText('Failed')
              btn.buttonEl.addClass('wikey-btn-error')
              new Notice(`Install failed: ${err?.message ?? err}`)
              setTimeout(() => { btn.setButtonText('Install MarkItDown'); btn.setDisabled(false); btn.buttonEl.removeClass('wikey-btn-error') }, 3000)
            }
          }),
        )
    }
  }

  // ── Section 2: Default Model ──
  private renderBasicModelSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Default Model' })

    this.renderProviderModelPair(
      containerEl,
      'Provider / Model',
      'Default LLM for all tasks. Per-task overrides live in Advanced settings.',
      [
        { value: 'ollama', label: 'Local (Ollama)' },
        { value: 'gemini', label: 'Google Gemini' },
        { value: 'anthropic', label: 'Anthropic Claude' },
        { value: 'openai', label: 'OpenAI Codex' },
        { value: 'claude-code', label: 'Anthropic Claude' },
      ],
      this.plugin.settings.basicModel,
      async (value) => {
        const prev = this.plugin.settings.basicModel
        this.plugin.settings.basicModel = value
        if (value !== prev) {
          if (this.plugin.settings.cloudModel) this.plugin.settings.cloudModel = ''
          const inherits = !this.plugin.settings.ingestProvider
          if (inherits && this.plugin.settings.ingestModel) this.plugin.settings.ingestModel = ''
          new Notice('Default model cleared (provider changed).')
        }
        await this.plugin.saveSettings()
        this.refreshPreservingScroll()
      },
      this.plugin.settings.basicModel as LLMProvider,
      this.plugin.settings.cloudModel || '',
      async (value) => {
        this.plugin.settings.cloudModel = value
        await this.plugin.saveSettings()
      },
    )
  }

  /**
   * Render a single Setting row that holds two `.wikey-select` controls side by
   * side — provider on the left, model on the right. Mirrors the chat panel
   * provider/model header bar so the same pattern applies across all settings
   * (Default Model / Ingest Model / Filter LLM / OCR).
   */
  private renderProviderModelPair(
    containerEl: HTMLElement,
    name: string,
    desc: string,
    providerOptions: ReadonlyArray<{ value: string; label: string }>,
    currentProvider: string,
    onProviderChange: (value: string) => Promise<void>,
    effectiveProvider: LLMProvider,
    currentModel: string,
    onModelChange: (value: string) => Promise<void>,
  ): void {
    const setting = new Setting(containerEl).setName(name).setDesc(desc)

    // Provider select (static options)
    const providerEl = document.createElement('select')
    providerEl.classList.add('wikey-select', 'wikey-select-provider')
    for (const opt of providerOptions) {
      const o = new Option(opt.label, opt.value)
      if (opt.value === currentProvider) o.selected = true
      providerEl.appendChild(o)
    }
    providerEl.addEventListener('change', async () => {
      await onProviderChange(providerEl.value)
    })
    setting.controlEl.appendChild(providerEl)

    // Model select (dynamic via fetchModelList)
    const modelEl = document.createElement('select')
    modelEl.classList.add('wikey-select', 'wikey-select-model')
    modelEl.disabled = true
    modelEl.appendChild(new Option('(loading...)', ''))
    setting.controlEl.appendChild(modelEl)

    void (async () => {
      try {
        const models = await fetchModelList(
          effectiveProvider,
          this.plugin.buildConfig(),
          this.plugin.httpClient,
        )
        modelEl.innerHTML = ''
        modelEl.appendChild(new Option('DEFAULT', ''))
        let matched = false
        for (const m of models) {
          const opt = new Option(m, m)
          if (m === currentModel) { opt.selected = true; matched = true }
          modelEl.appendChild(opt)
        }
        if (currentModel && !matched) {
          const opt = new Option(`${currentModel} (custom)`, currentModel)
          opt.selected = true
          modelEl.appendChild(opt)
        }
        modelEl.disabled = false
        modelEl.addEventListener('change', async () => {
          await onModelChange(modelEl.value)
        })
      } catch {
        modelEl.innerHTML = ''
        modelEl.appendChild(new Option('(API unavailable)', ''))
        modelEl.disabled = true
      }
    })()
  }

  /**
   * Render a standard-styled select (`.wikey-select`) for static options.
   * Use this instead of Setting.addDropdown to match Audit/Ingest panel UI.
   */
  private renderStandardDropdown(
    containerEl: HTMLElement,
    name: string,
    desc: string,
    options: ReadonlyArray<{ value: string; label: string }>,
    currentValue: string,
    onChange: (value: string) => Promise<void>,
  ): void {
    const setting = new Setting(containerEl).setName(name).setDesc(desc)
    const selectEl = document.createElement('select')
    selectEl.classList.add('wikey-select')
    for (const opt of options) {
      const o = new Option(opt.label, opt.value)
      if (opt.value === currentValue) o.selected = true
      selectEl.appendChild(o)
    }
    selectEl.addEventListener('change', async () => {
      await onChange(selectEl.value)
    })
    setting.controlEl.appendChild(selectEl)
  }

  /**
   * Render a model selector that dynamically fetches the provider's model list.
   * Falls back to a plain text input if the API call fails (no API key, offline).
   */
  private renderModelDropdown(
    containerEl: HTMLElement,
    name: string,
    desc: string,
    provider: LLMProvider,
    currentValue: string,
    onChange: (value: string) => Promise<void>,
  ): void {
    const setting = new Setting(containerEl).setName(name).setDesc(desc)
    const selectEl = document.createElement('select')
    selectEl.classList.add('wikey-select')
    selectEl.disabled = true
    selectEl.appendChild(new Option('(loading...)', ''))
    setting.controlEl.appendChild(selectEl)

    void (async () => {
      try {
        const models = await fetchModelList(provider, this.plugin.buildConfig(), this.plugin.httpClient)
        selectEl.innerHTML = ''
        selectEl.appendChild(new Option('DEFAULT', ''))
        let matched = false
        for (const m of models) {
          const opt = new Option(m, m)
          if (m === currentValue) { opt.selected = true; matched = true }
          selectEl.appendChild(opt)
        }
        if (currentValue && !matched) {
          // Preserve existing custom value even if API didn't list it
          const opt = new Option(`${currentValue} (custom)`, currentValue)
          opt.selected = true
          selectEl.appendChild(opt)
        }
        selectEl.disabled = false
        selectEl.addEventListener('change', async () => {
          await onChange(selectEl.value)
        })
      } catch (err) {
        selectEl.innerHTML = ''
        const opt = new Option('(API unavailable — check API key)', '')
        selectEl.appendChild(opt)
        selectEl.disabled = true
      }
    })()
  }

  // ── Section: Ingest Model ──
  private renderIngestModelSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Ingest Model' })

    const effectiveIngestProvider = (this.plugin.settings.ingestProvider || this.plugin.settings.basicModel) as LLMProvider
    this.renderProviderModelPair(
      containerEl,
      'Provider / Model',
      'Provider + model for document ingestion. DEFAULT inherits Default Model.',
      [
        { value: '', label: 'DEFAULT' },
        { value: 'ollama', label: 'Local (Ollama)' },
        { value: 'gemini', label: 'Google Gemini' },
        { value: 'openai', label: 'OpenAI Codex' },
        { value: 'anthropic', label: 'Anthropic Claude' },
      ],
      this.plugin.settings.ingestProvider,
      async (value) => {
        const prev = this.plugin.settings.ingestProvider
        this.plugin.settings.ingestProvider = value
        if (value !== prev && this.plugin.settings.ingestModel) {
          this.plugin.settings.ingestModel = ''
          new Notice('Ingest model cleared (provider changed).')
        }
        await this.plugin.saveSettings()
        this.refreshPreservingScroll()
      },
      effectiveIngestProvider,
      this.plugin.settings.ingestModel || '',
      async (value) => {
        this.plugin.settings.ingestModel = value
        await this.plugin.saveSettings()
      },
    )
  }

  // ── Section: Ingest Prompts (§4.3.1 3-stage override) ──
  // Note: `.wikey/` is a hidden folder (dot-prefixed), so vault metadata
  // (getAbstractFileByPath, getFiles) does not track files inside it.
  // Use vault.adapter.* for all existence checks and writes.
  private renderIngestPromptSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Ingest Prompts' })
    const intro = containerEl.createDiv({ cls: 'wikey-settings-status-desc' })
    intro.createSpan({
      text: 'Ingest runs in three stages — Stage 1 summary → Stage 2 mention → Stage 3 canonicalize. Each stage prompt can be overridden independently.',
    })

    this.renderPromptRow(containerEl, {
      title: 'Stage 1 — Source summary',
      description: 'Source → source_page summary. Variables: {{TODAY}}, {{INDEX_CONTENT}}, {{SOURCE_FILENAME}}, {{SOURCE_CONTENT}}.',
      canonicalPath: STAGE1_SUMMARY_PROMPT_PATH,
      legacyPath: INGEST_PROMPT_PATH,
      loader: async (wikiFS) => loadEffectiveIngestPrompt(wikiFS),
      bundled: BUNDLED_INGEST_PROMPT,
      inlineHint: 'Do not write raw `[[wikilink]]`s in the source_page body — only pages that survive canonicalization (Stage 2/3) stay as wikilinks; the rest are demoted to plain text (§4.3.3).',
    })

    this.renderPromptRow(containerEl, {
      title: 'Stage 2 — Mention extraction',
      description: 'Chunk → Mention JSON. Variables: {{SOURCE_FILENAME}}, {{CHUNK_CONTENT}}.',
      canonicalPath: STAGE2_MENTION_PROMPT_PATH,
      loader: async (wikiFS) => {
        const res = await loadEffectiveStage2Prompt(wikiFS)
        return res.prompt
      },
      bundled: BUNDLED_STAGE2_MENTION_PROMPT,
      inlineHint: 'Preserve the output schema (`{"mentions": [...]}`) — any other shape causes the pipeline to treat the chunk as 0 mentions.',
    })

    this.renderPromptRow(containerEl, {
      title: 'Stage 3 — Canonicalizer',
      description: 'Mention → canonical entity/concept. Variables: {{SOURCE_FILENAME}}, {{GUIDE_BLOCK}}, {{SCHEMA_BLOCK}}, {{EXISTING_BLOCK}}, {{MENTIONS_BLOCK}}, {{MENTIONS_COUNT}}.',
      canonicalPath: STAGE3_CANONICALIZE_PROMPT_PATH,
      loader: async (wikiFS) => {
        const res = await loadEffectiveStage3Prompt(wikiFS)
        return res.overridden ? res.prompt : ''
      },
      bundled: '', // bundled body is generated by canonicalizer.ts — the editor only edits the override.
      inlineHint: 'Preserve the JSON output (`entities/concepts/index_additions/log_entry`). Removing SCHEMA_BLOCK leaves the canonicalizer without a list of allowed types.',
    })
  }

  /**
   * §4.3.1 helper — single Stage prompt row (Edit + Reset + status).
   * canonicalPath is the override target; if legacyPath also exists, its presence is reported as "Custom override".
   */
  private renderPromptRow(
    containerEl: HTMLElement,
    opts: {
      title: string
      description: string
      canonicalPath: string
      legacyPath?: string
      loader: (wikiFS: import('wikey-core').WikiFS) => Promise<string>
      bundled: string
      inlineHint?: string
    },
  ): void {
    const { vault } = this.plugin.app
    containerEl.createEl('h4', { text: opts.title })
    if (opts.inlineHint) {
      containerEl.createDiv({ cls: 'wikey-settings-status-desc', text: opts.inlineHint })
    }
    const descEl = containerEl.createDiv({ cls: 'wikey-settings-status-desc' })
    const statusSpan = descEl.createSpan({ text: `${opts.description} Status: …` })

    let resetButton: HTMLButtonElement | null = null
    new Setting(containerEl)
      .setName('Edit prompt')
      .setDesc(`Open the current ${opts.title.toLowerCase()} prompt in a popup editor. Save writes ${opts.canonicalPath}; Reset removes it.`)
      .addButton((btn) =>
        btn.setButtonText('Edit').onClick(async () => {
          try {
            const wikiFS = this.plugin.wikiFS
            const current = await opts.loader(wikiFS)
            const initial = current || opts.bundled
            new IngestPromptEditModal(this.plugin.app, initial, async (next) => {
              const parent = opts.canonicalPath.split('/').slice(0, -1).join('/')
              if (parent && !(await vault.adapter.exists(parent))) {
                await vault.createFolder(parent)
              }
              await vault.adapter.write(opts.canonicalPath, next)
              new Notice(`${opts.title} prompt saved.`)
              this.display()
            }, opts.title).open()
          } catch (err) {
            new Notice(`Failed to open prompt editor: ${(err as Error).message}`)
          }
        }),
      )
      .addButton((btn) => {
        resetButton = btn.buttonEl as HTMLButtonElement
        btn.setButtonText('Reset').setDisabled(true).onClick(async () => {
          const hasCanonical = await vault.adapter.exists(opts.canonicalPath)
          const hasLegacy = opts.legacyPath ? await vault.adapter.exists(opts.legacyPath) : false
          if (!hasCanonical && !hasLegacy) {
            new Notice('Already using bundled default.')
            return
          }
          const targets = [hasCanonical ? opts.canonicalPath : null, hasLegacy ? opts.legacyPath! : null].filter(Boolean)
          if (!confirm(`Reset ${opts.title} to bundled default? This deletes ${targets.join(' + ')}.`)) return
          for (const t of targets) await vault.adapter.remove(t as string)
          new Notice(`${opts.title} reset to default.`)
          this.display()
        })
      })

    void (async () => {
      const hasCanonical = await vault.adapter.exists(opts.canonicalPath)
      const hasLegacy = opts.legacyPath ? await vault.adapter.exists(opts.legacyPath) : false
      const isCustom = hasCanonical || hasLegacy
      const label = isCustom
        ? hasCanonical
          ? `Custom override at ${opts.canonicalPath}`
          : `Legacy override at ${opts.legacyPath}`
        : 'Bundled default'
      statusSpan.setText(`${opts.description} Status: ${label}.`)
      if (resetButton) (resetButton as HTMLButtonElement).disabled = !isCustom
    })()
  }

  // ── Section: Schema Override (.wikey/schema.yaml — v7-5) ──
  private renderSchemaOverrideSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Schema Override' })

    const { vault } = this.plugin.app
    const path = '.wikey/schema.yaml'
    const descEl = containerEl.createDiv({ cls: 'wikey-settings-status-desc' })
    const statusSpan = descEl.createSpan({
      text: 'Customize aliases (canonical slug folds). Status: …',
    })

    let removeButton: HTMLButtonElement | null = null
    new Setting(containerEl)
      .setName('Edit schema.yaml')
      .setDesc('Define aliases (variant labels collapsing into one slug). Custom PII regexes go in .wikey/pii-patterns.yaml (separate file).')
      .addButton((btn) =>
        btn.setButtonText('Edit').onClick(async () => {
          try {
            const exists = await vault.adapter.exists(path)
            const current = exists ? await vault.adapter.read(path) : SCHEMA_OVERRIDE_TEMPLATE
            new SchemaOverrideEditModal(this.plugin.app, current, async (next) => {
              const parent = '.wikey'
              if (!(await vault.adapter.exists(parent))) {
                await vault.createFolder(parent)
              }
              await vault.adapter.write(path, next)
              new Notice('Schema override saved.')
              this.display()
            }).open()
          } catch (err) {
            new Notice(`Failed to open schema editor: ${(err as Error).message}`)
          }
        }),
      )
      .addButton((btn) => {
        removeButton = btn.buttonEl as HTMLButtonElement
        btn.setButtonText('Remove').setDisabled(true).onClick(async () => {
          if (!(await vault.adapter.exists(path))) {
            new Notice('No schema override in use.')
            return
          }
          if (!confirm(`Remove schema override? This deletes ${path}.`)) return
          await vault.adapter.remove(path)
          new Notice('Schema override removed.')
          this.display()
        })
      })

    // §5.10.4 D-wide: schema.yaml 은 `aliases:` 만 보존 (entity_types / concept_types
    // / standard_decompositions 폐기). PII 는 별 file.
    void (async () => {
      const exists = await vault.adapter.exists(path)
      if (!exists) {
        statusSpan.setText('Customize aliases (canonical slug folds). Status: no override file.')
        if (removeButton) (removeButton as HTMLButtonElement).disabled = true
        return
      }
      statusSpan.setText(`Customize aliases (canonical slug folds). Status: override file exists at ${path}.`)
      if (removeButton) (removeButton as HTMLButtonElement).disabled = false
    })()
  }

  // ── Section: General ──
  private renderGeneralSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'General' })

    new Setting(containerEl)
      .setName('Chat History')
      .setDesc('Save chat history across restarts. (max 100 messages)')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.persistChatHistory)
          .onChange(async (value) => {
            this.plugin.settings = {
              ...this.plugin.settings,
              persistChatHistory: value,
              savedChatHistory: value ? [...this.plugin.chatHistory].slice(-100) : [],
            }
            await this.plugin.saveSettings()
            new Notice(value ? 'Chat history will be saved.' : 'Chat history saving disabled.')
          }),
      )

    new Setting(containerEl)
      .setName('Auto Ingest')
      .setDesc('Automatically ingest files added to raw/0_inbox/ (debounced). Bypasses brief/preview modals.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoIngest)
          .onChange(async (value) => {
            this.plugin.settings.autoIngest = value
            await this.plugin.saveSettings()
          }),
      )

    // §5.20 Spec 1 I2 — query log capture toggle (default ON).
    new Setting(containerEl)
      .setName('Knowledge gap log')
      .setDesc('Record each query into .wikey/query-log.jsonl (local only) to enable knowledge gap reports. ON by default. Note: query text is stored verbatim — turn off if your queries may contain sensitive personal data.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.knowledgeGapLogEnabled)
          .onChange(async (value) => {
            this.plugin.settings.knowledgeGapLogEnabled = value
            await this.plugin.saveSettings()
          }),
      )

    this.renderStandardDropdown(
      containerEl,
      'Auto Ingest Interval',
      'Debounce window before auto-ingest fires on new inbox files.',
      [
        { value: '0', label: 'Immediately' },
        { value: '10', label: '10 seconds' },
        { value: '30', label: '30 seconds' },
        { value: '60', label: '60 seconds' },
      ],
      String(this.plugin.settings.autoIngestInterval),
      async (value) => {
        const v = Number(value)
        this.plugin.settings.autoIngestInterval = (v === 0 || v === 10 || v === 30 || v === 60 ? v : 30) as 0 | 10 | 30 | 60
        await this.plugin.saveSettings()
      },
    )

    // ── Stay-involved modal (llm-wiki.md "guide emphasis" + "check updates") ──
    this.renderStandardDropdown(
      containerEl,
      'Ingest Briefs',
      'Pre-ingest modal that shows an LLM summary and lets you inject guidance. Session = ask once, remember the rest of this session.',
      [
        { value: 'always', label: 'Always (recommended)' },
        { value: 'session', label: 'Once per session' },
        { value: 'never', label: 'Never (skip modal)' },
      ],
      this.plugin.settings.ingestBriefs,
      async (value) => {
        const v = value === 'always' || value === 'session' || value === 'never' ? value : 'always'
        this.plugin.settings.ingestBriefs = v
        this.plugin.skipIngestBriefsThisSession = false
        await this.plugin.saveSettings()
      },
    )

    new Setting(containerEl)
      .setName('Verify results before writing')
      .setDesc('Show the list of pages that will be created after extraction. Each brief modal lets you override this once for the current run.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.verifyIngestResults)
          .onChange(async (value) => {
            this.plugin.settings.verifyIngestResults = value
            await this.plugin.saveSettings()
          }),
      )

    // ── Phase 4 D.0.c (v6 §4.1.4): PII 2-layer gate — Basic ──
    new Setting(containerEl)
      .setName('Allow ingest when PII is detected')
      .setDesc('OFF (default): block ingest if PII is detected. ON: detect, auto-redact via the mode below, then proceed.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.allowPiiIngest)
          .onChange(async (value) => {
            this.plugin.settings.allowPiiIngest = value
            await this.plugin.saveSettings()
          }),
      )

    this.renderStandardDropdown(
      containerEl,
      'PII redaction mode',
      'How detected PII is rewritten before pages are written. ' +
        'mask — preserve length, replace characters with ***. ' +
        'display — leave the original text untouched (PII still present). ' +
        'hide — replace the entire sensitive sentence/line with [PII removed].',
      [
        { value: 'mask', label: 'mask (default)' },
        { value: 'display', label: 'display' },
        { value: 'hide', label: 'hide' },
      ],
      this.plugin.settings.piiRedactionMode,
      async (value) => {
        const v = value === 'display' || value === 'mask' || value === 'hide' ? value : 'mask'
        this.plugin.settings.piiRedactionMode = v
        await this.plugin.saveSettings()
      },
    )

    // §5.3 follow-up — original-link footer mode
    this.renderStandardDropdown(
      containerEl,
      'Original file link in answer footer',
      'How the source line at the end of each chat answer renders. ' +
        'raw — input file as ingested (pdf stays pdf, md stays md). ' +
        'sidecar — sidecar markdown (pdf → .md, plain md → itself). ' +
        'hidden — no footer. ' +
        'Link target is always the full vault path, so click and hover preview work in every mode.',
      [
        { value: 'raw', label: 'raw (default)' },
        { value: 'sidecar', label: 'sidecar' },
        { value: 'hidden', label: 'hidden' },
      ],
      this.plugin.settings.originalLinkMode,
      async (value) => {
        const v = value === 'raw' || value === 'sidecar' || value === 'hidden' ? value : 'raw'
        this.plugin.settings.originalLinkMode = v
        await this.plugin.saveSettings()
      },
    )

    // §5.18 v0.6 — backlink section scope (wiki/ vs extended; raw/ always excluded)
    this.renderStandardDropdown(
      containerEl,
      'Backlink section scope',
      'Answer footer backlink layers. ' +
        'wiki — only `Referenced (N)` section under wiki/ (default, wikey 3-layer knowledge asset). ' +
        'extended — `Referenced (N)` (wiki/) + `Extended (M)` (other folders: plan/, activity/, your notes) — ' +
        'two separate sections so wiki/ formal knowledge vs. informal references are clearly distinguished. ' +
        'raw/ is always excluded (would duplicate wiki/ ingest result).',
      [
        { value: 'wiki', label: 'wiki/ only — `Referenced` (default)' },
        { value: 'extended', label: 'extended — `Referenced` + `Extended` (raw/ excluded)' },
      ],
      this.plugin.settings.backlinkScope,
      async (value) => {
        const v = value === 'extended' ? 'extended' : 'wiki'
        this.plugin.settings.backlinkScope = v
        await this.plugin.saveSettings()
      },
    )

    // OCR fallback (markitdown-ocr) — vision-capable provider+model when
    // text-layer extraction fails. DEFAULT inherits Default Model.
    const effectiveOcrProvider = (this.plugin.settings.ocrProvider || this.plugin.settings.basicModel) as LLMProvider
    this.renderProviderModelPair(
      containerEl,
      'OCR Provider / Model',
      'Vision-capable LLM used when text-layer extraction fails. DEFAULT inherits Default Model.',
      [
        { value: '', label: 'DEFAULT' },
        { value: 'ollama', label: 'Local (Ollama)' },
        { value: 'gemini', label: 'Google Gemini' },
        { value: 'openai', label: 'OpenAI Codex' },
        { value: 'anthropic', label: 'Anthropic Claude' },
      ],
      this.plugin.settings.ocrProvider || '',
      async (value) => {
        const prev = this.plugin.settings.ocrProvider
        this.plugin.settings.ocrProvider = value
        if (value !== prev && this.plugin.settings.ocrModel) {
          this.plugin.settings.ocrModel = ''
          new Notice('OCR model cleared (provider changed).')
        }
        await this.plugin.saveSettings()
        this.refreshPreservingScroll()
      },
      effectiveOcrProvider,
      this.plugin.settings.ocrModel || '',
      async (value) => {
        this.plugin.settings.ocrModel = value
        await this.plugin.saveSettings()
      },
    )
  }

  // ── Section: LLM Model Authentication ──
  // §5.6.4 v0.7 (user plan 2026-05-14, codex cycle #2 rename) — provider-centric
  // subsections. Each provider gets one heading + one Auth Mode dropdown +
  // Subscription row (status + Sign in/out) + API Key row (password input + Test).
  // Section name covers both subscription OAuth and API-key auth, not just keys.
  private renderApiKeysSection(containerEl: HTMLElement): void {
    // §5.6.4 v0.7 (user UI spec 2026-05-14) — heading row 의 오른쪽에 storage note
    // 정렬. flex space-between 으로 h3 + note 한 행에 배치.
    const headingRow = containerEl.createDiv({ cls: 'wikey-auth-section-heading' })
    headingRow.createEl('h3', { text: 'LLM Model Authentication' })
    headingRow.createEl('span', {
      text: 'API keys are stored in ~/.config/wikey/credentials.json',
      cls: 'wikey-auth-section-note',
    })

    this.renderProviderSubsection(containerEl, {
      provider: 'gemini',
      heading: 'Google Gemini',
      apiKeyField: 'geminiApiKey',
      authModeField: 'geminiAuthMode',
      apiKeyPlaceholder: 'AIza...',
      signInLabel: 'Sign in with Google',
      signInCommand: 'gemini login',
      signOutCommand: 'gemini logout',
      detectSubscription: () => this.detectGeminiSubscription(),
    })
    this.renderProviderSubsection(containerEl, {
      provider: 'anthropic',
      heading: 'Anthropic Claude',
      apiKeyField: 'anthropicApiKey',
      authModeField: 'anthropicAuthMode',
      apiKeyPlaceholder: 'sk-ant-...',
      signInLabel: 'Sign in with Claude',
      signInCommand: 'claude /login',
      signOutCommand: 'claude /logout',
      detectSubscription: () => this.detectAnthropicSubscription(),
    })
    this.renderProviderSubsection(containerEl, {
      provider: 'openai',
      heading: 'OpenAI Codex',
      apiKeyField: 'openaiApiKey',
      authModeField: 'openaiAuthMode',
      apiKeyPlaceholder: 'sk-...',
      signInLabel: 'Sign in with ChatGPT',
      signInCommand: 'codex login',
      signOutCommand: 'codex logout',
      detectSubscription: () => this.detectOpenAISubscription(),
    })

    // §5.6.5 v0.5 (2026-05-14) — 4th subsection uses the shared
    // renderProviderSubsection now that Ollama Cloud auth mirrors the three
    // subscription providers (user lock: "다른 LLM과 동일한 구조"). Earlier
    // paradigm (SSH+signin only, no Auth Mode / no API Key, cookie scrape)
    // was retired here — the dedicated renderOllamaCloudSubsection helper
    // is gone too.
    this.renderProviderSubsection(containerEl, {
      provider: 'ollama-cloud',
      heading: 'Ollama Cloud',
      apiKeyField: 'ollamaCloudApiKey',
      authModeField: 'ollamaCloudAuthMode',
      apiKeyPlaceholder: 'Ollama Pro API key',
      signInLabel: 'Sign in with Ollama',
      signInCommand: 'ollama signin',
      signOutCommand: 'ollama signout',
      detectSubscription: () => this.detectOllamaCloudSubscription(),
    })
  }

  /**
   * §5.6.4 v0.7 commit 7 — unified provider subsection rendered as a single
   * block (heading + three rows) using direct DOM construction rather than
   * Obsidian's `Setting` API. Direct DOM gives us controlled layout: each row
   * is a flex container so the status badge can sit immediately to the left
   * of the [Sign in] / [Sign out] button (per user spec 2026-05-14).
   *
   * Block layout:
   *   <div class="wikey-auth-block">
   *     <h4>{heading}</h4>
   *     <div class="wikey-auth-block-row"> Auth Mode | <select> </div>
   *     <div class="wikey-auth-block-row"> Subscription | <badge> <button> </div>
   *     <div class="wikey-auth-block-row"> API Key | <password input> <Test> </div>
   *   </div>
   */
  private renderProviderSubsection(
    containerEl: HTMLElement,
    spec: ProviderSubsectionSpec,
  ): void {
    // §5.6.4 v0.7 user UI spec 2026-05-14 (commit 9 / commit 17):
    // - Provider 명을 block 밖 sub-heading (section title 동일 크기 + weight 300 + accent color)
    // - subsection title 행 오른쪽에 CLI install status badge (installed green / not detected orange)
    // - block 안 controls 우측 정렬
    const headingRow = containerEl.createDiv({ cls: 'wikey-auth-provider-row' })
    headingRow.createEl('h3', {
      text: spec.heading,
      cls: 'wikey-auth-provider-heading',
    })
    const cliInstalled = resolveCliBinary(spec.provider) !== null
    headingRow.createEl('span', {
      text: cliInstalled ? 'installed' : 'not detected',
      cls: `wikey-cli-status-badge ${
        cliInstalled ? 'wikey-cli-status-installed' : 'wikey-cli-status-not-detected'
      }`,
    })
    const block = containerEl.createDiv({ cls: 'wikey-auth-block' })

    this.renderAuthModeRow(block, spec)
    this.renderSubscriptionRow(block, spec)
    this.renderApiKeyRow(block, spec)
  }

  /** Auth Mode dropdown row. */
  private renderAuthModeRow(block: HTMLElement, spec: ProviderSubsectionSpec): void {
    const row = block.createDiv({ cls: 'wikey-auth-block-row' })
    row.createSpan({ cls: 'wikey-auth-block-label', text: 'Auth Mode' })
    const controls = row.createDiv({ cls: 'wikey-auth-block-controls' })
    const select = controls.createEl('select', { cls: 'wikey-auth-mode-select dropdown' })
    const current = this.plugin.settings[spec.authModeField] ?? 'subscription'
    const options: ReadonlyArray<{ value: 'none' | 'subscription' | 'api'; text: string }> = [
      { value: 'none', text: 'None (disabled)' },
      { value: 'subscription', text: 'Subscription' },
      { value: 'api', text: 'API Key' },
    ]
    for (const opt of options) {
      const optionEl = select.createEl('option', { value: opt.value, text: opt.text })
      if (opt.value === current) optionEl.selected = true
    }
    select.addEventListener('change', async () => {
      const value = select.value
      if (value === 'none' || value === 'subscription' || value === 'api') {
        this.plugin.settings[spec.authModeField] = value
        await this.plugin.saveSettings()
      }
    })
  }

  /** Subscription row: badge (signed-in / not-detected) immediately before Sign in/out button. */
  private renderSubscriptionRow(block: HTMLElement, spec: ProviderSubsectionSpec): void {
    const detected = spec.detectSubscription()
    const row = block.createDiv({ cls: 'wikey-auth-block-row' })
    row.createSpan({ cls: 'wikey-auth-block-label', text: 'Subscription' })
    const controls = row.createDiv({ cls: 'wikey-auth-block-controls' })

    // Badge sits immediately before the button per user spec.
    const badge = controls.createSpan({
      cls: `wikey-auth-status-badge ${
        detected ? 'wikey-auth-status-signed-in' : 'wikey-auth-status-not-detected'
      }`,
      text: detected ? 'signed-in' : 'not-detected',
    })
    void badge // silence unused (badge mounted into DOM)

    const btn = controls.createEl('button', {
      text: detected ? 'Sign out' : 'Sign in',
      cls: 'wikey-auth-block-btn',
    })
    btn.addEventListener('click', () => {
      if (detected) {
        new GeminiAuthInstructionModal(
          this.app,
          'Sign out',
          `Run "${spec.signOutCommand}" in your terminal.`,
        ).open()
      } else {
        new GeminiAuthInstructionModal(
          this.app,
          spec.signInLabel,
          `Run "${spec.signInCommand}" in your terminal, then return here and reload Obsidian.`,
        ).open()
      }
    })
  }

  /** API Key row: password input + Test button. */
  private renderApiKeyRow(block: HTMLElement, spec: ProviderSubsectionSpec): void {
    const row = block.createDiv({ cls: 'wikey-auth-block-row' })
    row.createSpan({ cls: 'wikey-auth-block-label', text: 'API Key' })
    const controls = row.createDiv({ cls: 'wikey-auth-block-controls' })

    const input = controls.createEl('input', {
      cls: 'wikey-api-key-input',
      attr: { type: 'password', placeholder: spec.apiKeyPlaceholder },
    })
    input.value = this.plugin.settings[spec.apiKeyField] ?? ''
    input.addEventListener('change', async () => {
      this.plugin.settings[spec.apiKeyField] = input.value
      await this.plugin.saveSettings()
    })

    const testBtn = controls.createEl('button', {
      text: 'Test',
      cls: 'wikey-auth-block-btn',
    })
    testBtn.addEventListener('click', async () => {
      testBtn.textContent = '...'
      testBtn.disabled = true
      const ok = await this.testApiConnection(spec.provider)
      testBtn.textContent = ok ? '✓ Connected' : '✗ Failed'
      testBtn.disabled = false
      if (ok) testBtn.classList.add('wikey-btn-success')
      else testBtn.classList.add('wikey-btn-error')
      setTimeout(() => {
        testBtn.textContent = 'Test'
        testBtn.classList.remove('wikey-btn-success')
        testBtn.classList.remove('wikey-btn-error')
      }, 3000)
    })
  }

  /**
   * §5.6.4.2 Step B — sync detection: gemini CLI binary AND OAuth credentials both
   * present. Mirrors `LLMClient.checkGeminiPresence` so the Settings UI shows the
   * same state the runtime will see. Sync (no spawn) — safe in renderer.
   */
  private detectGeminiSubscription(): boolean {
    try {
      const fs = require('node:fs') as typeof import('node:fs')
      const os = require('node:os') as typeof import('node:os')
      const path = require('node:path') as typeof import('node:path')
      const credsPath = path.join(os.homedir(), '.gemini', 'oauth_creds.json')
      const binaryPath = resolveCliBinary('gemini')
      return fs.existsSync(credsPath) && fs.existsSync(binaryPath)
    } catch {
      return false
    }
  }

  /**
   * §5.6.4.3 Step C — sync detection for the claude CLI binary. Mirrors
   * `LLMClient.checkAnthropicPresence`: binary presence only (claude CLI
   * stores subscription tokens in macOS Keychain, not file-probeable).
   */
  private detectAnthropicSubscription(): boolean {
    try {
      const fs = require('node:fs') as typeof import('node:fs')
      const binaryPath = resolveCliBinary('anthropic')
      return fs.existsSync(binaryPath)
    } catch {
      return false
    }
  }

  /**
   * §5.6.4.4 Step D — sync detection for the codex CLI binary + OAuth token file.
   * Mirrors `LLMClient.checkOpenAIPresence`: both must exist.
   */
  private detectOpenAISubscription(): boolean {
    try {
      const fs = require('node:fs') as typeof import('node:fs')
      const os = require('node:os') as typeof import('node:os')
      const path = require('node:path') as typeof import('node:path')
      const credsPath = path.join(os.homedir(), '.codex', 'auth.json')
      const binaryPath = resolveCliBinary('openai')
      return fs.existsSync(credsPath) && fs.existsSync(binaryPath)
    } catch {
      return false
    }
  }

  /**
   * §5.6.5 v0.5 — Ollama Cloud subscription detection (cheap sync proxy).
   * `ollama signin` registers the user's `~/.ollama/id_ed25519` public key
   * with ollama.com OAuth, so the SSH key existing locally is the closest
   * synchronous signal that signin has been run. OAuth state expiry surfaces
   * later via callOllama's onAuthFallback({reason:'auth-missing'}) on the
   * next request. (Renamed from detectOllamaCloudSignin in v0.5 to match
   * the gemini/anthropic/openai naming.)
   */
  private detectOllamaCloudSubscription(): boolean {
    try {
      const fs = require('node:fs') as typeof import('node:fs')
      const os = require('node:os') as typeof import('node:os')
      const path = require('node:path') as typeof import('node:path')
      const sshKeyPath = path.join(os.homedir(), '.ollama', 'id_ed25519')
      return fs.existsSync(sshKeyPath)
    } catch {
      return false
    }
  }

  private async testApiConnection(provider: string): Promise<boolean> {
    try {
      switch (provider) {
        case 'gemini': {
          const key = this.plugin.settings.geminiApiKey
          if (!key) { new Notice('Enter Gemini API key first.'); return false }
          const resp = await requestUrl({ url: `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, method: 'GET' })
          if (resp.status === 200) { new Notice('Gemini connected'); return true }
          new Notice(`Gemini error: ${resp.status}`); return false
        }
        case 'anthropic': {
          const key = this.plugin.settings.anthropicApiKey
          if (!key) { new Notice('Enter Anthropic API key first.'); return false }
          const resp = await requestUrl({
            url: 'https://api.anthropic.com/v1/messages',
            method: 'POST',
            headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: ANTHROPIC_PING_MODEL, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
          })
          if (resp.status === 200) { new Notice('Anthropic connected'); return true }
          new Notice(`Anthropic error: ${resp.status}`); return false
        }
        case 'openai': {
          const key = this.plugin.settings.openaiApiKey
          if (!key) { new Notice('Enter OpenAI API key first.'); return false }
          const resp = await requestUrl({ url: 'https://api.openai.com/v1/models', method: 'GET', headers: { Authorization: `Bearer ${key}` } })
          if (resp.status === 200) { new Notice('OpenAI connected'); return true }
          new Notice(`OpenAI error: ${resp.status}`); return false
        }
        default: return false
      }
    } catch (err: any) {
      new Notice(`Connection failed: ${err?.message ?? err}`)
      return false
    }
  }

  // ── Section: Search ──
  private renderSearchSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Search (qmd)' })

    new Setting(containerEl)
      .setName('qmd Path')
      .setDesc(`Current: ${this.plugin.settings.qmdPath || 'auto-detected'}`)
      .addText((text) =>
        text
          .setPlaceholder('auto-detect')
          .setValue(this.plugin.settings.qmdPath)
          .onChange(async (value) => {
            this.plugin.settings.qmdPath = value
            await this.plugin.saveSettings()
          }),
      )
  }

  // ── Section: Wiki Tools ──
  private renderToolsSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Wiki Tools' })

    const basePath = (this.plugin.app.vault.adapter as any).basePath ?? ''
    // §5.7.7 cycle #4 codex MED #4 fix — env capture inside each button handler so
    // recent setting changes (Hybrid toggle, OLLAMA_URL) reach reindex subprocess
    // without tab rerender. Previously env was computed once at render time.

    // --- Reindex ---
    const reindexBox = containerEl.createDiv({ cls: 'wikey-settings-result-box' })
    reindexBox.createEl('span', { text: 'Click below to check index status.', cls: 'wikey-settings-result-placeholder' })

    const reindexSetting = new Setting(containerEl)
    reindexSetting.addButton((btn) =>
      btn.setButtonText('Check Index').onClick(async () => {
        btn.setButtonText('Checking...')
        btn.setDisabled(true)
        const env = this.plugin.getExecEnv()
        const result = await reindexCheck(basePath, env)
        reindexBox.empty()
        reindexBox.createEl('pre', {
          text: result.stdout.trim() || result.stderr.trim() || 'No output',
          cls: result.success ? 'wikey-settings-result-output' : 'wikey-settings-result-error',
        })
        btn.setButtonText('Check Index')
        btn.setDisabled(false)
      }),
    )
    reindexSetting.addButton((btn) =>
      btn.setButtonText('Full Reindex').setCta().onClick(async () => {
        btn.setButtonText('Indexing...')
        btn.setDisabled(true)
        reindexBox.empty()
        reindexBox.createEl('span', { text: 'Full reindex running... (up to 2 min)', cls: 'wikey-settings-result-placeholder' })
        const env = this.plugin.getExecEnv()
        const result = await reindexWiki(basePath, env, 'full')
        reindexBox.empty()
        reindexBox.createEl('pre', {
          text: result.stdout.trim() || result.stderr.trim() || 'Done',
          cls: result.success ? 'wikey-settings-result-output' : 'wikey-settings-result-error',
        })
        if (result.success) new Notice('Full reindex completed')
        else new Notice('Reindex failed — check Settings for details')
        btn.setButtonText('Full Reindex')
        btn.setDisabled(false)
      }),
    )

    // --- Validate Wiki ---
    const validateBox = containerEl.createDiv({ cls: 'wikey-settings-result-box' })
    validateBox.createEl('span', { text: 'Wiki validation results will appear here.', cls: 'wikey-settings-result-placeholder' })

    const validateSetting = new Setting(containerEl)
    validateSetting.addButton((btn) =>
      btn.setButtonText('Validate Wiki').onClick(async () => {
        btn.setButtonText('Validating...')
        btn.setDisabled(true)
        const env = this.plugin.getExecEnv()
        const result = await validateWiki(basePath, env)
        validateBox.empty()
        validateBox.createEl('pre', {
          text: result.stdout.trim() || result.stderr.trim() || 'Validation passed — no issues',
          cls: result.success ? 'wikey-settings-result-output' : 'wikey-settings-result-error',
        })
        if (result.success) new Notice('Wiki validation passed')
        else new Notice('Wiki validation found issues')
        btn.setButtonText('Validate Wiki')
        btn.setDisabled(false)
      }),
    )
    validateSetting.addButton((btn) =>
      btn.setButtonText('PII Scan').onClick(async () => {
        btn.setButtonText('Scanning...')
        btn.setDisabled(true)
        const env = this.plugin.getExecEnv()
        const result = await checkPii(basePath, env)
        validateBox.empty()
        validateBox.createEl('pre', {
          text: result.stdout.trim() || result.stderr.trim() || 'No PII found',
          cls: result.success ? 'wikey-settings-result-output' : 'wikey-settings-result-error',
        })
        if (result.success) new Notice('PII scan passed')
        else new Notice('PII detected — check Settings for details')
        btn.setButtonText('PII Scan')
        btn.setDisabled(false)
      }),
    )
  }

  // ── Section: Advanced ──
  private renderAdvancedSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Advanced' })

    // ── Phase 4 D.0.c (v6 §4.1.4): PII 2-layer gate — Advanced ──
    new Setting(containerEl)
      .setName('Enable PII detection')
      .setDesc(
        'ON (default): every ingest scans for BRN, corporate registration numbers, executive names, etc. ' +
        'OFF: skip detection entirely. Only turn this off for documents that are safe to publish (regulatory filings, IR, press releases). ' +
        'This is a user-trust setting, not a technical safeguard.',
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.piiGuardEnabled)
          .onChange(async (value) => {
            this.plugin.settings.piiGuardEnabled = value
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName('Per-task LLM Override')
      .setDesc('Enable to set different providers for lint and summarize tasks.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.advancedLLM)
          .onChange(async (value) => {
            this.plugin.settings.advancedLLM = value
            await this.plugin.saveSettings()
            this.refreshPreservingScroll()
          }),
      )

    if (!this.plugin.settings.advancedLLM) return

    const providerOptions: Record<string, string> = {
      '': 'DEFAULT',
      'ollama': 'Local (Ollama)',
      'gemini': 'Google Gemini',
      'anthropic': 'Anthropic Claude',
      'openai': 'OpenAI Codex',
    }

    for (const [key, label, desc] of [
      ['lintProvider', 'Lint Provider', 'LLM for wiki consistency checks'],
      ['summarizeProvider', 'Summarize Provider', 'LLM for large source summarization'],
    ] as const) {
      new Setting(containerEl)
        .setName(label)
        .setDesc(desc)
        .addDropdown((drop) => {
          for (const [k, v] of Object.entries(providerOptions)) drop.addOption(k, v)
          drop.setValue((this.plugin.settings as any)[key])
            .onChange(async (value) => {
              ;(this.plugin.settings as any)[key] = value
              await this.plugin.saveSettings()
            })
        })
    }
  }
}

/**
 * Modal popup for editing the ingest system prompt. Loads the current effective
 * prompt (override or bundled default) and saves to `.wikey/ingest_prompt.md`
 * via the supplied callback.
 */
class IngestPromptEditModal extends Modal {
  private textarea!: HTMLTextAreaElement
  constructor(
    app: App,
    private readonly initialContent: string,
    private readonly onSave: (next: string) => Promise<void>,
    private readonly title: string = 'Ingest Prompt',
  ) {
    super(app)
  }

  onOpen(): void {
    const { contentEl, modalEl } = this
    modalEl.addClass('wikey-ingest-prompt-modal')
    contentEl.createEl('h2', { text: `Edit ${this.title}` })
    contentEl.createEl('p', {
      text: 'Removing template variables (`{{...}}`) or changing the JSON output schema breaks the pipeline. Edit minimally and keep the bundled version as a reference.',
      cls: 'wikey-ingest-prompt-help',
    })
    this.textarea = contentEl.createEl('textarea', {
      cls: 'wikey-ingest-prompt-textarea',
    })
    this.textarea.value = this.initialContent
    this.textarea.spellcheck = false

    const footer = contentEl.createDiv({ cls: 'wikey-ingest-prompt-footer' })
    const cancelBtn = footer.createEl('button', { text: 'Cancel' })
    cancelBtn.addEventListener('click', () => this.close())
    const saveBtn = footer.createEl('button', { text: 'Save', cls: 'mod-cta' })
    saveBtn.addEventListener('click', async () => {
      const next = this.textarea.value
      try {
        await this.onSave(next)
        this.close()
      } catch (err) {
        new Notice(`Save failed: ${(err as Error).message}`)
      }
    })
  }

  onClose(): void {
    this.contentEl.empty()
  }
}

const SCHEMA_OVERRIDE_TEMPLATE = `# wikey schema override — .wikey/schema.yaml (D-wide)
#
# Honored section: \`aliases\` (canonical slug normalization). Other sections are ignored.
#
# Custom PII regex rules go to a separate file: .wikey/pii-patterns.yaml
# (or ~/.config/wikey/pii-patterns.yaml for global). See pii-patterns engine docs.
#
# Remove this file to disable alias overrides.

aliases:
  # Each entry maps a canonical slug to a list of variant strings the
  # canonicalizer should fold into it. Variant matching is case-insensitive
  # and applied after the LLM name is normalized to a hyphenated slug, so
  # both human-readable forms and slug forms are accepted.
  # Example:
  # iso-27001:
  #   - ISO 27001
  #   - ISO/IEC 27001
  #   - ISMS
`

/**
 * §5.6.4.2 Step B — instruction modal for `gemini login` / `gemini logout`.
 *
 * Obsidian renderer has no TTY so we cannot run the login flow inline. The modal
 * tells the user what to type in their terminal and to reload Obsidian afterwards
 * so `checkGeminiPresence` re-reads `~/.gemini/oauth_creds.json`.
 */
class GeminiAuthInstructionModal extends Modal {
  constructor(
    app: App,
    private readonly titleText: string,
    private readonly bodyText: string,
  ) {
    super(app)
  }

  onOpen(): void {
    const { contentEl } = this
    contentEl.createEl('h2', { text: this.titleText })
    contentEl.createEl('p', { text: this.bodyText })
    const footer = contentEl.createDiv({ cls: 'wikey-ingest-prompt-footer' })
    const closeBtn = footer.createEl('button', { text: 'Close', cls: 'mod-cta' })
    closeBtn.addEventListener('click', () => this.close())
  }

  onClose(): void {
    this.contentEl.empty()
  }
}

/**
 * Modal popup for editing `.wikey/schema.yaml` (v7-5).
 * Uses the same textarea pattern as IngestPromptEditModal.
 */
class SchemaOverrideEditModal extends Modal {
  private textarea!: HTMLTextAreaElement
  constructor(
    app: App,
    private readonly initialContent: string,
    private readonly onSave: (next: string) => Promise<void>,
  ) {
    super(app)
  }

  onOpen(): void {
    const { contentEl, modalEl } = this
    modalEl.addClass('wikey-ingest-prompt-modal')
    contentEl.createEl('h2', { text: 'Edit Schema Override' })
    contentEl.createEl('p', {
      text: 'Customize the canonicalizer with aliases (variant labels collapsing into one slug). Custom PII rules belong in .wikey/pii-patterns.yaml (separate file).',
      cls: 'wikey-ingest-prompt-help',
    })
    this.textarea = contentEl.createEl('textarea', {
      cls: 'wikey-ingest-prompt-textarea',
    })
    this.textarea.value = this.initialContent
    this.textarea.spellcheck = false

    const footer = contentEl.createDiv({ cls: 'wikey-ingest-prompt-footer' })
    const cancelBtn = footer.createEl('button', { text: 'Cancel' })
    cancelBtn.addEventListener('click', () => this.close())
    const saveBtn = footer.createEl('button', { text: 'Save', cls: 'mod-cta' })
    saveBtn.addEventListener('click', async () => {
      const next = this.textarea.value
      try {
        await this.onSave(next)
        this.close()
      } catch (err) {
        new Notice(`Save failed: ${(err as Error).message}`)
      }
    })
  }

  onClose(): void {
    this.contentEl.empty()
  }
}
