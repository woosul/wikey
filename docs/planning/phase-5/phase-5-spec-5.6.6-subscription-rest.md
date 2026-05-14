---
phase: 5
section: 5.6.6
title: Subscription REST direct — 3 vendor unified paradigm (CLI agentic bypass) (Spec)
status: planning
created: 2026-05-14
updated: 2026-05-14
version: v0.6
---

# Phase 5 §5.6.6 Subscription REST direct — 3 vendor unified paradigm (Spec, WHAT)

> **상위 문서**: [`docs/planning/phase-5/phase-5-todo.md §5.6.6`](./phase-5-todo.md) · [`docs/planning/phase-5/phase-5-todox-5.6.6-subscription-rest.md`](./phase-5-todox-5.6.6-subscription-rest.md)
>
> **이력**:
> - v0.1 (2026-05-14, master 직접 작성, 사용자 명시) — Session 44 PoC §1~§4 (`/tmp/poc-cloudcode.mjs` `/tmp/poc-codex.mjs` `/tmp/poc-anthropic.mjs`) 결과 기반. 3 vendor 옵션 D paradigm 모두 검증 완료 — Google (gemini), OpenAI (codex), Anthropic (claude) subscription token 으로 vendor REST endpoint 직접 호출 = 1-3초 latency + tool 호출 0 + subscription quota 사용. 본 spec 은 PoC 1:1 reproduce + wikey-core 통합 paradigm.
> - **v0.2 (2026-05-14, codex Mode D Panel cycle #1 NEEDS_REVISION 9 finding fix)** — codex cross-model 검증 후 master 모두 동의 fix 적용:
>   - **F1 (HIGH) — Step A0 Legal/Terms Gate 추가** (blocking, 사용자 승인 전 default `rest` 미확정). vendor EULA 검토 결과 `APPROVED_EXPERIMENTAL | APPROVED_LOCAL_ONLY | REJECTED` 명시 상태 기록.
>   - **F2 (HIGH) — OpenAI 용어 정정**: "Responses API" → **"private Codex backend"** (`chatgpt.com/backend-api/codex/responses` + Codex OAuth, 공식 `api.openai.com/v1/responses` API 와 다른 비공개 endpoint). R1/R2 severity 상향 + R9 신설 (private backend coupling) + Acceptance kill-switch 명시.
>   - **F3 (HIGH) — WikeyConfig core field 누락 fix**: `GEMINI_SUBSCRIPTION_MODE` / `ANTHROPIC_SUBSCRIPTION_MODE` / `OPENAI_SUBSCRIPTION_MODE` 3 field 를 `WikeyConfig` UPPERCASE schema + `buildConfig` + `auth-mode-bridge` + credentials parse/serialize 모두에 추가. Step E/F 보강.
>   - **F4 (HIGH) — REST option matrix 추가**: `LLMCallOptions` 의 `jsonMode` / `temperature` / `seed` / `maxTokens` / `responseMimeType` / `thinkingBudget` 6 field 가 REST path 에서 어떻게 처리되는지 명시 (`§1.3.1 REST option matrix`). `jsonMode-unsupported` 회귀 방어 (§5.6.4 v0.7 R2 mirror).
>   - **F5 (MID) — AC ↔ T 매핑표** (`§1.5.0`) 신설 + 누락 test 보강 (AC-S10 Anthropic 429, AC-S12 timeout, AC-S15 tier, AC-S17 API mode unchanged).
>   - **F6 (MID) — spike 보존 + version guard**: `/tmp/poc-*.mjs` → `docs/spikes/phase-5/5.6.6/poc-{google,openai,anthropic}.mjs` 보존 + `subscription-rest-version-guard.ts` Step A 명시 + bundle endpoint sha256 hash drift smoke (Step G).
>   - **F7 (MID) — I1/I3 정정**: I1 = "transport/log/event level tool call 0" (자연어 grep 폐기, 사용자가 'tool' 단어 묻기 깨짐) / I3 = invariant 폐기, AC-S21 SLO target 으로 강등 (N=10 측정 p95).
>   - **F8 (MID) — refresh token rotation**: refresh response 의 `refresh_token` / `id_token` 회전 시 보존 의무 (`§1.4 outputs` + Step B/C/D test 추가). atomic write + concurrent refresh lock.
>   - **F9 (LOW) — Step H mirror 일관성**: todox Step A~G + H mirror 일관 (G 의 BLUE 3b 하위 또는 별 H 한 형식 통일).
> - **v0.3 (2026-05-14, codex Mode D Panel cycle #2 NEEDS_REVISION 8 finding fix)** — 변경 8 영역:
>   - **F1-A (HIGH) default `rest` 미확정 — Goal/Inputs 일관 정정**: Step A0 통과 전 default = `'pending'` (resolveSubscriptionMode 의 sentinel). `APPROVED_*` 4 state 별 default resolution 단일 함수 (`defaultModeForApprovalState` in §1.3.2).
>   - **F1-B (HIGH) Step G `APPROVED_PARTIAL` 분기 누락**: Step G 절차를 A0 state-aware 로 변경. 거부 vendor = REST smoke skip + cli regression 만.
>   - **F2/F5 (HIGH) kill-switch acceptance 3 vendor 일관**: AC-S23 + I16 + Step E test (T-E7) 모두 `WIKEY_GEMINI/ANTHROPIC/OPENAI_REST_DISABLE` 3 env 명시. vendor 별 disable test 분리 추가 (Step E T-E7a/b/c).
>   - **F3 (HIGH) WikeyConfig casing/field path 일관**: Step E 의 중복 implementation block 제거 — core 는 UPPERCASE `WikeyConfig` + `resolveSubscriptionMode` resolver 만. settings camelCase → UPPERCASE 변환은 `buildConfig()` 경계에서만.
>   - **F4 (HIGH) RESTCallOptions option pass-through**: shared `RESTCallOptions` 에 mapped options 포함 (또는 `LLMCallOptions` 그대로 forward). E→B/C/D pass-through tests 추가 (T-E11).
>   - **F5 (MID) AC↔T 1:1 매핑 보강**: AC-S12 vendor별 timeout test (T-B9/T-C11/T-D13). AC-S8 Google 401-twice (T-B10) + Anthropic 401-twice (T-D14). AC-S19 vendor별 stderr/console mock 닫음 (T-B11/T-C12/T-D15).
>   - **F6 (MID) spike PoC reference 통일**: spec/todox 모든 active reference = `docs/spikes/phase-5/5.6.6/poc-{vendor}.mjs`. `/tmp/poc-*.mjs` 는 `이력` history 만.
>   - **F7 (MID) AC-S13 본문 자연어 grep 폐기**: AC-S13 본문 = transport-level (request body / response stream event) 검증만. 사용자 답변 text grep 금지 명시.
>   - **Regression (LOW) I12 LOC budget 현실화**: I12 ~600 → ~900 LOC + ~250 test. Karpathy Simplicity 보존 — 8 step (A0~H) 분할 + shared abstraction + version-guard 추가가 over-engineering 아닌 필수 (codex F1+F6 mirror).
> - **v0.4 (2026-05-14, codex Mode D Panel cycle #3 NEEDS_REVISION 7 finding fix)** — 변경 7 영역:
>   - **F1/F3 (HIGH) `pending` type 정합**: `WikeyConfig` `*_SUBSCRIPTION_MODE` type을 `'cli' | 'rest' | 'pending'` 명시 + `SubscriptionFallbackError reason union`에 `'mode-pending'` 추가 + `resolveSubscriptionMode` return type 정정.
>   - **F5 (HIGH) AC↔T 매핑 stale 정정**: 본문 "총 24 AC" → "총 25 AC" + Step F 안 `T-F4` (Settings UI dropdown 'cli' 즉시 효과) 정의 추가 + todox §0 "T-A1 ~ T-G3" → "T-A1 ~ T-F4 + Step G manual smoke" 정정. T-G* 폐기 (Step G = manual smoke + measurement, unit test ID 부재).
>   - **F9 (MID) phase-5-todo case count 갱신**: B=8→11 / C=10→12 / D=12→15 / E=10→11 / F=3→4 mirror 정합.
>   - **F6 (MID) spike path 잔존 sweep**: spec line 34/335 옛 이름 (`{poc-cloudcode,poc-codex,poc-anthropic}.mjs`) → `poc-{google,openai,anthropic}.mjs` 통일. phase-5-todo line 943 `/tmp/` 잔존 → canonical path.
>   - **F7 (MID) OpenAI instructions 텍스트 + AC-S13 schema-only**: OpenAI implementation snippet `instructions: '... Do not use any tools.'` 텍스트 폐기 (raw substring "tools" false hit). AC-S13 본문에 "request body schema field 검증만, raw substring grep 금지" 명시.
>   - **F8 (MID) atomic write contract 좁힘**: I17 "single write or tmp + rename" → "tmp + rename only" (single write는 truncation race 가능).
>   - **신규 branch conflict (MID)**: docs sweep "README.md 변경 0" → "변경 0 (단 `APPROVED_LOCAL_ONLY` 시 disclaimer 추가 의무)" 정정. Step G "30 measurement hardcode" → "approved vendor × N=10 (state-aware)" 정정.
> - **v0.5 (2026-05-14, codex Mode D Panel cycle #4 5 PARTIAL fix)** — cycle #4 = 4 OK + 5 PARTIAL. 잔여 5 작은 정합성 sweep:
>   - **F1 fix v0.5**: AC-S21 본문 "30 measurements" stale → state-aware 정정 + `APPROVED_PARTIAL` byte-level 기록 포맷 vendor 별 정의 (예: `gemini=APPROVED, anthropic=APPROVED, openai=REJECTED`)
>   - **F3 fix v0.5**: todox Step E + F snippet 잔존 (`'cli' | 'rest'` 2-state, `?? 'rest'` default) → `'cli' | 'rest' | 'pending'` 3-state + `?? 'pending'` default 정정
>   - **F5 fix v0.5**: todox 각 Step Acceptance "T-X1~T-Xn PASS" 라인 갱신 (T-A12, T-B11, T-C12, T-D15, T-E11, T-F4)
>   - **F6 fix v0.5**: 실제 spike 파일 mv 완료 (Session 44 시점 / Step A0 전이지만 plan reference 정합성 위해 미리) — `/tmp/poc-{cloudcode,codex,anthropic}.mjs` → `docs/spikes/phase-5/5.6.6/poc-{google,openai,anthropic}.mjs` + `SPIKE.md` 신설
>   - **F9 fix v0.5**: phase-5-todo §5.6.6 title "plan v0.3" → "plan v0.5" 정정
> - **Step A0 결정 LOCK (2026-05-14 Session 45, 사용자 explicit)**: **`APPROVED_LOCAL_ONLY`** — byte-level: `gemini=APPROVED, anthropic=APPROVED, openai=APPROVED` (3 vendor 모두 local 개인 사용 한정 승인). README.md disclaimer 추가 의무 (Step G docs sweep). Step A~H 구현 승인.
> - **v0.6 (2026-05-14, Session 45 잔여 5 fix LOCK)** — cycle #5 PARTIAL + X1~X3 = 5 finding 모두 마무리 (구현 진입 직전 최종 sweep):
>   - **F5 PARTIAL fix v0.6**: Spec §1.5 본문에 AC-S25 시나리오 명시 신설 (`LLMCallOptions pass-through` Happy path + OpenAI mapping + Anthropic jsonMode throw + silent ignore graceful degradation + pass-through 측정 위치). 이전엔 매핑표 §1.5.0 만 존재, §1.5 본문 부재 → §1.5 끝 Endpoint hash drift 직후에 신규 subsection 추가.
>   - **F6 PARTIAL fix v0.6**: `docs/spikes/phase-5/5.6.6/SPIKE.md` 안 sha256 baseline 실 측정값 갱신 — Session 45 측정 명령 + 3 vendor 의 endpoint canonical hash 표 + vendor CLI bundle endpoint 존재 grep 확증. Google `e82c46..bbe` / OpenAI `1897fa..6e5` / Anthropic `dd9dd1..dbc`.
>   - **X1 HIGH fix v0.6**: `phase-5-todox-5.6.6` §0 작업 분할 표 + §9 의존성 순서 — Step E dependency "B/C/D 모두 완료" → "approved vendor steps only + rejected vendor cli stub/forced cli branch" (`APPROVED_PARTIAL` 분기 정합).
>   - **X2 MID fix v0.6**: `phase-5-todox-5.6.6` §7.2 9번 kill-switch test — Gemini env 1 종 → **3 vendor env 모두 명시** (Gemini + Anthropic + OpenAI 각각 라이브 smoke + 독립성 확증). Spec AC-S23 의 3 vendor 일관 (이미 v0.3) 과 mirror.
>   - **X3 LOW fix v0.6**: Spec §3 Self_Check 옛 ID sweep — `I1~I15` → `I1~I18` / `AC-S1~S20` → `AC-S1~S25` / `R1~R8` → `R1~R10`. §4 PoC reference `~600 LOC` → `~900 LOC + ~250 test = ~1150 LOC` (I12 + Regression LOW fix mirror).
>
> **본 §5.6.6 = §5.6.4 (LLM Provider subscription auth, Session 42 종결 commit `e68c53d`) + §5.6.5 (Ollama Cloud, Session 43 종결 commit `2731353`) 후속**. 사용자 라이브 raise (Session 44, 2026-05-14) — gemini-2.5-flash chat 패널 응답 latency 30-60초+ 관찰 → root cause = gemini CLI agentic loop (자체 tool 호출 + retry). 사용자 결정 옵션 D (REST direct).

## 0. Context

**도출 source**: 사용자 라이브 raise 2026-05-14 (Session 44). chat 패널 'pms' 질문 → `gemini CLI exit 1: read_file File not found ×10 + 429 RESOURCE_EXHAUSTED` (gemini CLI 의 자체 agentic tool loop 실패 + retry). `gemini CLI` `claude CLI` `codex CLI` 모두 단순 LLM wrapper 가 아니라 자체 *코딩 에이전트* — tool use / file read / shell exec 자동 시도. wikey 입장에선 "단순 답변" 의도인데 CLI 는 "에이전트 작업" 모드.

**이득**:
- **정량 (latency)** — 1-3초 (정상시), 기존 30-60초+ 대비 **10-30배** 개선. PoC 측정: Anthropic 1932ms / OpenAI 1945ms / Google ~1-3초 추정.
- **정량 (cost)** — subscription quota 사용 (이미 결제한 자산), API key 비용 0. 사용자 명시 ("API 사용하면 좋지. 비용이 너무 과해..").
- **정성 (예측 가능성)** — REST direct 호출 = 결과 deterministic (LLM 응답 1회). agentic loop 의 비결정적 retry 폭주 사라짐.
- **정성 (사용자 인지)** — 429 throttle 시 즉시 fail (no backoff retry) → 사용자가 즉각 인지하고 다른 모델 / 시간대 선택. 기존 60초+ 무한 retry 후 실패와 다름.
- **정성 (debugging)** — wikey 가 직접 fetch / response 처리 → 에러 root cause 명확. CLI agentic loop 의 secondary 에러 (read_file File not found 등) 감춤 사라짐.

**Trade-off**:
- 비공개 endpoint (cloudcode-pa / **OpenAI private Codex backend** = `chatgpt.com/backend-api/codex/responses` / api.anthropic.com OAuth path) spec 변경 risk — vendor CLI 업데이트로 깨질 가능성. mitigation = CLI bundle version sha256 hash check + version-guard.ts (Step A) + drift smoke (Step G). **OpenAI 의 경우 공식 `api.openai.com/v1/responses` Responses API 가 아니라 ChatGPT subscription 용 private backend** (codex CLI 가 사용) — 안정성 / 호환성 / 약관 모두 별도 평가.
- OAuth client_id 차용 (CLI bundle 추출 — Google `681255809395-***`, Anthropic `9d1c250a-***`, OpenAI `app_EMoam***` — 마스킹 GitHub secret-scan 회피, 실 값은 vendor CLI bundle 직접 reference SPIKE.md) — 공개 bundle 안 하드코딩이라 사실상 public 이지만 vendor EULA/ToS 검토 필요. **Step A0 Legal/Terms Gate 통과 전 구현 0건** (codex F1 fix).
- 새 코드 영역 (~600 LOC) 추가 — 기존 CLI spawn path 폐기 X, 옵션 사용자 선택 (`subscriptionMode = 'cli' | 'rest'`, **Step A0 결과 = APPROVED_EXPERIMENTAL** 시 default `'rest'` 확정).
- streaming UI 미지원 (현재 collected text only) — chat 패널의 progressive render 는 별 cycle. 현재는 PoC 와 동일 collected text.
- **kill-switch** (codex F2 fix) — Settings UI 또는 env override 로 vendor 별 REST path 즉시 disable 가능. private backend coupling 위험 발현 시 사용자가 즉시 cli path fallback.

**Karpathy 4 원칙 정합** (wikey.schema.md §"LLM Wiki 개인화의 4가지 장점"):
- **Explicit** — REST direct 호출 paradigm 이 명시적 (CLI agentic loop 의 implicit tool retry 사라짐). 응답 latency / usage / model 모두 wikey 가 직접 측정·기록.
- **Yours** — token storage paradigm 보존 (Google file / OpenAI file / Anthropic Keychain). wikey 가 추가 storage 도입 0 → 사용자 자산 외부 노출 0.
- **File over app** — 응답 = plain text. SSE / JSON 파싱 후 wikey 표준 markdown 으로 처리. Unix 도구 (`grep`, `wc`) 호환.
- **BYOAI** — 3 vendor subscription 모두 동일 추상화로 사용자 자유 전환. CLI install 의무도 유지 (회귀 0) → 사용자가 둘 중 선택.

**3계층 정합** (wikey.schema.md §"3계층 아키텍처"):
- raw/ = 변경 0. wiki/ = 변경 0. schema = 변경 0 (`wikey.schema.md` Edit 0).
- 본 §5.6.6 = LLM dispatch layer 만 변경. ingest / query / lint / delete 워크플로우 모두 회귀 0.

**워크플로우 4 정합** (wikey.schema.md §"시스템 워크플로우"):
- **ingest** — `provider: 'gemini' | 'anthropic' | 'openai'` + `subscriptionMode: 'rest'` 시 새 path 사용. ingest 본문 흐름 (modal Brief → Approve → wiki write) 변경 0.
- **query** — chat 패널 응답이 tool agentic 없이 직접 답변. citation / Referenced footer 변경 0.
- **lint** — `validate-wiki.sh` 회귀 0.
- **delete** — 변경 0.

---

## 0.5. Step A0 — Legal/Terms Gate (BLOCKING, codex F1 fix)

> **본 Gate 가 통과 (사용자 explicit 승인) 되기 전 Step A~H 구현 0건. default `subscriptionMode = 'rest'` 도 미확정.**

본 §5.6.6 paradigm = vendor 의 **비공개 REST endpoint** (cloudcode-pa / chatgpt.com backend-api / api.anthropic.com OAuth path) 를 vendor CLI 가 사용하는 OAuth client_id/secret 로 직접 호출. 공식 API 와 다른 layer.

### 0.5.1 vendor terms 검토 의무

| Vendor | 검토 대상 문서 | 핵심 조항 |
|--------|---------------|-----------|
| Google | [Google APIs Terms of Service](https://developers.google.com/terms) + [Code Assist 약관](https://cloud.google.com/code-assist/docs/terms) | "use the Service in accordance with the Documentation" / reverse engineering 조항 |
| OpenAI | [OpenAI Terms of Use](https://openai.com/policies/terms-of-use/) + [API Service Terms](https://openai.com/policies/service-terms/) | reverse engineering / programmatic extraction / rate-limit 우회 / use API in accordance with docs |
| Anthropic | [Anthropic Usage Policies](https://www.anthropic.com/legal/aup) + [Commercial Terms](https://www.anthropic.com/legal/commercial-terms) | acceptable use + Claude.ai vs API tier 구분 |

### 0.5.2 결과 상태 (사용자 명시 결정)

| 상태 | 의미 | 후속 |
|------|------|------|
| `APPROVED_EXPERIMENTAL` | 본 paradigm 채택 — 모든 vendor REST direct 가능. default `rest` 확정. | Step A~H 진행 |
| `APPROVED_LOCAL_ONLY` | local 개인 사용 한정 — public 배포 금지. plan 진행 단 README 에 disclaimer 추가. | Step A~H 진행 + 별 disclaimer |
| `APPROVED_PARTIAL` | 일부 vendor 만 승인 — 예: Anthropic Messages API 표준 endpoint 만, OpenAI private backend 거부. | 해당 vendor Step 만 진행 + 거부 vendor 는 cli path 유지. **byte-level 기록 포맷** (codex F1 fix v0.5): `phase-5-todo §5.6.6 Step A0 결정` 라인 안 vendor-별 명시 — 예: `gemini=APPROVED, anthropic=APPROVED, openai=REJECTED` (lower-case vendor name + `=` + APPROVED/REJECTED). spec/todox 의 `이력` 에도 동일 포맷 mirror. |
| `REJECTED` | paradigm 자체 폐기 — option B (prompt 차단) 으로 fallback. | §5.6.6 plan 폐기 + 별 cycle |

### 0.5.3 사용자 결정 시점

본 spec 종결 (codex Mode D Panel APPROVE) 직후 사용자 명시 결정 — Step A0 통과 / 실패. 통과 결과 `phase-5-todo.md §5.6.6` 의 `Step A0 결정` 라인에 byte-level 기록 + 본 spec 의 `이력` 에 v0.X mirror.

---

## 1. Specs

### 1.1 Goal / Non-Goal

**Goal**:
- 3 vendor (Google `gemini` / OpenAI `openai` / Anthropic `anthropic`) subscription 의 **기존 CLI spawn path 와 병렬로 REST direct path 추가**. 사용자가 Settings UI 의 `Subscription Mode` per-provider toggle 로 `cli` / `rest` 선택. **default = `'pending'` (Step A0 통과 전), Step A0 결과에 따라 `defaultModeForApprovalState()` (§1.3.2) 가 vendor 별 default 결정** (codex F1-A fix v0.3).
- 3 vendor 통합 abstraction `SubscriptionRESTClient` interface (`loadToken`, `refreshIfNeeded`, `call(prompt, model, opts)`) — 공통 paradigm 위에 vendor-specific overrides (token storage / endpoint / body shape / refresh URL / streaming).
- PoC §1~§4 의 paradigm 1:1 reproduce — 검증된 동작. canonical reference (codex F6 fix v0.3) = `docs/spikes/phase-5/5.6.6/poc-{google,openai,anthropic}.mjs` (Step A0 통과 후 mv).
- 토큰 storage paradigm 보존:
  - Google: `~/.gemini/oauth_creds.json` (file)
  - OpenAI: `~/.codex/auth.json` (file, `tokens.{access_token, refresh_token, account_id}`)
  - Anthropic: macOS Keychain `Claude Code-credentials` (`security find-generic-password`)
- 401 시 force refresh + retry 1회 (2번 401 = re-login Notice + throw).
- 429 / 5xx 시 즉시 fail (no backoff retry) — 사용자 즉각 인지 + 다른 모델 / Auth Mode 전환 권유.
- tool 호출 0 (agentic loop bypass) — 응답 markdown 안 file path / read_file 흔적 0.
- subscription quota 사용 확증 — API key 사용 0 (`process.env.GEMINI_API_KEY` 등 미접근).
- 라이브 cycle smoke 3 vendor — chat 패널에서 각 vendor 정상 응답 (master CDP 직접, `feedback_master_cdp_direct_smoke.md` LOCK).

**Non-Goal**:
- 새 vendor 추가 (xAI Grok / Mistral / Cohere) — 본 cycle 은 3 vendor 만.
- streaming UI (chat 패널 progressive render) — 현재 collected text 만. progressive 는 별 cycle.
- vendor catalog dynamic discovery — vendor 별 모델 이름은 사용자 Settings 입력 그대로.
- 기존 CLI spawn path 폐기 — 회귀 0 의무. 사용자가 `subscriptionMode = 'cli'` 명시 선택 시 §5.6.4 cli-spawn.ts 그대로 사용.
- API mode 폐기 — `auth = 'api'` 시 기존 HTTPS API 호출 그대로 (`api.anthropic.com/v1/messages` 표준 / Google `generativelanguage.googleapis.com` / OpenAI `api.openai.com`). 본 §5.6.6 은 `auth = 'subscription'` + `subscriptionMode = 'rest'` 분기만.
- token storage 추가 (별도 wikey 캐시 / file mirror) — vendor 의 storage paradigm 에 위임. wikey 가 token 자체 저장 X.
- streaming SSE → progressive UI binding — chat 패널 collected text 만, SSE 는 wikey 내부에서 collect 후 일괄 전달.
- gemini CLI / claude CLI / codex CLI 자체 의존 제거 (still installed for `subscriptionMode = 'cli'` fallback).
- benchmark / latency 비교 자동화 — manual smoke 만 (사용자 명시 호출).

### 1.2 Invariants (불변식, LOCK)

- **(I1) tool use 0 — transport/log/event level** (codex F7 fix v0.2) — REST direct path 에서 wikey 코드가 vendor 에 보내는 request body 안 `tools` / `tool_config` / `function_declarations` 같은 tool 호출 schema 0건. response 안 `tool_use` / `function_call` event 0건. **자연어 출력 grep 폐기** (사용자가 'tool' 단어 묻기 시 false fail). 검증 = mock fetch capture body / response stream event-level grep, 사용자 답변 text grep X.
- **(I2) subscription quota 사용** — API key 사용 0. wikey 코드 어디서도 `process.env.{GEMINI,ANTHROPIC,OPENAI}_API_KEY` 접근 0 (rest path). API mode (`auth = 'api'`) 분기는 별도 file (기존 path 보존).
- **(I3) latency p95 < 5초 — invariant 폐기, AC-S21 SLO target 으로 강등** (codex F7 fix v0.2). 단일 smoke 로 검증 불가능. PoC 측정 baseline (참고): Anthropic 1932ms / OpenAI 1945ms / Google ~1-3초. AC-S21 = N=10 측정 p95 < 5초.
- **(I4) token refresh OAuth2 표준** — `grant_type=refresh_token` form-encoded. 3 vendor 동일 paradigm. refresh URL 만 vendor specific (Google `oauth2.googleapis.com/token` / OpenAI `auth.openai.com/oauth/token` / Anthropic `console.anthropic.com/v1/oauth/token`).
- **(I5) 401 → force refresh + retry 1회** — 첫 401 시 토큰 만료 가능성 → refresh + 동일 호출 재시도. 두 번째 401 시 = re-login 필요 → Notice + throw (`SubscriptionFallbackError('auth-missing')`). 무한 retry 금지.
- **(I6) 429/5xx → 즉시 fail** — backoff retry 없음. throw `SubscriptionFallbackError('quota-exceeded')` 또는 `('server-error')`. 사용자 즉각 Notice 인지 → 다른 모델 / Auth Mode 전환. CLI agentic loop 의 60s+ retry 폭주 회피.
- **(I7) 회귀 0 — 기존 CLI spawn path 보존 LOCK** — `subscriptionMode = 'cli'` 시 §5.6.4 `cli-spawn.ts` + `llm-client.ts` 의 callGeminiSubscription / callAnthropicSubscription / callOpenAISubscription 변경 0. 모든 기존 test PASS (wikey-core 1184 + wikey-obsidian 224).
- **(I8) token storage 보존** — Google file / OpenAI file / Anthropic Keychain. wikey 가 새 storage 도입 X. read-only access 만 (refresh 후 write-back 은 vendor 의 storage 에 동일 path).
- **(I9) 시스템 언어 영문** — Settings 의 `Subscription Mode` 라벨 / dropdown option / Notice / error message 모두 영문. 한글 0건.
- **(I10) token 값 conversation/log/Notice 노출 0** — 길이 / 만료시각 / accountId 같은 metadata 만 stderr debug log. accessToken / refreshToken 본문 stdout / Notice / file write 0건. PoC `docs/spikes/phase-5/5.6.6/poc-*.mjs` (canonical) 의 stderr log 패턴 1:1 따름.
- **(I11) PoC 1:1 reproduce** — `wikey-core/src/{vendor}-rest-client.ts` 의 핵심 함수 (token load / refresh / call) 가 PoC spike 의 동일 paradigm 따름. spike 검증 완료 paradigm 위 추상화.
- **(I12) Karpathy Simplicity — LOC budget v0.3 (codex Regression LOW fix)** — vendor 별 client = 단일 file (~150 LOC). 공통 abstraction = ~120 LOC + version-guard ~60 LOC. integration `llm-client.ts` ~150 LOC. Settings UI ~80 LOC. **총 ~900 LOC + ~250 test LOC = ~1150 LOC** (codex F1+F6 mirror — Step A0 / version-guard / WikeyConfig 3 field 추가가 over-engineering 아닌 사용자 안전 + spec-driven 필수). 추가 추상화 (factory pattern / DI container) 도입 X.
- **(I13) per-provider toggle** — `subscriptionMode` 는 provider 별 독립 설정 (`geminiSubscriptionMode` / `anthropicSubscriptionMode` / `openaiSubscriptionMode`). 사용자가 한 vendor 만 rest, 나머지 cli 선택 가능.
- **(I14) credentials.json 무영향** — REST path 는 vendor token 만 사용. wikey 의 `credentials.json` (`geminiApiKey` 등) 변경 0. 새 field 추가 0.
- **(I15) ollama-cloud 무영향** — §5.6.5 의 ollama-cloud (HTTP API + Bearer header) 는 본 cycle scope 외. 4번째 provider 통합 paradigm 은 §5.6.5 에 위임.
- **(I16) kill-switch per-vendor 3 env 일관** (codex F2/F5 fix v0.3) — Settings UI 의 `Subscription Mode` dropdown 에서 사용자가 즉시 `'cli'` 선택 시 해당 vendor REST path 0 호출. **3 env 모두 단일 source 일관** — `WIKEY_GEMINI_REST_DISABLE=1` / `WIKEY_ANTHROPIC_REST_DISABLE=1` / `WIKEY_OPENAI_REST_DISABLE=1`. 각 env 가 vendor 별 독립 작동 + Settings dropdown 'cli' 와 동일 효과. private backend coupling 위험 발현 시 사용자가 vendor 별 즉시 cli path fallback.
- **(I17) refresh response rotation 보존** (codex F8 fix v0.2 → atomic 좁힘 v0.4) — vendor refresh response 가 새 `refresh_token` 또는 `id_token` 회전 시 wikey 가 갱신본 그대로 storage write-back. unknown field 도 round-trip 보존 (`{...existing, ...refreshed}` shallow merge). **atomic write 의무 = `fs.writeFile(tmp) + fs.rename(tmp, target)` only** (codex F8 fix v0.4 — single `fs.writeFile`은 truncation race + crash 시 partial write 가능, atomic 아님). Keychain 은 `add-generic-password -U` 가 vendor atomic. concurrent refresh lock (Step A `refreshIfNeededShared` per-vendor promise share, R6).
- **(I18) Step A0 Legal Gate 통과 의무** (codex F1 fix v0.2) — 본 spec 종결 후 사용자 명시 결정 (`APPROVED_EXPERIMENTAL` / `APPROVED_LOCAL_ONLY` / `APPROVED_PARTIAL` / `REJECTED`) 없이 Step A~H 진행 0건. 결정 결과 phase-5-todo §5.6.6 에 byte-level 기록.

### 1.3 Inputs

- 사용자 Settings (camelCase, `wikey-obsidian`):
  - `geminiAuthMode = 'subscription'` (기존 §5.6.4 setting)
  - `anthropicAuthMode = 'subscription'`
  - `openaiAuthMode = 'subscription'`
  - **신규**: `geminiSubscriptionMode = 'cli' | 'rest' | 'pending'` (default `'pending'`, Step A0 통과 후 `defaultModeForApprovalState()` 적용 — §1.3.2)
  - **신규**: `anthropicSubscriptionMode = 'cli' | 'rest' | 'pending'`
  - **신규**: `openaiSubscriptionMode = 'cli' | 'rest' | 'pending'`
- **WikeyConfig core schema** (UPPERCASE_SNAKE_CASE, `wikey-core/src/types.ts`, codex F3 fix v0.2 → type union 정정 v0.4):
  - 신규 3 field: `GEMINI_SUBSCRIPTION_MODE?: 'cli' | 'rest' | 'pending'` / `ANTHROPIC_SUBSCRIPTION_MODE?: 'cli' | 'rest' | 'pending'` / `OPENAI_SUBSCRIPTION_MODE?: 'cli' | 'rest' | 'pending'` (codex F1/F3 fix v0.4 — `'pending'` 명시 type union)
  - default 값 = `'pending'` (Step A0 미통과 시) → `defaultModeForApprovalState()` (§1.3.2) 적용
  - **`SubscriptionFallbackError reason union` 확장** (codex F1/F3 fix v0.4) — 기존 5 reason (`quota-exceeded` / `auth-missing` / `spawn-failed` / `jsonMode-unsupported` / `timeout`) + 신규 1: `'mode-pending'` (Step A0 미통과 시 `resolveSubscriptionMode` 가 throw). `wikey-core/src/types.ts:203` `AuthFallbackInfo.reason` + `wikey-core/src/llm-client.ts:771` `SubscriptionFallbackError.reason` 동시 갱신 의무.
  - `resolveSubscriptionMode` return type = `'cli' | 'rest' | 'pending'` (codex F1/F3 fix v0.4 — caller `'pending'` 처리 의무).
  - kill-switch env: `WIKEY_GEMINI_REST_DISABLE=1` / `WIKEY_ANTHROPIC_REST_DISABLE=1` / `WIKEY_OPENAI_REST_DISABLE=1` 시 강제 cli (I16 mirror)
  - bridge: `wikey-obsidian/src/main.ts` `buildConfig()` 가 settings → WikeyConfig 변환 — 신규 3 field 추가 의무. test `__tests__/main-config-bridge.test.ts` round-trip 의무.
- Vendor token storage (변경 0, vendor 의 storage 그대로 사용):
  - Google: `~/.gemini/oauth_creds.json` (read by wikey, write-back on refresh — refresh_token rotation 보존, I17)
  - OpenAI: `~/.codex/auth.json` (read + write-back, `tokens.{access_token,refresh_token,id_token,account_id}` rotation 보존)
  - Anthropic: macOS Keychain `Claude Code-credentials` (read via `security find-generic-password -a $USER -w -s ...`, write via `security add-generic-password -U` — `claudeAiOauth.{accessToken,refreshToken,expiresAt}` rotation 보존)
- LLM call inputs (`LLMCallOptions` 기존 type 재사용):
  - `provider: 'gemini' | 'anthropic' | 'openai'`
  - `model: string` (e.g. `'gemini-2.5-flash'`, `'claude-sonnet-4-5'`, `'gpt-5.5'`)
  - `prompt: string` (또는 첫 인자)
  - `opts.timeout?: number` (default 600s, AC-S12 §5.6.4 mirror)
  - `opts.signal?: AbortSignal`
  - `opts.temperature?: number` / `opts.seed?: number` / `opts.maxTokens?: number` / `opts.responseMimeType?: 'application/json' | 'text/plain'` / `opts.jsonMode?: boolean` / `opts.thinkingBudget?: number` — REST option matrix §1.3.1 적용

### 1.3.1 REST option matrix (codex F4 fix v0.2)

LLMCallOptions 6 field × 3 vendor × REST path 처리 방침. CLI subscription `provider-cli-options.ts` matrix 와 일관.

| Option | Google REST | OpenAI REST | Anthropic REST |
|--------|-------------|-------------|----------------|
| `temperature` | `request.generationConfig.temperature` | body `temperature` | body `temperature` |
| `seed` | `request.generationConfig.seed` | body `seed` | unsupported (silent ignore + debug log) |
| `maxTokens` | `request.generationConfig.maxOutputTokens` | body `max_output_tokens` | body `max_tokens` (default 1024) |
| `responseMimeType` | `request.generationConfig.responseMimeType` | (no equivalent — silent ignore) | (no equivalent — silent ignore) |
| `jsonMode` | `request.generationConfig.responseMimeType = 'application/json'` (native) | body `text.format = 'json_object'` (native) | **unsupported** → throw `SubscriptionFallbackError('jsonMode-unsupported')` (§5.6.4 v0.7 R2 mirror) |
| `thinkingBudget` | `request.generationConfig.thinkingBudget` | (unsupported, silent ignore) | (unsupported, silent ignore) |

unsupported field 의 `silent ignore` 는 debug log 만, throw X (caller 가 jsonMode 외 옵션 사용 시 graceful degradation). jsonMode 만 throw — §5.6.4 v0.7 의 fallback path 와 일관.

### 1.3.2 `defaultModeForApprovalState` (codex F1-A fix v0.3)

Step A0 4-state 결정 → vendor 별 default `subscriptionMode` 단일 함수. wikey-core/src/auth-resolver.ts 안 const map.

| A0 state | gemini default | anthropic default | openai default |
|----------|---------------|-------------------|----------------|
| `pending` (A0 미실행) | `'pending'` | `'pending'` | `'pending'` |
| `APPROVED_EXPERIMENTAL` | `'rest'` | `'rest'` | `'rest'` |
| `APPROVED_LOCAL_ONLY` | `'rest'` | `'rest'` | `'rest'` (README disclaimer 의무) |
| `APPROVED_PARTIAL` | (사용자 명시 vendor 별 결정 — Step A0 sub-state) | 동 | 동 |
| `REJECTED` | (본 plan 폐기, default 미정 — option B fallback) | 동 | 동 |

`'pending'` 처리:
- `resolveSubscriptionMode` 가 `'pending'` 만나면 throw `SubscriptionFallbackError('mode-pending', 'Step A0 Legal Gate not yet decided — please review docs/planning/phase-5/phase-5-spec-5.6.6-subscription-rest.md §0.5')`
- `llm-client.ts` 가 `'pending'` 시 cli path fallback (사용자 차단 회피, graceful degradation) — Notice "Subscription Mode pending — using CLI mode until §5.6.6 Step A0 decision"

### 1.4 Outputs

- LLM 답변 text (string) — vendor response 에서 추출:
  - Google: `data.response.candidates[0].content.parts[].text` join
  - OpenAI: SSE `response.output_text.delta` collect → join (event-level, codex F7 mirror — request body 안 `tools` 0건 확증)
  - Anthropic: `data.content[].text` filter type=`text` join
- side effects:
  - vendor token storage refresh (만료 임박 시) — Google file write / OpenAI file write / Anthropic Keychain `add-generic-password -U`. **rotation 보존 의무 I17 mirror** (codex F8 fix v0.2) — refresh response 의 새 `refresh_token` / `id_token` / 알 수 없는 추가 field 모두 round-trip 보존. atomic write (tmp + rename for file, single `add-generic-password -U` for Keychain).
  - 사용자 Notice (failure modes only): re-login 필요 / quota / spawn fail equivalent / endpoint hash drift (AC-S24)
  - debug log (stderr / console.warn): latency / usage / token expiry status (값은 X — token 본문 노출 0)
  - request body / response stream metadata (transport-level): wikey 가 vendor 에 send 한 body 의 `tools` field 부재 + response stream 의 `tool_use` event 부재. 측정 (AC-S13/S18 의 일부) — production 시 노출 X (test 만).

### 1.5 Acceptance Scenarios

#### 1.5.0 AC ↔ Test mapping (codex F5 fix v0.2)

| AC | 핵심 | 매핑 test (todox §X) | 1차 책임 |
|----|------|---------------------|----------|
| AC-S1 | Google rest happy | T-B1 (mock fetch) + AC-S21 부분 | Step B |
| AC-S2 | OpenAI rest SSE happy | T-C1 + T-C2 | Step C |
| AC-S3 | Anthropic rest happy | T-D1 | Step D |
| AC-S4 | Google project resolve cache | T-B2 | Step B |
| AC-S5 | Google token refresh + write-back | T-B3 + T-B7 (rotation) | Step B |
| AC-S6 | OpenAI 401 force refresh + retry | T-C3 + T-C4 + T-C7 (rotation) | Step C |
| AC-S6b | Google 401-twice → re-login (codex F5 v0.3 누락 보강) | T-B10 | Step B |
| AC-S6c | Anthropic 401-twice → re-login (codex F5 v0.3 누락 보강) | T-D14 | Step D |
| AC-S7 | Anthropic Keychain refresh + write-back | T-D2 + T-D8 (rotation) | Step D |
| AC-S8 | refresh failed → re-login Notice (shared) | T-A8 | Step A |
| AC-S9 | Google 429 즉시 fail | T-B4 | Step B |
| AC-S10 | Anthropic 429 즉시 fail (codex F5 누락 보강) | T-D9 | Step D |
| AC-S10b | OpenAI 429 즉시 fail | T-C5 | Step C |
| AC-S11 | 5xx → server-error throw | T-A5 (shared classifyHTTPFailure) | Step A |
| AC-S12-shared | timeout (600s) AbortController shared helper | T-A9 | Step A |
| AC-S12-google | Google timeout (codex F5 v0.3 누락 보강) | T-B9 | Step B |
| AC-S12-openai | OpenAI SSE timeout (codex F5 v0.3 누락 보강) | T-C11 | Step C |
| AC-S12-anthropic | Anthropic timeout (codex F5 v0.3 누락 보강) | T-D13 | Step D |
| AC-S13 | tool use 0 (transport-level, codex F7 정정) | T-B5/T-C6b/T-D6 — request body grep `tools` 0건 | Step B/C/D |
| AC-S14 | API key 접근 0 | T-B6/T-C8/T-D10 — `process.env.*_API_KEY` spy | Step B/C/D |
| AC-S15 | subscription tier (낮춤, vendor 응답 필드만 — codex F5 fix) | T-B8/T-C9/T-D11 — usage 필드 존재 + tier 식별자 | Step B/C/D |
| AC-S16 | `subscriptionMode='cli'` 회귀 | T-E1/T-E2 — 기존 cli-spawn.ts 호출 spy | Step E |
| AC-S17 | API mode unchanged (codex F5 누락 보강) | T-E6 — `authMode='api'` 시 기존 callXxxApi 호출 spy + 새 코드 분기 미진입 | Step E |
| AC-S18 | master CDP smoke 3 vendor live (state-aware, codex F1-B v0.3) | Step G — A0 state 별 분기 (approved vendor REST smoke / rejected vendor CLI regression) | Step G |
| AC-S19-anthropic | token 값 노출 0 (Anthropic strict) | T-D7 + T-D15 | Step D |
| AC-S19-google | token 값 노출 0 (Google) | T-B11 (codex F5 v0.3 누락 보강) | Step B |
| AC-S19-openai | token 값 노출 0 (OpenAI) | T-C12 (codex F5 v0.3 누락 보강) | Step C |
| AC-S20 | per-provider 혼합 (rest + cli) | T-E4 — 1 vendor cli + 2 vendor rest | Step E |
| AC-S21 | latency SLO p95 < 5초 (N=10, codex F7 강등, state-aware) | Step G — A0 approved vendor 만 측정 | Step G |
| AC-S22 | refresh response rotation (codex F8 신설) | T-B7/T-C7/T-D8 — refresh response 의 새 refresh_token / id_token storage write-back round-trip | Step B/C/D |
| AC-S23-gemini | kill-switch gemini env (codex F2/F5 v0.3 분리) | T-E7a | Step E |
| AC-S23-anthropic | kill-switch anthropic env | T-E7b | Step E |
| AC-S23-openai | kill-switch openai env | T-E7c | Step E |
| AC-S23-ui | Settings UI dropdown 'cli' 즉시 효과 | Step F T-F4 | Step F |
| AC-S24 | endpoint hash drift (codex F6 신설) | T-A10 — `subscription-rest-version-guard.ts` 가 vendor CLI bundle endpoint hash mismatch detect → Notice | Step A |
| AC-S25 | LLMCallOptions pass-through (codex F4 v0.3) | T-E11 — temperature/maxTokens/seed/jsonMode/responseMimeType/thinkingBudget × 3 vendor body 매핑 spy | Step E |

**총 25 AC** (codex F5 fix v0.4 — AC-S25 신규 추가 후 stale 정정) × 약 60 test case (vendor 별 ~12 + shared ~10 + UI/integration ~5 + Step G manual smoke). Step A~G 모든 step 의 RED 단계에서 본 매핑표 cross-check.

**Step F 의 `T-F4`** (codex F5 fix v0.4 — todox Step F 정의 의무): Settings UI dropdown 'cli' 선택 시 즉시 효과 — settings save → 다음 LLM 호출 시 cli path 사용. mock plugin.saveSettings spy + 즉시 setting 효과 확증. **Step G 는 manual smoke** (단위 test ID 부재) — A0 state-aware 분기 절차 (todox §7.2).

**Happy path**:
- **(AC-S1)** Google subscription + REST mode → "What is 2+2?" → 답변 "4" (또는 정상 markdown) 반환. latency < 5초. response.usage 기록 확인.
- **(AC-S2)** OpenAI subscription + REST mode → SSE stream 정상 collect → text 반환. ttfb < 2초, total < 5초.
- **(AC-S3)** Anthropic subscription + REST mode → Keychain access OK → text 반환. latency < 5초.
- **(AC-S4)** Google project resolve cache — 첫 호출 `loadCodeAssist` (550ms 추정) → 두 번째 호출 cache hit (skip), `generateContent` 만 (1-2s).

**Token refresh**:
- **(AC-S5)** Google token 만료 임박 (60s 미만) → 자동 refresh → 호출 성공. file `~/.gemini/oauth_creds.json` write-back 확증.
- **(AC-S6)** OpenAI 401 (token expired) → force refresh + retry → 성공. `~/.codex/auth.json` `tokens.access_token` 갱신.
- **(AC-S7)** Anthropic Keychain entry 만료 → refresh + Keychain `add-generic-password -U` write-back → 호출 성공.
- **(AC-S8)** refresh 자체 실패 (refresh_token invalid 또는 401) → re-login Notice + throw `SubscriptionFallbackError('auth-missing')`. 무한 retry 0건.

**Failure modes**:
- **(AC-S9)** Google 429 (RESOURCE_EXHAUSTED) → 즉시 fail (no retry). throw `SubscriptionFallbackError('quota-exceeded')`. Notice "Google subscription quota reached — switch Auth Mode to API Key if desired".
- **(AC-S10)** Anthropic 429 → 동일 즉시 fail. throw `SubscriptionFallbackError('quota-exceeded')`. Notice 동일 패턴 (Anthropic 라벨로). **vendor client level test 의무** (codex F5 fix v0.2 — 이전 누락).
- **(AC-S10b)** OpenAI 429 → 동일 즉시 fail.
- **(AC-S11)** 5xx → throw `SubscriptionFallbackError('server-error')`. backoff retry 0건. shared `classifyHTTPFailure` (Step A) 가 단일 source.
- **(AC-S12)** timeout (default 600s) — 네트워크 응답 없음 → AbortController + `SubscriptionFallbackError('timeout')`. 기존 §5.6.4 AC-S12 mirror. **명시 test 의무** (codex F5 fix v0.2 — 이전 누락) — `T-A9` (shared timeout helper) + 각 vendor T-B/C/D 안 timeout case.

**Tool bypass**:
- **(AC-S13)** **schema field / event 검증만** (codex F7 정정 v0.3 → v0.4 raw substring grep 금지 명시) — wikey 가 vendor 에 send 한 request body **JSON 의 schema field key** (`body.tools` / `body.tool_config` / `body.function_declarations` / `body.request.tools`) 부재 검증. response stream **event type field** (`event.type === 'tool_use'` / `event.type === 'function_call'`) 부재 검증. **raw substring text grep 금지** (예: `JSON.stringify(body).includes('tools')` 금지 — `body.instructions` 같은 자연어 텍스트가 'tools' 단어 포함 시 false hit). **사용자 답변 본문 (자연어 markdown) grep 금지**. 검증 = `Object.keys(body).includes('tools') === false` + `events.find(e => e.type === 'tool_use') === undefined` 형식.

**Subscription quota**:
- **(AC-S14)** wikey 코드 모든 REST path 에서 `process.env.{GEMINI,ANTHROPIC,OPENAI}_API_KEY` 접근 0건. grep audit + `Object.defineProperty` spy.
- **(AC-S15)** vendor 응답 안 `usage` 필드 존재 + tier 식별자 readable (codex F5 낮춤 v0.2 — vendor 별 응답 필드 그대로 검증, "subscription vs API tier 차이" 추론 X). 예: Anthropic `service_tier`, Google `usageMetadata`, OpenAI `usage`.

**회귀**:
- **(AC-S16)** `subscriptionMode = 'cli'` 명시 선택 시 §5.6.4 cli-spawn.ts 경로 그대로. wikey-core 1184 / wikey-obsidian 224 기존 test 모두 PASS.
- **(AC-S17)** API mode (`authMode = 'api'`) 변경 0 — 기존 HTTPS API 호출 (`callGeminiApi` / `callAnthropicApi` / `callOpenAIApi`) 그대로. **명시 test 의무** (codex F5 fix v0.2 — 이전 누락) — `T-E6` `authMode='api'` 시 새 RESTClient 진입 0건 + 기존 callXxxApi spy 호출 1회 검증.

**라이브**:
- **(AC-S18)** master CDP smoke 3 vendor — chat 패널 각 vendor 로 'pms' 질문 → 정상 답변 (rest path) + Referenced footer 정상. **transport-level (request body / response stream) 검증** = console buffer `Tool` / `read_file` / agentic 흔적 grep — 단 자연어 답변 본문 grep 폐기 (사용자가 'tool' 단어 묻기 시 false fail, codex F7 fix v0.2). 검증 = wikey 가 vendor 에 send 한 request body + 받은 response stream event-level grep.
- **(AC-S21)** **latency SLO** (codex F7 fix v0.2 → state-aware v0.5) — **N=10 동일 prompt × approved vendor 만**. A0 결과 분기:
  - `APPROVED_EXPERIMENTAL` / `APPROVED_LOCAL_ONLY` → 3 vendor × 10 = 30 measurements
  - `APPROVED_PARTIAL` → approved vendor 만 (예: 2 vendor × 10 = 20)
  - `REJECTED` → AC 자체 미적용 (plan 폐기)
  - p95 < 5초 (정상시 모집단). master CDP smoke (Step G) 의 sub-task. throttle / network failure 발생 시 외부 원인 격리 후 재측정.

**보안**:
- **(AC-S19)** token 값 conversation/log/Notice 노출 0건. test 의 `console.log` mock 으로 검증 — 응답 stderr 에 길이 / expiry 만, accessToken 본문 0.

**per-provider toggle**:
- **(AC-S20)** Google rest + Anthropic cli 혼합 설정 → 각각 자기 path 사용. 라이브 smoke 두 vendor 모두 정상.

**Refresh rotation** (codex F8 fix v0.2):
- **(AC-S22)** vendor refresh response 가 새 `refresh_token` (회전) 또는 `id_token` 회전 시 wikey 가 storage write-back 보존. unknown field 도 round-trip 보존 (`{...existing, ...refreshed}` shallow merge). 다음 호출 시 새 refresh_token 사용 → 두 번째 refresh 도 정상.

**Kill-switch** (codex F2/F5 fix v0.2 → 3 vendor 일관 v0.3):
- **(AC-S23)** **3 vendor env 모두 명시** — `WIKEY_GEMINI_REST_DISABLE=1` / `WIKEY_ANTHROPIC_REST_DISABLE=1` / `WIKEY_OPENAI_REST_DISABLE=1` 각각 독립 작동. 각 env 가 set 시 해당 vendor `subscriptionMode='rest'` 무시 + 강제 cli path. Settings UI dropdown 'cli' 선택도 동일 효과. **vendor 별 독립 disable test 의무** — Step E T-E7a (gemini env) / T-E7b (anthropic env) / T-E7c (openai env) 분리.

**Endpoint hash drift** (codex F6 fix v0.2):
- **(AC-S24)** `subscription-rest-version-guard.ts` (Step A) 가 vendor CLI bundle 내 endpoint URL string sha256 hash 를 plan 의 baseline 과 비교 → mismatch detect 시 Notice "Vendor CLI updated — REST path may break, please report. Fallback to CLI mode recommended". guard 자체 import 는 1회 (process start), 실패 시 graceful (Notice 만, throw X — production 회귀 0).

**LLMCallOptions pass-through** (codex F4 fix v0.3 → 본문 명시 v0.6):
- **(AC-S25)** `LLMClient.call` 호출 시 `LLMCallOptions` 의 6 option 필드 (`temperature`, `seed`, `maxTokens`, `responseMimeType`, `jsonMode`, `thinkingBudget`) 가 vendor REST client 의 fetch body 에 정확하게 매핑 (§1.3.1 matrix 단일 source).
  - **Happy path**: gemini rest + `{temperature: 0.7, maxTokens: 2048, seed: 42, jsonMode: true}` 호출 → fetch body 안 `request.generationConfig.temperature === 0.7` / `.maxOutputTokens === 2048` / `.seed === 42` / `.responseMimeType === 'application/json'` 모두 확증.
  - **OpenAI mapping**: openai rest + `{temperature: 0.5, maxTokens: 1024, jsonMode: true}` 호출 → body `temperature === 0.5` / `max_output_tokens === 1024` / `text.format === 'json_object'` 확증.
  - **Anthropic jsonMode throw**: anthropic rest + `{jsonMode: true}` 호출 → `SubscriptionFallbackError('jsonMode-unsupported')` throw (§5.6.4 v0.7 R2 mirror, Anthropic Messages API 가 native json_object 미지원).
  - **silent ignore (graceful degradation)**: openai rest + `{thinkingBudget: 100, responseMimeType: 'text/plain'}` → body 에 미반영 (OpenAI matrix unsupported), throw 0건, debug log 1건.
  - **pass-through 측정 위치**: `LLMClient.call → callXxxSubscription → resolveSubscriptionMode === 'rest' → vendor RESTClient.call(prompt, model, opts) → mapOptionsToRESTOptions(vendor, opts) → fetch body`. 6 option × 3 vendor = 18 case (단 Anthropic jsonMode = throw case).

### 1.6 Out-of-Scope

- 새 vendor 추가 (xAI / Mistral / Cohere)
- streaming UI (progressive render)
- vendor catalog dynamic discovery
- benchmark 자동화
- `~/.gemini/oauth_creds.json` 외 vendor file 위치 사용자 override (default path 만)
- macOS 외 OS Keychain (Anthropic) — Linux Secret Service / Windows Credential Manager 는 별 cycle. macOS 만 (사용자 환경)
- gemini CLI / claude CLI / codex CLI 자체 폐기
- token rotation policy (vendor 가 정함, wikey 는 read + write-back 만)

### 1.7 Dependencies

- Node 18+ 글로벌 fetch (이미 wikey-core 의존)
- Node 18+ 글로벌 crypto (`randomUUID()` for `user_prompt_id`)
- macOS `security` CLI (Anthropic Keychain access — `child_process.execSync`). **macOS 외 OS = R10 — Anthropic vendor client throw + Settings 자동 cli fallback** (codex F2/F6 mirror v0.2)
- vendor 사전 sign-in 완료 (gemini login / claude login / codex login)
- **spike script 보존 path** (codex F6 fix v0.2 → 이름 정정 v0.4) — Session 44 휘발 path `/tmp/poc-{cloudcode,codex,anthropic}.mjs` → **canonical** `docs/spikes/phase-5/5.6.6/poc-{google,openai,anthropic}.mjs` 보존 (Step A0 통과 직후 mv + git add — vendor 명 통일: cloudcode→google, codex→openai). reference 가 plan 진입 시 wikey-core/src/{vendor}-rest-client.ts 의 직접 reference. **`docs/spikes/phase-5/5.6.6/SPIKE.md` 안 endpoint URL string + sha256 baseline 기록** — version-guard.ts 의 baseline source.
- vendor EULA / ToS 검토 — **Step A0 Legal/Terms Gate (BLOCKING, codex F1 fix v0.2)** — 사용자 explicit 결정 후 spec/todox 의 `이력` 에 결과 mirror.
- vendor CLI bundle 위치 (version-guard.ts 의 hash source):
  - Google: `/Users/denny/.nvm/versions/node/v22.17.0/lib/node_modules/@google/gemini-cli/bundle/chunk-UN6XCVMJ.js` (line 272378 endpoint string + line 245247 client_id)
  - OpenAI: `/Users/denny/.nvm/versions/node/v22.17.0/lib/node_modules/@openai/codex/node_modules/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/codex/codex` (Mach-O binary, strings extract)
  - Anthropic: `/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/cli.js` (line 245247 client_id 인접 영역)
- `~/.gemini/oauth_creds.json` schema = `{access_token, refresh_token, scope, token_type, id_token, expiry_date}` (PoC §1 검증, refresh response rotation 보존 의무 I17)
- `~/.codex/auth.json` schema = `{OPENAI_API_KEY?, last_refresh, tokens: {access_token, refresh_token, id_token, account_id}}` (PoC §O2 검증, rotation 보존)
- macOS Keychain `Claude Code-credentials` schema = `{claudeAiOauth: {accessToken, refreshToken, expiresAt(ms), scopes, subscriptionType, rateLimitTier}}` (PoC §A2 검증, rotation 보존)
- vendor refresh URL OAuth2 표준 endpoint:
  - Google: `https://oauth2.googleapis.com/token` (form-encoded)
  - OpenAI: `https://auth.openai.com/oauth/token` (form-encoded)
  - Anthropic: `https://console.anthropic.com/v1/oauth/token` (form-encoded)

---

## 2. Risks

| ID | 위험 | 평가 | 완화 |
|----|------|------|------|
| R1 | 비공개 endpoint spec 변경 (vendor CLI 업데이트로 깨짐) | **HIGH** (codex F2 상향 v0.2) | (a) CLI bundle endpoint string sha256 hash check `subscription-rest-version-guard.ts` (Step A) — process start 시 1회 비교 (b) master CDP smoke 분기점 정기 + Step G drift smoke (c) 깨질 시 즉시 `subscriptionMode = 'cli'` fallback Notice + I16 kill-switch (d) `docs/spikes/phase-5/5.6.6/SPIKE.md` 안 endpoint baseline + version 기록 |
| R2 | OAuth client_id 차용 (CLI bundle 추출) — vendor EULA/ToS 위반 가능성 | **HIGH** (codex F2 상향 v0.2) | **Step A0 Legal/Terms Gate (BLOCKING)** — 사용자 explicit 승인 + 결과 기록 (`APPROVED_EXPERIMENTAL` / `APPROVED_LOCAL_ONLY` / `APPROVED_PARTIAL` / `REJECTED`). 통과 후만 Step A~H 진행. 통과해도 README disclaimer 의무 (`APPROVED_LOCAL_ONLY` 시 강제). |
| R3 | macOS Keychain unlock prompt — 첫 호출 시 사용자 승인 | 낮 | Notice 사전 안내 (first-call) + `security` CLI 가 자동 처리. 자주 묻지 않게 `security -i` interactive 미사용. |
| R4 | OpenAI account_id 누락 시 호출 실패 | 낮 | `~/.codex/auth.json.tokens.account_id` 미존재 시 graceful fallback (header 생략) — PoC 검증 시 header 있어야 정상이지만 spec 명시. |
| R5 | Google project resolve 실패 (onboarding 안 된 사용자) | 낮 | `loadCodeAssist` response 의 `currentTier` / `cloudaicompanionProject` 부재 시 graceful Notice + cli fallback 권유. |
| R6 | refresh 동시 호출 race (다중 query 동시) | 중 | `Promise<TokenState>` cache (in-memory) — 동시 호출 시 단일 refresh promise share (`refreshIfNeededShared`, Step A). I17 mirror. test T-A11 race 검증. |
| R7 | token storage write 권한 (file write / Keychain add) — 사용자 환경 | 낮 | write 실패 시 throw + Notice "token storage write failed — re-login required". next call 은 동일 path 재시도. atomic write (tmp + rename, I17 mirror). |
| R8 | wikey CLI tests 와 obsidian renderer 의 fetch 차이 (Node vs Electron) | 낮 | Node 18+ fetch 와 Electron renderer fetch 동일 spec. PoC Node 검증 완료. master CDP smoke 가 Electron 검증. |
| R9 | **OpenAI private Codex backend coupling** (codex F2 신설 v0.2) | **HIGH** | `chatgpt.com/backend-api/codex/responses` 는 공식 `api.openai.com/v1/responses` Responses API 와 다른 ChatGPT subscription 전용 비공개 endpoint. (a) Step A0 Legal Gate 에서 OpenAI 분리 결정 가능 (`APPROVED_PARTIAL` 시 OpenAI 만 cli) (b) AC-S23 kill-switch — env `WIKEY_OPENAI_REST_DISABLE=1` 즉시 disable (c) Settings UI dropdown 'cli' 사용자 즉시 전환 (d) 깨질 시 fallback 의 cli path 도 codex CLI 의존 (사용자 환경) — 이중 안전망 0 → README 안 disclaimer 의무. |
| R10 | macOS Keychain 외 OS 미지원 (codex F finding 외, 사용자 환경 가정) | 중 | 본 cycle scope = macOS 만 (사용자 환경). Linux Secret Service / Windows Credential Manager 는 별 cycle. Anthropic vendor client = OS detect → macOS 외 throw "Anthropic REST mode requires macOS Keychain — please use cli mode" + Settings UI 자동 fallback to cli. |

---

## 3. Self_Check (analyst Self_Check 10항목 mirror)

> **본 spec 작성자 = master (사용자 명시 raise: "PoC 검증결과를 기반으로 master가 계획 수립")**. analyst Self_Check 10 항목을 master 가 직접 통과 시점 표시.

- (1) Goal 의 모든 verb 가 측정 가능 — ✅ "REST direct path 추가" / "Settings UI toggle" / "라이브 cycle smoke" 모두 검증 가능
- (2) Non-Goal 명시 — ✅ §1.1 Non-Goal 8 항목
- (3) Invariants 가 LOCK (변경 X 항목) — ✅ I1~I18 모두 변경 차단 표기 (codex X3 fix v0.6 — I15→I18 sweep)
- (4) Inputs / Outputs side effects 명시 — ✅ §1.3, §1.4
- (5) Acceptance Scenarios 가 1:1 test mapping 가능 — ✅ AC-S1~S25 + AC-S6b/S6c/S10b/S12-vendor/S19-vendor/S23-vendor (codex X3 fix v0.6 — S20→S25 sweep), todox §3 Test Spec 에서 1:1 매핑 완료
- (6) Out-of-Scope 가 분리되어 있음 — ✅ §1.6
- (7) Dependencies 외부 source 명시 — ✅ §1.7
- (8) Risks + 완화 — ✅ §2 R1~R10 (codex X3 fix v0.6 — R8→R10 sweep, R9 OpenAI private backend coupling + R10 macOS-only 추가)
- (9) wiki/raw/schema 영향 X — ✅ I2 보존, schema 변경 0
- (10) 사용자 explicit 승인 — ⏳ 본 spec 종결 후 Step A0 사용자 결정. codex Mode D Panel 검증 5 cycle 종결 + v0.6 잔여 5 fix 완료 시점.

---

## 4. PoC reference

**보존 path** (codex F6 fix v0.3, canonical reference) — Step A0 통과 직후 mv:

| spike file (canonical) | vendor | line / 함수 | wikey-core/src/{vendor}-rest-client.ts mapping |
|------------------------|--------|-------------|-------------------------------------------------|
| `docs/spikes/phase-5/5.6.6/poc-google.mjs` | Google | `loadCreds` `refreshTokenIfExpired` `callCodeAssist` `resolveProjectId` `generateContent` | `google-rest-client.ts` 의 동일 함수 5개 |
| `docs/spikes/phase-5/5.6.6/poc-openai.mjs` | OpenAI | `loadAuth` `refreshTokenViaRefreshGrant` `callResponses` (SSE parse) | `openai-rest-client.ts` 의 동일 함수 3개 + SSE helper |
| `docs/spikes/phase-5/5.6.6/poc-anthropic.mjs` | Anthropic | `loadFromKeychain` `saveToKeychain` `refreshAccessToken` `ensureFreshToken` `callMessages` | `anthropic-rest-client.ts` 의 동일 함수 5개 |

**Session 44 history** (휘발 path, mv 전): `/tmp/poc-cloudcode.mjs` `/tmp/poc-codex.mjs` `/tmp/poc-anthropic.mjs` — Step A0 통과 전 (Session 44 v0.5 작업 시) 미리 `docs/spikes/phase-5/5.6.6/` 로 mv 완료 (vendor 명 통일). 이후 spec/todox 의 모든 reference = canonical path.

3 spike file 합 ~360 LOC. wikey-core 통합 시 공통 helper (`subscription-rest-shared.ts` ~120 LOC + `subscription-rest-version-guard.ts` ~60 LOC) + vendor-specific (~150 LOC each) + integration (`llm-client.ts` ~150 LOC) + Settings UI (~80 LOC) = **~900 LOC + ~250 test LOC = ~1150 LOC** (codex X3 fix v0.6 — Regression LOW fix mirror, I12 동일). 실 작업 시 spike 의 paradigm 그대로 + wikey-core 의 typing / error class / settings binding / version-guard 추가.

---

## 5. 다음 단계

본 spec 종결 (master 1차 + codex Mode D Panel APPROVE) → todox `phase-5-todox-5.6.6-subscription-rest.md` 작성 (이미 `Step A~G` 분할 잠정 결정). 다음 세션 = RED → GREEN → BLUE 3a/3b 구현 cycle.
