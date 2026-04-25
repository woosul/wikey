/**
 * LLM prompt few-shot example placeholders.
 *
 * canonicalizer / ingest-pipeline / schema 의 prompt 안에서 LLM 에게 응답 형식 견본을
 * 보여줄 때 사용하는 placeholder 값. 실재 회사명·고유명사 hardcoding 을 피하기 위한
 * 공통 상수. (PII no-hardcoding 정책 — `feedback_pii_no_hardcoding.md` 와 일관.)
 *
 * 변경 가이드:
 * - 실재 회사명·인명·고유 자산명 사용 금지. generic placeholder 만.
 * - 다국어 example 이 필요하면 KO 변형 따로 추가.
 * - PMI 같은 표준 약어 (PMBOK 등) 는 hardcoded OK — PII 가 아니고 example 의미가 표준명에 있음.
 */

export const EXAMPLE_ORG_BASE = 'example-corp-ltd' as const
export const EXAMPLE_ORG_ALIAS = 'example-corp' as const
export const EXAMPLE_ORG_KO = '주식회사 예제' as const
export const EXAMPLE_ORG_DESC_KO = `${EXAMPLE_ORG_KO}. 소프트웨어 개발/제조업.` as const

export const EXAMPLE_PERSON_BASE = 'example-person' as const
export const EXAMPLE_PRODUCT_BASE = 'example-product' as const

export const EXAMPLE_CONCEPT_BASE = 'project-management-body-of-knowledge' as const
export const EXAMPLE_CONCEPT_ALIAS = 'pmbok' as const
