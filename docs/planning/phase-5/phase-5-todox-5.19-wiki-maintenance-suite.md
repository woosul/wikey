# Phase 5 §5.19 Wiki maintenance suite — Todo (HOW)

> **상위 문서**: [`docs/planning/phase-5/phase-5-todo.md §5.19`](./phase-5-todo.md) · [`docs/planning/phase-5/phase-5-spec-5.19-wiki-maintenance-suite.md`](./phase-5-spec-5.19-wiki-maintenance-suite.md)
>
> **버전**: v0.4 (2026-05-12) — 사용자 obsidian-cdp 7 raise (R1~R11) + 핵심 목적 4 (G1~G4) + **Recovery 폐기 (Check Fix link 흡수)** + Check finding accordion + Fix link multi-mode + Health rule + Help hr. 4 → **3 command**. AC 17 → **30**.

## 진행 매트릭스 (Step A~G)

- [x] **Step A — analyst v0.4** (2026-05-12): R1~R11 사용자 raise + G1~G4 핵심 목적 + Recovery 폐기 + Check Fix link multi-mode + Health rule + Help hr 반영.
- [x] **Step B — tester RED**: 4 신규 test file (wiki-status / wiki-check / wiki-refactoring / maintenance-modal). Recovery test 폐기 (Check Fix link mode b 로 흡수).
- [x] **Step C — developer GREEN**:
  - `scripts/wiki-check.sh` 신규 (validate-wiki + paired-sidecar + reconcile dry-run + dangling detect + **`--fix` 옵션 multi-mode**, ≤ 150 LOC).
  - ~~`scripts/wiki-recovery.sh`~~ — **v0.4 폐기** (Check `--fix` 흡수).
  - `scripts/wiki-refactoring.sh` 신규 (suggestion only).
  - `wikey-core/src/wiki/maintenance/status.ts` 신규 — `getWikiStatus()` + 5분 TTL cache + healthy rule (I-HEALTH-1).
  - `wikey-core/src/wiki/maintenance/check.ts` 신규 — finding 5 category 그룹화 + accordion 데이터 구조.
  - **`wikey-core/src/wiki/maintenance/fix-link.ts` 신규 (v0.4)** — mode a (fuzzy candidate) + mode b (dangling sha cleanup, 구 `applyWikiRecovery()` 흡수) + mode c (backlink update).
  - `wikey-core/src/wiki/maintenance/refactoring.ts` 신규 — suggestion + healthy rule.
  - `wikey-core/src/wiki/maintenance/fuzzy-slug.ts` 신규 (≤ 100 LOC) — fuzzy match similar slug (Levenshtein + substring).
  - `wikey-obsidian/src/maintenance-modal.ts` 신규 — 단일 컴포넌트, **mode prop ('status' | 'check' | 'refactoring')** 분기 (3 mode, Recovery 제거).
  - `wikey-obsidian/src/maintenance-modal-views.ts` 신규 — **accordion view (Check finding 5 category)** + Fix link step 2 (group 별 mode 선택 + confirm) + step 3 (execute + result).
  - `wikey-obsidian/src/maintenance-runner.ts` 신규 — Help 패널 + palette 3 command 공용 runner factory.
  - `wikey-obsidian/src/sidebar-chat.ts` — Help 패널 "Wiki Maintenance" 섹션 (**3 버튼**) + Dashboard health row (display only) + Help **hr divider** (R11).
  - `wikey-obsidian/src/commands.ts` — **3 부가 command** 등록 (palette legacy).
  - `wikey-obsidian/styles.css` — modal css patch (sticky header/footer + 중앙정렬 + accordion + Help hr + step 2 confirm view, ≤ 150 LOC v0.4).
- [x] **Step D — Phase 3a 회귀**: `npm test` + `npm run build` + `./scripts/validate-wiki.sh` 모두 PASS.
- [x] **Step E — Phase 3b BLUE** (의무, CLAUDE.md SDD+TDD §3a/3b): cache helper extract / modal mode 분기 가독성 / script common header / fuzzy-slug helper extract / accordion view 분리 / 회귀 PASS 반복.
- [x] **Step F — codex post-impl review** (cmux Mode D Panel). v0.4 30 AC 1:1 확증.
- [x] **Step G — master 라이브 smoke**: 사용자 vault 3 button (Status / Check / Refactoring) 실 실행. R1~R11 fix 확증 + G1~G4 매핑 확증 + §5.18 38-page dangling cleanup (Check Fix link mode b) 동일 use case 검증.

## 의문점 LOCK (Step A v0.4 완료)

- **Q1 (흡수 결정)** ✅ LOCK (v0.2): wiki-check 가 §5.16 Spec 2 (B2) `reconcileAfterIngest` helper 를 dry-run mode 로 재사용.
- **Q2 (wiki-status cache)** ✅ LOCK (v0.2): 5분 TTL in-memory cache.
- **Q3 (duplicate threshold)** ✅ LOCK (v0.2): similarity 0.85 default + `.wikey/refactoring.yaml` override.
- **Q4 (자동 cron)** ✅ LOCK (v0.2): out of scope, manual command 만.
- **Q5 (Recovery 폐기) v0.4 신규** ✅ LOCK (2026-05-12, 사용자 R9 명시): 4 → 3 command. Check Fix link multi-mode 가 dangling sha cleanup + tombstone restore + log entry 흡수. `applyWikiRecovery()` API 는 `fix-link.ts` 의 mode b 로 흡수.

## 사용자 raise R1~R11 LOCK (v0.4 신규)

obsidian-cdp 직접 시험 7 raise (실측 evidence 포함):

| Raise | 범위 | 내용 | Spec 매핑 |
|-------|------|------|----------|
| **R1** | 모든 modal | sticky header (title accent + close x icon) | AC-UI-7 |
| **R2** | 모든 modal | sticky footer (button series) | AC-UI-8 |
| **R3** | 모든 modal | scrollable middle | AC-UI-9 |
| **R4** | 모든 modal | footer Close 버튼 BUG (현재 X icon 만 작동) | AC-UI-10 |
| **R5** | 모든 modal | footer button horizontal 중앙정렬 | AC-UI-11 |
| **R6** | Status | brokenLinkCount=6,936 인데 "All healthy" 모순 | AC-S1-3 + I-HEALTH-1 |
| **R7** | Check | finding 7,439 flat list → 5 category accordion 필요 | AC-CHECK-1~3 + AC-UI-12 |
| **R8** | Check | Fix link 0 pages updated — broken wikilink fix 누락 (conceptual gap) | AC-FIX-1 (G1) |
| **R9** | Recovery | Check 와 동일 화면 → **Recovery 폐기** | Spec 3 폐기 / Check Fix link 흡수 |
| **R10** | Refactoring | "All healthy" 모순 | AC-R4-4 + I-HEALTH-1 |
| **R11** | Help | 섹션 사이 hr divider 필요 | AC-UI-13 |

## 핵심 목적 G1~G4 LOCK (v0.4 신규, 사용자 명시)

| Goal | 의미 | Spec 매핑 |
|------|------|----------|
| **G1** | 자체 페이지 없는 링크 찾기 (broken wikilink + fix candidate) | AC-FIX-1 / AC-GOAL-1 |
| **G2** | 잘못 지시하는 백링크 업데이트 (inline / 참조 / 원본 / 확장 4 layer) | AC-FIX-3 / AC-GOAL-2 |
| **G3** | 데이터 갭 페이지 보강 (knowledge gap detect, §5.20 연계 — link only) | §2 Out of Scope / AC-GOAL-3 (refactoring low-utility 부분 cover) |
| **G4** | 건강한 wiki + 링크 유지 (periodic manual) | AC-S1-3 / AC-R4-4 / AC-GOAL-4 |

## 신규 사용자 UI LOCK (v0.4 갱신)

- 각 maintenance script 의 진입점 = **Help 패널 안 "Wiki Maintenance" 섹션 버튼 3개** (Status / Check / Refactoring — v0.4 Recovery 제거).
- 버튼 클릭 시 **`MaintenanceModal` open** + 진행 상황 live tail (stdout/stderr stream).
- Check finding 발견 시 **accordion 5 category** (R7) + **"Apply fix" 버튼** → 같은 modal 내 step 2 progress (별 modal X).
- Apply fix step 2: **group 별 fix mode 선택** (mode a fuzzy / mode b sha / mode c backlink) + confirm checkbox.
- Apply fix step 3: execute + "N pages updated" + log entry 추가.
- Modal 공통 UI (R1~R5): sticky header / sticky footer (중앙정렬) / scrollable middle / Close 버튼 동작.
- Help 패널 hr divider (R11) — 섹션 구분.
- Dashboard health row = display only. 클릭 시 Help 패널 maintenance 섹션으로 navigation 만.
- Command palette 등록 = 부가 진입점 (legacy / power user, **3 command** v0.4).

## §5.18 cross-link (v0.4 갱신)

- 출처: session 37 §5.18 종결 시 `sha256:679cf2dd6db75e3a` 38-page dangling 잔존.
- detect 책임 = §5.18 (Citation Registry Diagnostic Modal) / fix 책임 = **§5.19 Check Fix link mode b (v0.4)** (구 §5.19 Recovery 흡수).
- Step G 라이브 smoke 의무 검증: Help 패널 Check → Modal accordion `dangling-cross-link (38)` → Apply fix → step 2 mode b 선택 + confirm → step 3 38 → 0 확증.

## 변경 면 추정 (v0.4 갱신 — Recovery 폐기 + Fix link multi-mode + accordion)

- **신규 파일 9개 (v0.3 8개 → v0.4 9개, fix-link.ts + fuzzy-slug.ts 추가, recovery.sh 제거)**:
  - `scripts/wiki-check.sh` (≤ 150 LOC, v0.3 100 → v0.4 150 — `--fix` 옵션 multi-mode 흡수)
  - ~~`scripts/wiki-recovery.sh`~~ — **v0.4 폐기**
  - `scripts/wiki-refactoring.sh` (≤ 100 LOC)
  - `wikey-core/src/wiki/maintenance/status.ts` (≤ 200 LOC — `getWikiStatus()` + cache + healthy rule)
  - `wikey-core/src/wiki/maintenance/check.ts` (≤ 250 LOC — finding 5 category 그룹화)
  - **`wikey-core/src/wiki/maintenance/fix-link.ts` (≤ 250 LOC) — v0.4 신규** (mode a fuzzy + mode b sha + mode c backlink)
  - `wikey-core/src/wiki/maintenance/refactoring.ts` (≤ 200 LOC)
  - **`wikey-core/src/wiki/maintenance/fuzzy-slug.ts` (≤ 100 LOC) — v0.4 신규** (G1 fuzzy match helper)
  - `wikey-obsidian/src/maintenance-modal.ts` (≤ 200 LOC — 3 mode 분기, AbortController)
  - `wikey-obsidian/src/maintenance-modal-views.ts` (≤ 250 LOC — accordion view + step 2/3 view, v0.3 200 → v0.4 250)
  - `wikey-obsidian/src/maintenance-runner.ts` (≤ 100 LOC — 3 command runner factory)
- **신규 test 4개 (v0.3 5 → v0.4 4, Recovery test 폐기)**:
  - `wiki-status.test.ts` (AC-S1-1, AC-S1-2, **AC-S1-3 healthy rule**)
  - `wiki-check.test.sh` (AC-C2-1~3 + **AC-CHECK-1~3 accordion** + **AC-FIX-1~4 multi-mode**, §5.18 fixture 사용 mode b)
  - `wiki-refactoring.test.ts` (AC-R4-1~3, **AC-R4-4 healthy rule**)
  - `maintenance-modal.test.ts` (AC-UI-1~6 + **AC-UI-7~13 sticky/accordion/hr**)
- **기존 edit**:
  - `wikey-obsidian/src/sidebar-chat.ts` — Help 패널 `openHelp()` 안 "Wiki Maintenance" 섹션 (**3 버튼**) + Dashboard health row (display only) + **Help hr divider** (≤ 50 LOC, v0.3 40 → v0.4 50)
  - `wikey-obsidian/src/commands.ts` — **3 부가 command** 등록 (≤ 45 LOC, v0.3 60 → v0.4 45 — Recovery 제거)
  - `wikey-obsidian/styles.css` — `.wikey-maintenance-modal-*` patch (≤ 150 LOC, v0.3 110 → v0.4 150 — sticky/accordion/hr/중앙정렬 추가)
- **기존 file 본문 수정 금지**:
  - `scripts/validate-wiki.sh` — 호출만 (Karpathy #3).

## AC mapping summary (Step B tester 1:1 RED 작성, v0.4 17 → 30)

| AC | Spec | scope | test file | v0.4 신규? |
|----|------|-------|-----------|-----------|
| AC-S1-1 | Spec 1 | helper return (7 필드, healthy 추가) | wiki-status.test.ts | (v0.4 fields 확장) |
| AC-S1-2 | Spec 1 | cache TTL 5분 / hit ≤ 50ms | wiki-status.test.ts | |
| **AC-S1-3** | Spec 1 | healthy rule (R6 fix) | wiki-status.test.ts | ✅ v0.4 |
| AC-C2-1 | Spec 2 | validate-wiki exit + finding list | wiki-check.test.sh | |
| AC-C2-2 | Spec 2 | analyses page 자동 생성 (5 섹션) | wiki-check.test.sh | (v0.4 4→5 섹션) |
| AC-C2-3 | Spec 2 | reconcileAfterIngest helper 재사용 1:1 | wiki-check.test.sh | |
| **AC-CHECK-1** | Spec 2 | finding 5 category 그룹 collapsed | wiki-check.test.sh | ✅ v0.4 |
| **AC-CHECK-2** | Spec 2 | accordion expand/collapse toggle | wiki-check.test.sh | ✅ v0.4 |
| **AC-CHECK-3** | Spec 2 | 그룹 헤더 수량 정확 | wiki-check.test.sh | ✅ v0.4 |
| **AC-FIX-1** | Spec 2 | broken wikilink fuzzy candidate (G1) | wiki-check.test.sh | ✅ v0.4 (R8) |
| **AC-FIX-2** | Spec 2 | dangling sha cleanup 38→0 (Recovery 흡수) | wiki-check.test.sh | ✅ v0.4 (R9 흡수) |
| **AC-FIX-3** | Spec 2 | backlink 4 layer update (G2) | wiki-check.test.sh | ✅ v0.4 |
| **AC-FIX-4** | Spec 2 | confirm 의무 (silent fix 0) | wiki-check.test.sh | ✅ v0.4 (구 W3-2) |
| AC-R4-1 | Spec 3 (구 4) | suggestion list modal | wiki-refactoring.test.ts | |
| AC-R4-2 | Spec 3 | 자동 변경 0 | wiki-refactoring.test.ts | |
| AC-R4-3 | Spec 3 | 0.85 default + override | wiki-refactoring.test.ts | |
| **AC-R4-4** | Spec 3 | healthy rule (R10 fix) | wiki-refactoring.test.ts | ✅ v0.4 |
| AC-UI-1 | UI | Help 패널 3 버튼 섹션 (v0.4 4→3) | maintenance-modal.test.ts | (v0.4 4→3) |
| AC-UI-2 | UI | `MaintenanceModal` 3 mode 분기 | maintenance-modal.test.ts | (v0.4 4→3) |
| AC-UI-3 | UI | Modal progress + log tail stream | maintenance-modal.test.ts | |
| AC-UI-4 | UI | finding 발견 시 Apply fix 버튼 | maintenance-modal.test.ts | |
| AC-UI-5 | UI | in-modal step 2/3 진행 | maintenance-modal.test.ts | |
| AC-UI-6 | UI | abort (AbortController + SIGTERM) | maintenance-modal.test.ts | |
| **AC-UI-7** | UI | sticky header (R1) | maintenance-modal.test.ts | ✅ v0.4 |
| **AC-UI-8** | UI | sticky footer (R2) | maintenance-modal.test.ts | ✅ v0.4 |
| **AC-UI-9** | UI | scrollable middle (R3) | maintenance-modal.test.ts | ✅ v0.4 |
| **AC-UI-10** | UI | footer Close 동작 (R4 BUG fix) | maintenance-modal.test.ts | ✅ v0.4 |
| **AC-UI-11** | UI | footer horizontal 중앙정렬 (R5) | maintenance-modal.test.ts | ✅ v0.4 |
| **AC-UI-12** | UI | accordion view (R7) | maintenance-modal.test.ts | ✅ v0.4 |
| **AC-UI-13** | UI | Help hr divider (R11) | maintenance-modal.test.ts | ✅ v0.4 |
| **AC-GOAL-1** | Goal | G1 broken wikilink fix | (AC-FIX-1 매핑) | ✅ v0.4 |
| **AC-GOAL-2** | Goal | G2 backlink 4 layer | (AC-FIX-3 매핑) | ✅ v0.4 |
| **AC-GOAL-3** | Goal | G3 knowledge gap (Out of Scope link only) | (Refactoring low-utility 부분) | ✅ v0.4 |
| **AC-GOAL-4** | Goal | G4 periodic manual | (AC-S1-3 + AC-R4-4 매핑) | ✅ v0.4 |

**총 30 정량 AC** (v0.3 17 + v0.4 신규 13). Recovery AC 3개 (W3-1~3) → Check Fix link AC 4개 (FIX-1~4) 이관 흡수.

## v0.3 → v0.4 diff 요약 (≤ 400 글자)

- 4 → 3 command (Recovery 폐기, Check Fix link 흡수).
- AC 17 → 30 (Spec 11→13, UI 6→13, Goal 4 신규).
- 신규 invariant: I-HEALTH-1 (healthy rule), I-CHECK-1~3 (accordion), I-FIX-1~4 (multi-mode).
- 신규 file: maintenance/fix-link.ts + fuzzy-slug.ts. 폐기: scripts/wiki-recovery.sh.
- styles.css: 110 → 150 LOC (sticky/accordion/hr/중앙정렬).
- 7 raise (R1~R11) + 4 goal (G1~G4) 완전 매핑.

## v0.5 raise (Session 39, 2026-05-12) — UX 통합 + 5 카테고리 fix

- [x] **R1+R2+R3 (Check UX)** — step 1 guidance + Apply fix flow 명확화
- [x] **R4 (5 카테고리)** — `applyStaleTombstoneCleanup` (I-PURGE-1~4) 신규. paired-sidecar / validate-wiki-other = out-of-scope
- [x] **R5 (Help 정의)** — Maintenance Modes section (Status / Check / Refactoring)
- [x] **R6 (Refactoring next step)** — Execute button + Step 2 archive + `applyRefactoringArchive` (I-ARCH-1~5)
- [x] **R7 (margin)** — `.wikey-maintenance-modal-unhealthy` margin-bottom 16px

검증: 23 신규 test PASS (core 15 + obsidian 8), build 0 errors, master cdp R1~R7 smoke PASS. commit `a2b6e5d`.

## v0.5 follow-up (Session 39, 2026-05-13) — init view cleanup

- [x] **wikicheck-init progress block** — `:empty { display:none }` + raw key:value dump 제거 (정보 중복 해소)
- [x] **refactoring-init Execute/Close row** — `.wikey-maintenance-modal-unhealthy-actions` flex (gap 8px, margin-top 16px)
- [x] **라인 중복** — raw progress + unhealthy summary 중복 제거
- [x] **Help maintenance hr 2줄** — manual `helpEl.createEl('hr')` (line 855) 제거. Settings paragraph 직전 자동 hr 만

검증: 1088 PASS / build 0, master cdp smoke (progress display:none / sameRow:true / hr 1줄) PASS. commit `e2fffb5`.

## 변경 이력

- v0.5 follow-up (2026-05-13): init view UX 4 raise — progress block hidden / Execute row / 라인 중복 / help hr 중복. commit `e2fffb5`.
- v0.5 (2026-05-12): 사용자 raise R1~R7 — UX 통합 + 5 카테고리 fix path + Refactoring next step + margin. AC 30 + I-PURGE/I-ARCH invariants. commit `a2b6e5d`.
- v0.4 (2026-05-12): 사용자 obsidian-cdp 7 raise (R1~R11) + 핵심 목적 4 (G1~G4) 반영. Recovery 폐기 (Check Fix link 흡수), Check finding accordion, Fix link multi-mode (a/b/c), Health rule, Help hr. 4→3 command, AC 17→30.
- v0.3 (2026-05-12): master LOC budget realistic adjustment.
- v0.2 (2026-05-12): analyst LOCK — Q1~Q4, §5.16 reference 정정, §5.18 dangling cross-link, 신규 UI 흐름, 17 AC.
- v0.1 (2026-05-11): draft 신규.
