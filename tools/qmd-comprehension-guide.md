# qmd Comprehension Guide — wikey 프로젝트용

> qmd 2.1.0 소스 완전 분석 가이드. 정의, 아키텍처, 내부 로직, 평가, 커스터마이징 범위를 다룬다.
> 작성일: 2026-04-11 | 소스: tools/qmd/ (GitHub 클론, tobi/qmd@cfd640e)

---

## 1. qmd 패키지의 이해

### 1.1 정의

qmd(Query Markup Documents)는 **로컬 실행 마크다운 하이브리드 검색 엔진**이다. Shopify CEO Tobi Lütke가 개인 지식 관리를 위해 개발했으며, BM25 전문 검색 + 벡터 시맨틱 검색 + LLM 리랭킹을 하나의 파이프라인으로 결합한다. 모든 모델이 로컬에서 실행되며 외부 API를 사용하지 않는다.

**핵심 수치:**
- 소스 코드: TypeScript ~12,900줄 (16개 파일)
- 내장 모델 3개: 총 ~2.2GB
- SQLite 단일 파일 인덱스 (~3.4MB for 29 docs)
- 라이선스: MIT

### 1.2 역할 — wikey에서의 포지션

wikey에서 qmd는 **검색 인프라**로 사용된다. LLM은 **지능 레이어**를 담당한다.

```
┌─────────────────────────────────────────────────────────────┐
│ wikey 쿼리 파이프라인                                         │
│                                                             │
│  사용자 질문                                                  │
│      │                                                      │
│      ▼                                                      │
│  ┌─────────────────────────────────────────┐               │
│  │ 지능 레이어 (선택: basic / gemma4)        │               │
│  │  - 쿼리 확장 (동의어, 한영 변환)           │               │
│  │  - 리랭킹 (관련성 판단)                   │               │
│  │  - 합성 (최종 답변 생성)                  │               │
│  └──────────────┬──────────────────────────┘               │
│                 │ 검색 요청                                   │
│                 ▼                                            │
│  ┌─────────────────────────────────────────┐               │
│  │ 검색 인프라 (qmd — 항상 사용)             │               │
│  │  - BM25 전문 검색 (FTS5)                 │               │
│  │  - 벡터 시맨틱 검색 (sqlite-vec)          │               │
│  │  - RRF 융합                              │               │
│  │  - 문서 청킹 + 인덱싱                     │               │
│  └──────────────┬──────────────────────────┘               │
│                 │                                            │
│                 ▼                                            │
│            wiki/ (마크다운 위키)                               │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 아키텍처

qmd는 4개 계층으로 구성된다:

```
┌──────────────────────────────────────────────────────────────────┐
│                    인터페이스 계층                                  │
│  CLI (qmd.ts)        MCP Server (server.ts)      SDK (index.ts)  │
│  3,356 lines         836 lines                   541 lines       │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                    검색 엔진 계층 (store.ts — 4,673 lines)         │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ BM25     │  │ 벡터검색  │  │ RRF 융합  │  │ 청킹            │ │
│  │ (FTS5)   │  │(sqlite-  │  │          │  │ (스마트 브레이크  │ │
│  │          │  │  vec)    │  │          │  │  포인트 + AST)   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────────────┘ │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                    LLM 계층 (llm.ts — 1,665 lines)                │
│                                                                   │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐ │
│  │ 임베딩          │  │ 쿼리 확장       │  │ 리랭킹             │ │
│  │ EmbeddingGemma │  │ qmd-expansion  │  │ Qwen3-Reranker    │ │
│  │ 300M (328MB)   │  │ 1.7B (1.28GB)  │  │ 0.6B (639MB)      │ │
│  └────────────────┘  └────────────────┘  └────────────────────┘ │
│                                                                   │
│  node-llama-cpp (GGUF 런타임) — Metal GPU 가속                     │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│                    저장 계층                                       │
│  SQLite (better-sqlite3)                                         │
│  ├── content: 문서 본문 (SHA256 content-addressable)               │
│  ├── documents: 컬렉션/경로 → content 매핑                         │
│  ├── documents_fts: FTS5 인덱스 (BM25)                            │
│  ├── content_vectors: 청크 메타데이터                               │
│  ├── vectors_vec: sqlite-vec 벡터 (cosine)                       │
│  ├── store_collections: 컬렉션 설정                                │
│  └── llm_cache: LLM 응답 캐시                                     │
└──────────────────────────────────────────────────────────────────┘
```

### 1.4 구성 모듈 상세

| 파일 | 줄 수 | 역할 | 핵심 함수 |
|------|-------|------|----------|
| **store.ts** | 4,673 | 검색 엔진 코어 | `hybridQuery`, `structuredSearch`, `searchFTS`, `searchVec`, `reciprocalRankFusion`, `chunkDocument`, `rerank`, `expandQuery` |
| **cli/qmd.ts** | 3,356 | CLI 진입점 | `querySearch`, `outputResults`, 16개 서브커맨드 |
| **llm.ts** | 1,665 | LLM 통합 | `LlamaCpp` 클래스, `embed`, `embedBatch`, `expandQuery`, `rerank`, `withLLMSession` |
| **mcp/server.ts** | 836 | MCP 서버 | `query`, `get`, `multi_get`, `status` 도구, HTTP 트랜스포트 |
| **index.ts** | 541 | SDK 공개 API | `createStore`, `QMDStore` 인터페이스 |
| **collections.ts** | 512 | 컬렉션 관리 | YAML 설정 읽기/쓰기, 컨텍스트 관리 |
| **cli/formatter.ts** | 434 | CLI 출력 포맷 | JSON/CSV/MD/XML/files 포맷터 |
| **ast.ts** | 391 | AST 청킹 | tree-sitter 기반 코드 파일 청킹 (TS/JS/Python/Go/Rust) |
| **db.ts** | 96 | DB 추상화 | Bun/Node 호환 SQLite, sqlite-vec 로딩 |
| **maintenance.ts** | 54 | 유지보수 | 캐시 정리, 고아 벡터/문서 삭제, vacuum |

### 1.5 작동 원리 — 전체 쿼리 흐름

```
사용자 입력: "BYOAI란 무엇인가?"
        │
        ▼
[1] 쿼리 파싱 (cli/qmd.ts:parseStructuredQuery)
    - 단일 텍스트 → "expand" 모드로 진입
    - lex:/vec:/hyde: 접두사가 있으면 → "structured" 모드
        │
        ▼
[2] 쿼리 확장 (store.ts:expandQuery → llm.ts:expandQuery)
    - qmd-expansion-1.7B 모델에 GBNF 문법 제약 생성 요청
    - 입력: "/no_think Expand this search query: BYOAI란 무엇인가?"
    - 출력: lex/vec/hyde 타입별 변형 쿼리 3-5개
    - 예: lex: "BYOAI", vec: "bring your own AI concept", hyde: "BYOAI is a principle..."
        │
        ▼
[3] BM25 프로브 (store.ts:searchFTS)
    - 원본 쿼리로 FTS5 검색
    - 강한 시그널(높은 BM25 점수) 감지 시 → 확장 스킵 가능
        │
        ▼
[4] 병렬 검색 (store.ts:hybridQuery 내부)
    ┌─ lex 타입 → searchFTS(query) → BM25 결과
    │  - FTS5 쿼리 변환: "BYOAI" → '"BYOAI"*' (접두사 매치)
    │  - 하이픈 토큰: "multi-agent" → '"multi agent"' (구문 매치)
    │  - 부정: "-term" → NOT 연산
    │  - 점수: |bm25| / (1 + |bm25|) 정규화 → [0, 1)
    │
    └─ vec/hyde 타입 → searchVec(query) → 벡터 결과
       - embedBatch()로 일괄 임베딩
       - sqlite-vec cosine 유사도 검색
       - 파일별 중복 제거 (최고 점수 유지)
        │
        ▼
[5] RRF 융합 (store.ts:reciprocalRankFusion)
    - 모든 결과 리스트를 통합
    - 각 문서의 RRF 점수: Σ weight / (k + rank + 1)  (k=60)
    - 순위 보너스: 1위 +0.05, 2-3위 +0.02
    - 첫 번째 쿼리(원본)에 2배 가중치
    - candidateLimit(기본 40)개로 제한
        │
        ▼
[6] 청크 추출 (store.ts:chunkDocument)
    - 상위 후보 문서에서 쿼리 관련 청크 추출
    - 900 토큰 단위, 15% 오버랩
    - 스마트 브레이크포인트: H1=100점, H2=90, 코드블록=80, 문단=20
    - 거리 감쇠: multiplier = 1 - (normalizedDist²) × decayFactor
        │
        ▼
[7] LLM 리랭킹 (store.ts:rerank → llm.ts:rerank)
    - Qwen3-Reranker-0.6B로 (쿼리, 청크) 쌍의 관련성 스코어링
    - 컨텍스트 4096 토큰, 문서는 토큰 예산 내로 절삭
    - 동일 텍스트 중복 제거 후 배치 처리
    - 캐시 키: (query, chunk_text, model)
        │
        ▼
[8] 블렌딩 (store.ts:hybridQuery 내부)
    - RRF 순위와 리랭크 점수를 가중 결합
    - 순위 1-3: rrfWeight=0.75 (RRF 보호)
    - 순위 4-10: rrfWeight=0.60
    - 순위 11+: rrfWeight=0.40 (리랭커 신뢰)
    - blendedScore = rrfWeight × (1/rrfRank) + (1-rrfWeight) × rerankScore
        │
        ▼
[9] 결과 반환
    - 파일 경로, 제목, 점수, 최적 청크, 컨텍스트
    - 출력 포맷: CLI / JSON / CSV / MD / XML / files
```

---

## 2. 주요 내부 프로세스 및 로직

### 2.1 인덱싱 프로세스

```
qmd collection add wiki/ --name wikey-wiki
        │
        ▼
[A] 파일 스캔 (store.ts:reindexCollection)
    - glob 패턴 매칭 (**/*.md)
    - 각 파일: SHA256 해시 계산
    - content 테이블에 content-addressable 저장
    - documents 테이블에 (collection, path, hash) 매핑
    - 해시 변경 없으면 스킵 (증분 인덱싱)
        │
        ▼
[B] FTS5 인덱스 자동 갱신
    - documents 테이블의 INSERT/UPDATE/DELETE 트리거로 자동 동기화
    - 필드: filepath, title, body
    - 토크나이저: porter (어간 추출) + unicode61
        │
        ▼
[C] 벡터 임베딩 (별도 명령: qmd embed)
    - store.ts:generateEmbeddings
    - 해시별 청크 분할 → 각 청크 임베딩
    - EmbeddingGemma-300M → ~768차원 벡터
    - vectors_vec 테이블에 저장 (sqlite-vec)
```

### 2.2 청킹 알고리즘 상세

```
입력 문서 (예: 2000단어 마크다운)
        │
        ▼
[1] 브레이크포인트 스캔 (store.ts:scanBreakPoints)
    텍스트를 순회하며 모든 잠재적 분할 지점을 수집:
    
    # H1 제목          → score: 100
    ## H2 제목         → score: 90
    ### H3 제목        → score: 80
    ```코드 블록```    → score: 80
    ---               → score: 60
    빈 줄 (문단)       → score: 20
    목록 항목          → score: 5
    일반 줄바꿈        → score: 1
        │
        ▼
[2] 코드 펜스 감지 (store.ts:findCodeFences)
    - ``` 블록의 시작/끝 위치 기록
    - 코드 블록 내부에서는 절대 분할하지 않음
        │
        ▼
[3] 최적 분할점 선택 (store.ts:findBestCutoff)
    
    목표 위치 (target): 900 토큰 지점
    탐색 윈도우: 목표 ± 200 토큰
    
    각 브레이크포인트에 대해:
      distance = |breakpoint - target| / windowSize
      decay = 1 - (distance²) × decayFactor
      adjustedScore = breakpoint.score × decay
    
    코드 펜스 내부 → 스킵
    최고 adjustedScore → 분할점 선택
        │
        ▼
[4] 오버랩 적용
    각 청크: 900 토큰 + 이전 청크 마지막 135 토큰(15%)
    → 청크 간 맥락 유지
        │
        ▼
[5] AST 청킹 (선택, --chunk-strategy auto)
    코드 파일인 경우 tree-sitter로 추가 브레이크포인트:
    - class/struct: 100점
    - function/method: 90점
    - import: 60점
    regex 브레이크포인트와 병합 (같은 위치면 높은 점수 유지)
```

### 2.3 BM25 쿼리 변환 (store.ts:buildFTS5Query)

```
입력                           FTS5 쿼리
─────────────────────────────────────────────────
"BYOAI"                      → "BYOAI"*
multi-agent system            → "multi agent"* "system"*
"exact phrase"                → "exact phrase"
-excluded                     → NOT "excluded"*
DJI O3 Air Unit               → "DJI"* "O3"* "Air"* "Unit"*
```

규칙:
- 따옴표: 구문 검색 (접두사 매치 없음)
- 하이픈 토큰: 구문으로 변환 (porter 토크나이저 호환)
- `-`접두사: NOT 연산
- 일반 단어: `"word"*` (접두사 매치)

### 2.4 RRF 융합 수학

```
입력: N개 결과 리스트 (BM25, vec-1, vec-2, hyde-1, ...)
k = 60 (상수)

각 문서 d에 대해:
  RRF(d) = Σᵢ weightᵢ / (k + rankᵢ(d) + 1)

  여기서:
  - rankᵢ(d) = 리스트 i에서 문서 d의 순위 (0-indexed)
  - weightᵢ = 리스트 i의 가중치 (첫 번째 쿼리: 2×, 나머지: 1×)

보너스:
  if rank == 0: RRF += 0.05
  if rank ∈ {1, 2}: RRF += 0.02
```

**예시:**
```
문서 A: BM25 1위, vec-1 3위
RRF(A) = 2/(60+0+1) + 1/(60+2+1) = 0.0328 + 0.0159 + 0.05 = 0.0987

문서 B: BM25 없음, vec-1 1위, hyde-1 2위
RRF(B) = 1/(60+0+1) + 1/(60+1+1) + 0.05 = 0.0164 + 0.0161 + 0.05 = 0.0825

→ A가 상위 (BM25 매치의 2× 가중치 효과)
```

### 2.5 리랭킹 프로세스 (llm.ts:rerank)

```
입력: 쿼리 + RRF 상위 40개 청크
        │
        ▼
[1] 토큰 예산 계산
    budget = 4096(컨텍스트) - 512(템플릿) - queryTokens
    각 문서를 budget 내로 절삭
        │
        ▼
[2] 중복 제거
    동일한 절삭 텍스트 → 하나만 스코어링
        │
        ▼
[3] 병렬 스코어링
    Qwen3-Reranker-0.6B의 rankAll(query, chunk) API
    ~10개씩 배치, GPU 병렬 실행
    출력: 각 청크의 관련성 스칼라 점수 [0, 1]
        │
        ▼
[4] 캐시 저장
    키: (query + intent, chunk_text, model)
    재실행 시 캐시 히트 → 스코어링 스킵
```

### 2.6 LLM 세션 관리 (llm.ts)

```
┌──────────────────────────────────────────┐
│ LlamaCpp 싱글턴                           │
│                                          │
│  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ Embed    │  │ Generate │  │ Rerank │ │
│  │ Model    │  │ Model    │  │ Model  │ │
│  │ (300MB)  │  │ (1.28GB) │  │(639MB) │ │
│  └────┬─────┘  └────┬─────┘  └───┬────┘ │
│       │              │            │      │
│  ┌────▼─────────────▼────────────▼────┐ │
│  │ 컨텍스트 풀 (GPU 메모리)            │ │
│  │ GPU: 최대 8개, CPU: 최대 4개       │ │
│  │ 비활성 5분 후 컨텍스트 해제         │ │
│  │ 세션 최대 10분                     │ │
│  └────────────────────────────────────┘ │
│                                          │
│  withLLMSession(async (session) => {     │
│    session.embed(...)                    │
│    session.expandQuery(...)              │
│    session.rerank(...)                   │
│  })                                      │
└──────────────────────────────────────────┘
```

핵심 설계 결정:
- **모델은 유지, 컨텍스트만 해제**: 5분 비활성 시 GPU 메모리의 컨텍스트만 해제, 모델 자체는 유지 (재로드 비용 절감)
- **참조 카운팅**: 활성 세션이 있으면 해제 불가
- **중단 시그널**: 세션 최대 10분, AbortSignal로 연쇄 중단

### 2.7 MCP 서버 도구

| 도구 | 입력 | 내부 호출 | 설명 |
|------|------|----------|------|
| `query` | searches[], limit, intent, rerank | `structuredSearch()` | 하이브리드 검색 |
| `get` | file, fromLine, maxLines | `findDocument()` | 단일 문서 조회 |
| `multi_get` | pattern, maxBytes | `findDocuments()` | 배치 문서 조회 |
| `status` | (없음) | `getStatus()` | 인덱스 상태 |

HTTP 엔드포인트 (--http 모드):
- `POST /mcp` — MCP 프로토콜 (JSON-RPC 2.0)
- `POST /query` — REST 검색 API (MCP 래핑 없이)
- `GET /health` — 헬스체크

### 2.8 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `QMD_EMBED_MODEL` | embeddinggemma-300M-Q8_0 | 임베딩 모델 URI |
| `QMD_RERANK_MODEL` | Qwen3-Reranker-0.6B-Q8_0 | 리랭킹 모델 URI |
| `QMD_GENERATE_MODEL` | qmd-query-expansion-1.7B-q4_k_m | 쿼리 확장 모델 URI |
| `QMD_EMBED_CONTEXT_SIZE` | 2048 | 임베딩 컨텍스트 크기 |
| `QMD_EXPAND_CONTEXT_SIZE` | 2048 | 확장 컨텍스트 크기 |
| `QMD_RERANK_CONTEXT_SIZE` | 4096 | 리랭킹 컨텍스트 크기 |
| `QMD_LLAMA_GPU` | auto | GPU 모드 (auto/metal/vulkan/cuda/false) |
| `QMD_EDITOR_URI` | (없음) | 검색 결과 클릭 시 에디터 링크 템플릿 |

### 2.9 파일 시스템 경로

| 경로 | 내용 |
|------|------|
| `~/.cache/qmd/index.sqlite` | 기본 인덱스 DB |
| `~/.cache/qmd/models/` | GGUF 모델 캐시 |
| `~/.cache/qmd/mcp.pid` | HTTP 데몬 PID |
| `~/.config/qmd/index.yml` | 컬렉션 설정 (YAML) |

---

## 3. 평가 및 개선 포인트

### 3.1 강점

| 항목 | 평가 | 상세 |
|------|------|------|
| **아키텍처** | 우수 | 검색/LLM/저장 계층 분리가 깔끔. SDK 인터페이스도 잘 설계됨 |
| **청킹** | 우수 | 스마트 브레이크포인트 + AST 인식은 RAG 시스템 중 최상급 |
| **RRF 융합** | 우수 | 순위 보호 + 가중치 블렌딩이 정교 |
| **캐싱** | 우수 | LLM 응답, 임베딩, 리랭크 점수 모두 캐시 |
| **Content-addressable** | 우수 | SHA256 해시 기반으로 중복 방지, 증분 인덱싱 |
| **MCP 통합** | 양호 | Claude Code와 직접 연동 가능 |
| **로컬 실행** | 양호 | 외부 API 불필요, 오프라인 동작 |

### 3.2 약점 — wikey 관점

| 항목 | 문제 | 영향 | 대응 |
|------|------|------|------|
| **한국어 확장** | 확장 모델(1.7B)이 영어 중심. 한국어 → 영어 변환 품질 낮음 | 한국어 Top-1 정확도 40% | gemma4 backend로 우회 (현재) → Step 3에서 커스터마이징 |
| **한국어 리랭킹** | Qwen3-Reranker가 한국어 교차언어 리랭킹에 약함 | 한국어 쿼리에서 관련 문서 순위 오류 | gemma4 backend에서 Gemma 4 리랭킹 사용 |
| **한국어 BM25** | FTS5 porter 토크나이저가 한국어 형태소 분석 미지원 | "쿠버네티스 배포" → 형태소 분리 안 됨 | Step 3에서 mecab-ko 연동 필요 (커스터마이징 대상) |
| **한국어 임베딩** | EmbeddingGemma-300M의 한국어 벡터 품질 미검증 | 시맨틱 검색 정확도 불확실 | 벤치마크 후 대체 모델 검토 (multilingual-e5 등) |
| **빌드 환경** | Bun 기반 빌드. macOS npm에서 TypeScript 컴파일 에러 | 소스 수정 후 빌드 어려움 | dist/ 포함으로 현재는 무관. 커스터마이징 시 Bun 설치 필요 |
| **쿼리 확장 지연** | 1.7B 모델 로딩 + 생성에 ~10초 | 첫 쿼리 응답 느림 | 캐시 히트 시 <1초. vLLM 배치 처리 고려 |

### 3.3 개선 포인트 도출

#### 즉시 활용 (래퍼 패턴, 소스 수정 불필요)

| # | 포인트 | 방법 | 파일 |
|---|--------|------|------|
| 1 | gemma4 backend 확장 품질 | Gemma 4의 한국어 확장 프롬프트 튜닝 | `wikey-query.sh` |
| 2 | 한영 용어 정규화 | 확장 시 용어 사전 참조 | `local-llm/term-normalization.yaml` (신규) |
| 3 | 컨텍스트 메타데이터 | 컬렉션별 상세 컨텍스트 추가 | `qmd context add` |
| 4 | intent 활용 | 쿼리 시 도메인 힌트 전달 | `--intent` 플래그 |

#### Step 3 커스터마이징 (소스 수정 필요)

| # | 포인트 | 수정 위치 | 난이도 |
|---|--------|----------|--------|
| 5 | **한국어 형태소 분석 BM25** | `store.ts:buildFTS5Query` + FTS5 토크나이저 | 높음 |
| 6 | **한국어 임베딩 모델 교체** | `llm.ts:DEFAULT_EMBED_MODEL_URI` | 중간 |
| 7 | **한국어 리랭킹 모델 교체** | `llm.ts:DEFAULT_RERANK_MODEL_URI` | 중간 |
| 8 | **쿼리 확장 프롬프트 한국어화** | `llm.ts:expandQuery` 프롬프트 | 낮음 |

#### Phase 4+ 확장

| # | 포인트 | 수정 위치 | 난이도 |
|---|--------|----------|--------|
| 9 | 카테고리별 인덱스 분할 | `store.ts:hybridQuery` 컬렉션 라우팅 | 중간 |
| 10 | 위키링크 그래프 검색 | `store.ts` 신규 테이블 + 검색 로직 | 높음 |

### 3.4 프로젝트 통합 현황

```
wikey 프로젝트에서 qmd를 사용하는 접점:

1. MCP 서버 (Claude Code → qmd mcp)
   └─ ~/.claude.json: tools/qmd/bin/qmd mcp
   └─ 쿼리 세션에서 위키 검색에 활용

2. wikey-query.sh (로컬 쿼리 CLI)
   └─ basic backend: qmd query --json
   └─ gemma4 backend: qmd query --json --no-rerank

3. 인덱스 관리
   └─ 컬렉션: wikey-wiki (wiki/ 디렉토리)
   └─ 인덱스: ~/.cache/qmd/index.sqlite
   └─ 컨텍스트: 컬렉션 루트에 한국어+영어 설명

4. upstream 관리
   └─ scripts/update-qmd.sh --check / --apply
   └─ tools/qmd/.git으로 git pull 기반
```

---

## 4. 커스터마이징 가이드

### 4.1 커스터마이징 범위 분류

qmd 소스를 수정할 때 **변경의 성격**에 따라 3개 등급으로 분류한다:

```
┌─────────────────────────────────────────────────────┐
│ 등급 A: 설정 변경 (upstream 충돌 없음)               │
│  - 환경 변수 변경 (QMD_EMBED_MODEL 등)              │
│  - YAML 설정 변경 (~/.config/qmd/index.yml)         │
│  - 래퍼 스크립트 수정 (wikey-query.sh)               │
│  → patch 불필요                                     │
├─────────────────────────────────────────────────────┤
│ 등급 B: 로직 수정 (upstream 충돌 가능성 낮음)         │
│  - 프롬프트 문자열 변경 (llm.ts)                     │
│  - 기본 모델 URI 변경 (llm.ts)                      │
│  - 상수 값 변경 (CHUNK_SIZE 등)                      │
│  → 작은 patch, 충돌 해결 쉬움                        │
├─────────────────────────────────────────────────────┤
│ 등급 C: 구조 변경 (upstream 충돌 가능성 높음)         │
│  - FTS5 토크나이저 교체 (store.ts)                   │
│  - 새 테이블 추가 (store.ts:initializeDatabase)      │
│  - 검색 파이프라인 흐름 변경 (store.ts:hybridQuery)   │
│  → 큰 patch, 충돌 해결 어려움, 신중하게 결정          │
└─────────────────────────────────────────────────────┘
```

### 4.2 예상 커스터마이징 시나리오

#### 시나리오 1: 한국어 형태소 분석 BM25 (등급 C)

**목표**: "쿠버네티스 배포 전략" → "쿠버네티스" "배포" "전략"으로 형태소 분리

**수정 파일**: `src/store.ts`

**변경 포인트**:
```
1. initializeDatabase() — FTS5 테이블 생성
   현재: tokenize = 'porter unicode61'
   변경: 외부 토크나이저 또는 전처리 함수 추가

2. buildFTS5Query() — 쿼리 변환
   현재: 영어 기준 토큰화
   변경: 한국어 입력 감지 → mecab-ko로 형태소 분리 → FTS5 쿼리 구성

3. insertContent() / reindexCollection() — 인덱싱
   현재: 원문 그대로 FTS5에 삽입
   변경: 한국어 형태소 분리 결과를 FTS5에 삽입
```

**충돌 위험**: 높음 — store.ts는 4,673줄이며 가장 활발하게 변경되는 파일

**권장 접근**:
- FTS5 토크나이저를 직접 바꾸지 말고, **전처리 레이어**를 추가
- `preprocessForFTS(text: string): string` 함수를 만들어 인덱싱/쿼리 전에 호출
- upstream의 FTS5 로직은 건드리지 않으므로 충돌 최소화

#### 시나리오 2: 임베딩 모델 교체 (등급 B)

**목표**: EmbeddingGemma-300M → multilingual-e5-large 등

**수정 파일**: `src/llm.ts`

**변경 포인트**:
```
1. DEFAULT_EMBED_MODEL_URI 상수 변경 (1줄)
2. formatQueryForEmbedding() — 모델별 프롬프트 포맷 분기 추가
3. formatDocForEmbedding() — 동일
```

**충돌 위험**: 낮음 — 상수와 포맷 함수만 변경

**대안**: `QMD_EMBED_MODEL` 환경 변수로 모델만 바꾸고, 프롬프트 포맷은 조건 분기 추가

#### 시나리오 3: 쿼리 확장 프롬프트 한국어화 (등급 B)

**목표**: 영어 "Expand this search query" → 한국어 최적화 프롬프트

**수정 파일**: `src/llm.ts`

**변경 포인트**:
```
expandQuery() 내부 프롬프트 (약 5줄):
현재: "/no_think Expand this search query: {query}"
변경: "/no_think 다음 검색 쿼리를 확장하세요. 한국어와 영어 키워드를 모두 생성: {query}"
```

**충돌 위험**: 매우 낮음 — 문자열 상수만 변경

### 4.3 패치 관리 워크플로우

커스터마이징이 시작되면 다음 워크플로우를 따른다:

```
[1] 커스터마이징 작업 전

    # 현재 상태 기록
    cd tools/qmd
    git stash  # 진행 중인 수정 저장
    git log --oneline -1  # 현재 커밋 해시 기록

[2] 수정 작업

    # 소스 수정
    vi src/llm.ts  # 등급 B: 프롬프트 변경 등

[3] 패치 생성

    # 수정사항을 패치 파일로 저장
    cd tools/qmd
    git diff > ../patches/001-korean-expand-prompt.patch
    
    # 또는 커밋 후 format-patch
    git add -A
    git commit -m "wikey: korean query expansion prompt"
    git format-patch -1 --stdout > ../patches/001-korean-expand-prompt.patch

[4] upstream 업데이트 시

    # 패치 백업
    git stash  # 로컬 수정 저장
    
    # upstream 병합
    git pull origin main
    
    # 패치 재적용
    git stash pop  # 또는:
    git apply ../patches/001-korean-expand-prompt.patch
    
    # 충돌 발생 시
    git stash pop  # 충돌 마커 생성
    # 수동 해결 후:
    git add <resolved-files>
    git stash drop

[5] 충돌 해결 기록

    # 충돌 해결 내용을 패치에 반영
    git diff > ../patches/001-korean-expand-prompt.patch  # 재생성
```

### 4.4 패치 디렉토리 구조

```
tools/
├── qmd/                    ← 소스 클론 (upstream + 로컬 수정)
│   ├── src/
│   ├── dist/
│   └── .git/
├── patches/                ← 패치 파일 관리 (신규, git에 포함)
│   ├── README.md           ← 패치 목록 + 적용 순서
│   ├── 001-korean-expand-prompt.patch
│   ├── 002-korean-fts-preprocess.patch
│   └── ...
└── qmd-comprehension-guide.md  ← 이 문서
```

### 4.5 충돌 해결 가이드

| 파일 | 충돌 빈도 | 해결 전략 |
|------|----------|----------|
| `store.ts` | 높음 (핵심 엔진, 활발한 변경) | **전처리 레이어로 분리**. store.ts 직접 수정 최소화. 새 함수를 추가하되 기존 함수 시그니처는 유지 |
| `llm.ts` | 중간 (모델 추가/변경) | **환경 변수 우선**. 프롬프트 변경은 별도 상수 블록으로 분리 |
| `cli/qmd.ts` | 낮음 (CLI 변경은 우리에게 무관) | 수정하지 않음. 래퍼(wikey-query.sh)에서 처리 |
| `mcp/server.ts` | 낮음 | 수정하지 않음 |
| `collections.ts` | 낮음 | 수정하지 않음 |

### 4.6 수용 범위 의사결정 기준

upstream 업데이트가 올 때 **수용/거부/병합** 결정 기준:

```
업데이트 내용이:

[수용] 우리 커스터마이징과 무관한 영역
  → git pull로 바로 적용

[수용] 우리가 커스터마이징한 영역이지만 충돌 없음
  → git pull 후 패치 재적용

[병합] 우리가 커스터마이징한 영역에서 충돌 발생
  → 수동 충돌 해결 → 패치 재생성

[거부] upstream이 우리 커스터마이징을 무효화하는 구조 변경
  → 해당 커밋 건너뛰기 (cherry-pick으로 선택적 적용)
  → 또는 GitHub 포크로 전환 검토

[특별 주의] store.ts의 FTS5 관련 변경
  → 한국어 형태소 분석과 직접 충돌 가능
  → 반드시 수동 검토 후 적용
```

### 4.7 빌드 환경 준비

소스 수정 후 빌드가 필요할 때:

```bash
# Bun 설치 (qmd는 Bun 기반 빌드)
curl -fsSL https://bun.sh/install | bash

# 의존성 설치
cd tools/qmd
bun install

# 빌드
bun run build

# 테스트
bun test --preload ./src/test-preload.ts test/

# dist/ 커밋
git add dist/
git commit -m "wikey: rebuild dist after customization"
```

현재(npm 환경)에서는 TypeScript 컴파일 에러가 발생하므로, 소스 수정 시 Bun 설치가 필수이다.

---

---

## 5. Semantic Chunking 조사 — RAG 검색 품질 개선을 위한 사전 조사

> 이 섹션은 Step 3(한국어 검색 특화) 이전에 수행한 사전 조사이다.
> qmd의 현재 청킹 한계를 파악하고, 커뮤니티의 대안을 분석하여 개선 방향을 도출한다.
> **결론: Step 3에서 정밀한 개선점 도출을 위한 추가 조사 + 프로토타이핑이 필요하다.**

### 5.1 현재 qmd 청킹의 한계

qmd의 청킹은 **구조적 브레이크포인트 + 고정 크기(900토큰)** 방식이다:

```
문제 1: 의미 단위 파편화
  ┌─────── 청크 1 (900 토큰) ──────┐┌─────── 청크 2 (900 토큰) ──────┐
  │ DJI O3 Air Unit의 주파수 대역은  ││ 5.8GHz이며, 채널 대역폭은       │
  │ ...                             ││ ...                             │
  └─────────────────────────────────┘└─────────────────────────────────┘
  → "주파수 대역" 정보가 두 청크에 걸침 → 검색 시 불완전한 청크 반환

문제 2: 무관한 내용 혼합
  ┌─────── 청크 1 (900 토큰) ──────┐
  │ ## 주파수 대역                   │
  │ 5.8GHz, 20/40MHz...            │
  │ ## 무게 및 크기 ← 완전히 다른 주제│
  │ 30.5g, 29×29×13mm...           │
  └─────────────────────────────────┘
  → 하나의 청크에 무관한 두 섹션 포함 → 리랭킹 점수 희석
```

qmd의 스마트 브레이크포인트(H1=100점, H2=90점 등)는 이를 **완화**하지만 **해결**하지 못한다. 900토큰 윈도우 내에서 최적 분할점을 찾을 뿐, **의미 경계**를 판단하지 않는다.

### 5.2 커뮤니티 주요 접근법

#### (1) 임베딩 기반 경계 탐지 (Semantic Chunking)

문장 간 cosine 유사도가 급격히 하락하는 지점에서 분할.

- **구현체**: Chonkie SemanticChunker, LangChain SemanticChunker, LlamaIndex SemanticSplitter
- **장점**: 언어 무관 (다국어 임베딩 모델 사용 시), 의미 전환 포착
- **단점**: NAACL 2025 연구에서 고정 200단어 청크와 동등하거나 열세인 경우 확인됨
- **주요 레포**: [chonkie](https://github.com/chonkie-inc/chonkie) (3,900+ stars, Python, MIT)

#### (2) Contextual Retrieval (Anthropic)

청킹 후 각 청크에 LLM으로 생성한 문서 맥락 프리픽스(50-100토큰) 추가.

- **효과**: Top-20 검색 실패율 49% 감소 (Anthropic 벤치마크)
- **장점**: **어떤 청킹 방식과도 결합 가능** (직교적 개선)
- **단점**: 인덱싱 시 LLM 호출 필요 (비용)
- **참조**: [Anthropic 블로그](https://www.anthropic.com/news/contextual-retrieval)

#### (3) Late Chunking (Jina AI)

전체 문서를 먼저 임베딩한 후 토큰 수준에서 청크 추출. 교차 청크 맥락 보존.

- **구현체**: [jina-ai/late-chunking](https://github.com/jina-ai/late-chunking), Chonkie LateChunker
- **장점**: 대명사/참조 문제 해결
- **단점**: 롱컨텍스트 임베딩 모델 필요
- **논문**: arXiv:2409.04701

#### (4) 구조 인식 청킹 (Structure-Aware)

문서 자체 구조(제목, 섹션, 코드블록)를 분할 경계로 사용.

- **구현체**: Docling HybridChunker, text-splitter MarkdownSplitter, Unstructured by_title
- **장점**: 빠르고 결정적, 저자 의도 보존, 언어 무관
- **한계**: 구조 없는 문서에 무력, 섹션 크기 편차
- **주요 레포**: [docling](https://github.com/docling-project/docling) (42,000+ stars, IBM→LF AI)

#### (5) 신경망 기반 청킹 (Neural Chunking)

파인튜닝된 트랜스포머 모델이 청크 경계를 학습/예측.

- **구현체**: [chonky](https://github.com/mirth/chonky) (초기 단계)
- **장점**: 휴리스틱 없이 순수 학습 기반, 다국어 지원 가능성
- **단점**: 아직 성숙하지 않음

### 5.3 벤치마크 결과 요약 (2025-2026)

| 전략 | FloTorch 2026 | 의료 2025 | 법률 RAG |
|------|---------------|-----------|---------|
| Recursive 512토큰 | **69%** (1위) | — | — |
| Semantic chunking | 54% | — | +36% vs 고정 |
| Adaptive/토픽 경계 | — | **87%** | — |
| 고정 200단어 | 경쟁적 | 13% | 베이스라인 |
| Contextual + 하이브리드 | — | — | Top-20 실패 **-49%** |

**핵심 시사점**: 단일 최적 전략은 없다. 문서 유형에 따라 다르며, Contextual Retrieval은 어떤 전략에든 추가 가능한 직교적 개선이다.

### 5.4 wikey 관점 분석

wikey 위키의 특성:
- **잘 구조화된 마크다운** (프론트매터, H1/H2 제목, 위키링크)
- **한국어 + 영어 혼합**
- **현재 29 페이지, 목표 3,000+**
- **페이지당 평균 ~50줄 (현재 규모에서는 1페이지 = 1청크로도 충분)**

| 접근법 | wikey 적합성 | 이유 |
|--------|------------|------|
| 구조 인식 (현재 qmd) | **높음** | 위키가 이미 잘 구조화됨 |
| Contextual Retrieval | **매우 높음** | 직교적 개선, 로컬 LLM으로 가능 |
| Late Chunking | 높음 (미래) | 교차 참조 많은 위키에 적합, 롱컨텍스트 모델 필요 |
| 임베딩 기반 시맨틱 | 중간 | 구조화 문서에서 구조 기반보다 우월하지 않을 수 있음 |
| LLM/Agentic 기반 | 낮음 | 비용 대비 개선 불확실 |

### 5.5 기획 단계 사전 조사 참조 — idea-comment.md

> wikey 초기 기획 시 수집된 커뮤니티 의견 중 한국어 검색/청킹과 직접 관련된 프로젝트와 인사이트.
> 원시 소스: `raw/3_resources/10_article/901_wikey_design/idea-comment.md`
> 위키 소스: `wiki/sources/source-llm-wiki-community.md`

#### seCall — 한국어 BM25 문제를 직접 다룬 구현체

- **레포**: [github.com/hang-in/seCall](https://github.com/hang-in/seCall)
- **출처**: @kurthong (GeekNews)
- **핵심**: BM25가 한글 검색에 약한 문제를 인식하고 **한국어 가드레일**을 적용
- **구성**: Obsidian 볼트 + GitHub 백업, Codex/Gemini용 파서 내장
- **Step 3 시사점**:
  - seCall의 한국어 가드레일 구현 방식을 분석하여 qmd에 적용 가능한지 검토
  - BM25 한국어 문제의 구체적 해법 (형태소 분석? 용어 정규화? 별도 토크나이저?)을 참고
  - seCall은 BM25(한국어 형태소 분석) + 벡터 검색 → RRF 융합 + 세션 다양성 필터 구조

#### Farzapedia — RAG vs 직접 탐색 비교 실전 사례

- **배경**: 일기/메모/iMessage 2,500건 → 400개 위키 문서
- **핵심 교훈**: "1년 전 RAG 기반으로 유사 시스템 구축했으나 성능이 좋지 않았고, 에이전트가 파일 시스템을 통해 직접 탐색하는 방식이 훨씬 효과적"
- **Step 3 시사점**:
  - 청킹/임베딩 품질이 낮으면 RAG는 직접 탐색보다 열세
  - → 청킹 혁신 없이 단순 RAG 파이프라인만 강화해서는 한계
  - → Contextual Retrieval 등으로 청크 품질 자체를 높여야 함

#### 커뮤니티 합의: 한국어 검색의 알려진 문제

idea-comment.md 미해결 과제 #6:
> **"한국어 검색 한계 — BM25가 한글에 약해 별도 가드레일 필요 (@kurthong)"**

이 문제는 wikey Step 2 벤치마크에서도 확인됨 (한국어 Top-1 정확도 0-1/5).
원인: FTS5 porter 토크나이저의 한국어 형태소 미분리 + 영어 중심 쿼리 확장/리랭킹 모델.

### 5.6 Step 3 사전 조사 필요 항목

> **중요**: 아래 항목들은 Step 3 진행 전에 정밀 조사 + 프로토타이핑이 필요하다.
> 단순히 기존 방식을 교체하는 것이 아니라, wikey 특성에 맞는 혁신적 개선을 위해
> 충분한 사전 조사 후 설계해야 한다.

1. **Chonkie SemanticChunker 프로토타이핑**
   - wikey 위키 29페이지로 Chonkie 실행, qmd 기본 청킹과 청크 품질 비교
   - 한국어 문서에서 cosine 유사도 기반 경계 탐지 효과 측정
   - 다국어 임베딩 모델별 비교 (multilingual-e5-large vs EmbeddingGemma-300M)

2. **Contextual Retrieval 프로토타이핑**
   - 기존 청크에 Gemma 4로 맥락 프리픽스 생성 실험
   - 프리픽스 추가 전/후 검색 정확도 비교 (10건 벤치마크 재활용)
   - 로컬 LLM(Gemma 4)으로 Anthropic 방식 재현 가능성 검증

3. **Late Chunking 가능성 조사**
   - wikey 위키 평균 문서 길이 vs 임베딩 모델 컨텍스트 윈도우
   - jina-embeddings-v3 또는 nomic-embed-text의 롱컨텍스트 성능

4. **한국어 특화 조사**
   - 한국어 문장 분리 라이브러리 (kss, KoNLPy) 성능 비교
   - 한국어 형태소 분석이 BM25 청킹에 미치는 영향 정량화
   - 한영 혼합 문서에서의 최적 청킹 전략

5. **qmd 청킹 확장점 분석**
   - `store.ts:chunkDocument` 함수의 확장 가능한 인터페이스 설계
   - qmd upstream에 플러그인/훅 시스템이 추가될 가능성 (이슈/PR 모니터링)
   - 전처리 레이어 vs 소스 직접 수정 트레이드오프

---

## 부록 A: SQLite 스키마 전체

```sql
-- 문서 본문 (content-addressable)
CREATE TABLE content (
  hash TEXT PRIMARY KEY,
  doc TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- 컬렉션/경로 → 문서 매핑
CREATE TABLE documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection TEXT NOT NULL,
  path TEXT NOT NULL,
  title TEXT,
  hash TEXT REFERENCES content(hash),
  created_at TEXT NOT NULL,
  modified_at TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  UNIQUE(collection, path)
);

-- FTS5 전문 검색 인덱스
CREATE VIRTUAL TABLE documents_fts USING fts5(
  filepath, title, body,
  tokenize = 'porter unicode61',
  content = ''
);

-- 청크 임베딩 메타데이터
CREATE TABLE content_vectors (
  hash TEXT NOT NULL,
  seq INTEGER NOT NULL,
  pos INTEGER NOT NULL,
  model TEXT NOT NULL,
  embedded_at TEXT NOT NULL,
  PRIMARY KEY (hash, seq)
);

-- 벡터 검색 (sqlite-vec)
CREATE VIRTUAL TABLE vectors_vec USING vec0(
  hash_seq TEXT PRIMARY KEY,
  embedding float[N],
  distance_metric=cosine
);

-- 컬렉션 설정
CREATE TABLE store_collections (
  name TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  pattern TEXT DEFAULT '**/*.md',
  ignore_patterns TEXT,  -- JSON array
  include_by_default INTEGER DEFAULT 1,
  update_command TEXT,
  context TEXT  -- JSON: {path_prefix: description}
);

-- LLM 응답 캐시
CREATE TABLE llm_cache (
  hash TEXT PRIMARY KEY,
  result TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

## 부록 B: 핵심 상수

| 상수 | 값 | 파일 | 설명 |
|------|-----|------|------|
| CHUNK_SIZE_TOKENS | 900 | store.ts | 청크 크기 (토큰) |
| CHUNK_OVERLAP_TOKENS | 135 | store.ts | 오버랩 (15%) |
| CHUNK_WINDOW_TOKENS | 200 | store.ts | 브레이크포인트 탐색 윈도우 |
| RRF k | 60 | store.ts | RRF 상수 |
| candidateLimit | 40 | store.ts | 리랭킹 후보 수 |
| RERANK_CONTEXT_SIZE | 4096 | llm.ts | 리랭킹 컨텍스트 (토큰) |
| RERANK_TEMPLATE_OVERHEAD | 512 | llm.ts | 리랭킹 템플릿 오버헤드 |
| EMBED_CONTEXT_SIZE | 2048 | llm.ts | 임베딩 컨텍스트 (토큰) |
| expandContextSize | 2048 | llm.ts | 확장 컨텍스트 (토큰) |
| inactivityTimeout | 300000 | llm.ts | 비활성 타임아웃 (5분, ms) |
| maxDuration | 600000 | llm.ts | 세션 최대 시간 (10분, ms) |

## 부록 C: wikey 프로젝트 통합 파일 참조

| wikey 파일 | qmd 연관 | 설명 |
|-----------|---------|------|
| `tools/qmd/` | 소스 전체 | GitHub 클론 |
| `local-llm/wikey-query.sh` | CLI 래퍼 | basic/gemma4 backend |
| `local-llm/wikey.conf` | 설정 | WIKEY_SEARCH_BACKEND 등 |
| `scripts/update-qmd.sh` | upstream | --check / --apply |
| `~/.claude.json` | MCP | qmd mcp 서버 등록 |
| `~/.cache/qmd/` | 런타임 | 인덱스, 모델 캐시 |
| `wikey.schema.md` | 아키텍처 | 검색 인프라 설명 |
| `CLAUDE.md` | 도구 | qmd MCP 사용법 |
