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

// ── Provenance (§4.3.2 Part A, Phase 4.3) ──

/**
 * wiki 페이지 관계의 출처 표시 (entity/concept/analyses 페이지 frontmatter `provenance` 배열).
 * Phase 4.3 본체. Phase 5 §5.6 self-extending 이 'self-declared' variant 를 소비.
 */
export type ProvenanceType =
  | 'extracted'      // 소스에서 직접 발견 (Stage 2 mention 추출 기본)
  | 'inferred'       // LLM 이 추론 (Stage 3 canonicalize 가 mention 없이 합성)
  | 'ambiguous'      // 리뷰 필요 (동명이인·축약어·경계 모호)
  | 'self-declared'  // Phase 5 §5.6 예약 — 원본 안 in-source self-declaration 로 생성된 decomposition

export interface ProvenanceEntry {
  readonly type: ProvenanceType
  /** `sources/<source_id>` 포맷. source-registry 조회로 해석. PARA 이동 불변. */
  readonly ref: string
  /** 'inferred' / 'self-declared' 에만 의미. 0.0~1.0. */
  readonly confidence?: number
  /** 'ambiguous' 에만 의미. 한 줄 근거. */
  readonly reason?: string
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

/**
 * §5.4.1 Stage 1: a single component within a standard decomposition (e.g.
 * one of PMBOK's 10 knowledge areas). `aliases` preserves legacy slugs that
 * existed in earlier hardcoded prompts (e.g. `project-time-management` for
 * `project-schedule-management`) so prompt anchors remain stable.
 */
export interface StandardDecompositionComponent {
  readonly slug: string
  readonly type: string
  readonly aliases?: readonly string[]
}

/**
 * §5.4.1 Stage 1: declarative replacement for the canonicalizer prompt's
 * "task rule #7" (PMBOK 10 areas hardcode). One umbrella standard expands
 * into N components either via `decompose` (extract each separately) or
 * `bundle` (collapse into a single umbrella slug).
 */
export interface StandardDecomposition {
  readonly name: string
  readonly aliases: readonly string[]
  readonly umbrella_slug: string
  readonly components: readonly StandardDecompositionComponent[]
  readonly rule: 'decompose' | 'bundle'
  readonly require_explicit_mention: boolean
  readonly origin?: 'hardcoded' | 'user-yaml' | 'suggested' | 'self-declared' | 'converged'
  readonly confidence?: number
}

/**
 * §5.4.1 Stage 1 (codex cycle #2 단일화): absent ⟺ undefined. Present states
 * captured by the discriminated union below.
 *   - empty-explicit: yaml `standard_decompositions: []` (or block-empty).
 *   - empty-all-skipped: yaml had entries but every entry failed validation.
 *   - present: at least one valid user entry.
 */
export type StandardDecompositionsState =
  | { readonly kind: 'empty-explicit' }
  | { readonly kind: 'empty-all-skipped'; readonly skippedCount: number }
  | { readonly kind: 'present'; readonly items: readonly StandardDecomposition[] }

export interface SchemaOverride {
  readonly entityTypes: readonly SchemaCustomType[]
  readonly conceptTypes: readonly SchemaCustomType[]
  readonly standardDecompositions?: StandardDecompositionsState
}

// ── §5.4 Stage 2: extraction-graph driven suggestions ──

/**
 * §5.4.2 AC2: Per-source ingest accumulation feeding the Stage 2 pattern detector.
 * Persisted in `.wikey/mention-history.json` (separate from `.wikey/suggestions.json`).
 */
export interface IngestRecord {
  readonly source: string                         // wiki/sources/<base>.md path
  readonly ingestedAt: string                     // ISO datetime
  readonly concepts: ReadonlyArray<{ readonly slug: string; readonly type: ConceptType }>
  readonly entities: ReadonlyArray<{ readonly slug: string; readonly type: EntityType }>
}

/**
 * §5.4.2 AC3/AC4: candidate pattern produced by the co-occurrence / suffix
 * cluster detectors before confidence scoring.
 */
export interface CandidatePattern {
  readonly umbrella_slug: string                  // inferred prefix or grouping key
  readonly umbrella_name?: string
  readonly components: readonly StandardDecompositionComponent[]
  readonly support_count: number                  // # distinct sources supporting the pattern
  readonly unique_suffixes: number                // # distinct suffix shapes among matches
  readonly mention_count: number                  // total mention occurrences across history
  readonly overlapsWithBuiltin: boolean           // any component slug overlaps a BUILTIN entry
  readonly evidence: readonly SuggestionEvidence[]
}

export interface SuggestionEvidence {
  readonly source: string                         // wiki/sources/<source>.md path
  readonly mentions: readonly string[]            // co-occurring mention slugs
  readonly observedAt: string                     // ISO datetime
}

export type SuggestionState =
  | { readonly kind: 'pending' }
  | { readonly kind: 'accepted'; readonly acceptedAt: string }
  | { readonly kind: 'rejected'; readonly rejectedAt: string; readonly reason?: string }
  | { readonly kind: 'edited'; readonly userEdits: Partial<StandardDecomposition> }

export interface Suggestion {
  readonly id: string                             // sha1 of canonical signature
  readonly umbrella_slug: string
  readonly umbrella_name?: string
  readonly candidate_components: readonly StandardDecompositionComponent[]
  readonly support_count: number
  readonly suffix_score: number                   // 0..1 (suffix homogeneity)
  readonly mention_count: number
  readonly confidence: number                     // 0..1 — see §3.2.2 formula
  readonly evidence: readonly SuggestionEvidence[]
  readonly state: SuggestionState
  readonly createdAt: string
  readonly updatedAt: string
}

export interface SuggestionStore {
  readonly version: 1
  readonly suggestions: readonly Suggestion[]
  readonly negativeCache: readonly string[]
}

export interface SuggestionStorageReader {
  readonly load: () => Promise<SuggestionStore>
}

export interface SuggestionStorageWriter {
  readonly save: (store: SuggestionStore) => Promise<void>
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
  /** §4.3.2 Part B: per-page provenance citations (optional, UI 층이 보조 링크 렌더). */
  readonly citations?: readonly Citation[]
}

export interface SearchResult {
  readonly path: string
  readonly score: number
  readonly snippet: string
}

/**
 * §4.3.2 Part B — 쿼리 응답에 첨부되는 citation 엔트리.
 * 답변 본문의 wikilink 가 `wiki/entities/x.md` 를 가리키면, 해당 엔트리의
 * sourceIds 를 resolve 하여 원본 파일 보조 링크를 생성한다.
 */
export interface Citation {
  /** `wiki/{category}/{filename}.md` (qmd output 그대로). */
  readonly wikiPagePath: string
  /** 해당 페이지 frontmatter provenance 에서 수집한 고유 source_id 목록 (prefix 포함 — `sha256:` / `uri-hash:`). */
  readonly sourceIds: readonly string[]
  /** 검색 결과 snippet 재사용 (UI 툴팁용). */
  readonly excerpt?: string
}
