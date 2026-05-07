/**
 * scripts-runner.test.ts — Phase 4 D.0.f (v6 §4.4.2 / §4.4.5) + §5.14 Layer 6.
 *
 * Coverage:
 *   1. reindexCheckJson — fresh / stale N / never 세 status 올바른 parse
 *   2. reindexCheckJson — 깨진 JSON → throw
 *   3. waitUntilFresh — 첫 polling 이 stale 이어도 이후 fresh 로 바뀌면 resolve
 *   4. waitUntilFresh — timeout 초과 시 throw
 *   5. §5.14 L6 — reindexCheckJson 이 indexed 필드 parse, 누락 시 -1 fallback (legacy)
 *   6. §5.14 L6 — waitUntilFresh expectMinIndexed=0 (default) 회귀 없음
 *   7. §5.14 L6 — waitUntilFresh expectMinIndexed>0 + indexed 부족 → polling 지속, timeout throw
 *   8. §5.14 L6 — waitUntilFresh expectMinIndexed>0 + indexed 충분 → resolve
 *   9. §5.14 L6 — waitUntilFresh timeout error message 에 last indexed + expectMin surface
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
    writeMockScript(tmp, '#!/usr/bin/env bash\necho \'{"stale":0,"status":"fresh","indexed":42}\'\nexit 0\n')
    const result = await reindexCheckJson(tmp, {})
    expect(result).toEqual({ stale: 0, status: 'fresh', indexed: 42 })
  })

  it('stale status — stale=N, status=stale 반환', async () => {
    writeMockScript(tmp, '#!/usr/bin/env bash\necho \'{"stale":3,"status":"stale","indexed":7}\'\nexit 0\n')
    const result = await reindexCheckJson(tmp, {})
    expect(result).toEqual({ stale: 3, status: 'stale', indexed: 7 })
  })

  it('never status — stale=-1, status=never 반환', async () => {
    writeMockScript(tmp, '#!/usr/bin/env bash\necho \'{"stale":-1,"status":"never","indexed":0}\'\nexit 0\n')
    const result = await reindexCheckJson(tmp, {})
    expect(result).toEqual({ stale: -1, status: 'never', indexed: 0 })
  })

  it('깨진 JSON → throw (parse 실패 contract violation)', async () => {
    writeMockScript(tmp, '#!/usr/bin/env bash\necho "not json"\nexit 0\n')
    await expect(reindexCheckJson(tmp, {})).rejects.toThrow(/parse failed|schema mismatch/)
  })

  // §5.14 L6 AC: indexed 필드 누락 (legacy schema) → indexed=-1 fallback (backwards compat)
  it('§5.14 L6 — indexed 필드 누락 시 -1 fallback (legacy schema)', async () => {
    writeMockScript(tmp, '#!/usr/bin/env bash\necho \'{"stale":0,"status":"fresh"}\'\nexit 0\n')
    const result = await reindexCheckJson(tmp, {})
    expect(result).toEqual({ stale: 0, status: 'fresh', indexed: -1 })
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
    writeMockScript(tmp, '#!/usr/bin/env bash\necho \'{"stale":0,"status":"fresh","indexed":10}\'\nexit 0\n')
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
  echo '{"stale":0,"status":"fresh","indexed":10}'
else
  echo '{"stale":2,"status":"stale","indexed":8}'
fi
exit 0
`
    writeMockScript(tmp, script)
    // timeout 넉넉히 (3회 polling * 100ms + overhead)
    await expect(waitUntilFresh(tmp, {}, 5000, 100)).resolves.toBeUndefined()
  })

  it('timeout 초과 시 throw (status 계속 stale)', async () => {
    writeMockScript(tmp, '#!/usr/bin/env bash\necho \'{"stale":5,"status":"stale","indexed":3}\'\nexit 0\n')
    await expect(waitUntilFresh(tmp, {}, 600, 100)).rejects.toThrow(/freshness timeout/)
  })

  // §5.14 L6 AC: expectMinIndexed=0 (default) → 회귀 0, indexed 무관
  it('§5.14 L6 — expectMinIndexed=0 (default), indexed=0 도 fresh resolve (회귀 없음)', async () => {
    writeMockScript(tmp, '#!/usr/bin/env bash\necho \'{"stale":0,"status":"fresh","indexed":0}\'\nexit 0\n')
    await expect(waitUntilFresh(tmp, {}, 2000, 50)).resolves.toBeUndefined()
  })

  // §5.14 L6 AC: expectMinIndexed>0 + indexed 부족 → polling 지속 → timeout throw
  it('§5.14 L6 — expectMinIndexed=5, indexed=2 (status=fresh, stale=0) → timeout throw', async () => {
    writeMockScript(tmp, '#!/usr/bin/env bash\necho \'{"stale":0,"status":"fresh","indexed":2}\'\nexit 0\n')
    await expect(waitUntilFresh(tmp, {}, 600, 100, 5)).rejects.toThrow(/freshness timeout/)
  })

  // §5.14 L6 AC: expectMinIndexed>0 + indexed 충분 → resolve
  it('§5.14 L6 — expectMinIndexed=5, indexed=7 (status=fresh, stale=0) → resolve', async () => {
    writeMockScript(tmp, '#!/usr/bin/env bash\necho \'{"stale":0,"status":"fresh","indexed":7}\'\nexit 0\n')
    await expect(waitUntilFresh(tmp, {}, 2000, 50, 5)).resolves.toBeUndefined()
  })

  // §5.14 L6 AC: error message 에 last indexed + expectMin surface (diagnostic)
  it('§5.14 L6 — timeout error 에 indexed + expectMin 포함', async () => {
    writeMockScript(tmp, '#!/usr/bin/env bash\necho \'{"stale":0,"status":"fresh","indexed":3}\'\nexit 0\n')
    await expect(waitUntilFresh(tmp, {}, 400, 100, 10)).rejects.toThrow(/indexed=3.*expectMin=10|expectMin=10.*indexed=3/)
  })

  // §5.14 L6 AC: legacy schema (indexed 누락 → -1) + expectMinIndexed>0 → 통과 (backward compat)
  it('§5.14 L6 — legacy schema (indexed=-1) + expectMinIndexed>0 → 회귀 없음 resolve', async () => {
    writeMockScript(tmp, '#!/usr/bin/env bash\necho \'{"stale":0,"status":"fresh"}\'\nexit 0\n')
    await expect(waitUntilFresh(tmp, {}, 2000, 50, 5)).resolves.toBeUndefined()
  })
})
