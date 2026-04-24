# Phase 4 통합 smoke — Pass B (Audit 패널, 2026-04-23)

**진입 경로**: Audit 패널 (core `autoMoveFromInbox:true` 경로, `commands.ts::runIngestCore`)
**autoMoveFromInbox**: true (core 내부 Phase 1+2 동시)
**실행 시간대 (KST)**: 00:20 ~ 00:45 (~25분)
**Provider**: 동일 (ingest=claude-code opus, query=gemini-2.5-flash, CR=gemma4)

## 매트릭스

| # | 파일 | Stage 1 | Index gate | Stage 2 | 종합 |
|---|------|---------|-----------|---------|------|
| 1 | llm-wiki.md | ✓ PASS (12e+2c) | ✓ (reindex 후) | ✓ PASS (wl=3, cite=1) | PASS |
| 2 | 사업자등록증.pdf | **BLOCKED** (sandbox 예상, skip) | — | — | **BLOCKED** |
| 3 | SK바이오텍 계약서.pdf | ✓ PASS (8e+6c, BRN 유출) | ✓ | ✓ PASS (wl=10, cite=3, BRN 답변 노출) | PASS-with-PII |
| 4 | PMS.pdf | ✓ PASS (6e+8c) | ✓ | ✓ PASS (wl=5, cite=4) | PASS |
| 5 | 스마트공장.hwp | **N/A** (Audit 패널 미지원 확장자) | — | — | **N/A** |
| 6 | Examples.hwpx | **N/A** (Audit 패널 미지원 확장자) | — | — | **N/A** |

## Stage 3 IV.B (Pass B 샘플링, PASS 필수)

**대상**: PMS (source_id=sha256:dcbe5dd3f5325d4b)

- Obsidian 종료 → CDP 끊김 확인 ✓
- shell mv: `raw/3_resources/20_report/500_technology/PMS_*.pdf{,.md}` → `raw/3_resources/30_manual/991_moved_by_smoke_b/` ✓
- registry before snapshot `/tmp/wikey-smoke/reg-before-pass-b-iv-b.json` ✓
- Obsidian 재시작 + 10s wait → 자동 onload reconcile **race 재현** (Pass A 와 동일 증상)
- **수동 `plugin.runStartupReconcile()`** → registry 갱신 확인
  - vault_path: `.../500_technology/PMS_*.pdf` → `.../991_moved_by_smoke_b/PMS_*.pdf` ✓
  - path_history_len: 2 → 3 ✓
- **판정**: PASS (registry diff) + **WARN 재현** (자동 onload race 는 Pass A, B 모두 동일)

## Pass B 특이 관찰

### 1. Audit 패널 지원 파일 확장자 제한
`scripts/audit-ingest.py:20` 에서 `DOC_EXTS = {".md", ".txt", ".pdf"}` 로 하드코딩. HWP/HWPX 파일은 Audit 패널에서 **추적 자체가 안 됨**. Pass A 의 Ingest 패널은 raw/0_inbox 전체를 보여주므로 6 파일 모두 ingest 가능하지만, Pass B 는 3~4 파일만 가능.

- 영향: plan §4.B 의 "6 파일" 기준 불가. Audit 패널 경로는 4 파일 (PDF 3 + MD 1) 범위로 제한됨.
- 수정 옵션:
  - `audit-ingest.py` DOC_EXTS 에 `.hwp`, `.hwpx` 추가 → 단 convert 실패 리스크 재검증 필요
  - 또는 plan 의 "6 파일 Pass B" 기준 자체를 Audit 패널 scope 에 맞춰 재정의

### 2. 첫 Stage 2 쿼리 "위키에 아직 관련 내용이 없어요"
Stage 1 완료 직후 Stage 2 쿼리 → 빈 답변. 원인: qmd 인덱스 fire-and-forget 이 아직 미반영 상태. `./scripts/reindex.sh` 수동 실행 후 재질의 → 정상 답변 + wikilink + citation.

- 영향: `plan §4.Common.II` Index-ready gate 가 사용자 수동 조작에 의존 (자동 polling 없음)
- Phase 5 §5.3 (증분 인덱싱) 과제 가중

### 3. PII 유출 (파일 3)
SK 계약서 (file 3) 답변에 사업자번호 2건 (119-81-95926, 301-86-19385) + CEO 성명 2건 (이희림, 김명호) 그대로 노출. `wiki/sources/source-c20260410-sk-biotech-eprocurement-system-contract.md` 본문에도 동일 PII 포함.

- plan §3.2 PII 규칙이 **file 2 만 scope** → file 3 의 BRN/CEO 는 미보호
- Stage 3 canonicalize 에 person-entity drop, BRN regex gate 추가 필요
- Phase 4 본체 완성 선언의 전제 (PII 0건 노출) 에 영향

### 4. Gemini connection timeout (Stage 2 중)
SK 파일 Stage 2 첫 시도 시 `net::ERR_CONNECTION_CLOSED`. 재시도 시 성공. Ollama gemini:2.5-flash 의 간헐적 연결 종료 — transient 로 분류하되 query-pipeline 에 retry 추가 권장.

## Pass B 통계

- 처리 파일: 3/3 시도 성공 (llm-wiki, SK, PMS). 사업자등록증 skip, HWP/HWPX N/A.
- 생성 페이지 (Pass A와 동일 내용, source slug 일부 변형):
  - sources: 3 (source-llm-wiki, source-c20260410-sk-biotech-eprocurement-system-contract, source-pms-product-introduction)
  - entities: ~22 (llm 12 + SK 8 + PMS 6 - goodstream update 중복 1)
  - concepts: ~14 (llm 2 + SK 6 + PMS 8 - 1 업데이트)
- registry active entries: 3

## 결론

- 실행 가능 범위 3/3 PASS + IV.B PASS → **Audit 패널 경로 기본 기능 정상**
- file 2 (sandbox block) + files 5/6 (Audit 미지원) 이 plan §6.1 Critical "6/6 PASS" 기준 미충족
- PII 유출 (file 3) 이 새로운 Critical 이슈로 부각

## 후속 조치

- audit-ingest.py DOC_EXTS 확장 (.hwp, .hwpx) 검토
- Stage 2 자동 reindex wait gate (qmd index staleness check → 자동 reindex → 재질의) 구현
- PII carve-out 를 file 2 에서 **전체 파일로 확장** (canonicalize 의 person-entity drop, BRN regex)
- startup reconcile race fix (Pass A/B 양쪽 재현)
