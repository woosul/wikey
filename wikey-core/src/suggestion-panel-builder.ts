import type { Suggestion, SuggestionStore } from './types.js'
import { updateSuggestionState, rejectSuggestion as rejectInStore } from './suggestion-storage.js'

/**
 * §5.4.2 AC6 — pure helpers for the Audit Suggestions panel.
 *
 * ⚠️ **§5.10.4 D-wide 폐기 (2026-05-05)** — Suggestions panel UI (sidebar-chat.ts) 제거,
 * public API 제거 (index.ts). test (.skip) + 본 file 은 historical reference.
 */

export interface SuggestionCardModel {
  readonly id: string
  readonly title: string
  readonly confidenceLabel: string
  readonly summary: string
  readonly componentSlugs: readonly string[]
  readonly evidenceLines: readonly string[]
  readonly actions: {
    readonly accept: boolean
    readonly edit: boolean
    readonly reject: boolean
  }
}

/** Build the renderable model. Action buttons disable themselves once the
 * suggestion leaves `pending`, but the card remains displayed for transparency. */
export function buildSuggestionCardModel(s: Suggestion): SuggestionCardModel {
  const enabled = s.state.kind === 'pending'
  const name = s.umbrella_name ?? s.umbrella_slug
  return {
    id: s.id,
    title: `${name} 패턴 감지`,
    confidenceLabel: `confidence ${s.confidence.toFixed(2)}`,
    summary: `${s.support_count} source 에서 ${s.mention_count} mention`,
    componentSlugs: s.candidate_components.map((c) => c.slug),
    evidenceLines: s.evidence.map((e) => {
      const base = e.source.replace(/^wiki\/sources\//, '').replace(/\.md$/, '')
      return `${base} (${e.mentions.length} mention)`
    }),
    actions: { accept: enabled, edit: enabled, reject: enabled },
  }
}

/** Accept handler — transitions suggestion to `accepted`. Does NOT touch
 * schema.yaml (that is `appendStandardDecomposition`'s job, called separately
 * by the panel's accept flow). Keeps state-update + file-write decoupled. */
export function acceptSuggestion(
  store: SuggestionStore,
  id: string,
  acceptedAt: string = new Date().toISOString(),
): SuggestionStore {
  return updateSuggestionState(store, id, { kind: 'accepted', acceptedAt })
}

/** Reject handler — thin re-export so the panel layer pulls everything from
 * one module, mirroring `acceptSuggestion`. */
export function rejectSuggestionFromPanel(
  store: SuggestionStore,
  id: string,
  reason?: string,
): SuggestionStore {
  return rejectInStore(store, id, reason)
}
