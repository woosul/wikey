/**
 * §5.19 Spec 3 — wiki-recovery (confirm-gated fix).
 *
 * Invariants:
 *   I7 confirm 의무 (silent fix 0) / I8 wiki/log.md ingest 동급 entry /
 *   I9 §5.18 use case (sha256:679cf2dd6db75e3a 38-page cleanup).
 */

import type { WikiFS } from '../../types.js'
import {
  SHA256_HASH_PREFIX,
  SHA256_PREFIX_LENGTH,
  listWikiPages,
  pageSlugFromPath,
  throwIfAborted,
} from './helpers.js'

export interface WikiRecoveryReport {
  readonly changedPages: readonly string[]
  readonly registryUpdates: number
  readonly logEntryAdded: boolean
}

export interface ApplyWikiRecoveryOptions {
  readonly confirm: boolean
  readonly danglingShas?: readonly string[]
  readonly staleTombstoneIds?: readonly string[]
  readonly today?: string
  /** Cooperative AbortSignal — polled per-page during the recovery loop. */
  readonly signal?: AbortSignal
}

export async function applyWikiRecovery(
  fs: WikiFS,
  opts: ApplyWikiRecoveryOptions,
): Promise<WikiRecoveryReport> {
  // I7 — confirm 의무. silent fix 0.
  if (!opts.confirm) {
    return { changedPages: [], registryUpdates: 0, logEntryAdded: false }
  }

  const today = opts.today ?? new Date().toISOString().slice(0, 10)
  const danglingShas = new Set(opts.danglingShas ?? [])
  const changedPages: string[] = []
  // §5.19 cycle #5 Finding 2 — mid-loop abort partial state visibility.
  // Track total page count + abort flag so the log entry can flag partial
  // application ("[ABORTED]" marker) instead of silently presenting partial
  // changes as a completed recovery (I8 integrity).
  let totalPages = 0
  let aborted = false
  let abortError: unknown

  try {
    if (danglingShas.size > 0) {
      const pages = await listWikiPages(fs)
      totalPages = pages.length
      for (const path of pages) {
        throwIfAborted(opts.signal)
        const body = await fs.read(path)
        const next = removeDanglingReferences(body, danglingShas)
        if (next !== body) {
          await fs.write(path, next)
          changedPages.push(path)
        }
      }
    }
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      aborted = true
      abortError = err
    } else {
      throw err
    }
  }

  // I8 — log.md ingest 동급 entry (§5.11 v2 의미). On mid-loop abort, log
  // partial state with an "[ABORTED]" marker so users can see that some pages
  // were modified before cancellation (instead of silent partial state).
  let logEntryAdded = false
  if (changedPages.length > 0) {
    const logPath = 'wiki/log.md'
    const existing = (await fs.exists(logPath)) ? await fs.read(logPath) : ''
    const entry = renderRecoveryLogEntry(today, changedPages, opts, {
      aborted,
      totalPages,
    })
    const separator = existing.endsWith('\n') || existing === '' ? '' : '\n'
    await fs.write(logPath, existing + separator + entry)
    logEntryAdded = true
  }

  // Re-throw AbortError after the partial-state log entry is persisted so
  // upstream catch-by-name (`MaintenanceModal.dispatchMode()` etc.) still
  // short-circuits the UI flow.
  if (aborted) throw abortError

  return { changedPages, registryUpdates: 0, logEntryAdded }
}

/**
 * Remove dangling sha references from a wiki page body:
 *   1) frontmatter `sources: [...]` — drop matching sha entries.
 *   2) frontmatter `provenance:` block — drop entries whose `ref:` points at
 *      `sources/<dangling-sha>` (§4.3.2 Part A shape, 38-page live vault case).
 *   3) body `[[source-<sha-prefix>...]]` — replace with "근거 삭제됨" marker
 *      (schema 워크플로우 4 정합: 근거 소스 삭제됨 표시).
 *
 * Body match uses the first `SHA256_PREFIX_LENGTH` hex chars after `sha256:`
 * (consistent with how source-page slugs are derived elsewhere).
 */
function removeDanglingReferences(body: string, danglingShas: ReadonlySet<string>): string {
  let next = stripDanglingFromFrontmatter(body, danglingShas)
  next = stripDanglingFromProvenance(next, danglingShas)
  next = stripDanglingFromBody(next, danglingShas)
  return next
}

function stripDanglingFromFrontmatter(
  body: string,
  danglingShas: ReadonlySet<string>,
): string {
  return body.replace(/(^|\n)sources:\s*\[([^\]]*)\]/g, (_match, prefix, list) => {
    const items = (list as string)
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    const kept = items.filter((item) => {
      const bare = item.replace(/^['"]|['"]$/g, '')
      return !danglingShas.has(bare)
    })
    return `${prefix}sources: [${kept.join(', ')}]`
  })
}

/**
 * Drop `provenance:` list entries whose `ref:` references a dangling sha. A
 * provenance entry spans the `- type: …` line + indented continuation lines
 * (`ref:`, optional `confidence:` / `reason:`) until the next `- ` item or a
 * top-level key. If every entry is dropped, the empty `provenance:` header is
 * removed too (avoids leaving a stub `provenance:` with no items).
 */
function stripDanglingFromProvenance(
  body: string,
  danglingShas: ReadonlySet<string>,
): string {
  if (danglingShas.size === 0) return body

  // Only touch the frontmatter block — provenance never appears in body.
  if (!body.startsWith('---')) return body
  const fmEnd = body.indexOf('\n---', 3)
  if (fmEnd < 0) return body
  const fmInner = body.slice(4, fmEnd)
  const rest = body.slice(fmEnd)

  const lines = fmInner.split('\n')
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]!
    if (!/^provenance\s*:\s*$/.test(line)) {
      out.push(line)
      i++
      continue
    }
    // Found the provenance block header — gather following indented entries.
    const blockStart = i
    i++
    const kept: string[][] = []
    while (i < lines.length) {
      const peek = lines[i]!
      // Top-level key (no leading space) ends the block.
      if (/^[A-Za-z0-9_]+\s*:/.test(peek)) break
      // New list item starts at `  - `.
      if (/^\s*-\s+/.test(peek)) {
        const itemLines: string[] = [peek]
        i++
        while (i < lines.length) {
          const cont = lines[i]!
          if (/^[A-Za-z0-9_]+\s*:/.test(cont)) break
          if (/^\s*-\s+/.test(cont)) break
          itemLines.push(cont)
          i++
        }
        if (!provenanceItemMatchesDangling(itemLines, danglingShas)) {
          kept.push(itemLines)
        }
        continue
      }
      // Unrecognised indented content — preserve verbatim under the header.
      kept.push([peek])
      i++
    }
    if (kept.length === 0) {
      // Drop the empty `provenance:` header too (no stub).
      void blockStart
    } else {
      out.push('provenance:')
      for (const item of kept) out.push(...item)
    }
  }

  return `---\n${out.join('\n')}${rest}`
}

function provenanceItemMatchesDangling(
  itemLines: readonly string[],
  danglingShas: ReadonlySet<string>,
): boolean {
  for (const line of itemLines) {
    const m = line.match(/^\s*ref\s*:\s*(.+?)\s*$/)
    if (!m) continue
    const ref = m[1]!.replace(/^["']|["']$/g, '')
    // ref shape: `sources/sha256:<hex>` — strip the `sources/` prefix.
    const sha = ref.startsWith('sources/') ? ref.slice('sources/'.length) : ref
    if (danglingShas.has(sha)) return true
  }
  return false
}

function stripDanglingFromBody(body: string, danglingShas: ReadonlySet<string>): string {
  let next = body
  for (const sha of danglingShas) {
    const hexPrefix = sha
      .slice(SHA256_HASH_PREFIX.length, SHA256_HASH_PREFIX.length + SHA256_PREFIX_LENGTH)
    if (hexPrefix.length === 0) continue
    const re = new RegExp(`\\[\\[source-[^\\]]*${escapeRegex(hexPrefix)}[^\\]]*\\]\\]`, 'g')
    next = next.replace(re, '근거 삭제됨')
  }
  return next
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function renderRecoveryLogEntry(
  today: string,
  changedPages: readonly string[],
  opts: ApplyWikiRecoveryOptions,
  abortInfo: { aborted: boolean; totalPages: number } = { aborted: false, totalPages: 0 },
): string {
  // [ABORTED] marker — partial-state visibility (§5.19 cycle #5 Finding 2).
  const header = abortInfo.aborted
    ? `## [${today}] lint-fix | wiki-recovery [ABORTED midway, ${changedPages.length}/${abortInfo.totalPages} pages processed]`
    : `## [${today}] lint-fix | wiki-recovery`
  const lines: string[] = [header, '']
  if (opts.danglingShas && opts.danglingShas.length > 0) {
    lines.push(`- dangling cross-link 제거: ${opts.danglingShas.length} sha`)
  }
  lines.push(`- 변경 페이지: ${changedPages.length}개`)
  for (const p of changedPages) lines.push(`  - [[${pageSlugFromPath(p)}]]`)
  lines.push('')
  return lines.join('\n')
}
