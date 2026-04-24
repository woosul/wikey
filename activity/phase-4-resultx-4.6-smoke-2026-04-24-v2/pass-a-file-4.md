# Pass A File 4: PMS_제품소개_R10_20220815.pdf

> **상위 문서**: [`README.md`](./README.md) · [`pass-a-readme.md`](./pass-a-readme.md)

## 메타
- 크기: 3.6 MB
- 형식: PDF 1.6 Optimized (31p)
- 진입: Ingest 패널 (Pass A)
- Pre/Post: `raw/0_inbox/...` → `raw/3_resources/20_report/500_technology/...` + sidecar
- 실행: 20:54:55 → 21:01:09 (~6분)
- Provider: gemini / gemini-2.5-flash
- PII 설정: `allowPiiIngest=false`, `piiGuardEnabled=true` (기본, PDF 본문에 PII 없음 예상)

## Stage 1 — Ingest
- **변환 tier**: `1-docling` → **`1a-docling-no-ocr` (tier 1a retry, ✅ SUCCESS)**
  - tier 1: score=0.54, flags=[image-ocr-pollution] → decision=retry-no-ocr
  - tier 1a: score=0.94, decision=accept — **§4.1.3 image-ocr-pollution retry 정확히 동작** (기대 분기 일치)
- Stage 1 brief: "LOTUS PMS는 중소/중견기업의 프로젝트 기반 제조 협업을 위한 시스템입니다. 이 솔루션은 PMBOK 표준을 기반으로 프로젝트 자원, 진행 상황, 성과를 체계적으로 관리하여 업무 생산성을 향상시킵니다..."
- Stage 2 mentions: **15**
- Stage 3 canonicalize: **8 entities, 7 concepts, dropped=6**
  - entities: `lotus-pms`, `goodstream-co-ltd` (업데이트), `lotus-scm`, `project-management-institute`, `alimtalk`, `java`, `c-sharp`, `lotus-mes`
  - concepts: `work-breakdown-structure`, `project-management-body-of-knowledge`, `enterprise-resource-planning`, `gantt-chart`, `bill-of-materials`, `manufacturing-execution-system`, `supply-chain-management`
- dropped=6: 높은 편 (UI-label / Korean-only / other)
- 분류: **3-level** `raw/3_resources/20_report/500_technology/` (LLM fallback: "제품 소개 자료는 참조용 보고서이며, PMS가 IT/기술 관련 주제이므로 500_technology에 분류")
- pair sidecar 이동: ✅ `sidecar=true`
- **PII redact 로그**: 없음 (본문에 PII 패턴 없음, 정상)
- **기대 분기 (§4.1.3)**: `image-ocr-pollution → 1a-docling-no-ocr retry` 성공 확증 — D.0 fix baseline regression 없음.

## 종합
- Stage 1 파이프라인: **PASS** (tier 1a retry 정상 동작, 분류 3-level, pair move, 8+7 페이지 생성)
- PII: **PASS** (본문 PII 없음, 정상)
- **종합 판정**: **PASS** — Phase 4.1.3 cleanup baseline 유지됨. 31p 대용량 처리 성공.

## Stage 3 — Pairmove (IV.B sampling 대상)
- Pass A 전체 종료 시 이 파일 (PMS) 로 IV.B sampling 수행 예정.
