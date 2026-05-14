---
phase: 5
section: 5.6.5
title: Ollama Cloud — large-model integration + cross-provider benchmark (Spec)
status: planning
created: 2026-05-14
updated: 2026-05-14
version: v0.3
---

# Phase 5 §5.6.5 Ollama Cloud — large-model integration + cross-provider benchmark (Spec, WHAT)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.6.5`](./phase-5-todo.md) · [`plan/phase-5/phase-5-todox-5.6.5-ollama-cloud.md`](./phase-5-todox-5.6.5-ollama-cloud.md)
>
> **이력**:
> - v0.1 (2026-05-14, 초안) — analyst 산출 (사용자 raise 정식 plan 진입 결정).
> - v0.2 (2026-05-14, master 1차 검증 fix) — 사용자 라이브 raise 3건 반영 (회귀 검증 / 병행 사용 / 모델 식별자 자동 구분).
> - **v0.3 (2026-05-14, codex cycle #1 NEEDS_REVISION 7 finding fix + 사용자 raise 4/5 통합)** — 변경 2 paradigm:
>   - **사용자 raise 4 + 5 (2026-05-14)** — benchmark 영역 (§5.6.5.4 Step D + Spec 4 + AC-S17~S20) 을 **본 §5.6.5 안에 그대로 유지** + **본 세션에서 analyst 서브에이전트 위임**. 즉 section 분리가 아니라 *작업 위임 layer 의 분리*. master = §5.6.5 통합 (Step A/B/C/E) 메인 세션 진행 / analyst 서브에이전트 = §5.6.5.4 benchmark plan 정밀화 + fixture corpus 7 file 결정 + golden answer 작성 plan 작성 + 평가 metric 단위 계약. analyst 산출 후 master 가 §5.6.5.4 mirror.
>   - **codex cycle #1 7 finding fix**: (1) ID-1 version v0.2 → v0.3 frontmatter + LOCK 문구 정정 / (2) ID-2 Q1=a fallback 잔존 제거 + phase-5-todo §5.6.5 LOCK mirror / (3) ID-3 matrix shape 명시 — `type CliOptionMatrixProvider = SubscriptionProvider | 'ollama-cloud'` (4 provider 8 field 2 path = 64 cell, local ollama 제외) / (4) ID-4 endpoint placeholder `https://ollama.com` → `e.g.` 표기 (PoC §0 lock) / (5) ID-5 self-check drift R1~R12 + AC-S1~S31 정정 / (6) ID-6 Ollama Pro terms gate Dependencies + Risks 추가 + 용역계약서 fixture 포함 여부 사용자 결정 deferred / (7) ID-7 commit prefix policy §4 column 추가.
>
> **본 §5.6.5 = §5.6.4 종결 (Session 42, 2026-05-13 commit `e68c53d` push) 후 사용자 raise 정식 plan 진입 결정 (2026-05-14)**. 본 v0.3 = analyst plan v0.1 → master fix v0.2 (raise 1~3) → codex cycle #1 fix + raise 4/5 통합 v0.3.

## 0. Context

**도출 source**: 사용자 raise 2026-05-14 — Ollama Pro 구독중. gemini-2.5-flash 와 경쟁 가능한 대형 클라우드 모델 사용 + 벤치마크 비중 ↑ + **ollama local + cloud 병행 사용 구조 명시** (사용자 raise 2026-05-14 라이브).

**이득**:
- **정성** — 사용자 보유 Ollama Pro 구독 활용 (이미 결제한 자산). gemini-2.5-flash 외 대안 확보 → vendor lock-in 회피 (Karpathy BYOAI 원칙 강화).
- **정성** — 벤치마크 결과 (모델 × task × metric) 자체가 wikey project 의 *지식 자산* — 향후 새 모델 출시 시 vector compare baseline. 사용자 ingest 우선순위 결정 데이터.
- **정량** — 벤치마크 winner 모델이 gemini-2.5-flash 대비 cost-quality ratio 우세 시 → production cost ↓ (Q5=l: canonicalize 단계만 cloud 70B 사용 시 비용 효율 + 품질 균형).
- **정량** — 사용자가 인터넷 비가용 시점 (예: 비행기 / 시골) ollama local fallback 가능 (단 local 8B vs cloud 70B 품질 차이 인지).

**Trade-off**:
- Ollama Cloud catalog 변동 risk — beta / 가격 변경 / 모델 제거 가능성. cost-tracker.sh 의 baseline lock 시 변동 detection 의무.
- 벤치마크 fixture corpus (`docs/samples/`) 의 PII 포함 (`사업자등록증C_*` / `용역계약서_SK바이오텍전자구매시스템구축`) — 결과 markdown 안 PII 누출 0건 grep 의무.
- LLM-as-judge (gemini-2.5-flash judge) 의 bias — gemini-2.5-flash 가 baseline + judge 동시 역할 시 self-bias 가능. mitigation = LLM committee (3 model 합의) 또는 사용자 직접 spot-check.
- jsonMode 모델별 차이 (PoC §0 확정 후) — adaptive prefix 폐쇄 영역 (§5.6.4 v0.7 R2 fix mirror).

**Karpathy 4 원칙 정합** (wikey.schema.md §"LLM Wiki 개인화의 4가지 장점"):
- **Explicit** — 벤치마크 결과 = `docs/ollama-cloud-benchmark-result.md` 안 명시. 어느 모델이 어떤 task 에서 강한가 가시화. AI 의 모델 선택이 wiki 외부 평가 자료로 가시화.
- **Yours** — 벤치마크 fixture / golden / result 모두 local + Git 안 lock. 외부 leaderboard 의존 0.
- **File over app** — 벤치마크 결과 = markdown table. Unix 도구 (`grep`, `wc -l`, `awk`) 호환.
- **BYOAI** — 4번째 provider (Ollama Cloud) 추가 = provider 자유 교체 강화. 사용자 가 Settings UI 에서 dropdown 으로 즉시 전환.

**3계층 정합** (wikey.schema.md §"3계층 아키텍처"):
- raw/ = 사용자 소유 / 불변. 벤치마크 fixture = `docs/samples/` (raw 외부) → `raw/0_inbox/benchmark-5.6.5/` 사용자 승인 후 copy. raw 안 내용 수정 X.
- wiki/ = LLM 소유. 벤치마크 ingest 결과로 생성된 wiki 페이지 (sources / entities / concepts) 는 정상 ingest 산출물 — 별도 처리 X. 단 벤치마크 metric 자체 (수치 비교표) 는 wiki 외부 (`activity/`).
- schema = 본 plan 의 변경 0건. `wikey.schema.md` Edit 0.

**워크플로우 4 정합** (wikey.schema.md §"시스템 워크플로우"):
- **ingest** — 벤치마크 corpus 각 fixture 가 정상 ingest 흐름 통과 (modal Brief → Approve & Write → wiki write).
- **query** — 벤치마크 task 4 의 "query answer" 영역이 sidebar-chat citation 흐름 통과.
- **lint** — `validate-wiki.sh` 회귀 0 확증.
- **delete** — 벤치마크 fixture 정리 시 사용자 승인 후 raw 삭제 + LLM이 wiki 정리 (schema §"삭제 (Delete)" 정합).

---

## 1. Specs

### 1.1 Goal / Non-Goal

**Goal**:
- Ollama Cloud (ollama.com hosted) 의 대형 cloud 모델 (e.g. `llama3:70b-cloud` / `qwen3:72b-cloud` 등 — PoC §0 catalog 확정 시점 lock) 을 wikey 의 4번째 provider 로 통합. **ollama local + cloud 병행 사용 LOCK** (사용자 raise 2 2026-05-14) — 두 path 동시 등록 + 사용자가 UI dropdown 으로 즉시 전환 + 시스템 내부 자동 dispatch.
- **모델 식별자 자동 구분** (사용자 raise 3 2026-05-14) — cloud 모델 식별자 패턴 (e.g. `:cloud` suffix 또는 PoC §0 catalog lookup) 으로 callOllama (local) / callOllamaCloud 자동 dispatch. 모델 catalog = const block 단일 source (PoC §0 lock). UI 의 별 subsection 표시 (Q1=b) + 내부 dispatch 자동 (raise 3) 두 layer 모두 정합.
- Settings UI 의 `LLM Model Authentication` section 안 4번째 subsection (`Ollama Cloud`) 추가 — 기존 3 provider (Gemini / Anthropic / OpenAI) subsection 과 시각적 구조 동일.
- **벤치마크의 핵심 목적 = wikey 도메인 (문서 인제스트 + 의미 분해 + canonicalize + query) 에 가장 적합한 모델 1개 발견** (사용자 raise 6 2026-05-14). 단순 latency / cost 비교가 아니라 *wikey 의 사용 case 별 정확도 + 문서·의미 보존* 이 winner 결정의 1순위. cost 는 동률 시 tie-breaker.
- **community 평가 reference 참조** (사용자 raise 7 2026-05-14) — HuggingFace Open LLM Leaderboard / LMSYS Chatbot Arena / Korean LLM Leaderboard / Ollama Library catalog 등 외부 community score 를 평가 모델 set 선정 + 비교 column 으로 포함. wikey 자체 fixture 측정 결과 + community 평가 score 가 일관되면 신뢰도 ↑, 불일치 시 *wikey 도메인 specific 차이* 분석 가치. analyst 서브에이전트 prompt 에 명시.
- 본 §5.6.5 안 §5.6.5.4 Step D 그대로 유지 + **3-agent 위임 layer** (사용자 raise 4/5/11/12 2026-05-14):
  1. **analyst (in-process, background)** = `docs/ollama-cloud-benchmark-plan.md` 안 benchmark **plan + framework** 작성 (평가 모델 set / fixture corpus 결정 / metric method / community fetch / best-fit algorithm). **코드 실행 X**. 산출 종결 후 → **master 1차 검증** (raise 12 명시 LOCK — 7-anchor + Karpathy + schema cross-check) → 필요 시 codex Mode D Panel 2차.
  2. **developer (in-process, master 가 analyst plan APPROVE 후 호출, raise 11)** = harness 코드 + fixture copy + 모델별 LLM 호출 실행 + metric 수집 + 결과 markdown (`docs/ollama-cloud-benchmark-result.md`) 생성. 단위 / 통합 test (mock LLM 시뮬레이션) 모두 GREEN. 산출 종결 후 → **master 1차 검증** (raise 12 LOCK — fresh `npm test` + AC 일치 + 결과 markdown 영역 byte-level grep) → 필요 시 codex 2차.
  3. **master (direct)** = (i) analyst plan → developer prompt 작성 (ii) **두 산출 모두 1차 검증** (raise 12 LOCK) (iii) **라이브 cycle smoke 1 회 winner 모델 obsidian-cdp 가시 ingest** (`feedback_master_cdp_direct_smoke.md` LOCK 2026-05-12 — 위임 불가).
- adaptive jsonMode (§5.6.4 v0.7 R2 fix) 의 ollama 분기 정정 — cloud 모델별 jsonMode 지원 차이 반영. **기존 ollama (local) 분기 변경 0** — 13 source file (raise 1).
- BYOAI 원칙 강화 — 사용자가 cloud 모델 + local 모델 + 3 subscription provider 중 자유롭게 선택.

**Non-Goal**:
- 자체 Ollama OAuth 구현 — 본 cycle 은 Ollama Cloud API key (또는 PoC §0 결과 의존 auth flow) 위임만.
- 새 cloud provider 추가 (xAI Grok / Mistral La Plateforme / Cohere) — Ollama Cloud 1개만.
- Stage-aware routing (cost optimization 기반 task 별 provider 자동 선택) — Q5=l 옵션은 production 채택 시 1 helper 만 (canonicalize 단계 분기) / 본격 routing engine 은 별 cycle.
- 벤치마크 자동화 (cron / CI 통합) — manual trigger 만 (사용자 명시 호출).
- 벤치마크 fixture corpus 확장 (현재 7 file 외 추가) — 본 cycle 은 `docs/samples/` 의 기존 7 file 만. 신규 corpus 는 별 cycle.
- `PROVIDER_VISION_DEFAULTS` 의 ollama-cloud vision 모델 결정 — vision = 현재 cycle scope 밖 (text-only). 단 type 추가 시 record 의 ollama-cloud field 는 placeholder (e.g. fallback to ollama-local) 추가.
- credentials.json migration 의 backward-incompatible 변경 — 기존 ollama (local) 사용자 회귀 0 의무.

### 1.2 Invariants (불변식, LOCK)

- **(I1) 4번째 subsection 시각적 동일** — `Ollama Cloud` subsection 의 시각 구조 (heading / Auth Mode row / 인증 row / API Key row) 가 기존 3 provider subsection 과 동일 layout (사용자 강조 #3). CSS class 재사용 (`wikey-auth-block` / `wikey-auth-block-row`).
- **(I2) wiki 재생성 없음** — provider 추가 + UI subsection + jsonMode 분기 + 벤치마크 harness 만. wiki 본문 / frontmatter / 페이지 형식 변경 0.
- **(I3) 시스템 언어 영문** — Settings 4번째 subsection 의 heading / 라벨 / Notice / placeholder / tooltip 모두 영문. 한글 0건. 코드 주석 / docs / commit 메시지는 한글 허용 (wikey.schema.md §핵심 원칙 #6).
- **(I4) credentials.json migration 보존** — 기존 schema (`geminiApiKey` / `anthropicApiKey` / `openaiApiKey` + `auth` sub-object) 보존 + 신규 field (`ollamaCloudApiKey` 또는 `OLLAMA_CLOUD_URL`) 추가. unknown field 보존 round-trip test.
- **(I5) ollama (local) 회귀 0 — 13 source file 영역 보존 LOCK** (사용자 raise 1, 2026-05-14) — 기존 `provider: 'ollama'` + `OLLAMA_URL=http://localhost:11434` path 의 ingest / query / canonicalize / vision fallback / cost-tracker / embedding loader / orama singleton 모두 회귀 0. **회귀 검증 의무 source file 13개** (master 1차 fresh re-run 의무, todox §5.1 grep matrix mirror):
  1. `wikey-core/src/llm-client.ts` (`callOllama` line 509, `case 'ollama'` line 93, OLLAMA_URL fallback line 631)
  2. `wikey-core/src/ingest-pipeline.ts` (Anthropic vision fallback → Ollama line 1768, ollama vision branch line 1773, ollamaBase line 1744, fallbackProvider line 1747)
  3. `wikey-core/src/provider-defaults.ts` (`PROVIDER_CHAT_DEFAULTS.ollama: 'qwen3:8b'` line 27, `PROVIDER_VISION_DEFAULTS.ollama: 'gemma4:26b'` line 39, fallback 'ollama' line 95, context budget Ollama context line 119)
  4. `wikey-core/src/adaptive-json-mode.ts` (line 43 `if (provider === 'ollama') return true`)
  5. `wikey-core/src/types.ts` (line 72 `readonly OLLAMA_URL: string`, line 145 `LLMProvider`)
  6. `wikey-core/src/config.ts` (line 28 `OLLAMA_URL: 'http://localhost:11434'`)
  7. `wikey-core/src/canonicalizer.ts` (ollama 분기, §5.10 D-wide LLM 자율 type 분류 base)
  8. `wikey-core/src/query-pipeline.ts` (ollama branch)
  9. `wikey-core/src/embeddings/embedding-config.ts` + `wikey-core/src/embeddings/qwen3-loader.ts` (Ollama qwen3 embedding loader)
  10. `wikey-core/src/search/orama-index-singleton.ts` (ollama 분기 — embedding 의존)
  11. `wikey-core/src/scripts/benchmark-search.ts` (ollama 분기)
  12. `wikey-core/src/scripts/cost-tracker.ts` (`'ollama-local'` provider ID line 14 + 27 + 273 + 353)
  13. `wikey-core/src/scripts/reindex.ts` (ollama embedding 의존)
  
  **회귀 의무**: 본 §5.6.5 cycle 종결 시 각 file 의 ollama (local) 분기 byte-level grep diff 0 또는 의도된 변경 1:1 mapping 확증. `git diff wikey-core/src/{file}.ts` 결과를 §5.6.5.5 라이브 smoke 직전 master 가 line-by-line 검토.
- **(I5b) ollama local + cloud 병행 사용 LOCK** (사용자 raise 2, 2026-05-14) — 두 path 동시 등록 + 사용자 UI dropdown 즉시 전환 가능 + 시스템 내부 자동 dispatch. 모델 식별자 자동 구분 (사용자 raise 3) — `isCloudModel(modelId): boolean` helper (const `CLOUD_MODEL_PATTERN` 또는 catalog lookup) 가 `:cloud` suffix / PoC §0 catalog 기반 dispatch. UI 의 별 subsection 표시 (Q1=b 사용자 LOCK) + 내부 dispatch 자동 (raise 3) 두 layer 모두 정합.
- **(I6) credentials.json read 금지** — master / agent / 코드 logger 어디서도 `~/.config/wikey/credentials.json` 의 값을 stdout / log / Notice 에 노출 X (구조 / 키 존재 여부만).
- **(I7) Ollama Cloud token 위치 단일 source** — wikey 가 별도 token 자체 저장 X. 사용자 API key 는 `credentials.json` (lower-camel) 만. PoC §0 결과로 endpoint / auth flow 확정.
- **(I8) 하드코딩 금지** (2026-05-10 LOCK) — Ollama Cloud endpoint URL / cloud 모델 catalog / quota detection regex 는 const block (각 const 주석 source 명시). LLM 의 의미론적 판정 (벤치마크 grading) = LLM 호출 + cache. static stopword / 분류 list 0건.
- **(I9) LLMCallOptions 계약 보존** (§5.6.4 v0.5 F1 mirror) — Ollama Cloud path 가 `model` 옵션 반영 (cloud 모델 catalog 안에서 선택). `temperature` / `maxTokens` / `seed` / `responseMimeType` / `thinkingBudget` / `jsonMode` 은 PoC §0 결과로 §"Spec 3 matrix" 에 반영.
- **(I10) core ↔ UI 결합 0** (§5.6.4 v0.5 I10 mirror) — `wikey-core/src/llm-client.ts` 안 Obsidian API import 0. fallback 알림 = `LLMCallOptions.onAuthFallback?` callback (§5.6.4 §3.9 mirror).
- **(I11) PII 누출 0** — 벤치마크 결과 markdown (`docs/ollama-cloud-benchmark-result.md`) 안 fixture corpus 의 PII (사업자등록번호 / 주소 / 인명) 미노출. `check-pii.sh` 회귀 0 + 결과 markdown 추가 grep 의무.
- **(I12) 벤치마크 결정성** (단위 test 영역) — golden 비교 algorithm (Jaccard / F1 / ROUGE-L) deterministic. 동일 input → 동일 score. 단 라이브 실측 자체는 LLM stochastic — 5 cycle repeat + p50/p95 명시.

### 1.3 Acceptance scenarios (AC-S1~AC-S31)

#### Spec 1: Provider 추상화 layer 확장 (Q1 결정 의존)

| ID | 조건 | 기대 동작 |
|----|------|----------|
| AC-S1 | Q1=b 시 `LLMProvider` type 안 `'ollama-cloud'` 포함 | TypeScript compile 통과. `expectType<'ollama-cloud'>` PASS |
| AC-S2 | 사용자 Ollama Cloud only 등록 (`ollamaCloudApiKey` 만) + provider 선택 = 'ollama-cloud' | cloud endpoint POST 호출 성공 + 정상 응답 + Notice 0건 |
| AC-S3 | 사용자 ollama (local) only 등록 + provider 선택 = 'ollama' (local) | 기존 `callOllama` 흐름 그대로 — 회귀 0 |
| AC-S4 | 사용자 둘 다 등록 (local `OLLAMA_URL` + cloud `OLLAMA_CLOUD_URL` + `ollamaCloudApiKey`) + provider 선택 = 'ollama-cloud' | cloud path 만 사용. local ollama daemon 호출 0. 역방향 (provider='ollama' + cloud 모델 식별자) 시 자동 cloud dispatch (raise 3, AC-S29) |
| AC-S5 | Ollama Cloud 401 / 429 detection | `AuthFallbackInfo.reason = 'quota-exceeded'` 발화. AuthMode='api' 시 throw (fallback 없음, §5.6.4 v0.7 정책 mirror) |
| AC-S6 | Ollama Cloud quota 소진 stderr (`"quota exceeded"` / `"monthly limit reached"`) | `detectFallbackTrigger` 가 `'quota-exceeded'` 반환 |
| AC-S7 | `LLMCallOptions.timeout = 600000` | spawn signal + AbortController 600s 보존 (§5.6.4 v0.6 mirror) |

#### Spec 2: Settings UI 4번째 subsection (Q2 결정 의존)

| ID | 조건 | 기대 동작 |
|----|------|----------|
| AC-S8 | Settings tab → LLM Model Authentication section | subsection count = **4** (Gemini / Anthropic / OpenAI / Ollama Cloud 순서) |
| AC-S9 | 4번째 subsection heading text | 정확 `"Ollama Cloud"` (영문, 시스템 언어 LOCK) |
| AC-S10 | 4번째 subsection AuthMode dropdown 옵션 | PoC §0 결과 의존 — (i) Ollama Pro 가 subscription 개념 시 ('none' / 'subscription' / 'api') 3 옵션 (ii) api-only 시 ('none' / 'api') 2 옵션 |
| AC-S11 | 4번째 subsection 의 endpoint URL row (Q1=b LOCK) | placeholder = **PoC §0 captured endpoint** (e.g. `"https://ollama.com"` 또는 `"https://api.ollama.com/v1"` — PoC §0 lock 후 const block 단일 source 결정). 입력 시 `WikeyConfig.OLLAMA_CLOUD_URL` 즉시 저장 |
| AC-S12 | 4번째 subsection 의 API Key row | placeholder = PoC §0 captured token prefix (e.g. `"ollama_..."` — PoC §0 lock). 입력 시 `credentials.json.ollamaCloudApiKey` 즉시 저장. Test 버튼 클릭 시 cloud endpoint ping → 성공 시 `"✓ Connected"` |

#### Spec 3: adaptive jsonMode + CLI_OPTION_SUPPORT matrix 확장 (4 provider 64 cell)

**Matrix shape (codex cycle #1 ID-3 fix v0.3)** — local ollama 는 CLI path 개념 없음 (OAuth subscription 미존재) → matrix 의 row 축에서 제외. 신규 type:
```typescript
// wikey-core/src/provider-cli-options.ts (§5.6.5.3 Step C)
export type CliOptionMatrixProvider = SubscriptionProvider | 'ollama-cloud'
// = 'gemini' | 'anthropic' | 'openai' | 'ollama-cloud' (4 element)

export const CLI_OPTION_SUPPORT: Record<
  CliOptionMatrixProvider,
  Record<AuthPath, Record<LLMCliOptionField, SupportLevel>>
> = { ... }  // 4 provider × 2 path × 8 field = 64 cell
```

| ID | 조건 | 기대 동작 |
|----|------|----------|
| AC-S13 | Q1=b LOCK 시 `CLI_OPTION_SUPPORT['ollama-cloud']` row 존재 | 2 path × 8 field = 16 cell. matrix shape literal `Object.keys(CLI_OPTION_SUPPORT).length === 4` |
| AC-S14 | `resolveJsonModeNative('ollama-cloud', config)` | PoC §0 결과 의존 — cloud 모델별 native 지원 / unsupported 분기 정확 |
| AC-S15 | Ollama Cloud + `jsonMode: true` + 모델 unsupported | adaptive prefix (`JSON_ONLY_PROMPT_PREFIX`) 적용 + flag strip (§5.6.4 v0.7 R2 mirror) |
| AC-S16 | 기존 ollama (local) jsonMode 회귀 | `resolveJsonModeNative('ollama', config) === true` 유지. line 43 분기 변경 0건 (Q1=b 시) 또는 cloud 분기 추가 시 기존 분기 영향 0 |

#### Spec 4: 벤치마크 harness + 실측 (사용자 강조 — 본 cycle 핵심)

| ID | 조건 | 기대 동작 |
|----|------|----------|
| AC-S17 | benchmark harness 실행 (Q3=g hybrid LOCK = `scripts/benchmark-ollama-cloud.sh` + `wikey-core/src/scripts/benchmark-models.ts`) | **7 model × 7 fixture × 6 task × 3 cycle = 1,008 measurement** (raise 17/18/19 deep paradigm). 결과 markdown 생성. exit 0 (정상) / 1 (regression) |
| AC-S18 | 벤치마크 metric 5 모두 측정 | accuracy (Jaccard/F1/ROUGE-L) + latency cold + latency warm p50/p95 + cost per ingest + semantic preservation. 각 cell 비교표 column 으로 |
| AC-S19 | 벤치마크 결과 markdown 안 PII 누출 0 (F4 사업자등록증 + F7 용역계약서) | `check-pii.sh` PASS + **결과 markdown 추가 6 종 grep regex** (docs §5.4 mirror, codex cycle #3 ID-3 fix): (a) 사업자등록번호 `\b\d{3}-\d{2}-\d{5}\b` (b) 주소 group `(서울\|경기\|...)` (c) 계약 당사자명 `(\(주\)\|㈜)` + 대표/이사 (d) 계약 금액 `[0-9,]+원` / KRW (e) 계약 일정 ISO + 계약 keyword (f) 영업비밀 keyword — 모두 0 hit |
| AC-S20 | LLM-as-judge (gemini-2.5-flash) deterministic | 동일 input (golden + predicted) → score 차이 ≤ 0.5 (5 cycle repeat, p50 ± 0.5). single-run determinism 확증 시 temperature=0 + seed=42 |

#### Spec 5: 통합 + production 채택 (Q5 결정 의존)

| ID | 조건 | 기대 동작 |
|----|------|----------|
| AC-S21 | 4 provider 모두 등록 상태 → 사용자가 Settings dropdown 으로 Ollama Cloud 선택 → chat 1 query | 답변 정상 + citation + Notice 0건 |
| AC-S22 | 추천 모델 (Q5 결정) 가 `PROVIDER_CHAT_DEFAULTS` / `PROVIDER_CONTEXT_BUDGETS` 에 추가 | provider-defaults.ts entry 추가 + 회귀 0 |
| AC-S23 | full regression — `npm test` (wikey-core + wikey-obsidian) | wikey-core ≥ 1104 PASS / wikey-obsidian ≥ 215 PASS (§5.6.4 종결 baseline). 0 fail |
| AC-S24 | `./scripts/validate-wiki.sh` | 0 errors |

#### Spec 6: 기존 ollama (local) 회귀 0 (사용자 raise 1, 2026-05-14)

| ID | 조건 | 기대 동작 |
|----|------|----------|
| AC-S25 | 13 source file (I5 enumeration) 의 ollama 분기 byte-level grep diff | 의도된 변경 (e.g. callOllama dispatch helper 추가) 외 0 — `git diff` 가 §5.6.5 cycle 종결 시점 명시 변경 1:1 mapping. fresh `npm test` 결과 ollama 관련 test 모두 PASS |
| AC-S26 | local ollama daemon 가용 + provider='ollama' + 모델='qwen3:8b' (local 모델) | 기존 `callOllama` path 그대로 (URL `http://localhost:11434`). cloud endpoint 호출 0. `WIKEY_DEBUG_AUTH=1` 로 dispatch 경로 log 확인 |
| AC-S27 | embedding loader (`qwen3-loader.ts`) ollama 분기 회귀 0 | qmd / orama hybrid search 의 `qwen3:0.6b-embedding` 자동 pull 동작 그대로. cloud 영향 0 |
| AC-S28 | `cost-tracker.ts` `'ollama-local'` provider ID 회귀 0 | line 14 / 27 / 273 / 353 그대로. cloud cost 는 별 provider ID (`'ollama-cloud'`) 로 추가 — local row 변경 0 |

#### Spec 7: 모델 식별자 자동 구분 (사용자 raise 3, 2026-05-14)

| ID | 조건 | 기대 동작 |
|----|------|----------|
| AC-S29 | `isCloudModel('llama3:70b-cloud')` / `isCloudModel('qwen3:72b-cloud')` 호출 | `true` 반환 (PoC §0 catalog lookup 또는 `:cloud` suffix pattern, 단일 source const). 기존 local 모델 (`qwen3:8b` / `gemma4:26b` 등) → `false` |
| AC-S30 | provider='ollama' + 모델 식별자가 cloud (`llama3:70b-cloud`) | 자동 cloud dispatch (callOllamaCloud) — local daemon 호출 0. WIKEY_DEBUG_AUTH=1 로 dispatch 경로 capture |
| AC-S31 | provider='ollama-cloud' + 모델 식별자가 local-only (`qwen3:8b`) | dispatch 모순 detect → Notice "Local model selected on cloud provider — switch to 'Local (Ollama)' provider" + throw (또는 자동 fallback 결정, PoC §0 + 사용자 결정 5분 무응답 rule). |

### 1.4 Definition of Done

모든 AC PASS + 회귀 0 + 다음 commit set 완료:

1. PoC evidence fixture (commit 1) — 4~6 raw text file
2. Step A provider 추상화 (commit 2) — type 변경 + 단위 test
3. Step B Settings UI (commit 3) — 4번째 subsection + 단위 test
4. Step C matrix + jsonMode (commit 4) — 64 cell 또는 path 의미 재정의 + adaptive 분기
5. Step D 벤치마크 harness (commit 5) — script + golden
6. Step D 벤치마크 결과 (commit 6) — `docs/ollama-cloud-benchmark-result.md`
7. Step E 통합 (commit 7) — production 채택 + memory 등록
8. codex #2 fix (commit 8, optional) — post-impl finding fix

**push timing**: commit 8 (codex #2 APPROVE) 후 통합 push. reversible revert path 보존.

### 1.5 Test Cases (RED → GREEN mapping)

| AC | Test file | Mock / Live |
|----|-----------|-------------|
| AC-S1~S7 | `wikey-core/test/llm-client-ollama-cloud.test.ts` (신규) | mock HTTP client |
| AC-S8~S12 | `wikey-obsidian/test/settings-tab-ollama-cloud.test.ts` (신규) | jsdom mock |
| AC-S13~S16 | `wikey-core/test/provider-cli-options.test.ts` (확장) + `wikey-core/test/adaptive-json-mode.test.ts` (확장) | unit |
| AC-S17~S20 | `wikey-core/test/scripts/benchmark-models.test.ts` (Q3=f-g 시 신규) | mock LLM + golden compare |
| AC-S21 | obsidian-cdp 라이브 (master 직접) | live |
| AC-S22~S24 | full regression (`npm test` + `npm run build` + `./scripts/validate-wiki.sh`) | live |
| AC-S25 | `git diff wikey-core/src/**/*.ts -- !*ollama-cloud*` byte-level 검토 (master 1차) | live grep diff |
| AC-S26~S28 | `wikey-core/test/llm-client.test.ts` (기존 callOllama test 확장) + `cost-tracker.test.ts` (기존) + `qwen3-loader.test.ts` (기존) — 회귀 0 PASS | unit |
| AC-S29~S31 | `wikey-core/test/ollama-cloud-dispatch.test.ts` (신규) — `isCloudModel` 단위 + dispatch 자동 분기 + 모순 detect 단위 | unit |

### 1.6 Dependencies

**선행 의존**:
- §5.6.4 종결 (Session 42, commit `e68c53d` push 완료) — provider 추상화 (`SubscriptionProvider` / `AuthMode` / `AuthPath` / `CLI_OPTION_SUPPORT` 48 cell / `LLMCliOptionField`)
- §5.6.4 v0.7 R2 (commit 15 `cda9ff7`) — adaptive jsonMode (`adaptive-json-mode.ts`) — 본 cycle Step C 의 분기 정정 base
- §5.6.4 v0.7 R5 (commit 16 `e92b170`) — CLI timeout 600s — Ollama Cloud 도 동일 timeout LOCK
- §5.6.4 v0.7 R7 (commit 17 `13e179c`) — CLI install status badge — Q1=b 시 ollama-cloud 의 badge variant 결정 의무
- §5.21 ingest mention guard (Session 41, v0.6) — 벤치마크 mention extraction task 의 정합성 base
- `docs/samples/` 7 file — fixture corpus
- 사용자 Ollama Pro 구독 — PoC §0 실측 필수
- Kiwi WASM (`wikey-core/vendor/kiwi-nlp/`) — 한국어 fixture (ROHM Wi-SUN PDF / HWPX Examples / 사업자등록증 PDF) tokenize
- Orama (`@orama/orama@3.x`) — 벤치마크 query 답변 task 의 검색 인프라
- **Ollama Pro terms-of-service gate** (codex #1 ID-6 v0.3 fix) — Ollama Pro 의 자동 benchmark + fixture 자료 upload 허용 여부 확인 (PoC §0 단계 master 가 사용자 dashboard / terms 확인 후 lock). cloud 모델 의 query rate / token quota 제약 명시.
- **fixture license 검토** — `docs/samples/` 7 file 의 license 영역:
  - `사업자등록증C_(주)굿스트림_*` (F4) + `C20260410_용역계약서_SK바이오텍전자구매시스템구축.pdf` (F7, 사용자 결정 LOCK 2026-05-14 + codex cycle #3 ID-3 fix) — **고-PII LOCK** + 6 종 redaction regex 의무 (사업자번호 / 주소 group / 계약 당사자명 / 계약 금액 / 일정 / 영업비밀, docs §5.4 mirror)
  - 나머지 5 file (ROHM Wi-SUN datasheet / rp1 peripherals / HWPX Examples / PMS / GOODSTREAM) — 일반 vendor documentation (publishable benchmark target)
  - 이전 fixture `스마트공장 보급확산 합동설명회 개최.hwp.md` 는 F7 교체 (codex cycle #3 ID-3 fix) — low representativeness fixture (1.3K 행정 공지) → high-value PII fixture (12K 용역계약서)

**비차단 의존**:
- Phase 6 (웹 환경, skeleton) — 본 cycle 의 결과가 Phase 6 의 백엔드 API 모델 선택 base. 단 Phase 6 자체는 본 cycle 종결 후 진입 — 본 cycle 차단 X.

### 1.7 Risks + Mitigation

| ID | Risk | Mitigation |
|----|------|------------|
| **R1** | Ollama Cloud catalog 변동 — beta / 가격 변경 / 모델 제거 (e.g. `llama3:70b-cloud` 가 production 진입 후 6개월 내 deprecate) | `wikey-core/src/provider-defaults.ts` 의 ollama-cloud default model 을 PoC §0 시점 lock + 6 개월 1회 master 가 catalog re-probe + memory 등록. catalog drift detection script (`scripts/check-ollama-cloud-catalog.sh`) 1회 실측 commit. Out of Scope: 자동 catalog refresh. |
| **R2** | cloud 모델별 jsonMode 차이 — `llama3:70b-cloud` 가 `format: 'json'` 지원하지만 `qwen3:72b-cloud` 는 미지원 같은 case | matrix (`CLI_OPTION_SUPPORT.ollama-cloud`) cell 별 PoC §0 fixture 기반 lock + adaptive prefix 적용 (§5.6.4 v0.7 R2 mirror). 단위 test 의 모델별 분기. |
| **R3** | Ollama Pro quota 소진 — deep benchmark = 7 model × 7 fixture × 6 task × 3 cycle = **1,008 measurement** + 추가 LLM-judge ~882 call + golden committee 126 call (raise 17/18/19 통합) | PoC §0 cost 모델 lock + 사용자 사전 보고 (예상 token total) + budget guard (벤치마크 script 가 `WIKEY_BENCHMARK_BUDGET_USD=<limit>` env var 초과 시 abort) |
| **R4** | 벤치마크 fixture corpus PII 누출 — 결과 markdown 안 사업자등록번호 / 주소 / 인명 표기 | `check-pii.sh` 회귀 0 + 결과 markdown 추가 grep regex (사업자등록번호 = `\d{3}-\d{2}-\d{5}` / 주소 = `(서울|경기|부산|...) .*시` / 인명 한글 = `(주)\w+`) — 추가 PII 패턴 검토 master 의무 |
| **R5** | cloud endpoint latency variance — Ollama Cloud server load 시간대별 ↑↓. 회귀 비교 시 fairness issue | 벤치마크 실행 시점 ISO timestamp 명시 + 5 cycle repeat → p50/p95 + 비교 시점 동일 시간대 명시 ("측정 2026-XX-XX 14:00 KST") + 결과 markdown 명시 |
| **R6** | gemini-2.5-flash baseline 비용 부담 — baseline 도 subscription quota 소진 가능 | baseline 측정도 5 cycle repeat 만 (cloud 와 동일 — 140 call 의 1/5 = 28 call) + 사용자 사전 cost 보고 + budget guard |
| **R7** | §5.21 ingest mention guard 와 의 정합성 — mention extraction task 의 golden 이 §5.21 v0.6 cover ~100% deterministic state 와 일치해야 함 | golden 작성 시 §5.21 ingest pipeline 의 mention guard 적용 후 결과를 base 로 (= §5.21 결과 = 정확 mention set 의 ground truth). Q4=h 사용자 작성 시 §5.21 결과 fixture 와 cross-check |
| **R8** | LLM-as-judge bias — gemini-2.5-flash 가 baseline + judge 동시 역할 시 self-bias | LLM-as-judge 는 brief / query answer 의 ROUGE-L 보조 metric 만. 주 metric (Jaccard / F1) 은 deterministic golden 비교 — bias 영향 0. judge bias spot-check = 사용자 직접 3 sample 검토 |
| **R9** | Q1 결정 후 type 변경 (a → b 또는 b → a) 회귀 면적 ↑ | grep matrix (todox §5.1) 의무 + Q1 결정 후 master 1차 검증 시 모든 site 영향 확인. 단 사용자 raise 2 (2026-05-14) 로 **Q1=b LOCK** — type 추가 path 의무. |
| **R10** | 기존 ollama (local) 회귀 — 13 source file 영역 (raise 1) 의 의도치 않은 분기 변경 | I5 LOCK + AC-S25~S28 + todox §5.1 grep matrix 13 source 영역별 `git diff` 검토. `npm test` fresh re-run 시 ollama 관련 기존 test 모두 PASS 확증. |
| **R11** | 모델 식별자 자동 구분 misclassification (raise 3) — local-only 모델이 cloud catalog 에 포함되거나 그 역 | `isCloudModel` const block 단일 source + PoC §0 fixture 기반 lock + AC-S29~S31 test. catalog drift 시 `scripts/check-ollama-cloud-catalog.sh` (R1 mirror) 가 detect. |
| **R12** | UI 별 subsection 표시 (Q1=b) ↔ 내부 자동 dispatch (raise 3) 의 mental model 충돌 — 사용자가 "왜 'Local (Ollama)' 선택했는데 cloud 가 호출되나" 혼동 | 사용자 명시 (Notice + tooltip) + AC-S31 모순 detect throw + Settings UI 의 모델 picker 가 cloud / local 표시 (e.g. badge "Cloud" / "Local"). |

---

## 2. Out of Scope (v0.1 LOCK)

- 자동 cron / scheduler 벤치마크 — manual trigger 만
- 신규 cloud provider 추가 (xAI / Mistral La Plateforme / Cohere) — Ollama Cloud 1개
- Stage-aware routing engine — Q5=l 옵션의 1 helper 만 (canonicalize 단계 분기) / 본격 routing engine 별 cycle
- 벤치마크 fixture corpus 확장 — `docs/samples/` 의 기존 7 file 만
- `PROVIDER_VISION_DEFAULTS.ollama-cloud` 결정 — text-only scope
- 다국어 벤치마크 확장 — 한국어 + 영문 mix 만
- 사용자별 벤치마크 결과 분리 — single-user 가정 (Phase 6 웹 환경 별 cycle)
- LLM-as-judge committee — 단일 judge (gemini-2.5-flash) 만. committee 는 future cycle

---

## 3. 핵심 사용자 결정 항목 (todox §3 mirror)

- **Q1 (LLM provider type)**: (a) URL switch / (b) 별 `'ollama-cloud'` provider key — **사용자 결정 LOCK (b)** (raise 2 2026-05-14 — local + cloud 병행 사용 + UI 4번째 subsection 사용자 강조 #3). PoC §0 결과로 endpoint / auth flow 만 추가 확정.
- **Q2 (Settings UI helper)**: (c) `renderProviderSubsection` 재사용 / (d) 신규 helper — analyst 권장 (c), DRY
- **Q3 (벤치마크 harness layer)**: (e) bash / (f) ts / **(g) hybrid LOCK** (사용자 결정 2026-05-14, codex cycle #2 ID-1 fix) — bash orchestration (obsidian-cdp 라이브 master 영역) + ts metric (developer 영역)
- **Q4 (Golden answer 작성)**: (h) 사용자 직접 / (i) gemini-2.5-flash baseline / **(j) LLM committee LOCK** (사용자 결정 2026-05-14, codex cycle #2 ID-1 fix). committee model trio = `gemini-2.5-flash` + `claude-3.5-sonnet` + `gpt-4.1` (단일화)
- **Q5 (production 채택)**: (k) basic slot / (l) advanced (canonicalize 분기) / (m) default 변경 — analyst 권장 (k) or (l), 사용자 결정 deferred (benchmark winner 결정 후)
- **모델 set LOCK (raise 17 + 18 2026-05-14)**: 5 cloud (deepseek-v4-pro / qwen3:122b / kimi-k2.6 / gpt-oss:120b-cloud / Mistral 최신) + 1 subscription baseline (gemini-2.5-flash) + 1 local baseline (qwen3:8b) = **7 model**
- **deep benchmark paradigm LOCK (raise 19 2026-05-14)**: 4 task → 6 task (canonicalize / mention / brief / query + cross-reference + hallucinate detection) + multi-cycle 3 repeat + deterministic consistency metric + PII redaction quality metric
- **fixture LOCK (raise 4/5/6/7/8/11/12/13/17/18/19 통합)**: 7 file (F1~F7, F7 = 용역계약서 LOCK, codex cycle #2 ID-2 fix)

---

## 4. Self-check (v0.3 codex cycle #1 fix mirror)

본 spec 의 7-anchor (analyst 기본) + 4 anchor (wikey 추가):

| Anchor | 검증 |
|--------|------|
| (a) Goal | §1.1 — Ollama Cloud 통합 + 벤치마크 (Step D analyst 위임) + 4번째 subsection + best-fit + community ref |
| (b) Non-Goal | §1.1 — 6 항목 명시 |
| (c) Invariants | §1.2 — I1~I12 + I5b LOCK |
| (d) AC measurable | §1.3 — AC-S1~AC-S31 정량 metric (v0.2 raise 1~3 반영 S25~S31 신규, v0.3 codex fix) |
| (e) Test Cases | §1.5 — AC ↔ test file mapping |
| (f) Dependencies | §1.6 — 선행 의존 + 비차단 |
| (g) Risks + Mitigation | §1.7 — R1~R12 (v0.2 R10/R11/R12 신규 raise 1~3 + v0.3 fixture license gate) |
| (h) Karpathy 4 원칙 | §0 — Explicit / Yours / File over app / BYOAI 모두 강화 |
| (i) 3계층 경계 | §0 — raw 수정 X, wiki LLM 소유, schema 변경 0 |
| (j) 워크플로우 4 | §0 — ingest / query / lint / delete 모두 정합 |
| (k) 하드코딩 금지 | I8 — 결정 로직 const block, 의미 판정 LLM 호출 + cache, static list 0 |
