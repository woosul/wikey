/**
 * §5.20 Knowledge Gap management — implementation (Step C + Step F sweep v0.3).
 *
 * Spec source: `plan/phase-5/phase-5-spec-5.20-knowledge-gap-management.md` v0.3 (LOCK).
 * Todox source: `plan/phase-5/phase-5-todox-5.20-knowledge-gap-management.md` v0.3.
 *
 * Invariants honored:
 *   I1 — local-only WikiFS interactions. No network IO inside this module.
 *   I2 — opt-out toggle is enforced at the caller (sidebar-chat hook). Module
 *        functions append unconditionally when invoked.
 *   I3 — entry shape is normalized to exactly 5 keys on append (extra keys
 *        dropped before disk).
 *   I3a — JSONL line-based append at `.wikey/query-log.jsonl` (vault-relative).
 *         Single-process safe (Obsidian plugin = renderer single thread).
 *         Multi-process simultaneous write is Out of Scope (v0.3 LOCK).
 *   I4 — gap score formula with divide-by-zero guards.
 *   I5 — primary LLM clusterer + deterministic token-overlap fallback.
 *   I6 — top-N (default 10) gapScore desc sort.
 *   I9 — `created` preserved across re-runs; `updated` reflects run date.
 *   I10 — frontmatter includes title / type / created / updated / tags / sources.
 *   I11 — deterministic body template (LLM recommendation = Out of Scope v0.3).
 */
import type { WikiFS } from './types.js'

/** I3a v0.6 — year-partitioned JSONL paths. Legacy single-file path retained
 *  only for backward-compat migration (see `migrateLegacyQueryLog`). */
export const LEGACY_QUERY_LOG_PATH = '.wikey/query-log.jsonl'

/** v0.6 — `.wikey/query-log-YYYY.jsonl` (single source of truth for one year). */
export function queryLogPathForYear(year: number | string): string {
  return `.wikey/query-log-${year}.jsonl`
}

/** v0.6 — `{ startYearMonth, endYearMonth }` reporting range parsed from
 *  `/knowledge-gap YYYYMM-YYYYMM` slash argument. Both inclusive. */
export interface QueryLogRange {
  readonly startYearMonth: string  // e.g. '2026-05'
  readonly endYearMonth: string    // e.g. '2026-06'
}

/**
 * v0.6 — parse `YYYYMM-YYYYMM` slash argument. Returns null on malformed input.
 * Spaces tolerated. Start <= end enforced; otherwise returns null.
 */
export function parseQueryLogRange(arg: string): QueryLogRange | null {
  const m = arg.trim().match(/^(\d{6})\s*-\s*(\d{6})$/)
  if (!m) return null
  const [, startRaw, endRaw] = m
  const startYearMonth = `${startRaw.slice(0, 4)}-${startRaw.slice(4, 6)}`
  const endYearMonth = `${endRaw.slice(0, 4)}-${endRaw.slice(4, 6)}`
  // Basic month validity check (01~12).
  const startMonth = parseInt(startRaw.slice(4, 6), 10)
  const endMonth = parseInt(endRaw.slice(4, 6), 10)
  if (startMonth < 1 || startMonth > 12 || endMonth < 1 || endMonth > 12) return null
  if (startYearMonth > endYearMonth) return null
  return { startYearMonth, endYearMonth }
}

/** Spec 1 I3 — log entry shape. 5 keys (privacy minimize). */
export interface QueryLogEntry {
  readonly ts: string
  readonly query: string
  readonly answerLen: number
  readonly citationCount: number
  readonly resolveFailed: boolean
}

/** Spec 2 — gap analysis 결과. queryIndices 는 input array 의 index 보존. */
export interface KnowledgeGap {
  readonly topic: string
  readonly frequency: number
  readonly avgAnswerLen: number
  readonly avgCitationCount: number
  readonly gapScore: number
  readonly queryIndices: number[]
}

/** Spec 2 I5 — LLM clusterer response schema. */
export interface ClusterResult {
  readonly topics: ReadonlyArray<{ name: string; queryIndices: number[] }>
}

/** Spec 2 I5 — clusterer signature. primary = LLM-backed, fallback = token-overlap. */
export type TopicClusterer = (entries: readonly QueryLogEntry[]) => Promise<ClusterResult>

/**
 * Spec 2 I4 — gap score formula (LOCK).
 *
 *     gapScore = frequency
 *              * log(1 + 1 / max(avgAnswerLen, 1))
 *              * log(1 + 1 / (avgCitationCount + 0.5))
 */
export function computeGapScore(input: {
  frequency: number
  avgAnswerLen: number
  avgCitationCount: number
}): number {
  if (input.frequency === 0) return 0
  const lenFactor = Math.log(1 + 1 / Math.max(input.avgAnswerLen, 1))
  const citFactor = Math.log(1 + 1 / (input.avgCitationCount + 0.5))
  return input.frequency * lenFactor * citFactor
}

/**
 * Spec 1 AC — JSONL append-only, year-partitioned (v0.6). extra 키 entry 에
 * 포함되어도 정확히 5 키만 disk 에 기록 (I3 schema minimize). entry.ts 의 year
 * 를 추출해 `.wikey/query-log-${year}.jsonl` 에 append.
 */
export async function appendQueryLogEntry(wikiFS: WikiFS, entry: QueryLogEntry): Promise<void> {
  const minimal: QueryLogEntry = {
    ts: entry.ts,
    query: entry.query,
    answerLen: entry.answerLen,
    citationCount: entry.citationCount,
    resolveFailed: entry.resolveFailed,
  }
  const line = JSON.stringify(minimal)
  const year = extractYearFromTs(entry.ts)
  const path = queryLogPathForYear(year)

  let existing = ''
  try {
    if (await wikiFS.exists(path)) {
      existing = await wikiFS.read(path)
    }
  } catch {
    existing = ''
  }

  const prefix = existing.length === 0 || existing.endsWith('\n') ? existing : existing + '\n'
  await wikiFS.write(path, prefix + line + '\n')
}

function extractYearFromTs(ts: string): string {
  // ISO-8601 prefix `YYYY` (first 4 chars). Fallback to current year on bad input.
  if (/^\d{4}/.test(ts)) return ts.slice(0, 4)
  return String(new Date().getUTCFullYear())
}

/**
 * Spec 1 AC v0.6 — JSONL parse, year-partitioned.
 *
 * `range` 미지정 시: legacy file (`.wikey/query-log.jsonl`) auto-migrate 후
 * 모든 `.wikey/query-log-YYYY.jsonl` walk + merge (ts asc 정렬). 매번 호출
 * 가능 (migration 은 idempotent — legacy file 부재 시 no-op).
 *
 * `range` 지정 시: 해당 year file 만 load → `ts` 범위 (start..=end 월) 필터.
 *
 * malformed line skip / 파일 부재 → 빈 array.
 */
export async function loadQueryLogEntries(
  wikiFS: WikiFS,
  range?: QueryLogRange,
): Promise<QueryLogEntry[]> {
  await migrateLegacyQueryLog(wikiFS)

  let years: string[]
  if (range) {
    const startYear = parseInt(range.startYearMonth.slice(0, 4), 10)
    const endYear = parseInt(range.endYearMonth.slice(0, 4), 10)
    years = []
    for (let y = startYear; y <= endYear; y++) years.push(String(y))
  } else {
    years = await discoverYearFiles(wikiFS)
  }

  const out: QueryLogEntry[] = []
  for (const y of years) {
    const path = queryLogPathForYear(y)
    if (!(await wikiFS.exists(path))) continue
    let raw: string
    try {
      raw = await wikiFS.read(path)
    } catch {
      continue
    }
    for (const line of raw.split('\n')) {
      if (line.length === 0) continue
      const parsed = parseEntryLine(line)
      if (!parsed) continue
      if (range && !isWithinRange(parsed.ts, range)) continue
      out.push(parsed)
    }
  }
  out.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0))
  return out
}

function isWithinRange(ts: string, range: QueryLogRange): boolean {
  const yearMonth = ts.slice(0, 7) // YYYY-MM
  return yearMonth >= range.startYearMonth && yearMonth <= range.endYearMonth
}

/**
 * v0.6 — discover year files via WikiFS `list('.wikey')`. Returns sorted year
 * strings (asc). On listing failure or empty dir → [].
 */
async function discoverYearFiles(wikiFS: WikiFS): Promise<string[]> {
  let entries: readonly string[]
  try {
    entries = await wikiFS.list('.wikey')
  } catch {
    return []
  }
  const years = new Set<string>()
  for (const p of entries) {
    const m = p.match(/(?:^|\/)query-log-(\d{4})\.jsonl$/)
    if (m) years.add(m[1])
  }
  return [...years].sort()
}

/**
 * v0.6 — one-shot migration: legacy `.wikey/query-log.jsonl` → year-partitioned
 * `.wikey/query-log-YYYY.jsonl`. Each entry's year is extracted from `entry.ts`
 * and appended to the matching year file. Legacy file is removed (overwritten
 * with empty string then ignored — WikiFS has no `delete`; treat empty as gone).
 *
 * Idempotent: legacy file absent / empty → no-op.
 */
async function migrateLegacyQueryLog(wikiFS: WikiFS): Promise<void> {
  try {
    if (!(await wikiFS.exists(LEGACY_QUERY_LOG_PATH))) return
  } catch {
    return
  }
  let raw: string
  try {
    raw = await wikiFS.read(LEGACY_QUERY_LOG_PATH)
  } catch {
    return
  }
  if (raw.length === 0) return

  // Group entries by year.
  const byYear = new Map<string, string[]>()
  for (const line of raw.split('\n')) {
    if (line.length === 0) continue
    const parsed = parseEntryLine(line)
    if (!parsed) continue
    const year = extractYearFromTs(parsed.ts)
    const arr = byYear.get(year) ?? []
    arr.push(JSON.stringify(parsed))
    byYear.set(year, arr)
  }

  // Append-merge into year files (preserve any existing year-file content).
  for (const [year, lines] of byYear) {
    const path = queryLogPathForYear(year)
    let existing = ''
    try {
      if (await wikiFS.exists(path)) existing = await wikiFS.read(path)
    } catch {
      existing = ''
    }
    const prefix = existing.length === 0 || existing.endsWith('\n') ? existing : existing + '\n'
    await wikiFS.write(path, prefix + lines.join('\n') + '\n')
  }

  // Clear legacy file (WikiFS has no delete primitive — empty string acts as
  // "migrated marker"; subsequent calls hit the early-return on raw.length===0).
  await wikiFS.write(LEGACY_QUERY_LOG_PATH, '')
}

function parseEntryLine(line: string): QueryLogEntry | null {
  try {
    const obj = JSON.parse(line) as Record<string, unknown>
    if (
      typeof obj.ts !== 'string' ||
      typeof obj.query !== 'string' ||
      typeof obj.answerLen !== 'number' ||
      typeof obj.citationCount !== 'number' ||
      typeof obj.resolveFailed !== 'boolean'
    ) {
      return null
    }
    return {
      ts: obj.ts,
      query: obj.query,
      answerLen: obj.answerLen,
      citationCount: obj.citationCount,
      resolveFailed: obj.resolveFailed,
    }
  } catch {
    return null
  }
}

/**
 * Spec 2 — log entries + clusterer → KnowledgeGap[] (gapScore desc).
 * v0.4: `limit` is optional; default is the full sorted list (no truncation).
 * clusterer throw 시 token-overlap fallback 사용 (I5).
 */
export async function rankKnowledgeGaps(
  entries: readonly QueryLogEntry[],
  clusterer: TopicClusterer,
  limit?: number,
): Promise<KnowledgeGap[]> {
  if (entries.length === 0) return []

  let cluster: ClusterResult
  try {
    cluster = await clusterer(entries)
  } catch {
    cluster = clusterTopicsByTokenOverlap(entries)
  }

  const gaps: KnowledgeGap[] = []
  for (const topic of cluster.topics) {
    const idxs = topic.queryIndices.filter((i) => i >= 0 && i < entries.length)
    if (idxs.length === 0) continue
    let sumLen = 0
    let sumCit = 0
    for (const i of idxs) {
      sumLen += entries[i].answerLen
      sumCit += entries[i].citationCount
    }
    const frequency = idxs.length
    const avgAnswerLen = sumLen / frequency
    const avgCitationCount = sumCit / frequency
    gaps.push({
      topic: topic.name,
      frequency,
      avgAnswerLen,
      avgCitationCount,
      gapScore: computeGapScore({ frequency, avgAnswerLen, avgCitationCount }),
      queryIndices: [...idxs],
    })
  }

  gaps.sort((a, b) => b.gapScore - a.gapScore)
  return typeof limit === 'number' ? gaps.slice(0, limit) : gaps
}

/**
 * Spec 3 I11 v0.4 — deterministic statistics over the full log entry array.
 * Used by the `## Statistics` block of the report (no LLM call required).
 */
export interface GapStatistics {
  readonly totalQueries: number
  readonly distinctTopics: number
  readonly zeroCitationCount: number
  readonly zeroCitationPercent: number
  readonly avgAnswerLen: number
  readonly periodStart: string | null
  readonly periodEnd: string | null
}

export function computeGapStatistics(
  entries: readonly QueryLogEntry[],
  topicCount: number,
): GapStatistics {
  const totalQueries = entries.length
  if (totalQueries === 0) {
    return {
      totalQueries: 0,
      distinctTopics: topicCount,
      zeroCitationCount: 0,
      zeroCitationPercent: 0,
      avgAnswerLen: 0,
      periodStart: null,
      periodEnd: null,
    }
  }
  let sumLen = 0
  let zeroCit = 0
  let minTs = entries[0].ts
  let maxTs = entries[0].ts
  for (const e of entries) {
    sumLen += e.answerLen
    if (e.citationCount === 0) zeroCit += 1
    if (e.ts < minTs) minTs = e.ts
    if (e.ts > maxTs) maxTs = e.ts
  }
  return {
    totalQueries,
    distinctTopics: topicCount,
    zeroCitationCount: zeroCit,
    zeroCitationPercent: (zeroCit / totalQueries) * 100,
    avgAnswerLen: sumLen / totalQueries,
    periodStart: minTs.slice(0, 10),
    periodEnd: maxTs.slice(0, 10),
  }
}

/**
 * Spec 2 I5 fallback — deterministic token-overlap clustering. hardcoded
 * keyword / stopword 0건 (§5.10.4 D-wide 정합). 단순 길이 ≥ 2 만 필터.
 *
 * Greedy: 가장 자주 나오는 단어 기준으로 cluster — 모든 index 가 cluster 될
 * 때까지 반복. 단어 없는 query 는 "uncategorized" 1개로 묶음.
 */
function clusterTopicsByTokenOverlap(entries: readonly QueryLogEntry[]): ClusterResult {
  // Build word → indices map (단어 길이 ≥ 2, lowercased).
  const wordToIdxs = new Map<string, number[]>()
  const emptyIdxs: number[] = []
  for (let i = 0; i < entries.length; i++) {
    const words = tokenize(entries[i].query)
    if (words.length === 0) {
      emptyIdxs.push(i)
      continue
    }
    for (const w of words) {
      const arr = wordToIdxs.get(w)
      if (arr) arr.push(i)
      else wordToIdxs.set(w, [i])
    }
  }

  const assigned = new Set<number>()
  const topics: Array<{ name: string; queryIndices: number[] }> = []

  // Sort words by frequency desc, with deterministic alphabetical tie-break.
  const wordsByFreq = [...wordToIdxs.entries()].sort((a, b) => {
    if (b[1].length !== a[1].length) return b[1].length - a[1].length
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0
  })

  for (const [word, idxs] of wordsByFreq) {
    const unassigned = idxs.filter((i) => !assigned.has(i))
    if (unassigned.length === 0) continue
    for (const i of unassigned) assigned.add(i)
    topics.push({ name: word, queryIndices: unassigned })
  }

  if (emptyIdxs.length > 0) {
    topics.push({ name: 'uncategorized', queryIndices: emptyIdxs })
  }

  return { topics }
}

function tokenize(query: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of query.split(/\s+/)) {
    const w = raw.toLowerCase().replace(/[^\p{L}\p{N}_-]+/gu, '')
    if (w.length < 2) continue
    if (seen.has(w)) continue
    seen.add(w)
    out.push(w)
  }
  return out
}

/**
 * Spec 3 I10/I11 (v0.4) — knowledge-gaps-YYYY-MM.md markdown 생성.
 * 3 section: (a) `## Summary` (LLM narrative) (b) `## Statistics` (deterministic
 * counts) (c) `## All gaps` (full listing, no truncation by default).
 *
 * `createdDate` / `updatedDate`: I9 — 첫 생성 시 `created` 보존을 위해 command
 * runner 가 기존 file frontmatter parse 후 주입. 미지정 시 `${yearMonth}-01`.
 *
 * `summary`: optional LLM narrative. 미지정 시 graceful fallback message.
 * `statistics`: optional precomputed `GapStatistics`. 미지정 시 Statistics block
 * 생략 (v0.3 호환 — pure renderer test 가 statistics 미지정으로도 통과).
 */
export function renderGapReportMarkdown(
  gaps: readonly KnowledgeGap[],
  opts: {
    yearMonth: string
    createdDate?: string
    updatedDate?: string
    summary?: string
    statistics?: GapStatistics
    /** v0.5 — entries 주입 시 each gap section 에 actual query list 출력 (사용자
     *  요청: 어떤 질문이 있었고 어떤 갭인지 직접 확인 가능). 미지정 시 query list 생략. */
    entries?: readonly QueryLogEntry[]
    /** v0.6 — frontmatter `title` override (range reports use `2026-05 ~ 2026-06`).
     *  미지정 시 `Knowledge Gaps — ${yearMonth}` 기본값. */
    titleLabel?: string
  },
): string {
  const { yearMonth, createdDate, updatedDate, summary, statistics, entries, titleLabel } = opts
  const firstOfMonth = `${yearMonth}-01`
  const created = createdDate ?? firstOfMonth
  const updated = updatedDate ?? firstOfMonth
  const lines: string[] = []
  lines.push('---')
  lines.push(`title: Knowledge Gaps — ${titleLabel ?? yearMonth}`)
  lines.push('type: analysis')
  lines.push(`created: ${created}`)
  lines.push(`updated: ${updated}`)
  lines.push('tags: [knowledge-gap, auto-report]')
  lines.push('sources: []')
  lines.push('---')
  lines.push('')

  lines.push('## Summary')
  lines.push('')
  lines.push(
    summary && summary.trim().length > 0
      ? summary.trim()
      : '(LLM summary unavailable — see Statistics + listing below.)',
  )
  lines.push('')

  if (statistics) {
    lines.push('## Statistics')
    lines.push('')
    lines.push(`- Total queries logged: ${statistics.totalQueries}`)
    lines.push(`- Distinct topic clusters: ${statistics.distinctTopics}`)
    lines.push(
      `- Queries with zero citations: ${statistics.zeroCitationCount}` +
        ` (${statistics.zeroCitationPercent.toFixed(1)}%)`,
    )
    lines.push(`- Average answer length: ${formatAvg(statistics.avgAnswerLen)} chars`)
    if (statistics.periodStart && statistics.periodEnd) {
      lines.push(`- Reporting period: ${statistics.periodStart} ~ ${statistics.periodEnd}`)
    }
    lines.push('')
  }

  lines.push('## All gaps')
  lines.push('')
  for (const gap of gaps) {
    lines.push(
      `### ${gap.topic} (gapScore: ${gap.gapScore.toFixed(2)}, frequency: ${gap.frequency})`,
    )
    lines.push(`- average answer length: ${formatAvg(gap.avgAnswerLen)} chars`)
    lines.push(`- average citation count: ${formatAvg(gap.avgCitationCount)}`)
    // v0.5 — actual query list per cluster (사용자 요청 — gap 정체 가시화).
    if (entries && gap.queryIndices.length > 0) {
      lines.push('')
      lines.push('Queries in this cluster:')
      for (const i of gap.queryIndices) {
        const e = entries[i]
        if (!e) continue
        const date = e.ts.slice(0, 10)
        const cit = e.citationCount === 0 ? 'no citations' : `${e.citationCount} cit`
        lines.push(`- (${date}) "${e.query}" — ${e.answerLen} chars, ${cit}`)
      }
    }
    lines.push('')
  }

  return lines.join('\n').replace(/\n+$/, '\n')
}

/**
 * Spec 3 I9 helper — existing frontmatter 에서 `created` 값을 추출.
 * 부재 / parse 실패 시 `null` 반환 (caller 가 fallback 날짜 결정).
 *
 * Pure regex parse (yaml 의존성 회피). frontmatter shape:
 *   ---\nkey: value\n...\n---
 */
export function extractCreatedFromFrontmatter(content: string): string | null {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fmMatch) return null
  const fmBody = fmMatch[1]
  const createdMatch = fmBody.match(/^created:\s*(\S+)\s*$/m)
  return createdMatch ? createdMatch[1].trim() : null
}

/**
 * Spec 2 I5 helper — LLM response shape validation. codex review v0.3 MEDIUM-3 fix.
 *
 * `{ topics: [{ name, queryIndices }] }` 가 아닌 경우 throw → rankKnowledgeGaps 의
 * try/catch 가 fallback path (clusterTopicsByTokenOverlap) 으로 routing.
 */
export function validateClusterResultShape(value: unknown): ClusterResult {
  if (typeof value !== 'object' || value === null) {
    throw new Error('cluster result must be an object')
  }
  const topics = (value as { topics?: unknown }).topics
  if (!Array.isArray(topics)) {
    throw new Error('cluster.topics must be an array')
  }
  for (const t of topics) {
    if (typeof t !== 'object' || t === null) {
      throw new Error('cluster.topics[i] must be an object')
    }
    const name = (t as { name?: unknown }).name
    const queryIndices = (t as { queryIndices?: unknown }).queryIndices
    if (typeof name !== 'string') {
      throw new Error('cluster.topics[i].name must be string')
    }
    // v0.3 cycle #2 NEW MEDIUM — reject non-integer indices. `entries[0.5]` is
    // `undefined`, which would crash `entries[i].answerLen` inside rankKnowledgeGaps.
    if (
      !Array.isArray(queryIndices) ||
      queryIndices.some((n) => typeof n !== 'number' || !Number.isInteger(n))
    ) {
      throw new Error('cluster.topics[i].queryIndices must be integer[]')
    }
  }
  return value as ClusterResult
}

function formatAvg(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(2)
}
