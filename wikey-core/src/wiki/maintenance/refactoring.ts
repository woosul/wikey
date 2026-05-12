/**
 * §5.19 Spec 4 — wiki-refactoring (suggestion only).
 *
 * Invariants:
 *   I10 자동 변경 0 / I11 signal 명시 / I12 0.85 default threshold (canonicalizer SLUG_ALIASES 정합).
 */

import type { WikiFS } from '../../types.js'
import {
  categoryOf,
  extractFrontmatterUpdated,
  extractWikilinks,
  listWikiPages,
  pageSlugFromPath,
  throwIfAborted,
} from './helpers.js'

export interface DuplicatePair {
  readonly a: string
  readonly b: string
  readonly similarity: number
}

export interface LowUtilityEntry {
  readonly path: string
  readonly lastUpdated: string
  readonly backlinkCount: number
}

export type RefactoringConfigFallback = 'default' | 'override' | 'fallback-on-parse-fail'

export interface RefactoringSuggestions {
  readonly duplicates: readonly DuplicatePair[]
  readonly lowUtility: readonly LowUtilityEntry[]
  readonly thresholdUsed: number
  readonly configFallback: RefactoringConfigFallback
}

export interface GetRefactoringSuggestionsOptions {
  readonly now?: Date
  /** Cooperative AbortSignal — polled at duplicate / low-utility loop boundaries. */
  readonly signal?: AbortSignal
}

const REFACTORING_CONFIG_PATH = '.wikey/refactoring.yaml'
const DEFAULT_DUPLICATE_THRESHOLD = 0.85
const LOW_UTILITY_STALE_DAYS = 30
const MS_PER_DAY = 24 * 60 * 60 * 1000

export async function getRefactoringSuggestions(
  fs: WikiFS,
  opts: GetRefactoringSuggestionsOptions = {},
): Promise<RefactoringSuggestions> {
  const now = opts.now ?? new Date()
  throwIfAborted(opts.signal)
  const { threshold, fallback } = await resolveDuplicateThreshold(fs)

  throwIfAborted(opts.signal)
  const pages = await listWikiPages(fs)
  const duplicates = findDuplicates(pages, threshold, opts.signal)
  const lowUtility = await findLowUtility(fs, pages, now, opts.signal)

  return { duplicates, lowUtility, thresholdUsed: threshold, configFallback: fallback }
}

function findDuplicates(
  pages: readonly string[],
  threshold: number,
  signal?: AbortSignal,
): readonly DuplicatePair[] {
  const slugsByCategory = new Map<string, string[]>()
  for (const path of pages) {
    const cat = categoryOf(path)
    if (cat === null) continue
    const slug = pageSlugFromPath(path)
    const list = slugsByCategory.get(cat) ?? []
    list.push(slug)
    slugsByCategory.set(cat, list)
  }

  const duplicates: DuplicatePair[] = []
  for (const [, slugs] of slugsByCategory) {
    for (let i = 0; i < slugs.length; i++) {
      throwIfAborted(signal)
      for (let j = i + 1; j < slugs.length; j++) {
        const sim = slugSimilarity(slugs[i]!, slugs[j]!)
        if (sim >= threshold) {
          duplicates.push({ a: slugs[i]!, b: slugs[j]!, similarity: sim })
        }
      }
    }
  }
  return duplicates
}

async function findLowUtility(
  fs: WikiFS,
  pages: readonly string[],
  now: Date,
  signal?: AbortSignal,
): Promise<readonly LowUtilityEntry[]> {
  const inbound = new Map<string, number>()
  for (const path of pages) {
    throwIfAborted(signal)
    const body = await fs.read(path)
    for (const link of extractWikilinks(body)) {
      inbound.set(link, (inbound.get(link) ?? 0) + 1)
    }
  }

  const out: LowUtilityEntry[] = []
  for (const path of pages) {
    throwIfAborted(signal)
    const body = await fs.read(path)
    const updated = extractFrontmatterUpdated(body)
    if (!updated) continue
    const ageDays = (now.getTime() - Date.parse(updated)) / MS_PER_DAY
    const slug = pageSlugFromPath(path)
    const backlinks = inbound.get(slug) ?? 0
    if (ageDays >= LOW_UTILITY_STALE_DAYS && backlinks === 0) {
      out.push({ path, lastUpdated: updated, backlinkCount: backlinks })
    }
  }
  return out
}

async function resolveDuplicateThreshold(
  fs: WikiFS,
): Promise<{ threshold: number; fallback: RefactoringConfigFallback }> {
  if (!(await fs.exists(REFACTORING_CONFIG_PATH))) {
    return { threshold: DEFAULT_DUPLICATE_THRESHOLD, fallback: 'default' }
  }
  try {
    const raw = await fs.read(REFACTORING_CONFIG_PATH)
    const m = raw.match(/similarity_threshold:\s*([0-9]*\.?[0-9]+)/)
    if (!m) throw new Error('similarity_threshold not parseable')
    const n = Number(m[1])
    if (!Number.isFinite(n) || n <= 0 || n > 1) throw new Error('threshold out of range')
    return { threshold: n, fallback: 'override' }
  } catch (err) {
    console.warn(
      `[wiki-refactoring] ${REFACTORING_CONFIG_PATH} parse failed — fallback to default ${DEFAULT_DUPLICATE_THRESHOLD}`,
      err,
    )
    return { threshold: DEFAULT_DUPLICATE_THRESHOLD, fallback: 'fallback-on-parse-fail' }
  }
}

// ─── Slug similarity ────────────────────────────────────────────────────────
//
// Combines two signals:
//   1. Sørensen-Dice on character bigrams (raw multiset overlap).
//   2. Prefix-boundary boost: when one slug is a `-`-bounded prefix of the other,
//      score = 0.5 + 0.5 * min/max. This catches `lotus-pms` ↔ `lotus-pms-co`
//      style suffix variations (corp / inc / co) that Dice underweights at short
//      lengths while still penalising short-prefix matches like `foo` ↔ `foo-bar`
//      so they only surface at relaxed thresholds (≤ 0.71 boundary).
// Final similarity = max(prefixBoost, dice).
export function slugSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length < 2 || b.length < 2) return 0
  return Math.max(prefixBoundaryBoost(a, b), diceBigram(a, b))
}

function prefixBoundaryBoost(a: string, b: string): number {
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
  if (longer.length === shorter.length) return 0
  if (!longer.startsWith(shorter)) return 0
  if (longer.charAt(shorter.length) !== '-') return 0
  return 0.5 + 0.5 * (shorter.length / longer.length)
}

function diceBigram(a: string, b: string): number {
  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>()
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2)
      m.set(bg, (m.get(bg) ?? 0) + 1)
    }
    return m
  }
  const A = bigrams(a)
  const B = bigrams(b)
  let intersection = 0
  for (const [bg, ca] of A) {
    const cb = B.get(bg)
    if (cb !== undefined) intersection += Math.min(ca, cb)
  }
  const total =
    [...A.values()].reduce((s, n) => s + n, 0) + [...B.values()].reduce((s, n) => s + n, 0)
  if (total === 0) return 0
  return (2 * intersection) / total
}
