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

  /**
   * §4.2.3 Stage 3 S3-2: classify 는 파일명+경로만 보므로 저가 모델로 충분.
   * 미지정 시 ingest 체인 그대로 승계. PROVIDER 만 지정하면 provider 기본 모델,
   * MODEL 까지 지정하면 해당 모델로 override.
   */
  readonly CLASSIFY_PROVIDER?: string
  readonly CLASSIFY_MODEL?: string

  readonly COST_LIMIT: number

  /**
   * §4.5.1.6.1: when true, extraction LLM calls (summary, mentions, canonicalize)
   * inject `temperature=0 + seed=42` for deterministic sampling. Measured against
   * Gemini 2.5 Flash; safe no-op on providers that ignore the fields.
   */
  readonly WIKEY_EXTRACTION_DETERMINISM?: boolean

  // OCR fallback (markitdown-ocr + page-render Vision). 미설정 시 WIKEY_BASIC_MODEL로 resolve.
  readonly OCR_PROVIDER?: string
  readonly OCR_MODEL?: string
  readonly OCR_DPI?: number
  readonly OCR_PARALLEL?: number
  readonly OCR_MAX_PAGES?: number

  // Docling (tier 1 메인 컨버터). 미설정 시 실용적 기본값 사용.
  readonly DOCLING_TABLE_MODE?: string          // 'accurate' (기본) | 'fast'
  readonly DOCLING_DEVICE?: string              // 'mps' | 'cuda' | 'cpu' (자동 감지 후 오버라이드)
  readonly DOCLING_OCR_ENGINE?: string          // 'ocrmac' | 'rapidocr' | 'tesseract' (OS별 기본)
  readonly DOCLING_OCR_LANG?: string            // 기본 'ko-KR,en-US'
  readonly DOCLING_TIMEOUT_MS?: number          // 기본 300000
  readonly DOCLING_DISABLE?: boolean            // true = tier 1 스킵 (디버깅/벤치마크용)
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
 * v7-5: user-defined schema extension loaded from `.wikey/schema.yaml`.
 * Names are lowercased/normalized; duplicates with built-ins are dropped.
 */
export interface SchemaCustomType {
  readonly name: string
  readonly description: string
}

export interface SchemaOverride {
  readonly entityTypes: readonly SchemaCustomType[]
  readonly conceptTypes: readonly SchemaCustomType[]
}

/**
 * A raw mention extracted by Phase B (no classification yet).
 * Stage 2 canonicalizer turns these into WikiPage objects with type assigned.
 *
 * `source_section_idx` (v2 §4.5.1.5): 섹션 단위로 재편되면서 chunk id 대신 섹션 idx 참조.
 * Route FULL 에서는 미설정, Route SEGMENTED 에서만 섹션 번호 주입 (debug/lint 용).
 */
export interface Mention {
  readonly name: string
  readonly type_hint?: EntityType | ConceptType | 'unknown'
  readonly evidence: string
  readonly source_section_idx?: number
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
