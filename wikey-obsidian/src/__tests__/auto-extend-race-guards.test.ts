/**
 * §5.7.8 codex Cycle #5 F1 — auto-extend race guards.
 *
 * Two failure modes closed:
 *   (a) Generation counter — a `clearChat()` between an analyzer dispatch and its
 *       completion bumps `autoExtendGeneration`. The success path checks the captured
 *       generation and no-ops; the post-clear cursor stays at 0, the trigger fires
 *       correctly on subsequent threshold-hit pairs.
 *   (b) Monotonic guard — overlapping runs (snapshot=15 dispatched before snapshot=10
 *       resolves) cannot regress the cursor. The cursor only advances when the new
 *       snapshot is strictly greater than the persisted value.
 *
 * The tests construct a WikeyPlugin instance and stub out `runQueryAnalysis` so we
 * control resolve order independently of the real analyzer + suite append.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { App, Vault } from 'obsidian'
import WikeyPlugin from '../main'
import type { RunQueryAnalysisResult } from '../main'

const MANIFEST = { id: 'wikey', name: 'Wikey', version: '0.1.0', dir: '.obsidian/plugins/wikey' }

interface StubResolver {
  resolve: (r: RunQueryAnalysisResult) => void
  promise: Promise<RunQueryAnalysisResult>
}

function deferred(): StubResolver {
  let resolveFn: (r: RunQueryAnalysisResult) => void = () => {}
  const promise = new Promise<RunQueryAnalysisResult>((res) => { resolveFn = res })
  return { resolve: resolveFn, promise }
}

function fivePairs(): Array<{ role: 'user' | 'assistant' | 'error'; content: string }> {
  const out: Array<{ role: 'user' | 'assistant' | 'error'; content: string }> = []
  for (let i = 0; i < 5; i += 1) {
    out.push({ role: 'user', content: `q${i}` })
    out.push({ role: 'assistant', content: `a${i}` })
  }
  return out
}

let plugin: WikeyPlugin
let savedSnapshots: number[] = []

beforeEach(() => {
  const app = new App(new Vault())
  ;(app.vault.adapter as unknown as { basePath: string }).basePath = '/tmp/wikey-race-guard'
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
    advancedQueryTuningLastAnalyzedIndex: 0,
    persistChatHistory: false,
    savedChatHistory: [],
  }
  savedSnapshots = []
  // @ts-expect-error - direct field assignment for test
  plugin.saveData = async () => {
    savedSnapshots.push(plugin.settings.advancedQueryTuningLastAnalyzedIndex)
  }
  // @ts-expect-error - skip flush during tests
  plugin.commitChatSave = async () => undefined
})

afterEach(() => { /* no-op */ })

describe('Cycle #5 F1 (a) — generation counter invalidates clearChat-orphaned runs', () => {
  it('Late-completing run after clearChat does NOT advance cursor', async () => {
    plugin.chatHistory = fivePairs()
    const stub = deferred()
    // @ts-expect-error - replace runQueryAnalysis with deferred stub
    plugin.runQueryAnalysis = async () => stub.promise

    // Dispatch — captures generation 1, snapshotLength 10.
    plugin.maybeTriggerAutoExtend()
    expect(plugin.autoExtendGeneration).toBe(1)

    // Simulate clearChat() — generation bumps to 2; cursor + history reset.
    plugin.autoExtendGeneration += 1
    plugin.chatHistory = []
    // @ts-expect-error - settings mutation
    plugin.settings = {
      ...plugin.settings,
      savedChatHistory: [],
      advancedQueryTuningLastAnalyzedIndex: 0,
    }

    // Late completion — analyzer returns success after the invalidation.
    stub.resolve({
      entries: [{
        id: 'auto-late',
        query: 'q',
        expected_top1: 'page',
        expected_top3: ['page'],
        domain: 'general',
        source: 'auto-extended' as const,
        created_at: '2026-05-10T00:00:00Z',
      }],
      fallback: 'none',
      latencyMs: 0,
      appendOutcome: 'ok',
      entriesAppended: 1,
    })
    // Yield enough microtasks for the .then chain to settle.
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()

    expect(plugin.settings.advancedQueryTuningLastAnalyzedIndex).toBe(0)
    expect(savedSnapshots).not.toContain(10) // the orphaned snapshot must NOT be saved.
  })

  it('Trigger after clearChat fires correctly on next threshold hit', async () => {
    // Pre-clear state.
    plugin.chatHistory = fivePairs()
    const stub1 = deferred()
    // @ts-expect-error - replace runQueryAnalysis
    plugin.runQueryAnalysis = async () => stub1.promise
    plugin.maybeTriggerAutoExtend()

    // clearChat simulation (history+cursor reset, generation bump).
    plugin.autoExtendGeneration += 1
    plugin.chatHistory = []
    // @ts-expect-error - settings mutation
    plugin.settings = {
      ...plugin.settings,
      savedChatHistory: [],
      advancedQueryTuningLastAnalyzedIndex: 0,
    }

    // Resolve the orphaned run → ignored.
    stub1.resolve({
      entries: [],
      fallback: 'none',
      latencyMs: 0,
      appendOutcome: 'no-entries',
      entriesAppended: 0,
    })
    // Drain microtasks for the orphaned run's .then chain.
    for (let i = 0; i < 10; i += 1) await Promise.resolve()

    // Post-clear, user accumulates 5 new pairs and the trigger fires.
    plugin.chatHistory = fivePairs()
    const stub2 = deferred()
    // @ts-expect-error - replace runQueryAnalysis
    plugin.runQueryAnalysis = async () => stub2.promise
    plugin.maybeTriggerAutoExtend()
    stub2.resolve({
      entries: [],
      fallback: 'none',
      latencyMs: 0,
      appendOutcome: 'no-entries',
      entriesAppended: 0,
    })
    // Drain microtasks for run #2's .then chain (3 awaits inside: commitChatSave +
    // settings update + saveData). Use a generous count since vitest's microtask
    // scheduling can interleave with stub plumbing.
    for (let i = 0; i < 20; i += 1) await Promise.resolve()

    expect(plugin.settings.advancedQueryTuningLastAnalyzedIndex).toBe(10) // post-clear snapshot
  })
})

describe('Cycle #5 F1 (b) — monotonic guard against overlapping runs', () => {
  it('Cycle #6 F2 fix — generation MATCH + snapshot ≤ cursor → monotonic branch hit, cursor unchanged', async () => {
    // The earlier (Cycle #5) test relied on B bumping the generation, which routed A's
    // late completion through the *generation guard* — never reaching the monotonic
    // branch. To exercise the monotonic guard in isolation we:
    //   1. Dispatch run #A (snapshot=10), capturing gen=1.
    //   2. Without bumping the generation, simulate a cursor jump to 20 (e.g. an
    //      external write or a resolved sibling run that didn't bump gen — the
    //      condition the monotonic guard exists to defend).
    //   3. Resolve run #A. Generation matches (1==1), but `snapshot 10 ≤ cursor 20`
    //      → monotonic guard kicks in → cursor stays at 20.
    plugin.chatHistory = fivePairs() // length 10
    const stubA = deferred()
    // @ts-expect-error - replace runQueryAnalysis
    plugin.runQueryAnalysis = async () => stubA.promise

    // Step 1 — dispatch A.
    plugin.maybeTriggerAutoExtend()
    expect(plugin.autoExtendGeneration).toBe(1) // A captured gen=1

    // Step 2 — cursor jumps to 20 *without* bumping the generation. We assert the
    // monotonic guard's branch in isolation, so we manually set the persisted cursor
    // to a value greater than A's snapshot.
    // @ts-expect-error - settings mutation
    plugin.settings = {
      ...plugin.settings,
      advancedQueryTuningLastAnalyzedIndex: 20,
    }

    // Step 3 — resolve A with success. Generation guard passes (1 === 1). Monotonic
    // guard must reject (snapshot 10 ≤ cursor 20).
    stubA.resolve({
      entries: [],
      fallback: 'none',
      latencyMs: 0,
      appendOutcome: 'no-entries',
      entriesAppended: 0,
    })
    for (let i = 0; i < 20; i += 1) await Promise.resolve()

    // Cursor must remain 20 — A's stale snapshot (10) cannot regress it.
    expect(plugin.settings.advancedQueryTuningLastAnalyzedIndex).toBe(20)
    // No saveData write should record value 10 (would indicate the guard was bypassed).
    expect(savedSnapshots).not.toContain(10)
  })

  it('Generation MATCH + snapshot > cursor → monotonic branch passes, cursor advances', async () => {
    // The complementary case — confirms the guard does not over-block. Same setup
    // but we leave the cursor at 0 so snapshot=10 > cursor=0 → cursor must advance to 10.
    plugin.chatHistory = fivePairs()
    const stub = deferred()
    // @ts-expect-error - replace runQueryAnalysis
    plugin.runQueryAnalysis = async () => stub.promise
    plugin.maybeTriggerAutoExtend()
    stub.resolve({
      entries: [],
      fallback: 'none',
      latencyMs: 0,
      appendOutcome: 'no-entries',
      entriesAppended: 0,
    })
    for (let i = 0; i < 20; i += 1) await Promise.resolve()
    expect(plugin.settings.advancedQueryTuningLastAnalyzedIndex).toBe(10)
  })
})

describe('Cycle #6 F1 — append-time generation guard skips suite mutation + Notice', () => {
  it('Invalidated run between dispatch and resolution → vault write 0 + Notice 0', async () => {
    // Build a plugin instance with a Notice-counting + write-counting harness.
    // We exercise `runQueryAnalysis` directly with a generationToken whose `current()`
    // returns a value different from `gen`, simulating a clearChat() between dispatch
    // and the analyzer's resolution.
    let writes = 0
    let notices = 0

    // Track Notice instantiation by replacing the global proxy. The mocked Notice
    // class records to a static log (`Notice.__log.push(message)`); we measure the
    // delta across the call.
    const { Notice } = await import('obsidian')
    const baseNoticeCount = (Notice as unknown as { __log: string[] }).__log.length

    // Stub `appendEntriesToSuite` indirectly by intercepting via fs writeFileSync —
    // tracking node:fs writes on the suite path. Simpler: stub `ensureAutoExtendedSuite`
    // and `appendEntriesToSuite` indirectly via plugin private members.
    const fs = require('node:fs') as typeof import('node:fs')
    const origWrite = fs.writeFileSync
    fs.writeFileSync = ((path: string | Buffer | URL, data: unknown, opts?: unknown) => {
      if (typeof path === 'string' && path.includes('auto-extended-suite')) {
        writes += 1
      }
      return origWrite.call(fs, path as string, data as string, opts as { encoding?: BufferEncoding } | BufferEncoding | null | undefined)
    }) as typeof fs.writeFileSync

    try {
      plugin.chatHistory = fivePairs()
      // Stub the analyzer LLM so analyze() resolves with entries; the *append* is the
      // side effect we're trying to suppress.
      // @ts-expect-error - replace LLM
      plugin.llmClient = {
        async call() {
          return JSON.stringify({
            entries: [{
              id: 'auto-late',
              query: 'q',
              expected_top1: 'p',
              expected_top3: ['p'],
              domain: 'general',
              source: 'auto-extended' as const,
              created_at: '2026-05-10T00:00:00Z',
            }],
          })
        },
      }

      // Inject a generationToken whose current() drifts from gen — analyzer must abort
      // at the append-time check.
      let liveGen = 1
      const token = { gen: 1, current: () => liveGen }

      // Resolve immediately (no real LLM latency in test). Right before the
      // resolution we bump liveGen — emulating clearChat() during analyze().
      // We can't actually delay between analyze() and the guard check inside one async
      // call without modifying the impl, so we set liveGen to 2 *before* calling
      // runQueryAnalysis. Since gen=1 captured at construction, the guard sees the
      // mismatch and aborts before any side effect.
      liveGen = 2

      const result = await plugin.runQueryAnalysis(undefined, 0, token)

      expect(result.fallback).toBe('invalidated')
      expect(result.appendOutcome).toBe('skipped')
      expect(result.entriesAppended).toBe(0)
      expect(writes).toBe(0)
      // Notice count must be unchanged (no "X queries analyzed" toast).
      const after = (Notice as unknown as { __log: string[] }).__log.length
      notices = after - baseNoticeCount
      expect(notices).toBe(0)
    } finally {
      fs.writeFileSync = origWrite
    }
  })

  it('Generation token absent (manual trigger) → suite mutation proceeds normally', async () => {
    // The settings-tab "Run now" + commands.ts "Run query analysis" callers omit the
    // token. Their existing semantics must remain intact: append the suite + show Notice.
    let writes = 0
    const fs = require('node:fs') as typeof import('node:fs')
    const origWrite = fs.writeFileSync
    fs.writeFileSync = ((path: string | Buffer | URL, data: unknown, opts?: unknown) => {
      if (typeof path === 'string' && path.includes('auto-extended-suite')) {
        writes += 1
      }
      return origWrite.call(fs, path as string, data as string, opts as { encoding?: BufferEncoding } | BufferEncoding | null | undefined)
    }) as typeof fs.writeFileSync
    try {
      plugin.chatHistory = fivePairs()
      // @ts-expect-error - replace LLM
      plugin.llmClient = {
        async call() {
          return JSON.stringify({
            entries: [{
              id: 'auto-manual',
              query: 'q',
              expected_top1: 'p',
              expected_top3: ['p'],
              domain: 'general',
              source: 'auto-extended' as const,
              created_at: '2026-05-10T00:00:00Z',
            }],
          })
        },
      }
      // Use an existing tmp file under cwd for the test suite to avoid touching real vault paths.
      const path = require('node:path') as typeof import('node:path')
      const os = require('node:os') as typeof import('node:os')
      const fsExtra = require('node:fs') as typeof import('node:fs')
      const tmp = fsExtra.mkdtempSync(path.join(os.tmpdir(), 'wikey-cycle6-'))
      const target = path.join(tmp, '.wikey', 'auto-extended-suite.json')

      const result = await plugin.runQueryAnalysis(target, 0)

      expect(result.fallback).toBe('none')
      expect(result.appendOutcome).toBe('ok')
      expect(result.entriesAppended).toBeGreaterThanOrEqual(1)
      expect(writes).toBeGreaterThanOrEqual(1)

      fsExtra.rmSync(tmp, { recursive: true, force: true })
    } finally {
      fs.writeFileSync = origWrite
    }
  })
})
