---
phase: 5
section: 5.6.4
title: LLM Provider subscription auth — Google + Anthropic + OpenAI 통합 (Session 42, 2026-05-13~14)
status: done
created: 2026-05-14
tags: [provider-auth, subscription, byoai, google, anthropic, openai, done]
---

# Phase 5 §5.6.4 LLM Provider subscription auth — 활동 기록 (resultx)

> **상위 문서**: [`activity/phase-5/phase-5-result.md §5.6.4`](./phase-5-result.md)
>
> **상위 plan**: [`plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md`](../../plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md) v0.7
>
> **mirror todo**: [`plan/phase-5/phase-5-todo.md §5.6.4`](../../plan/phase-5/phase-5-todo.md)

## 1. Overview

§5.6.3.A → §5.6.4 리넘버링 후 진행. 3 provider (Google Gemini / Anthropic Claude / OpenAI Codex) 의 외부 CLI OAuth subscription path 를 wikey 통합. 사용자 Gemini Advanced / Claude Pro·Max / ChatGPT Plus·Pro 구독을 wikey 안에서 직접 사용 + API key 동시 등록 시 transparent fallback (auto mode, AC-S4).

**철학 정합** (Karpathy 4 원칙):
- **Explicit** — auth mode 가시화 (Settings 카드 영문 dropdown + status badge)
- **Yours** — OAuth token 외부 CLI 가 로컬 보관, wikey 안 token 0
- **File over app** — plain-text credentials.json + auth_mode JSON, 양방향 migration
- **BYOAI** — provider 선택 자유 확장 (기존 API key + 신규 subscription path)

## 2. 11 commit (push X — codex cycle #4 APPROVE + 사용자 사전 보고 후 진행)

| commit | hash | scope | 주요 변경 |
|--------|------|-------|----------|
| 1 | `e901b84` | Step A + Step B (Google) | provider 추상화 layer (`types.ts` AuthMode/SubscriptionProvider/AuthFallbackInfo + `auth-resolver.ts` + `cli-spawn.ts` + `cli-parser.ts` + `provider-cli-options.ts` 48-cell matrix) + Google Gemini subscription (gemini CLI + `~/.gemini/oauth_creds.json`) + 16 test |
| 2 | `f4cf417` | Step C (Anthropic) | Anthropic Claude subscription (`claude -p` CLI + Keychain — binary-only presence) + 16 test (mirror of gemini) |
| 3 | `14b53f4` | Step D (OpenAI) | OpenAI Codex subscription (`codex exec -` CLI + `~/.codex/auth.json` + marker-based parser) + 16 test + master 실측 golden fixture `plan/phase-5/fixtures/cycle-codex-golden/codex-ok-hi.{raw,clean}.txt` |
| 4 | `67c5e48` | Step E (통합) | BLUE 3b refactor `callWithFallback` 공통 helper extract (3 × `callXxxWithFallback` → 단일 site) + routing matrix 8 case smoke + 문서 동기화 + commit 1 staging gap 보정 (plan / fixtures / scripts) |
| 5 | `356a44f` | Settings UI + AuthMode polish | Settings UI provider-centric subsection (Gemini / Claude / OpenAI 각 카드) + AuthMode `'auto'` polish out → `'subscription'` migration + master CDP smoke 1차 fix 통합 |
| 6 | `35f777d` | codex cycle #2 6 finding fix + UI rename | F1 `resolveCliBinary` 단일 helper (env override + PATH + 정적 fallback + nvm glob) / F2 onAuthFallback Chat 경로 wiring (sidebar-chat + commands `/knowledge-gap` + query-pipeline) / F3 `save-credentials.test.ts` 4 case + pure helper extract / F4 baseConfig 3 AUTH_MODE 'api' / F5 §A0 PASS → Partial / F6 commit traceability gap 보정. UI heading `'API Keys'` → `'LLM Model Authentication'`. |
| 7 | `608ee14` | UI 통합 block + badge | 3 분리 Setting → 1 통합 `wikey-auth-block` (heading + Auth Mode + Subscription + API Key). signed-in (green) / not-detected (grey) badge + button 바로 앞. provider 간 24px margin. 4 helper 분해. 8 CSS rule. |
| 8 | `94340ea` | section heading right-align note | `'API keys are stored in ~/.config/wikey/credentials.json'` 문구를 LLM Model Authentication (h3) 행의 오른쪽 정렬 + deep grey + 13pt. flex space-between wrapper. |
| 9 | `8836ff9` | provider heading outside + right-align controls + plain badge | Provider 명 (h3) block 밖. section title 동일 크기 + font-weight:300 + accent color (`var(--interactive-accent)`). selectbox + button 우측 정렬 (justify-content: flex-end). badge 배경 없이 텍스트만. section title ↔ 첫 block 16px 여백. h3 selector specificity 강화 (Obsidian native 600 override). |
| 10 | `f19f313` | codex cycle #3 F1 — Notice 문구 | AuthMode 'auto' 폐기 후 Notice 문구 정정 — `'Switched to API key'` → `'<provider> subscription failed — switch Auth Mode to API Key if desired'` 계열 5 reason. `default-auth-fallback.test.ts` `not.toMatch(/Switched\|Using API key/)` assertion 보강. |
| 11 | `0bde7b7` | codex cycle #3 F2 — resultx 11 commit 갱신 | 본 §2 표 11 commit 갱신 + §2a commit 9 후 CDP smoke 결과 10 항목 PASS 표 추가. binary resolver 실효성 확증 (3 provider `signed-in` green). 최신 wikey-core 1093 / wikey-obsidian 215 PASS. |

### 2a. Commit 9 후 master CDP smoke 재실행 결과 (2026-05-14)

| 검증 항목 | 결과 |
|----------|------|
| Section h3 font-size | 15px |
| Section ↔ 첫 block margin-bottom | 16px ✅ |
| Provider heading (block 밖) | h3 × 3, font-size 15px / font-weight 300 / color `rgb(138, 92, 245)` accent ✅ |
| `h4 in block` 존재 여부 | false ✅ |
| Controls justify-content | `flex-end` (우측 정렬) ✅ |
| Badge background | `rgba(0, 0, 0, 0)` transparent ✅ |
| Badge padding | `0px` (텍스트만) ✅ |
| Badge color (signed-in) | `rgb(68, 207, 110)` green ✅ |
| 3 provider Subscription detection | signed-in × 3 (binary resolver `command -v` + nvm glob 작동) ✅ |
| 3 provider Button (signed-in 상태) | `Sign out` × 3 (conditional) ✅ |

## 3. Step E (본 cycle) 상세

### 3.1 BLUE 3b refactor — `callWithFallback` 공통 helper extract

**Before** (Step A + B + C + D 통합 시점 — 3 개의 거의 동일한 wrapper):

```typescript
// gemini
private async callGemini(prompt, opts) {
  const presence = this.checkGeminiPresence()
  const path = resolveAuthMode('gemini', this.config, presence)
  if (path !== 'subscription') return this.callGeminiApi(prompt, opts)
  return this.callGeminiWithFallback(prompt, opts, presence)
}
private async callGeminiWithFallback(prompt, opts, presence) {
  try { return await this.callGeminiSubscription(prompt, opts) }
  catch (err) {
    const reason = classifyFallbackReason(err)
    const mode = this.config.GEMINI_AUTH_MODE ?? 'auto'
    if (mode === 'auto' && presence.hasApiKey && reason !== null) {
      opts?.onAuthFallback?.({ provider: 'gemini', reason, originalError: err as Error })
      return this.callGeminiApi(prompt, opts)
    }
    throw err
  }
}
// 동일 패턴 × 3 (gemini + anthropic + openai), 총 ~42 LOC near-duplicate
```

**After** (단일 helper + 3 thin wrapper):

```typescript
// gemini (thin wrapper)
private async callGemini(prompt, opts) {
  return this.callWithFallback(
    'gemini',
    this.checkGeminiPresence(),
    this.config.GEMINI_AUTH_MODE,
    (p, o) => this.callGeminiSubscription(p, o),
    (p, o) => this.callGeminiApi(p, o),
    prompt,
    opts,
  )
}

// 공통 helper (invariant I1+I2+I3 검증을 한 site 으로 모음)
private async callWithFallback(
  provider: SubscriptionProvider,
  presence: CredentialPresence,
  authMode: AuthMode | undefined,
  subscriptionFn: (prompt: string, opts?: LLMCallOptions) => Promise<string>,
  apiFn: (prompt: string, opts?: LLMCallOptions) => Promise<string>,
  prompt: string,
  opts?: LLMCallOptions,
): Promise<string> {
  const path = resolveAuthMode(provider, this.config, presence)
  if (path !== 'subscription') return apiFn(prompt, opts)
  try { return await subscriptionFn(prompt, opts) }
  catch (err) {
    const reason = classifyFallbackReason(err)
    const mode = authMode ?? 'auto'
    if (mode === 'auto' && presence.hasApiKey && reason !== null) {
      opts?.onAuthFallback?.({ provider, reason, originalError: err as Error })
      return apiFn(prompt, opts)
    }
    throw err
  }
}
```

**효과**:
- **3 × `callXxxWithFallback` 메서드 (~14 LOC each = 42 LOC) → 0** (단일 `callWithFallback` 33 LOC 으로 substitution)
- invariant I1 (subscription-first) + I2 (transparent retry) + I3 (force-mode 제어) 검증이 **한 site 에서 가능**
- 기존 16 × 3 = **48 subscription test + auth-resolver 8 test + 기타 isolation case 모두 test 변경 0 으로 회귀 PASS** (1083 → 1091, +8 = routing matrix it.each 6 + named 2)

### 3.2 Routing matrix test (8 case)

`wikey-core/src/__tests__/llm-routing-matrix.test.ts` 신규. 본 cycle 의 *coexistence* invariant 를 pin down — 단일 LLMClient 가 3 provider 모두 subscription + API key 동시 carrying 시 각 provider 가 자기 AUTH_MODE 따라 독립 routing.

| # | case | 결과 |
|---|------|------|
| 1~3 | `auto` + both creds × {gemini, anthropic, openai} → subscription path (spawn=1 / HTTP=0) | PASS |
| 4~6 | `api` + both creds × {gemini, anthropic, openai} → API path (spawn=0 / HTTP=1) | PASS |
| 7 | AC-S7 — 3 providers all `auto` 동시 호출, 각자 subscription 독립 picking (3 spawn / 0 HTTP) | PASS |
| 8 | AC-S8 — gemini `api` + anthropic+openai `auto` → 격리 routing (2 spawn / 1 HTTP) | PASS |

### 3.3 회귀 종합

| 검증 | 결과 | baseline 대비 |
|------|------|---------------|
| wikey-core test | **1091 PASS / 3 skipped** (78 test files) | 1083 → 1091 (+8 routing matrix) |
| wikey-obsidian test | **209 PASS / 1 skipped** (25 test files) | 회귀 0 |
| wikey-core build | 0 errors | — |
| wikey-obsidian build | 0 new errors (kiwi-wasm pre-existing warning 5) | — |
| `./scripts/validate-wiki.sh` | PASS | — |
| I10 grep gate (core ↔ UI 결합 0) | `grep "from 'obsidian'" wikey-core/src/` 본문 = 0 (test 파일 anchor 만) | PASS |
| I5 grep gate (영문 UI) | settings-tab.ts Korean chars = code comment + variable name 만 (CLAUDE.md 예외 a) | PASS |

## 4. 12 AC line-by-line evidence

### 4.1 Routing scenarios (AC-S1~S8)

> **v0.7 'auto' 폐기 mirror (commit 5 / codex cycle #3 F1 commit 10)**: AuthMode = `'none' | 'subscription' | 'api'` (explicit). 자동 API retry 폐기. AC-S4 / S9 의 "fallback" = subscription 실패 → **Notice surface + 사용자 수동 Auth Mode 전환** (자동 retry 아님). 단 backward-compat: legacy `'auto'` 값 (v0.6 사용자) 은 4 entry point 에서 자동 `'subscription'` 으로 마이그레이션.

| AC | provider | 사용자 상태 | authMode | 기대 | evidence |
|----|----------|------------|----------|------|----------|
| S1 | Google | subscription only | `subscription` | gemini CLI spawn 호출 성공 / API 0 | `llm-subscription-gemini.test.ts` "AC-S1 subscription only" PASS + routing matrix case 1 PASS |
| S2 | Google | API key only | `api` | API path / spawn 0 | `llm-subscription-gemini.test.ts` "AC-S2 API only" PASS |
| S3 | Google | 둘 다 | `subscription` | subscription 호출 / API 0 (사용자 explicit 선택) | `llm-subscription-gemini.test.ts` "AC-S3 subscription mode" PASS + routing matrix case 1 PASS |
| S4 | Google | subscription + quota | `subscription` | subscription 401 detect → onAuthFallback Notice ("switch Auth Mode to API Key if desired") + **throw** (자동 retry 안 함) | `llm-subscription-gemini.test.ts` "AC-S4 quota Notice + throw" PASS + `default-auth-fallback.test.ts` `not.toMatch(/Switched\|Using API key/)` PASS |
| S5 | Anthropic | 4 case | — | claude CLI OAuth | `llm-subscription-anthropic.test.ts` 16 case PASS |
| S6 | OpenAI | 4 case | — | codex CLI exec OAuth | `llm-subscription-openai.test.ts` 16 case PASS |
| S7 | 3 provider 모두 등록 | 각 `subscription` | provider 별 독립 routing | routing matrix case 7 PASS (3 spawn / 0 HTTP) |
| S8 | gemini `api` / others `subscription` | mixed | provider 별 mode 격리 | routing matrix case 8 PASS (gemini API, others subscription) + 3 provider test "force-api" 각각 PASS |

### 4.2 Option preservation (AC-S9~S12)

| AC | condition | 기대 | evidence |
|----|-----------|------|----------|
| S9 | `jsonMode: true` + `subscription` mode | onAuthFallback Notice (reason `'jsonMode-unsupported'`) + **throw** (자동 API retry 안 함, 사용자가 mode 수동 전환) | 3 provider test "AC-S9 jsonMode unsupported" 각각 PASS |
| S10 | `model: <custom>` | spawn args 안 provider-specific model flag 포함 (`-m` / `--model` / `-m`) | 3 provider test "AC-S10 model option forwarded" 각각 PASS |
| S11 | `temperature` / `maxTokens` / `seed` / `thinkingBudget` | subscription path silent ignore | 3 provider test "AC-S11 silent ignore" 각각 PASS |
| S12 | `timeout` | spawn timeout 보존 (AbortController) | 3 provider test "AC-S12 spawn timeout" 각각 PASS |

## 5. I1~I11 invariants cross-check

| I | invariant | code site (확증) |
|---|-----------|-----------------|
| I1 | 구독형 우선 routing — `mode='subscription'` 시 subscription 시도 (commit 5 폐기 후 `'auto'` 진입 없음) | `llm-client.ts callWithFallback` — `resolveAuthMode` 결과 'subscription' 시 즉시 `subscriptionFn` 호출 (api 경로 진입 0) |
| I2 | **Notice surface + manual Auth Mode switch** (commit 5 `'auto'` 자동 retry 폐기, commit 10 Notice 문구 정정) | `llm-client.ts callWithFallback` catch block — subscription 실패 시 `opts.onAuthFallback({reason})` 호출 후 **throw** (자동 retry 안 함). 사용자가 Settings UI dropdown 에서 mode 수동 전환. |
| I3 | 사용자 explicit 제어 — `'none' \| 'subscription' \| 'api'` 명시 선택 | `auth-resolver.ts resolveAuthMode` 6-row truth table — fallback 안 함 (각 mode 실패 시 throw) |
| I4 | wiki 재생성 없음 | `git diff 6ead5fb..HEAD -- wiki/` = 0 (provider call path 만 변경) |
| I5 | 영문 UI | settings-tab.ts grep `[가-힣]` = comment / variable name 만 (CLAUDE.md 예외 a 허용) |
| I6 | credentials.json read 금지 | 본 cycle 내 `Read` tool credentials.json 호출 0건 (master) |
| I7 | subscription credential 단일 source | wikey-core/src 안 OAuth token storage 0 — `child_process.spawn` 위임만 |
| I8 | 하드코딩 금지 — binary path 동적 resolution (commit 6 fix) | `cli-binary-resolver.ts resolveCliBinary` — env override > `command -v` > 정적 fallback (`/opt/homebrew/bin`, `/usr/local/bin`, `/Applications/cmux.app/Contents/Resources/bin`) > nvm glob. memoize. commit 9 후 CDP smoke 실효성 확증. |
| I9 | LLMCallOptions 8 field 계약 보존 | `provider-cli-options.test.ts` 48-cell golden + AC-S10/S11/S12 evidence |
| I10 | core ↔ UI 결합 0 | `grep -rn "from 'obsidian'" wikey-core/src/` 본문 = 0 (test fixture anchor 만) |
| I11 | credentials migration round-trip | `wikey-obsidian/src/__tests__/save-credentials.test.ts` (commit 6 추가) — case 1 (v0.2 → v0.3 load + save 자동 auth 추가) / case 2 (v0.3 round-trip byte-identical) / case 3 (legacy 'auto' → 'subscription' migration) / case 4 (unknown user-added field `xaiApiKey` 보존) 4 PASS. `parseCredentialsPayload` / `serializeCredentialsPayload` pure helper 로 extract (테스트 격리). |

## 6. codex Mode D Panel plan cycle 9 학습

본 cycle (§5.6.4) plan 단계 codex Mode D Panel 검증을 v0.1 (초안) → v0.7 (수렴) 까지 9 cycle 진행 (`#1a` ~ `#1i`). 누적 finding 약 30+ (cycle 별 3~9 finding).

**대표 finding 패턴**:

| finding type | 예 | cycle | 영향 |
|--------------|-----|-------|------|
| **type 단언 hallucination** | "Provider type 존재" / "8 field × 6 column = 48 cell" | #1g G1 | shape 불일치 + cardinality 잘못 |
| **fixture evidence hallucination** | v0.6 가 4-segment + "tokens used:" footer evidence 로 인용한 log 가 separator 2개만 + footer 부재 | #1h H1 | parser 모델링 자체 wrong (separator paradigm → marker paradigm 정정) |
| **drift (mirror byte mismatch)** | canonical = `v0.3` / mirror = `v0.6` (또는 그 역) | #1c F7 / #1e F3 / #1g G3 / #1h H2 | commit prefix 인플레 / 사용자 review 모호 |
| **numeric drift** | "6 field × 3 × 2 = 36" → 실제 "8 × 3 × 2 = 48" | #1c F1 → #1e F1 | matrix 계약 검증 false-positive |
| **fail-open** | `check-cli-versions.sh` 가 drift silent skip → strict semver lock | #1f F5 | production silent regression 위험 |

**learning** (영구):
- **plan 단계 codex 검증 = 코드 단계 못지않게 finding 다발**. 짧은 plan 도 codex Mode D 1 cycle 의무.
- **master 실측 evidence 단일 source 의무** — 본 cycle 의 `plan/phase-5/fixtures/cycle-codex-golden/codex-ok-hi.{raw,clean}.txt` 가 그 표본. log 절단본 인용 금지 (#1h H1 학습).
- **commit prefix lock** — plan version 과 commit prefix 가 다르면 cycle 마다 codex 가 raise. 매 cycle 종결 시 grep gate.
- **9 cycle 수렴**: 사용자 시간 비용 ≠ 0 이지만 codex finding 의 false-positive 가 거의 없어 master fix loop 비용 < codex 누락 발견 비용.

## 7. master CDP smoke — A0 gate **PASS** (commit 9 후, 2026-05-14)

**A0 status (final, codex cycle #4 verdict 영역)**: **PASS** — vitest layer + CDP renderer-layer 양쪽 모두 통과.

| Layer | Status | Evidence |
|-------|--------|----------|
| **vitest layer** (spawn-smoke / cli-spawn / llm-subscription-* / cli-parser / provider-cli-options / save-credentials / build-config-auth-mode) | PASS | wikey-core 1093 PASS / wikey-obsidian 215 PASS (commit 11 시점 fresh re-run) |
| **renderer-layer (CDP)** | PASS | §2a 10 항목 모두 PASS (commit 9 후 master 직접 실측, 2026-05-14) — binary resolver 실효성 + UI layout (provider heading 밖 / controls 우측 / badge transparent / section margin) 모두 확증 |

**Smoke history**:
1. **commit 5 시점 1차 master CDP smoke** (2026-05-14): UI 렌더 PASS / `Subscription: not detected × 3` 회귀 발견 — binary path 하드코딩 (`/usr/local/bin/{gemini,claude,codex}`) → nvm 환경에서 detection fail (I8 invariant 위반).
2. **commit 6 F1 fix**: `resolveCliBinary` 단일 helper (env override + `command -v` + 정적 fallback + nvm glob + memoize) 도입.
3. **commit 9 후 2차 master CDP smoke**: 3 provider 모두 `signed-in` (green badge) 확증 + UI layout 10 항목 PASS (§2a 표). **A0 gate 최종 PASS**.

**확인된 UI 동작** (commit 9 후 실측):
- `LLM Model Authentication` 섹션 heading + storage note (13pt deep grey, 오른쪽 정렬)
- 3 provider heading (h3 외, 15px / weight 300 / accent color `rgb(138, 92, 245)`)
- 각 통합 block: Auth Mode dropdown (None/Subscription/API Key, default subscription) + Subscription row (badge `signed-in` transparent background + `Sign out` 버튼) + API Key row (password input + Test 버튼) — controls 우측 정렬
- Section title ↔ 첫 block 16px 여백 / provider 간 8px margin

**Manual user flow** (real OAuth — 사용자 운용 영역):
- Sign in 클릭 → Modal "Run 'X login' in terminal" 가이드 → 사용자 terminal OAuth 완료 → reload Obsidian → badge `signed-in` (green) + button `Sign out`
- Chat panel query → spawn 호출 → 응답 + (실패 시) onAuthFallback Notice "subscription failed — switch Auth Mode to API Key if desired" (commit 10 F1 fix 양식)
- force-api (사용자가 dropdown 'API Key' 선택) → API path 호출
- Cross-provider isolation: 3 provider 독립 mode 선택 가능 (auto 폐기 — 모두 explicit)

## 7a. Commit traceability (codex cycle #2 F6 fix, LOW)

`e901b84` (commit 1) message 본문이 plan / fixtures / scripts 4 항목을 언급했으나 실제 staging 은 `67c5e48` (commit 4) 에 포함됨. history 보전 위해 commit message 수정 안 함. 본 traceability gap 인지 + 보정 항목 명시:

- plan 갱신: commit 4 staging 포함 (`plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md` v0.7)
- fixtures: commit 4 staging 포함 (`plan/phase-5/fixtures/cycle-codex-golden/codex-ok-hi.{raw,clean}.txt`)
- scripts: commit 4 staging 포함 (`scripts/check-cli-versions.sh`)

→ 4 항목 모두 master 작업 영역 안 + push 안 된 상태. commit 6 까지 누적 staging 정합 보정 완료.

## 7b. Commit 6 — codex cycle #2 6 finding fix

| finding | severity | 위치 | fix |
|---------|----------|------|-----|
| F1 | HIGH | I8 위반 — binary path 하드코딩 | `wikey-core/src/cli-spawn.ts` 의 `resolveCliBinary(provider)` 단일 helper + env override (`WIKEY_<P>_CLI_PATH`) > `command -v` > 정적 fallback (`/opt/homebrew/bin`, `/usr/local/bin`, `/Applications/cmux.app/Contents/Resources/bin`, `~/.nvm/versions/node/*/bin/`) + memoize. `CLI_DEFAULT_BINARY` 는 lazy getter 로 resolver 호출. `settings-tab.ts` 의 3 `detectXxxSubscription` 도 동일 resolver 사용 (commit 5 부분 적용, commit 6 확증). |
| F2 | MED | onAuthFallback Chat 경로 누락 — AC-S4 UI Notice gap | `query-pipeline.ts` `QueryOptions.onAuthFallback` 추가 + 2 `llm.call` site forward (`Step 3/4 fallback` + `Step 4/4 synthesis`). `sidebar-chat.ts` primary Chat path 가 `buildDefaultAuthFallback(new Notice)` 주입. `commands.ts` `/knowledge-gap` 명령도 동일 주입 (clusterer + summary 2 site). |
| F3 | MED | credentials migration test gap | `wikey-obsidian/src/__tests__/save-credentials.test.ts` 4 case (위 §I11). `parseCredentialsPayload` + `serializeCredentialsPayload` pure helper extract (main.ts). |
| F4 | MED | R3 test isolation — legacy llm-client.test.ts API path | `baseConfig` 안 `GEMINI_AUTH_MODE: 'api'` / `ANTHROPIC_AUTH_MODE: 'api'` / `OPENAI_AUTH_MODE: 'api'` 명시 (commit 5 적용, commit 6 확증). |
| F5 | MED | A0 / CDP gate 판정 부적정 | §7 status `PASS` → `Partial — vitest PASS / renderer-layer pending`. commit 6 F1 fix 후 master CDP smoke 가 최종 gate. |
| F6 | LOW | commit traceability gap | §7a 항목 추가. history 수정 X. |

**UI rename (사용자 명시 2026-05-14)**: settings-tab.ts `renderApiKeysSection` 의 `'API Keys'` heading → `'LLM Model Authentication'`. 영문 LOCK 준수.

## 8. Phase 5 진행 상태

본 §5.6.4 종결 후 Phase 5 잔여:

- §5.5 Knowledge Graph / 시각화 (P3, 미착수)
- §5.6 성능 · 엔진 확장 나머지 (P3, 미착수 — §5.6.4 LLM Provider auth 는 별 scope)
- §5.8 Phase 4 D.0.l 이관 잔여 (P4, 부분)
- §5.9 Variance Diagnostic (P4, 미착수)
- §5.20 Knowledge Gap management (P2, v0.6 종결 — Session 41)

→ 총 잔여 4~5 subject (사용자 우선순위 결정 영역).
