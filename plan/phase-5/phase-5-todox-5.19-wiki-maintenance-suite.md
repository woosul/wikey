# Phase 5 §5.19 Wiki maintenance suite — Todo (HOW)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.19`](./phase-5-todo.md) · [`plan/phase-5/phase-5-spec-5.19-wiki-maintenance-suite.md`](./phase-5-spec-5.19-wiki-maintenance-suite.md)
>
> **버전**: v0.2 (2026-05-12) — analyst LOCK, Q1~Q4 모두 LOCK, 신규 UI 흐름 (Help 패널 버튼 → MaintenanceModal) 반영.

## 진행 매트릭스 (Step A~G)

- [x] **Step A — analyst v0.2** (2026-05-12): §5.16 reference 정정 (Spec 3 → Spec 2 B2) + 4 command 분기 LOCK + Q1~Q4 LOCK + 신규 UI 흐름 LOCK + AC 17개 1:1 매핑.
- [ ] **Step B — tester RED**: 5 신규 test file (wiki-status / wiki-check / wiki-recovery / wiki-refactoring / maintenance-modal).
- [ ] **Step C — developer GREEN**:
  - `scripts/wiki-check.sh` 신규 (validate-wiki + paired-sidecar + reconcile dry-run + dangling detect).
  - `scripts/wiki-recovery.sh` 신규 (confirm-gated fix, stdin confirm protocol).
  - `scripts/wiki-refactoring.sh` 신규 (suggestion only).
  - `wikey-core/src/wiki/maintenance.ts` 신규 — `getWikiStatus()` + 5분 TTL cache + dangling cross-link detect helper.
  - `wikey-obsidian/src/maintenance-modal.ts` 신규 — 단일 컴포넌트, mode prop ('status' | 'check' | 'recovery' | 'refactoring') 분기.
  - `wikey-obsidian/src/sidebar-chat.ts` — Help 패널 "Wiki Maintenance" 섹션 (4 버튼) + Dashboard health row (display only).
  - `wikey-obsidian/src/commands.ts` — 4 부가 command 등록 (palette legacy 진입점).
  - `wikey-obsidian/styles.css` — modal css patch.
- [ ] **Step D — Phase 3a 회귀**: `npm test` + `npm run build` + `./scripts/validate-wiki.sh` 모두 PASS.
- [ ] **Step E — Phase 3b BLUE** (의무, CLAUDE.md SDD+TDD §3a/3b): cache helper extract / modal mode 분기 가독성 / script common header (set -e + trap) / 회귀 PASS 반복.
- [ ] **Step F — codex post-impl review** (cmux Mode D Panel).
- [ ] **Step G — master 라이브 smoke**: 사용자 vault 4 button (Status / Check / Recovery / Refactoring) 실 실행. §5.18 38-page dangling cleanup 1차 use case 검증.

## 의문점 LOCK (Step A 완료)

- **Q1 (흡수 결정)** ✅ LOCK: wiki-check 가 §5.16 Spec 2 (B2) `reconcileAfterIngest` helper 를 **dry-run mode 로 재사용**. 코드 중복 0. production ingest pipeline 의 자동 reconcile 와 별 path 아님 (single maintenance entrypoint, 명시 1회 실행 + report).
- **Q2 (wiki-status cache)** ✅ LOCK: **5분 TTL in-memory cache**. Dashboard mount + Help Status 버튼 + Modal "Refresh" 버튼 모두 본 cache 사용. Refresh 버튼만 강제 invalidate. 매 render spawn 시 I2 (5s budget) 위반 위험 회피.
- **Q3 (duplicate threshold)** ✅ LOCK: similarity **0.85 default** (canonicalizer SLUG_ALIASES 동일 threshold 정합). 사용자 override = `.wikey/refactoring.yaml` 의 `duplicate.similarity_threshold: <float>` (별 파일, schema.yaml 분리 — PII engine 분리 패턴 정합).
- **Q4 (자동 cron)** ✅ LOCK: 본 cycle out of scope, 후속 candidate. manual command 만.

## 신규 사용자 UI LOCK (2026-05-12, 본 v0.2 추가)

- 각 maintenance script 의 진입점 = **Help 패널 안 "Wiki Maintenance" 섹션 버튼 4개**. NOT command palette 만, NOT Dashboard pill click.
- 버튼 클릭 시 **`MaintenanceModal` open** + 진행 상황 live tail (stdout/stderr stream).
- 조치 필요 시 **동일 modal 안 추가 버튼 분기** ("Apply fix") → 같은 modal 내 step 2 progress (별 modal X).
- Dashboard health row = display only. 클릭 시 Help 패널 maintenance 섹션으로 navigation 만.
- Command palette 등록 = **부가 진입점** (legacy / power user, 1줄 추가). 1차 UX = Help 패널.

## §5.18 cross-link (v0.2 신규)

- 출처: session 37 §5.18 종결 시 `sha256:679cf2dd6db75e3a` 38-page dangling 잔존 → §5.19 wiki-recovery 의 **첫 실 use case** 로 명시.
- detect 책임 = §5.18 (Citation Registry Diagnostic Modal) / fix 책임 = §5.19 (wiki-recovery). 두 cycle 책임 분리 정합.
- Step G 라이브 smoke 의무 검증: Help 패널 Check → Modal `danglingCrossLinkCount: 38` 노출 → Apply fix → 38 → 0 확증.

## 변경 면 추정 (v0.2 신규 파일 + UI 흐름 반영)

- **신규 파일 8개**:
  - `scripts/wiki-check.sh` (≤ 100 LOC)
  - `scripts/wiki-recovery.sh` (≤ 100 LOC, stdin confirm protocol)
  - `scripts/wiki-refactoring.sh` (≤ 100 LOC)
  - `wikey-core/src/wiki/maintenance.ts` (≤ 200 LOC — `getWikiStatus()` + cache + dangling detect)
  - `wikey-obsidian/src/maintenance-modal.ts` (≤ 200 LOC — 단일 컴포넌트, mode prop 분기, AbortController)
  - `wiki-status.test.ts` (AC-S1-1 + AC-S1-2 cache TTL 2회 호출 측정)
  - `wiki-check.test.sh` / `wiki-recovery.test.ts` / `wiki-refactoring.test.ts`
  - `maintenance-modal.test.ts` (AC-UI-1~6 — Help 섹션 + 4 mode 분기 + abort)
- **기존 edit**:
  - `wikey-obsidian/src/sidebar-chat.ts` — Help 패널 `openHelp()` 안 "Wiki Maintenance" 섹션 추가 (4 버튼, ≤ 40 LOC) + Dashboard health row (≤ 30 LOC display only)
  - `wikey-obsidian/src/commands.ts` — 4 부가 command 등록 (≤ 60 LOC, palette 용)
  - `wikey-obsidian/styles.css` — `.wikey-maintenance-modal-*` css patch (≤ 40 LOC)
- **기존 file 본문 수정 금지**:
  - `scripts/validate-wiki.sh` — 호출만, 본문 수정 X (Karpathy #3 Surgical).

## AC mapping summary (Step B tester 가 1:1 RED 작성)

| AC | Spec | scope | test file |
|----|------|-------|-----------|
| AC-S1-1 | Spec 1 | helper return | wiki-status.test.ts |
| AC-S1-2 | Spec 1 | cache TTL 5분 / hit ≤ 50ms | wiki-status.test.ts |
| AC-C2-1 | Spec 2 | validate-wiki exit + finding list | wiki-check.test.sh |
| AC-C2-2 | Spec 2 | analyses page 자동 생성 | wiki-check.test.sh |
| AC-C2-3 | Spec 2 | reconcileAfterIngest helper 재사용 1:1 | wiki-check.test.sh |
| AC-W3-1 | Spec 3 | §5.18 38-page dangling cleanup | wiki-recovery.test.ts |
| AC-W3-2 | Spec 3 | silent fix 0 | wiki-recovery.test.ts |
| AC-W3-3 | Spec 3 | log.md ingest 동급 entry | wiki-recovery.test.ts |
| AC-R4-1 | Spec 4 | suggestion list modal | wiki-refactoring.test.ts |
| AC-R4-2 | Spec 4 | 자동 변경 0 | wiki-refactoring.test.ts |
| AC-R4-3 | Spec 4 | 0.85 default + override | wiki-refactoring.test.ts |
| AC-UI-1 | UI flow | Help 패널 4 버튼 섹션 | maintenance-modal.test.ts |
| AC-UI-2 | UI flow | `MaintenanceModal` mode prop 분기 | maintenance-modal.test.ts |
| AC-UI-3 | UI flow | Modal progress + log tail stream | maintenance-modal.test.ts |
| AC-UI-4 | UI flow | finding 발견 시 Apply fix 버튼 | maintenance-modal.test.ts |
| AC-UI-5 | UI flow | in-modal step 2 진행 (별 modal X) | maintenance-modal.test.ts |
| AC-UI-6 | UI flow | abort (AbortController + SIGTERM) | maintenance-modal.test.ts |

**총 17 정량 AC** (4 Spec 11 + UI 6).

## 변경 이력

- v0.1 (2026-05-11): draft 신규.
- v0.2 (2026-05-12): analyst LOCK — Q1~Q4 모두 LOCK, §5.16 reference 정정, §5.18 dangling cross-link cross-link, 신규 UI 흐름 (Help 패널 4 버튼 + MaintenanceModal mode prop + in-modal action 분기 + abort), 17 정량 AC 1:1 매핑, 신규 파일 8개 + 기존 edit 3개 변경 면 추정.
