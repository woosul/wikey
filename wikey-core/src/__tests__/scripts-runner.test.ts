/**
 * scripts-runner.test.ts — Phase 4 D.0.f (v6 §4.4.2 / §4.4.5).
 *
 * Coverage:
 *   1. reindexCheckJson — fresh / stale N / never 세 status 올바른 parse
 *   2. reindexCheckJson — 깨진 JSON → throw
 *   3. waitUntilFresh — 첫 polling 이 stale 이어도 이후 fresh 로 바뀌면 resolve
 *   4. waitUntilFresh — timeout 초과 시 throw
 *
 * Strategy:
 *   real shell process 없이 `scripts/reindex.sh` 를 mktemp 디렉터리에 mock 스크립트로
 *   작성해서 실행. scripts-runner 의 `basePath` 에 해당 디렉터리를 넣으면 실제 fork 경로로
 *   검증 가능. Unix 전용 (skipIf Windows).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { reindexCheckJson, waitUntilFresh } from '../scripts-runner.js'

function writeMockScript(baseDir: string, body: string): void {
  const scriptsDir = join(baseDir, 'scripts')
  mkdirSync(scriptsDir, { recursive: true })
  const scriptPath = join(scriptsDir, 'reindex.sh')
  writeFileSync(scriptPath, body, 'utf-8')
  chmodSync(scriptPath, 0o755)
}

describe('reindexCheckJson — JSON parse', () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'wikey-reindex-'))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it('fresh status — stale=0, status=fresh 반환', async () => {
    writeMockScript(tmp, '#!/usr/bin/env bash\necho \'{"stale":0,"status":"fresh"}\'\nexit 0\n')
    const result = await reindexCheckJson(tmp, {})
    expect(result).toEqual({ stale: 0, status: 'fresh' })
  })

  it('stale status — stale=N, status=stale 반환', async () => {
    writeMockScript(tmp, '#!/usr/bin/env bash\necho \'{"stale":3,"status":"stale"}\'\nexit 0\n')
    const result = await reindexCheckJson(tmp, {})
    expect(result).toEqual({ stale: 3, status: 'stale' })
  })

  it('never status — stale=-1, status=never 반환', async () => {
    writeMockScript(tmp, '#!/usr/bin/env bash\necho \'{"stale":-1,"status":"never"}\'\nexit 0\n')
    const result = await reindexCheckJson(tmp, {})
    expect(result).toEqual({ stale: -1, status: 'never' })
  })

  it('깨진 JSON → throw (parse 실패 contract violation)', async () => {
    writeMockScript(tmp, '#!/usr/bin/env bash\necho "not json"\nexit 0\n')
    await expect(reindexCheckJson(tmp, {})).rejects.toThrow(/parse failed|schema mismatch/)
  })
})

describe('waitUntilFresh — polling', () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'wikey-reindex-wait-'))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it('즉시 fresh → resolve 반환값 없음', async () => {
    writeMockScript(tmp, '#!/usr/bin/env bash\necho \'{"stale":0,"status":"fresh"}\'\nexit 0\n')
    await expect(waitUntilFresh(tmp, {}, 2000, 50)).resolves.toBeUndefined()
  })

  it('처음 stale → fresh 로 전이 후 resolve (counter-based mock)', async () => {
    // 상태 파일에 호출 횟수를 기록, 3회째부터 fresh 반환.
    const stateFile = join(tmp, 'state.txt')
    writeFileSync(stateFile, '0', 'utf-8')
    const script = `#!/usr/bin/env bash
cnt=$(cat "${stateFile}")
next=$((cnt + 1))
echo "$next" > "${stateFile}"
if [ "$next" -ge 3 ]; then
  echo '{"stale":0,"status":"fresh"}'
else
  echo '{"stale":2,"status":"stale"}'
fi
exit 0
`
    writeMockScript(tmp, script)
    // timeout 넉넉히 (3회 polling * 100ms + overhead)
    await expect(waitUntilFresh(tmp, {}, 5000, 100)).resolves.toBeUndefined()
  })

  it('timeout 초과 시 throw (status 계속 stale)', async () => {
    writeMockScript(tmp, '#!/usr/bin/env bash\necho \'{"stale":5,"status":"stale"}\'\nexit 0\n')
    await expect(waitUntilFresh(tmp, {}, 600, 100)).rejects.toThrow(/freshness timeout/)
  })
})
