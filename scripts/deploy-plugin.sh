#!/usr/bin/env bash
# §5.6.5 옵션 A v2 (2026-05-14) — deploy wikey-obsidian build to an Obsidian
# vault's `.obsidian/plugins/wikey/` directory.
#
# Why a dedicated script: each developer / contributor may have a different
# vault location. Hardcoding the path in CI / Makefile invites breakage.
# This script reads the target from either:
#   1. `--vault <path>` argv (highest priority)
#   2. `WIKEY_VAULT_PATH` env
#   3. wikey.conf field `WIKEY_VAULT_PATH=<path>`
#
# Copies (idempotent overwrite — Obsidian replaces the existing plugin):
#   - main.js (esbuild output)
#   - styles.css (statusbar chip purple dot + section CSS)
#   - manifest.json (plugin id + version)
#
# Skips: data.json (user state — must not overwrite user settings).
#
# Usage:
#   ./scripts/deploy-plugin.sh --vault ~/Documents/MyVault
#   WIKEY_VAULT_PATH=~/Documents/MyVault ./scripts/deploy-plugin.sh
#   ./scripts/deploy-plugin.sh   # reads WIKEY_VAULT_PATH from wikey.conf

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$REPO_ROOT/wikey-obsidian"
PLUGIN_ID="wikey"

# ── argv parsing ──
VAULT_PATH=""
SKIP_BUILD=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --vault) VAULT_PATH="$2"; shift 2 ;;
    --skip-build) SKIP_BUILD=1; shift ;;
    -h|--help)
      cat <<EOF
Usage: $0 [--vault <path>] [--skip-build]

  --vault <path>    Target Obsidian vault directory (contains .obsidian/).
                    Defaults to \$WIKEY_VAULT_PATH env, then wikey.conf.
  --skip-build      Skip 'npm run build' (assume artifact already current).
EOF
      exit 0
      ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

# ── vault path resolution ──
if [[ -z "$VAULT_PATH" ]]; then
  VAULT_PATH="${WIKEY_VAULT_PATH:-}"
fi
if [[ -z "$VAULT_PATH" && -f "$REPO_ROOT/wikey.conf" ]]; then
  VAULT_PATH="$(grep -E '^WIKEY_VAULT_PATH=' "$REPO_ROOT/wikey.conf" | head -1 | cut -d= -f2- | tr -d '\"' || true)"
fi
if [[ -z "$VAULT_PATH" ]]; then
  echo "ERROR: vault path missing. Provide via --vault, WIKEY_VAULT_PATH env, or wikey.conf." >&2
  exit 2
fi

# Expand tilde + resolve.
VAULT_PATH="${VAULT_PATH/#\~/$HOME}"
if [[ ! -d "$VAULT_PATH" ]]; then
  echo "ERROR: vault directory not found: $VAULT_PATH" >&2
  exit 3
fi
if [[ ! -d "$VAULT_PATH/.obsidian" ]]; then
  echo "ERROR: not an Obsidian vault (no .obsidian/ inside): $VAULT_PATH" >&2
  exit 4
fi

PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/$PLUGIN_ID"

# ── build (unless skipped) ──
if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "[deploy] building wikey-obsidian..."
  (cd "$BUILD_DIR" && npm run build >/dev/null)
fi

# Sanity-check the artifacts exist.
for f in main.js styles.css manifest.json; do
  if [[ ! -f "$BUILD_DIR/$f" ]]; then
    echo "ERROR: build artifact missing: $BUILD_DIR/$f" >&2
    exit 5
  fi
done

# ── deploy ──
mkdir -p "$PLUGIN_DIR"
cp "$BUILD_DIR/main.js" "$PLUGIN_DIR/main.js"
cp "$BUILD_DIR/styles.css" "$PLUGIN_DIR/styles.css"
cp "$BUILD_DIR/manifest.json" "$PLUGIN_DIR/manifest.json"

# Copy kiwi-wasm.wasm if present (Korean tokenizer asset; statusbar chip itself
# doesn't need it, but other plugin features do).
if [[ -f "$BUILD_DIR/kiwi-wasm.wasm" ]]; then
  cp "$BUILD_DIR/kiwi-wasm.wasm" "$PLUGIN_DIR/kiwi-wasm.wasm"
fi

cat <<EOF
[deploy] OK — wikey plugin deployed to:
  $PLUGIN_DIR

Next step (manual): in Obsidian, open Settings → Community plugins, disable
and re-enable "Wikey" (or restart Obsidian) so the new build is loaded.

The Ollama usage statusbar chip will appear in Obsidian's bottom statusbar
the first time you trigger an ollama dispatch (ingest / chat / canonicalize).
EOF
