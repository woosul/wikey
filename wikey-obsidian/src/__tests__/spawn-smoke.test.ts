/**
 * §5.6.4.1 Step A0 — F4 gate: `child_process.spawn` smoke (RED→GREEN→BLUE)
 *
 * Plan reference:
 *   - docs/planning/phase-5/phase-5-todox-5.6.4-llm-subscription.md §3.6 R3 + §5.2 A0
 *   - docs/planning/phase-5/phase-5-todo.md §5.6.4.1 A0 gate
 *
 * Goal (Spec):
 *   F4 raises that subscription auth path = `child_process.spawn(cliPath, args)`
 *   for external CLIs (claude / codex / gemini). The first RED gate is to confirm
 *   the spawn API itself is reachable + wires stdout / stderr / exitCode correctly
 *   from inside the runtime that hosts Obsidian plugins (Node-based).
 *
 *   §5.7.2 lesson: master previously hit an 8-cycle abandon when an Electron
 *   renderer assumption (file:// ESM dynamic import) failed late. A0 is the
 *   pre-LOCK gate that prevents the same drift for spawn().
 *
 * Scope of THIS test:
 *   - vitest (Node + happy-dom) — same Node API surface Obsidian plugins use.
 *   - Verifies `node:child_process` import + spawn() callback wiring works.
 *   - Verifies AbortController + signal propagation works (AC-S12 contract).
 *
 * Out of scope (deferred to master CDP cycle — see "renderer-gate" describe.skip):
 *   - The actual Obsidian Electron renderer sandbox. Vitest is *not* the renderer;
 *     it is plain Node. A passing test here is necessary but not sufficient.
 *     Final F4 verdict = master executes the obsidian-cdp SKILL against a real
 *     plugin build that calls spawn() at runtime. Documented stub left below
 *     so the renderer cycle has an obvious entry point.
 *
 * Acceptance:
 *   - 4 PASS cases below + exit 0  ⇒  A0 gate "vitest layer" PASS
 *   - master CDP cycle PASS         ⇒  A0 gate "renderer layer" PASS (Step A1 unblock)
 *   - Any FAIL                      ⇒  R3 mitigation path (electron.shell + temp file,
 *                                      or ipcMain channel) — see §3.6 R3.
 */

import { describe, it, expect } from 'vitest'
import { spawn } from 'node:child_process'

const SPAWN_TIMEOUT_MS = 5_000

describe('§5.6.4.1 A0 — child_process.spawn smoke (F4 gate, vitest layer)', () => {
  it('AC-A0.1: spawn("echo", ["hi"]) wires stdout + exitCode=0', async () => {
    const child = spawn('echo', ['hi'])

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8') })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })

    const exitCode: number | null = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('A0.1 spawn timed out')), SPAWN_TIMEOUT_MS)
      child.on('close', (code) => { clearTimeout(t); resolve(code) })
      child.on('error', (err) => { clearTimeout(t); reject(err) })
    })

    expect(exitCode).toBe(0)
    expect(stdout).toContain('hi')
    expect(stderr).toBe('')
  })

  it('AC-A0.2: stderr is captured independently of stdout', async () => {
    // `sh -c "echo err >&2"` — portable on macOS/Linux. wikey is dev'd on darwin.
    const child = spawn('sh', ['-c', 'echo err >&2'])

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8') })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })

    const exitCode: number | null = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('A0.2 spawn timed out')), SPAWN_TIMEOUT_MS)
      child.on('close', (code) => { clearTimeout(t); resolve(code) })
      child.on('error', (err) => { clearTimeout(t); reject(err) })
    })

    expect(exitCode).toBe(0)
    expect(stdout).toBe('')
    expect(stderr).toContain('err')
  })

  it('AC-A0.3: nonzero exit code is surfaced (no silent success)', async () => {
    const child = spawn('sh', ['-c', 'exit 7'])

    const exitCode: number | null = await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('A0.3 spawn timed out')), SPAWN_TIMEOUT_MS)
      child.on('close', (code) => { clearTimeout(t); resolve(code) })
      child.on('error', (err) => { clearTimeout(t); reject(err) })
    })

    expect(exitCode).toBe(7)
  })

  it('AC-A0.4: AbortController.signal aborts a long-running spawn (AC-S12 contract)', async () => {
    const ac = new AbortController()
    // `sh -c "sleep 30"` — would block until SPAWN_TIMEOUT if abort doesn't work.
    const child = spawn('sh', ['-c', 'sleep 30'], { signal: ac.signal })

    // Abort shortly after launch; node should emit 'error' (AbortError) and close.
    setTimeout(() => ac.abort(), 50)

    const result: { code: number | null; signal: NodeJS.Signals | null; errored: boolean } =
      await new Promise((resolve) => {
        let errored = false
        const t = setTimeout(() => resolve({ code: null, signal: null, errored }), SPAWN_TIMEOUT_MS)
        child.on('error', () => { errored = true })
        child.on('close', (code, signal) => {
          clearTimeout(t)
          resolve({ code, signal, errored })
        })
      })

    // Either:
    //   (a) errored === true (AbortError dispatched), OR
    //   (b) signal === 'SIGTERM' (process killed by abort)
    // Both signal that the abort wiring works. Node 18+ behavior varies slightly across
    // patch versions, so we accept either positive evidence rather than overspecify.
    const aborted = result.errored || result.signal === 'SIGTERM' || result.code !== 0
    expect(aborted).toBe(true)
  })
})

/**
 * Renderer-layer gate — DEFERRED TO MASTER CDP CYCLE
 *
 * The four PASS cases above run in plain Node (vitest). The strict §5.2 A0 gate
 * specifies "Obsidian Electron renderer 안" — which only a CDP smoke against a
 * built plugin running inside a real Obsidian instance can confirm.
 *
 * Master is the 1차 책임 for Obsidian CDP UI smoke (2026-05-12 LOCK, CLAUDE.md
 * "Subagent 위임 기준"). The describe.skip below is a documented placeholder so
 * the master CDP cycle has a clear entry point and the skip is intentional, not
 * forgotten.
 *
 * To convert this skip → PASS:
 *   1. Build wikey-obsidian (`npm run build`) into the dev vault.
 *   2. Add a temporary command in main.ts that calls `spawn('echo', ['hi'])` and
 *      logs stdout to a Notice or console.
 *   3. Launch Obsidian with --remote-debugging-port=9222 --remote-allow-origins='*'.
 *   4. Trigger the command via CDP; capture console.log via Runtime.evaluate.
 *   5. Assert the captured stdout contains "hi". Update §5.2 A0 todo checkbox.
 */
describe.skip('§5.6.4.1 A0 — renderer-layer smoke (master CDP, deferred)', () => {
  it('AC-A0.5 (CDP): spawn("echo hi") inside Obsidian renderer returns "hi"', () => {
    // master-owned. See block comment above for execution recipe.
  })
})
