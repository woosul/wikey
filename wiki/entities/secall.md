---
title: seCall
type: entity
created: 2026-04-10
updated: 2026-04-10
sources: [source-llm-wiki-community.md]
tags: [project, open-source, korean]
---

# seCall

[[llm-wiki]] 패턴의 한국어 지원 구현체. @kurthong이 개발.

> GitHub: [github.com/hang-in/seCall](https://github.com/hang-in/seCall)

## 특징

- **GitHub 백업 연동**: 여러 하드웨어에서 Obsidian 볼트 동기화
- **Codex, Gemini 파서 내장**: [[byoai]] 원칙 실현
- **한국어 검색 가드레일**: BM25가 한글에 약한 문제를 해결하기 위한 한국어 형태소 분석 기반 보완

## 한국어 검색 문제

BM25는 영어 토크나이저 기반이라 한국어 조사·어미 변형에 취약. seCall은 형태소 분석을 BM25 앞단에 배치하여 검색 정확도를 높임. 이는 위키 규모가 커질수록 중요해지는 문제.

## 검색 파이프라인

BM25(한국어 형태소 분석) + 벡터 검색 → RRF 융합 + 세션 다양성 필터.

## 관련 항목

- [[llmbase]] — React UI 기반 구현체
- [[qmd]] — 마크다운 검색 엔진
- [[llm-wiki]] — 기반 패턴
- [[source-llm-wiki-community]] — 출처
