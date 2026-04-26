import type { Suggestion, SuggestionState, SuggestionStore } from './types.js'

/**
 * §5.4.2 AC2 — Pure-function API around `SuggestionStore`. Every mutation
 * returns a fresh store object (`{ ...prev, ... }`) so callers can rely on
 * structural sharing without local mutation. No I/O lives here — readers /
 * writers are injected at the pipeline layer (see plan §3.2.1).
 */

/** Empty store seed — version 1, no suggestions, empty negative cache. */
export function emptyStore(): SuggestionStore {
  return { version: 1, suggestions: [], negativeCache: [] }
}

/** Append a suggestion. If `id` already exists the prior entry is replaced
 * (idempotent re-add, e.g. when re-evaluating the same pattern). */
export function addSuggestion(store: SuggestionStore, s: Suggestion): SuggestionStore {
  const filtered = store.suggestions.filter((x) => x.id !== s.id)
  return { ...store, suggestions: [...filtered, s] }
}

/** Replace one suggestion's `state` (immutable). No-op if id missing. */
export function updateSuggestionState(
  store: SuggestionStore,
  id: string,
  state: SuggestionState,
): SuggestionStore {
  const updatedAt = new Date().toISOString()
  const suggestions = store.suggestions.map((s) =>
    s.id === id ? { ...s, state, updatedAt } : s,
  )
  return { ...store, suggestions }
}

/** Reject + register negativeCache (id won't be re-suggested). Reason optional. */
export function rejectSuggestion(
  store: SuggestionStore,
  id: string,
  reason?: string,
): SuggestionStore {
  const rejectedAt = new Date().toISOString()
  const state: SuggestionState = reason !== undefined
    ? { kind: 'rejected', rejectedAt, reason }
    : { kind: 'rejected', rejectedAt }
  const next = updateSuggestionState(store, id, state)
  if (next.negativeCache.includes(id)) return next
  return { ...next, negativeCache: [...next.negativeCache, id] }
}

/** True iff the id is in the negative cache (rejected previously). */
export function isInNegativeCache(store: SuggestionStore, id: string): boolean {
  return store.negativeCache.includes(id)
}
