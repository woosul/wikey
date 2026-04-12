#!/usr/bin/env python3
"""
Contextual Retrieval for qmd — Gemma 4 via Ollama로 맥락 프리픽스 생성.

Anthropic의 Contextual Retrieval 기법을 구현:
각 청크에 50-100토큰의 맥락 설명을 prepend하여 BM25 + 벡터 검색 품질 향상.

Usage:
  # 모든 문서에 대해 프리픽스 생성 (캐시에 저장)
  python3 scripts/contextual-retrieval.py --generate

  # 프리픽스를 FTS5 body에 적용 (korean-tokenize.py --batch 전에 실행)
  python3 scripts/contextual-retrieval.py --apply-fts

  # 생성 + 적용 한번에
  python3 scripts/contextual-retrieval.py --batch

  # 프리픽스 샘플 확인
  python3 scripts/contextual-retrieval.py --verify

  # 특정 문서만 프리픽스 생성
  python3 scripts/contextual-retrieval.py --generate --path "entities/esc.md"
"""

import sys
import json
import argparse
import sqlite3
import os
import time
import urllib.request
import urllib.error
from pathlib import Path

# ---------------------------------------------------------------------------
# Configuration (wikey.conf → 환경변수 → 기본값)
# ---------------------------------------------------------------------------

def _load_wikey_conf():
    """wikey.conf에서 설정 로드 (환경변수 미설정 시)."""
    conf = Path(__file__).resolve().parent.parent / "local-llm" / "wikey.conf"
    if not conf.exists():
        return
    for line in conf.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.split("#")[0].strip()
        if key and value and key not in os.environ:
            os.environ[key] = value

_load_wikey_conf()

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("CONTEXTUAL_MODEL", "gemma4")
CACHE_DIR = Path(os.path.expanduser("~/.cache/qmd"))
CACHE_FILE = CACHE_DIR / "contextual-prefixes.json"
DB_PATH = os.path.expanduser("~/.cache/qmd/index.sqlite")
NUM_PREDICT = 1024  # Gemma 4 thinking uses ~400-500 tokens + ~100 response
TEMPERATURE = 0

PROMPT_TEMPLATE = """\
<document>
{document}
</document>

Here is a chunk from the above document:
<chunk>
{chunk}
</chunk>

Please give a short succinct context (50-100 tokens) to situate this chunk \
within the overall document for improving search retrieval.

CRITICAL: The context MUST be bilingual.
- If the document is in English, write the context in Korean AND include the original English key terms in parentheses.
  Example: "라즈베리 파이 고화질 카메라 (Raspberry Pi High Quality Camera)의 백 포커스 조정 (back focus adjustment) 방법을 설명하는 문서..."
- If the document is in Korean, include English translations of technical terms in parentheses.
  Example: "DJI O3 에어 유닛 (Air Unit)의 디지털 영상 전송 (digital video transmission) 사양..."
- Always include both Korean and English versions of product names, technical terms, and key concepts.

Answer only with the context, nothing else."""


# ---------------------------------------------------------------------------
# Ollama API
# ---------------------------------------------------------------------------

def call_ollama(prompt: str, model: str = OLLAMA_MODEL) -> str:
    """Call Ollama chat API and return the response text."""
    payload = json.dumps({
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "options": {
            "num_predict": NUM_PREDICT,
            "temperature": TEMPERATURE,
        },
    }).encode("utf-8")

    req = urllib.request.Request(
        f"{OLLAMA_URL}/api/chat",
        data=payload,
        headers={"Content-Type": "application/json"},
    )

    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("message", {}).get("content", "").strip()
    except urllib.error.URLError as e:
        print(f"  Ollama API error: {e}", file=sys.stderr)
        return ""


# ---------------------------------------------------------------------------
# Cache management
# ---------------------------------------------------------------------------

def load_cache() -> dict:
    """Load prefix cache from JSON file."""
    if CACHE_FILE.exists():
        try:
            return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return {}
    return {}


def save_cache(cache: dict):
    """Save prefix cache to JSON file."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    CACHE_FILE.write_text(
        json.dumps(cache, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# Document/chunk operations
# ---------------------------------------------------------------------------

def get_documents(db_path: str, path_filter: str = None) -> list[dict]:
    """Read all active documents from qmd database.

    Returns list of {hash, path, collection, title, body}.
    """
    db = sqlite3.connect(db_path)
    db.row_factory = sqlite3.Row

    query = """
        SELECT d.hash, d.path, d.collection, d.title, c.doc as body
        FROM documents d
        JOIN content c ON d.hash = c.hash
        WHERE d.active = 1
    """
    params = []
    if path_filter:
        query += " AND d.path LIKE ?"
        params.append(f"%{path_filter}%")

    rows = db.execute(query, params).fetchall()
    result = [dict(r) for r in rows]
    db.close()
    return result


def generate_prefix(document_body: str, chunk_text: str) -> str:
    """Generate a contextual prefix for a chunk using Gemma 4."""
    prompt = PROMPT_TEMPLATE.format(
        document=document_body,
        chunk=chunk_text,
    )
    return call_ollama(prompt)


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_generate(db_path: str, path_filter: str = None, force: bool = False):
    """Generate contextual prefixes for all documents."""
    documents = get_documents(db_path, path_filter)
    if not documents:
        print("No documents found.", file=sys.stderr)
        return

    cache = load_cache()
    generated = 0
    skipped = 0
    errors = 0
    total = len(documents)

    print(f"Generating prefixes for {total} documents...", file=sys.stderr)

    for i, doc in enumerate(documents):
        doc_hash = doc["hash"]

        # For small documents (most wikey docs), the whole doc is one "chunk"
        # Use hash as cache key (no seq needed for single-chunk docs)
        cache_key = doc_hash

        if cache_key in cache and not force:
            skipped += 1
            print(
                f"  [{i+1}/{total}] CACHED {doc['path']}",
                file=sys.stderr,
            )
            continue

        body = doc["body"]
        if not body or not body.strip():
            skipped += 1
            continue

        print(
            f"  [{i+1}/{total}] Generating: {doc['path']}...",
            file=sys.stderr,
            end="",
        )
        start = time.time()

        # For documents that fit in one chunk, use full doc as both doc and chunk
        prefix = generate_prefix(body, body)

        elapsed = time.time() - start

        if prefix:
            cache[cache_key] = {
                "prefix": prefix,
                "path": doc["path"],
                "model": OLLAMA_MODEL,
                "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
            generated += 1
            print(f" OK ({elapsed:.1f}s, {len(prefix)} chars)", file=sys.stderr)
        else:
            errors += 1
            print(f" FAILED ({elapsed:.1f}s)", file=sys.stderr)

    save_cache(cache)
    print(
        f"\nDone. Generated: {generated}, Cached: {skipped}, Errors: {errors}",
        file=sys.stderr,
    )


def cmd_apply_fts(db_path: str):
    """Rebuild FTS5 body from content.doc with contextual prefixes prepended.

    Pipeline order: apply-fts → korean-tokenize.py --batch
    This function resets FTS5 to raw content + prefix, then Korean tokenizer runs on top.
    """
    cache = load_cache()
    if not cache:
        print("No prefix cache found. Run --generate first.", file=sys.stderr)
        sys.exit(1)

    db = sqlite3.connect(db_path)

    # Build hash→prefix lookup
    hash_to_prefix = {}
    for key, entry in cache.items():
        if isinstance(entry, dict) and "prefix" in entry:
            hash_to_prefix[key] = entry["prefix"]

    # Rebuild FTS5 from content.doc (raw) + prefix
    rows = db.execute("""
        SELECT d.id, d.collection || '/' || d.path as filepath,
               d.title, d.hash, c.doc
        FROM documents d
        JOIN content c ON d.hash = c.hash
        WHERE d.active = 1
    """).fetchall()

    # Clear and rebuild FTS5
    db.execute("DELETE FROM documents_fts")

    applied = 0
    total = 0
    for doc_id, filepath, title, doc_hash, raw_body in rows:
        if not raw_body:
            continue
        total += 1

        prefix = hash_to_prefix.get(doc_hash)
        body = f"{prefix}\n\n{raw_body}" if prefix else raw_body

        db.execute(
            "INSERT INTO documents_fts(rowid, filepath, title, body) VALUES (?, ?, ?, ?)",
            (doc_id, filepath, title, body),
        )
        if prefix:
            applied += 1

    db.commit()
    db.close()
    print(
        f"Rebuilt FTS5: {applied}/{total} entries with prefix. "
        f"Run korean-tokenize.py --batch next.",
        file=sys.stderr,
    )


def cmd_verify(db_path: str, count: int = 5):
    """Show sample prefixes for manual inspection."""
    cache = load_cache()
    if not cache:
        print("No prefix cache found. Run --generate first.", file=sys.stderr)
        return

    entries = list(cache.items())[:count]
    for key, entry in entries:
        if not isinstance(entry, dict):
            continue
        print(f"--- {entry.get('path', key)} ---")
        print(f"Prefix: {entry.get('prefix', '(none)')}")
        print(f"Model: {entry.get('model', '?')}")
        print(f"Generated: {entry.get('generated_at', '?')}")
        print()


def cmd_batch(db_path: str, path_filter: str = None, force: bool = False):
    """Generate prefixes + apply to FTS5."""
    cmd_generate(db_path, path_filter, force)
    cmd_apply_fts(db_path)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Contextual Retrieval — Gemma 4로 맥락 프리픽스 생성",
    )
    parser.add_argument(
        "--generate", action="store_true",
        help="Generate prefixes for all documents",
    )
    parser.add_argument(
        "--apply-fts", action="store_true",
        help="Apply prefixes to FTS5 body entries",
    )
    parser.add_argument(
        "--batch", action="store_true",
        help="Generate + apply-fts in one step",
    )
    parser.add_argument(
        "--verify", action="store_true",
        help="Show sample prefixes for inspection",
    )
    parser.add_argument(
        "--path", default=None,
        help="Filter by document path (substring match)",
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Regenerate even if cached",
    )
    parser.add_argument(
        "--db", default=DB_PATH,
        help=f"SQLite database path (default: {DB_PATH})",
    )
    parser.add_argument(
        "--count", type=int, default=5,
        help="Number of samples to show in --verify (default: 5)",
    )
    args = parser.parse_args()

    if not os.path.exists(args.db):
        print(f"Error: database not found at {args.db}", file=sys.stderr)
        sys.exit(1)

    if args.batch:
        cmd_batch(args.db, args.path, args.force)
    elif args.generate:
        cmd_generate(args.db, args.path, args.force)
    elif args.apply_fts:
        cmd_apply_fts(args.db)
    elif args.verify:
        cmd_verify(args.db, args.count)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
