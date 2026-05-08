/**
 * check-pii.test.ts — Phase 5 §5.7.1 (2026-05-08).
 *
 * AC: PII 0건 / 패턴 매치 / 출력 형식 / exit code / override YAML.
 */
import { describe, it, expect } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCheckPii } from '../check-pii.js'

function makeWiki(parent: string, files: Record<string, string>): string {
  const wiki = join(parent, 'wiki')
  mkdirSync(wiki, { recursive: true })
  for (const [name, content] of Object.entries(files)) {
    const p = join(wiki, name)
    mkdirSync(join(p, '..'), { recursive: true })
    writeFileSync(p, content, 'utf-8')
  }
  return wiki
}

describe('runCheckPii — AC1/AC2', () => {
  it('AC1 — PII 0건 wiki/ → exit 0, "PASS: PII 패턴 없음"', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-pii-'))
    try {
      makeWiki(tmp, {
        'foo.md': '---\ntitle: foo\n---\n본문 — 일반 텍스트',
        'bar.md': '---\ntitle: bar\n---\n다른 본문',
      })
      const lines: string[] = []
      const r = await runCheckPii({ basePath: tmp, write: (s) => lines.push(s) })
      expect(r.exitCode).toBe(0)
      expect(r.foundCount).toBe(0)
      expect(lines[0]).toBe('=== PII 스캔: wiki/ ===')
      expect(lines.at(-1)).toBe('PASS: PII 패턴 없음')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('AC2 — 3 패턴 매치 → exit 1 + WARN 메시지 + PII 라인 N개', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-pii-'))
    try {
      makeWiki(tmp, {
        'leak.md':
          '---\ntitle: leak\n---\n전화 010-1234-5678 그리고 메일 alice@example.com\n주민 880101-1234567',
      })
      const lines: string[] = []
      const r = await runCheckPii({ basePath: tmp, write: (s) => lines.push(s) })
      expect(r.exitCode).toBe(1)
      expect(r.foundCount).toBe(3)
      const out = lines.join('\n')
      expect(out).toContain('PII: wiki/leak.md: 전화번호 패턴 발견')
      expect(out).toContain('PII: wiki/leak.md: 이메일 패턴 발견')
      expect(out).toContain('PII: wiki/leak.md: 주민번호 패턴 발견')
      expect(out).toContain('WARN: 3건 PII 패턴 발견 — 커밋 전 확인 필요')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('grep -n 형식 line 출력 — `<lineNumber>:<lineText>`', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-pii-'))
    try {
      makeWiki(tmp, {
        'leak.md': '---\ntitle: leak\n---\n\n전화 010-1234-5678',
      })
      const lines: string[] = []
      await runCheckPii({ basePath: tmp, write: (s) => lines.push(s) })
      // `5:전화 010-1234-5678` (5번째 줄)
      const grepLine = lines.find((l) => l.startsWith('5:'))
      expect(grepLine).toBeDefined()
      expect(grepLine).toContain('010-1234-5678')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('user override YAML 적용 — `.wikey/check-pii-patterns.yaml` 추가 패턴', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-pii-'))
    try {
      makeWiki(tmp, {
        'sneak.md': '---\ntitle: sneak\n---\nMY-SECRET-CODE-99',
      })
      const wikeyDir = join(tmp, '.wikey')
      mkdirSync(wikeyDir, { recursive: true })
      writeFileSync(
        join(wikeyDir, 'check-pii-patterns.yaml'),
        `patterns:
  - id: secret-code
    patternType: single-line
    kind: secret
    regex: 'MY-SECRET-CODE-\\d+'
    mask: full
    description: '내부 secret code'
`,
        'utf-8',
      )
      const lines: string[] = []
      const r = await runCheckPii({
        basePath: tmp,
        write: (s) => lines.push(s),
        configPaths: [join(wikeyDir, 'check-pii-patterns.yaml')],
      })
      expect(r.exitCode).toBe(1)
      expect(r.foundCount).toBeGreaterThanOrEqual(1)
      expect(lines.join('\n')).toContain('MY-SECRET-CODE')
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('wiki/ 빈 디렉터리 → exit 0', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'wikey-571-pii-'))
    try {
      mkdirSync(join(tmp, 'wiki'), { recursive: true })
      const lines: string[] = []
      const r = await runCheckPii({ basePath: tmp, write: (s) => lines.push(s) })
      expect(r.exitCode).toBe(0)
      expect(r.foundCount).toBe(0)
    } finally {
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})
