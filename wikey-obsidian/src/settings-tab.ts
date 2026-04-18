import { App, Modal, Notice, PluginSettingTab, Setting, TFile, requestUrl } from 'obsidian'
import { costTrackerSummary, validateWiki, checkPii, reindexWiki, reindexCheck, INGEST_PROMPT_PATH, BUNDLED_INGEST_PROMPT, loadEffectiveIngestPrompt, fetchModelList, ANTHROPIC_PING_MODEL } from 'wikey-core'
import type { LLMProvider } from 'wikey-core'
import type WikeyPlugin from './main'

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
    this.renderGeneralSection(containerEl)
    this.renderApiKeysSection(containerEl)
    this.renderSearchSection(containerEl)
    this.renderCostSection(containerEl)
    this.renderToolsSection(containerEl)
    this.renderAdvancedSection(containerEl)
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
      { label: 'Node.js', value: env.nodePath || 'Not found', ok: !!env.nodePath, desc: 'Runtime for qmd search engine' },
      { label: 'Python3', value: env.pythonPath || 'Not found', ok: !!env.pythonPath, desc: 'Required for Korean tokenizer & PDF processing' },
      { label: 'kiwipiepy', value: env.hasKiwipiepy ? 'Installed' : 'Not installed', ok: env.hasKiwipiepy, desc: 'Korean morpheme analyzer for search accuracy' },
      { label: 'qmd', value: env.qmdPath || 'Not found', ok: !!env.qmdPath, desc: 'Hybrid search engine (BM25 + vector)' },
      { label: 'Ollama', value: env.ollamaRunning ? `Running (${env.ollamaModels.length} models)` : 'Not running', ok: env.ollamaRunning, desc: 'Local LLM server for private inference' },
      { label: 'Qwen3 8B', value: env.hasQwen3 ? 'Installed' : 'Optional', ok: env.hasQwen3, optional: true, desc: 'Ingest option (5.2GB, fast, JSON reliable)' },
      { label: 'Qwen3.6:35b-a3b', value: env.hasQwen36 ? 'Installed' : 'Optional', ok: env.hasQwen36, optional: true, desc: 'Ingest high-quality option (24GB MoE, ≥48GB RAM)' },
      { label: 'Gemma4', value: env.hasGemma4 ? 'Installed' : 'Optional', ok: env.hasGemma4, optional: true, desc: 'Query/CR synthesis option (not used for ingest)' },
      { label: 'MarkItDown', value: env.hasMarkitdown ? 'Installed' : 'Not installed', ok: env.hasMarkitdown, desc: 'PDF/DOCX to Markdown converter (Microsoft)' },
      { label: 'MarkItDown OCR', value: env.hasMarkitdownOcr ? 'Installed' : 'Optional', ok: env.hasMarkitdownOcr, optional: true, desc: 'Scanned-PDF OCR fallback (markitdown-ocr + openai SDK, uses Ollama vision model)' },
    ]

    for (const item of items) {
      const row = statusContainer.createDiv({ cls: 'wikey-settings-status-row' })
      const labelWrap = row.createDiv({ cls: 'wikey-settings-status-label-wrap' })
      labelWrap.createEl('span', { text: item.label, cls: 'wikey-settings-status-label' })
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

    if (!env.hasMarkitdown && env.pythonPath) {
      new Setting(containerEl)
        .setDesc('Install MarkItDown for better PDF/DOCX ingestion.')
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

    this.renderStandardDropdown(
      containerEl,
      'Provider',
      'Default LLM provider for all tasks. Can be overridden per-task in Advanced settings.',
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
        this.display()
      },
    )

    this.renderModelDropdown(
      containerEl,
      'Model',
      'Specific model for the selected provider. Loaded dynamically from the provider API.',
      this.plugin.settings.basicModel as LLMProvider,
      this.plugin.settings.cloudModel || '',
      async (value) => {
        this.plugin.settings.cloudModel = value
        await this.plugin.saveSettings()
      },
    )
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
        selectEl.appendChild(new Option('(provider default)', ''))
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

    this.renderStandardDropdown(
      containerEl,
      'Provider',
      'Provider for document ingestion. Leave empty to use Default Model.',
      [
        { value: '', label: '(use Default Model)' },
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
        this.display()
      },
    )

    const effectiveIngestProvider = (this.plugin.settings.ingestProvider || this.plugin.settings.basicModel) as LLMProvider
    this.renderModelDropdown(
      containerEl,
      'Model',
      'Model for ingestion, dynamically loaded from the provider API. Leave at (provider default) to inherit wikey-core defaults.',
      effectiveIngestProvider,
      this.plugin.settings.ingestModel || '',
      async (value) => {
        this.plugin.settings.ingestModel = value
        await this.plugin.saveSettings()
      },
    )
  }

  // ── Section: Ingest Prompt (single-prompt model) ──
  // Note: `.wikey/` is a hidden folder (dot-prefixed), so vault metadata
  // (getAbstractFileByPath, getFiles) does not track files inside it.
  // Use vault.adapter.* for all existence checks and writes.
  private renderIngestPromptSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Ingest Prompt' })

    const { vault } = this.plugin.app
    const descEl = containerEl.createDiv({ cls: 'wikey-settings-status-desc' })
    const statusSpan = descEl.createSpan({
      text: 'System prompt sent to the LLM during ingest. Edit to tune for your data; Reset to revert. Status: …',
    })

    let resetButton: HTMLButtonElement | null = null
    new Setting(containerEl)
      .setName('Edit prompt')
      .setDesc('Open the current ingest system prompt in a popup editor. Save writes a vault override; Reset removes it.')
      .addButton((btn) =>
        btn.setButtonText('Edit').onClick(async () => {
          try {
            const wikiFS = this.plugin.wikiFS
            const current = await loadEffectiveIngestPrompt(wikiFS)
            new IngestPromptEditModal(this.plugin.app, current, async (next) => {
              const parent = INGEST_PROMPT_PATH.split('/').slice(0, -1).join('/')
              if (parent && !(await vault.adapter.exists(parent))) {
                await vault.createFolder(parent)
              }
              await vault.adapter.write(INGEST_PROMPT_PATH, next)
              new Notice('Ingest prompt saved.')
              this.display()
            }).open()
          } catch (err) {
            new Notice(`Failed to open prompt editor: ${(err as Error).message}`)
          }
        }),
      )
      .addButton((btn) => {
        resetButton = btn.buttonEl
        btn.setButtonText('Reset').setDisabled(true).onClick(async () => {
          if (!(await vault.adapter.exists(INGEST_PROMPT_PATH))) {
            new Notice('Already using bundled default.')
            return
          }
          if (!confirm(`Reset ingest prompt to bundled default? This deletes ${INGEST_PROMPT_PATH}.`)) return
          await vault.adapter.remove(INGEST_PROMPT_PATH)
          new Notice('Ingest prompt reset to default.')
          this.display()
        })
      })

    // Async update of status text + Reset button enable (disk truth)
    void (async () => {
      const isCustom = await vault.adapter.exists(INGEST_PROMPT_PATH)
      statusSpan.setText(
        `System prompt sent to the LLM during ingest. Edit to tune for your data; Reset to revert. Status: ${isCustom ? 'Custom override' : 'Bundled default'}.`,
      )
      if (resetButton) resetButton.disabled = !isCustom
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
      .setDesc('Automatically ingest files added to raw/0_inbox/ (debounced).')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.autoIngest)
          .onChange(async (value) => {
            this.plugin.settings.autoIngest = value
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

    // OCR fallback (markitdown-ocr) — 미설정 시 basicModel 사용
    const ocrDesc = containerEl.createDiv({ cls: 'wikey-settings-status-row' })
    ocrDesc.createEl('span', {
      text: 'OCR fallback (markitdown-ocr). Leave blank to inherit basic model.',
      cls: 'wikey-settings-status-label',
    })

    this.renderStandardDropdown(
      containerEl,
      'OCR Provider',
      'Vision model provider used when text-layer extraction fails.',
      [
        { value: '', label: '(inherit basic model)' },
        { value: 'gemini', label: 'Gemini' },
        { value: 'openai', label: 'OpenAI' },
        { value: 'ollama', label: 'Ollama (local)' },
      ],
      this.plugin.settings.ocrProvider || '',
      async (value) => {
        this.plugin.settings.ocrProvider = value
        await this.plugin.saveSettings()
      },
    )

    new Setting(containerEl)
      .setName('OCR Model')
      .setDesc('e.g. gemini-2.5-flash, gpt-4o, gemma4:26b. Leave blank for provider default.')
      .addText((text) =>
        text
          .setPlaceholder('(provider default)')
          .setValue(this.plugin.settings.ocrModel || '')
          .onChange(async (value) => {
            this.plugin.settings.ocrModel = value.trim()
            await this.plugin.saveSettings()
          }),
      )
  }

  // ── Section: API Keys ──
  private renderApiKeysSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'API Keys' })

    const keyInfo = containerEl.createDiv({ cls: 'wikey-settings-status-row' })
    keyInfo.createEl('span', {
      text: 'API keys are stored in ~/.config/wikey/credentials.json',
      cls: 'wikey-settings-status-label',
    })

    this.renderApiKeyField(containerEl, 'Google Gemini', 'geminiApiKey', 'AIza...', 'gemini')
    this.renderApiKeyField(containerEl, 'Anthropic Claude', 'anthropicApiKey', 'sk-ant-...', 'anthropic')
    this.renderApiKeyField(containerEl, 'OpenAI Codex', 'openaiApiKey', 'sk-...', 'openai')
  }

  private renderApiKeyField(
    containerEl: HTMLElement,
    name: string,
    settingsKey: 'geminiApiKey' | 'anthropicApiKey' | 'openaiApiKey',
    placeholder: string,
    provider: string,
  ): void {
    const setting = new Setting(containerEl).setName(name)

    setting.addText((text) => {
      const input = text
        .setPlaceholder(placeholder)
        .setValue(this.plugin.settings[settingsKey])
        .onChange(async (value) => {
          this.plugin.settings[settingsKey] = value
          await this.plugin.saveSettings()
        })
      input.inputEl.type = 'password'
      return input
    })

    setting.addButton((btn) => {
      btn.setButtonText('Test').onClick(async () => {
        btn.setButtonText('...')
        btn.setDisabled(true)
        const ok = await this.testApiConnection(provider)
        btn.setButtonText(ok ? '✓ Connected' : '✗ Failed')
        btn.setDisabled(false)
        if (ok) btn.buttonEl.addClass('wikey-btn-success')
        else btn.buttonEl.addClass('wikey-btn-error')
        setTimeout(() => {
          btn.setButtonText('Test')
          btn.buttonEl.removeClass('wikey-btn-success')
          btn.buttonEl.removeClass('wikey-btn-error')
        }, 3000)
      })
    })
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

  // ── Section: Cost ──
  private renderCostSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Cost Management' })

    new Setting(containerEl)
      .setName('Monthly Limit ($)')
      .addText((text) =>
        text
          .setPlaceholder('50')
          .setValue(String(this.plugin.settings.costLimit))
          .onChange(async (value) => {
            const num = Number(value)
            if (!isNaN(num) && num > 0) {
              this.plugin.settings.costLimit = num
              await this.plugin.saveSettings()
            }
          }),
      )

    const costBox = containerEl.createDiv({ cls: 'wikey-settings-result-box' })
    costBox.createEl('span', { text: 'Click below to load cost summary.', cls: 'wikey-settings-result-placeholder' })

    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText('Cost Summary').onClick(async () => {
        btn.setButtonText('Loading...')
        btn.setDisabled(true)
        const basePath = (this.plugin.app.vault.adapter as any).basePath ?? ''
        const env = this.plugin.getExecEnv()
        const result = await costTrackerSummary(basePath, env)
        costBox.empty()
        if (result.success && result.stdout.trim()) {
          costBox.createEl('pre', { text: result.stdout.trim(), cls: 'wikey-settings-result-output' })
        } else if (!result.success) {
          costBox.createEl('pre', { text: result.stderr || 'Cost tracker script failed', cls: 'wikey-settings-result-error' })
        } else {
          costBox.createEl('span', { text: 'No cost records', cls: 'wikey-settings-result-placeholder' })
        }
        btn.setButtonText('Cost Summary')
        btn.setDisabled(false)
      }),
    )
  }

  // ── Section: Wiki Tools ──
  private renderToolsSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Wiki Tools' })

    const basePath = (this.plugin.app.vault.adapter as any).basePath ?? ''
    const env = this.plugin.getExecEnv()

    // --- Reindex ---
    const reindexBox = containerEl.createDiv({ cls: 'wikey-settings-result-box' })
    reindexBox.createEl('span', { text: 'Click below to check index status.', cls: 'wikey-settings-result-placeholder' })

    const reindexSetting = new Setting(containerEl)
    reindexSetting.addButton((btn) =>
      btn.setButtonText('Check Index').onClick(async () => {
        btn.setButtonText('Checking...')
        btn.setDisabled(true)
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

    new Setting(containerEl)
      .setName('Per-task LLM Override')
      .setDesc('Enable to set different providers for lint and summarize tasks.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.advancedLLM)
          .onChange(async (value) => {
            this.plugin.settings.advancedLLM = value
            await this.plugin.saveSettings()
            this.display()
          }),
      )

    if (!this.plugin.settings.advancedLLM) return

    const providerOptions: Record<string, string> = {
      '': '(use Default Model)',
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
  ) {
    super(app)
  }

  onOpen(): void {
    const { contentEl, modalEl } = this
    modalEl.addClass('wikey-ingest-prompt-modal')
    contentEl.createEl('h2', { text: 'Edit Ingest Prompt' })
    contentEl.createEl('p', {
      text: 'Edit the system prompt sent to the LLM during ingest. Keep the {{TODAY}}, {{INDEX_CONTENT}}, {{SOURCE_FILENAME}}, {{SOURCE_CONTENT}} placeholders or the pipeline will not receive the source.',
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
