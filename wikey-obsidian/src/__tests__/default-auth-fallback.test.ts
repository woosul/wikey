/**
 * §5.6.4.2 Step B — `buildDefaultAuthFallback` Notice mapping.
 *
 * Plan: plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md §5.3 Step B (B4).
 *
 * Asserts every AuthFallbackInfo.reason maps to an English-only Notice string
 * (system language LOCK 2026-05-12) and includes the provider name. The injection
 * surface (`noticeFn`) is mocked so this runs outside the Obsidian renderer.
 */

import { describe, expect, it, vi } from 'vitest'
import type { AuthFallbackInfo } from 'wikey-core'
import { buildDefaultAuthFallback } from '../main'

const REASONS: AuthFallbackInfo['reason'][] = [
  'quota-exceeded',
  'auth-missing',
  'spawn-failed',
  'jsonMode-unsupported',
  'timeout',
]

describe('§5.6.4.2 Step B — buildDefaultAuthFallback', () => {
  it('surfaces one Notice per fallback event', () => {
    const noticeFn = vi.fn<(msg: string) => void>()
    const cb = buildDefaultAuthFallback(noticeFn)
    cb({ provider: 'gemini', reason: 'quota-exceeded' })
    expect(noticeFn).toHaveBeenCalledTimes(1)
    expect(noticeFn.mock.calls[0][0]).toContain('gemini')
  })

  it.each(REASONS)('reason "%s" → English message including provider name', (reason) => {
    const noticeFn = vi.fn<(msg: string) => void>()
    const cb = buildDefaultAuthFallback(noticeFn)
    cb({ provider: 'gemini', reason })
    const msg = noticeFn.mock.calls[0]?.[0] ?? ''
    expect(msg).toContain('gemini')
    // English-only assertion — no Hangul codepoints (system language LOCK).
    expect(msg).not.toMatch(/[가-힯]/)
    // Reason-specific keyword present.
    const keywords: Record<typeof reason, RegExp> = {
      'quota-exceeded': /quota/i,
      'auth-missing': /signed in/i,
      'spawn-failed': /CLI/i,
      'jsonMode-unsupported': /JSON/i,
      'timeout': /timeout/i,
    }
    expect(msg).toMatch(keywords[reason])
  })

  it('passes through provider name from info argument', () => {
    const noticeFn = vi.fn<(msg: string) => void>()
    const cb = buildDefaultAuthFallback(noticeFn)
    cb({ provider: 'anthropic', reason: 'quota-exceeded' })
    expect(noticeFn.mock.calls[0][0]).toContain('anthropic')
  })
})
