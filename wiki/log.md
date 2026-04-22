---
title: 활동 로그
type: log
created: 2026-04-10
updated: 2026-04-22
---

## [2026-04-22] reset | 초기화 — §4.1.3 실험 baseline 확보

- raw/: PMS_제품소개_R10_20220815.pdf 만 raw/0_inbox/ 에 남김, 나머지 PARA 하위 모두 raw/_delayed/ 로 이동
- wiki/: entities/concepts/sources/analyses 모두 삭제, index.md / log.md / overview.md 초기 템플릿으로 리셋, .ingest-map.json 삭제
- 캐시: ~/.cache/wikey/convert/ 무효화
- 목적: §4.1.3 (Bitmap OCR 본문 오염 차단 + 검증 모듈 설계 확장) 실험의 깨끗한 baseline 확보. `plan/phase-4-1-3-bitmap-ocr-fix.md` 참조.

## [2026-04-22] fix | §4.1.3.1~3 Bitmap OCR 본문 오염 차단 (TDD)

- `wikey-core/src/ingest-pipeline.ts`: `buildDoclingArgs` mode 파라미터 (`DoclingMode = 'default' | 'no-ocr' | 'force-ocr'`). `doclingMajorOptions` 에 `mode` 필드. Tier 1 은 docling 기본값 유지 (사용자 원칙 "기본값 → 검증 → escalation"). `extractPdfText` 에 `retry-no-ocr` 분기 → Tier 1a (`--no-ocr`) 재시도 + score 비교 후 채택 (false positive 방어).
- `wikey-core/src/convert-quality.ts`: 5번째 signal `hasImageOcrPollution` (필터 `bodyChars ≥ 2000` + `markers ≥ 5`, 기준 A 마커 ±5 window 내 <20자 라인 3연속 OR 기준 B 전체 <20자 파편 비율 > 50%). `scoreConvertOutput` decision 에 `'retry-no-ocr'` 추가, score −0.4. 우선순위 `koreanLoss > pollution > score`.
- 영향 파일: convert-quality.ts · ingest-pipeline.ts · `__tests__/convert-quality.test.ts` · `__tests__/ingest-pipeline.test.ts`.
- 테스트: 315 → **335 PASS** (+20). 빌드 0 errors.

## [2026-04-22] eval | §4.1.3.4 Tier chain 4 코퍼스 회귀 + sidecar md 저장

- 스크립트: `scripts/benchmark-tier-4-1-3.mjs` (신규). `wikey-core/dist/convert-quality.js` 재활용.
- 대상: PMS / ROHM / RP1 / GOODSTREAM 4 코퍼스 (OMRON/TWHB 는 실행 시간 이유로 제외).
- 결과 (`activity/phase-4-1-3-benchmark-2026-04-22.md`):
  - PMS: Tier 1 retry-no-ocr → Tier 1a `1a-docling-no-ocr` accept — lines **1922 → 532 (−72%)**, score 0.53 → 0.91. koreanChars 18,654 → 15,549 (OCR 파편 3,105자 제거).
  - ROHM: Tier 1 retry (koreanLoss) → Tier 1b force-ocr accept (기존 경로 유지).
  - RP1, GOODSTREAM: Tier 1 accept.
- Sidecar `.md` 4 개 생성 (원본 옆).

## [2026-04-22] fix | §4.1.3 sidecar 저장 정책 수정 — 원본.md = 이미지 포함 raw

- 사용자 설계 확정: **원본.pdf → 원본.md (이미지 포함 raw) → LLM투입용.md (stripped, 메모리 전용)**. 파일시스템에 남는 것은 원본.pdf + 원본.md. stripped 는 wiki 생성 후 사라짐.
- 이전 구현은 stripped (LLM 투입용) 을 sidecar 로 저장. 원본 이미지가 소실되는 문제.
- 변경:
  - `wikey-core/src/ingest-pipeline.ts::extractPdfText::finalize` — sidecar 를 **raw md (이미지 embedded)** 로 저장. stripped 는 cache + caller 반환 유지.
  - `ingest-pipeline.ts` ingest 함수의 sidecar 블록 (131-144) — `ext !== 'pdf'` 조건 추가. PDF 는 finalize 에서 raw 로 이미 저장됐으므로 stripped 로 덮어쓰기 차단. hwp/hwpx/docx/... 는 기존 로직 유지 (후속 작업에서 동일 정책 확장).
  - `scripts/benchmark-tier-4-1-3.mjs` — `{ md, raw }` 구조로 분리. analyze 는 stripped, sidecar 저장은 raw.
- 재실행 결과 (sidecar 크기 급증, 이미지 포함 확증):
  - PMS: 47,979 → **6,339,748 chars**
  - ROHM: 4,714 → **1,505,611 chars**
  - RP1: 236,858 → **1,897,465 chars**
  - GOODSTREAM: 453 → **599,454 chars**
- raw/ 하위 sidecar 는 `.gitignore` 의 `raw/` 규칙으로 자동 제외. docs/samples/ 하위 sidecar 만 git tracked.

## [2026-04-22] feat | §4.1.3 OCR engine fallback 등록 — engine 별 lang 자동 매핑

- 사용자 요청: "ocrmac 은 macOS 전용 → paddleOCR fallback 등록".
- docling 공식 source (`pipeline_options.py`) 확증된 engine 별 lang 형식:
  - ocrmac: BCP-47 (`ko-KR,en-US`)
  - rapidocr: 언어명 (`korean,english`) — paddleOCR 모델
  - easyocr: ISO 639-1 (`ko,en`)
  - tesseract/tesserocr: ISO 639-2 (`kor,eng`)
- 신규 export: `defaultOcrEngine()` — platform 별 (darwin → ocrmac, else → rapidocr).
- 신규 export: `defaultOcrLangForEngine(engine)` — engine 에 맞는 기본 lang 자동 선택.
- `buildDoclingArgs` / `doclingMajorOptions` 에서 `DOCLING_OCR_LANG` 명시 설정 없으면 engine 에 맞는 기본값 적용 (기존 ocrmac 고정 형식 오류 해소).
- `wikey.conf` 주석 업데이트 — platform fallback 동작 + engine 별 lang 형식 문서화.
- 테스트: 343 → **351 PASS** (+8: defaultOcrEngine 1, defaultOcrLangForEngine 5, engine-aware args 2).
- macOS 환경 실측: 기존 ocrmac + ko-KR,en-US 동일 결과 유지 (regression 없음).
- Linux/Windows 환경 실측은 다음 세션 — paddleOCR PP-OCRv5 Korean 모델 다운로드 + rapidocr CLI 경로 검증.

## [2026-04-22] fix | §4.1.3 sidecar — tier 기반 이미지 strip 분기 + source PDF scan 감지

- 사용자 명시: "스캔이미지로 판정되어 ocr 옵션이 들어가면 이미지가 필요없다" (30p 계약서 스캔 포함). "소규모 문서" 는 판정 기준 아님. 단 "한글 관련 문제는 다른 케이스" (ROHM 은 vector PDF diagram 유지 필요).
- `wikey-core/src/convert-quality.ts::hasRedundantEmbeddedImages(rawMd, strippedMd, pageCount, tierKey)`:
  - `isLikelyScanPdf = true` → strip (MD 기반 fallback)
  - tierKey `1b-docling-force-ocr-scan` → strip (scan 원인 OCR)
  - tierKey `1-docling-scan` → strip (Tier 1 accept 이지만 source PDF 가 scan, GOODSTREAM/CONTRACT)
  - tierKey `1b-docling-force-ocr-kloss` → **유지** (한글 공백 소실 원인, vector PDF diagram)
  - tierKey `1a-docling-no-ocr` → 유지 (pollution escalation)
  - tierKey `1-docling` → 유지 (기본 vector PDF)
- `extractPdfText` Tier 1b 채택 시 tierKey suffix 분기: `tier1bKey = isScan ? '...-scan' : '...-kloss'`.
- **Source PDF scan 감지** (근본 수정, 2026-04-22): MD 기반 `isLikelyScanPdf` 가 docling bitmap OCR 결과를 입력받아 GOODSTREAM 같은 "기존 OCR 저장 스캔본" 을 놓침. pymupdf 로 페이지 대비 **최대 이미지 면적 비율** 직접 측정. `scanRatioBySource > 0.5` → `isScanBySource=true`. Tier 1 accept + source scan 이면 `tierKey = '1-docling-scan'` 로 설정해 sidecar strip.
- `benchmark-tier-4-1-3.mjs` 도 동일 로직 + `getScanRatioBySource()` helper.
- 테스트 340 → **343 PASS** (+3: tier 분기 2 + `1-docling-scan` 1).
- **실측 5 코퍼스 매핑**:
  - PMS (scan 0%) → `1a-docling-no-ocr` raw
  - ROHM (scan 0%) → `1b-docling-force-ocr-kloss` raw (diagram 유지)
  - RP1 (scan 0%) → `1-docling` raw
  - GOODSTREAM (scan **100%**, 1p 사업자등록증) → `1-docling-scan` **stripped 453 chars** ✓
  - CONTRACT (scan **100%**, 6p 용역계약서, bodyChars 8114 — 소규모 아님) → `1-docling-scan` **stripped 8114 chars** ✓
- bodyChars 임계 의존성 제거 — "소규모는 판정 기준 아님" 사용자 명시 충족.

## [2026-04-22] eval | §4.1.3.5 PMS 10-run determinism (clean MD baseline)

- 실행: `./scripts/measure-determinism.sh raw/0_inbox/PMS_제품소개_R10_20220815.pdf -n 10 -d -o activity/phase-4-1-3-5-pms-10run-clean-2026-04-22.md`
- 10/10 success, 평균 252.6s/run, 총 약 42분.
- **Total CV 10.3%** (mean 42.20, range 36–46, 분포 {36, 44, 46} 3 값으로 양자화)
- **Entities CV 2.3%** (mean 22.60, range 22–23) — 거의 결정적. 29-run 11.1% 대비 대폭 개선.
- **Concepts CV 24.6%** (mean 18.60, range 12–22) — 29-run 27.0% 대비 소폭 개선. PMBOK 9 영역 추출이 일부 run 에서만 포함되는 진동 여전.
- Core entities 19/27 (70%), Core concepts 11/22 (50%).
- 재해석:
  - 깨끗한 MD 에서도 §4.5.1.6 29-run 9.2% (오염) 와 거의 동일 (10.3%) → **canonicalizer 3차 확장이 실제 legitimate variance 를 잡았음** 확증 (OCR 파편 흡수가 주효과였다면 clean MD 에서 CV 가 훨씬 더 낮아야).
  - 잔여 variance 는 **Concepts PMBOK 9 영역 추출 진동** 이 주원인 (Entities 는 2.3% 거의 결정적).
- 판정: CV 10.3% 는 §4.5.1.7 gate "5–10%" 와 ">10%" 경계. **§4.5.1.7.2 (Concepts prompt, PMBOK 9 영역 강제 나열)** 은 필수. §4.5.1.7.1 (attribution), §4.5.1.7.5 (Lotus variance) 등은 재평가 (Entities CV 2.3% 면 Lotus 진동 자동 해결 가능성 높음).
- 산출물: `activity/phase-4-1-3-5-pms-10run-clean-2026-04-22.md`.

## [2026-04-22] feat | §4.5.1.7.2 + §4.5.1.7.3 코드 구현 완료 — 실측 대기

- **§4.5.1.7.2** (`wikey-core/src/canonicalizer.ts`): `buildCanonicalizerPrompt` "작업 규칙" 7번 항목 신규 — PMBOK / 프로젝트 관리 지식체계 맥락이 본문에 등장할 때 PMBOK 10 knowledge areas (`integration / scope / schedule (or time) / cost / quality / resource (or human-resource) / communications / risk / procurement / stakeholder`) 을 각각 `project-<area>-management` 개별 concept 로 추출, 상위 `project-management-body-of-knowledge` 로 묶지 말 것, type=`methodology`, "본문에 직접 언급되지 않으면 추출하지 않는다" hallucination guard 포함. A안 채택 (B=false-positive 위험, C=wiki 그래프 가치 역행).
- 단위 테스트 신규 (`canonicalizer.test.ts`): prompt 문자열 anchor — rule marker + 8 슬러그 + anti-bundle + hallucination guard 모두 present 단언. 352/352 PASS (+1), tsc 0 errors.
- **§4.5.1.7.3** (`scripts/measure-determinism.sh`): `restoreSourceFile()` → `Promise<boolean>` 전환, `.`-prefix 디렉토리 스킵, 실패 시 run 에러 명시 기록 (run 30 outlier 재현 차단). per-run timeout 10분 → 15분 (JS `15*60*1000` + bash `timeout_sec=$((N_RUNS*900))`). `--strict` CLI 플래그 신규 — `total=0` run 을 통계에서 추가 제외, Markdown 에 "Strict 제외 run (total=0)" 섹션으로 원본 보존. banner + `--help` 문구 동기.
- 검증: `bash -n` syntax OK, Python heredoc `ast.parse` OK, JS heredoc `node --check` (async IIFE wrap 후) OK.
- 덤: master에 존재하던 `hasRedundantEmbeddedImages(md, stripped, pdfPageCount)` arity 버그 (`bb09b79` 커밋이 `convert-quality.ts` 에만 4번째 `tierKey` 추가, `ingest-pipeline.ts:1194` 호출부 미갱신) 도 `tierKey` 인자 전달로 복구. 해당 커밋의 "343 tests PASS, tsc 0 errors" 주장은 실제로 성립하지 않고 있었음.
- **실측 대기**: §4.5.1.7.2 효과 검증 (PMS 5-run 재측정, Concepts CV 24.6% → <15% 목표) 은 Obsidian CDP 세션에서 후속. §4.5.1.7.3 robustness 는 다음 측정 세션에서 자동 회귀.
- 참조: `activity/phase-4-result.md §4.5.1.7.2 / §4.5.1.7.3` (구현 완료 + 실측 대기 로 전환), `plan/phase-4-todo.md §4.5.1.7.2 [~]` / `§4.5.1.7.3 [x]`, `plan/session-wrap-followups.md` 최상단 블록.
