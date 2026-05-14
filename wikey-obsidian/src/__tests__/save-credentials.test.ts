/**
 * §5.6.4 A5 / I11 — credentials.json migration round-trip (codex cycle #2 F3 fix).
 *
 * Spec ref: plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md §5.6.4 A5 I11
 * (v0.2 → v0.3 migration + unknown-field preservation).
 *
 * Approach: exercise the *pure* `parseCredentialsPayload` / `serializeCredentialsPayload`
 * helpers extracted from `WikeyPlugin.{load,save}Credentials`. The end-to-end fs
 * round-trip (read JSON → parse → serialize → write JSON) is verified with
 * `os.tmpdir()` so we do not need an Obsidian renderer.
 *
 * Cases:
 *   1. v0.2 → v0.3 load + save — geminiApiKey only file gets `auth` sub-object on save,
 *      legacy keys preserved on disk.
 *   2. v0.3 → v0.3 round-trip — load → save → byte-identical canonical shape.
 *   3. v0.3 with legacy `'auto'` mode — migrates to `'subscription'`.
 *   4. unknown user-added field (`xaiApiKey`) — survives a load + save round-trip.
 */

import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  parseCredentialsPayload,
  serializeCredentialsPayload,
} from '../main'

function withTmpFile(seed: Record<string, unknown>, fn: (path: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), 'wikey-cred-'))
  const file = join(dir, 'credentials.json')
  writeFileSync(file, JSON.stringify(seed, null, 2))
  try {
    fn(file)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('§5.6.4 A5 / I11 — credentials migration round-trip', () => {
  it('case 1 — v0.2 (geminiApiKey only) load → save adds auth sub-object, preserves keys', () => {
    const v02: Record<string, unknown> = { geminiApiKey: 'AIzaTest123' }
    withTmpFile(v02, (file) => {
      const raw = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>
      const parsed = parseCredentialsPayload(raw)
      expect(parsed.geminiApiKey).toBe('AIzaTest123')
      expect(parsed.anthropicApiKey).toBe('')
      expect(parsed.openaiApiKey).toBe('')
      // No auth sub-object on disk → default 'subscription'.
      expect(parsed.geminiAuthMode).toBe('subscription')
      expect(parsed.anthropicAuthMode).toBe('subscription')
      expect(parsed.openaiAuthMode).toBe('subscription')

      const out = serializeCredentialsPayload(parsed, raw)
      writeFileSync(file, JSON.stringify(out, null, 2))
      const after = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>
      expect(after.geminiApiKey).toBe('AIzaTest123')
      expect(after.auth).toEqual({
        gemini: { mode: 'subscription' },
        anthropic: { mode: 'subscription' },
        openai: { mode: 'subscription' },
        // §5.6.5 v0.5 — ollama-cloud joined SubscriptionProvider (user lock
        // 2026-05-14, "다른 LLM과 동일한 구조"). Default 'subscription'.
        'ollama-cloud': { mode: 'subscription' },
      })
    })
  })

  it('case 2 — v0.3 round-trip yields canonical byte-identical shape', () => {
    const v03: Record<string, unknown> = {
      geminiApiKey: 'AIza1',
      anthropicApiKey: 'sk-ant-2',
      openaiApiKey: 'sk-3',
      auth: {
        gemini: { mode: 'api' },
        anthropic: { mode: 'subscription' },
        openai: { mode: 'none' },
      },
    }
    withTmpFile(v03, (file) => {
      const raw1 = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>
      const parsed1 = parseCredentialsPayload(raw1)
      const out1 = serializeCredentialsPayload(parsed1, raw1)
      writeFileSync(file, JSON.stringify(out1, null, 2))

      const raw2 = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>
      const parsed2 = parseCredentialsPayload(raw2)
      const out2 = serializeCredentialsPayload(parsed2, raw2)

      // Byte-identical JSON serialization (deterministic order).
      expect(JSON.stringify(out2)).toBe(JSON.stringify(out1))
      expect(parsed2.geminiAuthMode).toBe('api')
      expect(parsed2.anthropicAuthMode).toBe('subscription')
      expect(parsed2.openaiAuthMode).toBe('none')
    })
  })

  it('case 3 — legacy auth.<provider>.mode === "auto" migrates to "subscription"', () => {
    const legacy: Record<string, unknown> = {
      geminiApiKey: '',
      auth: {
        gemini: { mode: 'auto' },
        anthropic: { mode: 'auto' },
        openai: { mode: 'auto' },
      },
    }
    withTmpFile(legacy, (file) => {
      const raw = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>
      const parsed = parseCredentialsPayload(raw)
      expect(parsed.geminiAuthMode).toBe('subscription')
      expect(parsed.anthropicAuthMode).toBe('subscription')
      expect(parsed.openaiAuthMode).toBe('subscription')

      const out = serializeCredentialsPayload(parsed, raw)
      const auth = out.auth as Record<string, { mode: string }>
      expect(auth.gemini.mode).toBe('subscription')
      expect(auth.anthropic.mode).toBe('subscription')
      expect(auth.openai.mode).toBe('subscription')
      // §5.6.5 v0.5 — ollama-cloud default also 'subscription'.
      expect(auth['ollama-cloud'].mode).toBe('subscription')
    })
  })

  it('case 4 — unknown user-added field (xaiApiKey) survives a load + save round-trip', () => {
    const withUnknown: Record<string, unknown> = {
      geminiApiKey: 'AIza1',
      xaiApiKey: 'xai-secret-99',
      customMetadata: { addedBy: 'user', version: 99 },
      auth: { gemini: { mode: 'api' } },
    }
    withTmpFile(withUnknown, (file) => {
      const raw = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>
      const parsed = parseCredentialsPayload(raw)
      const out = serializeCredentialsPayload(parsed, raw)
      writeFileSync(file, JSON.stringify(out, null, 2))

      const after = JSON.parse(readFileSync(file, 'utf-8')) as Record<string, unknown>
      expect(after.xaiApiKey).toBe('xai-secret-99')
      expect(after.customMetadata).toEqual({ addedBy: 'user', version: 99 })
      expect(after.geminiApiKey).toBe('AIza1')
      // §5.6.5 v0.5 — auth sub-object now carries 4 providers (added
      // ollama-cloud); user-added fields outside `auth` (xaiApiKey,
      // customMetadata) still survive verbatim.
      const auth = after.auth as Record<string, { mode: string }>
      expect(auth.gemini.mode).toBe('api')
      expect(auth.anthropic.mode).toBe('subscription')
      expect(auth.openai.mode).toBe('subscription')
      expect(auth['ollama-cloud'].mode).toBe('subscription')
    })
  })
})
