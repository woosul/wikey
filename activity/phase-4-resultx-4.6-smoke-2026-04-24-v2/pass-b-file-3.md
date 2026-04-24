# Pass B File 3: SK바이오텍 계약서 (Audit panel)

> **상위 문서**: [`README.md`](./README.md) · [`pass-b-readme.md`](./pass-b-readme.md)

## 메타
- 진입: Audit 패널
- 실행: 21:14:41 → 21:18:34 (~4분)
- source: 6024 chars, route=FULL, sections=21
- PII: `allowPiiIngest=true, piiGuardEnabled=true`

## Stage 1
- 변환 tier: `1b-docling-force-ocr-scan` (score 0.96, accept) — Pass A 와 동일 ✅
- **PII redacted: 2 match, mode=mask** (main + sidecar) ✅
- Stage 2 mentions: **15** (Pass A 14 → +1 variance)
- Stage 3: **7 entities, 7 concepts, dropped=15** (Pass A 6+8+0 → +1 entity, -1 concept, +15 dropped → Pass B dropped 훨씬 많음 — LLM behavior variance)
- 분류: `raw/3_resources/20_report/300_social_sciences/` (Pass A 와 동일) ✅

## PII 검증
- Sidecar: mask 2, raw BRN 0 ✅
- wiki: CEO entity 들 여전 (`lee-hee-rim`, `kim-myung-ho`) — Pass A 동일 이슈

## 판정
**PARTIAL** (tier/분류 결정적 일치, PII CEO entity issue 잔존)
