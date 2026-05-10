---
phase: 5
section: 5.7.7
title: HYBRID Stage 2 vector reroute — BM25 + Qwen3-Embedding 0.6B + RRF 융합 paradigm (Spec + Todo 합본)
status: approved
created: 2026-05-10
updated: 2026-05-10
version: v1.2
---

# Phase 5 §5.7.7 — HYBRID Stage 2 vector reroute (BM25 + Qwen3-Embedding + RRF, Spec + Todo 합본)

> **상위 문서**:
> - [`plan/plan-full.md`](../plan-full.md) §5.7 (운영 인프라 포팅 + 검색 quality)
> - [`plan/phase-5/phase-5-todo.md`](./phase-5-todo.md) §5.7.7.0~6 (Background / Decision rationale + Spec preview — 본 spec 의 진입 결정 source)
> - [`plan/phase-5/phase-5-spec-5.7.8-llm-dynamic-stopword.md`](./phase-5-spec-5.7.8-llm-dynamic-stopword.md) v1.5 (선행 paradigm — query 단계 LLM filter/rewrite/expand. 본 §5.7.7 는 *retrieval 단계* 의 vector layer 추가. 두 layer 가 settings UI Advanced query tuning section 안 *통합 노출*)
> - [`plan/phase-5/phase-5-spec-5.7.4-orama-migration.md`](./phase-5-spec-5.7.4-orama-migration.md) (선행 — Orama schema 안 `embedding: vector[768]` column 가 *기 추가됨* — 본 cycle = 실 데이터 채우기 + 호출 라인 활성)
> - [`wikey.schema.md`](../../wikey.schema.md) §"LLM 참여형 다층 검색" line 374~389 + §"검색 코어의 안정성" line 390~415 (Qwen3-Embedding 0.6B 명시 mirror)
>
> **분리 정당화**: §5.7.6 ABANDON / §5.7.8 v1.5 종결 (LLM per-query stopword) / §5.7.9 v1.0 종결 (gemini thinking fix) — 모두 *query 전처리* layer 영역. 본 §5.7.7 = *retrieval backend* layer 영역 (Orama vector column populate + RRF 융합) — 직교 변경. paradigm 자체 새 layer 도입 + 변경 면 추정 ≥ 5 file → testing.md §3 "Big" 레이어 — spec/todox **합본 1 file** (§5.7.8 / §5.7.9 mirror, master 검증 단일성).
>
> **버전 이력**: v1.0 = analyst SDD+TDD 신규. plan-full §5.7.7 진입 정당화 = §5.7.8 라이브 비교 결과 (master CDP 직접, 2026-05-10 session 34) PASS-B 향상 1 / 회귀 2 — vector layer 부재가 핵심 원인. 사용자 추가 요구사항 (settings UI 통합) 반영. 11-anchor self-check ALL PASS. **Open Questions 9건 (Q2~Q10) — master + 사용자 결정 의뢰 후 v1.1 잠금. Q1 LOCKED (ollama embedding API default — master 환경 사전 점검 실측 mirror)**.
>
> **사전 점검 mirror (2026-05-10 master 직접)**: ollama `dengcao/Qwen3-Embedding-0.6B:Q8_0` (639 MB) pull 후 endpoint 직접 호출 → embedding dim = **1024D 실측** (768 가정 정정). §5.7.4 placeholder `vector[768]` (orama-index.ts:288, line 105 주석) 정정 의무 — 본 cycle impl 시 `vector[1024]` 변경. master ollama list = `qwen3.6:35b-a3b-nvfp4` (chat) + `qwen3:8b` (chat) + `dengcao/Qwen3-Embedding-0.6B:Q8_0` (embedding 신규). wikey single-user 가정 — ollama 첫 사용자 부담 0.

## 0. Context

**현 상태**: wikey 검색 = **Orama BM25 only** (§5.7.4 마이그레이션 결과). Kiwi WASM 한국어 tokenizer + Contextual Retrieval 적용. 단 의미 검색 약함 — paraphrase / synonym / 한↔영 cross-language / 추상 개념 query 회수 손실 (§5.7.8 v1.5 라이브 비교 PASS-B 향상 1 / 회귀 2 실증).

**§5.7.4 의 자산** (placeholder 정정 의무 명시):
- Orama schema 안 `embedding: 'vector[768]'` column = 이미 추가 (`wikey-core/src/search/orama-index.ts:288`) — **본 cycle 정정 대상** = `vector[1024]` (실측 dim mirror)
- mock vector round-trip 만 검증 (AC-V1 sanity, §5.7.4)
- 실 호출 라인 reroute = 본 §5.7.7 핵심 작업
- `upsertWithEmbedding(doc: OramaWikiDoc)` API (line 105) — Float32Array 인자 = dim agnostic, **재사용 가능** (1 spot dim 변경만)
- §5.7.4 사전 마련 인프라 평가 = ~50% (schema field + API 자체 reusable, dim 정정 후도 유효)

**Phase 2 Step 3-3 인프라 인계** (qmd 시절 검증됨):
- 모델 = `dengcao/Qwen3-Embedding-0.6B:Q8_0` (ollama tag, 639 MB disk, context 8192, license = **Apache-2.0**)
- 실측 dim = **1024D** (master 직접 ollama endpoint 호출 mirror, 2026-05-10 session 34)
- 벤치마크 (vsearch 10건, qmd 시절): Top-1 100% / Top-3 100% — EmbeddingGemma-300M (40%/70%) + jina-v3 (30~40%/70%) 압도
- upstream-checker: `wikey-core/src/update/upstream-checker.ts:49` 안 `qwen3-embedding` kind 등록 (Settings UI Developer (advanced) update tracking 5 항목 중 1 — 모니터링 중)
- `wikey.conf` line 80: `# QMD_EMBED_MODEL=hf:Qwen/Qwen3-Embedding-0.6B-GGUF/...` (현재 주석 처리, qmd 시절 활성)
- master 환경 사전 점검 = ollama running + endpoint 호출 성공 + dim 1024 실측 (Q1 LOCKED 근거)

**paradigm = BM25 + Qwen3-Embedding vector 동시 검색 + RRF (Reciprocal Rank Fusion) 융합**. 두 ranking 의 rank 기반 결합으로 도메인별 가중치 tuning 회피.

**이득**:
- 정량 — 51 query benchmark 의 Top-1 ≥ 70% / Top-3 ≥ 88% / MRR ≥ 0.85 달성. cross-lingual / paraphrase query 회수 향상.
- 정성 — wikey schema §"LLM 참여형 다층 검색" line 380~382 의 "BM25 + 벡터로 빠른 1차 필터링" 정의 *원래 의도* 회복. 현 BM25-only 는 schema 정의 vs 실 구현 drift.
- §5.7.4 vector column 자산 활용 — schema 변경 0, 실 데이터 채우기 만.

**Trade-off**:
- Qwen3-Embedding 0.6B ~600MB model download — 처음 1회만, settings UI progress + retry.
- Memory ~600MB RAM — Obsidian renderer 압박. lazy load + unload 정책 (Q3 LOCKED 후 결정).
- 117 페이지 cold reindex p95 ≤ 5분 (CPU) 추정 — UX 부담, progress bar (Q6 LOCKED 후 결정).
- 검색 latency 추가 — query embedding ~50~150ms (cold) / ~10ms (warm cache hit, Q7 LOCKED 후 결정).
- 코드 복잡도 +30% — hybrid query path 디버깅 어려움. fail-open invariant (I6) 으로 BM25 fallback 자동.

**사용자 추가 요구사항 (2026-05-10 session 34)**:
- settings UI 통합 = §5.7.8 Advanced query tuning section *안에 vector hybrid 도 통합*. 별 section 신설 X. 두 layer (query 전처리 + retrieval hybrid) 가 사용자 mental model 단일화.
- Control 1 — Search backend mode (radio 또는 dropdown): `bm25-only` (default — backward compat) / `bm25-hybrid` (BM25 + vector + RRF).
- Control 2 — Hybrid search ON/OFF toggle (slide): ON 시 mode dropdown 활성. OFF 시 hidden / 비활성.
- Master toggle (Enable advanced query tuning) ON 시에만 hybrid 도 노출 (Q9 — sub-control vs 별 master toggle 사용자 결정 의뢰).

## 1. Specs

본 phase 가 다루는 vector hybrid retrieval layer 명세 정의 (5 spec).

### 1.1 Spec 1: Qwen3-Embedding 0.6B local loader (model download + cache + lazy load + unload)

**목적**: Qwen3-Embedding 0.6B GGUF 모델을 로컬에 download / cache / lazy load + 메모리 unload 정책. 검색 첫 호출 시점에 lazy load (메모리 ~600MB).
**이득**: BYOAI + Yours (로컬, 프로바이더 독립). cold start 회피 — 사용자가 hybrid OFF 면 model 미로드.
**Trade-off**: 신규 native dep — Q1 LOCKED 후 결정 (llama.cpp binding vs Ollama embedding API vs cloud — Open Question).

- **Goal**: `Qwen3EmbeddingHandle` 인터페이스 — `embed(text: string): Promise<Float32Array>` + `embedBatch(texts: string[]): Promise<Float32Array[]>` + `unload(): void` + `isLoaded(): boolean`. lazy load (첫 embed 호출 시 ollama endpoint health check). cache path = ollama default (`~/.ollama/models/`, wikey 미관리).
- **Inputs**:
  - `endpoint: 'ollama'` — **Q1 LOCKED (master 환경 사전 점검 실측 mirror)**. 호출 = `POST http://localhost:11434/api/embeddings` body `{ model: "dengcao/Qwen3-Embedding-0.6B:Q8_0", prompt: text }`. wikey-core 의 기존 ollama path (chat / canonicalize 와 동일 endpoint pattern) 재사용. 신규 native dep 0 (Karpathy #2 simplicity). BYOAI 확장 (cloud Gemini text-embedding-004 등) = 본 cycle Out of Scope, 후속 cycle.
  - `model: string` — default `dengcao/Qwen3-Embedding-0.6B:Q8_0`. settings override 가능 (사용자 mental model = wikey-core 의 `WIKEY_BASIC_MODEL` 패턴 mirror).
  - `ollamaUrl: string` — default `http://localhost:11434`. wikey.conf `OLLAMA_URL` env 그대로 재사용.
  - `requestOpts?: { timeout?: number, abortSignal?: AbortSignal }` — fail-open invariant 보장.
- **Outputs**:
  - `Float32Array` (**1024D 실측**) per text — Q8_0 quantization, ollama endpoint 응답 그대로. cosine similarity 직접 계산 가능.
  - `EmbeddingHealthStatus` — `{ loaded: boolean, model: string, ollamaUrl: string, lastUsedMs: number }`.
- **Invariants**:
  - I1 (Apache-2.0 license): Qwen3-Embedding model = Apache-2.0 — wikey LGPL-2.1 호환 (codex Cycle 검증 의무). Ollama = Apache-2.0 / llama.cpp = MIT — 모두 호환.
  - I2 (lazy connect): 첫 embed 호출 시점까지 ollama endpoint health check 미수행. settings hybrid ON / 사용자 reindex trigger 시 1회 health check.
  - I3 (graceful disconnect): ollama 미동작 시 fail-open + Notice "Ollama not running. Hybrid disabled" + settings UI inline error. wikey-core fail 0 회귀.
  - I4 (cancellable request): embed 중 abort signal → AbortController abort + ollama request 취소.
  - I5 (deterministic vector dim): 모든 embed 결과 = 정확 1024D Float32Array. dim ≠ 1024 시 throw + log + hybrid 자동 OFF.
  - **Inew (dimension lock — 단일 source)**: schema dim = 1024 (model native dim). hardcoded magic number 회피 — wikey-core 안 단일 `EMBEDDING_DIM` constant (위치 = `wikey-core/src/search/embedding-config.ts` 신규, 또는 `orama-index.ts` 안). Orama schema + 모든 reference (insert / search / RRF / settings UI badge) 가 본 constant import. 추후 model upgrade (예: Qwen3-Embedding-4B = 2048D 또는 Gemini text-embedding-004 = 768D) 시 1 spot 변경. **§5.7.4 placeholder `vector[768]` 정정 의무** — 본 cycle impl 시 `vector[1024]` 변경 + 기존 §5.7.4 test (orama-index-i22-expand-union.test.ts 등) 영향 grep 의무. 예상 영향 ≤ 3 file.
- **Acceptance Scenarios**:
  - **Happy (lazy connect)**: hybrid OFF → ollama endpoint 미호출. hybrid ON + 첫 query → health check (1 request) + embed → 다음 query 부터 endpoint 직접.
  - **Happy (model 사전 설치)**: 사용자가 미리 `ollama pull dengcao/Qwen3-Embedding-0.6B:Q8_0` 실행 → settings UI 안 model status badge `installed`.
  - **Happy (model 자동 pull)**: 첫 hybrid ON + model 부재 → settings UI Notice "Pulling Qwen3-Embedding model (639 MB)..." + `ollama pull` subprocess + 완료 시 badge 갱신 (Q5 LOCKED 후 자동 pull vs 수동 결정).
  - **Edge (ollama 미동작)**: hybrid ON + ollama 미실행 → I3 graceful disconnect → Notice "Ollama not running" + hybrid 자동 OFF + settings UI inline error.
  - **Edge (license verify)**: model card 확증 — Qwen3 = Apache-2.0 명시. 다른 license 발견 시 fail (Spec 1.1 I1).
  - **Error (timeout)**: embed ≥ 5s timeout → AbortController abort → fail-open + 다른 페이지 진행 (페이지별 fail-open).
  - **Error (model dim mismatch)**: model 응답 dim ≠ 1024 → throw + hybrid 자동 OFF + log + Settings UI badge `failed`.
- **Dependencies**:
  - **Q1 LOCKED — ollama embedding API**. wikey-core 안 기존 ollama path 인프라 재사용 (chat / canonicalize endpoint pattern). 신규 native dep 0. master 환경 사전 점검 실측 (2026-05-10) mirror.
  - `wikey-core/src/embeddings/qwen3-loader.ts` (신규)
  - `wikey-core/src/embeddings/embedding-config.ts` (신규 — Inew dimension lock 단일 source: `EMBEDDING_DIM = 1024 as const` + `EMBEDDING_MODEL_DEFAULT = 'dengcao/Qwen3-Embedding-0.6B:Q8_0'`)
  - 사용자 ollama running 가정 (master single-user 환경 mirror — wikey-core 안 chat 호출도 동일 가정)

### 1.2 Spec 2: Orama vector index integration (embedding column populate + hybrid search path)

**목적**: §5.7.4 placeholder `vector[768]` 을 **`vector[1024]` 로 정정** + 모든 wiki 페이지 의 embedding 주입. hybrid search 시 BM25 + vector 동시 호출.
**이득**: Orama 의 native hybrid mode 활용 — schema field 자체 reusable (§5.7.4 자산), dim 1 spot 변경만.
**Trade-off**: 117 페이지 × 1024D × float32 = ~480KB embedding payload — Orama persist 파일 크기 ~1MB+ 증가. 작은 부담.

- **Goal**: `OramaIndexHandle.search(query, opts)` 시 `opts.mode = 'hybrid'` 시 BM25 + vector → RRF 융합. `opts.mode = 'fulltext'` (default) 시 BM25-only (backward compat).
- **Inputs**:
  - `query: string` — 사용자 raw query (또는 §5.7.8 filter+rewriter+expander 결과).
  - `opts: OramaSearchOptions & { mode?: 'fulltext' | 'hybrid', queryEmbedding?: Float32Array }` — `mode = 'hybrid'` 시 caller 가 query embedding 도 주입 (또는 hybrid path 가 자동 생성).
  - **§5.7.8 expand × hybrid 결합 (Finding 2 codex catch v1.1)**: §5.7.8 의 `effectiveQuery` + `multiQueries` (HyDE 포함) 가 hybrid mode 시 vector layer 에 어떻게 전달되는가:
    - **vector 단일 embed source = `effectiveQuery`** (filter 결과 — generic noise 제거된 정제 query). multiQueries 는 BM25 layer 의 union 검색에만 사용 (기존 §5.7.8 paradigm 유지). HyDE doc 는 vector layer 미사용 — 별 cycle (§5.7.9 candidate #4 expander revision 시 결정).
    - 근거: (a) 단일 embed = 1 ollama call/query (cost 통제) (b) multi-query embedding 은 RRF k-tuning 복잡도 증가 (3+ ranking lists) — 본 cycle Out of Scope, v1.2 후속 (c) HyDE doc 는 BM25 union 으로 이미 회수 향상 — vector embed 추가 시 noise risk (§5.7.8 라이브 비교 english-q3 hallucination-guard false positive mirror).
    - 대안 검토 후 본 cycle = **single embed (effectiveQuery only)** 잠금. multi-query embedding + HyDE embed 는 v1.2 candidate.
- **Outputs**:
  - `readonly SearchResult[]` — RRF fused score 기반 정렬. **§5.7.8 SearchResult extension mirror (Finding 5 codex catch v1.1)**: `bm25Rank?: number` / `vectorRank?: number` / `rrfScore?: number` 옵셔널 field 를 *SearchResult interface 에 직접 추가* (§5.7.8 의 `filterDecision?` / `rewriteDecision?` / `expandDecision?` 패턴 mirror). `metadata.*` 별도 wrapper X — 일관성. UI 시각화는 `result.rrfScore` 등 직접 access.
- **Invariants**:
  - I6 (BM25 backward compat): `mode = 'fulltext'` (default) 시 vector layer 미호출, 기존 738+ test PASS 보장. 검색 0 회귀.
  - I7 (vector optional + fail-open): `mode = 'hybrid'` + ollama unavailable / embed timeout → BM25-only 자동 fallback + console warn.
  - I8 (schema field reuse, dim 정정): Orama schema `embedding` column field 자체 재사용 (§5.7.4 자산). dim 만 `vector[768]` → `vector[1024]` 정정 (Inew mirror). schema 안 다른 변경 0.
  - I9 (incremental ingest): 신규 ingest (single page) 시 자동 embedding 생성 — `runOramaIngest` path 안 통합 (Q4 = write 직전 시점). 기존 reindex 시 batch 생성.
  - I10 (vector dim consistency): Orama insert 시 vector dim ≠ `EMBEDDING_DIM` (=1024) 시 throw. Spec 1.1 I5 + Inew mirror — 단일 source from `embedding-config.ts`.
- **Acceptance Scenarios**:
  - **Happy (cold reindex)**: 117 페이지 cold reindex → 117 페이지 embedding 생성 + persist. `orama-wiki.json` 안 모든 doc 의 embedding field 비-null.
  - **Happy (incremental ingest)**: 신규 page 1개 ingest → embedding 생성 → upsert. 기존 페이지 영향 0.
  - **Happy (hybrid search)**: `mode = 'hybrid'` query → BM25 + vector 동시 → RRF fused result.
  - **Edge (mode = fulltext)**: 기존 path → vector layer 미호출 (성능 회귀 0).
  - **Edge (embedding fail)**: Qwen3 load fail → BM25-only fallback + console warn + 결과 정상 (검색 0 회귀).
  - **Error (vector dim mismatch)**: insert 시 dim ≠ 1024 (`EMBEDDING_DIM`) → throw → caller `runOramaIngest` 에서 catch + log + 해당 page hybrid 비활성 + BM25 record 정상 insert (페이지별 fail-open). reindex partial 상태 회피 — failed page 만 hybrid skip, BM25 검색 영향 0.
- **Dependencies**:
  - `wikey-core/src/search/orama-index.ts::search()` (line ~318 hybrid path 활성)
  - `wikey-core/src/search/orama-index.ts::insert()` + `runOramaIngest` (embedding column populate)
  - Spec 1.1 의 `Qwen3EmbeddingHandle`

### 1.3 Spec 3: RRF (Reciprocal Rank Fusion) 융합 layer

**목적**: BM25 ranking + vector ranking 을 *rank 기반* 으로 결합. `score = sum_i (1 / (k + rank_i))` — 도메인별 score 정규화 회피.
**이득**: 가중치 hyperparameter (alpha) 회피 — 두 ranking 의 reciprocal rank 합산만. 강건 (BM25 score 분포 차이에 둔감).
**Trade-off**: k value tuning 필요 (논문 권고 = 60, 작은 vault 적합 = 30 — Q3 LOCKED 후 결정).

- **Goal**: `rrfFuse(bm25Results, vectorResults, opts: { k: number, topN: number }): SearchResult[]` — 두 ranking 을 reciprocal rank 합산 + topN cut.
- **Inputs**:
  - `bm25Results: SearchResult[]` — BM25 ranking (score 내림차순 정렬).
  - `vectorResults: SearchResult[]` — vector cosine ranking (similarity 내림차순).
  - `opts: { k: number, topN: number }` — k = RRF constant (default = 60, settings UI customizable). topN = cut.
- **Outputs**:
  - `SearchResult[]` (length ≤ topN) — `score = 1/(k+rank_bm25) + 1/(k+rank_vec)`. 정렬 = score 내림차순. metadata.bm25Rank / vectorRank / rrfScore 옵셔널.
- **Invariants**:
  - I11 (RRF formula): `score(doc) = sum_{r in ranking lists} 1 / (k + rank_in_r(doc))`. doc 가 한 ranking 만 있을 시 다른 rank 무한대 → reciprocal = 0.
  - I12 (k externalized): k value = settings or vault config (`.wikey/search.yaml`) 외부화. hardcoded set / list 0건. Karpathy #2 위반 회피.
  - I13 (deterministic): 동일 input → 동일 output (Phase 4 §4.5.1.7 결정성 정책 mirror — vector layer 도 결정적, Float32Array 동일 input 시 동일 output).
  - I14 (preserve topN order): topN cut 후 score 내림차순 — same-score tie 시 BM25 우선 (정확 매칭 우선 정책).
- **Acceptance Scenarios**:
  - **Happy (양쪽 ranking 모두)**: BM25 = [A, B, C], vector = [B, A, D] → RRF: A score = 1/61 + 1/62, B = 1/62 + 1/61, C = 1/63, D = 1/63 → A = B > C = D.
  - **Happy (vector only)**: BM25 = [], vector = [A, B] → A = 1/61, B = 1/62.
  - **Happy (bm25 only)**: vector = [], bm25 = [A] → A = 1/61.
  - **Edge (empty)**: 양쪽 모두 빈 list → 빈 list.
  - **Edge (k = 30)**: 작은 vault 적합 = score scaling.
  - **Edge (tie)**: same score → BM25 rank 우선.
- **Dependencies**:
  - `wikey-core/src/search/rrf-fusion.ts` (신규)

### 1.4 Spec 4: Settings UI integration — Advanced query tuning section 통합 (§5.7.8 mirror)

**목적**: §5.7.8 의 Advanced query tuning section 안 vector hybrid 도 통합 노출. Search backend mode dropdown + Hybrid search toggle + RRF k value + Qwen3 download status. 사용자 mental model 단일화.
**이득**: §5.7.8 paradigm + 본 §5.7.7 paradigm 모두 query 단계 향상 — 분리하지 않음. UI 응집성 향상. backward compat (default OFF).
**Trade-off**: settings-tab.ts 변경 면 ~60~80 LOC 추가 (3+ control + state binding).

- **Goal**: `wikey-obsidian/src/settings-tab.ts` 의 `Advanced query tuning` section 안 (line 117 이후) 추가:
  - **Control A — Hybrid search toggle (slide)** — ON 시 vector hybrid 활성, OFF 시 BM25-only (§5.7.4 path). **Q10 결정 (Finding 4 codex catch v1.1) — toggle 단일로 binary state 충분, mode dropdown 제거**. `searchHybridEnabled: boolean` 1 field 으로 `searchBackendMode: 'bm25-only' | 'bm25-hybrid'` 대체. Karpathy #2 simplicity + UI 응집성.
  - **Control B — RRF k value (number input, default 60)** — Hybrid toggle ON 시만 활성.
  - **Control C — Qwen3 model download status badge** — 미설치 / downloading (progress) / installed.
- **Inputs**:
  - 사용자 settings UI 조작 — toggle / dropdown / number input.
  - `wikey-obsidian/src/main.ts` 의 `WikeySettings` interface — 신규 4 field.
- **Outputs**:
  - settings persistence (`.obsidian/plugins/wikey/data.json`) — 신규 4 field 저장.
  - runtime 영향 — `searchHybridEnabled true` 시 search 호출 path 의 `mode = 'hybrid'` 적용. Qwen3 lazy load.
  - Settings UI 안 Advanced query tuning section 확장.
- **Invariants**:
  - I15 (default OFF): `searchHybridEnabled` default = `false` — Spec I6 backward compat. 기존 사용자 영향 0.
  - I16 (master toggle dependency): Q9 LOCKED 후 결정 — Hybrid toggle 가 §5.7.8 master toggle 의 sub-control 인가 (master OFF 시 hybrid 도 OFF), 별 master toggle 인가. analyst 추천 = sub-control (master OFF 시 hybrid 도 OFF — backward compat 단일화).
  - I17 (lazy model load): Hybrid toggle ON 시만 vector embedding generation pipeline 활성 — OFF 시 model 미로드.
  - I18 (settings persist): 변경 시 `data.json` 갱신 + plugin reload 시 복원.
  - I19 (download status reactive): model 미설치 시 첫 hybrid ON → download progress 표시. 완료 시 badge `installed` 갱신.
- **Acceptance Scenarios**:
  - **Happy (default OFF)**: 신규 사용자 설치 → master toggle OFF → hybrid 미표시. 기존 path 동작.
  - **Happy (master ON + hybrid OFF)**: master toggle ON → 기존 §5.7.8 control 9건 + 신규 hybrid toggle OFF default 표시. 기존 query 전처리 만 활성. retrieval = BM25-only.
  - **Happy (master ON + hybrid ON)**: hybrid toggle ON → mode = `bm25-hybrid` + RRF k 활성 + Qwen3 download status 표시. search 호출 시 hybrid path.
  - **Happy (RRF k = 30)**: 사용자가 k = 30 변경 → 즉시 다음 search 부터 적용.
  - **Edge (model 미설치 + hybrid ON)**: download progress + Notice "Qwen3 downloading..." 표시. 완료 시 hybrid 활성.
  - **Edge (model 부재 + download fail)**: hybrid 자동 OFF + console warn + Settings UI inline error.
- **Dependencies**:
  - `wikey-obsidian/src/settings-tab.ts` (line 111~272 Advanced query tuning section 안 추가)
  - `wikey-obsidian/src/main.ts` (`WikeySettings` interface — 신규 4 field 추가, default false/60)
  - Spec 1.1 의 Qwen3 loader

### 1.5 Spec 5: Cold reindex command + incremental ingest path 통합 + 51 query benchmark hybrid mode 측정

**목적**: 117 페이지 cold reindex 시 모든 페이지 embedding 일괄 생성. ingest pipeline 안 신규 페이지 자동 embedding. 51 query benchmark 가 hybrid mode 도 측정 가능.
**이득**: §5.7.8 의 51 baseline + auto-extend mechanism 자산 활용. master 직접 라이브 cycle smoke 1회로 ablation (BM25-only vs hybrid) 비교 가능.
**Trade-off**: cold reindex p95 ≤ 5분 (CPU) — UX 부담, progress bar 의무 (Q6 LOCKED 후 결정).

- **Goal**:
  - `./scripts/reindex.sh --hybrid` (또는 settings UI button) → cold reindex + 모든 페이지 embedding 일괄 생성 + Orama persist.
  - `runOramaIngest` 안 신규 페이지 자동 embedding (incremental ingest path 통합).
  - `npm run benchmark:search -- --mode bm25` / `--mode hybrid` — 51 query 의 ablation 비교 가능.
- **Inputs**:
  - `wikiDir: string` (default `wiki/`)
  - `mode: 'bm25-only' | 'hybrid'` (cli flag 또는 settings)
  - `onProgress?: (cur: number, total: number) => void` — settings UI progress.
- **Outputs**:
  - reindex 결과 — `{ docCount: number, embeddingCount: number, ms: number, persistPath: string }`.
  - benchmark stdout — `# Mode: hybrid` / `# Top-1: N/N` / `# Top-3: N/N` / `# Mean MRR: 0.XXX` / `# Per domain: ...`.
- **Invariants**:
  - I20 (cold reindex idempotent): 같은 wiki/ + 같은 model 두 번 reindex → 같은 embedding (Float32Array byte equal).
  - I21 (incremental embedding): ingest 중 신규 page 1개 → 기존 116 페이지 영향 0 — 신규만 embedding 생성.
  - I22 (cancellable): cold reindex 중 abort → partial state cleanup + retry 가능.
  - I23 (ablation 가능): benchmark suite 의 동일 query 가 BM25-only / hybrid 두 mode 측정 — Top-1 / Top-3 / MRR diff 명시 노출.
  - I24 (target metric): aggregate Top-1 ≥ 70% / Top-3 ≥ 88% / MRR ≥ 0.85 (51 query, hybrid mode).
- **Acceptance Scenarios**:
  - **Happy (cold reindex)**: 117 페이지 → 117 embedding + persist + p95 ≤ 5분 + progress 표시.
  - **Happy (incremental)**: 1 신규 page ingest → 1 embedding 생성 + upsert. 기존 페이지 영향 0.
  - **Happy (benchmark)**: `npm run benchmark:search -- --mode hybrid` → Top-1 ≥ 70% + Top-3 ≥ 88% + MRR ≥ 0.85.
  - **Happy (ablation)**: BM25-only vs hybrid 측정 → diff 명시.
  - **Edge (cancel)**: reindex 중 cancel → 부분 state cleanup.
  - **Edge (progress UI)**: 117 페이지 progress 가 사용자에게 시각적 noticeable.
  - **Error (embedding fail mid-reindex)**: 1 페이지 embedding fail → log + 다음 페이지 진행 (페이지별 fail-open) + 최종 결과에 fail 페이지 명시.
- **Dependencies**:
  - `scripts/reindex.sh` + `wikey-core/src/scripts/reindex.ts`
  - `wikey-core/src/scripts/benchmark-search.ts` (export `runBenchmark` + searchFn injection — §5.7.6 ABANDON 자산)
  - `wikey-core/eval/benchmark-suite.json` (51 baseline + auto-extend mechanism, §5.7.8 자산)
  - master 직접 라이브 cycle smoke (CDP 또는 Settings UI button) — `obsidian-cdp` SKILL.

## 2. Risk grid (8 항목)

| # | Risk | 영향도 | 완화 방법 |
|---|------|--------|-----------|
| R1 | ollama 미동작 / 미설치 사용자 — hybrid OFF fallback | MED | I3 graceful disconnect + Notice + Settings UI inline error + master single-user 가정 (ollama 기존 사용자) |
| R2 | 117 페이지 × 1024D × float32 = ~480KB embedding — cold reindex sequential ollama call = ~3~5분 (master M4 Pro 추정). UX 부담 | **HIGH** | progress bar 의무 + cancellable + incremental ingest path |
| R3 | Orama vector ANN latency 변동성 (HNSW or flat index) | MED | Orama 3.x flat index default — 117 페이지 규모에서 충분 (수 ms 내) |
| R4 | 한국어 query 의 Qwen3 embedding 품질 — Phase 2 영문 + 한국어 mix vsearch 100% (qmd 시절). 본 cycle 51 query 재측정 의무 | MED | 51 query benchmark hybrid mode 측정 + ablation diff |
| R5 | RRF k value tuning — 도메인별 최적 k 다를 수 있음 | MED | settings UI customizable + default 60 (논문) + 51 query 측정으로 검증 |
| R6 | §5.7.4 placeholder dim 정정 영향 — `vector[768]` → `vector[1024]` 변경 시 기존 §5.7.4 test (orama-index-i22-expand-union.test.ts 등) 영향 — 예상 ≤ 3 file | MED | 본 cycle Step C 시작 시 grep `vector\[768\]` + `768D` 의무. 영향 file 모두 정정 (Inew dimension lock single source 도입) |
| R7 | vector index storage size — 117 페이지 ~480KB 단순 증가 (작음) | LOW | 무시 가능 |
| R8 | 모델 disk usage — `dengcao/Qwen3-Embedding-0.6B:Q8_0` ~639 MB | LOW | 처음 1회만, ollama 가 model 관리. settings UI 안 status 표시 |

## 3. Dependencies

- 선행 ✅: §5.7.4 (Orama 마이그레이션, schema vector column 자산) / §5.7.8 v1.5 (paradigm 자산 + Advanced query tuning section + 51 query benchmark + auto-extend) / §5.7.9 v1.0 (gemini thinking fix — embedding 호출 안 LLM API 의존성 0 이므로 직접 영향 0, 단 advanced query tuning + vector hybrid 시너지 검증 source)
- 후행: §5.5 (지식 그래프) 와 시너지 — graph + embedding 결합 재현 검색

## 4. Out of Scope

본 cycle 명시 제외 항목:
- Anthropic / OpenAI / Gemini cloud embedding API (BYOAI) — 본 cycle = local Qwen3 only. cloud embedding 후속 cycle 검토.
- Cross-encoder reranking (예: bge-reranker) — 본 cycle = RRF first-pass only. LLM rerank 가 cover (§5.7.8 Advanced query tuning).
- Embedding model upgrade (Qwen3-Embedding-4B 등) — upstream sync UI (`wikey-core/src/update/upstream-checker.ts:49`) 가 모니터링 — 사용자 결정 영역.
- ingest pipeline 안 chunk-level embedding (long page 분할) — 본 cycle = page-level whole-document embedding. chunk-level 은 후속 (§5.5 graph 시너지).
- 사용자 query embedding cache — 본 cycle = ingest-time pre-compute only. query embedding cache 는 Q7 LOCKED 후 별 cycle.
- vault-level customize hyperparameter (alpha 단일 default 60 외 vault 별 override 등) — 본 cycle = settings UI customizable 만.
- Stage 3 reranker 통합 (LLM rerank) — wikey schema mirror, 별 layer (§5.7.8 Advanced query tuning 이 cover).
- qmd fallback path 의 hybrid 적용 — `WIKEY_SEARCH_ENGINE=qmd` 회귀 path 는 본 cycle scope 외 (§5.7.8 v1.5 §1.2 Out of Scope mirror — 검색 코어 인프라 영역).

## 5. Open Questions (사용자 결정 의뢰, 9건. Q1 LOCKED)

| # | Question | 권고 (analyst) | 영향 |
|---|----------|---------------|------|
| ~~Q1~~ | ~~Embedding endpoint~~ — **LOCKED v1.0**: ollama embedding API default (`POST /api/embeddings`, model `dengcao/Qwen3-Embedding-0.6B:Q8_0`). master 환경 사전 점검 실측 mirror (2026-05-10). BYOAI cloud (Gemini text-embedding-004) = 후속 cycle | Spec 1.1 Inputs ✅ | Spec 1.1 |
| ~~Q2~~ | ~~Hybrid default 활성~~ — **LOCKED v1.2 (사용자 일괄 APPROVE 2026-05-10)**: **OFF (opt-in)** — backward compat (Spec I6) + Karpathy #2. master toggle ON 시 사용자가 명시 OFF→ON 결정. | Spec 1.4 I15 ✅ |
| ~~Q3~~ | ~~RRF k value default~~ — **LOCKED v1.2**: **k = 60 (논문 권고)** — 51 query 측정으로 검증. 사용자 settings 으로 customize 가능 (Spec I12). | Spec 1.3 + 1.4 ✅ |
| ~~Q4~~ | ~~Embedding 생성 시점 + source text~~ — **LOCKED v1.1 (Finding 3 codex catch)**: write 직전 + `${title}\n\n${body}` union (BM25 source mirror, frontmatter 미포함 — PII surface 회피, markdown 표준 H1 패턴) | Spec 1.2 I9 + Spec 1.5 ✅ |
| ~~Q5~~ | ~~모델 자동 download~~ — **LOCKED v1.2**: 자동 download (`ollama pull <model>` subprocess). settings UI progress + retry + cancel + 사용자 수동 fallback (cli `./scripts/reindex.sh --download-model`) | Spec 1.1 Inputs + Spec 1.4 ✅ |
| ~~Q6~~ | ~~Cold reindex progress bar / cancel~~ — **LOCKED v1.2**: YES — settings UI progress + Notice + cancel button | Spec 1.5 I22 + Acceptance ✅ |
| ~~Q7~~ | ~~Cross-language query 처리~~ — **LOCKED v1.2**: 같은 model (1-pass) — Qwen3 multilingual 강함, 별 model 비용/복잡도 회피 | Spec 1.1 ✅ |
| ~~Q8~~ | ~~Orama vector index storage~~ — **LOCKED v1.2**: `~/.cache/wikey/orama/wikey-wiki.json` — §5.7.4 기존 path 그대로, vector field 추가만 | Spec 1.2 I8 ✅ |
| ~~Q9~~ | ~~Hybrid toggle 가 master toggle sub-control~~ — **LOCKED v1.2**: sub-control — master OFF 시 hybrid 도 OFF (단일화). 사용자 mental model 단일 — query 전처리 + retrieval hybrid 모두 advanced query tuning 영역 | Spec 1.4 I16 ✅ |
| ~~Q10~~ | ~~Search backend mode dropdown 위치~~ — **LOCKED v1.1 (Finding 4 codex catch)**: dropdown 제거. Hybrid toggle 단일로 binary state 충분. `searchHybridEnabled: boolean` 1 field 으로 단일화. | Spec 1.4 Control B 제거 ✅ |

**v1.2 = 모든 Q LOCKED. 사용자 일괄 APPROVE 2026-05-10 → Step B~F SDD+TDD impl 진입 가능**.

## 6. Specs ↔ AC ↔ Invariants 1:1 매핑

| Spec | Invariants | Acceptance count | Risk |
|------|-----------|------------------|------|
| Spec 1 (Qwen3 loader) | I1~I5 + **Inew (dimension lock)** (6건) | 7 case | R1, R8 |
| Spec 2 (Orama vector integration) | I6~I10 (5건) | 6 case | R3, R4, R6 |
| Spec 3 (RRF fusion) | I11~I14 (4건) | 6 case | R5 |
| Spec 4 (Settings UI) | I15~I19 (5건) | 6 case | (UI risk minimal) |
| Spec 5 (Reindex + benchmark) | I20~I24 (5건) | 7 case | R2 |
| **합계** | **25 invariants** | **32 AC** | **8 risks** |

## 7. Specs 변경 면 추정

| 영역 | 파일 | 변경 분포 (추정) | 비고 |
|------|------|------------------|------|
| Embedding loader | `wikey-core/src/embeddings/qwen3-loader.ts` (신규) | ~150 LOC | Q1 LOCKED — ollama API path |
| Embedding config | `wikey-core/src/embeddings/embedding-config.ts` (신규) | ~30 LOC | **Inew dimension lock 단일 source** — `EMBEDDING_DIM = 1024 as const` + `EMBEDDING_MODEL_DEFAULT` |
| Hybrid query path | `wikey-core/src/search/orama-index.ts::search()` (line ~318) | ~80 LOC 변경 | BM25 + vector + RRF 통합. `vector[768]` → `vector[1024]` 정정 (line 288) + 주석 정정 (line 105 `768D` → `1024D`) |
| Ingest path | `wikey-core/src/search/orama-index.ts::insert/runOramaIngest` | ~60 LOC 변경 | embedding column populate (Stage 3 후) |
| RRF fusion | `wikey-core/src/search/rrf-fusion.ts` (신규) | ~80 LOC | reciprocal rank 합산 + topN cut |
| Settings UI | `wikey-obsidian/src/settings-tab.ts` (line 111~272 안 추가) | ~80 LOC | hybrid toggle + mode dropdown + RRF k + Qwen3 status |
| Settings interface | `wikey-obsidian/src/main.ts` (line 115~ WikeySettings) | ~20 LOC | 신규 4 field + default |
| Config | `wikey-core/src/config.ts` (`WIKEY_SEARCH_ENGINE` 옆) | ~10 LOC | `WIKEY_HYBRID_MODE`, `WIKEY_RRF_K` 추가 (env override) |
| Tests (RED) | `wikey-core/src/__tests__/orama-hybrid.test.ts` (신규) | ~250 LOC | unit + integration. Spec 1~5 의 32 AC cover |
| Tests (RED) | `wikey-core/src/__tests__/qwen3-loader.test.ts` (신규) | ~150 LOC | Spec 1 의 7 AC cover |
| Tests (RED) | `wikey-core/src/__tests__/rrf-fusion.test.ts` (신규) | ~80 LOC | Spec 3 의 6 AC cover |
| Tests (Settings) | `wikey-obsidian/src/__tests__/settings-hybrid.test.ts` (신규) | ~100 LOC | Spec 4 의 6 AC cover |
| Reindex script | `scripts/reindex.sh` + `wikey-core/src/scripts/reindex.ts` | ~30 LOC | embedding column populate path + progress |
| Benchmark mode flag | `wikey-core/src/scripts/benchmark-search.ts` | ~20 LOC | `--mode bm25` / `--mode hybrid` ablation |
| Documentation | `docs/qwen3-embedding-vendor.md` (신규) | ~80 LOC | NOTICE + license + cache path + 1 endpoint 결정 (Q1) |

**총 변경 면 추정**: ~1,220 LOC (코드 ~540 + test ~580 + docs ~80 + config/script ~20). Karpathy #2 검토 — paradigm 자체 새 layer (검색 코어 hybrid) 도입이므로 변경 면 정당. raw/ 변경 0 / wiki/ 변경 0 / canonicalizer / mention extractor / ingest pipeline 핵심 0 변경. **§5.7.4 placeholder 정정 영향** — `vector[768]` 및 `768D` 문자열 grep 의무 (예상 ≤ 3 file: orama-index.ts + 기존 test 파일 + 주석).

## 8. Todo (HOW) — Step A~F 단계 (TDD RED→GREEN 순)

### Step A — Spec/Todox 잠금 + Open Questions 결정 (master + 사용자)

- (A1) 본 spec v1.0 산출 — analyst 1차 self-check 11-anchor PASS
- (A2) master 1차 검증 (Layer 1~3 anchor 20개 — wikey.schema.md 4 원칙 + Karpathy 4원칙 + plan internal consistency)
- (A3) **codex Mode D Panel 송부** (사용자 명시 의무, agent-management.md §0 + master-validation skill 26-anchor + cmux skill T1)
- (A4) Open Questions 10건 사용자 결정 → v1.1 잠금
- (A5) 사용자 plan APPROVE → SDD+TDD impl 진입

### Step B — TDD RED (failing tests 작성)

- (B0) **§5.7.4 placeholder grep + 정정 사전 작업** — `grep -rn "vector\[768\]\|768D Qwen3" wikey-core/src/` → 영향 ≤ 3 file 확증 + 정정 (단, 이 단계는 Step C 와 함께 atomic 변경으로도 가능).
- (B1) `qwen3-loader.test.ts` (신규) — Spec 1 의 7 AC. ollama endpoint mock (HttpClient mock — wikey-core 의 chat test 패턴 mirror). 현재 RED.
- (B2) `rrf-fusion.test.ts` (신규) — Spec 3 의 6 AC. pure function unit test. 현재 RED.
- (B3) `orama-hybrid.test.ts` (신규) — Spec 2 의 6 AC + Spec 5 의 일부 (incremental ingest). mock Qwen3 + Orama in-memory. 현재 RED.
- (B4) `settings-hybrid.test.ts` (신규, wikey-obsidian) — Spec 4 의 6 AC. mock Settings + WikeySettings interface. 현재 RED.
- (B5) `npm test` 실행 → 4 file 모두 RED 확증 (FAIL count >0).

### Step C — TDD GREEN (impl + RED→GREEN)

- (C0) `wikey-core/src/embeddings/embedding-config.ts` 신규 — `EMBEDDING_DIM = 1024 as const` + `EMBEDDING_MODEL_DEFAULT = 'dengcao/Qwen3-Embedding-0.6B:Q8_0' as const`. **Inew dimension lock 단일 source**.
- (C1) `wikey-core/src/embeddings/qwen3-loader.ts` 신규 — Spec 1 impl (Q1 LOCKED — ollama API)
  - `POST http://localhost:11434/api/embeddings` JSON `{ model: EMBEDDING_MODEL_DEFAULT, prompt: text }` (settings UI override 가능)
  - lazy connect + graceful disconnect + abort signal honored
  - B1 RED → GREEN
- (C2) `wikey-core/src/search/rrf-fusion.ts` 신규 — Spec 3 impl. reciprocal rank 합산 + topN cut + tie-break BM25 우선
  - B2 RED → GREEN
- (C3) `wikey-core/src/search/orama-index.ts::search()` 수정 — `mode = 'hybrid'` 분기 + Qwen3 호출 + RRF 융합 + **`vector[768]` → `vector[1024]` 정정** (line 288) + 주석 정정 (line 105)
  - B3 RED → GREEN (일부)
- (C4) `wikey-core/src/search/orama-index.ts::insert()` + `runOramaIngest` — embedding column populate (Q4 결정 = write 직전 시점)
  - B3 RED → GREEN (일부)
- (C5) `wikey-obsidian/src/main.ts` `WikeySettings` interface — 신규 **3 field 추가** (Finding 4 codex catch v1.1: `searchBackendMode` 제거, toggle 단일화)
  - `searchHybridEnabled: boolean` (default false)
  - `searchRrfK: number` (default 60)
  - `searchQwen3DownloadStatus: 'idle' | 'downloading' | 'installed' | 'failed'` (default 'idle')
- (C6) `wikey-obsidian/src/settings-tab.ts` (line 111~272 안) — hybrid toggle + mode dropdown + RRF k + Qwen3 status badge 추가
  - Q9 = sub-control 적용 시 master toggle ON 시만 hybrid 표시 (line 141 mirror)
  - B4 RED → GREEN
- (C7) `wikey-core/src/config.ts` — `WIKEY_HYBRID_MODE` / `WIKEY_RRF_K` env override 추가
- (C8) `scripts/reindex.sh` + `wikey-core/src/scripts/reindex.ts` — `--hybrid` flag + progress + cancel
- (C9) `wikey-core/src/scripts/benchmark-search.ts` — `--mode bm25` / `--mode hybrid` ablation flag

### Step D — 회귀 검증 + Phase 3a/3b

- (D1) `npm test` 실행 — wikey-core 738+ + wikey-obsidian 100+ 기존 test ALL PASS + 신규 32 AC ALL PASS
- (D2) `npm run build` 실행 — 0 errors
- (D3) `./scripts/validate-wiki.sh` — wiki/ 정합성 회귀 0
- (D4) Phase 3a — 회귀 검증 PASS 확증
- (D5) Phase 3b — BLUE refactor (CLAUDE.md SDD+TDD §)
  - 함수 분해 (Qwen3 loader 의 download / load / embed / unload — 50+ LOC 함수 추출)
  - Naming consistency (`searchMode` / `hybridEnabled` 등 일관)
  - 중복 제거 (settings-tab Advanced query tuning section 안 control 패턴 — `renderToggle` / `renderDropdown` extract)
  - 주석 quality (TODO/FIXME 0 / historical context 압축)
  - 회귀 검증 반복 (각 refactor 후 PASS)

### Step E — 라이브 cycle smoke (master 직접)

- (E1) **master 직접 실행 의무** — agent-management.md §6 (라이브 검증 master 1차 책임). tester 위임 X.
- (E2) `./scripts/reindex.sh --hybrid` 실행 — 117 페이지 cold reindex + 117 embedding 생성 + persist + p95 ≤ 5분 측정
- (E3) `npm run benchmark:search -- --mode bm25` baseline 측정 → Top-1 / Top-3 / MRR 기록
- (E4) `npm run benchmark:search -- --mode hybrid` 측정 → Top-1 / Top-3 / MRR 기록 + ablation diff
- (E5) 라이브 CDP smoke — Settings UI Advanced query tuning section → master toggle ON → hybrid toggle ON → mode dropdown / RRF k 확인 → chat panel 안 query 1~2건 → SearchResult metadata badge 확인
- (E6) §5.7.8 v1.5 의 10 query 라이브 비교 (PASS-A / PASS-B / PASS-C 3 mode) 재실측 — hybrid OFF vs hybrid ON 효과 명시
- (E7) 결과 → `activity/phase-5/phase-5-resultx-5.7.7-vector-hybrid-reroute-2026-MM-DD.md` 작성

### Step F — codex post-impl review + doc sweep

- (F1) codex Mode D Panel 송부 (post-impl) — 26-anchor cross-check
- (F2) finding 처리 (NEEDS_REVISION 시 fix loop)
- (F3) 사용자 plan-impl APPROVE
- (F4) `plan/phase-5/phase-5-todo.md` §5.7.7 status `🟢 종결` 갱신
- (F5) `plan/plan-full.md` §5.7 row 갱신
- (F6) `wikey.schema.md` §"검색 코어의 안정성" 안 hybrid mode default toggle 명시 (사용자 승인 필수)
- (F7) `activity/phase-5/phase-5-result.md` §5.7.7 entry 추가
- (F8) `wiki/log.md` ingest entry (지식 변화 시만 — 본 cycle = 코드 / settings 변경, log.md 변경 0 가능)
- (F9) commit + push

## 9. self-check (master 1차 검증 의무, 11-anchor)

| anchor | 검증 | 결과 |
|--------|------|------|
| (a) plan internal consistency | spec 5 / Risk 8 / Open Q 10 / Spec↔AC↔Invariants matrix / Todo Step A~F / 변경 면 추정 — 모두 일관 | PASS |
| (b) cross-file consistency | spec ↔ phase-5-todo §5.7.7 (preview) byte-equal mirror — Goal / 변경 면 / AC count / 진입 결정 기준 일치. spec ↔ §5.7.8 v1.5 Advanced query tuning section 통합 정합 | PASS |
| (c) byte-equal mirror | wikey.schema.md line 391 ("Qwen3-Embedding 0.6B") byte-equal. §5.7.4 schema column `embedding: vector[768]` = **본 cycle 정정 대상** (`vector[1024]`). ollama model tag `dengcao/Qwen3-Embedding-0.6B:Q8_0` byte-equal (master 사전 점검 mirror). dim = 1024 (실측 mirror) | PASS |
| (d) feasibility | 코드 ~540 + test ~580 + docs ~80 + config/script ~20 = ~1,220 LOC. paradigm 자체 새 layer 정당. Q1 LOCKED (ollama API) → 신규 native dep 0 → Obsidian electron 호환 위험 회피. cold reindex p95 ≤ 5분 = M4 Pro 추정 (Phase 2 qmd 시절 117 페이지 ~3분 데이터 mirror). master 환경 사전 점검 (ollama running + model pull + endpoint 응답 1024D) 검증됨 | PASS |
| (e) legal | Qwen3-Embedding model = **Apache-2.0** (HuggingFace model card 확증 의무 — Spec 1.1 I1 + R8 mirror). wikey LGPL-2.1 호환 (§5.7.3 결정 mirror). Ollama (Apache-2.0) — 호환. cloud (Gemini text-embedding-004) = 후속 cycle BYOAI 확장 시점 license 재확증 | PASS |
| (f) numeric consistency | Top-1 70% / Top-3 88% / MRR 0.85 (§5.7.8 v1.5 baseline 66.7% / 86.3% / 0.829 mirror). RRF k = 60 (논문 권고). model size ~639 MB (실측). embedding payload ~480KB (117 × 1024 × 4 bytes). cold reindex p95 ≤ 5분. **dim = 1024 (실측, single source `EMBEDDING_DIM` constant)**. 모든 reference 일관 | PASS |
| (g) scope discipline | Out of Scope 9 항목 명시 (cloud embedding / cross-encoder rerank / model upgrade / chunk-level / query embedding cache / vault customize / Stage 3 reranker / qmd fallback hybrid). §5.7.8 / §5.7.9 와 직교 명시 | PASS |
| (h) wikey.schema.md 4 원칙 | **Explicit** = embedding 결정 metadata (rrfScore / bm25Rank / vectorRank) UI 노출 (Spec 1.4). **Yours** = 로컬 cache (`~/.cache/wikey/qwen3-embedding/`), 프로바이더 독립 (Q1 ABC 모두 BYOAI). **File over app** = vector file plain JSON (Orama persist), git-trackable (단 cache 는 ignore 권장). **BYOAI** = endpoint 3 옵션 (Q1) + cloud embedding 후속 cycle 가능 | PASS |
| (i) 3계층 경계 | raw/ 변경 0 (불변). wiki/ 본문 변경 0 (embedding 은 별 cache, frontmatter 영향 0). schema 변경 0 (§5.7.4 `embedding: vector[768]` 자산 활용). settings 사용자 명시 변경만 (Q9 sub-control) | PASS |
| (j) 워크플로우 일관 | wikey.schema.md §"워크플로우 2 (쿼리)" line 304 흐름 — `LLM: wiki/index.md 읽기` 단계가 hybrid mode 시 `LLM 쿼리 확장 → BM25 + vector → RRF → LLM 리랭킹 → LLM 합성` 으로 자연 확장. 워크플로우 1 (인제스트) 안 line 277 `wiki/entities/, wiki/concepts/ 페이지 생성` 직후 embedding generation 자동 (Q4 = write 직전). 워크플로우 4 (소스 삭제) — 페이지 삭제 시 Orama record 삭제로 embedding 도 자동 삭제 (별 처리 0) | PASS |
| (k) 하드코딩 금지 | RRF k = settings UI customizable (Spec 1.3 I12). Qwen3 model = `EMBEDDING_MODEL_DEFAULT` constant + settings override (Spec 1.1). **dim = 1024 = `EMBEDDING_DIM` 단일 source constant (Inew)** — 추후 model upgrade 시 1 spot 변경 (hardcoded magic number 회피). endpoint = ollama default + settings override (BYOAI 후속 cycle). domain list / category mapping 0건 (§5.7.8 mirror — paradigm 자체 LLM 자율). cache path = ollama default (`~/.ollama/models/`) — wikey 미관리 | PASS |

11 anchor (글로벌 7 + wikey 4) **ALL PASS**.

## 변경 이력

| version | date | author | 변경 |
|---------|------|--------|------|
| v1.0 | 2026-05-10 | analyst (Claude opus) | 신규. §5.7.8 라이브 비교 (PASS-B 향상 1 / 회귀 2) → vector layer 부재 인지 → §5.7.7 진입. spec/todox 합본 1 file (testing.md §3 mid-sized 패턴 mirror — §5.7.8 / §5.7.9 와 동일). 5 spec / **25 invariant (Inew dimension lock 추가)** / 32 AC / 8 risk / **9 open question (Q1 LOCKED)** / 6 step (A~F) / 11-anchor self-check ALL PASS. **사용자 추가 요구사항 (settings UI 통합 — §5.7.8 Advanced query tuning section 안)** 반영. **master 환경 사전 점검 mirror — embedding dim 768 → 1024 정정, ollama `dengcao/Qwen3-Embedding-0.6B:Q8_0` endpoint 실측 검증, Q1 LOCKED ollama default**. master + 사용자 결정 의뢰 후 v1.1 잠금. |
| v1.1 | 2026-05-10 | master (Claude) | codex Mode D Panel review (5 finding: 3 MED + 2 LOW) → master 직접 fix loop. (1) Spec 1.2 line 129 typo `dim ≠ 768` → `dim ≠ 1024` (`EMBEDDING_DIM`) + 페이지별 fail-open 명시. (2) Spec 1.2 Inputs §5.7.8 expand × hybrid 결합 명세 — vector single embed source = `effectiveQuery` only (multi-queries → BM25 union 만, HyDE → vector 미사용 — v1.2 candidate). (3) Q4 권고 갱신 — embedding source = `${title}\n\n${body}` union (BM25 source mirror, frontmatter 미포함 — PII surface 회피). (4) Spec 1.4 Control 단일화 — toggle 단일 (mode dropdown 제거), Q10 LOCKED. C5 WikeySettings 4 field → **3 field** (`searchHybridEnabled: boolean` + `searchRrfK: number` + `searchQwen3DownloadStatus`). (5) Spec 1.2 Outputs metadata shape — §5.7.8 mirror = SearchResult 직접 field (`bm25Rank?` / `vectorRank?` / `rrfScore?` optional). codex Assessment "architecture approve, v1.1 revision 후 plan APPROVE" 반영. paradigm 정합성 + fail-open + ~1,220 LOC 변경 면 모두 codex confirm. |
| **v1.2** | 2026-05-10 | master (Claude) | **사용자 plan APPROVE — Q2~Q9 7건 일괄 LOCKED**. Q2 (Hybrid default OFF opt-in) / Q3 (RRF k=60 논문) / Q5 (자동 download) / Q6 (progress + cancel YES) / Q7 (cross-language 같은 model 1-pass) / Q8 (`~/.cache/wikey/orama/wikey-wiki.json` 그대로) / Q9 (sub-control of master toggle). frontmatter `status: approved` + 모든 Q LOCKED. **SDD+TDD impl 진입 가능 (Step B RED → C GREEN → D 회귀 → E 라이브 → F codex post-impl)**. 다음 turn = `/compact` 후 impl 진입. |
