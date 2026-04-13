#!/usr/bin/env bash
# llm-api.sh — 공유 LLM API 래퍼
#
# 모든 wikey 스크립트가 source하여 사용하는 LLM 호출 함수.
# 프로바이더 분기: gemini | anthropic | openai | ollama
#
# 사용법:
#   source scripts/lib/llm-api.sh
#   result=$(llm_call "프롬프트")                           # BASIC_MODEL 사용
#   result=$(llm_call "프롬프트" --provider gemini)          # 명시적 지정
#   result=$(llm_call_with_file "프롬프트" file.pdf)         # PDF 첨부
#   provider=$(resolve_provider ingest)                     # 프로세스별 프로바이더 결정

# 이 파일이 이미 로드되었으면 스킵
[ -n "${_LLM_API_LOADED:-}" ] && return 0
_LLM_API_LOADED=1

_LLM_API_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
_LLM_PROJECT_DIR="$(cd "$_LLM_API_DIR/../.." && pwd)"
_LLM_CONF_FILE="${_LLM_PROJECT_DIR}/wikey.conf"

# --- credentials.json 로드 ---
_load_credentials() {
  local cred_file="${HOME}/.config/wikey/credentials.json"
  [ ! -f "$cred_file" ] && return

  if command -v jq &>/dev/null; then
    local val
    for key in geminiApiKey anthropicApiKey openaiApiKey; do
      val=$(jq -r ".$key // empty" "$cred_file" 2>/dev/null)
      [ -n "$val" ] || continue
      case "$key" in
        geminiApiKey)    [ -z "${GEMINI_API_KEY:-}" ]    && export GEMINI_API_KEY="$val" ;;
        anthropicApiKey) [ -z "${ANTHROPIC_API_KEY:-}" ] && export ANTHROPIC_API_KEY="$val" ;;
        openaiApiKey)    [ -z "${OPENAI_API_KEY:-}" ]    && export OPENAI_API_KEY="$val" ;;
      esac
    done
    return
  fi

  # jq 없으면 grep fallback
  local val
  for pair in geminiApiKey:GEMINI_API_KEY anthropicApiKey:ANTHROPIC_API_KEY openaiApiKey:OPENAI_API_KEY; do
    local json_key="${pair%%:*}" env_key="${pair##*:}"
    [ -n "${!env_key:-}" ] && continue
    val=$(grep -o "\"$json_key\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$cred_file" 2>/dev/null | head -1 | sed 's/.*:.*"\(.*\)"/\1/')
    [ -n "$val" ] && export "$env_key=$val"
  done
}

# --- 설정 로드 ---
_llm_load_config() {
  # 1. credentials.json (API 키 — 플러그인과 공유)
  _load_credentials

  # 2. .env 폴백 (하위 호환, 향후 제거)
  if [ -f "${_LLM_PROJECT_DIR}/.env" ]; then
    set -a
    source "${_LLM_PROJECT_DIR}/.env"
    set +a
  fi

  # 3. wikey.conf 로드 (환경변수 미설정 시)
  if [ -f "$_LLM_CONF_FILE" ]; then
    while IFS='=' read -r key value; do
      key=$(echo "$key" | xargs)
      [[ -z "$key" || "$key" == \#* ]] && continue
      value=$(echo "$value" | sed 's/#.*//' | xargs)
      if [ -z "${!key:-}" ] && [ -n "$value" ]; then
        export "$key=$value"
      fi
    done < "$_LLM_CONF_FILE"
  fi
}

_llm_load_config

# --- 프로바이더 결정 ---
resolve_provider() {
  local process="${1:-default}"
  case "$process" in
    ingest)    echo "${INGEST_PROVIDER:-${WIKEY_BASIC_MODEL:-claude-code}}" ;;
    lint)      echo "${LINT_PROVIDER:-${WIKEY_BASIC_MODEL:-claude-code}}" ;;
    summarize) echo "${SUMMARIZE_PROVIDER:-${WIKEY_BASIC_MODEL:-gemini}}" ;;
    cr)        echo "${CONTEXTUAL_MODEL:-ollama}" ;;
    *)         echo "${WIKEY_BASIC_MODEL:-claude-code}" ;;
  esac
}

# --- Gemini API 호출 ---
_llm_call_gemini() {
  local prompt="$1"
  local model="${GEMINI_MODEL:-gemini-2.5-flash}"
  local api_key="${GEMINI_API_KEY:-}"

  if [ -z "$api_key" ]; then
    echo "ERROR: GEMINI_API_KEY 미설정" >&2
    return 1
  fi

  local tmpfile
  tmpfile=$(mktemp /tmp/wikey-llm-XXXXXX.json)

  python3 -c "
import json, sys
payload = {
    'contents': [{'parts': [{'text': sys.stdin.read()}]}],
    'generationConfig': {'temperature': 0.1, 'maxOutputTokens': 8192}
}
with open('${tmpfile}', 'w') as f:
    json.dump(payload, f)
" <<< "$prompt"

  local response
  response=$(curl -s -X POST \
    "https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${api_key}" \
    -H "Content-Type: application/json" \
    -d "@${tmpfile}" 2>/dev/null)

  rm -f "$tmpfile"

  echo "$response" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    text = data['candidates'][0]['content']['parts'][0]['text']
    print(text)
except Exception as e:
    print(f'ERROR: Gemini 응답 파싱 실패: {e}', file=sys.stderr)
    sys.exit(1)
"
}

# --- Gemini API (파일 첨부) ---
_llm_call_gemini_with_file() {
  local prompt="$1"
  local filepath="$2"
  local model="${GEMINI_MODEL:-gemini-2.5-flash}"
  local api_key="${GEMINI_API_KEY:-}"

  if [ -z "$api_key" ]; then
    echo "ERROR: GEMINI_API_KEY 미설정" >&2
    return 1
  fi

  local tmpfile
  tmpfile=$(mktemp /tmp/wikey-llm-XXXXXX.json)
  local mime_type="application/pdf"

  # 파일 확장자에 따라 MIME 타입 결정
  case "${filepath##*.}" in
    pdf) mime_type="application/pdf" ;;
    md|txt) mime_type="text/plain" ;;
    *) mime_type="application/octet-stream" ;;
  esac

  if [ "$mime_type" = "text/plain" ] || [[ "${filepath##*.}" =~ ^(md|txt)$ ]]; then
    # 텍스트 파일은 프롬프트에 직접 포함
    local content
    content=$(cat "$filepath")
    _llm_call_gemini "${prompt}

--- 소스 내용 ---
${content}"
    return $?
  fi

  # PDF는 base64 인라인
  python3 -c "
import json, base64, sys
with open('${filepath}', 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('utf-8')
payload = {
    'contents': [{'parts': [
        {'inline_data': {'mime_type': '${mime_type}', 'data': b64}},
        {'text': sys.stdin.read()}
    ]}],
    'generationConfig': {'temperature': 0.1, 'maxOutputTokens': 8192}
}
with open('${tmpfile}', 'w') as f:
    json.dump(payload, f)
" <<< "$prompt"

  local response
  response=$(curl -s -X POST \
    "https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${api_key}" \
    -H "Content-Type: application/json" \
    -d "@${tmpfile}" 2>/dev/null)

  rm -f "$tmpfile"

  echo "$response" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    text = data['candidates'][0]['content']['parts'][0]['text']
    print(text)
except Exception as e:
    print(f'ERROR: Gemini 응답 파싱 실패: {e}', file=sys.stderr)
    sys.exit(1)
"
}

# --- Anthropic API 호출 ---
_llm_call_anthropic() {
  local prompt="$1"
  local model="${ANTHROPIC_MODEL:-claude-sonnet-4-20250514}"
  local api_key="${ANTHROPIC_API_KEY:-}"

  if [ -z "$api_key" ]; then
    echo "ERROR: ANTHROPIC_API_KEY 미설정" >&2
    return 1
  fi

  local tmpfile
  tmpfile=$(mktemp /tmp/wikey-llm-XXXXXX.json)

  python3 -c "
import json, sys
payload = {
    'model': '${model}',
    'max_tokens': 8192,
    'messages': [{'role': 'user', 'content': sys.stdin.read()}]
}
with open('${tmpfile}', 'w') as f:
    json.dump(payload, f)
" <<< "$prompt"

  local response
  response=$(curl -s -X POST \
    "https://api.anthropic.com/v1/messages" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${api_key}" \
    -H "anthropic-version: 2023-06-01" \
    -d "@${tmpfile}" 2>/dev/null)

  rm -f "$tmpfile"

  echo "$response" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if 'error' in data:
        print(f'ERROR: {data[\"error\"][\"message\"]}', file=sys.stderr)
        sys.exit(1)
    text = data['content'][0]['text']
    print(text)
except Exception as e:
    print(f'ERROR: Anthropic 응답 파싱 실패: {e}', file=sys.stderr)
    sys.exit(1)
"
}

# --- OpenAI API 호출 ---
_llm_call_openai() {
  local prompt="$1"
  local model="${OPENAI_MODEL:-gpt-4.1}"
  local api_key="${OPENAI_API_KEY:-}"

  if [ -z "$api_key" ]; then
    echo "ERROR: OPENAI_API_KEY 미설정" >&2
    return 1
  fi

  local tmpfile
  tmpfile=$(mktemp /tmp/wikey-llm-XXXXXX.json)

  python3 -c "
import json, sys
payload = {
    'model': '${model}',
    'max_tokens': 8192,
    'messages': [{'role': 'user', 'content': sys.stdin.read()}]
}
with open('${tmpfile}', 'w') as f:
    json.dump(payload, f)
" <<< "$prompt"

  local response
  response=$(curl -s -X POST \
    "https://api.openai.com/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${api_key}" \
    -d "@${tmpfile}" 2>/dev/null)

  rm -f "$tmpfile"

  echo "$response" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    if 'error' in data:
        print(f'ERROR: {data[\"error\"][\"message\"]}', file=sys.stderr)
        sys.exit(1)
    text = data['choices'][0]['message']['content']
    print(text)
except Exception as e:
    print(f'ERROR: OpenAI 응답 파싱 실패: {e}', file=sys.stderr)
    sys.exit(1)
"
}

# --- Ollama API 호출 ---
_llm_call_ollama() {
  local prompt="$1"
  local model="${WIKEY_MODEL:-gemma4}"
  local url="${OLLAMA_URL:-http://localhost:11434}"

  local tmpfile
  tmpfile=$(mktemp /tmp/wikey-llm-XXXXXX.json)

  python3 -c "
import json, sys
payload = {
    'model': '${model}',
    'messages': [{'role': 'user', 'content': sys.stdin.read()}],
    'stream': False,
    'options': {'num_predict': 8192, 'temperature': 0.1}
}
with open('${tmpfile}', 'w') as f:
    json.dump(payload, f)
" <<< "$prompt"

  local response
  response=$(curl -s -X POST \
    "${url}/api/chat" \
    -H "Content-Type: application/json" \
    -d "@${tmpfile}" 2>/dev/null)

  rm -f "$tmpfile"

  echo "$response" | python3 -c "
import json, sys
try:
    data = json.load(sys.stdin)
    text = data.get('message', {}).get('content', '')
    # Gemma 4 thinking 블록 제거
    if 'done thinking' in text.lower():
        text = text[text.lower().index('done thinking') + len('done thinking'):]
        text = text.lstrip('.\\n ')
    print(text.strip())
except Exception as e:
    print(f'ERROR: Ollama 응답 파싱 실패: {e}', file=sys.stderr)
    sys.exit(1)
"
}

# --- 통합 호출 함수 ---

# llm_call "프롬프트" [--provider NAME]
llm_call() {
  local prompt=""
  local provider=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --provider) provider="$2"; shift 2 ;;
      *) prompt="$1"; shift ;;
    esac
  done

  provider="${provider:-$(resolve_provider default)}"

  case "$provider" in
    gemini)         _llm_call_gemini "$prompt" ;;
    anthropic)      _llm_call_anthropic "$prompt" ;;
    openai|codex)   _llm_call_openai "$prompt" ;;
    ollama|local)   _llm_call_ollama "$prompt" ;;
    claude-code)
      # Claude Code는 스크립트에서 직접 호출 불가 → API 키 있으면 anthropic, 없으면 ollama
      if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
        _llm_call_anthropic "$prompt"
      else
        echo "WARN: claude-code는 스크립트 호출 불가, ollama로 폴백" >&2
        _llm_call_ollama "$prompt"
      fi
      ;;
    *) echo "ERROR: 알 수 없는 프로바이더: $provider" >&2; return 1 ;;
  esac
}

# llm_call_with_file "프롬프트" file.pdf [--provider NAME]
llm_call_with_file() {
  local prompt=""
  local filepath=""
  local provider=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --provider) provider="$2"; shift 2 ;;
      *)
        if [ -z "$prompt" ]; then
          prompt="$1"
        else
          filepath="$1"
        fi
        shift
        ;;
    esac
  done

  if [ -z "$filepath" ] || [ ! -f "$filepath" ]; then
    echo "ERROR: 파일 없음: $filepath" >&2
    return 1
  fi

  provider="${provider:-$(resolve_provider summarize)}"

  # 텍스트 파일은 프롬프트에 직접 포함
  local ext="${filepath##*.}"
  if [[ "$ext" =~ ^(md|txt|csv|json)$ ]]; then
    local content
    content=$(cat "$filepath")
    llm_call "${prompt}

--- 파일 내용 (${filepath##*/}) ---
${content}" --provider "$provider"
    return $?
  fi

  # PDF 등 바이너리 파일
  case "$provider" in
    gemini)
      _llm_call_gemini_with_file "$prompt" "$filepath"
      ;;
    anthropic|claude-code)
      # Anthropic vision API: base64 PDF
      local b64
      b64=$(python3 -c "import base64,sys; print(base64.b64encode(open('${filepath}','rb').read()).decode())")
      local full_prompt="[PDF 파일이 첨부되었습니다: ${filepath##*/}]

${prompt}

[PDF를 base64로 디코딩하여 분석할 수 없으므로, 이 모드에서는 텍스트 추출을 먼저 수행합니다.]"

      # pdftotext로 텍스트 추출 후 텍스트 모드로 전환
      if command -v pdftotext &>/dev/null; then
        local text
        text=$(pdftotext "$filepath" - 2>/dev/null | head -c 200000)
        llm_call "${prompt}

--- PDF 텍스트 추출 (${filepath##*/}) ---
${text}" --provider "$provider"
      else
        echo "ERROR: pdftotext 미설치 (poppler). PDF 처리 불가." >&2
        return 1
      fi
      ;;
    openai|codex)
      # OpenAI도 텍스트 추출 방식
      if command -v pdftotext &>/dev/null; then
        local text
        text=$(pdftotext "$filepath" - 2>/dev/null | head -c 200000)
        llm_call "${prompt}

--- PDF 텍스트 추출 (${filepath##*/}) ---
${text}" --provider "$provider"
      else
        echo "ERROR: pdftotext 미설치 (poppler). PDF 처리 불가." >&2
        return 1
      fi
      ;;
    ollama|local)
      if command -v pdftotext &>/dev/null; then
        local text
        text=$(pdftotext "$filepath" - 2>/dev/null | head -c 50000)
        llm_call "${prompt}

--- PDF 텍스트 추출 (${filepath##*/}, 처음 50000자) ---
${text}" --provider "$provider"
      else
        echo "ERROR: pdftotext 미설치 (poppler). PDF 처리 불가." >&2
        return 1
      fi
      ;;
    *) echo "ERROR: 알 수 없는 프로바이더: $provider" >&2; return 1 ;;
  esac
}
