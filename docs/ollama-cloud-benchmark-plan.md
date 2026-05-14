# Ollama Cloud Benchmark Plan — wikey 도메인 최적 모델 발견

> **목적**: wikey 의 4 stage 사용 case (canonicalize / mention extraction / brief / query) 에 대해 정확도·의미 보존 1순위로 최적 cloud LLM 모델 1개를 발견한다.
>
> **위치**: `docs/ollama-cloud-benchmark-plan.md` (개발자 documentation, 한글 본문 허용 — `CLAUDE.md` §시스템 언어 LOCK 예외 (b)). file 명 사용자 결정 LOCK 2026-05-14 raise 21 (이전 `docs/ollama-cloud-benchmark.md` 에서 plan/result 분리). **benchmark 결과 = `docs/ollama-cloud-benchmark-result.md`** (별 file, master/developer 가 측정 후 작성).
>
> **codex 2차 검증 절차 (cmux skill 의무, raise 14~16 + codex cycle #3 ID-6 fix)**: `feedback_cmux_skill_read.md` LOCK + `agent-management.md §0~§5` + `~/.claude/skills/cmux/SKILL.md` 첫 read 의무. fresh surface → `(r,c) codex: ...` 라벨 → `codex exec - < /tmp/prompt.txt 2>&1 | tee $LOG; cmux wait-for --signal <token>` send + background wait → cycle 종료 후 `cmux close-surface` (cycle 단위 격리 ADR-0004).
>
> **상태**: analyst plan v0.3 (2026-05-14, codex cycle #3 7 finding fix + raise 17~21 통합). master + 사용자 승인 후 §5.6.5.4 Step D 실행 시 본 문서가 단일 진실 소스.
>
> **v0.2 사용자 결정 LOCK** (2026-05-14):
> - **Q3 harness layer = (g) hybrid** — bash orchestration (obsidian-cdp 라이브 ingest cycle smoke) + ts metric 집계 (golden 비교 algorithm / latency 통계 / cost calc). bash = master 의 라이브 가시 영역 + ts = developer 의 코드 단위 영역.
> - **Q4 golden answer = (γ) LLM committee** — `gemini-2.5-flash` + `claude-3.5-sonnet` + `gpt-4.1` 3 model 의 ingest 결과 → committee 합의 → golden lock. golden 파일 = `plan/phase-5/fixtures/cycle-5.6.5-benchmark-golden/<fixture>/<task>.json|md`.
> - **fixture corpus = 7 file 유지** (용역계약서 포함). PII redaction 강화 — 결과 markdown 안 사업자등록번호 / 계약 당사자명 / 금액 grep 0건 의무. 별도 redaction config (`.wikey/pii-patterns.yaml` 의 `kind: redaction` rule 추가).
> - **catalog lock 의 위치** = master PoC §0 (사용자 Ollama Pro 계정 접근 필수 + 사용자 승인). developer 위임과 비-중복 — developer 는 catalog lock 결과를 input 으로 받음.
>
> **위임 source**: `plan/phase-5/phase-5-todox-5.6.5-ollama-cloud.md` §6 Step D + `plan/phase-5/phase-5-spec-5.6.5-ollama-cloud.md` Spec 4 (AC-S17~S20) + 사용자 raise 6 (best-fit 1 model 발견) + raise 7 (community reference 통합).

---

## §1 목표 + 위임 context

### 1.1 본 산출의 위임 source

| 출처 | 영역 | 본 문서 매핑 |
|------|------|--------------|
| `phase-5-todox-5.6.5-ollama-cloud.md §6 §5.6.5.4` (Step D) | benchmark harness 설계 + fixture corpus + golden answer + 평가 metric | §3 + §4 + §5 |
| `phase-5-spec-5.6.5-ollama-cloud.md §1.3 Spec 4` (AC-S17~S20) | benchmark AC 4종 (harness exit / 5 metric / PII 0 / LLM-judge determinism) | §4 + §9 |
| 사용자 raise 6 (2026-05-14) | wikey 도메인 best-fit 1개 모델 발견 — 정확도·의미 보존 1순위 | §7 best-fit 결정 algorithm |
| 사용자 raise 7 (2026-05-14) | community 평가 reference 통합 — HF / LMSYS / Korean / vendor | §6 |

### 1.2 wikey 도메인 핵심 사용 case 정의

본 benchmark 가 평가해야 하는 wikey "도메인 specific" 행위는 다음 4 stage 다. RAG 일반 벤치마크 (MMLU / HellaSwag) 와 다르다.

| Stage | 코드 site | 사용 case |
|-------|-----------|-----------|
| **canonicalize** | `wikey-core/src/canonicalizer.ts` (§5.10 D-wide LLM-only ontology, schema gate 없음) | 사용자 인제스트 시 LLM 자율 type 분류 (entity / concept) + slug normalization (다국어 alias dedup) |
| **mention extraction** | `wikey-core/src/ingest-pipeline.ts` (mention guard §5.21 v0.6) | source 본문에서 *의미 비례* 한 mention 만 추출 — 출처·장소·단편 사실 mention 0건 |
| **brief / summary** | sidebar Ingest panel 의 승인 화면 brief (≤ 30 줄) | 사용자가 인제스트 결과를 ≤ 30 초 안에 검토 가능한 요약 |
| **query answer** | `wikey-obsidian/src/sidebar-chat.ts` (citation + 1-hop wikilink) | wiki/index.md → Orama BM25 → LLM 리랭킹 → LLM 합성. citation precision |

### 1.3 best-fit 결정 우선순위 (사용자 raise 6)

```
1순위: wikey 도메인 정확도 (4 task × 7 fixture × 가중치)
2순위: 의미 보존 (한국어 한자 변환 / 표 markdown / LLM-judge)
3순위: latency warm p50
4순위: cost per ingest
5순위: community score 평균 (raise 7 — tie-breaker)
```

cost 가 1순위 가 *아닌* 이유: wikey 는 *지식 자산이 영구 축적되는* 시스템 (Karpathy llm-wiki.md 의 "compounding" 철학). 1회 인제스트의 cost 차이 (예: $0.01 vs $0.05) 는 향후 수년 사용 동안 무의미. 반면 정확도·의미 보존이 낮으면 *모든 후속 쿼리·린트가 오염된다*.

### 1.4 baseline 모델 (사용자 강조 #1)

`gemini-2.5-flash` = wikey production 의 현재 default (`wikey.conf` `WIKEY_MODEL=gemini-2.5-flash`). 본 벤치마크의 baseline 이자 "넘어야 하는 목표". 본 cycle 의 winner 결정 = *gemini-2.5-flash 와 동급 또는 그 이상의 도메인 정확도를 보이는 Ollama Cloud 모델 1개*.

---

## §2 평가 모델 set (PoC §0 확정 후 lock)

### 2.1 Ollama Cloud 측정 모델 — **PoC §0 LOCK 5 model** (2026-05-14 raise 17 + PoC v0.4)

PoC §0 master 직접 실측 (`plan/phase-5/fixtures/cycle-5.6.5-ollama-cloud-poc/SUMMARY.md`) — 5 cloud model + jsonMode probe 모두 확정.

| # | ollama 식별자 (PoC LOCK) | size | context | quantization | capabilities | hello | jsonMode |
|---|---------------------------|------|---------|--------------|--------------|-------|----------|
| M1 | **`deepseek-v3.1:671b-cloud`** | 671B (deepseek2) | (default) | (default) | completion + tools + thinking | ✅ ok 838ms | native ✅ raw JSON |
| M2 | **`qwen3-coder:480b-cloud`** | 480B | (default) | (default) | completion + tools | ✅ ok 1150ms | native ✅ raw JSON |
| M3 | **`kimi-k2.6:cloud`** | unknown | (default) | (default) | vision + thinking + completion + tools | ✅ ok 2968ms | native ✅ raw JSON |
| M4 | **`gpt-oss:120b-cloud`** | 117B (gptoss) | 131K | MXFP4 | completion + tools + thinking | ✅ ok 798ms | native ✅ raw JSON |
| M5 | **`mistral-large-3:675b-cloud`** | 675B (mistral3) | 262K | FP8 | completion + tools + vision | ✅ ok 684ms | native ⚠️ markdown wrap (strip 의무) |

사용자 alias ↔ PoC 식별자 매핑:
- M1 사용자 alias "deepseek-v4-pro" → PoC `deepseek-v3.1:671b-cloud` (Ollama Cloud 의 deepseek 최대 cloud model)
- M2 사용자 alias "qwen3:122b" → PoC `qwen3-coder:480b-cloud` (qwen3:122b catalog 부재, Qwen 계열 cloud 최대로 대체 LOCK)
- M5 사용자 LOCK "mistral-large-3:675b-cloud" (raise 22-1 직접 명시, PoC 확정)

**cloud-tier 작은 모델 제외 LOCK** (raise 17): 위 5 model **이상 급** cloud 만 측정 (≤ 70B cloud 모델 제외, e.g. `llama3:70b-cloud` / `gemma3:27b-cloud`).

**local current 모델 비교 영역 포함 LOCK** (raise 18 2026-05-14): wikey 의 현재 local default (`qwen3:8b`) 도 비교 baseline 으로 측정. cloud 5 + subscription B1 + local L1 + local L2 (raise 22) = **8 model 측정**.

**catalog 식별자 정확화 의무** (PoC §0): master 가 사용자 Ollama Pro 계정으로 `ollama list` (또는 `ollama.com/library` web fetch) 결과로 5 model 의 정확한 ollama 식별자 (e.g. `deepseek-v3.1:671b-cloud` 또는 `deepseek-v4:cloud`) 확정. 사용자 alias (e.g. "deepseek-v4-pro") ↔ ollama identifier 매핑 lock.

### 2.2 baseline subscription (사용자 강조 #1)

| 모델 | provider | 측정 의무 |
|------|----------|-----------|
| **B1 `gemini-2.5-flash`** | gemini subscription (또는 API) | 모든 4 task × 7 fixture 실측 (다른 모델과 동일 조건). winner score < B1 score 시 production 채택 X (§7.7) |

### 2.3 local current baseline (사용자 raise 18 + 22 LOCK 2026-05-14)

| 모델 | provider | jsonMode | 측정 의무 |
|------|----------|----------|-----------|
| **L1 `qwen3:8b`** | ollama local (`wikey-core/src/provider-defaults.ts:27 PROVIDER_CHAT_DEFAULTS.ollama`) | native ✅ | 모든 6 task × 7 fixture × 3 cycle 실측 — cloud 5 + B1 + L2 와 동일 조건 비교 (raise 18) |
| **L2 `qwen3.6:35b-a3b-nvfp4`** | ollama local (qwen3_5_moe 35.1B, 256K ctx, nvfp4) | **adaptive prefix 의무** (mlx runner `format:json` unsupported, plain mode 만 동작) | 모든 6 task × 7 fixture × 3 cycle 실측 — 35B MoE 의 local 측정 (raise 22 2026-05-14) |

**전체 측정 model count** = 5 cloud (M1~M5) + 1 subscription baseline (B1) + 2 local baselines (L1 + L2) = **8 model**. **8 model × 7 fixture × 6 task (deep paradigm raise 19) × 3 cycle (multi-cycle repeat) = 1,008 measurement** (PoC v0.4 LOCK raise 22 mirror).

### 2.5 community reference 만 (실측 X, raise 7)

Ollama Cloud catalog 에 없는 강자 모델은 *reference column* 으로만 통합. wikey 실측 X.

- `Claude 3.5 Sonnet` / `Claude 3.7 Sonnet` (Anthropic) — Anthropic API 또는 subscription
- `GPT-4.1` / `GPT-4o` (OpenAI) — OpenAI API
- `Gemini 2.0 Pro` (Google) — gemini API (gemini-2.5-flash 보다 큰 모델)
- `Solar-10.7B` / `Solar-Pro` (Upstage Korean) — 한국어 specific 강자
- HF Open LLM Leaderboard top 5 (실시 시점 master fetch — 2026-05-14 추정 candidate: `Llama-3.3-70B-Instruct` / `Qwen2.5-72B-Instruct` / `DeepSeek-V3` / `Mistral-Large-Instruct`, 본 §6.1 fetch method 따라 master 확정)

### 2.4 PoC §0 결과 — **모두 LOCK** (2026-05-14 master 직접 실측)

| 영역 | PoC LOCK |
|------|----------|
| **5 model ollama 식별자** | M1 `deepseek-v3.1:671b-cloud` / M2 `qwen3-coder:480b-cloud` / M3 `kimi-k2.6:cloud` / M4 `gpt-oss:120b-cloud` / M5 `mistral-large-3:675b-cloud` |
| **endpoint** | local URL `http://localhost:11434` + `:cloud` suffix 모델 식별자 자동 dispatch (transport variant **(a) confirmed**) |
| **auth flow** | SSH key (`~/.ollama/id_ed25519`) + `ollama signin` browser OAuth (`ollama.com/connect`). **API key header 없음**. `credentials.json.ollamaCloudApiKey` field **불필요** → Settings UI row 변경 |
| **subscription quota** | 사용자 Ollama Pro plan = unlimited (사용자 결정 LOCK 2026-05-14). 본 cycle 1,008 measurement + 1,008 judge + 126 golden committee = ~2,142 LLM call (1회) |
| **jsonMode** | 5 cloud + L1 = `format:json` native ✅. M5 mistral-large-3 markdown ```json``` wrap (strip helper 의무). L2 mlx runner unsupported → adaptive prefix 의무 |
| **paradigm 변경** | (a) `callOllamaCloud` 별 함수 분리 불필요 → `callOllama` 안 cloud 분기 + `isCloudModel` helper (b) `credentials.json.ollamaCloudApiKey` 제거 (c) Settings UI 4번째 subsection row = "Signin status badge + Sign in/out button" |

---

## §3 평가 task (wikey 도메인 4 stage)

### 3.1 canonicalize task

- **코드 site**: `wikey-core/src/canonicalizer.ts:195` (D-wide LLM-only ontology, §5.10 paradigm shift 후) — codex cycle #2 ID-7 line anchor 추가
- **입력**: source 본문 + `wikey.conf` 의 system prompt
- **출력**: `{ type: 'entity'|'concept', slug: string, aliases: string[] }[]`
- **metric**: 
  - Jaccard(predicted slug set, golden slug set) — set 정합성
  - confusion matrix (entity vs concept 분류) — 정확도 / recall / precision (binary classification)
- **golden answer 형식**: `plan/phase-5/fixtures/cycle-5.6.5-benchmark-golden/<fixture>/canonicalize.json`

### 3.2 mention extraction task

- **코드 site**: `wikey-core/src/ingest-pipeline.ts:885` (extractMentions) + `:1178` (SEGMENTED route) — §5.21 ingest mention guard v0.6, cover ratio 49% → 100% deterministic (codex cycle #2 ID-7 line anchor 추가)
- **입력**: source 본문 + 분해된 canonical entity / concept set
- **출력**: `{ pageSlug: string, mentionPositions: number[] }[]`
- **metric**: precision = |predicted ∩ golden| / |predicted|, recall = |predicted ∩ golden| / |golden|, F1 = 2pr/(p+r)
- **wikey 도메인 specificity**: §5.21 가드 (출처·장소·단편 사실 mention 0건) 정합성. 일반 LLM 벤치마크에는 없음.
- **golden answer 형식**: `plan/phase-5/fixtures/cycle-5.6.5-benchmark-golden/<fixture>/mentions.json`

### 3.3 brief / summary task

- **코드 site**: `wikey-obsidian/src/ingest-modals.ts:497` (sidebar Ingest panel Brief modal, ≤ 30 줄) — codex cycle #2 ID-7 line anchor 추가
- **입력**: source 본문 + canonicalize 결과
- **출력**: markdown brief (≤ 30 줄)
- **metric**:
  - ROUGE-L (predicted brief vs golden brief) — n-gram overlap
  - LLM-as-judge (`gemini-2.5-flash`, temperature=0, seed=42) quality score 0~10. prompt = "이 brief 가 source 의 핵심을 ≤ 30 줄 안에 보존하는가? 0~10 점수."
  - LLM-judge determinism: 동일 input 5 cycle → score 차이 ≤ 0.5 (AC-S20)
- **golden answer 형식**: `plan/phase-5/fixtures/cycle-5.6.5-benchmark-golden/<fixture>/brief.md`

### 3.4 query answer task

- **코드 site**: `wikey-obsidian/src/sidebar-chat.ts:686` (citation + 1-hop wikilink, Orama BM25 → LLM 리랭킹 → LLM 합성) — codex cycle #2 ID-7 line anchor 추가
- **입력**: wiki/ (이전 task 3.1~3.3 의 산출물로 구축된 wiki) + 사용자 query
- **출력**: `{ answer: string, citations: string[] }`
- **metric**:
  - citation precision = |cited pages ∩ relevant golden pages| / |cited pages|
  - answer ROUGE-L (predicted vs golden answer)
- **golden answer 형식**: `plan/phase-5/fixtures/cycle-5.6.5-benchmark-golden/<fixture>/queries.json` (3~5 query per fixture)

### 3.5 cross-reference task (사용자 raise 19 deep 강화, 2026-05-14)

추가 task — wikilink 그래프 1-hop 정합성 측정:

- **코드 site**: `wikey-core/src/wiki/mention-guard.ts` + `wikey-core/src/canonicalizer.ts` (`canonicalizeSlug` alias dedup)
- **입력**: ingest 직후 wiki/ 그래프 (모델별 산출)
- **출력**: `{ pageSlug: string, outgoingWikilinks: string[], inboundCount: number }[]`
- **metric**:
  - 1-hop precision = |모델 wikilink ∩ golden 1-hop| / |모델 wikilink|
  - orphan ratio = (인바운드 0 page count) / (총 page count) — Karpathy "고아 페이지 검출" 정합성
- **wikey 도메인 specificity**: wikilink 그래프 (Obsidian graph view) 가 wikey 의 핵심 가치. 일반 LLM 벤치마크에 없음.
- **golden answer 형식**: `plan/phase-5/fixtures/cycle-5.6.5-benchmark-golden/<fixture>/crossref.json`

### 3.6 hallucinate detection task (사용자 raise 19 deep 강화, 2026-05-14)

추가 task — 모델이 source 에 없는 정보 생성 detection:

- **코드 site**: `wikey-core/src/ingest-pipeline.ts` (mention extractor 의 "출처에 없는 mention" 검출, §5.21 v0.6 mention guard 정합성)
- **입력**: source + 모델 ingest 결과 (entity / concept / mention)
- **출력**: `{ hallucinated: { pageSlug, evidence: 'not_found' }[], grounded: pageSlug[] }`
- **metric**:
  - hallucinate rate = |hallucinated| / |total mentions|
  - grounding precision = 1 - hallucinate rate (높을수록 정확)
- **wikey 도메인 specificity**: 사용자 본질 비판 6 chain (§5.10.4 D-wide) 의 "knowledge group ⊂ standard group" 정합성. source-grounded LLM 평가.
- **golden answer 형식**: `plan/phase-5/fixtures/cycle-5.6.5-benchmark-golden/<fixture>/hallucinate.json`

### 3.7 task 별 weighting (best-fit algorithm 입력, deep paradigm 6 task)

| Task | 가중치 (정당성) |
|------|-----------------|
| canonicalize | 0.25 — wiki 그래프 구조의 base. 오류 시 *후속 모든 task 오염* |
| mention extraction | 0.20 — §5.21 가드 정합성. wikilink density 결정 |
| brief / summary | 0.15 — 사용자 인제스트 승인 UX 직접 영향 |
| query answer | 0.20 — 사용자가 가장 자주 보는 산출물 |
| cross-reference (raise 19) | 0.10 — wikilink 그래프 1-hop 정합성 |
| hallucinate detection (raise 19) | 0.10 — grounded LLM 평가 |

합 = 1.00. 각 fixture 안에서 6 task 의 weighted score 합산 = fixture-level 정확도.

---

## §4 평가 metric (5 종)

### 4.1 accuracy

| Sub-metric | 단위 | 측정 방법 |
|------------|------|-----------|
| Jaccard | 0~1 float | `|A ∩ B| / |A ∪ B|`, set 비교 |
| F1 | 0~1 float | `2pr/(p+r)`, precision × recall |
| ROUGE-L | 0~1 float | longest common subsequence 기반, `rouge-score` Python 또는 TS 포팅 |
| confusion matrix | dict (TP / FP / FN / TN) | binary classification per task |

**determinism**: `temperature=0` + `seed=42` (모델 제공 시) — 동일 input 동일 output 확증 1회.

### 4.2 latency cold

- **단위**: ms
- **측정 방법**: first ingest API call wall-clock (모델별, master CDP `console.time` 또는 `performance.now()`)
- **scope**: 모델 dispatch ~ 응답 수신 완료 (network + LLM inference 합)
- **fairness**: 5 cycle repeat 의 *첫 cycle* 만. cache miss 보장.

### 4.3 latency warm p50 / p95

- **단위**: ms
- **측정 방법**: 5 cycle repeat → 4 warm sample (첫 cycle 제외) 의 p50 / p95
- **mirror**: `wikey-core/src/scripts/benchmark-search.ts` (§5.7.4 Orama PoC) 의 latency 측정 패턴

### 4.4 cost per ingest

- **단위**: tokens (input + output 합) 또는 USD (provider price * tokens)
- **측정 방법**:
  - Ollama Pro = subscription quota (token usage estimate / quota fraction)
  - API billing = provider response 의 `usage` field (input_tokens + output_tokens) × $price/1K
- **PoC §0 cost model lock**: master 가 사용자 Ollama Pro 가입 후 quota 구조 실측 + price 페이지 1회 fetch.

### 4.5 semantic preservation (사용자 강조 — 의미·문서 보존)

**1순위 정확도와 동격으로 critical**. 사용자 명시 = "의미·문서 보존".

| Sub-metric | 단위 | 측정 방법 |
|------------|------|-----------|
| Korean mention 한자 변환 오류 ratio | 0~1 float | golden 의 한글 mention (예: "사물인터넷") 중 predicted output 에서 한자 (예: "事物인터넷") 로 변환된 비율 |
| English datasheet 표 markdown 변환 ratio | 0~1 float | golden table 의 row count 대비 predicted markdown table 의 row count (rp1-peripherals / ROHM Wi-SUN 의 pinmap 표) |
| LLM-judge 의미 보존 score | 0~10 float | `gemini-2.5-flash` judge prompt = "source 와 wiki 페이지를 비교. 의미가 보존되었는가? 0~10 점수." (3 cycle repeat 평균, AC-S20 determinism) |

`gemini-2.5-flash` 가 judge 인 이유: 모든 후보 모델과 *독립* 한 외부 모델. self-bias 회피.

### 4.x deterministic consistency (사용자 raise 19 deep 강화, 2026-05-14)

추가 metric — multi-cycle repeat 후 결과 stability:

- **측정 방법**: 동일 input × **3 cycle repeat** per cell (294 cell × 3 = **1,008 measurement**, codex cycle #3 ID-1 final fix). 각 model 마다 temperature=0 + seed=42 (지원 모델만). variance (`std(score) / mean(score)`) 계산.
- **단위**: variance coefficient 0~1 (낮을수록 stable, deterministic LLM)
- **best-fit 영향**: variance > 0.20 인 model = penalty (production 안정성 ↓). §7.6 tier 결정에서 high-variance model 우선순위 ↓.

### 4.y PII redaction quality (사용자 raise 19 deep 강화 + F4/F7 PII 영역, 2026-05-14)

추가 metric — F4 (사업자등록증) + F7 (용역계약서) 의 PII redaction 자체 평가:

- **측정 방법**: §5.4 의 6 grep regex 모두 모델별 ingest 결과 markdown 에 적용 → 누출 count
- **metric**: PII leak count (각 cell, 모델별 합계). 0 hit = perfect / 1+ hit = production 채택 X (penalty hard fail)
- **단위**: integer count (0~∞, 0 lock 의무)
- **best-fit 영향**: PII leak ≥ 1 인 모델 = winner 결정에서 자동 disqualify (production 미사용)

### 4.z 종합 metric count

| Metric | 수 | 단위 |
|--------|----|------|
| accuracy | 6 sub-metric (task 별 Jaccard / F1 / ROUGE-L) | 0~1 |
| latency cold | 1 | ms |
| latency warm p50/p95 | 2 | ms |
| cost per ingest | 1 | tokens / USD |
| semantic preservation | 3 sub-metric | 0~1 |
| deterministic consistency (raise 19) | 1 | 0~1 |
| PII redaction quality (raise 19) | 6 sub-metric (regex 별 leak count) | integer |

---

## §5 fixture corpus

### 5.1 7 file (master 직접 `docs/samples/` → `raw/0_inbox/benchmark-5.6.5/` copy)

| # | 파일 | size | 언어 | 도메인 | wikey representativeness |
|---|------|------|------|--------|--------------------------|
| F1 | `ROHM_Wi-SUN Juta통신모듈(BP35CO-J15).pdf.md` | 1.4M | 한국어 | datasheet (IoT 무선 모듈) | 한국어 + 표 + 전문 용어 — wikey 가 가장 자주 처리하는 source type |
| F2 | `rp1-peripherals.pdf.md` | 1.8M | 영문 | datasheet (Raspberry Pi peripheral) | 영문 + 대형 표 (pinmap) + spec sheet — English fixture 영역 base |
| F3 | `Examples.hwpx.md` | 1.6M | 한국어 | 한글 HWPX 변환 결과 | 한국어 + HWPX → markdown 변환 quality 영역 |
| F4 | `사업자등록증C_(주)굿스트림_301-86-19385(2015).pdf.md` | 753B | 한국어 | 사업자등록증 PDF | **PII risk 영역** — 사업자등록번호 / 주소 / 대표자명 — benchmark 결과 안 누출 0건 의무 (AC-S19) |
| F5 | `PMS_제품소개_R10_20220815.pdf.md` | 6.1M | 한국어 | 제품 소개서 (대형) | 한국어 + 대용량 (Phase A/B 2단계 인제스트 실증) |
| F6 | `GOODSTREAM Solutions - AI, DataLake and Industrial.md` | 12K | 영문 | 회사 소개 (영문) | 영문 + 소형 + corporate description — short fixture baseline |
| F7 | `C20260410_용역계약서_SK바이오텍전자구매시스템구축.pdf.md` | 12K | 한국어 | 용역계약서 PDF (중-PII) | 한국어 + 계약 문서 (당사자명 / 계약 금액 / 일정 / 사업자번호) — **wikey 사용자 영역 자주 등장 + PII redaction rule 강화 영역** (사용자 결정 LOCK 2026-05-14, codex cycle #2 ID-2 fix) |

### 5.2 fixture distribution 정당성

- 한국어 5 (F1 / F3 / F4 / F5 / F7) + 영문 2 (F2 / F6) — wikey 사용자 (한국어 dominant) 분포 반영. **한국어 weighting 의무** (§7 algorithm 에서 한국어 fixture × 1.2).
- 대용량 (> 1MB) 4 (F1 / F2 / F3 / F5) + 소형 (< 100KB) 3 (F4 / F6 / F7) — Phase A/B 2단계 인제스트 (§5.11) vs single-pass 모두 측정.
- 표 dominant (F1 / F2) + 문서 dominant (F3 / F5 / F6) + 단편 / 계약 문서 (F4 / F7) — 의미 보존 metric 의 3 sub-metric 모두 trigger.
- **PII 영역 2 fixture** (F4 / F7) — 사업자등록번호 / 주소 (F4) + 계약 당사자명 / 금액 / 일정 (F7). PII redaction 의 cross-coverage 강화.

### 5.3 golden answer 작성 방법 — **사용자 결정 LOCK = (γ) LLM committee** (2026-05-14, codex cycle #2 ID-1 fix)

3 옵션 history reference (codex cycle #2 후 γ LOCK):

| 옵션 | 방법 | trade-off |
|------|------|-----------|
| (α) 사용자 직접 | 사용자가 각 fixture 의 canonical entity / concept / mention / brief / 3~5 query 직접 작성 | 가장 정확. 단 사용자 시간 ≈ 4~8 시간 — rejected (시간 부담) |
| (β) baseline 채택 | `gemini-2.5-flash` 출력을 golden 으로 채택 (gemini = baseline) | 작성 시간 0. 단 baseline circular — gemini 가 1위 자동 — rejected (bias) |
| **(γ) LLM committee LOCK** | **`gemini-2.5-flash` + `claude-3.5-sonnet` + `gpt-4.1` 3 모델 합의** (majority vote, model trio 단일화 codex cycle #2 ID-1 fix) → 사용자 spot-check 30분 | 시간 ≈ 30분~1시간. circular 회피. 사용자 부담 ↓ |

**committee model trio LOCK** (codex cycle #2 ID-1 fix): `gemini-2.5-flash` + `claude-3.5-sonnet` + `gpt-4.1` (단일화, 이전 docs 안 `gpt-4o` 표기는 drift — `gpt-4.1` 로 통일).

### 5.4 PII 회피 (AC-S19) + 용역계약서 redaction rule (codex cycle #2 ID-5 fix)

- F4 (사업자등록증) + F7 (용역계약서) = **PII 영역 ↑**. fixture 자체는 raw/0_inbox 로 copy (raw/ 는 .gitignore 대상, Git push 0건).
- benchmark 결과 markdown (`docs/ollama-cloud-benchmark-result.md`) 안 PII 누출 0건 확증 — **6 종 grep regex** (char class `[...]` 가 아니라 group `(...)` 패턴):
  ```bash
  # (a) 사업자등록번호 (F4 + F7)
  grep -E '\b[0-9]{3}-[0-9]{2}-[0-9]{5}\b' activity/.../benchmark-*.md
  # (b) 주소 (F4 + F7) — codex cycle #2 ID-5 regex group fix
  grep -E '(서울|경기|인천|부산|대구|광주|대전|울산|세종|강원|충북|충남|전북|전남|경북|경남|제주)[가-힣 ]*(시|구|군|동|읍|면)' activity/.../benchmark-*.md
  # (c) 계약 당사자명 (F7) — `(주)` / `㈜` prefix + 회사명 / 대표자 한글 인명
  grep -E '(\(주\)|㈜)\s*[가-힣A-Z][가-힣A-Za-z0-9]+' activity/.../benchmark-*.md
  grep -E '\b[가-힣]{2,4}\s*(대표|대표이사|이사|상무|전무|이사장)\b' activity/.../benchmark-*.md
  # (d) 계약 금액 (F7) — 한글 금액 표기 / KRW
  grep -E '(\b[0-9]{1,3}(,[0-9]{3})+\s*원\b|\b[0-9]+\s*(만|천만|억)\s*원\b|KRW\s*[0-9])' activity/.../benchmark-*.md
  # (e) 계약 일정 (F7) — ISO 또는 한글 날짜 + 계약 시작/종료 keyword
  grep -E '\b(20[0-9]{2}\.?[0-9]{1,2}\.?[0-9]{1,2}|20[0-9]{2}-[0-9]{2}-[0-9]{2}|20[0-9]{2}년\s*[0-9]+월\s*[0-9]+일)\b.*(계약|시작|종료|발효|만료)' activity/.../benchmark-*.md
  # (f) 영업비밀 keyword (F7)
  grep -E '(영업비밀|기밀|확인불가|secret|confidential)' activity/.../benchmark-*.md
  ```
- `check-pii.sh` PASS 의무 (AC-S19 mirror). 6 종 모두 0 hit 의무.
- **용역계약서 전용 redaction rule** (codex cycle #2 ID-5): `.wikey/pii-patterns.yaml` 의 `kind: regex` rule 신규 추가 (위 (a)~(f) 6 종) + `pii-patterns.ts` 의 PII engine 으로 ingest 단계에서 redaction. Step 1 (`fixture copy`) 후 `check-pii.sh` 로 fixture 자체 redaction 확증.

### 5.5 용역계약서 fixture 포함 LOCK (사용자 결정 2026-05-14)

`C20260410_용역계약서_SK바이오텍전자구매시스템구축.pdf.md` (12KB) = **F7 LOCK** (codex cycle #2 ID-2 fix). PII risk ↑ 단 wikey 사용자 영역 자주 등장 + redaction rule 영역 강화 가치 ↑.

- **이전 권장 (analyst 제외) → 사용자 결정 LOCK 포함** (2026-05-14).
- F7 = 이전 "스마트공장 hwp.md" (1.3K 행정 공지) 교체 — low representativeness fixture 가 high-value PII fixture 로 교체. 7 file count 유지. cell count 산식 = 8 model × 7 fixture × 6 task × 3 cycle = **1,008 measurement** (raise 17/18/19 deep paradigm 통합 mirror).
- **PII redaction rule 의무** (§5.4 (c)~(f) 4 종 신규) — fixture copy 직후 redaction PASS 확증.

---

## §6 community reference 통합 plan (사용자 raise 7 핵심)

### 6.1 HuggingFace Open LLM Leaderboard

- **URL**: https://huggingface.co/spaces/open-llm-leaderboard/open_llm_leaderboard
- **fetch 방법**: 
  - 1차: 공식 leaderboard page parse (HTML scraping 또는 HF datasets API: `datasets/open-llm-leaderboard/contents`)
  - 2차: `huggingface_hub` Python client → `list_datasets` + filter
  - 응답 = JSON / CSV
- **wikey 도메인 align column 우선순위**:
  | Category | wikey align | 정당성 |
  |----------|-------------|--------|
  | **IFEval** | ★★★ | instruction following → canonicalize / mention 의 LLM prompt 정확도 |
  | **GPQA** | ★★ | graduate-level QA → query answer task |
  | **BBH** | ★★ | reasoning → canonicalize type 분류 |
  | MMLU | ★ | general knowledge — wikey 사용 case 와 거리 |
  | MATH | ☆ | 수학 — wikey 와 무관 |
  | MUSR | ☆ | story reasoning — wikey 와 무관 |
- **결과 통합 column**: `community_HF_avg` = (IFEval × 0.5 + GPQA × 0.3 + BBH × 0.2) × 100 (정규화)

### 6.2 LMSYS Chatbot Arena

- **URL**: https://lmarena.ai/leaderboard
- **fetch 방법**: 
  - 1차: leaderboard API endpoint (확인 의무 — public JSON 또는 HTML)
  - 2차: `lmarena.ai` GitHub repo (정기 dump)
- **wikey align column**:
  | Category | wikey align |
  |----------|-------------|
  | Overall ELO | ★★ (general quality signal) |
  | **Korean (한국어 category)** | ★★★ (한국어 fixture 5/7 → 가장 중요) |
  | English | ★★ (영문 fixture 2/7) |
  | Coding | ☆ (wikey 와 거리) |
  | Hard prompts | ★★ (canonicalize prompt 복잡도) |
- **결과 통합 column**: `community_LMSYS_avg` = (Korean ELO × 0.5 + English ELO × 0.3 + Hard prompts × 0.2)

### 6.3 Korean LLM Leaderboard

- **후보 source**:
  - **Upstage / Solar Leaderboard** — https://huggingface.co/spaces/upstage/open-ko-llm-leaderboard
  - **Ko-LLM Leaderboard** (HF Korean variant)
  - **KLUE benchmark** — https://klue-benchmark.com/
  - **HAERAE-Bench** (한국 cultural knowledge)
- **fetch 방법**: HF Space dataset API (Upstage Ko-LLM 가 가장 active maintenance, 2024~)
- **wikey align**: ★★★ (한국어 5/7 fixture). 본 column 이 best-fit 결정의 **3순위 weighting** 가져야 한다.
- **결과 통합 column**: `community_Korean_avg` (단일 source 채택 시 source 명시)

### 6.4 vendor published benchmarks

- **fetch 방법**: master 가 각 vendor 의 공식 paper / blog URL 1회 fetch + 본 문서 reference 인용:
  - Meta Llama 3.x technical report (https://ai.meta.com/blog/meta-llama-3-1/)
  - Alibaba Qwen2.5 / Qwen3 paper (https://qwenlm.github.io/blog/qwen3/)
  - DeepSeek V3 paper (https://arxiv.org/abs/2412.19437)
  - Mistral Large 2 (https://mistral.ai/news/mistral-large-2407/)
  - Google Gemini 2.5 (technical report)
- **wikey align column**: vendor self-report 는 bias ↑ → reference only (winner 결정 weighting ≤ 0.05)
- **결과 통합 column**: `community_vendor_self` (note column, 결정 weighting 최소)

### 6.5 wikey 자체 측정 ↔ community score 비교

```markdown
| 모델 | wikey 도메인 accuracy | community_HF | community_LMSYS | community_Korean | 일관성 |
|------|-----------------------|--------------|------------------|---------------------|--------|
| llama3:70b-cloud | 0.78 | 0.71 | 0.68 | 0.65 | 일관 (모두 0.65~0.78) |
| qwen3:72b-cloud  | 0.85 | 0.74 | 0.72 | 0.81 | 일관 (한국어 align 강) |
| ... |
```

- **일관 (wikey ≈ community)**: 신뢰도 ↑, winner 결정 자동 가속
- **불일치 (wikey 도메인 specific 차이)**: master 가 *왜 wikey 도메인 에서 다른가* 분석 (예: "wikey 한국어 mention 정확도 ↑ 인데 community HF 의 MMLU 영문 dominant → wikey 영역에서만 강함, MMLU 전반 약함은 정상")
- **community score 의 미달**: wikey 의 *specific 사용 case* 가 community 일반 case 와 다름을 의미 — wikey 자체 측정 결과를 신뢰. community 는 sanity check 만.

---

## §7 best-fit 결정 algorithm (사용자 raise 6 핵심)

### 7.1 5 tier weighting 공식

```
score(model) = 
  W1 × wikey_accuracy(model)         # 1순위 (0.50)
  + W2 × semantic_preservation(model)  # 2순위 (0.25)
  + W3 × latency_warm_p50_inverse(model)  # 3순위 (0.10)
  + W4 × cost_per_ingest_inverse(model)   # 4순위 (0.05)
  + W5 × community_score_avg(model)       # 5순위 (0.10)

W1 + W2 + W3 + W4 + W5 = 1.00
```

### 7.2 wikey_accuracy 계산 (codex cycle #2 ID-6 normalization fix)

```
wikey_accuracy(model) = 
  Σ (fixture in 7) (fixture_weight(fixture) × task_weighted_score(fixture, model))
  -----------------------------------------------------------------------------
  Σ (fixture in 7) fixture_weight(fixture)
```

여기서:
- `task_weighted_score(fixture, model) = Σ (task in 6) (task_weight(task) × task_score(fixture, task, model))` (codex cycle #3 ID-1 final fix — deep paradigm 6 task)
- `fixture_weight(fixture)` = `한국어 fixture × 1.2 / 영문 fixture × 1.0` (사용자 분포 반영)
- `task_weight` = {canonicalize: 0.25, mention: 0.20, brief: 0.15, query: 0.20, cross-reference: 0.10, hallucinate-detection: 0.10} (합 = 1.00, deep paradigm raise 19)
- `task_score` = task 별 metric (Jaccard / F1 / ROUGE-L 정규화 0~1)
- denominator = `Σ fixture_weight` (한국어 5 × 1.2 + 영문 2 × 1.0 = 6.0 + 2.0 = **8.0**) — codex ID-6 fix. 이전 `/ 7` 은 max > 1.0 가능했음.

### 7.3 semantic_preservation 계산

```
semantic_preservation(model) = 
  0.4 × (1 - korean_hanja_error_ratio)
  + 0.3 × table_markdown_ratio
  + 0.3 × (llm_judge_score / 10)
```

### 7.4 latency / cost inverse 정규화

```
latency_warm_p50_inverse(model) = min_p50 / model_p50  # 가장 빠른 모델 = 1.0
cost_per_ingest_inverse(model)  = min_cost / model_cost  # 가장 싼 모델 = 1.0
```

### 7.5 community_score_avg (codex cycle #2 ID-6 normalization fix)

각 community source 의 raw score 는 단위 / 범위가 다름 (HF Open LLM = 0~100 / LMSYS Arena ELO = 700~1500 / Korean LLM = 0~100). **W5=0.10 공식에 투입 전 모두 0~1 정규화 의무**:

```
# 정규화 (0~1 범위)
HF_norm(model)     = HF_raw(model)     / 100        # 0~100 → 0~1
LMSYS_norm(model)  = (LMSYS_raw(model) - ELO_min) / (ELO_max - ELO_min)
                     # 본 cycle 측정 시점 leaderboard top-bottom 으로 min-max scale. master fetch 시 lock
Korean_norm(model) = Korean_raw(model) / 100        # 0~100 → 0~1

community_score_avg(model) = 
  0.4 × HF_norm(model)
  + 0.3 × LMSYS_norm(model)
  + 0.3 × Korean_norm(model)
```

vendor self-report 는 명시적으로 weighting 0 (bias 회피). LMSYS ELO 의 min-max bound 는 master fetch 시점 lock (drift 추적).

### 7.6 결정 tier

```
tier 1 (winner)      = max(score)
tier 2 (alternative) = 2위 모델 (Δscore ≤ 0.05 시 명시)
tier 3 (fallback)    = local Ollama 회귀 path (qwen3:8b)
```

본 winner = §5.6.5.5 Step E 의 production 채택 결정 source. master 가 `PROVIDER_CHAT_DEFAULTS` 에 `'ollama-cloud': '<winner-model>'` 추가.

### 7.7 baseline `gemini-2.5-flash` 비교 의무

winner 모델의 `score` 가 `gemini-2.5-flash.score` 보다 **낮으면 production 채택 X** — gemini-2.5-flash 가 이미 baseline. 그 경우 결과 = "Ollama Cloud 모델 중 wikey 도메인 best 는 X 이나 gemini-2.5-flash 우위 — production 채택 보류" (사용자 결정 게이트 명시).

---

## §8 분량 / cost / risk

### 8.1 측정 cost 예상

- **8 model × 7 fixture × 6 task = 336 cell** (raise 17 5 cloud + raise 18 baseline subscription B1 + local L1, deep paradigm 6 task raise 19)
- **deep multi-cycle repeat = 294 cell × 3 cycle = 1,008 measurement** (raise 19 deterministic consistency)
- 추가 LLM-judge call (semantic preservation 3 sub-metric × judge 평가) = 294 × ~3 = ~882 judge call (gemini-2.5-flash)
- 추가 golden committee call (Q4=γ LOCK 3 model = gemini + claude-3.5-sonnet + gpt-4.1) per fixture × task = 7 fixture × 6 task × 3 model = **126 golden call** (1회 cycle)
- 각 cell ≈ source size 의 1~3배 token (input + output) — 평균 10K token 가정
- 140 × 10K = **1.4M token / 모델 set 1회 cycle**
- LLM-judge (semantic preservation) 추가 = 140 × 1K = 140K token
- 총 ≈ 1.5M token / cycle

**provider 별 cost 추정** (2026-05-14 시점 vendor price 가정 — master PoC §0 lock):
- Ollama Pro = subscription (quota 의 fraction 계산)
- gemini-2.5-flash = $0.075 / 1M input + $0.30 / 1M output ≈ **$0.50 / cycle**
- Anthropic Claude (reference) = ≈ $3 / cycle
- OpenAI GPT-4.1 (reference) = ≈ $5 / cycle

### 8.2 cycle 시간 예상

- 1,008 measurement × 평균 latency 20s ≈ **5 시간 (단일 sequential)**
- parallel 8 model = **45 분~1 시간**
- 추가 golden committee 126 call × 30s = **1 시간**
- 추가 judge 882 call × 5s = **1.2 시간**
- **총 cycle 시간 추정 = 2~3 시간** (parallel 8 model + sequential fixture / task) — deep paradigm raise 19 cost
- 라이브 CDP smoke (master 가시 cycle 1 모델 × 2 fixture) = +30 분
- 총 ≈ **2 시간**

### 8.3 risk + mitigation

| Risk | 영향 | Mitigation |
|------|------|------------|
| catalog drift (Ollama Cloud) | 모델 set 변경 | PoC §0 에서 catalog snapshot fix + commit |
| Ollama Pro quota 소진 | 측정 중단 | 1차 PoC (1 model × 1 fixture) 로 quota 사용량 추정 후 본 cycle |
| community source URL 변동 | fetch 실패 | fallback 2~3 source 명시 (HF / LMSYS 둘 다) + master 직접 1회 fetch + 결과 cache |
| LLM-judge non-determinism | semantic score 변동 | temperature=0 + seed=42 + 3 cycle repeat 평균 (AC-S20 mirror) |
| PII 누출 (F4 사업자등록증) | 보안 issue | `check-pii.sh` PASS + 결과 markdown grep redact (§5.4) |
| golden answer bias (옵션 β/γ) | winner 결정 왜곡 | committee (γ) 채택 시 3 모델 majority + 사용자 spot-check 30분 |
| gemini-2.5-flash 우위로 결론 | 본 cycle 무의미 결과 | §7.7 명시 — Ollama Cloud production 채택 보류 (negative result 도 valid) |

---

## §9 master 가 §5.6.5.4 Step D 실행 시 의무 절차

### 9.1 사전 (PoC §0 완료 후)

1. ✅ `wikey.schema.md` 첫 read
2. ✅ `plan/phase-5/phase-5-spec-5.6.5-ollama-cloud.md §1.3 Spec 4` (AC-S17~S20) read
3. ✅ 본 문서 (`docs/ollama-cloud-benchmark-plan.md`) read
4. ✅ Ollama Cloud catalog snapshot lock (PoC §0 산출)
5. ✅ 사용자 결정 gate — Q3 (harness layer e/f/g) + Q4 (golden 작성 α/β/γ) lock
6. ✅ golden answer set 작성 (Q4 결정 따라)

### 9.2 실행 step

```
Step 9.2.1: fixture copy
  master 직접: cp docs/samples/{F1..F7} → raw/0_inbox/benchmark-5.6.5/
  idempotent (rsync --update)

Step 9.2.2: harness 준비 (Q3 결정 따라 - e/f/g)
  e: scripts/benchmark-ollama-cloud.sh
  f: wikey-core/src/scripts/benchmark-models.ts
  g: bash orchestration + ts metric 집계 (분리)

Step 9.2.3: 모델별 measurement (parallel 가능)
  for model in $MODEL_SET; do
    for fixture in F1..F7; do
      run_canonicalize $model $fixture → measure {Jaccard, latency}
      run_mention_extract $model $fixture → measure {F1, latency}
      run_brief $model $fixture → measure {ROUGE-L, llm_judge}
      build_wiki $fixture
      run_query $model $fixture → measure {citation_prec, ROUGE-L}
    done
  done

Step 9.2.4: community fetch (master 1회)
  HF leaderboard JSON fetch → cache
  LMSYS leaderboard fetch → cache
  Korean leaderboard fetch → cache
  vendor reference URL list (인용만)

Step 9.2.5: 결과 markdown 생성
  docs/ollama-cloud-benchmark-result.md
  형식: §9.3

Step 9.2.6: winner 결정
  §7 algorithm 적용 → tier 1/2/3 분류
  gemini-2.5-flash 비교 (§7.7)

Step 9.2.7: PII grep
  check-pii.sh PASS
  추가 grep (사업자등록번호 / 주소 패턴) 0 hit

Step 9.2.8: 라이브 CDP smoke (master 직접, 사용자 가시)
  winner 모델 1개 + 1~2 fixture ingest CDP cycle
  Notice 영문 / Processing time / wiki write page count capture

Step 9.2.9: 사용자 보고
  채팅에 winner 명시 + score + tier 2 + tier 3
  Step E (production 채택) 진입 게이트
```

### 9.3 결과 markdown 형식 (`docs/ollama-cloud-benchmark-result.md`)

```markdown
---
section: 5.6.5.4
tag: #benchmark #ollama-cloud #wikey-domain-fit
date: 2026-MM-DD
---

# §5.6.5.4 Step D — Ollama Cloud Benchmark 결과

## 1. 모델 set (PoC §0 lock)
- ...

## 2. wikey 도메인 측정 결과 (5 metric × 5 model × 7 fixture × 4 task)

### 2.1 Aggregate score (best-fit algorithm §7)
| 모델 | wikey_accuracy | semantic | latency_p50 | cost | community_avg | **score** | tier |
|------|----------------|----------|-------------|------|---------------|-----------|------|
| ... |

### 2.2 task × fixture breakdown
| Model | Task | F1 (Korean Wi-SUN) | F2 (Eng rp1) | F3 (HWPX) | F4 (사업자) | F5 (PMS) | F6 (GS) | F7 (스마트공장) |
|-------|------|--------|-------|-------|--------|----|----|-------|
| ... |

### 2.3 latency / cost
| Model | latency_cold | latency_warm_p50 | latency_warm_p95 | cost_per_ingest |
|-------|-------------|-------------------|-------------------|-----------------|

### 2.4 semantic preservation
| Model | korean_hanja_err | table_md_ratio | llm_judge_score |
|-------|-------------------|-----------------|------------------|

## 3. community reference

### 3.1 HF Open LLM Leaderboard (fetch 2026-MM-DD)
| Model | IFEval | GPQA | BBH | avg |
| ... |

### 3.2 LMSYS Chatbot Arena (fetch 2026-MM-DD)
### 3.3 Korean LLM Leaderboard (fetch 2026-MM-DD)
### 3.4 vendor self-report (인용)

## 4. 일관성 분석 (wikey 측정 ↔ community)
- ...

## 5. 결정 (§7.6 tier)
- tier 1 (winner): <model>
- tier 2 (alternative): <model>
- tier 3 (fallback): local qwen3:8b

## 6. baseline `gemini-2.5-flash` 비교 (§7.7)
- winner.score = X.XX vs gemini-2.5-flash.score = X.XX
- production 채택 = YES / NO (Step E 진입 가능 여부)

## 7. PII grep (AC-S19)
- check-pii.sh: PASS
- 사업자등록번호 grep: 0 hit
- 주소 grep: 0 hit

## 8. 라이브 CDP smoke (master 직접)
- ...
```

---

## §10 self-check (Karpathy 4 원칙 + wikey schema 4 원칙 cross-check)

### 10.1 Karpathy 4 원칙

| 원칙 | 본 plan 의 준수 |
|------|-----------------|
| **(1) Think Before Coding** | golden answer 작성 방법 3 옵션 + 사용자 결정 gate. PoC §0 catalog lock 의무. analyst hallucinate 금지. |
| **(2) Simplicity First** | 5 metric (정확도 / 의미 / latency / cost / community). 추측 weighting X. fixture 7 → over-engineering 위험 회피. |
| **(3) Surgical Changes** | benchmark harness = `wikey-core/src/scripts/benchmark-models.ts` 단일 신규 file (Q3 결정 시 lock). 기존 `benchmark-search.ts` 변경 0. |
| **(4) Goal-Driven Execution** | 검증 가능한 성공 기준 = AC-S17~S20 + §7 algorithm score 합산. winner 모델 1개 결정. |

### 10.2 wikey schema 4 원칙 (Karpathy llm-wiki.md → wikey.schema.md)

| 원칙 | 본 plan 의 준수 |
|------|-----------------|
| **Explicit (지식의 가시화)** | community + wikey 자체 score 모두 markdown table → 결과가 코드 안 hidden 가 아닌 *읽을 수 있는 문서* 로 노출 (§9.3). |
| **Yours (데이터 소유권)** | fixture corpus 로컬 (`docs/samples/` + `raw/0_inbox/` Git or .gitignore 대상). 결과 markdown 도 `activity/` 로컬 commit. vendor lock-in 회피. |
| **File over app (파일 우선)** | 결과 = markdown table. JSON / DB 의존 0. Unix grep / diff 호환. |
| **BYOAI (AI 선택 자유)** | community reference 자체가 *vendor lock-in 회피 강화* (winner 결정이 single vendor self-report 가 아닌 다층 score). winner 가 향후 변경 시 본 plan 재실행 cost ≤ 2 hours. |

### 10.3 wikey 3계층 경계 준수 (i anchor)

- `raw/` 내용 수정 X (fixture copy = `docs/samples/` → `raw/0_inbox/` 만, raw 본문 수정 0)
- `wiki/` 는 benchmark cycle 안에서 LLM 이 생성 (정상 ingest path)
- `wikey.schema.md` 수정 X (본 plan 은 docs/ 신규 file)

### 10.4 워크플로우 4 일관 (j anchor)

- benchmark cycle = 인제스트 워크플로우의 *측정 instance* (raw → LLM → wiki)
- 쿼리 task = 쿼리 워크플로우의 직접 측정
- lint / 삭제 워크플로우는 본 benchmark 범위 외 (별 cycle)

### 10.5 하드코딩 금지 (k anchor, 사용자 영구 결정 2026-05-10)

- 평가 모델 set = PoC §0 catalog lookup (hardcoded const 0)
- task weighting = 본 문서 §3.5 명시 (justification 있음, 사용자 결정 후 lock)
- fixture weighting = 한국어 × 1.2 (justification: 사용자 분포)
- LLM-judge prompt = `gemini-2.5-flash` 동적 호출 (rule-based classifier 0)
- community fetch = master 직접 1회 fetch (cache, polling cycle 따라 stale 의심 시 재fetch)

### 10.6 미확정 사항 (deferred)

| 항목 | 결정 주체 | 시점 |
|------|-----------|------|
| Ollama Cloud catalog 실 list | master PoC §0 | §5.6.5.4 Step D 진입 전 |
| 평가 모델 set 4~5 lock | master PoC §0 + 사용자 승인 | §5.6.5.4 Step D 진입 전 |
| Q3 harness layer (e/f/g) | 사용자 | analyst plan 승인 시 |
| Q4 golden answer 작성 (α/β/γ) | 사용자 | analyst plan 승인 시 |
| 용역계약서 fixture 포함 여부 | 사용자 | analyst plan 승인 시 (analyst 권장 = 제외) |
| community URL 실 fetch | master | §9.2.4 Step 9.2.4 실행 시 1회 |
| LLM-judge determinism (seed=42 지원 모델 확인) | master | PoC §0 |
| Ollama Pro quota 소진 사전 추정 | master | PoC §0 (1 model × 1 fixture 1차 측정) |

### 10.7 7-anchor self-check (글로벌 analyst.md)

- (a) **internal consistency**: §1~§10 cross-reference 확인. §3 task × §4 metric × §7 algorithm score → 단일 식 도출. ✅
- (b) **AC measurable**: §4 metric 모두 단위 명시 (ms / 0~1 float / 0~10). ✅
- (c) **scope boundary**: docs/ollama-cloud-benchmark-plan.md 1 file 만 작성. wikey-core / wikey-obsidian 변경 X. ✅
- (d) **Dependency 명시**: §5.6.4 종결 (commit `e68c53d`) + §5.7.4 Orama 종결 + Kiwi WASM vendored + 사용자 Ollama Pro 구독. ✅
- (e) **사용자 결정 gate**: §10.6 8 항목 명시. ✅
- (f) **risk + mitigation**: §8.3 7 항목 표. ✅
- (g) **commit timing**: master commit (별 cycle, analyst 영역 외 — scope 한계 준수). ✅

### 10.8 wikey 추가 anchor (project-specific)

- (h) **schema 4 원칙 일치**: §10.2 명시 ✅
- (i) **3계층 경계 준수**: §10.3 명시 ✅
- (j) **워크플로우 4 일관**: §10.4 명시 ✅
- (k) **하드코딩 금지**: §10.5 명시 ✅

---

## §11 다음 단계 (master 가 §5.6.5 본문 진행 후 본 benchmark plan mirror)

1. master 가 본 문서 read + 7-anchor + 4 추가 anchor 검증 → 사용자 승인 게이트
2. (필요 시) codex Mode D Panel cycle → APPROVE 또는 NEEDS_REVISION
3. 사용자 결정 gate — §10.6 8 항목 lock
4. master PoC §0 진행 (catalog snapshot + Ollama Pro quota 측정)
5. master 가 §5.6.5.4 Step D 본 plan 따라 실행:
   - fixture copy (§9.2.1)
   - golden answer 작성 (Q4 결정 따라, §5.3)
   - harness 구현 (Q3 결정 따라, commit 5)
   - 모델별 measurement (§9.2.3)
   - community fetch (§9.2.4)
   - 결과 markdown 작성 (§9.3, commit 6)
   - winner 결정 (§7, §9.2.6)
   - 라이브 CDP smoke (§9.2.8)
6. winner 결정 → §5.6.5.5 Step E 진입 (production 채택, commit 7)
7. master 가 본 문서 § 갱신 (실측 cost / latency / 결과 cross-link)

본 plan 은 master 가 §5.6.5 메인 세션에서 §5.6.5.4 Step D 실행 시 *single source of truth*. todox / spec 변경 시 본 문서도 mirror 의무.

---

**End of document.**

> 본 plan v0.1 — 2026-05-14 analyst 작성. 위임 source: `phase-5-todox-5.6.5-ollama-cloud.md §6 §5.6.5.4` + `phase-5-spec-5.6.5-ollama-cloud.md Spec 4` + 사용자 raise 6 (best-fit) + raise 7 (community).
