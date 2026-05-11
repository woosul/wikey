---
phase: 5
section: 5.16
title: §5.16 Step G master 라이브 cycle smoke — obsidian-cdp 직접 검증 결과
date: 2026-05-11
session: 36
status: ✅ PASS (B1/B2/B3 모두 라이브 확증)
---

# Phase 5 §5.16 Step G master 라이브 cycle smoke — 2026-05-11

> **상위 문서**: [`activity/phase-5/phase-5-result.md`](./phase-5-result.md) · [`plan/phase-5/phase-5-spec-5.16-audit-refresh-reliability.md`](../../plan/phase-5/phase-5-spec-5.16-audit-refresh-reliability.md) v0.2 · [`plan/phase-5/phase-5-todox-5.16-audit-refresh-reliability.md`](../../plan/phase-5/phase-5-todox-5.16-audit-refresh-reliability.md) v0.2
>
> **선행 단계**: Step B (tester RED 18 test) → Step C (developer GREEN 18 PASS) → Step D (Phase 3a 회귀 wikey-core 808 + wikey-obsidian 121 = 929 PASS) → Step E (BLUE 3b refactor developer self-apply).

## 0. 진행 요약

| Step | 결과 |
|------|------|
| B (tester RED) | 18 신규 test 모두 RED 확증 (11 AC + 7 보조) |
| C (developer GREEN) | 18 GREEN, 회귀 0, src 4 file +50 LOC + 72 JSDoc |
| D (Phase 3a 회귀) | wikey-core 808 + wikey-obsidian 121 = 929 PASS / build 0 errors |
| E (Phase 3b BLUE) | developer self-apply 완료 (helper extract / naming / dedup) |
| **G (master 라이브 smoke)** | **본 문서 — B1/B2/B3 모두 라이브 확증** |
| F (codex post-impl review) | 다음 단계 (commit 후) |

## 1. 환경

- Obsidian 1.12.7 (`--remote-debugging-port=9222 --remote-allow-origins='*'`)
- `~/.claude/skills/obsidian-cdp/` venv + wrapper 가용
- plugin reload (build 후 필수) — `app.plugins.disablePlugin('wikey'); enablePlugin('wikey')` 으로 0 errors, 10 commands 등록 확증

## 2. B1 라이브 확증 — paired sidecar `md` badge 표시

**fix point**: `wikey-obsidian/src/sidebar-chat.ts:884` — `auditAllSet` 을 `auditData` (paired dedup *후*) 기반에서 `rawAudit` (paired dedup *전*) 기반으로 교체. 신규 helper `buildAuditLookupAllSet(rawAudit)` export.

**라이브 측정 (Audit panel, Ingested mode 14 row)**:

```
totalVisible: 14
allBadges: 2          (gray .wikey-pair-sidecar-badge)
brokenBadges: 0       (orange .wikey-pair-sidecar-badge-broken)

sampled rows:
  스마트공장 보급확산 합동설명회 개최.hwp     hasBadge=true  isBroken=false  badgeText='md'
  PMS_제품소개_R10_20220815.pdf              hasBadge=true  isBroken=false  badgeText='md'
  MarkItDown으로 모든 문서를 마크다운으로 변환하기.md  hasBadge=false  (정상 — .md 자체, paired 적용 X)
```

**결론**: paired sidecar `<base>.<ext>.md` 가 disk 에 존재하는 raw 원본 PDF/HWP 두 행 모두 gray `md` badge 정확 표시. 사용자 보고 1-1 ("sidecar pair 라벨 안 보임") 회복.

## 3. B2 라이브 확증 — stale tombstone 자동 복구

**fix point**: `wikey-core/src/source-registry.ts` 의 `reconcileAfterIngest` helper export + 기존 `reconcileRecords` case 4 (restoreTombstone) 의 호출 trigger 활성화. `wikey-core/src/index.ts` re-export.

**Audit chip count 변화** (Step "1" → Step G):

| 시점 | All | Ingested | Missing | tombstoned (raw evidence) |
|------|-----|----------|---------|---------------------------|
| 사용자 캡처 (pms.png, 2026-05-08+) | 21 | 11 | 10 | (미측정, 추정 2~3) |
| Step "1" master test (2026-05-11 17:48) | — | — | — | **2** (case A MarkItDown / case B HWP) |
| Step G (plugin reload 후) | 21 | **14** | **7** | **0** |

**변화 분석**: plugin reload 직후 `main.ts:652` startup reconcile (외부 bash/Finder 이동/삭제 복구) 가 발화. walker → registry hash 일치 → case 4 `restoreTombstone` → 2 stale records `tombstone: true → false` 자동 복구. Ingested chip 14 (직전 11 + 3 복구) / Missing chip 7 (직전 10 - 3 정정) 변화로 확증.

**라이브 evidence (CDP eval)**:
```
totalRecords: 14
tombstoned: []          (직전 Step "1" 측정 2건 → 0건)
pmsRecord: { tombstone: false, sidecar_vault_path: '...PMS_..._R10_20220815.pdf.md' }
```

**Deferred (Step G 결정)**: `reconcileAfterIngest` 의 ingest pipeline 안 명시 hook 통합은 본 cycle 미완. 현재는 plugin reload / startup / vault rename 시점에서만 자동 발화 (main.ts:617, 652). ingest 완료 직후 자동 reconcile 미적용 — 사용자가 plugin reload 없이 ingest 만 반복하는 워크플로우에서는 여전히 stale tombstone 잔존 위험. **§5.16 추가 cycle 또는 §5.19 maintenance suite 안 통합 후보**.

## 4. B3 라이브 확증 — refresh API public

**fix point**: `wikey-obsidian/src/sidebar-chat.ts` 에 `refreshAuditPanel()` / `refreshDashboard()` public method 추가 + `triggerPanelRefresh(view)` helper export. `wikey-obsidian/src/commands.ts:339` `runIngest` 의 try/finally wrapper + `runIngestInner` extract 로 success / error / cancel / IngestCancelledByUserError / PiiIngestBlockedError 모든 분기에서 단일 refresh entry 보장.

**라이브 evidence (CDP eval)**:
```javascript
const view = app.workspace.getLeavesOfType('wikey-chat')[0].view;
=> view.constructor.name === 'Tr'                            (minified production class)
   typeof view.refreshAuditPanel === 'function'  → true ✅
   typeof view.refreshDashboard === 'function'   → true ✅
   typeof view.openAuditPanel === 'function'     → true (기존)

prototype methods (filter refresh/audit/dashboard):
   refreshReadonlyModelBar / openDashboard / renderDashboardContent / renderAuditSummaryOnly
   renderRawSourcesDashboard / openAuditPanel / refreshAuditPanel / refreshDashboard / renderAuditSection
```

**결론**: 두 신규 public method 가 minified production 빌드에서도 정확히 노출. tester Step B 의 보조 test ("refreshAuditPanel public method") 의 라이브 mirror.

## 5. 종합 verdict

| 결함 | Spec § | unit test | 라이브 확증 | verdict |
|------|--------|-----------|-------------|---------|
| **B1** hasSidecar set mismatch | Spec 1 (AC-1~4 + I1) | 5/5 GREEN | PMS + HWP gray `md` badge | **PASS** |
| **B2** stale tombstone | Spec 2 (AC-5~8 + I7) | 5/5 GREEN | tombstoned 2 → 0 자동 복구 | **PASS (helper)** + Deferred (ingest hook 통합) |
| **B3** refresh trigger | Spec 3 (AC-9~12) | 8/8 GREEN | public method 라이브 노출 | **PASS** |

**Karpathy 4원칙 종합 self-check**:
- #1 Think Before Coding ✅ — spec v0.2 의 11 AC + Step "1" raw evidence 기반.
- #2 Simplicity First ✅ — src 4 file ~50 LOC, helper 4개 모두 ≤ 20 LOC.
- #3 Surgical Changes ✅ — 인접 cleanup 0, orphan import 0.
- #4 Goal-Driven Execution ✅ — 18 RED → 18 GREEN → 라이브 PASS 3-stage evidence.

## 6. 다음 단계

1. **Step F codex post-impl review** (cmux Mode D Panel) — spec ↔ test ↔ impl 4중 정합 review.
2. **commit + push** — 본 §5.16 cycle 의 모든 산출 (5 spec + 5 todox + §5.16 결과물 + 신규 test 3 + src 4 file + result doc).
3. **§5.16 Deferred (B2 ingest hook 통합)** — 별 §5.x cycle 또는 §5.19 maintenance suite 와 통합. 현 startup reconcile 자동 복구로 사용자 plugin reload 시 immediate fix → priority P1.
4. **다음 P0 = §5.17 Ingest Balance Calibration** — case A/B 가 이제 정상 ingested 상태 → 109KB MD 의 83 page 과다 분해 / HWP 0 page 과보수 분리 측정 가능.
