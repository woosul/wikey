/**
 * source-registry.test.ts — Phase 4.2 Stage 1 S1-2 (plan v3).
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  loadRegistry,
  saveRegistry,
  upsert,
  findById,
  findByIdPrefix,
  findByPath,
  findByHash,
  recordMove,
  recordDelete,
  restoreTombstone,
  reconcile,
  appendPendingProtection,
  clearPendingProtection,
  appendDuplicateLocation,
  recordMoveWithSidecar,
  REGISTRY_PATH,
  type SourceRegistry,
  type SourceRecord,
  type PendingProtection,
  type ReingestAction,
} from '../source-registry.js'
import type { WikiFS } from '../types.js'
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
    return [...this.files.keys()]
  }
}

function makeRecord(path: string, hash: string, size = 100): SourceRecord {
  return {
    vault_path: path,
    sidecar_vault_path: `${path}.md`,
    hash,
    size,
    first_seen: new Date('2026-04-22T00:00:00Z').toISOString(),
    ingested_pages: [`wiki/sources/source-${path.split('/').pop()}.md`],
    path_history: [{ vault_path: path, at: new Date('2026-04-22T00:00:00Z').toISOString() }],
    tombstone: false,
  }
}

describe('loadRegistry', () => {
  it('returns empty object when file does not exist', async () => {
    const fs = new MemoryFS()
    const reg = await loadRegistry(fs)
    expect(reg).toEqual({})
  })

  it('parses existing JSON', async () => {
    const fs = new MemoryFS()
    const id = 'sha256:aaaaaaaaaaaaaaaa'
    const seed: SourceRegistry = { [id]: makeRecord('raw/x.pdf', 'aaa...') }
    await fs.write(REGISTRY_PATH, JSON.stringify(seed))
    const reg = await loadRegistry(fs)
    expect(reg[id]?.vault_path).toBe('raw/x.pdf')
  })

  it('recovers from corrupted JSON with backup + warn', async () => {
    const fs = new MemoryFS()
    await fs.write(REGISTRY_PATH, '{ not valid json')
    const reg = await loadRegistry(fs)
    expect(reg).toEqual({})
    expect(await fs.exists(`${REGISTRY_PATH}.bak`)).toBe(true)
  })
})

describe('upsert + findById', () => {
  it('stores a record and retrieves it by id', async () => {
    const fs = new MemoryFS()
    const id = computeFileId(new TextEncoder().encode('hello'))
    let reg = await loadRegistry(fs)
    reg = upsert(reg, id, makeRecord('raw/hello.pdf', computeFullHash(new TextEncoder().encode('hello'))))
    await saveRegistry(fs, reg)
    const fresh = await loadRegistry(fs)
    expect(findById(fresh, id)?.vault_path).toBe('raw/hello.pdf')
  })
})

describe('findByIdPrefix — full-hash verification', () => {
  it('returns record when prefix matches single id', () => {
    const fs = new MemoryFS()
    const bytes = new TextEncoder().encode('prefix-test')
    const id = computeFileId(bytes)
    const hash = computeFullHash(bytes)
    let reg: SourceRegistry = {}
    reg = upsert(reg, id, makeRecord('raw/x.pdf', hash))
    const prefixHex = id.slice('sha256:'.length)
    const result = findByIdPrefix(reg, prefixHex, bytes)
    expect(result?.record.vault_path).toBe('raw/x.pdf')
  })

  it('disambiguates when two records share a prefix (simulated collision)', () => {
    // Simulate a collision by storing two records under prefixes that share leading chars.
    const bytesA = new TextEncoder().encode('content-A')
    const bytesB = new TextEncoder().encode('content-B')
    const hashA = computeFullHash(bytesA)
    const hashB = computeFullHash(bytesB)
    // Force both into a registry with synthetic colliding prefix.
    const collidingPrefix = 'ffffffffffffffff'
    const reg: SourceRegistry = {
      [`sha256:${collidingPrefix}`]: makeRecord('raw/A.pdf', hashA),
      [`sha256:${collidingPrefix}other`]: makeRecord('raw/B.pdf', hashB), // different key but same prefix
    }
    // findByIdPrefix with bytesA should return A, bytesB should return B (by full-hash verify).
    const rA = findByIdPrefix(reg, collidingPrefix, bytesA)
    const rB = findByIdPrefix(reg, collidingPrefix, bytesB)
    expect(rA?.record.vault_path).toBe('raw/A.pdf')
    expect(rB?.record.vault_path).toBe('raw/B.pdf')
  })
})

describe('findByPath', () => {
  it('matches current vault_path', () => {
    const reg: SourceRegistry = {
      'sha256:1': makeRecord('raw/current.pdf', 'h1'),
    }
    expect(findByPath(reg, 'raw/current.pdf')?.id).toBe('sha256:1')
  })

  it('matches historical paths in path_history', () => {
    const rec = makeRecord('raw/3_resources/new.pdf', 'h1')
    const withHistory: SourceRecord = {
      ...rec,
      path_history: [
        { vault_path: 'raw/0_inbox/new.pdf', at: '2026-04-22T00:00:00Z' },
        { vault_path: 'raw/3_resources/new.pdf', at: '2026-04-22T01:00:00Z' },
      ],
    }
    const reg: SourceRegistry = { 'sha256:1': withHistory }
    expect(findByPath(reg, 'raw/0_inbox/new.pdf')?.id).toBe('sha256:1')
    expect(findByPath(reg, 'raw/3_resources/new.pdf')?.id).toBe('sha256:1')
  })
})

describe('findByHash', () => {
  it('matches full hash', () => {
    const reg: SourceRegistry = { 'sha256:1': makeRecord('raw/x.pdf', 'fullhash123') }
    expect(findByHash(reg, 'fullhash123')?.id).toBe('sha256:1')
  })
})

describe('recordMove', () => {
  it('updates vault_path, appends path_history, updates sidecar', () => {
    let reg: SourceRegistry = {
      'sha256:1': makeRecord('raw/0_inbox/a.pdf', 'h'),
    }
    reg = recordMove(reg, 'sha256:1', 'raw/3_resources/a.pdf', 'raw/3_resources/a.pdf.md')
    const r = findById(reg, 'sha256:1')!
    expect(r.vault_path).toBe('raw/3_resources/a.pdf')
    expect(r.sidecar_vault_path).toBe('raw/3_resources/a.pdf.md')
    expect(r.path_history.length).toBe(2)
    expect(r.path_history.at(-1)?.vault_path).toBe('raw/3_resources/a.pdf')
  })

  // §5.2.9: recordMove 가 호출된다 = 파일이 disk 에 있어서 move 한다 → tombstone 해제.
  // 이전 reconcile (case 3) 이 walker 누락으로 잘못 tombstone 마킹한 record 가 다음
  // movePair 시 자동 복구되도록.
  it('clears tombstone flag (move implies file is alive)', () => {
    let reg: SourceRegistry = {
      'sha256:1': { ...makeRecord('raw/0_inbox/a.pdf', 'h'), tombstone: true },
    }
    reg = recordMove(reg, 'sha256:1', 'raw/3_resources/a.pdf')
    const r = findById(reg, 'sha256:1')!
    expect(r.tombstone).toBe(false)
  })
})

describe('recordDelete + restoreTombstone', () => {
  it('toggles tombstone flag', () => {
    let reg: SourceRegistry = {
      'sha256:1': makeRecord('raw/x.pdf', 'h'),
    }
    reg = recordDelete(reg, 'sha256:1')
    expect(findById(reg, 'sha256:1')?.tombstone).toBe(true)
    reg = restoreTombstone(reg, 'sha256:1')
    expect(findById(reg, 'sha256:1')?.tombstone).toBe(false)
  })
})

describe('reconcile — startup scan', () => {
  it('detects vault_path mismatch and updates from fs walker', async () => {
    // A file was moved outside Obsidian (bash/Finder). walker reports new location.
    let reg: SourceRegistry = {
      'sha256:1': makeRecord('raw/0_inbox/moved.pdf', 'deadbeef'),
    }
    const walker = async () => [
      // (vault_path, bytes) pairs of what actually exists.
      { vault_path: 'raw/3_resources/moved.pdf', bytes: new TextEncoder().encode('x') },
    ]
    // Fake full-hash equality: override hash in record to match the bytes' hash.
    const bytes = new TextEncoder().encode('x')
    reg['sha256:1'] = { ...reg['sha256:1']!, hash: computeFullHash(bytes) }

    reg = await reconcile(reg, walker)
    expect(findById(reg, 'sha256:1')?.vault_path).toBe('raw/3_resources/moved.pdf')
    // path_history got the new entry.
    expect(findById(reg, 'sha256:1')?.path_history.length).toBe(2)
  })

  // §4.2.4 Stage 4 S4-3: reconcile 확장 — tombstone missing, restore reappearing.
  it('missing record (not in walker) → tombstone', async () => {
    const bytes = new TextEncoder().encode('content')
    let reg: SourceRegistry = {
      'sha256:gone': { ...makeRecord('raw/0_inbox/gone.pdf', computeFullHash(bytes)) },
    }
    const emptyWalker = async () => []
    reg = await reconcile(reg, emptyWalker)
    expect(findById(reg, 'sha256:gone')?.tombstone).toBe(true)
  })

  it('tombstoned record + bytes reappear → restore (tombstone=false) + recordMove if path differs', async () => {
    const bytes = new TextEncoder().encode('z')
    const fullHash = computeFullHash(bytes)
    let reg: SourceRegistry = {
      'sha256:back': {
        ...makeRecord('raw/0_inbox/old.pdf', fullHash),
        tombstone: true,
      },
    }
    const walker = async () => [
      { vault_path: 'raw/3_resources/30_manual/500_natural_science/back.pdf', bytes },
    ]
    reg = await reconcile(reg, walker)
    const rec = findById(reg, 'sha256:back')!
    expect(rec.tombstone).toBe(false)
    expect(rec.vault_path).toBe('raw/3_resources/30_manual/500_natural_science/back.pdf')
  })

  it('tombstoned + still missing → unchanged', async () => {
    const bytes = new TextEncoder().encode('gone-forever')
    let reg: SourceRegistry = {
      'sha256:dead': {
        ...makeRecord('raw/4_archive/lost.pdf', computeFullHash(bytes)),
        tombstone: true,
      },
    }
    const prev = { ...reg['sha256:dead']! }
    reg = await reconcile(reg, async () => [])
    expect(findById(reg, 'sha256:dead')?.tombstone).toBe(true)
    expect(findById(reg, 'sha256:dead')?.vault_path).toBe(prev.vault_path)
  })

  it('present + current path OK → no change (idempotent)', async () => {
    const bytes = new TextEncoder().encode('stable')
    const path = 'raw/3_resources/30_manual/stable.pdf'
    let reg: SourceRegistry = {
      'sha256:stable': makeRecord(path, computeFullHash(bytes)),
    }
    const historyLenBefore = reg['sha256:stable']!.path_history.length
    reg = await reconcile(reg, async () => [{ vault_path: path, bytes }])
    expect(findById(reg, 'sha256:stable')?.path_history.length).toBe(historyLenBefore)
    expect(findById(reg, 'sha256:stable')?.tombstone).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// §5.3.1 + §5.3.2 — incremental reingest schema extension (plan v11, 2026-04-25)
// ─────────────────────────────────────────────────────────────────────────────

describe('§5.3.1 — Registry schema extension (5 new optional fields)', () => {
  it('case 1 — upsert with all new fields persists round-trip', async () => {
    const fs = new MemoryFS()
    const id = 'sha256:newfields'
    const today = '2026-04-25T10:00:00Z'
    const pending: PendingProtection = {
      kind: 'sidecar-md-new',
      path: 'raw/x.pdf.md.new',
      created_at: today,
      conflict: 'sidecar-user-edit',
    }
    const record: SourceRecord = {
      ...makeRecord('raw/x.pdf', 'h-source'),
      sidecar_hash: 'h-sidecar',
      reingested_at: [today],
      last_action: 'force',
      pending_protections: [pending],
      duplicate_locations: ['raw/copy/x.pdf'],
    }
    let reg: SourceRegistry = {}
    reg = upsert(reg, id, record)
    await saveRegistry(fs, reg)
    const fresh = await loadRegistry(fs)
    const r = findById(fresh, id)!
    expect(r.sidecar_hash).toBe('h-sidecar')
    expect(r.reingested_at).toEqual([today])
    expect(r.last_action).toBe('force')
    expect(r.pending_protections).toEqual([pending])
    expect(r.duplicate_locations).toEqual(['raw/copy/x.pdf'])
  })

  it('case 2 — legacy record load: new fields are undefined (backwards compat)', async () => {
    const fs = new MemoryFS()
    const id = 'sha256:legacy'
    // legacy JSON written without new fields (emulates pre-§5.3 registry).
    const legacyJson = {
      [id]: {
        vault_path: 'raw/legacy.pdf',
        sidecar_vault_path: 'raw/legacy.pdf.md',
        hash: 'h-legacy',
        size: 100,
        first_seen: '2026-04-22T00:00:00Z',
        ingested_pages: ['wiki/sources/source-legacy.md'],
        path_history: [{ vault_path: 'raw/legacy.pdf', at: '2026-04-22T00:00:00Z' }],
        tombstone: false,
      },
    }
    await fs.write(REGISTRY_PATH, JSON.stringify(legacyJson))
    const reg = await loadRegistry(fs)
    const r = findById(reg, id)!
    expect(r.sidecar_hash).toBeUndefined()
    expect(r.reingested_at).toBeUndefined()
    expect(r.last_action).toBeUndefined()
    expect(r.pending_protections).toBeUndefined()
    expect(r.duplicate_locations).toBeUndefined()
    // existing fields intact:
    expect(r.vault_path).toBe('raw/legacy.pdf')
    expect(r.tombstone).toBe(false)
  })
})

describe('§5.3.1 — appendPendingProtection / clearPendingProtection', () => {
  it('case 4 — appendPendingProtection appends entry, other fields unchanged', () => {
    const id = 'sha256:p1'
    let reg: SourceRegistry = {
      [id]: makeRecord('raw/x.pdf', 'h'),
    }
    const entry: PendingProtection = {
      kind: 'sidecar-md-new',
      path: 'raw/x.pdf.md.new',
      created_at: '2026-04-25T10:00:00Z',
      conflict: 'sidecar-user-edit',
    }
    reg = appendPendingProtection(reg, id, entry)
    const r = findById(reg, id)!
    expect(r.pending_protections).toEqual([entry])
    expect(r.vault_path).toBe('raw/x.pdf')
    expect(r.hash).toBe('h')
  })

  it('case 4b — appendPendingProtection appends without dropping existing entries', () => {
    const id = 'sha256:p1b'
    const first: PendingProtection = {
      kind: 'sidecar-md-new',
      path: 'raw/x.pdf.md.new',
      created_at: '2026-04-25T10:00:00Z',
      conflict: 'sidecar-user-edit',
    }
    const second: PendingProtection = {
      kind: 'sidecar-md-new',
      path: 'raw/x.pdf.md.new.1',
      created_at: '2026-04-25T11:00:00Z',
      conflict: 'legacy-no-sidecar-hash',
    }
    let reg: SourceRegistry = {
      [id]: { ...makeRecord('raw/x.pdf', 'h'), pending_protections: [first] },
    }
    reg = appendPendingProtection(reg, id, second)
    expect(findById(reg, id)?.pending_protections).toEqual([first, second])
  })

  it('case 5 — clearPendingProtection removes only the matching path', () => {
    const id = 'sha256:p2'
    const a: PendingProtection = {
      kind: 'sidecar-md-new',
      path: 'raw/x.pdf.md.new',
      created_at: '2026-04-25T10:00:00Z',
      conflict: 'sidecar-user-edit',
    }
    const b: PendingProtection = {
      kind: 'sidecar-md-new',
      path: 'raw/x.pdf.md.new.1',
      created_at: '2026-04-25T11:00:00Z',
      conflict: 'sidecar-user-edit',
    }
    let reg: SourceRegistry = {
      [id]: { ...makeRecord('raw/x.pdf', 'h'), pending_protections: [a, b] },
    }
    reg = clearPendingProtection(reg, id, 'raw/x.pdf.md.new')
    const r = findById(reg, id)!
    expect(r.pending_protections).toEqual([b])
  })
})

describe('§5.3.1 — appendDuplicateLocation', () => {
  it('case 6 — appends new path to duplicate_locations (canonical preserved)', () => {
    const id = 'sha256:dup'
    let reg: SourceRegistry = {
      [id]: makeRecord('raw/canonical.pdf', 'h'),
    }
    reg = appendDuplicateLocation(reg, id, 'raw/copy/canonical.pdf')
    const r = findById(reg, id)!
    expect(r.duplicate_locations).toEqual(['raw/copy/canonical.pdf'])
    // canonical untouched
    expect(r.vault_path).toBe('raw/canonical.pdf')
    // path_history untouched (duplicate_locations is separate from move history)
    expect(r.path_history.length).toBe(1)
    expect(r.path_history[0]?.vault_path).toBe('raw/canonical.pdf')
  })

  it('case 6b — idempotent: same path twice does not duplicate the entry', () => {
    const id = 'sha256:dup2'
    let reg: SourceRegistry = {
      [id]: makeRecord('raw/canonical.pdf', 'h'),
    }
    reg = appendDuplicateLocation(reg, id, 'raw/copy/canonical.pdf')
    reg = appendDuplicateLocation(reg, id, 'raw/copy/canonical.pdf')
    expect(findById(reg, id)?.duplicate_locations).toEqual(['raw/copy/canonical.pdf'])
  })

  it('case 6c — does not append if path equals canonical vault_path', () => {
    const id = 'sha256:dup3'
    let reg: SourceRegistry = {
      [id]: makeRecord('raw/canonical.pdf', 'h'),
    }
    reg = appendDuplicateLocation(reg, id, 'raw/canonical.pdf')
    expect(findById(reg, id)?.duplicate_locations ?? []).toEqual([])
  })
})

describe('§5.3.1 — recordMoveWithSidecar (discriminated option)', () => {
  it('case 7a — kind: preserve keeps existing sidecar_vault_path', () => {
    const id = 'sha256:m1'
    let reg: SourceRegistry = {
      [id]: makeRecord('raw/0_inbox/a.pdf', 'h'),
    }
    reg = recordMoveWithSidecar(reg, id, 'raw/3_resources/a.pdf', { kind: 'preserve' })
    const r = findById(reg, id)!
    expect(r.vault_path).toBe('raw/3_resources/a.pdf')
    // existing sidecar_vault_path was 'raw/0_inbox/a.pdf.md' from makeRecord
    expect(r.sidecar_vault_path).toBe('raw/0_inbox/a.pdf.md')
  })

  it('case 7b — kind: clear sets sidecar_vault_path to undefined', () => {
    const id = 'sha256:m2'
    let reg: SourceRegistry = {
      [id]: makeRecord('raw/0_inbox/a.pdf', 'h'),
    }
    reg = recordMoveWithSidecar(reg, id, 'raw/3_resources/a.pdf', { kind: 'clear' })
    const r = findById(reg, id)!
    expect(r.sidecar_vault_path).toBeUndefined()
  })

  it('case 7c — kind: set assigns new sidecar path atomically with vault_path', () => {
    const id = 'sha256:m3'
    let reg: SourceRegistry = {
      [id]: makeRecord('raw/0_inbox/a.pdf', 'h'),
    }
    reg = recordMoveWithSidecar(reg, id, 'raw/3_resources/a.pdf', {
      kind: 'set',
      path: 'raw/3_resources/a.pdf.md',
    })
    const r = findById(reg, id)!
    expect(r.vault_path).toBe('raw/3_resources/a.pdf')
    expect(r.sidecar_vault_path).toBe('raw/3_resources/a.pdf.md')
    expect(r.path_history.length).toBe(2)
    expect(r.path_history.at(-1)?.vault_path).toBe('raw/3_resources/a.pdf')
    // tombstone cleared (move implies file alive)
    expect(r.tombstone).toBe(false)
  })
})

describe('§5.3.1 — reconcile duplicate-aware (Map<hash, paths[]>)', () => {
  function recordWith(extras: Partial<SourceRecord>, base: SourceRecord): SourceRecord {
    return { ...base, ...extras }
  }

  it('reconcile-A — canonical + duplicate coexist: canonical preserved', async () => {
    const bytes = new TextEncoder().encode('payload-A')
    const fullHash = computeFullHash(bytes)
    const base = makeRecord('raw/canonical.pdf', fullHash)
    let reg: SourceRegistry = {
      'sha256:A': recordWith({ duplicate_locations: ['raw/copy/canonical.pdf'] }, base),
    }
    const walker = async () => [
      { vault_path: 'raw/canonical.pdf', bytes },
      { vault_path: 'raw/copy/canonical.pdf', bytes },
    ]
    reg = await reconcile(reg, walker)
    const r = findById(reg, 'sha256:A')!
    expect(r.vault_path).toBe('raw/canonical.pdf')
    expect(r.duplicate_locations).toEqual(['raw/copy/canonical.pdf'])
    expect(r.path_history.length).toBe(1) // no move logged
  })

  it('reconcile-B — walker order reversed: canonical still preserved (no flip)', async () => {
    const bytes = new TextEncoder().encode('payload-B')
    const fullHash = computeFullHash(bytes)
    const base = makeRecord('raw/canonical.pdf', fullHash)
    let reg: SourceRegistry = {
      'sha256:B': recordWith({ duplicate_locations: ['raw/copy/canonical.pdf'] }, base),
    }
    // walker reports duplicate first, canonical second
    const walker = async () => [
      { vault_path: 'raw/copy/canonical.pdf', bytes },
      { vault_path: 'raw/canonical.pdf', bytes },
    ]
    reg = await reconcile(reg, walker)
    const r = findById(reg, 'sha256:B')!
    expect(r.vault_path).toBe('raw/canonical.pdf')
    expect(r.duplicate_locations).toEqual(['raw/copy/canonical.pdf'])
  })

  it('reconcile-C — canonical missing + duplicate present → duplicate promoted (removed from duplicate_locations)', async () => {
    const bytes = new TextEncoder().encode('payload-C')
    const fullHash = computeFullHash(bytes)
    const base = makeRecord('raw/canonical.pdf', fullHash)
    let reg: SourceRegistry = {
      'sha256:C': recordWith({ duplicate_locations: ['raw/copy/canonical.pdf'] }, base),
    }
    const walker = async () => [
      { vault_path: 'raw/copy/canonical.pdf', bytes },
    ]
    reg = await reconcile(reg, walker)
    const r = findById(reg, 'sha256:C')!
    expect(r.vault_path).toBe('raw/copy/canonical.pdf')
    // promoted path removed from duplicate_locations
    expect(r.duplicate_locations ?? []).toEqual([])
    // path_history reflects move
    expect(r.path_history.at(-1)?.vault_path).toBe('raw/copy/canonical.pdf')
  })

  it('reconcile-D — true move (no duplicate registered) → recordMove as before', async () => {
    const bytes = new TextEncoder().encode('payload-D')
    const fullHash = computeFullHash(bytes)
    let reg: SourceRegistry = {
      'sha256:D': makeRecord('raw/0_inbox/moved.pdf', fullHash),
    }
    const walker = async () => [
      { vault_path: 'raw/3_resources/moved.pdf', bytes },
    ]
    reg = await reconcile(reg, walker)
    const r = findById(reg, 'sha256:D')!
    expect(r.vault_path).toBe('raw/3_resources/moved.pdf')
    expect(r.duplicate_locations ?? []).toEqual([])
  })
})
