/**
 * vault-events.ts — Phase 4.2 Stage 4 S4-1/S4-2.
 *
 * Obsidian `vault.on('rename')` / `vault.on('delete')` 가 호출할 "순수" 헬퍼.
 * Obsidian API 에 의존하지 않고 WikiFS + source-registry + wiki-ops 만 사용 →
 * vitest 에서 단위 테스트 가능. main.ts 는 Obsidian 이벤트를 받아 이 헬퍼를 invoke.
 *
 * 설계 포인트:
 *   - RenameGuard: movePair 가 발행 예정 경로를 pre-register → 리스너 skip (double-move 방지)
 *   - reconcileExternalRename: 사용자가 Obsidian UI 에서 직접 이동한 경우 registry/frontmatter 갱신
 *   - handleExternalDelete: 사용자가 raw/ 원본을 삭제한 경우 tombstone + source 페이지 banner
 *
 * §4.2 핵심 불변성 (2026-04-23 사용자 확인):
 *   "원본 파일이 이동해도 다른 wiki 페이지의 wikilink 는 업데이트 없이 유지"
 *   → reconcileExternalRename 은 source 페이지 frontmatter `vault_path` 만 갱신.
 *   entity/concept/analyses 의 [[source-xxx]] wikilink 는 건드리지 않는다.
 */

import type { WikiFS } from './types.js'
import {
  loadRegistry,
  saveRegistry,
  findByPath as registryFindByPath,
  recordMove as registryRecordMove,
  recordDelete as registryRecordDelete,
} from './source-registry.js'
import { rewriteSourcePageMeta, appendDeletedSourceBanner } from './wiki-ops.js'

// ─────────────────────────────────────────────────────────────
//  RenameGuard — movePair 와 리스너 간 큐 프로토콜
// ─────────────────────────────────────────────────────────────

/**
 * movePair 가 fs.rename 을 호출하기 직전 newPath 를 `register` 해둔다.
 * Obsidian vault.on('rename') 리스너는 이벤트 경로를 `consume` —
 * 매칭되면 (= movePair 가 발생시킨 이벤트) skip, 아니면 사용자 직접 이동으로 처리.
 * TTL: 기본 5초 (movePair 후 debounce-window 내에서만 유효).
 */
export class RenameGuard {
  private readonly entries = new Map<string, number>() // path → expiry ms
  private readonly defaultTtlMs: number
  private readonly now: () => number

  constructor(now: () => number = () => Date.now(), defaultTtlMs = 5000) {
    this.now = now
    this.defaultTtlMs = defaultTtlMs
  }

  register(path: string, ttlMs?: number): void {
    const expiry = this.now() + (ttlMs ?? this.defaultTtlMs)
    this.entries.set(path, expiry)
    this.purgeExpired()
  }

  consume(path: string): boolean {
    this.purgeExpired()
    const expiry = this.entries.get(path)
    if (expiry == null) return false
    this.entries.delete(path)
    return expiry >= this.now()
  }

  size(): number {
    this.purgeExpired()
    return this.entries.size
  }

  private purgeExpired(): void {
    const t = this.now()
    for (const [p, exp] of this.entries) {
      if (exp < t) this.entries.delete(p)
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  reconcileExternalRename — UI 이동 이벤트 처리
// ─────────────────────────────────────────────────────────────

export interface ReconcileRenameResult {
  readonly sourceId?: string
  readonly rewrittenPages: readonly string[]
}

export interface ReconcileRenameOptions {
  readonly wikiFS: WikiFS
  readonly oldVaultPath: string
  readonly newVaultPath: string
  readonly newSidecarVaultPath?: string
}

export async function reconcileExternalRename(
  opts: ReconcileRenameOptions,
): Promise<ReconcileRenameResult> {
  const reg = await loadRegistry(opts.wikiFS)
  const lookup = registryFindByPath(reg, opts.oldVaultPath)
  if (!lookup) return { rewrittenPages: [] }

  const sidecar = opts.newSidecarVaultPath ?? lookup.record.sidecar_vault_path
  const updated = registryRecordMove(reg, lookup.id, opts.newVaultPath, sidecar)

  const rewritten: string[] = []
  for (const pagePath of lookup.record.ingested_pages) {
    try {
      if (!(await opts.wikiFS.exists(pagePath))) continue
      const content = await opts.wikiFS.read(pagePath)
      const next = rewriteSourcePageMeta(content, {
        vault_path: opts.newVaultPath,
        sidecar_vault_path: sidecar ?? null,
      })
      if (next !== content) await opts.wikiFS.write(pagePath, next)
      rewritten.push(pagePath)
    } catch (err) {
      console.warn(
        `[vault-events.reconcileExternalRename] rewrite failed ${pagePath}: ${(err as Error).message}`,
      )
    }
  }

  await saveRegistry(opts.wikiFS, updated)
  return { sourceId: lookup.id, rewrittenPages: rewritten }
}

// ─────────────────────────────────────────────────────────────
//  handleExternalDelete — UI 삭제 이벤트 처리
// ─────────────────────────────────────────────────────────────

export interface HandleDeleteResult {
  readonly sourceId?: string
  readonly bannersAdded: readonly string[]
}

export interface HandleDeleteOptions {
  readonly wikiFS: WikiFS
  readonly deletedVaultPath: string
  readonly at: string // 'YYYY-MM-DD'
}

export async function handleExternalDelete(
  opts: HandleDeleteOptions,
): Promise<HandleDeleteResult> {
  const reg = await loadRegistry(opts.wikiFS)
  const lookup = registryFindByPath(reg, opts.deletedVaultPath)
  if (!lookup) return { bannersAdded: [] }

  const updated = registryRecordDelete(reg, lookup.id)

  const added: string[] = []
  for (const pagePath of lookup.record.ingested_pages) {
    try {
      const didAppend = await appendDeletedSourceBanner(opts.wikiFS, pagePath, opts.at)
      if (didAppend) added.push(pagePath)
    } catch (err) {
      console.warn(
        `[vault-events.handleExternalDelete] banner append failed ${pagePath}: ${(err as Error).message}`,
      )
    }
  }

  await saveRegistry(opts.wikiFS, updated)
  return { sourceId: lookup.id, bannersAdded: added }
}
