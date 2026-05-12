/**
 * §5.19 Step B (RED) — Spec 3 wiki-recovery (`applyWikiRecovery`).
 *
 * Spec: plan/phase-5/phase-5-spec-5.19-wiki-maintenance-suite.md v0.2 §1 Spec 3
 *
 * AC mapping (1:1):
 *   - AC-W3-1 → §5.18 38-page dangling (`sha256:679cf2dd6db75e3a`) cleanup
 *   - AC-W3-2 → silent fix 0 (confirm=false 시 wiki/ 변경 0)
 *   - AC-W3-3 → wiki/log.md 에 `lint-fix | wiki-recovery` entry 자동 append (§5.11 v2)
 *
 * RED 의도:
 *   - `applyWikiRecovery({ confirm, danglingShas })` 미존재 → import-time RED.
 *   - I7 (confirm 의무) → confirm=false 또는 미지정 시 wiki/ 변경 0 (mtime 불변 — file content 동일)
 *   - I8 (log entry 정합) → §5.11 v2 의미 재정의 — 지식 변경 log entry 양식.
 */

import { describe, it, expect } from 'vitest'
import type { WikiFS } from '../types.js'
// TODO(developer GREEN): create wikey-core/src/wiki/maintenance.ts exporting:
//   - applyWikiRecovery(fs, opts: { confirm: boolean, danglingShas?: string[],
//                                   staleTombstoneIds?: string[] }): Promise<WikiRecoveryReport>
//   - WikiRecoveryReport { changedPages: string[], registryUpdates: number, logEntryAdded: boolean }
import { applyWikiRecovery, type WikiRecoveryReport } from '../wiki/maintenance.js'

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
    // expose internal store for assertion
    __snapshot(): Record<string, string> {
      return Object.fromEntries(store.entries())
    },
  } as WikiFS & { __snapshot(): Record<string, string> }
}

// ── Fixture: §5.18 38-page dangling reference (sha256:679cf2dd6db75e3a) ──
// 단순화: 3 page 가 동일 dangling sha256 점유 (38 의 mini 형태). cleanup 후 후속 wiki-check
// 결과 danglingCrossLinkCount: 3 → 0 (또는 N → N-3) 검증.

const SHA_DANGLING = 'sha256:679cf2dd6db75e3a'

/**
 * Mini fixture mirroring the §5.18 live-vault shape: frontmatter carries both
 * the legacy `sources: [sha256:…]` list AND the §4.3.2 `provenance:` YAML block
 * pointing at `sources/sha256:…`. Recovery must scrub both forms.
 */
function entityWithDangling(name: string): string {
  return [
    '---',
    `title: ${name}`,
    'type: entity',
    `sources: [${SHA_DANGLING}, sha256:other-clean-aa]`,
    'provenance:',
    '  - type: extracted',
    `    ref: sources/${SHA_DANGLING}`,
    '---',
    '',
    `# ${name}`,
    '',
    `근거: [[source-dangling-${SHA_DANGLING.slice(7, 15)}]].`,
    '',
  ].join('\n')
}

const FIXTURE_FILES: Record<string, string> = {
  'wiki/index.md': `---\ntitle: Index\n---\n`,
  'wiki/log.md': `# Log\n`,
  'wiki/entities/page-1.md': entityWithDangling('Page 1'),
  'wiki/entities/page-2.md': entityWithDangling('Page 2'),
  'wiki/concepts/page-3.md': entityWithDangling('Page 3'),
  // registry has NO record for SHA_DANGLING → dangling confirmed
  '.wikey/source-registry.json': JSON.stringify({
    'sha256:other-clean-aa': {
      vault_path: 'raw/3_resources/clean.md',
      hash: 'sha256-clean',
      size: 50,
      first_seen: '2026-05-01T00:00:00Z',
      ingested_pages: [],
      path_history: [{ vault_path: 'raw/3_resources/clean.md', at: '2026-05-01T00:00:00Z' }],
      tombstone: false,
    },
  }, null, 2),
}

describe('§5.19 Spec 3 — applyWikiRecovery (Spec 3 AC-W3-1, AC-W3-2, AC-W3-3)', () => {
  // AC-W3-1 ↔ §5.18 dangling cleanup
  it('AC-W3-1: confirm=true + danglingShas=[679...] → 3 page frontmatter sources 에서 sha 제거 + 본문 [[source-...]] 제거/변환', async () => {
    const fs = createMockFS(FIXTURE_FILES)
    const report: WikiRecoveryReport = await applyWikiRecovery(fs, {
      confirm: true,
      danglingShas: [SHA_DANGLING],
    })

    // changedPages 안에 3 page 모두 포함
    expect(report.changedPages).toEqual(
      expect.arrayContaining([
        'wiki/entities/page-1.md',
        'wiki/entities/page-2.md',
        'wiki/concepts/page-3.md',
      ]),
    )

    // 각 page 의 frontmatter sources: 에서 dangling sha 제거 (clean sha 보존)
    for (const p of ['wiki/entities/page-1.md', 'wiki/entities/page-2.md', 'wiki/concepts/page-3.md']) {
      const body = await fs.read(p)
      expect(body).not.toContain(SHA_DANGLING)
      expect(body).toContain('sha256:other-clean-aa') // clean reference 유지
      // 본문 wikilink [[source-dangling-...]] 도 제거 또는 "근거 삭제됨" 변환
      expect(body).not.toMatch(/\[\[source-dangling-/)
    }
  })

  // AC-W3-2 ↔ silent fix 0
  it('AC-W3-2 (silent fix 0): confirm 인자 없거나 false → wiki/ 변경 0 (모든 page bytes 불변)', async () => {
    const fs = createMockFS(FIXTURE_FILES)
    const beforeSnapshot = (fs as any).__snapshot() as Record<string, string>

    const report = await applyWikiRecovery(fs, { confirm: false, danglingShas: [SHA_DANGLING] })

    const afterSnapshot = (fs as any).__snapshot() as Record<string, string>
    // 모든 wiki/ 파일 bytes 동일 (mtime equivalent — content identity)
    for (const path of Object.keys(beforeSnapshot)) {
      if (path.startsWith('wiki/')) {
        expect(afterSnapshot[path]).toBe(beforeSnapshot[path])
      }
    }
    expect(report.changedPages).toEqual([])
  })

  // AC-W3-3 ↔ log entry 추가
  it('AC-W3-3: confirm=true 실행 후 wiki/log.md 에 [YYYY-MM-DD] lint-fix | wiki-recovery entry append', async () => {
    const fs = createMockFS(FIXTURE_FILES)
    const before = await fs.read('wiki/log.md')

    const report = await applyWikiRecovery(fs, {
      confirm: true,
      danglingShas: [SHA_DANGLING],
      today: '2026-05-12',
    } as any)

    expect(report.logEntryAdded).toBe(true)
    const after = await fs.read('wiki/log.md')
    expect(after.length).toBeGreaterThan(before.length)
    // §5.11 v2 ingest 동급 format — [YYYY-MM-DD] <type> | <subject>
    expect(after).toMatch(/##\s+\[2026-05-12\]\s+lint-fix\s+\|\s+wiki-recovery/)
  })
})
