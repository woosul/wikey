/**
 * integration-pair-move.test.ts — Phase 4.2 Stage 1+2 E2E (plan v3).
 *
 * 시나리오: ingest 직후 상태를 모사 → movePair → registry / frontmatter 정합 확인 + reconcile.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { movePair } from '../classify.js'
import {
  loadRegistry,
  saveRegistry,
  upsert as registryUpsert,
  reconcile as registryReconcile,
  REGISTRY_PATH,
  type SourceRecord,
} from '../source-registry.js'
import type { WikiFS } from '../types.js'
import { computeFileId, computeFullHash } from '../uri.js'
import { injectSourceFrontmatter, type SourceFrontmatter } from '../wiki-ops.js'

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
  basePath = mkdtempSync(join(tmpdir(), 'wikey-integ-pm-'))
  fs = new DiskFS(basePath)
  mkdirSync(join(basePath, '.wikey'), { recursive: true })
})

afterEach(() => rmSync(basePath, { recursive: true, force: true }))

async function seedIngested(vaultPath: string, bytes: Buffer, pageSlug: string): Promise<string> {
  mkdirSync(join(basePath, vaultPath, '..'), { recursive: true })
  writeFileSync(join(basePath, vaultPath), bytes)
  const sidecar = `${vaultPath}.md`
  writeFileSync(join(basePath, sidecar), '# converted markdown\n')

  const id = computeFileId(bytes)
  const hash = computeFullHash(bytes)
  const now = new Date().toISOString()
  const meta: SourceFrontmatter = {
    source_id: id,
    vault_path: vaultPath,
    sidecar_vault_path: sidecar,
    hash,
    size: bytes.length,
    first_seen: now,
  }
  const pageContent = injectSourceFrontmatter(`# ${pageSlug}\n\n본문`, meta)
  await fs.write(`wiki/sources/${pageSlug}.md`, pageContent)

  const record: SourceRecord = {
    vault_path: vaultPath,
    sidecar_vault_path: sidecar,
    hash,
    size: bytes.length,
    first_seen: now,
    ingested_pages: [`wiki/sources/${pageSlug}.md`],
    path_history: [{ vault_path: vaultPath, at: now }],
    tombstone: false,
  }
  await saveRegistry(fs, registryUpsert(await loadRegistry(fs), id, record))
  return id
}

describe('integration — ingest → movePair → frontmatter/registry coherence', () => {
  it('E2E: single source moves pair, frontmatter reflects new vault_path', async () => {
    const bytes = Buffer.from('PDF-1.7 payload bytes')
    const id = await seedIngested('raw/0_inbox/doc.pdf', bytes, 'source-doc')

    const result = await movePair({
      basePath,
      sourceVaultPath: 'raw/0_inbox/doc.pdf',
      destDir: 'raw/3_resources/30_manual/',
      wikiFS: fs,
    })

    expect(result.movedOriginal).toBe(true)
    expect(result.movedSidecar).toBe(true)
    expect(existsSync(join(basePath, 'raw/3_resources/30_manual/doc.pdf'))).toBe(true)
    expect(existsSync(join(basePath, 'raw/3_resources/30_manual/doc.pdf.md'))).toBe(true)

    const reg = await loadRegistry(fs)
    expect(reg[id]?.vault_path).toBe('raw/3_resources/30_manual/doc.pdf')
    expect(reg[id]?.sidecar_vault_path).toBe('raw/3_resources/30_manual/doc.pdf.md')
    expect(reg[id]?.path_history).toHaveLength(2)

    const page = await fs.read('wiki/sources/source-doc.md')
    expect(page).toContain('vault_path: raw/3_resources/30_manual/doc.pdf')
    expect(page).toContain('sidecar_vault_path: raw/3_resources/30_manual/doc.pdf.md')
    // Non-managed content preserved.
    expect(page).toContain('# source-doc')
    expect(page).toContain('본문')
  })

  it('multiple ingested_pages per source — all frontmatter files updated', async () => {
    const bytes = Buffer.from('shared source bytes')
    const id = computeFileId(bytes)
    const hash = computeFullHash(bytes)
    const vaultPath = 'raw/0_inbox/shared.pdf'
    mkdirSync(join(basePath, vaultPath, '..'), { recursive: true })
    writeFileSync(join(basePath, vaultPath), bytes)
    writeFileSync(join(basePath, `${vaultPath}.md`), '# md')

    const now = new Date().toISOString()
    const meta: SourceFrontmatter = {
      source_id: id,
      vault_path: vaultPath,
      sidecar_vault_path: `${vaultPath}.md`,
      hash,
      size: bytes.length,
      first_seen: now,
    }
    for (const slug of ['source-shared-v1', 'source-shared-v2']) {
      const pageContent = injectSourceFrontmatter(`# ${slug}\n\n본문`, meta)
      await fs.write(`wiki/sources/${slug}.md`, pageContent)
    }
    const record: SourceRecord = {
      vault_path: vaultPath,
      sidecar_vault_path: `${vaultPath}.md`,
      hash,
      size: bytes.length,
      first_seen: now,
      ingested_pages: ['wiki/sources/source-shared-v1.md', 'wiki/sources/source-shared-v2.md'],
      path_history: [{ vault_path: vaultPath, at: now }],
      tombstone: false,
    }
    await saveRegistry(fs, registryUpsert(await loadRegistry(fs), id, record))

    const result = await movePair({
      basePath,
      sourceVaultPath: vaultPath,
      destDir: 'raw/3_resources/30_manual/',
      wikiFS: fs,
    })
    expect(result.rewrittenSourcePages).toHaveLength(2)
    for (const p of result.rewrittenSourcePages) {
      const content = await fs.read(p)
      expect(content).toContain('vault_path: raw/3_resources/30_manual/shared.pdf')
    }
  })

  it('reconcile — external move (bash/Finder) recovered on next scan', async () => {
    const bytes = Buffer.from('recon bytes')
    const id = await seedIngested('raw/0_inbox/recon.pdf', bytes, 'source-recon')

    // Simulate external move by renaming files directly, without touching registry.
    const { renameSync } = await import('node:fs')
    const newDir = join(basePath, 'raw/3_resources/30_manual')
    mkdirSync(newDir, { recursive: true })
    renameSync(join(basePath, 'raw/0_inbox/recon.pdf'), join(newDir, 'recon.pdf'))
    renameSync(join(basePath, 'raw/0_inbox/recon.pdf.md'), join(newDir, 'recon.pdf.md'))

    // Registry still points at old location.
    let reg = await loadRegistry(fs)
    expect(reg[id]?.vault_path).toBe('raw/0_inbox/recon.pdf')

    // Reconcile with a walker that scans current fs state.
    const walker = async () => [
      { vault_path: 'raw/3_resources/30_manual/recon.pdf', bytes: new Uint8Array(bytes) },
    ]
    reg = await registryReconcile(reg, walker)
    await saveRegistry(fs, reg)

    const fresh = await loadRegistry(fs)
    expect(fresh[id]?.vault_path).toBe('raw/3_resources/30_manual/recon.pdf')
    expect(fresh[id]?.path_history).toHaveLength(2)
  })
})
