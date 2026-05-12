/**
 * §5.19 v0.4 Batch 5 — broken wikilink detect + confirm-gated fix.
 *
 * Spec: phase-5-spec-5.19-wiki-maintenance-suite.md v0.4 §1.7 Fix link mode a.
 *
 * AC mapping:
 *   - I-FIX-1 / AC-FIX-1: detect + fuzzy/case-insensitive top-3 candidate
 *   - I-FIX-4 / AC-FIX-4: confirm=false → 변경 0
 *   - I8: applyBrokenWikilinkFix 후 wiki/log.md `lint-fix | wiki-check (fix-link)` entry
 */

import { describe, it, expect } from 'vitest'
import type { WikiFS } from '../types.js'
import {
  detectBrokenWikilinks,
  applyBrokenWikilinkFix,
  type BrokenWikilinkFixCandidate,
} from '../wiki/maintenance.js'

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

const FIXTURE: Record<string, string> = {
  // Canonical pages (slugs: gpt-4o, claude-code, anthropic)
  'wiki/index.md': '---\ntitle: Index\n---\n',
  'wiki/log.md': '# Log\n',
  'wiki/entities/gpt-4o.md': '---\ntitle: GPT-4o\n---\n\nReal.\n',
  'wiki/entities/claude-code.md': '---\ntitle: Claude Code\n---\n\nReal.\n',
  'wiki/entities/anthropic.md': '---\ntitle: Anthropic\n---\n\nReal.\n',
  // Source page mixing 3 broken target kinds + 1 valid wikilink.
  // - [[GPT-4o]]      → case-insensitive auto-fix to gpt-4o
  // - [[claude-cod]]  → fuzzy (Levenshtein 1 from claude-code)
  // - [[microsoft]]   → no-match (no slug close enough)
  // - [[anthropic]]   → valid (no finding)
  // - [[GPT-4o|GPT-4o]] alias case — replacement preserves alias.
  'wiki/entities/refs.md':
    '---\ntitle: Refs\n---\n\n' +
    '[[GPT-4o]] one. [[GPT-4o|GPT-4o]] alias. [[claude-cod]] near. [[microsoft]] far. [[anthropic]] ok.\n',
}

describe('§5.19 v0.4 Batch 5 — detectBrokenWikilinks (I-FIX-1 / AC-FIX-1)', () => {
  it('Case 1: case-insensitive match → fixKind=case-insensitive + autoFixSlug', async () => {
    const fs = createMockFS(FIXTURE)
    const cands = await detectBrokenWikilinks(fs)
    const caseInsensitive = cands.filter((c) => c.fixKind === 'case-insensitive')
    // [[GPT-4o]] surfaces once per source/target pair — fixture has two
    // occurrences but de-duped by (source, brokenTarget).
    expect(caseInsensitive.length).toBe(1)
    expect(caseInsensitive[0]!.brokenTarget).toBe('GPT-4o')
    expect(caseInsensitive[0]!.autoFixSlug).toBe('gpt-4o')
    expect(caseInsensitive[0]!.candidates[0]!.slug).toBe('gpt-4o')
    expect(caseInsensitive[0]!.candidates[0]!.similarity).toBe(1)
  })

  it('Case 2: fuzzy match (Levenshtein ≤ 3) → fixKind=fuzzy + top-3 candidates sorted desc', async () => {
    const fs = createMockFS(FIXTURE)
    const cands = await detectBrokenWikilinks(fs)
    const fuzzy = cands.filter((c) => c.fixKind === 'fuzzy')
    expect(fuzzy.length).toBeGreaterThanOrEqual(1)
    const claudeCod = fuzzy.find((c) => c.brokenTarget === 'claude-cod')
    expect(claudeCod).toBeDefined()
    expect(claudeCod!.candidates.length).toBeGreaterThan(0)
    expect(claudeCod!.candidates.length).toBeLessThanOrEqual(3)
    // Top candidate must be `claude-code` (Levenshtein 1).
    expect(claudeCod!.candidates[0]!.slug).toBe('claude-code')
    // No autoFixSlug for fuzzy (manual user confirm required).
    expect(claudeCod!.autoFixSlug).toBeUndefined()
  })

  it('Case 3: no-match → fixKind=no-match + empty candidates', async () => {
    const fs = createMockFS(FIXTURE)
    const cands = await detectBrokenWikilinks(fs)
    const noMatch = cands.find((c) => c.brokenTarget === 'microsoft')
    expect(noMatch).toBeDefined()
    expect(noMatch!.fixKind).toBe('no-match')
    expect(noMatch!.candidates).toEqual([])
  })
})

describe('§5.19 v0.4 Batch 5 — applyBrokenWikilinkFix (I-FIX-4 / AC-FIX-4 / I8)', () => {
  it('Case 4: confirm=false → 변경 0 (silent fix gate)', async () => {
    const fs = createMockFS(FIXTURE)
    const before = await fs.read('wiki/entities/refs.md')
    const report = await applyBrokenWikilinkFix(fs, {
      confirm: false,
      fixes: [
        { source: 'wiki/entities/refs.md', brokenTarget: 'GPT-4o', replacement: 'gpt-4o' },
      ],
    })
    expect(report.changedFiles).toBe(0)
    expect(report.changedLinks).toBe(0)
    expect(report.logEntryAdded).toBe(false)
    const after = await fs.read('wiki/entities/refs.md')
    expect(after).toBe(before)
  })

  it('Case 5: confirm=true → multi-link replace + alias 보존 + log entry append', async () => {
    const fs = createMockFS(FIXTURE)
    const logBefore = await fs.read('wiki/log.md')
    const report = await applyBrokenWikilinkFix(fs, {
      confirm: true,
      today: '2026-05-12',
      fixes: [
        { source: 'wiki/entities/refs.md', brokenTarget: 'GPT-4o', replacement: 'gpt-4o' },
      ],
    })
    // Both occurrences of [[GPT-4o]] in refs.md replaced (plain + alias form).
    expect(report.changedFiles).toBe(1)
    expect(report.changedLinks).toBe(2)
    expect(report.logEntryAdded).toBe(true)

    const body = await fs.read('wiki/entities/refs.md')
    // Replacement: [[gpt-4o]] + alias preserved as [[gpt-4o|GPT-4o]].
    expect(body).toContain('[[gpt-4o]] one.')
    expect(body).toContain('[[gpt-4o|GPT-4o]] alias.')
    // Untouched: valid [[anthropic]] + non-listed brokens.
    expect(body).toContain('[[anthropic]] ok.')
    expect(body).toContain('[[claude-cod]] near.')
    expect(body).toContain('[[microsoft]] far.')

    // I8 — log.md gets a `lint-fix | wiki-check (fix-link)` entry.
    const logAfter = await fs.read('wiki/log.md')
    expect(logAfter.length).toBeGreaterThan(logBefore.length)
    expect(logAfter).toMatch(/##\s+\[2026-05-12\]\s+lint-fix\s+\|\s+wiki-check \(fix-link\)/)
    expect(logAfter).toContain('2 링크 / 1 페이지')
  })

  it('Case 6: confirm=true + 0 fixes → 변경 0 + log entry 없음', async () => {
    const fs = createMockFS(FIXTURE)
    const report = await applyBrokenWikilinkFix(fs, { confirm: true, fixes: [] })
    expect(report.changedFiles).toBe(0)
    expect(report.changedLinks).toBe(0)
    expect(report.logEntryAdded).toBe(false)
  })
})

describe('§5.19 v0.4 Batch 5 — detect 라이브 비율 sanity (G1 자동 fix candidate ≥ 15%)', () => {
  it('Case 7: 합성 vault 에서 case-insensitive 비율 ≥ 15% 확증', async () => {
    // 100 페이지 (slug = page-N), 20 페이지에 [[Page-5]] (대문자 — case-insensitive 자동 fix 대상),
    // 5 페이지에 [[unrelated-XYZ]] (no-match). caseInsensitive / total > 15%.
    const files: Record<string, string> = {
      'wiki/index.md': '---\ntitle: Index\n---\n',
      'wiki/log.md': '# log\n',
    }
    for (let i = 0; i < 100; i++) {
      files[`wiki/entities/page-${i}.md`] = `---\ntitle: page-${i}\n---\n`
    }
    for (let i = 0; i < 20; i++) {
      files[`wiki/entities/page-${i}.md`] += '\n[[Page-5]] broken caps.\n'
    }
    for (let i = 20; i < 25; i++) {
      files[`wiki/entities/page-${i}.md`] += '\n[[unrelated-totally-XYZ-99999]] far.\n'
    }
    const fs = createMockFS(files)
    const cands = await detectBrokenWikilinks(fs)
    expect(cands.length).toBeGreaterThan(0)
    const caseInsensitive = cands.filter((c) => c.fixKind === 'case-insensitive').length
    const ratio = caseInsensitive / cands.length
    expect(ratio).toBeGreaterThanOrEqual(0.15)
  })
})
