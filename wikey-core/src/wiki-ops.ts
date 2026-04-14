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

export async function updateIndex(
  wikiFS: WikiFS,
  additions: readonly string[],
): Promise<void> {
  const indexPath = 'wiki/index.md'
  const content = await wikiFS.read(indexPath)

  const newEntries = additions.filter((entry) => {
    const links = extractWikilinks(entry)
    return links.every((link) => !content.includes(`[[${link}]]`))
  })

  if (newEntries.length === 0) return

  const updated = content.trimEnd() + '\n' + newEntries.join('\n') + '\n'
  await wikiFS.write(indexPath, updated)
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
