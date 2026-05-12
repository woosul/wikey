/**
 * §5.19 Spec 1 — wiki-status.
 *
 * Read-only health summary with 5min TTL in-memory cache. Invariants:
 *   I1 — wiki/ + registry 변경 0.
 *   I2 — cold ≤ 5s / hit ≤ 50ms.
 *   I3 — 5min cache TTL keyed by WikiFS instance.
 */

import type { WikiFS } from '../../types.js'
import { findRestoredIds } from '../../source-registry.js'
import {
  buildRawWalker,
  categoryOf,
  extractFrontmatterSources,
  extractWikilinks,
  frontmatterHasDanglingSource,
  listAllWikiPages,
  listWikiPages,
  loadRegistrySafe,
  pageSlugFromPath,
  readValidateTs,
  throwIfAborted,
} from './helpers.js'

export interface WikiStatus {
  readonly pageCount: number
  readonly orphanCount: number
  readonly brokenLinkCount: number
  readonly staleTombstoneCount: number
  readonly danglingCrossLinkCount: number
  readonly lastValidateTs: string | null
}

interface CacheEntry {
  readonly status: WikiStatus
  readonly ts: number
}

const CACHE_TTL_MS = 5 * 60 * 1000
const statusCache = new WeakMap<WikiFS, CacheEntry>()

export interface GetWikiStatusOptions {
  readonly forceRefresh?: boolean
  /**
   * Optional AbortSignal propagated from the caller (MaintenanceModal close
   * fires AbortController.abort()). Checked at coarse loop boundaries — page
   * reads run in N hundreds, so a single `signal.aborted` check per page is
   * sufficient for sub-second responsiveness without ballooning hot loops.
   */
  readonly signal?: AbortSignal
}

export async function getWikiStatus(
  fs: WikiFS,
  opts: GetWikiStatusOptions = {},
): Promise<WikiStatus> {
  const now = Date.now()
  if (!opts.forceRefresh) {
    const hit = statusCache.get(fs)
    if (hit && now - hit.ts < CACHE_TTL_MS) return hit.status
  }
  const status = await computeWikiStatus(fs, opts.signal)
  statusCache.set(fs, { status, ts: now })
  return status
}

async function computeWikiStatus(fs: WikiFS, signal?: AbortSignal): Promise<WikiStatus> {
  // AC-S1-1 — `pageCount` = `wiki/**/*.md` total (housekeeping included).
  // Other scans (orphan / broken / dangling) exclude housekeeping skeletons
  // so they don't skew counts.
  const allPages = await listAllWikiPages(fs)
  const pages = await listWikiPages(fs)
  const pageSet = new Set(pages.map(pageSlugFromPath))
  const inboundCount = await countInboundLinks(fs, pages, signal)
  const registry = await loadRegistrySafe(fs)
  const registryShas = new Set(Object.keys(registry))

  let orphanCount = 0
  let brokenLinkCount = 0
  let danglingCrossLinkCount = 0
  for (const path of pages) {
    throwIfAborted(signal)
    const body = await fs.read(path)
    if (isOrphanPage(path, body, inboundCount)) orphanCount++
    for (const link of extractWikilinks(body)) {
      if (!pageSet.has(link)) brokenLinkCount++
    }
    if (frontmatterHasDanglingSource(body, registryShas)) {
      danglingCrossLinkCount++
    }
  }

  // AC-S1-1 — staleTombstoneCount = `findRestoredIds(registry, walker).length`
  // (Spec I5 — hash-equality detect via the same helper Spec 2 uses). This
  // replaces the earlier path-existence sweep so status / check agree 1:1.
  throwIfAborted(signal)
  const walker = buildRawWalker(fs, signal)
  const staleTombstoneIds = await findRestoredIds(registry, walker)
  const lastValidateTs = await readValidateTs(fs)

  return {
    pageCount: allPages.length,
    orphanCount,
    brokenLinkCount,
    staleTombstoneCount: staleTombstoneIds.length,
    danglingCrossLinkCount,
    lastValidateTs,
  }
}

async function countInboundLinks(
  fs: WikiFS,
  pages: readonly string[],
  signal?: AbortSignal,
): Promise<ReadonlyMap<string, number>> {
  const inbound = new Map<string, number>()
  for (const path of pages) {
    throwIfAborted(signal)
    const body = await fs.read(path)
    for (const link of extractWikilinks(body)) {
      inbound.set(link, (inbound.get(link) ?? 0) + 1)
    }
  }
  return inbound
}

/**
 * Orphan = page in entities/ or concepts/ AND inbound link == 0 AND frontmatter
 * `sources:` is empty/absent. Sources/analyses are excluded from orphan checks
 * (sources are leaf-by-design; analyses are append-only synthesis). Pages whose
 * `sources:` lists *any* sha — even dangling — were created from a source ingest,
 * so they are not considered orphans (separate dangling cross-link metric covers them).
 */
function isOrphanPage(
  path: string,
  body: string,
  inboundCount: ReadonlyMap<string, number>,
): boolean {
  const cat = categoryOf(path)
  if (cat !== 'entities' && cat !== 'concepts') return false
  const slug = pageSlugFromPath(path)
  if ((inboundCount.get(slug) ?? 0) > 0) return false
  return extractFrontmatterSources(body).length === 0
}

/** Test helper — clear in-memory cache. */
export function __resetWikiStatusCacheForTest(): void {
  // WeakMap has no clear(); rely on GC. For test isolation, callers should pass a fresh fs.
}
