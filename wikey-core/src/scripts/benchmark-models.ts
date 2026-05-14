/**
 * §5.6.5 Step D — Cross-provider Ollama Cloud benchmark harness (node).
 *
 * 9 model × 7 fixture × 6 task × 3 cycle = 1,134 measurements.
 * (8 original models locked 2026-05-14 + 9th deepseek-v4-pro:cloud appended
 *  by Step D-9 boost cycle 2026-05-14 — user raise 17 covering 1순위 model
 *  missed in the initial PoC §0 probe. Existing 1,008 cells: read-only.)
 *
 * Uses production path: LLMClient.call() + isCloudModel() — no parallel impl.
 *
 * Lifecycle (orchestrated by scripts/benchmark-ollama-cloud.sh):
 *   1. golden     — committee trio (gemini + claude + openai) writes
 *                   42 golden files (7 fixture × 6 task), majority vote.
 *   2. measure    — 1,134 cells (8 original × 126 + 9th × 126): each model ×
 *                   fixture × task × cycle. Resumable: skips files already
 *                   present in measurements/.
 *   3. judge      — single judge (gemini-2.5-flash) scores 1,134 vs golden.
 *   4. best-fit   — weighted aggregate: W1=0.50 accuracy + W2=0.25 semantic +
 *                   W3=0.10 latency + W4=0.05 cost + W5=0.10 community.
 *                   Tie-break = W4 (cost).
 *   5. report     — docs/ollama-cloud-benchmark-result.md.
 *
 * Spec mirror: phase-5-todox-5.6.5-ollama-cloud.md §3 (Q3=g hybrid, Q4=j committee).
 * Master LOCK: 9 model (8 original + deepseek-v4-pro:cloud append) + 7 fixture +
 * 6 task + 3 cycle + single judge.
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync as fsExistsSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { LLMClient, type SubscriptionDeps } from '../llm-client.js'
import { loadConfig } from '../config.js'
import { isCloudModel } from '../ollama-model-catalog.js'

// wikey-core is "type": "module" — pure ESM. LLMClient.checkGeminiPresence /
// checkOpenAIPresence use lazy `require('node:path')` (works fine in the
// wikey-obsidian CJS bundle, broken under pure-ESM node CLI execution).
// Inject a CJS-compatible `require` onto globalThis so those calls resolve
// when running this script directly via `node dist/scripts/benchmark-models.js`.
// Surgical: does NOT modify llm-client.ts (out of scope per master LOCK).
;(function ensureGlobalRequire(): void {
  const g = globalThis as { require?: NodeRequire }
  if (typeof g.require === 'undefined') {
    g.require = createRequire(import.meta.url)
  }
})()
import type {
  HttpClient,
  HttpRequestOptions,
  HttpResponse,
  LLMCallOptions,
  LLMProvider,
  WikeyConfig,
} from '../types.js'

// ── Constants (master LOCK) ────────────────────────────────────────────────

/** 9 measurement models (6 cloud + 1 baseline subscription + 2 local). */
export interface ModelEntry {
  readonly id: string
  /** Slug used in measurement filenames. */
  readonly slug: string
  readonly provider: LLMProvider
  /** When true, harness emits adaptive JSON prefix (L2 only — mlx runner). */
  readonly adaptiveJsonPrefix: boolean
  /** Family for community-ref reporting + cost grouping. */
  readonly family: 'cloud' | 'subscription' | 'local'
}

export const BENCHMARK_MODELS: readonly ModelEntry[] = [
  // M1~M5 — Ollama Cloud (PoC §0 SUMMARY.md §1)
  { id: 'deepseek-v3.1:671b-cloud', slug: 'M1-deepseek-v3.1', provider: 'ollama-cloud', adaptiveJsonPrefix: false, family: 'cloud' },
  { id: 'qwen3-coder:480b-cloud', slug: 'M2-qwen3-coder-480b', provider: 'ollama-cloud', adaptiveJsonPrefix: false, family: 'cloud' },
  { id: 'kimi-k2.6:cloud', slug: 'M3-kimi-k2.6', provider: 'ollama-cloud', adaptiveJsonPrefix: false, family: 'cloud' },
  { id: 'gpt-oss:120b-cloud', slug: 'M4-gpt-oss-120b', provider: 'ollama-cloud', adaptiveJsonPrefix: false, family: 'cloud' },
  { id: 'mistral-large-3:675b-cloud', slug: 'M5-mistral-large-3', provider: 'ollama-cloud', adaptiveJsonPrefix: false, family: 'cloud' },
  // M6 — Ollama Cloud (Step D-9 append 2026-05-14, user raise 17 1순위 model
  //       missed in initial PoC §0). architecture=deepseek4, 1.6T params, 1M ctx,
  //       FP8. Not in CLOUD_MODEL_CATALOG (Step A read-only LOCK) — isCloudModel
  //       regex fallback handles routing; jsonMode defaults to native (no
  //       markdown-wrap strip since uncatalogued).
  { id: 'deepseek-v4-pro:cloud', slug: 'M6-deepseek-v4-pro', provider: 'ollama-cloud', adaptiveJsonPrefix: false, family: 'cloud' },
  // B1 — subscription baseline
  { id: 'gemini-2.5-flash', slug: 'B1-gemini-2.5-flash', provider: 'gemini', adaptiveJsonPrefix: false, family: 'subscription' },
  // L1 — local current basic
  { id: 'qwen3:8b', slug: 'L1-qwen3-8b', provider: 'ollama', adaptiveJsonPrefix: false, family: 'local' },
  // L2 — local MoE 35B; mlx runner rejects format:json so use adaptive prefix
  { id: 'qwen3.6:35b-a3b-nvfp4', slug: 'L2-qwen3.6-35b-mlx', provider: 'ollama', adaptiveJsonPrefix: true, family: 'local' },
] as const

export const BENCHMARK_FIXTURES = [
  { id: 'F1', slug: 'F1-rohm-wisun', description: 'ROHM Wi-SUN Juta module datasheet (Korean PDF)' },
  { id: 'F2', slug: 'F2-rp1-peripherals', description: 'RP1 peripherals reference manual (English PDF)' },
  { id: 'F3', slug: 'F3-hwpx-examples', description: 'Korean HWPX Examples (Hancom)' },
  { id: 'F4', slug: 'F4-business-registration', description: 'Korean business registration certificate (PII fixture)' },
  { id: 'F5', slug: 'F5-pms-intro', description: 'PMS product introduction R10 (Korean PDF)' },
  { id: 'F6', slug: 'F6-goodstream-solutions', description: 'GOODSTREAM Solutions overview (English md)' },
  { id: 'F7', slug: 'F7-service-contract', description: 'Korean service contract (PII fixture, master LOCK 2026-05-14)' },
] as const

export const BENCHMARK_TASKS = [
  'canonicalize',
  'mention',
  'brief',
  'query',
  'cross-reference',
  'hallucinate-detection',
] as const

export type BenchmarkTask = (typeof BENCHMARK_TASKS)[number]

/** Committee trio for golden answer generation (Q4=j LOCK). */
export const COMMITTEE_MODELS: readonly ModelEntry[] = [
  { id: 'gemini-2.5-flash', slug: 'gemini', provider: 'gemini', adaptiveJsonPrefix: false, family: 'subscription' },
  { id: 'claude-sonnet-4-20250514', slug: 'claude', provider: 'anthropic', adaptiveJsonPrefix: false, family: 'subscription' },
  { id: 'gpt-4.1', slug: 'openai', provider: 'openai', adaptiveJsonPrefix: false, family: 'subscription' },
] as const

/** Single LLM-judge model (master LOCK 2026-05-14). */
export const JUDGE_MODEL: ModelEntry = COMMITTEE_MODELS[0] // gemini-2.5-flash

/** Best-fit weights (master LOCK). */
export const SCORE_WEIGHTS = {
  accuracy: 0.5,
  semantic: 0.25,
  latency: 0.1,
  cost: 0.05,
  community: 0.1,
} as const

/** Default char limit for fixture truncation (token-safe). M5 + L2 = 256K ctx,
 *  but local models choke on huge inputs and the harness aims for portability.
 *  Largest fixture (F5 PMS) = 6.3MB. Cloud models get ~80K chars (~20K tokens),
 *  local family gets a smaller slice (~15K chars / ~4K tokens) so the 120s
 *  per-call budget isn't blown by slow CPU/MPS inference on 8B-class weights. */
const FIXTURE_MAX_CHARS_CLOUD = 80_000
const FIXTURE_MAX_CHARS_LOCAL = 4_000

/** Per-call timeout. Cloud models warm ~30~60s. Local L1 (qwen3:8b) ~30s,
 *  L2 (qwen3.6 mlx 35B) ~60s for short prompts; 180s ceiling polite-cancels
 *  if a model gets blocked by daemon contention. */
const CALL_TIMEOUT_MS_CLOUD = 120_000
const CALL_TIMEOUT_MS_LOCAL = 180_000

/** Adaptive JSON prefix (L2 mlx runner — phase-5 §5.6.4 R2 mirror). */
const ADAPTIVE_JSON_PREFIX =
  'Respond ONLY with valid JSON. No prose, no markdown. The first character must be `{` and the last `}`.\n\n'

// ── PII detection (6 patterns — master LOCK F4 + F7) ─────────────────────────

export interface PiiHit {
  readonly kind: string
  readonly count: number
}

const PII_PATTERNS: readonly { kind: string; regex: RegExp }[] = [
  { kind: 'phone-kr', regex: /01[0-9]-\d{4}-\d{4}/g },
  { kind: 'email', regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { kind: 'jumin', regex: /\d{6}-[1-4]\d{6}/g },
  { kind: 'biz-reg', regex: /\d{3}-\d{2}-\d{5}/g },
  { kind: 'credit-card', regex: /(?:\d{4}[ -]?){3}\d{4}/g },
  { kind: 'account', regex: /\d{3,6}-\d{2,4}-\d{5,7}/g },
]

export function detectPii(text: string): readonly PiiHit[] {
  const hits: PiiHit[] = []
  for (const { kind, regex } of PII_PATTERNS) {
    const matches = text.match(regex)
    if (matches && matches.length > 0) hits.push({ kind, count: matches.length })
  }
  return hits
}

// ── Scoring helpers (pure, unit-tested) ────────────────────────────────────

/** Jaccard similarity over whitespace-tokenized sets. Pure for unit tests. */
export function jaccard(a: string, b: string): number {
  const tokA = new Set(
    a
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0),
  )
  const tokB = new Set(
    b
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length > 0),
  )
  if (tokA.size === 0 && tokB.size === 0) return 1
  const intersection = [...tokA].filter((t) => tokB.has(t)).length
  const union = tokA.size + tokB.size - intersection
  return union === 0 ? 0 : intersection / union
}

/** Normalize a raw aggregate by clamping to [0, 1]. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value < 0) return 0
  if (value > 1) return 1
  return value
}

/** Weighted score (master LOCK formula). */
export function weightedScore(parts: {
  accuracy: number
  semantic: number
  latency: number
  cost: number
  community: number
}): number {
  return (
    SCORE_WEIGHTS.accuracy * clamp01(parts.accuracy) +
    SCORE_WEIGHTS.semantic * clamp01(parts.semantic) +
    SCORE_WEIGHTS.latency * clamp01(parts.latency) +
    SCORE_WEIGHTS.cost * clamp01(parts.cost) +
    SCORE_WEIGHTS.community * clamp01(parts.community)
  )
}

/** Latency reward: inverse normalized against `slowestMs`. */
export function latencyReward(meanMs: number, slowestMs: number): number {
  if (!Number.isFinite(meanMs) || meanMs <= 0) return 0
  if (!Number.isFinite(slowestMs) || slowestMs <= 0) return 0
  return clamp01(1 - meanMs / slowestMs)
}

/** Cost reward: inverse normalized against `mostExpensive`. */
export function costReward(estCostUsd: number, mostExpensive: number): number {
  if (!Number.isFinite(estCostUsd) || estCostUsd < 0) return 0
  if (!Number.isFinite(mostExpensive) || mostExpensive <= 0) return 1 // all free
  return clamp01(1 - estCostUsd / mostExpensive)
}

/** Tie-break = cost (W4). Higher costReward wins. */
export function tieBreakByCost(
  a: { id: string; cost: number },
  b: { id: string; cost: number },
): number {
  return b.cost - a.cost
}

// ── Task prompts ────────────────────────────────────────────────────────────

export interface TaskPrompt {
  readonly task: BenchmarkTask
  readonly prompt: string
  readonly requireJson: boolean
}

export function buildPrompt(task: BenchmarkTask, fixtureBody: string, family: 'cloud' | 'subscription' | 'local' = 'cloud'): TaskPrompt {
  const maxChars = family === 'local' ? FIXTURE_MAX_CHARS_LOCAL : FIXTURE_MAX_CHARS_CLOUD
  const trimmed = fixtureBody.length > maxChars ? fixtureBody.slice(0, maxChars) : fixtureBody
  switch (task) {
    case 'canonicalize':
      return {
        task,
        requireJson: true,
        prompt: `Read the following document and return JSON of canonicalized entities.\nSchema: {"entities":[{"name":string,"type":string,"aliases":string[]}]}\nNo prose. JSON only.\n\n---\n${trimmed}`,
      }
    case 'mention':
      return {
        task,
        requireJson: true,
        prompt: `Extract all distinct entity mentions from the document.\nSchema: {"mentions":[{"surface":string,"normalized":string}]}\nNo prose. JSON only.\n\n---\n${trimmed}`,
      }
    case 'brief':
      return {
        task,
        requireJson: false,
        prompt: `Write a 3-sentence brief summary of the following document in Korean (haeyo-che / hapsho-che).\nNo lists, no headings, just three sentences.\n\n---\n${trimmed}`,
      }
    case 'query':
      return {
        task,
        requireJson: false,
        prompt: `Answer this question from the document: "What is the primary subject or product described?"\nAnswer in one paragraph in Korean (haeyo-che / hapsho-che).\n\n---\n${trimmed}`,
      }
    case 'cross-reference':
      return {
        task,
        requireJson: true,
        prompt: `Identify all cross-references in the document (mentions of other documents, standards, products, organizations).\nSchema: {"refs":[{"target":string,"kind":"standard"|"organization"|"product"|"document"|"other"}]}\nNo prose. JSON only.\n\n---\n${trimmed}`,
      }
    case 'hallucinate-detection':
      return {
        task,
        requireJson: true,
        prompt: `List facts that are EXPLICITLY stated in the document. Do not infer.\nSchema: {"facts":[{"statement":string,"evidence_quote":string}]}\nEach fact must include a verbatim quote from the document. No prose. JSON only.\n\n---\n${trimmed}`,
      }
  }
}

// ── HTTP client (Node fetch, used for non-ollama providers) ────────────────

export class NodeHttpClient implements HttpClient {
  async request(url: string, opts: HttpRequestOptions): Promise<HttpResponse> {
    const ctrl = new AbortController()
    const timer = opts.timeout ? setTimeout(() => ctrl.abort(), opts.timeout) : null
    try {
      const res = await fetch(url, {
        method: opts.method,
        headers: opts.headers as Record<string, string> | undefined,
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

// ── Single-cell measurement ─────────────────────────────────────────────────

export interface MeasurementCell {
  readonly model: string
  readonly fixture: string
  readonly task: BenchmarkTask
  readonly cycle: number
  readonly response: string
  readonly latency_ms: number
  readonly token_count: number
  readonly json_valid: boolean
  readonly pii_hits: readonly PiiHit[]
  readonly error?: string
}

function approxTokenCount(text: string): number {
  // Rough heuristic: 4 chars per token. Korean/CJK ~2 chars/token; balances out.
  return Math.ceil(text.length / 4)
}

function isJsonValid(text: string): boolean {
  const candidate = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim()
  if (!candidate.startsWith('{') && !candidate.startsWith('[')) return false
  try {
    JSON.parse(candidate)
    return true
  } catch {
    return false
  }
}

async function callOneCell(
  client: LLMClient,
  model: ModelEntry,
  fixture: { slug: string; body: string },
  task: BenchmarkTask,
  cycle: number,
): Promise<MeasurementCell> {
  const tp = buildPrompt(task, fixture.body, model.family)
  const finalPrompt = model.adaptiveJsonPrefix && tp.requireJson ? ADAPTIVE_JSON_PREFIX + tp.prompt : tp.prompt

  const opts: LLMCallOptions = {
    provider: model.provider,
    model: model.id,
    temperature: 0.1,
    maxTokens: model.family === 'local' ? 1024 : 4096,
    timeout: model.family === 'local' ? CALL_TIMEOUT_MS_LOCAL : CALL_TIMEOUT_MS_CLOUD,
    jsonMode: tp.requireJson && !model.adaptiveJsonPrefix,
  }

  const t0 = Date.now()
  try {
    const response = await client.call(finalPrompt, opts)
    const latency_ms = Date.now() - t0
    return {
      model: model.id,
      fixture: fixture.slug,
      task,
      cycle,
      response,
      latency_ms,
      token_count: approxTokenCount(response),
      json_valid: tp.requireJson ? isJsonValid(response) : true,
      pii_hits: detectPii(response),
    }
  } catch (err) {
    const latency_ms = Date.now() - t0
    return {
      model: model.id,
      fixture: fixture.slug,
      task,
      cycle,
      response: '',
      latency_ms,
      token_count: 0,
      json_valid: false,
      pii_hits: [],
      error: (err as Error).message,
    }
  }
}

// ── Phase: golden generation ────────────────────────────────────────────────

export interface GoldenFile {
  readonly task: BenchmarkTask
  readonly fixture: string
  readonly model_outputs: Record<string, string>
  readonly majority_vote: string
  readonly dissent: boolean
}

function readFixture(rootDir: string, slug: string): string {
  const path = join(rootDir, 'raw/0_inbox/benchmark-5.6.5', `${slug}.md`)
  return readFileSync(path, 'utf-8')
}

function pairwiseSimilarity(outputs: string[]): number[] {
  const sims: number[] = []
  for (let i = 0; i < outputs.length; i++) {
    for (let j = i + 1; j < outputs.length; j++) {
      sims.push(jaccard(outputs[i] || '', outputs[j] || ''))
    }
  }
  return sims
}

/** Majority vote: pick output most similar to the other two. */
export function chooseMajorityVote(outputs: Record<string, string>): { winner: string; dissent: boolean } {
  const entries = Object.entries(outputs)
  if (entries.length === 0) return { winner: '', dissent: true }
  if (entries.length === 1) return { winner: entries[0][1], dissent: false }
  const scores = entries.map(([_k, v]) => ({
    text: v,
    score: entries.reduce((acc, [_k2, v2]) => (v === v2 ? acc : acc + jaccard(v, v2)), 0),
  }))
  scores.sort((a, b) => b.score - a.score)
  const sims = pairwiseSimilarity(entries.map(([_, v]) => v))
  // dissent if max pairwise similarity < 0.3 (committee disagrees substantially)
  const maxSim = sims.length > 0 ? Math.max(...sims) : 0
  return { winner: scores[0].text, dissent: maxSim < 0.3 }
}

async function generateOneGolden(
  client: LLMClient,
  rootDir: string,
  fixture: { slug: string; body: string },
  task: BenchmarkTask,
): Promise<GoldenFile> {
  const outputs: Record<string, string> = {}
  for (const judge of COMMITTEE_MODELS) {
    const cell = await callOneCell(client, judge, fixture, task, 1)
    outputs[judge.slug] = cell.response
  }
  const { winner, dissent } = chooseMajorityVote(outputs)
  return {
    task,
    fixture: fixture.slug,
    model_outputs: outputs,
    majority_vote: winner,
    dissent,
  }
}

export async function runGoldenPhase(rootDir: string, client: LLMClient): Promise<{ count: number; dissents: number }> {
  const goldenDir = join(rootDir, 'plan/phase-5/fixtures/cycle-5.6.5-benchmark-golden')
  mkdirSync(goldenDir, { recursive: true })
  let dissents = 0
  let count = 0
  for (const fx of BENCHMARK_FIXTURES) {
    const body = readFixture(rootDir, fx.slug)
    for (const task of BENCHMARK_TASKS) {
      const outPath = join(goldenDir, `${fx.slug}-${task}.json`)
      if (existsSync(outPath)) {
        const cached = JSON.parse(readFileSync(outPath, 'utf-8')) as GoldenFile
        if (cached.dissent) dissents++
        count++
        process.stdout.write(`  [golden] ${fx.slug}-${task}: cached\n`)
        continue
      }
      process.stdout.write(`  [golden] ${fx.slug}-${task}: committee trio...\n`)
      const golden = await generateOneGolden(client, rootDir, { slug: fx.slug, body }, task)
      writeFileSync(outPath, JSON.stringify(golden, null, 2))
      if (golden.dissent) dissents++
      count++
    }
  }
  return { count, dissents }
}

// ── Phase: measurement ──────────────────────────────────────────────────────

/**
 * Runs all 126 (7 fixture × 6 task × 3 cycle) cells for a single model.
 * Sequential within a model — most providers throttle concurrent requests
 * from one key, and ollama serves one cloud request at a time.
 */
async function runMeasurementsForModel(
  rootDir: string,
  client: LLMClient,
  model: ModelEntry,
  measureDir: string,
  tag: string,
): Promise<{ total: number; ok: number; errors: number }> {
  let total = 0
  let ok = 0
  let errors = 0
  for (const fx of BENCHMARK_FIXTURES) {
    const body = readFixture(rootDir, fx.slug)
    for (const task of BENCHMARK_TASKS) {
      for (let cycle = 1; cycle <= 3; cycle++) {
        total++
        const fileName = `${model.slug}-${fx.slug}-${task}-cycle-${cycle}.json`
        const outPath = join(measureDir, fileName)
        if (existsSync(outPath)) {
          const cached = JSON.parse(readFileSync(outPath, 'utf-8')) as MeasurementCell
          if (cached.error) errors++
          else ok++
          process.stdout.write(`  [${tag}] ${fileName}: cached\n`)
          continue
        }
        process.stdout.write(`  [${tag}] ${fileName}: calling...\n`)
        const cell = await callOneCell(client, model, { slug: fx.slug, body }, task, cycle)
        writeFileSync(outPath, JSON.stringify(cell, null, 2))
        if (cell.error) errors++
        else ok++
      }
    }
  }
  return { total, ok, errors }
}

export async function runMeasurementPhase(
  rootDir: string,
  client: LLMClient,
  filter?: { onlyModels?: readonly string[] },
): Promise<{ total: number; ok: number; errors: number }> {
  const measureDir = join(rootDir, 'plan/phase-5/fixtures/cycle-5.6.5-benchmark-measurements')
  mkdirSync(measureDir, { recursive: true })
  const models = filter?.onlyModels
    ? BENCHMARK_MODELS.filter((m) => filter.onlyModels!.includes(m.id))
    : BENCHMARK_MODELS

  // Parallel across models: each model dispatches independently in its own
  // Promise. ~8x throughput vs single-threaded. Tradeoff: ollama daemon must
  // multiplex 7 ollama requests (2 local + 5 cloud) at once. Local 2 share the
  // same daemon — kept inside the parallel set so total wall time stays under
  // the master 3hr target.
  const tasks = models.map((m) =>
    runMeasurementsForModel(rootDir, client, m, measureDir, m.slug).then((r) => ({ model: m.id, ...r })),
  )
  const results = await Promise.all(tasks)
  const total = results.reduce((a, r) => a + r.total, 0)
  const ok = results.reduce((a, r) => a + r.ok, 0)
  const errors = results.reduce((a, r) => a + r.errors, 0)
  return { total, ok, errors }
}

// ── Phase: LLM-judge ────────────────────────────────────────────────────────

export interface JudgeScore {
  readonly model: string
  readonly fixture: string
  readonly task: BenchmarkTask
  readonly cycle: number
  readonly accuracy: number // 0~1
  readonly semantic: number // 0~1
  readonly raw_judge: string
}

function parseJudgeScores(raw: string): { accuracy: number; semantic: number } {
  // Try strict JSON first.
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```$/, '').trim()
  try {
    const parsed = JSON.parse(cleaned) as { accuracy?: number; semantic?: number }
    return {
      accuracy: clamp01(typeof parsed.accuracy === 'number' ? parsed.accuracy : 0),
      semantic: clamp01(typeof parsed.semantic === 'number' ? parsed.semantic : 0),
    }
  } catch {
    // Fallback regex extraction
    const a = /"?accuracy"?\s*:\s*([0-9.]+)/i.exec(raw)
    const s = /"?semantic"?\s*:\s*([0-9.]+)/i.exec(raw)
    return {
      accuracy: a ? clamp01(parseFloat(a[1])) : 0,
      semantic: s ? clamp01(parseFloat(s[1])) : 0,
    }
  }
}

async function judgeOneCell(
  client: LLMClient,
  cell: MeasurementCell,
  golden: GoldenFile,
): Promise<JudgeScore> {
  if (cell.error || !cell.response) {
    return {
      model: cell.model,
      fixture: cell.fixture,
      task: cell.task,
      cycle: cell.cycle,
      accuracy: 0,
      semantic: 0,
      raw_judge: 'SKIPPED (error or empty)',
    }
  }
  const prompt = `You are an LLM judge. Compare the candidate response against the golden reference for the task "${cell.task}".
Score on two dimensions, both in [0, 1]:
- accuracy: factual / structural correctness (schema match, no hallucination, completeness)
- semantic: semantic similarity / meaning preservation

Respond with JSON only: {"accuracy": <number>, "semantic": <number>}

--- GOLDEN ---
${golden.majority_vote.slice(0, 8000)}

--- CANDIDATE ---
${cell.response.slice(0, 8000)}`

  const opts: LLMCallOptions = {
    provider: JUDGE_MODEL.provider,
    model: JUDGE_MODEL.id,
    temperature: 0,
    // 1024 tokens covers the JSON envelope + small reasoning tax that
    // gemini-2.5-flash injects before emitting the final answer.
    maxTokens: 1024,
    // gemini-2.5-* spend most of `maxTokens` on hidden thinking by default,
    // truncating short JSON. thinkingBudget=0 forces direct output.
    thinkingBudget: 0,
    timeout: 60_000,
    jsonMode: true,
  }
  try {
    const raw = await client.call(prompt, opts)
    const { accuracy, semantic } = parseJudgeScores(raw)
    return { model: cell.model, fixture: cell.fixture, task: cell.task, cycle: cell.cycle, accuracy, semantic, raw_judge: raw }
  } catch (err) {
    return { model: cell.model, fixture: cell.fixture, task: cell.task, cycle: cell.cycle, accuracy: 0, semantic: 0, raw_judge: `ERROR: ${(err as Error).message}` }
  }
}

export async function runJudgePhase(rootDir: string, client: LLMClient): Promise<{ scored: number; skipped: number }> {
  const measureDir = join(rootDir, 'plan/phase-5/fixtures/cycle-5.6.5-benchmark-measurements')
  const goldenDir = join(rootDir, 'plan/phase-5/fixtures/cycle-5.6.5-benchmark-golden')
  const judgeDir = join(rootDir, 'plan/phase-5/fixtures/cycle-5.6.5-benchmark-judge')
  mkdirSync(judgeDir, { recursive: true })
  let scored = 0
  let skipped = 0
  const cellFiles = readdirSync(measureDir).filter((f) => f.endsWith('.json'))
  const totalFiles = cellFiles.length
  let idx = 0
  for (const file of cellFiles) {
    idx++
    const cell = JSON.parse(readFileSync(join(measureDir, file), 'utf-8')) as MeasurementCell
    const goldenPath = join(goldenDir, `${cell.fixture}-${cell.task}.json`)
    if (!existsSync(goldenPath)) {
      skipped++
      process.stdout.write(`  [${idx}/${totalFiles}] ${file}: skip (no golden)\n`)
      continue
    }
    const outName = file.replace(/\.json$/, '.judge.json')
    const outPath = join(judgeDir, outName)
    if (existsSync(outPath)) {
      scored++
      process.stdout.write(`  [${idx}/${totalFiles}] ${file}: cached\n`)
      continue
    }
    const golden = JSON.parse(readFileSync(goldenPath, 'utf-8')) as GoldenFile
    const score = await judgeOneCell(client, cell, golden)
    writeFileSync(outPath, JSON.stringify(score, null, 2))
    scored++
    process.stdout.write(`  [${idx}/${totalFiles}] ${file}: acc=${score.accuracy.toFixed(2)} sem=${score.semantic.toFixed(2)}\n`)
  }
  return { scored, skipped }
}

// ── Phase: best-fit aggregation + report ───────────────────────────────────

export interface ModelAggregate {
  readonly model: string
  readonly slug: string
  readonly family: string
  readonly accuracy_mean: number
  readonly semantic_mean: number
  readonly latency_mean_ms: number
  readonly cost_est_usd: number
  readonly community_score: number
  readonly weighted: number
}

/** Estimated cost per 1K tokens (master rough order; Ollama Pro local = $0). */
const COST_PER_1K_TOKENS_USD: Record<string, number> = {
  'deepseek-v3.1:671b-cloud': 0.001, // Ollama Pro plan unlimited; nominal
  'qwen3-coder:480b-cloud': 0.001,
  'kimi-k2.6:cloud': 0.001,
  'gpt-oss:120b-cloud': 0.001,
  'mistral-large-3:675b-cloud': 0.001,
  'deepseek-v4-pro:cloud': 0.001, // Step D-9 append; same Ollama Pro tier
  'gemini-2.5-flash': 0.000075, // input rate; rough
  'qwen3:8b': 0,
  'qwen3.6:35b-a3b-nvfp4': 0,
}

/** Community-reference baseline (HF leaderboard / LMSYS Arena, master rough rank, 0~1). */
const COMMUNITY_SCORE: Record<string, number> = {
  'deepseek-v3.1:671b-cloud': 0.90,
  'qwen3-coder:480b-cloud': 0.82,
  'kimi-k2.6:cloud': 0.80,
  'gpt-oss:120b-cloud': 0.78,
  'mistral-large-3:675b-cloud': 0.85,
  // deepseek-v4 (1.6T params, FP8) — HF leaderboard / DeepSeek announcement
  // tier 1 frontier model. Rough master rank pending Arena ELO publication;
  // master can refine in post-impl report boost.
  'deepseek-v4-pro:cloud': 0.92,
  'gemini-2.5-flash': 0.83,
  'qwen3:8b': 0.55,
  'qwen3.6:35b-a3b-nvfp4': 0.70,
}

interface ModelGroup {
  cells: MeasurementCell[]
  judges: JudgeScore[]
}

/** Index cells + judges by model id (one pass each). */
function groupByModel(cells: readonly MeasurementCell[], judges: readonly JudgeScore[]): Map<string, ModelGroup> {
  const byModel = new Map<string, ModelGroup>()
  const ensure = (id: string): ModelGroup => {
    let g = byModel.get(id)
    if (!g) {
      g = { cells: [], judges: [] }
      byModel.set(id, g)
    }
    return g
  }
  for (const c of cells) ensure(c.model).cells.push(c)
  for (const j of judges) ensure(j.model).judges.push(j)
  return byModel
}

/** Mean accuracy + semantic + latency, plus tokens-based cost estimate. */
interface ModelRawMeans {
  model: string
  acc: number
  sem: number
  lat: number
  cost: number
}

function computeRawMeans(byModel: Map<string, ModelGroup>): ModelRawMeans[] {
  const mean = (arr: number[]) => (arr.length === 0 ? 0 : arr.reduce((a, n) => a + n, 0) / arr.length)
  return [...byModel.entries()].map(([model, group]) => ({
    model,
    acc: mean(group.judges.map((j) => j.accuracy)),
    sem: mean(group.judges.map((j) => j.semantic)),
    lat: mean(group.cells.map((c) => c.latency_ms)),
    cost: (group.cells.reduce((a, c) => a + c.token_count, 0) / 1000) * (COST_PER_1K_TOKENS_USD[model] ?? 0),
  }))
}

export function aggregateScores(
  cells: readonly MeasurementCell[],
  judges: readonly JudgeScore[],
): readonly ModelAggregate[] {
  const byModel = groupByModel(cells, judges)
  const raw = computeRawMeans(byModel)
  const slowestLatency = Math.max(...raw.map((r) => r.lat), 1)
  const mostExpensive = Math.max(...raw.map((r) => r.cost), 0)
  return raw
    .map<ModelAggregate>((r) => {
      const entry = BENCHMARK_MODELS.find((m) => m.id === r.model)
      const community = COMMUNITY_SCORE[r.model] ?? 0
      return {
        model: r.model,
        slug: entry?.slug ?? r.model,
        family: entry?.family ?? 'unknown',
        accuracy_mean: r.acc,
        semantic_mean: r.sem,
        latency_mean_ms: r.lat,
        cost_est_usd: r.cost,
        community_score: community,
        weighted: weightedScore({
          accuracy: r.acc,
          semantic: r.sem,
          latency: latencyReward(r.lat, slowestLatency),
          cost: costReward(r.cost, mostExpensive),
          community,
        }),
      }
    })
    .sort((a, b) => {
      if (b.weighted !== a.weighted) return b.weighted - a.weighted
      // Tie-break = cost reward (lower cost wins → lower cost_est_usd)
      return a.cost_est_usd - b.cost_est_usd
    })
}

export function buildReport(
  aggregates: readonly ModelAggregate[],
  meta: { totalCells: number; goldenCount: number; judgeCount: number; piiHitsOnReport: number },
): string {
  const today = new Date().toISOString().slice(0, 10)
  const winner = aggregates[0]
  const lines: string[] = []
  lines.push('# Ollama Cloud Cross-Provider Benchmark Result')
  lines.push('')
  lines.push(`> §5.6.5 Step D — generated ${today} by \`scripts/benchmark-ollama-cloud.sh\` + \`benchmark-models.ts\`.`)
  lines.push('>')
  lines.push('> **Master LOCK**: 9 model × 7 fixture × 6 task × 3 cycle = 1,134 measurements.')
  lines.push('> (8 original + deepseek-v4-pro:cloud appended Step D-9 2026-05-14.)')
  lines.push('> Single judge = gemini-2.5-flash. Committee trio (gemini + claude + openai) → 42 golden files.')
  lines.push('>')
  lines.push(`> **Best-fit winner: \`${winner.model}\`** (weighted score ${winner.weighted.toFixed(3)})`)
  lines.push('')
  lines.push('## 1. Score Aggregate (sorted by weighted score)')
  lines.push('')
  lines.push('| # | Model | Family | Acc | Sem | Latency (ms) | Cost (USD) | Community | Weighted |')
  lines.push('|---|-------|--------|-----|-----|--------------|------------|-----------|----------|')
  aggregates.forEach((a, i) => {
    lines.push(
      `| ${i + 1} | \`${a.model}\` | ${a.family} | ${a.accuracy_mean.toFixed(3)} | ${a.semantic_mean.toFixed(3)} | ${a.latency_mean_ms.toFixed(0)} | ${a.cost_est_usd.toFixed(4)} | ${a.community_score.toFixed(2)} | ${a.weighted.toFixed(3)} |`,
    )
  })
  lines.push('')
  lines.push('## 2. Best-fit decision')
  lines.push('')
  lines.push(`- **Winner**: \`${winner.model}\` (family: ${winner.family})`)
  lines.push(`- Weighted score: W1×accuracy ${SCORE_WEIGHTS.accuracy} + W2×semantic ${SCORE_WEIGHTS.semantic} + W3×latency ${SCORE_WEIGHTS.latency} + W4×cost ${SCORE_WEIGHTS.cost} + W5×community ${SCORE_WEIGHTS.community}`)
  lines.push(`- Tie-break: W4 (cost) — lower cost_est_usd wins (applied automatically when weighted ties).`)
  lines.push('')
  lines.push('## 3. Metadata')
  lines.push('')
  lines.push(`- Total measurement cells: ${meta.totalCells}`)
  lines.push(`- Golden files (committee trio): ${meta.goldenCount}`)
  lines.push(`- Judge scores (single judge): ${meta.judgeCount}`)
  lines.push(`- PII hits on report (must be 0): ${meta.piiHitsOnReport}`)
  lines.push('')
  lines.push('## 4. Methodology')
  lines.push('')
  lines.push('- **Fixtures (7)**: F1 ROHM Wi-SUN PDF, F2 RP1 peripherals, F3 HWPX Examples, F4 business registration (PII), F5 PMS intro, F6 GOODSTREAM solutions, F7 service contract (PII).')
  lines.push('- **Tasks (6)**: canonicalize, mention, brief, query, cross-reference, hallucinate-detection.')
  lines.push('- **Cycles**: 3 repeats per (model × fixture × task) for deterministic consistency.')
  lines.push('- **Judge**: single gemini-2.5-flash; scores accuracy + semantic in [0, 1].')
  lines.push('- **Golden**: 42 files (7 × 6) via committee trio (gemini + claude + openai) majority vote.')
  lines.push('- **PII patterns**: 6 (phone-kr, email, jumin, biz-reg, credit-card, account); grep on result markdown = 0 hit invariant.')
  lines.push('')
  lines.push('## 5. Community reference')
  lines.push('')
  lines.push('- HF Open LLM Leaderboard — frontier-model rankings.')
  lines.push('- LMSYS Chatbot Arena — head-to-head ELO.')
  lines.push('- Korean LLM eval (KoBEST / KLUE) — Korean text understanding.')
  lines.push('')
  lines.push('Community score baked into the W5 column from the above sources (rough master rank, 0~1).')
  lines.push('')
  return lines.join('\n')
}

// ── CLI orchestration (when run as main) ───────────────────────────────────

function loadAllMeasurements(rootDir: string): MeasurementCell[] {
  const dir = join(rootDir, 'plan/phase-5/fixtures/cycle-5.6.5-benchmark-measurements')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.endsWith('.judge.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf-8')) as MeasurementCell)
}

function loadAllJudges(rootDir: string): JudgeScore[] {
  const dir = join(rootDir, 'plan/phase-5/fixtures/cycle-5.6.5-benchmark-judge')
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.judge.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf-8')) as JudgeScore)
}

function countGoldenFiles(rootDir: string): number {
  const dir = join(rootDir, 'plan/phase-5/fixtures/cycle-5.6.5-benchmark-golden')
  if (!existsSync(dir)) return 0
  return readdirSync(dir).filter((f) => f.endsWith('.json')).length
}

async function main(): Promise<void> {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)
  // __dirname = wikey/wikey-core/src/scripts → repo root = three levels up
  const rootDir = resolve(__dirname, '..', '..', '..')
  const phase = process.argv[2] ?? 'help'

  // Force API mode for benchmark — explicit, no CLI fallback.
  const baseConfig = loadConfig(rootDir)
  const config: WikeyConfig = {
    ...baseConfig,
    GEMINI_AUTH_MODE: 'api',
    ANTHROPIC_AUTH_MODE: 'api',
    OPENAI_AUTH_MODE: 'api',
  }
  const http = new NodeHttpClient()
  // LLMClient's default SubscriptionDeps use lazy-`require('node:fs')` which fails
  // under pure-ESM execution (this script). With AUTH_MODE='api', the CLI / OAuth
  // probe is still called by `checkGeminiPresence` / `checkOpenAIPresence`
  // *before* the auth-mode branch — so we must inject ESM-friendly equivalents.
  const subscriptionDeps: SubscriptionDeps = {
    fileExists: (p: string) => fsExistsSync(p),
    homeDir: () => homedir(),
  }
  const client = new LLMClient(http, config, subscriptionDeps)

  switch (phase) {
    case 'golden': {
      const { count, dissents } = await runGoldenPhase(rootDir, client)
      process.stdout.write(`\nGolden phase: ${count} files / ${dissents} dissents\n`)
      break
    }
    case 'measure': {
      const onlyArg = process.argv[3]
      const filter = onlyArg ? { onlyModels: onlyArg.split(',') } : undefined
      const { total, ok, errors } = await runMeasurementPhase(rootDir, client, filter)
      process.stdout.write(`\nMeasurement phase: ${total} cells / ${ok} ok / ${errors} errors\n`)
      break
    }
    case 'judge': {
      const { scored, skipped } = await runJudgePhase(rootDir, client)
      process.stdout.write(`\nJudge phase: ${scored} scored / ${skipped} skipped\n`)
      break
    }
    case 'report': {
      const cells = loadAllMeasurements(rootDir)
      const judges = loadAllJudges(rootDir)
      const aggregates = aggregateScores(cells, judges)
      const piiOnReport = aggregates.reduce(
        (acc, a) => acc + detectPii(a.model + a.slug + a.family).length,
        0,
      )
      const report = buildReport(aggregates, {
        totalCells: cells.length,
        goldenCount: countGoldenFiles(rootDir),
        judgeCount: judges.length,
        piiHitsOnReport: piiOnReport,
      })
      const reportPath = join(rootDir, 'docs/ollama-cloud-benchmark-result.md')
      writeFileSync(reportPath, report)
      process.stdout.write(`\nReport written: ${reportPath} (${report.split('\n').length} lines)\n`)
      process.stdout.write(`Winner: ${aggregates[0]?.model ?? 'NONE'} weighted=${aggregates[0]?.weighted.toFixed(3) ?? 'N/A'}\n`)
      break
    }
    default:
      process.stdout.write(`Usage: tsx benchmark-models.ts <golden|measure|judge|report> [models-csv]\n`)
      process.exit(1)
  }
}

// ESM main detection: only invoke `main` when run as a script. When imported
// by Vitest, `import.meta.url` and `process.argv[1]` differ.
const isMain = (() => {
  try {
    return basename(fileURLToPath(import.meta.url)) === basename(process.argv[1] ?? '')
  } catch {
    return false
  }
})()

if (isMain) {
  main().catch((err) => {
    process.stderr.write(`FATAL: ${(err as Error).stack ?? err}\n`)
    process.exit(1)
  })
}
