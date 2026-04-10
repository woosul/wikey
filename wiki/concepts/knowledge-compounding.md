---
title: 지식 축적 (Knowledge Compounding)
type: concept
created: 2026-04-10
updated: 2026-04-10
sources: [source-llm-wiki-gist.md, source-llm-wiki-community.md]
tags: [core-principle, accumulation]
---

# 지식 축적 (Knowledge Compounding)

[[llm-wiki]] 패턴의 핵심 원리. 지식이 복리처럼 축적되는 메커니즘.

## 원리

RAG에서 쿼리 결과는 대화가 끝나면 사라진다. LLM Wiki에서는 **좋은 쿼리 결과가 위키에 다시 저장**된다. 비교, 분석, 발견한 연결 — 이 모든 것이 위키의 영구적인 부분이 된다.

> "탐색은 축적된다" — [[llm-wiki]] 핵심 원칙 #3

## 메커니즘

```
소스 인제스트 → 위키 페이지 생성
  │
  ▼
쿼리 → 여러 페이지 종합 → 새로운 분석
  │
  ▼
분석을 위키에 저장 → 다음 쿼리의 재료
  │
  ▼
린트 → 새 연결 발견 → 추가 탐색 제안
  ... (선순환)
```

## 실증 사례

- **[[farzapedia]]**: 2,500건 소스 → 400개 위키 문서. 에이전트가 Studio Ghibli 다큐, YC 랜딩 페이지, Beatles 이미지를 종합해 답변할 수 있는 이유는 위키에 축적된 교차참조 덕분
- **[[llmbase]]**: 개발자가 "탐색의 축적이 가장 강력"이라고 평가. Q&A 답변 → 위키 저장 → 린트가 새 연결 제안하는 선순환

## [[rag-vs-wiki|RAG와의 차이]]

| | RAG | LLM Wiki |
|---|---|---|
| 쿼리 결과 | 대화에서 소멸 | 위키에 영구 저장 |
| 교차참조 | 매번 재발견 | 이미 구축됨 |
| 모순 감지 | 불가능 | 자동 플래깅 |
| 지식 성장 | 선형 (소스 추가만) | 복리 (탐색도 축적) |

## 관련 항목

- [[llm-wiki]] — 기반 패턴
- [[ingest-query-lint]] — 축적이 일어나는 워크플로우
- [[rag-vs-wiki]] — RAG 비교
