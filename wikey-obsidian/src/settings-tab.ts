import { App, Modal, Notice, PluginSettingTab, Setting, TFile, requestUrl } from 'obsidian'
import {
  costTrackerSummary, validateWiki, checkPii, reindexWiki, reindexCheck,
  INGEST_PROMPT_PATH, STAGE1_SUMMARY_PROMPT_PATH, STAGE2_MENTION_PROMPT_PATH, STAGE3_CANONICALIZE_PROMPT_PATH,
  BUNDLED_INGEST_PROMPT, BUNDLED_STAGE2_MENTION_PROMPT,
  loadEffectiveIngestPrompt, loadEffectiveStage2Prompt, loadEffectiveStage3Prompt,
  loadSchemaOverride, fetchModelList, ANTHROPIC_PING_MODEL,
  previewReset,
} from 'wikey-core'
import type { LLMProvider, ResetScope } from 'wikey-core'
import type WikeyPlugin from './main'
import { ResetImpactModal } from './reset-modals'
import { executeReset } from './commands'

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
    this.renderCostSection(containerEl)
    this.renderToolsSection(containerEl)
    this.renderResetSection(containerEl)
    this.renderAdvancedSection(containerEl)
  }

  // ── Section: Reset (Phase 4.5.2) ──
  private renderResetSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Reset' })
    containerEl.createEl('p', {
      text: '선택한 scope 를 초기화. 실행 전 미리보기 + "RESET <SCOPE>" 타이핑 확인 필수.',
      cls: 'wikey-settings-status-label',
    })

    let selectedScope: ResetScope = 'wiki+registry'

    new Setting(containerEl)
      .setName('Scope')
      .setDesc('대상 범위를 선택하세요')
      .addDropdown((dd) => {
        dd.addOption('wiki+registry', 'wiki + registry (raw/ 유지)')
        dd.addOption('wiki-only', 'wiki 만 (registry 유지)')
        dd.addOption('registry-only', 'registry 만 (wiki 유지)')
        dd.addOption('qmd-index', 'qmd 인덱스만')
        dd.addOption('settings', '설정만 (data.json)')
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
      { label: 'Node.js', value: env.nodePath || 'Not found', ok: !!env.nodePath, desc: 'Runtime for qmd search engine' },
      { label: 'Python3', value: env.pythonPath || 'Not found', ok: !!env.pythonPath, desc: 'Required for Korean tokenizer & PDF processing' },
      { label: 'kiwipiepy', value: env.hasKiwipiepy ? 'Installed' : 'Not installed', ok: env.hasKiwipiepy, desc: 'Korean morpheme analyzer for search accuracy' },
      { label: 'qmd', value: env.qmdPath || 'Not found', ok: !!env.qmdPath, desc: 'Hybrid search engine (BM25 + vector)' },
      { label: 'Ollama', value: env.ollamaRunning ? `Running (${env.ollamaModels.length} models)` : 'Not running', ok: env.ollamaRunning, desc: 'Local LLM server for private inference' },
      { label: 'Qwen3 8B', value: env.hasQwen3 ? 'Installed' : 'Optional', ok: env.hasQwen3, optional: true, desc: 'Ingest option (5.2GB, fast, JSON reliable)' },
      { label: 'Qwen3.6:35b-a3b', value: env.hasQwen36 ? 'Installed' : 'Optional', ok: env.hasQwen36, optional: true, desc: 'Ingest high-quality option (24GB MoE, ≥48GB RAM)' },
      { label: 'Gemma4', value: env.hasGemma4 ? 'Installed' : 'Optional', ok: env.hasGemma4, optional: true, desc: 'Query/CR synthesis option (not used for ingest)' },
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

    this.renderStandardDropdown(
      containerEl,
      'Provider',
      'Provider for document ingestion. Leave empty to use Default Model.',
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
        this.display()
      },
    )

    const effectiveIngestProvider = (this.plugin.settings.ingestProvider || this.plugin.settings.basicModel) as LLMProvider
    this.renderModelDropdown(
      containerEl,
      'Model',
      'Model for ingestion, dynamically loaded from the provider API. Leave at DEFAULT to inherit wikey-core defaults.',
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
      text: '인제스트 파이프라인은 3단계 — Stage 1 summary → Stage 2 mention → Stage 3 canonicalize. 각 단계 프롬프트를 독립적으로 override 가능.',
    })

    this.renderPromptRow(containerEl, {
      title: 'Stage 1 — Source summary',
      description: '소스 → source_page 페이지 요약. {{TODAY}}, {{INDEX_CONTENT}}, {{SOURCE_FILENAME}}, {{SOURCE_CONTENT}} 치환.',
      canonicalPath: STAGE1_SUMMARY_PROMPT_PATH,
      legacyPath: INGEST_PROMPT_PATH,
      loader: async (wikiFS) => loadEffectiveIngestPrompt(wikiFS),
      bundled: BUNDLED_INGEST_PROMPT,
      inlineHint: 'source_page 본문에 `[[wikilink]]` 를 직접 쓰지 마세요 — Stage 2/3 에서 canonical 된 페이지만 유지되고 나머지는 plain text 로 강등됩니다 (§4.3.3).',
    })

    this.renderPromptRow(containerEl, {
      title: 'Stage 2 — Mention extraction',
      description: 'chunk → Mention JSON. {{SOURCE_FILENAME}}, {{CHUNK_CONTENT}} 치환.',
      canonicalPath: STAGE2_MENTION_PROMPT_PATH,
      loader: async (wikiFS) => {
        const res = await loadEffectiveStage2Prompt(wikiFS)
        return res.prompt
      },
      bundled: BUNDLED_STAGE2_MENTION_PROMPT,
      inlineHint: '출력 스키마 (`{"mentions": [...]}`) 를 유지하세요 — 다른 구조로 응답하면 pipeline 이 0 mention 으로 처리합니다.',
    })

    this.renderPromptRow(containerEl, {
      title: 'Stage 3 — Canonicalizer',
      description: 'mention → canonical entity/concept. {{SOURCE_FILENAME}}, {{GUIDE_BLOCK}}, {{SCHEMA_BLOCK}}, {{EXISTING_BLOCK}}, {{MENTIONS_BLOCK}}, {{MENTIONS_COUNT}} 치환.',
      canonicalPath: STAGE3_CANONICALIZE_PROMPT_PATH,
      loader: async (wikiFS) => {
        const res = await loadEffectiveStage3Prompt(wikiFS)
        return res.overridden ? res.prompt : ''
      },
      bundled: '', // bundled body 는 canonicalizer.ts 가 생성 — editor 는 override 만 편집.
      inlineHint: '`entities/concepts/index_additions/log_entry` JSON 출력을 유지하세요. SCHEMA_BLOCK 을 제거하면 canonicalizer 가 허용 타입을 모릅니다.',
    })
  }

  /**
   * §4.3.1 helper — single Stage prompt row (Edit + Reset + status).
   * canonicalPath 가 override 대상; legacyPath 가 있으면 legacy 존재도 "Custom override" 로 표시.
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
        resetButton = btn.buttonEl
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
      if (resetButton) resetButton.disabled = !isCustom
    })()
  }

  // ── Section: Schema Override (.wikey/schema.yaml — v7-5) ──
  private renderSchemaOverrideSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Schema Override' })

    const { vault } = this.plugin.app
    const path = '.wikey/schema.yaml'
    const descEl = containerEl.createDiv({ cls: 'wikey-settings-status-desc' })
    const statusSpan = descEl.createSpan({
      text: 'Add domain-specific entity/concept types on top of the built-in 4+3. Status: …',
    })

    let removeButton: HTMLButtonElement | null = null
    new Setting(containerEl)
      .setName('Edit schema.yaml')
      .setDesc('Extend canonicalizer with user-defined types (e.g. dataset, regulation). Built-in types always stay active.')
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
        removeButton = btn.buttonEl
        btn.setButtonText('Remove').setDisabled(true).onClick(async () => {
          if (!(await vault.adapter.exists(path))) {
            new Notice('No schema override in use.')
            return
          }
          if (!confirm(`Remove schema override? This deletes ${path}.`)) return
          await vault.adapter.remove(path)
          new Notice('Schema override removed — back to built-in types only.')
          this.display()
        })
      })

    // Async status update — reflect parsed override (type counts) so users see it took effect
    void (async () => {
      const exists = await vault.adapter.exists(path)
      if (!exists) {
        statusSpan.setText('Add domain-specific entity/concept types on top of the built-in 4+3. Status: Built-in only (no override).')
        if (removeButton) removeButton.disabled = true
        return
      }
      try {
        const parsed = await loadSchemaOverride(this.plugin.wikiFS)
        if (!parsed) {
          statusSpan.setText(`Add domain-specific entity/concept types on top of the built-in 4+3. Status: File exists at ${path} but parses to no valid types.`)
        } else {
          statusSpan.setText(
            `Add domain-specific entity/concept types on top of the built-in 4+3. Status: +${parsed.entityTypes.length} entity, +${parsed.conceptTypes.length} concept from ${path}.`,
          )
        }
      } catch (err) {
        statusSpan.setText(`Add domain-specific entity/concept types on top of the built-in 4+3. Status: parse error — ${(err as Error).message}`)
      }
      if (removeButton) removeButton.disabled = false
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
        { value: 'always', label: 'Always (권장)' },
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
      .setDesc('추출 완료 후 생성될 페이지 목록을 미리 확인. 브리프 모달에서 이번 1회만 덮어쓸 수 있음.')
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
      .setName('PII 감지 시 인제스트 진행')
      .setDesc('OFF (기본): PII 감지 시 인제스트 차단. ON: 감지 + 아래 치환 모드로 자동 마스킹 후 진행.')
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
      'PII 치환 모드',
      'mask (기본): 자릿수 보존 *** 치환. display: 원문 그대로 (PII 포함). hide: 민감 문장/라인 전체를 [PII 제거] 로 대체.',
      [
        { value: 'mask', label: 'mask — 자릿수 보존 (기본)' },
        { value: 'display', label: 'display — 원문 유지' },
        { value: 'hide', label: 'hide — 문장 전체 제거' },
      ],
      this.plugin.settings.piiRedactionMode,
      async (value) => {
        const v = value === 'display' || value === 'mask' || value === 'hide' ? value : 'mask'
        this.plugin.settings.piiRedactionMode = v
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
          .setPlaceholder('DEFAULT')
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

    // ── Phase 4 D.0.c (v6 §4.1.4): PII 2-layer gate — Advanced ──
    new Setting(containerEl)
      .setName('PII 검사 활성화')
      .setDesc(
        'ON (기본): 모든 인제스트에서 BRN·법인등록번호·대표이사 이름을 검사. ' +
        'OFF: 검사 자체를 수행하지 않습니다. 공시 가능 문서(법인공시, IR, 보도자료 등)만 끄세요. ' +
        '이것은 사용자 신뢰 설정이며 기술적 안전 장치가 아닙니다.',
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
            this.display()
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
      text: 'Template 변수 (`{{...}}`) 를 제거하거나 JSON 출력 스키마를 바꾸면 pipeline 이 깨집니다. bundled 를 기준으로 최소한으로 수정하세요.',
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

const SCHEMA_OVERRIDE_TEMPLATE = `# wikey schema override — .wikey/schema.yaml (v7-5)
#
# Add domain-specific entity/concept types on top of the built-in 4+3.
# Built-in types (organization/person/product/tool · standard/methodology/document_type)
# always stay active and cannot be overridden here.
#
# Remove this file to revert to built-in types only.

entity_types:
  - name: dataset
    description: 공개된 구조화된 데이터 모음 (예: imagenet, kaggle-titanic)
  - name: location
    description: 지리적 지명·시설 (예: seoul, leverkusen)

concept_types:
  - name: regulation
    description: 특정 국가·기관의 규제·법령 (예: gdpr, k-fda-guidelines)
`

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
      text: 'Define additional entity/concept types for the canonicalizer. Built-in types (organization/person/product/tool · standard/methodology/document_type) are always active and cannot be overridden here.',
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
