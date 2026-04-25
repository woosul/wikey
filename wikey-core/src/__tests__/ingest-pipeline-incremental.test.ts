/**
 * ingest-pipeline-incremental.test.ts — §5.3.1 + §5.3.2 ingest() integration
 * (plan v11, 2026-04-25).
 *
 * Covers the early-return decision branches that exit BEFORE the LLM pipeline:
 *   - 'skip' (hash-match)
 *   - 'skip-with-seed' (legacy registry, sidecar_hash 미존재)
 *   - 'skip' duplicate-hash-other-path
 *   - forceReingest override decision-shape (cannot run full force flow without LLM mock)
 *
 * The 'force' / 'protect' branches require full LLM/canonicalizer/reindex machinery
 * and are validated via:
 *   - decideReingest decision-tree unit tests (incremental-reingest.test.ts)
 *   - cycle smoke 5-step (master CDP)
 */

import { describe, it, expect } from 'vitest'
import { ingest, type SkippedIngestResult } from '../ingest-pipeline.js'
import {
  REGISTRY_PATH,
  type SourceRegistry,
  type SourceRecord,
  loadRegistry,
} from '../source-registry.js'
import { computeFullHash, computeFileId } from '../uri.js'
import type { WikiFS, WikeyConfig, HttpClient } from '../types.js'

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

class ThrowingHttpClient implements HttpClient {
  async request(): Promise<never> {
    throw new Error('HTTP should not be reached in skip branch')
  }
}

const config: WikeyConfig = {
  llm: {
    primary: 'gemini',
    secondary: 'anthropic',
    fallback: 'openai',
    models: { gemini: 'g', anthropic: 'a', openai: 'o', ollama: 'o' },
    reasoning_effort: 'low',
  } as any,
} as any

function seed(opts: {
  vault_path: string
  hash: string
  sidecar_hash?: string
  ingested_pages?: readonly string[]
}): { id: string; record: SourceRecord } {
  const id = computeFileId(new TextEncoder().encode(opts.vault_path + '|' + opts.hash))
  const record: SourceRecord = {
    vault_path: opts.vault_path,
    sidecar_vault_path: `${opts.vault_path}.md`,
    hash: opts.hash,
    size: 100,
    first_seen: '2026-04-25T00:00:00Z',
    ingested_pages: opts.ingested_pages ?? [`wiki/sources/source-${opts.vault_path.split('/').pop()}.md`],
    path_history: [{ vault_path: opts.vault_path, at: '2026-04-25T00:00:00Z' }],
    tombstone: false,
    sidecar_hash: opts.sidecar_hash,
  }
  return { id, record }
}

describe('§5.3.1 ingest() — skip branch (hash-match)', () => {
  it('case 2 — hash-match returns SkippedIngestResult, never reaches LLM', async () => {
    const fs = new MemoryFS()
    const bytes = new TextEncoder().encode('skip-test-payload')
    const fullHash = computeFullHash(bytes)
    const sidecarBody = '# Sidecar\nbody'
    const sidecarHash = computeFullHash(new TextEncoder().encode(sidecarBody.normalize('NFC')))
    const { id, record } = seed({
      vault_path: 'raw/skip.pdf',
      hash: fullHash,
      sidecar_hash: sidecarHash,
    })
    const reg: SourceRegistry = { [id]: record }
    await fs.write(REGISTRY_PATH, JSON.stringify(reg, null, 2))
    await fs.write('raw/skip.pdf', new TextDecoder().decode(bytes))
    await fs.write('raw/skip.pdf.md', sidecarBody)

    const httpClient = new ThrowingHttpClient()
    const result = await ingest('raw/skip.pdf', fs, config, httpClient)
    expect('skipped' in result).toBe(true)
    const skipped = result as SkippedIngestResult
    expect(skipped.skipReason).toBe('hash-match')
    expect(skipped.sourceId).toBe(id)
    expect(skipped.ingestedPages).toEqual(record.ingested_pages)
  })

  it('case 3 — skip-with-seed (legacy sidecar_hash 미존재) populates registry sidecar_hash', async () => {
    const fs = new MemoryFS()
    const bytes = new TextEncoder().encode('legacy-payload')
    const fullHash = computeFullHash(bytes)
    const sidecarBody = '# legacy sidecar'
    const expectedSidecarHash = computeFullHash(new TextEncoder().encode(sidecarBody.normalize('NFC')))
    const { id, record } = seed({
      vault_path: 'raw/legacy.pdf',
      hash: fullHash,
      // sidecar_hash undefined — legacy registry
    })
    const reg: SourceRegistry = { [id]: record }
    await fs.write(REGISTRY_PATH, JSON.stringify(reg, null, 2))
    await fs.write('raw/legacy.pdf', new TextDecoder().decode(bytes))
    await fs.write('raw/legacy.pdf.md', sidecarBody)

    const result = await ingest('raw/legacy.pdf', fs, config, new ThrowingHttpClient())
    expect('skipped' in result).toBe(true)
    const skipped = result as SkippedIngestResult
    expect(skipped.skipReason).toBe('hash-match-sidecar-seed')
    expect(skipped.seededSidecarHash).toBe(true)

    // Registry should now have sidecar_hash populated.
    const fresh = await loadRegistry(fs)
    expect(fresh[id]?.sidecar_hash).toBe(expectedSidecarHash)
    expect(fresh[id]?.last_action).toBe('skip-with-seed')
    expect((fresh[id]?.reingested_at ?? []).length).toBe(1)
  })

  it('case 9 — duplicate-hash-other-path: SkippedIngestResult.duplicateOfId set, registry.duplicate_locations updated', async () => {
    const fs = new MemoryFS()
    const bytes = new TextEncoder().encode('duplicate-payload')
    const fullHash = computeFullHash(bytes)
    const { id, record } = seed({
      vault_path: 'raw/canonical.pdf',
      hash: fullHash,
    })
    const reg: SourceRegistry = { [id]: record }
    await fs.write(REGISTRY_PATH, JSON.stringify(reg, null, 2))
    // canonical raw exists
    await fs.write('raw/canonical.pdf', new TextDecoder().decode(bytes))
    // duplicate path also has same bytes
    await fs.write('raw/copy/canonical.pdf', new TextDecoder().decode(bytes))

    const result = await ingest('raw/copy/canonical.pdf', fs, config, new ThrowingHttpClient())
    expect('skipped' in result).toBe(true)
    const skipped = result as SkippedIngestResult
    expect(skipped.skipReason).toBe('duplicate-hash-other-path')
    expect(skipped.duplicateOfId).toBe(id)

    const fresh = await loadRegistry(fs)
    expect(fresh[id]?.duplicate_locations).toContain('raw/copy/canonical.pdf')
    // canonical path preserved
    expect(fresh[id]?.vault_path).toBe('raw/canonical.pdf')
  })

  it('case 13 — hash-match-sidecar-edit-noted: skips even though sidecar bytes differ (raw bytes unchanged)', async () => {
    const fs = new MemoryFS()
    const bytes = new TextEncoder().encode('stable-raw-bytes')
    const fullHash = computeFullHash(bytes)
    const oldSidecarHash = computeFullHash(new TextEncoder().encode('# old'.normalize('NFC')))
    const { id, record } = seed({
      vault_path: 'raw/x.pdf',
      hash: fullHash,
      sidecar_hash: oldSidecarHash,
    })
    const reg: SourceRegistry = { [id]: record }
    await fs.write(REGISTRY_PATH, JSON.stringify(reg, null, 2))
    await fs.write('raw/x.pdf', new TextDecoder().decode(bytes))
    // user edited sidecar (hash != registry.sidecar_hash)
    await fs.write('raw/x.pdf.md', '# new edit by user')

    const result = await ingest('raw/x.pdf', fs, config, new ThrowingHttpClient())
    expect('skipped' in result).toBe(true)
    const skipped = result as SkippedIngestResult
    expect(skipped.skipReason).toBe('hash-match-sidecar-edit-noted')
  })
})

describe('§5.3.1 ingest() — forceReingest override', () => {
  it('forceReingest=true on hash-match would normally skip; override would force the full pipeline', async () => {
    // We assert decision-shape semantics by triggering the decision and asserting that
    // forceReingest=false → skip; forceReingest=true would proceed but requires LLM mock,
    // so we only verify the no-flag default here. The full force flow is validated via
    // cycle smoke (master CDP).
    const fs = new MemoryFS()
    const bytes = new TextEncoder().encode('force-default-test')
    const fullHash = computeFullHash(bytes)
    const sidecarBody = '#'
    const sidecarHash = computeFullHash(new TextEncoder().encode(sidecarBody.normalize('NFC')))
    const { id, record } = seed({
      vault_path: 'raw/force.pdf',
      hash: fullHash,
      sidecar_hash: sidecarHash,
    })
    await fs.write(REGISTRY_PATH, JSON.stringify({ [id]: record }, null, 2))
    await fs.write('raw/force.pdf', new TextDecoder().decode(bytes))
    await fs.write('raw/force.pdf.md', sidecarBody)

    const result = await ingest('raw/force.pdf', fs, config, new ThrowingHttpClient(), undefined, {
      forceReingest: false,
    })
    expect('skipped' in result).toBe(true)
  })
})
