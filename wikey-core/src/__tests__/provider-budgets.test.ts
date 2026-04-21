import { describe, it, expect } from 'vitest'
import {
  PROVIDER_CONTEXT_BUDGETS,
  getProviderBudget,
  estimateTokens,
  selectRoute,
} from '../provider-defaults.js'

// §2 Token-budget Route 판정 — RED 테스트

describe('PROVIDER_CONTEXT_BUDGETS — 4 provider 엔트리', () => {
  it('gemini/anthropic/openai/ollama 각 기본 모델의 context 예산이 정의된다', () => {
    expect(PROVIDER_CONTEXT_BUDGETS['gemini-2.5-flash']).toBeDefined()
    expect(PROVIDER_CONTEXT_BUDGETS['claude-haiku-4-5-20251001']).toBeDefined()
    expect(PROVIDER_CONTEXT_BUDGETS['gpt-4.1-mini']).toBeDefined()
    expect(PROVIDER_CONTEXT_BUDGETS['qwen3:8b']).toBeDefined()
  })

  it('각 budget 에 contextTokens / outputReserve / promptOverhead 필드 존재', () => {
    const b = PROVIDER_CONTEXT_BUDGETS['gemini-2.5-flash']
    expect(b.contextTokens).toBeGreaterThan(0)
    expect(b.outputReserve).toBeGreaterThan(0)
    expect(b.outputReserve).toBeLessThan(1)
    expect(b.promptOverhead).toBeGreaterThan(0)
  })

  it('Gemini 2.5 Flash context 가 Claude Haiku 보다 크다', () => {
    const g = PROVIDER_CONTEXT_BUDGETS['gemini-2.5-flash']
    const a = PROVIDER_CONTEXT_BUDGETS['claude-haiku-4-5-20251001']
    expect(g.contextTokens).toBeGreaterThan(a.contextTokens)
  })
})

describe('getProviderBudget — provider/model 조합으로 budget 조회', () => {
  it('알려진 provider+model → 해당 budget', () => {
    const b = getProviderBudget('gemini', 'gemini-2.5-flash')
    expect(b.contextTokens).toBe(1_000_000)
  })

  it('알려진 provider 이지만 모델이 표에 없을 때 → 기본값 fallback', () => {
    const b = getProviderBudget('gemini', 'gemini-2.5-pro')
    expect(b.contextTokens).toBeGreaterThan(0)  // 어떤 값이든 fallback
  })

  it('Ollama 기본은 qwen3:8b budget', () => {
    const b = getProviderBudget('ollama', 'qwen3:8b')
    expect(b.contextTokens).toBe(32_000)
  })
})

describe('estimateTokens — 언어별 divisor + 30% margin', () => {
  it('영문 1000자 → 토큰 약 325 (1000/4 × 1.3)', () => {
    const md = 'a '.repeat(500)  // 1000 chars of mostly English
    const tokens = estimateTokens(md)
    expect(tokens).toBeGreaterThanOrEqual(200)
    expect(tokens).toBeLessThanOrEqual(500)
  })

  it('한국어 1000자 → 토큰 약 866 (1000/1.5 × 1.3)', () => {
    const md = '가나다라마바사아자차카타파하'.repeat(100)  // ~1500 korean chars
    const tokens = estimateTokens(md)
    // 1500/1.5 × 1.3 = 1300 예상
    expect(tokens).toBeGreaterThanOrEqual(1000)
    expect(tokens).toBeLessThanOrEqual(1600)
  })

  it('mixed (한영 혼합) → 영문과 한국어 사이', () => {
    const korean = '한국어'.repeat(100)  // 300 korean chars
    const english = 'english text '.repeat(60)  // ~720 chars
    const md = korean + english
    const all = estimateTokens(md)
    const koOnly = estimateTokens(korean)
    const enOnly = estimateTokens(english)
    expect(all).toBeGreaterThan(koOnly)
    expect(all).toBeGreaterThan(enOnly)
  })

  it('빈 문자열 → 0', () => {
    expect(estimateTokens('')).toBe(0)
  })
})

describe('selectRoute — FULL / SEGMENTED 판정', () => {
  it('Gemini 2.5 Flash + PMS 사이즈 (83KB 한국어) → FULL', () => {
    const md = '한국어 내용입니다. '.repeat(5000)  // ≈ 50,000 chars
    expect(selectRoute(md, 'gemini', 'gemini-2.5-flash')).toBe('FULL')
  })

  it('Ollama qwen3:8b + 큰 한국어 문서 → SEGMENTED', () => {
    const md = '한국어 내용입니다. '.repeat(5000)  // ≈ 50,000 chars → ≈ 43K tokens
    // qwen3:8b usable ≈ 20K tokens → overflow → SEGMENTED
    expect(selectRoute(md, 'ollama', 'qwen3:8b')).toBe('SEGMENTED')
  })

  it('매우 작은 문서는 어느 provider 든 FULL', () => {
    const md = '짧은 본문.'
    expect(selectRoute(md, 'gemini', 'gemini-2.5-flash')).toBe('FULL')
    expect(selectRoute(md, 'ollama', 'qwen3:8b')).toBe('FULL')
  })

  it('결정성: 같은 입력 3회 호출 동일 결과', () => {
    const md = '한국어 '.repeat(1000)
    const a = selectRoute(md, 'gemini', 'gemini-2.5-flash')
    const b = selectRoute(md, 'gemini', 'gemini-2.5-flash')
    const c = selectRoute(md, 'gemini', 'gemini-2.5-flash')
    expect(a).toBe(b)
    expect(b).toBe(c)
  })
})
