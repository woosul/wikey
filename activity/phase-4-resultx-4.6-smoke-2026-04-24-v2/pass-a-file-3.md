# Pass A File 3: C20260410_용역계약서_SK바이오텍전자구매시스템구축.pdf

> **상위 문서**: [`README.md`](./README.md) · [`pass-a-readme.md`](./pass-a-readme.md)

## 메타
- 크기: 3.2 MB
- 형식: PDF (Canon scan, 6p)
- 진입: Ingest 패널 (Pass A)
- Pre/Post: `raw/0_inbox/...` → `raw/3_resources/20_report/300_social_sciences/...` + sidecar
- source_id: (확인 후 기록)
- 실행: 20:51:19 → 20:54:00 (~3분)
- Provider: gemini / gemini-2.5-flash
- PII 설정: `allowPiiIngest=true`, `piiGuardEnabled=true`

## Stage 1 — Ingest
- **변환 tier**: `1b-docling-force-ocr-scan` (score 0.96, decision=accept) — tier 1 detected scan (isScanBySource=100%, textLayerCorrupted=true) → retry with `docling --force-ocr` → score 0.96 accepted
- 변환 retry: tier 1 (score 0.95) → tier 1b (score 0.96) — **retry worked** (§4.1.3)
- bitmap OCR 오염: 없음 (scan PDF, force-ocr 정상)
- Stage 1 brief: "(주)세포아소프트는 SK바이오텍 전자구매시스템 구축 사업의 개발 부문을 (주)굿스트림에 일괄 도급(턴키)하는 용역 계약을 체결했습니다. 이 계약은 2026년 4월 10일부터 10월 30일까지 진행되며..."
- Stage 2 mentions: **14**
- Stage 3 canonicalize: **6 entities, 8 concepts, dropped=0**
  - entities: `sk-biotek`, `sepoasoft-co-ltd`, `goodstream-co-ltd` (업데이트), `lee-hee-rim` (⚠ CEO), `kim-myung-ho` (⚠ CEO, alternate spelling), `seoul-central-district-court`
  - concepts: service-contract, turn-key-method, advance-payment-guarantee-bond, performance-bond-for-defects, man-month, back-to-back-method, contract-performance-guarantee-bond, security-pledge
- 분류: **3-level** `raw/3_resources/20_report/300_social_sciences/` (LLM 3차 분류)
- pair sidecar 이동: ✅ `sidecar=true`

## PII Redaction 검증
### Sidecar: PASS
- mask hits: 2
- raw BRN: 0

### Wiki: PARTIAL PASS
- `source-sk-biotek-eprocurement-service-contract.md` body: **0 raw BRN** (✅ filename 에 BRN 없음 → LLM reconstruction 안 됨)
- 하지만 **CEO names 2개가 entity 페이지**:
  - `wiki/entities/lee-hee-rim.md` (***, 세포아소프트 대표)
  - `wiki/entities/kim-myung-ho.md` (***, 굿스트림 대표, file 2의 `kim-myeong-ho.md` 와 **다른 캐논 이름으로 중복**)

### 핵심 발견
- **File 2 와의 비교**: file 2 의 source page 에 raw BRN 이 있었던 것은 **filename 에 BRN 이 포함된 결과**. file 3 은 filename 에 BRN 이 없어서 source page body 에도 BRN 없음 → **filename-as-metadata PII leak** 확증.
- CEO names 는 양쪽 모두 entity page 로 생성 — 독립적 이슈.
- **Name duplication bug**: 동일 인물 "***" 가 file 2 (`kim-myeong-ho`) + file 3 (`kim-myung-ho`) 로 canonical name mismatch — `canonicalizer.ts` 동명이인 dedup 부재.

## 종합
- Stage 1 파이프라인: **PASS** (tier 1b retry, PII mask mode, pair move, 6 entities + 8 concepts)
- PII (위키): **FAIL** (CEO 2명 entity 페이지)
- **종합 판정**: **PARTIAL** — tier-label 과 variance 는 OK, PII 는 file 2 와 동일 root cause

## 후속 조치
- File 2 의 후속 조치와 동일 — filename path component BRN strip + CEO name regex 공백 변형 포함 + `PII-name` drop reason 추가.
- 추가: canonicalizer 에 동명이인 dedup (entity_type=person 일 때 이름 normalize — `***` ≡ `kim-myeong-ho` ≡ `kim-myung-ho`).
