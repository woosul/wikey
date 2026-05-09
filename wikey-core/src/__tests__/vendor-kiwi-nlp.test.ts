/**
 * §5.7.4 RED — kiwi-nlp 부분 vendor 검증 (B-2 sparse vendor).
 *
 * AC-V2: vendor 디렉토리 + LICENSE + dist artifacts + VENDOR.md + sync docs 존재 + import path 작동.
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const VENDOR_ROOT = join(__dirname, '..', '..', 'vendor', 'kiwi-nlp')
const REPO_ROOT = join(__dirname, '..', '..', '..')

describe('kiwi-nlp vendor (B-2 sparse vendor)', () => {
  it('AC-V2: vendor directory contains LICENSE, dist artifacts, VENDOR.md, and sync docs exist', () => {
    // (a) vendor/kiwi-nlp/ 디렉토리 존재
    expect(existsSync(VENDOR_ROOT)).toBe(true)

    // (b) LICENSE — Kiwi 본가 root LGPL-2.1 별 fetch
    const licensePath = join(VENDOR_ROOT, 'LICENSE')
    expect(existsSync(licensePath)).toBe(true)
    const licenseText = readFileSync(licensePath, 'utf-8')
    expect(licenseText.length).toBeGreaterThan(100)

    // (c) JS wrapper canonical (dist/build/kiwi-wasm.js) + WASM binary (dist/kiwi-wasm.wasm)
    expect(existsSync(join(VENDOR_ROOT, 'dist', 'build', 'kiwi-wasm.js'))).toBe(true)
    expect(existsSync(join(VENDOR_ROOT, 'dist', 'kiwi-wasm.wasm'))).toBe(true)

    // (d) JS wrapper import path canonical = '../../vendor/kiwi-nlp/dist/build/kiwi-wasm.js'
    //   (orama-korean-tokenizer 가 이 path 를 사용하면 build PASS)
    //   import path 자체는 별도 spec/test 에서 검증; 본 case 는 file 존재로 단순화.

    // (e) vendor build prerequisites — package.json + tsconfig.json + src/
    expect(existsSync(join(VENDOR_ROOT, 'package.json'))).toBe(true)
    expect(existsSync(join(VENDOR_ROOT, 'tsconfig.json'))).toBe(true)
    expect(existsSync(join(VENDOR_ROOT, 'src'))).toBe(true)

    // (f) VENDOR.md (master 추적용) + sync docs
    expect(existsSync(join(VENDOR_ROOT, 'VENDOR.md'))).toBe(true)
    expect(existsSync(join(REPO_ROOT, 'docs', 'kiwi-nlp-vendor-sync.md'))).toBe(true)
  })
})
