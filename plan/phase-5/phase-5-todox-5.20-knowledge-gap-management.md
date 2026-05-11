# Phase 5 §5.20 Knowledge Gap management — Todo (HOW)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.20`](./phase-5-todo.md) · [`plan/phase-5/phase-5-spec-5.20-knowledge-gap-management.md`](./phase-5-spec-5.20-knowledge-gap-management.md)

## 진행 매트릭스 (Step A~G)

- [ ] **Step A — analyst v0.2**: score formula calibration + privacy 정책 LOCK.
- [ ] **Step B — tester RED**: knowledge-gap.test.ts + query log capture test.
- [ ] **Step C — developer GREEN**: log capture + score formula + report 생성 command + settings toggle.
- [ ] **Step D — Phase 3a 회귀**.
- [ ] **Step E — Phase 3b BLUE**.
- [ ] **Step F — codex post-impl review**.
- [ ] **Step G — master 라이브 smoke**: 10 query 후 report 생성.

## 의문점 (Step A LOCK)

- **Q1**: query log 저장 위치 = `data.json` 안 array vs 별도 `.wikey/query-log.jsonl` — 권장 후자 (append-only 효율).
- **Q2**: topic clustering LLM = 답변 LLM 동일 vs basic model? — basic model (latency / cost).
- **Q3**: 자동 schedule = 본 cycle out of scope, §5.19 maintenance 와 통합 후보.
- **Q4**: gap score formula `log(1 + 1/avgAnswerLen)` 의 단위 — char vs token? Step "1" 측정.

## 변경 면 추정

- 신규 `wikey-core/src/knowledge-gap.ts` (≤ 150 LOC).
- `wikey-obsidian/src/sidebar-chat.ts` — log entry (≤ 30 LOC).
- `wikey-obsidian/src/commands.ts` — report command (≤ 50 LOC).
- `wikey-obsidian/src/settings-tab.ts` — toggle (≤ 20 LOC).
- 신규 test 2개.

## 변경 이력

- v0.1 (2026-05-11): draft 신규.
