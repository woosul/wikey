# Phase 4: 본체 완성 — 원본 → wiki ingest 프로세스 (구조 고정)

> 기간: Phase 3 완료 후
> 전제: Phase 3 (Obsidian 플러그인 + 인제스트 파이프라인 v6) 완료
> **본체 정의 (2026-04-22 확정)**: 원본 → wiki ingest 프로세스가 완성되어 **더 이상 wiki 를 초기화하거나 재생성할 일이 없는** 상태. frontmatter/데이터 모델/워크플로우 구조가 고정되고, 이후 내용은 계속 축적되지만 구조는 변경되지 않는다. 튜닝·고도화·개선·확장은 Phase 5, 웹 인터페이스는 Phase 6 로 이관.
> 구성 원칙: **wiki 시스템 워크플로우 순서대로 정리** — 번호·제목·태그는 `activity/phase-4-result.md` 와 1:1 mirror
> 워크플로우: 소스 감지 → **1. 문서 전처리** → **2. 분류·참조** → **3. 인제스트 (LLM 추출)** → **5. 운영·안정성** (§4.4 검색·그래프는 Phase 5 §5.1/§5.2 로 이관)
> 상태 (2026-04-23 session 3): §4.0/§4.1 완료, §4.5.1 완료, §4.5.1.5 완료 (24.3%), §4.5.1.6 완료 (29-run Total CV **9.2%**, baseline 24.3% 대비 −62% 상대, 목표 <10% 달성), **§4.5.1.7.2/7.3 완료**, **§4.2 Stage 1~4 전량 완료**, **§4.3.2 Part A Provenance data model 완료 + §4.3.3 stripBrokenWikilinks 완료** (wikey-core 352→**437 tests**). 다음 = §4.3.2 Part B (쿼리 응답 원본 backlink) + §4.3.1 (3-stage prompt override) + 통합 smoke → §4.5.2 운영 안전 → 본체 완성 선언.

---

## Phase 5/6 이관 맵 (2026-04-22 재편)

이전에 Phase 4 하위였던 다음 항목들은 본체 완성 정의 ("wiki 재생성 유발하지 않음") 에 해당하므로 **Phase 5 (튜닝·고도화·개선·확장)** 또는 **Phase 6 (웹)** 로 이동. 상세는 해당 파일 참조.

| 이관 전 § (Phase 4) | 이관 후 | 제목 / 사유 |
|---|---|---|
| §4.3.3 증분 업데이트 | → Phase 5 §5.3.1 | source-registry hash 기반 재인제스트 로직. §4.2.2 data model 이 본체에 완비되어 로직만 후속 추가 가능. wiki 재생성 없음. |
| §4.4.1 contextual chunk 재작성 | → Phase 5 §5.1.1 | qmd 인덱스만 재빌드, wiki/ 무관. |
| §4.4.2 지식 그래프 (NetworkX) | → Phase 5 §5.2.1 | 신규 산출물, wiki/ 읽기 전용 소비. |
| §4.4.3 AST 기반 코드 파싱 | → Phase 5 §5.2.2 | 신규 소스 타입, 기존 wiki 무관. |
| §4.5.1.7.1 attribution ablation | → Phase 5 §5.4.1 | diagnostic 측정, 본체 variance 해소 (§4.5.1.7.2/7.3) 이후 선택적. |
| §4.5.1.7.4 Route SEGMENTED | → Phase 5 §5.4.2 | Ollama production guide. |
| §4.5.1.7.6 BOM 재분할 판단 | → Phase 5 §5.4.3 | 월 1 회 모니터 성격. |
| §4.5.1.7.7 log_entry axis cosmetic | → Phase 5 §5.4.4 | 표시 cosmetic, wiki 재생성 없음. |
| §4.5.2 bash→TS 포팅 · qmd SDK import | → Phase 5 §5.7.1/§5.7.2 | 리팩토링, 동작 유지. (§4.5.2 의 삭제 안전장치 + 초기화는 본체 유지) |
| §4.5.3 llama.cpp PoC | → Phase 5 §5.5.1 | provider 추가, 기존 wiki 무관. |
| §4.5.4 rapidocr Linux 실측 | → Phase 5 §5.5.2 | platform 확장, 기존 wiki 무관. |
| §4.5.5 표준 분해 self-extending (4 단계) | → Phase 5 §5.6 | 신규 인제스트만 영향, 기존 wiki 보존. (2026-04-22 본 세션 진행 중인 §4.5.1.7.2 PMBOK 하드코딩이 §5.6 의 Stage 0 사전 검증) |
| 기존 Phase 5 (웹 환경) 전량 | → **Phase 6** (`plan/phase-6-todo.md`) | 웹 인터페이스는 본체·고도화 완료 후. |

**본체 복귀 1 항목**: 이전 분류안에서 잠깐 Phase 5 후보였던 **§4.3.2 Provenance tracking** 은 frontmatter 에 `provenance` 필드 신규 추가 = data model 변경 → wiki 재생성 유발 → Phase 4 본체에 유지 확정.

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
- [x] `vault.on('rename')` / `vault.on('delete')` 리스너에 sidecar 처리 — **§4.2.4 Stage 4 S4-1/S4-2 에서 자동 해소 (2026-04-23)**. main.ts 에서 RenameGuard + reconcileExternalRename + handleExternalDelete 배선 + 200ms debounce + sidecar 자동 동행.

---

**Phase 4.1.1 세션 결산 (2026-04-21)**:
- 신규 파일: `wikey-core/src/rag-preprocess.ts`, `convert-cache.ts`, `convert-quality.ts` + 각 테스트 3개, `scripts/vendored/unhwp-convert.py`, `scripts/benchmark-converters.sh`, `plan/phase-4-4-1-agile-crystal.md`
- 변경 파일: `ingest-pipeline.ts` (tier 체인 전면 재구성 + 3개 extract helper), `types.ts` / `config.ts` (DOCLING_* 키), `env-detect.ts` (docling/unhwp 감지), `settings-tab.ts` (Environment 섹션 + 설치 버튼), `wikey.conf` (주석 블록), `index.ts` (export)
- 테스트: 197 → **233 PASS** (+36 : rag-preprocess 15 / convert-cache 11 / convert-quality 10)
- 빌드: wikey-core tsc + wikey-obsidian esbuild 모두 0 errors
- 샘플 검증: docs/samples 4종에 stripEmbeddedImages 적용 → docling PDF 8× / unhwp HWPX 2017× / Web Clipper 외부 URL 1건 모두 계획서 표와 일치
- 후속 (UI 중심): §4.1.1.3 통합 테스트 실측, §4.1.1.5 ps aux 검증, §4.1.1.6 Audit converter override 드롭다운, §4.1.1.7 벤치마크 실측, §4.1.1.9 rename/delete listener (§4.2.2 URI 참조와 합동)
- 해제된 선행 의존: §4.5.1.5 (variance 재개) 가능 — Docling 구조적 markdown 확보 완료

### 4.1.3 Bitmap OCR 본문 오염 차단 + 검증 모듈 설계 확장 (2026-04-22, 구현 완료 / §4.1.3.5 측정 진행)

> **배경 · 프로세스 오류 확증**. §4.5.1.6 29-run 측정 완료 직후 사용자 지적으로 **근본 오염** 발견. PMS 제품소개 PDF 의 Docling 변환 결과(`raw/.../PMS_*.pdf.md`) 가 UI 스크린샷 · 대시보드 목업 내부의 텍스트를 bitmap OCR 로 추출해 본문 흐름에 **interleave**. Docling JSON bbox 분석 결과 **texts 의 56.4% (831/1473) 가 picture 영역 내부에 공간적으로 포함**. §4.5.1.5/6 의 CV 측정이 **오염된 입력 위에서 수행**되었으므로 결과의 상당 부분은 "진짜 LLM variance" 가 아닌 "OCR 파편이 가끔 extracted되는 무작위성" 을 측정했을 가능성.

> **검증 모듈의 설계 결함 → 해소**. `scoreConvertOutput` 4 signal (`broken-tables`, `empty-sections`, `min-body-chars`, `korean-whitespace-loss`) 은 모두 "text-layer 실패" 범주로 PMS 같은 bitmap OCR interleave 케이스를 감지 못함. §4.1.3.2 에서 **5번째 signal `image-ocr-pollution` 추가** + decision enum 에 `'retry-no-ocr'` 추가로 해소.

> **루틴 아키텍처 (재확정, 2026-04-22)**. "docling 기본값 → 결과 검증 → 실패 유형별 escalation":
>   - Tier 1 (`default`) = docling CLI 기본값 그대로 유지 (사용자 원칙 — 기본값 먼저 시도)
>   - `retry-no-ocr` (pollution) → Tier 1a (`--no-ocr`) 비교 후 채택
>   - `retry` (korean loss) OR `isScan` → Tier 1b (`--force-ocr`) + regression guard

**선행 의존**:
- §4.5.1.6 완료 (2026-04-22) — baseline 24.3% → 9.2% 이 확보되었으나 § 4.1.3 완료 후 재해석 필요.

**gates §4.5.1.7 (§4.1.3.5 측정 결과에 따라 sub-task premise 재평가)**.

- [x] **§4.1.3.1** `buildDoclingArgs` mode 파라미터 (TDD)
  - `DoclingMode = 'default' | 'no-ocr' | 'force-ocr'` 타입 export.
  - `'default'`: ocr-engine/lang 포함, `--no-ocr`/`--force-ocr` 없음 (docling CLI 기본값).
  - `'no-ocr'`: `--no-ocr` 만, ocr-engine/lang 생략.
  - `'force-ocr'`: `--force-ocr` + ocr-engine/lang.
  - `doclingMajorOptions` 에 `mode` 필드 추가 → Tier 1 / 1a / 1b 캐시 키 분리.
  - 증거: `wikey-core/src/__tests__/ingest-pipeline.test.ts` 5 신규 테스트 통과.

- [x] **§4.1.3.2** `scoreConvertOutput` `image-ocr-pollution` signal + `retry-no-ocr` decision
  - `hasImageOcrPollution(md)` 신규 — 필터(`bodyChars ≥ 2000` AND `markerCount ≥ 5`) + 기준 A(마커 ±5 window 내 <20자 라인 3연속) + 기준 B(전체 <20자 파편 비율 > 50%) OR 조합.
  - `scoreConvertOutput` decision 에 `'retry-no-ocr'` 추가, score 감점 `−0.4` (koreanLoss 동급).
  - 우선순위: `koreanLoss > pollution > score-based`.
  - 증거: `wikey-core/src/__tests__/convert-quality.test.ts` 13 신규 테스트 통과. 4 코퍼스 실측 캘리브레이션 (PMS 62.5% pollution ✓, ROHM 42.7%/GOODSTREAM 60%는 bodyChars·markerCount 필터 또는 koreanLoss 우선 처리로 false positive 방어).

- [x] **§4.1.3.3** `extractPdfText` 에 Tier 1a 삽입
  - `quality.decision === 'retry-no-ocr'` 분기 추가 → `buildDoclingArgs(..., 'no-ocr')` 실행.
  - Tier 1a score > Tier 1 score → Tier 1a 채택. 반대면 Tier 1 유지 (false positive 방어).
  - Tier 1a 실패 (exception / 본문 < 50자) → Tier 1 유지.
  - 기존 Tier 1b (`retry` / `isScan`) 경로는 변경 없음, regression guard 유지.
  - 증거: wikey-core 빌드 0 errors, 전체 335 tests PASS (+20 vs 315 이전 baseline).

- [x] **§4.1.3.4** Tier chain 회귀 벤치마크 (4 코퍼스 — docs/samples 2 + raw 2)
  - 스크립트: `scripts/benchmark-tier-4-1-3.mjs` (신규). Tier 1 → decision 분기 → Tier 1a/1b 자동 실행 → 최종 채택 MD 를 원본 옆 sidecar `.md` 에 저장.
  - 대상: PMS (pollution), ROHM (koreanLoss), RP1 (영문 vector), GOODSTREAM (단순). OMRON/TWHB 는 실행 시간 이유로 본 라운드 제외.
  - 결과 (`activity/phase-4-1-3-benchmark-2026-04-22.md`):
    - PMS: Tier 1 `retry-no-ocr` → **Tier 1a `1a-docling-no-ocr` accept**, lines 1922 → **532 (−72%)**, score 0.53 → 0.91.
    - ROHM: Tier 1 `retry` → Tier 1b `1b-docling-force-ocr` accept, score 0.56 → 0.94.
    - RP1: Tier 1 `accept`, score 0.93.
    - GOODSTREAM: Tier 1 `accept`, score 1.00.
  - Sidecar 4개 생성: `raw/0_inbox/PMS_*.pdf.md`, `docs/samples/ROHM_*.pdf.md`, `docs/samples/rp1-peripherals.pdf.md`, `raw/0_inbox/사업자등록증*.pdf.md`.

- [x] **§4.1.3.5** PMS 재측정 + §4.5.1.5/6 결과 재해석 (완료)
  - 10/10 success, 평균 252.6s/run. 결과: **Total CV 10.3%, Entities CV 2.3%, Concepts CV 24.6%**.
  - 비교: §4.5.1.6 29-run 9.2% (오염) vs §4.1.3.5 10-run 10.3% (깨끗) — 거의 동일 (+1.1pp). **canonicalizer 3차 확장 + determinism 이 실제 legitimate variance 를 잡았음 확증**.
  - Entities CV 11.1% → 2.3% 로 대폭 개선 — OCR 파편 제거 효과가 entity 경계 안정화에 직결.
  - Concepts CV 27.0% → 24.6% 로 소폭 — PMBOK 9 영역 진동이 legitimate LLM variance (깨끗한 MD 로도 남음).
  - §4.5.1.7 gate 판정: §4.5.1.7.2 (Concepts prompt, PMBOK 9 영역 강제 나열) **필수**. §4.5.1.7.5 (Lotus variance) **불필요** (Entities 이미 해결). §4.5.1.7.1 (attribution) 재평가.
  - 산출물: `activity/phase-4-1-3-5-pms-10run-clean-2026-04-22.md`, `activity/phase-4-result.md §4.1.3.5` 전체 매트릭스.

- [x] **§4.1.3.6** 세션 마감 — 문서 동기화 + commit/push
  - `activity/phase-4-result.md §4.1.3` 상세화 ✓
  - `plan/phase-4-todo.md §4.1.3` 체크박스 업데이트 ✓ (이 파일)
  - `plan/session-wrap-followups.md` 갱신 — §4.5.1.7 gate 는 §4.1.3.5 측정 완료 시 해제.
  - `wiki/log.md` fix/eval 엔트리.
  - `~/.claude/.../memory/project_phase4_status.md` + MEMORY.md.
  - 단일 commit + push.

**§4.5.1.7 에 미치는 영향** (gated):
- §4.5.1.7.1 attribution ablation — §4.5.1.6 의 측정 기반이 오염된 입력이었으므로 baseline 재설정 필요. 깨끗한 MD 위에서 4-points 재측정 시 기여도 비율 가설 완전히 달라질 가능성.
- §4.5.1.7.2 Concepts prompt (PMBOK 9 영역 진동) — PMBOK 영역이 본문에 명확히 나열된 것 vs OCR 파편에 흡수된 것의 구분이 이제야 가능. §4.1.3.5 재측정 후 여전히 진동하면 그때 필요성 검증.
- §4.5.1.7.5 Lotus-prefix variance — OCR 파편 내 `LOTUS` 캡션이 일부 run 에서 entity 화되던 것이라면 자동 해결.
- §4.5.1.7.3 측정 infra / §4.5.1.7.4 Route SEGMENTED / §4.5.1.7.6 BOM / §4.5.1.7.7 log cosmetic — §4.1.3 과 독립. 그대로 유효.

---

## 4.2 분류 및 파일 관리 (inbox → PARA, pair 이동·registry·listener)
> tag: #workflow, #core
> 상세 계획: `plan/phase-4-2-plan.md` (v3, 2026-04-22 codex 검증 반영).
> **v3 핵심 변경**: URI 저장 폐기 → `source_id` + `vault_path` 만 저장. URI 는 view-time derive (`obsidian://open?...` / `file://...`). 번들 id 는 내부 relative path 기반으로 이동 무관 불변.

#### 사용자 제약 (2026-04-22)

원본 (`.pdf`/`.xls[x]`/`.hwp[x]`/`.doc[x]`/`.ppt[x]`) + `<원본>.<ext>.md` sidecar 가 생긴 경우, 시스템 자동 이동(auto-classify, Audit Apply, bash `--move`, vault `on('rename')`) 시 반드시 pair 로 함께 이동. 사용자 수동 이동은 예외.

### 4.2.1 Stage 1 — ID & vault_path foundation (registry) — **완료 (2026-04-23)**

- [x] **S1-1** `wikey-core/src/uri.ts` — `computeFileId(bytes)`, `computeBundleId(entries[])` (번들 내부 relative path 기반), `computeExternalId(uri)`, `buildObsidianOpenUri`, `buildFileUri`, `formatDisplayPath`, `verifyFullHash(prefix, full, bytes)`. vitest **17** (목표 12 초과 달성).
- [x] **S1-2** `wikey-core/src/source-registry.ts` — `.wikey/source-registry.json` CRUD + `findByIdPrefix` (full-hash verify 내장), `findByPath`, `findByHash`, `upsert`, `recordMove`, `recordDelete`, `restoreTombstone`, `reconcile(walker)`. vitest **12**.
- [x] **S1-3** `ingest-pipeline.ts` + `wiki-ops.ts` — source 페이지 frontmatter 를 v3 §2.3 포맷(`source_id` + `vault_path` + `sidecar_vault_path` + `hash` + `size` + `first_seen`)으로 작성. registry 기록은 ingest 직후 + 이동 전. URI 필드 저장 X. vitest +**7** (wiki-ops.test.ts 확장, injectSourceFrontmatter 3 + rewriteSourcePageMeta 4).
- [x] **S1-4** `scripts/migrate-ingest-map.mjs` — `.ingest-map.json` 존재 시 경로 키 → hash 재계산 → registry. **`scripts/measure-determinism.sh` 의 ingest-map 참조도 registry cleanup 으로 교체 완료**.

### 4.2.2 Stage 2 — Pair move + frontmatter rewrite — **완료 (2026-04-23)**

- [x] **S2-1** `wikey-core/src/classify.ts` — `movePair` async export (기존 `moveFile` 은 legacy 유지). registry 경유 이동 + post-move frontmatter rewrite. vitest **8**.
- [x] **S2-2** `wikey-core/src/wiki-ops.ts` — `rewriteSourcePageMeta(pagePath, {vault_path, sidecar_vault_path?})` YAML safe-edit (S1-3 과 묶어 구현).
- [x] **S2-3** 플러그인 `commands.ts` `autoMoveFromInbox` 분기 → `movePair` 전환. `updateIngestMapPath` 호출 제거 (registry 가 대체).
- [x] **S2-4** 플러그인 `sidebar-chat.ts` Audit Apply → `movePair` 전환.
- [x] **S2-5** `scripts/registry-update.mjs` 신규 CLI — `--record-move`, `--record-delete`, `--find-by-path`, `--find-by-hash`. atomic write (tmp + renameSync). bash 가 Obsidian 오프라인에서도 registry 즉시 갱신 (codex High #4 반영).
- [x] **S2-6** `scripts/classify-inbox.sh --move` — pair 감지 후 원본 + sidecar `mv` + `registry-update.mjs --record-move` 호출. trailing slash·directory·file 분기 모두 처리.
- [x] **S2-7** `scripts/lib/classify-hint.sh` — sidecar 존재 시 힌트에 `(+ sidecar)` 표시.
- [x] **Integration** `__tests__/integration-pair-move.test.ts` — ingest → movePair → frontmatter rewrite → registry 정합 E2E + reconcile mock. vitest **3**.
- [x] **Bash smoke** `scripts/tests/pair-move.smoke.sh` — Obsidian 미실행 상태에서도 registry 즉시 갱신 검증. 2 케이스 (6 assertion) 모두 PASS.

### 4.2.3 Stage 3 — 분류 정제 (LLM 3/4차, 모델 키, UI, 피드백) — **완료 (2026-04-23 session 2)**

(v2 의 §4.2.1 LLM 파트 흡수. 상세 결과: `activity/phase-4-result.md §4.2.8`.)

- [x] **S3-1** `classifyWithLLM` 프롬프트 — 4차 제품 slug 힌트 강화 (vitest 5 green)
  - `listExistingSlugFolders(wikiFS, hint2nd)` — `NNN_topic` 정규식 + basename 정규화 (Obsidian full-path / mock bare-name 모두 대응) + 정렬 후 prompt 블록 inject.
  - 신규 slug 제안 시 `reason` 에 `신규: <근거>` 명시 강제.
  - 출력 스키마 무변경.
- [x] **S3-2** `CLASSIFY_PROVIDER` / `CLASSIFY_MODEL` 설정 키 (vitest 4 green)
  - `WikeyConfig` 두 optional 필드 추가 (`types.ts`).
  - `resolveProvider` case `'classify'` — PROVIDER 미지정 시 `ingest` 승계, MODEL 만 override 가능 (양 경로 모두).
  - `wikey.conf` 주석 블록에 `gemini-2.0-flash-lite` / `gpt-4o-mini` 저가 모델 예시 등재.
- [x] **S3-3** Audit 패널 "Re-classify with LLM" 토글
  - `sidebar-chat.ts` Audit row 에서 `hint.needsThirdLevel === true` 인 경우에만 `.wikey-audit-reclass-line` 체크박스 DOM 추가.
  - `WikeyChatView.inboxReclassify: Map<string, boolean>` 상태 — 패널 재렌더 시 초기화.
  - Apply 플랜 루프: `dest === 'auto' || reclassifyForced` 분기 → `classifyFileAsync` 호출해 dest override.
  - styles.css 업데이트 — purple accent hover caption.
- [x] **S3-4** CLASSIFY.md 피드백 append (vitest 4 green)
  - `wiki-ops.ts::appendClassifyFeedback` — 파일 신규 생성 / 섹션 신설 / 섹션 내 append / 마지막 엔트리 동일 dedupe.
  - sidebar-chat.ts: `reclassifyForced && dest !== 'auto' && llmDest !== dest` 일 때 호출. warn-only 실패 처리.

### 4.2.4 Stage 4 — Vault listener + startup reconciliation (§4.1.1.9 [ ] 해소 포함) — **완료 (2026-04-23 session 2)**

§4.1.1.9 두 번째 체크박스(`vault.on('rename')` / `vault.on('delete')` sidecar 처리) 자동 해소. 상세 결과: `activity/phase-4-result.md §4.2.9`.

- [x] **S4-1** `main.ts` `vault.on('rename', (file, oldPath) => …)`
  - Pure helper 분리: `wikey-core/src/vault-events.ts::RenameGuard` (TTL 기반 큐) · `reconcileExternalRename({wikiFS, old, new, sidecarNew?})` — vitest 9 green.
  - movePair 에 `renameGuard?` optional 파라미터 추가. 원본·sidecar 각 rename 직전 `register` → 리스너 `consume` 일치 시 skip.
  - main.ts: 200ms `renameDebouncers` Map + sidecar 자동 동행 (`fileManager.renameFile`) + STARTUP_GRACE_MS 초기 skip.
- [x] **S4-2** `vault.on('delete')`
  - `wiki-ops.ts::appendDeletedSourceBanner` — frontmatter 보존 + idempotent + 파일 부재 no-op (vitest 3 green).
  - `vault-events.ts::handleExternalDelete` — registry recordDelete + ingested_pages banner append (vitest 3 green).
  - main.ts `handleVaultDelete` 호출. 재등장 복원은 S4-3 reconcile 이 담당.
- [x] **S4-3** `main.ts` onload → `registry.reconcile(walker)` startup scan
  - `source-registry.ts::reconcile` 확장: missing → tombstone / tombstoned + 재등장 → restore + recordMove / 현 경로 일치 → idempotent (vitest +4 green, 13 → 16).
  - main.ts `runStartupReconcile()` — `app.vault.getFiles()` 중 `raw/` prefix + `size ≤ 50MB` 필터 → `readBinary` → walker. 변동 시 save + console summary.
- [x] **S4-4** Audit 파이프라인 hash 기반 "이동만 됨" 판정
  - ingest-pipeline.ts 는 이미 `registryFindById(id)` (hash 기반) 로 중복 감지 — 추가 변경 불필요.
  - `commands.ts::saveIngestMap` 진입 시 `_ingestMapWarnOnce` 플래그 기반 1회 deprecation warn.
  - `scripts/audit-ingest.py` hash 보강은 Phase 5 §5.3 범위.
- [x] **링크 안정성 회귀선** — `integration-pair-move.test.ts` +2 (사용자 2026-04-23 지적 반영)
  - 원본 파일 이동 후 entity/concept 페이지 `[[source-xxx]]` wikilink / 본문 bit-identical 확인.
  - 외부 mv + reconcile 경로에서도 동일 불변성 유지.

### 4.2.5 호환성 전략

- 현재 `wiki/sources/` 비어있음 (2026-04-22 확인) + `.ingest-map.json` 없음 → 마이그레이션 no-op. S1-4 스크립트는 장래 복구용.
- `moveFile` 은 Stage 2 에서 deprecated wrapper 로 유지. Phase 5 에 제거.
- 경로 기반 API (frontmatter `raw_original_path`, Audit 경로 매칭) 는 Stage 4 에서 warning only. 완전 제거는 Phase 5 §5.3.

### 4.2.6 범위 밖 — Phase 5 이관

- 경로 기반 API 완전 제거 → §5.3.
- CLASSIFY.md `.meta.yaml` 외부 URI 패턴 (Confluence/SharePoint) → §5.7.
- LLM 피드백 few-shot 자동 재프롬프트 → §5.6.

---

## 4.3 인제스트 (LLM 추출 · 품질 관리)
> tag: #core, #engine, #workflow

### 4.3.1 인제스트 프롬프트 시스템 (3-stage 전부 override) — **다음 세션 착수**

현재 v7-5까지: `.wikey/ingest_prompt.md` (Stage 1 summary) + `.wikey/schema.yaml` (schema 타입) override 지원. Stage 2/3 미지원.

상세 설계: `plan/phase-4-3-plan.md §4 + §4.5`.

- [ ] **3-stage 프롬프트 완전 분리** (계획 확정, 구현 다음 세션)
  - `.wikey/stage1_summary_prompt.md` (source_page 요약) — 기존 `ingest_prompt.md` 에서 rename (심볼릭 링크 호환 유지)
  - `.wikey/stage2_mention_prompt.md` (chunk → Mention 추출)
  - `.wikey/stage3_canonicalize_prompt.md` (canonicalizer schema 결정)
- [→ Phase 5 §5.6] **도메인별 프리셋** — 기술문서 / 논문 / 매뉴얼 / 회의록 / 제품 스펙. self-extending 자동 프리셋 선택과 중복 → Phase 5 이관.
- [→ Phase 5 §5.4] **추출 기준 명확화** — 모델 간 결과 일관성 baseline. variance diagnostic 과 함께 측정 → Phase 5 이관.
  - entity: "고유명사 단위 1개 = 1페이지" (제품명, 기관명, 규격명)
  - concept: "핵심 개념 최대 N개" (세부 변형은 본문 설명으로 흡수)
  - granularity: Qwen3(27E) vs Gemini(46E) 수준 차이 방지 가이드라인
  - 프롬프트에 예시 entity/concept 목록 포함 (few-shot)
  - 모델별 결과 품질 baseline 정의 + 검증 테스트
- [ ] 설정 탭 Ingest Prompt 섹션 확장 — 3개 prompt 모두 Edit/Reset 버튼 + "적용 여부" 상태 표시
- [ ] `wikey-core/src/canonicalizer.ts:buildCanonicalizerPrompt` 시그니처 확장 — **optional 파라미터** `overridePrompt?: string` (backward compat). `ingest-pipeline.ts` Stage 2 mention extractor 에도 override 주입.

### 4.3.2 Provenance tracking — frontmatter + 쿼리 응답 원본 backlink 렌더링 (본체 필수)

> **본체 포함 근거 (2026-04-22)**: 이 항목은 wiki 페이지 프론트매터에 `provenance` 필드를 신규 추가하는 **data model 변경**이다. Phase 5 로 미루면 Phase 4 내에 쌓인 wiki 페이지는 provenance 필드 없이 존재하게 되고, Phase 5 도입 시점에 전체 wiki 재인제스트가 필요해져 본체 정의 ("wiki 재생성 없음") 를 직접 위반한다. 따라서 Phase 4 본체에 포함 확정.
>
> **범위 확장 (2026-04-22, 사용자 요청)**: data model (frontmatter `provenance` 필드) 뿐 아니라 **쿼리 응답에서 원본 파일 backlink 렌더링** 까지 포함. wiki 계층이 본체 완료 선언 시점에 "근거 체인이 원본 파일까지 닿는 citation UX" 를 갖춘 상태가 되어야 본체 정의 ("원본 → wiki ingest 프로세스 완성") 와 정합. 현재는 답변이 wiki 페이지 wikilink 까지만 걸리고 `wiki/sources/source-*.md` 의 `> 원시 소스: raw/...` 라인을 한 번 더 펼쳐봐야 원본에 닿음 — 3-hop → 1-hop 단축. 철학 점검: citation/provenance 강화 방향, raw/ 불변성 유지 (읽기 링크만).

**Part A — frontmatter `provenance` data model** (§4.2.2 완료 이후) — **완료 (2026-04-23 session 3)**:

- [x] **추출된 관계에 출처 표시** (전부 프론트매터 `provenance: { type, ref, confidence? }` 배열로 저장)
  - `EXTRACTED`: 소스에서 직접 발견 → `{ type: 'extracted', ref: 'sources/<source_id>' }` — MVP 에서 전량 이 type 자동 주입
  - `INFERRED`: LLM 이 추론 → `{ type: 'inferred', confidence: 0.0~1.0, ref: '...' }` — 타입 enum 만 포함 (실제 판정 로직은 Phase 5 §5.4 variance diagnostic)
  - `AMBIGUOUS`: 리뷰 필요 → `{ type: 'ambiguous', reason: '...', ref: '...' }` — 타입 enum 만 포함, Accept/Reject UI 는 Phase 5 §5.4
- [x] **위키 페이지 프론트매터 스키마 확장** — `provenance` 필드 (optional array) 를 entities/concepts/analyses 공통 스키마에 추가. `wiki-ops.ts::injectProvenance` vitest +3 green.
- [→ Phase 5 §5.4] **Audit 패널에서 AMBIGUOUS 항목 리뷰 UI** — accept/reject/edit. Phase 4 본체에서는 data model (type='ambiguous' + reason) 만 확정, 리뷰 UI 는 variance diagnostic 과 함께 Phase 5 에서 구축.
- [x] **§4.2.2 URI 참조 연계** — `ref` 값은 `sources/<source_id>` (hash 기반, PARA 이동 불변). ingest-pipeline.ts 가 자동 주입.
- [x] **Phase 5 §5.6.3 Stage 3 (in-source self-declaration) 전제** — `ProvenanceType` union 에 `'self-declared'` 포함 (Phase 5 에서 optional 필드만 추가하면 됨, breaking change 없음).

**Part B — 쿼리 응답 원본 backlink 렌더링** (Part A + §4.2.2 source-registry 완료 이후) — **다음 세션 착수**:

- [ ] **`wikey-core/src/source-resolver.ts` 신규** — `resolveSource(wikiFS, vaultName, absoluteBasePath, sourceIdOrRef) → ResolvedSource | null`. 내부에서 `loadRegistry` → `findById` (prefix 관용 + full-hash verify) → tombstone 체크 → URI derive. vitest 4 목표 (존재/미등록/tombstone/PARA 이동 후 해석).
- [ ] **`wikey-core/src/query-pipeline.ts` 응답 구조화** — `QueryResult` 에 optional `citations?: Citation[]` 추가. searchResults 각 페이지의 frontmatter parse → `provenance[].ref` → source_id dedupe → Citation 1건. 기존 `sources` 필드 유지 (backward compat). vitest +2.
- [ ] **`wikey-obsidian/src/sidebar-chat.ts` 응답 렌더링** — 답변 렌더링 시 wikilink 는 **주 링크** (기존 유지), 원본 파일은 **보조 링크** (📄 아이콘 + 괄호 안 파일명 같은 약한 affordance) 로 배치. 클릭 핸들러 (plan v2 §3.3 — Electron renderer 호환 API):
  - 내부 vault 파일: `app.workspace.openLinkText(vaultPath, '')` — Obsidian 이 라우팅 (PDF/MD/IMG 내장 뷰어, 기타 기본 앱 위임)
  - 외부 앱 위임 필요: `app.openWithDefaultApp(vaultPath)` (Obsidian 1.5+), fallback `window.open('file://'+absolutePath)`
  - 외부 URI (`uri-hash:*`): `window.open(uri, '_blank', 'noopener')`
  - tombstone: `Notice('원본 삭제됨 (registry tombstone)')`, 버튼 disabled + opacity 0.4
- [ ] **철학 가드 — wiki 계층 우회 방지** — 보조 링크 `0.68em` + `opacity: 0.7` + `aria-label="원본 파일 열기: <filename>"`. 색약 사용자는 아이콘 + 텍스트 조합. wikilink 보다 덜 강조. `wiki/analyses/self-extending-wiki.md` 의 "경계" 궤와 동일 — 원본은 "검증용" 포지션.
- [ ] **통합 smoke** — 실제 PMS PDF 인제스트 1회 → 쿼리 실행 → 답변 wikilink 뒤 📄 표시 + 클릭 시 원본 PDF 열림 확인.

### 4.3.3 stripBrokenWikilinks 자동 적용 (source_page 본문) — **완료 (2026-04-23 session 3)**

(Phase 3 §14.5 발견 — OMRON 261 건 한국어 wikilink 수동 cleanup)

- [x] 현재 canonicalizer 는 entity/concept 페이지 + log entry 에만 적용
- [x] 누락: Stage 1 summary 가 생성하는 source_page 본문 wikilink → 해소
- [x] 위치: `ingest-pipeline.ts` 의 canonicalize 완료 후 + Preview 모달 호출 이전 지점
- [x] writtenPages 기반 정리 → canonical 페이지에 없는 wikilink 는 텍스트로 강등. `keepBases` = entity/concept/source 페이지 filename 의 normalized base Set.
- [x] **Preview/저장본 bit-identical 보장** (plan v2 §5.2 self-review #3 반영) — Stay-involved Preview 가 strip 후 content 를 표시하므로 사용자가 본 내용과 fs 저장본이 동일.

**§4.3 에서 Phase 5 로 이관**: 기존 §4.3.3 증분 업데이트 (hash diff 재인제스트 로직) → Phase 5 §5.3.1. §4.2.2 source-registry 의 hash 필드는 본체에 포함되므로 Phase 5 에서 로직만 추가 가능.

---

## 4.4 (이관됨) — 검색 재현율 · 지식 그래프

> 2026-04-22 재편으로 Phase 5 이관. 전량 "wiki 재생성을 유발하지 않는" 범주 (인덱스만 재빌드 / 신규 산출물 / 신규 소스 타입).
>
> - 기존 §4.4.1 Anthropic contextual chunk 재작성 → **Phase 5 §5.1.1**
> - 기존 §4.4.2 지식 그래프 (NetworkX) → **Phase 5 §5.2.1**
> - 기존 §4.4.3 AST 기반 코드 파싱 → **Phase 5 §5.2.2**
>
> 상세는 `plan/phase-5-todo.md`.

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

#### 4.5.1.7 variance 분해 + prompt-level 개선 + 측정 인프라 강화 (2026-04-22 신규, 본체는 §4.5.1.7.2/7.3 두 항목만)

> **배경**. §4.5.1.6 은 3 개 레버 (determinism, SLUG_ALIASES, FORCED_CATEGORIES) 를 **동시** 적용한 결과 Total CV 9.2% 를 확보했으나 **(a) 개별 기여도 미분리**, **(b) Concepts CV 27% 잔여 (Entities 11% 대비 2.4× 높음)**, **(c) 측정 툴 edge case (run 30)** 3 건이 남았다. 본체 스코프는 **Concepts CV 잔여 해소 (7.2)** 와 **측정 툴 robustness (7.3)** 만. 기여도 분해·Route/BOM/log cosmetic 같은 diagnostic 은 Phase 5 §5.4 로 이관.

**필요성** (본체 범위):
- Concepts CV 27% → project-management 9 하위 영역 (integration/scope/time/cost/quality/HR/communications/risk/procurement) 이 일부 run 에선 분해, 다른 run 에선 1 개로 묶임. **slug alias 로 해결 불가 — prompt-level 변경 필요** (§4.5.1.7.2).
- run 30 outlier → raw CV 21.1% 로 왜곡 (29-run valid 9.2% 가 진값). N≥30 대규모 측정 반복을 위해 측정 툴 robustness 필수 (§4.5.1.7.3).

**본체 스코프** (§4.5.1.7.2/7.3 실측만 남음):

- [→ Phase 5 §5.4.1] **§4.5.1.7.1** variance 분해 4-points ablation — diagnostic 성격, 본체 CV <10% 확보 후 선택적 측정. (상세는 `plan/phase-5-todo.md §5.4.1`)

- [x] **§4.5.1.7.2** Concepts prompt-level 개선 — PMBOK 10 영역 결정화 (A안 구현 완료)
  - **채택**: A안 (canonicalizer prompt hint). B 는 false-positive 하드-추출 위험, C 는 wiki 그래프 가치 역행이라 기각.
  - 구현: `canonicalizer.ts` `buildCanonicalizerPrompt` "작업 규칙" 7번 항목 신규 — PMBOK / 프로젝트 관리 지식체계 맥락이 본문에 등장할 때 10 영역 (`integration / scope / schedule (or time) / cost / quality / resource (or human-resource) / communications / risk / procurement / stakeholder`) 을 각각 `project-<area>-management` 개별 concept 화, 상위 `project-management-body-of-knowledge` 로 묶지 않음, type=`methodology`, hallucination guard ("본문에 직접 언급되지 않으면 추출하지 않는다") 포함.
  - 단위 테스트: `canonicalizer.test.ts` 에 prompt 문자열 anchor 테스트 신규. rule marker + 8 슬러그 + anti-bundle + hallucination guard 문자열 모두 present 단언. 352/352 PASS.
  - **효과 검증 위임**: Concepts CV 24.6% → <15% 실측은 **Phase 5 §5.4 variance diagnostic** 측정 세션에서 자연 회귀. 목표 미달 시 §5.4 내 신규 sub-task (B안 FORCED_CATEGORIES 9 pin 보강 또는 schema.ts description 레벨 hint 위치 조정) 로 처리. 본 §4.5.1.7.2 자체의 코드 deliverable 은 확정.

- [x] **§4.5.1.7.3** 측정 인프라 robustness — `scripts/measure-determinism.sh` (코드 완료)
  - `restoreSourceFile()` 재작성: `Promise<boolean>` 반환. `adapter.exists` 선/후확인, `.`-prefix 디렉토리 스킵, `renameSync` 실패 → false. `cleanupForRerun` bubble up.
  - run loop: `!restored` → `results.push({error:'source restore failed — raw/ 에서 파일을 찾을 수 없음'})` + `continue`. run 30 스타일 outlier 원천 차단.
  - per-run timeout: 10분 → 15분 (JS 내부 timer + bash `timeout_sec=$((N_RUNS * 900))` 동기, banner 문구도 갱신).
  - `--strict` CLI 옵션 신규: Python stats 블록이 `total=0` run 을 `ok` pool 에서 추가 제외. Markdown 에는 "Strict 제외 run (total=0)" 섹션으로 원본 데이터 보존. `--help` 설명 + banner 라인 추가.
  - 검증: `bash -n` syntax OK, Python `ast.parse` OK, JS `node --check` (async IIFE wrap) OK.

- [→ Phase 5 §5.4.2] **§4.5.1.7.4** Route SEGMENTED 10-run baseline — Ollama qwen3:8b production guide. (상세는 `plan/phase-5-todo.md §5.4.2`)

- [x] **§4.5.1.7.5** Lotus-prefix 3-variant 분석 — **§4.1.3 으로 자동 해결**. §4.1.3.5 측정에서 Entities CV 11.1% → 2.3% 로 떨어지면서 Lotus 진동은 text layer cleanup 으로 사라짐. 별도 rule 불필요 확인.

- [→ Phase 5 §5.4.3] **§4.5.1.7.6** BOM 축 재분할 판단 — 월 1 회 lint 모니터 성격. (상세는 `plan/phase-5-todo.md §5.4.3`)

- [→ Phase 5 §5.4.4] **§4.5.1.7.7** `log_entry` axis cosmetic — 표시 cosmetic, wiki 재생성 없음. (상세는 `plan/phase-5-todo.md §5.4.4`)

### 4.5.2 운영 안전 — 삭제·초기화 (본체 필수)

> 운영 안정성 subject 에서 본체 필수인 두 항목만 유지. bash→TS 포팅, qmd SDK import 는 Phase 5 §5.7 로 이관 (동작 유지 리팩토링).

- [ ] **원본/위키 삭제 안전장치** — dry-run 미리보기, 영향 범위 표시
- [ ] **초기화 기능** — 선택적 리셋 (완전/인제스트/원본/인덱스/설정)

**§4.5.2 에서 Phase 5 로 이관**:
- 기존 bash→TS 완전 포팅 (validate-wiki / check-pii / cost-tracker / reindex) → **Phase 5 §5.7.1**
- 기존 qmd SDK import (CLI exec → 직접 import) → **Phase 5 §5.7.2**

## 4.5.3 / 4.5.4 / 4.5.5 (이관됨) — 성능·엔진 확장 및 self-extending

> 2026-04-22 재편으로 Phase 5 이관.
>
> - 기존 §4.5.3 로컬 추론 엔진 검토 (llama.cpp PoC) → **Phase 5 §5.5.1**
> - 기존 §4.5.4 rapidocr (paddleOCR PP-OCRv5 Korean) fallback 실측 (Linux/Windows 환경) → **Phase 5 §5.5.2**
> - 기존 §4.5.5 표준 분해 규칙 self-extending 4 단계 로드맵 → **Phase 5 §5.6** (2026-04-22 본 세션 진행 중인 §4.5.1.7.2 PMBOK 하드코딩이 §5.6 의 Stage 0 사전 검증이 됨)
>
> 상세는 `plan/phase-5-todo.md`. §5.6 의 철학 선언은 `wiki/analyses/self-extending-wiki.md` (wiki 본체 analysis) 에 정식 기록됨.

---

## Phase 3 완료분 요약 (참고)

> 이 항목들은 Phase 3 내에서 이미 완료된 기능. Phase 4 범위 아님.

- v6 3-stage pipeline + schema-guided extraction (2026-04-19)
- v7-1 Concept decision tree + v7-2 추가 anti-pattern (2026-04-20)
- v7-4 measure-determinism.sh 자동화 스크립트 (2026-04-20, race guard 포함)
- v7-5 `.wikey/schema.yaml` 사용자 override — `loadSchemaOverride()` + Obsidian Schema Override 설정 섹션. 27건 신규 테스트.
- v7-6 Gemini 모델 리스트 필터·정렬 (Pro 가시성)
- MarkItDown + markitdown-ocr + page-render Vision OCR 5-tier (Phase 3까지는 tier 1=MarkItDown, §4-1에서 docling으로 승격 예정)
