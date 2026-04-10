---
title: LLM Wiki
type: concept
created: 2026-04-10
updated: 2026-04-10
sources: [source-llm-wiki-gist.md, source-llm-wiki-community.md]
tags: [core-pattern, knowledge-management]
---

# LLM Wiki

LLM이 원시 소스를 읽고, 구조화된 위키를 점진적으로 구축·유지하는 패턴. [[andrej-karpathy]]가 2026-04-02에 제안.

## 핵심 원리

RAG와 달리 지식이 매 쿼리마다 재도출되지 않고 **영구적으로 축적**된다. 위키는 복리로 성장하는 영구 산출물이다.

- 사용자는 소스 큐레이션, 탐색, 좋은 질문에 집중
- LLM은 요약, 교차참조, 파일링, 부기 작업 전담
- "[[obsidian]]이 IDE, LLM이 프로그래머, 위키가 코드베이스"

## 구성 요소

1. **[[three-layer-architecture]]**: 원시 소스 / 위키 / 스키마
2. **[[ingest-query-lint]]**: 3가지 워크플로우
3. **[[knowledge-compounding]]**: 탐색 결과의 축적
4. **[[schema-layer]]**: LLM 행동 규칙 정의

## 적용 분야

- **개인**: 건강, 심리, 자기개발 추적 (일기, 기사, 팟캐스트)
- **연구**: 주제 심화 (논문, 기사, 리포트 → 종합 위키)
- **독서**: 챕터별 인물, 테마, 줄거리 위키 (팬 위키 개인 버전)
- **비즈니스**: Slack, 회의록, 고객 통화 → 사내 위키 (LLM 유지보수)
- **기타**: 경쟁 분석, 듀 딜리전스, 여행 계획, 취미

## 왜 작동하는가

지식 베이스의 유지보수 비용이 가치보다 빠르게 증가 → 사람은 포기. LLM은 지루해하지 않고, 한 번에 15개 파일을 갱신할 수 있다. **유지보수 비용 ≈ 0**.

역사적 맥락: [[memex]] (1945) — Bush의 비전을 LLM이 실현.

## 실사례

- [[farzapedia]] — 2,500건 → 400개 위키 문서
- [[llmbase]] — 오픈소스 구현 (React UI)
- [[secall]] — 한국어 지원 구현체

## 관련 항목

- [[rag-vs-wiki]] — RAG와의 차이
- [[byoai]] — AI 선택 자유
- [[source-llm-wiki-gist]] — 원문
- [[source-llm-wiki-community]] — 커뮤니티 반응
