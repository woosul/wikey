---
phase: 5
section: 5.7.4
title: Orama 마이그레이션 — qmd CLI 대체 (Todo, HOW)
status: planning
created: 2026-05-09
updated: 2026-05-09
version: v8
---

# Phase 5 §5.7.4 Orama 마이그레이션 — qmd CLI 대체 (Todo, HOW)

> **상위 문서**: [`docs/planning/phase-5/phase-5-todo.md §5.7.4`](./phase-5-todo.md) (실행 단일 소스 — 체크박스 mirror) · [`docs/planning/phase-5/phase-5-spec-5.7.4-orama-migration.md`](./phase-5-spec-5.7.4-orama-migration.md) (Spec, WHAT — 4-question 검증 + AC + Risk) · [`docs/sessions/phase-5/phase-5-resultx-5.7.3-orama-poc-2026-05-09.md`](../../sessions/phase-5/phase-5-resultx-5.7.3-orama-poc-2026-05-09.md) (PoC evidence)
>
> **버전 이력**:
> - v1 (2026-05-09 session 28, 초안): SDD+TDD 흐름 mirror (§5.11 v2.5 양식) + 검증 의무 매트릭스 + Step A~D 단계별 체크박스 + 자체 7-anchor self-check.
> - v2 (2026-05-09 session 28, codex cycle #1 NEEDS_REVISION mirror): spec v2 의 9 finding fix 와 동기화 — Step A2 (config bridge main.ts:513 + 641) / Step B2-A1 (esbuild plugin asset wasm copy Option A) / Step B2-A5 (ReindexOptions.searchEngine) / Step B2 RED case 13→16 (AC-Q5 / AC-W1 / AC-V2 추가).
> - **v3 (2026-05-09 session 28, 사용자 raise B 옵션 채택)**: kiwi-nlp 부분 vendor (`wikey-core/vendor/kiwi-nlp/` ~3K LOC) + sync 절차 docs (`docs/architecture/kiwi-nlp-vendor-sync.md`) + B7 (kiwi-nlp source upstream sync) §5.7.5 별 spec deferral 명시. Step A 에 vendor 절차 추가 / Step D 에 sync docs 추가.
> - **v4 (2026-05-09 session 28, codex cycle #2 NEEDS_REVISION fix)**: 3 HIGH + 3 MED 직접 fix mirror (spec v4 와 동기화). (HIGH-A) Step A3 vendor 절차 = upstream git source archive 으로 정정 (npm pack 폐기) + Step C 의 PoC benchmark 재실행 step 안 npm dep 잠정 보존 정책 명시. (HIGH-B) Step A3 = `bab2min/kiwi-nlp` v0.23.0 git tag archive download + `npm ci && npm run build` 1회 + LICENSE / src 보존 검증. (HIGH-C) Step D-LICENSE 의 NOTICE 양식 = LGPL §6 4 의무 (notice + license copy + library source + relink mechanism) 충족 명시. (MED-1) §4 표의 AC mapping + B1 RED case count 정정 (18 → 19, AC-D2 추가). (MED-2) Step B2-A5 의 scripts-runner / main.ts:461 / getExecEnv 정확 path. (MED-3) 26 검증 표 의 deferral 12 항목 (B1~B7 + C1, C2, C5, C6).
>
> **wiki 재생성 없음 확증**: 검색 backend 교체 (qmd CLI → Orama in-process). wiki 본문 / frontmatter / 페이지 변경 0. ingest pipeline 결과 (canonicalizer / mention extractor) 변경 X.
>
> **실행 단일 소스**: `docs/planning/phase-5/phase-5-todo.md §5.7.4` (체크박스 = 진행 상태). 본 문서는 step-by-step 분해 + 검증 의무만 기술.

---

## 1. 진행 구조 — SDD + TDD 강제 (§5.11 v2.5 양식 mirror)

**Spec-Driven + Test-Driven 의무 흐름**:

```
Phase 0  Spec lock (phase-5-spec-5.7.4-orama-migration.md v1) → master 7-anchor 1차 grep → codex Mode D Panel 2차 검증 (cycle #1)
                                                                    ↓ APPROVE / NEEDS_REVISION
Phase 1  Step A — 환경 세팅 (Kiwi 사전 cache 확보 + WIKEY_SEARCH_ENGINE config 도입 + PoC 코드 reuse 결정)
Phase 2  Step B — TDD RED: 단위 테스트 신규 case 작성 (orama-korean-tokenizer + orama-index + query-pipeline + reindex) → 모두 FAIL 확증
Phase 3  Step B — TDD GREEN: A1~A8 구현 → 단위 + 기존 회귀 모두 PASS
Phase 4  Step B — TDD BLUE Phase 3a: 회귀 검증 (npm test + npm run build + ./scripts/validate-wiki.sh)
Phase 5  Step B — TDD BLUE Phase 3b: refactor (함수 분해 / Naming / DRY / 가독성), CLAUDE.md 정책 의무
Phase 6  Step C — typecheck + build + 단위 PASS + 라이브 cycle smoke (master 직접 obsidian-cdp)
Phase 7  Step B 코드 + Step C smoke 결과 → codex Mode D Panel 2차 검증 (cycle #2 post-impl)
Phase 8  Step D — 문서 동기화 (wikey.schema.md 검색 코어 안정성 / docs/sessions/phase-5/phase-5-result.md §5.7.4 entry / wiki/log.md / phase-5-todo.md mirror) + LICENSE/NOTICE/README + commit
Phase 9  최종 master 1차 검증 + 사용자 사전 보고
```

---

## 2. 검증 의무 매트릭스 (rules.md §10 + agent-management.md §7 + §5.11 양식)

| 단계 | master 1차 | codex 2차 (Mode D Panel) | tester | 라이브 smoke |
|------|-----------|--------------------------|--------|--------------|
| Phase 0 spec lock | spec §7 7-anchor grep | cycle #1 (plan APPROVE) | — | — |
| Phase 1 Step A | env / cache 확증 | — | — | — |
| Phase 2~3 TDD RED/GREEN | 매 RED/GREEN 후 fresh `npm test` (wikey-core + wikey-obsidian) | — | (master 직접 — TDD 강제) | — |
| Phase 4~5 BLUE 3a + 3b | 회귀 + refactor 후 fresh test/build/validate-wiki | — | — | — |
| Phase 6 라이브 smoke | obsidian-cdp full cycle (Brief→Proceed→...→write) **master 직접** + PoC benchmark command 재실행 (10 query) + WIKEY_SEARCH_ENGINE=qmd toggle 검증 | — | — | **의무 (3 시나리오: ingest / 한+영 query / qmd toggle)** |
| Phase 7 post-impl | grep diff + Karpathy 4원칙 cross-check | cycle #2 (코드 + smoke evidence APPROVE) | — | — |
| Phase 9 최종 | 28 AC line-by-line 증거 매핑 (v5: 18 단위 + 7 통합 + 3 라이브) | — | — | — |

**검증 도구**:
- master 1차: `npm test` (wikey-core + wikey-obsidian fresh) / `npm run build` / `./scripts/validate-wiki.sh` / 7-anchor grep (rules.md §10)
- codex 2차: `cmux send` Mode D Panel — fresh-pick + close-after-cycle (agent-management.md §2)
- 라이브 smoke: `obsidian-cdp` SKILL full cycle (CLAUDE.md §6)

---

## 3. 4 단계 (Step A 환경 → B 코드 → C 검증 → D 동기화)

### Step A — 환경 세팅 (Phase 1)

**목적**: 본 cycle 시작 전 필수 환경 + 사용자 결정 잠금 + PoC 코드 reuse 결정.

**A1. Kiwi 사전 cache 확보**
- 사용자 환경 (`~/.cache/wikey/kiwi-models/cong/base/`) 이미 PoC 단계 2-B 에서 104MB extracted 됨 — 재 download 불필요. master 가 `ls -la` 로 9 파일 (`sj.morph`, `default.dict`, `dialect.dict`, `multi.dict`, `typo.dict`, `combiningRule.txt`, `cong.mdl`, `extract.mdl`, `nounchr.mdl`) 존재 확증.
- 신규 사용자용 `./scripts/download-kiwi-models.sh` 작성 — Kiwi 본가 (`bab2min/Kiwi`) model release URL (현재 v0.23.1) curl + extract. AC-S1 구현.

**A2. `WIKEY_SEARCH_ENGINE` config 키 + plugin config bridge 결정 잠금** (codex HIGH-2 fix)
- spec §3.3 + §3.3.1 = 신규 키 `WIKEY_SEARCH_ENGINE: 'orama' | 'qmd'` (default `'orama'`). 기존 `WIKEY_SEARCH_BACKEND` ('basic'/'gemma4') 와 의미 분리.
- master 가 변경 위치 4 개 확증: (a) `wikey-core/src/types.ts:30` 인터페이스 / (b) `wikey-core/src/config.ts:13` defaults / (c) `wikey-obsidian/src/main.ts:513` `loadFromWikeyConf` 파서 / (d) `wikey-obsidian/src/main.ts:641` `buildConfig` merge.
- override 우선순위: `process.env.WIKEY_SEARCH_ENGINE` > `wikey.conf` > `DEFAULTS`.

**A3. kiwi-nlp 부분 vendor 결정 잠금** (사용자 raise v3 + codex cycle #2 HIGH-B fix v4 — B-2 옵션 upstream git source archive 채택)
- spec §3.8 v5 = `wikey-core/vendor/kiwi-nlp/` 디렉토리 신규. **upstream `bab2min/Kiwi` (대문자 K, Kiwi 본가) GitHub git tag archive 의 `bindings/wasm/package/` subdir sparse vendor** + 본가 root `LICENSE` 별 fetch (master fact-check 결과: `kiwi-nlp@0.23.0` 의 `repository.url = git+https://github.com/bab2min/Kiwi.git`, codex cycle #3 HIGH-1 fix v5).
- vendor 절차 (Step B 안 시행, v5 정정):
  ```bash
  KIWI_TAG=v0.23.0   # Step A 진입 시 본가 release 확인 후 확정
  mkdir -p /tmp/kiwi-vendor && cd /tmp/kiwi-vendor
  curl -L "https://github.com/bab2min/Kiwi/archive/refs/tags/${KIWI_TAG}.tar.gz" -o kiwi-src.tgz
  tar -xzf kiwi-src.tgz "Kiwi-${KIWI_TAG#v}/bindings/wasm/package"
  mv "Kiwi-${KIWI_TAG#v}/bindings/wasm/package" /Users/denny/Project/wikey/wikey-core/vendor/kiwi-nlp
  curl -L "https://raw.githubusercontent.com/bab2min/Kiwi/${KIWI_TAG}/LICENSE" \
    -o /Users/denny/Project/wikey/wikey-core/vendor/kiwi-nlp/LICENSE
  cd /Users/denny/Project/wikey/wikey-core/vendor/kiwi-nlp
  if [ -f package-lock.json ]; then npm ci; else npm install; fi    # codex cycle #4 MED-3 fix v6: sparse subdir lock 부재 안전
  npm run build
  cd -
  ```
- import path (canonical, v5 codex cycle #3 HIGH-2 fix): `import initKiwi from '../../vendor/kiwi-nlp/dist/build/kiwi-wasm.js'` (PoC default export pattern). `dist/index.js` 폐기.
- npm `kiwi-nlp` dep 제거 — wikey-core/package.json 에서 제거 (실은 추가 안 함, vendor import 만). wikey-obsidian/package.json 은 PoC cleanup 시점까지 잠정 보존 (codex cycle #2 HIGH-A fix, §3.7).
- LGPL §6 4 의무 충족 (v5 보강) — JS wrapper layer (vendor 안 LICENSE + src + 빌드 스크립트 = wrapper relink) + WASM binary layer (vendor scope 외, NOTICE 안 `bab2min/Kiwi` 본가 + Emscripten + `bindings/wasm/build.sh` rebuild 절차 reference).
- 사용자 결정 영구 등록 (B-2 채택 2026-05-09) — qmd 와 동등 ownership 패턴.

**A4. PoC 코드 reuse 결정**
- `wikey-obsidian/src/commands.ts:96-522` 의 3 PoC command 보존.
- 마이그레이션 후 *production query path* 는 wikey-core 안 신규 모듈 (`orama-korean-tokenizer.ts` + `orama-index.ts`) 으로 이전 — kiwi-nlp 는 vendor 경유 (A3).
- PoC command 는 *벤치마크 도구* 로 본 cycle 종결까지 보존.
- wikey-core 에 deps 추가 — `@orama/orama` 만 (kiwi-nlp 는 v3 vendor 라 npm dep 미추가).

**A5. esbuild plugin asset copy 결정 잠금** (codex HIGH-4 fix)
- spec §3.7 v4 = Option A. esbuild build 시 `wikey-core/vendor/kiwi-nlp/dist/kiwi-wasm.wasm` (B-2 vendor path 단일 source) → `wikey-obsidian/kiwi-wasm.wasm` (plugin root) copy. v2 npm path (`node_modules/kiwi-nlp/...`) 는 v3+v4 에서 폐기.
- runtime: `path.join(plugin.app.vault.adapter.basePath, plugin.manifest.dir, 'kiwi-wasm.wasm')` lookup.

**A6. tools/qmd/ 보존 확증**
- 사용자 결정 2026-05-09: Path C 회귀 가능. `tools/qmd/` 디렉토리 git tracked 보존, 삭제 / deprecate 미진행 (AC-F2).

**Step A 체크박스**:

- [x] Kiwi 사전 9 파일 존재 확증 (`ls -la ~/.cache/wikey/kiwi-models/cong/base/`)
- [x] `WIKEY_SEARCH_ENGINE` 신규 config 키 4 위치 확정 (`types.ts:30` / `config.ts:13` / `main.ts:513` / `main.ts:641`)
- [x] kiwi-nlp vendor 결정 잠금 — `wikey-core/vendor/kiwi-nlp/` 디렉토리 신규 (~3K LOC + 3.8MB wasm) + `VENDOR.md` 양식 결정
- [x] PoC 코드 보존 결정 명시 (cleanup 시점 = 본 cycle 종결 후 별 step)
- [x] wikey-core/package.json 에 `@orama/orama` 추가 결정 잠금 (v3: kiwi-nlp 는 vendor 라 dep 미추가)
- [x] esbuild plugin asset copy source path 결정 — vendor path (`wikey-core/vendor/kiwi-nlp/dist/kiwi-wasm.wasm`)
- [x] `tools/qmd/` git tracked 보존 확증 (`git ls-files tools/qmd/ \| wc -l`)

### Step B — TDD RED→GREEN→BLUE 3a/3b (Phase 2~5)

**B1. RED — 단위 테스트 신규 case 작성** (Phase 2)

전체 신규 단위 테스트 = spec v5 의 28 AC 중 단위 부분 = 18 case (§5.1) + 통합 단위 테스트 가능한 부분 (AC-F1.a + F1.b + V2) = 총 21 RED case (T1~T3 + I1 + I2.a + I3~I4 + Q1~Q5 + R1~R3 + V1 + W1 + F1.a + F1.b + V2 — I2.b production 117 docs + L1~L3 라이브 + Q3 sub + AC-D1/D2/F2/S1 docs/CLI/git 검증 제외).

- [x] `wikey-core/src/__tests__/search/orama-korean-tokenizer.test.ts` 신규 — AC-T1~T3 + AC-W1 (4 case)
- [x] `wikey-core/src/__tests__/search/orama-index.test.ts` 신규 — AC-I1 + AC-I2.a + AC-I3~I4 + AC-V1 (5 case)
- [x] `wikey-core/src/__tests__/query-pipeline-orama.test.ts` 신규 또는 기존 `query-pipeline.test.ts` 확장 — AC-Q2 + AC-Q4 + AC-Q5 (3 case, mock Orama + Ollama; AC-Q1/Q3 는 라이브 smoke)
- [x] `wikey-core/src/__tests__/scripts/reindex-orama.test.ts` 신규 또는 기존 `reindex.test.ts` 확장 — AC-R1~R3 (3 case)
- [x] `wikey-obsidian/src/__tests__/main-config-bridge.test.ts` 신규 — AC-F1.a (`loadFromWikeyConf` mock fs) + AC-F1.b (`process.env` override) (2 case, codex HIGH-2 fix)
- [x] `wikey-core/src/__tests__/vendor-kiwi-nlp.test.ts` 신규 — AC-V2 (vendor import path 작동 + VENDOR.md / sync docs 존재) (1 case, 사용자 raise v3)
- [x] 모두 FAIL 확증 후 `npm test` log 보존 → commit `test: §5.7.4 RED — 21 case (orama + vendor backend)` (18 단위 AC + AC-F1.a/F1.b + AC-V2)

**B2. GREEN — A1~A8 + vendor (v3) 구현** (Phase 3)

순서대로 (의존성 고려):

- [x] (../A8 먼저) `WIKEY_SEARCH_ENGINE` config 키 + plugin config bridge — `types.ts` + `config.ts` + `main.ts:513` `loadFromWikeyConf` parser + `main.ts:641` `buildConfig` merge + env override (~25 LOC, codex HIGH-2 fix). AC-F1.a + F1.b.
- [x] (../v5 vendor 먼저, B-2 옵션 sparse, **v9 reality drift fix**) `wikey-core/vendor/kiwi-nlp/` 디렉토리 신규 — **upstream `bab2min/Kiwi` (대문자 K, Kiwi 본가) git tag archive 의 `bindings/wasm/package/` subdir sparse vendor** + 본가 root `LICENSE` 별 fetch. Step A3 절차 따라 진행. **v9 정정 (post-impl cycle #3 MED #10)**: vendor `dist/` = npm `kiwi-nlp@0.23.0/dist/` byte-equal mirror (sparse 보존 + dist mirror 패턴, `cp -r node_modules/kiwi-nlp/dist/* vendor/kiwi-nlp/dist/`). vendor 안 단독 `npm run build` 는 `src/build/kiwi-wasm.js` (Emscripten generated) 부재로 TS2307 fail — 이는 vendor 정합성 의도. src customize 시 본가 `bindings/wasm/build.sh` + Emscripten prerequisite. + `VENDOR.md` 작성 (Kiwi git tag + vendor date + LICENSE 보존 검증 + dist 재생성 절차 + WASM binary layer = vendor scope 외 명시). 사용자 raise v3 + codex cycle #2 HIGH-B fix v4 + codex cycle #3 HIGH-1 fix v5 + codex cycle #5 MED-1 fix v7 + post-impl cycle #3 MED #10 fix v9. AC-V2.
- [x] (../A1) `wikey-core/src/search/orama-korean-tokenizer.ts` 신규 — Module.instantiateWasm hook + smart_tokenize JS 포팅 (PoC commands.ts:142-156 mirror, ~150 LOC) + import path = `'../../vendor/kiwi-nlp/dist/build/kiwi-wasm.js'` (v3 vendor 경유). AC-T1~T3 + AC-W1.
- [x] (../A2) `wikey-core/src/search/orama-index.ts` 신규 — `createOramaIndex` + lifecycle 6 메서드 (~200 LOC). AC-I1~I3.
- [x] (../C3) AC-I4 round-trip persistence test 구현 + 검증.
- [x] (../C4) AC-V1 schema 호환 sanity — Orama schema 에 `embedding: 'vector[768]'` column 추가 + mock vector 1회 hybrid mode round-trip.
- [x] (../A4 codex HIGH-1 fix) `wikey-core/src/query-pipeline.ts::query()` 최상단 engine 판정 + qmd 탐색 조건부 + `execQmdSearchLegacy` rename + `execOramaSearch` 신규 (~80 LOC 추가). AC-Q1~Q5.
- [x] (../A5 codex HIGH-3 fix) `wikey-core/src/scripts/reindex.ts::cmdReindex` 분기 — `ReindexOptions.searchEngine` 추가 + `scripts-runner.ts:36` bridge + engine='orama' 시 `runOramaIngest` 단일 step (~120 LOC 추가). AC-R1~R3.
- [x] (../A3) `./scripts/download-kiwi-models.sh` 작성 + plugin onload 부재 detect 시 Notice (~30 LOC). AC-S1 (라이브 smoke 수준).
- [x] (../A5 esbuild) `wikey-obsidian/esbuild.config.mjs` 에 wasmCopyPlugin 추가 — vendor path → plugin root copy. AC-W1 의 build artifact 부분.
- [x] (../npm dep 제거 — wikey-core 만) `wikey-core/package.json` 의 `kiwi-nlp` dep 제거 — vendor 경유 import 만 남김. wikey-obsidian/package.json 은 PoC cleanup 시점까지 잠정 보존 (v4 codex cycle #2 HIGH-A fix). PoC cleanup 별 step (Step D 마지막 commit) = wikey-obsidian dep 도 제거.
- [x] (../A7) `tools/qmd/` 보존 (작업 0). AC-F2 — git ls-files 검증만.
- [x] 18 RED case 모두 PASS + 기존 wikey-core / wikey-obsidian 회귀 PASS 확증 → commit `feat: §5.7.4 GREEN — orama backend + kiwi-nlp vendor (A1~A8 + v3 vendor)`

**B3. BLUE Phase 3a — 회귀 검증** (Phase 4)

- [x] `npm test` (wikey-core fresh) — 모든 case PASS, 기존 회귀 무손상
- [x] `npm test` (wikey-obsidian fresh) — 회귀 PASS
- [x] `npm run build` (wikey-core + wikey-obsidian) — 0 errors
- [x] `./scripts/validate-wiki.sh` — wiki/ frontmatter 무결성 PASS

**B4. BLUE Phase 3b — refactor** (Phase 5, CLAUDE.md SDD+TDD 정책 의무)

- [x] **함수 분해**: 50+ LOC 함수 후보 (예: `execOramaSearch` / `runOramaIngest`) extract 결정. ~30 LOC 단위로 split.
- [x] **Naming consistency**: `qmdQuery` → `multiQuery` / `legacyQmdSearch` → `execQmdSearchLegacy` 등 변수명 mapping 일관.
- [x] **DRY**: PoC commands.ts:142-156 의 smart_tokenize 와 wikey-core 신규 모듈의 같은 logic 중복 제거 (PoC 가 wikey-core import 또는 별 export). 또는 *의도적 유지* 근거 명시 (PoC = 벤치마크 isolated).
- [x] **주석 quality**: TODO/FIXME 0 / historical context 압축 (PoC 단계 reference 주석 → "see activity/phase-5-resultx-5.7.3" 1 line).
- [x] **가독성**: nested arrow / magic number (e.g. `0.5` similarity threshold) 상수화.
- [x] 각 refactor 후 회귀 검증 반복 (`npm test`) → commit `refactor: §5.7.4 BLUE — 함수 분해 / DRY / Naming`

### Step C — 단위 + 라이브 smoke (Phase 6)

- [x] `npm test` final fresh re-run (wikey-core + wikey-obsidian) — 모든 PASS
- [x] `npm run build` final — 0 errors
- [x] `./scripts/validate-wiki.sh` final — PASS
- [x] **라이브 smoke 1**: obsidian-cdp full ingest cycle — `raw/0_inbox/<test-source>` → Brief → Proceed → Processing → Preview → Approve → wiki write. console log 보존. AC-L1.
- [x] **라이브 smoke 2**: sidebar-chat 한국어 query (`PMBOK 통제 도구 변경 관리`) + 영문 query (`BM25 algorithm`) 각 1회. 답변 + citation 정상 + p95 latency ≤ 200ms (cold 1회 제외). AC-L2.
- [x] **라이브 smoke 3**: `WIKEY_SEARCH_ENGINE=qmd` 환경변수 set + Obsidian 재시작 → 동일 query 결과 (회귀 path 작동 확증). AC-L3.
- [x] **PoC benchmark 재실행**: `wikey:wikey-poc-orama-benchmark` command 1회 — 10 query 결과 PoC 단계 3 동등 확증. AC-Q1, AC-Q3.
- [x] 모든 smoke PASS console log 보존 → `activity/phase-5-resultx-5.7.4-orama-migration-<date>.md` 작성

### Step D — 문서 동기화 (Phase 8)

- [x] **`wikey.schema.md`** §"검색 코어의 안정성" / §"검색 코어 = qmd ..." 섹션 갱신 — Orama default + qmd fallback 명시 (사용자 승인 필수, CLAUDE.md 쓰기 규칙)
- [x] **`docs/sessions/phase-5/phase-5-result.md`** §5.7.4 entry 신규 — 마이그레이션 결과 + AC 28 매핑 (= §5.1 18 + §5.2 7 + §5.3 3) + cycle 이력 (codex #1~#7 cycle 누적, v8 spec/todo APPROVE_WITH_CHANGES)
- [x] **`activity/phase-5-resultx-5.7.4-orama-migration-<date>.md`** 신규 — 라이브 smoke evidence + benchmark 재실행 결과
- [x] **`wiki/log.md`** entry 추가 형식: `## [<date>] (../검색 backend swap) | qmd CLI → Orama in-process` (단 §5.11 v2 의 log.md 의미 = 지식 log only — 본 변경은 *infrastructure* 라 log.md 미기록 가능, master 판단)
- [x] **`docs/planning/phase-5/phase-5-todo.md §5.7.4`** 체크박스 mirror — 본 todo 의 Step A~D 결과 반영
- [x] **LICENSE 파일** 작성 (MIT 또는 Apache-2.0, 사용자 결정) — package.json `license` field 추가
- [x] **NOTICE 파일** 작성 (post-impl Step D 진행, v9 mirror — spec v9 AC-D2 reality drift fix) — NOTICE 안에 다음 6 항목 모두 명시: (a) **JS wrapper layer** Kiwi NLP (LGPL-2.1) — vendored at `wikey-core/vendor/kiwi-nlp/` (sparse vendor of `bab2min/Kiwi/bindings/wasm/package/`) / (b) **WASM binary layer** Kiwi WASM — built from `bab2min/Kiwi` + Emscripten (vendor scope 외, `bab2min/Kiwi` git tag reference) / (c) **library source 위치** = `wikey-core/vendor/kiwi-nlp/{src,package.json,tsconfig.json}` (JS wrapper TS 원본) + `bab2min/Kiwi` repo root + `src/` + `include/` + `bindings/wasm/build.sh` (WASM C++) — LGPL §6 (b)(c) 의무 / (d) **JS wrapper relink mechanism (v9 정정)** = "사용자 `vendor/kiwi-nlp/src/` 수정 → 본가 `bindings/wasm/build.sh` + Emscripten 으로 `src/build/kiwi-wasm.{js,d.ts}` 재생성 (Emscripten prerequisite — vendor 안 단독 `npm run build` 는 `src/build/kiwi-wasm.js` 부재로 TS2307 fail) → vendor 안 `npm run build` (이제 PASS) → wikey-obsidian rebuild" / (e) **WASM binary relink mechanism (LGPL §6 (d))** = "사용자 `bab2min/Kiwi` clone → `bindings/wasm` + Emscripten + `./build.sh` → `kiwi-wasm.wasm` 생성 → `wikey-core/vendor/kiwi-nlp/dist/kiwi-wasm.wasm` 교체 → wikey-obsidian rebuild" 절차 명시 / (f) repository public 확증 (D4 sub-bullet) + Kiwi 사전 (`~/.cache/wikey/kiwi-models/`) = dictionary data cache 만 (LGPL relink 와 별개). AC-D2.
- [x] **README.md `## Third-party software` 섹션** 추가 — `@orama/orama` (Apache-2.0) + `kiwi-nlp` (LGPL-2.1, vendored at `wikey-core/vendor/kiwi-nlp/`) + qmd (벤더 정보) 명시. AC-D2.
- [x] **회귀 절차 문서**: README.md `## Search engine rollback` 섹션 추가 (별 docs 파일 대신 통합) — 3 layer 안전망 (git revert / qmd vendored / `WIKEY_SEARCH_ENGINE=qmd` toggle) 절차. AC-D1.
- [x] **kiwi-nlp vendor sync 절차 docs** (`docs/architecture/kiwi-nlp-vendor-sync.md`, ~50 줄) 신규 — 사용자 raise v3 + codex cycle #4 MED-2 fix v6 (primary 절차 정정). vendor 시점 Kiwi git tag + 사용자 / master 수동 점검 절차 (primary: `bab2min/Kiwi` releases 확인 + `bindings/wasm/package/` subdir diff + 본가 root LICENSE diff + cherry-pick + 단위 + 라이브 smoke. secondary: `npm view kiwi-nlp version` + dist tarball cross-check) + 자동화 §5.7.5 reference. AC-V2.
- [x] **GitHub repository public 확증** (사용자 confirm 1 line 보고) — AC-D2 sub.
- [x] commit 분리 (논리 단위): `feat: §5.7.4 ...` (코드) / `docs: §5.7.4 ...` (문서) / `chore: §5.7.4 LICENSE + NOTICE + vendor` (라이선스 + vendor).

---

## 4. 단계별 체크박스 (요약, AC 1:1 매핑)

| Step | 체크박스 | AC mapping | LOC 추정 |
|------|---------|------------|---------|
| **A1** Kiwi 사전 cache 확인 | [ ] | (전제) | 0 |
| **A2** `WIKEY_SEARCH_ENGINE` 키 + main.ts config bridge | [ ] | AC-F1.a + F1.b | ~25 |
| **A3** kiwi-nlp 부분 vendor (v3) | [ ] | AC-V2 | ~3K (vendor) |
| **A4** PoC 코드 reuse 결정 잠금 | [ ] | (전제) | 0 |
| **A5** esbuild plugin asset wasm copy (Option A) | [ ] | AC-W1 | ~20 |
| **A6** tools/qmd/ 보존 확증 | [ ] | AC-F2 | 0 |
| **B1** RED 21 case 작성 | [ ] | T1~T3 / I1, I2.a, I3, I4 / Q1~Q5 / R1~R3 / V1, V2 / W1 / F1.a, F1.b | ~550 (test) |
| **B2-A1** orama-korean-tokenizer.ts | [ ] | AC-T1~T3 + AC-W1 | ~150 |
| **B2-A2** orama-index.ts | [ ] | AC-I1~I3 | ~200 |
| **B2-C3** persistence round-trip | [ ] | AC-I4 | ~30 |
| **B2-C4** vector schema sanity | [ ] | AC-V1 | ~30 |
| **B2-A4** query-pipeline `query()` 최상단 engine 판정 + execOramaSearch | [ ] | AC-Q1~Q5 | ~80 |
| **B2-A5** reindex `ReindexOptions.searchEngine` + cmdReindex 분기 + scripts-runner bridge | [ ] | AC-R1~R3 | ~120 |
| **B2-A3** download-kiwi-models.sh | [ ] | AC-S1 (라이브) | ~30 |
| **B2-vendor** kiwi-nlp vendor (v3) + npm dep 제거 + import path 변경 | [ ] | AC-V2 | (소스 vendor) |
| **B3** BLUE Phase 3a 회귀 검증 | [ ] | (전체) | 0 (검증) |
| **B4** BLUE Phase 3b refactor | [ ] | (전체) | varies |
| **C** 라이브 smoke 3 시나리오 | [ ] | AC-L1~L3 | 0 (실행) |
| **D-LICENSE** LICENSE + NOTICE + README third-party | [ ] | AC-D2 | ~80 |
| **D-rollback** README rollback 섹션 | [ ] | AC-D1 | ~30 |
| **D-vendor-sync** `docs/architecture/kiwi-nlp-vendor-sync.md` (v3) | [ ] | AC-V2 | ~50 |
| **D-docs** schema.md / activity / log.md / todo mirror | [ ] | (전체) | varies |

**26 todo 후보 검증 결과 mirror** (spec §4.5 + v3 사용자 raise 갱신):

| 분류 | 개수 | 항목 |
|---|---|---|
| 포함 (해당 cycle 의무) | 10 | A1, A2, A4, A5, A6, A7, A8, C3, C4 (수정), D4 |
| 수정 포함 (단순화) | 5 | A3 (auto-download → setup script), A9 (별 docs → README 통합), C4 (full hybrid → schema 호환 sanity), D1+D2+D3 (3개 통합 1 commit), D5 (이미 PoC 충족) |
| deferral / 폐기 | **12** | **B1~B7** (B7 = kiwi-nlp source vendor sync v3 신규, 별 spec §5.7.5), C1, C2, C5, C6 (별 cycle) |
| v3 신규 (사용자 raise) | 1 | kiwi-nlp 부분 vendor (B-2 옵션 v4) — Step A3 + B2-vendor + D-vendor-sync. AC-V2. |

(v4 codex cycle #2 MED-3 정정: deferral 11 → 12, B 그룹 B7 추가 반영. PoC 26 + v3 신규 1 = 총 27 입력 항목.)

---

## 5. 자체 20-anchor self-check (master v8 작성 직후 — Layer 1 7-anchor + Layer 2 6 codex 패턴 P1~P6 + Layer 3 7 fix 모드 F1~F7, codex cycle #1~#6 + 사용자 raise + 글로벌 rules §10 모두 반영)

| # | Anchor | 결과 | 검증 명령 |
|---|--------|------|-----------|
| (a) | 시그니처 일관성 — `WIKEY_SEARCH_ENGINE` / `KoreanTokenizerHandle` / `OramaIndexHandle` / `ReindexOptions.searchEngine` (v2) / `wikey-core/vendor/kiwi-nlp/` (v3) 본 todo + spec cross-file 동일 | PASS_v8 — Step A2 + A3 + B2-A1/A2/A4/A5 + B2-vendor + D-vendor-sync + §4 표 모두 일관 | `grep -nE "WIKEY_SEARCH_ENGINE\|KoreanTokenizerHandle\|OramaIndexHandle\|searchEngine\|vendor/kiwi-nlp" docs/planning/phase-5/phase-5-todox-5.7.4-orama-migration.md docs/planning/phase-5/phase-5-spec-5.7.4-orama-migration.md` |
| (b) | state/data 표 형식 — 26 todo 검증 표 + §4 단계 체크박스 표 numbering (A1~A6 / B1~B4 + B2-vendor / C / D + D-vendor-sync) 일관 | PASS_v8 — §4 의 모든 행이 spec v3 §4.5 + v3 신규 1 항목 (kiwi-nlp vendor) 와 동기화 | line-by-line cross-check |
| (c) | builder/parser 분기 — Step B2 의 engine 분기 (A4 query() 최상단 + A5 cmdReindex `ReindexOptions.searchEngine`) 두 곳 모두 명시 + B2-vendor (npm dep 제거 + import path 변경) | PASS_v8 — `query()` 최상단 + `cmdReindex` 분기 + import path 모두 §3 Step B2 + spec §3.4/§3.5/§3.8 mirror | grep "engine" + "vendor/kiwi-nlp" 다중 occurrence |
| (d) | AC test 케이스 1:1 매핑 — spec v5 의 28 AC (= §5.1 18 + §5.2 7 + §5.3 3) 와 §4 표의 LOC mapping 행 일대일 | PASS_v8 — 모든 AC (T1~3 / I1, I2.a, I2.b, I3, I4 / Q1~5 / R1~3 / V1, V2 / W1 / F1.a, F1.b, F2 / D1~2 / S1 / L1~3) 가 §4 표 한 행 이상에 매핑 + B1 RED 21 case 와 cross-check | `grep -cE "AC-[A-Z][0-9](../\.[ab])?" docs/planning/phase-5/phase-5-todox-5.7.4-orama-migration.md` ≥ 21 |
| (e) | self-check 모든 행 drift 없음 — v8 작성 직후 stale 0 본문 한정 (codex #1 v2 + 사용자 vendor v3 + codex #2 v4 + codex #3 v5 + codex #4 v6 + codex #5 v7 + codex #6 v8 모두 반영, `## 변경 이력` + cross-check 표 안 historical 표현은 의도적 보존 — F5) | PASS_v8 — 본 §5 작성 시 stale 0 | (본 §5 line read) |
| (f) | footer + 변경 이력 + cycle 번호 — header v8 ↔ §6 변경 이력 v8 ↔ footer cycle #7 | PASS_v8 | grep `"version: v8"` + `"cycle #7"` |
| (g) | 코드 ↔ test exact phrase — Step A2 의 신규 키 `WIKEY_SEARCH_ENGINE` ↔ AC-F1.b `WIKEY_SEARCH_ENGINE=qmd` 환경변수 명시 + Step B2-vendor 의 `wikey-core/vendor/kiwi-nlp/dist` import path ↔ AC-V2 검증 phrase | PASS_v8 — spec §5.2 AC-F1.b 의 phrase `WIKEY_SEARCH_ENGINE=qmd` ↔ 본 todo §3 Step C 라이브 smoke 3 의 동일 phrase + AC-V2 의 vendor path 일치 | `grep -F "WIKEY_SEARCH_ENGINE=qmd" docs/planning/phase-5/phase-5-todox-5.7.4-orama-migration.md docs/planning/phase-5/phase-5-spec-5.7.4-orama-migration.md` 양쪽 hit + `grep -F "wikey-core/vendor/kiwi-nlp"` 양쪽 hit |

---

## 6. 변경 이력

| 버전 | 일시 | 변경 |
|------|------|------|
| **v1** | 2026-05-09 session 28 | 초안 — SDD+TDD 흐름 (Phase 0~9) + 검증 매트릭스 + Step A~D 체크박스 + 26 todo 검증 mirror + 자체 7-anchor self-check |
| **v2** | 2026-05-09 session 28 | spec v2 mirror — codex cycle #1 9 finding fix 반영 (Step A2 main.ts:513+641 / Step B1 RED case 13→16 / Step B2 ReindexOptions.searchEngine + scripts-runner bridge / Step A5 esbuild plugin asset copy / AC-Q5 + AC-W1 추가) |
| **v3** | 2026-05-09 session 28 | spec v3 mirror — 사용자 raise B 옵션 vendor 채택. Step A3 신규 (kiwi-nlp 부분 vendor 결정) + Step B2-vendor 신규 (npm dep 제거 + vendor import path) + Step D-vendor-sync 신규 (`docs/architecture/kiwi-nlp-vendor-sync.md`) + AC-V2 신규. 26 todo 검증 표 갱신 (B1~B6 → B1~B7, kiwi-nlp source upstream sync 추가 deferral). |
| **v4** | 2026-05-09 session 28 | spec v4 mirror — codex cycle #2 NEEDS_REVISION fix. (HIGH-A) Step A3 vendor 절차 = upstream `bab2min/kiwi-nlp` v0.23.0 git source archive (npm pack 폐기) + Step C 의 PoC code npm dep 잠정 보존 정책. (HIGH-B) Step A3 + B2-vendor 의 vendor 절차 = `curl git archive + npm ci + npm run build`. (HIGH-C) Step D-LICENSE NOTICE 양식 = LGPL §6 4 의무 충족. (MED-1) §4 표 deferral 12 항목 정정. (MED-2) Step B2-A5 = `getExecEnv()` env injection path. (MED-3) 26 검증 표 deferral 11→12 갱신 (B7 추가 반영). |
| **v5** | 2026-05-09 session 28 | spec v5 mirror — codex cycle #3 NEEDS_REVISION fix. (HIGH-1 fact-check) `bab2min/Kiwi` 본가 + `bindings/wasm/package/` subdir sparse vendor. (HIGH-2) canonical import = `dist/build/kiwi-wasm.js`. (HIGH-3) NOTICE 6 항목. (MED-1, MED-2, LOW). |
| **v6** | 2026-05-09 session 28 | spec v6 mirror — codex cycle #4 NEEDS_REVISION fix. (HIGH-1 fact-check) WASM binary path 단일화 — vendor `dist/kiwi-wasm.wasm`. Step A3 vendor 절차 + Step A5 esbuild copy source 모두 단일화. (HIGH-2 NOTICE byte-mirror) Step D-LICENSE NOTICE 양식 spec AC-D2 6 항목 byte-level mirror. (MED-1/2/3, LOW-1/2). |
| **v7** | 2026-05-09 session 28 | spec v7 mirror — codex cycle #5 NEEDS_REVISION fix + 사용자 raise (master fix 단계 catch 누락 / community 조사 의무) v7 적용. (MED-1) Step B2-vendor (line 144) 의 `npm ci` 단독 → lockfile 분기 정정. (MED-2) NOTICE byte-level mirror. + master 2차 검증 (rules 적용여부) 발견 F4 위반 fix. spec §7.2/7.3/7.4/7.5 신규 + 글로벌 rules §10 갱신. master 1차 = 20 anchor 의무. |
| **v8** | 2026-05-09 session 28 | spec v8 mirror — codex cycle #6 NEEDS_REVISION fix. (MED-1 NOTICE byte mirror canonical) Step D-LICENSE 의 6 항목 byte-copy from spec AC-D2 line 641 (lockfile fallback inline `(if [ -f package-lock.json ]; then npm ci; else npm install; fi)` 형식). (MED-2 self-check stale) §5 self-check 모든 anchor PASS_v6 → PASS_v8 일괄 + (e) v8 작성 직후 명시 + (f) header v8 / cycle #7 정정 + §5 헤더 "20-anchor (Layer 1 7-anchor + Layer 2 6 codex 패턴 + Layer 3 7 fix 모드)" 갱신. (MED-3 rules ↔ spec) byte mirror 의도적 분리 (rules = 글로벌 간결, spec = wikey cycle 사례 컬럼 추가). (LOW) memory path 오타 정정. master *byte 일치* 까지 grep 검증 의무 학습. |
| **v9** | 2026-05-09 session 28 (post-impl Step D) | spec v9 mirror — post-impl cycle #3 MED #10 reality drift fix. Step B2-vendor (line 144) 의 vendor 절차 = `npm ci` (devDeps install 선택) + dist mirror copy (npm `kiwi-nlp@0.23.0/dist/` byte-equal). vendor 안 단독 `npm run build` 는 `src/build/kiwi-wasm.js` (Emscripten generated) 부재로 TS2307 fail — vendor 정합성 의도. src customize 시 본가 `bindings/wasm/build.sh` + Emscripten prerequisite. NOTICE 양식 (Step D-LICENSE) 의 (d) JS wrapper relink mechanism = "본가 build.sh + Emscripten 으로 src/build/ 재생성 → vendor 안 npm run build → wikey-obsidian rebuild" 으로 정정. + 본 cycle 의 라이브 smoke (AC-L1/L2/L3 + PoC benchmark + MED #13 cross-process invalidation 라이브 검증) 모두 PASS 후 Step D 진입. NOTICE checkbox `[x]` (작성 완료). |

---

> **footer (cycle 추적)**: §5.7.4 todo v9 작성 완료 — post-impl 6 cycle (codex APPROVE_WITH_CHANGES) + master fix loop (LOW #6 fix + Step D 진입) + 라이브 smoke (master 직접 obsidian-cdp full cycle smoke + PoC benchmark + MED #13 cross-process 라이브 검증) PASS → Step D 진행 (LICENSE / NOTICE / README rollback / VENDOR.md / spec v9 / activity result). cycle 종결 단계.
