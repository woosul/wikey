import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, utimesSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  computeCacheKey,
  getCached,
  setCached,
  invalidate,
  cleanup,
  stats,
} from '../convert-cache.js'

// convert-cache 는 ~/.cache/wikey/convert 에 기록. 테스트 격리를 위해 HOME 임시 오버라이드.
let originalHome: string | undefined
let tmpHome: string

beforeEach(() => {
  originalHome = process.env.HOME
  tmpHome = mkdtempSync(join(tmpdir(), 'wikey-cache-test-'))
  process.env.HOME = tmpHome
})

afterEach(() => {
  if (originalHome) process.env.HOME = originalHome
  try { rmSync(tmpHome, { recursive: true, force: true }) } catch { /* ignore */ }
})

describe('computeCacheKey', () => {
  it('동일 입력 → 동일 키 (deterministic)', () => {
    const k1 = computeCacheKey({ sourceBytes: Buffer.from('abc'), converter: 'docling', majorOptions: { table_mode: 'accurate' } })
    const k2 = computeCacheKey({ sourceBytes: Buffer.from('abc'), converter: 'docling', majorOptions: { table_mode: 'accurate' } })
    expect(k1).toBe(k2)
    expect(k1).toMatch(/^[a-f0-9]{64}$/) // sha256 hex
  })

  it('converter 다르면 키 다름', () => {
    const a = computeCacheKey({ sourceBytes: Buffer.from('abc'), converter: 'docling' })
    const b = computeCacheKey({ sourceBytes: Buffer.from('abc'), converter: 'markitdown' })
    expect(a).not.toBe(b)
  })

  it('옵션 다르면 키 다름', () => {
    const a = computeCacheKey({ sourceBytes: Buffer.from('abc'), converter: 'docling', majorOptions: { table_mode: 'accurate' } })
    const b = computeCacheKey({ sourceBytes: Buffer.from('abc'), converter: 'docling', majorOptions: { table_mode: 'fast' } })
    expect(a).not.toBe(b)
  })

  it('옵션 순서 무관', () => {
    const a = computeCacheKey({ sourceBytes: Buffer.from('abc'), converter: 'docling', majorOptions: { a: 1, b: 2 } })
    const b = computeCacheKey({ sourceBytes: Buffer.from('abc'), converter: 'docling', majorOptions: { b: 2, a: 1 } })
    expect(a).toBe(b)
  })
})

describe('setCached / getCached', () => {
  it('저장 후 조회', () => {
    const key = computeCacheKey({ sourceBytes: Buffer.from('x'), converter: 'docling' })
    expect(getCached(key)).toBeNull()
    setCached(key, '# hello world', { source: 'test.pdf', converter: 'docling' })
    expect(getCached(key)).toBe('# hello world')
  })

  it('다른 키는 간섭 없음', () => {
    const k1 = computeCacheKey({ sourceBytes: Buffer.from('A'), converter: 'docling' })
    const k2 = computeCacheKey({ sourceBytes: Buffer.from('B'), converter: 'docling' })
    setCached(k1, 'alpha', { source: 'a.pdf', converter: 'docling' })
    setCached(k2, 'beta', { source: 'b.pdf', converter: 'docling' })
    expect(getCached(k1)).toBe('alpha')
    expect(getCached(k2)).toBe('beta')
  })
})

describe('invalidate', () => {
  it('캐시 항목 제거', () => {
    const key = computeCacheKey({ sourceBytes: Buffer.from('y'), converter: 'docling' })
    setCached(key, '# temp', { source: 't.pdf', converter: 'docling' })
    expect(getCached(key)).toBe('# temp')
    expect(invalidate(key)).toBe(true)
    expect(getCached(key)).toBeNull()
  })

  it('존재하지 않는 키 invalidate → false, 에러 없음', () => {
    expect(invalidate('nonexistent_' + 'a'.repeat(60))).toBe(false)
  })
})

describe('TTL 만료', () => {
  it('TTL 지난 파일은 getCached 시 null + 자동 삭제', () => {
    const key = computeCacheKey({ sourceBytes: Buffer.from('z'), converter: 'docling' })
    setCached(key, '# old', { source: 'o.pdf', converter: 'docling' })
    // 파일 mtime 을 40일 전으로 강제
    const p = join(tmpHome, '.cache', 'wikey', 'convert', `${key}.md`)
    expect(existsSync(p)).toBe(true)
    const past = (Date.now() - 40 * 24 * 3600 * 1000) / 1000
    utimesSync(p, past, past)

    expect(getCached(key, 30)).toBeNull()
    expect(existsSync(p)).toBe(false)
  })
})

describe('cleanup', () => {
  it('만료·orphan 모두 정리', () => {
    const k = computeCacheKey({ sourceBytes: Buffer.from('1'), converter: 'docling' })
    setCached(k, '# fresh', { source: '1.pdf', converter: 'docling' })

    // orphan: index 에 없지만 디스크에 md 파일 존재
    const orphanPath = join(tmpHome, '.cache', 'wikey', 'convert', 'a'.repeat(64) + '.md')
    writeFileSync(orphanPath, '# orphan')

    const before = stats().count
    const removed = cleanup(30)
    expect(removed).toBeGreaterThanOrEqual(1) // 최소 orphan 1개
    expect(existsSync(orphanPath)).toBe(false)
    expect(stats().count).toBe(before) // fresh 항목은 그대로
  })
})

describe('stats', () => {
  it('count / totalBytes 보고', () => {
    setCached(computeCacheKey({ sourceBytes: Buffer.from('a'), converter: 'x' }), 'foo', { source: 'a', converter: 'x' })
    setCached(computeCacheKey({ sourceBytes: Buffer.from('b'), converter: 'x' }), 'bar!', { source: 'b', converter: 'x' })
    const s = stats()
    expect(s.count).toBe(2)
    expect(s.totalBytes).toBe(Buffer.byteLength('foo', 'utf-8') + Buffer.byteLength('bar!', 'utf-8'))
  })
})
