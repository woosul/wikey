---
title: llmbase
type: entity
created: 2026-04-10
updated: 2026-04-10
sources: [source-llm-wiki-community.md]
tags: [project, open-source, implementation]
---

# llmbase

[[llm-wiki]] 패턴의 오픈소스 구현. @Hosuke가 개발.

> GitHub: [github.com/Hosuke/llmbase](https://github.com/Hosuke/llmbase)

## 특징

- [[obsidian]] 대신 **React 웹 UI**를 탑재하여 단일 명령으로 배포 가능
- **모델 폴백 체인**: 1차 LLM 타임아웃 시 2차 모델이 이어받아 위키가 수동 개입 없이 성장
- 자율 워커를 통한 지속적 인제스트 지원

## 핵심 인사이트

개발자가 가장 강력하다고 평가한 원칙: **"[[knowledge-compounding|탐색의 축적]]"** — Q&A 답변이 위키에 저장되고, 린트가 새 연결을 제안하는 선순환.

## 검색 방식

LLM이 컴팩트한 index.json(제목+요약)을 읽고 **직접 상위 10개 문서를 선택**. DB 없음. LLM 자체가 검색 엔진 역할.

## 관련 항목

- [[secall]] — 한국어 지원 구현체
- [[llm-wiki]] — 기반 패턴
- [[source-llm-wiki-community]] — 출처
