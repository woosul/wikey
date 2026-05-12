---
phase: 5
section: 5.21
title: Ingest pipeline mention guard — broken wikilink 근본 원인 1+3 fix (Spec)
status: draft
created: 2026-05-12
updated: 2026-05-12
version: v0.1
---

# Phase 5 §5.21 Ingest pipeline mention guard (Spec, WHAT)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.21`](./phase-5-todo.md) · [`plan/phase-5/phase-5-todox-5.21-ingest-mention-guard.md`](./phase-5-todox-5.21-ingest-mention-guard.md)

## 0. Context

**도출 source**: §5.19 v0.4 세션 마지막 broken wikilink 585건 (de-duped) 철저 분석 — 3 근본 원인 (Session 38, 2026-05-12).

**근본 원인 분포**:

| Category | Count | % | 근본 원인 |
|----------|-------|---|----------|
| normal ASCII slug | 390 | **67%** | mention only, entity page 생성 누락 (promotion threshold 미통과) — 근본 원인 2 |
| 파일 확장자 포함 (`.md`/`.pdf`) | 195 | **33%** | raw source filename 그대로 wikilink — 근본 원인 1 |
| 대문자 차이 | 116 | **20%** | case-insensitive inconsistency — 근본 원인 3 |

### §5.21 cover scope

- **근본 원인 1 (33%)**: ingest pipeline mention stage 에서 raw filename → wiki slug 변환 강제 + file extension 포함 wikilink reject
- **근본 원인 3 (20%)**: LLM ingest 출력 의 wikilink 본문 canonicalizer 호출 강제 (case-insensitive normalize)

### Out of Scope (§5.21)

- **근본 원인 2 (67%)**: mention only + promotion 미통과 entity = §5.20 Knowledge Gap 와 연계 (별 cycle, broken wikilink → knowledge gap 후보 surface)
- §5.19 wiki-check 의 cleanup detect (이미 종결 — 본 §5.21 은 *예방* 측면)

## 1. Specs

### Spec 1: Raw filename → slug 변환 (근본 원인 1)

- **Goal**: ingest pipeline 의 LLM mention stage 출력 중 wikilink target 이 raw filename (`.md`/`.pdf`/`.hwp`/공백 포함) 형식이면 자동 reject 또는 slug-ify.
- **Invariants**:
  - I1 (reject): file extension (`.md`/`.pdf`/`.hwp`/`.docx`/`.pptx`/`.txt`) 포함 wikilink target → 인제스트 결과 page 본문에서 제거 또는 plain text 변환.
  - I2 (slug-ify): 공백 + 한글 + 특수문자 포함 raw filename 형태 wikilink → canonicalizer slug 변환 후 page 존재 확인 + 미존재 시 reject.
- **Acceptance**:
  - **AC-S1-1**: §5.19 broken category "파일 확장자 포함" 195건 → 0 (인제스트 직후 자동 reject).
  - **AC-S1-2**: 신규 ingest test fixture (raw filename mention) → 결과 wiki page 본문에 해당 wikilink 0건.

### Spec 2: Canonicalizer wikilink normalize (근본 원인 3)

- **Goal**: LLM ingest 출력 의 wikilink 본문 target (`[[X]]` 의 X) 을 canonicalizer `canonicalizeSlug` 호출하여 case-insensitive normalize 강제.
- **Invariants**:
  - I3 (normalize): `[[GPT-4o]]` → `[[gpt-4o]]` (canonical slug). SLUG_ALIASES + `.wikey/schema.yaml` aliases merge 적용.
  - I4 (idempotent): 같은 source 재 ingest 시 wikilink 동일 결과.
- **Acceptance**:
  - **AC-S2-1**: §5.19 broken category "대문자 차이" 116건 → 0 (canonicalize 후 자체 페이지 매치).
  - **AC-S2-2**: ingest test fixture (mixed case mention) → 결과 wikilink 모두 lowercase canonical.

## 2. Out of Scope

- 근본 원인 2 (mention only entity, 67%) — §5.20 Knowledge Gap 별 cycle.
- Stub page 자동 생성 (promotion 미통과 entity 의 plain text 변환만, page 생성 X) — §5.20 candidate.
- 기존 wiki/ 의 broken wikilink retroactive cleanup — §5.19 wiki-recovery Fix link 가 cover.

## 3. Dependencies

- `wikey-core/src/ingest-pipeline.ts` — Stage 2 mention 출력 검사
- `wikey-core/src/canonicalizer.ts` — `canonicalizeSlug` 재사용
- `wikey-core/src/wiki-ops.ts` — `extractWikilinks` 또는 신규 mention guard helper
- 신규 `wikey-core/src/wiki/mention-guard.ts` (≤ 200 LOC)
- 신규 test fixture: ingest raw filename + mixed case mention

## 4. 진행 순서 (SDD+TDD)

- **Step A (analyst v0.2)**: §5.19 분석 결과 cross-check + LLM prompt level vs post-process level 결정 (Q1) + reject vs silent skip 결정 (Q2)
- **Step B (tester RED)**: ingest fixture 2 case (raw filename / mixed case) + AC-S1-1/S1-2/S2-1/S2-2 test
- **Step C (developer GREEN)**: mention-guard.ts 신규 + ingest-pipeline.ts Stage 2 hook
- **Step D~F (회귀 + BLUE + codex)**
- **Step G (master 라이브 smoke)**: 실 source 재 ingest → broken wikilink 결과 측정 (§5.19 측정 595 → 예상 200~300, 근본 원인 1+3 합 49% 감소)

## 5. 변경 이력

- v0.1 (2026-05-12): draft 신규. §5.19 분석 결과 (3 근본 원인) cross-link. §5.20 와 책임 분리 (mention only entity = §5.20).
