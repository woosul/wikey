# Phase 5 §5.22 시스템 UI 영문화 sweep — Todo (HOW)

> **상위 문서**: [`docs/planning/phase-5/phase-5-todo.md §5.22`](./phase-5-todo.md) · [`docs/planning/phase-5/phase-5-spec-5.22-ui-english-sweep.md`](./phase-5-spec-5.22-ui-english-sweep.md)
>
> **버전**: v0.1 (2026-05-12) — draft 신규.

## 진행 매트릭스 (Step A~G)

- [-] **Step A — 사용자 라벨 결정 LOCK**: 사용자 "계획 필요 없음" 명시 → 스킵 (직접 sweep 진행)
- [x] **Step B — tester fixture sweep**: sidebar-chat-helpers + sidebar-chat-backlink 7 expected 갱신
- [x] **Step C — developer sweep**: 8 file Edit (sidebar-chat / commands / main / ingest-modals / settings-tab / status-bar / reset-modals / env-detect)
- [x] **Step D — Phase 3a 회귀**: npm test 1065 PASS / npm run build 0 errors
- [-] **Step E — Phase 3b BLUE**: 단순 string 변경 → BLUE 6 활동 무관 (의도적 생략)
- [-] **Step F — codex post-impl review**: 사용자 "계획 필요 없음" → master 1차 검증으로 종결
- [x] **Step G — master grep 확증**: UI string `[가-힣]` 0 (comment / regex / test description 제외)

진행 완료 (v0.2). 결과: [`docs/sessions/phase-5/phase-5-resultx-5.22-ui-english-sweep-2026-05-12.md`](../../docs/sessions/phase-5/phase-5-resultx-5.22-ui-english-sweep-2026-05-12.md)

## 의문점 (Step A LOCK 대상)

- **Q1 (i18n 인프라)**: 영문 string 만 변경 vs i18n framework 도입 — 권장: **string 만** (단순 sweep, 향후 다국어 요구 시 별 cycle).
- **Q2 (영문 라벨 자연어)**: 영문 표현 톤 (formal vs casual) — 권장: 짧고 명료 (Apply / Cancel / Execute).
- **Q3 (애매한 한글)**: `'취소됨'` 같은 상태 표시 → `Cancelled` 단순 변환 vs `'Cancelled'` + tooltip — 권장: 단순.

## 변경 면 추정

- `wikey-obsidian/src/sidebar-chat.ts` — Audit / Ingest / Help / Backlink layer label (~50 line)
- `wikey-obsidian/src/commands.ts` — Citation Modal + 기타 (~30 line)
- `wikey-obsidian/src/main.ts` — Notice / status (~10 line)
- `wikey-obsidian/src/settings-tab.ts` — settings (~50 line, scope)
- test fixture sed sweep (~20 file)

## 변경 이력

- v0.1 (2026-05-12): draft 신규.
- v0.2 (2026-05-12 session 39): Step B/C/D/G 종결. Step A/E/F 의도적 스킵 (사용자 "계획 필요 없음"). 8 file UI string sweep + 2 test fixture sweep + wikey.schema.md §핵심 원칙 #6 + CLAUDE.md §시스템 언어 = 영문 LOCK 신규.
