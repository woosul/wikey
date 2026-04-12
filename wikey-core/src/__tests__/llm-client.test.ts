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
