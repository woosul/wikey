import { describe, it, expect } from 'vitest'
import { LLMClient } from '../llm-client.js'
import type { HttpClient, HttpRequestOptions, HttpResponse, WikeyConfig } from '../types.js'

function mockHttpClient(
  responseBody: string,
  status = 200,
): { client: HttpClient; calls: Array<{ url: string; opts: HttpRequestOptions }> } {
  const calls: Array<{ url: string; opts: HttpRequestOptions }> = []
  return {
    client: {
      async request(url: string, opts: HttpRequestOptions): Promise<HttpResponse> {
        calls.push({ url, opts })
        return { status, body: responseBody }
      },
    },
    calls,
  }
}

const baseConfig: WikeyConfig = {
  WIKEY_BASIC_MODEL: 'gemini',
  WIKEY_SEARCH_BACKEND: 'basic',
  WIKEY_MODEL: 'wikey',
  WIKEY_QMD_TOP_N: 5,
  GEMINI_API_KEY: 'test-gemini-key',
  ANTHROPIC_API_KEY: 'test-anthropic-key',
  OPENAI_API_KEY: 'test-openai-key',
  OLLAMA_URL: 'http://localhost:11434',
  INGEST_PROVIDER: '',
  LINT_PROVIDER: '',
  SUMMARIZE_PROVIDER: '',
  CONTEXTUAL_MODEL: 'gemma4',
  COST_LIMIT: 50,
}

describe('LLMClient — Gemini', () => {
  const geminiResponse = JSON.stringify({
    candidates: [{ content: { parts: [{ text: 'Gemini says hello' }] } }],
  })

  it('sends correct payload to Gemini', async () => {
    const { client, calls } = mockHttpClient(geminiResponse)
    const llm = new LLMClient(client, baseConfig)
    await llm.call('test prompt', { provider: 'gemini' })

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('generativelanguage.googleapis.com')
    expect(calls[0].url).toContain('key=test-gemini-key')
    const body = JSON.parse(calls[0].opts.body!)
    expect(body.contents[0].parts[0].text).toBe('test prompt')
  })

  it('parses Gemini response correctly', async () => {
    const { client } = mockHttpClient(geminiResponse)
    const llm = new LLMClient(client, baseConfig)
    const result = await llm.call('test', { provider: 'gemini' })
    expect(result).toBe('Gemini says hello')
  })

  it('throws on missing Gemini API key', async () => {
    const { client } = mockHttpClient(geminiResponse)
    const config = { ...baseConfig, GEMINI_API_KEY: '' }
    const llm = new LLMClient(client, config)
    await expect(llm.call('test', { provider: 'gemini' })).rejects.toThrow(/API/)
  })
})

describe('LLMClient — Anthropic', () => {
  const anthropicResponse = JSON.stringify({
    content: [{ type: 'text', text: 'Anthropic says hello' }],
  })

  it('sends correct payload to Anthropic', async () => {
    const { client, calls } = mockHttpClient(anthropicResponse)
    const llm = new LLMClient(client, baseConfig)
    await llm.call('test prompt', { provider: 'anthropic' })

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('api.anthropic.com')
    expect(calls[0].opts.headers!['x-api-key']).toBe('test-anthropic-key')
    const body = JSON.parse(calls[0].opts.body!)
    expect(body.messages[0].content).toBe('test prompt')
  })

  it('parses Anthropic response correctly', async () => {
    const { client } = mockHttpClient(anthropicResponse)
    const llm = new LLMClient(client, baseConfig)
    const result = await llm.call('test', { provider: 'anthropic' })
    expect(result).toBe('Anthropic says hello')
  })

  it('throws on missing Anthropic API key', async () => {
    const { client } = mockHttpClient(anthropicResponse)
    const config = { ...baseConfig, ANTHROPIC_API_KEY: '' }
    const llm = new LLMClient(client, config)
    await expect(llm.call('test', { provider: 'anthropic' })).rejects.toThrow(/API/)
  })
})

describe('LLMClient — OpenAI', () => {
  const openaiResponse = JSON.stringify({
    choices: [{ message: { content: 'OpenAI says hello' } }],
  })

  it('sends correct payload to OpenAI', async () => {
    const { client, calls } = mockHttpClient(openaiResponse)
    const llm = new LLMClient(client, baseConfig)
    await llm.call('test prompt', { provider: 'openai' })

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('api.openai.com')
    expect(calls[0].opts.headers!['Authorization']).toBe('Bearer test-openai-key')
  })

  it('parses OpenAI response correctly', async () => {
    const { client } = mockHttpClient(openaiResponse)
    const llm = new LLMClient(client, baseConfig)
    const result = await llm.call('test', { provider: 'openai' })
    expect(result).toBe('OpenAI says hello')
  })

  it('throws on missing OpenAI API key', async () => {
    const { client } = mockHttpClient(openaiResponse)
    const config = { ...baseConfig, OPENAI_API_KEY: '' }
    const llm = new LLMClient(client, config)
    await expect(llm.call('test', { provider: 'openai' })).rejects.toThrow(/API/)
  })
})

describe('LLMClient — Ollama', () => {
  const ollamaResponse = JSON.stringify({
    message: { content: 'Ollama says hello' },
  })

  it('sends correct payload to Ollama', async () => {
    const { client, calls } = mockHttpClient(ollamaResponse)
    const llm = new LLMClient(client, baseConfig)
    await llm.call('test prompt', { provider: 'ollama' })

    expect(calls).toHaveLength(1)
    expect(calls[0].url).toBe('http://localhost:11434/api/chat')
    const body = JSON.parse(calls[0].opts.body!)
    expect(body.model).toBe('wikey')
    expect(body.stream).toBe(false)
  })

  it('parses Ollama response correctly', async () => {
    const { client } = mockHttpClient(ollamaResponse)
    const llm = new LLMClient(client, baseConfig)
    const result = await llm.call('test', { provider: 'ollama' })
    expect(result).toBe('Ollama says hello')
  })

  it('strips Gemma 4 thinking blocks', async () => {
    const responseWithThinking = JSON.stringify({
      message: { content: 'Some reasoning... done thinking.\n\nActual answer' },
    })
    const { client } = mockHttpClient(responseWithThinking)
    const llm = new LLMClient(client, baseConfig)
    const result = await llm.call('test', { provider: 'ollama' })
    expect(result).toBe('Actual answer')
  })

  it('does not require API key for Ollama', async () => {
    const { client } = mockHttpClient(ollamaResponse)
    const config = {
      ...baseConfig,
      GEMINI_API_KEY: '',
      ANTHROPIC_API_KEY: '',
      OPENAI_API_KEY: '',
    }
    const llm = new LLMClient(client, config)
    const result = await llm.call('test', { provider: 'ollama' })
    expect(result).toBe('Ollama says hello')
  })
})

describe('Gemini model list filter', () => {
  // Mirrors the regex in fetchModelList; we verify drop semantics directly.
  const keep = (n: string): boolean => !(
    /-(?:tts|customtools|image|video|embedding|robotics)(?:-|$)/.test(n)
    || /-native-audio-/.test(n)
    || /-computer-use-/.test(n)
  )

  it('keeps text-only Pro/Flash models', () => {
    for (const m of ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-3-pro-preview', 'gemini-3.1-pro-preview', 'gemini-3.1-flash-lite-preview']) {
      expect(keep(m), m).toBe(true)
    }
  })

  it('drops audio/image/video/tts/customtools/embedding/computer-use/robotics variants', () => {
    expect(keep('gemini-2.5-flash-image')).toBe(false)             // -image suffix
    expect(keep('gemini-3-pro-image-preview')).toBe(false)         // -image- middle
    expect(keep('gemini-3.1-flash-tts-preview')).toBe(false)       // -tts- middle
    expect(keep('gemini-3.1-pro-preview-customtools')).toBe(false) // -customtools suffix
    expect(keep('gemini-2.5-flash-native-audio-latest')).toBe(false) // -native-audio-
    expect(keep('gemini-2.5-computer-use-preview-10-2025')).toBe(false) // -computer-use-
    expect(keep('gemini-robotics-er-1.5-preview')).toBe(false)     // -robotics-
    expect(keep('embedding-001')).toBe(true)  // not gemini- prefix; outer .startsWith filter would catch
    expect(keep('gemini-embedding-001')).toBe(false)               // -embedding-
  })
})

describe('sortGeminiModelsRecommended', () => {
  it('puts gemini-2.5-flash first', async () => {
    const { sortGeminiModelsRecommended } = await import('../llm-client.js')
    const input = ['gemini-3-pro-preview', 'gemini-pro-latest', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-lite']
    const sorted = [...input].sort(sortGeminiModelsRecommended)
    expect(sorted[0]).toBe('gemini-2.5-flash')
  })

  it('groups by family: 2.5-flash → 2.5-pro → 3.x flash → 3.x pro → other', async () => {
    const { sortGeminiModelsRecommended } = await import('../llm-client.js')
    const input = [
      'gemini-pro-latest',
      'gemini-3.1-pro-preview',
      'gemini-2.5-pro',
      'gemini-3.1-flash-lite-preview',
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-3-pro-preview',
    ]
    const sorted = [...input].sort(sortGeminiModelsRecommended)
    // 2.5-flash first
    expect(sorted[0]).toBe('gemini-2.5-flash')
    // 2.5-flash-lite is also flash family (bucket 1) → before 2.5-pro
    expect(sorted.indexOf('gemini-2.5-flash-lite')).toBeLessThan(sorted.indexOf('gemini-2.5-pro'))
    // 2.5-pro before 3.x
    expect(sorted.indexOf('gemini-2.5-pro')).toBeLessThan(sorted.indexOf('gemini-3.1-pro-preview'))
    // 3.x flash before 3.x pro
    expect(sorted.indexOf('gemini-3.1-flash-lite-preview')).toBeLessThan(sorted.indexOf('gemini-3-pro-preview'))
    // legacy alias last
    expect(sorted[sorted.length - 1]).toBe('gemini-pro-latest')
  })

  it('sorts within bucket alphabetically', async () => {
    const { sortGeminiModelsRecommended } = await import('../llm-client.js')
    const input = ['gemini-3.1-pro-preview', 'gemini-3-pro-preview']
    const sorted = [...input].sort(sortGeminiModelsRecommended)
    expect(sorted).toEqual(['gemini-3-pro-preview', 'gemini-3.1-pro-preview'])
  })
})
