#!/usr/bin/env bash
# setup-para-folders.sh — CLASSIFY.md 기준 PARA 폴더 구조 사전 생성 (idempotent)
#
# 1차: PARA 카테고리 (0~9_)
# 2차: 문서 유형 (10_, 20_, ...)
# 3차: 상세 주제 (101_, 102_, ...)
# 4차: 제품명 (인제스트 시 classify.ts + 사용자 판단으로 동적 생성)
#
# `raw/`는 .gitignore에 포함되어 있어 빈 폴더도 Git에 반영되지 않음.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW="$ROOT/raw"

# 1차 PARA 카테고리
TOP=(
  "0_inbox"
  "1_projects"
  "2_areas"
  "3_resources"
  "4_archive"
  "9_assets"
)

# 2차 문서 유형 (3_resources 기준, 필요 시 1_projects/2_areas에도 동일 구조 생성)
SECOND=(
  "10_article"
  "20_report"
  "30_manual"
  "40_cad"
  "50_firmware"
  "60_note"
)

# 3차 Dewey Decimal 자연계 분류 (간소화 10개 대분류)
THIRD=(
  "000_general"
  "100_humanities"
  "200_social"
  "300_science"
  "400_engineering"
  "500_technology"
  "600_communication"
  "700_arts"
  "800_literature"
  "900_lifestyle"
)

created=0
existed=0
create_dir() {
  if [ -d "$1" ]; then
    existed=$((existed + 1))
  else
    mkdir -p "$1"
    created=$((created + 1))
  fi
}

# 1차
for p in "${TOP[@]}"; do
  create_dir "$RAW/$p"
done

# 2차 × 3차 (3_resources 아래에만 전체 조합 생성)
for s in "${SECOND[@]}"; do
  create_dir "$RAW/3_resources/$s"
  for t in "${THIRD[@]}"; do
    create_dir "$RAW/3_resources/$s/$t"
  done
done

echo "PARA 폴더 구조 준비 완료:"
echo "  생성: $created"
echo "  기존: $existed"
echo
echo "4차(제품명)는 인제스트 시점에 classify.ts 또는 사용자 판단으로 동적 생성됩니다."
