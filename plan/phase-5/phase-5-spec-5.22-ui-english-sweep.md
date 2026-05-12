---
phase: 5
section: 5.22
title: 시스템 UI 영문화 sweep — 모든 사용자 인터페이스 텍스트 한글 → 영문 (Spec)
status: draft
created: 2026-05-12
updated: 2026-05-12
version: v0.1
---

# Phase 5 §5.22 시스템 UI 영문화 sweep (Spec, WHAT)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.22`](./phase-5-todo.md) · [`plan/phase-5/phase-5-todox-5.22-ui-english-sweep.md`](./phase-5-todox-5.22-ui-english-sweep.md)

## 0. Context

**도출 source**: 사용자 명시 정책 (Session 38, 2026-05-12) — "시스템 인터페이스의 모든 문자는 영문임. 한글 > 영문".

§5.19 v0.4 cycle 안 maintenance modal + Help 패널 maintenance section 영문화 완료. **잔여 한글 사용자 UI**:

- `wikey-obsidian/src/sidebar-chat.ts` — Audit row (`'취소됨'`), warning banner (`⚠ 일부 포맷 변환기가 설치되지 않았습니다...`), §5.18 backlink layer label (`참고` / `확장`), Help guide markdown content
- `wikey-obsidian/src/commands.ts` — Citation Mismatch Diagnostic Modal (`'모든 sourceId 가 registry 에 등록되어 있습니다.'`, `... (총 ${entry.pages.length} 개, 모두 보려면 Console 참조)`)
- `wikey-obsidian/src/main.ts` — Notice / toast / status messages
- `wikey-obsidian/src/settings-tab.ts` — settings UI labels
- 기타 panel render 함수 (Ingest / Audit / Dashboard / Chat input placeholder 등)

## 1. Specs

### Spec 1: 한글 UI 텍스트 모두 영문화

- **Goal**: 모든 사용자가 보는 UI 텍스트 (button label / title / message / placeholder / tooltip) 영문 표기.
- **Invariants**:
  - I1 (scope): 사용자 인터페이스 만. 내부 코드 주석 / JSDoc / commit message / docs (plan/activity/wiki/log) 영향 0.
  - I2 (parse regex 예외): validate-wiki.sh output 안 한글 메시지 (`깨진 위키링크`) 는 production output format → regex 그대로 유지 (parse 용, UI 아님).
  - I3 (한글 출처 명시 예외): wiki page 본문 의 한글 (사용자 콘텐츠) 영향 0.
- **Acceptance**:
  - **AC-S1-1**: `grep -E "createDiv\|setText\|text:" wikey-obsidian/src/**.ts | grep [가-힣]` 결과 0 (validate-wiki regex 제외).
  - **AC-S1-2**: settings / Help panel / Audit / Ingest / Dashboard / Chat 모든 panel master cdp 직접 확인 — 한글 0.

### Spec 2: 핵심 UI 영문 라벨 결정

- **Backlink layer label** (§5.18 footer):
  - `원본:` → `Sources:`
  - `참고 (N)` → `Referenced (N)`
  - `확장 (M)` → `Extended (M)`
- **Audit row**:
  - `'취소됨'` → `'Cancelled'`
  - Warning banner format 영문
- **Citation Modal**:
  - `'모든 sourceId 가 registry 에 등록되어 있습니다.'` → `'All sourceIds are registered.'`
  - `... (총 ${N} 개, 모두 보려면 Console 참조)` → `... (${N} total, see Console for full list)`
- **공통 button label**: Apply fix / Cancel / Execute / Close (이미 영문)

## 2. Out of Scope

- Internal code comment / JSDoc / variable name — 한글 유지 OK
- Plan / activity / wiki / log docs — 한글 유지 (개발자/사용자 documentation)
- validate-wiki.sh output parse regex (한글 키워드) — production format
- Wiki content (사용자가 raw 에 추가한 한글 source, 한글 wiki page) — 영향 0

## 3. Dependencies

- `wikey-obsidian/src/sidebar-chat.ts`, `commands.ts`, `main.ts`, `settings-tab.ts` 외 panel 관련 file 전체
- 기존 test fixture 의 한글 expected string → 영문 변경 (sweep)

## 4. 진행 순서 (SDD+TDD)

- **Step A**: 사용자 라벨 결정 LOCK (Spec 2 의 모든 영문 매핑 확정 — 사용자 1차 review 필요)
- **Step B**: tester (각 panel 의 영문 expected fixture)
- **Step C**: developer (sed sweep + 영문 라벨 매핑 적용 + i18n 인프라 신규 안 함, 단순 string 변경)
- **Step D~F**: 회귀 + BLUE + codex
- **Step G**: master 라이브 cdp 직접 grep `[가-힣]` = 0 확증

## 5. 변경 이력

- v0.1 (2026-05-12): draft 신규.
