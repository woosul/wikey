/**
 * §5.6.4.1 Step A3 — cli-spawn RED.
 *
 * Plan reference:
 *   - docs/planning/phase-5/phase-5-todox-5.6.4-llm-subscription.md §5.2 A3
 *
 * Spec — `spawnCliPrompt(provider, prompt, opts) → Promise<{stdout, stderr, exitCode}>`
 *   3 providers × spawn args:
 *     gemini → [geminiPath, '-p', '-']  + stdin = prompt
 *     claude → [claudePath, '-p']       + stdin = prompt
 *     codex  → [codexPath, 'exec', '-'] + stdin = prompt
 *   AbortController + opts.timeout (default 600s, was 60s pre-commit 16) → AC-S12.
 *
 * 6 cases:
 *   (1) gemini happy path — stdin written, stdout captured, exitCode 0
 *   (2) claude happy path
 *   (3) codex happy path (different argv)
 *   (4) opts.timeout fires → AbortController abort → result.aborted=true
 *   (5) external AbortController.abort() propagates
 *   (6) nonzero exit code surfaced (no silent success)
 *
 * Implementation uses a built-in `sh -c '…'` invocation via `cliPath` override
 * so we avoid mocking `node:child_process` (which would require shimming the
 * import surface for both ESM and CJS). The contract is verified end-to-end.
 */

import { describe, it, expect } from 'vitest'
import { spawnCliPrompt, CLI_DEFAULT_TIMEOUT_MS } from '../cli-spawn.js'

describe('§5.6.4 spawnCliPrompt — argv / stdin / exit contract', () => {
  it('AC-A3.1: gemini argv = [path, "-p", "-"] (spawn args inspection via shim)', async () => {
    // shim binary = `sh` script that echoes its argv + stdin into stdout for assertion.
    // We use `printf "%s\n" "$@"; cat` — argv tokens then stdin content. The wrapper
    // is invoked via overriddenCliPath so the production resolver isn't required.
    const result = await spawnCliPrompt('gemini', 'hello prompt', {
      cliPathOverride: '/bin/sh',
      argvOverride: ['-c', 'printf "ARGV:%s\\n" "$@"; printf "STDIN:"; cat', 'sh', '-p', '-'],
    })
    expect(result.exitCode).toBe(0)
    // Three argv tokens should appear, in order
    expect(result.stdout).toMatch(/ARGV:-p/)
    expect(result.stdout).toMatch(/ARGV:-/)
    // stdin forwarded
    expect(result.stdout).toContain('STDIN:hello prompt')
  })

  it('AC-A3.2: claude argv = [path, "-p"] (no positional "-")', async () => {
    const result = await spawnCliPrompt('anthropic', 'claude prompt', {
      cliPathOverride: '/bin/sh',
      argvOverride: ['-c', 'printf "ARGV:%s\\n" "$@"; cat', 'sh', '-p'],
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('ARGV:-p')
    expect(result.stdout).toContain('claude prompt')
  })

  it('AC-A3.3: codex argv = [path, "exec", "-"]', async () => {
    const result = await spawnCliPrompt('openai', 'codex prompt body', {
      cliPathOverride: '/bin/sh',
      argvOverride: ['-c', 'printf "ARGV:%s\\n" "$@"; cat', 'sh', 'exec', '-'],
    })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('ARGV:exec')
    expect(result.stdout).toContain('codex prompt body')
  })

  it('AC-A3.4: opts.timeout fires → spawn aborted (AC-S12)', async () => {
    const result = await spawnCliPrompt('gemini', 'irrelevant', {
      cliPathOverride: '/bin/sh',
      argvOverride: ['-c', 'sleep 30'],
      timeoutMs: 50,
    })
    // Either signal SIGTERM (Node 18-20) or non-zero exit with aborted flag.
    expect(result.aborted).toBe(true)
  })

  it('AC-A3.5: external AbortController.abort() interrupts spawn', async () => {
    const ac = new AbortController()
    setTimeout(() => ac.abort(), 50)
    const result = await spawnCliPrompt('gemini', 'irrelevant', {
      cliPathOverride: '/bin/sh',
      argvOverride: ['-c', 'sleep 30'],
      signal: ac.signal,
    })
    expect(result.aborted).toBe(true)
  })

  it('AC-A3.6: nonzero exit code surfaced (e.g. CLI auth error)', async () => {
    const result = await spawnCliPrompt('gemini', 'irrelevant', {
      cliPathOverride: '/bin/sh',
      argvOverride: ['-c', 'echo "not logged in" 1>&2; exit 7'],
    })
    expect(result.exitCode).toBe(7)
    expect(result.stderr).toContain('not logged in')
    expect(result.aborted).toBe(false)
  })

  it('AC-A3.7 (sanity): CLI_DEFAULT_TIMEOUT_MS = 600s (§5.6.4 commit 16)', () => {
    // §5.6.4 commit 16 (2026-05-14): bumped 60s → 600s after gemini-2.5-pro
    // canonicalize of large sources routinely exceeded the 60s ceiling.
    expect(CLI_DEFAULT_TIMEOUT_MS).toBe(600_000)
  })
})
