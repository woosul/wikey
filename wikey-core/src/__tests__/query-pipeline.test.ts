import { describe, it, expect } from 'vitest'
import {
  parseQmdOutput,
  buildSynthesisPrompt,
  buildCitationFromContent,
  collectCitationsWithWikiFS,
  appendOriginalLinks,
} from '../query-pipeline.js'
import { REGISTRY_PATH, type SourceRecord, type SourceRegistry } from '../source-registry.js'
import type { Citation, SearchResult, WikiFS } from '../types.js'

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

describe('parseQmdOutput', () => {
  it('parses JSON array of search results and adds wiki/ prefix', () => {
    const json = JSON.stringify([
      { file: 'qmd://wikey-wiki/sources/source-esc.md', score: 0.95, snippet: 'ESC is...' },
      { file: 'qmd://wikey-wiki/concepts/pid-loop.md', score: 0.85, snippet: 'PID loop...' },
    ])
    const results = parseQmdOutput(json)
    expect(results).toHaveLength(2)
    expect(results[0].path).toBe('wiki/sources/source-esc.md')
    expect(results[0].score).toBe(0.95)
    expect(results[1].path).toBe('wiki/concepts/pid-loop.md')
  })

  it('does not double wiki/ prefix', () => {
    const json = JSON.stringify([
      { file: 'qmd://wikey-wiki/wiki/entities/esc.md', score: 0.9, snippet: '' },
    ])
    const results = parseQmdOutput(json)
    expect(results[0].path).toBe('wiki/entities/esc.md')
  })

  it('returns empty array for empty JSON', () => {
    expect(parseQmdOutput('[]')).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseQmdOutput('')).toEqual([])
  })

  it('handles malformed JSON gracefully', () => {
    expect(parseQmdOutput('not json')).toEqual([])
  })
})

describe('buildSynthesisPrompt', () => {
  it('includes context pages and question', () => {
    const context = '--- esc.md ---\n# ESC\nElectronic Speed Controller\n\n'
    const question = 'ESC란?'
    const prompt = buildSynthesisPrompt(context, question)

    expect(prompt).toContain('wikey 위키')
    expect(prompt).toContain('esc.md')
    expect(prompt).toContain('ESC란?')
    expect(prompt).toContain('[[페이지명]]')
  })

  it('includes the question at the end', () => {
    const prompt = buildSynthesisPrompt('context', 'test question')
    const questionIdx = prompt.indexOf('test question')
    expect(questionIdx).toBeGreaterThan(0)
  })
})

// ── §4.3.2 Part B: citations 구조화 ──

const RESULT_ESC: SearchResult = { path: 'wiki/entities/esc.md', score: 0.9, snippet: 'ESC is...' }

describe('buildCitationFromContent', () => {
  it('extracts provenance refs (bare sha256 and quoted) and dedupes across types', () => {
    const content = `---
title: ESC
type: entity
provenance:
  - type: extracted
    ref: sources/sha256:aaaaaaaaaaaaaaaa
  - type: extracted
    ref: "sources/sha256:bbbbbbbbbbbbbbbb"
  - type: inferred
    ref: sources/sha256:aaaaaaaaaaaaaaaa
    confidence: 0.7
tags: []
---

# ESC
`
    const citation = buildCitationFromContent(RESULT_ESC, content)
    expect(citation).not.toBeNull()
    expect(citation!.wikiPagePath).toBe('wiki/entities/esc.md')
    // Deduplicated by source_id regardless of provenance type.
    expect(citation!.sourceIds).toEqual([
      'sha256:aaaaaaaaaaaaaaaa',
      'sha256:bbbbbbbbbbbbbbbb',
    ])
    expect(citation!.excerpt).toBe('ESC is...')
  })

  it('returns null when no frontmatter at all', () => {
    const content = '# ESC\n\n본문만 있는 페이지.'
    expect(buildCitationFromContent(RESULT_ESC, content)).toBeNull()
  })

  it('returns null when frontmatter has no provenance field', () => {
    const content = `---
title: ESC
type: entity
sources: [source-x.md]
---

# ESC
`
    expect(buildCitationFromContent(RESULT_ESC, content)).toBeNull()
  })

  it('strips `sources/` prefix but keeps raw uri-hash refs intact', () => {
    const content = `---
title: X
provenance:
  - type: extracted
    ref: sources/uri-hash:cccccccccccccccc
---

# X
`
    const citation = buildCitationFromContent(RESULT_ESC, content)
    expect(citation!.sourceIds).toEqual(['uri-hash:cccccccccccccccc'])
  })
})

describe('collectCitationsWithWikiFS', () => {
  it('skips pages the reader cannot open, preserves order of those it can', async () => {
    const fs = new MemoryFS()
    await fs.write('wiki/entities/a.md', `---\nprovenance:\n  - type: extracted\n    ref: sources/sha256:aaaaaaaaaaaaaaaa\n---\n\nA`)
    // b.md missing → read throws → skipped.
    await fs.write('wiki/concepts/c.md', `---\nprovenance:\n  - type: inferred\n    ref: sources/sha256:cccccccccccccccc\n    confidence: 0.5\n---\n\nC`)
    const results: SearchResult[] = [
      { path: 'wiki/entities/a.md', score: 0.9, snippet: 'a' },
      { path: 'wiki/entities/b.md', score: 0.8, snippet: 'b' }, // missing
      { path: 'wiki/concepts/c.md', score: 0.7, snippet: 'c' },
    ]
    const citations = await collectCitationsWithWikiFS(results, fs)
    expect(citations.map((c) => c.wikiPagePath)).toEqual([
      'wiki/entities/a.md',
      'wiki/concepts/c.md',
    ])
  })

  it('returns empty array when no result pages carry provenance', async () => {
    const fs = new MemoryFS()
    await fs.write('wiki/entities/legacy.md', `---\ntitle: Legacy\nsources: [legacy-source.md]\n---\n\n# Legacy`)
    const citations = await collectCitationsWithWikiFS(
      [{ path: 'wiki/entities/legacy.md', score: 0.5, snippet: 'legacy' }],
      fs,
    )
    expect(citations).toEqual([])
  })
})

describe('appendOriginalLinks — Phase 4 D.0.h (v6 §4.5.2)', () => {
  const ID_FOO = 'sha256:aaaaaaaaaaaaaaaa'
  const ID_ARCHIVED = 'sha256:bbbbbbbbbbbbbbbb'
  const ID_TOMBSTONED = 'sha256:cccccccccccccccc'

  function mkRecord(opts: Partial<SourceRecord>): SourceRecord {
    return {
      vault_path: '',
      hash: 'x'.repeat(64),
      size: 100,
      first_seen: '2026-04-23T00:00:00Z',
      ingested_pages: [],
      path_history: [],
      tombstone: false,
      ...opts,
    } as SourceRecord
  }
  const citation = (sourceIds: string[]): Citation => ({
    wikiPagePath: 'wiki/entities/foo.md',
    sourceIds,
  })

  it('current vault_path 있음 — raw 링크 append', async () => {
    const fs = new MemoryFS()
    const registry: SourceRegistry = {
      [ID_FOO]: mkRecord({
        vault_path: 'raw/2_areas/foo.pdf',
        path_history: [{ vault_path: 'raw/0_inbox/foo.pdf', at: '2026-04-10T00:00:00Z' }],
      }),
    }
    await fs.write(REGISTRY_PATH, JSON.stringify(registry))
    const out = await appendOriginalLinks('답변 본문', [citation([ID_FOO])], { wikiFS: fs })
    expect(out).toContain('원본: [[raw/2_areas/foo.pdf]]')
    expect(out).toContain('답변 본문')
  })

  it('current vault_path 비어 있고 path_history 존재 — 마지막 유효 entry fallback', async () => {
    const fs = new MemoryFS()
    const registry: SourceRegistry = {
      [ID_ARCHIVED]: mkRecord({
        vault_path: '', // empty
        path_history: [
          { vault_path: 'raw/0_inbox/old.pdf', at: '2026-04-01T00:00:00Z' },
          { vault_path: 'raw/4_archive/old.pdf', at: '2026-04-20T00:00:00Z' },
        ],
      }),
    }
    await fs.write(REGISTRY_PATH, JSON.stringify(registry))
    const out = await appendOriginalLinks('본문', [citation([ID_ARCHIVED])], { wikiFS: fs })
    // 마지막 유효 entry 가 우선
    expect(out).toContain('원본: [[raw/4_archive/old.pdf]]')
    expect(out).not.toContain('raw/0_inbox/old.pdf')
  })

  it('citation 있지만 resolve 전부 실패 (record 없음) — WARN 문구', async () => {
    const fs = new MemoryFS()
    await fs.write(REGISTRY_PATH, '{}') // empty registry
    const out = await appendOriginalLinks('본문', [citation(['sha256:dddddddddddddddd'])], { wikiFS: fs })
    expect(out).toContain('원본: (해석 실패')
    expect(out).toContain('registry 점검')
  })

  it('citation 0개 — fail closed 문구', async () => {
    const fs = new MemoryFS()
    const out = await appendOriginalLinks('본문만', [], { wikiFS: fs })
    expect(out).toContain('원본: (없음 — 외부 근거 없음)')
  })
})
