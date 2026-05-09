/**
 * §5.7.5 RED — upstream update detect 단위 테스트.
 *
 * AC-U1: 5 kind row (kiwi-nlp / orama / qwen3-embedding / qmd-vendored / kiwi-dict)
 *        의 UpdateItemDescriptor[] 반환 + currentVersion / upstreamVersion / hasUpdate 정상.
 * AC-U2: diffSource URL 가 kind 별 정확.
 */

import { describe, it, expect } from 'vitest'
import { detectUpstreamUpdates } from '../../update/upstream-checker.js'

/** kind 별 mock fetch — URL 패턴 매칭으로 fixture 응답 반환. */
function makeMockFetch(): (url: string) => Promise<string> {
  return async (url: string): Promise<string> => {
    // Orama npm registry latest version
    if (url.includes('registry.npmjs.org/@orama/orama')) {
      return JSON.stringify({ 'dist-tags': { latest: '4.0.0' } })
    }
    // Kiwi GitHub releases (atom feed or releases API)
    if (url.includes('api.github.com/repos/bab2min/Kiwi/releases/latest')) {
      return JSON.stringify({ tag_name: 'v0.24.0' })
    }
    // HuggingFace model card revision (Qwen3-Embedding)
    if (url.includes('huggingface.co/api/models/Qwen/Qwen3-Embedding-0.6B-GGUF')) {
      return JSON.stringify({ sha: 'abc1234567', lastModified: '2026-05-01T00:00:00Z' })
    }
    // qmd vendored upstream (compare API)
    if (url.includes('api.github.com/repos/') && url.includes('qmd')) {
      return JSON.stringify({ tag_name: 'v0.5.0' })
    }
    // kiwi-dict release (Kiwi 사전 ~104MB)
    if (url.includes('Kiwi/releases') && url.includes('models')) {
      return JSON.stringify({ tag_name: 'v0.24.0' })
    }
    return ''
  }
}

describe('§5.7.5 upstream-checker', () => {
  it('AC-U1: detectUpstreamUpdates returns 5 kinds with hasUpdate evaluated', async () => {
    const result = await detectUpstreamUpdates({
      basePath: '/tmp/wikey-fixture',
      allowNetwork: true,
      fetch: makeMockFetch(),
    })

    expect(result.items.length).toBe(5)
    const kinds = result.items.map((i) => i.kind)
    expect(kinds).toContain('kiwi-nlp')
    expect(kinds).toContain('orama')
    expect(kinds).toContain('qwen3-embedding')
    expect(kinds).toContain('qmd-vendored')
    expect(kinds).toContain('kiwi-dict')

    // hasUpdate 평가가 일관 — currentVersion / upstreamVersion 없으면 false
    for (const it of result.items) {
      expect(typeof it.hasUpdate).toBe('boolean')
      expect(typeof it.currentVersion).toBe('string')
    }
    expect(typeof result.checkedAt).toBe('string')
  })

  it('AC-U2: diffSource URL is correct per kind', async () => {
    const result = await detectUpstreamUpdates({
      basePath: '/tmp/wikey-fixture',
      allowNetwork: true,
      fetch: makeMockFetch(),
    })

    const byKind = new Map(result.items.map((i) => [i.kind, i] as const))

    // kiwi-nlp = bab2min/Kiwi compare URL or releases page
    expect(byKind.get('kiwi-nlp')?.diffSource).toMatch(/bab2min\/Kiwi/)
    // orama = npm changelog or @orama/orama repo
    expect(byKind.get('orama')?.diffSource).toMatch(/@orama\/orama|orama-search\/orama|npmjs\.com/)
    // qwen3-embedding = HF model card
    expect(byKind.get('qwen3-embedding')?.diffSource).toMatch(/huggingface\.co\/Qwen\/Qwen3-Embedding/)
    // qmd-vendored = qmd compare URL
    expect(byKind.get('qmd-vendored')?.diffSource).toMatch(/qmd/)
    // kiwi-dict = bab2min/Kiwi releases
    expect(byKind.get('kiwi-dict')?.diffSource).toMatch(/bab2min\/Kiwi/)
  })
})
