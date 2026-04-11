---
title: "Wikey 설계 의사결정"
type: source
created: 2026-04-10
updated: 2026-04-10
sources: [wikey-design-decisions.md]
tags: [wikey, adr, design-decision]
---

# Wikey 설계 의사결정

> 원시 소스: `raw/projects/wikey/wikey-design-decisions.md`

## 차별화 전략

기존 구현체([[llmbase]], [[secall]], [[qmd]])가 이미 존재하는 상황에서 Wikey의 포지셔닝:

| 차별점 | 설명 | 기존 대비 |
|--------|------|---------|
| **Zero-setup** | Obsidian 스킬 설치 + 스키마 복사 = 끝 | llmbase는 앱 설치/서버 필요 |
| **[[byoai\|BYOAI]]** | 어떤 LLM이든 연결 | 대부분 단일 모델 종속 |
| **한국어 기업 특화** (Phase 2) | 한영 혼합 용어 정규화 | 시장에 없음 |

## 7개 ADR 요약

1. **ADR-001**: [[obsidian]] 중심 — 그래프 뷰, 백링크, CLI, 플러그인 생태계
2. **ADR-002**: 개인 검증 먼저, 기업 KB는 별도 결정
3. **ADR-003**: 마크다운 + 추상화 — "File over app" 원칙
4. **ADR-004**: RAG 위의 합성 레이어 포지셔닝 ([[rag-vs-wiki]] 참조)
5. **ADR-005**: [[byoai]] — [[schema-layer|스키마]]를 프로바이더 독립으로 설계
6. **ADR-006**: LLM 참여형 다층 검색 — LLM이 양쪽 끝에 참여
7. **ADR-007**: 한국어 검색 — Phase 2에서 형태소 분석 가드레일 ([[secall]] 참고)

## 프로바이더별 역할

| 프로바이더 | 주 용도 | 장점 |
|-----------|---------|------|
| Claude Code | 메인 인제스트/쿼리/린트 | 최고 품질 합성 |
| Codex CLI | 독립 2차 리뷰 | 다른 시각 |
| Gemini | 대용량 소스 (1M+ 컨텍스트) | 긴 컨텍스트 |
| Gemma 4 (로컬) | 쿼리 확장, 오프라인 | 무료, 프라이버시 |

## 관련 항목

- [[byoai]] — ADR-005의 상세
- [[schema-layer]] — BYOAI를 가능하게 하는 설계
- [[rag-vs-wiki]] — ADR-004, ADR-006의 근거
- [[llm-wiki]] — 기반 패턴
