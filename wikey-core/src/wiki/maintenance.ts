/**
 * §5.19 Wiki maintenance suite — barrel re-export.
 *
 * Spec: plan/phase-5/phase-5-spec-5.19-wiki-maintenance-suite.md v0.2
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

export { getRefactoringSuggestions, slugSimilarity } from './maintenance/refactoring.js'
export type {
  DuplicatePair,
  LowUtilityEntry,
  RefactoringConfigFallback,
  RefactoringSuggestions,
  GetRefactoringSuggestionsOptions,
} from './maintenance/refactoring.js'
