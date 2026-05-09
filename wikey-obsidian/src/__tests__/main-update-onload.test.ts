/**
 * §5.7.5 RED — onload trigger gate (developerMode + allowUpdateCheck matrix).
 *
 * AC-U4 matrix (3건):
 *   (a) developerMode=true && allowUpdateCheck=true → call = 1 (재시작 1회)
 *   (b) developerMode=true && allowUpdateCheck=false → call = 0
 *   (c) developerMode=false → call = 0 (allowUpdateCheck 무관)
 */

import { describe, it, expect, vi } from 'vitest'
import { shouldDetectUpstreamUpdates } from '../update-onload-gate.js'

describe('§5.7.5 main onload upstream update gate', () => {
  it('AC-U4: matrix (developerMode × allowUpdateCheck) → detect 호출 여부', () => {
    const detectSpy = vi.fn()
    const cases: ReadonlyArray<{
      developerMode: boolean
      allowUpdateCheck: boolean
      expectCall: 0 | 1
    }> = [
      { developerMode: true, allowUpdateCheck: true, expectCall: 1 },
      { developerMode: true, allowUpdateCheck: false, expectCall: 0 },
      { developerMode: false, allowUpdateCheck: true, expectCall: 0 },
      { developerMode: false, allowUpdateCheck: false, expectCall: 0 },
    ]

    for (const c of cases) {
      detectSpy.mockClear()
      const ok = shouldDetectUpstreamUpdates({
        developerMode: c.developerMode,
        allowUpdateCheck: c.allowUpdateCheck,
      })
      if (ok) detectSpy()
      expect(detectSpy.mock.calls.length).toBe(c.expectCall)
    }
  })
})
