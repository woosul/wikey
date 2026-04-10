---
title: 3계층 아키텍처
type: concept
created: 2026-04-10
updated: 2026-04-10
sources: [source-llm-wiki-gist.md]
tags: [architecture, core-pattern]
---

# 3계층 아키텍처

[[llm-wiki]] 시스템의 기본 구조. 3개의 레이어가 명확히 분리된 역할을 가진다.

## 계층 구조

| 레이어 | 위치 | 소유자 | 불변성 |
|--------|------|--------|--------|
| **원시 소스** | `raw/` | 사용자 | 불변 (LLM 읽기만) |
| **위키** | `wiki/` | LLM | LLM이 자유롭게 수정 |
| **스키마** | `wikey.schema.md` 등 | 사용자+LLM | 사용자 승인 필요 |

## 원시 소스 (Raw Sources)

사용자가 큐레이션한 소스 문서 컬렉션. 기사, 논문, 이미지, 데이터 파일. **불변** — LLM은 읽기만 하고 절대 수정하지 않는다. 진실의 원천(source of truth).

## 위키 (Wiki)

LLM이 생성한 마크다운 파일 디렉토리. 요약, 엔티티 페이지, 개념 페이지, 비교, 개요, 종합 분석. LLM이 이 레이어를 완전히 소유 — 페이지 생성, 새 소스 도착 시 업데이트, 교차참조 유지, 일관성 관리.

## [[schema-layer|스키마 (Schema)]]

LLM에게 위키의 구조, 컨벤션, 워크플로우를 알려주는 설정 문서. [[byoai]] 원칙에 따라 프로바이더별로 다른 설정 파일을 사용할 수 있다 (CLAUDE.md, AGENTS.md 등). 사용자와 LLM이 함께 진화시킨다.

## 데이터 흐름

```
사용자 → raw/ (소스 추가)
  │
  ▼
LLM이 읽기 → wiki/ (페이지 생성·수정)
  │
  ▼
사용자가 Obsidian으로 브라우징
```

## 관련 항목

- [[llm-wiki]] — 패턴 전체
- [[schema-layer]] — 스키마 레이어 상세
- [[ingest-query-lint]] — 3가지 워크플로우
