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

  it('AC-U6 라이브 smoke fix: markdown-wrapped JSON (Gemini 응답) → devRequired/summary 추출', async () => {
    // 라이브 smoke (2026-05-09) 에서 Gemini-2.5-flash 가 prompt 의 "JSON 만 반환"
    // 지시에도 ```json\n{...}\n``` markdown fence 로 wrap. fix 전: JSON.parse 가 throw
    // → fallback 의 devRequired=false (LLM 의 true 무시). fix 후: extractJsonObject 가
    // fence/braces 추출 → 정상 parse.
    const wrappedResponse = '```json\n' + JSON.stringify({
      summary: 'Kiwi NLP v0.23.1 patch — 변경점 미명. 검토 필요.',
      devRequired: true,
      devRequiredReason: '제공된 변경 로그가 불완전하여 호환성 판단 불가',
    }) + '\n```'
    const mockLlm = {
      generate: async (): Promise<string> => wrappedResponse,
    }
    const mockFetch = async (): Promise<string> => 'changelog body...'

    const result = await analyzeUpdate({
      item: FIXTURE_ITEM,
      llm: mockLlm,
      fetch: mockFetch,
    })

    expect(result.summary).toContain('Kiwi NLP')
    expect(result.devRequired).toBe(true)
    expect(result.devRequiredReason).toBeDefined()
    expect(result.devRequiredReason!.length).toBeGreaterThan(0)
  })
})
