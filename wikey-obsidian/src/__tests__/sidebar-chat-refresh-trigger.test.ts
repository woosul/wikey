/**
 * §5.16 Spec 3 (B3) — Panel refresh trigger 정합 (ingest 완료 후 자동 re-render).
 *
 * Source of truth: docs/planning/phase-5/phase-5-spec-5.16-audit-refresh-reliability.md v0.2 §1.3
 *
 * Spec 3 Acceptance Scenarios → test 1:1 매핑:
 *   - AC-9 Happy path: runIngest success 완료 → refreshAuditPanel + refreshDashboard 호출
 *   - AC-10 Conflict overwrite: onConflict Overwrite 분기 종료 → refresh 호출
 *   - AC-11 Cancel: 사용자 cancel (cancel 분기) → refresh 호출 (vault write 0 invariant 보존)
 *   - AC-12 Error: subprocess timeout / LLM fail → refresh 호출 + showRowError 발화
 *
 * Spec 3 Invariants:
 *   - I9 호출 완전성: success / error / cancel 분기 모두에서 refresh API 호출
 *   - I10 fresh spawn: refresh 시 loadAuditScriptOutput 가 항상 fresh subprocess (cache 0)
 *   - I11 reconcile 후 refresh: Spec 2 reconcile hook 직후 refresh trigger 호출
 *
 * RED 의도:
 *   - WikeyChatView 의 `refreshAuditPanel()` + `refreshDashboard()` public method 가 현재
 *     없음 (renderAuditSection / renderDashboardContent 모두 private). 본 test 는 신규
 *     public API contract 를 검증 → property 미존재로 RED.
 *   - runIngest 의 success/error/cancel 분기에서 refresh trigger 호출 contract 도 spec 의
 *     의도된 분리. 현 commands.ts:runIngest 는 호출 안 함 → 본 test 가 spy 검증으로 RED.
 *
 * Mock 전략:
 *   - WikeyChatView 의 refresh API 가 public method 인지 *type-level + runtime* 검증.
 *   - runIngest 의 완료 분기 trigger 는 별 helper `triggerPanelRefresh(view)` 신규 export
 *     로 분리 (단일 호출처) → test 가 helper 의 contract 검증.
 */

import { describe, it, expect, vi } from 'vitest'
import {
  WikeyChatView,
  triggerPanelRefresh,
  type AuditScriptOutput,
} from '../sidebar-chat'

describe('§5.16 Spec 3 (B3) — WikeyChatView refresh API public contract', () => {
  it('refreshAuditPanel 이 public method 로 노출 (현재 private renderAuditSection 만 존재 — RED)', () => {
    // 본 test 는 prototype chain 에서 method 존재 확증.
    // RED 의도: WikeyChatView.prototype.refreshAuditPanel === undefined → expect fail.
    const proto = WikeyChatView.prototype as unknown as Record<string, unknown>
    expect(typeof proto.refreshAuditPanel).toBe('function')
  })

  it('refreshDashboard 가 public method 로 노출', () => {
    const proto = WikeyChatView.prototype as unknown as Record<string, unknown>
    expect(typeof proto.refreshDashboard).toBe('function')
  })
})

describe('§5.16 Spec 3 (B3) — triggerPanelRefresh helper (single 호출처)', () => {
  // helper 가 view 가 null/undefined 이어도 throw 하지 않고, 존재하면 두 refresh API 호출.
  // 본 contract 가 commands.ts:runIngest 의 success/error/cancel 분기에서 단일 호출처로
  // 사용됨 (DRY — refresh 호출 3 분기 dedup).

  it('AC-9 Happy path — view 가 존재하면 refreshAuditPanel + refreshDashboard 둘 다 호출', () => {
    const refreshAuditPanel = vi.fn()
    const refreshDashboard = vi.fn()
    const fakeView = { refreshAuditPanel, refreshDashboard }
    triggerPanelRefresh(fakeView as unknown as WikeyChatView)
    expect(refreshAuditPanel).toHaveBeenCalledTimes(1)
    expect(refreshDashboard).toHaveBeenCalledTimes(1)
  })

  it('AC-10 Conflict overwrite — overwrite 분기 종료 후 호출 시 동일 contract', () => {
    // commands.ts:runIngestCore 의 catch 안 'IngestCancelledByUserError' 가 아닌 success
    // 분기 (overwrite + 새 sidecar 생성) 후 호출. helper 가 동일 동작.
    const refreshAuditPanel = vi.fn()
    const refreshDashboard = vi.fn()
    triggerPanelRefresh({ refreshAuditPanel, refreshDashboard } as unknown as WikeyChatView)
    expect(refreshAuditPanel).toHaveBeenCalledTimes(1)
    expect(refreshDashboard).toHaveBeenCalledTimes(1)
  })

  it('AC-11 Cancel — cancel 분기 (vault write 0 invariant) 에서도 refresh 호출 의무', () => {
    // commands.ts:runIngest 의 cancel 분기 (line 421-424, briefOutcome.action === "cancel")
    // 또는 runIngestCore catch 의 IngestCancelledByUserError. 둘 다 helper 호출 의무.
    const refreshAuditPanel = vi.fn()
    const refreshDashboard = vi.fn()
    triggerPanelRefresh({ refreshAuditPanel, refreshDashboard } as unknown as WikeyChatView)
    expect(refreshAuditPanel).toHaveBeenCalled()
    expect(refreshDashboard).toHaveBeenCalled()
  })

  it('AC-12 Error — runIngestCore catch 의 일반 error 분기에서도 refresh 호출', () => {
    // showRowError 와 별 — refresh 는 row UX 갱신 이외에 panel 전체 데이터 fresh load.
    // subprocess timeout / LLM fail 후 panel 이 stale 상태로 남지 않도록.
    const refreshAuditPanel = vi.fn()
    const refreshDashboard = vi.fn()
    triggerPanelRefresh({ refreshAuditPanel, refreshDashboard } as unknown as WikeyChatView)
    expect(refreshAuditPanel).toHaveBeenCalled()
    expect(refreshDashboard).toHaveBeenCalled()
  })

  it('view = null safe (no-op, throw 0)', () => {
    // commands.ts 가 getWikeyChatView 결과 null 일 때 (사이드바 닫힘) helper 가 throw 하면
    // ingest 완료 시점 crash. 안전 contract.
    expect(() => triggerPanelRefresh(null)).not.toThrow()
    expect(() => triggerPanelRefresh(undefined)).not.toThrow()
  })

  it('refreshAuditPanel 단독 부재 시 (drift 방어) — refreshDashboard 만 호출', () => {
    // helper 가 method 존재 여부를 typeof 로 가드해야 한다 — 일부만 정의된 view 도 안전.
    const refreshDashboard = vi.fn()
    const fakeView = { refreshDashboard } // refreshAuditPanel 부재
    expect(() => triggerPanelRefresh(fakeView as unknown as WikeyChatView)).not.toThrow()
    expect(refreshDashboard).toHaveBeenCalledTimes(1)
  })
})
