/**
 * §5.19 Step B (RED) — Spec 2 wiki-check (`runWikiCheck` orchestrator).
 *
 * Spec: plan/phase-5/phase-5-spec-5.19-wiki-maintenance-suite.md v0.2 §1 Spec 2
 *
 * AC mapping (1:1):
 *   - AC-C2-1 → "AC-C2-1: validate-wiki exit code 와 동일 verdict + finding list"
 *   - AC-C2-2 → "AC-C2-2: wiki/analyses/wiki-check-<date>.md 자동 생성 (type=analysis + 4 섹션)"
 *   - AC-C2-3 → "AC-C2-3: stale tombstone detect = reconcileAfterIngest helper 1:1"
 *
 * RED 의도:
 *   - `wikey-core/src/wiki/maintenance.ts` 의 `runWikiCheck()` 미존재 → import-time RED.
 *   - Q1 LOCK contract: stale tombstone detect 는 §5.16 Spec 2 `reconcileAfterIngest` 의
 *     **dry-run mode** 재사용 (코드 중복 0). 현재 `reconcileAfterIngest(reg, walker)` signature
 *     는 dry-run mode 미지원 — developer GREEN 단계에서 3번째 옵션 인자 확장 필요.
 *     본 test 는 그 contract 를 driving (`{ dryRun: true }` 호출 시 registry 변경 없이
 *     restoredIds 만 반환해야 함).
 *
 * Helper signature gap raise (tester → master):
 *   - 현 `reconcileAfterIngest(reg, walker)` → `Promise<{ registry, restoredIds }>` 2-arg.
 *   - 필요: `reconcileAfterIngest(reg, walker, opts?: { dryRun?: boolean })` 3-arg, dryRun=true
 *     시 registry 사이드이펙트 없이 detect 만.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { WikiFS } from '../types.js'
// TODO(developer GREEN): create wikey-core/src/wiki/maintenance.ts exporting:
//   - runWikiCheck(fs: WikiFS, opts?: { today?: string }): Promise<WikiCheckReport>
//   - WikiCheckReport { exitCode, findings: Finding[], analysisPagePath: string,
//                       staleTombstoneIds: string[], danglingCrossLinks: string[] }
import { runWikiCheck, type WikiCheckReport } from '../wiki/maintenance.js'
// §5.19 master decision (2026-05-12 Option C) — `findRestoredIds(reg, walker)` is the
// pure detector; reconcileAfterIngest signature stays unchanged (no `{ dryRun }` extension).
// Both share comparison logic via the same private helpers in source-registry.ts.
import { findRestoredIds } from '../source-registry.js'

function createMockFS(files: Record<string, string> = {}): WikiFS {
  const store = new Map(Object.entries(files))
  return {
    async read(path: string): Promise<string> {
      const content = store.get(path)
      if (content === undefined) throw new Error(`ENOENT: ${path}`)
      return content
    },
    async write(path: string, content: string): Promise<void> {
      store.set(path, content)
    },
    async exists(path: string): Promise<boolean> {
      return store.has(path)
    },
    async list(dir: string): Promise<string[]> {
      return [...store.keys()].filter((k) => k.startsWith(dir))
    },
    // §5.19 Step G fix — recursive .md enumeration mirroring ObsidianWikiFS.walk.
    async walk(dir: string): Promise<string[]> {
      const root = dir.endsWith('/') ? dir.slice(0, -1) : dir
      const prefix = root + '/'
      return [...store.keys()].filter(
        (k) => (k === root || k.startsWith(prefix)) && k.endsWith('.md'),
      )
    },
  }
}

// Reuse fixture from wiki-status test conceptually — minimal vault with 1 stale tombstone +
// 1 broken link + 1 dangling cross-link.
const FIXTURE_FILES: Record<string, string> = {
  'wiki/index.md': `---\ntitle: Index\n---\n`,
  'wiki/log.md': `# log\n`,
  'wiki/entities/lotus-pms.md':
    `---\ntitle: Lotus\ntype: entity\nsources: []\n---\n\nClean.\n`,
  'wiki/sources/source-foo.md':
    `---\ntitle: Source\ntype: source\nsources: []\n---\n\n[[ghost-page]] broken.\n`,
  'wiki/entities/dangling.md':
    `---\ntitle: Dangling\ntype: entity\nsources: [sha256:679cf2dd6db75e3a]\n---\n\nBody.\n`,
  '.wikey/source-registry.json': JSON.stringify({
    'sha256:0101010101010101': {
      vault_path: 'raw/3_resources/foo.md',
      hash: 'sha256-full-hash-01',
      size: 100,
      first_seen: '2026-05-01T00:00:00Z',
      ingested_pages: [],
      path_history: [{ vault_path: 'raw/3_resources/foo.md', at: '2026-05-01T00:00:00Z' }],
      tombstone: true,
    },
  }, null, 2),
  'raw/3_resources/foo.md': 'foo bytes', // disk present → stale tombstone candidate
}

describe('§5.19 Spec 2 — runWikiCheck (Spec 2 AC-C2-1, AC-C2-2, AC-C2-3)', () => {
  // AC-C2-1 ↔ exit code + finding list parity with validate-wiki
  it('AC-C2-1: exit code 와 finding list 가 validate-wiki 결과와 일치', async () => {
    const fs = createMockFS(FIXTURE_FILES)
    const report: WikiCheckReport = await runWikiCheck(fs, { today: '2026-05-12' })

    // exit 0 = healthy, exit != 0 = finding 존재. 본 fixture 는 finding 다수 → exit != 0.
    expect(report.exitCode).not.toBe(0)
    expect(Array.isArray(report.findings)).toBe(true)
    expect(report.findings.length).toBeGreaterThan(0)

    // findings 안에 broken link / dangling / stale tombstone 모두 표현
    const kinds = report.findings.map((f) => f.kind ?? '')
    expect(kinds.some((k) => k.includes('broken') || k.includes('link'))).toBe(true)
    expect(kinds.some((k) => k.includes('dangling') || k.includes('cross-link'))).toBe(true)
    expect(kinds.some((k) => k.includes('tombstone') || k.includes('stale'))).toBe(true)
  })

  // AC-C2-2 ↔ analyses/wiki-check-<date>.md auto-create
  it('AC-C2-2: 실행 후 wiki/analyses/wiki-check-<YYYY-MM-DD>.md 자동 생성 + frontmatter type=analysis + 4 섹션', async () => {
    const fs = createMockFS(FIXTURE_FILES)
    await runWikiCheck(fs, { today: '2026-05-12' })

    const reportPath = 'wiki/analyses/wiki-check-2026-05-12.md'
    expect(await fs.exists(reportPath)).toBe(true)
    const body = await fs.read(reportPath)
    expect(body).toMatch(/^---[\s\S]*type:\s*analysis[\s\S]*---/)
    // 4 section headings (paired-sidecar / registry reconcile / stale tombstone / dangling cross-link)
    expect(body).toMatch(/paired[- ]sidecar/i)
    expect(body).toMatch(/registry[- ]?reconcile|reconcile/i)
    expect(body).toMatch(/stale[- ]tombstone/i)
    expect(body).toMatch(/dangling[- ]cross[- ]link/i)
  })

  // AC-C2-1 extension — validate-wiki failure propagates into merged exit + findings.
  it('AC-C2-1: validateWiki injection exit != 0 → runWikiCheck exit != 0 + findings 포함', async () => {
    const fs = createMockFS(FIXTURE_FILES)
    const validateStub = async () => ({
      exitCode: 1,
      findings: [
        { kind: 'validate-wiki', detail: 'wiki/entities/foo.md: 깨진 위키링크' },
      ],
    })
    const report = await runWikiCheck(fs, { today: '2026-05-12', validateWiki: validateStub })
    expect(report.exitCode).not.toBe(0)
    expect(report.findings.some((f) => f.kind === 'validate-wiki')).toBe(true)
  })

  // AC-C2-3 ↔ helper 1:1 reuse
  it('AC-C2-3: staleTombstoneIds = reconcileAfterIngest(..., { dryRun: true }).restoredIds 와 1:1 동치 (helper 재사용)', async () => {
    const fs = createMockFS(FIXTURE_FILES)

    const report = await runWikiCheck(fs, { today: '2026-05-12' })

    // independent computation via the exact same helper (Option C — pure findRestoredIds)
    const regRaw = await fs.read('.wikey/source-registry.json')
    const reg = JSON.parse(regRaw)
    const walker = async () => {
      // simulate walker that surfaces raw/3_resources/foo.md (disk present)
      return [{ vault_path: 'raw/3_resources/foo.md', bytes: new TextEncoder().encode('foo bytes') }]
    }
    // findRestoredIds is a pure detector — input registry stays untouched.
    const before = JSON.stringify(reg)
    const restoredIds = await findRestoredIds(reg, walker)
    const after = JSON.stringify(reg)
    expect(after).toBe(before) // I5 invariant: pure detect does not mutate input

    // 1:1 동치 — runWikiCheck surfaces the same helper result on its report.
    expect([...report.staleTombstoneIds].sort()).toEqual([...restoredIds].sort())
  })
})
