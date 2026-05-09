/**
 * §5.7.4 RED — orama-korean-tokenizer 단위 테스트.
 *
 * AC-T1: createKoreanTokenizer 가 KoreanTokenizerHandle 반환 + close() 후 재 호출 에러.
 * AC-T2: smart_tokenize alphanumeric (BM25 / ISO 등) 보존 + 한글 content POS 필터.
 * AC-T3: empty / null 입력 → [].
 * AC-W1: Production-like fixture (vendor wasm + ~/.cache/wikey/kiwi-models/) 에서 init 작동.
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createKoreanTokenizer } from '../../search/orama-korean-tokenizer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const VENDOR_WASM = join(
  __dirname,
  '..',
  '..',
  '..',
  'vendor',
  'kiwi-nlp',
  'dist',
  'kiwi-wasm.wasm',
)
const MODEL_DIR = join(homedir(), '.cache', 'wikey', 'kiwi-models', 'cong', 'base')

const SKIP_REASON = (() => {
  if (!existsSync(VENDOR_WASM)) return `vendor wasm not found at ${VENDOR_WASM}`
  if (!existsSync(MODEL_DIR)) return `Kiwi model cache not found at ${MODEL_DIR}`
  if (!existsSync(join(MODEL_DIR, 'sj.morph'))) return 'sj.morph missing'
  return null
})()

describe.skipIf(SKIP_REASON !== null)('orama-korean-tokenizer (live Kiwi)', () => {
  it('AC-T1: createKoreanTokenizer returns KoreanTokenizerHandle; close() then re-tokenize errors', async () => {
    const wasmBinary = new Uint8Array(readFileSync(VENDOR_WASM))
    const handle = await createKoreanTokenizer({
      wasmPath: VENDOR_WASM,
      wasmBinary,
      modelDir: MODEL_DIR,
    })
    expect(handle).toBeDefined()
    expect(typeof handle.tokenize).toBe('function')
    expect(typeof handle.close).toBe('function')
    handle.close()
    expect(() => handle.tokenize('알고리즘')).toThrow()
  }, 60_000)

  it('AC-T2: smart_tokenize preserves alphanumeric + Korean content POS', async () => {
    const wasmBinary = new Uint8Array(readFileSync(VENDOR_WASM))
    const handle = await createKoreanTokenizer({
      wasmPath: VENDOR_WASM,
      wasmBinary,
      modelDir: MODEL_DIR,
    })
    try {
      const tokens = handle.tokenize('BM25 알고리즘 정확도')
      // Alphanumeric token preserved as-is (lowercase per smart_tokenize)
      expect(tokens).toContain('bm25')
      // Korean content tokens (lowercase)
      expect(tokens).toContain('알고리즘')
      expect(tokens).toContain('정확도')
    } finally {
      handle.close()
    }
  }, 60_000)

  it('AC-T3: empty / null / undefined input returns []', async () => {
    const wasmBinary = new Uint8Array(readFileSync(VENDOR_WASM))
    const handle = await createKoreanTokenizer({
      wasmPath: VENDOR_WASM,
      wasmBinary,
      modelDir: MODEL_DIR,
    })
    try {
      expect(handle.tokenize('')).toEqual([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(handle.tokenize(null as any)).toEqual([])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(handle.tokenize(undefined as any)).toEqual([])
    } finally {
      handle.close()
    }
  }, 60_000)

  it('AC-W1: production-like init (vendor wasm + cache modelDir) — Korean sample tokenizes', async () => {
    // Production-like = node_modules 의존 없이 vendor wasm 만 + Kiwi cache dir 만 사용.
    expect(existsSync(VENDOR_WASM)).toBe(true)
    expect(existsSync(join(MODEL_DIR, 'sj.morph'))).toBe(true)
    const wasmBinary = new Uint8Array(readFileSync(VENDOR_WASM))
    const handle = await createKoreanTokenizer({
      wasmPath: VENDOR_WASM,
      wasmBinary,
      modelDir: MODEL_DIR,
    })
    try {
      const tokens = handle.tokenize('한국어 처리')
      expect(Array.isArray(tokens)).toBe(true)
      expect(tokens.length).toBeGreaterThan(0)
    } finally {
      handle.close()
    }
  }, 60_000)
})

if (SKIP_REASON !== null) {
  // eslint-disable-next-line no-console
  console.warn(`[orama-korean-tokenizer] tests SKIPPED: ${SKIP_REASON}`)
}
