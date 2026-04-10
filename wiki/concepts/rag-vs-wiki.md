---
title: RAG vs LLM Wiki
type: concept
created: 2026-04-10
updated: 2026-04-10
sources: [source-llm-wiki-gist.md, source-llm-wiki-community.md]
tags: [comparison, rag, core-distinction]
---

# RAG vs LLM Wiki

[[llm-wiki]] 패턴과 RAG(Retrieval-Augmented Generation)의 핵심 차이.

## 비교

| | RAG | LLM Wiki |
|---|---|---|
| **지식 구축** | 매 쿼리마다 재도출 | 한 번 컴파일, 점진적 갱신 |
| **교차참조** | 매번 재발견 | 이미 구축되어 있음 |
| **모순 감지** | 불가능 | 인제스트/린트 시 자동 플래깅 |
| **쿼리 결과** | 대화에서 소멸 | 위키에 영구 저장 가능 |
| **구조** | 비구조적 청크 | 엔티티/개념/소스별 구조화 페이지 |
| **유지보수 주체** | 없음 (인덱싱만) | LLM이 적극적으로 유지 |
| **성장 패턴** | 선형 (소스 추가만) | 복리 ([[knowledge-compounding|탐색도 축적]]) |

## "결국 RAG 아닌가" 논쟁

Hacker News에서 반복된 질문. 벡터 DB는 없지만 의미적 연결 인덱스를 만들고 계층적 구조를 구성하는 점에서 RAG와 유사하다는 의견.

**반론**: LLM이 위키를 **직접 작성하고 유지**하며, 백링크와 불일치 검사를 수행하는 것은 검색(retrieval)이 아니라 **지식 합성(knowledge synthesis)**에 가깝다.

> "LLM이 스스로 Zettelkasten을 관리하는 느낌" — HN 댓글

## [[farzapedia]] 실증

1년 전 RAG 기반으로 유사 시스템을 구축했으나 성능이 좋지 않았고, 에이전트가 파일 시스템을 통해 직접 탐색하는 방식으로 전환 후 효과가 극대화됨.

## 관련 항목

- [[llm-wiki]] — 패턴 상세
- [[knowledge-compounding]] — 축적 원리
- [[farzapedia]] — RAG→Wiki 전환 사례
