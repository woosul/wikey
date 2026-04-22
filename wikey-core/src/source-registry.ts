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
 * For each record, if its stored vault_path no longer exists but the walker
 * reports a file with the same full-hash, update vault_path + append history.
 * Missing (not found anywhere) records are left untouched — caller may tombstone.
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
    if (record.tombstone) continue
    const matchedPath = hashMap.get(record.hash)
    if (matchedPath && matchedPath !== record.vault_path) {
      const newSidecar =
        record.sidecar_vault_path && hashMap.has(record.hash)
          ? `${matchedPath}.md`
          : record.sidecar_vault_path
      next = recordMove(next, id, matchedPath, newSidecar)
    }
  }
  return next
}
