/**
 * provider-defaults.ts — 프로바이더별 기본 모델 단일 소스.
 *
 * **하드코딩 금지 원칙**: 코드 어디에서도 모델명 리터럴을 직접 쓰지 말고
 * 이 모듈에서 import 하거나 사용자 설정값(`config.WIKEY_MODEL` 등)을 참조해라.
 *
 * 왜 한 파일에 모으는가:
 * - `gpt-4o` vs `gpt-4.1` 같은 불일치 재발 방지
 * - 새 모델 출시 시 한 곳만 수정하면 전 파이프라인 반영
 * - 사용자가 UI에서 Model 미선택 시의 폴백 일관성
 *
 * 미래 확장: 이 값을 `wikey.conf`에서 `WIKEY_DEFAULT_GEMINI_MODEL=` 등으로
 * override 가능하도록 config 파서를 확장할 수 있다. 현재는 code-level 기본값만.
 */

import type { LLMProvider } from './types.js'

/**
 * 일반 텍스트 채팅/인제스트용 provider별 기본 모델.
 * 기준: `gemini-2.5-flash`와 동급 — 똑똑하면서 가성비 좋은 mid-tier.
 * 사용자가 UI에서 Model을 고르지 않고 Provider만 선택했을 때 폴백.
 */
export const PROVIDER_CHAT_DEFAULTS: Readonly<Record<LLMProvider, string>> = {
  gemini: 'gemini-2.5-flash',
  anthropic: 'claude-haiku-4-5-20251001', // haiku = flash 동급 (속도+저비용)
  openai: 'gpt-4.1-mini',                  // 4.1 mini = flash 동급
  ollama: 'qwen3:8b',                      // 로컬 mid-size (5.2GB)
}

/**
 * Vision/OCR (markitdown-ocr)용 provider별 기본 모델.
 * 기준: chat 모델과 동급 가성비 + vision 공식 지원.
 * Anthropic은 OpenAI-compat vision API 미지원 → Ollama로 fallback(resolveOcrEndpoint에서 처리).
 */
export const PROVIDER_VISION_DEFAULTS: Readonly<Record<LLMProvider, string>> = {
  gemini: 'gemini-2.5-flash',             // flash도 vision 지원
  anthropic: 'claude-haiku-4-5-20251001', // (미사용 경로, fallback으로 이동)
  openai: 'gpt-4o-mini',                   // 4o-mini는 vision 확정 + 가성비
  ollama: 'gemma4:26b',                    // qwen3:8b는 vision 미지원
}

/**
 * Contextual Retrieval (맥락 프리픽스 생성)용 기본 모델.
 * 항상 Ollama 로컬 실행 (latency + cost 최적).
 */
export const CONTEXTUAL_DEFAULT_MODEL = 'gemma4:26b'

/**
 * 빈 config에서도 안전한 기본 BASIC 프로바이더.
 */
export const DEFAULT_BASIC_PROVIDER: LLMProvider = 'ollama'

/**
 * Anthropic API key 연결 테스트 전용 ping 모델 (과금 최소화용 경량).
 * ingest/query와 무관.
 */
export const ANTHROPIC_PING_MODEL = 'claude-haiku-4-5-20251001'

// ── §4.5.1.5 v2: Token-budget Route 판정 ──

/**
 * 프로바이더별 context 예산.
 * - contextTokens: 모델의 총 context window (tokens)
 * - outputReserve: output 을 위해 남겨둘 비율 (0~1)
 * - promptOverhead: schema/prompt template 고정 영역 (tokens)
 *
 * usable = contextTokens × (1 - outputReserve) - promptOverhead
 */
export interface ContextBudget {
  readonly contextTokens: number
  readonly outputReserve: number
  readonly promptOverhead: number
}

export const PROVIDER_CONTEXT_BUDGETS: Readonly<Record<string, ContextBudget>> = {
  'gemini-2.5-flash':          { contextTokens: 1_000_000, outputReserve: 0.25, promptOverhead: 2000 },
  'gemini-2.5-pro':            { contextTokens: 1_000_000, outputReserve: 0.25, promptOverhead: 2000 },
  'claude-haiku-4-5-20251001': { contextTokens:   200_000, outputReserve: 0.25, promptOverhead: 2000 },
  'claude-sonnet-4-6':         { contextTokens:   200_000, outputReserve: 0.25, promptOverhead: 2000 },
  'claude-opus-4-7':           { contextTokens:   200_000, outputReserve: 0.25, promptOverhead: 2000 },
  'gpt-4.1-mini':              { contextTokens: 1_000_000, outputReserve: 0.25, promptOverhead: 2000 },
  'gpt-4.1':                   { contextTokens: 1_000_000, outputReserve: 0.25, promptOverhead: 2000 },
  'qwen3:8b':                  { contextTokens:    32_000, outputReserve: 0.30, promptOverhead: 2000 },
}

/** Provider 의 폴백 모델 (PROVIDER_CHAT_DEFAULTS) budget 을 기본으로 반환. */
export function getProviderBudget(provider: string, model: string): ContextBudget {
  const exact = PROVIDER_CONTEXT_BUDGETS[model]
  if (exact) return exact
  const fallbackModel = PROVIDER_CHAT_DEFAULTS[provider as LLMProvider]
  if (fallbackModel) {
    const b = PROVIDER_CONTEXT_BUDGETS[fallbackModel]
    if (b) return b
  }
  // 최후 보수 fallback — Ollama qwen3:8b 크기 (가장 제약된 환경)
  return { contextTokens: 32_000, outputReserve: 0.30, promptOverhead: 2000 }
}

/**
 * Token 추정 (tokenizer 의존성 회피하는 간단 휴리스틱).
 * - 영문 1자 ≈ 0.25 token (divisor 4)
 * - 한국어 1자 ≈ 0.67 token (divisor 1.5)
 * - mixed: divisor 2.5
 * 30% margin 을 곱해 under-estimation 방지.
 */
export function estimateTokens(md: string): number {
  if (md.length === 0) return 0
  let koreanChars = 0
  for (const c of md) {
    if (c >= '가' && c <= '힯') koreanChars++
  }
  const ratio = koreanChars / md.length
  const divisor = ratio > 0.6 ? 1.5 : ratio > 0.2 ? 2.5 : 4.0
  return Math.ceil((md.length / divisor) * 1.3)
}

/**
 * Route 판정: 문서 토큰 ≤ usable budget → FULL, 초과 → SEGMENTED.
 * Ollama 는 context 가 작아 대부분의 Korean 문서에서 SEGMENTED.
 */
export function selectRoute(md: string, provider: string, model: string): 'FULL' | 'SEGMENTED' {
  const b = getProviderBudget(provider, model)
  const usable = b.contextTokens * (1 - b.outputReserve) - b.promptOverhead
  return estimateTokens(md) <= usable ? 'FULL' : 'SEGMENTED'
}
