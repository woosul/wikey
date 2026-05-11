---
phase: 5
section: 5.20
title: Knowledge Gap management — query log analysis + auto-report (Spec)
status: draft
created: 2026-05-11
updated: 2026-05-11
version: v0.1
---

# Phase 5 §5.20 Knowledge Gap management (Spec, WHAT)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.20`](./phase-5-todo.md) · [`plan/phase-5/phase-5-todox-5.20-knowledge-gap-management.md`](./phase-5-todox-5.20-knowledge-gap-management.md)
>
> **이력**: 본 §5.20 = 사용자 테스트 2-2 (2026-05-11). Phase 6 (웹 환경) 후보였으나 사용자 결정으로 Phase 5 잔여로 편입.

## 0. Context

**도출 source**: 사용자 본체 완성 시점 테스트 (2026-05-11) 2-2 보고.

- 요청: 자주 질의되지만 wiki 정보가 부족한 주제를 분석 → 자동 리포트 생성 (knowledge gap detect).
- schema §"검색/인덱스 확장 전략" + Karpathy llm-wiki "AI 의 지식이 위키로 가시화됨 (Explicit)" 원칙 강화.

**이득**:
- 정성 — 사용자가 "다음에 어떤 source 를 추가해야 하는가" 결정에 데이터 기반 도움.
- 정성 — wiki 의 *gap 인식* 자체가 wiki 의 일부가 됨 (analyses/knowledge-gap-*.md).
- 정량 — 월 1회 자동 리포트 시 사용자 ingest 우선순위 결정 시간 단축.

**Trade-off**:
- query log 저장 = 사용자 query history privacy 영향. local-only 저장 보장 + 사용자 opt-out toggle.
- score formula heuristic — Step A 에서 calibration.

## 1. Specs

### Spec 1: query log capture + privacy

- **Goal**: sidebar-chat 의 query 결과를 local log (`.obsidian/plugins/wikey/data.json` 또는 별도 `.wikey/query-log.jsonl`) 에 저장.
- **Invariants**:
  - I1: log 저장 = local only. 외부 전송 0. credentials.json 같은 sensitive 영역 grep 0.
  - I2: 사용자 opt-out toggle (settings — default ON, vault-level config).
  - I3: log entry = `{ ts, query, answerLen, citationCount, resolveFailed }` — answer body / wiki page path X (privacy minimize).
- **Acceptance**:
  - 사용자 query 1회 → log entry 1줄 추가.
  - settings opt-out → 추가 중지.
  - log 파일 disk 위치 = vault 안 (PII 회피).

### Spec 2: gap score formula

- **Goal**: query log 분석으로 gap score 계산.
- **Inputs**: query log entries.
- **Outputs**: `KnowledgeGap[]` — `{ topic, frequency, avgAnswerLen, avgCitationCount, gapScore }`.
- **Invariants**:
  - I4: gapScore = `frequency × log(1 + 1/avgAnswerLen) × log(1 + 1/avgCitationCount)` (heuristic, Step A LOCK).
  - I5: topic 추출 = LLM clustering (similar query 묶음) — hardcoded keyword 0건 (§5.10.4 D-wide 정합).
  - I6: 출력 = 상위 N (default 10) gap topic.
- **Acceptance**:
  - 10 query log entry → LLM 이 topic cluster 3~5개 → gap score 정렬.

### Spec 3: 자동 리포트 생성

- **Goal**: gap analysis 결과를 wiki/analyses/knowledge-gaps-YYYY-MM.md 로 자동 생성 (사용자 명시 실행 또는 월 1회 schedule).
- **Invariants**:
  - I7: 리포트 페이지 = `analyses/` 카테고리 (schema §"4 카테고리" 정합).
  - I8: index.md / log.md 갱신 (ingest 동급).
  - I9: 페이지 내용 = LLM 이 gap topic 별 "추가 인입 추천 raw source" 제안 (질문 형식 — 사용자가 답할 source 를 명시 추천).
- **Acceptance**:
  - command `Wikey: Generate knowledge gap report` → analyses 페이지 생성.
  - 결과 페이지 = wikilink 정합, validate-wiki PASS.

## 2. Out of Scope

- 자동 cron / scheduler (수동 command 만, §5.19 의 maintenance 와 통합 후보).
- 외부 source 자동 fetch (사용자 결정 영역).
- 다국어 query clustering (한국어 / 영문 mix 만, §5.7.9 candidate #3 별 cycle).

## 3. Dependencies

- `wikey-obsidian/src/sidebar-chat.ts` — query 종료 시 log entry 추가.
- `wikey-core/src/query-pipeline.ts` — log payload 생성.
- 신규 `wikey-core/src/knowledge-gap.ts` — score formula + topic clustering.
- `wikey-obsidian/src/commands.ts` — report 생성 command.
- `wikey-obsidian/src/settings-tab.ts` — opt-out toggle.

## 4. 진행 순서 (SDD+TDD)

- **Step A (analyst v0.2)**: Step "1" 의 실 query log 샘플로 score formula calibration.
- **Step B (tester RED)**: knowledge-gap.test.ts + query log capture test.
- **Step C (developer GREEN)**: log capture + score + report 생성.
- **Step D~F**: 회귀 / BLUE / codex review.
- **Step G (master 라이브 smoke)**: 실 vault 에서 10 query 실행 후 report 생성 검증.

## 5. 변경 이력

- v0.1 (2026-05-11): draft 신규. Phase 6 candidate → Phase 5 편입 (사용자 결정).
