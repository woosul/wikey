/**
 * scripts-runner.test.ts — Phase 4 D.0.f (v6 §4.4.2) + §5.14 Layer 6 + §5.7.1 (2026-05-08).
 *
 * §5.7.1 in-process refactor 후 마이그레이션. 기존 mock bash script 를 in-process mock
 * (cmdCheckJson 의 freshnessOverride / indexedCountOverride + waitUntilFreshWithProvider) 로
 * 대체. 외부 binary spawn 0 — sqlite3 / qmd 미설치 환경에서도 동작.
 *
 * Coverage:
 *   1. parseReindexCheckJsonOutput — fresh / stale / never 세 status parse
 *   2. parseReindexCheckJsonOutput — 깨진 JSON / schema mismatch → throw
 *   3. §5.14 L6 — indexed 누락 시 -1 fallback
 *   4. cmdCheckJson — freshnessOverride + indexedCountOverride → JSON output 정확
 *   5. waitUntilFreshWithProvider — 즉시 fresh resolve
 *   6. waitUntilFreshWithProvider — counter-based stale → fresh 전이
 *   7. waitUntilFreshWithProvider — timeout throw
 *   8. §5.14 L6 — expectMinIndexed=0 default 회귀 없음
 *   9. §5.14 L6 — expectMinIndexed>0, indexed 부족 → timeout throw
 *   10. §5.14 L6 — expectMinIndexed>0, indexed 충분 → resolve
 *   11. §5.14 L6 — timeout error message 에 indexed + expectMin 포함
 *   12. §5.14 L6 — legacy schema (indexed=-1) + expectMinIndexed>0 → 회귀 없음
 *   13. reindexCheckJson — in-process 호출이 plugin runtime 동작 동등
 */

import { describe, it, expect } from 'vitest'
import {
  parseReindexCheckJsonOutput,
  reindexCheckJson,
  waitUntilFreshWithProvider,
  type ReindexCheckResult,
} from '../scripts-runner.js'
import { cmdCheckJson } from '../scripts/reindex.js'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('parseReindexCheckJsonOutput — JSON parse + schema 검증', () => {
  it('fresh status — stale=0, status=fresh, indexed parse', () => {
    const r = parseReindexCheckJsonOutput('{"stale":0,"status":"fresh","indexed":42}')
    expect(r).toEqual({ stale: 0, status: 'fresh', indexed: 42 })
  })

  it('stale status — stale=N, status=stale parse', () => {
    const r = parseReindexCheckJsonOutput('{"stale":3,"status":"stale","indexed":7}')
    expect(r).toEqual({ stale: 3, status: 'stale', indexed: 7 })
  })

  it('never status — stale=-1, status=never parse', () => {
    const r = parseReindexCheckJsonOutput('{"stale":-1,"status":"never","indexed":0}')
    expect(r).toEqual({ stale: -1, status: 'never', indexed: 0 })
  })

  it('깨진 JSON → throw', () => {
    expect(() => parseReindexCheckJsonOutput('not json')).toThrow(/parse failed|schema mismatch/)
  })

  it('schema mismatch — stale not a number → throw', () => {
    expect(() => parseReindexCheckJsonOutput('{"stale":"abc","status":"fresh"}')).toThrow(
      /schema mismatch/,
    )
  })

  it('schema mismatch — unknown status → throw', () => {
    expect(() => parseReindexCheckJsonOutput('{"stale":0,"status":"unknown"}')).toThrow(
      /schema mismatch/,
    )
  })

  // §5.14 L6 — indexed 누락 → -1 fallback (legacy)
  it('§5.14 L6 — indexed 필드 누락 시 -1 fallback (legacy schema)', () => {
    const r = parseReindexCheckJsonOutput('{"stale":0,"status":"fresh"}')
    expect(r).toEqual({ stale: 0, status: 'fresh', indexed: -1 })
  })
})

describe('cmdCheckJson — in-process JSON output (freshnessOverride + indexedCountOverride)', () => {
  it('freshnessOverride=fresh + indexedCountOverride=42 → JSON output 정확', async () => {
    let captured = ''
    const r = await cmdCheckJson({
      basePath: '/tmp',
      freshnessOverride: { status: 'fresh', changedFiles: [] },
      indexedCountOverride: 42,
      write: (s) => {
        captured = s
      },
    })
    expect(r.exitCode).toBe(0)
    const parsed = parseReindexCheckJsonOutput(captured)
    expect(parsed).toEqual({ stale: 0, status: 'fresh', indexed: 42 })
  })

  it('freshnessOverride=stale (3 files) + indexedCountOverride=7 → stale=3', async () => {
    let captured = ''
    const r = await cmdCheckJson({
      basePath: '/tmp',
      freshnessOverride: {
        status: 'stale',
        changedFiles: ['a.md', 'b.md', 'c.md'],
      },
      indexedCountOverride: 7,
      write: (s) => {
        captured = s
      },
    })
    expect(r.exitCode).toBe(0)
    expect(parseReindexCheckJsonOutput(captured)).toEqual({ stale: 3, status: 'stale', indexed: 7 })
  })

  it('freshnessOverride=never → stale=-1, indexedCountOverride=0', async () => {
    let captured = ''
    await cmdCheckJson({
      basePath: '/tmp',
      freshnessOverride: { status: 'never', changedFiles: [] },
      indexedCountOverride: 0,
      write: (s) => {
        captured = s
      },
    })
    expect(parseReindexCheckJsonOutput(captured)).toEqual({ stale: -1, status: 'never', indexed: 0 })
  })

  // 기존 .sh 와 byte-equal: indexed=-1 (sqlite 없음) 기본 fallback
  it('sqliteDb 미존재 + indexedCountOverride 미지정 → indexed=-1 (legacy fallback)', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-'))
    try {
      mkdirSync(join(tmp, 'wiki'), { recursive: true })
      let captured = ''
      await cmdCheckJson({
        basePath: tmp,
        sqliteDb: join(tmp, 'nonexistent.db'),
        freshnessOverride: { status: 'fresh', changedFiles: [] },
        write: (s) => {
          captured = s
        },
      })
      expect(parseReindexCheckJsonOutput(captured)).toEqual({
        stale: 0,
        status: 'fresh',
        indexed: -1,
      })
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})

describe('waitUntilFreshWithProvider — provider injection mock', () => {
  it('즉시 fresh → resolve 반환값 없음', async () => {
    const provider = async (): Promise<ReindexCheckResult> => ({
      stale: 0,
      status: 'fresh',
      indexed: 10,
    })
    await expect(waitUntilFreshWithProvider(provider, 2000, 50)).resolves.toBeUndefined()
  })

  it('처음 stale → fresh 로 전이 후 resolve (counter-based mock)', async () => {
    let count = 0
    const provider = async (): Promise<ReindexCheckResult> => {
      count += 1
      if (count >= 3) return { stale: 0, status: 'fresh', indexed: 10 }
      return { stale: 2, status: 'stale', indexed: 8 }
    }
    await expect(waitUntilFreshWithProvider(provider, 5000, 50)).resolves.toBeUndefined()
    expect(count).toBeGreaterThanOrEqual(3)
  })

  it('timeout 초과 시 throw (계속 stale)', async () => {
    const provider = async (): Promise<ReindexCheckResult> => ({
      stale: 5,
      status: 'stale',
      indexed: 3,
    })
    await expect(waitUntilFreshWithProvider(provider, 400, 100)).rejects.toThrow(/freshness timeout/)
  })

  // §5.14 L6: expectMinIndexed=0 default — indexed=0 도 fresh resolve (회귀 없음)
  it('§5.14 L6 — expectMinIndexed=0 default, indexed=0 fresh → resolve', async () => {
    const provider = async (): Promise<ReindexCheckResult> => ({
      stale: 0,
      status: 'fresh',
      indexed: 0,
    })
    await expect(waitUntilFreshWithProvider(provider, 2000, 50)).resolves.toBeUndefined()
  })

  // §5.14 L6: expectMinIndexed>0 + indexed 부족 → timeout throw
  it('§5.14 L6 — expectMinIndexed=5, indexed=2 → timeout throw', async () => {
    const provider = async (): Promise<ReindexCheckResult> => ({
      stale: 0,
      status: 'fresh',
      indexed: 2,
    })
    await expect(waitUntilFreshWithProvider(provider, 400, 100, 5)).rejects.toThrow(
      /freshness timeout/,
    )
  })

  // §5.14 L6: expectMinIndexed>0 + indexed 충분 → resolve
  it('§5.14 L6 — expectMinIndexed=5, indexed=7 → resolve', async () => {
    const provider = async (): Promise<ReindexCheckResult> => ({
      stale: 0,
      status: 'fresh',
      indexed: 7,
    })
    await expect(waitUntilFreshWithProvider(provider, 2000, 50, 5)).resolves.toBeUndefined()
  })

  // §5.14 L6: timeout error message 에 indexed + expectMin surface
  it('§5.14 L6 — timeout error 에 indexed + expectMin 포함', async () => {
    const provider = async (): Promise<ReindexCheckResult> => ({
      stale: 0,
      status: 'fresh',
      indexed: 3,
    })
    await expect(waitUntilFreshWithProvider(provider, 300, 100, 10)).rejects.toThrow(
      /indexed=3.*expectMin=10|expectMin=10.*indexed=3/,
    )
  })

  // §5.14 L6: legacy schema (indexed=-1) + expectMinIndexed>0 → 회귀 없음 resolve (backward compat)
  it('§5.14 L6 — legacy schema (indexed=-1) + expectMinIndexed=5 → resolve', async () => {
    const provider = async (): Promise<ReindexCheckResult> => ({
      stale: 0,
      status: 'fresh',
      indexed: -1,
    })
    await expect(waitUntilFreshWithProvider(provider, 2000, 50, 5)).resolves.toBeUndefined()
  })
})

describe('reindexCheckJson — in-process round-trip (production path)', () => {
  it('실 basePath + stamp/sqlite override + stamp file 없음 → never status', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-rt-'))
    try {
      mkdirSync(join(tmp, 'wiki'), { recursive: true })
      writeFileSync(join(tmp, 'wiki', 'foo.md'), '---\ntitle: x\n---\nbody', 'utf-8')
      // env override 로 stamp/sqlite 를 임시 path 로 강제 — production env 와 격리
      const env: Record<string, string> = {
        WIKEY_QMD_STAMP_FILE: join(tmp, 'no-stamp'),
        WIKEY_QMD_SQLITE_DB: join(tmp, 'no-db.sqlite'),
      }
      const r = await reindexCheckJson(tmp, env)
      expect(r.status).toBe('never')
      expect(r.stale).toBe(-1)
      expect(r.indexed).toBe(-1) // sqlite 없음 → -1 fallback
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('실 basePath + stamp file 존재 + 변경 파일 없음 → fresh status', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-rt-'))
    try {
      mkdirSync(join(tmp, 'wiki'), { recursive: true })
      const wikiFile = join(tmp, 'wiki', 'foo.md')
      writeFileSync(wikiFile, '---\ntitle: x\n---\nbody', 'utf-8')
      // wiki file 보다 미래 mtime 으로 stamp 작성
      const stampPath = join(tmp, 'stamp')
      writeFileSync(stampPath, '', 'utf-8')
      const future = new Date(Date.now() + 60_000)
      const fs = await import('node:fs')
      fs.utimesSync(stampPath, future, future)
      const env: Record<string, string> = {
        WIKEY_QMD_STAMP_FILE: stampPath,
        WIKEY_QMD_SQLITE_DB: join(tmp, 'no-db.sqlite'),
      }
      const r = await reindexCheckJson(tmp, env)
      expect(r.status).toBe('fresh')
      expect(r.stale).toBe(0)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
