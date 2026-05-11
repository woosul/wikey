/**
 * §5.16 Spec 1 (B1) — `hasSidecar` set 정합 (paired sidecar badge 복구).
 *
 * Source of truth: plan/phase-5/phase-5-spec-5.16-audit-refresh-reliability.md v0.2 §1.1
 *
 * Spec 1 Acceptance Scenarios → test 1:1 매핑:
 *   - AC-1 PMS 케이스 (Step "1" raw evidence) — rawAudit 기반 set 가 sidecar 포함 →
 *     hasSidecar(rawPdfPath) === true (gray badge 표시 invariant I3)
 *   - AC-2 broken case — sidecar 있고 raw 가 ingested_files 에 없음 → hasSidecar=true,
 *     ingestedSet=false → orange broken badge 분기 진입
 *   - AC-3 sidecar 미존재 → hasSidecar=false (badge 미생성)
 *   - AC-4 tree view (line 1220) 도 동일 invariant 보존 (helper 단위에서 검증)
 *
 * Spec 1 Invariants:
 *   - I1: hasSidecar 의 두 번째 인자 = rawAudit.{files ∪ ingested_files ∪ unsupported_files}
 *         (paired dedup *전*). auditData 기반 set 사용 금지.
 *   - I2: hasSidecar(file, rawAuditAllSet) == true 인 모든 row 는 `md` badge 1개.
 *   - I3: ingestedSet.has(file) == true → gray, false → orange.
 *
 * RED 의도: 본 test 는 신규 helper `buildAuditLookupAllSet(rawAudit)` 를 sidebar-chat
 * 으로부터 import 한다. 현재 sidebar-chat 은 inline 으로 잘못된 set (auditData 기반) 을
 * 구성 → helper 미존재 → import-time RED. GREEN (developer) 단계에서 helper 를 export
 * + 호출처 (line 884) 를 helper 호출로 교체 → 본 test 모두 GREEN.
 */

import { describe, it, expect } from 'vitest'
import {
  buildAuditLookupAllSet,
  applyPairedSidecarToAudit,
  type AuditScriptOutput,
} from '../sidebar-chat'
import { hasSidecar } from 'wikey-core'

describe('§5.16 Spec 1 (B1) — buildAuditLookupAllSet (rawAudit 기반 hasSidecar set)', () => {
  it('AC-1 PMS 케이스: ingested_files 에 raw + files 에 sidecar → hasSidecar(rawPdf) === true (gray badge)', () => {
    // Step "1" raw evidence:
    //   ingested_files: [..., 'raw/3_resources/20_report/500_technology/PMS_제품소개_R10_20220815.pdf']
    //   files:          [..., 'raw/3_resources/20_report/500_technology/PMS_제품소개_R10_20220815.pdf.md']
    const rawPdf = 'raw/3_resources/20_report/500_technology/PMS_제품소개_R10_20220815.pdf'
    const sidecar = `${rawPdf}.md`
    const rawAudit: AuditScriptOutput = {
      total_documents: 2,
      ingested: 1,
      missing: 1,
      files: [sidecar], // audit-ingest.py 는 ingested 의 sidecar 를 missing 분류로 별 entry
      ingested_files: [rawPdf],
      unsupported_files: [],
    }
    const lookupSet = buildAuditLookupAllSet(rawAudit)
    expect(lookupSet.has(sidecar)).toBe(true) // I1: sidecar 가 set 에 살아있어야 hasSidecar 가 true 가능
    expect(hasSidecar(rawPdf, lookupSet)).toBe(true) // I2 + AC-1
    // ingestedSet (post-applyPairedSidecarToAudit) 분기: gray 색
    const auditData = applyPairedSidecarToAudit(rawAudit)
    const ingestedSet = new Set<string>(auditData.ingested_files)
    expect(ingestedSet.has(rawPdf)).toBe(true) // I3: gray (broken X)
  })

  it('AC-2 broken case: sidecar 있고 raw 가 ingested_files 에 없음 → hasSidecar=true + ingestedSet=false (orange)', () => {
    // ingest 결과는 잃었으나 sidecar 잔존 (registry/wiki reset 등). orange broken badge 트리거.
    const rawPdf = 'raw/3_resources/30_manual/600_industry/abandoned.pdf'
    const sidecar = `${rawPdf}.md`
    const rawAudit: AuditScriptOutput = {
      total_documents: 2,
      ingested: 0,
      missing: 2,
      files: [rawPdf, sidecar], // raw + sidecar 모두 missing 분류
      ingested_files: [],
      unsupported_files: [],
    }
    const lookupSet = buildAuditLookupAllSet(rawAudit)
    expect(hasSidecar(rawPdf, lookupSet)).toBe(true) // AC-2 → broken badge 분기 진입
    const auditData = applyPairedSidecarToAudit(rawAudit)
    const ingestedSet = new Set<string>(auditData.ingested_files)
    expect(ingestedSet.has(rawPdf)).toBe(false) // orange
  })

  it('AC-3 sidecar 미존재: rawAudit 에 base 만, sidecar 없음 → hasSidecar=false (badge 미생성)', () => {
    const rawPdf = 'raw/3_resources/30_manual/600_industry/standalone.pdf'
    const rawAudit: AuditScriptOutput = {
      total_documents: 1,
      ingested: 0,
      missing: 1,
      files: [rawPdf],
      ingested_files: [],
      unsupported_files: [],
    }
    const lookupSet = buildAuditLookupAllSet(rawAudit)
    expect(hasSidecar(rawPdf, lookupSet)).toBe(false) // AC-3
  })

  it('AC-4 tree view 동일 invariant: rawAudit 기반 set 가 list / tree 양쪽에서 동일 결과', () => {
    // line 1112 (list view) + line 1220 (tree view) 가 동일 set 사용 → 동일 invariant.
    // 본 helper 는 view-mode 무관 — pure rawAudit → set.
    const rawPdf = 'raw/3_resources/20_report/500_technology/PMS_제품소개_R10_20220815.pdf'
    const sidecar = `${rawPdf}.md`
    const rawAudit: AuditScriptOutput = {
      total_documents: 2,
      ingested: 1,
      missing: 1,
      files: [sidecar],
      ingested_files: [rawPdf],
      unsupported_files: [],
    }
    const setForList = buildAuditLookupAllSet(rawAudit)
    const setForTree = buildAuditLookupAllSet(rawAudit)
    expect(setForList.has(sidecar)).toBe(setForTree.has(sidecar))
    expect(hasSidecar(rawPdf, setForList)).toBe(hasSidecar(rawPdf, setForTree))
    expect(hasSidecar(rawPdf, setForList)).toBe(true)
  })

  it('I1 invariant: 본 helper 는 rawAudit (dedup *전*) 기반이지 auditData (dedup 후) 기반이 아니어야 한다', () => {
    // 본 invariant 가 깨지면 — buildAuditLookupAllSet 가 내부에서 applyPairedSidecarToAudit
    // 를 거쳐 set 을 구성하는 결함 — sidecar 가 set 에서 사라진다.
    const rawPdf = 'raw/3_resources/20_report/500_technology/PMS_제품소개_R10_20220815.pdf'
    const sidecar = `${rawPdf}.md`
    const rawAudit: AuditScriptOutput = {
      total_documents: 2,
      ingested: 1,
      missing: 1,
      files: [sidecar],
      ingested_files: [rawPdf],
      unsupported_files: [],
    }
    const lookupSet = buildAuditLookupAllSet(rawAudit)
    // I1 핵심: lookup set 안에 sidecar 가 살아 있어야 한다.
    expect(lookupSet.has(sidecar)).toBe(true)
    expect(lookupSet.has(rawPdf)).toBe(true)

    // 반례 — 잘못된 구현 (auditData 기반) 의 결과 set 에는 sidecar 가 없다.
    // 본 비교는 buildAuditLookupAllSet 가 그 잘못된 구현이 아님을 명시 검증.
    const auditData = applyPairedSidecarToAudit(rawAudit)
    const wrongSet = new Set<string>([
      ...auditData.files,
      ...auditData.ingested_files,
      ...(auditData.unsupported_files ?? []),
    ])
    expect(wrongSet.has(sidecar)).toBe(false) // 잘못된 구현 — sidecar 누락
    expect(lookupSet).not.toEqual(wrongSet) // helper 가 잘못된 구현과 다름을 확증
  })
})
