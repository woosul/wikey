#!/usr/bin/env bash
# §5.19 Spec 4 — wiki-refactoring suggestion-only output.
#
# Calls `wikey-core/src/wiki/maintenance/refactoring.ts:getRefactoringSuggestions`
# and emits RefactoringSuggestions JSON to stdout. wiki/ 변경 0 (I10 invariant —
# adapter constructed with writable=false). Override threshold via
# `.wikey/refactoring.yaml`.

set -e
trap 'echo "[wiki-refactoring] aborted" >&2' INT TERM

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENTRY="${PROJECT_DIR}/wikey-core/dist/wiki/maintenance.js"
ADAPTER="${PROJECT_DIR}/scripts/lib/wiki-fs-adapter.cjs"

if [ ! -f "$ENTRY" ]; then
  echo "[wiki-refactoring] wikey-core build 필요: cd wikey-core && npm run build" >&2
  exit 2
fi

cd "$PROJECT_DIR"

node -e "
  const { getRefactoringSuggestions } = require('$ENTRY')
  const { createWikiFS } = require('$ADAPTER')
  const wikiFS = createWikiFS(process.cwd(), { writable: false })
  getRefactoringSuggestions(wikiFS).then((r) => {
    console.log(JSON.stringify(r))
  }).catch((e) => { console.error(e); process.exit(2) })
"
