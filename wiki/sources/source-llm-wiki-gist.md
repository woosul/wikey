---
title: "LLM Wiki — Karpathy 원문"
type: source
created: 2026-04-10
updated: 2026-04-10
sources: [llm-wiki.md]
tags: [llm-wiki, karpathy, pattern]
---

# LLM Wiki — Karpathy 원문

> 원본: [Karpathy LLM Wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) (2026-04-02)
> 원시 소스: `raw/resources/wikey-design/llm-wiki.md`

## 핵심 아이디어

RAG는 매 쿼리마다 지식을 재도출한다. LLM Wiki는 다르다: LLM이 **영구적 위키를 점진적으로 구축·유지**한다. 새 소스가 추가되면 단순 인덱싱이 아니라, 기존 위키에 통합 — 엔티티 페이지 업데이트, 요약 수정, 모순 플래깅, 교차참조 유지. 위키는 **복리로 성장하는 영구 산출물**이다.

사용자는 위키를 직접 작성하지 않는다. LLM이 요약, 교차참조, 파일링, 부기 작업을 모두 수행한다. 사용자는 소스 큐레이션, 탐색, 좋은 질문에 집중한다.

## [[three-layer-architecture|3계층 아키텍처]]

1. **원시 소스(Raw Sources)**: 불변. 진실의 원천. LLM은 읽기만 함
2. **위키(Wiki)**: LLM이 소유. 마크다운 페이지 — 요약, 엔티티, 개념, 비교, 개요
3. **스키마(Schema)**: LLM의 행동 규칙 정의 (CLAUDE.md, AGENTS.md 등). 사용자와 LLM이 공동 진화

## [[ingest-query-lint|3가지 워크플로우]]

- **인제스트**: 소스 → 읽기 → 요약 페이지 작성 → 엔티티/개념 페이지 업데이트 → 인덱스/로그 갱신. 하나의 소스가 10-15개 페이지를 건드림
- **쿼리**: 인덱스 → 관련 페이지 → 답변 종합 (인용 포함). 좋은 답변은 위키에 저장 — **탐색이 축적됨**
- **린트**: 모순, 고아 페이지, 깨진 링크, 누락된 교차참조 점검. 새 질문/소스 제안

## 인덱싱과 로깅

- **index.md**: 콘텐츠 지향. 전체 페이지 카탈로그. 쿼리 시 진입점. ~100 소스, ~수백 페이지까지 임베딩 없이 동작
- **log.md**: 시간순. append-only. `## [YYYY-MM-DD] type | title` 형식으로 Unix 도구와 호환

## 도구 권장

- [[obsidian]]: 그래프 뷰, Web Clipper, Marp, Dataview/Bases
- [[qmd]]: 로컬 마크다운 검색 (BM25/벡터 하이브리드, MCP 서버)
- Git: 버전 관리, 협업

## 왜 작동하는가

지식 베이스 유지의 지루한 부분(교차참조, 요약 갱신, 일관성 유지)을 LLM이 담당. 사람은 포기하지만 LLM은 지루해하지 않는다. **유지보수 비용이 거의 제로.**

역사적 맥락: [[memex|Vannevar Bush의 Memex]] (1945) — 개인 큐레이션 지식 저장소 + 연상 트레일. Bush가 풀지 못한 "누가 유지보수하는가" 문제를 LLM이 해결.

## 관련 항목

- [[llm-wiki]] — 패턴 상세
- [[rag-vs-wiki]] — RAG와의 차이
- [[knowledge-compounding]] — 축적 원리
- [[andrej-karpathy]] — 저자
