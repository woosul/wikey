// ── Interfaces ──

export interface HttpClient {
  request(url: string, opts: HttpRequestOptions): Promise<HttpResponse>
}

export interface HttpRequestOptions {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  readonly headers?: Readonly<Record<string, string>>
  readonly body?: string
  readonly timeout?: number
}

export interface HttpResponse {
  readonly status: number
  readonly body: string
}

export interface WikiFS {
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  exists(path: string): Promise<boolean>
  list(dir: string): Promise<string[]>
}

// ── Config ──

export interface WikeyConfig {
  readonly WIKEY_BASIC_MODEL: string
  readonly WIKEY_SEARCH_BACKEND: string
  readonly WIKEY_MODEL: string
  readonly WIKEY_QMD_TOP_N: number

  readonly GEMINI_API_KEY: string
  readonly ANTHROPIC_API_KEY: string
  readonly OPENAI_API_KEY: string
  readonly OLLAMA_URL: string

  readonly INGEST_PROVIDER: string
  readonly LINT_PROVIDER: string
  readonly SUMMARIZE_PROVIDER: string
  readonly CONTEXTUAL_MODEL: string

  readonly COST_LIMIT: number

  // OCR fallback (markitdown-ocr). 미설정 시 WIKEY_BASIC_MODEL로 resolve.
  readonly OCR_PROVIDER?: string
  readonly OCR_MODEL?: string
}

// ── LLM ──

export type LLMProvider = 'gemini' | 'anthropic' | 'openai' | 'ollama'

export interface LLMCallOptions {
  readonly provider?: LLMProvider
  readonly model?: string
  readonly temperature?: number
  /** Deterministic sampling seed (Gemini supports this in generationConfig). */
  readonly seed?: number
  readonly maxTokens?: number
  readonly timeout?: number
  readonly responseMimeType?: string
  readonly jsonMode?: boolean
}

// ── Wiki ──

export interface WikiPage {
  readonly filename: string
  readonly content: string
  readonly category: 'entities' | 'concepts' | 'sources' | 'analyses'
  /** Phase B v6: Schema-guided sub-type. Optional for sources/analyses (no sub-type). */
  readonly entityType?: EntityType
  readonly conceptType?: ConceptType
}

// ── Schema (Phase B v6: Schema-Guided Extraction) ──

/** Allowed entity sub-types. LLM must classify each entity into one of these. */
export type EntityType = 'organization' | 'person' | 'product' | 'tool'

/** Allowed concept sub-types. LLM must classify each concept into one of these. */
export type ConceptType = 'standard' | 'methodology' | 'document_type'

/**
 * A raw mention extracted from a chunk by Stage 1 (no classification yet).
 * Stage 2 canonicalizer turns these into WikiPage objects with type assigned.
 */
export interface Mention {
  readonly name: string
  readonly type_hint?: EntityType | ConceptType | 'unknown'
  readonly evidence: string
  readonly source_chunk_id?: number
}

/**
 * Stage 2 canonicalizer output. `dropped` are mentions that failed schema validation
 * (UI labels, business objects, Korean labels, etc) — surfaced for transparency.
 */
export interface CanonicalizedResult {
  readonly entities: readonly WikiPage[]
  readonly concepts: readonly WikiPage[]
  readonly dropped: ReadonlyArray<{ mention: Mention; reason: string }>
  readonly indexAdditions?: readonly string[]
  readonly logEntry?: string
}

export interface IngestResult {
  readonly sourcePage: WikiPage
  readonly entities: readonly WikiPage[]
  readonly concepts: readonly WikiPage[]
  readonly indexAdditions: readonly string[]
  readonly logEntry: string
}

export interface IngestProgress {
  readonly step: number
  readonly total: number
  readonly message: string
  /** Optional fine-grained sub-progress within a step (e.g. chunk i of N during LLM extraction). */
  readonly subStep?: number
  readonly subTotal?: number
}

export type IngestProgressCallback = (progress: IngestProgress) => void

// ── Stay-involved modal hooks (llm-wiki.md "guide emphasis" + "read summaries") ──

export type BriefMode = 'always' | 'session' | 'never'

export interface IngestBrief {
  readonly sourceFilename: string
  readonly summary: string
}

export interface IngestPlan {
  readonly sourceFilename: string
  readonly guideReflection: string
  readonly sourcePage: { filename: string; existed: boolean }
  readonly entities: ReadonlyArray<{ filename: string; existed: boolean }>
  readonly concepts: ReadonlyArray<{ filename: string; existed: boolean }>
  readonly indexAdditions: number
  readonly hasLogEntry: boolean
}

export type IngestPlanGate = (plan: IngestPlan) => Promise<boolean>

export interface QueryResult {
  readonly answer: string
  readonly sources: readonly SearchResult[]
  readonly tokensUsed?: number
}

export interface SearchResult {
  readonly path: string
  readonly score: number
  readonly snippet: string
}
