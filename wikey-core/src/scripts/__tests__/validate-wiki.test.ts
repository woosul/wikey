/**
 * validate-wiki.test.ts — Phase 5 §5.7.1 (2026-05-08).
 *
 * AC: 6 검증 PASS / 각 검증 FAIL scenario / exit code.
 */
import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runValidateWiki } from '../validate-wiki.js'

function setupWiki(parent: string, files: Record<string, string>): void {
  for (const [rel, content] of Object.entries(files)) {
    const p = join(parent, rel)
    mkdirSync(join(p, '..'), { recursive: true })
    writeFileSync(p, content, 'utf-8')
  }
}

describe('runValidateWiki — AC3/AC4', () => {
  it('AC3 — 정상 wiki/ → exit 0, "PASS: 모든 검증 통과"', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-vw-'))
    try {
      setupWiki(tmp, {
        'wiki/index.md':
          '---\ntitle: index\n---\n## 엔티티\n- [[foo]] — desc\n## 개념\n- [[bar]] — desc',
        'wiki/log.md': '---\ntitle: log\n---\n## [2026-05-08] ingest | test\n- 변경',
        'wiki/entities/foo.md': '---\ntitle: foo\n---\n본문',
        'wiki/concepts/bar.md': '---\ntitle: bar\n---\n본문',
      })
      const lines: string[] = []
      const r = await runValidateWiki({ basePath: tmp, write: (s) => lines.push(s) })
      expect(r.exitCode).toBe(0)
      expect(r.errorCount).toBe(0)
      expect(lines.at(-1)).toBe('PASS: 모든 검증 통과')
      // 6 검증 헤더 모두 출력
      expect(lines).toContain('=== 검증 1: 프론트매터 확인 ===')
      expect(lines).toContain('=== 검증 2: 위키링크 확인 ===')
      expect(lines).toContain('=== 검증 3: 인덱스 등재 확인 ===')
      expect(lines).toContain('=== 검증 4: log.md 형식 확인 ===')
      expect(lines).toContain('=== 검증 5: 중복 파일명 확인 ===')
      expect(lines).toContain('=== 검증 6: raw vs wiki basename 충돌 확인 ===')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('AC4 — 깨진 위키링크 → exit 1 + FAIL 라인', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-vw-'))
    try {
      setupWiki(tmp, {
        'wiki/index.md': '---\ntitle: index\n---\n## 엔티티\n- [[foo]] — desc',
        'wiki/log.md': '---\ntitle: log\n---\n',
        'wiki/entities/foo.md':
          '---\ntitle: foo\n---\n본문 [[non-existent-page]] 깨진 링크 [[also-broken]]',
      })
      const lines: string[] = []
      const r = await runValidateWiki({ basePath: tmp, write: (s) => lines.push(s) })
      expect(r.exitCode).toBe(1)
      expect(r.errorCount).toBeGreaterThanOrEqual(2)
      const out = lines.join('\n')
      expect(out).toMatch(/FAIL: wiki\/entities\/foo\.md: 깨진 위키링크 \[\[non-existent-page\]\]/)
      expect(out).toMatch(/FAIL: wiki\/entities\/foo\.md: 깨진 위키링크 \[\[also-broken\]\]/)
      expect(lines.at(-1)).toMatch(/^FAIL: \d+건 오류 발견$/)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('검증 1 — 프론트매터 누락 → FAIL', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-vw-'))
    try {
      setupWiki(tmp, {
        'wiki/index.md': '---\ntitle: index\n---\n',
        'wiki/log.md': '---\ntitle: log\n---\n',
        'wiki/no-fm.md': '본문만 — 프론트매터 없음',
      })
      const lines: string[] = []
      const r = await runValidateWiki({ basePath: tmp, write: (s) => lines.push(s) })
      expect(r.exitCode).toBe(1)
      expect(lines.join('\n')).toContain('FAIL: wiki/no-fm.md: 프론트매터 없음')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('검증 3 — index.md 미등재 → FAIL', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-vw-'))
    try {
      setupWiki(tmp, {
        'wiki/index.md': '---\ntitle: index\n---\n## 엔티티\n- [[foo]] — desc',
        'wiki/log.md': '---\ntitle: log\n---\n',
        'wiki/entities/foo.md': '---\ntitle: foo\n---\n본문',
        'wiki/entities/orphan.md': '---\ntitle: orphan\n---\n본문',
      })
      const lines: string[] = []
      const r = await runValidateWiki({ basePath: tmp, write: (s) => lines.push(s) })
      expect(r.exitCode).toBe(1)
      expect(lines.join('\n')).toContain('FAIL: wiki/entities/orphan.md: index.md에 미등재')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('검증 4 — log.md 잘못된 형식 → FAIL', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-vw-'))
    try {
      setupWiki(tmp, {
        'wiki/index.md': '---\ntitle: index\n---\n',
        // body 안 ## 라인이 [YYYY-MM-DD] 형식 아님
        'wiki/log.md': '---\ntitle: log\n---\n## 잘못된 헤더\n',
      })
      const lines: string[] = []
      const r = await runValidateWiki({ basePath: tmp, write: (s) => lines.push(s) })
      expect(r.exitCode).toBe(1)
      expect(lines.join('\n')).toContain('FAIL: log.md: 잘못된 형식 — ## 잘못된 헤더')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('검증 5 — 중복 basename → FAIL', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-vw-'))
    try {
      setupWiki(tmp, {
        'wiki/index.md': '---\ntitle: index\n---\n## 엔티티\n- [[foo]] — desc',
        'wiki/log.md': '---\ntitle: log\n---\n',
        'wiki/entities/foo.md': '---\ntitle: foo\n---\n본문',
        'wiki/concepts/foo.md': '---\ntitle: foo\n---\n본문',
      })
      const lines: string[] = []
      const r = await runValidateWiki({ basePath: tmp, write: (s) => lines.push(s) })
      expect(r.exitCode).toBe(1)
      expect(lines.join('\n')).toContain('FAIL: 중복 파일명: foo.md')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('검증 6 — raw vs wiki basename 충돌 → FAIL', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-vw-'))
    try {
      setupWiki(tmp, {
        'wiki/index.md': '---\ntitle: index\n---\n## 엔티티\n- [[foo]] — desc',
        'wiki/log.md': '---\ntitle: log\n---\n',
        'wiki/entities/foo.md': '---\ntitle: foo\n---\n본문',
        'raw/0_inbox/foo.md': '# raw foo',
      })
      const lines: string[] = []
      const r = await runValidateWiki({ basePath: tmp, write: (s) => lines.push(s) })
      expect(r.exitCode).toBe(1)
      expect(lines.join('\n')).toContain('basename 충돌: foo.md')
      expect(lines.join('\n')).toContain('§5.13.A1')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('검증 2 — wiki/ 안 link.md fallback (basename 매칭)', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-vw-'))
    try {
      setupWiki(tmp, {
        'wiki/index.md': '---\ntitle: index\n---\n## 엔티티\n- [[foo]] — desc\n- [[bar]]',
        'wiki/log.md': '---\ntitle: log\n---\n',
        'wiki/entities/foo.md': '---\ntitle: foo\n---\n[[bar]]',
        'wiki/entities/bar.md': '---\ntitle: bar\n---\n본문',
      })
      const lines: string[] = []
      const r = await runValidateWiki({ basePath: tmp, write: (s) => lines.push(s) })
      expect(r.exitCode).toBe(0)
      expect(r.errorCount).toBe(0)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('검증 2 — alias 형식 [[basename|display]] 정확 split', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-vw-'))
    try {
      setupWiki(tmp, {
        'wiki/index.md': '---\ntitle: index\n---\n## 엔티티\n- [[foo]] — desc',
        'wiki/log.md': '---\ntitle: log\n---\n',
        'wiki/entities/foo.md': '---\ntitle: foo\n---\n[[foo|표시명]]',
      })
      const lines: string[] = []
      const r = await runValidateWiki({ basePath: tmp, write: (s) => lines.push(s) })
      expect(r.exitCode).toBe(0)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
