import { FuzzySuggestModal, Notice, TFile } from 'obsidian'
import type WikeyPlugin from './main'
import { generateBrief, ingest, PlanRejectedError, type IngestPlan, classifyFileAsync, moveFile } from 'wikey-core'
import { WIKEY_CHAT_VIEW } from './sidebar-chat'
import { IngestFlowModal } from './ingest-modals'

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
      runIngest(plugin, file.path, (s, t, m) => new Notice(`${s}/${t} ${m}`)).then((r) => {
        if (r.success) new Notice(`인제스트 완료: ${r.createdPages.length}개 페이지`)
        else new Notice(`인제스트 실패: ${r.error}`)
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
}

export async function runIngest(
  plugin: WikeyPlugin,
  sourcePath: string,
  onProgress?: (step: number, total: number, message: string, subStep?: number, subTotal?: number) => void,
  runOpts?: IngestRunOptions,
): Promise<IngestRunResult> {
  const basePath = (plugin.app.vault.adapter as any).basePath ?? ''
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

  // ── Stay-involved flow: unified modal (brief → processing → preview) ──
  // Open the modal immediately with a loading state, then fetch the brief
  // asynchronously so the user sees *something* within ~200ms instead of
  // staring at a blank screen while Ollama spins up (10~30s).
  const modal = new IngestFlowModal(plugin.app, sourcePath, '', plugin.settings.verifyIngestResults)
  modal.open()

  onProgress?.(1, 4, 'Generating brief...')
  generateBrief(
    sourcePath,
    plugin.wikiFS,
    plugin.buildConfig(),
    plugin.httpClient,
    { basePath, execEnv: plugin.getExecEnv() },
  )
    .then((b) => modal.setBrief(b))
    .catch((err) => modal.setBrief(`(brief 생성 실패: ${err?.message ?? err})`))

  // Brief → Processing → (optional Preview) loop. Back from Processing returns to Brief.
  while (true) {
    const briefOutcome = await modal.awaitBrief()
    if (briefOutcome.action === 'cancel') {
      modal.close()
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
  },
): Promise<IngestRunResult> {
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
      },
    )

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
          moveFile(basePath, sourcePath, classifyResult.destination)
          const newSourcePath = join(classifyResult.destination, filename)
          updateIngestMapPath(basePath, sourcePath, newSourcePath)
          finalSourcePath = newSourcePath
          console.info(`[Wikey ingest] auto-moved to PARA: ${sourcePath} → ${newSourcePath} (${classifyResult.hint})`)
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
    const msg = err?.message ?? String(err)
    console.error(`[Wikey ingest] failed for ${sourcePath}:`, msg, err?.stack ?? '')
    return { success: false, sourcePath, createdPages: [], error: msg }
  }
}

function saveIngestMap(basePath: string, rawPath: string, sourceFilename: string): void {
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
    this.setPlaceholder('인제스트할 파일을 선택하세요...')
  }

  getItems(): TFile[] {
    return this.plugin.app.vault.getMarkdownFiles().filter(
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
