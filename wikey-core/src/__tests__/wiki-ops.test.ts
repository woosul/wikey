import { describe, it, expect, beforeEach } from 'vitest'
import {
  createPage,
  updateIndex,
  appendLog,
  extractWikilinks,
  normalizeBase,
  extractFirstSentence,
  stripBrokenWikilinks,
  injectSourceFrontmatter,
  rewriteSourcePageMeta,
  appendClassifyFeedback,
  appendDeletedSourceBanner,
  injectProvenance,
} from '../wiki-ops.js'
import type { WikiFS, WikiPage, ProvenanceEntry } from '../types.js'
import type { WrittenPage, SourceFrontmatter, ClassifyFeedbackEntry } from '../wiki-ops.js'

function createMockFS(files: Record<string, string> = {}): WikiFS {
  const store = new Map(Object.entries(files))
  return {
    async read(path: string): Promise<string> {
      const content = store.get(path)
      if (content === undefined) throw new Error(`File not found: ${path}`)
      return content
    },
    async write(path: string, content: string): Promise<void> {
      store.set(path, content)
    },
    async exists(path: string): Promise<boolean> {
      return store.has(path)
    },
    async list(dir: string): Promise<string[]> {
      return [...store.keys()].filter((k) => k.startsWith(dir))
    },
  }
}

describe('createPage', () => {
  it('creates a page with correct path', async () => {
    const fs = createMockFS()
    const page: WikiPage = {
      filename: 'esc.md',
      content: '---\ntitle: ESC\ntype: entity\n---\n\n# ESC\n\nElectronic Speed Controller',
      category: 'entities',
    }
    await createPage(fs, page)
    const content = await fs.read('wiki/entities/esc.md')
    expect(content).toContain('# ESC')
  })

  it('rejects filenames with directory traversal (..)', async () => {
    const fs = createMockFS()
    const page: WikiPage = {
      filename: '..exploit.md',
      content: 'malicious',
      category: 'entities',
    }
    await expect(createPage(fs, page)).rejects.toThrow()
  })

  it('strips path prefix from LLM-generated filenames', async () => {
    const fs = createMockFS()
    const page: WikiPage = {
      filename: 'wiki/entities/clean-name.md',
      content: '---\ntitle: Test\n---\n\ncontent',
      category: 'entities',
    }
    await createPage(fs, page)
    expect(await fs.exists('wiki/entities/clean-name.md')).toBe(true)
  })

  it('updates existing page when it exists', async () => {
    const fs = createMockFS({
      'wiki/entities/esc.md': '---\ntitle: ESC\n---\n\nOld content',
    })
    const page: WikiPage = {
      filename: 'esc.md',
      content: '---\ntitle: ESC\ntype: entity\n---\n\nNew content',
      category: 'entities',
    }
    await createPage(fs, page)
    const content = await fs.read('wiki/entities/esc.md')
    expect(content).toContain('New content')
    expect(content).not.toContain('Old content')
  })
})

describe('updateIndex', () => {
  const INDEX_WITH_SECTIONS = [
    '# Index',
    '',
    '## 엔티티',
    '',
    '- [[esc]] — ESC',
    '',
    '## 개념',
    '',
    '- [[flight-mode]] — Flight mode',
    '',
    '## 소스',
    '',
    '- [[source-manual]] — Manual',
    '',
    '## 분석',
    '',
    '- [[risks]] — Risks',
    '',
  ].join('\n')

  it('adds new entries to index (legacy string form)', async () => {
    const fs = createMockFS({ 'wiki/index.md': '# Index\n\n## Entities\n\n- [[esc]] — ESC\n' })
    await updateIndex(fs, ['- [[fc]] — Flight Controller'])
    const content = await fs.read('wiki/index.md')
    expect(content).toContain('[[fc]]')
  })

  it('skips duplicate entries', async () => {
    const fs = createMockFS({ 'wiki/index.md': '# Index\n\n## Entities\n\n- [[esc]] — ESC\n' })
    await updateIndex(fs, ['- [[esc]] — Electronic Speed Controller'])
    const content = await fs.read('wiki/index.md')
    const matches = content.match(/\[\[esc\]\]/g)
    expect(matches?.length).toBe(1)
  })

  it('routes entity to 엔티티 section when category given', async () => {
    const fs = createMockFS({ 'wiki/index.md': INDEX_WITH_SECTIONS })
    await updateIndex(fs, [{ entry: '- [[fc]] — Flight Controller', category: 'entities' }])
    const content = await fs.read('wiki/index.md')
    const entSection = content.slice(content.indexOf('## 엔티티'), content.indexOf('## 개념'))
    expect(entSection).toContain('[[fc]]')
    const analSection = content.slice(content.indexOf('## 분석'))
    expect(analSection).not.toContain('[[fc]]')
  })

  it('routes concept to 개념 section', async () => {
    const fs = createMockFS({ 'wiki/index.md': INDEX_WITH_SECTIONS })
    await updateIndex(fs, [{ entry: '- [[gps-lock]] — GPS lock', category: 'concepts' }])
    const content = await fs.read('wiki/index.md')
    const concSection = content.slice(content.indexOf('## 개념'), content.indexOf('## 소스'))
    expect(concSection).toContain('[[gps-lock]]')
  })

  it('routes source to 소스 section', async () => {
    const fs = createMockFS({ 'wiki/index.md': INDEX_WITH_SECTIONS })
    await updateIndex(fs, [{ entry: '- [[source-fpv]] — FPV guide', category: 'sources' }])
    const content = await fs.read('wiki/index.md')
    const srcSection = content.slice(content.indexOf('## 소스'), content.indexOf('## 분석'))
    expect(srcSection).toContain('[[source-fpv]]')
  })

  it('distributes mixed categories to respective sections in one call', async () => {
    const fs = createMockFS({ 'wiki/index.md': INDEX_WITH_SECTIONS })
    await updateIndex(fs, [
      { entry: '- [[fc]] — FC', category: 'entities' },
      { entry: '- [[pid]] — PID tuning', category: 'concepts' },
      { entry: '- [[source-wiki]] — Wiki source', category: 'sources' },
    ])
    const content = await fs.read('wiki/index.md')
    const entSection = content.slice(content.indexOf('## 엔티티'), content.indexOf('## 개념'))
    const concSection = content.slice(content.indexOf('## 개념'), content.indexOf('## 소스'))
    const srcSection = content.slice(content.indexOf('## 소스'), content.indexOf('## 분석'))
    expect(entSection).toContain('[[fc]]')
    expect(concSection).toContain('[[pid]]')
    expect(srcSection).toContain('[[source-wiki]]')
  })

  it('legacy string entries fall back to 분석 section', async () => {
    const fs = createMockFS({ 'wiki/index.md': INDEX_WITH_SECTIONS })
    await updateIndex(fs, ['- [[new-insight]] — Insight'])
    const content = await fs.read('wiki/index.md')
    const analSection = content.slice(content.indexOf('## 분석'))
    expect(analSection).toContain('[[new-insight]]')
  })

  // Phase A: writtenPages-fallback (deterministic auto-fill of LLM omissions)

  it('auto-fills index entries for written pages the LLM omitted', async () => {
    const fs = createMockFS({ 'wiki/index.md': INDEX_WITH_SECTIONS })
    const writtenPages: WrittenPage[] = [
      { filename: 'kim-myung-ho.md', category: 'entities',
        content: '---\ntitle: 김명호\n---\n\n# 김명호\n\n주식회사 굿스트림 대표이사.' },
      { filename: 'tax-invoice.md', category: 'concepts',
        content: '---\ntitle: 세금계산서\n---\n\n# 세금계산서\n\n부가가치세법상 거래 증빙 문서.' },
    ]
    // LLM only mentioned the entity, omitted the concept entirely
    await updateIndex(fs, [{ entry: '- [[kim-myung-ho]] — 김명호 (LLM)', category: 'entities' }], writtenPages)
    const content = await fs.read('wiki/index.md')
    expect(content).toContain('[[kim-myung-ho]] — 김명호 (LLM)')  // LLM entry preserved
    const concSection = content.slice(content.indexOf('## 개념'), content.indexOf('## 소스'))
    expect(concSection).toContain('[[tax-invoice]]')  // auto-filled
    expect(concSection).toContain('부가가치세법상 거래 증빙 문서')
  })

  it('does not double-register pages already in the LLM additions', async () => {
    const fs = createMockFS({ 'wiki/index.md': INDEX_WITH_SECTIONS })
    const writtenPages: WrittenPage[] = [
      { filename: 'fc.md', category: 'entities', content: '---\ntitle: FC\n---\n\n# FC\n\nFlight controller.' },
    ]
    await updateIndex(fs, [{ entry: '- [[fc]] — Flight Controller', category: 'entities' }], writtenPages)
    const content = await fs.read('wiki/index.md')
    const matches = content.match(/\[\[fc\]\]/g)
    expect(matches?.length).toBe(1)  // not duplicated
  })

  it('skips writtenPages already present in existing index', async () => {
    const fs = createMockFS({ 'wiki/index.md': INDEX_WITH_SECTIONS })
    const writtenPages: WrittenPage[] = [
      { filename: 'esc.md', category: 'entities', content: '---\ntitle: ESC\n---\n\n# ESC\n\nUpdated.' },  // already in index
    ]
    await updateIndex(fs, [], writtenPages)
    const content = await fs.read('wiki/index.md')
    const matches = content.match(/\[\[esc\]\]/g)
    expect(matches?.length).toBe(1)  // no duplicate added
  })

  it('handles writtenPages filename with .md extension and path consistently via normalizeBase', async () => {
    const fs = createMockFS({ 'wiki/index.md': INDEX_WITH_SECTIONS })
    const writtenPages: WrittenPage[] = [
      { filename: 'wiki/concepts/pmbok.md', category: 'concepts',
        content: '---\ntitle: PMBOK\n---\n\n# PMBOK\n\nProject management standard.' },
    ]
    await updateIndex(fs, [], writtenPages)
    const content = await fs.read('wiki/index.md')
    expect(content).toContain('[[pmbok]]')  // normalized — no path, no .md
  })
})

describe('appendLog', () => {
  it('prepends entry to log', async () => {
    const fs = createMockFS({
      'wiki/log.md': '# Log\n\n## 2026-04-11\n\n- Old entry\n',
    })
    await appendLog(fs, '## 2026-04-12\n\n- New entry')
    const content = await fs.read('wiki/log.md')
    expect(content.indexOf('2026-04-12')).toBeLessThan(content.indexOf('2026-04-11'))
  })

  it('appends to log without header separator', async () => {
    const fs = createMockFS({
      'wiki/log.md': '# Log',
    })
    await appendLog(fs, '## 2026-04-12\n\n- Entry')
    const content = await fs.read('wiki/log.md')
    expect(content).toContain('2026-04-12')
  })
})

describe('stripBrokenWikilinks', () => {
  it('keeps wikilinks pointing to bases in keepBases', () => {
    const input = '- 엔티티 생성: [[foo]], [[bar]]'
    const result = stripBrokenWikilinks(input, new Set(['foo', 'bar']))
    expect(result).toContain('[[foo]]')
    expect(result).toContain('[[bar]]')
  })

  it('strips wikilinks whose base is NOT in keepBases (dropped by canonicalizer)', () => {
    const input = '- 엔티티 생성: [[foo]], [[dropped-label]], [[bar]]'
    const result = stripBrokenWikilinks(input, new Set(['foo', 'bar']))
    expect(result).toContain('[[foo]]')
    expect(result).toContain('[[bar]]')
    expect(result).not.toContain('[[dropped-label]]')
    expect(result).not.toContain('dropped-label')
  })

  it('tidies double commas and trailing commas after strip', () => {
    const input = '- Entities: [[a]], [[dropped]], [[b]]'
    const result = stripBrokenWikilinks(input, new Set(['a', 'b']))
    expect(result).not.toContain(', ,')
    expect(result).not.toContain(',,')
  })

  it('collapses 3+ consecutive commas to single (after multiple drops)', () => {
    const input = '- 개념: [[a]], [[d1]], [[d2]], [[d3]], [[b]]'
    const result = stripBrokenWikilinks(input, new Set(['a', 'b']))
    expect(result).not.toMatch(/,\s*,/)  // no double commas anywhere
    expect(result).toContain('[[a]]')
    expect(result).toContain('[[b]]')
  })

  it('drops list lines that become empty after strip', () => {
    const input = '- 엔티티: [[foo]]\n- 개념: [[only-dropped]]\n- Note'
    const result = stripBrokenWikilinks(input, new Set(['foo']))
    expect(result).toContain('[[foo]]')
    expect(result).not.toMatch(/개념:\s*$/m)
  })

  it('normalizes path/md variants before matching keepBases', () => {
    const input = '- [[wiki/concepts/pmbok.md]] and [[pmbok]]'
    const result = stripBrokenWikilinks(input, new Set(['pmbok']))
    // Both forms should be kept since they normalize to 'pmbok'
    expect(result).toMatch(/\[\[/)
  })
})

describe('extractWikilinks', () => {
  it('extracts simple wikilinks', () => {
    const content = 'See [[esc]] and [[fc]] for details.'
    expect(extractWikilinks(content)).toEqual(['esc', 'fc'])
  })

  it('returns empty array for no wikilinks', () => {
    expect(extractWikilinks('No links here.')).toEqual([])
  })

  it('handles duplicate wikilinks', () => {
    const content = '[[esc]] is related to [[esc]] via [[fc]]'
    const result = extractWikilinks(content)
    expect(result).toEqual(['esc', 'fc'])
  })

  it('handles wikilinks with display text', () => {
    const content = '[[esc|Electronic Speed Controller]] and [[fc]]'
    const result = extractWikilinks(content)
    expect(result).toEqual(['esc', 'fc'])
  })
})

// ── Phase 4.2 Stage 1 S1-3 / Stage 2 S2-2 ──

const META: SourceFrontmatter = {
  source_id: 'sha256:a3f2b19c4e8d0f72',
  vault_path: 'raw/3_resources/30_manual/500_natural_science/PMS_제품소개_R10.pdf',
  sidecar_vault_path:
    'raw/3_resources/30_manual/500_natural_science/PMS_제품소개_R10.pdf.md',
  hash: 'a3f2b19c4e8d0f72c9d1e5f6abcdef1234567890abcdef1234567890abcdef12',
  size: 3634821,
  first_seen: '2026-04-23T00:00:00.000Z',
}

describe('injectSourceFrontmatter — v3 format', () => {
  it('adds frontmatter when content has none', () => {
    const result = injectSourceFrontmatter('# 제목\n\n본문', META)
    expect(result).toMatch(/^---\nsource_id: sha256:a3f2b19c4e8d0f72\n/)
    expect(result).toContain('vault_path: raw/3_resources/30_manual/500_natural_science/PMS_제품소개_R10.pdf')
    expect(result).toContain('# 제목')
  })

  it('preserves non-managed LLM frontmatter keys (title, tags)', () => {
    const existing = '---\ntitle: PMS 제품소개\ntags: [manual, product]\n---\n\n# 제목\n본문'
    const result = injectSourceFrontmatter(existing, META)
    expect(result).toContain('title: PMS 제품소개')
    expect(result).toContain('tags: [manual, product]')
    expect(result).toContain('source_id: sha256:a3f2b19c4e8d0f72')
    // Managed keys are replaced, not duplicated.
    expect(result.match(/source_id:/g)?.length).toBe(1)
  })

  it('replaces stale managed keys (old vault_path is dropped)', () => {
    const stale =
      '---\nsource_id: sha256:oldoldoldoldoldo\nvault_path: raw/0_inbox/PMS.pdf\nhash: oldhash\n---\n\n본문'
    const result = injectSourceFrontmatter(stale, META)
    expect(result).not.toContain('sha256:oldoldoldoldoldo')
    expect(result).not.toContain('raw/0_inbox/PMS.pdf')
    expect(result).toContain('source_id: sha256:a3f2b19c4e8d0f72')
    expect(result).toContain(
      'vault_path: raw/3_resources/30_manual/500_natural_science/PMS_제품소개_R10.pdf',
    )
  })
})

describe('rewriteSourcePageMeta — post-move frontmatter patch', () => {
  const pageContent = `---
title: PMS 제품소개
source_id: sha256:a3f2b19c4e8d0f72
vault_path: raw/0_inbox/PMS_제품소개_R10.pdf
sidecar_vault_path: raw/0_inbox/PMS_제품소개_R10.pdf.md
hash: a3f2b19c4e8d0f72...
size: 100
first_seen: 2026-04-23T00:00:00.000Z
---

# 제목

본문`

  it('updates vault_path and sidecar_vault_path only, preserves other fields', () => {
    const result = rewriteSourcePageMeta(pageContent, {
      vault_path: 'raw/3_resources/30_manual/500_natural_science/PMS_제품소개_R10.pdf',
      sidecar_vault_path:
        'raw/3_resources/30_manual/500_natural_science/PMS_제품소개_R10.pdf.md',
    })
    expect(result).toContain(
      'vault_path: raw/3_resources/30_manual/500_natural_science/PMS_제품소개_R10.pdf',
    )
    expect(result).not.toContain('raw/0_inbox/PMS_제품소개_R10.pdf')
    // Other managed fields preserved.
    expect(result).toContain('source_id: sha256:a3f2b19c4e8d0f72')
    expect(result).toContain('hash: a3f2b19c4e8d0f72...')
    expect(result).toContain('size: 100')
    expect(result).toContain('title: PMS 제품소개')
    // Body preserved.
    expect(result).toContain('# 제목')
    expect(result).toContain('본문')
  })

  it('removes sidecar_vault_path when sidecar becomes null', () => {
    const result = rewriteSourcePageMeta(pageContent, {
      vault_path: 'raw/3_resources/20_report/PMS_제품소개_R10.pdf',
      sidecar_vault_path: null,
    })
    expect(result).not.toContain('sidecar_vault_path')
  })

  it('adds sidecar_vault_path when previously absent', () => {
    const noSidecar = pageContent.replace(/sidecar_vault_path: .*\n/, '')
    const result = rewriteSourcePageMeta(noSidecar, {
      vault_path: 'raw/3_resources/30_manual/x.pdf',
      sidecar_vault_path: 'raw/3_resources/30_manual/x.pdf.md',
    })
    expect(result).toContain('sidecar_vault_path: raw/3_resources/30_manual/x.pdf.md')
  })

  it('idempotent on Korean paths (calling twice yields same output)', () => {
    const patch = {
      vault_path: 'raw/3_resources/30_manual/500_natural_science/PMS_제품소개_R10.pdf',
      sidecar_vault_path:
        'raw/3_resources/30_manual/500_natural_science/PMS_제품소개_R10.pdf.md',
    }
    const once = rewriteSourcePageMeta(pageContent, patch)
    const twice = rewriteSourcePageMeta(once, patch)
    expect(twice).toBe(once)
  })
})

// ── §4.2.3 Stage 3 S3-4: appendClassifyFeedback ──

describe('appendClassifyFeedback (§4.2.3 S3-4)', () => {
  const entry: ClassifyFeedbackEntry = {
    filename: 'Mystery-Paper.pdf',
    userChoice: 'raw/3_resources/20_report/100_philosophy_psychology/',
    llmChoice: 'raw/3_resources/20_report/300_social_sciences/',
    llmReason: 'business 키워드 매칭',
    at: '2026-04-23',
  }

  it('CLASSIFY.md 부재 시 새 파일 + 피드백 로그 섹션 생성', async () => {
    const fs = createMockFS()
    const added = await appendClassifyFeedback(fs, entry)
    expect(added).toBe(true)
    const content = await fs.read('raw/CLASSIFY.md')
    expect(content).toContain('## 피드백 로그')
    expect(content).toContain('- 2026-04-23 Mystery-Paper.pdf')
    expect(content).toContain('→ raw/3_resources/20_report/100_philosophy_psychology/')
    expect(content).toContain('LLM: raw/3_resources/20_report/300_social_sciences/')
    expect(content).toContain('business 키워드 매칭')
  })

  it('CLASSIFY.md 에 피드백 로그 섹션 없으면 append', async () => {
    const fs = createMockFS({
      'raw/CLASSIFY.md': '# CLASSIFY\n\n## 자동 규칙\n- .pdf → 30_manual\n',
    })
    await appendClassifyFeedback(fs, entry)
    const content = await fs.read('raw/CLASSIFY.md')
    expect(content).toContain('## 자동 규칙')
    expect(content).toContain('## 피드백 로그')
    expect(content.indexOf('## 자동 규칙')).toBeLessThan(content.indexOf('## 피드백 로그'))
  })

  it('피드백 로그 섹션 존재 시 해당 섹션에 append (중복 섹션 생성 안 함)', async () => {
    const initial = '# CLASSIFY\n\n## 피드백 로그\n- 2026-04-20 old.pdf → raw/x/ (LLM: raw/y/, 사유: 기존)\n'
    const fs = createMockFS({ 'raw/CLASSIFY.md': initial })
    await appendClassifyFeedback(fs, entry)
    const content = await fs.read('raw/CLASSIFY.md')
    const matches = content.match(/## 피드백 로그/g) || []
    expect(matches.length).toBe(1)
    expect(content).toContain('2026-04-20 old.pdf')
    expect(content).toContain('2026-04-23 Mystery-Paper.pdf')
  })

  it('동일 filename+userChoice+llmChoice 마지막 엔트리와 일치하면 중복 append 스킵', async () => {
    const fs = createMockFS()
    const first = await appendClassifyFeedback(fs, entry)
    const second = await appendClassifyFeedback(fs, entry)
    expect(first).toBe(true)
    expect(second).toBe(false)
    const content = await fs.read('raw/CLASSIFY.md')
    const occurrences = content.match(/Mystery-Paper\.pdf/g) || []
    expect(occurrences.length).toBe(1)
  })
})

// ── §4.2.4 Stage 4 S4-2: appendDeletedSourceBanner ──

describe('appendDeletedSourceBanner (§4.2.4 S4-2)', () => {
  const pagePath = 'wiki/sources/source-foo.md'
  const body = `---
source_id: sha256:xyz
vault_path: raw/0_inbox/foo.pdf
hash: abc
size: 10
first_seen: 2026-04-20T00:00:00Z
---

# source: foo

본문 요약.
`

  it('원본 삭제됨 callout 을 한 번만 append (idempotent)', async () => {
    const fs = createMockFS({ [pagePath]: body })
    const first = await appendDeletedSourceBanner(fs, pagePath, '2026-04-23')
    expect(first).toBe(true)
    const content1 = await fs.read(pagePath)
    expect(content1).toContain('[!warning] 원본 삭제됨')
    expect(content1).toContain('2026-04-23')

    const second = await appendDeletedSourceBanner(fs, pagePath, '2026-04-23')
    expect(second).toBe(false)
    const content2 = await fs.read(pagePath)
    // 한 번만 나타난다
    const count = (content2.match(/\[!warning\] 원본 삭제됨/g) || []).length
    expect(count).toBe(1)
  })

  it('페이지 부재 시 false 반환 (throw 하지 않음)', async () => {
    const fs = createMockFS()
    const result = await appendDeletedSourceBanner(fs, 'wiki/sources/missing.md', '2026-04-23')
    expect(result).toBe(false)
  })

  it('frontmatter 보존 — callout 은 본문 최상단에 추가, frontmatter 영역 건드리지 않음', async () => {
    const fs = createMockFS({ [pagePath]: body })
    await appendDeletedSourceBanner(fs, pagePath, '2026-04-23')
    const content = await fs.read(pagePath)
    expect(content).toMatch(/^---\n[\s\S]*?\n---\n/) // frontmatter intact
    const calloutIdx = content.indexOf('[!warning] 원본 삭제됨')
    const frontmatterEnd = content.indexOf('---\n', 4) + 4
    expect(calloutIdx).toBeGreaterThan(frontmatterEnd)
    // callout 은 본문 내용보다 앞에 위치
    expect(calloutIdx).toBeLessThan(content.indexOf('# source: foo'))
  })
})

// ── §4.3.2 Part A: injectProvenance ──

describe('injectProvenance (§4.3.2 Part A)', () => {
  const baseEntity =
    '---\ntitle: Alimtalk\ntype: entity\nentity_type: product\nsources: [source-pms.md]\n---\n\n# Alimtalk\n\n본문.\n'

  it('provenance 필드가 없을 때 새로 주입 (배열, 순서 보존)', () => {
    const entries: ProvenanceEntry[] = [
      { type: 'extracted', ref: 'sources/sha256:a3f2' },
      { type: 'inferred', ref: 'sources/sha256:b7c9', confidence: 0.7 },
    ]
    const result = injectProvenance(baseEntity, entries)
    expect(result).toContain('provenance:')
    expect(result).toContain('- type: extracted')
    expect(result).toContain('ref: sources/sha256:a3f2')
    expect(result).toContain('- type: inferred')
    expect(result).toContain('confidence: 0.7')
    // 기존 필드 보존
    expect(result).toContain('title: Alimtalk')
    expect(result).toContain('sources: [source-pms.md]')
    // 본문 보존
    expect(result).toContain('# Alimtalk')
    expect(result).toContain('본문.')
  })

  it('기존 provenance 에 dedupe 후 merge (type + ref 기준)', () => {
    const first: ProvenanceEntry[] = [{ type: 'extracted', ref: 'sources/sha256:a3f2' }]
    const withOne = injectProvenance(baseEntity, first)

    // 같은 {type, ref} 재주입 + 새 엔트리 추가
    const second: ProvenanceEntry[] = [
      { type: 'extracted', ref: 'sources/sha256:a3f2' }, // 중복
      { type: 'ambiguous', ref: 'sources/sha256:c8e1', reason: '동명이인' },
    ]
    const result = injectProvenance(withOne, second)
    // 중복 안 쌓임
    const extractedCount = (result.match(/- type: extracted/g) || []).length
    expect(extractedCount).toBe(1)
    // 새 엔트리 추가됨
    expect(result).toContain('- type: ambiguous')
    expect(result).toContain('reason: 동명이인')
  })

  it('frontmatter 없는 페이지 — frontmatter 블록 신규 생성 + 본문 보존', () => {
    const bodyOnly = '# 제목\n\n본문.\n'
    const entries: ProvenanceEntry[] = [{ type: 'extracted', ref: 'sources/sha256:a3f2' }]
    const result = injectProvenance(bodyOnly, entries)
    expect(result).toMatch(/^---\nprovenance:\n  - type: extracted\n    ref: sources\/sha256:a3f2\n---\n/)
    expect(result).toContain('# 제목')
    expect(result).toContain('본문.')
  })
})
