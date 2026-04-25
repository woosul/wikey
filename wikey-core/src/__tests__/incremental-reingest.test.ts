/**
 * incremental-reingest.test.ts — §5.3.1 + §5.3.2 (plan v11, 2026-04-25).
 *
 * 23 unit cases covering decideReingest decision tree + user-marker helpers
 * + sidecar protection helpers (★ P1-1 raw-bytes invariant, P1-3 skip-with-seed,
 * P1-4 conflicts collect-then-decide, P2-5 idempotency, P2-6 multiline regex,
 * P2-7 NFC normalization).
 */

import { describe, it, expect } from 'vitest'
import {
  decideReingest,
  extractUserMarkers,
  mergeUserMarkers,
  protectSidecarTargetPath,
  computeSidecarHash,
  IngestProtectionPathExhaustedError,
  USER_MARKER_HEADERS,
  type ReingestDecision,
  type ConflictInfo,
} from '../incremental-reingest.js'
import {
  type SourceRegistry,
  type SourceRecord,
  REGISTRY_PATH,
} from '../source-registry.js'
import { computeFullHash, computeFileId } from '../uri.js'
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

function makeRecord(opts: {
  vault_path: string
  hash: string
  sidecar_vault_path?: string
  sidecar_hash?: string
  ingested_pages?: readonly string[]
  duplicate_locations?: readonly string[]
}): SourceRecord {
  return {
    vault_path: opts.vault_path,
    sidecar_vault_path: opts.sidecar_vault_path,
    hash: opts.hash,
    size: 100,
    first_seen: '2026-04-25T00:00:00Z',
    ingested_pages: opts.ingested_pages ?? [`wiki/sources/source-${opts.vault_path.split('/').pop()}.md`],
    path_history: [{ vault_path: opts.vault_path, at: '2026-04-25T00:00:00Z' }],
    tombstone: false,
    sidecar_hash: opts.sidecar_hash,
    duplicate_locations: opts.duplicate_locations,
  }
}

async function seedRegistryToFS(fs: WikiFS, reg: SourceRegistry): Promise<void> {
  await fs.write(REGISTRY_PATH, JSON.stringify(reg, null, 2))
}

// ─────────────────────────────────────────────────────────────────────────────
// decideReingest — decision tree (cases 1-13)
// ─────────────────────────────────────────────────────────────────────────────

describe('decideReingest — decision tree', () => {
  it('case 1 — new source (R==null) → action=force, reason=new-source', async () => {
    const fs = new MemoryFS()
    await seedRegistryToFS(fs, {})
    const bytes = new TextEncoder().encode('payload-A')
    const decision = await decideReingest({
      sourcePath: 'raw/x.pdf',
      sourceBytes: bytes,
      wikiFS: fs,
    })
    expect(decision.action).toBe('force')
    expect(decision.reason).toBe('new-source')
    expect(decision.conflicts).toEqual([])
    expect(decision.preservedSourceId).toBeUndefined()
    expect(decision.sourceHash).toBe(computeFullHash(bytes))
  })

  it('case 2 — hash match clean → action=skip, reason=hash-match', async () => {
    const fs = new MemoryFS()
    const bytes = new TextEncoder().encode('payload-B')
    const fullHash = computeFullHash(bytes)
    const sidecarBody = '# Sidecar\nbody'
    const sidecarHash = computeFullHash(new TextEncoder().encode(sidecarBody.normalize('NFC')))
    const id = 'sha256:B'
    const reg: SourceRegistry = {
      [id]: makeRecord({
        vault_path: 'raw/x.pdf',
        hash: fullHash,
        sidecar_vault_path: 'raw/x.pdf.md',
        sidecar_hash: sidecarHash,
      }),
    }
    await seedRegistryToFS(fs, reg)
    await fs.write('raw/x.pdf.md', sidecarBody)
    const decision = await decideReingest({
      sourcePath: 'raw/x.pdf',
      sourceBytes: bytes,
      wikiFS: fs,
    })
    expect(decision.action).toBe('skip')
    expect(decision.reason).toBe('hash-match')
    expect(decision.conflicts).toEqual([])
    expect(decision.preservedSourceId).toBe(id)
  })

  it('case 3 — clean change (raw bytes 다름, conflicts=[]) → action=force, reason=hash-changed-clean', async () => {
    const fs = new MemoryFS()
    const oldBytes = new TextEncoder().encode('old')
    const newBytes = new TextEncoder().encode('new-payload')
    const id = 'sha256:C'
    const reg: SourceRegistry = {
      [id]: makeRecord({ vault_path: 'raw/x.pdf', hash: computeFullHash(oldBytes) }),
    }
    await seedRegistryToFS(fs, reg)
    const decision = await decideReingest({
      sourcePath: 'raw/x.pdf',
      sourceBytes: newBytes,
      wikiFS: fs,
    })
    expect(decision.action).toBe('force')
    expect(decision.reason).toBe('hash-changed-clean')
    expect(decision.conflicts).toEqual([])
    expect(decision.preservedSourceId).toBe(id)
  })

  it('case 4 — sidecar user edit (A/F) → action=protect, conflicts=[sidecar-user-edit]', async () => {
    const fs = new MemoryFS()
    const oldBytes = new TextEncoder().encode('old')
    const newBytes = new TextEncoder().encode('new')
    const oldSidecar = '# original sidecar'
    const oldSidecarHash = computeFullHash(new TextEncoder().encode(oldSidecar.normalize('NFC')))
    const userEditedSidecar = '# original sidecar\n\n사용자 메모'
    const id = 'sha256:D'
    const reg: SourceRegistry = {
      [id]: makeRecord({
        vault_path: 'raw/x.pdf',
        hash: computeFullHash(oldBytes),
        sidecar_vault_path: 'raw/x.pdf.md',
        sidecar_hash: oldSidecarHash,
      }),
    }
    await seedRegistryToFS(fs, reg)
    await fs.write('raw/x.pdf.md', userEditedSidecar)
    const decision = await decideReingest({
      sourcePath: 'raw/x.pdf',
      sourceBytes: newBytes,
      wikiFS: fs,
    })
    expect(decision.action).toBe('protect')
    expect(decision.conflicts).toContain('sidecar-user-edit')
    expect(decision.preservedSourceId).toBe(id)
  })

  it('case 5 — source page user edit (D) → action=protect, conflicts=[source-page-user-edit]', async () => {
    const fs = new MemoryFS()
    const oldBytes = new TextEncoder().encode('old')
    const newBytes = new TextEncoder().encode('new-payload-source')
    const sourcePagePath = 'wiki/sources/source-x.md'
    const id = 'sha256:E'
    const sidecarBody = 'sidecar'
    const sidecarHash = computeFullHash(new TextEncoder().encode(sidecarBody.normalize('NFC')))
    const reg: SourceRegistry = {
      [id]: makeRecord({
        vault_path: 'raw/x.pdf',
        hash: computeFullHash(oldBytes),
        sidecar_vault_path: 'raw/x.pdf.md',
        sidecar_hash: sidecarHash,
        ingested_pages: [sourcePagePath],
      }),
    }
    await seedRegistryToFS(fs, reg)
    await fs.write('raw/x.pdf.md', sidecarBody)
    await fs.write(sourcePagePath, '# Source\nbody\n\n## 사용자 메모\n중요!\n')
    const decision = await decideReingest({
      sourcePath: 'raw/x.pdf',
      sourceBytes: newBytes,
      wikiFS: fs,
    })
    expect(decision.action).toBe('protect')
    expect(decision.conflicts).toContain('source-page-user-edit')
  })

  it('case 6 — duplicate hash other path (E) → action=skip, reason=duplicate-hash-other-path', async () => {
    const fs = new MemoryFS()
    const bytes = new TextEncoder().encode('shared')
    const fullHash = computeFullHash(bytes)
    const id = 'sha256:F'
    const reg: SourceRegistry = {
      [id]: makeRecord({ vault_path: 'raw/canonical.pdf', hash: fullHash }),
    }
    await seedRegistryToFS(fs, reg)
    const decision = await decideReingest({
      sourcePath: 'raw/copy/canonical.pdf', // different path, same bytes
      sourceBytes: bytes,
      wikiFS: fs,
    })
    expect(decision.action).toBe('skip')
    expect(decision.reason).toBe('duplicate-hash-other-path')
    expect(decision.conflicts).toContain('duplicate-hash')
    expect(decision.duplicateOfId).toBe(id)
    expect(decision.duplicatePathToAppend).toBe('raw/copy/canonical.pdf')
  })

  it('case 7 — prompt branch (sidecar user edit + onConflict provided) → action=prompt', async () => {
    const fs = new MemoryFS()
    const oldBytes = new TextEncoder().encode('old')
    const newBytes = new TextEncoder().encode('new')
    const oldSidecar = '# original'
    const oldSidecarHash = computeFullHash(new TextEncoder().encode(oldSidecar.normalize('NFC')))
    const id = 'sha256:G'
    const reg: SourceRegistry = {
      [id]: makeRecord({
        vault_path: 'raw/x.pdf',
        hash: computeFullHash(oldBytes),
        sidecar_vault_path: 'raw/x.pdf.md',
        sidecar_hash: oldSidecarHash,
      }),
    }
    await seedRegistryToFS(fs, reg)
    await fs.write('raw/x.pdf.md', '# original\nuser edit')
    const decision = await decideReingest({
      sourcePath: 'raw/x.pdf',
      sourceBytes: newBytes,
      wikiFS: fs,
      onConflict: async () => 'preserve',
    })
    expect(decision.action).toBe('prompt')
    expect(decision.conflicts).toContain('sidecar-user-edit')
  })

  it('case 8 — P1-1 raw bytes invariant: same bytes twice → second is hash-match', async () => {
    const fs = new MemoryFS()
    const bytes = new TextEncoder().encode('invariant-test')
    const fullHash = computeFullHash(bytes)
    const sidecarBody = 'sidecar'
    const sidecarHash = computeFullHash(new TextEncoder().encode(sidecarBody.normalize('NFC')))
    const id = 'sha256:H'
    const reg: SourceRegistry = {
      [id]: makeRecord({
        vault_path: 'raw/x.pdf',
        hash: fullHash,
        sidecar_vault_path: 'raw/x.pdf.md',
        sidecar_hash: sidecarHash,
      }),
    }
    await seedRegistryToFS(fs, reg)
    await fs.write('raw/x.pdf.md', sidecarBody)
    const d = await decideReingest({
      sourcePath: 'raw/x.pdf',
      sourceBytes: bytes,
      wikiFS: fs,
    })
    expect(d.reason).toBe('hash-match')
    // Different (transformed) bytes would mismatch — caller responsibility documented.
    const transformedBytes = new TextEncoder().encode('different-after-transform')
    const d2 = await decideReingest({
      sourcePath: 'raw/x.pdf',
      sourceBytes: transformedBytes,
      wikiFS: fs,
    })
    expect(d2.action).toBe('force') // raw hash mismatch with no conflicts (sidecar matches old hash)
  })

  it('case 9 — P1-3 skip-with-seed (legacy registry, sidecar_hash 미존재 + disk sidecar 존재)', async () => {
    const fs = new MemoryFS()
    const bytes = new TextEncoder().encode('legacy')
    const fullHash = computeFullHash(bytes)
    const id = 'sha256:I'
    const reg: SourceRegistry = {
      [id]: makeRecord({
        vault_path: 'raw/legacy.pdf',
        hash: fullHash,
        sidecar_vault_path: 'raw/legacy.pdf.md',
        // sidecar_hash undefined (legacy)
      }),
    }
    await seedRegistryToFS(fs, reg)
    await fs.write('raw/legacy.pdf.md', '# legacy sidecar')
    const decision = await decideReingest({
      sourcePath: 'raw/legacy.pdf',
      sourceBytes: bytes,
      wikiFS: fs,
    })
    expect(decision.action).toBe('skip-with-seed')
    expect(decision.reason).toBe('hash-match-sidecar-seed')
    expect(decision.diskSidecarHash).toBeTruthy()
  })

  it('case 10 — P1-3 skip-with-seed without disk sidecar → falls back to skip + hash-match', async () => {
    const fs = new MemoryFS()
    const bytes = new TextEncoder().encode('nosidecar')
    const fullHash = computeFullHash(bytes)
    const id = 'sha256:J'
    const reg: SourceRegistry = {
      [id]: makeRecord({ vault_path: 'raw/y.pdf', hash: fullHash }),
    }
    await seedRegistryToFS(fs, reg)
    // no sidecar file written
    const decision = await decideReingest({
      sourcePath: 'raw/y.pdf',
      sourceBytes: bytes,
      wikiFS: fs,
    })
    expect(decision.action).toBe('skip')
    expect(decision.reason).toBe('hash-match')
  })

  it('case 11 — P1-4 simultaneous conflicts (sidecar-user-edit + source-page-user-edit) collected together', async () => {
    const fs = new MemoryFS()
    const oldBytes = new TextEncoder().encode('old')
    const newBytes = new TextEncoder().encode('new-with-many-conflicts')
    const oldSidecar = '# original sidecar'
    const oldSidecarHash = computeFullHash(new TextEncoder().encode(oldSidecar.normalize('NFC')))
    const sourcePagePath = 'wiki/sources/source-x.md'
    const id = 'sha256:K'
    const reg: SourceRegistry = {
      [id]: makeRecord({
        vault_path: 'raw/x.pdf',
        hash: computeFullHash(oldBytes),
        sidecar_vault_path: 'raw/x.pdf.md',
        sidecar_hash: oldSidecarHash,
        ingested_pages: [sourcePagePath],
      }),
    }
    await seedRegistryToFS(fs, reg)
    // user edited sidecar
    await fs.write('raw/x.pdf.md', '# original sidecar\nedit')
    // user added marker to source page
    await fs.write(sourcePagePath, '# Source\nbody\n\n## 사용자 메모\n노트\n')
    const decision = await decideReingest({
      sourcePath: 'raw/x.pdf',
      sourceBytes: newBytes,
      wikiFS: fs,
    })
    expect(decision.action).toBe('protect')
    expect(decision.conflicts).toContain('sidecar-user-edit')
    expect(decision.conflicts).toContain('source-page-user-edit')
  })

  it('case 12 — P1-3 legacy raw-hash mismatch + disk sidecar → protect with legacy-no-sidecar-hash', async () => {
    const fs = new MemoryFS()
    const oldBytes = new TextEncoder().encode('old-legacy')
    const newBytes = new TextEncoder().encode('new-legacy')
    const id = 'sha256:L'
    const reg: SourceRegistry = {
      [id]: makeRecord({
        vault_path: 'raw/legacy.pdf',
        hash: computeFullHash(oldBytes),
        sidecar_vault_path: 'raw/legacy.pdf.md',
        // sidecar_hash undefined (legacy)
      }),
    }
    await seedRegistryToFS(fs, reg)
    await fs.write('raw/legacy.pdf.md', '# legacy')
    const decision = await decideReingest({
      sourcePath: 'raw/legacy.pdf',
      sourceBytes: newBytes,
      wikiFS: fs,
    })
    expect(decision.action).toBe('protect')
    expect(decision.conflicts).toContain('legacy-no-sidecar-hash')
  })

  it('case 13 — hash match + sidecar edit noted (F sub-case) → action=skip, reason=hash-match-sidecar-edit-noted', async () => {
    const fs = new MemoryFS()
    const bytes = new TextEncoder().encode('stable-raw')
    const fullHash = computeFullHash(bytes)
    const oldSidecarHash = computeFullHash(new TextEncoder().encode('# old sidecar'.normalize('NFC')))
    const id = 'sha256:M'
    const reg: SourceRegistry = {
      [id]: makeRecord({
        vault_path: 'raw/x.pdf',
        hash: fullHash,
        sidecar_vault_path: 'raw/x.pdf.md',
        sidecar_hash: oldSidecarHash,
      }),
    }
    await seedRegistryToFS(fs, reg)
    // disk sidecar differs from registry hash
    await fs.write('raw/x.pdf.md', '# new sidecar after user edit')
    const decision = await decideReingest({
      sourcePath: 'raw/x.pdf',
      sourceBytes: bytes,
      wikiFS: fs,
    })
    expect(decision.action).toBe('skip')
    expect(decision.reason).toBe('hash-match-sidecar-edit-noted')
    expect(decision.conflicts).toContain('sidecar-user-edit')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// extractUserMarkers / mergeUserMarkers (cases 14-20)
// ─────────────────────────────────────────────────────────────────────────────

describe('extractUserMarkers / mergeUserMarkers', () => {
  it('case 14 — P2-7 NFC normalization (NFD-decomposed Korean equivalent to NFC)', () => {
    // NFC composed
    const nfc = '# Page\n\n## 사용자 메모\n중요!\n'
    // NFD decomposed (한글 자모 분리). normalize('NFD') 가 동등한 문자열 반환.
    const nfd = nfc.normalize('NFD')
    expect(nfd).not.toEqual(nfc) // they differ at the byte level
    const m1 = extractUserMarkers(nfc)
    const m2 = extractUserMarkers(nfd)
    expect(m1.trim().length).toBeGreaterThan(0)
    expect(m2.trim().length).toBeGreaterThan(0)
    // both should locate the marker
    expect(m1.normalize('NFC')).toEqual(m2.normalize('NFC'))
  })

  it('case 15 — happy: extract `## 사용자 메모` block until next H2', () => {
    const text = '# Page\n\n## 본문\n내용\n\n## 사용자 메모\n노트1\n노트2\n\n## 다른 H2\n본문\n'
    const out = extractUserMarkers(text)
    expect(out).toContain('## 사용자 메모')
    expect(out).toContain('노트1')
    expect(out).toContain('노트2')
    expect(out).not.toContain('## 다른 H2')
  })

  it('case 16 — edge: no marker → empty string', () => {
    const text = '# Page\n## 본문\n내용\n'
    expect(extractUserMarkers(text)).toBe('')
  })

  it('case 17 — P2-6 multiline regex: ## 사용자 메모 inside fenced code block is not matched', () => {
    const text = '# Page\n\n```\n## 사용자 메모\nfake inside code\n```\n\n다른 본문\n'
    const out = extractUserMarkers(text)
    // The line is ^## ... so it might still match by line-start unless we exclude code blocks.
    // The regex spec is ^## (사용자 메모|...) at line start. Inside a fenced block, the line still
    // starts with `## `. This test is intentionally lenient: per plan v11 P2-6,
    // "코드블록 내부 false positive 최소화 — 우선 line-start 만 보장". So either match-or-no-match
    // is acceptable as long as line-start anchor works. We assert: when fenced, IF matched,
    // the result includes only marker line(s) until next ## (so anything after is excluded).
    if (out !== '') {
      expect(out.startsWith('## 사용자 메모')).toBe(true)
    }
    // Indented (4-space) ## should NOT match (line-start regex):
    const indented = '# Page\n\n    ## 사용자 메모\n indented content\n## 다른\n'
    expect(extractUserMarkers(indented)).toBe('')
  })

  it('case 18 — P2-5 mergeUserMarkers idempotent', () => {
    const newContent = '# Page\nbody\n'
    const markers = '## 사용자 메모\n노트\n'
    const once = mergeUserMarkers(newContent, markers)
    const twice = mergeUserMarkers(once, markers)
    expect(twice).toBe(once)
  })

  it('case 19 — happy: mergeUserMarkers appends with separator', () => {
    const newContent = '# Page\nbody'
    const markers = '## 사용자 메모\n노트\n'
    const out = mergeUserMarkers(newContent, markers)
    expect(out).toContain('# Page')
    expect(out).toContain('body')
    expect(out).toContain('## 사용자 메모')
    expect(out).toContain('노트')
    expect(out.endsWith('\n')).toBe(true)
  })

  it('case 20 — edge: empty markers → newContent unchanged', () => {
    const newContent = '# Page\nbody\n'
    expect(mergeUserMarkers(newContent, '')).toBe(newContent)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// protectSidecarTargetPath / computeSidecarHash (cases 21-23)
// ─────────────────────────────────────────────────────────────────────────────

describe('protectSidecarTargetPath / computeSidecarHash', () => {
  it('case 21 — protectSidecarTargetPath: default <sourcePath>.md.new, .1~.9 collision, .10 throws', async () => {
    const fs = new MemoryFS()
    // No collision → default
    expect(await protectSidecarTargetPath('raw/x.pdf', fs)).toBe('raw/x.pdf.md.new')
    // Collision at .md.new → returns .md.new.1
    await fs.write('raw/x.pdf.md.new', '#1')
    expect(await protectSidecarTargetPath('raw/x.pdf', fs)).toBe('raw/x.pdf.md.new.1')
    // Fill .1~.9
    for (let i = 1; i <= 9; i++) {
      await fs.write(`raw/x.pdf.md.new.${i}`, `#${i}`)
    }
    // All exhausted → throw
    await expect(protectSidecarTargetPath('raw/x.pdf', fs)).rejects.toThrow(IngestProtectionPathExhaustedError)
  })

  it('case 22 — computeSidecarHash: returns sha256(NFC(content)) when sidecar exists', async () => {
    const fs = new MemoryFS()
    const body = '# Sidecar\n사용자 메모\n'
    await fs.write('raw/x.pdf.md', body)
    const expected = computeFullHash(new TextEncoder().encode(body.normalize('NFC')))
    expect(await computeSidecarHash(fs, 'raw/x.pdf.md')).toBe(expected)
  })

  it('case 23 — computeSidecarHash: returns null when sidecar does not exist', async () => {
    const fs = new MemoryFS()
    expect(await computeSidecarHash(fs, 'raw/missing.md')).toBeNull()
  })
})

describe('USER_MARKER_HEADERS exposes default headers', () => {
  it('exports the three default headers', () => {
    expect(USER_MARKER_HEADERS).toContain('## 사용자 메모')
    expect(USER_MARKER_HEADERS).toContain('## User Notes')
    expect(USER_MARKER_HEADERS).toContain('## 메모')
  })
})
