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

report_file() {
  # 주어진 md 파일을 리포트에 기록.
  local tier="$1" out="$2" dur="$3"
  local bytes kr_loss
  bytes=$(wc -c < "$out" | tr -d ' ')
  kr_loss=$(python3 -c "
import re
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
}

measure() {
  # 일반 tier: stdout 이 곧 markdown 본문. `$@` 실행 → $out 저장.
  local tier="$1"; shift
  local out="$OUT_DIR/$STEM.$tier.md"
  local start end dur
  start=$(python3 -c 'import time; print(time.monotonic())')
  if "$@" > "$out" 2>/dev/null; then
    end=$(python3 -c 'import time; print(time.monotonic())')
    dur=$(python3 -c "print(f'{$end - $start:.2f}')")
    report_file "$tier" "$out" "$dur"
  else
    echo -e "$tier\tFAILED\t0\t-\t-" | tee -a "$REPORT"
    rm -f "$out"
  fi
}

measure_docling() {
  # docling 은 --output <dir> 만 지원 (stdout X). 결과 md 파일 찾아 이동.
  local tier="$1" force_ocr="${2:-}"
  local tmp="$OUT_DIR/tmp-$tier-$$"
  local out="$OUT_DIR/$STEM.$tier.md"
  local start end dur docling_md src_base
  mkdir -p "$tmp"
  src_base="${BASE%.*}"  # 확장자 제거
  local args=("$SRC" --to md --output "$tmp" --table-mode accurate --image-export-mode embedded)
  if [[ -n "$force_ocr" ]]; then
    args+=(--force-ocr --ocr-lang ko-KR,en-US)
  fi
  start=$(python3 -c 'import time; print(time.monotonic())')
  if docling "${args[@]}" &>/dev/null; then
    end=$(python3 -c 'import time; print(time.monotonic())')
    dur=$(python3 -c "print(f'{$end - $start:.2f}')")
    docling_md="$tmp/$src_base.md"
    if [[ -f "$docling_md" ]]; then
      mv "$docling_md" "$out"
      report_file "$tier" "$out" "$dur"
    else
      # 파일명 매칭 실패 시 첫 md 파일 찾기
      docling_md=$(ls "$tmp"/*.md 2>/dev/null | head -1)
      if [[ -n "$docling_md" ]]; then
        mv "$docling_md" "$out"
        report_file "$tier" "$out" "$dur"
      else
        echo -e "$tier\tFAILED (no md output)\t0\t-\t-" | tee -a "$REPORT"
      fi
    fi
  else
    echo -e "$tier\tFAILED\t0\t-\t-" | tee -a "$REPORT"
  fi
  rm -rf "$tmp"
}

measure_unhwp() {
  # unhwp: convert.py 가 <tmp>/<filename>.md 를 만들고 stdout 에 경로 출력.
  local tmp="$OUT_DIR/tmp-unhwp-$$"
  local out="$OUT_DIR/$STEM.unhwp.md"
  local start end dur md_path
  mkdir -p "$tmp"
  start=$(python3 -c 'import time; print(time.monotonic())')
  if md_path=$(python3 scripts/vendored/unhwp-convert.py "$SRC" "$tmp" 2>/dev/null); then
    end=$(python3 -c 'import time; print(time.monotonic())')
    dur=$(python3 -c "print(f'{$end - $start:.2f}')")
    if [[ -n "$md_path" && -f "$md_path" ]]; then
      mv "$md_path" "$out"
      report_file "unhwp" "$out" "$dur"
    else
      echo -e "unhwp\tFAILED (no md path)\t0\t-\t-" | tee -a "$REPORT"
    fi
  else
    echo -e "unhwp\tFAILED\t0\t-\t-" | tee -a "$REPORT"
  fi
  rm -rf "$tmp"
}

echo "Benchmarking: $SRC → $OUT_DIR"
echo ""

EXT_LOWER=$(echo "$EXT" | tr '[:upper:]' '[:lower:]')

case "$EXT_LOWER" in
  hwp|hwpx)
    if command -v python3 &>/dev/null && python3 -c 'import unhwp' &>/dev/null; then
      measure_unhwp
    else
      echo "unhwp not installed (pip install unhwp)" >&2
    fi
    ;;
  pdf|docx|pptx|xlsx|html|htm|png|jpg|jpeg|tiff|csv)
    if command -v docling &>/dev/null; then
      measure_docling docling
      if [[ "$EXT_LOWER" == "pdf" ]]; then
        measure_docling docling-force-ocr force
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
