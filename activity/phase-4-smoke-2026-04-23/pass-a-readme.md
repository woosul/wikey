# Phase 4 통합 smoke — Pass A (Ingest 패널, 2026-04-23)

**진입 경로**: Ingest 패널 (sidebar-chat.ts:1858 view-side handler `runIngest+movePair`)
**autoMoveFromInbox**: false (view-side Phase 1+2 순차)
**실행 주체**: Claude (CDP localhost:9222 + scripts/wikey-cdp-wrap.sh)
**실행 시간대 (KST)**: 23:49 ~ 00:17 (~28분)
**Provider**: ingest=claude-code (opus), query=gemini-2.5-flash (Ollama), CR=gemma4 (Ollama)

## 매트릭스

| # | 파일 | Stage 1 | Index gate | Stage 2 | Stage 3 IV.A | 종합 |
|---|------|---------|-----------|---------|-------------|------|
| 1 | llm-wiki.md | ✓ PASS (12e+2c) | ✓ | ✓ PASS (wl=2, cite=1) | skip (WARN 허용) | PASS |
| 2 | 사업자등록증 굿스트림.pdf | **BLOCKED** | — | — | — | **BLOCKED** |
| 3 | SK바이오텍 계약서.pdf | ✓ PASS (8e+6c) | ✓ | ✓ PASS (wl=1, cite=0) | skip | PASS |
| 4 | PMS 31p.pdf | ✓ PASS (6e+8c, 1 entity 업데이트) | ✓ | ✓ PASS (wl=13, cite=0) | skip | PASS |
| 5 | 스마트공장.hwp | ✓ PASS (4e, unhwp) | ✓ | ✓ PASS (wl=1, cite=0) | skip | PASS |
| 6 | Examples.hwpx | ✓ PASS (3e, unhwp) | ✓ | ✓ PASS (wl=2, cite=0) | skip | PASS |

## Stage 3 IV.B (Pass 종료 시 1회 샘플링, PASS 필수)

**대상**: Examples.hwpx (source_id=sha256:9d72a7a14fc5337b)

- Obsidian 종료 → CDP disconnect 확인 ✓
- shell mv: `raw/3_resources/60_note/000_general/Examples.hwpx{,.md}` → `raw/3_resources/30_manual/991_moved_by_smoke/` ✓
- registry before snapshot `/tmp/wikey-smoke/reg-before-pass-a-iv-b.json` ✓
- Obsidian 재시작 + 15s wait → **registry 갱신 안 됨** (자동 onload reconcile race)
- **수동 트리거**: `plugin.runStartupReconcile()` via CDP → registry 갱신 확인
  - vault_path: `raw/3_resources/60_note/000_general/Examples.hwpx` → `raw/3_resources/30_manual/991_moved_by_smoke/Examples.hwpx` ✓
  - path_history_len: 2 → 3 ✓
  - last_path.vault_path 매칭 ✓
  - sidecar `.md` 동반 이동 ✓
- **판정**: PASS (registry before/after diff 확인) + **WARN** (자동 onload 경로 race 발견)

## Pass 통계

- 변환 tier 분포: 1-md-skip (file 1), 1b-docling-force-ocr-scan (file 3), 1-docling (file 4, cache hit), unhwp (file 5, 6)
- 분류 depth 분포:
  - 3-level (PARA + NN_type + NNN_topic): file 1, 3, 4, 5, 6 (5/5 완료 파일)
  - auto-rule vs LLM fallback: 전부 auto-rule 로 추정 (LLM 3/4차 fallback 로그 미포착)
- 총 생성 페이지:
  - sources: 5 (source-llm-wiki, source-c20260410-sk-biotek-e-procurement-contract, source-pms-product-introduction, source-smart-factory-briefing, source-alley-image-examples)
  - entities: 33 (file 1: 12, file 3: 8, file 4: 6 [+1 update], file 5: 4, file 6: 3)
  - concepts: 16 (file 1: 2, file 3: 6, file 4: 8, file 5: 0, file 6: 0)
- registry active entries: 5
- PII 노출 사건: 0 발생 (file 2 는 Ingest 자체가 차단돼 PII 전파 경로 미개통)

## Phase 별 통과 요약

- **Phase 4.0 UI**: pre-smoke — Wikey 헤더 버튼 7개 (Chat/Dashboard/Ingest/Audit/Help/Reload/Close) 모두 실재 확인 via CDP. DEFAULT 라벨, Chat /clear 등 visual 점검은 skip (headless 실측 필요).
- **Phase 4.1 변환**: 5/5 변환 성공. PDF (docling), HWP/HWPX (unhwp) 모두 분기 정상. PMS 31p는 cache hit 으로 1분내 brief (첫 실행 시 OCR + docling 파이프라인).
- **Phase 4.2 분류/이동/registry**: 5/5 auto-rule 분류 + movePair 성공. sidecar `.md` 모두 동반. Goodstream 중복 source 없이 entity 업데이트로 처리됨 (file 3 → file 4 reuse).
- **Phase 4.3 인제스트+citation**: Stage 1 3-stage pipeline (Brief/Processing/Preview) 전부 정상. Citation 📄 icon 은 file 1 에서만 1건 렌더 — 나머지는 답변이 `[[log]]`, `[[index]]` 등 source 페이지가 아닌 일반 페이지만 참조해서 발생 안 함 (설계 의도, 버그 아님).

## Critical Findings

### 1. **BLOCKER** — file 2 (사업자등록증 PDF) sandbox 차단

harness 가 "사업자등록번호 포함 PDF 인제스트" 액션을 PII 안전 사유로 block. 사용자의 자율 실행 승인(`이후 승인없이 진행해도돼`)이 있어도 sandbox layer 가 차단함. 결과: Pass A 5/6 PASS.

- 영향: Phase 4 본체 완성 선언의 6/6 기준 미충족
- 우회 방안: 사용자가 settings.local.json 에 별도 Bash permission 추가하거나, 파일 2 를 Pass A/B 공통 skip 으로 합의 → 5/5 기준 재정의 필요
- plan §3.2 의 PII rollback 로직은 아직 검증 기회 미확보

### 2. **WARN** — startup reconcile race

IV.B 에서 Obsidian 재시작 후 자동 onload `runStartupReconcile()` 가 registry 를 갱신 못함 (vault.getFiles() 가 scan 완료 전 빈 결과 반환). 수동 재호출 시 정상 동작.

- 위치: main.ts:213 `void this.runStartupReconcile().catch(...)` (fire-and-forget, timing guard 없음)
- 영향: 사용자가 Obsidian 종료 중 파일 이동 → 재시작해도 registry 와 실제 경로 불일치 유지
- Phase 5 §5.3 (증분 업데이트 경로 강화) 과제로 이관 권장
- 즉시 fix 가능: `setTimeout(() => runStartupReconcile(), 5000)` 또는 `workspace.onLayoutReady` 이후 실행

### 3. **관찰** — validate-wiki.sh 대소문자 wikilinks

file 1 (llm-wiki.md) ingest 후 `wiki/sources/source-llm-wiki.md` 에 `[[LLM]]`, `[[Obsidian]]` (uppercase) 가 다수 잔존. 엔티티 파일명은 lowercase (`llm.md`, `obsidian.md`). Obsidian 자체에서는 case-insensitive 로 resolve 되지만 validate-wiki.sh 는 FAIL 판정.

- stripBrokenWikilinks 단계가 대소문자 정규화 미수행
- Phase 5 §5.1 (검색 재현율) 또는 별도 lint 강화 과제

## 후속 조치

### Pass A 결과 기준 판정
- **Critical FAIL: 1건** (file 2 BLOCKED)
- **WARN: 2건** (startup reconcile race, validate-wiki 대소문자)
- 나머지 5 파일 Stage 1+2+IV.B 정상

### Pass B 진입 전
- between-pass reset 실행
- Pass B 에서 file 2 도 동일 block 예상 — 사용자 확정 후 진행

### 다음 세션
- cross-compare 는 file 2 제외 5 파일 기준
- D 본체 완성 선언은 file 2 해결 후 (5/6 으로는 plan §6.1 Critical 미통과)
