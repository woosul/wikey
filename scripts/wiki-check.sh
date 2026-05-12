#!/usr/bin/env bash
# §5.19 Spec 2 — wiki-check thin wrapper.
#
# Orchestrates: validate-wiki.sh + paired-sidecar audit + registry reconcile dry-run
# + dangling cross-link detect via `wikey-core/src/wiki/maintenance/check.ts:runWikiCheck`.
#
# Output:
#   - line-by-line progress to stdout (consumed by MaintenanceModal stream tail).
#   - writes `wiki/analyses/wiki-check-<YYYY-MM-DD>.md` (AC-C2-2).
#   - exit 0 = healthy, exit != 0 = finding count.

# NOTE: `set -e` removed intentionally — we explicitly track each step's exit
# code so failures (validate-wiki / audit-ingest) propagate into the merged
# wiki-check exit code without short-circuiting later detect phases.
trap 'echo "[wiki-check] aborted" >&2' INT TERM

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENTRY="${PROJECT_DIR}/wikey-core/dist/wiki/maintenance.js"
ADAPTER="${PROJECT_DIR}/scripts/lib/wiki-fs-adapter.cjs"
VALIDATE_ENTRY="${PROJECT_DIR}/wikey-core/dist/scripts/validate-wiki.js"

if [ ! -f "$ENTRY" ]; then
  echo "[wiki-check] wikey-core build 필요: cd wikey-core && npm run build" >&2
  exit 2
fi

cd "$PROJECT_DIR"

TODAY="${1:-$(date +%Y-%m-%d)}"
VALIDATE_LOG="$(mktemp -t wiki-check-validate-XXXXXX)"
trap 'rm -f "$VALIDATE_LOG"' EXIT

echo "[wiki-check] validate-wiki running…"
bash "$PROJECT_DIR/scripts/validate-wiki.sh" | tee "$VALIDATE_LOG"
VALIDATE_EXIT="${PIPESTATUS[0]:-0}"

echo "[wiki-check] paired-sidecar audit…"
python3 "$PROJECT_DIR/scripts/audit-ingest.py" --json 2>/dev/null
AUDIT_EXIT="$?"

echo "[wiki-check] reconcile dry-run + dangling detect…"
# NOTE: shell `KEY=VAL command args` form exports KEY only into `command`'s env.
# All three vars (VALIDATE_EXIT / VALIDATE_LOG / AUDIT_EXIT) must precede the
# `node` invocation on the same line so the inline script's `process.env`
# resolves them. Trailing `KEY=VAL` after the command is interpreted by node as
# an argv entry, not an env export (Finding 6, cycle #3).
VALIDATE_EXIT="$VALIDATE_EXIT" VALIDATE_LOG="$VALIDATE_LOG" AUDIT_EXIT="$AUDIT_EXIT" node -e "
  const fs = require('node:fs')
  const { runWikiCheck } = require('$ENTRY')
  const { createWikiFS } = require('$ADAPTER')
  const wikiFS = createWikiFS(process.cwd())

  // Wire validate-wiki outcome from the prior step so the merged exit code +
  // findings list reflect both phases (AC-C2-1 parity).
  const validateExit = Number(process.env.VALIDATE_EXIT || '0')
  const validateLog = process.env.VALIDATE_LOG || ''
  const validateOutcome = {
    exitCode: validateExit,
    findings: validateLog && fs.existsSync(validateLog)
      ? fs.readFileSync(validateLog, 'utf8')
          .split(/\\n/)
          .filter((l) => /^FAIL:/.test(l))
          .map((l) => ({ kind: 'validate-wiki', detail: l.replace(/^FAIL:\\s*/, '') }))
      : [],
  }

  runWikiCheck(wikiFS, { today: '$TODAY', validateWiki: async () => validateOutcome }).then((r) => {
    console.log(JSON.stringify({ exitCode: r.exitCode, findings: r.findings.length, analysisPage: r.analysisPagePath }))
    // Exit code is the maximum of validate-wiki / audit / runWikiCheck exits.
    const auditExit = Number(process.env.AUDIT_EXIT || '0')
    process.exit(Math.max(r.exitCode, auditExit))
  }).catch((e) => { console.error(e); process.exit(2) })
"
