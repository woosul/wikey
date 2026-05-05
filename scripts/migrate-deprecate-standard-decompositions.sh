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
#      aliases 만 보존 (D-wide 보존 영역; PII 는 .wikey/pii-patterns.yaml 별 file).
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

# ── Step 1 — schema.yaml split (deprecated sections → manual-overrides.yaml) ──
SCHEMA_YAML="$WIKEY_DIR/schema.yaml"
MANUAL_OVERRIDES="$WIKEY_DIR/manual-overrides.yaml"
if [[ -f "$SCHEMA_YAML" ]]; then
  echo "[1] schema.yaml: $SCHEMA_YAML"
  echo "    → backup: $BACKUP_DIR/schema.yaml.original"
  echo "    → split deprecated sections (standard_decompositions / entity_types / concept_types / custom_types / pii_patterns)"
  echo "      → $MANUAL_OVERRIDES (보존, 사용자 수동 정정 reference)"
  echo "    → rewrite: aliases 만 잔존 (PII 는 별 file)"
  if [[ "$MODE" == "--apply" ]]; then
    mkdir -p "$BACKUP_DIR"
    cp "$SCHEMA_YAML" "$BACKUP_DIR/schema.yaml.original"
    # P2-3 fix: existing manual-overrides.yaml 보호 — overwrite 전 backup
    if [[ -f "$MANUAL_OVERRIDES" ]]; then
      cp "$MANUAL_OVERRIDES" "$BACKUP_DIR/manual-overrides.yaml.original"
      echo "      (existing manual-overrides.yaml backed up)"
    fi
    # awk 로 deprecated sections (top-level keys + 그 indented children) 만 추출.
    # YAML 의 단순 indent 기반 — anchors / multiline scalars 미지원 (wikey schema 규칙 일치).
    # §5.10.4 cycle #4 P2 fix: pii_patterns 도 deprecated section 으로 처리.
    # PII engine 은 .wikey/pii-patterns.yaml + ~/.config/wikey/pii-patterns.yaml 만 인식
    # (shape patterns:- id/kind/mask). schema.yaml 의 pii_patterns 는 inactive — 사용자
    # 정의 잔존 시 PII protection 누락 위험 → manual-overrides.yaml 으로 분리 + redirect 안내.
    awk '
      BEGIN { skip = 0; section = "" }
      /^standard_decompositions[ \t]*:/ || /^entity_types[ \t]*:/ || /^concept_types[ \t]*:/ || /^custom_types[ \t]*:/ || /^pii_patterns[ \t]*:/ {
        skip = 1; section = $0; print "# --- section: " section " ---"; print; next
      }
      /^[a-zA-Z_]/ { skip = 0 }
      skip == 1 { print }
    ' "$SCHEMA_YAML" > "$MANUAL_OVERRIDES.tmp"
    if [[ -s "$MANUAL_OVERRIDES.tmp" ]]; then
      cat > "$MANUAL_OVERRIDES" <<'EOF_HEADER'
# §5.10.4 M migration — D-wide 채택 (2026-05-05)
#
# 본 file 은 schema.yaml 에서 분리된 deprecated sections.
# standard_decompositions / entity_types / concept_types / custom_types 모두 D-wide 폐기.
# pii_patterns 도 schema.yaml 에서 분리 (PII engine 은 .wikey/pii-patterns.yaml +
# ~/.config/wikey/pii-patterns.yaml 만 load, shape patterns:- id/kind/mask).
# canonicalizer / PII engine 모두 본 file 의 정의를 더 이상 읽지 않습니다.
#
# 액션:
# - alias 정의는 .wikey/schema.yaml 의 `aliases:` 섹션으로 이동 (canonicalizer 인식)
# - pii_patterns 는 .wikey/pii-patterns.yaml 의 `patterns: - id/kind/mask` shape 으로
#   변환 (PII engine 인식). 자세한 shape: wikey-core/src/pii-patterns.ts.

EOF_HEADER
      cat "$MANUAL_OVERRIDES.tmp" >> "$MANUAL_OVERRIDES"
      echo "      ✓ deprecated sections → $MANUAL_OVERRIDES"
    fi
    rm -f "$MANUAL_OVERRIDES.tmp"
    # schema.yaml rewrite — deprecated sections 모두 제거, aliases 만 잔존.
    awk '
      BEGIN { skip = 0 }
      /^standard_decompositions[ \t]*:/ || /^entity_types[ \t]*:/ || /^concept_types[ \t]*:/ || /^custom_types[ \t]*:/ || /^pii_patterns[ \t]*:/ {
        skip = 1; next
      }
      /^[a-zA-Z_]/ { skip = 0 }
      skip == 0 { print }
    ' "$BACKUP_DIR/schema.yaml.original" > "$SCHEMA_YAML"
    # 결과가 빈 file 이면 D-wide 보존 영역 placeholder 만 남김.
    if [[ ! -s "$SCHEMA_YAML" ]]; then
      cat > "$SCHEMA_YAML" <<'EOF_PLACEHOLDER'
# wikey schema override — .wikey/schema.yaml (D-wide, §5.10.4)
#
# 보존 section: aliases (canonical slug normalization) 단독.
# 폐기: standard_decompositions / entity_types / concept_types / custom_types / pii_patterns.
#
# PII custom rule 은 별 file: .wikey/pii-patterns.yaml (또는 ~/.config/wikey/pii-patterns.yaml)
# shape "patterns: - id/kind/mask". 자세한 shape: wikey-core/src/pii-patterns.ts.

# 예시:
# aliases:
#   iso-27001:
#     - ISO 27001
#     - ISO/IEC 27001
EOF_PLACEHOLDER
    fi
    echo "      ✓ schema.yaml 정정 (aliases 만 잔존 (PII 는 별 file))"
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
