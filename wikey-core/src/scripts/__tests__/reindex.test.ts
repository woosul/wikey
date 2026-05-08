/**
 * reindex.test.ts — Phase 5 §5.7.1 (2026-05-08).
 *
 * 외부 binary (qmd / python3 / sqlite3) spawn 회피 — freshness logic + cmdCheckJson 의
 * options 시나리오만 cover. cmdReindex full/quick 의 외부 binary 호출은 obsidian-cdp
 * 라이브 cycle smoke 에서 검증.
 */
import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkFreshness, cmdCheck, cmdCheckJson } from '../reindex.js'

describe('checkFreshness', () => {
  it('stamp file 없음 → never', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-rx-'))
    try {
      mkdirSync(join(tmp, 'wiki'), { recursive: true })
      writeFileSync(join(tmp, 'wiki', 'a.md'), 'x', 'utf-8')
      const r = checkFreshness({
        basePath: tmp,
        stampFile: join(tmp, 'no-stamp'),
      })
      expect(r.status).toBe('never')
      expect(r.changedFiles).toEqual([])
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('stamp file 있고 wiki 변경 없음 → fresh', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-rx-'))
    try {
      mkdirSync(join(tmp, 'wiki'), { recursive: true })
      writeFileSync(join(tmp, 'wiki', 'a.md'), 'x', 'utf-8')
      const stamp = join(tmp, 'stamp')
      writeFileSync(stamp, '', 'utf-8')
      // stamp 가 wiki 보다 미래 mtime
      const future = new Date(Date.now() + 60_000)
      utimesSync(stamp, future, future)
      const r = checkFreshness({ basePath: tmp, stampFile: stamp })
      expect(r.status).toBe('fresh')
      expect(r.changedFiles).toEqual([])
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('stamp file 있고 wiki 변경 있음 → stale', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-rx-'))
    try {
      mkdirSync(join(tmp, 'wiki'), { recursive: true })
      const stamp = join(tmp, 'stamp')
      writeFileSync(stamp, '', 'utf-8')
      const past = new Date(Date.now() - 60_000)
      utimesSync(stamp, past, past)
      writeFileSync(join(tmp, 'wiki', 'a.md'), 'x', 'utf-8')
      const r = checkFreshness({ basePath: tmp, stampFile: stamp })
      expect(r.status).toBe('stale')
      expect(r.changedFiles.length).toBeGreaterThan(0)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('stale 5+ 파일 — head -5 동등 (5 reach 후 break)', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-rx-'))
    try {
      mkdirSync(join(tmp, 'wiki'), { recursive: true })
      const stamp = join(tmp, 'stamp')
      writeFileSync(stamp, '', 'utf-8')
      const past = new Date(Date.now() - 60_000)
      utimesSync(stamp, past, past)
      // 10 개 파일 — 5 만 capture
      for (let i = 0; i < 10; i += 1) {
        writeFileSync(join(tmp, 'wiki', `f${i}.md`), 'x', 'utf-8')
      }
      const r = checkFreshness({ basePath: tmp, stampFile: stamp })
      expect(r.status).toBe('stale')
      expect(r.changedFiles.length).toBe(5)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})

describe('cmdCheckJson — AC10 stdout 단일 JSON', () => {
  it('freshnessOverride=fresh → 단일 JSON 라인 + exit 0', async () => {
    const lines: string[] = []
    const r = await cmdCheckJson({
      basePath: '/tmp',
      freshnessOverride: { status: 'fresh', changedFiles: [] },
      indexedCountOverride: 100,
      write: (s) => lines.push(s),
    })
    expect(r.exitCode).toBe(0)
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0])).toEqual({ stale: 0, status: 'fresh', indexed: 100 })
  })

  it('freshnessOverride=stale (3 files) → stale=3', async () => {
    const lines: string[] = []
    await cmdCheckJson({
      basePath: '/tmp',
      freshnessOverride: { status: 'stale', changedFiles: ['a', 'b', 'c'] },
      indexedCountOverride: 50,
      write: (s) => lines.push(s),
    })
    expect(JSON.parse(lines[0])).toEqual({ stale: 3, status: 'stale', indexed: 50 })
  })

  it('freshnessOverride=never → stale=-1, indexed=0', async () => {
    const lines: string[] = []
    await cmdCheckJson({
      basePath: '/tmp',
      freshnessOverride: { status: 'never', changedFiles: [] },
      indexedCountOverride: 0,
      write: (s) => lines.push(s),
    })
    expect(JSON.parse(lines[0])).toEqual({ stale: -1, status: 'never', indexed: 0 })
  })
})

describe('cmdCheck (human-readable) — AC9', () => {
  it('freshnessOverride=never + sqlite 없음 → "타임스탬프 없음" + 문서/벡터 ?', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-rx-'))
    try {
      const lines: string[] = []
      const r = await cmdCheck({
        basePath: tmp,
        stampFile: join(tmp, 'no-stamp'),
        sqliteDb: join(tmp, 'no-db.sqlite'),
        write: (s) => lines.push(s),
      })
      expect(r.exitCode).toBe(0)
      const out = lines.join('\n')
      expect(out).toContain('=== 인덱스 상태 확인 ===')
      expect(out).toContain('인덱스 타임스탬프 없음')
      expect(out).toContain('문서: ?개')
      expect(out).toContain('벡터: ?청크')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('stamp file 있고 wiki 변경 없음 → "인덱스 최신"', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-rx-'))
    try {
      mkdirSync(join(tmp, 'wiki'), { recursive: true })
      writeFileSync(join(tmp, 'wiki', 'a.md'), 'x', 'utf-8')
      const stamp = join(tmp, 'stamp')
      writeFileSync(stamp, '', 'utf-8')
      const future = new Date(Date.now() + 60_000)
      utimesSync(stamp, future, future)
      const lines: string[] = []
      await cmdCheck({
        basePath: tmp,
        stampFile: stamp,
        sqliteDb: join(tmp, 'no-db.sqlite'),
        write: (s) => lines.push(s),
      })
      expect(lines.join('\n')).toContain('인덱스 최신')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
