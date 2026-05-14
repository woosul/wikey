/**
 * §5.6.4.1 Step A3-1 — cli-parser RED (marker-based, v0.7 #1h H1).
 *
 * Plan reference:
 *   - docs/planning/phase-5/phase-5-todox-5.6.4-llm-subscription.md §4.0.7, §5.2 A3-1
 *
 * 11 cases lock (v0.7 #1h H1):
 *   1~5  raw==clean parsing      (gemini-ok / gemini-noheader-ok / claude-ok / codex-ok-hi / codex-bodylike)
 *   6    codex banner+prompt sentinel leak (negative — must NOT contain banner/prompt)
 *   7    codex footer "tokens used" leak (strict toBe('hi'))
 *   8    gemini "Loaded cached credentials" header strip
 *   9~11 detectFallbackTrigger(401 raws) → 'auth-missing'
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSubscriptionOutput } from '../cli-parser.js'
import { detectFallbackTrigger } from '../auth-resolver.js'

const HERE = resolve(fileURLToPath(import.meta.url), '..')
const FIXTURE_DIR = resolve(HERE, 'fixtures', 'cli-stdout')

function readFixture(name: string): string {
  return readFileSync(resolve(FIXTURE_DIR, name), 'utf-8')
}

describe('§5.6.4 parseSubscriptionOutput — raw → clean (5 pairs)', () => {
  it.each([
    ['gemini', 'gemini-ok'],
    ['gemini', 'gemini-noheader-ok'],
    ['anthropic', 'claude-ok'],
    ['openai', 'codex-ok-hi'],
    ['openai', 'codex-bodylike'],
  ] as const)('parseSubscriptionOutput(%s, raw) === clean fixture (%s)', (provider, name) => {
    const raw = readFixture(`${name}-raw.txt`)
    const expected = readFixture(`${name}-clean.txt`).replace(/\n+$/, '')
    expect(parseSubscriptionOutput(provider, raw)).toBe(expected)
  })
})

describe('§5.6.4 codex parser — marker-based (banner / prompt / footer leak 회귀)', () => {
  it('case 6: drops banner / metadata / prompt sentinel', () => {
    const raw = readFixture('codex-ok-hi-raw.txt')
    const out = parseSubscriptionOutput('openai', raw)
    expect(out).not.toContain('say only the word:')
    expect(out).not.toContain('OpenAI Codex')
    expect(out).not.toContain('research preview')
    expect(out).not.toContain('workdir:')
    expect(out).not.toContain('session id:')
    expect(out).not.toContain('approval:')
    expect(out).not.toMatch(/^user$/m)
    expect(out).not.toMatch(/^-+$/m)
  })

  it('case 7: drops "tokens used" footer marker (strict body match)', () => {
    const raw = readFixture('codex-ok-hi-raw.txt')
    const out = parseSubscriptionOutput('openai', raw)
    expect(out).not.toContain('tokens used\n')
    expect(out).toBe('hi')
  })
})

describe('§5.6.4 gemini parser — header strip', () => {
  it('case 8: drops "Loaded cached credentials" header', () => {
    const raw = readFixture('gemini-ok-raw.txt')
    const out = parseSubscriptionOutput('gemini', raw)
    expect(out).not.toMatch(/Loaded cached credentials/)
  })
})

describe('§5.6.4 detectFallbackTrigger — 401 raw detection', () => {
  it.each([
    ['gemini-401', 'auth-missing'],
    ['claude-401', 'auth-missing'],
    ['codex-401', 'auth-missing'],
  ] as const)('detectFallbackTrigger from %s stderr → %s', (name, expectedReason) => {
    const raw = readFixture(`${name}-raw.txt`)
    expect(detectFallbackTrigger({ status: 0, stderr: raw, body: '' })).toBe(expectedReason)
  })
})
