import { App, FuzzySuggestModal, Modal, Notice, TFile } from 'obsidian'
import type WikeyPlugin from './main'
import {
  generateBrief,
  ingest,
  PlanRejectedError,
  PiiIngestBlockedError,
  IngestCancelledByUserError,
  type IngestPlan,
  type SkippedIngestResult,
  type ConflictInfo,
  classifyFileAsync,
  movePair,
  loadRegistry,
  saveRegistry,
  reconcileAfterIngest,
  registryRecordDelete,
  computeDeletionImpact,
  previewReset,
  REGISTRY_PATH,
  QMD_INDEX_MARKER,
  SETTINGS_MARKER,
  type ResetScope,
  type SourceRegistry,
  reindexQuick,
  convertSourceToMarkdown,
  type ConversionResult,
  needsWikilinkSanitize,
  sanitizeWikilinkTarget,
} from 'wikey-core'
import { ConflictModal, type ConflictChoice } from './conflict-modal'
import { WikeyChatView, WIKEY_CHAT_VIEW, triggerPanelRefresh } from './sidebar-chat'
import { IngestFlowModal } from './ingest-modals'
import { DeleteImpactModal, ResetImpactModal } from './reset-modals'

export function registerCommands(plugin: WikeyPlugin): void {
  // Cmd+Shift+I: Ingest current note
  plugin.addCommand({
    id: 'ingest-current-note',
    name: 'Ingest current note',
    hotkeys: [{ modifiers: ['Mod', 'Shift'], key: 'i' }],
    checkCallback: (checking) => {
      const file = plugin.app.workspace.getActiveFile()
      if (!file) return false
      if (checking) return true
      // §5.2.9: raw/0_inbox/ 에서 트리거 시 audit panel 과 동일하게 자동 분류 +
      // movePair (CLASSIFY.md + LLM fallback). 그렇지 않으면 inbox 잔재 + 답변 의
      // 원본 backlink 가 inbox 가리킴 (사용자 의문 발생).
      const autoMove = file.path.startsWith('raw/0_inbox/')
      runIngest(
        plugin,
        file.path,
        (s, t, m) => new Notice(`${s}/${t} ${m}`),
        { autoMoveFromInbox: autoMove },
      ).then((r) => {
        if (r.success) new Notice(`Ingest complete: ${r.createdPages.length} pages`)
        else new Notice(`Ingest failed: ${r.error}`)
      })
      return true
    },
  })

  // Command palette: Ingest file (picker)
  plugin.addCommand({
    id: 'ingest-file',
    name: 'Ingest file...',
    callback: () => {
      new IngestFileSuggestModal(plugin).open()
    },
  })

  // Obsidian URI protocol
  plugin.registerObsidianProtocolHandler('wikey', async (params) => {
    if (params.query) {
      await plugin.activateChatView()
      // Trigger query in chat view after a short delay for view to mount
      setTimeout(() => {
        const leaves = plugin.app.workspace.getLeavesOfType(WIKEY_CHAT_VIEW)
        if (leaves.length > 0) {
          const view = leaves[0].view as any
          if (view.inputEl) {
            view.inputEl.value = params.query
            view.handleSend?.()
          }
        }
      }, 300)
    }

    if (params.ingest) {
      runIngest(plugin, params.ingest)
    }
  })

  // ── §4.5.2 Delete safety ──
  registerDeleteCommand(plugin)
  registerResetCommand(plugin)
  // §5.7.5 — §5.7.2 PoC commands cleaned up (Karpathy Simplicity, master 잠금).
  // 3 commands (`wikey-poc-orama-test`, `wikey-poc-kiwi-orama`, `wikey-poc-orama-benchmark`)
  // 제거 + wikey-obsidian deps (`kiwi-nlp`, `@orama/orama`) 제거.

  // §5.7.8 Spec 3 / AC-S4 — manual "Run query analysis" trigger. Pulls accumulated
  // (query, answer) pairs from chat history, calls the analyzer LLM, and appends
  // schema-compatible entries to `wikey-core/eval/benchmark-suite.json`. Fail-open.
  plugin.addCommand({
    id: 'wikey-run-query-analysis',
    name: 'Wikey: Run query analysis (auto-extend benchmark suite)',
    callback: () => {
      void plugin.runQueryAnalysis()
    },
  })

  // §5.18 Spec 3 I9 — diagnostic command for citation registry mismatch.
  plugin.addCommand({
    id: 'wikey-diagnose-citation-mismatches',
    name: 'Wikey: Diagnose citation mismatches',
    callback: () => {
      void runDiagnoseCitationMismatches(plugin)
    },
  })

  // §5.19 v0.4 (R9) — 3 maintenance commands (palette legacy/power-user entry;
  // primary UX is the Help panel "Wiki Maintenance" section). Each invokes
  // MaintenanceModal in the requested mode. Recovery was retired in v0.4 —
  // Check's Fix link multi-mode absorbs the dangling-sha cleanup path.
  registerMaintenanceCommands(plugin)
}

function registerMaintenanceCommands(plugin: WikeyPlugin): void {
  const modes: ReadonlyArray<{ id: string; name: string; mode: 'status' | 'check' | 'refactoring' }> = [
    { id: 'wikey-wiki-status', name: 'Wikey: Wiki status', mode: 'status' },
    { id: 'wikey-wiki-check', name: 'Wikey: Wiki check', mode: 'check' },
    { id: 'wikey-wiki-refactoring', name: 'Wikey: Wiki refactoring suggestions', mode: 'refactoring' },
  ]
  for (const { id, name, mode } of modes) {
    plugin.addCommand({
      id,
      name,
      callback: () => {
        // Lazy require — keeps the top-level import graph free of the modal module
        // until the user actually opens it. Runner factory is shared with the
        // Help panel entry (Finding 2 cycle #3 — palette command was previously
        // an inert modal without a runner, dropping validateWiki + abort signal).
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { MaintenanceModal } = require('./maintenance-modal') as typeof import('./maintenance-modal')
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { createMaintenanceRunner } = require('./maintenance-runner') as typeof import('./maintenance-runner')
        const runner = createMaintenanceRunner(plugin)
        new MaintenanceModal(plugin.app, plugin, { mode, runner }).open()
      },
    })
  }
}


// ─────────────────────────────────────────────────────────────
//  §4.5.2 — Delete source / wiki page (dry-run + typed-confirm)
// ─────────────────────────────────────────────────────────────

function registerDeleteCommand(plugin: WikeyPlugin): void {
  plugin.addCommand({
    id: 'delete-source',
    name: 'Wikey: Delete source (dry-run)',
    callback: () => {
      new DeleteSourceSuggestModal(plugin).open()
    },
  })

  plugin.addCommand({
    id: 'delete-wiki-page',
    name: 'Wikey: Delete wiki page (dry-run)',
    checkCallback: (checking) => {
      const file = plugin.app.workspace.getActiveFile()
      if (!file || !file.path.startsWith('wiki/')) return false
      if (checking) return true
      void promptWikiPageDelete(plugin, file.path)
      return true
    },
  })
}

async function promptSourceDelete(plugin: WikeyPlugin, sourcePath: string): Promise<void> {
  const registry = await loadRegistry(plugin.wikiFS)
  const impact = await computeDeletionImpact({
    wikiFS: plugin.wikiFS,
    registry,
    target: { kind: 'source', vault_path: sourcePath },
  })

  const shortId = impact.registryRecord?.id.slice(0, 23) ?? 'unknown'
  const confirmPhrase = `DEL ${shortId}`

  new DeleteImpactModal(plugin.app, {
    title: `Delete source: ${sourcePath}`,
    confirmPhrase,
    impact,
    onConfirm: async () => {
      const fs = require('node:fs') as typeof import('node:fs')
      const path = require('node:path') as typeof import('node:path')
      const basePath = getBasePath(plugin)

      // 1) Delete wiki ingested pages.
      for (const p of impact.pages) {
        const abs = path.join(basePath, p)
        try { fs.unlinkSync(abs) } catch (err: any) {
          if (err?.code !== 'ENOENT') throw err
        }
      }
      // 2) Delete sidecar + source file itself.
      const sidecar = impact.registryRecord?.record.sidecar_vault_path
      if (sidecar) {
        try { fs.unlinkSync(path.join(basePath, sidecar)) } catch (err: any) {
          if (err?.code !== 'ENOENT') throw err
        }
      }
      try { fs.unlinkSync(path.join(basePath, sourcePath)) } catch (err: any) {
        if (err?.code !== 'ENOENT') throw err
      }
      // 3) Tombstone the registry record.
      if (impact.registryRecord) {
        const next = registryRecordDelete(registry, impact.registryRecord.id)
        await saveRegistry(plugin.wikiFS, next)
      }
    },
  }).open()
}

async function promptWikiPageDelete(plugin: WikeyPlugin, pagePath: string): Promise<void> {
  const registry = await loadRegistry(plugin.wikiFS)
  const impact = await computeDeletionImpact({
    wikiFS: plugin.wikiFS,
    registry,
    target: { kind: 'wiki-page', page_path: pagePath },
  })

  const basename = pagePath.split('/').pop()!.replace(/\.md$/, '')
  const confirmPhrase = `DEL ${basename}`

  new DeleteImpactModal(plugin.app, {
    title: `Delete wiki page: ${pagePath}`,
    confirmPhrase,
    impact,
    onConfirm: async () => {
      const fs = require('node:fs') as typeof import('node:fs')
      const path = require('node:path') as typeof import('node:path')
      const abs = path.join(getBasePath(plugin), pagePath)
      try { fs.unlinkSync(abs) } catch (err: any) {
        if (err?.code !== 'ENOENT') throw err
      }
    },
  }).open()
}

class DeleteSourceSuggestModal extends FuzzySuggestModal<TFile> {
  constructor(private readonly plugin: WikeyPlugin) {
    super(plugin.app)
    this.setPlaceholder('Select a raw/ source to delete...')
  }

  getItems(): TFile[] {
    return this.plugin.app.vault
      .getFiles()
      .filter((f) => f.path.startsWith('raw/') && !f.path.endsWith('.md'))
  }

  getItemText(f: TFile): string {
    return f.path
  }

  onChooseItem(f: TFile): void {
    void promptSourceDelete(this.plugin, f.path)
  }
}

// ─────────────────────────────────────────────────────────────
//  §4.5.2 — Reset (5-way scope)
// ─────────────────────────────────────────────────────────────

function registerResetCommand(plugin: WikeyPlugin): void {
  const scopes: ReadonlyArray<{ id: string; name: string; scope: ResetScope }> = [
    { id: 'reset-wiki-registry', name: 'Wikey: Reset wiki + registry', scope: 'wiki+registry' },
    { id: 'reset-wiki-only', name: 'Wikey: Reset wiki only', scope: 'wiki-only' },
    { id: 'reset-registry-only', name: 'Wikey: Reset registry only', scope: 'registry-only' },
    { id: 'reset-qmd-index', name: 'Wikey: Reset qmd index', scope: 'qmd-index' },
    { id: 'reset-settings', name: 'Wikey: Reset settings (data.json)', scope: 'settings' },
  ]

  for (const s of scopes) {
    plugin.addCommand({
      id: s.id,
      name: s.name,
      callback: () => {
        void promptReset(plugin, s.scope)
      },
    })
  }
}

async function promptReset(plugin: WikeyPlugin, scope: ResetScope): Promise<void> {
  const preview = await previewReset({ wikiFS: plugin.wikiFS, scope })
  new ResetImpactModal(plugin.app, {
    scope,
    preview,
    onConfirm: async () => {
      await executeReset(plugin, scope, preview.files)
    },
  }).open()
}

export async function executeReset(
  plugin: WikeyPlugin,
  scope: ResetScope,
  files: readonly string[],
): Promise<void> {
  const fs = require('node:fs') as typeof import('node:fs')
  const path = require('node:path') as typeof import('node:path')
  const os = require('node:os') as typeof import('node:os')
  const basePath = getBasePath(plugin)

  switch (scope) {
    case 'wiki+registry':
    case 'wiki-only':
    case 'registry-only': {
      for (const p of files) {
        const abs = path.join(basePath, p)
        try { fs.unlinkSync(abs) } catch (err: any) {
          if (err?.code !== 'ENOENT') throw err
        }
      }
      if (scope === 'registry-only') {
        await plugin.wikiFS.write(REGISTRY_PATH, '{}')
      }
      return
    }
    case 'qmd-index': {
      const abs = path.join(os.homedir(), '.cache', 'qmd', 'index.sqlite')
      try { fs.unlinkSync(abs) } catch (err: any) {
        if (err?.code !== 'ENOENT') throw err
      }
      new Notice('qmd index deleted. Reindex will run automatically on next ingest/query.')
      return
    }
    case 'settings': {
      const abs = path.join(basePath, SETTINGS_MARKER)
      try { fs.unlinkSync(abs) } catch (err: any) {
        if (err?.code !== 'ENOENT') throw err
      }
      new Notice('Settings reset. Will restore DEFAULT_SETTINGS on Obsidian restart.')
      return
    }
  }
}

function getBasePath(plugin: WikeyPlugin): string {
  return (plugin.app.vault.adapter as any).basePath ?? ''
}

export interface IngestRunResult {
  success: boolean
  sourcePath: string
  createdPages: string[]
  error?: string
  cancelled?: boolean
}

export interface IngestRunOptions {
  /** Skip Stage 1 (brief + guide) — used for auto-ingest or batch mode after user opts out. */
  skipBriefModal?: boolean
  /** Bypass Stage 2 (preview) regardless of settings. Rarely used. */
  skipPreviewModal?: boolean
  /**
   * Auto-classify and move raw/0_inbox/ file to a PARA folder after successful ingest.
   * - audit panel: true (auto-classify via CLASSIFY.md + LLM fallback)
   * - inbox panel: false (moveBtn handles destination manually via user selection)
   */
  autoMoveFromInbox?: boolean
  // 주의: converter 선택 / 캐시 bypass 모두 사용자 UI 에서 제거됨.
  // 전처리 ~ ingest 가 자동 흐름이므로 사용자가 변환 결과 검토 후 재변환 판단할 틈 없음.
  // - converter 선택 → 자동 판정 (한국어 공백 소실·스캔 PDF 감지)
  // - 캐시 무효화 → 필요 시 ~/.cache/wikey/convert/ 직접 삭제
}

/**
 * §5.16 Spec 3 (B3) — sidebar 가 마운트된 경우 WikeyChatView instance 반환.
 * 사이드바 닫힘 / 다른 leaf 활성 시 null. triggerPanelRefresh 가 null-safe.
 */
function getWikeyChatView(plugin: WikeyPlugin): WikeyChatView | null {
  const leaves = plugin.app.workspace.getLeavesOfType(WIKEY_CHAT_VIEW)
  for (const leaf of leaves) {
    const view = leaf.view
    if (view instanceof WikeyChatView) return view
  }
  return null
}

export async function runIngest(
  plugin: WikeyPlugin,
  sourcePath: string,
  onProgress?: (step: number, total: number, message: string, subStep?: number, subTotal?: number) => void,
  runOpts?: IngestRunOptions,
): Promise<IngestRunResult> {
  try {
    const result = await runIngestInner(plugin, sourcePath, onProgress, runOpts)
    // §5.16 Spec 2 (B2) Invariant I6 — ingest *success* 직후 reconcile 1회.
    // success-gated (codex cycle #2 finding #1 closure): cancel/error 분기 (result.success=false)
    // 에서는 reconcile skip — cancel write-0 invariant (AC-C1.4) 보존 + spec wording 정합.
    // walker → registry hash 일치 시 case 4 restoreTombstone 자동 발화로 stale tombstone 즉시 복구.
    // failure 시 .catch WARN 만, 검색 영향 0 (fail-open).
    if (result.success) {
      await runReconcileAfterIngest(plugin).catch((err) =>
        console.warn('[Wikey] §5.16 B2 reconcileAfterIngest failed:', err),
      )
    }
    return result
  } finally {
    // §5.16 Spec 3 (B3) Invariant I9 — success / error / cancel 분기 모두에서 panel
    // 자동 refresh. try/finally 로 단일 entry point 보장 (DRY). null-safe (사이드바 닫힘 OK).
    triggerPanelRefresh(getWikeyChatView(plugin))
  }
}

/**
 * §5.16 Spec 2 (B2) Invariant I6 — ingest 직후 registry reconcile.
 *
 * walker = vault.getFiles() raw/ scope + 50MB cap (main.ts:runStartupReconcile mirror).
 * `reconcileAfterIngest` 가 case 4 restoreTombstone + case 2 recordMove 적용 후 변경된
 * registry 와 restoredIds 반환. 변경된 경우만 saveRegistry (no-op write 회피).
 *
 * I7 idempotent — 2회 연속 호출 시 두 번째 restoredIds=[].
 */
async function runReconcileAfterIngest(plugin: WikeyPlugin): Promise<void> {
  const MAX_BYTES = 50 * 1024 * 1024
  const reg = await loadRegistry(plugin.wikiFS)
  if (Object.keys(reg).length === 0) return
  const walker = async () => {
    const out: Array<{ vault_path: string; bytes: Uint8Array }> = []
    const files = plugin.app.vault.getFiles()
    for (const f of files) {
      if (!f.path.startsWith('raw/')) continue
      if (f.stat && f.stat.size > MAX_BYTES) continue
      try {
        const buf = await plugin.app.vault.readBinary(f)
        out.push({ vault_path: f.path, bytes: new Uint8Array(buf) })
      } catch (err) {
        console.warn('[Wikey] §5.16 B2 reconcile readBinary failed:', f.path, err)
      }
    }
    return out
  }
  const { registry, restoredIds } = await reconcileAfterIngest(reg, walker)
  if (registry !== reg) {
    await saveRegistry(plugin.wikiFS, registry)
    if (restoredIds.length > 0) {
      console.info(
        `[Wikey] §5.16 B2 reconcileAfterIngest restored=${restoredIds.length} ids=${restoredIds.slice(0, 3).join(',')}${restoredIds.length > 3 ? '...' : ''}`,
      )
    }
  }
}

async function runIngestInner(
  plugin: WikeyPlugin,
  sourcePath: string,
  onProgress?: (step: number, total: number, message: string, subStep?: number, subTotal?: number) => void,
  runOpts?: IngestRunOptions,
): Promise<IngestRunResult> {
  const basePath = (plugin.app.vault.adapter as any).basePath ?? ''

  // §5.15.D: ingest 진입 시 raw 파일명 wikilink-safe normalize. raw 파일 자체를 vault rename
  //   → disk 와 wikilink target 일관 보장. wikilink-unsafe character (`|` `[` `]` `#` `^` `\`
  //   + Unicode 특수문자 등) 포함 시 sanitize 결과로 rename. 사용자 통찰: blacklist 가 아닌
  //   whitelist (`wikilink-safe.ts`) 라 향후 reserved char 자동 cover.
  sourcePath = await sanitizeRawFilenameIfNeeded(plugin, sourcePath)

  const briefMode = plugin.settings.ingestBriefs
  const shouldShowFlow = !runOpts?.skipBriefModal
    && briefMode !== 'never'
    && !plugin.skipIngestBriefsThisSession

  // ── Fast path: no modal (auto-ingest or "never" mode) ──
  if (!shouldShowFlow) {
    return await runIngestCore(plugin, sourcePath, basePath, {
      guideHint: undefined,
      planGate: undefined,
      onProgress,
      autoMoveFromInbox: runOpts?.autoMoveFromInbox,
    })
  }

  // ── Stay-involved flow: unified modal (converting → brief → processing → preview) ──
  // Phase 5 §5.10.1.3 AC-C1.3: conversion 1 회 보장. modal.open() 직후 단일 변환 entry
  // (`convertSourceToMarkdown`) 호출 → brief + ingest 가 동일 결과 공유.
  // §5.10.3.10 옵션 C: stepper 4 단계 (Converting / Brief / Processing / Preview) — 변환 단계 시각화.
  // Cancel 시 vault write 0 invariant (AC-C1.4): runIngestCore 호출 안 함. cache 만 ephemeral 보존.
  const modal = new IngestFlowModal(plugin.app, sourcePath, '', plugin.settings.verifyIngestResults)
  modal.open()

  const sourceFilename = sourcePath.split('/').pop() ?? sourcePath
  const ext = sourceFilename.toLowerCase().split('.').pop() ?? ''
  // md/txt 도 stepper 표시는 동일 4 단계. message 만 분기 ("Reading source" vs "Converting source").
  const convertingMsg = ext === 'md' || ext === 'txt' ? 'Reading source...' : `Converting ${ext.toUpperCase()} → markdown...`
  modal.showConverting(convertingMsg)
  onProgress?.(1, 4, convertingMsg)

  let conversionResult: ConversionResult
  try {
    conversionResult = await convertSourceToMarkdown(sourcePath, ext, {
      basePath,
      execEnv: plugin.getExecEnv(),
      config: plugin.buildConfig(),
      wikiFS: plugin.wikiFS,
    })
  } catch (err) {
    const errMsg = `Conversion failed: ${(err as Error)?.message ?? err}`
    console.error(`[Wikey ingest] conversion failed for ${sourcePath}:`, errMsg, (err as Error)?.stack ?? '')
    modal.showBrief()
    modal.setBrief(`(${errMsg})`)
    await modal.awaitBrief()
    modal.dispose()
    return { success: false, sourcePath, createdPages: [], error: errMsg }
  }

  modal.showBrief()
  onProgress?.(2, 4, 'Generating brief...')
  generateBrief(
    conversionResult.content,
    sourceFilename,
    plugin.buildConfig(),
    plugin.httpClient,
    {
      basePath,
      // Phase 5 §5.8: brief 도 ingest 와 동일 PII 정책.
      piiGuardEnabled: plugin.settings.piiGuardEnabled,
    },
  )
    .then((b) => modal.setBrief(b))
    .catch((err) => modal.setBrief(`(Brief generation failed: ${err?.message ?? err})`))

  // Brief → Processing → (optional Preview) loop. Back from Processing returns to Brief.
  while (true) {
    const briefOutcome = await modal.awaitBrief()
    if (briefOutcome.action === 'cancel') {
      // AC-C1.4: Cancel 시 vault write 0 invariant — runIngestCore 호출 안 함.
      // conversionResult 는 휘발 (cache 는 ~/.cache/wikey/convert/ ephemeral 보존, 30일 TTL).
      modal.dispose()
      return { success: false, sourcePath, createdPages: [], cancelled: true }
    }
    if (briefOutcome.action === 'skip-session') {
      plugin.skipIngestBriefsThisSession = true
    }

    modal.showProcessing('Extracting with LLM...')

    const planGate = briefOutcome.verifyResults
      ? async (plan: IngestPlan): Promise<boolean> => {
          return await modal.awaitPreview(plan)
        }
      : undefined

    const result = await runIngestCore(plugin, sourcePath, basePath, {
      guideHint: briefOutcome.guideHint || undefined,
      planGate,
      onProgress: (step, total, message, subStep, subTotal) => {
        modal.updateProgress(step, total, message, subStep, subTotal)
        onProgress?.(step, total, message, subStep, subTotal)
      },
      autoMoveFromInbox: runOpts?.autoMoveFromInbox,
      preconverted: conversionResult,
    })

    // If user hit [Back] during processing, the modal already flipped back to Brief.
    // Discard this in-flight result and loop around for a new guide.
    if (modal.backRequested) {
      console.info('[Wikey ingest] user pressed Back — discarding result, returning to Brief')
      continue
    }

    modal.finish()
    return result
  }
}

// ── Internal: core pipeline invocation (shared by modal & auto paths) ──
async function runIngestCore(
  plugin: WikeyPlugin,
  sourcePath: string,
  basePath: string,
  ctx: {
    guideHint: string | undefined
    planGate: ((plan: IngestPlan) => Promise<boolean>) | undefined
    onProgress?: (step: number, total: number, message: string, subStep?: number, subTotal?: number) => void
    autoMoveFromInbox?: boolean
    forceReingest?: boolean
    onConflict?: (info: ConflictInfo) => Promise<ConflictChoice>
    // Phase 5 §5.10.1.5 AC-C1.5: brief 단계에서 이미 변환된 결과를 ingest 에 전달.
    // ingest() 가 Step 1 conversion 재호출 skip → cache hit (1 회) 도 회피.
    preconverted?: ConversionResult
  },
): Promise<IngestRunResult> {
  // §5.3.1/§5.3.2 (plan v11 P2-3): default ConflictModal injection — silent auto-protect
  // is never the default GUI experience; caller can override via ctx.onConflict.
  const defaultConflict = (info: ConflictInfo): Promise<ConflictChoice> =>
    new Promise((resolve) => new ConflictModal(plugin.app, info, resolve).open())
  const onConflict = ctx.onConflict ?? defaultConflict
  try {
    const result = await ingest(
      sourcePath,
      plugin.wikiFS,
      plugin.buildConfig(),
      plugin.httpClient,
      (progress) => ctx.onProgress?.(progress.step, progress.total, progress.message, progress.subStep, progress.subTotal),
      {
        basePath,
        execEnv: plugin.getExecEnv(),
        guideHint: ctx.guideHint,
        onPlanReady: ctx.planGate,
        // §5.3.1/§5.3.2 — incremental reingest options.
        forceReingest: ctx.forceReingest,
        onConflict,
        // Phase 5 §5.10.1.5 AC-C1.5: brief 가 미리 변환했으면 재변환 skip.
        preconverted: ctx.preconverted,
        // Phase 4 D.0.c — PII 2-layer gate (settings 에서 제어).
        piiGuardEnabled: plugin.settings.piiGuardEnabled,
        allowPiiIngest: plugin.settings.allowPiiIngest,
        piiRedactionMode: plugin.settings.piiRedactionMode,
        // Phase 4 D.0.f follow-up (codex P2): user-visible Notice on reindex/freshness issue
        // (plan v6 §4.4.6 — 사용자가 stale 상태를 인지해야 한다).
        // §5.2.9: better-sqlite3 ABI mismatch (`ERR_DLOPEN_FAILED` / `NODE_MODULE_VERSION`)
        // detection — user 가 nvm node 로 처음 install 했고 plugin 이 system node 를 쓰면
        // 발생. specific 해결 명령 안내.
        onFreshnessIssue: (reason, message) => {
          const isAbiMismatch = /NODE_MODULE_VERSION|ERR_DLOPEN_FAILED/.test(message)
          if (isAbiMismatch) {
            new Notice(
              `qmd native module ABI mismatch — run the following in terminal and retry:\n` +
              `  bash ./scripts/rebuild-qmd-deps.sh`,
              12000,
            )
            return
          }
          const label = reason === 'reindex-failed' ? 'Indexing failed' : 'Index refresh delayed'
          new Notice(`${label} — search available shortly (${message.slice(0, 80)})`, 6000)
        },
        // §5.2.5: silent-fail 자체 제거 — 성공 시도 항상 짧은 Notice. 사용자가 reindex 가
        // 실제 호출됐는지 가시 확증.
        onFreshnessOk: (ms) => {
          new Notice(`✓ Search index up to date (${(ms / 1000).toFixed(1)}s)`, 2000)
        },
      },
    )

    // §5.3.1/§5.3.2 — type guard for skip branches: SkippedIngestResult has no LLM output.
    if ('skipped' in result) {
      const skipped = result as SkippedIngestResult
      const labels: Record<SkippedIngestResult['skipReason'], string> = {
        'hash-match': 'Already ingested (no change)',
        'hash-match-sidecar-seed': 'Sidecar baseline updated (no LLM call)',
        'hash-match-sidecar-edit-noted': 'User sidecar edits preserved (raw unchanged)',
        'duplicate-hash-other-path': `Duplicate detected — same hash at ${skipped.duplicateOfId ?? 'another path'}`,
      }
      new Notice(`Wikey: ${labels[skipped.skipReason]}`, 4000)
      console.info(
        `[Wikey ingest] skip — reason=${skipped.skipReason} sourceId=${skipped.sourceId}`,
      )
      // skip branches do NOT call saveIngestMap, classify, movePair, or autoMove.
      return { success: true, sourcePath, createdPages: [] }
    }

    const createdPages = [
      result.sourcePage.filename,
      ...result.entities.map((e) => e.filename),
      ...result.concepts.map((c) => c.filename),
    ]

    saveIngestMap(basePath, sourcePath, result.sourcePage.filename)

    // Auto-classify + move: audit panel uses this path; raw/0_inbox/ file is
    // routed to the correct PARA folder via CLASSIFY.md rules + LLM fallback.
    // Inbox panel's moveBtn manages destination manually (user-selected PARA)
    // and passes autoMoveFromInbox=false to skip this branch.
    let finalSourcePath = sourcePath
    if (ctx.autoMoveFromInbox && sourcePath.startsWith('raw/0_inbox/')) {
      try {
        const { basename, join } = require('node:path') as typeof import('node:path')
        const filename = basename(sourcePath)
        const classifyResult = await classifyFileAsync(filename, false, {
          wikiFS: plugin.wikiFS,
          httpClient: plugin.httpClient,
          config: plugin.buildConfig(),
        })
        if (classifyResult.destination) {
          // §4.2 S2-3: movePair — original + sidecar 가 한 쌍으로 이동 + registry 갱신 + frontmatter rewrite.
          const result = await movePair({
            basePath,
            sourceVaultPath: sourcePath,
            destDir: classifyResult.destination,
            wikiFS: plugin.wikiFS,
            renameGuard: plugin.renameGuard,
          })
          const newSourcePath = join(classifyResult.destination, filename)
          finalSourcePath = newSourcePath
          console.info(
            `[Wikey ingest] auto-moved to PARA: ${sourcePath} → ${newSourcePath} (${classifyResult.hint}) sidecar=${result.movedSidecar}${result.sidecarSkipReason ? ` [${result.sidecarSkipReason}]` : ''}`,
          )
          // §5.2.5: movePair rewrote frontmatter on wiki/sources/source-*.md
          // (vault_path/sidecar_vault_path patch). Without re-reindex the next
          // --check would report stale because that source page mtime > STAMP_FILE
          // (set by the reindex inside ingest()). Touch STAMP again so freshness
          // gate is consistent.
          try {
            await reindexQuick(basePath, plugin.getExecEnv())
          } catch (err: any) {
            console.warn(`[Wikey ingest] post-movePair reindex failed (non-fatal): ${err?.message ?? err}`)
          }
        } else {
          console.info(`[Wikey ingest] auto-move skipped (classify returned no destination): ${sourcePath}`)
        }
      } catch (err: any) {
        console.warn(`[Wikey ingest] auto-move failed (staying in inbox): ${err?.message ?? err}`)
      }
    }

    return { success: true, sourcePath: finalSourcePath, createdPages }
  } catch (err: any) {
    if (err instanceof PlanRejectedError) {
      console.info(`[Wikey ingest] cancelled at preview: ${sourcePath}`)
      return { success: false, sourcePath, createdPages: [], cancelled: true }
    }
    if (err instanceof IngestCancelledByUserError) {
      console.info(`[Wikey ingest] cancelled at conflict modal: ${sourcePath}`)
      new Notice('Ingest cancelled (conflict modal)', 3000)
      return { success: false, sourcePath, createdPages: [], cancelled: true }
    }
    if (err instanceof PiiIngestBlockedError) {
      // Phase 4 D.0.c — PII 감지 + allowPiiIngest=false 조합. 사용자가 설정에서 허용해야 진행.
      const kinds = Array.from(new Set(err.matches.map((m) => m.kind))).join(', ')
      const msg = `PII detected — ${err.matches.length} items (${kinds}). Enable "Proceed on PII detection" in settings, or clean up the source.`
      console.warn(`[Wikey ingest] blocked by PII gate: ${sourcePath} — ${err.matches.length} matches`)
      new Notice(msg, 8000)
      return { success: false, sourcePath, createdPages: [], error: msg }
    }
    const msg = err?.message ?? String(err)
    console.error(`[Wikey ingest] failed for ${sourcePath}:`, msg, err?.stack ?? '')
    return { success: false, sourcePath, createdPages: [], error: msg }
  }
}

// §4.2.4 S4-4: path-based API 는 Phase 5 §5.3 에서 완전 제거.
// 현재 wikey-core 는 source-registry (hash 기반) 로 이관 완료, .ingest-map.json 은
// 남아있는 legacy 호환 필드. 1회만 경고 후 조용히 유지.
let _ingestMapWarnOnce = false
function saveIngestMap(basePath: string, rawPath: string, sourceFilename: string): void {
  if (!_ingestMapWarnOnce) {
    console.warn(
      '[Wikey deprecated] .ingest-map.json path-based API — use source-registry. Slated for removal in Phase 5 §5.3.',
    )
    _ingestMapWarnOnce = true
  }
  const { join } = require('node:path') as typeof import('node:path')
  const { readFileSync, writeFileSync } = require('node:fs') as typeof import('node:fs')
  const mapPath = join(basePath, 'wiki/.ingest-map.json')

  let map: Record<string, string> = {}
  try {
    map = JSON.parse(readFileSync(mapPath, 'utf-8'))
  } catch {
    // 파일 없으면 빈 맵
  }

  map[normalizeRawPath(rawPath)] = sourceFilename
  writeFileSync(mapPath, JSON.stringify(map, null, 2), 'utf-8')
}

/** Move an ingest-map entry from its pre-move path to the post-move path (called after moveFile to PARA). */
export function updateIngestMapPath(basePath: string, oldRawPath: string, newRawPath: string): void {
  const { join } = require('node:path') as typeof import('node:path')
  const { readFileSync, writeFileSync } = require('node:fs') as typeof import('node:fs')
  const mapPath = join(basePath, 'wiki/.ingest-map.json')

  let map: Record<string, string> = {}
  try {
    map = JSON.parse(readFileSync(mapPath, 'utf-8'))
  } catch {
    return
  }

  const oldKey = normalizeRawPath(oldRawPath)
  const newKey = normalizeRawPath(newRawPath)
  const value = map[oldKey]
  if (!value) return

  delete map[oldKey]
  map[newKey] = value
  writeFileSync(mapPath, JSON.stringify(map, null, 2), 'utf-8')
}

/** Collapse duplicate slashes (`a//b` → `a/b`) so audit-ingest.py exact-match keys work. */
function normalizeRawPath(p: string): string {
  return p.replace(/\/{2,}/g, '/')
}

export class IngestFileSuggestModal extends FuzzySuggestModal<TFile> {
  constructor(private readonly plugin: WikeyPlugin) {
    super(plugin.app)
    this.setPlaceholder('Select a file to ingest...')
  }

  getItems(): TFile[] {
    // §5.10.3.10 옵션 C: md 외 모든 ingest 가능 file 포함 (HWP/PDF/DOCX/PPTX/XLSX/HTML/HWPX 등).
    // wiki/ + .obsidian/ + .wikey/ 같은 system 영역은 제외.
    return this.plugin.app.vault.getFiles().filter(
      (f) => !f.path.startsWith('wiki/') && !f.path.startsWith('.'),
    )
  }

  getItemText(file: TFile): string {
    return file.path
  }

  onChooseItem(file: TFile): void {
    runIngest(this.plugin, file.path)
  }
}

/**
 * §5.15.D — Wikilink-safe vault rename (whitelist 정책).
 *
 * raw 파일명에 wikilink-unsafe character (`|` `[` `]` `#` `^` `\` + Unicode 특수문자
 * 등) 가 포함되면 `sanitizeWikilinkTarget` 결과로 *vault rename*. disk 와 wikilink
 * target 일관 → Obsidian basename matcher + validate-wiki.sh 정합 보장.
 *
 * `sourcePath` 의 dirname 보존, basename 만 sanitize. rename 충돌 시 `-N` suffix.
 * rename 발생 시 사용자 Notice + 신 path 반환. unsafe char 없으면 no-op.
 */
async function sanitizeRawFilenameIfNeeded(
  plugin: WikeyPlugin,
  sourcePath: string,
): Promise<string> {
  const filename = sourcePath.includes('/') ? sourcePath.split('/').pop()! : sourcePath
  if (!needsWikilinkSanitize(filename)) return sourcePath

  const dir = sourcePath.includes('/') ? sourcePath.slice(0, sourcePath.lastIndexOf('/')) : ''
  const safe = sanitizeWikilinkTarget(filename)
  if (!safe || safe === filename) return sourcePath

  // 충돌 회피: <safe>, <safe>-1, <safe>-2 ... (확장자 보존)
  const dotIdx = safe.lastIndexOf('.')
  const stem = dotIdx > 0 ? safe.slice(0, dotIdx) : safe
  const ext = dotIdx > 0 ? safe.slice(dotIdx) : ''
  let candidate = safe
  let suffix = 0
  while (await plugin.app.vault.adapter.exists(dir ? `${dir}/${candidate}` : candidate)) {
    suffix += 1
    candidate = `${stem}-${suffix}${ext}`
    if (suffix > 99) break // 안전망
  }
  const newPath = dir ? `${dir}/${candidate}` : candidate

  const file = plugin.app.vault.getAbstractFileByPath(sourcePath)
  if (!file || !(file instanceof TFile)) return sourcePath
  try {
    plugin.renameGuard?.register(newPath) // movePair 와 동일 패턴 — 자체 rename 이벤트 skip
    await plugin.app.fileManager.renameFile(file, newPath)
    new Notice(
      `Wikey: filename normalized to wikilink-safe — ${filename} → ${candidate}`,
      6000,
    )
    console.info(`[Wikey ingest] §5.15.D rename — ${sourcePath} → ${newPath}`)
    return newPath
  } catch (err) {
    console.warn(`[Wikey ingest] §5.15.D rename failed (continuing with original):`, err)
    return sourcePath
  }
}

// ─────────────────────────────────────────────────────────────
//  §5.18 Spec 3 — Citation registry mismatch diagnostic
// ─────────────────────────────────────────────────────────────

export interface MismatchScanResult {
  /** Unique sourceId 총수 (frontmatter provenance.ref 추출 후 dedup). */
  totalSourceIds: number
  /** Registry 누락 / tombstoned sourceId 수. */
  mismatchCount: number
  /** Mismatch sourceId 가 영향 주는 wiki page 총수 (unique). */
  affectedPageCount: number
  /** Per-mismatch 상세: sourceId + 영향 page list (정렬). */
  mismatches: Array<{ sourceId: string; pages: string[] }>
}

/**
 * 각 wiki page frontmatter 의 `provenance.ref` (또는 `sources/<id>`) 에서 sourceId 를
 * 추출 → registry active set 과 cross-check → mismatch sourceId 별 영향 page list 도출.
 *
 * - Pure 함수 (I/O X) — input map 으로 page content / registry 받음.
 * - registry 의 tombstone=true 도 mismatch 로 간주 (active 만 valid).
 */
export function scanCitationMismatches(
  pageContents: Map<string, string>,
  registry: SourceRegistry,
): MismatchScanResult {
  const activeIds = new Set<string>()
  for (const [id, record] of Object.entries(registry)) {
    if (!record.tombstone) activeIds.add(id)
  }
  // sourceId → set of page paths
  const sourceIdToPages = new Map<string, Set<string>>()
  const REF_RE = /(?:^|[\s/'"])sources\/(sha256:[A-Za-z0-9]+)/g
  for (const [pagePath, content] of pageContents.entries()) {
    const fmEnd = content.indexOf('\n---', 4)
    const frontmatter = content.startsWith('---\n') && fmEnd > 0 ? content.slice(0, fmEnd) : content
    REF_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = REF_RE.exec(frontmatter)) !== null) {
      const sourceId = m[1]
      let pages = sourceIdToPages.get(sourceId)
      if (!pages) {
        pages = new Set<string>()
        sourceIdToPages.set(sourceId, pages)
      }
      pages.add(pagePath)
    }
  }
  const mismatches: Array<{ sourceId: string; pages: string[] }> = []
  const affectedPages = new Set<string>()
  for (const [sourceId, pages] of sourceIdToPages.entries()) {
    if (!activeIds.has(sourceId)) {
      const pageList = Array.from(pages).sort()
      mismatches.push({ sourceId, pages: pageList })
      for (const p of pageList) affectedPages.add(p)
    }
  }
  mismatches.sort((a, b) => a.sourceId.localeCompare(b.sourceId))
  return {
    totalSourceIds: sourceIdToPages.size,
    mismatchCount: mismatches.length,
    affectedPageCount: affectedPages.size,
    mismatches,
  }
}

const MISMATCH_PAGE_DISPLAY_LIMIT = 10

/**
 * Modal: registry mismatch 진단 결과 표시.
 *
 * Layout: title + summary line + per-mismatch block (sourceId + page list ≤ 10 + 더보기 hint).
 * 기존 `WikeyStatsModal` (status-bar.ts) 패턴과 정합.
 */
export class MismatchDiagnosticModal extends Modal {
  private readonly scanResult: MismatchScanResult

  constructor(app: App, scanResult: MismatchScanResult) {
    super(app)
    this.scanResult = scanResult
  }

  onOpen(): void {
    const { contentEl, titleEl } = this
    titleEl.setText('Citation Registry Diagnostic')
    const { totalSourceIds, mismatchCount, affectedPageCount, mismatches } = this.scanResult
    contentEl.createEl('p', {
      text: `${mismatchCount} mismatch / ${totalSourceIds} sourceIds, ${affectedPageCount} pages affected`,
    })
    if (mismatches.length === 0) {
      contentEl.createEl('p', { text: 'All sourceIds are registered in the registry.' })
      return
    }
    for (const entry of mismatches) {
      const block = contentEl.createEl('div', { cls: 'wikey-mismatch-block' })
      // §5.18 Spec 3 I9b — sourceId 단축 (앞 24 자) 표시.
      block.createEl('h3', { text: entry.sourceId.slice(0, 24) })
      const head = entry.pages.slice(0, MISMATCH_PAGE_DISPLAY_LIMIT)
      const list = block.createEl('ul')
      for (const p of head) list.createEl('li', { text: p })
      if (entry.pages.length > MISMATCH_PAGE_DISPLAY_LIMIT) {
        block.createEl('p', {
          text: `... (${entry.pages.length} total, see Console for the full list)`,
        })
      }
    }
  }

  onClose(): void {
    this.contentEl.empty()
  }
}

async function runDiagnoseCitationMismatches(plugin: WikeyPlugin): Promise<void> {
  const registry = await loadRegistry(plugin.wikiFS).catch(() => ({} as SourceRegistry))
  const pageContents = new Map<string, string>()
  const mdFiles = plugin.app.vault.getMarkdownFiles().filter((f) => f.path.startsWith('wiki/'))
  for (const file of mdFiles) {
    try {
      const content = await plugin.app.vault.read(file)
      pageContents.set(file.path, content)
    } catch {
      // skip unreadable
    }
  }
  const scanResult = scanCitationMismatches(pageContents, registry)
  new MismatchDiagnosticModal(plugin.app, scanResult).open()
}
