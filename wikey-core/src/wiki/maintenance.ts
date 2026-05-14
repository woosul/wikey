/**
 * §5.19 Wiki maintenance suite — barrel re-export.
 *
 * Spec: docs/planning/phase-5/phase-5-spec-5.19-wiki-maintenance-suite.md v0.2
 *
 * Implementation split across `maintenance/{status,check,recovery,refactoring,helpers}.ts`
 * (BLUE refactor 2026-05-12 — keep each ≤ 200 LOC per spec §3 Dependencies).
 * External import path `../wiki/maintenance.js` preserved — tests + `src/index.ts`
 * surface unchanged.
 */

export {
  getWikiStatus,
  __resetWikiStatusCacheForTest,
} from './maintenance/status.js'
export type { WikiStatus, GetWikiStatusOptions } from './maintenance/status.js'

export { runWikiCheck } from './maintenance/check.js'
export type { Finding, WikiCheckReport, RunWikiCheckOptions } from './maintenance/check.js'

export { applyWikiRecovery } from './maintenance/recovery.js'
export type { WikiRecoveryReport, ApplyWikiRecoveryOptions } from './maintenance/recovery.js'

// §5.19 v0.4 Batch 5 (R8 / G1) — Check Fix link mode a (broken wikilink fix).
// Mode b stays in `applyWikiRecovery` (recovery.ts); the modal aggregates both
// via `executeFix` in `maintenance-modal.ts`.
export {
  detectBrokenWikilinks,
  applyBrokenWikilinkFix,
  levenshteinDistance,
} from './maintenance/fix-link.js'
export type {
  BrokenWikilinkFixCandidate,
  BrokenWikilinkFixKind,
  BrokenWikilinkCandidate,
  BrokenWikilinkFixRequest,
  BrokenWikilinkFixReport,
  DetectBrokenWikilinksOptions,
  ApplyBrokenWikilinkFixOptions,
} from './maintenance/fix-link.js'

export { getRefactoringSuggestions, slugSimilarity } from './maintenance/refactoring.js'
export type {
  DuplicatePair,
  LowUtilityEntry,
  RefactoringConfigFallback,
  RefactoringSuggestions,
  GetRefactoringSuggestionsOptions,
} from './maintenance/refactoring.js'

// §5.19 v0.5 R4 — stale tombstone purge (5 카테고리 fix path 중 stale-tombstone 분기).
export { applyStaleTombstoneCleanup } from './maintenance/tombstone-cleanup.js'
export type {
  ApplyStaleTombstoneCleanupOptions,
  StaleTombstoneCleanupReport,
} from './maintenance/tombstone-cleanup.js'

// §5.19 v0.5 R6 — refactoring archive (duplicates / lowUtility → wiki/archive/).
export { applyRefactoringArchive } from './maintenance/refactoring-archive.js'
export type {
  ApplyRefactoringArchiveOptions,
  RefactoringArchiveReport,
} from './maintenance/refactoring-archive.js'

// §5.19 v0.4 (R6/R10/I-HEALTH-1) — Health predicates shared by Status +
// Refactoring modals (and any future Dashboard pill). Re-exported here so
// `wikey-obsidian` can import via the maintenance barrel.
export { isWikiHealthy, isRefactoringHealthy } from './maintenance/helpers.js'
export type { WikiHealthMetrics, RefactoringHealthMetrics } from './maintenance/helpers.js'

// §5.19 v0.4 Batch 6 — wiki-check report exclusion + finding detail escape.
// Surfaces so wikey-obsidian (or future consumers) can keep the recursive
// feedback invariant without re-implementing the predicate.
export { escapeWikilinks, isWikiCheckReportPath } from './maintenance/helpers.js'
