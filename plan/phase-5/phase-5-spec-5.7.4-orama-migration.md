---
phase: 5
section: 5.7.4
title: Orama 마이그레이션 — qmd CLI 대체 (Spec)
status: planning
created: 2026-05-09
updated: 2026-05-09
version: v8
---

# Phase 5 §5.7.4 Orama 마이그레이션 — qmd CLI 대체 (Spec, WHAT)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.7.4`](./phase-5-todo.md) (실행 단일 소스, 체크박스) · [`activity/phase-5/phase-5-resultx-5.7.3-orama-poc-2026-05-09.md`](../../activity/phase-5/phase-5-resultx-5.7.3-orama-poc-2026-05-09.md) (PoC 4 단계 evidence + 7 dimension 비교) · [`plan/phase-5/phase-5-todox-5.7.4-orama-migration.md`](./phase-5-todox-5.7.4-orama-migration.md) (Todo, HOW — mirror)
>
> **버전 이력**:
> - v1 (2026-05-09 session 28, 초안): PoC §7 의 26 todo 후보 (A1~A9 / B1~B6 / C1~C6 / D1~D5) 4-question 검증 + 삼지선다 분류.
> - **v2 (2026-05-09 session 28, codex cycle #1 NEEDS_REVISION fix)**: 4 HIGH + 5 MED + 3 LOW 직접 fix. (HIGH-1) `query()` 최상단 engine 판정 + qmd 탐색 조건부 (§3.4 정정). (HIGH-2) `WIKEY_SEARCH_ENGINE` plugin config bridge 명시 — `wikey-obsidian/src/main.ts:513` (`loadFromWikeyConf`) + `:641` (`buildConfig`) 변경 + `process.env` override 우선순위 (§3.3.1 신규). (HIGH-3) `ReindexOptions.searchEngine` + `scripts-runner.ts:36` engine bridge (§3.5.1 신규). (HIGH-4) Kiwi WASM binary **Option A — esbuild plugin asset copy** (§3.7 신규, 사용자 결정 2026-05-09). (MED-1) AC count 16→23 정정 + AC-S1 §5.1 추가. (MED-2) AC-I2 (a)/(b) 분리. (MED-3) AC-Q5 신규 (production query path). (MED-4) AC-L2 search-only 명시. (MED-5) §1.2 D 그룹 표현 정정. (LOW) quality 회귀 표현 + exact phrase 일치.
> - **v3 (2026-05-09 session 28, 사용자 raise — kiwi-nlp 코드 내재화 정합성)**: 사용자 본질 raise — "wiki-npl을 binary타입으로 사용? 아니면 코드 내재화? trade-off 분석. 원래 목적은 코드 내재화인데?" 본 cycle motivation §5.7.2 통찰 ("내재화 = 직접 customize 가능") 와 정합 위해 **B 옵션 (부분 vendor) 채택**. (1) §3.8 신규 — kiwi-nlp 소스 ~3K LOC `wikey-core/vendor/kiwi-nlp/` 으로 vendor (npm dep 제거). (2) AC-V2 신규 — vendor import path + sync 절차 docs 검증. (3) §1.2 B 그룹 항목 수정 — kiwi-nlp source upstream sync 추가 (B7) + Orama (B1~B6) 와 함께 별 spec `phase-5-todox-5.7.5-orama-update-sync.md` 으로 deferral 재명시. (4) 본 §5.7.4 안에서는 vendor 1회 + 수동 sync 절차 docs 1 페이지 (`docs/kiwi-nlp-vendor-sync.md`) 까지만 — 자동화 (cron / npm outdated / regression 검증) §5.7.5 별 spec.
> - **v6 (2026-05-09 session 28, codex cycle #4 NEEDS_REVISION fix)**: 2 HIGH + 3 MED + 2 LOW 직접 fix. (HIGH-1 fact-check) WASM binary path 단일화 — npm package fact-check 결과 wasm = `dist/kiwi-wasm.wasm` (dist root, NOT dist/build/). vendor 안 mirror = `dist/kiwi-wasm.wasm` (npm 동일 위치). esbuild copy source + AC-V2 + §3.7 모두 `dist/kiwi-wasm.wasm` 으로 통일. JS wrapper canonical (`dist/build/kiwi-wasm.js`) 와 분리 명시. (HIGH-2 todo NOTICE mirror) todo Step D-LICENSE NOTICE 양식을 spec AC-D2 의 6 항목 byte-level mirror. (MED-1) todo line 184 `AC 16 매핑` → `AC 28 매핑`. (MED-2) sync docs primary 절차 = `bab2min/Kiwi` git tag + `bindings/wasm/package/` subdir diff + 본가 root LICENSE diff 중심, npm version 확인은 보조. (MED-3) vendor build 절차에 `package-lock.json` 존재 여부 분기 추가 — 있으면 `npm ci`, 없으면 `npm install` (lock 없는 sparse subdir 안전). AC-V2 보강. (LOW-1) spec line 302 stale `main.ts:461 = plugin reindex command 호출 site` → line 309 양식 mirror. (LOW-2) spec line 667 self-check "본 spec v4" → "본 spec v6" 정정.
> - **v5 (2026-05-09 session 28, codex cycle #3 NEEDS_REVISION fix)**: 3 HIGH + 2 MED + 1 LOW 직접 fix. (HIGH-1 fact-check) `kiwi-nlp@0.23.0` 의 npm `repository` 필드 = `https://github.com/bab2min/Kiwi.git` (대문자 K, Kiwi 본가) 확증. v4 의 `bab2min/kiwi-nlp` archive URL 부정확. v5 vendor 절차 = **`bab2min/Kiwi` git tag archive 의 `bindings/wasm/package/` subdir** 추출 + Kiwi 본가 root `LICENSE` 별 fetch (sparse vendor 패턴). (HIGH-2 import path) AC-V2 + §3.8 vendor 표의 import path = PoC canonical `dist/build/kiwi-wasm.js` (commands.ts:112 / 269 default export 보존) 으로 고정. `dist/index.js` 표기 폐기 (`KiwiBuilder.create(wasmPath)` 계층은 Electron file:// 함정 path). (HIGH-3 wasm relink) AC-D2 NOTICE 양식 + LGPL §6 표 보강 — `kiwi-wasm.wasm` 의 C++ source = `bab2min/Kiwi` repo root + Emscripten build pipeline + `bindings/wasm/build.sh` 절차 reference. wasm 자체 modification 시 사용자 외부 build 의무 (vendor scope 외, 절차 명시). (MED-1) todo §2 / §3 B1 / §5 self-check 의 "16 AC" / "spec v3 의 24 AC" / "PASS_v3" 잔재 → v4/28 AC / PASS_v8 일괄 정정. v5 에서 v5/28 AC / PASS_v8 갱신. (MED-2) spec §2 line 79 의 `wikey-core deps = @orama/orama + kiwi-nlp` stale 정정 — v3+v4 vendor 결정으로 `wikey-core deps = @orama/orama 만`, `kiwi-nlp` 는 vendor import 경유. (LOW) spec §3.5.1 의 `main.ts:461` call site 표기 정확화 — `main.ts:461` = `getExecEnv()` 자체, 실 reindex 호출 site = `wikey-obsidian/src/settings-tab.ts:943` (settings UI) + `wikey-obsidian/src/commands.ts:1001` (ingest 후 quick reindex).
> - **v4 (2026-05-09 session 28, codex cycle #2 NEEDS_REVISION fix)**: 3 HIGH + 3 MED 직접 fix. (HIGH-A) §3.7 esbuild copy source path 를 vendor path 로 고정 + PoC code (commands.ts:96~522) 의 npm 경로 의존성은 *PoC cleanup 시점까지 잠정 보존* 명시 (Karpathy Surgical, production query path 와 분리). (HIGH-B) **사용자 결정 = B-2 (upstream git source archive vendor)** — `npm pack` 절차 폐기, `bab2min/kiwi-nlp` GitHub git tag v0.23.0 archive 사용 (src TS + LICENSE + tsconfig + package.json + 빌드 스크립트 모두 포함). vendor 후 `cd vendor/kiwi-nlp && npm ci && npm run build` 으로 dist 생성. AC-V2 보강. (HIGH-C) NOTICE 양식 확장 — `vendor/kiwi-nlp/LICENSE` (LGPL-2.1 copy) + modification notice + rebuild 절차 (LGPL §6 의무 충족 path) 명시. `~/.cache/wikey/kiwi-models/` 는 dictionary cache 만 (LGPL relink 와 별개) 명시. AC-D2 보강. (MED-1) AC count 단일화 — 실제 bold row 28 (§5.1=18 + §5.2=7 + §5.3=3) 으로 spec/todo/self-check 모두 일관. (MED-2) §3.5.1 보강 — scripts-runner public API (`reindexWiki/reindexQuick(basePath, env)`) + plugin reindex 호출 site (main.ts:461) + `getExecEnv()` 의 `WIKEY_SEARCH_ENGINE` env 주입 정확 path. (MED-3) §4.2 B 그룹 6→7 (B7 추가) + §4.5 deferral 11→12 갱신.
>
> **wiki 재생성 없음 확증**: 본 §5.7.4 는 검색 backend 교체 (qmd CLI → Orama in-process). wiki 본문 / frontmatter / 페이지 자체 변경 0. ingest pipeline 의 *결과* (생성·수정되는 wiki 페이지) 는 §5.10.4 D-wide 정책 그대로 — canonicalizer / mention extractor 변경 없음. 검색·인덱싱 레이어만 swap.

## 1. 목표 / 비목표

### 1.1 목표 (v1 범위)

1. **qmd CLI subprocess → Orama in-process 검색** — `wikey-core/src/query-pipeline.ts::execQmdSearch` 의 `execFile('qmd', [...])` 호출을 `@orama/orama` 의 in-process `search()` 호출로 교체. spawn overhead 제거 (PoC 측정 1.22s → 0.2ms, 6,000배+).
2. **Kiwi WASM Korean tokenizer 의 wikey-core 이전** — 현재 `scripts/korean-tokenize.py` (kiwipiepy + Python interpreter) 가 query path 와 build-time index path 양쪽에서 호출되고 있음. **query path 만** Kiwi WASM (in-process sync `tokenize`) 로 교체. build-time path (`scripts/korean-tokenize.py --batch`, `scripts/contextual-retrieval.py`) 는 그대로 유지 (Karpathy Surgical — 영향 면 최소화).
3. **`WIKEY_SEARCH_ENGINE` 신규 config 키 도입 (feature flag toggle)** — 기존 `WIKEY_SEARCH_BACKEND` (`'basic'`/`'gemma4'`, LLM 합성 layer 분기, `wikey-core/src/types.ts:30`) 와 의미 충돌 회피 위해 *별 키 신규 추가*. 신규 `WIKEY_SEARCH_ENGINE: 'orama' | 'qmd'` (default = `'orama'` post-§5.7.4). 사용자가 회귀 필요 시 `WIKEY_SEARCH_ENGINE=qmd` 로 toggle 가능. 상세는 §3.3 + AC-F1 참조.
4. **회귀 안전망 3 layer** — (a) git revert (코드 단위), (b) `tools/qmd/` vendored 보존 (qmd backend 운영 fallback), (c) `WIKEY_SEARCH_ENGINE` runtime flag toggle.
5. **검색 quality 회귀 0 (Q5 의도적 수용 외)** — PoC 단계 3 의 10 query benchmark 결과: Orama Top-1 8/10 vs qmd 7-8/10. Q4 (ITIL) / Q10 (Obsidian) 회복 +2 / Q5 (프로젝트 일정 관리) 회귀 -1. **순 +1 query 우수, Q5 회귀는 §5.7.4-C1 (smart_tokenize 정밀화) 로 별 cycle 보완**.
6. **Latency 회귀 0** — warm p50 1.22s → 0ms (PoC 실측). cold first query (Kiwi WASM init 1.2s) 는 plugin load 시 1회만 발생, 사용자 첫 query 체감은 PoC 단계에서 검증 의무.

### 1.2 비목표 (out of scope, v1 — 별 cycle 또는 후속 spec 으로 deferral)

다음 항목은 본 §5.7.4 의 invariant / AC 와 *직접 연결되지 않으며* Karpathy Simplicity 원칙상 분리가 합리:

- **B1~B7: upstream update 동기화 프로세스 자동화** — 본 §5.7.4 는 마이그레이션 *코드* 작업. 다음 7 항목은 *마이그레이션 후 운영 정책* 으로 별 spec `phase-5-todox-5.7.5-orama-update-sync.md` 으로 deferral:
  - B1 Orama (`@orama/orama` npm) update monitor (npm outdated / GitHub release atom)
  - B2 Orama update 반영 프로토콜 (patch / minor / major 분기)
  - B3 Regression 검증 자동화 (매 update 후 quality benchmark + smoke 자동)
  - B4 Kiwi 사전 (cong/base 모델, 104MB) update 추적 (Kiwi 본가 release v0.23.x)
  - B5 Update sync 프로세스 docs 자동 갱신
  - B6 Notification (GitHub watch + workflow → 사용자 / master notify)
  - **B7 (사용자 raise 2026-05-09 v3 추가, v5 fact-check) kiwi-nlp source vendor upstream sync** — `wikey-core/vendor/kiwi-nlp/` (B-2 옵션 §3.8 v5) 가 vendor 됐으므로 upstream `bab2min/Kiwi` (대문자 K, Kiwi 본가) 의 `bindings/wasm/package/` subdir 변경 시 wikey 수정 분과 diff 분석 + cherry-pick 의무. 본 §5.7.4 는 *vendor 1회 + 수동 sync 절차 docs* (`docs/kiwi-nlp-vendor-sync.md`, ~50 줄) 까지만 (AC-V2). 자동화 (Kiwi git tag 감지 + bindings/wasm/package diff 보고 + 사용자 review queue) §5.7.5.

  Karpathy 4 원칙 #2 (Simplicity First, "요청되지 않은 기능 추가 금지") 적용 — 본 cycle 은 *vendor 도입 + 수동 절차* 까지, 자동화는 분리 cycle.
- **C2: 50~100 query 확장 benchmark** — 본 §5.7.4 의 quality AC (AC-Q3) 는 PoC 의 10 query 결과를 회귀 기준으로 사용. sample size 확장은 statistical power 별 cycle (`phase-5-todox-5.7.6-search-quality-benchmark.md`) — 본 cycle 안에서 50~100 sample 진행은 timeline 압박 (3~5일 예상 마이그레이션 + benchmark 별 1~2일 추가 = 일정 risk).
- **D1~D5 의 *5 step 별 작업화*** — D1~D5 는 *5 개별 commit / 5 step 진행* 형태가 비목표. 단 **LGPL-2.1 최소 준수 (LICENSE + NOTICE + README `## Third-party software` 섹션) 는 본 cycle 안 1 step 으로 포함** (AC-D2). 사용자 결정 2026-05-09 (Kiwi 소스 명시 + GitHub public) 이행. repository public 확증 (D4) + relink 보장 (D5 — 이미 PoC 검증) 은 NOTICE 안 sub-bullet 으로 통합.
- **검색 quality benchmark 의 자동화 통합** — 본 §5.7.4 는 *수동 1회 실측* (master 직접 obsidian-cdp + 기존 PoC benchmark command 재실행). 자동화 (`npm run benchmark:search`) 는 별 cycle.
- **wikey.conf qmd 키 전체 deprecate (C5)** — 본 cycle 은 `WIKEY_SEARCH_ENGINE` flag 신규 1개만 추가. `WIKEY_QMD_TOP_N` 등은 Orama backend 도 동일 의미로 사용 (top N 결과 수). naming alias `WIKEY_SEARCH_TOP_N` 도입은 별 cycle (C5 deferral).
- **`wikey-obsidian/src/env-detect.ts` qmd 의존 제거 (C6)** — feature flag 가 default `orama` 라도 qmd backend toggle 시 `findQmdBin` 이 동작해야 함 (회귀 path). 본 cycle 은 detect 보존, 정리는 별 cycle.
- **PoC 3 command 정리** — `wikey-poc-orama-test` / `wikey-poc-kiwi-orama` / `wikey-poc-orama-benchmark` 3 command 는 *마이그레이션 검증 후* 까지 보존 (사용자 결정 2026-05-09). 정리 결정은 §5.7.4 종결 시점에 master 가 사용자 confirm 후 cleanup commit.
- **Stage 2 hybrid search (BM25 + 벡터 RRF) full reroute** — 본 §5.7.4 는 BM25-only 1차 마이그레이션 (PoC benchmark 와 동일 mode). hybrid 모드 + Qwen3 768D 통합은 §5.7.4-C4 별 sub-cycle (본 cycle AC-V1 안에서 *벡터 column 호환 가능성 검증* 만 수행, 실 호출 라인 reroute X).

## 2. 현재 코드 사실 (analyst 직접 확인)

| 항목 | 위치 | 현재 상태 |
|---|---|---|
| qmd CLI 검색 호출 (query path) | `wikey-core/src/query-pipeline.ts:299-354` (`execQmdSearch`) | `execFile('qmd', ['query', multiQuery, '--json', '-n', topN, '-c', 'wikey-wiki'])` + JSON 파싱 |
| 멀티라인 query format | `wikey-core/src/query-pipeline.ts:319-329` | `lex: <한글처리>\nvec: <vecQuestion>\nlex: <englishKeywords>` (cross-lingual) |
| 한국어 query preprocess (subprocess) | `wikey-core/src/query-pipeline.ts:311 / 569-593` (`tryKoreanPreprocess`) | `python3 scripts/korean-tokenize.py --mode query` spawn (stdin/stdout) |
| qmd binary 탐색 | `wikey-core/src/query-pipeline.ts:632-666` (`findQmdBin`) | `tools/qmd/dist/cli/qmd.js` (1순위) → `config.QMD_PATH` (2순위) → `tools/qmd/bin/qmd` (3순위) |
| qmd 결과 파싱 | `wikey-core/src/query-pipeline.ts:356-376` (`parseQmdOutput`) | `[{file, score, snippet}]` → `[{path, score, snippet}]` (path = `wiki/...`) |
| qmd CLI 인덱싱 (build-time) | `wikey-core/src/scripts/reindex.ts:281-302` (`runQmdUpdate`) | `qmd update` (BM25 인덱스) |
| qmd CLI 임베딩 (build-time) | `wikey-core/src/scripts/reindex.ts:304-328` (`runQmdEmbed`) | `qmd embed` (Qwen3-Embedding 768D 벡터) |
| Contextual Retrieval (Gemma 4) | `wikey-core/src/scripts/reindex.ts:340-366` (`runContextualRetrieval`) | `python3 scripts/contextual-retrieval.py --batch` |
| 한국어 형태소 build-time | `wikey-core/src/scripts/reindex.ts:368-391` (`runKoreanTokenize`) | `python3 scripts/korean-tokenize.py --batch` |
| reindex 메인 pipeline | `wikey-core/src/scripts/reindex.ts:393-465` (`cmdReindex`) | Step 1 update → 2 embed → 3 CR → 4 형태소 → 5 validate (full) / quick = 1+2 만 |
| 인덱스 데이터 위치 | `wikey-core/src/scripts/reindex.ts:114-116` | `~/.cache/qmd/index.sqlite` (FTS5 + content_vectors 768D) |
| 인덱스 freshness stamp | `wikey-core/src/scripts/reindex.ts:110-112` | `~/.cache/qmd/.last-reindex` (mtime) |
| Contextual cache | `~/.cache/qmd/contextual-prefixes.json` | Gemma 4 prefix 50~100 토큰 |
| Config 단일 소스 | `wikey-core/src/types.ts:28-75` (`WikeyConfig`) | `WIKEY_SEARCH_BACKEND: string` 이미 존재 (line 30, default `'basic'` from `config.ts:13`) — 의미만 재정의 필요 |
| Config defaults | `wikey-core/src/config.ts:13-15` | `WIKEY_SEARCH_BACKEND: 'basic'` / `WIKEY_QMD_TOP_N: 8` |
| PoC code (revert 대상 X — 마이그레이션 base) | `wikey-obsidian/src/commands.ts:96-522` (3 command) + deps `@orama/orama@^3.1.18` / `kiwi-nlp@^0.23.0` | 보존 — 본 cycle 코드 base |

**주의 1**: `WIKEY_SEARCH_BACKEND` config 는 이미 존재하지만 현재 의미는 *Stage 1 (`'basic'`) vs Stage 2 (`'gemma4'`)* 의 LLM 합성 layer 분기 (참조: `wikey.schema.md` 의 검색 코어 섹션 line 408~418). 본 cycle 에서는 *backend engine* (`'qmd'` / `'orama'`) 의미로 새 키 도입이 깔끔 — 명칭 충돌 회피를 위해 신규 키 `WIKEY_SEARCH_ENGINE` 채택 권고 (§3.3 + AC-F1 참조).

**주의 2** (v5 정정 — codex cycle #3 MED-2 fix): PoC code 의 Kiwi WASM 코드 (`wikey-obsidian/src/commands.ts:282-322` 의 `kiwiModule = await initKiwi(...)` + `Module.instantiateWasm` hook) 는 **wikey-obsidian** 위치. 본 cycle 의 §3.3 결정 = **wikey-core 로 이전** (마이그레이션 후 query-pipeline 이 호출하므로 wikey-core 가 ownership). v3+v4 vendor 결정에 따라 **wikey-core 의 deps 에 `@orama/orama` 만 추가** — `kiwi-nlp` 는 npm dep 가 아닌 vendor 경유 import (`from '../../vendor/kiwi-nlp/dist/build/kiwi-wasm.js'`, §3.8). wikey-obsidian/package.json 의 `kiwi-nlp` 는 PoC cleanup 시점까지 잠정 보존 (§3.7).

## 3. 데이터 모델 / 인터페이스 변경

### 3.1 신규 모듈 — `wikey-core/src/search/orama-korean-tokenizer.ts`

```ts
// wikey-core/src/search/orama-korean-tokenizer.ts (신규)

/**
 * §5.7.4 — Kiwi WASM 기반 Korean tokenizer (Orama components.tokenizer 호환).
 *
 * PoC 단계 2-B 검증 path 그대로:
 *  - Module.instantiateWasm hook + wasmBinary 직접 주입 (Electron renderer file:// 함정 회피)
 *  - sync tokenize fn (Orama 의 tokenize 인터페이스 강제)
 *  - smart_tokenize: alphanumeric (BM25, ISO 등) 보존 + 한글 content POS 필터
 *
 * 참조: scripts/korean-tokenize.py 의 _smart_tokenize 함수 JS/TS 포팅.
 */

export interface KoreanTokenizerOptions {
  /** Kiwi WASM 바이너리 경로 (v4 vendor) — wikey-core/vendor/kiwi-nlp/dist/kiwi-wasm.wasm 또는 plugin runtime path */
  readonly wasmPath: string
  /** Kiwi 사전 디렉토리 — ~/.cache/wikey/kiwi-models/cong/base/ (lazy download 후) */
  readonly modelDir: string
}

export interface KoreanTokenizerHandle {
  /** Orama components.tokenizer 의 tokenize fn 으로 직접 주입 가능. */
  readonly tokenize: (text: string) => string[]
  /** 명시 dispose (Kiwi WASM heap free). */
  readonly close: () => void
}

export async function createKoreanTokenizer(
  opts: KoreanTokenizerOptions,
): Promise<KoreanTokenizerHandle>
```

**smart_tokenize 동작 명세** (PoC commands.ts:142-156 mirror):
1. 입력 text 를 공백 split.
2. 각 word 가 `^[A-Za-z0-9][A-Za-z0-9.\-_]*[A-Za-z0-9]$|^[A-Za-z0-9]$` 정규식 매치 (alphanumeric + 하이픈/언더스코어/도트) → 그대로 보존 (lowercase 적용).
3. 그 외 (한글 등) → Kiwi tokenize → POS tag 가 `CONTENT_POS = {NNG, NNP, NNB, NR, VV, VA, VX, MAG, XR, SL, SN, SH}` 인 token 만 lowercase 추가.
4. 빈 입력 / undefined → `[]` 반환.

### 3.2 신규 모듈 — `wikey-core/src/search/orama-index.ts`

```ts
// wikey-core/src/search/orama-index.ts (신규)

import type { Orama } from '@orama/orama'
import type { SearchResult } from '../types.js'

export interface OramaWikiDoc {
  readonly id: string         // wiki/ 상대 경로 (frontmatter title 별도)
  readonly title: string
  readonly body: string
  readonly embedding?: number[]   // 768D Qwen3-Embedding (벡터 ingest 시점에서 주입)
}

export interface OramaIndexHandle {
  /** Orama 인스턴스 (단일 collection 'wikey-wiki'). */
  readonly db: Orama<OramaWikiDoc>
  /** BM25 단일 또는 hybrid (벡터 포함) search. PoC §3 단계 동일 호출. */
  search(question: string, opts: { topN: number; mode?: 'fulltext' | 'hybrid' }): Promise<readonly SearchResult[]>
  /** 인덱스 파일 디스크 영속 (~/.cache/wikey/orama/wikey-wiki.json — JSON serialize). */
  persist(): Promise<void>
  /** 인덱스 파일 로드 (없으면 빈 인덱스). */
  restore(): Promise<void>
  /** 모든 wiki/*.md 를 frontmatter 파싱 + insertMultiple. */
  ingestAll(wikiDir: string): Promise<{ docCount: number; ms: number }>
}

export async function createOramaIndex(opts: {
  cachePath: string                // ~/.cache/wikey/orama/wikey-wiki.json
  tokenizer: KoreanTokenizerHandle
}): Promise<OramaIndexHandle>
```

**lifecycle 시나리오**:

| 트리거 | 호출 흐름 |
|---|---|
| Plugin onload | `createOramaIndex(...)` → `restore()` (cache 있으면 load, 없으면 empty) |
| Reindex (full) | `ingestAll(wiki/)` → `persist()` |
| Reindex (quick, mtime stale 만) | per-changed-file `db.update(doc)` 또는 `db.remove + db.insert` → `persist()` |
| Query | `search(question, { topN })` → `SearchResult[]` |
| Plugin onunload | (옵션) `persist()` 1회 추가 |

### 3.3 Config 키 추가 — `wikey-core/src/types.ts` + `config.ts`

```ts
// wikey-core/src/types.ts — line 30 부근
export interface WikeyConfig {
  ...
  /**
   * §5.7.4 — 검색 backend 엔진 선택. 기존 WIKEY_SEARCH_BACKEND ('basic'/'gemma4') 와
   * 의미 분리 — 본 키는 *index 엔진* 선택, 기존 키는 *LLM 합성 layer* 선택.
   *  - 'orama' (default post-§5.7.4): Orama in-process + Kiwi WASM tokenizer
   *  - 'qmd' (회귀): tools/qmd/ vendored CLI subprocess
   */
  readonly WIKEY_SEARCH_ENGINE?: 'orama' | 'qmd'
  ...
}
```

```ts
// wikey-core/src/config.ts — line 13 부근, defaults 추가
export const DEFAULTS: WikeyConfig = {
  ...
  WIKEY_SEARCH_BACKEND: 'basic',     // 기존 보존 (의미 변경 X)
  WIKEY_SEARCH_ENGINE: 'orama',      // §5.7.4 신규 — default = orama
  ...
}
```

**호환성**: 기존 사용자 config 가 `WIKEY_SEARCH_ENGINE` 미보유 시 `'orama'` 자동 적용. 회귀 시 사용자가 `wikey.conf` 또는 환경변수 `WIKEY_SEARCH_ENGINE=qmd` 지정.

### 3.3.1 Plugin config bridge — `wikey-obsidian/src/main.ts` 변경 (codex cycle #1 HIGH-2 fix)

신규 키 `WIKEY_SEARCH_ENGINE` 가 wikey-core 의 `WikeyConfig` 인터페이스에 추가되어도 wikey-obsidian 의 plugin 진입점이 *읽지 않으면* 사용자가 `wikey.conf` 또는 환경변수에 설정한 값이 query-pipeline / reindex 로 전달되지 않음. 다음 3 위치 변경 의무:

| # | 위치 | 변경 |
|---|------|------|
| (a) | `wikey-obsidian/src/main.ts:513` (`loadFromWikeyConf` — wikey.conf 파일 파서) | `WIKEY_SEARCH_ENGINE` 키 인식. 값 검증 (`'orama'` / `'qmd'` 외 invalid 시 default `'orama'` + console.warn) |
| (b) | `wikey-obsidian/src/main.ts:641` (`buildConfig` — config merge + plugin → wikey-core 전달) | wikey.conf 값 + `process.env.WIKEY_SEARCH_ENGINE` override (env 우선) → final config 의 `WIKEY_SEARCH_ENGINE` 필드 set |
| (c) | wikey-core 호출 site (query / reindex entry) | `buildConfig()` 결과를 `query()` / `cmdReindex()` 의 `config` 파라미터로 forward (이미 존재하는 흐름 — 신규 키만 통과 보장) |

**Override 우선순위** (sample 단위 결정):
1. `process.env.WIKEY_SEARCH_ENGINE` (가장 우선, AC-L3 의 라이브 toggle path)
2. `<vault>/wikey.conf` 안 `WIKEY_SEARCH_ENGINE=...` 행
3. `DEFAULTS.WIKEY_SEARCH_ENGINE = 'orama'`

**테스트 의무**: AC-F1 분리 — AC-F1.a (config bridge 단위 테스트, mock fs read wikey.conf) + AC-F1.b (env override 단위 테스트, `process.env` mock).

### 3.4 query-pipeline.ts 변경 (codex cycle #1 HIGH-1 fix)

**현 main flow 결함**: 현재 `query()` (line 39~99) 는 *Step 1 — Find qmd* 으로 시작 (`const result = await findQmdBin(basePath)`) → `engine === 'orama'` 사용자 환경에서 qmd 미보유 시 `findQmdBin()` 가 throw → orama path 도달 불가 → 사용자 의도 (회귀 안전망) 직접 위반.

**fix**: engine 판정을 `query()` 최상단으로 이동 + qmd 탐색을 engine='qmd' 조건부로 한정.

```ts
// wikey-core/src/query-pipeline.ts — query() 최상단 (line 37 부근) 변경
export async function query(question, config, basePath, opts): Promise<QueryResult> {
  const execEnv = opts?.execEnv ?? (process.env as Record<string, string>)
  const engine = config.WIKEY_SEARCH_ENGINE ?? 'orama'

  let searchResults: readonly SearchResult[]
  if (engine === 'qmd') {
    // 회귀 path — 기존 qmd 탐색 + execQmdSearchLegacy
    let qmdBin: string, qmdIsJs = false
    try {
      const r = await findQmdBin(basePath)
      qmdBin = r.bin; qmdIsJs = r.isJs
    } catch (err: any) {
      throw new Error(`[Step 1/4 qmd 탐색] ${err?.message ?? err}`)
    }
    searchResults = await execQmdSearchLegacy(qmdBin, qmdIsJs, question, config, basePath, execEnv, opts?.nodePath, httpClient)
  } else {
    // engine === 'orama' (default) — qmd 탐색 skip
    searchResults = await execOramaSearch(question, config, basePath, opts, httpClient)
  }

  if (searchResults.length === 0) { /* 기존 빈 결과 처리 */ }
  // 이하 buildContext / collectCitations / 답변 합성은 engine 무관 동일
}
```

**핵심 invariant**:
1. `findQmdBin()` 호출은 **engine === 'qmd'** branch 안으로만 한정 — orama 환경에서 qmd 부재여도 query 정상 동작.
2. `execQmdSearchLegacy` (이름 변경) = 기존 `execQmdSearch` 함수 본문. 분기 wrap 만 추가 (Karpathy Surgical).
3. `execOramaSearch` 신규 — 동일 한국어 preprocess (Kiwi WASM in-process, PoC 검증) + cross-lingual extraction (Ollama 호출 보존) + Orama `search()` 호출 + `parseOramaOutput` (= `[{id, title, body, score}]` → `[{path, score, snippet}]`).
4. **`OramaIndexHandle` 의 cache 위치**: `~/.cache/wikey/orama/wikey-wiki.json` — plugin onload 시 1회 `restore()` 후 모듈 scope singleton 보존. `execOramaSearch` 는 singleton handle 의 `search()` 호출.

### 3.5 reindex.ts 변경 (codex cycle #1 HIGH-3 fix)

**현 결함**: `cmdReindex(opts: ReindexOptions)` (line 393~465) 의 `ReindexOptions` 인터페이스 (line 28~75 부근) 가 `qmdBin` / `stampPath` / `dbPath` 만 받고 engine 입력이 없음. → Orama ingest 분기 위치 + plugin → reindex bridge 가 spec 안에 정의되어 있지 않으면 구현 시 임의 결정 발생.

**fix**: `ReindexOptions` 에 `searchEngine` 필드 추가 + 호출 site 2 곳 (`scripts-runner.ts:36` + plugin reindex command) bridge 명시.

```ts
// wikey-core/src/scripts/reindex.ts — ReindexOptions 확장
export interface ReindexOptions {
  readonly basePath: string
  readonly qmdBin?: string         // engine='qmd' 시만 사용
  readonly stampPath?: string
  readonly dbPath?: string
  readonly searchEngine?: 'orama' | 'qmd'   // §5.7.4 신규 — default 'orama'
  readonly oramaCachePath?: string  // §5.7.4 신규 — engine='orama' 시 ~/.cache/wikey/orama/wikey-wiki.json
  readonly signal?: AbortSignal
  // ... 기타 기존 필드 보존
}

// cmdReindex main pipeline 변경
export async function cmdReindex(opts: ReindexOptions): Promise<{ exitCode: number }> {
  const engine = opts.searchEngine ?? 'orama'

  if (engine === 'orama') {
    // Step 1+2 통합 — Orama insertMultiple + 벡터 임베딩 별 호출
    log.stepHeader(1, 5, 'Orama ingest — 파일 스캔 + BM25 인덱스 + 벡터')
    const ingestExit = await runOramaIngest({ wikiDir: path.join(opts.basePath, 'wiki'), cachePath: opts.oramaCachePath ?? defaultOramaCache(), ...etc })
    if (ingestExit !== 0) return { exitCode: ingestExit }
  } else {
    // engine === 'qmd' (회귀 path)
    const qmdBin = opts.qmdBin ?? defaultQmdBin(opts.basePath)
    log.stepHeader(1, 5, 'qmd update — 파일 스캔')
    const updateExit = await runQmdUpdate(qmdBin, opts.basePath, env, log, writeErr, signal)
    if (updateExit !== 0) return { exitCode: updateExit }
    log.stepHeader(2, 5, 'qmd embed — 벡터 임베딩')
    const embedExit = await runQmdEmbed(qmdBin, opts.basePath, env, log, write, writeErr, signal)
    if (embedExit !== 0) return { exitCode: embedExit }
  }

  // Step 3 (CR Gemma 4) + Step 4 (형태소 batch) + Step 5 (validate) — engine 무관 동일
  // build-time path 보존 (목표 §1.1 #2)
}
```

### 3.5.1 scripts-runner.ts + plugin reindex command bridge (v4 정확화 — codex cycle #2 MED-2 fix)

**현재 public API** (codex cycle #2 finding 확증):
- `wikey-core/src/scripts-runner.ts:132` — `reindexWiki(basePath, env)` / `reindexQuick(basePath, env)` 가 plugin 노출 진입점.
- `wikey-obsidian/src/main.ts:461` — `getExecEnv()` 자체 정의 (codex cycle #4 LOW-1 fix v6). 실 reindex 호출 site = `wikey-obsidian/src/settings-tab.ts:943` (settings UI reindex) + `wikey-obsidian/src/commands.ts:1001` (ingest 후 quick reindex). `getExecEnv()` 가 `process.env` mirror + 일부 wikey.conf 값을 환경 변수 형태로 주입.
- 단 `getExecEnv()` 가 `buildConfig()` 결과를 직접 전달 안 함 → wikey.conf 의 `WIKEY_SEARCH_ENGINE=qmd` 가 reindex path 까지 자동 도달 안 함.

**v4 변경** (Surgical, 2 path 중 1 채택):

| 위치 | 변경 (v4 권고 — env injection path) |
|---|---|
| (a) `wikey-obsidian/src/main.ts:461` (`getExecEnv()` 자체 정의) + 실 호출 site = `wikey-obsidian/src/settings-tab.ts:943` (settings UI reindex) + `wikey-obsidian/src/commands.ts:1001` (ingest 후 quick reindex) — codex cycle #3 LOW fix v5 (call site 분리 표기) | `getExecEnv()` 가 `buildConfig()` 의 `WIKEY_SEARCH_ENGINE` 값을 `env.WIKEY_SEARCH_ENGINE` 로 주입 (현재 `WIKEY_QMD_TOP_N` 등 이미 동일 패턴). ~3 LOC `main.ts:461`. settings-tab + commands 호출 site 는 `getExecEnv()` 결과 그대로 forward — 시그니처 변경 불요. |
| (b) `wikey-core/src/scripts-runner.ts:132` (`reindexWiki/reindexQuick(basePath, env)`) | `env.WIKEY_SEARCH_ENGINE` read 후 `cmdReindex({ ..., searchEngine: env.WIKEY_SEARCH_ENGINE === 'qmd' ? 'qmd' : 'orama' })` 호출. ~5 LOC. |
| (c) `wikey-core/src/scripts/reindex.ts:393~465` (`cmdReindex`) | `ReindexOptions.searchEngine` field 받음 (§3.5). `process.env.WIKEY_SEARCH_ENGINE` override 우선 (env 가 wikey.conf 보다 위, `WIKEY_QMD_TOP_N` 와 동일 패턴). |
| (d) `runOramaIngest` 신규 — `wikey-core/src/search/orama-index.ts::ingestAll(wikiDir)` wrap | wiki/ 디렉토리 스캔 → frontmatter 파싱 → `insertMultiple(db, docs)` + (선택) 벡터 임베딩 별 호출 + `persist()` |

**비채택 alternative** — scripts-runner public API 자체 시그니처 변경 (`reindexWiki(basePath, env, opts?: { searchEngine })`): wikey-obsidian + wikey-core 양쪽 호출 site 모두 변경 의무 → Karpathy Surgical 위반. env injection path 가 영향 면 최소.

**테스트 의무 (AC-F1.b 보강)**: integration test = mock plugin reindex 호출 → `process.env.WIKEY_SEARCH_ENGINE=qmd` set → `cmdReindex` 가 받은 `searchEngine` 검증.

**stamp 정책**: engine='orama' 도 동일 `~/.cache/qmd/.last-reindex` stamp file 갱신 (Karpathy Surgical — cache root 변경 X). 단 stamp 의 의미가 *qmd* 가 아닌 *index freshness* 이므로 향후 cleanup cycle 에서 `~/.cache/wikey/.last-reindex` 으로 rename 검토 (deferral, C5).

`cmdReindex` 의 Step 1+2 (qmd update + embed) 는 engine='orama' 시 단일 step `runOramaIngest` 로 통합. Step 3 (CR Gemma 4) + Step 4 (형태소 batch) + Step 5 (validate) 는 그대로 — *build-time path 보존* (목표 §1.1 #2).

### 3.6 Kiwi 사전 lazy download 패턴

PoC commands.ts:278-281 의 cache 위치 `~/.cache/wikey/kiwi-models/cong/base/` (104MB) 를 production 에서도 그대로 사용. lazy download 절차:

| 시점 | 동작 |
|---|---|
| Plugin onload | `~/.cache/wikey/kiwi-models/cong/base/` exists 검증. 없으면 사용자 Notice (수동 download 안내 또는 CLI script 실행 안내) — qmd GGUF 모델과 동일 패턴 (사용자가 setup.sh 으로 download). |
| 첫 Korean query | 모델 dir 부재 시 `tryKoreanPreprocess` 가 fallback (raw text 그대로 → Orama 가 alphanumeric only 매칭, 한국어 정확도 저하) + console.warn. |

본 §5.7.4 v1 은 **lazy auto-download 미구현** (Karpathy Simplicity — Kiwi 본가 model release URL 변동 가능성, md5 검증 등 별 spec). 사용자가 setup script (`./scripts/download-kiwi-models.sh` 신규 작성, 본 cycle 안 1 step) 1회 수동 실행.

### 3.7 Kiwi WASM binary 배포 — Option A esbuild plugin asset copy (codex cycle #1 HIGH-4 fix, 사용자 결정 2026-05-09)

**현 PoC 결함**: `wikey-obsidian/src/commands.ts:116` 가 `path.join(projectRoot, 'node_modules/kiwi-nlp/dist/kiwi-wasm.wasm')` 사용 — Obsidian plugin 배포물 (`<vault>/.obsidian/plugins/wikey/`) 에는 vault root 의 `node_modules/` 부재 → 배포된 plugin 으로는 100% 실패. esbuild config 도 wasm copy 안 함.

**Option A 채택 (사용자 결정 2026-05-09)**: esbuild plugin asset copy — build 시 **vendor path** (`wikey-core/vendor/kiwi-nlp/dist/kiwi-wasm.wasm`, v4 vendor 경유, §3.8) 의 wasm (3.8MB) 을 plugin 폴더 root 의 `kiwi-wasm.wasm` 으로 copy. runtime 에서는 Obsidian API 의 `plugin.manifest.dir` (= `.obsidian/plugins/wikey`) 기준으로 lookup.

```js
// wikey-obsidian/esbuild.config.mjs — production build plugin 추가 (v4: vendor path)
import * as esbuild from 'esbuild'
import * as fs from 'node:fs'
import * as path from 'node:path'

const wasmCopyPlugin = {
  name: 'wikey-wasm-copy',
  setup(build) {
    build.onEnd(() => {
      // v4 (codex cycle #2 HIGH-A fix): vendor path 고정. v3 의 node_modules 의존 제거.
      const src = path.resolve('../wikey-core/vendor/kiwi-nlp/dist/kiwi-wasm.wasm')
      const dst = path.resolve('kiwi-wasm.wasm')   // wikey-obsidian 폴더 root (= plugin 배포 root)
      fs.copyFileSync(src, dst)
      console.log('[wikey] kiwi-wasm.wasm copied:', fs.statSync(dst).size, 'bytes')
    })
  },
}

await esbuild.build({
  // ... 기존 옵션
  plugins: [wasmCopyPlugin, /* ... */],
})
```

**Runtime path lookup** (`wikey-core/src/search/orama-korean-tokenizer.ts` 또는 wikey-obsidian 의 init wrapper):

```ts
// wikey-obsidian/src/main.ts 또는 search wrapper 안
const wasmPath = path.join(this.app.vault.adapter.basePath, this.manifest.dir, 'kiwi-wasm.wasm')
// = <vault>/.obsidian/plugins/wikey/kiwi-wasm.wasm
const wasmBinary = fs.readFileSync(wasmPath)
const tokenizer = await createKoreanTokenizer({ wasmPath, wasmBinary, modelDir })
```

**Plugin manifest + ignored/release 파일 갱신**:
- `wikey-obsidian/manifest.json` — 필수 (변경 없음)
- `wikey-obsidian/.gitignore` — `kiwi-wasm.wasm` 추가 (build artifact, 커밋 금지)
- 배포 (release) 시 `main.js` / `manifest.json` / `styles.css` / **`kiwi-wasm.wasm`** 4 파일 묶음

**KoreanTokenizerOptions 확장** (§3.1):

```ts
export interface KoreanTokenizerOptions {
  readonly wasmPath: string
  readonly modelDir: string
  /** §3.7 Option A — wasmBinary pre-read (Module.instantiateWasm hook 직접 주입). Electron renderer 환경 필수. */
  readonly wasmBinary?: Uint8Array
}
```

**비-Option B/C 채택 사유**:
- Option B (~/.cache/wikey/kiwi-bin/ lazy download): URL 안정성 + md5 검증 + 첫 사용자 download 부담 — over-spec.
- Option C (base64 inline → main.js embed): main.js 280K → ~5MB (5x), startup parse 비용 증가 + binary literal 가독성 0.

**PoC code 의 npm 경로 의존성 — v4 정책** (codex cycle #2 HIGH-A fix): 본 cycle 의 *production query path* 는 wikey-core 의 신규 모듈 (`orama-korean-tokenizer.ts`) + vendor (§3.8) 경유. PoC 3 command (`wikey-obsidian/src/commands.ts:96~522`) 의 `node_modules/kiwi-nlp/...` 직접 path 는 **PoC cleanup 시점까지 잠정 보존** — 본 cycle 종결 직후 별 step 으로 PoC 정리 + npm dep 완전 제거. 단 Step C 의 PoC benchmark 재실행 (AC-Q1/Q3) 은 PoC 보존 상태에서 진행 (Karpathy Surgical — 마이그레이션 검증과 PoC cleanup 분리). Step D 마지막 step = "PoC cleanup + npm dep `kiwi-nlp` 완전 제거" 별 commit.

**테스트 의무**: AC-W1 신규 — "node_modules 없이 production query path PASS" (production-like 환경 mock, plugin folder 만 + wasm copy 만 있는 fixture). PoC command 는 본 AC scope 외.

### 3.8 kiwi-nlp 부분 vendor 패턴 — B-2 옵션 채택 (사용자 결정 v3+v4+v5, 2026-05-09)

**사용자 raise 2026-05-09 (v3 추가)**: "wiki-npl을 binary타입으로 사용? 아니면 코드 내재화? 원래 목적은 코드 내재화인데?"

§5.7.2 통찰 ("내재화 = 직접 customize 가능") 와 정합 위해 kiwi-nlp 의 *JS wrapper 전체 source* 를 wikey 안 vendor. WASM binary (3.8MB, Kiwi C++ 본가 빌드) 는 npm package mirror 그대로, 사전 (104MB, Kiwi 본가 release) 은 외부 cache 의존.

**v3 → v4 → v5 vendor scope 진화** (master fact-check + codex cycle 누적):
- v3 = `npm pack kiwi-nlp@0.23.0` 폐기 (codex cycle #2 HIGH-B — npm package = `files: ["dist"]` only, src/LICENSE 부재).
- v4 = `bab2min/kiwi-nlp` git archive 시도 — codex cycle #3 fact-check 결과 **존재하지 않는 repo**.
- **v5 채택 = `bab2min/Kiwi` (대문자 K, Kiwi 본가) + `bindings/wasm/package/` subdir sparse vendor**. Master 가 `node_modules/kiwi-nlp/package.json` 의 `repository.url = git+https://github.com/bab2min/Kiwi.git` + `files: ["dist"]` 직접 확증.

**vendor 범위** (v5):

| 영역 | v5 (bab2min/Kiwi 본가 + bindings/wasm/package subdir 채택) | ownership |
|------|---------------------------------------------------------------|-----------|
| `kiwi-nlp` JS/TS wrapper src (`bindings/wasm/package/src/**/*.ts` 또는 동등) | **포함** (subdir vendor) — wikey 가 TS 원본 customize 가능 | HIGH |
| `LICENSE` (LGPL-2.1) | **포함** — Kiwi 본가 root 의 `LICENSE` 를 `wikey-core/vendor/kiwi-nlp/LICENSE` 으로 별 fetch (sparse archive 가 root 미포함) | 보존 |
| `package.json` + `tsconfig.json` + 빌드 스크립트 (`bindings/wasm/package/` 안) | **포함** (전체 — JS wrapper 빌드 self-contained) | HIGH |
| dist build artifact (`dist/build/kiwi-wasm.js` + `dist/index.js` + `dist/*.d.ts`) | **v9 정정 (post-impl cycle #3 MED #10 reality drift fix)**: vendor 안 `dist/` = npm package `kiwi-nlp@0.23.0/dist/` 와 byte-equal mirror. `src/build/kiwi-wasm.js` (Emscripten generated) 는 본가 `bindings/wasm/build.sh` + Emscripten 결과물이라 vendor 안 `npm run build` 단독 실행 시 `TS2307: Cannot find module './build/kiwi-wasm.js'` fail. **vendor 정합성 = sparse 보존 + dist mirror**, src customize 시 본가 build 환경 prerequisite (e 항목 relink 절차 참조). | mirror — runtime use; rebuild 시 본가 build prerequisite |
| `kiwi-wasm.wasm` (3.8MB) C++ source | Kiwi C++ source = `bab2min/Kiwi` repo root + `src/` + `include/` (vendor scope **외**, NOTICE 안 reference 의무 — LGPL §6 (d) relink path) | NONE (vendor scope 외) |
| `kiwi-wasm.wasm` binary (v6 path 단일화) | npm `kiwi-nlp@0.23.0/dist/kiwi-wasm.wasm` 그대로 mirror — **vendor 안 `dist/kiwi-wasm.wasm`** (dist root, npm 동일 위치) 으로 보존. JS wrapper canonical (`dist/build/kiwi-wasm.js` Emscripten generated JS) 와 분리. 사용자 자체 build 시 `bab2min/Kiwi` 본가 + Emscripten + `bindings/wasm/build.sh` 절차로 wasm 교체 가능 (NOTICE 안 명시) | mirror + relink path 명시 |
| Kiwi 사전 (cong/base 9 파일, 104MB) | 외부 cache (`~/.cache/wikey/kiwi-models/` — *dictionary data*, LGPL relink 와 별개) | NONE |
| `wikey-core/src/search/orama-korean-tokenizer.ts` (wrapper) | wikey 직접, vendor 의 `dist/build/kiwi-wasm.js` import (PoC canonical) | HIGH |
| `smart_tokenize` 함수 | wikey 직접 (PoC commands.ts:142-156 mirror) | HIGH |

**Canonical import path** (v5 — codex cycle #3 HIGH-2 fix): production tokenizer 는 PoC commands.ts:112 / 269 의 default export pattern 보존 — `import initKiwi from '../../vendor/kiwi-nlp/dist/build/kiwi-wasm.js'`. `dist/index.js` (`KiwiBuilder.create(wasmPath)` 계층) 는 Electron file:// fetch 함정 path 라 production 미사용.

**vendor 절차** (v5 — sparse archive 패턴, codex cycle #3 HIGH-1 fix):

```bash
# 1. bab2min/Kiwi 본가 의 npm release 대응 git tag 확인
#    Step A 진입 시 master 가 (a) bab2min/Kiwi releases 페이지 또는 (b) bindings/wasm/package/package.json 의 version 으로 npm 0.23.0 ↔ Kiwi 본가 git tag 매핑 확정
KIWI_TAG=v0.23.0      # Step A 진입 시 본가 release 확인 후 확정 (예: v0.23.x 또는 별 buildtag)
mkdir -p /tmp/kiwi-vendor && cd /tmp/kiwi-vendor

# 2. Kiwi 본가 git archive download
curl -L "https://github.com/bab2min/Kiwi/archive/refs/tags/${KIWI_TAG}.tar.gz" -o kiwi-src.tgz

# 3. bindings/wasm/package/ subdir 만 sparse 추출
tar -xzf kiwi-src.tgz "Kiwi-${KIWI_TAG#v}/bindings/wasm/package"
mkdir -p /Users/denny/Project/wikey/wikey-core/vendor
mv "Kiwi-${KIWI_TAG#v}/bindings/wasm/package" /Users/denny/Project/wikey/wikey-core/vendor/kiwi-nlp

# 4. Kiwi 본가 root 의 LICENSE 를 vendor root 으로 별 fetch (sparse 방식 → root 미포함)
curl -L "https://raw.githubusercontent.com/bab2min/Kiwi/${KIWI_TAG}/LICENSE" \
  -o /Users/denny/Project/wikey/wikey-core/vendor/kiwi-nlp/LICENSE

# 5. dist mirror — npm package 의 dist 전체를 vendor 으로 byte-equal copy
#    (v9 정정, post-impl cycle #3 MED #10 reality drift fix):
#    vendor 안 `npm ci && npm run build` 만으로는 `src/build/kiwi-wasm.js` (Emscripten
#    generated) 미생성으로 `tsc strict` fail (TS2307). vendor 정합성 = sparse 보존 +
#    dist mirror. src customize 시 본가 `bindings/wasm/build.sh` + Emscripten prerequisite.
cd /Users/denny/Project/wikey/wikey-core/vendor/kiwi-nlp
if [ -f package-lock.json ]; then npm ci; else npm install; fi    # devDeps install (선택)
# Build 단독 시도 (v9 reality): src/build/ 가 본가 Emscripten 산출물이라 부재 시 fail.
# dist 는 별 mirror copy (아래 step 6) 으로 채움.

# 6. dist mirror copy — npm @0.23.0 dist 를 vendor 의 dist 로 byte-equal mirror.
mkdir -p dist
cp -r /Users/denny/Project/wikey/node_modules/kiwi-nlp/dist/* \
      /Users/denny/Project/wikey/wikey-core/vendor/kiwi-nlp/dist/
cd -

# 7. VENDOR.md 작성 (master 추적용)
cat > /Users/denny/Project/wikey/wikey-core/vendor/kiwi-nlp/VENDOR.md <<EOF
# kiwi-nlp Vendor (B-2 sparse vendor pattern, v5)

- Upstream: bab2min/Kiwi (Kiwi 본가) — https://github.com/bab2min/Kiwi
- Vendor scope: bindings/wasm/package/ subdir (JS/TS wrapper + 빌드 스크립트)
- Kiwi git tag: ${KIWI_TAG}
- Vendor date: $(date -I)
- License: LGPL-2.1 (root LICENSE 별 fetch — vendor/kiwi-nlp/LICENSE)
- WASM C++ source: vendor scope 외 — bab2min/Kiwi repo root + src/ + include/ (LGPL §6 (d) relink path = 본가 + Emscripten + bindings/wasm/build.sh)
- WASM binary: dist/kiwi-wasm.wasm (npm 0.23.0 mirror — npm 위치와 동일, v6 path 단일화)
- Wikey 측 수정분: (현 시점 0건. 수정 시 본 파일 안 patch list 추가)
- Sync 절차: ../../docs/kiwi-nlp-vendor-sync.md
EOF

# 8. npm dep 제거 (wikey-core 만, wikey-obsidian 은 PoC cleanup 시점까지 잠정 보존, §3.7)

# 9. wikey-core import path 변경 (PoC canonical mirror, codex cycle #3 HIGH-2 fix)
# from: (PoC) import initKiwi from 'kiwi-nlp/dist/build/kiwi-wasm.js'
# to:   import initKiwi from '../../vendor/kiwi-nlp/dist/build/kiwi-wasm.js'

# 10. esbuild config 의 wasm copy source = vendor path (§3.7)
```

**LGPL §6 의무 충족 path** (v5 — codex cycle #3 HIGH-3 fix, wasm binary source/rebuild path 보강):

LGPL 2.1 §6 요구: (a) notice + (b) license copy + (c) library source + (d) 수정된 library 로 재결합 가능 수단 (relink mechanism).

| 의무 | JS wrapper layer (vendor scope 안) | WASM binary layer (vendor scope 외, NOTICE reference 의무) |
|------|------------------------------------|------------------------------------------------------------|
| (a) notice | `NOTICE` 파일 안 "Kiwi NLP JS wrapper (LGPL-2.1) — vendored at `wikey-core/vendor/kiwi-nlp/`" | NOTICE 안 "Kiwi WASM binary — built from `bab2min/Kiwi` (LGPL-2.1) + Emscripten" |
| (b) license copy | `wikey-core/vendor/kiwi-nlp/LICENSE` (Kiwi 본가 root LGPL-2.1 별 fetch) | 동일 LICENSE (Kiwi 본가) |
| (c) library source | `wikey-core/vendor/kiwi-nlp/{src,package.json,tsconfig.json}` (JS wrapper TS 원본) | `bab2min/Kiwi` repo root + `src/` + `include/` + `bindings/wasm/build.sh` (vendor scope 외, NOTICE 안 URL + git tag 명시) |
| (d) relink mechanism (v9 정정) | NOTICE 안 절차: 사용자 `vendor/kiwi-nlp/src/` 수정 → 본가 `bindings/wasm/build.sh` + Emscripten 절차로 `src/build/kiwi-wasm.{js,d.ts}` 재생성 → vendor 안 `cd wikey-core/vendor/kiwi-nlp && npm run build` (이제 src/build/ 가 있어 PASS) → wikey-obsidian rebuild → 변경된 wrapper library 로 plugin 재결합 가능. **v9 reality**: vendor `dist/` 는 npm package byte-equal mirror, 본가 build 환경 (Emscripten) 이 prerequisite (vendor 안 단독 `npm run build` 는 `src/build/kiwi-wasm.js` 부재로 TS2307 fail) | NOTICE 안 절차: 사용자 `bab2min/Kiwi` clone → `bindings/wasm` + Emscripten + `./build.sh` → `kiwi-wasm.wasm` 생성 → `wikey-core/vendor/kiwi-nlp/dist/kiwi-wasm.wasm` 교체 → wikey-obsidian rebuild |

**`~/.cache/wikey/kiwi-models/` 의 의미 명확화** (HIGH-C fix v4 보존): *dictionary data cache* (Kiwi 사전 cong/base 모델 9 파일, 104MB) 만 — JS/WASM library 의 LGPL relink mechanism 와 *별개*. 모델 cache 교체 = dictionary data 교체 (Kiwi 본가 release 의 다른 모델 사용), library modification 와 다른 layer.

**Sync 절차 docs** (`docs/kiwi-nlp-vendor-sync.md`, ~50 줄, AC-V2 의무):

```markdown
# kiwi-nlp Vendor Sync 절차

## 현재 vendor 상태
- 출처: bab2min/Kiwi (Kiwi 본가) git tag <KIWI_TAG> 의 bindings/wasm/package/ subdir
- 위치: wikey-core/vendor/kiwi-nlp/
- LICENSE: bab2min/Kiwi root (LGPL-2.1) — 별 fetch
- wikey 측 수정분: <list>

## 정기 점검 (사용자 / master 수동, §5.7.5 자동화 deferral) — v6 primary 절차 (codex cycle #4 MED-2 fix)

**Primary** (B-2 sparse vendor 의 실 sync 대상):
1. `bab2min/Kiwi` releases (https://github.com/bab2min/Kiwi/releases) 확인 — 신 git tag 발견
2. `bindings/wasm/package/` subdir diff 검토 — 신 tag 의 archive 받아 vendor 와 `git diff` 또는 `diff -r`
3. 본가 root `LICENSE` diff 검토 — 신 tag 의 `LICENSE` 와 vendor `LICENSE` `diff`
4. 보안 patch / critical fix 만 cherry-pick — minor/patch 만 (major 는 별 spec)
5. wikey 측 수정분 (smart_tokenize / Module.instantiateWasm hook) 보존 검증
6. 단위 테스트 + 라이브 smoke 재실행

**Secondary (보조)**:
- `npm view kiwi-nlp version` — npm 배포 신 버전 cross-check (Kiwi git tag 와 mapping 확인)
- `npm view kiwi-nlp dist.tarball` — npm dist 의 wasm 변경 감지 (vendor wasm mirror 갱신 필요 여부)

## 자동화 (§5.7.5 별 spec)
- B1 npm outdated cron / GitHub Actions
- B7 vendor diff 자동 보고 → 사용자 review queue
```

**Trade-off (v3 사용자 결정 영구 등록)**:

| 측면 | A (v2 npm dep) | **B (v3 vendor 채택)** |
|------|----------------|-------------------------|
| ownership | wrapper 만 (LOW-MED) | wrapper + JS wrapper layer (HIGH) |
| 마이그레이션 비용 | 0 | +1~2일 (vendor + sync docs + import path 변경) |
| qmd vendored 와 동등 ownership | NO | YES (qmd 92K LOC vs kiwi-nlp ~3K LOC, 동일 패턴 작은 규모) |
| LGPL-2.1 의무 | dynamic linking, NOTICE relink path | static vendor, LGPL §6 relink mechanism (사용자 자체 빌드 가능 명시) — 동일 충족 path |
| customization | upstream PR or fork 의무 | **wikey 가 직접 patch 가능** |
| 향후 update 비용 | npm update 1회 | sync 절차 1회 (수동 cherry-pick) |
| §5.7.2 통찰 충족 | 부분 | **완전** (사용자 의도 직접 충족) |

**테스트 의무**: AC-V2 신규 — vendor import path 작동 + sync docs 존재 확증.

## 4. 26 todo 후보 검증 결과 — 4-question 분석 + 삼지선다

> 사용자 강조 (2026-05-09): "spec에 대해서는 정말 필요한 기능인지, 역할이 뭔지 등을 검증할 필요 있음."
>
> 4 question:
> 1. **필요성**: 본 §5.7.4 invariant 또는 production 안전성에 필수?
> 2. **역할**: 해결 problem 명확 + 다른 항목과 책임 중복 없는가?
> 3. **Karpathy Simplicity**: 200줄 → 50줄 가능 / 시니어 엔지니어 over-eng 판정?
> 4. **Phase scope**: 본 cycle 안 처리 합리 / 별 spec deferral 합리?

### 4.1 A 그룹 (핵심 마이그레이션) — 9 항목

| # | 항목 | 분류 | 근거 |
|---|------|------|------|
| A1 | Kiwi WASM Korean tokenizer 모듈 (`orama-korean-tokenizer.ts`) | ✅ 포함 | (1) Orama 가 sync `tokenize` fn 강제 — query path 의 한국어 처리 필수. (2) PoC 검증 path 명확 — Module.instantiateWasm hook + smart_tokenize. (3) ~150 LOC 추정 (PoC 코드 mirror). (4) 본 cycle 핵심. AC-T1~T3. |
| A2 | Orama 인덱스 lifecycle (`orama-index.ts` create / insertMultiple / search / persist / restore) | ✅ 포함 | (1) qmd CLI 의 query / update / embed 대체 면. (2) lifecycle 명확. (3) ~200 LOC 추정. (4) 본 cycle 핵심. AC-I1~I4. |
| A3 | Kiwi 사전 lazy download (`~/.cache/wikey/kiwi-models/cong/base/` 104MB) | ⚠️ 수정 포함 | (1) 사용자 첫 사용 환경 부재 가능 — 안전 의무. (2) 단 lazy *auto* download 는 Kiwi 본가 release URL / md5 검증 / 진행 표시 UI = over-spec. (3) Karpathy 단순화 적용. (4) **수정**: lazy auto-download 대신 setup script `./scripts/download-kiwi-models.sh` 1회 작성 + plugin onload 시 부재 detect → Notice 안내. AC-S1. |
| A4 | query-pipeline qmd CLI → Orama 호출 교체 | ✅ 포함 | (1) 본 cycle 의 핵심 변경. (2) `execQmdSearch` 분기 추가 (Surgical). (3) ~80 LOC 추정. (4) 본 cycle. AC-Q1~Q4. |
| A5 | reindex qmd update/embed → Orama insert | ✅ 포함 | (1) build-time index 일관성 — query 가 새 backend 면 ingest 도 같은 backend. (2) `runQmdUpdate` / `runQmdEmbed` 분기 추가. (3) ~120 LOC 추정. (4) 본 cycle. AC-R1~R3. |
| A6 | wikey-core 단위 테스트 + obsidian-cdp 라이브 cycle smoke | ✅ 포함 | (1) RED→GREEN→BLUE 의무 (CLAUDE.md SDD+TDD). (2) 단위 + 라이브 분리. (3) — (4) 본 cycle. AC 모든 항목 + 라이브 smoke AC. |
| A7 | tools/qmd/ 보존 | ✅ 포함 | (1) Path C 회귀 안전망 #2 — 사용자 결정 영구 등록 2026-05-09. (2) 작업 = 0 (보존만, 삭제 안 함). (3) — (4) 본 cycle 안 1 line decision. AC-F2. |
| A8 | `WIKEY_SEARCH_BACKEND` feature flag (실제 키 = `WIKEY_SEARCH_ENGINE`, §3.3 명칭 충돌 회피) | ✅ 포함 | (1) 회귀 안전망 #3 — 코드 revert 없이 runtime toggle. (2) 명확 — 신규 키 1개 + defaults 1줄. (3) ~10 LOC. (4) 본 cycle. AC-F1. |
| A9 | 회귀 절차 docs (`docs/orama-rollback.md`) | ⚠️ 수정 포함 | (1) 사용자 회귀 path 가이드 필수. (2) 단 별 docs 파일 = over-spec (Karpathy Surgical). (3) 단순화: README.md 또는 phase-5-result.md §5.7.4 entry 안에 "회귀 절차 3 layer" 1 섹션 (~30 줄) 으로 통합. (4) 본 cycle 안. AC-D1. |

### 4.2 B 그룹 (upstream update 동기화 프로세스 자동화) — 7 항목 (v3 추가 B7 + v4 codex cycle #2 MED-3 정정)

| # | 항목 | 분류 | 근거 |
|---|------|------|------|
| B1 | Orama update monitor 자동화 (`npm outdated` cron / GitHub Actions) | deferral | (1) 본 cycle 마이그레이션 invariant 와 무관 — *마이그레이션 후 운영 정책*. (2) — (3) 자동화 인프라 구축 = over-spec. (4) **별 spec `phase-5-todox-5.7.5-orama-update-sync.md`** 또는 `phase-6-...`. |
| B2 | Update 반영 프로토콜 (patch / minor / major 분기) | deferral | (1) 동상. (2) — (3) 정책 문서, 본 cycle 코드 작업 무관. (4) §5.7.5 deferral. |
| B3 | Regression 검증 자동화 (매 update 후 benchmark + smoke) | deferral | (1) — (3) 자동화 = 별 cycle. (4) §5.7.5. |
| B4 | Kiwi 사전 update 자동 추적 (md5 / size) | deferral | (1) Kiwi 본가 v0.23.x 안정 (PoC 시점) — 즉시 risk 0. (4) §5.7.5. |
| B5 | Update sync 프로세스 docs | deferral | (1) — (4) §5.7.5. |
| B6 | Notification (GitHub watch + workflow) | deferral | (1) — (4) §5.7.5. |
| **B7 (v3 신규, 사용자 raise 2026-05-09)** | kiwi-nlp source vendor upstream sync 자동화 — `wikey-core/vendor/kiwi-nlp/` (B-2 vendor §3.8) 의 git tag v0.23.x 변경 감지 + diff 분석 + cherry-pick 절차 자동화 | deferral | (1) 본 cycle 안 = vendor 1회 + 수동 sync 절차 docs 1 페이지 (`docs/kiwi-nlp-vendor-sync.md`, AC-V2). (2) 자동화 (npm outdated 감지 + diff 보고 + 사용자 review queue) 는 운영 정책. (3) 자동화 인프라 = over-spec. (4) **별 spec `phase-5-todox-5.7.5-orama-update-sync.md`**. |

**B 그룹 총평**: 7 항목 모두 *마이그레이션 후 운영 정책 자동화* 로 본 cycle 핵심 invariant (코드 swap + 회귀 안전망 + quality 회귀 0 + vendor 1회) 와 직접 연결 X. **별 spec `phase-5-todox-5.7.5-orama-update-sync.md` 로 deferral** — 사용자 raise 2026-05-09 의도 (정기 update workflow + kiwi-nlp vendor sync) 보존.

### 4.3 C 그룹 (PoC 단계 deferred 검증) — 6 항목

| # | 항목 | 분류 | 근거 |
|---|------|------|------|
| C1 | Q5 (프로젝트 일정 관리) 회귀 보완 — smart_tokenize 정밀화 또는 stopword 추가 | ❌ deferral | (1) Q5 1/10 회귀는 PoC 단계 3 결과 — 본 cycle quality AC 는 PoC 동등 회귀로 정의 (Q5 의도적 수용 명시). (2) tokenizer 정밀화 = scope 확장. (3) Karpathy — 본 cycle 외. (4) 별 cycle `phase-5-todox-5.7.6-search-quality-tuning.md` 또는 §5.7.4 종결 후 사용자 quality 만족도 평가 후 결정. |
| C2 | 50~100 query 확장 benchmark | ❌ deferral | (1) statistical power — 본 cycle 마이그레이션 invariant 외. (2) — (3) — (4) 별 spec. |
| C3 | Persistence 정확도 sanity-test (Orama Issue #695) | ✅ 포함 | (1) 본 cycle persist/restore lifecycle 의 *근본 정확성* — round-trip test 1개로 안전성 확증. (2) Issue #695 의 risk #5 잔존 — AC 안 1줄 sanity test 로 mitigate. (3) round-trip test = ~30 LOC. (4) 본 cycle 안. AC-I4. |
| C4 | 벡터 768D Qwen3-Embedding 호환 검증 | ⚠️ 수정 포함 | (1) BM25-only 1차 마이그레이션 (목표 §1.1 #5) 이지만 *벡터 column 호환성* 만큼은 사전 검증 필요 — 후속 hybrid sub-cycle 이 spec 변경 없이 진행 가능해야. (2) — (3) Orama schema 에 `vector[768]` column 추가 + mock vector 1회 insert/search round-trip 만 검증 (본 cycle BM25 search 와 별 path). (4) 본 cycle 안 sanity 수준. AC-V1. |
| C5 | wikey.conf qmd 키 deprecate (`WIKEY_QMD_*` → `WIKEY_SEARCH_*`) | ❌ deferral | (1) 본 cycle invariant 외 — naming refactor. (2) `WIKEY_QMD_TOP_N` 은 Orama backend 도 동일 의미 (top N 결과). (3) Karpathy Surgical — 본 cycle 미포함. (4) 별 cycle (cleanup 과 함께 §5.7.5 또는 phase-6). |
| C6 | env-detect.ts qmd 의존 제거 | ❌ deferral | (1) feature flag default `orama` 라도 toggle 시 qmd backend 호출 → `findQmdBin` 동작 의무. (2) — (3) — (4) 별 cycle. |

### 4.4 D 그룹 (LGPL-2.1 compliance) — 5 항목

| # | 항목 | 분류 | 근거 |
|---|------|------|------|
| D1 | LICENSE 파일 작성 | ⚠️ 수정 포함 | (1) Kiwi LGPL-2.1 dynamic linking 호환 + Obsidian Community Plugins 규약 충족 (사용자 결정 2026-05-09). (2) — (3) 단 본 cycle 안 별 5 step (D1~D5) = over-spec. (4) **압축**: D1+D2+D3 통합 = LICENSE + NOTICE + README `## Third-party software` 섹션 1회 commit (~80 줄). 본 cycle 마지막 step. AC-D2. |
| D2 | NOTICE 파일 작성 | ⚠️ 수정 포함 | D1 과 통합 (위 행 참조). |
| D3 | README.md `## Third-party software` 섹션 추가 | ⚠️ 수정 포함 | D1 과 통합. |
| D4 | GitHub repository public 확증 | ✅ 포함 | (1) 사용자 의도 자연 충족 (Obsidian Community Plugins 규약 의무) — 작업 = 사용자 confirm 만 (master 가 commit 단계에서 1 line 보고). (2) — (3) — (4) 본 cycle 안 0 LOC. AC-D2 안 sub-bullet. |
| D5 | Relink 가능성 보장 (Kiwi 사전 사용자 cache 분리) | ✅ 포함 | (1) LGPL-2.1 dynamic linking 의 *legal 핵심 요구* — 사용자가 자체 수정한 Kiwi 로 교체 가능해야. (2) 이미 PoC 단계 2-B 에서 검증됨 (`~/.cache/wikey/kiwi-models/...` cache 분리). (3) 작업 = NOTICE 파일에 path 명시 1줄 + README 안내 1 섹션. (4) 본 cycle. D1 과 통합. AC-D2 안 sub-bullet. |

### 4.5 검증 요약 (v4 — codex cycle #2 MED-3 fix + B7 추가)

| 분류 | 개수 | 항목 |
|---|---|---|
| 포함 (해당 cycle 의무) | **10** | A1, A2, A4, A5, A6, A7, A8, C3, C4(수정), D4 |
| 수정 포함 (단순화) | **5** | A3 (auto-download → setup script), A9 (별 docs → README 통합), C4 (full hybrid → schema 호환 sanity), D1+D2+D3 (3개 통합 1 commit), D5 (이미 PoC 충족, NOTICE/README 1줄) |
| deferral / 폐기 | **12** | **B1~B7** (B7 = kiwi-nlp source vendor sync v3 신규, 별 spec §5.7.5 upstream-sync), C1, C2, C5, C6 (별 cycle) |
| v3 신규 (사용자 raise) | **1** | kiwi-nlp 부분 vendor (B-2 옵션 v4) — Step A3 + B2-vendor + D-vendor-sync. AC-V2. |

PoC 26 + v3 신규 1 = 총 27 입력 항목. 본 cycle 안 실 작업 = 16 (포함 10 + 수정 5 + v3 신규 1), 별 spec/cycle deferral = 12 (B1~B7 + C1 C2 C5 C6 — 정확). Karpathy Simplicity 의 "200줄을 50줄로" 적용 결과 5 항목이 단순화됨.

## 5. Acceptance Criteria (AC) — 총 28 개 (v4 정정, codex cycle #2 MED-1 fix)

### 5.1 단위 AC (RED 작성 → GREEN 통과 의무, 18 개)

| # | AC | 검증 |
|---|----|------|
| **AC-T1** | `createKoreanTokenizer({ wasmPath, wasmBinary?, modelDir })` 가 Promise<KoreanTokenizerHandle> 반환. close() 호출 후 재 호출 시 에러. | wikey-core test: mock fs read kiwi-wasm.wasm + 5 sample tokenize → POS tag PoC 결과와 byte-equal. |
| **AC-T2** | `tokenize('BM25 알고리즘 정확도')` 가 `['BM25', '알고리즘', '정확도']` 또는 PoC 동등 (smart_tokenize alphanumeric 보존). | PoC commands.ts:336~340 mirror — 5 sample expect. |
| **AC-T3** | `tokenize('')` / `tokenize(null as any)` → `[]` (empty 안전). | 단위 테스트. |
| **AC-I1** | `createOramaIndex({ cachePath, tokenizer })` 가 빈 인덱스 반환 (cache 부재 시). `restore()` 호출 후 doc count = 0. | 단위 테스트. |
| **AC-I2.a** | `ingestAll(wikiDir)` 가 fixture 5~10 docs ingest 후 `{ docCount: N, ms: ≤ 100 }` 반환. | wikey-core 단위 테스트 (mock wiki/ fixture). |
| **AC-I2.b** | production 117 docs (`/Users/denny/Project/wikey/wiki/` 실 corpus) ingest 후 `{ docCount: 117, ms: ≤ 2000 }`. PoC 단계 측정 660ms 의 3x buffer. | 라이브 smoke (master 직접 실행). |
| **AC-I3** | `search('BM25 알고리즘', { topN: 5 })` 가 `SearchResult[]` ≥ 1 반환, 각 result `{ path: 'wiki/...', score: number, snippet: string }` shape. | 단위 테스트. |
| **AC-I4** | `persist()` → 새 handle 에서 `restore()` → 동일 query 결과 재현 (round-trip sanity, Issue #695 mitigate). | 단위 테스트 ~30 LOC. |
| **AC-Q1** | `WIKEY_SEARCH_ENGINE='orama'` 시 production `query()` (query-pipeline.ts entry) 가 PoC §3 의 10 query benchmark 결과와 동등 — Top-1 8/10, Q5 회귀 1/10 (사용자 의도적 수용). | 라이브 cycle smoke (master 직접, obsidian-cdp + 기존 PoC benchmark command 재실행) + AC-Q5 의 production wrapper 통합. |
| **AC-Q2** | warm p50 search-only latency ≤ 50ms (LLM synthesis 제외, `execOramaSearch` 단독 호출). PoC 0.2ms 의 250배 buffer. | PoC benchmark command 재실행 (master 직접). |
| **AC-Q3** | quality regression bounded to accepted Q5 case — Q4 (ITIL) + Q10 (Obsidian) 회복으로 순 +1 우수 (codex LOW finding fix, "회귀 0" 표현 정정). | AC-Q1 의 sub. |
| **AC-Q4** | cross-lingual extraction (Ollama 영문 keyword) 작동 보존 — `containsKorean(question)` true 시 영문 keyword 추출 + Orama term 에 포함. | wikey-core integration test (mock Ollama). |
| **AC-Q5** | production query path (`query-pipeline.ts::query()`) 가 mock corpus 5 docs 에서 `engine='orama'` 시 `execOramaSearch` 호출 + `SearchResult[]` 정상 shape 반환. PoC command 와 별도, query-pipeline 진입점 통합 검증. (codex MED-3 fix) | wikey-core integration test (mock Orama handle + mock fs). |
| **AC-R1** | `cmdReindex({ searchEngine: 'orama' })` 가 Step 1+2 = `runOramaIngest` 단일 호출. validate-wiki Step 5 PASS. `ReindexOptions.searchEngine` parameter 가 `scripts-runner.ts` 진입점에서 plugin config bridge 까지 통과. | wikey-core integration test (mock fs). |
| **AC-R2** | reindex stamp file (`~/.cache/qmd/.last-reindex`) 갱신 — engine 무관 동일 path (Surgical: cache root 변경 X). | 단위 테스트. |
| **AC-R3** | quick reindex (mtime stale 만) 가 engine='orama' 에서 동작 — 변경 file 만 update. | 단위 테스트. |
| **AC-V1** | Orama schema 에 `embedding: 'vector[768]'` column 추가 가능. mock 768D vector 1회 insert + hybrid mode search round-trip PASS (Qwen3-Embedding 호환 사전 검증). | 단위 테스트. |
| **AC-W1** | "node_modules 없이 onload + Korean query PASS" — production-like 환경 (plugin folder root + `kiwi-wasm.wasm` 만 + `~/.cache/wikey/kiwi-models/cong/base/` 만) 에서 `KoreanTokenizerHandle` init + 한국어 sample 1회 tokenize PASS. node_modules 의존 없음을 확증. (codex HIGH-4 fix) | wikey-core 또는 wikey-obsidian 통합 테스트 (mock fs, plugin folder fixture). |

### 5.2 통합 AC (config bridge + 회귀 path + 라이선스 + vendor, 7 개)

| # | AC | 검증 |
|---|----|------|
| **AC-F1.a** | `wikey.conf` 에 `WIKEY_SEARCH_ENGINE=qmd` 행 → `loadFromWikeyConf` (main.ts:513) 가 인식 + `buildConfig` (main.ts:641) 가 wikey-core 의 `WikeyConfig.WIKEY_SEARCH_ENGINE` 필드에 set. (codex HIGH-2 fix) | wikey-obsidian 단위 테스트 (mock fs read). |
| **AC-F1.b** | `process.env.WIKEY_SEARCH_ENGINE=qmd` set 시 wikey.conf 값 override + query path 가 기존 qmd CLI subprocess 호출 (회귀 path 작동). 결과 수 동등. | wikey-core integration test (mock execFile + mock env). exact phrase: `WIKEY_SEARCH_ENGINE=qmd`. |
| **AC-F2** | `tools/qmd/` 디렉토리 git tracked 보존 — `git ls-files tools/qmd/ \| wc -l` ≥ 1. | grep 1 line. |
| **AC-D1** | README.md `## Search engine rollback` 섹션 신규 추가 — 3 layer 안전망 절차 (git revert / `tools/qmd/` vendored / `WIKEY_SEARCH_ENGINE=qmd` toggle) 명시. exact phrase: `WIKEY_SEARCH_ENGINE=qmd`. | grep `WIKEY_SEARCH_ENGINE=qmd` README.md hit. |
| **AC-D2** | LICENSE + NOTICE + README.md `## Third-party software` 섹션 신규 추가 (v9 — post-impl cycle #3 MED #10 reality drift fix). NOTICE 안에 다음 6 항목 모두 명시: (a) **JS wrapper layer** Kiwi NLP (LGPL-2.1) — vendored at `wikey-core/vendor/kiwi-nlp/` (sparse vendor of `bab2min/Kiwi/bindings/wasm/package/`) / (b) **WASM binary layer** Kiwi WASM — built from `bab2min/Kiwi` + Emscripten (vendor scope 외, `bab2min/Kiwi` git tag reference) / (c) **library source 위치** = `wikey-core/vendor/kiwi-nlp/{src,package.json,tsconfig.json}` (JS wrapper TS 원본) + `bab2min/Kiwi` repo root + `src/` + `include/` + `bindings/wasm/build.sh` (WASM C++) — LGPL §6 (b)(c) 의무 / (d) **JS wrapper relink mechanism (v9 정정)** = "사용자 `vendor/kiwi-nlp/src/` 수정 → 본가 `bindings/wasm/build.sh` + Emscripten 으로 `src/build/kiwi-wasm.{js,d.ts}` 재생성 (Emscripten prerequisite — vendor 안 단독 `npm run build` 는 `src/build/kiwi-wasm.js` 부재로 TS2307 fail) → vendor 안 `npm run build` (이제 PASS) → wikey-obsidian rebuild" / (e) **WASM binary relink mechanism (LGPL §6 (d))** = "사용자 `bab2min/Kiwi` clone → `bindings/wasm` + Emscripten + `./build.sh` → `kiwi-wasm.wasm` 생성 → `wikey-core/vendor/kiwi-nlp/dist/kiwi-wasm.wasm` 교체 → wikey-obsidian rebuild" 절차 명시 / (f) repository public 확증 (D4 sub-bullet) + Kiwi 사전 (`~/.cache/wikey/kiwi-models/`) = dictionary data cache 만 (LGPL relink 와 별개). | grep "LGPL-2.1" + "vendor/kiwi-nlp" + "vendor/kiwi-nlp/LICENSE" + "bab2min/Kiwi" + "build.sh" + "Emscripten" 모두 매치. |
| **AC-S1** | `./scripts/download-kiwi-models.sh` 신규 작성 — Kiwi 본가 (`bab2min/Kiwi`) model release URL (현재 v0.23.1, GitHub releases) 의 cong/base 사전 archive download + extract → `~/.cache/wikey/kiwi-models/cong/base/` 배치 (9 파일, 104MB). plugin onload 시 부재 detect → Notice 안내 + 본 script 실행 권고. (codex MED-1 fix — todo 에 있던 AC-S1 spec 에 추가) | bash test (mkdir + extract dummy). |
| **AC-V2** | kiwi-nlp 부분 vendor (B-2 옵션, §3.8 v9) — 다음 6 항목 모두 충족: (a) `wikey-core/vendor/kiwi-nlp/` 디렉토리 존재 (`bab2min/Kiwi/bindings/wasm/package/` subdir sparse vendor 결과 — `package.json` + `tsconfig.json` + 빌드 스크립트 + JS/TS wrapper src 포함) / (b) `wikey-core/vendor/kiwi-nlp/LICENSE` 존재 (Kiwi 본가 root LGPL-2.1 별 fetch) / (c) `wikey-core/vendor/kiwi-nlp/dist/build/kiwi-wasm.js` (Emscripten generated JS, npm package mirror) + **`wikey-core/vendor/kiwi-nlp/dist/kiwi-wasm.wasm`** (dist root, npm package 와 동일 위치 — v6 path 단일화) 존재 / (d) **JS wrapper import path 작동 (canonical = PoC mirror)** — `wikey-core/src/search/orama-korean-tokenizer.ts` 가 `import initKiwi from '../../vendor/kiwi-nlp/dist/build/kiwi-wasm.js'` (default export) 으로 build PASS. `dist/index.js` 경로 미사용 (Electron file:// 함정 회피). / (e) **vendor dist 절차 (v9 정정 — post-impl cycle #3 MED #10 reality drift fix)** — vendor `dist/` 는 npm `kiwi-nlp@0.23.0/dist/` 와 byte-equal mirror (sparse 보존 + dist mirror 패턴). `package-lock.json` 존재 시 `npm ci` (devDeps install 선택), `npm run build` 단독 시도는 `src/build/kiwi-wasm.js` (Emscripten generated) 부재로 TS2307 fail — vendor 정합성 의도. src customize 시 본가 `bindings/wasm/build.sh` + Emscripten prerequisite (NOTICE relink 절차 참조). / (f) `wikey-core/vendor/kiwi-nlp/VENDOR.md` 신규 (Kiwi git tag + vendor date + wikey 측 수정분 + sync docs reference) + `docs/kiwi-nlp-vendor-sync.md` 신규 (수동 sync 절차 ~50 줄, §5.7.5 자동화 reference). (사용자 raise v3 + codex cycle #2 HIGH-B fix v4 + cycle #3 HIGH-1/HIGH-2 fix v5 + cycle #4 HIGH-1/MED-3 fix v6 + post-impl cycle #3 MED #10 fix v9) | grep `wikey-core/vendor/kiwi-nlp/dist/build/kiwi-wasm.js` import path + `wikey-core/vendor/kiwi-nlp/dist/kiwi-wasm.wasm` + `wikey-core/vendor/kiwi-nlp/LICENSE` + ls VENDOR.md / sync docs. |

### 5.3 라이브 cycle smoke AC (master 직접, obsidian-cdp, 3 개)

| # | AC | 검증 |
|---|----|------|
| **AC-L1** | obsidian-cdp full ingest cycle (raw/0_inbox/test.md → Brief → Proceed → Processing → Preview → Approve → wiki write) 1회 PASS — engine='orama' default. | master 직접 실행, console log + wiki/sources/ 신규 페이지 1개 확증. |
| **AC-L2** | 한국어 query (예: "PMBOK 통제 도구 변경 관리") + 영문 query (예: "BM25 algorithm") 각 1회 sidebar-chat 실행 → 답변 + citation 정상. **search-only latency p95 ≤ 200ms (LLM synthesis 제외, query-pipeline 의 `execOramaSearch` 단독 측정)** + cold 1회 제외. (codex MED-4 fix) | console log latency 별 측정 (LLM 호출 전·후 timestamp 분리). |
| **AC-L3** | `WIKEY_SEARCH_ENGINE=qmd` 환경변수 set + Obsidian 재시작 → 동일 query 결과 (회귀 path 작동 확증). exact phrase: `WIKEY_SEARCH_ENGINE=qmd`. | master 직접. |

## 6. Risk grid + 완화 (v2 갱신, codex cycle #1 finding 반영)

| # | Risk | Severity | 확률 | 완화 | AC |
|---|------|----------|------|------|-----|
| 1 | Kiwi WASM packaging fail (Electron production build) | HIGH | LOW | PoC 단계 2-B PASS — Module.instantiateWasm hook 검증 path 그대로 + §3.7 Option A esbuild plugin asset copy 명시. | AC-T1, AC-W1, AC-L1 |
| 2 | Orama Electron renderer file:// 함정 동일 | HIGH | LOW | PoC 단계 2-A PASS — esbuild bundle path. | AC-T1, AC-L1 |
| 3 | 검색 quality 회귀 ≥ 10% | HIGH | LOW | PoC 단계 3 동등+ 검증. Q5 의도적 수용 명시. | AC-Q1, AC-Q3 |
| 4 | Orama in-memory + persist 512MB 한계 | MED | LOW (현 117 docs / ~5천 docs 안전 추정) | 잔존 — 향후 segment splitting 별 cycle. | (없음, 모니터링) |
| 5 | Issue #695 persistence 정확도 회귀 | MED | LOW | round-trip sanity test. | AC-I4 |
| 6 | 벡터 backend 차이 (qmd HNSW vs Orama 자체) | MED | LOW (BM25-only 1차) | 본 cycle 은 schema 호환 sanity 만, 실 hybrid reroute 별 sub-cycle. | AC-V1 |
| 7 | 한국어 운영 사례 0 (wikey 1호) | MED | LOW | community PR 가능, PoC 검증으로 1차 안정성 확증. | (잔존) |
| 8 | feature flag toggle 회귀 path 미작동 | HIGH | MED | (codex HIGH-2 fix) §3.3.1 plugin config bridge 명시 + AC-F1.a (wikey.conf bridge) + AC-F1.b (env override) + AC-L3 (라이브 toggle smoke). | AC-F1.a, AC-F1.b, AC-L3 |
| 9 | Migration scope 누락 (5 critical files 외 hidden 호출) | MED | MED | grep `qmd` 전체 wikey-core/src + scripts-runner — 검증 단계에 master 1차 수행. | (검증) |
| 10 | default Orama path 가 qmd 탐색에 선행 차단 (HIGH-1 codex finding) | HIGH | (해제) | (codex HIGH-1 fix) §3.4 — `query()` 최상단 engine 판정 + `findQmdBin()` 을 engine='qmd' branch 안으로 한정. | AC-Q5 |
| 11 | Kiwi WASM binary `node_modules/` 의존 (HIGH-4 codex finding) | HIGH | (해제) | (codex HIGH-4 fix) §3.7 Option A esbuild plugin asset copy + AC-W1 "node_modules 없이 onload PASS". | AC-W1, AC-L1 |
| 12 | reindex path engine 입력 누락 (HIGH-3 codex finding) | HIGH | (해제) | (codex HIGH-3 fix) §3.5 + §3.5.1 `ReindexOptions.searchEngine` + `scripts-runner.ts:36` bridge 명시. | AC-R1 |
| 13 | kiwi-nlp 코드 내재화 motivation 미충족 (사용자 raise v3) | HIGH | (해제) | (사용자 raise v3 fix) §3.8 — kiwi-nlp 부분 vendor (`wikey-core/vendor/kiwi-nlp/`) + sync 절차 docs. §5.7.2 통찰 ("내재화 = customize 가능") 직접 충족. | AC-V2 |
| 14 | kiwi-nlp upstream sync 미정 (vendor 도입 후 운영 부담) | MED | LOW (vendor 1회, ~3K LOC 작은 규모) | 본 cycle 안 수동 sync 절차 docs. 자동화 (npm outdated + diff 보고 + review queue) 별 spec `phase-5-todox-5.7.5-orama-update-sync.md` B7 항목 deferral. | AC-V2, §1.2 B7 deferral |

## 7. Self-check (rules.md §10 20-anchor + codex cycle #1~#6 finding 재검증)

본 spec v8 의 20-anchor self-check (master 직접 cross-check — Layer 1 7-anchor + Layer 2 6 codex 패턴 P1~P6 + Layer 3 7 fix 모드 F1~F7, codex cycle #6 NEEDS_REVISION 4 finding fix 후 재실행):

| # | Anchor | 결과 | 검증 명령 |
|---|--------|------|-----------|
| (a) | 시그니처 일관성 — `KoreanTokenizerHandle` / `OramaIndexHandle` / `WIKEY_SEARCH_ENGINE` / `ReindexOptions.searchEngine` (v2) / `wikey-core/vendor/kiwi-nlp/{src,dist,LICENSE}` (v3+v4) / `getExecEnv()` env 주입 (v4 §3.5.1) 전 cross-file 동일 | PASS_v8 — §3 (3.1~3.8) + AC §5 (28 row) + Risk §6 (14건) 모두 일관 | `grep -nE "KoreanTokenizerHandle\|OramaIndexHandle\|WIKEY_SEARCH_ENGINE\|searchEngine\|vendor/kiwi-nlp" plan/phase-5/phase-5-spec-5.7.4-orama-migration.md` |
| (b) | state/data 표 형식 — 27 입력 항목 (PoC 26 + v3 신규 1) 검증 표 + §5 AC numbering (실제 bold row 28 = §5.1 18 + §5.2 7 + §5.3 3) 일관. 헤더 카운트 = 18/7/3/28 | PASS_v8 — count drift 0 (codex MED-1 fix), 모든 AC 가 §5 정의 + §6 Risk AC 컬럼 + §3 변경 영역 1:1 mapping | `grep -cE "^\| \*\*AC-" plan/phase-5/phase-5-spec-5.7.4-orama-migration.md` = 28 |
| (c) | builder/parser 분기 — `query()` 최상단 engine 판정 (§3.4) + `cmdReindex` engine 분기 (§3.5) + `ReindexOptions.searchEngine` + scripts-runner public API env injection path (§3.5.1 v4) | PASS_v8 — 모든 분기 + bridge path 명시 | grep `"engine === 'qmd'"` + `"env.WIKEY_SEARCH_ENGINE"` |
| (d) | AC ↔ §1 목표 1:1 매핑 | PASS_v8 — 목표 6항 → AC-Q1, Q5 (목표 1) / AC-T1~T3 + AC-I1~I4 + AC-W1 + AC-V2 + AC-R1~R3 (목표 2 tokenizer ownership + ingest + vendor v3+v4) / AC-F1.a + F1.b (목표 3) / AC-F1.b + F2 + D1 (목표 4) / AC-Q3 (목표 5) / AC-Q2 + L2 (목표 6) | line-by-line 검증 |
| (e) | self-check 모든 행 drift 없음 — v8 cycle 후 stale 0 본문 한정 (HIGH/MED finding 누적 35+ 항목 모두 §1.2 / §3 / §5 / §6 / §8 에 반영 확증, `## 변경 이력` + `### 7.1 cycle cross-check` 안 historical 표현은 의도적 보존 — F5) | PASS_v8 | §8 변경 이력 v1~v8 모두 명시 |
| (f) | footer + cycle 번호 — frontmatter version: v8 ↔ §8 v8 ↔ footer cycle #7 | PASS_v8 | grep `"version: v8"` + `"cycle #7"` |
| (g) | 코드 ↔ test exact phrase — `smart_tokenize` 명세 (§3.1) ↔ AC-T2 의 expected output (`['BM25', '알고리즘', '정확도']`) + `WIKEY_SEARCH_ENGINE=qmd` exact phrase (AC-F1.b / AC-D1 / AC-L3) + `wikey-core/vendor/kiwi-nlp/{src,LICENSE,dist}` import path exact (AC-V2 v4) + `npm run build` rebuild 절차 (AC-D2 v4) | PASS_v8 — quote 정합 일치 (codex LOW fix) | `grep -F "BM25', '알고리즘', '정확도"` + `grep -cF "WIKEY_SEARCH_ENGINE=qmd"` ≥ 3 + `grep -F "wikey-core/vendor/kiwi-nlp"` + `grep -F "npm run build"` |

### 7.1 codex cycle #1 9 finding (v2) + 사용자 raise v3 + codex cycle #2 6 finding (v4) 반영 cross-check

| Finding | 위치 | fix 적용 | AC 보강 |
|---------|------|-------------|---------|
| **cycle #1 HIGH-1** default Orama qmd 선행 차단 | §3.4 query() 최상단 engine 판정 | v2 OK | AC-Q5 신규 |
| **cycle #1 HIGH-2** feature flag plugin bridge 미연결 | §3.3.1 신규 (main.ts:513 + 641 + env override) | v2 OK | AC-F1.a / F1.b 분리 |
| **cycle #1 HIGH-3** reindex engine 입력 없음 | §3.5 + §3.5.1 (ReindexOptions.searchEngine + scripts-runner bridge) | v2 OK / v4 보강 | AC-R1 보강 |
| **cycle #1 HIGH-4** Kiwi WASM node_modules 의존 | §3.7 신규 (Option A esbuild plugin asset copy) | v2 OK / v4 보강 | AC-W1 신규 |
| cycle #1 MED-1 AC count drift | §5 표 v4 정정 (28 = 18+7+3) | v4 OK | — |
| cycle #1 MED-2 AC-I2 117 docs vs fixture 5~10 모순 | AC-I2.a + AC-I2.b 분리 | v2 OK | — |
| cycle #1 MED-3 PoC benchmark 만으로 production 검증 불가 | AC-Q5 신규 | v2 OK | — |
| cycle #1 MED-4 AC-L2 200ms full sidebar-chat 비현실적 | AC-L2 search-only 명시 | v2 OK | — |
| cycle #1 MED-5 D1~D5 비목표 vs AC-D2 포함 모순 | §1.2 D 그룹 표현 정정 | v2 OK | — |
| cycle #1 LOW quality 회귀 표현 / exact phrase | AC-Q3 표현 정정 + WIKEY_SEARCH_ENGINE=qmd quote-less 일치 | v2 OK | — |
| **사용자 raise v3 — kiwi-nlp 코드 내재화 정합성** | §3.8 신규 (B 옵션 부분 vendor) + §1.2 B7 deferral 명시 + AC-V2 신규 | v3 OK / v4 보강 | AC-V2 신규 / Risk #13 #14 신규 |
| **cycle #2 HIGH-A** v3 dep 제거 vs §3.7 + PoC node_modules 경로 잔존 | §3.7 esbuild copy source = vendor path + PoC code 의 npm 경로는 PoC cleanup 시점까지 잠정 보존 정책 명시 | v4 OK | AC-W1 보강 (PoC scope 외) |
| **cycle #2 HIGH-B** `npm pack` 절차로는 src/LICENSE 미수집 | §3.8 v4 = upstream `bab2min/kiwi-nlp` GitHub git tag v0.23.0 archive (B-2 옵션, 사용자 결정 2026-05-09) — src TS + LICENSE + 빌드 스크립트 모두 포함 + 1회 build 절차 | v4 OK | AC-V2 보강 (5 항목 명시) |
| **cycle #2 HIGH-C** LGPL §6 relink mechanism 부정확 | §3.8 v4 = LGPL §6 (a)(b)(c)(d) 4 의무 충족 path 표 + AC-D2 보강 (vendor src + LICENSE + rebuild 절차 NOTICE 명시 + ~/.cache/wikey/kiwi-models/ = dictionary cache 만 명확화) | v4 OK | AC-D2 보강 |
| **cycle #2 MED-1** AC count drift 잔존 (23/24/28) | §5 헤더 16/4/3 → 18/7/3 + total 23 → 28 + self-check (b) `grep -cE` 28 단일화 | v4 OK | — |
| **cycle #2 MED-2** scripts-runner public API mismatch | §3.5.1 v4 = `reindexWiki/reindexQuick(basePath, env)` public API + `getExecEnv()` env injection path 명시 (Karpathy Surgical, 시그니처 변경 안 함) | v4 OK | AC-F1.b 보강 |
| **cycle #2 MED-3** §4.2 / §4.5 B 그룹 6→7 stale | §4.2 = 7 항목 (B7 추가) + §4.5 deferral 11→12 갱신 | v4 OK | — |

### 7.2 master 1차 검증 — codex pattern 학습 적용 의무 (사용자 raise 2026-05-09 v7 영구 등록)

**사용자 raise (2026-05-09 v7)**: "master 검증단계에서 codex가 검증하는 것 이상의 높은 기준을 가지고 검증하는게 중요해. codex의 검증패턴을 너가 학습했으면 좋겠다."

**근거 분석**: 본 §5.7.4 cycle 시리즈 (1 master 1차 + 5 codex = 누적 32 finding) 의 codex finding 을 type 분석한 결과, codex 가 raise 한 finding 의 ~80% 가 다음 6 패턴으로 분류 가능. master 가 codex 송부 *전* 에 본 6 패턴 self-check 의무 — cycle 누적 회피.

| Pattern | 정의 | 본 cycle 위반 사례 (codex 가 catch) | master 1차 self-check 명령 |
|---------|------|------------------------------------|----------------------------|
| **(P1) Fact-check** | 외부 source (npm package / GitHub repo / file path / line number / framework default) 직접 read 후 spec 표현과 일치 확증 | cycle #2 HIGH-B (`npm pack` files: dist only — master 가 사전에 `cat node_modules/kiwi-nlp/package.json` 안 했음), cycle #3 HIGH-1 (bab2min/Kiwi 본가 — package.json repository field), cycle #4 HIGH-1 (wasm = `dist/kiwi-wasm.wasm` dist root — `find` 결과) | `cat node_modules/<dep>/package.json` + `find ... -name 'pattern'` + line number `sed -n` reality check |
| **(P2) Cross-file consistency** | 한 결정 변경 시 spec §3 / §5 / §6 + todo step / check-box / self-check 모든 reference 일관 grep | cycle #5 MED-1 (lockfile fallback — AC-V2/Step A3 fix 했지만 §3.8 vendor procedure / B2-vendor 미반영, 4 way drift) | `grep -cE pattern` count 일치 + 모든 reference grep + diff |
| **(P3) Spec→Todo byte mirror** | sample 양식 (NOTICE / 코드 snippet / table) 의 spec canonical 정의 후 todo 가 byte-level copy 의무 | cycle #4 HIGH-2 (todo NOTICE 양식 v4 잔존 — spec AC-D2 v5 6 항목 미mirror), cycle #5 MED-2 (semantic mirror 만, byte 차이) | `diff <(grep -A N "anchor" spec) <(grep -A N "anchor" todo)` |
| **(P4) Implementation feasibility** | 구현자 관점 — runtime path 존재 / 전제 (lockfile / 환경 / SDK) / Electron 호환 / production 배포 환경 모두 검토 | cycle #1 HIGH-4 (PoC node_modules path → vault 부재), cycle #4 MED-3 (npm ci lockfile 전제 — sparse subdir 부재 가능), cycle #1 HIGH-1 (query() 최상단 engine 판정 — engine='orama' 라도 qmd 탐색 fail 가능) | "구현자가 본 절차 그대로 따르면 어디서 fail 가능?" 가설 + path/file/lockfile/env 모두 reality check |
| **(P5) Legal accuracy** | 라이선스 의무 (LGPL §6 / MIT / Apache-2.0 등) 모든 항목 명시 + relink mechanism path 정확 + scope 명확 | cycle #2 HIGH-C (LGPL §6 (d) relink 부정확 — `~/.cache/wikey/kiwi-models/` 가 아닌 vendor src/build 절차), cycle #3 HIGH-3 (wasm binary source 분리 명시 의무) | LGPL/MIT/Apache 본문 read + 모든 의무 항목 명시 확증 + scope (JS wrapper vs WASM binary 등 layer) 분리 |
| **(P6) Numeric consistency** | count drift — bold row 실 카운트 vs 헤더 카운트 vs self-check 카운트 grep 일치 | cycle #2 MED-1 (AC count 16/23/24/28 4 way drift — bold row 실 카운트 안 셈), cycle #4 MED-1 (AC 16 stale 일부 위치만 fix), cycle #5 MED-1 (lockfile fallback 일부 위치 fix) | `grep -cE "^\| \*\*AC-"` 실 카운트 vs 모든 헤더/표/self-check 표현 단일화 |

**위반 시정 (master 영구 등록)**:
- master 가 본 6 패턴 적용 시 codex finding 의 ~80% 사전 catch 가능 (5 cycle 실측 — 32 finding 중 ~24 finding 이 본 6 패턴 self-check 으로 사전 catch 가능)
- 본 6 패턴은 *7-anchor (a)~(g)* 위에 추가 layer — 7-anchor 는 *internal consistency*, 6 패턴은 *external reality + cross-file + implementation* 영역
- 향후 모든 cycle 의 master 1차 검증 = 7-anchor + 6 패턴 = 13 anchor 의무
- 글로벌 정책 mirror = `~/.claude/projects/-Users-denny-Project-wikey/memory/feedback_master_codex_pattern_learning.md` (master 영구 등록) + 글로벌 rules.md `claude-harness-helper/rules/rules.md §10` (사용자 승인 2026-05-09 갱신, 모든 project 적용)

**본 v7 적용 결과**: 사용자 raise 직후 master 가 본 6 패턴 spec/todo 안에 명시 + 다음 cycle (#6) 부터 master 1차 송부 전 P1~P6 self-check 의무. cycle #6 codex 송부 prompt 안에 본 6 패턴 cross-check 결과 명시.

### 7.3 master fix 7 실패 모드 (사용자 raise 2026-05-09 v7 영구 등록)

**사용자 raise (추가)**: "master fix 단계에서도 너가 놓치는 부분이 많아서, 다시 codex 가 재검증에서 문제점들이 드러나고 있는거잖아. claude code + codex 검증에서 master 가 주의해야 할 점을 community 에서 조사해서 너가 주시할 수 있게 기록해줘."

**근거 분석**: 본 cycle 시리즈 누적 (1 master + 5 codex = 32 finding) 의 master fix 실패 사례 + Claude Code 공식 multi-agent code review best practice ([Code Review - Claude Code Docs](https://code.claude.com/docs/en/code-review) / [Anthropic launches a multi-agent code review tool — The New Stack](https://thenewstack.io/anthropic-launches-a-multi-agent-code-review-tool-for-claude-code/) / [Code Review – Claude Plugin | Anthropic](https://claude.com/plugins/code-review)) 통합.

| # | 실패 모드 | 본 cycle 위반 사례 | 대응 |
|---|---------|-------------------|------|
| **(F1)** Partial replacement | `Edit replace_all=false` 로 한 위치만 fix → 다른 reference 잔존 | cycle #5 MED-1 (lockfile fallback — AC-V2/Step A3 만 fix, §3.8 vendor procedure 미반영) | 모든 reference `grep -c pattern` count → fix 후 count 일치. 단순 rename 은 `replace_all=true` 우선 |
| **(F2)** Cascading rename incomplete | path/name rename 시 일부 위치만 갱신 | cycle #4 MED-1 (`AC 16` stale 잔존), cycle #4 HIGH-1 (`dist/build/kiwi-wasm.wasm` 잔존), cycle #5 LOW (`bab2min/kiwi-nlp` 잔존) | `replace_all=true` + 후속 grep 으로 잔존 0 확증 |
| **(F3)** Header/Body mismatch | 표 헤더 ("총 16 AC") 와 body row 실 카운트 불일치 | cycle #1/#2 MED-1 (AC count 16/23/24/28 4-way drift) | header 변경 시 body row count 실측 (`grep -cE "^\| \*\*"`) + 양쪽 일치 |
| **(F4)** Spec→Todo mirror 누락 | spec canonical 갱신 시 todo mirror 누락 | cycle #4 HIGH-2 (todo NOTICE 양식 v4 잔존), cycle #5 MED-2 (semantic mirror 만, byte 차이) | spec 변경 후 todo 의 모든 mirror 영역 grep + diff |
| **(F5)** History context 와 활성 본문 혼동 | 변경 이력 row 안 historical 표현 (예: "v4 의 npm pack 폐기") 을 stale 로 오인 + fix 시 history 손상 | cycle #5 LOW (`bab2min/kiwi-nlp` 변경 이력 잔재 — historical context 라 의도적 보존) | `## 변경 이력` 섹션 + `### 7.1 cycle cross-check` 표 안 표현은 historical 로 *의도적 보존*, self-check anchor (e) 의 "drift 0" 는 *본문 (§1~§6)* 한정 명시 |
| **(F6)** Implementation feasibility 미검증 | spec 표현이 정확해도 구현자가 따르면 fail 가능 | cycle #1 HIGH-4 (PoC node_modules path → vault 부재), cycle #4 MED-3 (`npm ci` lockfile 전제 — sparse subdir 부재 가능) | 모든 절차 step 마다 "구현자가 본 절차 그대로 따르면 어디서 fail 가능?" reality check (lockfile / runtime / env / file existence) |
| **(F7)** Codex 권고 over-literal 적용 | codex "권고: X 로 수정" 표현을 master 가 X 만 fix 하고 모든 reference + 의도 미적용 (semantic vs byte) | cycle #5 MED-2 (NOTICE semantic mirror 만, byte-level mirror 누락) | codex 권고를 *spirit* 으로 해석 + 모든 영향 범위 광범위 적용 + spec→todo 연쇄 의무 |

### 7.4 Claude Code 공식 multi-agent best practice 통합

[Anthropic 공식 multi-agent code review](https://claude.com/blog/code-review) 의 9 specialized agents (security / SOLID / architecture / error handling / performance / testing / code smells / patterns / framework idioms) 가 *parallel* 분석 + verification step 으로 false positive 필터. wikey §5.7.4 cycle 시리즈와의 통합 시사점:

| Best practice | wikey §5.7.4 적용 |
|---------------|------------------|
| **Parallel domain analysis** (9 agent parallel) | master 가 *single self-check* 보다 6 패턴 (P1~P6) + 7 fix 모드 (F1~F7) *별로 단계별* self-check 의무 = 13 anchor 추가 (기존 7-anchor + 13 = **20 anchor** 의무) |
| **Verification against actual code behavior** (false positive filter) | master *static text grep* 외 *실 환경 fact-check* (file system + npm package + line number + framework default) 의무. WebSearch / Read / Bash 적극 활용 |
| **Iterative review-fix-review cycle** (push → auto-review → auto-resolve) | master fix 가 *완전* 해야 다음 cycle 에서 같은 type finding 재현 안 함 (F1~F7 회피) |
| **Large PR finding rate** (1000+ LOC = 84% rate / 7.5 issues avg) | wikey §5.7.4 spec v7 = 720+ lines, 누적 32 finding = community 평균과 일치 — 향후 대형 spec 작성 시 master 1차 = 6 패턴 + 7 fix 모드 사전 catch 80% 목표 |

### 7.5 적용 의무 (master 영구 등록)

- **모든 master 1차 self-check** = `rules.md §10` 7-anchor (a~g) + spec §7.2 6 codex 패턴 (P1~P6) + spec §7.3 7 fix 실패 모드 (F1~F7) = **20 anchor 의무**
- master fix 직후 grep 검증 = `replace_all` 사용 + count 일치 + 외부 source fact-check 모두 의무
- codex 송부 prompt 안에 본 6 패턴 + 7 fix 모드 self-check 결과 명시 의무
- 위반 시 cycle 누적 → 사용자 신뢰 저해 → fix 보다 예방 우선
- **글로벌 mirror**: `~/.claude/projects/-Users-denny-Project-wikey/memory/feedback_master_codex_pattern_learning.md` (wikey project memory) + `claude-harness-helper/rules/rules.md §10` 갱신 권고 (사용자 승인 후 별 commit, 모든 project 적용)

## 8. 변경 이력

| 버전 | 일시 | 변경 |
|------|------|------|
| **v1** | 2026-05-09 session 28 | 초안 — 목표/비목표 + 26 todo 4-question 검증 + 16 AC + Risk 9 + 7-anchor self-check |
| **v2** | 2026-05-09 session 28 | codex cycle #1 NEEDS_REVISION fix — 4 HIGH (query() engine 판정 / plugin config bridge / ReindexOptions.searchEngine / Option A esbuild wasm copy) + 5 MED (AC count drift / AC-I2 분리 / AC-Q5 신규 / AC-L2 search-only / D 그룹 비목표 표현) + 3 LOW (quality 표현 / exact phrase / AC-T3 유지). AC 16→23, Risk 9→12, §3.3.1 / §3.5.1 / §3.7 신규. 사용자 결정 (Option A esbuild plugin asset copy) 영구 등록. |
| **v3** | 2026-05-09 session 28 | 사용자 raise (kiwi-nlp 코드 내재화 정합성) — B 옵션 (부분 vendor) 채택. §3.8 신규 (`wikey-core/vendor/kiwi-nlp/` ~3K LOC vendor + sync 절차 docs `docs/kiwi-nlp-vendor-sync.md`). AC-V2 신규 (vendor import path + sync docs 검증). §1.2 B 그룹 6→7 항목 (B7 = kiwi-nlp source upstream sync 추가) → 별 spec `phase-5-todox-5.7.5-orama-update-sync.md` deferral 재명시. Risk #13 #14 신규. AC 23→24. §5.7.2 통찰 ("내재화 = customize 가능") 직접 충족. |
| **v4** | 2026-05-09 session 28 | codex cycle #2 NEEDS_REVISION fix — 3 HIGH + 3 MED 직접 fix. (HIGH-A) §3.7 esbuild copy source = vendor path 고정 + PoC code 의 npm 경로 의존성은 *PoC cleanup 시점까지 잠정 보존* 정책 명시. (HIGH-B) **사용자 결정 = B-2 (upstream git source archive)** — `npm pack` 폐기, `bab2min/kiwi-nlp` v0.23.0 git archive 사용 (src TS + LICENSE + 빌드 스크립트 + 1회 build). AC-V2 보강 (5 항목). (HIGH-C) LGPL §6 4 의무 충족 path 표 + AC-D2 보강 (vendor src + LICENSE + relink mechanism NOTICE 명시). (MED-1) AC count 23/24 → 28 (= 18+7+3 bold row) 단일화. §5 헤더 + self-check + 모든 reference 일관. (MED-2) §3.5.1 v4 = scripts-runner public API (`reindexWiki/reindexQuick(basePath, env)`) + `getExecEnv()` env injection path 정확 명시. (MED-3) §4.2 B 그룹 6→7 + §4.5 deferral 11→12 갱신. |
| **v5** | 2026-05-09 session 28 | codex cycle #3 NEEDS_REVISION fix — 3 HIGH + 2 MED + 1 LOW 직접 fix. (master `package.json` fact-check) (HIGH-1) `bab2min/Kiwi` 본가 + `bindings/wasm/package/` subdir sparse vendor. (HIGH-2) canonical import = `dist/build/kiwi-wasm.js`. (HIGH-3) AC-D2 NOTICE 6 항목 + LGPL §6 분리. (MED-1, MED-2, LOW). |
| **v6** | 2026-05-09 session 28 | codex cycle #4 NEEDS_REVISION fix — 2 HIGH + 3 MED + 2 LOW 직접 fix. (HIGH-1) WASM binary path 단일화 = `dist/kiwi-wasm.wasm`. (HIGH-2) todo NOTICE mirror. (MED-1/2/3, LOW-1/2). |
| **v7** | 2026-05-09 session 28 | codex cycle #5 NEEDS_REVISION fix — HIGH 0 (spec 본질 수렴) + MED 2 + LOW 1 직접 fix. (MED-1) vendor build fallback 일관. (MED-2) NOTICE byte-level mirror canonical. (LOW) historical context F5 명시. + 사용자 raise v7 (codex 패턴 학습 + community 조사 + 글로벌 rules §10 갱신) — spec §7.2/7.3/7.4/7.5 신규. |
| **v8** | 2026-05-09 session 28 | codex cycle #6 NEEDS_REVISION fix — HIGH 0 (본질 quality 유지) + MED 3 + LOW 1 직접 fix. (MED-1) NOTICE byte mirror — todo Step D-LICENSE 의 6 항목을 spec AC-D2 line 641 canonical 에서 byte-copy (lockfile fallback `(if [ -f package-lock.json ]; then npm ci; else npm install; fi)` 형식 통일). (MED-2) §7 self-check stale — 헤더 "cycle #1~#4" → "cycle #1~#6", "본 spec v6" → "본 spec v8", anchor (e) "v4 cycle 후" → "v8 cycle 후" + F5 의도적 보존 명시. todo §5 self-check + footer 도 v8/cycle #7 갱신. (MED-3) rules §10.2/§10.3 ↔ spec §7.2/§7.3 = byte mirror 의도적 분리 — rules = 글로벌 정책 (간결), spec = wikey §5.7.4 cycle 사례 컬럼 추가. (LOW) spec §7.5 line 727 memory path 오타 `feedback_codex_pattern_learning.md` → `feedback_master_codex_pattern_learning.md` 정정. master *byte 일치* 까지 grep 검증 의무 학습. |
| **v9** | 2026-05-09 session 28 (post-impl Step D) | post-impl cycle #3 MED #10 reality drift fix — vendor `npm run build` 가 `src/build/kiwi-wasm.js` (Emscripten generated) 부재로 TS2307 fail. master 결정 = vendor `dist/` = npm `kiwi-nlp@0.23.0/dist/` byte-equal mirror (sparse 보존 + dist mirror 패턴). src customize 시 본가 `bindings/wasm/build.sh` + Emscripten prerequisite. **정정 위치**: §3.8 dist build artifact 행 / vendor 절차 step 5+6 / LGPL §6 (d) relink mechanism / §5 AC-V2(e) + AC-D2(d). 본 cycle runtime 동작 정상 (vendor mirror dist 사용 — query/index/reindex 모두 OK), spec ↔ reality drift 만 정정. v9 는 라이브 smoke (AC-L1/L2/L3 + PoC benchmark + MED #13 cross-process invalidation 라이브 검증) 모두 PASS 후 진행. |

---

> **footer (cycle 추적)**: §5.7.4 spec v9 작성 완료 — post-impl 6 cycle (codex APPROVE_WITH_CHANGES) + master fix loop (LOW #6 fix + Step D 진입) + 라이브 smoke (master 직접 obsidian-cdp full cycle smoke + PoC benchmark + MED #13 cross-process 라이브 검증) PASS → Step D (LICENSE / NOTICE / README rollback / VENDOR.md / spec v9) 진행 중.
