# Phase 5 §5.18 Query citation UX — Todo (HOW)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.18`](./phase-5-todo.md) · [`plan/phase-5/phase-5-spec-5.18-query-citation-ux.md`](./phase-5-spec-5.18-query-citation-ux.md)

## 진행 매트릭스 (Step A~G)

- [ ] **Step A — analyst v0.2 보강**: Step "1" 결과로 mismatch 실측 비율 + sourceId 분포 측정 후 I7 log format 결정.
- [ ] **Step B — tester RED**: query-pipeline.test.ts (format) + sidebar-chat backlink test + diagnostic command test.
- [ ] **Step C — developer GREEN**:
  - `appendOriginalLinks` format `, ` → `\n- ` + extension badge.
  - sidebar-chat backlink section (MetadataCache.resolvedLinks 역방향).
  - WARN log + diagnostic command.
- [ ] **Step D — Phase 3a 회귀**.
- [ ] **Step E — Phase 3b BLUE**: backlink section helper extract.
- [ ] **Step F — codex post-impl review**.
- [ ] **Step G — master 라이브 cycle smoke**: PMS / multi-source / diagnostic command.

## 의문점 (Step A LOCK)

- **Q1**: Obsidian MetadataCache.resolvedLinks 가 plugin context 에서 안정 noticeable? — sidebar-chat 의 기존 사용처 확인.
- **Q2**: backlink section default collapse vs expand? UX preference — Phase 5 §5.18 sample 사용자 결정.
- **Q3**: diagnostic command 결과 출력 = Notice / modal / new page? — 별 modal 권장 (수 백 개 가능).
- **Q4**: WARN log 가 사용자 vault path 노출 가능성? — sourceId hash + wiki page path 만 (raw path X).

## 변경 면 추정

- `wikey-core/src/query-pipeline.ts` — appendOriginalLinks format (≤ 30 LOC).
- `wikey-obsidian/src/sidebar-chat.ts` — backlink section (≤ 80 LOC).
- `wikey-obsidian/src/commands.ts` — diagnostic command (≤ 50 LOC).
- 신규 test 3개.

## 변경 이력

- v0.1 (2026-05-11): draft 신규.
