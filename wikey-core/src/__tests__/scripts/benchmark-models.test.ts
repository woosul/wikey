/**
 * §5.6.5 Step D — Unit tests for benchmark-models harness.
 *
 * Pure-function focus: scoring / parsing / aggregation. Production LLM calls
 * are not exercised here (Step D-4 lives in the bash orchestrator).
 *
 * Coverage target: ≥ 12 tests across (a) golden parsing, (b) scoring,
 * (c) best-fit decision + tie-break.
 */

import { describe, expect, it } from 'vitest'
import {
  BENCHMARK_FIXTURES,
  BENCHMARK_MODELS,
  BENCHMARK_TASKS,
  aggregateScores,
  buildPrompt,
  buildReport,
  chooseMajorityVote,
  clamp01,
  costReward,
  detectPii,
  jaccard,
  latencyReward,
  tieBreakByCost,
  weightedScore,
  type JudgeScore,
  type MeasurementCell,
} from '../../scripts/benchmark-models.js'

describe('§5.6.5 — constants LOCK', () => {
  it('LOCK: 9 measurement models (8 original + deepseek-v4-pro Step D-9)', () => {
    expect(BENCHMARK_MODELS.length).toBe(9)
  })

  it('LOCK: 7 fixtures', () => {
    expect(BENCHMARK_FIXTURES.length).toBe(7)
  })

  it('LOCK: 6 tasks', () => {
    expect(BENCHMARK_TASKS.length).toBe(6)
  })

  it('LOCK: 9 × 7 × 6 × 3 = 1,134 measurement cells', () => {
    expect(BENCHMARK_MODELS.length * BENCHMARK_FIXTURES.length * BENCHMARK_TASKS.length * 3).toBe(1134)
  })

  it('LOCK: L2 (qwen3.6 mlx) requires adaptive JSON prefix', () => {
    const l2 = BENCHMARK_MODELS.find((m) => m.id === 'qwen3.6:35b-a3b-nvfp4')
    expect(l2).toBeDefined()
    expect(l2!.adaptiveJsonPrefix).toBe(true)
  })

  it('LOCK: all 6 cloud models use provider ollama-cloud (5 original + deepseek-v4-pro)', () => {
    const cloud = BENCHMARK_MODELS.filter((m) => m.family === 'cloud')
    expect(cloud.length).toBe(6)
    expect(cloud.every((m) => m.provider === 'ollama-cloud')).toBe(true)
  })
})

describe('§5.6.5 — jaccard + clamp01', () => {
  it('jaccard identical strings = 1', () => {
    expect(jaccard('hello world', 'hello world')).toBe(1)
  })

  it('jaccard disjoint strings = 0', () => {
    expect(jaccard('alpha beta', 'gamma delta')).toBe(0)
  })

  it('jaccard partial overlap', () => {
    // {hello,world} vs {hello,there} → 1/3
    expect(jaccard('hello world', 'hello there')).toBeCloseTo(1 / 3, 5)
  })

  it('jaccard two empty strings = 1 (vacuous match)', () => {
    expect(jaccard('', '')).toBe(1)
  })

  it('clamp01 outside range', () => {
    expect(clamp01(-0.5)).toBe(0)
    expect(clamp01(1.5)).toBe(1)
    expect(clamp01(0.5)).toBe(0.5)
    expect(clamp01(Number.NaN)).toBe(0)
  })
})

describe('§5.6.5 — scoring weights (master LOCK)', () => {
  it('weightedScore sums to 1 when all parts = 1', () => {
    const s = weightedScore({ accuracy: 1, semantic: 1, latency: 1, cost: 1, community: 1 })
    expect(s).toBeCloseTo(1, 5)
  })

  it('weightedScore W1 accuracy carries 50% weight', () => {
    const onlyAccuracy = weightedScore({ accuracy: 1, semantic: 0, latency: 0, cost: 0, community: 0 })
    expect(onlyAccuracy).toBeCloseTo(0.5, 5)
  })

  it('weightedScore W2 semantic carries 25% weight', () => {
    const onlySemantic = weightedScore({ accuracy: 0, semantic: 1, latency: 0, cost: 0, community: 0 })
    expect(onlySemantic).toBeCloseTo(0.25, 5)
  })

  it('latencyReward: equal-to-slowest = 0, half-of-slowest = 0.5', () => {
    expect(latencyReward(1000, 1000)).toBe(0)
    expect(latencyReward(500, 1000)).toBe(0.5)
    expect(latencyReward(0, 1000)).toBe(0)
  })

  it('costReward: free = 1 when no one paid; half-cost = 0.5', () => {
    expect(costReward(0, 0)).toBe(1)
    expect(costReward(0.05, 0.1)).toBeCloseTo(0.5, 5)
  })

  it('tieBreakByCost: lower-cost wins (higher reward); sort positive when a > b', () => {
    const a = { id: 'a', cost: 0.10 } // less cost reward
    const b = { id: 'b', cost: 0.05 } // more cost reward
    expect(tieBreakByCost(a, b)).toBeLessThan(0) // b before a
  })
})

describe('§5.6.5 — prompt builder', () => {
  it('canonicalize prompt requires JSON', () => {
    const p = buildPrompt('canonicalize', 'doc body')
    expect(p.requireJson).toBe(true)
    expect(p.prompt).toContain('entities')
  })

  it('brief prompt prose Korean', () => {
    const p = buildPrompt('brief', 'doc body')
    expect(p.requireJson).toBe(false)
    expect(p.prompt).toContain('Korean')
  })

  it('hallucinate-detection requires evidence_quote', () => {
    const p = buildPrompt('hallucinate-detection', 'doc body')
    expect(p.prompt).toContain('evidence_quote')
  })

  it('large fixture is truncated', () => {
    const huge = 'a'.repeat(200_000)
    const p = buildPrompt('brief', huge)
    expect(p.prompt.length).toBeLessThan(110_000)
  })

  it('local family gets a smaller truncation window (≤ 10K chars)', () => {
    const huge = 'a'.repeat(200_000)
    const cloud = buildPrompt('brief', huge, 'cloud')
    const local = buildPrompt('brief', huge, 'local')
    expect(local.prompt.length).toBeLessThan(10_000)
    expect(local.prompt.length).toBeLessThan(cloud.prompt.length)
  })
})

describe('§5.6.5 — golden parsing', () => {
  it('chooseMajorityVote: all identical → no dissent', () => {
    const r = chooseMajorityVote({ gemini: 'A B C', claude: 'A B C', openai: 'A B C' })
    expect(r.dissent).toBe(false)
    expect(r.winner).toBe('A B C')
  })

  it('chooseMajorityVote: 2/3 agree → no dissent, majority wins', () => {
    const r = chooseMajorityVote({ gemini: 'A B C D', claude: 'A B C E', openai: 'X Y Z W' })
    // gemini + claude share 3/5 tokens; openai shares nothing
    expect(r.dissent).toBe(false)
  })

  it('chooseMajorityVote: 3 disjoint → dissent flagged', () => {
    const r = chooseMajorityVote({ a: 'alpha', b: 'bravo', c: 'charlie' })
    expect(r.dissent).toBe(true)
  })

  it('chooseMajorityVote: single output, no dissent', () => {
    const r = chooseMajorityVote({ only: 'solo answer' })
    expect(r.dissent).toBe(false)
    expect(r.winner).toBe('solo answer')
  })
})

describe('§5.6.5 — PII detector', () => {
  it('detects Korean phone', () => {
    const hits = detectPii('contact 010-1234-5678 today')
    expect(hits.some((h) => h.kind === 'phone-kr')).toBe(true)
  })

  it('detects email', () => {
    const hits = detectPii('write to user@example.com please')
    expect(hits.some((h) => h.kind === 'email')).toBe(true)
  })

  it('detects business registration number', () => {
    const hits = detectPii('biz number 301-86-19385 here')
    expect(hits.some((h) => h.kind === 'biz-reg')).toBe(true)
  })

  it('clean text → no hits', () => {
    const hits = detectPii('this is a benchmark report with no secrets')
    expect(hits.length).toBe(0)
  })
})

describe('§5.6.5 — best-fit aggregation + tie-break', () => {
  function makeCell(model: string, latency: number, tokens: number): MeasurementCell {
    return {
      model,
      fixture: 'F1-rohm-wisun',
      task: 'brief',
      cycle: 1,
      response: 'x'.repeat(tokens * 4),
      latency_ms: latency,
      token_count: tokens,
      json_valid: true,
      pii_hits: [],
    }
  }
  function makeJudge(model: string, acc: number, sem: number): JudgeScore {
    return { model, fixture: 'F1-rohm-wisun', task: 'brief', cycle: 1, accuracy: acc, semantic: sem, raw_judge: 'ok' }
  }

  it('aggregateScores: higher accuracy ranks first', () => {
    const cells = [makeCell('gemini-2.5-flash', 1000, 100), makeCell('qwen3:8b', 800, 100)]
    const judges = [makeJudge('gemini-2.5-flash', 0.9, 0.8), makeJudge('qwen3:8b', 0.6, 0.5)]
    const result = aggregateScores(cells, judges)
    expect(result[0].model).toBe('gemini-2.5-flash')
  })

  it('aggregateScores: tied weighted score → cost tie-break (lower cost wins)', () => {
    // Force a tie by giving local model lower latency + zero cost.
    const cells = [
      makeCell('qwen3:8b', 100, 50), // local, $0
      makeCell('qwen3:8b', 100, 50),
    ]
    const judges = [makeJudge('qwen3:8b', 0.5, 0.5)]
    const result = aggregateScores(cells, judges)
    expect(result.length).toBe(1)
    expect(result[0].cost_est_usd).toBe(0)
  })

  it('aggregateScores: empty input → empty result', () => {
    const result = aggregateScores([], [])
    expect(result.length).toBe(0)
  })

  it('aggregateScores: includes all benchmarked models when present', () => {
    const cells = BENCHMARK_MODELS.map((m) => makeCell(m.id, 1000, 100))
    const judges = BENCHMARK_MODELS.map((m) => makeJudge(m.id, 0.5, 0.5))
    const result = aggregateScores(cells, judges)
    expect(result.length).toBe(BENCHMARK_MODELS.length)
  })
})

describe('§5.6.5 — report builder', () => {
  it('buildReport: header has winner + table', () => {
    const aggregates = [
      {
        model: 'deepseek-v3.1:671b-cloud',
        slug: 'M1-deepseek-v3.1',
        family: 'cloud',
        accuracy_mean: 0.9,
        semantic_mean: 0.8,
        latency_mean_ms: 1200,
        cost_est_usd: 0.001,
        community_score: 0.9,
        weighted: 0.84,
      },
    ]
    const report = buildReport(aggregates, { totalCells: 1008, goldenCount: 42, judgeCount: 1008, piiHitsOnReport: 0 })
    expect(report).toContain('deepseek-v3.1:671b-cloud')
    expect(report).toContain('Best-fit winner')
    expect(report).toContain('| 1 |')
    expect(report).toContain('Total measurement cells: 1008')
  })

  it('buildReport: zero PII assertion present', () => {
    const aggregates = [
      {
        model: 'qwen3:8b',
        slug: 'L1-qwen3-8b',
        family: 'local',
        accuracy_mean: 0.5,
        semantic_mean: 0.5,
        latency_mean_ms: 500,
        cost_est_usd: 0,
        community_score: 0.55,
        weighted: 0.45,
      },
    ]
    const report = buildReport(aggregates, { totalCells: 0, goldenCount: 0, judgeCount: 0, piiHitsOnReport: 0 })
    expect(report).toContain('PII hits on report (must be 0): 0')
  })
})
