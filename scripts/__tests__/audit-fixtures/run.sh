#!/usr/bin/env bash
# audit-ingest fixture smoke — §5.3.1/§5.3.2 (plan v11) 6 cases.
#
# Each case sets up a fresh ROOT in a temp dir, runs `audit-ingest.py --json`,
# and asserts JSON column shape + exit 0. Failure = non-zero exit code at end.
#
# Usage: ./scripts/__tests__/audit-fixtures/run.sh
set -u

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SCRIPT="$( cd "$SCRIPT_DIR/../.." && pwd )/audit-ingest.py"
PASS=0
FAIL=0

# Override audit-ingest's ROOT via symlink trick: copy script + run with sys.path tweak.
# Simpler: monkey-patch ROOT via a wrapper. We use a temp wrapper that imports & overrides.

run_case() {
  local name="$1"
  local fixture_root="$2"
  local assert_fn="$3"
  local out
  out=$(WIKEY_AUDIT_ROOT="$fixture_root" python3 "$SCRIPT" --json)
  local exit_code=$?
  if [ $exit_code -ne 0 ]; then
    echo "  [FAIL] $name — exit=$exit_code"
    FAIL=$((FAIL + 1))
    return
  fi
  if $assert_fn "$out"; then
    echo "  [PASS] $name (exit=0)"
    PASS=$((PASS + 1))
  else
    echo "  [FAIL] $name — assertion failed"
    echo "  Output:"
    echo "$out" | head -30 | sed 's/^/    /'
    FAIL=$((FAIL + 1))
  fi
}

# ── helpers ──
make_clean_fixture() {
  local d="$1"
  mkdir -p "$d/raw/3_resources/30_manual" "$d/wiki/sources" "$d/.wikey" "$d/wiki"
  echo '{}' > "$d/wiki/.ingest-map.json"
  echo '{}' > "$d/.wikey/source-registry.json"
}

write_registry() {
  local file="$1"
  local content="$2"
  printf '%s' "$content" > "$file"
}

# ── case 1: clean state ──
case_clean() {
  local out="$1"
  echo "$out" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ok = (
    d.get('orphan_sidecars') == []
    and d.get('source_modified_since_ingest') == []
    and d.get('sidecar_modified_since_ingest') == []
    and d.get('duplicate_hash') == []
    and d.get('pending_protections') == []
)
sys.exit(0 if ok else 1)
"
}

# ── case 2: orphan sidecar ──
case_orphan() {
  local out="$1"
  echo "$out" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ok = 'raw/3_resources/30_manual/x.pdf.md' in (d.get('orphan_sidecars') or [])
sys.exit(0 if ok else 1)
"
}

# ── case 3: source modified ──
case_source_modified() {
  local out="$1"
  echo "$out" | python3 -c "
import sys, json
d = json.load(sys.stdin)
src = d.get('source_modified_since_ingest') or []
sc = d.get('sidecar_modified_since_ingest') or []
ok = 'raw/3_resources/30_manual/x.pdf' in src and len(sc) == 0
sys.exit(0 if ok else 1)
"
}

# ── case 4: sidecar modified ──
case_sidecar_modified() {
  local out="$1"
  echo "$out" | python3 -c "
import sys, json
d = json.load(sys.stdin)
src = d.get('source_modified_since_ingest') or []
sc = d.get('sidecar_modified_since_ingest') or []
ok = 'raw/3_resources/30_manual/x.pdf.md' in sc and len(src) == 0
sys.exit(0 if ok else 1)
"
}

# ── case 5: duplicate hash ──
case_duplicate() {
  local out="$1"
  echo "$out" | python3 -c "
import sys, json
d = json.load(sys.stdin)
dups = d.get('duplicate_hash') or []
ok = len(dups) >= 1 and len(dups[0].get('paths') or []) >= 2
sys.exit(0 if ok else 1)
"
}

# ── case 6: pending_protections ──
case_pending() {
  local out="$1"
  echo "$out" | python3 -c "
import sys, json
d = json.load(sys.stdin)
pend = d.get('pending_protections') or []
ok = len(pend) >= 1 and pend[0].get('kind') == 'sidecar-md-new'
sys.exit(0 if ok else 1)
"
}

# ── execution ──
echo "audit-ingest fixture smoke — §5.3.1/§5.3.2 plan v11"
TMP=$(mktemp -d -t audit-fixtures-XXXX)
trap "rm -rf $TMP" EXIT

# fixture 1: clean
F1="$TMP/clean"
make_clean_fixture "$F1"
run_case "case 1 — clean state" "$F1" case_clean

# fixture 2: orphan sidecar (sidecar exists, original missing)
F2="$TMP/orphan"
make_clean_fixture "$F2"
echo '# orphan sidecar' > "$F2/raw/3_resources/30_manual/x.pdf.md"
run_case "case 2 — orphan sidecar" "$F2" case_orphan

# fixture 3: source modified (registry hash != disk raw hash)
F3="$TMP/source-modified"
make_clean_fixture "$F3"
echo 'old-content' > "$F3/raw/3_resources/30_manual/x.pdf"
sidecar_body='# sidecar'
sidecar_hash=$(printf '%s' "$sidecar_body" | python3 -c "import sys, hashlib, unicodedata; c=sys.stdin.read(); print(hashlib.sha256(unicodedata.normalize('NFC', c).encode('utf-8')).hexdigest())")
printf '%s' "$sidecar_body" > "$F3/raw/3_resources/30_manual/x.pdf.md"
write_registry "$F3/.wikey/source-registry.json" "$(cat <<EOF
{
  "sha256:fakeid1": {
    "vault_path": "raw/3_resources/30_manual/x.pdf",
    "sidecar_vault_path": "raw/3_resources/30_manual/x.pdf.md",
    "hash": "stale-hash-not-matching-disk",
    "size": 100,
    "first_seen": "2026-04-25T00:00:00Z",
    "ingested_pages": [],
    "path_history": [],
    "tombstone": false,
    "sidecar_hash": "$sidecar_hash"
  }
}
EOF
)"
run_case "case 3 — source modified (raw hash diff)" "$F3" case_source_modified

# fixture 4: sidecar modified (registry sidecar_hash != disk NFC hash)
F4="$TMP/sidecar-modified"
make_clean_fixture "$F4"
raw_content='raw-bytes-stable'
raw_hash=$(printf '%s' "$raw_content" | python3 -c "import sys, hashlib; print(hashlib.sha256(sys.stdin.read().encode('utf-8')).hexdigest())")
printf '%s' "$raw_content" > "$F4/raw/3_resources/30_manual/x.pdf"
echo '# user-edited sidecar' > "$F4/raw/3_resources/30_manual/x.pdf.md"
write_registry "$F4/.wikey/source-registry.json" "$(cat <<EOF
{
  "sha256:fakeid2": {
    "vault_path": "raw/3_resources/30_manual/x.pdf",
    "sidecar_vault_path": "raw/3_resources/30_manual/x.pdf.md",
    "hash": "$raw_hash",
    "size": 100,
    "first_seen": "2026-04-25T00:00:00Z",
    "ingested_pages": [],
    "path_history": [],
    "tombstone": false,
    "sidecar_hash": "stale-sidecar-hash-not-matching-disk"
  }
}
EOF
)"
run_case "case 4 — sidecar modified (sidecar hash diff)" "$F4" case_sidecar_modified

# fixture 5: duplicate hash (canonical + duplicate_locations)
F5="$TMP/duplicate"
make_clean_fixture "$F5"
mkdir -p "$F5/raw/3_resources/30_manual/copy"
echo 'shared-bytes' > "$F5/raw/3_resources/30_manual/x.pdf"
echo 'shared-bytes' > "$F5/raw/3_resources/30_manual/copy/x.pdf"
write_registry "$F5/.wikey/source-registry.json" "$(cat <<EOF
{
  "sha256:fakeid3": {
    "vault_path": "raw/3_resources/30_manual/x.pdf",
    "hash": "shared-hash",
    "size": 100,
    "first_seen": "2026-04-25T00:00:00Z",
    "ingested_pages": [],
    "path_history": [],
    "tombstone": false,
    "duplicate_locations": ["raw/3_resources/30_manual/copy/x.pdf"]
  }
}
EOF
)"
run_case "case 5 — duplicate hash" "$F5" case_duplicate

# fixture 6: pending_protections
F6="$TMP/pending"
make_clean_fixture "$F6"
write_registry "$F6/.wikey/source-registry.json" "$(cat <<EOF
{
  "sha256:fakeid4": {
    "vault_path": "raw/3_resources/30_manual/x.pdf",
    "hash": "h4",
    "size": 100,
    "first_seen": "2026-04-25T00:00:00Z",
    "ingested_pages": [],
    "path_history": [],
    "tombstone": false,
    "pending_protections": [{
      "kind": "sidecar-md-new",
      "path": "raw/3_resources/30_manual/x.pdf.md.new",
      "created_at": "2026-04-25T10:00:00Z",
      "conflict": "sidecar-user-edit"
    }]
  }
}
EOF
)"
run_case "case 6 — pending_protections" "$F6" case_pending

echo
echo "summary: $PASS passed, $FAIL failed"
exit $FAIL
