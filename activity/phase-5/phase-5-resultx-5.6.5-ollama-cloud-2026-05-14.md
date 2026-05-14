---
phase: 5
section: 5.6.5
title: Ollama Cloud — large-model integration + cross-provider benchmark (Session 43, 2026-05-14)
status: done
created: 2026-05-14
tags: [provider-auth, ollama-cloud, benchmark, byoai, paradigm-shift, done]
---

# Phase 5 §5.6.5 Ollama Cloud — 활동 기록 (resultx)

> **상위 문서**: [`activity/phase-5/phase-5-result.md §5.6.5`](./phase-5-result.md)
>
> **상위 plan**: [`plan/phase-5/phase-5-todox-5.6.5-ollama-cloud.md`](../../plan/phase-5/phase-5-todox-5.6.5-ollama-cloud.md) v0.5
>
> **mirror todo**: [`plan/phase-5/phase-5-todo.md §5.6.5`](../../plan/phase-5/phase-5-todo.md)
>
> **spec**: [`plan/phase-5/phase-5-spec-5.6.5-ollama-cloud.md`](../../plan/phase-5/phase-5-spec-5.6.5-ollama-cloud.md) v0.5

## 1. Overview

§5.6.4 종결 직후 Session 42 사용자 R1 raise (Ollama Pro 구독중, gemini-2.5-flash 경쟁 가능 대형 cloud 모델 필요) 정식 plan 진입. Session 43 (2026-05-14) 단일 세션 종결.

**paradigm 진화**:
- v0.1 (analyst 초안) → v0.2 (master fix 3 라이브 raise) → v0.3 (codex cycle #1 7 finding) → v0.4 (PoC §0 master probe → SSH+signin) → **v0.5 (사용자 LOCK "다른 LLM과 동일한 구조" — Subscription+APIKey 통일, cookie scrape 폐기)**.

**철학 정합** (Karpathy 4 원칙):
- **Explicit** — Auth Mode dropdown 명시 (none/subscription/api 3-option), 'auto' 폐기
- **Yours** — Ollama signin SSH key + API Key 사용자 선택 (`credentials.json` 평문)
- **File over app** — 4-provider auth 통일 schema
- **BYOAI** — gemini-2.5-flash 외 9 model benchmark 자산 + ollama local/cloud 병행

## 2. 17 commit (push 완료, `6ead5fb..2731353` origin/master)

| # | commit | hash | scope |
|---|--------|------|-------|
| 1 | `docs(§5.6.5 v0.4): PoC §0 종결` | `4df1b92` | PoC §0 master probe — 5 cloud + 1 local LOCK (deepseek-v3.1/qwen3-coder/kimi-k2.6/gpt-oss/mistral-large-3) + 8 model 결정 + plan mirror |
| 2 | `feat(§5.6.5 v0.4): provider abstraction + ollama-cloud type` | `46c0f47` | Step A — `LLMProvider` 4→5 element (`'ollama-cloud'`) + `SubscriptionProvider` 재정의 + `callOllama unified` (callOllamaCloud 별 함수 분리 X, PoC paradigm) + `isCloudModel` regex + `CLOUD_MODEL_CATALOG` (5 model) + 단위 test |
| 3 | `docs(§5.6.5 v0.4): spec mirror sweep` | `b63a467` | 8 model + PoC §0 paradigm sweep |
| 4 | `feat(§5.6.5 v0.4): Settings UI 4th subsection` | `ccae0db` | Step B — `renderOllamaCloudSubsection` (Q2=d) — Signin badge + Sign in/out (v0.4 SSH+signin paradigm) |
| 5 | `feat(§5.6.5 v0.4): CLI_OPTION_SUPPORT 48→64` | `99cc94e` | Step C — `CliOptionMatrixProvider` 4 row + adaptive jsonMode (matrix lookup, ollama branch) |
| 6 | `feat(§5.6.5 v0.4): Ollama Cloud usage fetcher + cookie input` | `eef2afa` | 옵션 A v2 part 1/2 — cookie scrape paradigm (`ollama-cloud-usage-fetcher.ts` + Settings cookie row) |
| 7 | `feat(§5.6.5 v0.4): Ollama statusbar chip + callOllama hook` | `38a1d66` | 옵션 A v2 part 2/2 — `ollama-usage-hook.ts` singleton emitter + chip 5min poll + light-purple `●` dot |
| 8 | `chore(§5.6.5 v0.4): deploy-plugin.sh` | `416ce53` | vault-aware plugin install |
| 9 | `feat(§5.6.5 v0.4): scripts/ollama-statusline.sh` | `883ef57` | Claude Code statusline (paradigm B) initial |
| 10 | `revert(§5.6.5 v0.4): move ollama-statusline.sh` | `628533f` | claude-harness-helper repo 이관 (wikey 책임 outside) |
| 11 | `feat(§5.6.5 v0.4): benchmark harness + 9-model evidence` | `4420cbe` | Step D — 9 model × 7 fixture × 6 task × 3 cycle = 1,134 cell + deepseek-v4-pro:cloud 추가 (1.6T, 1M ctx) |
| 12 | `docs(§5.6.5 v0.4): benchmark-result.md multi-chapter` | `0b8e0ea` | 357 line 10 chapter — winner gemini-2.5-flash 0.711 (5/6 task), kimi-k2.6 0.590 (cloud 1위), deepseek-v4-pro 0.588 (3위, canonicalize 2위 + latency 1위) |
| 13 | `chore(§5.6.5 v0.4): remove cost section dead code` | `932d547` | scripts/cost-tracker + WikeyConfig.COST_LIMIT + Settings renderCostSection 모두 제거 (-792 LOC) |
| 14 | `docs(§5.6.5 v0.4): spec drift fix 2건` | `d6df76e` | claude-3.5-sonnet → claude-sonnet-4-20250514 sweep + I13 SubscriptionDeps ESM injection |
| 15 | `feat(§5.6.5 v0.5): Ollama Cloud Subscription+APIKey paradigm` | `653b204` | **paradigm v0.5 LOCK ("다른 LLM과 동일한 구조" 사용자 LOCK)** — cookie scrape 폐기 (-9+-7 test). `SubscriptionProvider` 4-element + `renderProviderSubsection` 공유 helper + 3 rows (Auth Mode/Subscription/API Key) + callOllama Bearer header (auth=api && key 시 주입) |
| 16 | `docs(§5.6.5 v0.5 sync): spec/todox/todo mirror` | `f12ec5b` | Session 43 종결 docs sync — spec/todox v0.5 entry + todo §5.6.5.3 mirror + CDP smoke 4 entry 재확증 + handoff cleanup |
| 17 | `fix(§5.6.5 v0.5): testApiConnection 'ollama-cloud' case` | `2731353` | 라이브 사용자 raise — API Key 입력 + Test 클릭 fail. `testApiConnection` switch default → fail 원인. `'ollama-cloud'` case 추가 + `${OLLAMA_URL}/api/tags` + Bearer header. **사용자 라이브 검증 PASS 확증**. |

## 3. paradigm shift v0.4 → v0.5

**배경**: v0.4 PoC §0 결과 = SSH+signin paradigm 채택 (Ollama Cloud 가 `ollama signin` 으로 SSH key 등록 + 동일 endpoint `/api/chat` 사용). 사용자 cookie 입력 row 도 추가 (옵션 A v2). 하지만 다른 3 provider (gemini/anthropic/openai) 는 Auth Mode dropdown + Subscription badge + API Key input 의 **3-row 구조**.

**사용자 LOCK** (2026-05-14): "왠 cookie?" + "이미 APIKey를 발급 받음" + "다른 LLM과 동일한 구조" → cookie paradigm 즉시 폐기.

**v0.5 변경 4 영역**:
1. **SubscriptionProvider 재정의**: `Exclude<LLMProvider, 'ollama'|'ollama-cloud'>` (v0.4, 3 element) → `Exclude<LLMProvider, 'ollama'>` (v0.5, 4 element). `CliOptionMatrixProvider = SubscriptionProvider` alias.
2. **credentials.json 4-provider**: `ollamaCloudApiKey: string` + `auth['ollama-cloud']: {mode: 'none'|'subscription'|'api'}`. parse/serialize 4-provider 통일.
3. **callOllama Bearer header**: `isCloudModel && OLLAMA_CLOUD_AUTH_MODE === 'api' && OLLAMA_CLOUD_API_KEY` 시 `Authorization: Bearer <key>` HTTP header 주입.
4. **cookie scrape 폐기**: `ollama-cloud-usage-fetcher.ts` + 9 test + `settings-tab-ollama-cloud.ts` + 7 test + 5min poll 모두 삭제. statusbar chip = `notifyOllamaUsage` 모델명만 (display:none 기본).

## 4. 9-model benchmark 결과 (Step D, commit 11/12)

**Volume**: 9 model × 7 fixture × 6 task × 3 cycle = **1,134 measurement**

**Ranking (composite score)**:
| 순위 | Model | Score | 비고 |
|------|-------|-------|------|
| 1 | gemini-2.5-flash | 0.711 | 5/6 task 우승 (cross-reference 제외). 사용자 default 유지 |
| 2 | kimi-k2.6:cloud | 0.590 | cloud 1위 — Moonshot 모델 |
| 3 | deepseek-v4-pro:cloud | 0.588 | 사용자 R 추가 (1.6T params / 1M ctx). canonicalize 2위 (gemini 0.005pp 차) + latency 1위 |
| 4 | deepseek-v3.1:671b-cloud | 0.578 | — |
| 5 | qwen3-coder:480b-cloud | 0.553 | code-specialized |
| 6 | gpt-oss:120b-cloud | 0.512 | 117B / 128K ctx |
| 7 | mistral-large-3:675b-cloud | 0.487 | M5 markdown ```json``` wrap 의무 |
| 8 | qwen3:8b (L1 local) | 0.339 | local baseline |
| 9 | qwen3.6:35b-a3b-nvfp4 (L2 local) | 0.301 | mlx jsonMode adaptive prefix |

**결론**: cloud 6 model 모두 gemini-2.5-flash 미달 (wikey 도메인 한정). 다만 deepseek-v4-pro = canonicalize 2위 (사용 가치 명확) + cloud 1~3위 격차 작아 사용자 선택지 확보. PII 6 pattern × 0 hit (보고서 markdown 자체).

## 5. Settings UI v0.5 — CDP smoke 4 entry PASS

| 검증 항목 | 결과 |
|----------|------|
| H3 4 provider | Google Gemini / Anthropic Claude / OpenAI Codex / **Ollama Cloud** PASS |
| Ollama Cloud subsection rows | 3 rows (Auth Mode / Subscription / API Key) — 다른 3 provider 와 byte-identical 구조 PASS |
| Auth Mode dropdown | `['none', 'subscription'(SEL), 'api']` — default 'subscription' PASS |
| Subscription badge + Sign in/out | `'signed-in'` text (master 환경 `ollama signin` 활성) + `'Sign out'` button PASS |
| API Key password input + Test button | `type='password'` (length=0 empty 상태) + `'Test'` button PASS |
| installed badge in H3 | `wikey-cli-status-installed` "installed" PASS |
| statusbar chip mount | `.wikey-statusbar-ollama-chip` element 존재 + `display: none` (cloud 모델 미로드 시 정상 hidden) PASS |
| **라이브 Test (사용자 직접)** | API Key 입력 → Test 클릭 → `'Ollama Cloud connected'` Notice **PASS** (commit 17 fix 후) |

## 6. 회귀 결과 (fresh re-run)

| 검증 | 결과 |
|------|------|
| wikey-core test | **1175 / 1178 PASS** (3 skipped) |
| wikey-obsidian test | **223 / 224 PASS** (1 skipped) |
| build (wikey-obsidian) | 0 errors / 5 warnings (esm import.meta only) |
| validate-wiki.sh | PASS |
| CDP smoke 4 entry | PASS (위 §5) |

**Test 변동**:
- 이전 Session 42 종결 = wikey-core 1184 / wikey-obsidian 230
- 현재 Session 43 종결 = wikey-core 1175 (-9, `ollama-cloud-usage-fetcher.test.ts` 삭제) / wikey-obsidian 223 (-7, `settings-tab-ollama-cloud.test.ts` 삭제). 모두 paradigm v0.5 의도 삭제.

## 7. 라이브 사용자 raise (Session 43)

| R | raise | 처리 |
|---|-------|------|
| R1 | "왠 cookie?" | paradigm v0.5 LOCK — cookie scrape 폐기 (commit 15) |
| R2 | "이미 APIKey를 발급 받음" | API Key row 추가 (paradigm v0.5) |
| R3 | "다른 LLM과 동일한 구조" | `renderProviderSubsection` 공유 helper 재사용 (4 provider 통일, commit 15) |
| R4 | "obsidian-cdp 스킬 사용해" | obsidian-cdp SKILL invocation (chrome-devtools MCP 폐기, master 직접) |
| R5 | "ollama cloud API Key 입력 > 테스트 > fail" | commit 17 fix (`testApiConnection` 'ollama-cloud' case) — 사용자 라이브 Test PASS 확증 |

## 8. 다음 세션 (Session 44)

**Phase 5 잔여 = §5.5 / §5.8 / §5.9** (3 subject). 우선순위 결정 → analyst Step A LOCK 진입.

§5.6.x family 전체 종결 (§5.6.4 + §5.6.5).
