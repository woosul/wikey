import type { WikiFS, WikiPage } from './types.js'

const WIKI_PREFIX = 'wiki/'
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g

export async function createPage(
  wikiFS: WikiFS,
  page: WikiPage,
): Promise<void> {
  const path = buildPath(page.category, page.filename)
  await wikiFS.write(path, page.content)
}

export type IndexCategory = 'entities' | 'concepts' | 'sources' | 'analyses'

export type IndexAddition = string | { readonly entry: string; readonly category: IndexCategory }

const CATEGORY_HEADERS: Record<IndexCategory, string> = {
  entities: '## 엔티티',
  concepts: '## 개념',
  sources: '## 소스',
  analyses: '## 분석',
}

export async function updateIndex(
  wikiFS: WikiFS,
  additions: readonly IndexAddition[],
): Promise<void> {
  const indexPath = 'wiki/index.md'
  const content = await wikiFS.read(indexPath)

  // Skip duplicates (any addition whose wikilinks already exist in the index)
  const fresh = additions.filter((a) => {
    const entry = typeof a === 'string' ? a : a.entry
    const links = extractWikilinks(entry)
    return links.every((link) => !content.includes(`[[${link}]]`))
  })
  if (fresh.length === 0) return

  // Group by category. Legacy string additions fall through to 'analyses'.
  const grouped: Record<IndexCategory, string[]> = { entities: [], concepts: [], sources: [], analyses: [] }
  for (const a of fresh) {
    if (typeof a === 'string') grouped.analyses.push(a)
    else grouped[a.category].push(a.entry)
  }

  let updated = content
  for (const cat of Object.keys(grouped) as IndexCategory[]) {
    if (grouped[cat].length === 0) continue
    updated = insertIntoSection(updated, CATEGORY_HEADERS[cat], grouped[cat])
  }
  await wikiFS.write(indexPath, updated)
}

function insertIntoSection(content: string, header: string, entries: string[]): string {
  const startIdx = content.indexOf(header)
  if (startIdx === -1) {
    // Section missing — append the section with its entries at end
    return content.trimEnd() + '\n\n' + header + '\n\n' + entries.join('\n') + '\n'
  }
  // End of this section: next '## ' header or EOF
  const afterHeader = startIdx + header.length
  const rest = content.slice(afterHeader)
  const nextHeaderMatch = rest.match(/\n##\s/)
  const sectionEnd = nextHeaderMatch && nextHeaderMatch.index !== undefined
    ? afterHeader + nextHeaderMatch.index + 1  // keep the leading \n
    : content.length
  const before = content.slice(0, sectionEnd).replace(/\n+$/, '')
  const after = content.slice(sectionEnd)
  return before + '\n' + entries.join('\n') + (after.startsWith('\n') ? after : '\n' + after)
}

export async function appendLog(
  wikiFS: WikiFS,
  entry: string,
): Promise<void> {
  const logPath = 'wiki/log.md'
  const content = await wikiFS.read(logPath)
  const headerEnd = content.indexOf('\n\n')
  if (headerEnd === -1) {
    await wikiFS.write(logPath, content + '\n\n' + entry + '\n')
    return
  }
  const header = content.slice(0, headerEnd)
  const body = content.slice(headerEnd)
  await wikiFS.write(logPath, header + '\n\n' + entry + '\n' + body)
}

export function extractWikilinks(content: string): readonly string[] {
  const links: string[] = []
  const seen = new Set<string>()
  let match: RegExpExecArray | null

  WIKILINK_RE.lastIndex = 0
  while ((match = WIKILINK_RE.exec(content)) !== null) {
    const link = match[1].trim()
    if (!seen.has(link)) {
      seen.add(link)
      links.push(link)
    }
  }

  return links
}

function buildPath(category: string, filename: string): string {
  // LLM sometimes returns full paths — strip to basename
  const cleaned = filename.includes('/') ? filename.split('/').pop()! : filename
  filename = cleaned
  if (filename.includes('..')) {
    throw new Error(`Invalid filename: ${filename} — directory traversal not allowed`)
  }
  const path = `${WIKI_PREFIX}${category}/${filename}`
  if (!path.startsWith(WIKI_PREFIX)) {
    throw new Error(`Path must start with ${WIKI_PREFIX}: ${path}`)
  }
  return path
}
