---
phase: 5
section: 5.7.8
title: LLM per-query dynamic stopword paradigm — query intent filter + rewrite + expand + vault customize (Todo, HOW)
status: completed
created: 2026-05-10
updated: 2026-05-10
version: v1.4
---

# Phase 5 §5.7.8 LLM per-query dynamic stopword paradigm — query intent filter + rewrite + expand + vault customize (Todo, HOW)

> **상위 문서**: [`docs/planning/phase-5/phase-5-todo.md §5.7.8`](./phase-5-todo.md) (실행 단일 소스 — 체크박스 mirror) · [`docs/planning/phase-5/phase-5-spec-5.7.8-llm-dynamic-stopword.md`](./phase-5-spec-5.7.8-llm-dynamic-stopword.md) v1.4 (Spec, WHAT — 6요소 + AC 20 + Risk 15 + Open Questions 6) · [`docs/planning/phase-5/phase-5-spec-5.7.6-search-quality-tuning.md`](./phase-5-spec-5.7.6-search-quality-tuning.md) v1.2 (선행 ABANDON cycle, paradigm violation 학습 source)
>
> **버전 이력**: 본 v1.4 = spec v1.4 mirror — post-impl codex multi-cycle fix loop (cycle #6 부터 master 직접, 모든 finding closed, session 33~34, 정확 history = §변경 이력 v1.4 row + resultx). §1.2 Spec 2 Out of Scope 추가. cache 옵션 B 채택 (file-based JSON LRU, native dep 0). cursor 정합성 보장 (clearChat reset + loadSettings cap + maybeTriggerAutoExtend defensive + generation counter + monotonic guard + append-time invalidation guard). tsconfig 안 src/__tests__ exclude (test files vitest transpile 분리, production tsc strict 유지). 변경 면 ≤ 20 file. v1.3 = Q6 v1.2 (의료/법률 query 결정) **ABANDON paradigm violation** + auto-extend mechanism 도입. v1 / v1.1 / v1.2 / v1.3 history 는 §변경 이력. (cycle #7~#9 narrative — v1.4 row 안 통합)
>
> **wiki 재생성 없음 확증**: 본 §5.7.8 = wikey-core 안 query 전처리 layer (filter / rewriter / expander / vault config) + Orama search path 의 opts 확장. wiki/ 본문 / frontmatter / 페이지 자체 변경 0. canonicalizer / mention extractor / ingest pipeline 변경 0. 검색 코어 (Orama backend + Kiwi WASM) 변경 0 — 외부 wrapper layer + benchmark suite 확장만. **Reindex 의무 = 없음** (tokenizer 변경 0, indexing path 영향 0). Step A2 fact-check 안 잠금.
>
> **실행 단일 소스**: `docs/planning/phase-5/phase-5-todo.md §5.7.8` (체크박스 = 진행 상태). 본 문서는 step-by-step 분해 + 검증 의무.

---

## 1. 진행 구조 — SDD + TDD 강제

**Spec-Driven + Test-Driven 의무 흐름** (Phase 0~9):

```
Phase 0  Spec lock (phase-5-spec-5.7.8 v1.4) → master 1차 self-check (7-anchor + h/i/j/k) → codex Mode D Panel (cycle #1 plan APPROVE)
Phase 1  Step A — 환경 세팅 (사용자 결정 6건 잠금 Q1~Q6 + 코드 변경 위치 fact-check + cache 전략 (v1.4 옵션 B = file-based JSON LRU, native dep 0) / settings UI 패턴 / .github/workflows/ 디렉토리 결정)
Phase 2  Step B — TDD RED: 단위 test 신규 case 작성 (AC-F1~F9 + AC-S1~S4 + AC-A1 모두) → 모두 FAIL 확증
Phase 3  Step B — TDD GREEN: §3 변경 면 ≤ 20 file 모두 구현 (v1.4) → 단위 + 기존 회귀 모두 PASS
Phase 4  Step B — TDD BLUE Phase 3a: 회귀 검증 (npm test + npm run build + ./scripts/validate-wiki.sh + ./scripts/check-licenses.sh + ./scripts/check-kiwi-vendor-sync.sh)
Phase 5  Step B — TDD BLUE Phase 3b: refactor (함수 분해 / Naming / DRY / 가독성), CLAUDE.md 정책 의무
Phase 6  Step C — 라이브 cycle smoke (master 직접 — npm run benchmark:search 1회 실행 + per-domain regression detect + cache hit rate 측정 — 51 baseline + auto-extend)
Phase 7  Step B 코드 + Step C smoke 결과 → codex Mode D Panel (cycle #2 post-impl)
Phase 8  Step D — 문서 동기화 (activity/phase-5-result + resultx + plan-full §5.7 + memory + commit)
Phase 9  최종 master 1차 검증 + 사용자 사전 보고
```

**선행 의무 (Phase 0 직전)**:
1. §5.7.6 ABANDON evidence read — paradigm violation 학습 mirror
2. §5.7.6 평가 도구 보존 확증 — `wikey-core/eval/benchmark-suite.json` (51 query) + `wikey-core/src/scripts/benchmark-search.ts` (`runBenchmark` export)
3. wikey-core LLMClient API 확인 (`call(prompt, opts)` line 14)
4. settings UI 패턴 확인 (`renderStandardDropdown` line 297~317 + `renderModelDropdown` line 323~366 + DEFAULT clear-on-provider-change line 270~273 + line 386~389)
5. 사용자 결정 6건 (Q1~Q6) 잠금 — Step A1 의무

---

## 2. 검증 의무 매트릭스 (rules.md §10 + agent-management.md §7)

| 단계 | master 1차 | codex 2차 (Mode D Panel) | tester | 라이브 smoke |
|------|-----------|--------------------------|--------|--------------|
| Phase 0 spec lock | spec §7 self-check 7-anchor + h/i/j/k grep | cycle #1 (plan APPROVE) | — | — |
| Phase 1 Step A | 사용자 결정 6건 (Q1~Q6) 잠금 + LLMClient API + orama-index search opts + cache 전략 (v1.4 옵션 B file-based JSON LRU, native dep 0) + settings UI 패턴 + vault config parser + `.github/workflows/` 디렉토리 (repo root) fact-check | — | — | — |
| Phase 2~3 TDD RED/GREEN | 매 RED/GREEN 후 fresh `npm test` (wikey-core + wikey-obsidian) | — | (master 직접) | — |
| Phase 4~5 BLUE 3a + 3b | 회귀 + refactor 후 fresh test/build/validate-wiki/check-licenses/check-kiwi-vendor-sync | — | — | — |
| Phase 6 라이브 smoke | `npm run benchmark:search` 1회 (51 baseline + auto-extend) + auto-extend mechanism + 수동 trigger + cache hit rate **master 직접** | — | — | **의무 (1 시나리오: AC-L1)** |
| Phase 7 post-impl | grep diff + Karpathy 4원칙 cross-check + hardcoded list 0건 grep + CI workflow YAML lint | cycle #2 (코드 + smoke evidence APPROVE) | — | — |
| Phase 9 최종 | **20 AC** line-by-line 증거 매핑 (단위 14 + 통합 5 + 라이브 1) | — | — | — |

**검증 도구**:
- master 1차: `npm test` (wikey-core + wikey-obsidian fresh) / `npm run build` / `./scripts/validate-wiki.sh` / `./scripts/check-licenses.sh` / `./scripts/check-kiwi-vendor-sync.sh` / `actionlint .github/workflows/benchmark.yml` / 7-anchor + h/i/j/k grep
- codex 2차: `cmux send` Mode D Panel — fresh-pick + close-after-cycle (agent-management.md §2)
- 라이브 smoke: master 직접 — `npm run benchmark:search` 1회 + 도메인별 결과 활동 evidence

**hardcoded list 0건 grep 의무 (anchor (k))**:
```
grep -rnE "KOREAN_STOPWORDS|STOPWORDS\s*[=:]|KEEP_LIST|KNOWN_GENERIC|Set\s*\(\s*\[" wikey-core/src/search/query-intent-filter.ts wikey-core/src/search/query-rewriter.ts wikey-core/src/search/query-expander.ts wikey-core/src/search/query-analyzer.ts wikey-core/src/config/vault-query-config.ts wikey-core/src/prompts/query-analyzer.prompt.md
# 결과 = 0 hit (LRU capacity / timeout 같은 numeric config + role enum 4 literal 은 검증 대상 외)
```

---

## 3. 4 단계 (Step A 환경 → B 코드 → C 검증 → D 동기화)

### Step A — 환경 세팅 + 사용자 결정 6건 잠금 + 코드 변경 위치 fact-check (Phase 1)

**목적**: 본 cycle 시작 전 사용자 결정 6건 (Q1~Q6) 잠금 + LLMClient API / orama-index search opts / cache 전략 (v1.4 옵션 B = file-based JSON LRU, native dep 0) / settings UI 패턴 / vault config parser / `.github/workflows/` 디렉토리 결정.

**A1. 사용자 결정 6건 잠금** (spec §2 Open Questions mirror)

- [x] **결정 Q1 LOCKED (2026-05-10 session 33)**: filter 전용 LLM provider+model = **2 dropdown selectbox** (기존 `renderStandardDropdown` line 297~317 + `renderModelDropdown` line 323~366 패턴 100% mirror). default = `DEFAULT` (model dropdown 첫 옵션, line 342, wikey-core `WIKEY_BASIC_MODEL` inherit). provider override toggle 없음 — 항상 dropdown 2개 노출.
- [x] **결정 Q2 LOCKED (v1.4 옵션 B 채택, master 권고 Cycle #1 cache deviation)**: cache 영구 저장 = **file-based JSON LRU** — `~/.cache/wikey/query-intent-cache/<namespace>.json` (filter / rewrite / expand 각 namespace). atomic write (`fs.renameSync` POSIX) + in-memory LRU map (default 1,000 entries per namespace). 신규 native dep 0 (Karpathy #2 + Obsidian electron 호환). plugin/process restart 모두에서 cache 보존. (이전 v1.2 spec literal Q2 = SQLite — 변경 이력 v1.4 row 안 deviation 명시).
- [x] **결정 Q3 LOCKED**: filter timeout default = **5s** (Gemini-2.5-flash p99 ≈ 3s safety margin).
- [x] **결정 Q4 LOCKED**: filter 적용 = **opt-in** (default OFF — settings UI toggle 사용자 명시 ON). I7 backward compat 보장.
- [x] **결정 Q5 LOCKED**: 안내문구 final wording = **§1.4 default 권고 본문 잠금** (master 결정). UI control = toggle (ON/OFF) + text input (timeout, cache size, advanced section temperature/max_tokens) + provider dropdown + model dropdown (`addModelSelector` 패턴) + per-query override (`!nofilter` syntax + chat 패널 토글) + metadata badge.
- [x] **결정 Q6 v1.2 ABANDON (2026-05-10 session 33 사용자 raise)**: 의료/법률 도메인 query 결정 = paradigm violation. 사용자 명시: "의료/법률 등 정해진게 아니라 구축된 wiki 지식에 따라 어떻게 생성될지 모르는 부분. Karpathy 원칙에도 어긋나고."
- [x] **결정 Q6 LOCKED v1.3 (2026-05-10 session 33)**: auto-extend trigger 빈도 = **N=5 default + settings 으로 1~50 조정** (master 권고). 수동 trigger ("Run query analysis" button) 은 즉시 분석 — N 무관.
- [x] **사용자 승인** — 본 spec v1.4 + Q1~Q5 LOCKED + Q6 v1.3 LOCKED 확인. v1.4 추가 = §1.2 Out of Scope (qmd fallback layer = §5.7.7 별 cycle) + 변경 면 ≤ 20 file.

**A2. 진입 조건 + 코드 fact-check** (master fresh grep 의무, 구현 시점 잠금)

- [x] §5.7.6 ABANDON 종결 (commit `932151a`).
- [x] §5.7.6 평가 도구 보존 — `wikey-core/eval/benchmark-suite.json` 51 query (확증 결과: pmbok 11 / itil 10 / obsidian 10 / korean-general 10 / english-mixed 10) + `runBenchmark` export.
- [x] §5.7.6 baseline — Top-1 66.7% / Top-3 86.3% / MRR 0.829.
- [x] wikey-core LLMClient stable — `call(prompt: string, opts?: LLMCallOptions): Promise<string>` (line 14).
- [x] `wikey-core/src/search/orama-index.ts` `OramaIndexHandle.search(query, { topN })` (line 67~191) 시그니처 + `SearchOpts` 정의 위치 line 53 (`readonly topN: number`) 확인.
- [x] **v1.4 cache 전략 결정**: 신규 native dep 0 (옵션 B 채택). `wikey-core/package.json` 변경 없음 — SQLite (`better-sqlite3` 등) 도입 회피. cache = `wikey-core/src/search/query-filter-cache.ts` (file-based JSON LRU + `node:fs` atomic rename).
- [x] `wikey-core/package.json` YAML parser dep (`yaml` 또는 `js-yaml`) 존재 여부 확인 — 기존 사용 dep 재사용 우선.
- [x] `wikey-core/src/prompts/` 디렉토리 — 기존 `ingest_prompt_basic.md` 만 존재. `query-intent-filter.prompt.md` / `query-rewriter.prompt.md` / `query-expander.prompt.md` 3 신규 작성.
- [x] `wikey-core/eval/benchmark-suite.json` 51 baseline 보존 — auto-extend mechanism (Spec 3 I11) 으로 사용자 query+answer 누적 시 자동 append. **의료/법률 query 사전 추가 X** (v1.2 Q6 ABANDON paradigm violation mirror).
- [x] `wikey-core/src/scripts/benchmark-search.ts` `runBenchmark` export + `searchFn` injection 시그니처 보존 확증.
- [x] `.github/workflows/` 디렉토리 위치 결정 — repo root vs wikey-core monorepo. 사용자 final + Step A1 잠금. analyst 권고 = `.github/workflows/benchmark.yml (repo root)` (monorepo subdir CI 패턴).

**A3. wikey-obsidian settings UI 변경 위치 fact-check** (Q5 사용자 결정 mirror)

- [x] `wikey-obsidian/src/settings-tab.ts` `renderStandardDropdown` (line 297~317) + `renderModelDropdown` (line 323~366) 패턴 확증. dynamic fetch + DEFAULT 첫 옵션 (line 342) + (custom) 잔존 옵션 (line 351).
- [x] `wikey-obsidian/src/settings-tab.ts` `Default Model` section (line 251~291) + `Ingest Model` section (line 369~) 의 provider clear-on-change 패턴 (line 270~273 / line 386~389) 확증.
- [x] `wikey-obsidian/src/main.ts` `WikeySettings` interface (line 42) + default (line 102) + conf merge (line 680) + effectiveProvider (line 795) 확증. 신규 8~10 field 추가:
  - `advancedQueryTuningEnabled: boolean` (default false)
  - `advancedQueryTuningTimeoutMs: number` (default 5000)
  - `advancedQueryTuningCacheSize: number` (default 1000)
  - `advancedQueryTuningProvider: string` (default '' = DEFAULT)
  - `advancedQueryTuningModel: string` (default '' = DEFAULT)
  - `advancedQueryTuningTemperature: number` (default 0.0)
  - `advancedQueryTuningMaxTokens: number` (default 500)
  - `advancedQueryTuningMode: 'off' | 'filter-only' | 'filter-rewrite' | 'filter-rewrite-expand'` (default 'filter-only', mode='off' = master switch OFF)
- [x] `wikey-obsidian/src/sidebar-chat.ts` 안 chat input 처리 위치 확인 — `!nofilter` prefix 처리 + per-query override toggle UI 추가 위치 + metadata badge 시각화 위치 결정.

**A4. vault config + prompt override fact-check** (Spec 6)

- [x] `wikey-obsidian/src/main.ts` 안 vault root 접근 패턴 확인 (`this.app.vault.adapter.basePath` 또는 동등) — `.wikey/` 디렉토리 read 가능 여부.
- [x] vault adapter read API 확인 — `vault.adapter.read(path)` / `vault.adapter.exists(path)` 사용 패턴 grep.
- [x] yaml parser dep (`yaml` 또는 `js-yaml`) wikey-obsidian / wikey-core 안 기존 사용 grep — 재사용 우선.

### Step B — TDD RED → GREEN → BLUE (Phase 2~5)

**목적**: AC-F1~F9 + AC-S1~S4 + AC-A1 단위 test 작성 + RED 확증 → §3 변경 면 ≤ 20 file 구현 (v1.4) → GREEN → 회귀 + refactor.

**B1. TDD RED** (Phase 2)

- [x] **AC-F1 RED**: `wikey-core/src/__tests__/search/query-intent-filter.test.ts` 신규 — `QueryIntentFilter.filter(query, vaultHint?)` mock LLM 으로 6 case (PMBOK / 의료 / 법률 / single token / mixed 영문 / vault hint 적용). 모두 FAIL.
- [x] **AC-F2 RED**: 동 file fail-open 3 case (mock LLM throw / timeout / invalid JSON). FAIL.
- [x] **AC-F3 RED**: 동 file JSON cache test (v1.4 옵션 B) — 동일 query 2회 호출 시 mock LLM call counter (2회차 = 0) + temp dir JSON file 저장 (atomic `fs.renameSync` POSIX) + reload 후 cache hit + capacity 1000 + LRU eviction. FAIL.
- [x] **AC-F4 RED**: 동 file invariant test (I3~I6) + 소스 grep self-check (`KOREAN_STOPWORDS` / `STOPWORDS` / `KEEP_LIST` / `Set([...])` 단어 list 0건). FAIL.
- [x] **AC-F5 RED**: `wikey-core/src/__tests__/search/orama-index-filter.test.ts` 신규 — `OramaIndexHandle.search(query, { filter, rewriter, expander })` 통합 + 3 layer 모두 inject 시 metadata field populated + 부재 시 기존 path. FAIL.
- [x] **AC-F6 RED**: `wikey-core/src/__tests__/search/query-rewriter.test.ts` 신규 — minimal change invariant (edit distance ≤ 50%) + happy + violation fallback. FAIL.
- [x] **AC-F7 RED**: `wikey-core/src/__tests__/search/query-expander.test.ts` 신규 — HyDE 길이 (50~200자) + multiQueries N=3 + fallback chain. FAIL.
- [x] **AC-F8 RED**: `wikey-core/src/__tests__/config/vault-query-config.test.ts` 신규 — `.wikey/query-filter.yaml` parse + schema validation + parse fail fallback. FAIL.
- [x] **AC-F9 RED**: 동 file 안 vault prompt override test — vault `.wikey/prompts/*.prompt.md` 존재 시 우선 / 부재 시 default. FAIL.
- [x] **AC-S1 RED**: `wikey-obsidian/src/__tests__/settings-tab-query-tuning.test.ts` 신규 — Advanced query tuning section 신규 + 5+ control 렌더 (provider+model 2 dropdown `renderModelDropdown` 사용 assert) + advanced section + 안내문구 substring + default OFF + persist. FAIL.
- [x] **AC-S2 RED**: `wikey-obsidian/src/__tests__/sidebar-chat-query-override.test.ts` 신규 — `!nofilter` syntax + chat 토글 + metadata badge 시각화. FAIL.
- [x] **AC-S3 RED**: `.github/workflows/benchmark.yml (repo root)` 신규 작성 + `actionlint` 실행 → YAML 문법 PASS + workflow 의 step 시퀀스 (checkout / setup-node / npm ci / npm run benchmark:search / threshold check / PR comment) 명시. (RED = workflow file 부재 상태에서 actionlint fail.)
- [x] **AC-S4 RED** (v1.3 신규): `wikey-obsidian/src/__tests__/run-query-analysis-command.test.ts` 신규 — "Run query analysis" command 호출 → mock query-analyzer.analyze 호출 + Notice "X queries analyzed, Y added" + suite 갱신 evidence + fail-open (analyzer fail 시 silent skip + console warn). FAIL.
- [x] **AC-A1 RED** (v1.3 신규): `wikey-core/src/__tests__/search/query-analyzer.test.ts` 신규 — `QueryAnalyzer.analyze(queryAnswerPairs)` mock LLM 으로 N건 input → benchmark suite N entry append (`{id, query, expected_top1, expected_top3, domain (LLM 자율), source: 'auto-extended', created_at}`) + 기존 `expected_top1`/`expected_top3` schema 호환 (extra field ignore on runner) + hardcoded domain list 0건 grep + fail-open: throw / timeout / invalid JSON → suite append 0 + log warn (I11). FAIL.
- [x] **fresh 실행 evidence**: `npm test --prefix wikey-core` + `npm test --prefix wikey-obsidian` 실행 후 신규 test 모두 FAIL + 기존 738+ test PASS 확증.

**B2. TDD GREEN** (Phase 3)

변경 면 ≤ 20 file (v1.4: wikey-core 16 / wikey-obsidian 3 / repo root 1):

- [x] **§3.1 구현 — wikey-core 신규 src file 6** (filter / rewriter / expander / cache / vault-config + query-analyzer v1.3):
  - `wikey-core/src/search/query-intent-filter.ts` — `QueryIntentFilter` class + `FilterDecision` / `TokenDecision` types + LLMClient injection + AbortController timeout + extractJsonObject parse + vault hint inject.
  - `wikey-core/src/search/query-rewriter.ts` — `QueryRewriter` class + `RewriteDecision` + minimal change invariant (edit distance ≤ 50%).
  - `wikey-core/src/search/query-expander.ts` — `QueryExpander` class + `ExpandDecision` + HyDE / multi-query.
  - `wikey-core/src/search/query-filter-cache.ts` — file-based JSON LRU cache (v1.4 옵션 B): namespace 별 file (`<root>/<namespace>.json`) + atomic write (`fs.renameSync` POSIX) + in-memory LRU map. 신규 native dep 0.
  - `wikey-core/src/search/query-analyzer.ts` (v1.3 신규) — `QueryAnalyzer.analyze(queryAnswerPairs)` — LLM 호출 + suite append + fail-open + cache.
  - `wikey-core/src/config/vault-query-config.ts` — `.wikey/query-filter.yaml` parser + `VaultQueryHint` type + prompt override path resolver.

- [x] **§3.2 구현 — wikey-core prompt 신규 file 4** (filter + rewriter + expander + query-analyzer v1.3):
  - `wikey-core/src/prompts/query-intent-filter.prompt.md` — 4 역할 정의 + 다양한 도메인 example (LLM judgment 보조용 — hardcoded list 아님 명시) + 응답 schema + vault hint inject 슬롯 + "도메인 자체 LLM 자율 분류" 명시.
  - `wikey-core/src/prompts/query-rewriter.prompt.md` — 동의어 치환 + 의미 유지 invariant + edit distance constraint + 응답 schema.
  - `wikey-core/src/prompts/query-expander.prompt.md` — HyDE 가상 답변 (50~200자) + multi-query 변형 N=3 + 응답 schema.
  - `wikey-core/src/prompts/query-analyzer.prompt.md` (v1.3 신규) — query+answer → benchmark suite entry 변환 prompt (domain LLM 자율 분류, hardcoded list 0).

- [x] **§3.3 구현 — wikey-core 변경 file 3**:
  - `wikey-core/src/search/orama-index.ts` — `SearchOpts` 안 `filter?: QueryIntentFilter` / `rewriter?: QueryRewriter` / `expander?: QueryExpander` field 추가 + `search` 메서드 안 3 layer wrapper (~20 LOC, fail-open + token rejoin + multi-query union) + `SearchResult` 안 `filterDecision?` / `rewriteDecision?` / `expandDecision?` optional field.
  - `wikey-core/src/types.ts` — `QueryIntentFilter` / `QueryRewriter` / `QueryExpander` interface export + `FilterDecision` / `RewriteDecision` / `ExpandDecision` type export + `VaultQueryHint` type.
  - `wikey-core/package.json` — 변경 없음 (v1.4 옵션 B 채택 — 신규 native dep 0, SQLite 도입 회피). yaml parser 도 재사용 안 함 — vault-query-config 안 minimal regex parser 로 충분.

- [x] **§3.4 구현 — wikey-core eval 확장**:
  - `wikey-core/eval/benchmark-suite.json` 51 baseline 보존 — auto-extend 가 런타임에 자동 append (테스트 시점에는 51, 실 사용 누적 시 늘어남).

- [x] **§3.5 구현 — wikey-core CI workflow 신규**:
  - `.github/workflows/benchmark.yml (repo root)` — push / PR trigger + `actions/checkout@v4` + `actions/setup-node@v4` + `npm ci` + `npm run benchmark:search` + threshold check (Top-1 / Top-3 / MRR 임계 + per-domain breakdown 사후 evidence (사전 임계 X) 검사) + baseline drop ≥ 5%p 시 fail + PR comment (per-domain breakdown 포함).

- [x] **§3.6 구현 — wikey-obsidian settings UI 변경**:
  - `wikey-obsidian/src/settings-tab.ts` — `renderAdvancedQueryTuningSection` private method 신규 (~80~120 LOC):
    - **toggle**: `Advanced query tuning ON/OFF` (default OFF, opt-in / I7 backward compat).
    - **mode dropdown**: `Mode` (off / filter-only / filter-rewrite / filter-rewrite-expand).
    - **text input**: `Filter timeout (ms)` (default 5000).
    - **text input**: `Cache size (entries)` (default 1000).
    - **provider dropdown** (Q1 LOCKED): `Filter LLM provider` — `renderStandardDropdown` 사용, line 254~278 mirror, default = `DEFAULT`.
    - **model dropdown** (Q1 LOCKED): `Filter LLM model` — `renderModelDropdown` 사용, line 280~290 mirror, dynamic fetch.
    - **advanced section text inputs**: `Temperature` (default 0.0) + `Max tokens` (default 500).
    - **안내문구 (description text)**: §1.4 default 권고 본문 mirror (Q5 LOCKED) — paradigm 의도 + 각 옵션 의미 + provider 선택 의미 + 비용/효익.
    - provider/model clear-on-change 패턴 mirror (line 270~273 / line 386~389) — provider 변경 시 model 초기화.

- [x] **§3.7 구현 — wikey-obsidian main + sidebar 변경**:
  - `wikey-obsidian/src/main.ts` — `WikeySettings` interface 8~10 field 추가 (Step A3 mirror) + default (line 102) + conf merge (line 680) + plugin search 호출 path 안 `advancedQueryTuningEnabled true` 시 filter+rewriter+expander wrapper 적용 (mode 결정 따름) + provider override active 시 filter 전용 LLMClient 인스턴스 별도 생성 (I17 mirror — 다른 wikey LLM 호출 영역 격리) + vault config loader inject (`.wikey/query-filter.yaml` + `.wikey/prompts/*.prompt.md` read).
  - `wikey-obsidian/src/sidebar-chat.ts` — `!nofilter` prefix syntax 처리 (해당 query 만 filter skip) + chat 패널 안 per-query override toggle 추가 + search result panel 안 `filterDecision` / `rewriteDecision` / `expandDecision` metadata 시각화 (token keep/drop badge).

- [x] **fresh 실행 evidence**: `npm test --prefix wikey-core` + `npm test --prefix wikey-obsidian` 모두 PASS + 신규 test 모두 GREEN.

**B3. BLUE Phase 3a — 회귀 검증** (Phase 4)

- [x] `npm test --prefix wikey-core` (738+ tests) PASS — exit 0
- [x] `npm test --prefix wikey-obsidian` (46+ tests) PASS — exit 0
- [x] `npm run build --prefix wikey-core` 0 errors
- [x] `npm run build --prefix wikey-obsidian` 0 errors
- [x] `./scripts/validate-wiki.sh` PASS
- [x] `./scripts/check-licenses.sh` PASS (v1.4 옵션 B — 신규 dep 0 → NOTICE 변경 없음).
- [x] `./scripts/check-kiwi-vendor-sync.sh` PASS (Kiwi 영역 변경 0)
- [x] `actionlint .github/workflows/benchmark.yml (repo root)` PASS (YAML lint).
- [x] **AC-I5 (vault config 통합 test)**: `wikey-obsidian/src/__tests__/vault-query-config-integration.test.ts` (또는 동등) — mock vault fs 안 `.wikey/query-filter.yaml` + `.wikey/prompts/query-intent-filter.prompt.md` 배치 → wikey-core filter 호출 시 vaultHint 전달 + LLM prompt 안 hint inject 확증. PASS.

**B4. BLUE Phase 3b — Refactor** (Phase 5)

- [x] **함수 분해**: `QueryIntentFilter.filter` / `QueryRewriter.rewrite` / `QueryExpander.expand` 가 50+ LOC 면 sub fn 분리 (cache lookup / LLM call / parse / merge / fallback 분기).
- [x] **Naming**: `filter` / `rewrite` / `expand` / `decision` / `keep` / `role` 일관 — clarity 우선.
- [x] **DRY**: extractJsonObject 호출 패턴 + cache layer 패턴 — `query-filter-cache.ts` 안 generic LRU class 로 통일 (filter / rewrite / expand 모두 사용). YAML parse + schema validation 패턴 — vault-query-config.ts 안 helper extract.
- [x] **주석 quality**: TODO/FIXME 0, prompt schema link, fail-open invariant 명시, edit distance constraint 명시.
- [x] **가독성**: nested arrow / magic number 제거 (timeout / cache capacity / edit distance threshold / HyDE 길이 cap 모두 named const).
- [x] **회귀 재검증**: B3 모든 PASS 재실행.

### Step C — 라이브 cycle smoke (Phase 6)

**목적**: AC-L1 (51 baseline + auto-extend evidence) master 직접 실행 + cache hit rate 측정 + auto-extend mechanism 동작 + 수동 trigger 동작.

- [x] **Pre-check**: 사용자 결정 Q1~Q5 LOCKED + Q6 v1.3 (N=5) 잠금 확증 + LLM provider key 존재 (`~/.config/wikey/credentials.json` `geminiApiKey` 길이만, Read 금지) + `wikey-core/eval/benchmark-suite.json` 51 baseline 보존.
- [x] **fresh reindex 의무 여부**: tokenizer 변경 0 → reindex 불필요 가설. master 가 Step A2 fact-check 결과 잠금.
- [x] **AC-I2 real LLM prompt 검증**: real Gemini-2.5-flash 1회 호출 (filter prompt) → valid JSON 응답 (`{tokens: [{token, role, keep}]}`) + role enum 4 검증 + evidence 보존 (`docs/sessions/phase-5/phase-5-resultx-5.7.8-...` 안 raw 응답 1 sample).
- [x] **AC-I3 rewriter+expander real LLM 검증**: real Gemini 1회 호출 each (rewriter / expander prompt) → valid JSON 응답 + edit distance ≤ 50% (rewriter) / HyDE 50~200자 + multiQueries N=3 (expander) + evidence 보존.
- [x] **첫 실행 (cold cache)**: `cd wikey-core && npm run benchmark:search` 1회 실행 + filter+rewriter+expander applied (searchFn = 3 layer wrap). 결과 console log:
  - aggregate Top-1 ≥ 70%
  - aggregate Top-3 ≥ 88%
  - aggregate Mean MRR ≥ 0.85
  - PMBOK 도메인 회귀 0 (§5.7.6 36% 회귀 회피) — per-domain breakdown 사후 evidence (사전 임계 list X, domain LLM 자율 분류)
  - **auto-extend evidence**: 사용자 query 5건 누적 후 background batch 분석 → suite N entry append (LLM 자율 분류 domain field, source `'auto-extended'`)
  - **수동 trigger evidence**: "Run query analysis" command 호출 → 즉시 batch + Notice + suite 갱신
- [x] **2회차 실행 (warm cache)**: 동 command 즉시 재실행 + latency 비교 (cache hit rate ≥ 80% — JSON file persist 확증, v1.4 옵션 B).
- [x] **회귀 detect 시 분기**: 어떤 도메인 Top-1 < 60% → exit 1 + console error → master 회고 (prompt 재조정 시도 OR cycle abandon → 사용자 보고).
- [x] **활동 evidence 보존**: `docs/sessions/phase-5/phase-5-resultx-5.7.8-llm-dynamic-stopword-2026-05-10.md` 신규 — baseline (Top-1 66.7% / Top-3 86.3% / MRR 0.829) vs 3 layer applied 비교 표 + per-domain breakdown (LLM 자율 분류 결과) + cache hit rate + LLM 호출 latency (filter / rewrite / expand 별).

### Step D — 문서 동기화 (Phase 8)

**목적**: result + resultx + memory + plan-full §5.7 갱신 + commit.

**D1. activity 문서**

- [x] `docs/sessions/phase-5/phase-5-result.md` §5.7.8 entry 신규 — Step A~C 결과 요약 + AC 20 line-by-line 증거 매핑 + Karpathy 4원칙 cross-check.
- [x] `docs/sessions/phase-5/phase-5-resultx-5.7.8-llm-dynamic-stopword-2026-05-10.md` 신규 — Step C live smoke 상세 (baseline vs 3 layer 비교 + per-domain + cache hit rate + LLM 호출 latency 분포).

**D2. plan 문서**

- [x] `docs/planning/phase-5/phase-5-todo.md` §5.7.8 entry 신규 — 본 todox v1.4 mirror (체크박스 = 진행 상태) + tag 추가 (`#search`, `#quality-tuning`, `#llm-dynamic-stopword`, `#orama`, `#paradigm-correction`, `#vault-customize`, `#ci-integration`).
- [x] `docs/planning/plan-full.md` §5.7 row 갱신 — §5.7.8 ⬜ → ✅ + AC 20 PASS evidence.

**D3. memory 문서**

- [x] `~/.claude/projects/-Users-denny-Project-wikey/memory/MEMORY.md` `Phase 5 Scope` entry 갱신 — §5.7.8 종결 mirror.
- [x] `~/.claude/projects/-Users-denny-Project-wikey/memory/project_phase5_status.md` 갱신 — Phase 5 잔여 = §5.5 / §5.6 / §5.7.7 / §5.8 / §5.9 (§5.7.8 종결).

**D4. commit + push**

- [x] git add wikey-core 신규 6 src file (filter/rewriter/expander/cache/vault-config + query-analyzer v1.3) + 신규 4 prompt file (filter+rewriter+expander+query-analyzer) + 변경 3 file (orama-index/types/package.json) + eval 변경 1 (benchmark-suite.json baseline 보존) + repo root .github/workflows/benchmark.yml 신규 + wikey-obsidian 3 (settings-tab + main + sidebar-chat) + plan + activity + memory
- [x] commit message: `feat(§5.7.8): LLM per-query dynamic stopword paradigm — query intent filter + rewrite + expand + vault customize + Advanced query tuning settings + CI workflow (AC 20 PASS)`
- [x] push

---

## 4. Self-check (analyst 글로벌 7-anchor + wikey override h/i/j/k)

### 4.1 글로벌 7-anchor (rules.md §10)

| # | Anchor | 결과 | 검증 |
|---|--------|------|------|
| (a) | 시그니처 일관성 — `QueryIntentFilter` / `QueryRewriter` / `QueryExpander` / `VaultQueryConfig` / `FilterDecision` / `RewriteDecision` / `ExpandDecision` / `runBenchmark` cross-step 동일 | PASS | grep cross-check |
| (b) | state/data 표 형식 — Step A 6건 (Q1~Q5 LOCKED + Q6 v1.3) / Step B 4 phase / 변경 면 ≤ 20 file (v1.4: wikey-core 16 + wikey-obsidian 3 + repo root 1) / AC 20 (단위 14 + 통합 5 + 라이브 1) / Risk 15 count drift 0 | PASS | count 검증 |
| (c) | builder/parser 분기 — fail-open / cache hit / all-drop-guard / filter optional / vault hint optional / minimal change 모두 Step B 명시 | PASS | line-by-line |
| (d) | AC ↔ Step 1:1 매핑 | PASS — AC-F1~F9 → Step B1+B2 / AC-S1~S4 → Step B1+B2 / AC-A1 → Step B1+B2 / AC-I1 → Step B3 / AC-I2~I5 → Step B3+C / AC-L1 → Step C | line-by-line |
| (e) | self-check 모든 행 drift 없음 (v1.4 post-impl Cycle #6 fix 직후) | PASS | 본 §4 line read |
| (f) | footer + version + 변경 이력 — frontmatter `version: v1.4` ↔ §변경 이력 마지막 row v1.4 ↔ footer 일관 | PASS | `grep -nE "^version: v1\.4$"` |
| (g) | 코드 ↔ test exact phrase — `QueryIntentFilter` / `QueryRewriter` / `QueryExpander` / `domain-marker` / `intent-core` / `generic-noise` / `disambiguator` / `'llm-fail'` / `'timeout'` / `'all-drop-guard'` / `'minimal-change'` 일치 | PASS | `grep -F` cross-check |

### 4.2 wikey override anchor (h, i, j, k)

| # | Anchor | 결과 | 검증 |
|---|--------|------|------|
| (h) schema 4 원칙 일치 | (Explicit) 3 layer decision LLM 응답 가시화 + metadata UI 시각화 / (Yours) wikey config 통합 LLMClient + file-based JSON local cache (v1.4 옵션 B) + vault config local file / (File over app) prompt = markdown file (default + vault override) + vault config = YAML + cache = JSON file / (BYOAI) provider+model 2 dropdown 자유 (Q1 LOCKED) | PASS | wikey.schema.md cross-check |
| (i) 3계층 경계 준수 | raw / wiki / schema 권한 위반 0. 변경 면 = wikey-core 16 (v1.4: 신규 7 src incl. `llm-json-utils.ts` + 신규 4 prompt + 변경 4 incl. `query-pipeline.ts` + `benchmark-search.ts` + eval 1) + wikey-obsidian 3 (settings-tab + main + sidebar-chat) + repo root 1 (.github/workflows/benchmark.yml) = ≤ 20 file. raw / wiki / wikey.schema.md 변경 0. | PASS | grep diff 0 |
| (j) 워크플로우 4 일관 | (ingest) tokenizer 변경 0 → 영향 0. (query) schema §"LLM 참여형 다층 검색" 1단계 *완전 충족* (filter / rewrite / expand 3단). (lint / 삭제·수정) 변경 0. | PASS | wikey.schema.md cross-check |
| (k) 하드코딩 금지 (2026-05-10 영구 정책) | Step B GREEN 안 hardcoded set / list / rule **0건** 강제. 4 역할 enum (`domain-marker` / `intent-core` / `generic-noise` / `disambiguator`) = LLM 응답 schema 정의 (LLM 자유 판정). cache capacity / timeout / threshold = numeric config. vault config (Spec 6) 의 `domainMarkers` / `priorityKeep` list = *사용자 명시 input* (paradigm rule 아님, anchor (k) 본문 부합). 안내문구 description text = 사용자 readable (paradigm rule 아님). 위반 패턴 (`KOREAN_STOPWORDS = Set([...])` / `KNOWN_GENERIC_NOUNS` / hardcoded category mapping / hardcoded slug list) 0건. "사용자 결정 의뢰 — list 정확도 평가" 류 항목 0건. | **PASS** — Step B GREEN 변경 면 단어 list / set 0건 의무. master 1차 grep `Set\s*\(\s*\[` 0 hit 검증 (`query-intent-filter.ts` / `query-rewriter.ts` / `query-expander.ts` / `query-analyzer.ts` / `vault-query-config.ts` / `prompts/query-analyzer.prompt.md`). | grep self-check |

### 4.3 사용자 4 의무사항 mirror

| # | 의무사항 | 본 todox 안 mirror 위치 |
|---|---------|----------------------|
| 2.1 범용 설계 관점 | Step B2 §3.2 prompt 구현 (다양한 도메인 example (PMBOK + 의료 + 법률 + IT + 일반 — LLM judgment 보조용, hardcoded list 아님)) + Step C 안 51 baseline + auto-extend evidence + LLM 자율 domain 분류 (도메인 비-특정 paradigm 보장). |
| 2.2 §5.7.6 paradigm violation 학습 | Phase 0 선행 의무 #1 (ABANDON evidence read) + Step C 안 PMBOK 회귀 0 보장 + auto-extend mechanism evidence. |
| 2.3 anchor (k) 하드코딩 금지 | Step B GREEN hardcoded 0건 강제 + master 1차 grep 의무 + AC-F4 source grep self-check + vault config 사용자 input 영역 명시. |
| 2.4 §5.7.7 orthogonal 공존 | spec §4 Out of Scope mirror — §5.7.7 만 잔존 (검색 코어 인프라 영역). 본 §5.7.8 종결 후 결과 측정 → §5.7.7 진입 결정. |

## 5. 변경 이력

| 버전 | 일시 | 변경 |
|------|------|------|
| **v1** | 2026-05-10 session 32 (analyst 작성) | 초안 — SDD+TDD 흐름 mirror + 검증 의무 매트릭스 + Step A~D. AC 9. 사용자 결정 4건 (Q1~Q4). |
| **v1.1** | 2026-05-10 session 32 (사용자 추가 — Advanced query tuning settings UI + LLM provider override) | spec v1.1 mirror — Q5 추가 + Step A4 + Step B2 §3.5/§3.6. AC-S1 (총 AC 10). 변경 면 ≤ 7 file. |
| **v1.2** | 2026-05-10 session 33 (사용자 결정 잠금 + Out of Scope 통합) | spec v1.2 mirror. (a) Q1~Q5 LOCKED. (b) Out of Scope 9 항목 §5.7.7 제외 모두 본 cycle 통합 — Spec 5/6 신규. (c) Q6 신규 (의료/법률 query 결정). (d) AC 10 → 18. Risk 8 → 14. (e) 변경 면 ≤ 18 file. §5.7.7 만 별 cycle 유지. |
| **v1.3** | 2026-05-10 session 33 (사용자 raise paradigm violation — master fix → codex Cycle #1~#6 fix loop → APPROVE_WITH_NOTES) | spec v1.3 mirror. (a) Q6 v1.2 ABANDON — 도메인 fixed list = anchor (k) 위반. (b) §1.3 paradigm shift = 51 baseline + auto-extend mechanism. (c) Q6 v1.3 LOCKED N=5. (d) `query-analyzer.ts` + `query-analyzer.prompt.md` + "run-query-analysis" command 신규. (e) AC 18 → 20. (f) 변경 면 ≤ 18 file. (g) Risk #8 ABANDON + 신규 #15. (h) anchor (k) 강화. **codex Cycle #1~#5 NEEDS_REVISION → master C1~C5 fix loop** (점진 수렴: C1 v1.2 잔재 sweep + 변경 면 정확 카운트 + AC-S4/A1 매핑 + schema 호환 + CI root + P1~P6/F1~F7 표 / C2 AC-A1 schema expected_top1+top3 + wikey-obsidian 2→3 + D4 commit + AC-I2/I3/I5 명시 + grep query-analyzer / C3 expected_top3 필수 + §3.1/§3.2 본문 6+4 + invariant 번호 충돌 해소 + activity 경로 + 표 통합 / C4 query-analyzer.ts §3.1 위치 + invariant stale ref + footer / C5 AC-F3 I13 + Risk #11 I27 + self-check (c) 정확 list). **codex Cycle #6 APPROVE_WITH_NOTES** — 모든 cycle finding closed, 잔존 LOW (본 row cycle-tracking stale) sweep 완료. plan APPROVE 시점. SDD+TDD 진입 준비. |
| **v1.4** | 2026-05-10 session 33~34 (post-impl codex Cycle #1~#13 NEEDS_REVISION → master Cycle #1~#13 fix loop, 38 finding closed) | spec v1.4 mirror — §1.2 Spec 2 Out of Scope 추가 (qmd fallback layer = 별 cycle) + cache 옵션 B 채택 (file-based JSON LRU, native dep 0, SQLite 도입 회피). **codex Cycle #1 (4 HIGH + 3 MED) → master Cycle #1 fix**: F1 DEFAULT provider/model = `resolveProvider('default', config)` inherit / F2 manual "Run query analysis" default suite = vault-local `<vault>/.wikey/auto-extended-suite.json` / F3 auto-extend N=5 trigger / F4 CI workflow threshold split + `runBenchmark` MRR gate / F5 metadata badges / F6 §1.2 Out of Scope / F7 I22 raw question union 보존. 변경 면 ≤ 20 file. **codex Cycle #2 (1 HIGH + 2 MED) → master Cycle #2 fix**: F1 cursor durability + flush / F2 `buildFilterCallOptionsFromSettings` pure helper / F3 spec/todox v1.4 stale ref sweep. **codex Cycle #3 (2 HIGH + 1 MED) → master Cycle #3 fix**: F1 append outcome race — `Promise<RunQueryAnalysisResult>` per-call return; plugin-global field 폐기. F2 cursor 누수 — `collectChatPairs(fromIndex)` + `runQueryAnalysis(suitePath, fromIndex)` 인자 확장. F3 SQLite stale ref sweep. **codex Cycle #4 (1 HIGH + 1 MED) → master Cycle #4 fix**: F1 cursor stale after chat reset/reload — clearChat reset + loadSettings cap + maybeTriggerAutoExtend defensive recovery. F2 spec line 89 active stale sweep. **codex Cycle #5 (1 HIGH) → master Cycle #5 fix**: F1 (a) generation counter — `autoExtendGeneration` field bumped at dispatch + at `clearChat()`; success path drops late completion when generation drifted. F1 (b) monotonic guard — cursor write guarded by `snapshotLength > currentCursor`; overlapping runs cannot regress. F1 (c) Layer 3 보강 — cleared-state stranded cursor (`cursor !== 0 && history.length === 0`) reset 추가. **codex Cycle #6 (1 HIGH + 1 MED) → master Cycle #6 fix (master 직접)**: F1 append-time invalidation guard — `runQueryAnalysis(suitePath?, fromIndex?, generationToken?)` optional 3rd 인자 `GenerationToken`. analyzer 결과 *후* + suite append + Notice *직전* generation match check → mismatch 시 `{fallback: 'invalidated', appendOutcome: 'skipped'}` 반환 + vault file untouched + Notice skipped. (이전 cycle #5 generation guard 가 cursor 만 보호, suite mutation + Notice leak 차단 미흡 catch.) manual triggers 는 token 미전달 → 기존 동작 유지. F2 monotonic guard test branch 보강 — 별 it() block 명시 generation MATCH + plugin.settings.advancedQueryTuningLastAnalyzedIndex pre-set + snapshot ≤ cursor → monotonic branch 직접 hit. 추가 "snapshot > cursor → advance" 시나리오로 over-block 회피 검증. **master-validation skill 26-anchor cross-check 명시 적용 (cycle #6 부터, 사용자 raise 시정)**. |

> **footer (cycle 추적)**: §5.7.8 todox **v1.4 종결** (post-impl codex Cycle #1~#13 NEEDS_REVISION → master Cycle #1~#13 fix loop, 38 finding closed, 2026-05-10 session 33~34). v1.3 plan APPROVE → SDD+TDD impl → Cycle #1 (4H+3M) → #2 (1H+2M) → #3 (2H+1M) → #4 (1H+1M) → #5 (1H) → #6 (1H+1M) → #7 (1H+1M) → #8 (1M) → #9 (1M) → #10 (1H AC-L1) → #11 (1H+2M) → #12 (2H+4M) → #13 (3H+2M) → 모든 finding closed. master-validation skill 26-anchor cross-check 명시 적용 (cycle #6 부터, 사용자 raise 시정).
>
> Self-check: analyst 글로벌 7-anchor PASS / wikey override (h, i, j, k) PASS / Karpathy 4원칙 PASS / 사용자 4 의무사항 mirror 4/4 / hardcoded list 0건 (Step B GREEN 의무, vault config 사용자 input 영역 명시) / 변경 면 ≤ 20 file (v1.4: wikey-core 16 / wikey-obsidian 3 / repo root 1) / AC 20 / dep 추가 0 (옵션 B 채택 — file-based JSON LRU cache, SQLite 무의존).
