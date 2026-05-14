# PoC §0 — Ollama Cloud 환경 확정 (2026-05-14 master 직접) — **종결**

## 1. 모델 catalog — 5 model 모두 LOCK 확정

| # | 사용자 alias (plan) | ollama 식별자 (PoC LOCK) | size | context | quantization | capabilities | hello | jsonMode (`format:json`) | warm latency |
|---|---------------------|---------------------------|------|---------|---------------|--------------|-------|---------------------------|--------------|
| M1 | deepseek-v4-pro | **`deepseek-v3.1:671b-cloud`** | 671B (deepseek2) | (default) | (default) | completion + tools + thinking | ✅ ok | ✅ raw `{"status":"ok"}` | 838ms |
| M2 | qwen3:122b → `qwen3-coder:480b-cloud` | **`qwen3-coder:480b-cloud`** | 480B | (default) | (default) | completion + tools | ✅ ok | ✅ raw `{"status":"ok"}` | 1150ms |
| M3 | kimi-k2.6 | **`kimi-k2.6:cloud`** | unknown | (default) | (default) | vision + thinking + completion + tools | ✅ ok | ✅ raw `{"status":"ok"}` | 2968ms |
| M4 | gpt-oss:120b-cloud | **`gpt-oss:120b-cloud`** | 117B (gptoss) | 131,072 (128K) | MXFP4 | completion + tools + thinking | ✅ ok | ✅ raw `{"status":"ok"}` | 798ms |
| M5 | Mistral 최신 → `mistral-large-3:675b-cloud` | **`mistral-large-3:675b-cloud`** | 675B (mistral3) | 262,144 (256K) | FP8 | completion + tools + vision | ✅ ok | ⚠️ `` ```json\n{"status":"ok"}\n``` `` wrap | 684ms |

추가 baseline:
- **B1** `gemini-2.5-flash` (gemini subscription, 사용자 강조 #1)
- **L1** `qwen3:8b` (local current basic, raise 18) — jsonMode native ✅
- **L2** `qwen3.6:35b-a3b-nvfp4` (local MoE 35B, raise 22 2026-05-14) — qwen3_5_moe, 256K context, nvfp4, vision+thinking+tools — **jsonMode = adaptive prefix 의무** (mlx runner `format:json` unsupported, plain mode 만 동작, 12s thinking)

→ 측정 model count = **8** (M1~M5 + B1 + L1 + L2). 8 × 7 fixture × 6 task × 3 cycle = **1,008 measurement** (plan v0.4 LOCK, raise 22 mirror).

## 2. Endpoint + Transport (raise 3 paradigm 정합)

- local URL = `http://localhost:11434` (변경 0)
- cloud 호출 = local CLI + 모델 식별자 `:cloud` suffix → 자동 dispatch
- **transport variant (a) confirmed** — `provider key 'ollama-cloud'` (UI subsection) + `OLLAMA_URL` 변경 0 + 모델 식별자 자동 구분 (`isCloudModel` helper) → 단일 endpoint 호출
- → `callOllamaCloud` 별 함수 분리 **불필요** (Karpathy Simplicity First). 단순히 `callOllama` 안에 cloud 모델 분기 (debug log) + 동일 endpoint
- wikey-core mirror: `provider-defaults.ts:75 PROVIDER_CONTEXT_BUDGETS` 에 5 cloud model 의 context length 추가 (M3 unknown 은 default 32K fallback)

## 3. Auth Flow

- SSH key = `~/.ollama/id_ed25519` (2025-07-17 생성)
- `ollama signin` = browser OAuth (ollama.com/connect?name=<host>&key=<ssh-pub>)
- **API key header 없음** — Ollama 자체 SSH + signin state 기반
- → `credentials.json.ollamaCloudApiKey` field **불필요**
- Settings UI 4번째 subsection 의 row:
  - 이전 plan: "Endpoint URL" + "API Key"
  - **확정 PoC plan**: **"Signin status" badge** (signed in / not signed in, 매 60s 또는 manual check) + **"Sign in" / "Sign out" button** → shell command spawn (`ollama signin` / `ollama signout`)
  - signin detection: `ollama show <any-cloud-model>` → success = signed in / `"You need to be signed in"` stderr = not signed in

## 4. jsonMode (`/api/chat` `format:json`)

- 5 model 모두 `"format": "json"` body parameter 지원 (no error, content 정상 JSON)
- M1~M4: raw JSON 응답 (no markdown wrap)
- **M5 mistral-large-3 만 markdown ```json``` block wrap** — post-process 의무
  - `wikey-core/src/llm-client.ts callOllama` 응답 안 `^```json\n` ~ `\n```$` strip helper 추가 (model-specific)
- adaptive prefix paradigm = 5 model 모두 jsonMode 'native' 지원 → §5.6.4 v0.7 R2 adaptive prefix paradigm 불필요. CLI_OPTION_SUPPORT.ollama-cloud.api.jsonMode = **'native'** (vs 이전 plan 'unsupported' 가설)
- 단 stripping helper = 일관성 위해 모든 ollama-cloud 응답에 적용 (M1~M4 = no-op, M5 = strip)

## 5. 비용 모델 — 사용자 결정 = unlimited (Ollama Pro plan 안)

- 사용자 Ollama Pro plan = unlimited quota 가정 (plan 결정 LOCK 2026-05-14)
- 본 cycle 882 measurement + 882 LLM-judge + 126 golden committee = **~1,890 LLM call** (1회)
- ollama dashboard 사후 확인 (master + 사용자)

## 6. plan v0.4 mirror 갱신 영역 (Step A 진입 전 의무)

1. **M1~M5 정확 식별자 LOCK** — phase-5-todox §5.6.5.4 D-2 + spec §1.3 AC + phase-5-todo §5.6.5 mirror
2. **callOllamaCloud 별 함수 분리 → callOllama 안 분기 paradigm 변경** — phase-5-todox §5.6.5.1 Step A GREEN
3. **credentials.json.ollamaCloudApiKey 필드 제거** — Q2 Settings UI 의 4번째 subsection 의 row 변경 (Signin status badge + Sign in/out button)
4. **jsonMode = native** (CLI_OPTION_SUPPORT.ollama-cloud.api.jsonMode = 'native', adaptive prefix 불필요) + M5 markdown wrap strip helper
5. **PROVIDER_CONTEXT_BUDGETS** 5 cloud model 의 context length 추가

## 7. PoC §0 fixture file 인덱스

```
docs/planning/phase-5/fixtures/cycle-5.6.5-ollama-cloud-poc/
├── SUMMARY.md                                            (본 file)
├── endpoint-summary.md
├── hello-probe-deepseek-v3.1-671b-cloud.raw.txt
├── hello-probe-qwen3-coder-480b-cloud.raw.txt
├── hello-probe-kimi-k2.6-cloud.raw.txt
├── hello-probe-gpt-oss-120b-cloud.raw.txt
├── hello-probe-mistral-large-3-675b-cloud.raw.txt
├── jsonmode-probe-deepseek-v3.1-671b-cloud.raw.txt
├── jsonmode-probe-qwen3-coder-480b-cloud.raw.txt
├── jsonmode-probe-kimi-k2.6-cloud.raw.txt
├── jsonmode-probe-gpt-oss-120b-cloud.raw.txt
├── jsonmode-probe-mistral-large-3-675b-cloud.raw.txt
└── model-show-{각 model}.raw.txt
```

## 8. 다음 단계

1. master plan v0.4 mirror (todox + spec + docs + phase-5-todo) — 6 항목 (위 §6)
2. master Step A 구현 진입 — provider 추상화 layer 확장 (callOllama 안 cloud 분기 + isCloudModel + LLMProvider type 확장)
3. master Step B — Settings UI 4번째 subsection (Signin status badge paradigm)
4. master Step C — jsonMode matrix + M5 markdown strip helper
5. developer 위임 Step D — benchmark 882 measurement
6. master Step E — 라이브 cycle smoke + production 채택

PoC §0 종결 — Karpathy "Think Before Coding" 정합 (가정 hallucinate 0, 모든 영역 실측 capture).
