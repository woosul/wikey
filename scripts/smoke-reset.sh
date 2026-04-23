#!/usr/bin/env bash
# scripts/smoke-reset.sh — Phase 4 통합 smoke clean-slate helper (v6)
# 사용법:
#   smoke-reset.sh init           (smoke 착수 전 1회 — 현재 inbox 를 backup)
#   smoke-reset.sh between-pass   (Pass A 종료 후 · Pass B 시작 전)
#   smoke-reset.sh final          (Pass B 종료 후 — analyses 복원 + backup 삭제)
set -euo pipefail

REPO="/Users/denny/Project/wikey"
BACKUP="/tmp/wikey-smoke-inbox-backup"
ANALYSES_BAK="/tmp/self-extending-wiki.bak.md"
REG=".wikey/source-registry.json"

cd "$REPO"

teardown_moved_files() {
  [ -f "$REG" ] || return 0
  python3 - <<'PY'
import json, os
reg_path = ".wikey/source-registry.json"
try:
    reg = json.load(open(reg_path))
except Exception:
    reg = {}
for _id, r in reg.items():
    vp = r.get("vault_path", "")
    sp = r.get("sidecar_vault_path", "")
    for p in (vp, sp):
        if p and p.startswith("raw/") and os.path.isfile(p):
            try: os.remove(p); print(f"  removed: {p}")
            except Exception as e: print(f"  skip: {p} ({e})")
PY
}

case "${1:-between-pass}" in
  init)
    [ -d "$BACKUP" ] && { echo "ERROR: $BACKUP exists — run 'final' or delete first"; exit 2; }
    mkdir -p "$BACKUP"
    cp -a raw/0_inbox/. "$BACKUP"/
    [ -f wiki/analyses/self-extending-wiki.md ] && cp wiki/analyses/self-extending-wiki.md "$ANALYSES_BAK"
    echo "OK: init done (inbox backed up to $BACKUP, analyses to $ANALYSES_BAK)"
    ;;

  between-pass)
    teardown_moved_files
    rm -f wiki/sources/*.md wiki/entities/*.md wiki/concepts/*.md wiki/analyses/*.md
    git checkout -- wiki/index.md wiki/log.md 2>/dev/null || echo "  note: git checkout skipped (no such files in HEAD)"
    rm -f "$REG" wiki/.ingest-map.json
    ./scripts/reindex.sh --purge >/dev/null 2>&1 || ./scripts/reindex.sh --check >/dev/null 2>&1 || true
    rm -rf raw/0_inbox/*
    cp -a "$BACKUP"/. raw/0_inbox/
    npm run build >/dev/null 2>&1 && npm test --silent >/dev/null 2>&1 || echo "  note: build/test skipped or failed"
    echo "OK: between-pass clean-slate complete"
    ;;

  final)
    [ -f "$ANALYSES_BAK" ] && cp "$ANALYSES_BAK" wiki/analyses/self-extending-wiki.md
    rm -f "$ANALYSES_BAK"
    rm -rf "$BACKUP"
    echo "OK: final cleanup done (analyses restored, backup removed)"
    ;;

  *)
    echo "usage: $0 {init|between-pass|final}" >&2; exit 2
    ;;
esac
