/**
 * scripts-runner.ts — 기존 bash 스크립트 래퍼
 *
 * validate-wiki.sh, check-pii.sh, cost-tracker.sh, reindex.sh를
 * Obsidian 플러그인에서 실행 가능하게 래핑.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface ScriptResult {
  readonly success: boolean
  readonly stdout: string
  readonly stderr: string
}

async function runScript(
  basePath: string,
  script: string,
  args: string[],
  env: Record<string, string>,
): Promise<ScriptResult> {
  const { join } = require('node:path') as typeof import('node:path')
  const scriptPath = join(basePath, script)

  try {
    const { stdout, stderr } = await execFileAsync(scriptPath, args, {
      cwd: basePath,
      timeout: 120000,
      env,
    })
    return { success: true, stdout, stderr }
  } catch (err: any) {
    return {
      success: false,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? err.message ?? String(err),
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
