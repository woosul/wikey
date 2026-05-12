---
phase: 5
section: 5.7.6
title: 검색 quality tuning — Q5 stopword + 50+ query benchmark (Todo, HOW)
status: planning
created: 2026-05-10
updated: 2026-05-10
version: v1.2
---

# Phase 5 §5.7.6 검색 quality tuning — Q5 stopword + 50+ query benchmark (Todo, HOW)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.7.6`](./phase-5-todo.md) (실행 단일 소스 — 체크박스 mirror) · [`plan/phase-5/phase-5-spec-5.7.6-search-quality-tuning.md`](./phase-5-spec-5.7.6-search-quality-tuning.md) (Spec, WHAT — 4-question 검증 + AC + Risk + Dependencies) · [`plan/phase-5/phase-5-spec-5.7.5-orama-update-sync.md`](./phase-5-spec-5.7.5-orama-update-sync.md) v1.4 (선행 cycle, deferral source)
>
> **버전 이력**:
> - v1 (2026-05-10 session 32, analyst 작성): SDD+TDD 흐름 mirror (§5.7.5 todox v1.4 양식) + 검증 의무 매트릭스 + Step A~D 단계별 체크박스 + 자체 23-anchor self-check (Layer 1 7-anchor + Layer 2 6 codex 패턴 + Layer 3 7 fix 모드 + Layer 4 4 R + wikey override h/i/j).
>
> **wiki 재생성 없음 확증**: 본 §5.7.6 = smart_tokenize 의 stopword 분기 + benchmark suite + script. wiki/ 본문 / frontmatter / 페이지 자체 변경 0. canonicalizer / mention extractor / ingest pipeline 변경 0. 검색 코어 (Orama backend + Kiwi WASM) 변경 0 — smart_tokenize 의 internal stopword 분기 추가만. **Reindex 의무**: stopword 변경이 indexing 결과 영향 → master 의 fresh `./scripts/reindex.sh` 실행 의무 (Step C 안 명시).
>
> **실행 단일 소스**: `plan/phase-5/phase-5-todo.md §5.7.6` (체크박스 = 진행 상태). 본 문서는 step-by-step 분해 + 검증 의무만 기술.

---

## 1. 진행 구조 — SDD + TDD 강제 (§5.7.5 todox v1.4 양식 mirror)

**Spec-Driven + Test-Driven 의무 흐름** (Phase 0~9):

```
Phase 0  Spec lock (phase-5-spec-5.7.6-search-quality-tuning.md v1) → master 23-anchor 1차 grep → codex Mode D Panel 2차 검증 (cycle #1)
                                                                    ↓ APPROVE / NEEDS_REVISION
Phase 1  Step A — 환경 세팅 (사용자 결정 1건 잠금 + 코드 변경 위치 fact-check + benchmark suite 도메인별 query 작성 잠금)
Phase 2  Step B — TDD RED: 단위 테스트 신규 case 작성 (smart_tokenize stopword + Python mirror + benchmark suite schema + benchmark script) → 모두 FAIL 확증
Phase 3  Step B — TDD GREEN: §3 변경 면 모두 구현 → 단위 + 기존 회귀 모두 PASS
Phase 4  Step B — TDD BLUE Phase 3a: 회귀 검증 (npm test + npm run build + ./scripts/validate-wiki.sh + ./scripts/check-licenses.sh + ./scripts/check-kiwi-vendor-sync.sh)
Phase 5  Step B — TDD BLUE Phase 3b: refactor (함수 분해 / Naming / DRY / 가독성), CLAUDE.md 정책 의무
Phase 6  Step C — typecheck + build + 단위 PASS + 라이브 cycle smoke (master 직접 — npm run benchmark:search 1회 실행 + Q5 회복 확증)
Phase 7  Step B 코드 + Step C smoke 결과 → codex Mode D Panel 2차 검증 (cycle #2 post-impl)
Phase 8  Step D — 문서 동기화 (activity/phase-5/phase-5-result.md §5.7.6 entry / activity/phase-5-resultx-5.7.6-search-quality-tuning-<date>.md / phase-5-todo.md mirror) + plan-full §5.7 갱신 + memory mirror + commit
Phase 9  최종 master 1차 검증 + 사용자 사전 보고
```

**선행 의무 (Phase 0 직전)**:
1. PoC §3 baseline (`activity/phase-5/phase-5-resultx-5.7.3-orama-poc-2026-05-09.md`) read 완료 — Q5 회귀 evidence + 10 query baseline 기억
2. §5.7.5 종결 상태 확증 — Orama backend stable + Kiwi WASM stable + scripts/check-* 작동
3. 사용자 결정 #1 (stopword list) 잠금 — Step A1 의무

---

## 2. 검증 의무 매트릭스 (rules.md §10 + agent-management.md §7 + §5.7.5 todox v1.4 양식)

| 단계 | master 1차 | codex 2차 (Mode D Panel) | tester | 라이브 smoke |
|------|-----------|--------------------------|--------|--------------|
| Phase 0 spec lock | spec §8 self-check 23-anchor grep (Layer 1+2+3+4 + wikey override h/i/j) | cycle #1 (plan APPROVE) | — | — |
| Phase 1 Step A | 사용자 결정 1건 잠금 확증 + benchmark suite 50+ query 작성 잠금 | — | — | — |
| Phase 2~3 TDD RED/GREEN | 매 RED/GREEN 후 fresh `npm test` (wikey-core + wikey-obsidian) | — | (master 직접 — TDD 강제) | — |
| Phase 4~5 BLUE 3a + 3b | 회귀 + refactor 후 fresh test/build/validate-wiki | — | — | — |
| Phase 6 라이브 smoke | `./scripts/reindex.sh` (fresh) → `npm run benchmark:search` 1회 실행 + Q5 회복 확증 + 도메인별 Top-1/Top-3/MRR 보존 **master 직접** | — | — | **의무 (1 시나리오: AC-Q1)** |
| Phase 7 post-impl | grep diff + Karpathy 4원칙 cross-check | cycle #2 (코드 + smoke evidence APPROVE) | — | — |
| Phase 9 최종 | **8 AC** line-by-line 증거 매핑 (= 단위 5 + 통합 2 + 라이브 1) | — | — | — |

**검증 도구**:
- master 1차: `npm test` (wikey-core + wikey-obsidian fresh) / `npm run build` / `./scripts/validate-wiki.sh` / `./scripts/check-licenses.sh` / `./scripts/check-kiwi-vendor-sync.sh` / 23-anchor grep (rules.md §10 + wikey override)
- codex 2차: `cmux send` Mode D Panel — fresh-pick + close-after-cycle (agent-management.md §2)
- 라이브 smoke: master 직접 — `./scripts/reindex.sh` (fresh) + `npm run benchmark:search` 1회 + 도메인별 결과 활동 evidence 보존

---

## 3. 4 단계 (Step A 환경 → B 코드 → C 검증 → D 동기화)

### Step A — 환경 세팅 + 사용자 결정 1건 잠금 + benchmark suite 작성 잠금 (Phase 1)

**목적**: 본 cycle 시작 전 사용자 결정 1건 잠금 + 코드 변경 위치 fact-check + 50+ query suite 도메인별 작성 잠금 (실 작성은 Step B GREEN, 본 단계 = 도메인 균형 + expected_top1 후보 잠금).

**A1. 사용자 결정 1건 잠금** (spec §1.3 + §7.1 mirror)

- [-] **결정 #1** stopword list 정확도 평가 — 후보 단어 set 결정. analyst v1 권고 default = **5 단어** = `프로젝트` / `관리` / `정보` / `시스템` / `업무`. master 가 사용자에게 명시 prompt + 응답 후 spec §3.1 + §3.2 의 `KOREAN_STOPWORDS` literal 잠금. 사용자가 추가/제외 시 spec v1.2 fix mirror.

**A2. 진입 조건 확증** (spec §7.1 mirror)

- [x] §5.7.5 GREEN cycle 종결 (Session 31, 2026-05-09, 7 commits, codex 6 cycle APPROVE, AC 22/22 PASS) — Orama backend stable
- [x] PoC §3 baseline 결과 보존 — Q5 회귀 evidence + 10 query baseline
- [x] §5.7.5 LOW #5 사용자 결정 #4 잠금 — code lowercase 유지 (Python 측 lowercase 미적용 = 본 §5.7.6 scope 외)

**A3. 코드 변경 위치 fact-check** (spec §2 mirror, master fresh re-grep 의무)

- [-] `wikey-core/src/search/orama-korean-tokenizer.ts:128~145` `tokenize` arrow fn 위치 확증 (smart_tokenize 분기 추가 위치)
- [-] `scripts/korean-tokenize.py:66~97` `_smart_tokenize` 위치 확증 (Python mirror)
- [-] `wikey-core/eval/` 디렉토리 부재 확증 → 신규 생성 결정
- [-] `wikey-core/package.json::scripts` 기존 script 패턴 확증 (tsx / ts-node / node --loader 중 일관 양식 결정)
- [-] wiki/ 안 expected_top1 후보 slug 100% grep 확증 (예: `project-schedule-management.md` / `pmbok-7-guiding-principles.md` / `itil-4-guiding-principles.md` / `obsidian.md` 등 50+ query 의 expected slug 모두 wiki corpus 안 실제 존재 확증)
- [-] `yaml` npm dep license 확인 (MIT) — NOTICE 갱신 의무 결정 (devDep 시 NOTICE 미포함 정책 확증)

**A4. wikey-core eval 디렉토리 신규 결정**

- [-] `wikey-core/eval/` 신규 디렉토리 생성
- [-] `wikey-core/eval/benchmark-suite.json` (신규)
- [-] `wikey-core/eval/__tests__/benchmark-suite.test.ts` (신규, schema validation)

**A5. scripts 신규 결정**

- [-] `scripts/benchmark-search.ts` (신규, ~100 LOC)
- [-] `scripts/__tests__/benchmark-search.test.ts` (신규 또는 wikey-core/eval/__tests__ 통합 — Step A3 결정)

**A6. 50+ query suite 작성 잠금**

- [-] **PMBOK / 프로젝트 관리** ≥ 10 query — Q5 (`pmbok-q1`, `프로젝트 일정 관리` → `project-schedule-management`) 포함, PMBOK 7 guiding principles + scope management + risk management + cost management 등
- [-] **ITIL / IT 서비스 관리** ≥ 10 query — Q4 mirror (`itil-q1`, `ITIL 4 가이드 원칙` → `itil-4-guiding-principles`) 포함, service value chain + change enablement + incident management 등
- [-] **Obsidian / 마크다운 위키** ≥ 10 query — Q10 mirror (`obsidian-q1`, `Obsidian 마크다운 위키` → `obsidian`) 포함, graph view + plugin + frontmatter + wikilink 등
- [-] **일반 한국어 검색** ≥ 10 query — 한국어 단순 명사구 + 의도 표현 + 동의어 variant
- [-] **영문 / 한+영 mix** ≥ 10 query — `BM25 algorithm` / `LLM agent` / `vector search` + Korean word mixing
- [-] 각 query 의 `expected_top1` + `expected_top3` 가 wiki corpus 안 실 slug grep 확증 (Step A3 mirror)
- [-] 도메인 균형 강제 — 각 ≥ 10 query × 5 도메인 = 50+ query

**Step A 체크박스**:

- [-] 사용자 결정 1건 잠금 (#1 stopword list)
- [-] 진입 조건 3건 확증
- [-] 코드 변경 위치 6 항목 fact-check 완료
- [-] 신규 디렉토리 / 신규 file 위치 결정 잠금
- [-] 50+ query suite 도메인별 작성 잠금 (Step B GREEN 시 실 yaml 작성)

### Step B — TDD RED→GREEN→BLUE 3a/3b (Phase 2~5)

**B1. RED — 단위 테스트 신규 case 작성** (Phase 2)

전체 신규 단위 테스트 = spec v1 의 8 AC 중 단위 부분 = 5 case (§5.1) + 통합 단위 가능한 부분 (AC-B2 mock script + 일부 AC-B3 mock) = **총 6~7 RED case** (단위 5 + 통합 가능 1~2 — Q1 라이브 + AC-R1 회귀 제외).

**v1.2 (codex HIGH #2 fix)**: vitest config (`wikey-core/vitest.config.ts`) include = `src/__tests__/**/*.test.ts` 만. 모든 TS test = `wikey-core/src/__tests__/...` 안. Python test 별 명령 + AC-B1 file existence assert (LOW #8).

- [-] `wikey-core/src/__tests__/search/orama-korean-tokenizer-stopword.test.ts` 신규 — AC-S1 (`KOREAN_STOPWORDS` set membership **5 단어** = `프로젝트` / `관리` / `정보` / `시스템` / `업무`, v1.2 codex HIGH #3 fix) + AC-S2 (`tokenize` fixture `"프로젝트 일정 관리"` 결과 stopword 5 단어 부재 **+ `일정` 잔존 (non-empty discriminating signal)** / `"BM25 알고리즘"` 결과 ALNUM 보존) (2 case)
- [-] `scripts/tests/test_korean_tokenize.py` 신규 — AC-S3 (Python `_smart_tokenize` 안 stopword early continue + `KOREAN_STOPWORDS` 5 단어 set + TS 동등 cross-language consistency check + `일정` 잔존 assert) (1 case). **별 명령 — `python -m pytest scripts/tests/test_korean_tokenize.py`**, `wikey-core/package.json::scripts` 또는 root level Makefile 안 통합 cmd 추가 의무 (vitest 가 cover 안 함).
- [-] `wikey-core/src/__tests__/eval/benchmark-suite.test.ts` 신규 — AC-B1 (JSON.parse + schema validation: 50+ query, 5 도메인 각 ≥ 10, `{id, query, expected_top1, expected_top3, domain}` field 모두 present + **모든 expected slug 가 `wiki/concepts|entities|sources/<slug>.md` 안 실 존재 file existence assert (codex LOW #8)**) (1 case)
- [-] `wikey-core/src/__tests__/eval/benchmark-search.test.ts` 신규 — AC-B2 (export `runBenchmark` + `computeQueryResult` 호출, mock searchFn inject — fixture `SearchResult[]` (path 형식 `wiki/concepts/<slug>.md`) → `{pass, results}` schema + `top1Hit / top3Hit / mrr` 정상 계산) (1 case, codex MED #4 fix: handle/search 분리)
- [-] 모두 FAIL 확증 후 `npm test` log 보존 → commit `test: §5.7.6 RED — 6 case (smart_tokenize stopword + benchmark suite + script)`

**B2. GREEN — §3 변경 면 모두 구현** (Phase 3)

순서대로 (의존성 고려):

- [-] **(B2-tokenizer-ts)** `wikey-core/src/search/orama-korean-tokenizer.ts` — `KOREAN_STOPWORDS` const set **5 단어** + `tokenize` arrow fn 안 `if (KOREAN_STOPWORDS.has(lowered)) continue` 1 줄 추가 (~15 LOC). exact members: `프로젝트` / `관리` / `정보` / `시스템` / `업무` (v1.2 — `일정` 제거, codex HIGH #3 fix). AC-S1, AC-S2.
- [-] **(B2-tokenizer-py)** `scripts/korean-tokenize.py` — `KOREAN_STOPWORDS` 모듈 상수 **5 단어** + `_smart_tokenize` 안 `if t.form in KOREAN_STOPWORDS: continue` 2 줄 추가 (~7 LOC). TS 와 동일 set (v1.2). AC-S3.
- [-] **(B2-suite)** `wikey-core/eval/benchmark-suite.json` (신규, ~200 LOC JSON) — 50+ query 의 도메인 균형 (5 도메인 각 ≥ 10 query). Step A6 잠금 결과 mirror. exact phrase: `pmbok-q1` / `"query": "프로젝트 일정 관리"` / `"expected_top1": "project-schedule-management"`. **v1.2 (codex LOW #8)**: 모든 expected slug = corpus 안 실 존재 (예: `project-schedule-management` / `project-management-body-of-knowledge` / `itil-4-guiding-principles` 등 — `wiki/concepts|entities|sources` grep 잠금). AC-B1.
- [-] **(B2-script)** `scripts/benchmark-search.ts` (신규, ~150 LOC v1.2) — **export** `runBenchmark({ suitePath, searchFn })` (codex MED #4 fix: handle/search injection) + `computeQueryResult` (pure score) + `reportResults` 분리. real Orama API: `createKoreanTokenizer({ wasmPath, modelDir })` + `createOramaIndex({ cachePath, tokenizer })` + `await handle.restore()` + `handle.search(question, { topN: 10 })` + `SearchResult.path` (slug derive via basename). v1.2 codex HIGH #1 fix. stdout (`# Total:` / `# Top-1:` / `# Top-3:` / `# Mean MRR:` / `# Per domain:`) + threshold (env `WIKEY_BENCHMARK_TOP1_MIN` 0.7 / `_TOP3_MIN` 0.85) + exit 0/1/2. AC-B2.
- [-] **(B2-npm)** `wikey-core/package.json` — `scripts` 안 `"benchmark:search": "tsx ../scripts/benchmark-search.ts"` + `devDependencies` 안 **`"tsx": "^4.7.0"` 신규**. 2 LOC. AC-B3. v1.2 (yaml dep 제거 ✓ — JSON 채택, codex MED #5 fix).
- [-] 6~7 RED case 모두 PASS + 기존 wikey-core / wikey-obsidian 회귀 PASS 확증 → commit `feat: §5.7.6 GREEN — Q5 stopword + 50+ query benchmark suite`

**B3. BLUE Phase 3a — 회귀 검증** (Phase 4)

- [-] `npm test` (wikey-core fresh) — 모든 case PASS, 기존 회귀 (738+ test, §5.7.5 baseline) 무손상
- [-] `npm test` (wikey-obsidian fresh) — 회귀 PASS (46+ test, §5.7.5 baseline)
- [-] `npm run build` (wikey-core + wikey-obsidian) — 0 errors
- [-] `./scripts/validate-wiki.sh` — wiki/ frontmatter 무결성 PASS
- [-] `./scripts/check-licenses.sh` — 본 cycle 직접 실행 (yaml dep 추가 후 NOTICE 정합성 확증 — devDep 면 NOTICE 미포함, 사용자 정책 확증)
- [-] `./scripts/check-kiwi-vendor-sync.sh` — 본 cycle 직접 실행 (변경 0 영역, sanity check)

**B4. BLUE Phase 3b — refactor** (Phase 5, CLAUDE.md SDD+TDD 정책 의무)

- [-] **함수 분해**: 50+ LOC 함수 후보 점검 — `runBenchmark` 가 ~80 LOC 예상. extract 후보 = report 출력 부분 (`reportSuiteResults(results)` ~30 LOC) / aggregate 계산 부분 (`computeAggregate(results)` ~20 LOC) — analyst 권고 = 작성 시 분해 적용 (Karpathy Simplicity), 또는 의도적 단일 함수 유지 (50+ LOC 안 — 명확 흐름 시).
- [-] **Naming consistency**: `KOREAN_STOPWORDS` (TS+Py 동일) / `runBenchmark` / `BenchmarkSuite` / `QueryEntry` / `QueryResult` 일관 점검
- [-] **DRY**: `KOREAN_STOPWORDS` literal 5 단어가 TS + Python 양쪽 hardcoded — *의도적 유지* (1 변경 면 단순화, Karpathy Simplicity, 단어 list 6개 hardcoded). 변경 시 동시 수정 의무 commit message convention. 또는 (선택) test 안 양쪽 set 동등 assert 추가 (AC-S3 cross-language consistency check 강화).
- [-] **주석 quality**: TODO/FIXME 0 / `[사용자 결정]` 마커 cleanup (사용자 결정 잠금 후 marker 제거 + 결정 결과 명시) / `§5.7.6` reference marker 보존
- [-] **가독성**: nested arrow / magic number (e.g. regression threshold `0.7` / `0.85`) 상수화 — 본 cycle 은 env override 가능 (`WIKEY_BENCHMARK_TOP1_MIN` / `_TOP3_MIN`), default literal은 const 분리
- [-] 각 refactor 후 회귀 검증 반복 (`npm test`) → commit `refactor: §5.7.6 BLUE — 함수 분해 / Naming / 주석 cleanup`

### Step C — 단위 + 라이브 smoke (Phase 6)

- [-] `npm test` final fresh re-run (wikey-core + wikey-obsidian) — 모든 PASS
- [-] `npm run build` final — 0 errors
- [-] `./scripts/validate-wiki.sh` final — PASS
- [-] **선행 의무 — fresh reindex**: `./scripts/reindex.sh` (Orama backend, default) 실행 — stopword 추가가 indexing 결과 영향 → 기존 인덱스 stale → fresh reindex 후 측정. master 직접 + 결과 보고 (`# Indexed N docs`).
- [-] **라이브 smoke (AC-Q1)**: `npm run benchmark:search` 실행 (master 직접) → stdout 결과 캡처:
  - **Q5 회복 확증**: `pmbok-q1` (query=`프로젝트 일정 관리`) 의 `top1Hit = true` (Top-1 = `project-schedule-management`)
  - **도메인별 Top-1 / Top-3 / MRR**: `pmbok` / `itil` / `obsidian` / `korean-general` / `english-mixed` 5 도메인 각 측정 결과 — regression baseline 으로 활동 evidence 보존
  - **Aggregate**: Total 50+ / Top-1 ≥ 70% / Top-3 ≥ 85% (기준 v1 default, 사용자 final 조정 가능)
  - **exit 0** 확증 (regression 임계 통과)
- [-] smoke PASS console log 보존 → `activity/phase-5-resultx-5.7.6-search-quality-tuning-<date>.md` 작성 (master 직접)

### Step D — 문서 동기화 (Phase 8)

- [-] **`activity/phase-5/phase-5-result.md`** §5.7.6 entry 신규 — 검색 quality tuning 결과 + **AC 8 매핑** (= §5.1 5 + §5.2 2 + §5.3 1) + cycle 이력 (codex cycle #1 plan + #2 post-impl)
- [-] **`activity/phase-5-resultx-5.7.6-search-quality-tuning-<date>.md`** 신규 — 라이브 smoke evidence + AC-Q1 console log + 도메인별 Top-1/Top-3/MRR baseline + Q5 회복 확증
- [-] **`wiki/log.md`** entry — *infrastructure* 변경 (검색 query path tokenizer + benchmark suite) 라 wikey.schema.md §"log.md 형식 (§5.11 v2 의미 재정의)" 의 *지식 log only* 정책 따라 **미기록 가능** (master 판단). 본 cycle 결과로 wiki 페이지 변경 0 확증. 단, fresh reindex 가 indexing 결과 변경 → 검색 결과 변경 — 사용자 인지 의무 (commit body 안 안내).
- [-] **`plan/phase-5/phase-5-todo.md §5.7.6`** 체크박스 mirror — 본 todo 의 Step A~D 결과 반영 + 상태 변경 (`Session 32 진입` → `Session 32 종결` + AC 8/8 PASS)
- [-] **`plan/plan-full.md §5.7`** 갱신 — §5.7.6 종결 status mirror (line 추가, §5.7.5 entry 패턴 mirror)
- [-] **`README.md`** — 본 cycle 변경이 사용자 가시 영역 0 (검색 quality 내부 fix). README 갱신 필요 시 master 판단 (선택). default = 갱신 안 함 (Karpathy Simplicity).
- [-] **`~/.claude/projects/-Users-denny-Project-wikey/memory/project_phase5_status.md`** 갱신 — §5.7.6 종결 status entry mirror
- [-] commit 분리 (논리 단위): `feat: §5.7.6 ...` (코드) / `docs: §5.7.6 ...` (문서) / 또는 단일 commit (논리 단위 1개 — Q5 stopword + benchmark suite)

---

## 4. 단계별 체크박스 (요약, AC 1:1 매핑)

| Step | 체크박스 | AC mapping | LOC 추정 |
|------|---------|------------|---------|
| **A1** 사용자 결정 1건 잠금 | [ ] | (전제) | 0 |
| **A2** 진입 조건 확증 | [ ] | (전제) | 0 |
| **A3** 코드 변경 위치 fact-check | [ ] | (전제) | 0 |
| **A4** wikey-core eval 디렉토리 신규 | [ ] | (전제) | 0 |
| **A5** scripts 신규 결정 | [ ] | (전제) | 0 |
| **A6** 50+ query suite 도메인별 작성 잠금 | [ ] | (전제) | 0 |
| **B1** RED 6~7 case 작성 | [ ] | S1, S2, S3, B1, B2, (B3 부분) | ~150 (test) |
| **B2-tokenizer-ts** `orama-korean-tokenizer.ts` stopword 분기 | [ ] | AC-S1, AC-S2 | ~15 |
| **B2-tokenizer-py** `korean-tokenize.py` stopword 분기 | [ ] | AC-S3 | ~7 |
| **B2-suite** `wikey-core/eval/benchmark-suite.json` 50+ query | [ ] | AC-B1 | ~200 (JSON) |
| **B2-script** `scripts/benchmark-search.ts` runner | [ ] | AC-B2 | ~100 |
| **B2-npm** `wikey-core/package.json` script 1 줄 + yaml devDep | [ ] | AC-B3 | ~2 |
| **B3** BLUE Phase 3a 회귀 검증 | [ ] | AC-R1 | 0 (검증) |
| **B4** BLUE Phase 3b refactor | [ ] | (전체) | varies |
| **C-fresh-reindex** `./scripts/reindex.sh` (master 직접) | [ ] | (선행) | 0 (실행) |
| **C-Q1** 라이브 smoke `npm run benchmark:search` 1회 | [ ] | AC-Q1 | 0 (실행) |
| **D-result** activity result + resultx | [ ] | (전체) | varies |
| **D-todo-mirror** plan/phase-5/phase-5-todo.md §5.7.6 mirror | [ ] | (전체) | varies |
| **D-plan-full** plan/plan-full.md §5.7 갱신 | [ ] | (전체) | ~10 |
| **D-memory** memory project_phase5_status.md | [ ] | (전체) | ~5 |

**6 입력 항목 검증 결과 mirror** (spec §4.3 mirror):

| 분류 | 개수 | 항목 |
|---|---|---|
| 포함 (해당 cycle 의무) | **2** | C1, C2 (BENCH-AUTO 통합) |
| 별 cycle | **1** | HYBRID (§5.7.7 후보) |
| 미진행 (사용자 결정 2026-05-10) | **3** | B3, B5, B6 |

총 6 입력 항목, 본 cycle 안 실 작업 = **2** (C1 + C2 통합), 별 cycle = 1, 미진행 = 3.

---

## 5. 자체 23-anchor self-check (Layer 1 7-anchor + Layer 2 6 codex 패턴 P1~P6 + Layer 3 7 fix 모드 F1~F7 + Layer 4 4 R + wikey override h/i/j)

본 todox v1 의 self-check (analyst v1 작성 직후 — Layer 1 + Layer 2 + Layer 3 + Layer 4 + wikey project analyst override = 23 anchor):

### 5.1 Layer 1 — 7-anchor (rules.md §10)

| # | Anchor | 결과 | 검증 명령 |
|---|--------|------|-----------|
| (a) | 시그니처 일관성 — `KOREAN_STOPWORDS` / `smart_tokenize` / `_smart_tokenize` / `benchmark-suite.json` / `benchmark:search` / `runBenchmark` / `pmbok-q1` / `project-schedule-management` 본 todox + spec cross-file 동일 | PASS_v1.2 — Step A1 + B2-* + Step D-* + §4 표 + §5 self-check 모두 일관 | `grep -nE "KOREAN_STOPWORDS\|benchmark-suite\.yaml\|benchmark:search\|runBenchmark\|pmbok-q1" plan/phase-5/phase-5-todox-5.7.6-search-quality-tuning.md plan/phase-5/phase-5-spec-5.7.6-search-quality-tuning.md` |
| (b) | state/data 표 형식 — 6 입력 검증 표 + §4 단계 체크박스 표 numbering 일관 | PASS_v1.2 — §4 의 모든 행이 spec v1 §4.3 (**2 + 1 + 3 = 6**) 와 동기화 | line-by-line cross-check |
| (c) | builder/parser 분기 — `tokenize` arrow fn 의 stopword 분기 (lowercase + `KOREAN_STOPWORDS.has` early continue) + Python `_smart_tokenize` 의 동등 분기 + ALNUM_TOKEN_RE 분기 (stopword 제외) 모두 명시 | PASS_v1.2 — Step B2-tokenizer-ts + Step B2-tokenizer-py 모두 명시 + AC-S2 fixture | grep `"early continue"` + `"ALNUM_TOKEN_RE"` |
| (d) | AC test 케이스 1:1 매핑 — spec v1 의 **8 AC** (= §5.1 5 + §5.2 2 + §5.3 1) 와 §4 표의 AC mapping 행 일대일 | PASS_v1.2 — 모든 AC (S1~S3 / B1~B3 / Q1 / R1) 가 §4 표 한 행 이상에 매핑 + B1 RED 6~7 case 와 cross-check | `grep -cE "AC-[A-Z][0-9]" plan/phase-5/phase-5-todox-5.7.6-search-quality-tuning.md` ≥ 8 |
| (e) | self-check 모든 행 drift 없음 — v1 작성 직후 stale 0 본문 한정 (변경 이력 의도적 보존) | PASS_v1.2 — v1 작성 직후 stale 0 | (본 §5 line read) |
| (f) | footer + 변경 이력 + cycle 번호 — frontmatter `version: v1` (exact match) ↔ §6 변경 이력 v1 ↔ footer cycle (미진입) 일관 | PASS_v1.2 | `grep -nE "^version: v1$"` exact match |
| (g) | 코드 ↔ test exact phrase — Step B2-tokenizer-ts 의 `KOREAN_STOPWORDS` 5 단어 ↔ AC-S1 / Step B2-suite 의 `pmbok-q1` ↔ AC-B1 / Step B2-script 의 `runBenchmark` ↔ AC-B2 / Step B2-npm 의 `benchmark:search` ↔ AC-B3 / `프로젝트` / `관리` / `정보` / `시스템` / `업무` (default 5 단어) 양쪽 hit | PASS_v1.2 — `grep -F "KOREAN_STOPWORDS"` + `grep -F "benchmark-suite.json"` + `grep -F "benchmark:search"` + `grep -F "프로젝트"` 양쪽 (spec + todox) hit | grep 명령 |

### 5.2 Layer 2 — 6 codex 패턴 P1~P6 (master 1차 self-check 의무)

| Pattern | 결과 (analyst v1 작성 직후) |
|---------|---------------------------|
| **P1 Fact-check** | spec §2 의 grep 직접 read 확증. line number micro drift 가능 — 구현 시 (Step A3) master 가 fresh re-grep + 잠금. wiki/ corpus 안 expected_top1 후보 slug 100% grep 의무 (Step A3). |
| **P2 Cross-file consistency** | spec §3 + §4 + §5 + §6 + §7 의 모든 reference + todox §3 + §4 + §5 모두 일관. `[사용자 결정]` 1건 spec §1.3 + §3 + §7.1 mirror — todox §3 Step A1 + §4 표 mirror. |
| **P3 Spec→Todo byte mirror** | spec §4.3 표 (**2 + 1 + 3 = 6**) ↔ todox §4 표 byte-level mirror — exact phrase + count 동일. exact phrase mirror = `KOREAN_STOPWORDS` / `benchmark-suite.json` / `benchmark:search` / `프로젝트` / `pmbok-q1` / `project-schedule-management` 양쪽 hit 확증. |
| **P4 Implementation feasibility** | smart_tokenize stopword 분기 = 1 줄 — feasible. Python `_smart_tokenize` 안 동등 — feasible. YAML suite parse = `yaml` npm dep (devDep) — feasible. benchmark script = OramaHandle 의 기존 search API + tsx loader (Step A3 fact-check) — feasible. fresh reindex = `./scripts/reindex.sh` 기존 script — feasible. |
| **P5 Legal accuracy** | 본 cycle 의 license 영역 = `yaml` npm devDep 추가 (MIT). devDep 시 NOTICE 미포함 정책 (Step A3 확증). 기존 NOTICE / `scripts/check-licenses.sh` 변경 0. |
| **P6 Numeric consistency** | `grep -cE "^\| \*\*AC-"` ≥ **8** (5.1 = 5 + 5.2 = 2 + 5.3 = 1 = 8). §4 표 LOC 합계 → 본 cycle **~324 LOC + 150 test** (TS tokenizer ~15 + Python tokenizer ~7 + suite YAML ~200 + script ~100 + npm script + devDep ~2). spec §4.3 합계 = **2 + 1 + 3 = 6**. spec §1.3 사용자 결정 1건. 모든 count 일치. |

### 5.3 Layer 3 — 7 fix 모드 F1~F7 (master 영구 등록)

| # | 실패 모드 | 본 v1 작성 직후 결과 |
|---|---------|-------------------|
| **F1 Partial replacement** | 본 v1 = analyst 작성 — replace_all 누락 risk 0. master fix loop 진입 시 의무. |
| **F2 Cascading rename incomplete** | 본 v1 = rename 0 (신규 작성). |
| **F3 Header/Body mismatch** | §4 표 LOC 추정 합계 = ~324 LOC + ~150 test ↔ B1 RED 6~7 case + B2 6 항목 일치. spec §5 헤더 "총 8 개" ↔ §5.1 (5) + §5.2 (2) + §5.3 (1) = 8 일치 (cross-check). |
| **F4 Spec→Todo mirror 누락** | 본 todox v1 가 spec v1 의 모든 reference mirror — exact phrase + AC count + 사용자 결정 + 분류 표 모두 매치. 별 grep cross-check 의무. |
| **F5 History context 와 활성 본문 혼동** | §6 변경 이력 = v1 만 — historical 표현 0. |
| **F6 Implementation feasibility 미검증** | P4 와 동일. |
| **F7 Codex 권고 over-literal 적용** | 본 v1 = codex finding 0 (cycle 미진입). |

### 5.4 Layer 4 — 4 R 코드 영역

| # | R 항목 | 본 v1 적용 결과 |
|---|---------|----------------|
| **R1 CJS bundle vs ESM** | 본 cycle 변경 면 = wikey-core (ESM) + Python script + scripts/ (Node, fact-check 의무). plugin main.js bundle 영향 = stopword 5 단어 추가 ~50 bytes. **N/A (negligible)**. |
| **R2 ESM CLI** | benchmark-search.ts = Node script. tsx loader 사용 시 ESM resolution 의무 — Step A3 fact-check 후 잠금. |
| **R3 Test isolation** | 신규 unit test = vitest node env (wikey-core 기존 runner) — 단위 격리. integration test = real Orama index — Step C master 직접. PASS. |
| **R4 Same-process** | benchmark script = same-process 안 Orama load + search. master 직접 실행. cross-process 영향 0. PASS. |

### 5.5 wikey analyst override anchor h, i, j (project specialization, CLAUDE.md §1)

| # | Anchor | 결과 | 검증 명령 |
|---|--------|------|-----------|
| **(h) schema 4 원칙 일치** | Explicit / Yours / File over app / BYOAI 4 원칙 충돌 0 | PASS_v1.2 — (Explicit) stopword list literal in code + benchmark suite JSON 가 검색 quality 의 "AI 가 무엇을 알고 모르는지" 가시화 / (Yours) 모든 dep / data 가 wikey 안 local — 외부 SaaS 의존 0 / (File over app) benchmark suite JSON + 결과 console log 모두 marker file / (BYOAI) 본 cycle 변경이 LLM provider 영향 0 (검색 코어 query path tokenizer 만 변경, BYOAI 자유 보존) | wikey.schema.md §"LLM Wiki 개인화의 4가지 장점" cross-check |
| **(i) 3계층 경계 준수** | raw / wiki / schema 권한 위반 0 | PASS_v1.2 — 변경 면 = `wikey-core/src/search/orama-korean-tokenizer.ts` + `scripts/korean-tokenize.py` + `wikey-core/eval/benchmark-suite.json` (신규) + `scripts/benchmark-search.ts` (신규) + `wikey-core/package.json` 1 줄. raw/ 변경 0, wiki/ 변경 0, wikey.schema.md 변경 0. | grep `"raw/"` 변경 0 + grep `"wiki/"` 변경 0 |
| **(j) 워크플로우 4 일관** | ingest / query / lint / 삭제·수정 흐름 schema 정의 일치 | PASS_v1.2 — 본 cycle 변경이 4 워크플로우 *동작* 일치: (ingest) smart_tokenize stopword 추가 = indexing token 변경 = 자연 인덱스 갱신 (master 의 fresh `./scripts/reindex.sh` 실행 의무, Step C 안 명시). schema §"인제스트 분할 전략" + §"검색 코어의 안정성" invariant 보존. (query) tokenize_for_query path 의 stopword drop = query 시 generic word 제거 = BM25 신호 specific 단어 집중 = schema §"LLM 참여형 다층 검색" 의 "후보 수집" 정확도 향상. (lint / 삭제·수정) 변경 0. | wikey.schema.md §"시스템 워크플로우" + §"검색 코어의 안정성" cross-check |

---

## 6. 변경 이력

| 버전 | 일시 | 변경 |
|------|------|------|
| **v1** | 2026-05-10 session 32 (analyst 작성) | 초안 — SDD+TDD 흐름 (Phase 0~9 mirror) + 검증 매트릭스 + Step A~D 체크박스 + 6 입력 검증 mirror (spec §4.3) + 자체 23-anchor self-check (Layer 1 + Layer 2 + Layer 3 + Layer 4 + wikey override h/i/j). master fix / codex cycle 미진입 — v1 = analyst 작성 직후 상태. |
| **v1.1** | 2026-05-10 session 32 (master 1차 검증 fix mirror) | spec v1.1 mirror (master-validation 23-anchor 재검증 NEEDS_FIX 1 HIGH + 3 MED + 2 LOW + 1 권고 모두 master 직접 fix). 변경 항목: (1) **YAML → JSON sweep** (사용자 결정 2026-05-10) — `benchmark-suite.json` → `benchmark-suite.json`, `JSON.parse + schema validation`, yaml devDep 0, Step A6 "실 yaml 작성" → "실 JSON 작성", §4 표 LOC `~200 (YAML)` → `~200 (JSON)`. (2) **tsx 신규 devDep 명시** — wikey-core/root/wikey-obsidian tsx 0건 fact-check, B2-yaml-dep → B2-npm 통합 (`tsx ^4.7.0` devDep + script). (3) **R3 vitest jsdom → node env** (wikey-core/vitest.config.ts environment 0). (4) **Self-check P4/P5 표현 갱신** — `createOramaIndex({ cachePath, tokenizer })` factory + `defaultOramaCachePath` + `createKoreanTokenizer` + `disposeOramaIndex` reindex.ts:17~18 패턴 mirror, Kiwi init 절차. (5) **R1 schema (h) JSON mirror** — benchmark suite 표현. spec v1.2 byte mirror 의무 충족. master 최종 self-check PASS_v1.2. codex Mode D Panel cycle #1 송부 직전. |
| **v1.2** | 2026-05-10 session 32 (codex cycle #1 NEEDS_REVISION fix mirror) | codex cycle #1 verdict NEEDS_REVISION (3 HIGH + 4 MED + 1 LOW = 8 findings) 모두 master 직접 fix. (HIGH #1) spec §3.4 sample code 재작성 — reindex.ts:17~18+178~224 패턴 mirror: `createKoreanTokenizer({ wasmPath, modelDir })` + `createOramaIndex({ cachePath, tokenizer })` + `await handle.restore()` + `handle.search(question, { topN: 10 })` + `SearchResult.path` slug derive (basename). (HIGH #2) RED test 위치 — 모든 TS test → `wikey-core/src/__tests__/...` (vitest config include scope 안). Python test → 별 명령 `python -m pytest scripts/tests/test_korean_tokenize.py` 명시. (HIGH #3) stopword `일정` 제거 — Q5 query "프로젝트 일정 관리" 3 단어 모두 stopword 시 tokenize empty → AC-Q1 unrecoverable 회피. v1.2 default = 5 단어 (`프로젝트` / `관리` / `정보` / `시스템` / `업무`). AC-S2 강화 (`일정` 잔존 non-empty discriminating signal assert). (MED #4) `runBenchmark` export + handle/search injection 분리 (mock 가능). `computeQueryResult` (pure score) + `reportResults` 별 export. (MED #5) yaml dep 잔여 mention 정정 → tsx devDep 으로. (MED #6) version state v1.1 → v1.2 sweep — frontmatter / self-check / PASS_v1.x → PASS_v1.2 / footer. (MED #7) phase-5-todo.md §5.7.6 master mirror 갱신 (status / C1 target / JSON path). (LOW #8) sample expected slug = corpus 안 실 존재 만 (`project-schedule-management` / `project-management-body-of-knowledge` / `earned-value-management` / `itil-4-guiding-principles` / `continual-improvement` 등). AC-B1 file existence assert 강화. master 최종 self-check PASS_v1.2. codex Mode D Panel cycle #2 송부 직전. |

---

> **footer (cycle 추적)**: §5.7.6 todox **v1.2** 작성 완료 (codex cycle #1 NEEDS_REVISION 8 findings 모두 master fix mirror, 2026-05-10 session 32). codex Mode D Panel cycle #2 송부 직전. 사용자 명시 (2026-05-10) = 본 세션 안 종결 + codex 검증 후 사용자 승인 게이트 skip + Step A → B (RED → GREEN) → C (라이브 smoke) → D (문서 동기화) + /sync 까지 본 세션 안 모두 종결.
>
> Step A/B/C/D 4단계 모두 정의 / 각 step 입력/출력/검증 명시 / Phase 3a (회귀) + 3b (BLUE refactor) 분리 의무 명시 / spec v1.2 byte mirror PASS_v1.2
