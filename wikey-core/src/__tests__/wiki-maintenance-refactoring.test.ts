/**
 * §5.19 Step B (RED) — Spec 4 wiki-refactoring (`getRefactoringSuggestions`).
 *
 * Spec: plan/phase-5/phase-5-spec-5.19-wiki-maintenance-suite.md v0.2 §1 Spec 4
 *
 * AC mapping (1:1):
 *   - AC-R4-1 → suggestion list (duplicates + lowUtility 두 카테고리)
 *   - AC-R4-2 → 자동 변경 0 (suggestion only, wiki/ bytes 불변)
 *   - AC-R4-3 → 0.85 default threshold + `.wikey/refactoring.yaml` override + parse fail fallback + WARN
 *
 * RED 의도:
 *   - `getRefactoringSuggestions(fs)` 미존재 → import-time RED.
 *   - I12 (Q3 LOCK) — similarity threshold default 0.85, `.wikey/refactoring.yaml` override.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { WikiFS } from '../types.js'
// TODO(developer GREEN): create wikey-core/src/wiki/maintenance.ts exporting:
//   - getRefactoringSuggestions(fs: WikiFS, opts?: { now?: Date }): Promise<RefactoringSuggestions>
//   - RefactoringSuggestions { duplicates: DuplicatePair[], lowUtility: LowUtilityEntry[],
//                              thresholdUsed: number, configFallback?: 'default'|'override'|'fallback-on-parse-fail' }
import {
  getRefactoringSuggestions,
  type RefactoringSuggestions,
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
    // §5.19 Step G fix — recursive .md enumeration mirroring ObsidianWikiFS.walk.
    async walk(dir: string): Promise<string[]> {
      const root = dir.endsWith('/') ? dir.slice(0, -1) : dir
      const prefix = root + '/'
      return [...store.keys()].filter(
        (k) => (k === root || k.startsWith(prefix)) && k.endsWith('.md'),
      )
    },
    __snapshot(): Record<string, string> {
      return Object.fromEntries(store.entries())
    },
  } as WikiFS & { __snapshot(): Record<string, string> }
}

// Fixture:
//   duplicates: lotus-pms / lotus-pms-co (slug similarity ≈ 0.88, both entities)
//   lowUtility: wiki/analyses/old-analysis.md (backlink 0, frontmatter updated 30+ 일 전)
//   near-threshold: foo / foo-bar (similarity ≈ 0.71) → 0.85 default 미검출, 0.7 override 검출.

const NOW = new Date('2026-05-12T00:00:00Z')

const FIXTURE_FILES: Record<string, string> = {
  'wiki/index.md': `---\ntitle: Index\n---\n`,
  'wiki/log.md': `# Log\n`,
  'wiki/entities/lotus-pms.md':
    `---\ntitle: Lotus PMS\ntype: entity\nupdated: 2026-05-10\nsources: []\n---\n\n[[other]]\n`,
  'wiki/entities/lotus-pms-co.md':
    `---\ntitle: Lotus PMS Co\ntype: entity\nupdated: 2026-05-10\nsources: []\n---\n\n[[other]]\n`,
  'wiki/entities/foo.md':
    `---\ntitle: Foo\ntype: entity\nupdated: 2026-05-10\nsources: []\n---\n\n[[other]]\n`,
  'wiki/entities/foo-bar.md':
    `---\ntitle: Foo Bar\ntype: entity\nupdated: 2026-05-10\nsources: []\n---\n\n[[other]]\n`,
  'wiki/entities/other.md':
    `---\ntitle: Other\ntype: entity\nupdated: 2026-05-10\nsources: []\n---\n\nreferenced by lotus/foo for inbound count.\n`,
  // low utility: 30+ 일 전 + backlink 0
  'wiki/analyses/old-analysis.md':
    `---\ntitle: Old Analysis\ntype: analysis\nupdated: 2026-03-01\nsources: []\n---\n\nstale.\n`,
}

describe('§5.19 Spec 4 — getRefactoringSuggestions (AC-R4-1, AC-R4-2, AC-R4-3)', () => {
  // AC-R4-1 ↔ suggestion list shape
  it('AC-R4-1: duplicates + lowUtility 두 카테고리 모두 반환 (0.85 default 적용 시)', async () => {
    const fs = createMockFS(FIXTURE_FILES)
    const sug: RefactoringSuggestions = await getRefactoringSuggestions(fs, { now: NOW })

    expect(Array.isArray(sug.duplicates)).toBe(true)
    expect(Array.isArray(sug.lowUtility)).toBe(true)

    // duplicates: lotus-pms ↔ lotus-pms-co (≥ 0.85)
    const dupBases = sug.duplicates.map((d: any) => [d.a, d.b].sort().join('|'))
    expect(dupBases.some((s) =>
      s.includes('lotus-pms') && s.includes('lotus-pms-co'),
    )).toBe(true)

    // foo ↔ foo-bar similarity < 0.85 → NOT detected at default
    expect(dupBases.some((s) => s.includes('foo') && s.includes('foo-bar'))).toBe(false)

    // lowUtility: old-analysis.md (backlink 0 + 30 일+ updated)
    const lowPaths = sug.lowUtility.map((l: any) => l.path)
    expect(lowPaths).toContain('wiki/analyses/old-analysis.md')

    // threshold metadata 명시
    expect(sug.thresholdUsed).toBeCloseTo(0.85, 2)
  })

  // AC-R4-2 ↔ 자동 변경 0
  it('AC-R4-2: suggestion 만 반환, wiki/ 변경 0 (모든 file bytes 불변)', async () => {
    const fs = createMockFS(FIXTURE_FILES)
    const before = (fs as any).__snapshot() as Record<string, string>

    await getRefactoringSuggestions(fs, { now: NOW })

    const after = (fs as any).__snapshot() as Record<string, string>
    for (const path of Object.keys(before)) {
      expect(after[path]).toBe(before[path])
    }
    // 신규 file 생성 0 — keys 동일
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort())
  })

  // AC-R4-3a ↔ default 0.85
  it('AC-R4-3 (default): 0.85 default — foo↔foo-bar 미검출 (similarity ~0.71)', async () => {
    const fs = createMockFS(FIXTURE_FILES)
    const sug = await getRefactoringSuggestions(fs, { now: NOW })
    expect(sug.thresholdUsed).toBeCloseTo(0.85, 2)
  })

  // AC-R4-3b ↔ override
  it('AC-R4-3 (override): `.wikey/refactoring.yaml` duplicate.similarity_threshold: 0.7 적용 시 foo↔foo-bar 검출', async () => {
    const fs = createMockFS({
      ...FIXTURE_FILES,
      '.wikey/refactoring.yaml': `duplicate:\n  similarity_threshold: 0.7\n`,
    })
    const sug = await getRefactoringSuggestions(fs, { now: NOW })
    expect(sug.thresholdUsed).toBeCloseTo(0.7, 2)
    const dupBases = sug.duplicates.map((d: any) => [d.a, d.b].sort().join('|'))
    expect(dupBases.some((s) => s.includes('foo') && s.includes('foo-bar'))).toBe(true)
  })

  // AC-R4-3c ↔ parse fail fallback + WARN
  it('AC-R4-3 (parse fail): `.wikey/refactoring.yaml` 손상 → default fallback + console.warn 호출', async () => {
    const fs = createMockFS({
      ...FIXTURE_FILES,
      '.wikey/refactoring.yaml': `duplicate:\n  similarity_threshold: { not a number }\n  broken: [[[\n`,
    })
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const sug = await getRefactoringSuggestions(fs, { now: NOW })
    expect(sug.thresholdUsed).toBeCloseTo(0.85, 2) // fallback to default
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
  })
})
