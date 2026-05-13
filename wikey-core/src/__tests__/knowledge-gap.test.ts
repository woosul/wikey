/**
 * §5.20 Knowledge Gap management — RED test suite (Step B).
 *
 * Spec source: `plan/phase-5/phase-5-spec-5.20-knowledge-gap-management.md` v0.2 (LOCK).
 * Todox source: `plan/phase-5/phase-5-todox-5.20-knowledge-gap-management.md` v0.2.
 *
 * 13 acceptance criteria 1:1 mapping:
 *   Spec 1 (query log capture + privacy)  — AC-S1-1 ~ AC-S1-5
 *   Spec 2 (gap score formula)            — AC-S2-1 ~ AC-S2-6
 *   Spec 3 (report 생성)                  — AC-S3-1 ~ AC-S3-2
 *
 * 현재 Step B 단계 — knowledge-gap.ts 의 모든 export = stub throw.
 * 모든 test FAIL 확증 → developer Step C 구현 후 GREEN.
 *
 * Spec → Test mapping:
 *   AC-S1-1: 'appendQueryLogEntry writes one JSONL line with exactly 5 keys'
 *   AC-S1-2: 'appendQueryLogEntry is append-only (two calls → two lines)'
 *   AC-S1-3: 'loadQueryLogEntries parses JSONL and skips malformed line'
 *   AC-S1-4: 'Privacy I3 — extra keys on input entry are dropped on disk'
 *   AC-S1-5: 'appendQueryLogEntry tolerates missing .wikey/ folder (WikiFS write creates it)'
 *   AC-S2-1: 'computeGapScore matches LOCK fixture (5 / 10 / 0 → 0.523)'
 *   AC-S2-2: 'computeGapScore guards divide-by-zero (avgAnswerLen=0 stays finite)'
 *   AC-S2-3: 'computeGapScore returns 0 for frequency=0'
 *   AC-S2-4: 'computeGapScore is monotonic increasing in frequency'
 *   AC-S2-5: 'rankKnowledgeGaps returns gaps sorted by gapScore desc'
 *   AC-S2-6: 'rankKnowledgeGaps falls back to deterministic clustering when clusterer throws (I5)'
 *   AC-S3-1: 'renderGapReportMarkdown emits frontmatter + Top N gaps body'
 *   AC-S3-2: 'renderGapReportMarkdown is deterministic (idempotent rendering)'
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  appendQueryLogEntry,
  loadQueryLogEntries,
  computeGapScore,
  rankKnowledgeGaps,
  renderGapReportMarkdown,
  extractCreatedFromFrontmatter,
  validateClusterResultShape,
  type QueryLogEntry,
  type ClusterResult,
  type TopicClusterer,
} from '../knowledge-gap.js'
import type { WikiFS } from '../types.js'

const QUERY_LOG_PATH = '.wikey/query-log.jsonl'

// ── Test fixtures: in-memory WikiFS (Spec 1 I3a — vault-relative path) ────────

class MemoryFS implements WikiFS {
  files = new Map<string, string>()
  async read(path: string): Promise<string> {
    const v = this.files.get(path)
    if (v == null) throw new Error(`ENOENT ${path}`)
    return v
  }
  async write(path: string, content: string): Promise<void> {
    this.files.set(path, content)
  }
  async exists(path: string): Promise<boolean> {
    return this.files.has(path)
  }
  async list(_dir: string): Promise<string[]> {
    return [...this.files.keys()]
  }
  async walk(_dir: string): Promise<string[]> {
    return [...this.files.keys()].filter((k) => k.endsWith('.md'))
  }
}

function makeEntry(overrides: Partial<QueryLogEntry> = {}): QueryLogEntry {
  return {
    ts: '2026-05-13T12:00:00.000Z',
    query: 'sample query',
    answerLen: 100,
    citationCount: 2,
    resolveFailed: false,
    ...overrides,
  }
}

// ── Spec 1 — query log capture + privacy ──────────────────────────────────────

describe('§5.20 Spec 1 — query log capture + privacy (I1/I2/I3)', () => {
  let fs: MemoryFS

  beforeEach(() => {
    fs = new MemoryFS()
  })

  it('AC-S1-1: appendQueryLogEntry writes one JSONL line with exactly 5 keys', async () => {
    // I3a — vault-relative path `.wikey/query-log.jsonl`. Single append = 1 line.
    const entry = makeEntry({
      ts: '2026-05-13T12:00:00.000Z',
      query: 'how does LLM wiki work',
      answerLen: 250,
      citationCount: 3,
      resolveFailed: false,
    })

    await appendQueryLogEntry(fs, entry)

    expect(fs.files.has(QUERY_LOG_PATH)).toBe(true)
    const raw = fs.files.get(QUERY_LOG_PATH) ?? ''
    const lines = raw.split('\n').filter((ln) => ln.length > 0)
    expect(lines).toHaveLength(1)

    const parsed = JSON.parse(lines[0]) as Record<string, unknown>
    expect(Object.keys(parsed).sort()).toEqual(
      ['answerLen', 'citationCount', 'query', 'resolveFailed', 'ts'].sort(),
    )
    expect(parsed.ts).toBe('2026-05-13T12:00:00.000Z')
    expect(parsed.query).toBe('how does LLM wiki work')
    expect(parsed.answerLen).toBe(250)
    expect(parsed.citationCount).toBe(3)
    expect(parsed.resolveFailed).toBe(false)
  })

  it('AC-S1-2: appendQueryLogEntry is append-only (two calls → two lines)', async () => {
    // JSONL append, not overwrite. Reload sees both entries.
    await appendQueryLogEntry(fs, makeEntry({ query: 'first' }))
    await appendQueryLogEntry(fs, makeEntry({ query: 'second' }))

    const raw = fs.files.get(QUERY_LOG_PATH) ?? ''
    const lines = raw.split('\n').filter((ln) => ln.length > 0)
    expect(lines).toHaveLength(2)

    const parsedFirst = JSON.parse(lines[0]) as { query: string }
    const parsedSecond = JSON.parse(lines[1]) as { query: string }
    expect(parsedFirst.query).toBe('first')
    expect(parsedSecond.query).toBe('second')
  })

  it('AC-S1-3: loadQueryLogEntries parses JSONL and skips malformed line', async () => {
    // Robust parse — malformed line 1개 skip + 나머지 정상 return.
    const good1 = JSON.stringify(makeEntry({ query: 'q1' }))
    const malformed = '{this is not json'
    const good2 = JSON.stringify(makeEntry({ query: 'q2' }))
    fs.files.set(QUERY_LOG_PATH, `${good1}\n${malformed}\n${good2}\n`)

    const entries = await loadQueryLogEntries(fs)

    expect(entries).toHaveLength(2)
    expect(entries[0].query).toBe('q1')
    expect(entries[1].query).toBe('q2')
  })

  it('AC-S1-4 (I3 schema minimize): extra keys on input entry are dropped on disk', async () => {
    // Privacy — answer body / wiki path 등 extra 키가 entry 에 포함되어도 disk 에 0.
    const polluted = {
      ...makeEntry({ query: 'leak test' }),
      answer: 'this should never reach disk',
      wikiPath: 'wiki/concepts/secret.md',
      sources: [{ path: '/raw/secret.md' }],
    } as QueryLogEntry

    await appendQueryLogEntry(fs, polluted)

    const raw = fs.files.get(QUERY_LOG_PATH) ?? ''
    const lines = raw.split('\n').filter((ln) => ln.length > 0)
    expect(lines).toHaveLength(1)

    const parsed = JSON.parse(lines[0]) as Record<string, unknown>
    expect(Object.keys(parsed).sort()).toEqual(
      ['answerLen', 'citationCount', 'query', 'resolveFailed', 'ts'].sort(),
    )
    // Extra keys 절대 disk 에 없음.
    expect(parsed).not.toHaveProperty('answer')
    expect(parsed).not.toHaveProperty('wikiPath')
    expect(parsed).not.toHaveProperty('sources')
  })

  it('AC-S1-5: appendQueryLogEntry tolerates missing .wikey/ folder', async () => {
    // WikiFS.write 가 폴더 부재 시 자동 생성 (Wikey 표준) → log path 정상 write.
    expect(fs.files.has('.wikey')).toBe(false) // 사전 상태: 폴더 부재
    await appendQueryLogEntry(fs, makeEntry())
    expect(fs.files.has(QUERY_LOG_PATH)).toBe(true)
  })
})

// ── Spec 2 — gap score formula ─────────────────────────────────────────────────

describe('§5.20 Spec 2 — gap score formula (I4/I5/I6)', () => {
  it('AC-S2-1: computeGapScore matches LOCK fixture (5 / 10 / 0 → ≈0.523)', () => {
    // Spec I4 수치 fixture: 5 * log(1.1) * log(3) ≈ 0.523. tolerance ±0.01.
    const score = computeGapScore({ frequency: 5, avgAnswerLen: 10, avgCitationCount: 0 })
    expect(score).toBeCloseTo(0.523, 2)
  })

  it('AC-S2-2: computeGapScore guards divide-by-zero (avgAnswerLen=0 stays finite)', () => {
    // 분모 가드: max(0,1)=1 → log(2). avgCitationCount=0 → log(3). frequency=1.
    // 결과 = 1 * log(2) * log(3) ≈ 0.762. finite (Infinity / NaN 아님).
    const score = computeGapScore({ frequency: 1, avgAnswerLen: 0, avgCitationCount: 0 })
    expect(Number.isFinite(score)).toBe(true)
    expect(score).toBeCloseTo(Math.log(2) * Math.log(3), 5)
  })

  it('AC-S2-3: computeGapScore returns 0 for frequency=0', () => {
    const score = computeGapScore({ frequency: 0, avgAnswerLen: 100, avgCitationCount: 5 })
    expect(score).toBe(0)
  })

  it('AC-S2-4: computeGapScore is monotonic increasing in frequency', () => {
    // 다른 input 고정 시 frequency 증가 → gapScore 증가.
    const low = computeGapScore({ frequency: 3, avgAnswerLen: 50, avgCitationCount: 1 })
    const high = computeGapScore({ frequency: 5, avgAnswerLen: 50, avgCitationCount: 1 })
    expect(high).toBeGreaterThan(low)
  })

  it('AC-S2-5: rankKnowledgeGaps returns gaps sorted by gapScore desc', async () => {
    // clusterer mock → 3 cluster. 결과 KnowledgeGap[3], gapScore desc 정렬 + queryIndices 보존.
    const entries: QueryLogEntry[] = [
      makeEntry({ query: 'q0 short answer', answerLen: 5, citationCount: 0 }),
      makeEntry({ query: 'q1 short answer', answerLen: 5, citationCount: 0 }),
      makeEntry({ query: 'q2 short answer', answerLen: 5, citationCount: 0 }),
      makeEntry({ query: 'q3 long answer', answerLen: 500, citationCount: 10 }),
      makeEntry({ query: 'q4 long answer', answerLen: 500, citationCount: 10 }),
      makeEntry({ query: 'q5 mid answer', answerLen: 100, citationCount: 3 }),
    ]
    const clusterer: TopicClusterer = async () =>
      ({
        topics: [
          { name: 'topic-short', queryIndices: [0, 1, 2] }, // freq 3, len 5, cit 0 → 높은 gap
          { name: 'topic-long', queryIndices: [3, 4] }, // freq 2, len 500, cit 10 → 낮은 gap
          { name: 'topic-mid', queryIndices: [5] }, // freq 1, len 100, cit 3 → 중간
        ],
      }) satisfies ClusterResult

    const gaps = await rankKnowledgeGaps(entries, clusterer)

    expect(gaps.length).toBe(3)
    // gapScore desc 정렬 확증.
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i - 1].gapScore).toBeGreaterThanOrEqual(gaps[i].gapScore)
    }
    // 첫 번째 = 가장 큰 gap (topic-short).
    expect(gaps[0].topic).toBe('topic-short')
    expect(gaps[0].frequency).toBe(3)
    expect(gaps[0].queryIndices).toEqual([0, 1, 2])
  })

  it('AC-S2-6 (I5 fallback): rankKnowledgeGaps falls back to deterministic clustering when clusterer throws', async () => {
    // Primary clusterer throw → fallback (token-overlap deterministic) → ≥ 1 topic.
    const entries: QueryLogEntry[] = [
      makeEntry({ query: 'tokenizer Kiwi 한국어' }),
      makeEntry({ query: 'tokenizer Kiwi WASM' }),
      makeEntry({ query: 'embedding Qwen3' }),
    ]
    const throwingClusterer: TopicClusterer = async () => {
      throw new Error('LLM 호출 실패 시뮬레이션')
    }

    const gaps = await rankKnowledgeGaps(entries, throwingClusterer)

    expect(gaps.length).toBeGreaterThanOrEqual(1)
    // 모든 gap 가 KnowledgeGap shape 정합.
    for (const gap of gaps) {
      expect(typeof gap.topic).toBe('string')
      expect(typeof gap.frequency).toBe('number')
      expect(typeof gap.gapScore).toBe('number')
      expect(Array.isArray(gap.queryIndices)).toBe(true)
    }
  })
})

// ── Spec 3 — report 생성 ────────────────────────────────────────────────────────

describe('§5.20 Spec 3 — auto report generation (I9/I10/I11)', () => {
  function sampleGaps() {
    return [
      {
        topic: 'transformer architecture',
        frequency: 8,
        avgAnswerLen: 30,
        avgCitationCount: 0.5,
        gapScore: 1.42,
        queryIndices: [0, 1, 2, 3, 4, 5, 6, 7],
      },
      {
        topic: 'embedding strategy',
        frequency: 4,
        avgAnswerLen: 80,
        avgCitationCount: 2,
        gapScore: 0.18,
        queryIndices: [8, 9, 10, 11],
      },
    ]
  }

  it('AC-S3-1: renderGapReportMarkdown emits frontmatter + Top N gaps body', () => {
    const md = renderGapReportMarkdown(sampleGaps(), { yearMonth: '2026-05' })

    // Frontmatter shape (I10).
    expect(md.startsWith('---\n')).toBe(true)
    expect(md).toMatch(/^title:\s*Knowledge Gaps\s*[—-]\s*2026-05/m)
    expect(md).toMatch(/^type:\s*analysis$/m)
    expect(md).toMatch(/^created:\s*2026-05-01$/m)
    expect(md).toMatch(/^updated:\s*2026-05-01$/m)
    expect(md).toMatch(/tags:\s*\[.*knowledge-gap.*auto-report.*\]/m)
    // I10 v0.3 — schema 페이지 컨벤션 정합 (sources 필수 필드).
    expect(md).toMatch(/^sources:\s*\[\]\s*$/m)

    // 본문 (I11): `## Top N gaps` + 각 cluster 별 `### name (gapScore: X.XX, frequency: N)`.
    expect(md).toMatch(/##\s+Top\s+N\s+gaps/i)
    expect(md).toMatch(/###\s+transformer architecture\s*\(gapScore:\s*1\.42,\s*frequency:\s*8\)/i)
    expect(md).toMatch(/###\s+embedding strategy\s*\(gapScore:\s*0\.18,\s*frequency:\s*4\)/i)
  })

  it('AC-S3-2: renderGapReportMarkdown is deterministic (same input → same output)', () => {
    const a = renderGapReportMarkdown(sampleGaps(), { yearMonth: '2026-05' })
    const b = renderGapReportMarkdown(sampleGaps(), { yearMonth: '2026-05' })
    expect(a).toBe(b)
  })

  it('AC-S3-3 (v0.3): renderGapReportMarkdown preserves createdDate, updates updatedDate', () => {
    // I9 LOCK v0.3 — `created` 첫 생성 보존, `updated` 만 갱신.
    const md = renderGapReportMarkdown(sampleGaps(), {
      yearMonth: '2026-05',
      createdDate: '2026-05-03',
      updatedDate: '2026-05-13',
    })
    expect(md).toMatch(/^created:\s*2026-05-03$/m)
    expect(md).toMatch(/^updated:\s*2026-05-13$/m)
  })

  it('AC-S3-4 (v0.3): extractCreatedFromFrontmatter reads `created` from existing page', () => {
    // command runner 가 기존 file frontmatter 에서 `created` 를 parse 해 보존하는 경로.
    const existing = [
      '---',
      'title: Knowledge Gaps — 2026-05',
      'type: analysis',
      'created: 2026-05-03',
      'updated: 2026-05-08',
      'tags: [knowledge-gap, auto-report]',
      '---',
      '',
      '## Top N gaps',
    ].join('\n')
    expect(extractCreatedFromFrontmatter(existing)).toBe('2026-05-03')

    // frontmatter 부재 시 null.
    expect(extractCreatedFromFrontmatter('no frontmatter here')).toBeNull()
    // created key 부재 시 null.
    const noCreated = '---\ntitle: x\n---\nbody'
    expect(extractCreatedFromFrontmatter(noCreated)).toBeNull()
  })
})

// ── Spec 2 v0.3 — LLM cluster shape validation (codex MEDIUM-3 fix) ────────────

describe('§5.20 Spec 2 v0.3 — LLM cluster shape validation', () => {
  it('AC-S2-7 (v0.3): validateClusterResultShape passes a well-formed payload', () => {
    const ok = { topics: [{ name: 'topic-a', queryIndices: [0, 1] }] }
    expect(validateClusterResultShape(ok)).toBe(ok)
  })

  it('AC-S2-8 (v0.3): validateClusterResultShape throws on malformed payloads', () => {
    expect(() => validateClusterResultShape(null)).toThrow()
    expect(() => validateClusterResultShape({ topics: 'not array' })).toThrow()
    expect(() => validateClusterResultShape({ topics: [{ name: 1, queryIndices: [0] }] })).toThrow()
    expect(() =>
      validateClusterResultShape({ topics: [{ name: 't', queryIndices: 'no array' }] }),
    ).toThrow()
    expect(() =>
      validateClusterResultShape({ topics: [{ name: 't', queryIndices: [0, 'x'] }] }),
    ).toThrow()
  })

  it('AC-S2-10 (v0.3 cycle #2): validateClusterResultShape rejects non-integer queryIndices', () => {
    // codex cycle #2 NEW MEDIUM — entries[0.5] = undefined → crash. integer-only LOCK.
    expect(() =>
      validateClusterResultShape({ topics: [{ name: 't', queryIndices: [0.5] }] }),
    ).toThrow(/integer/)
    expect(() =>
      validateClusterResultShape({ topics: [{ name: 't', queryIndices: [0, 1.7] }] }),
    ).toThrow(/integer/)
    expect(() =>
      validateClusterResultShape({ topics: [{ name: 't', queryIndices: [NaN] }] }),
    ).toThrow(/integer/)
  })

  it('AC-S2-9 (v0.3): rankKnowledgeGaps falls back when clusterer returns malformed shape via validation throw', async () => {
    const entries: QueryLogEntry[] = [
      { ts: '2026-05-13T12:00:00.000Z', query: 'kiwi tokenizer', answerLen: 10, citationCount: 0, resolveFailed: false },
      { ts: '2026-05-13T12:01:00.000Z', query: 'kiwi nlp', answerLen: 10, citationCount: 0, resolveFailed: false },
    ]
    // Clusterer that validates internally; validation throws → fallback.
    const clusterer: TopicClusterer = async () => {
      const bogus = { not_topics: [] } as unknown
      return validateClusterResultShape(bogus)
    }

    const gaps = await rankKnowledgeGaps(entries, clusterer)
    expect(gaps.length).toBeGreaterThanOrEqual(1)
  })
})
