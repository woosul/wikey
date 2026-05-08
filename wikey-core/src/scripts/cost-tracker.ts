/**
 * cost-tracker.ts — Phase 5 §5.7.1 (2026-05-08).
 *
 * `scripts/cost-tracker.sh` 의 TypeScript 포팅. 3 subcommand: add / summary / providers.
 * Python heredoc 제거 — 모든 cost 계산 + log parsing 을 TS 로.
 *
 * 동등성: 기존 .sh 와 동일한 stdout 형식 + cost-log.md entry 포맷 + exit code.
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export type ProviderId = 'claude-code' | 'gemini' | 'codex' | 'ollama-local' | string

export interface ProviderRate {
  readonly inputUsdPerM: number
  readonly outputUsdPerM: number
}

// 2026-04 기준 가격 — 출처: 각 사 공식 가격표.
// 향후 외부화 (cost-rates.yaml) 는 §5.7.1 후속 scope.
export const PROVIDER_RATES: Readonly<Record<string, ProviderRate>> = {
  'claude-code': { inputUsdPerM: 15.0, outputUsdPerM: 75.0 },
  gemini: { inputUsdPerM: 0.15, outputUsdPerM: 0.6 },
  codex: { inputUsdPerM: 2.0, outputUsdPerM: 8.0 },
  'ollama-local': { inputUsdPerM: 0.0, outputUsdPerM: 0.0 },
}

const FALLBACK_RATE: ProviderRate = { inputUsdPerM: 15.0, outputUsdPerM: 75.0 }
export const MONTHLY_BUDGET_USD = 50.0

// ANSI escape — `\x1b[`
const RED = '\x1b[0;31m'
const GREEN = '\x1b[0;32m'
const YELLOW = '\x1b[0;33m'
const CYAN = '\x1b[0;36m'
const BOLD = '\x1b[1m'
const NC = '\x1b[0m'

export interface CostTrackerOptions {
  readonly basePath: string
  /** activity/cost-log.md 위치 override (테스트용). */
  readonly costLogPath?: string
  /** 출력 sink. default = console.log. */
  readonly write?: (line: string) => void
  /** 에러/info 로그 sink. default = console.error. */
  readonly writeErr?: (line: string) => void
  /** today override (테스트용 deterministic). default = local YYYY-MM-DD. */
  readonly today?: string
}

export interface AddArgs {
  readonly provider: string
  readonly task: string
  readonly desc: string
  readonly inputTokens?: number
  readonly outputTokens?: number
  readonly durationMin?: number
  readonly pagesCreated?: number
  readonly notes?: string
}

export interface SummaryArgs {
  readonly month?: string
}

export interface CommandResult {
  readonly exitCode: number
}

function rateFor(provider: string): ProviderRate {
  return PROVIDER_RATES[provider] ?? FALLBACK_RATE
}

export function calcCost(provider: string, inputTokens: number, outputTokens: number): number {
  const r = rateFor(provider)
  // NaN/Infinity 차단 — invalid 입력이 cost-log 에 `$NaN` 으로 누수되지 않도록.
  const inp = Number.isFinite(inputTokens) ? inputTokens : 0
  const out = Number.isFinite(outputTokens) ? outputTokens : 0
  const cost = (inp / 1_000_000) * r.inputUsdPerM + (out / 1_000_000) * r.outputUsdPerM
  return Math.round(cost * 100) / 100
}

function todayString(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function resolveCostLogPath(opts: CostTrackerOptions): string {
  return opts.costLogPath ?? path.join(opts.basePath, 'activity', 'cost-log.md')
}

export function cmdAdd(opts: CostTrackerOptions, args: AddArgs): CommandResult {
  const writeErr = opts.writeErr ?? ((line: string) => console.error(line))
  const today = opts.today ?? todayString()
  const inputTokens = args.inputTokens ?? 0
  const outputTokens = args.outputTokens ?? 0
  const cost = calcCost(args.provider, inputTokens, outputTokens)
  const costLog = resolveCostLogPath(opts)

  const lines: string[] = []
  lines.push('')
  lines.push(`## [${today}] ${args.provider} | ${args.task} | ${args.desc}`)
  lines.push('')
  lines.push(`- task: ${args.desc}`)
  if (inputTokens > 0) lines.push(`- est_input_tokens: ~${inputTokens}`)
  if (outputTokens > 0) lines.push(`- est_output_tokens: ~${outputTokens}`)
  lines.push(`- est_cost_usd: $${cost.toFixed(2)}`)
  if (args.durationMin !== undefined && args.durationMin !== null) {
    lines.push(`- duration_min: ${args.durationMin}`)
  }
  if (args.pagesCreated !== undefined && args.pagesCreated !== null) {
    lines.push(`- pages_created: ${args.pagesCreated}`)
  }
  if (args.notes) lines.push(`- notes: ${args.notes}`)
  // .sh 의 `echo -e "$entry" >> "$COST_LOG"` 는 trailing \n 추가
  const block = lines.join('\n') + '\n'

  fs.mkdirSync(path.dirname(costLog), { recursive: true })
  fs.appendFileSync(costLog, block, 'utf-8')
  writeErr(`${GREEN}[cost]${NC} 비용 기록 추가: ${args.provider} | ${args.task} | ${args.desc} — $${cost.toFixed(2)}`)
  return { exitCode: 0 }
}

interface ParsedEntry {
  readonly date: string
  readonly provider: string
  readonly task: string
  readonly desc: string
  readonly cost: number
  readonly inputTokens: number
  readonly outputTokens: number
}

export function parseCostLog(content: string): readonly ParsedEntry[] {
  const entries: ParsedEntry[] = []
  // 기존 .sh 의 정규식: `## \[(\d{4}-\d{2}-\d{2})\] (\S+) \| (\S+) \| (.+?)$(.*?)(?=\n## \[|\Z)`
  const headerRe = /^## \[(\d{4}-\d{2}-\d{2})\] (\S+) \| (\S+) \| (.+?)$/gm
  const matches: { idx: number; date: string; provider: string; task: string; desc: string }[] = []
  let m: RegExpExecArray | null
  while ((m = headerRe.exec(content)) !== null) {
    matches.push({
      idx: m.index,
      date: m[1],
      provider: m[2],
      task: m[3],
      desc: m[4],
    })
  }
  for (let i = 0; i < matches.length; i += 1) {
    const cur = matches[i]
    const next = matches[i + 1]
    const bodyStart = content.indexOf('\n', cur.idx)
    const bodyEnd = next ? next.idx : content.length
    const body = bodyStart >= 0 ? content.slice(bodyStart, bodyEnd) : ''
    const costM = body.match(/est_cost_usd: \$?([\d.]+)/)
    const inpM = body.match(/est_input_tokens: ~?(\d+)/)
    const outM = body.match(/est_output_tokens: ~?(\d+)/)
    entries.push({
      date: cur.date,
      provider: cur.provider,
      task: cur.task,
      desc: cur.desc,
      cost: costM ? parseFloat(costM[1]) : 0,
      inputTokens: inpM ? parseInt(inpM[1], 10) : 0,
      outputTokens: outM ? parseInt(outM[1], 10) : 0,
    })
  }
  return entries
}

function padRight(s: string, n: number): string {
  // bash printf `%-Ns` 와 동등: byte 길이 기준 padding. 한글 utf-8 3 byte 로 계산되어
  // 기존 .sh 출력과 byte-equal. JS `string.length` 는 코드포인트 단위라 부적합.
  const byteLen = Buffer.byteLength(s, 'utf8')
  if (byteLen >= n) return s
  return s + ' '.repeat(n - byteLen)
}

function padLeft(s: string, n: number): string {
  const byteLen = Buffer.byteLength(s, 'utf8')
  if (byteLen >= n) return s
  return ' '.repeat(n - byteLen) + s
}

export function cmdSummary(opts: CostTrackerOptions, args: SummaryArgs): CommandResult {
  const write = opts.write ?? ((line: string) => console.log(line))
  const writeErr = opts.writeErr ?? ((line: string) => console.error(line))
  const costLog = resolveCostLogPath(opts)

  if (!fs.existsSync(costLog)) {
    writeErr(`${RED}[cost]${NC} 비용 로그 없음: ${costLog}`)
    return { exitCode: 1 }
  }

  const content = fs.readFileSync(costLog, 'utf-8')
  const entries = parseCostLog(content)

  let totalCost = 0
  let totalInput = 0
  let totalOutput = 0
  let entryCount = 0
  const providers = new Map<string, number>()
  const tasks = new Map<string, number>()

  const monthFilter = args.month ?? ''
  for (const e of entries) {
    if (monthFilter && !e.date.startsWith(monthFilter)) continue
    providers.set(e.provider, (providers.get(e.provider) ?? 0) + e.cost)
    tasks.set(e.task, (tasks.get(e.task) ?? 0) + e.cost)
    totalCost += e.cost
    totalInput += e.inputTokens
    totalOutput += e.outputTokens
    entryCount += 1
  }

  const period = monthFilter ? `월: ${monthFilter}` : '전체'
  write('')
  write(`===== LLM 비용 요약 (${period}) =====`)
  write('')
  write(`기록 수: ${entryCount}건`)
  write(`총 비용: $${totalCost.toFixed(2)} (월 목표 $${MONTHLY_BUDGET_USD.toFixed(2)})`)
  write(`입력 토큰: ~${totalInput.toLocaleString('en-US')}`)
  write(`출력 토큰: ~${totalOutput.toLocaleString('en-US')}`)
  write('')
  write('--- 프로바이더별 ---')
  const providerSorted = Array.from(providers.entries()).sort((a, b) => b[1] - a[1])
  for (const [p, cost] of providerSorted) {
    const pct = totalCost > 0 ? (cost / totalCost) * 100 : 0
    write(`  ${padRight(p, 20)}  $${padLeft(cost.toFixed(2), 7)}  (${padLeft(pct.toFixed(1), 5)}%)`)
  }
  write('')
  write('--- 작업 유형별 ---')
  const taskSorted = Array.from(tasks.entries()).sort((a, b) => b[1] - a[1])
  for (const [t, cost] of taskSorted) {
    const pct = totalCost > 0 ? (cost / totalCost) * 100 : 0
    write(`  ${padRight(t, 20)}  $${padLeft(cost.toFixed(2), 7)}  (${padLeft(pct.toFixed(1), 5)}%)`)
  }

  const budgetPct = totalCost > 0 ? (totalCost / MONTHLY_BUDGET_USD) * 100 : 0
  const remaining = MONTHLY_BUDGET_USD - totalCost
  write('')
  write('--- 예산 상태 ---')
  write(`  사용: $${totalCost.toFixed(2)} / $${MONTHLY_BUDGET_USD.toFixed(2)} (${budgetPct.toFixed(1)}%)`)
  write(`  잔여: $${remaining.toFixed(2)}`)
  if (totalCost > MONTHLY_BUDGET_USD) {
    write(`  ⚠️  월간 예산 초과!`)
  } else if (totalCost > 40) {
    write(`  ⚠️  예산 80% 이상 사용`)
  } else {
    write(`  ✓ 예산 범위 내`)
  }
  return { exitCode: 0 }
}

export function cmdProviders(opts: CostTrackerOptions): CommandResult {
  const write = opts.write ?? ((line: string) => console.log(line))
  write(`${BOLD}프로바이더별 요금 (2026-04 기준)${NC}`)
  write('')
  // printf 형식 (.sh 와 동등): `  %-20s  %12s  %12s  %s`
  const header = (a: string, b: string, c: string, d: string): string =>
    `  ${padRight(a, 20)}  ${padLeft(b, 12)}  ${padLeft(c, 12)}  ${d}`
  write(header('프로바이더', 'Input $/1M', 'Output $/1M', '비고'))
  write(header('──────────', '──────────', '───────────', '────'))
  write(header('claude-code (Opus)', '$15.00', '$75.00', '주력 인제스트/린트'))
  write(header('claude-code (Sonnet)', '$3.00', '$15.00', '경량 작업'))
  write(header('gemini (Flash)', '$0.15', '$0.60', '대용량 요약'))
  write(header('codex (GPT-4.1)', '$2.00', '$8.00', '교차 검증'))
  write(header('ollama-local', '$0.00', '$0.00', '로컬 (전기세만)'))
  return { exitCode: 0 }
}

interface ParsedAddArgs {
  readonly add: AddArgs
}

/** invalid 숫자 (`--input abc` 등) → NaN 회피하고 0 fallback. 기존 .sh 의
 * `[ "$input_tokens" -gt 0 ]` 비교 (bash arithmetic 0 fallback) 와 동등. */
function parseIntSafe(s: string | undefined): number | undefined {
  if (s === undefined) return undefined
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : 0
}

function parseAddArgs(rest: readonly string[]): ParsedAddArgs | { error: string } {
  if (rest.length < 3) {
    return {
      error:
        '사용법: cost-tracker add <provider> <task> "<desc>" [--input N] [--output N] [--duration N] [--pages N] [--notes "..."]',
    }
  }
  const [provider, task, desc, ...flags] = rest
  let input: number | undefined
  let output: number | undefined
  let duration: number | undefined
  let pages: number | undefined
  let notes: string | undefined
  for (let i = 0; i < flags.length; i += 1) {
    const cur = flags[i]
    const next = flags[i + 1]
    switch (cur) {
      case '--input':
        input = parseIntSafe(next)
        i += 1
        break
      case '--output':
        output = parseIntSafe(next)
        i += 1
        break
      case '--duration':
        duration = parseIntSafe(next)
        i += 1
        break
      case '--pages':
        pages = parseIntSafe(next)
        i += 1
        break
      case '--notes':
        notes = next
        i += 1
        break
      default:
        // unknown — ignore (기존 .sh 와 동등: `*) shift`)
        break
    }
  }
  return {
    add: {
      provider,
      task,
      desc,
      inputTokens: input,
      outputTokens: output,
      durationMin: duration,
      pagesCreated: pages,
      notes,
    },
  }
}

export async function main(argv: readonly string[]): Promise<number> {
  const opts: CostTrackerOptions = { basePath: process.cwd() }
  const sub = argv[0]
  switch (sub) {
    case 'add': {
      const parsed = parseAddArgs(argv.slice(1))
      if ('error' in parsed) {
        console.error(`${RED}[cost]${NC} ${parsed.error}`)
        console.error(`${RED}[cost]${NC} provider: claude-code | gemini | ollama-local | codex`)
        console.error(`${RED}[cost]${NC} task: ingest | query | lint | summarize | infra`)
        return 1
      }
      const r = cmdAdd(opts, parsed.add)
      return r.exitCode
    }
    case 'summary': {
      let month: string | undefined
      const flags = argv.slice(1)
      for (let i = 0; i < flags.length; i += 1) {
        if (flags[i] === '--month' && i + 1 < flags.length) {
          month = flags[i + 1]
          i += 1
        }
      }
      const r = cmdSummary(opts, { month })
      return r.exitCode
    }
    case 'providers': {
      const r = cmdProviders(opts)
      return r.exitCode
    }
    default: {
      console.log('사용법:')
      console.log('  cost-tracker add <provider> <task> "<desc>" [--input N] [--output N]')
      console.log('  cost-tracker summary [--month YYYY-MM]')
      console.log('  cost-tracker providers')
      return 1
    }
  }
}

// plugin esbuild cjs bundle 에서 `import.meta.url` empty → fileURLToPath throw 방지.
function isEntryPoint(): boolean {
  try {
    if (typeof process === 'undefined' || !process.argv[1]) return false
    const metaUrl = (import.meta as { url?: unknown })?.url
    if (typeof metaUrl !== 'string' || metaUrl.length === 0) return false
    return process.argv[1] === fileURLToPath(metaUrl)
  } catch {
    return false
  }
}

if (isEntryPoint()) {
  main(process.argv.slice(2))
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err)
      process.exit(2)
    })
}
