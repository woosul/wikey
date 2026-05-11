# Phase 5 §5.17 Ingest 분해 결과 밸런싱 calibration — Todo (HOW)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.17`](./phase-5-todo.md) · [`plan/phase-5/phase-5-spec-5.17-ingest-balance-calibration.md`](./phase-5-spec-5.17-ingest-balance-calibration.md)

## 진행 매트릭스 (Step A~G)

- [ ] **Step A — analyst v0.2 보강**: Step "1" 결과 반영 (case A 83 page + case B 0 page 의 실측 값으로 I1 비율 검증).
- [ ] **Step B — tester RED**: promotion-config + canonicalizer + ingest-pipeline write batch test.
- [ ] **Step C — developer GREEN**: ceiling/floor 분기 + WARN path + write batch (단 atomic).
- [ ] **Step D — Phase 3a 회귀**.
- [ ] **Step E — Phase 3b BLUE**: telemetry decision struct cleanup.
- [ ] **Step F — codex post-impl review**.
- [ ] **Step G — master 라이브 cycle smoke**: case A + case B 재 ingest + latency p95 측정.

## 의문점 (Step A LOCK)

- **Q1**: 1,500 char/page 비율은 109KB ÷ 75 ≈ 1,450 에서 derive — heuristic. 다른 corpus 도 동일 비율인가? Step "1" 에서 5 corpus sample 측정.
- **Q2**: HWP case B 가 변환 손실인가 promotion 보수인가? unhwp 변환 결과 markdown body length 직접 측정.
- **Q3**: write batching 시 single fsync vs N fsync — Obsidian Vault API 가 atomic write 보장하는지 확인.
- **Q4**: "index 갱신 지연 알람" 의 정확한 발화 시점 + 의미 — `incremental-reingest.ts` grep.

## 변경 면 추정

- `wikey-core/src/promotion-config.ts` — ceiling/floor 필드 (≤ 20 LOC).
- `wikey-core/src/canonicalizer.ts` — promotion 적용 시 cap (≤ 30 LOC).
- `wikey-core/src/ingest-pipeline.ts` — write batching (≤ 50 LOC).
- 신규 test 3개.

## 변경 이력

- v0.1 (2026-05-11): draft 신규.
