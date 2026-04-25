#!/usr/bin/env python3
"""audit-ingest.py — raw/ 문서 파일 중 wiki/sources/에 대응 페이지가 없는 항목 감지.

Usage:
  ./scripts/audit-ingest.sh              # 미인제스트 목록 출력
  ./scripts/audit-ingest.sh --summary    # 요약만 출력
  ./scripts/audit-ingest.sh --json       # JSON 출력 (플러그인 연동용)

§5.3.1/§5.3.2 (plan v11) — JSON 출력 5 신규 array (additive only — 기존 키 보존):
  • orphan_sidecars                : sidecar `.md` 만 있고 원본 부재 (시나리오 C)
  • source_modified_since_ingest   : registry.hash != disk raw bytes hash
  • sidecar_modified_since_ingest  : registry.sidecar_hash != disk sidecar NFC hash
  • duplicate_hash                 : 같은 hash 다른 path (registry.duplicate_locations 포함)
  • pending_protections            : registry.pending_protections snapshot

NFC 정규화 (P2-7): sidecar `.md` 본문은 unicodedata.normalize('NFC', content) 후
utf-8 encode → sha256. TS computeSidecarHash 와 동등.
"""
import hashlib
import os
import sys
import json
import re
import unicodedata
from pathlib import Path

# §5.3.1/§5.3.2 (plan v11) — fixture smoke 지원: WIKEY_AUDIT_ROOT env 로 ROOT override 가능.
# 미지정 시 기본 = repo root (이 파일의 부모의 부모).
_env_root = os.environ.get("WIKEY_AUDIT_ROOT")
ROOT = Path(_env_root).resolve() if _env_root else Path(__file__).resolve().parent.parent
# 인제스트 대상 폴더만 포함. `raw/_delayed` (보류) 와 `raw/9_assets` (이미지 첨부) 는
# audit 목록·카운트 양쪽에서 제외 — 인제스트 대상 아닌 파일은 대시보드·audit 에 노출 X.
RAW_DIRS = ["raw/0_inbox", "raw/1_projects", "raw/2_areas", "raw/3_resources", "raw/4_archive"]
WIKI_SOURCES = ROOT / "wiki" / "sources"

# ── Phase 4 D.0.d (v6 §4.2): runtime capability bridge ──
# 플러그인이 onLayoutReady 에서 덤프한 ~/.cache/wikey/capabilities.json 을 읽어 동일한
# 소스로 SUPPORTED/UNSUPPORTED 확장자 판정. 파일 없거나 깨지면 기본값 fallback.
CAPABILITIES_CACHE = Path.home() / ".cache" / "wikey" / "capabilities.json"


def load_capability_map() -> tuple[set[str], set[str], dict]:
    """Returns (supported, unsupported, capabilities_meta).
    Fallback: 플러그인 미실행 환경에서도 기본 동작 (md/txt/pdf 만 supported).
    """
    if CAPABILITIES_CACHE.exists():
        try:
            data = json.loads(CAPABILITIES_CACHE.read_text(encoding="utf-8"))
            supported = {e.lower() for e in data.get("supported", [])}
            unsupported = {e.lower() for e in data.get("unsupported", [])}
            meta = {
                "doclingInstalled": bool(data.get("doclingInstalled", False)),
                "unhwpInstalled": bool(data.get("unhwpInstalled", False)),
                "generatedAt": data.get("generatedAt", ""),
                "source": "cache",
            }
            return supported, unsupported, meta
        except (json.JSONDecodeError, OSError):
            pass
    # Fallback — 캐시 없음/깨짐. docling/unhwp 미설치 가정으로 보수적.
    return (
        {".md", ".txt", ".pdf"},
        {".doc", ".ppt", ".xls"},
        {"doclingInstalled": False, "unhwpInstalled": False, "generatedAt": "", "source": "fallback"},
    )


SUPPORTED_EXTS, UNSUPPORTED_EXTS, CAPABILITIES_META = load_capability_map()
DOC_EXTS = SUPPORTED_EXTS | UNSUPPORTED_EXTS  # 스캔 대상 총집합


def normalize(name: str) -> str:
    name = name.lower()
    name = re.sub(r"[^a-z0-9가-힣]", "-", name)
    name = re.sub(r"-+", "-", name).strip("-")
    return name


def load_ingest_map() -> set[str]:
    """Load ingested raw paths from wiki/.ingest-map.json."""
    map_path = ROOT / "wiki" / ".ingest-map.json"
    if not map_path.exists():
        return set()
    try:
        data = json.loads(map_path.read_text(encoding="utf-8"))
        return set(data.keys())
    except (json.JSONDecodeError, OSError):
        return set()


# ── §5.3.1/§5.3.2 (plan v11) — registry-driven hash diff helpers ──

REGISTRY_PATH = ".wikey/source-registry.json"


def load_registry() -> dict:
    """Load .wikey/source-registry.json. Returns {} on missing/corrupt."""
    p = ROOT / REGISTRY_PATH
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def file_hash(p: Path) -> str | None:
    """sha256 hex of raw file bytes. Returns None if read fails."""
    try:
        h = hashlib.sha256()
        with p.open("rb") as f:
            while chunk := f.read(8192):
                h.update(chunk)
        return h.hexdigest()
    except OSError:
        return None


def sidecar_hash_nfc(p: Path) -> str | None:
    """sha256 of NFC-normalized utf-8 sidecar body (matches TS computeSidecarHash)."""
    try:
        content = p.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None
    nfc = unicodedata.normalize("NFC", content)
    return hashlib.sha256(nfc.encode("utf-8")).hexdigest()


def load_wiki_sources() -> set[str]:
    keys = set()
    if not WIKI_SOURCES.is_dir():
        return keys
    for f in WIKI_SOURCES.glob("*.md"):
        keys.add(f.stem)                   # source-xxx
        keys.add(normalize(f.stem))        # normalized
    return keys


def scan_raw_docs() -> list[Path]:
    docs = []
    for d in RAW_DIRS:
        full = ROOT / d
        if not full.is_dir():
            continue
        for root, dirs, files in os.walk(full):
            # skip _processed, _archive 등
            dirs[:] = [x for x in dirs if not x.startswith("_")]
            for fname in files:
                if Path(fname).suffix.lower() in DOC_EXTS:
                    docs.append(Path(root) / fname)
    return docs


def match(normalized_name: str, wiki_keys: set[str]) -> bool:
    source_key = f"source-{normalized_name}"
    for key in wiki_keys:
        if key == source_key:
            return True
        # 부분 매칭 (긴 파일명의 핵심 부분이 겹치면)
        key_core = key.replace("source-", "")
        if len(key_core) > 3 and len(normalized_name) > 3:
            if key_core in normalized_name or normalized_name in key_core:
                return True
    return False


def main():
    mode = "full"
    for arg in sys.argv[1:]:
        if arg == "--summary":
            mode = "summary"
        elif arg == "--json":
            mode = "json"

    wiki_keys = load_wiki_sources()
    ingest_map = load_ingest_map()
    all_docs = scan_raw_docs()
    registry = load_registry()

    missing: list[Path] = []
    unsupported_docs: list[Path] = []
    ingested_files: list[Path] = []
    # per-folder counters
    folder_total: dict[str, int] = {}
    folder_ingested: dict[str, int] = {}

    for doc in all_docs:
        rel = str(doc.relative_to(ROOT))
        # determine PARA folder key
        parts = rel.split("/")
        folder_key = parts[1] if len(parts) >= 2 else "other"
        folder_total[folder_key] = folder_total.get(folder_key, 0) + 1
        ext = doc.suffix.lower()

        # Phase 4 D.0.d — unsupported extension 우선 분기. ingest-map/wiki 매칭 전에 처리.
        # (unsupported 가 이미 wiki 에 들어가 있을 일은 거의 없음.)
        if ext in UNSUPPORTED_EXTS and ext not in SUPPORTED_EXTS:
            unsupported_docs.append(doc)
            continue

        # 1순위: ingest-map.json에 기록된 경로
        if rel in ingest_map:
            ingested_files.append(doc)
            folder_ingested[folder_key] = folder_ingested.get(folder_key, 0) + 1
            continue
        # 2순위: 파일명 기반 fuzzy matching
        name = normalize(doc.stem)
        if match(name, wiki_keys):
            ingested_files.append(doc)
            folder_ingested[folder_key] = folder_ingested.get(folder_key, 0) + 1
        else:
            missing.append(doc)

    ingested = len(ingested_files)

    total = len(all_docs)
    missing_count = len(missing)
    unsupported_count = len(unsupported_docs)

    # build per-folder summary
    folders = {}
    for key in folder_total:
        ft = folder_total[key]
        fi = folder_ingested.get(key, 0)
        folders[key] = {"total": ft, "ingested": fi, "missing": ft - fi}

    def entry(doc: Path, status: str) -> dict:
        return {
            "path": str(doc.relative_to(ROOT)),
            "name": doc.name,
            "normalized": normalize(doc.stem),
            "status": status,
        }

    entries = [entry(d, "missing") for d in missing] + [entry(d, "unsupported") for d in unsupported_docs]

    # ── §5.3.1/§5.3.2 (plan v11) — 5 신규 array (additive only) ──
    orphan_sidecars: list[str] = []
    source_modified_since_ingest: list[str] = []
    sidecar_modified_since_ingest: list[str] = []
    pending_protections: list[dict] = []
    duplicate_hash_groups: dict[str, list[str]] = {}

    # Walk registry: per-record hash diff + duplicates + pending.
    for sid, record in registry.items():
        if not isinstance(record, dict):
            continue
        if record.get("tombstone"):
            continue
        vault_path = record.get("vault_path")
        sidecar_vault = record.get("sidecar_vault_path")
        registry_hash = record.get("hash")
        registry_sidecar_hash = record.get("sidecar_hash")

        # source_modified_since_ingest
        if vault_path and registry_hash:
            disk = ROOT / vault_path
            if disk.is_file():
                disk_hash = file_hash(disk)
                if disk_hash and disk_hash != registry_hash:
                    source_modified_since_ingest.append(vault_path)

        # sidecar_modified_since_ingest
        if sidecar_vault and registry_sidecar_hash:
            disk = ROOT / sidecar_vault
            if disk.is_file():
                computed = sidecar_hash_nfc(disk)
                if computed and computed != registry_sidecar_hash:
                    sidecar_modified_since_ingest.append(sidecar_vault)

        # duplicate_hash: canonical + duplicate_locations grouped by hash
        if registry_hash:
            canonical_paths = [vault_path] if vault_path else []
            dup_paths = list(record.get("duplicate_locations") or [])
            all_paths = canonical_paths + dup_paths
            if len(all_paths) >= 2:
                duplicate_hash_groups[registry_hash] = sorted(set(all_paths))

        # pending_protections snapshot
        for pp in record.get("pending_protections") or []:
            if isinstance(pp, dict):
                pending_protections.append(pp)

    # orphan_sidecars: sidecar .md 가 disk 에 있고 paired 원본이 부재 + ingest-map 에 등록도 안 됨.
    # raw/* 트리 walk 에서 .md 파일 중 sibling 이 동일한 base name 의 다른 ext 가 부재한 것.
    sidecar_candidates: list[Path] = []
    for d in RAW_DIRS:
        full = ROOT / d
        if not full.is_dir():
            continue
        for root, dirs, files in os.walk(full):
            dirs[:] = [x for x in dirs if not x.startswith("_")]
            for fname in files:
                if fname.lower().endswith(".md"):
                    sidecar_candidates.append(Path(root) / fname)
    for sc in sidecar_candidates:
        # sidecar pattern: <base>.<ext>.md (e.g. x.pdf.md). Strip .md → must contain another ext.
        stem = sc.name[:-3]  # strip .md
        if "." not in stem:
            continue  # plain markdown (e.g. note.md), not a sidecar
        original = sc.parent / stem
        if not original.exists():
            rel = str(sc.relative_to(ROOT))
            # also miss in ingest-map (defensive)
            if rel not in ingest_map:
                orphan_sidecars.append(rel)

    duplicate_hash = [
        {"hash": h, "paths": paths} for h, paths in sorted(duplicate_hash_groups.items())
    ]

    if mode == "json":
        print(json.dumps({
            "total_documents": total,
            "ingested": ingested,
            "missing": missing_count,
            "unsupported": unsupported_count,
            "folders": folders,
            # backward compat: 기존 UI 는 `files` 를 missing path string[] 로 소비
            "files": [str(f.relative_to(ROOT)) for f in missing],
            "ingested_files": [str(f.relative_to(ROOT)) for f in ingested_files],
            # 신규: unsupported 행 렌더용
            "unsupported_files": [str(f.relative_to(ROOT)) for f in unsupported_docs],
            "entries": entries,
            "capabilities": CAPABILITIES_META,
            # ── §5.3.1/§5.3.2 (plan v11) 신규 array — additive only ──
            "orphan_sidecars": sorted(orphan_sidecars),
            "source_modified_since_ingest": sorted(source_modified_since_ingest),
            "sidecar_modified_since_ingest": sorted(sidecar_modified_since_ingest),
            "duplicate_hash": duplicate_hash,
            "pending_protections": pending_protections,
        }, ensure_ascii=False, indent=2))
    elif mode == "summary":
        print(f"문서 총: {total}개 | 인제스트됨: {ingested}개 | 미인제스트: {missing_count}개 | 미지원: {unsupported_count}개")
    else:
        print("=== 미인제스트 문서 감지 ===")
        print(f"문서 총: {total}개 | 인제스트됨: {ingested}개 | 미인제스트: {missing_count}개 | 미지원: {unsupported_count}개")
        print()
        if missing_count == 0 and unsupported_count == 0:
            print("모든 문서가 인제스트되어 있습니다.")
        else:
            if missing_count:
                print("--- 미인제스트 파일 목록 ---")
                for f in missing:
                    size_kb = f.stat().st_size // 1024
                    rel = f.relative_to(ROOT)
                    print(f"  {rel} ({size_kb}KB)")
                print()
                print("인제스트하려면: Wikey [+] 버튼 또는 Cmd+Shift+I")
            if unsupported_count:
                print()
                print("--- 미지원 파일 목록 (converter 없음) ---")
                for f in unsupported_docs:
                    rel = f.relative_to(ROOT)
                    print(f"  {rel}")
                if not CAPABILITIES_META.get("doclingInstalled"):
                    print("  ▶ Docling 설치: uv tool install docling")
                if not CAPABILITIES_META.get("unhwpInstalled"):
                    print("  ▶ unhwp 설치: pip install unhwp")


if __name__ == "__main__":
    main()
