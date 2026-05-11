# Phase 5 §5.19 Wiki maintenance suite — Todo (HOW)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.19`](./phase-5-todo.md) · [`plan/phase-5/phase-5-spec-5.19-wiki-maintenance-suite.md`](./phase-5-spec-5.19-wiki-maintenance-suite.md)

## 진행 매트릭스 (Step A~G)

- [ ] **Step A — analyst v0.2**: §5.16 Spec 3 흡수 결정 + 4 command 의 정확한 분기 LOCK.
- [ ] **Step B — tester RED**: validate-wiki.test.sh + wiki-check/recovery/refactoring test.
- [ ] **Step C — developer GREEN**:
  - `scripts/wiki-check.sh` 신규 (validate-wiki + paired-sidecar + reconcile + tombstone detect).
  - `scripts/wiki-recovery.sh` 신규 (confirm-gated fix).
  - `scripts/wiki-refactoring.sh` 신규 (suggestion only).
  - 4 command 등록 + Dashboard health row.
- [ ] **Step D — Phase 3a 회귀**.
- [ ] **Step E — Phase 3b BLUE**.
- [ ] **Step F — codex post-impl review**.
- [ ] **Step G — master 라이브 smoke**: 사용자 vault 4 command 검증.

## 의문점 (Step A LOCK)

- **Q1**: wiki-check 가 §5.16 Spec 3 (stale tombstone detect) 흡수해야 하는가? — 권장: 흡수 (single maintenance entrypoint).
- **Q2**: wiki-status 가 매 panel render 마다 spawn 인가, cache 사용인가? — cache 5분 TTL 권장.
- **Q3**: Spec 4 의 duplicate entity similarity threshold 0.85 default 적정? — Step "1" 측정 후 결정.
- **Q4**: 자동 cron 옵션 (e.g. 매일 1회 wiki-status)? — 본 cycle out of scope, 후속 candidate.

## 변경 면 추정

- 신규 scripts 3개 (≤ 100 LOC 각).
- `wikey-obsidian/src/commands.ts` — 4 command 등록 (≤ 60 LOC).
- `wikey-obsidian/src/sidebar-chat.ts` — Dashboard health row (≤ 40 LOC).
- 신규 test 4개.

## 변경 이력

- v0.1 (2026-05-11): draft 신규.
