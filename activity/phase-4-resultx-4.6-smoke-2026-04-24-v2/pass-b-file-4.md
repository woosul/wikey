# Pass B File 4: PMS 제품소개 (Audit panel)

> **상위 문서**: [`README.md`](./README.md) · [`pass-b-readme.md`](./pass-b-readme.md)

## 메타
- 진입: Audit 패널
- 실행: 21:18:45 → 21:25:26 (~7분, 31p OCR)
- source: 47,979 chars, route=FULL, sections=52
- PII: `allowPiiIngest=false, piiGuardEnabled=true` (본문 PII 없음)

## Stage 1
- 변환 tier: `1-docling` (score 0.54, image-ocr-pollution) → **`1a-docling-no-ocr` (score 0.94, accept)** ✅ (Pass A 와 동일, retry 성공)
- PII redact 없음 (본문 PII 없음)
- Stage 2 mentions: **15** (Pass A 동일) ✅
- Stage 3: **6 entities, 9 concepts, dropped=4** (Pass A 8+7+6 → -2 entity, +2 concept, -2 dropped — variance)
- 분류: `raw/3_resources/20_report/500_technology/` (Pass A 와 동일) ✅

## 판정
**PASS** — tier 1a retry baseline 유지 (§4.1.3 image-ocr-pollution cleanup 확증), 분류 정확.
