#!/usr/bin/env python3
"""
Korean morpheme tokenizer for qmd FTS5 preprocessing.

Usage:
  # Index mode: all morphemes (for FTS5 body)
  echo "위키의 핵심 개념" | python3 scripts/korean-tokenize.py --mode index

  # Query mode: content words only (drop particles/endings)
  echo "위키의" | python3 scripts/korean-tokenize.py --mode query

  # Batch mode: process sqlite FTS5 index
  python3 scripts/korean-tokenize.py --batch
"""

import sys
import argparse
import sqlite3
import os
from pathlib import Path

from kiwipiepy import Kiwi

_kiwi = None

def get_kiwi():
    global _kiwi
    if _kiwi is None:
        _kiwi = Kiwi()
    return _kiwi

# POS tags for content words (keep in both index and query)
CONTENT_POS = {
    'NNG',   # General noun (보통명사)
    'NNP',   # Proper noun (고유명사)
    'NNB',   # Dependent noun (의존명사)
    'NR',    # Numeral (수사)
    'VV',    # Verb (동사)
    'VA',    # Adjective (형용사)
    'VX',    # Auxiliary verb (보조동사)
    'MAG',   # General adverb (일반부사)
    'XR',    # Root (어근)
    'SL',    # Foreign letter (외국어)
    'SN',    # Number (숫자)
    'SH',    # Chinese character (한자)
}

# POS tags to drop in query mode (particles, endings, suffixes)
PARTICLE_POS = {
    'JKS', 'JKC', 'JKG', 'JKO', 'JKB', 'JKV', 'JKQ',  # Case particles
    'JX', 'JC',   # Auxiliary/conjunctive particles
    'EP', 'EF', 'EC', 'ETN', 'ETM',  # Endings
    'VCP', 'VCN',  # Copula
    'XSV', 'XSA', 'XSN',  # Suffixes
    'SF', 'SP', 'SS', 'SE', 'SO', 'SW',  # Punctuation/symbols
}


import re

# Pattern for alphanumeric tokens that should NOT be split by kiwipiepy
# e.g., "BM25", "O3", "5.8GHz", "H264", "FTS5", "sqlite-vec"
_ALNUM_TOKEN = re.compile(r'[A-Za-z0-9][A-Za-z0-9.\-_]*[A-Za-z0-9]|[A-Za-z0-9]')


def _smart_tokenize(text: str):
    """Split text into Korean and non-Korean segments.

    Non-Korean alphanumeric tokens (BM25, O3, 5.8GHz) are preserved as-is.
    Korean segments are tokenized by kiwipiepy.
    """
    kiwi = get_kiwi()
    result = []

    # Split on whitespace first, process each word
    for word in text.split():
        # Check if word is purely alphanumeric (no Korean)
        if _ALNUM_TOKEN.fullmatch(word):
            result.append((word, 'SL'))  # treat as foreign letter
            continue

        # Tokenize with kiwipiepy
        tokens = kiwi.tokenize(word)

        # Post-process: merge adjacent SL/SN tokens (e.g., "BM"+"25" → "BM25")
        merged = []
        for t in tokens:
            if (merged
                    and merged[-1][1] in ('SL', 'SN')
                    and t.tag in ('SL', 'SN')):
                merged[-1] = (merged[-1][0] + t.form, 'SL')
            else:
                merged.append((t.form, t.tag))

        result.extend(merged)

    return result


def tokenize_for_index(text: str) -> str:
    """Tokenize text for FTS5 indexing. All morphemes, space-separated.

    Alphanumeric tokens like BM25, O3, FTS5 are preserved intact.
    """
    tokens = _smart_tokenize(text)
    return ' '.join(form for form, tag in tokens if form.strip())


def tokenize_for_query(text: str) -> str:
    """Tokenize text for FTS5 query. Content words only (drop particles/endings).

    Alphanumeric tokens like BM25, O3, FTS5 are preserved intact.
    """
    tokens = _smart_tokenize(text)
    return ' '.join(
        form for form, tag in tokens
        if tag in CONTENT_POS and form.strip()
    )


def batch_preprocess_fts(db_path: str = None):
    """Post-process qmd FTS5 index with Korean morpheme analysis."""
    if db_path is None:
        db_path = os.path.expanduser('~/.cache/qmd/index.sqlite')

    if not os.path.exists(db_path):
        print(f"Error: database not found at {db_path}", file=sys.stderr)
        sys.exit(1)

    db = sqlite3.connect(db_path)

    # Read all FTS5 entries
    rows = db.execute(
        'SELECT rowid, filepath, title, body FROM documents_fts'
    ).fetchall()

    print(f"Processing {len(rows)} FTS5 entries...", file=sys.stderr)

    processed = 0
    for rowid, filepath, title, body in rows:
        if not body:
            continue

        tokenized_body = tokenize_for_index(body)
        tokenized_title = tokenize_for_index(title) if title else title

        # FTS5: delete old entry, insert preprocessed version
        db.execute('DELETE FROM documents_fts WHERE rowid = ?', (rowid,))
        db.execute(
            'INSERT INTO documents_fts(rowid, filepath, title, body) VALUES (?, ?, ?, ?)',
            (rowid, filepath, tokenized_title, tokenized_body)
        )
        processed += 1

    db.commit()
    db.close()
    print(f"Done. {processed}/{len(rows)} entries preprocessed.", file=sys.stderr)


def build_fts5_query(text: str) -> str:
    """Build FTS5 MATCH query from Korean text.

    Strategy:
    - 1-2 terms: AND (strict match)
    - 3+ terms: OR (BM25 ranks docs with more matches higher)
    """
    words = tokenize_for_query(text).split()
    if not words:
        return ''
    terms = [f'"{w}"*' for w in words]
    joiner = ' AND ' if len(terms) <= 2 else ' OR '
    return joiner.join(terms)


def main():
    parser = argparse.ArgumentParser(description='Korean morpheme tokenizer for qmd FTS5')
    parser.add_argument('--mode', choices=['index', 'query', 'fts5'], default='index',
                        help='index: all morphemes, query: content words, fts5: FTS5 MATCH query')
    parser.add_argument('--batch', action='store_true',
                        help='Batch preprocess qmd FTS5 index')
    parser.add_argument('--db', default=None,
                        help='SQLite database path (default: ~/.cache/qmd/index.sqlite)')
    args = parser.parse_args()

    if args.batch:
        batch_preprocess_fts(args.db)
        return

    # Stdin mode: read text, output tokenized text
    text = sys.stdin.read().strip()
    if not text:
        return

    if args.mode == 'index':
        print(tokenize_for_index(text))
    elif args.mode == 'query':
        print(tokenize_for_query(text))
    elif args.mode == 'fts5':
        print(build_fts5_query(text))


if __name__ == '__main__':
    main()
