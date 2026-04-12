import { App, Notice, PluginSettingTab, Setting, requestUrl } from 'obsidian'
import type WikeyPlugin from './main'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export class WikeySettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: WikeyPlugin) {
    super(app, plugin)
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    containerEl.createEl('h2', { text: 'Wikey Settings' })

    this.renderLocalLLMSection(containerEl)
    this.renderBasicModelSection(containerEl)
    this.renderApiKeysSection(containerEl)
    this.renderSearchSection(containerEl)
    this.renderCostSection(containerEl)
    this.renderAdvancedSection(containerEl)
  }

  // ── Section 1: Local LLM Status ──
  private renderLocalLLMSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'Local LLM (Ollama)' })

    const statusContainer = containerEl.createDiv({ cls: 'wikey-settings-status-group' })

    // Ollama status
    const ollamaRow = statusContainer.createDiv({ cls: 'wikey-settings-status-row' })
    ollamaRow.createEl('span', { text: 'Ollama', cls: 'wikey-settings-status-label' })
    const ollamaStatus = ollamaRow.createEl('span', { text: '확인 중...', cls: 'wikey-settings-status-badge' })

    // Gemma4 status
    const gemmaRow = statusContainer.createDiv({ cls: 'wikey-settings-status-row' })
    gemmaRow.createEl('span', { text: 'Gemma 4', cls: 'wikey-settings-status-label' })
    const gemmaStatus = gemmaRow.createEl('span', { text: '확인 중...', cls: 'wikey-settings-status-badge' })

    // Check status
    this.checkOllamaStatus(ollamaStatus, gemmaStatus)

    // Ollama URL
    new Setting(containerEl)
      .setName('Ollama URL')
      .setDesc('Ollama 서버 주소')
      .addText((text) =>
        text
          .setPlaceholder('http://localhost:11434')
          .setValue(this.plugin.settings.ollamaUrl)
          .onChange(async (value) => {
            this.plugin.settings.ollamaUrl = value
            await this.plugin.saveSettings()
          }),
      )
  }

  private async checkOllamaStatus(ollamaBadge: HTMLElement, gemmaBadge: HTMLElement): Promise<void> {
    const url = this.plugin.settings.ollamaUrl || 'http://localhost:11434'
    try {
      const http = require('node:http') as typeof import('node:http')
      const body = await new Promise<string>((resolve, reject) => {
        const req = http.get(`${url}/api/tags`, (res) => {
          const chunks: Buffer[] = []
          res.on('data', (c: Buffer) => chunks.push(c))
          res.on('end', () => resolve(Buffer.concat(chunks).toString()))
        })
        req.on('error', reject)
        req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')) })
      })

      const data = JSON.parse(body)
      const models: string[] = (data.models ?? []).map((m: any) => m.name)
      const modelCount = models.length

      ollamaBadge.setText(`실행 중 (${modelCount}개 모델)`)
      ollamaBadge.addClass('wikey-status-ok')

      const hasGemma4 = models.some((n: string) => n.includes('gemma4') || n.includes('wikey'))
      if (hasGemma4) {
        gemmaBadge.setText('설치됨')
        gemmaBadge.addClass('wikey-status-ok')
      } else {
        gemmaBadge.setText('미설치 — ollama pull gemma4 실행 필요')
        gemmaBadge.addClass('wikey-status-warn')
      }
    } catch {
      ollamaBadge.setText('미실행')
      ollamaBadge.addClass('wikey-status-error')
      gemmaBadge.setText('확인 불가')
      gemmaBadge.addClass('wikey-status-error')

      new Setting(ollamaBadge.parentElement!.parentElement!)
        .setName('')
        .setDesc('Ollama를 설치하고 실행하세요: https://ollama.com')
        .addButton((btn) =>
          btn.setButtonText('설치 가이드').onClick(() => {
            window.open('https://ollama.com')
          }),
        )
    }
  }

  // ── Section 2: Basic Model ──
  private renderBasicModelSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: '기본 모델' })

    new Setting(containerEl)
      .setName('BASIC_MODEL')
      .setDesc('모든 LLM 작업의 기본 프로바이더. 고급 설정에서 프로세스별 오버라이드 가능.')
      .addDropdown((drop) =>
        drop
          .addOption('ollama', 'Ollama (로컬, 무료)')
          .addOption('gemini', 'Gemini (클라우드)')
          .addOption('anthropic', 'Anthropic (클라우드)')
          .addOption('openai', 'OpenAI (클라우드)')
          .addOption('claude-code', 'Claude Code (API키 → Anthropic, 없으면 Ollama)')
          .setValue(this.plugin.settings.basicModel)
          .onChange(async (value) => {
            this.plugin.settings.basicModel = value
            await this.plugin.saveSettings()
          }),
      )
  }

  // ── Section 3: API Keys ──
  private renderApiKeysSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'API 키' })

    const syncWarning = containerEl.createDiv({ cls: 'wikey-settings-warning' })
    syncWarning.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/></svg> Obsidian Sync 사용 시 API 키가 동기화될 수 있습니다.'

    this.renderApiKeyField(containerEl, 'Gemini API Key', 'geminiApiKey', 'AIza...', 'gemini')
    this.renderApiKeyField(containerEl, 'Anthropic API Key', 'anthropicApiKey', 'sk-ant-...', 'anthropic')
    this.renderApiKeyField(containerEl, 'OpenAI API Key', 'openaiApiKey', 'sk-...', 'openai')
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
      btn.setButtonText('연결 테스트').onClick(async () => {
        btn.setButtonText('...')
        btn.setDisabled(true)
        const ok = await this.testApiConnection(provider)
        btn.setButtonText(ok ? '✓ Connected' : '✗ Failed')
        btn.setDisabled(false)
        if (ok) {
          btn.buttonEl.addClass('wikey-btn-success')
        } else {
          btn.buttonEl.addClass('wikey-btn-error')
        }
        setTimeout(() => {
          btn.setButtonText('연결 테스트')
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
          if (!key) { new Notice('Gemini API 키를 입력하세요.'); return false }
          const resp = await requestUrl({
            url: `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
            method: 'GET',
          })
          if (resp.status === 200) { new Notice('Gemini 연결 성공'); return true }
          new Notice(`Gemini 오류: ${resp.status}`); return false
        }
        case 'anthropic': {
          const key = this.plugin.settings.anthropicApiKey
          if (!key) { new Notice('Anthropic API 키를 입력하세요.'); return false }
          const resp = await requestUrl({
            url: 'https://api.anthropic.com/v1/messages',
            method: 'POST',
            headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
          })
          if (resp.status === 200) { new Notice('Anthropic 연결 성공'); return true }
          new Notice(`Anthropic 오류: ${resp.status}`); return false
        }
        case 'openai': {
          const key = this.plugin.settings.openaiApiKey
          if (!key) { new Notice('OpenAI API 키를 입력하세요.'); return false }
          const resp = await requestUrl({
            url: 'https://api.openai.com/v1/models',
            method: 'GET',
            headers: { Authorization: `Bearer ${key}` },
          })
          if (resp.status === 200) { new Notice('OpenAI 연결 성공'); return true }
          new Notice(`OpenAI 오류: ${resp.status}`); return false
        }
        default: return false
      }
    } catch (err: any) {
      new Notice(`연결 실패: ${err?.message ?? err}`)
      return false
    }
  }

  // ── Section 4: Search ──
  private renderSearchSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: '검색 (qmd)' })

    // qmd status
    const qmdRow = containerEl.createDiv({ cls: 'wikey-settings-status-row' })
    qmdRow.createEl('span', { text: 'qmd', cls: 'wikey-settings-status-label' })
    const qmdStatus = qmdRow.createEl('span', { text: '확인 중...', cls: 'wikey-settings-status-badge' })
    this.checkQmdStatus(qmdStatus)

    new Setting(containerEl)
      .setName('qmd 경로')
      .setDesc('비워두면 자동 탐지 (tools/qmd/bin/qmd → which qmd)')
      .addText((text) =>
        text
          .setPlaceholder('자동 탐지')
          .setValue(this.plugin.settings.qmdPath)
          .onChange(async (value) => {
            this.plugin.settings.qmdPath = value
            await this.plugin.saveSettings()
          }),
      )
  }

  private async checkQmdStatus(badge: HTMLElement): Promise<void> {
    const basePath = (this.app.vault.adapter as any).basePath ?? ''
    const { join } = require('node:path') as typeof import('node:path')
    const qmdPath = this.plugin.settings.qmdPath || join(basePath, 'tools/qmd/bin/qmd')

    try {
      const { accessSync } = require('node:fs') as typeof import('node:fs')
      accessSync(qmdPath)
      badge.setText(`정상 (${qmdPath.split('/').pop()})`)
      badge.addClass('wikey-status-ok')
    } catch {
      badge.setText('미설치')
      badge.addClass('wikey-status-error')
    }
  }

  // ── Section 5: Cost ──
  private renderCostSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: '비용 관리' })

    new Setting(containerEl)
      .setName('월 비용 한도 ($)')
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
  }

  // ── Section 6: Advanced (per-process LLM) ──
  private renderAdvancedSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: '고급 설정' })

    new Setting(containerEl)
      .setName('프로세스별 LLM 오버라이드')
      .setDesc('활성화하면 인제스트, 린트, 요약에 각각 다른 프로바이더를 지정할 수 있습니다.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.advancedLLM)
          .onChange(async (value) => {
            this.plugin.settings.advancedLLM = value
            await this.plugin.saveSettings()
            this.display() // re-render
          }),
      )

    if (!this.plugin.settings.advancedLLM) return

    const providerOptions = {
      '': '(기본 모델 사용)',
      'gemini': 'Gemini',
      'anthropic': 'Anthropic',
      'openai': 'OpenAI',
      'ollama': 'Ollama',
    }

    new Setting(containerEl)
      .setName('인제스트 프로바이더')
      .setDesc('소스 → 위키 페이지 생성에 사용할 LLM')
      .addDropdown((drop) => {
        for (const [k, v] of Object.entries(providerOptions)) drop.addOption(k, v)
        drop.setValue(this.plugin.settings.ingestProvider)
          .onChange(async (value) => {
            this.plugin.settings.ingestProvider = value
            await this.plugin.saveSettings()
          })
      })

    new Setting(containerEl)
      .setName('린트 프로바이더')
      .setDesc('위키 정합성 검사에 사용할 LLM')
      .addDropdown((drop) => {
        for (const [k, v] of Object.entries(providerOptions)) drop.addOption(k, v)
        drop.setValue(this.plugin.settings.lintProvider)
          .onChange(async (value) => {
            this.plugin.settings.lintProvider = value
            await this.plugin.saveSettings()
          })
      })

    new Setting(containerEl)
      .setName('요약 프로바이더')
      .setDesc('대용량 소스 요약에 사용할 LLM')
      .addDropdown((drop) => {
        for (const [k, v] of Object.entries(providerOptions)) drop.addOption(k, v)
        drop.setValue(this.plugin.settings.summarizeProvider)
          .onChange(async (value) => {
            this.plugin.settings.summarizeProvider = value
            await this.plugin.saveSettings()
          })
      })
  }
}
