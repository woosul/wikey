#!/usr/bin/env bash
# summarize-large-source.sh — 대용량 소스 LLM 요약 (Phase A: 섹션 인덱스 생성)
#
# 사용법:
#   ./scripts/summarize-large-source.sh <pdf-path>              # Gemini로 요약
#   ./scripts/summarize-large-source.sh <pdf-path> --local      # Ollama Gemma 4로 요약
#   ./scripts/summarize-large-source.sh <pdf-path> --dry-run    # PDF 정보만 출력
#
# wikey.schema.md의 "2단계 인제스트" Phase A를 자동화한다.
# 100p+ PDF를 LLM에 전달하여 섹션 인덱스 마크다운을 생성한다.
#
# 환경변수:
#   GEMINI_API_KEY — Google Gemini API 키 (기본)
#   GEMINI_MODEL   — 모델명 (기본: gemini-2.5-flash)
#
# 출력: stdout에 마크다운 섹션 인덱스 (source 페이지에 붙여넣기용)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# credentials.json 로드 (플러그인과 공유)
_CRED_FILE="${HOME}/.config/wikey/credentials.json"
if [ -f "$_CRED_FILE" ] && command -v jq &>/dev/null; then
  for key in geminiApiKey anthropicApiKey openaiApiKey; do
    val=$(jq -r ".$key // empty" "$_CRED_FILE" 2>/dev/null)
    [ -n "$val" ] || continue
    case "$key" in
      geminiApiKey)    [ -z "${GEMINI_API_KEY:-}" ]    && export GEMINI_API_KEY="$val" ;;
      anthropicApiKey) [ -z "${ANTHROPIC_API_KEY:-}" ] && export ANTHROPIC_API_KEY="$val" ;;
      openaiApiKey)    [ -z "${OPENAI_API_KEY:-}" ]    && export OPENAI_API_KEY="$val" ;;
    esac
  done
fi

# .env 폴백 (하위 호환)
if [ -f "${PROJECT_DIR}/.env" ]; then
  set -a
  source "${PROJECT_DIR}/.env"
  set +a
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[summarize]${NC} $*" >&2; }
log_ok()    { echo -e "${GREEN}[summarize]${NC} $*" >&2; }
log_warn()  { echo -e "${YELLOW}[summarize]${NC} $*" >&2; }
log_error() { echo -e "${RED}[summarize]${NC} $*" >&2; }

PROMPT_SECTION_INDEX='You are analyzing a technical document (PDF) for a personal knowledge wiki.

Your task: Create a **section index** in Markdown table format.

For each logical section of the document, extract:
1. Page range (e.g., p1-3)
2. Section title
3. Key keywords (3-5 terms, include both original language and English if non-English)
4. Priority: "core" (overview, specs, setup, troubleshooting) or "reference" (menus, repetitive lists)

Output format (Markdown):
## 섹션 인덱스 (Phase A)
| 페이지 | 섹션 | 핵심 키워드 | 우선순위 |
|--------|------|-----------|----------|
| p1-3   | 개요 | specs, voltage range | core |
| ...    | ...  | ...       | ...      |

Rules:
- Cover ALL pages, no gaps
- Keep keywords bilingual if the document is non-English
- Mark "core" sections that should be read in detail (Phase B)
- Mark "reference" sections that only need the index entry
- End with a one-paragraph summary of the document (2-3 sentences)'

pdf_info() {
  local pdf="$1"
  local size
  size=$(stat -f%z "$pdf" 2>/dev/null || stat -c%s "$pdf" 2>/dev/null || echo 0)
  local human_size
  if [ "$size" -gt 1048576 ]; then
    human_size="$((size / 1048576))MB"
  else
    human_size="$((size / 1024))KB"
  fi

  local pages="unknown"
  if command -v pdfinfo &>/dev/null; then
    pages=$(pdfinfo "$pdf" 2>/dev/null | grep "Pages:" | awk '{print $2}' || echo "unknown")
  elif command -v mdls &>/dev/null; then
    pages=$(mdls -name kMDItemNumberOfPages "$pdf" 2>/dev/null | awk '{print $3}' || echo "unknown")
  fi

  echo "${human_size}|${pages}"
}

cmd_gemini() {
  local pdf="$1"

  if [ -z "${GEMINI_API_KEY:-}" ]; then
    log_error "GEMINI_API_KEY가 설정되지 않았습니다."
    echo ""
    echo "설정 방법:"
    echo "  export GEMINI_API_KEY='your-api-key'"
    echo "  # Google AI Studio에서 발급: https://aistudio.google.com/apikey"
    echo ""
    echo "또는 로컬 모드 사용:"
    echo "  ./scripts/summarize-large-source.sh <pdf> --local"
    exit 1
  fi

  local model="${GEMINI_MODEL:-gemini-2.5-flash}"
  local info
  info=$(pdf_info "$pdf")
  local size="${info%%|*}"
  local pages="${info##*|}"

  log_info "Gemini 요약 시작: $(basename "$pdf") (${size}, ${pages}p)"
  log_info "모델: ${model}"

  # Build JSON payload via Python (avoids shell argument length limits)
  local payload_file
  payload_file=$(mktemp /tmp/wikey-gemini-XXXXXX.json)
  trap "rm -f '$payload_file'" EXIT

  python3 - "$pdf" "$PROMPT_SECTION_INDEX" "$payload_file" <<'PYEOF'
import json, sys, base64

pdf_path = sys.argv[1]
prompt = sys.argv[2]
out_path = sys.argv[3]

with open(pdf_path, "rb") as f:
    b64 = base64.b64encode(f.read()).decode("ascii")

payload = {
    "contents": [{
        "parts": [
            {"inline_data": {"mime_type": "application/pdf", "data": b64}},
            {"text": prompt}
        ]
    }],
    "generationConfig": {"temperature": 0.1, "maxOutputTokens": 4096}
}

with open(out_path, "w") as f:
    json.dump(payload, f)
PYEOF

  local response
  response=$(curl -s "https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}" \
    -H 'Content-Type: application/json' \
    -d @"$payload_file" 2>&1)

  rm -f "$payload_file"

  local text
  text=$(echo "$response" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data['candidates'][0]['content']['parts'][0]['text'])
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    print(json.dumps(data, indent=2)[:500], file=sys.stderr)
    sys.exit(1)
" 2>&2)

  if [ $? -eq 0 ]; then
    echo "$text"
    log_ok "완료. 출력을 source 페이지의 섹션 인덱스에 붙여넣으세요."
  else
    log_error "Gemini API 호출 실패"
    exit 1
  fi
}

cmd_local() {
  local pdf="$1"
  local info
  info=$(pdf_info "$pdf")
  local size="${info%%|*}"
  local pages="${info##*|}"

  log_info "로컬 요약 (Ollama): $(basename "$pdf") (${size}, ${pages}p)"
  log_warn "로컬 모드는 20p 이하 PDF에 적합합니다. 대용량은 Gemini를 권장합니다."

  if ! command -v ollama &>/dev/null; then
    log_error "ollama가 설치되어 있지 않습니다."
    exit 1
  fi

  # Extract text from PDF using python
  local text
  text=$(python3 -c "
import subprocess, sys
try:
    # Try pdftotext first
    result = subprocess.run(['pdftotext', '$pdf', '-'], capture_output=True, text=True, timeout=30)
    if result.returncode == 0 and result.stdout.strip():
        print(result.stdout[:8000])  # Limit to ~8K chars for local model
    else:
        raise Exception('pdftotext failed')
except Exception:
    # Fallback: just report
    print('[PDF text extraction failed. Install poppler: brew install poppler]')
" 2>/dev/null)

  local response
  response=$(ollama run wikey --nowordwrap <<EOF
${PROMPT_SECTION_INDEX}

---
Document text (first 8000 chars):
${text}
EOF
)
  echo "$response"
  log_ok "완료."
}

cmd_dry_run() {
  local pdf="$1"
  local info
  info=$(pdf_info "$pdf")
  local size="${info%%|*}"
  local pages="${info##*|}"

  log_info "PDF 정보: $(basename "$pdf")"
  echo "  크기: ${size}"
  echo "  페이지: ${pages}"
  echo ""

  if [ "${pages}" != "unknown" ] && [ "${pages}" -gt 20 ] 2>/dev/null; then
    echo "  권장: Gemini (대용량)"
    echo "  명령어: GEMINI_API_KEY=... ./scripts/summarize-large-source.sh '$pdf'"
  else
    echo "  권장: 로컬 (Ollama) 또는 Claude Code Read 도구"
    echo "  명령어: ./scripts/summarize-large-source.sh '$pdf' --local"
  fi
}

# --- 메인 ---

if [ $# -lt 1 ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo "summarize-large-source.sh — 대용량 PDF 섹션 인덱스 생성"
  echo ""
  echo "사용법:"
  echo "  ./scripts/summarize-large-source.sh <pdf>              Gemini로 요약"
  echo "  ./scripts/summarize-large-source.sh <pdf> --local      Ollama로 요약"
  echo "  ./scripts/summarize-large-source.sh <pdf> --dry-run    PDF 정보만"
  echo ""
  echo "환경변수:"
  echo "  GEMINI_API_KEY — Google Gemini API 키"
  echo "  GEMINI_MODEL   — 모델명 (기본: gemini-2.5-flash)"
  exit 0
fi

PDF_PATH="$1"
MODE="${2:---gemini}"

if [ ! -f "$PDF_PATH" ]; then
  log_error "파일을 찾을 수 없습니다: ${PDF_PATH}"
  exit 1
fi

case "$MODE" in
  --local|-l)
    cmd_local "$PDF_PATH"
    ;;
  --dry-run|-n)
    cmd_dry_run "$PDF_PATH"
    ;;
  *)
    cmd_gemini "$PDF_PATH"
    ;;
esac
