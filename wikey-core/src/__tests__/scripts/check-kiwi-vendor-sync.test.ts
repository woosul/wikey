/**
 * §5.7.5 RED — AC-S1 scripts/check-kiwi-vendor-sync.sh existence + format.
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPO_ROOT = join(__dirname, '..', '..', '..', '..')
const SCRIPT_PATH = join(REPO_ROOT, 'scripts', 'check-kiwi-vendor-sync.sh')

describe('§5.7.5 scripts/check-kiwi-vendor-sync.sh', () => {
  it('AC-S1: script exists, executable, references bab2min/Kiwi releases + VENDOR.md', () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true)
    const stat = statSync(SCRIPT_PATH)
    // executable bit (any of u/g/o)
    expect((stat.mode & 0o111) !== 0).toBe(true)

    const src = readFileSync(SCRIPT_PATH, 'utf-8')
    expect(src).toMatch(/bab2min\/Kiwi/)
    expect(src).toMatch(/VENDOR\.md/)
    // stdout format key — current= / upstream= / hasUpdate=
    expect(src).toMatch(/current=/)
    expect(src).toMatch(/upstream=/)
    expect(src).toMatch(/hasUpdate=/)
  })
})
