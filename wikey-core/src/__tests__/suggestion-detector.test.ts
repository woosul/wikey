import { describe, it, expect } from 'vitest'
import {
  detectCoOccurrence,
  detectSuffixCluster,
  computeConfidence,
} from '../suggestion-detector.js'
import type { CandidatePattern, IngestRecord } from '../types.js'

/**
 * §5.4 Stage 2 AC3 + AC4 + AC5 — pattern detection + confidence formula.
 * Spec ref: plan/phase-5-todox-5.4-integration.md §3.2.2.
 */

const ingest = (overrides: Partial<IngestRecord> & { source: string }): IngestRecord => ({
  ingestedAt: '2026-05-01T12:00:00Z',
  concepts: [],
  entities: [],
  ...overrides,
})

// ── AC3 — co-occurrence detector ──────────────────────────────────────────────

describe('detectCoOccurrence', () => {
  it('returns one candidate when ≥3 sibling concepts share a long prefix in one source', () => {
    const r = ingest({
      source: 'wiki/sources/source-iso-27001-overview.md',
      concepts: [
        { slug: 'iso-27001-a-5', type: 'methodology' },
        { slug: 'iso-27001-a-6', type: 'methodology' },
        { slug: 'iso-27001-a-7', type: 'methodology' },
      ],
    })
    const out = detectCoOccurrence(r)
    expect(out).toHaveLength(1)
    expect(out[0].umbrella_slug).toBe('iso-27001-a-')
    expect(out[0].support_count).toBe(1)            // single source
    expect(out[0].components.map((c) => c.slug).sort()).toEqual([
      'iso-27001-a-5', 'iso-27001-a-6', 'iso-27001-a-7',
    ])
    expect(out[0].overlapsWithBuiltin).toBe(false)
  })

  it('returns zero candidates below the minSiblings threshold (only 2 siblings)', () => {
    const r = ingest({
      source: 'wiki/sources/source-iso-thin.md',
      concepts: [
        { slug: 'iso-27001-a-5', type: 'methodology' },
        { slug: 'iso-27001-a-6', type: 'methodology' },
      ],
    })
    expect(detectCoOccurrence(r)).toHaveLength(0)
  })

  it('returns multiple candidates when several distinct prefix groups co-exist in one source', () => {
    const r = ingest({
      source: 'wiki/sources/source-mixed.md',
      concepts: [
        // PMBOK group (umbrella exists in BUILTIN)
        { slug: 'pmbok-task-1', type: 'methodology' },
        { slug: 'pmbok-task-2', type: 'methodology' },
        { slug: 'pmbok-task-3', type: 'methodology' },
        // ISO 27001 group
        { slug: 'iso-27001-a-5', type: 'methodology' },
        { slug: 'iso-27001-a-6', type: 'methodology' },
        { slug: 'iso-27001-a-7', type: 'methodology' },
      ],
    })
    const out = detectCoOccurrence(r)
    expect(out).toHaveLength(2)
    const slugs = out.map((c) => c.umbrella_slug).sort()
    expect(slugs).toEqual(['iso-27001-a-', 'pmbok-task-'])
  })

  it('rejects prefixes shorter than minPrefixLen (5 chars)', () => {
    const r = ingest({
      source: 'wiki/sources/source-short.md',
      concepts: [
        { slug: 'a-1', type: 'methodology' },
        { slug: 'a-2', type: 'methodology' },
        { slug: 'a-3', type: 'methodology' },
      ],
    })
    expect(detectCoOccurrence(r)).toHaveLength(0)
  })
})

// ── AC4 — suffix clustering ───────────────────────────────────────────────────

describe('detectSuffixCluster', () => {
  it('detects a whitelisted suffix shared across ≥2 sources', () => {
    const history: IngestRecord[] = [
      ingest({
        source: 'wiki/sources/source-a.md',
        concepts: [
          { slug: 'risk-management', type: 'methodology' },
          { slug: 'quality-management', type: 'methodology' },
        ],
      }),
      ingest({
        source: 'wiki/sources/source-b.md',
        concepts: [
          { slug: 'cost-management', type: 'methodology' },
          { slug: 'procurement-management', type: 'methodology' },
        ],
      }),
    ]
    const out = detectSuffixCluster(history)
    expect(out.length).toBeGreaterThanOrEqual(1)
    const mgmt = out.find((c) => c.umbrella_slug === 'cluster-management')
    expect(mgmt).toBeDefined()
    expect(mgmt!.support_count).toBe(2)
    // round-trip: schema.ts:435 parser regex /^[a-z][a-z0-9-]*$/ 와 일치 확인
    expect(/^[a-z][a-z0-9-]*$/.test(mgmt!.umbrella_slug)).toBe(true)
  })

  it('rejects suffixes outside the whitelist (e.g. -feature)', () => {
    const history: IngestRecord[] = [
      ingest({
        source: 'wiki/sources/source-marketing-a.md',
        concepts: [
          { slug: 'fast-feature', type: 'methodology' },
          { slug: 'cheap-feature', type: 'methodology' },
        ],
      }),
      ingest({
        source: 'wiki/sources/source-marketing-b.md',
        concepts: [
          { slug: 'easy-feature', type: 'methodology' },
        ],
      }),
    ]
    expect(detectSuffixCluster(history)).toHaveLength(0)
  })

  it('rejects when only a single source supports the suffix (minSources=2)', () => {
    const history: IngestRecord[] = [
      ingest({
        source: 'wiki/sources/source-solo.md',
        concepts: [
          { slug: 'risk-management', type: 'methodology' },
          { slug: 'quality-management', type: 'methodology' },
        ],
      }),
    ]
    expect(detectSuffixCluster(history)).toHaveLength(0)
  })
})

// ── AC5 — confidence formula ──────────────────────────────────────────────────

const candidate = (overrides: Partial<CandidatePattern> = {}): CandidatePattern => ({
  umbrella_slug: 'iso-27001',
  components: [],
  support_count: 5,
  unique_suffixes: 1,
  mention_count: 20,
  overlapsWithBuiltin: false,
  evidence: [],
  ...overrides,
})

describe('computeConfidence', () => {
  it('returns 1.0 at full saturation (5 sources, single suffix, 20 mentions, no builtin)', () => {
    const c = candidate({ support_count: 5, unique_suffixes: 1, mention_count: 20, overlapsWithBuiltin: false })
    expect(computeConfidence(c)).toBeCloseTo(1.0, 5)
  })

  it('caps at 0.9 when overlapping with BUILTIN (builtinOverlap weight goes to 0)', () => {
    const c = candidate({ support_count: 5, unique_suffixes: 1, mention_count: 20, overlapsWithBuiltin: true })
    expect(computeConfidence(c)).toBeCloseTo(0.9, 5)
  })

  it('passes the ≥0.6 alpha threshold for a moderately supported pattern (support=3, mentions=10)', () => {
    // 0.4 * (3/5) + 0.3 * 1 + 0.2 * (10/20) + 0.1 * 1 = 0.24 + 0.3 + 0.1 + 0.1 = 0.74
    const c = candidate({ support_count: 3, unique_suffixes: 1, mention_count: 10, overlapsWithBuiltin: false })
    expect(computeConfidence(c)).toBeCloseTo(0.74, 5)
  })
})
