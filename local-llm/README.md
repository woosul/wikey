# Wikey Local LLM — 아키텍처 및 활용 가이드

> 로컬 LLM은 wikey의 BYOAI 전략에서 **프라이버시·오프라인·비용** 축을 담당한다.
> 클라우드 LLM이 위키를 "쓰는" 역할이라면, 로컬 LLM은 위키를 "읽는" 역할이다.

## 아키텍처 — 검색 인프라 + 지능 레이어 분리

```
┌─────────────────────────────────────────────────────────────────────┐
│                      wikey 쿼리 아키텍처                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────┐         │
│  │         지능 레이어 (LLM — backend 설정으로 선택)        │         │
│  │                                                       │         │
│  │  backend=basic              backend=gemma4             │         │
│  │  qmd 내장 모델               Gemma 4 (12B)             │         │
│  │  - 확장: 1.7B               - 확장: Gemma 4            │         │
│  │  - 리랭킹: 0.6B             - 리랭킹: Gemma 4          │         │
│  │  - 합성: Gemma 4            - 합성: Gemma 4            │         │
│  │  (빠름, 영어 정확)           (느림, 한국어 정확)          │         │
│  └────────────────────┬──────────────────────────────────┘         │
│                       │ 검색 요청                                    │
│                       ▼                                             │
│  ┌───────────────────────────────────────────────────────┐         │
│  │         검색 인프라 (qmd — 항상 사용)                     │         │
│  │                                                       │         │
│  │  BM25 인덱스 + 벡터 인덱스 (EmbeddingGemma-300M)        │         │
│  │  → RRF 융합 → 상위 후보 반환                             │         │
│  │                                                       │         │
│  │  tools/qmd/ (vendored, scripts/update-qmd.sh로 관리)   │         │
│  └────────────────────┬──────────────────────────────────┘         │
│                       │ 읽기                                        │
│                       ▼                                             │
│  ┌───────────────────────────────────────────────────────┐         │
│  │                wiki/ (마크다운 위키)                      │         │
│  │  index.md │ entities/ │ concepts/ │ sources/           │         │
│  └───────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

### 역할 분담 원칙

| 역할 | 클라우드 LLM | 로컬 LLM (Gemma 4) | qmd | 이유 |
|------|------------|-------------------|-----|------|
| **인제스트** | O | X | X | 위키 쓰기 필요, 전체 컨텍스트 이해 필요 |
| **검색 (인덱싱)** | X | X | **O** | BM25+벡터 인덱스는 qmd 전담 |
| **쿼리 확장** | △ | **O** (gemma4 backend) | △ (basic) | Gemma 4가 한국어 확장에 우수 |
| **리랭킹** | △ | **O** (gemma4 backend) | △ (basic) | 12B가 0.6B보다 의미 판단 정확 |
| **합성** | O | **O** | X | 최종 답변 생성 |
| **린트** | O | X | X | 위키 전체 스캔 + 수정 필요 |
| **오프라인** | X | O | O | 전체 로컬 실행 |

### 언제 어떤 backend를 쓰는가?

```
빠른 조회, 영어 쿼리       → basic  (qmd 내장 모델, ~1초 캐시 히트)
한국어 쿼리, 정확도 중요    → gemma4 (Gemma 4 확장+리랭킹, ~15초)
오프라인                   → 둘 다 가능 (전체 로컬)
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

## 사용법 — wikey-query.sh (qmd + Ollama 래퍼)

### 설정 파일 (`local-llm/wikey.conf`)

```bash
WIKEY_SEARCH_BACKEND=basic    # basic: qmd 내장 | gemma4: Gemma 4 확장+리랭킹
WIKEY_MODEL=wikey             # Ollama 모델명
WIKEY_QMD_TOP_N=5             # qmd 검색 결과 수
```

### 기본 쿼리

```bash
# basic backend (기본값): qmd 내장 파이프라인 → Gemma 4 합성
./local-llm/wikey-query.sh "BYOAI란 무엇인가?"

# gemma4 backend: Gemma 4 확장 → qmd 검색만 → Gemma 4 리랭킹+합성
WIKEY_SEARCH_BACKEND=gemma4 ./local-llm/wikey-query.sh "위키 인제스트란?"
```

### 특정 페이지 지정 쿼리 (qmd 스킵)

```bash
./local-llm/wikey-query.sh --pages "byoai,rag-vs-wiki" "두 개념의 차이점은?"
```

### 검색만 (합성 없이)

```bash
./local-llm/wikey-query.sh --search "FPV 영상 전송"
```

### 옵션

| 옵션 | 설명 |
|------|------|
| `--search` | qmd 검색 결과만 출력 (합성 없이) |
| `--pages "a,b,c"` | 컨텍스트에 포함할 페이지 (쉼표 구분, qmd 스킵) |
| `--top N` | qmd 상위 결과 수 (기본: 5) |
| `--backend NAME` | 검색 backend 오버라이드 (`basic` / `gemma4`) |
| `--model NAME` | Ollama 모델 지정 (기본: wikey) |
| `--raw` | 시스템 프롬프트 없이 gemma4 직접 호출 |

### qmd upstream 관리

```bash
# 최신 버전 확인
./scripts/update-qmd.sh --check

# 업데이트 적용 (다운로드 → 교체 → 검증)
./scripts/update-qmd.sh --apply
```

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

### Phase 2 — qmd 다층 검색 파이프라인 (현재)

```
사용자 질문
    │
    ▼
qmd query (내장 파이프라인)
    ├─ 쿼리 확장 (qmd-query-expansion-1.7B)
    ├─ BM25 + 벡터 병렬 검색
    ├─ RRF 융합 (상위 30개)
    └─ LLM 리랭킹 (Qwen3-Reranker 0.6B)
    │
    ▼
상위 5개 페이지 추출
    │
    ▼
Gemma 4 합성 (Ollama: 최종 답변)
```

- 위키 규모: ~30 페이지 (100+로 확장 예정)
- 컨텍스트 전략: qmd 하이브리드 검색으로 자동 페이지 선택
- 검색: qmd 2.1.0 (vendored, `tools/qmd/`)
- 합성: Ollama (wikey/gemma4 모델)
- 벤치마크: Top-1 40%, Top-3 60% (영어 정확, 한국어 부정확 → Step 3 개선)
- 지연: 평균 11.3초/쿼리 (검색+리랭킹)

### Phase 3 — 한국어 특화 + vLLM 도입

```
사용자 질문
    │
    ▼
qmd query (개선된 파이프라인)
    ├─ 한국어 형태소 전처리 (kiwipiepy, Step 3-1 완료)
    ├─ 한영 용어 정규화 사전 적용
    ├─ BM25 + 벡터 검색
    ├─ RRF 융합
    └─ 리랭킹
    │
    ▼
vLLM API: 최종 합성 (배치 처리)
```

- 위키 규모: ~300 페이지
- 서빙: vLLM-Metal (OpenAI API 호환, 배치 리랭킹)
- 한국어: kiwipiepy 형태소 전처리 (Step 3-1 완료) + 용어 정규화 사전
- 목표: Top-1 80%+ 정확도

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
└── wikey-query.sh      # CLI 래퍼 (qmd 검색 → Gemma 4 합성)

tools/
└── qmd/                # qmd 2.1.0 (vendored, @tobilu/qmd 소스 복사)
    ├── bin/qmd         # 실행 파일
    ├── dist/           # 빌드된 소스
    ├── node_modules/   # 의존성 (.gitignore)
    └── package.json    # v2.1.0
```

## 참고 자료

- [Ollama — Gemma 4](https://ollama.com/library/gemma4)
- [vllm-metal — Apple Silicon 플러그인](https://github.com/vllm-project/vllm-metal)
- [vllm-mlx — 커뮤니티 구현](https://github.com/waybarrios/vllm-mlx)
- [Gemma 4 — Google DeepMind](https://deepmind.google/models/gemma/gemma-4/)
