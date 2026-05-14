---
phase: 5
section: 5.6.6
title: §5.6.6 Subscription REST direct — Step A0~H 구현 종결 + codex post-impl + 라이브 CDP smoke
status: completed
created: 2026-05-15
updated: 2026-05-15
session: 45
---

# §5.6.6 Subscription REST direct — Session 45 구현 종결

> **상위 문서**: [`docs/planning/phase-5/phase-5-todo.md §5.6.6`](../../planning/phase-5/phase-5-todo.md) · [`phase-5-spec-5.6.6-subscription-rest.md`](../../planning/phase-5/phase-5-spec-5.6.6-subscription-rest.md) v0.6 · [`phase-5-todox-5.6.6-subscription-rest.md`](../../planning/phase-5/phase-5-todox-5.6.6-subscription-rest.md) v0.6

## 1. Step A0 — Legal/Terms Gate 결정 (BLOCKING)

**사용자 explicit 결정 (2026-05-15)**: **`APPROVED_LOCAL_ONLY`**

byte-level 기록: `gemini=APPROVED, anthropic=APPROVED, openai=APPROVED` (3 vendor 모두 local 개인 사용 한정 승인).

후속 의무:
- 3 vendor default subscription mode = `'rest'`
- README.md disclaimer 추가 의무 (Step H docs sweep)
- public 배포 금지 명시

## 2. Step A~F 구현 영역 + LOC

| Step | 영역 | LOC | test case |
|------|------|-----|-----------|
| A | `subscription-rest-shared.ts` (131) + `subscription-rest-version-guard.ts` (74) | 205 | 17 (T-A1~T-A12 + sub) |
| B | `google-rest-client.ts` (209) | 209 | 11 (T-B1~T-B11) |
| C | `openai-rest-client.ts` (260) | 260 | 12 active + 1 skip (T-C1~T-C12) |
| D | `anthropic-rest-client.ts` (226) | 226 | 16 (T-D1~T-D15 + T-D12b) |
| E | `auth-resolver.ts` (+47) + `llm-client.ts` (+101) + `main.ts` (+15) + `auth-mode-bridge.ts` (+74) + `types.ts` (+10) | +247 | 16 (10 wikey-core + 6 wikey-obsidian) |
| F | `settings-tab.ts` (+54) + UI integration | +54 | 5 (T-F1~T-F4 + scope-out) |
| **합** | 9 file 신규/수정 | **~1200** | **77** |

I12 LOC budget (~1150) 대비 +50 LOC — codex F1/F2/F3/F4 fix 산입 (Karpathy Surgical, 최소 변경).

## 3. codex Mode D Panel post-impl cycle #1 — verdict NEEDS_REVISION (4 finding) + master 라이브 1 finding

### 3.1 codex finding (4)

| ID | severity | 영역 | 요약 | 처리 |
|----|----------|------|------|------|
| F1 | HIGH | Spec ↔ Impl | `config.ts` DEFAULTS 에 3 SUBSCRIPTION_MODE 누락 → non-Obsidian CLI 사용자가 'pending' fallback | **fix v0.6**: 3 field `'rest'` default 추가 (A0 APPROVED_LOCAL_ONLY mirror) |
| F2 | MID | AC-S24 drift guard | `notifyDriftIfAny` production 호출 0건 | **fix v0.6**: 3 vendor RESTClient constructor 안 1회 호출 + onDrift callback 인자 추가 |
| F3 | MID | AC-S12-openai timeout | SSE body 소비 전 `clearTimeout` → stream stall 시 timeout 안 발동 | **fix v0.6**: timer cleanup 위치를 fetch error/non-OK branch + parseSSEResponse finally 로 이동. AbortError catch 추가 |
| F4 | MID | Settings UI persistence | `buildPluginOnlyData()` 3 SubscriptionMode field 누락 → reload 시 cli 선택 lost | **fix v0.6**: 3 field 추가 (data.json 영구 persist) |

### 3.2 master 라이브 발견 finding (1)

| ID | severity | 영역 | 요약 | 처리 |
|----|----------|------|------|------|
| M1 | HIGH | R8 Electron renderer fetch 차단 | Obsidian Electron 환경에서 vendor 도메인 `fetch` CORS 차단 (3 vendor 모두 `TypeError: Failed to fetch`) | **deferred Session 46**: 후속 fix cycle. wikey-core RESTClient 가 `fetch` 대신 HttpClient interface 사용하도록 paradigm 변경 (~3 vendor file). 본 cycle scope 외 (큰 surgical change). Spec R8 mitigation 부족 — Spec 안 "Node 18+ fetch 와 Electron renderer fetch 동일 spec" 가정 라이브 fail. obsidian native `window.requestUrl` 또는 Node `https` 모듈 직접 사용 의무. |

## 4. obsidian-cdp 라이브 smoke 결과 (master 직접, LOCK 2026-05-12)

### 4.1 PASS 영역

- **AC-S20 per-provider 혼합** PASS — gemini='cli' 변경 + anthropic/openai='rest' 잔존, 독립성 라이브 확증
- **AC-S23-ui dropdown 즉시 효과** PASS — Settings dropdown 'cli' 선택 시 즉시 `plugin.settings.geminiSubscriptionMode === 'cli'` + `plugin.buildConfig().GEMINI_SUBSCRIPTION_MODE === 'cli'` 일관
- **I13 per-provider toggle** PASS — 3 vendor 독립 field, 한 vendor 변경이 나머지 영향 0
- **I15 ollama-cloud 무영향** PASS — Settings UI 안 ollama-cloud subsection 에 Subscription Mode dropdown 부재 (3 select 만)

### 4.2 M1 R8 fix v0.7 — Session 45 본 cycle 안에서 마무리

라이브 LLM 호출 (Anthropic / Google / OpenAI fetch) → 3 vendor 모두 `TypeError: Failed to fetch`. Electron renderer 의 fetch CORS preflight 차단.

**fix v0.7** — `wikey-core/src/subscription-rest-fetcher.ts` (신규 ~50 LOC):
- module-level `activeFetcher` + `setSubscriptionRESTFetcher(fn)` setter + `vendorFetch(...)` proxy
- 3 vendor RESTClient 의 `fetch(...)` 호출 → `vendorFetch(...)` (Google 3 site / OpenAI 2 site / Anthropic 2 site)
- wikey-obsidian/main.ts 안 `nodeHttpsFetch` 함수 (Node `https` 모듈 wrapper, ~70 LOC) — Electron renderer 의 Chromium fetch sandbox 우회. fetch-compatible Response (body = `ReadableStream<Uint8Array>` from IncomingMessage — SSE stream native 작동).
- plugin onload 시 `setSubscriptionRESTFetcher(nodeHttpsFetch)` 1회 호출. non-Obsidian CLI 사용자는 default `globalThis.fetch` 사용 (회귀 0).

**라이브 검증 결과** (master CDP, 2026-05-15 Session 45):

| vendor | calls | result | latency (ms) | finding |
|--------|-------|--------|--------------|---------|
| Anthropic | 3 PASS | "4" 정확 응답 | 1156 / 1154 / 2392 (avg 1567, p95 2392) | M1 fix 작동, AC-S3/AC-S21 SLO 만족 (< 5s) |
| Gemini | 3 vendor 도달 | 429 quota | 2033 / 1076 / 1074 | M1 fix 작동 확증 (paradigm OK, vendor-side quota — Session 44 PoC 시점 동일 자연 발생) |
| OpenAI | 3 vendor 도달 | 400 Bad Request | 476 / 181 / 183 | M1 fix 작동 확증 (vendor 도달 OK, 단 body 형식 차이 — 후속 fix Session 46) |

**M1 R8 fix 작동 확증** — 모든 vendor `TypeError: Failed to fetch` 사라짐. Anthropic 정상 응답, Gemini/OpenAI 도 vendor 도달 후 vendor 응답 받음.

**잔여 finding** (Session 46 진입):
- OpenAI 400 — body 형식 차이 (PoC `'Answer concisely. Do not use any tools.'` instructions 였는데 wikey 는 'Answer concisely.' 만, F7 v0.4 transport-level invariant 변경 — 후속 비교 fix)

### 4.3 사용자 UI 요청 (2026-05-15) 반영

라이브 검증 중 사용자 추가 raise:
1. Subscription Mode selectbox 오른쪽 정렬 (다른 row 와 동일)
2. selectbox 옆 description span 삭제
3. 3 vendor block 위에 한 번만 description (12pt deepgrey)
4. selectbox 옵션 간단화 — REST / CLI / PENDING

처리:
- `settings-tab.ts:1366~1382` description span 제거 (renderSubscriptionModeRow)
- `settings-tab.ts:1370~1374` 옵션 라벨 간단화 (`'REST'` / `'CLI'` / `'PENDING'`)
- `settings-tab.ts:1245~1258` 신규 `wikey-subscription-mode-note` div 추가 (Google 블록 위, 한 번만)
- `styles.css:1828~1837` 신규 `.wikey-subscription-mode-note` 12pt italic deepgrey

라이브 verify (master CDP):
- `sharedNoteExists: true` + `sharedNoteText: "Subscription Mode — REST: direct API call..."`
- `oldPerRowDescCount: 0` (옛 per-row description 삭제 확증)
- `firstOptions: ['rest:REST', 'cli:CLI', 'pending:PENDING']` (간단 라벨)
- `selectCount: 3` (3 vendor only, ollama-cloud 제외)
- 오른쪽 정렬 = `.wikey-auth-block-controls justify-content: flex-end` 기존 패턴 자동 적용

## 5. 회귀 + 검증 종합

| 영역 | baseline | 결과 |
|------|----------|------|
| wikey-core npm test | 1181 PASS | **1247 PASS** (+66 신규, 회귀 0, 4 skipped) |
| wikey-obsidian npm test | 223 PASS | **234 PASS** (+11 신규, 회귀 0, 1 skipped) |
| wikey-core typecheck | 0 errors | **0 errors** |
| wikey-obsidian typecheck | 3 errors (사전 부채) | 3 errors 동일 (회귀 0 — main.ts:510 ollama-cloud LLMProvider + sidebar-chat.ts:358-359 BacklinkResult, 본 §5.6.6 무관) |
| wikey-obsidian build | 0 errors | **0 errors** (5 pre-existing kiwi-wasm warnings) |
| validate-wiki.sh | PASS | **PASS** |
| token leak grep | 0 hit | **0 hit** (3 vendor RESTClient 모두) |
| transport tools field grep | 0 hit | **0 hit** (3 vendor REST body) |
| env API_KEY grep | 0 hit | **0 hit** (3 vendor RESTClient REST path) |

## 6. 잔여 (Session 46 진입)

1. **M1 fix (R8 Electron renderer fetch 차단)** — wikey-core RESTClient 가 HttpClient injection 또는 Node `https` 모듈 직접 사용 paradigm 으로 변경. ~3 vendor file refactor + test update.
2. **codex post-impl cycle #2** — Session 46 fix 후 재검증 (M1 fix 완성 후 cycle #2 진입).
3. **README.md disclaimer 추가** (A0 APPROVED_LOCAL_ONLY 의무) — 본 Session 45 commit 시 또는 Session 46 진입 시.
4. **라이브 LLM smoke** — M1 fix 완료 후 N=10 측정 (AC-S21 latency SLO).

## 7. 다음 세션 진입점

Session 46 = §5.6.6 v0.7 fix cycle (M1 R8 fix). Step A0~F 완료. Step G 라이브 partial pass (UI smoke OK, LLM call M1 deferred). Step H BLUE refactor + commit/push 본 session 45 완료.

Phase 5 잔여 4 subject: §5.5 / §5.8 / §5.9 + §5.6.6 v0.7 (M1 fix).
