#!/usr/bin/env bash
# watch-inbox.sh — raw/0_inbox/ 파일시스템 감시
#
# 사용법:
#   ./scripts/watch-inbox.sh              # 감시 시작 (foreground)
#   ./scripts/watch-inbox.sh --status     # inbox 현재 상태 출력
#   ./scripts/watch-inbox.sh --list       # 미분류 파일 목록
#
# 의존성: fswatch (brew install fswatch)
#
# 동작:
#   - raw/0_inbox/에 새 파일/폴더 추가 시 macOS 알림 + 터미널 출력
#   - 알림에 파일명과 추천 분류를 포함
#   - Ctrl+C로 종료

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INBOX_DIR="${PROJECT_DIR}/raw/0_inbox"
CLASSIFY_DOC="${PROJECT_DIR}/raw/CLASSIFY.md"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# --- 헬퍼 ---

log_info()  { echo -e "${CYAN}[inbox]${NC} $*"; }
log_new()   { echo -e "${GREEN}[inbox]${NC} ${BOLD}NEW${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[inbox]${NC} $*"; }

notify() {
  local title="$1"
  local message="$2"
  if command -v osascript &>/dev/null; then
    osascript -e "display notification \"${message}\" with title \"${title}\"" 2>/dev/null || true
  fi
}

# 공유 분류 힌트 함수 로드
source "${SCRIPT_DIR}/lib/classify-hint.sh"

# --- 서브커맨드 ---

cmd_status() {
  local count
  count=$(find "$INBOX_DIR" -mindepth 1 -not -name '.DS_Store' -not -name '.*' 2>/dev/null | wc -l | tr -d ' ')

  if [ "$count" -eq 0 ]; then
    log_info "inbox 비어 있음 (분류 대기 없음)"
  else
    log_warn "inbox에 ${count}개 항목 대기 중"
    find "$INBOX_DIR" -mindepth 1 -maxdepth 1 -not -name '.DS_Store' -not -name '.*' 2>/dev/null | while read -r item; do
      local name
      name=$(basename "$item")
      local hint
      hint=$(classify_hint "$item")
      if [ -d "$item" ]; then
        local fcount
        fcount=$(find "$item" -type f -not -name '.DS_Store' | wc -l | tr -d ' ')
        echo -e "  ${BOLD}📁 ${name}/${NC} (${fcount}개 파일) → ${hint}"
      else
        local size
        size=$(stat -f%z "$item" 2>/dev/null || echo 0)
        local human_size
        if [ "$size" -gt 1048576 ]; then
          human_size="$((size / 1048576))MB"
        elif [ "$size" -gt 1024 ]; then
          human_size="$((size / 1024))KB"
        else
          human_size="${size}B"
        fi
        echo -e "  ${BOLD}📄 ${name}${NC} (${human_size}) → ${hint}"
      fi
    done
  fi
}

cmd_list() {
  find "$INBOX_DIR" -mindepth 1 -not -name '.DS_Store' -not -name '.*' -type f 2>/dev/null | sort
  find "$INBOX_DIR" -mindepth 1 -not -name '.DS_Store' -not -name '.*' -type d 2>/dev/null | sort
}

cmd_watch() {
  if ! command -v fswatch &>/dev/null; then
    echo -e "${RED}[inbox]${NC} fswatch가 설치되어 있지 않습니다."
    echo "  brew install fswatch"
    exit 1
  fi

  log_info "inbox 감시 시작: ${INBOX_DIR}"
  log_info "새 파일/폴더 추가 시 알림을 보냅니다. Ctrl+C로 종료."
  echo ""
  cmd_status
  echo ""

  fswatch -0 --event Created --event MovedTo --event Renamed \
    --exclude '\.DS_Store' \
    --recursive "$INBOX_DIR" | while IFS= read -r -d '' path; do
    # 숨김 파일 무시
    [[ "$(basename "$path")" == .* ]] && continue

    local name
    name=$(basename "$path")
    local hint
    hint=$(classify_hint "$path")
    local timestamp
    timestamp=$(date '+%H:%M:%S')

    log_new "[${timestamp}] ${name}"
    echo -e "    추천 분류: ${CYAN}${hint}${NC}"
    echo -e "    다음 단계: Claude Code에서 분류 세션 시작"
    echo ""

    notify "Wikey Inbox" "${name} → ${hint}"
  done
}

# --- 메인 ---

case "${1:-}" in
  --status|-s)
    cmd_status
    ;;
  --list|-l)
    cmd_list
    ;;
  --help|-h)
    echo "watch-inbox.sh — raw/0_inbox/ 파일시스템 감시"
    echo ""
    echo "사용법:"
    echo "  ./scripts/watch-inbox.sh              감시 시작"
    echo "  ./scripts/watch-inbox.sh --status      inbox 현재 상태"
    echo "  ./scripts/watch-inbox.sh --list        미분류 파일 목록"
    ;;
  *)
    cmd_watch
    ;;
esac
