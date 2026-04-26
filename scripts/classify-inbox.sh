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

  # 사용자 영구 결정 (2026-04-26): inbox 가 폴더 형태로 들어와도 분류 대상은
  # 파일만 평탄화 (옵션 B). -type f + 모든 depth 재귀 + hidden 제외.
  while IFS= read -r -d '' item; do
    items+=("$item")
  done < <(find "$INBOX_DIR" -mindepth 1 -type f -not -name '.DS_Store' -not -name '.*' -print0 2>/dev/null | sort -z)

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

  # 이동 (원본)
  mv "$src" "$dst"
  log_ok "이동 완료: $(basename "$src") → ${dst#${RAW_DIR}/}"

  # §4.2 S2-6: pair — sidecar <src>.md 가 있으면 같이 이동.
  local sidecar_src="${src}.md"
  local sidecar_moved=""
  if [ -f "$sidecar_src" ]; then
    local dst_base
    if [ -d "$dst" ]; then
      dst_base="${dst%/}/$(basename "$src").md"
    else
      dst_base="${dst}.md"
    fi
    if [ -e "$dst_base" ]; then
      log_warn "sidecar 대상에 이미 존재 — skip: ${dst_base#${RAW_DIR}/}"
    else
      mv "$sidecar_src" "$dst_base"
      log_ok "sidecar 이동: $(basename "$sidecar_src") → ${dst_base#${RAW_DIR}/}"
      sidecar_moved="$dst_base"
    fi
  fi

  # §4.2 S2-6: registry 즉시 갱신 (Obsidian 오프라인에서도 일관성 유지).
  # 경로는 vault-relative 로 변환해 registry-update.mjs 에 전달.
  local rel_src="${src#${PROJECT_DIR}/}"
  local final_dst
  if [[ "$dst" == */ ]]; then
    final_dst="${dst}$(basename "$src")"
  elif [ -d "$dst" ]; then
    final_dst="${dst%/}/$(basename "$src")"
  else
    final_dst="$dst"
  fi
  local rel_dst="${final_dst#${PROJECT_DIR}/}"
  local rel_sidecar=""
  if [ -n "$sidecar_moved" ]; then
    rel_sidecar="${sidecar_moved#${PROJECT_DIR}/}"
  fi
  if [ -f "${PROJECT_DIR}/.wikey/source-registry.json" ]; then
    if command -v node >/dev/null 2>&1; then
      (cd "$PROJECT_DIR" && node scripts/registry-update.mjs --record-move "$rel_src" "$rel_dst" "$rel_sidecar" >/dev/null 2>&1) \
        || log_warn "registry 갱신 실패 — Obsidian 재기동 시 reconcile 로 복구됨"
    else
      log_warn "node 를 찾을 수 없어 registry 갱신 생략"
    fi
  fi
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
