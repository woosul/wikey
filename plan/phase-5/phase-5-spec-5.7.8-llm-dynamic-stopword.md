---
phase: 5
section: 5.7.8
title: LLM per-query dynamic stopword paradigm — query intent filter + rewrite + expand + vault customize (Spec)
status: planning
created: 2026-05-10
updated: 2026-05-10
version: v1.2
---

# Phase 5 §5.7.8 LLM per-query dynamic stopword paradigm — query intent filter + rewrite + expand + vault customize (Spec, WHAT)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.7.8`](./phase-5-todo.md) (실행 단일 소스, 체크박스) · [`plan/phase-5/phase-5-todox-5.7.8-llm-dynamic-stopword.md`](./phase-5-todox-5.7.8-llm-dynamic-stopword.md) (Todo, HOW — mirror) · [`plan/phase-5/phase-5-spec-5.7.6-search-quality-tuning.md`](./phase-5-spec-5.7.6-search-quality-tuning.md) v1.2 (선행 ABANDON cycle, paradigm violation 학습 source)
>
> **버전 이력**: 본 v1.2 = 사용자 결정 5건 (Q1~Q5) 잠금 + Out of Scope 9 항목 본 cycle 통합 (§5.7.7 만 별 cycle 유지). v1 / v1.1 history 는 §변경 이력 참조.

## 0. Context

**목적**: §5.7.6 (static stopword) ABANDON 후, wikey 철학 ("LLM 참여형 다층 검색", `wikey.schema.md` §"검색 코어의 안정성") 에 부합하는 query 전처리 paradigm 도입. 정적 단어 list 가 아니라 *query 별 LLM 의미론적 판정* 으로 token keep/drop 결정 + 동의어 치환 (rewrite) + HyDE / multi-query 확장 (expand) + vault 도메인 hint customize. wikey schema §"LLM 참여형 다층 검색" 1단계 ("쿼리 이해·확장 = LLM") 완전 구현.

**이득**:
- 정량 — **70+ query benchmark** (51 → 70+, 의료 10 + 법률 10 추가) Top-1 ≥ 70% / Top-3 ≥ 88% / Mean MRR ≥ 0.85 (현 baseline Top-1 66.7% / Top-3 86.3% / MRR 0.829 대비 향상). PMBOK 도메인 회귀 0 보장 + 의료 / 법률 도메인 cover.
- 정성 — wikey schema §"LLM 참여형 다층 검색" line 374~389 의 "쿼리 이해·확장 = LLM" 단계 *완전* 충족 (filter / rewrite / expand 3단). 기존 BM25-only path 의 generic word saturation 회피 + 동의어 hit 향상 + HyDE 가 vector 검색 가산 가능.
- 도메인 비-특정 — PMBOK / 의료 / 법률 / IT / 학술 / 일반 한국어 모든 도메인 query 대응 (LLM 의미론적 판정 + vault hint 보조).
- 사용자 customize — settings UI (provider override + dropdown) + vault config (`.wikey/query-filter.yaml`) + vault prompt override 로 BYOAI + Yours + File over app 강화.
- CI 자동 회귀 detect — GitHub Actions workflow + PR diff metric 비교.

**Trade-off**:
- query 당 LLM 호출 최대 3회 추가 (filter 1 + rewrite 1 + expand 1). cache hit 시 0 cost — 80%+ hit rate 시 amortized cost 미미. 사용자가 settings UI 에서 각 단계 (filter / rewrite / expand) ON/OFF 독립 제어 가능 (비용/효익 trade-off 사용자 결정).
- LLM unavailable / timeout 시 degrade → original query 그대로 (검색 0 회귀 보장 = fail-open invariant 모든 단계 적용).
- 변경 면 ≤ 14 file (wikey-core ≤ 12 + wikey-obsidian 2) — Karpathy #2 Simplicity 와 표면적 충돌이지만 사용자 명시 "Out of Scope 모두 본 cycle 통합 — 분리하지 말고 자연스러운 흐름" 결정 (2026-05-10 session 33). §5.7.7 (vector embedding hybrid) 만 검색 코어 인프라 영역으로 별 cycle 유지.
- LLM 의 판정 정확도가 prompt + provider 에 의존 — settings UI 에서 filter 전용 LLM provider 별도 지정 가능 (search-time critical path 분리).

**배경**: §5.7.6 static stopword cycle (session 32, commit `932151a` ABANDON) 에서 사용자 raise 인지 — "stopword 일방적 삭제는 위험. 질문 유형에 따라 결정. LLM답지 않음". PMBOK 36% Top-1 회귀가 paradigm 결함 실증 (`프로젝트` / `관리` 일방 drop 시 PMBOK 도메인 marker 손실). 본 §5.7.8 = paradigm 차별점 = tokenizer 는 pure tokenize 유지 (semantic 0), query 단계 LLM 호출 → per-query intent 분석 → 단어별 keep/drop 판정 + 동의어 치환 + HyDE 확장. wikey 철학 = "지능 레이어 LLM 담당" (`wikey.schema.md`).

**사용자 결정 (2026-05-10 session 33)**: "Out of Scope 항목 모두 본 cycle scope 로 통합 (§5.7.7 만 제외). 분리하지 말고 자연스러운 흐름으로 / 작업량 부풀리지 말자." → v1.2 = Spec 5 (rewrite + expand) + Spec 6 (vault customize) 신규 + Spec 2/3/4 본 cycle 통합 항목 흡수. §5.7.7 (vector embedding hybrid) 만 검색 코어 인프라 (도메인 상이) 별 cycle 유지.

## 1. Specs

**목적**: 본 phase 가 다루는 query 전처리 layer 명세 정의 (6 spec 통합).
**이득**: 구현 자유도 보존 + acceptance scenario 1:1 매핑 + LLM dynamic 판정의 수치 검증 가능 + 사용자 customize 명시.
**Trade-off**: 명세 작성 비용 (1~2시간) — 구현 후 sweep cost (`rules/testing.md §5`) 보다 작음.

### 1.1 Spec 1: query intent filter — LLM per-query 단어 keep/drop 판정

**목적**: 사용자 query 의 각 token 을 4 역할 (도메인 marker / intent core / generic noise / disambiguator) 중 하나로 LLM 이 분류하고, generic noise 만 drop 한 filtered query 를 검색 backend 에 전달.
**이득**: 도메인 비-특정 — query 의 도메인이 무엇이든 LLM 이 의미론적 판정 가능 (PMBOK / 의료 / 법률 / IT / 학술 / 소설 등). hardcoded list 0건.
**Trade-off**: LLM 호출 latency 추가 (cache miss 시 ≤ 500ms p95). cache hit 시 0 cost.

- **Goal**: query 한 개 입력 시 LLM 호출 1회로 token 별 역할 판정 + filtered token list 반환. cache hit 시 LLM 호출 생략.
- **Inputs**:
  - `query: string` — 사용자 자연어 질의 (1~10 단어, 한국어 / 영문 / mix 가능, 길이 ≤ 200자).
  - `tokenizer: KoreanTokenizerHandle` — 기존 Kiwi WASM tokenizer (pure tokenize, §5.7.4 채택 그대로).
  - `llm: LLMClient` — settings UI 결정 provider — default = wikey config `WIKEY_BASIC_MODEL` (통상 `gemini-2.5-flash`) / override ON 시 별 provider+model (Q1 LOCKED, §1.4).
  - `cache: QueryIntentCache` — **SQLite-backed cache** (Q2 LOCKED) — `~/.cache/wikey/query-intent-cache.sqlite` (wikey-core 기존 `~/.cache/wikey/` 패턴 mirror, `convert-cache.ts` / `capability-map.ts` 참조). schema = `query_intent_cache (key TEXT PRIMARY KEY, decision_json TEXT, created_at INTEGER, accessed_at INTEGER)` + LRU eviction (default capacity 1,000 entries). plugin / process restart 모두에서 cache 보존.
  - `vaultHint?: VaultQueryHint` — §1.6 vault config 의 도메인 marker hint + 우선 keep token list (옵셔널, 없으면 LLM pure 판정).
- **Outputs**:
  - `filtered: string[]` — drop 결정 token 제외한 token list. 이 list 가 backend 검색 query 로 전달.
  - `decision: FilterDecision` — `{ tokens: TokenDecision[], rawLLMResponse?: string, latencyMs: number, cacheHit: boolean, fallback: 'none' | 'llm-fail' | 'timeout' | 'all-drop-guard' }`.
  - `TokenDecision` = `{ token: string, role: 'domain-marker' | 'intent-core' | 'generic-noise' | 'disambiguator', keep: boolean }` — LLM 판정 결과 그대로 (hardcoded mapping 0).
- **Invariants**:
  - I1 (fail-open): LLM 호출 fail / timeout 시 `filtered = original tokens 전체` (drop 0). `fallback = 'llm-fail' | 'timeout'`. 검색 0 회귀 보장.
  - I2 (cache key normalization): cache key = lowercase + trim + Kiwi tokenize 결과 sorted join — 동일 의미 query 의 cache hit 보장.
  - I3 (no hardcoded role mapping): `role` 결정은 LLM 응답 그대로 — config / source code 안 token → role mapping table 0건.
  - I4 (no hardcoded keep/drop list): 어떤 token 도 source code / config 의 hardcoded set 으로 drop 결정 X — LLM 판정 결과 + vault hint 만.
  - I5 (token preservation): filtered list 의 모든 token 은 input tokens 의 부분집합 (LLM 이 신규 token 생성 X — keep/drop 만).
  - I6 (filter empty guard): LLM 이 모든 token drop 결정 시 → filtered = original tokens 전체 (검색 결과 0 회피, fallback `'all-drop-guard'`). I1 mirror.
- **Acceptance Scenarios**:
  - **Happy (PMBOK)**: query = `"프로젝트 비용 관리"` → LLM 응답: `프로젝트` = `domain-marker` keep / `비용` = `intent-core` keep / `관리` = `intent-core` keep → filtered = `["프로젝트", "비용", "관리"]`.
  - **Happy (의료)**: query = `"당뇨 합병증 예방 가이드"` → `당뇨` = `domain-marker` keep / `합병증` = `intent-core` keep / `예방` = `intent-core` keep / `가이드` = `generic-noise` drop → filtered = `["당뇨", "합병증", "예방"]`.
  - **Happy (법률)**: query = `"민법 제3조 적용 사례"` → `민법` = `domain-marker` keep / `제3조` = `intent-core` keep / `적용` = `intent-core` keep / `사례` = `generic-noise` drop → filtered = `["민법", "제3조", "적용"]`.
  - **Happy (일반 IT)**: query = `"정보 시스템 관리"` → `정보` = `generic-noise` drop / `시스템` = `generic-noise` drop / `관리` = `intent-core` keep → filtered = `["관리"]`.
  - **Edge (vault hint 적용)**: vault config 안 `priorityKeep: ["프로젝트"]` 설정 → query = `"프로젝트 동향"` 에서 `프로젝트` 가 LLM 판정 generic 이어도 hint 로 keep.
  - **Edge (단일 token query)**: query = `"PMBOK"` → 단일 token = `domain-marker` keep → filtered = `["PMBOK"]`.
  - **Edge (영문 mixed query)**: query = `"BM25 알고리즘"` → 모두 `intent-core` keep.
  - **Edge (모든 token drop)**: LLM 잘못 모두 drop → I6 all-drop-guard → original 사용.
  - **Error (LLM timeout)**: LLM 호출 ≥ 5s → AbortController abort → fail-open + `'timeout'` marker.
  - **Error (LLM JSON parse fail)**: invalid JSON → fail-open + `'llm-fail'` marker.
  - **Error (LLM provider unavailable)**: API key 부재 / network fail → fail-open + `'llm-fail'` marker.
- **Out of Scope**: 본 spec 1.1 scope 외 항목은 §1.5 / §1.6 으로 통합 (별 cycle 분리 X, 본 cycle 자연 흐름).
- **Dependencies**:
  - `wikey-core/src/llm-client.ts` (`LLMClient.call(prompt, opts)` API — 실재 확증).
  - `wikey-core/src/search/orama-korean-tokenizer.ts` (`createKoreanTokenizer` / pure tokenize, §5.7.4).
  - `wikey-core/src/types.ts` (`SearchResult`, `LLMCallOptions` 등).
  - **SQLite 라이브러리** (Q2 LOCKED) — wikey-core 기존 SQLite dep 재사용 우선. 부재 시 `better-sqlite3` 신규 dep 추가 (Step A2 fact-check). license 호환 (MIT) 확증 의무.

### 1.2 Spec 2: search path 통합 — Orama backend 의 query 전처리 layer 삽입 + filter 결과 metadata 노출

**목적**: 기존 Orama search 호출 직전에 §1.1 의 query intent filter (+ §1.5 의 rewrite / expand) 를 삽입. backend 변경 0 (Orama / qmd 양쪽 동일 적용). filter / rewrite / expand 결과를 `SearchResult` metadata 로 노출 (사용자 UI 시각화 source).
**이득**: search path 변경 면 최소 (1 file 안 ~10~20 LOC). filter 가 disabled 시 기존 behavior 그대로 (regression 보호). metadata 노출로 사용자가 어떤 token 이 keep/drop 되었는지 UI 시각화 가능 (§1.4 Spec 4).
**Trade-off**: filter 가 search-time critical path 에 추가 — cache miss 시 query latency 증가 (≤ 500ms p95 / rewrite + expand 추가 시 ≤ 1500ms p95). settings toggle 으로 disable 가능.

- **Goal**: `OramaIndexHandle.search(query, opts)` 호출 시 query 전처리 layer (filter + rewrite + expand) 적용 → 최종 query (또는 multi-query) 로 backend 검색 수행 + filter/rewrite/expand decision 을 SearchResult metadata 로 노출.
- **Inputs**:
  - `query: string` — 사용자 raw query.
  - `opts: SearchOpts & { filter?: QueryIntentFilter, rewriter?: QueryRewriter, expander?: QueryExpander }` — 기존 SearchOpts 확장. 모두 옵셔널 — 부재 시 기존 path.
- **Outputs**:
  - `results: readonly SearchResult[]` — 기존 SearchResult shape + optional `filterDecision?: FilterDecision` + `rewriteDecision?: RewriteDecision` + `expandDecision?: ExpandDecision` field (각 옵셔널, layer 적용 시만 채움).
- **Invariants**:
  - I7 (backward compat): filter/rewriter/expander opt 모두 부재 시 기존 search 동작 100% 동일 — 모든 기존 738+ test PASS 보장. 기본 설정 OFF (Q4 LOCKED — opt-in default).
  - I8 (filter optional): 어떤 layer 든 fail 시 search 자체는 진행 (graceful degrade). 검색 0 회귀.
  - I9 (no backend change): Orama backend / Kiwi tokenizer / qmd fallback 변경 0. layer 는 wrapper.
- **Acceptance Scenarios**:
  - **Happy**: search + filter inject → filter 가 `["프로젝트", "비용", "관리"]` 반환 → backend 검색 `"프로젝트 비용 관리"` (rejoin) → SearchResult + `filterDecision` populated.
  - **Happy (3 layer 모두)**: filter + rewriter + expander 모두 inject → 3 layer 순차 적용 → SearchResult + 3 metadata field.
  - **Edge (filter 미주입)**: opts 부재 → 기존 path → metadata field 모두 undefined.
  - **Edge (filter 가 모든 token drop guard)**: I6 동작 → original query 사용 → 검색 결과 정상 + `filterDecision.fallback = 'all-drop-guard'`.
  - **Error (filter throw)**: catch + log + original query fallback + `filterDecision.fallback = 'llm-fail'`.
- **Out of Scope (본 spec 1.2 scope 외)**: 없음 — 본 spec 통합 후 search 통합 spec 의 모든 영역 cover.
- **Dependencies**: `wikey-core/src/search/orama-index.ts` (`OramaIndexHandle.search` line 67~191 실재 확증).

### 1.3 Spec 3: 70+ query benchmark 측정 + per-domain regression 검증 + CI 통합

**목적**: §5.7.6 보존 도구 (51 query) 를 70+ 로 확장 (의료 10 + 법률 10 추가, 도메인 비-특정 paradigm 정량 검증 강화) + paradigm 적용 전후 정량 비교 + GitHub Actions CI workflow 로 자동 회귀 detect.
**이득**: 정량 정당화 + per-domain regression 자동 detect (PMBOK 36% 회귀 같은 paradigm 결함 사전 catch) + PR diff 안 metric 비교로 회귀 PR merge 차단.
**Trade-off**: master 직접 실행 1회 (Step C live smoke) + CI workflow 작성 비용 (~30~50 LOC YAML). benchmark suite 확장 ~20 query 추가 작업.

- **Goal**: 51 query benchmark suite → 70+ 확장 (의료 10 + 법률 10) + filter+rewriter+expander wrapper inject + Top-1 / Top-3 / Mean MRR / per-domain breakdown 측정 + GitHub Actions PR regression alert.
- **Inputs**:
  - `wikey-core/eval/benchmark-suite.json` (확장 51 → 70+, 도메인 추가 `medical` / `legal`).
  - `runBenchmark({ suitePath, searchFn })` — paradigm-neutral injection.
  - `searchFn` = filter+rewriter+expander wrapper.
  - `wikey-core/.github/workflows/benchmark.yml` (신규) — push / PR trigger + npm run benchmark:search + threshold check + comment PR.
- **Outputs**:
  - stdout — `# Total: 71` (71 = 51 + 의료 10 + 법률 10) / `# Top-1: N/71` / `# Top-3: N/71` / `# Mean MRR: 0.XXX` / `# Per domain: ...`.
  - exit code — 0 (pass) / 1 (regression). `WIKEY_BENCHMARK_TOP1_MIN` / `TOP3_MIN` env 임계.
  - 활동 evidence — `activity/phase-5-resultx-5.7.8-llm-dynamic-stopword-<date>.md` 안 baseline vs filter+rewriter+expander applied 비교 표.
  - CI artifact — PR comment 안 baseline vs PR metric 비교 표.
- **Invariants**:
  - I10 (도메인 비-특정 검증): 7 도메인 (`pmbok` / `itil` / `obsidian` / `korean-general` / `english-mixed` / `medical` / `legal`) 모두 Top-1 ≥ 60%.
  - I11 (baseline 대비 향상): aggregate Top-1 ≥ 70% / Top-3 ≥ 88% / MRR ≥ 0.85.
  - I12 (cache hit rate): 71+ query 1회 fresh 후 동일 query 재실행 시 cache hit rate ≥ 80%.
  - I13 (CI regression alert): main branch baseline 대비 Top-1 / Top-3 / MRR drop ≥ 5%p 시 PR fail.
- **Acceptance Scenarios**:
  - **Happy**: filter+rewriter+expander wrapper inject + `npm run benchmark:search` 1회 → Top-1 ≥ 70% + Top-3 ≥ 88% + MRR ≥ 0.85 + 7 도메인 모두 Top-1 ≥ 60% + exit 0.
  - **Edge (cache hit)**: 동일 suite 2회 → 2회차 latency ≤ 1회차의 30%.
  - **Edge (CI PR diff)**: PR 안 변경된 코드가 metric drop 시 GitHub Actions check fail + PR comment.
  - **Error (도메인 회귀)**: 어떤 도메인 Top-1 < 60% → exit 1 + console error → master 회고.
- **Out of Scope (본 spec 1.3 scope 외)**: 없음 — benchmark + CI 모두 본 spec 통합.
- **Dependencies**:
  - `wikey-core/eval/benchmark-suite.json` (보존, 확장 의무).
  - `wikey-core/src/scripts/benchmark-search.ts` (보존, `runBenchmark` export).
  - master 의 fresh `./scripts/reindex.sh` 의무 (의료 / 법률 corpus 가 wiki/ 안 부재 시 — Step A2 fact-check + 사용자 결정. 부재 시 mock corpus 또는 expected_match 만 검증).
  - `.github/workflows/` 디렉토리 생성 (wikey-core 내 또는 repo root, Step A2 fact-check).

### 1.4 Spec 4: Advanced query tuning settings UI 노출 (사용자 customize) + provider/model 2 dropdown + per-query override + advanced section

**목적**: 본 paradigm 이 wikey-obsidian 설정 패널에서 사용자가 ON/OFF + threshold + LLM provider+model + 안내문구 + advanced section + per-query manual override 로 직접 customize 가능. opt-in default (I7 backward compat 보장) + 안내문구로 사용자 학습 보조 + filter 결과 metadata UI 시각화.
**이득**: (a) 사용자 customize — filter 의 비용/효익을 사용자 본인이 trade-off 결정. (b) 안내문구 = wikey schema "Explicit" 원칙 강화. (c) BYOAI — provider+model 2 dropdown 으로 search-time 별도 지정 (Q1 LOCKED). (d) per-query override = "이번 query 는 filter off" UI 토글 또는 query syntax (예: `query !nofilter`) — 사용자가 비용 케이스별 회피 가능. (e) filter 결과 metadata UI = Search result panel 안 keep/drop badge.
**Trade-off**: settings-tab 변경 면 추가 (~80~120 LOC, 5+ control + advanced section + metadata badge) + settings data type 8~10 field 추가. Karpathy Simplicity #2 와 표면적 충돌이지만 사용자 명시 결정 (2026-05-10 session 33) 으로 본 cycle 통합.

- **Goal**: wikey-obsidian settings 패널에 `Advanced query tuning` 섹션 신규 추가. 5+ control + advanced section (temperature / max_tokens) + 안내문구 본문 + per-query override + Search result panel 안 metadata badge.
- **Inputs**:
  - 사용자 settings UI 조작 — toggle / text input / dropdown (`addModelSelector` helper 패턴).
  - `wikey-obsidian/src/main.ts` 의 `WikeySettings` interface (line 42, 실재 확증) — 신규 8~10 field.
- **Outputs**:
  - settings persistence (`.obsidian/plugins/wikey/data.json`) — 신규 8~10 field 저장.
  - runtime 영향 — settings 의 `advancedQueryTuningEnabled true` 시 search 호출 path filter wrap 적용. provider/model override 시 filter 전용 LLMClient 인스턴스.
  - settings 패널 UI — `Advanced query tuning` section.
  - search result panel — keep/drop token badge (filter applied 시).
- **Invariants**:
  - I14 (default OFF): `advancedQueryTuningEnabled` default = `false` — Spec 1.2 I7 backward compat. 기존 사용자 영향 0.
  - I15 (settings persist): 변경 시 `data.json` 갱신 + plugin reload 시 복원.
  - I16 (안내문구 명시): UI description text 가 본 paradigm 의 (a) 무엇을 위한 것인지 (b) 각 옵션 의미 (c) 비용 / 효익 trade-off (d) provider 선택의 의미 명시.
  - I17 (provider 별 격리): provider override active 시 filter 용 LLMClient 만 영향 — 다른 wikey LLM 호출 영역 (canonicalizer / mention extractor / answer generation) 은 `WIKEY_BASIC_MODEL` 그대로.
  - I18 (per-query override): 사용자가 query 입력 시 `!nofilter` syntax 또는 chat 패널 토글 → 해당 query 만 filter off. 다른 query 는 settings 따름.
- **Acceptance Scenarios**:
  - **Happy (default OFF)**: 신규 사용자 설치 → toggle = OFF default 확인. 기존 path 동작.
  - **Happy (toggle ON)**: 사용자가 toggle ON → save → search 호출 시 filter inject + `Advanced query tuning ON` evidence.
  - **Happy (threshold 변경)**: timeout = 3000 / cache size = 500 변경 → save → filter 인스턴스 새 config 반영.
  - **Happy (provider+model 2 dropdown — Q1 LOCKED)**: 사용자가 provider dropdown 으로 `claude` 선택 → model dropdown 이 `addModelSelector` helper 통해 dynamic fetch (line 320~366 mirror) → `claude-haiku-4-5` 선택 → save → filter 호출 시 Claude Haiku 사용. canonicalizer 등 영향 0 (I17). default = `DEFAULT` (model dropdown 안 첫 옵션, line 342, wikey config `WIKEY_BASIC_MODEL` inherit).
  - **Happy (advanced section)**: temperature = 0.0 / max_tokens = 500 default — 사용자 명시 변경 가능. filter 인스턴스가 LLMCallOptions 에 inject.
  - **Happy (per-query override — query syntax)**: 사용자가 chat 패널에서 `!nofilter 프로젝트 비용 관리` 입력 → 해당 query 만 filter skip → 기존 path. 다음 query 는 settings 따름.
  - **Happy (per-query override — UI toggle)**: chat 패널 안 "이번 query filter off" 단축키 / 토글 → 동일 효과.
  - **Happy (metadata UI)**: filter applied search result → result panel 안 query 별 token badge ("프로젝트" keep / "가이드" drop) 시각화.
  - **Edge (안내문구)**: settings UI description text 본문 안에 §1.4 default 권고 (Q5 LOCKED) 명시 — 본 paradigm 설계 의도 + 각 옵션 의미 + 비용/효익 + provider+model 선택 의미.
  - **Edge (provider/model dropdown 후보)**: 기존 `Default Model` / `Ingest Model` 패턴 (line 251~291, 369~) 과 100% 동일 — `renderStandardDropdown` (line 297~317) + `renderModelDropdown` (line 323~366, dynamic fetch).
  - **Error (LLM provider key 부재)**: toggle ON + 선택 provider key 부재 → fail-open (I1) + console warn + settings UI inline error badge.
- **Out of Scope (본 spec 1.4 scope 외)**: 없음 — settings UI 안 모든 customize 영역 (provider override / threshold / advanced / metadata UI / per-query override) 본 spec 통합. filter prompt 본문 사용자 customize 만 §1.6 (vault config) 으로.
- **Dependencies**:
  - `wikey-obsidian/src/settings-tab.ts` (line 70~400, settings UI 패턴 + `renderStandardDropdown` + `renderModelDropdown` + DEFAULT clear-on-provider-change 패턴 line 273/389).
  - `wikey-obsidian/src/main.ts` (line 42 `WikeySettings` interface + line 102 default + line 680 conf merge + line 795 effectiveProvider).
  - `wikey-obsidian/src/sidebar-chat.ts` (chat 패널 — per-query override `!nofilter` syntax + UI toggle + metadata badge 시각화).

**안내문구 본문 (§1.4 default 권고, Q5 LOCKED, master 결정)**:

```
Advanced query tuning (LLM 동적 query 분석)

이 설정은 무엇을 위한 것인가?
- LLM 이 사용자 query 의 각 단어를 의미론적으로 분석하여 (도메인 marker / intent core / generic noise / disambiguator),
  검색에 도움 되지 않는 generic 단어를 query 별로 자동 제거합니다.
- 추가로 동의어 치환 (rewrite) 과 가상 답변 확장 (HyDE) 을 통해 검색 회수를 향상합니다.
- 정적 stopword 목록과 달리 같은 단어라도 query 의 의도에 따라 보존 또는 제거됩니다.

ON/OFF (default OFF)
- ON: 매 search 호출 시 LLM 호출 1~3회 추가 — 검색 품질 향상.
- OFF: 기존 BM25 검색 그대로.

Filter timeout (ms, default 5000)
- LLM 호출 timeout. 초과 시 fail-open — original query 그대로 검색.

Cache size (entries, default 1000)
- SQLite-backed cache (~/.cache/wikey/query-intent-cache.sqlite) — plugin / process restart 모두에서 보존.

Filter LLM provider (default = DEFAULT — wikey 기본 모델 따름)
- BYOAI — 사용자 자유 교체. API key 는 기존 wikey credentials 따름.
- query filter 는 짧은 분류 작업이므로 빠른 / 저렴한 모델 (Haiku / Flash) 적합.

Filter LLM model (provider 별 dynamic 후보)
- 위 provider 의 model list — 별도 API 호출로 fetch (cloudModel / ingestModel 패턴과 동일).

Advanced (temperature / max_tokens)
- temperature default 0.0 (deterministic)
- max_tokens default 500

Per-query override
- chat 패널에서 `!nofilter <query>` 입력 시 해당 query 만 filter skip.
- chat 패널 안 토글로도 가능.

비용 / 효익
- 비용: query 당 LLM token < 600 (filter 200 + rewrite 200 + expand 200) + latency ≤ 1500ms p95 (cache miss). cache hit 시 0 cost.
- 효익: 도메인 query 의 검색 정확도 향상 (Top-1 ≥ 70%, Top-3 ≥ 88%, Mean MRR ≥ 0.85).
```

### 1.5 Spec 5: query rewrite + query 확장 (HyDE / multi-query) — wikey schema 1단계 완전 구현

**목적**: query intent filter (§1.1) 후속 단계 — query rewrite (동의어 치환 — 의미 유지하며 minimal) + query 확장 (HyDE 가상 답변 / multi-query 변형). wikey schema §"LLM 참여형 다층 검색" 1단계 ("쿼리 이해·확장 = LLM") 완전 구현.
**이득**: 검색 회수 향상 — rewrite 가 동의어 hit 보장 (예: `당뇨` → `당뇨병` keep both) / HyDE 가 vector 검색 대안 생성. wikey schema invariant 충족.
**Trade-off**: LLM 호출 1~2 회 추가 (filter 1 + rewrite 1 + HyDE 1, cache hit 시 0 cost). 의미 변경 risk — minimal rewrite 로 false positive 회피 invariant 강제.

- **Goal**: filter 결과 token list 기반 → rewriter (동의어 치환 / 어미 정규화, 의미 유지) + expander (HyDE / multi-query 변형) 적용 → 최종 검색 query (또는 multi-query union) 반환. 각 단계 cache 적용.
- **Inputs**:
  - `filteredTokens: string[]` — §1.1 filter 결과.
  - `llm: LLMClient` — §1.4 settings 결정 (provider+model + temperature + max_tokens).
  - `rewriteCache / expandCache: SQLite-backed cache` — §1.1 mirror.
  - `mode: 'rewrite-only' | 'expand-only' | 'both' | 'off'` — settings UI 결정.
- **Outputs**:
  - `RewriteDecision` = `{ originalQuery: string, rewrittenQuery: string, changes: Array<{ from: string, to: string, reason: string }>, latencyMs: number, cacheHit: boolean, fallback: 'none' | 'llm-fail' | 'timeout' | 'minimal-change' }`.
  - `ExpandDecision` = `{ originalQuery: string, hypotheticalDoc?: string, multiQueries?: string[], latencyMs: number, cacheHit: boolean, fallback: 'none' | 'llm-fail' | 'timeout' }`.
- **Invariants**:
  - I19 (rewrite 의미 보존 — minimal change): rewrite 가 의미 변경 시 keep but minimal — rewriter prompt 안 "의미 유지" 강제 + edit distance ≤ 50% 검증 (token 단위). 위반 시 fallback `'minimal-change'` (original 반환).
  - I20 (expand 부가 — original query 보존): expand 결과는 *추가* (original 대체 X) — multi-query union 으로 검색 → RRF 융합 (Orama hybrid mode 시).
  - I21 (fail-open): rewrite / expand 단계 fail 시 직전 단계 결과 그대로 진행 (filter only / filter+rewrite only). 검색 0 회귀.
  - I22 (cache 별 layer): rewriteCache / expandCache 각 별도 SQLite table (filter cache 와 분리, key drift 방지).
- **Acceptance Scenarios**:
  - **Happy (rewrite)**: filteredTokens = `["당뇨", "합병증", "예방"]` → rewriter → rewritten = `"당뇨병 합병증 예방"` (동의어 `당뇨` → `당뇨병` keep both 형태로 union). changes 1건.
  - **Happy (expand HyDE)**: filteredTokens 동일 → expander → hypotheticalDoc = `"당뇨병 환자의 합병증 예방을 위한 가이드라인..."` (가상 답변 ~50~100자) → vector 검색 가산.
  - **Happy (expand multi-query)**: filteredTokens 동일 → multiQueries = `["당뇨 합병증 예방", "당뇨병 합병증 관리", "당뇨 환자 예방 수칙"]` → union 검색.
  - **Edge (mode='off')**: rewrite + expand 모두 skip → filter 결과만 검색.
  - **Edge (rewrite minimal-change violation)**: LLM 이 의미 크게 바꾼 응답 (edit distance > 50%) → fallback `'minimal-change'` + original 사용.
  - **Error (rewrite timeout)**: 직전 단계 (filter) 결과로 검색 진행 + fallback `'timeout'`.
- **Out of Scope (본 spec 1.5 scope 외)**: rerank (LLM 리랭킹) — wikey schema §"LLM 참여형 다층 검색" 3단계, 별 spec.
- **Dependencies**:
  - `wikey-core/src/search/query-rewriter.ts` (신규).
  - `wikey-core/src/search/query-expander.ts` (신규).
  - `wikey-core/src/prompts/query-rewriter.prompt.md` (신규).
  - `wikey-core/src/prompts/query-expander.prompt.md` (신규).

### 1.6 Spec 6: vault-level customize — `.wikey/query-filter.yaml` + vault prompt override

**목적**: 사용자 vault 의 도메인 hint + prompt override. wikey "Yours" + "File over app" 원칙 강화.
**이득**: 사용자 도메인 (PMBOK / 의료 / 법률 / 학술 등) 별 LLM hint 강화 + vault prompt override 로 사용자 자유. anchor (k) 미위반 — *사용자 명시 hint* 는 paradigm rule 아니라 사용자 input.
**Trade-off**: vault config parser 추가 (~50~80 LOC) + YAML 파싱 dep (`yaml` 또는 `js-yaml`, wikey 기존 사용 dep mirror).

- **Goal**: vault 안 `.wikey/query-filter.yaml` (있으면) 의 도메인 marker hint + 우선 keep token list 를 LLM filter prompt 에 hint 로 inject. + vault 안 `.wikey/prompts/query-intent-filter.prompt.md` (있으면) 가 wikey-core default prompt 우선.
- **Inputs**:
  - `vaultPath: string` — wikey-obsidian plugin 의 vault root.
  - `.wikey/query-filter.yaml` (옵셔널) — 사용자 명시 hint config:
    ```yaml
    domainMarkers:
      - 프로젝트
      - PMBOK
      - 당뇨
    priorityKeep:
      - 핵심 단어
    ```
  - `.wikey/prompts/query-intent-filter.prompt.md` (옵셔널) — vault prompt override.
  - `.wikey/prompts/query-rewriter.prompt.md` (옵셔널).
  - `.wikey/prompts/query-expander.prompt.md` (옵셔널).
- **Outputs**:
  - `vaultHint: VaultQueryHint` = `{ domainMarkers: string[], priorityKeep: string[] }` — 부재 시 empty.
  - `effectivePrompt: string` — vault override 우선, 부재 시 wikey-core default.
- **Invariants**:
  - I23 (사용자 input 정당성): `.wikey/query-filter.yaml` 안 list 는 사용자가 직접 작성한 hint — anchor (k) hardcoded list 아님. analyst.md anchor (k) 본문 mirror — "권장 패턴: LLM 호출 + cache + config = LLM 판정 결과 cache 영역 (사용자 inspection 외)" 에 부합 (사용자 명시 input).
  - I24 (vault config 우선): vault override 있으면 wikey-core default 무시. 없으면 default. 부분 override (예: yaml 만 있고 prompt 없음) 가능.
  - I25 (parse fail = fallback): YAML parse fail / schema invalid → log warn + empty hint + default prompt 진행. 검색 0 회귀.
- **Acceptance Scenarios**:
  - **Happy (yaml hint)**: vault 안 `.wikey/query-filter.yaml` 안 `domainMarkers: [PMBOK]` → query `"PMBOK 비용"` filter 시 prompt 안 hint inject → LLM 이 `PMBOK` keep 우선.
  - **Happy (priority keep)**: yaml 안 `priorityKeep: ["프로젝트"]` → LLM 이 `프로젝트` 를 generic 분류해도 hint 로 keep override.
  - **Happy (prompt override)**: vault 안 `.wikey/prompts/query-intent-filter.prompt.md` 존재 → wikey-core default 무시 + vault prompt 사용.
  - **Edge (yaml 부재)**: vault config 없음 → empty hint + default prompt → §1.1 동작 그대로.
  - **Error (YAML parse fail)**: invalid YAML → log warn + empty hint + default prompt.
- **Out of Scope (본 spec 1.6 scope 외)**: 없음.
- **Dependencies**:
  - `wikey-core/src/config/vault-query-config.ts` (신규).
  - YAML parser dep — wikey-core 기존 dep `yaml` 또는 `js-yaml` 재사용 (Step A2 fact-check, 기존 ingest pipeline / schema parser 안 사용 패턴 mirror).

## 2. Open Questions (모두 LOCKED — 신규 Q6 추가)

**목적**: 사용자 결정 5건 잠금 (v1.2) + 신규 Q6 (의료/법률 도메인 query 결정).
**이득**: spec 승인 후 신규 분기 회피.
**Trade-off**: 해소까지 spec freeze.

- **Q1 LOCKED (2026-05-10 session 33)**: filter 전용 LLM provider+model = **2 dropdown selectbox** (기존 `Default LLM provider` / `Ingest model` / `OCR model` 패턴 100% 동일, line 73 / 320~366 mirror). default = `DEFAULT` (wikey-core `WIKEY_BASIC_MODEL` inherit). provider override toggle 없음 — 항상 dropdown 2개 노출.
- **Q2 LOCKED**: cache 영구 저장 = **SQLite** — `~/.cache/wikey/query-intent-cache.sqlite` (wikey-core 기존 `~/.cache/wikey/` 패턴 mirror). schema = `query_intent_cache (key TEXT PRIMARY KEY, decision_json TEXT, created_at INTEGER, accessed_at INTEGER)` + LRU eviction (default capacity 1,000 entries). plugin/process restart 모두에서 cache 보존. rewrite/expand cache 도 별 table 같은 SQLite 안.
- **Q3 LOCKED**: filter timeout default = **5s** (Gemini-2.5-flash p99 ≈ 3s safety margin).
- **Q4 LOCKED**: filter 적용 = **opt-in** (default OFF — settings UI toggle 사용자가 명시 ON). I7 backward compat 보장.
- **Q5 LOCKED**: 안내문구 final wording = **§1.4 default 권고 본문 잠금** (master 결정). UI control type = toggle (ON/OFF) + text input (timeout, cache size, advanced section 의 temperature / max_tokens) + provider dropdown + model dropdown (`addModelSelector` 패턴) + per-query override (`!nofilter` syntax + chat 패널 토글).
- **Q6 (신규, v1.2 추가)**: 의료 / 법률 도메인 query 20건 결정 — 사용자가 직접 작성 vs analyst 가 wiki/ 안 의료/법률 페이지 부재 시 *expected_match 만* 작성 (mock corpus). analyst v1.2 권고 = **expected_match 만 작성** (실 corpus 부재 사실 명시) + Step A1 안 사용자 final 결정. 별 corpus 추가는 §5.5 (지식 그래프) 범위 — 본 cycle scope 외.

## Acceptance Criteria — 총 18개 (단위 12 + 통합 5 + 라이브 1) — v1.2

> 본 cycle AC 는 §1.1~1.6 invariant 와 직접 연결.

### 단위 AC (RED → GREEN 의무, 12개)

| # | AC | 검증 |
|---|----|------|
| **AC-F1** | `QueryIntentFilter` 클래스 — `filter(query, vaultHint?)` 시그니처. mock LLM 으로 happy / 모든 token keep / 모든 token drop / single token / mixed 영문 / vault hint 6 case PASS. hardcoded role mapping 0건. | wikey-core unit test (`wikey-core/src/__tests__/search/query-intent-filter.test.ts`). |
| **AC-F2** | I1 fail-open — mock LLM throw / timeout (AbortController) / invalid JSON 3 case → fail-open + fallback marker. | unit test, mock LLM. |
| **AC-F3** | I2 cache key normalization + I12 cache hit + SQLite persist — 동일 query 2회 호출 시 2회차 LLM 호출 0회 (mock LLM call counter). lowercase / trim / sorted token join. SQLite file 저장 + reload 후 cache hit. capacity 1000 default + LRU eviction. | unit test + temp dir SQLite file. |
| **AC-F4** | I3 + I4 + I5 + I6 — `role` LLM 응답 그대로 (소스 grep `KOREAN_STOPWORDS` / `STOPWORDS` / `KEEP_LIST` / `Set([...])` 단어 list 0건). LLM 신규 token 생성 시 keep 결과에서 제외. all-drop-guard 동작. | unit test + 소스 grep. |
| **AC-F5** | `OramaIndexHandle.search(query, { filter, rewriter, expander })` 통합 — 3 layer 모두 inject 시 metadata field populated. layer 부재 시 기존 path 100% 동일. | unit test. |
| **AC-F6** (Spec 5) | `QueryRewriter` — minimal change invariant (edit distance ≤ 50%). 동의어 치환 happy + edit distance violation fallback case. | unit test (`query-rewriter.test.ts`). |
| **AC-F7** (Spec 5) | `QueryExpander` — HyDE 응답 길이 (50~200자) + multiQueries 변형 N=3 default + fallback chain (expand fail → rewrite only → filter only → original). | unit test (`query-expander.test.ts`). |
| **AC-F8** (Spec 6) | `VaultQueryConfig` — `.wikey/query-filter.yaml` parse + domainMarkers/priorityKeep field validation + parse fail 시 empty hint + log warn. | unit test (`vault-query-config.test.ts`). |
| **AC-F9** (Spec 6) | vault prompt override — `.wikey/prompts/query-intent-filter.prompt.md` 존재 시 우선 / 부재 시 wikey-core default. 부분 override (yaml only / prompt only) 가능. | unit test. |
| **AC-S1** (Spec 4 settings UI) | `Advanced query tuning` section + 5+ control (toggle / timeout text / cache size text / **provider dropdown + model dropdown 2 control, Q1 LOCKED, `addModelSelector` helper 사용 line 320~366 mirror**) + advanced section (temperature / max_tokens 2 control) + 안내문구 description text 본문 (§1.4 default 권고 mirror). default OFF (I14). settings persist (I15) — 신규 8~10 field. 안내문구 (a)~(d) 명시 (I16). provider override 시 wikey-core 다른 LLM 영역 영향 0 (I17). | wikey-obsidian unit test (`wikey-obsidian/src/__tests__/settings-tab-query-tuning.test.ts`). |
| **AC-S2** (Spec 4 per-query override + metadata UI) | (a) chat 패널 안 `!nofilter <query>` syntax 처리 → 해당 query 만 filter skip (I18). (b) chat 패널 토글 동등 효과. (c) search result panel 안 keep/drop badge 시각화 — `filterDecision` metadata 가 source. | wikey-obsidian unit test (`sidebar-chat-query-override.test.ts`). |
| **AC-S3** (Spec 3 CI) | `.github/workflows/benchmark.yml` 신규 — push / PR trigger + npm run benchmark:search + threshold check + PR comment. baseline drop ≥ 5%p 시 fail (I13). YAML lint PASS. | YAML lint (yamllint or actionlint) + workflow dry-run. |

### 통합 AC (real index + real LLM 또는 stub LLM, 5개)

| # | AC | 검증 |
|---|----|------|
| **AC-I1** | 회귀 보호 — wikey-core 738+ tests / wikey-obsidian 46+ tests / `npm run build` 0 errors / `./scripts/validate-wiki.sh` PASS / `./scripts/check-licenses.sh` PASS / `./scripts/check-kiwi-vendor-sync.sh` PASS. | master 직접 (Step B3 BLUE 3a). |
| **AC-I2** | filter prompt 정합 — `wikey-core/src/prompts/query-intent-filter.prompt.md` (default) + `.wikey/prompts/query-intent-filter.prompt.md` (vault override 가능, Spec 6) 안 prompt 본문 + 응답 schema (JSON: `{tokens: [{token, role, keep}]}`) 명시 + role enum 4. real Gemini 1회 호출 후 valid JSON 응답 받기. | master 직접. |
| **AC-I3** | rewriter+expander prompt 정합 — `query-rewriter.prompt.md` + `query-expander.prompt.md` (default + vault override 가능) 본문 + 응답 schema. real LLM 1회. | master 직접. |
| **AC-I4** | benchmark runner 통합 — `runBenchmark` 의 `searchFn` 으로 filter+rewriter+expander wrapper inject + 기존 `npm run benchmark:search` 호환. 70+ query suite 확장 (의료 10 + 법률 10) — Q6 결정 mirror. | unit test 또는 master 직접. |
| **AC-I5** (Spec 6 vault config) | vault config 통합 — wikey-obsidian 이 vault root 의 `.wikey/query-filter.yaml` 읽기 → wikey-core filter 에 vaultHint 전달 → LLM prompt 에 hint inject. wikey-obsidian + wikey-core 통합 test. | 통합 test (mock vault fs). |

### 라이브 cycle smoke AC (master 직접, 1개)

| # | AC | 검증 |
|---|----|------|
| **AC-L1** | 70+ query benchmark — `./scripts/reindex.sh` (필요 시) → `npm run benchmark:search` 1회 + filter+rewriter+expander applied. 기준: aggregate Top-1 ≥ 70% / Top-3 ≥ 88% / Mean MRR ≥ 0.85 + 7 도메인 모두 Top-1 ≥ 60% (PMBOK + 의료 + 법률 회귀 0). 활동 evidence (`activity/phase-5-resultx-5.7.8-llm-dynamic-stopword-<date>.md`). | master 직접. |

## 3. Risk grid + 완화

**목적**: 본 paradigm 도입의 위험 식별 + AC 매핑.
**이득**: 회피 가능 위험 사전 인지.
**Trade-off**: 일부 risk mitigation 비용 큼.

| # | Risk | Severity | 확률 | 완화 | AC |
|---|------|----------|------|------|-----|
| 1 | LLM 판정 정확도 부족 — Gemini-2.5-flash 의미 분류 fail | HIGH | MED | (a) prompt 안 4 역할 정의 + 5 도메인 example (PMBOK + 의료 + 법률 + IT + 일반) few-shot. (b) 70+ query benchmark per-domain 검증. (c) regression detect 시 prompt 재조정 또는 cycle abandon. | AC-L1, AC-I2 |
| 2 | LLM 호출 latency 누적 — query 당 ≤ 1500ms p95 미달 (filter + rewrite + expand 3 layer) | MED | MED | cache hit rate ≥ 80%. cache miss 시 timeout 5s 각 layer. settings UI 에서 layer 별 disable 가능 (mode='off' / 'rewrite-only' / 'expand-only' / 'both'). | AC-F3, AC-L1 |
| 3 | 도메인 비-특정 paradigm 의 도메인별 prompt 균형 — example 쏠림 risk | HIGH | MED | prompt 안 5 도메인 example + 4 역할 추상 정의. spec §1.1 acceptance scenarios mirror. | AC-L1 |
| 4 | LLM 응답 schema drift — invalid JSON / missing field | MED | MED | I1 fail-open + AC-F2. extractJsonObject (§5.7.5 학습) markdown wrap 처리. | AC-F2 |
| 5 | SQLite cache table 손상 / migration | LOW | LOW | schema migration 0 (v1 schema 단일) + LRU eviction trigger. corruption detect 시 rebuild from scratch. | AC-F3 |
| 6 | filter 가 backend index 재생성 의무 | MED | LOW | filter 는 query path only — index 변경 0. tokenizer 변경 0 → reindex 불필요. master 가 Step A2 안 잠금. | AC-I4 |
| 7 | hardcoded list 잔재 — paradigm violation 재발 risk | HIGH | LOW | spec §self-check + master 1차 grep + AC-F4 sourcecode grep. vault config (Spec 6) 의 사용자 hint 는 hardcoded 아님 (anchor (k) 본문 mirror). | AC-F4, self-check (k) |
| 8 | benchmark suite 도메인 cover 부족 — 의료/법률 corpus 부재 | MED | HIGH (현 wiki/ 안 의료/법률 페이지 0) | (a) Q6 결정 — expected_match 만 작성 (mock corpus, 사용자 final 결정). (b) AC-L1 안 의료/법률 도메인 ≥ 60% 임계 — corpus 부재 시 AC-L1 의료/법률 부분 별 평가 (per-domain breakdown). (c) §5.5 (지식 그래프) 범위에서 corpus 추가. | AC-L1 |
| 9 | rewrite 의미 변경 false positive — 검색 정확도 회귀 | HIGH | MED | I19 minimal change invariant — edit distance ≤ 50% + LLM prompt "의미 유지" 강제. fallback `'minimal-change'` 시 original. | AC-F6, AC-L1 |
| 10 | expand HyDE 응답 길이 폭증 — vector 검색 latency 회귀 | MED | LOW | HyDE 응답 길이 50~200자 cap + max_tokens 500 default. 위반 시 truncate. | AC-F7 |
| 11 | vault config YAML schema drift — 사용자 잘못된 yaml | LOW | MED | I25 parse fail = fallback + log warn. yaml schema validation 추가 (zod 또는 yup, wikey-core 기존 사용 dep mirror). | AC-F8 |
| 12 | settings UI 변경 면 폭증 — Karpathy #2 충돌 | MED | HIGH (8~10 신규 field) | 사용자 명시 결정 (2026-05-10 session 33) — "Out of Scope 모두 본 cycle 통합". I14 default OFF + I7 backward compat 보장 — 기존 사용자 영향 0. | AC-S1, AC-S2 |
| 13 | per-query override syntax 충돌 — `!nofilter` 가 다른 syntax 와 conflict | LOW | LOW | wikey 기존 chat panel syntax grep (Step A4) + `!nofilter` prefix 단순. metadata badge 시각화로 사용자가 적용 여부 확인. | AC-S2 |
| 14 | CI workflow regression alert false positive — flaky LLM | MED | MED | (a) CI 안 stub LLM 사용 (deterministic). (b) drop ≥ 5%p threshold (단일 query 변동 흡수). (c) PR comment 안 per-domain breakdown 포함 — false positive detect 용이. | AC-S3 |

## 4. Out of Scope (별 cycle / 별 phase) — §5.7.7 만 잔존

**목적**: §5.7.8 의 minimal scope 명시 — paradigm 도입 + 사용자 결정 (2026-05-10 session 33) 으로 Out of Scope 9 항목 본 cycle 통합. **§5.7.7 (vector embedding hybrid) 만 검색 코어 인프라 영역으로 별 cycle 유지**.
**이득**: 변경 면 격리 + cycle 종결 시점 명확.
**Trade-off**: 사용자 결정으로 본 cycle 변경 면 ≤ 14 file (Karpathy #2 와 표면적 충돌이지만 사용자 명시).

- **§5.7.7 HYBRID Stage 2 vector reroute** (별 cycle, 검색 코어 인프라 영역) — Qwen3-Embedding 768D 통합 + Orama hybrid mode (RRF 융합). 본 §5.7.8 종결 후 결과 측정 → §5.7.7 진입. orthogonal — §5.7.8 의 filter 결과는 §5.7.7 vector 검색에도 동일 적용 가능.

(이전 v1.1 의 Out of Scope 9 항목 — query rewrite / query 확장 / vault customize / metadata 노출 / metadata UI / per-query override / filter prompt customize / temperature·max_tokens / benchmark 확장 / CI 통합 — 모두 본 cycle scope §1.2~1.6 으로 통합. v1.2 변경 이력 mirror.)

## 5. Dependencies

**목적**: 본 §5.7.8 진입 조건 + 후속 cycle 순서.
**이득**: 진입 의사결정 + 후속 plan 명확.
**Trade-off**: 진입 조건 미충족 시 cycle 보류.

### 5.1 진입 조건 (충족 의무)

- [x] §5.7.6 ABANDON 종결 (Session 32, 2026-05-10, commit `932151a`) — paradigm violation 인지 + revert + 평가 도구 보존.
- [x] §5.7.6 평가 도구 보존 — `wikey-core/eval/benchmark-suite.json` 51 query / `runBenchmark` export / `npm run benchmark:search` script.
- [x] §5.7.6 baseline 측정 보존 — Top-1 66.7% / Top-3 86.3% / Mean MRR 0.829.
- [x] wikey-core LLMClient stable (`call(prompt, opts)` line 14, 실재 확증).
- [x] settings UI 패턴 fact-check — `renderStandardDropdown` (line 297~317) + `renderModelDropdown` (line 323~366, dynamic fetch + DEFAULT 옵션 line 342) + `cloudModel` clear-on-provider-change (line 270~273) 실재 확증.
- [x] `WikeySettings` interface 실재 확증 (`wikey-obsidian/src/main.ts` line 42).
- [ ] **사용자 승인** — 본 spec v1.2 + Q1~Q5 LOCKED 확인 + Q6 (의료/법률 query) Step A1 잠금.

### 5.2 후속 cycle 순서

본 §5.7.8 종결 후 진행 순서:

1. **§5.5 지식 그래프 · 시각화** (P3) — NetworkX + Leiden + vis.js / Obsidian Graph View
2. **§5.6 성능·엔진 확장** (P3) — Ollama vs llama.cpp / rapidocr Linux baseline
3. **§5.7.7 HYBRID Stage 2 vector reroute** — Qwen3-Embedding 768D 통합 + Orama hybrid mode (본 §5.7.8 와 orthogonal — 별 cycle, 검색 코어 인프라)
4. **§5.8 Phase 4 D.0.l 잔여** (P4)
5. **§5.9 Variance diagnostic** (P4)

## 6. Verification plan

**목적**: 본 spec acceptance 검증 단계 명시.
**이득**: todox §3 의 step 분해 source.
**Trade-off**: 단계 작성 비용 — SDD+TDD 강제 효과.

본 spec 의 검증 단계 = todox §3 의 Step A~D mirror:

- **Step A — Spec lock + 환경 fact-check**: 사용자 결정 6건 (Q1~Q6) 잠금 + LLMClient API / orama-index search opts / SQLite dep / settings UI 패턴 / vault config parser / .github/workflows/ 디렉토리 fact-check.
- **Step B — TDD RED → GREEN → BLUE 3a → BLUE 3b**: AC-F1~F9 + AC-S1~S3 단위 test 작성 → FAIL → 14 file 변경 면 구현 → PASS → 회귀 + refactor.
- **Step C — 라이브 cycle smoke**: AC-L1 (70+ query benchmark) master 직접 실행 + per-domain regression detect.
- **Step D — 문서 동기화 + commit**: phase-5-result + resultx + memory + plan-full §5.7 갱신.

각 step Phase 3a (회귀) + 3b (BLUE refactor) 분리 의무.

## 7. Self-check

> analyst 글로벌 7-anchor (rules.md §10) + wikey override anchor (h, i, j, k) + Karpathy 4원칙 cross-check.

### 7.1 글로벌 7-anchor

| # | Anchor | 결과 | 검증 |
|---|--------|------|------|
| (a) | 시그니처 일관성 — `QueryIntentFilter` / `QueryRewriter` / `QueryExpander` / `VaultQueryConfig` / `FilterDecision` / `RewriteDecision` / `ExpandDecision` / `runBenchmark` cross-section 동일 | PASS | grep cross-check |
| (b) | state/data 표 형식 — Spec 6 / AC 18 (단위 12 + 통합 5 + 라이브 1) / Risk 14 / Open Questions 6 (Q1~Q5 LOCKED + Q6 신규) / Out of Scope 1 (§5.7.7 만) count drift 0 | PASS | count 검증 |
| (c) | builder/parser 분기 — fail-open (I1, I21) / cache hit (I2, I22) / all-drop-guard (I6) / filter optional (I7~I9) / vault hint optional (I24) / minimal change (I19) 분기 모두 §1.1~1.6 + AC 명시 | PASS | line-by-line |
| (d) | AC ↔ §1 목표 1:1 매핑 | PASS — Spec 1 → AC-F1~F4 / Spec 2 → AC-F5 / Spec 3 → AC-I4, AC-S3, AC-L1 / Spec 4 → AC-S1, AC-S2 / Spec 5 → AC-F6, AC-F7 / Spec 6 → AC-F8, AC-F9, AC-I5 / 회귀 → AC-I1 / prompt → AC-I2, AC-I3 | line-by-line |
| (e) | self-check 모든 행 drift 없음 (v1.2 작성 직후) | PASS | 본 §7 line read |
| (f) | footer + version + 변경 이력 — frontmatter `version: v1.2` ↔ §변경 이력 마지막 row v1.2 ↔ footer 일관 | PASS | `grep -nE "^version: v1\.2$"` exact match |
| (g) | 코드 ↔ test exact phrase — `QueryIntentFilter` / `QueryRewriter` / `QueryExpander` / `domain-marker` / `intent-core` / `generic-noise` / `disambiguator` / `'llm-fail'` / `'timeout'` / `'all-drop-guard'` / `'minimal-change'` AC 내 일치 | PASS | `grep -F` cross-check |

### 7.2 wikey override anchor (h, i, j, k)

| # | Anchor | 결과 | 검증 |
|---|--------|------|------|
| (h) schema 4 원칙 일치 | (Explicit) filter/rewrite/expand decision LLM 응답 가시화 + metadata UI 시각화 / (Yours) wikey config 통합 LLMClient + SQLite local cache + vault config local file / (File over app) prompt = markdown file (default + vault override) + vault config = YAML / (BYOAI) 2 dropdown selectbox provider+model 자유 (Q1 LOCKED) | PASS | wikey.schema.md cross-check |
| (i) 3계층 경계 준수 | raw / wiki / schema 권한 위반 0. 변경 면 = wikey-core ≤ 12 (`query-intent-filter.ts` 신규 / `query-rewriter.ts` 신규 / `query-expander.ts` 신규 / `query-filter-cache.ts` SQLite 신규 / `vault-query-config.ts` 신규 / `prompts/*.prompt.md` 3 신규 / `orama-index.ts` 변경 / `types.ts` 변경 / `package.json` 변경 / `eval/benchmark-suite.json` 확장 / `.github/workflows/benchmark.yml` 신규) + wikey-obsidian 2 (`settings-tab.ts` 변경 / `main.ts` 변경 / `sidebar-chat.ts` per-query override). raw / wiki / wikey.schema.md 변경 0. | PASS | grep diff 0 |
| (j) 워크플로우 4 일관 | (ingest) tokenizer 변경 0 → 영향 0. (query) schema §"LLM 참여형 다층 검색" 1단계 ("쿼리 이해·확장 = LLM") *완전 충족* (filter / rewrite / expand 3단). (lint / 삭제·수정) 변경 0. | PASS | wikey.schema.md cross-check |
| (k) 하드코딩 금지 (2026-05-10 영구 정책) | spec §3 변경 면 / §3.N sample / AC literal 안 hardcoded set / list / rule **0건**. role enum 4 string literal = LLM 응답 schema 정의 (LLM 자유 판정). cache capacity / timeout / threshold = numeric config (rule 아님). vault config (Spec 6) 의 `domainMarkers` / `priorityKeep` list = *사용자 명시 input* — analyst.md anchor (k) 본문 "권장 패턴: LLM 호출 + cache + config" 부합 (사용자 inspection 영역). 위반 패턴 (`KOREAN_STOPWORDS = Set([...])` / `KNOWN_GENERIC_NOUNS` / rule-based classifier / hardcoded category mapping / hardcoded slug list) 0건. "사용자 결정 의뢰 — list 정확도 평가" 류 항목 0건. | **PASS** | grep `Set\s*\(\s*\[` / `KOREAN_` / `STOPWORDS` / `KEEP_LIST` 0 hit |

### 7.3 Karpathy 4원칙 cross-check

| 원칙 | 결과 |
|------|------|
| #1 Think Before Coding | §5.7.6 ABANDON 학습 mirror. Open Questions Q1~Q5 LOCKED + Q6 신규. 사용자 결정 (2026-05-10 session 33) "Out of Scope 모두 본 cycle 통합" 명시 mirror. |
| #2 Simplicity First | 변경 면 ≤ 14 file (wikey-core ≤ 12 + wikey-obsidian 2) — 사용자 명시 결정 ("분리하지 말고 자연스러운 흐름") 으로 통합. 신규 dep ≤ 2 (`better-sqlite3` + 기존 yaml dep 재사용). §5.7.7 만 별 cycle 유지. |
| #3 Surgical Changes | search path 변경 면 최소 (1 file 안 ~20 LOC opts 추가, I7 backward compat). 기존 738+ test 회귀 0 보장. settings UI 변경 면 격리 (advanced section 새 영역). |
| #4 Goal-Driven Execution | AC 18 모두 정량 (Top-1 ≥ 70% / Top-3 ≥ 88% / MRR ≥ 0.85 / per-domain ≥ 60% / cache hit ≥ 80% / latency p95 ≤ 1500ms / edit distance ≤ 50% / HyDE 50~200자). |

### 7.4 사용자 4 의무사항 mirror

| # | 의무사항 | 본 spec 안 mirror 위치 |
|---|---------|----------------------|
| 2.1 범용 설계 관점 | §1.1 acceptance scenarios — PMBOK + 의료 + 법률 + IT + 일반 5 도메인 happy path. 4 역할 추상 정의. Risk #3 (도메인 균형) 명시. AC-L1 7 도메인 검증. |
| 2.2 §5.7.6 paradigm violation 학습 | §0 Context Trade-off + 배경 — ABANDON 사실 + paradigm 차별점 + wikey 철학 부합. |
| 2.3 anchor (k) 하드코딩 금지 | §7.2 (k) 검증 — hardcoded set / list / rule 0건. role enum 4 literal = LLM 응답 schema. vault config list = 사용자 input (paradigm rule 아님). |
| 2.4 §5.7.7 orthogonal 공존 | §4 Out of Scope — §5.7.7 만 잔존. orthogonal — filter 결과 vector 검색에도 동일 적용. |

## 변경 이력

| 버전 | 일시 | 변경 |
|------|------|------|
| **v1** | 2026-05-10 session 32 (analyst 작성) | 초안 — §5.7.6 ABANDON 직후 신설. paradigm = LLM per-query dynamic filter. 변경 면 = wikey-core 4 file. spec 6요소 (Spec 1~3). AC 9. Risk 8. Open Questions 4. |
| **v1.1** | 2026-05-10 session 32 (사용자 추가 — Advanced query tuning settings UI + LLM provider override) | Spec 4 신규 (settings UI). Q5 추가. AC-S1 추가 (총 AC 10). 변경 면 +wikey-obsidian 2 file. |
| **v1.2** | 2026-05-10 session 33 (사용자 결정 잠금 + Out of Scope 통합) | (a) Q1~Q5 LOCKED — provider+model 2 dropdown selectbox / SQLite cache `~/.cache/wikey/query-intent-cache.sqlite` / 5s timeout / opt-in default / 안내문구 §1.4 잠금. (b) Out of Scope 9 항목 §5.7.7 제외 모두 본 cycle 통합 — Spec 5 신규 (rewrite + expand HyDE/multi-query) + Spec 6 신규 (vault customize `.wikey/query-filter.yaml` + vault prompt override) + §1.2 metadata 노출 흡수 + §1.3 70+ benchmark 확장 (의료 10 + 법률 10) + CI workflow 흡수 + §1.4 advanced section (temperature/max_tokens) + per-query override (`!nofilter` syntax) + metadata UI 시각화 흡수. (c) Q6 신규 (의료/법률 query 결정 — Step A1 사용자 final). (d) AC 10 → 18 (단위 6 → 12 + 통합 3 → 5 + 라이브 1). Risk 8 → 14. 변경 면 ≤ 14 file (wikey-core ≤ 12 + wikey-obsidian 2). 사용자 의도 (2026-05-10 session 33) = "Out of Scope 모두 본 cycle 안 통합 — 별 cycle 분리해서 작업량 부풀리지 말자". §5.7.7 (vector embedding hybrid) 만 별 cycle 유지 — 검색 코어 인프라 영역 (도메인 상이). master fix / codex cycle 미진입 — v1.2 = analyst 재작성 직후 상태. |

---

> **footer (cycle 추적)**: §5.7.8 spec **v1.2** 작성 완료 (analyst, 2026-05-10 session 33). codex Mode D Panel cycle 미진입 (master 1차 검증 후 송부 예정).
>
> Self-check: analyst 글로벌 7-anchor PASS / wikey override (h, i, j, k) PASS / Karpathy 4원칙 PASS / 사용자 4 의무사항 mirror 4/4 / hardcoded list 0건 (vault config 사용자 input + 안내문구 description text + provider/model dropdown 후보 = paradigm rule 아님) / 변경 면 ≤ 14 file (wikey-core ≤ 12 + wikey-obsidian 2) / AC 18 / dep 추가 ≤ 2 (`better-sqlite3` + 기존 yaml 재사용) / Open Questions 6 (Q1~Q5 LOCKED + Q6 신규).
