import { Plugin } from 'obsidian'

// TODO: Phase 3-2-A 구현
// - onload(): 리본 아이콘, 커맨드, 설정 탭, 채팅 뷰, 상태 바 등록
// - onunload(): 리소스 정리
// - ObsidianWikiFS, ObsidianHttpClient 어댑터
// - wikey-core 인스턴스 초기화

export default class WikeyPlugin extends Plugin {
  async onload() {
    console.log('Wikey plugin loaded')
  }

  onunload() {
    console.log('Wikey plugin unloaded')
  }
}
