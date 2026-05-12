/**
 * §5.19 v0.5 R6 — `applyRefactoringArchive`.
 *
 * Spec: §5.19 v0.5 (사용자 raise, 2026-05-12) — Refactoring next step.
 *       duplicates pair / lowUtility 페이지를 wiki/archive/ 로 이동 (이번 cycle
 *       scope = archive 만, merge 본문 합치기는 별 cycle).
 *
 * Invariants:
 *   I-ARCH-1 (confirm 의무): confirm=false → 변경 0.
 *   I-ARCH-2 (idempotent): 같은 input 2회 → 2회째 changedFiles=0.
 *   I-ARCH-3 (dry-run): dryRun=true → 변경 0 + wouldArchive 채움.
 *   I-ARCH-4 (selective): 사용자 선택 paths 만 archive. 그 외 보존.
 *   I-ARCH-5 (path preserve): archive 시 원본 경로 wiki/archive/<original-path> 로 mirror.
 *   I-ARCH-6 (log entry): apply 후 wiki/log.md 에 `lint-fix | refactoring archive` entry.
 */

import { describe, it, expect } from 'vitest'
import type { WikiFS } from '../types.js'
import { applyRefactoringArchive } from '../wiki/maintenance.js'

function createMockFS(files: Record<string, string> = {}): WikiFS & { __snapshot(): Record<string, string> } {
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
    async walk(dir: string): Promise<string[]> {
      const root = dir.endsWith('/') ? dir.slice(0, -1) : dir
      const prefix = root + '/'
      return [...store.keys()].filter((k) => k === root || k.startsWith(prefix))
    },
    async delete(path: string): Promise<void> {
      store.delete(path)
    },
    __snapshot(): Record<string, string> {
      return Object.fromEntries(store.entries())
    },
  } as unknown as WikiFS & { __snapshot(): Record<string, string> }
}

const FIXTURE_FILES: Record<string, string> = {
  'wiki/index.md': '# Index\n',
  'wiki/log.md': '# Log\n',
  'wiki/entities/foo.md': '---\ntitle: foo\n---\n\nFoo content',
  'wiki/entities/bar.md': '---\ntitle: bar\n---\n\nBar content',
  'wiki/analyses/old-analysis.md': '---\ntitle: old\nupdated: 2026-01-01\n---\n\nstale',
}

describe('§5.19 v0.5 R6 — applyRefactoringArchive invariants', () => {
  it('I-ARCH-1: confirm=false → 변경 0', async () => {
    const fs = createMockFS(FIXTURE_FILES)
    const report = await applyRefactoringArchive(fs, {
      confirm: false,
      archivePaths: ['wiki/entities/bar.md', 'wiki/analyses/old-analysis.md'],
    })
    expect(report.archived).toEqual([])
    expect(await fs.exists('wiki/entities/bar.md')).toBe(true)
    expect(await fs.exists('wiki/analyses/old-analysis.md')).toBe(true)
  })

  it('I-ARCH-3: dryRun=true → 변경 0 + wouldArchive 채움', async () => {
    const fs = createMockFS(FIXTURE_FILES)
    const report = await applyRefactoringArchive(fs, {
      confirm: true,
      dryRun: true,
      archivePaths: ['wiki/analyses/old-analysis.md'],
    })
    expect(report.wouldArchive).toEqual(['wiki/analyses/old-analysis.md'])
    expect(report.archived).toEqual([])
    expect(await fs.exists('wiki/analyses/old-analysis.md')).toBe(true)
  })

  it('I-ARCH-4/I-ARCH-5: archive paths → wiki/archive/<original-path> 으로 이동, 원본 삭제', async () => {
    const fs = createMockFS(FIXTURE_FILES)
    const report = await applyRefactoringArchive(fs, {
      confirm: true,
      archivePaths: ['wiki/analyses/old-analysis.md'],
    })
    expect(report.archived).toEqual(['wiki/analyses/old-analysis.md'])
    // 원본 삭제
    expect(await fs.exists('wiki/analyses/old-analysis.md')).toBe(false)
    // archive 위치 생성 (path mirror: wiki/archive/analyses/old-analysis.md)
    expect(await fs.exists('wiki/archive/analyses/old-analysis.md')).toBe(true)
    // 원본 content 보존
    const archived = await fs.read('wiki/archive/analyses/old-analysis.md')
    expect(archived).toContain('stale')
  })

  it('I-ARCH-4 selective: 선택 안한 페이지 보존', async () => {
    const fs = createMockFS(FIXTURE_FILES)
    await applyRefactoringArchive(fs, {
      confirm: true,
      archivePaths: ['wiki/entities/bar.md'],
    })
    expect(await fs.exists('wiki/entities/foo.md')).toBe(true) // 보존
    expect(await fs.exists('wiki/entities/bar.md')).toBe(false) // archived
    expect(await fs.exists('wiki/archive/entities/bar.md')).toBe(true)
  })

  it('I-ARCH-2 idempotent: 두 번째 호출 archived=[] (원본 이미 없음)', async () => {
    const fs = createMockFS(FIXTURE_FILES)
    const first = await applyRefactoringArchive(fs, {
      confirm: true,
      archivePaths: ['wiki/entities/bar.md'],
    })
    expect(first.archived).toEqual(['wiki/entities/bar.md'])
    const second = await applyRefactoringArchive(fs, {
      confirm: true,
      archivePaths: ['wiki/entities/bar.md'],
    })
    expect(second.archived).toEqual([])
  })

  it('I-ARCH-6: archive 발생 시 wiki/log.md 에 lint-fix entry append', async () => {
    const fs = createMockFS(FIXTURE_FILES)
    await applyRefactoringArchive(fs, {
      confirm: true,
      archivePaths: ['wiki/entities/bar.md', 'wiki/analyses/old-analysis.md'],
      today: '2026-05-12',
    })
    const log = await fs.read('wiki/log.md')
    expect(log).toContain('## [2026-05-12]')
    expect(log).toContain('refactoring')
    expect(log).toContain('bar')
    expect(log).toContain('old-analysis')
  })

  it('I-ARCH-6: archived=0 일 때 log append 0', async () => {
    const fs = createMockFS(FIXTURE_FILES)
    const before = await fs.read('wiki/log.md')
    await applyRefactoringArchive(fs, {
      confirm: true,
      archivePaths: ['wiki/entities/nonexistent.md'],
    })
    const after = await fs.read('wiki/log.md')
    expect(after).toBe(before)
  })

  it('archive 대상 페이지 부재 → 조용히 skip, 다른 페이지는 진행', async () => {
    const fs = createMockFS(FIXTURE_FILES)
    const report = await applyRefactoringArchive(fs, {
      confirm: true,
      archivePaths: ['wiki/entities/bar.md', 'wiki/entities/missing.md'],
    })
    expect(report.archived).toEqual(['wiki/entities/bar.md'])
    expect(report.skipped).toEqual(['wiki/entities/missing.md'])
  })
})
