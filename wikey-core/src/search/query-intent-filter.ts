/**
 * §5.7.8 Spec 1 — LLM per-query token role classifier.
 *
 * The class is intentionally thin: tokenize → cache lookup → LLM call → parse → guard.
 * No hardcoded role/keep wordlist anywhere (anchor (k)). All keep/drop decisions come from
 * the LLM response, optionally biased by a vault-supplied `VaultQueryHint`.
 *
 * Spec invariants:
 *  - I1  fail-open (LLM throw / timeout / invalid JSON → original tokens, fallback marker).
 *  - I2  cache key normalization (delegated to `normalizeCacheKey`).
 *  - I3  no hardcoded role mapping — `role` echoed from LLM response.
 *  - I4  no hardcoded keep/drop list — keep flag echoed from LLM response (+ hint override).
 *  - I5  filtered ⊂ input tokens (LLM-introduced novel tokens are discarded).
 *  - I6  all-drop guard — empty filtered list ⇒ original tokens, fallback `'all-drop-guard'`.
 *  - I13 cache hit on second invocation (call counter assertion in tests).
 */

import type { LLMCallOptions } from '../types.js'
import {
  buildVaultHintPromptBlock,
  EMPTY_VAULT_QUERY_HINT,
  type VaultQueryHint,
} from '../config/vault-query-config.js'
import {
  normalizeCacheKey,
  QueryFilterCache,
} from './query-filter-cache.js'
import { callWithTimeout, extractJsonObject } from './llm-json-utils.js'

/** Default filter LLM call timeout — Q3 LOCKED (Gemini-2.5-flash p99 ≈ 3s + safety margin). */
export const DEFAULT_FILTER_TIMEOUT_MS = 5000

/**
 * Bundled query intent filter prompt — inlined mirror of `src/prompts/query-intent-filter.prompt.md`.
 * Inlined so the wikey-obsidian CJS bundle has no runtime file I/O dependency on the wikey-core
 * `src/prompts/` directory. Vault override path: `.wikey/prompts/query-intent-filter.prompt.md`
 * (Spec 6 / loadVaultQueryConfig). When updating either source, keep both in sync.
 */
export const BUNDLED_QUERY_INTENT_FILTER_PROMPT = `You are a query analysis assistant for a personal knowledge wiki. The user has typed a search query and you must classify each token by its semantic role so the search backend can drop only true noise.

## Task

For every token in the input, assign exactly one of these four roles:

- \`domain-marker\` — names a specific domain, framework, standard, organization, person or product. Always keep.
- \`intent-core\` — the verb / noun that carries the user's information need. Always keep.
- \`generic-noise\` — fillers that match almost any document and dilute BM25 scoring (e.g. very generic "guide", "info", "thing", "내용", "자료" when not part of a multiword title). Drop.
- \`disambiguator\` — modifiers that narrow an otherwise generic term within the user's vault. Keep.

You decide the role from the **query semantics**, not from a fixed wordlist. Whether a token is "noise" depends on the surrounding tokens. The same word can be \`domain-marker\` in one query and \`generic-noise\` in another. Do not memorise lists — judge per query.

The wiki may cover any domain (project management, medicine, law, IT, literature, personal notes, etc.). Examples below are *judgement aids*, not a closed taxonomy.

## Vault hint (optional)

If the vault provides hints, treat the listed tokens as preferred \`domain-marker\` / \`priority-keep\` for **this** vault. Hints never override a clearly noisy token, but they break ties.

{{VAULT_HINT_BLOCK}}

## Examples (judgement aids — your output may differ for similar queries)

- \`프로젝트 비용 관리\` → all three are \`intent-core\` for a PM-oriented vault; \`프로젝트\` becomes \`domain-marker\` if vault hint lists it.
- \`당뇨 합병증 예방 가이드\` → \`당뇨\`=\`domain-marker\`, \`합병증\`/\`예방\`=\`intent-core\`, \`가이드\`=\`generic-noise\`.
- \`민법 제3조 적용 사례\` → \`민법\`=\`domain-marker\`, \`제3조\`/\`적용\`=\`intent-core\`, \`사례\`=\`generic-noise\`.
- \`정보 시스템 관리\` → if the vault is a PM vault, \`정보\`/\`시스템\`=\`generic-noise\`, \`관리\`=\`intent-core\`.
- \`PMBOK\` (single token) → \`domain-marker\`.

## Output

Respond with a single JSON object — no prose, no markdown fence around the prose. The schema is:

\`\`\`json
{
  "tokens": [
    { "token": "<original token, exact characters>", "role": "<role>", "keep": <true|false> }
  ]
}
\`\`\`

Rules:
- Include every input token, in input order.
- \`keep = true\` for \`domain-marker\`, \`intent-core\`, \`disambiguator\`. \`keep = false\` for \`generic-noise\`.
- Do not invent new tokens. Do not split or merge tokens.
- If you are unsure, prefer \`keep = true\` (false-positive drops hurt recall).

## Input

Query: {{QUERY}}
Tokens: {{TOKENS_JSON}}
`

export type TokenRole = 'domain-marker' | 'intent-core' | 'generic-noise' | 'disambiguator'

export interface TokenDecision {
  readonly token: string
  readonly role: TokenRole
  readonly keep: boolean
}

export type FilterFallback =
  | 'none'
  | 'llm-fail'
  | 'timeout'
  | 'all-drop-guard'

export interface FilterDecision {
  readonly originalTokens: readonly string[]
  readonly filtered: readonly string[]
  readonly tokens: readonly TokenDecision[]
  readonly rawLLMResponse?: string
  readonly latencyMs: number
  readonly cacheHit: boolean
  readonly fallback: FilterFallback
}

/** Public LLM contract — narrow alias of `LLMClient.call` so test mocks need not pull config. */
export interface FilterLLM {
  call(prompt: string, opts?: LLMCallOptions): Promise<string>
}

export interface QueryIntentFilterOptions {
  readonly llm: FilterLLM
  readonly cache?: QueryFilterCache
  /** Static prompt template (default: bundled or vault override resolved by caller). */
  readonly promptTemplate: string
  /** Tokenize a raw query into morpheme-level tokens (Kiwi WASM in production). */
  readonly tokenize: (query: string) => readonly string[]
  /** LLM call options (timeout, temperature, max_tokens, provider, model). */
  readonly llmCallOptions?: LLMCallOptions
  /** Optional default vault hint applied when `filter()` caller omits one. */
  readonly defaultVaultHint?: VaultQueryHint
  /** Override timeout (ms). Falls back to `llmCallOptions.timeout` then DEFAULT_FILTER_TIMEOUT_MS. */
  readonly timeoutMs?: number
}

interface ParsedLLMResponse {
  readonly tokens: TokenDecision[]
}

export class QueryIntentFilter {
  constructor(private readonly opts: QueryIntentFilterOptions) {}

  async filter(query: string, vaultHint?: VaultQueryHint): Promise<FilterDecision> {
    const t0 = Date.now()
    const inputTokens = this.opts.tokenize(query).filter((t) => t.length > 0)
    const hint = vaultHint ?? this.opts.defaultVaultHint ?? EMPTY_VAULT_QUERY_HINT

    if (inputTokens.length === 0) {
      return decisionFromFallback({
        originalTokens: inputTokens,
        fallback: 'none',
        tokens: [],
        latencyMs: Date.now() - t0,
        cacheHit: false,
      })
    }

    const cacheKey = buildCacheKey(inputTokens, hint)
    const cached = this.opts.cache?.get<FilterDecision>('filter', cacheKey)
    if (cached) {
      return { ...cached, cacheHit: true, latencyMs: Date.now() - t0 }
    }

    let rawResponse: string
    try {
      rawResponse = await this.callLLMWithTimeout(query, inputTokens, hint)
    } catch (err) {
      const fallback: FilterFallback =
        (err as Error).name === 'AbortError' || /timeout/i.test((err as Error).message)
          ? 'timeout'
          : 'llm-fail'
      return decisionFromFallback({
        originalTokens: inputTokens,
        fallback,
        tokens: keepAllTokens(inputTokens),
        latencyMs: Date.now() - t0,
        cacheHit: false,
      })
    }

    const parsed = parseFilterResponse(rawResponse)
    if (!parsed) {
      return decisionFromFallback({
        originalTokens: inputTokens,
        fallback: 'llm-fail',
        tokens: keepAllTokens(inputTokens),
        rawLLMResponse: rawResponse,
        latencyMs: Date.now() - t0,
        cacheHit: false,
      })
    }

    const merged = applyHintAndPreserveInput(inputTokens, parsed.tokens, hint)
    const filtered = merged.filter((t) => t.keep).map((t) => t.token)

    if (filtered.length === 0) {
      return decisionFromFallback({
        originalTokens: inputTokens,
        fallback: 'all-drop-guard',
        tokens: keepAllTokens(inputTokens),
        rawLLMResponse: rawResponse,
        latencyMs: Date.now() - t0,
        cacheHit: false,
      })
    }

    const decision: FilterDecision = {
      originalTokens: Object.freeze([...inputTokens]),
      filtered: Object.freeze(filtered),
      tokens: Object.freeze(merged),
      rawLLMResponse: rawResponse,
      latencyMs: Date.now() - t0,
      cacheHit: false,
      fallback: 'none',
    }
    this.opts.cache?.set('filter', cacheKey, decision)
    return decision
  }

  private async callLLMWithTimeout(
    query: string,
    inputTokens: readonly string[],
    hint: VaultQueryHint,
  ): Promise<string> {
    const prompt = renderFilterPrompt(this.opts.promptTemplate, query, inputTokens, hint)
    const timeout =
      this.opts.timeoutMs ??
      this.opts.llmCallOptions?.timeout ??
      DEFAULT_FILTER_TIMEOUT_MS
    const opts: LLMCallOptions = { ...(this.opts.llmCallOptions ?? {}), timeout }
    return await callWithTimeout(() => this.opts.llm.call(prompt, opts), timeout)
  }
}

function buildCacheKey(tokens: readonly string[], hint: VaultQueryHint): string {
  // Vault hint changes the LLM judgement — keep it in the cache key.
  const hintFingerprint = [
    ...hint.domainMarkers,
    '|',
    ...hint.priorityKeep,
  ]
    .map((s) => s.toLowerCase().trim())
    .join(',')
  return `${normalizeCacheKey(tokens.join(' '))}::${hintFingerprint}`
}

function keepAllTokens(tokens: readonly string[]): TokenDecision[] {
  return tokens.map((token) => ({ token, role: 'intent-core' as TokenRole, keep: true }))
}

function decisionFromFallback(input: {
  originalTokens: readonly string[]
  tokens: readonly TokenDecision[]
  fallback: FilterFallback
  latencyMs: number
  cacheHit: boolean
  rawLLMResponse?: string
}): FilterDecision {
  const filtered =
    input.fallback === 'none'
      ? Object.freeze(input.tokens.filter((t) => t.keep).map((t) => t.token))
      : Object.freeze([...input.originalTokens])
  return {
    originalTokens: Object.freeze([...input.originalTokens]),
    filtered,
    tokens: Object.freeze([...input.tokens]),
    rawLLMResponse: input.rawLLMResponse,
    latencyMs: input.latencyMs,
    cacheHit: input.cacheHit,
    fallback: input.fallback,
  }
}

/**
 * Render the bundled prompt template. We avoid String.replaceAll (Node 14 friendly) and
 * keep the substitutions explicit so test fixtures can grep for slot names.
 */
function renderFilterPrompt(
  template: string,
  query: string,
  tokens: readonly string[],
  hint: VaultQueryHint,
): string {
  return template
    .split('{{QUERY}}').join(query)
    .split('{{TOKENS_JSON}}').join(JSON.stringify([...tokens]))
    .split('{{VAULT_HINT_BLOCK}}').join(buildVaultHintPromptBlock(hint))
}

/**
 * Parse the LLM response into a `tokens[]` array. Reuses the shared `extractJsonObject`
 * helper which handles markdown-fenced and bare JSON.
 */
export function parseFilterResponse(text: string): ParsedLLMResponse | null {
  const candidate = extractJsonObject<{ tokens?: unknown }>(text)
  if (!candidate) return null
  const tokensArr = candidate.tokens
  if (!Array.isArray(tokensArr)) return null
  const tokens: TokenDecision[] = []
  for (const raw of tokensArr) {
    if (!raw || typeof raw !== 'object') continue
    const token = String((raw as { token?: unknown }).token ?? '')
    const role = String((raw as { role?: unknown }).role ?? 'intent-core') as TokenRole
    const keep = Boolean((raw as { keep?: unknown }).keep)
    if (!token) continue
    tokens.push({ token, role, keep })
  }
  return { tokens }
}

/**
 * Merge LLM token decisions with the input list:
 *   - Drop any LLM-invented token not present in input (I5 preservation).
 *   - For each input token, prefer the LLM decision; if the LLM omitted it, default keep=true.
 *   - Apply vault hint overrides (`priorityKeep` / `domainMarkers` force keep + role bump).
 */
function applyHintAndPreserveInput(
  inputTokens: readonly string[],
  llmTokens: readonly TokenDecision[],
  hint: VaultQueryHint,
): TokenDecision[] {
  const llmByToken = new Map<string, TokenDecision>()
  for (const t of llmTokens) {
    if (!llmByToken.has(t.token)) llmByToken.set(t.token, t)
  }
  const priority = new Set(hint.priorityKeep.map((s) => s.toLowerCase()))
  const markers = new Set(hint.domainMarkers.map((s) => s.toLowerCase()))
  const out: TokenDecision[] = []
  for (const token of inputTokens) {
    const fromLLM =
      llmByToken.get(token) ?? { token, role: 'intent-core' as TokenRole, keep: true }
    const lower = token.toLowerCase()
    if (priority.has(lower) || markers.has(lower)) {
      out.push({ token, role: 'domain-marker', keep: true })
    } else {
      out.push(fromLLM)
    }
  }
  return out
}
