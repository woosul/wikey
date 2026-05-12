---
phase: 5
section: 5.19
title: Wiki maintenance suite — wiki-status / wiki-check / wiki-recovery / wiki-refactoring (Spec)
status: draft
created: 2026-05-11
updated: 2026-05-12
version: v0.3
---

# Phase 5 §5.19 Wiki maintenance suite (Spec, WHAT)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.19`](./phase-5-todo.md) · [`plan/phase-5/phase-5-todox-5.19-wiki-maintenance-suite.md`](./phase-5-todox-5.19-wiki-maintenance-suite.md)
>
> **버전 이력**:
> - v0.1 (2026-05-11): draft 신규 (사용자 본체 완성 시점 테스트 2-1 보고).
> - v0.2 (2026-05-12): analyst LOCK. 8 핵심 결정 (A~H) 반영 — §5.16 reference 정정 / Q1~Q4 LOCK / §5.18 dangling cross-link / AC 정량 1:1 매핑 / 신규 UI 흐름 (Help 패널 버튼 → MaintenanceModal → in-modal action).

## 0. Context

**도출 source**: 사용자 본체 완성 시점 테스트 (2026-05-11) 2-1 보고 + §5.18 종결 잔존 (`sha256:679cf2dd6db75e3a` 38-page dangling, session 37 종결 시 §5.19 cleanup 예약).

- 현 상태: `scripts/validate-wiki.sh` 만 존재. lint 워크플로우는 schema §"워크플로우 3: 린트" 에 정의되어 있으나 사용자 명시 실행 의존, 자동 trigger 없음.
- 요청: 주기적 wiki 상태 점검 — wiki-status / wiki-check / wiki-recovery / wiki-refactoring.

**4 command 분해** (v0.2 — §5.16 reference 정정 + 흡수 결정 LOCK):

1. **wiki-status**: 1-row health summary (pages count, orphan%, broken link%, last validate ts, stale tombstone count) — Dashboard 상단 health 행 + Help 패널 진입점 동일.
2. **wiki-check**: `validate-wiki.sh` + paired-sidecar audit + registry reconcile + **stale tombstone detect (§5.16 Spec 2 B2, `reconcileAfterIngest` helper 재사용)** 통합 1버튼. ★ v0.1 의 "§5.16 Spec 3" 오기 → **§5.16 Spec 2 (B2)** 정정 (Spec 3 은 B3 Panel refresh 이므로 검출 대상 아님).
3. **wiki-recovery**: wiki-check 가 raise 한 finding 을 사용자 confirm 후 fix — stale tombstone 복구 (§5.16 Spec 2 B2 흐름 1회 명시 실행) + broken paired sidecar 재인덱스 + **§5.18 dangling cross-link cleanup** (frontmatter `sources:` / 본문 `[[...]]` 의 존재하지 않는 wiki page reference 제거).
4. **wiki-refactoring**: schema-driven 정리 *suggestion only* — duplicate entity merge 후보 + low-utility analyses archive 후보 (사용자 confirm 의존, 자동 변경 0).

**§5.18 dangling cross-link 실 use case (v0.2 신규 명시)**:

- 출처: session 37 §5.18 obsidian-cdp Scenario C — `Citation Registry Diagnostic` Modal 가 `sha256:679cf2dd6db75e3a` (§5.17 case A 복제본) dangling reference 를 38 wiki page 에서 점유 정확 노출. 본 mismatch 의 **자동 cleanup 1차 실 사례 = §5.19 wiki-recovery 의 Step G smoke**. detect 는 §5.18 (Modal) / fix 는 §5.19 (wiki-recovery) — 두 cycle 책임 분리 정합.
- 사용자 결정 (session 37 §5.17): "38 entity/concept frontmatter dangling reference → validate-wiki lint 자동 cleanup (workflow 3 self-healing)". §5.19 wiki-check 가 validate-wiki 호출 후 dangling list 를 추출 → wiki-recovery 가 confirm 후 일괄 cleanup.

**신규 UI 흐름 LOCK (v0.2, 사용자 2026-05-12)** ★ critical:

각 maintenance script 의 진입점은 **Help 패널 안 "Wiki Maintenance" 섹션의 버튼 4개**. Dashboard health row 는 *display only* (클릭 시 Help 패널 maintenance 섹션으로 navigation 만). Command palette 등록은 **부가 진입점** (legacy / power user). 1차 UX = Help 패널 버튼. 버튼 클릭 시 단일 `MaintenanceModal` 이 open + 진행 상황 live tail + finding 발견 시 같은 modal 안에서 "Apply fix" 버튼 분기 (별 modal X) — modal 단일 컴포넌트, action 별 mode prop.

**이득**:
- 정성 — schema §"워크플로우 3: 린트" 가 Help 패널 1-click 실행. 자동 trigger 없이도 maintenance entrypoint 단일화.
- 정성 — Modal 안 progress live tail + in-modal action 분기 → 사용자가 별 화면 전환 없이 detect → confirm → fix 1-screen 흐름.
- 정량 — wiki 정합성 metric (orphan / broken link / stale tombstone / dangling cross-link) 정기 측정 → 회귀 detect 가능. §5.18 38-page dangling = 첫 실측 use case.

**Trade-off**:
- 자동 trigger 시 사용자 confirm 없는 destructive 변경 위험 — 본 cycle 은 **detect + report 만, 변경은 사용자 confirm 후 (Karpathy 의도)**.
- Help 패널 안 UI 영역 추가 → 기존 Help guide markdown 과 공존. Karpathy #2 Simplicity — Help 패널은 maintenance 진입 4 버튼 + 기존 guide 만, 메트릭 표시 X (Dashboard 분담).

## 1. Specs

### Spec 1: wiki-status — health summary

- **Goal**: 1-row summary 출력 + Dashboard 상단 health pill + Help 패널 Status 버튼 진입점.
- **Outputs**: `WikiStatus = { pageCount: number, orphanCount: number, brokenLinkCount: number, staleTombstoneCount: number, danglingCrossLinkCount: number, lastValidateTs: string | null }`.
- **Invariants**:
  - I1 (read-only): wiki/ 변경 0. registry 변경 0.
  - I2 (latency budget): cold call (cache miss) ≤ 5s. cache hit ≤ 50ms.
  - I3 (cache TTL): in-memory 5분 TTL (v0.2 Q2 LOCK). Dashboard mount + Help Status 버튼 클릭 시 모두 본 cache 우선 사용. Help Modal "Refresh" 버튼 시 강제 cache invalidate.
- **Acceptance**:
  - **AC-S1-1**: `getWikiStatus()` 반환 객체에 6 metric 모두 number 또는 null (`lastValidateTs` 만). `pageCount` = `wiki/**/*.md` 총합. `orphanCount` = inbound link 0 페이지 수. `brokenLinkCount` = 본문 `[[X]]` 중 X 페이지 미존재 합. `staleTombstoneCount` = §5.16 Spec 2 reconcileAfterIngest dry-run 결과 `restoredIds.length`. `danglingCrossLinkCount` = frontmatter `sources:` 의 sha256 가 registry 에 존재하지 않는 페이지 수 (§5.18 38-page case).
  - **AC-S1-2**: 동일 vault 연속 2회 호출 시 2회차 ≤ 50ms (cache hit). 5분 경과 후 cold call ≤ 5s.

### Spec 2: wiki-check — 통합 verify

- **Goal**: validate-wiki.sh + paired-sidecar audit + registry reconcile + stale tombstone detect (§5.16 Spec 2 B2) + §5.18 dangling cross-link detect 1버튼. **읽기 전용 detect + report** (변경은 Spec 3 분담).
- **Invariants**:
  - I4 (read-only by default): wiki/ 변경 0. 단 `wiki/analyses/wiki-check-<date>.md` 1개 신규 생성은 허용 (analyses 는 추가 전용, schema 정합).
  - I5 (helper 재사용, v0.2 Q1 LOCK): stale tombstone detect 는 §5.16 Spec 2 의 `reconcileAfterIngest` helper 를 **dry-run mode 로 1회 명시 실행** + 결과만 report. 코드 중복 0 — helper signature 확장 없이 wrapper 가 결과 비교 (`before.tombstone=true && after.tombstone=false` 만 집계). production ingest pipeline 의 자동 reconcile 와 별 path 아님.
  - I6 (report 단일 page): finding list 를 `wiki/analyses/wiki-check-<YYYY-MM-DD>.md` 1개 페이지로 저장. 동일 일자 재실행 시 overwrite (idempotent).
- **Acceptance**:
  - **AC-C2-1**: `validate-wiki.sh` exit code 와 동일한 verdict + finding list (validate-wiki 출력 line 마다 1 finding). exit 0 = healthy, exit != 0 = finding 존재.
  - **AC-C2-2**: 실행 후 `wiki/analyses/wiki-check-<YYYY-MM-DD>.md` 자동 생성 — frontmatter `type: analysis`, 본문 4 섹션 (paired-sidecar / registry reconcile / stale tombstone / dangling cross-link).
  - **AC-C2-3**: stale tombstone detect 결과 = §5.16 Spec 2 `reconcileAfterIngest` helper return `restoredIds` 와 1:1 동치 (helper 재호출 시 동일 list). 코드 중복 0.

### Spec 3: wiki-recovery — confirm-gated fix

- **Goal**: Spec 2 의 detect 결과 (특히 §5.18 38-page dangling cross-link + stale tombstone) 를 사용자 confirm 후 fix.
- **Invariants**:
  - I7 (confirm 의무): 모든 destructive 변경 (tombstone 복구 / wiki page block 제거 / paired sidecar reindex / dangling cross-link 제거) 은 사용자 명시 confirm. silent fix 0.
  - I8 (log entry 정합): fix 결과 → `wiki/log.md` ingest 동급 entry (§5.11 v2 의미 재정의 호환 — 지식 변경 log 만).
  - I9 (§5.18 case use case): `sha256:679cf2dd6db75e3a` 38-page dangling 의 cleanup = 본 Spec 의 첫 실 use case. frontmatter `sources:` + 본문 `[[...]]` 양쪽에서 dangling reference 제거. 본 reference 가 유일 근거인 주장은 "근거 소스 삭제됨" 표시 (schema 워크플로우 4 정합).
- **Acceptance**:
  - **AC-W3-1 (§5.18 use case)**: `sha256:679cf2dd6db75e3a` 38 page 에서 frontmatter `sources:` 의 해당 sha256 제거 + 본문 `[[source-...]]` 제거 (또는 "근거 삭제됨" 변환) → 후속 wiki-check 결과 `danglingCrossLinkCount` = 0 (또는 38 감소).
  - **AC-W3-2 (silent fix 0)**: confirm UI 없이는 fix 0 변경. 자동 batch mode X.
  - **AC-W3-3 (log entry 정합)**: `wiki/log.md` 에 `## [YYYY-MM-DD] lint-fix | wiki-recovery` entry 추가 (§5.11 v2 ingest 동급 format).

### Spec 4: wiki-refactoring — suggestion only

- **Goal**: schema-driven 정리 *suggestion* — duplicate entity merge 후보 + low-utility analyses archive 후보. 자동 변경 0.
- **Invariants**:
  - I10 (suggestion only): 자동 변경 0. 사용자 명시 클릭 액션 필요.
  - I11 (signal 명시): suggestion 근거 (signal) 명시 — duplicate entity = canonical slug similarity ≥ threshold / low-utility = backlink 0 + 30일+ 미수정.
  - I12 (threshold default, v0.2 Q3 LOCK): duplicate entity slug similarity threshold **0.85 default** (canonicalizer `SLUG_ALIASES` 동일 threshold 정합). 사용자 override 는 `.wikey/refactoring.yaml` 의 `duplicate.similarity_threshold: <float>` 으로 가능 (별 파일, schema.yaml 안 두지 않음 — PII engine 분리 패턴 동일).
- **Acceptance**:
  - **AC-R4-1**: suggestion list modal — duplicate entity 후보 + low-utility analyses 후보 양 카테고리 각 N row, clickable (wiki page navigation).
  - **AC-R4-2**: 자동 변경 0 — modal 닫기 시 wiki/ 변경 0. 사용자가 row 클릭 → wiki page open 만.
  - **AC-R4-3**: similarity threshold 0.85 default 적용. `.wikey/refactoring.yaml` 가 존재하면 override (parse fail 시 fallback default + WARN).

### 1.5 UI flow specs (v0.2 신규, 사용자 LOCK 2026-05-12)

각 maintenance script 의 진입점 = Help 패널 안 "Wiki Maintenance" 섹션 버튼 4개. Modal 단일 컴포넌트 (`MaintenanceModal`), action 별 mode prop 로 분기. Dashboard health row 는 display only.

- **AC-UI-1 (Help 패널 섹션)**: Help 패널 안에 신규 "Wiki Maintenance" 섹션 + 4 버튼 (Status / Check / Recovery / Refactoring suggestions). 기존 Help guide markdown 과 공존 (별 markdown block).
- **AC-UI-2 (Modal 단일 컴포넌트)**: 버튼 클릭 → `MaintenanceModal` open (`new MaintenanceModal(app, plugin, { mode: 'status' | 'check' | 'recovery' | 'refactoring' }).open()`). 4 mode 모두 동일 컴포넌트, mode prop 으로 분기.
- **AC-UI-3 (Modal 안 progress 영역)**: Modal 안 progress text + log tail (scrollable). `validate-wiki.sh` / script stdout 을 stream tail (line 단위 append, `Notice` 사용 X). check / recovery / refactoring 의 진행 중 stage 명시.
- **AC-UI-4 (finding action 분기)**: 결과 finding 발견 시 modal 하단 action 버튼 출현 — `Apply fix` (recovery 분기), `Open page` (refactoring suggestion row click), 또는 `Close` (finding 0 또는 status mode). finding 0 시 "All healthy" 메시지 + Close 버튼만.
- **AC-UI-5 (in-modal step 진행)**: Apply fix 클릭 시 **같은 modal 안에서 step 2 progress** (별 modal open X). step 1 finding list → step 2 confirm checkbox → step 3 fix progress + result. modal stack X.
- **AC-UI-6 (abort)**: modal close 시 진행 중 작업 abort (`AbortController` signal). 미완료 (script subprocess running) 시 confirm dialog ("작업이 진행 중입니다. 중단하시겠습니까?"). subprocess SIGTERM → 5s timeout 후 SIGKILL.

## 2. Out of Scope

- Knowledge Gap 자동 리포트 (§5.20 별 cycle).
- 자동 cron / scheduler — 본 cycle 은 manual command (v0.2 Q4 LOCK out of scope). 자동 scheduling 은 후속 candidate.
- wiki-recovery 의 fully-automated mode (Karpathy #3 Surgical Changes — 변경은 사용자 확정).
- `validate-wiki.sh` 본문 수정 — 호출만 (v0.2 Karpathy #3 Surgical Changes).
- Dashboard health row 의 click action 으로 maintenance script 직접 실행 (display only, Help 패널 navigation 만).
- Command palette 등록 — 부가 진입점 (legacy / power user 용 1줄 추가). 1차 UX = Help 패널 버튼.

## 3. Dependencies

- `scripts/validate-wiki.sh` — Spec 2 통합 진입점 (호출만, 본문 수정 X).
- `scripts/audit-ingest.py` — paired-sidecar audit (호출).
- `wikey-core/src/source-registry.ts:reconcileAfterIngest` — §5.16 Spec 2 helper 재사용 (dry-run mode).
- `wikey-obsidian/src/commands.ts` — 4 부가 command 등록 (Command palette 용, ≤ 60 LOC).
- `wikey-obsidian/src/sidebar-chat.ts` — Help 패널 "Wiki Maintenance" 섹션 + Dashboard health row (display only).
- 신규 `scripts/wiki-check.sh` — validate-wiki + paired-sidecar audit + reconcile dry-run + dangling detect (≤ 100 LOC).
- 신규 `scripts/wiki-recovery.sh` — confirm-gated fix (≤ 100 LOC, stdin confirm protocol).
- 신규 `scripts/wiki-refactoring.sh` — suggestion only (≤ 100 LOC).
- 신규 `wikey-core/src/wiki/maintenance/*.ts` (helpers / status / check / recovery / refactoring — 각 ≤ 250 LOC, monolith 분할 v0.3).
- 신규 `wikey-obsidian/src/maintenance-modal.ts` + `maintenance-modal-views.ts` (각 ≤ 200 LOC, v0.3 split).
- 신규 `wikey-obsidian/src/maintenance-runner.ts` — Help 패널 + palette 4 command 공용 runner factory (v0.3 cycle #3).
- 신규 `wikey-obsidian/styles.css` patch — modal css (`.wikey-maintenance-modal-*`, ≤ 110 LOC — 다중 modal 토큰 + cycle #3 step-2 confirm view).

## 4. 진행 순서 (SDD+TDD)

- **Step A (analyst v0.2)**: ✅ 완료 (2026-05-12) — 8 핵심 결정 (A~H) LOCK + AC 1:1 매핑 + UI 흐름 명시.
- **Step B (tester RED)**: 신규 test 5 file —
  - `wiki-status.test.ts` (AC-S1-1, AC-S1-2 cache TTL),
  - `wiki-check.test.sh` (AC-C2-1~3),
  - `wiki-recovery.test.ts` (AC-W3-1~3, §5.18 fixture 사용),
  - `wiki-refactoring.test.ts` (AC-R4-1~3),
  - `maintenance-modal.test.ts` (AC-UI-1~6 — Help 섹션 + Modal mode 분기 + abort).
- **Step C (developer GREEN)**: 4 script + maintenance.ts + MaintenanceModal + Help 패널 섹션 + Dashboard row + 4 command 등록.
- **Step D — Phase 3a 회귀**: `npm test` (wikey-core + wikey-obsidian) + `npm run build` + `./scripts/validate-wiki.sh` 모두 PASS.
- **Step E — Phase 3b BLUE refactor (의무, CLAUDE.md SDD+TDD §3a/3b)**: cache helper extract / modal mode 분기 가독성 / script common header (set -e + trap) 추출 / 회귀 PASS 반복.
- **Step F — codex post-impl review**: spec ↔ test ↔ impl 4중 정합 review (cmux Mode D Panel).
- **Step G (master 라이브 smoke)**:
  - Help 패널 Status 버튼 → Modal → 6 metric 표시 확증 (`danglingCrossLinkCount=38` from §5.18 case).
  - Help 패널 Check 버튼 → Modal progress → finding list (38 dangling) + Apply fix 버튼 출현 확증.
  - Apply fix → in-modal step 2 confirm → step 3 fix progress → result `danglingCrossLinkCount: 38 → 0`.
  - Help 패널 Refactoring 버튼 → suggestion list modal + row click → wiki page open (자동 변경 0 확증).
  - Dashboard health row display only 확증 (click → Help maintenance 섹션 navigation 만).

## 5. 변경 이력

- v0.3 (2026-05-12): master LOC budget realistic adjustment (cosmetic, AC 영향 0). maintenance.ts monolith → `maintenance/*.ts` 5 module split (각 ≤ 250 LOC) + maintenance-modal.ts split → `maintenance-modal-views.ts` (각 ≤ 200 LOC) + maintenance-runner.ts 공용 factory + styles.css patch ≤ 90 LOC. 17 AC / UI flow / Specs 본문 변경 0.
- v0.1 (2026-05-11): draft 신규.
- v0.2 (2026-05-12): analyst LOCK, 8 핵심 결정:
  - A. §5.16 reference 정정: 모든 "Spec 3 stale tombstone" → "**Spec 2 (B2) stale tombstone**" (Spec 3 은 B3 Panel refresh).
  - B. Q1 LOCK: wiki-check 가 §5.16 Spec 2 `reconcileAfterIngest` helper dry-run 재사용 (코드 중복 0). production ingest 의 자동 reconcile 와 별 path 아님.
  - C. Q2 LOCK: wiki-status 5분 TTL in-memory cache + Dashboard mount + Modal "Refresh" 버튼 invalidate.
  - D. Q3 LOCK: duplicate entity slug similarity threshold **0.85 default** (canonicalizer SLUG_ALIASES 정합) + `.wikey/refactoring.yaml` override.
  - E. Q4 LOCK: 자동 cron out of scope (manual command 만).
  - F. §5.18 dangling cross-link (`sha256:679cf2dd6db75e3a` 38 page) = wiki-recovery 첫 실 use case 명시.
  - G. AC 정량 1:1 매핑: 4 Spec AC = 11 + UI 6 = **17 정량 AC** (S1-1/S1-2 / C2-1/C2-2/C2-3 / W3-1/W3-2/W3-3 / R4-1/R4-2/R4-3 / UI-1~6).
  - H. 신규 UI 흐름 LOCK (사용자 2026-05-12): Help 패널 4 버튼 = 1차 진입점 / Dashboard row = display only / Command palette = 부가 / 단일 `MaintenanceModal` (mode prop) + in-modal action 분기 / abort (AbortController).
