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
  /**
   * Direct children of `dir` only (one level deep). `dir` may end with `/`
   * or not — both forms must resolve to the same folder. Production binding
   * (`ObsidianWikiFS.list`) reads `folder.children` and does NOT recurse.
   */
  list(dir: string): Promise<string[]>
  /**
   * §5.19 Step G fix — recursive markdown enumeration under `dir`.
   * Returns vault-relative paths of all `.md` files in the subtree (files only,
   * directories excluded). Used by wiki maintenance (status / check /
   * recovery / refactoring) which need every page under `wiki/` or every
   * source under `raw/` — the children-only `list` was returning sub-folders
   * (`wiki/entities`, `wiki/concepts`, …) as siblings of `wiki/index.md`,
   * causing zero hits against real vaults.
   */
  walk(dir: string): Promise<string[]>
}

// ── Config ──

export interface WikeyConfig {
  readonly WIKEY_BASIC_MODEL: string
  readonly WIKEY_SEARCH_BACKEND: string
  readonly WIKEY_MODEL: string
  readonly WIKEY_QMD_TOP_N: number

  /**
   * §5.7.5 — canonical alias of WIKEY_QMD_TOP_N. Priority:
   *   WIKEY_SEARCH_TOP_N > WIKEY_QMD_TOP_N (deprecated) > default.
   * Optional so legacy configs (only WIKEY_QMD_TOP_N) continue to parse.
   */
  readonly WIKEY_SEARCH_TOP_N?: number

  /**
   * §5.7.4 — 검색 backend 엔진 선택. 기존 WIKEY_SEARCH_BACKEND ('basic'/'gemma4') 와
   * 의미 분리 — 본 키는 *index 엔진* 선택, 기존 키는 *LLM 합성 layer* 선택.
   *  - 'orama' (default post-§5.7.4): Orama in-process + Kiwi WASM tokenizer
   *  - 'qmd' (회귀): tools/qmd/ vendored CLI subprocess
   */
  readonly WIKEY_SEARCH_ENGINE?: 'orama' | 'qmd'

  /** §5.7.7 — Hybrid search (BM25 + Qwen3-Embedding + RRF) env override. 'on'/'off', default 'off'. */
  readonly WIKEY_HYBRID_MODE?: 'on' | 'off'
  /** §5.7.7 — RRF k value env override. number, default 60 (논문 권고). */
  readonly WIKEY_RRF_K?: number

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

  // §5.6.4 v0.7 — per-provider subscription auth mode (default 'subscription').
  // 'auto' polished out (user plan 2026-05-14): explicit user choice between
  //   'none'         : provider disabled (resolveAuthMode throws)
  //   'subscription' : CLI OAuth path only (no API fallback)
  //   'api'          : HTTP API key path only (no subscription attempt)
  readonly GEMINI_AUTH_MODE?: AuthMode
  readonly ANTHROPIC_AUTH_MODE?: AuthMode
  readonly OPENAI_AUTH_MODE?: AuthMode
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

export type LLMProvider = 'gemini' | 'anthropic' | 'openai' | 'ollama' | 'ollama-cloud'

/**
 * §5.6.4 v0.7 — user-selected routing mode (per-provider). 'auto' polished out
 * (user plan 2026-05-14) — explicit choice eliminates surprise API-key spend
 * from silent fallback when subscription path hits quota / timeout / jsonMode.
 *   - 'none'         : provider disabled (resolveAuthMode throws)
 *   - 'subscription' : force CLI OAuth path (no API fallback on failure)
 *   - 'api'          : force HTTP API key path (no subscription attempt)
 *
 * Legacy 'auto' values found in stored configs are migrated to 'subscription'
 * at load time (auth-mode-bridge / loadCredentials / parseWikeyConf).
 */
export type AuthMode = 'none' | 'subscription' | 'api'

/** §5.6.4 — routing-resolved path. 'none' throws before resolution. */
export type AuthPath = 'subscription' | 'api'

/**
 * §5.6.4 — providers that support a subscription OAuth path. ollama (local)
 * is local-only and ollama-cloud uses SSH+signin auth (no OAuth CLI flow), so
 * both ollama variants are excluded. PoC §0 §3 (2026-05-14) confirmed
 * Ollama Cloud auth = `~/.ollama/id_ed25519` + `ollama signin` — distinct
 * from gemini/anthropic/openai subscription CLI semantics.
 */
export type SubscriptionProvider = Exclude<LLMProvider, 'ollama' | 'ollama-cloud'>

/**
 * §5.6.4 — single source of truth for the path-support matrix row union.
 * Excludes:
 *   - `provider` : selects the *column-set* itself (meta)
 *   - `onAuthFallback` : UI callback, not a CLI flag / API param
 * Resulting cardinality = 8 (model / temperature / maxTokens / seed /
 *   responseMimeType / jsonMode / thinkingBudget / timeout).
 */
export type LLMCliOptionField = Exclude<keyof LLMCallOptions, 'provider' | 'onAuthFallback'>

/**
 * §5.6.4 §3.9 — fallback diagnostic surfaced to UI Notice via callback.
 * core/ui decoupled — wikey-core never imports `obsidian` (I10).
 */
export interface AuthFallbackInfo {
  /**
   * §5.6.5 Step A (2026-05-14) — provider extended to include 'ollama-cloud'
   * so callOllama cloud branch can surface auth-missing (HTTP 401, `ollama
   * signin` required) / quota-exceeded (HTTP 429, Ollama Pro monthly limit)
   * via the same callback shape gemini/anthropic/openai already use.
   */
  readonly provider: SubscriptionProvider | 'ollama-cloud'
  readonly reason:
    | 'quota-exceeded'       // 401/429 from subscription path
    | 'auth-missing'         // CLI not signed in
    | 'spawn-failed'         // child_process error
    | 'jsonMode-unsupported' // F1: subscription CLI cannot enforce JSON
    | 'timeout'              // spawn timeout / AbortController abort
  readonly originalError?: Error
}

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
  /**
   * §5.7.9 — gemini-2.5 thinking budget. When set to 0, callGemini emits
   * `generationConfig.thinkingConfig = { thinkingBudget: 0 }` so the model
   * skips its hidden chain-of-thought (otherwise gemini-2.5-* eats most of
   * `maxTokens` on thinking and truncates short JSON outputs). Other
   * providers ignore this field.
   */
  readonly thinkingBudget?: number
  /**
   * §5.6.4 §3.9 — invoked once when the subscription path falls back to API
   * (auto mode) or when subscription fails (force-subscription throws *before*
   * this callback). Used by main.ts to surface an Obsidian Notice while keeping
   * `wikey-core` Obsidian-free (I10).
   */
  readonly onAuthFallback?: (info: AuthFallbackInfo) => void
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

// ── Schema (Phase 5 §5.10.3 D-wide: LLM-only ontology) ──

/**
 * Phase 5 §5.10.3 R3: 7-type union 폐기 → 자유 string. LLM 이 자율적으로 type 결정.
 * 기존 4 entity types ('organization' | 'person' | 'product' | 'tool') 와
 * 3 concept types ('standard' | 'methodology' | 'document_type') 는 *예시* 로만 잔존.
 * WikiPage.category (entities / concepts / sources / analyses) 4-union 은 디렉토리 구분으로 보존.
 */
export type EntityType = string

export type ConceptType = string

/**
 * A raw mention extracted by Phase B (no classification yet).
 * Stage 2 canonicalizer turns these into WikiPage objects with type assigned.
 *
 * `source_section_idx` (v2 §4.5.1.5): 섹션 단위로 재편되면서 chunk id 대신 섹션 idx 참조.
 * Route FULL 에서는 미설정, Route SEGMENTED 에서만 섹션 번호 주입 (debug/lint 용).
 */
export interface Mention {
  readonly name: string
  // Phase 5 §5.10.3 R3 (D-wide LLM-only): type_hint 자유 string. union 폐기.
  readonly type_hint?: string
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
  /** §5.7.7 Spec 1.2 Outputs (v1.1 Finding 5) — hybrid mode 시 BM25 ranking 안 1-indexed rank. */
  readonly bm25Rank?: number
  /** §5.7.7 Spec 1.2 Outputs — hybrid mode 시 vector ranking 안 1-indexed rank. */
  readonly vectorRank?: number
  /** §5.7.7 Spec 1.3 — RRF fused score (= the same value as `score` after fuse). */
  readonly rrfScore?: number
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

