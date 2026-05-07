#!/bin/bash
# validate-wiki.sh — 위키 정합성 검증
# 종료 코드: 0=통과, 1=실패

WIKI_DIR="wiki"
ERROR_FILE=$(mktemp)
echo 0 > "$ERROR_FILE"

error() {
  echo "FAIL: $1"
  count=$(cat "$ERROR_FILE")
  echo $((count + 1)) > "$ERROR_FILE"
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
# Wikilink는 wiki/ 내 .md 또는 raw/ 내 임의 파일(PDF/이미지 등)을 가리킬 수 있음.
# Obsidian은 파일명 기반 자동 해결이라 위치 무관.
echo "=== 검증 2: 위키링크 확인 ==="
# Wikilink 형식 모두 지원 (§5.3 follow-up #11):
#   [[basename]]               — vault 안의 같은 basename .md 또는 raw/<basename>.<any> 매칭
#   [[<vault path>]]           — full path 직접 존재 (raw/.../*.md 등 sidecar 포함)
#   [[<vault path>|<display>]] — alias 형식. link 부분 = | 앞쪽 (perl 에서 /\|/ 로 split)
find "$WIKI_DIR" -name "*.md" -print0 | while IFS= read -r -d '' file; do
  perl -ne 'while (/\[\[([^\]]+)\]\]/g) { my $l = $1; $l =~ s/\|.*//; print "$l\n" }' "$file" | while read -r link; do
    # path 형태 (`/` 포함) 면 vault root 기준으로 직접 존재 검사
    if printf '%s' "$link" | grep -q '/'; then
      if [ -f "$link" ]; then
        continue
      fi
      error "$file: 깨진 위키링크 [[${link}]]"
      continue
    fi
    # basename 형태 — §5.13.B2: link 자체 매칭 + extension fallback 양방 시도.
    # 1) wiki/ 안 link 자체 (extension 포함된 경우 — `link.md`, `link.txt` 등)
    # 2) wiki/ 안 link.md auto-append (extension 없는 경우 — `link` → `link.md`)
    # 3) raw/ 안 link 자체 (extension 포함된 경우 — `link.md`, `link.pdf` 등)
    # 4) raw/ 안 link.* fallback (extension 없는 경우 — `link` → `link.<any>`)
    found=$(find "$WIKI_DIR" -name "${link}" -print -quit 2>/dev/null)
    [ -z "$found" ] && found=$(find "$WIKI_DIR" -name "${link}.md" -print -quit 2>/dev/null)
    [ -z "$found" ] && found=$(find raw -name "${link}" -print -quit 2>/dev/null)
    [ -z "$found" ] && found=$(find raw -name "${link}.*" -print -quit 2>/dev/null)
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
# 검증 6: vault-wide basename 충돌 (§5.13.D)
# ──────────────────────────────────────────────
# §5.13.A1 raw wikilink `[[<rawSourceFilename>|원문]]` 가 raw 파일로 정확히 resolve 되도록
# wiki/{entities,concepts,sources,analyses}/<X>.md 와 raw/<*>/<X>.md 동일 basename 충돌 detection.
# 충돌 시 Obsidian basename matcher 가 path proximity 로 wiki page 선택 → §5.13.A1 paradigm 위반.
echo "=== 검증 6: raw vs wiki basename 충돌 확인 ==="
find raw -type f -name "*.md" 2>/dev/null | while read -r raw_file; do
  base=$(basename "$raw_file")
  find "$WIKI_DIR" -name "$base" -print 2>/dev/null | while read -r wiki_match; do
    [ -z "$wiki_match" ] && continue
    error "basename 충돌: $base (raw=$raw_file ↔ wiki=$wiki_match) — §5.13.A1 raw wikilink target ambiguity"
  done
done

# ──────────────────────────────────────────────
# 결과
# ──────────────────────────────────────────────
ERRORS=$(cat "$ERROR_FILE")
rm -f "$ERROR_FILE"

echo ""
if [ "$ERRORS" -eq 0 ]; then
  echo "PASS: 모든 검증 통과"
  exit 0
else
  echo "FAIL: ${ERRORS}건 오류 발견"
  exit 1
fi
