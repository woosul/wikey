/**
 * pii-redact.test.ts — Phase 4 D.0.a (TDD).
 *
 * Covers:
 *   - detect: BRN / corp-rn / CEO label (4 positive + 3 FP negative)
 *   - redact modes: mask / display (3)
 *   - hide 3-단 fallback: sentence / line / window (4)
 *   - 2-layer gate integration: guardEnabled × allowPiiIngest × mode (5)
 *   - PDF sidecar redact — sidecar candidate 경로 (2)
 *
 * Total: 21 tests (matches plan v6 §4.1.5).
 */

import { describe, it, expect } from 'vitest'
import {
  detectPii,
  redactPii,
  applyPiiGate,
  PiiIngestBlockedError,
  type PiiMatch,
  type PiiRedactionMode,
} from '../pii-redact.js'

describe('detectPii — positive matches', () => {
  it('detects hyphenated BRN (사업자등록번호 형식 123-45-67890)', () => {
    const md = '저희 회사 사업자번호는 123-45-67890 입니다.'
    const matches = detectPii(md)
    expect(matches.length).toBeGreaterThanOrEqual(1)
    const brn = matches.find((m) => m.kind === 'brn')
    expect(brn).toBeDefined()
    expect(brn!.value).toBe('123-45-67890')
  })

  it('detects contiguous BRN under label (사업자번호: 1234567890)', () => {
    const md = '사업자번호: 1234567890 으로 등록되어 있습니다.'
    const matches = detectPii(md)
    const brn = matches.find((m) => m.kind === 'brn')
    expect(brn).toBeDefined()
    expect(brn!.value).toBe('1234567890')
  })

  it('detects 법인등록번호 (both hyphenated and 13-digit contiguous under label)', () => {
    const md1 = '법인등록번호: 123456-1234567 — 등기부등본 확인'
    const md2 = '법인번호: 1234561234567 입니다.'
    const m1 = detectPii(md1)
    const m2 = detectPii(md2)
    expect(m1.find((m) => m.kind === 'corp-rn')).toBeDefined()
    expect(m2.find((m) => m.kind === 'corp-rn')).toBeDefined()
  })

  it('detects CEO label variants (대표이사: 홍길동, 대표자: 김철수, CEO: 이영희)', () => {
    const md = '대표이사: 홍길동\n대표자: 김철수\nCEO: 이영희\n'
    const matches = detectPii(md)
    const names = matches.filter((m) => m.kind === 'ceo-labeled').map((m) => m.value)
    expect(names).toContain('홍길동')
    expect(names).toContain('김철수')
    expect(names).toContain('이영희')
  })
})

describe('detectPii — false-positive negatives', () => {
  it('does NOT match bare 13-digit number without 법인등록번호 label (FP — phone / order)', () => {
    const md = '주문번호 1234561234567 확인 요청드립니다.'
    const matches = detectPii(md)
    // Must not be flagged as corp-rn (label absent).
    expect(matches.filter((m) => m.kind === 'corp-rn')).toHaveLength(0)
  })

  it('does NOT match random 10-digit number without 사업자번호 label (FP)', () => {
    const md = '전화 0212345678 으로 연락 주세요.'
    const matches = detectPii(md)
    expect(matches.filter((m) => m.kind === 'brn')).toHaveLength(0)
  })

  it('does NOT match 4-글자 이상 한글 이름 after 대표이사 label (FP — 장난스런 labels)', () => {
    // 규칙: CEO label 은 2~4 한글자만. 5자 이상은 스킵 (이름이 아니라 설명일 가능성).
    const md = '대표이사: 홍길동전에이름을적었다'
    const matches = detectPii(md)
    const ceo = matches.filter((m) => m.kind === 'ceo-labeled')
    // 5+ chars → 2~4 char prefix 만 caught (긴 라벨은 전체 미스). 또는 빈 배열.
    // 규칙상 2~4 까지만 매칭되므로 "홍길동전" 4자리는 걸릴 수 있음.
    // → FP 회피 관점: 전체 "홍길동전에이름을적었다" 가 아닌 최대 4자 부분만.
    for (const m of ceo) {
      expect(m.value.length).toBeLessThanOrEqual(4)
    }
  })
})

describe('redactPii — mask / display modes', () => {
  it('display mode is a no-op (원문 그대로 반환)', () => {
    const md = '사업자번호 123-45-67890 / 대표이사: 홍길동'
    expect(redactPii(md, 'display')).toBe(md)
  })

  it('mask mode preserves 자릿수 + non-digit chars (123-45-67890 → ***-**-*****)', () => {
    const md = '사업자번호: 123-45-67890 입니다'
    const out = redactPii(md, 'mask')
    expect(out).not.toContain('123-45-67890')
    expect(out).toContain('***-**-*****')
  })

  it('mask mode CEO name replaced with same-length stars (홍길동 → ***)', () => {
    const md = '대표이사: 홍길동 / CEO: 이영희'
    const out = redactPii(md, 'mask')
    expect(out).not.toContain('홍길동')
    expect(out).not.toContain('이영희')
    expect(out).toContain('대표이사: ***')
    expect(out).toContain('CEO: ***')
  })
})

describe('redactPii — hide 3-단 fallback', () => {
  it('hide (1단 sentence): 문장 전체를 [PII 제거] 로 치환', () => {
    const md = '회사는 건강하게 성장하고 있습니다. 사업자번호는 123-45-67890 으로 등록되어 있습니다. 서비스도 꾸준합니다.'
    const out = redactPii(md, 'hide')
    expect(out).not.toContain('123-45-67890')
    expect(out).toContain('[PII 제거]')
    // 1번 문장 "회사는 건강하게 성장하고 있습니다." 는 보존되어야 함
    expect(out).toContain('회사는 건강하게 성장하고 있습니다')
    expect(out).toContain('서비스도 꾸준합니다')
  })

  it('hide (2단 line): 표 셀처럼 문장 종결 없는 라인은 해당 라인만 치환', () => {
    const md = [
      '| 항목 | 값 |',
      '| ---- | ---- |',
      '| 사업자 | 123-45-67890 |',
      '| 이름 | 김철수 |',
    ].join('\n')
    const out = redactPii(md, 'hide')
    expect(out).not.toContain('123-45-67890')
    expect(out).toContain('[PII 제거]')
    // 다른 라인은 보존
    expect(out).toContain('| 항목 | 값 |')
    expect(out).toContain('| 이름 | 김철수 |')
  })

  it('hide (2단 line): 인용(blockquote) 라인도 치환', () => {
    const md = [
      '다음은 소개입니다',
      '> 등록정보 법인번호 123456-1234567 공식 기재',
      '위 인용을 참조하세요',
    ].join('\n')
    const out = redactPii(md, 'hide')
    expect(out).not.toContain('123456-1234567')
    expect(out).toContain('[PII 제거]')
    expect(out).toContain('다음은 소개입니다')
    expect(out).toContain('위 인용을 참조하세요')
  })

  it('hide (3단 window): 매우 긴 단일 라인 (종결부호 없음) 은 match 주변 window 로 치환', () => {
    // 문장 종결부호 없고 \n 도 없는 300자 이상 텍스트
    const prefix = 'A'.repeat(250)
    const suffix = 'Z'.repeat(250)
    const md = `${prefix} 사업자번호 123-45-67890 ${suffix}`
    const out = redactPii(md, 'hide')
    expect(out).not.toContain('123-45-67890')
    expect(out).toContain('[PII 제거]')
    // 양끝 일부는 보존
    expect(out.startsWith('A')).toBe(true)
    expect(out.endsWith('Z')).toBe(true)
  })
})

describe('applyPiiGate — 2-layer gate integration', () => {
  const withPii = '사업자번호: 123-45-67890 / 대표이사: 홍길동'
  const withoutPii = '이 문서에는 민감 정보가 없습니다.'

  it('guardEnabled=false → detect/redact 모두 skip (user-trust off, 원문 그대로)', () => {
    const res = applyPiiGate(withPii, {
      guardEnabled: false,
      allowIngest: false,
      mode: 'mask',
    })
    expect(res.content).toBe(withPii)
    expect(res.redacted).toBe(false)
    expect(res.matches).toHaveLength(0)
  })

  it('guardEnabled=true, allowIngest=false, PII 있음 → PiiIngestBlockedError 던짐', () => {
    expect(() => applyPiiGate(withPii, {
      guardEnabled: true,
      allowIngest: false,
      mode: 'mask',
    })).toThrow(PiiIngestBlockedError)
  })

  it('guardEnabled=true, allowIngest=true, mode=mask → 자릿수 보존 치환', () => {
    const res = applyPiiGate(withPii, {
      guardEnabled: true,
      allowIngest: true,
      mode: 'mask',
    })
    expect(res.redacted).toBe(true)
    expect(res.content).not.toContain('123-45-67890')
    expect(res.content).not.toContain('홍길동')
    expect(res.content).toContain('***-**-*****')
  })

  it('guardEnabled=true, allowIngest=true, mode=hide → [PII 제거] 마커', () => {
    const res = applyPiiGate(withPii, {
      guardEnabled: true,
      allowIngest: true,
      mode: 'hide',
    })
    expect(res.redacted).toBe(true)
    expect(res.content).not.toContain('123-45-67890')
    expect(res.content).not.toContain('홍길동')
    expect(res.content).toContain('[PII 제거]')
  })

  it('md 원본 동일 분기 — PII 없는 입력은 모든 mode 에서 원문 반환 (not redacted)', () => {
    for (const mode of ['display', 'mask', 'hide'] as PiiRedactionMode[]) {
      const res = applyPiiGate(withoutPii, {
        guardEnabled: true,
        allowIngest: false, // allowIngest=false 여도 PII 0개면 throw 안 함
        mode,
      })
      expect(res.content).toBe(withoutPii)
      expect(res.redacted).toBe(false)
      expect(res.matches).toHaveLength(0)
    }
  })
})

describe('applyPiiGate — PDF sidecar redact 경로', () => {
  it('PDF sidecar candidate (변환 결과) 도 중앙 wrapper 로 동일 redact 적용', () => {
    // extractPdfText::finalize 가 리턴한 sidecarCandidate 에도 PII 가 있으면 같은 게이트로 마스킹.
    const sidecarCandidate = [
      '# 사업자등록증',
      '',
      '상호: 굿스트림',
      '사업자번호: 123-45-67890',
      '대표이사: 홍길동',
      '주소: 서울시 어딘가',
    ].join('\n')

    const res = applyPiiGate(sidecarCandidate, {
      guardEnabled: true,
      allowIngest: true,
      mode: 'mask',
    })
    expect(res.redacted).toBe(true)
    expect(res.content).not.toContain('123-45-67890')
    expect(res.content).not.toContain('홍길동')
    expect(res.content).toContain('***-**-*****')
    // 민감 외 데이터는 보존
    expect(res.content).toContain('상호: 굿스트림')
    expect(res.content).toContain('주소: 서울시 어딘가')
  })

  it('PDF sidecar + guardEnabled=false → 원문 BRN 잔존 (사용자 명시 선택 결과)', () => {
    const sidecarCandidate = '사업자번호: 123-45-67890'
    const res = applyPiiGate(sidecarCandidate, {
      guardEnabled: false,
      allowIngest: false,
      mode: 'mask',
    })
    expect(res.content).toContain('123-45-67890')
    expect(res.redacted).toBe(false)
  })
})
