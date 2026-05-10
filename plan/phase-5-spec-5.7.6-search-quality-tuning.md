---
phase: 5
section: 5.7.6
title: 검색 quality tuning — Q5 stopword + 50+ query benchmark (Spec)
status: planning
created: 2026-05-10
updated: 2026-05-10
version: v1.2
---

# Phase 5 §5.7.6 검색 quality tuning — Q5 stopword + 50+ query benchmark (Spec, WHAT)

> **상위 문서**: [`plan/phase-5-todo.md §5.7.6`](./phase-5-todo.md) (실행 단일 소스, 체크박스) · [`plan/phase-5-spec-5.7.5-orama-update-sync.md`](./phase-5-spec-5.7.5-orama-update-sync.md) v1.4 (선행 cycle, deferral source — §1.2 비목표 / §3.7 B 그룹 / §4.5 4-question / §4.7 분류 / §6 진입 후속) · [`plan/phase-5-todox-5.7.6-search-quality-tuning.md`](./phase-5-todox-5.7.6-search-quality-tuning.md) (Todo, HOW — mirror)
>
> **버전 이력**:
> - v1 (2026-05-10 session 32, analyst 작성): §5.7.5 종결 후 deferred quality tuning 영역의 minimal scope 진입. C1 (Q5 stopword 보완) + C2 (50+ query suite + benchmark 자동화 BENCH-AUTO 통합) 만 포함. HYBRID Stage 2 vector reroute 는 §5.7.7 후보. B3/B5/B6 = 미진행 (사용자 결정 2026-05-10 = 수동 update 절차). spec 6요소 정의. AC 8 (단위 5 + 통합 2 + 라이브 1). 사용자 결정 의뢰 1건 (`[사용자 결정]` 마커 — stopword list 정확도 평가).
> - **v1.1** (2026-05-10 session 32, master 1차 검증 fix): 1 HIGH + 3 MED + 2 LOW + 1 권고 모두 fix. (H1) §3.4 import path `loadOramaIndex` 부재 → `createOramaIndex({ cachePath, tokenizer })` factory + `defaultOramaCachePath` + `disposeOramaIndex` (singleton) + `createKoreanTokenizer` (Kiwi WASM init) 패턴 정정. (M1) tsx 신규 devDep 추가 의무 명시 (wikey-core / root / wikey-obsidian 모두 tsx 0건). (M2) benchmark-search.ts sample 에 Kiwi init 절차 추가. (M3) §8.4 R3 "vitest jsdom" → "vitest node env" 정정 (`wikey-core/vitest.config.ts` environment 0 = 기본 node). (L1) yaml license 추정 → **JSON 변경으로 자연 해결** (yaml dep 0). (L2) line range micro drift 정정. **(R1) YAML → JSON 변경** (사용자 결정 2026-05-10) — yaml devDep 0, Node native `JSON.parse` 사용, file 명 `benchmark-suite.yaml` → `benchmark-suite.json`, Karpathy Simplicity #1 (200줄→50줄 mirror — dep 추가 회피).
>
> **wiki 재생성 없음 확증**: 본 §5.7.6 = *검색 query path tokenizer 정밀화 + benchmark suite 신설*. wiki/ 본문 / frontmatter / 페이지 자체 변경 0. canonicalizer / mention extractor / ingest pipeline 변경 0. 검색 코어 (Orama backend + Kiwi WASM) 변경 0 — smart_tokenize 의 stopword 분기 추가만 (tokenizer 의 internal). reindex 의무 = stopword 변경이 indexing 결과 영향 → master 의 fresh `./scripts/reindex.sh` 실행 의무 (Step C 안 명시).

## 1. 목표 / 비목표

### 1.1 목표 (v1 범위 — Karpathy Goal-Driven 단일 목적)

본 §5.7.6 의 단일 목적 = **검색 quality 의 Q5 회귀 회복 (1/10 → ≥ 8/10) + 50+ query benchmark suite 자동화 도입**.

세부 3 sub-목표 (= 본 cycle 안 실 작업):

1. **C1 — Q5 stopword 보완 (smart_tokenize 정밀화)**: PoC §3 Q5 ("프로젝트 일정 관리") Top-1 1/10 회귀 — `프로젝트` / `관리` / `일정` 같은 generic content word 가 BM25 saturation 일으켜 `project-schedule-management` (qmd Top-1 hit) 대신 `프로젝트-관리-시스템` (Orama Top-1 hit) 으로 분기되는 현상. 해결 = 한국어 generic content word stopword list (≤ 10 단어) 추가하여 smart_tokenize 의 BM25 신호 정밀화. 변경 면 = `wikey-core/src/search/orama-korean-tokenizer.ts::smart_tokenize` (POS filter 후 stopword drop 추가) + `scripts/korean-tokenize.py::_smart_tokenize` (Python mirror).
2. **C2 — 50+ query benchmark suite + `npm run benchmark:search` script 자동화 (BENCH-AUTO 통합)**: 현 10 query (statistical power 부족 — sample size n=10 의 confidence interval 매우 넓음) → 50+ query suite (도메인 균형 — PMBOK / ITIL / Obsidian / 한국어 / 영문 / 한+영 mix). 변경 면 = `wikey-core/eval/benchmark-suite.json` (또는 동등 .json) + `scripts/benchmark-search.ts` + `wikey-core/package.json` script `benchmark:search`.
3. **검증 — Q5 회복 확증**: 본 cycle 의 직접 결과 = Q5 Top-1 hit `project-schedule-management` 가 ≥ 8/10 (현재 1/10).

### 1.2 비목표 (out of scope, v1 — 별 cycle / 별 phase 으로 deferral)

§5.7.5 v1.4 §1.2 양식 mirror. Karpathy Simplicity #2 (요청되지 않은 기능 추가 금지) 적용:

- **HYBRID Stage 2 vector reroute** — Qwen3-Embedding 768D 통합 + Orama hybrid mode (RRF 융합) 또는 RRF 자체 구현. 변경 면 큰 작업 (Qwen3-Embedding loader + index 재빌드 + hybrid query path ~600+ LOC). **별 cycle §5.7.7 후보** — 본 cycle 종결 후 별 spec/todox 작성 후 진입 결정. (사용자 결정 2026-05-10).
- **B3 Regression CI 자동화** — GitHub Actions / cron 으로 매 commit 후 quality benchmark 자동 실행. 본 §5.7.6 = *script 작성 + 1회 수동 실행* 까지만, CI 통합 미진행. wikey single-user 도구 + GitHub Actions 미설정 + master 수동 [개발필요] mark 패턴 (§5.7.4/§5.7.5) 충분. (사용자 결정 2026-05-10 = 미진행).
- **B5 docs 자동 갱신** — `docs/kiwi-nlp-vendor-sync.md` 또는 README 자동 갱신. §5.7.5 의 LLM 요약 (UI-6, ~7.9s) 이 즉시적, git noise 회피. (사용자 결정 2026-05-10 = 미진행, 수동 docs update 만).
- **B6 Push notification (email / GitHub watch / external server)** — UI-2 정책 (developer toggle off → 일반 사용자 미공개) 모순 + BYOAI 철학 (외부 server email 의존 0) 모순. settings UI passive 표시 만 (§5.7.5 종결 상태) 충분. (사용자 결정 2026-05-10 = 미진행).
- **stopword list 외부 customize (사용자 vault `.wikey/stopwords.yaml`)** — Karpathy Simplicity #1 (요청되지 않은 "유연성" / "설정 가능성" 금지). 본 §5.7.6 = code-internal hardcoded list 만, vault-level customize 미도입. 향후 사용자 요청 시 별 cycle.
- **다중 언어 stopword (영문 / 일본어 등)** — 현 wikey corpus 은 한국어 + 영문 (코드/명사) mix. 본 §5.7.6 stopword = 한국어 generic content word 만. 영문 stopword (`the` / `a` / `of` 등) 은 BM25 본 알고리즘이 IDF 로 자연 처리 — 추가 stopword 불필요. (Karpathy Simplicity).
- **smart_tokenize 의 다른 정밀화 (POS filter 변경 / alphanumeric regex 변경 / Kiwi 사전 customize)** — 본 §5.7.6 = stopword 추가 1 변경 면 만. 다른 dimension 정밀화는 별 cycle.

### 1.3 사용자 결정 의뢰 1건 (`[사용자 결정]` 마커)

본 v1 작성 시점에 analyst 가 임의 결정 안 한 항목. master 가 본 spec read 후 사용자에게 명시 prompt 의무:

| # | 결정 항목 | analyst v1 권고 default | 영향 |
|---|----------|--------------------------|------|
| **1** | C1 stopword list 정확도 평가 — 후보 단어 set 결정 | **v1.2 — 5 단어 default** = `프로젝트` / `관리` / `정보` / `시스템` / `업무` (codex cycle #1 HIGH #3 fix: `일정` 제거 — Q5 query "프로젝트 일정 관리" 3 단어 모두 stopword 시 tokenize empty → AC-Q1 unrecoverable. `일정` 잔존으로 specific 신호 보존, `project-schedule-management.md` 본문 안 다수 등장으로 BM25 우세). 사용자가 wiki corpus 안 단어 분포 + 검색 의도 사용 패턴 을 보고 추가 / 제외 결정. master 가 Step A1 안 잠금 의무. | AC-S1 의 stopword list literal — 사용자 결정 결과 mirror. |

> **참고**: 본 spec 안 stopword list 의 default 5 단어는 PoC §3 Q5 회귀 분석 (analyst 가 활동 evidence read) 결과 + Q5 query 토큰 분포 + 일반 한국어 BM25 정보 검색 관행 (NNG / NNB POS 안 빈번 단어) 종합. 사용자 final 평가가 우선.

## 2. 현재 코드 사실 (analyst 직접 확인)

본 spec 의 변경 면을 결정하기 위해 analyst 가 grep / read 로 직접 확인한 사실 (line number 는 *spec 작성 시점*, 구현 시 사소한 drift 가능):

| # | 항목 | 위치 | 현재 상태 |
|---|------|------|-----------|
| 1 | smart_tokenize TS 구현 | `wikey-core/src/search/orama-korean-tokenizer.ts:~125~145` `tokenize` arrow fn (실 line ~125 부터, micro drift) | lowercase + Kiwi WASM + POS filter (`CONTENT_POS`). stopword 분기 부재. |
| 2 | smart_tokenize Python mirror | `scripts/korean-tokenize.py:66~97` `_smart_tokenize` | kiwipiepy + POS filter (`CONTENT_POS`). lowercase 미적용 — §5.7.5 LOW #5 사용자 결정 #4 = code lowercase 유지 + docs 정정 (Python 측 lowercase 추가는 별 결정 영역, 본 §5.7.6 = stopword 추가 1 변경만). v1 spec scope = stopword 추가 만, lowercase mirror 는 §5.7.5 종결 상태 유지. |
| 3 | `tokenize_for_query` Python | `scripts/korean-tokenize.py:109~118` | POS filter only — stopword 분기 부재. 본 §5.7.6 = `_smart_tokenize` 안 stopword drop 후 `tokenize_for_query` / `tokenize_for_index` 양쪽 자연 영향. |
| 4 | wikey-core eval 디렉토리 | `wikey-core/eval/` 부재 (master fact-check 의무 — Step A3) — `wikey-core/src/__tests__/` 만 존재 | 신규 디렉토리 생성 의무. benchmark suite + script 위치. |
| 5 | benchmark 현 위치 | `wikey-obsidian/src/commands.ts:wikey-poc-orama-benchmark` 는 §5.7.5 POC-1 cleanup 으로 **제거됨** (commit `02b0318`). benchmark fixture data + 호출 경로 부재. | 본 §5.7.6 = 신규 작성 의무. PoC §3 의 10 query 결과 (`activity/phase-5-resultx-5.7.3-orama-poc-2026-05-09.md`) 가 corpus baseline. |
| 6 | wikey-core npm scripts | `wikey-core/package.json::scripts` — `test` / `build` / `dev` 등 표준 script | `benchmark:search` script 부재. 본 §5.7.6 신규. |
| 7 | wiki corpus 규모 | wiki/ 안 ~117 docs (PoC §3 baseline). 한국어 + 영문 mix. | 본 §5.7.6 의 50+ query 도메인 커버 = 117 corpus 의 PMBOK / ITIL / Obsidian / 한국어 / 영문 영역에 비례 분포. |
| 8 | Q5 회귀 evidence | `activity/phase-5-resultx-5.7.3-orama-poc-2026-05-09.md` §3 D2 = Q5 ("프로젝트 일정 관리") qmd Top-1 = `project-schedule-management` ✅ vs Orama Top-1 = `프로젝트-관리-시스템` ⚠️ (1/10 회귀) | 본 §5.7.6 의 직접 fix 대상. stopword `프로젝트` + `관리` + `일정` drop 시 BM25 신호가 더 specific 한 단어 (`schedule`, `일정` 영문/한국어, `management` 영문) 로 집중 → `project-schedule-management.md` (영문 slug + 한국어 본문) Top-1 회복 가설. 본 cycle benchmark 가 가설 검증. |

**주의**: 본 §2 의 line number 는 spec v1 작성 시점 grep 결과. 구현 진입 (Step A) 시 master 가 fresh re-grep + 잠금 의무. 본 spec § AC 가 line number 직접 의존 X — 동작 + grep-able phrase 기준.

## 3. 데이터 모델 / 인터페이스 변경

### 3.1 stopword 추가 — `wikey-core/src/search/orama-korean-tokenizer.ts`

```ts
// wikey-core/src/search/orama-korean-tokenizer.ts (변경)

/**
 * 한국어 generic content word stopword list — BM25 saturation 회피.
 * §5.7.6 — Q5 ("프로젝트 일정 관리") 회귀 fix.
 *
 * 원칙: NNG/NNP POS 통과하지만 의미적으로 generic 한 단어. wiki corpus 의 다수 docs 가
 * 동일 단어를 포함 → IDF 약함 → BM25 신호가 specific 단어로 집중되도록 drop.
 *
 * 사용자 결정 #1 (§1.3) 결과 mirror — default 5 단어.
 */
// v1.2 (codex cycle #1 HIGH #3 fix): `일정` 제거 — Q5 query "프로젝트 일정 관리" 의 3 단어
// 모두 stopword 시 tokenize 결과 empty → AC-Q1 unrecoverable. `일정` 잔존으로 specific 신호 보존.
const KOREAN_STOPWORDS: ReadonlySet<string> = new Set([
  '프로젝트', '관리', '정보', '시스템', '업무',
])

// tokenize fn 안 (line 128~145):
//   기존 POS filter 후 stopword check 추가:
//   if (CONTENT_POS.has(tag)) {
//     const lowered = t.str.toLowerCase()
//     if (KOREAN_STOPWORDS.has(lowered)) continue   // §5.7.6 신규
//     result.push(lowered)
//   }
```

**변경 면**:
- 신규 const `KOREAN_STOPWORDS` (~3 LOC + JSDoc 6 LOC ≈ ~10 LOC)
- `tokenize` arrow fn 안 1 줄 (`if (KOREAN_STOPWORDS.has(lowered)) continue`)
- ALNUM_TOKEN_RE branch (line 134~136) 는 stopword 분기 제외 — 영문/숫자 토큰 (BM25, gpt-4 등) 은 generic 아님.

### 3.2 Python mirror — `scripts/korean-tokenize.py`

```python
# scripts/korean-tokenize.py (변경)

# §5.7.6 — Korean generic stopwords (TS smart_tokenize mirror).
# Production code (TS) 와 동일 list 의무. 사용자 결정 #1 결과 mirror.
KOREAN_STOPWORDS = {
    '프로젝트', '관리', '정보', '시스템', '업무',
}  # v1.2: `일정` 제거 (codex cycle #1 HIGH #3, Q5 unrecoverable 회피)

def _smart_tokenize(text: str):
    """... existing docstring ..."""
    kiwi = get_kiwi()
    result = []
    for word in text.split():
        if _ALNUM_TOKEN.fullmatch(word):
            result.append((word, 'SL'))
            continue
        tokens = kiwi.tokenize(word)
        merged = []
        for t in tokens:
            if t.form in KOREAN_STOPWORDS:    # §5.7.6 신규
                continue                       # §5.7.6 신규
            if (merged
                    and merged[-1][1] in ('SL', 'SN')
                    and t.tag in ('SL', 'SN')):
                merged[-1] = (merged[-1][0] + t.form, 'SL')
            else:
                merged.append((t.form, t.tag))
        result.extend(merged)
    return result
```

**변경 면**:
- 신규 `KOREAN_STOPWORDS` 모듈 상수 (~5 LOC)
- `_smart_tokenize` 안 2 줄 (early continue)
- `tokenize_for_query` / `tokenize_for_index` 변경 0 — `_smart_tokenize` 의 자연 영향 (drop 된 token 은 이후 합성 안 포함).

### 3.3 신규 — `wikey-core/eval/benchmark-suite.json`

50+ query suite. 도메인 균형 + Top-1 expected slug 매핑. (**v1.2 — JSON 채택**: dep 0, Node native `JSON.parse`, Karpathy Simplicity #1 — 사용자 결정 2026-05-10. JSON 도 git diff line-by-line 가독성 + vault 편집 동등.)

```json
{
  "$schema": "../eval/benchmark-suite.schema.json (선택)",
  "version": 1,
  "collection": "wikey-wiki",
  "created": "2026-05-10",
  "_doc": "§5.7.6 — 50+ query benchmark suite for search quality regression tracking. 도메인 균형 (~10 query / domain × 5 domain = 50 query). Top-1 expected slug = wiki corpus 안 정답 slug. 다중 정답 가능 시 list.",
  "queries": [
    {
      "id": "pmbok-q1",
      "query": "프로젝트 일정 관리",
      "expected_top1": "project-schedule-management",
      "expected_top3": ["project-schedule-management", "project-management-body-of-knowledge", "earned-value-management"],
      "domain": "pmbok",
      "note": "§5.7.3 PoC Q5 — Q5 stopword fix 의 직접 회복 대상 (v1.2 codex LOW #8: corpus 안 실 slug 만)"
    },
    {
      "id": "pmbok-q2",
      "query": "PMBOK 지식체계",
      "expected_top1": "project-management-body-of-knowledge",
      "expected_top3": ["project-management-body-of-knowledge", "project-schedule-management", "work-breakdown-structure"],
      "domain": "pmbok"
    },
    {
      "id": "itil-q1",
      "query": "ITIL 4 가이드 원칙",
      "expected_top1": "itil-4-guiding-principles",
      "expected_top3": ["itil-4-guiding-principles", "itil-4", "continual-improvement"],
      "domain": "itil",
      "note": "§5.7.3 PoC Q4 mirror (v1.2: corpus 안 실 slug)"
    }
  ]
}
```

(위 sample = pmbok 2 query + itil 1 query. 실제 50+ query = pmbok ≥ 10 + itil ≥ 10 + obsidian ≥ 10 + korean-general ≥ 10 + english-mixed ≥ 10.)

**구조**:
- `queries[]` 의 각 entry = `{id, query, expected_top1, expected_top3, domain, note?}` 필수 field
- `expected_top1` = single slug (구현 시 string match)
- `expected_top3` = ordered list (구현 시 set membership check — top 3 result 중 expected 단일 hit 이상)
- `domain` enum = `pmbok | itil | obsidian | korean-general | english-mixed`
- `_doc` field = JSON 안 metadata 주석 (JSON spec native comment 부재 회피)

**변경 면**: 신규 file ~200 LOC JSON. **dep 추가 0** (Node native `JSON.parse`).

### 3.4 신규 — `scripts/benchmark-search.ts`

**v1.2 (codex cycle #1 HIGH #1 + MED #4 fix)**: 실 `runOramaIngest` (`wikey-core/src/scripts/reindex.ts:178~224`) pattern mirror — `createKoreanTokenizer({ wasmPath, modelDir })` + `createOramaIndex({ cachePath, tokenizer })` + `await handle.restore()` + `handle.search(question, { topN })` + `SearchResult.path` (slug derive). pure score 함수 분리 + `runBenchmark` export (mock 가능).

```ts
// scripts/benchmark-search.ts (신규, v1.2)
// §5.7.6 — 50+ query benchmark runner for search quality regression tracking.
//
// Usage: tsx scripts/benchmark-search.ts [--suite path]
// (tsx 신규 devDep 의무 — wikey-core/package.json devDep. Step A3 잠금.)
//
// Output: stdout (Top-1 / Top-3 / MRR per domain + aggregate) + exit 0 (PASS) / 1 (regression)

import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createOramaIndex, type KoreanTokenizerHandle } from '../wikey-core/src/search/orama-index.js'
import { defaultOramaCachePath, disposeOramaIndex } from '../wikey-core/src/search/orama-index-singleton.js'
import type { SearchResult } from '../wikey-core/src/types.js'
// createKoreanTokenizer = lazy import (reindex.ts:17 패턴 mirror — vendor/kiwi-nlp 부재 시 graceful fail)
// (Step A3 fact-check 후 잠금. wikey-core 가 npm package 미publish — monorepo relative path 사용.)

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

export interface QueryEntry {
  id: string
  query: string
  expected_top1: string
  expected_top3: string[]
  domain: string
  note?: string
}

export interface BenchmarkSuite {
  version: number
  collection: string
  created: string
  _doc?: string
  queries: QueryEntry[]
}

export interface QueryResult {
  id: string
  query: string
  domain: string
  top1Hit: boolean
  top3Hit: boolean
  mrr: number  // 1 / rank of first expected hit, 0 if not in Top-10
}

export interface RunBenchmarkOpts {
  suitePath: string
  // search injection — mock 가능 (codex MED #4 fix: handle/search 분리)
  searchFn: (query: string, topN: number) => Promise<readonly SearchResult[]>
}

// SearchResult.path = "wiki/concepts/<slug>.md" → slug derive (codex HIGH #1 fix)
function pathToSlug(path: string): string {
  return basename(path).replace(/\.md$/, '')
}

// pure score function (mock 가능, separable I/O)
export function computeQueryResult(
  q: QueryEntry,
  hits: readonly SearchResult[],
): QueryResult {
  const slugs = hits.map((h) => pathToSlug(h.path))
  const top1Hit = slugs[0] === q.expected_top1
  const top3Hit = slugs.slice(0, 3).some((s) => q.expected_top3.includes(s))
  const expectedRank = slugs.findIndex((s) => q.expected_top3.includes(s))
  const mrr = expectedRank >= 0 ? 1 / (expectedRank + 1) : 0
  return { id: q.id, query: q.query, domain: q.domain, top1Hit, top3Hit, mrr }
}

export async function runBenchmark(
  opts: RunBenchmarkOpts,
): Promise<{ pass: boolean; results: QueryResult[] }> {
  const jsonText = readFileSync(opts.suitePath, 'utf-8')
  const suite = JSON.parse(jsonText) as BenchmarkSuite

  const results: QueryResult[] = []
  for (const q of suite.queries) {
    const hits = await opts.searchFn(q.query, 10)
    results.push(computeQueryResult(q, hits))
  }

  reportResults(opts.suitePath, results)

  // Regression threshold (env override)
  const top1Total = results.filter((r) => r.top1Hit).length
  const top3Total = results.filter((r) => r.top3Hit).length
  const top1Min = Number(process.env.WIKEY_BENCHMARK_TOP1_MIN ?? '0.7')
  const top3Min = Number(process.env.WIKEY_BENCHMARK_TOP3_MIN ?? '0.85')
  const total = results.length
  const pass = total > 0 && (top1Total / total) >= top1Min && (top3Total / total) >= top3Min
  if (!pass) console.error(`[FAIL] Regression — Top-1=${top1Total}/${total} or Top-3=${top3Total}/${total} below threshold`)
  return { pass, results }
}

export function reportResults(suitePath: string, results: QueryResult[]): void {
  const total = results.length
  const top1 = results.filter((r) => r.top1Hit).length
  const top3 = results.filter((r) => r.top3Hit).length
  const meanMrr = total > 0 ? results.reduce((s, r) => s + r.mrr, 0) / total : 0

  const byDomain = new Map<string, QueryResult[]>()
  for (const r of results) {
    if (!byDomain.has(r.domain)) byDomain.set(r.domain, [])
    byDomain.get(r.domain)!.push(r)
  }

  console.log(`# Benchmark suite: ${suitePath}`)
  console.log(`# Total: ${total} queries`)
  console.log(`# Top-1: ${top1}/${total} (${total > 0 ? ((top1 / total) * 100).toFixed(1) : '0'}%)`)
  console.log(`# Top-3: ${top3}/${total} (${total > 0 ? ((top3 / total) * 100).toFixed(1) : '0'}%)`)
  console.log(`# Mean MRR: ${meanMrr.toFixed(3)}`)
  console.log(`# Per domain:`)
  for (const [domain, rs] of byDomain) {
    const d1 = rs.filter((r) => r.top1Hit).length
    const d3 = rs.filter((r) => r.top3Hit).length
    console.log(`#   ${domain}: ${rs.length} q / Top-1 ${d1} / Top-3 ${d3}`)
  }
}

// CLI main — wraps real Orama + Kiwi (Step C live smoke 시 호출)
async function defaultSearchFn(): Promise<RunBenchmarkOpts['searchFn']> {
  // reindex.ts:191~197 패턴 mirror (lazy Kiwi import + wasm/model resolve)
  const wasmPath = process.env.WIKEY_KIWI_WASM_PATH
    ?? join(__dirname, '../wikey-core/vendor/kiwi-nlp/dist/kiwi-wasm.wasm')
  const modelDir = process.env.WIKEY_KIWI_MODEL_DIR
    ?? join(homedir(), '.cache/wikey/kiwi-models/cong/base')
  if (!existsSync(wasmPath) || !existsSync(modelDir)) {
    throw new Error(`Kiwi vendor wasm or model dir 부재 (wasm=${wasmPath}, modelDir=${modelDir})`)
  }
  const tokenizerMod = await import('../wikey-core/src/search/orama-korean-tokenizer.js')
  const tokenizer: KoreanTokenizerHandle = await tokenizerMod.createKoreanTokenizer({ wasmPath, modelDir })
  const handle = await createOramaIndex({ cachePath: defaultOramaCachePath(), tokenizer })
  await handle.restore()  // codex HIGH #1: cached search 전 의무
  return async (query, topN) => handle.search(query, { topN })
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const suitePath = args.includes('--suite')
    ? args[args.indexOf('--suite') + 1]
    : resolve(__dirname, '../wikey-core/eval/benchmark-suite.json')
  const searchFn = await defaultSearchFn()
  try {
    const { pass } = await runBenchmark({ suitePath, searchFn })
    process.exit(pass ? 0 : 1)
  } finally {
    disposeOramaIndex()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err)
    process.exit(2)
  })
}
```

**변경 면**: 신규 file ~150 LOC TypeScript (v1.2 = v1.1 ~120 + export + injection + restore + path-to-slug + report 분리 ~30). **dep 추가 0** (Node native). `tsx` devDep 신규 추가 의무. **export**: `runBenchmark` / `computeQueryResult` / `QueryEntry` / `BenchmarkSuite` / `QueryResult` / `RunBenchmarkOpts` (codex MED #4 fix — mock 가능).

### 3.5 신규 — `wikey-core/package.json` script + tsx devDep

**v1.2 fact-check 결과**: wikey-core / root / wikey-obsidian 모두 `tsx` dep 0건 (`tools/qmd/package.json` 만 사용). 즉 **tsx 신규 devDep 추가 의무** (단순 *기존 패턴 mirror* 아님).

```jsonc
// wikey-core/package.json (변경 — 2 영역)
{
  "scripts": {
    // ... 기존 (build / test / test:watch) ...
    "benchmark:search": "tsx ../scripts/benchmark-search.ts"
  },
  "devDependencies": {
    // ... 기존 (vitest / @vitest/coverage-v8 등) ...
    "tsx": "^4.7.0"
  }
}
```

**변경 면**: ~2 LOC (script 1 + devDep 1). 대안 = `node --loader ts-node/esm` (ts-node devDep) 또는 미리 build 후 `node dist/scripts/benchmark-search.js` (wikey-core build 패턴 mirror). analyst v1 default + master v1.2 결정 = **tsx 신규 devDep** (간결 + Step A3 fact-check 미필요 — file 구조 명확).

## 4. 4-question 검증 표

> 사용자 강조 (2026-05-09): "spec 에 대해서는 정말 필요한 기능인지, 역할이 뭔지 등을 검증할 필요 있음."
>
> 4 question:
> 1. **필요성**: 본 §5.7.6 invariant 또는 검색 quality 안전성에 필수?
> 2. **역할**: 해결 problem 명확 + 다른 항목과 책임 중복 없는가?
> 3. **Karpathy Simplicity**: 200줄 → 50줄 가능 / 시니어 엔지니어 over-eng 판정?
> 4. **Phase scope**: 본 cycle 안 처리 합리 / 별 spec deferral 합리 / 별 phase 합리?

본 §5.7.6 의 입력 항목 = 본 cycle 안 *2개* 만 (C1 + C2). HYBRID / B3/B5/B6 은 §5.7.5 v1.4 §1.2 에서 이미 deferral 결정 + 본 §5.7.6 §1.2 에서 mirror.

### 4.1 본 cycle 검증 — C1 + C2

| # | 항목 | 분류 | 근거 |
|---|------|------|------|
| **C1** Q5 stopword 보완 (smart_tokenize 정밀화) | ✅ 포함 | (1) Q5 회귀 1/10 = PoC §3 evidence — 검색 quality 회귀 직접 영향. (2) smart_tokenize 안 stopword 분기 1 변경 — 책임 명확 + 다른 항목 중복 0. (3) ~15 LOC (TS) + ~7 LOC (Python) — Karpathy Simplicity 충족. (4) 본 cycle. AC-S1, AC-S2, AC-S3, AC-Q1. |
| **C2 + BENCH-AUTO 통합** 50+ query suite + benchmark script + npm script | ✅ 포함 (BENCH-AUTO 통합) | (1) 현 10 query (statistical power 부족) → 50+ query 의 도메인 균형 — quality regression 자동 감지 핵심 도구. C1 의 Q5 회복 검증의 자연 도구 (단일 query 측정 시 false positive 가능). (2) suite + script + npm script 3 항목 — script 가 suite 를 input 으로 받아 결과 stdout 출력. 책임 명확. (3) suite ~200 LOC YAML + script ~100 LOC TS + npm script 1 LOC = ~301 LOC, 50+ query 가 본 cycle 의 가치 (statistical power) — Simplicity 충족 (사이즈 합리). (4) 본 cycle (BENCH-AUTO 통합 = C2 결과물 자동화). AC-B1, AC-B2, AC-B3. |

### 4.2 deferral / 별 cycle 항목 (§1.2 mirror)

| # | 항목 | 분류 | 근거 |
|---|------|------|------|
| **HYBRID** Stage 2 vector reroute | ❌ 별 cycle (§5.7.7) | (1) Qwen3-Embedding 768D 통합 — 변경 면 큰 (~600+ LOC). 본 §5.7.6 minimal scope 외. (2) — (3) — (4) **§5.7.7 후보** — 별 spec/todox 작성 후 진입 결정. |
| **B3** Regression CI 자동화 | ❌ 미진행 | (1) wikey single-user 도구 + GitHub Actions 미설정 + master 수동 패턴 충분. (2) — (3) — (4) **미진행** (사용자 결정 2026-05-10). |
| **B5** docs 자동 갱신 | ❌ 미진행 | (1) docs stable + git noise 회피. (2) — (3) — (4) **미진행** (사용자 결정 2026-05-10). |
| **B6** Push notification | ❌ 미진행 | (1) UI-2 + BYOAI 철학 모순. (2) — (3) — (4) **미진행** (사용자 결정 2026-05-10). |

### 4.3 검증 요약

| 분류 | 개수 | 항목 |
|---|---|---|
| **포함 (해당 cycle 의무)** | **2** | C1, C2 (BENCH-AUTO 통합) |
| **별 cycle** | **1** | HYBRID (§5.7.7 후보) |
| **미진행 (사용자 결정 2026-05-10)** | **3** | B3, B5, B6 |

총 6 입력 항목 (= 본 cycle 안 2 + 별 cycle 1 + 미진행 3). 본 cycle 안 실 작업 = **2** (C1 + C2 통합). 별 cycle deferral = **1**. 미진행 = **3**.

## 5. Acceptance Criteria (AC) — 총 8 개 (단위 5 + 통합 2 + 라이브 1)

> 본 cycle 의 AC 는 *본 §5.7.6 invariant 와 직접 연결* 되는 항목만 포함. Out-of-Scope (§1.2) 항목은 AC 안 부재 (별 cycle).

### 5.1 단위 AC (RED 작성 → GREEN 통과 의무, 5 개)

| # | AC | 검증 |
|---|----|------|
| **AC-S1** | `KOREAN_STOPWORDS` 상수 — `wikey-core/src/search/orama-korean-tokenizer.ts` 안 const set, 사용자 결정 #1 (§1.3) 결과 mirror (**v1.2 default 5 단어** = `프로젝트` / `관리` / `정보` / `시스템` / `업무`). exact members assert. | wikey-core unit test (set membership). |
| **AC-S2** | `tokenize` smart_tokenize stopword 분기 — fixture `"프로젝트 일정 관리"` 입력 시 결과 array 안 stopword 5 단어 (`프로젝트` / `관리` / `정보` / `시스템` / `업무`) 부재 **+ `일정` 잔존 (non-empty discriminating signal)**. fixture `"BM25 알고리즘"` 입력 시 ALNUM `BM25` 보존 (stopword 분기 제외) + Kiwi token 결과. (v1.2 codex HIGH #3 fix: AC-S2 강화 — empty array PASS 회피, Q5 회복 path invariant) | wikey-core unit test (`wikey-core/src/__tests__/search/orama-korean-tokenizer-stopword.test.ts` — vitest config include 안). |
| **AC-S3** | Python mirror `_smart_tokenize` — `KOREAN_STOPWORDS` set 동등 (v1.2 5 단어) + early continue. fixture `"프로젝트 일정 관리"` 입력 시 결과 list 안 stopword 5 단어 부재 **+ `일정` 잔존 (TS 와 동일 결과, cross-language consistency)**. (v1.2 codex HIGH #3 mirror) | Python unit test (별 command — Step B 안 `python -m pytest scripts/tests/test_korean_tokenize.py` 명시 의무, vitest 가 cover 안 함). |
| **AC-B1** | `wikey-core/eval/benchmark-suite.json` — 50+ query 의 도메인 균형: 5 도메인 (`pmbok` / `itil` / `obsidian` / `korean-general` / `english-mixed`) 각 ≥ 10 query. 각 entry = `{id, query, expected_top1, expected_top3, domain, note?}` 필수 field 모두 present. JSON.parse → schema validation. **v1.2 강화 (codex LOW #8)**: 모든 `expected_top1` + 모든 `expected_top3` slug 가 `wiki/concepts/<slug>.md` 또는 `wiki/entities/<slug>.md` 또는 `wiki/sources/<slug>.md` 안 실 존재 grep 의무 (test 안 file existence assert). | wikey-core unit test (`wikey-core/src/__tests__/eval/benchmark-suite.test.ts` — vitest config include 안). |
| **AC-B2** | `scripts/benchmark-search.ts` — **`runBenchmark` export 의무 + handle/search injection 분리** (codex MED #4 fix): `runBenchmark(opts: { suitePath: string; searchFn: (q: string, topN: number) => Promise<SearchResult[]> })` 시그니처. mock searchFn inject → `{pass: boolean, results: QueryResult[]}` 반환. 각 `QueryResult` 의 `top1Hit` + `top3Hit` + `mrr` 정상 계산. pure scoring fn (`computeQueryResult`) 도 별 export. | unit test (`wikey-core/src/__tests__/eval/benchmark-search.test.ts` — vitest scope 안, mock searchFn). |

### 5.2 통합 AC (script + npm script, 2 개)

| # | AC | 검증 |
|---|----|------|
| **AC-B3** | `npm run benchmark:search` (wikey-core 안에서) 실행 시 — actual Orama index (master 의 fresh `./scripts/reindex.sh` 실행 후) 대상 50+ query benchmark 1회 진행 + stdout 형식 (`# Total:` / `# Top-1:` / `# Top-3:` / `# Mean MRR:` / `# Per domain:`) + exit 0 (regression 임계 통과). | integration test 또는 master 직접 실행 (Step C 라이브 smoke 와 일부 중복 OK). |
| **AC-R1** | 회귀 — wikey-core 738+ tests PASS (기존 baseline) / wikey-obsidian 46+ tests PASS / `npm run build` 0 errors / `./scripts/validate-wiki.sh` PASS / `./scripts/check-licenses.sh` PASS / `./scripts/check-kiwi-vendor-sync.sh` 정상 동작. 본 §5.7.6 변경이 기존 회귀 무손상. | master 직접 실행 (Step B3 BLUE 3a). |

### 5.3 라이브 cycle smoke AC (master 직접, 1 개)

| # | AC | 검증 |
|---|----|------|
| **AC-Q1** | Q5 회복 — `npm run benchmark:search` 1회 실행 + Q5 (`pmbok-q1`, query=`프로젝트 일정 관리`) 의 result entry 의 `top1Hit = true` (Top-1 = `project-schedule-management`). 추가 sanity = 다른 49+ query 의 Top-1 / Top-3 baseline 측정 + 도메인별 분포 console log 보존 (regression baseline 으로 활동 evidence 보존). 기준 = Q5 stopword fix 후 ≥ 8/10 (10회 실행 시) 또는 ≥ 1/1 (1회 실행, Top-1 hit) — Step A1 사용자 결정 이후 잠금 (단일 실행 deterministic 이므로 1/1 default). | master 직접 실행, console log + result file 보존 (`activity/phase-5-resultx-5.7.6-search-quality-tuning-<date>.md`). |

## 6. Risk grid + 완화

| # | Risk | Severity | 확률 | 완화 | AC |
|---|------|----------|------|------|-----|
| 1 | stopword over-removal — `프로젝트` drop 으로 `project-management-overview.md` 같은 정답 페이지 검색 신호 약화 | MED | MED | 50+ query benchmark 의 도메인 균형 검증 (특히 `pmbok` 도메인 ≥ 10 query) — Q5 외 다른 PMBOK query 회귀 detect. 결과 acceptable trade-off 확인 후 commit. master 가 Step C 라이브 smoke 시 도메인별 Top-1/Top-3 비교 의무. | AC-B3, AC-Q1 |
| 2 | benchmark suite bias — 50+ query 가 wiki corpus 의 실 사용 패턴 반영 안 함 (analyst 의 query set 이 cherry-picked) | MED | MED | suite 작성 시 5 도메인 각 ≥ 10 query 강제 + `query` 텍스트 = 사용자 자연어 표현 (PoC §3 의 10 query 양식 mirror — `"프로젝트 일정 관리"` / `"PMBOK 7 가이드 원칙"` 같은 단순 명사구). 사용자 final review 의무. expected_top1 / expected_top3 = wiki corpus 실 slug grep + master 잠금. | AC-B1 |
| 3 | Python mirror mismatch — TS / Python `KOREAN_STOPWORDS` drift (literal 단어 list 가 두 file 에 hardcoded) | MED | LOW | (a) 단위 test 안 양쪽 set 동등 assert 추가 (AC-S3 cross-language consistency check) — Python test 가 TS file 의 KOREAN_STOPWORDS 추출 + 비교, 또는 (b) 문서 의무 = 본 spec §3.1 + §3.2 안 동일 list 명시 + 변경 시 양쪽 동시 수정 의무 commit message convention. analyst v1 default = (b) docs + manual sync — 1 변경면 단순화 (Karpathy Simplicity, 단어 list 6개 hardcoded). master 가 변경 시 양쪽 동시 fix 의무. | AC-S3 |
| 4 | quality regression — stopword 추가 후 도메인 평균 Top-1 / Top-3 회귀 (e.g. ITIL 도메인 score 하락) | HIGH | LOW (analyst 가 stopword 후보를 PMBOK / ITIL / Obsidian 의 generic word 중심으로 선정) | benchmark 결과 도메인별 비교 — regression (any 도메인 -10% 이상) detect 시 commit X + 사용자 보고. 회복 path = stopword list 축소 또는 별 cycle. master 가 Step C 라이브 smoke 시 도메인별 비교 의무. AC-B3 의 regression 임계 (`WIKEY_BENCHMARK_TOP1_MIN=0.7` / `TOP3_MIN=0.85` default) 가 자동 detect 보조. | AC-B3, AC-Q1 |
| 5 | benchmark script 의 import path 불안정 (wikey-core 가 npm package publish 되지 않음, monorepo path) + tsx devDep 신규 의무 | MED | MED | **v1.2 fix**: master fact-check 결과 — `loadOramaIndex` 부재, 실 패턴 = `createOramaIndex({ cachePath, tokenizer })` factory + `defaultOramaCachePath` (singleton) + `createKoreanTokenizer` (Kiwi WASM init). reindex.ts:17~18 패턴 mirror — `import ... from '../wikey-core/src/search/orama-index.js'` 등 monorepo relative path. tsx 신규 devDep 추가 의무 (wikey-core/root/wikey-obsidian 모두 tsx 0건, `tools/qmd` 만 사용 — 즉 *기존 패턴 mirror 아님*). master Step A3 안 잠금. | AC-B3 |
| 6 | ~~YAML dep 추가~~ → **v1.1 해결**: JSON 채택으로 dep 0 | RESOLVED | — | **v1.2 fix (사용자 결정 2026-05-10)**: `benchmark-suite.yaml` → `benchmark-suite.json` 변경. Node native `JSON.parse` 사용. yaml devDep 0 — Karpathy Simplicity #1 (200줄→50줄 mirror). 본 risk RESOLVED. | (resolved) |
| 7 | 사용자 결정 #1 (stopword list) 미응답 → spec drift | MED | LOW (master 가 spec 안 명시 → 사용자 응답 의무) | `[사용자 결정]` 마커 명시 + 본 spec entry 의 default 권고 + Step A1 안 결정 잠금 의무 + 미응답 시 master 가 사용자 prompt | (구조 risk) |
| 8 | 본 cycle 변경이 ingest path 영향 — stopword 추가 시 indexing token 도 변경 → 기존 인덱스 stale (token 안 들어 있던 단어가 retrieve fail) | MED | HIGH (확실) | 본 spec §0 fronmatter 의 wiki 재생성 없음 확증 = wiki 본문 변경 0. 단 indexing 의무 — master 가 Step C 라이브 smoke 직전 fresh `./scripts/reindex.sh` 실행 의무 (todox §4 Step C 안 명시). 사용자 가 본 cycle 통합 후 기존 vault 에 fresh reindex 1회 의무 (README 또는 commit body 안 안내). | AC-B3 (fresh reindex 후 측정), AC-Q1 |

## 7. Dependencies

본 §5.7.6 의 진입 조건 + 후속 cycle 순서:

### 7.1 진입 조건 (충족 의무)

- [x] §5.7.5 GREEN cycle 종결 (Session 31, 2026-05-09, 7 commits, codex 6 cycle APPROVE, AC 22/22 PASS) — Orama backend stable + Kiwi WASM stable + scripts/check-* 작동
- [x] PoC §3 baseline 결과 보존 (`activity/phase-5-resultx-5.7.3-orama-poc-2026-05-09.md`) — Q5 회귀 evidence + 10 query baseline
- [x] §5.7.5 LOW #5 사용자 결정 #4 잠금 — code lowercase 유지 (Python 측 lowercase 미적용 = 본 §5.7.6 scope 외, stopword 추가만 mirror)
- [ ] **[사용자 결정 의뢰 §1.3]** stopword list 정확도 평가 (Step A1 의무) — 본 spec 의 implementation scope 일부가 사용자 결정에 의존

### 7.2 후속 cycle 순서

본 §5.7.6 종결 후 진행 순서 (사용자 우선순위 결정 필요):

1. **§5.5 지식 그래프 · 시각화** (P3) — NetworkX + Leiden + vis.js / Obsidian Graph View
2. **§5.6 성능·엔진 확장** (P3) — Ollama vs llama.cpp / rapidocr Linux baseline
3. **§5.7.7 HYBRID Stage 2 vector reroute** (신설 후보) — Qwen3-Embedding 768D 통합 + Orama hybrid mode
4. **§5.8 Phase 4 D.0.l 잔여** (P4)
5. **§5.9 Variance diagnostic** (P4)

본 §5.7.6 가 §5.5 / §5.6 의 *진입 조건* 은 아님 — 독립 진행 가능. §5.7.7 (HYBRID) 은 본 §5.7.6 의 자연 후속 (검색 quality 영역 연속).

## 8. Self-check (master-validation skill 23-anchor — Layer 1 7-anchor + Layer 2 6 codex 패턴 P1~P6 + Layer 3 7 fix 모드 F1~F7 + Layer 4 4 R 코드 영역 + wikey override h/i/j)

본 spec v1 의 self-check (master 가 codex 송부 전 1차 grep 의무):

### 8.1 Layer 1 — 7-anchor (rules.md §10)

| # | Anchor | 결과 | 검증 명령 |
|---|--------|------|-----------|
| (a) | 시그니처 일관성 — `KOREAN_STOPWORDS` / `smart_tokenize` / `_smart_tokenize` / `benchmark-suite.json` / `benchmark:search` / `runBenchmark` / `QueryEntry` / `QueryResult` 본문 cross-section 동일 | PASS_v1.2 — §3.1 + §3.2 + §3.3 + §3.4 + §3.5 + §5 모두 일관 | `grep -nE "KOREAN_STOPWORDS\|benchmark-suite\.yaml\|benchmark:search\|runBenchmark" plan/phase-5-spec-5.7.6-search-quality-tuning.md` |
| (b) | state/data 표 형식 — 6 입력 항목 검증 표 + §5 AC numbering (총 8 = 5 단위 + 2 통합 + 1 라이브) 일관 | PASS_v1.2 — count drift 0, 모든 AC 가 §5 정의 + §6 Risk + §3 변경 영역 1:1 매핑 | `grep -cE "^\| \*\*AC-" plan/phase-5-spec-5.7.6-search-quality-tuning.md` ≥ 8 |
| (c) | builder/parser 분기 — `_smart_tokenize` 안 stopword early continue + ALNUM_TOKEN_RE branch 의 stopword 분기 제외 + Python mirror 의 동등 분기 모두 명시 | PASS_v1.2 — §3.1 + §3.2 + AC-S2 모두 명시 | grep `"early continue"` + `"ALNUM_TOKEN_RE"` |
| (d) | AC ↔ §1 목표 1:1 매핑 | PASS_v1.2 — 목표 3항 → AC-S1, AC-S2, AC-S3 (sub-목표 1 C1) / AC-B1, AC-B2, AC-B3 (sub-목표 2 C2) / AC-Q1 (sub-목표 3 검증) / AC-R1 (회귀 invariant) | line-by-line 검증 |
| (e) | self-check 모든 행 drift 없음 — v1 작성 직후 stale 0 본문 한정 (변경 이력 의도적 보존) | PASS_v1.2 — v1 작성 직후 stale 0 | (본 §8 line read) |
| (f) | footer + version + 변경 이력 — frontmatter `version: v1` (exact match, prefix match 회피) ↔ §9 변경 이력 마지막 row v1 ↔ footer (cycle 미진입) 일관 | PASS_v1.2 | `grep -nE "^version: v1$"` exact match |
| (g) | 코드 ↔ test exact phrase — `KOREAN_STOPWORDS` (TS+Py) / `프로젝트` / `관리` / `정보` / `시스템` / `업무` (default 5 단어) / `benchmark-suite.json` / `benchmark:search` / `WIKEY_BENCHMARK_TOP1_MIN` / `WIKEY_BENCHMARK_TOP3_MIN` AC 내 일치 | PASS_v1.2 | `grep -F "KOREAN_STOPWORDS"` + `grep -F "benchmark-suite.json"` + `grep -F "benchmark:search"` 양쪽 hit |

### 8.2 Layer 2 — 6 codex 패턴 P1~P6

| Pattern | 결과 (analyst v1 작성 직후) |
|---------|---------------------------|
| **P1 Fact-check** | §2 의 grep 직접 read 확증 — `wikey-core/src/search/orama-korean-tokenizer.ts:128~145` `tokenize` arrow fn / `scripts/korean-tokenize.py:66~97` `_smart_tokenize` / PoC §3 Q5 evidence (`activity/phase-5-resultx-5.7.3-orama-poc-2026-05-09.md`). `wikey-core/eval/` 디렉토리 부재 — 신규 생성 의무 (Step A3 master fact-check). line number 의 micro drift 가능 — 구현 시 재검증 의무. |
| **P2 Cross-file consistency** | §3.1 (TS) + §3.2 (Python) 의 `KOREAN_STOPWORDS` 5 단어 literal mirror (v1.2) — exact set `{프로젝트, 관리, 정보, 시스템, 업무}` 양쪽 동등. §3.3 suite 의 `pmbok-q1` query "프로젝트 일정 관리" + expected_top1 `project-schedule-management` ↔ §1.1 의 Q5 evidence cross-reference. §5 AC ↔ §6 Risk ↔ §3 변경 영역 1:1 매핑. |
| **P3 Spec→Todo byte mirror** | spec v1 작성 후 todox v1 가 본 spec 의 §1.2 비목표 / §4 검증 표 / §5 AC count / `[사용자 결정]` 1건 byte-level mirror 의무 — todox 작성 시 동일 anchor + 동일 count + 동일 항목명 사용. exact phrase mirror = `KOREAN_STOPWORDS` / `benchmark-suite.json` / `benchmark:search` / `프로젝트` / `관리` / `일정` / `pmbok-q1` / `project-schedule-management` 양쪽 hit 확증. |
| **P4 Implementation feasibility** | smart_tokenize stopword 분기 = `if (KOREAN_STOPWORDS.has(lowered)) continue` 1 줄 — feasible. Python `_smart_tokenize` 안 동등 — feasible. YAML suite parse = `yaml` npm dep (devDep) — feasible. benchmark script `runBenchmark(suitePath)` = OramaHandle 의 기존 search API 사용 — feasible (구현 시 import path fact-check). npm script `tsx ../scripts/benchmark-search.ts` = wikey-core 기존 script 패턴 mirror (Step A3 fact-check). |
| **P5 Legal accuracy** | 본 spec 의 license 영역 변경 0. 신규 dep `yaml` 추가 시 NOTICE 갱신 + `scripts/check-licenses.sh` 실행 의무 (todox Step B3 안 명시). yaml npm package = MIT (확인 의무, Step A3). |
| **P6 Numeric consistency** | `grep -cE "^\| \*\*AC-"` ≥ **8** (5.1 = 5 + 5.2 = 2 + 5.3 = 1 = 8). §4.3 합계 = **2 + 1 + 3 = 6** 입력. §1.3 사용자 결정 1건. 본 cycle 안 실 작업 = **2** (C1 + C2 통합). 모든 count §8 self-check 와 일치. LOC 추정 = TS ~15 + Python ~7 + YAML suite ~200 + script ~100 + npm script 1 ≈ **~373 LOC** + test ~150 (v1.2) LOC. |

### 8.3 Layer 3 — 7 fix 모드 F1~F7

| # | 실패 모드 | 본 v1 작성 직후 결과 |
|---|---------|-------------------|
| **F1 Partial replacement** | 본 v1 = analyst 작성 — replace_all 누락 risk 0. master fix loop 진입 시 의무. |
| **F2 Cascading rename incomplete** | 본 v1 = rename 0 (신규 작성). |
| **F3 Header/Body mismatch** | §5 헤더 "총 8 개" ↔ §5.1 5 + §5.2 2 + §5.3 1 = 8 일치. §4.3 헤더 "6 입력" ↔ 2 + 1 + 3 = 6 일치. |
| **F4 Spec→Todo mirror 누락** | 본 v1 작성 직후 — todox v1 가 본 spec 의 모든 reference mirror 의무. |
| **F5 History context 와 활성 본문 혼동** | §9 변경 이력 = v1 만 — historical 표현 0. |
| **F6 Implementation feasibility 미검증** | P4 와 동일. |
| **F7 Codex 권고 over-literal 적용** | 본 v1 = codex finding 0 (cycle 미진입). |

### 8.4 Layer 4 — 4 R 코드 영역 (본 spec 적용 영역)

| # | R 항목 | 본 v1 적용 결과 |
|---|---------|----------------|
| **R1 CJS bundle vs ESM** | 본 cycle 의 변경 면 = wikey-core (ESM) + Python script + scripts/ (Node ESM via tsx). bundle 영향 = stopword 5 단어 추가 = ~50 bytes plugin main.js 영향. **N/A (negligible)**. |
| **R2 ESM CLI** | **v1.2 fix**: benchmark-search.ts = `tsx scripts/benchmark-search.ts` 진입. **tsx 신규 devDep 추가 의무** (wikey-core/root/wikey-obsidian 모두 0건 — `tools/qmd` 만 사용. 즉 *기존 패턴 mirror 아님*). import path = `../wikey-core/src/search/orama-index.js` (monorepo relative, reindex.ts 패턴 mirror). Step A3 잠금. |
| **R3 Test isolation** | **v1.2 fix**: 신규 unit test (AC-S1/S2/S3/B1/B2) = vitest **node env** (`wikey-core/vitest.config.ts` confirmed: `environment` 미명시 = 기본 node, jsdom 미사용). DOM 의존 0 — node env 충분. integration test (AC-B3) = real Orama index — Step C master 직접 실행. |
| **R4 Same-process** | benchmark script = same-process 안 Orama load + search. master 직접 실행 (Step C). `disposeOramaIndex()` + `tokenizer.close()` cleanup 의무 — singleton leak 회피 (v1.1 §3.4 sample 안 명시). cross-process 영향 0. |

### 8.5 wikey analyst override anchor (h, i, j) — wikey project specialization (CLAUDE.md §1)

| # | Anchor | 결과 | 검증 명령 |
|---|--------|------|-----------|
| **(h) schema 4 원칙 일치** | Explicit / Yours / File over app / BYOAI 4 원칙 충돌 0 | PASS_v1.2 — (Explicit) stopword list literal in code + benchmark suite JSON 가 검색 quality 의 "AI 가 무엇을 알고 모르는지" 가시화 / (Yours) 모든 dep / data 가 wikey 안 local — 외부 SaaS 의존 0 / (File over app) benchmark suite JSON + 결과 console log 모두 marker file / (BYOAI) 본 cycle 변경이 LLM provider 영향 0 (검색 코어 query path tokenizer 만 변경, BYOAI 자유 보존) | wikey.schema.md §"LLM Wiki 개인화의 4가지 장점" cross-check |
| **(i) 3계층 경계 준수** | raw / wiki / schema 권한 위반 0 | PASS_v1.2 — 변경 면 = `wikey-core/src/search/orama-korean-tokenizer.ts` + `scripts/korean-tokenize.py` + `wikey-core/eval/benchmark-suite.json` (신규) + `scripts/benchmark-search.ts` (신규) + `wikey-core/package.json` 1 줄. raw/ 변경 0, wiki/ 변경 0, wikey.schema.md 변경 0 (schema 의 검색 코어 표현 변경 0 — Orama default + Kiwi WASM 표현 그대로). | grep `"raw/"` 변경 0 + grep `"wiki/"` 변경 0 |
| **(j) 워크플로우 4 일관** | ingest / query / lint / 삭제·수정 흐름 schema 정의 일치 | PASS_v1.2 — 본 spec 의 변경이 4 워크플로우 *동작* 일치: (ingest) smart_tokenize 의 stopword 추가 = indexing 시 token 변경 = 자연 인덱스 갱신 (master 의 fresh `./scripts/reindex.sh` 실행 의무, todox Step C 안 명시). schema §"인제스트 분할 전략" + §"검색 코어의 안정성" 의 invariant 보존. (query) tokenize_for_query path 가 stopword drop = query 시 generic word 제거 = BM25 신호 specific 단어 집중 = schema §"LLM 참여형 다층 검색" 의 "후보 수집" 단계 정확도 향상. (lint / 삭제·수정) 변경 0. | wikey.schema.md §"시스템 워크플로우" + §"검색 코어의 안정성" cross-check |

## 9. 변경 이력

| 버전 | 일시 | 변경 |
|------|------|------|
| **v1** | 2026-05-10 session 32 (analyst 작성) | 초안 — §5.7.5 종결 후 deferred quality tuning 영역의 minimal scope 진입. C1 (Q5 stopword 보완) + C2 (50+ query suite + benchmark 자동화 BENCH-AUTO 통합) 만 포함. HYBRID Stage 2 vector reroute = §5.7.7 후보, B3/B5/B6 = 미진행 (사용자 결정 2026-05-10 = 수동 update 절차). spec 6요소 (Goal / Inputs / Outputs / Invariants / AC / Out-of-Scope / Dependencies) 정의. AC 8 (단위 5 + 통합 2 + 라이브 1). Risk 8건. 사용자 결정 의뢰 1건 (`[사용자 결정]` 마커 — stopword list 정확도 평가). Karpathy 4원칙 cross-check + master-validation 23-anchor self-check (Layer 1 + Layer 2 + Layer 3 + Layer 4 + wikey override h/i/j). master fix / codex cycle 미진입 — v1 = analyst 작성 직후 상태. |
| **v1.1** | 2026-05-10 session 32 (master 1차 검증 fix) | master-validation skill 1차 검증 = NEEDS_FIX (1 HIGH + 3 MED + 2 LOW + 1 권고). 모든 finding master 직접 fix: (H1) §3.4 import path `loadOramaIndex` 부재 → `createOramaIndex({ cachePath, tokenizer })` + `defaultOramaCachePath` + `disposeOramaIndex` (singleton) + `createKoreanTokenizer` (Kiwi WASM init) 패턴 mirror (`wikey-core/src/scripts/reindex.ts:17~18` 검증). (M1) tsx 신규 devDep 추가 의무 명시 (wikey-core/root/wikey-obsidian 모두 0건 fact-check). (M2) benchmark-search.ts sample 에 Kiwi init + dispose cleanup 절차 추가 (~20 LOC). (M3) §8.4 R3 "vitest jsdom" → "vitest node env" (`wikey-core/vitest.config.ts` environment 0 확인). (L1) yaml license 추정 → JSON 변경으로 자연 해결. (L2) line range "128~145" → "~125~145" micro drift 정정. **(R1) YAML → JSON** (사용자 결정 2026-05-10): `benchmark-suite.yaml` → `benchmark-suite.json`, Node native `JSON.parse`, yaml devDep 0, Karpathy Simplicity #1. AC-B1 + Risk #6 + script body + footer LOC ~120 (v1 ~100 + Kiwi init ~20) 모두 byte mirror sweep. master-validation 23-anchor 재검증 PASS. codex Mode D Panel cycle 미진입. |

---

> **footer (cycle 추적)**: §5.7.6 spec **v1.2** 작성 완료 (master 1차 검증 fix, 2026-05-10 session 32). codex Mode D Panel cycle 미진입 (v1.1 직후 송부 예정). 다음 단계 = codex Mode D Panel cycle #1 (plan review v1.1) → 사용자 명시 = 승인 게이트 skip + 본 세션 안 종결 → todox v1.1 mirror → SDD+TDD 구현.
>
> Self-check: master-validation 23-anchor PASS_v1.2 / 4-question 6항 PASS / Karpathy 4원칙 cross-check OK / 변경 면 ≤ 5 file ≤ ~343 LOC (v1.1 = ~323 + Kiwi init ~20) + test ~150 / AC ≥ 8 / dep 추가 = tsx (신규 devDep) only — yaml dep RESOLVED (JSON 채택)
