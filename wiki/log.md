---
title: 활동 로그
type: log
created: 2026-04-10
updated: 2026-04-10
---

# 활동 로그

> 형식: `## [YYYY-MM-DD] type | title`
> type: ingest, query, lint, delete, re-ingest
> 이 파일은 append-only. 과거 항목을 수정하지 않는다.

## [2026-04-10] ingest | Karpathy LLM Wiki 원문

- 원시 소스: `raw/articles/llm-wiki.md`
- 소스 요약 생성: [[source-llm-wiki-gist]]
- 엔티티 생성: [[andrej-karpathy]], [[qmd]]
- 개념 생성: [[llm-wiki]], [[three-layer-architecture]], [[knowledge-compounding]], [[ingest-query-lint]], [[rag-vs-wiki]], [[schema-layer]], [[memex]]
- 인덱스 갱신: 12개 항목 등재

## [2026-04-10] ingest | LLM Wiki 커뮤니티 반응과 사례

- 원시 소스: `raw/articles/idea-comment.md`
- 소스 요약 생성: [[source-llm-wiki-community]]
- 엔티티 생성: [[farzapedia]], [[llmbase]], [[secall]]
- 개념 생성: [[byoai]]
- 엔티티 업데이트: [[andrej-karpathy]], [[qmd]] (소스 추가)
- 개념 업데이트: [[llm-wiki]], [[knowledge-compounding]], [[rag-vs-wiki]], [[memex]] (커뮤니티 사례 반영)
- 인덱스 갱신: 15개 항목 등재

## [2026-04-10] ingest | Karpathy Append-and-Review Note

- 원시 소스: `raw/articles/append-and-review-note.md` (웹 기사, defuddle로 추출)
- 소스 요약 생성: [[source-append-and-review]]
- 개념 생성: [[append-and-review]]
- 엔티티 업데이트: [[andrej-karpathy]] (소스 추가, append-and-review 섹션 추가)
- 인덱스 갱신

## [2026-04-10] ingest | Wikey 설계 의사결정

- 원시 소스: `raw/notes/wikey-design-decisions.md` (개인 메모)
- 소스 요약 생성: [[source-wikey-design-decisions]]
- 기존 개념/엔티티에 교차참조 추가 (ADR → byoai, schema-layer, rag-vs-wiki)
- 인덱스 갱신

## [2026-04-10] query | LLM Wiki의 가장 큰 리스크는 무엇인가?

- 분석 저장: [[risks-of-llm-wiki]]
- 참조 페이지: source-llm-wiki-community, source-wikey-design-decisions, llm-wiki, byoai
- 인덱스 갱신: 분석 카테고리에 1건 추가

## [2026-04-10] ingest | DJI O3 Air Unit 사용자 매뉴얼 (PDF 청킹 테스트)

- 원시 소스: `raw/manual/00.게임기기/830 FPV/DJI O3 Air Unit/DJI_O3_Air_Unit_User_Manual_v1.0_EN.pdf` (33p)
- 청킹 방법: 3분할 읽기 (p1-5 TOC+경고, p6-15 본체+설치+고글UI, p16-33 호환장비+스펙)
- 소스 요약 생성: [[source-dji-o3-air-unit]]
- 엔티티 생성: [[dji-o3-air-unit]]
- 개념 생성: [[fpv-digital-transmission]]
- 인덱스 갱신
