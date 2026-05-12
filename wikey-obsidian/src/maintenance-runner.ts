/**
 * §5.19 — shared `MaintenanceRunner` factory used by both the Help panel entry
 * (sidebar-chat.ts) and the palette commands (commands.ts). Wires the modal's
 * AbortController.signal into every wikey-core call (Finding 4 cycle #3) plus
 * a `validateWiki` injection so `runWikiCheck` actually exercises validate-wiki
 * findings (Finding 1: HIGH — Help panel runner previously dropped the
 * injection and check.ts:69 silently skipped that branch).
 *
 * The runner lazy-requires `wikey-core` so test contexts (jest jsdom) without
 * the bundled core silently no-op each method.
 */

import type WikeyPlugin from './main'
import type { MaintenanceRunner } from './maintenance-modal'

interface CoreApi {
  getWikiStatus?: (
    wikiFS: unknown,
    opts?: { forceRefresh?: boolean; signal?: AbortSignal },
  ) => Promise<Record<string, unknown>>
  runWikiCheck?: (
    wikiFS: unknown,
    opts?: {
      validateWiki?: (signal?: AbortSignal) => Promise<{ exitCode: number; findings: readonly unknown[] }>
      signal?: AbortSignal
    },
  ) => Promise<{ findings: readonly { kind: string; path?: string; detail?: string }[] }>
  applyWikiRecovery?: (
    wikiFS: unknown,
    opts: { confirm: boolean; danglingShas?: readonly string[]; signal?: AbortSignal },
  ) => Promise<{ changedPages: readonly string[] }>
  getRefactoringSuggestions?: (wikiFS: unknown, opts?: { signal?: AbortSignal }) => Promise<Record<string, unknown>>
  validateWiki?: (
    basePath: string,
    env: Record<string, string>,
    signal?: AbortSignal,
  ) => Promise<{ exitCode: number; stdout: string }>
}

function loadCore(): CoreApi | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('wikey-core') as CoreApi
  } catch {
    return null
  }
}

/**
 * Extract vault basePath via the FileSystemAdapter — typed loosely because
 * Obsidian's FileSystemAdapter#basePath is not on the public typing surface
 * (`(adapter as any).basePath` mirrors how the rest of sidebar-chat / commands.ts
 * access it). Returns `''` when running under a non-disk adapter (mobile) — the
 * validateWiki runner then no-ops + returns exitCode 0 so the rest of the
 * pipeline still surfaces findings.
 */
function readVaultBasePath(plugin: WikeyPlugin): string {
  const adapter = plugin.app.vault.adapter as unknown as { basePath?: string }
  return adapter.basePath ?? ''
}

/**
 * Build a `MaintenanceRunner` wired to the live wikey-core bundle. Shared by
 * the Help panel buttons (sidebar-chat.ts) + palette commands (commands.ts).
 */
export function createMaintenanceRunner(plugin: WikeyPlugin): MaintenanceRunner {
  const wikiFS = plugin.wikiFS
  return {
    async runStatus(signal) {
      const core = loadCore()
      if (!core?.getWikiStatus) return {}
      return await core.getWikiStatus(wikiFS, { forceRefresh: true, signal })
    },
    async runCheck(signal) {
      const core = loadCore()
      if (!core?.runWikiCheck) return []
      const validateWiki = buildValidateWikiInjection(plugin, core)
      const report = await core.runWikiCheck(wikiFS, { validateWiki, signal })
      return report.findings
    },
    async runRecovery(signal, payload) {
      const core = loadCore()
      if (!core?.applyWikiRecovery) return { changedPages: [] }
      const report = await core.applyWikiRecovery(wikiFS, {
        confirm: true,
        danglingShas: payload.danglingShas,
        signal,
      })
      return { changedPages: report.changedPages }
    },
    async runRefactoring(signal) {
      const core = loadCore()
      if (!core?.getRefactoringSuggestions) return {}
      return await core.getRefactoringSuggestions(wikiFS, { signal })
    },
  }
}

/**
 * Build a validateWiki injection callable from `runWikiCheck`. Uses the
 * in-process `validateWiki(basePath, env, signal)` runner shipped by wikey-core
 * (scripts-runner.ts) — `validate-wiki.sh` itself is a thin wrapper around the
 * same TS implementation. `FAIL:` lines from stdout become `validate-wiki`
 * findings so AC-C2-1 parity (exit code + findings) holds end-to-end.
 *
 * §5.19 cycle #4 (2026-05-12) — `signal` is now wired into `validateWiki()` so
 * an upstream abort (MaintenanceModal close → AbortController.abort()) trips
 * the same cancellation path that the captureRun timeout uses. When a future
 * swap to `child_process.spawn` backed runner happens, the same signal becomes
 * the SIGTERM trigger — drop-in replacement preserved.
 */
function buildValidateWikiInjection(
  plugin: WikeyPlugin,
  core: CoreApi,
): (signal?: AbortSignal) => Promise<{ exitCode: number; findings: readonly { kind: string; detail: string }[] }> {
  return async (signal?: AbortSignal) => {
    if (!core.validateWiki) return { exitCode: 0, findings: [] }
    const basePath = readVaultBasePath(plugin)
    if (!basePath) return { exitCode: 0, findings: [] }
    const result = await core.validateWiki(basePath, {}, signal)
    const findings = result.stdout
      .split('\n')
      .filter((line) => /^FAIL:/.test(line))
      .map((line) => ({ kind: 'validate-wiki', detail: line.replace(/^FAIL:\s*/, '') }))
    return { exitCode: result.exitCode, findings }
  }
}
