# Phase 5 §5.22 시스템 UI 영문화 sweep — Todo (HOW)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.22`](./phase-5-todo.md) · [`plan/phase-5/phase-5-spec-5.22-ui-english-sweep.md`](./phase-5-spec-5.22-ui-english-sweep.md)
>
> **버전**: v0.1 (2026-05-12) — draft 신규.

## 진행 매트릭스 (Step A~G)

- [ ] **Step A — 사용자 라벨 결정 LOCK**: 영문 매핑 사용자 1차 review 필수
- [ ] **Step B — tester**: 각 panel 영문 expected fixture 갱신
- [ ] **Step C — developer**: sed sweep + 영문 라벨 적용 (i18n 인프라 신규 안 함)
- [ ] **Step D — Phase 3a 회귀**
- [ ] **Step E — Phase 3b BLUE**
- [ ] **Step F — codex post-impl review**
- [ ] **Step G — master 라이브 cdp**: 각 panel grep `[가-힣]` = 0 확증

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
