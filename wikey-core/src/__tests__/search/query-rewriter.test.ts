/**
 * §5.7.8 Spec 5 — QueryRewriter unit tests (AC-F6).
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { QueryRewriter, tokenEditRatio } from '../../search/query-rewriter.js'
import type { FilterLLM } from '../../search/query-intent-filter.js'

const PROMPT = readFileSync(
  join(__dirname, '..', '..', 'prompts', 'query-rewriter.prompt.md'),
  'utf-8',
)

function llmReturning(text: string): FilterLLM {
  return { async call() { return text } }
}

describe('QueryRewriter — AC-F6 minimal change', () => {
  it('Happy path: synonym substitution within edit-distance threshold', async () => {
    const llm = llmReturning(JSON.stringify({
      rewrittenQuery: '당뇨병 합병증 예방',
      changes: [{ from: '당뇨', to: '당뇨병', reason: 'canonical form' }],
    }))
    const rewriter = new QueryRewriter({ llm, promptTemplate: PROMPT })
    const decision = await rewriter.rewrite(['당뇨', '합병증', '예방'], '당뇨 합병증 예방')
    expect(decision.fallback).toBe('none')
    expect(decision.rewrittenQuery).toBe('당뇨병 합병증 예방')
    expect(decision.changes.length).toBe(1)
  })

  it('Edit distance > 50% → fallback "minimal-change" + filtered tokens used', async () => {
    const llm = llmReturning(JSON.stringify({
      rewrittenQuery: 'completely different query about something else entirely',
      changes: [],
    }))
    const rewriter = new QueryRewriter({ llm, promptTemplate: PROMPT })
    const decision = await rewriter.rewrite(['당뇨', '합병증'], '당뇨 합병증')
    expect(decision.fallback).toBe('minimal-change')
    expect(decision.rewrittenQuery).toBe('당뇨 합병증')
  })

  it('LLM throw → fail-open with filtered tokens preserved', async () => {
    const llm: FilterLLM = { async call() { throw new Error('boom') } }
    const rewriter = new QueryRewriter({ llm, promptTemplate: PROMPT })
    const decision = await rewriter.rewrite(['당뇨', '합병증'], '당뇨 합병증')
    expect(decision.fallback).toBe('llm-fail')
    expect(decision.rewrittenQuery).toBe('당뇨 합병증')
  })

  it('tokenEditRatio computes Levenshtein over tokens correctly', () => {
    expect(tokenEditRatio(['a', 'b', 'c'], 'a b c')).toBe(0)
    expect(tokenEditRatio(['a', 'b'], 'a c')).toBe(0.5)
    expect(tokenEditRatio(['a', 'b'], 'x y')).toBe(1)
  })
})
