/**
 * §5.19 — shared `MaintenanceRunner` factory used by both the Help panel entry
 * (sidebar-chat.ts) and the palette commands (commands.ts). Wires the modal's
 * AbortController.signal into every wikey-core call (Finding 4 cycle #3) plus
 * a `validateWiki` injection so `runWikiCheck` actually exercises validate-wiki
 * findings (Finding 1: HIGH — Help panel runner previously dropped the
 * injection and check.ts:69 silently skipped that branch).
 *
 * The runner lazy-requires `wikey-core` so test contexts (jest jsdom) without
 * the bundled core silently no-op each method.
 */

import type WikeyPlugin from './main'
import type { MaintenanceRunner } from './maintenance-modal'

interface CoreApi {
  getWikiStatus?: (
    wikiFS: unknown,
    opts?: { forceRefresh?: boolean; signal?: AbortSignal },
  ) => Promise<Record<string, unknown>>
  runWikiCheck?: (
    wikiFS: unknown,
    opts?: {
      validateWiki?: (signal?: AbortSignal) => Promise<{ exitCode: number; findings: readonly unknown[] }>
      signal?: AbortSignal
    },
  ) => Promise<{ findings: readonly { kind: string; path?: string; detail?: string }[] }>
  applyWikiRecovery?: (
    wikiFS: unknown,
    opts: { confirm: boolean; danglingShas?: readonly string[]; signal?: AbortSignal },
  ) => Promise<{ changedPages: readonly string[] }>
  getRefactoringSuggestions?: (wikiFS: unknown, opts?: { signal?: AbortSignal }) => Promise<Record<string, unknown>>
  validateWiki?: (
    basePath: string,
    env: Record<string, string>,
    signal?: AbortSignal,
  ) => Promise<{ exitCode: number; stdout: string }>
  // §5.19 v0.4 Batch 5 (R8 / G1) — broken wikilink fix (mode a).
  detectBrokenWikilinks?: (
    wikiFS: unknown,
    opts?: { signal?: AbortSignal },
  ) => Promise<
    readonly {
      source: string
      brokenTarget: string
      fixKind: 'case-insensitive' | 'fuzzy' | 'no-match'
      candidates: readonly { slug: string; similarity: number }[]
      autoFixSlug?: string
    }[]
  >
  applyBrokenWikilinkFix?: (
    wikiFS: unknown,
    opts: {
      confirm: boolean
      fixes: readonly { source: string; brokenTarget: string; replacement: string }[]
      signal?: AbortSignal
    },
  ) => Promise<{ changedFiles: number; changedLinks: number }>
  // §5.19 v0.5 R4 — stale tombstone purge.
  applyStaleTombstoneCleanup?: (
    wikiFS: unknown,
    opts: {
      confirm: boolean
      tombstoneIds: readonly string[]
      signal?: AbortSignal
    },
  ) => Promise<{ removedIds: readonly string[] }>
  // §5.19 v0.5 R6 — refactoring archive.
  applyRefactoringArchive?: (
    wikiFS: unknown,
    opts: {
      confirm: boolean
      archivePaths: readonly string[]
      signal?: AbortSignal
    },
  ) => Promise<{ archived: readonly string[] }>
}

function loadCore(): CoreApi | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('wikey-core') as CoreApi
  } catch {
    return null
  }
}

/**
 * Extract vault basePath via the FileSystemAdapter — typed loosely because
 * Obsidian's FileSystemAdapter#basePath is not on the public typing surface
 * (`(adapter as any).basePath` mirrors how the rest of sidebar-chat / commands.ts
 * access it). Returns `''` when running under a non-disk adapter (mobile) — the
 * validateWiki runner then no-ops + returns exitCode 0 so the rest of the
 * pipeline still surfaces findings.
 */
function readVaultBasePath(plugin: WikeyPlugin): string {
  const adapter = plugin.app.vault.adapter as unknown as { basePath?: string }
  return adapter.basePath ?? ''
}

/**
 * Build a `MaintenanceRunner` wired to the live wikey-core bundle. Shared by
 * the Help panel buttons (sidebar-chat.ts) + palette commands (commands.ts).
 */
export function createMaintenanceRunner(plugin: WikeyPlugin): MaintenanceRunner {
  const wikiFS = plugin.wikiFS
  return {
    async runStatus(signal) {
      const core = loadCore()
      if (!core?.getWikiStatus) return {}
      return await core.getWikiStatus(wikiFS, { forceRefresh: true, signal })
    },
    async runCheck(signal) {
      const core = loadCore()
      if (!core?.runWikiCheck) return []
      const validateWiki = buildValidateWikiInjection(plugin, core)
      const report = await core.runWikiCheck(wikiFS, { validateWiki, signal })
      // §5.19 v0.4 Batch 5 (R8 / G1 / I-FIX-1) — overlay `autoFixSlug` onto
      // broken-link findings via the standalone `detectBrokenWikilinks` helper.
      // The runWikiCheck producer emits broken-link rows without classification
      // (case-insensitive vs fuzzy vs no-match); the merge below attaches
      // `autoFixSlug` so Step 2 confirm can render auto-fix checkboxes.
      const autoFixIndex = await buildAutoFixIndex(core, wikiFS, signal)
      return report.findings.map((f) => annotateAutoFix(f, autoFixIndex))
    },
    async runRecovery(signal, payload) {
      const core = loadCore()
      if (!core?.applyWikiRecovery) return { changedPages: [] }
      const report = await core.applyWikiRecovery(wikiFS, {
        confirm: true,
        danglingShas: payload.danglingShas,
        signal,
      })
      return { changedPages: report.changedPages }
    },
    async runBrokenLinkFix(signal, payload) {
      const core = loadCore()
      if (!core?.applyBrokenWikilinkFix) return { changedFiles: 0, changedLinks: 0 }
      const report = await core.applyBrokenWikilinkFix(wikiFS, {
        confirm: true,
        fixes: payload.fixes,
        signal,
      })
      return { changedFiles: report.changedFiles, changedLinks: report.changedLinks }
    },
    async runRefactoring(signal) {
      const core = loadCore()
      if (!core?.getRefactoringSuggestions) return {}
      return await core.getRefactoringSuggestions(wikiFS, { signal })
    },
    // §5.19 v0.5 R4 — stale tombstone purge runner.
    async runStaleTombstoneFix(signal, payload) {
      const core = loadCore()
      if (!core?.applyStaleTombstoneCleanup) return { removedIds: [] }
      const report = await core.applyStaleTombstoneCleanup(wikiFS, {
        confirm: true,
        tombstoneIds: payload.tombstoneIds,
        signal,
      })
      return { removedIds: report.removedIds }
    },
    // §5.19 v0.5 R6 — refactoring archive runner.
    async runRefactoringApply(signal, payload) {
      const core = loadCore()
      if (!core?.applyRefactoringArchive) return { archived: [] }
      const report = await core.applyRefactoringArchive(wikiFS, {
        confirm: true,
        archivePaths: payload.archivePaths,
        signal,
      })
      return { archived: report.archived }
    },
    // §5.19 v0.5 R6 — wiki page index for slug→path resolution in Step 2.
    async listWikiPages(signal) {
      const fs = wikiFS as { walk?: (dir: string) => Promise<readonly string[]> }
      if (typeof fs.walk !== 'function') return []
      if (signal.aborted) return []
      const all = await fs.walk('wiki')
      return all.filter((p) => p.endsWith('.md'))
    },
  }
}

/**
 * §5.19 v0.4 Batch 6 (R12) — broken-wikilink classification entry. The runner
 * now surfaces all three fix kinds (case-insensitive auto / fuzzy candidates /
 * no-match) so Step 2 confirm can render a checkbox + dropdown per row instead
 * of dropping fuzzy + no-match findings on the floor.
 *
 * `autoFixSlug` is filled only for `case-insensitive` (back-compat with the
 * existing modal checkbox path); `candidates` carries the top-3 fuzzy slugs so
 * the modal can drive a `<select>` per row.
 */
export interface BrokenLinkClassification {
  readonly fixKind: 'case-insensitive' | 'fuzzy' | 'no-match'
  readonly autoFixSlug?: string
  readonly candidates: readonly { slug: string; similarity: number }[]
}

/**
 * Build a `(source|brokenTarget) → classification` lookup from
 * `detectBrokenWikilinks`. Empty Map when the helper is missing (legacy core
 * bundle) — `annotateAutoFix` then no-ops and finding rows stay as-is.
 *
 * §5.19 v0.4 Batch 6 (R12) — index now keeps fuzzy + no-match entries too so
 * Step 2 can surface them with checkbox + dropdown. Previously only
 * `case-insensitive` rows were retained (Batch 5 scope).
 */
async function buildAutoFixIndex(
  core: CoreApi,
  wikiFS: unknown,
  signal: AbortSignal,
): Promise<ReadonlyMap<string, BrokenLinkClassification>> {
  if (!core.detectBrokenWikilinks) return new Map()
  const cands = await core.detectBrokenWikilinks(wikiFS, { signal })
  const out = new Map<string, BrokenLinkClassification>()
  for (const c of cands) {
    out.set(`${c.source}|${c.brokenTarget}`, {
      fixKind: c.fixKind,
      autoFixSlug: c.autoFixSlug,
      candidates: c.candidates,
    })
  }
  return out
}

/**
 * §5.19 v0.4 Batch 5 fix (2026-05-12) — annotate `autoFixSlug` onto both the
 * native `broken-link` / `broken-wikilink` producer rows *and* the
 * `validate-wiki` injection rows. The live vault funnels ~99% of broken
 * wikilinks through `validate-wiki.sh` stdout (collectFindings's standalone
 * broken-link path is near-empty at scale), so without the second branch Step
 * 2's broken section rendered 0 rows even with thousands of fixable findings
 * present (master cdp regression, 2026-05-12).
 *
 * For `validate-wiki` rows the helper *also* fills `path` so the downstream
 * Step 2 confirm view can render `source: [[X]] → [[Y]]` without re-parsing
 * the raw FAIL line.
 *
 * §5.19 v0.4 Batch 6 (R12) — accepts either the legacy `string` map (Batch 5
 * test signature) or the richer `BrokenLinkClassification` map (production
 * runner) and forwards `fixKind` + `candidates` so Step 2 can render fuzzy
 * dropdowns + no-match manual rows.
 */
export function annotateAutoFix(
  f: { kind: string; path?: string; detail?: string },
  autoFixIndex: ReadonlyMap<string, string | BrokenLinkClassification>,
): {
  kind: string
  path?: string
  detail?: string
  autoFixSlug?: string
  fixKind?: 'case-insensitive' | 'fuzzy' | 'no-match'
  candidates?: readonly { slug: string; similarity: number }[]
} {
  const lookup = (key: string) => normalizeClassification(autoFixIndex.get(key))
  if (f.kind === 'broken-link' || f.kind === 'broken-wikilink') {
    if (!f.path || !f.detail) return f
    const target = parseBrokenTarget(f.detail)
    if (!target) return f
    const cls = lookup(`${f.path}|${target}`)
    return cls ? { ...f, ...projectClassification(cls) } : f
  }
  if (f.kind === 'validate-wiki' && f.detail) {
    const parsed = parseValidateWikiBrokenLine(f.detail)
    if (!parsed) return f
    const key = `${parsed.source}|${parsed.target}`
    const cls = lookup(key)
    if (!cls) return f
    // Fill `path` so collectBrokenLinkRows (modal-views) can group the row by
    // source page without re-parsing the FAIL detail string.
    return { ...f, path: parsed.source, ...projectClassification(cls) }
  }
  return f
}

/**
 * Normalize the legacy `string` (autoFixSlug) entry form into the richer
 * `BrokenLinkClassification` shape so a single downstream projector handles
 * both call sites (Batch 5 tests + Batch 6 production index).
 */
function normalizeClassification(
  entry: string | BrokenLinkClassification | undefined,
): BrokenLinkClassification | undefined {
  if (entry === undefined) return undefined
  if (typeof entry === 'string') {
    return { fixKind: 'case-insensitive', autoFixSlug: entry, candidates: [] }
  }
  return entry
}

/**
 * Shape the classification into the finding overlay fields. Empty `candidates`
 * arrays are dropped from the projection so existing tests asserting
 * `autoFixSlug` only see the autoFix field (no spurious `candidates: []`).
 */
function projectClassification(
  cls: BrokenLinkClassification,
): { autoFixSlug?: string; fixKind: 'case-insensitive' | 'fuzzy' | 'no-match'; candidates?: readonly { slug: string; similarity: number }[] } {
  const out: {
    autoFixSlug?: string
    fixKind: 'case-insensitive' | 'fuzzy' | 'no-match'
    candidates?: readonly { slug: string; similarity: number }[]
  } = { fixKind: cls.fixKind }
  if (cls.autoFixSlug) out.autoFixSlug = cls.autoFixSlug
  if (cls.candidates.length > 0) out.candidates = cls.candidates
  return out
}

export function parseBrokenTarget(detail: string): string | null {
  const m = detail.match(/^\[\[([^\]|#]+)/)
  return m ? m[1]!.trim() : null
}

/**
 * Parse a `validate-wiki` FAIL detail line of the form
 *   `<source path>: 깨진 위키링크 [[<target>]]`
 * into its `{ source, target }` components. Returns `null` when the line
 * does not match the broken-wikilink subset (e.g. orphan / missing-frontmatter
 * lines also flow through the same `validate-wiki` finding kind).
 */
export function parseValidateWikiBrokenLine(
  detail: string,
): { source: string; target: string } | null {
  const m = detail.match(/^([^:]+): 깨진 위키링크 \[\[([^\]|#]+)/)
  if (!m) return null
  return { source: m[1]!.trim(), target: m[2]!.trim() }
}

/**
 * Build a validateWiki injection callable from `runWikiCheck`. Uses the
 * in-process `validateWiki(basePath, env, signal)` runner shipped by wikey-core
 * (scripts-runner.ts) — `validate-wiki.sh` itself is a thin wrapper around the
 * same TS implementation. `FAIL:` lines from stdout become `validate-wiki`
 * findings so AC-C2-1 parity (exit code + findings) holds end-to-end.
 *
 * §5.19 cycle #4 (2026-05-12) — `signal` is now wired into `validateWiki()` so
 * an upstream abort (MaintenanceModal close → AbortController.abort()) trips
 * the same cancellation path that the captureRun timeout uses. When a future
 * swap to `child_process.spawn` backed runner happens, the same signal becomes
 * the SIGTERM trigger — drop-in replacement preserved.
 */
function buildValidateWikiInjection(
  plugin: WikeyPlugin,
  core: CoreApi,
): (signal?: AbortSignal) => Promise<{ exitCode: number; findings: readonly { kind: string; detail: string }[] }> {
  return async (signal?: AbortSignal) => {
    if (!core.validateWiki) return { exitCode: 0, findings: [] }
    const basePath = readVaultBasePath(plugin)
    if (!basePath) return { exitCode: 0, findings: [] }
    const result = await core.validateWiki(basePath, {}, signal)
    const findings = result.stdout
      .split('\n')
      .filter((line) => /^FAIL:/.test(line))
      .map((line) => ({ kind: 'validate-wiki', detail: line.replace(/^FAIL:\s*/, '') }))
    return { exitCode: result.exitCode, findings }
  }
}
