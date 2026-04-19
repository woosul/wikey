import { describe, it, expect, beforeEach } from 'vitest'
import { createPage, updateIndex, appendLog, extractWikilinks, normalizeBase, extractFirstSentence, stripBrokenWikilinks } from '../wiki-ops.js'
import type { WikiFS, WikiPage } from '../types.js'
import type { WrittenPage } from '../wiki-ops.js'

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
