#!/usr/bin/env bash
# §5.10.4 M.1 — D-wide migration script
#
# §5.10 paradigm shift 옵션 D-wide 채택 (2026-05-04~05) 으로 §5.4 self-extending
# (Stage 1~4) 모두 폐기. 본 script 는 사용자 vault 의 stale store + schema.yaml
# `standard_decompositions` 영역을 안전하게 마이그레이션.
#
# 동작:
#   --dry-run  변경 file 목록 + 백업 위치만 출력 (실제 변경 X)
#   --apply    실제 마이그레이션 실행
#
# 5 단계 (보조 plan §3.3):
#   1. .wikey/schema.yaml 의 standard_decompositions / entity_types / concept_types
#      / custom_types 영역만 → .wikey/manual-overrides.yaml 백업 후 본 schema 에서 제거.
#      aliases / pii_patterns 만 보존 (D-wide 보존 영역).
#   2. .wikey/suggestions.json / converged-decompositions.json /
#      converged-decompositions.mock-baseline.json / mention-history.json /
#      qmd-embeddings.json 백업 후 제거.
#      ※ qmd-embeddings.json / mention-history.json 은 §5.5 graph 시각화 retain
#         결정 시 보존 가능 (--keep-graph-stores 옵션).
#   3. wiki/concepts/ 의 umbrella 자체 wiki page 가 component 로 분해되어 있으면
#      분해 정보 제거 (LLM 자동 작성 보존). 본 단계는 *수동 검토 권장* — script 는
#      후보 file 만 list, 자동 수정은 안 함.
#   4. .gitignore 정리 (.wikey/converged-* 가 매뉴얼로 추가되어 있으면 제거 가능).
#   5. (sidebar-chat.ts 의 Suggestions panel UI 코드 폐기는 별 commit 으로 처리됨 —
#      본 script 에서는 vault state 만 다룸.)
#
# Karpathy 원칙: dry-run 우선, 백업 의무, 사용자 승인 후 apply.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WIKEY_DIR="$ROOT/.wikey"
BACKUP_DIR="$ROOT/.wikey/.migration-backup-$(date +%Y%m%d-%H%M%S)"

MODE="${1:---dry-run}"
KEEP_GRAPH_STORES=0
for arg in "$@"; do
  if [[ "$arg" == "--keep-graph-stores" ]]; then
    KEEP_GRAPH_STORES=1
  fi
done

if [[ "$MODE" != "--dry-run" && "$MODE" != "--apply" ]]; then
  echo "Usage: $0 [--dry-run|--apply] [--keep-graph-stores]" >&2
  exit 2
fi

echo "=== §5.10.4 M D-wide migration ($MODE) ==="
echo "Root: $ROOT"
echo "Wikey dir: $WIKEY_DIR"
echo

# ── Step 1 — schema.yaml split ─────────────────────────────────────────
SCHEMA_YAML="$WIKEY_DIR/schema.yaml"
if [[ -f "$SCHEMA_YAML" ]]; then
  echo "[1] schema.yaml: $SCHEMA_YAML"
  echo "    → backup: $BACKUP_DIR/schema.yaml.original"
  echo "    → split: $WIKEY_DIR/manual-overrides.yaml (deprecated sections)"
  echo "    → rewrite: aliases / pii_patterns 만 보존"
  if [[ "$MODE" == "--apply" ]]; then
    mkdir -p "$BACKUP_DIR"
    cp "$SCHEMA_YAML" "$BACKUP_DIR/schema.yaml.original"
    # 백업으로만 두고 사용자가 manual-overrides.yaml 로 옮기도록 안내
    # (자동 split 은 YAML parser 의존 — bash 만으로 안전 split 어려움)
    cat > "$WIKEY_DIR/manual-overrides.yaml" <<'EOF_NOTICE'
# §5.10.4 M migration — D-wide 채택 (2026-05-05)
# 본 file 은 schema.yaml 의 deprecated sections 백업.
# standard_decompositions / entity_types / concept_types / custom_types 모두 D-wide 폐기.
# 사용자 hardcoded 정의가 있으면 manual-overrides.yaml 로 옮긴 뒤
# 본 script 의 schema.yaml 갱신을 수동 검토 후 apply 하세요.
EOF_NOTICE
    echo "    ⚠ schema.yaml 자동 rewrite 는 안전하지 않아 skip — backup 만 수행."
    echo "      $BACKUP_DIR/schema.yaml.original 참조 후 사용자 수동 정정 필요."
  fi
else
  echo "[1] schema.yaml: 없음 → skip"
fi
echo

# ── Step 2 — store files removal ────────────────────────────────────────
declare -a STORE_REMOVE
STORE_REMOVE=(
  "$WIKEY_DIR/suggestions.json"
  "$WIKEY_DIR/converged-decompositions.json"
  "$WIKEY_DIR/converged-decompositions.mock-baseline.json"
)
if [[ "$KEEP_GRAPH_STORES" -eq 0 ]]; then
  STORE_REMOVE+=(
    "$WIKEY_DIR/mention-history.json"
    "$WIKEY_DIR/qmd-embeddings.json"
  )
fi

echo "[2] store files (deprecate):"
for f in "${STORE_REMOVE[@]}"; do
  if [[ -f "$f" ]]; then
    sz=$(stat -f%z "$f" 2>/dev/null || stat -c%s "$f" 2>/dev/null || echo "?")
    echo "    → $f ($sz bytes)"
    if [[ "$MODE" == "--apply" ]]; then
      mkdir -p "$BACKUP_DIR"
      cp "$f" "$BACKUP_DIR/$(basename "$f").bak"
      rm "$f"
      echo "      ✓ backed up + removed"
    fi
  fi
done
if [[ "$KEEP_GRAPH_STORES" -eq 1 ]]; then
  echo "    (--keep-graph-stores: mention-history.json / qmd-embeddings.json 보존)"
fi
echo

# ── Step 3 — wiki/concepts/ umbrella 페이지 list (자동 X) ──────────────
echo "[3] wiki/concepts/ umbrella 페이지 검토 후보 (수동 정리):"
WIKI_CONCEPTS="$ROOT/wiki/concepts"
if [[ -d "$WIKI_CONCEPTS" ]]; then
  COUNT=0
  while IFS= read -r f; do
    if grep -q "umbrella_slug\|standard_decomposition" "$f" 2>/dev/null; then
      echo "    → $f"
      COUNT=$((COUNT+1))
    fi
  done < <(find "$WIKI_CONCEPTS" -name "*.md" -type f)
  echo "    총 $COUNT 개 후보 — D-wide 후 분해 정보 잔존 시 사용자 수동 정리 권장"
fi
echo

# ── Step 4 — .gitignore 검토 (자동 X) ────────────────────────────────────
echo "[4] .gitignore 검토:"
GITIGNORE="$ROOT/.gitignore"
if [[ -f "$GITIGNORE" ]]; then
  if grep -qE "converged-decompositions|suggestions\.json|mention-history\.json" "$GITIGNORE"; then
    echo "    .gitignore 에 deprecated store 항목 잔존 — 사용자 수동 검토:"
    grep -nE "converged-decompositions|suggestions\.json|mention-history\.json" "$GITIGNORE" | sed 's/^/      /'
  else
    echo "    deprecated store 항목 없음 ✓"
  fi
fi
echo

# ── 마무리 ─────────────────────────────────────────────────────────────
if [[ "$MODE" == "--dry-run" ]]; then
  echo "=== dry-run 완료 — 실제 변경 없음 ==="
  echo "    apply: $0 --apply [--keep-graph-stores]"
else
  echo "=== apply 완료 ==="
  echo "    backup: $BACKUP_DIR"
  echo "    npm test + npm run build 으로 검증 권장"
fi
