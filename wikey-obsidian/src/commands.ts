import { FuzzySuggestModal, Notice, TFile } from 'obsidian'
import type WikeyPlugin from './main'
import {
  generateBrief,
  ingest,
  PlanRejectedError,
  PiiIngestBlockedError,
  type IngestPlan,
  classifyFileAsync,
  movePair,
  loadRegistry,
  saveRegistry,
  registryRecordDelete,
  computeDeletionImpact,
  previewReset,
  REGISTRY_PATH,
  QMD_INDEX_MARKER,
  SETTINGS_MARKER,
  type ResetScope,
  reindexQuick,
} from 'wikey-core'
import { WIKEY_CHAT_VIEW } from './sidebar-chat'
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

  // ── §4.5.2 Delete safety ──
  registerDeleteCommand(plugin)
  registerResetCommand(plugin)
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
    this.setPlaceholder('삭제할 raw/ 소스를 선택하세요...')
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
      new Notice('qmd 인덱스 삭제됨. 다음 인제스트/쿼리 시 reindex 자동 실행됨.')
      return
    }
    case 'settings': {
      const abs = path.join(basePath, SETTINGS_MARKER)
      try { fs.unlinkSync(abs) } catch (err: any) {
        if (err?.code !== 'ENOENT') throw err
      }
      new Notice('설정 초기화됨. Obsidian 재시작 시 DEFAULT_SETTINGS 로 복원됨.')
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
    {
      basePath,
      execEnv: plugin.getExecEnv(),
      // Phase 5 §5.8: brief 도 ingest 와 동일 PII 정책.
      piiGuardEnabled: plugin.settings.piiGuardEnabled,
    },
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
              `qmd 네이티브 모듈 ABI 불일치 — 터미널에서 다음 실행 후 재시도:\n` +
              `  bash ./scripts/rebuild-qmd-deps.sh`,
              12000,
            )
            return
          }
          const label = reason === 'reindex-failed' ? '인덱싱 실패' : '인덱스 갱신 지연'
          new Notice(`${label} — 잠시 후 검색 가능 (${message.slice(0, 80)})`, 6000)
        },
        // §5.2.5: silent-fail 자체 제거 — 성공 시도 항상 짧은 Notice. 사용자가 reindex 가
        // 실제 호출됐는지 가시 확증.
        onFreshnessOk: (ms) => {
          new Notice(`✓ 검색 인덱스 최신 (${(ms / 1000).toFixed(1)}s)`, 2000)
        },
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
    if (err instanceof PiiIngestBlockedError) {
      // Phase 4 D.0.c — PII 감지 + allowPiiIngest=false 조합. 사용자가 설정에서 허용해야 진행.
      const kinds = Array.from(new Set(err.matches.map((m) => m.kind))).join(', ')
      const msg = `PII 감지 — ${err.matches.length}건 (${kinds}). 설정에서 "PII 감지 시 인제스트 진행" 을 켜거나 원본을 정리해 주세요.`
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
