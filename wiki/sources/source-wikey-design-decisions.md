---
title: Wikey 설계 의사결정 노트
created: 2026-04-10
updated: 2026-04-10
sources: [source-wikey-design-decisions.md]
tags: [design, architecture, wikey]
---

# Wikey 설계 의사결정 노트

> 작성일: 2026-04-10
> 맥락: wikey 프로젝트 초기 설정 시 내린 핵심 결정들

## 차별화 전략

llmbase(React UI), seCall(한국어 검색), qmd(LLM 다층 검색)가 이미 존재. 기능만으로는 차별점이 약함.

**Wikey의 3가지 차별점:**
1. **Zero-setup**: Obsidian에 스킬셋 설치 + 스키마 파일 복사 = 끝. 앱 설치, 서버 구축, DB 설정 불필요
2. **BYOAI**: Claude Code, Codex, Gemini, Gemma 4(로컬) 등 어떤 LLM 에이전트든 연결. 특정 모델에 종속되지 않음
3. **한국어 기업 특화** (Phase 2): 한영 혼합 기술 용어 정규화, 한국 기업 도구 연동 — 이 조합은 시장에 없음

## 핵심 ADR (Architecture Decision Records)

### ADR-001: Obsidian 중심
Obsidian을 위키 브라우저로 채택. 그래프 뷰, 백링크, CLI, 플러그인 생태계 활용.

### ADR-002: 2개 분리 (개인 검증 → 기업 별도)
Phase 1에서 개인용으로 검증 후, Phase 2에서 기업 KB는 별도 결정.

### ADR-003: 마크다운 + 추상화
Karpathy 원문의 "File over app" 원칙 따름. 마크다운 범용 포맷으로 도구 종속성 제거.

### ADR-004: RAG "합성 레이어" 포지셔닝
RAG와 경쟁이 아니라, RAG 위에 지식 합성 레이어를 얹는 포지셔닝. 검색은 외부 도구, 합성은 LLM.

### ADR-005: BYOAI — LLM 프로바이더 독립
스키마를 프로바이더 독립적으로 설계. `wikey.schema.md`가 마스터, 프로바이더별 파일은 도구 사용법만 추가.

### ADR-006: LLM 참여형 다층 검색 (RAG와의 차이)
검색을 DB에 위임하면 다시 RAG가 된다. LLM이 검색의 양쪽 끝에 참여하되, 중간 대량 스캔만 외부 도구가 담당.

### ADR-007: 한국어 검색 전략
BM25는 한글에 약하므로, Phase 2에서 형태소 분석 기반 가드레일 도입. seCall 참고.

## 프로바이더별 역할 분담

| 프로바이더 | 용도 | 장점 | 한계 |
|-----------|------|------|------|
| Claude Code | 메인 인제스트/쿼리/린트 | 최고 품질 합성 | 비용, 온라인 필수 |
| Codex CLI | 독립 2차 리뷰, 병렬 인제스트 | 독립 관점 | API 별도 |
| Gemini | 대용량 소스 처리 (1M+ 컨텍스트) | 긴 컨텍스트, 무료 티어 | 도구 연동 약함 |
| Gemma 4 (로컬) | 쿼리 확장, 리랭킹, 오프라인 | 무료, 프라이버시 | 합성 품질 낮음 |

## Phase 로드맵

- Phase 1 (2-3주): 개인 위키 검증 + BYOAI 기반
- Phase 2: 한국어 기업 특화 + 공개 배포