/**
 * scripts-runner.ts — 기존 bash 스크립트 래퍼
 *
 * validate-wiki.sh, check-pii.sh, cost-tracker.sh, reindex.sh를
 * Obsidian 플러그인에서 실행 가능하게 래핑.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// Phase 4 D.0.f (v6 §4.4.2): ScriptResult 확장 — exitCode 필드 신규.
// 기존 `success` 만으로는 exec 실패 원인 구분 불가 (실행 실패 vs 정상 non-zero exit).
// 신규 helper (reindexCheckJson, reindexQuick) 가 exitCode 를 contract 검증에 사용.
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

async function runScript(
  basePath: string,
  script: string,
  args: string[],
  env: Record<string, string>,
  opts?: RunScriptOptions,
): Promise<ScriptResult> {
  const { join } = require('node:path') as typeof import('node:path')
  const scriptPath = join(basePath, script)
  const timeout = opts?.timeoutMs ?? 120000

  try {
    const { stdout, stderr } = await execFileAsync(scriptPath, args, {
      cwd: basePath,
      timeout,
      env,
    })
    return { success: true, stdout, stderr, exitCode: 0 }
  } catch (err: any) {
    const code = typeof err?.code === 'number' ? err.code : -1
    return {
      success: false,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? err.message ?? String(err),
      exitCode: code,
    }
  }
}

export async function validateWiki(basePath: string, env: Record<string, string>): Promise<ScriptResult> {
  return runScript(basePath, 'scripts/validate-wiki.sh', [], env)
}

export async function checkPii(basePath: string, env: Record<string, string>): Promise<ScriptResult> {
  return runScript(basePath, 'scripts/check-pii.sh', [], env)
}

export async function reindex(
  basePath: string,
  env: Record<string, string>,
  mode: 'full' | 'quick' = 'full',
): Promise<ScriptResult> {
  const args = mode === 'quick' ? ['--quick'] : []
  return runScript(basePath, 'scripts/reindex.sh', args, env)
}

export async function reindexCheck(basePath: string, env: Record<string, string>): Promise<ScriptResult> {
  return runScript(basePath, 'scripts/reindex.sh', ['--check'], env)
}

export async function costTrackerSummary(basePath: string, env: Record<string, string>): Promise<ScriptResult> {
  return runScript(basePath, 'scripts/cost-tracker.sh', ['summary'], env)
}

export async function costTrackerAdd(
  basePath: string,
  env: Record<string, string>,
  provider: string,
  task: string,
  cost: string,
): Promise<ScriptResult> {
  return runScript(basePath, 'scripts/cost-tracker.sh', ['add', provider, task, cost], env)
}

// ── Phase 4 D.0.f (v6 §4.4.2) — reindex freshness contract ──

export type ReindexFreshness = 'fresh' | 'stale' | 'never'

export interface ReindexCheckResult {
  /** 신선: 0, 구버전: 변경된 파일 수, 미실행: -1 */
  readonly stale: number
  readonly status: ReindexFreshness
}

const REINDEX_STATUSES: ReadonlySet<ReindexFreshness> = new Set<ReindexFreshness>(['fresh', 'stale', 'never'])

/**
 * `reindex.sh --quick` — qmd update + embed 만 실행. ingest pipeline 이 신규 페이지 후
 * invoke. 실패 시 throw (Stage 2 gate 가 잘못 열리는 것 방지).
 */
export async function reindexQuick(
  basePath: string,
  env: Record<string, string>,
  timeoutMs = 60_000,
): Promise<void> {
  const res = await runScript(basePath, 'scripts/reindex.sh', ['--quick'], env, { timeoutMs })
  if (!res.success || res.exitCode !== 0) {
    const stderr = res.stderr?.slice(0, 200) ?? ''
    throw new Error(`reindex --quick failed (exit=${res.exitCode}): ${stderr}`)
  }
}

/**
 * `reindex.sh --check --json` — structured freshness output.
 *
 * Contract (plan v6 §4.4.1 / §4.4.2):
 *   stdout 에 단일 JSON 라인 `{"stale": number, "status": "fresh"|"stale"|"never"}`
 *   exit 0. 파싱 실패 · exit ≠ 0 · schema mismatch · enum 외 status 는 throw.
 */
export async function reindexCheckJson(
  basePath: string,
  env: Record<string, string>,
): Promise<ReindexCheckResult> {
  const res = await runScript(basePath, 'scripts/reindex.sh', ['--check', '--json'], env)
  if (!res.success || res.exitCode !== 0) {
    throw new Error(`reindex --check --json failed (exit=${res.exitCode}): ${res.stderr?.slice(0, 200) ?? ''}`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(res.stdout.trim())
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
  return { stale: obj.stale, status: obj.status as ReindexFreshness }
}

/**
 * Poll `reindexCheckJson` 까지 `status === 'fresh' && stale === 0` 만족할 때까지 대기.
 *
 * - 성공 조건: `status === 'fresh' && stale === 0` **만** 해당 (plan v6 §4.4.2 v5 엄격화).
 *   `status === 'never'` (index 미실행) 은 fresh 가 아님 — polling 지속.
 * - Contract 위반 (parse/exit 오류) 은 transient 로 간주하고 재시도. timeoutMs 넘으면 throw.
 */
export async function waitUntilFresh(
  basePath: string,
  env: Record<string, string>,
  timeoutMs: number,
  intervalMs = 500,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await reindexCheckJson(basePath, env)
      if (res.status === 'fresh' && res.stale === 0) return
    } catch (err) {
      // transient — 구버전 reindex.sh 등. timeout 까지 재시도.
      console.warn('[Wikey] reindexCheckJson transient error:', err)
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`freshness timeout after ${timeoutMs}ms (never reached status=fresh && stale=0)`)
}
