import { describe, it, expect } from 'vitest'
import {
  addSuggestion,
  updateSuggestionState,
  rejectSuggestion,
  isInNegativeCache,
  emptyStore,
} from '../suggestion-storage.js'
import type { Suggestion, SuggestionStore } from '../types.js'

/**
 * §5.4 Stage 2 AC2 — SuggestionStorage immutable pure-function API.
 *
 * Spec ref: plan/phase-5-todox-5.4-integration.md §3.2.1.
 */

const sample = (overrides: Partial<Suggestion> = {}): Suggestion => ({
  id: 'sha1-iso-27001-default',
  umbrella_slug: 'iso-27001',
  umbrella_name: 'ISO 27001',
  candidate_components: [
    { slug: 'iso-27001-a-5', type: 'methodology' },
    { slug: 'iso-27001-a-6', type: 'methodology' },
  ],
  support_count: 3,
  suffix_score: 0.85,
  mention_count: 17,
  confidence: 0.72,
  evidence: [
    {
      source: 'wiki/sources/source-iso-27001-overview.md',
      mentions: ['iso-27001-a-5', 'iso-27001-a-6'],
      observedAt: '2026-05-01T12:34:56Z',
    },
  ],
  state: { kind: 'pending' },
  createdAt: '2026-05-01T12:34:56Z',
  updatedAt: '2026-05-01T12:34:56Z',
  ...overrides,
})

describe('SuggestionStorage — addSuggestion', () => {
  it('returns a new immutable store with the suggestion appended; original unchanged', () => {
    const store = emptyStore()
    const s = sample()
    const next = addSuggestion(store, s)

    // Immutable: new object reference
    expect(next).not.toBe(store)
    // Original unchanged
    expect(store.suggestions).toHaveLength(0)
    // New store contains exactly the appended suggestion
    expect(next.suggestions).toHaveLength(1)
    expect(next.suggestions[0]).toBe(s)
    // version preserved
    expect(next.version).toBe(1)
    // negativeCache untouched
    expect(next.negativeCache).toEqual(store.negativeCache)
  })
})

describe('SuggestionStorage — updateSuggestionState', () => {
  it('transitions a pending suggestion to accepted (immutable)', () => {
    const initial = addSuggestion(emptyStore(), sample())
    const acceptedState = { kind: 'accepted' as const, acceptedAt: '2026-05-02T08:00:00Z' }
    const next = updateSuggestionState(initial, 'sha1-iso-27001-default', acceptedState)

    expect(next).not.toBe(initial)
    expect(initial.suggestions[0].state.kind).toBe('pending')
    expect(next.suggestions).toHaveLength(1)
    expect(next.suggestions[0].state.kind).toBe('accepted')
    if (next.suggestions[0].state.kind === 'accepted') {
      expect(next.suggestions[0].state.acceptedAt).toBe('2026-05-02T08:00:00Z')
    }
    // updatedAt mutates forward; createdAt preserved
    expect(next.suggestions[0].createdAt).toBe(initial.suggestions[0].createdAt)
  })
})

describe('SuggestionStorage — rejectSuggestion', () => {
  it('marks state rejected, preserves reason, and registers negativeCache id', () => {
    const initial = addSuggestion(emptyStore(), sample({ id: 'sha1-reject-me' }))
    const next = rejectSuggestion(initial, 'sha1-reject-me', 'too marketing-y')

    expect(next).not.toBe(initial)
    expect(next.suggestions[0].state.kind).toBe('rejected')
    if (next.suggestions[0].state.kind === 'rejected') {
      expect(next.suggestions[0].state.reason).toBe('too marketing-y')
      expect(next.suggestions[0].state.rejectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    }
    expect(next.negativeCache).toContain('sha1-reject-me')
    expect(isInNegativeCache(next, 'sha1-reject-me')).toBe(true)
    // unrelated id stays out
    expect(isInNegativeCache(next, 'sha1-other')).toBe(false)
  })
})
