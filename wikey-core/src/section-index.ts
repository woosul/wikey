/**
 * Phase 4.5.1.5 (v2) — 결정적 Phase A 섹션 파서.
 *
 * LLM 의존 없음. Docling stripped markdown 을 입력으로 받아 Section[] 을 결정적으로 반환.
 * 같은 입력 → 같은 출력 (테스트로 확증). 용도:
 *   1. ingest-pipeline 의 Route 판정 (token-budget)
 *   2. Route SEGMENTED 의 섹션별 호출 단위
 *   3. 소스 페이지에 섹션 TOC append (Phase C enablement)
 *
 * 설계 근거: plan/phase-4-change-phase-abc.md §1, §7.1. schema.md §19 (LLM 이 독자) 부합.
 */

export type SectionWarning =
  | 'merged-empty'
  | 'internal-split'
  | 'mixed-level'
  | 'suspicious-heading'
  | 'table-only'
  | 'no-headings'
  | 'preamble'

export type HeadingPattern =
  | 'toc' | 'appendix' | 'contact' | 'revision' | 'copyright' | 'normal'

export type HeuristicPriority = 'skip' | 'core' | 'support'

export interface Section {
  readonly idx: number
  readonly title: string
  readonly level: 1 | 2 | 3 | 4 | 5 | 6
  readonly startLine: number
  readonly endLine: number
  readonly body: string
  readonly bodyChars: number
  readonly warnings: ReadonlyArray<SectionWarning>
  readonly hasTable: boolean
  readonly tableRows: number
  readonly acronymDensity: number
  readonly koreanCharCount: number
  readonly headingPattern: HeadingPattern
}

export interface RepeaterToken {
  readonly token: string
  readonly frequency: number
}

export interface SectionIndex {
  readonly sections: ReadonlyArray<Section>
  readonly globalRepeaters: ReadonlyArray<RepeaterToken>
  readonly langHint: 'ko' | 'en' | 'mixed'
}

const HEADING_REGEX = /^(#{1,6})(\s*)(.*?)\s*$/
const CODE_FENCE_REGEX = /^\s*```/
const PIPE_CELL_MIN = 3   // `|` 개수 기준으로 테이블 행 판정

// ── 공개 API ──

export function parseSections(md: string): ReadonlyArray<Section> {
  const lines = md.split('\n')
  const raw = collectRawSections(lines)
  const levelSet = new Set(raw.filter((r) => !r.isPreamble).map((r) => r.level))
  const hasMixedLevel = levelSet.size > 1
  const titleCounts = countDuplicateTitles(raw)

  const sections: Section[] = []
  for (const r of raw) {
    const body = r.bodyLines.join('\n')
    const bodyChars = body.trim().length
    const warnings: SectionWarning[] = []
    if (r.isNoHeadings) warnings.push('no-headings')
    if (r.isPreamble) warnings.push('preamble')
    if (hasMixedLevel && !r.isPreamble && !r.isNoHeadings) warnings.push('mixed-level')

    const countTable = countTableRows(r.bodyLines)
    const hasTable = countTable >= PIPE_CELL_MIN
    if (hasTable && bodyChars > 0 && !hasParagraphBreak(body)) {
      warnings.push('table-only')
    }

    const suspicious = isSuspiciousRepeatedHeading(r, titleCounts, bodyChars)
    if (suspicious) warnings.push('suspicious-heading')

    sections.push({
      idx: sections.length,
      title: r.title,
      level: r.level,
      startLine: r.startLine,
      endLine: r.endLine,
      body,
      bodyChars,
      warnings,
      hasTable,
      tableRows: countTable,
      acronymDensity: computeAcronymDensity(body),
      koreanCharCount: countKorean(body),
      headingPattern: classifyHeadingPattern(r.title),
    })
  }

  // 빈 섹션 병합 (bodyChars < 50 and not first)
  return mergeEmptySections(sections)
}

export function buildSectionIndex(md: string): SectionIndex {
  const sections = parseSections(md)
  const globalRepeaters = extractGlobalRepeaters(sections)
  const langHint = detectLangHint(md)
  return { sections, globalRepeaters, langHint }
}

export function computeHeuristicPriority(s: Section): HeuristicPriority {
  if (s.headingPattern !== 'normal') return 'skip'
  if (s.bodyChars < 100) return 'skip'
  if (s.bodyChars > 200 && (s.acronymDensity > 0.05 || s.hasTable)) return 'core'
  return 'support'
}

export function formatPeerContext(
  index: SectionIndex,
  currentIdx: number,
  tokenCap = 300,
): string {
  const { sections, globalRepeaters } = index
  const current = sections[currentIdx]
  if (!current) return ''

  const overviewChars = Math.min(200, Math.floor(tokenCap * 0.5))
  const overview = sections
    .map((s) => s.title)
    .join(', ')
    .slice(0, overviewChars)

  const repeaters = globalRepeaters
    .slice(0, 10)
    .map((r) => `${r.token}(${r.frequency})`)
    .join(', ')

  const prev = sections[currentIdx - 1]
  const next = sections[currentIdx + 1]

  const neighbor = (s: Section | undefined, label: 'prev' | 'next'): string => {
    if (!s) return `- ${label}: (없음)`
    return `- ${label} §${s.idx} ${s.title} | ${computeHeuristicPriority(s)} | chars: ${s.bodyChars}`
  }

  return [
    `DOC_OVERVIEW: ${overview}`,
    `GLOBAL_REPEATERS: ${repeaters}`,
    '',
    `CURRENT_SECTION:`,
    `- idx: ${current.idx}`,
    `- title: ${current.title}`,
    `- priority: ${computeHeuristicPriority(current)} (heuristic)`,
    `- hasTable: ${current.hasTable}, acronymDensity: ${current.acronymDensity.toFixed(3)}`,
    '',
    'LOCAL_NEIGHBORS:',
    neighbor(prev, 'prev'),
    neighbor(next, 'next'),
  ].join('\n')
}

export function formatSourceTOC(index: SectionIndex): string {
  const lines: string[] = []
  lines.push('## 섹션 인덱스')
  lines.push('')
  lines.push('| § | 제목 | 본문 | priority | 경고 |')
  lines.push('|:-:|:-|-:|:-:|:-|')
  for (const s of index.sections) {
    const prio = computeHeuristicPriority(s)
    const warn = s.warnings.length > 0 ? s.warnings.join(', ') : '—'
    lines.push(`| ${s.idx} | ${s.title} | ${s.bodyChars} chars | ${prio} | ${warn} |`)
  }
  return lines.join('\n')
}

// ── 내부 구현 ──

interface RawSection {
  title: string
  level: 1 | 2 | 3 | 4 | 5 | 6
  startLine: number
  endLine: number
  bodyLines: string[]
  isPreamble: boolean
  isNoHeadings: boolean
}

function collectRawSections(lines: string[]): RawSection[] {
  const raw: RawSection[] = []
  let current: RawSection | null = null
  let inCodeFence = false
  let preambleBuf: string[] = []
  let anyHeading = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (CODE_FENCE_REGEX.test(line)) {
      inCodeFence = !inCodeFence
      if (current) current.bodyLines.push(line)
      else preambleBuf.push(line)
      continue
    }
    if (inCodeFence) {
      if (current) current.bodyLines.push(line)
      else preambleBuf.push(line)
      continue
    }

    const m = line.match(HEADING_REGEX)
    if (m) {
      const hashes = m[1]
      const title = m[3].trim()
      if (title.length === 0) {
        // heading 마커만 있고 제목 없음 — 일반 텍스트 취급
        if (current) current.bodyLines.push(line)
        else preambleBuf.push(line)
        continue
      }
      anyHeading = true
      if (current) {
        current.endLine = i - 1
        raw.push(current)
      } else if (preambleBuf.length > 0 && preambleBuf.some((l) => l.trim().length > 0)) {
        raw.push({
          title: 'preamble',
          level: 2,
          startLine: 0,
          endLine: i - 1,
          bodyLines: preambleBuf.slice(),
          isPreamble: true,
          isNoHeadings: false,
        })
        preambleBuf = []
      }
      current = {
        title,
        level: hashes.length as 1 | 2 | 3 | 4 | 5 | 6,
        startLine: i,
        endLine: i,
        bodyLines: [],
        isPreamble: false,
        isNoHeadings: false,
      }
    } else {
      if (current) current.bodyLines.push(line)
      else preambleBuf.push(line)
    }
  }

  if (current) {
    current.endLine = lines.length - 1
    raw.push(current)
  }

  if (!anyHeading) {
    return [{
      title: 'document',
      level: 2,
      startLine: 0,
      endLine: lines.length - 1,
      bodyLines: preambleBuf,
      isPreamble: false,
      isNoHeadings: true,
    }]
  }
  // preamble 이 있는데 heading 이 바로 뒤에 나와 위에서 이미 수거됐을 수도 있음.
  // preambleBuf 에 남은 게 있고 raw 가 비어있다면 fallback
  if (raw.length === 0 && preambleBuf.length > 0) {
    return [{
      title: 'document',
      level: 2,
      startLine: 0,
      endLine: lines.length - 1,
      bodyLines: preambleBuf,
      isPreamble: false,
      isNoHeadings: true,
    }]
  }

  return raw
}

// 병합 정책:
//   - bodyChars < 5 (사실상 빈 섹션) 만 병합 — plan v2 v1 의 50 임계는 너무 공격적이었음
//   - preamble 또는 headingPattern !== 'normal' (TOC/appendix 등) 은 병합 안 함 (가시성 유지)
//   - 병합 시 merged 섹션의 warnings 를 prev 에 전파 (suspicious-heading 등 소실 방지)
const MERGE_THRESHOLD = 5

function mergeEmptySections(sections: Section[]): Section[] {
  if (sections.length <= 1) return sections
  const out: Section[] = []
  for (const s of sections) {
    const shouldMerge =
      s.bodyChars < MERGE_THRESHOLD &&
      out.length > 0 &&
      !s.warnings.includes('no-headings') &&
      !s.warnings.includes('preamble') &&
      s.headingPattern === 'normal'

    if (shouldMerge) {
      const prev = out[out.length - 1]
      const mergedBody = prev.body + '\n\n' + s.body
      const mergedWarnings = Array.from(new Set<SectionWarning>([
        ...prev.warnings,
        'merged-empty',
        ...s.warnings,   // suspicious-heading 등 전파
      ]))
      out[out.length - 1] = {
        ...prev,
        body: mergedBody,
        bodyChars: mergedBody.trim().length,
        endLine: s.endLine,
        warnings: mergedWarnings,
      }
      continue
    }
    out.push({ ...s, idx: out.length })
  }
  return out
}

function countTableRows(bodyLines: string[]): number {
  let n = 0
  for (const l of bodyLines) {
    const pipes = (l.match(/\|/g) ?? []).length
    if (pipes >= PIPE_CELL_MIN) n++
  }
  return n
}

function hasParagraphBreak(body: string): boolean {
  // 빈 줄 이상의 단락 경계 존재 여부 (테이블만 있는지 판정)
  const nonTableBlocks = body
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
    .filter((b) => !b.split('\n').every((l) => (l.match(/\|/g) ?? []).length >= PIPE_CELL_MIN))
  return nonTableBlocks.length > 0
}

function computeAcronymDensity(body: string): number {
  const tokens = body.split(/[\s,.;:()\[\]{}]+/).filter((t) => t.length > 0)
  if (tokens.length === 0) return 0
  const acronyms = tokens.filter((t) => /^[A-Z][A-Z0-9]{1,5}$/.test(t)).length
  return acronyms / tokens.length
}

function countKorean(body: string): number {
  let n = 0
  for (const c of body) {
    if (c >= '가' && c <= '힯') n++
  }
  return n
}

function classifyHeadingPattern(title: string): HeadingPattern {
  const lower = title.toLowerCase().trim()
  const koreanAlias = title.replace(/\s+/g, '')
  if (/^(toc|table of contents|목차|차례)/.test(lower) || /^목차/.test(koreanAlias)) return 'toc'
  if (/^appendix\b/.test(lower) || /^부록/.test(koreanAlias)) return 'appendix'
  if (/^(contact|contacts|contact us|문의)/.test(lower) || /^문의/.test(koreanAlias)) return 'contact'
  if (/^revision\b|^change log|^changelog|^개정\s*이력|^개정이력|^변경\s*이력|^변경이력/.test(lower) || /^개정이력|^변경이력/.test(koreanAlias)) return 'revision'
  if (/^copyright|^license|^저작권/.test(lower) || /^저작권/.test(koreanAlias)) return 'copyright'
  return 'normal'
}

function countDuplicateTitles(raw: RawSection[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const r of raw) {
    if (r.isPreamble || r.isNoHeadings) continue
    m.set(r.title, (m.get(r.title) ?? 0) + 1)
  }
  return m
}

function isSuspiciousRepeatedHeading(
  r: RawSection,
  counts: Map<string, number>,
  bodyChars: number,
): boolean {
  if (r.isPreamble || r.isNoHeadings) return false
  const c = counts.get(r.title) ?? 0
  return c >= 3 && bodyChars < 100
}

function extractGlobalRepeaters(sections: ReadonlyArray<Section>): ReadonlyArray<RepeaterToken> {
  const counts = new Map<string, number>()
  for (const s of sections) {
    const tokens = s.body.split(/[\s,.;:()\[\]{}]+/)
    for (const t of tokens) {
      if (!/^[A-Z][A-Z0-9]{1,5}$/.test(t)) continue
      counts.set(t, (counts.get(t) ?? 0) + 1)
    }
  }
  const arr: RepeaterToken[] = []
  for (const [token, frequency] of counts) {
    if (frequency >= 3) arr.push({ token, frequency })
  }
  // 결정적 정렬: frequency desc, token asc
  arr.sort((a, b) => (b.frequency - a.frequency) || (a.token < b.token ? -1 : a.token > b.token ? 1 : 0))
  return arr.slice(0, 10)
}

function detectLangHint(md: string): 'ko' | 'en' | 'mixed' {
  const koreanChars = countKorean(md)
  const totalChars = md.length
  if (totalChars === 0) return 'en'
  const ratio = koreanChars / totalChars
  if (ratio > 0.6) return 'ko'
  if (ratio < 0.2) return 'en'
  return 'mixed'
}
