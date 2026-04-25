/**
 * incremental-reingest.ts — §5.3.1 + §5.3.2 (plan v11, 2026-04-25).
 *
 * Single-entry helper for hash-based incremental reingest decisions and
 * user-modification protection. Used by ingest-pipeline.ts at Step 0.5
 * (raw disk bytes hash → registry diff → action) and Hook 2 (source page
 * user-marker preservation).
 *
 * KEY INVARIANT (★ P1-1):
 *   `sourceBytes` MUST be raw disk bytes — NEVER post-conversion text.
 *   The caller (ingest-pipeline.ts Step 0) is responsible for reading bytes
 *   before any Docling/HWP/PDF transformation. Helper is pure: any hash here
 *   is sha256 over the bytes the caller supplied.
 *
 * DECISION TREE (Phase A: collect conflicts; Phase B: choose action):
 *   Phase A — collect (do NOT short-circuit):
 *     R = R_byPath ?? R_byHash ?? null
 *     conflicts = []
 *     - R != null && R.sidecar_hash != null && diskSidecarBytes != null
 *         && H_sidecar_disk != R.sidecar_hash → push 'sidecar-user-edit'
 *     - R != null && R.hash != H_now && any ingested_pages contains user marker → push 'source-page-user-edit'
 *     - R_byHash != null && R_byPath == null → push 'duplicate-hash'
 *     - R != null && R.hash != H_now && diskSidecarBytes != null && R.sidecar_hash == null
 *         → push 'legacy-no-sidecar-hash'
 *
 *   Phase B — action:
 *     R == null                       → action='force', reason='new-source'
 *     R_byHash != null && R_byPath == null
 *                                     → action='skip', reason='duplicate-hash-other-path'
 *                                       duplicateOfId = R_byHash.id
 *                                       duplicatePathToAppend = sourcePath
 *     R.hash == H_now:
 *       sidecar_hash null + disk     → action='skip-with-seed', reason='hash-match-sidecar-seed'
 *       sidecar_hash set + disk diff → action='skip', reason='hash-match-sidecar-edit-noted'
 *       else                         → action='skip', reason='hash-match'
 *     R.hash != H_now:
 *       conflicts.length == 0        → action='force', reason='hash-changed-clean'
 *       onConflict provided          → action='prompt', reason='hash-changed-with-conflicts'
 *       else                         → action='protect', reason='hash-changed-with-conflicts'
 */

import type { WikiFS } from './types.js'
import { computeFullHash } from './uri.js'
import {
  loadRegistry,
  findByPath,
  findByHash,
  type ConflictKind,
  type ReingestAction,
  type SourceRecord,
} from './source-registry.js'

export type { ConflictKind, ReingestAction } from './source-registry.js'

/**
 * Default user-marker headers preserved across reingest.
 * Each is matched as a full line at start (^## ...). Plan v11 P2-6.
 */
export const USER_MARKER_HEADERS: readonly string[] = [
  '## 사용자 메모',
  '## User Notes',
  '## 메모',
]

export interface ReingestDecision {
  readonly action: ReingestAction
  /** R != null 분기에서 R.id 보존 (★ plan v11 결정 10 stable per path). */
  readonly preservedSourceId?: string
  /** duplicate-hash 분기에서 R_byHash.id 노출. */
  readonly duplicateOfId?: string
  readonly reason:
    | 'new-source'
    | 'hash-match'
    | 'hash-match-sidecar-seed'
    | 'hash-match-sidecar-edit-noted'
    | 'hash-changed-clean'
    | 'hash-changed-with-conflicts'
    | 'duplicate-hash-other-path'
  readonly sourceHash: string
  readonly registrySourceHash?: string
  readonly registrySidecarHash?: string
  readonly diskSidecarHash?: string | null
  readonly conflicts: readonly ConflictKind[]
  readonly registryRecord: SourceRecord | null
  /** caller appends to registry duplicate_locations when truthy (★ P1-6 + v4). */
  readonly duplicatePathToAppend?: string
}

export interface ConflictInfo {
  readonly decision: ReingestDecision
  readonly diff?: { readonly sidecar?: string; readonly sourcePage?: string }
}

export class IngestProtectionPathExhaustedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IngestProtectionPathExhaustedError'
  }
}

/**
 * Compute sha256(NFC(content)) of a sidecar `.md` file, or null when missing.
 * NFC normalization keeps Python ↔ TS hashes consistent (★ plan v11 P2-7).
 */
export async function computeSidecarHash(wikiFS: WikiFS, sidecarPath: string): Promise<string | null> {
  if (!(await wikiFS.exists(sidecarPath))) return null
  const content = await wikiFS.read(sidecarPath)
  return computeFullHash(new TextEncoder().encode(content.normalize('NFC')))
}

/**
 * Resolve a non-conflicting sidecar protect target path.
 * Default: `<sourcePath>.md.new`. On collision, append `.1`, `.2`, ... `.9`.
 * If all `.1`–`.9` are taken, throw `IngestProtectionPathExhaustedError`.
 */
export async function protectSidecarTargetPath(
  sourcePath: string,
  wikiFS: WikiFS,
): Promise<string> {
  const base = `${sourcePath}.md.new`
  if (!(await wikiFS.exists(base))) return base
  for (let i = 1; i <= 9; i++) {
    const candidate = `${base}.${i}`
    if (!(await wikiFS.exists(candidate))) return candidate
  }
  throw new IngestProtectionPathExhaustedError(
    `protect target exhausted for ${sourcePath} (${base}, .1–.9 all exist)`,
  )
}

/**
 * Extract the user-marker H2 block from existing wiki page content.
 * Returns markdown from `## 사용자 메모` (or other USER_MARKER_HEADERS) until the
 * next `^## ` heading or EOF. Empty string if no marker present.
 *
 * Line-start anchor (^##) prevents matches on indented lines (4-space code).
 * Markers inside fenced code blocks may still match by line-start; current plan
 * accepts this as a non-issue (P2-6 — false positive minimal but not zero).
 * Input is normalized to NFC (★ P2-7) so NFC/NFD equivalents map identically.
 */
export function extractUserMarkers(existingPage: string): string {
  if (!existingPage) return ''
  const text = existingPage.normalize('NFC')
  const lines = text.split('\n')
  let startIdx = -1
  let matchedHeader = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    for (const header of USER_MARKER_HEADERS) {
      // exact match: line starts with header text (no leading whitespace)
      if (line === header || line.startsWith(`${header} `) || line.startsWith(`${header}\t`)) {
        startIdx = i
        matchedHeader = header
        break
      }
    }
    if (startIdx >= 0) break
  }
  if (startIdx < 0) return ''
  // Find the end: next ^## ... heading at line start, or EOF.
  let endIdx = lines.length
  for (let j = startIdx + 1; j < lines.length; j++) {
    const line = lines[j]!
    if (/^## /.test(line) || line === '##') {
      endIdx = j
      break
    }
  }
  // Strip trailing empty lines for tidiness.
  let end = endIdx
  while (end > startIdx + 1 && lines[end - 1] === '') end--
  return lines.slice(startIdx, end).join('\n') + '\n'
}

/**
 * Append `markers` to `newContent`. Idempotent — if the same marker header
 * already appears at line-start in `newContent`, return `newContent` unchanged
 * (★ P2-5 멱등성). Empty markers → newContent unchanged.
 */
export function mergeUserMarkers(newContent: string, markers: string): string {
  if (!markers || markers.trim() === '') return newContent
  const headerLine = markers.split('\n', 1)[0]!.trim()
  const lines = newContent.split('\n')
  for (const line of lines) {
    if (line.trim() === headerLine) return newContent
  }
  // Append with one blank line separator and a trailing newline.
  const trimmed = newContent.replace(/\n+$/, '')
  const markerBlock = markers.replace(/\n+$/, '')
  return `${trimmed}\n\n${markerBlock}\n`
}

interface DecideArgs {
  readonly sourcePath: string
  readonly sourceBytes: Uint8Array
  readonly wikiFS: WikiFS
  readonly basePath?: string
  readonly onConflict?: (info: ConflictInfo) => Promise<'overwrite' | 'preserve' | 'cancel'>
}

/**
 * Decide the reingest action for a source. Pure function w.r.t. registry/disk;
 * does NOT mutate registry — caller applies the decision.
 *
 * @param args.sourceBytes — RAW disk bytes (★ plan v11 P1-1). Caller MUST read
 *   bytes before any format conversion (Docling/PDF strip/HWP) so that the
 *   hash matches `record.hash` semantics (raw bytes).
 */
export async function decideReingest(args: DecideArgs): Promise<ReingestDecision> {
  const { sourcePath, sourceBytes, wikiFS, onConflict } = args
  const sourceHash = computeFullHash(sourceBytes)
  const reg = await loadRegistry(wikiFS)
  const byPath = findByPath(reg, sourcePath)
  const byHash = findByHash(reg, sourceHash)
  const R: { id: string; record: SourceRecord } | null =
    byPath ?? (byHash ?? null)

  // Phase A — conflicts collection.
  const conflicts: ConflictKind[] = []

  // disk sidecar hash (used by both A/F detection and seed branch)
  const diskSidecarPath = R?.record.sidecar_vault_path ?? `${sourcePath}.md`
  const diskSidecarExists = await wikiFS.exists(diskSidecarPath)
  let diskSidecarHash: string | null = null
  if (diskSidecarExists) {
    diskSidecarHash = await computeSidecarHash(wikiFS, diskSidecarPath)
  }

  if (
    R != null &&
    R.record.sidecar_hash != null &&
    diskSidecarHash != null &&
    diskSidecarHash !== R.record.sidecar_hash
  ) {
    conflicts.push('sidecar-user-edit')
  }

  if (R != null && R.record.hash !== sourceHash) {
    for (const page of R.record.ingested_pages) {
      if (await wikiFS.exists(page)) {
        const body = await wikiFS.read(page)
        if (extractUserMarkers(body) !== '') {
          conflicts.push('source-page-user-edit')
          break
        }
      }
    }
  }

  if (byHash != null && byPath == null) {
    conflicts.push('duplicate-hash')
  }

  if (
    R != null &&
    R.record.hash !== sourceHash &&
    diskSidecarHash != null &&
    R.record.sidecar_hash == null
  ) {
    conflicts.push('legacy-no-sidecar-hash')
  }

  // Phase B — action.
  const baseDecision = {
    sourceHash,
    registrySourceHash: R?.record.hash,
    registrySidecarHash: R?.record.sidecar_hash,
    diskSidecarHash,
    conflicts,
    registryRecord: R?.record ?? null,
  } as const

  if (R == null) {
    return {
      action: 'force',
      reason: 'new-source',
      ...baseDecision,
    }
  }

  // duplicate-hash branch must come BEFORE hash-match (★ codex v3 ordering).
  if (byHash != null && byPath == null) {
    return {
      action: 'skip',
      reason: 'duplicate-hash-other-path',
      duplicateOfId: byHash.id,
      duplicatePathToAppend: sourcePath,
      ...baseDecision,
    }
  }

  if (R.record.hash === sourceHash) {
    if (R.record.sidecar_hash == null && diskSidecarExists) {
      return {
        action: 'skip-with-seed',
        reason: 'hash-match-sidecar-seed',
        preservedSourceId: R.id,
        ...baseDecision,
      }
    }
    if (
      R.record.sidecar_hash != null &&
      diskSidecarHash != null &&
      diskSidecarHash !== R.record.sidecar_hash
    ) {
      return {
        action: 'skip',
        reason: 'hash-match-sidecar-edit-noted',
        preservedSourceId: R.id,
        ...baseDecision,
      }
    }
    return {
      action: 'skip',
      reason: 'hash-match',
      preservedSourceId: R.id,
      ...baseDecision,
    }
  }

  // R.record.hash != sourceHash
  if (conflicts.length === 0) {
    return {
      action: 'force',
      reason: 'hash-changed-clean',
      preservedSourceId: R.id,
      ...baseDecision,
    }
  }
  if (onConflict != null) {
    return {
      action: 'prompt',
      reason: 'hash-changed-with-conflicts',
      preservedSourceId: R.id,
      ...baseDecision,
    }
  }
  return {
    action: 'protect',
    reason: 'hash-changed-with-conflicts',
    preservedSourceId: R.id,
    ...baseDecision,
  }
}
