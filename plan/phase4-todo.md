# Phase 4: 인제스트 고도화 + 지식 그래프 (Graphify 방식 수용)

> 기간: Phase 3 완료 후
> 전제: Phase 3 (Obsidian 플러그인 + 인제스트 파이프라인) 완료
> 참고: Graphify (safishamsi/graphify) 아키텍처 분석 결과

---

## 4-1. 지식 그래프 (NetworkX)

- [ ] entity/concept 간 관계를 그래프로 구축
  - wiki/entities, wiki/concepts의 위키링크를 edge로 변환
  - vis.js 또는 Obsidian Graph View 연동
  - 클러스터링: Leiden 알고리즘 (graspologic) 기반 토픽 그룹핑
- [ ] graph.json 출력 — 영속 그래프 데이터
- [ ] graph.html — 인터랙티브 시각화 (vis.js)
- [ ] GRAPH_REPORT.md — god nodes, 핵심 연결, 추천 질문

## 4-2. 증분 업데이트 (file hash)

- [ ] .ingest-map.json에 file hash (SHA-256) 저장
- [ ] 소스 변경 감지 → 해당 wiki 페이지만 재생성
- [ ] 삭제된 소스 → 의존 wiki 페이지 자동 표시/정리
- [ ] 기존 ingest-map.json 확장 (path → {hash, ingested_at, pages})

## 4-3. Provenance tracking

- [ ] 추출된 관계에 출처 표시
  - EXTRACTED: 소스에서 직접 발견
  - INFERRED: LLM이 추론 (confidence score 포함)
  - AMBIGUOUS: 리뷰 필요 (사용자 확인 대기)
- [ ] 위키 페이지 프론트매터에 `provenance` 필드 추가
- [ ] Audit 패널에서 AMBIGUOUS 항목 리뷰 UI

## 4-4. AST 기반 코드 파싱

- [ ] 코드 파일은 LLM 없이 tree-sitter로 구조 추출
  - 함수/클래스/import 관계 자동 매핑
  - 지원 언어: Python, JS/TS, Go, Rust, C/C++
- [ ] 프로젝트 코드베이스도 위키로 관리 가능
- [ ] 코드 변경 시 AST diff로 영향 범위 자동 감지

## 4-4b. LLM 기반 3차/4차 분류 폴더 생성

현재 `wikey-core/src/classify.ts`는 파일명 토큰 매칭으로 Dewey Decimal 3차(10개 대분류)까지 라우팅. 매칭 안 되는 파일은 2차 폴더까지만 이동.

- [ ] **LLM 3차 분류** — 토큰 매칭 실패 시 LLM이 파일명+첫 200자 미리보기를 보고 `300_science`~`900_lifestyle` 중 선택. 자신 없으면 `000_general`로 안전 배치.
- [ ] **LLM 4차 제품 폴더 제안** — 제품 매뉴얼/CAD 같은 경우 LLM이 파일명에서 제품명 slug 추출(`Kyosho-Mini-Z/`, `DJI-O3-Air-Unit/`) 후 신규 폴더 생성 + 이동.
- [ ] **Audit 패널 UI**에 "Re-classify with LLM" 토글 — 자동 2차 폴더 결과를 3차/4차까지 확장
- [ ] **피드백 학습** — 사용자가 분류 결과 수정 시 `raw/CLASSIFY.md` 피드백 로그에 기록 + few-shot 예시로 반영
- [ ] **비용 관리** — classify 전용 저가 모델(gemini-2.0-flash-lite 등) 지정 가능

## 4-4c. URI 기반 안정 참조 아키텍처 (PARA 이동에 불변)

**문제 배경**: PARA 방법론은 파일 활성도에 따라 Resources → Archive 이동이 기본 가정. 현재 wikey는 파일 경로 → wiki 페이지 매핑(`.ingest-map.json`) + 소스 페이지 본문의 원본 경로 참조 구조 → 이동 시 stale 발생.

실제 관찰 (2026-04-19 세션): Raspberry Pi HQ Camera 파일 3회 이동(`inbox → 3_resources → 3_resources/30_manual → 3_resources/30_manual/500_technology`) 중 `.ingest-map.json` 0회 갱신 → Audit 파이프라인 판정 오류. 이번 세션에 수동 복구 1회.

**결정 (2026-04-19)**: 경로 기반 참조 포기, **URI/고정 ID 기반 안정 참조**로 전환. PARA 이동이 참조에 영향 없도록.

### 구현 로드맵

- [ ] **소스 ID 체계**
  - 각 소스 파일에 불변 ID 부여 (SHA256(content) 또는 UUID)
  - `.wikey/source-registry.json` — `{id: {current_path, hash, first_seen, ingested_pages[]}}`
  - 신규 ingest 시 ID 발급, 기존 파일 재감지 시 hash 매칭으로 ID 복구
- [ ] **wiki/sources 프론트매터 리팩토링**
  - 기존: `raw/original_path: raw/3_resources/.../file.pdf` (경로 하드코딩)
  - 신규: `source_id: sha256:abc123... / uri: file:///vault/raw/.../file.pdf` (ID 참조)
  - 본문 `> 원시 소스:` 라인은 UI 표시용으로만 유지
- [ ] **`.ingest-map.json` → `.wikey/source-registry.json` 교체**
  - 키: source_id (이동 불변)
  - 값: `{current_path, hash, source_page, ingested_at}`
  - 마이그레이션: 기존 경로 키를 hash 기반 id로 rewrite하는 one-shot 스크립트
- [ ] **파일 이동 감지 + registry 갱신**
  - `vault.on('rename')` → hash 재계산 없이 경로만 업데이트
  - `vault.on('modify')` → hash 변경 시 재인제스트 candidate로 마킹 (Audit 패널 표시)
  - `vault.on('delete')` → registry 항목 tombstone + wiki/sources에 "원본 삭제됨" 배너
- [ ] **CLASSIFY.md `.meta.yaml` URI 패턴 확장**
  - 로컬 파일: `uri: file://vault-relative/path` + `source_id`
  - 외부 소스: `uri: https://confluence.company.com/...` (기존 기업 URI 패턴 계승)
  - 공통 인터페이스로 로컬·외부 모두 처리
- [ ] **Audit 파이프라인 호환**
  - `audit-ingest.py` 판정 기준: hash 기반 (경로 대신)
  - 동일 hash의 파일이 이동했을 뿐이면 재인제스트 대상 아님
  - 내용 변경 시에만 재인제스트 제안
- [ ] **PARA 이동 허용 + 이력 보존**
  - 소스 id의 `path_history[]`에 이동 이력 append (auditing용)
  - Archive 이동 시 wiki/sources에 "아카이브됨" 배너 표시 (읽기는 유지)

### 호환성 전략

- Phase 4 시작 시점에 `.ingest-map.json` → `.wikey/source-registry.json` 일괄 마이그레이션 스크립트 제공
- wiki/sources 프론트매터 자동 변환 (기존 `raw/...` 경로 → hash 계산 후 `source_id` 필드 추가)
- 경로 기반 접근 API는 한 릴리스 deprecation 후 제거

## 4-5. 인제스트 프롬프트 시스템

- [ ] 프롬프트 파일 분리 — ingest_prompt_basic.md(시스템) + ingest_prompt_user.md(사용자)
  - 사용자가 설정에서 링크 클릭으로 user 프롬프트 편집
  - Reset 버튼으로 기본값 복원
- [ ] 도메인별 프롬프트 프리셋 (기술문서, 논문, 매뉴얼 등)
- [ ] **추출 기준 명확화** — 모델 간 결과 일관성 확보
  - entity 정의: "고유명사 단위 1개 = 1페이지" (제품명, 기관명, 규격명 등)
  - concept 정의: "핵심 개념 최대 N개" (세부 변형은 본문 내 설명으로)
  - granularity 가이드라인: Qwen3(27E) vs Gemini(46E) 수준의 차이 방지
  - 프롬프트에 예시 entity/concept 목록 포함 (few-shot)
  - 모델별 결과 품질 기준선(baseline) 정의 및 검증 테스트

## 4-6. 운영 안정성

- [ ] 원본/위키 삭제 안전장치 — dry-run 미리보기, 영향 범위 표시
- [ ] 초기화 기능 — 선택적 리셋 (완전/인제스트/원본/인덱스/설정)
- [ ] **bash→TS 완전 포팅** (validate-wiki, check-pii, cost-tracker, reindex) — Phase 3에서 이관, exec 래퍼는 안정 동작 중이라 우선순위 낮음
- [ ] **qmd SDK import** — Phase 3에서 이관. CLI exec → 직접 import로 전환 시 지연 감소 + 에러 처리 개선. 난이도 높음 (현재 vendored CLI 구조)

## 4-7. 로컬 추론 엔진 검토 (llama.cpp PoC)

- [ ] **Ollama vs llama.cpp 실측 gap 측정** — M4 Pro 48GB 환경에서 동일 Qwen3.6:35b-a3b GGUF로 비교
  - Ollama 0.20.5 (MLX 백엔드) vs `brew install llama.cpp` + `llama-server`
  - 동일 chunk·프롬프트로 latency/토큰/메모리 실측
  - 커뮤니티 측정치: 단일 요청 10~30% overhead (Go 런타임 + HTTP 직렬화)
  - wikey는 단일 사용자 + 순차 chunk → 동시요청 3x gap 해당 없음
  - **판정 기준**: 실측 gap ≥15%면 전환, 미만이면 Ollama 유지
- [ ] **전환 시 통합 경로**
  - `llama-server`는 OpenAI-compat API 제공 → `wikey-core/llm-client.ts`에 `llamacpp` provider 추가
  - `llama-swap` (Go proxy)로 모델 auto-load/unload → Ollama 스타일 UX 재현
  - GGUF 파일 직접 관리 (모델 경로 설정 UI 추가)
- [ ] 장점: 속도↑, 세밀한 양자화 제어 (IQ2~BF16, Unsloth Dynamic 2.0), 백그라운드 데몬 불필요
- [ ] 단점: 모델 스와핑 별도 도구 필요, provider 분기 재작성, GGUF 수동 다운로드

## 4-8. 문서 변환 Tiered Pipeline (MarkItDown + markitdown-ocr → Docling/Kreuzberg)

MarkItDown GitHub 이슈 트래커 확인된 주요 문제:
- HTML의 동적 데이터 변환 시 데이터 손실
- PDF 내 이미지 링크 추출 오류
- 복잡한 레이아웃 (멀티컬럼, 테이블) 변환 품질 저하

**현재 상태 (2026-04-18, Phase 3 완료분)**:
- Tier 1: MarkItDown (기본 텍스트 PDF/DOCX 변환)
- Tier 2: pdftotext / mdimport / pymupdf (텍스트 레이어 fallback)
- Tier 3: markitdown-ocr + Ollama gemma4:26b vision (이미지 스캔 PDF용 OCR)
- 위치: `wikey-core/src/ingest-pipeline.ts:extractPdfText` (5단계 chain)

**Phase 4 권장 전략**: MarkItDown 계열을 "1차 변환기(first-pass)"로 활용하고, 변환 품질이 부족한 문서에 대해서는 Docling / Kreuzberg 같은 고정확도 도구로 폴백하는 **tiered pipeline**으로 확장.

- [ ] **변환 품질 감지** — MarkItDown / markitdown-ocr 출력의 신호 기반 품질 스코어 (테이블 깨짐, 이미지 누락, 빈 섹션 비율, OCR 신뢰도)
- [ ] **Docling 통합** (Tier 4 — markitdown + ocr 모두 미흡 시 fallback) — IBM Research 고정확도 파서, 구조 보존 우수
  - `pip install docling` → Python exec 래퍼 추가 (`extractPdfText`의 6번째 fallback 단계)
  - PDF/DOCX/PPTX 레이아웃 분석, 테이블·이미지 OCR (자체 OCR 엔진 내장 — markitdown-ocr와 중복 검토 필요)
  - 처리 시간은 MarkItDown 대비 2~5배 느림 → 품질 필요 시에만 선택적 사용
  - **markitdown-ocr 대비 비교 포인트**: (a) 한국어 OCR 정확도 (b) 테이블 구조 보존 (c) 그림 캡션 추출 (d) 메모리/시간 비용
- [ ] **Kreuzberg 통합** (Tier 4 대안) — 경량·빠른 정확도 파서 (MarkItDown과 Docling 사이 포지션)
  - 이미지 링크 추출 안정, HTML 동적 데이터 보존
- [ ] **파이프라인 분기**:
  - Tier 1 (기본): MarkItDown → 품질 스코어 ≥ 임계값 → 그대로 사용
  - Tier 2-3 (fallback): pdftotext / mdimport / pymupdf / markitdown-ocr (현재 구현)
  - Tier 4 (고품질 fallback): 스코어 미달 or 사용자 지정 → Docling 또는 Kreuzberg 재변환
  - 사용자 오버라이드: Audit 패널에 파일별 변환기 선택 옵션
- [ ] **성능 비교 테스트** — 동일 PDF로 4개 변환기 출력 대조 (markitdown vs markitdown-ocr vs Docling vs Kreuzberg)
  - 평가 코퍼스: TWHB-16_001 파워디바이스 PDF (3.3MB, 텍스트 레이어 있음) + 별도 스캔 PDF 1건 (이미지 only)
  - 메트릭: 챕터/테이블/이미지 보존율, 처리 시간, 메모리 사용량, 한국어 정확도
- [ ] **캐시 전략** — 변환 결과 캐시 (SHA256 기반) → 재인제스트 시 변환 스킵

## 4-9. Phase 3에서 이관된 후속 (v7-3 + 갭 4건, 2026-04-20 확정)

Phase 3 완료 시점에 열어둔 항목. 우선순위 ①~⑤ 순.

### ① v7-3 Anthropic-style contextual chunk 재작성 (검색 재현율 개선)

- [ ] chunk를 재작성해 embedding/BM25 **인덱스에 반영** (retrieval 전처리)
  - 현재 wikey의 Gemma 4 contextual prefix는 **생성 단계** 프롬프트 보강용 (ingest-pipeline 내부)
  - Anthropic 의도: 저장된 chunk 자체에 문서 맥락이 주입된 상태로 인덱스 구축
  - 기대 효과: 하이브리드 검색(BM25+임베딩)에서 짧은 chunk의 문맥 손실 감소 → 재현율 개선
  - 참조: <https://www.anthropic.com/engineering/contextual-retrieval>
- [ ] PoC 범위
  - qmd 인덱스 재빌드 파이프라인에 "contextual rewrite" 스테이지 추가
  - 동일 코퍼스로 baseline vs rewrite 재현율 측정 (MRR, Recall@10)
  - 비용: chunk 수 × 추가 LLM 호출 — 대형 코퍼스에서 부담될 수 있어 로컬 Gemma4 기본
- [ ] 결정 기준: 재현율 개선 ≥ 15% 시 파이프라인에 상설 통합, 미만이면 기각 기록

### ② brief generation + ingest의 OCR 중복 제거 (캐싱)

- [ ] 동일 PDF에 대해 brief 생성 + 본 인제스트가 각각 `extractPdfText` 호출 → **2× OCR 비용** (14.2 발견)
  - Phase 3 결과: 48p OMRON PDF, Gemini Flash vision ~$0.04/건 × 2회 = $0.08
- [ ] 캐시 키: `<path, mtime, size, ocr_dpi>` → markdown 결과
- [ ] 위치: `wikey-core/src/ingest-pipeline.ts:extractPdfText` 진입점에 메모이제이션 추가
- [ ] 테스트: 동일 파일 2회 호출 → 두번째는 캐시 히트 어설션

### ③ canonicalize에 stripBrokenWikilinks 자동 적용

- [ ] source_page 한국어 wikilink 자동 정리 (14.5 발견, OMRON 261→79→0 수동 cleanup 경험)
  - 현재 canonicalizer는 entity/concept 페이지와 log entry에는 이미 적용
  - 누락: Stage 1 summary call이 생성하는 source_page 본문 wikilink
- [ ] 위치: `wikey-core/src/canonicalizer.ts` 또는 `wikey-core/src/ingest-pipeline.ts`의 summary 후처리
- [ ] writtenPages 기반 정리 → canonical 페이지에 없는 wikilink는 텍스트로 강등

### ④ Stage 2/3 프롬프트도 사용자 override 지원

- [ ] 현재 v7-5 override는 **schema 타입**만 확장 (`.wikey/schema.yaml`) — Stage 1 summary prompt도 `.wikey/ingest_prompt.md`로 override 가능
- [ ] 미지원: Stage 2 mention extraction 프롬프트 + Stage 3 canonicalize 프롬프트 (14.3 발견)
- [ ] 설계: `.wikey/canonicalize_prompt.md`, `.wikey/mention_prompt.md` 파일 존재 시 해당 스테이지에 override 주입
- [ ] 위치: `wikey-core/src/canonicalizer.ts:buildCanonicalizerPrompt`, Stage 1 mention extraction 함수
- [ ] UI: settings-tab.ts에 Ingest Prompt 섹션 확장 (3개 prompt 모두 편집 버튼)

### ⑤ OCR API 키 process listing 노출 제거

- [ ] markitdown-ocr + page-render vision OCR가 `--api-key=...` CLI 인자로 전달 → `ps aux`에서 보임 (14.2 발견, 보안 갭)
- [ ] 전환: env var (`GEMINI_API_KEY` 등) 또는 stdin으로 전달
- [ ] 위치: `wikey-core/src/ingest-pipeline.ts:extractPdfText` 내 execFile 호출 부위
- [ ] 검증: 인제스트 중 `ps aux | grep markitdown` 에 키 미노출 확인

### ⑥ measure-determinism.sh 안정성 보강 + v7 결정성 재측정 (14.14 발견)

Phase 3 말미 2회 시도에서 측정 스크립트 자동화 문제로 CV 통계 산출 실패. Baseline(PMS v6, Total CV 16.9%)과 v7(v7-1 decision tree + v7-2 anti-pattern) 비교 미완.

- [ ] **(a) plugin reload 강제** — 스크립트 진입 시 `app.plugins.disablePlugin('wikey'); await app.plugins.enablePlugin('wikey')` → 세션 중 리빌드된 플러그인이 수동 `Cmd+R` 없이도 반영
- [ ] **(b) audit-ingest JSON 생성 확인** — 현재 5 retries × 1.5s = 7.5s 외에 JSON 파일 mtime이 현재 측정 세션보다 fresh한지 추가 체크
- [ ] **(c) apply-button 전환 timeout 상향** — 10s (20 × 500ms) → 30s (60 × 500ms) + `.wikey-ingest-progress` notice 표시 병행 감지
- [ ] **(d) per-run 실패 허용 정책** — 5회 중 N회(예: 3회) 정상 완료면 해당 runs만 통계 산출
- [ ] **재측정 완료 후** → `activity/determinism-pms-post-v7-<date>.md`에 CV 표 + v7-1 decision tree 판정 (**개선 / 무효 / 악화**) + README/log 동기화
- [ ] **cross-check**: Greendale 같은 작은 영어 소스(chunk 1개)로는 CV 측정에 불충분(사용자 지적) — 측정 대상은 최소 15KB 이상·chunk ≥ 3개 보장

---

> v7-5 (schema yaml override)는 Phase 3 말미(2026-04-20)에 **완료됨** — `wikey-core/src/schema.ts` `loadSchemaOverride()` + Obsidian 설정 탭 Schema Override 섹션. 27건 신규 테스트 (파서 8 · validation 5 · getEntityTypes/ConceptTypes 2 · promptBlock 3 · FS 로더 4 · canonicalizer 통합 3 · prompt 주입 1 · built-in+override 1).
