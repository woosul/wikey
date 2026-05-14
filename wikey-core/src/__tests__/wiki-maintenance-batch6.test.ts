/**
 * §5.19 v0.4 Batch 6 fix — wiki-check report recursive feedback loop closure.
 *
 * Spec: docs/planning/phase-5/phase-5-spec-5.19-wiki-maintenance-suite.md v0.4
 *
 * Invariants under test:
 *   - `isWikiCheckReportPath` matches only `wiki/analyses/wiki-check-YYYY-MM-DD.md`.
 *   - `escapeWikilinks` wraps every `[[X]]` in inline backticks (single + multi).
 *   - `runWikiCheck` analysis page persists escaped `[[X]]` so a follow-up
 *     `detectBrokenWikilinks` / wikilink scan does not re-detect them as new
 *     broken-link findings (recursive feedback loop closed).
 *
 * Background (master cdp 2026-05-12): the live vault funneled 11,271 of 11,772
 * broken wikilinks (96%) through a single wiki-check report page — each broken
 * `[[X]]` finding stored inline in the report re-fired on the next validate-wiki
 * sweep. This file pins the structural fix.
 */

import { describe, it, expect } from 'vitest'
import type { WikiFS } from '../types.js'
import {
  escapeWikilinks,
  isWikiCheckReportPath,
} from '../wiki/maintenance.js'
import { runWikiCheck } from '../wiki/maintenance.js'
import { detectBrokenWikilinks } from '../wiki/maintenance.js'

function createMockFS(files: Record<string, string> = {}): WikiFS {
  const store = new Map(Object.entries(files))
  return {
    async read(path: string): Promise<string> {
      const content = store.get(path)
      if (content === undefined) throw new Error(`ENOENT: ${path}`)
      return content
    },
    async write(path: string, content: string): Promise<void> {
      store.set(path, content)
    },
    async exists(path: string): Promise<boolean> {
      return store.has(path)
    },
    async list(dir: string): Promise<string[]> {
      return [...store.keys()].filter((k) => k.startsWith(dir))
    },
    async walk(dir: string): Promise<string[]> {
      const root = dir.endsWith('/') ? dir.slice(0, -1) : dir
      const prefix = root + '/'
      return [...store.keys()].filter(
        (k) => (k === root || k.startsWith(prefix)) && k.endsWith('.md'),
      )
    },
  }
}

describe('§5.19 v0.4 Batch 6 — isWikiCheckReportPath', () => {
  it('정확한 wiki-check-<YYYY-MM-DD>.md 경로 매치', () => {
    expect(isWikiCheckReportPath('wiki/analyses/wiki-check-2026-05-12.md')).toBe(true)
    expect(isWikiCheckReportPath('wiki/analyses/wiki-check-1999-01-31.md')).toBe(true)
  })

  it('다른 analyses 페이지 / 비-analyses 페이지 비매치', () => {
    expect(isWikiCheckReportPath('wiki/analyses/other-report.md')).toBe(false)
    expect(isWikiCheckReportPath('wiki/entities/foo.md')).toBe(false)
    expect(isWikiCheckReportPath('wiki/log.md')).toBe(false)
    // YYYY-MM-DD 형식 위반
    expect(isWikiCheckReportPath('wiki/analyses/wiki-check-2026-5-12.md')).toBe(false)
    // 다른 디렉토리
    expect(isWikiCheckReportPath('raw/wiki-check-2026-05-12.md')).toBe(false)
  })
})

describe('§5.19 v0.4 Batch 6 — escapeWikilinks', () => {
  it('단일 [[X]] → `[[X]]` (inline code)', () => {
    expect(escapeWikilinks('plain [[foo]] text')).toBe('plain `[[foo]]` text')
  })

  it('다중 [[X]] 모두 escape', () => {
    const out = escapeWikilinks('a [[x]] b [[y]] c')
    expect(out).toBe('a `[[x]]` b `[[y]]` c')
  })

  it('[[X|alias]] / [[X#anchor]] 도 escape', () => {
    expect(escapeWikilinks('[[gpt-4o|GPT 4o]]')).toBe('`[[gpt-4o|GPT 4o]]`')
    expect(escapeWikilinks('[[X#section]]')).toBe('`[[X#section]]`')
  })

  it('wikilink 없는 텍스트 변경 없음', () => {
    expect(escapeWikilinks('no wikilinks here')).toBe('no wikilinks here')
  })
})

describe('§5.19 v0.4 Batch 6 — runWikiCheck 분석 페이지 recursive feedback 차단', () => {
  it('runWikiCheck 후 detectBrokenWikilinks 가 analyses report 의 [[X]] 를 재감지하지 않음', async () => {
    const fs = createMockFS({
      'wiki/index.md': '---\ntitle: Index\n---\n',
      'wiki/log.md': '# Log\n',
      'wiki/entities/page-a.md': '---\ntitle: A\n---\n\n[[missing-target]] reference.\n',
    })

    await runWikiCheck(fs, { today: '2026-05-12' })

    // analyses report 가 생성되었음
    expect(await fs.exists('wiki/analyses/wiki-check-2026-05-12.md')).toBe(true)
    const report = await fs.read('wiki/analyses/wiki-check-2026-05-12.md')
    // detail 안 [[X]] 가 backtick escape
    expect(report).toMatch(/`\[\[missing-target\]\]`/)
    // 원본 raw `[[missing-target]]` 형태로 등장하지 않음 (codeblock 외에서)
    // (escape 적용 결과 backtick 으로 둘러싸여 있음)

    // 후속 detect: report 페이지의 [[missing-target]] 가 broken 으로 재탐지되지 않음
    const cands = await detectBrokenWikilinks(fs)
    const fromReport = cands.filter((c) => c.source.includes('wiki-check-'))
    expect(fromReport).toEqual([])
    // 원본 page-a 의 finding 은 유지
    const fromOriginal = cands.filter((c) => c.source === 'wiki/entities/page-a.md')
    expect(fromOriginal.length).toBeGreaterThan(0)
  })
})
