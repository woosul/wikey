# Phase 2: Todo List — 한국어 + LLM 다층 검색 + 커뮤니티

> 기간: 2026-04-11 ~ (2–3주 설정 + 3개월 운영)
> 상태: **진행 중**
> 전제: Phase 1 완료 (12/12 필수, 5/5 중요, 3/4 선택)
> 인프라: Ollama 0.20.5 + Gemma 4 (12B), vLLM-Metal 0.2.0, Codex CLI 0.118.0

---

## Step 1: raw/ PARA 재구조화 + 분류 시스템 (Phase 2 기반 작업)

> Step 4 반자동 인제스트의 전제 조건. inbox 단일 진입점 확보 + 분류 기준 문서 시스템 구축.

### 1-1. 분류 기준 문서 생성

- [x] **1-1-1.** `raw/CLASSIFY.md` 생성 — 하이브리드 분류 기준 문서
  - PARA 카테고리 정의 (projects/areas/resources/archive)
  - inbox 처리 모드 (파일 단위 vs 폴더 단위 — 폴더는 번들로 즉시 분류)
  - URI 기반 등록 설계 (기업용, Phase 3-4 구현 — `.meta.yaml` 패턴)
  - 자동 분류 규칙 (확장자/경로 패턴 → 분류 대상)
  - LLM 판단 가이드 (규칙 미매칭 시 판단 순서)
  - resources/ 하위폴더 정의 (11개 토픽: rc-car, fpv, bldc-motor, sim-racing, flight-sim, rf-measurement, ham-radio, sdr, test-equipment, esc-fc, wikey-design)
  - 제품 폴더 네이밍 규칙 (영문 kebab-case, 원본 대소문자 유지 가능)
  - 새 하위폴더 생성 규칙 (LLM 제안 → 사용자 승인 → CLASSIFY.md 등재)
  - 피드백 로그 섹션 (사용자 이의 기록 → 규칙 업데이트 트리거)

### 1-2. 마이그레이션 스크립트 + 실행

- [x] **1-2-1.** `scripts/migrate-raw-to-para.sh` 작성
  - PARA 스켈레톤 디렉토리 생성 (inbox, projects, areas, resources, archive)
  - resources/ 하위 토픽 디렉토리 생성 (11개)
  - 파일 매핑 규칙:
    - `raw/articles/*.md` (3개) → `raw/resources/wikey-design/`
    - `raw/notes/wikey-design-decisions.md` → `raw/projects/wikey/`
    - `raw/notes/nanovna-v2-notes.md` → `raw/areas/rf-measurement/`
    - `raw/manual/00.게임기기/100 Car/{각 제품폴더}` → `raw/resources/rc-car/{kebab-name}/`
    - `raw/manual/00.게임기기/200 Model Assembling` → `raw/resources/rc-car/model-assembling/`
    - `raw/manual/00.게임기기/810 RF Receiver` → `raw/resources/rc-car/rf-receiver/`
    - `raw/manual/00.게임기기/830 FPV/{각 제품폴더}` → `raw/resources/fpv/{name}/`
    - `raw/manual/00.게임기기/860 BLDC Motor` → `raw/resources/bldc-motor/`
    - `raw/manual/00.게임기기/862 ESC_FC` → `raw/resources/esc-fc/`
    - `raw/manual/00.게임기기/910 Sim Racing/*` → `raw/resources/sim-racing/`
    - `raw/manual/00.게임기기/913 AirSim/*` → `raw/resources/flight-sim/`
    - `raw/manual/00.게임기기/915 DriveHub/*` → `raw/resources/sim-racing/`
    - `raw/manual/02.무선통신/NanoVNA V2` → `raw/resources/rf-measurement/NanoVNA-V2/`
    - `raw/manual/02.무선통신/CW Pokemon` → `raw/resources/ham-radio/CW-Pokemon/`
    - `raw/manual/02.무선통신/MALAHIT-DSP SDR` → `raw/resources/sdr/MALAHIT-DSP/`
  - 빈 폴더 스킵 (300 Drone), 빈 구 디렉토리 삭제 (articles/, manual/, notes/, papers/)
- [x] **1-2-2.** 마이그레이션 전 파일 매니페스트 생성
  ```bash
  find raw/ -type f > /tmp/wikey-raw-manifest-before.txt
  ```
- [x] **1-2-3.** 스크립트 실행
- [x] **1-2-4.** 마이그레이션 후 검증
  ```bash
  find raw/ -type f | wc -l   # 1,073 확인
  # 파일명 기준 전후 diff로 누락/추가 없음 확인
  ```

### 1-3. 위키 소스 경로 갱신

- [x] **1-3-1.** `wiki/sources/source-llm-wiki-gist.md` — `raw/articles/llm-wiki.md` → `raw/resources/wikey-design/llm-wiki.md`
- [x] **1-3-2.** `wiki/sources/source-llm-wiki-community.md` — `raw/articles/idea-comment.md` → `raw/resources/wikey-design/idea-comment.md`
- [x] **1-3-3.** `wiki/sources/source-append-and-review.md` — `raw/articles/append-and-review-note.md` → `raw/resources/wikey-design/append-and-review-note.md`
- [x] **1-3-4.** `wiki/sources/source-wikey-design-decisions.md` — `raw/notes/wikey-design-decisions.md` → `raw/projects/wikey/wikey-design-decisions.md`
- [x] **1-3-5.** `wiki/sources/source-dji-o3-air-unit.md` — `raw/manual/00.게임기기/830 FPV/DJI O3 Air Unit/...` → `raw/resources/fpv/DJI-O3-Air-Unit/...`
- [x] **1-3-6.** `wiki/sources/source-nanovna-v2-notes.md` — `raw/notes/nanovna-v2-notes.md` → `raw/areas/rf-measurement/nanovna-v2-notes.md`

### 1-4. 위키 페이지 및 로그 업데이트

- [x] **1-4-1.** `wiki/entities/obsidian.md` — Web Clipper 경로 `raw/articles/` → `raw/inbox/`
- [x] **1-4-2.** `wiki/concepts/append-and-review.md` — `raw/notes/` → `raw/inbox/`
- [x] **1-4-3.** `wiki/log.md`에 마이그레이션 항목 추가 (append-only, 기존 항목 미수정)
  ```
  ## [2026-04-11] restructure | raw/ PARA 마이그레이션
  ```

### 1-5. 스키마 및 설정 문서 업데이트

- [x] **1-5-1.** `wikey.schema.md` 업데이트 (사용자 승인 필요)
  - 디렉토리 구조도 (line 111-115): flat → PARA 구조
  - Obsidian Web Clipper (line 72): `raw/articles/` → `raw/inbox/`
  - 소스 유형 매핑 테이블 (line 418-426): 모든 소스 → `raw/inbox/` 진입
  - 인제스트 지시 예시 (line 430-433): inbox 기반으로 변경
  - 원시 소스 관리 섹션 (line 404-478): PARA 워크플로우 + CLASSIFY.md 참조 + 분류 세션 추가
  - LLM 쓰기 권한 (line 410): inbox→PARA 이동 허용 (내용 수정 금지 유지)
- [x] **1-5-2.** `CLAUDE.md` 업데이트
  - raw/ 권한: "읽기만" → "내용 수정 금지, inbox→분류 이동은 허용 (사용자 승인 후)"
  - 분류 세션 체크리스트 추가
- [x] **1-5-3.** `AGENTS.md` 동일 업데이트
- [x] **1-5-4.** `README.md` 업데이트
  - `mkdir -p raw/{articles,papers,notes,assets}` → `mkdir -p raw/{inbox,projects,areas,resources,archive,assets}`
  - 첫 인제스트 안내: `raw/articles/` → `raw/inbox/`
- [x] **1-5-5.** `.obsidian/app.json` — `attachmentFolderPath: "raw/assets"` 설정
- [x] **1-5-6.** Obsidian Web Clipper 저장 위치 변경 안내 (사용자가 브라우저에서 수동: → `raw/inbox`)

### 1-6. 검증 + 커밋

- [x] **1-6-1.** `./scripts/validate-wiki.sh` → PASS
- [x] **1-6-2.** `./scripts/check-pii.sh` → PASS
- [x] **1-6-3.** wiki/sources/ 6개 파일의 `원시 소스:` 경로가 실제 파일과 일치하는지 확인
- [x] **1-6-4.** Git 커밋 (wiki/ + 스키마 + 스크립트 + 설정 변경)

---

## Step 2: LLM 다층 검색 파이프라인 구축

> qmd(검색 인프라) + LLM(지능 레이어) 분리 아키텍처로 다층 검색 파이프라인 구축.
> qmd = BM25 + 벡터 + RRF 융합 (검색 인프라, 항상 사용).
> LLM = 쿼리 확장 + 리랭킹 + 합성 (지능 레이어, backend 설정으로 선택).
> **변경**: qmd 2.1.0 소스를 `tools/qmd/`에 vendored. backend 설정으로 basic(qmd 내장)/gemma4 선택 가능.

### 2-1. qmd 설치 + 위키 인덱싱

- [x] **2-1-1.** qmd MCP 서버 설치 및 Claude Code 연동 확인
  - `@tobilu/qmd@2.1.0` 소스를 `tools/qmd/`에 복사 (vendored)
  - `~/.claude.json`에 글로벌 MCP 등록 (로컬 경로)
- [x] **2-1-2.** `wiki/` 디렉토리를 qmd에 인덱싱
  - BM25 인덱스: 29 문서 인덱싱 완료
  - 벡터 인덱스: EmbeddingGemma-300M으로 36 청크 임베딩
  - 컨텍스트 메타데이터 추가 (한국어+영어 혼합 컬렉션 설명)
- [x] **2-1-3.** 기본 검색 테스트 5건 (qmd 단독)
  - 5/5 PASS: 단순 키워드, 한국어, 영어, 한영 혼합, 엔티티명 모두 Top-1 정확

### 2-2/2-3. 검색 파이프라인 구현 + backend 분리

> **아키텍처 결정 (2026-04-11)**:
> - qmd = **검색 인프라** (BM25 인덱스 + 벡터 인덱스 + RRF 융합). 항상 사용.
> - LLM = **지능 레이어** (쿼리 확장 + 리랭킹 + 합성). backend 설정으로 선택.
> - qmd 내장 모델(1.7B 확장 + 0.6B 리랭커)은 영어 중심 → 한국어 성능 낮음 (Top-1 40%).
> - Gemma 4(12B)가 한국어 이해력 우수 → gemma4 backend에서 지능 부분 담당.

- [x] **2-2/2-3.** `wikey-query.sh`를 qmd 연동으로 개선
  - qmd 소스를 `tools/qmd/`에 vendored (글로벌 설치 제거)
  - `--search` 모드 추가 (qmd 검색 결과만 출력, 합성 없이)
  - `--pages` 수동 오버라이드 유지

### 2-4. 통합 파이프라인 테스트

- [x] **2-4-1.** 전체 흐름 연결: 쿼리 → qmd(확장→검색→리랭킹) → Gemma 4 합성
  ```
  사용자 질문 → qmd(확장 1.7B → BM25+벡터 → RRF → Reranker 0.6B) → 상위 5개 → Gemma 4 합성
  ```
- [x] **2-4-2.** 10건 쿼리 벤치마크
  - Top-1 정확도: 4/10 (40%) — 영어/엔티티 정확, 한국어 부정확
  - Top-3 정확도: 6/10 (60%)
  - **진단**: 쿼리 확장 모델(1.7B) 영어 중심 → 한국어 쿼리 확장 품질 낮음
  - **대응**: Step 3 한국어 특화에서 개선 (형태소 분석, 용어 정규화)
- [x] **2-4-3.** 지연 시간 측정
  - 평균 11.3초/쿼리 (검색+리랭킹, 합성 제외)
  - 1위 캐시 히트 시 0.8초, 신규 확장 시 9-19초
  - **대응**: `--no-rerank` 옵션으로 빠른 모드, vLLM 배치 처리 고려

### 2-5. qmd upstream 관리 + backend 설정

- [x] **2-5-1.** `scripts/update-qmd.sh` 작성 — qmd upstream 관리
  - `--check`: git fetch + 커밋 수 비교
  - `--apply`: git pull + 의존성 재설치 + 동작 검증
  - 주기: 수동 (월 1회 권장)
  - **변경**: npm pack → git pull 방식 (소스 클론으로 전환)
- [x] **2-5-2.** `local-llm/wikey.conf` 작성 — 검색 파이프라인 환경 설정
  ```
  WIKEY_SEARCH_BACKEND=basic    # basic | gemma4
  WIKEY_MODEL=wikey             # Ollama 모델명
  WIKEY_QMD_TOP_N=5             # qmd 검색 결과 수
  ```
- [x] **2-5-3.** `wikey-query.sh` backend 분기 구현
  - `basic`: qmd 내장 파이프라인(확장+검색+리랭킹) → Gemma 4 합성
  - `gemma4`: Gemma 4 확장 → qmd 검색만(`--no-rerank`) → Gemma 4 리랭킹+합성
- [x] **2-5-4.** backend 비교 테스트 5건 (basic vs gemma4, 동일 한국어 쿼리)
  - basic: 0/5, gemma4: 1/5 — 두 backend 모두 한국어 정확도 매우 낮음
  - **진단**: qmd 내장 모델(영어 중심) + 청킹 전략 한계
  - **대응**: Step 3에서 청킹 혁신 + 한국어 특화 필수 (3-0 사전 조사 선행)

---

## Step 3: 한국어 검색 특화 + 청킹 혁신

> Step 3 진행 전 **정밀 사전 조사**가 필요하다. 단순 한국어 형태소 분석 추가가 아니라,
> 청킹 전략 자체의 혁신적 개선을 위해 커뮤니티 조사 + 프로토타이핑 선행 후 설계한다.
> 사전 조사 결과: `tools/qmd-comprehension-guide.md` 섹션 5 참조.

### 3-0. 사전 조사 — 청킹 + 검색 품질 혁신 (Step 3 선행 필수)

> qmd의 현재 청킹(구조적 브레이크포인트 + 900토큰 고정 크기)은 의미 단위 파편화 문제가 있다.
> 단순히 형태소 분석만 추가하는 것이 아니라, 검색 파이프라인 전체의 품질 개선을 설계해야 한다.

- [x] **3-0-0.** 기획 단계 사전 조사 참조 분석
  - seCall: kiwi-rs 형태소 분석 + FTS5 pre-tokenization 방식 검증. AutoRAG: OKT > Kiwi > KKMA
  - Farzapedia: 청킹 품질 낮으면 RAG < 직접 탐색 → Contextual Retrieval로 청크 품질 향상 필요
  - 커뮤니티 합의: FTS5 porter unicode61의 한국어 조사 미분리가 핵심 원인 (실증 확인)
- [x] **3-0-1.** Chonkie SemanticChunker 조사 → **기각**
  - NAACL 2025: 구조화 문서에서 고정 크기 ≥ 의미적 청킹 (Context Cliff 효과)
  - wikey 문서 평균 550토큰(1청크) → 청킹 전략 변경 효과 미미
  - qmd 구조적 breakpoint가 잘 구조화된 마크다운에 이미 효과적
- [x] **3-0-2.** Contextual Retrieval 조사 → **최우선 채택**
  - Top-20 실패율 -49% (Anthropic), Gemma 4 12B로 충분 (36청크 ~2분)
  - 직교적 개선: 어떤 청킹과도 결합 가능, 한국어 키워드 풍부화 효과
  - 통합 지점: store.ts generateEmbeddings() → chunkDocumentByTokens() 직후
- [x] **3-0-3.** Late Chunking 조사 → **현재 불필요**, 임베딩 모델 교체 우선
  - 문서 평균 550토큰(1청크) → 청크 간 맥락 손실 없음
  - 대신 jina-embeddings-v3 채택 (30언어 명시 튜닝, 8K 컨텍스트, GGUF 330MB)
- [x] **3-0-4.** 한국어 특화 조사
  - kiwipiepy 채택 (`pip install kiwipiepy`, JVM 불필요, 86.7% 모호성 해소)
  - 전처리기 방식: 인덱싱/쿼리 전에 형태소 분리 → 기존 FTS5 토크나이저 유지
  - 기대 효과: 한국어 BM25 recall ~0% → 60-80%
- [x] **3-0-5.** qmd 소스 커스터마이징 범위 결정
  - 확정 3건: 형태소 전처리(B+), Contextual Retrieval(B), 임베딩 교체(B)
  - 기각: Chonkie, Late Chunking, FTS5 커스텀 토크나이저(C)
  - 전략: 전처리 레이어 최대 분리 → store.ts 직접 수정 최소화
  - 상세: `plan/step3-0-research-report.md`, `tools/qmd-comprehension-guide.md` 섹션 5.6

### 3-1. 한국어 형태소 전처리 (kiwipiepy)

> 3-0 조사 결과: kiwipiepy 채택 (mecab-ko 대비 설치 간편, JVM 불필요, 정확도 유사)
> 접근법: 전처리 레이어 (FTS5 토크나이저 교체 없이, 인덱싱/쿼리 전 텍스트 변환)

- [x] **3-1-1.** kiwipiepy 설치 + 전처리 스크립트 작성
  - `pip install kiwipiepy` (v0.23.1)
  - `scripts/korean-tokenize.py` — index/query/fts5/batch 4개 모드
  - 알파뉴메릭 토큰 보존 (BM25, FPV, 5.8GHz 등 분리 방지)
- [x] **3-1-2.** qmd FTS5 인덱싱 파이프라인에 전처리 레이어 추가
  - 배치 후처리 방식: `korean-tokenize.py --batch` → FTS5 body를 형태소 분리 텍스트로 교체
  - content.doc 원본 보존, FTS5 body만 전처리 (DELETE+INSERT)
  - SQLite WAL 주의: 복원 시 VACUUM INTO 사용 필수
- [x] **3-1-3.** 쿼리 파이프라인에도 동일 전처리 적용
  - `wikey-query.sh` search/basic/gemma4 3개 모드에 lex 쿼리 전처리 통합
  - preprocess_korean_query() → content words만 추출 (조사/어미 제거)
- [x] **3-1-4.** 전/후 BM25 검색 품질 비교 10건
  - 조사 분리 5건: +74 hits (0→14~21), "위키의"→"위키", "검색을"→"검색" 등
  - 영어 보존 2건: BM25(6→6), FPV(7→7) 동일
  - 복합 쿼리 3건: 주파수+대역(2→2), 지식+축적(8→8), 인제스트+린트(12→12) 동일

### 3-2. Contextual Retrieval (Gemma 4)

> 3-0 조사 결과: 최우선 채택 (직교적 개선, Top-20 실패 -49%)
> Gemma 4 12B로 50-100토큰 맥락 프리픽스 생성, 36청크 ~2분

- [x] **3-2-1.** Ollama API를 통한 맥락 프리픽스 생성 프로토타입
  - `scripts/contextual-retrieval.py` 작성 (--generate/--apply-fts/--batch/--verify 모드)
  - Anthropic 권장 프롬프트 템플릿: `<document>` + `<chunk>` → 맥락 설명
  - Gemma 4 thinking 모델 대응: `num_predict: 1024` (thinking ~500 + response ~100)
  - 29/29 문서 프리픽스 생성 성공 (~7분, 평균 14초/문서)
  - 캐시: `~/.cache/qmd/contextual-prefixes.json`
- [x] **3-2-2.** 프리픽스 품질 수동 검증 (10건)
  - 한국어 문서 (memex, fpv): 한국어 프리픽스 + 영어 용어 병기 ✓
  - 영어 문서 (rag-vs-wiki, karpathy): 영어 프리픽스 + 한국어 병기 ✓
  - 한영 혼합 (dji-o3, nanovna): 양방향 용어 병기 ✓
  - 키워드 풍부화: ESC, FPV, BM25, BYOAI 등 약어 자동 포함 ✓
- [x] **3-2-3.** qmd 인덱싱 파이프라인에 통합
  - **FTS5**: `--apply-fts`가 content.doc 원본에 프리픽스 prepend → FTS5 재구성
  - **임베딩**: `store.ts:generateEmbeddings()` → `chunkDocumentByTokens()` 직후
    `loadContextualPrefixCache()`로 프리픽스 읽어 chunk.text에 prepend
  - **파이프라인 순서**: contextual-retrieval.py --batch → korean-tokenize.py --batch
  - CLAUDE.md, AGENTS.md 인제스트 체크리스트에 스텝 추가
  - `tsc` 빌드 검증: 새 에러 없음, dist 업데이트 완료
- [x] **3-2-4.** 전/후 BM25 검색 정확도 비교 10건
  - Top-1: WITHOUT prefix 5/10 → WITH prefix 6/10 (+10%)
  - Top-3: WITHOUT prefix 7/10 → WITH prefix 8/10 (+10%)
  - 핵심 개선: "FPV digital transmission" Top-1이 dji-o3 → fpv-digital-transmission으로 교정
  - 핵심 개선: "Contextual Retrieval 맥락" Top-3에 secall, qmd 진입
  - 참고: 벡터 임베딩 재생성은 `qmd embed --force` 실행 필요 (bun 필요)

### 3-3. 임베딩 모델 교체 (jina-embeddings-v3)

> 3-0 조사 결과: jina-v3 채택 (30언어 명시 튜닝, 8K 컨텍스트, GGUF 330MB)
> Late Chunking은 현재 불필요 (문서 평균 550토큰)

- [ ] **3-3-1.** jina-embeddings-v3 GGUF 다운로드
  - Ollama 등록 또는 node-llama-cpp 직접 로드
- [ ] **3-3-2.** qmd 임베딩 모델 설정 변경
  - `QMD_EMBED_MODEL` 환경변수 또는 `llm.ts` DEFAULT_EMBED_MODEL 상수
  - `formatQueryForEmbedding()`, `formatDocForEmbedding()` 모델별 분기 추가
- [ ] **3-3-3.** 인덱스 재생성 (`qmd embed`)
  - 768차원 → 1024차원 전환, sqlite-vec 호환 확인
- [ ] **3-3-4.** 전/후 벡터 검색 품질 비교 5건

### 3-4. 통합 벤치마크

- [ ] **3-4-1.** 벤치마크 쿼리셋 50-100개 작성
  - 한글 단순 쿼리, 영문 단순 쿼리, 한영 혼합, 기술 약어, 엔티티 조회, 교차 문서 합성
- [ ] **3-4-2.** 벤치마크 실행 및 정확도 측정
  - 3-1 (형태소) + 3-2 (Contextual) + 3-3 (jina-v3) 통합 상태에서 테스트
- [ ] **3-4-3.** **게이트**: 80%+ 정확도 달성 여부 판단
  - 미달 시: 형태소 분석 튜닝, 용어 정규화 사전 추가, 프리픽스 프롬프트 개선

---

## Step 4: 반자동 인제스트 파이프라인

> Step 0의 inbox 단일 진입점 위에 구축

### 4-1. inbox 모니터링

- [ ] **4-1-1.** `scripts/watch-inbox.sh` 작성
  - fswatch로 `raw/inbox/` 감시
  - 새 파일/폴더 감지 시 알림 (macOS Notification 또는 터미널 출력)
- [ ] **4-1-2.** 알림 → 분류 → 인제스트 흐름 연결
  - 파일 감지 → CLASSIFY.md 기반 분류 제안 → 사용자 승인 → 이동 → 인제스트 트리거
- [ ] **4-1-3.** 폴더 단위 감지 테스트
  - `inbox/`에 제품 매뉴얼 폴더 추가 → 번들 분류 → resources/ 이동 → 인제스트

### 4-2. 대용량 소스 처리

- [ ] **4-2-1.** Gemini API 연동 (1M+ 컨텍스트 활용)
  - 100p+ PDF → Gemini 1차 요약 → 요약본을 Claude Code에 전달하여 위키 통합
- [ ] **4-2-2.** 대용량 처리 테스트 1건 (100p+ PDF)
- [ ] **4-2-3.** 미승인 소스 대기 목록 관리 방안 정의
  - inbox에 체류 중인 미분류 파일 목록 출력 스크립트

---

## Step 5: 멀티 LLM 워크플로우 최적화

### 5-1. 프로바이더별 최적 배분 검증

- [ ] **5-1-1.** 일상 인제스트 — Claude Code 5건 인제스트, 토큰 비용 기록
- [ ] **5-1-2.** 대용량 소스 — Gemini 1차 요약 + Claude Code 통합 1건
- [ ] **5-1-3.** 독립 린트 — Codex CLI로 교차 검증 1회
- [ ] **5-1-4.** 오프라인 쿼리 — Gemma 4 로컬 쿼리 5건

### 5-2. 비용 모니터링

- [ ] **5-2-1.** 프로바이더별 토큰 사용량 + 비용 기록 시작
  - 월간 목표: $50 이하 (개인)
- [ ] **5-2-2.** 비용 효율 분석 (로컬 vs 클라우드 비율 최적화)

---

## Step 6: 커뮤니티 공개

### 6-1. 배포 준비

- [ ] **6-1-1.** GitHub 공개 저장소 전환 (private → public)
  - raw/ .gitignore 확인 (PII 보호)
  - 민감 정보 커밋 이력 검사
- [ ] **6-1-2.** README.md 최종화 (한국어 + 영어)
  - "5분 안에 LLM Wiki 시작하기" 가이드
  - BYOAI 프로바이더 비교표
  - 스크린샷 (Obsidian Graph View, 인제스트 결과)

### 6-2. 공개 + 홍보

- [ ] **6-2-1.** Obsidian 커뮤니티 포럼 게시
- [ ] **6-2-2.** GeekNews 공유
- [ ] **6-2-3.** 초기 피드백 수집 (GitHub Issues)

---

## Step 7: 장기 운영 + Phase 2→3 게이트 (3개월)

### 7-1. 운영 목표

- [ ] **7-1-1.** 100+ 소스 인제스트 (현재 6건)
- [ ] **7-1-2.** 200+ 위키 페이지 (현재 26건)
- [ ] **7-1-3.** 일관성 추이 기록 (lint 오류율)
- [ ] **7-1-4.** 프로바이더별 토큰 비용 월간 기록

### 7-2. Phase 2→3 게이트 평가

- [ ] **7-2-1.** LLM 위키 일관성: lint 오류율 감소 추세인가?
- [ ] **7-2-2.** 토큰 비용: 월 $50 이하인가?
- [ ] **7-2-3.** 커뮤니티: 10+ GitHub stars, 사용자 피드백 있는가?
- [ ] **7-2-4.** BYOAI: 2+ 프로바이더로 위키 교대 운영 성공했는가?
- [ ] **7-2-5.** 팀 수요: 2-3명 파일럿 긍정적인가?

---

## Phase 2 완료 체크리스트

### 필수 (Must)

- [x] raw/ PARA 재구조화 완료 (1,073개 파일 재분류)
- [x] CLASSIFY.md 분류 기준 문서 동작
- [x] LLM 다층 검색 파이프라인 동작 (qmd 내장: 쿼리확장→검색→리랭킹 + Gemma 4 합성)
- [ ] 한국어 벤치마크 80%+ 정확도 (현재 Top-1 40% → Step 3에서 개선)
- [ ] validate-wiki.sh + check-pii.sh 통과
- [ ] wikey.schema.md, CLAUDE.md, AGENTS.md 업데이트 완료

### 중요 (Should)

- [ ] inbox 모니터링 (fswatch) 동작
- [ ] Gemini 대용량 소스 처리 1건+ 성공
- [x] ~~Gemma 4 로컬 쿼리 확장/리랭킹~~ qmd 내장 파이프라인으로 대체
- [ ] 50+ 소스, 100+ 위키 페이지
- [ ] GitHub 공개 + README 최종화

### 선택 (Could)

- [ ] vLLM-Metal 배치 리랭킹 동작
- [ ] 한영 용어 정규화 사전 50+ 항목
- [ ] 커뮤니티 피드백 반영 1회+
- [ ] 3개월 운영 데이터 수집 완료

> 상세 결과: `activity/phase-2-result.md`에 기록 예정
