/**
 * §5.7.8 Spec 5 — LLM query rewriter (synonym substitution while preserving meaning).
 *
 * Spec invariants:
 *  - I21 minimal change — edit distance (Levenshtein over tokens) ≤ 50% of original token
 *        count. Violations fall back to the original query with `fallback: 'minimal-change'`.
 *  - I23 fail-open — any LLM throw / timeout / invalid JSON returns the upstream tokens.
 *  - I24 cache namespace `rewrite` (separate from filter / expand caches).
 */

import type { LLMCallOptions } from '../types.js'
import { normalizeCacheKey, QueryFilterCache } from './query-filter-cache.js'
import type { FilterLLM } from './query-intent-filter.js'
import { callWithTimeout, extractJsonObject } from './llm-json-utils.js'

export const DEFAULT_REWRITE_TIMEOUT_MS = 5000
/** Maximum allowed token-level edit distance ratio. ≤ 50% per spec I21. */
export const MAX_REWRITE_EDIT_RATIO = 0.5

/** Bundled rewriter prompt (mirrors `src/prompts/query-rewriter.prompt.md`). */
export const BUNDLED_QUERY_REWRITER_PROMPT = `You are a query rewriter for a personal knowledge wiki. Given a list of *kept* tokens (already filtered for noise), produce a single rewritten query string that improves BM25 recall by adding synonyms / canonical forms — **without changing the user's intent**.

## Constraints (hard)

- Preserve meaning. The rewritten query must answer the same question as the original.
- Minimal change. Add or substitute at most a few tokens. Edit distance ≤ 50% of the original token count is enforced post-hoc; over-aggressive rewrites are rejected and the original is used.
- Keep all \`domain-marker\` tokens verbatim. Synonyms may be appended, not substituted.
- If you are unsure, return the original tokens unchanged.

## Output

Respond with a single JSON object:

\`\`\`json
{
  "rewrittenQuery": "<final query string, space-separated tokens>",
  "changes": [
    { "from": "<original token>", "to": "<replacement>", "reason": "<short reason>" }
  ]
}
\`\`\`

\`changes\` may be \`[]\` if no rewrite was needed.

## Input

Original tokens: {{TOKENS_JSON}}
Original query: {{QUERY}}
`

export type RewriteFallback = 'none' | 'llm-fail' | 'timeout' | 'minimal-change'

export interface RewriteChange {
  readonly from: string
  readonly to: string
  readonly reason: string
}

export interface RewriteDecision {
  readonly originalQuery: string
  readonly rewrittenQuery: string
  readonly changes: readonly RewriteChange[]
  readonly latencyMs: number
  readonly cacheHit: boolean
  readonly fallback: RewriteFallback
}

export interface QueryRewriterOptions {
  readonly llm: FilterLLM
  readonly cache?: QueryFilterCache
  readonly promptTemplate: string
  readonly llmCallOptions?: LLMCallOptions
  readonly timeoutMs?: number
}

export class QueryRewriter {
  constructor(private readonly opts: QueryRewriterOptions) {}

  async rewrite(
    filteredTokens: readonly string[],
    originalQuery: string,
  ): Promise<RewriteDecision> {
    const t0 = Date.now()
    if (filteredTokens.length === 0) {
      return frozen({
        originalQuery,
        rewrittenQuery: originalQuery,
        changes: [],
        latencyMs: Date.now() - t0,
        cacheHit: false,
        fallback: 'none',
      })
    }

    const cacheKey = normalizeCacheKey(filteredTokens.join(' '))
    const cached = this.opts.cache?.get<RewriteDecision>('rewrite', cacheKey)
    if (cached) return { ...cached, cacheHit: true, latencyMs: Date.now() - t0 }

    let raw: string
    try {
      raw = await this.callLLM(filteredTokens, originalQuery)
    } catch (err) {
      const fallback: RewriteFallback =
        (err as Error).name === 'AbortError' || /timeout/i.test((err as Error).message)
          ? 'timeout'
          : 'llm-fail'
      return frozen({
        originalQuery,
        rewrittenQuery: filteredTokens.join(' '),
        changes: [],
        latencyMs: Date.now() - t0,
        cacheHit: false,
        fallback,
      })
    }

    const parsed = parseRewriteResponse(raw)
    if (!parsed || !parsed.rewrittenQuery) {
      return frozen({
        originalQuery,
        rewrittenQuery: filteredTokens.join(' '),
        changes: [],
        latencyMs: Date.now() - t0,
        cacheHit: false,
        fallback: 'llm-fail',
      })
    }

    const ratio = tokenEditRatio(filteredTokens, parsed.rewrittenQuery)
    if (ratio > MAX_REWRITE_EDIT_RATIO) {
      return frozen({
        originalQuery,
        rewrittenQuery: filteredTokens.join(' '),
        changes: [],
        latencyMs: Date.now() - t0,
        cacheHit: false,
        fallback: 'minimal-change',
      })
    }

    const decision: RewriteDecision = frozen({
      originalQuery,
      rewrittenQuery: parsed.rewrittenQuery,
      changes: parsed.changes,
      latencyMs: Date.now() - t0,
      cacheHit: false,
      fallback: 'none',
    })
    this.opts.cache?.set('rewrite', cacheKey, decision)
    return decision
  }

  private async callLLM(
    filteredTokens: readonly string[],
    originalQuery: string,
  ): Promise<string> {
    const prompt = this.opts.promptTemplate
      .split('{{TOKENS_JSON}}').join(JSON.stringify([...filteredTokens]))
      .split('{{QUERY}}').join(originalQuery)
    const timeout =
      this.opts.timeoutMs ??
      this.opts.llmCallOptions?.timeout ??
      DEFAULT_REWRITE_TIMEOUT_MS
    const opts: LLMCallOptions = { ...(this.opts.llmCallOptions ?? {}), timeout }
    return await callWithTimeout(() => this.opts.llm.call(prompt, opts), timeout)
  }
}

interface ParsedRewrite {
  rewrittenQuery: string
  changes: RewriteChange[]
}

export function parseRewriteResponse(text: string): ParsedRewrite | null {
  const obj = extractJsonObject<{ rewrittenQuery?: unknown; changes?: unknown }>(text)
  if (!obj) return null
  const rewrittenQuery = typeof obj.rewrittenQuery === 'string' ? obj.rewrittenQuery.trim() : ''
  if (!rewrittenQuery) return null
  const changes: RewriteChange[] = []
  if (Array.isArray(obj.changes)) {
    for (const c of obj.changes) {
      if (!c || typeof c !== 'object') continue
      const from = String((c as { from?: unknown }).from ?? '')
      const to = String((c as { to?: unknown }).to ?? '')
      const reason = String((c as { reason?: unknown }).reason ?? '')
      if (from && to) changes.push({ from, to, reason })
    }
  }
  return { rewrittenQuery, changes }
}

/**
 * Token-level edit-ratio used to enforce the minimal-change invariant. We compute
 * Levenshtein over tokens (insertion / deletion / substitution = 1) and divide by the
 * original token count. Equal queries → 0; completely different queries → 1.
 */
export function tokenEditRatio(originalTokens: readonly string[], rewritten: string): number {
  const a = [...originalTokens]
  const b = rewritten.split(/\s+/u).filter((t) => t.length > 0)
  if (a.length === 0) return b.length === 0 ? 0 : 1
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 0; i <= a.length; i += 1) dp[i][0] = i
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      )
    }
  }
  return dp[a.length][b.length] / a.length
}

function frozen(decision: RewriteDecision): RewriteDecision {
  return Object.freeze({
    ...decision,
    changes: Object.freeze([...decision.changes]),
  })
}
