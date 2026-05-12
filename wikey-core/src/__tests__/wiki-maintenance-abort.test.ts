/**
 * §5.19 cycle #4 — Finding 2 (signal propagation).
 *
 * Spec: plan/phase-5/phase-5-spec-5.19-wiki-maintenance-suite.md v0.3 §1.5 AC-UI-6.
 *
 * Asserts every long-running core path (`getWikiStatus` / `runWikiCheck` /
 * `applyWikiRecovery` / `getRefactoringSuggestions`) honours the cooperative
 * AbortSignal: an `AbortController.abort()` raised mid-iteration throws an
 * AbortError instead of completing — so a `MaintenanceModal.close()` actually
 * stops the underlying work loop.
 */

import { describe, it, expect } from 'vitest'
import type { WikiFS } from '../types.js'
import {
  getWikiStatus,
  runWikiCheck,
  applyWikiRecovery,
  getRefactoringSuggestions,
} from '../wiki/maintenance.js'
import { runValidateWiki } from '../scripts/validate-wiki.js'
import { validateWiki as validateWikiRunner } from '../scripts-runner.js'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

// ── Mock FS — `read` flips the controller after the first call so the next
//    per-page poll trips throwIfAborted before the loop exits naturally. ──
function createAbortingFS(
  files: Record<string, string>,
  controller: AbortController,
): WikiFS {
  const store = new Map(Object.entries(files))
  let firstRead = true
  return {
    async read(path: string): Promise<string> {
      const content = store.get(path)
      if (content === undefined) throw new Error(`ENOENT: ${path}`)
      if (firstRead) {
        firstRead = false
        controller.abort()
      }
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
  }
}

const FIXTURE_FILES: Record<string, string> = {
  'wiki/index.md': `---\ntitle: Index\n---\n`,
  'wiki/log.md': `# log\n`,
  'wiki/entities/a.md':
    `---\ntitle: A\ntype: entity\nupdated: 2026-05-10\nsources: []\n---\n\n[[b]]\n`,
  'wiki/entities/b.md':
    `---\ntitle: B\ntype: entity\nupdated: 2026-05-10\nsources: [sha256:abc-dangling]\n---\n\nbody\n`,
  'wiki/entities/c.md':
    `---\ntitle: C\ntype: entity\nupdated: 2026-05-10\nsources: []\n---\n\n[[a]]\n`,
  '.wikey/source-registry.json': JSON.stringify({}, null, 2),
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === 'AbortError'
}

describe('§5.19 Finding 2 (cycle #4) — AbortSignal propagation in core maintenance paths', () => {
  it('getWikiStatus → mid-iteration AbortController.abort() throws AbortError', async () => {
    const controller = new AbortController()
    const fs = createAbortingFS(FIXTURE_FILES, controller)
    await expect(
      getWikiStatus(fs, { forceRefresh: true, signal: controller.signal }),
    ).rejects.toSatisfy(isAbortError)
  })

  it('runWikiCheck → mid-iteration AbortController.abort() throws AbortError', async () => {
    const controller = new AbortController()
    const fs = createAbortingFS(FIXTURE_FILES, controller)
    await expect(
      runWikiCheck(fs, { today: '2026-05-12', signal: controller.signal }),
    ).rejects.toSatisfy(isAbortError)
  })

  it('runWikiCheck → external validateWiki injection receives the same AbortSignal', async () => {
    // Plain FS — no inline abort. We assert the signal forwarded into the
    // validateWiki callback is the caller-supplied controller so subprocess
    // SIGTERM wiring stays intact.
    const store = new Map(Object.entries(FIXTURE_FILES))
    const fs: WikiFS = {
      async read(p) {
        const c = store.get(p)
        if (c === undefined) throw new Error(`ENOENT: ${p}`)
        return c
      },
      async write(p, c) {
        store.set(p, c)
      },
      async exists(p) {
        return store.has(p)
      },
      async list(dir) {
        return [...store.keys()].filter((k) => k.startsWith(dir))
      },
      // §5.19 Step G fix — recursive .md walk mirroring ObsidianWikiFS.walk.
      async walk(dir) {
        const root = dir.endsWith('/') ? dir.slice(0, -1) : dir
        const prefix = root + '/'
        return [...store.keys()].filter(
          (k) => (k === root || k.startsWith(prefix)) && k.endsWith('.md'),
        )
      },
    }
    const controller = new AbortController()
    let observed: AbortSignal | undefined
    await runWikiCheck(fs, {
      today: '2026-05-12',
      signal: controller.signal,
      validateWiki: async (sig) => {
        observed = sig
        return { exitCode: 0, findings: [] }
      },
    })
    expect(observed).toBe(controller.signal)
  })

  it('applyWikiRecovery → mid-iteration AbortController.abort() throws AbortError', async () => {
    const controller = new AbortController()
    const fs = createAbortingFS(
      {
        ...FIXTURE_FILES,
        'wiki/entities/b.md':
          `---\ntitle: B\ntype: entity\nsources: [sha256:abc-dangling]\n---\n\n[[source-abc-dang]]\n`,
        'wiki/entities/d.md':
          `---\ntitle: D\ntype: entity\nsources: [sha256:abc-dangling]\n---\n\n[[source-abc-dang]]\n`,
      },
      controller,
    )
    await expect(
      applyWikiRecovery(fs, {
        confirm: true,
        danglingShas: ['sha256:abc-dangling'],
        signal: controller.signal,
      }),
    ).rejects.toSatisfy(isAbortError)
  })

  it('getRefactoringSuggestions → pre-aborted signal throws AbortError before scanning', async () => {
    const store = new Map(Object.entries(FIXTURE_FILES))
    const fs: WikiFS = {
      async read(p) {
        const c = store.get(p)
        if (c === undefined) throw new Error(`ENOENT: ${p}`)
        return c
      },
      async write(p, c) {
        store.set(p, c)
      },
      async exists(p) {
        return store.has(p)
      },
      async list(dir) {
        return [...store.keys()].filter((k) => k.startsWith(dir))
      },
      // §5.19 Step G fix — recursive .md walk mirroring ObsidianWikiFS.walk.
      async walk(dir) {
        const root = dir.endsWith('/') ? dir.slice(0, -1) : dir
        const prefix = root + '/'
        return [...store.keys()].filter(
          (k) => (k === root || k.startsWith(prefix)) && k.endsWith('.md'),
        )
      },
    }
    const controller = new AbortController()
    controller.abort()
    await expect(
      getRefactoringSuggestions(fs, {
        now: new Date('2026-05-12T00:00:00Z'),
        signal: controller.signal,
      }),
    ).rejects.toSatisfy(isAbortError)
  })
})

describe('§5.19 cycle #5 Finding 1 — validateWiki signal propagation', () => {
  function setupTmpWiki(): string {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wikey-validate-abort-'))
    fs.mkdirSync(path.join(tmp, 'wiki', 'entities'), { recursive: true })
    fs.writeFileSync(
      path.join(tmp, 'wiki', 'index.md'),
      '---\ntitle: Index\n---\n\n[[a]]\n[[b]]\n',
    )
    fs.writeFileSync(
      path.join(tmp, 'wiki', 'entities', 'a.md'),
      '---\ntitle: A\n---\n\nbody\n',
    )
    fs.writeFileSync(
      path.join(tmp, 'wiki', 'entities', 'b.md'),
      '---\ntitle: B\n---\n\nbody\n',
    )
    return tmp
  }

  it('runValidateWiki — pre-aborted signal throws AbortError before any output', async () => {
    const tmp = setupTmpWiki()
    try {
      const controller = new AbortController()
      controller.abort()
      const lines: string[] = []
      await expect(
        runValidateWiki({
          basePath: tmp,
          write: (s) => lines.push(s),
          signal: controller.signal,
        }),
      ).rejects.toSatisfy(isAbortError)
      // No PASS/FAIL output should leak past the pre-aborted gate.
      expect(lines.join('\n')).not.toMatch(/PASS:|FAIL:/)
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })

  it('scripts-runner validateWiki — parentSignal pre-abort yields non-success ScriptResult', async () => {
    const tmp = setupTmpWiki()
    try {
      const controller = new AbortController()
      controller.abort()
      const res = await validateWikiRunner(tmp, {}, controller.signal)
      // captureRun catches AbortError → success=false / exitCode=-1.
      expect(res.success).toBe(false)
      expect(res.exitCode).toBe(-1)
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true })
    }
  })
})

describe('§5.19 cycle #5 Finding 2 — applyWikiRecovery [ABORTED] log marker on mid-loop abort', () => {
  it('mid-loop abort still appends a wiki/log.md entry with [ABORTED] marker', async () => {
    // Custom FS — first page write succeeds, then the second per-page poll
    // trips abort before the third page is processed. Log entry should be
    // appended in the finally block with the [ABORTED] marker.
    const store = new Map<string, string>(
      Object.entries({
        'wiki/index.md': `---\ntitle: Index\n---\n`,
        'wiki/log.md': `# log\n`,
        'wiki/entities/a.md':
          `---\ntitle: A\nsources: [sha256:abc-dangling]\n---\n\n[[source-abc]]\n`,
        'wiki/entities/b.md':
          `---\ntitle: B\nsources: [sha256:abc-dangling]\n---\n\n[[source-abc]]\n`,
        'wiki/entities/c.md':
          `---\ntitle: C\nsources: [sha256:abc-dangling]\n---\n\n[[source-abc]]\n`,
      }),
    )
    const controller = new AbortController()
    let readCount = 0
    const wikiFs: WikiFS = {
      async read(p) {
        const c = store.get(p)
        if (c === undefined) throw new Error(`ENOENT: ${p}`)
        readCount += 1
        // Abort right after the second page is read but before the third
        // per-page throwIfAborted poll. The first page will already be
        // written by then.
        if (readCount === 2) controller.abort()
        return c
      },
      async write(p, c) {
        store.set(p, c)
      },
      async exists(p) {
        return store.has(p)
      },
      async list(dir) {
        return [...store.keys()].filter((k) => k.startsWith(dir))
      },
      // §5.19 Step G fix — recursive .md walk mirroring ObsidianWikiFS.walk.
      async walk(dir) {
        const root = dir.endsWith('/') ? dir.slice(0, -1) : dir
        const prefix = root + '/'
        return [...store.keys()].filter(
          (k) => (k === root || k.startsWith(prefix)) && k.endsWith('.md'),
        )
      },
    }
    await expect(
      applyWikiRecovery(wikiFs, {
        confirm: true,
        danglingShas: ['sha256:abc-dangling'],
        today: '2026-05-12',
        signal: controller.signal,
      }),
    ).rejects.toSatisfy(isAbortError)
    // Log entry persisted in finally with [ABORTED] marker.
    const log = store.get('wiki/log.md') ?? ''
    expect(log).toMatch(/\[ABORTED midway, \d+\/\d+ pages processed\]/)
    expect(log).toMatch(/wiki-recovery/)
  })
})
