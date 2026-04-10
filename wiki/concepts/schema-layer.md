---
title: 스키마 레이어
type: concept
created: 2026-04-10
updated: 2026-04-10
sources: [source-llm-wiki-gist.md]
tags: [architecture, configuration]
---

# 스키마 레이어

[[three-layer-architecture|3계층 아키텍처]]의 세 번째 레이어. LLM을 "일반 챗봇이 아닌 규율 있는 위키 관리자"로 만드는 핵심 설정.

## 역할

LLM에게 위키의 구조, 컨벤션, 워크플로우를 알려주는 설정 문서. 다음을 정의한다:

- 디렉토리 구조와 파일 네이밍 규칙
- 프론트매터 형식 (YAML)
- 위키링크 컨벤션
- [[ingest-query-lint|인제스트·쿼리·린트]] 워크플로우 절차
- index.md, log.md 형식
- 쓰기 규칙 (raw/ 수정 금지 등)

## 공동 진화

스키마는 사용자와 LLM이 함께 발전시킨다. 도메인에 맞지 않는 규칙은 수정하고, 새로운 필요가 생기면 추가한다. Karpathy 원문에서 의도적으로 추상적으로 남겨둔 이유: "각자의 도메인, 선호, LLM에 맞춰 구체화하라."

## [[byoai|BYOAI]] 분리 설계

```
wikey.schema.md  ← 모든 LLM이 읽는 마스터 스키마
    │
    ├── CLAUDE.md          ← Claude Code 도구 사용법
    ├── AGENTS.md          ← Codex CLI 도구 사용법
    └── local-llm/         ← 로컬 LLM 시스템 프롬프트
        └── system-prompt.md
```

마스터 스키마에 **what**과 **why**를 정의하고, 프로바이더 설정에 **how**를 기술.

## 관련 항목

- [[three-layer-architecture]] — 전체 구조
- [[byoai]] — 프로바이더 독립 원칙
- [[llm-wiki]] — 기반 패턴
