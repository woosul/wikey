#!/usr/bin/env bash
# check-providers.sh — LLM 프로바이더 상태 확인
#
# 사용법:
#   ./scripts/check-providers.sh                    # 전체 상태
#   ./scripts/check-providers.sh --provider ollama  # 특정 프로바이더만

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
CONF_FILE="${PROJECT_DIR}/local-llm/wikey.conf"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# .env 로드
if [ -f "${PROJECT_DIR}/.env" ]; then
  set -a
  source "${PROJECT_DIR}/.env"
  set +a
fi

# wikey.conf 로드
if [ -f "$CONF_FILE" ]; then
  while IFS='=' read -r key value; do
    key=$(echo "$key" | xargs)
    [[ -z "$key" || "$key" == \#* ]] && continue
    value=$(echo "$value" | sed 's/#.*//' | xargs)
    if [ -z "${!key:-}" ]; then
      export "$key=$value"
    fi
  done < "$CONF_FILE"
fi

ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
warn() { echo -e "  ${YELLOW}△${NC} $*"; }
fail() { echo -e "  ${RED}✗${NC} $*"; }

# --- Ollama 확인 ---
check_ollama() {
  echo -e "\n${BOLD}Ollama (로컬 LLM)${NC}"

  if ! command -v ollama &>/dev/null; then
    fail "ollama 미설치 — brew install ollama"
    return
  fi

  local version
  version=$(ollama --version 2>/dev/null | head -1 || echo "?")
  ok "ollama 설치됨 (${version})"

  if curl -s http://localhost:11434/api/tags &>/dev/null; then
    ok "서버 가동 중 (localhost:11434)"
  else
    warn "서버 미가동 — ollama serve 실행 필요"
  fi

  local models
  models=$(ollama list 2>/dev/null | tail -n +2 | awk '{print $1}')
  if [ -n "$models" ]; then
    while IFS= read -r m; do
      local size
      size=$(ollama list 2>/dev/null | grep "^${m}" | awk '{print $3$4}')
      ok "모델: ${m} (${size})"
    done <<< "$models"
  else
    warn "설치된 모델 없음 — ollama pull gemma4"
  fi
}

# --- Gemini 확인 ---
check_gemini() {
  echo -e "\n${BOLD}Google Gemini (API)${NC}"

  local key="${GEMINI_API_KEY:-}"
  if [ -z "$key" ]; then
    fail "GEMINI_API_KEY 미설정 — .env 파일에 추가 필요"
    return
  fi

  ok "API 키 설정됨 (${#key}자)"

  local model="${GEMINI_MODEL:-gemini-2.5-flash}"
  local response
  response=$(curl -s -o /dev/null -w "%{http_code}" \
    "https://generativelanguage.googleapis.com/v1beta/models?key=${key}" 2>/dev/null)

  if [ "$response" = "200" ]; then
    ok "API 키 유효 — 모델: ${model}"
    echo -e "  ${DIM}접근: API 키 기반, 무료 티어 (1500 req/day)${NC}"
  elif [ "$response" = "400" ] || [ "$response" = "403" ]; then
    fail "API 키 무효 또는 만료 (HTTP ${response})"
  else
    warn "API 연결 실패 (HTTP ${response}) — 네트워크 확인"
  fi
}

# --- OpenAI/Codex 확인 ---
check_codex() {
  echo -e "\n${BOLD}Codex CLI / OpenAI (API)${NC}"

  if ! command -v codex &>/dev/null; then
    fail "codex CLI 미설치 — npm install -g @openai/codex"
    return
  fi

  local version
  version=$(codex --version 2>/dev/null | head -1 || echo "?")
  ok "codex CLI 설치됨 (${version})"

  local key="${OPENAI_API_KEY:-}"
  if [ -n "$key" ]; then
    ok "OPENAI_API_KEY 설정됨 (${#key}자)"
    echo -e "  ${DIM}접근: API 키 기반, 토큰 과금 (~\$2/1M input)${NC}"
  else
    warn "OPENAI_API_KEY 미설정 — codex 로그인 또는 .env에 추가"
  fi
}

# --- Claude Code 확인 ---
check_claude() {
  echo -e "\n${BOLD}Claude Code (구독)${NC}"

  if ! command -v claude &>/dev/null; then
    fail "claude CLI 미설치"
    return
  fi

  local version
  version=$(claude --version 2>/dev/null | head -1 || echo "?")
  ok "claude CLI 설치됨 (${version})"
  echo -e "  ${DIM}접근: 구독 기반 (Pro \$20/Max \$100/월) — API 키 불필요${NC}"

  local anthropic_key="${ANTHROPIC_API_KEY:-}"
  if [ -n "$anthropic_key" ]; then
    ok "ANTHROPIC_API_KEY 설정됨 (${#anthropic_key}자) — 직접 API 호출 가능"
  else
    echo -e "  ${DIM}ANTHROPIC_API_KEY 미설정 (Claude Code 구독으로 충분)${NC}"
  fi
}

# --- qmd 내장 모델 확인 ---
check_qmd() {
  echo -e "\n${BOLD}qmd 내장 모델 (GGUF)${NC}"

  local qmd_bin="${PROJECT_DIR}/tools/qmd/bin/qmd"
  if [ ! -x "$qmd_bin" ]; then
    fail "qmd 미설치 — tools/qmd/ 확인"
    return
  fi

  ok "qmd 설치됨"

  local model_dir="${HOME}/.cache/qmd/models"
  if [ -d "$model_dir" ]; then
    local count
    count=$(find "$model_dir" -name "*.gguf" 2>/dev/null | wc -l | tr -d ' ')
    ok "GGUF 모델 캐시: ${count}개 (${model_dir})"
  else
    warn "모델 캐시 없음 — qmd query 첫 실행 시 자동 다운로드"
  fi

  local db="${HOME}/.cache/qmd/index.sqlite"
  if [ -f "$db" ]; then
    local doc_count
    doc_count=$(sqlite3 "$db" "SELECT count(*) FROM documents WHERE active=1;" 2>/dev/null || echo "?")
    ok "인덱스: ${doc_count}문서 (${db})"
  else
    warn "인덱스 없음 — qmd collection add 필요"
  fi
}

# --- 현재 설정 출력 ---
show_config() {
  echo -e "\n${BOLD}현재 설정 (wikey.conf)${NC}"

  local wikey_model="${WIKEY_MODEL:-wikey}"
  local ctx_model="${CONTEXTUAL_MODEL:-gemma4}"
  local sum_provider="${SUMMARIZE_PROVIDER:-gemini}"
  local gemini_model="${GEMINI_MODEL:-gemini-2.5-flash}"
  local ingest="${INGEST_PROVIDER:-claude-code}"
  local ingest_model="${INGEST_MODEL:-opus}"
  local lint="${LINT_PROVIDER:-codex}"

  printf "  %-20s %-25s %s\n" "프로세스" "프로바이더" "비용"
  printf "  %-20s %-25s %s\n" "──────────" "──────────────" "────"
  printf "  %-20s %-25s %s\n" "쿼리 합성" "${wikey_model} (Ollama)" "\$0"
  printf "  %-20s %-25s %s\n" "CR 프리픽스" "${ctx_model} (Ollama)" "\$0"

  if [ "$sum_provider" = "gemini" ]; then
    printf "  %-20s %-25s %s\n" "대용량 요약" "${gemini_model} (API)" "~\$0.01/건"
  else
    printf "  %-20s %-25s %s\n" "대용량 요약" "Ollama (로컬)" "\$0"
  fi

  printf "  %-20s %-25s %s\n" "인제스트" "${ingest} (${ingest_model})" "~\$1.00/건"
  printf "  %-20s %-25s %s\n" "린트" "${lint}" "~\$0.17/회"
  printf "  %-20s %-25s %s\n" "검색 (qmd)" "GGUF 내장" "\$0"
}

# --- 메인 ---
FILTER="${2:-}"

echo -e "\n${BOLD}=== Wikey LLM 프로바이더 상태 ===${NC}"

case "${1:-all}" in
  --provider)
    case "$FILTER" in
      ollama)  check_ollama ;;
      gemini)  check_gemini ;;
      codex)   check_codex ;;
      claude)  check_claude ;;
      qmd)     check_qmd ;;
      *) echo "프로바이더: ollama | gemini | codex | claude | qmd"; exit 1 ;;
    esac
    ;;
  all|*)
    check_ollama
    check_gemini
    check_codex
    check_claude
    check_qmd
    show_config
    ;;
esac

echo ""
