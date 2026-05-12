/**
 * §5.19 Step B (RED) — Spec 1 wiki-status (`getWikiStatus`).
 *
 * Spec: plan/phase-5/phase-5-spec-5.19-wiki-maintenance-suite.md v0.2 §1 Spec 1
 *
 * AC mapping (1:1):
 *   - AC-S1-1 → "AC-S1-1: 6 metric 모두 number/null shape + 정확 count"
 *   - AC-S1-2 → "AC-S1-2: cache hit ≤ 50ms / 5분 TTL invalidate"
 *
 * RED 의도 (GREEN 단계에서 developer 가 해소):
 *   - `wikey-core/src/wiki/maintenance.ts` 미존재 → import-time RED.
 *   - `getWikiStatus(fs, opts?)` signature + `WikiStatus` type + 5분 TTL in-memory cache 미구현.
 *   - reconcileAfterIngest 의 dry-run mode 가 미지원 — AC-S1-1 staleTombstoneCount 산출 시
 *     본 helper 가 `reconcileAfterIngest` 를 어떻게 호출하는지가 contract. spec I5 (Q1 LOCK)
 *     은 "helper 재사용 + dry-run 으로 1회 실행 + 결과 비교" — developer 가 GREEN 시 dry-run
 *     mode 를 `reconcileAfterIngest(reg, walker, { dryRun: true })` 로 확장 필요 (현 signature
 *     는 2-arg, dryRun mode 없음). 본 test 가 그 contract 를 driving.
 *
 * NOTE: import path = `../wiki/maintenance.js` (TS source = `src/wiki/maintenance.ts`).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { WikiFS } from '../types.js'
// TODO(developer GREEN): create wikey-core/src/wiki/maintenance.ts exporting:
//   - WikiStatus { pageCount, orphanCount, brokenLinkCount, staleTombstoneCount,
//                  danglingCrossLinkCount, lastValidateTs }
//   - getWikiStatus(fs: WikiFS, opts?: { forceRefresh?: boolean }): Promise<WikiStatus>
//   - in-memory 5min TTL cache (per-vault keyed by fs identity or fs.root)
// Import below intentionally references unbuilt module → RED at import resolution.
import { getWikiStatus, type WikiStatus } from '../wiki/maintenance.js'

// ── Mock WikiFS factory ──

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
    // §5.19 Step G fix — recursive .md enumeration. Production binding
    // (`ObsidianWikiFS.walk`) returns vault-relative `.md` paths under `dir`.
    // Mock mirrors that contract — strip trailing `/`, filter `.md`.
    async walk(dir: string): Promise<string[]> {
      const root = dir.endsWith('/') ? dir.slice(0, -1) : dir
      const prefix = root + '/'
      return [...store.keys()].filter(
        (k) => (k === root || k.startsWith(prefix)) && k.endsWith('.md'),
      )
    },
  }
}

// ── Fixture vault (deterministic AC-S1-1 counts) ──
//
// Layout:
//   - wiki/index.md, wiki/log.md (housekeeping, do not count toward orphan/broken)
//   - wiki/entities/lotus-pms.md (inbound from concept-a + source)
//   - wiki/entities/jeff-smith.md (inbound from lotus-pms → NOT orphan)
//   - wiki/entities/orphan-only.md (no inbound link → orphan = 1)
//   - wiki/concepts/concept-a.md (inbound from source)
//   - wiki/sources/source-foo.md (1 broken link `[[ghost-page]]` → brokenLinkCount = 1)
//   - .wikey/source-registry.json with:
//        sha256:01… tombstone=true (file STILL present on disk) → stale tombstone = 1
//        sha256:02… clean
//   - wiki/entities/dangling-frontmatter.md frontmatter sources: [sha256:zzzz] (registry 부재)
//        → danglingCrossLinkCount = 1
//
// Expected:
//   pageCount = 8 (AC-S1-1 = wiki/**/*.md total = index + log + 6 content pages)
//   orphanCount = 1 (orphan-only — index/log excluded from orphan scan)
//   brokenLinkCount = 1 (ghost-page)
//   staleTombstoneCount = 1 (findRestoredIds hash-equality detect)
//   danglingCrossLinkCount = 1
//   lastValidateTs = null (no validate yet) OR string ISO from optional ts file

const FIXTURE_FILES: Record<string, string> = {
  // index / log — not counted as wiki page (housekeeping)
  'wiki/index.md': `---\ntitle: Index\n---\n\n## Entities\n- [[lotus-pms]]\n`,
  'wiki/log.md': `# log\n`,

  // entities
  'wiki/entities/lotus-pms.md':
    `---\ntitle: Lotus PMS\ntype: entity\nsources: []\n---\n\nSee [[jeff-smith]].\n`,
  'wiki/entities/jeff-smith.md':
    `---\ntitle: Jeff Smith\ntype: entity\nsources: []\n---\n\nFounder.\n`,
  'wiki/entities/orphan-only.md':
    `---\ntitle: Orphan\ntype: entity\nsources: []\n---\n\nNo inbound links.\n`,

  // concepts
  'wiki/concepts/concept-a.md':
    `---\ntitle: Concept A\ntype: concept\nsources: []\n---\n\nReferences [[lotus-pms]].\n`,

  // sources — broken wikilink [[ghost-page]]
  'wiki/sources/source-foo.md':
    `---\ntitle: Source Foo\ntype: source\nsources: []\n---\n\nMentions [[lotus-pms]] and [[concept-a]] and [[ghost-page]].\n`,

  // dangling frontmatter — sources points to sha256 not in registry
  'wiki/entities/dangling-frontmatter.md':
    `---\ntitle: Dangling\ntype: entity\nsources: [sha256:679cf2dd6db75e3a]\n---\n\nBody.\n`,

  // registry — one stale tombstone (file IS present on disk under raw/, walker should pick it up)
  '.wikey/source-registry.json': JSON.stringify({
    // hash = sha256('foo bytes') — matches the walker entry so findRestoredIds
    // surfaces this id (AC-S1-1 + Spec I5: hash-equality detect).
    'sha256:0101010101010101': {
      vault_path: 'raw/3_resources/foo.md',
      sidecar_vault_path: 'raw/3_resources/foo.md.md',
      hash: '64ca2babeeca9d4435a10cd977408608f6a4eded5a31d680cda878ab73ab0cbd',
      size: 100,
      first_seen: '2026-05-01T00:00:00Z',
      ingested_pages: ['wiki/sources/source-foo.md'],
      path_history: [{ vault_path: 'raw/3_resources/foo.md', at: '2026-05-01T00:00:00Z' }],
      tombstone: true, // stale — disk file present + hash matches
    },
    'sha256:0202020202020202': {
      vault_path: 'raw/3_resources/bar.md',
      hash: 'sha256-full-hash-02',
      size: 200,
      first_seen: '2026-05-02T00:00:00Z',
      ingested_pages: [],
      path_history: [{ vault_path: 'raw/3_resources/bar.md', at: '2026-05-02T00:00:00Z' }],
      tombstone: false,
    },
  }, null, 2),

  // raw/ files (so walker sees the tombstoned record's file → stale recovery candidate)
  'raw/3_resources/foo.md': 'foo bytes',
  'raw/3_resources/bar.md': 'bar bytes',
}

describe('§5.19 Spec 1 — getWikiStatus (Spec 1 AC-S1-1, AC-S1-2)', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  // AC-S1-1 ↔ 6 metric shape + count
  it('AC-S1-1: returns WikiStatus with 6 metrics — pageCount/orphanCount/brokenLinkCount/staleTombstoneCount/danglingCrossLinkCount/lastValidateTs', async () => {
    const fs = createMockFS(FIXTURE_FILES)
    const status: WikiStatus = await getWikiStatus(fs)

    // Shape — every key must exist with correct type
    expect(typeof status.pageCount).toBe('number')
    expect(typeof status.orphanCount).toBe('number')
    expect(typeof status.brokenLinkCount).toBe('number')
    expect(typeof status.staleTombstoneCount).toBe('number')
    expect(typeof status.danglingCrossLinkCount).toBe('number')
    expect(status.lastValidateTs === null || typeof status.lastValidateTs === 'string').toBe(true)

    // Count assertions — based on fixture layout above.
    // AC-S1-1: pageCount = wiki/**/*.md total (includes index.md + log.md).
    expect(status.pageCount).toBe(8)
    // orphanCount = inbound link 0 → only `orphan-only.md` qualifies
    expect(status.orphanCount).toBe(1)
    // brokenLinkCount = `[[ghost-page]]` in source-foo
    expect(status.brokenLinkCount).toBe(1)
    // staleTombstoneCount = registry tombstone=true AND disk file present
    expect(status.staleTombstoneCount).toBe(1)
    // danglingCrossLinkCount = frontmatter `sources:` referencing sha256 not in registry
    expect(status.danglingCrossLinkCount).toBe(1)
  })

  // AC-S1-2 ↔ cache hit ≤ 50ms / 5min TTL
  it('AC-S1-2: second call within 5min returns cached value in ≤ 50ms', async () => {
    const fs = createMockFS(FIXTURE_FILES)

    const t0 = Date.now()
    const s1 = await getWikiStatus(fs)
    const cold = Date.now() - t0
    expect(cold).toBeGreaterThanOrEqual(0) // sanity

    const t1 = Date.now()
    const s2 = await getWikiStatus(fs)
    const hit = Date.now() - t1
    expect(hit).toBeLessThanOrEqual(50)

    // cached → identical reference shape (numbers equal)
    expect(s2.pageCount).toBe(s1.pageCount)
    expect(s2.orphanCount).toBe(s1.orphanCount)
  })

  it('AC-S1-2: 5분 TTL 경과 후 cache miss → cold recompute', async () => {
    vi.useFakeTimers()
    const fs = createMockFS(FIXTURE_FILES)
    const baseTime = new Date('2026-05-12T00:00:00Z').getTime()
    vi.setSystemTime(baseTime)

    await getWikiStatus(fs) // populate cache

    // Advance 5min + 1s — past TTL
    vi.setSystemTime(baseTime + 5 * 60 * 1000 + 1000)

    // After TTL, getWikiStatus should recompute (cache miss).
    // We assert via a spy on `fs.walk` — cold call re-walks vault, hit doesn't.
    // (§5.19 Step G fix: maintenance helpers switched from `list` → `walk`.)
    const walkSpy = vi.spyOn(fs, 'walk')
    await getWikiStatus(fs)
    expect(walkSpy).toHaveBeenCalled() // cold call walks vault again
  })

  it('AC-S1-2: forceRefresh option invalidates cache (Modal Refresh 버튼 contract)', async () => {
    const fs = createMockFS(FIXTURE_FILES)
    await getWikiStatus(fs)

    // §5.19 Step G fix: spy on `walk` (was `list`).
    const walkSpy = vi.spyOn(fs, 'walk')
    await getWikiStatus(fs, { forceRefresh: true })
    expect(walkSpy).toHaveBeenCalled() // forceRefresh → cold call
  })
})
