#!/usr/bin/env bash
# validate-wiki.sh — Phase 5 §5.7.1 thin wrapper (2026-05-08).
# Logic: wikey-core/src/scripts/validate-wiki.ts → dist/scripts/validate-wiki.js (in-process).
# Production (Obsidian plugin) 은 wikey-core 함수 직접 import — bash spawn 없음.

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENTRY="${PROJECT_DIR}/wikey-core/dist/scripts/validate-wiki.js"

if [ ! -f "$ENTRY" ]; then
  echo "[validate-wiki] wikey-core build 필요: cd wikey-core && npm run build" >&2
  exit 2
fi

cd "$PROJECT_DIR"
exec node "$ENTRY" "$@"
