/**
 * §5.19 v0.5 R4 — Stale tombstone purge.
 *
 * registry tombstone entry 중 사용자가 명시 선택한 id 를 영구 삭제 (purge).
 * Read-only by default (`confirm=false` → 변경 0); dryRun 으로 비파괴 preview.
 *
 * Invariants:
 *   I-PURGE-1 (confirm 의무): confirm=false → 변경 0.
 *   I-PURGE-2 (idempotent): 같은 id 2회 → 2회째 noop.
 *   I-PURGE-3 (dry-run): dryRun=true → registry 변경 0 + wouldRemove 채움.
 *   I-PURGE-4 (selective): tombstoneIds 명시한 id 만 — non-tombstone (active) record 는 보호.
 *   I-PURGE-5 (log entry): purge 발생 시 wiki/log.md 에 `lint-fix | stale-tombstone purge` entry.
 */

import type { WikiFS } from '../../types.js'
import { loadRegistrySafe, throwIfAborted } from './helpers.js'
import { REGISTRY_PATH } from '../../source-registry.js'

export interface ApplyStaleTombstoneCleanupOptions {
  readonly confirm: boolean
  readonly tombstoneIds: readonly string[]
  /** dryRun=true → registry / wiki/log.md 변경 0 + wouldRemove 채움. */
  readonly dryRun?: boolean
  readonly today?: string
  readonly signal?: AbortSignal
}

export interface StaleTombstoneCleanupReport {
  readonly removedIds: readonly string[]
  /** dryRun=true 시 채워짐 — 실제 제거 안 됨. */
  readonly wouldRemove: readonly string[]
  /** non-tombstone (active record) 라서 거부된 id (보호 invariant). */
  readonly protectedIds: readonly string[]
  readonly logEntryAdded: boolean
}

export async function applyStaleTombstoneCleanup(
  fs: WikiFS,
  opts: ApplyStaleTombstoneCleanupOptions,
): Promise<StaleTombstoneCleanupReport> {
  // I-PURGE-1 — confirm 의무. silent purge 0.
  if (!opts.confirm) {
    return { removedIds: [], wouldRemove: [], protectedIds: [], logEntryAdded: false }
  }

  throwIfAborted(opts.signal)
  const registry = await loadRegistrySafe(fs)
  const requested = new Set(opts.tombstoneIds)

  // Split requested into (removable tombstones) / (protected active records / unknown).
  const toRemove: string[] = []
  const protectedIds: string[] = []
  for (const id of requested) {
    const record = registry[id]
    if (!record) continue // unknown id — silent skip (idempotent: already purged)
    if (!record.tombstone) {
      protectedIds.push(id)
      continue
    }
    toRemove.push(id)
  }

  // I-PURGE-3 — dry-run short-circuit.
  if (opts.dryRun) {
    return { removedIds: [], wouldRemove: toRemove, protectedIds, logEntryAdded: false }
  }

  if (toRemove.length === 0) {
    return { removedIds: [], wouldRemove: [], protectedIds, logEntryAdded: false }
  }

  // Apply — immutable spread, no mutation.
  const nextRegistry: Record<string, unknown> = {}
  const removeSet = new Set(toRemove)
  for (const [id, record] of Object.entries(registry)) {
    if (removeSet.has(id)) continue
    nextRegistry[id] = record
  }
  await fs.write(REGISTRY_PATH, JSON.stringify(nextRegistry, null, 2))

  // I-PURGE-5 — log entry append.
  const today = opts.today ?? new Date().toISOString().slice(0, 10)
  const logPath = 'wiki/log.md'
  const existing = (await fs.exists(logPath)) ? await fs.read(logPath) : ''
  const entry = renderLogEntry(today, toRemove)
  const separator = existing.endsWith('\n') || existing === '' ? '' : '\n'
  await fs.write(logPath, existing + separator + entry)

  return { removedIds: toRemove, wouldRemove: [], protectedIds, logEntryAdded: true }
}

function renderLogEntry(today: string, removedIds: readonly string[]): string {
  const lines = [
    `## [${today}] lint-fix | stale-tombstone purge`,
    '',
    `- 제거된 tombstone: ${removedIds.length}개`,
  ]
  for (const id of removedIds) lines.push(`  - ${id}`)
  lines.push('')
  return lines.join('\n')
}
