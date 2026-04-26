import { describe, it, expect } from 'vitest'
import { runSuggestionDetection, appendIngestHistory } from '../suggestion-pipeline.js'
import type { CanonicalizedResult, IngestRecord } from '../types.js'

/**
 * §5.4 Stage 2 AC8 — ingest pipeline trigger.
 * Spec ref: plan/phase-5-todox-5.4-integration.md §3.2.3.
 */

const canon = (concepts: ReadonlyArray<{ slug: string; type: 'standard' | 'methodology' | 'document_type' }>): CanonicalizedResult => ({
  entities: [],
  concepts: concepts.map((c) => ({
    filename: c.slug,
    content: '',
    category: 'concepts',
    conceptType: c.type,
  })),
  dropped: [],
})

describe('runSuggestionDetection — pipeline trigger', () => {
  it('produces suggestions and an updated history when ingest finalize fires', () => {
    // History already holds two sources — adding a third pushes co-occurrence
    // for 'iso-27001-a-' over the 0.6 alpha cutoff (support_count=3,
    // unique_suffixes=1 by leading-segment shape, mention_count≥9, no builtin overlap).
    const earlier: IngestRecord[] = [
      {
        source: 'wiki/sources/source-iso-prior-1.md',
        ingestedAt: '2026-04-30T10:00:00Z',
        concepts: [
          { slug: 'iso-27001-a-5', type: 'methodology' },
          { slug: 'iso-27001-a-6', type: 'methodology' },
          { slug: 'iso-27001-a-7', type: 'methodology' },
        ],
        entities: [],
      },
    ]
    const result = runSuggestionDetection({
      history: earlier,
      sourcePath: 'wiki/sources/source-iso-27001.md',
      ingestedAt: '2026-05-01T12:00:00Z',
      canon: canon([
        { slug: 'iso-27001-a-5', type: 'methodology' },
        { slug: 'iso-27001-a-6', type: 'methodology' },
        { slug: 'iso-27001-a-7', type: 'methodology' },
      ]),
      negativeCache: [],
      confidenceCutoff: 0,                  // AC8 verifies trigger wiring, not cutoff
    })
    expect(result.updatedHistory).toHaveLength(2)
    expect(result.updatedHistory[1].source).toBe('wiki/sources/source-iso-27001.md')
    expect(result.updatedHistory[1].concepts).toHaveLength(3)
    expect(result.suggestions.length).toBeGreaterThanOrEqual(1)
    const iso = result.suggestions.find((s) => s.umbrella_slug === 'iso-27001-a-')
    expect(iso).toBeDefined()
    expect(iso!.id).toMatch(/^[a-f0-9]{40}$/)   // sha1
    expect(iso!.state.kind).toBe('pending')
    expect(iso!.support_count).toBe(1)         // co-occurrence is per-current-ingest only
  })

  it('appendIngestHistory dedups by sourcePath+ingestedAt (idempotent re-run)', () => {
    const initial: IngestRecord[] = []
    const record: IngestRecord = {
      source: 'wiki/sources/source-iso.md',
      ingestedAt: '2026-05-01T12:00:00Z',
      concepts: [{ slug: 'iso-27001-a-5', type: 'methodology' }],
      entities: [],
    }
    const after1 = appendIngestHistory(initial, record)
    const after2 = appendIngestHistory(after1, record)
    expect(after1).toHaveLength(1)
    expect(after2).toHaveLength(1)         // dedup
    // Different timestamp → distinct entry
    const after3 = appendIngestHistory(after2, { ...record, ingestedAt: '2026-05-02T00:00:00Z' })
    expect(after3).toHaveLength(2)
  })
})
