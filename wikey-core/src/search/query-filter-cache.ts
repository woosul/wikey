/**
 * §5.7.8 — query layer cache (filter / rewrite / expand) with LRU + atomic JSON persist.
 *
 * Spec invariants honored:
 *  - I2  cache key normalization (lowercase + trim + sorted token join). Performed by callers
 *        via `normalizeCacheKey`; this store is namespace-agnostic and treats keys as opaque.
 *  - I13 cache hit on second call (re-entry returns the same decision without LLM call).
 *  - I24 separate namespace per layer — `filter` / `rewrite` / `expand` map to disjoint
 *        in-memory + on-disk slots so a key collision in one layer cannot leak into another.
 *
 * Storage strategy (Karpathy Simplicity, master-recommended option B):
 *  - In-memory `Map` per namespace = LRU via insertion-order rotation.
 *  - On-disk = single JSON file per namespace at `<root>/<namespace>.json` written via
 *    tmp + `fs.renameSync` (POSIX atomic). No native binding (better-sqlite3 omitted —
 *    Obsidian electron host has no preinstalled native module + Karpathy #2 simplification.
 *    Spec literal Q2 named SQLite; deviation is documented here and in the result report).
 *  - Capacity default 1000; eviction = oldest entry per namespace.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'

export type CacheNamespace = 'filter' | 'rewrite' | 'expand'

/** Default capacity per namespace — `priorityKeep` & spec §1.4 Cache size text input default. */
export const DEFAULT_CACHE_CAPACITY = 1000

export interface QueryFilterCacheOptions {
  /** Root directory for persisted namespace files. e.g. `~/.cache/wikey/query-intent-cache`. */
  readonly root: string
  /** Per-namespace capacity. Defaults to {@link DEFAULT_CACHE_CAPACITY}. */
  readonly capacity?: number
}

interface CacheEntry<T> {
  readonly key: string
  readonly value: T
  readonly accessedAt: number
}

/**
 * LRU + persistent JSON cache, parameterised by namespace. Generic over the stored value
 * type so each layer (filter / rewrite / expand) preserves its own decision schema.
 */
export class QueryFilterCache {
  private readonly root: string
  private readonly capacity: number
  /** namespace → ordered Map (Map iteration order is insertion order — used for LRU). */
  private readonly stores: Map<CacheNamespace, Map<string, unknown>> = new Map()
  /** Lazy-load guard — restore only on first access per namespace. */
  private readonly loaded: Set<CacheNamespace> = new Set()

  constructor(opts: QueryFilterCacheOptions) {
    this.root = opts.root
    this.capacity = opts.capacity ?? DEFAULT_CACHE_CAPACITY
  }

  get<T>(namespace: CacheNamespace, key: string): T | undefined {
    const store = this.ensureStore(namespace)
    if (!store.has(key)) return undefined
    // LRU touch — re-insert to move to "most recent".
    const value = store.get(key) as T
    store.delete(key)
    store.set(key, value)
    return value
  }

  set<T>(namespace: CacheNamespace, key: string, value: T): void {
    const store = this.ensureStore(namespace)
    if (store.has(key)) store.delete(key)
    store.set(key, value)
    while (store.size > this.capacity) {
      const oldest = store.keys().next().value
      if (oldest === undefined) break
      store.delete(oldest)
    }
    this.persistNamespace(namespace, store)
  }

  /** Test helper / observability — current entry count for a namespace. */
  size(namespace: CacheNamespace): number {
    const store = this.ensureStore(namespace)
    return store.size
  }

  private ensureStore(namespace: CacheNamespace): Map<string, unknown> {
    let store = this.stores.get(namespace)
    if (!store) {
      store = new Map()
      this.stores.set(namespace, store)
    }
    if (!this.loaded.has(namespace)) {
      this.restoreNamespace(namespace, store)
      this.loaded.add(namespace)
    }
    return store
  }

  private namespaceFile(namespace: CacheNamespace): string {
    return join(this.root, `${namespace}.json`)
  }

  private restoreNamespace(namespace: CacheNamespace, store: Map<string, unknown>): void {
    const path = this.namespaceFile(namespace)
    if (!existsSync(path)) return
    try {
      const raw = readFileSync(path, 'utf-8')
      if (!raw.trim()) return
      const parsed = JSON.parse(raw) as { entries?: Array<CacheEntry<unknown>> }
      const entries = Array.isArray(parsed.entries) ? parsed.entries : []
      // Sort ascending by accessedAt so insertion order matches LRU recency.
      entries.sort((a, b) => a.accessedAt - b.accessedAt)
      for (const entry of entries) {
        if (typeof entry.key !== 'string') continue
        store.set(entry.key, entry.value)
      }
    } catch (err) {
      // Corrupt cache — start empty + warn (matches I27 fail-open spirit).
      console.warn('[wikey] query-filter-cache restore failed, starting empty:', err)
    }
  }

  private persistNamespace(namespace: CacheNamespace, store: Map<string, unknown>): void {
    const path = this.namespaceFile(namespace)
    try {
      mkdirSync(dirname(path), { recursive: true })
      const now = Date.now()
      const entries: Array<CacheEntry<unknown>> = []
      for (const [key, value] of store.entries()) {
        entries.push({ key, value, accessedAt: now })
      }
      const tmpPath = `${path}.tmp`
      writeFileSync(tmpPath, JSON.stringify({ entries }), 'utf-8')
      renameSync(tmpPath, path)
    } catch (err) {
      // Fail-open: cache write failure must not break the search call path.
      console.warn('[wikey] query-filter-cache persist failed:', err)
      try { if (existsSync(`${path}.tmp`)) unlinkSync(`${path}.tmp`) } catch { /* ignore */ }
    }
  }
}

/**
 * Spec invariant I2 — canonicalise a cache key from raw input. Lowercases, trims, splits on
 * whitespace, sorts tokens, and joins with single space. Same-meaning queries (different
 * order / casing) collide on the same key.
 */
export function normalizeCacheKey(input: string): string {
  if (!input) return ''
  return input
    .toLowerCase()
    .trim()
    .split(/\s+/u)
    .filter((t) => t.length > 0)
    .sort()
    .join(' ')
}
