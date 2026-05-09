/**
 * §5.7.5 RED — AC-L5 production code lowercase 일관 (사용자 결정 #4).
 *
 * 사용자 결정 #4 = code lowercase 유지 + spec/PoC docs 정정. production code 의
 * `orama-korean-tokenizer.ts` 가 alphanumeric path + Korean content POS 양쪽
 * `toLowerCase()` 적용함을 source-level 로 확증한다.
 *
 * Python `scripts/korean-tokenize.py` 측은 lowercase 미적용 (사용자 결정 = code
 * lowercase 유지, Python docs 정정만 본 cycle). 본 단위 테스트의 책임은 production
 * code (orama-korean-tokenizer.ts) 가 양쪽 path 모두 lowercase 적용함을 grep 으로
 * 확증.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const TOKENIZER_SRC = join(
  __dirname,
  '..',
  '..',
  'search',
  'orama-korean-tokenizer.ts',
)

describe('§5.7.5 lowercase consistency (production code)', () => {
  it('AC-L5: orama-korean-tokenizer applies toLowerCase() to both alnum and Korean content POS', () => {
    const src = readFileSync(TOKENIZER_SRC, 'utf-8')
    // alphanumeric branch must lowercase the token
    expect(
      /word\.toLowerCase\(\)/.test(src),
      'alnum branch must apply toLowerCase()',
    ).toBe(true)
    // Korean content POS branch must lowercase t.str
    expect(
      /t\.str\.toLowerCase\(\)/.test(src),
      'Korean content POS branch must apply toLowerCase()',
    ).toBe(true)
  })
})
