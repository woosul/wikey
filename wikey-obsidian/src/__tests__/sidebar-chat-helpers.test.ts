import { describe, it, expect, beforeEach } from 'vitest'
import {
  computeRowPct,
  showRowError,
  showRowCancelled,
  applyPairedSidecarToAudit,
  type AuditScriptOutput,
} from '../sidebar-chat'

/**
 * §5.15.A Cycle 2 — sidebar-chat.ts renderAuditSection 의 핵심 helper 5종 unit test.
 * AC-A3 "audit fetch + render 흐름 1+ test PASS" 충족.
 *
 * Cover:
 *   - computeRowPct: ingest 진행률 (step + subStep 조합) — pure function
 *   - showRowError: row error UX (path → error message + path-error class)
 *   - showRowCancelled: row cancel UX (path → "취소됨" + path-cancelled class)
 *   - applyPairedSidecarToAudit: paired sidecar dedup + totals 재계산 (immutable)
 *   - loadAuditScriptOutput: subprocess fixture 의존 — Cycle 3 (실 spawn mock 필요)
 *
 * 본 test 는 happy-dom 환경에서 Obsidian HTMLElement augmentation
 * (setText / addClass / createDiv 등) 도 간접 검증.
 */

describe('§5.15.A Cycle 2 — computeRowPct (ingest 진행률)', () => {
  it('step=0 (Reading) → 0%', () => {
    expect(computeRowPct(0)).toBe(0)
  })

  it('step=1 (LLM start) → 5%', () => {
    expect(computeRowPct(1)).toBe(5)
  })

  it('step=2 (LLM 진행중) subStep/subTotal 없으면 80%', () => {
    expect(computeRowPct(2)).toBe(80)
  })

  it('step=2 + subStep=0/subTotal=N → 5% (LLM 시작 시점)', () => {
    expect(computeRowPct(2, 0, 4)).toBe(5)
  })

  it('step=2 + subStep=N/subTotal=N → 80% (LLM 완료 시점)', () => {
    expect(computeRowPct(2, 4, 4)).toBe(80)
  })

  it('step=2 + subStep=2/subTotal=4 → 5% + 75% × 0.5 = 42.5 → round 43', () => {
    expect(computeRowPct(2, 2, 4)).toBe(43)
  })

  it('step=3 (Creating) → 90%', () => {
    expect(computeRowPct(3)).toBe(90)
  })

  it('step=4 (Indexing 완료) → 100%', () => {
    expect(computeRowPct(4)).toBe(100)
  })

  it('subStep > subTotal → fraction clamped 1 (80% upper)', () => {
    expect(computeRowPct(2, 100, 4)).toBe(80)
  })

  it('subStep < 0 → fraction clamped 0 (5% lower)', () => {
    expect(computeRowPct(2, -1, 4)).toBe(5)
  })

  it('out-of-range step → linear fallback (step/4 × 100)', () => {
    expect(computeRowPct(5)).toBe(125) // weights[5] undefined → fallback (5/4)*100
    expect(computeRowPct(-1)).toBe(-25)
  })
})

describe('§5.15.A Cycle 2 — showRowError (row error UX)', () => {
  let row: HTMLElement

  beforeEach(() => {
    row = document.createElement('div')
    row.classList.add('wikey-audit-row')
  })

  it('path span 존재 시 → text override + error class + title', () => {
    const path = document.createElement('span')
    path.classList.add('wikey-audit-path')
    path.textContent = '노트/기사' // 분류 hint 초기값
    row.appendChild(path)

    showRowError(row, 'Conversion failed: PDF parse error at page 3')

    expect(path.textContent).toBe('Conversion failed: PDF parse error at page 3')
    expect(path.classList.contains('wikey-audit-path-error')).toBe(true)
    expect(path.getAttribute('title')).toBe('Conversion failed: PDF parse error at page 3')
  })

  it('error text > maxLen 시 truncate + ellipsis (title 은 full)', () => {
    const path = document.createElement('span')
    path.classList.add('wikey-audit-path')
    row.appendChild(path)

    const longError = 'A'.repeat(100)
    showRowError(row, longError, 20)

    expect(path.textContent).toBe('A'.repeat(20) + '...')
    expect(path.getAttribute('title')).toBe(longError)
  })

  it('path span 부재 시 fallback — wikey-audit-info 안 createDiv error', () => {
    const info = document.createElement('div')
    info.classList.add('wikey-audit-info')
    row.appendChild(info)

    showRowError(row, 'Some error')

    const errEl = info.querySelector('.wikey-audit-error')
    expect(errEl).toBeTruthy()
    expect(errEl?.textContent).toBe('Some error')
  })

  it('path + info 모두 부재 시 — row 자체에 createDiv', () => {
    showRowError(row, 'Fallback error')

    const errEl = row.querySelector('.wikey-audit-error')
    expect(errEl).toBeTruthy()
    expect(errEl?.textContent).toBe('Fallback error')
  })
})

describe('§5.15.A Cycle 2 — showRowCancelled (row cancel UX, §5.15.E F4)', () => {
  let row: HTMLElement

  beforeEach(() => {
    row = document.createElement('div')
    row.classList.add('wikey-audit-row')
  })

  it('path span 존재 시 → "취소됨" + path-cancelled class', () => {
    const path = document.createElement('span')
    path.classList.add('wikey-audit-path')
    path.textContent = '노트/기사'
    row.appendChild(path)

    showRowCancelled(row)

    expect(path.textContent).toBe('취소됨')
    expect(path.classList.contains('wikey-audit-path-cancelled')).toBe(true)
    // path-error 와 분리 — error class 가 동시에 붙지 않음
    expect(path.classList.contains('wikey-audit-path-error')).toBe(false)
  })

  it('path span 부재 시 → noop (no error)', () => {
    expect(() => showRowCancelled(row)).not.toThrow()
  })
})

describe('§5.15.A Cycle 2 — applyPairedSidecarToAudit (paired sidecar dedup)', () => {
  it('paired sidecar (`<base>.<ext>.md`) 가 audit 에 포함된 경우 — 모든 list 에서 제외 + totals 재계산', () => {
    // doc.pdf 가 ingested → docling 이 doc.pdf.md sidecar 생성 → audit 에 함께 등장
    const audit: AuditScriptOutput = {
      total_documents: 4,
      ingested: 2,
      missing: 1,
      unsupported: 1,
      files: ['notes.md'],
      ingested_files: ['doc.pdf', 'doc.pdf.md'],
      unsupported_files: ['old.bak'],
    }

    const result = applyPairedSidecarToAudit(audit)

    // doc.pdf.md (paired) 는 모든 list 에서 제외
    expect(result.ingested_files).toEqual(['doc.pdf'])
    expect(result.ingested).toBe(1)
    expect(result.files).toEqual(['notes.md'])
    expect(result.missing).toBe(1)
    expect(result.unsupported_files).toEqual(['old.bak'])
    expect(result.unsupported).toBe(1)
    expect(result.total_documents).toBe(3)
  })

  it('immutable — 원본 audit 객체 변경 0', () => {
    const audit: AuditScriptOutput = {
      total_documents: 2,
      ingested: 2,
      missing: 0,
      files: [],
      ingested_files: ['doc.pdf', 'doc.pdf.md'],
    }
    const audit_clone_before = JSON.parse(JSON.stringify(audit))

    const result = applyPairedSidecarToAudit(audit)

    expect(audit).toEqual(audit_clone_before) // 원본 보존
    expect(result).not.toBe(audit) // 새 객체 반환
    expect(result.ingested).toBe(1) // sidecar 제외
  })

  it('paired sidecar 없는 경우 — totals 변화 0 (idempotent)', () => {
    const audit: AuditScriptOutput = {
      total_documents: 3,
      ingested: 2,
      missing: 1,
      files: ['note.md'],
      ingested_files: ['a.md', 'b.md'],
    }
    const result = applyPairedSidecarToAudit(audit)
    expect(result.ingested_files).toEqual(['a.md', 'b.md'])
    expect(result.files).toEqual(['note.md'])
    expect(result.total_documents).toBe(3)
  })

  it('unsupported_files undefined 시 — empty array 로 처리 + crash 0', () => {
    const audit: AuditScriptOutput = {
      total_documents: 1,
      ingested: 1,
      missing: 0,
      files: [],
      ingested_files: ['doc.pdf'],
      // unsupported_files 의도적 omit
    }
    const result = applyPairedSidecarToAudit(audit)
    expect(result.unsupported_files).toEqual([])
    expect(result.unsupported).toBe(0)
    expect(result.ingested).toBe(1)
  })
})
