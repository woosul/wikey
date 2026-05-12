/**
 * §5.19 Wiki maintenance — shared pure helpers.
 *
 * Used by status / check / recovery / refactoring modules. No I/O side effects
 * beyond `WikiFS` reads (registry / pages). All exports are internal to the
 * `maintenance/` barrel — not part of `wikey-core` public surface.
 */

import type { WikiFS } from '../../types.js'
import { REGISTRY_PATH, type SourceRegistry, type WalkerEntry } from '../../source-registry.js'

/**
 * sha256:<16hex> → keep first 8 hex chars for body `[[source-...]]` matching.
 * Magic constants `7` (skip `sha256:` prefix) + `15` (8 hex chars) made explicit.
 */
export const SHA256_HASH_PREFIX = 'sha256:'
export const SHA256_PREFIX_LENGTH = 8

// wiki/ housekeeping pages — kept in `pageCount` (Spec AC-S1-1 = wiki/<all>.md
// total) but excluded from orphan / broken-link / dangling page-level scans
// (index/log are skeletons, not knowledge pages). Two list helpers reflect this.
const HOUSEKEEPING_PAGES = new Set(['wiki/index.md', 'wiki/log.md'])

/**
 * List every markdown page under `wiki/`. Spec §5.19 AC-S1-1: `pageCount` =
 * total markdown files under wiki/ (housekeeping included — `index.md` /
 * `log.md` are real `.md` files in the vault and the schema considers them
 * part of the wiki).
 */
export async function listAllWikiPages(fs: WikiFS): Promise<readonly string[]> {
  // §5.19 Step G fix — `walk` (recursive) instead of `list` (children-only).
  // Production `ObsidianWikiFS.list('wiki/')` returns top-level entries only
  // (`wiki/index.md`, `wiki/log.md`, plus the four sub-folders) → category
  // pages under `wiki/entities/…` etc were missed against real vaults.
  const all = await fs.walk('wiki')
  const out: string[] = []
  for (const p of all) {
    if (!p.endsWith('.md')) continue
    out.push(p)
  }
  return out.sort()
}

/**
 * List wiki pages **excluding housekeeping** (`wiki/index.md`, `wiki/log.md`).
 * Used by orphan / broken-link / dangling scans where index/log skeletons would
 * skew counts (index linking to every entity, log being append-only history).
 */
export async function listWikiPages(fs: WikiFS): Promise<readonly string[]> {
  // §5.19 Step G fix — see `listAllWikiPages` note. `walk` recurses into
  // entities/concepts/sources/analyses sub-folders.
  const all = await fs.walk('wiki')
  const out: string[] = []
  for (const p of all) {
    if (!p.endsWith('.md')) continue
    if (HOUSEKEEPING_PAGES.has(p)) continue
    out.push(p)
  }
  return out.sort()
}

export function pageSlugFromPath(path: string): string {
  // wiki/entities/foo.md → foo
  const m = path.match(/\/([^/]+)\.md$/)
  return m ? m[1]! : path
}

export function categoryOf(path: string): string | null {
  const m = path.match(/^wiki\/(entities|concepts|sources|analyses)\//)
  return m ? m[1]! : null
}

const WIKILINK_RE = /\[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/g

export function extractWikilinks(body: string): readonly string[] {
  const stripped = stripFrontmatter(body)
  const out: string[] = []
  let m: RegExpExecArray | null
  WIKILINK_RE.lastIndex = 0
  while ((m = WIKILINK_RE.exec(stripped)) !== null) {
    out.push(m[1]!.trim())
  }
  return out
}

export function stripFrontmatter(body: string): string {
  if (!body.startsWith('---')) return body
  const end = body.indexOf('\n---', 3)
  if (end < 0) return body
  return body.slice(end + 4)
}

export function extractFrontmatter(body: string): string | null {
  if (!body.startsWith('---')) return null
  const end = body.indexOf('\n---', 3)
  if (end < 0) return null
  return body.slice(3, end)
}

/**
 * Extract all sha256 source identifiers referenced from a page's frontmatter.
 *
 * Two shapes are supported because the §4.3.2 provenance migration introduced
 * a YAML block form while keeping the legacy inline list:
 *   1. Legacy inline: `sources: [sha256:abcdef…, sha256:other…]` (also accepts
 *      filename entries — those are filtered out as they are not sha refs).
 *   2. Provenance block (§4.3.2 Part A):
 *        provenance:
 *          - type: extracted
 *            ref: sources/sha256:679cf2dd6db75e3a
 *      The 38-page live vault (`sha256:679cf2dd6db75e3a` case A, §5.18) uses
 *      this shape — without parsing it `danglingCrossLinkCount` mis-counts.
 *
 * Returns all distinct `sha256:<hex>` identifiers in declaration order.
 */
export function extractFrontmatterSources(body: string): readonly string[] {
  const fm = extractFrontmatter(body)
  if (!fm) return []
  const seen = new Set<string>()
  const out: string[] = []

  const pushSha = (raw: string): void => {
    const bare = raw.trim().replace(/^['"]|['"]$/g, '')
    if (!bare.startsWith('sha256:')) return
    if (seen.has(bare)) return
    seen.add(bare)
    out.push(bare)
  }

  // Legacy `sources: [...]` inline list.
  const inline = fm.match(/^sources:\s*\[([^\]]*)\]/m)
  if (inline) {
    for (const item of inline[1]!.split(',')) pushSha(item)
  }

  // Provenance block `ref: sources/sha256:<hex>` (also handles bare `sha256:` refs).
  const REF_RE = /(?:^|[\s/'"])sources\/(sha256:[A-Za-z0-9]+)/g
  let m: RegExpExecArray | null
  while ((m = REF_RE.exec(fm)) !== null) pushSha(m[1]!)

  return out
}

export function extractFrontmatterUpdated(body: string): string | null {
  const fm = extractFrontmatter(body)
  if (!fm) return null
  const m = fm.match(/^updated:\s*(.+)$/m)
  if (!m) return null
  return m[1]!.trim()
}

export function frontmatterHasDanglingSource(
  body: string,
  registryShas: ReadonlySet<string>,
): boolean {
  for (const sha of extractFrontmatterSources(body)) {
    if (!registryShas.has(sha)) return true
  }
  return false
}

/**
 * Detect dangling cross-links (frontmatter `sources:` referencing sha not in registry).
 * Spec §5.18 — first real use case = `sha256:679cf2dd6db75e3a` 38-page batch.
 */
export interface DanglingCrossLink {
  readonly path: string
  readonly sha: string
}

export async function detectDanglingCrossLinks(
  fs: WikiFS,
  pages: readonly string[],
  registryShas: ReadonlySet<string>,
  signal?: AbortSignal,
): Promise<readonly DanglingCrossLink[]> {
  const out: DanglingCrossLink[] = []
  for (const path of pages) {
    throwIfAborted(signal)
    const body = await fs.read(path)
    for (const sha of extractFrontmatterSources(body)) {
      if (!registryShas.has(sha)) out.push({ path, sha })
    }
  }
  return out
}

export async function loadRegistrySafe(fs: WikiFS): Promise<SourceRegistry> {
  if (!(await fs.exists(REGISTRY_PATH))) return {}
  try {
    return JSON.parse(await fs.read(REGISTRY_PATH)) as SourceRegistry
  } catch {
    return {}
  }
}

export async function readValidateTs(fs: WikiFS): Promise<string | null> {
  const tsPath = '.wikey/last-validate.txt'
  if (!(await fs.exists(tsPath))) return null
  return (await fs.read(tsPath)).trim() || null
}

export function buildRawWalker(
  fs: WikiFS,
  signal?: AbortSignal,
): () => Promise<readonly WalkerEntry[]> {
  return async () => {
    // §5.19 Step G fix — `walk('raw')` recurses into PARA sub-folders
    // (1_projects/, 2_areas/, 3_resources/, 4_archives/, inbox/). Note: this
    // returns `.md` files only — non-md raw sources (PDF / docx / pptx) are
    // surfaced via a different code path (registry walker proper) and were
    // never the `.list` consumer here. AC-S1-1 fixtures all use `.md` raw
    // sources so this matches existing test contracts.
    const all = await fs.walk('raw')
    const out: WalkerEntry[] = []
    for (const p of all) {
      throwIfAborted(signal)
      try {
        const body = await fs.read(p)
        out.push({ vault_path: p, bytes: new TextEncoder().encode(body) })
      } catch {
        // not a regular readable file — skip
      }
    }
    return out
  }
}

/**
 * AbortSignal cooperative cancellation. Long-running core helpers (status /
 * check / recovery) poll at coarse loop boundaries (per-page) and throw an
 * AbortError so `MaintenanceModal.dispatchMode()` catch-by-name short-circuits.
 */
export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return
  const err: Error & { name: string } = new Error('AbortError')
  err.name = 'AbortError'
  throw err
}

/**
 * Path-based stale-tombstone candidate sweep. Returns ids whose record is
 * tombstoned but whose `vault_path` still exists on disk. Used by both the
 * status (lightweight signal) and check (wider net alongside hash-based
 * `findRestoredIds`) flows. Kept lightweight to stay under the 5s status
 * latency budget (Spec 1 I2).
 */
export async function detectStaleTombstones(
  fs: WikiFS,
  registry: SourceRegistry,
  signal?: AbortSignal,
): Promise<readonly string[]> {
  const out: string[] = []
  for (const [id, record] of Object.entries(registry)) {
    throwIfAborted(signal)
    if (!record.tombstone) continue
    if (await fs.exists(record.vault_path)) out.push(id)
  }
  return out
}
