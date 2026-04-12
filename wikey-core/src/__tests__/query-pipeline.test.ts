import { describe, it, expect } from 'vitest'
import { parseQmdOutput, buildSynthesisPrompt } from '../query-pipeline.js'

describe('parseQmdOutput', () => {
  it('parses JSON array of search results and adds wiki/ prefix', () => {
    const json = JSON.stringify([
      { file: 'qmd://wikey-wiki/sources/source-esc.md', score: 0.95, snippet: 'ESC is...' },
      { file: 'qmd://wikey-wiki/concepts/pid-loop.md', score: 0.85, snippet: 'PID loop...' },
    ])
    const results = parseQmdOutput(json)
    expect(results).toHaveLength(2)
    expect(results[0].path).toBe('wiki/sources/source-esc.md')
    expect(results[0].score).toBe(0.95)
    expect(results[1].path).toBe('wiki/concepts/pid-loop.md')
  })

  it('does not double wiki/ prefix', () => {
    const json = JSON.stringify([
      { file: 'qmd://wikey-wiki/wiki/entities/esc.md', score: 0.9, snippet: '' },
    ])
    const results = parseQmdOutput(json)
    expect(results[0].path).toBe('wiki/entities/esc.md')
  })

  it('returns empty array for empty JSON', () => {
    expect(parseQmdOutput('[]')).toEqual([])
  })

  it('returns empty array for empty string', () => {
    expect(parseQmdOutput('')).toEqual([])
  })

  it('handles malformed JSON gracefully', () => {
    expect(parseQmdOutput('not json')).toEqual([])
  })
})

describe('buildSynthesisPrompt', () => {
  it('includes context pages and question', () => {
    const context = '--- esc.md ---\n# ESC\nElectronic Speed Controller\n\n'
    const question = 'ESC란?'
    const prompt = buildSynthesisPrompt(context, question)

    expect(prompt).toContain('wikey 위키')
    expect(prompt).toContain('esc.md')
    expect(prompt).toContain('ESC란?')
    expect(prompt).toContain('[[페이지명]]')
  })

  it('includes the question at the end', () => {
    const prompt = buildSynthesisPrompt('context', 'test question')
    const questionIdx = prompt.indexOf('test question')
    expect(questionIdx).toBeGreaterThan(0)
  })
})
