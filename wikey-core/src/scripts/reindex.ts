/**
 * reindex.ts — Phase 5 §5.7.1 (2026-05-08).
 *
 * `scripts/reindex.sh` 의 TypeScript 포팅. 4 모드 (--check / --check --json / --quick /
 * full) 동등 동작. 외부 binary (qmd) + python script (contextual-retrieval, korean-tokenize)
 * 호출은 그대로 spawn — TS 포팅 대상은 shell logic 만.
 *
 * step 5 (validate) 는 in-process `runValidateWiki` 호출로 대체 — bash spawn 회피.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { spawn, type SpawnOptions } from 'node:child_process'
import { runValidateWiki } from './validate-wiki.js'
import { createOramaIndex, type KoreanTokenizerHandle } from '../search/orama-index.js'
import { defaultOramaCachePath, disposeOramaIndex } from '../search/orama-index-singleton.js'
// §5.7.5 LOW #15 — createKoreanTokenizer is lazy-imported inside runOramaIngest only;
// engine='qmd' branch never loads the Kiwi vendor module → MODULE_TYPELESS_PACKAGE_JSON
// warn 0 in qmd path.

const RED = '\x1b[0;31m'
const GREEN = '\x1b[0;32m'
const YELLOW = '\x1b[0;33m'
const CYAN = '\x1b[0;36m'
const BOLD = '\x1b[1m'
const NC = '\x1b[0m'

/** stale 판정 시 보고 변경 파일 최대 — 기존 `find ... | head -5` 와 동등. */
const MAX_CHANGED_FILES_REPORTED = 5

export interface ReindexOptions {
  readonly basePath: string
  /** qmd binary 경로. default = `${basePath}/tools/qmd/bin/qmd`. */
  readonly qmdBin?: string
  /** stamp file 경로. default = `~/.cache/qmd/.last-reindex`. */
  readonly stampFile?: string
  /** sqlite db. default = `~/.cache/qmd/index.sqlite`. */
  readonly sqliteDb?: string
  /**
   * §5.7.4 — 검색 backend engine. 'orama' (default) 시 Step 1+2 = runOramaIngest 단일 호출.
   * 'qmd' 시 회귀 path (기존 runQmdUpdate + runQmdEmbed).
   */
  readonly searchEngine?: 'orama' | 'qmd'
  /** §5.7.4 — engine='orama' 시 Orama 인덱스 cache 파일 경로. default = ~/.cache/wikey/orama/wikey-wiki.json. */
  readonly oramaCachePath?: string
  /**
   * §5.7.4 codex cycle #2 HIGH-8 fix — Kiwi WASM 바이너리 경로. CLI ESM 환경은 vendor default
   * 사용 가능 (`fileURLToPath(import.meta.url)`), Obsidian CJS bundle 환경은 plugin 이 직접
   * inject (env `WIKEY_KIWI_WASM_PATH` 또는 본 옵션). 미지정 + ESM 환경 = vendor default.
   */
  readonly kiwiWasmPath?: string
  /** §5.7.4 — Kiwi 사전 디렉토리. 미지정 = `~/.cache/wikey/kiwi-models/cong/base/`. */
  readonly kiwiModelDir?: string
  /** 출력 sink. default = console.log. */
  readonly write?: (line: string) => void
  /** 에러 sink. default = console.error. captureRun 의 stderr 수집 path. */
  readonly writeErr?: (line: string) => void
  /** env override (테스트용). */
  readonly env?: Record<string, string>
  /**
   * indexed count 직접 주입 (테스트용). default = `SELECT count(*) FROM documents WHERE active=1`.
   * sqlite3 binary 미가용 환경에서도 정밀 시나리오 검증 가능. -1 = legacy schema 시뮬레이션.
   */
  readonly indexedCountOverride?: number
  /**
   * freshness report 직접 주입 (테스트용). stamp file / wiki dir 검사 없이 결과 강제.
   * fresh / stale (`changedFiles` 길이) / never 시뮬레이션.
   */
  readonly freshnessOverride?: FreshnessReport
  /**
   * §5.7.1 cycle #2 fix: AbortSignal — captureRun timeout 이 trigger 시 spawn 된 qmd /
   * python child process 를 abort. cmdReindex / runProc 가 child spawn 의 signal 옵션으로
   * 전달. timeout 후 background 에서 stamp 갱신되는 회귀 방지.
   */
  readonly signal?: AbortSignal
}

export type FreshnessStatus = 'fresh' | 'stale' | 'never'

export interface FreshnessReport {
  readonly status: FreshnessStatus
  readonly changedFiles: readonly string[]
}

interface SpawnResult {
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
}

function runProc(
  cmd: string,
  args: readonly string[],
  cwd: string,
  env: Record<string, string>,
  signal?: AbortSignal,
): Promise<SpawnResult> {
  return new Promise((resolve) => {
    let stdout = ''
    let stderr = ''
    const sopts: SpawnOptions = {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
      signal,
    }
    // 이미 abort 된 signal 로 들어오면 spawn 자체 거부
    if (signal?.aborted) {
      resolve({ exitCode: -1, stdout: '', stderr: 'aborted before spawn' })
      return
    }
    const proc = spawn(cmd, args as string[], sopts)
    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf-8')
    })
    proc.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf-8')
    })
    proc.on('error', (err) => {
      resolve({ exitCode: -1, stdout, stderr: stderr + (stderr ? '\n' : '') + (err.message ?? String(err)) })
    })
    proc.on('close', (code) => {
      resolve({ exitCode: code ?? -1, stdout, stderr })
    })
  })
}

function defaultStampFile(): string {
  return path.join(os.homedir(), '.cache', 'qmd', '.last-reindex')
}

function defaultSqliteDb(): string {
  return path.join(os.homedir(), '.cache', 'qmd', 'index.sqlite')
}

function defaultQmdBin(basePath: string): string {
  return path.join(basePath, 'tools', 'qmd', 'bin', 'qmd')
}

/**
 * Resolve vendor wasm path from this module's location (dist/ or src/ both work).
 * Returns null when `import.meta.url` is unavailable (Obsidian CJS bundle — caller
 * must inject explicit path via `kiwiWasmPath` or env var).
 */
function defaultVendorWasmPath(): string | null {
  let metaUrl: string | undefined
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metaUrl = (import.meta as any)?.url
  } catch {
    metaUrl = undefined
  }
  if (!metaUrl) return null
  const here = path.dirname(fileURLToPath(metaUrl))
  // dist/scripts/reindex.js → ../../vendor/kiwi-nlp/dist/kiwi-wasm.wasm
  // src/scripts/reindex.ts (during tests) → ../../vendor/kiwi-nlp/dist/kiwi-wasm.wasm
  return path.resolve(here, '..', '..', 'vendor', 'kiwi-nlp', 'dist', 'kiwi-wasm.wasm')
}

function defaultKiwiModelDir(): string {
  return path.join(os.homedir(), '.cache', 'wikey', 'kiwi-models', 'cong', 'base')
}

/**
 * §5.7.4 — engine='orama' build-time ingest. PoC commands.ts:170-202 와 동등 path:
 * wiki/ walk → frontmatter parse → Orama insertMultiple → persist().
 *
 * Codex cycle #1 MED-3 fix: production query path 와 동일 Kiwi tokenizer 사용 — index
 * tokenizer drift 회피로 AC-Q1 quality parity 보장. vendor wasm + Kiwi 사전 부재 시
 * whitespace fallback 으로 graceful 동작 (사용자 setup script 권고는 plugin 수준).
 */
async function runOramaIngest(
  wikiDir: string,
  cachePath: string,
  log: StepLogger,
  wasmPathOpt: string | undefined,
  modelDirOpt: string | undefined,
  signal: AbortSignal | undefined,
): Promise<number> {
  if (!fs.existsSync(wikiDir)) {
    log.err(`wiki/ 디렉토리 없음: ${wikiDir}`)
    return 1
  }
  if (signal?.aborted) return -1

  let tokenizer: KoreanTokenizerHandle
  let usedFallback = false
  // §5.7.4 codex cycle #2 HIGH-8 fix — explicit path > vendor default (ESM only) > null.
  const wasmPath = wasmPathOpt ?? defaultVendorWasmPath()
  const modelDir = modelDirOpt ?? defaultKiwiModelDir()
  if (wasmPath && fs.existsSync(wasmPath) && fs.existsSync(modelDir)) {
    try {
      // §5.7.5 LOW #15 — lazy dynamic import (engine='orama' branch only).
      const mod = await import('../search/orama-korean-tokenizer.js')
      tokenizer = await mod.createKoreanTokenizer({ wasmPath, modelDir })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.warn(`Kiwi tokenizer init 실패 (${msg}) — whitespace fallback`)
      tokenizer = whitespaceTokenizer()
      usedFallback = true
    }
  } else {
    const reason = !wasmPath
      ? 'wasm path 미지정 (CJS bundle 환경에서 ReindexOptions.kiwiWasmPath inject 필요)'
      : `Kiwi 사전 또는 wasm 부재 (modelDir=${modelDir}, wasm=${wasmPath})`
    log.warn(`${reason} — whitespace fallback`)
    tokenizer = whitespaceTokenizer()
    usedFallback = true
  }

  try {
    const handle = await createOramaIndex({ cachePath, tokenizer })
    const r = await handle.ingestAll(wikiDir)
    // §5.7.4 codex cycle #5 LOW-14 fix — abort 후 stale persist 방지. ingest 자체는
    // 동기 walk + insertMultiple 이라 signal 전파 어려움 — persist 직전 마지막 check.
    if (signal?.aborted) {
      log.warn('abort signal — persist skipped')
      return -1
    }
    await handle.persist()
    log.ok(`Orama ingest: ${r.docCount} docs in ${r.ms}ms${usedFallback ? ' (fallback tokenizer)' : ''}`)
    return 0
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log.err(`Orama ingest 실패: ${msg}`)
    return 1
  } finally {
    tokenizer.close()
  }
}

/** Whitespace + lowercase tokenizer — Kiwi 부재 환경 fallback (build-time 만). */
function whitespaceTokenizer(): KoreanTokenizerHandle {
  return {
    tokenize: (t: string) =>
      t ? t.toLowerCase().split(/[\s,.!?()/:;'"`　]+/u).filter((s) => s.length > 0) : [],
    close: () => undefined,
  }
}

function* walkMarkdown(dir: string): Generator<string> {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walkMarkdown(full)
    else if (entry.isFile() && entry.name.endsWith('.md')) yield full
  }
}

export function checkFreshness(opts: ReindexOptions): FreshnessReport {
  const stampFile = opts.stampFile ?? defaultStampFile()
  if (!fs.existsSync(stampFile)) {
    return { status: 'never', changedFiles: [] }
  }
  let stampMtime: number
  try {
    stampMtime = fs.statSync(stampFile).mtimeMs
  } catch {
    return { status: 'never', changedFiles: [] }
  }
  const wikiDir = path.join(opts.basePath, 'wiki')
  const changed: string[] = []
  for (const file of walkMarkdown(wikiDir)) {
    let m: number
    try {
      m = fs.statSync(file).mtimeMs
    } catch {
      continue
    }
    if (m > stampMtime) {
      changed.push(file)
      if (changed.length >= MAX_CHANGED_FILES_REPORTED) break
    }
  }
  return changed.length > 0 ? { status: 'stale', changedFiles: changed } : { status: 'fresh', changedFiles: [] }
}

async function querySqliteCount(
  sqliteDb: string,
  sql: string,
  signal?: AbortSignal,
): Promise<number> {
  if (!fs.existsSync(sqliteDb)) return -1
  const result = await runProc('sqlite3', [sqliteDb, sql], process.cwd(), {}, signal)
  if (result.exitCode !== 0) return -1
  const trimmed = result.stdout.trim()
  if (trimmed === '') return -1
  const n = parseInt(trimmed, 10)
  return Number.isNaN(n) ? -1 : n
}

function formatTimestamp(mtimeMs: number): string {
  const d = new Date(mtimeMs)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

export async function cmdCheck(opts: ReindexOptions): Promise<{ exitCode: number }> {
  const write = opts.write ?? ((line: string) => console.log(line))
  const stampFile = opts.stampFile ?? defaultStampFile()
  const sqliteDb = opts.sqliteDb ?? defaultSqliteDb()

  write(`${BOLD}=== 인덱스 상태 확인 ===${NC}`)

  const report = checkFreshness({ ...opts, stampFile })
  switch (report.status) {
    case 'never':
      write(`${RED}  인덱스 타임스탬프 없음 — reindex.sh를 한 번도 실행하지 않음${NC}`)
      break
    case 'stale': {
      const stamp = fs.statSync(stampFile)
      const last = formatTimestamp(stamp.mtimeMs)
      write(`${YELLOW}  마지막 인덱싱: ${last}${NC}`)
      write(`${YELLOW}  변경된 파일:${NC}`)
      for (const f of report.changedFiles) {
        const rel = f.startsWith(opts.basePath + '/') ? f.slice(opts.basePath.length + 1) : f
        write(`    ${rel}`)
      }
      write('')
      write(`  ${CYAN}→ ./scripts/reindex.sh 실행 추천${NC}`)
      break
    }
    case 'fresh': {
      const stamp = fs.statSync(stampFile)
      const last = formatTimestamp(stamp.mtimeMs)
      write(`${GREEN}  인덱스 최신 (마지막: ${last})${NC}`)
      break
    }
  }

  const docCount = await querySqliteCount(
    sqliteDb,
    'SELECT count(*) FROM documents WHERE active=1;',
    opts.signal,
  )
  const vecCount = await querySqliteCount(sqliteDb, 'SELECT count(*) FROM content_vectors;', opts.signal)
  const docDisplay = docCount === -1 ? '?' : String(docCount)
  const vecDisplay = vecCount === -1 ? '?' : String(vecCount)
  write('')
  write(`  문서: ${docDisplay}개, 벡터: ${vecDisplay}청크`)
  write(`  DB: ~/.cache/qmd/index.sqlite`)
  write(`  CR 캐시: ~/.cache/qmd/contextual-prefixes.json`)
  return { exitCode: 0 }
}

export async function cmdCheckJson(opts: ReindexOptions): Promise<{ exitCode: number }> {
  const write = opts.write ?? ((line: string) => console.log(line))
  const sqliteDb = opts.sqliteDb ?? defaultSqliteDb()
  const report = opts.freshnessOverride ?? checkFreshness(opts)
  const indexed =
    opts.indexedCountOverride !== undefined
      ? opts.indexedCountOverride
      : await querySqliteCount(
          sqliteDb,
          'SELECT count(*) FROM documents WHERE active=1;',
          opts.signal,
        )

  let payload: { stale: number; status: FreshnessStatus; indexed: number }
  switch (report.status) {
    case 'never':
      payload = { stale: -1, status: 'never', indexed }
      break
    case 'fresh':
      payload = { stale: 0, status: 'fresh', indexed }
      break
    case 'stale':
      payload = { stale: report.changedFiles.length, status: 'stale', indexed }
      break
  }
  write(JSON.stringify(payload))
  return { exitCode: 0 }
}

interface StepLogger {
  stepHeader: (n: number, total: number, msg: string) => void
  ok: (msg: string) => void
  skip: (msg: string) => void
  err: (msg: string) => void
  warn: (msg: string) => void
}

function makeLogger(write: (s: string) => void): StepLogger {
  return {
    stepHeader: (n, total, msg) => write(`\n${BOLD}${CYAN}[${n}/${total}]${NC} ${BOLD}${msg}${NC}`),
    ok: (msg) => write(`${GREEN}  ✓${NC} ${msg}`),
    skip: (msg) => write(`${YELLOW}  △${NC} ${msg} (스킵)`),
    err: (msg) => write(`${RED}  ✗${NC} ${msg}`),
    warn: (msg) => write(`${YELLOW}  ⚠${NC} ${msg}`),
  }
}

async function runQmdUpdate(
  qmdBin: string,
  basePath: string,
  env: Record<string, string>,
  log: StepLogger,
  writeErr: (s: string) => void,
  signal?: AbortSignal,
): Promise<number> {
  if (!fs.existsSync(qmdBin)) {
    log.err(`qmd 없음: ${qmdBin}`)
    return 1
  }
  const res = await runProc(qmdBin, ['update'], basePath, env, signal)
  if (res.exitCode !== 0) {
    writeErr(`qmd update failed (exit=${res.exitCode}):\n${res.stdout}${res.stderr}`)
    return res.exitCode
  }
  for (const line of res.stdout.split('\n')) {
    if (/Indexed:|Collection:/.test(line)) log.ok(line)
  }
  return 0
}

async function runQmdEmbed(
  qmdBin: string,
  basePath: string,
  env: Record<string, string>,
  log: StepLogger,
  write: (s: string) => void,
  writeErr: (s: string) => void,
  signal?: AbortSignal,
): Promise<number> {
  const res = await runProc(qmdBin, ['embed'], basePath, env, signal)
  if (res.exitCode !== 0) {
    writeErr(`qmd embed failed (exit=${res.exitCode}):\n${res.stdout}${res.stderr}`)
    return res.exitCode
  }
  if (/Done!/.test(res.stdout)) {
    const doneLine = res.stdout.split('\n').find((l) => l.includes('Done!'))
    if (doneLine) log.ok(doneLine)
  } else if (/up to date/.test(res.stdout)) {
    log.ok('임베딩 최신 상태')
  } else {
    const tail = res.stdout.split('\n').slice(-3).join('\n')
    write(tail)
  }
  return 0
}

/**
 * §5.7.1 codex finding #4 fix (사용자 영구 결정 2026-05-08):
 *
 * 기존 .sh 는 `cr_out=$(python3 ...)` 로 exit code 무시 — `set -e` 가 command substitution
 * 에 미작용. 결과 .py 가 fail 해도 후속 step (stamp 갱신) 진행 → ingest→query 결과 0
 * 회귀 origin 중 하나 (feedback_qmd_node_abi.md 6 layer silent fail).
 *
 * 새 .ts 는 strict improvement — exit code 검사 후 실패 시 0 이 아닌 값 반환. caller 가
 * stamp 갱신 안 하도록 early return. 동등성 깨지만 사용자 직접 경험 회귀 방지 우선.
 */
async function runContextualRetrieval(
  scriptsDir: string,
  basePath: string,
  env: Record<string, string>,
  log: StepLogger,
  writeErr: (s: string) => void,
  signal?: AbortSignal,
): Promise<number> {
  const py = path.join(scriptsDir, 'contextual-retrieval.py')
  if (!fs.existsSync(py)) {
    log.skip('contextual-retrieval.py 없음 또는 python3 미설치')
    return 0
  }
  const res = await runProc('python3', [py, '--batch'], basePath, env, signal)
  if (res.exitCode !== 0) {
    log.err(`contextual-retrieval.py 실패 (exit=${res.exitCode})`)
    writeErr(`contextual-retrieval.py failed (exit=${res.exitCode}):\n${res.stdout}${res.stderr}`)
    return res.exitCode
  }
  const text = res.stdout + '\n' + res.stderr
  const genM = text.match(/Generated:\s*([^,\n]+)/)
  const cachM = text.match(/Cached:\s*([^,\n]+)/)
  const generated = genM ? genM[1].trim() : '0'
  const cached = cachM ? cachM[1].trim() : '0'
  log.ok(`생성: ${generated}, 캐시: ${cached}`)
  return 0
}

async function runKoreanTokenize(
  scriptsDir: string,
  basePath: string,
  env: Record<string, string>,
  log: StepLogger,
  writeErr: (s: string) => void,
  signal?: AbortSignal,
): Promise<number> {
  const py = path.join(scriptsDir, 'korean-tokenize.py')
  if (!fs.existsSync(py)) {
    log.skip('korean-tokenize.py 없음 또는 python3 미설치')
    return 0
  }
  const res = await runProc('python3', [py, '--batch'], basePath, env, signal)
  if (res.exitCode !== 0) {
    log.err(`korean-tokenize.py 실패 (exit=${res.exitCode})`)
    writeErr(`korean-tokenize.py failed (exit=${res.exitCode}):\n${res.stdout}${res.stderr}`)
    return res.exitCode
  }
  const text = res.stdout + '\n' + res.stderr
  const doneM = text.match(/Done\.\s*(.+)$/m)
  log.ok(doneM ? doneM[1].trim() : '완료')
  return 0
}

export async function cmdReindex(
  opts: ReindexOptions,
  mode: 'full' | 'quick',
): Promise<{ exitCode: number }> {
  const write = opts.write ?? ((line: string) => console.log(line))
  const writeErr = opts.writeErr ?? ((line: string) => console.error(line))
  const log = makeLogger(write)
  // §5.7.4 codex cycle #1 MED-2 fix: process.env fallback so direct CLI rollback
  // (`WIKEY_SEARCH_ENGINE=qmd ./scripts/reindex.sh`) reaches engine selection.
  const env = opts.env ?? (process.env as Record<string, string>)
  // §5.7.4 — engine 결정. env override > opts > default 'orama'.
  const envEngine = env.WIKEY_SEARCH_ENGINE
  const engine: 'orama' | 'qmd' =
    envEngine === 'orama' || envEngine === 'qmd'
      ? envEngine
      : (opts.searchEngine ?? 'orama')
  const qmdBin = opts.qmdBin ?? defaultQmdBin(opts.basePath)
  const stampFile = opts.stampFile ?? defaultStampFile()
  const scriptsDir = path.join(opts.basePath, 'scripts')
  const startTime = Date.now()

  write('')
  write(`${BOLD}=== Wikey 인덱싱 (${mode}, engine=${engine}) ===${NC}`)

  const signal = opts.signal

  if (engine === 'orama') {
    // Step 1+2 통합 — Orama in-process ingest (qmd update + embed 대체).
    log.stepHeader(1, 5, 'Orama ingest — wiki/ 스캔 + BM25 인덱스')
    const cachePath = opts.oramaCachePath ?? defaultOramaCachePath()
    const wikiDir = path.join(opts.basePath, 'wiki')
    // §5.7.4 codex cycle #2 HIGH-8 — env override path 우선 (Obsidian CJS bundle 안전).
    const wasmPathOpt = opts.kiwiWasmPath ?? env.WIKEY_KIWI_WASM_PATH
    const modelDirOpt = opts.kiwiModelDir ?? env.WIKEY_KIWI_MODEL_DIR
    const ingestExit = await runOramaIngest(wikiDir, cachePath, log, wasmPathOpt, modelDirOpt, signal)
    if (ingestExit !== 0) return { exitCode: ingestExit }
    if (signal?.aborted) return { exitCode: -1 }
    // §5.7.4 codex cycle #4 MED-12 fix — invalidate query singleton so subsequent search()
    // sees the freshly persisted index. Without this, same-process reindex → query 가
    // stale handle (이전 ingest 시점의 in-memory db) 를 그대로 반환 (회귀).
    disposeOramaIndex()
    log.stepHeader(2, 5, 'Orama 벡터 임베딩 (skip — §5.7.4 v1 BM25-only)')
    log.skip('AC-V1 sanity 만 (별 cycle 에서 hybrid 통합)')
    if (signal?.aborted) return { exitCode: -1 }
  } else {
    // engine === 'qmd' (회귀 path) — 기존 Step 1 + 2.
    log.stepHeader(1, 5, 'qmd update — 파일 스캔')
    const updateExit = await runQmdUpdate(qmdBin, opts.basePath, env, log, writeErr, signal)
    if (updateExit !== 0) return { exitCode: updateExit }
    if (signal?.aborted) return { exitCode: -1 }

    log.stepHeader(2, 5, 'qmd embed — 벡터 임베딩')
    const embedExit = await runQmdEmbed(qmdBin, opts.basePath, env, log, write, writeErr, signal)
    if (embedExit !== 0) return { exitCode: embedExit }
    if (signal?.aborted) return { exitCode: -1 }
  }

  if (mode === 'quick') {
    log.stepHeader(3, 5, 'Contextual Retrieval')
    log.skip('--quick 모드: CR 스킵')
    log.stepHeader(4, 5, '한국어 형태소 전처리')
    log.skip('--quick 모드: 형태소 스킵')
    log.stepHeader(5, 5, '검증')
    log.skip('--quick 모드: 검증 스킵')
  } else {
    log.stepHeader(3, 5, 'Contextual Retrieval — Gemma 4 프리픽스')
    const crExit = await runContextualRetrieval(scriptsDir, opts.basePath, env, log, writeErr, signal)
    if (crExit !== 0) return { exitCode: crExit }
    if (signal?.aborted) return { exitCode: -1 }

    log.stepHeader(4, 5, '한국어 형태소 전처리 — kiwipiepy')
    const ktExit = await runKoreanTokenize(scriptsDir, opts.basePath, env, log, writeErr, signal)
    if (ktExit !== 0) return { exitCode: ktExit }
    if (signal?.aborted) return { exitCode: -1 }

    log.stepHeader(5, 5, 'validate-wiki — 검증')
    // in-process: runValidateWiki 직접 호출 (bash spawn 회피). validate-wiki 자체는 sync
    // file walk 만 — signal 인지 X. validate 직후 / stamp 갱신 직전 guard 로 abort 인지.
    const validateResult = await runValidateWiki({
      basePath: opts.basePath,
      write: () => undefined, // 출력 무시 — .sh 의 `&>/dev/null` 동등
    })
    if (validateResult.exitCode === 0) log.ok('PASS')
    else log.err('FAIL — ./scripts/validate-wiki.sh 직접 실행하여 확인')
    // §5.7.1 cycle #3 codex finding fix: validate 도중 abort 됐어도 stamp 갱신 안 되도록.
    if (signal?.aborted) return { exitCode: -1 }
  }

  // 타임스탬프 갱신
  fs.mkdirSync(path.dirname(stampFile), { recursive: true })
  // touch — exists 면 mtime update, 없으면 create
  const now = new Date()
  if (fs.existsSync(stampFile)) fs.utimesSync(stampFile, now, now)
  else fs.writeFileSync(stampFile, '', 'utf-8')

  const elapsed = Math.floor((Date.now() - startTime) / 1000)
  write('')
  write(`${GREEN}${BOLD}완료${NC} (${elapsed}초, ${mode} 모드)`)
  return { exitCode: 0 }
}

export async function main(argv: readonly string[]): Promise<number> {
  const opts: ReindexOptions = { basePath: process.cwd() }
  const sub = argv[0]
  const second = argv[1]
  switch (sub) {
    case '--check':
    case '-c': {
      if (second === '--json') {
        const r = await cmdCheckJson(opts)
        return r.exitCode
      }
      const r = await cmdCheck(opts)
      return r.exitCode
    }
    case '--quick':
    case '-q': {
      const r = await cmdReindex(opts, 'quick')
      return r.exitCode
    }
    case '--help':
    case '-h':
      console.log('사용법:')
      console.log('  reindex.sh                 전체 인덱싱 (qmd + embed + CR + 한국어)')
      console.log('  reindex.sh --quick         qmd update + embed만')
      console.log('  reindex.sh --check         stale 여부 확인 (human-readable)')
      console.log('  reindex.sh --check --json  stale 상태 JSON (플러그인 freshness gate)')
      return 0
    default: {
      const r = await cmdReindex(opts, 'full')
      return r.exitCode
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
