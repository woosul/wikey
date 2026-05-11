---
phase: 5
section: 5.16
title: Audit / Ingest panel refresh reliability + sidecar pair label 회귀 fix (Spec)
status: draft
created: 2026-05-11
updated: 2026-05-11
version: v0.3
---

# Phase 5 §5.16 Audit / Ingest panel refresh reliability + sidecar pair label 회귀 fix (Spec, WHAT)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.16`](./phase-5-todo.md) · [`plan/phase-5/phase-5-todox-5.16-audit-refresh-reliability.md`](./phase-5-todox-5.16-audit-refresh-reliability.md) (Todo, HOW — mirror)
>
> **버전 이력**:
> - v0.1 (2026-05-11): draft 신규 (사용자 보고 1-1·1-2·1-4 통합).
> - v0.2 (2026-05-11): Step "1" obsidian-cdp master test 결과 반영 — B1 (hasSidecar set mismatch), B2 (stale tombstone reconcile race), B3 (refresh trigger 누락) 3 결함 분리. 정확한 코드 위치 + AC 1:1 매핑.
> - v0.3 (2026-05-11): codex post-impl review (cycle #1, VERDICT: NEEDS_REVISION) 5 finding closure 반영.
>   - HIGH/MED finding 1+2 (B2 production hook + reconcileAfterIngest production-dead at 24d4fa5): commit `8c087aa` (B2 ingest hook 통합 + badge color follow-up) 으로 closure. AC-7 / I6 / I11 = production path 활성.
>   - MED finding 3 (AC mapping weakness): AC mapping 명시 — unit test 의 AC 는 helper contract / branch invariant 만 cover. 실 ingest 호출 분기에서의 hook 발화 + refresh trigger 발화 = 라이브 Step G smoke 로 보강 (별 integration AC 추가 안 함, Karpathy Simplicity First).
>   - LOW finding 4 (line drift): 본 spec 의 코드 위치 인용은 fix *후* HEAD 기준 line 번호로 갱신 — `sidebar-chat.ts:204` (`buildAuditLookupAllSet` 정의) + `:1167`/`:1275` (hasSidecar 호출), `source-registry.ts:339-353` (case 4 implementation).
>   - LOW finding 5 (numeric drift): result doc v1.1 에서 산술 정정 — `Ingested 11 → 14 (+3)` = 2 stale tombstone restore + 1 newly registered PMS PDF record (registry first_seen=2026-05-11 의 신규 record).

## 0. Context

**도출 source**: 사용자 본체 완성 시점 테스트 (2026-05-11) 보고 1-1·1-2·1-4 + Step "1" master raw evidence (`scripts/audit-ingest.py --json` + `.wikey/source-registry.json` + disk inspection).

**Step "1" raw evidence 종합** (2026-05-11):

| 항목 | 측정값 | 결론 |
|------|--------|------|
| Registry 총 records | 14 | — |
| Tombstoned (실 disk 존재) | **2/14** (case A MarkItDown / case B HWP — 둘 다 disk 존재) | **stale tombstone** |
| PMS registry tombstone | False | live ✅ |
| PMS disk PDF + sidecar | 모두 존재 | 정상 ✅ |
| `audit-ingest.py ingested_files` PMS 포함 여부 | 포함 ✅ | 정상 |
| `audit-ingest.py entries[]` PMS sidecar status | `missing` | sidebar-chat 의 paired dedup 처리 대상 |
| `auditData.files` (post-applyPairedSidecarToAudit) sidecar 포함 | **포함 X** (dedup 결과) | 정상 |
| `auditAllSet` (v0.2 evidence, pre-fix sidebar-chat.ts:884; HEAD `:943` after fix) 가 sidecar 포함 | **포함 X** (auditData 기반이므로) | **결함 — hasSidecar 검사 영원히 false** |

**3 결함 분리** (v0.2 신규 / line 인용 = pre-fix v0.2 evidence; HEAD line 은 §5 변경 이력 v0.3 참조):

- **B1 `hasSidecar` set mismatch**: pre-fix v0.2 evidence — `wikey-obsidian/src/sidebar-chat.ts:884` 의 `auditAllSet` 은 `auditData` (= `applyPairedSidecarToAudit(rawAudit)` 결과 = paired sidecar dedup 됨) 의 `files` / `ingested_files` / `unsupported_files` 로 구성. line 1112/1220 (pre-fix) `hasSidecar(filePath, auditAllSet)` 가 `${file}.md` (paired sidecar) 가 set에 있는지 검사 → 영원히 false → healthy badge / broken badge 양쪽 모두 미표시. (HEAD line: `:204` helper / `:943` 재할당 / `:1167`+`:1275` hasSidecar 호출).
- **B2 Stale tombstone (reconcile race)**: case A MarkItDown 109KB MD + case B HWP 스마트공장 — 둘 다 disk 파일 존재인데 `registry.tombstone=True`. `wikey-core/src/source-registry.ts` reconcile case 4 (HEAD line 339-353, v0.2 evidence prose at line 308; `restoreTombstone` — tombstoned record's hash 가 walker 출력에 등장 시 자동 복구) 가 자동 발화해야 하나 ingest pipeline 안 호출처 부재. commit `8c087aa` 으로 `runIngest` success branch 안 hook 통합.
- **B3 Panel refresh trigger 누락**: 1-2 / 1-4 의 표현 — ingest 정상 완료 후 Dashboard / Audit / Ingest 패널 미갱신. plugin reload 시 반영. `wikey-obsidian/src/commands.ts:runIngest` 완료 콜백에서 `sidebar-chat.refreshAuditPanel()` / `refreshDashboard()` 호출 누락 또는 호출처 trigger 회귀. commit `24d4fa5` try/finally wrapper + public refresh API.

**이득 (fix 후)**:
- 정량 — paired sidecar badge 표시 정확도 100% (현 0% — 영원히 false). Audit Missing count = registry tombstone=true OR disk 미존재 만 (현 stale tombstone false positive 2건/14).
- 정량 — ingest 완료 후 panel refresh latency ≤ 1s (현 plugin reload 필요).
- 정성 — wiki page ↔ Audit ↔ Dashboard 가 single source of truth (registry + disk walker) 로 정합.
- 정성 — 사용자 신뢰 회복: plugin reload manual workaround 제거.

**Trade-off**:
- B1 fix: `auditAllSet` 을 `rawAudit` 기반으로 재구성 → variable 추가 2 (rawAudit reference 가 이미 line ~870 에 존재, scope 그대로). Karpathy #2 violations 0.
- B2 fix: reconcile case 4 (restoreTombstone) 가 ingest pipeline 의 어느 시점에 호출되는지 명시 + 호출 누락 fix. Karpathy #3 — narrow change.
- B3 fix: `runIngest` 완료 콜백 1 호출 추가 + sidebar-chat 의 refresh API export. variable 의 cache 도입 X — 매 trigger 마다 fresh `loadAuditScriptOutput` spawn 유지.

## 1. Specs

### Spec 1: B1 — `hasSidecar` set 정합 (paired sidecar badge 복구)

- **Goal**: paired sidecar 가 disk 에 존재하는 모든 raw 원본 row 가 sidebar Audit/Ingest 패널에서 `md` badge (healthy=orange / broken=red — v0.3 사용자 결정) 정확 표시.
- **Inputs**:
  - `rawAudit: AuditScriptOutput` — `loadAuditScriptOutput` 결과 (paired sidecar dedup 전, raw).
  - `auditData: AuditScriptOutput` — `applyPairedSidecarToAudit(rawAudit)` 결과 (paired dedup 후, 화면 행 enumeration 용).
- **Outputs**:
  - Audit 패널의 각 raw 원본 row에 `md` badge — `hasSidecar(filePath, rawAuditAllSet)` true 시.
  - `isBroken` 분기 (`!ingestedSet.has(filePath)`) — broken=red badge.
- **Invariants**:
  - I1 (set basis): `hasSidecar` 의 두 번째 인자 = `rawAudit.files ∪ rawAudit.ingested_files ∪ rawAudit.unsupported_files` (paired dedup *전*). `auditData` 기반 set 사용 금지.
  - I2 (badge presence): `hasSidecar(file, rawAuditAllSet) == true` 인 모든 row 는 `md` badge DOM 노드 1개 생성.
  - I3 (badge color, v0.3 사용자 결정 normalize): `ingestedSet.has(file) == true` → orange `wikey-pair-sidecar-badge` (`--wk-color-status-warning`). false → red `wikey-pair-sidecar-badge-broken` (`--text-error`).
  - I4 (paired sidecar row dedup 유지): paired sidecar `<base>.<ext>.md` 가 row 로 별도 enumerated 되지 않음 (= 기존 §5.2.0 v4 정책 보존).
- **Acceptance Scenarios**:
  - **AC-1 PMS 케이스 (Step "1" evidence)**: rawAudit 의 `ingested_files` 에 `raw/3_resources/20_report/500_technology/PMS_제품소개_R10_20220815.pdf` + `files` 에 `..._R10_20220815.pdf.md` 양쪽 포함 → Audit row `PMS_..._R10_20220815.pdf` 의 nameWrap 안에 orange `md` badge 1개. broken-red X (ingestedSet 에 PMS PDF 포함).
  - **AC-2 broken case**: rawAudit `files` 에 sidecar `.pdf.md` 있고 `ingested_files` 에 raw PDF 누락 (ingest 결과 잃은 broken state) → red `md` badge (v0.3).
  - **AC-3 sidecar 미존재**: rawAudit `files` 에 base `.pdf` 만, sidecar `.pdf.md` 없음 → badge 미생성 (정상).
  - **AC-4 tree view**: line 1220 의 tree view 분기에서도 동일 invariant 적용.
- **Out of Scope**: Audit script output schema 변경. paired sidecar dedup 정책 변경.

### Spec 2: B2 — Stale tombstone reconcile (false tombstone 자동 복구)

- **Goal**: disk 에 파일이 존재하는 registry record 가 `tombstone=true` 상태 시, ingest pipeline / 사용자 명시 reconcile 양쪽 시점에 자동 복구.
- **Inputs**:
  - `registry: SourceRegistry` — `.wikey/source-registry.json` 로드.
  - `walker: WalkerEntry[]` — raw/ disk traversal 결과 (path + full hash).
- **Outputs**:
  - `reconciled: SourceRegistry` — case 4 (restoreTombstone) 적용 완료된 새 registry.
  - `restoredIds: string[]` — 본 reconcile 이 복구한 source_id list (telemetry / log).
- **Invariants**:
  - I5 (restoreTombstone 발화): walker 의 어떤 entry 의 hash 가 registry record (tombstone=true) 의 hash 와 일치하면 `tombstone=false` 로 갱신. `source-registry.ts:339-353` case 4 구현 (실제 line, v0.3 정정).
  - I6 (ingest pipeline 호출): `wikey-obsidian/src/commands.ts:runIngest` try block 안 success 직후 `reconcileAfterIngest` 1회 의무 발화 (commit `8c087aa` 통합 완료). 누락 시 다음 ingest 또는 plugin reload 까지 stale 잔존. error 분기는 reconcile 의무 X (fail-open).
  - I7 (idempotent): reconcile N회 연속 호출 시 결과 동일 (race 회피).
  - I8 (path mismatch 처리): walker hash match + path 가 record.vault_path 와 다르면 `recordMove` (이미 case 2 구현) 발화.
- **Acceptance Scenarios** (v0.3 AC mapping clarification — codex finding #3 closure):
  - **AC-5 helper contract case A (Step "1" evidence)**: `reconcileAfterIngest(reg, walker)` 단위 test — record `tombstone=true, hash='X', vault_path='raw/.../MarkItDown.md'` + walker `[{path:'.../MarkItDown.md', hash:'X'}]` → 결과 record `tombstone=false` + `restoredIds=[id]`. **scope: helper contract**.
  - **AC-6 helper contract case B**: HWP 스마트공장 sidecar 까지 포함 — `reconcileAfterIngest` 단위 test → tombstone=false 복구 + sidecar_vault_path 정합. **scope: helper contract**.
  - **AC-7 helper return contract**: `runIngest` 의 hook entry 가 `reconcileAfterIngest` 의 return `{registry, restoredIds}` 를 caller 가 처리할 수 있는 형식 — telemetry log 1줄 (`console.info '[Wikey] §5.16 B2 reconcileAfterIngest restored=N'`). **scope: helper contract** (실 hook 발화 = 라이브 Step G smoke).
  - **AC-8 idempotent**: reconcile 2회 연속 → 두 번째 호출의 restoredIds = []. **scope: helper contract**.
  - **AC-Live-A (integration, 라이브 Step G smoke)**: plugin reload 또는 ingest 1회 후 stale tombstone 자동 복구 — registry tombstoned 2 → 0 / Audit chip `Ingested 11 → 14 / Missing 10 → 7`. **scope: live integration**.
- **Out of Scope**: walker 자체 변경 (paired sidecar 가 walker 에 포함되는지는 기존 정책 유지). registry record 다른 필드 (`duplicate_locations` 등) 변경. 별 integration test (Karpathy Simplicity First — mock test 대신 라이브 Step G smoke 로 보강).

### Spec 3: B3 — Panel refresh trigger 정합

- **Goal**: ingest pipeline 완료 (성공 / 실패 / cancel 분기 모두) 후 sidebar-chat 의 Audit / Ingest / Dashboard 패널이 자동 re-render.
- **Inputs**:
  - `runIngest` (commands.ts) 의 완료 콜백.
  - `WikeyChatView.refreshAuditPanel()` / `refreshDashboard()` 의 public API (신규 export 또는 기존).
- **Outputs**:
  - 패널 DOM 갱신: ingested → missing row 이동, paired sidecar badge 신규 표시.
- **Invariants**:
  - I9 (호출 완전성): `runIngest` 의 success / error / cancel 분기 양쪽 모두에서 refresh API 호출.
  - I10 (fresh spawn): refresh 시 `loadAuditScriptOutput` 가 항상 fresh subprocess spawn (cache 0). subprocess timeout ≤ 5s, fail 시 stale-display + WARN.
  - I11 (reconcile 후 refresh): Spec 2 의 reconcile 가 ingest 완료 hook 안에서 발화하면, refresh trigger 는 reconcile 직후 호출 (registry 최신 상태로 패널 갱신).
- **Acceptance Scenarios** (v0.3 AC mapping clarification — codex finding #3 closure):
  - **AC-9 helper contract (Happy path)**: `triggerPanelRefresh(view)` 단위 test — view.refreshAuditPanel + view.refreshDashboard spy 가 정확히 1회 호출. **scope: helper contract**.
  - **AC-10 helper contract (overwrite branch)**: 동일 helper contract — overwrite 분기 모방 시나리오 spy 검증.
  - **AC-11 helper contract (Cancel branch)**: 동일 helper contract — cancel 분기 모방 spy 검증.
  - **AC-12 helper contract (Error branch)**: 동일 helper contract — error 분기 모방 spy 검증.
  - **AC-Live-B (integration, 라이브 Step G smoke)**: 라이브 ingest cycle (Audit → Ingest → Processing → Preview → Approve & Write → Write 완료) 후 panel 자동 refresh + paired sidecar badge 표시. **scope: live integration** (별 mock test 없이 라이브 smoke 로 보강).

### Spec 4 (옵션): wiki/sources tombstone block stale cleanup

- **Goal**: registry record `tombstone=false` 이고 disk 존재인데, 대응 wiki/sources/source-*.md 의 banner 가 "원본 삭제됨 (YYYY-MM-DD)" 메시지 잔존 시 cleanup.
- **결정 (Step "1" 후)**: PMS 케이스에서 wiki/sources/source-lotus-pms-product-intro.md 본문 grep 결과 "원본 삭제" 텍스트 *없음*. 사용자 캡처는 plugin runtime banner (registry.tombstone 기반 view) → Spec 2 의 stale tombstone 복구 시 banner 자동 사라짐. **별 cleanup 불필요**. Spec 4 = out of scope.

## 2. Out of Scope

- Audit script `audit-ingest.py` 의 4-tier matching 재설계 (§5.15.D 8555255 commit 정책 유지).
- audit script subprocess cache layer (별 cycle, §5.19 maintenance suite candidate).
- Phase 6 web UI audit/refresh.
- paired sidecar dedup 정책 변경.
- registry schema 변경.

## 3. Dependencies

- `wikey-obsidian/src/sidebar-chat.ts` — `buildAuditLookupAllSet` 정의 `:204` / `auditAllSet` 재할당 `:943` / `hasSidecar` 호출처 `:1167`+`:1275` (HEAD line, v0.3 정정).
- `wikey-core/src/source-registry.ts:339-353` reconcile case 4 implementation (v0.3 정정 line).
- `wikey-obsidian/src/commands.ts:runIngest` — try block 안 `runReconcileAfterIngest(plugin)` success-gated 호출 (v0.3 cycle #2 finding #1 closure).
- `wikey-obsidian/src/sidebar-chat.ts` — public refresh API (`refreshAuditPanel()` / `refreshDashboard()`).
- `wikey-obsidian/styles.css` — badge color (healthy=orange `:863` / broken=red `:885`, v0.3).
- 신규 test: `paired-sidecar.test.ts` (AC-1~AC-4) / `source-registry-reconcile.test.ts` (AC-5~AC-8) / `sidebar-chat-refresh.test.ts` (AC-9~AC-12).

## 4. 진행 순서 (SDD+TDD)

- **Step A — analyst v0.3** (선택): codex Mode D Panel review 의뢰 시 보강. 본 v0.2 = master 직접 evidence-based 작성.
- **Step B — tester RED**: 위 11 AC (AC-1~AC-12, AC-13 결번) 의 1:1 test 작성, 모두 RED 확증.
- **Step C — developer GREEN**: B1/B2/B3 minimal fix.
  - B1: sidebar-chat.ts:884 `auditAllSet` → rawAudit 기반 재구성 (~5 LOC).
  - B2: ingest-pipeline.ts 의 reconcile 호출 hook 추가 또는 발화 시점 fix (~10 LOC). `case 4 restoreTombstone` 의 ingest hook 발화 validation.
  - B3: commands.ts:runIngest 완료 콜백 → refreshAuditPanel + refreshDashboard 호출 (~10 LOC).
- **Step D — Phase 3a 회귀**: `npm test` (wikey-core + wikey-obsidian) + `npm run build` + `./scripts/validate-wiki.sh` 모두 PASS.
- **Step E — Phase 3b BLUE**: refresh trigger helper extract (3 호출처 dedup), reconcile 호출 시점 주석 명시.
- **Step F — codex post-impl review** (cmux Mode D): spec ↔ test ↔ impl 4중 정합 review.
- **Step G — master 라이브 cycle smoke (obsidian-cdp)**:
  - PMS 케이스 — Audit 패널의 PMS PDF row 에 gray `md` badge 표시 확증.
  - case A/B 재 ingest → registry tombstone=false 자동 복구 확증.
  - ingest 후 panel 자동 refresh 확증 (plugin reload 없이 row 이동).

## 5. 변경 이력

- v0.1 (2026-05-11): draft 신규.
- v0.2 (2026-05-11): Step "1" master raw evidence 반영. B1/B2/B3 3 결함 분리, 11 AC (AC-1~AC-12) 1:1 매핑. Spec 4 (wiki page cleanup) out of scope 결정 (registry tombstone 복구 시 banner 자동 사라짐).
- v0.3 (2026-05-11): codex post-impl review (cycle #1) 5 finding closure 반영.
  - Finding 1+2 (HIGH/MED B2 production hook): commit `8c087aa` 으로 closure — `commands.ts:runIngest` try block 안 `reconcileAfterIngest` 호출 통합. I6 production path 활성.
  - Finding 3 (MED AC mapping): AC 분리 명시 — AC-5~12 = helper/branch contract scope, AC-Live-A/B = live integration scope (라이브 Step G smoke 로 보강, 별 mock integration test 추가 안 함).
  - Finding 4 (LOW line drift): 코드 위치 인용 정정 — `source-registry.ts:339-353` (case 4 실제 line) / `sidebar-chat.ts:204/943/1167/1275` (helper 정의 + auditAllSet 재할당 + hasSidecar 호출 2곳).
  - Finding 5 (LOW numeric drift): result doc v1.1 산술 정정 — `Ingested 11 → 14 (+3) = 2 stale tombstone restore + 1 PMS PDF newly registered record`.
