import type {
  AuthFallbackInfo,
  HttpClient,
  LLMCallOptions,
  LLMProvider,
  SubscriptionProvider,
  WikeyConfig,
} from './types.js'
import { PROVIDER_CHAT_DEFAULTS } from './provider-defaults.js'
import {
  detectFallbackTrigger,
  resolveAuthMode,
  type CredentialPresence,
} from './auth-resolver.js'
import {
  spawnCliPrompt as defaultSpawnCliPrompt,
  CLI_DEFAULT_BINARY,
  type SpawnCliOptions,
  type SpawnCliResult,
} from './cli-spawn.js'
import { mapOptionsToCliArgs } from './provider-cli-options.js'
import { parseSubscriptionOutput } from './cli-parser.js'

const DEFAULT_TIMEOUT = 300_000
const DEFAULT_MAX_TOKENS = 65_536
const DEFAULT_TEMPERATURE = 0.1

/**
 * §5.6.4.2 Step B — pluggable side-effect surface for subscription routing.
 * Production wires `spawnCliPrompt` (real child_process) + `existsSync` (real fs).
 * Tests inject deterministic mocks (no spawn / no fs hits).
 *
 * Why injection over `vi.mock`: keeps `wikey-core` free of test-only hooks at
 * import time, lets multiple tests share a single LLMClient instance with
 * different presence triplets, and surfaces the contract explicitly.
 */
export interface SubscriptionDeps {
  readonly spawnCliPrompt?: (
    provider: SubscriptionProvider,
    prompt: string,
    opts?: SpawnCliOptions,
  ) => Promise<SpawnCliResult>
  /** Check whether `path` exists. Default = `node:fs.existsSync`. */
  readonly fileExists?: (path: string) => boolean
  /** Override `~` resolution (default = `node:os.homedir()`). Tests inject a fixture path. */
  readonly homeDir?: () => string
}

/**
 * §5.6.4 §3.9 — auth-missing reason for force-subscription failures. Reused by
 * UI Notice mapping in main.ts (`messages` table).
 */
type FallbackReason = AuthFallbackInfo['reason']

export class LLMClient {
  private readonly subscriptionDeps: Required<SubscriptionDeps>

  constructor(
    private readonly httpClient: HttpClient,
    private readonly config: WikeyConfig,
    subscriptionDeps: SubscriptionDeps = {},
  ) {
    this.subscriptionDeps = {
      spawnCliPrompt: subscriptionDeps.spawnCliPrompt ?? defaultSpawnCliPrompt,
      fileExists:
        subscriptionDeps.fileExists ??
        ((p: string): boolean => {
          // Lazy-require so wikey-core bundles that never use subscription paths
          // (e.g. pure browser builds — none today, but defensive) don't pull `fs`.
          const fs = require('node:fs') as typeof import('node:fs')
          return fs.existsSync(p)
        }),
      homeDir:
        subscriptionDeps.homeDir ??
        ((): string => {
          const os = require('node:os') as typeof import('node:os')
          return os.homedir()
        }),
    }
  }

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

  /**
   * §5.6.4 §3.8 — credential presence detector for `gemini`.
   *
   * Subscription detected = `~/.gemini/oauth_creds.json` exists AND CLI binary
   * (`CLI_DEFAULT_BINARY.gemini`) exists. API detected = `GEMINI_API_KEY`
   * config field is non-empty. Both checks are sync (no spawn) so this is
   * safe to call on every request.
   */
  checkGeminiPresence(): CredentialPresence {
    const path = require('node:path') as typeof import('node:path')
    const credsPath = path.join(this.subscriptionDeps.homeDir(), '.gemini', 'oauth_creds.json')
    const hasOauth = this.subscriptionDeps.fileExists(credsPath)
    const hasBinary = this.subscriptionDeps.fileExists(CLI_DEFAULT_BINARY.gemini)
    return {
      hasSubscription: hasOauth && hasBinary,
      hasApiKey: !!this.config.GEMINI_API_KEY,
    }
  }

  private async callGemini(prompt: string, opts?: LLMCallOptions): Promise<string> {
    const presence = this.checkGeminiPresence()
    // resolveAuthMode throws when neither credential is registered AND no force-mode
    // satisfies the demand. callGeminiApi's own guard ('GEMINI_API_KEY not set') is
    // preserved for force-api with no key (resolveAuthMode throws first with the
    // same intent — provider parity).
    const path = resolveAuthMode('gemini', this.config, presence)
    if (path !== 'subscription') {
      return this.callGeminiApi(prompt, opts)
    }
    return this.callGeminiWithFallback(prompt, opts, presence)
  }

  private async callGeminiWithFallback(
    prompt: string,
    opts: LLMCallOptions | undefined,
    presence: CredentialPresence,
  ): Promise<string> {
    try {
      return await this.callGeminiSubscription(prompt, opts)
    } catch (err) {
      const reason = classifyFallbackReason(err)
      const mode = this.config.GEMINI_AUTH_MODE ?? 'auto'
      // auto + has API key + actionable reason = retry on API path.
      if (mode === 'auto' && presence.hasApiKey && reason !== null) {
        opts?.onAuthFallback?.({ provider: 'gemini', reason, originalError: err as Error })
        return this.callGeminiApi(prompt, opts)
      }
      throw err
    }
  }

  /**
   * §5.6.4.2 Step B — gemini subscription path (CLI spawn → parseSubscriptionOutput).
   *
   * Failure modes (caller catches + classifies):
   *   - jsonMode requested → throw SubscriptionUnsupportedError('jsonMode-unsupported')
   *   - CLI spawn ENOENT  → throw with cause; classifyFallbackReason returns 'spawn-failed'
   *   - aborted (timeout) → throw with reason 'timeout'
   *   - auth missing       → throw with reason from detectFallbackTrigger
   *   - quota              → ditto
   *   - nonzero exit       → throw raw stderr (api fallback can recover in auto mode)
   */
  private async callGeminiSubscription(prompt: string, opts?: LLMCallOptions): Promise<string> {
    const mapped = mapOptionsToCliArgs('gemini', 'subscription', opts ?? {})
    if (mapped.unsupported === 'jsonMode') {
      throw new SubscriptionFallbackError('jsonMode-unsupported', 'gemini subscription does not support jsonMode')
    }

    const spawnOpts: SpawnCliOptions = {
      extraArgs: mapped.args,
      timeoutMs: opts?.timeout,
    }
    let result: SpawnCliResult
    try {
      result = await this.subscriptionDeps.spawnCliPrompt('gemini', prompt, spawnOpts)
    } catch (err) {
      // spawn-time error (ENOENT etc.) — classified as spawn-failed.
      throw new SubscriptionFallbackError('spawn-failed', `gemini CLI spawn failed: ${(err as Error).message}`, err as Error)
    }

    if (result.aborted) {
      throw new SubscriptionFallbackError('timeout', 'gemini CLI aborted (timeout or external signal)')
    }

    if (result.exitCode !== 0) {
      const triggerReason = detectFallbackTrigger({
        status: 0,
        stderr: result.stderr,
        body: result.stdout,
      })
      const reason: FallbackReason = triggerReason ?? 'spawn-failed'
      throw new SubscriptionFallbackError(reason, `gemini CLI exit ${result.exitCode}: ${result.stderr.trim() || '<no stderr>'}`)
    }

    return parseSubscriptionOutput('gemini', result.stdout)
  }

  private async callGeminiApi(prompt: string, opts?: LLMCallOptions): Promise<string> {
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
    // §5.7.9 I1 — gemini-2.5 thinking opt-out. caller 가 thinkingBudget 명시 시
    // (advanced query tuning = 0 default) generationConfig 에 thinkingConfig 추가.
    // 미명시 시 key 자체 omit 하여 다른 use case 의 gemini default 동작 보존.
    if (opts?.thinkingBudget !== undefined) {
      generationConfig.thinkingConfig = { thinkingBudget: opts.thinkingBudget }
    }

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

  /**
   * §5.6.4.3 Step C — credential presence detector for `anthropic`.
   *
   * Unlike Gemini (file-backed OAuth at `~/.gemini/oauth_creds.json`), the
   * `claude` CLI stores subscription tokens in the macOS Keychain, which is
   * not probeable via `fs.existsSync`. We therefore treat **CLI binary
   * presence alone** as `hasSubscription=true`; the actual logged-in state
   * surfaces at the first spawn through stderr ("Please login") and is
   * classified by `detectFallbackTrigger` → `reason='auth-missing'`, then
   * fallback-retried on the API path when available.
   */
  checkAnthropicPresence(): CredentialPresence {
    const hasBinary = this.subscriptionDeps.fileExists(CLI_DEFAULT_BINARY.anthropic)
    return {
      hasSubscription: hasBinary,
      hasApiKey: !!this.config.ANTHROPIC_API_KEY,
    }
  }

  private async callAnthropic(prompt: string, opts?: LLMCallOptions): Promise<string> {
    const presence = this.checkAnthropicPresence()
    const path = resolveAuthMode('anthropic', this.config, presence)
    if (path !== 'subscription') {
      return this.callAnthropicApi(prompt, opts)
    }
    return this.callAnthropicWithFallback(prompt, opts, presence)
  }

  private async callAnthropicWithFallback(
    prompt: string,
    opts: LLMCallOptions | undefined,
    presence: CredentialPresence,
  ): Promise<string> {
    try {
      return await this.callAnthropicSubscription(prompt, opts)
    } catch (err) {
      const reason = classifyFallbackReason(err)
      const mode = this.config.ANTHROPIC_AUTH_MODE ?? 'auto'
      // auto + has API key + actionable reason = transparent retry on API path.
      if (mode === 'auto' && presence.hasApiKey && reason !== null) {
        opts?.onAuthFallback?.({ provider: 'anthropic', reason, originalError: err as Error })
        return this.callAnthropicApi(prompt, opts)
      }
      throw err
    }
  }

  /**
   * §5.6.4.3 Step C — anthropic subscription path (`claude -p` CLI OAuth).
   *
   * Mirrors `callGeminiSubscription` (same 5 failure modes):
   *   - jsonMode requested → throw SubscriptionFallbackError('jsonMode-unsupported')
   *   - spawn ENOENT       → throw with reason 'spawn-failed'
   *   - aborted (timeout)  → throw with reason 'timeout'
   *   - auth-missing       → detected from "Please login" stderr → reason 'auth-missing'
   *   - quota              → detected from stderr keywords → reason 'quota-exceeded'
   *   - other nonzero exit → reason 'spawn-failed' (auto fallback in caller)
   *
   * stdout parsing = `parseSubscriptionOutput('anthropic', stdout)` = `trim()` only
   * (claude prints no banner / footer).
   */
  private async callAnthropicSubscription(prompt: string, opts?: LLMCallOptions): Promise<string> {
    const mapped = mapOptionsToCliArgs('anthropic', 'subscription', opts ?? {})
    if (mapped.unsupported === 'jsonMode') {
      throw new SubscriptionFallbackError(
        'jsonMode-unsupported',
        'anthropic subscription does not support jsonMode',
      )
    }

    const spawnOpts: SpawnCliOptions = {
      extraArgs: mapped.args,
      timeoutMs: opts?.timeout,
    }
    let result: SpawnCliResult
    try {
      result = await this.subscriptionDeps.spawnCliPrompt('anthropic', prompt, spawnOpts)
    } catch (err) {
      throw new SubscriptionFallbackError(
        'spawn-failed',
        `anthropic CLI spawn failed: ${(err as Error).message}`,
        err as Error,
      )
    }

    if (result.aborted) {
      throw new SubscriptionFallbackError(
        'timeout',
        'anthropic CLI aborted (timeout or external signal)',
      )
    }

    if (result.exitCode !== 0) {
      const triggerReason = detectFallbackTrigger({
        status: 0,
        stderr: result.stderr,
        body: result.stdout,
      })
      const reason: FallbackReason = triggerReason ?? 'spawn-failed'
      throw new SubscriptionFallbackError(
        reason,
        `anthropic CLI exit ${result.exitCode}: ${result.stderr.trim() || '<no stderr>'}`,
      )
    }

    return parseSubscriptionOutput('anthropic', result.stdout)
  }

  private async callAnthropicApi(prompt: string, opts?: LLMCallOptions): Promise<string> {
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

  /**
   * §5.6.4.4 Step D — credential presence detector for `openai` (codex CLI).
   *
   * Subscription detected = `~/.codex/auth.json` exists AND CLI binary
   * (`CLI_DEFAULT_BINARY.openai`) exists. Unlike Anthropic (Keychain) the
   * codex CLI persists OAuth tokens to a plain file, so we can probe it
   * directly. Both checks are sync (no spawn) — safe on every request.
   */
  checkOpenAIPresence(): CredentialPresence {
    const path = require('node:path') as typeof import('node:path')
    const credsPath = path.join(this.subscriptionDeps.homeDir(), '.codex', 'auth.json')
    const hasAuth = this.subscriptionDeps.fileExists(credsPath)
    const hasBinary = this.subscriptionDeps.fileExists(CLI_DEFAULT_BINARY.openai)
    return {
      hasSubscription: hasAuth && hasBinary,
      hasApiKey: !!this.config.OPENAI_API_KEY,
    }
  }

  private async callOpenAI(prompt: string, opts?: LLMCallOptions): Promise<string> {
    const presence = this.checkOpenAIPresence()
    const path = resolveAuthMode('openai', this.config, presence)
    if (path !== 'subscription') {
      return this.callOpenAIApi(prompt, opts)
    }
    return this.callOpenAIWithFallback(prompt, opts, presence)
  }

  private async callOpenAIWithFallback(
    prompt: string,
    opts: LLMCallOptions | undefined,
    presence: CredentialPresence,
  ): Promise<string> {
    try {
      return await this.callOpenAISubscription(prompt, opts)
    } catch (err) {
      const reason = classifyFallbackReason(err)
      const mode = this.config.OPENAI_AUTH_MODE ?? 'auto'
      // auto + has API key + actionable reason = transparent retry on API path.
      if (mode === 'auto' && presence.hasApiKey && reason !== null) {
        opts?.onAuthFallback?.({ provider: 'openai', reason, originalError: err as Error })
        return this.callOpenAIApi(prompt, opts)
      }
      throw err
    }
  }

  /**
   * §5.6.4.4 Step D — openai subscription path (`codex exec -` CLI ChatGPT OAuth).
   *
   * Mirrors `callAnthropicSubscription` (same 5 failure modes):
   *   - jsonMode requested → throw SubscriptionFallbackError('jsonMode-unsupported')
   *   - spawn ENOENT       → throw with reason 'spawn-failed'
   *   - aborted (timeout)  → throw with reason 'timeout'
   *   - auth-missing       → detected from "not logged in" stderr → reason 'auth-missing'
   *   - quota              → detected from stderr keywords → reason 'quota-exceeded'
   *   - other nonzero exit → reason 'spawn-failed' (auto fallback in caller)
   *
   * stdout parsing = `parseSubscriptionOutput('openai', stdout)` = marker-based
   * extraction (`\ncodex\n` ↔ `\ntokens used` sandwich; cli-parser.ts).
   */
  private async callOpenAISubscription(prompt: string, opts?: LLMCallOptions): Promise<string> {
    const mapped = mapOptionsToCliArgs('openai', 'subscription', opts ?? {})
    if (mapped.unsupported === 'jsonMode') {
      throw new SubscriptionFallbackError(
        'jsonMode-unsupported',
        'openai subscription does not support jsonMode',
      )
    }

    const spawnOpts: SpawnCliOptions = {
      extraArgs: mapped.args,
      timeoutMs: opts?.timeout,
    }
    let result: SpawnCliResult
    try {
      result = await this.subscriptionDeps.spawnCliPrompt('openai', prompt, spawnOpts)
    } catch (err) {
      throw new SubscriptionFallbackError(
        'spawn-failed',
        `openai CLI spawn failed: ${(err as Error).message}`,
        err as Error,
      )
    }

    if (result.aborted) {
      throw new SubscriptionFallbackError(
        'timeout',
        'openai CLI aborted (timeout or external signal)',
      )
    }

    if (result.exitCode !== 0) {
      const triggerReason = detectFallbackTrigger({
        status: 0,
        stderr: result.stderr,
        body: result.stdout,
      })
      const reason: FallbackReason = triggerReason ?? 'spawn-failed'
      throw new SubscriptionFallbackError(
        reason,
        `openai CLI exit ${result.exitCode}: ${result.stderr.trim() || '<no stderr>'}`,
      )
    }

    return parseSubscriptionOutput('openai', result.stdout)
  }

  private async callOpenAIApi(prompt: string, opts?: LLMCallOptions): Promise<string> {
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
          // Drop non-text variants that the ingest/query pipeline can't use.
          // Each token may appear at end (`*-tts`) or in middle (`*-tts-preview`).
          .filter((n: string) => !(
            /-(?:tts|customtools|image|video|embedding|robotics)(?:-|$)/.test(n)
            || /-native-audio-/.test(n)
            || /-computer-use-/.test(n)
          ))
          .sort((a: string, b: string) => sortGeminiModelsRecommended(a, b))
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

/**
 * Order Gemini model IDs so that recommended families surface first in the UI dropdown.
 * Order: gemini-2.5-flash family → gemini-2.5-pro → gemini-3.x flash → gemini-3.x pro → rest.
 * Within each bucket, alphabetical (so "-001" ordered before "-002").
 *
 * Why this ordering: 2.5-flash is the recommended ingest default (fast + cheap), 2.5-pro is
 * the next step up for accuracy; 3.x is preview tier. Users scanning the dropdown should see
 * stable production options before preview/experimental ones.
 */
export function sortGeminiModelsRecommended(a: string, b: string): number {
  const bucket = (n: string): number => {
    if (n === 'gemini-2.5-flash') return 0
    if (n.startsWith('gemini-2.5-flash')) return 1
    if (n === 'gemini-2.5-pro') return 2
    if (n.startsWith('gemini-2.5-pro')) return 3
    if (/^gemini-3(\.\d+)?-flash/.test(n)) return 4
    if (/^gemini-3(\.\d+)?-pro/.test(n)) return 5
    return 6
  }
  const ba = bucket(a), bb = bucket(b)
  if (ba !== bb) return ba - bb
  return a.localeCompare(b)
}

function stripThinkingBlock(text: string): string {
  const marker = 'done thinking'
  const idx = text.toLowerCase().indexOf(marker)
  if (idx === -1) return text
  return text.slice(idx + marker.length).replace(/^[.\n ]+/, '')
}

/**
 * §5.6.4.2 Step B — typed subscription failure carrying the AuthFallbackInfo.reason.
 * Thrown by `callGeminiSubscription` (and future claude/codex subscription paths)
 * so the wrapper `callGeminiWithFallback` can decide retry vs throw with one branch.
 *
 * Plain `Error` subclass — no instanceof check across realms is required (single
 * bundle / single VM in Obsidian renderer + Node test runner).
 */
export class SubscriptionFallbackError extends Error {
  constructor(
    public readonly reason: FallbackReason,
    message: string,
    public readonly cause?: Error,
  ) {
    super(message)
    this.name = 'SubscriptionFallbackError'
  }
}

/**
 * Extract the FallbackReason from an error. Returns null when the error is not
 * a recognized subscription failure (caller surfaces original).
 */
function classifyFallbackReason(err: unknown): FallbackReason | null {
  if (err instanceof SubscriptionFallbackError) return err.reason
  return null
}
