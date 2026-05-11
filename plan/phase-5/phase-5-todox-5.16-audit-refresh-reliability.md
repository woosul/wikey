# Phase 5 §5.16 Audit / Ingest refresh reliability — Todo (HOW)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.16`](./phase-5-todo.md) (실행 단일 소스, 체크박스) · [`plan/phase-5/phase-5-spec-5.16-audit-refresh-reliability.md`](./phase-5-spec-5.16-audit-refresh-reliability.md) v0.2 (Spec, WHAT) · `plan/ref/pms.png` + `plan/ref/ingest-confilct.png` (사용자 보고 screenshots)
>
> **버전 이력**:
> - v0.1 (2026-05-11): draft (spec v0.1 mirror).
> - v0.2 (2026-05-11): spec v0.2 (B1/B2/B3 분리) mirror. Step B 진입 준비.

## 진행 매트릭스 (Step A~G)

- [x] **Step A — analyst v0.2 보강**: ✅ master 직접 작성 (Step "1" raw evidence 기반, spec v0.2).
- [ ] **Step B — tester RED**: 11 AC (AC-1~AC-12) 1:1 test 작성, 모두 RED 확증.
  - paired-sidecar.test.ts — AC-1~AC-4 (`hasSidecar` set 정합)
  - source-registry-reconcile.test.ts — AC-5~AC-8 (stale tombstone 복구)
  - sidebar-chat-refresh.test.ts — AC-9~AC-12 (refresh trigger)
- [ ] **Step C — developer GREEN**: B1/B2/B3 minimal fix.
  - B1: sidebar-chat.ts:884 `auditAllSet` → rawAudit 기반 (~5 LOC).
  - B2: ingest-pipeline.ts reconcile hook (~10 LOC).
  - B3: commands.ts:runIngest 완료 콜백 → refresh API (~10 LOC).
- [ ] **Step D — Phase 3a 회귀**: `npm test` / `npm run build` / `./scripts/validate-wiki.sh` PASS.
- [ ] **Step E — Phase 3b BLUE**: refresh trigger helper extract + reconcile 호출 시점 주석.
- [ ] **Step F — codex post-impl review** (cmux Mode D).
- [ ] **Step G — master 라이브 cycle smoke (obsidian-cdp)**: PMS + case A/B + conflict overwrite.

## 3 결함 정확한 코드 위치 (Step C GREEN 시 참조)

### B1 — hasSidecar set mismatch

**파일**: `wikey-obsidian/src/sidebar-chat.ts`

**현 코드** (line 884~888):
```typescript
// §5.2.0 hasSidecar lookup 용 — paired 제외 후 남은 audit 파일들의 union.
const auditAllSet = new Set<string>([
  ...auditData.files,
  ...auditData.ingested_files,
  ...(auditData.unsupported_files ?? []),
])
```

**문제**: `auditData` = `applyPairedSidecarToAudit(rawAudit)` 결과 (line 876) — paired sidecar `<base>.<ext>.md` 가 이미 dedup 됨. 따라서 `auditAllSet` 에 sidecar 영원히 없음 → `hasSidecar(filePath, auditAllSet)` (line 1112, 1220) 영원히 false.

**Fix** (≤ 5 LOC):
```typescript
// §5.16 B1: hasSidecar lookup 은 paired dedup *전* set 에서 검사해야 sidecar 보임.
const auditAllSet = new Set<string>([
  ...rawAudit.files,
  ...(rawAudit.ingested_files ?? []),
  ...(rawAudit.unsupported_files ?? []),
])
```

`rawAudit` 는 line 870 `const rawAudit = loadAuditScriptOutput(...)` 으로 같은 scope. variable 추가 0.

### B2 — Stale tombstone reconcile

**파일**: `wikey-core/src/source-registry.ts:308` (case 4 — restoreTombstone 이미 구현) + `wikey-core/src/ingest-pipeline.ts` (reconcile 호출 시점)

**Step "1" evidence**: 14 records 중 2 stale tombstone (case A MarkItDown / case B HWP 스마트공장). 두 케이스 모두 disk 파일 존재, hash 일치 추정 → reconcile case 4 자동 발화해야 하나 미실행.

**조사 필요 (Step B 진입 전)**:
- `ingest-pipeline.ts` 의 `runReindexAndWait` (§5.14 layer 6) 가 reconcile 까지 포함하는지
- 별도 `reconcileRegistry(registry, walker)` 호출 hook 이 ingest 완료 후 있는지
- ingest 완료 후 reconcile 미실행이면 trigger 추가 (`reconcileRegistry` 1회 호출 ~10 LOC).

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
- **Q4**: cancel 분기 (AC-11) 의 reconcile 호출 여부 — cancel 시도 시 partial ingest 남아 있을 수 있어 reconcile 의무.

## 변경 면 추정 (Karpathy #2 / #3)

- `wikey-obsidian/src/sidebar-chat.ts` — B1 (~5 LOC) + refresh API export (~10 LOC).
- `wikey-core/src/ingest-pipeline.ts` — B2 reconcile hook (~10 LOC).
- `wikey-obsidian/src/commands.ts` — B3 refresh 호출 (~10 LOC).
- 신규 test 3 file (~150 LOC).

**예상 총 변경**: src 4 file (~35 LOC) + test 3 file (~150 LOC) = 5 file. Karpathy #2 / #3 정합.

## 변경 이력

- v0.1 (2026-05-11): draft.
- v0.2 (2026-05-11): spec v0.2 mirror. Step A 완료 마킹. B1/B2/B3 코드 위치 + Fix snippet 명시.
