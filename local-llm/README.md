# Wikey Local LLM — 아키텍처 및 활용 가이드

> 로컬 LLM은 wikey의 BYOAI 전략에서 **프라이버시·오프라인·비용** 축을 담당한다.
> 클라우드 LLM이 위키를 "쓰는" 역할이라면, 로컬 LLM은 위키를 "읽는" 역할이다.

## 아키텍처 — 로컬 LLM의 위치

```
┌──────────────────────────────────────────────────────────────────┐
│                      wikey BYOAI 아키텍처                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐      ┌─────────────────────────────┐      │
│  │ 클라우드 LLM      │      │ 로컬 LLM                     │      │
│  │ (Claude, Codex)   │      │ (Gemma 4 via Ollama / vLLM)  │      │
│  │                   │      │                              │      │
│  │ ✅ 인제스트        │      │ ❌ 인제스트 (쓰기 불가)        │      │
│  │ ✅ 쿼리 (고품질)   │      │ ✅ 쿼리 (읽기 전용)           │      │
│  │ ✅ 린트           │      │ ❌ 린트 (전체 분석 불가)       │      │
│  │ ✅ 분석           │      │ ⚠️  쿼리 확장 (Phase 2)       │      │
│  │                   │      │ ⚠️  리랭킹 (Phase 3)          │      │
│  └────────┬──────────┘      └──────────────┬───────────────┘      │
│           │ 읽기/쓰기                        │ 읽기 전용           │
│           ▼                                 ▼                    │
│  ┌──────────────────────────────────────────────────────┐       │
│  │                wiki/ (마크다운 위키)                    │       │
│  │  index.md │ entities/ │ concepts/ │ sources/         │       │
│  └──────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────┘
```

### 역할 분담 원칙

| 역할 | 클라우드 LLM | 로컬 LLM | 이유 |
|------|------------|---------|------|
| **인제스트** | O | X | 위키 쓰기 필요, 전체 컨텍스트 이해 필요 |
| **쿼리 (깊은 분석)** | O | △ | 분석 품질은 모델 크기에 비례 |
| **쿼리 (단순 조회)** | O | O | 페이지 2-3개 읽고 요약하는 건 로컬로 충분 |
| **린트** | O | X | 위키 전체 스캔 + 수정 필요 |
| **쿼리 확장** | △ | O | 동의어/키워드 생성은 소형 모델로 충분 |
| **리랭킹** | △ | O | 30개 후보 중 상위 선택은 소형 모델로 가능 |
| **오프라인 접근** | X | O | 네트워크 없이 위키 조회 |
| **프라이버시** | △ | O | 민감한 질문을 외부 전송 없이 처리 |

### 언제 로컬 LLM을 쓰는가?

```
"이 개념이 뭐였지?" → 로컬 (단순 조회)
"A와 B를 비교 분석해줘" → 클라우드 (깊은 분석)
"이 소스를 인제스트해줘" → 클라우드 (위키 수정)
"오프라인에서 FPV 스펙 확인" → 로컬 (오프라인)
"검색어를 확장해줘" → 로컬 (쿼리 확장)
```

## 듀얼 서빙 백엔드

wikey는 두 가지 로컬 서빙 엔진을 지원한다. 용도에 따라 선택.

```
┌─────────────────────────────────────────────────────┐
│                 로컬 서빙 백엔드                       │
├──────────────────────┬──────────────────────────────┤
│      Ollama          │         vLLM-Metal           │
│  (인터랙티브 CLI)     │   (OpenAI-호환 API 서버)      │
│                      │                              │
│  ollama run wikey    │  vllm serve gemma4           │
│  wikey-query.sh      │  → http://localhost:8000     │
│                      │  → OpenAI SDK 호환            │
│                      │                              │
│  적합: 터미널 대화,   │  적합: 앱 통합, 배치 처리,    │
│  빠른 조회, 스크립트  │  동시 요청, Phase 3+ 파이프   │
│  파이프라인           │  라인, MCP 서버 연동          │
├──────────────────────┴──────────────────────────────┤
│              Gemma 4 (공통 모델)                       │
│  E4B (2.7GB) · 12B (9.6GB) · 27B MoE (18GB)        │
└─────────────────────────────────────────────────────┘
```

| 항목 | Ollama | vLLM-Metal |
|------|--------|-----------|
| **인터페이스** | CLI (`ollama run`) | OpenAI-호환 HTTP API |
| **장점** | 즉시 사용, 모델 관리 편리 | 높은 처리량, 연속 배칭, SDK 호환 |
| **적합** | 터미널 쿼리, 스크립트 | 앱 통합, 동시 요청, Phase 3+ |
| **설치** | `ollama pull gemma4` | `vllm serve` (venv) |
| **시스템 프롬프트** | Modelfile에 내장 | 서버 시작 시 지정 |

## 설치

### 1. Ollama + Gemma 4

```bash
# Ollama 설치 (macOS)
curl -fsSL https://ollama.com/install.sh | sh

# Gemma 4 다운로드 (12B, 9.6GB)
ollama pull gemma4

# Wikey 전용 모델 생성 (시스템 프롬프트 내장)
cd ~/Project/wikey
ollama create wikey -f local-llm/Modelfile

# 동작 확인
ollama run wikey "wikey 위키란 무엇인가?"
```

### 2. vLLM-Metal (OpenAI-호환 API 서버)

```bash
# vllm-metal 설치 (Apple Silicon 전용 venv)
rm -rf ~/.venv-vllm-metal
curl -fsSL https://raw.githubusercontent.com/vllm-project/vllm-metal/main/install.sh | bash

# venv 활성화
source ~/.venv-vllm-metal/bin/activate

# API 서버 시작 (Gemma 4)
vllm serve google/gemma-4-12b-it \
  --host 0.0.0.0 \
  --port 8000 \
  --max-model-len 32768

# OpenAI SDK로 호출 테스트
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "google/gemma-4-12b-it",
    "messages": [
      {"role": "system", "content": "위키 읽기 전용 어시스턴트"},
      {"role": "user", "content": "BYOAI란?"}
    ]
  }'
```

### 3. 동작 확인

```bash
# Ollama (인터랙티브)
ollama list              # gemma4, wikey 확인
ollama run wikey "테스트"

# vLLM (API)
source ~/.venv-vllm-metal/bin/activate
vllm --version           # 0.19.0+ (vllm-metal 0.2.0)
```

## 사용법 — wikey-query.sh (Ollama 래퍼)

### 기본 쿼리 (index + overview 자동 포함)

```bash
./local-llm/wikey-query.sh "BYOAI란 무엇인가?"
```

### 특정 페이지 지정 쿼리

```bash
./local-llm/wikey-query.sh --pages "byoai,rag-vs-wiki" "두 개념의 차이점은?"
```

### 쿼리 확장 (Phase 2)

```bash
./local-llm/wikey-query.sh --expand "LLM Wiki의 실패 모드는?"
```

### 리랭킹 (Phase 3)

```bash
grep -rl "LLM" wiki/ | ./local-llm/wikey-query.sh --rerank "LLM Wiki의 핵심 원리"
```

### 옵션

| 옵션 | 설명 |
|------|------|
| `--pages "a,b,c"` | 컨텍스트에 포함할 페이지 (쉼표 구분) |
| `--expand` | 쿼리 확장 모드 |
| `--rerank` | 리랭킹 모드 |
| `--model NAME` | 모델 지정 (기본: wikey) |
| `--raw` | 시스템 프롬프트 없이 gemma4 직접 호출 |

### 환경변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `WIKI_DIR` | `wiki` | 위키 디렉토리 |
| `WIKEY_MODEL` | `wikey` | Ollama 모델명 |

## Phase별 활용 로드맵

### Phase 1 (현재) — 단순 쿼리

```
사용자 질문 → wikey-query.sh → Ollama(wikey/gemma4) → 답변
                  │
                  └─ 컨텍스트: index.md + overview.md
                     또는 --pages로 지정한 페이지
```

- 위키 규모: ~30 페이지
- 컨텍스트 전략: 수동 페이지 선택
- 서빙: Ollama (인터랙티브)
- 모델: Gemma 4 12B (9.6GB), 컨텍스트 32K

### Phase 2 — 쿼리 확장 파이프라인

```
사용자 질문
    │
    ▼
wikey-query.sh --expand    (Ollama: 키워드 확장)
    │
    ▼
grep/qmd로 관련 페이지 검색  (로컬: 텍스트 검색)
    │
    ▼
wikey-query.sh --pages     (Ollama: 답변 생성)
```

- 위키 규모: ~100 페이지
- 컨텍스트 전략: 확장 키워드로 자동 페이지 선택
- 추가 필요: qmd 연동 스크립트

### Phase 3 — 리랭킹 파이프라인 (vLLM 도입)

```
사용자 질문
    │
    ▼
vLLM API: 쿼리 확장              (고처리량)
    │
    ▼
qmd 하이브리드 검색 (BM25+벡터)   (로컬: 후보 30개)
    │
    ▼
vLLM API: 리랭킹                 (배치 처리)
    │
    ▼
vLLM API: 최종 합성              (또는 클라우드 위임)
```

- 위키 규모: ~300 페이지
- 서빙: vLLM-Metal (OpenAI API 호환)
- 이유: 리랭킹은 다수 후보를 배치 처리해야 하므로 API 서버가 효율적
- 추가 필요: qmd MCP 서버, 파이프라인 오케스트레이션

### Phase 4 — 엔터프라이즈

```
사용자 질문
    │
    ▼
vLLM: 쿼리 확장 + 의도 분류
    │
    ├─ 단순 조회 → vLLM으로 즉시 답변
    └─ 심층 분석 → 클라우드 LLM으로 위임
    │
    ▼
하이브리드 검색 (BM25 + 벡터 + 한국어 형태소)
    │
    ▼
vLLM: 리랭킹 (연속 배칭)
    │
    ▼
선택된 LLM: 최종 합성
```

- 서빙: vLLM-Metal (상시 데몬)
- 모델: Gemma 4 27B MoE (더 높은 품질)
- 동시 요청: 팀 서버에서 여러 사용자 지원

## 모델 선택 가이드

### Gemma 4 패밀리

| 모델 | 파라미터 | 크기 | RAM | 컨텍스트 | 추천 용도 |
|------|---------|------|-----|---------|----------|
| `gemma4:e2b` | 2B | ~2.7GB | 8GB+ | 128K | 쿼리 확장, 분류 (최경량) |
| `gemma4:e4b` | 4B | ~4.5GB | 8GB+ | 128K | 단순 쿼리, 리랭킹 |
| **`gemma4`** (기본) | **12B** | **9.6GB** | **16GB+** | **128K** | **범용 (현재 기본)** |
| `gemma4:27b` | 27B MoE | ~18GB | 32GB+ | 256K | 클라우드 대체, 심층 분석 |

### Ollama vs vLLM 모델 지정

| 백엔드 | Ollama | vLLM-Metal |
|--------|--------|-----------|
| 기본 12B | `ollama run gemma4` | `vllm serve google/gemma-4-12b-it` |
| E4B | `ollama run gemma4:e4b` | `vllm serve google/gemma-4-e4b-it` |
| 27B | `ollama run gemma4:27b` | `vllm serve google/gemma-4-27b-it` |
| wikey 커스텀 | `ollama run wikey` | 서버 시작 시 `--system-prompt` |

## 제약 사항

1. **쓰기 불가**: 위키 페이지 생성·수정·삭제는 하지 않음
2. **컨텍스트 활용**: Gemma 4는 128K 지원하지만, 실제 품질은 32K 이내가 최적
3. **한국어 품질**: 클라우드 모델 대비 한국어 생성 품질 낮음 (Gemma 4에서 개선됨)
4. **위키링크 형식**: Gemma 4는 `[[페이지명]]` 인용을 비교적 잘 따름 (Gemma 3 대비 향상)
5. **환각 가능**: 위키에 없는 내용을 생성할 수 있음 → 시스템 프롬프트로 완화
6. **vLLM 메모리**: Gemma 4 12B 서빙 시 ~12GB 메모리 필요

## 파일 구조

```
local-llm/
├── README.md           # 이 파일 — 아키텍처, 설치, 활용 가이드
├── Modelfile           # Ollama 커스텀 모델 (Gemma 4 + 시스템 프롬프트)
├── system-prompt.md    # 시스템 프롬프트 원본 (참조용, vLLM/수동 파이핑 시 사용)
└── wikey-query.sh      # CLI 래퍼 (쿼리, 확장, 리랭킹 3모드)
```

## 참고 자료

- [Ollama — Gemma 4](https://ollama.com/library/gemma4)
- [vllm-metal — Apple Silicon 플러그인](https://github.com/vllm-project/vllm-metal)
- [vllm-mlx — 커뮤니티 구현](https://github.com/waybarrios/vllm-mlx)
- [Gemma 4 — Google DeepMind](https://deepmind.google/models/gemma/gemma-4/)
