/**
 * §5.19 v0.5 R4 — `applyStaleTombstoneCleanup`.
 *
 * Spec: §5.19 v0.5 (사용자 raise, 2026-05-12) — 5 카테고리 fix path 중
 *       stale-tombstone purge. registry tombstone 중 raw/wiki 양쪽 부재인 entry
 *       영구 삭제 (purge).
 *
 * Invariants:
 *   I-PURGE-1 (confirm 의무): confirm=false → registry 변경 0.
 *   I-PURGE-2 (idempotent): 같은 input 2회 호출 시 2회째 변경 0.
 *   I-PURGE-3 (dry-run): dryRun=true → registry 변경 0 + result.wouldRemove 채움.
 *   I-PURGE-4 (selective): tombstoneIds 명시 시 그 id 만 purge. 그 외는 보존.
 *   I-PURGE-5 (log entry): purge 후 wiki/log.md 에 `lint-fix | stale-tombstone purge`
 *                          entry append (§5.11 v2 동급).
 */

import { describe, it, expect } from 'vitest'
import type { WikiFS } from '../types.js'
import { applyStaleTombstoneCleanup } from '../wiki/maintenance.js'

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
    __snapshot(): Record<string, string> {
      return Object.fromEntries(store.entries())
    },
  } as WikiFS & { __snapshot(): Record<string, string> }
}

function registryFixture(): Record<string, unknown> {
  return {
    'sha256:stale-1': {
      vault_path: 'raw/3_resources/gone-1.md',
      hash: 'sha256-x',
      size: 100,
      first_seen: '2026-04-01T00:00:00Z',
      ingested_pages: [],
      path_history: [],
      tombstone: true,
    },
    'sha256:stale-2': {
      vault_path: 'raw/3_resources/gone-2.md',
      hash: 'sha256-y',
      size: 200,
      first_seen: '2026-04-02T00:00:00Z',
      ingested_pages: [],
      path_history: [],
      tombstone: true,
    },
    'sha256:active-1': {
      vault_path: 'raw/3_resources/live.md',
      hash: 'sha256-z',
      size: 300,
      first_seen: '2026-04-03T00:00:00Z',
      ingested_pages: [],
      path_history: [],
      tombstone: false,
    },
  }
}

describe('§5.19 v0.5 R4 — applyStaleTombstoneCleanup invariants', () => {
  it('I-PURGE-1: confirm=false → registry 변경 0', async () => {
    const fs = createMockFS({
      '.wikey/source-registry.json': JSON.stringify(registryFixture()),
      'wiki/log.md': '# Log\n',
    })
    const before = await fs.read('.wikey/source-registry.json')
    const report = await applyStaleTombstoneCleanup(fs, {
      confirm: false,
      tombstoneIds: ['sha256:stale-1', 'sha256:stale-2'],
    })
    expect(report.removedIds).toEqual([])
    const after = await fs.read('.wikey/source-registry.json')
    expect(after).toBe(before)
  })

  it('I-PURGE-3: dryRun=true → registry 변경 0 + wouldRemove 채움', async () => {
    const fs = createMockFS({
      '.wikey/source-registry.json': JSON.stringify(registryFixture()),
      'wiki/log.md': '# Log\n',
    })
    const before = await fs.read('.wikey/source-registry.json')
    const report = await applyStaleTombstoneCleanup(fs, {
      confirm: true,
      dryRun: true,
      tombstoneIds: ['sha256:stale-1', 'sha256:stale-2'],
    })
    expect(report.wouldRemove).toEqual(['sha256:stale-1', 'sha256:stale-2'])
    expect(report.removedIds).toEqual([])
    const after = await fs.read('.wikey/source-registry.json')
    expect(after).toBe(before)
  })

  it('I-PURGE-4 selective: tombstoneIds 명시한 id 만 purge, 다른 id 보존', async () => {
    const fs = createMockFS({
      '.wikey/source-registry.json': JSON.stringify(registryFixture()),
      'wiki/log.md': '# Log\n',
    })
    const report = await applyStaleTombstoneCleanup(fs, {
      confirm: true,
      tombstoneIds: ['sha256:stale-1'],
    })
    expect(report.removedIds).toEqual(['sha256:stale-1'])
    const after = JSON.parse(await fs.read('.wikey/source-registry.json'))
    expect(Object.keys(after).sort()).toEqual(['sha256:active-1', 'sha256:stale-2'])
  })

  it('I-PURGE-4 invariant: non-tombstone id 는 명시해도 purge 거부 (active record 보호)', async () => {
    const fs = createMockFS({
      '.wikey/source-registry.json': JSON.stringify(registryFixture()),
      'wiki/log.md': '# Log\n',
    })
    const report = await applyStaleTombstoneCleanup(fs, {
      confirm: true,
      tombstoneIds: ['sha256:active-1'],
    })
    expect(report.removedIds).toEqual([])
    const after = JSON.parse(await fs.read('.wikey/source-registry.json'))
    expect(Object.keys(after).sort()).toEqual([
      'sha256:active-1', 'sha256:stale-1', 'sha256:stale-2',
    ])
  })

  it('I-PURGE-2 idempotent: 같은 input 2회 → 2회째 removedIds 빈', async () => {
    const fs = createMockFS({
      '.wikey/source-registry.json': JSON.stringify(registryFixture()),
      'wiki/log.md': '# Log\n',
    })
    const first = await applyStaleTombstoneCleanup(fs, {
      confirm: true,
      tombstoneIds: ['sha256:stale-1'],
    })
    expect(first.removedIds).toEqual(['sha256:stale-1'])
    const second = await applyStaleTombstoneCleanup(fs, {
      confirm: true,
      tombstoneIds: ['sha256:stale-1'],
    })
    expect(second.removedIds).toEqual([])
  })

  it('I-PURGE-5: purge 발생 시 wiki/log.md 에 lint-fix entry append', async () => {
    const fs = createMockFS({
      '.wikey/source-registry.json': JSON.stringify(registryFixture()),
      'wiki/log.md': '# Log\n',
    })
    await applyStaleTombstoneCleanup(fs, {
      confirm: true,
      tombstoneIds: ['sha256:stale-1', 'sha256:stale-2'],
      today: '2026-05-12',
    })
    const log = await fs.read('wiki/log.md')
    expect(log).toContain('## [2026-05-12]')
    expect(log).toContain('stale-tombstone')
    expect(log).toContain('sha256:stale-1')
    expect(log).toContain('sha256:stale-2')
  })

  it('I-PURGE-5: removedIds=0 면 log entry append 0', async () => {
    const fs = createMockFS({
      '.wikey/source-registry.json': JSON.stringify(registryFixture()),
      'wiki/log.md': '# Log\n',
    })
    const before = await fs.read('wiki/log.md')
    await applyStaleTombstoneCleanup(fs, {
      confirm: true,
      tombstoneIds: ['sha256:active-1'],
    })
    const after = await fs.read('wiki/log.md')
    expect(after).toBe(before)
  })
})
