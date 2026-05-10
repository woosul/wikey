---
phase: 5
section: 5.7.9
title: §5.7.9 gemini-2.5 thinking budget compatibility + Spec I8 latency 정의 명확화
created: 2026-05-10
updated: 2026-05-10
status: draft
version: v1.0
---

# Phase 5 §5.7.9 — gemini-2.5 thinking 호환 + Spec I8 정의

> **상위 문서**:
> - [`plan/plan-full.md`](../plan-full.md) §5.7.9 (Phase 5 잔여 항목)
> - [`plan/phase-5/phase-5-spec-5.7.8-llm-dynamic-stopword.md`](./phase-5-spec-5.7.8-llm-dynamic-stopword.md) v1.4 (선행 paradigm)
> - [`activity/phase-5/phase-5-resultx-5.7.8-query-comparison-scenario-2026-05-10.md`](../../activity/phase-5/phase-5-resultx-5.7.8-query-comparison-scenario-2026-05-10.md) v1.1 (라이브 측정 → §5.7.9 candidate 도출 source)
>
> **트리거**: 2026-05-10 master 직접 라이브 비교 (10 query × 3 mode) 결과:
> - PASS-A 7/10 (gemini-2.5-flash thinking 모드가 default `maxTokens=500` 소진 → 응답 40 chars 절단 → filter `'llm-fail'` fallback)
> - PASS-C 정의 모호 (분석 LLM only vs 답변 LLM 포함)
>
> **합본 spec** (testing.md §3 mid-sized: 1 phase + 영향 < 5 파일 + invariant 2 + AC 5).

## 1. Goal (WHAT)

§5.7.8 paradigm 의 라이브 환경 작동을 *gemini-2.5 시리즈와 호환* 시키고, *Spec I8 latency 측정 범위* 를 명확히 정의한다.

### 1.1 Out of Scope

- §5.7.9 candidate #3 (vault hygiene 한↔영 alias 통합) — 별 cycle.
- §5.7.9 candidate #4 (HyDE false positive 회피) — 별 cycle.
- §5.7.9 candidate #5 (답변 LLM citation 우선순위) — 별 cycle.
- 다른 thinking-capable model (Anthropic extended thinking 등) 지원 — gemini-2.5 만 본 cycle.
- maxTokens default 변경 — 본 cycle 은 thinking off 만. default 500 유지.

## 2. Inputs

- 호출 site: `LLMClient.call(prompt, opts)` — `opts.thinkingBudget` (number, optional).
- caller (advanced query tuning): `buildFilterCallOptionsFromSettings(settings, config)` 결과 안 `thinkingBudget: 0` 명시.
- LLM provider: gemini-2.5-flash / gemini-2.5-pro (thinking 모드 default 활성). 다른 provider (anthropic / openai / ollama) 는 `thinkingBudget` 옵션 무시.

## 3. Outputs

- `callGemini` 의 generationConfig payload 안 `thinkingConfig: { thinkingBudget: <value> }` 명시 (caller 가 지정 시).
- advanced query tuning 4 layer (filter / rewriter / expander / analyzer) 모두 thinkingBudget=0 으로 호출 → gemini-2.5 thinking off → maxTokens=500 안 짧은 JSON 응답 fit.
- Spec 5.7.8 v1.5 — I8 정의 = "filter / rewriter / expander 분석 LLM 호출 only latency p95 ≤ 1500ms. 답변 LLM (chat synthesis) 은 본 invariant 적용 X — 별 측정".

## 4. Invariants

- **I1** (gemini thinking opt-out): caller 가 `thinkingBudget: 0` 명시 시 callGemini 의 generationConfig 에 정확히 `thinkingConfig: { thinkingBudget: 0 }` 직렬화. caller 가 미명시 (`undefined`) 시 generationConfig 안 thinkingConfig key 자체 X (gemini default 동작 보존 — 다른 use case 영향 0).
- **I2** (advanced query tuning default): `buildFilterCallOptionsFromSettings` 가 항상 `thinkingBudget: 0` 명시. 사용자 setting 에 별 토글 X (Karpathy #2 simplicity — wikey 의 advanced tuning 4 layer 가 결정적 짧은 JSON output, thinking 무용).
- **I3** (other provider neutral): `callAnthropic` / `callOpenAI` / `callOllama` 는 `thinkingBudget` 옵션 무시 — payload 안 미포함. type signature 만 추가 (interface) + runtime 영향 0.
- **I4** (Spec I8 명확화): Spec 5.7.8 v1.5 안 I8 본문 = "filter / rewriter / expander LLM 호출 only latency p95 ≤ 1500ms. 답변 LLM 별 측정". 변경 이력 row + footer cycle # 일관.

## 5. Acceptance Scenarios

| AC | scenario | expected |
|----|----------|----------|
| **AC-1** | `callGemini(prompt, { thinkingBudget: 0, maxTokens: 500 })` 호출 시 HTTP body 안 `generationConfig.thinkingConfig.thinkingBudget === 0` | payload assertion (HttpClient mock) |
| **AC-2** | `callGemini(prompt, {})` (옵션 미명시) 호출 시 HTTP body 안 `generationConfig.thinkingConfig` key 부재 | payload assertion |
| **AC-3** | `buildFilterCallOptionsFromSettings(settings, config)` 결과 안 `thinkingBudget: 0` 명시 | unit test (existing test 갱신) |
| **AC-4** | `callAnthropic(prompt, { thinkingBudget: 0 })` 호출 시 HTTP body 안 thinking 관련 key 0건 | payload assertion |
| **AC-5** | Spec 5.7.8 v1.5 안 I8 본문 = "분석 LLM only" 정의 + 변경 이력 v1.5 row + footer cycle # 일관 | grep — `^- \*\*I8\*\*` + 분석 LLM only + footer |

## 6. Out-of-Scope

- maxTokens default 증가
- 다른 LLM provider thinking 지원
- §5.7.9 candidate #3~#5

## 7. Dependencies

- 선행: §5.7.8 v1.4 (status: completed)
- 후행: §5.7.9 candidate #3~#5 (사용자 결정 의뢰)

## 8. Todo (HOW)

### Step 1 — wikey-core type extend
- (impl) `wikey-core/src/types.ts` line 118~128 의 `LLMCallOptions` 에 `readonly thinkingBudget?: number` 추가
- (test) `wikey-core/src/__tests__/llm-client-gemini-thinking.test.ts` 신설 — AC-1 + AC-2 (HttpClient mock)
- (acceptance) AC-1 + AC-2 PASS

### Step 2 — callGemini generationConfig 분기
- (impl) `wikey-core/src/llm-client.ts` line 38~43 의 generationConfig 안 `if (opts?.thinkingBudget !== undefined) generationConfig.thinkingConfig = { thinkingBudget: opts.thinkingBudget }`
- (acceptance) Step 1 의 test PASS

### Step 3 — advanced query tuning callOptions 명시
- (impl) `wikey-obsidian/src/main.ts` `buildFilterCallOptionsFromSettings` 결과 안 `thinkingBudget: 0` 추가
- (test) `wikey-obsidian/src/__tests__/filter-default-inherit.test.ts` 갱신 — `thinkingBudget: 0` 확증 + AC-3
- (acceptance) AC-3 PASS

### Step 4 — Spec 5.7.8 v1.5 I8 정의
- (impl) `plan/phase-5/phase-5-spec-5.7.8-llm-dynamic-stopword.md` I8 본문 갱신 + 변경 이력 v1.5 row + footer cycle 명시
- (acceptance) AC-5 grep PASS

### Step 5 — 회귀 + CDP verify
- (regression) wikey-core npm test 781+ + wikey-obsidian npm test 100+ + tsc + build
- (live) CDP — 1 query (pmbok-q3) Advanced ON cold 재시도. cache 3/3 file 생성 + 응답 정상 chars.

## 9. self-check (master 1차 검증 의무)

| anchor | 검증 | 결과 |
|--------|------|------|
| (a) | spec/todo 6요소 | PASS (Goal/Inputs/Outputs/Invariants/AC/Out-of-Scope/Deps + Todo) |
| (b) | invariant ↔ AC 1:1 | PASS (I1↔AC-1+2 / I2↔AC-3 / I3↔AC-4 / I4↔AC-5) |
| (c) | Spec→Todo mirror | PASS (5 step ↔ 5 AC) |
| (d) | feasibility | PASS (영향 3 file 코드 + 1 doc, ~30 LOC delta) |
| (e) | history rows | n/a (v1.0 신규) |
| (f) | numeric | latency 1500ms / token 500 / cache 3 namespace = §5.7.8 spec byte-equal |
| (g) | scope discipline | PASS (#3~#5 Out of Scope 명시) |
| (h) | schema 4 원칙 | PASS — Explicit (thinkingBudget API), Yours (사용자 설정 무관 always 0), File over app (코드 only), BYOAI (filter LLM provider override 영향 0) |
| (i) | 3계층 경계 | PASS (raw/ wiki/ 무관) |
| (j) | 워크플로우 | PASS (검색 layer fix only) |
| (k) | 하드코딩 금지 | PASS — `thinkingBudget: 0` 은 advanced query tuning 의 *결정적* default. 사용자 customize 미의도. ENABLE_THINKING / THINKING_BUDGET_LIMIT 같은 hardcoded enum X. 단 1 spot magic number 0 — 이건 "thinking off" semantics |

11 anchor (글로벌 7 + wikey 4) ALL PASS.

## 변경 이력

| version | date | author | 변경 |
|---------|------|--------|------|
| v1.0 | 2026-05-10 | master (Claude) | 신규. §5.7.8 라이브 비교 결과 (PASS-A 7/10 + PASS-C 정의 모호) → §5.7.9.1 + §5.7.9.2 합본 spec/todo. 4 invariant / 5 AC / 5 step / 11 anchor self-check ALL PASS. |
