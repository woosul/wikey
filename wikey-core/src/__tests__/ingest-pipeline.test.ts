import { describe, it, expect } from 'vitest'
import { extractJsonBlock, buildIngestPrompt, loadUserPrompt, USER_PROMPT_PATH } from '../ingest-pipeline.js'
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

  it('omits user prompt block when userPrompt is empty', () => {
    const prompt = buildIngestPrompt('content', 'file.md', '', '')
    expect(prompt).not.toContain('사용자 추가 지침')
  })

  it('includes user prompt block when userPrompt is provided', () => {
    const userPrompt = 'entity slug는 영문 소문자만 사용'
    const prompt = buildIngestPrompt('content', 'file.md', '', userPrompt)
    expect(prompt).toContain('## 사용자 추가 지침')
    expect(prompt).toContain(userPrompt)
  })
})

describe('loadUserPrompt', () => {
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

  it('returns empty string when user prompt file is absent', async () => {
    const result = await loadUserPrompt(makeFS({}))
    expect(result).toBe('')
  })

  it('returns user prompt content when file exists', async () => {
    const content = '수치 단위는 반드시 포함하세요'
    const fs = makeFS({ [USER_PROMPT_PATH]: content })
    const result = await loadUserPrompt(fs)
    expect(result).toBe(content)
  })

  it('strips HTML comments from user prompt', async () => {
    const content = '<!-- template comment -->\n실제 지침 내용'
    const fs = makeFS({ [USER_PROMPT_PATH]: content })
    const result = await loadUserPrompt(fs)
    expect(result).toBe('실제 지침 내용')
    expect(result).not.toContain('template comment')
  })
})
