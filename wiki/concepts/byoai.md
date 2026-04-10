---
title: BYOAI (Bring Your Own AI)
type: concept
created: 2026-04-10
updated: 2026-04-10
sources: [source-llm-wiki-gist.md, source-llm-wiki-community.md]
tags: [principle, provider-independence]
---

# BYOAI (Bring Your Own AI)

[[llm-wiki]] 패턴의 4가지 장점 중 하나. AI 선택의 자유.

## 원칙

위키 시스템이 특정 LLM에 종속되지 않는다. Claude Code, Codex, Gemini, 오픈소스 모델 등 원하는 AI를 자유롭게 연결할 수 있다. 마크다운 파일은 범용 포맷이므로 어떤 LLM도 읽고 쓸 수 있다.

## 구현 방식

[[three-layer-architecture|3계층 아키텍처]]의 **스키마 레이어**를 프로바이더별로 분리:

| 파일 | 대상 LLM |
|------|---------|
| `wikey.schema.md` | 모든 LLM 공통 (마스터 스키마) |
| `CLAUDE.md` | Claude Code |
| `AGENTS.md` | Codex CLI |
| `local-llm/system-prompt.md` | 로컬 LLM (Gemma 등) |

마스터 스키마에 위키 구조·컨벤션·워크플로우를 정의하고, 각 프로바이더 설정에는 도구 사용법만 기술. 이를 통해 어떤 LLM이든 동일한 위키를 동일한 규칙으로 운영할 수 있다.

## [[andrej-karpathy|Karpathy]]의 정리

| 장점 | 설명 |
|------|------|
| 명시성(Explicit) | AI 지식이 위키로 가시화 |
| 데이터 소유권(Yours) | 로컬 저장, 업체 종속 없음 |
| 파일 우선(File over app) | 마크다운 범용 포맷 |
| **AI 선택 자유(BYOAI)** | 원하는 AI 자유 연결 |

## 실사례

- [[secall]]: Codex, Gemini 파서 내장
- [[llmbase]]: 모델 폴백 체인 (1차 타임아웃 시 2차 모델 이어받음)

## 관련 항목

- [[llm-wiki]] — 기반 패턴
- [[schema-layer]] — BYOAI를 가능하게 하는 설계
- [[three-layer-architecture]] — 전체 구조
