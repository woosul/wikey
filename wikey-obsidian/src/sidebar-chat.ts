import { ItemView, WorkspaceLeaf } from 'obsidian'

// TODO: Phase 3-2-C 구현
// - WikeyChatView extends ItemView
// - 채팅 UI: 메시지 목록 + 입력 필드
// - query-pipeline 호출 → 마크다운 렌더링
// - 위키링크 클릭 → app.workspace.openLinkText()

export const WIKEY_CHAT_VIEW = 'wikey-chat'

export class WikeyChatView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf)
  }

  getViewType(): string {
    return WIKEY_CHAT_VIEW
  }

  getDisplayText(): string {
    return 'Wikey'
  }

  getIcon(): string {
    return 'search'
  }

  async onOpen() {
    const container = this.containerEl.children[1]
    container.empty()
    container.createEl('p', { text: 'Wikey Chat — Phase 3-2-C' })
  }

  async onClose() {
    // cleanup
  }
}
