import { describe, it, expect, vi } from 'vitest'
import { extractJsonBlock, buildIngestPrompt, loadEffectiveIngestPrompt, INGEST_PROMPT_PATH, BUNDLED_INGEST_PROMPT, formatLocalDate, assertNotWikiPath, callLLMWithRetry } from '../ingest-pipeline.js'
import type { WikiFS } from '../types.js'
import type { LLMClient } from '../llm-client.js'

describe('formatLocalDate', () => {
  it('returns YYYY-MM-DD in local timezone (not UTC)', () => {
    // Simulate Seoul midnight (2026-04-19 00:30 KST = 2026-04-18 15:30 UTC)
    // Without fix: toISOString returns 2026-04-18
    // With fix: getFullYear/getMonth/getDate returns 2026-04-19
    const d = new Date('2026-04-18T15:30:00.000Z')
    // When running in +09:00 (Asia/Seoul), local date should be 2026-04-19.
    // When running in UTC, local date should be 2026-04-18.
    // We assert format shape and that output equals date computed from local getters.
    const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    expect(formatLocalDate(d)).toBe(expected)
  })

  it('pads single-digit month and day', () => {
    const d = new Date(2026, 0, 5, 12, 0, 0) // local: 2026-01-05
    expect(formatLocalDate(d)).toBe('2026-01-05')
  })

  it('format is always 10 chars YYYY-MM-DD', () => {
    const d = new Date()
    const out = formatLocalDate(d)
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

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

describe('callLLMWithRetry — §4.5.1.6.1 determinism flag', () => {
  function makeMockLLM(): { llm: LLMClient; capturedOpts: any[] } {
    const capturedOpts: any[] = []
    const llm = {
      call: vi.fn().mockImplementation(async (_prompt: string, opts: any) => {
        capturedOpts.push(opts)
        return '```json\n{"source_page":{"filename":"s.md","content":"x"}}\n```'
      }),
    } as unknown as LLMClient
    return { llm, capturedOpts }
  }

  it('omits temperature/seed when deterministic is false', async () => {
    const { llm, capturedOpts } = makeMockLLM()
    await callLLMWithRetry(llm, 'p', 'gemini', 'gemini-2.5-flash', false)
    expect(capturedOpts).toHaveLength(1)
    expect(capturedOpts[0].temperature).toBeUndefined()
    expect(capturedOpts[0].seed).toBeUndefined()
  })

  it('injects temperature=0 and seed=42 into Gemini opts when deterministic=true', async () => {
    const { llm, capturedOpts } = makeMockLLM()
    await callLLMWithRetry(llm, 'p', 'gemini', 'gemini-2.5-flash', true)
    expect(capturedOpts[0].temperature).toBe(0)
    expect(capturedOpts[0].seed).toBe(42)
    expect(capturedOpts[0].responseMimeType).toBe('application/json')
    expect(capturedOpts[0].jsonMode).toBe(true)
  })

  it('injects temperature=0 and seed=42 into non-Gemini opts too', async () => {
    const { llm, capturedOpts } = makeMockLLM()
    await callLLMWithRetry(llm, 'p', 'ollama', 'qwen3:8b', true)
    expect(capturedOpts[0].temperature).toBe(0)
    expect(capturedOpts[0].seed).toBe(42)
    expect(capturedOpts[0].jsonMode).toBe(true)
  })

  it('omits determinism opts when flag is undefined', async () => {
    const { llm, capturedOpts } = makeMockLLM()
    await callLLMWithRetry(llm, 'p', 'gemini', 'gemini-2.5-flash')
    expect(capturedOpts[0].temperature).toBeUndefined()
    expect(capturedOpts[0].seed).toBeUndefined()
  })
})

describe('assertNotWikiPath', () => {
  it('rejects bare wiki/* path', () => {
    expect(() => assertNotWikiPath('wiki/sources/foo.md', 'ingest')).toThrow(/cannot ingest from wiki/)
  })

  it('rejects wiki at root (no trailing slash)', () => {
    expect(() => assertNotWikiPath('wiki', 'ingest')).toThrow(/cannot ingest from wiki/)
  })

  it('rejects ./wiki/* relative path', () => {
    expect(() => assertNotWikiPath('./wiki/entities/foo.md', 'generateBrief')).toThrow(/generateBrief: cannot ingest from wiki/)
  })

  it('rejects /wiki/* absolute-style path', () => {
    expect(() => assertNotWikiPath('/wiki/concepts/foo.md', 'ingest')).toThrow(/cannot ingest from wiki/)
  })

  it('allows raw/* paths', () => {
    expect(() => assertNotWikiPath('raw/0_inbox/foo.pdf', 'ingest')).not.toThrow()
  })

  it('allows paths that merely contain wiki as a substring', () => {
    expect(() => assertNotWikiPath('raw/3_resources/wikipedia-export.md', 'ingest')).not.toThrow()
    expect(() => assertNotWikiPath('raw/wiki-archive/foo.md', 'ingest')).not.toThrow()
  })

  it('embeds the offending path and caller in the error', () => {
    try {
      assertNotWikiPath('wiki/foo.md', 'myCaller')
      throw new Error('should have thrown')
    } catch (err: unknown) {
      const msg = (err as Error).message
      expect(msg).toContain('myCaller')
      expect(msg).toContain('wiki/foo.md')
    }
  })
})
