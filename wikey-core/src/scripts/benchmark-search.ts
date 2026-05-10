/**
 * §5.7.6 — 50+ query benchmark runner for search quality regression tracking.
 *
 * Usage:
 *   tsx scripts/benchmark-search.ts [--suite <path>]
 *   (또는 wikey-core 안 `npm run benchmark:search`)
 *
 * Output: stdout (Top-1 / Top-3 / MRR per domain + aggregate) + exit 0 (PASS) / 1 (regression)
 *
 * Pattern: reindex.ts:17~18+178~224 mirror — `createKoreanTokenizer({ wasmPath, modelDir })` +
 *   `createOramaIndex({ cachePath, tokenizer })` + `await handle.restore()` +
 *   `handle.search(question, { topN })` + `SearchResult.path` slug derive.
 *
 * Spec: phase-5-spec-5.7.6-search-quality-tuning.md §3.4.
 */

import { readFileSync, existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createOramaIndex,
  type KoreanTokenizerHandle,
} from '../search/orama-index.js'
import {
  defaultOramaCachePath,
  disposeOramaIndex,
} from '../search/orama-index-singleton.js'
import type { HttpClient, HttpRequestOptions, HttpResponse, SearchResult, WikeyConfig } from '../types.js'
import { LLMClient } from '../llm-client.js'
import { loadConfig } from '../config.js'
import { QueryFilterCache } from '../search/query-filter-cache.js'
import {
  QueryIntentFilter,
  BUNDLED_QUERY_INTENT_FILTER_PROMPT,
} from '../search/query-intent-filter.js'
import {
  QueryRewriter,
  BUNDLED_QUERY_REWRITER_PROMPT,
} from '../search/query-rewriter.js'
import {
  QueryExpander,
  BUNDLED_QUERY_EXPANDER_PROMPT,
} from '../search/query-expander.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface QueryEntry {
  id: string
  query: string
  expected_top1: string
  expected_top3: string[]
  domain: string
  note?: string
}

export interface BenchmarkSuite {
  version: number
  collection: string
  created: string
  _doc?: string
  queries: QueryEntry[]
}

export interface QueryResult {
  id: string
  query: string
  domain: string
  top1Hit: boolean
  top3Hit: boolean
  mrr: number
}

export interface RunBenchmarkOpts {
  suitePath: string
  searchFn: (query: string, topN: number) => Promise<readonly SearchResult[]>
}

export function pathToSlug(path: string): string {
  return basename(path).replace(/\.md$/, '')
}

export function computeQueryResult(
  q: QueryEntry,
  hits: readonly SearchResult[],
): QueryResult {
  const slugs = hits.map((h) => pathToSlug(h.path))
  const top1Hit = slugs[0] === q.expected_top1
  const top3Hit = slugs.slice(0, 3).some((s) => q.expected_top3.includes(s))
  const expectedRank = slugs.findIndex((s) => q.expected_top3.includes(s))
  const mrr = expectedRank >= 0 ? 1 / (expectedRank + 1) : 0
  return { id: q.id, query: q.query, domain: q.domain, top1Hit, top3Hit, mrr }
}

export function reportResults(
  suitePath: string,
  results: QueryResult[],
): { top1: number; top3: number; meanMrr: number } {
  const total = results.length
  const top1 = results.filter((r) => r.top1Hit).length
  const top3 = results.filter((r) => r.top3Hit).length
  const meanMrr = total > 0 ? results.reduce((s, r) => s + r.mrr, 0) / total : 0

  const byDomain = new Map<string, QueryResult[]>()
  for (const r of results) {
    if (!byDomain.has(r.domain)) byDomain.set(r.domain, [])
    byDomain.get(r.domain)!.push(r)
  }

  console.log(`# Benchmark suite: ${suitePath}`)
  console.log(`# Total: ${total} queries`)
  console.log(
    `# Top-1: ${top1}/${total} (${total > 0 ? ((top1 / total) * 100).toFixed(1) : '0'}%)`,
  )
  console.log(
    `# Top-3: ${top3}/${total} (${total > 0 ? ((top3 / total) * 100).toFixed(1) : '0'}%)`,
  )
  console.log(`# Mean MRR: ${meanMrr.toFixed(3)}`)
  console.log(`# Per domain:`)
  for (const [domain, rs] of byDomain) {
    const d1 = rs.filter((r) => r.top1Hit).length
    const d3 = rs.filter((r) => r.top3Hit).length
    console.log(`#   ${domain}: ${rs.length} q / Top-1 ${d1} / Top-3 ${d3}`)
  }

  return { top1, top3, meanMrr }
}

export async function runBenchmark(
  opts: RunBenchmarkOpts,
): Promise<{ pass: boolean; results: QueryResult[] }> {
  const jsonText = readFileSync(opts.suitePath, 'utf-8')
  const suite = JSON.parse(jsonText) as BenchmarkSuite

  const results: QueryResult[] = []
  for (const q of suite.queries) {
    const hits = await opts.searchFn(q.query, 10)
    results.push(computeQueryResult(q, hits))
  }

  const { top1, top3, meanMrr } = reportResults(opts.suitePath, results)

  const total = results.length
  const top1Min = Number(process.env.WIKEY_BENCHMARK_TOP1_MIN ?? '0.7')
  const top3Min = Number(process.env.WIKEY_BENCHMARK_TOP3_MIN ?? '0.85')
  // §5.7.8 Finding 4 fix — MRR threshold gate. Spec §1.3 baseline: ≥ 0.85 augmented;
  // CI baseline (filter OFF) protects against ≥ 0.8 regression. env override lets
  // augmented runs raise the bar without code change.
  const mrrMin = Number(process.env.WIKEY_BENCHMARK_MRR_MIN ?? '0.85')
  const top1Pass = total > 0 && top1 / total >= top1Min
  const top3Pass = total > 0 && top3 / total >= top3Min
  const mrrPass = total > 0 && meanMrr >= mrrMin
  const pass = top1Pass && top3Pass && mrrPass
  if (!pass) {
    console.error(
      `[FAIL] Regression — Top-1=${top1}/${total} (min ${top1Min}) / Top-3=${top3}/${total} (min ${top3Min}) / MRR=${meanMrr.toFixed(3)} (min ${mrrMin})`,
    )
  }
  return { pass, results }
}

/**
 * §5.7.8 AC-L1 — minimal Node-native HttpClient for the augmented benchmark path.
 * Only implements what `LLMClient.callGemini` exercises (POST + JSON body + timeout).
 */
class NodeHttpClient implements HttpClient {
  async request(url: string, opts: HttpRequestOptions): Promise<HttpResponse> {
    const ctrl = new AbortController()
    const timer = opts.timeout ? setTimeout(() => ctrl.abort(), opts.timeout) : null
    try {
      const res = await fetch(url, {
        method: opts.method,
        headers: opts.headers,
        body: opts.body,
        signal: ctrl.signal,
      })
      const body = await res.text()
      return { status: res.status, body }
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
}

/**
 * §5.7.8 AC-L1 — augmented benchmark path. Activated by env
 *   WIKEY_BENCHMARK_LAYERS=filter,rewrite,expand
 * Each layer is constructed lazily; missing GEMINI_API_KEY → skip with warning.
 */
function buildLayerStack(httpClient: HttpClient, config: WikeyConfig) {
  const layers = (process.env.WIKEY_BENCHMARK_LAYERS ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (layers.length === 0) return undefined
  if (!config.GEMINI_API_KEY) {
    console.warn('[benchmark] WIKEY_BENCHMARK_LAYERS set but GEMINI_API_KEY missing — augmented path skipped.')
    return undefined
  }
  const llm = new LLMClient(httpClient, config)
  const cacheRoot = join(homedir(), '.cache/wikey/query-intent-cache-bench')
  mkdirSync(cacheRoot, { recursive: true })
  const cache = new QueryFilterCache({ root: cacheRoot, capacity: 5000 })
  const callOptions = { provider: 'gemini' as const, temperature: 0, maxTokens: 800, timeout: 5000 }
  // simple tokenize — used only by cache-key normalization; backend Orama search uses Kiwi.
  const tokenize = (q: string) => q.toLowerCase().split(/\s+/).filter(Boolean)
  const filter = layers.includes('filter')
    ? new QueryIntentFilter({ llm, cache, promptTemplate: BUNDLED_QUERY_INTENT_FILTER_PROMPT, llmCallOptions: callOptions, tokenize })
    : undefined
  const rewriter = layers.includes('rewrite')
    ? new QueryRewriter({ llm, cache, promptTemplate: BUNDLED_QUERY_REWRITER_PROMPT, llmCallOptions: callOptions })
    : undefined
  const expander = layers.includes('expand')
    ? new QueryExpander({ llm, cache, promptTemplate: BUNDLED_QUERY_EXPANDER_PROMPT, llmCallOptions: callOptions })
    : undefined
  console.log(`[benchmark] augmented path: filter=${!!filter} rewrite=${!!rewriter} expand=${!!expander}`)
  return { filter, rewriter, expander }
}

async function defaultSearchFn(): Promise<RunBenchmarkOpts['searchFn']> {
  // src/scripts/benchmark-search.ts (compile → dist/scripts/benchmark-search.js)
  // Vendor wasm path = wikey-core/vendor/kiwi-nlp/dist/kiwi-wasm.wasm (root: 4 levels up from dist/scripts).
  const moduleDir = __dirname
  // src/scripts → ../../vendor = wikey-core/vendor (same for dist/scripts).
  const wasmCandidates = [
    process.env.WIKEY_KIWI_WASM_PATH,
    join(moduleDir, '..', '..', 'vendor', 'kiwi-nlp', 'dist', 'kiwi-wasm.wasm'),
  ].filter(Boolean) as string[]
  const wasmPath = wasmCandidates.find((p) => existsSync(p))
  if (!wasmPath) {
    throw new Error(`Kiwi vendor wasm 부재. tried: ${wasmCandidates.join(', ')}`)
  }
  const modelDir =
    process.env.WIKEY_KIWI_MODEL_DIR ??
    join(homedir(), '.cache/wikey/kiwi-models/cong/base')
  if (!existsSync(modelDir)) {
    throw new Error(
      `Kiwi model dir 부재 (modelDir=${modelDir}). \`./scripts/download-kiwi-models.sh\` 실행 의무.`,
    )
  }
  const tokenizerMod = await import('../search/orama-korean-tokenizer.js')
  const tokenizer: KoreanTokenizerHandle =
    await tokenizerMod.createKoreanTokenizer({ wasmPath, modelDir })
  const handle = await createOramaIndex({
    cachePath: defaultOramaCachePath(),
    tokenizer,
  })
  await handle.restore()
  // §5.7.8 AC-L1 — when WIKEY_BENCHMARK_LAYERS env present, wrap search with the
  // filter/rewriter/expander layers (uses the live Gemini API). Otherwise legacy.
  const httpClient = new NodeHttpClient()
  const config = loadConfig(process.cwd())
  const layerOpts = buildLayerStack(httpClient, config)
  if (layerOpts) {
    return async (query, topN) => handle.search(query, { topN, ...layerOpts })
  }
  return async (query, topN) => handle.search(query, { topN })
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const moduleDir = __dirname
  // src/scripts → ../../eval = wikey-core/eval (same for dist/scripts).
  const defaultSuiteCandidates = [
    join(moduleDir, '..', '..', 'eval', 'benchmark-suite.json'),
  ]
  const defaultSuitePath =
    defaultSuiteCandidates.find((p) => existsSync(p)) ?? defaultSuiteCandidates[0]
  const suitePath = args.includes('--suite')
    ? args[args.indexOf('--suite') + 1]
    : resolve(defaultSuitePath)
  const searchFn = await defaultSearchFn()
  try {
    const { pass } = await runBenchmark({ suitePath, searchFn })
    process.exit(pass ? 0 : 1)
  } finally {
    disposeOramaIndex()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err)
    process.exit(2)
  })
}
