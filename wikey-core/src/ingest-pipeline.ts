import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type {
  HttpClient,
  IngestPlan,
  IngestPlanGate,
  IngestProgressCallback,
  IngestResult,
  WikiFS,
  WikiPage,
  WikeyConfig,
} from './types.js'
import { LLMClient } from './llm-client.js'
import { resolveProvider } from './config.js'
import {
  createPage,
  updateIndex,
  appendLog,
  normalizeBase,
  injectSourceFrontmatter,
  injectProvenance,
  stripBrokenWikilinks,
  type WrittenPage,
  type SourceFrontmatter,
} from './wiki-ops.js'
import { computeFileId, computeFullHash, sidecarVaultPath } from './uri.js'
import {
  loadRegistry,
  saveRegistry,
  upsert as registryUpsert,
  findById as registryFindById,
  appendPendingProtection,
  appendDuplicateLocation,
  REGISTRY_PATH,
  type SourceRecord,
  type SourceRegistry,
  type ReingestAction,
} from './source-registry.js'
import {
  decideReingest,
  protectSidecarTargetPath,
  computeSidecarHash,
  extractUserMarkers,
  mergeUserMarkers,
  IngestProtectionPathExhaustedError,
  type ReingestDecision,
  type ConflictInfo,
} from './incremental-reingest.js'
import { canonicalize, applyCeilingCap, type ProposalForCeiling } from './canonicalizer.js'
import { loadUserAliases } from './schema.js'
import {
  applyMentionGuard,
  filterBasenameCollisions,
  preFilterMentionsByOccurrence,
  type MentionGuardLogEntry,
} from './wiki/mention-guard.js'
import { loadPromotionThreshold, loadPromotionConfig } from './promotion-config.js'
import {
  EXAMPLE_ORG_BASE, EXAMPLE_PRODUCT_BASE, EXAMPLE_CONCEPT_ALIAS,
} from './example-placeholders.js'
import type { Mention, EntityType, ConceptType } from './types.js'
import { PROVIDER_VISION_DEFAULTS } from './provider-defaults.js'
import { stripEmbeddedImages, countEmbeddedImages } from './rag-preprocess.js'
import { computeCacheKey, getCached, setCached } from './convert-cache.js'
import {
  scoreConvertOutput,
  hasKoreanRegression,
  hasBodyRegression,
  countKoreanChars,
  koreanLongTokenRatio,
  isLikelyScanPdf,
  bodyCharsPerPage,
  hasRedundantEmbeddedImages,
} from './convert-quality.js'
import { selectRoute } from './provider-defaults.js'
import {
  buildSectionIndex, computeHeuristicPriority, formatPeerContext, formatSourceTOC,
  type Section, type SectionIndex,
} from './section-index.js'
import { applyPiiGate, sanitizeForLlmPrompt, loadPiiPatterns } from './pii-redact.js'
import { reindexQuick, waitUntilFresh } from './scripts-runner.js'
import * as path from 'node:path'
import * as fsSync from 'node:fs'

const execFileAsync = promisify(execFile)

/**
 * §5.14 Layer 6: count `.md` files under wiki/ for `expectMinIndexed` gate.
 * waitUntilFresh 가 빈 collection silent-fresh 회귀 detect 하도록 caller (runReindexAndWait) 가 전달.
 * 실패 (wiki dir 없음 / 권한 등) 시 0 반환 — fallback = 기존 동작 유지.
 */
function countWikiMdFiles(cwd: string): number {
  const wikiDir = path.join(cwd, 'wiki')
  if (!fsSync.existsSync(wikiDir)) return 0
  let count = 0
  const stack: string[] = [wikiDir]
  while (stack.length > 0) {
    const dir = stack.pop()!
    let entries: fsSync.Dirent[]
    try {
      entries = fsSync.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        count++
      }
    }
  }
  return count
}

const MAX_JSON_RETRIES = 2

// Docling 이 처리하는 PDF 외 포맷 (pdf 는 extractPdfText 로 별도 라우팅).
// 확장자는 소문자로 비교.
export const DOCLING_DOC_FORMATS = new Set([
  'docx', 'pptx', 'xlsx',
  'html', 'htm',
  'png', 'jpg', 'jpeg', 'tiff', 'tif',
  'csv',
])

/**
 * Format a Date as YYYY-MM-DD in local timezone.
 * (toISOString() uses UTC which can shift the date by one day in +09:00 etc.)
 */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export interface IngestOptions {
  readonly basePath?: string
  readonly execEnv?: Record<string, string>
  /** Stay-involved hook: user guidance injected into extraction prompt (llm-wiki.md "guide emphasis"). */
  readonly guideHint?: string
  /** Stay-involved hook: called after extraction, before file writes. Return false to cancel (llm-wiki.md "read summaries" + "check updates"). */
  readonly onPlanReady?: IngestPlanGate
  // 전처리 ~ ingest 가 자동 흐름이므로 converter 선택·캐시 무효화 모두 자동 로직이 처리.
  // - converter 자동 판정: 한국어 공백 소실 > 30% OR 스캔 PDF 감지 → docling --force-ocr 재시도
  // - regression 방어: force-ocr 이 한국어 50% 미만으로 떨어지면 tier 1 롤백
  // - 캐시: 옵션 + sourceBytes 동일하면 자동 히트. 완전 재변환 필요 시 ~/.cache/wikey/convert/ 삭제.
  // ── Phase 4 D.0.c (v6 §4.1.2): PII 2-layer gate ──
  // 미지정 시 안전 기본값: guardEnabled=true, allowPiiIngest=false, piiRedactionMode='mask'.
  // allowPiiIngest=false + PII 감지 → PiiIngestBlockedError. guardEnabled=false → 검사 전체 skip.
  readonly piiGuardEnabled?: boolean
  readonly allowPiiIngest?: boolean
  readonly piiRedactionMode?: 'display' | 'mask' | 'hide'
  // ── Phase 4 D.0.f follow-up (codex P2): freshness issue surfacing ──
  // reindexQuick 실패 또는 waitUntilFresh timeout 시 호출. UI 레이어 (Obsidian Notice)
  // 에서 사용자 가시화 — wikey-core 는 throw 대신 callback 으로 이벤트 전달만 담당.
  readonly onFreshnessIssue?: (reason: 'reindex-failed' | 'freshness-timeout', message: string) => void
  // §5.2.5: success path also surfaced so silent fail (no Notice at all) is impossible —
  // user always sees either "OK (Xs)" Notice or "실패/지연" Notice.
  readonly onFreshnessOk?: (durationMs: number) => void
  // ── §5.3.1 + §5.3.2 (plan v11): incremental reingest options ──
  /**
   * If true, decideReingest result of `'skip'` or `'skip-with-seed'` is overridden to
   * `'force'` (caller-only override; helper signature does not include this flag).
   * Conflict-based protect/prompt branches are NOT bypassed by this flag.
   */
  readonly forceReingest?: boolean
  /**
   * Optional UI hook for conflict resolution. When provided AND conflicts are detected,
   * decideReingest returns action='prompt' and ingest() awaits this callback to choose
   * 'overwrite' (force), 'preserve' (protect), or 'cancel' (throw IngestCancelledByUserError).
   */
  readonly onConflict?: (info: ConflictInfo) => Promise<'overwrite' | 'preserve' | 'cancel'>
  /**
   * Phase 5 §5.10.1.5 AC-C1.5: pre-converted source result (UI flow brief 단계 결과).
   * 있으면 Step 1 의 분기 변환 (`convertSourceToMarkdown`) 호출 skip — content/sidecarCandidate
   * 그대로 사용. **decideReingest / sidecar write / PII gate 시점은 모두 보존** (codex P1-1 invariant).
   * 없으면 (CLI / 테스트 / forceReingest 케이스) 기존 흐름 그대로.
   */
  readonly preconverted?: import('./conversion.js').ConversionResult
}

/**
 * §5.3.1/§5.3.2 — return type for ingest() when the source was skipped.
 * Plugin / caller distinguishes via the `'skipped' in result` type guard.
 */
export interface SkippedIngestResult {
  readonly sourceId: string
  readonly skipped: true
  readonly skipReason:
    | 'hash-match'
    | 'hash-match-sidecar-seed'
    | 'hash-match-sidecar-edit-noted'
    | 'duplicate-hash-other-path'
  readonly ingestedPages: readonly string[]
  readonly seededSidecarHash?: boolean
  readonly duplicateOfId?: string
}

/** Thrown when the user explicitly cancels via onConflict. */
export class IngestCancelledByUserError extends Error {
  constructor(message = 'ingest cancelled by user via onConflict') {
    super(message)
    this.name = 'IngestCancelledByUserError'
  }
}

/** Thrown when protect target path could not be written (best-effort failure). */
export class IngestProtectionFailedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IngestProtectionFailedError'
  }
}

/**
 * §5.3.1 — Read raw disk bytes for a source. Tries basePath + sourcePath via fs.readFileSync,
 * falls back to wikiFS.read → TextEncoder.encode (vault-only environments).
 * Mirrors buildV3SourceMeta logic so the same bytes can be reused (TOCTOU-safe).
 */
async function readRawDiskBytes(
  wikiFS: WikiFS,
  sourcePath: string,
  basePath: string | undefined,
): Promise<Uint8Array> {
  if (basePath) {
    try {
      const { readFileSync } = require('node:fs') as typeof import('node:fs')
      const { join } = require('node:path') as typeof import('node:path')
      return readFileSync(join(basePath, sourcePath))
    } catch {
      // fall through to wikiFS read
    }
  }
  try {
    const text = await wikiFS.read(sourcePath)
    return new TextEncoder().encode(text)
  } catch {
    // last resort: hash the path itself (mirrors buildV3SourceMeta fallback)
    return new TextEncoder().encode(sourcePath)
  }
}

/**
 * Reject ingest of paths inside wiki/ to prevent self-cycle (wiki page → entities/concepts of
 * itself). Sources must come from raw/ or another non-wiki location.
 */
export function assertNotWikiPath(sourcePath: string, caller: string): void {
  // Normalize leading slashes/redundant dots so "./wiki/...", "/wiki/..." also match
  const norm = sourcePath.replace(/^\.?\//, '').replace(/^\/+/, '')
  if (norm === 'wiki' || norm.startsWith('wiki/')) {
    throw new Error(
      `${caller}: cannot ingest from wiki/ (would create self-cycle). ` +
      `Move the source out of wiki/ first or pass a raw/* path. Got: ${sourcePath}`
    )
  }
}

export async function ingest(
  sourcePath: string,
  wikiFS: WikiFS,
  config: WikeyConfig,
  httpClient: HttpClient,
  onProgress?: IngestProgressCallback,
  opts?: IngestOptions,
): Promise<IngestResult | SkippedIngestResult> {
  assertNotWikiPath(sourcePath, 'ingest')
  const log = (msg: string, ...rest: unknown[]) => console.info(`[Wikey ingest] ${msg}`, ...rest)
  log(`start: ${sourcePath}`)

  // ── §5.3.1 + §5.3.2 Step 0: read raw disk bytes BEFORE any conversion. ──
  // (★ plan v11 P1-1 invariant: registry.hash 는 raw bytes 기준이므로 비교도 raw bytes 로.)
  // basePath 우선 fs.readFileSync, 없으면 wikiFS.read → TextEncoder.encode 폴백.
  const rawDiskBytes = await readRawDiskBytes(wikiFS, sourcePath, opts?.basePath)

  // Step 0.5: decideReingest (registry diff + conflicts collect-then-decide).
  let decision: ReingestDecision = await decideReingest({
    sourcePath,
    sourceBytes: rawDiskBytes,
    wikiFS,
    basePath: opts?.basePath,
    onConflict: opts?.onConflict,
  })

  // Step 0.6: action branching.
  // — caller-side 'force' override: forceReingest flag (helper-side never receives this).
  if (
    opts?.forceReingest === true &&
    (decision.action === 'skip' || decision.action === 'skip-with-seed')
  ) {
    decision = { ...decision, action: 'force', reason: 'hash-changed-clean' }
    log(`forceReingest=true override: skip→force`)
  }

  // 'prompt' branch: await user choice (overwrite=force / preserve=protect / cancel=throw).
  if (decision.action === 'prompt') {
    const choice = await opts!.onConflict!({ decision })
    if (choice === 'cancel') {
      throw new IngestCancelledByUserError()
    }
    decision = {
      ...decision,
      action: choice === 'overwrite' ? 'force' : 'protect',
    }
    log(`prompt → ${choice} → action=${decision.action}`)
  }

  // 'skip' branch: build SkippedIngestResult, possibly append duplicate location, return.
  if (decision.action === 'skip') {
    log(
      `skip (reason=${decision.reason}, conflicts=[${decision.conflicts.join(',')}]) — no LLM/page write`,
    )
    let regForSkip = await loadRegistry(wikiFS)
    if (decision.duplicateOfId && decision.duplicatePathToAppend) {
      regForSkip = appendDuplicateLocation(
        regForSkip,
        decision.duplicateOfId,
        decision.duplicatePathToAppend,
      )
      await saveRegistry(wikiFS, regForSkip)
    }
    const targetId =
      decision.preservedSourceId ?? decision.duplicateOfId ?? ''
    const targetRecord = targetId ? registryFindById(regForSkip, targetId) : null
    const skipReason = decision.reason as SkippedIngestResult['skipReason']
    return {
      sourceId: targetId,
      skipped: true,
      skipReason,
      ingestedPages: targetRecord?.ingested_pages ?? [],
      ...(decision.duplicateOfId ? { duplicateOfId: decision.duplicateOfId } : {}),
    }
  }

  // 'skip-with-seed' branch: legacy registry first hash-match — seed sidecar_hash only,
  // skip LLM/page write/reindex (★ plan v11 P1-3).
  if (decision.action === 'skip-with-seed') {
    log(
      `skip-with-seed — legacy record sidecar_hash 채움 (LLM/page write 0)`,
    )
    let regSeed = await loadRegistry(wikiFS)
    const id = decision.preservedSourceId
    if (id) {
      const existing = registryFindById(regSeed, id)
      if (existing && decision.diskSidecarHash) {
        const today = new Date().toISOString()
        const merged: SourceRecord = {
          ...existing,
          sidecar_hash: decision.diskSidecarHash,
          last_action: 'skip-with-seed',
          reingested_at: [...(existing.reingested_at ?? []), today],
        }
        regSeed = registryUpsert(regSeed, id, merged)
        await saveRegistry(wikiFS, regSeed)
      }
    }
    return {
      sourceId: id ?? '',
      skipped: true,
      skipReason: 'hash-match-sidecar-seed',
      ingestedPages: id ? registryFindById(regSeed, id)?.ingested_pages ?? [] : [],
      seededSidecarHash: true,
    }
  }

  // 'force' or 'protect' branch: continue full pipeline.
  // conflicts list informs Hook 1 (sidecar protect) and Hook 2 (source page user-marker preserve).
  const protectMode = decision.action === 'protect'
  const isSidecarProtect =
    protectMode &&
    (decision.conflicts.includes('sidecar-user-edit') ||
      decision.conflicts.includes('legacy-no-sidecar-hash') ||
      decision.conflicts.includes('unmanaged-paired-sidecar'))
  const isSourcePageProtect =
    protectMode && decision.conflicts.includes('source-page-user-edit')

  // Step 1: Read source
  onProgress?.({ step: 1, total: 4, message: 'Reading source...' })
  const sourceFilename = sourcePath.split('/').pop() ?? sourcePath
  const ext = (sourceFilename.toLowerCase().split('.').pop() ?? '')

  const tStep1_0 = Date.now()
  let sourceContent: string
  // §4.1.3 (D.0.b): PDF 는 LLM 투입용 `stripped` 과 sidecar 저장용 `sidecarCandidate` 를 분리한다.
  //   sidecarCandidate 는 중앙 PII wrapper (§4.1.2) 통과 후 파일시스템에 저장된다. PDF 외 포맷은
  //   sourceContent 자체가 sidecar 본문이므로 이 변수는 null 유지.
  let pdfSidecarCandidate: string | null = null
  if (opts?.preconverted) {
    // Phase 5 §5.10.1.5 AC-C1.5: brief 단계 결과 재사용 (Step 1 분기 skip).
    // decideReingest / sidecar write / PII gate 시점은 모두 보존 — preconverted 는 *문자열만* 주입.
    onProgress?.({ step: 1, total: 4, message: 'Reading source (preconverted)...' })
    sourceContent = opts.preconverted.content
    if (ext === 'pdf') {
      pdfSidecarCandidate = opts.preconverted.sidecarCandidate ?? sourceContent
    }
    if (!sourceContent || sourceContent.trim().length < 50) {
      throw new Error(`Preconverted content too short: ${sourceFilename}`)
    }
  } else if (ext === 'hwp' || ext === 'hwpx') {
    onProgress?.({ step: 1, total: 4, message: 'Extracting (unhwp)...' })
    sourceContent = await extractHwpText(sourcePath, opts?.basePath, opts?.execEnv)
    if (!sourceContent || sourceContent.trim().length < 50) {
      throw new Error(`HWP/HWPX extraction failed: ${sourceFilename} — install unhwp (pip install unhwp)`)
    }
  } else if (ext === 'pdf') {
    onProgress?.({ step: 1, total: 4, message: 'Extracting (Docling)...' })
    const pdfResult = await extractPdfText(sourcePath, opts?.basePath, opts?.execEnv, config)
    sourceContent = pdfResult.stripped
    pdfSidecarCandidate = pdfResult.sidecarCandidate
    if (!sourceContent || sourceContent.trim().length < 50) {
      throw new Error(`PDF text extraction failed: ${sourceFilename} — install docling (uv tool install docling) or markitdown (pip install markitdown[pdf])`)
    }
  } else if (DOCLING_DOC_FORMATS.has(ext)) {
    onProgress?.({ step: 1, total: 4, message: 'Extracting (Docling)...' })
    sourceContent = await extractDocumentText(sourcePath, opts?.basePath, opts?.execEnv, config)
    if (!sourceContent || sourceContent.trim().length < 50) {
      throw new Error(`Document extraction failed: ${sourceFilename} — install docling (uv tool install docling)`)
    }
  } else {
    // Markdown / TXT 등: 직접 읽고 web-clipper 출력에도 동일하게 placeholder 치환.
    const raw = await wikiFS.read(sourcePath)
    sourceContent = stripEmbeddedImages(raw)
  }
  log(`step 1 source read done in ${Date.now() - tStep1_0}ms (ext=${ext}, ${sourceContent.length} chars${opts?.preconverted ? ', preconverted' : ''})`)

  // ── Phase 4 D.0.c (v6 §4.1.2) + Phase 5 §5.8 (2026-04-24): PII 2-layer gate + 패턴 엔진 ──
  // 변환 후 (PDF/HWP/... 모두 markdown 으로 통일된 뒤) 에 한 번만 실행.
  // 패턴은 `loadPiiPatterns(basePath)` 로 로드 — `<basePath>/.wikey/pii-patterns.yaml` /
  // `~/.config/wikey/pii-patterns.yaml` 존재 시 사용자 override 반영. 없으면 DEFAULT_PATTERNS.
  // sidecarCandidate (PDF 만 해당) + LLM 프롬프트 filename 도 동일 패턴 재사용 — sanitize 경로 일관.
  const piiGuardEnabled = opts?.piiGuardEnabled ?? true
  const piiAllowIngest = opts?.allowPiiIngest ?? false
  const piiMode = opts?.piiRedactionMode ?? 'mask'
  const piiPatterns = loadPiiPatterns(opts?.basePath)
  {
    const gateRes = applyPiiGate(sourceContent, {
      guardEnabled: piiGuardEnabled,
      allowIngest: piiAllowIngest,
      mode: piiMode,
    }, piiPatterns)
    if (gateRes.redacted) {
      log(`PII redacted — ${gateRes.matches.length} match, mode=${piiMode}`)
      sourceContent = gateRes.content
    } else if (!piiGuardEnabled) {
      log('PII guard disabled — skipping detect/redact (user-trust boundary, not a technical safety boundary)')
    }
  }
  // Phase 5 §5.8.1 (C-A1): filename 에 PII 가 있으면 LLM prompt metadata 경로로 새어나가
  // body 에 재구성될 수 있다 → mask 로 치환한 별도 변수 사용. 원본 filename 은 fs 경로·
  // registry·movePair 용으로 보존.
  const llmSourceFilename = sanitizeForLlmPrompt(sourceFilename, { guardEnabled: piiGuardEnabled }, piiPatterns)
  if (llmSourceFilename !== sourceFilename) {
    log(`filename sanitized for LLM prompt: ${sourceFilename} → ${llmSourceFilename}`)
  }
  if (pdfSidecarCandidate) {
    const sidecarGate = applyPiiGate(pdfSidecarCandidate, {
      guardEnabled: piiGuardEnabled,
      // sidecar 경로는 이미 sourceContent gate 를 통과했으므로 allow=true (throw 재발생 방지).
      // guard=false 면 어차피 pass-through, guard=true + PII 없으면 no-op. PII 있고 여기 도달은
      // 앞서 allowIngest=true 로 사용자가 redact 선택한 경우뿐.
      allowIngest: true,
      mode: piiMode,
    }, piiPatterns)
    if (sidecarGate.redacted) {
      log(`PII redacted (sidecar) — ${sidecarGate.matches.length} match, mode=${piiMode}`)
      pdfSidecarCandidate = sidecarGate.content
    }
  }

  // §4.1.1.9 — md 사본 저장: 변환이 필요했던 포맷 (hwp/hwpx/docx/.../pdf) 은 원본 옆에
  // `<source>.md` 로 저장하여 사용자가 변환 결과를 직접 확인 가능. 원본이 이미 md 면 생략.
  // §4.1.3 (D.0.b) — PDF 는 `extractPdfText` 가 반환한 sidecarCandidate (raw 또는 stripped)
  // 를 우선 사용. 다른 포맷은 sourceContent 자체가 sidecar 본문.
  // 중앙 PII wrapper (§4.1.2) 통과 후 저장하므로 sidecar 도 자동 redact 대상.
  // ── §5.3.1 + §5.3.2 Hook 1: sidecar write protect (plan v11 P1-2 단일 규칙) ──
  // Default: canonical `<sourcePath>.md` overwrite. Protect: write to `<sourcePath>.md.new[.N]`
  // and leave canonical untouched. registry.sidecar_hash is only refreshed on canonical write
  // (the merged record below uses isSidecarProtect to decide).
  let canonicalSidecarPath: string | null = null
  let protectedSidecarPath: string | null = null
  if (ext && ext !== 'md' && ext !== 'txt') {
    const defaultSidecarPath = `${sourcePath}.md`
    const sidecarBody = ext === 'pdf' ? (pdfSidecarCandidate ?? sourceContent) : sourceContent
    if (isSidecarProtect) {
      // protect mode — pick a non-conflicting `.md.new[.1~.9]` target.
      try {
        const target = await protectSidecarTargetPath(sourcePath, wikiFS)
        await wikiFS.write(target, sidecarBody)
        protectedSidecarPath = target
        log(`sidecar protect → ${target} (canonical ${defaultSidecarPath} preserved)`)
      } catch (err) {
        if (err instanceof IngestProtectionPathExhaustedError) {
          throw new IngestProtectionFailedError(
            `sidecar protect target exhausted: ${err.message}`,
          )
        }
        throw new IngestProtectionFailedError(
          `sidecar protect write failed: ${(err as Error).message}`,
        )
      }
    } else {
      try {
        await wikiFS.write(defaultSidecarPath, sidecarBody)
        canonicalSidecarPath = defaultSidecarPath
        log(`sidecar .md saved → ${defaultSidecarPath} (${sidecarBody.length} chars)`)
      } catch (err) {
        log(`sidecar .md save skipped: ${err}`)
      }
    }
  }

  const indexContent = await wikiFS.read('wiki/index.md').catch(() => '')
  const basePromptTemplate = await loadEffectiveIngestPrompt(wikiFS)
  const promptTemplate = opts?.guideHint ? injectGuideHint(basePromptTemplate, opts.guideHint) : basePromptTemplate
  // §4.3.1 Stage 2/3 overrides — loaded once per ingest (file I/O outside hot loop).
  const stage2Res = await loadEffectiveStage2Prompt(wikiFS)
  const stage3Res = await loadEffectiveStage3Prompt(wikiFS)
  const stage2Template = stage2Res.prompt
  const stage3OverridePrompt = stage3Res.overridden ? stage3Res.prompt : undefined
  const { provider, model } = resolveProvider('ingest', config)
  const llm = new LLMClient(httpClient, config)
  const isLocal = provider === 'ollama'
  // §4.5.1.6.1: WIKEY_EXTRACTION_DETERMINISM=1 → temperature=0 + seed=42 on extraction calls.
  const deterministic = config.WIKEY_EXTRACTION_DETERMINISM === true

  // ── §4.5.1.5 v2: Route 판정 (token-budget 기반) ──
  // FULL: 문서 전체를 1콜 extractMentions 로. schema §19 "LLM 이 독자" 모델.
  // SEGMENTED: 섹션별로 peer context 와 함께 extractMentions (Ollama 소형 context + 초대형 문서).
  const route = selectRoute(sourceContent, provider, model)
  const sectionIndex = buildSectionIndex(sourceContent)
  let parsed: IngestRawResult

  log(`source: ${sourceContent.length} chars, route=${route}, sections=${sectionIndex.sections.length}, provider=${provider}, model=${model}`)

  // ── v6 3-stage pipeline ──
  // Stage 1: Summary LLM (source_page) + chunk LLM (mentions only, no classification)
  // Stage 2: Canonicalizer LLM (single doc-global call) → schema-validated entities/concepts
  // Stage 3: Code writes pages + deterministic index/log (Phase A)
  const existingEntityBases = (await wikiFS.list('wiki/entities').catch(() => []))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/i, ''))
  const existingConceptBases = (await wikiFS.list('wiki/concepts').catch(() => []))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/i, ''))
  log(`existing wiki — entities=${existingEntityBases.length}, concepts=${existingConceptBases.length}`)

  // §5.10.4 P2-2: .wikey/schema.yaml 의 `aliases:` block 만 read 하여 canonicalize 에
  // 전달 (canonical slug normalization 의 사용자 정의 확장). 그 외 schema gate / Stage 3
  // self-declarations 는 D-wide 에서 폐기 — LLM 자율 type 분류.
  const userAliases = await loadUserAliases(wikiFS).catch(() => ({} as Record<string, string>))
  if (Object.keys(userAliases).length > 0) {
    log(`user aliases loaded — ${Object.keys(userAliases).length} variant→canonical mappings`)
  }

  // §5.15.B: `.wikey/promotion-threshold.yaml` 의 `default:` 값 — 부재 / 실패 시 default=2
  const promotionThreshold = await loadPromotionThreshold(wikiFS)
  log(`promotion threshold = ${promotionThreshold} (§5.11 page promotion gate)`)

  // §5.17 Spec 1 P1 integration — ceiling/charsPerPage/absolute config load (yaml override 우선).
  // v0.3 codex cycle #1 P1 closure: applyCeilingCap 통합 의무.
  const promotionConfig = await loadPromotionConfig(wikiFS)
  log(`promotion ceiling — charsPerPage=${promotionConfig.ceiling?.charsPerPage ?? 'default'}, absolute=${promotionConfig.ceiling?.absolute ?? 'none'}, min=${promotionConfig.ceilingMin ?? 'default'}`)

  // §5.17 Spec 3 P1 integration — HWP/PDF 변환 품질 WARN telemetry.
  // bodyCharLen = sourceContent.length (PII gate + stripEmbeddedImages 후 — MD 소스는 frontmatter
  //   포함 가능, spec §I1 의 "body char (frontmatter 제거 후)" 와 근사치. 정확한 frontmatter 제거는
  //   향후 §5.18 cycle 에서 결정 필요 — 본 cycle 안에는 raw sourceContent.length 만).
  // rawByteLen = rawDiskBytes.byteLength (변환 전 원본).
  const conversionQuality = assessConversionQuality({
    bodyCharLen: sourceContent.length,
    rawByteLen: rawDiskBytes.byteLength,
  })
  if (conversionQuality.warn) {
    console.warn(`[Wikey ingest] ${conversionQuality.message}`)
    onProgress?.({ step: 1, total: 4, message: conversionQuality.message ?? '변환 품질 의심' })
  }

  const today = formatLocalDate(new Date())

  // ── §4.5.1.5 v2 라우터 — FULL / SEGMENTED ──
  // FULL: summary + 1 extractMentions(full-doc) + canonicalize. LLM 이 전체 문서를 읽는 독자 모델.
  // SEGMENTED: summary + N extractMentions(core 섹션 + peer context) + canonicalize. Ollama / 초대형.
  if (route === 'FULL') {
    const content = isLocal ? truncateSource(sourceContent) : sourceContent
    onProgress?.({ step: 2, total: 4, subStep: 0, subTotal: 3, message: `Summary (${model}) [FULL]` })
    // Phase 5 §5.8.1: LLM prompt 로 전달되는 filename 은 sanitize 된 버전 사용.
    const tSummary0 = Date.now()
    const summaryParsed = await callLLMForSummary(llm, content, llmSourceFilename, indexContent, provider, model, promptTemplate, deterministic)
    log(`stage 2.1 summary done in ${Date.now() - tSummary0}ms (FULL, ${content.length} chars)`)

    onProgress?.({ step: 2, total: 4, subStep: 1, subTotal: 3, message: `Extracting mentions (${model}) [FULL]` })
    const tMentions0 = Date.now()
    const rawMentions = await extractMentions(llm, content, llmSourceFilename, provider, model, undefined, deterministic, stage2Template)
    log(`stage 2.2 mention extraction done in ${Date.now() - tMentions0}ms (FULL, ${rawMentions.length} mentions)`)

    // §5.21 v0.5 — Stage 2 pre-filter (사용자 raise: Stage 1 over-emit 자원 낭비).
    // sourceBody substring count < promotionThreshold mention 을 canonicalizer
    // LLM call *전* drop → token 절약. canonicalizer.ts applyPromotionGate 는
    // LLM 호출 *후* 적용 — token cost 회피 불가.
    const preFilter = preFilterMentionsByOccurrence(rawMentions, content, promotionThreshold)
    const mentions = preFilter.kept
    if (preFilter.dropped.length > 0) {
      log(`stage 2.2 pre-filter dropped ${preFilter.dropped.length}/${rawMentions.length} mentions (occurrence < ${promotionThreshold})`)
    }

    onProgress?.({ step: 2, total: 4, subStep: 2, subTotal: 3, message: `Canonicalizing (${model})` })
    parsed = await canonicalizeAndAssembleParsed({
      llm, mentions, existingEntityBases, existingConceptBases,
      // §5.13.A1: rawSourceFilename = mask 안 된 원본 raw basename (sourceFilename 그대로).
      llmSourceFilename, rawSourceFilename: sourceFilename, summaryParsed, today,
      guideHint: opts?.guideHint, provider, model, userAliases,
      deterministic, stage3OverridePrompt,
      // §5.11 promotion threshold (FULL): deterministic Layer 2 gate (substring count ≥ N in body).
      sourceBody: content,
      promotionThreshold,
      log,
    })
  } else {
    // ── SEGMENTED — 섹션별 심독 (core priority 만) + peer context ──
    const coreSections = sectionIndex.sections.filter(
      (s) => computeHeuristicPriority(s) === 'core' || computeHeuristicPriority(s) === 'support',
    )
    // support 섹션은 현 구현에서 core 와 동일 취급. skip 섹션만 완전 제외.
    // (v2 향후 개선: support 를 snippet 만 spill)
    const targetSections = coreSections.length > 0
      ? coreSections
      : sectionIndex.sections   // core/support 가 하나도 없으면(전부 skip) — 안전망으로 전부 처리
    const totalSteps = targetSections.length + 2  // summary + N sections + canonicalize

    onProgress?.({ step: 2, total: 4, subStep: 0, subTotal: totalSteps, message: `Summary (${model}) [SEGMENTED 1/${totalSteps}]` })
    const summaryContent = isLocal ? truncateSource(sourceContent) : sourceContent
    // Phase 5 §5.8.1: LLM prompt 로 전달되는 filename 은 sanitize 된 버전 사용.
    const tSegSummary0 = Date.now()
    const summaryParsed = await callLLMForSummary(llm, summaryContent, llmSourceFilename, indexContent, provider, model, promptTemplate, deterministic)
    log(`stage 2.1 summary done in ${Date.now() - tSegSummary0}ms (SEGMENTED) — index_additions=${summaryParsed.index_additions?.length ?? 0}`)

    const allMentions: Mention[] = []
    let sectionOk = 0, sectionFail = 0
    const tSegMentions0 = Date.now()
    for (let i = 0; i < targetSections.length; i++) {
      const section = targetSections[i]
      onProgress?.({
        step: 2, total: 4,
        subStep: i + 1, subTotal: totalSteps,
        message: `Section ${i + 1}/${targetSections.length} §${section.idx} "${section.title}" [SEGMENTED]`,
      })
      const peer = formatPeerContext(sectionIndex, section.idx, 300)
      const content = buildSectionWithPeer(peer, section, isLocal)
      try {
        const mentions = await extractMentions(llm, content, llmSourceFilename, provider, model, section.idx, deterministic, stage2Template)
        allMentions.push(...mentions)
        sectionOk++
      } catch (err) {
        sectionFail++
        console.warn(`[Wikey ingest] section §${section.idx} "${section.title}" failed:`, (err as Error).message)
      }
    }
    log(`stage 2.2 mention extraction done in ${Date.now() - tSegMentions0}ms (SEGMENTED, ${targetSections.length} sections, ok=${sectionOk}/fail=${sectionFail}, ${allMentions.length} mentions)`)

    // §5.21 v0.5 — Stage 2 pre-filter (FULL route 와 동일 로직, SEGMENTED 분기).
    const segPreFilter = preFilterMentionsByOccurrence(allMentions, sourceContent, promotionThreshold)
    const segMentions = segPreFilter.kept
    if (segPreFilter.dropped.length > 0) {
      log(`stage 2.2 pre-filter dropped ${segPreFilter.dropped.length}/${allMentions.length} mentions (occurrence < ${promotionThreshold})`)
    }

    onProgress?.({
      step: 2, total: 4,
      subStep: targetSections.length + 1, subTotal: totalSteps,
      message: `Canonicalizing (${model}) [SEGMENTED ${targetSections.length + 1}/${totalSteps}]`,
    })
    parsed = await canonicalizeAndAssembleParsed({
      llm, mentions: segMentions, existingEntityBases, existingConceptBases,
      // §5.13.A1: rawSourceFilename = mask 안 된 원본 raw basename (sourceFilename 그대로).
      llmSourceFilename, rawSourceFilename: sourceFilename, summaryParsed, today,
      guideHint: opts?.guideHint, provider, model, userAliases,
      deterministic, stage3OverridePrompt,
      // §5.11 promotion threshold (SEGMENTED): sourceBody 는 전체 sourceContent
      // — per-section 합산이 아닌 본문 전체가 substring count 의 ground truth.
      sourceBody: sourceContent,
      promotionThreshold,
      log,
    })
  }

  if (!parsed.source_page?.filename || !parsed.source_page?.content) {
    throw new Error(`LLM returned invalid structure — missing source_page. Keys: ${Object.keys(parsed).join(', ')}`)
  }

  // §5.17 Spec 1 P1 integration — applyCeilingCap (outlier 분해 후 합산 cap).
  // adapter: WikiPage → ProposalForCeiling. WikiPage 는 confidence/mentionPosition 미보유 →
  // fallback (confidence=1, mentionPosition=index in concatenated array). v0.3 codex cycle #1
  // P2 adapter closure. cap 미적용 (proposedCount ≤ ceiling) 시 selected = [...proposed].
  {
    const allProposals: ReadonlyArray<ProposalForCeiling & { _kind: 'entity' | 'concept'; _idx: number }> = [
      ...(parsed.entities ?? []).map((p, i) => ({
        name: p.filename, confidence: 1, mentionPosition: i,
        _kind: 'entity' as const, _idx: i,
      })),
      ...(parsed.concepts ?? []).map((p, i) => ({
        name: p.filename, confidence: 1, mentionPosition: (parsed.entities?.length ?? 0) + i,
        _kind: 'concept' as const, _idx: i,
      })),
    ]
    const capResult = applyCeilingCap({
      inputCharLen: sourceContent.length,
      proposed: allProposals,
      config: promotionConfig,
    })
    if (capResult.decision.selectedCount < capResult.decision.proposedCount) {
      const selectedKeys = new Set(capResult.selected.map((p) => `${p._kind}:${p._idx}`))
      const newEntities = (parsed.entities ?? []).filter((_, i) => selectedKeys.has(`entity:${i}`))
      const newConcepts = (parsed.concepts ?? []).filter((_, i) => selectedKeys.has(`concept:${i}`))
      log(`ceiling cap applied — ${capResult.decision.proposedCount} → ${capResult.decision.selectedCount} (ceiling=${capResult.decision.ceiling}, reason=${capResult.decision.reason}, charsPerPage=${capResult.decision.charsPerPage}, inputCharLen=${capResult.decision.inputCharLen})`)
      parsed = {
        ...parsed,
        entities: newEntities,
        concepts: newConcepts,
      }
    }
  }

  // §4.3.3 — source 페이지 본문의 깨진 wikilink 를 canonical 페이지 기준으로 plain text 로 강등.
  //   적용 시점: Preview 모달 호출 **이전** → Preview 와 저장본이 bit-identical 유지 (plan v2 §5.2).
  //   keepBases: Stage 2/3 에서 canonical 된 entity/concept filename 의 normalized base Set.
  {
    const keepBases = new Set<string>()
    for (const e of parsed.entities ?? []) keepBases.add(normalizeBase(e.filename))
    for (const c of parsed.concepts ?? []) keepBases.add(normalizeBase(c.filename))
    keepBases.add(normalizeBase(parsed.source_page.filename))
    parsed.source_page.content = stripBrokenWikilinks(parsed.source_page.content, keepBases)
  }

  // Stage 2 gate: show extraction plan before writing (llm-wiki.md "read summaries" + "check updates")
  if (opts?.onPlanReady) {
    onProgress?.({ step: 3, total: 4, message: 'Awaiting review...' })
    const plan = await buildPlan(wikiFS, sourceFilename, parsed)
    const approved = await opts.onPlanReady(plan)
    if (!approved) {
      log(`plan rejected by user — aborting before write`)
      throw new PlanRejectedError(`Ingest cancelled at preview stage: ${sourcePath}`)
    }
    log(`plan approved`)
  }

  // Step 3: Create/update wiki pages
  onProgress?.({ step: 3, total: 4, message: 'Creating pages...' })
  log(`writing pages — source=${parsed.source_page.filename}, entities=${(parsed.entities ?? []).length}, concepts=${(parsed.concepts ?? []).length}`)
  const tStep3_0 = Date.now()
  const createdPages: string[] = []
  const updatedPages: string[] = []

  // §4.2 Stage 1 S1-3: v3 frontmatter + registry upsert.
  // §5.3.1 plan v11 결정 10: source_id stable per path — preservedSourceId (decision.preservedSourceId)
  // 가 truthy 면 R != null 분기였다는 뜻이므로 raw bytes 기반 신규 id 대신 기존 id 보존.
  const v3Meta = await buildV3SourceMeta(
    wikiFS,
    sourcePath,
    rawDiskBytes,
    ext,
    `wiki/sources/${parsed.source_page.filename}`,
    decision.preservedSourceId,
  )

  // ── §5.3.2 Hook 2: source page user-marker preserve (plan v11 P1-5 source 한정) ──
  // Reads existing wiki/sources/<filename>.md (if any), extracts ## 사용자 메모 block,
  // and merges into the LLM-generated body before frontmatter injection.
  // entity/concept pages are NOT covered (post-follow-up #4 — LLM determinism risk).
  const sourcePagePath = `wiki/sources/${parsed.source_page.filename}`
  let preservedMarkers = ''
  if (isSourcePageProtect) {
    try {
      const existingBody = await wikiFS.read(sourcePagePath)
      preservedMarkers = extractUserMarkers(existingBody)
      if (preservedMarkers) log(`source page user marker preserved (${preservedMarkers.length} chars)`)
    } catch {
      // page missing — nothing to preserve
    }
  }
  const llmSourceBody = appendSectionTOCToSource(parsed.source_page.content, sectionIndex)
  const sourceBodyWithMarkers = preservedMarkers
    ? mergeUserMarkers(llmSourceBody, preservedMarkers)
    : llmSourceBody

  const sourcePage: WikiPage = {
    filename: parsed.source_page.filename,
    // §4.5.1.5.6 Phase C: 섹션 TOC append (결정적 메타, LLM 호출 없음)
    content: injectSourceFrontmatter(sourceBodyWithMarkers, v3Meta.frontmatter),
    category: 'sources',
  }
  const exists = await wikiFS.exists(sourcePagePath)
  await createPage(wikiFS, sourcePage)
  ;(exists ? updatedPages : createdPages).push(sourcePage.filename)

  // ── §5.3.1 + §5.3.2 Hook 3: registry upsert with sidecar_hash invariant (plan v11) ──
  // canonical sidecar 가 실제로 (re)write 된 경우만 sidecar_vault_path / sidecar_hash 갱신.
  // protect 분기 (canonicalSidecarPath==null, protectedSidecarPath!=null) 에서는
  // 기존 sidecar_hash / sidecar_vault_path 보존 + pending_protections 에 entry append.
  if (v3Meta.record) {
    let reg = await loadRegistry(wikiFS)
    const existing = registryFindById(reg, v3Meta.id)
    const today = new Date().toISOString()

    const ingestedPages = existing
      ? existing.ingested_pages.includes(sourcePagePath)
        ? existing.ingested_pages
        : [...existing.ingested_pages, sourcePagePath]
      : v3Meta.record.ingested_pages

    const isCanonicalSidecarWritten = canonicalSidecarPath != null

    // Compute new sidecar_hash if canonical was written.
    let newSidecarHash: string | undefined = existing?.sidecar_hash
    if (isCanonicalSidecarWritten && canonicalSidecarPath) {
      const computed = await computeSidecarHash(wikiFS, canonicalSidecarPath)
      if (computed) newSidecarHash = computed
    }

    const merged: SourceRecord = existing
      ? {
          ...existing,
          // raw bytes hash + size 갱신 (force/protect 분기는 새 raw bytes)
          hash: v3Meta.record.hash,
          size: v3Meta.record.size,
          last_action: decision.action as ReingestAction,
          reingested_at: [...(existing.reingested_at ?? []), today],
          ingested_pages: ingestedPages,
          ...(isCanonicalSidecarWritten
            ? {
                sidecar_vault_path: canonicalSidecarPath ?? existing.sidecar_vault_path,
                sidecar_hash: newSidecarHash,
              }
            : {}),
        }
      : {
          ...v3Meta.record,
          ingested_pages: ingestedPages,
          last_action: decision.action as ReingestAction,
          ...(isCanonicalSidecarWritten && newSidecarHash
            ? { sidecar_hash: newSidecarHash }
            : {}),
        }

    reg = registryUpsert(reg, v3Meta.id, merged)

    // protect 분기: pending_protections append (canonical 미변경 표식)
    if (protectedSidecarPath) {
      // 우선순위: sidecar-user-edit > unmanaged-paired-sidecar > legacy-no-sidecar-hash
      const conflict = decision.conflicts.includes('sidecar-user-edit')
        ? 'sidecar-user-edit'
        : decision.conflicts.includes('unmanaged-paired-sidecar')
        ? 'unmanaged-paired-sidecar'
        : 'legacy-no-sidecar-hash'
      reg = appendPendingProtection(reg, v3Meta.id, {
        kind: 'sidecar-md-new',
        path: protectedSidecarPath,
        created_at: today,
        conflict,
      })
    }

    await saveRegistry(wikiFS, reg)
  }

  // §4.3.2 Part A: entity/concept 페이지에 provenance 주입.
  //   MVP: canonicalize 된 모든 페이지에 {type: 'extracted', ref: 'sources/<source_id>'} 기본 적용.
  //   source bytes 못 읽어 registry 미기록 (v3Meta.record=null) 인 경우 provenance 스킵.
  //   inferred/ambiguous 구분은 Phase 5 §5.4 variance diagnostic 에서 canonicalize output 확장 때 추가.
  const provenanceEntry = v3Meta.record
    ? [{ type: 'extracted' as const, ref: `sources/${v3Meta.id}` }]
    : null

  // §5.17 Spec 2 P1 integration — batch yield via writePagesWithBatchYield.
  // v0.3 codex cycle #1 P1 closure: sequential `for...await` 대체. exists check 는
  // pre-loop 에서 일괄 수행 (created/updated 추적 보존). pathPrefix='wiki/' 로 createPage 와 동일 path.
  // §5.21 mention-guard: deterministic post-process for raw filename / extension
  // / case-normalize wikilink violations. Per Spec 1/2 (I1/I2/I4/I5/I6/I7/I8).
  // Guarded content propagates to writtenPages + return payload so index.md /
  // log.md autofill never reintroduce raw wikilinks (codex Step F MEDIUM #3).
  const mentionGuardLog: MentionGuardLogEntry[] = []
  const guardedEntities = new Map<string, string>() // filename → guarded content
  const guardedConcepts = new Map<string, string>()
  // §5.21 v0.5 — basename collision guard (사용자 raise 2026-05-13). raw inbox /
  // delayed basename 과 같은 wiki entity/concept filename emit 시 §5.13.A1
  // ambiguity 발생 (Obsidian basename matcher 충돌). canonicalize 결과를 raw
  // basename set 과 비교하여 pre-write drop. raw/0_inbox + raw/_delayed 만 scan
  // (top-level, deep nested PARA 는 후속 — 가장 자주 conflict 발생 영역 cover).
  const rawInboxBases = (await wikiFS.list('raw/0_inbox').catch(() => []))
  const rawDelayedBases = (await wikiFS.list('raw/_delayed').catch(() => []))
  const rawBasenameSet = new Set<string>([...rawInboxBases, ...rawDelayedBases])
  const beforeEntities = parsed.entities?.length ?? 0
  const beforeConcepts = parsed.concepts?.length ?? 0
  if (parsed.entities) {
    const ef = filterBasenameCollisions(parsed.entities, rawBasenameSet)
    if (ef.dropped.length > 0) {
      log(`stage 2 collision drop: ${ef.dropped.length}/${beforeEntities} entities — raw basename conflict`)
    }
    parsed = { ...parsed, entities: [...ef.kept] }
  }
  if (parsed.concepts) {
    const cf = filterBasenameCollisions(parsed.concepts, rawBasenameSet)
    if (cf.dropped.length > 0) {
      log(`stage 2 collision drop: ${cf.dropped.length}/${beforeConcepts} concepts — raw basename conflict`)
    }
    parsed = { ...parsed, concepts: [...cf.kept] }
  }

  // §5.21 v0.4 — mention-guard existingBases set: this-ingest pages ∪ vault
  // existing pages (entities + concepts + sources). I2 raw-filename fallback
  // AND I9 mention-only fallback both consult this set. existingEntityBases /
  // existingConceptBases are listed earlier (line ~536); wiki/sources is
  // listed here once for completeness.
  const existingSourceBases = (await wikiFS.list('wiki/sources').catch(() => []))
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.replace(/\.md$/i, ''))
  const mentionGuardBases = new Set<string>()
  for (const e of parsed.entities ?? []) mentionGuardBases.add(normalizeBase(e.filename))
  for (const c of parsed.concepts ?? []) mentionGuardBases.add(normalizeBase(c.filename))
  mentionGuardBases.add(normalizeBase(parsed.source_page.filename))
  for (const b of existingEntityBases) mentionGuardBases.add(normalizeBase(b))
  for (const b of existingConceptBases) mentionGuardBases.add(normalizeBase(b))
  for (const b of existingSourceBases) mentionGuardBases.add(normalizeBase(b))
  const guardedPageContent = (raw: string, page: string): string => {
    const res = applyMentionGuard(raw, { sourceSha: v3Meta.id, page, userAliases, existingBases: mentionGuardBases })
    if (res.log.length > 0) mentionGuardLog.push(...res.log)
    return res.content
  }

  const entityWrites: BatchWritePage[] = []
  for (const entity of parsed.entities ?? []) {
    const provenanced = provenanceEntry ? injectProvenance(entity.content, provenanceEntry) : entity.content
    const content = guardedPageContent(provenanced, `entities/${normalizeBase(entity.filename)}`)
    guardedEntities.set(entity.filename, content)
    const entityExists = await wikiFS.exists(`wiki/entities/${entity.filename}`)
    ;(entityExists ? updatedPages : createdPages).push(entity.filename)
    entityWrites.push({ filename: entity.filename, content, category: 'entities' })
  }
  const conceptWrites: BatchWritePage[] = []
  for (const concept of parsed.concepts ?? []) {
    const provenanced = provenanceEntry ? injectProvenance(concept.content, provenanceEntry) : concept.content
    const content = guardedPageContent(provenanced, `concepts/${normalizeBase(concept.filename)}`)
    guardedConcepts.set(concept.filename, content)
    const conceptExists = await wikiFS.exists(`wiki/concepts/${concept.filename}`)
    ;(conceptExists ? updatedPages : createdPages).push(concept.filename)
    conceptWrites.push({ filename: concept.filename, content, category: 'concepts' })
  }
  if (mentionGuardLog.length > 0) {
    log(`mention-guard: ${mentionGuardLog.length} variations applied`)
    // §5.21 Spec 1 AC-S1-3 — persist JSON entries outside wiki/ to avoid the
    // §5.19 v0.4 recursive-feedback pattern (analyses pages containing raw
    // [[X]] caused the wiki-check loop). Path is vault-local hidden dir.
    await persistMentionGuardLog(wikiFS, today, mentionGuardLog)
  }
  await writePagesWithBatchYield({
    wikiFS, pages: [...entityWrites, ...conceptWrites], batchSize: 10, pathPrefix: 'wiki/',
  })

  log(`pages written — created=${createdPages.length}, updated=${updatedPages.length}`)

  // Phase A: Build writtenPages for deterministic index/log backfill.
  // §5.21 codex Step F MEDIUM #3 — use guarded content (matches disk write) so
  // index.md / log.md autofill never reintroduce raw wikilinks.
  const writtenPages: WrittenPage[] = [
    { filename: sourcePage.filename, category: 'sources', content: sourcePage.content },
    ...(parsed.entities ?? []).map((e) => ({ filename: e.filename, category: 'entities' as const, content: guardedEntities.get(e.filename) ?? e.content })),
    ...(parsed.concepts ?? []).map((c) => ({ filename: c.filename, category: 'concepts' as const, content: guardedConcepts.get(c.filename) ?? c.content })),
  ]

  // Tag LLM-provided index_additions by category so wiki-ops places them in the right section.
  const entityBases = new Set((parsed.entities ?? []).map((e) => normalizeBase(e.filename)))
  const conceptBases = new Set((parsed.concepts ?? []).map((c) => normalizeBase(c.filename)))
  const sourceBase = normalizeBase(sourcePage.filename)
  const tagged = (parsed.index_additions ?? []).map((entry) => {
    const match = entry.match(/\[\[([^\]|]+)/)
    const firstLink = match ? normalizeBase(match[1].trim()) : ''
    let category: 'entities' | 'concepts' | 'sources' | 'analyses' = 'analyses'
    if (firstLink === sourceBase || firstLink.startsWith('source-')) category = 'sources'
    else if (entityBases.has(firstLink)) category = 'entities'
    else if (conceptBases.has(firstLink)) category = 'concepts'
    return { entry, category }
  })
  await updateIndex(wikiFS, tagged, writtenPages)
  log(`index.md updated — LLM entries=${tagged.length}, total written pages=${writtenPages.length}`)

  // log.md: always append an entry, using LLM body if available, else build deterministic header.
  // Auto-fill missing pages so the log reflects what was actually written.
  // (today already declared at top of ingest() for canonicalizer)
  // §5.21 Spec §1.5 Q2 — mention-guard summary 1 line (raw [[X]] 미포함).
  const llmBody = parsed.log_entry?.trim() ?? ''
  const entryHeader = `## [${today}] ingest | ${sourceFilename}`
  const mentionGuardSummary = mentionGuardLog.length > 0
    ? `\n- mention-guard: ${mentionGuardLog.length} variations applied`
    : ''
  const entry = llmBody
    ? `${entryHeader}\n\n${llmBody}${mentionGuardSummary}`
    : `${entryHeader}${mentionGuardSummary}\n`
  await appendLog(wikiFS, entry, writtenPages)
  log(`log.md prepended`)
  log(`step 3 page write done in ${Date.now() - tStep3_0}ms (${createdPages.length} created, ${updatedPages.length} updated)`)

  // Step 4: Reindex (Phase 4 D.0.f / v6 §4.4)
  //   - `reindexQuick` 동기 실행 (throw on failure)
  //   - `waitUntilFresh` polling 으로 `status==='fresh' && stale===0` 확보 후 return.
  //   - 실패/타임아웃 은 warn + `onFreshnessIssue` 콜백으로 UI 레이어에 전달 — ingest 본체는
  //     이미 성공했으므로 throw 하지 않되, 사용자는 Notice 로 stale 상태를 인지해야 한다
  //     (plan v6 §4.4.6 "지연 — 잠시 후 검색 가능").
  onProgress?.({ step: 4, total: 4, message: 'Indexing...' })
  const tStep4_0 = Date.now()
  await runReindexAndWait(opts?.basePath, opts?.execEnv, log, opts?.onFreshnessIssue, opts?.onFreshnessOk)
  log(`step 4 reindex done in ${Date.now() - tStep4_0}ms`)
  log(`done: ${sourcePath}`)

  return {
    sourcePage,
    entities: (parsed.entities ?? []).map((e) => ({
      filename: e.filename,
      content: guardedEntities.get(e.filename) ?? e.content,
      category: 'entities' as const,
    })),
    concepts: (parsed.concepts ?? []).map((c) => ({
      filename: c.filename,
      content: guardedConcepts.get(c.filename) ?? c.content,
      category: 'concepts' as const,
    })),
    indexAdditions: parsed.index_additions ?? [],
    logEntry: parsed.log_entry ?? '',
  }
}

/**
 * §5.21 Spec 1 AC-S1-3 — append mention-guard log entries (JSON Lines) to
 * `.wikey/mention-guard-<YYYY-MM-DD>.jsonl`. Path is *outside* wiki/ so the
 * §5.19 v0.4 recursive-feedback pattern (analyses pages containing raw
 * `[[X]]` re-triggering broken-link detection) cannot recur.
 *
 * Failure here must not abort ingest — log persistence is observational.
 */
async function persistMentionGuardLog(
  wikiFS: WikiFS,
  today: string,
  entries: readonly MentionGuardLogEntry[],
): Promise<void> {
  const path = `.wikey/mention-guard-${today}.jsonl`
  try {
    const existing = await wikiFS.read(path).catch(() => '')
    const appended = entries.map((e) => JSON.stringify(e)).join('\n')
    const next = existing.length > 0
      ? `${existing.replace(/\n+$/, '')}\n${appended}\n`
      : `${appended}\n`
    await wikiFS.write(path, next)
  } catch (err) {
    // observational — debug log only.
    console.warn(`[mention-guard] failed to persist log to ${path}:`, err)
  }
}

// ── LLM call helpers ──

/**
 * v6 Stage 1a: Summary call — produces source_page (markdown) + index_additions + log_entry.
 * Entities/concepts in the response are IGNORED in v6 (canonicalizer determines them from mentions).
 * Renamed from callLLMForIngest for clarity; same prompt template.
 */
async function callLLMForSummary(
  llm: LLMClient, sourceContent: string, sourceFilename: string,
  indexContent: string, provider: string, model: string,
  promptTemplate?: string, deterministic?: boolean,
): Promise<IngestRawResult> {
  const prompt = buildIngestPrompt(sourceContent, sourceFilename, indexContent, promptTemplate)
  const parsed = await callLLMWithRetry(llm, prompt, provider, model, deterministic)
  // §5.13.C4: LLM emit drift 방어 — `source_page.filename` 의 `source-` prefix 누락
  //   또는 다른 prefix (raw-, archive- 등) 를 force normalize. assembleCanonicalResult
  //   의 sourcePageBase derive (normalizeBase) 보다 먼저 진행 → entity/concept `## 출처`
  //   wikilink 도 normalized base 일관 (§5.12 paradigm 회귀 0).
  return normalizeSourcePageFilename(parsed)
}

/**
 * §5.13.C4 — LLM emit `source_page.filename` 의 `source-` prefix 누락 시 자동 prepend.
 * 다른 prefix (e.g., `raw-`, `archive-`) 도 force prepend (사용자 결정 = force, 보존 X).
 * 결과 immutable — 원본 parsed 변경 없음.
 *
 * 1차 방어선 = prompt template 에 명시 강제 문구 (buildIngestPrompt). 2차 방어선 =
 * 본 함수 (defense in depth, LLM 자율 흐름이 prompt 무시 가능 케이스 cover).
 */
export function normalizeSourcePageFilename(parsed: IngestRawResult): IngestRawResult {
  if (!parsed.source_page?.filename) return parsed
  const original = parsed.source_page.filename
  if (original.startsWith('source-')) return parsed
  console.warn(`[Wikey ingest] LLM emit drift — auto-normalizing source_page.filename: ${original} → source-${original}`)
  return {
    ...parsed,
    source_page: { ...parsed.source_page, filename: `source-${original}` },
  }
}

/**
 * §5.14.B (Tier 2 BLUE) — FULL/SEGMENTED route 의 stage 2.3 canonicalize 호출 +
 * dropped sample log + IngestRawResult assembly 공통화. mentions / sourceBody 만
 * route 별 다르고 나머지는 동일.
 *
 * §5.12 invariant: wiki/sources/<sourcePageBase>.md 단일 진실 소스 base 는
 * `normalizeBase(summaryParsed.source_page.filename)` derive (LLM emit drift 방어).
 */
async function canonicalizeAndAssembleParsed(args: {
  llm: LLMClient
  mentions: readonly Mention[]
  existingEntityBases: readonly string[]
  existingConceptBases: readonly string[]
  llmSourceFilename: string
  /** §5.13.A1: PII-mask 적용 안 된 원본 raw basename (예: `pmbok-overview.md`). raw wikilink target 용. */
  rawSourceFilename: string
  summaryParsed: IngestRawResult
  today: string
  guideHint: string | undefined
  provider: string
  model: string
  userAliases: Readonly<Record<string, string>>
  deterministic: boolean
  stage3OverridePrompt: string | undefined
  sourceBody: string
  /** §5.15.B: page promotion threshold (`.wikey/promotion-threshold.yaml` 의 `default:`). */
  promotionThreshold: number
  log: (msg: string) => void
}): Promise<IngestRawResult> {
  const {
    llm, mentions, existingEntityBases, existingConceptBases,
    llmSourceFilename, rawSourceFilename, summaryParsed, today, guideHint, provider, model,
    userAliases, deterministic, stage3OverridePrompt, sourceBody, promotionThreshold, log,
  } = args
  const tCanon0 = Date.now()
  const sourcePageBase = normalizeBase(summaryParsed.source_page.filename)
  const canon = await canonicalize({
    llm, mentions, existingEntityBases, existingConceptBases,
    // §5.13.A1: sourceFilename = LLM body 등재용 (PII guard ON 시 mask 적용된 형식).
    //   rawSourceFilename = mask 안 된 원본 raw basename — `## 출처` raw wikilink target
    //   으로 사용. PII guard 흐름과 무관하게 raw 파일 jump 1 클릭 보장.
    sourceFilename: llmSourceFilename, rawSourceFilename, sourcePageBase, today,
    guideHint, provider, model, userAliases, deterministic,
    overridePrompt: stage3OverridePrompt,
    sourceBody,
    promotionThreshold,
  })
  log(`stage 2.3 canonicalize done in ${Date.now() - tCanon0}ms — entities=${canon.entities.length}, concepts=${canon.concepts.length}, dropped=${canon.dropped.length}`)
  if (canon.dropped.length > 0) {
    const droppedSummary = canon.dropped.slice(0, 10).map((d) => `${d.mention.name} (${d.reason})`).join(', ')
    log(`dropped sample: ${droppedSummary}${canon.dropped.length > 10 ? `, +${canon.dropped.length - 10} more` : ''}`)
  }
  return {
    source_page: summaryParsed.source_page,
    entities: canon.entities.map((p) => ({ filename: p.filename, content: p.content })),
    concepts: canon.concepts.map((p) => ({ filename: p.filename, content: p.content })),
    index_additions: canon.indexAdditions ? [...canon.indexAdditions] : summaryParsed.index_additions,
    log_entry: canon.logEntry ?? summaryParsed.log_entry,
  }
}

/**
 * v6 Stage 1b: Mention extractor — chunk LLM emits raw mentions only, no classification.
 * Returns Mention[] (not IngestRawResult). Stage 2 canonicalizer handles classification + dedup.
 *
 * §4.3.1: template override via `.wikey/stage2_mention_prompt.md`. Substituted variables:
 *   - {{SOURCE_FILENAME}}, {{CHUNK_CONTENT}}
 */
async function extractMentions(
  llm: LLMClient, chunkContent: string, sourceFilename: string,
  provider: string, model: string, chunkIdx?: number, deterministic?: boolean,
  promptTemplate?: string,
): Promise<Mention[]> {
  const template = promptTemplate ?? BUNDLED_STAGE2_MENTION_PROMPT
  const prompt = template
    .replaceAll('{{SOURCE_FILENAME}}', sourceFilename)
    .replaceAll('{{CHUNK_CONTENT}}', chunkContent)

  const raw = await callLLMWithRetry(llm, prompt, provider, model, deterministic)
  const mentions = ((raw as any).mentions ?? []) as Array<{ name?: string; type_hint?: string; evidence?: string }>
  return mentions
    .filter((m) => m.name && m.name.trim().length > 0)
    .map((m) => ({
      name: m.name!.trim(),
      type_hint: (m.type_hint as Mention['type_hint']) ?? 'unknown',
      evidence: (m.evidence ?? '').trim(),
      source_section_idx: chunkIdx,
    }))
}

/** §4.3.1 bundled default for Stage 2 (chunk → Mention). Kept intact when no override exists. */
export const BUNDLED_STAGE2_MENTION_PROMPT = `이 문서 청크에서 잠재적으로 wiki 페이지가 될 만한 **mention(언급)**을 추출하세요.

Source: {{SOURCE_FILENAME}}

## 작업 정의

분류하지 마세요. 페이지를 만들지 마세요. 단지 "이 chunk에 등장하는 wiki 후보"를 짧게 나열만 하세요.

각 mention은 다음 정보를 가집니다:
- \`name\`: 정규화된 base name (소문자 + 하이픈 구분, 예: \`${EXAMPLE_CONCEPT_ALIAS}\`, \`${EXAMPLE_ORG_BASE}\`)
- \`type_hint\`: 자유 string. 예시: \`organization\` (회사/기관), \`person\` (실명 인물), \`product\` (제품명), \`tool\` (소프트웨어/프로토콜), \`standard\` (산업표준/규격), \`methodology\` (방법론), \`document_type\` (문서종류). 이 외도 자유 (예: \`algorithm\`, \`dataset\`, \`metric\`). 모르면 \`unknown\`.
- \`evidence\`: 1문장 (어디 등장했는지, 200자 이내)

## 무엇을 mention으로 뽑을까

✅ 산업 표준 용어 (PMBOK, ERP, MES, Gantt chart 등)
✅ 회사·인물·제품·도구의 고유명
✅ 정식 문서 유형 (사업자등록증, 세금계산서 등)

❌ UI 라벨/메뉴/버튼명 — 절대 mention 아님
❌ 한국어 일반 명사 라벨 (회의실, 결재시스템 등) — mention 아님
❌ X-management, X-service, X-support 같은 단순 기능명 — mention 아님
❌ 비즈니스 객체 라벨 (quotation, purchase-order, tax-invoice 등) — mention 아님

## 가이드 분량 + 의미·관련도 (§5.11 v2)

페이지 의도와 직접 관련된 명확한 entity/concept 만. **수가 적어도 (1~3개) 관계없음**. 페이지의 핵심 주제·방법론·도구·인물·조직·표준에 해당하는 것만 선택.

❌ 추가 제외 대상 (의도/관련도 기반):
- 단순 출처 (예: "출처: X", "발급기관: Y", "개최 장소: Z")
- 단순 행사 장소 / 단순 인용
- 1회 등장 + action/property/relation 서술 없는 단순 명칭
- 단편적 사실 (날짜·일정·단순 위치) 자체
- 페이지 의도와 약한 관련의 고유명사 (page intent 와 1-hop relation 없음)

## 출력 형식 (JSON only)

\`\`\`json
{
  "mentions": [
    {"name": "${EXAMPLE_ORG_BASE}", "type_hint": "organization", "evidence": "사업자등록증 발급 대상"},
    {"name": "${EXAMPLE_CONCEPT_ALIAS}", "type_hint": "standard", "evidence": "프로젝트 관리 표준 지식체계로 명시"},
    {"name": "${EXAMPLE_PRODUCT_BASE}", "type_hint": "product", "evidence": "이 문서가 소개하는 제품명"}
  ]
}
\`\`\`

## 위키링크 규칙 (§5.21 — wikilink target)

위키링크 target 은 canonical slug 만 사용. **파일 확장자 (\`.md\` / \`.pdf\` / \`.docx\` 등) 포함 금지**, raw filename 그대로 사용 금지 — 소문자·하이픈 구분의 canonical slug 로 변환된 형태만 emit.

## 청크 본문

{{CHUNK_CONTENT}}`

// Legacy v5 extractor (kept for fallback / reference, NOT called in v6 flow)
async function callLLMForExtraction(
  llm: LLMClient, chunkContent: string, sourceFilename: string,
  provider: string, model: string,
): Promise<IngestRawResult> {
  const today = formatLocalDate(new Date())
  // v5: revert to v2-equivalent prompt (concise blocking) + drop existingPagesHint (v3/v4 lessons:
  // longer prompts trigger LLM to extract MORE, not less). Dedup/autoFill in code instead.
  const prompt = `이 문서 청크에서 **진짜로 재사용 가능한** 엔티티/개념만 추출하세요.

Source: ${sourceFilename}

## 엔티티 선정 기준 (고유명사 — entities)
- 문서의 **핵심 주체**이거나 **다른 소스에서 반복 참조될 가능성이 높을 때만** 생성합니다.
- ❌ 제외 (absolute):
  - 화면 라벨·버튼명·메뉴 항목·UI 텍스트
  - 발급기관·서명자·푸터 기관명·1회 언급 주변 인물

## 개념 선정 기준 (추상 명사 — concepts)
- **독립적 설명 가치가 있는 업계 표준·제도·방법론·문서유형**만 생성합니다.
- 예시(GOOD): \`pmbok\`, \`work-breakdown-structure\`, \`gantt-chart\`, \`erp\`, \`mes\`, \`supply-chain-management\`, \`electronic-approval-system\`
- ❌ 제외 (absolute):
  - **UI 기능명·메뉴 라벨·화면 이름**: announcement, address-book, all-services, access-rights, actual-work-time, add-schedule, application-details, mobile-app-service 등
  - **소프트웨어 기능 항목**: "공지 등록", "일정 추가", "결재 목록" 같은 것들은 **소프트웨어 기능 설명**이지 **독립 개념**이 아닙니다 — source 페이지 본문에서 설명하면 충분
  - 업종 분류명·빈 폼 필드·일회성 라벨·관용구
  - 비즈니스 객체 이름 (quotation, purchase-order, tax-invoice 등): 데이터 모델이지 산업 표준 개념이 아니면 제외

## 가이드 상한 (엄격한 cap 아님)
- 청크당 entities 0~5개, concepts 0~10개 정도가 건전합니다.
- 필터 기준을 만족한다면 더 많아도 OK. 만족 안 하면 0개도 OK.
- **제품 문서에서 "기능 목록 전체"를 concept으로 만드는 패턴은 반드시 피하세요.**

## 환각 방지
- 문서에 **명시적으로 등장한** 것만. 없는 개념을 추론해 만들지 마세요.
- 애매하면 만들지 않습니다. 부족한 것이 과도한 것보다 낫습니다.

## 출력 형식
JSON only:
\`\`\`json
{
  "source_page": {"filename": "source-placeholder.md", "content": ""},
  "entities": [{"filename": "entity-name.md", "content": "---\\ntitle: Name\\ntype: entity\\ncreated: ${today}\\nupdated: ${today}\\nsources: [${sourceFilename}]\\ntags: []\\n---\\n\\n# Name\\n\\nDescription..."}],
  "concepts": [{"filename": "concept-name.md", "content": "---\\ntitle: Name\\ntype: concept\\ncreated: ${today}\\nupdated: ${today}\\nsources: [${sourceFilename}]\\ntags: []\\n---\\n\\n# Name\\n\\nDescription..."}]
}
\`\`\`
filename은 항상 \`name.md\` 형식 (디렉토리 prefix 금지).

## 청크 본문
${chunkContent}`
  return callLLMWithRetry(llm, prompt, provider, model)
}

/**
 * §4.5.1.6.1: When `deterministic=true`, inject `temperature=0` + `seed=42` into
 * LLM call options so repeated extraction runs over the same prompt converge
 * (measured CV target <15%). Exported for unit testing the determinism seam.
 */
export async function callLLMWithRetry(
  llm: LLMClient, prompt: string, provider: string, model: string,
  deterministic?: boolean,
): Promise<IngestRawResult> {
  const detOpts = deterministic ? { temperature: 0, seed: 42 } : {}
  for (let attempt = 0; attempt <= MAX_JSON_RETRIES; attempt++) {
    const llmOpts = provider === 'gemini'
      ? { provider: provider as any, model, responseMimeType: 'application/json' as const, jsonMode: true, ...detOpts }
      : { provider: provider as any, model, jsonMode: true, ...detOpts }
    const response = await llm.call(prompt, llmOpts)
    const parsed = extractJsonBlock(response)
    if (parsed) return parsed
  }
  throw new Error('LLM JSON parse failed — max retries exceeded')
}

// ── v6 Phase A: normalizeBase moved to wiki-ops.ts (used by both ingest + index) ──

// ── v5: existingPagesHint REMOVED (lessons from v3/v4 — hint inflated extraction, didn't help reuse) ──
// Existing-page reuse handled in code via wikiFS.exists() check during page write (createPage upserts).

// ── v3.1 fix #2: Acronym ↔ full-name canonicalization across MERGED entity+concept pool ──

export interface DedupResult<T> { kept: T[]; removed: string[] }

export function dedupAcronymsCrossPool<T extends { filename: string; content: string }>(
  entities: readonly T[],
  concepts: readonly T[],
): { entities: T[]; concepts: T[]; removed: string[] } {
  const entBases = entities.map((e) => normalizeBase(e.filename))
  const conBases = concepts.map((c) => normalizeBase(c.filename))
  const allBases = new Set([...entBases, ...conBases])
  const removed: string[] = []
  const removedBases = new Set<string>()

  // Acronym → fullname removal (across merged pool)
  for (const base of allBases) {
    const isShortNoSep = base.length <= 6 && !base.includes('-') && !base.includes('_')
    if (!isShortNoSep) continue
    for (const otherBase of allBases) {
      if (otherBase === base) continue
      const words = otherBase.split(/[-_]/).filter(Boolean)
      if (words.length < 2) continue
      const initials = words.map((w) => w[0]?.toLowerCase() ?? '').join('')
      if (initials === base) {
        removedBases.add(base)
        removed.push(`${base} → ${otherBase}`)
        break
      }
    }
  }

  // Cross-pool exact-name dedup: same base in both pools → keep concept, drop entity
  const conceptBaseSet = new Set(conBases)
  for (const base of entBases) {
    if (removedBases.has(base)) continue
    if (conceptBaseSet.has(base)) {
      removedBases.add(`__entity__:${base}`)  // entity-only removal marker
      removed.push(`${base} (entity → concept)`)
    }
  }

  const keptEntities = entities.filter((e) => {
    const base = normalizeBase(e.filename)
    if (removedBases.has(base)) return false
    if (removedBases.has(`__entity__:${base}`)) return false
    return true
  })
  const keptConcepts = concepts.filter((c) => {
    const base = normalizeBase(c.filename)
    return !removedBases.has(base)
  })

  return { entities: keptEntities, concepts: keptConcepts, removed }
}

// ── v3.1 fix #3: Auto-fill index additions with strict dedup by base name ──

// ── v6 Phase A: autoFillIndexAdditions REMOVED. wiki-ops.updateIndex/appendLog now use writtenPages
//   for deterministic auto-fill, replacing this function entirely.
// ── v6 Phase A: extractFirstSentence moved to wiki-ops.ts.

// ── §4.5.1.5 v2: splitIntoChunks 폐지 ──
// RAG char-based chunking 은 LLM Wiki schema §19·§21 배격 대상. section-index.ts 의
// 결정적 섹션 트리 + selectRoute (FULL/SEGMENTED) 로 교체됨.

/**
 * Route SEGMENTED 의 각 섹션 호출에 peer context 를 주입한 chunk content 생성.
 * Ollama 등 소형 context provider 에서는 섹션 body 자체가 budget 을 초과할 수 있어
 * truncateSource 를 섹션 단위로 적용.
 */
function buildSectionWithPeer(peer: string, section: Section, isLocal: boolean): string {
  const body = isLocal ? truncateSource(section.body) : section.body
  return `${peer}\n\n---\n\n## §${section.idx} ${section.title}\n\n${body}`
}

/**
 * §4.5.1.5.6 Phase C 근거 데이터 — source 페이지 body 끝에 섹션 TOC append.
 * 쿼리 시 LLM 이 "이 섹션은 미심독됐다" 판단 가능한 결정적 메타 제공.
 * Idempotent: 이미 "## 섹션 인덱스" 가 있으면 중복 없이 교체.
 */
export function appendSectionTOCToSource(
  sourcePageContent: string,
  sectionIndex: SectionIndex,
): string {
  const toc = formatSourceTOC(sectionIndex)
  const base = sourcePageContent.trimEnd()
  // 기존 TOC 가 있으면 제거 후 재부착 (idempotent)
  const withoutExisting = base.replace(/\n*## 섹션 인덱스[\s\S]*$/m, '').trimEnd()
  return `${withoutExisting}\n\n${toc}\n`
}

interface IngestRawResult {
  source_page: { filename: string; content: string }
  entities?: Array<{ filename: string; content: string }>
  concepts?: Array<{ filename: string; content: string }>
  index_additions?: string[]
  log_entry?: string
  /** Optional: LLM self-report on how user guide_hint was reflected. Populated when guideHint was provided. */
  guide_reflection?: string
}

export function extractJsonBlock(text: string): IngestRawResult | null {
  // Try ```json ... ``` block first
  const codeBlockMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]) as IngestRawResult
    } catch {
      // fall through
    }
  }

  // Try bare JSON object
  const braceMatch = text.match(/\{[\s\S]*\}/)
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]) as IngestRawResult
    } catch {
      // fall through
    }
  }

  return null
}

export function buildIngestPrompt(
  sourceContent: string,
  sourceFilename: string,
  indexContent: string,
  templateOverride?: string,
): string {
  const today = formatLocalDate(new Date())
  const template = templateOverride ?? BUNDLED_INGEST_PROMPT
  return template
    .replaceAll('{{TODAY}}', today)
    .replace('{{INDEX_CONTENT}}', indexContent)
    .replace('{{SOURCE_FILENAME}}', sourceFilename)
    .replace('{{SOURCE_CONTENT}}', sourceContent)
}

/**
 * Inject user guide hint into the ingest prompt template.
 * The hint is added as a system-level emphasis directive the LLM must respect.
 */
export function injectGuideHint(template: string, guideHint: string): string {
  const trimmed = guideHint.trim()
  if (!trimmed) return template
  const block = `\n\n## 사용자 강조 지시 (우선 준수)\n\n> ${trimmed.replace(/\n/g, '\n> ')}\n\n위 지시를 entities/concepts 선별과 요약에 반영하세요. 반영 내역을 JSON의 최상위 \`guide_reflection\` 필드(1~2문장, 해요체)로 함께 반환하세요.\n`
  return template + block
}

/** Thrown when user cancels ingest at the Stage 2 preview gate. */
export class PlanRejectedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PlanRejectedError'
  }
}

/**
 * Generate a lightweight brief (200-300 chars, single LLM call) for Stage 1 modal.
 * Cheaper than full extraction — used only to show the user what the source is about
 * before they commit to guide direction.
 *
 * Phase 5 §5.10.1.4 AC-C1.2: 시그니처 변경 — `content` 를 직접 받는다 (변환 책임 X).
 * 호출자 (commands.ts UI flow) 가 `convertSourceToMarkdown` 결과를 미리 전달.
 * HWP/DOCX/PPTX/HTML 등 모든 포맷 brief 지원 (binary LLM 직접 전달 risk 해소).
 */
export async function generateBrief(
  content: string,
  sourceFilename: string,
  config: WikeyConfig,
  httpClient: HttpClient,
  opts?: {
    basePath?: string
    // Phase 5 §5.8: brief 생성도 LLM 호출이므로 ingest 와 동일한 PII 정책을 따른다.
    piiGuardEnabled?: boolean
  },
): Promise<string> {
  // Phase 5 §5.8: brief 의 LLM 입력 (filename + content sample) 에도 동일 PII 패턴 적용.
  // brief 결과는 사용자에게 시각적으로 노출되므로 mask 기본. guardEnabled=false 면 bypass.
  const guard = opts?.piiGuardEnabled ?? true
  const piiPatterns = loadPiiPatterns(opts?.basePath)
  const sample = content.slice(0, 6000)
  const llmSample = guard ? sanitizeForLlmPrompt(sample, { guardEnabled: true }, piiPatterns) : sample
  const llmFilename = sanitizeForLlmPrompt(sourceFilename, { guardEnabled: guard }, piiPatterns)

  const { provider, model } = resolveProvider('ingest', config)
  const llm = new LLMClient(httpClient, config)

  const prompt = `다음 문서의 핵심 포인트를 2~4문장(총 150~300자)으로 요약하세요. 존댓말(해요체). 목록·제목·마크다운 없이 평문.

문서: ${llmFilename}

${llmSample}`

  console.info(`[Wikey brief] start: provider=${provider} model=${model} file=${sourceFilename}`)
  try {
    const resp = await llm.call(prompt, { provider: provider as any, model, timeout: 60000 })
    return (resp ?? '').trim()
  } catch (err) {
    const msg = errorMessage(err)
    console.error(`[Wikey brief] failed — provider=${provider} model=${model} error=${msg}`, err)
    return `(brief 생성 실패 · provider=${provider} · model=${model}\n${msg})`
  }
}

async function buildPlan(
  wikiFS: WikiFS,
  sourceFilename: string,
  parsed: IngestRawResult,
): Promise<IngestPlan> {
  const sourceName = parsed.source_page!.filename
  const sourceExisted = await wikiFS.exists(`wiki/sources/${sourceName}`)
  const entities = await Promise.all(
    (parsed.entities ?? []).map(async (e) => ({
      filename: e.filename,
      existed: await wikiFS.exists(`wiki/entities/${e.filename}`),
    })),
  )
  const concepts = await Promise.all(
    (parsed.concepts ?? []).map(async (c) => ({
      filename: c.filename,
      existed: await wikiFS.exists(`wiki/concepts/${c.filename}`),
    })),
  )
  return {
    sourceFilename,
    guideReflection: parsed.guide_reflection ?? '',
    sourcePage: { filename: sourceName, existed: sourceExisted },
    entities,
    concepts,
    indexAdditions: parsed.index_additions?.length ?? 0,
    hasLogEntry: !!parsed.log_entry,
  }
}

// ── §4.3.1 Stage 1/2/3 프롬프트 override ──
//
//   Stage 1 summary:    `.wikey/stage1_summary_prompt.md`   (legacy fallback: `.wikey/ingest_prompt.md`)
//   Stage 2 mentions:   `.wikey/stage2_mention_prompt.md`
//   Stage 3 canonical:  `.wikey/stage3_canonicalize_prompt.md`
//
// 각 override 는 bundled 기본을 **완전 대체**하되 `{{...}}` 템플릿 변수는 같은 이름으로
// 계산된다. 예컨대 Stage 3 override 에서 `{{MENTIONS_BLOCK}}` 치환자를 제거하면
// canonicalizer 는 mention 을 못 본 채 작동해 결과가 깨진다 — 사용자 책임.
// settings-tab UI 에 inline 경고 + bundled 템플릿 주석으로 완화.

/** Stage 1 override canonical path. */
export const STAGE1_SUMMARY_PROMPT_PATH = '.wikey/stage1_summary_prompt.md'
/** Legacy alias — still honored as a fallback when the canonical name is absent. */
export const INGEST_PROMPT_PATH = '.wikey/ingest_prompt.md'
/** Stage 2 override canonical path. */
export const STAGE2_MENTION_PROMPT_PATH = '.wikey/stage2_mention_prompt.md'
/** Stage 3 override canonical path. */
export const STAGE3_CANONICALIZE_PROMPT_PATH = '.wikey/stage3_canonicalize_prompt.md'

export interface PromptLoadResult {
  readonly prompt: string
  readonly overridden: boolean
  readonly source: 'bundled' | 'stage1' | 'legacy-ingest' | 'stage2' | 'stage3'
}

/**
 * Load the effective Stage 1 prompt template.
 * - If `.wikey/stage1_summary_prompt.md` exists, return its content (full override).
 * - Else-if `.wikey/ingest_prompt.md` exists (legacy), return it.
 * - Else, return the bundled default.
 */
export async function loadEffectiveIngestPrompt(wikiFS: WikiFS): Promise<string> {
  const res = await loadEffectiveStage1Prompt(wikiFS)
  return res.prompt
}

/** Structured variant for settings UI (shows whether override is active). */
export async function loadEffectiveStage1Prompt(wikiFS: WikiFS): Promise<PromptLoadResult> {
  try {
    if (await wikiFS.exists(STAGE1_SUMMARY_PROMPT_PATH)) {
      return { prompt: await wikiFS.read(STAGE1_SUMMARY_PROMPT_PATH), overridden: true, source: 'stage1' }
    }
  } catch { /* fall through */ }
  try {
    if (await wikiFS.exists(INGEST_PROMPT_PATH)) {
      return { prompt: await wikiFS.read(INGEST_PROMPT_PATH), overridden: true, source: 'legacy-ingest' }
    }
  } catch { /* fall through */ }
  return { prompt: BUNDLED_INGEST_PROMPT, overridden: false, source: 'bundled' }
}

export async function loadEffectiveStage2Prompt(wikiFS: WikiFS): Promise<PromptLoadResult> {
  try {
    if (await wikiFS.exists(STAGE2_MENTION_PROMPT_PATH)) {
      return { prompt: await wikiFS.read(STAGE2_MENTION_PROMPT_PATH), overridden: true, source: 'stage2' }
    }
  } catch { /* fall through */ }
  return { prompt: BUNDLED_STAGE2_MENTION_PROMPT, overridden: false, source: 'bundled' }
}

export async function loadEffectiveStage3Prompt(wikiFS: WikiFS): Promise<PromptLoadResult> {
  try {
    if (await wikiFS.exists(STAGE3_CANONICALIZE_PROMPT_PATH)) {
      return { prompt: await wikiFS.read(STAGE3_CANONICALIZE_PROMPT_PATH), overridden: true, source: 'stage3' }
    }
  } catch { /* fall through */ }
  return { prompt: '', overridden: false, source: 'bundled' }
  // bundled 본체는 canonicalizer.ts::buildCanonicalizerPrompt 가 생성한다 (변수 치환 다수).
  // overridden=true 일 때만 이 prompt 가 Stage 3 에 주입되며, 없으면 bundled 로직 그대로.
}

/** Bundled default ingest prompt template (used when no user override exists). */
export const BUNDLED_INGEST_PROMPT = `당신은 wikey LLM Wiki의 인제스트 에이전트입니다.
아래 소스를 분석하여 위키 페이지를 생성하세요.

## 컨벤션

### 프론트매터 (모든 페이지 필수)
\`\`\`yaml
---
title: 페이지 제목 (원문 표기 — 본문 언어 그대로)
type: entity | concept | source
created: {{TODAY}}
updated: {{TODAY}}
sources: [source-name.md]
aliases: [영문 slug, 다른 언어 표기, 약어]
tags: [태그1, 태그2]
---
\`\`\`

**title 원문 보존 규칙** (필수):
- \`title\` 은 **소스 본문에 등장한 표기 그대로** (한국어 / 일본어 / 중국어 / 영문). 본문이 한국어면 한국어 title, 영문이면 영문 title.
- \`aliases\` 에 다른 언어 표기 (한국어 본문이면 영문 slug + 영어 표기 alias / 영문 본문이면 한국어 표기 alias) + 약어 + 풀네임 변형 모두 포함.
- 한국어 source 의 entity / concept page title 이 영문 slug 으로 영문화되지 않도록 — 영문 slug 은 filename 만, title 은 원문.

### 파일명 규칙
- 소문자, 하이픈 구분 (예: my-page-name.md)
- 소스 페이지: source-{name}.md
- **\`source_page.filename\` 은 반드시 \`source-\` prefix 로 시작** — 예: \`source-pmbok-overview.md\`. 다른 prefix (\`raw-\`, \`archive-\` 등) 또는 prefix 없음 → 무효 (자동 force prepend).
- 엔티티: wiki/entities/ — 문서의 **핵심 주체**이거나 **다른 소스에서 반복 참조될 가능성이 높을 때만** 생성합니다. 발급기관·서명자·푸터의 기관명·1회 언급 주변 인물은 source 페이지 본문에만 남기고 별도 페이지로 만들지 마세요.
- 개념: wiki/concepts/ — **독립적 설명 가치가 있는 제도·방법론·문서유형**만 생성합니다. 업종 분류명, 빈 폼 필드, 일회성 라벨, 관용구는 concept로 승격하지 마세요.

### 분할 상한 (llm-wiki.md "단일 소스 → 10-15 페이지"는 복잡한 논문·기사 기준)
- **단순 서류** (등록증·증명서·영수증·신청서·명함·양식): source 1 + entity 1~2 + concept 1~3 이하
- **기술 매뉴얼·제품 문서**: source 1 + entity 2~5 + concept 3~8
- **논문·기사·심층 리포트**: llm-wiki.md 기준 10-15 페이지까지 허용

### 환각 방지
- 문서에 **명시적으로 등장한** 고유명사·개념만 페이지로 만듭니다. 문서에 없는 주변 지식을 추론해 새 페이지를 만들지 마세요.
- 애매하면 만들지 않습니다. 부족한 것이 과도한 것보다 낫습니다.

### 위키링크
- \`[[page-name]]\` 형식
- 이미 존재하는 페이지와 연결하세요
- 생성한 모든 entity/concept를 source 페이지 본문에서 최소 1회 \`[[wikilink]]\`로 참조하세요 (고아 페이지 방지)
- **언어 보존**: filename 은 영문 slug (소문자·하이픈) 이지만, 본문 wikilink 의 anchor display 는 **원문 본문에 등장한 표기 그대로** 사용하세요. 한국어/일본어/중국어 등 비-영문 표기로 본문에 등장하면 \`[[english-slug|한국어 표기]]\` 형식으로 alias display 를 명시. 영문이 본문에 같이 등장하면 영문 anchor 가능. 본문 언어와 다른 언어로 anchor 를 강제 변환하지 마세요.

### 현재 인덱스 (이미 존재하는 페이지)
{{INDEX_CONTENT}}

## 소스 파일
파일명: {{SOURCE_FILENAME}}

{{SOURCE_CONTENT}}

## 출력 형식

반드시 아래 JSON 형식으로 출력하세요. JSON만 출력하고, 다른 텍스트는 포함하지 마세요.

\`\`\`json
{
  "source_page": {
    "filename": "source-example.md",
    "content": "---\\ntitle: ...\\n---\\n\\n# 제목\\n\\n내용..."
  },
  "entities": [
    {
      "filename": "entity-name.md",
      "content": "---\\ntitle: ...\\n---\\n\\n# 제목\\n\\n내용..."
    }
  ],
  "concepts": [
    {
      "filename": "concept-name.md",
      "content": "---\\ntitle: ...\\n---\\n\\n# 제목\\n\\n내용..."
    }
  ],
  "index_additions": [
    "- [[page-name]] — 한 줄 설명 (소스: 1개)"
  ],
  "log_entry": "- 소스 요약 생성: [[source-name]]\\n- 엔티티 생성: [[entity1]]\\n- 개념 생성: [[concept1]]\\n- 인덱스 갱신"
}
\`\`\``

// §4.5.1.5 v2: Ollama 전용 hard-cap. 섹션 단위로 적용되므로 Route SEGMENTED 의 단일 섹션이
// budget 을 초과하는 예외 케이스에만 작동. FULL 경로 large-doc 분기는 삭제됨 — selectRoute 가 처리.
const TRUNCATE_LIMIT = 12_000

interface OcrEndpoint {
  readonly baseUrl: string
  readonly apiKey: string
  readonly model: string
  readonly providerLabel: string
}

export function resolveOcrEndpoint(config?: WikeyConfig): OcrEndpoint {
  const ollamaBase = (config?.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '') + '/v1'
  const explicitProvider = config?.OCR_PROVIDER
  const explicitModel = config?.OCR_MODEL
  const fallbackProvider = config?.WIKEY_BASIC_MODEL || 'ollama'
  const provider = (explicitProvider || fallbackProvider).toLowerCase()

  switch (provider) {
    case 'gemini':
      return {
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        apiKey: config?.GEMINI_API_KEY || '',
        model: explicitModel || PROVIDER_VISION_DEFAULTS.gemini,
        providerLabel: 'gemini',
      }
    case 'openai':
      return {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: config?.OPENAI_API_KEY || '',
        model: explicitModel || PROVIDER_VISION_DEFAULTS.openai,
        providerLabel: 'openai',
      }
    case 'anthropic':
      // Anthropic은 markitdown-ocr가 요구하는 OpenAI-compat vision 호출 미지원 → Ollama fallback
      return {
        baseUrl: ollamaBase,
        apiKey: 'ollama',
        model: explicitModel || PROVIDER_VISION_DEFAULTS.ollama,
        providerLabel: 'ollama (anthropic fallback)',
      }
    case 'ollama':
    default:
      return {
        baseUrl: ollamaBase,
        apiKey: 'ollama',
        model: explicitModel || PROVIDER_VISION_DEFAULTS.ollama,
        providerLabel: 'ollama',
      }
  }
}

/**
 * HWP/HWPX → Markdown via unhwp (base64 embedded) → strip to placeholders.
 */
export async function extractHwpText(
  sourcePath: string,
  basePath?: string,
  execEnv?: Record<string, string>,
): Promise<string> {
  const { join } = require('node:path') as typeof import('node:path')
  const { mkdtempSync, readFileSync, rmSync } = require('node:fs') as typeof import('node:fs')
  const os = require('node:os') as typeof import('node:os')
  const cwd = basePath ?? process.cwd()
  const fullPath = join(cwd, sourcePath)
  const log = (msg: string, ...rest: unknown[]) => console.info(`[Wikey ingest][hwp-extract] ${msg}`, ...rest)
  const warn = (msg: string, ...rest: unknown[]) => console.warn(`[Wikey ingest][hwp-extract] ${msg}`, ...rest)
  const env = execEnv ? { ...execEnv } : { ...process.env } as Record<string, string>
  env.PATH = ['/opt/homebrew/bin', '/usr/local/bin', env.PATH ?? ''].join(':')

  // 캐시 조회 (converter='unhwp', options 없음 — 변환 옵션 현재 고정)
  let sourceBytes: Buffer
  try { sourceBytes = readFileSync(fullPath) } catch (err) {
    warn(`read source failed: ${errorMessage(err)}`)
    return ''
  }
  const cacheKey = computeCacheKey({ sourceBytes, converter: 'unhwp' })
  const cached = getCached(cacheKey)
  if (cached != null) {
    log(`cache hit — unhwp (${cached.content.length} chars)`)
    return cached.content
  }

  const scriptPath = join(cwd, 'scripts', 'vendored', 'unhwp-convert.py')
  const tmpDir = mkdtempSync(join(os.tmpdir(), 'wikey-hwp-'))
  log(`start: ${fullPath} → ${tmpDir}`)
  try {
    const { stdout } = await execFileAsync('python3', [
      scriptPath, fullPath, tmpDir,
    ], { timeout: 60000, maxBuffer: 50 * 1024 * 1024, env })
    const mdPath = stdout.trim().split('\n').pop() ?? ''
    if (!mdPath) {
      warn('unhwp convert returned empty path')
      return ''
    }
    const md = readFileSync(mdPath, 'utf-8')
    const counts = countEmbeddedImages(md)
    const stripped = stripEmbeddedImages(md)
    log(`unhwp OK — ${md.length} chars (raw), ${stripped.length} chars (stripped), images=${counts.dataUri}+${counts.externalUrl}`)
    setCached(cacheKey, stripped, { source: sourcePath, converter: 'unhwp' })
    return stripped
  } catch (err: unknown) {
    warn(`unhwp error: ${errorMessage(err)}`)
    return ''
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* cleanup best-effort */ }
  }
}

/**
 * 일반 문서(DOCX/PPTX/XLSX/HTML/이미지/CSV) → Markdown via docling CLI.
 * PDF 는 extractPdfText 의 전체 tier 체인을 타고, 이 함수는 docling 단일 경로만 시도.
 */
export async function extractDocumentText(
  sourcePath: string,
  basePath?: string,
  execEnv?: Record<string, string>,
  config?: WikeyConfig,
): Promise<string> {
  const { join } = require('node:path') as typeof import('node:path')
  const cwd = basePath ?? process.cwd()
  const fullPath = join(cwd, sourcePath)
  const log = (msg: string, ...rest: unknown[]) => console.info(`[Wikey ingest][doc-extract] ${msg}`, ...rest)
  const warn = (msg: string, ...rest: unknown[]) => console.warn(`[Wikey ingest][doc-extract] ${msg}`, ...rest)
  const env = execEnv ? { ...execEnv } : { ...process.env } as Record<string, string>
  env.PATH = ['/opt/homebrew/bin', '/usr/local/bin', env.PATH ?? ''].join(':')

  if (config?.DOCLING_DISABLE) {
    warn('docling disabled via DOCLING_DISABLE — extractDocumentText returns empty')
    return ''
  }

  // 캐시 조회 (옵션까지 키에 포함)
  const { readFileSync: rf } = require('node:fs') as typeof import('node:fs')
  let sourceBytes: Buffer
  try { sourceBytes = rf(fullPath) } catch (err) {
    warn(`read source failed: ${errorMessage(err)}`)
    return ''
  }
  const majorOptions = doclingMajorOptions(config)
  const cacheKey = computeCacheKey({ sourceBytes, converter: 'docling', majorOptions })
  const cached = getCached(cacheKey)
  if (cached != null) {
    log(`cache hit — docling (${cached.content.length} chars)`)
    return cached.content
  }

  const { mkdtempSync, rmSync } = require('node:fs') as typeof import('node:fs')
  const os = require('node:os') as typeof import('node:os')
  const tmpDir = mkdtempSync(join(os.tmpdir(), 'wikey-docling-'))
  const args = buildDoclingArgs(fullPath, tmpDir, config)
  const timeout = config?.DOCLING_TIMEOUT_MS ?? 300000
  try {
    await execFileAsync('docling', args, {
      timeout, maxBuffer: 100 * 1024 * 1024, env,
    })
    const md = readDoclingOutput(tmpDir, fullPath)
    if (!md) {
      warn('docling produced empty output')
      return ''
    }
    const counts = countEmbeddedImages(md)
    const stripped = stripEmbeddedImages(md)
    log(`docling OK — ${md.length} chars (raw), ${stripped.length} chars (stripped), images=${counts.dataUri}+${counts.externalUrl}`)
    setCached(cacheKey, stripped, { source: sourcePath, converter: 'docling' })
    return stripped
  } catch (err: unknown) {
    warn(`docling error: ${errorMessage(err)}`)
    return ''
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* cleanup best-effort */ }
  }
}

/**
 * Docling tier mode (§4.1.3.1).
 *   - 'default'  : Tier 1. docling CLI 기본값 그대로. bitmap OCR 은 docling 기본 (--ocr) 이 활성.
 *   - 'no-ocr'   : Tier 1a. image-ocr-pollution 감지 시 escalation. bitmap OCR 억제.
 *   - 'force-ocr': Tier 1b. korean-whitespace-loss / scan-pdf 감지 시 escalation. vector text 무시하고 전체 OCR.
 */
export type DoclingMode = 'default' | 'no-ocr' | 'force-ocr'

/**
 * 기본 OCR engine — platform 별 fallback.
 *   - macOS: ocrmac (Apple Vision, ANE 가속, 한국어 우수)
 *   - 그 외 (Linux/Windows): rapidocr (paddleOCR 모델 탑재, cross-platform)
 */
export function defaultOcrEngine(): string {
  return process.platform === 'darwin' ? 'ocrmac' : 'rapidocr'
}

/**
 * 기본 OCR 언어 코드 — engine 별로 다른 형식 (docling 공식 소스 확증):
 *   - ocrmac     : BCP-47 (`ko-KR`, `en-US`)
 *   - rapidocr   : 언어명 (`korean`, `english`) — paddleOCR 모델 파일명
 *   - easyocr    : ISO 639-1 (`ko`, `en`)
 *   - tesseract  : ISO 639-2 (`kor`, `eng`)
 * 사용자 명시적 `DOCLING_OCR_LANG` 설정이 없으면 engine 에 맞는 기본값 반환.
 */
export function defaultOcrLangForEngine(engine: string): string {
  switch (engine) {
    case 'ocrmac':
      return 'ko-KR,en-US'
    case 'rapidocr':
      return 'korean,english'   // paddleOCR Korean + English 모델
    case 'easyocr':
      return 'ko,en'
    case 'tesseract':
    case 'tesserocr':
      return 'kor,eng'
    default:
      return 'ko-KR,en-US'      // fallback (unknown engine)
  }
}

/** docling 옵션 중 캐시 키에 포함할 것들 (결과 달라지는 옵션만). §4.1.3.1: `mode` 필드로 Tier 1/1a/1b 캐시 분리. */
export function doclingMajorOptions(config?: WikeyConfig, mode: DoclingMode = 'default'): Record<string, unknown> {
  const engine = config?.DOCLING_OCR_ENGINE || defaultOcrEngine()
  return {
    mode,
    table_mode: config?.DOCLING_TABLE_MODE || 'accurate',
    ocr_engine: engine,
    ocr_lang: config?.DOCLING_OCR_LANG || defaultOcrLangForEngine(engine),
    image_export_mode: 'embedded',
  }
}

/**
 * Docling CLI args 빌드 (§4.1.3.1 — mode 파라미터). `--output` 은 디렉토리만 받으므로 tmp dir 지정 (stdout 미지원).
 */
export function buildDoclingArgs(
  fullPath: string,
  outputDir: string,
  config?: WikeyConfig,
  mode: DoclingMode = 'default',
): string[] {
  const tableMode = config?.DOCLING_TABLE_MODE || 'accurate'
  const device = config?.DOCLING_DEVICE || (process.platform === 'darwin' ? 'mps' : 'cpu')
  const ocrEngine = config?.DOCLING_OCR_ENGINE || defaultOcrEngine()
  const ocrLang = config?.DOCLING_OCR_LANG || defaultOcrLangForEngine(ocrEngine)
  const args = [
    fullPath,
    '--to', 'md',
    '--output', outputDir,
    '--table-mode', tableMode,
    '--device', device,
    '--image-export-mode', 'embedded',   // strip 함수가 후처리
  ]
  switch (mode) {
    case 'default':
      // Tier 1: docling CLI 기본값 그대로 (bitmap OCR on by Docling default).
      args.push('--ocr-engine', ocrEngine, '--ocr-lang', ocrLang)
      break
    case 'no-ocr':
      // Tier 1a: image-ocr-pollution escalation. bitmap OCR 억제.
      args.push('--no-ocr')
      break
    case 'force-ocr':
      // Tier 1b: korean-whitespace-loss / scan-pdf escalation. vector text 무시, 전체 OCR.
      args.push('--force-ocr', '--ocr-engine', ocrEngine, '--ocr-lang', ocrLang)
      break
  }
  return args
}

/**
 * docling 이 지정된 output 디렉토리에 생성한 .md 파일을 찾아 내용 반환.
 * docling 은 `<source-stem>.md` 로 저장 (예: rp1-peripherals.pdf → rp1-peripherals.md).
 */
function readDoclingOutput(outputDir: string, sourcePath: string): string {
  const { readdirSync, readFileSync: rf } = require('node:fs') as typeof import('node:fs')
  const path = require('node:path') as typeof import('node:path')
  const srcBase = path.basename(sourcePath).replace(/\.[^.]+$/, '')
  try {
    const files = readdirSync(outputDir)
    // 정확한 stem 매칭 우선, 없으면 첫 .md 파일
    const exact = files.find((f) => f === `${srcBase}.md`)
    const anyMd = exact ?? files.find((f) => f.endsWith('.md'))
    if (!anyMd) return ''
    return rf(path.join(outputDir, anyMd), 'utf-8')
  } catch {
    return ''
  }
}

/**
 * PDF 추출 결과. Phase 4 D.0.b (v6 §4.1.3) 에서 `string` → object 로 승격.
 *   - `stripped`: LLM 투입용 (이미지 base64 제거된 본문). 항상 존재.
 *   - `sidecarCandidate`: 파일시스템 sidecar 후보 — vector PDF 면 raw (이미지 포함),
 *     scan/small-doc 이면 stripped 와 동일. caller 가 중앙 PII wrapper 통과 후 저장.
 */
export interface PdfExtractResult {
  readonly stripped: string
  readonly sidecarCandidate: string
}

export async function extractPdfText(
  sourcePath: string,
  basePath?: string,
  execEnv?: Record<string, string>,
  config?: WikeyConfig,
): Promise<PdfExtractResult> {
  const { join } = require('node:path') as typeof import('node:path')
  const cwd = basePath ?? process.cwd()
  const fullPath = join(cwd, sourcePath)
  const log = (msg: string, ...rest: unknown[]) => console.info(`[Wikey ingest][pdf-extract] ${msg}`, ...rest)
  const warn = (msg: string, ...rest: unknown[]) => console.warn(`[Wikey ingest][pdf-extract] ${msg}`, ...rest)
  const accept = (tier: string, out: string, minChars = 50): string | null => {
    const text = out.trim()
    if (text.length > minChars) {
      log(`tier ${tier} OK — ${text.length} chars`)
      return text
    }
    log(`tier ${tier} rejected — ${text.length} chars below threshold (${minChars})`)
    return null
  }
  // §4.1.3 (D.0.b): sidecar 저장 권한은 caller 에게 위임. finalize 는 raw vs stripped 판단만 수행.
  //   - 스캔 PDF / 기존 OCR 저장 소규모 폼 (사업자등록증 등): 이미지가 이미 텍스트에
  //     들어가 있어 base64 embedded 가 중복 → sidecarCandidate = stripped.
  //   - vector PDF (diagram/chart 의미 있는 경우): sidecarCandidate = raw.
  const finalize = (md: string, tierKey: string): PdfExtractResult => {
    const counts = countEmbeddedImages(md)
    const stripped = stripEmbeddedImages(md)
    if (counts.dataUri || counts.externalUrl) {
      log(`image placeholder — data=${counts.dataUri}, url=${counts.externalUrl}, ${md.length}→${stripped.length} chars`)
    }
    const useStripped = hasRedundantEmbeddedImages(md, stripped, pdfPageCount, tierKey)
    const sidecarCandidate = useStripped ? stripped : md
    if (sourceBytes && stripped) {
      const cacheKey = computeCacheKey({
        sourceBytes,
        converter: `pdf:${tierKey}`,
        majorOptions: doclingMajorOptions(config),
      })
      // Phase 5 §5.10.1.9 AC-C1.7: vector PDF 의 raw 이미지 보존 — sidecarCandidate 도 cache.
      setCached(cacheKey, stripped, {
        source: sourcePath,
        converter: `pdf:${tierKey}`,
        sidecarCandidate,
      })
    }
    log(`sidecar candidate ready (${useStripped ? 'stripped — scan/small-doc images redundant' : 'raw — vector PDF, images kept'}) — ${sidecarCandidate.length} chars, tier=${tierKey}`)
    return { stripped, sidecarCandidate }
  }

  // PATH 보강 (Electron 환경에서 homebrew 등 누락 방지)
  const env = execEnv ? { ...execEnv } : { ...process.env } as Record<string, string>
  const extraPaths = ['/opt/homebrew/bin', '/usr/local/bin']
  env.PATH = [...extraPaths, env.PATH ?? ''].join(':')

  // 캐시 조회 — 가장 흔한 경로(docling tier 1)를 선조회. 다른 tier 로 귀결되면 finalize() 가 해당 키로 재저장.
  const { readFileSync: rf } = require('node:fs') as typeof import('node:fs')
  let sourceBytes: Buffer | null = null
  try {
    sourceBytes = rf(fullPath)
    const doclingKey = computeCacheKey({
      sourceBytes: sourceBytes!,
      converter: 'pdf:1-docling',
      majorOptions: doclingMajorOptions(config),
    })
    const cached = getCached(doclingKey)
    if (cached != null && !config?.DOCLING_DISABLE) {
      log(`cache hit — pdf:1-docling (${cached.content.length} chars)`)
      // Phase 5 §5.10.1.9 AC-C1.7: 새 schema 면 sidecarCandidate distinct (vector PDF raw 보존).
      // legacy fallback 면 sidecarCandidate = content (결함 b 가 자연 회복될 때까지).
      return {
        stripped: cached.content,
        sidecarCandidate: cached.sidecarCandidate ?? cached.content,
      }
    }
  } catch (err) {
    warn(`read source for cache failed: ${errorMessage(err)}`)
  }

  // Page-aware threshold for OCR-style tiers (markitdown-ocr / Vision render).
  // Vector-only PDFs trick markitdown-ocr into emitting a few cover-image OCR chars
  // for many pages — we need to require chars-per-page above a floor.
  // §4.1.3: source PDF 이미지 덮힘률로 scan 감지 병행.
  //   MD 기반 `isLikelyScanPdf` 는 docling bitmap OCR 결과를 입력받아 GOODSTREAM 같은
  //   "기존 OCR 저장 스캔본" 을 놓침. pymupdf 로 페이지 대비 이미지 면적 비율 직접 측정.
  let pdfPageCount = 0
  let scanRatioBySource = 0
  let textLayerChars = 0
  let textLayerKoreanChars = 0
  try {
    const { stdout } = await execFileAsync('python3', [
      '-c',
      `import fitz, sys, json
doc = fitz.open(sys.argv[1])
pages = len(doc)
scan_like = 0
all_text = ''
for page in doc:
    all_text += page.get_text()
    pa = page.rect.width * page.rect.height
    if pa <= 0:
        continue
    max_ratio = 0.0
    for img_info in page.get_images(full=True):
        try:
            bbox = page.get_image_bbox(img_info)
            ia = bbox.width * bbox.height
            if ia / pa > max_ratio:
                max_ratio = ia / pa
        except Exception:
            pass
    if max_ratio > 0.7:
        scan_like += 1
doc.close()
ratio = scan_like / pages if pages else 0
korean = sum(1 for c in all_text if '가' <= c <= '힣')
print(json.dumps({
    "pages": pages,
    "scanRatio": ratio,
    "textLayerChars": len(all_text),
    "textLayerKoreanChars": korean,
}))`,
      fullPath,
    ], { timeout: 10000, env })
    try {
      const parsed = JSON.parse(stdout.trim())
      pdfPageCount = parsed.pages || 0
      scanRatioBySource = parsed.scanRatio || 0
      textLayerChars = parsed.textLayerChars || 0
      textLayerKoreanChars = parsed.textLayerKoreanChars || 0
    } catch (_e) {
      pdfPageCount = parseInt(stdout.trim(), 10) || 0
    }
  } catch (_err) {
    pdfPageCount = 0
  }
  const ocrMinChars = (() => {
    if (pdfPageCount <= 0) return 200
    // 30 chars/page average, capped at 2000, floor at 200 (single-page brochures still pass at ~200 chars)
    return Math.min(2000, Math.max(200, pdfPageCount * 30))
  })()

  // 1. Docling (tier 1 메인 컨버터 — TableFormer + layout model + ocrmac)
  if (!config?.DOCLING_DISABLE) {
    log(`tier 1/6 start: docling — ${fullPath}`)
    const { mkdtempSync, rmSync } = require('node:fs') as typeof import('node:fs')
    const os = require('node:os') as typeof import('node:os')
    const tmpDir = mkdtempSync(join(os.tmpdir(), 'wikey-docling-'))
    try {
      const args = buildDoclingArgs(fullPath, tmpDir, config)
      const timeout = config?.DOCLING_TIMEOUT_MS ?? 300000
      await execFileAsync('docling', args, {
        timeout, maxBuffer: 100 * 1024 * 1024, env,
      })
      const md = readDoclingOutput(tmpDir, fullPath)
      const ok = accept('1 docling', md)
      if (ok) {
        // 품질 평가 — 자동 retry 조건:
        //   (a) 한국어 공백 소실 > 30% (ROHM Wi-SUN 스타일)
        //   (b) 스캔 PDF 감지 — MD 기반 OR source 이미지 덮힘률 > 0.5
        //   (c) text layer 손상 감지 — 파일명 한국어 + source text layer 한글 거의 없음
        //       (CONTRACT 같은 비표준 폰트 매핑 PDF: text layer 에 `Etr8l E` 같은 깨진 문자만)
        //   (d) §4.1.3.2 image-ocr-pollution (별도 Tier 1a 경로)
        const ratio = koreanLongTokenRatio(ok)
        const isScanByMd = isLikelyScanPdf(ok, pdfPageCount)
        const isScanBySource = scanRatioBySource > 0.5
        const { basename } = require('node:path') as typeof import('node:path')
        const filenameHasKorean = /[가-힣]/.test(basename(sourcePath))
        const textLayerCorrupted =
          filenameHasKorean &&
          textLayerChars > 500 &&
          textLayerKoreanChars < 50
        const isScan = isScanByMd || isScanBySource || textLayerCorrupted
        const perPage = bodyCharsPerPage(ok, pdfPageCount)
        const quality = scoreConvertOutput(ok, { retryOnKoreanWhitespace: true })
        log(`tier 1 docling quality — score=${quality.score.toFixed(2)}, decision=${quality.decision}, koreanLong=${(ratio * 100).toFixed(1)}%, perPage=${perPage.toFixed(0)}, isScanByMd=${isScanByMd}, isScanBySource=${isScanBySource}(${(scanRatioBySource * 100).toFixed(0)}%), textLayerCorrupted=${textLayerCorrupted}(chars=${textLayerChars},ko=${textLayerKoreanChars}), flags=[${quality.flags.join(',')}]`)
        // Tier 1 accept + scan 미감지만 즉시 finalize. scan 감지(MD/source/corrupted) 이면
        // 사용자 원칙 "scan 판정 → force-ocr 적용" 에 따라 Tier 1b 진입 (아래 shouldRetry 블록).
        if (quality.decision === 'accept' && !isScan) return finalize(ok, '1-docling')

        // Tier 1a (§4.1.3.3): image-ocr-pollution escalation — docling --no-ocr 로 재시도.
        // PMS 제품소개 스타일 (vector PDF + UI 스크린샷 embedded) 에서 bitmap OCR 파편 제거.
        // 비교 후 더 나은 쪽 채택 (false positive 방어: 실제 스캔 PDF 는 --no-ocr 로 본문 손실).
        if (quality.decision === 'retry-no-ocr') {
          log(`tier 1a/6 start: docling --no-ocr (image-ocr-pollution detected)`)
          const noOcrDir = mkdtempSync(join(os.tmpdir(), 'wikey-docling-no-ocr-'))
          try {
            const noOcrArgs = buildDoclingArgs(fullPath, noOcrDir, config, 'no-ocr')
            await execFileAsync('docling', noOcrArgs, {
              timeout, maxBuffer: 100 * 1024 * 1024, env,
            })
            const noOcrMd = readDoclingOutput(noOcrDir, fullPath)
            const noOcrOk = accept('1a docling --no-ocr', noOcrMd)
            if (noOcrOk) {
              const noOcrQ = scoreConvertOutput(noOcrOk, { retryOnKoreanWhitespace: false })
              log(`tier 1a quality — score=${noOcrQ.score.toFixed(2)}, decision=${noOcrQ.decision}, flags=[${noOcrQ.flags.join(',')}]`)
              if (noOcrQ.score > quality.score) {
                return finalize(noOcrOk, '1a-docling-no-ocr')
              }
              warn(`tier 1a score (${noOcrQ.score.toFixed(2)}) not greater than tier 1 (${quality.score.toFixed(2)}) — keeping tier 1 despite pollution`)
              return finalize(ok, '1-docling')
            }
            // noOcrOk null (본문 너무 짧음) → tier 1 유지
            warn('tier 1a --no-ocr produced insufficient body — keeping tier 1')
            return finalize(ok, '1-docling')
          } catch (err: unknown) {
            warn(`tier 1a docling --no-ocr error: ${errorMessage(err)} — keeping tier 1`)
            return finalize(ok, '1-docling')
          } finally {
            try { rmSync(noOcrDir, { recursive: true, force: true }) } catch { /* ignore */ }
          }
        }

        const shouldRetry = quality.decision === 'retry' || isScan
        if (shouldRetry) {
          // tier 1b: docling --force-ocr 로 재시도
          // 트리거: (a) 한국어 공백 소실 > 30% (ROHM 패턴), (b) 스캔 PDF 감지
          // 실측 (ROHM Wi-SUN): textlayer 60.20% → force-ocr 0.27%, korean 2,021 → 2,083 (개선)
          // 주의 (PMS 제품소개 가상 케이스): force-ocr 이 벡터 PDF 에서 한국어 0자 내는 regression 가능
          //   → 결과 비교 후 regression 감지 시 tier 1 유지.
          const reason = isScan ? 'scan PDF detected' : `koreanLong=${(ratio * 100).toFixed(1)}% > 30%`
          log(`tier 1b/6 start: docling --force-ocr (${reason})`)
          const retryDir = mkdtempSync(join(os.tmpdir(), 'wikey-docling-ocr-'))
          try {
            const retryArgs = buildDoclingArgs(fullPath, retryDir, config, 'force-ocr')
            await execFileAsync('docling', retryArgs, {
              timeout, maxBuffer: 100 * 1024 * 1024, env,
            })
            const retryMd = readDoclingOutput(retryDir, fullPath)
            const retryOk = accept('1b docling --force-ocr', retryMd)
            if (retryOk) {
              // Regression guard — force-ocr 결과가 tier 1 대비 급감하면 tier 1 채택.
              // 한국어 regression (50% 미만) + 언어 무관 본문 regression (500자+ 중 50% 미만) 이중 체크.
              // 롤백 시 source-scan 정보 유지 — Tier 1 유지하되 sidecar strip 트리거.
              const rollbackKey = isScan ? '1-docling-scan' : '1-docling'
              if (hasKoreanRegression(ok, retryOk)) {
                const baseKo = countKoreanChars(ok)
                const retryKo = countKoreanChars(retryOk)
                warn(`tier 1b korean regression — base=${baseKo} → force-ocr=${retryKo} (< 50%), falling back to tier 1`)
                return finalize(ok, rollbackKey)
              }
              if (hasBodyRegression(ok, retryOk)) {
                warn(`tier 1b body regression — force-ocr total chars < 50% of tier 1, falling back to tier 1`)
                return finalize(ok, rollbackKey)
              }
              const retryQ = scoreConvertOutput(retryOk, { retryOnKoreanWhitespace: false })
              const retryRatio = koreanLongTokenRatio(retryOk)
              log(`tier 1b quality — score=${retryQ.score.toFixed(2)}, decision=${retryQ.decision}, koreanLong=${(retryRatio * 100).toFixed(1)}%`)
              // §4.1.3: Tier 1b 원인 따라 tierKey suffix 분기.
              //   - scan origin → sidecar 이미지 strip (이미지 = OCR 소스)
              //   - korean-loss origin → sidecar 이미지 유지 (vector PDF diagram 의미 있음)
              const tier1bKey = isScan ? '1b-docling-force-ocr-scan' : '1b-docling-force-ocr-kloss'
              if (retryQ.decision === 'accept') return finalize(retryOk, tier1bKey)
              // retry 결과도 품질 미달 — tier 1 이 tier 1b 보다 나은지 보고 더 나은 쪽 채택
              const baseQ = scoreConvertOutput(ok, { retryOnKoreanWhitespace: false })
              if (baseQ.score > retryQ.score) {
                warn(`tier 1b worse than tier 1 (score ${retryQ.score.toFixed(2)} < ${baseQ.score.toFixed(2)}) — falling back to tier 1`)
                return finalize(ok, rollbackKey)
              }
              log('tier 1b still low quality — fall through to tier 2')
            }
          } catch (err: unknown) {
            warn(`tier 1b docling --force-ocr error: ${errorMessage(err)}`)
            // tier 1 은 공백 소실이 있지만 적어도 텍스트는 있음 → fallback
            warn('tier 1b failed, falling back to tier 1 despite whitespace loss')
            const rollbackKeyOnErr = isScan ? '1-docling-scan' : '1-docling'
            return finalize(ok, rollbackKeyOnErr)
          } finally {
            try { rmSync(retryDir, { recursive: true, force: true }) } catch { /* ignore */ }
          }
        }
        // decision = 'reject' → tier 2 로 폴스루 (ok 버리지 않고 finalize 하지 않음)
        log(`tier 1 docling quality insufficient — fall through to tier 2`)
      }
    } catch (err: unknown) {
      warn(`tier 1 docling error: ${errorMessage(err)}`)
    } finally {
      try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ignore */ }
    }
  } else {
    log('tier 1 docling skipped — DOCLING_DISABLE=true')
  }

  // 2. markitdown-ocr (embedded raster image OCR via Vision API)
  // Docling 이 ocrmac/tesseract 로 커버 못한 스캔본 보조. Docling 실패 시 vision fallback.
  const ocr = resolveOcrEndpoint(config)
  if (ocr.apiKey) {
    log(`tier 2/6 start: markitdown-ocr — provider=${ocr.providerLabel}, model=${ocr.model}`)
    try {
      const ocrEnv = { ...env, OPENAI_API_KEY: ocr.apiKey, OPENAI_BASE_URL: ocr.baseUrl }
      const { stdout } = await execFileAsync('python3', [
        '-c',
        `
import os, sys
from openai import OpenAI
from markitdown import MarkItDown
client = OpenAI(base_url=os.environ['OPENAI_BASE_URL'], api_key=os.environ['OPENAI_API_KEY'])
md = MarkItDown(enable_plugins=True, llm_client=client, llm_model=sys.argv[2])
result = md.convert(sys.argv[1])
print(result.text_content)
`,
        fullPath,
        ocr.model,
      ], { timeout: 900000, maxBuffer: 50 * 1024 * 1024, env: ocrEnv })
      const ok = accept(`2 markitdown-ocr (${ocr.providerLabel}/${ocr.model})`, stdout, ocrMinChars)
      if (ok) return finalize(ok, '2-markitdown-ocr')
    } catch (err: unknown) {
      warn(`tier 2 markitdown-ocr error: ${errorMessage(err)}`)
    }
  } else {
    log(`tier 2 markitdown-ocr skipped — no apiKey for provider=${ocr.providerLabel}`)
  }

  // 3. MarkItDown (docling 미설치 환경 fallback)
  log(`tier 3/6 start: markitdown (fallback)`)
  try {
    const { stdout } = await execFileAsync('python3', [
      '-c', `from markitdown import MarkItDown; r = MarkItDown().convert("${fullPath}"); print(r.text_content)`,
    ], { timeout: 30000, maxBuffer: 10 * 1024 * 1024, env })
    const ok = accept('3 markitdown', stdout)
    if (ok) return finalize(ok, '3-markitdown')
  } catch (err: unknown) {
    warn(`tier 3 markitdown error: ${errorMessage(err)}`)
  }

  // 4. pdftotext (poppler) — 텍스트 PDF 저비용 백업
  log(`tier 4/6 start: pdftotext`)
  try {
    const { stdout } = await execFileAsync('pdftotext', [fullPath, '-'], {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
      env,
    })
    const ok = accept('4 pdftotext', stdout)
    if (ok) return finalize(ok, '4-pdftotext')
  } catch (err: unknown) {
    warn(`tier 4 pdftotext error: ${errorMessage(err)}`)
  }

  // 5. pymupdf / PyPDF2 fallback
  log(`tier 5/6 start: pymupdf/PyPDF2`)
  try {
    const { stdout } = await execFileAsync('python3', [
      '-c',
      `
import sys
try:
    import fitz  # pymupdf
    doc = fitz.open(sys.argv[1])
    text = "\\n".join(page.get_text() for page in doc)
    print(text[:200000])
except ImportError:
    try:
        from PyPDF2 import PdfReader
        reader = PdfReader(sys.argv[1])
        text = "\\n".join(page.extract_text() or "" for page in reader.pages)
        print(text[:200000])
    except ImportError:
        print("")
`,
      fullPath,
    ], { timeout: 30000, maxBuffer: 10 * 1024 * 1024, env })
    const ok = accept('5 pymupdf/PyPDF2', stdout)
    if (ok) return finalize(ok, '5-pymupdf')
  } catch (err: unknown) {
    warn(`tier 5 pymupdf/PyPDF2 error: ${errorMessage(err)}`)
  }

  // 6. Page-render Vision OCR fallback (vector-only / scanned PDFs without embedded images)
  // markitdown-ocr (tier 2)는 embedded raster image만 OCR. text-as-paths나 vector-only 매뉴얼은
  // page를 PNG로 렌더 후 vision LLM에 전송해야 추출 가능.
  log(`tier 6/6 start: page-render Vision OCR — provider=${ocr.providerLabel}, model=${ocr.model}`)
  if (!ocr.apiKey) {
    warn(`tier 6 skipped — no apiKey for provider=${ocr.providerLabel}`)
    warn(`all 6 tiers failed for ${sourcePath}`)
    return { stripped: '', sidecarCandidate: '' }
  }
  const dpi = String(config?.OCR_DPI ?? 180)
  const parallel = String(config?.OCR_PARALLEL ?? 4)
  const maxPages = String(config?.OCR_MAX_PAGES ?? 200)
  try {
    const visionEnv = { ...env, OPENAI_API_KEY: ocr.apiKey, OPENAI_BASE_URL: ocr.baseUrl }
    const { stdout } = await execFileAsync('python3', [
      '-c',
      `
import os, sys, base64, time
from concurrent.futures import ThreadPoolExecutor, as_completed
import fitz
from openai import OpenAI

pdf_path, model, dpi_s, parallel_s, max_pages_s = sys.argv[1:6]
dpi = int(dpi_s)
parallel = max(1, int(parallel_s))
max_pages = int(max_pages_s)

client = OpenAI(base_url=os.environ['OPENAI_BASE_URL'], api_key=os.environ['OPENAI_API_KEY'])
doc = fitz.open(pdf_path)
total = min(len(doc), max_pages)

pages_b64 = []
for pno in range(total):
    pix = doc[pno].get_pixmap(dpi=dpi)
    pages_b64.append(base64.b64encode(pix.tobytes('png')).decode())

prompt = 'Extract all visible text from this manual page. Preserve structure (headings, lists, tables). Output the markdown text content only — do not wrap layout in HTML/CSS, do not embed images, do not add commentary.'

def ocr_page(idx_b64):
    idx, b64 = idx_b64
    for attempt in range(3):
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[{'role':'user','content':[
                    {'type':'text','text':prompt},
                    {'type':'image_url','image_url':{'url':f'data:image/png;base64,{b64}'}},
                ]}],
                max_tokens=2500,
            )
            return idx, (resp.choices[0].message.content or '').strip()
        except Exception as e:
            if attempt == 2:
                return idx, f'[OCR error page {idx+1}: {e}]'
            time.sleep(1.5 ** attempt)

results = {}
with ThreadPoolExecutor(max_workers=parallel) as ex:
    futs = [ex.submit(ocr_page, (i, b)) for i, b in enumerate(pages_b64)]
    for f in as_completed(futs):
        i, txt = f.result()
        results[i] = txt

print('\\n\\n'.join(f'## Page {i+1}\\n\\n{results[i]}' for i in range(total)))
`,
      fullPath,
      ocr.model,
      dpi,
      parallel,
      maxPages,
    ], { timeout: 1800000, maxBuffer: 100 * 1024 * 1024, env: visionEnv })
    const ok = accept(`6 page-render Vision (${ocr.providerLabel}/${ocr.model}, dpi=${dpi}, par=${parallel})`, stdout, Math.max(50, Math.floor(ocrMinChars / 2)))
    if (ok) return finalize(ok, '6-vision')
  } catch (err: unknown) {
    warn(`tier 6 page-render Vision OCR error: ${errorMessage(err)}`)
  }

  warn(`all 6 tiers failed for ${sourcePath}`)
  return { stripped: '', sidecarCandidate: '' }
}

/**
 * §4.2 Stage 1 S1-3: build v3 frontmatter + registry record for the source.
 *
 * Returns both the frontmatter block (to inject into the source page) and
 * the registry record (to upsert). If bytes cannot be read (vault FS
 * without a backing basePath), returns frontmatter only.
 */
async function buildV3SourceMeta(
  wikiFS: WikiFS,
  sourcePath: string,
  rawDiskBytes: Uint8Array,
  ext: string,
  ingestedPagePath: string,
  preservedSourceId?: string,
): Promise<{ id: string; frontmatter: SourceFrontmatter; record: SourceRecord | null }> {
  // §5.3.1 (plan v11): rawDiskBytes is now caller-supplied (Step 0 read) so we don't
  // double-read the disk. preservedSourceId, when supplied, keeps source_id stable across
  // raw bytes changes (decision 10 — wikilink/provenance영향 0).
  const bytes = rawDiskBytes
  const size = bytes.byteLength

  if (size === 0) {
    // Caller failed to read bytes — fall back to path-derived synthetic id.
    const fallback = new TextEncoder().encode(sourcePath)
    const fm: SourceFrontmatter = {
      source_id: preservedSourceId ?? computeFileId(fallback),
      vault_path: sourcePath,
      hash: computeFullHash(fallback),
      size: 0,
      first_seen: new Date().toISOString(),
    }
    return { id: fm.source_id, frontmatter: fm, record: null }
  }

  const source_id = preservedSourceId ?? computeFileId(bytes)
  const hash = computeFullHash(bytes)
  const first_seen = new Date().toISOString()

  // Sidecar exists for non-md/non-txt sources that went through a converter.
  const hasSidecar = ext && ext !== 'md' && ext !== 'txt' && !!(await wikiFS
    .exists(`${sourcePath}.md`)
    .catch(() => false))
  const sidecar_vault_path = hasSidecar ? sidecarVaultPath(sourcePath) : undefined

  const frontmatter: SourceFrontmatter = {
    source_id,
    vault_path: sourcePath,
    ...(sidecar_vault_path ? { sidecar_vault_path } : {}),
    hash,
    size,
    first_seen,
  }

  const record: SourceRecord = {
    vault_path: sourcePath,
    ...(sidecar_vault_path ? { sidecar_vault_path } : {}),
    hash,
    size,
    first_seen,
    ingested_pages: [ingestedPagePath],
    path_history: [{ vault_path: sourcePath, at: first_seen }],
    tombstone: false,
  }
  return { id: source_id, frontmatter, record }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.split('\n')[0].slice(0, 200)
  return String(err).slice(0, 200)
}

function truncateSource(text: string): string {
  if (text.length <= TRUNCATE_LIMIT) return text
  // Keep beginning and end for context
  const headSize = Math.floor(TRUNCATE_LIMIT * 0.7)
  const tailSize = Math.floor(TRUNCATE_LIMIT * 0.25)
  const head = text.slice(0, headSize)
  const tail = text.slice(-tailSize)
  const skipped = text.length - headSize - tailSize
  return `${head}\n\n[... ${skipped} chars truncated ...]\n\n${tail}`
}

const REINDEX_WAIT_DEFAULT_MS = 60_000
const REINDEX_WAIT_MAX_MS = 300_000

/**
 * Phase 4 D.0.f (v6 §4.4.3): 인제스트 직후 `reindex.sh --quick` 을 동기 실행하고
 * `waitUntilFresh` polling 으로 index 가 실제로 신선해졌는지 확인 후 반환.
 *
 * - basePath 미지정 시 process.cwd 사용.
 * - execEnv 미지정 시 process.env + 기본 추가 경로 병합 (Electron homebrew 누락 방어).
 * - 타임아웃: `WIKEY_REINDEX_TIMEOUT_MS` env (ms, 300000 cap), 미지정 시 60s.
 * - 실패는 warn 레벨로 downgrade — ingest 본체 성공 후에 index lag 은 치명적이지 않음.
 */
async function runReindexAndWait(
  basePath: string | undefined,
  execEnv: Record<string, string> | undefined,
  log: (msg: string, ...rest: unknown[]) => void,
  onIssue?: (reason: 'reindex-failed' | 'freshness-timeout', message: string) => void,
  onOk?: (durationMs: number) => void,
): Promise<void> {
  const cwd = basePath ?? process.cwd()
  const env = execEnv ? { ...execEnv } : { ...process.env } as Record<string, string>
  if (!execEnv) {
    const extraPaths = ['/usr/local/bin', '/opt/homebrew/bin']
    env.PATH = [...extraPaths, env.PATH ?? ''].join(':')
  }

  const rawTimeout = Number(env.WIKEY_REINDEX_TIMEOUT_MS) || REINDEX_WAIT_DEFAULT_MS
  const timeoutMs = Math.min(Math.max(rawTimeout, 1_000), REINDEX_WAIT_MAX_MS)
  const t0 = Date.now()

  try {
    await reindexQuick(cwd, env, timeoutMs)
    log(`reindex --quick OK in ${Date.now() - t0}ms, waiting for freshness (timeout=${timeoutMs}ms)`)
  } catch (err) {
    const msg = errorMessage(err)
    console.warn(`[Wikey ingest] reindex --quick failed (non-fatal): ${msg}`)
    onIssue?.('reindex-failed', msg)
    return
  }
  try {
    // §5.14 Layer 6: pass wiki/.md count as expectMinIndexed so waitUntilFresh detects
    // collection-empty silent-fresh 회귀 (qmd query 0-result symptom). 0 = no expectation
    // (fallback when wiki dir unreadable).
    const expectMinIndexed = countWikiMdFiles(cwd)
    await waitUntilFresh(cwd, env, timeoutMs, undefined, expectMinIndexed)
    const elapsed = Date.now() - t0
    log(`index is fresh (total ${elapsed}ms, expected ${expectMinIndexed} indexed)`)
    onOk?.(elapsed)
  } catch (err) {
    const msg = errorMessage(err)
    console.warn(`[Wikey ingest] freshness wait timed out (non-fatal): ${msg}`)
    onIssue?.('freshness-timeout', msg)
  }
}

// §5.10.4 D-wide: Stage 2 self-extending suggestion finalization 폐기 (runSuggestionFinalize +
// .wikey/suggestions.json + mention-history.json 메커니즘 모두 제거).

// ── §5.17 Spec 2 — write phase batching + UI yield (cancellability) ──

/** Minimal page shape used by `writePagesWithBatchYield` (decoupled from full WikiPage). */
export interface BatchWritePage {
  readonly filename: string
  readonly category: string
  readonly content: string
}

/**
 * §5.17 Spec 2 I5/I6/I7/I8 — page write loop 을 batch 단위로 처리하며
 * batch 사이 microtask yield (`setTimeout(0)`) 하여 UI thread 양보 + cancel 가능.
 *   - I5: wikiFS.write 그대로 활용 (per-file atomic Obsidian Vault API 가 보장)
 *   - I6: 매 batchSize page 후 yield → cancel signal 검사 가능
 *   - I7: index.md / log.md 갱신은 호출측 책임 (본 함수 안에서 호출 X)
 *   - I8: cancel 시 partial 보존 + AbortError throw (이미 write 된 page rollback X)
 *
 * Path format: `<category>/<filename>` (T13/T14/T15 fixture format 유지). 호출측이
 * wiki/ 접두사 등 prefix 가 필요하면 `pathPrefix` (optional) 로 전달 — v0.3 codex cycle
 * #1 P1 closure 시 createPage 동등 path (`wiki/<category>/<filename>`) 생성용.
 */
export async function writePagesWithBatchYield(args: {
  readonly wikiFS: WikiFS
  readonly pages: readonly BatchWritePage[]
  readonly batchSize?: number
  readonly signal?: AbortSignal
  readonly pathPrefix?: string
}): Promise<void> {
  const { wikiFS, pages, batchSize = 10, signal, pathPrefix = '' } = args
  const size = batchSize > 0 ? batchSize : 10
  for (let i = 0; i < pages.length; i++) {
    if (signal?.aborted) {
      const err = new Error('writePagesWithBatchYield: aborted')
      err.name = 'AbortError'
      throw err
    }
    const page = pages[i]
    await wikiFS.write(`${pathPrefix}${page.category}/${page.filename}`, page.content)
    // I6 yield between batches (not after the very last page — avoids spurious tick).
    if ((i + 1) % size === 0 && i + 1 < pages.length) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
}

/**
 * §5.17 Spec 3 — HWP/PDF 변환 후 본문 길이 vs 원본 크기 비교 → 손실 의심 시 WARN.
 *   case B 실측 (842 char / 16896 B raw) → warn true
 *   typical (5000 char / 10000 B = 9.8 KB) → warn false (raw < 10 KB)
 *
 * 임계 (heuristic, §5.17 spec 3): body < 1000 char AND raw > 10 KB → 의심.
 */
export function assessConversionQuality(args: {
  readonly bodyCharLen: number
  readonly rawByteLen: number
}): { warn: boolean; message: string | null } {
  const { bodyCharLen, rawByteLen } = args
  const suspicious = bodyCharLen < 1000 && rawByteLen > 10 * 1024
  if (!suspicious) return { warn: false, message: null }
  const kb = Math.round(rawByteLen / 1024)
  return {
    warn: true,
    message: `변환 품질 의심 — 본문 ${bodyCharLen}자 / 원본 ${kb}KB`,
  }
}
