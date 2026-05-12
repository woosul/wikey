/**
 * §5.19 Spec 2 — wiki-check.
 *
 * Read-only verify: validate-wiki + paired-sidecar + reconcile dry-run +
 * §5.18 dangling cross-link detect. Writes a single idempotent analyses page
 * (`wiki/analyses/wiki-check-<YYYY-MM-DD>.md`) — wiki/ 외 변경 0.
 *
 * Invariants:
 *   I4 read-only (analyses append allowed) / I5 helper reuse (findRestoredIds dry-run) /
 *   I6 single analyses page per date (idempotent overwrite).
 */

import type { WikiFS } from '../../types.js'
import { findRestoredIds } from '../../source-registry.js'
import {
  buildRawWalker,
  detectDanglingCrossLinks,
  detectStaleTombstones,
  escapeWikilinks,
  extractWikilinks,
  isWikiCheckReportPath,
  listWikiPages,
  loadRegistrySafe,
  pageSlugFromPath,
  throwIfAborted,
} from './helpers.js'

export interface Finding {
  readonly kind: string
  readonly path?: string
  readonly detail?: string
}

export interface WikiCheckReport {
  readonly exitCode: number
  readonly findings: readonly Finding[]
  readonly analysisPagePath: string
  readonly staleTombstoneIds: readonly string[]
  readonly danglingCrossLinks: readonly string[]
}

/**
 * Result of an external `validate-wiki` invocation, surfaced into the wiki-check
 * report. `findings` lists each `FAIL:` line; `exitCode` propagates 1:1 so the
 * overall `runWikiCheck` exit can never disagree with validate-wiki (Finding 3
 * — AC-C2-1 parity).
 */
export interface ValidateWikiOutcome {
  readonly exitCode: number
  readonly findings: readonly Finding[]
}

export interface RunWikiCheckOptions {
  readonly today?: string
  /**
   * Inject a validate-wiki runner. Production wires this to either an
   * in-process call to `runValidateWiki()` (when the caller knows the vault
   * basePath) or a `child_process.spawnSync('./scripts/validate-wiki.sh')`.
   * Tests pass a stub. When omitted, validate-wiki is skipped (back-compat —
   * tombstone / dangling / broken-link findings still surface).
   *
   * The runner receives the cooperative AbortSignal so a long-running spawned
   * subprocess can SIGTERM on modal close (AC-UI-6).
   */
  readonly validateWiki?: (signal?: AbortSignal) => Promise<ValidateWikiOutcome>
  /** Cooperative AbortSignal — polled at page-iteration boundaries. */
  readonly signal?: AbortSignal
}

export async function runWikiCheck(
  fs: WikiFS,
  opts: RunWikiCheckOptions = {},
): Promise<WikiCheckReport> {
  const today = opts.today ?? new Date().toISOString().slice(0, 10)

  // AC-C2-1 — call validate-wiki first so its findings/exit code merge in.
  // Forward the abort signal so spawned subprocess (validate-wiki.sh path) can
  // SIGTERM cleanly on modal close (AC-UI-6 wiring, Finding 4 cycle #3).
  const validateOutcome: ValidateWikiOutcome = opts.validateWiki
    ? await opts.validateWiki(opts.signal)
    : { exitCode: 0, findings: [] }

  throwIfAborted(opts.signal)

  const { findings: collected, staleTombstoneIds, danglingCrossLinks } = await collectFindings(fs, opts.signal)

  const findings: Finding[] = [...validateOutcome.findings, ...collected]

  // Persist analysis page (AC-C2-2). Idempotent overwrite per date.
  const analysisPagePath = `wiki/analyses/wiki-check-${today}.md`
  await fs.write(analysisPagePath, renderCheckAnalysisPage(today, findings))

  // Exit propagation — non-zero if validate-wiki failed OR maintenance findings exist.
  const exitCode = validateOutcome.exitCode !== 0 || collected.length > 0 ? 1 : 0
  return {
    exitCode,
    findings,
    analysisPagePath,
    staleTombstoneIds,
    danglingCrossLinks,
  }
}

interface CollectedFindings {
  readonly findings: readonly Finding[]
  readonly staleTombstoneIds: readonly string[]
  readonly danglingCrossLinks: readonly string[]
}

/**
 * Stage 1 of `runWikiCheck` — pure collection (no writes). Split out so
 * rendering (`renderCheckAnalysisPage`) and persistence stay isolated.
 *
 * Three kinds are appended:
 *   - broken-link: body `[[X]]` where X ∉ pages
 *   - dangling-cross-link: frontmatter `sources:` sha ∉ registry (§5.18 case)
 *   - stale-tombstone: hash-equality subset (helper exact) ∪ path-based wider net
 */
async function collectFindings(fs: WikiFS, signal?: AbortSignal): Promise<CollectedFindings> {
  const findings: Finding[] = []

  const pages = await listWikiPages(fs)
  const pageSet = new Set(pages.map(pageSlugFromPath))
  const registry = await loadRegistrySafe(fs)
  const registryShas = new Set(Object.keys(registry))

  // broken wikilink findings
  //
  // §5.19 v0.4 Batch 6 fix — `listWikiPages` already excludes wiki-check report
  // pages, but the explicit guard documents the recursive-feedback invariant at
  // every iteration site (master cdp evidence: 96% of broken-wikilink findings
  // historically traced to a single report page).
  for (const path of pages) {
    throwIfAborted(signal)
    if (isWikiCheckReportPath(path)) continue
    const body = await fs.read(path)
    for (const link of extractWikilinks(body)) {
      if (!pageSet.has(link)) {
        findings.push({ kind: 'broken-link', path, detail: `[[${link}]]` })
      }
    }
  }

  // dangling cross-link findings (frontmatter sources: sha256 not in registry)
  throwIfAborted(signal)
  const dangling = await detectDanglingCrossLinks(fs, pages, registryShas, signal)
  const danglingCrossLinks: string[] = []
  for (const { path, sha } of dangling) {
    findings.push({ kind: 'dangling-cross-link', path, detail: sha })
    danglingCrossLinks.push(`${path}|${sha}`)
  }

  // Stale tombstone findings.
  //
  // - `staleTombstoneIds` (helper-exact subset) = hash-equality match via
  //   `findRestoredIds` — Spec I5 1:1 helper reuse (AC-C2-3).
  // - `pathBasedCandidates` = wider net for records whose content has drifted
  //   since tombstoning but whose vault_path still resolves. Tagged with
  //   `(path-based)` suffix to distinguish from the helper-exact subset.
  throwIfAborted(signal)
  const walker = buildRawWalker(fs, signal)
  const staleTombstoneIds = await findRestoredIds(registry, walker)
  throwIfAborted(signal)
  const pathBasedCandidates = await detectStaleTombstones(fs, registry, signal)
  const seen = new Set<string>()
  for (const id of staleTombstoneIds) {
    seen.add(id)
    findings.push({ kind: 'stale-tombstone', detail: id })
  }
  for (const id of pathBasedCandidates) {
    if (seen.has(id)) continue
    findings.push({ kind: 'stale-tombstone', detail: `${id} (path-based)` })
  }

  return { findings, staleTombstoneIds, danglingCrossLinks }
}

function renderCheckAnalysisPage(today: string, findings: readonly Finding[]): string {
  const bySection = (kind: string): readonly Finding[] => findings.filter((f) => f.kind === kind)
  const section = (title: string, items: readonly Finding[]): string => {
    if (items.length === 0) return `## ${title}\n\n- (없음)\n`
    return `## ${title}\n\n${items.map(formatFinding).join('\n')}\n`
  }
  return [
    '---',
    'title: Wiki check report',
    'type: analysis',
    `created: ${today}`,
    `updated: ${today}`,
    'sources: []',
    'tags: [maintenance, wiki-check]',
    '---',
    '',
    `# Wiki check — ${today}`,
    '',
    section('paired-sidecar audit', bySection('paired-sidecar')),
    section('registry reconcile', bySection('reconcile')),
    section('stale tombstone', bySection('stale-tombstone')),
    section('dangling cross-link', bySection('dangling-cross-link')),
    section('broken wikilink', bySection('broken-link')),
  ].join('\n')
}

function formatFinding(f: Finding): string {
  const parts = [f.path, f.detail].filter((s) => !!s)
  // §5.19 v0.4 Batch 6 fix — escape `[[X]]` inside detail so the persisted
  // analyses page never re-triggers broken-link detection on subsequent runs.
  return `- ${escapeWikilinks(parts.join(' — '))}`
}
