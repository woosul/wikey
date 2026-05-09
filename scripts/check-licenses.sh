#!/usr/bin/env bash
# §5.7.5 — license / NOTICE 정합성 자동 검증.
#
# wikey-core/package.json + wikey-obsidian/package.json 의 production `dependencies`
# (devDependencies 제외) 와 NOTICE / README "Third-party software" 섹션을 비교.
# 신규 dep 추가 + NOTICE 누락 시 exit 1 + 누락 dep 출력. 정합성 OK 시 exit 0.
#
# allowlist:
#   - workspace internal dep (`wikey-core`) 는 NOTICE 대상 아님.
#   - devDependencies 는 build/test 도구 — production redistribution 대상 아님.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NOTICE="$REPO_ROOT/NOTICE"
PKG_CORE="$REPO_ROOT/wikey-core/package.json"
PKG_OBS="$REPO_ROOT/wikey-obsidian/package.json"

if [ ! -f "$NOTICE" ]; then
  echo "ERR: NOTICE not found at $NOTICE" >&2
  exit 1
fi
if [ ! -f "$PKG_CORE" ] || [ ! -f "$PKG_OBS" ]; then
  echo "ERR: workspace package.json missing" >&2
  exit 1
fi

# Internal/workspace allowlist — these are NOT third-party software.
ALLOWLIST=("wikey-core")

# Extract production dependency names (skip devDependencies).
extract_deps() {
  local pkg="$1"
  python3 - "$pkg" <<'PY'
import json, sys
with open(sys.argv[1], 'r', encoding='utf-8') as f:
    data = json.load(f)
for name in (data.get('dependencies') or {}):
    print(name)
PY
}

ALL_DEPS=$( { extract_deps "$PKG_CORE"; extract_deps "$PKG_OBS"; } | sort -u )
MISSING=()
for dep in $ALL_DEPS; do
  # Skip workspace allowlist
  is_allowed=0
  for allowed in "${ALLOWLIST[@]}"; do
    if [ "$dep" = "$allowed" ]; then
      is_allowed=1
      break
    fi
  done
  if [ "$is_allowed" -eq 1 ]; then continue; fi

  # NOTICE / Third-party software section must mention the dep name (or its
  # canonical project name). We grep raw token — sufficient for the current
  # set (`@orama/orama` historically, others by display name).
  if ! grep -q -F "$dep" "$NOTICE"; then
    MISSING+=("$dep")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "ERR: production dependencies missing from NOTICE (Third-party software):" >&2
  for d in "${MISSING[@]}"; do
    echo "  - $d" >&2
  done
  echo "Add an entry to $NOTICE under the Third-party software section." >&2
  exit 1
fi

echo "OK: all production dependencies are referenced in NOTICE (Third-party software)."
exit 0
