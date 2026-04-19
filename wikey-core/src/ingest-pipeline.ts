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
import { createPage, updateIndex, appendLog } from './wiki-ops.js'
import { PROVIDER_VISION_DEFAULTS } from './provider-defaults.js'

const execFileAsync = promisify(execFile)

const MAX_JSON_RETRIES = 2

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

export async function ingest(
  sourcePath: string,
  wikiFS: WikiFS,
  config: WikeyConfig,
  httpClient: HttpClient,
  onProgress?: IngestProgressCallback,
  opts?: IngestOptions,
): Promise<IngestResult> {
  const log = (msg: string, ...rest: unknown[]) => console.info(`[Wikey ingest] ${msg}`, ...rest)
  log(`start: ${sourcePath}`)

  // Step 1: Read source
  onProgress?.({ step: 1, total: 4, message: 'Reading source...' })
  const sourceFilename = sourcePath.split('/').pop() ?? sourcePath
  const isPdf = sourceFilename.toLowerCase().endsWith('.pdf')

  let sourceContent: string
  if (isPdf) {
    onProgress?.({ step: 1, total: 4, message: 'Extracting (MarkItDown)...' })
    sourceContent = await extractPdfText(sourcePath, opts?.basePath, opts?.execEnv, config)
    if (!sourceContent || sourceContent.trim().length < 50) {
      throw new Error(`PDF text extraction failed: ${sourceFilename} — install pdftotext (brew install poppler) or markitdown (pip install markitdown[pdf])`)
    }
  } else {
    sourceContent = await wikiFS.read(sourcePath)
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

  if (!isLargeDoc) {
    // ── Small document: single LLM call (original flow) ──
    const content = isLocal ? truncateSource(sourceContent) : sourceContent
    onProgress?.({ step: 2, total: 4, message: `LLM (${model})...` })
    parsed = await callLLMForIngest(llm, content, sourceFilename, indexContent, provider, model, promptTemplate)
    log(`small-doc LLM done — entities=${parsed.entities?.length ?? 0}, concepts=${parsed.concepts?.length ?? 0}, index_additions=${parsed.index_additions?.length ?? 0}, log_entry=${parsed.log_entry ? 'yes' : 'no'}`)
  } else {
    // ── Large document: Graphify-style chunked pipeline ──
    const chunks = splitIntoChunks(sourceContent)
    const totalSteps = chunks.length + 2 // summary + chunks + merge

    // Step A: Summary → source_page (truncated for local, full for cloud)
    onProgress?.({ step: 2, total: 4, subStep: 0, subTotal: totalSteps, message: `Summary (${model}) [1/${totalSteps}]...` })
    const summaryContent = isLocal ? truncateSource(sourceContent) : sourceContent
    const summaryParsed = await callLLMForIngest(llm, summaryContent, sourceFilename, indexContent, provider, model, promptTemplate)
    log(`summary done — entities=${summaryParsed.entities?.length ?? 0}, concepts=${summaryParsed.concepts?.length ?? 0}, index_additions=${summaryParsed.index_additions?.length ?? 0}, log_entry=${summaryParsed.log_entry ? 'yes' : 'no'}`)
    if (!summaryParsed.index_additions?.length) {
      console.warn('[Wikey ingest] summary returned no index_additions — wiki/index.md will not be updated')
    }
    if (!summaryParsed.log_entry) {
      console.warn('[Wikey ingest] summary returned no log_entry — wiki/log.md will not be updated')
    }

    // Step B: Each chunk → entities + concepts
    const allEntities: Array<{ filename: string; content: string }> = [...(summaryParsed.entities ?? [])]
    const allConcepts: Array<{ filename: string; content: string }> = [...(summaryParsed.concepts ?? [])]

    let chunkOk = 0
    let chunkFail = 0
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      // Summary occupied subStep 0..1. Chunks use subStep 1..totalSteps-1.
      onProgress?.({
        step: 2, total: 4,
        subStep: i + 1, subTotal: totalSteps,
        message: `Chunk ${i + 1}/${chunks.length} (${model})...`,
      })
      const chunkContent = isLocal ? truncateSource(chunk) : chunk
      try {
        const chunkParsed = await callLLMForExtraction(llm, chunkContent, sourceFilename, provider, model)
        allEntities.push(...(chunkParsed.entities ?? []))
        allConcepts.push(...(chunkParsed.concepts ?? []))
        chunkOk++
      } catch (err) {
        chunkFail++
        console.warn(`[Wikey ingest] chunk ${i + 1}/${chunks.length} failed:`, (err as Error).message)
      }
    }
    log(`chunks done — ok=${chunkOk}, failed=${chunkFail}, raw entities=${allEntities.length}, raw concepts=${allConcepts.length}`)

    // Step C: Merge — deduplicate by filename
    const seenEntities = new Map<string, { filename: string; content: string }>()
    for (const e of allEntities) {
      if (!seenEntities.has(e.filename)) seenEntities.set(e.filename, e)
    }
    const seenConcepts = new Map<string, { filename: string; content: string }>()
    for (const c of allConcepts) {
      if (!seenConcepts.has(c.filename)) seenConcepts.set(c.filename, c)
    }

    parsed = {
      source_page: summaryParsed.source_page,
      entities: [...seenEntities.values()],
      concepts: [...seenConcepts.values()],
      index_additions: summaryParsed.index_additions,
      log_entry: summaryParsed.log_entry,
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

  if (parsed.index_additions?.length) {
    const entityBases = new Set((parsed.entities ?? []).map((e) => e.filename.replace(/\.md$/i, '')))
    const conceptBases = new Set((parsed.concepts ?? []).map((c) => c.filename.replace(/\.md$/i, '')))
    const sourceBase = sourcePage.filename.replace(/\.md$/i, '')
    const tagged = parsed.index_additions.map((entry) => {
      const match = entry.match(/\[\[([^\]|]+)/)
      const firstLink = match ? match[1].trim().replace(/\.md$/i, '') : ''
      let category: 'entities' | 'concepts' | 'sources' | 'analyses' = 'analyses'
      if (firstLink === sourceBase || firstLink.startsWith('source-')) category = 'sources'
      else if (entityBases.has(firstLink)) category = 'entities'
      else if (conceptBases.has(firstLink)) category = 'concepts'
      return { entry, category }
    })
    await updateIndex(wikiFS, tagged)
    log(`index.md updated with ${parsed.index_additions.length} entries`)
  }

  if (parsed.log_entry) {
    const today = formatLocalDate(new Date())
    await appendLog(wikiFS, `## [${today}] ingest | ${sourceFilename}\n\n${parsed.log_entry}`)
    log(`log.md prepended`)
  }

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

async function callLLMForIngest(
  llm: LLMClient, sourceContent: string, sourceFilename: string,
  indexContent: string, provider: string, model: string, promptTemplate?: string,
): Promise<IngestRawResult> {
  const prompt = buildIngestPrompt(sourceContent, sourceFilename, indexContent, promptTemplate)
  return callLLMWithRetry(llm, prompt, provider, model)
}

async function callLLMForExtraction(
  llm: LLMClient, chunkContent: string, sourceFilename: string,
  provider: string, model: string,
): Promise<IngestRawResult> {
  const today = formatLocalDate(new Date())
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
  - **UI 기능명·메뉴 라벨·화면 이름**: announcement, address-book, all-services, access-rights, actual-work-time, add-schedule, application-details 등
  - **소프트웨어 기능 항목**: "공지 등록", "일정 추가", "결재 목록" 같은 것들은 **소프트웨어 기능 설명**이지 **독립 개념**이 아닙니다 — source 페이지 본문에서 설명하면 충분
  - 업종 분류명·빈 폼 필드·일회성 라벨·관용구

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
  const accept = (tier: string, out: string): string | null => {
    const text = out.trim()
    if (text.length > 50) {
      log(`tier ${tier} OK — ${text.length} chars`)
      return text
    }
    log(`tier ${tier} rejected — ${text.length} chars below threshold (50)`)
    return null
  }

  // PATH 보강 (Electron 환경에서 homebrew 등 누락 방지)
  const env = execEnv ? { ...execEnv } : { ...process.env } as Record<string, string>
  const extraPaths = ['/opt/homebrew/bin', '/usr/local/bin']
  env.PATH = [...extraPaths, env.PATH ?? ''].join(':')

  // 1. MarkItDown (structured markdown, best quality)
  log(`tier 1/5 start: markitdown — ${fullPath}`)
  try {
    const { stdout } = await execFileAsync('python3', [
      '-c', `from markitdown import MarkItDown; r = MarkItDown().convert("${fullPath}"); print(r.text_content)`,
    ], { timeout: 30000, maxBuffer: 10 * 1024 * 1024, env })
    const ok = accept('1 markitdown', stdout)
    if (ok) return ok
  } catch (err: unknown) {
    warn(`tier 1 markitdown error: ${errorMessage(err)}`)
  }

  // 2. pdftotext (poppler)
  log(`tier 2/5 start: pdftotext`)
  try {
    const { stdout } = await execFileAsync('pdftotext', [fullPath, '-'], {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
      env,
    })
    const ok = accept('2 pdftotext', stdout)
    if (ok) return ok
  } catch (err: unknown) {
    warn(`tier 2 pdftotext error: ${errorMessage(err)}`)
  }

  // 3. macOS mdimport (Spotlight metadata)
  log(`tier 3/5 start: mdimport`)
  try {
    const { stdout } = await execFileAsync('mdimport', ['-d1', fullPath], { timeout: 10000, env })
    const ok = accept('3 mdimport', stdout)
    if (ok) return ok
  } catch (err: unknown) {
    warn(`tier 3 mdimport error: ${errorMessage(err)}`)
  }

  // 4. pymupdf / PyPDF2 fallback
  log(`tier 4/5 start: pymupdf/PyPDF2`)
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
    const ok = accept('4 pymupdf/PyPDF2', stdout)
    if (ok) return ok
  } catch (err: unknown) {
    warn(`tier 4 pymupdf/PyPDF2 error: ${errorMessage(err)}`)
  }

  // 5. markitdown-ocr fallback (scanned/image-only PDFs via OpenAI-compat vision API)
  // 미설정 시 WIKEY_BASIC_MODEL로 resolve, fallback=Ollama gemma4:26b.
  const ocr = resolveOcrEndpoint(config)
  log(`tier 5/5 start: markitdown-ocr — provider=${ocr.providerLabel}, model=${ocr.model}, base=${ocr.baseUrl}`)
  if (!ocr.apiKey) {
    warn(`tier 5 skipped — no apiKey for provider=${ocr.providerLabel}`)
    return ''
  }
  try {
    const { stdout } = await execFileAsync('python3', [
      '-c',
      `
import sys
from openai import OpenAI
from markitdown import MarkItDown
client = OpenAI(base_url=sys.argv[2], api_key=sys.argv[4])
md = MarkItDown(enable_plugins=True, llm_client=client, llm_model=sys.argv[3])
result = md.convert(sys.argv[1])
print(result.text_content)
`,
      fullPath,
      ocr.baseUrl,
      ocr.model,
      ocr.apiKey,
    ], { timeout: 900000, maxBuffer: 50 * 1024 * 1024, env })
    const ok = accept(`5 markitdown-ocr (${ocr.providerLabel}/${ocr.model})`, stdout)
    if (ok) return ok
  } catch (err: unknown) {
    warn(`tier 5 markitdown-ocr error: ${errorMessage(err)}`)
  }

  warn(`all 5 tiers failed for ${sourcePath}`)
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
