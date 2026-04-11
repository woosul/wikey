#!/usr/bin/env bash
# classify-inbox.sh — inbox 항목 분류 + 이동
#
# 사용법:
#   ./scripts/classify-inbox.sh                    # 대화형: inbox 항목 나열 → 분류 제안 → 이동
#   ./scripts/classify-inbox.sh --dry-run          # 이동 없이 분류 제안만 출력
#   ./scripts/classify-inbox.sh --move <src> <dst> # 특정 항목 이동 (LLM 에이전트용)
#
# 이 스크립트는 단독으로도 동작하지만, Claude Code 분류 세션에서
# LLM이 --move 서브커맨드를 호출하여 자동화할 수 있다.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
INBOX_DIR="${PROJECT_DIR}/raw/0_inbox"
RAW_DIR="${PROJECT_DIR}/raw"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[classify]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[classify]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[classify]${NC} $*"; }
log_error() { echo -e "${RED}[classify]${NC} $*"; }

# 공유 분류 힌트 함수 로드
source "${SCRIPT_DIR}/lib/classify-hint.sh"

# --- 서브커맨드 ---

cmd_scan() {
  local dry_run="${1:-false}"
  local items=()

  while IFS= read -r -d '' item; do
    items+=("$item")
  done < <(find "$INBOX_DIR" -mindepth 1 -maxdepth 1 -not -name '.DS_Store' -not -name '.*' -print0 2>/dev/null | sort -z)

  if [ ${#items[@]} -eq 0 ]; then
    log_info "inbox 비어 있음. 분류할 항목이 없습니다."
    return
  fi

  log_info "${#items[@]}개 항목 분류 대기 중"
  echo ""

  for i in "${!items[@]}"; do
    local item="${items[$i]}"
    local name
    name=$(basename "$item")
    local hint
    hint=$(classify_hint "$item")
    local num=$((i + 1))

    if [ -d "$item" ]; then
      local fcount
      fcount=$(find "$item" -type f -not -name '.DS_Store' 2>/dev/null | wc -l | tr -d ' ')
      echo -e "  ${BOLD}${num}. 📁 ${name}/${NC} (${fcount}개 파일)"
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
      echo -e "  ${BOLD}${num}. 📄 ${name}${NC} (${human_size})"
    fi
    echo -e "     추천: ${CYAN}${hint}${NC}"
    echo ""
  done

  if [ "$dry_run" = "true" ]; then
    log_info "(dry-run 모드 — 이동하지 않음)"
    return
  fi

  echo -e "${YELLOW}다음 단계:${NC}"
  echo "  1. Claude Code에서 분류 세션 시작"
  echo "  2. 또는 수동 이동: ./scripts/classify-inbox.sh --move <파일> <대상폴더>"
}

cmd_move() {
  local src="$1"
  local dst="$2"

  # src가 상대경로면 inbox 기준으로 해석
  if [[ ! "$src" = /* ]]; then
    src="${INBOX_DIR}/${src}"
  fi

  # dst가 상대경로면 raw/ 기준으로 해석
  if [[ ! "$dst" = /* ]]; then
    dst="${RAW_DIR}/${dst}"
  fi

  if [ ! -e "$src" ]; then
    log_error "소스를 찾을 수 없습니다: ${src}"
    exit 1
  fi

  # 대상 디렉토리 생성
  local dst_dir
  if [ -d "$src" ]; then
    dst_dir="$dst"
  else
    dst_dir=$(dirname "$dst")
  fi
  mkdir -p "$dst_dir"

  # 이동
  mv "$src" "$dst"
  log_ok "이동 완료: $(basename "$src") → ${dst#${RAW_DIR}/}"
}

# --- 메인 ---

case "${1:-}" in
  --dry-run|-n)
    cmd_scan true
    ;;
  --move|-m)
    if [ $# -lt 3 ]; then
      log_error "사용법: classify-inbox.sh --move <소스> <대상>"
      exit 1
    fi
    cmd_move "$2" "$3"
    ;;
  --help|-h)
    echo "classify-inbox.sh — inbox 항목 분류 + 이동"
    echo ""
    echo "사용법:"
    echo "  ./scripts/classify-inbox.sh              대화형 분류 스캔"
    echo "  ./scripts/classify-inbox.sh --dry-run    이동 없이 제안만"
    echo "  ./scripts/classify-inbox.sh --move <src> <dst>  항목 이동"
    ;;
  *)
    cmd_scan false
    ;;
esac
