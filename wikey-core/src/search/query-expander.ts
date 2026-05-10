/**
 * §5.7.8 Spec 5 — LLM query expander (HyDE + multi-query variants).
 *
 * Spec invariants:
 *  - I22 expand augments — caller unions the multi-queries with the upstream query rather
 *        than substituting them. Original query is always retained.
 *  - I23 fail-open — any failure returns an empty expansion (caller proceeds with upstream).
 *  - I24 cache namespace `expand` (disjoint from filter / rewrite).
 *  - Spec §1.5 acceptance — HyDE 50–200 chars; over-long responses are truncated.
 */

import type { LLMCallOptions } from '../types.js'
import { normalizeCacheKey, QueryFilterCache } from './query-filter-cache.js'
import type { FilterLLM } from './query-intent-filter.js'
import { callWithTimeout, extractJsonObject } from './llm-json-utils.js'

export const DEFAULT_EXPAND_TIMEOUT_MS = 5000
export const HYDE_MIN_CHARS = 50
export const HYDE_MAX_CHARS = 200
export const MULTI_QUERY_DEFAULT_N = 3

/** Bundled expander prompt (mirrors `src/prompts/query-expander.prompt.md`). */
export const BUNDLED_QUERY_EXPANDER_PROMPT = `You are a query expander for a personal knowledge wiki. Generate two complementary expansions for the user's query:

1. **HyDE** — a single hypothetical answer paragraph (50–200 characters) that the ideal wiki page would contain. Used for vector search.
2. **Multi-query** — exactly 3 paraphrased query variants that preserve intent but use different synonyms / framings. Used for query union (multi-query BM25 search).

## Constraints

- HyDE: 50–200 characters in the user's input language. No bullet points, no markdown.
- Multi-query: each variant must remain answerable by the same wiki page as the original.
- If unsure, return shorter / fewer variants rather than fabricating content.

## Output

Respond with a single JSON object:

\`\`\`json
{
  "hypotheticalDoc": "<50-200 char hypothetical answer>",
  "multiQueries": [
    "<variant 1>",
    "<variant 2>",
    "<variant 3>"
  ]
}
\`\`\`

## Input

Query: {{QUERY}}
Kept tokens: {{TOKENS_JSON}}
`

export type ExpandFallback = 'none' | 'llm-fail' | 'timeout'

export interface ExpandDecision {
  readonly originalQuery: string
  readonly hypotheticalDoc?: string
  readonly multiQueries?: readonly string[]
  readonly latencyMs: number
  readonly cacheHit: boolean
  readonly fallback: ExpandFallback
}

export interface QueryExpanderOptions {
  readonly llm: FilterLLM
  readonly cache?: QueryFilterCache
  readonly promptTemplate: string
  readonly llmCallOptions?: LLMCallOptions
  readonly timeoutMs?: number
  readonly multiQueryCount?: number
}

export class QueryExpander {
  constructor(private readonly opts: QueryExpanderOptions) {}

  async expand(
    filteredTokens: readonly string[],
    originalQuery: string,
  ): Promise<ExpandDecision> {
    const t0 = Date.now()
    if (filteredTokens.length === 0 && !originalQuery.trim()) {
      return frozen({
        originalQuery,
        latencyMs: Date.now() - t0,
        cacheHit: false,
        fallback: 'none',
      })
    }

    const cacheKey = normalizeCacheKey(`${originalQuery}::${filteredTokens.join(' ')}`)
    const cached = this.opts.cache?.get<ExpandDecision>('expand', cacheKey)
    if (cached) return { ...cached, cacheHit: true, latencyMs: Date.now() - t0 }

    let raw: string
    try {
      raw = await this.callLLM(filteredTokens, originalQuery)
    } catch (err) {
      const fallback: ExpandFallback =
        (err as Error).name === 'AbortError' || /timeout/i.test((err as Error).message)
          ? 'timeout'
          : 'llm-fail'
      return frozen({
        originalQuery,
        latencyMs: Date.now() - t0,
        cacheHit: false,
        fallback,
      })
    }

    const parsed = parseExpandResponse(raw)
    if (!parsed) {
      return frozen({
        originalQuery,
        latencyMs: Date.now() - t0,
        cacheHit: false,
        fallback: 'llm-fail',
      })
    }

    const truncatedHyde = clampHydeLength(parsed.hypotheticalDoc)
    const multiCount = this.opts.multiQueryCount ?? MULTI_QUERY_DEFAULT_N
    const multi = parsed.multiQueries.slice(0, multiCount)

    const decision: ExpandDecision = frozen({
      originalQuery,
      hypotheticalDoc: truncatedHyde,
      multiQueries: multi.length > 0 ? multi : undefined,
      latencyMs: Date.now() - t0,
      cacheHit: false,
      fallback: 'none',
    })
    this.opts.cache?.set('expand', cacheKey, decision)
    return decision
  }

  private async callLLM(
    filteredTokens: readonly string[],
    originalQuery: string,
  ): Promise<string> {
    const prompt = this.opts.promptTemplate
      .split('{{QUERY}}').join(originalQuery)
      .split('{{TOKENS_JSON}}').join(JSON.stringify([...filteredTokens]))
    const timeout =
      this.opts.timeoutMs ??
      this.opts.llmCallOptions?.timeout ??
      DEFAULT_EXPAND_TIMEOUT_MS
    const opts: LLMCallOptions = { ...(this.opts.llmCallOptions ?? {}), timeout }
    return await callWithTimeout(() => this.opts.llm.call(prompt, opts), timeout)
  }
}

interface ParsedExpand {
  hypotheticalDoc?: string
  multiQueries: string[]
}

export function parseExpandResponse(text: string): ParsedExpand | null {
  const obj = extractJsonObject<{ hypotheticalDoc?: unknown; multiQueries?: unknown }>(text)
  if (!obj) return null
  const hypotheticalDoc =
    typeof obj.hypotheticalDoc === 'string' && obj.hypotheticalDoc.trim().length > 0
      ? obj.hypotheticalDoc.trim()
      : undefined
  const multiQueries: string[] = []
  if (Array.isArray(obj.multiQueries)) {
    for (const q of obj.multiQueries) {
      if (typeof q === 'string' && q.trim().length > 0) multiQueries.push(q.trim())
    }
  }
  if (!hypotheticalDoc && multiQueries.length === 0) return null
  return { hypotheticalDoc, multiQueries }
}

/**
 * Enforce the HyDE length cap (50-200 chars). Below the lower bound we return as-is
 * (LLM was honest about uncertainty); above the upper bound we truncate at a word
 * boundary so the hypothetical paragraph stays readable.
 */
export function clampHydeLength(input: string | undefined): string | undefined {
  if (!input) return undefined
  if (input.length <= HYDE_MAX_CHARS) return input
  const sliced = input.slice(0, HYDE_MAX_CHARS)
  const lastSpace = sliced.lastIndexOf(' ')
  return lastSpace > HYDE_MIN_CHARS ? sliced.slice(0, lastSpace) : sliced
}

function frozen(decision: ExpandDecision): ExpandDecision {
  return Object.freeze({
    ...decision,
    multiQueries: decision.multiQueries ? Object.freeze([...decision.multiQueries]) : undefined,
  })
}
