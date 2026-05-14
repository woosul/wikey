---
phase: 5
section: 5.6.5
title: Ollama Cloud — large-model integration + cross-provider benchmark — Todo (HOW)
status: planning
created: 2026-05-14
updated: 2026-05-14
version: v0.5
tags: [provider-auth, ollama-cloud, benchmark, byoai, model-selection]
---

# Phase 5 §5.6.5 Ollama Cloud — large-model integration + cross-provider benchmark (Todo, HOW)

> **버전 이력**:
> - **v0.5 (2026-05-14, paradigm shift — "다른 LLM과 동일한 구조" 사용자 LOCK)** — Ollama Cloud auth = **Subscription + APIKey** (v0.4 SSH+signin only paradigm 폐기). 변경 4 영역:
>   - **SubscriptionProvider 4-element**: `Exclude<LLMProvider,'ollama'>` (gemini/anthropic/openai/ollama-cloud). `CliOptionMatrixProvider = SubscriptionProvider` alias. 64-cell matrix 유지 (ollama-cloud subscription column = api column mirror, HTTP body shape 동일).
>   - **credentials.json 4-provider**: `ollamaCloudApiKey: string` + `auth['ollama-cloud']: {mode: 'none'|'subscription'|'api'}`. parse/serialize 4-provider 통일.
>   - **callOllama Bearer header**: `isCloudModel && OLLAMA_CLOUD_AUTH_MODE === 'api' && OLLAMA_CLOUD_API_KEY` 시 `Authorization: Bearer <key>` HTTP header 주입. subscription path = no header (signin state 의존).
>   - **cookie scrape paradigm 폐기**: `ollama-cloud-usage-fetcher.ts` + 9 test + `settings-tab-ollama-cloud.ts` + 7 test + 5min poll 삭제. statusbar chip = `notifyOllamaUsage` 모델명만.
> - 회귀: wikey-core 1175/1178 PASS · wikey-obsidian 223/224 PASS · build 0 errors · validate-wiki PASS.
> - v0.1 (2026-05-14, 본 todox 초안) — Spec 6 요소 + SDD+TDD 6 step (§5.6.5.0~§5.6.5.5) + §7 사용자 결정 4 항목 + 벤치마크 sub-step volume ~46%
> - v0.2 (2026-05-14, master 1차 검증 fix) — 사용자 라이브 raise 3건 반영:
>   - **raise 1** — 기존 ollama (local) 코드 회귀 검증 강화 (13 source file enumeration, §5.1 grep matrix 확장, §6 step E 회귀 의무 강화)
>   - **raise 2** — ollama local + cloud 병행 사용 구조 LOCK → **Q1 = b 사용자 결정 LOCK** (§3.1 권장 → 사용자 명시 LOCK)
>   - **raise 3** — 모델 식별자 자동 구분 (cloud catalog const block + `isCloudModel` helper, §6 Step A 추가)
>   - hygiene: §8 self-check Risks R 카운트 R1~R7 → R1~R12 정정
> - **v0.3 (2026-05-14, codex cycle #1 NEEDS_REVISION 7 finding fix + 사용자 raise 4/5/6/7 통합)** — 변경 5 항목:
>   - **raise 4 + 5** — §5.6.5.4 Step D benchmark = **본 §5.6.5 안 유지** + **본 세션 안 analyst 서브에이전트 위임** (section 분리 X, 작업 위임 layer 분리)
>   - **raise 6** — benchmark 핵심 목적 = wikey 도메인 best-fit 모델 1개 발견 (cost 는 tie-breaker)
>   - **raise 7** — community 평가 reference 참조 (HF leaderboard / LMSYS Arena / Korean LLM eval)
>   - **codex cycle #1 7 finding fix**: (1) version v0.2 → v0.3 frontmatter + LOCK 문구 (2) Q1=a fallback 잔존 제거 + phase-5-todo §5.6.5 LOCK mirror (3) matrix shape `CliOptionMatrixProvider = SubscriptionProvider | 'ollama-cloud'` 64 cell (4) endpoint placeholder `e.g.` 표기 (5) self-check pointer R1~R12 + AC-S1~S31 + spec §1.6 정정 (6) Ollama Pro terms gate Dependencies + Risks 추가 + 용역계약서 fixture 결정 사용자 deferred (7) §4 commit table 의 commit prefix column 추가 `feat(§5.6.5 v0.3): ...`
> - **v0.4 (2026-05-14, PoC §0 종결 paradigm 변경 + 사용자 raise 22 L2 추가)** — PoC §0 master 직접 실측 후 5 paradigm 변경:
>   - **M1~M5 ollama 식별자 LOCK**: `deepseek-v3.1:671b-cloud` (671B) / `qwen3-coder:480b-cloud` (480B, qwen3:122b 부재 → 사용자 결정 LOCK) / `kimi-k2.6:cloud` / `gpt-oss:120b-cloud` (117B, 128K ctx) / `mistral-large-3:675b-cloud` (675B, 256K ctx, 사용자 raise 22-1 LOCK — Ollama Cloud 의 유일한 Mistral cloud model)
>   - **L2 추가** (사용자 raise 22 2026-05-14): `qwen3.6:35b-a3b-nvfp4` (qwen3_5_moe 35.1B, 256K ctx, nvfp4) — local current 2번째 baseline. **jsonMode = adaptive prefix 의무** (mlx runner `format:json` unsupported, plain mode 만 동작)
>   - **callOllama unified** (PoC paradigm shift): callOllamaCloud 별 함수 분리 불필요 — `callOllama` 안에 cloud 모델 분기 + `isCloudModel(modelId)` helper. transport variant (a) confirmed (provider key `'ollama-cloud'` UI 표시만, endpoint 동일 `localhost:11434`)
>   - **Auth = SSH + signin** (PoC paradigm shift): `credentials.json.ollamaCloudApiKey` 필드 제거. Settings UI 4번째 subsection 의 row paradigm 변경 — "Endpoint URL + API Key" → **"Signin status badge + Sign in/out button"** (`ollama signin` / `ollama signout` shell spawn)
>   - **jsonMode native** (PoC paradigm shift): 5 cloud model + L1 모두 `/api/chat` `format:json` 지원. M5 mistral-large-3 만 markdown ```json``` block wrap (strip helper 의무). L2 adaptive prefix.
>   - **측정 model count 7 → 8** (raise 22 L2 추가): **8 model × 7 fixture × 6 task × 3 cycle = 1,008 measurement** (이전 882 → 1,008)
>
> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.6.5`](./phase-5-todo.md) (실행 단일 소스 — 체크박스 mirror)
>
> **관련 문서**:
> - [`wikey.schema.md`](../../wikey.schema.md) — 4 원칙 (Explicit / Yours / File over app / BYOAI) + 시스템 언어 영문 LOCK (#6) + LLM 참여형 다층 검색 (§"검색/인덱스 확장 전략") + 분해 정책 D-wide (§"분해 정책")
> - [`plan/phase-5/phase-5-spec-5.6.5-ollama-cloud.md`](./phase-5-spec-5.6.5-ollama-cloud.md) — Spec 6 요소 (Goal / Invariants / AC / DoD / TestCases / Dependencies / Risks)
> - [`plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md`](./phase-5-todox-5.6.4-llm-subscription.md) — 직전 cycle, provider 추상화 결과 활용 (`AuthMode` / `AuthPath` / `SubscriptionProvider` / `CLI_OPTION_SUPPORT` 48-cell matrix / `LLMCliOptionField` 8-field)
> - [`wikey-core/src/types.ts`](../../wikey-core/src/types.ts) — `LLMProvider` (line 145, 현재 4 element) / `AuthMode` (158) / `SubscriptionProvider` (167, `Exclude<LLMProvider,'ollama'>`)
> - [`wikey-core/src/provider-cli-options.ts`](../../wikey-core/src/provider-cli-options.ts) — 48-cell matrix (3 provider × 2 path × 8 field). §5.6.5.3 = ollama-cloud row 추가 후 64 cell (4 provider × 2 path × 8 field)
> - [`wikey-core/src/auth-resolver.ts`](../../wikey-core/src/auth-resolver.ts) — `resolveAuthMode` (line 87) / `getConfiguredAuthPath` (69) / `detectFallbackTrigger` (133)
> - [`wikey-core/src/adaptive-json-mode.ts`](../../wikey-core/src/adaptive-json-mode.ts) — line 43 `if (provider === 'ollama') return true` (local 가정, cloud 모델 별 jsonMode 차이 재검토 의무)
> - [`wikey-core/src/llm-client.ts`](../../wikey-core/src/llm-client.ts) — `callOllama` (line 509, `OLLAMA_URL` env 기반)
> - [`wikey-core/src/provider-defaults.ts`](../../wikey-core/src/provider-defaults.ts) — `PROVIDER_CHAT_DEFAULTS` (line 23, `ollama: 'qwen3:8b'`) / `PROVIDER_CONTEXT_BUDGETS` (75) / `PROVIDER_VISION_DEFAULTS` (35)
> - [`wikey-obsidian/src/settings-tab.ts`](../../wikey-obsidian/src/settings-tab.ts) — `renderApiKeysSection` (line 1221, 3 provider subsection) / `renderProviderSubsection` (1281, helper)
> - [`wikey-core/src/scripts/benchmark-search.ts`](../../wikey-core/src/scripts/benchmark-search.ts) — 기존 search benchmark harness pattern (§5.6.5.4 mirror 후보)
> - [`docs/samples/`](../../docs/samples/) — fixture corpus (Korean ROHM Wi-SUN PDF + English rp1 peripherals + 한글 HWPX Examples + 한글 PMS 제품소개 + 사업자등록증 PDF + GOODSTREAM Solutions md + 스마트공장 hwp.md)
>
> **wiki 재생성 없음 확증 (예상)**: provider 추가 + jsonMode adaptive + UI subsection 만. wiki 본문 / frontmatter / 페이지 / log.md 형식 변경 0. 벤치마크 산출물 = `docs/ollama-cloud-benchmark-result.md` (wiki 외부, plan/activity 영역).
>
> **시스템 언어 LOCK**: 모든 사용자 facing 텍스트 = 영문 (`wikey.schema.md §핵심 원칙 #6`). Settings UI 4번째 subsection 의 heading / 라벨 / Notice / placeholder 모두 영문.
>
> **하드코딩 금지 영구 룰 적용** (2026-05-10 LOCK): Ollama Cloud endpoint URL / model catalog / quota detection regex 등 결정 로직은 const block (각 const 에 주석 source 명시). LLM 의 의미론적 판정 영역 (벤치마크 grading) 은 LLM 호출 + cache. static 분류 list 0건 (§5.7.6 ABANDON 학습).
>
> **§5.7.2 사전 PoC 학습 적용** (8 cycle abandon 후 영구 등록 / 2026-05-08): plan v1 LOCK *전* "Ollama Cloud 가 실제로 외부에서 어떤 endpoint + auth flag + jsonMode 로 동작하는가" 를 master 가 사전 PoC 로 manual 확증. PoC 실패 시 fundamental 가정 재검토 (e.g. 별 provider key vs URL switch 결정 변경).

---

## 1. 진행 구조 — SDD + TDD 강제 (§5.6.4 v0.7 양식 mirror)

```
Phase 0  Spec lock (본 todox §3 + spec §1~§6) → master 7-anchor 1차 grep → codex Mode D Panel 2차 검증 (cycle #1, plan)
Phase 1  §5.6.5.0 사전 PoC — master 직접 (사용자 Ollama Pro 계정 보유) — Ollama Cloud endpoint + auth + jsonMode + model catalog 확정
Phase 2  §5.6.5.1 Step A — provider 추상화 layer 확장 (LLMProvider type 변경 또는 URL switch 결정 후 implement)
Phase 3  §5.6.5.2 Step B — Settings UI 4번째 subsection (Ollama Cloud) 추가
Phase 4  §5.6.5.3 Step C — adaptive jsonMode + CLI_OPTION_SUPPORT matrix 확장
Phase 5  §5.6.5.4 Step D — 벤치마크 harness + fixture corpus + golden set + 실측 cycle (사용자 강조, ~46% volume)
Phase 6  §5.6.5.5 Step E — 통합 검증 + 라이브 cycle smoke (CDP) + 추천 모델 1개 production 채택
Phase 7  최종 master 1차 검증 + codex Mode D Panel cycle #2 post-impl + 사용자 사전 보고
```

각 step 내부 sub-step (Phase 2~5):

```
N-RED   wikey-core/test/<topic>.test.ts 신규 + 회귀 case → FAIL 확증
N-GREEN 구현 → PASS
Na      회귀 — npm test (wikey-core + wikey-obsidian) / npm run build / ./scripts/validate-wiki.sh
Nb      BLUE refactor — 함수 분해 / Naming / DRY / 주석 quality
N-smoke master CDP — Settings 4번째 subsection 클릭 → Ollama Cloud endpoint 입력 → chat 1 query 성공 (Step C 후)
N-local commit (local only) — push 보류, §5.6.5.5 종결 시점 일괄 push
```

**commit/push 순서 LOCK** (§5.6.4 v0.3 F9 mirror): 각 step local commit (push X) → 5+ commit 누적 → §5.6.5.5 통합 검증 → codex Mode D Panel cycle #2 → master verdict 결정 → 사용자 사전 보고 → push.

---

## 2. 검증 의무 매트릭스 (rules.md §10 + agent-management.md §7)

| 단계 | master 1차 | codex 2차 | tester | 라이브 smoke (master 직접) |
|------|-----------|----------|--------|---------------------------|
| Phase 0 spec lock | 본 §3 7-anchor + 20 anchor grep | Mode D cycle #1 (plan APPROVE) | — | — |
| Phase 1 §5.6.5.0 PoC | master 직접 manual `ollama run <cloud-model> 'hello'` + endpoint capture + jsonMode probe + catalog list | — | — | — |
| Phase 2 §5.6.5.1 추상화 | 단위 test + grep diff (type 변경 영향 면 grep) | — | (master 직접 RED/GREEN) | — |
| Phase 3 §5.6.5.2 UI | renderProviderSubsection helper signature 변경 영향 grep + 4번째 subsection 회귀 | — | (master 직접) | obsidian-cdp 1 cycle — Settings tab 4 subsection 표시 확증 |
| Phase 4 §5.6.5.3 matrix | provider-cli-options.test.ts golden 64 cell + adaptive-json-mode.test.ts ollama-cloud row | — | — | — |
| Phase 5 §5.6.5.4 benchmark | **위임 3-agent**: analyst plan (docs/ollama-cloud-benchmark-plan.md) → master 1차 → developer 실행 (harness 코드 + metric 수집) → master 1차 (raise 12) | (필요 시) plan + post-impl 2 cycle | developer 단위/통합 test (mock LLM) | **master 라이브 cycle smoke 1 회** winner 모델 obsidian-cdp (위임 불가) |
| Phase 6 §5.6.5.5 통합 | 회귀 + routing matrix 회귀 + buildConfig 호출 site 5 회귀 (§5.6.4 §5.2 A6 mirror) | — | — | obsidian-cdp Ollama Cloud Sign in/out + chat 1 query |
| Phase 7 post-impl | AC line-by-line + DoD anchor | **Mode D cycle #2 (code + benchmark APPROVE) — push 직전 의무** | — | — |

**codex cycle 한도**: 사용자 raise 부재 (§5.6.4 v0.3 = 2 cycle 의무만). 본 §5.6.5 도 동일 — #1 plan / #2 post-impl. provider 별 mini cycle 폐기. max 3 cycle (NEEDS_REVISION 1회 추가 fix loop 허용).

**검증 도구**:
- master 1차: `npm test` (wikey-core + wikey-obsidian fresh) / `npm run build` / `./scripts/validate-wiki.sh` / 7-anchor + 6 codex pattern + 7 fix mode = 20 anchor (`feedback_master_codex_pattern_learning.md`)
- **codex 2차: `cmux` SKILL 의무 사용** (`feedback_cmux_skill_read.md` LOCK + `agent-management.md §0~§5` + `~/.claude/skills/cmux/SKILL.md` 첫 read 의무) — `cmux new-split` 으로 fresh surface → `cmux rename-tab` 으로 `(r,c) codex: ...` 라벨 → `codex exec - < /tmp/prompt.txt 2>&1 | tee $LOG; cmux wait-for --signal <token>` 한 줄 send + `cmux wait-for "$token" --timeout 1800` background 동기화 → cycle 종료 후 `cmux close-surface --surface <id>` (cycle 단위 격리, ADR-0004). polling Bash foreground 금지.
- 라이브 smoke: `obsidian-cdp` SKILL full cycle (CLAUDE.md §6, master 직접 책임 LOCK 2026-05-12)

---

## 3. 사용자 결정 필요 항목 (≥ 4)

본 todox + spec 작성 후 **사용자 명시 결정 필요**. analyst 임의 결정 X.

### 3.1 Q1 — Provider type 결정 (a / b 옵션)

| Option | shape | 장점 | 단점 |
|--------|-------|------|------|
| **(a) URL switch** | `LLMProvider = 'gemini'\|'anthropic'\|'openai'\|'ollama'` 유지. `OLLAMA_URL` 이 `http://localhost:11434` (local) 또는 `https://ollama.com` (cloud) 인지로 분기 | (i) type 변경 0건 — 회귀 면적 최소 (ii) credentials.json schema 변경 0 (iii) §5.6.4 의 `SubscriptionProvider = Exclude<LLMProvider, 'ollama'>` 그대로 (ollama = local-only 가정 유지) | (i) ollama local + ollama cloud 동시 사용 불가 (URL 하나) (ii) Settings UI 에서 "local" vs "cloud" 명시 구분 불가 — endpoint URL 만으로 사용자가 추론 (iii) `CLI_OPTION_SUPPORT` 의 ollama row 의 path 축이 'subscription'/'api' 의미 mismatch (ollama 는 OAuth subscription 개념 없음 — apiKey-only) |
| **(b) 별 provider key (`'ollama-cloud'`)** | `LLMProvider = 'gemini'\|'anthropic'\|'openai'\|'ollama'\|'ollama-cloud'` (5 element). `SubscriptionProvider` 도 재정의 (포함 or 제외 선택 필요). credentials.json + WikeyConfig + Settings UI 모두 4번째 subsection 명시 | (i) UI / config / matrix 명확 (ii) local + cloud 동시 사용 (iii) §5.6.4 helper (`renderProviderSubsection`) 그대로 재사용 + 4번째 spec 만 추가 (iv) `CLI_OPTION_SUPPORT` 의 ollama-cloud row = api-only (subscription path 없음 — Ollama Pro 도 API key 발급 형태일 가능성, PoC 확증 의무) | (i) type 추가 = 회귀 면적 ↑ (`LLMProvider` 사용처 전부 grep + 분기 추가) (ii) credentials.json schema migration 의무 (iii) `SubscriptionProvider` 정의 재검토 (ollama-cloud 가 subscription path 가지는지 PoC 의존) |

**사용자 결정 LOCK = (b)** (raise 2 2026-05-14 — ollama local + cloud 병행 사용 구조 명시). UI 의 별 subsection 표시 (사용자 강조 #3) + credential 분리 + matrix shape 명확. PoC §0 결과는 endpoint / auth flow 만 추가 확정 (Q1 자체는 LOCK).

**라이브 모델 식별자 자동 구분 layer** (사용자 raise 3 2026-05-14): provider key 가 둘 (`ollama` / `ollama-cloud`) 이어도 *실제 dispatch* 는 모델 식별자 lookup 으로 자동 분기 — `isCloudModel(modelId): boolean` helper 가 const `CLOUD_MODEL_CATALOG` (PoC §0 lock) 기반 판정. 사용자가 UI 에서 `'ollama'` provider 선택 + 모델 `llama3:70b-cloud` 입력 시 → 자동 cloud dispatch (AC-S30 spec mirror).

**근거 추가** (PoC §0 deferred): endpoint / auth flow 확정 후 const block 최종 lock — 단 PoC 결과와 무관히 **provider key 는 `'ollama-cloud'` 유지** (UI 4번째 subsection LOCK, raise 2 사용자 결정). 즉:
- PoC 결과 = local CLI 의 URL switch (e.g. `OLLAMA_HOST=...`) → `callOllama` 안에서 URL switch + 모델 식별자 lookup. provider key 는 여전히 `'ollama-cloud'` (UI 표시 + credential 분리 목적).
- PoC 결과 = 별 endpoint + API key header → `callOllamaCloud` 신규 함수 분리. provider key `'ollama-cloud'`.
- (Q1=a "URL switch + provider key 도 ollama 유지" 옵션 = **rejected historical option** — codex cycle #1 ID-2 v0.3 fix. v0.1 의 a/b trade-off table 은 history 인용으로만 보존.)

### 3.2 Q2 — `renderProviderSubsection` helper 재사용 여부

| Option | shape |
|--------|-------|
| **(c) 그대로 재사용** | `ProviderSubsectionSpec` interface 에 ollama 의 fields 추가 (e.g. `endpointUrl?: string`). helper 내부에서 provider==='ollama-cloud' 분기 — "Sign in/out" 버튼 대신 "Endpoint URL" 입력 row + API Key row. AuthMode dropdown 옵션 = ('none' / 'api') 만 (subscription 옵션 hide 또는 disable). |
| **(d) Ollama 전용 helper 추가** | `renderOllamaCloudSubsection(containerEl, spec)` 신규. 4번째 subsection 만 별도 렌더링. heading + 두 row (Endpoint URL / API Key). AuthMode dropdown 없음 (mode 단일). |

**analyst 권장 (사용자 결정 대기)**: (c) — DRY + 4번째 subsection 의 시각적 구조 일관성 (사용자 강조 #3). 단 (d) 는 ollama 가 "subscription/api" 추상화에 mismatch 면 더 honest. PoC §0 결과로 결정.

### 3.3 Q3 — 벤치마크 harness layer

| Option | shape |
|--------|-------|
| **(e) bash script** `scripts/benchmark-ollama-cloud.sh` | 단순 bash + cmux send + obsidian-cdp + 결과 정리 markdown. wikey-core 코드 변경 0. fixture / 모델 set / metric 모두 bash 안. |
| **(f) wikey-core script** `wikey-core/src/scripts/benchmark-models.ts` | 기존 `benchmark-search.ts` (`wikey-core/src/scripts/benchmark-search.ts`) 패턴 mirror. CLI = `tsx scripts/benchmark-models.ts --models <list> --tasks <list> --corpus <dir>`. unit test 가능. |
| **(g) hybrid** | (e) wrapper 가 (f) ts script 호출. bash = orchestration (obsidian-cdp ingest cycle smoke, 라이브 ingest 의무), ts = metric 집계 (golden 비교 / latency 통계 / cost calc). |

**사용자 결정 LOCK (2026-05-14) = (g)** — bash orchestration (obsidian-cdp 라이브 ingest cycle smoke, master 직접 영역) + ts metric 집계 (golden 비교 / latency 통계 / cost calc, developer 영역). 사용자 강조 #2 (벤치마크 비중 ↑) + raise 11 (developer 실행 위임) + master 라이브 검증 책임 LOCK 모두 정합.

### 3.4 Q4 — Golden answer 작성 주체

벤치마크의 **정확도 metric** (canonicalize / mention / brief / query) 는 golden 비교 의무. golden = 정답 set (e.g. ROHM Wi-SUN PDF 의 mention 정답 entity list / rp1 peripherals 의 핀맵 표 정답 markdown / 사업자등록증 PDF 의 PII 누락 정답).

| Option | shape |
|--------|-------|
| **(h) 사용자 직접 작성** | master 가 fixture corpus 의 7 file 별 정답 markdown 작성 후 사용자 검토. 신뢰도 ↑, 시간 ↑ (estimated 4~8h). |
| **(i) gemini-2.5-flash baseline 으로 작성** | 사용자 baseline (gemini-2.5-flash subscription) 으로 1회 ingest → 결과를 golden 으로 채택 → 다른 모델은 baseline 과의 ratio 비교. 비교 가능 + 시간 ↓ (estimated 1~2h), 단 baseline 자체 결함이 golden 으로 lock 됨. |
| **(j) LLM committee LOCK trio** | **`gemini-2.5-flash` + `claude-sonnet-4-20250514` + `gpt-4.1`** 3 model 의 ingest 결과를 LLM committee 가 합의 → golden (codex cycle #3 ID-5 fix — 이전 stale `claude-haiku-4-5 + gpt-4.1-mini` 표기 정정). 시간 ↑↑, 신뢰도 ↑↑. |

**사용자 결정 LOCK (2026-05-14) = (γ) LLM committee** — `gemini-2.5-flash` + `claude-sonnet-4-20250514` + `gpt-4.1` 3 model 의 ingest 결과 → committee 합의 → golden lock. 시간 ↑↑ 단 신뢰도 ↑↑. baseline 1개 결함이 golden 으로 lock 되는 risk 회피 (raise 6 best-fit 정확도 1순위 정합).
> Note: analyst plan §10.6 표기는 (α/β/γ). 본 todox 의 (h/i/j) 와 1:1 매핑 — (h)→(α), (i)→(β), (j)→(γ).

### 3.5 Q5 (선택) — Production 채택 모델 결정 시점

벤치마크 결과 확정 후 **추천 cloud 모델 1개** 를 wikey production 의 basic / mid / advanced slot 중 어디에 배치할지:

| Option | shape |
|--------|-------|
| **(k) basic slot** | `PROVIDER_CHAT_DEFAULTS.ollama-cloud = '<benchmark-winner>'` 만. 기존 basic = gemini-2.5-flash 그대로. 사용자 명시 시 "Ollama Cloud" provider 선택. |
| **(l) advanced slot** | canonicalize 단계만 cloud 70B 사용 + brief/mention 은 local 8B. `phase-5-todo §5.6.5.1` line 900 "ingest 의 canonicalize 단계만 cloud 70B + brief/mention 은 local 8B → 비용 효율 + 품질 균형" 옵션. |
| **(m) advanced + production default 변경** | 벤치마크 결과 winner 가 gemini-2.5-flash 보다 ≥ 10% 우세 + cost ≤ 50% 시 default basic provider 변경. risk = 회귀 영향 면적 ↑. |

**analyst 권장 (사용자 결정 대기)**: (k) 또는 (l) — (m) 은 production default 변경 = 별 cycle 의무 (회귀 면적 ↑).

---

## 4. Commit 분리 + Push 시점

§5.6.4 v0.3 F9 LOCK mirror: 각 step local commit (push X) → 통합 검증 → codex #2 → push.

| commit | prefix (v0.3 fix codex #1 ID-7) | 영역 | scope |
|--------|--------------------------------|------|-------|
| commit 1 | `docs(§5.6.5 v0.3): PoC ollama cloud fixtures` | Step 0 PoC evidence | `plan/phase-5/fixtures/cycle-5.6.5-ollama-cloud-poc/` 안 raw stdout capture (endpoint probe / model catalog / jsonMode probe) — 4~6 file. PoC 결과를 todox §3 결정 항목에 mirror. |
| commit 2 | `feat(§5.6.5 v0.4): provider abstraction + ollama-cloud type` | Step A — provider 추상화 | `wikey-core/src/types.ts` (Q1=b LOCK type 5 element 확장) + `wikey-core/src/auth-resolver.ts` (`SubscriptionProvider` `Exclude<LLMProvider, 'ollama' \| 'ollama-cloud'>` 단순 확장) + `wikey-core/src/llm-client.ts` (`callOllama` 안 cloud 분기 + 별 함수 분리 X, PoC §0 paradigm) + `wikey-core/src/ollama-model-catalog.ts` (신규 `CLOUD_MODEL_CATALOG` + `isCloudModel` helper) + `wikey-core/src/provider-defaults.ts` (`PROVIDER_CONTEXT_BUDGETS.ollama-cloud` 5 model 추가) + 단위 test |
| commit 3 | `feat(§5.6.5 v0.3): Settings UI 4번째 Ollama Cloud subsection` | Step B — Settings UI | `wikey-obsidian/src/settings-tab.ts` (Q2=c LOCK helper 재사용) + 4번째 subsection 추가 + 단위 test |
| commit 4 | `feat(§5.6.5 v0.3): jsonMode adaptive + 64-cell matrix CliOptionMatrixProvider` | Step C — matrix + adaptive jsonMode | `wikey-core/src/provider-cli-options.ts` (`CliOptionMatrixProvider = SubscriptionProvider \| 'ollama-cloud'`, 64 cell) + `wikey-core/src/adaptive-json-mode.ts` (line 43 ollama 분기 정정) + 단위 test |
| commit 5 | `feat(§5.6.5 v0.3): benchmark harness (analyst plan from docs/)` | Step D — benchmark harness | (analyst 산출 `docs/ollama-cloud-benchmark-plan.md` mirror) + (Q3 결정 결과 hybrid) `scripts/benchmark-ollama-cloud.sh` + `wikey-core/src/scripts/benchmark-models.ts` + fixture corpus copy + golden set + 단위 test |
| commit 6 | `chore(§5.6.5 v0.3): benchmark 실측 결과 + winner 결정` | Step D — benchmark 실측 결과 | `docs/ollama-cloud-benchmark-result.md` (모델 × task × metric 비교표 + community ref + best-fit winner). wiki 외부. |
| commit 7 | `feat(§5.6.5 v0.3): production 채택 + 통합 라이브 smoke` | Step E — 통합 + 라이브 smoke evidence | 라이브 ingest cycle smoke 결과 + 회귀 PASS + 추천 모델 1개 production 채택 (Q5 결정 결과) + memory 등록 (`project_phase5_session<N>_5.6.5_done.md`) |
| commit 8 | `fix(§5.6.5 v0.3): codex post-impl fix` (있을 경우) | post-impl codex #2 fix | codex finding fix |

**push timing**: commit 8 (codex #2 APPROVE) 후 통합 push (sequence `git push origin master`). reversible revert path 보존 (§5.7.4 Path A 학습 mirror).

---

## 5. 회귀 방지 grep + golden file 위치

### 5.1 Grep matrix (master 1차 fresh re-run 의무)

> **사용자 raise 1 (2026-05-14)**: 기존 ollama 사용 코드 영역을 회귀 검증에서 누락 없이 검토. 아래 grep + 13 source file 영역별 `git diff` 검토 의무 (spec I5 LOCK + AC-S25 mirror).

**13 source file 영역 (ollama 분기 보존 LOCK, 사용자 raise 1)**:
| # | file | 분기 위치 | 회귀 의무 |
|---|------|----------|----------|
| 1 | `wikey-core/src/llm-client.ts` | `callOllama` line 509, `case 'ollama'` line 93, `OLLAMA_URL` fallback line 631 | `callOllama` 안에 `if (isCloudModel(modelId))` 분기 추가 (debug log + post-process). transport 시그니처 변경 0. 별 `callOllamaCloud` 함수 분리 X (PoC §0 paradigm LOCK). 신규 `case 'ollama-cloud'` 분기 추가 (callOllama 위임) |
| 2 | `wikey-core/src/ingest-pipeline.ts` | line 1768 (Anthropic vision → Ollama fallback), 1773 (vision branch), 1744 (ollamaBase), 1747 (fallbackProvider) | vision fallback 그대로 + cloud 모델은 별 분기 |
| 3 | `wikey-core/src/provider-defaults.ts` | line 27 (`PROVIDER_CHAT_DEFAULTS.ollama: 'qwen3:8b'`), 39 (`PROVIDER_VISION_DEFAULTS.ollama`), 95 (fallback), 119 (context budget) | local default model 그대로 + ollama-cloud row 추가 |
| 4 | `wikey-core/src/adaptive-json-mode.ts` | line 43 `if (provider === 'ollama') return true` | local 분기 그대로 + ollama-cloud 분기 추가 (모델별 jsonMode 차이) |
| 5 | `wikey-core/src/types.ts` | line 72 `OLLAMA_URL`, line 145 `LLMProvider`, line 167 `SubscriptionProvider` | OLLAMA_URL 그대로 + OLLAMA_CLOUD_URL 신규 + LLMProvider type 확장 (5 element) |
| 6 | `wikey-core/src/config.ts` | line 28 `OLLAMA_URL: 'http://localhost:11434'` | 그대로 + OLLAMA_CLOUD_URL default 추가 |
| 7 | `wikey-core/src/canonicalizer.ts` | ollama 분기 (§5.10 D-wide LLM 자율 type 분류) | 분기 그대로 — provider key 만 추가 영향 0 |
| 8 | `wikey-core/src/query-pipeline.ts` | ollama branch | 분기 그대로 + provider key 만 추가 영향 0 |
| 9 | `wikey-core/src/embeddings/embedding-config.ts` + `qwen3-loader.ts` | Ollama qwen3:0.6b-embedding loader | embedding loader 그대로 — cloud 영향 0 |
| 10 | `wikey-core/src/search/orama-index-singleton.ts` | ollama 분기 (embedding 의존) | 그대로 |
| 11 | `wikey-core/src/scripts/benchmark-search.ts` | ollama 분기 | 그대로 |
| 12 | `wikey-core/src/scripts/cost-tracker.ts` | line 14 / 27 / 273 / 353 `'ollama-local'` provider ID | local row 변경 0 + ollama-cloud row 추가 |
| 13 | `wikey-core/src/scripts/reindex.ts` | ollama embedding 의존 | 그대로 |

**회귀 의무 절차** (§5.6.5.5 라이브 smoke 직전 master 직접):
```
1. git diff wikey-core/src/llm-client.ts > /tmp/5.6.5-llm-client.diff
2. git diff wikey-core/src/ingest-pipeline.ts > /tmp/5.6.5-ingest-pipeline.diff
... (13 file 모두)
n. master 가 13 file diff 모두 line-by-line 검토 — 의도된 변경만 (cloud 추가) + 기존 분기 (local) 영향 0 확증
n+1. npm test fresh — ollama 관련 기존 test 모두 PASS (AC-S26 mirror)
```



| 영역 | grep pattern | 기대 결과 |
|------|--------------|-----------|
| LLMProvider type 사용처 | `grep -rE "LLMProvider\b" wikey-core/src/ wikey-obsidian/src/` | Q1 결정 후 모든 site 신규 element 대응 확인 |
| SubscriptionProvider 사용처 | `grep -rE "SubscriptionProvider\b" wikey-core/src/` | Q1=b + ollama-cloud 가 subscription path 가지면 include / 안 가지면 그대로 |
| 'ollama' 리터럴 | `grep -rE "['\"]ollama['\"]" wikey-core/src/ wikey-obsidian/src/` | Q1=b 시 ollama / ollama-cloud 분기 명시 확인 (default 분기 누락 없도록) |
| OLLAMA_URL 사용처 | `grep -rE "OLLAMA_URL\b" wikey-core/src/` | Q1=a 시 URL switch helper 단일 source 확인 |
| CLI_OPTION_SUPPORT cell count | `wc -l wikey-core/src/provider-cli-options.ts` + matrix entry count | Q1=b 시 64 cell (4 × 2 × 8). matrix shape literal 검증 |
| adaptive-json-mode ollama 분기 | `grep -n "provider === 'ollama'" wikey-core/src/adaptive-json-mode.ts` | line 43 정정 — Q1=b 시 ollama (local) 와 ollama-cloud 분리 |
| renderProviderSubsection signature | `grep -nE "ProviderSubsectionSpec\b" wikey-obsidian/src/settings-tab.ts` | Q2=c 시 ollama-cloud field 추가 흔적 (endpointUrl?) |
| Settings UI 4번째 subsection | `grep -nE "renderProviderSubsection\(containerEl, " wikey-obsidian/src/settings-tab.ts` | Q2=c 시 4 call site / Q2=d 시 3 call + 1 신규 helper call |
| 시스템 언어 영문 | `rg -nE "[가-힣]" wikey-obsidian/src/settings-tab.ts` (line 1216~ 영역만) | Settings 4번째 subsection 의 user-facing text 한글 0건 (코드 주석 제외) |
| 하드코딩 catalog | `grep -nE "(llama3|qwen3|deepseek|mistral).*:cloud" wikey-core/src/` | Ollama Cloud model catalog 가 const block 으로 그룹화 + 주석 source 명시 / 분기 if-else 안 magic string 0건 |
| 회귀 라이브 cycle | `grep -nE "Ollama Cloud" wikey-obsidian/src/settings-tab.ts` (영문 4번째 subsection heading) | 1건 (heading) |

### 5.2 Golden file 위치

| 영역 | path |
|------|------|
| PoC raw stdout | `plan/phase-5/fixtures/cycle-5.6.5-ollama-cloud-poc/endpoint-probe.raw.txt` + `model-catalog.raw.txt` + `jsonmode-probe.raw.txt` |
| Benchmark fixture corpus | `docs/samples/<existing files>` → `raw/0_inbox/benchmark-5.6.5/<copies>` (master 직접 copy) |
| Benchmark golden answers | `plan/phase-5/fixtures/cycle-5.6.5-benchmark-golden/<filename>.golden.md` (Q4 결정 주체 작성) — entity / concept / mention / brief / query answer 각 영역 |
| Benchmark result table | `docs/ollama-cloud-benchmark-result.md` |
| CLI version snapshot | `wikey-core/src/provider-cli-options.ts CLI_VERSION_SNAPSHOT` (§5.6.4 v0.4 F1 mirror) — `ollama --version` capture 후 추가 |

### 5.3 라이브 cycle smoke 의무 (master 직접)

- **Phase 3 §5.6.5.2 후**: Settings tab → LLM Model Authentication section → 4번째 subsection "Ollama Cloud" 표시 확증 (CDP `:has-text("Ollama Cloud")`)
- **Phase 5 §5.6.5.4 cycle**: 각 모델별 obsidian-cdp ingest cycle (`docs/samples/<file>` → `raw/0_inbox/` copy → modal Brief → Approve & Write → Preview → wiki write). master 직접 책임 (`feedback_master_cdp_direct_smoke.md` LOCK 2026-05-12).
- **Phase 6 §5.6.5.5 통합**: 4 provider 모두 등록 + Ollama Cloud "API Key" 입력 → chat 1 query 성공 + Notice 영문 + AuthMode dropdown 의 'none' / 'api' 옵션 (subscription 옵션 hide 또는 disable, Q2 결정 의존)

---

## 6. SDD+TDD 6 step 상세

### §5.6.5.0 — 사전 PoC (master 직접, plan v1 LOCK *전*)

**의무 — §5.7.2 abandon 학습 영구 룰** (2026-05-08 LOCK).

**확정 의무 사항** (PoC 결과 → todox §3 결정 항목 mirror):

1. **endpoint** — Ollama Cloud 가 (i) local ollama CLI 의 endpoint switch (`OLLAMA_HOST=https://ollama.com ollama run ...`) (ii) 별 endpoint (e.g. `https://ollama.com/api/chat`) (iii) OpenAI-compat (`https://ollama.com/v1/chat/completions`) 중 어느 형태인지. master 가 사용자 Ollama Pro 계정으로 직접 manual call → raw stdout / response body capture (`plan/phase-5/fixtures/cycle-5.6.5-ollama-cloud-poc/endpoint-probe.raw.txt`).

2. **auth** — (i) API key header (`Authorization: Bearer ollama_*`) (ii) OAuth subscription token (`~/.ollama/auth.json`) (iii) local CLI 의 native auth state 위임 (`ollama login` 같은 subcommand) 중 어느 형태인지. master 직접 capture.

3. **jsonMode** — Ollama Cloud 의 cloud 모델 (e.g. `llama3:70b-cloud` / `qwen3:72b-cloud`) 가 `response_format: { type: 'json_object' }` (OpenAI-compat 시) 또는 `format: 'json'` (Ollama native API 시) 지원 여부. 모델별 차이 확인. master 직접 probe call.

4. **model catalog** — 가용 cloud 모델 list. local `ollama list` 가 cloud 모델도 보여주는지 vs 별 `ollama list-cloud` 같은 subcommand 인지. master 직접 capture. catalog source = 공식 (e.g. `ollama.com/library?cloud=true`).

5. **비용** — Ollama Pro 구독 token quota? per-token billing? master 가 사용자 계정 dashboard 확인 + 본 §5.6.5 의 cost metric (benchmark §5.6.5.4) baseline 으로 lock.

**PoC 산출물**:
- 4~6 raw text file (`endpoint-probe.raw.txt` / `auth-probe.raw.txt` / `jsonmode-probe-llama70b.raw.txt` / `jsonmode-probe-qwen72b.raw.txt` / `model-catalog.raw.txt` / `cost-summary.md`)
- 4 Q (Q1~Q4) 결정 항목에 PoC 결과 mirror — analyst 권장이 PoC 결과로 lock 또는 수정.

**금지** — PoC 결과를 todox §3 의 사용자 결정 항목에 *대체* 하지 X. master 권장 명시 + 사용자 최종 결정.

**PoC 실패 fallback**:
- Ollama Cloud 가 *현재 가용 X* (2025 출시 약속이 실제로는 beta 또는 지연 가능) — §5.6.5 본 cycle 전체 abandon (§5.7.2 학습 mirror — 사용자 영구 결정).
- Ollama Cloud 가 *별 endpoint + API key* (= 사실상 OpenAI-compat 형태) — provider key `'ollama-cloud'` 의 api-only path, subscription path 없음.
- Ollama Cloud 가 *local CLI 의 URL switch* 형태여도 provider key 는 여전히 `'ollama-cloud'` (UI 4번째 subsection LOCK + credential 분리, Q1=b LOCK). 내부 transport 만 URL switch variant (callOllamaCloud 안의 URL 분기).
- (이전 Q1=a "provider key 도 ollama 유지" 옵션 = **rejected historical option**, codex cycle #1 ID-2 v0.3 fix + codex cycle #2 ID-3 fix).

---

### §5.6.5.1 — Step A: Provider 추상화 layer 확장

Q1=b LOCK (사용자 결정 2026-05-14 + codex cycle #2 ID-3 fix) — 항상 별 provider key `'ollama-cloud'`. **PoC §0 결과 (2026-05-14 v0.4 paradigm shift)**: cloud endpoint = local endpoint (`http://localhost:11434`) 동일 → **`callOllamaCloud` 별 함수 분리 불필요 (Karpathy Simplicity First)**. `callOllama` 안에서 모델 식별자 cloud suffix 분기 (debug log) + 동일 transport.

**RED**: 신규 test file `wikey-core/test/llm-client-ollama-cloud.test.ts` + `wikey-core/test/ollama-cloud-dispatch.test.ts`
- A1: Q1=b LOCK — `LLMProvider` type 에 `'ollama-cloud'` 포함 (compile time check, `expectType<LLMProvider>('ollama-cloud')`)
- A2: `callOllama` 안 cloud 분기 — mock HTTP client + 모델 식별자 `:cloud` suffix (e.g. `deepseek-v3.1:671b-cloud`) → 동일 `localhost:11434` endpoint POST + debug log `'[callOllama] cloud dispatch'` capture
- A3: 401 / 429 detection → AuthFallbackInfo `'auth-missing'` (signin 안됨) / `'quota-exceeded'` reason 발화 (Ollama Cloud 의 SSH+signin auth 기반, PoC §0 §3 mirror)
- A4: timeout `600000ms` (§5.6.4 v0.6 mirror) 적용 — fetch AbortController
- A5: 사용자 Ollama Pro quota 소진 stderr / response body ("quota exceeded" / "monthly limit reached") detect → AuthFallbackInfo 발화
- **A6 (사용자 raise 3 2026-05-14)**: `isCloudModel(modelId)` helper 단위 test
  - cloud 모델 식별자 (`deepseek-v3.1:671b-cloud` / `qwen3-coder:480b-cloud` / `kimi-k2.6:cloud` / `gpt-oss:120b-cloud` / `mistral-large-3:675b-cloud`) → `true` (PoC §0 SUMMARY.md §1 LOCK)
  - local 모델 (`qwen3:8b` / `qwen3.6:35b-a3b-nvfp4` / `gemma4:26b` / `qwen3:0.6b-embedding`) → `false`
  - 경계 case (empty string / `'llama3:70b'` cloud suffix 없이) → `false`
- **A7 (사용자 raise 3 2026-05-14)**: 자동 dispatch — provider='ollama' + 모델 식별자 cloud → `callOllama` 안 cloud 분기 자동 진입 (mock spy assert: cloud debug log emit). provider='ollama-cloud' + 모델 식별자 local-only (`qwen3:8b`) → 모순 detect throw + Notice
- **A8 (사용자 raise 1 2026-05-14)**: 기존 `callOllama` (local) 회귀 — mock HTTP client + local endpoint + 모델 `qwen3:8b` → 정상 응답 + cloud debug log 0 (spy assert) + endpoint URL 동일

**GREEN**:
- `wikey-core/src/types.ts` — `LLMProvider` 확장 (5 element: `'gemini' | 'anthropic' | 'openai' | 'ollama' | 'ollama-cloud'`). **`OLLAMA_CLOUD_URL` config 추가 X** (PoC §0 §2 — endpoint 동일 `localhost:11434`, 별 URL 불필요). **`SubscriptionProvider` 재정의 X** (`Exclude<LLMProvider, 'ollama' | 'ollama-cloud'>` 로 단순 확장 — Ollama Cloud 도 SSH+signin auth 라 subscription path 아님)
- `wikey-core/src/llm-client.ts` — `callOllama` 함수 안에 `if (isCloudModel(modelId))` 분기 추가 (debug log + 응답 후처리 dispatch 영역만, transport 동일). 별 함수 분리 X (Karpathy Simplicity First, PoC §0 §6 항목 2 LOCK). 기존 `callOllama` 의 transport 시그니처 변경 0 (raise 1 회귀 0 의무)
- `wikey-core/src/ollama-model-catalog.ts` (신규, 사용자 raise 3) — const `CLOUD_MODEL_CATALOG` (PoC §0 SUMMARY §1 LOCK 5 model + capabilities + context length) + `isCloudModel(modelId): boolean` helper. 단일 source. 하드코딩 금지 LOCK 영구 룰 (`feedback_no_hardcoding_general.md`) 정합 — catalog 변경 시 본 file 1곳만 수정.
- `wikey-core/src/provider-defaults.ts` — `PROVIDER_CONTEXT_BUDGETS` 에 ollama-cloud 5 model context length 추가 (M3 unknown 은 default 32K fallback, PoC §0 §6 항목 5 mirror). `PROVIDER_CHAT_DEFAULTS.ollama-cloud` 슬롯 (Step E benchmark winner 결정 후 채움, 임시 default = `'deepseek-v3.1:671b-cloud'`).
- `wikey-core/src/auth-resolver.ts` — `SubscriptionProvider` 재정의 (PoC §0 §3 결과: ollama-cloud 가 SSH+signin auth → subscription path **없음** → `Exclude<LLMProvider, 'ollama' | 'ollama-cloud'>` 로 단순 확장). 단 별 type `OllamaCloudProvider` 신설 X — `'ollama-cloud'` literal 직접 사용.

**3a 회귀**: `npm test` (wikey-core + wikey-obsidian fresh) / `npm run build` / `./scripts/validate-wiki.sh`

**3b BLUE**: `callOllama` 안 cloud 분기 helper extract 검토 — 함수 분해 50+ LOC 검토. Naming: `dispatchOllamaModel(modelId, opts)` helper 만 추출 검토 (cloud / local 동일 endpoint 라 분기 ≤ 10 LOC 예상 → extract 불필요 가능성). DRY: `buildOllamaPayload(opts)` helper 가 이미 있다면 그대로 재사용 + cloud-only post-process (M5 markdown wrap strip) 만 추가.

---

### §5.6.5.2 — Step B: Settings UI 4번째 subsection

Q2 결정 후 (c or d) 진행.

**RED**: `wikey-obsidian/test/settings-tab-ollama-cloud.test.ts`
- B1: Settings tab 안 "LLM Model Authentication" section 의 subsection count = **4** (현재 3 → 신규 4번째 "Ollama Cloud")
- B2: 4번째 subsection heading text = `"Ollama Cloud"` (영문, 시스템 언어 LOCK)
- B3: AuthMode dropdown 의 옵션 — Q2 결정 후 — (c) 시 `('none' / 'api')` 만 표시 (subscription 옵션 hide 또는 disable, ollama 가 subscription path 없으면) / (d) 시 dropdown 자체 없음
- B4: Endpoint URL row 표시 + 입력 시 `WikeyConfig.OLLAMA_CLOUD_URL` 업데이트
- B5: API Key row 표시 + 입력 시 `credentials.json.ollamaCloudApiKey` 업데이트 (lower-camel, §5.6.4 §3.4 schema mirror)
- B6: CLI install status badge — Q1=b LOCK (사용자 결정 2026-05-14 + codex cycle #3 ID-4 fix) → cloud `'ollama-cloud'` provider key 의 'cloud (API key)' badge variant. 단일 path (이전 Q1=a "ollama local CLI 의 cloud 호출" 옵션 = rejected historical option, codex cycle #3 ID-4 fix)

**GREEN**: `wikey-obsidian/src/settings-tab.ts` 안 Q2=c 시 `renderApiKeysSection` 의 4번째 `renderProviderSubsection` 호출 추가 + helper signature 의 `ProviderSubsectionSpec` 에 신규 field (`endpointUrlField?` / `apiKeyField` re-use) 추가. Q2=d 시 `renderOllamaCloudSubsection` 신규 helper + `renderApiKeysSection` 안 4번째 call 분기.

**3a 회귀**: 기존 3 provider subsection 회귀 없음 확증. helper signature 변경 시 기존 call site 3개 영향 확인.

**3b BLUE**: helper signature 가 ollama 의 mismatch (subscription 없음, endpoint URL 있음) 표현 명확성 검토. Q2=c 시 `ProviderSubsectionSpec` field 가 optional 의 nest level 검토 (Karpathy "추측 코드 금지" — 미사용 field 0).

---

### §5.6.5.3 — Step C: adaptive jsonMode + CLI_OPTION_SUPPORT matrix 확장

**RED**: 기존 `wikey-core/test/provider-cli-options.test.ts` + `wikey-core/test/adaptive-json-mode.test.ts` 확장
- C1: Q1=b LOCK — `CLI_OPTION_SUPPORT` 의 row 축이 `CliOptionMatrixProvider = SubscriptionProvider \| 'ollama-cloud'` (4 element). `CLI_OPTION_SUPPORT['ollama-cloud']` row 추가 (8 field × 2 path = 16 cell). matrix shape literal 검증 (`Object.keys(CLI_OPTION_SUPPORT).length === 4`).
- C2: `resolveJsonModeNative` 가 `provider === 'ollama'` 인 경우 (local) 와 `'ollama-cloud'` 인 경우 (cloud) 분리 처리 — `adaptive-json-mode.ts:43` 정정. cloud 모델별 jsonMode 차이 적용 (PoC §0 fixture 기반).
- C3: 회귀 — gemini / anthropic / openai 의 기존 matrix cell 변경 0건 (byte-equal grep)
- C4: PoC 결과 fixture 기반 — Ollama Cloud 의 jsonMode 가 (i) 모델별 native 지원 (`llama3:70b-cloud` 시 'native') (ii) 미지원 ('unsupported' + adaptive prefix) 어느 case 인지 matrix 에 반영

**GREEN**: `wikey-core/src/provider-cli-options.ts` 안 `CliOptionMatrixProvider` type + `ollama-cloud` row 추가 (Q1=b LOCK). `wikey-core/src/adaptive-json-mode.ts:43` 분기 정정. `CLI_VERSION_SNAPSHOT` 에 ollama version (master PoC capture) 추가.

**3a 회귀**: matrix 48 cell → **64 cell** (4 provider × 2 path × 8 field, Q1=b LOCK) byte-level 일치 확인. adaptive jsonMode unit test PASS.

**3b BLUE**: ollama-cloud row 의 cell 값 결정 logic 의 단일 source 명시 (PoC §0 fixture 참조 주석).

---

### §5.6.5.4 — Step D: 벤치마크 harness (사용자 강조 — ~46% volume)

본 step = 본 §5.6.5 의 핵심. Spec §"Spec 4" 의 AC 와 1:1 mapping.

**3-agent 위임 layer LOCK** (사용자 raise 4/5/11/12 2026-05-14):

1. **analyst (in-process, 본 세션 background 진행 중)** — `docs/ollama-cloud-benchmark-plan.md` 안 benchmark **plan + framework** 작성. 코드 실행 X. 산출 → **master 1차 검증** (raise 12) → 필요 시 codex 2차.
2. **developer (in-process, master 가 analyst plan APPROVE 후 호출, raise 11)** — harness 코드 + 모델별 LLM 호출 + metric 수집 + 결과 markdown 생성. 단위 / 통합 test 모두 GREEN. 산출 → **master 1차 검증** (raise 12).
3. **master (direct)** — analyst → developer prompt 작성 + 두 산출 1차 검증 + 라이브 cycle smoke 1 회 winner 모델 obsidian-cdp (`feedback_master_cdp_direct_smoke.md` LOCK).

**RED**: Q3 결정 후 (e / f / g) 진행 (analyst plan 의 Q3 권장안 mirror 후).

**Sub-step D-1: 벤치마크 fixture corpus 준비**

- master 직접 `docs/samples/` 의 **7 file F1~F7 LOCK** (사용자 결정 2026-05-14 raise 4~12 + codex cycle #3 ID-3 fix):
  - F1: ROHM_Wi-SUN Juta통신모듈(BP35CO-J15).pdf.md (1.4M, 한국어, datasheet)
  - F2: rp1-peripherals.pdf.md (1.8M, 영문, datasheet)
  - F3: Examples.hwpx.md (1.6M, 한국어, HWPX 변환)
  - F4: 사업자등록증C_(주)굿스트림_*.pdf.md (753B, 한국어, 고-PII)
  - F5: PMS_제품소개_R10_*.pdf.md (6.1M, 한국어, 대용량)
  - F6: GOODSTREAM Solutions...md (12K, 영문, 소형)
  - F7: **C20260410_용역계약서_SK바이오텍전자구매시스템구축.pdf.md** (12K, 한국어, 중-PII) — 이전 "스마트공장 hwp" 교체 LOCK
  - 모두 `raw/0_inbox/benchmark-5.6.5/` 안으로 copy
- copy script (Q3=g hybrid LOCK) 의 bash orchestration 영역 — idempotent
- PII 검토 — **6 종 grep regex** (사업자번호 / 주소 group(...) / 계약 당사자명 / 계약 금액 / 일정 / 영업비밀, docs §5.4 mirror) — 결과 markdown 안 누출 0건 확증

**Sub-step D-2: 평가 모델 set — 8 model LOCK** (사용자 raise 17/18/22 + PoC §0 식별자 확정 + codex cycle #3 ID-2 fix)

| # | 모델 (PoC §0 LOCK) | size | context | jsonMode | 영역 |
|---|---------------------|------|---------|----------|------|
| M1 | **`deepseek-v3.1:671b-cloud`** | 671B (deepseek2) | (default) | native ✅ | cloud large |
| M2 | **`qwen3-coder:480b-cloud`** | 480B | (default) | native ✅ | cloud large (qwen3:122b 부재 → 사용자 결정 LOCK 대체) |
| M3 | **`kimi-k2.6:cloud`** | unknown | (default) | native ✅ | cloud large (vision+thinking+tools) |
| M4 | **`gpt-oss:120b-cloud`** | 117B (gptoss, MXFP4) | 131K | native ✅ | cloud large |
| M5 | **`mistral-large-3:675b-cloud`** | 675B (mistral3, FP8) | 262K | native ⚠️ markdown wrap (strip 의무) | cloud large (Ollama Cloud 의 유일한 Mistral cloud, 사용자 raise 22-1 LOCK) |
| B1 | **`gemini-2.5-flash`** | — | — | (subscription path §5.6.4) | subscription baseline (사용자 강조 #1) |
| L1 | **`qwen3:8b`** | 8B | (default) | native ✅ | local current basic (raise 18) |
| L2 | **`qwen3.6:35b-a3b-nvfp4`** | 35.1B (qwen3_5_moe, nvfp4) | 262K | adaptive prefix 의무 (mlx runner format:json unsupported) | local current MoE (raise 22 2026-05-14) |

각 모델 7 fixture × 6 task × 3 cycle = 126 measurement / model.
**총 = 8 × 126 = 1,008 measurement** (PoC v0.4 LOCK).

**작은 cloud 모델 제외 LOCK** (raise 17, codex cycle #3 ID-2 fix): 이전 `llama3:70b-cloud` / `qwen3:72b-cloud` / `mistral-large-cloud` 후보는 **rejected** — 사용자 결정 M1~M5 만.

**Sub-step D-3: 평가 task 6 (wikey 도메인 deep paradigm raise 19, codex cycle #3 ID-1 fix)**

| Task | wikey stage | metric | weight |
|------|-------------|--------|--------|
| **canonicalize** | §5.10 D-wide canonicalizer LLM 자율 type 분류 + alias normalization (`canonicalizer.ts:195`) | Jaccard(predicted slug set, golden slug set), confusion matrix | 0.25 |
| **mention extraction** | ingest-pipeline mention extractor (§5.21 ingest mention guard v0.6, `ingest-pipeline.ts:885`+`:1178`) | precision / recall / F1 | 0.20 |
| **brief / summary** | 사용자 인제스트 승인 화면용 brief ≤ 30 줄 (`ingest-modals.ts:497`) | ROUGE-L + LLM-as-judge (`gemini-2.5-flash`) | 0.15 |
| **query answer** | sidebar-chat citation + 1-hop wikilink (`sidebar-chat.ts:686`) | citation precision + answer ROUGE-L | 0.20 |
| **cross-reference** (raise 19) | wikilink 그래프 1-hop 정합성 (`mention-guard.ts` + `canonicalizer.ts`) | 1-hop precision + orphan ratio | 0.10 |
| **hallucinate detection** (raise 19) | source-grounded LLM 평가 (§5.21 v0.6 guard 정합) | hallucinate rate + grounding precision | 0.10 |

합 = 1.00. **7 model × 7 fixture × 6 task × 3 cycle repeat = 1,008 measurement** (raise 19 deep paradigm, codex cycle #3 ID-1 fix).

**Sub-step D-4: 평가 metric (사용자 강조 — 정확도 + latency + cost + 의미 보존)**

| Metric | 단위 | 측정 방법 |
|--------|------|-----------|
| **accuracy** | 0~1 float | Jaccard / F1 / ROUGE-L (task 별, Spec §AC 명시) |
| **latency cold** | ms | first ingest call wall-clock (모델별, master CDP `console.time`) |
| **latency warm p50/p95** | ms | 5 cycle repeat (Spec §AC 명시 — `benchmark-search.ts` mirror) |
| **cost per ingest** | tokens or USD | Ollama Pro quota / API token billing (PoC §0 cost model lock) |
| **semantic preservation** | 0~1 float | (i) Korean mention 한자 변환 오류 ratio (golden 의 한글 mention 중 한자 출력된 비율) (ii) English datasheet pinmap 표 markdown 변환 ratio (golden table 의 row count 대비 predicted row count) (iii) LLM-as-judge (gemini-2.5-flash judge) 의미 보존 score 0~10 |

**Sub-step D-5: 실행 + 결과 정리**

- 각 모델 × 7 fixture × 4 task = 최대 140 cell measurement
- Q3=g 시 bash orchestration (obsidian-cdp ingest cycle smoke per model) + ts metric 집계 (golden 비교 / latency 통계 / cost calc)
- 결과 = `docs/ollama-cloud-benchmark-result.md` (모델 × task × metric 비교표 + 추천 모델 1개 + cost-benefit 분석)
- 라이브 cycle smoke 의무 (master 직접) — 모델별 1~2 fixture ingest CDP cycle (사용자 가시)

**RED test**:
- D1: 단위 — `benchmark-models.ts` (Q3=f-g) 의 fixture copy / model dispatch / metric 집계 로직 unit test (mock LLM 응답)
- D2: 단위 — golden 비교 algorithm (Jaccard / F1 / ROUGE-L) deterministic — 동일 input → 동일 score
- D3: 통합 — mock LLM 환경에서 1 fixture × 2 model × 1 task 시뮬레이션 → 결과 markdown 출력 검증
- D4: PII grep — 결과 markdown 안 사업자등록번호 / 주소 0건 (regex pattern)

**GREEN**: Q3 결정 결과로 구현. `scripts/benchmark-ollama-cloud.sh` (Q3=e-g) + `wikey-core/src/scripts/benchmark-models.ts` (Q3=f-g) + golden answer set (Q4 결정 주체 작성, `plan/phase-5/fixtures/cycle-5.6.5-benchmark-golden/`).

**3a 회귀**: 기존 `benchmark-search.ts` 변경 0건 (인접 영역 surgical 의무).

**3b BLUE**: harness 의 plug-and-play (모델 set / task set / metric 함수 확장성). 단 Karpathy "추측 코드 금지" — 본 §5.6.5 의 5 모델 외 미래 모델 확장성 over-engineering 0.

**라이브 cycle smoke 의무 (master 직접 — 본 step 의 산출물)**:
- 각 모델별 obsidian-cdp ingest cycle: `docs/samples/<file>` → `raw/0_inbox/` copy → modal Brief → Approve & Write → Preview → wiki write → console.time evidence capture
- 사용자 가시 (Notice 영문 / Processing time / wiki write page count)
- `feedback_master_cdp_direct_smoke.md` LOCK 2026-05-12 mirror

---

### §5.6.5.5 — Step E: 통합 검증 + 라이브 cycle smoke + production 채택

Q5 결정 후 (k / l / m) 진행.

**RED**:
- E1: 통합 — 4 provider 모두 등록 + Ollama Cloud 4번째 subsection 표시 + chat 1 query 정상 동작 (mock + 라이브)
- E2: routing matrix 회귀 — Q1=b LOCK 시 `resolveAuthMode('ollama-cloud', config, presence)` 가 'subscription' / 'api' / 'none' mode 별 정확 처리
- E3: buildConfig 호출 site 5 (§5.6.4 §5.2 A6 mirror) 회귀 — ollama-cloud auth mode 전파 확인
- E4: Settings UI 4 subsection 모두 영문 + heading text 정확 (`"Ollama Cloud"` 영문 LOCK)
- E5: 추천 모델 1개 (Q5 결정) 가 `PROVIDER_CHAT_DEFAULTS` / `PROVIDER_CONTEXT_BUDGETS` / `PROVIDER_VISION_DEFAULTS` 에 추가 + 회귀 0
- **E6 (사용자 raise 1 2026-05-14)**: **기존 ollama (local) 회귀 0 의무 — 13 source file 영역 (§5.1 grep matrix) 별 `git diff` line-by-line 검토**
  - master 직접: `for f in $(cat /tmp/5.6.5-ollama-source-files.txt); do git diff "$f" > /tmp/5.6.5-diff-$(basename $f).log; done`
  - 의도 변경 (cloud path 추가) vs 의도치 않은 분기 변경 분류 → 후자 = 0건 확증
  - `wikey-core/test/` 의 기존 ollama 관련 test (e.g. `llm-client.test.ts` 의 `callOllama` cases, `cost-tracker.test.ts` 의 `ollama-local` cases, `qwen3-loader.test.ts` 의 embedding loader cases) 모두 PASS 확증
  - 라이브 — Settings 에서 provider='ollama' (local) 선택 + 모델 `qwen3:8b` + ingest 1 fixture → cloud endpoint 호출 0 (WIKEY_DEBUG_AUTH=1 dispatch log 확증)
- **E7 (사용자 raise 3 2026-05-14)**: 모델 식별자 자동 구분 라이브 — Settings 에서 provider='ollama' (local) 선택 + 모델 `llama3:70b-cloud` 입력 → 자동 cloud dispatch + WIKEY_DEBUG_AUTH 로그 capture. 역방향 — provider='ollama-cloud' + 모델 `qwen3:8b` (local-only) → 모순 detect Notice 표시 (AC-S31)

**GREEN**: Q5 결정 결과로 구현. `wikey-core/src/provider-defaults.ts` 안 ollama-cloud 의 default model + context budget 추가 (벤치마크 winner).

**3a 회귀**: full `npm test` + `npm run build` + `./scripts/validate-wiki.sh`. wiki 재생성 없음 확증 (`git diff wiki/` empty).

**3b BLUE**: `PROVIDER_CHAT_DEFAULTS` table 의 ollama / ollama-cloud row 의 default 결정 logic 주석 (벤치마크 §5.6.5.4 결과 참조).

**라이브 cycle smoke (master 직접 — 종결 의무)**:
- 4 provider 모두 등록 상태 → 사용자가 Settings UI 에서 Ollama Cloud 4번째 subsection 선택 → AuthMode = 'api' → API Key 입력 → Test 버튼 → "✓ Connected" → chat panel 1 query → 답변 정상 + citation + Notice 0건 ("Subscription quota exceeded" 같은 fallback Notice 없음, 정상 path)

**post-impl**:
- memory 등록 `~/.claude/projects/-Users-denny-Project-wikey/memory/project_phase5_session<N>_5.6.5_done.md`
- `MEMORY.md` index 갱신
- `plan/phase-5/phase-5-todo.md §5.6.5` 체크박스 갱신 ([ ] → [x] 종결 entry, `/sync` 의무 mirror)
- `wiki/log.md` ingest 항목 (벤치마크 corpus 7 file 의 wiki 페이지 생성 기록)

---

## 7. 사용자 결정 게이트 (analyst plan → master 1차 → codex max 3 cycle → 사용자 최종 승인 → 구현 진입)

**v0.3 갱신** (사용자 raise 11/12 2026-05-14): §5.6.5.4 Step D 의 3-agent 위임 layer 명시 + master 1차 검증 의무 모든 산출 LOCK.

1. **analyst plan #1** (본 todox + spec v0.3) 작성 완료
2. **master 1차 검증** — 20 anchor (7-anchor internal consistency + 6 codex pattern P1~P6 + 7 fix mode F1~F7) + Karpathy/schema 4 원칙 (raise 12)
3. **codex Mode D Panel cycle #1** — plan APPROVE 또는 NEEDS_REVISION (max 3 cycle, 사용자 명시)
4. **analyst plan #2** (docs/ollama-cloud-benchmark-plan.md) 작성 — background 진행 중. 산출 후 → **master 1차 검증 (raise 12)** → 필요 시 codex Mode D 2차
5. **사용자 최종 승인 (gate)** — 본 todox §3 의 Q2~Q5 결정 항목 명시 (Q1=b LOCK) + analyst plan #2 결정 사항 + master PoC §0 진행 승인
6. **master Phase 1 PoC** 진행 (사용자 Ollama Pro 계정으로)
7. PoC 결과 → todox §3 mirror 갱신 + analyst plan #2 mirror → 사용자 재승인 (gate 2)
8. **구현 진입** — master 가 Step A/B/C 메인 세션 (`wikey-core/src/` provider 추상화 + Settings UI + jsonMode adaptive) 직접 진행
9. **Step D 위임 → developer** (raise 11): master 가 analyst plan #2 + Q2~Q5 결정 + AC 기반 developer prompt 작성 → developer 가 harness 코드 + 모델별 측정 + 결과 markdown 생성 → **master 1차 검증 (raise 12)** → 필요 시 codex 2차
10. **Step E 통합** — master 가 라이브 cycle smoke (winner 모델 obsidian-cdp 1 회) + memory 등록 + push
11. **codex Mode D Panel cycle #2 post-impl** — APPROVE 후 push 의무 (§5.6.4 mirror)

**사용자 5분 무응답 rule** (`feedback_5min_wait_then_proceed.md` LOCK 2026-05-13): destructive irreversible 작업 아님. 사용자 raise 5분 무응답 시 master 권장 옵션 자동 진행 + 종결 시 보고. 단 본 §5.6.5 의 Q1~Q5 = 영구 결정 (회귀 면적 ↑) — master 권장 진행 후 향후 사용자 변경 요청 시 별 cycle 의무.

---

## 8. Self-check (analyst — wikey 7-anchor 자체 + 추가 4 anchor)

| Anchor | 검증 | 결과 |
|--------|------|------|
| (a) Goal 명시 | spec §1.1 Goal — Ollama Cloud 통합 + 벤치마크 6 task deep + 4번째 subsection + best-fit + community + raise 17/18/19 통합 | PASS |
| (b) Non-Goal 명시 | spec §1.1 Non-Goal — 자체 OAuth 구현 / 새 cloud provider 추가 / Stage-aware routing | PASS (spec 별도) |
| (c) Invariants 명시 | spec §1.2 Invariants (I1~I12 + I5b) | PASS (spec 별도) |
| (d) AC measurable | spec §1.3 **AC-S1~AC-S31** (v0.2 raise 1~3 S25~S31 + v0.3 codex fix, codex cycle #2 ID-4 fix) | PASS (spec 별도) |
| (e) TestCases RED→GREEN | spec §1.5 (AC ↔ test file mapping) + 본 §6 각 step 의 RED → GREEN → 3a → 3b 명시 | PASS |
| (f) Dependencies enumerate | spec **§1.6** Dependencies (codex cycle #2 ID-4 fix, 이전 §1.5 표기 drift) | PASS (spec 별도) |
| (g) Risks + Mitigation | spec §1.7 Risks (R1~R12 — v0.2 raise 1~3 R10/R11/R12 신규 + v0.3 codex fix) | PASS (spec 별도) |
| **(h) Karpathy 4 원칙** (Wikey 추가) | spec §0 Context Karpathy 정합 — Explicit (model catalog 가시화) / Yours (PoC fixture local commit) / File over app (벤치마크 결과 markdown) / BYOAI (4번째 provider 자유 교체) | PASS (spec 별도) |
| **(i) 3계층 경계** (Wikey 추가) | raw/ 수정 X (벤치마크 fixture = `raw/0_inbox/benchmark-5.6.5/` 사용자 승인 후 copy, schema §"원시 소스 관리" 정합), wiki/ = LLM 소유 (벤치마크 결과 = wiki 외부 `activity/` 영역), schema = 본 plan 의 변경 0 | PASS |
| **(j) 워크플로우 4 일관** (Wikey 추가) | ingest (벤치마크 corpus ingest) / query (벤치마크 task 4 의 query) / lint (회귀 validate-wiki.sh) / 삭제 (벤치마크 fixture 정리 시 raw 삭제 절차 schema §"삭제 (Delete)" 정합) | PASS |
| **(k) 하드코딩 금지** (Wikey 추가, 설계 단계부터 §5.7.6 ABANDON 학습) | Ollama Cloud endpoint / model catalog / quota detection regex 모두 const block (각 const 주석 source) + LLM 의 의미론적 판정 (벤치마크 grading) = LLM 호출 + cache. static stopword / 분류 list 0건. 벤치마크 LLM-as-judge 도 LLM 동적 결정 (gemini-2.5-flash 1회 호출 per task) | PASS |

**미확정 사항 (PoC 단계로 deferred)**:
- Ollama Cloud endpoint 정확한 URL 형식 → §5.6.5.0 PoC
- jsonMode 모델별 지원 차이 → §5.6.5.0 PoC
- 가용 cloud 모델 catalog → §5.6.5.0 PoC
- Ollama Pro 비용 모델 (quota / per-token) → §5.6.5.0 PoC

미확정 사항 hallucinate 0건 (Karpathy "Think Before Coding" — 가정 명시 + 미확정 → PoC deferred).
