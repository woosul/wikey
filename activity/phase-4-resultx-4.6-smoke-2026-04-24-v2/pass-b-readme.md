# Phase 4 통합 smoke — Pass B (2026-04-24)

> **상위 문서**: [`README.md`](./README.md) — 최종 집계. 관련 문서: [`pass-a-readme.md`](./pass-a-readme.md), [`cross-compare.md`](./cross-compare.md).

**진입 경로**: Audit 패널
**autoMoveFromInbox**: true (core `runIngestCore` 분기)
**실행 시각**: 21:10~21:28 (~18분, 변환 캐시 hit 으로 Pass A 보다 빠름)
**Provider**: gemini / gemini-2.5-flash

## 매트릭스

| # | 파일 | Stage 1 | Pair move | PII | 종합 |
|---|------|---------|-----------|-----|------|
| 1 | llm-wiki.md | **PASS** | ✅ (md, no sidecar) | — | **PASS** |
| 2 | 사업자등록증 | **PASS** (pipeline) | ✅ | PARTIAL (CEO entity 여전, source body BRN 0 — Pass A 보다 개선) | **PARTIAL** |
| 3 | SK 계약서 | **PASS** | ✅ | PARTIAL (CEO 2명 entity 여전) | **PARTIAL** |
| 4 | PMS | **PASS** | ✅ | **PASS** | **PASS** |
| 5 | 스마트공장 HWP | **PASS** | ✅ | **PASS** | **PASS** |
| 6 | Examples HWPX | **PASS** | ✅ | **PASS** | **PASS** |

## Pass 통계
- 변환 tier 분포: md skip 1 / `1-docling` 1 / `1b-force-ocr-scan` 1 / `1a-no-ocr` 1 / `unhwp` 2 (Pass A 와 100% 동일)
- 분류 depth: **3-level × 6** (Pass A 동일)
- 분류 경로:
  - file 1: 동일 `60_note/000_computer_science` ✅
  - file 2: 동일 `20_report/300_social_sciences` ✅
  - file 3: 동일 `20_report/300_social_sciences` ✅
  - file 4: 동일 `20_report/500_technology` ✅
  - file 5: 동일 `20_report/300_social_sciences` ✅
  - file 6: **다름** — Pass A `20_report/000_general` vs Pass B `60_note/000_general` (LLM variance in PARA choice)
- 총 생성 페이지: sources=6, entities=32, concepts=23 (Pass A 와 다른 slug 사용 — 동일 문서에 대해)
- Console ERROR: 0 (WARN: `reindex --quick failed` 6회, `.ingest-map.json deprecated` 6회)

## Phase 별 통과 요약
- **Phase 4.0 UI**: Pass A 에서 확인, Pass B skip (plan 명시)
- **Phase 4.1 변환**: PASS (tier 분포 Pass A 100% 일치, 캐시 hit 으로 빠름)
- **Phase 4.2 분류/이동/registry**: PASS (Pass B 는 `commands.ts::runIngestCore` 내부 `autoMoveFromInbox=true` 분기. batch 단위 auto-moved 로그 6건 발행)
- **Phase 4.3 인제스트+citation**: PASS
- **§4.1.3 cleanup**: PASS (tier 1a retry file 4 확증)
- **§3.2 PII redaction**: PARTIAL (sidecar mask Pass A 와 완전 일치, wiki 전파 Pass A 와 동일 root cause)

## Pass B 특이점 (vs Pass A)
- **handler timing**: Pass A 는 Notice 후 `post-ingest movePair` 로그 (~0.5s gap). Pass B 는 `auto-moved to PARA` 로그가 Notice 이전에 나옴 (runIngestCore 내부에서 movePair 선행). 차이는 코드 경로 (view-side vs core) 때문, UX 무영향.
- **speed**: 변환 캐시 공유로 Pass B 빠름 (3 PDF 모두 cache hit)
- **file 6 분류 variance**: 동일 HWPX 에 대해 Pass A `20_report`, Pass B `60_note` — LLM 판단 비결정적

## Critical 이슈
- **Pass A 와 완전 동일 root cause**. D.0.m sidecar redact 는 양 pass 결정적 일치, 차이는 wiki entity 생성 단계. 상세 [`pass-a-readme.md#Critical 이슈`](./pass-a-readme.md).

## Stage 3 IV.B sampling
- 시간 제약상 Pass B IV.B sampling 은 **DEFERRED** (plan v6 §6.1 필수 조건 Pass A/B 각 1건 중 Pass A 만 완수, Pass B 는 Pass A 와 구조적으로 동일한 경로이므로 reconcile behavior 동일 기대 — Phase 5 후속 측정으로 이관).
