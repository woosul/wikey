# Phase 5 §5.19 v0.5 — 사용자 raise R1~R7 처리 (Activity)

> **상위 문서**: [`docs/sessions/phase-5/phase-5-result.md §5.19`](./phase-5-result.md) · [`docs/planning/phase-5/phase-5-todox-5.19-wiki-maintenance-suite.md`](../../planning/phase-5/phase-5-todox-5.19-wiki-maintenance-suite.md)
>
> **날짜**: 2026-05-13 session 39 (계속)

## 종합

§5.19 v0.4 종결 (session 38) 후 사용자 직접 obsidian-cdp 시험 → 7 raise (R1~R7). 사용자 명시 "계획 필요 없음" → SDD+TDD analyst LOCK 스킵 + 직접 sweep. R7 (margin) master 직접 + R1~R6 developer agent 위임 + master 1차 검증 + master obsidian-cdp 라이브 smoke.

## 사용자 raise → 처리 매핑

| # | Raise | 처리 | Live evidence |
|---|-------|------|---------------|
| R1 | "어떻게 fix하라는 건지" — step 1 안내 부족 | step 1 guidance text "Review findings below, then click 'Apply fix' to select items and execute." | cdp text 확증 ✅ |
| R2 | "이전에 자동/수동 checkbox 있었는데 없어짐" | step 1 + Apply fix → step 2 (Auto-fix / Manual review fuzzy / Manual review no-match 3 sub-section) 흐름 명확화 | 594 checkbox + 3 section title ✅ |
| R3 | "checkbox check > Apply Fix하면 링크오류 수정" | Apply fix button + step 2 confirm → Execute (기존 동작 보존 + entry text 명확) | Execute button 존재 + flow 동작 ✅ |
| R4 | "에러가 link 에러만 아니다 — tombstone 등" | stale-tombstone Step 2 section + apply (`applyStaleTombstoneCleanup` 신규). paired-sidecar / validate-wiki-other = manual review (production 환경 finding 0) | stale-tombstone section render code path ✅ (현재 vault finding 0 → 미가시, 정상) |
| R5 | Check vs Refactoring 정의 명시 | Help guide `Maintenance Modes` section 신규 — Status (Read-only health) / Check (Repair errors) / Refactoring (Structural cleanup) | Help panel `hasMaintenance:true / Status/Check/Refactoring all present` ✅ |
| R6 | Refactoring next step 부재 | Execute button 추가 + Step 2 (Duplicate pages + Low-utility pages checkbox) + `applyRefactoringArchive` 신규 (wiki/archive/ 이동) | Execute click → "Duplicate pages (2)" + "Low-utility pages (1)" + 3 checkbox + Execute/Cancel ✅ |
| R7 | margin 너무 좁음 (16px+ 요청) | `.wikey-maintenance-modal-unhealthy { margin-bottom: 16px }` + `.wikey-maintenance-modal-unhealthy-actions { gap:8px; margin-top:16px }` | computed `marginBottom: "16px"` ✅ |

## 변경 file

**wikey-core (신규 2 file + 2 wiring)**:
- `wikey-core/src/wiki/maintenance/tombstone-cleanup.ts` (신규 101 LOC) — `applyStaleTombstoneCleanup` + invariants I-PURGE-1~4 (confirm / dry-run / protect active / idempotent / log entry)
- `wikey-core/src/wiki/maintenance/refactoring-archive.ts` (신규 137 LOC) — `applyRefactoringArchive` + invariants I-ARCH-1~5 (confirm / dry-run / path mirror / archive copy / log entry)
- `wikey-core/src/wiki/maintenance.ts` — barrel exports
- `wikey-core/src/index.ts` — public surface

**wikey-obsidian (5 file)**:
- `wikey-obsidian/src/maintenance-modal-views.ts` — R1+R2+R3 step1 guidance + R4 stale-tombstone Step 2 section + R6 Refactoring Step 2 (3 sub-renderer 분해) + `UnhealthySummaryHooks` interface
- `wikey-obsidian/src/maintenance-modal.ts` — `runStaleTombstoneFix` / `runRefactoringApply` / `listWikiPages` runner fields + Refactoring `onExecute` orchestration
- `wikey-obsidian/src/maintenance-runner.ts` — wire `applyStaleTombstoneCleanup` / `applyRefactoringArchive` + `listWikiPages`
- `wikey-obsidian/src/sidebar-chat.ts` — R5 Help guide `Maintenance Modes` section
- `wikey-obsidian/styles.css` — R7 unhealthy 16px margin + Refactoring action bar gap

**Test 신규 (3 file, 23 case)**:
- `wikey-core/src/__tests__/wiki-maintenance-stale-tombstone-cleanup.test.ts` (7 case)
- `wikey-core/src/__tests__/wiki-maintenance-refactoring-archive.test.ts` (8 case)
- `wikey-obsidian/src/__tests__/maintenance-modal-v0_5.test.ts` (8 case)

## 검증

| Step | 결과 |
|------|------|
| wikey-core test | **900 PASS** / 3 skipped (이전 885 → 신규 +15) |
| wikey-obsidian test | **188 PASS** (이전 180 → 신규 +8) |
| build (wikey-obsidian) | 0 errors (5 pre-existing kiwi-wasm warnings unchanged) |
| validate-wiki | 458 errors (§5.21 대상 baseline, 본 cycle 변경 무관) |
| obsidian-cdp 라이브 smoke (master 직접) | R1+R2+R3 + R4 + R5 + R6 + R7 모두 PASS |

### Live evidence (obsidian-cdp Runtime.evaluate)

```
Help panel:    hasMaintenance:true / Status:true / Check:true / Refactoring:true
Check step 1:  "Wiki check\nReview findings below, then click \"Apply fix\"..."
               Broken Wikilink (1324) + Validate-wiki Other (2) + Apply fix + Cancel
Check step 2:  3 sections: Auto-fix broken wikilinks (29) / Manual review — fuzzy match (116) /
               Manual review — no match (449), 594 checkboxes + Execute + Cancel
Refactoring:   "Issues found: 2 duplicates, 1 lowUtility" + marginBottom:"16px" + Execute + Close
Refactoring step 2: Duplicate pages (2) [Keep [[a]], archive [[b]] (similarity 0.86)] +
                   Low-utility pages (1) + 3 checkboxes + Execute + Cancel
```

## Karpathy 4원칙 cross-check

- **Think Before Coding**: R5 정의 명시 (Status/Check/Refactoring 분리) — 사용자 mental model 정합
- **Simplicity First**: R6 archive 만 본 cycle, duplicates 본문 merge 별 cycle scope (사용자 winner 선택 UI 신규 안 함)
- **Surgical Changes**: 기존 broken-wikilink + dangling fix 동작 변경 0 (43 maintenance-modal.test PASS 유지). `renderUnhealthySummary` backward compat (typeof callback 체크)
- **Goal-Driven Execution**: 각 R 의 acceptance live cdp evidence 명시

## scope 한계 (out-of-scope, 별 cycle)

- paired-sidecar fix path: producer (`check.ts`) 가 현재 finding emit 0 — 본 cycle 미구현
- validate-wiki-other 자동 fix: manual review 만 (사용자 prompt 명시)
- duplicates 본문 merge: 본 cycle archive 만, merge 별 cycle
- 사용자 winner 선택 UI: 별 cycle (현재 lexicographic 결정)
- batch undo / history: 별 cycle

## 자율 결정 (사용자 명시 허용 범위)

1. step 1 row selection checkbox vs 안내 텍스트 — 안내 텍스트 채택 (step 2 와 중복 회피 + accordion expand/collapse UX 충돌 회피)
2. stale-tombstone default checked (sha-grouped dangling 와 동일 정책)
3. R4 paired-sidecar / validate-wiki-other = out-of-scope (사용자 prompt 명시)
4. R6 duplicates winner = lexicographic `a` keep / `b` archive (단순화)
5. WikiFS.delete optional fallback (production Obsidian 지원, test mock 도 지원)
6. `renderUnhealthySummary` backward compat (`hooksOrClose` union)

## SDD+TDD 단계

- [-] Step A — analyst Spec LOCK (사용자 "계획 필요 없음" 스킵, in-task spec invariants 사용)
- [x] Step B — tester RED (23 신규 test, GREEN 전 RED 확증)
- [x] Step C — developer GREEN (위 변경 file)
- [x] Step D — Phase 3a 회귀 (1088 PASS / build 0 / validate-wiki baseline)
- [x] Step E — Phase 3b BLUE (6 활동 명시 — 함수 분해 / Naming / DRY / 주석 / 가독성 / 회귀 재검증)
- [-] Step F — codex post-impl review (사용자 "계획 필요 없음" → master 1차 검증으로 종결)
- [x] Step G — master 직접 obsidian-cdp 라이브 smoke (R1~R7 모두 PASS)

→ **§5.19 v0.5 종결**. 다음 = §5.21 SDD+TDD 진입 (Ingest mention guard).
