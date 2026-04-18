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

### 역할 분담 원칙 (Phase 3 현재)

| 역할 | 클라우드 LLM | 로컬 LLM | qmd | 비고 |
|------|------------|---------|-----|------|
| **인제스트 (기본)** | O (claude/gemini) | **Qwen3 8B** (5.2GB) | X | 속도·메모리 안정, 한국어 JSON 안정 |
| **인제스트 (고품질)** | O (claude/gemini) | **Qwen3.6:35b-a3b** (24GB, MoE 3B active) | X | Qwen3 8B 대비 속도 2.2배·concepts 1.9배 (≥48GB RAM) |
| **쿼리 합성/CR** | △ | **Gemma4 26B** (17GB) | X | 인제스트 제외 (thinking 오버헤드), 쿼리·Contextual Retrieval 전용 |
| **검색 (인덱싱)** | X | X | **O** | qmd 내장 파이프라인 전담 |
| **쿼리 확장** | △ | **O** (gemma4 backend) | △ (basic) | 한국어 확장 품질 |
| **리랭킹** | △ | Qwen3-Reranker 0.6B (qmd) | △ (basic) | qmd 내장 경량 모델 |
| **린트** | O | X | X | 위키 전체 스캔 + 수정 필요 |
| **오프라인** | X | O | O | 전체 로컬 실행 |

### 인제스트 모델 선택 기준 (2026-04-18 업데이트)

| 모델 | 시간 (88KB PDF E2E) | 추출량 | 메모리 | 권장 상황 |
|------|--------------------|--------|--------|----------|
| Qwen3 8B | 17min | 27E+26C | 5.2GB VRAM | 일반 환경 기본값 |
| **Qwen3.6:35b-a3b** | **7.6min** | **30E+50C** | 27GB VRAM (M4 Pro 48GB 환경에서 로드 시 47/48GB 사용) | **고품질 요구 + 메모리 여유** |
| Gemini 2.5 Flash | 10min | 46E+170C | — (클라우드) | 최고 품질, 대용량 소스 |

> Qwen3 14B / Gemma4 26B는 인제스트에서 제외됨 (smoke/E2E에서 8B·35b-a3b 대비 열등 또는 thinking 오버헤드).

### 언제 어떤 backend를 쓰는가?

```
빠른 조회, 영어 쿼리       → basic  (qmd 내장 모델, ~1초 캐시 히트)
한국어 쿼리, 정확도 중요    → gemma4 (Gemma4 26B 확장+리랭킹, ~15초)
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

### 1. Ollama + Phase 3 모델 세트

```bash
# Ollama 설치 (macOS)
curl -fsSL https://ollama.com/install.sh | sh

# 인제스트 기본 (5.2GB)
ollama pull qwen3:8b

# 인제스트 고품질 (24GB, ≥48GB RAM 필요)
ollama pull qwen3.6:35b-a3b

# 쿼리 합성 / Contextual Retrieval (17GB)
ollama pull gemma4:26b

# 동작 확인
ollama list
curl -s http://localhost:11434/api/tags | python3 -m json.tool
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
WIKEY_BASIC_MODEL=claude-code # 기본 모델 (claude-code|codex|gemini|ollama)
WIKEY_SEARCH_BACKEND=basic    # basic: qmd 내장 | gemma4: Gemma 4 확장+리랭킹
WIKEY_MODEL=wikey             # Ollama 모델명
WIKEY_QMD_TOP_N=5             # qmd 검색 결과 수
```

상세 설정: `local-llm/wikey.conf` | 프로바이더 비교: `local-llm/model-selection-guide.md`

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

### Phase 1 — 단순 쿼리

```
사용자 질문 → wikey-query.sh → Ollama(wikey/gemma4) → 답변
                  │
                  └─ 컨텍스트: index.md + overview.md
                     또는 --pages로 지정한 페이지
```

- 위키 규모: ~30 페이지
- 컨텍스트 전략: 수동 페이지 선택
- 서빙: Ollama (인터랙티브)
- 모델: Gemma4 26B (17GB) — 쿼리 합성 전용

### Phase 2 — qmd 다층 검색 파이프라인 + 멀티 LLM (현재)

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
Gemma4 26B 합성 (Ollama: 최종 답변)
```

- 위키 규모: ~30 페이지 (100+로 확장 예정)
- 컨텍스트 전략: qmd 하이브리드 검색으로 자동 페이지 선택
- 검색: qmd 2.1.0 (vendored, `tools/qmd/`)
- 합성: Ollama (gemma4:26b 모델)
- 벤치마크: Top-1 40%, Top-3 60% (영어 정확, 한국어 부정확 → Step 3 개선)
- 지연: 평균 11.3초/쿼리 (검색+리랭킹)

### Phase 3 — Obsidian 플러그인

동일한 검색 코어 (qmd + Ollama)를 Obsidian 플러그인 UI에서 호출.
사용자는 사이드바 채팅에서 질문하고, 드래그앤드롭으로 인제스트.

- 인터페이스: Obsidian 사이드바 (채팅 + 인제스트 + 설정)
- 코어: wikey-core TypeScript 모듈 (현재 bash/python의 TS 포팅)
- 인제스트: Qwen3 8B (기본) / Qwen3.6:35b-a3b (고품질, 선택)
- 쿼리: qmd + Gemma4 26B 합성

### Phase 4 — 웹 인터페이스

동일한 wikey-core를 Next.js 웹앱에서 사용.
Obsidian 없이도 브라우저에서 업로드/쿼리/브라우징.

- 인터페이스: 브라우저 (localhost 또는 Docker)
- 코어: wikey-core 재사용

### Phase 5+ — 기업용

- 서빙: vLLM-Metal (상시 데몬, 배치 처리)
- 모델: Gemma 4 27B MoE (더 높은 품질)
- 동시 요청: 팀 서버에서 여러 사용자 지원
- RBAC, 감사 추적, API 게이트웨이

## 모델 선택 가이드

### Phase 3 인제스트·쿼리 모델

| 모델 | 역할 | 파라미터 | 크기 | RAM | 컨텍스트 | 비고 |
|------|------|---------|------|-----|---------|------|
| **`qwen3:8b`** | 인제스트 기본 | 8B | 5.2GB | 16GB+ | 128K | 속도·안정성 최우선 |
| **`qwen3.6:35b-a3b`** | 인제스트 고품질 | 35B (3B active MoE) | 24GB | **≥48GB** | 262K | 속도 2.2배·concepts 1.9배 (vs 8B) |
| **`gemma4:26b`** | 쿼리/CR 전용 | 26B | 17GB | 32GB+ | 128K | 인제스트 제외 (thinking 오버헤드) |

> 이전 `gemma4` (12B, 9.6GB) 및 `qwen3:14b`는 Phase 3에서 제외됨.

## 제약 사항

1. **쓰기 불가 (쿼리 전용)**: Gemma4 26B는 위키 페이지 생성·수정·삭제에 사용 안 함
2. **컨텍스트 활용**: Qwen3.6 네이티브 262K / Gemma4 128K — 실제 품질은 32K 이내가 최적
3. **한국어 품질**: Qwen3 계열은 한국어 JSON 추출 우수, Gemma4는 thinking 경로 필수(인제스트 부적합)
4. **위키링크 형식**: `[[페이지명]]` 인용 — Qwen3/Gemma4 모두 안정
5. **환각 가능**: 위키에 없는 내용을 생성할 수 있음 → 시스템 프롬프트로 완화
6. **메모리 부담 (Qwen3.6)**: 27GB VRAM, M4 Pro 48GB 기준 로드 시 47/48GB — 인제스트 전용 사용 권장

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

- [Ollama — Qwen3](https://ollama.com/library/qwen3)
- [Ollama — Qwen3.6](https://ollama.com/library/qwen3.6)
- [Ollama — Gemma 4](https://ollama.com/library/gemma4)
- [Qwen3.6-35B-A3B — HuggingFace](https://huggingface.co/Qwen/Qwen3.6-35B-A3B)
- [Gemma 4 — Google DeepMind](https://deepmind.google/models/gemma/gemma-4/)
