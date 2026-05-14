/**
 * §5.6.5 옵션 A v2 — Ollama statusbar chip render tests.
 *
 * User spec 2026-05-14:
 *   - 로딩된 모델 없음 → chip hidden
 *   - 로컬 호출 → `● <model>` (모델명만)
 *   - 클라우드 호출 → `● <model>|5h:NN%|7d:NN%`
 *   - chip 앞 ● = unicode geometric (NOT emoji), light-purple via CSS class.
 */

import 'obsidian' // side-effect: applies HTMLElement.prototype polyfill (createDiv/empty/createSpan)
import { describe, it, expect } from 'vitest'
import {
  formatOllamaChipText,
  renderOllamaChip,
} from '../status-bar-ollama-usage.js'

describe('§5.6.5 옵션 A v2 — formatOllamaChipText', () => {
  it('S1: empty state → empty string (chip hidden)', () => {
    expect(formatOllamaChipText({})).toBe('')
  })

  it("S2: provider='ollama' + model → '● <model>'", () => {
    expect(formatOllamaChipText({ provider: 'ollama', model: 'qwen3:8b' })).toBe('● qwen3:8b')
  })

  it('S3: provider=ollama-cloud without quota → model only', () => {
    expect(
      formatOllamaChipText({ provider: 'ollama-cloud', model: 'deepseek-v3.1:671b-cloud' }),
    ).toBe('● deepseek-v3.1:671b-cloud')
  })

  it('S4: provider=ollama-cloud + quota → model|5h|7d', () => {
    expect(
      formatOllamaChipText({
        provider: 'ollama-cloud',
        model: 'kimi-k2.6:cloud',
        sessionPct: 42,
        weeklyPct: 18,
      }),
    ).toBe('● kimi-k2.6:cloud|5h:42%|7d:18%')
  })
})

describe('§5.6.5 옵션 A v2 — renderOllamaChip', () => {
  it('R1: empty state → host display:none, no children', () => {
    const host = document.createElement('div')
    renderOllamaChip(host, {})
    expect(host.style.display).toBe('none')
    expect(host.children.length).toBe(0)
  })

  it('R2: local model → display:"", purple dot span + text span', () => {
    const host = document.createElement('div')
    renderOllamaChip(host, { provider: 'ollama', model: 'qwen3:8b' })
    expect(host.style.display).toBe('')
    const dot = host.querySelector('.wikey-statusbar-ollama-dot')
    expect(dot).not.toBeNull()
    expect(dot!.textContent).toBe('●')
    const text = host.querySelector('.wikey-statusbar-ollama-text')
    expect(text).not.toBeNull()
    expect(text!.textContent).toBe(' qwen3:8b')
  })

  it('R3: cloud model + quota → text includes 5h/7d percentages', () => {
    const host = document.createElement('div')
    renderOllamaChip(host, {
      provider: 'ollama-cloud',
      model: 'gpt-oss:120b-cloud',
      sessionPct: 60,
      weeklyPct: 25,
    })
    const text = host.querySelector('.wikey-statusbar-ollama-text')
    expect(text!.textContent).toBe(' gpt-oss:120b-cloud|5h:60%|7d:25%')
  })

  it('R4: re-render replaces previous content (no stale chips)', () => {
    const host = document.createElement('div')
    renderOllamaChip(host, { provider: 'ollama', model: 'old-model' })
    renderOllamaChip(host, { provider: 'ollama', model: 'new-model' })
    expect(host.querySelectorAll('.wikey-statusbar-ollama-text')).toHaveLength(1)
    expect(host.querySelector('.wikey-statusbar-ollama-text')!.textContent).toBe(' new-model')
  })
})
