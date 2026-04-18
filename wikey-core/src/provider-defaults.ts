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
