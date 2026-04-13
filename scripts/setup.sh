#!/usr/bin/env bash
# setup.sh — wikey 초기 설정 자동화
#
# 사용법:
#   ./scripts/setup.sh              # 전체 설정
#   ./scripts/setup.sh --check      # 상태만 확인 (변경 없음)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
warn() { echo -e "  ${YELLOW}△${NC} $*"; }
fail() { echo -e "  ${RED}✗${NC} $*"; }
step() { echo -e "\n${BOLD}${CYAN}[$1]${NC} ${BOLD}$2${NC}"; }

CHECK_ONLY=false
[ "${1:-}" = "--check" ] && CHECK_ONLY=true

echo -e "\n${BOLD}=== Wikey 설정 ===${NC}"
echo -e "  프로젝트: ${PROJECT_DIR}\n"

ERRORS=0

# --- 1. Obsidian ---
step "1/7" "Obsidian 볼트"

if [ -d "${PROJECT_DIR}/.obsidian" ]; then
  ok "Obsidian 볼트 감지됨"
else
  warn "Obsidian 볼트 미감지 — Obsidian에서 이 폴더를 볼트로 열어주세요"
fi

if [ -d "${PROJECT_DIR}/wiki" ]; then
  local_pages=$(find "${PROJECT_DIR}/wiki" -name "*.md" | wc -l | tr -d ' ')
  ok "wiki/ 존재 (${local_pages}개 페이지)"
else
  if [ "$CHECK_ONLY" = false ]; then
    mkdir -p "${PROJECT_DIR}/wiki/entities" "${PROJECT_DIR}/wiki/concepts" "${PROJECT_DIR}/wiki/sources" "${PROJECT_DIR}/wiki/analyses"
    ok "wiki/ 디렉토리 생성"
  else
    fail "wiki/ 없음"
    ERRORS=$((ERRORS + 1))
  fi
fi

# --- 2. Ollama + Gemma 4 ---
step "2/7" "Ollama + Gemma 4"

if command -v ollama &>/dev/null; then
  ok "Ollama 설치됨 ($(ollama --version 2>/dev/null | head -1))"

  if ollama list 2>/dev/null | grep -q "gemma4"; then
    ok "gemma4 모델 설치됨"
  else
    if [ "$CHECK_ONLY" = false ]; then
      echo -e "  ${CYAN}gemma4 다운로드 중... (9.6GB, 몇 분 소요)${NC}"
      ollama pull gemma4
      ok "gemma4 모델 설치 완료"
    else
      fail "gemma4 모델 미설치 — ollama pull gemma4"
      ERRORS=$((ERRORS + 1))
    fi
  fi

  # wikey 커스텀 모델
  if ollama list 2>/dev/null | grep -q "wikey"; then
    ok "wikey 커스텀 모델 존재"
  else
    if [ "$CHECK_ONLY" = false ] && [ -f "${PROJECT_DIR}/local-llm/Modelfile" ]; then
      ollama create wikey -f "${PROJECT_DIR}/local-llm/Modelfile" 2>/dev/null
      ok "wikey 커스텀 모델 생성"
    else
      warn "wikey 커스텀 모델 없음 — ollama create wikey -f local-llm/Modelfile"
    fi
  fi
else
  fail "Ollama 미설치 — https://ollama.com 에서 설치"
  ERRORS=$((ERRORS + 1))
fi

# --- 3. Python + kiwipiepy ---
step "3/7" "Python + kiwipiepy"

if command -v python3 &>/dev/null; then
  ok "Python3 설치됨 ($(python3 --version 2>&1 | head -1))"

  if python3 -c "import kiwipiepy" 2>/dev/null; then
    ok "kiwipiepy 설치됨"
  else
    if [ "$CHECK_ONLY" = false ]; then
      echo -e "  ${CYAN}kiwipiepy 설치 중...${NC}"
      pip3 install kiwipiepy --quiet 2>/dev/null
      ok "kiwipiepy 설치 완료"
    else
      fail "kiwipiepy 미설치 — pip3 install kiwipiepy"
      ERRORS=$((ERRORS + 1))
    fi
  fi
else
  fail "Python3 미설치"
  ERRORS=$((ERRORS + 1))
fi

# --- 4. qmd ---
step "4/7" "qmd 검색 엔진"

QMD_BIN="${PROJECT_DIR}/tools/qmd/bin/qmd"
if [ -x "$QMD_BIN" ]; then
  ok "qmd 설치됨"

  # 컬렉션 확인/생성
  local_collection=$("$QMD_BIN" collection list 2>/dev/null | grep "wikey-wiki" || true)
  if [ -n "$local_collection" ]; then
    ok "wikey-wiki 컬렉션 존재"
  else
    if [ "$CHECK_ONLY" = false ]; then
      # DB에 직접 컬렉션 경로 설정
      local db_path="${HOME}/.cache/qmd/index.sqlite"
      if [ -f "$db_path" ]; then
        sqlite3 "$db_path" "INSERT OR REPLACE INTO store_collections (name, path, pattern, include, command) VALUES ('wikey-wiki', '${PROJECT_DIR}/wiki', '**/*.md', 1, '');" 2>/dev/null
        "$QMD_BIN" update 2>/dev/null
        "$QMD_BIN" embed 2>/dev/null
        ok "wikey-wiki 컬렉션 생성 + 인덱싱 완료"
      else
        warn "qmd DB 없음 — qmd를 한 번 실행하면 자동 생성됩니다"
      fi
    else
      warn "wikey-wiki 컬렉션 없음 — setup.sh로 생성"
    fi
  fi
else
  fail "qmd 미설치 — tools/qmd/ 확인"
  ERRORS=$((ERRORS + 1))
fi

# --- 5. API 키 (credentials.json) ---
step "5/7" "API 키 설정"

_CRED_FILE="${HOME}/.config/wikey/credentials.json"
if [ -f "$_CRED_FILE" ]; then
  ok "credentials.json 존재 (${_CRED_FILE})"
  if command -v jq &>/dev/null; then
    [ -n "$(jq -r '.geminiApiKey // empty' "$_CRED_FILE" 2>/dev/null)" ] && ok "GEMINI_API_KEY 설정됨" || warn "GEMINI_API_KEY 미설정 (선택)"
    [ -n "$(jq -r '.openaiApiKey // empty' "$_CRED_FILE" 2>/dev/null)" ] && ok "OPENAI_API_KEY 설정됨" || warn "OPENAI_API_KEY 미설정 (선택)"
    [ -n "$(jq -r '.anthropicApiKey // empty' "$_CRED_FILE" 2>/dev/null)" ] && ok "ANTHROPIC_API_KEY 설정됨" || warn "ANTHROPIC_API_KEY 미설정 (선택)"
  fi
elif [ -f "${PROJECT_DIR}/.env" ]; then
  warn ".env 존재 (레거시) — 플러그인 설정에서 API 키를 입력하면 credentials.json으로 마이그레이션됩니다"
  source "${PROJECT_DIR}/.env" 2>/dev/null
  [ -n "${GEMINI_API_KEY:-}" ] && ok "GEMINI_API_KEY 설정됨 (${#GEMINI_API_KEY}자)" || warn "GEMINI_API_KEY 미설정 (선택)"
else
  warn "API 키 미설정 — 플러그인 설정 > API 키에서 입력하세요"
fi

# --- 6. wikey.conf ---
step "6/7" "wikey.conf 설정"

if [ -f "${PROJECT_DIR}/wikey.conf" ]; then
  ok "wikey.conf 존재"
  source "${PROJECT_DIR}/scripts/lib/llm-api.sh" 2>/dev/null
  local_basic="${WIKEY_BASIC_MODEL:-claude-code}"
  ok "BASIC_MODEL: ${local_basic}"
else
  fail "wikey.conf 없음"
  ERRORS=$((ERRORS + 1))
fi

# --- 7. 스크립트 실행 권한 ---
step "7/7" "스크립트 권한"

local_scripts=(
  "scripts/validate-wiki.sh"
  "scripts/check-pii.sh"
  "scripts/reindex.sh"
  "scripts/check-providers.sh"
  "scripts/cost-tracker.sh"
  "scripts/llm-ingest.sh"
)

for s in "${local_scripts[@]}"; do
  if [ -x "${PROJECT_DIR}/${s}" ]; then
    ok "${s}"
  else
    if [ "$CHECK_ONLY" = false ] && [ -f "${PROJECT_DIR}/${s}" ]; then
      chmod +x "${PROJECT_DIR}/${s}"
      ok "${s} (권한 추가)"
    else
      warn "${s} — 실행 권한 없음"
    fi
  fi
done

# --- 결과 ---
echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo -e "${RED}${BOLD}설정 미완료${NC} — ${ERRORS}건의 필수 항목이 누락되었습니다."
  echo -e "  위 ✗ 항목을 해결한 후 다시 실행하세요."
  exit 1
else
  echo -e "${GREEN}${BOLD}설정 완료!${NC}"
  echo ""
  echo "  다음 단계:"
  echo "  1. Obsidian에서 이 폴더를 볼트로 열기"
  echo "  2. API 키 설정 (선택): .env 파일 편집"
  echo "  3. 프로바이더 확인: ./scripts/check-providers.sh"
  echo "  4. 첫 인제스트: raw/0_inbox/에 파일 추가 후"
  echo "     → Claude Code: \"이 소스를 인제스트해줘\""
  echo "     → 또는: ./scripts/llm-ingest.sh raw/0_inbox/my-source.md"
  echo "  5. 첫 쿼리: ./local-llm/wikey-query.sh \"질문\""
  echo ""
fi
