import type { WikiFS, WikiPage, ProvenanceEntry } from './types.js'

const WIKI_PREFIX = 'wiki/'
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g

// ── Phase 4.2 Stage 1 S1-3 / Stage 2 S2-2 ──

export interface SourceFrontmatter {
  readonly source_id: string
  readonly vault_path: string
  readonly sidecar_vault_path?: string
  readonly hash: string
  readonly size: number
  readonly first_seen: string
}

const FRONTMATTER_BLOCK = /^---\n([\s\S]*?)\n---\n?/

/**
 * Inject or normalize v3 source-page frontmatter. Preserves other YAML fields
 * the LLM produced (title, tags, etc.) and replaces only the managed keys.
 */
export function injectSourceFrontmatter(content: string, meta: SourceFrontmatter): string {
  const managed = buildManagedYaml(meta)
  const match = content.match(FRONTMATTER_BLOCK)
  if (!match) {
    return `---\n${managed}\n---\n\n${content.replace(/^\n+/, '')}`
  }
  const preserved = filterManagedKeys(match[1])
  const body = content.slice(match[0].length)
  const merged = preserved ? `${preserved}\n${managed}` : managed
  return `---\n${merged}\n---\n${body.startsWith('\n') ? body : '\n' + body}`
}

/**
 * Stage 2 S2-2 — update only vault_path / sidecar_vault_path on an existing page.
 * Other fields (source_id/hash/size/first_seen/preserved LLM fields) untouched.
 */
/**
 * §4.2.3 Stage 3 S3-4 — CLASSIFY.md 피드백 로그 append.
 *
 * 사용자가 LLM 제안과 다른 목적지를 선택했을 때 호출된다.
 * - 파일 부재 시 새로 생성 (헤더 + 피드백 로그 섹션)
 * - `## 피드백 로그` 섹션 없으면 파일 말미에 추가
 * - 섹션 존재 시 해당 섹션에 한 줄 append
 * - 마지막 엔트리가 동일하면 중복 append 스킵 (false 반환)
 *
 * 반환: append 되었으면 true, 중복 스킵이면 false.
 */
export interface ClassifyFeedbackEntry {
  readonly filename: string
  readonly userChoice: string
  readonly llmChoice: string
  readonly llmReason: string
  readonly at: string // 'YYYY-MM-DD'
}

const CLASSIFY_MD_PATH = 'raw/CLASSIFY.md'
const FEEDBACK_HEADER = '## 피드백 로그'

export async function appendClassifyFeedback(
  wikiFS: WikiFS,
  entry: ClassifyFeedbackEntry,
): Promise<boolean> {
  const line = `- ${entry.at} ${entry.filename} → ${entry.userChoice} (LLM: ${entry.llmChoice}, 사유: ${entry.llmReason})`

  const exists = await wikiFS.exists(CLASSIFY_MD_PATH)
  if (!exists) {
    const content = `# CLASSIFY\n\n${FEEDBACK_HEADER}\n${line}\n`
    await wikiFS.write(CLASSIFY_MD_PATH, content)
    return true
  }

  const content = await wikiFS.read(CLASSIFY_MD_PATH)
  const headerIdx = content.indexOf(FEEDBACK_HEADER)

  if (headerIdx === -1) {
    const needsNl = content.endsWith('\n') ? '' : '\n'
    const appended = `${content}${needsNl}\n${FEEDBACK_HEADER}\n${line}\n`
    await wikiFS.write(CLASSIFY_MD_PATH, appended)
    return true
  }

  const sectionStart = headerIdx + FEEDBACK_HEADER.length
  const nextHeaderRelIdx = content.slice(sectionStart).search(/\n##\s/)
  const sectionEnd = nextHeaderRelIdx === -1 ? content.length : sectionStart + nextHeaderRelIdx
  const before = content.slice(0, sectionEnd)
  const after = content.slice(sectionEnd)

  if (isDuplicateLastEntry(before, entry)) return false

  const trimmedBefore = before.replace(/\n*$/, '')
  const merged = `${trimmedBefore}\n${line}\n${after.startsWith('\n') ? after : '\n' + after}`
  await wikiFS.write(CLASSIFY_MD_PATH, merged)
  return true
}

/**
 * §4.3.2 Part A — entity/concept/analyses 페이지 frontmatter 에 `provenance` 배열 주입.
 *
 * 동작:
 *   - 기존 frontmatter 없음 → 새 블록 생성 (`provenance` 만 포함, 본문 보존).
 *   - 기존 frontmatter 있고 `provenance` 필드 없음 → 추가.
 *   - 기존 `provenance` 있음 → dedupe (type + ref 기준) 후 append.
 *
 * YAML 형식 (2-space indent, flow style 사용 안 함 — 가독성 + Obsidian 호환):
 *   provenance:
 *     - type: extracted
 *       ref: sources/sha256:...
 *     - type: inferred
 *       ref: sources/sha256:...
 *       confidence: 0.7
 */
export function injectProvenance(content: string, newEntries: readonly ProvenanceEntry[]): string {
  if (newEntries.length === 0) return content

  const match = content.match(FRONTMATTER_BLOCK)
  if (!match) {
    const yaml = renderProvenanceYaml(newEntries)
    const body = content.replace(/^\n+/, '')
    return `---\n${yaml}\n---\n\n${body}`
  }

  const fmInner = match[1]
  const body = content.slice(match[0].length)
  const existing = parseProvenance(fmInner)
  const merged = dedupeProvenance([...existing, ...newEntries])
  const fmWithoutProvenance = stripProvenanceField(fmInner)
  const provenanceYaml = renderProvenanceYaml(merged)
  const newFm = fmWithoutProvenance
    ? `${fmWithoutProvenance}\n${provenanceYaml}`
    : provenanceYaml
  return `---\n${newFm}\n---\n${body.startsWith('\n') ? body : '\n' + body}`
}

function renderProvenanceYaml(entries: readonly ProvenanceEntry[]): string {
  const lines = ['provenance:']
  for (const e of entries) {
    lines.push(`  - type: ${e.type}`)
    // ref 는 id-prefixed 문자열 (`sources/sha256:...`) 이라 콜론이 중간에 있지만
    // YAML block scalar 에서는 bare 로 안전 — "colon-space" 패턴일 때만 따옴표.
    lines.push(`    ref: ${provenanceYamlScalar(e.ref)}`)
    if (e.confidence != null) lines.push(`    confidence: ${e.confidence}`)
    if (e.reason) lines.push(`    reason: ${provenanceYamlScalar(e.reason)}`)
  }
  return lines.join('\n')
}

function provenanceYamlScalar(s: string): string {
  // 따옴표 강제 조건: 콜론-공백 / # word-boundary / 선행·후행 공백 / 특수 시작 문자.
  const needsQuote =
    /: /.test(s) ||
    /(^|\s)#/.test(s) ||
    /^\s|\s$/.test(s) ||
    /^[\[\{!&*|>]/.test(s) ||
    /^["']/.test(s)
  if (needsQuote) return JSON.stringify(s)
  return s
}

function parseProvenance(yaml: string): ProvenanceEntry[] {
  type Builder = { type?: ProvenanceEntry['type']; ref?: string; confidence?: number; reason?: string }
  const lines = yaml.split('\n')
  const out: ProvenanceEntry[] = []
  let inProvenance = false
  let current: Builder | null = null

  const flush = () => {
    if (current && current.type && current.ref) {
      const finalized: ProvenanceEntry = {
        type: current.type,
        ref: current.ref,
        ...(current.confidence != null ? { confidence: current.confidence } : {}),
        ...(current.reason != null ? { reason: current.reason } : {}),
      }
      out.push(finalized)
    }
    current = null
  }

  for (const raw of lines) {
    if (/^provenance\s*:/.test(raw)) {
      inProvenance = true
      continue
    }
    if (inProvenance) {
      // Top-level key (no indent) ends the provenance block
      if (/^[A-Za-z0-9_]+\s*:/.test(raw)) {
        inProvenance = false
        flush()
        continue
      }
      const listItem = raw.match(/^\s*-\s+type\s*:\s*(.+?)\s*$/)
      if (listItem) {
        flush()
        current = { type: listItem[1].trim() as ProvenanceEntry['type'] }
        continue
      }
      const field = raw.match(/^\s+([A-Za-z_]+)\s*:\s*(.+?)\s*$/)
      if (field && current) {
        const [, key, rawVal] = field
        const val = rawVal.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1')
        if (key === 'ref') current.ref = val
        else if (key === 'confidence') current.confidence = Number(val)
        else if (key === 'reason') current.reason = val
        else if (key === 'type') current.type = val as ProvenanceEntry['type']
      }
    }
  }
  flush()
  return out
}

function stripProvenanceField(yaml: string): string {
  const lines = yaml.split('\n')
  const kept: string[] = []
  let inProvenance = false
  for (const line of lines) {
    if (/^provenance\s*:/.test(line)) {
      inProvenance = true
      continue
    }
    if (inProvenance) {
      if (/^[A-Za-z0-9_]+\s*:/.test(line) && !/^\s/.test(line)) {
        inProvenance = false
        kept.push(line)
      }
      continue
    }
    kept.push(line)
  }
  return kept.join('\n').trim()
}

function dedupeProvenance(entries: readonly ProvenanceEntry[]): ProvenanceEntry[] {
  const seen = new Set<string>()
  const out: ProvenanceEntry[] = []
  for (const e of entries) {
    const key = `${e.type}\x00${e.ref}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(e)
  }
  return out
}

/**
 * §4.2.4 Stage 4 S4-2 — source 페이지에 "원본 삭제됨" warning callout 한 번만 추가.
 * Frontmatter 는 건드리지 않고 본문 최상단에 삽입. 이미 삽입되어 있으면 no-op.
 *
 * 반환: append 되었으면 true, 이미 있거나 파일 부재면 false.
 */
const DELETED_BANNER_TAG = '[!warning] 원본 삭제됨'

export async function appendDeletedSourceBanner(
  wikiFS: WikiFS,
  pagePath: string,
  at: string, // 'YYYY-MM-DD'
): Promise<boolean> {
  if (!(await wikiFS.exists(pagePath))) return false
  const content = await wikiFS.read(pagePath)
  if (content.includes(DELETED_BANNER_TAG)) return false

  const callout = `> ${DELETED_BANNER_TAG} (${at})\n> 원본 파일이 사라졌습니다. registry tombstone 상태. 복원 시 reconcile 이 자동 해제합니다.`

  const match = content.match(FRONTMATTER_BLOCK)
  if (!match) {
    await wikiFS.write(pagePath, `${callout}\n\n${content.replace(/^\n+/, '')}`)
    return true
  }
  const head = content.slice(0, match[0].length)
  const tail = content.slice(match[0].length).replace(/^\n+/, '')
  await wikiFS.write(pagePath, `${head}\n${callout}\n\n${tail}`)
  return true
}

function isDuplicateLastEntry(sectionText: string, entry: ClassifyFeedbackEntry): boolean {
  // Walk backward from the end of the section, skipping blank lines, to find
  // the most recent feedback line. If it matches filename+userChoice+llmChoice,
  // it's a duplicate regardless of date.
  const lines = sectionText.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i].trim()
    if (l === '') continue
    if (l.startsWith('##')) return false
    if (!l.startsWith('- ')) return false
    return (
      l.includes(` ${entry.filename} → ${entry.userChoice} `) &&
      l.includes(`LLM: ${entry.llmChoice},`)
    )
  }
  return false
}

export function rewriteSourcePageMeta(
  content: string,
  patch: { vault_path: string; sidecar_vault_path?: string | null },
): string {
  const match = content.match(FRONTMATTER_BLOCK)
  if (!match) return content
  const lines = match[1].split('\n')
  const keep: string[] = []
  for (const line of lines) {
    if (/^\s*vault_path\s*:/.test(line)) continue
    if (/^\s*sidecar_vault_path\s*:/.test(line)) continue
    keep.push(line)
  }
  keep.push(`vault_path: ${yamlString(patch.vault_path)}`)
  if (patch.sidecar_vault_path) {
    keep.push(`sidecar_vault_path: ${yamlString(patch.sidecar_vault_path)}`)
  }
  const body = content.slice(match[0].length)
  return `---\n${keep.join('\n')}\n---\n${body.startsWith('\n') ? body : '\n' + body}`
}

function buildManagedYaml(m: SourceFrontmatter): string {
  const lines: string[] = [
    `source_id: ${m.source_id}`,
    `vault_path: ${yamlString(m.vault_path)}`,
  ]
  if (m.sidecar_vault_path) lines.push(`sidecar_vault_path: ${yamlString(m.sidecar_vault_path)}`)
  lines.push(`hash: ${m.hash}`)
  lines.push(`size: ${m.size}`)
  lines.push(`first_seen: ${m.first_seen}`)
  return lines.join('\n')
}

const MANAGED_KEYS = new Set([
  'source_id',
  'vault_path',
  'sidecar_vault_path',
  'hash',
  'size',
  'first_seen',
])

function filterManagedKeys(yaml: string): string {
  return yaml
    .split('\n')
    .filter((line) => {
      const k = line.match(/^\s*([A-Za-z0-9_]+)\s*:/)
      if (!k) return true
      return !MANAGED_KEYS.has(k[1])
    })
    .join('\n')
    .trim()
}

function yamlString(s: string): string {
  // Quote when the string contains yaml-sensitive characters; otherwise leave bare.
  if (/[:#@&*!|>'"%`\t]/.test(s) || /^\s|\s$/.test(s)) return JSON.stringify(s)
  return s
}

export async function createPage(
  wikiFS: WikiFS,
  page: WikiPage,
): Promise<void> {
  const path = buildPath(page.category, page.filename)
  await wikiFS.write(path, page.content)
}

export type IndexCategory = 'entities' | 'concepts' | 'sources' | 'analyses'

export type IndexAddition = string | { readonly entry: string; readonly category: IndexCategory }

/** A page that was written to disk during ingest — used to backfill index/log entries the LLM omitted. */
export interface WrittenPage {
  readonly filename: string
  readonly category: IndexCategory
  readonly content: string
}

const CATEGORY_HEADERS: Record<IndexCategory, string> = {
  entities: '## 엔티티',
  concepts: '## 개념',
  sources: '## 소스',
  analyses: '## 분석',
}

/**
 * Strip directory prefix and `.md` extension from a filename, lowercased.
 * LLM emits inconsistent formats (`pms.md` / `concepts/pms` / `wiki/concepts/pms.md`) —
 * normalizing here lets dedup work across all three.
 */
export function normalizeBase(filename: string): string {
  const basename = filename.includes('/') ? filename.split('/').pop()! : filename
  return basename.replace(/\.md$/i, '').toLowerCase()
}

/** Extract the first sentence from page content (skipping frontmatter + first heading). */
export function extractFirstSentence(content: string): string {
  const body = content.replace(/^---[\s\S]*?---\s*/, '').trim()
  const afterHeading = body.replace(/^#+\s+[^\n]+\n+/, '').trim()
  const match = afterHeading.match(/^[^\n。.!?]{5,160}[。.!?]?/)
  const text = (match ? match[0] : afterHeading.slice(0, 100)).trim().replace(/\s+/g, ' ')
  return text || '(설명 없음)'
}

/**
 * Update wiki/index.md with new entries.
 *
 * `writtenPages` is the deterministic source of truth: any page actually written that
 * the LLM forgot to include in `additions` is auto-registered using `extractFirstSentence`.
 * This guarantees 100% coverage and prevents orphan pages.
 */
export async function updateIndex(
  wikiFS: WikiFS,
  additions: readonly IndexAddition[],
  writtenPages: readonly WrittenPage[] = [],
): Promise<void> {
  const indexPath = 'wiki/index.md'
  const content = await wikiFS.read(indexPath)

  // v6+: filter out additions whose primary wikilink target was dropped by the
  // canonicalizer (LLM additions can reference anti-pattern names that never
  // got written). Only entries whose first wikilink matches a writtenPage base
  // (or was already in the index) survive.
  const writtenBases = new Set(writtenPages.map((wp) => normalizeBase(wp.filename)))
  const filtered = writtenBases.size > 0
    ? additions.filter((a) => {
        const entry = typeof a === 'string' ? a : a.entry
        const links = extractWikilinks(entry)
        if (links.length === 0) return true  // no link = pass through
        // First link must point to a written page OR already exist in index (legacy carryover)
        const primaryBase = normalizeBase(links[0])
        return writtenBases.has(primaryBase) || content.includes(`[[${links[0]}]]`)
      })
    : additions

  // Skip duplicates (any addition whose wikilinks already exist in the index)
  const fresh = filtered.filter((a) => {
    const entry = typeof a === 'string' ? a : a.entry
    const links = extractWikilinks(entry)
    return links.every((link) => !content.includes(`[[${link}]]`))
  })

  // Track which bases the LLM already covered (across both fresh + already-in-index)
  const llmCoveredBases = new Set<string>()
  for (const a of additions) {
    const entry = typeof a === 'string' ? a : a.entry
    for (const link of extractWikilinks(entry)) {
      llmCoveredBases.add(normalizeBase(link))
    }
  }

  // Group by category. Legacy string additions fall through to 'analyses'.
  const grouped: Record<IndexCategory, string[]> = { entities: [], concepts: [], sources: [], analyses: [] }
  for (const a of fresh) {
    if (typeof a === 'string') grouped.analyses.push(a)
    else grouped[a.category].push(a.entry)
  }

  // Auto-fill: any written page not covered by LLM gets a deterministic entry.
  for (const wp of writtenPages) {
    const base = normalizeBase(wp.filename)
    if (llmCoveredBases.has(base)) continue
    if (content.includes(`[[${base}]]`)) continue  // already in index from previous ingest
    grouped[wp.category].push(`- [[${base}]] — ${extractFirstSentence(wp.content)} (소스: 1개)`)
  }

  if (grouped.entities.length === 0 && grouped.concepts.length === 0
      && grouped.sources.length === 0 && grouped.analyses.length === 0) return

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

/**
 * Prepend an entry to wiki/log.md (newest first).
 *
 * If `writtenPages` is provided, any page not already linked in the entry body is
 * auto-appended as a category-grouped bullet. Guarantees the log reflects what was
 * actually written, not just what the LLM remembered to mention.
 */
export async function appendLog(
  wikiFS: WikiFS,
  entry: string,
  writtenPages: readonly WrittenPage[] = [],
): Promise<void> {
  const logPath = 'wiki/log.md'
  const content = await wikiFS.read(logPath)

  let finalEntry = entry
  if (writtenPages.length > 0) {
    // v6+ Phase A fix: strip wikilinks that point to pages that were NOT actually written
    // (LLM may include dropped entities/concepts in log_entry — those become broken links).
    const writtenBases = new Set(writtenPages.map((wp) => normalizeBase(wp.filename)))
    finalEntry = stripBrokenWikilinks(entry, writtenBases)

    const linkedBases = new Set<string>()
    for (const link of extractWikilinks(finalEntry)) {
      linkedBases.add(normalizeBase(link))
    }
    const missing: Record<IndexCategory, string[]> = { entities: [], concepts: [], sources: [], analyses: [] }
    for (const wp of writtenPages) {
      const base = normalizeBase(wp.filename)
      if (linkedBases.has(base)) continue
      missing[wp.category].push(`[[${base}]]`)
    }
    const lines: string[] = []
    if (missing.entities.length > 0) lines.push(`- 추가 엔티티: ${missing.entities.join(', ')}`)
    if (missing.concepts.length > 0) lines.push(`- 추가 개념: ${missing.concepts.join(', ')}`)
    if (missing.sources.length > 0) lines.push(`- 추가 소스: ${missing.sources.join(', ')}`)
    if (missing.analyses.length > 0) lines.push(`- 추가 분석: ${missing.analyses.join(', ')}`)
    if (lines.length > 0) {
      finalEntry = finalEntry.trimEnd() + '\n' + lines.join('\n')
    }
  }

  const headerEnd = content.indexOf('\n\n')
  if (headerEnd === -1) {
    await wikiFS.write(logPath, content + '\n\n' + finalEntry + '\n')
    return
  }
  const header = content.slice(0, headerEnd)
  const body = content.slice(headerEnd)
  await wikiFS.write(logPath, header + '\n\n' + finalEntry + '\n' + body)
}

/**
 * Remove `[[name]]` wikilinks pointing to bases NOT in `keepBases`.
 * If the surrounding line becomes degenerate (e.g., empty list item, dangling comma),
 * tidy it up. Used to drop links the LLM emitted but the canonicalizer rejected.
 */
export function stripBrokenWikilinks(text: string, keepBases: ReadonlySet<string>): string {
  // First pass: replace each [[link]] or [[link|alias]] with empty if base not in keepBases
  const cleaned = text.replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, (match, linkText) => {
    const base = (linkText.includes('/') ? linkText.split('/').pop() : linkText)
      .replace(/\.md$/i, '').toLowerCase().trim()
    return keepBases.has(base) ? match : ''
  })
  // Tidy: collapse multiple consecutive commas, fix degenerate punctuation
  return cleaned
    .split('\n')
    .map((line) => line
      .replace(/,\s*(?:,\s*)+/g, ', ')   // multiple consecutive commas → single
      .replace(/:\s*,/g, ':')            // colon followed by comma
      .replace(/,\s*$/g, '')             // trailing comma
      .replace(/\(\s*,\s*/g, '(')        // "(, "
      .replace(/\s*,\s*\)/g, ')')        // " ,)"
      .replace(/\s{2,}/g, ' ')           // multiple spaces
      .trimEnd())
    .filter((line, i, arr) => {
      // Drop lines that became just a list bullet with nothing left ("- ", "- :")
      const stripped = line.trim()
      if (/^-\s*$/.test(stripped)) return false
      if (/^-\s+[^[]+:\s*$/.test(stripped)) return false  // "- 엔티티 생성:" with nothing after
      return true
    })
    .join('\n')
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
