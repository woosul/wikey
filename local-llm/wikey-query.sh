#!/usr/bin/env bash
# wikey-query.sh — 로컬 LLM으로 위키 쿼리
#
# 사용법:
#   ./local-llm/wikey-query.sh "질문"
#   ./local-llm/wikey-query.sh --pages "byoai,rag-vs-wiki" "두 개념의 차이점은?"
#   ./local-llm/wikey-query.sh --expand "LLM Wiki의 실패 모드"
#   ./local-llm/wikey-query.sh --mode rerank < candidates.txt
#
# 모드:
#   (기본)    위키 컨텍스트 + 질문 → 답변
#   --expand  쿼리 확장 (동의어/키워드 생성)
#   --rerank  stdin에서 후보를 읽어 관련성 리랭킹
#   --pages   지정 페이지만 컨텍스트로 포함

set -euo pipefail

WIKI_DIR="${WIKI_DIR:-wiki}"
MODEL="${WIKEY_MODEL:-wikey}"
FALLBACK_MODEL="gemma4"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- 색상 ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# --- 유틸리티 ---
log_info()  { echo -e "${CYAN}[wikey]${NC} $*" >&2; }
log_warn()  { echo -e "${YELLOW}[wikey]${NC} $*" >&2; }
log_error() { echo -e "${RED}[wikey]${NC} $*" >&2; }

usage() {
  cat <<'USAGE'
wikey-query.sh — 로컬 LLM 위키 쿼리

사용법:
  ./local-llm/wikey-query.sh "질문"
  ./local-llm/wikey-query.sh --pages "byoai,rag-vs-wiki" "차이점은?"
  ./local-llm/wikey-query.sh --expand "LLM Wiki의 실패 모드"
  ./local-llm/wikey-query.sh --mode rerank < candidates.txt

옵션:
  --pages PAGES   컨텍스트에 포함할 페이지 (쉼표 구분)
  --expand        쿼리 확장 모드 (동의어/키워드 생성)
  --rerank        리랭킹 모드 (stdin에서 후보 읽기)
  --model MODEL   사용할 모델 (기본: wikey, 폴백: gemma3)
  --raw           시스템 프롬프트 없이 gemma3 직접 호출
  --help          도움말
USAGE
  exit 0
}

# --- 모델 확인 ---
check_model() {
  if ! command -v ollama &>/dev/null; then
    log_error "ollama가 설치되지 않았습니다. https://ollama.com 에서 설치하세요."
    exit 1
  fi

  if ! ollama list 2>/dev/null | grep -q "^${MODEL}"; then
    if ollama list 2>/dev/null | grep -q "^${FALLBACK_MODEL}"; then
      log_warn "'${MODEL}' 모델 없음. '${FALLBACK_MODEL}'로 폴백합니다."
      log_warn "시스템 프롬프트 내장 모델 생성: ollama create wikey -f local-llm/Modelfile"
      MODEL="$FALLBACK_MODEL"
    else
      log_error "모델 없음. 먼저 실행: ollama pull gemma3"
      exit 1
    fi
  fi
}

# --- 위키 컨텍스트 조합 ---
build_context() {
  local pages="$1"
  local context=""

  if [ -n "$pages" ]; then
    # 지정된 페이지만 포함
    IFS=',' read -ra PAGE_LIST <<< "$pages"
    for page in "${PAGE_LIST[@]}"; do
      page=$(echo "$page" | xargs)  # trim
      local found=""
      for dir in entities concepts sources analyses; do
        local filepath="${PROJECT_DIR}/${WIKI_DIR}/${dir}/${page}.md"
        if [ -f "$filepath" ]; then
          found="$filepath"
          break
        fi
      done
      # 루트 레벨 파일도 확인
      if [ -z "$found" ] && [ -f "${PROJECT_DIR}/${WIKI_DIR}/${page}.md" ]; then
        found="${PROJECT_DIR}/${WIKI_DIR}/${page}.md"
      fi
      if [ -n "$found" ]; then
        context+="--- ${page}.md ---"$'\n'
        context+="$(cat "$found")"$'\n\n'
      else
        log_warn "페이지 '${page}' 없음. 건너뜁니다."
      fi
    done
  else
    # 기본: index.md + overview.md
    context+="--- index.md ---"$'\n'
    context+="$(cat "${PROJECT_DIR}/${WIKI_DIR}/index.md")"$'\n\n'
    context+="--- overview.md ---"$'\n'
    context+="$(cat "${PROJECT_DIR}/${WIKI_DIR}/overview.md")"$'\n\n'
  fi

  echo "$context"
}

# --- 메인 ---
MODE="query"
PAGES=""
RAW=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --expand)  MODE="expand"; shift ;;
    --rerank)  MODE="rerank"; shift ;;
    --pages)   PAGES="$2"; shift 2 ;;
    --model)   MODEL="$2"; shift 2 ;;
    --raw)     RAW=true; MODEL="$FALLBACK_MODEL"; shift ;;
    --help|-h) usage ;;
    --)        shift; break ;;
    -*)        log_error "알 수 없는 옵션: $1"; usage ;;
    *)         break ;;
  esac
done

QUERY="${*:-}"

if [ -z "$QUERY" ] && [ "$MODE" != "rerank" ]; then
  log_error "질문을 입력하세요."
  echo ""
  usage
fi

check_model

case "$MODE" in
  query)
    CONTEXT=$(build_context "$PAGES")
    TOKEN_EST=$(echo "$CONTEXT" | wc -w | tr -d ' ')
    log_info "모델: ${MODEL} | 컨텍스트: ~${TOKEN_EST} words | 페이지: ${PAGES:-index+overview}"

    PROMPT="아래는 wikey 위키의 페이지 내용입니다.

${CONTEXT}
---
질문: ${QUERY}

위키 내용을 기반으로 답변하세요. 출처는 [[페이지명]] 형식으로 인용하세요."

    echo "$PROMPT" | ollama run "$MODEL"
    ;;

  expand)
    log_info "모델: ${MODEL} | 모드: 쿼리 확장"

    PROMPT="다음 질문에 대해 위키에서 검색할 동의어와 관련 키워드를 5개 생성하세요.
한국어와 영어를 병기하세요. 각 키워드는 한 줄에 작성하세요.

질문: ${QUERY}

형식:
1. 한국어 키워드 (English keyword)
2. ..."

    echo "$PROMPT" | ollama run "$MODEL"
    ;;

  rerank)
    log_info "모델: ${MODEL} | 모드: 리랭킹"
    CANDIDATES=$(cat)

    PROMPT="다음은 검색 결과 후보 목록입니다. 질문과의 관련성을 기준으로 상위 5개를 선택하고 순위를 매기세요.

질문: ${QUERY}

후보:
${CANDIDATES}

형식:
1. [파일명] — 관련 이유 (관련도: 높음/중간/낮음)
2. ..."

    echo "$PROMPT" | ollama run "$MODEL"
    ;;
esac
