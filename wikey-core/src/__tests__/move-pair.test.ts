/**
 * move-pair.test.ts — Phase 4.2 Stage 2 S2-1 (plan v3).
 *
 * movePair = registry-aware atomic rename of (original, sidecar) pair,
 * followed by frontmatter rewrite of all ingested source pages.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { movePair } from '../classify.js'
import {
  loadRegistry,
  saveRegistry,
  upsert as registryUpsert,
  REGISTRY_PATH,
  type SourceRegistry,
  type SourceRecord,
} from '../source-registry.js'
import type { WikiFS } from '../types.js'
import { computeFileId, computeFullHash } from '../uri.js'

class DiskFS implements WikiFS {
  constructor(private readonly basePath: string) {}
  async read(path: string): Promise<string> {
    return readFileSync(join(this.basePath, path), 'utf-8')
  }
  async write(path: string, content: string): Promise<void> {
    const full = join(this.basePath, path)
    mkdirSync(join(full, '..'), { recursive: true })
    writeFileSync(full, content, 'utf-8')
  }
  async exists(path: string): Promise<boolean> {
    return existsSync(join(this.basePath, path))
  }
  async list(_dir: string): Promise<string[]> {
    return []
  }
}

let basePath: string
let fs: DiskFS

beforeEach(() => {
  basePath = mkdtempSync(join(tmpdir(), 'wikey-move-pair-'))
  fs = new DiskFS(basePath)
  mkdirSync(join(basePath, 'raw/0_inbox'), { recursive: true })
  mkdirSync(join(basePath, 'wiki/sources'), { recursive: true })
  mkdirSync(join(basePath, '.wikey'), { recursive: true })
})

afterEach(() => {
  rmSync(basePath, { recursive: true, force: true })
})

function writeFile(relPath: string, content: string | Buffer): void {
  const full = join(basePath, relPath)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content as any)
}

async function seedRegistry(record: SourceRecord, id: string): Promise<void> {
  const reg: SourceRegistry = registryUpsert(await loadRegistry(fs), id, record)
  await saveRegistry(fs, reg)
}

describe('movePair — pair-aware move with registry + frontmatter rewrite', () => {
  it('moves original + sidecar together and updates registry', async () => {
    const bytes = Buffer.from('pdf-bytes')
    const id = computeFileId(bytes)
    writeFile('raw/0_inbox/a.pdf', bytes)
    writeFile('raw/0_inbox/a.pdf.md', '# converted\n')
    writeFile(
      'wiki/sources/source-a.md',
      `---
source_id: ${id}
vault_path: raw/0_inbox/a.pdf
sidecar_vault_path: raw/0_inbox/a.pdf.md
hash: ${computeFullHash(bytes)}
size: ${bytes.length}
first_seen: 2026-04-23T00:00:00.000Z
---

# a
`,
    )
    await seedRegistry(
      {
        vault_path: 'raw/0_inbox/a.pdf',
        sidecar_vault_path: 'raw/0_inbox/a.pdf.md',
        hash: computeFullHash(bytes),
        size: bytes.length,
        first_seen: '2026-04-23T00:00:00.000Z',
        ingested_pages: ['wiki/sources/source-a.md'],
        path_history: [{ vault_path: 'raw/0_inbox/a.pdf', at: '2026-04-23T00:00:00.000Z' }],
        tombstone: false,
      },
      id,
    )

    const result = await movePair({
      basePath,
      sourceVaultPath: 'raw/0_inbox/a.pdf',
      destDir: 'raw/3_resources/30_manual/',
      wikiFS: fs,
    })

    expect(result.movedOriginal).toBe(true)
    expect(result.movedSidecar).toBe(true)
    expect(existsSync(join(basePath, 'raw/3_resources/30_manual/a.pdf'))).toBe(true)
    expect(existsSync(join(basePath, 'raw/3_resources/30_manual/a.pdf.md'))).toBe(true)
    expect(existsSync(join(basePath, 'raw/0_inbox/a.pdf'))).toBe(false)
    expect(existsSync(join(basePath, 'raw/0_inbox/a.pdf.md'))).toBe(false)

    const reg = await loadRegistry(fs)
    expect(reg[id]?.vault_path).toBe('raw/3_resources/30_manual/a.pdf')
    expect(reg[id]?.sidecar_vault_path).toBe('raw/3_resources/30_manual/a.pdf.md')

    const page = await fs.read('wiki/sources/source-a.md')
    expect(page).toContain('vault_path: raw/3_resources/30_manual/a.pdf')
    expect(page).toContain('sidecar_vault_path: raw/3_resources/30_manual/a.pdf.md')
    expect(result.rewrittenSourcePages).toEqual(['wiki/sources/source-a.md'])
  })

  it('original-only when no sidecar exists (not-found)', async () => {
    const bytes = Buffer.from('just-bytes')
    writeFile('raw/0_inbox/b.pdf', bytes)
    const result = await movePair({
      basePath,
      sourceVaultPath: 'raw/0_inbox/b.pdf',
      destDir: 'raw/3_resources/30_manual/',
      wikiFS: fs,
    })
    expect(result.movedOriginal).toBe(true)
    expect(result.movedSidecar).toBe(false)
    expect(result.sidecarSkipReason).toBe('not-found')
  })

  it('skips sidecar with dest-conflict but still moves original', async () => {
    const bytes = Buffer.from('pdf-bytes')
    writeFile('raw/0_inbox/c.pdf', bytes)
    writeFile('raw/0_inbox/c.pdf.md', '# inbox sidecar')
    writeFile('raw/3_resources/30_manual/c.pdf.md', '# existing sidecar')
    const result = await movePair({
      basePath,
      sourceVaultPath: 'raw/0_inbox/c.pdf',
      destDir: 'raw/3_resources/30_manual/',
      wikiFS: fs,
    })
    expect(result.movedOriginal).toBe(true)
    expect(result.movedSidecar).toBe(false)
    expect(result.sidecarSkipReason).toBe('dest-conflict')
  })

  it('.md origin file marks as is-md-original (no sidecar concept)', async () => {
    writeFile('raw/0_inbox/note.md', '# a note')
    const result = await movePair({
      basePath,
      sourceVaultPath: 'raw/0_inbox/note.md',
      destDir: 'raw/3_resources/60_note/',
      wikiFS: fs,
    })
    expect(result.movedOriginal).toBe(true)
    expect(result.movedSidecar).toBe(false)
    expect(result.sidecarSkipReason).toBe('is-md-original')
  })

  it('moves folder bundles without sidecar treatment', async () => {
    mkdirSync(join(basePath, 'raw/0_inbox/bundle'), { recursive: true })
    writeFile('raw/0_inbox/bundle/a.pdf', 'a')
    writeFile('raw/0_inbox/bundle/b.pdf', 'b')
    const result = await movePair({
      basePath,
      sourceVaultPath: 'raw/0_inbox/bundle',
      destDir: 'raw/3_resources/30_manual/',
      wikiFS: fs,
    })
    expect(result.movedOriginal).toBe(true)
    expect(result.movedSidecar).toBe(false)
    expect(existsSync(join(basePath, 'raw/3_resources/30_manual/bundle/a.pdf'))).toBe(true)
  })

  it('fallback to filesystem convention when registry has no record', async () => {
    const bytes = Buffer.from('legacy-bytes')
    writeFile('raw/0_inbox/legacy.pdf', bytes)
    writeFile('raw/0_inbox/legacy.pdf.md', '# sidecar')
    const result = await movePair({
      basePath,
      sourceVaultPath: 'raw/0_inbox/legacy.pdf',
      destDir: 'raw/3_resources/30_manual/',
      wikiFS: fs,
    })
    expect(result.movedOriginal).toBe(true)
    expect(result.movedSidecar).toBe(true)
    // No registry record existed — movePair should still succeed, sidecar detected by convention.
  })

  it('rewrites frontmatter for multiple ingested_pages under one source_id', async () => {
    const bytes = Buffer.from('shared-bytes')
    const id = computeFileId(bytes)
    const hash = computeFullHash(bytes)
    writeFile('raw/0_inbox/shared.pdf', bytes)
    writeFile('raw/0_inbox/shared.pdf.md', '# md')
    writeFile(
      'wiki/sources/source-shared-v1.md',
      `---
source_id: ${id}
vault_path: raw/0_inbox/shared.pdf
sidecar_vault_path: raw/0_inbox/shared.pdf.md
hash: ${hash}
size: ${bytes.length}
first_seen: 2026-04-23T00:00:00.000Z
---
# v1`,
    )
    writeFile(
      'wiki/sources/source-shared-v2.md',
      `---
source_id: ${id}
vault_path: raw/0_inbox/shared.pdf
sidecar_vault_path: raw/0_inbox/shared.pdf.md
hash: ${hash}
size: ${bytes.length}
first_seen: 2026-04-23T00:00:00.000Z
---
# v2`,
    )
    await seedRegistry(
      {
        vault_path: 'raw/0_inbox/shared.pdf',
        sidecar_vault_path: 'raw/0_inbox/shared.pdf.md',
        hash,
        size: bytes.length,
        first_seen: '2026-04-23T00:00:00.000Z',
        ingested_pages: ['wiki/sources/source-shared-v1.md', 'wiki/sources/source-shared-v2.md'],
        path_history: [{ vault_path: 'raw/0_inbox/shared.pdf', at: '2026-04-23T00:00:00.000Z' }],
        tombstone: false,
      },
      id,
    )

    const result = await movePair({
      basePath,
      sourceVaultPath: 'raw/0_inbox/shared.pdf',
      destDir: 'raw/3_resources/30_manual/',
      wikiFS: fs,
    })
    expect(result.rewrittenSourcePages).toHaveLength(2)
    for (const p of result.rewrittenSourcePages) {
      const content = await fs.read(p)
      expect(content).toContain('vault_path: raw/3_resources/30_manual/shared.pdf')
    }
  })

  it('idempotent — moving a file already at dest is a no-op', async () => {
    const bytes = Buffer.from('existing')
    writeFile('raw/3_resources/30_manual/already.pdf', bytes)
    const result = await movePair({
      basePath,
      sourceVaultPath: 'raw/3_resources/30_manual/already.pdf',
      destDir: 'raw/3_resources/30_manual/',
      wikiFS: fs,
    })
    // Same dest → original is treated as already-in-place.
    expect(result.movedOriginal).toBe(false)
    expect(existsSync(join(basePath, 'raw/3_resources/30_manual/already.pdf'))).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §5.3.1 Step 4 (plan v11) — sidecar pre-resolve + onSidecarConflict + atomic update
// ─────────────────────────────────────────────────────────────────────────────

describe('§5.3.1 movePair — sidecar pre-resolve + onSidecarConflict (plan v11)', () => {
  it('case 1 — dest-conflict default skip: original moves, registry sidecar_vault_path preserved (existing path)', async () => {
    const bytes = Buffer.from('skip-conflict')
    const id = computeFileId(bytes)
    const hash = computeFullHash(bytes)
    writeFile('raw/0_inbox/c.pdf', bytes)
    writeFile('raw/0_inbox/c.pdf.md', '# inbox sidecar')
    writeFile('raw/3_resources/30_manual/c.pdf.md', '# existing sidecar')
    await seedRegistry(
      {
        vault_path: 'raw/0_inbox/c.pdf',
        sidecar_vault_path: 'raw/0_inbox/c.pdf.md',
        hash,
        size: bytes.length,
        first_seen: '2026-04-25T00:00:00.000Z',
        ingested_pages: ['wiki/sources/source-c.md'],
        path_history: [{ vault_path: 'raw/0_inbox/c.pdf', at: '2026-04-25T00:00:00.000Z' }],
        tombstone: false,
      },
      id,
    )
    writeFile(
      'wiki/sources/source-c.md',
      `---
source_id: ${id}
vault_path: raw/0_inbox/c.pdf
sidecar_vault_path: raw/0_inbox/c.pdf.md
hash: ${hash}
size: ${bytes.length}
first_seen: 2026-04-25T00:00:00.000Z
---
# c
`,
    )
    const result = await movePair({
      basePath,
      sourceVaultPath: 'raw/0_inbox/c.pdf',
      destDir: 'raw/3_resources/30_manual/',
      wikiFS: fs,
      // default onSidecarConflict = 'skip'
    })
    expect(result.movedOriginal).toBe(true)
    expect(result.movedSidecar).toBe(false)
    expect(result.sidecarSkipReason).toBe('dest-conflict')
    // ★ P1-7 v3 정정: skip 분기에서 registry.sidecar_vault_path 는 existing 보존
    const reg = await loadRegistry(fs)
    expect(reg[id]?.vault_path).toBe('raw/3_resources/30_manual/c.pdf')
    expect(reg[id]?.sidecar_vault_path).toBe('raw/0_inbox/c.pdf.md')
    // frontmatter 도 sidecar_vault_path = 이전 위치 보존 (null/덮어쓰기 금지)
    const page = await fs.read('wiki/sources/source-c.md')
    expect(page).toContain('sidecar_vault_path: raw/0_inbox/c.pdf.md')
    expect(page).toContain('vault_path: raw/3_resources/30_manual/c.pdf')
  })

  it("case 2 — dest-conflict + onSidecarConflict='rename': sidecar moved as <base>.<ext>.md.1", async () => {
    const bytes = Buffer.from('rename-conflict')
    writeFile('raw/0_inbox/d.pdf', bytes)
    writeFile('raw/0_inbox/d.pdf.md', '# inbox sidecar')
    writeFile('raw/3_resources/30_manual/d.pdf.md', '# existing sidecar')
    const result = await movePair({
      basePath,
      sourceVaultPath: 'raw/0_inbox/d.pdf',
      destDir: 'raw/3_resources/30_manual/',
      wikiFS: fs,
      onSidecarConflict: 'rename',
    })
    expect(result.movedOriginal).toBe(true)
    expect(result.movedSidecar).toBe(true)
    expect(result.renamedSidecarTo).toBe('raw/3_resources/30_manual/d.pdf.md.1')
    expect(existsSync(join(basePath, 'raw/3_resources/30_manual/d.pdf.md.1'))).toBe(true)
    // existing sidecar untouched
    expect(readFileSync(join(basePath, 'raw/3_resources/30_manual/d.pdf.md'), 'utf-8')).toContain('existing sidecar')
  })

  it("case 3 — exhausted (.1~.9 all taken): original NOT moved, sidecarSkipReason='dest-conflict-exhausted'", async () => {
    const bytes = Buffer.from('exhausted-conflict')
    writeFile('raw/0_inbox/e.pdf', bytes)
    writeFile('raw/0_inbox/e.pdf.md', '# inbox sidecar')
    writeFile('raw/3_resources/30_manual/e.pdf.md', '# existing.md')
    for (let i = 1; i <= 9; i++) {
      writeFile(`raw/3_resources/30_manual/e.pdf.md.${i}`, `# existing.${i}`)
    }
    const result = await movePair({
      basePath,
      sourceVaultPath: 'raw/0_inbox/e.pdf',
      destDir: 'raw/3_resources/30_manual/',
      wikiFS: fs,
      onSidecarConflict: 'rename',
    })
    expect(result.movedOriginal).toBe(false)
    expect(result.movedSidecar).toBe(false)
    expect(result.sidecarSkipReason).toBe('dest-conflict-exhausted')
    // ★ P1-7: original 이동 전 return — inbox 에 그대로
    expect(existsSync(join(basePath, 'raw/0_inbox/e.pdf'))).toBe(true)
  })

  it('case 4 — rename success: registry vault_path + sidecar_vault_path updated atomically', async () => {
    const bytes = Buffer.from('atomic-rename')
    const id = computeFileId(bytes)
    const hash = computeFullHash(bytes)
    writeFile('raw/0_inbox/f.pdf', bytes)
    writeFile('raw/0_inbox/f.pdf.md', '# inbox sidecar')
    writeFile('raw/3_resources/30_manual/f.pdf.md', '# existing sidecar')
    await seedRegistry(
      {
        vault_path: 'raw/0_inbox/f.pdf',
        sidecar_vault_path: 'raw/0_inbox/f.pdf.md',
        hash,
        size: bytes.length,
        first_seen: '2026-04-25T00:00:00.000Z',
        ingested_pages: ['wiki/sources/source-f.md'],
        path_history: [{ vault_path: 'raw/0_inbox/f.pdf', at: '2026-04-25T00:00:00.000Z' }],
        tombstone: false,
      },
      id,
    )
    const result = await movePair({
      basePath,
      sourceVaultPath: 'raw/0_inbox/f.pdf',
      destDir: 'raw/3_resources/30_manual/',
      wikiFS: fs,
      onSidecarConflict: 'rename',
    })
    expect(result.movedOriginal).toBe(true)
    expect(result.movedSidecar).toBe(true)
    expect(result.renamedSidecarTo).toBe('raw/3_resources/30_manual/f.pdf.md.1')
    const reg = await loadRegistry(fs)
    expect(reg[id]?.vault_path).toBe('raw/3_resources/30_manual/f.pdf')
    expect(reg[id]?.sidecar_vault_path).toBe('raw/3_resources/30_manual/f.pdf.md.1')
  })

  it('case 5 — skip default mode keeps registry sidecar_vault_path = previous location (audit-friendly)', async () => {
    const bytes = Buffer.from('skip-default')
    const id = computeFileId(bytes)
    const hash = computeFullHash(bytes)
    writeFile('raw/0_inbox/g.pdf', bytes)
    writeFile('raw/0_inbox/g.pdf.md', '# inbox')
    writeFile('raw/3_resources/30_manual/g.pdf.md', '# existing')
    await seedRegistry(
      {
        vault_path: 'raw/0_inbox/g.pdf',
        sidecar_vault_path: 'raw/0_inbox/g.pdf.md',
        hash,
        size: bytes.length,
        first_seen: '2026-04-25T00:00:00.000Z',
        ingested_pages: [],
        path_history: [{ vault_path: 'raw/0_inbox/g.pdf', at: '2026-04-25T00:00:00.000Z' }],
        tombstone: false,
      },
      id,
    )
    const result = await movePair({
      basePath,
      sourceVaultPath: 'raw/0_inbox/g.pdf',
      destDir: 'raw/3_resources/30_manual/',
      wikiFS: fs,
      onSidecarConflict: 'skip',
    })
    expect(result.movedOriginal).toBe(true)
    expect(result.movedSidecar).toBe(false)
    expect(result.sidecarSkipReason).toBe('dest-conflict')
    const reg = await loadRegistry(fs)
    expect(reg[id]?.vault_path).toBe('raw/3_resources/30_manual/g.pdf')
    expect(reg[id]?.sidecar_vault_path).toBe('raw/0_inbox/g.pdf.md') // preserve
  })

  it('case 6 — skip branch source-page frontmatter sidecar_vault_path preserve (existing not null)', async () => {
    const bytes = Buffer.from('frontmatter-preserve')
    const id = computeFileId(bytes)
    const hash = computeFullHash(bytes)
    writeFile('raw/0_inbox/h.pdf', bytes)
    writeFile('raw/0_inbox/h.pdf.md', '# inbox')
    writeFile('raw/3_resources/30_manual/h.pdf.md', '# existing')
    writeFile(
      'wiki/sources/source-h.md',
      `---
source_id: ${id}
vault_path: raw/0_inbox/h.pdf
sidecar_vault_path: raw/0_inbox/h.pdf.md
hash: ${hash}
size: ${bytes.length}
first_seen: 2026-04-25T00:00:00.000Z
---
# h
`,
    )
    await seedRegistry(
      {
        vault_path: 'raw/0_inbox/h.pdf',
        sidecar_vault_path: 'raw/0_inbox/h.pdf.md',
        hash,
        size: bytes.length,
        first_seen: '2026-04-25T00:00:00.000Z',
        ingested_pages: ['wiki/sources/source-h.md'],
        path_history: [{ vault_path: 'raw/0_inbox/h.pdf', at: '2026-04-25T00:00:00.000Z' }],
        tombstone: false,
      },
      id,
    )
    const result = await movePair({
      basePath,
      sourceVaultPath: 'raw/0_inbox/h.pdf',
      destDir: 'raw/3_resources/30_manual/',
      wikiFS: fs,
      onSidecarConflict: 'skip',
    })
    expect(result.movedOriginal).toBe(true)
    expect(result.sidecarSkipReason).toBe('dest-conflict')
    const page = await fs.read('wiki/sources/source-h.md')
    expect(page).toContain('vault_path: raw/3_resources/30_manual/h.pdf')
    expect(page).toContain('sidecar_vault_path: raw/0_inbox/h.pdf.md') // preserve
    expect(page).not.toContain('sidecar_vault_path: null')
  })
})
