import { App, Notice, PluginSettingTab, Setting, requestUrl } from 'obsidian'
import { costTrackerSummary, validateWiki, checkPii, reindexWiki, reindexCheck } from 'wikey-core'
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
    this.renderGeneralSection(containerEl)
    this.renderApiKeysSection(containerEl)
    this.renderSearchSection(containerEl)
    this.renderCostSection(containerEl)
    this.renderToolsSection(containerEl)
    this.renderAdvancedSection(containerEl)
  }

  // ── Section 1: Environment Status ──
  private renderEnvStatusSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: '환경 상태' })

    const env = this.plugin.envStatus
    const statusContainer = containerEl.createDiv({ cls: 'wikey-settings-status-group' })

    if (!env) {
      statusContainer.createEl('p', { text: '환경 탐지 중...', cls: 'wikey-settings-status-label' })
      new Setting(containerEl).addButton((btn) =>
        btn.setButtonText('재탐지').onClick(async () => {
          await this.plugin.runEnvDetection()
          this.display()
        }),
      )
      return
    }

    const items: Array<{ label: string; value: string; ok: boolean }> = [
      { label: 'Node.js', value: env.nodePath || '미발견', ok: !!env.nodePath },
      { label: 'Python3', value: env.pythonPath || '미발견 (한국어 검색 제한)', ok: !!env.pythonPath },
      { label: 'kiwipiepy', value: env.hasKiwipiepy ? '설치됨' : '미설치 (한국어 검색 제한)', ok: env.hasKiwipiepy },
      { label: 'qmd', value: env.qmdPath || '미발견', ok: !!env.qmdPath },
      { label: 'Ollama', value: env.ollamaRunning ? `실행 중 (${env.ollamaModels.length}개 모델)` : '미실행', ok: env.ollamaRunning },
      { label: 'Gemma 4', value: env.hasGemma4 ? '설치됨' : '미설치', ok: env.hasGemma4 },
    ]

    for (const item of items) {
      const row = statusContainer.createDiv({ cls: 'wikey-settings-status-row' })
      row.createEl('span', { text: item.label, cls: 'wikey-settings-status-label' })
      const badge = row.createEl('span', {
        text: item.value,
        cls: `wikey-settings-status-badge ${item.ok ? 'wikey-status-ok' : 'wikey-status-error'}`,
      })
    }

    // Issues
    if (env.issues.length > 0) {
      const issueBox = containerEl.createDiv({ cls: 'wikey-settings-warning' })
      issueBox.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/></svg> ${env.issues.join(' | ')}`
    }

    // Re-detect button
    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText('환경 재탐지').onClick(async () => {
        btn.setButtonText('탐지 중...')
        btn.setDisabled(true)
        await this.plugin.runEnvDetection()
        this.display()
      }),
    )

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

    if (!env.ollamaRunning) {
      new Setting(containerEl)
        .setDesc('Ollama를 설치하고 실행하세요')
        .addButton((btn) => btn.setButtonText('Ollama 설치 가이드').onClick(() => window.open('https://ollama.com')))
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

  // ── Section: General ──
  private renderGeneralSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: '일반' })

    new Setting(containerEl)
      .setName('대화 기록 저장')
      .setDesc('채팅 대화를 저장해서 재시작 후에도 유지해요. (최대 100건)')
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
            new Notice(value ? '대화 기록이 저장됩니다.' : '대화 기록 저장이 비활성화되었어요.')
          }),
      )

    new Setting(containerEl)
      .setName('Sync 보호')
      .setDesc('API 키를 vault 외부에 저장해요. Obsidian Sync 사용 시 활성화하세요.')
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncProtection)
          .onChange(async (value) => {
            this.plugin.settings = { ...this.plugin.settings, syncProtection: value }
            if (value) {
              this.plugin.saveCredentials()
            } else {
              this.plugin.deleteCredentials()
            }
            await this.plugin.saveSettings()
            new Notice(value ? 'API 키가 외부에 저장됩니다.' : 'API 키가 data.json에 저장됩니다.')
          }),
      )
  }

  // ── Section 3: API Keys ──
  private renderApiKeysSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: 'API 키' })

    if (!this.plugin.settings.syncProtection) {
      const syncWarning = containerEl.createDiv({ cls: 'wikey-settings-warning' })
      syncWarning.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M8.982 1.566a1.13 1.13 0 0 0-1.96 0L.165 13.233c-.457.778.091 1.767.98 1.767h13.713c.889 0 1.438-.99.98-1.767zM8 5c.535 0 .954.462.9.995l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 5.995A.905.905 0 0 1 8 5m.002 6a1 1 0 1 1 0 2 1 1 0 0 1 0-2"/></svg> Sync 보호가 꺼져 있어요. API 키가 data.json에 저장되며 Obsidian Sync로 동기화될 수 있습니다.'
    }

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
        if (ok) btn.buttonEl.addClass('wikey-btn-success')
        else btn.buttonEl.addClass('wikey-btn-error')
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
          const resp = await requestUrl({ url: `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`, method: 'GET' })
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
          const resp = await requestUrl({ url: 'https://api.openai.com/v1/models', method: 'GET', headers: { Authorization: `Bearer ${key}` } })
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

    new Setting(containerEl)
      .setName('qmd 경로')
      .setDesc(`현재: ${this.plugin.settings.qmdPath || '자동 탐지'}`)
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

    // Cost summary display
    const costBox = containerEl.createDiv({ cls: 'wikey-settings-result-box' })
    costBox.createEl('span', { text: '비용 요약을 로드하려면 아래 버튼을 클릭하세요.', cls: 'wikey-settings-result-placeholder' })

    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText('비용 요약 조회').onClick(async () => {
        btn.setButtonText('조회 중...')
        btn.setDisabled(true)
        const basePath = (this.plugin.app.vault.adapter as any).basePath ?? ''
        const env = this.plugin.getExecEnv()
        const result = await costTrackerSummary(basePath, env)
        costBox.empty()
        if (result.success && result.stdout.trim()) {
          costBox.createEl('pre', { text: result.stdout.trim(), cls: 'wikey-settings-result-output' })
        } else if (!result.success) {
          costBox.createEl('pre', { text: result.stderr || '비용 추적 스크립트 실행 실패', cls: 'wikey-settings-result-error' })
        } else {
          costBox.createEl('span', { text: '비용 기록 없음', cls: 'wikey-settings-result-placeholder' })
        }
        btn.setButtonText('비용 요약 조회')
        btn.setDisabled(false)
      }),
    )
  }

  // ── Section 6: Wiki Tools ──
  private renderToolsSection(containerEl: HTMLElement): void {
    containerEl.createEl('h3', { text: '위키 도구' })

    const basePath = (this.plugin.app.vault.adapter as any).basePath ?? ''
    const env = this.plugin.getExecEnv()

    // --- Reindex ---
    const reindexBox = containerEl.createDiv({ cls: 'wikey-settings-result-box' })
    reindexBox.createEl('span', { text: '인덱스 상태를 확인하려면 아래 버튼을 클릭하세요.', cls: 'wikey-settings-result-placeholder' })

    const reindexSetting = new Setting(containerEl)
    reindexSetting.addButton((btn) =>
      btn.setButtonText('인덱스 상태 확인').onClick(async () => {
        btn.setButtonText('확인 중...')
        btn.setDisabled(true)
        const result = await reindexCheck(basePath, env)
        reindexBox.empty()
        reindexBox.createEl('pre', {
          text: result.stdout.trim() || result.stderr.trim() || '출력 없음',
          cls: result.success ? 'wikey-settings-result-output' : 'wikey-settings-result-error',
        })
        btn.setButtonText('인덱스 상태 확인')
        btn.setDisabled(false)
      }),
    )
    reindexSetting.addButton((btn) =>
      btn.setButtonText('전체 인덱싱').setCta().onClick(async () => {
        btn.setButtonText('인덱싱 중...')
        btn.setDisabled(true)
        reindexBox.empty()
        reindexBox.createEl('span', { text: '전체 인덱싱 실행 중... (최대 2분)', cls: 'wikey-settings-result-placeholder' })
        const result = await reindexWiki(basePath, env, 'full')
        reindexBox.empty()
        reindexBox.createEl('pre', {
          text: result.stdout.trim() || result.stderr.trim() || '완료',
          cls: result.success ? 'wikey-settings-result-output' : 'wikey-settings-result-error',
        })
        if (result.success) new Notice('전체 인덱싱 완료')
        else new Notice('인덱싱 실패 — 상세 내용은 설정 탭 확인')
        btn.setButtonText('전체 인덱싱')
        btn.setDisabled(false)
      }),
    )

    // --- Validate Wiki ---
    const validateBox = containerEl.createDiv({ cls: 'wikey-settings-result-box' })
    validateBox.createEl('span', { text: '위키 검증 결과가 여기에 표시됩니다.', cls: 'wikey-settings-result-placeholder' })

    const validateSetting = new Setting(containerEl)
    validateSetting.addButton((btn) =>
      btn.setButtonText('위키 검증').onClick(async () => {
        btn.setButtonText('검증 중...')
        btn.setDisabled(true)
        const result = await validateWiki(basePath, env)
        validateBox.empty()
        validateBox.createEl('pre', {
          text: result.stdout.trim() || result.stderr.trim() || '검증 완료 — 이슈 없음',
          cls: result.success ? 'wikey-settings-result-output' : 'wikey-settings-result-error',
        })
        if (result.success) new Notice('위키 검증 통과')
        else new Notice('위키 검증에서 이슈 발견')
        btn.setButtonText('위키 검증')
        btn.setDisabled(false)
      }),
    )
    validateSetting.addButton((btn) =>
      btn.setButtonText('PII 스캔').onClick(async () => {
        btn.setButtonText('스캔 중...')
        btn.setDisabled(true)
        const result = await checkPii(basePath, env)
        validateBox.empty()
        validateBox.createEl('pre', {
          text: result.stdout.trim() || result.stderr.trim() || 'PII 미발견',
          cls: result.success ? 'wikey-settings-result-output' : 'wikey-settings-result-error',
        })
        if (result.success) new Notice('PII 스캔 통과')
        else new Notice('PII 감지됨 — 상세 내용은 설정 탭 확인')
        btn.setButtonText('PII 스캔')
        btn.setDisabled(false)
      }),
    )
  }

  // ── Section 7: Advanced (per-process LLM) ──
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
            this.display()
          }),
      )

    if (!this.plugin.settings.advancedLLM) return

    const providerOptions: Record<string, string> = {
      '': '(기본 모델 사용)',
      'gemini': 'Gemini',
      'anthropic': 'Anthropic',
      'openai': 'OpenAI',
      'ollama': 'Ollama',
    }

    for (const [key, label, desc] of [
      ['ingestProvider', '인제스트 프로바이더', '소스 → 위키 페이지 생성에 사용할 LLM'],
      ['lintProvider', '린트 프로바이더', '위키 정합성 검사에 사용할 LLM'],
      ['summarizeProvider', '요약 프로바이더', '대용량 소스 요약에 사용할 LLM'],
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
