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

// §5.2.3 — 1-hop wikilink graph expansion
import { extractWikilinkBasenames, expandWithOneHopWikilinks } from '../query-pipeline.js'

describe('extractWikilinkBasenames', () => {
  it('extracts simple wikilinks', () => {
    const md = 'See [[smith-chart]] and [[swr]] for more.'
    expect(extractWikilinkBasenames(md)).toEqual(['smith-chart', 'swr'])
  })

  it('handles aliases and anchors', () => {
    const md = 'Refer to [[s11|reflection]] and [[swr#measurement]].'
    expect(extractWikilinkBasenames(md)).toEqual(['s11', 'swr'])
  })

  it('dedupes', () => {
    const md = '[[smith-chart]] is great. See [[smith-chart]] again.'
    expect(extractWikilinkBasenames(md)).toEqual(['smith-chart'])
  })

  it('strips path-style wikilinks (uses last segment)', () => {
    const md = '[[concepts/smith-chart]]'
    expect(extractWikilinkBasenames(md)).toEqual(['smith-chart'])
  })

  it('returns empty for content with no wikilinks', () => {
    expect(extractWikilinkBasenames('plain text [no link]')).toEqual([])
  })
})

describe('expandWithOneHopWikilinks', () => {
  it('returns 1-hop targets sorted by frequency', async () => {
    const base = [
      { path: 'wiki/entities/nanovna-v2.md', content: 'Uses [[smith-chart]] and [[swr]]. See [[swr]].' },
      { path: 'wiki/entities/foo.md', content: 'See [[smith-chart]].' },
    ]
    const reader = async (basename: string) => {
      if (basename === 'smith-chart') return { path: 'wiki/concepts/smith-chart.md', content: '# Smith Chart' }
      if (basename === 'swr') return { path: 'wiki/concepts/swr.md', content: '# SWR' }
      return null
    }
    const expanded = await expandWithOneHopWikilinks(base, reader, 5)
    // smith-chart freq=2, swr freq=2, sorted by freq then name
    expect(expanded.map((e) => e.path)).toEqual([
      'wiki/concepts/smith-chart.md',
      'wiki/concepts/swr.md',
    ])
  })

  it('respects cap', async () => {
    const base = [{ path: 'a.md', content: '[[a]] [[b]] [[c]] [[d]] [[e]] [[f]]' }]
    const reader = async (n: string) => ({ path: `wiki/entities/${n}.md`, content: '' })
    const expanded = await expandWithOneHopWikilinks(base, reader, 3)
    expect(expanded).toHaveLength(3)
  })

  it('skips wikilinks whose target is already in baseResults', async () => {
    const base = [
      { path: 'wiki/concepts/smith-chart.md', content: '# Smith Chart' },
      { path: 'wiki/entities/nanovna-v2.md', content: 'See [[smith-chart]] and [[swr]].' },
    ]
    const reader = async (basename: string) => {
      if (basename === 'smith-chart') return { path: 'wiki/concepts/smith-chart.md', content: '#' }
      if (basename === 'swr') return { path: 'wiki/concepts/swr.md', content: '#' }
      return null
    }
    const expanded = await expandWithOneHopWikilinks(base, reader, 5)
    expect(expanded.map((e) => e.path)).toEqual(['wiki/concepts/swr.md'])
  })

  it('skips unresolvable wikilinks (target not in wiki)', async () => {
    const base = [{ path: 'a.md', content: '[[exists]] [[missing]]' }]
    const reader = async (n: string) => (n === 'exists' ? { path: `wiki/entities/${n}.md`, content: '' } : null)
    const expanded = await expandWithOneHopWikilinks(base, reader, 5)
    expect(expanded).toHaveLength(1)
    expect(expanded[0].path).toBe('wiki/entities/exists.md')
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

  // §5.2.2 — wikilink 1-hop 활용 지시 추가
  it('instructs LLM to use information from [[wikilink]] referenced pages', () => {
    const prompt = buildSynthesisPrompt('ctx', 'q')
    expect(prompt).toMatch(/\[\[wikilink\]\].*활용|활용.*\[\[wikilink\]\]/)
  })

  it('instructs LLM to link first-mention entities/concepts as [[페이지명]]', () => {
    const prompt = buildSynthesisPrompt('ctx', 'q')
    expect(prompt).toMatch(/첫 등장.*\[\[페이지명\]\]/)
  })

  it('instructs LLM to include 1-hop link targets in 참고: block', () => {
    const prompt = buildSynthesisPrompt('ctx', 'q')
    expect(prompt).toMatch(/1-hop|직접 인용.*1-hop|1-hop.*참고/)
  })

  // Phase 5 §5.10.2.1 AC-C5.1 — Prevention: broken wikilink 자동 페이지 생성 차단.
  // LLM 이 *위키에 실제 존재하는* entity/concept 만 [[wikilink]] 로 표기. 없는 것은 plain text.
  it('AC-C5.1 (1): context 의 page section 으로부터 [Available pages] block 자동 주입', () => {
    const context = '--- esc.md ---\n# ESC\nspeed controller\n\n--- pwm.md ---\n# PWM\nmodulation\n'
    const prompt = buildSynthesisPrompt(context, 'ESC와 PWM 차이?')
    // [Available pages] block 명시 — LLM 이 명시 참조
    expect(prompt).toMatch(/\[Available pages\]/)
    expect(prompt).toContain('esc')
    expect(prompt).toContain('pwm')
  })

  it('AC-C5.1 (2): rule 정정 — 답변에 등장한 entity/concept 중 페이지 base name 목록에 있는 것만 [[wikilink]]', () => {
    const prompt = buildSynthesisPrompt('--- esc.md ---\n# ESC\n', 'q')
    // rule line 386 정정 — 페이지 base name 목록 참조 + plain text 명시
    expect(prompt).toMatch(/페이지 base name 목록.*있는 것만|목록에 있는 것만.*\[\[페이지명\]\]/)
    expect(prompt).toMatch(/목록에 없는|존재하지 않는.*plain text|plain text.*표기/)
  })

  it('AC-C5.1 (3): rule 정정 — read 실패 (wiki/ 에 없는) wikilink 답변에 포함 안 함 instruction', () => {
    const prompt = buildSynthesisPrompt('--- esc.md ---\n# ESC\n', 'q')
    // rule line 385 정정 — read 실패 wikilink 답변 미포함
    expect(prompt).toMatch(/read 실패|read 된 페이지의 정보만 활용|read 안.*포함하지 마|실제 read.*만/)
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

  it('current vault_path 있음 — raw 링크 append (alias 형식, display 는 basename without ext fallback)', async () => {
    const fs = new MemoryFS()
    const registry: SourceRegistry = {
      [ID_FOO]: mkRecord({
        vault_path: 'raw/2_areas/foo.pdf',
        path_history: [{ vault_path: 'raw/0_inbox/foo.pdf', at: '2026-04-10T00:00:00Z' }],
      }),
    }
    await fs.write(REGISTRY_PATH, JSON.stringify(registry))
    // wiki/sources/source-foo.md 가 *없으면* fallback display = basename without ext
    const out = await appendOriginalLinks('답변 본문', [citation([ID_FOO])], { wikiFS: fs })
    // §5.18 Spec 1 I3 sweep: inline format → list format with ext badge
    expect(out).toContain('원본:\n- [[raw/2_areas/foo.pdf|foo]] (pdf)')
    expect(out).toContain('답변 본문')
  })

  // §5.15.D follow-up (사용자 raise 2026-05-07 정정): footer display = raw 파일명
  // basename. frontmatter title 은 LLM 이 추출한 부제 (예: 헤드라인) 이라 *원문 제목*
  // 으로 부적절. raw filename 은 sanitize 후 한국어 원문 보존이라 그대로 사용.
  it('§5.15.D footer — 한국어 raw filename basename display (sanitize 후)', async () => {
    const fs = new MemoryFS()
    const registry: SourceRegistry = {
      [ID_FOO]: mkRecord({
        vault_path: 'raw/3_resources/60_note/AI 기반 자연어 데이터 질의 - finetree-SQL.md',
      }),
    }
    await fs.write(REGISTRY_PATH, JSON.stringify(registry))
    // wiki/sources frontmatter title 이 *부제* 라도 raw basename 이 우선
    await fs.write(
      'wiki/sources/source-finetree-sql.md',
      `---\ntitle: AI로 자연어 질의를 SQL로\ntype: source\nsource_id: ${ID_FOO}\n---\n\n# 본문`,
    )
    const out = await appendOriginalLinks('답변', [citation([ID_FOO])], { wikiFS: fs })
    // §5.18 Spec 1 I3 sweep: list format
    // raw 파일명 basename = 한국어 그대로 (sanitize 적용된 vault rename 후 형태)
    expect(out).toContain('원본:\n- [[raw/3_resources/60_note/AI 기반 자연어 데이터 질의 - finetree-SQL.md|AI 기반 자연어 데이터 질의 - finetree-SQL]] (md)')
    // frontmatter title (부제) 은 사용 안 함
    expect(out).not.toContain('AI로 자연어 질의를 SQL로')
  })

  it('§5.15.D footer — frontmatter title 부재해도 raw basename fallback', async () => {
    const fs = new MemoryFS()
    const registry: SourceRegistry = {
      [ID_FOO]: mkRecord({ vault_path: 'raw/2_areas/foo.pdf' }),
    }
    await fs.write(REGISTRY_PATH, JSON.stringify(registry))
    const out = await appendOriginalLinks('답변', [citation([ID_FOO])], { wikiFS: fs })
    // §5.18 Spec 1 I3 sweep
    expect(out).toContain('원본:\n- [[raw/2_areas/foo.pdf|foo]] (pdf)')
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
    // §5.18 Spec 1 I3 sweep: list format
    // 마지막 유효 entry 가 우선
    expect(out).toContain('원본:\n- [[raw/4_archive/old.pdf|old]] (pdf)')
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

  // §5.3 follow-up — originalLinkMode 옵션 (raw / sidecar / hidden) + alias display
  it("mode='sidecar' — paired pdf 는 <vault_path>.md derive, display 는 raw basename (alias)", async () => {
    const fs = new MemoryFS()
    const registry: SourceRegistry = {
      [ID_FOO]: mkRecord({ vault_path: 'raw/2_areas/foo.pdf' }),
    }
    await fs.write(REGISTRY_PATH, JSON.stringify(registry))
    const out = await appendOriginalLinks('본문', [citation([ID_FOO])], {
      wikiFS: fs,
      mode: 'sidecar',
    })
    // §5.18 Spec 1 I3 sweep: list format
    // link target = sidecar md, display = raw basename without ext
    expect(out).toContain('원본:\n- [[raw/2_areas/foo.pdf.md|foo]] (pdf)')
  })

  it("mode='sidecar' — 단독 md 는 vault_path 자체 (자체가 sidecar 대용, display 는 ext 제거)", async () => {
    const fs = new MemoryFS()
    const registry: SourceRegistry = {
      [ID_FOO]: mkRecord({ vault_path: 'raw/3_resources/note.md' }),
    }
    await fs.write(REGISTRY_PATH, JSON.stringify(registry))
    const out = await appendOriginalLinks('본문', [citation([ID_FOO])], {
      wikiFS: fs,
      mode: 'sidecar',
    })
    // §5.18 Spec 1 I3 sweep: list format
    expect(out).toContain('원본:\n- [[raw/3_resources/note.md|note]] (md)')
    // 단독 md 는 .md.md 가 되지 않아야 함
    expect(out).not.toContain('note.md.md')
  })

  it("mode='sidecar' — txt 도 자체 (sidecar 미생성 정책 정합)", async () => {
    const fs = new MemoryFS()
    const registry: SourceRegistry = {
      [ID_FOO]: mkRecord({ vault_path: 'raw/2_areas/plain.txt' }),
    }
    await fs.write(REGISTRY_PATH, JSON.stringify(registry))
    const out = await appendOriginalLinks('본문', [citation([ID_FOO])], {
      wikiFS: fs,
      mode: 'sidecar',
    })
    // §5.18 Spec 1 I3 sweep: list format
    expect(out).toContain('원본:\n- [[raw/2_areas/plain.txt|plain]] (txt)')
    expect(out).not.toContain('plain.txt.md')
  })

  it("mode='hidden' — '원본:' footer 자체 미출력", async () => {
    const fs = new MemoryFS()
    const registry: SourceRegistry = {
      [ID_FOO]: mkRecord({ vault_path: 'raw/2_areas/foo.pdf' }),
    }
    await fs.write(REGISTRY_PATH, JSON.stringify(registry))
    const out = await appendOriginalLinks('답변 본문', [citation([ID_FOO])], {
      wikiFS: fs,
      mode: 'hidden',
    })
    expect(out).toBe('답변 본문')
    expect(out).not.toContain('원본:')
  })

  it("mode='raw' (default) — alias 형식 [[<full path>|<basename>]] (디렉토리/확장자 숨김)", async () => {
    const fs = new MemoryFS()
    const registry: SourceRegistry = {
      [ID_FOO]: mkRecord({ vault_path: 'raw/2_areas/foo.pdf' }),
    }
    await fs.write(REGISTRY_PATH, JSON.stringify(registry))
    const out = await appendOriginalLinks('본문', [citation([ID_FOO])], {
      wikiFS: fs,
      mode: 'raw',
    })
    // §5.18 Spec 1 I3 sweep: list format
    expect(out).toContain('원본:\n- [[raw/2_areas/foo.pdf|foo]] (pdf)')
  })

  it('display 에 디렉토리 경로가 포함되지 않음 (basename only)', async () => {
    const fs = new MemoryFS()
    const registry: SourceRegistry = {
      [ID_FOO]: mkRecord({
        vault_path: 'raw/3_resources/30_manual/500_natural_science/deep/nested/file.pdf',
      }),
    }
    await fs.write(REGISTRY_PATH, JSON.stringify(registry))
    const out = await appendOriginalLinks('본문', [citation([ID_FOO])], { wikiFS: fs })
    // alias display (| 뒤) 안에 슬래시가 없어야 함
    const m = out.match(/\[\[[^\]]+\|([^\]]+)\]\]/)
    expect(m).not.toBeNull()
    expect(m![1]).toBe('file')
    expect(m![1]).not.toContain('/')
  })
})

// §5.18 Step B (RED) — Query citation UX
// Spec: plan/phase-5/phase-5-spec-5.18-query-citation-ux.md v0.2
// Tester: 13 신규 test 중 wikey-core 측 7개 (T1~T7). 13/13 = wikey-core 7 + wikey-obsidian 6.
describe('§5.18 Spec 1 — appendOriginalLinks format (1줄 = 1 raw, ext badge, list)', () => {
  const ID_A = 'sha256:1111111111111111'
  const ID_B = 'sha256:2222222222222222'
  const ID_C = 'sha256:3333333333333333'

  function mkRecord(opts: Partial<SourceRecord>): SourceRecord {
    return {
      vault_path: '',
      hash: 'x'.repeat(64),
      size: 100,
      first_seen: '2026-05-12T00:00:00Z',
      ingested_pages: [],
      path_history: [],
      tombstone: false,
      ...opts,
    } as SourceRecord
  }
  const citation = (sourceIds: string[], pagePath = 'wiki/entities/foo.md'): Citation => ({
    wikiPagePath: pagePath,
    sourceIds,
  })

  // T1 ↔ Spec 1 Multi-source: 3 citations (md/pdf/hwp) — list format
  it('T1: Multi-source (3 citations md/pdf/hwp) → \\n- list format with ext badge', async () => {
    const fs = new MemoryFS()
    const registry: SourceRegistry = {
      [ID_A]: mkRecord({ vault_path: 'raw/2_areas/a.md' }),
      [ID_B]: mkRecord({ vault_path: 'raw/2_areas/b.pdf' }),
      [ID_C]: mkRecord({ vault_path: 'raw/2_areas/c.hwp' }),
    }
    await fs.write(REGISTRY_PATH, JSON.stringify(registry))
    const out = await appendOriginalLinks(
      '답변 본문',
      [citation([ID_A, ID_B, ID_C])],
      { wikiFS: fs },
    )
    // Spec 1 I3: 답변 본문 ≤ 1줄 공백 후 `원본:` heading + 줄바꿈 후 `- [[<target>|<display>]] (<ext>)` list
    expect(out).toContain('\n\n원본:\n- [[raw/2_areas/a.md|a]] (md)\n- [[raw/2_areas/b.pdf|b]] (pdf)\n- [[raw/2_areas/c.hwp|c]] (hwp)')
    // Spec 1 I3a — list 항목 순서 = citation 발견 순 (a → b → c)
    expect(out).toMatch(/원본:\n- \[\[[^\]]*\|a\]\][^\n]*\n- \[\[[^\]]*\|b\]\][^\n]*\n- \[\[[^\]]*\|c\]\]/s)
    // inline `, ` join 잔재 X (old format)
    expect(out).not.toMatch(/원본: \[\[[^\]]+\]\], \[\[/)
  })

  // T2 ↔ Spec 1 Single-source: 1 citation → 동일 list format (1줄)
  it('T2: Single-source (1 citation) → list format 1줄, inline ", " 사용 X', async () => {
    const fs = new MemoryFS()
    const registry: SourceRegistry = {
      [ID_A]: mkRecord({ vault_path: 'raw/2_areas/a.md' }),
    }
    await fs.write(REGISTRY_PATH, JSON.stringify(registry))
    const out = await appendOriginalLinks('답변', [citation([ID_A])], { wikiFS: fs })
    expect(out).toContain('\n\n원본:\n- [[raw/2_areas/a.md|a]] (md)')
    // Spec 1 I3 — old inline format 잔재 X
    expect(out).not.toContain('원본: [[raw/2_areas/a.md|a]]')
  })

  // T3 ↔ Spec 1 Zero citation: empty → fallback "없음" (변경 X 유지)
  it('T3: Zero citation → "원본: (없음 — 외부 근거 없음)" 유지', async () => {
    const fs = new MemoryFS()
    const out = await appendOriginalLinks('본문만', [], { wikiFS: fs })
    expect(out).toContain('원본: (없음 — 외부 근거 없음)')
  })

  // T4 ↔ Spec 1 All resolve failed: registry mismatch → fallback + WARN log
  // (WARN 검증은 T6/T7 와 함께. T4 는 fallback 문구 유지만)
  it('T4: All resolve failed → "원본: (해석 실패 — registry 점검 필요)" 유지', async () => {
    const fs = new MemoryFS()
    await fs.write(REGISTRY_PATH, '{}') // empty registry
    const out = await appendOriginalLinks(
      '본문',
      [citation(['sha256:nonexistent000000'])],
      { wikiFS: fs },
    )
    expect(out).toContain('원본: (해석 실패 — registry 점검 필요)')
  })

  // T5 ↔ Spec 1 I2 extension badge dynamic derive (hardcoded mapping 0건)
  it('T5: ext badge dynamic derive — .md/.pdf/.hwp/.unknown-ext lowercase + no-ext → (file)', async () => {
    const fs = new MemoryFS()
    const ID_README = 'sha256:4444444444444444'
    const ID_UNKNOWN = 'sha256:5555555555555555'
    const registry: SourceRegistry = {
      [ID_A]: mkRecord({ vault_path: 'raw/2_areas/a.md' }),
      [ID_B]: mkRecord({ vault_path: 'raw/2_areas/b.PDF' }), // uppercase ext → lowercase 'pdf'
      [ID_C]: mkRecord({ vault_path: 'raw/2_areas/c.HwP' }), // mixed case → lowercase 'hwp'
      [ID_README]: mkRecord({ vault_path: 'raw/3_resources/README' }), // no ext → (file)
      [ID_UNKNOWN]: mkRecord({ vault_path: 'raw/2_areas/d.unknown-ext' }), // arbitrary ext
    }
    await fs.write(REGISTRY_PATH, JSON.stringify(registry))
    const out = await appendOriginalLinks(
      '답변',
      [citation([ID_A, ID_B, ID_C, ID_README, ID_UNKNOWN])],
      { wikiFS: fs },
    )
    expect(out).toMatch(/\[\[raw\/2_areas\/a\.md\|a\]\] \(md\)/)
    expect(out).toMatch(/\[\[raw\/2_areas\/b\.PDF\|b\]\] \(pdf\)/)
    expect(out).toMatch(/\[\[raw\/2_areas\/c\.HwP\|c\]\] \(hwp\)/)
    expect(out).toMatch(/\[\[raw\/3_resources\/README\|README\]\] \(file\)/)
    expect(out).toMatch(/\[\[raw\/2_areas\/d\.unknown-ext\|d\]\] \(unknown-ext\)/)
  })
})

describe('§5.18 Spec 3 — registry mismatch WARN log (sensitive content X)', () => {
  const ID_MISS = 'sha256:679cf2dd6db75e3a' // 실측 mismatch sourceId
  const ID_OK = 'sha256:6666666666666666'

  function mkRecord(opts: Partial<SourceRecord>): SourceRecord {
    return {
      vault_path: '',
      hash: 'x'.repeat(64),
      size: 100,
      first_seen: '2026-05-12T00:00:00Z',
      ingested_pages: [],
      path_history: [],
      tombstone: false,
      ...opts,
    } as SourceRecord
  }
  const citation = (sourceIds: string[], pagePath = 'wiki/entities/claude-code.md'): Citation => ({
    wikiPagePath: pagePath,
    sourceIds,
  })

  // T6 ↔ Spec 3 I7 WARN log format: mismatch sourceId 발생 시 console.warn 호출
  it('T6: mismatch sourceId → console.warn called with sensitive-X format', async () => {
    const fs = new MemoryFS()
    await fs.write(REGISTRY_PATH, '{}') // empty registry → ID_MISS 미등록
    const warnSpy: string[] = []
    const origWarn = console.warn
    console.warn = (...args: unknown[]) => {
      warnSpy.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
    }
    try {
      await appendOriginalLinks(
        '답변 본문 (사용자 conversational — 노출 금지)',
        [citation([ID_MISS], 'wiki/entities/claude-code.md')],
        { wikiFS: fs },
      )
    } finally {
      console.warn = origWarn
    }
    // I7 format: [wikey citation] sourceId=<id> not found in registry (page=<wiki page path>)
    const matched = warnSpy.find((m) =>
      m.includes('[wikey citation]') &&
      m.includes(ID_MISS) &&
      m.includes('wiki/entities/claude-code.md'),
    )
    expect(matched).toBeTruthy()
    // I7 sensitive-X: 답변 본문 / raw vault path 미포함 (registry empty 이므로 raw path 없음 보장
    // — 단, 답변 본문이 절대 포함되지 않음 검증)
    for (const m of warnSpy) {
      expect(m).not.toContain('답변 본문 (사용자 conversational')
    }
  })

  // T7 ↔ Spec 3 Mismatch detected: appendOriginalLinks 가 mismatch 시 fallback message + WARN 동시 발화
  it('T7: mismatch detected → fallback "(해석 실패)" + WARN 동시 발화', async () => {
    const fs = new MemoryFS()
    await fs.write(REGISTRY_PATH, '{}')
    const warnSpy: string[] = []
    const origWarn = console.warn
    console.warn = (...args: unknown[]) => {
      warnSpy.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
    }
    let out = ''
    try {
      out = await appendOriginalLinks(
        '본문',
        [citation([ID_MISS])],
        { wikiFS: fs },
      )
    } finally {
      console.warn = origWarn
    }
    // fallback message
    expect(out).toContain('원본: (해석 실패 — registry 점검 필요)')
    // WARN 도 발화
    expect(warnSpy.some((m) => m.includes('[wikey citation]') && m.includes(ID_MISS))).toBe(true)
  })
})
