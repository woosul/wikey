#!/usr/bin/env bash
# Phase 4.1.1.7 — 변환기 성능 비교 매트릭스
#
# 사용법:
#   scripts/benchmark-converters.sh <pdf_or_hwp_file> [output_dir]
#
# 여러 변환기로 동일 파일을 변환하고 사이즈·소요시간·한국어 공백 소실 비율을 비교.
# 결과는 output_dir (기본 /tmp/wikey-bench/) 에 tier 별 .md 저장 + TSV 리포트.
set -euo pipefail

SRC="${1:-}"
OUT_DIR="${2:-/tmp/wikey-bench}"

if [[ -z "$SRC" || ! -f "$SRC" ]]; then
  echo "Usage: $0 <source_file> [output_dir]" >&2
  echo "  Supports .pdf, .docx, .pptx, .xlsx, .html, .hwp, .hwpx" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
BASE="$(basename "$SRC")"
STEM="${BASE%.*}"
EXT="${BASE##*.}"
REPORT="$OUT_DIR/report-$STEM.tsv"

echo -e "tier\toutput\tbytes\tseconds\tkorean_loss" > "$REPORT"

measure() {
  local tier="$1"; shift
  local out="$OUT_DIR/$STEM.$tier.md"
  local start end dur bytes kr_loss
  start=$(python3 -c 'import time; print(time.monotonic())')
  if "$@" > "$out" 2>/dev/null; then
    end=$(python3 -c 'import time; print(time.monotonic())')
    dur=$(python3 -c "print(f'{$end - $start:.2f}')")
    bytes=$(wc -c < "$out" | tr -d ' ')
    kr_loss=$(python3 -c "
import re, sys
try:
    t = open('$out').read()
    t = re.sub(r'!\[.*?\]\([^)]+\)', '', t, flags=re.DOTALL)
    k = sum(1 for c in t if '가' <= c <= '힯')
    toks = [x for x in re.split(r'\s+', t) if any('가'<=c<='힯' for c in x)]
    if k < 100 or not toks: print('n/a')
    else: print(f'{sum(1 for x in toks if len(x) >= 15) / len(toks):.2%}')
except Exception as e: print('err')
" 2>/dev/null || echo "err")
    echo -e "$tier\t$out\t$bytes\t${dur}s\t$kr_loss" | tee -a "$REPORT"
  else
    echo -e "$tier\tFAILED\t0\t-\t-" | tee -a "$REPORT"
    rm -f "$out"
  fi
}

echo "Benchmarking: $SRC → $OUT_DIR"
echo ""

EXT_LOWER=$(echo "$EXT" | tr '[:upper:]' '[:lower:]')

case "$EXT_LOWER" in
  hwp|hwpx)
    if command -v python3 &>/dev/null && python3 -c 'import unhwp' &>/dev/null; then
      measure unhwp python3 scripts/vendored/unhwp-convert.py "$SRC" "$OUT_DIR/tmp-unhwp"
      if [[ -d "$OUT_DIR/tmp-unhwp" ]]; then
        MD=$(ls "$OUT_DIR/tmp-unhwp"/*.md 2>/dev/null | head -1)
        if [[ -n "$MD" ]]; then
          mv "$MD" "$OUT_DIR/$STEM.unhwp.md"
          rm -rf "$OUT_DIR/tmp-unhwp"
        fi
      fi
    else
      echo "unhwp not installed (pip install unhwp)" >&2
    fi
    ;;
  pdf|docx|pptx|xlsx|html|htm|png|jpg|jpeg|tiff|csv)
    if command -v docling &>/dev/null; then
      measure docling docling "$SRC" --to md --output - --table-mode accurate --image-export-mode embedded 2>/dev/null
      if [[ "$EXT_LOWER" == "pdf" ]]; then
        measure docling-force-ocr docling "$SRC" --to md --output - --force-ocr --ocr-lang ko-KR,en-US 2>/dev/null
      fi
    fi
    if [[ "$EXT_LOWER" == "pdf" ]] && command -v pdftotext &>/dev/null; then
      measure pdftotext pdftotext "$SRC" -
    fi
    if python3 -c 'from markitdown import MarkItDown' &>/dev/null; then
      measure markitdown python3 -c "
from markitdown import MarkItDown
import sys
print(MarkItDown().convert(sys.argv[1]).text_content)
" "$SRC"
    fi
    if [[ "$EXT_LOWER" == "pdf" ]] && python3 -c 'import fitz' &>/dev/null; then
      measure pymupdf python3 -c "
import fitz, sys
doc = fitz.open(sys.argv[1])
print('\n'.join(p.get_text() for p in doc))
" "$SRC"
    fi
    ;;
  *)
    echo "Unsupported extension: $EXT_LOWER" >&2
    exit 2
    ;;
esac

echo ""
echo "Report: $REPORT"
column -t -s $'\t' "$REPORT"
