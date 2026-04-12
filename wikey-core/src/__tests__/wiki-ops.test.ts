import { describe, it, expect, beforeEach } from 'vitest'
import { createPage, updateIndex, appendLog, extractWikilinks } from '../wiki-ops.js'
import type { WikiFS, WikiPage } from '../types.js'

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

  it('rejects paths outside wiki/', async () => {
    const fs = createMockFS()
    const page: WikiPage = {
      filename: '../../../etc/passwd',
      content: 'malicious',
      category: 'entities',
    }
    await expect(createPage(fs, page)).rejects.toThrow()
  })

  it('rejects filenames with directory traversal', async () => {
    const fs = createMockFS()
    const page: WikiPage = {
      filename: '../../outside.md',
      content: 'content',
      category: 'entities',
    }
    await expect(createPage(fs, page)).rejects.toThrow()
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
  it('adds new entries to index', async () => {
    const fs = createMockFS({
      'wiki/index.md': '# Index\n\n## Entities\n\n- [[esc]] — ESC\n',
    })
    await updateIndex(fs, ['- [[fc]] — Flight Controller'])
    const content = await fs.read('wiki/index.md')
    expect(content).toContain('[[fc]]')
  })

  it('skips duplicate entries', async () => {
    const fs = createMockFS({
      'wiki/index.md': '# Index\n\n## Entities\n\n- [[esc]] — ESC\n',
    })
    await updateIndex(fs, ['- [[esc]] — Electronic Speed Controller'])
    const content = await fs.read('wiki/index.md')
    const matches = content.match(/\[\[esc\]\]/g)
    expect(matches?.length).toBe(1)
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
