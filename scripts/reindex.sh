#!/usr/bin/env bash
# reindex.sh — 통합 인덱싱 파이프라인
#
# 사용법:
#   ./scripts/reindex.sh                # 전체 인덱싱 (qmd + embed + CR + 한국어)
#   ./scripts/reindex.sh --quick        # qmd update + embed만 (CR/한국어 스킵)
#   ./scripts/reindex.sh --check        # stale 여부만 확인 (갱신 안 함)
#
# 파이프라인:
#   1. qmd update     — 파일 스캔 → 신규/변경/삭제 감지
#   2. qmd embed      — 벡터 임베딩 갱신
#   3. contextual-retrieval.py --batch — Gemma 4 맥락 프리픽스 (캐시 있으면 스킵)
#   4. korean-tokenize.py --batch      — FTS5 한국어 형태소 전처리
#   5. validate-wiki.sh                — 검증

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
QMD_BIN="${PROJECT_DIR}/tools/qmd/bin/qmd"
COLLECTION="wikey-wiki"
STAMP_FILE="${HOME}/.cache/qmd/.last-reindex"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_step() { echo -e "\n${BOLD}${CYAN}[$1/5]${NC} ${BOLD}$2${NC}"; }
log_ok()   { echo -e "${GREEN}  ✓${NC} $*"; }
log_skip() { echo -e "${YELLOW}  △${NC} $* (스킵)"; }
log_err()  { echo -e "${RED}  ✗${NC} $*"; }

# --- stale 확인 ---
check_stale() {
  if [ ! -f "$STAMP_FILE" ]; then
    echo "never"
    return
  fi

  local stamp_time
  stamp_time=$(stat -f %m "$STAMP_FILE" 2>/dev/null || stat -c %Y "$STAMP_FILE" 2>/dev/null)

  local newest_wiki
  newest_wiki=$(find "${PROJECT_DIR}/wiki" -name "*.md" -newer "$STAMP_FILE" 2>/dev/null | head -5)

  if [ -n "$newest_wiki" ]; then
    echo "stale"
    echo "$newest_wiki"
  else
    echo "fresh"
  fi
}

# --- --check 모드 ---
cmd_check() {
  echo -e "${BOLD}=== 인덱스 상태 확인 ===${NC}"

  local result
  result=$(check_stale)
  local status
  status=$(echo "$result" | head -1)

  case "$status" in
    never)
      echo -e "${RED}  인덱스 타임스탬프 없음 — reindex.sh를 한 번도 실행하지 않음${NC}"
      ;;
    stale)
      local last
      last=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$STAMP_FILE" 2>/dev/null || stat -c "%y" "$STAMP_FILE" 2>/dev/null | cut -d. -f1)
      echo -e "${YELLOW}  마지막 인덱싱: ${last}${NC}"
      echo -e "${YELLOW}  변경된 파일:${NC}"
      echo "$result" | tail -n +2 | while IFS= read -r f; do
        echo -e "    ${f#${PROJECT_DIR}/}"
      done
      echo -e "\n  ${CYAN}→ ./scripts/reindex.sh 실행 추천${NC}"
      ;;
    fresh)
      local last
      last=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M" "$STAMP_FILE" 2>/dev/null || stat -c "%y" "$STAMP_FILE" 2>/dev/null | cut -d. -f1)
      echo -e "${GREEN}  인덱스 최신 (마지막: ${last})${NC}"
      ;;
  esac

  local doc_count
  doc_count=$(sqlite3 "${HOME}/.cache/qmd/index.sqlite" "SELECT count(*) FROM documents WHERE active=1;" 2>/dev/null || echo "?")
  local vec_count
  vec_count=$(sqlite3 "${HOME}/.cache/qmd/index.sqlite" "SELECT count(*) FROM content_vectors;" 2>/dev/null || echo "?")
  echo -e "\n  문서: ${doc_count}개, 벡터: ${vec_count}청크"
  echo -e "  DB: ~/.cache/qmd/index.sqlite"
  echo -e "  CR 캐시: ~/.cache/qmd/contextual-prefixes.json"
}

# --- --check --json 모드 (Phase 4 D.0.f / v6 §4.4.1) ---
# 플러그인 `waitUntilFresh` 가 파싱하는 구조화 output. stdout 에 단 한 줄 JSON 만 찍고 exit 0.
# Schema: { "stale": number, "status": "fresh" | "stale" | "never" }
#   - fresh: stale = 0
#   - stale: stale = 변경된 파일 수 (>0)
#   - never: stale = -1 (인덱싱 한번도 안 됨)
cmd_check_json() {
  local result
  result=$(check_stale)
  local status
  status=$(echo "$result" | head -1)
  case "$status" in
    never) echo '{"stale":-1,"status":"never"}' ;;
    fresh) echo '{"stale":0,"status":"fresh"}' ;;
    stale)
      local count
      count=$(echo "$result" | tail -n +2 | wc -l | tr -d ' ')
      echo "{\"stale\":${count},\"status\":\"stale\"}"
      ;;
    *)
      # 예상 외 상태 — contract 준수를 위해 never 로 fallback
      echo '{"stale":-1,"status":"never"}'
      ;;
  esac
}

# --- 전체/quick 인덱싱 ---
cmd_reindex() {
  local mode="${1:-full}"
  local start_time
  start_time=$(date +%s)

  echo -e "\n${BOLD}=== Wikey 인덱싱 (${mode}) ===${NC}"

  # Step 1: qmd update
  log_step 1 "qmd update — 파일 스캔"
  if [ ! -x "$QMD_BIN" ]; then
    log_err "qmd 없음: ${QMD_BIN}"
    exit 1
  fi

  # §5.2.5: capture full output even on failure so plugin sees real error in stderr
  # (set -e aborts the assignment but `|| { ... }` runs first and routes to stderr).
  local update_out
  update_out=$("$QMD_BIN" update 2>&1) || {
    echo "qmd update failed (exit=$?):" >&2
    echo "$update_out" >&2
    exit 1
  }
  echo "$update_out" | grep -E "Indexed:|Collection:" | while IFS= read -r line; do
    log_ok "$line"
  done

  # Step 2: qmd embed
  log_step 2 "qmd embed — 벡터 임베딩"
  local embed_out
  embed_out=$("$QMD_BIN" embed 2>&1) || {
    echo "qmd embed failed (exit=$?):" >&2
    echo "$embed_out" >&2
    exit 1
  }
  if echo "$embed_out" | grep -q "Done!"; then
    log_ok "$(echo "$embed_out" | grep "Done!")"
  elif echo "$embed_out" | grep -q "up to date"; then
    log_ok "임베딩 최신 상태"
  else
    echo "$embed_out" | tail -3
  fi

  if [ "$mode" = "quick" ]; then
    log_step 3 "Contextual Retrieval"
    log_skip "--quick 모드: CR 스킵"
    log_step 4 "한국어 형태소 전처리"
    log_skip "--quick 모드: 형태소 스킵"
    log_step 5 "검증"
    log_skip "--quick 모드: 검증 스킵"
  else
    # Step 3: Contextual Retrieval
    log_step 3 "Contextual Retrieval — Gemma 4 프리픽스"
    if command -v python3 &>/dev/null && [ -f "${SCRIPT_DIR}/contextual-retrieval.py" ]; then
      local cr_out
      cr_out=$(python3 "${SCRIPT_DIR}/contextual-retrieval.py" --batch 2>&1)
      local generated
      generated=$(echo "$cr_out" | grep "Generated:" | sed 's/.*Generated: //' | sed 's/,.*//')
      local cached
      cached=$(echo "$cr_out" | grep "Cached:" | sed 's/.*Cached: //' | sed 's/,.*//')
      log_ok "생성: ${generated:-0}, 캐시: ${cached:-0}"
    else
      log_skip "contextual-retrieval.py 없음 또는 python3 미설치"
    fi

    # Step 4: 한국어 형태소 전처리
    log_step 4 "한국어 형태소 전처리 — kiwipiepy"
    if command -v python3 &>/dev/null && [ -f "${SCRIPT_DIR}/korean-tokenize.py" ]; then
      local kt_out
      kt_out=$(python3 "${SCRIPT_DIR}/korean-tokenize.py" --batch 2>&1)
      local processed
      processed=$(echo "$kt_out" | grep "Done." | sed 's/.*Done\. //')
      log_ok "${processed:-완료}"
    else
      log_skip "korean-tokenize.py 없음 또는 python3 미설치"
    fi

    # Step 5: 검증
    log_step 5 "validate-wiki.sh — 검증"
    if [ -x "${SCRIPT_DIR}/validate-wiki.sh" ]; then
      if "${SCRIPT_DIR}/validate-wiki.sh" &>/dev/null; then
        log_ok "PASS"
      else
        log_err "FAIL — ./scripts/validate-wiki.sh 직접 실행하여 확인"
      fi
    else
      log_skip "validate-wiki.sh 없음"
    fi
  fi

  # §5.4.4 — convergence pass 훅 (default off, opt-in via env)
  # spec: plan/phase-5-todox-5.4-integration.md §3.4.3 line 906-916
  if [ "${WIKEY_CONVERGENCE_ENABLED:-false}" = "true" ]; then
    echo -e "\n${BOLD}[+]${NC} ${BOLD}§5.4.4 convergence pass 실행${NC}"
    local pass_script="${PROJECT_DIR}/wikey-core/dist/scripts/run-convergence-pass.mjs"
    if [ ! -f "$pass_script" ]; then
      log_skip "convergence pass: ${pass_script} 없음 (npm run build 필요)"
    else
      local wiki_dir="${WIKI_DIR:-${PROJECT_DIR}/wiki}"
      node "$pass_script" \
        --history "${wiki_dir}/.wikey/mention-history.json" \
        --qmd-db "${HOME}/.cache/qmd/index.sqlite" \
        --output "${wiki_dir}/.wikey/converged-decompositions.json" \
        --arbitration "${WIKEY_ARBITRATION_METHOD:-union}" \
        --token-budget "${WIKEY_CONVERGENCE_TOKEN_BUDGET:-50000}" \
        || log_err "convergence pass 실패 (계속 진행)"
    fi
  fi

  # 타임스탬프 갱신
  mkdir -p "$(dirname "$STAMP_FILE")"
  touch "$STAMP_FILE"

  local end_time
  end_time=$(date +%s)
  local elapsed=$(( end_time - start_time ))

  echo -e "\n${GREEN}${BOLD}완료${NC} (${elapsed}초, ${mode} 모드)"
}

# --- 메인 ---
case "${1:-}" in
  --check|-c)
    # Phase 4 D.0.f: 2번째 인자 --json 이면 구조화 output 으로 분기.
    if [ "${2:-}" = "--json" ]; then
      cmd_check_json
    else
      cmd_check
    fi
    ;;
  --quick|-q)  cmd_reindex quick ;;
  --help|-h)
    echo "사용법:"
    echo "  reindex.sh                 전체 인덱싱 (qmd + embed + CR + 한국어)"
    echo "  reindex.sh --quick         qmd update + embed만"
    echo "  reindex.sh --check         stale 여부 확인 (human-readable)"
    echo "  reindex.sh --check --json  stale 상태 JSON (플러그인 freshness gate)"
    ;;
  *)           cmd_reindex full ;;
esac
