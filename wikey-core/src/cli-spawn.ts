/**
 * §5.6.4 — subscription CLI spawn wrapper.
 *
 * Plan: plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md §5.2 A3.
 *
 * Single entry point for child_process.spawn against the 3 external CLIs
 * (claude / codex / gemini). Concerns:
 *   - argv per provider (locked by const block + plan §4.0.7 PoC golden)
 *   - stdin = prompt (utf8)
 *   - AbortController + opts.timeout (default 60s, AC-S12 contract)
 *   - stdout/stderr captured as strings, exitCode + aborted flag returned
 *
 * Out of scope (handled by callers):
 *   - parsing stdout → response body (cli-parser.ts)
 *   - mapping LLMCallOptions → CLI flags (provider-cli-options.ts)
 *   - falling back to API path on failure (llm-client.ts via callWithFallback)
 *
 * Renderer compatibility: §5.2 A0 verified that `node:child_process.spawn`
 * works inside the Obsidian Electron renderer (vitest layer PASS; master CDP
 * cycle deferred). Anchor here so a future renderer regression has a single
 * file to inspect.
 */

import { spawn } from 'node:child_process'
import type { SubscriptionProvider } from './types.js'

/** §4.6 — default per-CLI binary locations on macOS dev box. Override via opts.cliPathOverride. */
export const CLI_DEFAULT_BINARY: Record<SubscriptionProvider, string> = {
  // Source: PoC §4 master probe (2026-05-13). Production callers SHOULD resolve
  // via `which gemini` / `which claude` / `which codex` and pass cliPathOverride
  // — these defaults exist for tests and as a fallback when PATH resolution fails.
  gemini: '/usr/local/bin/gemini',
  anthropic: '/usr/local/bin/claude',
  openai: '/usr/local/bin/codex',
}

/** §4.0.7 — locked argv tail per provider (additional flags appended by provider-cli-options.ts). */
export const CLI_BASE_ARGS: Record<SubscriptionProvider, readonly string[]> = {
  // Source: plan §4.0.7 + each CLI `--help` (gemini v0.40.1 / claude v2.1.140 / codex v0.128.0).
  gemini: ['-p', '-'], // gemini -p '<prompt>' or -p - (stdin)
  anthropic: ['-p'], // claude -p (stdin = prompt)
  openai: ['exec', '-'], // codex exec - (stdin = prompt)
}

/** AC-S12 default spawn timeout — 60s. Override via opts.timeoutMs. */
export const CLI_DEFAULT_TIMEOUT_MS = 60_000

export interface SpawnCliOptions {
  /** Extra CLI flags (e.g. ['-m', 'gemini-2.5-flash']) appended AFTER CLI_BASE_ARGS. */
  readonly extraArgs?: readonly string[]
  /** Hard timeout in ms. Default = CLI_DEFAULT_TIMEOUT_MS (60s). */
  readonly timeoutMs?: number
  /** External AbortSignal (e.g. user cancel button). Combined with internal timeout signal. */
  readonly signal?: AbortSignal
  /** Test-only: skip CLI_DEFAULT_BINARY[provider]. */
  readonly cliPathOverride?: string
  /** Test-only: replace argv entirely (bypasses CLI_BASE_ARGS + extraArgs). */
  readonly argvOverride?: readonly string[]
  /** Test-only: replace env when launching. */
  readonly env?: NodeJS.ProcessEnv
}

export interface SpawnCliResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number | null
  readonly aborted: boolean
}

/**
 * Run an external CLI with `prompt` piped on stdin and return its captured output.
 *
 * Never throws on subprocess error — exit code / stderr / aborted are all data,
 * so callers can inspect via detectFallbackTrigger. Only synchronous spawn-time
 * errors (e.g. ENOENT for missing binary) reject the returned promise.
 */
export async function spawnCliPrompt(
  provider: SubscriptionProvider,
  prompt: string,
  opts: SpawnCliOptions = {},
): Promise<SpawnCliResult> {
  const cliPath = opts.cliPathOverride ?? CLI_DEFAULT_BINARY[provider]
  const args =
    opts.argvOverride !== undefined
      ? [...opts.argvOverride]
      : [...CLI_BASE_ARGS[provider], ...(opts.extraArgs ?? [])]

  const timeoutMs = opts.timeoutMs ?? CLI_DEFAULT_TIMEOUT_MS

  // Combine internal timeout AbortController with caller-supplied signal so
  // either path can abort the child.
  const internalAc = new AbortController()
  const timeoutHandle = setTimeout(() => internalAc.abort('timeout'), timeoutMs)

  const externalSignal = opts.signal
  const onExternalAbort = (): void => internalAc.abort('external')
  if (externalSignal !== undefined) {
    if (externalSignal.aborted) internalAc.abort('external')
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true })
  }

  const spawnOpts: Parameters<typeof spawn>[2] = {
    signal: internalAc.signal,
    stdio: ['pipe', 'pipe', 'pipe'],
  }
  if (opts.env !== undefined) spawnOpts.env = opts.env

  return await new Promise<SpawnCliResult>((resolve, reject) => {
    let child
    try {
      child = spawn(cliPath, args, spawnOpts)
    } catch (err) {
      clearTimeout(timeoutHandle)
      if (externalSignal !== undefined) externalSignal.removeEventListener('abort', onExternalAbort)
      reject(err)
      return
    }

    let stdout = ''
    let stderr = ''
    let aborted = false
    let errored = false

    child.stdout?.setEncoding('utf-8')
    child.stderr?.setEncoding('utf-8')
    child.stdout?.on('data', (chunk: string) => {
      stdout += chunk
    })
    child.stderr?.on('data', (chunk: string) => {
      stderr += chunk
    })

    child.on('error', (err: NodeJS.ErrnoException) => {
      // AbortError surfaces here on Node 18+ when signal aborts. Treat as aborted, not failure.
      if (err.name === 'AbortError' || err.code === 'ABORT_ERR') {
        aborted = true
      } else {
        errored = true
        clearTimeout(timeoutHandle)
        if (externalSignal !== undefined) {
          externalSignal.removeEventListener('abort', onExternalAbort)
        }
        reject(err)
      }
    })

    child.on('close', (code, signal) => {
      clearTimeout(timeoutHandle)
      if (externalSignal !== undefined) externalSignal.removeEventListener('abort', onExternalAbort)
      if (errored) return
      const wasAborted = aborted || internalAc.signal.aborted || signal === 'SIGTERM'
      resolve({ stdout, stderr, exitCode: code, aborted: wasAborted })
    })

    // Write prompt to stdin and close.
    if (child.stdin !== null) {
      child.stdin.on('error', () => {
        // EPIPE if child exits before reading stdin — ignore, close handler reports result.
      })
      try {
        child.stdin.end(prompt, 'utf-8')
      } catch {
        // child may already be aborted; close handler will resolve.
      }
    }
  })
}
