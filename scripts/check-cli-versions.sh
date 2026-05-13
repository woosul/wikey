#!/usr/bin/env bash
# §5.6.4.1 A3-2 — CLI version drift detector (v0.4 #1e F4 / v0.5 #1f F5).
#
# Plan: plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md §3.7.1.
#
# Usage:
#   ./scripts/check-cli-versions.sh             # default — major drift fatal, minor warn, patch silent
#   ./scripts/check-cli-versions.sh --strict    # CI / pre-commit / onload — any drift exit 1
#
# Snapshot (mirrors wikey-core/src/provider-cli-options.ts CLI_VERSION_SNAPSHOT):
#   gemini    0.40.1    probedAt=2026-05-13
#   anthropic 2.1.140
#   openai    0.128.0
#
# Exit codes:
#   0 = all CLIs match (or only patch drift in non-strict mode)
#   1 = major drift / strict-mode minor or patch drift / unparseable --version
#   2 = unparseable CLI --version output (silent fail blocked)
#
# Waiver: ./scripts/cli-version-waiver.json
#   { "gemini": "0.41.x", "anthropic": "2.1.142" }
#   Matching pattern (exact / wildcard) skips strict-mode exit + emits NOTE.

set -o pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WAIVER_FILE="${SCRIPT_DIR}/cli-version-waiver.json"

STRICT=0
if [ "${1:-}" = "--strict" ]; then
  STRICT=1
fi

# Snapshot (single source — keep in sync with provider-cli-options.ts).
# macOS ships bash 3.2 (no associative arrays); use lookup functions.
snapshot_for() {
  case "$1" in
    gemini)    echo "0 40 1"   ;;
    anthropic) echo "2 1 140"  ;;
    openai)    echo "0 128 0"  ;;
  esac
}
binary_for() {
  case "$1" in
    gemini)    echo "gemini" ;;
    anthropic) echo "claude" ;;
    openai)    echo "codex"  ;;
  esac
}
# Some CLIs print 'codex-cli 0.128.0' (binary + version) — first semver match suffices.

exit_code=0

# Read waiver pattern for provider (returns empty string if absent).
read_waiver() {
  local provider="$1"
  [ -f "$WAIVER_FILE" ] || { echo ""; return; }
  command -v python3 >/dev/null 2>&1 || { echo ""; return; }
  python3 -c "
import json, sys
try:
    with open('$WAIVER_FILE') as f:
        d = json.load(f)
    print(d.get('$provider', ''))
except Exception:
    print('')
"
}

# Match runtime semver against waiver pattern (supports exact + 'M.m.x' wildcard).
matches_waiver() {
  local pattern="$1"; local runtime="$2"
  [ -z "$pattern" ] && return 1
  if [ "$pattern" = "$runtime" ]; then return 0; fi
  # 'M.m.x' wildcard — match major+minor.
  if echo "$pattern" | grep -qE '^[0-9]+\.[0-9]+\.x$'; then
    local prefix="${pattern%.x}"
    case "$runtime" in
      "${prefix}".*) return 0 ;;
    esac
  fi
  return 1
}

check_cli() {
  local provider="$1"
  local bin
  bin=$(binary_for "$provider")
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "WARN: $provider CLI ($bin) not on PATH — skipped" 1>&2
    return 0
  fi

  local raw
  raw=$("$bin" --version 2>&1 | head -5 || true)

  # Extract first semver triple `\b(\d+)\.(\d+)\.(\d+)\b`.
  local semver
  semver=$(echo "$raw" | grep -oE '\b[0-9]+\.[0-9]+\.[0-9]+\b' | head -1)
  if [ -z "$semver" ]; then
    echo "ERROR: $provider --version output unparseable: $raw" 1>&2
    exit_code=2
    return
  fi

  local runtime_major runtime_minor runtime_patch
  runtime_major="${semver%%.*}"
  local rest="${semver#*.}"
  runtime_minor="${rest%%.*}"
  runtime_patch="${rest#*.}"

  local snap_major snap_minor snap_patch
  read -r snap_major snap_minor snap_patch <<<"$(snapshot_for "$provider")"

  # Waiver check (skip rest of comparison on match).
  local waiver
  waiver=$(read_waiver "$provider")
  if matches_waiver "$waiver" "$semver"; then
    echo "NOTE: $provider drift waived ($waiver) — runtime $semver"
    return
  fi

  if [ "$runtime_major" != "$snap_major" ]; then
    echo "ERROR: $provider CLI major drift (snapshot ${snap_major}.${snap_minor}.${snap_patch}, runtime ${semver}). Re-validate provider-cli-options matrix." 1>&2
    exit_code=1
    return
  fi
  if [ "$runtime_minor" != "$snap_minor" ]; then
    if [ "$STRICT" = "1" ]; then
      echo "ERROR(strict): $provider CLI minor drift (snapshot ${snap_major}.${snap_minor}.${snap_patch}, runtime ${semver})." 1>&2
      exit_code=1
    else
      echo "WARN: $provider CLI minor drift (snapshot ${snap_major}.${snap_minor}.${snap_patch}, runtime ${semver})." 1>&2
    fi
    return
  fi
  if [ "$runtime_patch" != "$snap_patch" ]; then
    if [ "$STRICT" = "1" ]; then
      echo "ERROR(strict): $provider CLI patch drift (snapshot ${snap_major}.${snap_minor}.${snap_patch}, runtime ${semver})." 1>&2
      exit_code=1
    fi
    return
  fi

  # All match.
  return
}

for p in gemini anthropic openai; do
  check_cli "$p"
done

exit $exit_code
