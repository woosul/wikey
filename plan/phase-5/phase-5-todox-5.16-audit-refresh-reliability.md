# Phase 5 §5.16 Audit / Ingest refresh reliability — Todo (HOW)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.16`](./phase-5-todo.md) (실행 단일 소스, 체크박스) · [`plan/phase-5/phase-5-spec-5.16-audit-refresh-reliability.md`](./phase-5-spec-5.16-audit-refresh-reliability.md) v0.2 (Spec, WHAT) · `plan/ref/pms.png` + `plan/ref/ingest-confilct.png` (사용자 보고 screenshots)
>
> **버전 이력**:
> - v0.1 (2026-05-11): draft (spec v0.1 mirror).
> - v0.2 (2026-05-11): spec v0.2 (B1/B2/B3 분리) mirror. Step B 진입 준비.
> - v0.3 (2026-05-11): codex review cycle #1 5 finding closure 반영. line drift 정정 + B2 hook 통합 (commit `8c087aa`) closure.

## 진행 매트릭스 (Step A~G)

- [x] **Step A — analyst v0.2 보강**: ✅ master 직접 작성 (Step "1" raw evidence 기반, spec v0.2).
- [x] **Step B — tester RED**: 11 AC (AC-1~AC-12) 1:1 test 작성, 모두 RED 확증.
  - paired-sidecar.test.ts — AC-1~AC-4 (`hasSidecar` set 정합)
  - source-registry-reconcile.test.ts — AC-5~AC-8 (stale tombstone 복구)
  - sidebar-chat-refresh.test.ts — AC-9~AC-12 (refresh trigger)
- [x] **Step C — developer GREEN**: B1/B2/B3 minimal fix.
  - B1: sidebar-chat.ts (HEAD `:943` `auditAllSet`, pre-fix `:884` v0.2 evidence) → rawAudit 기반 (~5 LOC).
  - B2: ingest-pipeline.ts reconcile hook (~10 LOC).
  - B3: commands.ts:runIngest 완료 콜백 → refresh API (~10 LOC).
- [x] **Step D — Phase 3a 회귀**: `npm test` / `npm run build` / `./scripts/validate-wiki.sh` PASS.
- [x] **Step E — Phase 3b BLUE**: refresh trigger helper extract + reconcile 호출 시점 주석.
- [x] **Step F — codex post-impl review** (cmux Mode D).
- [x] **Step G — master 라이브 cycle smoke (obsidian-cdp)**: PMS + case A/B + conflict overwrite.

## 3 결함 정확한 코드 위치 (Step C GREEN 시 참조)

### B1 — hasSidecar set mismatch (v0.3 line 번호 fix HEAD 기준)

**파일**: `wikey-obsidian/src/sidebar-chat.ts`

**현 HEAD line 번호** (v0.3 정정):
- `buildAuditLookupAllSet` 정의: line 204 (helper export).
- `auditAllSet` 재할당 (B1 fix point): line 943.
- `hasSidecar` 호출처: line 1167 (list view) + line 1275 (tree view).

**Fix 패턴** (적용 완료, commit `24d4fa5`):
```typescript
// §5.16 B1: hasSidecar lookup 은 paired dedup *전* rawAudit 기반이어야 sidecar
// `<base>.<ext>.md` 가 set 에 살아 있어 badge 매칭 성공. auditData 기반 (이전 결함)
// 은 paired sidecar 가 이미 dedup → hasSidecar 영원히 false → badge 미표시.
const auditAllSet = buildAuditLookupAllSet(rawAudit)
```

### B2 — Stale tombstone reconcile (v0.3 통합 완료 closure)

**파일**:
- `wikey-core/src/source-registry.ts:339-353` (case 4 restoreTombstone — 기존 구현, v0.3 정정 line).
- `wikey-core/src/source-registry.ts:398-413` (`reconcileAfterIngest` wrapper, commit `24d4fa5`).
- `wikey-obsidian/src/commands.ts:runIngest` try block + `runReconcileAfterIngest(plugin)` helper (commit `8c087aa`).

**Step "1" evidence (closed)**: 14 records 중 2 stale tombstone (case A MarkItDown / case B HWP 스마트공장). Step G master 라이브 smoke + commit `8c087aa` B2 hook 통합으로 ingest 직후 자동 복구 확증.

**B2 production hook 통합 (commit `8c087aa` + cycle #2 finding #1 success-gate `653c08a`)**:
```typescript
// commands.ts:runIngest try block
try {
  const result = await runIngestInner(plugin, sourcePath, onProgress, runOpts)
  // §5.16 cycle #2 finding #1 — success-gate (cancel/error 분기 reconcile skip, write-0 invariant 보존)
  if (result.success) {
    await runReconcileAfterIngest(plugin).catch(err =>
      console.warn('[Wikey] §5.16 B2 reconcileAfterIngest failed:', err))
  }
  return result
} finally { triggerPanelRefresh(getWikeyChatView(plugin)) }
```
`runReconcileAfterIngest` helper = `main.ts:runStartupReconcile` mirror (vault.getFiles() raw/ scope + 50MB cap + walker → reconcileAfterIngest → saveRegistry on change). cancel/error 분기 = reconcile skip (success-gate). fail-open (검색 영향 0).

### B3 — Panel refresh trigger 누락

**파일**: `wikey-obsidian/src/commands.ts:runIngest` 완료 콜백 + `wikey-obsidian/src/sidebar-chat.ts` (refresh API export)

**조사 필요**:
- 현 `runIngest` 의 success / error / cancel 분기에서 view refresh 가 어떤 trigger 로 발화하는지 grep.
- `WikeyChatView` 에 `refreshAuditPanel()` / `refreshDashboard()` public method 가 있는지 (없으면 신규 export).

**Fix 예상**:
```typescript
// commands.ts:runIngest 의 완료 분기 (success/error/cancel 모두):
const view = getWikeyChatView(plugin)
view?.refreshAuditPanel()
view?.refreshDashboard()
```

## 의문점 (Step B 진입 전 LOCK)

- **Q1**: B2 reconcile 호출 시점 — ingest-pipeline 완료 직후 single call vs runIngest 의 callback 에서 호출? → grep + 결정.
- **Q2**: B3 `refreshAuditPanel()` 가 현재 public 인지 — sidebar-chat.ts grep 후 결정.
- **Q3**: refresh trigger 가 fresh spawn (cache 0) 인지 확증 — `loadAuditScriptOutput` 가 매 호출 spawn.
- **Q4 (cycle #2 finding #1 closure)**: cancel/error 분기 = reconcile **skip** (success-gate). 이유: cancel 시 vault write-0 invariant (AC-C1.4) 보존 + spec wording "success 직후" 정합. stale tombstone 잔존 시 다음 ingest success 또는 plugin reload startup reconcile (`main.ts:652`) 으로 자동 복구.

## 변경 면 추정 (Karpathy #2 / #3)

- `wikey-obsidian/src/sidebar-chat.ts` — B1 (~5 LOC) + refresh API export (~10 LOC).
- `wikey-core/src/ingest-pipeline.ts` — B2 reconcile hook (~10 LOC).
- `wikey-obsidian/src/commands.ts` — B3 refresh 호출 (~10 LOC).
- 신규 test 3 file (~150 LOC).

**예상 총 변경**: src 4 file (~35 LOC) + test 3 file (~150 LOC) = 5 file. Karpathy #2 / #3 정합.

## 변경 이력

- v0.1 (2026-05-11): draft.
- v0.2 (2026-05-11): spec v0.2 mirror. Step A 완료 마킹. B1/B2/B3 코드 위치 + Fix snippet 명시.
