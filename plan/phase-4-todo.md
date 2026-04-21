# Phase 4: 인제스트 고도화 + 지식 그래프

> 기간: Phase 3 완료 후
> 전제: Phase 3 (Obsidian 플러그인 + 인제스트 파이프라인 v6) 완료
> 구성 원칙: **wiki 시스템 워크플로우 순서대로 정리**
> 워크플로우: 소스 감지 → **1. 문서 전처리** → **2. 분류·참조** → **3. 인제스트(LLM 추출)** → **4. 검색·그래프** → **5. 운영·안정성**

---

## 4.0 UI 사전작업 #design #main-feature

- [ ] chat 패널 추가 : 대화창 전용 패널
  - 아이콘 및 위치 : 상단 아이콘의 맨 앞에 위치하며, 아이콘은 'chat'
  - 현재 상태 : 대화창 위에 각 패널에 overlay되어 있는 상태
  - 변경 목표 : 각 패널의 특성 및 역할을 전담으로 처리
  - 각 패널의 UI 변경 : 하단의 대화창 및 AI model은 삭제, 대신에 설정에서 지정된 Defaut AI Model명을 출력하고  모델 변경 안됨 (출력 형식 : 'Defaut AI Model : Google Gemini | gemini-2.5-flash'), 메시지창 지워진 만큼 상단 내용으로 채우기
  - chat패널 : 기존의 대화창 UI를 그대로 유지하며, 초기값은 Default AI model(시작시)이며, provider와 model변경 가능
- [ ] 대화창 내용 지우기 기능
  - 기존 : 상단의 'trash'아이콘 삭제
  - 변경 : 메시지창에 '/clear' command 입력
- [ ] Dashboard
  - dashboard 아이콘 변경 : 기존 home에서 graph (막대그래프)

## 4.1 문서 전처리 파이프라인 (source → Markdown) #core #workflow

### 4.1.1 Docling + unhwp 메인화, MarkItDown은 fallback으로 강등

**결정 (2026-04-20)**: 현재 tier 1인 MarkItDown은 한국어 OCR 정확도·테이블 보존·HWP 미지원 등의 갭이 누적되어 품질 상한이 낮음. IBM Docling(TableFormer + layout model + ocrmac/RapidOCR/Tesseract)을 PDF/DOCX/PPTX/XLSX/HTML/이미지/TXT의 **메인 컨버터**로 승격하고, HWP/HWPX는 **unhwp**로 위임한다. MarkItDown 체인은 docling 미설치 환경 또는 경량 경로의 **fallback**으로 유지.

**참조 스킬**:

- docling SKILL: `claude-forge-custom/skills/docling/SKILL.md`
- unhwp SKILL: `claude-forge-custom/skills/unhwp/SKILL.md`

#### 4.1.1.1 Docling 통합 (Tier 1 메인, PDF/DOCX/PPTX/XLSX/HTML/이미지/TXT)

- [ ] 설치 경로 결정
  - CLI (`uv tool install docling`) vs Python API (`uv pip install docling` in project venv) - 설치 여부 확인  후 설치
  - wikey는 execFile 호출이 이미 markitdown-ocr로 정착 → CLI 경로 기본, Python API는 옵션
- [ ] `wikey-core/src/ingest-pipeline.ts:extractPdfText` 체인 재정렬
  - Tier 1: **docling** (`docling <path> --to md --ocr-engine ocrmac --ocr-lang ko-KR,en-US`)
  - Tier 2: markitdown-ocr (이미지 전용 PDF, Gemini vision) — 유지
  - Tier 3: MarkItDown (docling 미설치 fallback) — 현재 tier 1을 tier 3으로 강등
  - Tier 4: pdftotext / pymupdf / PyPDF2 — 유지
  - Tier 5: page-render Vision OCR (Gemini, 현재 tier 6) — 최후 수단 유지
- [ ] 옵션 매핑
  - `--table-mode accurate` vs `fast`: 설정에 `DOCLING_TABLE_MODE` 추가 (기본 accurate)
  - `--image-export-mode placeholder`: RAG에서 토큰 절약, wiki 인제스트 기본값 (docling 기본값 : image embedding with base64)
  - `--device mps` (M-series) 자동 감지 → OCR DPI와 유사하게 `DOCLING_DEVICE` env
- [ ] `env-detect.ts` 보강 — docling CLI 존재 + 버전 감지 (현재 markitdown-ocr 감지와 동일 패턴)
- [ ] 설정 탭 Environment 섹션에 Docling 상태 라인 추가

#### 4.1.1.2 unhwp 통합 (Tier 1b 메인, HWP/HWPX)

- [ ] 파일 확장자 기반 분기 — `.hwp` / `.hwpx` 는 docling 건너뛰고 unhwp 직행
- [ ] 호출 패턴: `python3 <vault>/skills/unhwp/convert.py <src> <out_dir>` 또는 vendored 스크립트
  - vendoring 여부: `scripts/vendored/unhwp-convert.py`로 복사해 플러그인 자족 운영 검토
  - 원격 SKILL 파일 의존 회피 (사용자 환경 차이)
- [ ] 이미지 정책: `strip_base64_images()` 우선 적용 (토큰 절약, RAG 일관성), 이 이미지 정책은 docling에서도 동일하게 적용
- [ ] `env-detect.ts`에 `python3 -c "import unhwp"` 체크 — 미설치 시 설정 탭에서 `pip install unhwp` 안내

#### 4.1.1.3 MarkItDown 체인을 fallback으로 강등

- [ ] 기존 `extractPdfText`의 tier 1 (MarkItDown) 호출을 tier 3으로 이동
- [ ] Obsidian 환경 탐지 로직에서 우선순위 변경 반영 (docling 감지 → docling 사용, 미감지 → markitdown 계열로 회귀)
- [ ] 통합 테스트: 동일 PDF 3종(텍스트 PDF, 스캔 PDF, 복잡 표) × (docling / markitdown / markitdown-ocr / pdftotext) 출력 비교

#### 4.1.1.4 OCR 중복 호출 제거 (brief ↔ ingest 캐싱)

(Phase 3 §14.2 발견 — 48p OMRON: Gemini vision OCR × 2회 = ~$0.08/건)

- [ ] 캐시 키: `<abs_path, mtime, size, ocr_dpi, converter_tier>` → markdown 결과
- [ ] 캐시 위치: `~/.cache/wikey/ocr/<hash>.md` (TTL 30일)
- [ ] 적용 범위: `extractPdfText` 진입점 1곳에서 메모이제이션 → brief 생성·본 인제스트 모두 혜택
- [ ] 테스트: 동일 파일 2회 호출 → 두번째는 캐시 히트 assertion

#### 4.1.1.5 OCR API 키 process listing 노출 제거

(Phase 3 §14.2 발견 — `ps aux | grep markitdown`에 `--api-key=...` 평문 노출, 보안 갭)

- [ ] `execFile` 인자로 전달하는 API 키를 env var (`GEMINI_API_KEY` 등) 또는 stdin으로 전환
- [ ] 위치: `wikey-core/src/ingest-pipeline.ts:extractPdfText` 내 markitdown-ocr / Vision OCR 호출부
- [ ] 검증: 인제스트 중 `ps aux | grep -E "markitdown|ocr"` 결과에 key 미노출

#### 4.1.1.6 변환 품질 감지 및 tier 분기

- [ ] 품질 스코어: 테이블 깨짐(`|`만 연속), 빈 섹션 비율, 본문 최소 문자 수, OCR 신뢰도(log)
- [ ] tier 1(docling) 출력이 임계 미달 → tier 2(markitdown-ocr) 재시도
- [ ] 사용자 오버라이드: Audit 패널에 파일별 "converter" 드롭다운 (docling/markitdown/markitdown-ocr/vision-ocr)

#### 4.1.1.7 성능 비교 테스트 (정량 baseline)

- [ ] 코퍼스
  - TWHB-16_001 파워디바이스 PDF (3.3MB, 텍스트 레이어 + 한국어 표)
  - OMRON HEM-7600T (vector PDF, 48p, 한국어/다국어)
  - 스캔 PDF 1건 (이미지 only)
  - HWP/HWPX 각 1건
- [ ] 메트릭: 챕터 보존율, 테이블 행/열 정확도, 이미지 캡션 추출, 처리 시간, 메모리, 한국어 정확도
- [ ] 변환기: docling / unhwp / markitdown / markitdown-ocr / pdftotext / pymupdf / page-render Vision OCR

#### 4.1.1.8 변환 결과 캐시 (SHA256 기반, 재인제스트 스킵)

(§4.1.4 OCR 캐시의 일반화: 전체 변환 결과 영속 캐시)

- [ ] 키: `sha256(original_bytes) + converter_tier + major_options`
- [ ] 저장: `~/.cache/wikey/convert/<hash>.md`
- [ ] Audit 패널에서 "Force re-convert" 토글로 캐시 무효화

#### 4.1.1.9 md변환 결과 저장, 활용 및 이동

[ ] md로 변환된 결과는 inbox에 저장하였다가, 원본이 이동하는 경로로 같이 이동

---

## 4.2 분류 및 파일 관리 (inbox → PARA, 이동에 강한 참조) #workflow #core

### 4.2.1 LLM 기반 3차/4차 분류 폴더 생성

현재 `wikey-core/src/classify.ts`는 파일명 토큰 매칭으로 Dewey Decimal 3차(10개 대분류)까지 라우팅. 매칭 안 되는 파일은 2차 폴더까지만 이동.

- [ ] **LLM 3차 분류** — 토큰 매칭 실패 시 파일명 + 첫 200자 미리보기를 보고 `300_science`~`900_lifestyle` 중 선택. 자신 없으면 `000_general`로 안전 배치.
- [ ] **LLM 4차 제품 폴더 제안** — 제품 매뉴얼·CAD 등은 LLM이 파일명에서 제품명 slug 추출(`Kyosho-Mini-Z/`, `DJI-O3-Air-Unit/`) 후 신규 폴더 생성·이동
- [ ] **Audit 패널 UI**에 "Re-classify with LLM" 토글 — 자동 2차 폴더 결과를 3차/4차까지 확장
- [ ] **피드백 학습** — 사용자가 분류 결과 수정 시 `raw/CLASSIFY.md` 피드백 로그에 기록 + few-shot 예시로 반영
- [ ] **비용 관리** — classify 전용 저가 모델(gemini-2.0-flash-lite 등) 지정 가능

### 4.2.2 URI 기반 안정 참조 아키텍처 (PARA 이동에 불변)

**배경**: PARA는 파일 활성도에 따라 Resources → Archive 이동이 기본. 현재 wikey는 경로 기반 매핑(`.ingest-map.json`) + 소스 페이지 본문의 원본 경로 참조 → 이동 시 stale.

**결정 (2026-04-19)**: 경로 대신 **URI / 고정 ID 기반 안정 참조**. PARA 이동이 참조에 영향 없도록.

#### 4.2.2.1 구현 로드맵

- [ ] **소스 ID 체계** — 불변 ID 부여 (SHA256(content) 또는 UUID)
  - `.wikey/source-registry.json` — `{id: {current_path, hash, first_seen, ingested_pages[]}}`
  - 신규 ingest 시 ID 발급, 기존 파일 재감지 시 hash 매칭으로 ID 복구
- [ ] **wiki/sources 프론트매터 리팩토링**
  - 기존: `raw/original_path: raw/3_resources/.../file.pdf` (경로 하드코딩)
  - 신규: `source_id: sha256:abc123... / uri: file:///vault/raw/.../file.pdf`
  - 본문 `> 원시 소스:` 라인은 UI 표시용
- [ ] **`.ingest-map.json` → `.wikey/source-registry.json` 교체**
  - 키: source_id (이동 불변)
  - 값: `{current_path, hash, source_page, ingested_at}`
  - 마이그레이션: 기존 경로 키 → hash 기반 id로 rewrite하는 one-shot 스크립트
- [ ] **파일 이동 감지 + registry 갱신**
  - `vault.on('rename')` → hash 재계산 없이 경로만 업데이트
  - `vault.on('modify')` → hash 변경 시 재인제스트 candidate (Audit 표시)
  - `vault.on('delete')` → registry 항목 tombstone + "원본 삭제됨" 배너
- [ ] **CLASSIFY.md `.meta.yaml` URI 패턴 확장**
  - 로컬: `uri: file://vault-relative/path` + `source_id`
  - 외부: `uri: https://confluence.company.com/...`
  - 공통 인터페이스로 로컬·외부 모두 처리
- [ ] **Audit 파이프라인 호환** — 판정 기준 hash 기반 (경로 대신). 이동만 됐을 뿐이면 재인제스트 대상 아님.
- [ ] **PARA 이동 허용 + 이력 보존** — `path_history[]`에 이동 이력 append (auditing용). Archive 이동 시 wiki/sources에 "아카이브됨" 배너.

#### 4.2.2.2 호환성 전략

- Phase 4 시작 시점에 `.ingest-map.json` → `.wikey/source-registry.json` 일괄 마이그레이션 스크립트 제공
- wiki/sources 프론트매터 자동 변환 (기존 경로 → hash 계산 후 `source_id` 필드 추가)
- 경로 기반 접근 API는 한 릴리스 deprecation 후 제거

---

## 4.3 인제스트 (LLM 추출 · 품질 관리) #core #engine #workflow

### 4.3.1 인제스트 프롬프트 시스템 (3-stage 전부 override)

현재 v7-5까지: `.wikey/ingest_prompt.md` (Stage 1 summary) + `.wikey/schema.yaml` (schema 타입) override 지원. Stage 2/3 미지원.

- [ ] **3-stage 프롬프트 완전 분리**
  - `.wikey/stage1_summary_prompt.md` (source_page 요약) — 기존 `ingest_prompt.md` 통합
  - `.wikey/stage2_mention_prompt.md` (chunk → Mention 추출)
  - `.wikey/stage3_canonicalize_prompt.md` (canonicalizer schema 결정)
- [ ] **도메인별 프리셋** — 기술문서 / 논문 / 매뉴얼 / 회의록 / 제품 스펙
- [ ] **추출 기준 명확화** — 모델 간 결과 일관성 확보
  - entity: "고유명사 단위 1개 = 1페이지" (제품명, 기관명, 규격명)
  - concept: "핵심 개념 최대 N개" (세부 변형은 본문 설명으로 흡수)
  - granularity: Qwen3(27E) vs Gemini(46E) 수준 차이 방지 가이드라인
  - 프롬프트에 예시 entity/concept 목록 포함 (few-shot)
  - 모델별 결과 품질 baseline 정의 + 검증 테스트
- [ ] 설정 탭 Ingest Prompt 섹션 확장 — 3개 prompt 모두 Edit/Reset 버튼 + 상태 표시
- [ ] `wikey-core/src/canonicalizer.ts:buildCanonicalizerPrompt` 및 Stage 1 mention extractor에 override 파라미터 주입

### 4.3.2 Provenance tracking

- [ ] 추출된 관계에 출처 표시
  - EXTRACTED: 소스에서 직접 발견
  - INFERRED: LLM이 추론 (confidence score 포함)
  - AMBIGUOUS: 리뷰 필요 (사용자 확인 대기)
- [ ] 위키 페이지 프론트매터에 `provenance` 필드 추가
- [ ] Audit 패널에서 AMBIGUOUS 항목 리뷰 UI

### 4.3.3 증분 업데이트 (file hash 기반)

(§4.3 source-registry와 연계)

- [ ] `.wikey/source-registry.json` hash 필드로 소스 변경 감지 → 해당 wiki 페이지만 재생성
- [ ] 삭제된 소스 → 의존 wiki 페이지 자동 "근거 삭제됨" 표시 / 정리
- [ ] 부분 재인제스트 — chunk diff 기반 증분 (chunk hash 매칭)

### 4.3.4 stripBrokenWikilinks 자동 적용 (source_page 본문)

(Phase 3 §14.5 발견 — OMRON 261건 한국어 wikilink 수동 cleanup)

- [ ] 현재 canonicalizer는 entity/concept 페이지 + log entry에만 적용
- [ ] 누락: Stage 1 summary가 생성하는 source_page 본문 wikilink
- [ ] 위치: `wikey-core/src/canonicalizer.ts` 또는 `ingest-pipeline.ts`의 summary 후처리
- [ ] writtenPages 기반 정리 → canonical 페이지에 없는 wikilink는 텍스트로 강등

---

## 4.4 검색 재현율 · 지식 그래프 #eval #core

### 4.4.1 Anthropic-style contextual chunk 재작성 (v7-3, 검색 인덱스 전처리)

(Phase 3 §C-2에서 이관. 현재 Gemma 4 contextual prefix는 생성 단계 프롬프트 보강용)

- [ ] chunk를 재작성해 embedding/BM25 **인덱스에 반영** (retrieval 전처리)
  - Anthropic 의도: 저장된 chunk 자체에 문서 맥락이 주입된 상태로 인덱스 구축
  - 기대 효과: 하이브리드 검색(BM25+임베딩)에서 짧은 chunk의 문맥 손실 감소 → 재현율 개선
  - 참조: [https://www.anthropic.com/engineering/contextual-retrieval](https://www.anthropic.com/engineering/contextual-retrieval)
- [ ] PoC 범위
  - qmd 인덱스 재빌드 파이프라인에 "contextual rewrite" 스테이지 추가
  - 동일 코퍼스로 baseline vs rewrite 재현율 측정 (MRR, Recall@10)
  - 비용: chunk 수 × 추가 LLM 호출 — 대형 코퍼스에서 부담될 수 있어 로컬 Gemma4 기본
- [ ] 결정 기준: 재현율 개선 ≥ 15% 시 파이프라인에 상설 통합, 미만이면 기각 기록

### 4.4.2 지식 그래프 (NetworkX)

- [ ] entity/concept 간 관계를 그래프로 구축
  - wiki/entities, wiki/concepts의 위키링크를 edge로 변환
  - vis.js 또는 Obsidian Graph View 연동
  - 클러스터링: Leiden 알고리즘 (graspologic) 기반 토픽 그룹핑
- [ ] graph.json 출력 — 영속 그래프 데이터
- [ ] graph.html — 인터랙티브 시각화 (vis.js)
- [ ] GRAPH_REPORT.md — god nodes, 핵심 연결, 추천 질문

### 4.4.3 AST 기반 코드 파싱

- [ ] 코드 파일은 LLM 없이 tree-sitter로 구조 추출
  - 함수/클래스/import 관계 자동 매핑
  - 지원 언어: Python, JS/TS, Go, Rust, C/C++
- [ ] 프로젝트 코드베이스도 위키로 관리 가능
- [ ] 코드 변경 시 AST diff로 영향 범위 자동 감지

---

## 4.5 운영 · 안정성 #ops #eval

### 4.5.1 결정성 측정 인프라 (measure-determinism.sh 보강)

Phase 3 종반 4회 실패의 근본 원인은 React state propagation이 아니라 **measure-determinism.sh의 selector 버그**였다 (2026-04-21 해명): ingest 시작 시 apply button class가 `wikey-audit-apply-btn → wikey-audit-cancel-btn`으로 swap되지만 (`sidebar-chat.ts:999-1000`) 스크립트는 apply class만 query → null 반환 → transition 미감지. 2026-04-21 수동 CDP 드라이브 5/5 성공으로 파이프라인 결정성은 확증(§3.6.6).

#### 4.5.1.1 selector 수정 (핵심 fix)

- [x] `scripts/measure-determinism.sh`의 `btnProbe` selector를 class-agnostic text 기반으로 교체 (`getActionBtn()` helper, apply·cancel 양쪽 매칭)
- [x] 완료 detect도 같은 패턴으로 통일 (probe 양쪽 `btnText()` 호출)
- [x] 부차: CDP response 추출 경로 수정 (`result.result.value` nested twice) + 15KB 최소 크기 가드 추가 (`-f/--force` 우회)

#### 4.5.1.2 script guard 정리 (Phase 3에서 이미 merge된 것들)

- [X] apply-button 전환 probe (20 × 500ms) — merge됨
- [X] stale Cancel 감지 → 진입 시 자동 클릭 — merge됨
- [X] `cleanupForRerun`이 wiki/sources의 YAML title 3+char 토큰 overlap로 임의 slug 파일 삭제 — snapshot-diff 방식으로 대체됨 (임의 파일 삭제 리스크 제거)
- [x] snapshot-and-diff 방식 도입 — `readSourceTagsOf` content-match 제거, pre-run `snapshotDirs()` + post-run `listDiff(baseline)` 로 신규 파일만 정확히 집계·삭제

#### 4.5.1.3 측정 재실행 (선택)

- [x] selector 수정 후 5-run smoke로 자동 스크립트 동작 검증 (수동 드라이브 대체 가능성 확인) — PMS PDF 5/5 성공, Total CV 5.7% (수동 7.9%와 동일 분포). `activity/determinism-pms-auto-2026-04-21.md` 참고.
- [x] 측정 대상 제약 — 최소 15KB 이상 (chunk ≥ 3 예상) 가드 추가. 미만 시 exit 2, `-f/--force` 로 우회 가능.

#### 4.5.1.4 canonicalizer 확장 (v7 잔여 variance 대응)

2026-04-21 측정에서 count-level은 안정(Total CV 7.9%)이나 **naming-level 변동** 잔재:
- 음역 다중 슬러그: `alimtalk` / `allimtok` / `alrimtok`
- 축약 불일치: `integrated-member-database` ↔ `integrated-member-db`
- E/C 경계 왕복: `mqtt` / `project-management-system` / `restful-api`

- [ ] `canonicalize.ts`에 음역 정규화 테이블 (한국어 고유명 → canonical slug)
- [ ] 약어/동의어 흡수 (sso-api / single-sign-on-api / single-sign-on → 하나)
- [ ] E/C 경계 왕복 3건을 `.wikey/schema.yaml`에 고정 (`restful-api`=concept, `mqtt`=entity, etc.)

### 4.5.2 운영 안정성 — 삭제·초기화·포팅

- [ ] **원본/위키 삭제 안전장치** — dry-run 미리보기, 영향 범위 표시
- [ ] **초기화 기능** — 선택적 리셋 (완전/인제스트/원본/인덱스/설정)
- [ ] **bash→TS 완전 포팅** (validate-wiki, check-pii, cost-tracker, reindex) — Phase 3에서 이관. exec 래퍼는 안정 동작 중이라 우선순위 낮음
- [ ] **qmd SDK import** — Phase 3에서 이관. CLI exec → 직접 import로 전환 시 지연 감소 + 에러 처리 개선. 난이도 높음 (현재 vendored CLI 구조)

### 4.5.3 로컬 추론 엔진 검토 (llama.cpp PoC)

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

---

## Phase 3 완료분 요약 (참고)

> 이 항목들은 Phase 3 내에서 이미 완료된 기능. Phase 4 범위 아님.

- v6 3-stage pipeline + schema-guided extraction (2026-04-19)
- v7-1 Concept decision tree + v7-2 추가 anti-pattern (2026-04-20)
- v7-4 measure-determinism.sh 자동화 스크립트 (2026-04-20, race guard 포함)
- v7-5 `.wikey/schema.yaml` 사용자 override — `loadSchemaOverride()` + Obsidian Schema Override 설정 섹션. 27건 신규 테스트.
- v7-6 Gemini 모델 리스트 필터·정렬 (Pro 가시성)
- MarkItDown + markitdown-ocr + page-render Vision OCR 5-tier (Phase 3까지는 tier 1=MarkItDown, §4-1에서 docling으로 승격 예정)
