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

import { readFileSync, existsSync } from 'node:fs'
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
import type { SearchResult } from '../types.js'

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

  const { top1, top3 } = reportResults(opts.suitePath, results)

  const total = results.length
  const top1Min = Number(process.env.WIKEY_BENCHMARK_TOP1_MIN ?? '0.7')
  const top3Min = Number(process.env.WIKEY_BENCHMARK_TOP3_MIN ?? '0.85')
  const pass =
    total > 0 && top1 / total >= top1Min && top3 / total >= top3Min
  if (!pass) {
    console.error(
      `[FAIL] Regression — Top-1=${top1}/${total} (min ${top1Min}) or Top-3=${top3}/${total} (min ${top3Min})`,
    )
  }
  return { pass, results }
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
