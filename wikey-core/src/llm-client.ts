import type { HttpClient, LLMCallOptions, LLMProvider, WikeyConfig } from './types.js'
import { PROVIDER_CHAT_DEFAULTS } from './provider-defaults.js'

const DEFAULT_TIMEOUT = 300_000
const DEFAULT_MAX_TOKENS = 65_536
const DEFAULT_TEMPERATURE = 0.1

export class LLMClient {
  constructor(
    private readonly httpClient: HttpClient,
    private readonly config: WikeyConfig,
  ) {}

  async call(prompt: string, opts?: LLMCallOptions): Promise<string> {
    const provider = opts?.provider ?? 'gemini'

    switch (provider) {
      case 'gemini':
        return this.callGemini(prompt, opts)
      case 'anthropic':
        return this.callAnthropic(prompt, opts)
      case 'openai':
        return this.callOpenAI(prompt, opts)
      case 'ollama':
        return this.callOllama(prompt, opts)
      default:
        throw new Error(`Unknown provider: ${provider}`)
    }
  }

  private async callGemini(prompt: string, opts?: LLMCallOptions): Promise<string> {
    const apiKey = this.config.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY not set — configure API key in settings')

    const model = opts?.model ?? PROVIDER_CHAT_DEFAULTS.gemini
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const generationConfig: Record<string, unknown> = {
      temperature: opts?.temperature ?? DEFAULT_TEMPERATURE,
      maxOutputTokens: opts?.maxTokens ?? DEFAULT_MAX_TOKENS,
    }
    if (opts?.seed !== undefined) generationConfig.seed = opts.seed
    if (opts?.responseMimeType) generationConfig.responseMimeType = opts.responseMimeType

    const payload: Record<string, unknown> = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
    }

    const response = await this.httpClient.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: opts?.timeout ?? DEFAULT_TIMEOUT,
    })

    const data = JSON.parse(response.body)

    if (!data.candidates?.[0]?.content?.parts?.[0]?.text) {
      const reason = data.candidates?.[0]?.finishReason ?? 'unknown'
      const error = data.error?.message ?? JSON.stringify(data).slice(0, 300)
      throw new Error(`Gemini returned no content (finishReason: ${reason}): ${error}`)
    }

    return data.candidates[0].content.parts[0].text as string
  }

  private async callAnthropic(prompt: string, opts?: LLMCallOptions): Promise<string> {
    const apiKey = this.config.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set — configure API key in settings')

    const model = opts?.model ?? PROVIDER_CHAT_DEFAULTS.anthropic
    const url = 'https://api.anthropic.com/v1/messages'

    const payload = {
      model,
      max_tokens: opts?.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }

    const response = await this.httpClient.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
      timeout: opts?.timeout ?? DEFAULT_TIMEOUT,
    })

    const data = JSON.parse(response.body)
    if (data.error) throw new Error(`Anthropic API error: ${data.error.message}`)
    return data.content[0].text as string
  }

  private async callOpenAI(prompt: string, opts?: LLMCallOptions): Promise<string> {
    const apiKey = this.config.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY not set — configure API key in settings')

    const model = opts?.model ?? PROVIDER_CHAT_DEFAULTS.openai
    const url = 'https://api.openai.com/v1/chat/completions'

    const payload = {
      model,
      max_tokens: opts?.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    }

    const response = await this.httpClient.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      timeout: opts?.timeout ?? DEFAULT_TIMEOUT,
    })

    const data = JSON.parse(response.body)
    if (data.error) throw new Error(`OpenAI API error: ${data.error.message}`)
    return data.choices[0].message.content as string
  }

  private async callOllama(prompt: string, opts?: LLMCallOptions): Promise<string> {
    const model = opts?.model ?? this.config.WIKEY_MODEL ?? PROVIDER_CHAT_DEFAULTS.ollama
    const baseUrl = this.config.OLLAMA_URL || 'http://localhost:11434'
    const url = `${baseUrl}/api/chat`

    const isGemma = model.toLowerCase().includes('gemma')

    const payload: Record<string, unknown> = {
      model,
      messages: [{ role: 'user', content: prompt }],
      stream: false,
      options: {
        num_predict: opts?.maxTokens ?? DEFAULT_MAX_TOKENS,
        temperature: opts?.temperature ?? DEFAULT_TEMPERATURE,
      },
    }

    // JSON mode: use format param for non-Gemma models.
    // Gemma4 + think:false breaks format (Ollama #15260), so skip format for Gemma
    // and rely on prompt-based JSON instruction + post-processing instead.
    if (opts?.jsonMode && !isGemma) {
      payload.format = 'json'
    }

    // Thinking control:
    // Gemma4 models: must send think=true, otherwise Ollama strips thinking
    // tokens and returns empty content (especially for custom GGUF imports).
    // Non-Gemma (Qwen3 etc): disable thinking to save tokens.
    if (isGemma) {
      payload.think = true
    } else {
      payload.think = false
    }

    const response = await this.httpClient.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: opts?.timeout ?? DEFAULT_TIMEOUT,
    })

    let data: { message?: { content?: string }; error?: string }
    try {
      data = JSON.parse(response.body)
    } catch {
      throw new Error(`Ollama returned non-JSON response (model='${model}', status check failed). Body preview: ${response.body.slice(0, 200)}`)
    }

    if (data.error) {
      // Surface Ollama's own error message (e.g., "model 'X' not found, try pulling it first")
      if (/not found|does not exist/i.test(data.error)) {
        throw new Error(`Ollama model '${model}' not found. Run: ollama pull ${model}`)
      }
      throw new Error(`Ollama error: ${data.error}`)
    }

    let text: string = data.message?.content ?? ''

    text = stripThinkingBlock(text)

    return text.trim()
  }
}

export async function fetchModelList(
  provider: LLMProvider,
  config: WikeyConfig,
  httpClient: HttpClient,
): Promise<string[]> {
  try {
    switch (provider) {
      case 'gemini': {
        const key = config.GEMINI_API_KEY
        if (!key) return []
        const resp = await httpClient.request(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
          { method: 'GET', headers: {}, timeout: 10000 },
        )
        const data = JSON.parse(resp.body)
        return (data.models ?? [])
          .map((m: { name: string }) => m.name.replace('models/', ''))
          .filter((n: string) => n.startsWith('gemini'))
          // Drop Google-deprecated aliases that 404 on generateContent (e.g. "gemini-2.0-flash"
          // returns "no longer available to new users"). Keep explicit versioned IDs like
          // "gemini-2.0-flash-001" which remain callable.
          .filter((n: string) => n !== 'gemini-2.0-flash' && n !== 'gemini-2.0-flash-lite')
          .sort()
      }
      case 'anthropic': {
        const key = config.ANTHROPIC_API_KEY
        if (!key) return []
        const resp = await httpClient.request(
          'https://api.anthropic.com/v1/models',
          { method: 'GET', headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, timeout: 10000 },
        )
        const data = JSON.parse(resp.body)
        return (data.data ?? [])
          .map((m: { id: string }) => m.id)
          .filter((n: string) => n.startsWith('claude'))
          .sort()
      }
      case 'openai': {
        const key = config.OPENAI_API_KEY
        if (!key) return []
        const resp = await httpClient.request(
          'https://api.openai.com/v1/models',
          { method: 'GET', headers: { Authorization: `Bearer ${key}` }, timeout: 10000 },
        )
        const data = JSON.parse(resp.body)
        return (data.data ?? [])
          .map((m: { id: string }) => m.id)
          .filter((n: string) => /^(gpt-|o[0-9])/.test(n))
          .sort()
      }
      case 'ollama': {
        const baseUrl = config.OLLAMA_URL || 'http://localhost:11434'
        const resp = await httpClient.request(
          `${baseUrl}/api/tags`,
          { method: 'GET', headers: {}, timeout: 5000 },
        )
        const data = JSON.parse(resp.body)
        return (data.models ?? []).map((m: { name: string }) => m.name).sort()
      }
      default:
        return []
    }
  } catch {
    return []
  }
}

function stripThinkingBlock(text: string): string {
  const marker = 'done thinking'
  const idx = text.toLowerCase().indexOf(marker)
  if (idx === -1) return text
  return text.slice(idx + marker.length).replace(/^[.\n ]+/, '')
}
