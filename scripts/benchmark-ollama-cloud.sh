#!/usr/bin/env bash
#
# §5.6.5 Step D — Ollama Cloud cross-provider benchmark orchestrator.
#
# Stages (all resumable; each phase reads/writes idempotent files):
#   1. preflight  — verify ollama signin + 7 fixtures + node harness
#   2. golden     — 42 files (7 fixture × 6 task) via committee trio
#   3. measure    — 1,008 cells (8 model × 7 fixture × 6 task × 3 cycle)
#   4. judge      — 1,008 scores (single judge = gemini-2.5-flash)
#   5. report     — docs/ollama-cloud-benchmark-result.md
#   6. pii-check  — grep result markdown for 6 PII patterns (must be 0)
#
# Usage:
#   ./scripts/benchmark-ollama-cloud.sh [stage]
#   stage ∈ {preflight,golden,measure,judge,report,pii-check,all}
#
# Master LOCK (2026-05-14):
#   - 8 model × 7 fixture × 6 task × 3 cycle = 1,008 measurements
#   - Committee trio = gemini-2.5-flash + claude-3.5-sonnet + gpt-4.1
#   - Single judge   = gemini-2.5-flash
#   - Best-fit       = W1×0.50 acc + W2×0.25 sem + W3×0.10 lat + W4×0.05 cost + W5×0.10 community
#   - Tie-break      = W4 (cost)

set -eo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HARNESS_SRC="$REPO_ROOT/wikey-core/src/scripts/benchmark-models.ts"
HARNESS_BUILT="$REPO_ROOT/wikey-core/dist/scripts/benchmark-models.js"
INBOX="$REPO_ROOT/raw/0_inbox/benchmark-5.6.5"
GOLDEN_DIR="$REPO_ROOT/plan/phase-5/fixtures/cycle-5.6.5-benchmark-golden"
MEASURE_DIR="$REPO_ROOT/plan/phase-5/fixtures/cycle-5.6.5-benchmark-measurements"
JUDGE_DIR="$REPO_ROOT/plan/phase-5/fixtures/cycle-5.6.5-benchmark-judge"
REPORT_PATH="$REPO_ROOT/docs/ollama-cloud-benchmark-result.md"

# LLMClient uses CJS-style `require('node:fs')` for lazy loading. Source paths
# under tsx fail with "require is not defined" in pure ESM, so route through the
# compiled CJS-friendly dist (built by `cd wikey-core && npm run build`).
if [ ! -f "$HARNESS_BUILT" ]; then
  echo "Building wikey-core (dist missing)..." >&2
  (cd "$REPO_ROOT/wikey-core" && npm run build) >&2
fi
if [ ! -f "$HARNESS_BUILT" ]; then
  echo "ERROR: harness build failed: $HARNESS_BUILT" >&2
  exit 2
fi

run_harness() {
  local phase="$1"; shift
  (cd "$REPO_ROOT/wikey-core" && node "$HARNESS_BUILT" "$phase" "$@")
}

stage_preflight() {
  echo "── stage: preflight ─────────────────────────────────────────────"
  local missing=0
  for slug in F1-rohm-wisun F2-rp1-peripherals F3-hwpx-examples F4-business-registration F5-pms-intro F6-goodstream-solutions F7-service-contract; do
    if [ ! -f "$INBOX/$slug.md" ]; then
      echo "  MISSING: $INBOX/$slug.md"
      missing=$((missing+1))
    else
      printf "  ok %s (%d bytes)\n" "$slug.md" "$(wc -c < "$INBOX/$slug.md")"
    fi
  done
  if [ "$missing" -gt 0 ]; then
    echo "ERROR: $missing fixture(s) missing. Re-run setup." >&2
    return 3
  fi
  # Verify ollama signed in (cloud models require it).
  if ! ollama list >/dev/null 2>&1; then
    echo "ERROR: 'ollama list' failed. Is ollama running? Try 'ollama signin'." >&2
    return 4
  fi
  local cloud_models
  cloud_models=$(ollama list 2>/dev/null | awk 'NR>1 {print $1}' | grep -c ':.*cloud' || true)
  if [ "$cloud_models" -lt 5 ]; then
    echo "WARN: only $cloud_models cloud models visible to 'ollama list'. Expected 5." >&2
    echo "      Did you run 'ollama signin'? Continuing anyway." >&2
  fi
  echo "  preflight OK"
}

stage_golden() {
  echo "── stage: golden (42 files via committee trio) ─────────────────"
  mkdir -p "$GOLDEN_DIR"
  run_harness golden
  local n
  n=$(find "$GOLDEN_DIR" -name '*.json' | wc -l | tr -d ' ')
  echo "  golden: $n / 42 files"
}

stage_measure() {
  echo "── stage: measure (1,008 cells) ─────────────────────────────────"
  mkdir -p "$MEASURE_DIR"
  local only="${BENCHMARK_ONLY_MODELS:-}"
  if [ -n "$only" ]; then
    run_harness measure "$only"
  else
    run_harness measure
  fi
  local n
  n=$(find "$MEASURE_DIR" -name '*.json' ! -name '*.judge.json' | wc -l | tr -d ' ')
  echo "  measure: $n cells"
}

stage_judge() {
  echo "── stage: judge (single judge = gemini-2.5-flash) ──────────────"
  mkdir -p "$JUDGE_DIR"
  run_harness judge
  local n
  n=$(find "$JUDGE_DIR" -name '*.judge.json' | wc -l | tr -d ' ')
  echo "  judge: $n scores"
}

stage_report() {
  echo "── stage: report ───────────────────────────────────────────────"
  run_harness report
  if [ ! -f "$REPORT_PATH" ]; then
    echo "ERROR: report not written: $REPORT_PATH" >&2
    return 5
  fi
  echo "  report: $REPORT_PATH ($(wc -l < "$REPORT_PATH" | tr -d ' ') lines)"
}

stage_pii_check() {
  echo "── stage: pii-check (6 patterns must be 0 hits) ────────────────"
  if [ ! -f "$REPORT_PATH" ]; then
    echo "ERROR: report missing — run 'report' stage first." >&2
    return 6
  fi
  local total=0
  for pattern in \
    '01[0-9]-[0-9]{4}-[0-9]{4}' \
    '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' \
    '[0-9]{6}-[1-4][0-9]{6}' \
    '[0-9]{3}-[0-9]{2}-[0-9]{5}' \
    '([0-9]{4}[ -]?){3}[0-9]{4}' \
    '[0-9]{3,6}-[0-9]{2,4}-[0-9]{5,7}'; do
    local hits
    hits=$(grep -Ec "$pattern" "$REPORT_PATH" || true)
    total=$((total + hits))
    printf "  pattern %-50s hits=%d\n" "$pattern" "$hits"
  done
  echo "  total PII hits on report: $total"
  if [ "$total" -gt 0 ]; then
    echo "FAIL: PII detected on report markdown." >&2
    return 7
  fi
  echo "  pii-check PASS"
}

stage_all() {
  stage_preflight
  stage_golden
  stage_measure
  stage_judge
  stage_report
  stage_pii_check
}

main() {
  local stage="${1:-all}"
  case "$stage" in
    preflight) stage_preflight ;;
    golden) stage_golden ;;
    measure) stage_measure ;;
    judge) stage_judge ;;
    report) stage_report ;;
    pii-check) stage_pii_check ;;
    all) stage_all ;;
    *)
      echo "Usage: $0 [preflight|golden|measure|judge|report|pii-check|all]" >&2
      exit 1
      ;;
  esac
}

main "$@"
