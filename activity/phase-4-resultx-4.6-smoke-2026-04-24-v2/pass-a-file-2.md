# Pass A File 2: 사업자등록증C_(주)굿스트림_***-**-*****(2015).pdf

> **상위 문서**: [`README.md`](./README.md) · [`pass-a-readme.md`](./pass-a-readme.md)

## 메타
- 크기: 316 KB (316,259 bytes)
- 형식: PDF (scan, Adobe Scan Library, 1p)
- 진입: Ingest 패널 (Pass A)
- Pre-ingest: `raw/0_inbox/사업자등록증C_(주)굿스트림_***-**-*****(2015).pdf`
- Post-ingest: `raw/3_resources/20_report/300_social_sciences/사업자등록증C_(주)굿스트림_***-**-*****(2015).pdf` + sidecar `.md`
- source_id: `sha256:d08e0a78a64d04e1`
- 실행 시작 / 종료: 20:46:30 / 20:48:31 (~2분)
- Provider: gemini / gemini-2.5-flash
- **PII 설정**: `allowPiiIngest=true`, `piiGuardEnabled=true` (mask mode)

## Stage 1 — Ingest (§4.Common.I.check)
- **변환 tier-label**: `1-docling` (keeping tier 1 despite pollution, because tier 1a score equal)
- **변환 retry 발생**: ✅ YES — `image-ocr-pollution` 감지 → tier 1a docling --no-ocr retry (score 0.60 == tier1, kept tier 1)
- 변환 시간: cache hit (pre-warmed), 즉시
- **변환 품질**: score=0.60, decision=retry-no-ocr, koreanLong=1.1%, perPage=383, isScanBySource=true(100%), textLayerCorrupted=false, flags=[image-ocr-pollution]
- bitmap OCR 오염: flagged (image-ocr-pollution) — tier 1a 시도했으나 품질 개선 없음, tier 1 유지
- Stage 1 brief: "이 문서는 주식회사 굿스트림의 사업자등록증입니다. 2012년 10월 2일에 개업한 법인으로, 대표자는 ***이며 충청북도 청주시에 사업장을 두고 있습니다..."
  - **PII in brief**: CEO name "***" noted — brief LLM saw RAW content (brief 생성은 redaction 이전에 실행됨)
- Stage 2 mentions: **6** (`route=FULL — mentions=6`)
- Stage 3 canonicalize: **3 entities, 2 concepts, dropped=1**
  - entities: `goodstream-co-ltd.md`, `kim-myeong-ho.md` (⚠ CEO name), `cheongju-tax-office.md`
  - concepts: `business-registration-certificate.md`, `electronic-tax-invoice.md`
- provenance: `wiki/entities/kim-myeong-ho.md` 에 `provenance: [{type: extracted, ref: sources/sha256:d08e0a78a64d04e1}]` 기록
- 분류: **3-level** `raw/3_resources/20_report/300_social_sciences/` (LLM fallback — "법적 서류/증명서")
- pair sidecar 이동: ✅ `sidecar=true`
- registry: vault_path 갱신, path_history 2 entries
- **post-ingest movePair**: `raw/0_inbox/... → raw/3_resources/20_report/300_social_sciences/ sidecar=true` (logged 0-1초)

## PII Redaction 검증 (§3.2)

### 사이드카 `.md` (✅ 부분 PASS)
- `grep -c '\*\*\*' sidecar.md` = **2** (BRN + 법인등록번호 masked)
- `grep -cE '[0-9]{3}-[0-9]{2}-[0-9]{5}' sidecar.md` = **0** (raw BRN 없음)
- 하지만 CEO name `*****` (띄어쓰기 포함, OCR 결과) 는 **sidecar 에 남아있음** — CEO name regex 가 공백 삽입 변형을 커버하지 않음
- 주소 `충청북도 청주시 흥덕구 공단로 134,613(송정동)세중톄크노밸리` 도 sidecar 에 남음 — ADDR 패턴 스캔 안 됨

### 위키 페이지 (❌ FAIL — PII 전파)
- `wiki/sources/source-business-registration-goodstream.md` 본문에 **raw BRN `***-**-*****`** 3곳, **CEO `***`** 명시
- `wiki/entities/kim-myeong-ho.md` — CEO name 이 entity 페이지로 생성됨 (큰 leak)
- `wiki/index.md` 에 `[[kim-myeong-ho]] — *** (소스: 1개)` 등재
- `wiki/log.md` 의 ingest 엔트리에 filename BRN 포함

### Root cause (코드 분석)
1. `cache hit — pdf:1-docling (453 chars)` → `PII redacted — 2 match, mode=mask` → `source: 453 chars` — LLM 입력 redaction 은 정상 적용됨 (BRN 은 실제로 mask 됨)
2. 그러나 **filename** (`...***-**-*****(2015).pdf`) 가 LLM prompt 의 metadata 로 전달됨 → LLM 이 filename 에서 BRN 재구성 후 source 페이지 본문에 삽입
3. CEO name `*****` 는 mask regex 가 공백 삽입 변형을 커버 못 함 → sidecar + LLM 입력 모두 남아있음 → wiki entity 페이지로 전파

### 증거 요약 matrix
| 위치 | BRN raw | CEO name | 판정 |
|------|---------|----------|------|
| sidecar.md | 0 hits | **present** (띄어쓰기) | **PARTIAL** |
| source page body | **3 hits** (❌) | **present** | **FAIL** |
| entities/kim-myeong-ho.md | — | **page filename** | **FAIL** |
| wiki/index.md | — | **present** | **FAIL** |
| wiki/log.md (ingest entry) | (filename) | **present** | **FAIL** |

## 종합
- Stage 1 (ingest 파이프라인 자체): **PASS** (tier 1a retry 정상 동작, PII redact `mask` mode 정상 작동, pair move, registry OK)
- **PII Critical**: ❌ **FAIL** — `wiki/` 전파 PII 3건
  - BRN `***-**-*****` × 3 in source page body
  - CEO name `***` as entity page
  - Root cause: (a) filename metadata leak to LLM prompt, (b) CEO name regex 공백 변형 miscoverage
- Stage 2 / Stage 3: **DEFERRED** (PII critical fail blocks further testing of this file)
- **종합 판정**: **FAIL (Critical)** — 본체 완성 선언 blocking issue.

## 후속 조치 (Phase 5 §5.3/§5.4 fix 제안)
1. `pii-redact.ts` 에서 filename path component 의 BRN 스트립 (LLM prompt 로 전달 전).
2. CEO name regex 를 `[가-힣]{2,4}(\s+[가-힣]){0,3}` 패턴으로 확장 (OCR 공백 변형 포함).
3. Stage 3 canonicalize 에 `PII-name` drop reason 신규 추가 — `entity_type=person` + source 가 PII-high 일 때 drop.
4. `is_pii_high` 플래그를 sidecar 에 meta 추가하고 provenance 가 그 flag 를 참조하면 LLM 이 entity 생성 skip 하도록.
