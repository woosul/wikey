/**
 * §5.7.8 Spec 3 — QueryAnalyzer unit tests (AC-A1).
 *
 * Covers: schema-compatible append, hardcoded-domain self-check, fail-open semantics.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  QueryAnalyzer,
  appendEntriesToSuite,
  AUTO_EXTENDED_SOURCE,
  type QueryAnswerPair,
} from '../../search/query-analyzer.js'
import type { FilterLLM } from '../../search/query-intent-filter.js'

const PROMPT = readFileSync(
  join(__dirname, '..', '..', 'prompts', 'query-analyzer.prompt.md'),
  'utf-8',
)

function pairs(): QueryAnswerPair[] {
  return [
    { query: '프로젝트 일정 관리', answer: '프로젝트 일정 관리는 PMBOK …' },
    { query: '당뇨 합병증', answer: '당뇨 합병증은 신경 손상 …' },
  ]
}

let tmpRoot = ''
let suitePath = ''
beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'wikey-query-analyzer-'))
  suitePath = join(tmpRoot, 'benchmark-suite.json')
  writeFileSync(
    suitePath,
    JSON.stringify({
      version: 1,
      collection: 'wikey-wiki',
      created: '2026-05-10',
      queries: [{
        id: 'pmbok-q1',
        query: '기존 query',
        expected_top1: 'project-schedule-management',
        expected_top3: ['project-schedule-management'],
        domain: 'pmbok',
      }],
    }, null, 2),
    'utf-8',
  )
})
afterEach(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true })
})

describe('QueryAnalyzer — AC-A1 schema-compatible append', () => {
  it('mock LLM N pairs → analyzer returns N entries with required fields', async () => {
    const llm: FilterLLM = {
      async call() {
        return JSON.stringify({
          entries: [
            {
              id: 'auto-aaaa1111',
              query: '프로젝트 일정 관리',
              expected_top1: 'project-schedule-management',
              expected_top3: ['project-schedule-management', 'project-management-body-of-knowledge'],
              domain: 'pmbok',
              source: AUTO_EXTENDED_SOURCE,
              created_at: '2026-05-10T00:00:00Z',
            },
            {
              id: 'auto-bbbb2222',
              query: '당뇨 합병증',
              expected_top1: 'diabetes-complications',
              expected_top3: ['diabetes-complications', 'diabetes-overview'],
              domain: 'medicine',
              source: AUTO_EXTENDED_SOURCE,
              created_at: '2026-05-10T00:00:01Z',
            },
          ],
        })
      },
    }
    const analyzer = new QueryAnalyzer({ llm, promptTemplate: PROMPT })
    const result = await analyzer.analyze(pairs())
    expect(result.fallback).toBe('none')
    expect(result.entries.length).toBe(2)
    expect(result.entries[0].source).toBe(AUTO_EXTENDED_SOURCE)
    expect(result.entries[0].expected_top1).toBeTruthy()
    expect(result.entries[0].expected_top3.length).toBeGreaterThan(0)
    expect(result.entries[0].domain).toBeTruthy()
  })

  it('appendEntriesToSuite preserves runner schema and dedupes by id', async () => {
    const entries = [
      {
        id: 'auto-cccc3333',
        query: 'foo',
        expected_top1: 'foo-page',
        expected_top3: ['foo-page'],
        domain: 'general',
        source: AUTO_EXTENDED_SOURCE,
        created_at: '2026-05-10T00:00:00Z',
      },
    ] as const
    const r1 = appendEntriesToSuite(suitePath, entries)
    expect(r1.added).toBe(1)
    const r2 = appendEntriesToSuite(suitePath, entries)
    expect(r2.added).toBe(0)
    expect(r2.skipped).toBe(1)

    const reloaded = JSON.parse(readFileSync(suitePath, 'utf-8'))
    expect(reloaded.queries.length).toBe(2)
    const auto = reloaded.queries.find((q: { id: string }) => q.id === 'auto-cccc3333')
    expect(auto.expected_top1).toBe('foo-page')
    expect(auto.source).toBe(AUTO_EXTENDED_SOURCE)
  })

  it('LLM throw → fail-open ("llm-fail" + 0 entries + warn)', async () => {
    const llm: FilterLLM = { async call() { throw new Error('rate limited') } }
    const analyzer = new QueryAnalyzer({ llm, promptTemplate: PROMPT })
    const result = await analyzer.analyze(pairs())
    expect(result.fallback).toBe('llm-fail')
    expect(result.entries).toEqual([])
  })

  it('LLM timeout → fail-open ("timeout")', async () => {
    const llm: FilterLLM = {
      async call() {
        return await new Promise((resolve) => setTimeout(() => resolve('{}'), 200))
      },
    }
    const analyzer = new QueryAnalyzer({ llm, promptTemplate: PROMPT, timeoutMs: 50 })
    const result = await analyzer.analyze(pairs())
    expect(result.fallback).toBe('timeout')
    expect(result.entries).toEqual([])
  })

  it('Invalid JSON → fail-open ("llm-fail")', async () => {
    const llm: FilterLLM = { async call() { return 'plain prose' } }
    const analyzer = new QueryAnalyzer({ llm, promptTemplate: PROMPT })
    const result = await analyzer.analyze(pairs())
    expect(result.fallback).toBe('llm-fail')
    expect(result.entries).toEqual([])
  })

  it('No hardcoded domain list — analyzer source has no Set([...]) / DOMAIN_LIST', () => {
    const text = readFileSync(
      join(__dirname, '..', '..', 'search', 'query-analyzer.ts'),
      'utf-8',
    )
    expect(text).not.toMatch(/DOMAIN_LIST|new\s+Set\s*\(\s*\[/u)
  })
})
