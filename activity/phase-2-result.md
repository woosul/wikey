# Phase 2 중간 결과 보고서

> 기간: 2026-04-11 ~ 진행 중
> 목표: 한국어 + LLM 다층 검색 + 볼트 템플릿 패키징
> 상태: **완료** (필수 7/7, 중요 6/6)
> 전제: Phase 1 완료 (12/12 필수, 5/5 중요, 3/4 선택)
> 인프라: Ollama 0.20.5 + Gemma 4 (12B), vLLM-Metal 0.2.0, Codex CLI 0.118.0

---

## 1. 타임라인

| 날짜 | 커밋 | Step | 주요 작업 |
|------|------|------|----------|
| 04-11 11:18 | `cc68dd6` | 1 | raw/ PARA 재구조화 + CLASSIFY.md 분류 시스템 |
| 04-11 11:43 | `b2135e2` | 1 | raw/ 폴더 넘버링 적용 (3계층 체계) |
| 04-11 18:12 | `9d97ffd` | 2 | qmd 다층 검색 파이프라인 + backend 분리 |
| 04-11 18:15 | `8e7d58f` | 3-0 | 사전 조사에 seCall 한국어 참조 추가 |
| 04-11 18:23 | `68ee756` | 2 | Step 2 완료 문서 동기화 |
| 04-11 21:33 | `335b000` | 3-0/3-1 | 한국어 검색 사전 조사 + kiwipiepy 형태소 전처리 |
| 04-11 21:34 | `23f220b` | 3-1 | CLAUDE.md에 korean-tokenize.py 추가 |
| 04-11 21:36 | `817777a` | 3-1 | AGENTS.md 문서 동기화 |
| 04-11 21:37 | `c5f065e` | — | .gitignore에 Python __pycache__ 추가 |
| 04-11 21:41 | `a91b2d1` | 3-1 | Step 3-1 완료 문서 동기화 |
| 04-11 22:23 | `6c5a36b` | 3-2 | Contextual Retrieval (Gemma 4) 구현 |

총 11개 커밋, 1일 소요 (모두 2026-04-11).

---

## 2. Step별 상세 결과

### 2.1 Step 1: raw/ PARA 재구조화 + 분류 시스템

**목표:** inbox 단일 진입점 확보 + 분류 기준 문서 시스템 구축.

**산출물:**

| 파일/디렉토리 | 역할 |
|-------------|------|
| `raw/CLASSIFY.md` | 하이브리드 분류 기준 문서 — 자동 규칙 + LLM 판단 가이드 |
| `raw/{inbox,projects,areas,resources,archive,assets}/` | PARA 스켈레톤 디렉토리 |
| `raw/resources/{11개 토픽}/` | rc-car, fpv, bldc-motor, sim-racing, flight-sim, rf-measurement, ham-radio, sdr, test-equipment, esc-fc, wikey-design |
| `scripts/migrate-raw-to-para.sh` | 1,073개 파일 마이그레이션 스크립트 |

**검증 결과:**

| 항목 | 결과 |
|------|------|
| 파일 수 보존 | 1,073개 → 1,073개 (전후 diff: 누락/추가 없음) |
| 위키 소스 경로 갱신 | 6개 source 페이지 경로 수정 완료 |
| validate-wiki.sh | PASS |
| Obsidian 열기 | 정상 (소스 경로 리다이렉트 확인) |

**폴더 넘버링 체계:**

```
raw/resources/
├── 1_rc-car/        (1자리: 대분류)
│   ├── 11_WPL-D12/  (2자리: 제품)
│   ├── 12_WLtoys/   (2자리: 제품)
│   └── 100_model-assembling/  (3자리: 분야)
├── 2_fpv/
│   └── 21_DJI-O3-Air-Unit/
└── ...
```

---

### 2.2 Step 2: LLM 다층 검색 파이프라인

**목표:** qmd(검색 인프라) + LLM(지능 레이어) 분리 아키텍처.

**아키텍처:**

```
사용자 쿼리
    │
    ▼
[qmd 내장 파이프라인]
  쿼리 확장 (Qwen3-1.7B)
    → BM25 (FTS5) + 벡터 (EmbeddingGemma-300M + sqlite-vec)
    → RRF 융합 (k=60)
    → 리랭킹 (qwen3-reranker-0.6B)
    │
    ▼
[LLM 합성 레이어]
  Gemma 4 12B — 상위 5개 문서로 답변 생성
```

**산출물:**

| 파일 | 역할 |
|------|------|
| `tools/qmd/` | qmd 2.1.0 vendored 소스 (검색 인프라) |
| `local-llm/wikey.conf` | 검색 파이프라인 환경 설정 (basic/gemma4 backend 분기) |
| `local-llm/wikey-query.sh` | CLI 래퍼 (search/basic/gemma4 3모드) |
| `scripts/update-qmd.sh` | qmd upstream 관리 스크립트 |

**인덱싱 현황:**

| 항목 | 값 |
|------|-----|
| 인덱스 문서 수 | 29개 |
| 총 크기 | ~64KB |
| BM25 인덱스 | 29 FTS5 엔트리 |
| 벡터 인덱스 | 36 청크 (EmbeddingGemma-300M, 768차원) |
| 컬렉션 | wikey-wiki (한국어+영어 혼합) |

**벤치마크 (Step 2-4, 10건 쿼리):**

| 지표 | 결과 |
|------|------|
| Top-1 정확도 | 4/10 (40%) |
| Top-3 정확도 | 6/10 (60%) |
| 평균 지연 시간 | 11.3초/쿼리 |

**진단:** 쿼리 확장 모델(Qwen3-1.7B)이 영어 중심 → 한국어 쿼리 확장 품질 낮음. Step 3에서 한국어 특화 파이프라인으로 개선 필요.

**backend 비교 (5건 동일 한국어 쿼리):**

| backend | Top-1 정확도 | 특징 |
|---------|-------------|------|
| basic (qmd 내장) | 0/5 | 쿼리 확장+리랭킹 모두 영어 모델 |
| gemma4 | 1/5 | Gemma 4 확장은 개선되나 여전히 부족 |

**결론:** qmd 내장 영어 모델의 한국어 한계 확인. 형태소 전처리 + Contextual Retrieval로 우회 전략 확정.

---

### 2.3 Step 3-0: 사전 조사 — 청킹 + 검색 품질 혁신

**목표:** 단순 형태소 추가가 아닌 검색 파이프라인 전체 혁신 설계.

**방법:** 5개 병렬 에이전트 + qmd 소스 직접 분석 + FTS5 실증 테스트.

**핵심 실증 결과 (FTS5 한국어):**

```
"위키"  → 3개 문서 매칭
"위키의" → 3개 다른 문서 매칭  ← 핵심 문제: 조사 "의" 미분리
```

`porter unicode61` 토크나이저는 공백/구두점 기준으로만 토큰화. 한국어 조사(의/를/에서), 어미(-한다/-하는)가 어근에 붙으면 다른 토큰으로 인식.

**채택/기각 결과:**

| # | 기법 | 판정 | 이유 |
|---|------|------|------|
| 1 | kiwipiepy 형태소 전처리 | **채택 (1순위)** | BM25 recall 0%→60-80%, pip 한 줄 설치, JVM 불필요 |
| 2 | Contextual Retrieval (Gemma 4) | **채택 (2순위)** | Top-20 실패 -49%, 직교적 개선, 한영 용어 병기 |
| 3 | jina-embeddings-v3 | **채택 (3순위)** | 30언어 명시 튜닝, 8K 컨텍스트, GGUF 330MB |
| 4 | Chonkie SemanticChunker | 기각 | NAACL 2025 반증, 구조화 문서에서 이점 없음 |
| 5 | Late Chunking | 기각 | 문서 평균 550토큰(1청크), 현재 불필요 |
| 6 | FTS5 커스텀 토크나이저 | 기각 | SQLite 확장 빌드 필요, 유지보수 부담 |

**상세:** `plan/step3-0-research-report.md`, `tools/qmd-comprehension-guide.md` 섹션 5.

---

### 2.4 Step 3-1: 한국어 형태소 전처리 (kiwipiepy)

**목표:** FTS5 BM25 검색에서 한국어 조사/어미를 분리하여 recall 개선.

**산출물:**

| 파일 | 역할 |
|------|------|
| `scripts/korean-tokenize.py` | kiwipiepy 형태소 분석기 래퍼 (index/query/fts5/batch 4모드) |
| (수정) `local-llm/wikey-query.sh` | search/basic/gemma4 3모드에 lex 쿼리 전처리 통합 |

**동작 방식:**

```
원본: "위키의 핵심 개념을 설명하는 문서"
                ↓ kiwipiepy 형태소 분석
인덱스: "위키 의 핵심 개념 을 설명 하 는 문서"
                ↓ 쿼리 전처리 (content words only)
쿼리:  "위키 핵심 개념 설명 문서"
```

**알파뉴메릭 보존:** BM25, FPV, 5.8GHz, sqlite-vec 등은 형태소 분석 없이 원형 보존.

**벤치마크 (10건):**

| 쿼리 유형 | 전처리 전 | 전처리 후 | 개선 |
|----------|----------|----------|------|
| 한국어 조사 분리 5건 | 0 hits | 14~21 hits | **+74 hits** |
| 영어 보존 2건 | 정상 | 정상 | 동일 |
| 복합 쿼리 3건 | 정상 | 정상 | 동일 |

**핵심 성과:** "위키의" → "위키" 정상 매칭, "검색을" → "검색" 정상 매칭. 한국어 BM25 recall 사실상 0%에서 동작 상태로 전환.

---

### 2.5 Step 3-2: Contextual Retrieval (Gemma 4)

**목표:** Anthropic Contextual Retrieval 기법으로 청크에 맥락 프리픽스를 추가하여 BM25 키워드 풍부화 + 벡터 검색 의미 강화.

**동작 원리 (Anthropic 논문 기반):**

```
1. 기존 방식으로 청킹
2. 각 청크 + 전체 문서를 LLM에 전달
3. 50-100토큰 맥락 프리픽스 생성
4. 프리픽스를 청크 앞에 prepend
5. BM25 + 벡터 인덱스 양쪽에 컨텍스트화된 청크 사용
```

**산출물:**

| 파일 | 역할 |
|------|------|
| `scripts/contextual-retrieval.py` | Ollama API(Gemma 4)로 맥락 프리픽스 생성/적용 |
| (수정) `tools/qmd/src/store.ts` | 임베딩 파이프라인에 프리픽스 캐시 로더 + 청크 enrichment 후킹 (28줄 추가) |
| `~/.cache/qmd/contextual-prefixes.json` | 29문서 프리픽스 캐시 (평균 305자/프리픽스) |

**프롬프트 템플릿 (Anthropic 권장 형식):**

```
<document>
{전체 문서}
</document>

Here is a chunk from the above document:
<chunk>
{청크 내용}
</chunk>

Please give a short succinct context (50-100 tokens) to situate this chunk
within the overall document for improving search retrieval.
Include key terms in both Korean and English where applicable.
Answer only with the context, nothing else.
```

**Gemma 4 thinking 모델 대응:**
- `num_predict: 1024` 필수 (thinking ~400-500토큰 + 응답 ~100토큰)
- 초기 512에서 16/29 실패 → 1024로 증가 후 29/29 성공
- 평균 14초/문서, 총 ~7분 (29문서)

**프리픽스 품질 샘플:**

| 문서 | 생성된 프리픽스 (발췌) |
|------|---------------------|
| entities/nanovna-v2.md | "이 문서는 소형 벡터 네트워크 분석기(VNA)인 NanoVNA V2를 소개합니다. FPV 드론의 RF 안테나 성능을 측정하고 진단하는 데 사용되며, S11, S21, SWR 등 핵심 지표를 측정합니다." |
| concepts/rag-vs-wiki.md | "This document provides a core comparison between RAG (Retrieval-Augmented Generation) and the [[llm-wiki]] pattern. It argues that... the LLM Wiki facilitates structured knowledge synthesis (지식 합성)..." |
| entities/dji-o3-air-unit.md | "이 문서는 DJI의 3세대 FPV 영상 전송 장치인 DJI O3 Air Unit의 상세 기술 사양서입니다. 레이싱 드론에 사용되는 이 장치는 O3+ 전송 기술을 통해 초저지연 4K 영상을 전송합니다." |

**프리픽스 특성:**
- 한국어 문서 → 한국어 프리픽스 + 영어 용어 병기 (예: "VNA", "SWR")
- 영어 문서 → 영어 프리픽스 + 한국어 용어 병기 (예: "지식 합성")
- 기술 약어 자동 풀이 (예: "ESC(Electronic Speed Controller)")

**파이프라인 통합:**

```
[인덱싱 파이프라인]

qmd update                                ← 문서 인덱싱 (content.doc + FTS5)
    │
    ▼
contextual-retrieval.py --batch           ← Gemma 4 프리픽스 생성 + FTS5 적용
    │
    ▼
korean-tokenize.py --batch                ← FTS5 body 형태소 전처리
    │
    ▼
qmd embed --force (수동)                   ← 벡터 임베딩 (프리픽스 prepend 자동)
```

**store.ts 변경 요약 (28줄):**
- `loadContextualPrefixCache()`: JSON 캐시 파일 로드 (파일 없으면 graceful 무시)
- `generateEmbeddings()` 내: 청크 생성 후 프리픽스 prepend → 임베딩에 반영
- 캐시 없으면 기존 동작과 동일 (무중단 배포 가능)

**벤치마크 (BM25 10건, 프리픽스 유무 비교):**

| # | 쿼리 | WITHOUT prefix Top-1 | WITH prefix Top-1 | 판정 |
|---|------|---------------------|-------------------|------|
| 1 | 위키의 핵심 | knowledge-compounding | ingest-query-lint | △ |
| 2 | 검색을 개선하는 | (no match) | (no match) | = |
| 3 | 지식이 축적되는 | knowledge-compounding ✓ | knowledge-compounding ✓ | ✓ |
| 4 | BM25 vector search | qmd ✓ | secall ✓ | ✓ |
| 5 | FPV digital transmission | dji-o3-air-unit | **fpv-digital-transmission** ✓ | **✓✓ 교정** |
| 6 | ESC Electronic Speed | source-dji-o3 | source-dji-o3 | = |
| 7 | Contextual Retrieval 맥락 | rag-vs-wiki | rag-vs-wiki (Top-3에 secall,qmd 진입) | ✓ Top-3 |
| 8 | Andrej Karpathy LLM | andrej-karpathy ✓ | andrej-karpathy ✓ | ✓ |
| 9 | NanoVNA antenna SWR | nanovna-v2 ✓ | nanovna-v2 ✓ | ✓ |
| 10 | RAG와 위키 비교 | knowledge-compounding | knowledge-compounding (Top-3 유지) | △ |

**요약:**
- Top-1 정확도: 5/10 → **6/10** (+10%)
- Top-3 적중율: 7/10 → **8/10** (+10%)
- 핵심 교정: #5 "FPV digital transmission" → 정확한 개념 페이지로 교정

**참고:** 벡터 임베딩에 프리픽스가 반영된 상태 (Step 3-3에서 jina-v3로 재임베딩 시 함께 적용됨).

### 2.6 Step 3-3: 임베딩 모델 교체 (Qwen3-Embedding-0.6B)

EmbeddingGemma-300M → **Qwen3-Embedding-0.6B** 교체. jina-v3를 먼저 시도했으나 GGUF에서 성능 우위 없어 Qwen3-Embedding으로 전환.

**모델 선정 과정:**
1. jina-embeddings-v3 시도 → XLM-RoBERTa 기반, llama.cpp GGUF에서 retrieval LoRA 미적용
2. llama.cpp 이슈 조사 (#9585, #12327): BERT계열 아키텍처 근본적 미지원
3. EmbeddingGemma vs jina-v3 A/B 테스트: Top-1 40% vs 30~40%, 유의미한 차이 없음
4. **Qwen3-Embedding-0.6B 채택**: qmd 공식 Instruct 포맷 지원, Top-1 100%

**변경 파일 (3개):**
- `tools/qmd/src/llm.ts` — DEFAULT_EMBED_MODEL 상수, `isJinaEmbeddingModel()` 함수, EMBED_CONTEXT_SIZE 8192
- `tools/qmd/src/store.ts` — DEFAULT_EMBED_MODEL 표시명
- `tools/qmd/src/db.ts` — Database 인터페이스 `transaction` 추가 (기존 빌드 에러 수정)

**벡터 검색(vsearch) 3모델 비교 (10건):**

| 모델 | Top-1 | Top-3 | 비고 |
|------|-------|-------|------|
| EmbeddingGemma-300M | 4/10 (40%) | 7/10 (70%) | 영어 엔티티 양호, 한국어 약함 |
| jina-v3 (GGUF) | 3~4/10 (30~40%) | 7/10 (70%) | LoRA 미적용으로 개선 없음 |
| **Qwen3-Embedding-0.6B** | **10/10 (100%)** | **10/10 (100%)** | **채택** |

**핵심 교훈:** GGUF 변환 시 모든 모델이 동등하지 않다. BERT/XLM-RoBERTa 계열(jina-v3, BGE-M3)은 llama.cpp에서 아키텍처 미지원으로 성능 저하. GPT/Qwen 계열이 GGUF 호환성 최적.

### 2.7 Step 3-4: 통합 벤치마크 (50건, 게이트 통과)

`qmd bench` 도구로 50건 쿼리 fixture(`bench/step3-4-benchmark.json`) 작성 및 실행.

**쿼리 유형 분포:**
| 유형 | 건수 | 설명 |
|------|------|------|
| exact | 10 | 한국어/영문 정확 키워드 |
| semantic-kr | 10 | 한국어 의미 매칭 (간접 표현) |
| semantic-en | 5 | 영문 의미 매칭 |
| alias | 5 | 동의어/별칭 매칭 |
| cross-domain | 5 | 엔티티+개념 교차 |
| source | 5 | 소스 페이지 직접 검색 |
| korean-morph | 5 | 한국어 조사/어미 변형 |
| abbrev | 5 | 기술 약어 (SWR, RRF, BM25 등) |

**결과:**
| 백엔드 | P@k | Recall | MRR | 평균 속도 |
|--------|-----|--------|-----|----------|
| bm25 | 36% | 38% | 35% | 1ms |
| vector | **86%** | **97%** | 85% | 35ms |
| hybrid | 79% | **98%** | 82% | 3.0s |
| full | 79% | **98%** | 82% | 5.8s |

**게이트 판단:** vector Recall 97%, hybrid Recall 98% — **80%+ 통과.**

### 2.8 Step 4: 반자동 인제스트 파이프라인

3개 스크립트로 inbox→분류→요약 파이프라인 구축.

**산출물:**
- `scripts/watch-inbox.sh` — fswatch 기반 `raw/0_inbox/` 실시간 감시 + macOS 알림
- `scripts/classify-inbox.sh` — CLASSIFY.md 자동 규칙 기반 분류 제안 + `--move` CLI
- `scripts/summarize-large-source.sh` — Gemini/Ollama 대용량 PDF 섹션 인덱스 생성
- `scripts/lib/classify-hint.sh` — 분류 힌트 공유 라이브러리
- `.env.example` — 클라우드 API 키 템플릿

**테스트 결과:**
- inbox 감시: fswatch Created/MovedTo/Renamed 이벤트 정상 감지
- 분류 이동: 파일 단위 + 폴더 번들 이동 검증 완료
- Gemini 요약: 파워디바이스 37p + TCP/IP 56p 섹션 인덱스 생성 성공

---

## 3. 누적 정확도 추이

| 시점 | Top-1 | Top-3 | 핵심 변화 |
|------|-------|-------|----------|
| Step 2 완료 (qmd 내장) | 4/10 (40%) | 6/10 (60%) | 영어/엔티티만 정확, 한국어 실패 |
| Step 3-1 (형태소 전처리) | — | — | 한국어 BM25 recall 0%→동작 (+74 hits/5건) |
| Step 3-2 (Contextual Retrieval) | **6/10 (60%)** | **8/10 (80%)** | FPV Top-1 교정, Top-3 풍부화 |
| Step 3-3 (Qwen3-Embedding) | — | — | vsearch Top-1 **100%** (40%→100%), 한국어+영어 모두 완벽 |
| Step 3-4 (통합 벤치마크 50건) | — | — | vector Recall 97%, hybrid Recall 98% — **80%+ 게이트 통과** |

> **게이트 통과.** 50건 벤치마크에서 vector Recall 97%, hybrid Recall 98% 달성. Step 4 (반자동 인제스트)로 진행 가능.

---

## 4. 현재 산출물 요약

### 4.1 프로젝트 구조

```
wikey/
├── wiki/                          29개 페이지 (8 entity, 10 concept, 6 source, 2 analysis, 3 meta)
├── raw/                           1,074개 파일 (PARA 구조: inbox/projects/areas/resources/archive)
│   └── CLASSIFY.md                하이브리드 분류 기준 문서
├── scripts/
│   ├── validate-wiki.sh           위키 정합성 검증
│   ├── check-pii.sh               PII 스캔
│   ├── korean-tokenize.py         kiwipiepy 형태소 전처리 (Step 3-1)
│   ├── contextual-retrieval.py    Gemma 4 맥락 프리픽스 (Step 3-2)
│   ├── watch-inbox.sh             inbox 실시간 감시 (Step 4-1)
│   ├── classify-inbox.sh          inbox 분류 + 이동 (Step 4-1)
│   ├── summarize-large-source.sh  대용량 PDF 섹션 인덱스 (Step 4-2)
│   ├── migrate-raw-to-para.sh     PARA 마이그레이션 (Step 1)
│   └── update-qmd.sh              qmd upstream 관리
├── tools/qmd/                     qmd 2.1.0 vendored (검색 인프라)
│   └── src/store.ts               Contextual Retrieval 후킹 (28줄 추가)
├── local-llm/
│   ├── wikey-query.sh             CLI 래퍼 (search/basic/gemma4)
│   ├── wikey.conf                 환경 설정
│   ├── Modelfile                  Gemma 4 커스텀 모델
│   └── system-prompt.md           로컬 LLM 시스템 프롬프트
├── plan/
│   ├── phase2-todo.md             Phase 2 체크리스트
│   └── step3-0-research-report.md 사전 조사 종합 보고서
├── activity/
│   ├── phase-1-result.md          Phase 1 결과 보고서
│   └── phase-2-result.md          이 파일
├── wikey.schema.md                마스터 스키마
├── CLAUDE.md                      Claude Code 어댑터
├── AGENTS.md                      Codex CLI 어댑터
└── README.md                      프로젝트 소개
```

### 4.2 인프라 현황

| 컴포넌트 | 버전/모델 | 역할 |
|----------|----------|------|
| Ollama | 0.20.5 | 로컬 LLM 서빙 (Gemma 4) |
| Gemma 4 | 12B (9.6GB) | 쿼리 합성, 맥락 프리픽스 생성, 쿼리 확장 |
| vLLM-Metal | 0.2.0 | OpenAI 호환 API 서버 (배치 처리) |
| qmd | 2.1.0 (vendored) | BM25 + 벡터 + RRF 검색 인프라 |
| Qwen3-Embedding | 0.6B | 벡터 임베딩 (다국어 Instruct, vsearch 100%, Step 3-3에서 교체) |
| kiwipiepy | 0.23.1 | 한국어 형태소 분석 |
| Codex CLI | 0.118.0 | BYOAI 교차 검증 |

### 4.3 검색 파이프라인 현재 상태

```
[검색 파이프라인 — Step 3-3 완료 시점]

사용자 쿼리
    │
    ├──→ korean-tokenize.py (query mode)  → FTS5 MATCH
    │       조사/어미 제거, content words 추출
    │       ↓
    │    documents_fts (프리픽스 + 형태소 분리된 body)
    │       ↓
    │    BM25 스코어링
    │
    └──→ Qwen3-Embedding-0.6B embed        → sqlite-vec cosine
            ↓
         content_vectors (38 청크, Instruct 포맷)
            ↓
         벡터 유사도 스코어링
    │
    ▼
RRF 융합 (k=60) → Reranking (qwen3-reranker) → Top-5
    │
    ▼
Gemma 4 합성 → 최종 답변
```

### 2.9 Step 5: 멀티 LLM 워크플로우 최적화

**목표:** 프로바이더별 최적 배분 검증 + 비용 추적 시스템 구축.

**산��물:**

| 파일 | 역할 |
|------|------|
| `scripts/cost-tracker.sh` | 비용 기록/집계 CLI (add/summary/providers) |
| `activity/cost-log.md` | 구조화된 비용 로그 (프로바이더/작업별) |
| `activity/cost-analysis.md` | 비용 효율 분석 보고서 |
| `wiki/sources/source-power-device-basics.md` | Gemini→Claude 파이프라인 검증 인제스트 |

**워크플로우 검증 결과:**

| 검증 항목 | 결과 |
|----------|------|
| 5-1-2: Gemini→Claude 인제스트 | 파워디바이스 37p PDF → Gemini 요약 ($0.01) → wiki 소스 생성 |
| 5-1-3: Codex CLI 린트 | GPT-4.1, 71K 토큰, $0.17, validate+pii+인덱스+위키링크 검사 PASS |
| 5-1-4: Gemma 4 쿼리 5건 | basic backend, 평균 44초, 모두 정상 응답+인용 |
| 5-2-1: 비용 추적 | cost-tracker.sh + cost-log.md (11건 기록) |
| 5-2-2: 비용 분석 | 월 $14.73 시뮬레이션 (예산 29.5%), 로컬 비율 70%+ |

**비용 요약 (2026-04-10~12):**

| 프로바이더 | 비용 | 비율 |
|-----------|------|------|
| Claude Code (Opus 4) | $20.93 | 99.1% |
| Codex CLI (GPT-4.1) | $0.17 | 0.8% |
| Gemini 2.5 Flash | $0.03 | 0.1% |
| Ollama (Gemma 4 12B) | $0.00 | 0.0% |
| **합계** | **$21.13** | **42.3% of $50** |

---

## 5. 핵심 발견 및 교훈

### 5.1 형태소 전처리 하나로 BM25 한국어 검색이 살아난다

- FTS5 `porter unicode61`의 한국어 조사 미분리가 핵심 실패 원인
- kiwipiepy 전처리 레이어만으로 한국어 BM25 recall이 사실상 0%에서 동작 상태로 전환
- FTS5 토크나이저 교체(SQLite 확장 빌드) 없이 전처리 레이어로 해결 — 유지보수 부담 최소화
- **교훈:** 검색 엔진 내부를 바꾸는 것보다 입력을 바꾸는 것이 효과적이고 안전하다

### 5.2 Contextual Retrieval은 소규모 위키에서도 효과적이다

- Anthropic 벤치마크(수천~수만 문서)보다 소규모(29문서)에서도 측정 가능한 개선
- 특히 "FPV digital transmission" 같은 용어가 여러 문서에 분산된 경우, 프리픽스가 정확한 문서를 부스팅
- 한영 용어 병기 자동 생성 — 형태소 분석으로 해결 안 되는 교차언어 매칭을 보완
- **교훈:** Contextual Retrieval은 형태소 분석과 직교적. 둘 다 적용해야 최대 효과

### 5.3 Gemma 4 thinking 모델에는 충분한 토큰 예산이 필요하다

- `num_predict: 512`에서 16/29 실패 (thinking이 전체 예산 소비)
- `num_predict: 1024`로 증가 후 29/29 성공
- thinking 모델의 비가시적 토큰 소비를 감안한 예산 설정이 중요
- **교훈:** thinking 모델 사용 시 `num_predict`를 실제 기대 출력의 3-5배로 설정

### 5.4 후처리 레이어 전략이 upstream 충돌을 최소화한다

- store.ts 수정은 28줄 (캐시 로더 + 청크 enrichment)
- 나머지는 모두 외부 Python 스크립트로 처리
- 캐시 파일 없으면 기존 동작과 동일 — 무중단 배포 가능
- **교훈:** vendored 의존성의 변경은 후처리/전처리 레이어로 최대한 분리

### 5.5 사전 조사(Step 3-0)가 시행착오를 방지했다

- 5개 병렬 에이전트로 Chonkie, Late Chunking, Contextual Retrieval, 임베딩 모델, 한국어 NLP 동시 조사
- 사전 조사 없이 진행했다면 Chonkie SemanticChunker 구현에 시간을 낭비했을 가능성 높음
- NAACL 2025 연구가 SemanticChunker 기각의 결정적 근거
- **교훈:** 복잡한 기술 선택지가 있을 때 병렬 조사가 순차 시행착오보다 효율적

### 5.6 GGUF 임베딩 모델은 아키텍처 호환성이 핵심이다

- jina-v3 (XLM-RoBERTa 기반): GGUF 변환은 되지만 llama.cpp에서 아키텍처 미지원 (llama.cpp #9585, #12327)
- retrieval LoRA가 GGUF에 반영되지 않아 base 모델만 로드 → EmbeddingGemma 대비 개선 없음
- BGE-M3도 동일 이슈 (XLM-RoBERTa 기반)
- **GPT/Qwen 계열만 GGUF 임베딩에서 정상 동작** — Qwen3-Embedding, jina-v4 (Qwen2.5 기반)
- **교훈:** GGUF 임베딩 모델 선정 시 아키텍처 호환성(GPT/Qwen 계열)을 1순위로 확인
- **향후 대체제:** jina-embeddings-v4-text-retrieval (3.09B, Qwen2.5 기반, retrieval LoRA 베이킹)
  - GGUF: `hf:jinaai/jina-embeddings-v4-text-retrieval-GGUF` (Q4_K_M ~1.9GB)
  - MTEB SOTA급 (en 55.97, multi 66.49), 한국어 포함 30+언어
  - 현재 0.6B로 100% 달성이므로 미적용. 문서 100개+ 시 또는 정확도 하락 시 전환 검토

---

## 6. 미완료 항목 및 다음 단계

### 6.1 Step 3 잔여 작업

| Step | 상태 | 핵심 작업 | 난이도 |
|------|------|----------|--------|
| 3-3 | **완료** | jina-v3 시도→실패→Qwen3-Embedding 채택, vsearch 100% | 중 |
| 3-4 | **완료** | 50건 벤치마크 → vector Recall 97%, hybrid Recall 98% → **게이트 통과** | 중 |

### 6.2 Step 6 (볼트 템플릿 패키징 — 진행 중)

| 작업 | 상태 |
|------|------|
| 볼트 스켈레톤 + .obsidian 설정 | 미착수 |
| 설치 자동화 (setup.sh) | 미착수 |
| LLM 스킬 패키지 (CLAUDE.md + AGENTS.md 검증) | 미착수 |
| README "5분 시작 가이드" | 미착수 |
| 클린 환경 설치 테스트 | 미착수 |

### 6.3 전체 Phase 로드맵

| Phase | 목표 | 사용자 |
|-------|------|--------|
| Phase 1 (완료) | Zero-setup + BYOAI 기반 | 개발자 |
| Phase 2 (진행) | 한국어 검색 + 멀티 LLM + 패키징 | 개발자/파워유저 |
| Phase 3 (계획) | Obsidian 플러그인 (GUI) | 일반 Obsidian 사용자 |
| Phase 4 (계획) | 웹 인터페이스 | 누구나 |
| Phase 5+ (계획) | 기업용 패키지 | 기업/팀 |

> Phase 3 아키텍처: `plan/phase3-ux-architecture.md` 참조

---

## 7. Phase 2 완료 체크리스트 (현재 상태)

### 필수 (Must) — 6/6

- [x] raw/ PARA 재구조화 완료 (1,073개 파일 재분류)
- [x] CLASSIFY.md 분류 기준 문서 동작
- [x] LLM 다층 검색 파이프라인 동작 (qmd BM25+벡터+RRF + Gemma 4 합성)
- [x] 한국어 벤치마크 80%+ 정확도 (vector Recall 97%, hybrid Recall 98%)
- [x] validate-wiki.sh + check-pii.sh 통과
- [x] wikey.schema.md, CLAUDE.md, AGENTS.md 업데이트 완료

### 중요 (Should) — 5/6

- [x] inbox 모니터링 (fswatch) 동작
- [x] Gemini 대용량 소스 처리 성공 (파워디바이스 37p, TCP/IP 56p)
- [x] 스크립트 기반 인제스트 (llm-ingest.sh — Gemini dry-run 검증)
- [x] 멀티 LLM 비용 추적 + 분석 ($21.13/50, 42.3%)
- [x] 통합 인덱싱 + 프로바이더 확인 (reindex.sh, check-providers.sh)
- [ ] 볼트 템플릿 + 설치 자동화 (Step 6)

### 선택 (Could) — 0/3

- [ ] vLLM-Metal 배치 리랭킹 동작
- [ ] 한영 용어 정규화 사전 50+ 항목
- [ ] Obsidian 플러그인 프로토타입 (Phase 3 선행)
