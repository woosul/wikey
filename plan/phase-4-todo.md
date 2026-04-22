# Phase 4: 인제스트 고도화 + 지식 그래프

> 기간: Phase 3 완료 후
> 전제: Phase 3 (Obsidian 플러그인 + 인제스트 파이프라인 v6) 완료
> 구성 원칙: **wiki 시스템 워크플로우 순서대로 정리** — 번호·제목·태그는 `activity/phase-4-result.md`와 1:1 mirror
> 워크플로우: 소스 감지 → **1. 문서 전처리** → **2. 분류·참조** → **3. 인제스트(LLM 추출)** → **4. 검색·그래프** → **5. 운영·안정성**
> 상태 (2026-04-22): §4.0 완료, §4.1 완료, §4.5.1 완료, §4.5.1.4 기능 완수/CV 미확증, §4.5.1.5 완료 (24.3%), §4.5.1.6 완료 (29-run Total CV **9.2%**, baseline 24.3% 대비 −62% 상대, 목표 <10% 달성). 다음 = §4.2 URI 안정 참조 / §4.3 인제스트 고도화 / §4.5.1.7 variance 분해 (조건부).

---

## 4.0 UI 사전작업
> tag: #design, #main-feature

- [x] 4.0.1 chat 패널 추가 — first-class 패널로 승격 + header 아이콘 재구성
  - chat 아이콘 first position, dashboard 아이콘 home → bar-chart 교체
  - PanelName에 'chat' 추가/null 제거, 초기 activePanel='chat'
  - togglePanel → selectPanel rename (재클릭 no-op)
  - 비-chat 패널에서 composer/modelRow 숨김 + `Default AI Model : Provider | model` readonly 라벨 하단 고정
- [x] 4.0.2 대화창 내용 지우기 — trash 버튼 삭제 + `/clear` 슬래시 커맨드
  - handleSend 최상단 감지, placeholder 'Ask a question… (type /clear to reset)'
- [x] 4.0.3 Dashboard 아이콘 변경 — home → bar-chart (Bootstrap Icons)
- [x] 4.0.4 재시작/reload 시 메시지창 초기화 — main.ts loadSettings의 savedChatHistory 복원 제거
- [x] 4.0.5 Chat 패널 provider/model 모두 편집 가능 — provider span → select 전환, PROVIDER_OPTIONS 재사용
- [x] 4.0.6 CSS 정비 — readonly-model-bar 신규, dashboard/help flex+border 정비, active 버튼 focus 변형 추가 (1-click accent 배경 적용)
- [x] 4.0.7 Audit/Ingest inbox override 드롭다운 자연 너비화 — field-sizing:content, flex-start 좌측 정렬, provider 180/model 240 min-width
- [x] 4.0.8 DEFAULT 라벨 통일 — `(use Default Model)`/`(provider default)` → `DEFAULT` (9개 위치 일괄)
- [x] 4.0.9 사이드바 초기 폭 500px — `initialSidebarWidthApplied` 플래그 + `rightSplit.setSize(500)` 최초 1회만

## 4.1 문서 전처리 파이프라인 (source → Markdown) — **완료 (2026-04-21)**
> tag: #core, #workflow
> 최종 상태: Docling 메인화 + unhwp + MarkItDown fallback 강등 + 자동 force-ocr 감지 + 5개 코퍼스 실증. 251 tests PASS.
> 상세: `activity/phase-4-result.md §4.1` + `activity/phase-4-converter-benchmark.md`

### 4.1.1 Docling + unhwp 메인화, MarkItDown은 fallback으로 강등

**결정 (2026-04-20)**: 현재 tier 1인 MarkItDown은 한국어 OCR 정확도·테이블 보존·HWP 미지원 등의 갭이 누적되어 품질 상한이 낮음. IBM Docling(TableFormer + layout model + ocrmac/RapidOCR/Tesseract)을 PDF/DOCX/PPTX/XLSX/HTML/이미지/TXT의 **메인 컨버터**로 승격하고, HWP/HWPX는 **unhwp**로 위임한다. MarkItDown 체인은 docling 미설치 환경 또는 경량 경로의 **fallback**으로 유지.

**구현 계획 (2026-04-21)**: `plan/phase-4-4-1-agile-crystal.md` — 사용자 승인 완료. 이미지 처리는 embedded 출력 + 공통 `stripEmbeddedImages()` 로 LLM 투입 직전 placeholder化(alt text 보존). Obsidian Web Clipper의 외부 이미지 URL(`![alt](https://...svg)`)도 같은 함수가 처리.

**실행 순서 (의존성 그래프)**:

1. 공통 strip 함수 (`wikey-core/src/rag-preprocess.ts`) + 테스트 — §4.1.1 공통
2. env-detect 보강 (docling/unhwp 감지) + settings-tab Environment 섹션
3. vendored scripts (`scripts/vendored/unhwp-convert.py` 복사, docling은 시스템 CLI 직접 호출)
4. `extractPdfText` 재구성 (tier 재배치, mdimport 삭제) — §4.1.1.1 + §4.1.1.3
5. `selectConverter` 리팩토링 + `extractHwpText` / `extractDocumentText` — §4.1.1.2
6. API key 보안 수정 — §4.1.1.5
7. 품질 감지 + tier 재시도 — §4.1.1.6
8. 변환 캐시 — §4.1.1.4 + §4.1.1.8
9. md 사본 저장/이동 — §4.1.1.9
10. 벤치마크 + 리포트 — §4.1.1.7

1~6은 필수 구현, 7~10은 같은 세션 내 후속. §4.5.1.5 variance 재개는 1~5 완료 시점부터 가능.

**참조 스킬**:

- docling SKILL: `claude-forge-custom/skills/docling/SKILL.md`
- unhwp SKILL: `claude-forge-custom/skills/unhwp/SKILL.md`

#### 4.1.1.1 Docling 통합 (Tier 1 메인, PDF/DOCX/PPTX/XLSX/HTML/이미지/TXT)

- [x] 설치 경로 결정 — **CLI 경로 기본** (`uv tool install docling` → `~/.local/bin/docling`). execFile로 호출하여 markitdown-ocr와 동일 패턴 유지.
- [x] `wikey-core/src/ingest-pipeline.ts:extractPdfText` 체인 재정렬 — Tier 1 docling + 1b force-ocr (공백 소실 재시도) / Tier 2 markitdown-ocr / Tier 3 MarkItDown (fallback) / Tier 4 pdftotext / Tier 5 pymupdf / Tier 6 page-render Vision. mdimport(구 tier 3) 삭제.
- [x] 옵션 매핑 — `DOCLING_TABLE_MODE` (accurate/fast) · `DOCLING_DEVICE` (mps/cuda/cpu) · `DOCLING_OCR_ENGINE` (ocrmac/rapidocr/tesseract) · `DOCLING_OCR_LANG` (ko-KR,en-US) · `DOCLING_TIMEOUT_MS` · `DOCLING_DISABLE`. wikey.conf 주석 블록 추가.
- [x] `env-detect.ts` 보강 — `checkDocling` 추가, `hasDocling` · `doclingVersion` 필드. PATH 자동 보강(`/opt/homebrew/bin:/usr/local/bin`).
- [x] 설정 탭 Environment 섹션에 Docling 상태 라인 추가 + Install Guide 버튼.

#### 4.1.1.2 unhwp 통합 (Tier 1b 메인, HWP/HWPX)

- [x] 파일 확장자 기반 분기 — `.hwp` / `.hwpx` 는 `extractHwpText`로 직행, docling 건너뜀.
- [x] vendored 스크립트 — `scripts/vendored/unhwp-convert.py` 복사 (plugin 자족 운영, 원격 SKILL 의존 회피).
- [x] 이미지 정책 — 공통 `stripEmbeddedImages()` 우선 적용. docling 출력과 동일 placeholder 정책.
- [x] `env-detect.ts`에 `checkUnhwp` (`import unhwp`) 추가 + 설정 탭 "Install unhwp" 버튼 (pip install unhwp).

#### 4.1.1.3 MarkItDown 체인을 fallback으로 강등

- [x] tier 1 MarkItDown → tier 3 fallback으로 이동. 로그 라벨 `tier 3/6 start: markitdown (fallback)`.
- [x] 진행 메시지 `"Extracting (MarkItDown)..."` → `"Extracting (Docling)..."` (ext에 따라 unhwp/Docling 동적).
- [x] settings-tab에서 MarkItDown 항목 desc를 "Fallback converter (used when docling is unavailable)"로 수정.
- [x] 통합 테스트: PMS PDF(3.5MB, 31p)로 5종 변환기 비교 완료 — `activity/phase-4-converter-benchmark-2026-04-21.md`. Docling은 MarkItDown 대비 headings +64 / tables +133 / 이미지 +25 (구조 보존 압도적). 다른 PDF 실측은 후속.

#### 4.1.1.4 변환 결과 캐시 (brief ↔ ingest 공통)

(Phase 3 §14.2 발견 — 48p OMRON: Gemini vision OCR × 2회 = ~$0.08/건)

- [x] 캐시 키: `sha256(sourceBytes) + converter + majorOptions(table_mode/ocr_engine/ocr_lang/image_export_mode)` → `wikey-core/src/convert-cache.ts`.
- [x] 캐시 위치: `~/.cache/wikey/convert/<hash>.md` + `index.json` (TTL 30일, `WIKEY_CACHE_TTL_DAYS` 오버라이드 가능).
- [x] 적용 범위: `extractPdfText` / `extractHwpText` / `extractDocumentText` 진입부에서 getCached, 성공 반환 전 setCached.
- [x] 테스트: 11건 단위 테스트 (computeCacheKey deterministic, TTL 만료 시 자동 삭제, orphan cleanup, stats).

#### 4.1.1.5 OCR API 키 process listing 노출 제거

(Phase 3 §14.2 발견 — `ps aux | grep markitdown`에 `--api-key=...` 평문 노출, 보안 갭)

- [x] `execFile` args에서 `ocr.apiKey` 삭제 → `env` 객체에 `OPENAI_API_KEY` / `OPENAI_BASE_URL` 주입. Python 스크립트는 `os.environ` 참조.
- [x] 적용 위치: tier 2 markitdown-ocr 호출부 + tier 6 page-render Vision OCR 호출부.
- [ ] 실측 검증: 인제스트 중 `ps aux | grep -E "markitdown|docling|ocr"` 결과에 key 미노출 — 실제 인제스트 run 시 확인.

#### 4.1.1.6 변환 품질 감지 및 tier 분기

- [x] `wikey-core/src/convert-quality.ts` — 품질 스코어링(broken table / empty sections / min body chars / korean whitespace loss). 10건 단위 테스트.
- [x] tier 1 docling 출력이 품질 미달 + 한국어 공백 소실 감지 → tier 1b (`docling --force-ocr`) 재시도. 여전히 미달이면 tier 2 폴스루.
- [x] 사용자 오버라이드 **제거** (2026-04-21 재결정) — 사용자 피드백: "UI override 바람직하지 않음, 프로그램 로직으로 자동 판정". Audit 패널의 Converter 드롭다운 제거, Force re-convert 체크박스만 유지 (캐시 bypass 디버그 용). `IngestOptions.converterOverride` / `ConverterOverride` 타입 삭제. `runTier()` 가드도 전면 제거.
- [x] **자동 force-ocr 감지 2개 조건** 추가 (`convert-quality.ts` + `extractPdfText` tier 1 블록):
  - **(a) 웹페이지 → PDF 프린트 패턴** — `koreanLongTokenRatio(md) > 30%` (ROHM Wi-SUN 실측 60.20% 감지)
  - **(b) 스캔 PDF 패턴** — `isLikelyScanPdf(md, pageCount)`: 페이지당 본문 < 100자 AND 한국어 < 50자
  - **(c) regression guard** — force-ocr 결과가 tier 1 대비 한국어 50% 미만이면 tier 1 롤백 (PMS ocrmac 벡터 PDF 독성 방어)
  - 정상 텍스트 PDF (PMS 제품소개 4.93%) 는 retry 스킵 → 불필요한 비용 없음

#### 4.1.1.7 성능 비교 테스트 (정량 baseline)

- [x] `scripts/benchmark-converters.sh` — 확장자별 변환기 매트릭스 (unhwp/docling/docling-force-ocr/markitdown/pdftotext/pymupdf) × bytes·time·korean_loss 측정. docling은 `--output <dir>` 방식으로 처리 (stdout 미지원).
- [x] 1차 실측 완료 — `activity/phase-4-converter-benchmark.md` (PMS_제품소개_R10 PDF). **핵심 발견**: docling-force-ocr는 벡터 PDF에서 한국어 0자 (ocrmac 벡터 래스터화 열화). 자동 재시도는 임계 기반이라 안전.
- [x] 추가 코퍼스 실측 완료 (2026-04-21) — **TWHB 파워디바이스 / OMRON HEM-7600T / 사업자등록증** 3건 추가 벤치마크. OMRON 결정적 케이스(vector-only PDF, MarkItDown 1 byte 실패 vs Docling --force-ocr 9.2KB) 로 `isLikelyScanPdf` 자동 감지 정당성 실증. `activity/phase-4-converter-benchmark.md` 5개 코퍼스 종합 리포트로 확장.

#### 4.1.1.8 변환 결과 캐시 (§4.1.1.4와 통합 구현)

- [x] `convert-cache.ts`에서 stats / cleanup / invalidate API 노출 + index.json 관찰성.
- [x] ~~Audit 패널 "Force re-convert" 체크박스~~ **재결정 (2026-04-21)**: 제거. 전처리~ingest 자동 흐름에서 사용자 검토 루프 없음 → 재변환 판단 근거 없음. 캐시 무효화는 `~/.cache/wikey/convert/` 직접 삭제.
- [ ] CLI: `scripts/cache-stats.sh` — 후속 (명령줄에서 캐시 통계 조회 용). §4.1 범위 외로 이관.

#### 4.1.1.9 md변환 결과 저장, 활용 및 이동

- [x] 변환 완료 시 원본 옆 `<source>.md` sidecar 사본 저장 — pdf/hwp/hwpx/docx/… 전 포맷 (md/txt는 생략). 이미 존재하면 덮어쓰지 않음.
- [ ] `vault.on('rename')` / `vault.on('delete')` 리스너에 sidecar 처리 — §4.2.2 URI 기반 안정 참조 구현과 함께 묶어서 후속 (registry 필요).

---

**Phase 4.1.1 세션 결산 (2026-04-21)**:
- 신규 파일: `wikey-core/src/rag-preprocess.ts`, `convert-cache.ts`, `convert-quality.ts` + 각 테스트 3개, `scripts/vendored/unhwp-convert.py`, `scripts/benchmark-converters.sh`, `plan/phase-4-4-1-agile-crystal.md`
- 변경 파일: `ingest-pipeline.ts` (tier 체인 전면 재구성 + 3개 extract helper), `types.ts` / `config.ts` (DOCLING_* 키), `env-detect.ts` (docling/unhwp 감지), `settings-tab.ts` (Environment 섹션 + 설치 버튼), `wikey.conf` (주석 블록), `index.ts` (export)
- 테스트: 197 → **233 PASS** (+36 : rag-preprocess 15 / convert-cache 11 / convert-quality 10)
- 빌드: wikey-core tsc + wikey-obsidian esbuild 모두 0 errors
- 샘플 검증: docs/samples 4종에 stripEmbeddedImages 적용 → docling PDF 8× / unhwp HWPX 2017× / Web Clipper 외부 URL 1건 모두 계획서 표와 일치
- 후속 (UI 중심): §4.1.1.3 통합 테스트 실측, §4.1.1.5 ps aux 검증, §4.1.1.6 Audit converter override 드롭다운, §4.1.1.7 벤치마크 실측, §4.1.1.9 rename/delete listener (§4.2.2 URI 참조와 합동)
- 해제된 선행 의존: §4.5.1.5 (variance 재개) 가능 — Docling 구조적 markdown 확보 완료

### 4.1.3 Bitmap OCR 본문 오염 차단 + 검증 모듈 설계 확장 (2026-04-22 신규, 진행 전)

> **배경 · 프로세스 오류 확증**. §4.5.1.6 10-run/29-run 측정을 완료한 직후 사용자 지적으로 **근본 오염** 발견. PMS 제품소개 PDF 의 Docling 변환 결과(`raw/.../PMS_*.pdf.md`) 가 UI 스크린샷 · 대시보드 목업 내부의 텍스트를 bitmap OCR 로 추출해 본문 흐름에 **interleave** 함. Docling JSON bbox 분석 결과 **texts 의 56.4% (831/1473) 가 picture 영역 내부에 공간적으로 포함**. §4.5.1.5/6 의 CV 측정이 **오염된 입력 위에서 수행**되었으므로 결과의 상당 부분은 "진짜 LLM variance" 가 아닌 "OCR 파편이 가끔 extracted되는 무작위성" 을 측정했을 가능성.

> **검증 모듈의 설계 결함**. `wikey-core/src/convert-quality.ts::scoreConvertOutput` 은 호출 경로 (`ingest-pipeline.ts:1194/1227/1232`) 와 4 개 signal (`broken-tables`, `empty-sections`, `min-body-chars`, `korean-whitespace-loss`) 을 갖지만, 모든 signal 이 **"text-layer 실패"** 범주만 커버. **"bitmap OCR 이 본문에 interleave"** 범주에 대한 signal 부재. PMS 는 4 개 모두 통과 (korean-long-token 4.93% < 30% 임계) 하여 `accept` 판정을 받고 LLM 파이프라인으로 전달. 이게 **프로세스 오류** — 모듈 존재·호출·flag 모두 정상이나 signal set 이 불완전.

> **설계 의도 재확인** (사용자). Tier 1 은 "문서 인식 (vector text) + 이미지는 base64 embedded, bitmap OCR 없음" 이 원래 의도였음. Docling CLI 기본값 `--ocr` (enabled) 은 bitmap 영역에 OCR 을 적용하므로, 설계 의도를 구현하려면 `--no-ocr` 명시 필요. 현재 코드는 Tier 1 에서 `--no-ocr` 을 누락하여 Docling 기본 bitmap OCR 이 항상 돌고 있었음.

**선행 의존**:
- §4.5.1.6 완료 (2026-04-22) — baseline 24.3% → 9.2% 이 확보되었으나 § 4.1.3 완료 후 재해석 필요.

**gates §4.5.1.7 (§4.1.3 완료가 선행 조건)**.

- [ ] **§4.1.3.1** MD 튜닝 — `buildDoclingArgs` Tier 1 기본을 `--no-ocr` 로 전환 (TDD)
  - `buildDoclingArgs(forceOcr=false, ocrEnabled=false)` → `--no-ocr` 추가 (Tier 1, 설계 의도 일치)
  - 신규 파라미터 `ocrEnabled?: boolean` 추가 → `true` 일 때 `--no-ocr` 생략 (Tier 1a 재시도용)
  - `forceOcr=true` → 기존 동작 유지 (`--force-ocr` + ocr-engine/lang), `--no-ocr` 생략
  - 단위 테스트: Tier 1 args 에 `--no-ocr` 포함 / Tier 1a args 에 `--no-ocr` 없음 / Tier 1b args 에 `--force-ocr` 있음.

- [ ] **§4.1.3.2** Tier 체인 확장 — `extractPdfText` 에 Tier 1a 삽입
  - 순서: **Tier 1 (`--no-ocr`) → Tier 1a (`--ocr`) → Tier 1b (`--force-ocr`) → Tier 2 (markitdown) → ...**
  - Tier 1a 트리거: Tier 1 결과가 `scoreConvertOutput → reject` OR `isLikelyScanPdf(md, pageCount) === true`.
    - 이유: Tier 1 에서 `--no-ocr` 이므로 스캔 PDF 는 본문 extract 실패 → Tier 1a 에서 bitmap OCR 활성화로 복구.
  - Tier 1b 트리거: Tier 1a 결과가 `hasMissingKoreanWhitespace` OR text-layer 전체 공백 소실 패턴.
  - Regression guard: 기존 `hasKoreanRegression` / `hasBodyRegression` 재활용 + Tier 1a/1b 간 비교.
  - 단위 테스트: Tier 1 accept 시 1a 호출 안 함 / Tier 1 reject 시 1a 호출 / 1a accept 시 1b 호출 안 함.

- [ ] **§4.1.3.3** 검증 모듈 signal 추가 — `scoreConvertOutput` 에 `image-ocr-pollution` 추가
  - **설계 원칙 확장**: "text-layer 실패 감지" → "**본문 흐름에 섞인 non-body 콘텐츠 감지**" 로 signal set 의 의미를 넓힘.
  - 신규 signal 구현 (`hasImageOcrPollution(md: string): boolean`):
    - 기준 A: `<!-- image -->` (or `![image](...)`) placeholder 마커 직전·직후 N 라인 윈도우에 **짧은 파편 (<20 자) 클러스터** (3개 이상 연속) 존재.
    - 기준 B: 전체 라인 중 "공백 1개 + 1-3 단어만" 패턴이 > 20% (본문 흐름이라기에는 파편이 과다).
    - 기준 C: 연속 라인에서 한국어 음절/숫자/영자 혼재 비율이 급격히 변동 (본문은 연속, OCR 파편은 이질).
    - 세 기준 중 2개 이상 true → pollution 판정.
  - `scoreConvertOutput` 점수 감점: `-0.4` (Korean whitespace loss 와 동급 — 치명적).
  - Decision: pollution 감지 시 `decision = 'retry-no-ocr'` 또는 `'reject'` (tier chain 이 `--no-ocr` 재시도 또는 fallthrough 결정).
  - 단위 테스트: PMS 기존 polluted MD 로 pollution=true / 정상 MD (TWHB, GOODSTREAM 사업자등록증 등) 로 pollution=false.
  - 통계적 검증: 5 개 벤치마크 코퍼스 전수 검사 → 오탐지/미탐지 비율.

- [ ] **§4.1.3.4** 회귀 테스트 (5 개 벤치마크 코퍼스)
  - PMS (vector PDF + screenshots), ROHM Wi-SUN (korean whitespace loss), TWHB (tables), OMRON HEM-7600T (scan PDF), GOODSTREAM 사업자등록증 (simple).
  - 각 문서에 대해:
    1. 캐시 invalidate (`~/.cache/wikey/convert/<hash>.md` 삭제).
    2. 새 tier 체인 (§4.1.3.1, §4.1.3.2) 으로 재변환.
    3. `scoreConvertOutput` (§4.1.3.3 확장본) 결과 기록.
    4. 본문 품질 육안 검증 — 각 문서의 핵심 섹션·표가 정상 보존되는가.
  - 예상 결과:
    - PMS: Tier 1 (`--no-ocr`) 에서 OCR 파편 제거된 clean 본문 확보, accept.
    - ROHM: Tier 1 (`--no-ocr`) → quality reject (korean whitespace loss 는 vector text 자체 문제) → Tier 1a (`--ocr`) → 여전히 loss → Tier 1b (`--force-ocr`) → accept.
    - OMRON: Tier 1 (`--no-ocr`) → reject (본문 empty, 스캔) → Tier 1a (`--ocr`) 또는 Tier 1b (`--force-ocr`) → accept.
    - TWHB / GOODSTREAM: Tier 1 accept 예상.

- [ ] **§4.1.3.5** PMS 재측정 + §4.5.1.5/6 결과 재해석
  - PMS sidecar `.md` 삭제 + 캐시 invalidate.
  - `./scripts/measure-determinism.sh raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf -n 10 -d` 실행 (10-run).
  - 결과 비교:
    | baseline | Total CV | 입력 상태 |
    |---|---|---|
    | §4.5.1.4 | 32.5% | 오염 |
    | §4.5.1.5 | 24.3% | 오염 |
    | §4.5.1.6 | 9.2% | 오염 |
    | §4.1.3.5 (new) | ? | 깨끗 |
  - 해석:
    - 새 CV < 9.2% → canonicalizer 3차 확장이 실제 효과 있었음 (alias/pin 이 legitimate variant 흡수).
    - 새 CV ≈ 9.2% → 이전 개선의 상당 부분이 OCR 파편 흡수 효과 (alias 가 `22A002` 같은 OCR 파편을 canonical 로 뭉쳤던 것).
    - 새 CV > 9.2% → deeper 문제 (deterministic Phase A/B/C 이행에도 불구, vector text 만으로도 variance 유지).
  - 각 시나리오별 §4.5.1.7 재평가:
    - 새 CV < 5% → §4.5.1.7 대부분 불필요, wrap up.
    - 새 CV 5-10% → §4.5.1.7.2 (Concepts prompt) 만 검토.
    - 새 CV > 10% → §4.5.1.7 전체 sub-task 재평가 (각 task 의 premise 가 살아있는지 확인).

- [ ] **§4.1.3.6** 세션 마감 — 문서 동기화 + commit/push
  - `activity/phase-4-result.md §4.1.3` 상세화 (각 sub-task 증거).
  - `plan/phase-4-todo.md §4.1.3` 체크박스 업데이트.
  - `plan/session-wrap-followups.md` 갱신 (§4.5.1.7 gate 해제 여부 · 다음 우선순위).
  - `wiki/log.md` fix/eval 엔트리.
  - `~/.claude/.../memory/project_phase4_status.md` + MEMORY.md 인덱스.
  - 단일 commit + push.

**§4.5.1.7 에 미치는 영향** (gated):
- §4.5.1.7.1 attribution ablation — §4.5.1.6 의 측정 기반이 오염된 입력이었으므로 baseline 재설정 필요. 깨끗한 MD 위에서 4-points 재측정 시 기여도 비율 가설 완전히 달라질 가능성.
- §4.5.1.7.2 Concepts prompt (PMBOK 9 영역 진동) — PMBOK 영역이 본문에 명확히 나열된 것 vs OCR 파편에 흡수된 것의 구분이 이제야 가능. §4.1.3.5 재측정 후 여전히 진동하면 그때 필요성 검증.
- §4.5.1.7.5 Lotus-prefix variance — OCR 파편 내 `LOTUS` 캡션이 일부 run 에서 entity 화되던 것이라면 자동 해결.
- §4.5.1.7.3 측정 infra / §4.5.1.7.4 Route SEGMENTED / §4.5.1.7.6 BOM / §4.5.1.7.7 log cosmetic — §4.1.3 과 독립. 그대로 유효.

---

## 4.2 분류 및 파일 관리 (inbox → PARA, 이동에 강한 참조)
> tag: #workflow, #core

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

## 4.3 인제스트 (LLM 추출 · 품질 관리)
> tag: #core, #engine, #workflow

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

## 4.4 검색 재현율 · 지식 그래프
> tag: #eval, #core

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

## 4.5 운영 · 안정성
> tag: #ops, #eval

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

- [x] `canonicalize.ts`에 음역 정규화 테이블 (`SLUG_ALIASES`) — `allimtok`/`alrimtok` → `alimtalk` (카카오 공식 표기)
- [x] 약어/동의어 흡수 — `sso-api`/`single-sign-on` → `single-sign-on-api`, `integrated-member-db` → `-database`
- [x] E/C 경계 왕복 3건 `canonicalize.ts` 내 `FORCED_CATEGORIES` + `applyForcedCategories` 후처리로 pin (schema.yaml은 type vocabulary 확장만 가능, instance classification 강제 불가)
- [x] 단위 테스트 11건 추가 — 197 tests PASS
- [~] 5-run 재측정 — **기능 확증 (pin/alias 5/5 run에서 정상 동작), CV 개선 미확증 (Total CV 5.7→32%, 원인은 post-processing 밖의 LLM extraction volume variance)**

#### 4.5.1.5 LLM Wiki Phase A/B/C (v2) — 결정적 Phase A + 2-route + ablation 선행 + TDD

> **설계 문서**: `plan/phase-4-change-phase-abc.md` (v2, 2026-04-21). v1 Codex 적대적 검증 NEEDS-REVISION → v2: Phase A 완전 결정적, Route 2분기, token-budget, 결정적 fallback, ablation 선행, N=30, 모든 verification TDD.
>
> **왜 재정의되었는가**: 원안(§4.5.1.5 v1)은 "chunk 분할 결정성 확인 + 10-run baseline + temperature/seed 재검증 + slug 변이" 였음. 그러나 §4.1 Docling 메인화 완료 직후 철학 재검토에서 **RAG chunk 패턴 자체가 schema §19·§21 배격 대상** 임이 드러나, 과제 범위를 "variance 측정" → "Phase A/B/C 이행 + 사후 variance 재측정" 으로 확장. Codex 교차 검증을 통해 v1(LLM Phase A 분류기) 의 stochastic 증설 위험 지적 수용 → v2(결정적 Phase A) 로 재설계.

**§0 Ablation — 스크립트 완성, 실행은 Obsidian CDP 환경에서 사용자 측 별도 run**

- [x] `scripts/ablation-ingest.sh` 작성 (syntax check OK)
- [x] 실험 1 (Frozen markdown) 경로 — measure-determinism.sh 위임 (convert-cache 로 인해 frozen 자동)
- [ ] 실험 2-4: 현재 ingest-pipeline 내부 export 부재 → 후속 v2.1 infra (별도 Node helper 작성 필요, §4.5.1.5.7 후보로 이관)
- [ ] Obsidian CDP 9222 기동 후 `./scripts/ablation-ingest.sh raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf -n 10` 실행 → gate 판정 (이 세션 범위 외, 사용자 환경)

**§1 Phase A 결정적 파서 (TDD) — 완료**

- [x] RED: parseSections 결정성 (3회 동일 출력)
- [x] RED: heading 패턴 — 0개, `## only`, mixed level, 공백 없는 `##기술스택`, 코드블록 내부 `#` 제외
- [x] RED: 빈 섹션 병합 (threshold 5, plan v1 의 50 은 과도 → 하향) + 반복 page header 감지
- [x] RED: table-only / preamble / heading-0 문서 분기
- [x] RED: computeHeuristicPriority (skip/core/support) 각 분기
- [x] RED: globalRepeaters 결정성 / formatPeerContext token cap / formatSourceTOC
- [x] GREEN: `wikey-core/src/section-index.ts` 구현 (LLM 의존 0)
- [x] REFACTOR: merge-warning propagation 추가
- 검증: `npm test` 273/273 PASS (+22 신규 테스트, 기존 회귀 0)

**§2 Token-budget Route 판정 (TDD) — 완료**

- [x] RED: `estimateTokens` 한국어/영어/mixed (divisor 1.5/2.5/4.0) + 30% margin
- [x] RED: `selectRoute` Gemini/Claude/OpenAI/Ollama 각 provider + PMS 83KB → 기대 Route
- [x] GREEN: `provider-defaults.ts PROVIDER_CONTEXT_BUDGETS` + `estimateTokens` + `selectRoute`
- 검증: 273 → 287 PASS (+14 신규 테스트)

**§3-4 Route 구현 (TDD) — 완료**

- [x] Route FULL 경로: summary + extractMentions(full-doc) + canonicalize (기존 small-doc 경로 재활용)
- [x] Route SEGMENTED 경로: summary + 섹션별 extractMentions + canonicalize
- [x] peer context 주입 (DOC_OVERVIEW/GLOBAL_REPEATERS/CURRENT_SECTION/LOCAL_NEIGHBORS)
- [x] priority=skip 섹션 자동 제외 (target = core ∪ support)
- [x] buildSectionWithPeer helper — SEGMENTED 의 섹션 body + peer context 결합
- [x] truncateSource → TRUNCATE_LIMIT 으로 rename + 섹션 단위 적용 (Ollama)
- 검증: tsc 0 errors, 287 tests PASS 유지

**§5 기존 chunk 제거 + rename (TDD)**

- [x] grep 전수조사: `source_chunk_id` 외부 노출 0 확증 (code 2곳만: types.ts:119, ingest-pipeline.ts:437)
- [x] rename: `Mention.source_chunk_id` → `source_section_idx` (canonicalizer 는 참조 없어 로직 무변경)
- [x] 검증: 273 tests PASS 유지
- [x] `splitIntoChunks` 삭제, large-doc block 제거, `MAX_SOURCE_CHARS` → `TRUNCATE_LIMIT` (Ollama 섹션 hard-cap 용)
- [x] 기존 large-doc 통합 테스트 없음 (기존 테스트는 helper 함수만 다뤘음 — Route 테스트는 섹션/provider-budget 테스트로 분리됨)

**§6 Phase C 근거 데이터 (TDD) — 완료**

- [x] RED: `appendSectionTOCToSource` 3 tests → FAIL
- [x] GREEN: ingest-pipeline.ts `appendSectionTOCToSource` 구현 + source 페이지 작성 경로에 연결
- [x] sidebar UI progress: Route FULL/SEGMENTED + Section i/N 메시지가 자동 전달 (sidebar 는 progress.message 를 투명하게 노출, 별도 수정 불필요)
- 검증: tsc 0 errors, esbuild 0 errors, 290 tests PASS (+3)

**§7 측정 — 2026-04-22 30-run 완료**

- [x] 빌드 게이트: `npm run build:core` (tsc 0) + `build:obsidian` (esbuild 0) + `npm test` (251 → **290 PASS**) fresh 실행 증거 확보
- [x] smoke 3-run (infra 패치 검증): Total CV 11.6% (N=3 → sample variability 큼, N=10+ 가이드 확증)
- [ ] Route FULL (Gemini) / SEGMENTED (Ollama) 분리 10-run 비교 → **§4.5.1.6.5 로 이관**
- [x] 30-run PMS main (Gemini) — Total CV 24.3% (baseline 32.5% 대비 −8.2pp, 상대 −25.2%)
  - 실패 0/30, 평균 5.6분/run, 총 190분
  - Core entities 3/40 (7.5%), Core concepts 4/47 (8.5%) — 매우 낮음
  - Gate ratio 0.748 → "20-50% 기여" 구간 — 섹션 경계 지터는 기여자이나 주범 아님
- [x] 측정 infra 패치 (`scripts/measure-determinism.sh` — audit→chat→audit panel refresh, `selectPanel` re-click guard 우회)

**§8 문서 동기화**

- [x] `activity/phase-4-result.md §4.5.1.5.11~.14` (measurement infra patch + 30-run 결과 + 최종 결론)
- [ ] `wiki/log.md` 엔트리 (이번 turn)
- [ ] `plan/session-wrap-followups.md` §4.5.1.5 측정 완료 선언 + §4.5.1.6 을 다음 과제로 지정 (이번 turn)
- [ ] 단일 commit + push (이번 turn)

#### 4.5.1.6 LLM 수준 variance + canonicalizer 3차 (2026-04-22, 완료)

> **배경**. §4.5.1.5 30-run 측정 결과 Total CV 24.3% — baseline 32.5% 대비 25% 상대 감소했으나 잔여 75% variance 가 LLM 수준 (temperature/seed) + canonicalizer 미도달 패턴에서 발생함을 확증. N=30 데이터에서 `alimtalk` 5-variant, ERP/SCM/MES 3-variant, BOM 5-variant, E/C 경계 왕복 (`electronic-approval(-system)`, `restful-api`/`representational-state-transfer-api`) 등 신규 패턴 발견.

- [x] **§4.5.1.6.1**: Gemini `generationConfig.temperature=0 + seed=42` 옵션 → `wikey-core/src/llm-client.ts` 에 `extractionDeterminism` 플래그 추가 (TDD)
  - `WikeyConfig.WIKEY_EXTRACTION_DETERMINISM?: boolean`, `BOOLEAN_KEYS` 등록
  - `callLLMWithRetry(.., deterministic?)` 로 summary/extractMentions/canonicalize 3 지점 전파
  - Obsidian 플러그인: `WikeySettings.extractionDeterminism`, `buildConfig()` surface, `wikey.conf` 로드
  - 11 신규 tests PASS (config:5, ingest-pipeline:4, canonicalizer:2)
- [x] **§4.5.1.6.2**: determinism=on 조건 10-run 재측정 → Total CV 24.3% → **7.2%** (−70.4% 상대 감소, 목표 <15% 크게 초과 달성). Core entities 8%→58%, concepts 9%→50%. 9/10 run 성공 (1 timeout).
- [x] **§4.5.1.6.3**: `canonicalize.ts SLUG_ALIASES` 3차 확장 (5 → 20 entry)
  - `allim-talk`, `allimtalk`, `kakao-alimtalk` → `alimtalk` (카카오 공식)
  - `erp-system`, `enterprise-resource-planning-system` → `enterprise-resource-planning`
  - `supply-chain-management-system` → `supply-chain-management`
  - `point-of-production(-system)` → `manufacturing-execution-system`
  - `e-bom`, `e-bill-of-materials`, `electronic-bill-of-materials`, `engineering-bill-of-materials` → `bill-of-materials`
  - `electronic-approval-system` → `electronic-approval`
  - `representational-state-transfer-api` → `restful-api`
  - `transmission-control-protocol-internet-protocol` → `tcp-ip`
  - `message-queuing-telemetry-transport` → `mqtt`
  - 8 신규 test block PASS (invariant guard 포함)
- [x] **§4.5.1.6.4**: `FORCED_CATEGORIES` 3차 확장 (3 → 13 pin) — cross-pool 수렴
  - §4.5.1.4 3 pin 유지 (`mqtt`/`restful-api`/`project-management-system`)
  - 신규 10 pin: `enterprise-resource-planning`, `supply-chain-management`, `manufacturing-execution-system`, `product-lifecycle-management`, `advanced-planning-and-scheduling`, `electronic-approval`, `single-sign-on-api`, `tcp-ip`, `virtual-private-network`, `bill-of-materials`
  - SLUG_ALIASES → pin resolution chain 으로 canonical axis 수렴 구현
  - 4 신규 test block PASS
- [~] **§4.5.1.6.5**: Route FULL vs SEGMENTED 10-run 비교 — FULL 에서 목표 <10% 조기 달성으로 **§4.5.1.7 이관** (diagnostic 가치 감소)
- [x] **§4.5.1.6.6**: 개선 후 30-run 재측정 → 29-run valid Total CV **9.2%** (목표 <10% 달성, run 30 툴 edge case outlier). 누적 §4.5.1.5 baseline 24.3% → 9.2% (−62% 상대).

#### 4.5.1.7 variance 분해 + prompt-level 개선 + 측정 인프라 강화 (2026-04-22 신규, 진행 전)

> **배경**. §4.5.1.6 은 3 개 레버 (determinism, SLUG_ALIASES, FORCED_CATEGORIES) 를 **동시** 적용한 결과 Total CV 9.2% 를 확보했으나 **(a) 개별 기여도 미분리**, **(b) Concepts CV 27% 잔여 (Entities 11% 대비 2.4× 높음)**, **(c) 측정 툴 edge case (run 30)** 3 건이 남았다. §4.5.1.7 은 이 3 건을 분리·측정·해결해 **production 용 권장 설정** 과 **N≥30 측정 신뢰성** 을 확보한다.

**필요성**:
- 기여도 미분리 → "determinism 없이도 <10% 유지 가능한가?" 같은 비용-효과 의사결정 불가. Ollama 환경 (seed 미지원) 에선 alias + pin 만으로 충분한지 답 없음.
- Concepts CV 27% → project-management 9 하위 영역 (integration/scope/time/cost/quality/HR/communications/risk/procurement) 이 일부 run 에선 분해, 다른 run 에선 1 개로 묶임. **slug alias 로 해결 불가 — prompt-level 변경 필요**.
- run 30 outlier → raw CV 21.1% 로 왜곡 (29-run valid 9.2% 가 진값). N≥30 대규모 측정 반복 수행을 위해 측정 툴 robustness 필수.

**하위 과제**:

- [ ] **§4.5.1.7.1** variance 분해 측정 — 4 points ablation (10-run 각, 총 ~4시간)
  - point A: all-off (baseline §4.5.1.5 24.3%)
  - point B: determinism-only (WIKEY_EXTRACTION_DETERMINISM=1, SLUG_ALIASES/FORCED_CATEGORIES 는 §4.5.1.4 원본 복구)
  - point C: canon-only (alias + pin 최신, determinism=off)
  - point D: all-on (§4.5.1.6 현재 = 9.2%)
  - 산출: A/B/C/D 4 CV 값 + 단일-레버 기여분 (B-A 차, C-A 차, D-B 차 등)
  - 구현 노트: determinism off 는 측정 CLI 에서 `-d` 미주입, canon off 는 canonicalizer.ts 의 SLUG_ALIASES/FORCED_CATEGORIES 를 feature-flag 로 runtime 제어 필요 (새 env `WIKEY_CANON_V3_DISABLE=1`)

- [ ] **§4.5.1.7.2** Concepts prompt-level 개선 — project-management sub-area 결정화
  - 현 현상: `project-integration/scope/time/cost/quality/human-resource/communications/risk/procurement-management` 9 개가 run 별로 1 (묶음) ↔ 9 (분해) 진동. Concepts CV 27% 의 주 원인.
  - 접근 (A안): canonicalizer prompt 에 "PMBOK 10 knowledge areas 는 **개별 concept** 로 추출, 상위 `project-management-body-of-knowledge` 로 묶지 않는다" 명시.
  - 접근 (B안): FORCED_CATEGORIES 에 9 개 slug 를 모두 concept/methodology 로 pin 하되 prompt 에서도 hint.
  - 접근 (C안): anti-pattern 에 "-management" suffix 는 최상위 `project-management-body-of-knowledge` 로 흡수 추가 (반대 방향 — 묶음 일원화).
  - 선택 기준: entity 그래프 가치 + 검색 정확도 측면에서 분해 (A/B) 가 유리 예상. 단, 측정 필요.
  - 5-run 검증 후 채택.

- [ ] **§4.5.1.7.3** 측정 인프라 robustness — `scripts/measure-determinism.sh` edge case 해소
  - `restoreSourceFile()` 가 `walk(raw/)` 실패 시 silent pass 로 다음 run 진입 → 0/0/0 3s outlier 생성. 수정 방향:
    - `adapter.exists(SOURCE_PATH)` 로 복구 후 존재 확인. absent 이면 `results.push({run, error: 'source restore failed'})` + continue.
    - `walk()` 범위에 `.obsidian/.trash/` 제외. `.md` sidecar 생성 시 같이 따라가는지 점검.
  - per-run timeout 상향 검토 (현 10분 → 15-20분) — §4.5.1.6.2 run10 timeout 재현 관찰.
  - 통계 계산 시 error/zero-output run 자동 제외 옵션 (`--strict`).

- [ ] **§4.5.1.7.4** Route SEGMENTED 10-run baseline — Ollama qwen3:8b 환경의 variance 프로파일
  - 전제: Ollama 설치 + qwen3:8b 모델 pull. `WIKEY_BASIC_MODEL=ollama` 설정.
  - SEGMENTED Route 강제 (PMS 문서 크기에서 Ollama 32K context → 자동 SEGMENTED).
  - determinism=on 조건 (seed 옵션은 Ollama 도 지원). 10-run CV 측정.
  - 가설: SEGMENTED CV > FULL CV (섹션별 호출 간 variance 누적).
  - 실측 후 production 권장 "Gemini + determinism + SEGMENTED (문서가 크면)" vs "Ollama + determinism" 비교.

- [ ] **§4.5.1.7.5** Lotus-prefix 3-variant 분석 — Entities CV 11% 의 주 원인
  - 29-run 관찰: `lotus-pms`/`lotus-scm`/`lotus-mes` 3 개가 일부 run 에서만 동시 등장 (Entities total 28 vs 22).
  - 원인: PMS 문서 기술스택 섹션에 3 제품이 병렬 언급되는데 LLM 이 일관되게 추출 안 함.
  - 해결 방향: (a) PROVIDER 규칙 — "Lotus X" 형식 모두 entity 로, (b) prompt 에 product line 인식 hint, (c) canonicalizer 에 `lotus-*` 그룹 rule.
  - 5-run 측정 후 채택.

- [ ] **§4.5.1.7.6** BOM 축 재분할 판단 — eBOM vs mBOM vs single canonical
  - 현재 (§4.5.1.6.3): `e-bom`/`engineering-bill-of-materials`/`electronic-bill-of-materials`/`e-bill-of-materials` → `bill-of-materials` 일괄 collapse.
  - 실무: eBOM (Engineering BOM, 설계 단계) vs mBOM (Manufacturing BOM, 제조 단계) 은 **다른 문서**. 프로젝트 규모 성장 시 구분 필요.
  - 판단 기준: wiki 가 BOM 을 참조하는 다른 소스 인제스트 시 eBOM/mBOM 을 구별해서 언급하는지 모니터. 월 1 회 lint 에서 확인.
  - 재분할 결정 시 canonical 3 개 (`bill-of-materials`, `engineering-bom`, `manufacturing-bom`) + alias 재구성.

- [ ] **§4.5.1.7.7** `log_entry` axis 불일치 수정 (cosmetic)
  - canonicalizer.ts `assembleCanonicalResult` 의 `logEntry: raw.log_entry` 는 LLM 원본. FORCED_CATEGORIES 로 이동된 slug 는 파일 위치 ↔ log 문구 엇갈림.
  - 수정: pin 후 `pinned.entities` + `pinned.concepts` 로부터 결정적 log body 재생성. 기존 wiki-ops.ts `appendLog` 패턴 참조.
  - TDD: pin 으로 axis 가 바뀐 slug 의 log 엔트리가 "엔티티 생성" → "개념 생성" 으로 올바르게 전환되는지.

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
