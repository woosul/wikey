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
  REGISTRY_PATH,
  type SourceRegistry,
  type SourceRecord,
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
})
