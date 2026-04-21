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
import { createPage, updateIndex, appendLog, normalizeBase, type WrittenPage } from './wiki-ops.js'
import { canonicalize } from './canonicalizer.js'
import { loadSchemaOverride } from './schema.js'
import type { Mention, EntityType, ConceptType } from './types.js'
import { PROVIDER_VISION_DEFAULTS } from './provider-defaults.js'
import { stripEmbeddedImages, countEmbeddedImages } from './rag-preprocess.js'
import { computeCacheKey, getCached, setCached } from './convert-cache.js'
import { scoreConvertOutput } from './convert-quality.js'

const execFileAsync = promisify(execFile)

const MAX_JSON_RETRIES = 2

// Docling 이 처리하는 PDF 외 포맷 (pdf 는 extractPdfText 로 별도 라우팅).
// 확장자는 소문자로 비교.
const DOCLING_DOC_FORMATS = new Set([
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
): Promise<IngestResult> {
  assertNotWikiPath(sourcePath, 'ingest')
  const log = (msg: string, ...rest: unknown[]) => console.info(`[Wikey ingest] ${msg}`, ...rest)
  log(`start: ${sourcePath}`)

  // Step 1: Read source
  onProgress?.({ step: 1, total: 4, message: 'Reading source...' })
  const sourceFilename = sourcePath.split('/').pop() ?? sourcePath
  const ext = (sourceFilename.toLowerCase().split('.').pop() ?? '')

  let sourceContent: string
  if (ext === 'hwp' || ext === 'hwpx') {
    onProgress?.({ step: 1, total: 4, message: 'Extracting (unhwp)...' })
    sourceContent = await extractHwpText(sourcePath, opts?.basePath, opts?.execEnv)
    if (!sourceContent || sourceContent.trim().length < 50) {
      throw new Error(`HWP/HWPX extraction failed: ${sourceFilename} — install unhwp (pip install unhwp)`)
    }
  } else if (ext === 'pdf') {
    onProgress?.({ step: 1, total: 4, message: 'Extracting (Docling)...' })
    sourceContent = await extractPdfText(sourcePath, opts?.basePath, opts?.execEnv, config)
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

  // §4.1.1.9 — md 사본 저장: 변환이 필요했던 포맷(pdf/hwp/hwpx/docx/...)은 원본 옆에
  // `<source>.md` 로 저장하여 사용자가 변환 결과를 직접 확인 가능. 원본이 이미 md 면 생략.
  if (ext && ext !== 'md' && ext !== 'txt') {
    const sidecarPath = `${sourcePath}.md`
    try {
      const exists = await wikiFS.exists(sidecarPath).catch(() => false)
      if (!exists) {
        await wikiFS.write(sidecarPath, sourceContent)
        log(`sidecar .md saved → ${sidecarPath}`)
      }
    } catch (err) {
      log(`sidecar .md save skipped: ${err}`)
    }
  }

  const indexContent = await wikiFS.read('wiki/index.md').catch(() => '')
  const basePromptTemplate = await loadEffectiveIngestPrompt(wikiFS)
  const promptTemplate = opts?.guideHint ? injectGuideHint(basePromptTemplate, opts.guideHint) : basePromptTemplate
  const { provider, model } = resolveProvider('ingest', config)
  const llm = new LLMClient(httpClient, config)
  const isLocal = provider === 'ollama'

  // Route: small doc → single call, large doc → chunked pipeline
  const isLargeDoc = sourceContent.length > MAX_SOURCE_CHARS
  let parsed: IngestRawResult

  log(`source: ${sourceContent.length} chars, large=${sourceContent.length > MAX_SOURCE_CHARS}, provider=${provider}, model=${model}`)

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

  // v7-5: load .wikey/schema.yaml extension (if any) — feeds into canonicalizer
  const schemaOverride = await loadSchemaOverride(wikiFS).catch(() => null) ?? undefined
  if (schemaOverride) {
    log(`schema override — entities=${schemaOverride.entityTypes.length}, concepts=${schemaOverride.conceptTypes.length}`)
  }

  const today = formatLocalDate(new Date())

  if (!isLargeDoc) {
    // ── Small document: 1 summary call + 1 mentions call + 1 canonicalize call ──
    const content = isLocal ? truncateSource(sourceContent) : sourceContent
    onProgress?.({ step: 2, total: 4, subStep: 0, subTotal: 3, message: `Summary (${model})...` })
    const summaryParsed = await callLLMForSummary(llm, content, sourceFilename, indexContent, provider, model, promptTemplate)

    onProgress?.({ step: 2, total: 4, subStep: 1, subTotal: 3, message: `Extracting mentions (${model})...` })
    const mentions = await extractMentions(llm, content, sourceFilename, provider, model)
    log(`small-doc — summary done, mentions=${mentions.length}`)

    onProgress?.({ step: 2, total: 4, subStep: 2, subTotal: 3, message: `Canonicalizing (${model})...` })
    const canon = await canonicalize({
      llm, mentions, existingEntityBases, existingConceptBases,
      sourceFilename, today, guideHint: opts?.guideHint, provider, model,
      schemaOverride,
    })
    log(`canonicalize done — entities=${canon.entities.length}, concepts=${canon.concepts.length}, dropped=${canon.dropped.length}`)

    parsed = {
      source_page: summaryParsed.source_page,
      entities: canon.entities.map((p) => ({ filename: p.filename, content: p.content })),
      concepts: canon.concepts.map((p) => ({ filename: p.filename, content: p.content })),
      index_additions: canon.indexAdditions ? [...canon.indexAdditions] : summaryParsed.index_additions,
      log_entry: canon.logEntry ?? summaryParsed.log_entry,
    }
  } else {
    // ── Large document: Summary + chunked mention extraction + 1 canonicalize ──
    const chunks = splitIntoChunks(sourceContent)
    const totalSteps = chunks.length + 2  // summary + chunks + canonicalize

    // Step A: Summary → source_page (truncated for local, full for cloud)
    onProgress?.({ step: 2, total: 4, subStep: 0, subTotal: totalSteps, message: `Summary (${model}) [1/${totalSteps}]...` })
    const summaryContent = isLocal ? truncateSource(sourceContent) : sourceContent
    const summaryParsed = await callLLMForSummary(llm, summaryContent, sourceFilename, indexContent, provider, model, promptTemplate)
    log(`summary done — index_additions=${summaryParsed.index_additions?.length ?? 0}, log_entry=${summaryParsed.log_entry ? 'yes' : 'no'}`)

    // Step B: Each chunk → mentions only (no classification)
    const allMentions: Mention[] = []
    let chunkOk = 0, chunkFail = 0
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      onProgress?.({
        step: 2, total: 4,
        subStep: i + 1, subTotal: totalSteps,
        message: `Chunk ${i + 1}/${chunks.length} (${model})...`,
      })
      const chunkContent = isLocal ? truncateSource(chunk) : chunk
      try {
        const chunkMentions = await extractMentions(llm, chunkContent, sourceFilename, provider, model, i)
        allMentions.push(...chunkMentions)
        chunkOk++
      } catch (err) {
        chunkFail++
        console.warn(`[Wikey ingest] chunk ${i + 1}/${chunks.length} failed:`, (err as Error).message)
      }
    }
    log(`mentions extracted — ok=${chunkOk}, failed=${chunkFail}, total=${allMentions.length}`)

    // Step C: Single canonicalizer call — schema validation + acronym/existing dedup
    onProgress?.({
      step: 2, total: 4,
      subStep: chunks.length + 1, subTotal: totalSteps,
      message: `Canonicalizing (${model}) [${chunks.length + 1}/${totalSteps}]...`,
    })
    const canon = await canonicalize({
      llm, mentions: allMentions, existingEntityBases, existingConceptBases,
      sourceFilename, today, guideHint: opts?.guideHint, provider, model,
      schemaOverride,
    })
    log(`canonicalize done — entities=${canon.entities.length}, concepts=${canon.concepts.length}, dropped=${canon.dropped.length}`)
    if (canon.dropped.length > 0) {
      const droppedSummary = canon.dropped.slice(0, 10).map((d) => `${d.mention.name} (${d.reason})`).join(', ')
      log(`dropped sample: ${droppedSummary}${canon.dropped.length > 10 ? `, +${canon.dropped.length - 10} more` : ''}`)
    }

    parsed = {
      source_page: summaryParsed.source_page,
      entities: canon.entities.map((p) => ({ filename: p.filename, content: p.content })),
      concepts: canon.concepts.map((p) => ({ filename: p.filename, content: p.content })),
      index_additions: canon.indexAdditions ? [...canon.indexAdditions] : summaryParsed.index_additions,
      log_entry: canon.logEntry ?? summaryParsed.log_entry,
    }
  }

  if (!parsed.source_page?.filename || !parsed.source_page?.content) {
    throw new Error(`LLM returned invalid structure — missing source_page. Keys: ${Object.keys(parsed).join(', ')}`)
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
  const createdPages: string[] = []
  const updatedPages: string[] = []

  const sourcePage: WikiPage = {
    filename: parsed.source_page.filename,
    content: parsed.source_page.content,
    category: 'sources',
  }
  const exists = await wikiFS.exists(`wiki/sources/${sourcePage.filename}`)
  await createPage(wikiFS, sourcePage)
  ;(exists ? updatedPages : createdPages).push(sourcePage.filename)

  for (const entity of parsed.entities ?? []) {
    const page: WikiPage = { filename: entity.filename, content: entity.content, category: 'entities' }
    const entityExists = await wikiFS.exists(`wiki/entities/${entity.filename}`)
    await createPage(wikiFS, page)
    ;(entityExists ? updatedPages : createdPages).push(entity.filename)
  }

  for (const concept of parsed.concepts ?? []) {
    const page: WikiPage = { filename: concept.filename, content: concept.content, category: 'concepts' }
    const conceptExists = await wikiFS.exists(`wiki/concepts/${concept.filename}`)
    await createPage(wikiFS, page)
    ;(conceptExists ? updatedPages : createdPages).push(concept.filename)
  }

  log(`pages written — created=${createdPages.length}, updated=${updatedPages.length}`)

  // Phase A: Build writtenPages for deterministic index/log backfill.
  // Every page actually written (regardless of whether the LLM mentioned it) is registered.
  const writtenPages: WrittenPage[] = [
    { filename: sourcePage.filename, category: 'sources', content: sourcePage.content },
    ...(parsed.entities ?? []).map((e) => ({ filename: e.filename, category: 'entities' as const, content: e.content })),
    ...(parsed.concepts ?? []).map((c) => ({ filename: c.filename, category: 'concepts' as const, content: c.content })),
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
  const llmBody = parsed.log_entry?.trim() ?? ''
  const entryHeader = `## [${today}] ingest | ${sourceFilename}`
  const entry = llmBody ? `${entryHeader}\n\n${llmBody}` : `${entryHeader}\n`
  await appendLog(wikiFS, entry, writtenPages)
  log(`log.md prepended`)

  // Step 4: Reindex
  onProgress?.({ step: 4, total: 4, message: 'Indexing...' })
  triggerReindex(opts?.basePath)
  log(`done: ${sourcePath}`)

  return {
    sourcePage,
    entities: (parsed.entities ?? []).map((e) => ({
      filename: e.filename,
      content: e.content,
      category: 'entities' as const,
    })),
    concepts: (parsed.concepts ?? []).map((c) => ({
      filename: c.filename,
      content: c.content,
      category: 'concepts' as const,
    })),
    indexAdditions: parsed.index_additions ?? [],
    logEntry: parsed.log_entry ?? '',
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
  indexContent: string, provider: string, model: string, promptTemplate?: string,
): Promise<IngestRawResult> {
  const prompt = buildIngestPrompt(sourceContent, sourceFilename, indexContent, promptTemplate)
  return callLLMWithRetry(llm, prompt, provider, model)
}

/**
 * v6 Stage 1b: Mention extractor — chunk LLM emits raw mentions only, no classification.
 * Returns Mention[] (not IngestRawResult). Stage 2 canonicalizer handles classification + dedup.
 */
async function extractMentions(
  llm: LLMClient, chunkContent: string, sourceFilename: string,
  provider: string, model: string, chunkIdx?: number,
): Promise<Mention[]> {
  const prompt = `이 문서 청크에서 잠재적으로 wiki 페이지가 될 만한 **mention(언급)**을 추출하세요.

Source: ${sourceFilename}

## 작업 정의

분류하지 마세요. 페이지를 만들지 마세요. 단지 "이 chunk에 등장하는 wiki 후보"를 짧게 나열만 하세요.

각 mention은 다음 정보를 가집니다:
- \`name\`: 정규화된 base name (소문자 + 하이픈 구분, 예: \`pmbok\`, \`goodstream-co-ltd\`)
- \`type_hint\`: 다음 중 하나 또는 \`unknown\`
  - **entity 후보**: \`organization\` (회사/기관), \`person\` (실명 인물), \`product\` (제품명), \`tool\` (소프트웨어/프로토콜)
  - **concept 후보**: \`standard\` (산업표준/규격), \`methodology\` (방법론), \`document_type\` (문서종류)
- \`evidence\`: 1문장 (어디 등장했는지, 200자 이내)

## 무엇을 mention으로 뽑을까

✅ 산업 표준 용어 (PMBOK, ERP, MES, Gantt chart 등)
✅ 회사·인물·제품·도구의 고유명
✅ 정식 문서 유형 (사업자등록증, 세금계산서 등)

❌ UI 라벨/메뉴/버튼명 — 절대 mention 아님
❌ 한국어 일반 명사 라벨 (회의실, 결재시스템 등) — mention 아님
❌ X-management, X-service, X-support 같은 단순 기능명 — mention 아님
❌ 비즈니스 객체 라벨 (quotation, purchase-order, tax-invoice 등) — mention 아님

## 가이드 분량

청크당 0~15개 정도. 모르는 것보다 **빠뜨리는 게 낫습니다**. 명확한 것만.

## 출력 형식 (JSON only)

\`\`\`json
{
  "mentions": [
    {"name": "goodstream-co-ltd", "type_hint": "organization", "evidence": "사업자등록증 발급 대상"},
    {"name": "pmbok", "type_hint": "standard", "evidence": "프로젝트 관리 표준 지식체계로 명시"},
    {"name": "lotus-pms", "type_hint": "product", "evidence": "이 문서가 소개하는 제품명"}
  ]
}
\`\`\`

## 청크 본문

${chunkContent}`

  const raw = await callLLMWithRetry(llm, prompt, provider, model)
  const mentions = ((raw as any).mentions ?? []) as Array<{ name?: string; type_hint?: string; evidence?: string }>
  return mentions
    .filter((m) => m.name && m.name.trim().length > 0)
    .map((m) => ({
      name: m.name!.trim(),
      type_hint: (m.type_hint as Mention['type_hint']) ?? 'unknown',
      evidence: (m.evidence ?? '').trim(),
      source_chunk_id: chunkIdx,
    }))
}

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

async function callLLMWithRetry(
  llm: LLMClient, prompt: string, provider: string, model: string,
): Promise<IngestRawResult> {
  for (let attempt = 0; attempt <= MAX_JSON_RETRIES; attempt++) {
    const llmOpts = provider === 'gemini'
      ? { provider: provider as any, model, responseMimeType: 'application/json' as const, jsonMode: true }
      : { provider: provider as any, model, jsonMode: true }
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

// ── Chunk splitter (Graphify-style: split by markdown headers) ──

function splitIntoChunks(text: string, maxChunkSize = 8000): string[] {
  // Split by ## headers
  const sections = text.split(/(?=^## )/m)
  const chunks: string[] = []
  let current = ''

  for (const section of sections) {
    if (current.length + section.length > maxChunkSize && current.length > 0) {
      chunks.push(current.trim())
      current = ''
    }
    current += section
  }
  if (current.trim()) chunks.push(current.trim())

  // If no headers found or single chunk too large, split by paragraphs
  if (chunks.length <= 1 && text.length > maxChunkSize) {
    const paragraphs = text.split(/\n\n+/)
    const result: string[] = []
    let buf = ''
    for (const p of paragraphs) {
      if (buf.length + p.length > maxChunkSize && buf.length > 0) {
        result.push(buf.trim())
        buf = ''
      }
      buf += p + '\n\n'
    }
    if (buf.trim()) result.push(buf.trim())
    return result
  }

  return chunks
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
 */
export async function generateBrief(
  sourcePath: string,
  wikiFS: WikiFS,
  config: WikeyConfig,
  httpClient: HttpClient,
  opts?: { basePath?: string; execEnv?: Record<string, string> },
): Promise<string> {
  assertNotWikiPath(sourcePath, 'generateBrief')
  const sourceFilename = sourcePath.split('/').pop() ?? sourcePath
  const isPdf = sourceFilename.toLowerCase().endsWith('.pdf')

  let content: string
  if (isPdf) {
    content = await extractPdfText(sourcePath, opts?.basePath, opts?.execEnv, config)
  } else {
    content = await wikiFS.read(sourcePath)
  }

  const sample = content.slice(0, 6000)
  const { provider, model } = resolveProvider('ingest', config)
  const llm = new LLMClient(httpClient, config)

  const prompt = `다음 문서의 핵심 포인트를 2~4문장(총 150~300자)으로 요약하세요. 존댓말(해요체). 목록·제목·마크다운 없이 평문.

문서: ${sourceFilename}

${sample}`

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

/** Path to the user-editable ingest prompt override (vault-relative). */
export const INGEST_PROMPT_PATH = '.wikey/ingest_prompt.md'

/**
 * Load the effective ingest prompt template.
 * - If `.wikey/ingest_prompt.md` exists, return its content (full override).
 * - Else, return the bundled default.
 */
export async function loadEffectiveIngestPrompt(wikiFS: WikiFS): Promise<string> {
  try {
    if (await wikiFS.exists(INGEST_PROMPT_PATH)) {
      return await wikiFS.read(INGEST_PROMPT_PATH)
    }
  } catch {
    // fall through to bundled default
  }
  return BUNDLED_INGEST_PROMPT
}

/** Bundled default ingest prompt template (used when no user override exists). */
export const BUNDLED_INGEST_PROMPT = `당신은 wikey LLM Wiki의 인제스트 에이전트입니다.
아래 소스를 분석하여 위키 페이지를 생성하세요.

## 컨벤션

### 프론트매터 (모든 페이지 필수)
\`\`\`yaml
---
title: 페이지 제목
type: entity | concept | source
created: {{TODAY}}
updated: {{TODAY}}
sources: [source-name.md]
tags: [태그1, 태그2]
---
\`\`\`

### 파일명 규칙
- 소문자, 하이픈 구분 (예: my-page-name.md)
- 소스 페이지: source-{name}.md
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

const MAX_SOURCE_CHARS = 12_000

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
async function extractHwpText(
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
    log(`cache hit — unhwp (${cached.length} chars)`)
    return cached
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
async function extractDocumentText(
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
    log(`cache hit — docling (${cached.length} chars)`)
    return cached
  }

  const args = buildDoclingArgs(fullPath, config)
  const timeout = config?.DOCLING_TIMEOUT_MS ?? 300000
  try {
    const { stdout } = await execFileAsync('docling', args, {
      timeout, maxBuffer: 100 * 1024 * 1024, env,
    })
    const md = extractDoclingMarkdown(stdout)
    const counts = countEmbeddedImages(md)
    const stripped = stripEmbeddedImages(md)
    log(`docling OK — ${md.length} chars (raw), ${stripped.length} chars (stripped), images=${counts.dataUri}+${counts.externalUrl}`)
    setCached(cacheKey, stripped, { source: sourcePath, converter: 'docling' })
    return stripped
  } catch (err: unknown) {
    warn(`docling error: ${errorMessage(err)}`)
    return ''
  }
}

/** docling 옵션 중 캐시 키에 포함할 것들 (결과 달라지는 옵션만). */
function doclingMajorOptions(config?: WikeyConfig): Record<string, unknown> {
  return {
    table_mode: config?.DOCLING_TABLE_MODE || 'accurate',
    ocr_engine: config?.DOCLING_OCR_ENGINE || (process.platform === 'darwin' ? 'ocrmac' : 'rapidocr'),
    ocr_lang: config?.DOCLING_OCR_LANG || 'ko-KR,en-US',
    image_export_mode: 'embedded',
  }
}

/**
 * Docling CLI args 빌드. stdout 출력으로 옵션 고정.
 */
function buildDoclingArgs(fullPath: string, config?: WikeyConfig): string[] {
  const tableMode = config?.DOCLING_TABLE_MODE || 'accurate'
  const device = config?.DOCLING_DEVICE || (process.platform === 'darwin' ? 'mps' : 'cpu')
  const ocrEngine = config?.DOCLING_OCR_ENGINE || (process.platform === 'darwin' ? 'ocrmac' : 'rapidocr')
  const ocrLang = config?.DOCLING_OCR_LANG || 'ko-KR,en-US'
  return [
    fullPath,
    '--to', 'md',
    '--output', '-',                     // stdout
    '--table-mode', tableMode,
    '--device', device,
    '--ocr-engine', ocrEngine,
    '--ocr-lang', ocrLang,
    '--image-export-mode', 'embedded',   // strip 함수가 후처리
  ]
}

/**
 * docling stdout 에서 markdown 본문만 추출. CLI 는 진행 로그를 stdout 섞는 경우가 있어
 * markdown heading (`# `) 이후만 채택하거나, fallback 으로 전체 반환.
 */
function extractDoclingMarkdown(stdout: string): string {
  if (!stdout) return ''
  // docling --output - 는 markdown 직접 출력. 단, 초기 릴리스에서 로그가 섞일 수 있어
  // 첫 heading/문장 이전 log-like 라인을 제거.
  const lines = stdout.split('\n')
  let firstContentIdx = 0
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (l.startsWith('#') || l.startsWith('![') || (l.trim().length > 0 && !/^\[\d|INFO|WARNING|ERROR/.test(l))) {
      firstContentIdx = i
      break
    }
  }
  return lines.slice(firstContentIdx).join('\n')
}

async function extractPdfText(
  sourcePath: string,
  basePath?: string,
  execEnv?: Record<string, string>,
  config?: WikeyConfig,
): Promise<string> {
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
  const finalize = (md: string, tierKey: string): string => {
    const counts = countEmbeddedImages(md)
    const stripped = stripEmbeddedImages(md)
    if (counts.dataUri || counts.externalUrl) {
      log(`image placeholder — data=${counts.dataUri}, url=${counts.externalUrl}, ${md.length}→${stripped.length} chars`)
    }
    if (sourceBytes && stripped) {
      const cacheKey = computeCacheKey({
        sourceBytes,
        converter: `pdf:${tierKey}`,
        majorOptions: doclingMajorOptions(config),
      })
      setCached(cacheKey, stripped, { source: sourcePath, converter: `pdf:${tierKey}` })
    }
    return stripped
  }

  // PATH 보강 (Electron 환경에서 homebrew 등 누락 방지)
  const env = execEnv ? { ...execEnv } : { ...process.env } as Record<string, string>
  const extraPaths = ['/opt/homebrew/bin', '/usr/local/bin']
  env.PATH = [...extraPaths, env.PATH ?? ''].join(':')

  // 캐시 조회 — tier 와 무관하게 원본 파일 + 공통 옵션 기준.
  // tier 가 바뀌면 키가 달라져 miss. 동일 tier 재실행만 히트 (docling 안정이 목표).
  const { readFileSync: rf } = require('node:fs') as typeof import('node:fs')
  let sourceBytes: Buffer | null = null
  try {
    sourceBytes = rf(fullPath)
    // 우선 docling tier 결과 캐시 조회 (가장 흔한 경로).
    const doclingKey = computeCacheKey({
      sourceBytes: sourceBytes!,
      converter: 'pdf:1-docling',
      majorOptions: doclingMajorOptions(config),
    })
    const cached = getCached(doclingKey)
    if (cached != null && !config?.DOCLING_DISABLE) {
      log(`cache hit — pdf:1-docling (${cached.length} chars)`)
      return cached
    }
  } catch (err) {
    warn(`read source for cache failed: ${errorMessage(err)}`)
  }

  // Page-aware threshold for OCR-style tiers (markitdown-ocr / Vision render).
  // Vector-only PDFs trick markitdown-ocr into emitting a few cover-image OCR chars
  // for many pages — we need to require chars-per-page above a floor.
  let pdfPageCount = 0
  try {
    const { stdout } = await execFileAsync('python3', [
      '-c',
      `import fitz, sys; print(len(fitz.open(sys.argv[1])))`,
      fullPath,
    ], { timeout: 5000, env })
    pdfPageCount = parseInt(stdout.trim(), 10) || 0
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
    try {
      const args = buildDoclingArgs(fullPath, config)
      const timeout = config?.DOCLING_TIMEOUT_MS ?? 300000
      const { stdout } = await execFileAsync('docling', args, {
        timeout, maxBuffer: 100 * 1024 * 1024, env,
      })
      const md = extractDoclingMarkdown(stdout)
      const ok = accept('1 docling', md)
      if (ok) {
        // 품질 평가 — 한국어 공백 소실 등 감지되면 tier 1b (force-ocr) 재시도.
        const quality = scoreConvertOutput(ok, { retryOnKoreanWhitespace: true })
        log(`tier 1 docling quality — score=${quality.score.toFixed(2)}, decision=${quality.decision}, flags=[${quality.flags.join(',')}]`)
        if (quality.decision === 'accept') return finalize(ok, '1-docling')
        if (quality.decision === 'retry') {
          // tier 1b: docling --force-ocr 로 재시도 (공백 소실 케이스)
          log('tier 1b/6 start: docling --force-ocr')
          try {
            const retryArgs = [...args, '--force-ocr']
            const { stdout: retryOut } = await execFileAsync('docling', retryArgs, {
              timeout, maxBuffer: 100 * 1024 * 1024, env,
            })
            const retryMd = extractDoclingMarkdown(retryOut)
            const retryOk = accept('1b docling --force-ocr', retryMd)
            if (retryOk) {
              const retryQ = scoreConvertOutput(retryOk, { retryOnKoreanWhitespace: false })
              log(`tier 1b quality — score=${retryQ.score.toFixed(2)}, decision=${retryQ.decision}`)
              if (retryQ.decision === 'accept') return finalize(retryOk, '1b-docling-force-ocr')
              log('tier 1b still low quality — fall through to tier 2')
            }
          } catch (err: unknown) {
            warn(`tier 1b docling --force-ocr error: ${errorMessage(err)}`)
          }
        }
        // decision = 'reject' → tier 2 로 폴스루 (ok 버리지 않고 finalize 하지 않음)
        log(`tier 1 docling quality insufficient — fall through to tier 2`)
      }
    } catch (err: unknown) {
      warn(`tier 1 docling error: ${errorMessage(err)}`)
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
    return ''
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
  return ''
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message.split('\n')[0].slice(0, 200)
  return String(err).slice(0, 200)
}

function truncateSource(text: string): string {
  if (text.length <= MAX_SOURCE_CHARS) return text
  // Keep beginning and end for context
  const headSize = Math.floor(MAX_SOURCE_CHARS * 0.7)
  const tailSize = Math.floor(MAX_SOURCE_CHARS * 0.25)
  const head = text.slice(0, headSize)
  const tail = text.slice(-tailSize)
  const skipped = text.length - headSize - tailSize
  return `${head}\n\n[... ${skipped} chars truncated ...]\n\n${tail}`
}

function triggerReindex(basePath?: string): void {
  const { join } = require('node:path') as typeof import('node:path')
  const cwd = basePath ?? process.cwd()
  const script = join(cwd, 'scripts/reindex.sh')

  // Fire-and-forget background reindex
  try {
    const env = { ...process.env } as Record<string, string>
    const extraPaths = ['/usr/local/bin', '/opt/homebrew/bin', `${process.env.HOME}/.nvm/versions/node/v22.17.0/bin`]
    env.PATH = [...extraPaths, env.PATH ?? ''].join(':')
    execFile(script, ['--quick'], { cwd, env }, () => {
      // Reindex failure is non-fatal
    })
  } catch {
    // reindex.sh not found — non-fatal
  }
}
