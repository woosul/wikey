# 모델 선택 가이드

> wikey의 LLM 프로바이더 선택, 비용 분석, 기본 모델 설정 가이드.
> 설정 파일: `local-llm/wikey.conf`의 `WIKEY_BASIC_MODEL`

## 1. 프로세스별 LLM 역할

wikey 파이프라인에서 LLM이 개입하는 지점은 2계층으로 나뉜다.

### 로컬 계층 (항상 $0, 변경 불필요)

| 프로세스 | 모델 | 역할 | 설정 |
|---------|------|------|------|
| qmd 쿼리 확장 | qmd-query-expansion 1.7B (GGUF) | 검색 키워드 생성 | `QMD_GENERATE_MODEL` |
| qmd 임베딩 | Qwen3-Embedding 0.6B (GGUF) | 벡터 유사도 검색 | `QMD_EMBED_MODEL` |
| qmd 리랭킹 | Qwen3-Reranker 0.6B (GGUF) | 검색 결과 재정렬 | `QMD_RERANK_MODEL` |
| 쿼리 합성 | Gemma 4 12B (Ollama) | 검색 결과 → 답변 생성 | `WIKEY_MODEL` |
| Contextual Retrieval | Gemma 4 12B (Ollama) | 문서 맥락 프리픽스 생성 | `CONTEXTUAL_MODEL` |
| 한국어 형태소 | kiwipiepy (Python) | FTS5 전처리 | — |

이 계층은 Ollama + GGUF 모델로 동작하며, 클라우드 계정이 없어도 완전히 작동한다.

### 클라우드 계층 (BASIC_MODEL이 결정)

| 프로세스 | 필요 능력 | 스크립트 호출? | 설정 |
|---------|----------|-------------|------|
| 인제스트 | 소스 읽기 → 위키 페이지 생성/수정 | `llm-ingest.sh` 또는 에이전트 세션 | `INGEST_PROVIDER` |
| 린트 | 위키 일관성 검사 + 수정 | 에이전트 세션 (Claude Code/Codex) | `LINT_PROVIDER` |
| 대용량 PDF 요약 | 대용량 PDF → 섹션 인덱스 | `summarize-large-source.sh` | `SUMMARIZE_PROVIDER` |

## 2. 프로바이더별 호환성

### 호환성 매트릭스

| 능력 | claude-code | codex | gemini | ollama |
|------|:-----------:|:-----:|:------:|:------:|
| **인제스트 (에이전트)** | **최고** | 좋음 | — | — |
| **인제스트 (스크립트)** | API 필요 | API 가능 | **API 가능** | 가능 (품질↓) |
| **린트 (에이전트)** | **최고** | 좋음 | — | — |
| **대용량 PDF 요약** | 200K ctx | 128K ctx | **1M ctx** | 131K ctx |
| **스크립트 자동 호출** | ANTHROPIC_API_KEY | OPENAI_API_KEY | GEMINI_API_KEY | localhost |
| **접근 방식** | 구독 ($20~100/월) | API (토큰 과금) | API (거의 무료) | 로컬 ($0) |

### 에이전트 vs 스크립트

- **에이전트 세션**: Claude Code(`claude`), Codex(`codex exec`)처럼 대화형으로 파일을 읽고 쓰는 방식. 최고 품질이지만 해당 CLI가 필요.
- **스크립트 호출**: `llm-ingest.sh`가 API를 직접 호출하여 구조화된 응답을 받고 파일을 생성하는 방식. 어떤 API 프로바이더든 가능.

## 3. 기본 모델 설정 (`WIKEY_BASIC_MODEL`)

### 설정 방법

```bash
# local-llm/wikey.conf
WIKEY_BASIC_MODEL=claude-code    # claude-code | codex | gemini | ollama
```

이 한 줄로 모든 클라우드 프로세스가 해당 프로바이더를 사용한다.
고급 사용자는 프로세스별로 오버라이드할 수 있다:

```bash
# 고급: 프로세스별 오버라이드 (비어 있으면 BASIC_MODEL 따름)
# INGEST_PROVIDER=gemini
# LINT_PROVIDER=codex
# SUMMARIZE_PROVIDER=gemini
```

### 프로바이더별 동작

#### `WIKEY_BASIC_MODEL=claude-code` (권장 — 구독자)

```
인제스트: Claude Code 세션에서 직접 (최고 품질)
         또는 ANTHROPIC_API_KEY로 llm-ingest.sh (스크립트)
린트:     Claude Code 세션에서 직접
대용량:   ANTHROPIC_API_KEY로 summarize (200K ctx)
          또는 Gemma 4 로컬 폴백
```

- 장점: 인제스트/린트 최고 품질, 구독이면 토큰 제한 넓음
- 단점: 스크립트 자동화 시 별도 API 키 필요
- 필요: Claude Pro/Max 구독. 스크립트용은 ANTHROPIC_API_KEY (선택)

#### `WIKEY_BASIC_MODEL=codex` (좋은 대안 — OpenAI 사용자)

```
인제스트: codex exec로 에이전트 인제스트 (좋은 품질)
         또는 OPENAI_API_KEY로 llm-ingest.sh (스크립트)
린트:     codex exec로 교차 검증
대용량:   OPENAI_API_KEY로 summarize (128K ctx)
```

- 장점: 에이전트 + 스크립트 모두 하나의 API 키로 동작
- 단점: 토큰 과금 (인제스트 많으면 비용 증가)
- 필요: OPENAI_API_KEY

#### `WIKEY_BASIC_MODEL=gemini` (저가 — Gemini 사용자)

```
인제스트: llm-ingest.sh로 스크립트 인제스트 (API)
         에이전트 인제스트는 불가 (Gemini에 CLI 에이전트 없음)
린트:     llm-ingest.sh --lint로 스크립트 린트
          에이전트 린트는 불가
대용량:   summarize-large-source.sh (최고, 1M ctx)
```

- 장점: 거의 무료 (1500 req/day 무료 티어), 대용량 PDF 최강
- 단점: 에이전트 세션 불가 → 스크립트 인제스트만 가능, 복잡한 교차참조 품질 제한
- 필요: GEMINI_API_KEY

#### `WIKEY_BASIC_MODEL=ollama` (무료 — 오프라인)

```
인제스트: llm-ingest.sh로 Gemma 4 인제스트 (품질 제한)
린트:     llm-ingest.sh --lint로 Gemma 4 린트 (품질 제한)
대용량:   summarize-large-source.sh --local (131K ctx)
```

- 장점: 완전 무료, 오프라인 동작, 프라이버시 최고
- 단점: 인제스트 품질이 클라우드 대비 현저히 낮음 (위키 컨벤션 위반, 인용 누락 가능)
- 필요: Ollama + Gemma 4 설치만

## 4. API vs 구독

| 프로바이더 | 접근 방식 | 비용 구조 | 스크립트 호출 | 에이전트 세션 |
|-----------|----------|----------|-------------|-------------|
| Claude Code | **구독** (Pro $20/Max $100/월) | 정액제 | 불가 (인터랙티브 전용) | `claude` CLI |
| Anthropic API | **API 키** | $15/M input, $75/M output | `curl` / `llm-api.sh` | — |
| Codex | **API 키** (OpenAI) | $2/M input, $8/M output | `codex exec` / `curl` | `codex` CLI |
| Gemini | **API 키** | $0.15/M input, $0.60/M output | `curl` / `llm-api.sh` | — |
| Ollama | **로컬** | $0 (전기세만) | `ollama run` / `curl` | — |

핵심 구분:
- **에이전트 세션**: `claude` CLI, `codex` CLI — 대화형으로 파일 직접 조작
- **API 호출**: `curl` + `llm-api.sh` — 프롬프트 전송 → 응답 수신 → 스크립트가 파일 조작
- Claude Code 구독 ≠ Anthropic API. 둘 다 Anthropic이지만 별개 서비스. 구독은 CLI 세션, API는 토큰 과금.

## 5. 비용 시뮬레이션

### 월간 사용 패턴 (인제스트 10건, 쿼리 30건, 린트 4회)

| 기본 모델 | 인제스트 | 대용량 | 쿼리 | 린트 | 월 비용 |
|----------|---------|-------|------|------|--------|
| claude-code (구독) | $0 (구독 포함) | $0 (구독 포함) | $0 (로컬) | $0 (구독 포함) | **$20~100** (정액) |
| codex (API) | ~$5 | ~$1 | $0 (로컬) | ~$0.70 | **~$6.70** + 구독 없음 |
| gemini (API) | ~$0.30 | ~$0.10 | $0 (로컬) | ~$0.10 | **~$0.50** |
| ollama (로컬) | $0 | $0 | $0 | $0 | **$0** (전기세만) |

### 품질 vs 비용 트레이드오프

```
품질:  claude-code > codex > gemini > ollama
비용:  ollama < gemini < codex < claude-code
```

## 6. 권장 시나리오

### 시나리오 A: Claude Pro/Max 구독자 (권장)

```bash
WIKEY_BASIC_MODEL=claude-code
# 인제스트: Claude Code 세션 (최고 품질)
# 대용량: Claude Code 세션 내 PDF 읽기 또는 ANTHROPIC_API_KEY
# 린트: Claude Code 세션
```

### 시나리오 B: API 키만 있는 사용자

```bash
WIKEY_BASIC_MODEL=gemini
# 인제스트: llm-ingest.sh (Gemini API)
# 대용량: summarize-large-source.sh (Gemini, 1M ctx)
# 린트: llm-ingest.sh --lint (Gemini API)
```

### 시나리오 C: 완전 오프라인 사용자

```bash
WIKEY_BASIC_MODEL=ollama
# 인제스트: llm-ingest.sh (Gemma 4, 품질 제한)
# 대용량: summarize-large-source.sh --local (Gemma 4, 131K ctx)
# 린트: llm-ingest.sh --lint (Gemma 4, 품질 제한)
```

## 7. 데이터 위치 참조

| 경로 | 역할 |
|------|------|
| `~/.cache/qmd/index.sqlite` | 메인 DB (문서 30개, FTS5, 벡터 49청크) |
| `~/.cache/qmd/contextual-prefixes.json` | Gemma 4 맥락 프리픽스 캐시 (30문서) |
| `~/.cache/qmd/models/` | GGUF 모델 캐시 (6개) |
| `local-llm/wikey.conf` | 통합 LLM 설정 |
| `.env` | 클라우드 API 키 (git 미추적) |
