import { App, Notice, PluginSettingTab, Setting, requestUrl } from 'obsidian'
import type WikeyPlugin from './main'

export class WikeySettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: WikeyPlugin) {
    super(app, plugin)
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    containerEl.createEl('h2', { text: 'Wikey Settings' })

    // BASIC_MODEL
    new Setting(containerEl)
      .setName('기본 모델')
      .setDesc('모든 LLM 작업의 기본 프로바이더')
      .addDropdown((drop) =>
        drop
          .addOption('ollama', 'Ollama (로컬)')
          .addOption('gemini', 'Gemini')
          .addOption('anthropic', 'Anthropic')
          .addOption('openai', 'OpenAI')
          .addOption('claude-code', 'Claude Code')
          .setValue(this.plugin.settings.basicModel)
          .onChange(async (value) => {
            this.plugin.settings.basicModel = value
            await this.plugin.saveSettings()
          }),
      )

    // Ollama
    containerEl.createEl('h3', { text: 'Ollama' })

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

    new Setting(containerEl)
      .setName('연결 테스트')
      .setDesc('Ollama 서버 연결 상태를 확인합니다')
      .addButton((btn) =>
        btn.setButtonText('연결 확인').onClick(async () => {
          btn.setButtonText('확인 중...')
          btn.setDisabled(true)
          try {
            const url = this.plugin.settings.ollamaUrl || 'http://localhost:11434'
            const response = await requestUrl({ url: `${url}/api/tags`, method: 'GET' })
            if (response.status === 200) {
              const models = response.json?.models?.length ?? 0
              new Notice(`Ollama 연결 성공 (${models}개 모델)`)
              btn.setButtonText('연결 성공 ✓')
            } else {
              new Notice(`Ollama 응답 오류: ${response.status}`)
              btn.setButtonText('연결 실패 ✗')
            }
          } catch {
            new Notice('Ollama에 연결할 수 없습니다. 서버가 실행 중인지 확인하세요.')
            btn.setButtonText('연결 실패 ✗')
          } finally {
            btn.setDisabled(false)
          }
        }),
      )

    // API Keys
    containerEl.createEl('h3', { text: 'API 키' })

    const syncWarning = containerEl.createEl('p', {
      text: '⚠️ Obsidian Sync를 사용하는 경우 API 키가 동기화됩니다. 공유 볼트에서는 주의하세요.',
      cls: 'mod-warning',
    })
    syncWarning.style.color = 'var(--text-warning)'
    syncWarning.style.fontSize = '0.85em'

    new Setting(containerEl)
      .setName('Gemini API Key')
      .addText((text) =>
        text
          .setPlaceholder('AIza...')
          .setValue(this.plugin.settings.geminiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.geminiApiKey = value
            await this.plugin.saveSettings()
          }),
      )
      .then((setting) => {
        const input = setting.controlEl.querySelector('input')
        if (input) input.type = 'password'
      })

    new Setting(containerEl)
      .setName('Anthropic API Key')
      .addText((text) =>
        text
          .setPlaceholder('sk-ant-...')
          .setValue(this.plugin.settings.anthropicApiKey)
          .onChange(async (value) => {
            this.plugin.settings.anthropicApiKey = value
            await this.plugin.saveSettings()
          }),
      )
      .then((setting) => {
        const input = setting.controlEl.querySelector('input')
        if (input) input.type = 'password'
      })

    new Setting(containerEl)
      .setName('OpenAI API Key')
      .addText((text) =>
        text
          .setPlaceholder('sk-...')
          .setValue(this.plugin.settings.openaiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.openaiApiKey = value
            await this.plugin.saveSettings()
          }),
      )
      .then((setting) => {
        const input = setting.controlEl.querySelector('input')
        if (input) input.type = 'password'
      })

    // qmd
    containerEl.createEl('h3', { text: '검색' })

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

    // Cost
    containerEl.createEl('h3', { text: '비용' })

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
}
