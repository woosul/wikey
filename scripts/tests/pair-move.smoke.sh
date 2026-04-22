#!/usr/bin/env bash
# pair-move.smoke.sh — Phase 4.2 Stage 2 S2-6 smoke.
# 원본+sidecar pair 가 시스템 이동 시 함께 움직이고, registry 가 즉시 갱신되는지 검증.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SANDBOX="$(mktemp -d -t wikey-pair-smoke.XXXX)"

cleanup() { rm -rf "$SANDBOX"; }
trap cleanup EXIT

ok() { echo "  ✓ $*"; }
fail() { echo "  ✗ $*" >&2; exit 1; }

# Build a minimal sandbox that mirrors a wikey vault layout.
mkdir -p "$SANDBOX/raw/0_inbox" "$SANDBOX/raw/3_resources/30_manual" "$SANDBOX/.wikey" "$SANDBOX/scripts/lib"
cp "$PROJECT_DIR/scripts/classify-inbox.sh" "$SANDBOX/scripts/"
cp "$PROJECT_DIR/scripts/lib/classify-hint.sh" "$SANDBOX/scripts/lib/"
cp "$PROJECT_DIR/scripts/registry-update.mjs" "$SANDBOX/scripts/"
chmod +x "$SANDBOX/scripts/classify-inbox.sh" "$SANDBOX/scripts/registry-update.mjs"

# Seed pair + registry.
echo "pdf-bytes" > "$SANDBOX/raw/0_inbox/test.pdf"
echo "# md sidecar" > "$SANDBOX/raw/0_inbox/test.pdf.md"
cat > "$SANDBOX/.wikey/source-registry.json" <<JSON
{
  "sha256:testid0000000001": {
    "vault_path": "raw/0_inbox/test.pdf",
    "sidecar_vault_path": "raw/0_inbox/test.pdf.md",
    "hash": "0000000000000000000000000000000000000000000000000000000000000001",
    "size": 10,
    "first_seen": "2026-04-22T00:00:00.000Z",
    "ingested_pages": [],
    "path_history": [{"vault_path":"raw/0_inbox/test.pdf","at":"2026-04-22T00:00:00.000Z"}],
    "tombstone": false
  }
}
JSON

# Case 1: classify-inbox.sh --move moves pair + updates registry.
cd "$SANDBOX"
./scripts/classify-inbox.sh --move "test.pdf" "3_resources/30_manual/" >/dev/null 2>&1 \
  || fail "classify-inbox.sh --move failed"
[ -f raw/3_resources/30_manual/test.pdf ] && ok "original moved" || fail "original missing at dest"
[ -f raw/3_resources/30_manual/test.pdf.md ] && ok "sidecar moved" || fail "sidecar missing at dest"
[ ! -f raw/0_inbox/test.pdf ] && ok "original gone from inbox" || fail "original still in inbox"
[ ! -f raw/0_inbox/test.pdf.md ] && ok "sidecar gone from inbox" || fail "sidecar still in inbox"

# Case 2: registry vault_path immediately reflects new location (Obsidian offline).
grep -q '"vault_path": "raw/3_resources/30_manual/test.pdf"' .wikey/source-registry.json \
  && ok "registry vault_path updated" || fail "registry not updated"
grep -q '"sidecar_vault_path": "raw/3_resources/30_manual/test.pdf.md"' .wikey/source-registry.json \
  && ok "registry sidecar_vault_path updated" || fail "sidecar path not updated"

echo ""
echo "pair-move.smoke.sh — ALL PASS (2 cases)"
