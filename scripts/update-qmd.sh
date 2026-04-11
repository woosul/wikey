#!/usr/bin/env bash
# update-qmd.sh — vendored qmd upstream 관리
#
# 사용법:
#   ./scripts/update-qmd.sh --check   # 최신 버전 확인 (변경 없음)
#   ./scripts/update-qmd.sh --apply   # 새 버전 다운로드 → 교체 → 검증
#
# tools/qmd/에 vendored된 qmd 소스의 upstream(@tobilu/qmd) 버전을 관리한다.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
QMD_DIR="${PROJECT_DIR}/tools/qmd"
QMD_BIN="${QMD_DIR}/bin/qmd"
QMD_PKG="@tobilu/qmd"
TMP_DIR=""

# --- 색상 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[qmd-update]${NC} $*"; }
log_ok()    { echo -e "${GREEN}[qmd-update]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[qmd-update]${NC} $*"; }
log_error() { echo -e "${RED}[qmd-update]${NC} $*"; }

cleanup() {
  if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
    rm -rf "$TMP_DIR"
  fi
}
trap cleanup EXIT

usage() {
  cat <<'USAGE'
update-qmd.sh — vendored qmd upstream 관리

사용법:
  ./scripts/update-qmd.sh --check   최신 버전 확인 (변경 없음)
  ./scripts/update-qmd.sh --apply   새 버전 다운로드 → 교체 → 검증
USAGE
  exit 0
}

# --- 현재 버전 읽기 ---
get_local_version() {
  if [ -f "${QMD_DIR}/package.json" ]; then
    python3 -c "import json; print(json.load(open('${QMD_DIR}/package.json'))['version'])"
  else
    echo "none"
  fi
}

# --- 로컬 커밋 해시 ---
get_local_commit() {
  if [ -d "${QMD_DIR}/.git" ]; then
    (cd "$QMD_DIR" && git rev-parse --short HEAD 2>/dev/null) || echo "unknown"
  else
    echo "no-git"
  fi
}

# --- upstream 최신 커밋/버전 확인 ---
get_remote_info() {
  if [ -d "${QMD_DIR}/.git" ]; then
    (cd "$QMD_DIR" && git fetch origin --quiet 2>/dev/null)
    local behind
    behind=$(cd "$QMD_DIR" && git rev-list HEAD..origin/main --count 2>/dev/null || echo "0")
    local remote_commit
    remote_commit=$(cd "$QMD_DIR" && git rev-parse --short origin/main 2>/dev/null || echo "unknown")
    echo "${behind}:${remote_commit}"
  else
    echo "error:no-git"
  fi
}

# --- 최근 커밋 로그 (upstream 기준) ---
show_upstream_log() {
  local count="${1:-10}"
  log_info "upstream 최근 커밋:"
  echo ""
  (cd "$QMD_DIR" && git log HEAD..origin/main --oneline --no-decorate 2>/dev/null | head -"$count") || log_warn "커밋 로그 조회 실패"
  echo ""
  log_info "전체 CHANGELOG: https://github.com/tobi/qmd/blob/main/CHANGELOG.md"
}

# --- git pull + 의존성 재설치 ---
apply_update() {
  log_info "upstream 병합 중 (git pull)..."

  local pull_result
  pull_result=$(cd "$QMD_DIR" && git pull origin main 2>&1)
  local pull_exit=$?

  if [ $pull_exit -ne 0 ]; then
    log_error "git pull 실패:"
    echo "$pull_result"
    log_warn "충돌이 있으면 tools/qmd/에서 수동으로 해결하세요."
    exit 1
  fi

  echo "$pull_result" | head -5

  # 의존성 변경 확인 + 재설치
  if echo "$pull_result" | grep -q "package.json\|package-lock"; then
    log_info "package.json 변경 감지. 의존성 재설치 중..."
    (cd "$QMD_DIR" && npm install --quiet 2>/dev/null)
  fi

  # 동작 검증
  log_info "동작 검증 중..."
  local new_ver
  new_ver=$("$QMD_BIN" --version 2>&1 | head -1 || echo "error")
  log_ok "버전: ${new_ver}"

  # 검색 테스트
  local search_result
  search_result=$("$QMD_BIN" query "test" --files -n 1 -c wikey-wiki 2>/dev/null | head -1 || echo "")
  if [ -n "$search_result" ]; then
    log_ok "검색 테스트 통과"
  else
    log_warn "검색 테스트 실패 — qmd embed 재실행이 필요할 수 있습니다"
  fi

  echo ""
  log_ok "업데이트 완료"
  log_info "wikey 프로젝트에 반영: git add tools/qmd/ && git commit"
}

# --- 메인 ---
if [ $# -eq 0 ]; then
  usage
fi

case "$1" in
  --check)
    local_ver=$(get_local_version)
    local_commit=$(get_local_commit)
    remote_info=$(get_remote_info)
    behind=$(echo "$remote_info" | cut -d: -f1)
    remote_commit=$(echo "$remote_info" | cut -d: -f2)

    log_info "현재: v${local_ver} (${local_commit})"
    log_info "upstream: ${remote_commit} (${behind}개 커밋 뒤처짐)"
    echo ""

    if [ "$behind" = "0" ]; then
      log_ok "최신 상태입니다."
    elif [ "$behind" = "error" ]; then
      log_error "upstream 조회 실패. 네트워크 또는 .git 디렉토리를 확인하세요."
      exit 1
    else
      log_warn "${behind}개 커밋이 뒤처져 있습니다."
      show_upstream_log "$behind"
      echo ""
      log_info "적용하려면: ./scripts/update-qmd.sh --apply"
    fi
    ;;

  --apply)
    local_ver=$(get_local_version)
    local_commit=$(get_local_commit)
    remote_info=$(get_remote_info)
    behind=$(echo "$remote_info" | cut -d: -f1)

    log_info "현재: v${local_ver} (${local_commit})"

    if [ "$behind" = "0" ]; then
      log_ok "이미 최신 상태입니다."
      exit 0
    fi

    log_warn "${behind}개 커밋 뒤처짐."
    show_upstream_log "$behind"
    echo ""

    read -rp "$(echo -e "${YELLOW}upstream을 병합하시겠습니까? [y/N]${NC} ")" confirm
    if [[ "$confirm" =~ ^[yY]$ ]]; then
      apply_update
    else
      log_info "취소되었습니다."
    fi
    ;;

  --help|-h)
    usage
    ;;

  *)
    log_error "알 수 없는 옵션: $1"
    usage
    ;;
esac
