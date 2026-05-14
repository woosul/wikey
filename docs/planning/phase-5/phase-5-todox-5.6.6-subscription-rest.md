---
phase: 5
section: 5.6.6
title: Subscription REST direct — 3 vendor unified paradigm (CLI agentic bypass) (Todox)
status: planning
created: 2026-05-14
updated: 2026-05-14
version: v0.5
---

# Phase 5 §5.6.6 Subscription REST direct — Todox (HOW)

> **상위 문서**: [`docs/planning/phase-5/phase-5-todo.md §5.6.6`](./phase-5-todo.md) · [`docs/planning/phase-5/phase-5-spec-5.6.6-subscription-rest.md`](./phase-5-spec-5.6.6-subscription-rest.md)
>
> **이력**:
> - v0.1 (2026-05-14, master 직접 작성) — Spec v0.1 의 AC-S1~S20 1:1 매핑. Step A~G 분할.
> - **v0.2 (2026-05-14, codex Mode D Panel cycle #1 NEEDS_REVISION 9 finding fix)** — 변경 9 영역:
>   - **F1 fix**: Step A0 (Legal/Terms Gate) 신설 — BLOCKING
>   - **F2 fix**: Step C 안 OpenAI 용어 정정 (`OpenAI private Codex backend`) + kill-switch acceptance + R9 mirror
>   - **F3 fix**: Step E 안 `WikeyConfig` 3 field (`GEMINI_SUBSCRIPTION_MODE` etc.) + buildConfig + auth-mode-bridge 추가
>   - **F4 fix**: Step A 안 REST option matrix shared helper (`mapOptionsToRESTOptions`) + Step B/C/D 적용
>   - **F5 fix**: §0 안 AC ↔ T 매핑표 (Spec §1.5.0 mirror) + 누락 test 보강 (T-A8/A9, T-B7, T-C7, T-D8/D9, T-E6, T-A10/A11)
>   - **F6 fix**: Step A 안 `subscription-rest-version-guard.ts` 명시 + spike `/tmp/poc-*.mjs` → `docs/spikes/phase-5/5.6.6/` 보존 + Step G drift smoke
>   - **F7 fix**: Step B/C/D 안 transport-level (request body grep) tool 0 검증 + 자연어 grep 폐기. Step G 안 latency SLO N=10 measurement
>   - **F8 fix**: Step B/C/D refresh test rotation 보존 (T-B7/T-C7/T-D8) + atomic write
>   - **F9 fix**: Step H mirror 일관성 — 본 todox 안 Step H 명시 + phase-5-todo entry 일치
> - **v0.3 (2026-05-14, codex Mode D Panel cycle #2 NEEDS_REVISION 8 finding fix)** — 변경 8 영역:
>   - **F1-A fix**: Goal/Inputs default `'pending'` (A0 통과 전), `defaultModeForApprovalState` 단일 함수 (Spec §1.3.2 mirror)
>   - **F1-B fix**: Step G 절차 A0 state-aware 분기 — 거부 vendor REST smoke skip, cli regression 만
>   - **F2/F5 fix**: Step E test T-E7 → T-E7a/b/c (3 vendor 별 env disable 분리)
>   - **F3 fix**: Step E 5.3 Implementation 중복 block 제거 — UPPERCASE `WikeyConfig` + `resolveSubscriptionMode` 단일 source. settings camelCase → UPPERCASE 변환은 buildConfig 경계만
>   - **F4 fix**: shared `RESTCallOptions` 에 mapped options pass-through + Step E T-E11 (E→B/C/D options 전달 spy)
>   - **F5 fix**: AC↔T 매핑표 약칭 풀고 vendor 별 누락 test 추가 — T-B9 (Google timeout), T-C11 (OpenAI timeout), T-D13 (Anthropic timeout), T-B10 (Google 401-twice), T-D14 (Anthropic 401-twice), T-B11/T-C12/T-D15 (vendor stderr/console)
>   - **F6 fix**: PoC reference 모두 `docs/spikes/phase-5/5.6.6/poc-{vendor}.mjs` canonical path. `/tmp` 는 history 만
>   - **F7 fix**: AC-S13 본문 transport-level 정정 (자연어 grep 폐기) — Spec §1.5 AC-S13 mirror
>   - **Regression LOW fix**: I12 LOC budget 현실화 (~900 + ~250 test = ~1150)
> - **v0.4 (2026-05-14, codex Mode D Panel cycle #3 NEEDS_REVISION 7 finding fix)** — 변경 7 영역:
>   - **F1/F3 fix**: WikeyConfig type union `'cli' | 'rest' | 'pending'` + SubscriptionFallbackError reason `'mode-pending'` 추가 (Spec §1.3 mirror)
>   - **F5 fix**: 매핑표 본문 "총 24 AC" → "총 25 AC" + Step F T-F4 정의 추가 + §0.5 "T-A1 ~ T-G3" → "T-A1 ~ T-F4 + Step G manual smoke"
>   - **F9 fix**: phase-5-todo §5.6.6 case count 갱신 (B=11 / C=12 / D=15 / E=11 / F=4)
>   - **F6 fix**: 옛 이름 sweep + phase-5-todo line 943 `/tmp/` → canonical
>   - **F7 fix**: Step C OpenAI implementation snippet 의 `instructions: '... Do not use any tools.'` 텍스트 폐기 (raw substring "tools" false hit). AC-S13 schema field/event 검증만 명시
>   - **F8 fix**: I17 atomic write `tmp + rename only` (single fs.writeFile은 atomic 아님)
>   - **신규 branch fix**: docs sweep "README.md 변경 0 (단 `APPROVED_LOCAL_ONLY` 시 disclaimer 추가)". Step G "30 measurement" → "approved vendor × N=10 (state-aware)"

## 0. 작업 분할 개요 (Step A0 ~ H, codex F1+F9 fix v0.2 → AC count v0.4)

> **AC ↔ T 매핑** (codex F5 fix v0.4): Spec §1.5.0 매핑표 단일 source. 본 todox 의 모든 test (T-A1 ~ T-F4) 는 Spec AC-S1 ~ S25 에 1:1 매핑. **Step G 는 manual smoke + measurement** (단위 test ID 부재 — `T-G*` 정의 없음, AC-S18/S21 의 acceptance 절차로 §7.2 참조).

| Step | 영역 | LOC | 의존 | 평가 |
|------|------|-----|------|------|
| **A0** | **Legal/Terms Gate** (BLOCKING, 사용자 명시 결정) | — | — | 사용자 결정 1 회 |
| **A** | shared abstraction (`subscription-rest-shared.ts` + `subscription-rest-version-guard.ts` + `mapOptionsToRESTOptions`) + spike 보존 | ~180 | A0 | 단순 |
| **B** | Google REST client (`google-rest-client.ts`) | ~150 | A | spike 직접 reproduce |
| **C** | OpenAI REST client (`openai-rest-client.ts` + SSE helper) | ~200 | A | SSE parsing + private backend 용어 |
| **D** | Anthropic REST client (`anthropic-rest-client.ts`) | ~150 | A | Keychain access + macOS detect |
| **E** | `llm-client.ts` integration (`subscriptionMode` 분기) + WikeyConfig 3 field + buildConfig + auth-mode-bridge | ~150 | B/C/D | 기존 callXxxSubscription 분기 + core config |
| **F** | Settings UI (per-provider toggle + label + kill-switch UX) | ~80 | E | settings-tab 3 row |
| **G** | 회귀 검증 + master CDP smoke 3 vendor + latency SLO N=10 + endpoint hash drift smoke | — | A~F | 라이브 |
| **H** | BLUE 3b refactor + commit/push (6 활동) | — | G | 정리 |

총 ~910 LOC + ~250 test LOC = ~1160 LOC. 1-2 세션 견적.

## 0.5. AC ↔ Test mapping (Spec §1.5.0 mirror, codex F5 fix v0.2)

본 todox 의 모든 test (T-A1 ~ T-F4) 는 Spec AC-S1 ~ S25 에 1:1 매핑 (codex F5 fix v0.4). Step G 는 manual smoke + N=10 measurement (단위 test ID 부재 — AC-S18/S21 의 §7.2 절차 직접 acceptance). Spec §1.5.0 매핑표 단일 source — 본 todox 의 각 Step Test Spec section 이 본 매핑표를 reference.

## 0.6. Step A0 — Legal/Terms Gate (BLOCKING, codex F1 fix v0.2)

> **본 Gate 통과 (사용자 explicit 승인) 전 Step A~H 진행 0건.**

### 0.6.1 검토 대상 (Spec §0.5.1 mirror)

3 vendor terms 검토 (Google APIs Terms / OpenAI Terms of Use / Anthropic Usage Policies). 핵심 조항: reverse engineering / programmatic extraction / private backend access.

### 0.6.2 결과 4-state 결정 (Spec §0.5.2 mirror)

`APPROVED_EXPERIMENTAL` / `APPROVED_LOCAL_ONLY` / `APPROVED_PARTIAL` / `REJECTED` 중 사용자 explicit 결정. 결과 mirror 위치:
- 본 spec `이력` v0.X 추가
- `phase-5-todo.md §5.6.6` Step A0 결정 라인
- (`APPROVED_LOCAL_ONLY` 시) `README.md` disclaimer

### 0.6.3 Acceptance

- 사용자 결정 byte-level 기록 — 4 state 중 1
- 결정 기록 후만 Step A 시작
- `REJECTED` 시 본 plan 폐기 + 별 cycle (option B prompt 차단)

## 1. Step A — shared abstraction (codex F4 + F6 보강 v0.2)

### 1.1 Spec Reference

- Spec §1.1 Goal — `SubscriptionRESTClient` interface 통합 abstraction
- Spec §1.2 I1 (transport-level tool 0), I4 (OAuth refresh 표준), I5 (401 retry), I6 (429 fail), I10 (token 노출 0), I11 (PoC reproduce), I12 (Simplicity), I17 (rotation 보존)
- Spec §1.3.1 REST option matrix — shared helper `mapOptionsToRESTOptions` (codex F4)
- Spec §1.7 Dependencies — Node 18+ fetch, crypto, spike 보존 path
- Spec §2 R1 mitigation — `subscription-rest-version-guard.ts` (codex F6)

### 1.2 Test Spec (RED)

- `wikey-core/src/__tests__/subscription-rest-shared.test.ts`
- AC-S5 → T-A1: `refreshIfNeeded` 만료 임박 (60s 미만) → refresh 호출
- AC-S5 → T-A2: 만료 충분 (60s 초과) → no-op
- AC-S6 → T-A3: 401 detect helper → `{shouldRetry: true, reason: 'token-expired'}` (1회만)
- AC-S9 → T-A4: 429 detect → `SubscriptionFallbackError('quota-exceeded')` throw
- AC-S11 → T-A5: 5xx detect → `SubscriptionFallbackError('server-error')` throw
- I10 → T-A6: token 값 stderr / 반환 0건 (mock console.error → 호출 0)
- R6 → T-A7: 동시 refresh race — Promise share (단일 fetch 호출)
- AC-S8 → T-A8 (codex F5 누락 보강): refresh 자체 401 → `SubscriptionFallbackError('auth-missing')` re-login Notice
- AC-S12 → T-A9 (codex F5 누락 보강): timeout AbortController — internalAc abort + external signal abort 두 path
- AC-S24 → T-A10 (codex F6 신설): version-guard.ts — vendor CLI bundle endpoint hash baseline 비교 → mismatch 시 Notice (throw X)
- R6 → T-A11 (codex F8 보강): refresh atomic write — race + write 실패 시 retry + rollback. file (tmp + rename) + Keychain (single `add-generic-password -U`)
- F4 → T-A12: `mapOptionsToRESTOptions` REST option matrix — 6 option × 3 vendor = 18 case (jsonMode unsupported → throw / temperature/maxTokens/seed mapping / responseMimeType ignore for OpenAI/Anthropic)

### 1.3 spike 보존 (codex F6 fix v0.2)

Step A0 통과 후 즉시:
```bash
mkdir -p docs/spikes/phase-5/5.6.6
mv /tmp/poc-cloudcode.mjs docs/spikes/phase-5/5.6.6/poc-google.mjs
mv /tmp/poc-codex.mjs     docs/spikes/phase-5/5.6.6/poc-openai.mjs
mv /tmp/poc-anthropic.mjs docs/spikes/phase-5/5.6.6/poc-anthropic.mjs
```
+ `docs/spikes/phase-5/5.6.6/SPIKE.md` (수동 작성):
- 3 vendor 의 endpoint URL string + sha256 baseline hash
- vendor CLI bundle 위치 + 추출 line number (Spec §1.7)
- PoC 측정 latency 표 (재현성 reference)
- version-guard.ts 가 본 SPIKE.md 의 baseline 과 비교

### 1.3 Implementation (GREEN)

`wikey-core/src/subscription-rest-shared.ts`:

```typescript
export interface SubscriptionRESTClient {
  loadToken(): Promise<TokenState>
  refreshIfNeeded(state: TokenState): Promise<TokenState>
  call(prompt: string, model: string, opts: RESTCallOptions): Promise<RESTCallResult>
}

export interface TokenState {
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresAtMs: number
  readonly raw: unknown // vendor-specific full JSON for write-back
}

export interface RESTCallOptions {
  readonly timeout?: number // default 600_000 (§5.6.4 mirror)
  readonly signal?: AbortSignal
  // F4 fix v0.3 — REST option matrix (Spec §1.3.1) pass-through
  readonly temperature?: number
  readonly seed?: number
  readonly maxTokens?: number
  readonly responseMimeType?: 'application/json' | 'text/plain'
  readonly jsonMode?: boolean
  readonly thinkingBudget?: number
}

// vendor 별 mapping helper (Spec §1.3.1 매트릭스 단일 source)
export function mapOptionsToRESTOptions(
  vendor: 'gemini' | 'openai' | 'anthropic',
  opts: RESTCallOptions,
): VendorMappedOptions {
  // jsonMode unsupported on Anthropic → throw SubscriptionFallbackError('jsonMode-unsupported')
  // 나머지 unsupported → silent ignore + debug log
  // (구현 — Spec §1.3.1 matrix 그대로)
}

export interface RESTCallResult {
  readonly text: string
  readonly model: string
  readonly latencyMs: number
  readonly usage?: Record<string, unknown>
}

const REFRESH_THRESHOLD_MS = 60_000

// 동시 호출 share — vendor 별 1 promise (R6 mitigation)
const refreshPromiseCache = new Map<string, Promise<TokenState>>()

export async function refreshIfNeededShared(
  vendor: string,
  state: TokenState,
  refreshFn: (state: TokenState) => Promise<TokenState>,
): Promise<TokenState> {
  const now = Date.now()
  if (state.expiresAtMs - now > REFRESH_THRESHOLD_MS) return state
  let promise = refreshPromiseCache.get(vendor)
  if (!promise) {
    promise = refreshFn(state).finally(() => refreshPromiseCache.delete(vendor))
    refreshPromiseCache.set(vendor, promise)
  }
  return promise
}

export function classifyHTTPFailure(status: number): SubscriptionFallbackError | null {
  if (status === 401) return null // caller handles refresh + retry
  if (status === 429) return new SubscriptionFallbackError('quota-exceeded', `vendor returned 429`)
  if (status >= 500 && status < 600) return new SubscriptionFallbackError('server-error', `vendor returned ${status}`)
  return null
}

// Re-export §5.6.4 SubscriptionFallbackError (no new error class)
export { SubscriptionFallbackError } from './llm-client.js'
```

### 1.4 Acceptance (BLUE 3a)

- T-A1~T-A12 모두 fresh `npm test` PASS (codex F5 v0.5 — 12 case mirror)
- typecheck / lint / build 모두 PASS
- `subscription-rest-shared.ts` LOC ≤ 150 (Karpathy I12)
- token 값 grep audit — `accessToken|refreshToken` console.* 0건

---

## 2. Step B — Google REST client

### 2.1 Spec Reference

- Spec §1.1 Goal — Google subscription REST direct
- Spec §1.2 I1, I3, I8 — tool 0, latency p95 < 5초, token storage 보존
- Spec §1.5 AC-S1, AC-S4, AC-S5, AC-S9, AC-S13, AC-S14
- PoC reference (canonical): `docs/spikes/phase-5/5.6.6/poc-google.mjs` (Step A0 통과 후 mv 완료, codex F6 fix v0.3)

### 2.2 Test Spec (RED)

- `wikey-core/src/__tests__/google-rest-client.test.ts`
- AC-S1 → T-B1: `call("hello", "gemini-2.5-flash")` mock fetch → 응답 markdown text
- AC-S4 → T-B2: project resolve cache — 두 번째 call 시 `loadCodeAssist` 호출 0
- AC-S5 → T-B3: token 만료 임박 시 `oauth2.googleapis.com/token` POST 호출 + file write-back
- AC-S9 → T-B4: 429 mock → `SubscriptionFallbackError('quota-exceeded')`
- AC-S13 → T-B5 (codex F7 정정 v0.2): **transport-level** — wikey 가 vendor 에 send 한 request body 안 `tools` / `tool_config` / `function_declarations` field 0건. 자연어 grep X.
- AC-S14 → T-B6: `process.env.GEMINI_API_KEY` 접근 0 (Object.defineProperty spy)
- AC-S22 → T-B7 (codex F8 신설 v0.2): refresh response 가 새 `refresh_token` 회전 시 file write-back + 두 번째 refresh 시 새 token 사용. unknown field round-trip 보존.
- AC-S15 → T-B8 (codex F5 누락 보강 v0.2): response `usageMetadata` 필드 존재 + `promptTokenCount` / `candidatesTokenCount` readable.
- AC-S12 → T-B9 (codex F5 fix v0.3 — vendor 별 timeout 누락): mock fetch 가 600s+ delay 시뮬레이션 → AbortController abort + `SubscriptionFallbackError('timeout')` throw. opts.signal 외부 abort + opts.timeout 내부 abort 두 path 검증.
- AC-S6 → T-B10 (codex F5 fix v0.3 — Google 401-twice 누락): 첫 401 → refresh + retry → 두 번째 401 → `SubscriptionFallbackError('auth-missing')` throw + Notice "re-login required". 무한 retry 0건.
- AC-S19 → T-B11 (codex F5 fix v0.3 — vendor stderr/console 분리): mock console.log/console.error spy → accessToken / refreshToken 본문 stdout / stderr 0건. metadata (length, expiry, accountId) 만 허용.

### 2.3 Implementation (GREEN)

`wikey-core/src/google-rest-client.ts` — PoC 1:1:

```typescript
// PUBLIC values extracted from gemini-cli bundle (see SPIKE.md). 마스킹 — GitHub secret scanning 회피. 실 값은 vendor CLI bundle direct 추출:
// `~/.nvm/versions/node/v22.17.0/lib/node_modules/@google/gemini-cli/bundle/chunk-UN6XCVMJ.js` line 245247-248
const OAUTH_CLIENT_ID = '681255809395-***.apps.googleusercontent.com'
const OAUTH_CLIENT_SECRET = 'GOCSPX-***'
const CODE_ASSIST_ENDPOINT = 'https://cloudcode-pa.googleapis.com'
const API_VERSION = 'v1internal'
const TOKEN_REFRESH_URL = 'https://oauth2.googleapis.com/token'
const CREDS_PATH = join(homedir(), '.gemini', 'oauth_creds.json')

const projectIdCache = new Map<string, string>() // accessToken hash → projectId

export class GoogleRESTClient implements SubscriptionRESTClient {
  async loadToken(): Promise<TokenState> { /* fs read + parse */ }
  async refreshIfNeeded(state): Promise<TokenState> {
    return refreshIfNeededShared('google', state, async (s) => {
      // POST oauth2.googleapis.com/token with refresh_token grant
      // write-back to ~/.gemini/oauth_creds.json
    })
  }
  async call(prompt, model, opts): Promise<RESTCallResult> {
    const state = await this.refreshIfNeeded(await this.loadToken())
    const projectId = await this.resolveProjectId(state.accessToken)
    return this.generateContent(prompt, model, projectId, state.accessToken, opts)
  }
  private async resolveProjectId(accessToken: string): Promise<string> { /* loadCodeAssist + cache */ }
  private async generateContent(prompt, model, projectId, accessToken, opts): Promise<RESTCallResult> {
    // POST cloudcode-pa.googleapis.com/v1internal:generateContent
    // body: {model, project, user_prompt_id: randomUUID(), request: {contents: [...], generationConfig: {...}}}
    // 401 → refresh + retry 1회 / 429/5xx → throw
  }
}
```

### 2.4 Acceptance (BLUE 3a)

- T-B1~T-B11 PASS (codex F5 v0.5 — 11 case mirror)
- AC-S1 (mock + 가능 시 라이브) latency < 5초 측정
- file write-back 시 schema 보존 (unknown field round-trip)

---

## 3. Step C — OpenAI **private Codex backend** REST client (codex F2 용어 정정 v0.2)

### 3.1 Spec Reference

- Spec §1.1 Goal — OpenAI subscription REST direct (private backend, SSE 강제)
- Spec §1.5 AC-S2, AC-S6, AC-S10b, AC-S22, AC-S23
- Spec §2 R9 (private Codex backend coupling, HIGH)
- PoC reference: `docs/spikes/phase-5/5.6.6/poc-openai.mjs` (Step A0 통과 후 mv)
- **용어 LOCK** (codex F2 fix v0.2): `OpenAI private Codex backend` (`chatgpt.com/backend-api/codex/responses`) — 공식 `api.openai.com/v1/responses` Responses API 와 다름. 본 client 는 ChatGPT subscription quota 사용 전용.

### 3.2 Test Spec (RED)

- `wikey-core/src/__tests__/openai-rest-client.test.ts`
- AC-S2 → T-C1: SSE mock stream (`response.output_text.delta` events) → text collect
- AC-S2 → T-C2: SSE `response.completed` event → usage / model 추출
- AC-S6 → T-C3: 401 → force refresh + retry 1회 → 두 번째 401 시 throw
- AC-S6 → T-C4: refresh 시 `~/.codex/auth.json` write-back (`tokens.access_token` 갱신)
- AC-S10b → T-C5: 429 → `SubscriptionFallbackError('quota-exceeded')`
- T-C6: account_id 누락 시 graceful header 생략 + 호출 시도 (R4)
- AC-S13 → T-C6b (codex F7 정정 v0.2): **transport-level** — request body 안 `tools` field 0건 + SSE response stream 안 `tool_use` / `function_call` event 0건.
- AC-S22 → T-C7 (codex F8 신설 v0.2): refresh response 가 새 `refresh_token` 또는 `id_token` 회전 시 file write-back. atomic write (tmp + rename). 두 번째 refresh 시 새 token 사용.
- AC-S14 → T-C8: `process.env.OPENAI_API_KEY` 접근 0 (Object.defineProperty spy)
- AC-S15 → T-C9 (codex F5 누락 보강 v0.2): response `usage` 필드 존재 + `input_tokens` / `output_tokens` readable.
- AC-S23 → T-C10 (codex F2 신설 v0.2): kill-switch — env `WIKEY_OPENAI_REST_DISABLE=1` 또는 `OPENAI_SUBSCRIPTION_MODE='cli'` 시 본 client constructor / call 진입 0건. `llm-client.ts` 분기 spy 검증.
- AC-S12 → T-C11 (codex F5 fix v0.3 — vendor 별 timeout 누락): SSE stream timeout 시 AbortController abort + `SubscriptionFallbackError('timeout')` throw. SSE 의 chunked response 중 timeout 도 정확 처리.
- AC-S19 → T-C12 (codex F5 fix v0.3): mock console spy — token 본문 0건.

### 3.3 Implementation (GREEN)

`wikey-core/src/openai-rest-client.ts` — PoC 1:1 + SSE helper:

```typescript
// PUBLIC value from codex CLI Mach-O strings extract (see SPIKE.md). 마스킹 — 실 값은 bundle 직접:
const OAUTH_CLIENT_ID = 'app_EMoam***'
const TOKEN_REFRESH_URL = 'https://auth.openai.com/oauth/token'
const CHATGPT_BASE = 'https://chatgpt.com/backend-api'
const RESPONSES_PATH = '/codex/responses'
const AUTH_PATH = join(homedir(), '.codex', 'auth.json')

export class OpenAIRESTClient implements SubscriptionRESTClient {
  async loadToken(): Promise<TokenState> { /* fs read + tokens.{access,refresh} extract */ }
  async refreshIfNeeded(state): Promise<TokenState> { /* form-encoded refresh + file write-back */ }
  async call(prompt, model, opts): Promise<RESTCallResult> {
    const state = await this.refreshIfNeeded(await this.loadToken())
    const body = {
      model, instructions: 'Answer concisely.', // F7 v0.4: tool-blocking은 schema에서 (body에 'tools' field 자체 부재). instructions 본문에 raw 단어 'tools' 회피 — request body grep false hit 방지.
      input: [{type: 'message', role: 'user', content: [{type: 'input_text', text: prompt}]}],
      store: false, stream: true,
    }
    const res = await fetch(`${CHATGPT_BASE}${RESPONSES_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.accessToken}`,
        'chatgpt-account-id': state.accountId,  // optional
        'OpenAI-Beta': 'responses=experimental',
        'Originator': 'codex_cli_rs',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    })
    if (res.status === 401) { /* refresh + retry */ }
    const fail = classifyHTTPFailure(res.status)
    if (fail) throw fail
    return await parseSSEResponse(res.body)
  }
}

async function parseSSEResponse(stream: ReadableStream): Promise<RESTCallResult> {
  // PoC §3.2 의 SSE parse 로직 1:1
  // - decode chunk → buffer split by '\n\n'
  // - data: prefix line collect → JSON parse
  // - response.output_text.delta → collectedText += delta
  // - response.completed → usage / model
}
```

### 3.4 Acceptance (BLUE 3a)

- T-C1~T-C12 PASS (codex F5 v0.5 — 12 case mirror, T-C6/T-C6b 분리)
- SSE parse — `response.output_text.delta` 멀티 chunk 합치기 정상
- AC-S2 ttfb < 2초 / total < 5초 측정 (라이브 가능 시)

---

## 4. Step D — Anthropic REST client

### 4.1 Spec Reference

- Spec §1.1 Goal — Anthropic subscription REST direct
- Spec §1.5 AC-S3, AC-S7, AC-S8
- Spec §2 R3 — Keychain unlock prompt
- PoC reference (canonical): `docs/spikes/phase-5/5.6.6/poc-anthropic.mjs` (Step A0 통과 후 mv 완료, codex F6 fix v0.3)

### 4.2 Test Spec (RED)

- `wikey-core/src/__tests__/anthropic-rest-client.test.ts`
- AC-S3 → T-D1: mock fetch + mock `child_process.execSync` (Keychain) → call 응답 text
- AC-S7 → T-D2: token 만료 → refresh + Keychain `add-generic-password -U` 호출 (mock execSync spy)
- AC-S8 → T-D3: refresh 401 → `SubscriptionFallbackError('auth-missing')` throw
- T-D4: Keychain entry 부재 (`security` exit code != 0) → throw with helpful message
- T-D5: anthropic-beta header `oauth-2025-04-20` 정확 전송 (mock fetch headers 검증)
- AC-S13 → T-D6 (codex F7 정정 v0.2): **transport-level** — request body 안 `tools` field 0건. response 안 `tool_use` content type 0건.
- I10 → T-D7: stderr / stdout 에 accessToken / refreshToken 본문 0건
- AC-S22 → T-D8 (codex F8 신설 v0.2): refresh response 의 `refresh_token` rotation + 알 수 없는 추가 field round-trip. Keychain JSON 안 `claudeAiOauth.refreshToken` 갱신 + `subscriptionType` / `rateLimitTier` 보존.
- AC-S10 → T-D9 (codex F5 누락 보강 v0.2): 429 → `SubscriptionFallbackError('quota-exceeded')` throw. Notice 패턴 검증.
- AC-S14 → T-D10: `process.env.ANTHROPIC_API_KEY` 접근 0 (Object.defineProperty spy)
- AC-S15 → T-D11 (codex F5 누락 보강 v0.2): response `usage` 필드 존재 + `service_tier` readable.
- R10 → T-D12 (codex F2/F6 mirror): `process.platform === 'darwin'` 외 → `SubscriptionFallbackError('spawn-failed', 'macOS Keychain required')` throw + Settings 자동 cli fallback (Step F).
- AC-S12 → T-D13 (codex F5 fix v0.3 — vendor 별 timeout 누락): mock fetch 600s+ delay → AbortController abort + `SubscriptionFallbackError('timeout')` throw.
- AC-S6 → T-D14 (codex F5 fix v0.3 — Anthropic 401-twice 누락): 첫 401 → refresh + retry → 두 번째 401 → `SubscriptionFallbackError('auth-missing')` throw + Notice. Keychain 의 refresh write-back atomic.
- AC-S19 → T-D15 (codex F5 fix v0.3): mock console spy — `accessToken` / `refreshToken` 본문 stdout / stderr 0건.

### 4.3 Implementation (GREEN)

`wikey-core/src/anthropic-rest-client.ts` — PoC 1:1:

```typescript
const KEYCHAIN_SERVICE = 'Claude Code-credentials'
// PUBLIC value from claude-code cli.js (see SPIKE.md). 마스킹 — 실 값은 bundle 직접:
const OAUTH_CLIENT_ID = '9d1c250a-***'
const TOKEN_REFRESH_URL = 'https://console.anthropic.com/v1/oauth/token'
const API_BASE = 'https://api.anthropic.com'
const ANTHROPIC_BETA = 'oauth-2025-04-20'
const ANTHROPIC_VERSION = '2023-06-01'

export class AnthropicRESTClient implements SubscriptionRESTClient {
  async loadToken(): Promise<TokenState> {
    // execSync('security find-generic-password -a $USER -w -s "Claude Code-credentials"')
    // JSON.parse → claudeAiOauth.{accessToken, refreshToken, expiresAt}
  }
  async refreshIfNeeded(state): Promise<TokenState> {
    return refreshIfNeededShared('anthropic', state, async (s) => {
      // POST console.anthropic.com/v1/oauth/token form-encoded
      // execSync('security add-generic-password -U -a $USER -s "..." -w "<json>"')
    })
  }
  async call(prompt, model, opts): Promise<RESTCallResult> {
    const state = await this.refreshIfNeeded(await this.loadToken())
    const res = await fetch(`${API_BASE}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.accessToken}`,
        'anthropic-beta': ANTHROPIC_BETA,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model, max_tokens: 1024,
        system: "You are Claude Code, Anthropic's official CLI for Claude.",
        messages: [{role: 'user', content: prompt}],
      }),
      signal: opts.signal,
    })
    // 401 → force refresh + retry / 429/5xx → throw
    // response: data.content[].filter(c => c.type === 'text').map(c => c.text).join('')
  }
}
```

### 4.4 Acceptance (BLUE 3a)

- T-D1~T-D15 PASS (codex F5 v0.5 — 15 case mirror)
- Keychain access mock: execSync spy 가 정확한 `security` 명령 받음
- AC-S3 라이브 가능 시 latency < 5초 측정

---

## 5. Step E — llm-client.ts integration + WikeyConfig 3 field (codex F3 보강 v0.2)

### 5.1 Spec Reference

- Spec §1.1 Goal — `subscriptionMode = 'cli' | 'rest'` 분기
- Spec §1.2 I7 — 회귀 0 (cli path 보존), I16 kill-switch
- Spec §1.3 Inputs — WikeyConfig UPPERCASE field 3개 + buildConfig + auth-mode-bridge
- Spec §1.5 AC-S16, AC-S17, AC-S20, AC-S23

### 5.2 Test Spec (RED)

- `wikey-core/src/__tests__/llm-client-subscription-rest.test.ts`
- T-E1: `geminiSubscriptionMode = 'rest'` → `GoogleRESTClient.call` 호출 (spy)
- T-E2: `geminiSubscriptionMode = 'cli'` → 기존 `cli-spawn.ts` `spawnCliPrompt` 호출 (회귀)
- T-E3: 사용자 미설정 (default) → `'pending'` (Step A0 통과 전, codex F1-A fix v0.3) → `defaultModeForApprovalState(state)` 적용. test 의 fixture state = `pending` 시 cli fallback + Notice / `APPROVED_*` 시 spec §1.3.2 표 따름.
- AC-S20 → T-E4: per-provider 혼합 — gemini rest + anthropic cli → 각각 정확 path
- T-E5: REST path 에서 `process.env.{GEMINI,ANTHROPIC,OPENAI}_API_KEY` 접근 0 (Object.defineProperty spy)
- AC-S17 → T-E6 (codex F5 누락 보강 v0.2): `authMode = 'api'` 시 새 RESTClient 진입 0건 + 기존 `callGeminiApi` / `callAnthropicApi` / `callOpenAIApi` spy 호출 1회.
- AC-S23 → **T-E7a/b/c 분리** (codex F2/F5 fix v0.3 — 3 vendor env 일관):
  - **T-E7a**: env `WIKEY_GEMINI_REST_DISABLE=1` 시 `GEMINI_SUBSCRIPTION_MODE='rest'` 무시 + 강제 cli path. env unset + Settings dropdown 'cli' 동일 효과.
  - **T-E7b**: env `WIKEY_ANTHROPIC_REST_DISABLE=1` 동일 패턴.
  - **T-E7c**: env `WIKEY_OPENAI_REST_DISABLE=1` 동일 패턴.
  - 3 vendor env 독립성 확증 — gemini disable 시 anthropic/openai 영향 0.
- T-E11 (codex F4 신설 v0.3): `LLMCallOptions` pass-through — `LLMClient.call` 가 `temperature` / `maxTokens` / `seed` / `jsonMode` / `responseMimeType` / `thinkingBudget` 전달 시 `RESTCallOptions` mapped options (Spec §1.3.1) 가 vendor REST client 의 fetch body 에 정확 포함. mock fetch body 검증 spy 6 option × 3 vendor.

`wikey-core/src/__tests__/config-bridge-subscription-mode.test.ts` (codex F3 신설 v0.2):
- T-E8: `WikeyConfig` 3 field (`GEMINI_SUBSCRIPTION_MODE`, `ANTHROPIC_SUBSCRIPTION_MODE`, `OPENAI_SUBSCRIPTION_MODE`) — env 또는 wikey.conf 에서 읽음
- T-E9: `buildConfig()` (`wikey-obsidian/src/main.ts`) round-trip — Settings camelCase → WikeyConfig UPPERCASE 매핑
- T-E10: `auth-mode-bridge.ts` resolve — `authMode='subscription'` + `subscriptionMode='rest'` → REST path. `subscriptionMode='cli'` → CLI path. matrix 표 단일 source.

### 5.3 Implementation (GREEN)

`wikey-core/src/types.ts` (WikeyConfig 확장):
```typescript
readonly GEMINI_SUBSCRIPTION_MODE?: 'cli' | 'rest' | 'pending'
readonly ANTHROPIC_SUBSCRIPTION_MODE?: 'cli' | 'rest' | 'pending'
readonly OPENAI_SUBSCRIPTION_MODE?: 'cli' | 'rest' | 'pending'
```

`wikey-core/src/config.ts` (default + env bridge):
```typescript
GEMINI_SUBSCRIPTION_MODE: process.env.GEMINI_SUBSCRIPTION_MODE ?? undefined,
// kill-switch env (I16)
GEMINI_REST_DISABLE: process.env.WIKEY_GEMINI_REST_DISABLE === '1',
// ... openai/anthropic 동일
```

`wikey-core/src/auth-resolver.ts` (resolve helper 확장):
```typescript
// codex F3 v0.4/v0.5 — return 'cli' | 'rest' | 'pending'. caller (llm-client.ts) 가 'pending' 시 cli fallback + Notice
export function resolveSubscriptionMode(provider, config, killSwitchEnv): 'cli' | 'rest' | 'pending' {
  if (killSwitchEnv) return 'cli'
  return config[`${PROVIDER_TO_UPPER[provider]}_SUBSCRIPTION_MODE`] ?? 'pending'
}
```

`wikey-core/src/llm-client.ts` (callXxxSubscription 분기, codex F3+F4 v0.3 — UPPERCASE 일관 + LLMCallOptions pass-through):
```typescript
private async callGeminiSubscription(prompt, opts?: LLMCallOptions) {
  const mode = resolveSubscriptionMode('gemini', this.config, this.killSwitch.gemini)
  if (mode === 'pending') {
    // Step A0 미통과 → cli fallback + Notice (Spec §1.3.2)
    opts?.onAuthFallback?.({ provider: 'gemini', reason: 'mode-pending', originalError: ... })
    // fall through to cli
  } else if (mode === 'rest') {
    const client = this.subscriptionDeps.googleRESTClient ?? new GoogleRESTClient()
    // F4 — opts (LLMCallOptions) 전체 pass-through, REST option matrix (Spec §1.3.1) 가
    // GoogleRESTClient 안 mapOptionsToRESTOptions 로 vendor body 매핑
    return (await client.call(prompt, opts?.model ?? 'gemini-2.5-flash', opts ?? {})).text
  }
  // 기존 §5.6.4 cli path 그대로 (mode === 'cli' 또는 mode === 'pending' fall-through)
  const mapped = mapOptionsToCliArgs('gemini', 'subscription', opts ?? {})
  // ... 기존 코드 그대로
}
// callAnthropicSubscription, callOpenAISubscription 동일 패턴
```

**중요** (codex F3 fix v0.3): `this.config.GEMINI_SUBSCRIPTION_MODE` (UPPERCASE) 만 사용 — `geminiSubscriptionMode` (camelCase) 접근 금지. settings camelCase → UPPERCASE 변환은 `wikey-obsidian/src/main.ts buildConfig()` 경계만.

`wikey-obsidian/src/main.ts` `buildConfig()`:
```typescript
return {
  ...
  GEMINI_SUBSCRIPTION_MODE: settings.geminiSubscriptionMode,
  ANTHROPIC_SUBSCRIPTION_MODE: settings.anthropicSubscriptionMode,
  OPENAI_SUBSCRIPTION_MODE: settings.openaiSubscriptionMode,
}
```

### 5.4 Acceptance (BLUE 3a)

- T-E1~T-E11 PASS (codex F5 v0.5 — 11 case mirror, T-E7→T-E7a/b/c 분리 + T-E8~E10 config-bridge + T-E11 pass-through)
- 기존 `wikey-core/src/__tests__/llm-subscription-{gemini,anthropic,openai}.test.ts` 모두 PASS (회귀)
- wikey-core 1184 + Step A~D 신규 ~30 case = ~1214 PASS 목표

---

## 6. Step F — Settings UI

### 6.1 Spec Reference

- Spec §1.1 Goal — per-provider toggle
- Spec §1.2 I9 — 시스템 언어 영문
- Spec §1.5 AC-S20

### 6.2 Test Spec (RED)

- `wikey-obsidian/src/__tests__/settings-tab-subscription-mode.test.ts`
- T-F1: 3 provider subsection 각각 `Subscription Mode` dropdown 추가 (`'rest' | 'cli' | 'pending'` codex F1/F3 v0.4 mirror — pending 은 disabled option, A0 미통과 시 표시)
- T-F2: dropdown 변경 → settings save → setting state 업데이트
- T-F3: 영문 검증 — label / option / description 모두 ASCII
- AC-S23-ui → T-F4 (codex F5 fix v0.4 — Spec §1.5.0 의 매핑 reference 정의): Settings UI dropdown 'cli' 선택 시 즉시 효과 — `plugin.saveSettings` mock spy + 다음 LLM 호출 시 cli path 사용 spy. Settings 저장 직후 `buildConfig()` 가 새 `*_SUBSCRIPTION_MODE='cli'` 로 갱신 + llm-client.ts 분기 정확.

### 6.3 Implementation (GREEN)

`wikey-obsidian/src/settings-tab.ts` 안 3 provider subsection (gemini / anthropic / openai) 각각 추가:

```typescript
// 'Auth Mode' row 다음에 'Subscription Mode' row (Auth Mode === 'subscription' 일 때만 표시)
// codex F1/F3 + F5 v0.5 — 'pending' 3-state. A0 미통과 시 disabled 'pending' option 노출.
new Setting(subsectionEl)
  .setName('Subscription Mode')
  .setDesc('REST = direct API call (faster, no tool use). CLI = launch external CLI (agentic loop). PENDING = Step A0 Legal Gate not yet decided (auto cli fallback).')
  .addDropdown((dropdown) => {
    dropdown
      .addOption('rest', 'REST (direct)')
      .addOption('cli', 'CLI (agentic, legacy)')
      .addOption('pending', 'PENDING (A0 not decided)')
      .setValue(this.plugin.settings.geminiSubscriptionMode ?? 'pending')
      .onChange(async (value: 'rest' | 'cli' | 'pending') => {
        this.plugin.settings.geminiSubscriptionMode = value
        await this.plugin.saveSettings()
      })
  })
```

`wikey-obsidian/src/types.ts` 또는 `main.ts` settings interface 에 3 field 추가 (codex F1/F3 v0.5):

```typescript
geminiSubscriptionMode?: 'rest' | 'cli' | 'pending'
anthropicSubscriptionMode?: 'rest' | 'cli' | 'pending'
openaiSubscriptionMode?: 'rest' | 'cli' | 'pending'
```

### 6.4 Acceptance (BLUE 3a)

- T-F1~T-F4 PASS (codex F5 fix v0.4 — T-F4 Spec §1.5.0 mirror)
- settings round-trip — 저장 후 load 시 값 보존
- master CDP smoke — Settings UI 에서 dropdown visible + clickable

---

## 7. Step G — 회귀 + master CDP smoke 3 vendor + latency SLO + drift smoke (codex F6 + F7 보강 v0.2)

### 7.1 Spec Reference

- Spec §1.5 AC-S18 (master CDP smoke), AC-S20 (per-provider 혼합), AC-S21 (latency SLO N=10), AC-S24 (endpoint hash drift)
- `feedback_master_cdp_direct_smoke.md` LOCK 2026-05-12

### 7.2 절차 (codex F1-B fix v0.3 — A0 state-aware 분기)

1. `npm test` (wikey-core + wikey-obsidian) 모두 PASS — Step A~F 합산 (~250 신규 case 포함)
2. `npm run build` (wikey-obsidian) — 0 error
3. plugin reload (CDP eval `disablePlugin → enablePlugin`)
4. Settings UI 진입 → A0 state 에 따라 vendor 별 `Subscription Mode` 확증:
   - `APPROVED_EXPERIMENTAL` / `APPROVED_LOCAL_ONLY` → 3 vendor 모두 `rest`
   - `APPROVED_PARTIAL` → 사용자 명시 vendor 별 (예: gemini=rest, anthropic=rest, openai=cli)
5. **chat 패널 라이브 — A0 approved vendor 만 N=10 REST smoke** (state-aware):
   - approved vendor (rest) × 10 → latency 측정 → p95 < 5초 (AC-S21)
   - rejected vendor (cli, `APPROVED_PARTIAL` 시) → cli regression smoke 1 회 (latency 측정 X, 기존 cli path 동작 확증)
   - 측정 collect → markdown 표 (vendor / model / median / p95 / p99 / state)
6. **transport-level grep** (codex F7 정정 v0.2) — wikey 가 send 한 request body capture (test mode 또는 console.debug) → `tools` field 0건. response stream event 안 `tool_use` / `function_call` 0건. 자연어 답변 본문 grep 폐기.
7. 응답 footer Referenced 정상 (§5.18 v0.7 한 줄 inline 형식)
8. `subscriptionMode = 'cli'` 1 vendor 만 변경 → 기존 cli path 회귀 OK (AC-S20)
9. **kill-switch test** (codex F2): env `WIKEY_GEMINI_REST_DISABLE=1` 시 Settings dropdown 'rest' 무시 + 강제 cli path 확증.
10. **drift smoke** (codex F6 신설 v0.2): vendor CLI bundle 의 endpoint URL string 수동 변경 (예: `cloudcode-pa.googleapis.com` → `xxx-pa.googleapis.com`) 시 version-guard.ts 가 Notice emit 확증. 실제 깨지지 않게 baseline 으로 복구.

### 7.3 Acceptance

- AC-S21: **approved vendor × N=10 measurement** 모두 정상 응답 + p95 < 5초 (codex branch fix v0.4 — A0 state-aware). A0 = `APPROVED_EXPERIMENTAL`/`APPROVED_LOCAL_ONLY` 시 30 measurement (3 vendor × 10) / `APPROVED_PARTIAL` 시 approved vendor 만 측정.
- AC-S13/S18: transport-level (request body / response stream) tool 0건
- AC-S20: per-provider 혼합 정상
- AC-S23: kill-switch 즉시 효과
- AC-S24: drift detect Notice 정상
- master 가 결과 markdown `docs/sessions/phase-5/phase-5-resultx-5.6.6-rest-direct-2026-05-XX.md` 작성 (latency 표 + drift smoke 결과 + per-provider 혼합 결과)

### 7.4 본 Step 종결 기준

상기 Acceptance 모두 PASS → Step H (BLUE 3b refactor + commit) 진입.

---

## 8. Step H — BLUE 3b refactor + commit/push (codex F9 mirror v0.2)

### 8.1 6 활동 (testing.md §4 mirror)

- (1) 함수 분해 — 50+ LOC 함수 — extract 후보 결정
- (2) Naming consistency — `subscriptionMode` 일관 (camelCase UI / UPPERCASE config)
- (3) 중복 제거 (DRY) — vendor client 의 refresh / 401 retry / classifyHTTPFailure 공통 부분 → shared helper 위치 점검
- (4) 주석 quality — 각 vendor client 파일 상단에 `출처: docs/spikes/phase-5/5.6.6/poc-{vendor}.mjs` 명시 + endpoint URL 의 baseline (codex F6 mirror)
- (5) 가독성 — magic number (60s threshold, 600s timeout, 1024 max_tokens) const 분리
- (6) 회귀 재검증 — `npm test + build + validate-wiki` 각 refactor 후 PASS 반복

### 8.2 Commit

prefix policy:
- `feat(§5.6.6 vN): <step> <scope>` (Step A~G GREEN)
- `refactor(§5.6.6 vN): <BLUE 3b>` (Step H 정리)
- `fix(§5.6.6 vN): <finding>` (codex post-impl finding)
- `docs(§5.6.6 sync): <mirror>` (phase-5-todo / phase-5-result mirror)

### 8.3 종결 mirror

- `phase-5-todo.md §5.6.6` 모든 step checkbox `[ ]` → `[x]`
- `phase-5-result.md §5.6.6` entry 추가
- `docs/planning/session-wrap-followups.md` 다음 cycle 시작점

---

## 9. 의존성 / 순서

```
A0 (Legal Gate, BLOCKING) → A (shared) → B (Google) ↘
                              A (shared) → C (OpenAI)  → E (integration + WikeyConfig) → F (Settings UI) → G (smoke + SLO + drift) → H (refactor + commit)
                              A (shared) → D (Anthropic) ↗
```

- **A0 통과 결과** = `APPROVED_EXPERIMENTAL` / `APPROVED_LOCAL_ONLY` / `APPROVED_PARTIAL` / `REJECTED`. 각 시점에 따라 vendor 별 진행 여부 다름.
- **병렬 가능**: B / C / D 는 A 종결 후 동시 작업 가능 (각 vendor 독립).
- **순차 의무**: E 는 B/C/D 모두 종결 후 (WikeyConfig + buildConfig 통합). F 는 E 후. G 는 F 후. H 는 G 후.
- **`APPROVED_PARTIAL` 시**: 거부된 vendor 의 Step (B/C/D 중 하나) 는 skip + 해당 vendor 의 cli path 만 유지. E 의 분기 시 거부 vendor 는 강제 cli.

## 10. 문서 sweep

본 cycle 종결 시 mirror:
- `docs/planning/phase-5/phase-5-todo.md` §5.6.6 entry 추가 + 체크박스
- `docs/sessions/phase-5/phase-5-result.md` §5.6.6 entry 추가
- `docs/sessions/phase-5/phase-5-resultx-5.6.6-rest-direct-2026-05-XX.md` 신규 (라이브 smoke 결과)
- `docs/planning/session-wrap-followups.md` 다음 세션 시작점 갱신
- `~/.claude/projects/-Users-denny-Project-wikey/memory/MEMORY.md` Phase 5 status 갱신
- `wikey.schema.md` 변경 0 (I2 보존)
- `README.md` 변경 0 — **단 Step A0 결과 = `APPROVED_LOCAL_ONLY` 시 disclaimer 추가 의무** (codex branch fix v0.4 — Spec §0.5.2 mirror, R2 mitigation). disclaimer 내용: "Subscription REST direct (Google Code Assist / OpenAI private Codex backend / Anthropic Claude OAuth) — local 개인 사용 한정, public 배포 금지." 한 paragraph.
