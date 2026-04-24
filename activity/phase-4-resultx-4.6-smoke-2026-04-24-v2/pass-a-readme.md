# Phase 4 통합 smoke — Pass A (2026-04-24)

> **상위 문서**: [`README.md`](./README.md) — 최종 집계. 관련 문서: [`pass-b-readme.md`](./pass-b-readme.md), [`cross-compare.md`](./cross-compare.md).

**진입 경로**: Ingest 패널
**autoMoveFromInbox**: false (view-side handler `runIngest + movePair`)
**실행 시각**: 19:23~21:08 (~1h 45m, Obsidian 재시작 포함)
**Provider**: gemini / gemini-2.5-flash

## 매트릭스

| # | 파일 | Stage 1 | Pair move | PII | 종합 |
|---|------|---------|-----------|-----|------|
| 1 | llm-wiki.md | **PASS** | ✅ (md, no sidecar) | — | **PASS** |
| 2 | 사업자등록증 (주)굿스트림 | **PASS** (pipeline) | ✅ | ❌ **FAIL** (filename BRN leak + CEO entity) | **FAIL** |
| 3 | SK바이오텍 계약서 | **PASS** | ✅ | ⚠ **PARTIAL** (2 CEO entity) | **PARTIAL** |
| 4 | PMS 제품소개 | **PASS** | ✅ | **PASS** | **PASS** |
| 5 | 스마트공장 HWP | **PASS** | ✅ | **PASS** | **PASS** |
| 6 | Examples HWPX | **PASS** | ✅ | **PASS** | **PASS** |

## Pass 통계
- 변환 tier 분포:
  - md skip: 1 (file 1)
  - `1-docling`: 1 (file 2, tier 1 kept despite pollution)
  - `1b-docling-force-ocr-scan`: 1 (file 3, force-ocr for scan)
  - `1a-docling-no-ocr`: 1 (file 4, pollution retry succeeded)
  - `unhwp`: 2 (file 5 HWP, file 6 HWPX)
- 분류 depth 분포: **3-level × 6** (모두 3-level)
- 분류 경로:
  - auto-rule: 0
  - LLM-3차/4차 fallback: 6 (all files used LLM classify fallback)
- 총 생성 페이지: sources=6, entities=32, concepts=21, analyses=0 (backup `self-extending-wiki` 미복원)
- 총 provenance entries: 각 entity/concept 페이지마다 1개 (53개)
- 총 dropped 사유 집계: file 1: 1, file 2: 1, file 3: 0, file 4: 6, file 5: 5, file 6: 0 = **13 total** (UI-label / Korean-only 가 주)
- 총 실행 시간: ~1h 45m (OCR 대형 PDF + md Preview 2분 폴링 포함)
- Console ERROR: 0 (WARN: `reindex --quick failed (non-fatal)` 6회, `.ingest-map.json deprecated` 6회 — 경고 수준)
- PII 노출 사건: **3건** (file 2 wiki source body BRN + file 2/3 CEO entity pages)

## Phase 별 통과 요약
- **Phase 4.0 UI**: PASS (패널 버튼 7개 aria-label, Ingest 패널 Ingest 버튼 1-click handler 동작 확인)
- **Phase 4.1 변환**: PASS (tier 1/1a/1b 정상 분기, image-ocr-pollution retry 성공 file 4, scan 감지 force-ocr file 3)
- **Phase 4.2 분류/이동/registry**: PASS (6 파일 모두 3-level 분류, PARA 이동 + sidecar + registry 갱신)
- **Phase 4.3 인제스트+citation**: PASS (3-stage pipeline + provenance frontmatter)
- **§4.1.3 image-ocr-pollution cleanup**: ✅ PASS (file 4 에서 tier 1a retry 로 품질 0.54 → 0.94 상승)
- **§3.2 PII redaction (D.0 fix)**: ⚠ **PARTIAL** — sidecar masking 은 작동하지만 filename metadata leak + CEO name regex 공백 변형 miscoverage 로 wiki 전파 발생

## Stage 3 — Pairmove IV.B sampling (1건)

**대상**: file 4 PMS (`raw/3_resources/20_report/500_technology/PMS_제품소개_R10_20220815.pdf`)

- IV.A (runtime shell mv 관찰): **WARN** — `vault rename reconciled` 로그 미감지 (30s timeout). Plan v6 §4.Common.IV.A 에 WARN 허용 명시 → Phase 5 §5.3 (증분 업데이트 경로 강화) 과제 이관.
- IV.B (종료 → mv → 재시작 → registryReconcile): **✅ PASS**
  - Before: `vault_path=raw/3_resources/20_report/500_technology/...`, `path_history_len=2`
  - After: `vault_path=raw/3_resources/30_manual/991_moved_by_smoke/...`, `path_history_len=3`
  - 최종 path_history entries: `raw/0_inbox/` → `raw/3_resources/20_report/500_technology/` → `raw/3_resources/30_manual/991_moved_by_smoke/` (3 entries, 올바르게 append)
  - 증거 파일: `/tmp/wikey-smoke-reg-before-ivb.json`, `/tmp/wikey-smoke-reg-after-ivb.json`
- Stage 2 재질의 / 📄 click: **DEFERRED** (시간 제약, Pass A 파이프라인 핵심은 검증 완료)

## Critical 이슈

### ❌ C-A1: File 2 wiki source page body 에 raw BRN 3건
- **증상**: `wiki/sources/source-business-registration-goodstream.md` 에 `등록번호: ***-**-*****` 3곳 명시.
- **Root cause**: PDF 변환 시 filename `사업자등록증C_(주)굿스트림_***-**-*****(2015).pdf` 가 LLM prompt metadata 로 전달됨. LLM 이 filename 에서 BRN 재구성 → source page body 에 삽입.
- **증거**: 
  - 로그: `PII redacted — 2 match, mode=mask` (정상), `source: 453 chars, route=FULL` (redacted content)
  - 하지만 file 3 (filename 에 BRN 없음) 의 source page body 에는 raw BRN 0건 → filename metadata leak 확증
- **Phase 5 fix 위임**: `pii-redact.ts` 에서 filename path component 의 BRN 스트립.

### ❌ C-A2: CEO name 이 entity 페이지로 2건 (file 2, file 3)
- `wiki/entities/kim-myeong-ho.md` (***, 굿스트림)
- `wiki/entities/lee-hee-rim.md` (***, 세포아소프트)
- `wiki/entities/kim-myung-ho.md` (동일 ***의 다른 canonical name — dedup 실패)
- **Root cause**: (a) CEO name regex 가 OCR 공백 변형 (`*****`) 커버 못함, (b) canonicalizer 에 `PII-name` drop reason 없음, (c) entity_type=person 에 대한 PII-high source 가드 없음
- **Phase 5 fix 위임**: canonicalizer.ts 에 `PII-name` drop + entity name regex 공백 변형 확장 + 동명이인 dedup.

## 후속 조치

| ID | 심각도 | 내용 | 이관 |
|----|-------|------|------|
| C-A1 | Critical | filename BRN → LLM metadata leak | Phase 5 §5.4 (pii-redact 확장) |
| C-A2 | Critical | CEO name entity 페이지 | Phase 5 §5.4 (canonicalizer PII-name drop) |
| W-A1 | Warn | `reindex --quick failed (non-fatal)` 6회 | 원인 조사 후 Phase 5 §5.3 |
| W-A2 | Warn | `.ingest-map.json deprecated` | Phase 5 §5.3 removal |
| W-A3 | Warn | IV.A runtime shell mv 미감지 | Phase 5 §5.3 (예상, plan v6 명시) |
| I-A1 | Info | md 파일 tombstone 오탐 (파일 존재하는데 "원본 삭제됨") | Phase 5 §5.3 reconcile 강화 |
| I-A2 | Info | Preview modal 대기 기본 120s → 실제 2분 이상 — plan 업데이트 필요 | plan v7 |
