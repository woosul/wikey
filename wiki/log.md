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
- Sidecar `.md` 4 개 생성 (원본 옆, §4.1.1.9 규칙 확장 — benchmark 재실행 시 overwrite 허용).

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
