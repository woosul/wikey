import { describe, it, expect } from 'vitest'
import {
  buildSuggestionCardModel,
  acceptSuggestion,
} from '../suggestion-panel-builder.js'
import { addSuggestion, emptyStore } from '../suggestion-storage.js'
import type { Suggestion } from '../types.js'

/**
 * §5.4 Stage 2 AC6 — pure helpers feeding the Audit Suggestions panel.
 * DOM rendering lives in wikey-obsidian/sidebar-chat.ts and is exercised by
 * the §5.4.5 live cycle smoke (Obsidian CDP). These tests cover the pure
 * data-shape + accept/reject handlers.
 *
 * Spec ref: plan/phase-5-todox-5.4-integration.md §3.2.4.
 */

const sample: Suggestion = {
  id: 'sha1-iso',
  umbrella_slug: 'iso-27001',
  umbrella_name: 'ISO 27001',
  candidate_components: [
    { slug: 'iso-27001-a-5', type: 'methodology' },
    { slug: 'iso-27001-a-6', type: 'methodology' },
    { slug: 'iso-27001-a-12', type: 'methodology' },
  ],
  support_count: 3,
  suffix_score: 0.85,
  mention_count: 17,
  confidence: 0.72,
  evidence: [
    { source: 'wiki/sources/source-iso-overview.md', mentions: ['iso-27001-a-5'], observedAt: '2026-05-01T12:00:00Z' },
    { source: 'wiki/sources/source-iso-detail.md', mentions: ['iso-27001-a-6'], observedAt: '2026-05-01T13:00:00Z' },
  ],
  state: { kind: 'pending' },
  createdAt: '2026-05-01T12:00:00Z',
  updatedAt: '2026-05-01T12:00:00Z',
}

describe('buildSuggestionCardModel', () => {
  it('exposes confidence + umbrella name + components + evidence summary for the card', () => {
    const model = buildSuggestionCardModel(sample)
    expect(model.title).toContain('ISO 27001')
    expect(model.confidenceLabel).toBe('confidence 0.72')
    expect(model.componentSlugs).toEqual([
      'iso-27001-a-5', 'iso-27001-a-6', 'iso-27001-a-12',
    ])
    expect(model.evidenceLines).toHaveLength(2)
    expect(model.evidenceLines[0]).toContain('source-iso-overview')
    // Action buttons all enabled while pending.
    expect(model.actions.accept).toBe(true)
    expect(model.actions.edit).toBe(true)
    expect(model.actions.reject).toBe(true)
  })
})

describe('acceptSuggestion', () => {
  it('transitions state pending → accepted via storage updater (immutable)', () => {
    const store = addSuggestion(emptyStore(), sample)
    const next = acceptSuggestion(store, sample.id, '2026-05-02T08:00:00Z')
    expect(next.suggestions).toHaveLength(1)
    expect(next.suggestions[0].state.kind).toBe('accepted')
    if (next.suggestions[0].state.kind === 'accepted') {
      expect(next.suggestions[0].state.acceptedAt).toBe('2026-05-02T08:00:00Z')
    }
    // original unchanged
    expect(store.suggestions[0].state.kind).toBe('pending')
  })
})
