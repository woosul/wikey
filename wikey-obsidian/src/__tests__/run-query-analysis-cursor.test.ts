/**
 * §5.7.8 codex Cycle #3 F1 + F2 — `runQueryAnalysis` cursor + return-value contract.
 *
 * F1 — Per-call return value (no plugin-global field). Concurrent runs must each
 *      report their own append outcome through the resolved promise.
 * F2 — `collectChatPairs(fromIndex)` + `runQueryAnalysis(suitePath, fromIndex)`
 *      narrow the LLM input to the post-cursor window. Same pairs are not re-fed
 *      across cursor advances.
 *
 * The tests construct a WikeyPlugin instance directly via the obsidian mock surface
 * so we exercise the *real* method bodies (no helper extraction shortcut).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { App, Vault } from 'obsidian'
import WikeyPlugin from '../main'
import type { WikiFS } from 'wikey-core'

const MANIFEST = { id: 'wikey', name: 'Wikey', version: '0.1.0', dir: '.obsidian/plugins/wikey' }

let tmpRoot = ''
let suitePath = ''

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'wikey-runqa-cursor-'))
  suitePath = join(tmpRoot, 'auto-extended-suite.json')
  writeFileSync(
    suitePath,
    JSON.stringify({ version: 1, collection: 'wikey-wiki', queries: [] }, null, 2),
    'utf-8',
  )
})
afterEach(() => {
  if (tmpRoot) rmSync(tmpRoot, { recursive: true, force: true })
})

/**
 * Build a WikeyPlugin instance with just enough wiring to exercise `runQueryAnalysis`
 * and `collectChatPairs`. The vault adapter `basePath` is set to a tmp dir so the
 * default suite path resolution and `wikiFS` reads stay isolated.
 */
function makePlugin(): WikeyPlugin {
  const app = new App(new Vault())
  // Inject a basePath so `autoExtendedSuiteAbsolutePath` resolves under tmpRoot.
  ;(app.vault.adapter as unknown as { basePath: string }).basePath = tmpRoot
  // happy-dom Plugin stub accepts (app, manifest) — see __mocks__/obsidian.ts.
  const plugin = new (WikeyPlugin as unknown as new (
    a: App,
    m: { id: string; name: string; version: string },
  ) => WikeyPlugin)(app, MANIFEST)
  // Minimal wikiFS — `runQueryAnalysis` only calls `exists/read` on the prompt override.
  const wikiFS: WikiFS = {
    async exists() { return false },
    async read() { throw new Error('not used') },
    async write() { /* no-op */ },
    async list() { return [] },
  }
  // @ts-expect-error: we deliberately bypass the full onload() lifecycle.
  plugin.wikiFS = wikiFS
  return plugin
}

describe('Cycle #3 F2 — collectChatPairs(fromIndex) windowing', () => {
  it('collectChatPairs(0) returns every pair, collectChatPairs(after-1st-pair) drops it', () => {
    const plugin = makePlugin()
    plugin.chatHistory = [
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'q2' },
      { role: 'assistant', content: 'a2' },
    ]
    expect(plugin.collectChatPairs(0).map((p) => p.query)).toEqual(['q1', 'q2'])
    expect(plugin.collectChatPairs(2).map((p) => p.query)).toEqual(['q2'])
    expect(plugin.collectChatPairs(4).map((p) => p.query)).toEqual([])
  })
})

describe('Cycle #3 F1 — runQueryAnalysis returns per-call append outcome', () => {
  it('Successful analyze + entries → resolved value reports appendOutcome=ok + entriesAppended', async () => {
    const plugin = makePlugin()
    plugin.chatHistory = [
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a' },
    ]
    // Stub the analyzer indirection by intercepting `buildFilterLLMClient`'s LLM call.
    // Easier path: stub `QueryAnalyzer` via the analyzer's `llm.call` — we mock through
    // the shared `LLMClient` field after instantiation.
    // @ts-expect-error - private field assignment for test
    plugin.llmClient = {
      async call() {
        return JSON.stringify({
          entries: [{
            id: 'auto-aaaa1111',
            query: 'q',
            expected_top1: 'page-a',
            expected_top3: ['page-a'],
            domain: 'general',
            source: 'auto-extended',
            created_at: '2026-05-10T00:00:00Z',
          }],
        })
      },
    }
    // @ts-expect-error - settings mutation for test
    plugin.settings = {
      ...plugin.settings,
      advancedQueryTuningEnabled: true,
      advancedQueryTuningProvider: '',
      advancedQueryTuningModel: '',
      advancedQueryTuningTemperature: 0,
      advancedQueryTuningMaxTokens: 500,
      advancedQueryTuningTimeoutMs: 5000,
    }

    const r = await plugin.runQueryAnalysis(suitePath)
    expect(r.fallback).toBe('none')
    expect(r.appendOutcome).toBe('ok')
    expect(r.entriesAppended).toBe(1)
    expect(r.entries.length).toBe(1)

    const reloaded = JSON.parse(readFileSync(suitePath, 'utf-8'))
    expect(reloaded.queries.length).toBe(1)
  })

  it('Concurrent runQueryAnalysis calls do not clobber each other (per-call return)', async () => {
    const plugin = makePlugin()
    plugin.chatHistory = [
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a' },
    ]
    let counter = 0
    // @ts-expect-error - private field assignment for test
    plugin.llmClient = {
      async call() {
        // Even-numbered calls return entries; odd calls return empty.
        const turn = counter += 1
        if (turn % 2 === 0) {
          return JSON.stringify({ entries: [] })
        }
        return JSON.stringify({
          entries: [{
            id: `auto-${turn}`,
            query: 'q',
            expected_top1: 'page-a',
            expected_top3: ['page-a'],
            domain: 'general',
            source: 'auto-extended',
            created_at: '2026-05-10T00:00:00Z',
          }],
        })
      },
    }
    // @ts-expect-error - settings mutation
    plugin.settings = {
      ...plugin.settings,
      advancedQueryTuningEnabled: true,
      advancedQueryTuningProvider: '',
      advancedQueryTuningModel: '',
      advancedQueryTuningTemperature: 0,
      advancedQueryTuningMaxTokens: 500,
      advancedQueryTuningTimeoutMs: 5000,
    }

    const [r1, r2] = await Promise.all([
      plugin.runQueryAnalysis(suitePath),
      plugin.runQueryAnalysis(suitePath),
    ])
    // First-resolved (turn 1) → entries=1 + ok; second-resolved (turn 2) → no-entries.
    // Either ordering is valid for the promises but the *outcomes* must not collide.
    const outcomes = [r1, r2].map((r) => r.appendOutcome).sort()
    expect(outcomes).toEqual(['no-entries', 'ok'])
    const entryCounts = [r1, r2].map((r) => r.entriesAppended).sort()
    expect(entryCounts).toEqual([0, 1])
  })

  it("Empty pairs (fromIndex past end) → fallback='none' + appendOutcome='no-entries' + 0 added", async () => {
    const plugin = makePlugin()
    plugin.chatHistory = [
      { role: 'user', content: 'q' },
      { role: 'assistant', content: 'a' },
    ]
    // @ts-expect-error - private field assignment for test
    plugin.llmClient = {
      async call() { throw new Error('should not be called when pairs is empty') },
    }
    // @ts-expect-error - settings mutation
    plugin.settings = { ...plugin.settings, advancedQueryTuningEnabled: true }

    const r = await plugin.runQueryAnalysis(suitePath, 99 /* cursor past end */)
    expect(r.fallback).toBe('none')
    expect(r.appendOutcome).toBe('no-entries')
    expect(r.entriesAppended).toBe(0)
  })
})

describe('Cycle #3 F2 — auto-extend cursor advance does not re-feed already-analysed pairs', () => {
  it('After first run consumes window, runQueryAnalysis(_, cursor) sees only new pairs', async () => {
    const plugin = makePlugin()
    plugin.chatHistory = [
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'q2' },
      { role: 'assistant', content: 'a2' },
    ]
    const seenQueries: string[][] = []
    // @ts-expect-error - private field assignment
    plugin.llmClient = {
      async call(prompt: string) {
        // Capture the queries the analyzer was given (the prompt has "Pairs: [...]" injected).
        const m = prompt.match(/"query":"([^"]+)"/g)
        seenQueries.push(m ? m.map((s) => s.replace(/.*"query":"/, '').replace('"', '')) : [])
        return JSON.stringify({ entries: [] })
      },
    }
    // @ts-expect-error - settings mutation
    plugin.settings = { ...plugin.settings, advancedQueryTuningEnabled: true }

    // First run from cursor 0 — sees q1+q2.
    await plugin.runQueryAnalysis(suitePath, 0)
    // Second run from cursor 2 (past first pair) — sees only q2.
    await plugin.runQueryAnalysis(suitePath, 2)
    // Third run from cursor 4 (past both pairs) — sees nothing → no LLM call.
    await plugin.runQueryAnalysis(suitePath, 4)

    expect(seenQueries[0]).toEqual(['q1', 'q2'])
    expect(seenQueries[1]).toEqual(['q2'])
    expect(seenQueries.length).toBe(2) // third run skipped LLM (empty pairs)
  })
})
