import { App, PluginSettingTab } from 'obsidian'
import type WikeyPlugin from './main'

// TODO: Phase 3-2-B 구현
// - BASIC_MODEL 드롭다운
// - API 키 입력 (비밀번호 마스킹) + Sync 경고 [M1]
// - Ollama URL + 연결 테스트
// - qmd 바이너리 경로
// - 비용 한도

export class WikeySettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: WikeyPlugin) {
    super(app, plugin)
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()
    containerEl.createEl('h2', { text: 'Wikey Settings — Phase 3-2-B' })
  }
}
