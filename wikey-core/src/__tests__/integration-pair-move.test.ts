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
  findById as registryFindById,
  REGISTRY_PATH,
  type SourceRecord,
} from '../source-registry.js'
import type { WikiFS } from '../types.js'
import { computeFileId, computeFullHash } from '../uri.js'
import { injectSourceFrontmatter, type SourceFrontmatter } from '../wiki-ops.js'
import {
  RenameGuard,
  reconcileExternalRename,
  handleExternalDelete,
} from '../vault-events.js'

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

  // §4.2 의 핵심 불변성 (사용자 확인, 2026-04-23):
  //   "원본 파일이 이동해도 wiki 페이지의 wikilink(원본 링크)는 업데이트 없이 유지된다."
  // → 이동 시 변경되는 것은 source 페이지 frontmatter `vault_path` 단 하나.
  //   source 페이지의 파일명(slug)과 다른 wiki 페이지의 `[[source-xyz]]` wikilink 는
  //   bit-identical 유지. 이 테스트가 그 invariant 를 회귀 방지선으로 고정한다.
  it('링크 안정성 — 원본 파일 이동 후에도 다른 wiki 페이지의 wikilink/본문 bit-identical', async () => {
    const bytes = Buffer.from('stable citation source')
    const id = await seedIngested('raw/0_inbox/stable.pdf', bytes, 'source-stable')

    // Seed an entity page citing the source via wikilink.
    const entityBody =
      '---\ntitle: Stable Entity\n---\n\n' +
      '# Stable Entity\n\n' +
      '핵심 근거는 [[source-stable]] 에서 인용한다. ' +
      '다른 링크 [[concept-foo]] 도 유지.\n'
    await fs.write('wiki/entities/stable-entity.md', entityBody)

    const entityBefore = await fs.read('wiki/entities/stable-entity.md')
    const sourcePageBefore = await fs.read('wiki/sources/source-stable.md')

    // Move raw file to a deep PARA location.
    const result = await movePair({
      basePath,
      sourceVaultPath: 'raw/0_inbox/stable.pdf',
      destDir: 'raw/3_resources/30_manual/500_natural_science/',
      wikiFS: fs,
    })
    expect(result.movedOriginal).toBe(true)

    // Invariant 1: entity page 는 바이트 단위 동일 — 이동이 wikilink 를 건드리지 않음.
    const entityAfter = await fs.read('wiki/entities/stable-entity.md')
    expect(entityAfter).toBe(entityBefore)
    expect(entityAfter).toContain('[[source-stable]]')

    // Invariant 2: source 페이지 파일명(slug) 불변 → [[source-stable]] 여전히 resolve.
    expect(await fs.exists('wiki/sources/source-stable.md')).toBe(true)

    // Invariant 3: source 페이지 frontmatter vault_path 만 갱신, 본문·다른 필드 보존.
    const sourcePageAfter = await fs.read('wiki/sources/source-stable.md')
    expect(sourcePageAfter).not.toBe(sourcePageBefore)
    expect(sourcePageAfter).toContain(
      'vault_path: raw/3_resources/30_manual/500_natural_science/stable.pdf',
    )
    expect(sourcePageAfter).toContain('source_id:') // id 불변
    expect(sourcePageAfter).toContain('# source-stable') // 본문 보존
    expect(sourcePageAfter).toContain('본문')

    // Invariant 4: registry id 불변, path_history 가 과거 위치를 보존.
    const reg = await loadRegistry(fs)
    expect(reg[id]).toBeDefined()
    expect(reg[id]!.path_history[0].vault_path).toBe('raw/0_inbox/stable.pdf')
    expect(reg[id]!.vault_path).toBe(
      'raw/3_resources/30_manual/500_natural_science/stable.pdf',
    )
  })

  it('링크 안정성 — reconcile 경로(외부 mv) 에서도 wiki 페이지 링크 보존', async () => {
    const bytes = Buffer.from('external mv stable')
    const id = await seedIngested('raw/0_inbox/extmv.pdf', bytes, 'source-extmv')
    await fs.write(
      'wiki/concepts/stable-concept.md',
      '---\ntitle: C\n---\n\n[[source-extmv]] 을 참조.\n',
    )
    const conceptBefore = await fs.read('wiki/concepts/stable-concept.md')

    // 외부 mv 모사 — registry/frontmatter 는 아직 옛 경로.
    const { renameSync } = await import('node:fs')
    const newDir = join(basePath, 'raw/2_areas/hardware')
    mkdirSync(newDir, { recursive: true })
    renameSync(join(basePath, 'raw/0_inbox/extmv.pdf'), join(newDir, 'extmv.pdf'))
    renameSync(join(basePath, 'raw/0_inbox/extmv.pdf.md'), join(newDir, 'extmv.pdf.md'))

    // reconcile 재스캔.
    const walker = async () => [
      { vault_path: 'raw/2_areas/hardware/extmv.pdf', bytes: new Uint8Array(bytes) },
    ]
    const reg = await registryReconcile(await loadRegistry(fs), walker)
    await saveRegistry(fs, reg)

    // 외부 mv 경로에서도 concept wikilink 는 변동 없음.
    const conceptAfter = await fs.read('wiki/concepts/stable-concept.md')
    expect(conceptAfter).toBe(conceptBefore)
    expect(conceptAfter).toContain('[[source-extmv]]')

    // registry 는 새 경로로 갱신.
    const fresh = await loadRegistry(fs)
    expect(fresh[id]?.vault_path).toBe('raw/2_areas/hardware/extmv.pdf')
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

  // §4.2.4 Stage 4 real-disk integration — 사용자 2026-04-23 지적 반영:
  //   "실질적인 파일 이동 테스트같은건 진행 안한거 같은데?"
  // → vault-events helper 들이 실제 fs.renameSync / unlinkSync 와 결합한 경로를 회귀선화.

  it('Stage 4 UI 이동 시나리오 — 실제 fs rename + reconcileExternalRename 후 wikilink bit-identical', async () => {
    const { renameSync } = await import('node:fs')
    const bytes = Buffer.from('ui-rename real-disk')
    const id = await seedIngested('raw/0_inbox/uirename.pdf', bytes, 'source-uirename')

    // 다른 wiki 페이지에 wikilink.
    const entityBody =
      '---\ntitle: Ref\n---\n\n근거 [[source-uirename]]. 관련 [[source-uirename|표시이름]] 도 유지.\n'
    await fs.write('wiki/entities/ref-entity.md', entityBody)
    const entityBefore = await fs.read('wiki/entities/ref-entity.md')

    // 사용자가 Obsidian UI 로 이동시켰다고 가정 — 실제 파일 먼저 이동 (원본 + sidecar 짝).
    const newDir = join(basePath, 'raw/2_areas/study')
    mkdirSync(newDir, { recursive: true })
    renameSync(join(basePath, 'raw/0_inbox/uirename.pdf'), join(newDir, 'uirename.pdf'))
    renameSync(join(basePath, 'raw/0_inbox/uirename.pdf.md'), join(newDir, 'uirename.pdf.md'))

    // 그 다음 vault-event handler 가 호출될 때와 동일한 상태로 reconcileExternalRename.
    const result = await reconcileExternalRename({
      wikiFS: fs,
      oldVaultPath: 'raw/0_inbox/uirename.pdf',
      newVaultPath: 'raw/2_areas/study/uirename.pdf',
      newSidecarVaultPath: 'raw/2_areas/study/uirename.pdf.md',
    })
    expect(result.sourceId).toBe(id)

    // 원본/sidecar 실제 새 경로 존재.
    expect(existsSync(join(newDir, 'uirename.pdf'))).toBe(true)
    expect(existsSync(join(newDir, 'uirename.pdf.md'))).toBe(true)
    // 옛 경로는 사라짐.
    expect(existsSync(join(basePath, 'raw/0_inbox/uirename.pdf'))).toBe(false)

    // 링크 안정성: entity 페이지 바이트 동일.
    const entityAfter = await fs.read('wiki/entities/ref-entity.md')
    expect(entityAfter).toBe(entityBefore)

    // source 페이지 frontmatter `vault_path` 는 새 위치.
    const sourcePage = await fs.read('wiki/sources/source-uirename.md')
    expect(sourcePage).toContain('vault_path: raw/2_areas/study/uirename.pdf')
    expect(sourcePage).toContain('sidecar_vault_path: raw/2_areas/study/uirename.pdf.md')

    // registry 갱신 확인.
    const reg = await loadRegistry(fs)
    expect(reg[id]?.vault_path).toBe('raw/2_areas/study/uirename.pdf')
    expect(reg[id]?.sidecar_vault_path).toBe('raw/2_areas/study/uirename.pdf.md')
  })

  it('Stage 4 삭제 시나리오 — 실제 unlink + handleExternalDelete 후 wikilink 페이지 유지, source 만 banner', async () => {
    const { unlinkSync } = await import('node:fs')
    const bytes = Buffer.from('delete-flow real-disk')
    const id = await seedIngested('raw/0_inbox/todelete.pdf', bytes, 'source-todelete')
    const entityBody =
      '---\ntitle: Del\n---\n\n[[source-todelete]] 는 근거. 삭제 후에도 링크 불변.\n'
    await fs.write('wiki/entities/del-entity.md', entityBody)
    const entityBefore = await fs.read('wiki/entities/del-entity.md')

    // 실제 파일 삭제 (사용자가 Finder/Obsidian 에서 지웠다고 가정).
    unlinkSync(join(basePath, 'raw/0_inbox/todelete.pdf'))
    unlinkSync(join(basePath, 'raw/0_inbox/todelete.pdf.md'))

    const result = await handleExternalDelete({
      wikiFS: fs,
      deletedVaultPath: 'raw/0_inbox/todelete.pdf',
      at: '2026-04-23',
    })
    expect(result.sourceId).toBe(id)

    // 링크 안정성: entity 페이지는 바이트 동일 (wikilink 변경 없음).
    expect(await fs.read('wiki/entities/del-entity.md')).toBe(entityBefore)
    // source 페이지는 banner 추가 + frontmatter 보존.
    const sourcePage = await fs.read('wiki/sources/source-todelete.md')
    expect(sourcePage).toContain('[!warning] 원본 삭제됨')
    expect(sourcePage).toContain('2026-04-23')
    expect(sourcePage).toContain('source_id:') // frontmatter intact
    // registry tombstone.
    const reg = await loadRegistry(fs)
    expect(reg[id]?.tombstone).toBe(true)
  })

  it('Stage 4 startup reconcile 종합 시나리오 — multi-file 외부 이동·삭제·복원 한 번에 처리', async () => {
    const { renameSync, unlinkSync, writeFileSync } = await import('node:fs')
    // 3 개 파일 seed.
    const bytesA = Buffer.from('multi A')
    const bytesB = Buffer.from('multi B')
    const bytesC = Buffer.from('multi C')
    const idA = await seedIngested('raw/0_inbox/a.pdf', bytesA, 'source-a')
    const idB = await seedIngested('raw/0_inbox/b.pdf', bytesB, 'source-b')
    const idC = await seedIngested('raw/0_inbox/c.pdf', bytesC, 'source-c')

    // 다른 페이지에서 각 source 를 인용.
    await fs.write(
      'wiki/analyses/multi.md',
      '---\ntitle: Multi\n---\n\n[[source-a]] · [[source-b]] · [[source-c]] 종합.\n',
    )
    const analysisBefore = await fs.read('wiki/analyses/multi.md')

    // 시나리오: A 는 이동, B 는 삭제, C 는 현 위치 유지.
    mkdirSync(join(basePath, 'raw/3_resources/30_manual'), { recursive: true })
    renameSync(
      join(basePath, 'raw/0_inbox/a.pdf'),
      join(basePath, 'raw/3_resources/30_manual/a.pdf'),
    )
    renameSync(
      join(basePath, 'raw/0_inbox/a.pdf.md'),
      join(basePath, 'raw/3_resources/30_manual/a.pdf.md'),
    )
    unlinkSync(join(basePath, 'raw/0_inbox/b.pdf'))
    unlinkSync(join(basePath, 'raw/0_inbox/b.pdf.md'))

    // startup reconcile 모사 — walker 는 현재 fs 를 반영.
    const walker = async () => [
      { vault_path: 'raw/3_resources/30_manual/a.pdf', bytes: new Uint8Array(bytesA) },
      { vault_path: 'raw/0_inbox/c.pdf', bytes: new Uint8Array(bytesC) },
    ]
    const reg = await registryReconcile(await loadRegistry(fs), walker)
    await saveRegistry(fs, reg)
    const fresh = await loadRegistry(fs)

    // A: 새 경로로 갱신.
    expect(fresh[idA]?.vault_path).toBe('raw/3_resources/30_manual/a.pdf')
    expect(fresh[idA]?.tombstone).toBe(false)
    // B: tombstone.
    expect(fresh[idB]?.tombstone).toBe(true)
    // C: 변동 없음.
    expect(fresh[idC]?.vault_path).toBe('raw/0_inbox/c.pdf')
    expect(fresh[idC]?.tombstone).toBe(false)

    // 링크 안정성: analyses 페이지 바이트 동일 — A 이동 · B 삭제 모두 analyses 본문을 건드리지 않음.
    expect(await fs.read('wiki/analyses/multi.md')).toBe(analysisBefore)

    // 복원 시나리오: B 를 다시 복원 (같은 해시).
    writeFileSync(join(basePath, 'raw/0_inbox/b.pdf'), bytesB)
    const walker2 = async () => [
      { vault_path: 'raw/3_resources/30_manual/a.pdf', bytes: new Uint8Array(bytesA) },
      { vault_path: 'raw/0_inbox/b.pdf', bytes: new Uint8Array(bytesB) },
      { vault_path: 'raw/0_inbox/c.pdf', bytes: new Uint8Array(bytesC) },
    ]
    const restored = await registryReconcile(fresh, walker2)
    expect(restored[idB]?.tombstone).toBe(false)
    expect(restored[idB]?.vault_path).toBe('raw/0_inbox/b.pdf')
    // analyses 페이지는 모든 사이클 후에도 같은 바이트.
    expect(await fs.read('wiki/analyses/multi.md')).toBe(analysisBefore)
  })

  it('Stage 4 RenameGuard + movePair 통합 — 실제 fs 이동에서 guard 가 자기 이벤트 소비', async () => {
    const bytes = Buffer.from('guard real')
    const id = await seedIngested('raw/0_inbox/guarded.pdf', bytes, 'source-guarded')

    const guard = new RenameGuard()
    await movePair({
      basePath,
      sourceVaultPath: 'raw/0_inbox/guarded.pdf',
      destDir: 'raw/3_resources/30_manual/',
      wikiFS: fs,
      renameGuard: guard,
    })

    // movePair 가 new path 두 개 (원본 + sidecar) 를 pre-register 했어야 함.
    // 리스너라면 consume 해서 둘 다 매칭되고 skip 경로로 빠져야 정상.
    expect(guard.consume('raw/3_resources/30_manual/guarded.pdf')).toBe(true)
    expect(guard.consume('raw/3_resources/30_manual/guarded.pdf.md')).toBe(true)
    // 더 이상 아무것도 남지 않음.
    expect(guard.size()).toBe(0)

    // 이중 검증: registry/페이지도 정상 이동.
    const reg = await loadRegistry(fs)
    expect(reg[id]?.vault_path).toBe('raw/3_resources/30_manual/guarded.pdf')
  })
})
