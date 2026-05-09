/**
 * §5.7.5 RED — update analyzer 단위 테스트.
 *
 * AC-U6: analyzeUpdate({item, llm, fetch}) 가 mock LLM 응답을 받아 summary + devRequired
 * 반환. devRequired=true 결과에 reason 포함.
 */

import { describe, it, expect } from 'vitest'
import { analyzeUpdate } from '../../update/update-analyzer.js'
import type { UpdateItemDescriptor } from '../../update/upstream-checker.js'

const FIXTURE_ITEM: UpdateItemDescriptor = {
  id: 'orama',
  kind: 'orama',
  displayName: 'Orama',
  currentVersion: '3.1.18',
  upstreamVersion: '4.0.0',
  hasUpdate: true,
  diffSource: 'https://github.com/oramasearch/orama/releases',
}

describe('§5.7.5 update-analyzer', () => {
  it('AC-U6: analyzeUpdate returns summary + devRequired heuristic', async () => {
    const mockLlm = {
      generate: async (prompt: string): Promise<string> => {
        // LLM 가 JSON 형식으로 응답
        if (prompt.includes('vendor 수정분') || prompt.includes('VENDOR.md')) {
          return JSON.stringify({
            summary: 'Orama v4 introduces breaking API for tokenizer pipeline.',
            devRequired: true,
            devRequiredReason: 'tokenizer interface 변경 — wikey 측 KoreanTokenizerHandle wrap 갱신 필요',
          })
        }
        return JSON.stringify({
          summary: 'minor patch',
          devRequired: false,
        })
      },
    }
    const mockFetch = async (_url: string): Promise<string> => 'changelog body...'

    const result = await analyzeUpdate({
      item: FIXTURE_ITEM,
      llm: mockLlm,
      fetch: mockFetch,
    })

    expect(typeof result.summary).toBe('string')
    expect(result.summary.length).toBeGreaterThan(0)
    expect(typeof result.devRequired).toBe('boolean')
    if (result.devRequired) {
      expect(result.devRequiredReason).toBeDefined()
      expect(result.devRequiredReason!.length).toBeGreaterThan(0)
    }
  })
})
