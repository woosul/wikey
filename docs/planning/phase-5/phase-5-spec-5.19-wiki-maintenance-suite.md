---
phase: 5
section: 5.19
title: Wiki maintenance suite — wiki-status / wiki-check / wiki-refactoring (Spec)
status: draft
created: 2026-05-11
updated: 2026-05-12
version: v0.4
---

# Phase 5 §5.19 Wiki maintenance suite (Spec, WHAT)

> **상위 문서**: [`docs/planning/phase-5/phase-5-todo.md §5.19`](./phase-5-todo.md) · [`docs/planning/phase-5/phase-5-todox-5.19-wiki-maintenance-suite.md`](./phase-5-todox-5.19-wiki-maintenance-suite.md)
>
> **버전 이력**:
> - v0.1 (2026-05-11): draft 신규 (사용자 본체 완성 시점 테스트 2-1 보고).
> - v0.2 (2026-05-12): analyst LOCK. 8 핵심 결정 (A~H) 반영 — §5.16 reference 정정 / Q1~Q4 LOCK / §5.18 dangling cross-link / AC 정량 1:1 매핑 / 신규 UI 흐름 (Help 패널 버튼 → MaintenanceModal → in-modal action).
> - v0.3 (2026-05-12): master LOC budget realistic adjustment (cosmetic, AC 영향 0).
> - v0.4 (2026-05-12): 사용자 obsidian-cdp 직접 시험 7 raise (R1~R11) + 핵심 목적 재정의 (G1~G4) + **Recovery 폐기 (Check Fix link 흡수)** + Check finding 분류 accordion + Fix link multi-mode + health 판정 rule + Help hr divider. 4 → **3 command** (status / check / refactoring). AC 17 → **30** (Spec 11→13 + UI 6→13 + Goal 4).

## 0. Context

**도출 source v0.4 (2026-05-12)**: 사용자 obsidian-cdp 직접 시험 결과 + 핵심 목적 재정의. master 가 obsidian-cdp Scenario 직접 진행하여 7 raise (R1~R11) 실측 확증.

### 0.1 사용자 obsidian-cdp 실측 raise 7건

**UI 공통 (모든 modal)**:
- **R1** sticky header: 상단 title (`--text-accent` color) + close (x) icon 고정.
- **R2** sticky footer: 하단 button series 고정.
- **R3** scrollable middle: 중앙 콘텐츠만 scroll.
- **R4** footer Close 버튼 BUG: master 실측 — 하단 Close 버튼 click 시 modal close 0 (현재 x icon 만 작동). `wikey-maintenance-modal-close-btn` onClick 미작동.
- **R5** horizontal 중앙정렬: footer buttons `display: flex; justify-content: center`.

**Status modal**:
- **R6** "All healthy" 모순: master 실측 brokenLinkCount=6,936 (사용자 5,202 — 시점차) 인데 "All healthy" 표시. broken > 0 시 unhealthy 또는 metric 별 status 분리.

**Check modal**:
- **R7** finding 7,439건 flat list: 분류별 그룹화 + accordion expand/collapse 필요. 초기 collapsed = `right chevron + 그룹명 (N)`, 확장 = `down chevron + 그룹명 (N)` + 하단 목록 (grey).
- **R8** Fix link conceptual gap: broken wikilink 7,439건 detect 되지만 fix 대상 0. 현 impl 는 dangling sha cleanup 만 (38 → 0). 사용자 의도 = "깨진 링크 많다며 수정되는 건 없다?" → broken wikilink 자동 fix 누락.

**Recovery modal**:
- **R9** Check 와 동일 화면: master 실측 finding 8,306건 + 동일 headings/buttons → **삭제 (폐기)**. Check 의 Fix link 가 recovery 역할 흡수.

**Refactoring modal**:
- **R10** "All healthy" 모순: broken link 많은 vault 에서 healthy 표시 부적절.

**Help 패널**:
- **R11** 섹션 구분: 섹션별 가로줄 (`<hr>`) 추가 — 섹션간 구분 어려움.

### 0.2 핵심 목적 4 재정의 (사용자 명시)

본 §5.19 의 핵심 목적은 다음 4 가지. v0.4 모든 AC 가 이 4 목적에 매핑:

- **G1 — 자체 페이지 없는 링크 찾기**: broken wikilink detect + 자동 fix candidate 제시 (fuzzy match similar slug).
- **G2 — 잘못 지시하는 백링크 업데이트**: 버전 변경 따라 inline link / 참조링크 / 원본링크 / 확장링크 4 layer 점검·변경·추가.
- **G3 — 데이터 갭이 발생하는 페이지 보강**: knowledge gap detect (§5.20 와 연계, link only — §5.19 scope 외 detect 만).
- **G4 — 건강한 wiki 페이지 + 링크 유지**: periodic check (manual command + 사용자 opt-in). 자동 trigger 는 §5.19 scope 외 (Q4 LOCK 유지).

### 0.3 v0.3 → v0.4 핵심 변경 요약

1. **Recovery 폐기**: 4 → 3 command (status / check / refactoring). Recovery 의 dangling sha cleanup + tombstone restore = **Check 의 Fix link 가 multi-mode 로 흡수**.
2. **Check Fix link multi-mode**: (a) broken wikilink fix candidate (G1) (b) dangling sha cleanup (기존 v0.3 38→0 use case) (c) backlink update (G2).
3. **Check finding 분류 accordion**: flat list 7,439건 → 5 group (broken-wikilink / dangling-cross-link / paired-sidecar / stale-tombstone / validate-wiki-other) + accordion expand/collapse.
4. **Modal 공통 UI invariant**: sticky header / sticky footer (중앙정렬) / scrollable middle / Close 버튼 동작 fix.
5. **Health 판정 rule**: brokenLinkCount > 0 OR danglingCrossLinkCount > 0 OR staleTombstoneCount > 0 OR (refactoring) duplicates > 0 → unhealthy. Status / Refactoring 모순 fix.
6. **Help 패널 hr**: 섹션 사이 visual divider.

### 0.4 §5.18 use case 보존

`sha256:679cf2dd6db75e3a` 38-page dangling cleanup = **Check 의 Fix link (mode b — dangling sha cleanup)** 의 첫 실 use case. v0.3 Recovery → v0.4 Check Fix link 이관. detect 책임 = §5.18 (Modal) / fix 책임 = §5.19 (Check Fix link) — 두 cycle 책임 분리 정합.

## 1. Specs

### Spec 1: wiki-status — health summary

- **Goal**: 1-row summary 출력 + Dashboard 상단 health pill + Help 패널 Status 버튼 진입점. G4 (건강한 wiki 유지) 의 첫 진입점.
- **Outputs**: `WikiStatus = { pageCount: number, orphanCount: number, brokenLinkCount: number, staleTombstoneCount: number, danglingCrossLinkCount: number, lastValidateTs: string | null, healthy: boolean }`. v0.4 신규 — `healthy` 필드 추가 (I-HEALTH-1 적용).
- **Invariants**:
  - I1 (read-only): wiki/ 변경 0. registry 변경 0.
  - I2 (latency budget): cold call (cache miss) ≤ 5s. cache hit ≤ 50ms.
  - I3 (cache TTL): in-memory 5분 TTL. Dashboard mount + Help Status 버튼 클릭 시 모두 본 cache 우선 사용. Modal "Refresh" 버튼 시 강제 cache invalidate.
  - **I-HEALTH-1 (v0.4, R6 fix)**: `healthy = (brokenLinkCount === 0 && danglingCrossLinkCount === 0 && staleTombstoneCount === 0)`. 하나라도 > 0 시 `healthy=false`. UI 표시 = `healthy ? "All healthy" : "<N issues found>"`.
- **Acceptance**:
  - **AC-S1-1**: `getWikiStatus()` 반환 객체에 7 필드 (6 metric + healthy) 모두 number/null/boolean. metric 정의는 v0.3 와 동일.
  - **AC-S1-2**: 동일 vault 연속 2회 호출 시 2회차 ≤ 50ms (cache hit). 5분 경과 후 cold call ≤ 5s.
  - **AC-S1-3 (v0.4 신규, R6/AC-HEALTH-1)**: brokenLinkCount > 0 시 `healthy=false` + UI "All healthy" 표시 0. brokenLinkCount=0 && danglingCrossLinkCount=0 && staleTombstoneCount=0 시 `healthy=true` + UI "All healthy" 표시.

### Spec 2: wiki-check — 통합 verify + Fix link multi-mode

- **Goal**: validate-wiki.sh + paired-sidecar audit + registry reconcile + stale tombstone detect (§5.16 Spec 2 B2) + §5.18 dangling cross-link detect 1버튼 + **Fix link multi-mode 흡수 (v0.4 신규)**. G1 (broken wikilink fix) + G2 (backlink update) 의 핵심 진입점.
- **Invariants**:
  - I4 (read-only by default): wiki/ 변경 0. 단 `wiki/analyses/wiki-check-<date>.md` 1개 신규 생성은 허용. Fix link 실행 시점부터는 변경 허용 (사용자 confirm 후).
  - I5 (helper 재사용): stale tombstone detect 는 §5.16 Spec 2 의 `reconcileAfterIngest` helper 를 dry-run mode 로 1회 명시 실행. 코드 중복 0.
  - I6 (report 단일 page): finding list 를 `wiki/analyses/wiki-check-<YYYY-MM-DD>.md` 1개 페이지로 저장. 동일 일자 재실행 시 overwrite (idempotent).
  - **I-CHECK-1 (v0.4 신규, R7)**: finding 을 5 category 그룹화 — `broken-wikilink` / `dangling-cross-link` / `paired-sidecar` / `stale-tombstone` / `validate-wiki-other`.
  - **I-CHECK-2 (v0.4 신규, R7)**: accordion render — 초기 모든 group collapsed (`right chevron + 그룹명 (N)`), click 시 expanded (`down chevron + 그룹명 (N)` + 하단 목록 grey).
  - **I-CHECK-3 (v0.4 신규, R7)**: 각 그룹 헤더에 finding 수량 표시.
  - **I-FIX-1 (v0.4 신규, R8/G1)**: broken wikilink `[[X]]` detect 시 자동 fix candidate 제시 — fuzzy match similar slug 검색 (Levenshtein distance ≤ 3 또는 substring match, top-3 candidate). 사용자 confirm 후 변경.
  - **I-FIX-2 (v0.4 신규, Recovery 흡수)**: dangling sha cleanup — frontmatter `sources:` / 본문 `[[source-...]]` 의 registry 미존재 sha256 제거 (또는 "근거 삭제됨" 표시). 기존 v0.3 §5.19 Recovery 의 38→0 use case 동일.
  - **I-FIX-3 (v0.4 신규, G2)**: backlink update — 버전 변경 따라 inline / 참조 / 원본 / 확장 wikilink 4 layer 점검 + 업데이트.
  - **I-FIX-4 (v0.4 신규, confirm 의무)**: Fix link 3 mode 모두 사용자 명시 confirm. silent fix 0. (구 Spec 3 I7 이관)
- **Acceptance**:
  - **AC-C2-1**: `validate-wiki.sh` exit code 와 동일한 verdict + finding list (validate-wiki 출력 line 마다 1 finding). exit 0 = healthy, exit != 0 = finding 존재.
  - **AC-C2-2**: 실행 후 `wiki/analyses/wiki-check-<YYYY-MM-DD>.md` 자동 생성 — frontmatter `type: analysis`, 본문 5 섹션 (5 category 별).
  - **AC-C2-3**: stale tombstone detect 결과 = §5.16 Spec 2 `reconcileAfterIngest` helper return `restoredIds` 와 1:1 동치. 코드 중복 0.
  - **AC-CHECK-1 (v0.4 신규)**: finding list 가 5 category 그룹화되어 render. 각 group 초기 collapsed.
  - **AC-CHECK-2 (v0.4 신규)**: 그룹 헤더 click → expand (`down chevron + 그룹명 (N) + 목록 grey`), 재click → collapse (`right chevron + 그룹명 (N)`).
  - **AC-CHECK-3 (v0.4 신규)**: 각 그룹 헤더에 finding 수량 정확 표시 (`broken-wikilink (7,439)` 등).
  - **AC-FIX-1 (v0.4 신규, G1)**: broken wikilink `[[X]]` (X 페이지 미존재) detect 시 fuzzy match candidate (top-3 slug) 제시. 사용자 confirm 후 `[[X]]` → `[[Y]]` 변경. confirm 거부 시 변경 0.
  - **AC-FIX-2 (v0.4, Recovery 흡수)**: 기존 §5.18 `sha256:679cf2dd6db75e3a` 38-page dangling cleanup → Check Fix link mode b 로 동일 결과 (38 → 0). `wiki/log.md` 에 `## [YYYY-MM-DD] lint-fix | wiki-check` entry 추가 (§5.11 v2 ingest 동급 format).
  - **AC-FIX-3 (v0.4 신규, G2)**: backlink 4 layer (inline / 참조 / 원본 / 확장) 중 변경된 layer 별 fix 후 후속 wiki-check 시 broken wikilink 감소 확증.
  - **AC-FIX-4 (v0.4 신규, confirm)**: Fix link UI flow — step 1 (finding 분류별 표시) → step 2 (group 별 fix mode 선택 + confirm checkbox) → step 3 (execute + N pages updated). 모든 destructive 변경 confirm 의무.

### Spec 3 (v0.3) → 폐기 (v0.4)

**§5.19 Spec 3 wiki-recovery 폐기** (v0.4, 2026-05-12).

- 폐기 사유 (사용자 obsidian-cdp 실측 R9): Recovery modal 이 Check modal 과 동일 화면 (finding 8,306건 + 동일 headings/buttons) — Karpathy #2 Simplicity 위반 (중복 UI).
- 흡수 처리: Recovery 의 dangling sha cleanup (v0.3 AC-W3-1, 38→0) + log entry (v0.3 AC-W3-3) + confirm 의무 (v0.3 AC-W3-2) = **Check 의 Fix link multi-mode (I-FIX-1~4 / AC-FIX-1~4)** 가 흡수.
- 보존 API: `applyWikiRecovery()` (wikey-core) 함수는 보존 — Check 의 Fix link 가 호출. 단 사용자 진입점은 단일 (Check Fix link button).
- §2 Out of Scope 명시: `scripts/wiki-recovery.sh` 신규 생성 X. `wiki-check.sh` 가 `--fix` 옵션 받음 (단일 script).

### Spec 4 → Spec 3 (v0.4 renumber): wiki-refactoring — suggestion only

- **Goal**: schema-driven 정리 *suggestion* — duplicate entity merge 후보 + low-utility analyses archive 후보. 자동 변경 0. G3/G4 (knowledge gap detect — link only, periodic 유지) 보조 진입점.
- **Invariants**:
  - I10 (suggestion only): 자동 변경 0. 사용자 명시 클릭 액션 필요.
  - I11 (signal 명시): suggestion 근거 — duplicate entity = canonical slug similarity ≥ threshold / low-utility = backlink 0 + 30일+ 미수정.
  - I12 (threshold default): duplicate entity slug similarity threshold **0.85 default** + `.wikey/refactoring.yaml` override.
  - **I-HEALTH-1 적용 (v0.4, R10 fix)**: Refactoring modal 의 "All healthy" 표시 조건 = brokenLinkCount===0 && danglingCrossLinkCount===0 && staleTombstoneCount===0 && duplicateCount===0 && lowUtilityCount===0. 하나라도 > 0 시 "<N issues found>" 표시.
- **Acceptance**:
  - **AC-R4-1**: suggestion list modal — duplicate entity 후보 + low-utility analyses 후보 양 카테고리 각 N row, clickable (wiki page navigation).
  - **AC-R4-2**: 자동 변경 0 — modal 닫기 시 wiki/ 변경 0. 사용자가 row 클릭 → wiki page open 만.
  - **AC-R4-3**: similarity threshold 0.85 default 적용. `.wikey/refactoring.yaml` 가 존재하면 override (parse fail 시 fallback default + WARN).
  - **AC-R4-4 (v0.4 신규, R10/AC-HEALTH-1)**: duplicateCount > 0 OR lowUtilityCount > 0 시 "All healthy" 표시 0. 모두 0 시만 "All healthy" 표시.

### 1.5 UI flow specs (v0.4 갱신, R1~R5 + R7 + R11)

각 maintenance script 의 진입점 = Help 패널 안 "Wiki Maintenance" 섹션 버튼 **3개** (Status / Check / Refactoring — v0.4 Recovery 제거). Modal 단일 컴포넌트 (`MaintenanceModal`), action 별 mode prop 로 분기. Dashboard health row 는 display only.

**기존 AC (v0.2 유지, Recovery mode 제거)**:

- **AC-UI-1 (Help 패널 섹션)**: Help 패널 안에 신규 "Wiki Maintenance" 섹션 + **3 버튼** (Status / Check / Refactoring suggestions). 기존 Help guide markdown 과 공존.
- **AC-UI-2 (Modal 단일 컴포넌트)**: 버튼 클릭 → `MaintenanceModal` open (`new MaintenanceModal(app, plugin, { mode: 'status' | 'check' | 'refactoring' }).open()`). **3 mode** 동일 컴포넌트, mode prop 으로 분기.
- **AC-UI-3 (Modal 안 progress 영역)**: Modal 안 progress text + log tail (scrollable). script stdout stream tail (line append). check / refactoring 진행 중 stage 명시.
- **AC-UI-4 (finding action 분기)**: 결과 finding 발견 시 modal 하단 action 버튼 출현 — `Apply fix` (Check 의 Fix link multi-mode 진입), `Open page` (refactoring suggestion row click), 또는 `Close` (finding 0 또는 status mode). finding 0 시 "All healthy" 메시지 + Close 버튼.
- **AC-UI-5 (in-modal step 진행)**: Apply fix 클릭 시 같은 modal 안에서 step 2 progress (별 modal X). step 1 finding list (accordion) → step 2 group 별 fix mode 선택 + confirm checkbox → step 3 execute + result.
- **AC-UI-6 (abort)**: modal close 시 진행 중 작업 abort (`AbortController` signal). 미완료 시 confirm dialog. subprocess SIGTERM → 5s timeout 후 SIGKILL.

**v0.4 신규 AC (R1~R5 + R7 + R11)**:

- **AC-UI-7 (R1, sticky header)**: `.wikey-maintenance-modal-header` `position: sticky; top: 0`. title (`color: var(--text-accent)`) + close (x) icon. scroll 시 fixed.
- **AC-UI-8 (R2, sticky footer)**: `.wikey-maintenance-modal-footer` `position: sticky; bottom: 0`. button series 고정.
- **AC-UI-9 (R3, scrollable middle)**: `.wikey-maintenance-modal-content` `overflow-y: auto; max-height: calc(80vh - <header-h> - <footer-h>)`. 중앙 영역만 scroll.
- **AC-UI-10 (R4, footer Close 버튼 동작 BUG fix)**: footer `.wikey-maintenance-modal-close-btn` `onClick = () => modal.close()`. click → modal close 확증 (현재 BUG, fix 의무).
- **AC-UI-11 (R5, horizontal 중앙정렬)**: `.wikey-maintenance-modal-footer` `display: flex; justify-content: center; gap: 8px`.
- **AC-UI-12 (R7 accordion)**: AC-CHECK-1~3 매핑 — Check modal 안 finding 5 category accordion render. 위 Spec 2 AC-CHECK-1~3 와 동일 (UI 측면 명시).
- **AC-UI-13 (R11, Help 패널 hr)**: Help 패널 내 모든 섹션 사이 `<hr class="wikey-help-divider">` 추가. visual 구분.

### 1.6 Goal alignment (v0.4 신규)

사용자 명시 4 핵심 목적의 AC 매핑:

- **AC-GOAL-1 (G1)**: wiki-check 가 broken wikilink (v0.4 master 실측 7,439건) detect + fuzzy match fix candidate 제시. AC-FIX-1 매핑.
- **AC-GOAL-2 (G2)**: backlink 업데이트 — inline / 참조 / 원본 / 확장 4 layer 점검. AC-FIX-3 매핑.
- **AC-GOAL-3 (G3)**: knowledge gap page 보강 — §5.20 link only, §5.19 scope 외 detect 만. wiki-refactoring 의 low-utility suggestion 이 부분 cover. §2 Out of Scope 명시.
- **AC-GOAL-4 (G4)**: 건강한 wiki 유지 — periodic manual command. AC-S1-3 / AC-R4-4 / AC-HEALTH-1 매핑. 자동 trigger 는 Q4 LOCK out of scope.

### 1.7 Fix link multi-mode 상세 흐름 (v0.4 신규)

Check Fix link 의 3 mode + UI step:

```
[Check modal] step 1: finding accordion (5 category, 초기 collapsed)
   ├─ broken-wikilink (7,439)        ← mode a 대상
   ├─ dangling-cross-link (38)       ← mode b 대상 (§5.18 use case)
   ├─ paired-sidecar (N)
   ├─ stale-tombstone (N)            ← mode b 보조 (helper restoredIds)
   └─ validate-wiki-other (N)
                  ↓ "Apply fix" click
[Check modal] step 2: group 별 fix mode 선택 + confirm checkbox
   ☐ broken-wikilink → mode a (fuzzy match candidate)
       각 finding row 에 top-3 candidate dropdown (사용자 선택)
   ☐ dangling-cross-link → mode b (sha cleanup)
       checkbox bulk confirm
   ☐ backlink update (G2) → mode c
       layer 별 (inline / 참조 / 원본 / 확장) 선택
                  ↓ "Execute" click
[Check modal] step 3: execute + result
   - "N pages updated" 표시
   - wiki/log.md 에 lint-fix entry 추가
   - 후속 wiki-check 권장 (재실행 시 finding 감소 확증)
```

mode 별 책임:
- **mode a (broken wikilink fix)**: I-FIX-1 / AC-FIX-1 / G1.
- **mode b (dangling sha cleanup)**: I-FIX-2 / AC-FIX-2 / 기존 v0.3 Recovery 흡수 / §5.18 38-page use case.
- **mode c (backlink update)**: I-FIX-3 / AC-FIX-3 / G2.

## 2. Out of Scope

- Knowledge Gap 자동 리포트 본체 (§5.20 별 cycle). G3 detect only.
- 자동 cron / scheduler — manual command (Q4 LOCK, G4 manual 한정).
- Fix link 의 fully-automated mode (Karpathy #3 Surgical Changes — 변경은 사용자 확정 confirm).
- `validate-wiki.sh` 본문 수정 — 호출만.
- Dashboard health row click action 으로 maintenance script 직접 실행 (display only, Help 패널 navigation 만).
- Command palette 등록 — 부가 진입점 (legacy / power user 용 ≤ 60 LOC). 1차 UX = Help 패널 버튼.
- **§5.19 Spec 3 wiki-recovery (v0.4 폐기)**: Check Fix link multi-mode 가 흡수. `scripts/wiki-recovery.sh` 신규 생성 X. `wikey-obsidian/src/sidebar-chat.ts` 의 Recovery 버튼 X. `MaintenanceModal` 의 `mode: 'recovery'` X (3 mode 만).

## 3. Dependencies

- `scripts/validate-wiki.sh` — Spec 2 통합 진입점 (호출만, 본문 수정 X).
- `scripts/audit-ingest.py` — paired-sidecar audit (호출).
- `wikey-core/src/source-registry.ts:reconcileAfterIngest` — §5.16 Spec 2 helper 재사용 (dry-run mode).
- `wikey-obsidian/src/commands.ts` — **3 부가 command** 등록 (palette legacy, v0.4 4→3).
- `wikey-obsidian/src/sidebar-chat.ts` — Help 패널 "Wiki Maintenance" 섹션 (3 버튼) + Dashboard health row (display only) + Help 패널 hr divider (R11/AC-UI-13).
- 신규 `scripts/wiki-check.sh` — validate-wiki + paired-sidecar audit + reconcile dry-run + dangling detect + **`--fix` 옵션 (multi-mode)** (≤ 150 LOC, v0.3 100 → v0.4 150).
- ~~신규 `scripts/wiki-recovery.sh`~~ — **v0.4 폐기**. Check `--fix` 흡수.
- 신규 `scripts/wiki-refactoring.sh` — suggestion only (≤ 100 LOC).
- 신규 `wikey-core/src/wiki/maintenance/*.ts` (helpers / status / check / **fix-link** / refactoring — 각 ≤ 250 LOC).
  - **v0.4 신규 `maintenance/fix-link.ts`** (≤ 250 LOC) — mode a (fuzzy candidate) + mode b (dangling sha cleanup, 구 `applyWikiRecovery()` 흡수) + mode c (backlink update).
- 신규 `wikey-obsidian/src/maintenance-modal.ts` + `maintenance-modal-views.ts` (각 ≤ 200 LOC).
  - **v0.4 신규 view**: accordion view (Check finding 5 category) + Fix link step 2/3 view.
- 신규 `wikey-obsidian/src/maintenance-runner.ts` — Help 패널 + palette 3 command 공용 runner factory (v0.4 4→3).
- 신규 `wikey-obsidian/styles.css` patch — modal css (`.wikey-maintenance-modal-*`, ≤ 150 LOC v0.4 — sticky header/footer + accordion + Help hr + step 2 confirm view).
- `wikey-core/src/canonicalizer.ts` 또는 신규 `wikey-core/src/wiki/maintenance/fuzzy-slug.ts` (≤ 100 LOC) — fuzzy match similar slug helper (G1, AC-FIX-1).

## 4. 진행 순서 (SDD+TDD)

- **Step A (analyst v0.4)**: ✅ 완료 (2026-05-12) — R1~R11 + G1~G4 + Recovery 폐기 + Check Fix link multi-mode + Health rule + Help hr 반영. 30 AC.
- **Step B (tester RED)**: 신규 test —
  - `wiki-status.test.ts` (AC-S1-1, AC-S1-2, **AC-S1-3 healthy rule**),
  - `wiki-check.test.sh` (AC-C2-1~3, **AC-CHECK-1~3 accordion**, **AC-FIX-1~4 multi-mode**),
  - `wiki-refactoring.test.ts` (AC-R4-1~3, **AC-R4-4 healthy rule**),
  - `maintenance-modal.test.ts` (AC-UI-1~6 + **AC-UI-7~13 sticky/accordion/hr**).
  - **Recovery test 폐기**: 기존 `wiki-recovery.test.ts` → `wiki-check.test.sh` 의 Fix link mode b 로 흡수 (38→0 fixture 동일).
- **Step C (developer GREEN)**: 3 script + maintenance/*.ts (fix-link.ts 신규) + MaintenanceModal (accordion view + step 2/3 view) + Help 패널 섹션 (3 버튼 + hr) + Dashboard row + 3 command 등록 + styles.css sticky/accordion patch.
- **Step D — Phase 3a 회귀**: `npm test` + `npm run build` + `./scripts/validate-wiki.sh` 모두 PASS.
- **Step E — Phase 3b BLUE refactor**: cache helper extract / modal mode 분기 가독성 / script common header / fuzzy match helper extract / accordion view 분리 / 회귀 PASS 반복.
- **Step F — codex post-impl review**: spec ↔ test ↔ impl 4중 정합 review (cmux Mode D Panel). v0.4 30 AC 1:1 확증.
- **Step G (master 라이브 smoke)**:
  - Help 패널 Status 버튼 → Modal → 7 필드 (healthy 포함) 표시 확증. brokenLinkCount=6,936 → `healthy=false` + "<N issues found>" 표시 (R6 fix 확증).
  - Help 패널 Check 버튼 → Modal progress → finding 5 category accordion render (R7 확증). 그룹 expand/collapse 동작.
  - Apply fix → step 2 group 별 fix mode 선택 (mode a fuzzy / mode b sha / mode c backlink) → step 3 execute → `danglingCrossLinkCount: 38 → 0` + `brokenLinkCount` 감소 확증.
  - Help 패널 Refactoring 버튼 → suggestion list modal + row click → wiki page open. duplicateCount > 0 시 "All healthy" 표시 0 (R10 fix 확증).
  - Modal footer Close 버튼 click → modal close (R4 BUG fix 확증).
  - Modal sticky header / sticky footer / scrollable middle 동작 확증 (R1/R2/R3).
  - Footer button horizontal 중앙정렬 확증 (R5).
  - Help 패널 섹션 사이 hr 표시 확증 (R11).
  - Dashboard health row display only 확증.

## 5. 변경 이력

- v0.4 (2026-05-12): **사용자 obsidian-cdp 직접 시험 7 raise (R1~R11) + 핵심 목적 재정의 (G1~G4) 반영**. 핵심 변경 6:
  - **Recovery 폐기 (R9)**: 4 → 3 command. Check Fix link multi-mode 가 흡수.
  - **Check finding accordion (R7)**: flat list → 5 category 그룹 + expand/collapse.
  - **Fix link multi-mode (R8 + G1 + G2)**: mode a (broken wikilink fuzzy fix) + mode b (dangling sha cleanup) + mode c (backlink update).
  - **Modal 공통 UI (R1~R5)**: sticky header / sticky footer (중앙정렬) / scrollable middle / Close 버튼 동작 fix.
  - **Health 판정 rule (R6 + R10)**: brokenLinkCount > 0 OR danglingCrossLinkCount > 0 OR staleTombstoneCount > 0 시 unhealthy. "All healthy" 모순 fix.
  - **Help hr (R11)**: 섹션 사이 visual divider.
  - AC: 17 → 30 (Spec 11→13 + UI 6→13 + Goal 4 신규). Recovery AC 3개 (W3-1~3) → Check Fix link AC 4개 (FIX-1~4) 이관.
- v0.3 (2026-05-12): master LOC budget realistic adjustment (cosmetic, AC 영향 0).
- v0.2 (2026-05-12): analyst LOCK, 8 핵심 결정 (A~H).
- v0.1 (2026-05-11): draft 신규.
