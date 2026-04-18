import { describe, it, expect } from 'vitest'
import { extractJsonBlock, buildIngestPrompt, loadEffectiveIngestPrompt, INGEST_PROMPT_PATH, BUNDLED_INGEST_PROMPT } from '../ingest-pipeline.js'
import type { WikiFS } from '../types.js'

describe('extractJsonBlock', () => {
  it('extracts JSON from ```json code block', () => {
    const text = 'Some text\n```json\n{"key": "value"}\n```\nMore text'
    const result = extractJsonBlock(text)
    expect(result).toEqual({ key: 'value' })
  })

  it('extracts JSON from ``` code block without lang tag', () => {
    const text = 'Text\n```\n{"key": "value"}\n```'
    const result = extractJsonBlock(text)
    expect(result).toEqual({ key: 'value' })
  })

  it('extracts bare JSON object', () => {
    const text = '{"source_page": {"filename": "test.md", "content": "# Test"}}'
    const result = extractJsonBlock(text)
    expect(result).toHaveProperty('source_page')
  })

  it('handles multiline JSON in code block', () => {
    const text = '```json\n{\n  "source_page": {\n    "filename": "test.md",\n    "content": "# Test"\n  },\n  "entities": [],\n  "concepts": []\n}\n```'
    const result = extractJsonBlock(text)
    expect(result).toHaveProperty('source_page')
    expect(result.source_page.filename).toBe('test.md')
  })

  it('returns null for no JSON found', () => {
    const text = 'No JSON here, just text.'
    const result = extractJsonBlock(text)
    expect(result).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    const text = '```json\n{broken json\n```'
    const result = extractJsonBlock(text)
    expect(result).toBeNull()
  })
})

describe('buildIngestPrompt', () => {
  it('includes source content and filename', () => {
    const prompt = buildIngestPrompt('# Source content', 'my-source.md', '- [[esc]] — ESC')
    expect(prompt).toContain('my-source.md')
    expect(prompt).toContain('# Source content')
  })

  it('includes current index', () => {
    const prompt = buildIngestPrompt('content', 'file.md', '- [[esc]] — ESC\n- [[fc]] — FC')
    expect(prompt).toContain('[[esc]]')
    expect(prompt).toContain('[[fc]]')
  })

  it('includes today date placeholder', () => {
    const prompt = buildIngestPrompt('content', 'file.md', '')
    // The prompt template has {{TODAY}} which gets replaced with actual date
    expect(prompt).toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('requests JSON output format', () => {
    const prompt = buildIngestPrompt('content', 'file.md', '')
    expect(prompt).toContain('source_page')
    expect(prompt).toContain('entities')
    expect(prompt).toContain('concepts')
  })

  it('uses bundled template when no override is provided', () => {
    const prompt = buildIngestPrompt('content', 'file.md', '')
    expect(prompt).toContain('당신은 wikey LLM Wiki의 인제스트 에이전트입니다')
  })

  it('uses templateOverride when provided', () => {
    const override = 'CUSTOM PROMPT — process {{SOURCE_FILENAME}} content: {{SOURCE_CONTENT}}'
    const prompt = buildIngestPrompt('hello', 'foo.md', '', override)
    expect(prompt).toBe('CUSTOM PROMPT — process foo.md content: hello')
  })
})

describe('loadEffectiveIngestPrompt', () => {
  function makeFS(files: Record<string, string>): WikiFS {
    return {
      read: async (path: string) => {
        if (!(path in files)) throw new Error(`ENOENT: ${path}`)
        return files[path]
      },
      write: async () => {},
      exists: async (path: string) => path in files,
      list: async () => [],
    }
  }

  it('returns bundled default when override file is absent', async () => {
    const result = await loadEffectiveIngestPrompt(makeFS({}))
    expect(result).toBe(BUNDLED_INGEST_PROMPT)
  })

  it('returns override file content when present', async () => {
    const content = '나만의 시스템 프롬프트 — {{SOURCE_CONTENT}}'
    const fs = makeFS({ [INGEST_PROMPT_PATH]: content })
    const result = await loadEffectiveIngestPrompt(fs)
    expect(result).toBe(content)
  })

  it('falls back to bundled default if override read throws', async () => {
    const fs: WikiFS = {
      read: async () => { throw new Error('disk error') },
      write: async () => {},
      exists: async () => true,
      list: async () => [],
    }
    const result = await loadEffectiveIngestPrompt(fs)
    expect(result).toBe(BUNDLED_INGEST_PROMPT)
  })
})
