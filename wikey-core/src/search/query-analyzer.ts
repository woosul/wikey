/**
 * §5.7.8 Spec 3 — auto-extend benchmark suite from real (query, answer) sessions.
 *
 * Spec invariants:
 *  - I11 schema-compatible append — every entry mirrors `runBenchmark`'s `QueryEntry`
 *        shape (`{id, query, expected_top1, expected_top3, domain}`) plus optional
 *        `source` / `created_at` (extra fields ignored by the runner). LLM throw /
 *        timeout / invalid JSON ⇒ no append + `console.warn` (fail-open).
 *  - I15 anchor (k) — domain field is filled by the LLM; this module hardcodes no
 *        domain list / no taxonomy / no role enum. Only the literal `'auto-extended'`
 *        marker for `source` so the runner can later filter.
 */

import {
  existsSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import type { LLMCallOptions } from '../types.js'
import type { FilterLLM } from './query-intent-filter.js'
import { callWithTimeout, extractJsonObject } from './llm-json-utils.js'

export const DEFAULT_ANALYZER_TIMEOUT_MS = 15000
/** Marker value; not a domain list. Allows runners to filter auto vs manual entries. */
export const AUTO_EXTENDED_SOURCE = 'auto-extended'

/** Bundled analyzer prompt (mirrors `src/prompts/query-analyzer.prompt.md`). */
export const BUNDLED_QUERY_ANALYZER_PROMPT = `You analyze a batch of \`(query, answer)\` pairs from real user sessions and convert each one into a benchmark suite entry. The benchmark runner uses these entries to detect search-quality regressions on subsequent code changes.

## Task

For every input pair:
- Decide the \`expected_top1\` slug — the wiki page that should rank #1 for this query, based on the answer text. The slug is the markdown filename without \`.md\` (e.g. \`project-cost-management\`).
- Decide \`expected_top3\` — three slug candidates that are all acceptable in the top three (the \`expected_top1\` should be one of them).
- Classify \`domain\` with a short lowercase label that describes the query *role* (e.g. \`pmbok\`, \`medicine\`, \`law\`, \`it\`, \`personal-notes\`, \`general\`). **You decide the label from the query semantics.** Do not consult any fixed list — let the label emerge from the wiki content. The benchmark runner ignores domain labels for thresholding; the label is a sorting aid only.
- Generate a stable \`id\` of the form \`auto-<8-char-hash>\` derived from the query (you may use the first 8 hex chars of SHA-256 over the query string; if you cannot compute one, use a random 8-char alphanumeric).

Skip any pair where the answer is empty, error-like, or clearly off-topic.

## Output

Respond with a single JSON object:

\`\`\`json
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
\`\`\`

If no pair yields a usable entry, respond with \`{"entries": []}\`.

## Input

Pairs: {{PAIRS_JSON}}
`

export interface QueryAnswerPair {
  readonly query: string
  readonly answer: string
}

export interface AutoExtendedEntry {
  readonly id: string
  readonly query: string
  readonly expected_top1: string
  readonly expected_top3: string[]
  readonly domain: string
  readonly source: typeof AUTO_EXTENDED_SOURCE
  readonly created_at: string
}

export interface AnalyzeResult {
  readonly entries: readonly AutoExtendedEntry[]
  readonly fallback: 'none' | 'llm-fail' | 'timeout'
  readonly latencyMs: number
}

export interface QueryAnalyzerOptions {
  readonly llm: FilterLLM
  readonly promptTemplate: string
  readonly llmCallOptions?: LLMCallOptions
  readonly timeoutMs?: number
}

export class QueryAnalyzer {
  constructor(private readonly opts: QueryAnalyzerOptions) {}

  async analyze(pairs: readonly QueryAnswerPair[]): Promise<AnalyzeResult> {
    const t0 = Date.now()
    if (pairs.length === 0) {
      return { entries: [], fallback: 'none', latencyMs: Date.now() - t0 }
    }
    let raw: string
    try {
      raw = await this.callLLM(pairs)
    } catch (err) {
      const fallback: 'llm-fail' | 'timeout' =
        (err as Error).name === 'AbortError' || /timeout/i.test((err as Error).message)
          ? 'timeout'
          : 'llm-fail'
      console.warn('[query-analyzer] LLM call failed:', (err as Error).message)
      return { entries: [], fallback, latencyMs: Date.now() - t0 }
    }
    const parsed = parseAnalyzerResponse(raw)
    if (!parsed) {
      console.warn('[query-analyzer] failed to parse LLM JSON response.')
      return { entries: [], fallback: 'llm-fail', latencyMs: Date.now() - t0 }
    }
    return { entries: parsed, fallback: 'none', latencyMs: Date.now() - t0 }
  }

  private async callLLM(pairs: readonly QueryAnswerPair[]): Promise<string> {
    const prompt = this.opts.promptTemplate.split('{{PAIRS_JSON}}').join(JSON.stringify(pairs))
    const timeout =
      this.opts.timeoutMs ??
      this.opts.llmCallOptions?.timeout ??
      DEFAULT_ANALYZER_TIMEOUT_MS
    const opts: LLMCallOptions = { ...(this.opts.llmCallOptions ?? {}), timeout }
    return await callWithTimeout(() => this.opts.llm.call(prompt, opts), timeout)
  }
}

export function parseAnalyzerResponse(text: string): AutoExtendedEntry[] | null {
  const obj = extractJsonObject<{ entries?: unknown }>(text)
  if (!obj || !Array.isArray(obj.entries)) return null
  const out: AutoExtendedEntry[] = []
  for (const raw of obj.entries) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const id = String(r.id ?? '').trim()
    const query = String(r.query ?? '').trim()
    const expected_top1 = String(r.expected_top1 ?? '').trim()
    const expected_top3 = Array.isArray(r.expected_top3)
      ? r.expected_top3.map((v) => String(v)).filter((v) => v.length > 0)
      : []
    const domain = String(r.domain ?? '').trim()
    if (!id || !query || !expected_top1 || expected_top3.length === 0 || !domain) continue
    out.push({
      id,
      query,
      expected_top1,
      expected_top3,
      domain,
      source: AUTO_EXTENDED_SOURCE,
      created_at:
        typeof r.created_at === 'string' && r.created_at.length > 0
          ? r.created_at
          : new Date().toISOString(),
    })
  }
  return out
}

/**
 * Append new entries onto an existing `benchmark-suite.json` (Spec 3 schema-compatible).
 * Atomic (tmp + rename). Skips entries whose `id` already exists in the suite.
 */
export function appendEntriesToSuite(
  suitePath: string,
  entries: readonly AutoExtendedEntry[],
): { added: number; skipped: number } {
  if (entries.length === 0) return { added: 0, skipped: 0 }
  if (!existsSync(suitePath)) {
    throw new Error(`benchmark suite not found at ${suitePath}`)
  }
  const text = readFileSync(suitePath, 'utf-8')
  const suite = JSON.parse(text) as {
    queries?: Array<{ id?: string }>
  }
  if (!Array.isArray(suite.queries)) suite.queries = []
  const existingIds = new Set(suite.queries.map((q) => q.id).filter(Boolean) as string[])
  let added = 0
  let skipped = 0
  for (const entry of entries) {
    if (existingIds.has(entry.id)) { skipped += 1; continue }
    suite.queries.push(entry as unknown as { id?: string })
    existingIds.add(entry.id)
    added += 1
  }
  const tmp = `${suitePath}.tmp`
  writeFileSync(tmp, JSON.stringify(suite, null, 2), 'utf-8')
  renameSync(tmp, suitePath)
  return { added, skipped }
}
