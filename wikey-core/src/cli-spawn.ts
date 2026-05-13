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

import { execSync } from 'node:child_process'
import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { SubscriptionProvider } from './types.js'

/**
 * §5.6.4 v0.7 — dynamic CLI binary resolution.
 *
 * Background: hardcoded `/usr/local/bin/{gemini,claude,codex}` failed when the
 * user's actual binaries live under nvm (`~/.nvm/versions/node/<v>/bin`) or the
 * cmux bundle (`/Applications/cmux.app/Contents/Resources/bin`). I8 invariant
 * (no hardcoded paths; honour `wikey.conf` override) was violated, causing the
 * Settings panel to render "Subscription: not detected" for all 3 providers
 * even when each CLI was installed and logged in.
 *
 * Resolution order (first hit wins, memoized for process lifetime):
 *   1. Env override — `WIKEY_<PROVIDER>_CLI_PATH` (e.g. WIKEY_GEMINI_CLI_PATH).
 *      Path must exist; otherwise we ignore and fall through.
 *   2. `command -v <name>` via login-style shell — picks up PATH including nvm,
 *      Homebrew shims, asdf etc.
 *   3. Static fallback candidates:
 *      - `/opt/homebrew/bin/<name>` (Apple Silicon Homebrew)
 *      - `/usr/local/bin/<name>` (Intel Homebrew / legacy)
 *      - `/Applications/cmux.app/Contents/Resources/bin/<name>` (cmux bundle)
 *      - `~/.nvm/versions/node/<v>/bin/<name>` (every installed Node version)
 *   4. Fall back to `/usr/local/bin/<name>` so existing tests (which stub
 *      `fileExists` to gate on this exact string) keep working unchanged.
 */

const PROVIDER_BINARY_NAME: Record<SubscriptionProvider, string> = {
  gemini: 'gemini',
  anthropic: 'claude',
  openai: 'codex',
}

const PROVIDER_ENV_OVERRIDE: Record<SubscriptionProvider, string> = {
  gemini: 'WIKEY_GEMINI_CLI_PATH',
  anthropic: 'WIKEY_ANTHROPIC_CLI_PATH',
  openai: 'WIKEY_OPENAI_CLI_PATH',
}

const STATIC_FALLBACK_DIRS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/Applications/cmux.app/Contents/Resources/bin',
] as const

const resolutionCache = new Map<SubscriptionProvider, string>()

/** Expand `~/.nvm/versions/node/<v>/bin` for every installed node version. */
function nvmCandidateDirs(): string[] {
  try {
    const root = join(homedir(), '.nvm', 'versions', 'node')
    if (!existsSync(root)) return []
    return readdirSync(root).map((v) => join(root, v, 'bin'))
  } catch {
    return []
  }
}

/** Try `command -v <name>` in a login shell so nvm/asdf/homebrew shims resolve. */
function whichBinary(name: string): string | null {
  try {
    const out = execSync(`command -v ${name}`, {
      encoding: 'utf-8',
      shell: '/bin/bash',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return out.length > 0 && existsSync(out) ? out : null
  } catch {
    return null
  }
}

/**
 * Resolve the absolute path of an external CLI for `provider`, with env
 * override > PATH lookup > static fallbacks. Memoized per process.
 *
 * Returns the legacy `/usr/local/bin/<name>` string if every step fails so
 * callers (and `fileExists`-stubbed tests) get a stable string for failure
 * paths. Real callers should check `existsSync` on the result before spawn.
 */
export function resolveCliBinary(provider: SubscriptionProvider): string {
  const cached = resolutionCache.get(provider)
  if (cached !== undefined) return cached

  const name = PROVIDER_BINARY_NAME[provider]

  // 1. Env override (WIKEY_*_CLI_PATH)
  const envKey = PROVIDER_ENV_OVERRIDE[provider]
  const envVal = process.env[envKey]
  if (envVal !== undefined && envVal.length > 0 && existsSync(envVal)) {
    resolutionCache.set(provider, envVal)
    return envVal
  }

  // 2. `command -v`
  const fromPath = whichBinary(name)
  if (fromPath !== null) {
    resolutionCache.set(provider, fromPath)
    return fromPath
  }

  // 3. Static fallback dirs + nvm glob
  const candidates: string[] = [
    ...STATIC_FALLBACK_DIRS.map((d) => join(d, name)),
    ...nvmCandidateDirs().map((d) => join(d, name)),
  ]
  for (const c of candidates) {
    if (existsSync(c)) {
      resolutionCache.set(provider, c)
      return c
    }
  }

  // 4. Final fallback — legacy hardcoded path. Stable string for tests/logs.
  const legacy = `/usr/local/bin/${name}`
  resolutionCache.set(provider, legacy)
  return legacy
}

/** Test-only: clear memoized resolutions (e.g. between env-override tests). */
export function __resetCliBinaryResolutionCache(): void {
  resolutionCache.clear()
}

/**
 * §4.6 — per-CLI binary locations. Lazy-resolved via `resolveCliBinary` so the
 * effective path follows env override → PATH → static fallbacks. Existing
 * consumers (`CLI_DEFAULT_BINARY.gemini` etc.) keep working unchanged because
 * each property access triggers the resolver.
 */
export const CLI_DEFAULT_BINARY: Record<SubscriptionProvider, string> = Object.freeze({
  get gemini(): string {
    return resolveCliBinary('gemini')
  },
  get anthropic(): string {
    return resolveCliBinary('anthropic')
  },
  get openai(): string {
    return resolveCliBinary('openai')
  },
}) as unknown as Record<SubscriptionProvider, string>

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
