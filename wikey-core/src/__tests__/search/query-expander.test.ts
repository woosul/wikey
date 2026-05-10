/**
 * §5.7.8 Spec 5 — QueryExpander unit tests (AC-F7).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  QueryExpander,
  clampHydeLength,
  HYDE_MAX_CHARS,
  MULTI_QUERY_DEFAULT_N,
} from '../../search/query-expander.js'
import type { FilterLLM } from '../../search/query-intent-filter.js'

const PROMPT = readFileSync(
  join(__dirname, '..', '..', 'prompts', 'query-expander.prompt.md'),
  'utf-8',
)

function llmReturning(text: string): FilterLLM {
  return { async call() { return text } }
}

describe('QueryExpander — AC-F7', () => {
  it('Happy path: HyDE doc + multi-query variants returned', async () => {
    const llm = llmReturning(JSON.stringify({
      hypotheticalDoc: '당뇨병 환자의 합병증 예방을 위한 주요 가이드라인을 정리한 문서.',
      multiQueries: ['당뇨 합병증 예방', '당뇨병 합병증 관리', '당뇨 환자 예방 수칙'],
    }))
    const expander = new QueryExpander({ llm, promptTemplate: PROMPT })
    const decision = await expander.expand(['당뇨', '합병증', '예방'], '당뇨 합병증 예방')
    expect(decision.fallback).toBe('none')
    expect(decision.hypotheticalDoc).toBeDefined()
    expect(decision.multiQueries?.length).toBe(MULTI_QUERY_DEFAULT_N)
  })

  it('HyDE longer than HYDE_MAX_CHARS is truncated', () => {
    const long = 'x'.repeat(HYDE_MAX_CHARS * 2)
    const out = clampHydeLength(long)
    expect(out!.length).toBeLessThanOrEqual(HYDE_MAX_CHARS)
  })

  it('LLM throw → fail-open with empty expansion', async () => {
    const llm: FilterLLM = { async call() { throw new Error('boom') } }
    const expander = new QueryExpander({ llm, promptTemplate: PROMPT })
    const decision = await expander.expand(['당뇨'], '당뇨')
    expect(decision.fallback).toBe('llm-fail')
    expect(decision.hypotheticalDoc).toBeUndefined()
    expect(decision.multiQueries).toBeUndefined()
  })

  it('Empty filtered tokens + empty query → no LLM call, fallback none', async () => {
    let called = 0
    const llm: FilterLLM = {
      async call() { called += 1; return '{}' },
    }
    const expander = new QueryExpander({ llm, promptTemplate: PROMPT })
    const decision = await expander.expand([], '')
    expect(called).toBe(0)
    expect(decision.fallback).toBe('none')
  })
})
