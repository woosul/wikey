/**
 * §5.7.5 RED — AC-L15 reindex.ts lazy Kiwi tokenizer import.
 *
 * engine='qmd' branch 진입 시 createKoreanTokenizer 가 import / load 안 됨 (lazy).
 * production lazy import 검증 — module 안에서 함수 export source 가 dynamic import 함수
 * 형태로 되어있는지, 또는 engine='qmd' 시 createKoreanTokenizer 호출 path 가 0 인지.
 *
 * 검증 전략 (단순 + 결정적):
 *   - reindex.ts source 를 read 후 createKoreanTokenizer top-level static import 부재 확증
 *     (또는 dynamic import('../search/orama-korean-tokenizer.js') 형태가 runOramaIngest
 *      안에 위치)
 *   - engine='qmd' path 가 createKoreanTokenizer 호출 0 인지 indirect 검증.
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REINDEX_SRC = join(__dirname, '..', '..', 'scripts', 'reindex.ts')

describe('§5.7.5 reindex.ts lazy Kiwi tokenizer import', () => {
  it('AC-L15: createKoreanTokenizer is lazy-imported inside runOramaIngest, not at top level', () => {
    const src = readFileSync(REINDEX_SRC, 'utf-8')

    // Top-level static import of createKoreanTokenizer must be removed (lazy import only)
    const topLevelStaticMatch = src.match(
      /^import\s+\{[^}]*createKoreanTokenizer[^}]*\}\s+from\s+['"][^'"]*orama-korean-tokenizer/m,
    )
    expect(
      topLevelStaticMatch,
      'reindex.ts must not statically import createKoreanTokenizer at top level (lazy load only)',
    ).toBeNull()

    // Dynamic import must exist somewhere (in runOramaIngest body)
    const dynamicMatch = src.match(/await\s+import\(\s*['"][^'"]*orama-korean-tokenizer/u)
    expect(
      dynamicMatch,
      'reindex.ts must dynamic-import orama-korean-tokenizer inside runOramaIngest',
    ).not.toBeNull()
  })
})
