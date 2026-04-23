/**
 * reset.test.ts — Phase 4.5.2 (본체 필수).
 *
 * computeDeletionImpact: raw/ 소스 또는 wiki 페이지 삭제 시 영향 범위 순수 계산.
 * previewReset:         scope별 리셋 대상 파일 목록 + 바이트 총합 순수 계산.
 *
 * 모두 순수 함수 — fs 부작용 없음. 실제 삭제는 commands.ts 가 수행.
 */

import { describe, it, expect } from 'vitest'
import {
  computeDeletionImpact,
  previewReset,
  type ResetScope,
} from '../reset.js'
import type { WikiFS } from '../types.js'
import {
  REGISTRY_PATH,
  type SourceRegistry,
  type SourceRecord,
} from '../source-registry.js'

class MemoryFS implements WikiFS {
  files = new Map<string, string>()
  async read(path: string): Promise<string> {
    const v = this.files.get(path)
    if (v == null) throw new Error(`ENOENT ${path}`)
    return v
  }
  async write(path: string, content: string): Promise<void> {
    this.files.set(path, content)
  }
  async exists(path: string): Promise<boolean> {
    return this.files.has(path)
  }
  async list(dir: string): Promise<string[]> {
    const prefix = dir.endsWith('/') ? dir : `${dir}/`
    return [...this.files.keys()].filter((p) => p.startsWith(prefix) || p === dir)
  }
}

function makeRecord(opts: {
  vault_path: string
  hash: string
  ingested_pages: readonly string[]
  tombstone?: boolean
}): SourceRecord {
  return {
    vault_path: opts.vault_path,
    sidecar_vault_path: `${opts.vault_path}.md`,
    hash: opts.hash,
    size: 100,
    first_seen: '2026-04-23T00:00:00Z',
    ingested_pages: opts.ingested_pages,
    path_history: [{ vault_path: opts.vault_path, at: '2026-04-23T00:00:00Z' }],
    tombstone: opts.tombstone ?? false,
  }
}

// ─────────────────────────────────────────────────────────────
//  computeDeletionImpact — raw/ source 삭제 케이스
// ─────────────────────────────────────────────────────────────

describe('computeDeletionImpact — raw/ source', () => {
  it('single source: returns ingested pages + registry record + 0 backlinks', async () => {
    const fs = new MemoryFS()
    const id = 'sha256:aaaaaaaaaaaaaaaa'
    const record = makeRecord({
      vault_path: 'raw/1_projects/a/foo.pdf',
      hash: 'aaa',
      ingested_pages: ['wiki/sources/source-foo.md'],
    })
    const reg: SourceRegistry = { [id]: record }
    await fs.write('wiki/sources/source-foo.md', '# foo\n\n원본 내용.')

    const impact = await computeDeletionImpact({
      wikiFS: fs,
      registry: reg,
      target: { kind: 'source', vault_path: 'raw/1_projects/a/foo.pdf' },
    })

    expect(impact.pages).toEqual(['wiki/sources/source-foo.md'])
    expect(impact.registryRecord?.id).toBe(id)
    expect(impact.registryRecord?.record.vault_path).toBe('raw/1_projects/a/foo.pdf')
    expect(impact.backlinks).toBe(0)
  })

  it('bundled: returns all ingested pages when source emitted multiple wiki pages', async () => {
    const fs = new MemoryFS()
    const id = 'sha256:bbbbbbbbbbbbbbbb'
    const record = makeRecord({
      vault_path: 'raw/1_projects/a/bundle.pdf',
      hash: 'bbb',
      ingested_pages: [
        'wiki/sources/source-bundle.md',
        'wiki/entities/acme.md',
        'wiki/concepts/pmbok.md',
      ],
    })
    const reg: SourceRegistry = { [id]: record }
    for (const p of record.ingested_pages) await fs.write(p, `# ${p}`)

    const impact = await computeDeletionImpact({
      wikiFS: fs,
      registry: reg,
      target: { kind: 'source', vault_path: 'raw/1_projects/a/bundle.pdf' },
    })

    expect(impact.pages).toEqual([
      'wiki/sources/source-bundle.md',
      'wiki/entities/acme.md',
      'wiki/concepts/pmbok.md',
    ])
    expect(impact.registryRecord?.id).toBe(id)
  })

  it('tombstoned: still returns the record (caller decides policy)', async () => {
    const fs = new MemoryFS()
    const id = 'sha256:cccccccccccccccc'
    const record = makeRecord({
      vault_path: 'raw/1_projects/gone.pdf',
      hash: 'ccc',
      ingested_pages: ['wiki/sources/source-gone.md'],
      tombstone: true,
    })
    const reg: SourceRegistry = { [id]: record }
    await fs.write('wiki/sources/source-gone.md', '# gone')

    const impact = await computeDeletionImpact({
      wikiFS: fs,
      registry: reg,
      target: { kind: 'source', vault_path: 'raw/1_projects/gone.pdf' },
    })

    expect(impact.registryRecord?.record.tombstone).toBe(true)
    expect(impact.pages).toEqual(['wiki/sources/source-gone.md'])
  })

  it('raw file not in registry: returns empty impact', async () => {
    const fs = new MemoryFS()
    const reg: SourceRegistry = {}

    const impact = await computeDeletionImpact({
      wikiFS: fs,
      registry: reg,
      target: { kind: 'source', vault_path: 'raw/1_projects/ghost.pdf' },
    })

    expect(impact.pages).toEqual([])
    expect(impact.registryRecord).toBeUndefined()
    expect(impact.backlinks).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────
//  computeDeletionImpact — wiki-only 페이지 삭제 케이스
// ─────────────────────────────────────────────────────────────

describe('computeDeletionImpact — wiki page', () => {
  it('wiki-only page with backlinks: counts distinct referencing pages', async () => {
    const fs = new MemoryFS()
    await fs.write('wiki/entities/acme.md', '# Acme')
    await fs.write('wiki/analyses/report.md', '# Report\n\n[[acme]] 의 동향.')
    await fs.write('wiki/concepts/strategy.md', '# Strategy\n\n[[acme]] 와 [[acme]] 재참조.')
    // 링크 없는 페이지
    await fs.write('wiki/concepts/unrelated.md', '# Unrelated\n\nno link.')

    const impact = await computeDeletionImpact({
      wikiFS: fs,
      registry: {},
      target: { kind: 'wiki-page', page_path: 'wiki/entities/acme.md' },
    })

    expect(impact.pages).toEqual(['wiki/entities/acme.md'])
    expect(impact.backlinks).toBe(2) // report + strategy (same-page dup not double-counted)
    expect(impact.registryRecord).toBeUndefined()
  })

  it('wiki page with zero backlinks: backlinks = 0', async () => {
    const fs = new MemoryFS()
    await fs.write('wiki/entities/orphan.md', '# Orphan')
    await fs.write('wiki/concepts/something.md', '# Something')

    const impact = await computeDeletionImpact({
      wikiFS: fs,
      registry: {},
      target: { kind: 'wiki-page', page_path: 'wiki/entities/orphan.md' },
    })

    expect(impact.backlinks).toBe(0)
    expect(impact.pages).toEqual(['wiki/entities/orphan.md'])
  })
})

// ─────────────────────────────────────────────────────────────
//  previewReset — scope별 대상 산출
// ─────────────────────────────────────────────────────────────

describe('previewReset', () => {
  async function seed(fs: MemoryFS): Promise<void> {
    // wiki 트리
    await fs.write('wiki/index.md', '# index')
    await fs.write('wiki/log.md', '# log')
    await fs.write('wiki/sources/source-a.md', '# a')
    await fs.write('wiki/entities/acme.md', '# acme')
    await fs.write('wiki/concepts/pmbok.md', '# pmbok')
    await fs.write('wiki/analyses/report.md', '# report')
    // registry
    await fs.write(REGISTRY_PATH, JSON.stringify({}))
    // raw/ (건드리면 안 됨)
    await fs.write('raw/1_projects/foo.pdf', '(binary)')
  }

  it('wiki+registry: lists all wiki/** files and registry JSON; excludes raw/', async () => {
    const fs = new MemoryFS()
    await seed(fs)

    const preview = await previewReset({ wikiFS: fs, scope: 'wiki+registry' })

    expect(preview.files).toContain('wiki/index.md')
    expect(preview.files).toContain('wiki/sources/source-a.md')
    expect(preview.files).toContain('wiki/entities/acme.md')
    expect(preview.files).toContain(REGISTRY_PATH)
    expect(preview.files).not.toContain('raw/1_projects/foo.pdf')
    expect(preview.bytes).toBeGreaterThan(0)
  })

  it('wiki-only: includes wiki/** but excludes registry JSON', async () => {
    const fs = new MemoryFS()
    await seed(fs)

    const preview = await previewReset({ wikiFS: fs, scope: 'wiki-only' })

    expect(preview.files).toContain('wiki/entities/acme.md')
    expect(preview.files).not.toContain(REGISTRY_PATH)
    expect(preview.files).not.toContain('raw/1_projects/foo.pdf')
  })

  it('registry-only: lists only registry JSON', async () => {
    const fs = new MemoryFS()
    await seed(fs)

    const preview = await previewReset({ wikiFS: fs, scope: 'registry-only' })

    expect(preview.files).toEqual([REGISTRY_PATH])
  })

  it('qmd-index: lists the qmd cache marker (caller resolves abs path)', async () => {
    const fs = new MemoryFS()
    await seed(fs)

    const preview = await previewReset({ wikiFS: fs, scope: 'qmd-index' })

    // qmd-index 는 WikiFS 가 보이지 않는 외부 캐시 — preview 는 marker 만 반환.
    expect(preview.files.some((f) => f.includes('qmd'))).toBe(true)
  })

  it('settings: lists plugin data.json path marker', async () => {
    const fs = new MemoryFS()
    await seed(fs)

    const preview = await previewReset({ wikiFS: fs, scope: 'settings' })

    expect(preview.files.some((f) => f.endsWith('data.json'))).toBe(true)
  })

  it('rejects unknown scope', async () => {
    const fs = new MemoryFS()
    await seed(fs)
    await expect(
      previewReset({ wikiFS: fs, scope: 'bogus' as ResetScope }),
    ).rejects.toThrow(/unknown|scope/i)
  })
})
