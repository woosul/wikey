/**
 * pii-structural.test.ts — Phase 5 §5.1 (2026-04-25).
 *
 * 구조적 (multi-line 폼) PII 탐지 테스트.
 * 계획서: `plan/phase-5-todox-5.1-structural-pii.md` §8.2.
 *
 * 최소 10 tests — RED 먼저 작성, 구현 후 GREEN 확인.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectPii, redactPii } from '../pii-redact.js'
import {
  loadPiiPatternsFromYaml,
  compilePattern,
  DEFAULT_PATTERNS,
  mergePatterns,
  type PiiPattern,
  type CompiledPiiPattern,
} from '../pii-patterns.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'pii-structural')

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf-8')
}

/**
 * 기본 structural patterns (테스트용). 구현 후에는 bundled default YAML 이 같은 패턴을
 * 자동 로드하지만, 테스트는 명시적으로 이 패턴 세트를 compile 해 주입한다.
 */
const STRUCTURAL_CEO_PATTERN: PiiPattern = {
  id: 'ceo-multiline-form',
  patternType: 'structural',
  kind: 'ceo-structural',
  labelPattern: '대\\s*표\\s*(?:자|이\\s*사)|CEO|사\\s*장',
  valuePattern: '[가-힣](?:[ \\t]*[가-힣]){1,3}',
  windowLines: 5,
  valueExcludePrefixes: [
    '주식회사',
    '(주)',
    '㈜',
    '유한회사',
    '재단법인',
    '사단법인',
    '유한책임회사',
  ],
  mask: 'full',
  description: 'structural CEO detection for PDF forms',
}

const STRUCTURAL_BRN_PATTERN: PiiPattern = {
  id: 'brn-multiline-form',
  patternType: 'structural',
  kind: 'brn-structural',
  labelPattern: '사\\s*업\\s*자\\s*(?:등\\s*록\\s*)?번\\s*호|법\\s*인\\s*(?:등\\s*록\\s*)?번\\s*호',
  valuePattern: '\\d{3}-?\\d{2}-?\\d{5}|\\d{10,13}',
  windowLines: 5,
  mask: 'digits',
  description: 'structural BRN detection for PDF forms',
}

function compileAll(patterns: readonly PiiPattern[]): readonly CompiledPiiPattern[] {
  const out: CompiledPiiPattern[] = []
  for (const p of patterns) {
    const c = compilePattern(p)
    if (c) out.push(c)
  }
  return out
}

describe('structural PII — fixture-based detection (§5.1.1.2)', () => {
  let patterns: readonly CompiledPiiPattern[]

  beforeAll(() => {
    patterns = compileAll([
      ...DEFAULT_PATTERNS,
      STRUCTURAL_CEO_PATTERN,
      STRUCTURAL_BRN_PATTERN,
    ])
  })

  it('1. 3-block real repro — label → 회사명 → CEO: synthetic CEO 1건 mask, 회사명 skip', () => {
    const md = loadFixture('ceo-3-block-real-repro.md')
    const matches = detectPii(md, patterns)
    const ceoMatches = matches.filter((m) => m.kind === 'ceo-structural')
    expect(ceoMatches.length).toBe(1)
    expect(ceoMatches[0].value).toBe('홍 길 동')
    // 회사명 (주식회사 테스트벤치) 은 valueExcludePrefixes 에 의해 skip
    const companyCandidate = matches.find((m) => m.value.includes('테스트벤치'))
    expect(companyCandidate).toBeUndefined()
  })

  it('2. blank line between label and CEO — redactPii mask 치환 (문자수 보존)', () => {
    const md = loadFixture('ceo-blank-line.md')
    const out = redactPii(md, 'mask', patterns)
    expect(out).not.toContain('홍 길 동')
    // 한글 3자 + 공백 2 = 5 char → `*****`
    expect(out).toContain('*****')
  })

  it('3. 4th line CEO (non-empty 1개, windowLines=5 내) — match 1건', () => {
    const md = loadFixture('ceo-4th-line-ceo.md')
    const matches = detectPii(md, patterns)
    const ceoMatches = matches.filter((m) => m.kind === 'ceo-structural')
    expect(ceoMatches.length).toBe(1)
    expect(ceoMatches[0].value).toBe('김 철 수')
  })

  it('4. CEO out of window (non-empty 6개 뒤) — match 0건 (boundary negative)', () => {
    const md = loadFixture('ceo-out-of-window.md')
    const matches = detectPii(md, patterns)
    const ceoMatches = matches.filter((m) => m.kind === 'ceo-structural')
    expect(ceoMatches.length).toBe(0)
  })

  it('5. table cell — | 대표자 | 이 영 희 | 구조 mask', () => {
    const md = loadFixture('ceo-table-cell.md')
    const out = redactPii(md, 'mask', patterns)
    expect(out).not.toContain('이 영 희')
  })

  it('6. BRN label line break — structural match 1건, digits mask', () => {
    const md = loadFixture('brn-label-line-break.md')
    // structural matcher 자체의 동작을 격리 검증 (single-line brn-hyphen 이 먼저 매칭하면
    // §Q3 A dedup 정책상 single 유지되어 kind='brn-structural' 이 사라지므로 structural 만 주입).
    const structuralOnly = compileAll([STRUCTURAL_BRN_PATTERN])
    const matches = detectPii(md, structuralOnly)
    const brnMatches = matches.filter((m) => m.kind === 'brn-structural')
    expect(brnMatches.length).toBeGreaterThanOrEqual(1)
    // 전체 patterns 로도 원문 BRN 이 mask 되는지 확인 (single-line 이 redact 책임).
    const out = redactPii(md, 'mask', patterns)
    expect(out).not.toContain('123-45-67890')
  })

  it('7. false-positive corp name (label 미일치) — match 0건', () => {
    const md = loadFixture('false-positive-corp-name.md')
    const matches = detectPii(md, patterns)
    const ceoMatches = matches.filter((m) => m.kind === 'ceo-structural')
    expect(ceoMatches.length).toBe(0)
    const brnMatches = matches.filter((m) => m.kind === 'brn-structural')
    expect(brnMatches.length).toBe(0)
  })

  it('8. mixed document (single-line + structural) — 둘 다 걸리고 dedup 중복 없음', () => {
    const md = [
      '사업자번호: 123-45-67890',
      '',
      '대 표 자',
      '',
      '홍 길 동',
    ].join('\n')
    const matches = detectPii(md, patterns)
    // single-line BRN + structural CEO (최소 2건)
    const brn = matches.filter((m) => m.kind === 'brn')
    const ceo = matches.filter((m) => m.kind === 'ceo-structural')
    expect(brn.length).toBeGreaterThanOrEqual(1)
    expect(ceo.length).toBe(1)
    // dedup — 동일 start/end 없음
    const keys = matches.map((m) => `${m.start}-${m.end}`)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('structural PII — YAML loader + patternType discriminator', () => {
  it('9. valueExcludePrefixes YAML override (사용자 커스텀 → reload → match 변화)', () => {
    // 기본에서는 `주식회사` 접두어 후보 배제. override 로 배제 목록을 비우면 회사명도 잡힘.
    const customYaml = [
      'patterns:',
      '  - id: ceo-multiline-form',
      '    patternType: structural',
      '    kind: ceo-structural',
      "    labelPattern: '대\\s*표\\s*(?:자|이\\s*사)'",
      "    valuePattern: '[가-힣](?:[ \\t]*[가-힣]){1,3}'",
      '    windowLines: 5',
      '    valueExcludePrefixes: []',
      '    mask: full',
    ].join('\n')
    const parsed = loadPiiPatternsFromYaml(customYaml)
    expect(parsed).not.toBeNull()
    expect(parsed!.length).toBe(1)
    const p = parsed![0]
    expect(p.patternType).toBe('structural')
    if (p.patternType === 'structural') {
      expect(p.labelPattern).toBeDefined()
      expect(p.valuePattern).toBeDefined()
      expect(p.windowLines).toBe(5)
      expect(p.valueExcludePrefixes).toBeDefined()
      expect(p.valueExcludePrefixes!.length).toBe(0)
    }
  })

  it('10. legacy YAML (patternType 누락) — loader 가 single-line 으로 처리 (하위 호환)', () => {
    const legacyYaml = [
      'patterns:',
      '  - id: passport-kr',
      '    kind: passport',
      "    regex: '[MRS]\\d{8}'",
      '    mask: digits',
    ].join('\n')
    const parsed = loadPiiPatternsFromYaml(legacyYaml)
    expect(parsed).not.toBeNull()
    expect(parsed!.length).toBe(1)
    const p = parsed![0]
    // patternType 필드가 없거나 'single-line' 이어야 함
    if (p.patternType !== undefined) {
      expect(p.patternType).toBe('single-line')
    }
    // regex 접근 가능 (single-line 분기)
    if (p.patternType === undefined || p.patternType === 'single-line') {
      expect(p.regex).toBe('[MRS]\\d{8}')
    }
  })
})

describe('structural PII — mergePatterns + compile', () => {
  it('structural + single-line 공존 mergePatterns 정상 작동', () => {
    const merged = mergePatterns(DEFAULT_PATTERNS, [STRUCTURAL_CEO_PATTERN, STRUCTURAL_BRN_PATTERN])
    const ids = merged.map((p) => p.id)
    expect(ids).toContain('brn-hyphen')
    expect(ids).toContain('ceo-multiline-form')
    expect(ids).toContain('brn-multiline-form')
  })
})

/**
 * §5.1.1.9 FP baseline (계획서 §12 E7 (a)):
 * `fixtures/pii-structural-baseline/` 의 synthetic PII-free 문서 N=30 에 대해
 * structural 패턴만으로 detectPii 를 실행하면 match 가 0 건이어야 한다.
 * 1 건이라도 나오면 FP 유형을 로그에 남기고 YAML 조정이 필요하다는 신호.
 */
describe('structural PII — FP baseline 0/30 (§5.1.1.9)', () => {
  const BASELINE_DIR = path.join(__dirname, 'fixtures', 'pii-structural-baseline')

  it('synthetic PII-free 한국어 테크 문서 30건 → structural match 0/30', () => {
    const files = fs.readdirSync(BASELINE_DIR).filter((f) => f.endsWith('.md')).sort()
    expect(files.length).toBe(30)

    const structuralOnly = compileAll([STRUCTURAL_CEO_PATTERN, STRUCTURAL_BRN_PATTERN])
    const offenders: Array<{ file: string; kind: string; value: string }> = []
    let total = 0

    for (const f of files) {
      const txt = fs.readFileSync(path.join(BASELINE_DIR, f), 'utf-8')
      const matches = detectPii(txt, structuralOnly)
      for (const m of matches) {
        if (m.kind === 'ceo-structural' || m.kind === 'brn-structural') {
          offenders.push({ file: f, kind: m.kind, value: m.value })
          total++
        }
      }
    }

    expect(offenders, `FP baseline offenders: ${JSON.stringify(offenders)}`).toEqual([])
    expect(total).toBe(0)
  })
})
