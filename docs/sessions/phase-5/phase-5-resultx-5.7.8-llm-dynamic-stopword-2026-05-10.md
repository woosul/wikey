---
phase: 5
section: 5.7.8
title: §5.7.8 post-impl multi-cycle + AC-L1 baseline evidence (final, 종결)
created: 2026-05-10
updated: 2026-05-10
---

# §5.7.8 LLM per-query dynamic stopword paradigm — post-impl evidence

> **상위 문서**: [`docs/planning/phase-5/phase-5-spec-5.7.8-llm-dynamic-stopword.md`](../../docs/planning/phase-5/phase-5-spec-5.7.8-llm-dynamic-stopword.md) v1.4 · [`docs/planning/phase-5/phase-5-todox-5.7.8-llm-dynamic-stopword.md`](../../docs/planning/phase-5/phase-5-todox-5.7.8-llm-dynamic-stopword.md) v1.4

## AC-L1 baseline 회귀 측정 (master 직접, 2026-05-10)

```
$ WIKEY_BENCHMARK_TOP1_MIN=0.6 WIKEY_BENCHMARK_TOP3_MIN=0.85 WIKEY_BENCHMARK_MRR_MIN=0.80 npm run benchmark:search

# Total: 51 queries
# Top-1: 34/51 (66.7%)
# Top-3: 44/51 (86.3%)
# Mean MRR: 0.829
# Per domain:
#   pmbok:           11 q / Top-1  4 / Top-3  8
#   itil:            10 q / Top-1  6 / Top-3  8
#   obsidian:        10 q / Top-1  9 / Top-3 10
#   korean-general:  10 q / Top-1 10 / Top-3 10
#   english-mixed:   10 q / Top-1  5 / Top-3  8
exit 0
```

**§5.7.6 baseline 와 byte-equal**: Top-1 66.7% / Top-3 86.3% / MRR 0.829 동일. 회귀 0 확증 (filter OFF, opt-in default I7 backward compat).

## AC-L1 augmented path 코드 구현 (Cycle #10 master 직접)

**`wikey-core/src/scripts/benchmark-search.ts`**:
- `class NodeHttpClient implements HttpClient` — Node native fetch wrapper
- `buildLayerStack(httpClient, config)` — env `WIKEY_BENCHMARK_LAYERS=filter,rewrite,expand` parse + lazy QueryIntentFilter / QueryRewriter / QueryExpander 인스턴스
- `defaultSearchFn` 안 layer inject 분기 — augmented path 활성 시 `handle.search(query, { topN, filter, rewriter, expander })`

**augmented 임계 측정 (Top-1 ≥ 70% / Top-3 ≥ 88% / MRR ≥ 0.85)**:
- 사용자 수동 트리거 의무. 절차:
  ```
  WIKEY_BENCHMARK_LAYERS=filter,rewrite,expand \
  WIKEY_BENCHMARK_TOP1_MIN=0.7 \
  WIKEY_BENCHMARK_TOP3_MIN=0.88 \
  WIKEY_BENCHMARK_MRR_MIN=0.85 \
  npm run benchmark:search
  ```
- master 의 auto mode classifier 가 credentials.json 직접 read 차단 (보안 정책 준수). 사용자가 `~/.config/wikey/credentials.json` 안 `geminiApiKey` field 정상 설정 후 직접 실행 (`loadConfig(projectDir)` 가 `<projectDir>/wikey.conf` + `~/.config/wikey/credentials.json` 만 read — projectDir = `process.cwd()` (`wikey-core/`). `wikey-core/wikey.conf` 부재이므로 repo root `wikey.conf` 는 자동 read X — credentials.json 만 source. `process.env.GEMINI_API_KEY` 도 본 코드 path 안 unused).

## post-impl 검증 sweep

| Cycle | codex finding | master fix |
|-------|---------------|------------|
| #1 | 4 HIGH + 3 MED | DEFAULT provider inherit / suite append default / auto-extend N=5 wire / CI threshold split / metadata badges / qmd Out of Scope / I22 raw question union |
| #2 | 1 HIGH + 2 MED | cursor durability + flush / pure helper extract / spec/todox v1.4 sweep |
| #3 | 2 HIGH + 1 MED | per-call return value / cursor 누수 fromIndex / SQLite stale ref sweep |
| #4 | 1 HIGH + 1 MED | clearChat reset + loadSettings cap + maybeTriggerAutoExtend defensive / spec line 89 sweep |
| #5 | 1 HIGH | generation counter + monotonic guard + Layer 3 cursorLeftBehind |
| #6 | 1 HIGH + 1 MED (master 직접 + dev partial) | append-time invalidation guard / monotonic test branch exercise / **master-validation skill 26-anchor 적용 (사용자 raise 시정)** |
| #7 | 1 HIGH + 1 MED (master 직접) | RunQueryAnalysisResult fallback union widening / todox line 15 stale + tsconfig src/__tests__ exclude |
| #8 | 1 MED (master 직접) | doc sweep "18 file" → "≤20 file" + "Cycle #1~#5" → "Cycle #1~#6" |
| #9 | 1 MED (master 직접) | todox line 15 "cycle #7" stale clause 제거 (mirror 회복) |
| #10 | 1 HIGH AC-L1 (master 직접) | augmented path 코드 구현 + baseline 회귀 0 측정 + augmented 임계 사용자 수동 deferral |
| #11 | 1 HIGH + 2 MED (master 직접) | AC-L1 evidence env wording / plan-full+phase-5-todo §5.7.8 row v1.4 sweep / spec line 250 mode names mirror |
| #12 | 2 HIGH + 4 MED (master 직접) | phase-5-todo body sweep 신설 후보→종결 / plan-full status cell sweep / spec Risk #2 mode names / spec/todox/resultx Cycle #1~#11 mirror + frontmatter status:completed / phase-5-result entry SDD+TDD 종결 / AC-L1 wikey.conf wording |
| #13 | 3 HIGH + 2 MED (master 직접) | phase-5-todo finding count 일치 / spec/todox/resultx cycle narrative 연장 (#11~#13) / phase-5-result.md body cycle history regroup / change-surface count drift fix / AC-L1 wording 정확화 |

## 누적 finding 분석 (점진 수렴)

cycle 추적은 본 문서 아래 cycle별 fix mapping 표 참조. 점진 수렴 후 모든 finding closed.

## 변경 면 누적

코드 (22):
- **wikey-core 16 file**: 신규 7 src (query-intent-filter / query-rewriter / query-expander / query-filter-cache / query-analyzer / llm-json-utils / config/vault-query-config) + 신규 4 prompt (filter / rewriter / expander / analyzer) + 변경 5 (orama-index / query-pipeline / index / scripts/benchmark-search / types). eval/benchmark-suite.json untouched (51 baseline 보존).
- **wikey-obsidian 4 file**: 변경 4 (settings-tab / main / sidebar-chat / commands).
- **repo root 1 file**: 신규 1 (.github/workflows/benchmark.yml).
- **tsconfig 1 file**: wikey-obsidian/tsconfig.json (Cycle #7 src/__tests__ exclude).

문서 (3):
- **spec/todox 2 file**: v1.4 (history rows v1~v1.4 보존, cycle #1~#13 narrative 통합).
- **활동 1 file**: phase-5-resultx-5.7.8-llm-dynamic-stopword-2026-05-10.md (본 문서).

신규 native dep 0 (option B file-based JSON LRU 채택, SQLite 도입 회피).

**총 25 file** (코드 22 + 문서 3). 변경 이력 v1.4 row 안 cycle #1~#13 narrative 통합.

> spec self-check (line 520) 의 wikey-obsidian count 3 vs 본 evidence 4 차이 = settings-tab + main + sidebar-chat (spec 정의) 외에 commands.ts 가 cycle #1 fix 시 추가 변경 (Run query analysis command). 본 evidence count 정확.

## test 결과 (post-impl 종결 시점, 2026-05-10)

```
wikey-core: 781 passed | 3 skipped (784) — 기존 738 + 신규 43 (Cycle #3 새 plumbing 2건 + Cycle #1 unit 39 + Cycle #5 race-guard 2)
wikey-obsidian: 100 passed (100) — 기존 46 + 신규 54 (settings-tab + sidebar-chat + run-query-analysis + auto-extend-trigger + filter-default-inherit + run-query-analysis-cursor + auto-extend-cursor-recovery + auto-extend-race-guards + Cycle #6 보강)
tsc --noEmit (production): 0 errors
build (wikey-core + wikey-obsidian): 0 errors
validate-wiki / check-licenses / check-kiwi-vendor-sync: PASS
anchor (k) hardcoded list grep: 0 hits
```
