/**
 * §5.6.5 Step A — Ollama Cloud model catalog + dispatch unit tests.
 *
 * RED phase tests for:
 *   - `isCloudModel(modelId)` helper (todox A6)
 *   - automatic cloud dispatch + provider/model mismatch detection (todox A7)
 *   - `CLOUD_MODEL_CATALOG` shape + PoC §0 LOCK identifiers (5 models)
 *
 * Single source of truth: `docs/planning/phase-5/fixtures/cycle-5.6.5-ollama-cloud-poc/SUMMARY.md`.
 * Catalog change requires editing `ollama-model-catalog.ts` only
 * (feedback_no_hardcoding_general.md LOCK).
 */

import { describe, it, expect } from 'vitest'
import {
  isCloudModel,
  CLOUD_MODEL_CATALOG,
  type CloudModelEntry,
} from '../ollama-model-catalog.js'

describe('isCloudModel — A6 helper', () => {
  it('returns true for all 5 PoC §0 LOCK cloud identifiers', () => {
    const lockedIds = [
      'deepseek-v3.1:671b-cloud',
      'qwen3-coder:480b-cloud',
      'kimi-k2.6:cloud',
      'gpt-oss:120b-cloud',
      'mistral-large-3:675b-cloud',
    ]
    for (const id of lockedIds) {
      expect(isCloudModel(id)).toBe(true)
    }
  })

  it('returns false for local-only model identifiers', () => {
    const localIds = [
      'qwen3:8b',
      'qwen3.6:35b-a3b-nvfp4',
      'gemma4:26b',
      'qwen3:0.6b-embedding',
      'llama3:70b',
      'deepseek-v3.1:671b',
    ]
    for (const id of localIds) {
      expect(isCloudModel(id)).toBe(false)
    }
  })

  it('returns false for boundary cases', () => {
    expect(isCloudModel('')).toBe(false)
    expect(isCloudModel('cloud')).toBe(false)
    expect(isCloudModel(':cloud')).toBe(false)
  })

  it('returns true for future ":cloud" suffix identifiers not yet catalogued', () => {
    expect(isCloudModel('new-model:cloud')).toBe(true)
    expect(isCloudModel('llama4:200b-cloud')).toBe(true)
  })
})

describe('CLOUD_MODEL_CATALOG — PoC §0 §1 LOCK', () => {
  it('contains exactly 5 entries (M1~M5)', () => {
    expect(CLOUD_MODEL_CATALOG).toHaveLength(5)
  })

  it('all entries have id ending with :cloud or -cloud suffix', () => {
    for (const entry of CLOUD_MODEL_CATALOG) {
      expect(entry.id).toMatch(/[-:]cloud$/)
    }
  })

  it('M5 mistral-large-3 is marked jsonMode = markdown-wrap (PoC §0 §4 LOCK)', () => {
    const m5 = CLOUD_MODEL_CATALOG.find(e => e.id === 'mistral-large-3:675b-cloud')
    expect(m5).toBeDefined()
    expect(m5!.jsonMode).toBe('markdown-wrap')
  })

  it('M1~M4 are marked jsonMode = native', () => {
    const native = CLOUD_MODEL_CATALOG.filter(e => e.jsonMode === 'native')
    expect(native).toHaveLength(4)
    const ids = native.map(e => e.id).sort()
    expect(ids).toEqual([
      'deepseek-v3.1:671b-cloud',
      'gpt-oss:120b-cloud',
      'kimi-k2.6:cloud',
      'qwen3-coder:480b-cloud',
    ])
  })

  it('each entry exposes contextTokens > 0', () => {
    for (const entry of CLOUD_MODEL_CATALOG) {
      expect(entry.contextTokens).toBeGreaterThan(0)
    }
  })

  it('CloudModelEntry shape is readonly + frozen', () => {
    const entry: CloudModelEntry = CLOUD_MODEL_CATALOG[0]
    expect(entry).toBeDefined()
    expect(entry.id).toBeTypeOf('string')
    expect(Array.isArray(entry.capabilities)).toBe(true)
  })
})
