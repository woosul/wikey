/**
 * §5.7.8 codex Cycle #4 F1 — auto-extend cursor stale recovery.
 *
 * The cursor (`advancedQueryTuningLastAnalyzedIndex`) is an absolute index into
 * `chatHistory`. After a session reload (chatHistory reset to []), an external
 * data.json edit, or a `clearChat()` call, the cursor can run past the (shorter)
 * current history — silently disabling the auto-extend trigger.
 *
 * Three defensive layers are tested:
 *   1. `clearChat()` resets the cursor to 0 (sidebar-chat → plugin.settings update)
 *   2. `loadSettings()` caps the cursor to chatHistory.length on every plugin load
 *   3. `maybeTriggerAutoExtend()` self-heals if the cursor still exceeds history
 *
 * Layers 1 + 2 are validated via grep contracts against the source files (the
 * full plugin lifecycle is too heavy for a unit test here). Layer 3 is exercised
 * directly via a constructed WikeyPlugin instance.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { App, Vault } from 'obsidian'
import WikeyPlugin from '../main'

const MAIN_SRC = readFileSync(join(__dirname, '..', 'main.ts'), 'utf-8')
const SIDEBAR_SRC = readFileSync(join(__dirname, '..', 'sidebar-chat.ts'), 'utf-8')
const MANIFEST = { id: 'wikey', name: 'Wikey', version: '0.1.0', dir: '.obsidian/plugins/wikey' }

describe('Cycle #4 F1 — clearChat() resets cursor (Layer 1)', () => {
  it('sidebar-chat.ts clearChat() includes advancedQueryTuningLastAnalyzedIndex: 0', () => {
    // The clearChat() method must reset the cursor alongside `savedChatHistory: []`.
    // We assert via source grep because `clearChat` is private; a full UI test would
    // require constructing the WikeyChatView (heavier than the contract).
    const m = SIDEBAR_SRC.match(/private clearChat\(\)\s*{[\s\S]*?\}\s*\n\s*\n/)
    expect(m, 'expected clearChat() block').not.toBeNull()
    expect(m![0]).toMatch(/advancedQueryTuningLastAnalyzedIndex:\s*0/)
    expect(m![0]).toMatch(/savedChatHistory:\s*\[\]/)
  })
})

describe('Cycle #4 F1 — loadSettings() caps cursor to chatHistory.length (Layer 2)', () => {
  it('main.ts loadSettings() includes the cap-and-persist branch', () => {
    // The cap branch must (a) read `cursor` from settings, (b) compare against
    // `this.chatHistory.length` (which is reset to [] earlier in loadSettings()),
    // (c) write back via saveData. Source-grep contract.
    const m = MAIN_SRC.match(/async loadSettings\(\)[\s\S]*?\n\s\s\}\n/)
    expect(m, 'expected loadSettings() block').not.toBeNull()
    const block = m![0]
    expect(block).toMatch(/cursor.*advancedQueryTuningLastAnalyzedIndex/u)
    expect(block).toMatch(/cursor\s*>\s*this\.chatHistory\.length/u)
    expect(block).toMatch(/saveData\(this\.buildPluginOnlyData\(\)\)/u)
  })
})

describe('Cycle #4 F1 — maybeTriggerAutoExtend() defensive recovery (Layer 3)', () => {
  let plugin: WikeyPlugin

  beforeEach(() => {
    const app = new App(new Vault())
    ;(app.vault.adapter as unknown as { basePath: string }).basePath = '/tmp/wikey-cursor-test'
    plugin = new (WikeyPlugin as unknown as new (
      a: App,
      m: { id: string; name: string; version: string },
    ) => WikeyPlugin)(app, MANIFEST)
    // @ts-expect-error - bypass full onload lifecycle
    plugin.settings = {
      advancedQueryTuningEnabled: true,
      advancedQueryTuningMode: 'filter-only',
      advancedQueryTuningTimeoutMs: 5000,
      advancedQueryTuningCacheSize: 1000,
      advancedQueryTuningProvider: '',
      advancedQueryTuningModel: '',
      advancedQueryTuningTemperature: 0,
      advancedQueryTuningMaxTokens: 500,
      advancedQueryTuningAutoExtendThreshold: 5,
      advancedQueryTuningLastAnalyzedIndex: 999, // stale — far past any plausible history.
      persistChatHistory: false,
      savedChatHistory: [],
    }
    // @ts-expect-error - direct field assignment
    plugin.saveData = async () => undefined
  })
  afterEach(() => { /* no-op */ })

  it('Stale cursor (cursor > chatHistory.length) → reset to 0 + warn', () => {
    plugin.chatHistory = [
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
    ]
    const warnings: string[] = []
    const origWarn = console.warn
    console.warn = (...args: unknown[]) => { warnings.push(args.join(' ')) }
    try {
      plugin.maybeTriggerAutoExtend()
    } finally {
      console.warn = origWarn
    }
    expect(plugin.settings.advancedQueryTuningLastAnalyzedIndex).toBe(0)
    expect(warnings.some((w) => /cursor \(999\)/u.test(w))).toBe(true)
  })

  it('Cursor at history end (cursor === length) → not reset (no false alarm)', () => {
    plugin.chatHistory = [
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
    ]
    // @ts-expect-error - settings mutation
    plugin.settings = { ...plugin.settings, advancedQueryTuningLastAnalyzedIndex: 2 }
    plugin.maybeTriggerAutoExtend()
    expect(plugin.settings.advancedQueryTuningLastAnalyzedIndex).toBe(2)
  })
})

describe('Cycle #4 F1 — countQueryAnswerPairs after cursor reset', () => {
  it('After clearChat-style reset (cursor=0, history=[]) + 5 new pairs → trigger fires', async () => {
    // End-to-end: simulate clearChat (cursor reset to 0 + history reset to []),
    // then push 5 new (q,a) pairs. countQueryAnswerPairs(history, 0) ≥ 5 — trigger
    // semantics OK. (We don't actually run maybeTriggerAutoExtend's analyzer here;
    // that path is covered by run-query-analysis-cursor.test.ts.)
    const { countQueryAnswerPairs } = await import('../main')
    const history: Array<{ role: 'user' | 'assistant' | 'error'; content: string }> = []
    for (let i = 0; i < 5; i += 1) {
      history.push({ role: 'user', content: `q${i}` })
      history.push({ role: 'assistant', content: `a${i}` })
    }
    expect(countQueryAnswerPairs(history, 0)).toBeGreaterThanOrEqual(5)
  })
})
