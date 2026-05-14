---
phase: 5
section: 5.7.5
title: Orama upstream sync 자동화 + LOW 잔여 + PoC cleanup + Developer Update UI (Spec)
status: planning
created: 2026-05-09
updated: 2026-05-09
version: v1.4
---

# Phase 5 §5.7.5 Orama upstream sync 자동화 + LOW 잔여 + PoC cleanup + Developer Update UI (Spec, WHAT)

> **상위 문서**: [`docs/planning/phase-5/phase-5-todo.md §5.7.5`](./phase-5-todo.md) (실행 단일 소스, 체크박스) · [`docs/planning/phase-5/phase-5-spec-5.7.4-orama-migration.md`](./phase-5-spec-5.7.4-orama-migration.md) v9 (선행 cycle, 본 spec 의 deferral 12 항목 source) · [`docs/planning/phase-5/phase-5-todox-5.7.5-orama-update-sync.md`](./phase-5-todox-5.7.5-orama-update-sync.md) (Todo, HOW — mirror)
>
> **버전 이력**:
> - v1 (2026-05-09 session 30, 초안 by analyst): §5.7.4 종결 후 deferred 4 그룹 (B 7 + LOW 4 + PoC cleanup 3 + C 4 + 비목표 2) + 사용자 신규 UI 7 요구사항 (developer update detect + analyze + dev-required mark UI) = 총 27 입력 항목 4-question 검증. spec 6요소 (Goal / Inputs / Outputs / Invariants / AC / Out-of-Scope / Dependencies) 정의. AC = 본 cycle 안 구현 의무 18 + Out-of-Scope deferral 9. 사용자 결정 의뢰 항목 5건 명시 (`[사용자 결정]` 마커).
>
> **wiki 재생성 없음 확증**: 본 §5.7.5 는 *마이그레이션 후 운영* 영역 — settings-tab 의 `[developer]` 섹션 + 신규 update-checker 모듈 + B7 sync docs 자동화 + kiwi vendor diff tool. wiki/ 본문 / frontmatter / 페이지 자체 변경 0. canonicalizer / mention extractor / ingest pipeline 변경 0. 검색·인덱싱 코어 변경 0 (§5.7.4 swap 결과 그대로 유지).

## 1. 목표 / 비목표

### 1.1 목표 (v1 범위)

본 §5.7.5 의 단일 목적 = **§5.7.4 의 마이그레이션 후 *운영 정책* 을 반영한 settings-tab `[developer]` 섹션 + upstream update detect/analyze/dev-required mark UI 도입 + B/LOW/PoC/C 그룹의 *포함 / 단순화 / deferral* 결정 잠금 + LOW 잔여 4 항목 fix**. (Karpathy Goal-Driven — 검증 가능한 단일 목표).

세부 6 가지:

1. **Settings-tab `[developer]` 섹션 도입** — 일반 사용자 미공개 영역. UI 7 요구사항 통합 진입점. 사용자 표현 그대로 "설정 하단부" 위치 + `WikeySettings.developerMode: boolean` toggle (default false, settings 토글 `Show developer section`, v1.2 결정 #1 (A) 잠금).
2. **재시작 1회 update check** — plugin onload 시 1회 외부 source query (npm registry / GitHub release feed) — 사용자 명시 동의 (default opt-in / opt-out 사용자 결정 의뢰). cron / interval 금지 (사용자 명시 = "재시작할 때 1회").
3. **항목별 upgrade 뱃지 + 버전 비교 row UI** — kiwi-nlp (vendor sync) / Orama (npm dep) / Qwen3-Embedding (model) / qmd 잔여 — 항목당 row, current ver vs upstream ver. update 있으면 `[upgrade]` 뱃지 활성화, 없으면 회색.
4. **[분석] 버튼 + [개발필요] 마크** — upstream changelog / git diff / release note fetch + LLM 요약 (BYOAI 의 wikey 기본 provider 사용) + 표시. customize 필요 detect 시 `[개발필요]` 마크 — 사용자가 별 cycle 으로 fix 결정.
5. **LOW 잔여 4 항목 fix** — codex post-impl cycle 의 deferred LOW 4건 (lowercase docs / PARTIAL persist race / vendor module load warn / 라이선스 docs 자동 검증) 의 *최소 정리*. 사용자 결정 의뢰 1건 (LOW #5 lowercase 정합 방향).
6. **B/PoC/C/비목표 그룹 분류 잠금** — 본 cycle 처리 / 단순화 / deferral 결정 명시 + Out-of-Scope 의 후속 cycle 위치 (§5.7.6+) 명확화.

### 1.2 비목표 (out of scope, v1 — 별 cycle / 별 phase 으로 deferral)

§5.7.4 v9 §1.2 양식 mirror. Karpathy Simplicity #2 (요청되지 않은 기능 추가 금지) 적용:

- **B1 자동 cron / GitHub Actions update monitor** — 본 §5.7.5 = *재시작 1회 + 사용자 [분석] 버튼 trigger*. 자동 polling / scheduled job 미포함. 사용자가 의도한 "재시작 1회" 정확 mirror. cron / GitHub Actions / 별 daemon 은 *별 phase* (§5.7.6 또는 phase-6).
- **B3 Regression 검증 자동화 (CI 통합)** — 매 update 후 quality benchmark + smoke 자동 실행은 별 cycle. 본 §5.7.5 는 update detect + analyze 까지, regression 검증은 master 가 [개발필요] mark 후 별 SDD+TDD cycle 진행 (§5.7.4 패턴 mirror).
- **B6 Notification (push / email / GitHub watch workflow)** — 본 §5.7.5 = *Obsidian 안 settings UI 표시* 만. push notification / email digest / GitHub watch automation 별 cycle.
- **C1 Q5 회귀 보완 (smart_tokenize 정밀화)** — 본 §5.7.5 invariant 외 — *검색 quality tuning* 은 별 cycle (`phase-5-todox-5.7.6-search-quality-tuning.md`). 사용자 만족도 평가 후 결정 영역.
- **C2 50~100 query 확장 benchmark + CI 자동화** — statistical power 보강 + `npm run benchmark:search` script + CI integration 은 별 cycle. 본 §5.7.5 = *수동 benchmark 절차 docs* 까지만 (B5 mirror).
- **HYBRID Stage 2 hybrid search full reroute** — Qwen3-Embedding 768D 통합 + Orama hybrid mode 실 호출 라인 reroute 는 별 sub-cycle (§5.7.4-C4 의 후속). 본 §5.7.5 미포함 — 검색 quality 영역과 운영 자동화 영역 분리.
- **BENCH-AUTO 검색 quality benchmark 자동화 통합** — C2 와 일부 중복. 별 cycle.
- **claude-harness-helper repo commit (master-validation skill + rules.md §10 압축)** — 별 repo, 본 wikey project 외. master 단독 처리, 본 spec scope 외.
- **wikey.schema.md 검색 코어 안정성 갱신** — §5.7.4 v9 의 reality drift fix + Orama default 명시 + qmd fallback path 갱신은 사용자 승인 의무 (CLAUDE.md 쓰기 규칙). 본 spec *진입 조건* 으로 명시 — `[사용자 결정]` 1번 (§1.4): *본 §5.7.5 진입 직전* 에 별 step 진행 vs 본 spec 안 별 step 으로 포함. 본 v1 default = *진입 직전 별 step* (사용자 결정 시 본 cycle 이 schema 의 "검색 코어" 표현을 변경하지 않으므로 분리 가능). 사용자 final 결정 시 §5 / §7 mirror.

## 2. 현재 코드 사실 (analyst 직접 확인)

본 spec 의 변경 면을 결정하기 위해 analyst 가 grep / read 로 직접 확인한 사실 (line number 는 *spec 작성 시점*, 구현 시 사소한 drift 가능):

| # | 항목 | 위치 | 현재 상태 |
|---|------|------|-----------|
| 1 | settings-tab 진입점 | `wikey-obsidian/src/settings-tab.ts` (~1000+ LOC) | 일반 사용자 영역만. `[developer]` 섹션 부재. |
| 2 | settings tab section 양식 (참조) | `wikey-obsidian/src/settings-tab.ts` 안 `wikey-settings-section-header` / `wikey-settings-status-group` / `wikey-settings-status-row` / `wikey-settings-status-desc` / `wikey-settings-warning` 등 **`wikey-settings-*` prefix** CSS class 패턴 (예: General / Provider / Search / Ingest / Audit, line 83/94/117/136/396 등) | `containerEl.createDiv({ cls: 'wikey-settings-...' })` + heading + setting row mirror. 본 §5.7.5 의 `[developer]` 섹션도 동일 prefix 사용 의무 (`wikey-settings-developer-*`). 기존 `wk-section` / `wk-*` prefix 표기는 master fact-check 결과 stale. (Karpathy Surgical — 기존 패턴 유지) |
| 3 | kiwi-nlp vendor 위치 | `wikey-core/vendor/kiwi-nlp/` (sparse vendor of `bab2min/Kiwi/bindings/wasm/package/`) + `wikey-core/vendor/kiwi-nlp/VENDOR.md` (Kiwi git tag + vendor date) + `docs/architecture/kiwi-nlp-vendor-sync.md` (수동 sync 절차) | §5.7.4 v9 종결 후 stable. dist mirror 패턴 (Emscripten prerequisite — 본가 build 의무). |
| 4 | Orama npm dep | `wikey-core/package.json` 안 `@orama/orama` (v3.x) | §5.7.4 v9 종결 후 stable. |
| 5 | Qwen3-Embedding model | URI = `hf:Qwen/Qwen3-Embedding-0.6B-GGUF/Qwen3-Embedding-0.6B-Q8_0.gguf` (qmd `DEFAULT_EMBED_MODEL`, `tools/qmd/src/llm.ts:211`). 로컬 cache = `~/.cache/qmd/models/hf_Qwen_Qwen3-Embedding-0.6B-Q8_0.gguf` (v1.3 fact-check 정정). diffSource = HuggingFace model card `https://huggingface.co/Qwen/Qwen3-Embedding-0.6B-GGUF`. | Phase 2 step 3-3 채택 후 stable. version detect = HF API `revision` 또는 cache file mtime + size. |
| 6 | qmd 잔여 (회귀 path) | `tools/qmd/` (vendored) — `WIKEY_SEARCH_ENGINE=qmd` 회귀 시 사용 | §5.7.4 v9 결정 = 보존, 삭제 X. |
| 7 | LLM provider (BYOAI) | `wikey-core/src/llm-client.ts` + `wikey-obsidian/src/main.ts:641` `buildConfig` provider 키 | Anthropic / OpenAI / Gemini / Ollama 4 provider. [분석] 버튼은 wikey 기본 provider 호출 (사용자 결정 의뢰 §1.4). |
| 8 | Status notification 패턴 (참조) | `wikey-obsidian/src/main.ts` `new Notice(...)` 호출 사례 (예: ingest 완료) | Notice / Modal mirror. 본 §5.7.5 의 update detect 결과는 *settings-tab UI 안* 표시, popup notification 미사용 (사용자 명시 = "일반 사용자는 알 수 없음"). |
| 9 | LOW #5 위치 | `wikey-obsidian/src/commands.ts:142~156` (PoC code, alphanumeric 보존) vs `scripts/korean-tokenize.py::_smart_tokenize` (lowercase 미적용) vs `wikey-core/src/search/orama-korean-tokenizer.ts:135` (lowercase 적용) | 3-way drift. 사용자 결정 의뢰 §1.4. |
| 10 | LOW #14 위치 | `wikey-core/src/search/orama-index.ts::persist()` `oramaSave + writeFileSync` 사이 | abort signal check 부재. ms 단위 race window. atomic write 또는 final guard 후보. |
| 11 | LOW #15 위치 | `./scripts/reindex.sh --check --json` 의 Kiwi vendor module load 시 stderr `MODULE_TYPELESS_PACKAGE_JSON` warn | vendor `package.json` 의 `type` 필드 부재 또는 lazy import 누락. |
| 12 | LOW #7 위치 | `NOTICE` / `README.md ## Third-party software` / `## Search engine rollback` 섹션 | npm dep 추가 시 NOTICE 누락 회피용 grep CI step 부재. |
| 13 | PoC code 위치 | `wikey-obsidian/src/commands.ts:96~522` (3 PoC command — `wikey-poc-orama-test` / `wikey-poc-kiwi-orama` / `wikey-poc-orama-benchmark`) | §5.7.4 v9 결정 = *마이그레이션 검증 후 보존*. `[사용자 결정]` 본 spec §1.4 — 벤치마크 도구 보존 vs cleanup. |
| 14 | wikey-obsidian deps | `wikey-obsidian/package.json` `kiwi-nlp` + `@orama/orama` | §5.7.4 v9 = *PoC cleanup 시점까지 잠정 보존*. 본 §5.7.5 cleanup 결정 시 제거. |
| 15 | main.js 크기 | `wikey-obsidian/main.js` (현재 ~496K, post-§5.7.4) | PoC cleanup 후 ~370K 예상 (PoC 기준 ~423K → -53K + 추가 정리). |
| 16 | wikey.conf qmd 키 | `WIKEY_QMD_TOP_N` / `~/.cache/qmd/.last-reindex` stamp 등 qmd 잔여 키 | §5.7.4 v9 결정 = naming refactor deferral. **v1.2 사용자 결정 #5 = 본 cycle 포함** — `WIKEY_SEARCH_TOP_N` alias 신규 + `WIKEY_QMD_TOP_N` deprecation marker. AC-C5. |
| 17 | env-detect.ts qmd 의존 | **(v1.3 fact-check 정정)** `findQmdBin` 함수는 *부재*. 실제 qmd detection = `wikey-obsidian/src/env-detect.ts:253 detectEnvironment(basePath, ollamaUrl)` 안 inline block (line 273~283: `tools/qmd/bin/qmd` direct check + `which('qmd', env)` fallback) + `findCompatibleNode()` (line 92~) 의 better-sqlite3 ABI mismatch 회피 path. | §5.7.4 v9 결정 = `WIKEY_SEARCH_ENGINE=qmd` toggle 의무 path 라 보존. **v1.2 사용자 결정 #5 = 본 cycle 포함** — v1.3 정확화: `detectEnvironment` 시그니처 확장 (`detectEnvironment(basePath, ollamaUrl, searchEngine)`) 후 `searchEngine !== 'qmd'` 분기에서 qmd block + findCompatibleNode 의 qmd ABI scan **skip** (default path 부담 0). 회귀 path 보존 (`WIKEY_SEARCH_ENGINE=qmd` toggle 시 정상 detect + scan). AC-C6. |

**주의**: 본 §2 의 line number 는 spec v1 작성 시점 grep 결과. 구현 진입 (Step A) 시 master 가 fresh re-grep + 잠금 의무. 본 spec § AC 가 line number 직접 의존 X — 동작 + grep-able phrase 기준.

## 3. 데이터 모델 / 인터페이스 변경

### 3.1 신규 모듈 — `wikey-core/src/update/upstream-checker.ts`

```ts
// wikey-core/src/update/upstream-checker.ts (신규)

/**
 * §5.7.5 — upstream update detect (재시작 1회).
 *
 * 항목별 source / current ver detection / upstream ver fetch / diff source 분리:
 *  - kiwi-nlp: vendor (sparse) — VENDOR.md 의 Kiwi git tag → bab2min/Kiwi releases atom
 *  - Orama: npm dep — package.json + npm registry latest
 *  - Qwen3-Embedding: model file metadata (GGUF header 또는 download URL hash) → Hugging Face model card
 *  - qmd 잔여 (회귀 path): tools/qmd/ vendored — git tag → upstream qmd repo
 */

export type UpdateItemKind = 'kiwi-nlp' | 'orama' | 'qwen3-embedding' | 'qmd-vendored'

export interface UpdateItemDescriptor {
  readonly id: string                  // 'kiwi-nlp' / 'orama' / ...
  readonly kind: UpdateItemKind
  readonly displayName: string
  readonly currentVersion: string      // detect 결과
  readonly upstreamVersion?: string    // 미해상 또는 fetch 실패 시 undefined
  readonly hasUpdate: boolean          // upstreamVersion > currentVersion
  readonly diffSource: string          // changelog / git diff URL — [분석] 버튼 input
  readonly fetchError?: string         // network 실패 / parse 실패 시
}

export interface UpdateCheckResult {
  readonly items: readonly UpdateItemDescriptor[]
  readonly checkedAt: string           // ISO timestamp
  readonly errors: readonly string[]   // 항목 비특정 에러 (network / config)
}

export async function detectUpstreamUpdates(opts: {
  readonly basePath: string
  readonly allowNetwork: boolean       // 사용자 동의 (settings toggle 또는 [분석] 버튼 trigger)
  readonly fetch: (url: string) => Promise<string>   // injection — test 시 mock
}): Promise<UpdateCheckResult>
```

**lifecycle**:

| 트리거 | 호출 흐름 |
|---|---|
| Plugin onload (1회, 사용자 동의 시 — `developerMode=true && allowUpdateCheck=true`) | `detectUpstreamUpdates({ allowNetwork: settings.allowUpdateCheck })` → settings-tab 안 cache. v1.3 명시: `developerMode=false` 또는 `allowUpdateCheck=false` 시 호출 0. |
| 사용자 [분석] 버튼 클릭 | item 1개에 대한 LLM 요약 = `analyzeUpdate(item, llmClient)` (§3.2 별 모듈) |
| Plugin onunload | (옵션) cache flush |

### 3.2 신규 모듈 — `wikey-core/src/update/update-analyzer.ts`

```ts
// wikey-core/src/update/update-analyzer.ts (신규)

/**
 * §5.7.5 — [분석] 버튼 — upstream changelog / diff fetch + LLM 요약.
 */

export interface UpdateAnalysis {
  readonly summary: string                // LLM 요약 (3~5 문장)
  readonly devRequired: boolean           // customize 필요 detect (LLM heuristic + smart_tokenize 등 wikey 측 수정분 영향 분석)
  readonly devRequiredReason?: string     // devRequired=true 시 근거
}

export async function analyzeUpdate(opts: {
  readonly item: UpdateItemDescriptor
  readonly llm: { generate: (prompt: string) => Promise<string> }
  readonly fetch: (url: string) => Promise<string>
}): Promise<UpdateAnalysis>
```

**LLM 요약 prompt 양식** (구현 시 정확화):
- input = upstream changelog / release note / git diff (max 2K tokens, truncate)
- output = (a) 요약 3~5 문장 / (b) wikey 측 vendor 수정분 (`VENDOR.md` 안 patch list) 와 충돌 가능성 / (c) `devRequired` boolean

### 3.3 신규 settings-tab `[developer]` 섹션

`wikey-obsidian/src/settings-tab.ts` 의 *맨 마지막* 에 추가 (사용자 명시 = "설정 하단부"):

```ts
// settings-tab.ts (Append)

// v1.3: developerMode + allowUpdateCheck 분리 (finding 4 fix).
// developerMode = 섹션 표시 여부 (default false), allowUpdateCheck = network 호출 동의 (default false, opt-in).
// `WikeySettings` (main.ts:34) + `DEFAULT_SETTINGS` (main.ts:87) + `buildPluginOnlyData` (main.ts:651) 에 양쪽 field 추가.
if (this.plugin.settings.developerMode) {
  const devSection = containerEl.createDiv({ cls: 'wikey-settings-developer-section' })
  devSection.createEl('h3', { text: 'Developer (advanced)', cls: 'wikey-settings-section-header' })
  devSection.createEl('p', { cls: 'wikey-settings-status-desc', text: '재시작 시 자동 갱신 (network 동의 시). update 있으면 [upgrade] 활성화, 없으면 회색.' })

  // allowUpdateCheck 토글 (default off — finding 4 opt-in)
  new Setting(devSection)
    .setName('Allow upstream update check (network)')
    .setDesc('재시작 시 1회 외부 source (npm registry / GitHub release / HF) fetch. 일반 사용자 미공개 영역.')
    .addToggle((t) => t
      .setValue(this.plugin.settings.allowUpdateCheck ?? false)
      .onChange(async (v) => { this.plugin.settings.allowUpdateCheck = v; await this.plugin.saveSettings() }))

  // Update item rows
  for (const item of this.plugin.updateCheckResult?.items ?? []) {
    renderUpdateRow(devSection, item, {
      onAnalyze: () => this.plugin.runUpdateAnalysis(item),
    })
  }
}
```

`renderUpdateRow` (신규 helper) — row 1개당 다음 4 요소:
1. displayName + current version
2. upstream version (있으면) + `[upgrade]` 뱃지 (없으면 회색 텍스트 "no update")
3. `[분석]` 버튼 (update 있을 때만 활성화)
4. `[개발필요]` 마크 (analysis 결과 `devRequired=true` 시만 표시)

**`developerMode` toggle 위치 (v1.2 사용자 결정 #1 = (A) settings 토글 잠금, env 키 미도입 — v1.3 finding 5 fix)**:
- ✅ 채택: settings-tab General 섹션 토글 `Show developer section` + `WikeySettings.developerMode: boolean` (default false) `WikeySettings` (main.ts:34) 에 추가 + `DEFAULT_SETTINGS` (main.ts:87) + `buildPluginOnlyData` (main.ts:651) persistence 처리
- ❌ 미도입: `WIKEY_DEVELOPER_MODE=1` env / wikey.conf 키 (옵션 B/C). 결정 #1 (A) 잠금에 따라 *코드 변경 0*. README docs 도 (A) settings 토글만 문서화 — env 표기 부재 (history/self-check 표현 안 잔존만).

### 3.4 LOW 잔여 4 fix 변경 면

| LOW # | 위치 | 변경 |
|-------|------|------|
| **#5** lowercase docs | `wikey-obsidian/src/commands.ts:142~156` PoC code + `scripts/korean-tokenize.py::_smart_tokenize` + `wikey-core/src/search/orama-korean-tokenizer.ts:135` 3-way drift | **사용자 결정 의뢰 §1.4** — 권고 default = "code lowercase 유지 (Orama tokenizer 양쪽 동일 적용 → case-insensitive 매칭) + spec/PoC docs 정정" (사용자 영구 등록 후 결정) |
| **#7** 라이선스 docs 자동 검증 | npm dep 추가 시 NOTICE 누락 회피 — CI/pre-commit grep step 추가 | `scripts/check-licenses.sh` 신규 (~30 LOC) — `package.json` deps 와 NOTICE 안 항목 grep diff. 본 cycle 안 = script 작성 + 1회 수동 실행. CI 통합 별 cycle (B3 mirror, deferral) |
| **#14** PARTIAL persist race window | `wikey-core/src/search/orama-index.ts::persist()` | atomic write — temp file (`<cachePath>.tmp`) + `fs.renameSync(tmp, final)` (POSIX atomic). abort signal check (`opts.signal?.aborted`) 도 추가 |
| **#15** vendor module load warn | `./scripts/reindex.sh --check --json` Kiwi vendor stderr `MODULE_TYPELESS_PACKAGE_JSON` warn | 권고 = `runOramaIngest` 안 lazy import (engine='orama' branch 진입 후 `createKoreanTokenizer` import) — `engine='qmd'` path 에서 vendor load 회피. 또는 vendor `package.json` 의 `type: "module"` 추가 (vendor customize, `VENDOR.md` 안 patch list 에 등록 의무, sync 시 주의) |

### 3.5 PoC code cleanup 변경 면 (사용자 결정 의뢰 §1.4)

| POC # | 변경 |
|-------|------|
| **POC-1** 3 PoC command 정리 결정 | 사용자 결정 영역 — (a) 보존 (벤치마크 도구) / (b) cleanup (production 만 잔존) / (c) sub-set 보존 (`wikey-poc-orama-benchmark` 만 보존, test/kiwi-orama 제거). 권고 default = (b) cleanup — §5.7.4 검증 종결 후 production query path stable, 별 벤치마크 dataset 가 생기면 별 module 으로 분리 (Karpathy Simplicity #1 일회용 코드 추상화 금지) |
| **POC-2** wikey-obsidian deps | `kiwi-nlp` + `@orama/orama` — POC-1 = (b) cleanup 결정 시 동시 제거. (a) 보존 시 deps 도 보존 |
| **POC-3** main.js 크기 측정 | cleanup commit 직후 `ls -la wikey-obsidian/main.js` size 비교 보고 (~496K → ~370K 예상). 단순 verification, 검증 step 1줄 |

### 3.6 B7 (kiwi-nlp source vendor sync 자동화) 변경 면 — 부분 도입

§5.7.4 v9 결정 = *수동 sync 절차 docs (`docs/architecture/kiwi-nlp-vendor-sync.md`) 까지만, 자동화는 §5.7.5*.

본 §5.7.5 가 도입할 자동화 범위 (4-question 검증 결과 — §4.2 참조):

- **포함 (단순화)**: `scripts/check-kiwi-vendor-sync.sh` (신규, ~50 LOC) — `bab2min/Kiwi` releases API (또는 atom feed) fetch + 현재 `VENDOR.md` 의 Kiwi git tag 비교 + 결과 stdout 출력. *재시작 1회* trigger 의 backend (`upstream-checker.ts` 의 kiwi-nlp 항목이 본 script 결과를 wrap 또는 직접 npm registry/GitHub API call).
- **deferral**: cron / GitHub Actions / regression 검증 자동화 / cherry-pick 자동화 / 사용자 review queue UI — Karpathy Simplicity 위반 (over-spec). 별 cycle (§5.7.6+).

### 3.7 B 그룹 나머지 (B1~B6) 변경 면 — 본 §5.7.5 안 단순화 통합

본 §5.7.5 의 핵심은 *settings-tab UI 안 표시* 이므로 B1~B6 의 상당수가 *§3.1 upstream-checker 의 자연스러운 sub-feature* 로 흡수됨:

| B # | 항목 | §5.7.5 처리 |
|-----|------|-------------|
| **B1** Orama npm update monitor | upstream-checker 의 `kind: 'orama'` 항목 — npm registry latest fetch (재시작 1회) |
| **B2** Update 반영 프로토콜 (patch / minor / major 분기) | analyze 버튼 결과 `devRequired` boolean + summary 의 자연 결과 — patch 자동 / minor master 결정 / major 별 spec 은 *master 운영 정책 docs* (별 cycle) |
| **B3** Regression 검증 자동화 | **deferral** (§1.2) — 본 §5.7.5 = update detect + analyze 까지만 |
| **B4** Kiwi 사전 update 자동 추적 | upstream-checker 의 `kind: 'qwen3-embedding'` 와 동등 패턴 — model release URL fetch. 단 Kiwi 사전 (`~/.cache/wikey/kiwi-models/`) 은 dictionary data — 본 §5.7.5 v1 = *vendor library upstream* 만 우선, 사전 update 는 별 row (사용자 결정 의뢰 §1.4 — 본 cycle 포함 vs deferral) |
| **B5** Update sync 프로세스 docs 자동 갱신 | `docs/architecture/kiwi-nlp-vendor-sync.md` 는 §5.7.4 에서 작성됨. 본 §5.7.5 = *읽기 link* 만, 자동 갱신 deferral |
| **B6** Notification (push / email / GitHub watch) | **deferral** (§1.2) — 본 §5.7.5 = settings-tab UI 표시 만 |

### 3.8 C 그룹 (검색 quality + naming refactor) 변경 면 — 4 항목 분리

| C # | 항목 | §5.7.5 처리 |
|-----|------|-------------|
| **C1** Q5 회귀 보완 (smart_tokenize 정밀화) | **deferral** (§1.2) — 검색 quality tuning 별 cycle |
| **C2** 50~100 query benchmark + 자동화 | **deferral** (§1.2) — statistical power 보강 별 cycle |
| **C5** wikey.conf qmd 키 deprecate (`WIKEY_QMD_TOP_N` → `WIKEY_SEARCH_TOP_N`) | **v1.2 사용자 결정 #5 = 본 cycle 포함** — alias 신규 + deprecation marker (~30 LOC + 단위 3 case). AC-C5 신설. |
| **C6** env-detect.ts qmd 의존 제거 | **v1.2 사용자 결정 #5 = 본 cycle 포함** (v1.3 정확화) — `detectEnvironment(basePath, ollamaUrl, searchEngine)` 시그니처 확장 + `searchEngine !== 'qmd'` 분기 qmd inline block + ABI scan skip (~30 LOC + 단위 2 case). 회귀 path 보존. AC-C6 신설. |

## 4. 27 입력 항목 4-question 검증 표

> 사용자 강조 (2026-05-09): "spec 에 대해서는 정말 필요한 기능인지, 역할이 뭔지 등을 검증할 필요 있음."
>
> 4 question:
> 1. **필요성**: 본 §5.7.5 invariant 또는 마이그레이션 후 운영 안전성에 필수?
> 2. **역할**: 해결 problem 명확 + 다른 항목과 책임 중복 없는가?
> 3. **Karpathy Simplicity**: 200줄 → 50줄 가능 / 시니어 엔지니어 over-eng 판정?
> 4. **Phase scope**: 본 cycle 안 처리 합리 / 별 spec deferral 합리 / 별 phase 합리?

### 4.1 사용자 신규 UI 7 요구사항 (UI-1~UI-7)

| # | 요구사항 (사용자 표현) | 분류 | 근거 |
|---|---------------------|------|------|
| **UI-1** | 원본 소스와 커스텀 소스간의 차이점에 대한 변경점을 알고 있어야함 | ✅ 포함 | (1) 운영 정책 핵심 — vendor (sparse) sync 시 wikey 측 patch 분 대조 필수. (2) `VENDOR.md` 안 patch list + upstream-checker 의 diffSource link. (3) ~30 LOC 추정 (`detectUpstreamUpdates` 안 patch list reference). (4) 본 cycle. AC-U1, AC-U2. |
| **UI-2** | 업데이트 관련 내용은 일반 사용자는 알 수 없음 | ✅ 포함 | (1) 사용자 명시 — settings-tab `[developer]` 섹션 분리 의무. (2) settings toggle (default off). (3) ~5 LOC 추정 (toggle 1개). (4) 본 cycle. AC-U3. |
| **UI-3** | 설정 하단부에 [developer] 섹션 추가 | ✅ 포함 | (1) UI-2 과 1:1. (2) 명확 — settings-tab 맨 마지막. (3) ~50 LOC 추정 (devSection.createDiv + heading + items loop). (4) 본 cycle. AC-U3. |
| **UI-4** | 원본 소스의 업데이트는 재시작 할 때 1회 실시 | ✅ 포함 | (1) 사용자 명시 trigger 정확 — plugin onload 1회. cron 금지. (2) `upstream-checker.detectUpstreamUpdates` 의 lifecycle. (3) ~30 LOC 추정. (4) 본 cycle. AC-U4. |
| **UI-5** | 새로운 버전이 있으면 [upgrade] 뱃지, 없으면 회색 | ✅ 포함 | (1) UI 1:1. (2) `renderUpdateRow` 의 hasUpdate boolean rendering. (3) ~20 LOC 추정 (CSS class toggle). (4) 본 cycle. AC-U5. |
| **UI-6** | 현재버전, 업데이트 버전 표시 + [분석] 버튼으로 업데이트 내용 분석 표시 + [개발필요] 마크 | ✅ 포함 | (1) 핵심 trigger — LLM analyze + devRequired heuristic. (2) `update-analyzer.ts` 의 단일 함수. (3) ~80 LOC 추정 (LLM prompt + heuristic). (4) 본 cycle. AC-U6, AC-U7, AC-U8. |
| **UI-7** | [개발필요]마크가 있는 경우 개발자는 개발 진행여부를 결정 | ⚠️ 수정 포함 | (1) 알림 만 의무, 실 진행은 SDD+TDD 별 cycle (§5.7.4 패턴 mirror). (2) UI-6 의 `devRequired=true` 표시 = master raise 신호. (3) 본 §5.7.5 안 = *표시* 까지만, *결정 / 진행* 은 사용자 + master 의 별 cycle 영역 (Karpathy Simplicity — 본 cycle 안 판단 로직 0). (4) 본 cycle (표시) + 별 cycle (실 진행). AC-U8 sub-bullet — *마크 표시 + master 가 별 cycle 으로 fix 의무*. |

### 4.2 B 그룹 (upstream sync 자동화) 7 항목

| # | 항목 | 분류 | 근거 |
|---|------|------|------|
| **B1** Orama (`@orama/orama`) update monitor — npm outdated cron / GitHub release atom | ⚠️ 수정 포함 | (1) UI-4 의 자연 sub. (2) cron / atom feed 자동 polling = over-spec, *npm registry latest fetch 1회 (재시작)* 으로 단순화. (3) Karpathy Simplicity. (4) 본 cycle 안 단순화. AC-U4 sub. |
| **B2** Update 반영 프로토콜 (patch / minor / major 분기) | ⚠️ 수정 포함 | (1) UI-6 의 [분석] + [개발필요] 의 자연 결과 — patch 자동 / minor master 결정 / major 별 spec. (2) 명시 분기 logic 코드화 = over-spec, LLM 요약 + devRequired heuristic 으로 흡수. (3) Karpathy Simplicity. (4) 본 cycle 단순화. (운영 정책 docs 별 cycle deferral). AC-U6 sub. |
| **B3** Regression 검증 자동화 — 매 update 후 quality benchmark + smoke 자동 | ❌ deferral | (1) 본 §5.7.5 invariant 외 — *quality 영역* 는 별 cycle. (2) — (3) CI 통합 = over-spec. (4) **deferral §5.7.6** (or phase-6). |
| **B4** Kiwi 사전 update 자동 추적 (md5 / size) | ⚠️ 수정 포함 (사용자 결정 의뢰) | (1) 사전 (~104MB) update 시 모델 redownload 의무 — 운영 안전성. (2) `upstream-checker` 의 별 row 후보. (3) `~/.cache/wikey/kiwi-models/` md5 저장 + Kiwi 본가 release 비교 = ~30 LOC. (4) **사용자 결정 의뢰 §1.4** — 본 cycle 포함 vs deferral. 권고 default = *본 cycle 포함* (UI-4 의 자연 row). |
| **B5** Update sync 프로세스 docs 자동 갱신 | ❌ deferral | (1) `docs/architecture/kiwi-nlp-vendor-sync.md` 가 §5.7.4 에서 stable. 자동 갱신 = over-spec. (2) — (3) — (4) **deferral §5.7.6**. |
| **B6** Notification (push / email / GitHub watch workflow) | ❌ deferral | (1) settings-tab UI 표시 만 (UI-2 = 일반 사용자 미공개 — push 와 모순). (2) — (3) — (4) **deferral 별 phase** (or 미진행). |
| **B7** kiwi-nlp source vendor sync 자동화 — `bab2min/Kiwi` git tag 변경 감지 + diff 분석 + cherry-pick + 사용자 review queue | ⚠️ 수정 포함 | (1) UI-1 의 자연 sub — vendor sync 가 본 §5.7.5 의 핵심 use-case. (2) `scripts/check-kiwi-vendor-sync.sh` (~50 LOC) + upstream-checker 의 kiwi-nlp 항목. *cherry-pick 자동화 + review queue UI* = over-spec, 본 cycle 안 = *detect + diff link 표시* 까지. cherry-pick 은 master 의 별 cycle (UI-7 mirror — `[개발필요]` mark → 별 fix cycle). (3) Karpathy Simplicity. (4) 본 cycle 단순화. AC-U6 + AC-S1 (script). |

### 4.3 LOW 잔여 4 항목

| # | 항목 | 분류 | 근거 |
|---|------|------|------|
| **LOW #5** lowercase docs (3-way drift) | ⚠️ 수정 포함 | (1) drift = 검색 결과 일관성 risk. (2) 명확 — 1방향 결정 (lowercase 유지 권고). (3) ~10 LOC fix + docs ~5 줄. (4) 본 cycle. **사용자 결정 의뢰 §1.4** — code or docs 측 통일 방향. AC-L5. |
| **LOW #14** PARTIAL persist race window (atomic write) | ✅ 포함 | (1) ms 단위 race window — robustness 보강. production 영향 거의 없으나 future cross-process scenario risk. (2) atomic write (temp + rename) — 명확. (3) ~15 LOC. (4) 본 cycle. AC-L14. |
| **LOW #15** vendor module load warn (`MODULE_TYPELESS_PACKAGE_JSON`) | ✅ 포함 | (1) reindex check 시 사용자 경험 noise. (2) 명확 — lazy import 또는 vendor `package.json` `type: "module"`. (3) ~10 LOC + VENDOR.md 1줄 patch list. (4) 본 cycle. AC-L15. |
| **LOW #7** 라이선스 docs 자동 검증 (`scripts/check-licenses.sh`) | ✅ 포함 | (1) NOTICE / README third-party 정합성 — npm dep 추가 시 누락 회피. (2) 명확 — package.json deps 와 NOTICE grep diff. (3) ~30 LOC. (4) 본 cycle (script 작성 + 1회 수동 실행). CI 통합 deferral. AC-L7. |

### 4.4 PoC code cleanup 3 항목

| # | 항목 | 분류 | 근거 |
|---|------|------|------|
| **POC-1** 3 PoC command 정리 결정 | ⚠️ 수정 포함 (사용자 결정 의뢰) | (1) §5.7.4 v9 stable — 보존 vs cleanup 정책 결정 의무. (2) 명확 — 3 옵션 (보존 / cleanup / sub-set). (3) cleanup = ~80 LOC 제거 / 보존 = 0 LOC. (4) 본 cycle. **사용자 결정 의뢰 §1.4** — 권고 default = cleanup (Karpathy Simplicity). AC-P1. |
| **POC-2** wikey-obsidian deps (`kiwi-nlp` + `@orama/orama`) | POC-1 결정에 종속 | POC-1 = cleanup 시 deps 동시 제거. POC-1 = 보존 시 deps 도 보존. AC-P1 sub. |
| **POC-3** main.js 크기 측정 | ✅ 포함 (1줄 verification) | (1) cleanup 효과 측정. (2) ~5 LOC bash. (3) — (4) 본 cycle. AC-P1 sub. |

### 4.5 C 그룹 (검색 quality + naming) 4 항목

| # | 항목 | 분류 | 근거 |
|---|------|------|------|
| **C1** Q5 회귀 보완 (smart_tokenize 정밀화) | ❌ deferral | (1) 검색 quality tuning — 본 §5.7.5 운영 영역 외. (2) — (3) — (4) **deferral §5.7.6**. |
| **C2** 50~100 query benchmark + 자동화 | ❌ deferral | (1) statistical power. (2) — (3) — (4) **deferral §5.7.6**. |
| **C5** wikey.conf qmd 키 deprecate | ✅ 포함 (v1.2 사용자 결정 #5) | (1) Orama default 후 qmd 잔여 naming = mid-term 운영 cleanliness. (2) `WIKEY_SEARCH_TOP_N` alias 신규 + 기존 `WIKEY_QMD_TOP_N` deprecation log warn. (3) ~30 LOC. (4) 본 cycle. AC-C5. |
| **C6** env-detect.ts qmd 의존 제거 | ✅ 포함 (v1.2 사용자 결정 #5) | (1) default path 부담 0 — qmd block + ABI scan conditional skip (v1.3: `findQmdBin` 부재 fact-check 후 정정). (2) `detectEnvironment` 시그니처 `(basePath, ollamaUrl, searchEngine)` 확장. (3) ~30 LOC + 회귀 path 검증. (4) 본 cycle. AC-C6. |

### 4.6 비목표 추가 검토 2 항목

| # | 항목 | 분류 | 근거 |
|---|------|------|------|
| **HYBRID** Stage 2 hybrid search full reroute | ❌ deferral | (1) 검색 quality 영역 — 본 §5.7.5 운영 영역 외. (2) — (3) — (4) **deferral §5.7.6** (or §5.7.4 의 후속 sub-cycle). |
| **BENCH-AUTO** 검색 quality benchmark 자동화 통합 | ❌ deferral | (1) C2 와 일부 중복. (2) — (3) — (4) **deferral §5.7.6**. |

### 4.7 검증 요약

| 분류 | 개수 | 항목 |
|---|---|---|
| **포함 (해당 cycle 의무)** | **11** | UI-1, UI-2, UI-3, UI-4, UI-5, UI-6, LOW #14, LOW #15, LOW #7, **C5 (v1.2)**, **C6 (v1.2)** |
| **수정 포함 (단순화)** | **9** | UI-7 (표시까지만), B1 (재시작 1회), B2 (LLM analyze 흡수), B4 (본 cycle 포함, UI-4 자연 row), B7 (detect + script 까지), LOW #5 (code lowercase 유지 + docs 정정), POC-1 (cleanup), POC-2 (POC-1 종속), POC-3 (1줄 verification) |
| **deferral / 폐기** | **7** | B3, B5, B6, C1, C2, HYBRID, BENCH-AUTO |

총 27 입력 항목. 본 cycle 안 실 작업 = **20** (포함 11 + 수정 9), 별 cycle / phase deferral = **7** (v1.2: C5/C6 본 cycle 이동 → v1.3 산술 정정). Karpathy Simplicity 의 "200줄을 50줄로" 적용 결과 9 항목이 단순화됨 (UI-7 / B1 / B2 / B4 / B7 / LOW #5 / POC-1 / POC-2 / POC-3).

## 5. Acceptance Criteria (AC) — 총 20 개 (본 cycle 안 구현 의무, v1.2 +AC-C5/C6)

> 본 cycle 의 AC 는 *본 §5.7.5 invariant 와 직접 연결* 되는 항목만 포함. Out-of-Scope (§1.2) 항목은 AC 안 부재 (별 cycle).

### 5.1 단위 AC (RED 작성 → GREEN 통과 의무, 11 개 + v1.2 §5.1.1 의 2 개 = 13 개)

| # | AC | 검증 |
|---|----|------|
| **AC-U1** | `detectUpstreamUpdates({ allowNetwork: true, fetch: mockFetch })` 가 4 항목 (kiwi-nlp / orama / qwen3-embedding / qmd-vendored) 의 `UpdateItemDescriptor[]` 반환. mock fetch 에서 npm latest / GitHub release / model release 응답 시 `currentVersion` / `upstreamVersion` / `hasUpdate` 정상 평가. | wikey-core test (mock fetch). |
| **AC-U2** | `UpdateItemDescriptor.diffSource` 가 각 kind 별로 정확한 URL — kiwi-nlp = `bab2min/Kiwi/compare/<currentTag>...<upstreamTag>` / orama = npm changelog page / qwen3-embedding = HF model card / qmd-vendored = qmd repo compare. | 단위 테스트 (kind 4개 fixture). |
| **AC-U3** | settings-tab `[developer]` 섹션 — `developerMode` toggle false 시 섹션 부재, true 시 섹션 + 4 row 표시. exact phrase: `Developer (advanced)`. | wikey-obsidian 단위 테스트 (mock plugin settings). |
| **AC-U4** | Plugin onload 시 `detectUpstreamUpdates` 호출 matrix (v1.3 보강 — finding 4): (a) `developerMode=true && allowUpdateCheck=true` → 호출 = 1 (cron 금지) / (b) `developerMode=true && allowUpdateCheck=false` → 호출 = 0 / (c) `developerMode=false` → 호출 = 0 (allowUpdateCheck 무관). | wikey-obsidian integration test (mock onload + spy + 3 matrix fixture). |
| **AC-U5** | `renderUpdateRow` — `hasUpdate=true` 시 `[upgrade]` 뱃지 활성화 (CSS class `wikey-settings-upgrade-badge--active`), `false` 시 회색 (`wikey-settings-upgrade-badge--none` + opacity dimmed). exact phrase: `[upgrade]`. | DOM 단위 테스트. |
| **AC-U6** | `analyzeUpdate({ item, llm: mockLlm, fetch: mockFetch })` — mock LLM 가 `{ summary: "...", devRequired: false }` 반환 시 결과 정상 + UI row 안 summary 표시. mock 가 `devRequired: true` 반환 시 `[개발필요]` 마크 표시. exact phrase: `[개발필요]`. | wikey-core test (mock LLM) + wikey-obsidian DOM test. |
| **AC-U7** | `[분석]` 버튼 disabled 상태 — `hasUpdate=false` 시 버튼 disabled (활성화 안 됨). `hasUpdate=true` 시 enabled. | DOM 테스트. |
| **AC-U8** | `[개발필요]` 마크 표시 시 row 안 reason text — `devRequiredReason` 필드가 1줄 이상으로 표시. master 가 별 cycle fix 진행 의무는 *spec docs* 안 명시 (코드 변경 0). | DOM 테스트 + spec docs grep. |
| **AC-L14** | `OramaIndexHandle.persist()` atomic write — temp file (`<cachePath>.tmp`) 생성 + `fs.renameSync(tmp, final)`. abort signal trigger 시 temp 잔존 X (cleanup). | wikey-core test (mock fs + abort). |
| **AC-L15** | `runOramaIngest` 호출 직전까지 Kiwi vendor module load 안 됨 (lazy import) — `engine='qmd'` path 에서 `MODULE_TYPELESS_PACKAGE_JSON` warn 0. | wikey-core integration test (engine='qmd' branch + stderr capture). |
| **AC-L5** | smart_tokenize lowercase 일관 — `wikey-obsidian/src/commands.ts:142~156` PoC + `wikey-core/src/search/orama-korean-tokenizer.ts:135` + `scripts/korean-tokenize.py::_smart_tokenize` 3 위치 모두 *사용자 결정* (§1.4) 결과 mirror. **사용자 결정 의뢰** — default 권고 = code lowercase 유지 + spec/PoC docs 정정. | grep + 단위 테스트. (AC body 는 사용자 결정 후 확정) |

### 5.1.1 v1.2 사용자 결정 #5 — C5/C6 신설 AC (2 개)

| # | AC | 검증 |
|---|----|------|
| **AC-C5** | `WIKEY_SEARCH_TOP_N` alias 신규 + 기존 `WIKEY_QMD_TOP_N` deprecation marker — config defaults (`config.ts:13`) + `loadFromWikeyConf` parser 안 양쪽 키 모두 인식 + 기존 키 사용 시 console warn 1회 (`[wikey] WIKEY_QMD_TOP_N is deprecated, use WIKEY_SEARCH_TOP_N`). 우선순위: `WIKEY_SEARCH_TOP_N` > `WIKEY_QMD_TOP_N` > default. exact phrase: `WIKEY_SEARCH_TOP_N`. | wikey-core test (mock config + warn spy). |
| **AC-C6** | (v1.3 정정 — finding 2 fix) `detectEnvironment(basePath, ollamaUrl, searchEngine)` 시그니처 확장 — `searchEngine !== 'qmd'` 시 qmd path block (`env-detect.ts:273~283`) + `findCompatibleNode` ABI scan skip (`status.qmdPath = ''`, `nodePath = process.execPath`). `searchEngine === 'qmd'` 시 기존 inline detect 정상 동작. test fixture: (a) `searchEngine='orama'` → `qmdPath=''` + ABI scan call 0, (b) `searchEngine='qmd'` (toggle) → `qmdPath` resolved + ABI scan call ≥ 1. | wikey-obsidian test (engine flag fixture + spy on `tools/qmd/bin/qmd` access). |

### 5.2 통합 AC (script + license + cleanup, 4 개)

| # | AC | 검증 |
|---|----|------|
| **AC-S1** | `scripts/check-kiwi-vendor-sync.sh` (~50 LOC) 신규 — `bab2min/Kiwi` releases API fetch + `VENDOR.md` 의 Kiwi git tag 비교 + stdout `current=<tag> upstream=<tag> hasUpdate=<bool>` 형식 출력. exact phrase: `bab2min/Kiwi`. | bash test (mock curl + stdout grep). |
| **AC-L7** | `scripts/check-licenses.sh` (~50 LOC, v1.3 finding 6 보강) 신규 — `wikey-core/package.json` + `wikey-obsidian/package.json` 의 `dependencies` (devDependencies 제외) 와 `NOTICE` 의 항목 grep diff. **internal/workspace dep allowlist** = `["wikey-core"]` (workspace dep, NOTICE 무관). **devDependencies 제외 규칙** = `node_modules` build/test 도구는 NOTICE 대상 아님. dep 추가 + NOTICE 누락 시 exit 1 + 누락 dep 출력. exact phrase: `Third-party software`. | bash test (mock package.json + allowlist fixture). |
| **AC-P1** | PoC code cleanup (사용자 결정 의뢰 §1.4) — default 권고 = cleanup 시: `wikey-obsidian/src/commands.ts:96~522` 3 PoC command 제거 + `wikey-obsidian/package.json` 의 `kiwi-nlp` + `@orama/orama` 제거 + `main.js` size ≤ 400K. 보존 시: 변경 0 + 본 AC 의 검증 부분 = 보존 명시 grep. | size 측정 + grep. |
| **AC-D1** | (v1.3 finding 5 fix — v1.2 결정 #1 (A) 잠금 mirror) settings-tab `[developer]` 섹션 docs 추가 — README.md `## Developer mode` 섹션 (~30 줄) — `Show developer section` 토글 활성화 방법 + 4 row 의미 + `[분석]` 버튼 + `[개발필요]` 마크 흐름. exact phrase: `Show developer section` (옵션 (A) 만, env 표기 미도입). | grep README.md. |

### 5.3 라이브 cycle smoke AC (master 직접, obsidian-cdp, 3 개)

| # | AC | 검증 |
|---|----|------|
| **AC-V1** | obsidian-cdp full cycle — Obsidian 재시작 → settings tab 열기 → developer toggle on → `[developer]` 섹션 표시 → 4 row 모두 표시 + 각 row 의 currentVersion 정상. update 있으면 `[upgrade]` 뱃지 표시 (라이브 시점의 actual upstream). | master 직접 실행, console log + DOM 캡처. |
| **AC-V2** | `[분석]` 버튼 클릭 시 LLM 호출 1회 + summary 표시 ≤ 30s (LLM provider latency). devRequired=true 시 `[개발필요]` 마크. | console log latency + DOM 캡처. |
| **AC-V3** | settings developer toggle off → 섹션 숨김 + plugin onload 시 `detectUpstreamUpdates` 호출 0 (사용자 동의 옵트아웃 path 작동 확증). v1.3 보강: `developerMode=true && allowUpdateCheck=false` toggle off 도 검증 — `[developer]` 섹션 표시되지만 onload 호출 0 (사용자 명시 동의 후만). | console log spy + `allowUpdateCheck` matrix. |

## 6. Risk grid + 완화

| # | Risk | Severity | 확률 | 완화 | AC |
|---|------|----------|------|------|-----|
| 1 | 외부 source fetch 실패 (network 부재 / API 변경) | MED | MED | UI row 안 `fetchError` 표시 + 회색 처리. plugin 작동 자체에 영향 0. | AC-U1, AC-V1 |
| 2 | LLM 분석 비용 burst (사용자 [분석] 버튼 spam) | LOW | LOW | UI 안 1 항목당 1회 cache + 재호출 시 cached 결과 표시. invalidate = 사용자 명시 reset. | AC-U6 (sub) |
| 3 | `[개발필요]` heuristic 부정확 (false positive / negative) | MED | MED | LLM 의 boolean + reason text 모두 사용자에게 표시 — 사용자가 최종 판단. *알림* 까지만 (UI-7 단순화). | AC-U6, AC-U8 |
| 4 | settings developer toggle 누설 (일반 사용자가 발견) | LOW | LOW | settings tab 의 *맨 마지막* + heading "Developer (advanced)" + 사용자 명시 비공식 영역. (사용자 의도 = "일반 사용자는 알 수 없음" 충족) | AC-U2, AC-U3 |
| 5 | atomic write (LOW #14) cross-platform 호환 (Windows rename ≠ POSIX) | MED | LOW (Obsidian = mac/linux/windows 모두) | `fs.renameSync` 의 Windows behavior = same-filesystem 시 atomic. cross-filesystem 은 `os.tmpdir()` 의 `<cachePath>` 동일 device 가정 (실 사용 패턴). | AC-L14 |
| 6 | LOW #15 lazy import 가 build-time tree-shake 위반 | LOW | LOW | esbuild dynamic import — runtime branch 안 import. test fixture 로 production build 후 stderr 검증. | AC-L15 |
| 7 | scripts/check-kiwi-vendor-sync.sh GitHub API rate limit | LOW | LOW (1 user 가 plugin 1번 onload 시 1 call) | `If-None-Match` ETag 활용 또는 단순 1-day cache file (`~/.cache/wikey/kiwi-update-cache.json`). | AC-S1 (sub) |
| 8 | analyze LLM provider 미설정 (사용자 BYOAI 미구성) | LOW | LOW | `[분석]` 버튼 disabled + tooltip "LLM provider 미설정 — settings 안 provider 구성 의무". | AC-U6 (사용자 결정 의뢰 §1.4 — provider 미설정 시 default fallback) |
| 9 | UI-1 patch list (VENDOR.md) 와 upstream diff 의 충돌 분석 정확도 부족 | MED | MED | analyze prompt 안에 patch list + upstream changelog 함께 제공 — LLM 가 충돌 가능성 평가. 부정확 시 사용자가 [개발필요] 마크 무시 가능. | AC-U6, AC-U8 |
| 10 | 사용자 결정 5건 (§1.4) 미응답 → spec drift | HIGH | LOW (master 가 spec 안 명시 → 사용자 응답 의무) | `[사용자 결정]` 마커 명시 + 본 spec entry 의 default 권고 + Step A1 안 결정 잠금 의무 + 미응답 시 master 가 사용자 prompt | (구조 risk) |

## 7. Dependencies

본 §5.7.5 의 진입 조건 + 후속 cycle 순서:

### 7.1 진입 조건 (충족 의무)

- [x] §5.7.4 GREEN cycle 종결 (4 commits, 2026-05-09 session 29) — orama backend stable
- [x] codex post-impl 6 cycle APPROVE_WITH_CHANGES — HIGH 0 / MED 0 / LOW 1 fix 완료
- [x] 라이브 smoke 4 항목 (AC-L1/L2/L3 + PoC benchmark) 모두 PASS
- [ ] **[사용자 결정 의뢰 §1.4]** 5건 결정 잠금 (Step A1 의무) — 본 spec 의 implementation scope 일부가 사용자 결정에 의존

### 7.2 후속 cycle 순서

본 §5.7.5 종결 후 진행 순서 (사용자 우선순위 결정 필요):

1. **§5.5 지식 그래프 · 시각화** (P3) — NetworkX + Leiden + vis.js / Obsidian Graph View
2. **§5.6 성능·엔진 확장** (P3) — Ollama vs llama.cpp / rapidocr Linux baseline
3. **§5.7.6 검색 quality tuning** (신설 후보) — C1 (Q5 보완) + C2 (50~100 benchmark) + HYBRID (Stage 2 reroute) 통합
4. **§5.8 Phase 4 D.0.l 잔여** (P4)
5. **§5.9 Variance diagnostic** (P4)

본 §5.7.5 가 §5.5 / §5.6 의 *진입 조건* 은 아님 — 독립 진행 가능.

### 7.3 사용자 결정 의뢰 5건 (`[사용자 결정]` 마커)

본 v1 작성 시점에 analyst 가 임의 결정 안 한 항목. master 가 본 spec read 후 사용자에게 명시 prompt 의무:

| # | 결정 항목 | v1.2 사용자 결정 잠금 (2026-05-09) | 영향 |
|---|----------|----------------------------------|------|
| **1** | `WIKEY_DEVELOPER_MODE` 활성화 방식 — (A) settings 토글 / (B) env / wikey.conf 키 / (C) 양쪽 | **(A) settings 토글** | §3.3 settings UI + AC-D1 docs = `Show developer section` toggle 만 |
| **2** | update check network 호출 동의 — default opt-in / opt-out | **opt-in** (사용자 명시 동의 후 호출) | AC-U4 default behavior — 사용자 toggle off 시 onload 호출 0 |
| **3** | 분석 버튼의 LLM provider — wikey 기본 BYOAI / 사용자 명시 / per-call provider 선택 | **wikey 기본 BYOAI** (`buildConfig` default provider) | §3.2 + AC-U6 |
| **4** | LOW #5 lowercase 정합 방향 — code 유지 / docs 통일 / Python 추가 | **code lowercase 유지 + spec/PoC docs 정정** | AC-L5 body 잠금 |
| **5** | C5 (qmd 키 deprecate) / C6 (env-detect qmd 제거) 의 본 cycle 포함 여부 | **본 cycle 포함** (AC-C5 + AC-C6 신설) | §1.2 Out-of-Scope 제거 + §4.5 분류 변경 (deferral 9→7, 포함 9→11) + §5.1.1 신설 |

부가 결정 (v1.4 사용자 일괄 잠금 — 권고 default 채택):
- ✅ **선행 의무 1**: `wikey.schema.md` 검색 코어 안정성 갱신 = **본 §5.7.5 진입 직전 별 step** (Step A 직전 master 가 사용자 승인 받고 별 commit 진행). schema spec scope 외 변경.
- ✅ **선행 의무 2**: `claude-harness-helper` repo commit (master-validation skill v1.4 anchor (f) exact match 보강 + rules.md §10) = **별 repo master 단독 처리** (본 §5.7.5 spec scope 외, 본 cycle 안 master-validation skill 갱신만 본 commit 에 포함, harness-helper 별 repo commit 은 별 단계).
- ✅ **B4 잠금**: Kiwi 사전 update 추적 = **본 cycle 포함** — `upstream-checker.ts` 안 5번째 `kind: 'kiwi-dict'` row 추가 (~104MB 사전 release 추적, `~/.cache/wikey/kiwi-models/` md5 + Kiwi 본가 release 비교, ~30 LOC).
- ✅ **POC-1 잠금**: PoC 3 command 정리 = **cleanup** (Karpathy Simplicity). `wikey-obsidian/src/commands.ts:96~522` 3 PoC command + `wikey-obsidian/package.json` deps (`kiwi-nlp`, `@orama/orama`) 제거. main.js ~496K → ~370K 예상.

## 8. Self-check (rules.md §10 + analyst override anchor h~j)

본 spec v1 의 self-check (master 가 codex 송부 전 1차 grep 의무 — Layer 1 7-anchor + Layer 2 6 codex 패턴 P1~P6 + Layer 3 7 fix 모드 F1~F7 + 본 wikey project analyst override anchor h/i/j):

| # | Anchor | 결과 | 검증 명령 |
|---|--------|------|-----------|
| (a) | 시그니처 일관성 — `UpdateItemDescriptor` / `UpdateCheckResult` / `UpdateItemKind` / `developerMode` / `allowUpdateCheck` setting / `[upgrade]` / `[분석]` / `[개발필요]` 본문 cross-section 동일 (v1.3: `WIKEY_DEVELOPER_MODE` env 키 미도입 잠금, history mention 만 보존) | PASS_v1.3 — §3.1 + §3.3 + §5 (20 row) + §6 (10 row) 모두 일관 | `grep -nE "UpdateItemDescriptor\|developerMode\|allowUpdateCheck\|\[upgrade\]\|\[분석\]\|\[개발필요\]" docs/planning/phase-5/phase-5-spec-5.7.5-orama-update-sync.md` |
| (b) | state/data 표 형식 — 27 입력 (UI 7 + B 7 + LOW 4 + POC 3 + C 4 + 비목표 2) 검증 표 + §5 AC numbering (실제 bold row **20** = §5.1 11 + §5.1.1 2 + §5.2 4 + §5.3 3, v1.2 +C5/C6) 일관 | PASS_v1.3 — count drift 0, 모든 AC 가 §5 정의 + §6 Risk + §3 변경 영역 1:1 mapping | `grep -cE "^\| \*\*AC-" docs/planning/phase-5/phase-5-spec-5.7.5-orama-update-sync.md` ≥ 20 |
| (c) | builder/parser 분기 — `detectUpstreamUpdates` lifecycle (onload 1회 / [분석] 버튼 trigger) + `developerMode` + `allowUpdateCheck` 양쪽 toggle 분기 (UI 표시 vs 부재 + network 호출 vs 0) 모두 명시 (v1.3 보강) | PASS_v1.3 — §3.1 lifecycle 표 + §3.3 toggle 분기 모두 명시 + AC-U4 matrix 3건 | grep `"onload"` + `"developerMode"` + `"allowUpdateCheck"` |
| (d) | AC ↔ §1 목표 1:1 매핑 | PASS_v1.3 — 목표 6항 → AC-U3 (목표 1) / AC-U4 (목표 2) / AC-U5, AC-U6 (목표 3) / AC-U6, AC-U7, AC-U8 (목표 4) / AC-L5, AC-L7, AC-L14, AC-L15 (목표 5) / §4.7 표 + §1.2 (목표 6). **v1.2 신규 AC-C5/C6** = 목표 6 의 sub (분류 잠금 — *naming refactor 본 cycle 포함*) | line-by-line 검증 |
| (e) | self-check 모든 행 drift 없음 — v1.3 작성 직후 stale 0 본문 한정 (변경 이력 + history mention 의도적 보존) | PASS_v1.3 — 본 §8 v1.3 fix 후 stale 0 (anchor (a) WIKEY_DEVELOPER_MODE history mention 만, active body active phrase 모두 `developerMode` setting 으로 정정) | (본 §8 line read) |
| (f) | footer + version + 변경 이력 — frontmatter `version: v1.3` (exact match, prefix match 회피) ↔ §9 변경 이력 마지막 row v1.3 ↔ footer cycle # (codex cycle #1 NEEDS_REVISION fix → cycle #2 APPROVE) 일관 | PASS_v1.3 | `grep -nE "^version: v1\.3$"` exact match |
| (g) | 코드 ↔ test exact phrase — `[upgrade]` / `[분석]` / `[개발필요]` exact phrase + `Show developer section` (v1.3 결정 #1 (A) 잠금 mirror, env 키 미도입) + `bab2min/Kiwi` + `Developer (advanced)` + `Third-party software` + `WIKEY_SEARCH_TOP_N` AC 내 일치 | PASS_v1.3 — quote 정합 일치 | `grep -F "[upgrade]"` + `grep -F "[분석]"` + `grep -F "[개발필요]"` + `grep -F "Developer (advanced)"` + `grep -F "Show developer section"` + `grep -F "Third-party software"` 양쪽 hit |

### 8.1 wikey analyst override anchor (h, i, j) — wikey project specialization (CLAUDE.md §1)

| # | Anchor | 결과 | 검증 명령 |
|---|--------|------|-----------|
| **(h) schema 4 원칙 일치** | Explicit / Yours / File over app / BYOAI 4 원칙 충돌 0 | PASS_v1.3 — (Explicit) settings UI 가 LLM/dep 의 update 상태를 가시화 / (Yours) 모든 dep / vendor 가 wikey 안 local — 외부 SaaS 의존 0 / (File over app) NOTICE / VENDOR.md / settings 변경 모두 마크다운/JSON local file / (BYOAI) [분석] 버튼이 wikey 기본 provider 사용 (v1.2 사용자 결정 #3 잠금) | wikey.schema.md §"LLM Wiki 개인화의 4가지 장점" cross-check |
| **(i) 3계층 경계 준수** | raw / wiki / schema 권한 위반 0 | PASS_v1.3 — 본 spec 변경 면 = settings-tab + 신규 update-checker 모듈 + scripts/check-* + NOTICE/README. raw/ 변경 0, wiki/ 변경 0, wikey.schema.md 변경 = 사용자 승인 의무 (§1.2 / §7.3 부가 결정 #선행 의무 1 명시) | grep `"raw/"` 변경 0 + grep `"wiki/"` 변경 0 |
| **(j) 워크플로우 4 일관** | ingest / query / lint / 삭제·수정 흐름 schema 정의 일치 | PASS_v1.3 — 본 spec 의 변경이 4 워크플로우 *동작* 변경 0 (settings-tab UI + 신규 update-checker 모듈 + LOW fix 는 모두 *infrastructure*). canonicalizer / mention extractor / ingest pipeline 변경 0 = ingest 워크플로우 보존. query path 변경 0 = query 워크플로우 보존. 본 spec wiki 본문 변경 0 = lint / 삭제·수정 워크플로우 보존 | wikey.schema.md §"시스템 워크플로우" cross-check |

### 8.2 Layer 2 codex 패턴 P1~P6 + Layer 3 fix 모드 F1~F7

본 v1 spec 은 *analyst 작성 직후* — codex cycle 미진입. master 가 codex 송부 전 P1~P6 + F1~F7 self-check 의무 (rules.md §10 의무):

| Layer | self-check 결과 (analyst v1 작성 직후) |
|-------|----------------------------------------|
| **P1 Fact-check** | `wikey-obsidian/src/settings-tab.ts` / `wikey-core/vendor/kiwi-nlp/VENDOR.md` / `wikey-obsidian/src/commands.ts:142~156` 등 §2 의 grep 직접 read 확증. line number 의 micro drift 가능 — 구현 시 재검증 의무. |
| **P2 Cross-file consistency** | spec §3 + §4 + §5 + §6 + §7 의 모든 reference (UI-1~UI-7 / AC-U1~U8 / AC-L5/L7/L14/L15 / AC-S1 / AC-P1 / AC-D1 / AC-V1~V3) 일관. `[사용자 결정]` 5건 §1.4 + §3 + §4 + §7.3 mirror. |
| **P3 Spec→Todo byte mirror** | spec v1 작성 후 todo v1 가 본 spec 의 §1.2 비목표 / §4 검증 표 / §5 AC count / `[사용자 결정]` 5건 byte-level mirror 의무 — todo 작성 시 동일 anchor self-check. |
| **P4 Implementation feasibility** | settings-tab `[developer]` 섹션 = 기존 패턴 (`wikey-settings-*` prefix, v1.1 fact-check 결과) mirror — 구현 가능. update-checker fetch — fetch DI + mock 가능. analyzeUpdate LLM = 기존 llm-client wrap. atomic write = `fs.renameSync` 표준. lazy import = esbuild dynamic import 지원. |
| **P5 Legal accuracy** | 본 spec 의 license 영역 = `scripts/check-licenses.sh` (NOTICE / package.json deps grep diff) — §5.7.4 v9 의 NOTICE 6 항목 (LGPL §6 4 의무) 변경 0. 신규 LLM 분석 결과는 user-facing summary — license 영역 변경 0. |
| **P6 Numeric consistency** | `grep -cE "^\| \*\*AC-"` ≥ **20** (5.1 = 11 + 5.1.1 = 2 + 5.2 = 4 + 5.3 = 3 = 20, v1.2 +C5/C6). §4.7 합계 = **11 + 9 + 7 = 27** 입력. §1.4 사용자 결정 5건 잠금 + 부가 4건. 모든 count §8 self-check 와 일치. (v1.2 fix: 18→20 AC, 9/9/9 → 11/9/7 분류) |
| **F1 Partial replacement** | 본 v1 작성 — replace_all 누락 risk = master fix loop 진입 시 의무. |
| **F2 Cascading rename incomplete** | 본 v1 작성 — rename 0. |
| **F3 Header/Body mismatch** | §5 헤더 "총 20 개" ↔ §5.1 11 + §5.1.1 2 + §5.2 4 + §5.3 3 = 20 일치 (v1.2). §4.7 헤더 "27 입력" ↔ 11+9+7 = 27 일치 (v1.2). |
| **F4 Spec→Todo mirror 누락** | 본 v1 작성 직후 — todo v1 가 본 spec 의 모든 reference mirror 의무. |
| **F5 History context 와 활성 본문 혼동** | §9 변경 이력 = v1 만 — historical 표현 0. |
| **F6 Implementation feasibility 미검증** | P4 와 동일. |
| **F7 Codex 권고 over-literal 적용** | 본 v1 작성 — codex finding 0 (cycle 미진입). 향후 cycle 시 의무. |

## 9. 변경 이력

| 버전 | 일시 | 변경 |
|------|------|------|
| **v1** | 2026-05-09 session 30 (analyst 작성) | 초안 — 사용자 신규 UI 7 요구사항 (developer update detect/analyze/dev-required mark) + B/LOW/PoC/C/비목표 그룹 27 입력 항목 4-question 검증. spec 6요소 (Goal / Inputs / Outputs / Invariants / AC / Out-of-Scope / Dependencies). AC 18 (단위 11 + 통합 4 + 라이브 3). Risk 10건. 사용자 결정 의뢰 5건 (`[사용자 결정]` 마커) + 부가 4건. wikey analyst override anchor h/i/j 추가 self-check. master fix / codex cycle 미진입 — v1 = analyst 작성 직후 상태. |
| **v1.1** | 2026-05-09 session 30 (master 1차 검증 fix) | master-validation 스킬 23-anchor 적용 결과 2 fix: (1) **P1 fact-check 위반** — `wk-section` / `wk-developer-section` CSS class 표기 stale, 실제 settings-tab.ts 는 `wikey-settings-*` prefix (line 83/94/117/136/396 등) 사용. §2 line 56 + §3.3 line 159~162 + AC-U5 의 CSS class 모두 `wikey-settings-*` prefix 로 정정. (2) [todo v1.1 mirror] **F3 Header/Body** — todo §5.2 P6 의 LOC 합계 ~565 → ~955 (cleanup 시) / ~875 (보존 시) 로 정정. master-validation skill 갱신 의무 0 (M2 = P1 하위 케이스, M5 = F3 일반 케이스). |
| **v1.2** | 2026-05-09 session 30 (사용자 결정 5건 잠금) | 사용자 결정 5건 잠금: #1 (A) settings 토글 / #2 opt-in / #3 wikey 기본 BYOAI / #4 code lowercase 유지 + docs 정정 / **#5 C5/C6 본 cycle 포함** (권고 deferral 와 다름). 영향: §1.2 Out-of-Scope 에서 C5/C6 제거 (취소선) + §2 행 16/17 갱신 + §4.5 분류 변경 (✅ 포함) + §4.7 분류 합계 변경 (포함 9→11, deferral 9→7) + **§5.1.1 신설** (AC-C5 + AC-C6) + §5 헤더 18→20 AC + §5.1 헤더 11+2=13 + §7.3 사용자 결정 표 잠금 결과 mirror. todo v1.2 mirror 의무. |
| **v1.4** | 2026-05-09 session 30 (codex cycle #2 APPROVE + 부가 결정 4건 잠금 + skill 갱신) | codex cycle #2 verdict APPROVE (LOW 2건 — v1.3 mirror 품질 + history negative context). master 직접 fix LOW 5 위치 (PASS_v1 → PASS_v1.3, footer v1.3 mirror, anchor (a)/(c)/(d) v1.3 mirror). **부가 결정 4건 사용자 일괄 잠금** (권고 default): 선행 의무 #1 schema 진입 직전 별 step / #2 harness-helper 별 repo master 단독 / B4 Kiwi 사전 본 cycle 포함 (`kind:'kiwi-dict'` 5번째 row, ~30 LOC) / POC-1 cleanup (~80 LOC 제거). **`master-validation` skill 갱신 (사용자 승인)**: Layer 1 anchor (f) `version exact match` 보강 — 기존 prefix `grep "version: v1"` hole 로 v1.3 PASS_v1 stale 미감지 catch. claude-harness-helper repo commit 별도. |
| **v1.3** | 2026-05-09 session 30 (codex cycle #1 NEEDS_REVISION fix) | 6 finding (HIGH 0 / MED 5 / LOW 1) 모두 master 직접 fix. (1 P6/F3/F4) §4.7 산술 정정 = `실 작업 = 20 (포함 11 + 수정 9), deferral = 7` + todo line 190/193 mirror. (2 P1/P4/F6) **AC-C6 정확화** — `findQmdBin` 함수 부재 fact-check 결과 `detectEnvironment(basePath, ollamaUrl, searchEngine)` 시그니처 확장 + qmd inline block / ABI scan conditional skip 으로 정정. test fixture 2 case (orama / qmd 양쪽). §2 행 17 + AC-C6 + §4.5 + todo Step B2-C6 + RED test file name (`env-detect-engine-flag.test.ts`) mirror. (3 P1) **Qwen3-Embedding path 정확화** — §2 행 5 = `hf:Qwen/Qwen3-Embedding-0.6B-GGUF/Qwen3-Embedding-0.6B-Q8_0.gguf` URI + 로컬 cache `~/.cache/qmd/models/hf_Qwen_...` (실측). diffSource = HF model card URL. (4 P2/P4) **`allowUpdateCheck` setting 정의 보강** — §3.3 settings 코드 snippet 에 `WikeySettings.developerMode` + `allowUpdateCheck` field 추가 의무 명시 (main.ts:34/87/651) + AC-U4 matrix 3건 (developerMode + allowUpdateCheck 조합) + AC-V3 보강. (5 P2/P3/F4) **README 결정 #1 (A) mirror** — `WIKEY_DEVELOPER_MODE` env 표기 미도입 명시, README 는 `Show developer section` 만 문서화. AC-D1 + todo Step D-readme mirror. (6 P5) **AC-L7 allowlist 보강** — `wikey-core` workspace dep 제외 + devDependencies 제외 규칙 명시 (~30→50 LOC). codex 권고 모두 정확 (false positive 0). master fix 직접, analyst 재호출 0. master-validation skill 갱신 후보 0 (모든 finding 이 P1/P2/P3/P4/P5/P6/F3/F4/F6 cover, master 의 systematic application gap — skill 정의 자체는 정확). |

---

> **footer (cycle 추적)**: §5.7.5 spec v1.4 작성 완료 (analyst v1 + master fix v1.1/v1.2 + codex cycle #1 NEEDS_REVISION fix v1.3 + cycle #2 APPROVE + 부가 결정 잠금 + skill 갱신 v1.4, 2026-05-09 session 30). codex Mode D Panel cycle #2 verdict: **APPROVE**. 다음 단계 = phase-5-todo.md §5.7.5 mirror + 단일 commit + Step B 진입은 다음 세션 (사용자 결정).
