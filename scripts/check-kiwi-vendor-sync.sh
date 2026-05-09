#!/usr/bin/env bash
# §5.7.5 — kiwi-nlp vendor sync detect.
#
# 현재 vendor (sparse) 의 Kiwi git tag (VENDOR.md) 와 upstream `bab2min/Kiwi`
# 본가의 latest release 를 비교. 결과 stdout 에 `current=<tag> upstream=<tag>
# hasUpdate=<true|false>` 형식으로 출력. exit 0 = OK (network 실패 포함, 부분 정보).
# exit 1 = VENDOR.md 부재 등 시스템 이상.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR_MD="$REPO_ROOT/wikey-core/vendor/kiwi-nlp/VENDOR.md"

if [ ! -f "$VENDOR_MD" ]; then
  echo "ERR: VENDOR.md not found at $VENDOR_MD" >&2
  exit 1
fi

# Read Kiwi git tag from VENDOR.md (`Kiwi git tag**: vX.Y.Z`)
CURRENT=$(grep -E 'Kiwi git tag\*\*:' "$VENDOR_MD" | head -1 | sed -E 's/.*Kiwi git tag\*\*:[[:space:]]*([^[:space:]]+).*/\1/')
if [ -z "${CURRENT:-}" ]; then
  echo "ERR: Failed to parse Kiwi git tag from VENDOR.md" >&2
  exit 1
fi

# Best-effort upstream fetch via curl (no auth required for public release API).
UPSTREAM=""
HAS_UPDATE="false"
if command -v curl >/dev/null 2>&1; then
  RESP=$(curl -sSL --max-time 8 "https://api.github.com/repos/bab2min/Kiwi/releases/latest" || true)
  if [ -n "$RESP" ]; then
    UPSTREAM=$(printf '%s' "$RESP" | sed -nE 's/.*"tag_name":[[:space:]]*"([^"]+)".*/\1/p' | head -1)
  fi
fi

if [ -n "$UPSTREAM" ] && [ "$UPSTREAM" != "$CURRENT" ]; then
  HAS_UPDATE="true"
fi

echo "current=$CURRENT upstream=${UPSTREAM:-unknown} hasUpdate=$HAS_UPDATE"
exit 0
