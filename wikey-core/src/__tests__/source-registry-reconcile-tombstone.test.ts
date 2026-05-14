/**
 * §5.16 Spec 2 (B2) — Stale tombstone reconcile (false tombstone 자동 복구).
 *
 * Source of truth: docs/planning/phase-5/phase-5-spec-5.16-audit-refresh-reliability.md v0.2 §1.2
 *
 * Spec 2 Acceptance Scenarios → test 1:1 매핑:
 *   - AC-5 case A (Step "1" evidence): MarkItDown 109KB MD — disk 존재 + tombstone=true
 *     → reconcile 1회 → tombstone=false 복구
 *   - AC-6 case B (Step "1" evidence): HWP 스마트공장 — raw + sidecar 모두 disk 존재 +
 *     tombstone=true → reconcile 1회 → tombstone=false 복구
 *   - AC-7 ingest pipeline 호출: ingest 완료 hook 시점에 reconcile 자동 발화 →
 *     restoredIds 반환 (telemetry / sidebar refresh trigger 용)
 *   - AC-8 idempotent: reconcile 2회 연속 호출 → 두 번째의 restoredIds = []
 *
 * Spec 2 Invariants:
 *   - I5 restoreTombstone 발화: walker 의 hash 가 record (tombstone=true) hash 와 일치 시
 *     tombstone=false (이미 reconcile case 4 구현 — 호출 시점만 검증)
 *   - I6 ingest pipeline hook: ingest 완료 직후 reconcile 1회 의무 발화
 *   - I7 idempotent: N회 연속 호출 결과 동일
 *   - I8 path mismatch: walker hash match + path 다름 → recordMove 발화 (case 2)
 *
 * RED 의도:
 *   - AC-5/AC-6 (현 reconcile 직접 호출 부분) = 기존 case 4 구현 PASS 가능. 본 test 는
 *     spec 의 *명시 helper* `reconcileAfterIngest` (신규 export) 를 통해 호출 → 미존재
 *     → import-time RED. GREEN 시 helper export 추가 (얇은 wrapper — restoredIds 추적 +
 *     idempotent guarantee).
 *   - AC-7 (ingest pipeline hook) = wikey-core 의 신규 export `reconcileAfterIngest` 가
 *     ingest-pipeline 의 hook 위치에서 호출되어야 하는 *contract* — 본 test 는 helper
 *     자체의 동작 + restoredIds 반환 검증. ingest pipeline 의 실 통합은 GREEN 단계에서
 *     developer 가 hook 추가 (별 통합 test 또는 master 라이브 smoke 로 확증).
 *   - AC-8 idempotent = helper 의 핵심 contract.
 */

import { describe, it, expect } from 'vitest'
import { computeFullHash } from '../uri.js'
import {
  reconcile,
  type SourceRegistry,
  type SourceRecord,
  type WalkerEntry,
} from '../source-registry.js'
// 신규 export — Spec 2 의 ingest hook contract 구현체.
// 미존재 → import-time RED (의도된 RED 신호 — GREEN 시 source-registry.ts 에 add).
import { reconcileAfterIngest } from '../source-registry.js'

function makeTombstonedRecord(path: string, hash: string, sidecarPath?: string): SourceRecord {
  return {
    vault_path: path,
    sidecar_vault_path: sidecarPath ?? `${path}.md`,
    hash,
    size: 100,
    first_seen: '2026-04-22T00:00:00Z',
    ingested_pages: [`wiki/sources/source-${path.split('/').pop()}.md`],
    path_history: [{ vault_path: path, at: '2026-04-22T00:00:00Z' }],
    tombstone: true,
  }
}

describe('§5.16 Spec 2 (B2) — reconcileAfterIngest (stale tombstone 자동 복구 + restoredIds 추적)', () => {
  it('AC-5 case A — MarkItDown disk 존재 + tombstone=true → tombstone=false 복구 + restoredIds 포함', async () => {
    // Step "1" raw evidence (registry case A):
    //   path = raw/3_resources/60_note/500_technology/MarkItDown으로 모든 문서를 마크다운으로 변환하기.md
    //   tombstone=true 인데 disk 파일 존재.
    const path = 'raw/3_resources/60_note/500_technology/MarkItDown으로 모든 문서를 마크다운으로 변환하기.md'
    const bytes = new TextEncoder().encode('# MarkItDown\n\n사용 후기 본문...')
    const fullHash = computeFullHash(bytes)
    const id = 'sha256:markitdown-case-a'

    const reg: SourceRegistry = {
      [id]: makeTombstonedRecord(path, fullHash),
    }
    const walker = async (): Promise<readonly WalkerEntry[]> => [{ vault_path: path, bytes }]

    const result = await reconcileAfterIngest(reg, walker)
    expect(result.registry[id]?.tombstone).toBe(false) // I5 restoreTombstone 발화
    expect(result.restoredIds).toContain(id) // AC-7 telemetry signal
  })

  it('AC-6 case B — HWP 스마트공장 raw + sidecar 모두 disk 존재 + tombstone=true → 복구', async () => {
    // Step "1" raw evidence (registry case B):
    //   path = raw/3_resources/20_report/200_social/스마트공장 보급확산 합동설명회 개최.hwp
    //   sidecar = ...hwp.md (paired)
    //   tombstone=true 인데 두 파일 모두 disk 존재.
    const path = 'raw/3_resources/20_report/200_social/스마트공장 보급확산 합동설명회 개최.hwp'
    const bytes = new TextEncoder().encode('HWP raw bytes (binary)')
    const fullHash = computeFullHash(bytes)
    const id = 'sha256:hwp-case-b'

    const reg: SourceRegistry = {
      [id]: makeTombstonedRecord(path, fullHash, `${path}.md`),
    }
    // walker 는 raw 만 hash 검증 (sidecar 는 별 hash 추적 X — paired sidecar 정책).
    const walker = async (): Promise<readonly WalkerEntry[]> => [{ vault_path: path, bytes }]

    const result = await reconcileAfterIngest(reg, walker)
    expect(result.registry[id]?.tombstone).toBe(false)
    expect(result.registry[id]?.vault_path).toBe(path) // path 유지
    expect(result.registry[id]?.sidecar_vault_path).toBe(`${path}.md`) // sidecar 유지
    expect(result.restoredIds).toContain(id)
  })

  it('AC-7 ingest pipeline hook contract — restoredIds 가 ingest 완료 후 sidebar refresh trigger 입력', async () => {
    // 본 test 는 helper 가 ingest pipeline hook 의 *contract* 를 만족하는지 검증:
    //   1. registry + walker 입력으로 호출 가능
    //   2. { registry, restoredIds } 반환 (telemetry 추적)
    //   3. restoredIds 가 0 이상 → caller 가 refresh trigger 또는 log 결정
    const idA = 'sha256:hook-a'
    const idB = 'sha256:hook-b'
    const bytesA = new TextEncoder().encode('content-A')
    const bytesB = new TextEncoder().encode('content-B')
    const reg: SourceRegistry = {
      [idA]: makeTombstonedRecord('raw/0_inbox/a.pdf', computeFullHash(bytesA)),
      [idB]: makeTombstonedRecord('raw/0_inbox/b.pdf', computeFullHash(bytesB)),
    }
    const walker = async (): Promise<readonly WalkerEntry[]> => [
      { vault_path: 'raw/0_inbox/a.pdf', bytes: bytesA },
      { vault_path: 'raw/0_inbox/b.pdf', bytes: bytesB },
    ]
    const result = await reconcileAfterIngest(reg, walker)
    expect(result.restoredIds.length).toBe(2)
    expect(result.restoredIds).toEqual(expect.arrayContaining([idA, idB]))
    expect(result.registry[idA]?.tombstone).toBe(false)
    expect(result.registry[idB]?.tombstone).toBe(false)
  })

  it('AC-8 idempotent — reconcileAfterIngest 2회 연속 호출 시 두 번째 restoredIds = [] (race 회피)', async () => {
    const id = 'sha256:idempotent'
    const bytes = new TextEncoder().encode('idempotent-content')
    const reg: SourceRegistry = {
      [id]: makeTombstonedRecord('raw/3_resources/x.pdf', computeFullHash(bytes)),
    }
    const walker = async (): Promise<readonly WalkerEntry[]> => [
      { vault_path: 'raw/3_resources/x.pdf', bytes },
    ]
    const first = await reconcileAfterIngest(reg, walker)
    expect(first.restoredIds).toContain(id)
    expect(first.registry[id]?.tombstone).toBe(false)

    // 2회차 — 이미 1회차에서 복구됨 → restoredIds = []
    const second = await reconcileAfterIngest(first.registry, walker)
    expect(second.restoredIds).toEqual([])
    expect(second.registry[id]?.tombstone).toBe(false) // 그대로 false
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// I7 idempotent — 기존 reconcile() 자체도 idempotent 인지 cross-check (regression guard).
// 본 부분은 기존 reconcile 동작 검증 (이미 PASS 일 것). reconcileAfterIngest 가
// 내부적으로 reconcile 을 호출한다는 contract 를 명시.
// ─────────────────────────────────────────────────────────────────────────────

describe('§5.16 Spec 2 (B2) — 기존 reconcile() 와의 호환성 (regression guard)', () => {
  it('I7 — 기존 reconcile 도 idempotent (case 4 restoreTombstone) — reconcileAfterIngest 가 같은 결과', async () => {
    const id = 'sha256:compat'
    const bytes = new TextEncoder().encode('compat-content')
    const fullHash = computeFullHash(bytes)
    const reg: SourceRegistry = {
      [id]: makeTombstonedRecord('raw/0_inbox/x.pdf', fullHash),
    }
    const walker = async (): Promise<readonly WalkerEntry[]> => [
      { vault_path: 'raw/0_inbox/x.pdf', bytes },
    ]
    // 기존 reconcile 직접 호출 — case 4 구현이 발화하는지 cross-check
    const directResult = await reconcile(reg, walker)
    expect(directResult[id]?.tombstone).toBe(false)

    // reconcileAfterIngest 도 동일 결과 + restoredIds 추적
    const hookResult = await reconcileAfterIngest(reg, walker)
    expect(hookResult.registry[id]?.tombstone).toBe(false)
    expect(hookResult.restoredIds).toContain(id)
  })
})
