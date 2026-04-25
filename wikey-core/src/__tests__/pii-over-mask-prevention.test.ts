/**
 * pii-over-mask-prevention.test.ts — Phase 5 §5.1 follow-up (2026-04-25).
 *
 * Master CDP smoke 에서 발견된 over-masking 4건 회귀 방지.
 * 계획서: `plan/post-compact-handoff.md` ① — bundled YAML 의
 * ceo-multiline-form valueExcludePrefixes 에 일반 폼 라벨 13종 추가 +
 * isCandidateExcluded 가 same-line 모든 토큰을 검사하도록 보강.
 *
 * 기대: bundled default 만으로 ceo-blank-line / ceo-table-cell fixture 에서
 * structural CEO 매치가 정확히 1건 (홍 길 동 / 이 영 희) 으로 좁혀짐.
 */

import { describe, it, expect, beforeAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectPii } from '../pii-redact.js'
import { loadPiiPatterns, type CompiledPiiPattern } from '../pii-patterns.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const FIXTURE_DIR = path.join(__dirname, 'fixtures', 'pii-structural')

function loadFixture(name: string): string {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf-8')
}

describe('PII over-masking 회귀 방지 (bundled YAML default)', () => {
  let patterns: readonly CompiledPiiPattern[]

  beforeAll(() => {
    patterns = loadPiiPatterns()
  })

  it('ceo-blank-line.md — structural CEO 매치는 ["홍 길 동"] 1건 (등기일 false-positive 차단)', () => {
    const md = loadFixture('ceo-blank-line.md')
    const ceo = detectPii(md, patterns)
      .filter((m) => m.kind === 'ceo-structural')
      .map((m) => m.value)
    expect(ceo).toEqual(['홍 길 동'])
  })

  it('ceo-table-cell.md — structural CEO 매치는 ["이 영 희"] 1건 (주소·서울시 어·딘가 차단)', () => {
    const md = loadFixture('ceo-table-cell.md')
    const ceo = detectPii(md, patterns)
      .filter((m) => m.kind === 'ceo-structural')
      .map((m) => m.value)
    expect(ceo).toEqual(['이 영 희'])
  })

  it('candidate-prefix vs context-label 분리 — 라벨 단어로 시작하는 실재 이름 false-negative 방지 (codex P2)', () => {
    // '주소영' 은 contextLabelPrefixes 의 '주소' 와 음절이 겹치는 실재 한국 이름.
    // candidate self check 는 valueExcludePrefixes (회사명) 에만 — '주소' 로 candidate
    // self 가 차단되면 안 된다. label 이 같은 줄에 없으면 PII 로 탐지되어야 함.
    const md = '대표자\n\n주 소 영\n'
    const ceo = detectPii(md, patterns)
      .filter((m) => m.kind === 'ceo-structural')
      .map((m) => m.value)
    expect(ceo).toEqual(['주 소 영'])
  })
})
