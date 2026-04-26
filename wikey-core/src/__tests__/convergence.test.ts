/**
 * §5.4 Stage 4 — cross-source convergence tests (AC15~AC20).
 *
 * spec: plan/phase-5-todox-5.4-integration.md §3.4 (line 778-981)
 */

import { describe, it, expect, vi } from 'vitest'

import type {
  ConvergedDecomposition,
  IngestRecord,
  MentionCluster,
  SchemaOverride,
  SelfDeclaration,
  SourceMention,
  StandardDecompositionComponent,
} from '../types.js'
import {
  arbitrate,
  clusterMentionsAcrossSources,
  createConvergencePass,
  mergeAllSources,
  runConvergencePass,
} from '../convergence.js'

// ── AC15 — ConvergedDecomposition shape ────────────────────────────────────

describe('AC15 — ConvergedDecomposition / SourceMention shape', () => {
  it('serializes round-trip with arbitration_confidence (NOT confidence) field name', () => {
    const cd: ConvergedDecomposition = {
      umbrella_slug: 'iso-27001',
      umbrella_name: 'ISO 27001',
      converged_components: [
        { slug: 'iso-27001-a-5-information-security-policy', type: 'methodology' },
        { slug: 'iso-27001-a-6-organization', type: 'methodology' },
      ],
      source_mentions: [
        {
          source: 'wiki/sources/standard-a.md',
          mentioned_components: ['iso-27001-a-5-information-security-policy'],
          is_umbrella_only: false,
        },
        {
          source: 'wiki/sources/standard-b.md',
          mentioned_components: [],
          is_umbrella_only: true,
        },
      ],
      arbitration_method: 'llm',
      arbitration_confidence: 0.82,
      arbitration_log: 'cluster matches ISO 27001 Annex A controls',
      convergedAt: '2026-04-26T10:00:00.000Z',
    }

    const json = JSON.stringify(cd)
    const parsed = JSON.parse(json) as ConvergedDecomposition

    expect(parsed.umbrella_slug).toBe('iso-27001')
    expect(parsed.arbitration_method).toBe('llm')
    expect(parsed.arbitration_confidence).toBe(0.82)
    // field name guard — codex Cycle #2 정정 (plan §3.4.1 line 798)
    expect((parsed as unknown as { confidence?: number }).confidence).toBeUndefined()
    expect(parsed.source_mentions[1].is_umbrella_only).toBe(true)
    expect(parsed.converged_components[0].slug).toBe(
      'iso-27001-a-5-information-security-policy',
    )
  })
})

// ── AC16 — clusterMentionsAcrossSources ────────────────────────────────────

function vec(values: number[]): readonly number[] {
  return Object.freeze([...values])
}

function buildHistory(
  records: ReadonlyArray<{
    source: string
    concepts: ReadonlyArray<{ slug: string; type: 'methodology' | 'standard' | 'document_type' }>
  }>,
): IngestRecord[] {
  return records.map((r) => ({
    source: r.source,
    ingestedAt: '2026-04-26T10:00:00.000Z',
    concepts: r.concepts,
    entities: [],
  }))
}

describe('AC16 — clusterMentionsAcrossSources', () => {
  it('groups mentions whose embeddings have cosine similarity ≥ 0.75 into the same cluster', () => {
    const history = buildHistory([
      {
        source: 'wiki/sources/a.md',
        concepts: [
          { slug: 'pmbok-scope', type: 'methodology' },
          { slug: 'pmbok-schedule', type: 'methodology' },
        ],
      },
      {
        source: 'wiki/sources/b.md',
        concepts: [
          { slug: 'pmbok-cost', type: 'methodology' },
        ],
      },
    ])

    // 3 mentions, all near each other (cosine ≈ 1.0)
    const embeddings = new Map<string, readonly number[]>([
      ['pmbok-scope', vec([1, 0, 0])],
      ['pmbok-schedule', vec([0.99, 0.01, 0])],
      ['pmbok-cost', vec([0.98, 0.02, 0])],
    ])

    const clusters = clusterMentionsAcrossSources(history, embeddings)

    expect(clusters.length).toBe(1)
    expect(clusters[0].mention_slugs.length).toBe(3)
    expect(clusters[0].source_count).toBe(2)
    expect(clusters[0].mention_count).toBe(3)
  })

  it('keeps mentions in separate clusters when cosine similarity < 0.75', () => {
    const history = buildHistory([
      {
        source: 'wiki/sources/a.md',
        concepts: [
          { slug: 'pmbok-scope', type: 'methodology' },
          { slug: 'iso-27001-a-5', type: 'methodology' },
        ],
      },
    ])

    // orthogonal vectors → cosine 0 → below 0.75 threshold
    const embeddings = new Map<string, readonly number[]>([
      ['pmbok-scope', vec([1, 0, 0])],
      ['iso-27001-a-5', vec([0, 1, 0])],
    ])

    const clusters = clusterMentionsAcrossSources(history, embeddings)

    // each mention sits alone
    expect(clusters.length).toBe(2)
    expect(clusters.every((c) => c.mention_slugs.length === 1)).toBe(true)
  })
})

// ── AC17 — arbitrate ────────────────────────────────────────────────────────

describe('AC17 — arbitrate', () => {
  it("'union' (default) returns a deterministic ConvergedDecomposition with confidence 1.0 and arbitration_method 'union'", async () => {
    const cluster: MentionCluster = {
      cluster_id: 'c1',
      mention_slugs: ['iso-27001-a-5', 'iso-27001-a-6', 'iso-27001-a-12'],
      source_count: 2,
      mention_count: 3,
    }

    const result = await arbitrate(cluster, 'union', 50000)

    expect(result.arbitration_method).toBe('union')
    expect(result.arbitration_confidence).toBe(1.0)
    expect(result.converged_components.length).toBe(cluster.mention_slugs.length)
    expect(result.converged_components[0].slug).toBe('iso-27001-a-5')
    expect(result.converged_components[0].type).toBe('methodology')
    expect(result.arbitration_log).toBeUndefined()
    expect(result.umbrella_slug.length).toBeGreaterThan(0)
    expect(result.convergedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it("'llm' invokes the injected llmCaller, parses JSON response and preserves arbitration_log", async () => {
    const cluster: MentionCluster = {
      cluster_id: 'c2',
      mention_slugs: ['iso-27001-a-5', 'iso-27001-a-6'],
      source_count: 2,
      mention_count: 2,
    }

    const llmResponse = JSON.stringify({
      is_standard: true,
      umbrella_name: 'ISO 27001',
      umbrella_slug: 'iso-27001',
      components: [
        { slug: 'iso-27001-a-5-information-security-policy', type: 'methodology' },
        { slug: 'iso-27001-a-6-organization', type: 'methodology' },
      ],
      arbitration_confidence: 0.8,
      arbitration_reasoning: 'cluster matches Annex A controls',
    })

    const llmCaller = vi.fn(async () => llmResponse)

    const result = await arbitrate(cluster, 'llm', 50000, llmCaller)

    expect(llmCaller).toHaveBeenCalledTimes(1)
    expect(result.arbitration_method).toBe('llm')
    expect(result.arbitration_confidence).toBe(0.8)
    expect(result.umbrella_name).toBe('ISO 27001')
    expect(result.umbrella_slug).toBe('iso-27001')
    expect(result.converged_components.length).toBe(2)
    expect(result.arbitration_log).toBe('cluster matches Annex A controls')
  })
})

// ── AC18 — createConvergencePass entry-point factory ───────────────────────

describe('AC18 — createConvergencePass (run-convergence-pass.mjs entry)', () => {
  it('parses CLI-style args and returns a runnable pass with defaults', () => {
    const pass = createConvergencePass([
      '--history', '/tmp/h.json',
      '--qmd-db', '/tmp/qmd.sqlite',
      '--output', '/tmp/c.json',
    ])

    expect(pass.history).toBe('/tmp/h.json')
    expect(pass.qmdDb).toBe('/tmp/qmd.sqlite')
    expect(pass.output).toBe('/tmp/c.json')
    // defaults
    expect(pass.arbitration).toBe('union')
    expect(pass.tokenBudget).toBe(50000)
  })
})

// ── AC19 — mergeAllSources ─────────────────────────────────────────────────

describe('AC19 — mergeAllSources', () => {
  it('inject runtime declarations on top of baseOverride that already contains user-yaml + accepted-suggestion entries', () => {
    const baseComp: StandardDecompositionComponent = {
      slug: 'pmbok-scope',
      type: 'methodology',
    }
    const baseOverride: SchemaOverride = {
      entityTypes: [],
      conceptTypes: [],
      standardDecompositions: {
        kind: 'present',
        items: [
          {
            name: 'PMBOK',
            aliases: [],
            umbrella_slug: 'pmbok',
            components: [baseComp],
            rule: 'decompose',
            require_explicit_mention: true,
            origin: 'user-yaml',
          },
        ],
      },
    }
    const runtime: SelfDeclaration[] = [
      {
        umbrella_slug: 'iso-27001',
        umbrella_name: 'ISO 27001',
        components: [{ slug: 'iso-27001-a-5', type: 'methodology' }],
        rule: 'decompose',
        require_explicit_mention: true,
        source: 'wiki/sources/std-a.md',
        section_idx: 0,
        section_title: 'ISO 27001 개요',
        extractor: 'pattern-matching',
        extractedAt: '2026-04-26T10:00:00.000Z',
        persistChoice: { kind: 'runtime-only' },
      },
    ]

    const merged = mergeAllSources(baseOverride, runtime)

    expect(merged).toBeDefined()
    expect(merged?.standardDecompositions?.kind).toBe('present')
    if (merged?.standardDecompositions?.kind === 'present') {
      const slugs = merged.standardDecompositions.items.map((i) => i.umbrella_slug)
      expect(slugs).toContain('pmbok')
      expect(slugs).toContain('iso-27001')
    }
  })

  it('preserves baseOverride priority when runtime declares the same umbrella_slug as base (base wins)', () => {
    const baseOverride: SchemaOverride = {
      entityTypes: [],
      conceptTypes: [],
      standardDecompositions: {
        kind: 'present',
        items: [
          {
            name: 'PMBOK',
            aliases: [],
            umbrella_slug: 'pmbok',
            components: [{ slug: 'pmbok-scope', type: 'methodology' }],
            rule: 'decompose',
            require_explicit_mention: true,
            origin: 'user-yaml',
          },
        ],
      },
    }
    const runtime: SelfDeclaration[] = [
      {
        umbrella_slug: 'pmbok',
        umbrella_name: 'PMBOK (runtime)',
        components: [{ slug: 'pmbok-runtime-only', type: 'methodology' }],
        rule: 'decompose',
        require_explicit_mention: true,
        source: 'wiki/sources/dup.md',
        section_idx: 1,
        section_title: 'PMBOK 개요',
        extractor: 'pattern-matching',
        extractedAt: '2026-04-26T10:00:00.000Z',
        persistChoice: { kind: 'runtime-only' },
      },
    ]

    const merged = mergeAllSources(baseOverride, runtime)

    if (merged?.standardDecompositions?.kind !== 'present') {
      throw new Error('expected present standardDecompositions')
    }
    const pmbokEntries = merged.standardDecompositions.items.filter(
      (i) => i.umbrella_slug === 'pmbok',
    )
    // base wins → only one pmbok entry, and it must be the baseOverride one
    expect(pmbokEntries.length).toBe(1)
    expect(pmbokEntries[0].origin).toBe('user-yaml')
    expect(pmbokEntries[0].name).toBe('PMBOK')
  })
})

// ── AC20 — runConvergencePass precondition ─────────────────────────────────

describe('AC20 — runConvergencePass insufficient-mention precondition', () => {
  it('returns [] and logs a warning when history is below the 3 standards × 2 sources threshold', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // only 1 source × 2 standards — below threshold
    const history = buildHistory([
      {
        source: 'wiki/sources/only.md',
        concepts: [
          { slug: 'pmbok-scope', type: 'methodology' },
          { slug: 'iso-27001-a-5', type: 'methodology' },
        ],
      },
    ])

    const result = await runConvergencePass(history, {
      arbitration: 'union',
      tokenBudget: 50000,
      embeddings: new Map(),
    })

    expect(result).toEqual([])
    expect(warnSpy).toHaveBeenCalledTimes(1)
    const msg = warnSpy.mock.calls[0]?.[0]
    expect(typeof msg).toBe('string')
    expect(String(msg)).toContain('insufficient mention diversity')

    warnSpy.mockRestore()
  })

  // Sanity guard: also verify runConvergencePass produces output when threshold met (smoke).
  it('produces ConvergedDecomposition[] when the precondition is satisfied (union default)', async () => {
    const history = buildHistory([
      {
        source: 'wiki/sources/a.md',
        concepts: [
          { slug: 'pmbok-scope', type: 'methodology' },
          { slug: 'pmbok-schedule', type: 'methodology' },
          { slug: 'pmbok-cost', type: 'methodology' },
        ],
      },
      {
        source: 'wiki/sources/b.md',
        concepts: [
          { slug: 'pmbok-scope', type: 'methodology' },
          { slug: 'pmbok-schedule', type: 'methodology' },
          { slug: 'pmbok-cost', type: 'methodology' },
        ],
      },
    ])

    const sharedVec = vec([1, 0, 0])
    const embeddings = new Map<string, readonly number[]>([
      ['pmbok-scope', sharedVec],
      ['pmbok-schedule', vec([0.99, 0.01, 0])],
      ['pmbok-cost', vec([0.98, 0.02, 0])],
    ])

    const result = await runConvergencePass(history, {
      arbitration: 'union',
      tokenBudget: 50000,
      embeddings,
    })

    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result[0].arbitration_method).toBe('union')
    expect(result[0].arbitration_confidence).toBe(1.0)
  })
})
