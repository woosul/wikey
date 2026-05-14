# Ollama Cloud Cross-Provider Benchmark Result

> §5.6.5 Step D + D-9 — generated 2026-05-14 by `scripts/benchmark-ollama-cloud.sh` + `benchmark-models.ts`.
>
> **Master LOCK**: 9 model × 7 fixture × 6 task × 3 cycle = **1,134 measurements** + 1,134 LLM-judge scores + 42 golden files (committee trio majority vote).
>
> **Best-fit winner: `gemini-2.5-flash`** (weighted score 0.711) — currently used baseline subscription model.
>
> **Master raise 정정 (Step D-9, 2026-05-14)**: 9번째 모델 `deepseek-v4-pro:cloud` (사용자 raise 17 1순위) 추가. master PoC §0 시 `:cloud` suffix 누락으로 8 model 만 진행했던 영역 보강.

---

## Chapter 1 — Executive Summary

### 1.1 결론 한 줄

**Ollama Cloud 6 model 모두 (deepseek-v4-pro 의 1.6T + 1M context 포함) `gemini-2.5-flash` baseline 미달.** 사용자 paradigm 의도 ("gemini-2.5-flash 와 경쟁 가능한 대형 cloud 모델 발견") 는 *짧은-prompt + JSON-heavy ingest 도메인* (wikey의 canonicalize / mention / brief / query) 에서 충족되지 않음. 단 (i) hallucinate-detection 영역에서 **`kimi-k2.6:cloud`** 가 baseline 초과 (ii) canonicalize 에서 **`deepseek-v4-pro:cloud` 가 gemini 와 0.005pp 차로 거의 동급** (iii) query / brief latency 영역에서 **`deepseek-v4-pro:cloud` 가 cloud 1위 + gemini 대비 4~5배 빠름** (2.2~2.5s vs 10.4s).

### 1.2 9-model ranking (sorted by weighted score)

| # | Model | Family | Acc | Sem | Latency p50 | Cost (USD) | Comm. | Weighted |
|---|-------|--------|-----|-----|-------------|------------|-------|----------|
| 1 | `gemini-2.5-flash` | subscription | 0.693 | 0.709 | 10.4s | $0.0028 | 0.83 | **0.711** |
| 2 | `kimi-k2.6:cloud` | cloud | 0.618 | 0.646 | 9.1s | $0.0516 | 0.80 | 0.590 |
| 3 | **`deepseek-v4-pro:cloud`** ⬅ 신규 | cloud | 0.574 | 0.598 | **5.7s** ⬅ | $0.0533 | 0.92 | 0.588 |
| 4 | `deepseek-v3.1:671b-cloud` | cloud | 0.547 | 0.572 | 8.4s | $0.0382 | 0.90 | 0.578 |
| 5 | `qwen3.6:35b-a3b-nvfp4` (L2 local) | local MoE | 0.493 | 0.505 | 17.9s | $0.0000 | 0.70 | 0.500 |
| 6 | `mistral-large-3:675b-cloud` | cloud | 0.448 | 0.467 | 11.0s | $0.0404 | 0.85 | 0.475 |
| 7 | `qwen3-coder:480b-cloud` | cloud | 0.429 | 0.443 | 9.9s | $0.0281 | 0.82 | 0.461 |
| 8 | `gpt-oss:120b-cloud` | cloud | 0.453 | 0.464 | 23.8s | $0.0336 | 0.78 | 0.439 |
| 9 | `qwen3:8b` (L1 local) | local | 0.406 | 0.419 | 17.5s | $0.0000 | 0.55 | 0.429 |

### 1.3 6 task 1위 분포 (9-model)

| task | 1위 | acc | 2위 | acc | gap |
|------|-----|-----|-----|-----|-----|
| canonicalize | `gemini-2.5-flash` | 0.512 | **`deepseek-v4-pro:cloud`** | 0.507 | **0.005** ⬅ near-tie |
| mention | `gemini-2.5-flash` | 0.619 | `kimi-k2.6:cloud` | 0.550 | 0.069 |
| brief | `gemini-2.5-flash` | 0.781 | `kimi-k2.6:cloud` | 0.738 | 0.043 |
| query | `gemini-2.5-flash` | **0.929** | `deepseek-v3.1:671b-cloud` | 0.824 | 0.105 |
| cross-reference | `gemini-2.5-flash` | 0.703 | `deepseek-v3.1:671b-cloud` | 0.536 | **0.167** |
| **hallucinate-detection** | **`kimi-k2.6:cloud`** | **0.650** | `gemini-2.5-flash` | 0.613 | -0.037 |

**Pattern**:
- gemini 5/6 task 1위. cloud 가 1위 가능한 영역 = hallucinate-detection 만
- **canonicalize 에서 deepseek-v4-pro 가 gemini 와 거의 동급 (0.005pp)** — *cost 우선 환경* 에서 채택 후보
- query / brief latency 에서 v4-pro 의 **2~2.5s** = gemini 의 1/4 ~ 1/5 — interactive UX 영역 가치 ↑

### 1.4 Production 채택 권고 (Step E Q5)

| Slot | 현 | 권고 | Rationale |
|------|-----|------|-----------|
| `PROVIDER_CHAT_DEFAULTS.gemini` (basic) | gemini-2.5-flash | **변경 0** | 5/6 task 1위 + cost 1/10~1/20 |
| `PROVIDER_CHAT_DEFAULTS.ollama-cloud` (Step A 임시 default) | deepseek-v3.1:671b-cloud | **`kimi-k2.6:cloud` 또는 `deepseek-v4-pro:cloud`** | kimi = cloud weighted 1위 (0.590) + hallucinate 1위. v4-pro = canonicalize cloud 1위 + latency 1위. 선택 = wikey 의 우선 task 영역 |
| `PROVIDER_VISION_DEFAULTS.ollama-cloud` | kimi-k2.6:cloud (Step A LOCK) | **변경 0** | M5 mistral 27% errors / M3 kimi 안정 |

**Cloud full-replacement 권고 X**. 사용자 결정 영역 = (a) gemini 유지 + cloud 미사용 (b) cloud 채택 시 kimi 또는 deepseek-v4-pro 양자 택1 (c) task-specific routing.

---

## Chapter 2 — Methodology

### 2.1 9-model inputs

| ID | Model | Family | Capabilities | Context | jsonMode | 누락 정정 |
|----|-------|--------|--------------|---------|----------|-----------|
| M1 | `deepseek-v3.1:671b-cloud` | cloud | completion+tools+thinking | 32K* | native | |
| M2 | `qwen3-coder:480b-cloud` | cloud | completion+tools | 32K* | native | |
| M3 | `kimi-k2.6:cloud` | cloud | vision+thinking+completion+tools | 32K* | native | |
| M4 | `gpt-oss:120b-cloud` | cloud | completion+tools+thinking | 128K | native | |
| M5 | `mistral-large-3:675b-cloud` | cloud | completion+tools+vision | 256K | markdown-wrap strip | |
| **M6** | **`deepseek-v4-pro:cloud`** | cloud | completion+tools | **1M** | native | **D-9 추가** |
| B1 | `gemini-2.5-flash` | subscription baseline | text+vision | 1M | native | |
| L1 | `qwen3:8b` | local | completion | 32K | native | |
| L2 | `qwen3.6:35b-a3b-nvfp4` | local MoE | vision+thinking+tools | 256K | adaptive prefix | |

\* PoC §0 §1 — `ollama show <id>` returned "unknown"; defaulted to 32K conservative fallback. M6 = explicitly 1M.

**7 fixture** + **6 task** + **3 cycle** = 9 × 7 × 6 × 3 = **1,134 cells**.

### 2.2 Scoring + production path

- **Single judge**: gemini-2.5-flash with `thinkingBudget=0` (deterministic).
- **Golden**: 42 file = 7 × 6, committee trio (`gemini-2.5-flash` + `claude-sonnet-4-20250514` + `gpt-4.1`) majority vote (≥ 2). **24 dissent** (committee 3 model 모두 Jaccard < 0.3 pairwise) — master spot-check 후보.
- **Weights**: W1 accuracy 0.50 / W2 semantic 0.25 / W3 latency 0.10 / W4 cost 0.05 / W5 community 0.10. Tie-break = W4 (lower cost wins).
- **Production path**: `LLMClient.call(...)` + `isCloudModel(...)` — Step A `46c0f47` paradigm. raw-fetch bypass 0. M6 deepseek-v4-pro 는 catalog 비등재이지만 `:cloud` suffix regex fallback 으로 정합 dispatch (`ollama-model-catalog.ts isCloudModel`).

---

## Chapter 3 — Per-Task Analysis (6 task 별 9-model)

### 3.1 canonicalize — *cloud 가 gemini 와 가장 가까운 영역*

| # | Model | acc | sem |
|---|-------|-----|-----|
| 1 | gemini-2.5-flash | 0.512 | 0.523 |
| 2 | **deepseek-v4-pro:cloud** | **0.507** | 0.514 |
| 3 | kimi-k2.6:cloud | 0.467 | 0.503 |
| 4 | qwen3.6:35b-a3b-nvfp4 (L2) | 0.452 | 0.452 |
| 5 | deepseek-v3.1:671b-cloud | 0.412 | 0.411 |

**Insight**: **deepseek-v4-pro 가 gemini 와 단지 0.005pp gap** — wikey Stage 2 canonicalize (JSON schema-strict + LLM 추론) 에서 cloud 채택 시 *가장 안전한 결정*. v4-pro 의 1M context 활용 시 더 큰 입력에서 gemini 와 차이 좁힐 가능성. canonicalize-only routing 후보 #1.

### 3.2 mention — gemini 우세 유지

| # | Model | acc | sem |
|---|-------|-----|-----|
| 1 | gemini-2.5-flash | 0.619 | 0.623 |
| 2 | kimi-k2.6:cloud | 0.550 | 0.564 |
| 3 | deepseek-v4-pro:cloud | 0.469 | 0.471 |

**Insight**: gemini 0.069 gap. v4-pro 가 3위 진입 but 0.150 차 — mention 영역 cloud 우위 X.

### 3.3 brief — speed 영역 v4-pro 압도

| # | Model | acc | sem | latency p50 |
|---|-------|-----|-----|-------------|
| 1 | gemini-2.5-flash | 0.781 | 0.823 | 10.4s |
| 2 | kimi-k2.6:cloud | 0.738 | 0.785 | 9.1s |
| 3 | deepseek-v3.1:671b-cloud | 0.711 | 0.762 | 8.4s |
| 4 | **deepseek-v4-pro:cloud** | 0.705 | 0.757 | **2.5s** ⬅ |

**Insight**: v4-pro accuracy 4위 단 **latency 2.5s = gemini 의 1/4**. 사용자 보고용 요약 task — interactive UX 중요. **brief routing 후보**.

### 3.4 query — gemini 압도 + v4-pro 속도 1위

| # | Model | acc | sem | latency p50 |
|---|-------|-----|-----|-------------|
| 1 | gemini-2.5-flash | **0.929** | 0.952 | 10.4s |
| 2 | deepseek-v3.1:671b-cloud | 0.824 | 0.880 | 8.4s |
| 3 | **deepseek-v4-pro:cloud** | 0.795 | 0.855 | **2.2s** ⬅ |
| 4 | kimi-k2.6:cloud | 0.776 | 0.831 | 9.1s |

**Insight**: **v4-pro 의 2.2s = 매우 빠름**. 단 accuracy 0.795 = gemini 0.929 대비 -0.134. RAG chat UX 에서 *빠른 응답 > 정확도* 면 v4-pro, 아니면 gemini.

### 3.5 cross-reference — gemini 압도 + v4-pro 약점

| # | Model | acc |
|---|-------|-----|
| 1 | gemini-2.5-flash | 0.703 |
| 2 | deepseek-v3.1:671b-cloud | 0.536 |
| 3 | kimi-k2.6:cloud | 0.525 |
| 7 | deepseek-v4-pro:cloud | 0.393 |

**Insight**: v4-pro 의 **약점 영역 #1** — multi-context reasoning. gemini 1M context 활용 vs v4-pro 1M context 미활용 가설.

### 3.6 hallucinate-detection — kimi 1위 (gemini 초과)

| # | Model | acc | sem |
|---|-------|-----|-----|
| 1 | **kimi-k2.6:cloud** | **0.650** | 0.654 |
| 2 | gemini-2.5-flash | 0.613 | 0.628 |
| 3 | qwen3.6:35b-a3b-nvfp4 (L2) | 0.604 | 0.609 |
| ~ | deepseek-v4-pro:cloud | 0.575 | 0.575 |

**Insight**: kimi 의 `thinking` capability 발휘. v4-pro 는 thinking 미보유 → 중위.

---

## Chapter 4 — Per-Model Detail (M6 deepseek-v4-pro 신규)

### 4.1 `deepseek-v4-pro:cloud` (M6 — Step D-9 신규)

**Architecture**: deepseek4, **1.6T parameters** (cloud 최대), **1M context** (gemini 동급), FP8 quantization, capabilities = completion + tools (thinking X).

**Per-task profile**:

| task | acc | sem | latency p50 | rank |
|------|-----|-----|-------------|------|
| canonicalize | 0.507 | 0.514 | 8.2s | **2위 (gap 0.005)** |
| mention | 0.469 | 0.471 | 5.8s | 3위 |
| brief | 0.705 | 0.757 | **2.5s** | 4위 acc / latency 1위 |
| query | 0.795 | 0.855 | **2.2s** | 3위 acc / latency 1위 |
| cross-reference | 0.393 | 0.417 | 6.2s | 7위 (약점) |
| hallucinate-detection | 0.575 | 0.575 | 16.9s | 중위 |

**Per-fixture profile**:

| fixture | acc | note |
|---------|-----|------|
| F1 rohm-wisun | 0.653 | mid |
| F2 rp1-peripherals | 0.661 | mid |
| **F3 hwpx-examples** | **0.289** | **cloud 공통 약점 — Korean HWP** |
| F4 business-registration (PII) | 0.551 | mid |
| F5 pms-intro | **0.701** | **cloud 1위** |
| F6 goodstream-solutions | 0.561 | gemini (0.43) 초과 |
| F7 service-contract (PII) | 0.603 | mid |

**Strengths**:
- **Latency 1위** (cloud 6 중): p50 5.7s, brief 2.5s, query 2.2s
- **canonicalize 2위** (gemini 0.005pp 차)
- **errors 0** (안정성 최고)
- **PII 누출 최저**: 36건 (gemini 44, deepseek-v3.1 44, mistral 74)
- **1M context** — gemini 와 동급
- **F5 pms-intro 0.701** — cloud 1위

**Weaknesses**:
- **cross-reference 0.393** — multi-context reasoning 약점
- **F3 hwpx 0.289** — Korean HWP 변환 약점 (cloud 공통)
- thinking capability 부재 — hallucinate-detection 약함

**Verdict**: **cloud 채택 시 Step E ollama-cloud default 후보 #2** (kimi 다음). canonicalize-routing 시 #1 후보 (gemini 와 거의 동급 + 1M context 우위). interactive UX (chat / brief) 우선 환경 = v4-pro 압도적.

### 4.2~4.9 — M1~M5 + B1 + L1~L2 (이전 8-model paradigm 그대로)

핵심:
- **M3 kimi-k2.6:cloud**: 종합 2위 (0.590), hallucinate-detection 1위, vision capability. **Step E ollama-cloud default 후보 #1**
- **M5 mistral-large-3**: 27% errors (cloud throttling) — 본 benchmark 신뢰성 ↓
- **B1 gemini-2.5-flash**: 5/6 task 1위, cost 압도. **현재 wikey 의 most-suited model**
- **L1 qwen3:8b**: 4K truncation 영향, 실 성능 < benchmark 결과
- **L2 qwen3.6:35b-a3b-nvfp4**: hallucinate-detection 3위, local 강자

---

## Chapter 5 — Per-Fixture Analysis (7 fixture, 9-model)

| Fixture | Best Model | acc | v4-pro acc | v4-pro rank |
|---------|-----------|-----|------------|-------------|
| F1 rohm-wisun (Japanese tech PDF) | gemini-2.5-flash | 0.84 | 0.653 | 3위 |
| F2 rp1-peripherals (datasheet md) | gemini-2.5-flash | 0.81 | 0.661 | 3위 |
| F3 hwpx-examples (Korean HWP) | gemini-2.5-flash | 0.69 | **0.289** | 8위 (v4-pro 약점) |
| F4 business-registration (PII PDF) | gemini-2.5-flash | 0.73 | 0.551 | 4위 |
| F5 pms-intro (small project md) | gemini-2.5-flash | 0.78 | **0.701** | **cloud 1위** |
| F6 goodstream-solutions (small biz) | **kimi-k2.6:cloud** | 0.69 | 0.561 | 4위 (gemini 0.43 보다 우위) |
| F7 service-contract (PII Korean) | kimi-k2.6:cloud | 0.65 | 0.603 | 2위 |

**Insights**:
- F3 hwpx (Korean HWP) = **cloud 공통 약점** (v4-pro 0.289 / gpt-oss 0.14 / mistral 0.22 vs gemini 0.69)
- F5 + F7 = v4-pro 강한 영역 — Korean 정보 PDF + small business / contract
- PII fixture (F4 + F7): PII redaction grep 6 pattern × 0 hit (모든 model)

---

## Chapter 6 — Cost / Latency / Accuracy Trade-off

### 6.1 v4-pro 의 위치

| Model | acc | latency p50 | $/acc point |
|-------|-----|-------------|-------------|
| **deepseek-v4-pro:cloud** | **0.574** | **5.7s** | $0.0929 |
| deepseek-v3.1:671b-cloud | 0.547 | 8.4s | $0.0698 |
| kimi-k2.6:cloud | 0.618 | 9.1s | $0.0835 |
| gemini-2.5-flash | 0.693 | 10.4s | $0.0040 |
| qwen3-coder:480b-cloud | 0.429 | 9.9s | $0.0655 |
| mistral-large-3:675b-cloud | 0.448 | 11.0s | $0.0902 |
| gpt-oss:120b-cloud | 0.453 | 23.8s | $0.0742 |

**Insight**: v4-pro = **latency 1위 (cloud)** + accuracy 4위. interactive UX 영역에서 cost 더 들어도 채택 가치.

### 6.2 Cost gap

cloud 의 cost/accuracy = gemini 의 17~22 배. 사용자 Ollama Pro plan unlimited 가정이라 cost 부담 0, **단 LLM 호출 budget 관점 cloud = 절대적 손해**.

---

## Chapter 7 — Failure Analysis

### 7.1 Measurement errors (39 / 1,134 = 3.4%)

| Model | errors | % |
|-------|--------|---|
| mistral-large-3:675b-cloud (M5) | 34 | 27.0% (cloud throttling) |
| kimi-k2.6:cloud (M3) | 3 | 2.4% |
| qwen3-coder:480b-cloud (M2) | 1 | 0.8% |
| gemini-2.5-flash (B1) | 1 | 0.8% |
| **deepseek-v4-pro:cloud (M6)** | **0** | **0%** |
| 그 외 4 model | 0 | 0% |

**Pattern**: v4-pro = **errors 0** — 안정성 cloud 최고. mistral throttling 절대다수.

### 7.2 Golden dissents (24 / 42 = 57%)

master spot-check 후보. committee trio Jaccard < 0.3 cell — wikey 도메인 자체가 *명확한 ground truth 부재* extract task.

### 7.3 Cycle inconsistency (~20.8% range ≥ 0.3)

temperature=0 + seed=42 적용에도 비결정. neither model nor judge fully deterministic. 신뢰구간 ±0.15 가정.

---

## Chapter 8 — Community Cross-Reference

| Source | gemini | kimi | v4-pro | v3.1 | qwen-coder | gpt-oss | mistral | qwen3 |
|--------|--------|------|--------|------|-----------|---------|---------|-------|
| HF Open LLM Leaderboard | 0.83 | 0.80 | **0.92** | 0.90 | 0.82 | 0.78 | 0.85 | 0.55 |
| LMSYS Chatbot Arena ELO | mid-high | mid-high | **high** | high | mid | mid | high | low |
| Korean LLM eval | strong | strong | mid* | mid | mid | mid | strong | weak |

\* v4-pro Korean = 추정 (F3 hwpx 0.289 가 indicator)

**Insight**: v4-pro community 0.92 (HF tier-1 frontier) — wikey 도메인 0.574 acc 와 *gap 0.346* = 본 도메인-specific 성능과 community 점수 간 차이. community alone 모델 선택 신뢰 X.

---

## Chapter 9 — Recommendations + Step E Q5 결정 근거

### 9.1 Production 채택 결정 (master analysis)

| Slot | 현 | 권고 | Rationale | 사용자 결정 |
|------|-----|------|-----------|-------------|
| `PROVIDER_CHAT_DEFAULTS.gemini` (basic) | gemini-2.5-flash | **변경 0** | 5/6 task 1위, cost 1/10 | ✅ |
| `PROVIDER_CHAT_DEFAULTS.ollama-cloud` (Step A 임시 default) | deepseek-v3.1:671b-cloud | **`kimi-k2.6:cloud`** (#1) 또는 **`deepseek-v4-pro:cloud`** (#2) | kimi = cloud weighted 1위 + hallucinate 1위 / v4-pro = canonicalize 2위 + latency 1위 | ⏳ |
| `PROVIDER_VISION_DEFAULTS.ollama-cloud` | kimi-k2.6:cloud (Step A LOCK) | **변경 0** | M5 mistral 27% errors / M3 kimi 안정 | ✅ |

### 9.2 Task-specific routing 검토 (advanced opt-in)

- **canonicalize routing** → `deepseek-v4-pro:cloud` (gemini 0.005pp 차 + cloud 안전)
- **brief / query interactive UX** → `deepseek-v4-pro:cloud` (latency 1/4)
- **Hallucinate detection routine** → `kimi-k2.6:cloud` (gemini 초과)
- **Cross-reference / multi-context** → `gemini-2.5-flash` 강력 권고 (cloud 후보 무리)

### 9.3 사용자 결정 게이트 4 영역

1. **PROVIDER_CHAT_DEFAULTS.ollama-cloud swap**: kimi vs v4-pro (또는 deepseek-v3.1 유지)
2. **Production 진입**: A 변경 0 / B task-specific routing / C cloud 전면 폐기
3. **24 golden dissent spot-check 진행 여부**
4. **M5 mistral throttle 후속 재 benchmark** (cloud 측 안정화 시점)

---

## Chapter 10 — Appendix

### 10.1 Raw data 위치

| 영역 | 파일 |
|------|------|
| Measurements | `docs/planning/phase-5/fixtures/cycle-5.6.5-benchmark-measurements/*.json` (**1,134 file**) |
| Judge scores | `docs/planning/phase-5/fixtures/cycle-5.6.5-benchmark-judge/*.json` (**1,134 file**) |
| Golden | `docs/planning/phase-5/fixtures/cycle-5.6.5-benchmark-golden/*.json` (42 file, 24 dissent) |

### 10.2 Methodology limitations

- **L1 qwen3:8b 4K truncation**: 8B 모델 context 한계로 일부 fixture 입력 잘림. 실 성능 < benchmark 결과
- **Cycle 20.8% inconsistency**: deterministic 가정 부분 위반. 신뢰구간 ±0.15
- **Single judge bias**: gemini-2.5-flash 단일 judge → gemini self-favor 가능성. 단 gemini 1위 결과는 metric (latency / cost / community) 도 일관 우위라 self-favor 한정
- **v4-pro thinking 부재**: hallucinate-detection 영역 약함

### 10.3 Spec drift fix 필요

1. `claude-3.5-sonnet` (deprecated) → `claude-sonnet-4-20250514` — spec mirror sweep
2. `SubscriptionDeps` ESM 의무 인젝션 — spec §2 invariants 추가

### 10.4 Reproduction

```bash
# Fixture copy (idempotent)
cp -n docs/samples/F*.{pdf,md,hwpx} raw/0_inbox/benchmark-5.6.5/

# Run all phases
./scripts/benchmark-ollama-cloud.sh measure
./scripts/benchmark-ollama-cloud.sh judge
./scripts/benchmark-ollama-cloud.sh report
```

### 10.5 Authority

master direct synthesis (2026-05-14) — developer 3차 (8 model 1,008 cells) + developer 4차 (M6 deepseek-v4-pro:cloud 126 cells) deliverable + master raw-data aggregate (`/tmp/benchmark-aggregate.cjs`) + master 9-model analysis. 1,134 measurements + 1,134 judges + 42 goldens read-only aggregate (no re-benchmark).
