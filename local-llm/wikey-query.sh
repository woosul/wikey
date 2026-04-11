#!/usr/bin/env bash
# wikey-query.sh — 로컬 LLM + qmd 다층 검색으로 위키 쿼리
#
# 사용법:
#   ./local-llm/wikey-query.sh "질문"
#   ./local-llm/wikey-query.sh --backend gemma4 "한국어 질문"
#   ./local-llm/wikey-query.sh --pages "byoai,rag-vs-wiki" "차이점은?"
#   ./local-llm/wikey-query.sh --search "BYOAI"
#
# 파이프라인 (backend별):
#   basic  : qmd(확장+검색+리랭킹) → Gemma 4 합성
#   gemma4 : Gemma 4 확장 → qmd(검색만) → Gemma 4 리랭킹+합성
#
# 설정: local-llm/wikey.conf (환경변수로 오버라이드 가능)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# --- 설정 로드 (wikey.conf → 환경변수 오버라이드) ---
CONF_FILE="${SCRIPT_DIR}/wikey.conf"
if [ -f "$CONF_FILE" ]; then
  # conf에서 값 읽되, 이미 환경변수로 설정된 값은 유지
  while IFS='=' read -r key value; do
    key=$(echo "$key" | xargs)
    [[ -z "$key" || "$key" == \#* ]] && continue
    value=$(echo "$value" | sed 's/#.*//' | xargs)
    if [ -z "${!key:-}" ]; then
      export "$key=$value"
    fi
  done < "$CONF_FILE"
fi

WIKI_DIR="${WIKI_DIR:-wiki}"
MODEL="${WIKEY_MODEL:-wikey}"
FALLBACK_MODEL="gemma4"
BACKEND="${WIKEY_SEARCH_BACKEND:-basic}"
QMD_COLLECTION="wikey-wiki"
QMD_TOP_N="${WIKEY_QMD_TOP_N:-5}"
QMD_BIN="${PROJECT_DIR}/tools/qmd/bin/qmd"

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
wikey-query.sh — 로컬 LLM + qmd 다층 검색 위키 쿼리

사용법:
  ./local-llm/wikey-query.sh "질문"
  ./local-llm/wikey-query.sh --backend gemma4 "한국어 질문"
  ./local-llm/wikey-query.sh --pages "byoai,rag-vs-wiki" "차이점은?"
  ./local-llm/wikey-query.sh --search "BYOAI"

Backend:
  basic   qmd 내장(확장+검색+리랭킹) → Gemma 4 합성 (빠름, 영어 정확)
  gemma4  Gemma 4 확장 → qmd 검색만 → Gemma 4 리랭킹+합성 (느림, 한국어 정확)

옵션:
  --backend NAME  검색 backend (basic|gemma4, 기본: wikey.conf 설정)
  --search        qmd 검색 결과만 (합성 없이)
  --pages PAGES   지정 페이지만 컨텍스트 (qmd 스킵)
  --top N         qmd 상위 결과 수 (기본: 5)
  --model MODEL   Ollama 모델 (기본: wikey, 폴백: gemma4)
  --raw           시스템 프롬프트 없이 gemma4 직접 호출
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
      MODEL="$FALLBACK_MODEL"
    else
      log_error "모델 없음. 먼저 실행: ollama pull gemma4"
      exit 1
    fi
  fi
}

# --- qmd 확인 ---
check_qmd() {
  if [ ! -x "$QMD_BIN" ]; then
    log_error "qmd가 없습니다: ${QMD_BIN}"
    log_error "tools/qmd/가 프로젝트에 포함되어 있는지 확인하세요."
    exit 1
  fi
}

# --- qmd URI → 로컬 파일 경로 변환 ---
qmd_uri_to_path() {
  local uri="$1"
  echo "$uri" | sed "s|qmd://${QMD_COLLECTION}/|${WIKI_DIR}/|"
}

# --- JSON 결과에서 파일 목록 추출 ---
extract_files_from_json() {
  local json="$1"
  echo "$json" | python3 -c "
import json, sys
results = json.load(sys.stdin)
seen = set()
for r in results:
    f = r['file']
    if f not in seen:
        seen.add(f)
        print(f)
"
}

# --- 파일 목록으로 컨텍스트 구성 ---
build_context_from_files() {
  local files="$1"
  local context=""
  local page_count=0

  while IFS= read -r uri; do
    [ -z "$uri" ] && continue
    local rel_path
    rel_path=$(qmd_uri_to_path "$uri")
    local full_path="${PROJECT_DIR}/${rel_path}"

    if [ -f "$full_path" ]; then
      local basename
      basename=$(basename "$rel_path" .md)
      context+="--- ${basename}.md ---"$'\n'
      context+="$(cat "$full_path")"$'\n\n'
      page_count=$((page_count + 1))
    else
      log_warn "파일 없음: ${rel_path}"
    fi
  done <<< "$files"

  log_info "페이지 로드: ${page_count}개"
  echo "$context"
}

# --- 폴백 컨텍스트 (index + overview) ---
fallback_context() {
  local context=""
  context+="--- index.md ---"$'\n'
  context+="$(cat "${PROJECT_DIR}/${WIKI_DIR}/index.md")"$'\n\n'
  context+="--- overview.md ---"$'\n'
  context+="$(cat "${PROJECT_DIR}/${WIKI_DIR}/overview.md")"$'\n\n'
  echo "$context"
}

# =====================================================================
# Backend: basic — qmd 내장 파이프라인 (확장+검색+리랭킹) → Gemma 4 합성
# =====================================================================
backend_basic() {
  local query="$1"

  check_qmd
  log_info "backend: basic | qmd(확장→검색→리랭킹) → Gemma 4 합성"

  local json_result
  json_result=$("$QMD_BIN" query "$query" --json -n "$QMD_TOP_N" -c "$QMD_COLLECTION" 2>/dev/null)

  if [ -z "$json_result" ] || [ "$json_result" = "[]" ]; then
    log_warn "qmd 검색 결과 없음. 폴백합니다."
    fallback_context
    return
  fi

  local files
  files=$(extract_files_from_json "$json_result")
  build_context_from_files "$files"
}

# =====================================================================
# Backend: gemma4 — Gemma 4 확장 → qmd 검색만 → Gemma 4 리랭킹+합성
# =====================================================================
backend_gemma4() {
  local query="$1"

  check_qmd
  check_model
  log_info "backend: gemma4 | Gemma 4 확장 → qmd 검색 → Gemma 4 리랭킹+합성"

  # 1단계: Gemma 4로 쿼리 확장
  log_info "[1/3] Gemma 4 쿼리 확장 중..."
  local expand_prompt="다음 질문에 대해 검색할 키워드를 생성하세요.
한국어와 영어를 병기하고, 동의어와 관련 용어를 포함하세요.
각 키워드는 한 줄에 작성하세요. 키워드만 출력하세요.

질문: ${query}

형식:
키워드1 (English keyword1)
키워드2 (English keyword2)
..."

  local raw_expanded
  raw_expanded=$(echo "$expand_prompt" | ollama run "$MODEL" 2>/dev/null)

  # Gemma 4 thinking 블록 제거 (Thinking... ~ ...done thinking. 이후만 사용)
  local expanded
  if echo "$raw_expanded" | grep -q "done thinking"; then
    expanded=$(echo "$raw_expanded" | sed -n '/done thinking/,$p' | tail -n +2)
  else
    expanded="$raw_expanded"
  fi

  # 확장 결과에서 lex/vec 쿼리 구성
  local qmd_query=""
  qmd_query+="lex: ${query}"$'\n'

  while IFS= read -r line; do
    # 번호/불릿 제거, 특수문자 안전 처리
    line=$(echo "$line" | sed 's/^[0-9]*\. *//' | sed 's/^- *//' | sed "s/['\"\`\*]//g" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
    [ -z "$line" ] && continue
    # 괄호 안 영어 추출 (macOS 호환)
    local en_part
    en_part=$(echo "$line" | sed -n 's/.*(\([^)]*\)).*/\1/p' | head -1)
    local ko_part
    ko_part=$(echo "$line" | sed 's/ *(.*//' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')

    [ -n "$ko_part" ] && qmd_query+="lex: ${ko_part}"$'\n'
    # vec 쿼리에서 하이픈 제거 (qmd가 negation으로 해석)
    [ -n "$en_part" ] && qmd_query+="vec: $(echo "$en_part" | sed 's/-/ /g')"$'\n'
  done <<< "$expanded"

  qmd_query+="vec: ${query}"

  log_info "[2/3] qmd 검색 중 (--no-rerank)..."

  # 2단계: qmd 검색만 (리랭킹 없이, 인자로 전달)
  local qmd_stderr_file
  qmd_stderr_file=$(mktemp)
  local json_result
  json_result=$("$QMD_BIN" query "$qmd_query" --json -n "$QMD_TOP_N" -c "$QMD_COLLECTION" --no-rerank 2>"$qmd_stderr_file")
  local qmd_exit=$?

  if [ $qmd_exit -ne 0 ]; then
    log_warn "qmd 종료 코드: ${qmd_exit}"
    log_warn "qmd stderr: $(head -3 "$qmd_stderr_file")"
    json_result=""
  fi
  rm -f "$qmd_stderr_file"

  if [ -z "$json_result" ] || [ "$json_result" = "[]" ]; then
    log_warn "qmd 검색 결과 없음. 폴백합니다."
    fallback_context
    return
  fi

  # 3단계: 파일 로드 (Gemma 4 리랭킹은 합성 프롬프트에서 암묵적으로 수행)
  log_info "[3/3] 페이지 로드 중..."
  local files
  files=$(extract_files_from_json "$json_result")
  build_context_from_files "$files"
}

# --- 수동 페이지 지정 컨텍스트 ---
build_context_from_pages() {
  local pages="$1"
  local context=""

  IFS=',' read -ra PAGE_LIST <<< "$pages"
  for page in "${PAGE_LIST[@]}"; do
    page=$(echo "$page" | xargs)
    local found=""
    for dir in entities concepts sources analyses; do
      local filepath="${PROJECT_DIR}/${WIKI_DIR}/${dir}/${page}.md"
      if [ -f "$filepath" ]; then
        found="$filepath"
        break
      fi
    done
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

  echo "$context"
}

# --- 메인 ---
MODE="query"
PAGES=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --search)   MODE="search"; shift ;;
    --backend)  BACKEND="$2"; shift 2 ;;
    --pages)    PAGES="$2"; shift 2 ;;
    --top)      QMD_TOP_N="$2"; shift 2 ;;
    --model)    MODEL="$2"; shift 2 ;;
    --raw)      MODEL="$FALLBACK_MODEL"; shift ;;
    --help|-h)  usage ;;
    --)         shift; break ;;
    -*)         log_error "알 수 없는 옵션: $1"; usage ;;
    *)          break ;;
  esac
done

QUERY="${*:-}"

if [ -z "$QUERY" ]; then
  log_error "질문을 입력하세요."
  echo ""
  usage
fi

case "$MODE" in
  search)
    check_qmd
    log_info "모드: 검색만 (qmd 하이브리드)"
    "$QMD_BIN" query "$QUERY" -n "$QMD_TOP_N" -c "$QMD_COLLECTION"
    ;;

  query)
    check_model

    if [ -n "$PAGES" ]; then
      CONTEXT=$(build_context_from_pages "$PAGES")
      log_info "모델: ${MODEL} | 페이지: ${PAGES} (수동 지정)"
    else
      case "$BACKEND" in
        basic)
          CONTEXT=$(backend_basic "$QUERY")
          ;;
        gemma4)
          CONTEXT=$(backend_gemma4 "$QUERY")
          ;;
        *)
          log_error "알 수 없는 backend: ${BACKEND} (basic|gemma4)"
          exit 1
          ;;
      esac
    fi

    TOKEN_EST=$(echo "$CONTEXT" | wc -w | tr -d ' ')
    log_info "모델: ${MODEL} | 컨텍스트: ~${TOKEN_EST} words"

    PROMPT="아래는 wikey 위키의 관련 페이지 내용입니다.

${CONTEXT}
---
질문: ${QUERY}

위키 내용을 기반으로 답변하세요. 출처는 [[페이지명]] 형식으로 인용하세요."

    echo "$PROMPT" | ollama run "$MODEL"
    ;;
esac
