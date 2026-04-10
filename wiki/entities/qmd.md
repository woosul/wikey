---
title: qmd
type: entity
created: 2026-04-10
updated: 2026-04-10
sources: [source-llm-wiki-gist.md, source-llm-wiki-community.md]
tags: [tool, search-engine, local]
---

# qmd

로컬 마크다운 검색 엔진. @tobi가 개발.

> GitHub: [github.com/tobi/qmd](https://github.com/tobi/qmd)

## 개요

[[llm-wiki]] 위키 규모가 커지면 index.md 전체 읽기만으로는 부족해진다. qmd는 이 문제를 해결하는 로컬 검색 도구.

## 특징

- **하이브리드 검색**: BM25 + 벡터 검색
- **LLM 리랭킹**: 검색 결과를 LLM이 관련성 순으로 재정렬
- **모든 모델 로컬 실행**: 2GB 미만, 인터넷 불필요
- **CLI + MCP 서버**: 셸 명령 또는 LLM 네이티브 도구로 사용

## 검색 파이프라인

```
질문 → LLM 쿼리확장 → [BM25 × N변형 + 벡터 × N변형]
                            │
                            ▼
                       RRF 융합 (상위 30개)
                            │
                            ▼
                       LLM 리랭킹 (상위 10개)
                            │
                            ▼
                       LLM 합성 (최종 답변)
```

## 위키 확장 전략에서의 위치

| Phase | 검색 방법 | 규모 |
|-------|---------|------|
| 1 | index.md 전체 읽기 | <100페이지 |
| 2 | 카테고리 인덱스 + qmd 보조 | ~300페이지 |
| 3 | LLM 확장 → qmd 수집 → LLM 리랭킹 | ~3,000페이지 |
| 4 | 하이브리드 검색 (qmd 패턴 확장) | 10,000+ |

## 관련 항목

- [[llm-wiki]] — 기반 패턴
- [[secall]] — 한국어 검색 보완
- [[source-llm-wiki-gist]] — 원문에서 권장
