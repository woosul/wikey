/**
 * §5.19 Step G fix — WikiFS.walk contract test.
 *
 * Driving the divergence that broke Step G live smoke (cycle #5):
 *   - `WikiFS.list(dir)` MUST be children-only (one level deep).
 *   - `WikiFS.walk(dir)` MUST recurse, returning all `.md` paths in the subtree.
 *
 * Production binding (`ObsidianWikiFS`) implements `list` over
 * `folder.children` (no recursion). Pre-fix `helpers.ts` called `list('wiki/')`
 * expecting recursive output — matched the recursive script-side adapter and
 * recursive test mocks, but returned only `wiki/index.md` + `wiki/log.md` +
 * four sub-folders against real Obsidian vaults → maintenance counts = 0.
 *
 * This contract pins the two semantics so future mocks / bindings cannot drift.
 * The script-side CJS adapter (`scripts/lib/wiki-fs-adapter.cjs`) gets the same
 * contract exercised by a parallel test in __tests__/wiki-fs-adapter.cjs.test
 * (kept in the same file via dynamic require since cjs adapter is non-TS).
 */

import { describe, it, expect } from 'vitest'
import type { WikiFS } from '../types.js'
import { promises as fsAsync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

// ── Reusable mock factory mirroring production semantics ──────────────────
function createMockFS(files: Record<string, string>): WikiFS {
  const store = new Map(Object.entries(files))
  return {
    async read(p) {
      const v = store.get(p)
      if (v === undefined) throw new Error(`ENOENT: ${p}`)
      return v
    },
    async write(p, c) {
      store.set(p, c)
    },
    async exists(p) {
      return store.has(p)
    },
    // Children-only: emulate `folder.children.map(c => c.path)`. Direct
    // descendants of `dir` only — sub-folder entries appear as folder paths
    // (no recursion into them).
    async list(dir) {
      const root = dir.endsWith('/') ? dir.slice(0, -1) : dir
      const prefix = root + '/'
      const seen = new Set<string>()
      for (const k of store.keys()) {
        if (!k.startsWith(prefix)) continue
        const rest = k.slice(prefix.length)
        const slash = rest.indexOf('/')
        // immediate file → `${root}/${rest}`. immediate sub-folder → first segment.
        seen.add(slash < 0 ? k : prefix + rest.slice(0, slash))
      }
      return [...seen]
    },
    // Recursive: every `.md` in the subtree.
    async walk(dir) {
      const root = dir.endsWith('/') ? dir.slice(0, -1) : dir
      const prefix = root + '/'
      return [...store.keys()].filter(
        (k) => (k === root || k.startsWith(prefix)) && k.endsWith('.md'),
      )
    },
  }
}

// ── Fixture: recreate the Step G live-vault shape (wiki/ + 4 sub-folders) ──
const FIXTURE: Record<string, string> = {
  'wiki/index.md': '# index',
  'wiki/log.md': '# log',
  'wiki/entities/a.md': '# a',
  'wiki/entities/b.md': '# b',
  'wiki/concepts/c.md': '# c',
  'wiki/sources/source-foo.md': '# foo',
  'wiki/analyses/old.md': '# old',
}

describe('§5.19 Step G — WikiFS.list vs WikiFS.walk contract', () => {
  it('list("wiki") is children-only — sub-folder pages NOT surfaced', async () => {
    const fs = createMockFS(FIXTURE)
    const children = await fs.list('wiki')
    // index.md + log.md (immediate files) + 4 folder entries → 6 total, none
    // nested file paths.
    expect(children).toContain('wiki/index.md')
    expect(children).toContain('wiki/log.md')
    expect(children).not.toContain('wiki/entities/a.md')
    expect(children).not.toContain('wiki/concepts/c.md')
  })

  it('walk("wiki") recurses — every .md under the subtree returned', async () => {
    const fs = createMockFS(FIXTURE)
    const all = await fs.walk('wiki')
    expect(all).toContain('wiki/index.md')
    expect(all).toContain('wiki/log.md')
    expect(all).toContain('wiki/entities/a.md')
    expect(all).toContain('wiki/entities/b.md')
    expect(all).toContain('wiki/concepts/c.md')
    expect(all).toContain('wiki/sources/source-foo.md')
    expect(all).toContain('wiki/analyses/old.md')
    expect(all.every((p) => p.endsWith('.md'))).toBe(true)
  })

  it('walk strips trailing slash — walk("wiki/") === walk("wiki")', async () => {
    const fs = createMockFS(FIXTURE)
    const a = (await fs.walk('wiki/')).sort()
    const b = (await fs.walk('wiki')).sort()
    expect(a).toEqual(b)
  })

  it('walk returns [] for missing root', async () => {
    const fs = createMockFS(FIXTURE)
    expect(await fs.walk('does-not-exist')).toEqual([])
  })
})

describe('§5.19 Step G — scripts/lib/wiki-fs-adapter.cjs walk', () => {
  it('walk recurses real directory tree (vault-relative .md paths)', async () => {
    const root = mkdtempSync(join(tmpdir(), 'wikey-walk-contract-'))
    mkdirSync(join(root, 'wiki', 'entities'), { recursive: true })
    mkdirSync(join(root, 'wiki', 'concepts'), { recursive: true })
    writeFileSync(join(root, 'wiki', 'index.md'), '# index')
    writeFileSync(join(root, 'wiki', 'log.md'), '# log')
    writeFileSync(join(root, 'wiki', 'entities', 'a.md'), '# a')
    writeFileSync(join(root, 'wiki', 'concepts', 'c.md'), '# c')
    // non-md must NOT appear in walk
    writeFileSync(join(root, 'wiki', 'entities', 'skip.txt'), 'skip')

    const { createWikiFS } = require('../../../scripts/lib/wiki-fs-adapter.cjs') as {
      createWikiFS: (r: string, opts?: { writable?: boolean }) => WikiFS
    }
    const fs = createWikiFS(root)
    const all = (await fs.walk('wiki')).sort()

    expect(all).toEqual([
      'wiki/concepts/c.md',
      'wiki/entities/a.md',
      'wiki/index.md',
      'wiki/log.md',
    ])

    await fsAsync.rm(root, { recursive: true, force: true })
  })

  it('walk returns [] when root directory missing', async () => {
    const root = mkdtempSync(join(tmpdir(), 'wikey-walk-contract-empty-'))
    const { createWikiFS } = require('../../../scripts/lib/wiki-fs-adapter.cjs') as {
      createWikiFS: (r: string, opts?: { writable?: boolean }) => WikiFS
    }
    const fs = createWikiFS(root)
    expect(await fs.walk('nonexistent')).toEqual([])
    await fsAsync.rm(root, { recursive: true, force: true })
  })
})
