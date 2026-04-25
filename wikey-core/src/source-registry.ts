/**
 * source-registry.ts — Phase 4.2 Stage 1 S1-2 (plan v3).
 *
 * `.wikey/source-registry.json` 의 in-memory 표현 + CRUD.
 * 이동 무관 불변 key = source_id. vault_path 는 파생 필드.
 */

import type { WikiFS } from './types.js'
import { verifyFullHash, computeFullHash } from './uri.js'

export const REGISTRY_PATH = '.wikey/source-registry.json'

export interface PathHistoryEntry {
  readonly vault_path: string
  readonly at: string // ISO 8601
}

export interface SourceRecord {
  readonly vault_path: string
  readonly sidecar_vault_path?: string
  readonly hash: string // full sha256 hex
  readonly size: number
  readonly first_seen: string
  readonly ingested_pages: readonly string[]
  readonly path_history: readonly PathHistoryEntry[]
  readonly tombstone: boolean
}

export type SourceRegistry = Record<string, SourceRecord>

export async function loadRegistry(fs: WikiFS): Promise<SourceRegistry> {
  if (!(await fs.exists(REGISTRY_PATH))) return {}
  const raw = await fs.read(REGISTRY_PATH)
  try {
    return JSON.parse(raw) as SourceRegistry
  } catch (err) {
    // Corrupted JSON — snapshot to .bak and return empty.
    console.warn(`[source-registry] corrupted JSON at ${REGISTRY_PATH}, snapshotting to .bak`, err)
    await fs.write(`${REGISTRY_PATH}.bak`, raw)
    return {}
  }
}

export async function saveRegistry(fs: WikiFS, reg: SourceRegistry): Promise<void> {
  await fs.write(REGISTRY_PATH, JSON.stringify(reg, null, 2))
}

export function upsert(reg: SourceRegistry, id: string, record: SourceRecord): SourceRegistry {
  return { ...reg, [id]: record }
}

export function findById(reg: SourceRegistry, id: string): SourceRecord | null {
  return reg[id] ?? null
}

/**
 * Look up a record by 16-hex prefix, disambiguating prefix collisions via
 * full-hash verification against the caller-supplied bytes.
 */
export function findByIdPrefix(
  reg: SourceRegistry,
  prefixHex: string,
  bytes: Uint8Array,
): { id: string; record: SourceRecord } | null {
  const fullHash = computeFullHash(bytes)
  for (const [id, record] of Object.entries(reg)) {
    if (!id.includes(prefixHex)) continue
    // Verify by full-hash: record.hash equals sha256(bytes).
    if (record.hash === fullHash) return { id, record }
    // Fallback: verify via uri.verifyFullHash for defence-in-depth.
    if (verifyFullHash(prefixHex, bytes) && record.hash === fullHash) return { id, record }
  }
  return null
}

/** Find by current or historical vault_path (sticky id). */
export function findByPath(
  reg: SourceRegistry,
  vaultPath: string,
): { id: string; record: SourceRecord } | null {
  for (const [id, record] of Object.entries(reg)) {
    if (record.vault_path === vaultPath) return { id, record }
    if (record.path_history.some((h) => h.vault_path === vaultPath)) return { id, record }
  }
  return null
}

export function findByHash(
  reg: SourceRegistry,
  fullHash: string,
): { id: string; record: SourceRecord } | null {
  for (const [id, record] of Object.entries(reg)) {
    if (record.hash === fullHash) return { id, record }
  }
  return null
}

export function recordMove(
  reg: SourceRegistry,
  id: string,
  newVaultPath: string,
  newSidecarVaultPath?: string,
): SourceRegistry {
  const existing = reg[id]
  if (!existing) return reg
  const at = new Date().toISOString()
  const nextHistory: readonly PathHistoryEntry[] = [
    ...existing.path_history,
    { vault_path: newVaultPath, at },
  ]
  const next: SourceRecord = {
    ...existing,
    vault_path: newVaultPath,
    sidecar_vault_path: newSidecarVaultPath ?? existing.sidecar_vault_path,
    path_history: nextHistory,
    // §5.2.9: move = 파일이 disk 에 살아 있다 = tombstone 해제.
    // 이전 reconcile (case 3, walker 누락) 이 잘못 마킹한 stale tombstone 자동 복구.
    tombstone: false,
  }
  return { ...reg, [id]: next }
}

export function recordDelete(reg: SourceRegistry, id: string): SourceRegistry {
  const existing = reg[id]
  if (!existing) return reg
  return { ...reg, [id]: { ...existing, tombstone: true } }
}

export function restoreTombstone(reg: SourceRegistry, id: string): SourceRegistry {
  const existing = reg[id]
  if (!existing) return reg
  return { ...reg, [id]: { ...existing, tombstone: false } }
}

export interface WalkerEntry {
  readonly vault_path: string
  readonly bytes: Uint8Array
}

/**
 * Startup reconciliation — compare registry vault_path against actual fs walker.
 *
 * Behavior (Phase 4.2 Stage 4 S4-3):
 *   1. record.vault_path matches a walker entry with same full-hash → no change.
 *   2. hash matches a walker entry at a DIFFERENT path → recordMove (bash/Finder move).
 *   3. record.hash absent from walker → tombstone (bash/Finder delete).
 *   4. tombstoned record's hash appears in walker → restoreTombstone (+ recordMove if path differs).
 */
export async function reconcile(
  reg: SourceRegistry,
  walker: () => Promise<readonly WalkerEntry[]>,
): Promise<SourceRegistry> {
  const entries = await walker()
  const hashMap = new Map<string, string>() // fullHash → vault_path
  for (const e of entries) hashMap.set(computeFullHash(e.bytes), e.vault_path)

  let next: SourceRegistry = reg
  for (const [id, record] of Object.entries(reg)) {
    const matchedPath = hashMap.get(record.hash)

    if (record.tombstone) {
      if (matchedPath) {
        // File reappeared on disk — resurrect the record.
        next = restoreTombstone(next, id)
        if (matchedPath !== record.vault_path) {
          const newSidecar = record.sidecar_vault_path ? `${matchedPath}.md` : undefined
          next = recordMove(next, id, matchedPath, newSidecar)
        }
      }
      continue
    }

    if (matchedPath) {
      if (matchedPath !== record.vault_path) {
        const newSidecar = record.sidecar_vault_path ? `${matchedPath}.md` : undefined
        next = recordMove(next, id, matchedPath, newSidecar)
      }
      continue
    }

    // Not tombstoned and not present in walker → mark deleted.
    next = recordDelete(next, id)
  }
  return next
}
