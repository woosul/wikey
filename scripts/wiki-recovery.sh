#!/usr/bin/env bash
# §5.19 Spec 3 — wiki-recovery confirm-gated fix.
#
# Reads stdin JSON: { confirm: bool, danglingShas?: string[], staleTombstoneIds?: string[] }
# Calls `wikey-core/src/wiki/maintenance/recovery.ts:applyWikiRecovery` and emits the
# WikiRecoveryReport JSON to stdout. confirm=false → 0 changes (I7 invariant).

set -e
trap 'echo "[wiki-recovery] aborted" >&2' INT TERM

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENTRY="${PROJECT_DIR}/wikey-core/dist/wiki/maintenance.js"
ADAPTER="${PROJECT_DIR}/scripts/lib/wiki-fs-adapter.cjs"

if [ ! -f "$ENTRY" ]; then
  echo "[wiki-recovery] wikey-core build 필요: cd wikey-core && npm run build" >&2
  exit 2
fi

cd "$PROJECT_DIR"

STDIN_JSON="$(cat)"

node -e "
  const { applyWikiRecovery } = require('$ENTRY')
  const { createWikiFS } = require('$ADAPTER')
  const opts = JSON.parse(\`$STDIN_JSON\`)
  const wikiFS = createWikiFS(process.cwd())
  applyWikiRecovery(wikiFS, opts).then((r) => {
    console.log(JSON.stringify(r))
  }).catch((e) => { console.error(e); process.exit(2) })
"
