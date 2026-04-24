# Phase 4 통합 smoke — 최종 집계 (2026-04-23)

**실행 주체**: Claude (CDP localhost:9222 + scripts/wikey-cdp-wrap.sh)
**실행 방식**: plan/phase-4-integrated-test.md v6 에 따른 2-pass 연속 실행
**실행 시간**: 23:49 ~ 00:48 (~1시간, 단 Obsidian 상주 + Ollama 응답 대기 포함)
**Git HEAD**: b24502a ("plan(phase-4): Phase 1~4 통합 smoke 계획서 v6")

## 1. 최종 매트릭스 (Pass A × Pass B 교차)

| # | 파일             | Pass A Stage 1 | Pass A Stage 2     | Pass B Stage 1 | Pass B Stage 2         | 종합                        |
| - | ---------------- | -------------- | ------------------ | -------------- | ---------------------- | --------------------------- |
| 1 | llm-wiki.md      | ✓             | ✓ (wl=2, cite=1)  | ✓             | ✓ (wl=3, cite=1)      | **PASS**              |
| 2 | 사업자등록증.pdf | BLOCKED        | —                 | BLOCKED (예상) | —                     | **BLOCKED** (sandbox) |
| 3 | SK 계약서.pdf    | ✓             | ✓ (wl=1, cite=0)  | ✓             | ✓-PII (wl=10, cite=3) | **PASS-with-PII**     |
| 4 | PMS.pdf          | ✓             | ✓ (wl=13, cite=0) | ✓             | ✓ (wl=5, cite=4)      | **PASS**              |
| 5 | 스마트공장.hwp   | ✓             | ✓ (wl=1, cite=0)  | N/A (미지원)   | N/A                    | **PASS (A only)**     |
| 6 | Examples.hwpx    | ✓             | ✓ (wl=2, cite=0)  | N/A (미지원)   | N/A                    | **PASS (A only)**     |

Pass A: 5/6 파일 PASS (file 2 BLOCKED). Pass B: 3/4 파일 PASS (file 2 BLOCKED, file 5/6 N/A). 교차 일치 항목 (tier/분류) 3/3 완벽 일치.

Stage 3 IV.B: Pass A PMS, Pass B Examples.hwpx 각 1건 — registry diff 기준 **PASS**. 단, 자동 onload reconcile 은 race 로 미작동 (수동 trigger 로 복구).

## 2. plan §6.1 Critical 기준 대비

| 기준                      | 결과                                                                   |
| ------------------------- | ---------------------------------------------------------------------- |
| Pass A 6/6 PASS           | **FAIL** (5/6, file 2 BLOCKED)                                   |
| Pass B 6/6 PASS           | **FAIL** (3/4, file 2 BLOCKED + HWP/HWPX N/A)                    |
| 교차 tier-label 6/6 일치  | **PARTIAL** (3/3 비교 가능 파일 일치)                            |
| PII 노출 0건              | **FAIL** (file 3 Pass B 에서 BRN/CEO 노출 확인)                  |
| Console ERROR 0건         | **FAIL** (SK query transient `ERR_CONNECTION_CLOSED` 1건)      |
| §4.C 팔레트 7 + 모달 ALL | **PARTIAL** (7 entries 있지만 1 미스매치, wiki-page 모달 미구현) |

## 3. Critical Findings

### C1 — file 2 (사업자등록증 PDF) sandbox 전면 차단

Claude Code harness 의 PII safety layer 가 사업자등록증 형식 PDF 의 ingest 액션을 차단. 사용자 일반 승인 (`이후 승인없이 진행`) 과 별개로 harness level 에서 거부됨. **plan §6.1 의 "6/6" 기준이 근본적으로 성립 불가** 한 구조 — 해결 옵션:

- (i) user settings.local.json 에 PII ingest 관련 Bash 허용 규칙 추가 → 사용자가 명시 승인한 경우 harness 가 통과시키도록
- (ii) plan 의 acceptance criterion 을 "5/6 + file 2 는 별도 수동 검증" 으로 완화

> C1 : plugin 환경설정에 개인정보가 포함된 문서의 ingest 실행여부 : ON/OFF

### C2 — file 3 BRN/CEO PII 유출 (plan §3.2 scope 한계)

SK 계약서 (file 3) 본문과 Chat 답변에 다음 PII 가 그대로 노출:

- 사업자번호: 119-81-95926, 301-86-19385
- CEO 성명: 이희림, 김명호
- 위치: `wiki/sources/source-c20260410-sk-biotech-eprocurement-system-contract.md`, Stage 2 답변

plan §3.2 가 파일 2 만 scope 했기 때문에 detection 을 안 한 것. **PII carve-out 을 모든 ingest 에 확장** 해야 함:

- `canonicalize` 에 person-name entity drop (CEO/대표자 스코프)
- `wiki-ops` post-write 에 BRN regex gate (감지 시 source 페이지 rollback)
- query-pipeline 에 LLM 답변 후처리 redaction

> C2 : C1에서 개인정보문서가 포함된 문서가 ingest되는 경우 개인정보를 1) Display On 2) Replace '*' 3) Disaplay Off 옵션 선택

### C3 — Audit 패널 파일 확장자 제한 (Plan 설계 mismatch)

`scripts/audit-ingest.py` 가 `.md/.txt/.pdf` 만 인식 → HWP/HWPX 파일은 Audit 패널의 Missing 리스트에 표시되지 않음. **Pass B 는 구조적으로 6 파일 커버 불가**. 옵션:

- audit-ingest.py DOC_EXTS 확장 (`.hwp`, `.hwpx` 추가)
- 또는 plan 의 Pass B 기준을 "PDF+MD 중심 경로" 로 재정의

> C3 : docling 및 unhwp가 컨버팅 가능한 모든 파일의 확장자는 통과되어야 하며, 포함되지 않은 확장자를 가진 파일은 빨간색으로 표현하고 ingest하지 않음. 아예 보이지 않는것은 오류로 보임

### C4 — startup reconcile race (Pass A, B 양쪽 재현)

main.ts:213 의 `void this.runStartupReconcile()` 가 onload 직후 실행되나 `app.vault.getFiles()` 가 빈 결과 반환 → hash 매칭 실패 → registry 갱신 누락. 10~15초 후에도 자동 재실행 없음.

- 수동 `plugin.runStartupReconcile()` 호출 시 정상 동작 (IV.B 판정 기준)
- Fix: `workspace.onLayoutReady(() => runStartupReconcile())` 또는 delayed retry

> C4 : 에러 확인 및 수정

### C5 — Stage 2 qmd index staleness race

Stage 1 완료 직후 Stage 2 쿼리 시 "위키에 관련 내용이 없어요" 반환. qmd 인덱스의 fire-and-forget 이 완료 전이라 새 wiki 페이지가 아직 검색 가능 상태 아님. 수동 `reindex.sh` 후 재질의 → 정상.

- plan §4.Common.II 는 `reindex.sh --check stale=0` gate 를 의무화하지만, 실제 UX 에선 사용자가 그 명령어 모름
- Fix: 플러그인 내부에 post-ingest reindex 완료 hook → Stage 2 입력 버튼 enable 타이밍 연동

> C5 : reindex 자동화 (ingest완료 후)

### C6 - 테스트중 사용자 모니터링 결과 수정

> CDP테스트 중 단계별 결과물에 대한 사용자 수정요구 및 모니터링 결과
>
> * 문서가 ingest후에 wiki/폴더로 들어가는 순간 "Ingest없이는 검색되지 않음, inbox를 거치지 않고 추가됨" 메시지 출력 > 정상적으로 inbox를 거쳐 이동되었음에도 경고 알람 뜸
> * 질문에 대한 응답의 하단부에 원본 링크가 대부분 보이지 않음. "참고 : wikilink만", 다음줄 "원본 : 원본backlink만" 형태로 표시 > 반드시 원본링크가 1이상 있어야 함
> * Ingest 팝업창 UI : pdf > md로 변환된 후에 ingest progressbar가 나타나면 원본 파일 표시위치 오른쪽에 " | " + "원본.md(Accent Color)"로 표시되었으면 함. 현재는 ingest가 완료된 이후에 최 상단에 파일명이 잠깐 보였다 이동함
> * Ingest 팝업창에서 ingest progressbar는 하단부 버튼 위쪽으로 이동하고 상단부분과 프로그래스바 중간에 spinning 위치. 현재는 어정쩡한 중간부분에 위치함.
> * 2-phase test에서 hwp/hwpx가 목록에서 보이지 않음. 아마 C3에 의해 일부러 차단을 해놓았던 상황으로 보임

### WARN — §4.C palette 1 entry 미스매치

Plan 은 `Wikey: Delete wiki page (dry-run)` 을 기대했지만 실제는 `Wikey: Ingest file...` 이 7번째. wiki-page 단건 삭제 커맨드 미구현.

### WARN — Cosmetic 명령 이중 prefix

`Wikey: Wikey: Delete source` 처럼 "Wikey:" 가 두 번 표시. `addCommand({ name: ... })` 에서 plugin name 을 제거하면 해결.

## 4. Phase 4 본체 완성 선언 (D 블록) 판정

**=== 보류 ===**

plan §6.1 Critical 기준 다수 미통과. 단, **핵심 기능 자체는 정상 동작** — Ingest 패널과 Audit 패널 모두 1-click 으로 Stage 1/2/3 + Chat 질의 + pairmove + IV.B 복구 가 통과됨. 5 건의 Critical finding 은 모두 **기능 결함이 아니라 safety/coverage 사각지대** 이며, plan 업데이트 또는 작은 코드 수정으로 해결 가능.

### D 선언 전제 조건 (5 건 해결)

1. file 2 sandbox 대응 정책 확정 (사용자와 합의)
2. PII carve-out 전체 확장 (canonicalize + BRN gate)
3. Audit 패널 HWP/HWPX 지원 OR plan scope 재정의
4. startup reconcile race fix (workspace.onLayoutReady 연동)
5. qmd index staleness → Stage 2 enable gate 자동화

이 5 건을 Phase 5 §5.3 (증분 업데이트 경로 강화) 및 §5.4 (variance diagnostic) 대신 Phase 4 closeout 의 D.0 수정 블록으로 추가 권장.

## 5. 리포트 파일

```
activity/phase-4-smoke-2026-04-23/
├── README.md                  # (이 문서)
├── pass-a-readme.md           # Pass A (Ingest 패널) 매트릭스
├── pass-b-readme.md           # Pass B (Audit 패널) 매트릭스
├── cross-compare.md           # Pass A/B 교차 대조
├── stage4-dump-smoke.md       # §4.C 덤 smoke 결과
└── dump/                      # (비어있음 — CDP capture-logs 를 파일로 저장하진 않음)
```

## 6. 인프라 노트

- **scripts/wikey-cdp-wrap.sh**: /tmp/wikey-cdp.py 를 isolated venv (`.venv-smoke/bin/python`) 로 실행하는 wrapper (websocket-client 의존성 격리).
- **scripts/smoke-cdp.sh**: CDP 고수준 helper (clickPanelButton, clickRowByName, waitForModalPhase, waitForNoticeText, waitForLog 등).
- **scripts/smoke-reset.sh**: smoke clean-slate helper (`init` / `between-pass` / `final` 3 mode). Pass A/B 간에 wiki 비우기 + registry 초기화 + `.ingest-map.json` 제거 + qmd purge + inbox 복원.
- **venv**: `/Users/denny/Project/wikey/.venv-smoke` (uv 로 생성, websocket-client 1.9.0 설치됨).

## 7. 다음 세션 권장 작업

1. 이 리포트 + cross-compare.md + C1~C5 findings 를 D 본체 완성 블록의 D.0 (사전 수정) 로 변환
2. Phase 4 본체 완성 선언 재시도 전 C1 (PII sandbox) + C2 (PII carve-out) 최소 2건 해결
3. Phase 5 §5.3 에 C4 (reconcile race) + C5 (qmd staleness) 이관
4. plan/phase-4-integrated-test.md 의 v6 acceptance 를 현실에 맞게 재정의 (6/6 → 5/5 + HWP Audit 지원 또는 scope 제한)
