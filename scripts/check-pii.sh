#!/bin/bash
# check-pii.sh — wiki/ 내 PII 패턴 스캐닝
# 종료 코드: 0=클린, 1=PII 발견

WIKI_DIR="wiki"
FOUND=0

warn() {
  echo "PII: $1"
  FOUND=$((FOUND + 1))
}

echo "=== PII 스캔: wiki/ ==="

find "$WIKI_DIR" -name "*.md" -print0 | while IFS= read -r -d '' file; do
  # 한국 전화번호 (010-1234-5678)
  if grep -nE '010-[0-9]{4}-[0-9]{4}' "$file" 2>/dev/null; then
    warn "$file: 전화번호 패턴 발견"
  fi

  # 이메일
  if grep -nE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' "$file" 2>/dev/null; then
    warn "$file: 이메일 패턴 발견"
  fi

  # 주민번호 (6자리-7자리, 뒷자리 1-4로 시작)
  if grep -nE '[0-9]{6}-[1-4][0-9]{6}' "$file" 2>/dev/null; then
    warn "$file: 주민번호 패턴 발견"
  fi
done

echo ""
if [ "$FOUND" -eq 0 ]; then
  echo "PASS: PII 패턴 없음"
  exit 0
else
  echo "WARN: ${FOUND}건 PII 패턴 발견 — 커밋 전 확인 필요"
  exit 1
fi
