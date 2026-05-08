/**
 * scripts-runner.ts — Phase 5 §5.7.1 (2026-05-08) refactor.
 *
 * 기존: `child_process.execFile` 로 `scripts/*.sh` spawn.
 * 변경: in-process TS logic (validate-wiki / check-pii / cost-tracker / reindex) 직접 호출.
 *
 * Public interface (`ScriptResult`, `validateWiki`, `checkPii`, `reindex`, `reindexCheck`,
 * `reindexCheckJson`, `reindexQuick`, `costTrackerSummary`, `costTrackerAdd`, `waitUntilFresh`)
 * 동일 — plugin 호출 사이트 (commands.ts + settings-tab.ts) 변경 0.
 *
 * `env` 파라미터는 호환성 위해 받되 in-process 호출에 영향 없음 (logger / timestamps 만
 * 사용). 외부 binary 호출 (qmd / python3) 은 logic 함수 안에서 그대로 spawn.
 */

import { runValidateWiki } from './scripts/validate-wiki.js'
import { runCheckPii } from './scripts/check-pii.js'
import {
  cmdAdd,
  cmdProviders,
  cmdSummary,
  type AddArgs,
} from './scripts/cost-tracker.js'
import {
  cmdCheck,
  cmdCheckJson,
  cmdReindex,
  type FreshnessStatus,
  type ReindexOptions,
} from './scripts/reindex.js'

/**
 * env 의 운영 환경 override 추출 — qmd binary / stamp file / sqlite db 위치. plugin 의
 * `getExecEnv()` 가 process env 를 inject 하므로 사용자가 환경별로 path 변경 가능.
 * test 환경에서 결정적 시나리오 검증에도 사용.
 */
function envOverrides(env: Record<string, string>): Partial<ReindexOptions> {
  return {
    ...(env.WIKEY_QMD_STAMP_FILE ? { stampFile: env.WIKEY_QMD_STAMP_FILE } : {}),
    ...(env.WIKEY_QMD_SQLITE_DB ? { sqliteDb: env.WIKEY_QMD_SQLITE_DB } : {}),
    ...(env.WIKEY_QMD_BIN ? { qmdBin: env.WIKEY_QMD_BIN } : {}),
  }
}

export interface ScriptResult {
  readonly success: boolean
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}

export interface RunScriptOptions {
  /** Override default 120s timeout (ms). */
  readonly timeoutMs?: number
}

/**
 * stdout / stderr capture wrapper. logic 함수는 (write, writeErr, signal) 콜백을 받는다.
 *
 * §5.7.1 codex cycle #2 finding #1 fix (2026-05-08):
 *   - 기존 setTimeout 이 clearTimeout 안 해 빠른 호출도 timer 살아있음
 *   - timed-out 작업의 child process (qmd / python) 가 abort 안 돼 background 에서 stamp
 *     갱신 가능 (기존 execFile timeout 은 child kill 했음)
 *   - fix: AbortController.signal 을 fn 에 전달 → reindex 의 spawn 으로 propagate.
 *     finally 에 clearTimeout 으로 timer 정리.
 */
async function captureRun(
  fn: (
    write: (s: string) => void,
    writeErr: (s: string) => void,
    signal: AbortSignal,
  ) => Promise<number>,
  opts?: RunScriptOptions,
): Promise<ScriptResult> {
  const stdoutLines: string[] = []
  const stderrLines: string[] = []
  const write = (s: string) => stdoutLines.push(s)
  const writeErr = (s: string) => stderrLines.push(s)
  const timeout = opts?.timeoutMs ?? 120_000
  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let exitCode: number
  try {
    exitCode = await Promise.race([
      fn(write, writeErr, controller.signal),
      new Promise<number>((_, reject) => {
        timeoutId = setTimeout(() => {
          controller.abort()
          reject(new Error(`script timeout after ${timeout}ms`))
        }, timeout)
      }),
    ])
  } catch (err: unknown) {
    controller.abort()
    const msg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      stdout: stdoutLines.join('\n'),
      stderr: [...stderrLines, msg].join('\n'),
      exitCode: -1,
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
  return {
    success: exitCode === 0,
    stdout: stdoutLines.join('\n'),
    stderr: stderrLines.join('\n'),
    exitCode,
  }
}

export async function validateWiki(
  basePath: string,
  _env: Record<string, string>,
): Promise<ScriptResult> {
  return captureRun(async (write) => {
    const r = await runValidateWiki({ basePath, write })
    return r.exitCode
  })
}

export async function checkPii(
  basePath: string,
  _env: Record<string, string>,
): Promise<ScriptResult> {
  return captureRun(async (write) => {
    const r = await runCheckPii({ basePath, write })
    return r.exitCode
  })
}

export async function reindex(
  basePath: string,
  env: Record<string, string>,
  mode: 'full' | 'quick' = 'full',
): Promise<ScriptResult> {
  return captureRun(async (write, writeErr, signal) => {
    const r = await cmdReindex(
      { basePath, env, write, writeErr, signal, ...envOverrides(env) },
      mode,
    )
    return r.exitCode
  })
}

export async function reindexCheck(
  basePath: string,
  env: Record<string, string>,
): Promise<ScriptResult> {
  return captureRun(async (write, _writeErr, signal) => {
    const r = await cmdCheck({ basePath, env, write, signal, ...envOverrides(env) })
    return r.exitCode
  })
}

export async function costTrackerSummary(
  basePath: string,
  _env: Record<string, string>,
): Promise<ScriptResult> {
  return captureRun(async (write, writeErr) => {
    const r = cmdSummary({ basePath, write, writeErr }, {})
    return r.exitCode
  })
}

/**
 * @deprecated 기존 .sh 의 cost-tracker add 는 (basePath, env, provider, task, cost-string)
 *   3쌍 단순 인자만 받음. 새 in-process API 는 inputTokens / outputTokens 등 풍부한 args
 *   지원하지만, 호환성 위해 기존 시그니처 그대로 유지.
 */
export async function costTrackerAdd(
  basePath: string,
  _env: Record<string, string>,
  provider: string,
  task: string,
  desc: string,
): Promise<ScriptResult> {
  return captureRun(async (write, writeErr) => {
    const args: AddArgs = { provider, task, desc }
    const r = cmdAdd({ basePath, write, writeErr }, args)
    return r.exitCode
  })
}

export async function costTrackerProviders(
  basePath: string,
  _env: Record<string, string>,
): Promise<ScriptResult> {
  return captureRun(async (write) => {
    const r = cmdProviders({ basePath, write })
    return r.exitCode
  })
}

// ── Phase 4 D.0.f (v6 §4.4.2) — reindex freshness contract ──

export type ReindexFreshness = FreshnessStatus

export interface ReindexCheckResult {
  readonly stale: number
  readonly status: ReindexFreshness
  readonly indexed: number
}

const REINDEX_STATUSES: ReadonlySet<ReindexFreshness> = new Set<ReindexFreshness>(['fresh', 'stale', 'never'])

/**
 * `reindex --quick` — qmd update + embed 만 실행. 실패 시 throw.
 */
export async function reindexQuick(
  basePath: string,
  env: Record<string, string>,
  timeoutMs = 60_000,
): Promise<void> {
  const res = await captureRun(
    async (write, writeErr, signal) => {
      const r = await cmdReindex(
        { basePath, env, write, writeErr, signal, ...envOverrides(env) },
        'quick',
      )
      return r.exitCode
    },
    { timeoutMs },
  )
  if (!res.success || res.exitCode !== 0) {
    const stderr = res.stderr?.slice(0, 200) ?? ''
    throw new Error(`reindex --quick failed (exit=${res.exitCode}): ${stderr}`)
  }
}

/**
 * `reindex --check --json` 의 stdout JSON 을 parse + schema 검증. exit code 검증 별도.
 * test 가 schema mismatch 시나리오를 직접 검증할 때 사용.
 */
export function parseReindexCheckJsonOutput(stdout: string): ReindexCheckResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout.trim())
  } catch (err) {
    throw new Error(`reindex --check --json: stdout parse failed (${String(err)})`)
  }
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error(`reindex --check --json: schema mismatch (not an object)`)
  }
  const obj = parsed as Record<string, unknown>
  if (typeof obj.stale !== 'number') {
    throw new Error(`reindex --check --json: schema mismatch (stale not a number, got ${typeof obj.stale})`)
  }
  if (typeof obj.status !== 'string' || !REINDEX_STATUSES.has(obj.status as ReindexFreshness)) {
    throw new Error(`reindex --check --json: schema mismatch (status=${String(obj.status)})`)
  }
  const indexed = typeof obj.indexed === 'number' ? obj.indexed : -1
  return { stale: obj.stale, status: obj.status as ReindexFreshness, indexed }
}

/**
 * `reindex --check --json` — in-process freshness JSON output. parse 실패는 contract 위반.
 */
export async function reindexCheckJson(
  basePath: string,
  env: Record<string, string>,
): Promise<ReindexCheckResult> {
  const res = await captureRun(async (write, _writeErr, signal) => {
    const r = await cmdCheckJson({ basePath, env, write, signal, ...envOverrides(env) })
    return r.exitCode
  })
  if (!res.success || res.exitCode !== 0) {
    throw new Error(`reindex --check --json failed (exit=${res.exitCode}): ${res.stderr?.slice(0, 200) ?? ''}`)
  }
  return parseReindexCheckJsonOutput(res.stdout)
}

/**
 * waitUntilFresh 의 provider injection 형태. test 에서 reindexCheckJson 자체를 mock 하는 대신
 * provider 함수를 자유롭게 주입하여 시나리오 검증.
 */
export type ReindexCheckProvider = () => Promise<ReindexCheckResult>

export async function waitUntilFreshWithProvider(
  provider: ReindexCheckProvider,
  timeoutMs: number,
  intervalMs = 500,
  expectMinIndexed = 0,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastStatus: ReindexFreshness | 'unknown' = 'unknown'
  let lastStale = -1
  let lastIndexed = -1
  while (Date.now() < deadline) {
    try {
      const res = await provider()
      lastStatus = res.status
      lastStale = res.stale
      lastIndexed = res.indexed
      const indexedOk = expectMinIndexed === 0 || res.indexed === -1 || res.indexed >= expectMinIndexed
      if (res.status === 'fresh' && res.stale === 0 && indexedOk) return
    } catch (err) {
      console.warn('[Wikey] reindexCheckJson transient error:', err)
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(
    `freshness timeout after ${timeoutMs}ms (last status=${lastStatus}, stale=${lastStale}, indexed=${lastIndexed}, expectMin=${expectMinIndexed})`,
  )
}

/**
 * Poll `reindexCheckJson` 까지 fresh + stale=0 (+ optional indexed gate) 까지 대기.
 *
 * - 성공 조건: `status === 'fresh' && stale === 0` (+ expectMinIndexed 충족)
 * - §5.14 Layer 6: legacy schema (`indexed === -1`) 는 backwards-compat
 * - Contract 위반 (parse/exit 오류) 은 transient 로 간주, timeoutMs 후 throw
 */
export async function waitUntilFresh(
  basePath: string,
  env: Record<string, string>,
  timeoutMs: number,
  intervalMs = 500,
  expectMinIndexed = 0,
): Promise<void> {
  return waitUntilFreshWithProvider(
    () => reindexCheckJson(basePath, env),
    timeoutMs,
    intervalMs,
    expectMinIndexed,
  )
}
