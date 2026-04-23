/**
 * source-resolver.test.ts — Phase 4.3 Part B.
 */

import { describe, it, expect } from 'vitest'
import {
  resolveSource,
  resolveSourceSync,
  resolvedAbsoluteFileUri,
  type ResolvedSource,
} from '../source-resolver.js'
import { REGISTRY_PATH, type SourceRegistry, type SourceRecord } from '../source-registry.js'
import type { WikiFS } from '../types.js'

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

function makeRecord(path: string, opts: Partial<SourceRecord> = {}): SourceRecord {
  return {
    vault_path: path,
    sidecar_vault_path: `${path}.md`,
    hash: 'a'.repeat(64),
    size: 100,
    first_seen: '2026-04-23T00:00:00Z',
    ingested_pages: ['wiki/sources/source-pms.md'],
    path_history: [{ vault_path: path, at: '2026-04-23T00:00:00Z' }],
    tombstone: false,
    ...opts,
  }
}

async function seedRegistry(fs: MemoryFS, reg: SourceRegistry): Promise<void> {
  await fs.write(REGISTRY_PATH, JSON.stringify(reg))
}

const ID_PMS = 'sha256:aaaaaaaaaaaaaaaa'
const ID_EXTERNAL = 'uri-hash:bbbbbbbbbbbbbbbb'

describe('resolveSource — happy path', () => {
  it('resolves internal file record → obsidian:// open URI', async () => {
    const fs = new MemoryFS()
    await seedRegistry(fs, { [ID_PMS]: makeRecord('raw/3_resources/30_manual/PMS.pdf') })

    const resolved = await resolveSource(fs, `sources/${ID_PMS}`, {
      vaultName: 'wikey-vault',
    })

    expect(resolved).not.toBeNull()
    expect(resolved!.sourceId).toBe(ID_PMS)
    expect(resolved!.kind).toBe('file')
    expect(resolved!.tombstoned).toBe(false)
    expect(resolved!.extension).toBe('pdf')
    expect(resolved!.openUri).toBe(
      'obsidian://open?vault=wikey-vault&file=raw%2F3_resources%2F30_manual%2FPMS.pdf',
    )
    expect(resolved!.currentPath).toBe('raw/3_resources/30_manual/PMS.pdf')
    expect(resolved!.sidecarPath).toBe('raw/3_resources/30_manual/PMS.pdf.md')
  })

  it('accepts bare source_id without `sources/` prefix', async () => {
    const fs = new MemoryFS()
    await seedRegistry(fs, { [ID_PMS]: makeRecord('raw/0_inbox/PMS.pdf') })

    const resolved = await resolveSource(fs, ID_PMS, { vaultName: 'vault' })
    expect(resolved).not.toBeNull()
    expect(resolved!.openUri).toContain('file=raw%2F0_inbox%2FPMS.pdf')
  })

  it('populates absolutePath when absoluteBasePath is provided', async () => {
    const fs = new MemoryFS()
    await seedRegistry(fs, { [ID_PMS]: makeRecord('raw/PMS.pdf') })

    const resolved = await resolveSource(fs, `sources/${ID_PMS}`, {
      vaultName: 'vault',
      absoluteBasePath: '/Users/foo/Project/wikey',
    })
    expect(resolved!.absolutePath).toBe('/Users/foo/Project/wikey/raw/PMS.pdf')
    const fileUri = resolvedAbsoluteFileUri(resolved as ResolvedSource)
    expect(fileUri).toBe('file:///Users/foo/Project/wikey/raw/PMS.pdf')
  })
})

describe('resolveSource — registry edge cases', () => {
  it('returns null when source_id is missing from registry', async () => {
    const fs = new MemoryFS()
    await seedRegistry(fs, { [ID_PMS]: makeRecord('raw/PMS.pdf') })

    const resolved = await resolveSource(fs, 'sources/sha256:ffffffffffffffff', {
      vaultName: 'vault',
    })
    expect(resolved).toBeNull()
  })

  it('returns null when registry file does not exist at all', async () => {
    const fs = new MemoryFS()
    const resolved = await resolveSource(fs, `sources/${ID_PMS}`, { vaultName: 'vault' })
    expect(resolved).toBeNull()
  })

  it('returns null for empty / whitespace / malformed refs', async () => {
    const fs = new MemoryFS()
    await seedRegistry(fs, { [ID_PMS]: makeRecord('raw/PMS.pdf') })

    expect(await resolveSource(fs, '', { vaultName: 'vault' })).toBeNull()
    expect(await resolveSource(fs, '   ', { vaultName: 'vault' })).toBeNull()
    expect(await resolveSource(fs, 'sources/', { vaultName: 'vault' })).toBeNull()
  })

  it('marks tombstone records as tombstoned with null openUri', async () => {
    const fs = new MemoryFS()
    await seedRegistry(fs, {
      [ID_PMS]: makeRecord('raw/PMS.pdf', { tombstone: true }),
    })
    const resolved = await resolveSource(fs, `sources/${ID_PMS}`, { vaultName: 'vault' })
    expect(resolved).not.toBeNull()
    expect(resolved!.tombstoned).toBe(true)
    expect(resolved!.openUri).toBeNull()
    // currentPath still exposed so UI can say "마지막 위치 was ..."
    expect(resolved!.currentPath).toBe('raw/PMS.pdf')
  })

  it('follows PARA move via registry.vault_path (path_history ignored)', async () => {
    // Simulate a record that has moved raw/0_inbox/x.pdf → raw/3_resources/.../x.pdf.
    // resolveSource must return the CURRENT path, not the historical one.
    const fs = new MemoryFS()
    await seedRegistry(fs, {
      [ID_PMS]: makeRecord('raw/3_resources/30_manual/PMS.pdf', {
        sidecar_vault_path: 'raw/3_resources/30_manual/PMS.pdf.md',
        path_history: [
          { vault_path: 'raw/0_inbox/PMS.pdf', at: '2026-04-01T00:00:00Z' },
          { vault_path: 'raw/3_resources/30_manual/PMS.pdf', at: '2026-04-23T00:00:00Z' },
        ],
      }),
    })
    const resolved = await resolveSource(fs, `sources/${ID_PMS}`, { vaultName: 'vault' })
    expect(resolved!.openUri).toBe(
      'obsidian://open?vault=vault&file=raw%2F3_resources%2F30_manual%2FPMS.pdf',
    )
  })
})

describe('resolveSource — external URI variant', () => {
  it('kind=external when source_id uses uri-hash: prefix', async () => {
    const fs = new MemoryFS()
    await seedRegistry(fs, {
      [ID_EXTERNAL]: makeRecord('https://example.org/whitepaper', {
        hash: 'e'.repeat(64),
        sidecar_vault_path: undefined,
      }),
    })
    const resolved = await resolveSource(fs, `sources/${ID_EXTERNAL}`, { vaultName: 'vault' })
    expect(resolved).not.toBeNull()
    expect(resolved!.kind).toBe('external')
    expect(resolved!.openUri).toBe('https://example.org/whitepaper')
    expect(resolved!.sidecarPath).toBeNull()
  })
})

describe('resolveSourceSync', () => {
  it('uses caller-supplied registry — avoids repeat load for batch citations', () => {
    const registry: SourceRegistry = { [ID_PMS]: makeRecord('raw/PMS.pdf') }
    const resolved = resolveSourceSync(`sources/${ID_PMS}`, registry, { vaultName: 'v' })
    expect(resolved).not.toBeNull()
    expect(resolved!.extension).toBe('pdf')
  })

  it('returns null on missing id', () => {
    const registry: SourceRegistry = {}
    expect(resolveSourceSync('sources/sha256:deadbeefdeadbeef', registry, { vaultName: 'v' })).toBeNull()
  })
})
