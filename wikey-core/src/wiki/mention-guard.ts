/**
 * §5.21 Ingest pipeline mention guard — post-process deterministic safety net.
 *
 * Single truth source: `docs/planning/phase-5/phase-5-spec-5.21-ingest-mention-guard.md` v0.3.
 *
 * Karpathy 4 principles:
 *   - Explicit: every wikilink transformation is logged (MentionGuardLogEntry).
 *   - Yours: plain-text fallback preserves the filename word in body prose.
 *   - File over app: pure function, deterministic, idempotent (I6).
 *   - BYOAI: provider-independent (no LLM call).
 *
 * Invariants implemented:
 *   I1 — `.md/.pdf/.hwp/.docx/.pptx/.txt` target wikilink → plain text + log
 *   I2 — raw filename (whitespace / hangul in target) → plain text + log
 *   I4 — target lowercased via `canonicalizeSlug(target.toLowerCase(), userAliases)`
 *   I5 — alias original casing preserved (target normalized only)
 *   I6 — idempotent: second pass yields byte-identical content + empty log
 *   I7 — `## 출처` section + `alias === '원문'` exempt (§5.13 source link)
 *   I8 — `parseWikilinksWithRanges` returns offsets, no dedup
 */

import { canonicalizeSlug } from '../canonicalizer.js'
import { normalizeBase } from '../wiki-ops.js'

export interface MentionGuardOptions {
  readonly sourceSha?: string
  readonly page?: string
  readonly userAliases?: Readonly<Record<string, string>>
  /**
   * Normalized bases of pages that exist in the wiki (entity / concept / source).
   * Used by I2 raw-filename branch: when a slug-ified target matches an existing
   * base, emit the canonical wikilink; otherwise fall back to plain text.
   * When omitted, raw-filename targets always degrade to plain text (legacy
   * behaviour through Step C).
   */
  readonly existingBases?: ReadonlySet<string>
}

export type MentionGuardReason = 'extension' | 'raw-filename' | 'case-normalize' | 'mention-only'

export interface MentionGuardLogEntry {
  readonly phase: 'ingest'
  readonly sourceSha?: string
  readonly page?: string
  readonly original: string
  readonly transformed: string
  readonly reason: MentionGuardReason
}

export interface MentionGuardResult {
  readonly content: string
  readonly log: readonly MentionGuardLogEntry[]
}

export interface ParsedWikilink {
  readonly original: string
  readonly target: string
  readonly alias: string | null
  readonly range: readonly [number, number]
}

/** Mirrors `wiki-ops.ts:4` WIKILINK_RE — single source identifier. */
const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g

/** Extension set per Spec 1 I1 (case-insensitive). */
const EXTENSION_RE = /\.(?:md|pdf|hwp|docx|pptx|txt)$/i

/** Raw-filename heuristic per Spec 1 I2: whitespace or hangul in target. */
const RAW_FILENAME_RE = /[\s가-힣]/

/** §5.13 source link exempt — alias === this literal short-circuits guard. */
const SOURCE_LINK_ALIAS = '원문'

/** §5.13 source link exempt — heading boundary for body / sources split (I7). */
const SOURCES_HEADING_RE = /^## 출처\s*$/m

/**
 * §5.21 I8 — wiki-ops.ts:488 `extractWikilinks` is dedup + target-only, so it
 * cannot reconstruct alias / offset / original. This parser yields every
 * wikilink in document order with offsets preserved (no dedup).
 */
export function parseWikilinksWithRanges(content: string): readonly ParsedWikilink[] {
  const out: ParsedWikilink[] = []
  let match: RegExpExecArray | null
  WIKILINK_RE.lastIndex = 0
  while ((match = WIKILINK_RE.exec(content)) !== null) {
    const start = match.index
    const end = start + match[0].length
    out.push({
      original: match[0],
      target: match[1],
      alias: match[2] ?? null,
      range: [start, end],
    })
  }
  return out
}

/**
 * Find the body / sources split index. Body = `[0, splitIdx)`, sources = `[splitIdx, end)`.
 * Returns `content.length` when `## 출처` heading is absent.
 */
function findSourcesSplit(content: string): number {
  const match = SOURCES_HEADING_RE.exec(content)
  return match ? match.index : content.length
}

/**
 * Build the canonical-slug variant of a wikilink. Returns null when target is
 * already canonical (no-op — preserves idempotency).
 */
function buildCanonicalReplacement(
  link: ParsedWikilink,
  userAliases?: Readonly<Record<string, string>>,
): { transformed: string; reason: MentionGuardReason } | null {
  const lower = link.target.toLowerCase()
  const canonical = canonicalizeSlug(lower, userAliases)
  if (canonical === link.target) return null
  const transformed = link.alias !== null
    ? `[[${canonical}|${link.alias}]]`
    : `[[${canonical}]]`
  return { transformed, reason: 'case-normalize' }
}

/**
 * Build the plain-text variant of a wikilink. Alias (display label) wins over
 * target when present so AC-S1-2 (filename word preserved) is satisfied for
 * both `[[X.pdf]]` and `[[X.pdf|display]]` cases.
 */
function buildPlainTextReplacement(link: ParsedWikilink, reason: MentionGuardReason): {
  transformed: string
  reason: MentionGuardReason
} {
  const transformed = link.alias ?? link.target
  return { transformed, reason }
}

/** Decide the transformation for a single wikilink, or null when no change. */
function classifyLink(
  link: ParsedWikilink,
  userAliases?: Readonly<Record<string, string>>,
  existingBases?: ReadonlySet<string>,
): { transformed: string; reason: MentionGuardReason } | null {
  // I7: alias === '원문' is a §5.13 source link — exempt anywhere.
  if (link.alias === SOURCE_LINK_ALIAS) return null

  if (EXTENSION_RE.test(link.target)) {
    return buildPlainTextReplacement(link, 'extension')
  }

  if (RAW_FILENAME_RE.test(link.target)) {
    // I2 — slug-ify first; emit canonical wikilink only when the resulting
    // base exists in the vault. Otherwise degrade to plain text so the body
    // still contains the original word (AC-S1-2).
    if (existingBases && existingBases.size > 0) {
      const slug = canonicalizeSlug(normalizeBase(link.target), userAliases)
      if (existingBases.has(slug)) {
        const transformed = link.alias !== null
          ? `[[${slug}|${link.alias}]]`
          : `[[${slug}]]`
        return { transformed, reason: 'case-normalize' }
      }
    }
    return buildPlainTextReplacement(link, 'raw-filename')
  }

  // I4/I5/I6 — case normalize when canonical differs from target.
  const canonical = buildCanonicalReplacement(link, userAliases)
  if (canonical !== null) {
    // After canonicalization, verify vault membership (I9). When the
    // canonical slug is absent from the existing page set, degrade to
    // plain text instead of emitting a still-broken wikilink.
    if (existingBases && existingBases.size > 0) {
      const canonicalSlug = canonicalizeSlug(link.target.toLowerCase(), userAliases)
      if (!existingBases.has(canonicalSlug)) {
        return buildPlainTextReplacement(link, 'mention-only')
      }
    }
    return canonical
  }

  // I9 — target is already canonical; degrade to plain text when the page
  // does not exist in the vault page set (root cause 2, mention-only).
  // When existingBases is unprovided (legacy callers / pure-function tests
  // without context), preserve the wikilink to avoid false stripping.
  if (existingBases && existingBases.size > 0 && !existingBases.has(link.target)) {
    return buildPlainTextReplacement(link, 'mention-only')
  }
  return null
}

/**
 * §5.21 v0.5 — Stage 2 pre-filter (사용자 raise 2026-05-13).
 *
 * mention list + sourceBody 받아 deterministic substring count < threshold 인
 * mention 을 drop. Stage 2 canonicalizer LLM call *전* 적용 → token 절약. 같은
 * logic 이 canonicalizer.ts:applyPromotionGate 안에 있지만 그건 LLM 호출 *후*
 * 적용 — Stage 2 token cost 회피 불가. 본 helper 가 LLM 호출 전 차단.
 *
 * Returns `{ kept, dropped }` — kept 만 canonicalize 로 전달.
 *
 * Pure function (I/O 없음). Mention 의 name + alias 의 sourceBody 등장 횟수가
 * threshold 미만이면 drop.
 */
export interface PreFilteredMention {
  readonly name: string
  readonly type_hint?: string
  readonly evidence: string
}

export interface PreFilterResult<T extends PreFilteredMention> {
  readonly kept: readonly T[]
  readonly dropped: readonly { mention: T; occurrences: number }[]
}

export function preFilterMentionsByOccurrence<T extends PreFilteredMention>(
  mentions: readonly T[],
  sourceBody: string,
  threshold: number = 2,
): PreFilterResult<T> {
  const kept: T[] = []
  const dropped: { mention: T; occurrences: number }[] = []
  const lowerBody = sourceBody.toLowerCase()
  for (const m of mentions) {
    const name = (m.name ?? '').trim()
    if (!name) {
      dropped.push({ mention: m, occurrences: 0 })
      continue
    }
    const occ = countOccurrences(lowerBody, name.toLowerCase())
    if (occ < threshold) {
      dropped.push({ mention: m, occurrences: occ })
    } else {
      kept.push(m)
    }
  }
  return { kept, dropped }
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let i = 0
  while ((i = haystack.indexOf(needle, i)) !== -1) {
    count++
    i += needle.length
  }
  return count
}

/**
 * §5.21 v0.5 — basename collision guard (사용자 raise 2026-05-13: "basename 도
 * 기존에 있다면 중복으로 생성을 하지 말아야지").
 *
 * canonicalize 결과의 entity/concept filename 이 raw inbox basename set 과
 * 충돌하면 drop. Obsidian basename matcher 가 raw vs wiki 동일 basename 시
 * ambiguity (§5.13.A1) — 충돌 자체를 사전 차단.
 *
 * Returns `{ kept, dropped }` — kept 만 Stage 3 page write 로 전달.
 */
export interface CollisionCandidate {
  readonly filename: string
}

export interface CollisionFilterResult<T extends CollisionCandidate> {
  readonly kept: readonly T[]
  readonly dropped: readonly T[]
}

export function filterBasenameCollisions<T extends CollisionCandidate>(
  candidates: readonly T[],
  rawBasenames: ReadonlySet<string>,
): CollisionFilterResult<T> {
  if (rawBasenames.size === 0) return { kept: candidates, dropped: [] }
  const kept: T[] = []
  const dropped: T[] = []
  for (const c of candidates) {
    const base = normalizeBase(c.filename)
    if (rawBasenames.has(base) || rawBasenames.has(`${base}.md`)) {
      dropped.push(c)
    } else {
      kept.push(c)
    }
  }
  return { kept, dropped }
}

/**
 * §5.21 main API. Applies deterministic mention guard to `content` and returns
 * `{ content, log }`. Pure: no I/O, no side effects.
 *
 * Workflow:
 *   1. Split content at `## 출처` heading (I7). Sources section is exempt.
 *   2. Parse wikilinks in body via `parseWikilinksWithRanges` (I8).
 *   3. For each link in reverse offset order, decide transform via `classifyLink`.
 *   4. Splice replacements into body. Reverse order avoids offset drift.
 *   5. Concatenate transformed body + untouched sources.
 */
export function applyMentionGuard(
  content: string,
  options?: MentionGuardOptions,
): MentionGuardResult {
  const splitIdx = findSourcesSplit(content)
  const body = content.slice(0, splitIdx)
  const sources = content.slice(splitIdx)
  const userAliases = options?.userAliases

  const links = parseWikilinksWithRanges(body)
  const log: MentionGuardLogEntry[] = []
  const existingBases = options?.existingBases

  // Apply replacements right-to-left so earlier offsets stay valid.
  let transformedBody = body
  for (let i = links.length - 1; i >= 0; i--) {
    const link = links[i]
    const decision = classifyLink(link, userAliases, existingBases)
    if (decision === null) continue

    const [start, end] = link.range
    transformedBody = transformedBody.slice(0, start) + decision.transformed + transformedBody.slice(end)
    // Log entries pushed in reverse order; reverse once at the end so callers
    // see document order (matches §5.19 diagnostic conventions).
    log.push({
      phase: 'ingest',
      sourceSha: options?.sourceSha,
      page: options?.page,
      original: link.original,
      transformed: decision.transformed,
      reason: decision.reason,
    })
  }

  log.reverse()
  return { content: transformedBody + sources, log }
}
