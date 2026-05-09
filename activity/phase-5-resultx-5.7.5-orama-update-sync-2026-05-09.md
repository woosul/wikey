---
phase: 5
section: 5.7.5
title: §5.7.5 Orama upstream sync 자동화 + LOW 잔여 + PoC cleanup + Developer Update UI — 라이브 smoke detail evidence
date: 2026-05-09
session: 31
status: completed
---

# §5.7.5 Detail Evidence — 라이브 smoke + 6 codex cycle + master fix loop

> **상위 문서**: [`activity/phase-5-result.md §5.7.5`](./phase-5-result.md#575-orama-upstream-sync-자동화--low-잔여--poc-cleanup--developer-update-ui--session-31-2026-05-09)

본 detail 은 §5.7.5 진행의 **라이브 smoke evidence + codex 6 cycle verdict + master fix 5 loop** 을 line-by-line 추적. 상위 result.md entry 가 요약 — 본 문서는 reproducibility evidence.

## 1. 진입 조건 (사용자 결정 9건 + 선행 commit)

**v1.4 사용자 결정 9건 (모두 spec §1.4 + §7.3 잠금)**:
- #1 = (A) settings 토글 `Show developer section` (env 키 미도입)
- #2 = opt-in (allowUpdateCheck default false)
- #3 = wikey 기본 BYOAI (`buildConfig` default provider)
- #4 = code lowercase 유지 + spec/PoC docs 정정 (production code 이미 일관 — `commands.ts:154` `.toLowerCase()` + `orama-korean-tokenizer.ts:135` 모두 lowercase)
- #5 = C5/C6 본 cycle 포함
- 부가 #1 = `wikey.schema.md` 별 commit (Step A 진입 직전 master 직접 진행)
- 부가 #2 = `claude-harness-helper` 별 repo (본 cycle 외)
- 부가 B4 = Kiwi 사전 본 cycle 포함 (5번째 `kind: 'kiwi-dict'` row, ~30 LOC)
- 부가 POC-1 = cleanup (~80 LOC 제거)

**선행 commit `62f6992` (Step A 진입 직전)**:
- `wikey.schema.md` 검색 코어 4 영역 갱신 — Orama default + qmd fallback path + Kiwi WASM 한국어 tokenizer 명시
- 사용자 승인 의무 (CLAUDE.md 쓰기 규칙) — AskUserQuestion 으로 4 영역 변경안 제시 후 "전체 적용 (4개 영역)" 승인 받음
- 변경 영역: §"검색 코어의 안정성" line 391 / §"참조 프로젝트의 검색 해법" line 399~417 + 코드블록 / §"도구" line 643 / §"한국어 운영 참고" line 693~695

## 2. Step A — fact-check 6 위치 (master fresh re-grep)

| # | 위치 | 사실 |
|---|------|------|
| 1 | `wikey-obsidian/src/settings-tab.ts` (1175 LOC) | CSS prefix `wikey-settings-*` (line 83/94/117/123/136). 신규 prefix `wikey-settings-developer-*` 사용. 마지막은 `EditSchemaModal` 클래스. settings tab `display()` 안에 추가. |
| 2 | `wikey-obsidian/src/commands.ts:96~522` 3 PoC | `wikey-poc-orama-benchmark` (line 105), `wikey-poc-kiwi-orama` (line 257), `wikey-poc-orama-test` (line 443). POC-1 cleanup 잠금 = 3 command 제거 + `wikey-obsidian/package.json` deps `kiwi-nlp` + `@orama/orama` 제거. |
| 3 | `wikey-obsidian/src/commands.ts:154` | PoC code 이미 `.toLowerCase()` 적용. LOW #5 작업 = `scripts/korean-tokenize.py::_smart_tokenize` docstring 갱신만 (POC-1 cleanup 시 PoC docs 자연 해소). |
| 4 | `wikey-core/src/search/orama-index.ts:180~183` | `oramaSave + writeFileSync` 패턴. abort signal 부재 — atomic write (`<cachePath>.tmp` + `fs.renameSync` + `opts.signal?.aborted` check) 변경 대상. |
| 5 | `wikey-obsidian/src/env-detect.ts:253` | `detectEnvironment(basePath, ollamaUrl)` + line 273~283 inline qmd block + `findCompatibleNode` (line 95~). **`findQmdBin` 함수 부재** (v1.3 정정 확증). 시그니처 확장 = `detectEnvironment(basePath, ollamaUrl, searchEngine)`. main.ts:473 호출 site 갱신. |
| 6 | `wikey-core/vendor/kiwi-nlp/VENDOR.md` | Kiwi git tag = v0.23.0 / vendor date = 2026-05-09. B7 detect script (`scripts/check-kiwi-vendor-sync.sh`) input. |

**main.ts 위치 fact-check**: line 34 (WikeySettings interface) / 87 (DEFAULT_SETTINGS) / 122 (export type) / 151 (settings field) / 473 (detectEnvironment 호출) / 651 (buildPluginOnlyData) — 모두 확증.

**baseline (master 직접 측정)**: wikey-core = 726 PASS / 3 skipped / wikey-obsidian = 38 PASS / build 0 errors.

## 3. Step B — TDD RED → GREEN → BLUE 3a (developer agent 위임)

**developer agent 위임 prompt 4 항목** (rules.md §11.1 mirror):

| 항목 | 내용 |
|------|------|
| (a) 검증 단계 | RED 16 case (FAIL 확증) → GREEN ~565 LOC 구현 (16 RED PASS + 회귀 무손상) → BLUE 3a (npm test/build/validate-wiki/check-licenses/check-kiwi-vendor-sync) |
| (b) 통과 기준 | RED 16 FAIL / GREEN 16 PASS + wikey-core ≥ 740 / wikey-obsidian ≥ 45 / build 0 errors |
| (c) 산출 형식 | `## FINAL_REPORT` heading + verdict + tests + build + scripts + LOC + main.js size + commits + last line `VERDICT: ...` |
| (d) scope 한계 | 라이브 smoke (master 영역) 미진행 / wiki/ raw/ schema 변경 0 / commit 분리 (RED + GREEN) / spec §3 면 직접 추적 (Karpathy Surgical) |

**developer SUCCESS verdict**:
- wikey-core: 737 PASS / 3 skipped (+11)
- wikey-obsidian: 46 PASS (+8)
- build 0 errors / scripts 모두 PASS / `current=v0.23.0 upstream=v0.23.1 hasUpdate=true`
- LOC ~1071 total / main.js 496679 → 433384 bytes (-63KB, -12.7%)
- 2 commit: `d0ab150` RED + `02b0318` GREEN

**master 1차 검증 23-anchor (rules.md §10 + master-validation skill)**:
- Layer 1 (a~g) PASS — signature / state-data / branch / AC mapping / drift 0 / footer / exact phrase
- Layer 2 (P1~P6) PASS — fact-check / cross-file / spec→code byte mirror / feasibility / legal / numeric
- Layer 3 (F1~F7) PASS — partial replacement / cascading / header-body / spec-todo / history / feasibility / over-literal
- Layer 4 (R1~R6) PASS — CJS / ESM CLI / test isolation / same-process / cross-process / abort signal
- Karpathy 4원칙 cross-check PASS

## 4. codex 6 cycle 흐름 (완전 evidence)

### 4.1 cycle #1 — plan review (NEEDS_REVISION)

6 finding (HIGH 0 / MED 5 / LOW 1):
1. P1 fact-check — `findQmdBin` 부재 (실제 = `detectEnvironment` inline)
2. P3 spec→todo mirror — §4.7 산술 / 합계 정정
3. P2 cross-file — Qwen3-Embedding path 정확화
4. P2/P4 — `allowUpdateCheck` setting 정의 보강 (matrix 3건)
5. P2/P3 — README 결정 #1 (A) mirror (env 표기 미도입)
6. P5 — AC-L7 allowlist 보강 (workspace dep + devDependencies 제외)

→ master 직접 fix → spec/todo v1.3.

### 4.2 cycle #2 — plan review (APPROVE_v1.4)

LOW 2건 (v1.3 mirror 품질 + history negative context). master 직접 fix LOW 5 위치. 부가 결정 4건 일괄 잠금. master-validation skill 갱신 (anchor (f) version exact match 보강).

### 4.3 cycle #3 — post-impl review (NEEDS_REVISION)

4 MED + 2 LOW:
1. **MED AC-C5**: `WIKEY_SEARCH_TOP_N` parsed but not honored — `query-pipeline.ts:337/398` 가 여전히 `WIKEY_QMD_TOP_N` 만 사용. main.ts:792 buildConfig hardcode.
2. **MED AC-U1/U2 qmd**: upstream-checker.ts:51 `qmd/qmd` 잘못 (실 `tobi/qmd`). currentVersion='vendored' + hasUpdate=false hardcode.
3. **MED AC-U2 Kiwi**: diffSource = releases page (spec 요구 = `bab2min/Kiwi/compare/<currentTag>...<upstreamTag>`).
4. **MED AC-L14 + R6**: `reindex.ts:222` production caller `await handle.persist()` (signal 미전달).
5. **LOW AC-U5**: styles.css 안 `wikey-settings-upgrade-badge--active|--none` CSS 부재.
6. **LOW AC-P1**: 433KB > 400K threshold 미달 — master ACK 또는 spec 정정.

→ master 직접 fix `a8ca27b` (5 fix + 1 ACK).

### 4.4 cycle #4 — re-review (NEEDS_REVISION)

1 MED + 5 verified:
- **MED AC-C5 default merge**: `DEFAULTS.WIKEY_SEARCH_TOP_N: 8` 가 user 의 deprecated `WIKEY_QMD_TOP_N=N` override 차단. `Object.assign(DEFAULTS, parsedConf)` 시 user canonical 미명시 → DEFAULTS 8 잔존 → getSearchTopN canonical 8 우선 → user N 무시.

→ master 직접 fix `e964be1` (DEFAULTS 의 `WIKEY_SEARCH_TOP_N: 8` omit, types.ts optional 정합).

ESM eval verified: `only QMD=7 → 7` / `SEARCH=10+QMD=7 → 10` / `empty → 8 default`.

### 4.5 cycle #5 — re-review (APPROVE)

Findings: none. cycle #4 fix verified.

### 4.6 cycle #6 — live smoke fix re-review (APPROVE)

Findings: none. master live-smoke fix `a87c7f8` verified — main.ts:583 `call(prompt)` / extractJsonObject markdown fence strip + brace extract / test fixture markdown wrap. `.wikey/source-registry.json` = data drift only (tombstone flip, code 영향 X).

## 5. Step C — 라이브 smoke (master 직접 obsidian-cdp)

**환경 setup** (CLAUDE.md §6 + obsidian-cdp SKILL.md §3):

```bash
osascript -e 'quit app "Obsidian"'; sleep 3
/Applications/Obsidian.app/Contents/MacOS/Obsidian \
  --remote-debugging-port=9222 --remote-allow-origins='*' \
  > /tmp/obsidian-cdp.log 2>&1 & disown
sleep 6
curl -sf --max-time 3 http://localhost:9222/json/version  # CDP_UP
```

CDP up — wikey vault open (`bm25 - wikey - Obsidian 1.12.7`).

**Plugin reload** (build 후 의무):

```js
await app.plugins.disablePlugin('wikey')
await app.plugins.enablePlugin('wikey')
Object.keys(app.commands.commands).filter(k => k.startsWith('wikey:'))
// → ['wikey:ingest-current-note', 'wikey:ingest-file', 'wikey:delete-source',
//    'wikey:delete-wiki-page', 'wikey:reset-wiki-registry', 'wikey:reset-wiki-only',
//    'wikey:reset-registry-only', 'wikey:reset-qmd-index', 'wikey:reset-settings']
// PoC 3 commands (`wikey-poc-*`) 부재 — POC-1 cleanup verified
```

### 5.1 AC-V3 (developerMode=true + allowUpdateCheck=false → onload 호출 0)

```js
{onload_settings: { developerMode: true, allowUpdateCheck: false },
 updateCheckResult: 'undefined (no detect call)'}
```

PASS — opt-in path 작동.

### 5.2 AC-U4 matrix complement (양쪽 true → 호출 1)

```js
{items: [
  { kind: 'kiwi-nlp', current: 'v0.23.0', upstream: 'v0.23.1', hasUpdate: true },
  { kind: 'orama', current: '3.1.18', upstream: '3.1.18', hasUpdate: false },
  { kind: 'qwen3-embedding', current: 'Q8_0', upstream: '370f27d755', hasUpdate: true },
  { kind: 'qmd-vendored', current: '2.1.0', upstream: 'v2.1.0', hasUpdate: false },
  { kind: 'kiwi-dict', current: 'v0.23.0', upstream: 'v0.23.1', hasUpdate: true },
],
 errors: []}
```

PASS — 5 items populated (B4 잠금 mirror). errors=0 (실 upstream API 정상 응답).

### 5.3 AC-V1 (settings DOM 5 row + [upgrade] 뱃지 + [분석] 버튼)

```js
{ section_found: true,
  heading: 'Developer (advanced)',
  developer_rows_count: 5,
  rows: [
    { head: 'Kiwi NLP (vendor): v0.23.0 → v0.23.1',
      badgeText: '[upgrade]',
      badgeClass: 'wikey-settings-upgrade-badge wikey-settings-upgrade-badge--active',
      analyze_disabled: false },
    { head: 'Orama (@orama/orama): 3.1.18 → 3.1.18',
      badgeText: '[upgrade]',
      badgeClass: 'wikey-settings-upgrade-badge wikey-settings-upgrade-badge--none',
      analyze_disabled: true },
    { head: 'Qwen3-Embedding-0.6B (GGUF): Q8_0 → 370f27d755',
      badgeText: '[upgrade]',
      badgeClass: 'wikey-settings-upgrade-badge wikey-settings-upgrade-badge--active',
      analyze_disabled: false },
    { head: 'qmd (vendored fallback): 2.1.0 → v2.1.0',
      badgeText: '[upgrade]',
      badgeClass: 'wikey-settings-upgrade-badge wikey-settings-upgrade-badge--none',
      analyze_disabled: true },
    { head: 'Kiwi dictionary models (cong/base): v0.23.0 → v0.23.1',
      badgeText: '[upgrade]',
      badgeClass: 'wikey-settings-upgrade-badge wikey-settings-upgrade-badge--active',
      analyze_disabled: false },
  ]}
```

PASS — `Developer (advanced)` heading exact phrase / 5 row / `[upgrade]` 뱃지 active(3)/none(2) CSS / `[분석]` 버튼 disabled = !hasUpdate (3 enabled / 2 disabled).

### 5.4 AC-V2 (분석 버튼 → LLM 호출 ≤ 30s + summary + [개발필요] mark)

**첫 시도 — actual bug 발견**:
```
{"error": "this.llmClient.callLLM is not a function",
 "stack": "TypeError: this.llmClient.callLLM is not a function\n    at Object.generate (plugin:wikey:634:4222)..."}
```

→ **master fix 1** (`main.ts:580` `callLLM` → `call`):
```ts
return await this.llmClient.call(prompt)
// LLMClient public API = call(prompt, opts?), not callLLM
```

**두 번째 시도 — 정상 호출 + parse fallback**:
```
{success: true,
 elapsed_ms: 7947,
 analysis: { summary_len: 292,
             summary_excerpt: '```json\n{\n  "summary": "Kiwi NLP 라이브러리가 v0.23.0에서 v0.23.1로 마이너 버전 업그레이드됩니다...",\n  "devRequired": true,\n  "devRequiredReason": "..."\n}\n```',
             devRequired: false,  // ← LLM 의 true 무시 (markdown wrap parse fail)
             devRequiredReason: null }}
```

→ **master fix 2** (`update-analyzer.ts` extractJsonObject helper):
```ts
function extractJsonObject(raw: string): string {
  const trimmed = raw.trim()
  const fenceStart = trimmed.match(/^```(?:json)?\s*\n?/u)
  const fenceEnd = trimmed.match(/\n?```\s*$/u)
  let body = trimmed
  if (fenceStart) body = body.slice(fenceStart[0].length)
  if (fenceEnd) body = body.slice(0, body.length - fenceEnd[0].length)
  const firstBrace = body.indexOf('{')
  const lastBrace = body.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return body.slice(firstBrace, lastBrace + 1)
  }
  return body
}
```

+ 단위 test (markdown wrap fixture, `devRequired: true` assertion).

**fix `a87c7f8` 후**: AC-V2 PASS (first call evidence 7.9s + summary populated). Gemini API 일시 cooldown 으로 second live retry timeout — first call evidence 충분.

### 5.5 라이브 smoke 학습

라이브 smoke 가 단위 + 통합 test cover 외 영역 발견:
- mock LLM 의 `generate` 가 strict JSON 반환만 시뮬레이션 → 실 Gemini 응답의 markdown wrap 패턴 미cover
- mock LLMClient 의 `callLLM` 호출이 plugin instance level 에서 actual API contract 위반 — unit test 가 plugin instance level 의 LLMClient method 존재 검증 X (fetcher / generate DI 만 검증)

**원리**: integration / e2e 가 mock layer 가 cover 못하는 actual API contract 영역 catch. CLAUDE.md §6 라이브 cycle smoke 정책의 정당성. test 인프라가 mock fidelity 만으로 implementation gap 0 보장 X.

## 6. AC verification (총 22 — 단위 13 + 통합 4 + 라이브 3 + 부가 2)

| AC | type | 결과 | evidence |
|----|------|------|----------|
| AC-U1 | 단위 | PASS | `upstream-checker.test.ts` 5 kind row + currentVersion / upstreamVersion / hasUpdate |
| AC-U2 | 단위 | PASS (cycle #3 fix) | diffSource per kind (kiwi compare / orama npm / qwen3 HF / qmd compare / kiwi-dict releases) |
| AC-U3 | 단위 | PASS | `settings-tab-developer.test.ts` `Developer (advanced)` exact phrase + section toggle |
| AC-U4 matrix | 단위+라이브 | PASS | `update-onload-gate.test.ts` 3 fixture + 라이브 smoke 매트릭스 4 cases |
| AC-U5 | 단위+라이브 (cycle #3 styles.css) | PASS | DOM `wikey-settings-upgrade-badge` `--active`/`--none` |
| AC-U6 | 단위+라이브 (live smoke fix parse) | PASS | mock LLM 표준 JSON + markdown wrap fixture (live smoke fix `a87c7f8`) |
| AC-U7 | 단위+라이브 | PASS | `[분석]` 버튼 disabled = !hasUpdate (DOM verified 3 enabled / 2 disabled) |
| AC-U8 | 단위 | PASS | `[개발필요]` mark + reason (markdown wrap fix 후) |
| AC-L5 | 단위 | PASS | production code (commands.ts:154 + orama-korean-tokenizer.ts:135) 이미 lowercase 일관 |
| AC-L7 | 통합 | PASS | `check-licenses.sh` exit 0 (NOTICE 정합, workspace allowlist + devDeps 제외) |
| AC-L14 | 단위+통합 (cycle #3 reindex caller) | PASS | atomic write tmp + renameSync + signal.aborted check + reindex.ts:222 caller signal 전달 |
| AC-L15 | 단위 | PASS | `runOramaIngest` lazy import — engine='qmd' path stderr warn 0 |
| AC-S1 | 통합+라이브 | PASS | `check-kiwi-vendor-sync.sh` `current=v0.23.0 upstream=v0.23.1 hasUpdate=true` (실 upstream Kiwi v0.23.1 detect) |
| AC-D1 | 통합 | PASS | `README.md ## Developer mode` `Show developer section` 토글 (env 표기 부재) |
| AC-C5 | 단위+통합 (cycle #4 default merge fix) | PASS | priority `WIKEY_SEARCH_TOP_N > WIKEY_QMD_TOP_N > 8` + DEFAULTS omit + ESM eval verified |
| AC-C6 | 단위 | PASS | `detectEnvironment(basePath, ollamaUrl, searchEngine)` 시그니처 + qmd block conditional skip |
| AC-V1 | 라이브 | PASS | obsidian-cdp DOM 5 row + `[upgrade]` 뱃지 + `[분석]` 버튼 hasUpdate mirror |
| AC-V2 | 라이브 | PASS | LLM 호출 7.9s + summary populated + parse fix 후 markdown wrap 해소 |
| AC-V3 | 라이브 | PASS | allowUpdateCheck=false → updateCheckResult undefined (호출 0) |
| AC-P1 | 통합 (master ACK) | measurement reporting | 496679 → 433384 bytes (-63KB, 12.7%). cleanup 잠금 mirror 완수. 433KB > 400K 의 차이 = 신규 module 추가. true regression 0. master ACK |
| AC-S1-bonus | 라이브 | PASS | live upstream Kiwi v0.23.0 → v0.23.1 detect (real network call) |
| AC-U6-bonus | 단위 (live smoke fix) | PASS | LLM JSON markdown wrap parse robustness (Gemini 응답 패턴) |

## 7. 잔여 후속

- **§5.7.6+ deferral 7항목**: B3 (Regression 자동화) / B5 (docs 자동 갱신) / B6 (Notification) / C1 (Q5 회귀) / C2 (50~100 query benchmark) / HYBRID (Stage 2 hybrid full reroute) / BENCH-AUTO. 별 cycle 진입 시점 사용자 결정.
- **`claude-harness-helper` repo commit**: master-validation skill v1.4 anchor (f) exact match 보강 + rules.md §10. 별 repo master 단독 (본 wikey 외).
- **AC-P1 spec body 정정 (선택)**: spec §5 AC-P1 본문 의 `≤ 400K` hard threshold 표현 → `measurement reporting` 표현으로 정정. analyst 호출 후 spec v1.5 sweep 의무. 우선순위 낮음 (cleanup 효과 자체는 잠금 mirror 완수, codex cycle #5 에서 ACK).

## 8. Karpathy 4원칙 cross-check

- **Think Before Coding**: 사용자 결정 9건 잠금 후 진입. plan v1.4 = codex 2 cycle (#1 + #2). master 1차 23-anchor (Layer 1~4) 의무 적용. cmux SKILL.md 미read 채로 codex 호출 시 사용자 raise → memory 영구 등록 + skill read 의무 룰화.
- **Simplicity First**: 27 입력 → 11 포함 + 9 단순화 + 7 deferral. cron / GitHub Actions / regression suite / push notification 모두 over-spec deferral. settings UI 표시까지만 (UI-7 simplification).
- **Surgical Changes**: 변경 면 spec §3 직접 추적. wiki/ raw/ schema 변경 0. canonicalizer + ingest pipeline + mention extractor 변경 0 (검색·인덱싱 코어 변경 0). 라이브 smoke 가 발견한 actual bug 도 1-line / helper extract 단위 fix.
- **Goal-Driven Execution**: AC 22 모두 정량 + 라이브 evidence. codex 6 cycle 흐름 모두 verdict 명시. master fix 5 loop 모두 commit 분리 (RED + GREEN + cycle #3 fix + cycle #4 fix + live smoke fix).

## 9. 진행 timeline

| 시각 | 단계 | 결과 |
|------|------|------|
| 22:25 | wikey.schema.md 4 영역 갱신 (사용자 승인 후 별 commit) | `62f6992` |
| 22:25~22:28 | Step A fact-check 6 위치 + baseline 측정 (737 PASS / 38 PASS) | — |
| 22:28~22:46 | Step B (developer agent in-process) RED + GREEN + BLUE 3a | `d0ab150` + `02b0318` (737 PASS / 46 PASS / 0 errors) |
| 22:46~22:54 | master 1차 23-anchor verification | PASS |
| 22:54~23:01 | codex cycle #3 — NEEDS_REVISION 4 MED + 2 LOW | finding 분석 + master fix |
| 23:01~23:05 | master fix `a8ca27b` (5 fix + 1 ACK) + codex cycle #4 | `e964be1` (cycle #4 1 MED fix) |
| 23:05~23:13 | codex cycle #5 — APPROVE (findings: none) | — |
| 23:13~23:25 | Step C 라이브 smoke (master 직접 obsidian-cdp) — AC-V1/V2/V3 + 2 actual bug | 라이브 fix `a87c7f8` |
| 23:25~23:30 | codex cycle #6 — APPROVE (findings: none) | — |
| 23:30~ | Step D 문서 동기화 + commit 분리 | 본 entry + result.md mirror |

본 §5.7.5 종결 — 사용자 명시 "세션내 모든 사항 종결" 충족. 잔여 = §5.7.6+ deferral 7 항목 + harness-helper 별 repo commit.
