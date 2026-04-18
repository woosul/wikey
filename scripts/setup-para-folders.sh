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

# 3차 Dewey Decimal 10대분류 (DDC 표준 번호 준수)
# 참고: https://en.wikipedia.org/wiki/Dewey_Decimal_Classification
THIRD=(
  "000_computer_science"   # Computer science, information, general
  "100_philosophy"         # Philosophy & psychology
  "200_religion"           # Religion
  "300_social_sciences"    # Social sciences
  "400_language"           # Language
  "500_natural_science"    # Natural sciences & Mathematics
  "600_technology"         # Technology (Applied sciences) — Engineering, Electronics, Communications, Medicine
  "700_arts_recreation"    # Arts & Recreation — Art, Music, Sports, Games, Hobbies
  "800_literature"         # Literature
  "900_history_geography"  # History & Geography
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

# PARA 방법론: Projects는 프로젝트별 고유 폴더라 사전 생성 불가 (런타임 생성).
# Areas / Resources / Archive는 주제 기반 분류이므로 동일한 2차 × 3차 구조 공유.
#
# 참고: https://fortelabs.com/blog/para/ (Tiago Forte)
# - Areas (2_): 지속 관리하는 책임 영역
# - Resources (3_): 나중에 참조할 주제별 자료
# - Archive (4_): 비활성화된 완료/만료 항목 (Areas/Resources에서 이동)
SHARED_TAXONOMY_PARENTS=(
  "2_areas"
  "3_resources"
  "4_archive"
)

# 2차 × 3차 (Areas / Resources / Archive 전체 조합 생성)
for parent in "${SHARED_TAXONOMY_PARENTS[@]}"; do
  for s in "${SECOND[@]}"; do
    create_dir "$RAW/$parent/$s"
    for t in "${THIRD[@]}"; do
      create_dir "$RAW/$parent/$s/$t"
    done
  done
done

echo "PARA 폴더 구조 준비 완료:"
echo "  생성: $created"
echo "  기존: $existed"
echo
echo "4차(제품명)는 인제스트 시점에 classify.ts 또는 사용자 판단으로 동적 생성됩니다."
