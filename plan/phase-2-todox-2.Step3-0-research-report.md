# Step 3-0 사전 조사 종합 보고서

> **상위 문서**: [`activity/phase-2-result.md`](../activity/phase-2-result.md) · [`plan/phase-2-todo.md`](./phase-2-todo.md) — 본 문서는 §2.Step3-0 (한국어 검색 사전조사 (Step 3 진입 전 정밀 조사)) 보조 자료. 명명규칙: `phase-N-todox-<section>-<topic>.md` / `phase-N-resultx-<section>-<topic>-<date>.md` — `CLAUDE.md §문서 명명규칙·조직화` 참조.


> 작성일: 2026-04-11
> 목적: Step 3 (한국어 검색 특화 + 청킹 혁신) 진행 전 정밀 사전 조사
> 방법: 5개 병렬 조사 에이전트 + qmd 소스 직접 분석 + FTS5 실증 테스트

---

## 0. 현황 진단

### 위키 문서 통계

| 항목 | 값 |
|------|-----|
| 문서 수 | 29개 |
| 총 크기 | 64KB |
| 평균 줄 수 | 52줄 (~550 토큰) |
| 최대 줄 수 | 106줄 (log.md) |
| 청크 수 (qmd 인덱스) | 36개 |
| 1청크에 들어가는 문서 | **대부분** (900토큰 윈도우) |

### FTS5 한국어 실증 테스트

```
porter unicode61 토크나이저의 한국어 처리 결과:

"위키"  → 3개 문서 매칭
"위키의" → 3개 다른 문서 매칭 ← 핵심 문제: 조사 "의" 미분리
"주파수" → 3개 매칭 (공백 기준 분리는 동작)
"검색" AND "파이프라인" → 2개 매칭 (AND 조합 동작)
"BM25" → 3개 매칭 (영어 정상)
"FPV"  → 3개 매칭 (약어 정상)
```

**핵심 실패 원인**: `porter unicode61`은 공백/구두점 기준으로만 토큰화. 한국어 조사(의/를/에서), 어미(-한다/-하는/-했다)가 어근에 붙어 있으면 다른 토큰으로 인식.

---

## 1. 조사 항목별 결과

### 3-0-0: seCall 한국어 BM25 가드레일 분석

**아키텍처**: BM25 (FTS5) + 벡터 (BGE-M3 + HNSW) + RRF (k=60) + 세션 다양성 필터

**한국어 해법**:
- **1차**: kiwi-rs (Kiwi 형태소 분석기 Rust 바인딩)
- **폴백**: lindera ko-dic
- **방식**: 인덱싱 전 형태소 분석 (pre-tokenization) → FTS5에 공백 분리된 텍스트 삽입

**AutoRAG 한국어 BM25 벤치마크** (velog.io/@autorag):
- OKT > Kiwi > KKMA >> Space (공백 기준)
- Kiwi: 속도 대비 품질 최적 균형

**채택 가능**: 전처리 방식 검증됨. qmd는 TypeScript이므로 Python 서브프로세스 활용.
**채택 불가**: kiwi-rs 직접 통합 (Rust vs TypeScript), 세션 다양성 필터 (위키 구조와 무관).

### 3-0-1: Chonkie SemanticChunker

**결론: 채택하지 않음**

이유:
1. **NAACL 2025 연구**: 현실적 문서셋에서 고정 크기 청킹이 의미적 청킹을 일관되게 능가
2. **Context Cliff 효과**: 의미적 청킹이 평균 43토큰 짧은 프래그먼트 생성 → LLM 답변 품질 저하
3. **wikey 구조적 특성**: 프론트매터, H1/H2 헤딩으로 잘 구조화 → qmd의 구조적 breakpoint가 이미 효과적
4. **한국어 문장 분할 리스크**: 기본 delim이 마침표 기반, 한국어 최적화 필요 → 추가 엔지니어링 비용
5. **현재 문서 크기**: 평균 550토큰 → 1청크에 들어감 → 청킹 전략 변경 효과 미미

### 3-0-2: Contextual Retrieval (Anthropic)

**결론: 최우선 채택**

**동작 방식**:
1. 기존 방식으로 청킹
2. 각 청크 + 전체 문서를 LLM에 전달 → 50~100토큰 맥락 프리픽스 생성
3. 프리픽스를 청크 앞에 prepend
4. BM25 + 벡터 인덱스 양쪽에 컨텍스트화된 청크 사용

**성능** (Anthropic 벤치마크):

| 구성 | Top-20 실패율 | 개선 |
|------|-------------|------|
| 기본 (Embed + BM25) | 5.7% | — |
| Contextual Embed + BM25 | 2.9% | **-49%** |
| + Reranking | 1.9% | **-67%** |

**Gemma 4 (12B) 실현성**:
- 요구 작업: 50~100토큰 맥락 요약 — 복잡한 추론 아닌 위치 요약
- 현재: 36청크 × ~3초/호출 = **~2분** (완전 실현 가능)
- 3,000문서: 일괄 ~5시간, 증분 일일 ~1분
- Anthropic도 "quantized 1-3B models도 가능"하다고 언급 → 12B는 과분

**한국어 특수 이점**:
- 프리픽스에 "이 청크는 RC카의 ESC(전자 변속기) 설정에 관한 내용" 같은 키워드 풍부화
- 한영 용어 병기 자동 생성 (예: "ESC(Electronic Speed Controller, 전자 변속기)")
- 형태소 분석기 미도입 상태에서도 BM25 키워드 매칭 개선 효과

**qmd 통합 지점**: `store.ts:generateEmbeddings()` → `chunkDocumentByTokens()` 직후, 임베딩 직전에 후킹

### 3-0-3: Late Chunking + 임베딩 모델

**Late Chunking 결론: 현재 불필요, 미래 재검토**

- 문서당 ~500토큰 → 1청크에 들어감 → 청크 간 맥락 손실 없음
- 논문도 "짧은 단일 목적 문서에는 청킹 안 하는 게 낫다"고 언급
- 3,000+ 문서로 성장하더라도 wikey 설계 철학("작은 페이지, 위키링크 연결")상 개별 문서가 길어지기 어려움

**임베딩 모델 교체 결론: 채택 (3순위)**

| 모델 | 파라미터 | 컨텍스트 | 차원 | 한국어 | 로컬 크기 |
|------|---------|---------|------|--------|----------|
| EmbeddingGemma-300M (현재) | 308M | 2K | 768 | 범용 100+언어 | ~200MB |
| **jina-embeddings-v3** (추천) | 570M | **8K** | 1024 | **30언어 명시 튜닝** | 330MB |
| BGE-M3 (대안) | 560M | 8K | 1024 | 100+언어 | 1.2GB |

jina-embeddings-v3 추천 이유:
- 한국어 포함 30개 언어에 명시적 튜닝 (범용 100+언어보다 정밀)
- GGUF 330MB로 EmbeddingGemma와 비슷한 크기
- Matryoshka로 256/512 차원 축소 가능
- 향후 Late Chunking 도입 시 8K 컨텍스트로 대응 가능

### 3-0-4: 한국어 NLP 도구

**형태소 분석기 결론: kiwipiepy 채택**

| 도구 | macOS ARM64 | 속도 | 검색 정확도 | JVM | 설치 |
|------|-------------|------|-----------|-----|------|
| **kiwipiepy** (추천) | `pip install kiwipiepy` | 빠름 (C++) | 높음 (86.7% 모호성 해소) | 불필요 | 매우 쉬움 |
| mecab-ko | pip 2패키지 | 매우 빠름 | 높음 (AutoRAG 1위) | 불필요 | 쉬움 |
| KoNLPy (Okt) | 지원 | 중간 | 중간 | **필요** | 복잡 |

kiwipiepy 선택 이유:
1. `pip install kiwipiepy` 한 줄 — 사전 내장, 별도 설치 불필요
2. JVM 불필요 — qmd의 Bun/TypeScript 환경과 충돌 없음
3. 능동적 유지보수 (2025.12 v0.22.2)
4. C++ 기반으로 mecab과 유사한 속도

**문장 분리**: kss (`pip install kss`) — 정규식보다 우수, `backend='fast'` 사용

**기대 효과**: 한국어 BM25 recall ~0% → **60-80%**

### 3-0-5: qmd 소스 커스터마이징 범위

**확정된 커스터마이징 3건**:

| # | 변경 | 등급 | 파일 | 충돌 위험 |
|---|------|------|------|----------|
| 1 | 한국어 형태소 전처리 | B+ | store.ts (트리거 수정 + 전처리 함수) | 중간 |
| 2 | Contextual Retrieval | B | store.ts (generateEmbeddings 후킹) | 낮음 |
| 3 | 임베딩 모델 교체 | B | llm.ts (상수 + 포맷 함수) | 낮음 |

**채택하지 않는 것**:

| 변경 | 이유 |
|------|------|
| Chonkie SemanticChunker | 구조화 문서에서 이점 없음, NAACL 2025 반증 |
| Late Chunking | 문서가 1청크에 들어감, 현재 불필요 |
| FTS5 커스텀 토크나이저 | 등급 C, SQLite 확장 빌드 필요, 유지보수 부담 |
| kiwi-rs 직접 통합 | Rust vs TypeScript 호환 불가 |

**통합 아키텍처**:

```
[인덱싱 파이프라인]

원본 문서 (wiki/*.md)
    │
    ▼
chunkDocumentByTokens()          ← 기존 qmd 청킹 (구조적 breakpoint + 900토큰)
    │
    ▼
contextualizeChunk()             ← [신규] Gemma 4로 맥락 프리픽스 생성
    │
    ▼
koreanPreprocess()               ← [신규] kiwipiepy 형태소 분리 (FTS용)
    │
    ├──→ FTS5 body (형태소 분리된 텍스트)    ← BM25 검색용
    │
    └──→ jina-v3 embedding (원본+프리픽스)   ← 벡터 검색용

[검색 파이프라인]

사용자 쿼리
    │
    ├──→ koreanPreprocess(query)  → FTS5 MATCH    ← BM25 (형태소 분리된 쿼리)
    │
    └──→ jina-v3 embed(query)    → sqlite-vec     ← 벡터 유사도
    │
    ▼
RRF 융합 → Reranking → 결과
```

**패치 관리 전략**:
- `tools/patches/` 디렉토리에 패치 파일 관리
- 전처리 레이어를 최대한 분리하여 store.ts 직접 수정 최소화
- kiwipiepy는 Python 서브프로세스로 호출 (TypeScript ↔ Python 브릿지)

---

## 2. Step 3 실행 우선순위 (확정)

| 순위 | 작업 | 기대 효과 | 난이도 | 의존성 |
|------|------|----------|--------|--------|
| **1** | 한국어 형태소 전처리 (kiwipiepy) | BM25 recall 0%→60-80% | 중 | 없음 |
| **2** | Contextual Retrieval (Gemma 4) | Top-20 실패 -49% | 중 | Ollama |
| **3** | 임베딩 모델 교체 (jina-v3) | 벡터 검색 한국어 개선 | 저 | GGUF 다운로드 |

**1순위 이유**: 형태소 전처리 하나만으로도 한국어 BM25 검색이 거의 0%에서 60-80%로 도약. 가장 큰 임팩트를 가장 적은 복잡도로 달성.

**2순위 이유**: 1순위와 직교적. BM25 키워드 풍부화 + 벡터 의미 강화 동시 달성. 특히 한영 용어 병기 자동 생성이 형태소 분석으로 해결 안 되는 문제를 보완.

**3순위 이유**: 현재 EmbeddingGemma-300M도 기본 동작은 하지만, jina-v3의 한국어 명시 튜닝이 벡터 검색 품질을 높임. 상수 변경 수준으로 간단.

---

## 3. phase-2-todo.md Step 3 수정 제안

3-0 조사 결과를 바탕으로 Step 3-1~3-4를 아래와 같이 재구성할 것을 제안:

### Step 3-1: 한국어 형태소 전처리 (kiwipiepy)
- kiwipiepy 설치 + 전처리 스크립트 작성
- qmd FTS5 인덱싱 파이프라인에 전처리 레이어 추가
- 쿼리 파이프라인에도 동일 전처리 적용
- 전/후 BM25 검색 품질 비교 10건

### Step 3-2: Contextual Retrieval (Gemma 4)
- Ollama API를 통한 맥락 프리픽스 생성 프로토타입
- 프리픽스 품질 수동 검증 (5건)
- qmd 인덱싱 파이프라인에 통합
- 전/후 검색 정확도 비교 10건

### Step 3-3: 임베딩 모델 교체 (jina-embeddings-v3)
- GGUF 다운로드 + Ollama 등록
- qmd QMD_EMBED_MODEL 환경변수 또는 llm.ts 상수 변경
- 인덱스 재생성 (qmd embed)
- 전/후 벡터 검색 품질 비교 5건

### Step 3-4: 통합 벤치마크
- 50-100건 쿼리셋 작성
- 전체 파이프라인 벤치마크
- 게이트: 80%+ 정확도 달성 여부

---

## 4. 참조 소스

- seCall: https://github.com/hang-in/seCall
- AutoRAG 한국어 BM25 벤치마크: velog.io/@autorag
- Chonkie: https://github.com/chonkie-inc/chonkie
- NAACL 2025 "Is Semantic Chunking Worth the Computational Cost?": aclanthology.org/2025.findings-naacl.114
- Anthropic Contextual Retrieval: anthropic.com/news/contextual-retrieval
- Late Chunking: arXiv:2409.04701
- jina-embeddings-v3: jina.ai/models/jina-embeddings-v3
- Kiwi: github.com/bab2min/Kiwi, kiwipiepy
- kss: github.com/hyunwoongko/kss
- qmd 소스 분석: tools/qmd-comprehension-guide.md
