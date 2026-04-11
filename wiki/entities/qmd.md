---
title: qmd
type: entity
created: 2026-04-10
updated: 2026-04-11
sources: [source-llm-wiki-gist.md, source-llm-wiki-community.md, source-wikey-design-decisions.md]
tags: [tool, search-engine, local, infrastructure]
---

# qmd

로컬 마크다운 하이브리드 검색 엔진. Shopify CEO Tobi Lütke(@tobi)가 개발. wikey의 **검색 인프라**로 사용.

> GitHub: [github.com/tobi/qmd](https://github.com/tobi/qmd)
> 소스 분석: `tools/qmd-comprehension-guide.md`

## 개요

[[llm-wiki]] 위키 규모가 커지면 index.md 전체 읽기만으로는 부족해진다. qmd는 BM25 + 벡터 + RRF 융합으로 이 문제를 해결하는 로컬 검색 도구. wikey에서는 **검색 인프라**로 항상 사용되며, 지능 레이어(쿼리 확장, 리랭킹, 합성)는 LLM이 담당한다.

## wikey 통합 현황

- **소스**: `tools/qmd/`에 GitHub 소스 클론 (v2.1.0, vendored)
- **MCP**: `~/.claude.json`에 글로벌 등록, Claude Code 쿼리 세션에서 활용
- **CLI**: `local-llm/wikey-query.sh`에서 basic/gemma4 backend로 호출
- **설정**: `local-llm/wikey.conf`에서 `WIKEY_SEARCH_BACKEND` 선택
- **upstream**: `scripts/update-qmd.sh --check / --apply`로 관리

## 아키텍처 — 검색 인프라 + 지능 레이어

```
backend=basic:
  질문 → qmd(내장 확장 1.7B → 검색 → RRF → 내장 리랭킹 0.6B) → LLM 합성

backend=gemma4:
  질문 → Gemma 4 확장 → qmd(검색 + RRF만) → Gemma 4 리랭킹+합성
```

qmd 내장 모델 3개 (총 ~2.2GB):
- EmbeddingGemma-300M (임베딩)
- qmd-query-expansion-1.7B (쿼리 확장)
- Qwen3-Reranker-0.6B (리랭킹)

## 벤치마크 (Phase 2, 2026-04-11)

| backend | 한국어 Top-1 | 비고 |
|---------|------------|------|
| basic | 0/5 | qmd 내장 모델 영어 중심 |
| gemma4 | 1/5 | Gemma 4 확장이 약간 나음 |

→ Step 3에서 한국어 형태소 분석 + 청킹 혁신으로 개선 예정.

## 관련 항목

- [[llm-wiki]] — 기반 패턴
- [[secall]] — 한국어 BM25 가드레일 참조
- [[source-llm-wiki-gist]] — 원문에서 권장
- [[source-llm-wiki-community]] — 커뮤니티 사례
