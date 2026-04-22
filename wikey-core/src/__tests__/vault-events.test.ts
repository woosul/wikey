/**
 * vault-events.test.ts — Phase 4.2 Stage 4 S4-1/S4-2 pure helpers.
 *
 * vault.on('rename') / vault.on('delete') 가 호출할 "부작용 집계" 헬퍼의 단위 테스트.
 * Obsidian 의 TAbstractFile / Plugin.registerEvent 에 의존하지 않고, WikiFS + 레지스트리만 사용.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import type { WikiFS } from '../types.js'
import {
  loadRegistry,
  saveRegistry,
  upsert as registryUpsert,
  type SourceRecord,
} from '../source-registry.js'
import { injectSourceFrontmatter } from '../wiki-ops.js'
import {
  reconcileExternalRename,
  handleExternalDelete,
  RenameGuard,
} from '../vault-events.js'
import { computeFileId, computeFullHash } from '../uri.js'

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
  async list(_dir: string): Promise<string[]> {
    return []
  }
}

async function seed(fs: MemoryFS, oldPath: string, bytes: Uint8Array, slug: string): Promise<string> {
  const id = computeFileId(bytes)
  const hash = computeFullHash(bytes)
  const now = new Date('2026-04-23T00:00:00Z').toISOString()

  const page = injectSourceFrontmatter(`# ${slug}\n\n본문`, {
    source_id: id,
    vault_path: oldPath,
    sidecar_vault_path: `${oldPath}.md`,
    hash,
    size: bytes.length,
    first_seen: now,
  })
  await fs.write(`wiki/sources/${slug}.md`, page)

  const record: SourceRecord = {
    vault_path: oldPath,
    sidecar_vault_path: `${oldPath}.md`,
    hash,
    size: bytes.length,
    first_seen: now,
    ingested_pages: [`wiki/sources/${slug}.md`],
    path_history: [{ vault_path: oldPath, at: now }],
    tombstone: false,
  }
  await saveRegistry(fs, registryUpsert(await loadRegistry(fs), id, record))
  return id
}

// ── RenameGuard: double-move 방지용 큐 프로토콜 ──

describe('RenameGuard — expectedRenames queue (§4.2.4 S4-1)', () => {
  it('register → consume 매칭 시 true 반환 + 큐에서 제거', () => {
    const g = new RenameGuard()
    g.register('raw/3_resources/x.pdf')
    expect(g.size()).toBe(1)
    expect(g.consume('raw/3_resources/x.pdf')).toBe(true)
    expect(g.size()).toBe(0)
    // 두 번째 consume 은 이미 소비되어 false
    expect(g.consume('raw/3_resources/x.pdf')).toBe(false)
  })

  it('TTL 만료 후 consume 실패 (stale 큐 정리)', () => {
    const clock = { now: 1_000_000 }
    const g = new RenameGuard(() => clock.now)
    g.register('a.pdf', 500)
    clock.now += 1000 // TTL 초과
    expect(g.consume('a.pdf')).toBe(false)
    // stale 엔트리는 purge 되어야 함
    expect(g.size()).toBe(0)
  })

  it('한 번에 여러 경로 register', () => {
    const g = new RenameGuard()
    g.register('a.pdf')
    g.register('a.pdf.md')
    expect(g.size()).toBe(2)
    expect(g.consume('a.pdf.md')).toBe(true)
    expect(g.consume('a.pdf')).toBe(true)
  })
})

// ── reconcileExternalRename: 사용자가 Obsidian UI 에서 파일만 이동했을 때 ──

describe('reconcileExternalRename (§4.2.4 S4-1)', () => {
  let fs: MemoryFS
  beforeEach(() => {
    fs = new MemoryFS()
  })

  it('registry + frontmatter 동시 갱신', async () => {
    const bytes = new TextEncoder().encode('content-ext-1')
    const id = await seed(fs, 'raw/0_inbox/ext.pdf', bytes, 'source-ext')

    // Obsidian 이 이미 원본 파일 위치를 이동시켰다고 가정 — registry/페이지는 아직 옛 경로.
    const result = await reconcileExternalRename({
      wikiFS: fs,
      oldVaultPath: 'raw/0_inbox/ext.pdf',
      newVaultPath: 'raw/3_resources/30_manual/ext.pdf',
      newSidecarVaultPath: 'raw/3_resources/30_manual/ext.pdf.md',
    })

    expect(result.sourceId).toBe(id)
    expect(result.rewrittenPages).toEqual(['wiki/sources/source-ext.md'])
    const reg = await loadRegistry(fs)
    expect(reg[id]?.vault_path).toBe('raw/3_resources/30_manual/ext.pdf')
    expect(reg[id]?.sidecar_vault_path).toBe('raw/3_resources/30_manual/ext.pdf.md')
    const page = await fs.read('wiki/sources/source-ext.md')
    expect(page).toContain('vault_path: raw/3_resources/30_manual/ext.pdf')
  })

  it('registry 미등록 경로 → sourceId undefined (silently skip)', async () => {
    const result = await reconcileExternalRename({
      wikiFS: fs,
      oldVaultPath: 'raw/0_inbox/unknown.pdf',
      newVaultPath: 'raw/3_resources/unknown.pdf',
    })
    expect(result.sourceId).toBeUndefined()
    expect(result.rewrittenPages).toEqual([])
  })

  // §4.2 핵심 불변성: 이동 후에도 다른 wiki 페이지의 wikilink 는 bit-identical 유지.
  it('링크 안정성 — entity/concept 페이지의 [[source-xxx]] wikilink 는 수정되지 않음', async () => {
    const bytes = new TextEncoder().encode('content-stability')
    await seed(fs, 'raw/0_inbox/linked.pdf', bytes, 'source-linked')
    const entityBody =
      '---\ntitle: Entity\n---\n\n근거는 [[source-linked]]. 관련 [[concept-other]] 참고.\n'
    await fs.write('wiki/entities/entity.md', entityBody)
    const before = await fs.read('wiki/entities/entity.md')

    await reconcileExternalRename({
      wikiFS: fs,
      oldVaultPath: 'raw/0_inbox/linked.pdf',
      newVaultPath: 'raw/4_archive/2026/linked.pdf',
    })

    const after = await fs.read('wiki/entities/entity.md')
    expect(after).toBe(before)
    expect(after).toContain('[[source-linked]]')
  })
})

// ── handleExternalDelete: 사용자가 raw/ 에서 원본을 삭제했을 때 ──

describe('handleExternalDelete (§4.2.4 S4-2)', () => {
  let fs: MemoryFS
  beforeEach(() => {
    fs = new MemoryFS()
  })

  it('registry tombstone + source 페이지에 banner 1회 추가', async () => {
    const bytes = new TextEncoder().encode('content-del')
    const id = await seed(fs, 'raw/0_inbox/del.pdf', bytes, 'source-del')

    const result = await handleExternalDelete({
      wikiFS: fs,
      deletedVaultPath: 'raw/0_inbox/del.pdf',
      at: '2026-04-23',
    })

    expect(result.sourceId).toBe(id)
    expect(result.bannersAdded).toEqual(['wiki/sources/source-del.md'])
    const reg = await loadRegistry(fs)
    expect(reg[id]?.tombstone).toBe(true)

    const page = await fs.read('wiki/sources/source-del.md')
    expect(page).toContain('[!warning] 원본 삭제됨')
    expect(page).toContain('2026-04-23')
  })

  it('동일 경로 재삭제 이벤트 → idempotent (banner 중복 안 붙음)', async () => {
    const bytes = new TextEncoder().encode('content-del-2')
    await seed(fs, 'raw/0_inbox/del2.pdf', bytes, 'source-del2')
    await handleExternalDelete({
      wikiFS: fs,
      deletedVaultPath: 'raw/0_inbox/del2.pdf',
      at: '2026-04-23',
    })
    await handleExternalDelete({
      wikiFS: fs,
      deletedVaultPath: 'raw/0_inbox/del2.pdf',
      at: '2026-04-23',
    })
    const page = await fs.read('wiki/sources/source-del2.md')
    const count = (page.match(/\[!warning\] 원본 삭제됨/g) || []).length
    expect(count).toBe(1)
  })

  it('registry 미등록 경로 → no-op', async () => {
    const result = await handleExternalDelete({
      wikiFS: fs,
      deletedVaultPath: 'raw/0_inbox/never-seen.pdf',
      at: '2026-04-23',
    })
    expect(result.sourceId).toBeUndefined()
    expect(result.bannersAdded).toEqual([])
  })
})
