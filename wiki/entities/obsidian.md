---
title: Obsidian
type: entity
created: 2026-04-10
updated: 2026-04-10
sources: [source-llm-wiki-gist.md]
tags: [tool, editor, wiki-browser]
---

# Obsidian

마크다운 기반 지식 관리 도구. [[llm-wiki]] 시스템에서 **위키 브라우저** 역할을 담당한다.

## LLM Wiki에서의 역할

> "Obsidian이 IDE, LLM이 프로그래머, 위키가 코드베이스" — [[andrej-karpathy]]

Obsidian은 위키를 **직접 편집하지 않는다.** 위키 페이지의 생성·수정은 LLM 에이전트가 담당. Obsidian은 결과를 실시간으로 보여주는 뷰어이자, LLM이 제공하지 못하는 시각적 탐색 기능을 제공한다.

## 핵심 기능

| 기능 | 용도 |
|------|------|
| **그래프 뷰** | 위키 전체 연결 구조 시각화 — 허브, 고아, 클러스터 파악 |
| **백링크 패널** | 특정 페이지를 참조하는 모든 페이지 확인 |
| **검색** | 전체 텍스트 검색 (GUI + CLI) |
| **Web Clipper** | 웹 기사 → 마크다운 변환 → `raw/articles/`에 저장 |
| **Bases** | 프론트매터 기반 메타데이터 대시보드 |
| **CLI** | 터미널에서 볼트 조작 — LLM이 프로그래매틱하게 검색·읽기·속성 관리 |

## 관련 플러그인

- **Marp**: 마크다운 → 슬라이드 덱
- **Bases** (구 Dataview): 프론트매터 쿼리 → 동적 테이블

## 관련 항목

- [[llm-wiki]] — Obsidian이 브라우저 역할을 하는 패턴
- [[qmd]] — 규모 확대 시 검색 보조
- [[source-llm-wiki-gist]] — 원문에서 권장
