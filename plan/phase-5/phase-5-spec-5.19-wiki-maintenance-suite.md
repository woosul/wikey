---
phase: 5
section: 5.19
title: Wiki maintenance suite — wiki-status / wiki-check / wiki-recovery / wiki-refactoring (Spec)
status: draft
created: 2026-05-11
updated: 2026-05-11
version: v0.1
---

# Phase 5 §5.19 Wiki maintenance suite (Spec, WHAT)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.19`](./phase-5-todo.md) · [`plan/phase-5/phase-5-todox-5.19-wiki-maintenance-suite.md`](./phase-5-todox-5.19-wiki-maintenance-suite.md)

## 0. Context

**도출 source**: 사용자 본체 완성 시점 테스트 (2026-05-11) 2-1 보고.

- 현 상태: `scripts/validate-wiki.sh` 만 존재. lint 워크플로우는 schema §"워크플로우 3: 린트" 에 정의되어 있으나 사용자 명시 실행 의존, 자동 trigger 없음.
- 요청: 주기적 wiki 상태 점검 — wiki-status / wiki-check / wiki-recovery / wiki-refactoring.

**4 command 분해**:

1. **wiki-status**: 1-row health summary (pages count, orphan%, broken link%, last validate ts) — sidebar Dashboard 상단 health 행.
2. **wiki-check**: validate-wiki.sh + paired-sidecar audit + registry reconcile + stale tombstone detect (§5.16 Spec 3) 통합 1버튼.
3. **wiki-recovery**: stale tombstone 자동 복구 (§5.16 Spec 3 cleanup 의 자동 분기) + broken paired sidecar 재인덱스.
4. **wiki-refactoring**: schema-driven 정리 — duplicate entity merge candidate + low-utility analyses archive candidate (사용자 confirm 의존).

**이득**:
- 정성 — schema §"워크플로우 3: 린트" 가 1-click 실행. 자동 trigger (e.g. 매일 1회) 도 사용자 opt-in.
- 정량 — wiki 정합성 metric (orphan / broken link / stale tombstone) 정기 측정 → 회귀 detect 가능.

**Trade-off**:
- 자동 trigger 시 사용자 confirm 없는 destructive 변경 위험 — 본 cycle 은 **detect + report 만, 변경은 사용자 confirm 후 (Karpathy 의도)**.

## 1. Specs

### Spec 1: wiki-status — health summary

- **Goal**: 1-row summary 출력 + Dashboard 상단 health 행.
- **Outputs**: `{ pageCount, orphanCount, brokenLinkCount, staleTombstoneCount, lastValidateTs }`.
- **Invariants**:
  - I1: read-only — wiki/ 변경 0.
  - I2: 호출 latency ≤ 5s (cache 가능).
- **Acceptance**: Dashboard 상단에 1-row health pill (4 metric).

### Spec 2: wiki-check — 통합 verify

- **Goal**: validate-wiki.sh + paired-sidecar + registry reconcile + stale tombstone detect 1버튼.
- **Invariants**:
  - I3: read-only by default, fix 분기는 별도 Spec 3.
  - I4: 결과 report = wiki/analyses/wiki-check-<date>.md (자동 저장).
- **Acceptance**: command palette `Wikey: Check wiki health` → 결과 modal + analyses page 저장.

### Spec 3: wiki-recovery — confirm-gated fix

- **Goal**: Spec 2 의 detect 결과를 사용자 confirm 후 fix.
- **Invariants**:
  - I5: 모든 destructive 변경 (tombstone 복구 / wiki page block 제거 / paired sidecar reindex) 은 사용자 confirm 의무. silent X.
  - I6: fix log → wiki/log.md ingest 동급 entry (§5.11 v2 의미 재정의 호환).
- **Acceptance**: detect 결과 modal → 항목별 checkbox → Apply 버튼 → fix 적용 + log entry.

### Spec 4: wiki-refactoring — suggestion only

- **Goal**: schema-driven 정리 *suggestion* — duplicate entity 후보 + low-utility analyses 후보.
- **Invariants**:
  - I7: suggestion only, 자동 변경 0. 사용자 명시 액션 필요.
  - I8: suggestion 근거 (signal) 명시 — duplicate entity = canonical slug similarity ≥ 0.85 / low-utility = backlink 0 + 30일+ 미수정.
- **Acceptance**: command → suggestion list modal (clickable, wiki page navigation).

## 2. Out of Scope

- Knowledge Gap 자동 리포트 (§5.20 별 cycle).
- 자동 cron / scheduler — 본 cycle 은 manual command. 자동 scheduling 은 후속 candidate.
- wiki-recovery 의 fully-automated mode (Karpathy #3 Surgical Changes — 변경은 사용자 확정).

## 3. Dependencies

- `scripts/validate-wiki.sh` — Spec 2 통합 진입점.
- `scripts/audit-ingest.py` — paired-sidecar audit.
- `wikey-core/src/source-registry.ts` — reconcile.
- `wikey-obsidian/src/commands.ts` — 4 command 등록.
- `wikey-obsidian/src/sidebar-chat.ts` — Dashboard health 행.
- 신규 `scripts/wiki-check.sh` / `wiki-recovery.sh` / `wiki-refactoring.sh`.

## 4. 진행 순서 (SDD+TDD)

- **Step A (analyst v0.2)**: §5.16 Spec 3 (stale tombstone) 와의 통합 결정 — wiki-check 가 흡수.
- **Step B (tester RED)**: validate-wiki.test.sh + 신규 script test.
- **Step C (developer GREEN)**: 4 command + script + Dashboard health.
- **Step D~F**: 회귀 / BLUE / codex review.
- **Step G (master 라이브 smoke)**: 사용자 vault 에서 4 command 실행 → 결과 검증.

## 5. 변경 이력

- v0.1 (2026-05-11): draft 신규.
