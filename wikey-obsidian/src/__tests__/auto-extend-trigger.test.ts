/**
 * §5.7.8 Finding 3 fix — auto-extend N=5 trigger.
 *
 * Validates `countQueryAnswerPairs` (the high-water-mark counter that drives
 * `maybeTriggerAutoExtend`) handles cursor advancement, alternating roles, and
 * empty-content skips correctly.
 */

import { describe, it, expect } from 'vitest'
import {
  countQueryAnswerPairs,
  shouldAdvanceAutoExtendCursor,
} from '../main'

type Msg = { role: 'user' | 'assistant' | 'error'; content: string }

function pair(query: string, answer: string): Msg[] {
  return [{ role: 'user', content: query }, { role: 'assistant', content: answer }]
}

describe('countQueryAnswerPairs — auto-extend cursor', () => {
  it('Empty history → 0', () => {
    expect(countQueryAnswerPairs([], 0)).toBe(0)
  })

  it('Five (user, assistant) pairs from cursor 0 → 5', () => {
    const history: Msg[] = []
    for (let i = 0; i < 5; i += 1) history.push(...pair(`q${i}`, `a${i}`))
    expect(countQueryAnswerPairs(history, 0)).toBe(5)
  })

  it('Cursor at end of last analyzed pair → only counts new pairs', () => {
    const history: Msg[] = []
    for (let i = 0; i < 5; i += 1) history.push(...pair(`q${i}`, `a${i}`))
    // Cursor advanced past 4 pairs (8 messages). Only the 5th pair remains.
    expect(countQueryAnswerPairs(history, 8)).toBe(1)
  })

  it('Empty content user/assistant message skipped', () => {
    const history: Msg[] = [
      { role: 'user', content: '' },
      { role: 'assistant', content: 'a' },
      { role: 'user', content: 'q' },
      { role: 'assistant', content: '' },
      { role: 'user', content: 'q2' },
      { role: 'assistant', content: 'a2' },
    ]
    expect(countQueryAnswerPairs(history, 0)).toBe(1) // only the (q2, a2) pair counts
  })

  it('Error messages do not form pairs', () => {
    const history: Msg[] = [
      { role: 'user', content: 'q' },
      { role: 'error', content: 'oops' },
      { role: 'user', content: 'q2' },
      { role: 'assistant', content: 'a2' },
    ]
    expect(countQueryAnswerPairs(history, 0)).toBe(1)
  })

  it('Threshold semantics — 5 pairs needed for N=5 trigger', () => {
    const history: Msg[] = []
    for (let i = 0; i < 4; i += 1) history.push(...pair(`q${i}`, `a${i}`))
    // 4 pairs, threshold 5 → not yet triggered.
    expect(countQueryAnswerPairs(history, 0)).toBeLessThan(5)
    history.push(...pair('q4', 'a4'))
    // Now 5 pairs — threshold met.
    expect(countQueryAnswerPairs(history, 0)).toBeGreaterThanOrEqual(5)
  })
})

/**
 * Cycle #2 F1 — `shouldAdvanceAutoExtendCursor` is the rule consulted by
 * `maybeTriggerAutoExtend` after each analyzer run. The pure helper isolates the
 * decision so the cursor never advances on an analyzer fail / timeout / append error.
 */
describe('shouldAdvanceAutoExtendCursor — Cycle #2 F1 cursor durability', () => {
  it('Analyzer success + append ok → cursor advances', () => {
    expect(shouldAdvanceAutoExtendCursor('none', 'ok')).toBe(true)
  })

  it('Analyzer success + no entries returned → cursor still advances (window consumed)', () => {
    // Empty entry set is a legitimate analyzer outcome — pairs were processed and the
    // LLM judged none worth keeping. The cursor must move forward; otherwise the same
    // pairs would be re-analysed forever.
    expect(shouldAdvanceAutoExtendCursor('none', 'no-entries')).toBe(true)
  })

  it('Analyzer success + append-error → cursor stays (window preserved for retry)', () => {
    expect(shouldAdvanceAutoExtendCursor('none', 'append-error')).toBe(false)
  })

  it("Analyzer 'llm-fail' → cursor stays (regardless of append outcome)", () => {
    expect(shouldAdvanceAutoExtendCursor('llm-fail', 'no-entries')).toBe(false)
    expect(shouldAdvanceAutoExtendCursor('llm-fail', 'ok')).toBe(false)
  })

  it("Analyzer 'timeout' → cursor stays", () => {
    expect(shouldAdvanceAutoExtendCursor('timeout', 'no-entries')).toBe(false)
  })
})

/**
 * Cycle #3 F2 — `countQueryAnswerPairs(history, cursor)` already takes a cursor.
 * The matching helper on the plugin side (`collectChatPairs(fromIndex)`) must keep
 * the same semantic: only pairs whose *user* index is ≥ cursor are returned.
 * This exercises the equivalent rule via a direct re-implementation contract test —
 * the plugin's `collectChatPairs(fromIndex)` is an implementation of the same
 * windowing rule and `countQueryAnswerPairs(...)` is its size-only mirror.
 */
describe('countQueryAnswerPairs windowing — Cycle #3 F2 cursor-respecting', () => {
  it('After cursor advance, only pairs starting at-or-after cursor are counted', () => {
    const history: Msg[] = []
    for (let i = 0; i < 6; i += 1) history.push(...pair(`q${i}`, `a${i}`))
    // 6 pairs total → 12 messages. Cursor at message-index 8 = past 4th pair end.
    // Remaining: pairs 5 and 6 → 2 pairs.
    expect(countQueryAnswerPairs(history, 8)).toBe(2)
  })

  it('Cursor past end of history → 0', () => {
    const history: Msg[] = []
    for (let i = 0; i < 3; i += 1) history.push(...pair(`q${i}`, `a${i}`))
    expect(countQueryAnswerPairs(history, history.length)).toBe(0)
  })

  it('Cursor 0 + cursor at half = different counts (windowing actually applies)', () => {
    const history: Msg[] = []
    for (let i = 0; i < 4; i += 1) history.push(...pair(`q${i}`, `a${i}`))
    // 4 pairs from 0; 2 pairs from message-index 4.
    expect(countQueryAnswerPairs(history, 0)).toBe(4)
    expect(countQueryAnswerPairs(history, 4)).toBe(2)
  })
})
