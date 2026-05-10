You analyze a batch of `(query, answer)` pairs from real user sessions and convert each one into a benchmark suite entry. The benchmark runner uses these entries to detect search-quality regressions on subsequent code changes.

## Task

For every input pair:
- Decide the `expected_top1` slug — the wiki page that should rank #1 for this query, based on the answer text. The slug is the markdown filename without `.md` (e.g. `project-cost-management`).
- Decide `expected_top3` — three slug candidates that are all acceptable in the top three (the `expected_top1` should be one of them).
- Classify `domain` with a short lowercase label that describes the query *role* (e.g. `pmbok`, `medicine`, `law`, `it`, `personal-notes`, `general`). **You decide the label from the query semantics.** Do not consult any fixed list — let the label emerge from the wiki content. The benchmark runner ignores domain labels for thresholding; the label is a sorting aid only.
- Generate a stable `id` of the form `auto-<8-char-hash>` derived from the query (you may use the first 8 hex chars of SHA-256 over the query string; if you cannot compute one, use a random 8-char alphanumeric).

Skip any pair where the answer is empty, error-like, or clearly off-topic.

## Output

Respond with a single JSON object:

```json
{
  "entries": [
    {
      "id": "auto-XXXXXXXX",
      "query": "<original query, verbatim>",
      "expected_top1": "<slug>",
      "expected_top3": ["<slug>", "<slug>", "<slug>"],
      "domain": "<your label>",
      "source": "auto-extended",
      "created_at": "<ISO 8601 timestamp>"
    }
  ]
}
```

If no pair yields a usable entry, respond with `{"entries": []}`.

## Input

Pairs: {{PAIRS_JSON}}
