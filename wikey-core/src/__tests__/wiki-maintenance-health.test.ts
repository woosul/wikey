/**
 * §5.19 v0.4 (R6/R10/I-HEALTH-1) — `isWikiHealthy` / `isRefactoringHealthy`.
 *
 * Spec: docs/planning/phase-5/phase-5-spec-5.19-wiki-maintenance-suite.md v0.4 I-HEALTH-1.
 *
 * AC mapping:
 *   - AC-S1-3  → isWikiHealthy returns false when any metric > 0
 *   - AC-R4-4  → isRefactoringHealthy returns false when duplicates|lowUtility > 0
 */

import { describe, it, expect } from 'vitest'
import { isWikiHealthy, isRefactoringHealthy } from '../wiki/maintenance.js'

describe('§5.19 v0.4 isWikiHealthy (R6/AC-S1-3)', () => {
  it('returns true when all four metrics are zero', () => {
    expect(
      isWikiHealthy({
        brokenLinkCount: 0,
        danglingCrossLinkCount: 0,
        staleTombstoneCount: 0,
        orphanCount: 0,
      }),
    ).toBe(true)
  })

  it('returns false when brokenLinkCount > 0 (master cdp readings: 6936)', () => {
    expect(
      isWikiHealthy({
        brokenLinkCount: 6936,
        danglingCrossLinkCount: 0,
        staleTombstoneCount: 0,
        orphanCount: 0,
      }),
    ).toBe(false)
  })

  it('returns false when only danglingCrossLinkCount > 0 (§5.18 38-page case)', () => {
    expect(
      isWikiHealthy({
        brokenLinkCount: 0,
        danglingCrossLinkCount: 38,
        staleTombstoneCount: 0,
        orphanCount: 0,
      }),
    ).toBe(false)
  })

  it('returns false when only staleTombstoneCount > 0', () => {
    expect(
      isWikiHealthy({
        brokenLinkCount: 0,
        danglingCrossLinkCount: 0,
        staleTombstoneCount: 1,
        orphanCount: 0,
      }),
    ).toBe(false)
  })

  it('returns false when only orphanCount > 0', () => {
    expect(
      isWikiHealthy({
        brokenLinkCount: 0,
        danglingCrossLinkCount: 0,
        staleTombstoneCount: 0,
        orphanCount: 5,
      }),
    ).toBe(false)
  })
})

describe('§5.19 v0.4 isRefactoringHealthy (R10/AC-R4-4)', () => {
  it('returns true when both duplicates + lowUtility are empty', () => {
    expect(
      isRefactoringHealthy({
        duplicates: { length: 0 },
        lowUtility: { length: 0 },
      }),
    ).toBe(true)
  })

  it('returns false when duplicates > 0 (master cdp readings: 2)', () => {
    expect(
      isRefactoringHealthy({
        duplicates: { length: 2 },
        lowUtility: { length: 0 },
      }),
    ).toBe(false)
  })

  it('returns false when lowUtility > 0 (master cdp readings: 1)', () => {
    expect(
      isRefactoringHealthy({
        duplicates: { length: 0 },
        lowUtility: { length: 1 },
      }),
    ).toBe(false)
  })

  it('accepts the actual RefactoringSuggestions shape (readonly array length)', () => {
    // Smoke check: production `getRefactoringSuggestions` returns readonly arrays
    // whose `.length` field matches the predicate contract.
    const suggestions = {
      duplicates: [{ a: 'foo', b: 'bar', similarity: 0.9 }] as readonly unknown[],
      lowUtility: [] as readonly unknown[],
    }
    expect(isRefactoringHealthy(suggestions)).toBe(false)
  })
})
