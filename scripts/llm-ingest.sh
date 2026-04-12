#!/usr/bin/env bash
# llm-ingest.sh — 스크립트 기반 인제스트 (에이전트 세션 없이)
#
# 사용법:
#   ./scripts/llm-ingest.sh <소스 파일>                    # BASIC_MODEL로 인제스트
#   ./scripts/llm-ingest.sh <소스 파일> --provider gemini  # 명시적 프로바이더
#   ./scripts/llm-ingest.sh <소스 파일> --dry-run          # 프리뷰만 (파일 미생성)
#
# 파이프라인:
#   1. 소스 파일 읽기 (MD → 직접, PDF → pdftotext 또는 Gemini 네이티브)
#   2. LLM API 호출 — 구조화된 JSON 응답 요청
#   3. 응답 파싱 → wiki/ 파일 생성/수정
#   4. index.md, log.md 갱신
#   5. reindex.sh --quick 실행

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# llm-api.sh 로드
source "${SCRIPT_DIR}/lib/llm-api.sh"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[ingest]${NC} $*" >&2; }
log_ok()    { echo -e "${GREEN}[ingest]${NC} $*" >&2; }
log_warn()  { echo -e "${YELLOW}[ingest]${NC} $*" >&2; }
log_error() { echo -e "${RED}[ingest]${NC} $*" >&2; }

TODAY=$(date '+%Y-%m-%d')

# --- 인제스트 프롬프트 생성 ---
build_ingest_prompt() {
  local source_content="$1"
  local source_filename="$2"
  local index_content
  index_content=$(cat "${PROJECT_DIR}/wiki/index.md" 2>/dev/null || echo "(인덱스 없음)")

  cat <<PROMPT
당신은 wikey LLM Wiki의 인제스트 에이전트입니다.
아래 소스를 분석하여 위키 페이지를 생성하세요.

## 컨벤션

### 프론트매터 (모든 페이지 필수)
\`\`\`yaml
---
title: 페이지 제목
type: entity | concept | source
created: ${TODAY}
updated: ${TODAY}
sources: [source-name.md]
tags: [태그1, 태그2]
---
\`\`\`

### 파일명 규칙
- 소문자, 하이픈 구분 (예: my-page-name.md)
- 소스 페이지: source-{name}.md
- 엔티티: 고유명사/제품/인물 → wiki/entities/
- 개념: 추상적 아이디어/패턴 → wiki/concepts/

### 위키링크
- \`[[page-name]]\` 형식
- 이미 존재하는 페이지와 연결하세요

### 현재 인덱스 (이미 존재하는 페이지)
${index_content}

## 소스 파일
파일명: ${source_filename}

${source_content}

## 출력 형식

반드시 아래 JSON 형식으로 출력하세요. JSON만 출력하고, 다른 텍스트는 포함하지 마세요.

\`\`\`json
{
  "source_page": {
    "filename": "source-example.md",
    "content": "---\\ntitle: ...\\n---\\n\\n# 제목\\n\\n내용..."
  },
  "entities": [
    {
      "filename": "entity-name.md",
      "content": "---\\ntitle: ...\\n---\\n\\n# 제목\\n\\n내용..."
    }
  ],
  "concepts": [
    {
      "filename": "concept-name.md",
      "content": "---\\ntitle: ...\\n---\\n\\n# 제목\\n\\n내용..."
    }
  ],
  "index_additions": [
    "- [[page-name]] — 한 줄 설명 (소스: 1개)"
  ],
  "log_entry": "- 소스 요약 생성: [[source-name]]\\n- 엔티티 생성: [[entity1]]\\n- 개념 생성: [[concept1]]\\n- 인덱스 갱신"
}
\`\`\`
PROMPT
}

# --- JSON 응답 파싱 + 파일 생성 ---
apply_ingest_result() {
  local json_text="$1"
  local dry_run="${2:-false}"

  # JSON 블록 추출 (```json ... ``` 래핑 제거)
  local clean_json
  clean_json=$(echo "$json_text" | python3 -c "
import sys, json, re

text = sys.stdin.read()

# \`\`\`json ... \`\`\` 블록 추출
m = re.search(r'\`\`\`json\s*\n(.*?)\n\`\`\`', text, re.DOTALL)
if m:
    text = m.group(1)

# JSON 파싱 시도
try:
    data = json.loads(text)
    print(json.dumps(data, ensure_ascii=False))
except json.JSONDecodeError as e:
    print(f'ERROR: JSON 파싱 실패: {e}', file=sys.stderr)
    # 원본 출력 (디버그용)
    print(text[:500], file=sys.stderr)
    sys.exit(1)
")

  if [ $? -ne 0 ]; then
    log_error "LLM 응답을 JSON으로 파싱할 수 없습니다."
    log_error "원본 응답 (처음 300자):"
    echo "${json_text:0:300}" >&2
    return 1
  fi

  # 파일 생성
  python3 -c "
import json, sys, os

data = json.loads(sys.stdin.read())
dry_run = '${dry_run}' == 'true'
project = '${PROJECT_DIR}'
today = '${TODAY}'
created_files = []

# source 페이지
sp = data.get('source_page', {})
if sp.get('filename') and sp.get('content'):
    path = os.path.join(project, 'wiki', 'sources', sp['filename'])
    if dry_run:
        print(f'  [DRY] wiki/sources/{sp[\"filename\"]}')
    else:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, 'w') as f:
            f.write(sp['content'])
        print(f'  ✓ wiki/sources/{sp[\"filename\"]}')
    created_files.append(('sources', sp['filename']))

# entities
for e in data.get('entities', []):
    if e.get('filename') and e.get('content'):
        path = os.path.join(project, 'wiki', 'entities', e['filename'])
        if dry_run:
            print(f'  [DRY] wiki/entities/{e[\"filename\"]}')
        else:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w') as f:
                f.write(e['content'])
            print(f'  ✓ wiki/entities/{e[\"filename\"]}')
        created_files.append(('entities', e['filename']))

# concepts
for c in data.get('concepts', []):
    if c.get('filename') and c.get('content'):
        path = os.path.join(project, 'wiki', 'concepts', c['filename'])
        if dry_run:
            print(f'  [DRY] wiki/concepts/{c[\"filename\"]}')
        else:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, 'w') as f:
                f.write(c['content'])
            print(f'  ✓ wiki/concepts/{c[\"filename\"]}')
        created_files.append(('concepts', c['filename']))

# index.md 갱신
additions = data.get('index_additions', [])
if additions and not dry_run:
    index_path = os.path.join(project, 'wiki', 'index.md')
    with open(index_path, 'r') as f:
        index_content = f.read()

    # updated 날짜 갱신
    import re
    index_content = re.sub(r'updated: \d{4}-\d{2}-\d{2}', f'updated: {today}', index_content)

    # 카테고리별 추가
    for line in additions:
        line = line.strip()
        if not line:
            continue
        # 이미 존재하면 스킵
        page_ref = re.search(r'\[\[([^\]]+)\]\]', line)
        if page_ref and page_ref.group(1) in index_content:
            continue

        # 적절한 카테고리에 추가
        if 'source-' in line:
            marker = '## 분석'
        elif any(cf[0] == 'entities' for cf in created_files if cf[1].replace('.md','') in line):
            marker = '## 개념'
        elif any(cf[0] == 'concepts' for cf in created_files if cf[1].replace('.md','') in line):
            marker = '## 소스'
        else:
            marker = '## 소스'

        if marker in index_content:
            index_content = index_content.replace(marker, f'{line}\n\n{marker}')

    with open(index_path, 'w') as f:
        f.write(index_content)
    print(f'  ✓ wiki/index.md 갱신')
elif additions and dry_run:
    print(f'  [DRY] index.md에 {len(additions)}건 추가')

# log.md 갱신
log_entry = data.get('log_entry', '')
if log_entry and not dry_run:
    log_path = os.path.join(project, 'wiki', 'log.md')
    with open(log_path, 'r') as f:
        log_content = f.read()
    import re
    log_content = re.sub(r'updated: \d{4}-\d{2}-\d{2}', f'updated: {today}', log_content)
    source_name = sp.get('filename', 'unknown').replace('source-', '').replace('.md', '')
    entry = f'\\n## [{today}] ingest | {source_name} (llm-ingest.sh)\\n\\n{log_entry}\\n'
    log_content += entry
    with open(log_path, 'w') as f:
        f.write(log_content)
    print(f'  ✓ wiki/log.md 갱신')
elif log_entry and dry_run:
    print(f'  [DRY] log.md에 항목 추가')

total = len(created_files)
mode = 'DRY-RUN' if dry_run else 'DONE'
print(f'\\n  {mode}: {total}개 파일')
" <<< "$clean_json"
}

# --- 메인 ---
SOURCE_FILE=""
PROVIDER=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --provider|-p) PROVIDER="$2"; shift 2 ;;
    --dry-run|-n)  DRY_RUN=true; shift ;;
    --help|-h)
      echo "사용법:"
      echo "  llm-ingest.sh <소스 파일>                   BASIC_MODEL로 인제스트"
      echo "  llm-ingest.sh <소스> --provider gemini      프로바이더 지정"
      echo "  llm-ingest.sh <소스> --dry-run              프리뷰만"
      exit 0
      ;;
    *) SOURCE_FILE="$1"; shift ;;
  esac
done

if [ -z "$SOURCE_FILE" ]; then
  log_error "소스 파일을 지정하세요."
  echo "  사용법: llm-ingest.sh <소스 파일> [--provider NAME] [--dry-run]"
  exit 1
fi

if [ ! -f "$SOURCE_FILE" ]; then
  log_error "파일 없음: $SOURCE_FILE"
  exit 1
fi

PROVIDER="${PROVIDER:-$(resolve_provider ingest)}"

log_info "소스: ${SOURCE_FILE}"
log_info "프로바이더: ${PROVIDER}"
[ "$DRY_RUN" = true ] && log_info "모드: DRY-RUN (파일 미생성)"

# 소스 읽기
log_info "소스 읽기 중..."
EXT="${SOURCE_FILE##*.}"

if [[ "$EXT" =~ ^(md|txt)$ ]]; then
  SOURCE_CONTENT=$(cat "$SOURCE_FILE")
elif [ "$EXT" = "pdf" ]; then
  if [ "$PROVIDER" = "gemini" ]; then
    # Gemini는 PDF를 네이티브로 처리
    log_info "PDF → Gemini 네이티브 처리"
    PROMPT=$(build_ingest_prompt "(PDF 파일이 첨부됨)" "$(basename "$SOURCE_FILE")")
    log_info "LLM 호출 중... (${PROVIDER})"
    RESULT=$(llm_call_with_file "$PROMPT" "$SOURCE_FILE" --provider "$PROVIDER")
    echo ""
    log_info "응답 파싱 + 파일 생성 중..."
    apply_ingest_result "$RESULT" "$DRY_RUN"
    if [ "$DRY_RUN" = false ]; then
      log_info "reindex.sh --quick 실행 중..."
      "${SCRIPT_DIR}/reindex.sh" --quick 2>&1 | grep -E "✓|완료" | head -3
    fi
    log_ok "인제스트 완료"
    exit 0
  elif command -v pdftotext &>/dev/null; then
    log_info "PDF → pdftotext 텍스트 추출"
    SOURCE_CONTENT=$(pdftotext "$SOURCE_FILE" - 2>/dev/null | head -c 100000)
  else
    log_error "pdftotext 미설치. brew install poppler"
    exit 1
  fi
else
  SOURCE_CONTENT=$(cat "$SOURCE_FILE")
fi

# 프롬프트 생성
PROMPT=$(build_ingest_prompt "$SOURCE_CONTENT" "$(basename "$SOURCE_FILE")")

# LLM 호출
log_info "LLM 호출 중... (${PROVIDER})"
RESULT=$(llm_call "$PROMPT" --provider "$PROVIDER")

if [ -z "$RESULT" ]; then
  log_error "LLM 응답이 비어 있습니다."
  exit 1
fi

# 결과 적용
echo ""
log_info "응답 파싱 + 파일 생성 중..."
apply_ingest_result "$RESULT" "$DRY_RUN"

# 인덱싱
if [ "$DRY_RUN" = false ]; then
  log_info "reindex.sh --quick 실행 중..."
  "${SCRIPT_DIR}/reindex.sh" --quick 2>&1 | grep -E "✓|완료" | head -3
fi

log_ok "인제스트 완료"
