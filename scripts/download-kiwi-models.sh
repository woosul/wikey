#!/usr/bin/env bash
# scripts/download-kiwi-models.sh — §5.7.4 AC-S1
#
# Kiwi 본가 (bab2min/Kiwi) v0.23.x model release 의 cong/base 사전을
# `~/.cache/wikey/kiwi-models/cong/base/` 으로 download + extract.
# - 9 파일 (sj.morph / *.dict / cong.mdl / extract.mdl / nounchr.mdl / combiningRule.txt) — 약 104MB
# - 이미 모두 존재 시 skip
# - 실패 시 사용자 안내 (수동 download URL)
set -e

CACHE_DIR="${HOME}/.cache/wikey/kiwi-models/cong/base"
KIWI_MODEL_TAG="v0.23.0"
KIWI_MODEL_URL="https://github.com/bab2min/Kiwi/releases/download/${KIWI_MODEL_TAG}/kiwi_model_base_${KIWI_MODEL_TAG}.tgz"

REQUIRED_FILES=(
  "sj.morph"
  "default.dict"
  "dialect.dict"
  "multi.dict"
  "typo.dict"
  "combiningRule.txt"
  "cong.mdl"
  "extract.mdl"
  "nounchr.mdl"
)

all_present=1
for f in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "${CACHE_DIR}/${f}" ]; then
    all_present=0
    break
  fi
done

if [ "$all_present" -eq 1 ]; then
  echo "[wikey] Kiwi 사전 이미 존재 — skip ($CACHE_DIR)"
  exit 0
fi

echo "[wikey] Kiwi 사전 download 시작"
echo "  source: $KIWI_MODEL_URL"
echo "  dest:   $CACHE_DIR"

mkdir -p "$CACHE_DIR"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if ! curl -fL "$KIWI_MODEL_URL" -o "$TMP/kiwi-models.tgz"; then
  echo "[wikey] download 실패 — 수동 download 필요"
  echo "  1) 브라우저로 https://github.com/bab2min/Kiwi/releases 방문"
  echo "  2) ${KIWI_MODEL_TAG} release 의 model archive download"
  echo "  3) cong/base/ 9 파일을 $CACHE_DIR 에 배치"
  exit 1
fi

# Try extracting — archive 내부 layout 은 본가가 'cong/base/' 또는 'base/' 로 변동 가능.
# 1차로 그대로 추출, 그 후 cong/base/ 가 있으면 그걸 cache_dir 으로 mv.
if ! tar -xzf "$TMP/kiwi-models.tgz" -C "$TMP"; then
  echo "[wikey] tar 추출 실패"
  exit 1
fi

# Find cong/base or base directory inside the extracted tree.
SRC_DIR=""
for cand in "$TMP/cong/base" "$TMP/base" "$TMP/kiwi-models/cong/base" "$TMP"; do
  if [ -d "$cand" ] && [ -f "${cand}/sj.morph" ]; then
    SRC_DIR="$cand"
    break
  fi
done

if [ -z "$SRC_DIR" ]; then
  echo "[wikey] 추출된 archive 안에서 sj.morph 를 찾지 못했습니다."
  echo "  archive layout 확인 후 수동으로 9 파일을 $CACHE_DIR 에 복사하세요."
  exit 1
fi

cp "$SRC_DIR"/* "$CACHE_DIR/"

echo "[wikey] Kiwi 사전 download 완료"
ls -1 "$CACHE_DIR" | head
exit 0
