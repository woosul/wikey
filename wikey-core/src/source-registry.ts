/**
 * source-registry.ts — Phase 4.2 Stage 1 S1-2 (plan v3) + §5.3.1/§5.3.2 extension (plan v11).
 *
 * `.wikey/source-registry.json` 의 in-memory 표현 + CRUD.
 * 이동 무관 불변 key = source_id. vault_path 는 파생 필드.
 *
 * §5.3.1/§5.3.2 sidecar_hash invariant (★ plan v11 P1-2 단일 규칙):
 *   sidecar_hash 는 canonical sidecar `<sourcePath>.md` 가 (re)write 된 직후에만 갱신.
 *   protect 분기에서 `<sourcePath>.md.new` 로 저장 시 sidecar_hash 미갱신, 대신 pending_protections 에 추가.
 *   skip-with-seed 분기에서는 disk sidecar = 새 baseline 으로 인정하여 갱신 (예외 단일).
 */

import type { WikiFS } from './types.js'
import { verifyFullHash, computeFullHash } from './uri.js'

export const REGISTRY_PATH = '.wikey/source-registry.json'

export interface PathHistoryEntry {
  readonly vault_path: string
  readonly at: string // ISO 8601
}

/**
 * §5.3.1/§5.3.2 — decideReingest 가 결정한 action 종류. 진단·UI 용.
 *   - skip            : raw bytes 동일, sidecar_hash 일치 → LLM/page write 0
 *   - skip-with-seed  : legacy (sidecar_hash 미존재) 첫 hash-match → sidecar_hash 만 채움
 *   - force           : raw bytes 변경, conflicts 없음 → 정상 재인제스트
 *   - protect         : raw bytes 변경 + conflicts 발생 → sidecar `.md.new` / source page user marker 보호
 *   - prompt          : conflicts 발생 + onConflict 제공 → UI modal 응답에 따라 분기
 */
export type ReingestAction = 'skip' | 'skip-with-seed' | 'force' | 'protect' | 'prompt'

/**
 * §5.3.1/§5.3.2 — conflict 종류. decideReingest 가 collect 후 phase B 에서 action 결정.
 *   - sidecar-user-edit         : disk sidecar bytes != registry.sidecar_hash (시나리오 A/F)
 *   - source-page-user-edit     : wiki/sources/source-*.md 본문에 USER_MARKER (## 사용자 메모 등) 존재 (시나리오 D)
 *   - duplicate-hash            : 같은 hash 가 다른 path 에서 등록됨 (시나리오 E)
 *   - orphan-sidecar            : sidecar 만 남고 원본 부재 — audit 단계에서만 검출 (decideReingest 미진입)
 *   - legacy-no-sidecar-hash    : registry hash != raw hash + sidecar_hash 미존재 + disk sidecar 존재 → 보수적 protect
 *   - unmanaged-paired-sidecar  : R == null (registry 미등록) + disk sidecar 존재 → 사용자가 미리 만들어 둔
 *                                 paired sidecar (docling 사전 변환 등) 가 첫 ingest 시 silent overwrite 되는
 *                                 GAP. plan v11 follow-up #10 (PMS 실 ingest 분석에서 도출).
 */
export type ConflictKind =
  | 'sidecar-user-edit'
  | 'source-page-user-edit'
  | 'duplicate-hash'
  | 'orphan-sidecar'
  | 'legacy-no-sidecar-hash'
  | 'unmanaged-paired-sidecar'

/**
 * §5.3.1/§5.3.2 — protect 분기에서 발생한 pending 산출물.
 * `<sourcePath>.md.new[.1~.9]` 로 저장된 새 sidecar 본문. 사용자가 검토 후 canonical 로 promote
 * 또는 삭제할 때까지 audit/UI 추적 대상. 자동 cleanup 은 §5.3 후속 follow-up.
 */
export interface PendingProtection {
  readonly kind: 'sidecar-md-new'
  readonly path: string
  readonly created_at: string // ISO 8601
  readonly conflict: ConflictKind
}

export interface SourceRecord {
  // ── 기존 필드 ──
  readonly vault_path: string
  readonly sidecar_vault_path?: string
  readonly hash: string // full sha256 hex (raw disk bytes)
  readonly size: number
  readonly first_seen: string
  readonly ingested_pages: readonly string[]
  readonly path_history: readonly PathHistoryEntry[]
  readonly tombstone: boolean

  // ── §5.3.1/§5.3.2 신규 (모두 optional, backwards compat) ──
  readonly sidecar_hash?: string                           // sha256(NFC(sidecar body)) at last canonical write
  readonly reingested_at?: readonly string[]               // ISO timestamps (first_seen 이후)
  readonly last_action?: ReingestAction                    // 직전 결정 결과 (진단용)
  readonly pending_protections?: readonly PendingProtection[]
  readonly duplicate_locations?: readonly string[]         // 같은 hash 사용자 복사본 (canonical 제외, path_history 와 분리)
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

// ─────────────────────────────────────────────────────────────────────────────
// §5.3.1/§5.3.2 — incremental reingest helpers (plan v11)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * §5.3.2 — discriminated option for sidecar handling on move.
 *   - preserve : keep existing.sidecar_vault_path (default; movePair skip 분기)
 *   - clear    : set to undefined (rare — orphan 제거 시)
 *   - set      : assign new path (movePair rename 분기)
 */
export type SidecarMoveOption =
  | { kind: 'preserve' }
  | { kind: 'clear' }
  | { kind: 'set'; path: string }

/**
 * §5.3.2 — atomic move that updates vault_path AND sidecar_vault_path together.
 * Mirrors recordMove (clears tombstone, appends path_history) and adds discriminated
 * sidecar handling so callers cannot accidentally drop or null the sidecar path.
 */
export function recordMoveWithSidecar(
  reg: SourceRegistry,
  id: string,
  newVaultPath: string,
  sidecar: SidecarMoveOption,
): SourceRegistry {
  const existing = reg[id]
  if (!existing) return reg
  const at = new Date().toISOString()
  const nextHistory: readonly PathHistoryEntry[] = [
    ...existing.path_history,
    { vault_path: newVaultPath, at },
  ]
  let nextSidecar: string | undefined
  if (sidecar.kind === 'preserve') nextSidecar = existing.sidecar_vault_path
  else if (sidecar.kind === 'clear') nextSidecar = undefined
  else nextSidecar = sidecar.path
  const next: SourceRecord = {
    ...existing,
    vault_path: newVaultPath,
    sidecar_vault_path: nextSidecar,
    path_history: nextHistory,
    tombstone: false,
  }
  return { ...reg, [id]: next }
}

/**
 * §5.3.1 — append a pending_protections entry.
 * Used when canonical sidecar `<sourcePath>.md` is left untouched and a new body
 * is written to `<sourcePath>.md.new[.N]` instead.
 */
export function appendPendingProtection(
  reg: SourceRegistry,
  id: string,
  entry: PendingProtection,
): SourceRegistry {
  const existing = reg[id]
  if (!existing) return reg
  const prev = existing.pending_protections ?? []
  const next: SourceRecord = {
    ...existing,
    pending_protections: [...prev, entry],
  }
  return { ...reg, [id]: next }
}

/**
 * §5.3.1 — remove the pending_protections entry whose path matches.
 * Used when user resolves the protect (promote `.md.new` to canonical or deletes it).
 */
export function clearPendingProtection(
  reg: SourceRegistry,
  id: string,
  path: string,
): SourceRegistry {
  const existing = reg[id]
  if (!existing) return reg
  const prev = existing.pending_protections ?? []
  const filtered = prev.filter((p) => p.path !== path)
  if (filtered.length === prev.length) return reg
  const next: SourceRecord = {
    ...existing,
    pending_protections: filtered,
  }
  return { ...reg, [id]: next }
}

/**
 * §5.3.2 — append a duplicate-hash location (idempotent).
 * canonical vault_path 는 보존. duplicate_locations 는 path_history 와 분리되어
 * findByPath / reconcile 의 identity lookup 의미를 유지한다.
 */
export function appendDuplicateLocation(
  reg: SourceRegistry,
  id: string,
  duplicatePath: string,
): SourceRegistry {
  const existing = reg[id]
  if (!existing) return reg
  if (duplicatePath === existing.vault_path) return reg // canonical 자체 — append 안 함
  const prev = existing.duplicate_locations ?? []
  if (prev.includes(duplicatePath)) return reg // 멱등
  const next: SourceRecord = {
    ...existing,
    duplicate_locations: [...prev, duplicatePath],
  }
  return { ...reg, [id]: next }
}

export interface WalkerEntry {
  readonly vault_path: string
  readonly bytes: Uint8Array
}

/**
 * Startup reconciliation — compare registry vault_path against actual fs walker.
 *
 * Behavior (Phase 4.2 Stage 4 S4-3 + §5.3.1 duplicate-aware, plan v11):
 *   1. record.vault_path matches a walker entry with same full-hash → no change.
 *   2. hash matches a walker entry at a DIFFERENT path → recordMove (bash/Finder move).
 *   3. record.hash absent from walker → tombstone (bash/Finder delete).
 *   4. tombstoned record's hash appears in walker → restoreTombstone (+ recordMove if path differs).
 *   5. (★ §5.3.1) same hash at MULTIPLE walker paths (user copy):
 *        - canonical preserved if record.vault_path appears in walker (regardless of order).
 *        - if canonical missing but a path in record.duplicate_locations exists → promote it
 *          to canonical, removing it from duplicate_locations.
 *        - if canonical missing and no duplicate registered → first walker path becomes
 *          new canonical (recordMove).
 *      duplicate_locations entries are NEVER moved into path_history (identity lookup intact).
 */
export async function reconcile(
  reg: SourceRegistry,
  walker: () => Promise<readonly WalkerEntry[]>,
): Promise<SourceRegistry> {
  const entries = await walker()
  // Map<fullHash, paths[]> — same hash may appear at multiple paths (duplicate copies).
  const hashMap = new Map<string, string[]>()
  for (const e of entries) {
    const h = computeFullHash(e.bytes)
    const list = hashMap.get(h)
    if (list) list.push(e.vault_path)
    else hashMap.set(h, [e.vault_path])
  }

  let next: SourceRegistry = reg
  for (const [id, record] of Object.entries(reg)) {
    const matchedPaths = hashMap.get(record.hash) ?? []
    const dupSet = new Set(record.duplicate_locations ?? [])

    if (record.tombstone) {
      if (matchedPaths.length > 0) {
        // Resurrect the record. Pick canonical:
        //   1) record.vault_path if present (move-back),
        //   2) first non-duplicate path,
        //   3) fallback to first walker entry.
        const candidate =
          matchedPaths.find((p) => p === record.vault_path) ??
          matchedPaths.find((p) => !dupSet.has(p)) ??
          matchedPaths[0]!
        next = restoreTombstone(next, id)
        if (candidate !== record.vault_path) {
          const newSidecar = record.sidecar_vault_path ? `${candidate}.md` : undefined
          next = recordMove(next, id, candidate, newSidecar)
        }
      }
      continue
    }

    if (matchedPaths.length === 0) {
      // Not tombstoned and not present in walker → mark deleted.
      next = recordDelete(next, id)
      continue
    }

    // canonical preservation: if record.vault_path appears in walker → no move.
    if (matchedPaths.includes(record.vault_path)) {
      continue
    }

    // canonical missing — promote a duplicate path or the first walker entry.
    const promoted =
      matchedPaths.find((p) => dupSet.has(p)) ?? matchedPaths[0]!
    const newSidecar = record.sidecar_vault_path ? `${promoted}.md` : undefined
    next = recordMove(next, id, promoted, newSidecar)
    // If promoted came from duplicate_locations, remove it (it became canonical).
    if (dupSet.has(promoted)) {
      const cur = next[id]!
      const filtered = (cur.duplicate_locations ?? []).filter((p) => p !== promoted)
      next = { ...next, [id]: { ...cur, duplicate_locations: filtered } }
    }
  }
  return next
}
