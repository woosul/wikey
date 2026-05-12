// §5.19 Wiki maintenance — shared Node WikiFS adapter.
//
// Used by scripts/wiki-check.sh / wiki-recovery.sh / wiki-refactoring.sh thin
// wrappers. Mirrors the `WikiFS` interface consumed by
// `wikey-core/src/wiki/maintenance/*` modules.
//
// CommonJS source (.mjs naming follows scripts/ convention) — loaded via
// `require()` from the inline node -e scripts.

const { promises: fs } = require('node:fs')
const fsSync = require('node:fs')
const path = require('node:path')

/**
 * Build a WikiFS-compatible object rooted at `root`. `writable` controls whether
 * `write()` performs an actual fs write (suggestion-only flows pass false).
 */
function createWikiFS(root, { writable = true } = {}) {
  return {
    async read(p) {
      return await fs.readFile(path.join(root, p), 'utf8')
    },
    async write(p, c) {
      if (!writable) return
      await fs.mkdir(path.dirname(path.join(root, p)), { recursive: true })
      await fs.writeFile(path.join(root, p), c)
    },
    async exists(p) {
      try {
        await fs.access(path.join(root, p))
        return true
      } catch {
        return false
      }
    },
    async list(dir) {
      const out = []
      async function walk(d) {
        let entries
        try {
          entries = await fs.readdir(path.join(root, d), { withFileTypes: true })
        } catch {
          return
        }
        for (const e of entries) {
          const rel = d + e.name + (e.isDirectory() ? '/' : '')
          if (e.isDirectory()) await walk(rel)
          else out.push(rel)
        }
      }
      await walk(dir.endsWith('/') ? dir : dir + '/')
      return out
    },
    // §5.19 Step G fix — recursive .md walk for wiki maintenance helpers.
    // Mirrors ObsidianWikiFS.walk contract (vault-relative .md paths only).
    async walk(dir) {
      const rel = dir.endsWith('/') ? dir.slice(0, -1) : dir
      const absRoot = path.join(root, rel)
      if (!fsSync.existsSync(absRoot)) return []
      const results = []
      function recurse(absDir) {
        let entries
        try {
          entries = fsSync.readdirSync(absDir, { withFileTypes: true })
        } catch {
          return
        }
        for (const e of entries) {
          const abs = path.join(absDir, e.name)
          if (e.isDirectory()) recurse(abs)
          else if (e.isFile() && e.name.endsWith('.md')) {
            results.push(path.relative(root, abs))
          }
        }
      }
      recurse(absRoot)
      return results
    },
  }
}

module.exports = { createWikiFS }
