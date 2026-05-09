/**
 * §5.7.5 RED — AC-D1 README.md ## Developer mode 섹션 + exact phrases.
 */

import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const README = join(__dirname, '..', '..', '..', '..', 'README.md')

describe('§5.7.5 README.md Developer mode section', () => {
  it('AC-D1: README contains Developer mode section with exact phrases', () => {
    expect(existsSync(README)).toBe(true)
    const src = readFileSync(README, 'utf-8')
    // Section heading present
    expect(src).toMatch(/##\s+Developer mode/m)
    // Toggle phrase (option A locked, no env-var reference in body)
    expect(src).toMatch(/Show developer section/)
    // UI phrases
    expect(src).toMatch(/Developer \(advanced\)/)
    expect(src).toContain('[upgrade]')
    expect(src).toContain('[분석]')
    expect(src).toContain('[개발필요]')
  })
})
