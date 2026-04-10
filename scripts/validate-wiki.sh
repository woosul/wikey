#!/bin/bash
# validate-wiki.sh — 위키 정합성 검증
# 종료 코드: 0=통과, 1=실패

WIKI_DIR="wiki"
ERRORS=0

error() {
  echo "FAIL: $1"
  ERRORS=$((ERRORS + 1))
}

# ──────────────────────────────────────────────
# 검증 1: YAML 프론트매터 존재 확인
# ──────────────────────────────────────────────
echo "=== 검증 1: 프론트매터 확인 ==="
find "$WIKI_DIR" -name "*.md" -print0 | while IFS= read -r -d '' file; do
  head -1 "$file" | grep -q '^---$' || error "$file: 프론트매터 없음"
done

# ──────────────────────────────────────────────
# 검증 2: 위키링크 대상 파일 존재 확인
# ──────────────────────────────────────────────
echo "=== 검증 2: 위키링크 확인 ==="
find "$WIKI_DIR" -name "*.md" -print0 | while IFS= read -r -d '' file; do
  # perl로 [[link]] 또는 [[link|display]] 에서 link 부분 추출
  perl -ne 'while (/\[\[([^\]|]+)/g) { print "$1\n" }' "$file" | while read -r link; do
    found=$(find "$WIKI_DIR" -name "${link}.md" -print -quit 2>/dev/null)
    if [ -z "$found" ]; then
      error "$file: 깨진 위키링크 [[${link}]]"
    fi
  done
done

# ──────────────────────────────────────────────
# 검증 3: index.md 등재 확인
# ──────────────────────────────────────────────
echo "=== 검증 3: 인덱스 등재 확인 ==="
INDEX_FILE="$WIKI_DIR/index.md"
if [ -f "$INDEX_FILE" ]; then
  for subdir in entities concepts sources; do
    dir="$WIKI_DIR/$subdir"
    [ -d "$dir" ] || continue
    find "$dir" -name "*.md" -print0 | while IFS= read -r -d '' file; do
      basename=$(basename "$file" .md)
      if ! grep -q "\[\[${basename}\]\]" "$INDEX_FILE" 2>/dev/null; then
        error "$file: index.md에 미등재"
      fi
    done
  done
else
  error "index.md 파일 없음"
fi

# ──────────────────────────────────────────────
# 검증 4: log.md 형식 확인
# ──────────────────────────────────────────────
echo "=== 검증 4: log.md 형식 확인 ==="
LOG_FILE="$WIKI_DIR/log.md"
if [ -f "$LOG_FILE" ]; then
  # 프론트매터 이후의 ## 헤더가 날짜 형식인지 확인
  in_body=false
  count=0
  while IFS= read -r line; do
    if [ "$line" = "---" ]; then
      count=$((count + 1))
      if [ "$count" -ge 2 ]; then
        in_body=true
      fi
      continue
    fi
    if [ "$in_body" = true ] && echo "$line" | grep -q '^## '; then
      if ! echo "$line" | grep -qE '^## \[[0-9]{4}-[0-9]{2}-[0-9]{2}\]'; then
        error "log.md: 잘못된 형식 — $line"
      fi
    fi
  done < "$LOG_FILE"
fi

# ──────────────────────────────────────────────
# 검증 5: 중복 파일명 확인
# ──────────────────────────────────────────────
echo "=== 검증 5: 중복 파일명 확인 ==="
dupes=$(find "$WIKI_DIR" -name "*.md" -exec basename {} \; | sort | uniq -d)
if [ -n "$dupes" ]; then
  echo "$dupes" | while read -r dup; do
    error "중복 파일명: $dup"
  done
fi

# ──────────────────────────────────────────────
# 결과
# ──────────────────────────────────────────────
echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "PASS: 모든 검증 통과"
  exit 0
else
  echo "FAIL: ${ERRORS}건 오류 발견"
  exit 1
fi
