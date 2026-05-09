/**
 * §5.7.5 RED — AC-L7 scripts/check-licenses.sh existence + structure.
 *
 * 본 RED 단계는 script 자체의 *형태* 만 검증 (existence + key phrase). 통합 검증은
 * BLUE 3a 의 직접 실행 (`./scripts/check-licenses.sh` exit 0).
 */

import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = join(__dirname, '..', '..', '..', '..')
const SCRIPT_PATH = join(REPO_ROOT, 'scripts', 'check-licenses.sh')

describe('§5.7.5 scripts/check-licenses.sh', () => {
  it('AC-L7: script exists, executable, references Third-party software + dep diff + allowlist', () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true)
    const stat = statSync(SCRIPT_PATH)
    expect((stat.mode & 0o111) !== 0).toBe(true)

    const src = readFileSync(SCRIPT_PATH, 'utf-8')
    expect(src).toMatch(/Third-party software/)
    expect(src).toMatch(/NOTICE/)
    expect(src).toMatch(/package\.json/)
    // workspace dep allowlist (wikey-core internal dep) must be present
    expect(src).toMatch(/wikey-core/)
  })

  it('AC-L7-run: script exits 0 on current repo (NOTICE alignment)', () => {
    // Current repo state must be license-aligned. exit 0 expected.
    let exitCode = 0
    try {
      execSync(`bash ${SCRIPT_PATH}`, { cwd: REPO_ROOT, stdio: 'pipe' })
    } catch (err: unknown) {
      const e = err as { status?: number }
      exitCode = e.status ?? 1
    }
    expect(exitCode).toBe(0)
  })
})
