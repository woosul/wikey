/**
 * §5.19 MaintenanceModal — view rendering helpers (split from
 * `maintenance-modal.ts`, cycle #3 BLUE refactor 2026-05-12).
 *
 * The modal class owns the lifecycle (onOpen / dispatch / close / abort). All
 * mode-agnostic DOM rendering (findings list / step-2 confirm checkbox /
 * step-3 progress / healthy state) lives here so the modal file stays under
 * the 200 LOC budget (spec §3 v0.3 Dependencies).
 *
 * No state — every function takes the target element + raw data and returns
 * either void (renders) or a primitive (callback hook results). The modal owns
 * AbortController + running flag + findings array.
 */
import type { MaintenanceFinding } from './maintenance-modal'

/** AC-UI-3 — append a single stdout/stderr line to the progress region. */
export function appendProgressLine(progressEl: HTMLElement | null, line: string): void {
  if (!progressEl) return
  progressEl.createDiv({ cls: 'wikey-maintenance-modal-log-line', text: line })
}

/**
 * AC-UI-4 — render the findings list (or "All healthy" placeholder). Returns
 * the apply-fix button element when findings>0 so the modal can wire its click
 * handler — separating DOM construction from click semantics keeps the modal
 * class lean.
 *
 * §5.19 v0.4 (R4 fix) — `onClose` is now required for the healthy-state Close
 * button so footer clicks actually dismiss the modal (the previous build wired
 * only the title-bar `x`; users reported the footer Close as dead).
 */
export interface FindingsViewHooks {
  /** Click on the apply-fix button (only when findings>0). */
  readonly onApplyFix: () => void
  /** Click on the footer Close button (only when findings===0). */
  readonly onClose: () => void
}

export function renderFindingsList(
  actionEl: HTMLElement,
  findings: readonly MaintenanceFinding[],
  hooks: FindingsViewHooks,
): void {
  actionEl.empty()
  if (findings.length === 0) {
    renderHealthyView(actionEl, hooks.onClose)
    return
  }
  // §5.19 v0.5 R1/R2/R3 — Step 1 guidance text. The previous Step 1 listed
  // findings without telling the user what the next click does; users reported
  // (master cdp 2026-05-12) confusion about how to fix issues. The guidance
  // line (English-only per §5.22 LOCK) sits above the accordion + Apply button
  // so the workflow ("review → Apply fix → select items → Execute") is one
  // glance away.
  actionEl.createEl('div', {
    cls: 'wikey-maintenance-modal-step-1-guidance',
    text: 'Review findings below, then click "Apply fix" to select items and execute.',
  })
  renderFindingsTable(actionEl, findings)
  const btnRow = actionEl.createDiv({ cls: 'wikey-maintenance-modal-action-buttons' })
  const applyBtn = btnRow.createEl('button', {
    text: 'Apply fix',
    cls: 'wikey-maintenance-modal-apply-btn',
  })
  applyBtn.addEventListener('click', () => {
    hooks.onApplyFix()
  })
  btnRow.createEl('button', { text: 'Cancel', cls: 'wikey-maintenance-modal-cancel-btn' })
}

function renderHealthyView(actionEl: HTMLElement, onClose: () => void): void {
  actionEl.createEl('div', { text: 'All healthy', cls: 'wikey-maintenance-modal-healthy' })
  const closeBtn = actionEl.createEl('button', {
    text: 'Close',
    cls: 'wikey-maintenance-modal-close-btn',
  })
  closeBtn.addEventListener('click', () => {
    onClose()
  })
}

/**
 * §5.19 v0.4 (R6/R10/I-HEALTH-1) — Unhealthy summary view for Status +
 * Refactoring modes. Shown instead of "All healthy" whenever the mode-specific
 * health predicate (`isWikiHealthy` / `isRefactoringHealthy`) returns false.
 * Each issue caller-supplies its own label + count so the helper stays mode-
 * agnostic. Empty `issues` (count 0) are filtered out so the summary line lists
 * only firing metrics — "Issues found: 6936 broken, 38 dangling" not "0 stale".
 */
export interface UnhealthyIssue {
  readonly label: string
  readonly count: number
}

export interface UnhealthySummaryHooks {
  readonly onClose: () => void
  /**
   * §5.19 v0.5 R6 — Refactoring mode supplies `onExecute` so the user can
   * advance from the summary into the Step 2 archive selection. Status mode
   * omits it (read-only metrics — no Execute path), in which case the helper
   * renders only the Close button.
   */
  readonly onExecute?: () => void
}

export function renderUnhealthySummary(
  actionEl: HTMLElement,
  issues: readonly UnhealthyIssue[],
  hooksOrClose: UnhealthySummaryHooks | (() => void),
): void {
  // Back-compat: legacy signature `(actionEl, issues, onClose)` still works —
  // tests + Status mode pass the bare callback. Refactoring + future callers
  // pass the full hooks object with `onExecute`.
  const hooks: UnhealthySummaryHooks =
    typeof hooksOrClose === 'function' ? { onClose: hooksOrClose } : hooksOrClose

  const firing = issues.filter((i) => i.count > 0)
  const summary = firing.length === 0
    ? 'Issues found'
    : `Issues found: ${firing.map((i) => `${i.count} ${i.label}`).join(', ')}`
  actionEl.createEl('div', {
    text: summary,
    cls: 'wikey-maintenance-modal-unhealthy',
  })
  // §5.19 v0.5 follow-up (사용자 raise 2026-05-13) — Execute + Close 같은 row
  // (`wikey-maintenance-modal-unhealthy-actions`, flex 가로 배치).
  const actionsRow = actionEl.createDiv({
    cls: 'wikey-maintenance-modal-unhealthy-actions',
  })
  if (hooks.onExecute) {
    const execBtn = actionsRow.createEl('button', {
      text: 'Execute',
      cls: 'wikey-maintenance-modal-execute-btn',
    })
    execBtn.addEventListener('click', () => {
      hooks.onExecute!()
    })
  }
  const closeBtn = actionsRow.createEl('button', {
    text: 'Close',
    cls: 'wikey-maintenance-modal-close-btn',
  })
  closeBtn.addEventListener('click', () => {
    hooks.onClose()
  })
}

/**
 * §5.19 v0.4 Batch 3 (R7 / I-CHECK-1~3 / AC-CHECK-1~3) — group findings by
 * kind, render each group as a collapsible accordion section.
 *
 * Spec lists 5 canonical kinds (broken-wikilink / dangling-cross-link /
 * paired-sidecar / stale-tombstone / validate-wiki-other). The wikey-core
 * producer (`check.ts`) emits 4 of them with a slightly different alias for
 * the wikilink case (`broken-link`) and uses `validate-wiki` for the catch-all
 * line — `KIND_ORDER` lists every alias we emit today; `KIND_LABELS` maps both
 * spec names + code aliases to the user-facing Korean label so the producer
 * stays untouched (Spec out-of-scope §2 — `validate-wiki.sh` 본문 수정 X).
 *
 * `groupFindingsByKind` preserves the `KIND_ORDER` ordering, falls back to the
 * `validate-wiki-other` bucket for any unrecognized kind, and drops empty
 * groups so the rendered accordion lists only firing categories.
 */
/**
 * Canonical bucket keys (Spec I-CHECK-1 "5 category"). The producer
 * (`wikey-core/src/wiki/maintenance/check.ts`) emits a couple of aliases
 * (`broken-link` ≡ `broken-wikilink`, `validate-wiki` ≡ `validate-wiki-other`)
 * — `KIND_ALIASES` collapses them to the canonical key, and any unrecognised
 * kind also falls into `validate-wiki-other` so producer drift never causes a
 * silent drop.
 */
const KIND_ORDER: readonly string[] = [
  'broken-wikilink',
  'dangling-cross-link',
  'paired-sidecar',
  'stale-tombstone',
  'validate-wiki-other',
]

const KIND_ALIASES: Record<string, string> = {
  'broken-link': 'broken-wikilink',
  'validate-wiki': 'validate-wiki-other',
}

const KIND_LABELS: Record<string, string> = {
  'broken-wikilink': 'Broken Wikilink',
  'dangling-cross-link': 'Dangling Cross-link',
  'paired-sidecar': 'Paired Sidecar Mismatch',
  'stale-tombstone': 'Stale Tombstone',
  'validate-wiki-other': 'Validate-wiki Other',
}

/**
 * §5.19 v0.4 Batch 5 fix (2026-05-12) — the live vault funnels almost every
 * broken wikilink through `validate-wiki.sh` stdout as a `validate-wiki` kind
 * finding (the standalone `broken-link` path in `collectFindings` only fires
 * for a tiny minority). When the detail text matches the broken-wikilink
 * shape (`<path>: 깨진 위키링크 [[<target>]]`) we collapse it into the
 * `broken-wikilink` accordion bucket so the kind label / count line up with
 * the rest of the broken-link tooling. Non-broken validate-wiki lines (orphan
 * / missing-frontmatter / 등) still fall through to `validate-wiki-other`.
 */
function bucketKey(f: { kind: string; detail?: string }): string {
  if (f.kind === 'validate-wiki' && f.detail && BROKEN_WIKILINK_DETAIL.test(f.detail)) {
    return 'broken-wikilink'
  }
  const aliased = KIND_ALIASES[f.kind] ?? f.kind
  if (KIND_LABELS[aliased] !== undefined) return aliased
  return 'validate-wiki-other'
}

const BROKEN_WIKILINK_DETAIL = /깨진 위키링크 \[\[/

function labelForKey(key: string): string {
  return KIND_LABELS[key]!
}

interface FindingGroup {
  readonly label: string
  readonly items: readonly MaintenanceFinding[]
}

function groupFindingsByKind(
  findings: readonly MaintenanceFinding[],
): readonly FindingGroup[] {
  const buckets = new Map<string, MaintenanceFinding[]>()
  const seenOrder: string[] = []
  for (const f of findings) {
    const key = bucketKey(f)
    if (!buckets.has(key)) {
      buckets.set(key, [])
      seenOrder.push(key)
    }
    buckets.get(key)!.push(f)
  }
  // Stable order: KIND_ORDER first (for any kind present), then anything else
  // in first-seen order. Each label resolves once so collapsed aliases
  // (`broken-link` → `깨진 wikilink`) share a single header.
  const ordered: FindingGroup[] = []
  const emitted = new Set<string>()
  const emit = (key: string): void => {
    if (emitted.has(key)) return
    const items = buckets.get(key)
    if (!items || items.length === 0) return
    emitted.add(key)
    ordered.push({ label: labelForKey(key), items })
  }
  for (const key of KIND_ORDER) emit(key)
  for (const key of seenOrder) emit(key)
  return ordered
}

function renderFindingsTable(
  actionEl: HTMLElement,
  findings: readonly MaintenanceFinding[],
): void {
  const groups = groupFindingsByKind(findings)
  groups.forEach((group, i) => {
    // §5.19 Batch 7 (2026-05-12, 사용자 명시 UI) — flat sections separated by
    // `<hr>` only (no per-group border/background). First group has no leading
    // divider; subsequent groups prepend one so the visual hierarchy collapses
    // to a single rule between adjacent kinds.
    if (i > 0) {
      actionEl.createEl('hr', { cls: 'wikey-maintenance-modal-section-divider' })
    }
    renderFindingGroup(actionEl, group)
  })
}

/**
 * §5.19 Batch 7 (2026-05-12, 사용자 명시 UI) — Bootstrap chevron-right /
 * chevron-down SVGs replace the unicode `▶ / ▼` glyphs so the accordion picks
 * up Obsidian's `currentColor` cascade and aligns with the rest of the icon
 * inventory (Phosphor / Lucide chevrons exhibit the same shape). The 14×14
 * viewBox-16 sizing matches the Bootstrap reference exactly.
 */
const CHEVRON_RIGHT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/></svg>'
const CHEVRON_DOWN_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" viewBox="0 0 16 16"><path d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"/></svg>'

/**
 * AC-CHECK-1~3 — single collapsible accordion section. Initial state is
 * collapsed (chevron-right SVG + `(N)` count); clicking the header toggles
 * `aria-expanded`, swaps the chevron (right ⇄ down), and shows/hides the inner
 * `<ul>` list. Each row uses the same `[kind, path, detail]` join as the
 * previous flat list so existing finding semantics are preserved.
 *
 * §5.19 Batch 7 (2026-05-12, 사용자 명시 UI) — label format is now
 * `> ${KIND_LABELS[kind]} (N)` with a leading blockquote-style `>` prefix and
 * left-aligned text. The block/button styling (border + background) is removed
 * via styles.css so the header reads as a plain heading with a chevron toggle.
 */
function renderFindingGroup(actionEl: HTMLElement, group: FindingGroup): void {
  const groupEl = actionEl.createDiv({ cls: 'wikey-maintenance-modal-finding-group' })

  // `setAttribute` (not `setAttr`) — Obsidian's prototype helper is missing
  // from the test mock, and DOM-standard `setAttribute` works in both runtimes.
  const headerBtn = groupEl.createEl('button', {
    cls: 'wikey-maintenance-modal-finding-group-header',
  })
  headerBtn.setAttribute('type', 'button')
  headerBtn.setAttribute('aria-expanded', 'false')

  const chevron = headerBtn.createSpan({ cls: 'wikey-maintenance-modal-chevron' })
  chevron.innerHTML = CHEVRON_RIGHT_SVG
  headerBtn.createSpan({
    cls: 'wikey-maintenance-modal-finding-group-label',
    text: `${group.label} (${group.items.length})`,
  })

  const listEl = groupEl.createEl('ul', {
    cls: 'wikey-maintenance-modal-finding-group-list',
  })
  listEl.style.display = 'none'

  for (const f of group.items) {
    const li = listEl.createEl('li', { cls: 'wikey-maintenance-modal-finding-item' })
    const parts = [f.path, f.detail].filter((s) => !!s)
    li.textContent = parts.join(' — ')
  }

  headerBtn.addEventListener('click', () => {
    const collapsed = listEl.style.display === 'none'
    listEl.style.display = collapsed ? '' : 'none'
    chevron.innerHTML = collapsed ? CHEVRON_DOWN_SVG : CHEVRON_RIGHT_SVG
    headerBtn.setAttribute('aria-expanded', String(collapsed))
  })
}

/**
 * AC-UI-5 / Finding 3 (cycle #4) — step-2 confirm checkbox UI.
 *
 * §5.19 v0.4 Batch 5 (R8 / G1 / I-FIX-1) — multi-mode confirm: dangling sha
 * cleanup (mode b, sha-grouped) + broken wikilink auto-fix (mode a, source/target-
 * grouped, autoFixSlug-only). Fuzzy / no-match candidates surface as a separate
 * "manual review" group without checkboxes (Batch 5 scope — auto-fix only).
 *
 * Dangling findings stay **grouped by sha** (not by page): a single dangling
 * sha (e.g. §5.18 `sha256:679cf2dd6db75e3a`) commonly spans dozens of pages so
 * page-level rows would break the I7 (confirm 의무) 1:1 between user intent +
 * applied change. `selectedShas` flows straight into `applyWikiRecovery({
 * danglingShas })`; `brokenFixes` flows into `applyBrokenWikilinkFix({ fixes })`.
 */
export interface BrokenFixRequest {
  readonly source: string
  readonly brokenTarget: string
  readonly replacement: string
}

export interface ConfirmExecutePayload {
  readonly selectedShas: readonly string[]
  readonly brokenFixes: readonly BrokenFixRequest[]
  /**
   * §5.19 v0.5 R4 — selected stale-tombstone ids the user wants to purge.
   * Sourced from the `stale-tombstone` findings rendered in their own Step 2
   * section. Empty when no stale-tombstone findings exist or none are checked.
   */
  readonly staleTombstoneIds: readonly string[]
}

export interface ConfirmViewHooks {
  readonly onExecute: (payload: ConfirmExecutePayload) => void
  readonly onCancel: () => void
}

interface ShaGroup {
  readonly sha: string
  readonly pageCount: number
}

function groupDanglingFindingsBySha(
  findings: readonly MaintenanceFinding[],
): readonly ShaGroup[] {
  const counts = new Map<string, number>()
  const order: string[] = []
  for (const f of findings) {
    if (f.kind !== 'dangling-cross-link') continue
    const sha = f.sha ?? f.detail
    if (!sha || !sha.startsWith('sha256:')) continue
    if (!counts.has(sha)) order.push(sha)
    counts.set(sha, (counts.get(sha) ?? 0) + 1)
  }
  return order.map((sha) => ({ sha, pageCount: counts.get(sha) ?? 0 }))
}

/**
 * Broken-wikilink finding bucket. `autoFixSlug` is the canonical case-insensitive
 * replacement when available; `candidates` carries the top-3 fuzzy suggestions
 * (Batch 6 / R12). Rows without either signal collapse into the no-match
 * (manual-review) bucket.
 */
interface BrokenLinkRow {
  readonly source: string
  readonly brokenTarget: string
  readonly autoFixSlug: string | undefined
  readonly fixKind: 'case-insensitive' | 'fuzzy' | 'no-match' | undefined
  readonly candidates: readonly { slug: string; similarity: number }[]
}

/**
 * §5.19 v0.4 Batch 5 fix (2026-05-12) — production findings split between two
 * shapes:
 *
 *   1. native `broken-link` / `broken-wikilink` rows (`f.path` + `f.detail =
 *      "[[target]]"`) — `parseBrokenTarget` extracts the target directly.
 *   2. `validate-wiki` FAIL rows annotated upstream by `annotateAutoFix` —
 *      `f.path` and `f.autoFixSlug` are pre-filled; the target lives inside
 *      `f.detail` (`"<path>: 깨진 위키링크 [[target]]"`) so we use
 *      `parseValidateWikiBrokenLine` to recover it.
 *
 * Either branch produces a normalized `(source, brokenTarget, autoFixSlug)`
 * row; the dedupe set keys on `source|target` so the same wikilink reported
 * by both producers never doubles up.
 */
function collectBrokenLinkRows(
  findings: readonly MaintenanceFinding[],
): readonly BrokenLinkRow[] {
  const out: BrokenLinkRow[] = []
  const seen = new Set<string>()
  for (const f of findings) {
    const row = extractBrokenLinkRow(f)
    if (!row) continue
    const key = `${row.source}|${row.brokenTarget}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

function extractBrokenLinkRow(f: MaintenanceFinding): BrokenLinkRow | null {
  if (f.kind === 'broken-link' || f.kind === 'broken-wikilink') {
    if (!f.path) return null
    const target = parseBrokenTarget(f.detail)
    if (!target) return null
    return {
      source: f.path,
      brokenTarget: target,
      autoFixSlug: f.autoFixSlug,
      fixKind: f.fixKind,
      candidates: f.candidates ?? [],
    }
  }
  // §5.19 v0.4 Batch 6 (R12) — surface validate-wiki rows even when
  // `autoFixSlug` is absent, provided some classification signal exists
  // (fixKind / candidates). Batch 5 required `autoFixSlug`; that filter dropped
  // fuzzy + no-match rows so Step 2 never offered manual selection.
  if (f.kind === 'validate-wiki' && f.detail) {
    const hasClassification = !!f.autoFixSlug || !!f.fixKind || (f.candidates?.length ?? 0) > 0
    if (!hasClassification) return null
    const parsed = parseValidateWikiBrokenLine(f.detail)
    if (!parsed) return null
    return {
      source: f.path ?? parsed.source,
      brokenTarget: parsed.target,
      autoFixSlug: f.autoFixSlug,
      fixKind: f.fixKind,
      candidates: f.candidates ?? [],
    }
  }
  return null
}

/** `[[X]]` / `[[X|alias]]` / `[[X#anchor]]` → `X`. Returns null if malformed. */
function parseBrokenTarget(detail: string | undefined): string | null {
  if (!detail) return null
  const m = detail.match(/^\[\[([^\]|#]+)/)
  return m ? m[1]!.trim() : null
}

/**
 * Parse a `validate-wiki` FAIL line of the form
 *   `<source path>: 깨진 위키링크 [[<target>]]`
 * into its `{ source, target }` components. Mirrors the helper in
 * `maintenance-runner.ts` so the modal view can resolve the target even when
 * the upstream FAIL string is the only carrier of the data (path + autoFixSlug
 * are already filled by `annotateAutoFix`).
 */
function parseValidateWikiBrokenLine(
  detail: string,
): { source: string; target: string } | null {
  const m = detail.match(/^([^:]+): 깨진 위키링크 \[\[([^\]|#]+)/)
  if (!m) return null
  return { source: m[1]!.trim(), target: m[2]!.trim() }
}

export function renderStep2Confirm(
  actionEl: HTMLElement,
  findings: readonly MaintenanceFinding[],
  hooks: ConfirmViewHooks,
): void {
  actionEl.empty()
  actionEl.createEl('div', {
    // Preserve `wikey-maintenance-modal-step-2` so existing CSS (italic +
    // muted color) keeps applying; the `-header` modifier targets the new
    // section header spacing in Batch 6.
    cls: 'wikey-maintenance-modal-step-2 wikey-maintenance-modal-step-2-header',
    text: 'Step 2 — Items to fix:',
  })

  const shaGroups = groupDanglingFindingsBySha(findings)
  const brokenRows = collectBrokenLinkRows(findings)
  // §5.19 v0.5 R4 — stale-tombstone rows surfaced as their own section so the
  // user can opt-in per id (active records are protected core-side regardless).
  const staleTombstoneRows = collectStaleTombstoneRows(findings)

  const autoRows = brokenRows.filter((r) => r.fixKind === 'case-insensitive' && !!r.autoFixSlug)
  const fuzzyRows = brokenRows.filter((r) => r.fixKind === 'fuzzy' && r.candidates.length > 0)
  // Anything left over (no-match OR rows lacking classification but surfaced as
  // candidates by validate-wiki) goes to manual review.
  const manualRows = brokenRows.filter(
    (r) => !(r.fixKind === 'case-insensitive' && !!r.autoFixSlug)
      && !(r.fixKind === 'fuzzy' && r.candidates.length > 0),
  )

  // §5.19 v0.4 Batch 6 (R13) — section list with `<hr>` dividers between
  // adjacent non-empty sections. Capture each section's controls so the action
  // row's [실행] click can collect every selection in one payload.
  const shaCheckboxes: ShaCheckbox[] = []
  const autoCheckboxes: BrokenCheckbox[] = []
  const fuzzyControls: FuzzyControl[] = []
  const manualCheckboxes: ManualCheckbox[] = []
  const staleTombstoneCheckboxes: StaleTombstoneCheckbox[] = []

  const sections: Array<() => void> = []
  if (shaGroups.length > 0) {
    sections.push(() => shaCheckboxes.push(...renderShaGroupSection(actionEl, shaGroups)))
  }
  if (autoRows.length > 0) {
    sections.push(() => autoCheckboxes.push(...renderBrokenAutoFixSection(actionEl, autoRows)))
  }
  if (fuzzyRows.length > 0) {
    sections.push(() => fuzzyControls.push(...renderBrokenFuzzySection(actionEl, fuzzyRows)))
  }
  if (manualRows.length > 0) {
    sections.push(() => manualCheckboxes.push(...renderBrokenManualSection(actionEl, manualRows)))
  }
  if (staleTombstoneRows.length > 0) {
    sections.push(() =>
      staleTombstoneCheckboxes.push(...renderStaleTombstoneSection(actionEl, staleTombstoneRows)),
    )
  }

  sections.forEach((render, i) => {
    if (i > 0) {
      actionEl.createEl('hr', { cls: 'wikey-maintenance-modal-section-divider' })
    }
    render()
  })

  renderConfirmActions(
    actionEl,
    hooks,
    shaCheckboxes,
    autoCheckboxes,
    fuzzyControls,
    manualCheckboxes,
    staleTombstoneCheckboxes,
  )
}

interface ShaCheckbox {
  readonly input: HTMLInputElement
  readonly sha: string
}

interface BrokenCheckbox {
  readonly input: HTMLInputElement
  readonly source: string
  readonly brokenTarget: string
  readonly replacement: string
}

function renderShaGroupSection(
  actionEl: HTMLElement,
  groups: readonly ShaGroup[],
): readonly ShaCheckbox[] {
  if (groups.length === 0) return []
  const list = actionEl.createEl('ul', { cls: 'wikey-maintenance-modal-confirm-list' })
  const out: ShaCheckbox[] = []
  for (const g of groups) {
    const li = list.createEl('li')
    const label = li.createEl('label', { cls: 'wikey-maintenance-modal-confirm-row' })
    // `type` via `attr` for compatibility with the obsidian-mock applyOpts
    // helper (which doesn't surface a `type` shorthand). Real Obsidian's
    // createEl supports both shapes; the attr form is the lowest common path.
    const input = label.createEl('input', { attr: { type: 'checkbox' } }) as HTMLInputElement
    input.checked = true
    label.appendChild(
      document.createTextNode(` ${g.sha} (${g.pageCount} pages)`),
    )
    out.push({ input, sha: g.sha })
  }
  return out
}

/**
 * §5.19 v0.4 Batch 6 (R12) — control records returned by the three broken-link
 * sub-section renderers. Each section captures its own selection shape so the
 * [실행] click can aggregate them into a single `brokenFixes` payload.
 */
interface FuzzyControl {
  readonly input: HTMLInputElement
  readonly select: HTMLSelectElement
  readonly source: string
  readonly brokenTarget: string
}

interface ManualCheckbox {
  readonly input: HTMLInputElement
  readonly source: string
  readonly brokenTarget: string
}

/**
 * Auto-fix section (case-insensitive). Checkbox + inline `[[X]] → [[Y]]`
 * label, pre-checked so the common path is single-click confirm. Wired to
 * `applyBrokenWikilinkFix({ fixes })` via the parent step-2 action row.
 */
function renderBrokenAutoFixSection(
  actionEl: HTMLElement,
  rows: readonly BrokenLinkRow[],
): readonly BrokenCheckbox[] {
  const section = createSection(actionEl, `Auto-fix broken wikilinks (${rows.length})`)
  const list = section.createEl('ul', { cls: 'wikey-maintenance-modal-auto-fix-list' })
  const out: BrokenCheckbox[] = []
  for (const r of rows) {
    const li = list.createEl('li', { cls: 'wikey-maintenance-modal-broken-row' })
    const label = li.createEl('label', { cls: 'wikey-maintenance-modal-confirm-row' })
    const input = label.createEl('input', { attr: { type: 'checkbox' } }) as HTMLInputElement
    input.checked = true
    label.appendChild(
      document.createTextNode(` [[${r.brokenTarget}]] → [[${r.autoFixSlug}]]`),
    )
    li.createSpan({ cls: 'path', text: r.source })
    out.push({
      input,
      source: r.source,
      brokenTarget: r.brokenTarget,
      replacement: r.autoFixSlug!,
    })
  }
  return out
}

/**
 * §5.19 v0.4 Batch 6 (R12) — fuzzy section with a `<select>` dropdown per row
 * (top-3 candidate slugs). The dropdown defaults to the highest-similarity
 * candidate so users can one-click apply when the auto-suggestion is correct.
 * Checkbox starts unchecked because fuzzy decisions are user-driven (the spec
 * forbids silent fix for ambiguous mappings).
 */
function renderBrokenFuzzySection(
  actionEl: HTMLElement,
  rows: readonly BrokenLinkRow[],
): readonly FuzzyControl[] {
  const section = createSection(actionEl, `Manual review — fuzzy match (${rows.length})`)
  const list = section.createEl('ul', { cls: 'wikey-maintenance-modal-fuzzy-list' })
  const out: FuzzyControl[] = []
  for (const r of rows) {
    const li = list.createEl('li', { cls: 'wikey-maintenance-modal-broken-row' })
    const label = li.createEl('label', { cls: 'wikey-maintenance-modal-confirm-row' })
    const input = label.createEl('input', { attr: { type: 'checkbox' } }) as HTMLInputElement
    input.checked = false
    label.appendChild(document.createTextNode(` [[${r.brokenTarget}]] → `))
    const select = label.createEl('select', {
      cls: 'wikey-maintenance-modal-fuzzy-select',
    }) as HTMLSelectElement
    for (const c of r.candidates) {
      const opt = select.createEl('option', {
        text: `${c.slug} (similarity ${c.similarity.toFixed(2)})`,
      }) as HTMLOptionElement
      opt.value = c.slug
    }
    li.createSpan({ cls: 'path', text: r.source })
    out.push({ input, select, source: r.source, brokenTarget: r.brokenTarget })
  }
  return out
}

/**
 * §5.19 v0.4 Batch 6 (R12) — no-match section: checkbox-only rows so users can
 * mark wikilinks for follow-up (e.g., create-new-page workflow in a future
 * cycle). Selection currently doesn't drive `applyBrokenWikilinkFix` — Batch 6
 * scope is UI-only manual-flag tracking; create-new-page is Batch 7+ scope.
 */
function renderBrokenManualSection(
  actionEl: HTMLElement,
  rows: readonly BrokenLinkRow[],
): readonly ManualCheckbox[] {
  const section = createSection(actionEl, `Manual review — no match (${rows.length})`)
  const list = section.createEl('ul', { cls: 'wikey-maintenance-modal-no-match-list' })
  const out: ManualCheckbox[] = []
  for (const r of rows) {
    const li = list.createEl('li', { cls: 'wikey-maintenance-modal-broken-row' })
    const label = li.createEl('label', { cls: 'wikey-maintenance-modal-confirm-row' })
    const input = label.createEl('input', { attr: { type: 'checkbox' } }) as HTMLInputElement
    input.checked = false
    label.appendChild(document.createTextNode(` [[${r.brokenTarget}]]`))
    li.createSpan({ cls: 'path', text: r.source })
    out.push({ input, source: r.source, brokenTarget: r.brokenTarget })
  }
  return out
}

/**
 * Section header + container helper. Every Step 2 sub-section uses the same
 * shell (title row + content `<ul>`) so the styling can target a single
 * class. Returned element is the section body — caller appends its rows.
 */
function createSection(actionEl: HTMLElement, title: string): HTMLElement {
  const section = actionEl.createDiv({ cls: 'wikey-maintenance-modal-section' })
  section.createEl('h4', {
    cls: 'wikey-maintenance-modal-section-title',
    text: title,
  })
  return section
}

function renderConfirmActions(
  actionEl: HTMLElement,
  hooks: ConfirmViewHooks,
  shaCheckboxes: readonly ShaCheckbox[],
  autoCheckboxes: readonly BrokenCheckbox[],
  fuzzyControls: readonly FuzzyControl[],
  manualCheckboxes: readonly ManualCheckbox[],
  staleTombstoneCheckboxes: readonly StaleTombstoneCheckbox[],
): void {
  // §5.21 follow-up (사용자 raise 2026-05-13) — Select all / Deselect all 토글.
  // 수백 개 checkbox 수동 클릭 회피. 모든 section 의 checkbox + fuzzy select 행을
  // 일괄 토글 (auto / fuzzy / manual / sha / stale-tombstone 모두 영향).
  const allInputs: HTMLInputElement[] = [
    ...shaCheckboxes.map((c) => c.input),
    ...autoCheckboxes.map((c) => c.input),
    ...fuzzyControls.map((c) => c.input),
    ...manualCheckboxes.map((c) => c.input),
    ...staleTombstoneCheckboxes.map((c) => c.input),
  ]
  if (allInputs.length > 0) {
    const toggleRow = actionEl.createDiv({ cls: 'wikey-maintenance-modal-select-toggle' })
    const selectAllBtn = toggleRow.createEl('button', {
      text: `Select all (${allInputs.length})`,
      cls: 'wikey-maintenance-modal-select-all-btn',
    })
    selectAllBtn.addEventListener('click', () => {
      for (const inp of allInputs) inp.checked = true
    })
    const deselectAllBtn = toggleRow.createEl('button', {
      text: 'Deselect all',
      cls: 'wikey-maintenance-modal-deselect-all-btn',
    })
    deselectAllBtn.addEventListener('click', () => {
      for (const inp of allInputs) inp.checked = false
    })
  }
  const btnRow = actionEl.createDiv({ cls: 'wikey-maintenance-modal-action-buttons' })
  const execBtn = btnRow.createEl('button', {
    text: 'Execute',
    cls: 'wikey-maintenance-modal-execute-btn',
  })
  execBtn.addEventListener('click', () => {
    const selectedShas = shaCheckboxes.filter((c) => c.input.checked).map((c) => c.sha)
    const brokenFixes: BrokenFixRequest[] = []
    for (const c of autoCheckboxes) {
      if (!c.input.checked) continue
      brokenFixes.push({
        source: c.source,
        brokenTarget: c.brokenTarget,
        replacement: c.replacement,
      })
    }
    for (const c of fuzzyControls) {
      if (!c.input.checked) continue
      brokenFixes.push({
        source: c.source,
        brokenTarget: c.brokenTarget,
        replacement: c.select.value,
      })
    }
    const staleTombstoneIds = staleTombstoneCheckboxes
      .filter((c) => c.input.checked)
      .map((c) => c.id)
    hooks.onExecute({ selectedShas, brokenFixes, staleTombstoneIds })
  })
  const cancelBtn = btnRow.createEl('button', {
    text: 'Cancel',
    cls: 'wikey-maintenance-modal-cancel-btn',
  })
  cancelBtn.addEventListener('click', () => {
    hooks.onCancel()
  })
}

// ─── §5.19 v0.5 R4 — stale-tombstone collection + render ────────────────────

interface StaleTombstoneRow {
  readonly id: string
  readonly note: string | undefined
}

interface StaleTombstoneCheckbox {
  readonly input: HTMLInputElement
  readonly id: string
}

/**
 * Extract `sha256:<id>` tokens out of stale-tombstone findings. `check.ts`
 * emits both hash-equality (helper-exact) and path-based variants — the latter
 * arrive with a ` (path-based)` suffix on the detail string. We split the
 * suffix off as a separate `note` so the UI can disambiguate without re-
 * parsing.
 */
function collectStaleTombstoneRows(
  findings: readonly MaintenanceFinding[],
): readonly StaleTombstoneRow[] {
  const out: StaleTombstoneRow[] = []
  const seen = new Set<string>()
  for (const f of findings) {
    if (f.kind !== 'stale-tombstone') continue
    const raw = (f.detail ?? '').trim()
    if (!raw) continue
    // sha256:<hex-or-test-id> with optional ` (path-based)` suffix produced by
    // `check.ts`. Test fixtures use slug-style ids (`sha256:stale-1`) so the
    // pattern intentionally accepts hyphens/underscores alongside hex.
    const m = raw.match(/^(sha256:[A-Za-z0-9_-]+)(?:\s+\((.+)\))?$/)
    if (!m) continue
    const id = m[1]!
    if (seen.has(id)) continue
    seen.add(id)
    out.push({ id, note: m[2] ?? undefined })
  }
  return out
}

function renderStaleTombstoneSection(
  actionEl: HTMLElement,
  rows: readonly StaleTombstoneRow[],
): readonly StaleTombstoneCheckbox[] {
  const section = createSection(actionEl, `Stale Tombstone (${rows.length})`)
  const list = section.createEl('ul', { cls: 'wikey-maintenance-modal-stale-tombstone-list' })
  const out: StaleTombstoneCheckbox[] = []
  for (const r of rows) {
    const li = list.createEl('li', { cls: 'wikey-maintenance-modal-stale-tombstone-row' })
    const label = li.createEl('label', { cls: 'wikey-maintenance-modal-confirm-row' })
    const input = label.createEl('input', { attr: { type: 'checkbox' } }) as HTMLInputElement
    // Default checked — matches the sha-grouped (dangling) row default. Users
    // entered Step 2 by clicking "Apply fix" with the stale-tombstone findings
    // already surfaced, so opt-out per row is the consistent behaviour.
    // Core-side `applyStaleTombstoneCleanup` still guards against active
    // records via the `protectedIds` invariant (I-PURGE-4).
    input.checked = true
    const suffix = r.note ? ` (${r.note})` : ''
    label.appendChild(document.createTextNode(` ${r.id}${suffix}`))
    out.push({ input, id: r.id })
  }
  return out
}

// ─── §5.19 v0.5 R6 — Refactoring archive Step 2 ────────────────────────────

/**
 * Refactoring archive selection payload — pages the user opted to move under
 * `wiki/archive/`. Duplicates contribute the second (lexicographically later)
 * slug of each pair so the canonical winner stays in place; users who want a
 * different winner can edit pages manually then re-run the modal.
 */
export interface RefactoringArchivePayload {
  readonly archivePaths: readonly string[]
}

export interface RefactoringStep2Hooks {
  readonly onExecute: (payload: RefactoringArchivePayload) => void
  readonly onCancel: () => void
}

export interface RefactoringStep2Data {
  /**
   * Duplicate pairs — slug-level (no full path). The UI archives the `b` side
   * of each pair (later in collation); we map `b` → `wiki/<category>/<b>.md`
   * via the caller-supplied `slugToPathHint` lookup so the core archive helper
   * gets a full path. Pairs without a path hint are skipped (silent — the
   * archive helper is a no-op on missing files anyway).
   */
  readonly duplicates: readonly { readonly a: string; readonly b: string; readonly similarity: number }[]
  /** Low-utility paths surfaced directly by `getRefactoringSuggestions`. */
  readonly lowUtility: readonly { readonly path: string; readonly lastUpdated: string; readonly backlinkCount: number }[]
  /**
   * `slug → wiki/<category>/<slug>.md` lookup. Caller computes it once from
   * the `WikiFS.walk('wiki')` result so the view stays IO-free.
   */
  readonly slugToPath: ReadonlyMap<string, string>
}

interface RefactorCheckbox {
  readonly input: HTMLInputElement
  readonly path: string
}

export function renderRefactoringStep2(
  actionEl: HTMLElement,
  data: RefactoringStep2Data,
  hooks: RefactoringStep2Hooks,
): void {
  actionEl.empty()
  actionEl.createEl('div', {
    cls: 'wikey-maintenance-modal-step-2 wikey-maintenance-modal-step-2-header',
    text: 'Step 2 — Select pages to archive:',
  })

  const dupCheckboxes: RefactorCheckbox[] = []
  const lowUtilCheckboxes: RefactorCheckbox[] = []
  const sections: Array<() => void> = []
  if (data.duplicates.length > 0) {
    sections.push(() =>
      dupCheckboxes.push(...renderRefactorDuplicatesSection(actionEl, data.duplicates, data.slugToPath)),
    )
  }
  if (data.lowUtility.length > 0) {
    sections.push(() =>
      lowUtilCheckboxes.push(...renderRefactorLowUtilitySection(actionEl, data.lowUtility)),
    )
  }
  sections.forEach((render, i) => {
    if (i > 0) {
      actionEl.createEl('hr', { cls: 'wikey-maintenance-modal-section-divider' })
    }
    render()
  })

  renderRefactoringStep2Actions(actionEl, hooks, dupCheckboxes, lowUtilCheckboxes)
}

function renderRefactorDuplicatesSection(
  actionEl: HTMLElement,
  duplicates: RefactoringStep2Data['duplicates'],
  slugToPath: ReadonlyMap<string, string>,
): readonly RefactorCheckbox[] {
  const section = createSection(actionEl, `Duplicate pages (${duplicates.length})`)
  const list = section.createEl('ul', {
    cls: 'wikey-maintenance-modal-refactor-duplicates-list',
  })
  const out: RefactorCheckbox[] = []
  for (const pair of duplicates) {
    // Archive the `b` slug — keep `a` as the canonical winner (lexicographic).
    const path = slugToPath.get(pair.b)
    if (!path) continue
    const li = list.createEl('li', { cls: 'wikey-maintenance-modal-refactor-row' })
    const label = li.createEl('label', { cls: 'wikey-maintenance-modal-confirm-row' })
    const input = label.createEl('input', { attr: { type: 'checkbox' } }) as HTMLInputElement
    input.checked = true
    label.appendChild(
      document.createTextNode(
        ` Keep [[${pair.a}]], archive [[${pair.b}]] (similarity ${pair.similarity.toFixed(2)})`,
      ),
    )
    out.push({ input, path })
  }
  return out
}

function renderRefactorLowUtilitySection(
  actionEl: HTMLElement,
  lowUtility: RefactoringStep2Data['lowUtility'],
): readonly RefactorCheckbox[] {
  const section = createSection(actionEl, `Low-utility pages (${lowUtility.length})`)
  const list = section.createEl('ul', {
    cls: 'wikey-maintenance-modal-refactor-low-utility-list',
  })
  const out: RefactorCheckbox[] = []
  for (const entry of lowUtility) {
    const li = list.createEl('li', { cls: 'wikey-maintenance-modal-refactor-row' })
    const label = li.createEl('label', { cls: 'wikey-maintenance-modal-confirm-row' })
    const input = label.createEl('input', { attr: { type: 'checkbox' } }) as HTMLInputElement
    input.checked = true
    label.appendChild(
      document.createTextNode(
        ` ${entry.path} (updated ${entry.lastUpdated}, ${entry.backlinkCount} backlinks)`,
      ),
    )
    out.push({ input, path: entry.path })
  }
  return out
}

function renderRefactoringStep2Actions(
  actionEl: HTMLElement,
  hooks: RefactoringStep2Hooks,
  dupCheckboxes: readonly RefactorCheckbox[],
  lowUtilCheckboxes: readonly RefactorCheckbox[],
): void {
  const btnRow = actionEl.createDiv({ cls: 'wikey-maintenance-modal-action-buttons' })
  const execBtn = btnRow.createEl('button', {
    text: 'Execute',
    cls: 'wikey-maintenance-modal-execute-btn',
  })
  execBtn.addEventListener('click', () => {
    const archivePaths: string[] = []
    for (const c of dupCheckboxes) if (c.input.checked) archivePaths.push(c.path)
    for (const c of lowUtilCheckboxes) if (c.input.checked) archivePaths.push(c.path)
    hooks.onExecute({ archivePaths })
  })
  const cancelBtn = btnRow.createEl('button', {
    text: 'Cancel',
    cls: 'wikey-maintenance-modal-cancel-btn',
  })
  cancelBtn.addEventListener('click', () => {
    hooks.onCancel()
  })
}

/** AC-UI-5 — step-3 in-progress marker (transition between confirm + complete). */
export function renderStep3InProgress(actionEl: HTMLElement): void {
  actionEl.empty()
  actionEl.createEl('div', {
    cls: 'wikey-maintenance-modal-step-3-running',
    text: 'Step 3 — In progress (applying fixes)…',
  })
}

/**
 * AC-UI-5 — step-3 complete + Close button.
 *
 * §5.19 v0.4 (R4 fix) — `onClose` wires the footer Close click to the modal's
 * dismiss path (parity with `renderHealthyView`).
 */
export function renderStep3Complete(
  actionEl: HTMLElement,
  changedPagesCount: number,
  onClose: () => void,
): void {
  actionEl.empty()
  actionEl.createEl('div', {
    cls: 'wikey-maintenance-modal-step-3',
    text: `Step 3 — Done (${changedPagesCount} pages updated)`,
  })
  const closeBtn = actionEl.createEl('button', {
    text: 'Close',
    cls: 'wikey-maintenance-modal-close-btn',
  })
  closeBtn.addEventListener('click', () => {
    onClose()
  })
}

