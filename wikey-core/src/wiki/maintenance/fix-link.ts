/**
 * §5.19 v0.4 Batch 5 (R8 / G1 / I-FIX-1 / I-FIX-4) — broken wikilink detect +
 * confirm-gated fix (Check 의 Fix link mode a).
 *
 * Mode b (dangling sha cleanup) lives in `recovery.ts` (`applyWikiRecovery`) and
 * stays unchanged — the modal aggregates both via `executeFix` in
 * `maintenance-modal.ts`.
 *
 * Invariants (Spec v0.4 §1 Spec 2):
 *   - I-FIX-1: fuzzy match candidate — Levenshtein distance ≤ 3 또는 substring
 *     match, top-3 candidate. case-insensitive 정확 일치 시 autoFixSlug 즉시 후보.
 *   - I-FIX-4: confirm 의무 — `applyBrokenWikilinkFix({ confirm: false })` 변경 0.
 *   - I4 (read-only by default): detect 단독 호출 시 wiki/ 변경 0. apply 만 변경.
 *   - I8 (log entry, recovery.ts 와 동급): apply 후 wiki/log.md 에
 *     `## [YYYY-MM-DD] lint-fix | wiki-check (fix-link)` entry append.
 *
 * Out of scope (Batch 5):
 *   - mode c backlink 4 layer update (G2) — Batch 6.
 *   - knowledge gap detection (G3) — §5.20.
 *   - fully-automated mode — Karpathy #3 Surgical (사용자 확정 의무).
 */

import type { WikiFS } from '../../types.js'
import {
  extractWikilinks,
  isWikiCheckReportPath,
  listWikiPages,
  pageSlugFromPath,
  throwIfAborted,
} from './helpers.js'

export type BrokenWikilinkFixKind = 'case-insensitive' | 'fuzzy' | 'no-match'

export interface BrokenWikilinkCandidate {
  readonly slug: string
  readonly similarity: number
}

export interface BrokenWikilinkFixCandidate {
  /** Source file path (wiki/entities/foo.md). */
  readonly source: string
  /** Raw `[[X]]` target — `X` part, sans alias / anchor / pipe. */
  readonly brokenTarget: string
  readonly fixKind: BrokenWikilinkFixKind
  /** Top-3 fuzzy candidate (sorted by similarity desc). Empty for `no-match`. */
  readonly candidates: readonly BrokenWikilinkCandidate[]
  /** Canonical slug auto-fix replacement (only when `fixKind = 'case-insensitive'`). */
  readonly autoFixSlug?: string
}

export interface DetectBrokenWikilinksOptions {
  readonly signal?: AbortSignal
}

const FUZZY_MAX_DISTANCE = 3
const FUZZY_MIN_SIMILARITY = 0.7
const FUZZY_TOP_N = 3

/**
 * Walk every wiki page, parse `[[X]]` wikilinks, and emit a fix candidate for
 * each `X` not matched by any page slug. Each broken target appears once per
 * source file (de-duped by `source|brokenTarget`) so a page with 5 copies of
 * `[[GPT-4o]]` produces a single candidate row.
 *
 * Read-only (no `fs.write`). Cooperative `AbortSignal` polled per page (Spec
 * AC-UI-6 modal close path).
 */
export async function detectBrokenWikilinks(
  fs: WikiFS,
  opts: DetectBrokenWikilinksOptions = {},
): Promise<readonly BrokenWikilinkFixCandidate[]> {
  const pages = await listWikiPages(fs)
  const pageSlugs = pages.map(pageSlugFromPath)
  const slugSet = new Set(pageSlugs)
  // Case-insensitive index: lowercased slug → canonical slug. Collisions
  // (`API` vs `api`) keep the first canonical seen — deterministic across runs
  // because `listWikiPages` returns sorted paths.
  const caseIndex = new Map<string, string>()
  for (const slug of pageSlugs) {
    const key = slug.toLowerCase()
    if (!caseIndex.has(key)) caseIndex.set(key, slug)
  }

  const out: BrokenWikilinkFixCandidate[] = []
  const seen = new Set<string>()

  for (const source of pages) {
    throwIfAborted(opts.signal)
    // §5.19 v0.4 Batch 6 fix — wiki-check report pages excluded (defense in
    // depth — `listWikiPages` already filters, this guard pins the invariant
    // for any future caller that bypasses the helper).
    if (isWikiCheckReportPath(source)) continue
    const body = await fs.read(source)
    for (const target of extractWikilinks(body)) {
      if (slugSet.has(target)) continue
      const dedupKey = `${source}|${target}`
      if (seen.has(dedupKey)) continue
      seen.add(dedupKey)
      out.push(classifyBrokenTarget(source, target, caseIndex, pageSlugs))
    }
  }
  return out
}

/**
 * Classify a single broken target via the 3-tier rule:
 *   1. case-insensitive exact match → auto-fix candidate.
 *   2. fuzzy (Levenshtein ≤ 3 OR substring) → top-3 candidate list.
 *   3. otherwise → no-match (manual review).
 */
function classifyBrokenTarget(
  source: string,
  target: string,
  caseIndex: ReadonlyMap<string, string>,
  pageSlugs: readonly string[],
): BrokenWikilinkFixCandidate {
  const caseHit = caseIndex.get(target.toLowerCase())
  if (caseHit !== undefined && caseHit !== target) {
    return {
      source,
      brokenTarget: target,
      fixKind: 'case-insensitive',
      candidates: [{ slug: caseHit, similarity: 1 }],
      autoFixSlug: caseHit,
    }
  }
  const fuzzy = fuzzyTopCandidates(target, pageSlugs)
  if (fuzzy.length > 0) {
    return { source, brokenTarget: target, fixKind: 'fuzzy', candidates: fuzzy }
  }
  return { source, brokenTarget: target, fixKind: 'no-match', candidates: [] }
}

/**
 * Top-N fuzzy candidates for a broken target. Two acceptance signals (Spec
 * I-FIX-1):
 *   - Levenshtein distance ≤ `FUZZY_MAX_DISTANCE` (3) — typo / case drift.
 *   - Substring match (target ⊆ slug OR slug ⊆ target, length ≥ 3) — partial
 *     name reference (`gpt-4` ⊆ `gpt-4o`).
 * Similarity = 1 - dist / max(len). Sorted desc, top-3 returned.
 */
function fuzzyTopCandidates(
  target: string,
  pageSlugs: readonly string[],
): readonly BrokenWikilinkCandidate[] {
  const scored: BrokenWikilinkCandidate[] = []
  const targetLower = target.toLowerCase()
  for (const slug of pageSlugs) {
    const slugLower = slug.toLowerCase()
    const dist = levenshteinDistance(targetLower, slugLower)
    const maxLen = Math.max(target.length, slug.length, 1)
    const similarity = 1 - dist / maxLen
    const substringHit =
      target.length >= 3 &&
      slug.length >= 3 &&
      (slugLower.includes(targetLower) || targetLower.includes(slugLower))
    if (dist <= FUZZY_MAX_DISTANCE || (substringHit && similarity >= FUZZY_MIN_SIMILARITY)) {
      scored.push({ slug, similarity })
    }
  }
  scored.sort((a, b) => b.similarity - a.similarity || a.slug.localeCompare(b.slug))
  return scored.slice(0, FUZZY_TOP_N)
}

/**
 * Iterative two-row Levenshtein distance. Pure — same input always yields same
 * output, no allocations beyond the two-row buffer. Used by `fuzzyTopCandidates`
 * (no other call site so kept local rather than promoted to `helpers.ts`).
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = new Array<number>(b.length + 1)
  let curr = new Array<number>(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(
        curr[j - 1]! + 1, // insertion
        prev[j]! + 1, // deletion
        prev[j - 1]! + cost, // substitution
      )
    }
    const tmp = prev
    prev = curr
    curr = tmp
  }
  return prev[b.length]!
}

export interface BrokenWikilinkFixRequest {
  readonly source: string
  readonly brokenTarget: string
  readonly replacement: string
}

export interface ApplyBrokenWikilinkFixOptions {
  readonly fixes: readonly BrokenWikilinkFixRequest[]
  readonly confirm: boolean
  readonly today?: string
  readonly signal?: AbortSignal
}

export interface BrokenWikilinkFixReport {
  readonly changedFiles: number
  readonly changedLinks: number
  readonly logEntryAdded: boolean
}

/**
 * Replace each `[[brokenTarget]]` (or `[[brokenTarget|alias]]` / `[[brokenTarget#anchor]]`)
 * in `source` with `[[replacement]]` (alias / anchor preserved). Honors Spec
 * I-FIX-4 confirm gate + appends a log entry mirroring recovery.ts §5.11 v2.
 *
 * Frontmatter is left untouched — `extractWikilinks` already strips it before
 * detection, so any `[[X]]` in frontmatter (rare, schema-discouraged) never
 * surfaces as a broken finding.
 */
export async function applyBrokenWikilinkFix(
  fs: WikiFS,
  opts: ApplyBrokenWikilinkFixOptions,
): Promise<BrokenWikilinkFixReport> {
  // I-FIX-4 confirm gate — silent fix 0.
  if (!opts.confirm) {
    return { changedFiles: 0, changedLinks: 0, logEntryAdded: false }
  }

  // Group fixes by source so each file is read + written at most once.
  const bySource = new Map<string, BrokenWikilinkFixRequest[]>()
  for (const fix of opts.fixes) {
    if (!bySource.has(fix.source)) bySource.set(fix.source, [])
    bySource.get(fix.source)!.push(fix)
  }

  let changedFiles = 0
  let changedLinks = 0
  const changedPaths: string[] = []

  for (const [source, fixes] of bySource) {
    throwIfAborted(opts.signal)
    const body = await fs.read(source)
    const { next, replaced } = replaceWikilinksInBody(body, fixes)
    if (replaced > 0 && next !== body) {
      await fs.write(source, next)
      changedFiles++
      changedLinks += replaced
      changedPaths.push(source)
    }
  }

  let logEntryAdded = false
  if (changedFiles > 0) {
    const today = opts.today ?? new Date().toISOString().slice(0, 10)
    await appendFixLinkLogEntry(fs, today, changedPaths, changedLinks)
    logEntryAdded = true
  }

  return { changedFiles, changedLinks, logEntryAdded }
}

interface ReplaceResult {
  readonly next: string
  readonly replaced: number
}

/**
 * Replace `[[brokenTarget]]` occurrences in body only (frontmatter preserved).
 * Alias / anchor segments (`|alias`, `#section`) are kept verbatim so
 * `[[gpt-4o|GPT-4o]]` → `[[GPT-4o|GPT-4o]]` keeps the display label intact.
 */
function replaceWikilinksInBody(
  body: string,
  fixes: readonly BrokenWikilinkFixRequest[],
): ReplaceResult {
  if (fixes.length === 0) return { next: body, replaced: 0 }
  // Frontmatter is preserved verbatim — `[[X]]` only matched in the body slot.
  // Parity with `stripFrontmatter` in `helpers.ts` (closing `\n---` delimiter
  // + 4 char skip) — kept inline to avoid an extra alloc on the hot loop path.
  const fmEnd = body.startsWith('---') ? body.indexOf('\n---', 3) : -1
  const head = fmEnd >= 0 ? body.slice(0, fmEnd + 4) : ''
  const bodyText = fmEnd >= 0 ? body.slice(fmEnd + 4) : body

  let next = bodyText
  let replaced = 0
  for (const fix of fixes) {
    const re = new RegExp(
      `\\[\\[${escapeRegex(fix.brokenTarget)}(\\|[^\\]]*|#[^\\]]*)?\\]\\]`,
      'g',
    )
    next = next.replace(re, (_match, suffix: string | undefined) => {
      replaced++
      return `[[${fix.replacement}${suffix ?? ''}]]`
    })
  }
  return { next: head + next, replaced }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function appendFixLinkLogEntry(
  fs: WikiFS,
  today: string,
  changedPaths: readonly string[],
  changedLinks: number,
): Promise<void> {
  const logPath = 'wiki/log.md'
  const existing = (await fs.exists(logPath)) ? await fs.read(logPath) : ''
  const lines: string[] = [
    `## [${today}] lint-fix | wiki-check (fix-link)`,
    '',
    `- 깨진 wikilink 수정: ${changedLinks} 링크 / ${changedPaths.length} 페이지`,
  ]
  for (const p of changedPaths) lines.push(`  - [[${pageSlugFromPath(p)}]]`)
  lines.push('')
  const separator = existing.endsWith('\n') || existing === '' ? '' : '\n'
  await fs.write(logPath, existing + separator + lines.join('\n'))
}
