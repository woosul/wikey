/**
 * §5.20 sidebar-chat query log hook — RED test suite (Step B).
 *
 * Spec source: `docs/planning/phase-5/phase-5-spec-5.20-knowledge-gap-management.md` v0.2 (LOCK).
 *
 * 3 acceptance criteria for sidebar-chat-side helper `buildQueryLogEntry`:
 *   B-1: 'buildQueryLogEntry maps answer.length, citations.length, sources.length → entry shape'
 *   B-2: 'sources=[] yields resolveFailed=true'
 *   B-3: 'ts is ISO-8601 (Z suffix) and deterministic when `now` is injected'
 *
 * 현재 Step B 단계 — `buildQueryLogEntry` = stub throw.
 * 모든 test FAIL 확증 → developer Step C 구현 후 GREEN.
 */
import { describe, it, expect } from 'vitest'
import { buildQueryLogEntry } from '../sidebar-chat-helpers-querylog'

describe('§5.20 sidebar-chat query log helper — buildQueryLogEntry', () => {
  it('B-1: maps answer.length, citations.length, sources.length → 5-key entry shape', () => {
    // sources ≥ 1 → resolveFailed=false. answer/citation 길이가 entry 에 그대로 반영.
    const result = {
      answer: 'hello world', // length 11
      sources: [{}, {}, {}], // length 3 → resolveFailed=false
      citations: [{}, {}], // length 2
    }

    const entry = buildQueryLogEntry('what is wikey?', result, new Date('2026-05-13T09:00:00.000Z'))

    expect(entry.query).toBe('what is wikey?')
    expect(entry.answerLen).toBe(11)
    expect(entry.citationCount).toBe(2)
    expect(entry.resolveFailed).toBe(false)
    // 키 정확히 5개 (extra 키 0).
    expect(Object.keys(entry as object).sort()).toEqual(
      ['answerLen', 'citationCount', 'query', 'resolveFailed', 'ts'].sort(),
    )
  })

  it('B-2: sources=[] yields resolveFailed=true', () => {
    const result = { answer: 'no result', sources: [], citations: [] }
    const entry = buildQueryLogEntry('unknown', result, new Date('2026-05-13T10:00:00.000Z'))
    expect(entry.resolveFailed).toBe(true)
    expect(entry.citationCount).toBe(0)
    expect(entry.answerLen).toBe(9)
  })

  it('B-3: ts is ISO-8601 (Z suffix) and deterministic when `now` is injected', () => {
    const now = new Date('2026-05-13T12:34:56.789Z')
    const entry = buildQueryLogEntry('q', { answer: 'a', sources: [{}], citations: [] }, now)
    expect(entry.ts).toBe('2026-05-13T12:34:56.789Z')
    expect(entry.ts.endsWith('Z')).toBe(true)
    // Deterministic — same `now` → same ts.
    const entry2 = buildQueryLogEntry('q', { answer: 'a', sources: [{}], citations: [] }, now)
    expect(entry2.ts).toBe(entry.ts)
  })
})
