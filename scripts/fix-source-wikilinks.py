#!/usr/bin/env python3
"""fix-source-wikilinks.py — §5.3 follow-up #11 일괄 fix.

이전 canonicalizer 버전이 만든 entity/concept '## 출처' 의 `[[<basename without ext>]]`
형식 wikilink (Obsidian metadataCache unresolved) 를 alias 형식 `[[<sidecar path>|<basename>]]`
으로 변환한다.

Source 결정 방법:
  1. wiki/sources/source-*.md frontmatter 의 `vault_path` (raw 파일 경로) 와
     `sidecar_vault_path` 를 읽어 mapping 을 만든다.
  2. entity/concept page 의 `## 출처` 섹션 안 `[[<basename>]]` 줄을 찾는다.
  3. basename 이 raw 파일 basename (확장자 제거) 과 매칭하면 alias 로 교체.

Idempotent — 이미 alias 형식이면 skip.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WIKI = ROOT / "wiki"
WIKI_SOURCES = WIKI / "sources"
WIKI_ENTITIES = WIKI / "entities"
WIKI_CONCEPTS = WIKI / "concepts"


def parse_frontmatter(text: str) -> dict[str, str]:
    """Minimal frontmatter parser — extracts top-level scalar fields only."""
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---", 4)
    if end < 0:
        return {}
    block = text[4:end]
    out: dict[str, str] = {}
    for line in block.split("\n"):
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$", line)
        if not m:
            continue
        key, val = m.group(1), m.group(2).strip()
        # strip surrounding [...] (yaml flow seq) — used as a single value here
        if val.startswith("[") and val.endswith("]"):
            val = val[1:-1].strip()
        out[key] = val
    return out


def derive_sidecar_path(vault_path: str) -> str:
    """Mirror of TS deriveSidecarPath — md/txt 자체, 그 외 <vault_path>.md."""
    lower = vault_path.lower()
    if lower.endswith(".md") or lower.endswith(".txt"):
        return vault_path
    return f"{vault_path}.md"


def basename_without_ext(path: str) -> str:
    name = path.split("/")[-1]
    if "." in name:
        return name.rsplit(".", 1)[0]
    return name


def build_source_index() -> dict[str, dict[str, str]]:
    """Map raw basename (without ext) → {vault_path, sidecar_ref, display}."""
    idx: dict[str, dict[str, str]] = {}
    if not WIKI_SOURCES.is_dir():
        return idx
    for f in WIKI_SOURCES.glob("source-*.md"):
        try:
            text = f.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        fm = parse_frontmatter(text)
        vault_path = fm.get("vault_path")
        if not vault_path:
            continue
        raw_basename = vault_path.split("/")[-1]                  # e.g. PMS_..pdf
        display = basename_without_ext(raw_basename)              # e.g. PMS_..
        sidecar_ref = derive_sidecar_path(vault_path)             # e.g. raw/.../PMS_..pdf.md
        # multiple keys for matching — both raw filename (with ext) and basename
        idx[display] = {
            "vault_path": vault_path,
            "sidecar_ref": sidecar_ref,
            "display": display,
            "raw_filename": raw_basename,
        }
    return idx


# `## 출처` 섹션 안의 `- [[X]]` 줄에서 X 가 alias 형식이 아닌 단순 basename 일 때만 매칭.
# alias `[[A|B]]` 는 이미 fix 됐으므로 skip.
LINE_RE = re.compile(r"^(- \[\[)([^\]\|]+)(\]\])\s*$", re.MULTILINE)


def fix_page(path: Path, src_index: dict[str, dict[str, str]]) -> bool:
    """Return True when the page was modified."""
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return False
    src_idx_start = text.find("\n## 출처\n")
    if src_idx_start < 0:
        return False
    # operate on the slice from `## 출처` onward
    head = text[:src_idx_start]
    body = text[src_idx_start:]

    def replace(match: re.Match) -> str:
        prefix, link, suffix = match.group(1), match.group(2), match.group(3)
        info = src_index.get(link)
        if not info:
            return match.group(0)  # not a known source — leave it alone
        return f"{prefix}{info['sidecar_ref']}|{info['display']}{suffix}"

    new_body = LINE_RE.sub(replace, body)
    if new_body == body:
        return False
    path.write_text(head + new_body, encoding="utf-8")
    return True


def main() -> int:
    src_index = build_source_index()
    if not src_index:
        print("source index 비어있음. wiki/sources/source-*.md frontmatter 확인 필요.")
        return 0
    print(f"source index: {len(src_index)} entries")
    for k, v in src_index.items():
        print(f"  {k} → {v['sidecar_ref']}")

    changed = 0
    scanned = 0
    for category_dir in (WIKI_ENTITIES, WIKI_CONCEPTS):
        if not category_dir.is_dir():
            continue
        for f in sorted(category_dir.glob("*.md")):
            scanned += 1
            if fix_page(f, src_index):
                rel = f.relative_to(ROOT)
                print(f"  ✅ fixed: {rel}")
                changed += 1
    print(f"\nresult: {changed} fixed, {scanned - changed} unchanged ({scanned} scanned)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
