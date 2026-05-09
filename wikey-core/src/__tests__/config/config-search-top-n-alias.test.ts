/**
 * §5.7.5 RED — AC-C5 WIKEY_SEARCH_TOP_N alias + WIKEY_QMD_TOP_N deprecation.
 *
 * 우선순위: WIKEY_SEARCH_TOP_N > WIKEY_QMD_TOP_N > default.
 * WIKEY_QMD_TOP_N 사용 시 console.warn 1회 (deprecation marker).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { parseWikeyConf } from '../../config.js'

describe('§5.7.5 config WIKEY_SEARCH_TOP_N alias', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('AC-C5: WIKEY_SEARCH_TOP_N takes priority and WIKEY_QMD_TOP_N emits deprecation warn', () => {
    // Both set: SEARCH wins
    const both = parseWikeyConf('WIKEY_SEARCH_TOP_N=10\nWIKEY_QMD_TOP_N=5')
    expect(both.WIKEY_SEARCH_TOP_N).toBe(10)
    expect(both.WIKEY_QMD_TOP_N).toBe(5)

    // Deprecation warn fires when QMD_TOP_N parsed
    const warnCalls = warnSpy.mock.calls.flat().join(' ')
    expect(warnCalls).toMatch(/WIKEY_QMD_TOP_N is deprecated/)

    // Only QMD set: still parses; SEARCH undefined
    warnSpy.mockClear()
    const onlyQmd = parseWikeyConf('WIKEY_QMD_TOP_N=7')
    expect(onlyQmd.WIKEY_SEARCH_TOP_N).toBeUndefined()
    expect(onlyQmd.WIKEY_QMD_TOP_N).toBe(7)
    const warnCalls2 = warnSpy.mock.calls.flat().join(' ')
    expect(warnCalls2).toMatch(/WIKEY_QMD_TOP_N is deprecated/)

    // Only SEARCH set: no warn
    warnSpy.mockClear()
    const onlySearch = parseWikeyConf('WIKEY_SEARCH_TOP_N=12')
    expect(onlySearch.WIKEY_SEARCH_TOP_N).toBe(12)
    expect(onlySearch.WIKEY_QMD_TOP_N).toBeUndefined()
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
