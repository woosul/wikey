# 다음 세션 후속 작업

> 최신 갱신: **2026-04-25 session 12 종결 — §5.3 plan v11 6-step + cycle smoke 5/5 + PMS 실 ingest + 후속 follow-up 4건 + 추가 #10/#11 GAP 도 모두 fix** (회귀 584 → **648 PASS**, build 0 errors). plan v11 acceptance + 본 세션 분석에서 도출된 GAP 모두 GREEN. **다음 진입점 = §5.4.1 Stage 1 schema.yaml 외부화 (P2 비전 gate, 두 번째 표준 corpus 대기)** 또는 잔여 §5.3 follow-up (`.md.new` cleanup / dashboard UI / hash perf / section-level diff 등).
> 생성일: 2026-04-10

---

## 🎯 다음 세션 첫 액션 (2026-04-25 session 12 종료 시점)

1. `cat plan/phase-5-todo.md` — §5.3 종결 + #10/#11 fix 확인 → §5.4 진입 또는 잔여 follow-up 선택.
2. **§5.4.1 Stage 1 schema.yaml 외부화 (P2 비전 gate)** — 두 번째 표준 corpus (ISO/ITIL/GDPR 등) 등장 시 즉시 착수. PMBOK 의 v7-5 Stage 0 사전 검증 결과 (Concepts CV <15% 도달 여부) 가 gate. 현재 PMBOK 1 corpus 만 있어 진입 의미 적음.
3. **§5.3 잔여 follow-up (out-of-scope, 우선순위 낮음)**:
   - `.md.new` 자동 cleanup (P2-1) — 다음 ingest 시 사용자가 promote/삭제 한 항목 자동 detect → `clearPendingProtection`
   - dashboard/audit panel UI 시각화 — 5 신규 audit 컬럼 배지/필터
   - `user_marker_headers` config 노출 — `.wikey/wikey.conf` 에 사용자 정의 헤더 추가
   - entity/concept page user marker 보호 — LLM 결정적 출력 분석 후 도입
   - Hash perf (file size + mtime 1차 필터) — 대용량 corpus 대응
   - CLI `wikey ingest --force` `--diff-only` 플래그
   - Section-level diff (H2 단위 hash 매칭) — 부분 재인제스트
   - Tombstone restore + sidecar_hash 정합성
   - Python ↔ TS NFC 일관성 자동 검증 (cross-language smoke)
4. **§5.2.6 H2 섹션 의미 활용 (탐구)** — §5.2.0~5 적용 후 정확도 부족하면 진입 (조건부).
5. **잔여 (별개)** — `reconcile case 3` walker 누락 root cause 추적 (§5.2.9 fix 는 후속 movePair 안전망. 잘못된 walker 마킹 자체 진단은 §5.8 영역).
6. **§5.2/§5.3 작업 정책 유지** — tester 1차 + master fallback. Obsidian CDP UI smoke 가 tester 책임. 본 session 12 처럼 master 직접 cycle smoke 5-step 실행도 정상 fallback.

---

## ✅ Session 12 추가 fix (2026-04-25, follow-up #10/#11)

| # | 작업 | 결과 |
|---|------|-----|
| #10 | R==null + paired sidecar 보호 — ConflictKind 에 `unmanaged-paired-sidecar` 추가 + decideReingest Phase A/B 확장 + Hook 1/3 조건 확장 + pending_protections kind 분기 | 4 신규 test PASS (24 → 28) |
| #11 | entity/concept `## 출처` alias 표준화 — `buildPageContent` 의 wikilink 형식 변경 + 4 신규 canonicalizer test (53 → 57) + `scripts/fix-source-wikilinks.py` one-off bulk script (36 페이지 일괄 fix) | CDP unresolvedLinks 검증 lotus-pms `{}` |

---

## ✅ Session 12 종료 (2026-04-25) — 처리 완료 요약

| # | 작업 | 결과 |
|---|------|-----|
| 1 | §5.3.1 + §5.3.2 plan v11 6-step TDD (codex APPROVE_WITH_CHANGES, P1 0건) | 회귀 584 → 640 (+56), build 0 errors |
| 2 | Step 1 source-registry — 5 신규 필드 + 4 helper + reconcile duplicate-aware | 11 신규 test PASS |
| 3 | Step 2 incremental-reingest.ts 신규 — decideReingest + user-marker + sidecar protect helper | 24 신규 test PASS |
| 4 | Step 3 ingest-pipeline 통합 — Step 0/0.5/0.6 + Hook 1/2/3 + buildV3SourceMeta + IngestResult union | 5 integration test (skip 분기) PASS |
| 5 | Step 4 movePair — sidecar pre-resolve + onSidecarConflict + atomic | 6 신규 test PASS |
| 6 | Step 5 audit-ingest.py — 5 신규 array (additive) | 6 fixture shell smoke PASS exit 0 |
| 7 | Step 6 plugin entry + ConflictModal default + SkippedIngestResult type guard | cycle smoke 위임 |
| 8 | Cycle smoke 5/5 (force / skip / duplicate / force / protect+ConflictModal) | master CDP 직접, 모두 PASS |
| 9 | PMS_제품소개_R10_20220815.pdf 실 ingest (3.6MB + paired 6.4MB) | wiki 19 페이지 + registry 정상 + sidecar 보존 |
| 10 | 잔재 정리 — cycle-smoke-5-3 raw/wiki/registry/log/index 모두 + /tmp 정리 | PMS/NanoVNA 영향 0 |
| 11 | Approve & Write UX (button disable + spinner) | 다중 클릭 차단 |
| 12 | Original-link footer mode (raw/sidecar/hidden) + alias `[[<full path>\|<basename>]]` + sidecar 파일 규칙 derive | 6 신규 test PASS |
| 13 | Plugin settings UI — originalLinkMode dropdown | settings → 사용자 변경 |
| 14 | Settings i18n — 35 한글 라인 → 0 (전부 영문, 일관된 스타일) | UI 일관성 |

---

## ✅ Session 11 종료 (2026-04-25, commit `f108e0c`) — 처리 완료 요약

| # | 작업 | TDD | 결과 |
|---|------|-----|------|
| 1 | §5.2.0 paired sidecar.md UI (helper + 3 row builders + CSS + tooltip + 카운트 정정) | 17 unit | PASS |
| 2 | §5.2.5 reindex silent fail observability + race fix (waitUntilFresh 진단 / onFreshnessOk callback / post-movePair re-reindex) | (existing tests) | PASS — silent fail 자체 제거 |
| 3 | §5.2.1 ★ entity↔concept cross-link (canonicalizer applyCrossLinks helper) — analyst plan + codex APPROVE_WITH_CHANGES P1 3건 정정 반영 | 8 unit (codex P1-2 edge 3건 추가) | PASS |
| 4 | §5.2.2 답변 prompt 강화 (wikilink 1-hop 활용 + 첫 등장 [[페이지명]] + 1-hop 참고 블록 지시) | 3 unit | PASS |
| 5 | §5.2.3 검색 graph expansion (extractWikilinkBasenames + expandWithOneHopWikilinks helpers + 4-카테고리 resolve, cap 5) | 9 unit | PASS |
| 6 | §5.2.4 TOP_N 5 → 8 (config.ts + wikey.conf + query-pipeline fallback) | (regression) | PASS |
| 7 | plan/phase-5-todox-5.2.1-crosslink.md 신설 (analyst v2 — codex P1 3건 정정) + phase-5-todo.md `## 관련 문서` 등재 | — | — |
| 8 | §5.2.8 검증 (cycle smoke) — tester 분기 완료 → 4 PASS / 1 PARTIAL (495→fix) / 1 FAIL (observability ✓, qmd exit=1 = §5.8.3) | — | 4P/1Pa/1F |
| 9 | §5.2.5 + §5.2.2 fix (commit `7ae636f`) — reindex.sh stderr 보존 + buildSynthesisPrompt "충분히 풍부하게" 지시 | regression | 다음 cycle smoke 재측정 |
| 10 | §5.2.9 root cause = better-sqlite3 ABI mismatch (commit `f3dbbfa`) — `scripts/rebuild-qmd-deps.sh` 신규 + plugin defense Notice (NODE_MODULE_VERSION 패턴 감지 → specific 안내) | — | master CLI 환경 등가 검증 OK |
| 11 | §5.2.9 findCompatibleNode 명시 fallback (commit `525c488`) — `/opt/homebrew/bin/node` 등 candidate 4단계 추가. 모든 nvm 후보 ABI fail 시 homebrew v24 시도 cache | — | console `qmd 호환 node 발견: /opt/homebrew/bin/node` ✓ |
| 12 | §5.2.9 vec query hyphen → space (commit `fb88dad`) — query-pipeline.ts:251 가 `NanoVNA-V2` 같은 hyphenated word 의 `-` 를 negation 으로 오인 차단 | regression | qmd results: 5 ✓ + 답변 1533 chars + 15 wiki refs |
| 13 | §5.2.9 ingest-current-note autoMove (commit `953c9cb`) — Cmd+Shift+I 가 inbox 파일 트리거 시 `autoMoveFromInbox: true` 자동 패스 | — | inbox→raw/3_resources/60_note/600_technology/ 자동 분류 + frontmatter rewrite + 답변 backlink 새 경로 ✓ |
| 14 | §5.2.9 recordMove tombstone false 자동 (commit `aad98f8`) — `source-registry.ts:98` 가 `tombstone` field 안 건드리던 bug. `move = 파일 살아있음` 의미적 정합 | TDD 1 신규 (578/578) | 현 stale tombstone 직접 복구 + 후속 movePair 자연 복구 보장 |
| 15 | §5.2.0 v2 UI follow-up 3건 (commit `db693d4`) — [md] 뱃지 위치 (파일명 오른쪽 8px wrap) + filename tooltip 단일줄 (sidecar 생성일만) + processing modal progress group 위치 (wrap 바닥, Back 위 16px gap) | — | CDP 측정 gap=16px / Audit `All 7 / Ingested 1 / Missing 6` 정확 |
| 16 | §5.3.2 신설 — sidecar+ingest 불일치 8 시나리오 분석 (A~H 위험도 표) → §5.3 인제스트 증분 영역에서 hash diff + user marker 보호로 처리 (사용자 지시) | — | 분석만 — 구현 다음 세션 |
| 17 | §5.2.0 v3 broken state badge 오렌지 (commit `400b41f`) — 사용자 정의 (paired = ingested 분류여야 함, paired+missing = broken). list+tree 2 row builders `hasSidecar && !ingestedSet.has(file)` → badge `wikey-pair-sidecar-badge-broken` (`#ff9800`) + tooltip ⚠ 줄 prepend | — | 연관 root cause = §5.3.2 시나리오 C/D |
| 18 | result/todo §5.2.0 v2/v3 mirror 정렬 (commit `dd8e8e1`) — heading h4 통일 + commit hash 양쪽 명시 | — | mirror 일관 |

---

## ✅ Session 10 종료 (2026-04-25, commit `3f1fa6d`) — 처리 완료 요약

| # | 작업 | commit | 결과 |
|---|------|--------|------|
| 1 | §5.1.2 Phase A — over-mask 4건 fix (bundled YAML 13 라벨 + same-line 전체 토큰) + 회귀 테스트 2건 | `5e32ec4` | 539/539 pass |
| 2 | §5.1.2 Phase B — codex P2 (candidate vs context-label 분리) + P3 (canonicalizer.test.ts placeholder) | `3f1fa6d` | 540/540 pass |
| 3 | example-placeholders.ts 신규 모듈 + 5 파일 7 ref import 교체 (canonicalizer/schema/ingest-pipeline) | `3f1fa6d` | production goodstream/굿스트림/lotus-pms/kim-myung-ho 0 hits |
| 4 | §5.1.3 Master 직접 Obsidian CDP UI 1-cycle smoke (NanoVNA 1 파일) | (master 직접 실행, commit 무관) | 5 entities + 9 concepts + 1 source + citation 4건 + 원본 backlink |
| 5 | obsidian-cdp 신규 스킬 (`~/.claude/skills/obsidian-cdp/SKILL.md`) — full cycle 절차 + Brief Proceed / Preview Approve & Write 모달 셀렉터 + Query 검증 + 6-파일 통합 smoke 참조 | (home scope) | 시스템 인식 (skill list) |
| 6 | tester.md 업데이트 — CDP UI smoke 1차 책임 (다음 세션부터) | (home scope) | — |
| 7 | 메모리 4건 신설 — circled-numbers 금지 / no-defer / modal-proceed / reuse-prior-artifacts | (home scope) | MEMORY.md 인덱스 update |

---

## ✅ Post-compact 처리 완료 (2026-04-25 session 9)

핸드오프 (`plan/post-compact-handoff.md` — 작업 완료 후 삭제됨) 의 ①⑤⑥ 모두 처리:
- **① over-masking 4건** — bundled YAML `ceo-multiline-form.valueExcludePrefixes` 13종 추가 + `isCandidateExcluded` 가 same-line 모든 토큰 검사. `pii-over-mask-prevention.test.ts` 회귀 방지. 검증: `ceo-blank-line.md → ['홍 길 동']` / `ceo-table-cell.md → ['이 영 희']` (4건 → 0건).
- **⑤ memory** — `project_phase5_status.md` §5.1 done 섹션 append + MEMORY.md 인덱스 1줄 갱신.
- **⑥ todo** — `phase-5-todo.md §12 E1/E2.b/E3` `[x]` (master 직접 CDP smoke), `§5.1.1.11` `[~]` (selective skip), `wiki 재생성 없음` `[x]`, 신규 `§5.1.1.12` over-mask fix `[x]`.
- **검증**: `npm test` **539/539 passed** (537 + 신규 over-mask 2). build ok.

<details>
<summary>처리 전 핸드오프 원문 (참고용 archive)</summary>

### ① ceo-structural over-masking 4건 — 수정

**증거 (master CDP smoke 2026-04-25 03:25, dist runtime 실측)**:
```
ceo-blank-line.md:
  ceo-structural → "홍 길 동"   (true positive ✅)
  ceo-structural → "등기일"     (false positive ❌ over-mask)

ceo-table-cell.md:
  ceo-structural → "이 영 희"   (true positive ✅)
  ceo-structural → "주소"       (false positive ❌)
  ceo-structural → "서울시 어"  (false positive ❌, OCR-style chunked)
  ceo-structural → "딘가"       (false positive ❌, OCR-style chunked)
```

**원인**: `wikey-core/src/defaults/pii-patterns.default.yaml` 의 `ceo-multiline-form` 패턴
```yaml
valuePattern: '[가-힣](?:[ \t]*[가-힣]){1,3}'   # 한글 2~4자, 공백 허용
valueExcludePrefixes:
  - '주식회사' / '(주)' / '㈜' / '유한회사' / '재단법인' / '사단법인' / '유한책임회사'
```
→ 회사명 접두어만 처리. **common field label 단어 (주소·등기·전화·담당·접수·이메일·fax)** 와 **OCR 잘림 어절** 은 제외 대상 아님.

**수정 옵션 (선택)**:
- (a) **valueExcludePrefixes 에 common label 추가** (가장 간단, YAML 1줄 추가):
  ```yaml
  valueExcludePrefixes:
    - 주식회사 / (주) / ㈜ / 유한회사 / 재단법인 / 사단법인 / 유한책임회사
    - 주소 / 전화 / 휴대 / 담당 / 접수 / 등기 / 등록 / 이메일 / 팩스 / 우편 / 사업
  ```
  부작용: 한글 단어 무한 확장. 그러나 PII 와 충돌 안 함 (이름 아님)
- (b) **valuePattern 엄격화** (이름은 보통 공백 포함 또는 3자):
  ```yaml
  valuePattern: '[가-힣]{2,4}(?![가-힣])|[가-힣][ \t]+[가-힣](?:[ \t]*[가-힣]){0,2}'
  # OR: 공백 포함 이름만 (`홍 길 동`). 붙여쓰기 (`홍길동`) 는 single-line ceo-label 이 처리
  ```
  부작용: `홍길동` 붙여쓰기 매치 불가. but Phase 4 D.0.l 실누출은 모두 공백 포함 형식.
- (c) **label heuristic** (matcher 로직 변경): valueMatch 직후 colon 또는 newline 만 있으면 label 로 간주, 매치 skip.
  부작용: 코드 변경 (pii-redact.ts), 테스트 추가 필요.

**권고**: (a) 선택 — YAML 1줄 추가로 즉시 해결. 새 `over-mask-prevention.test.ts` 케이스 2개 (등기일·주소 over-mask 가 0 으로 sanitize) 추가. 누출 검증은 기존 7 fixture 유지.

**검증 명령** (수정 후 실행):
```bash
cd /Users/denny/Project/wikey/wikey-core && npm run build && \
node --input-type=module -e "
import { loadPiiPatterns } from './dist/pii-patterns.js'
import { detectPii } from './dist/pii-redact.js'
import { readFileSync } from 'node:fs'
const p = await loadPiiPatterns()
for (const f of ['ceo-blank-line.md','ceo-table-cell.md']) {
  const t = readFileSync('src/__tests__/fixtures/pii-structural/'+f,'utf8')
  const struct = detectPii(t,p).filter(m=>m.kind.includes('structural')).map(m=>m.value)
  console.log(f+':', struct)
}
" && npm test
```
**기대**: ceo-blank-line `['홍 길 동']` (1개), ceo-table-cell `['이 영 희']` (1개), 537+ tests pass.

### ⑤ memory 업데이트

**대상**: `~/.claude/projects/-Users-denny-Project-wikey/memory/project_phase5_status.md` (이미 존재 — update) + `MEMORY.md` 인덱스 1줄 갱신.

**기존 status 확인 명령**:
```bash
cat ~/.claude/projects/-Users-denny-Project-wikey/memory/project_phase5_status.md
```

**append 할 내용** (§5.1 완료 status):
```markdown
## §5.1 구조적 PII 탐지 — 완료 (2026-04-25 session 9, commit 2da88cb)

- 안 C (Context window heuristic) + multi-value capture + valueExcludePrefixes 채택
- discriminated union (`PiiPattern = SingleLinePiiPattern | StructuralPiiPattern`, `patternType` discriminator)
- 537/537 tests · build ok · FP baseline 0/30
- master CDP smoke (Obsidian `--remote-debugging-port=9222`) PASS — PII 누출 차단 7/7 fixture
- 계획 v1→v4 (codex 4 cycle, gpt-5.5 xhigh Mode D Panel) — v4 PASS 0 findings
- Follow-up: ceo-structural over-masking 4건 (post-compact 처리 예정), canonicalizer.ts L270/276 few-shot `굿스트림` defer
```

**MEMORY.md 인덱스** (한 줄 추가):
```
- [§5.1 done](project_phase5_status.md) — 구조적 PII commit 2da88cb (2026-04-25)
```

### ⑥ phase-5-todo.md §5.1 잔여 체크박스 mark

**현재 상태 (2026-04-25 03:25 grep)**:
```
§5.1.1.1~10 + §5.1.1.3.5    →  [x] 모두 완료 ✅
§5.1.1.11 (selective)       →  [ ] selective skip (E7a fixture 0/30 가 mandatory 충족)
§12 E1/E2.b/E3 live smoke   →  [ ] tester 위임으로 작성 — 사실 master 직접 CDP smoke 로 처리됨
wiki 재생성 없음 확증        →  [ ] 코드 1단 추가 (collectStructuralMatches 만), wiki 무변경
```

**처리 작업**:
1. **§12 E1/E2.b/E3** → `[x]` 로 mark + 노트: "master 직접 CDP smoke (commit 2da88cb), Obsidian `--remote-debugging-port=9222` 기동 후 dist runtime end-to-end. fixture 7종 누출 차단 + baseline FP 0/30. wiki/sources·entities pre-check BRN/CEO 0 hit."
2. **§5.1.1.11** → `[~]` 또는 주석 갱신: "selective skip 결정 — `live wiki baseline` 경로 미사용. 향후 wiki 규모 확대 시 reopen."
3. **wiki 재생성 없음 확증** → `[x]` mark + 노트: "ingest 경로 변경 = `pii-redact.ts::detectPiiInternal` 에 structural 분기 추가 1건 (sanitizeForLlmPrompt API 시그니처 호환). 기존 wiki 무변경, `applyPiiGate` 외부 호출 형태 유지."

</details>

---

## 2026-04-25 session 9 종료 시점 — **Phase 5 §5.1 (P0 긴급) 구현 완료 + 스킬·agent 인프라 정비**

**상태**: `plan/phase-5-todo.md §5.1.1.1~10` 전부 `[x]`. 537/537 tests pass · build ok · FP baseline 0/30 · 하드코딩 0 hits. E1 live smoke 만 Obsidian CDP 미구동으로 deferred.

**세션 9 성과**:

1. **계획 v1→v4 (codex 4 cycle)**: §5.1 계획서 codex (gpt-5.5 xhigh, Mode D Panel) 가 v1 (8 findings) → v2 (9) → v3 (6) → **v4 PASS**. 핵심 결정: 안 C (Context window heuristic) + multi-value capture + valueExcludePrefixes (YAML 선언) + windowLines 5 non-empty + structuralAllowed=false explicit + bundled YAML default + loader ESM.
2. **Master 1차 sanity check 원칙 정립** (사용자 피드백 "analyst 위임해도 1차 검증 필수"): codex 송부 전 master 가 grep/diff 로 (a) 용어 일관성 (b) 하드코딩 0 (c) changelog vs 본문 (d) line drift (e) 요구사항 반영 5축 점검. v4 PASS 1회 확보 — v1~v3 재작업 사이클 효과 입증.
3. **developer (claude-panel)**: §5.1.1.1~10 + §5.1.1.3.5 (loader ESM 전환 신규) 11 단계. discriminated union (`PiiPattern = SingleLinePiiPattern | StructuralPiiPattern`, `patternType` discriminator), `collectStructuralMatches` (multi-value + same-line prefix exclude + non-empty windowLines), bundled YAML (`new URL('./defaults/...', import.meta.url)` + build hook copy).
4. **tester (claude-panel)**: 9/11 E# PASS · 회귀 0 · 신규 이슈 0. E1/E2b/E3 만 Obsidian CDP 미가용으로 skip.
5. **인프라 스킬 정비** (사용자 피드백 다수):
   - **`cmux-control` 스킬 신설**: panel/surface/tab 명령 카탈로그 + 6 함정 (stdout/stderr 혼합 · classify scrollback 한계 · wait false positive · Monitor regex · kill-pane 미지원 · focus 부작용) + 가상 격자 좌표 `(col, row)` = `(가로, 세로)` + 생성순서 규칙 `(1,0)→(2,0)→(2,1)→(1,1)→(3,0)→(3,1)→...`.
   - **codex/claude-panel/gemini-panel SKILL.md**: "완료 자동 알림 패턴" (run_in_background + task-notification 자동 수신, Monitor polling 금지) · "패널 이름 필수 지정" · "master 1차 검증 필수" 섹션 추가. crosslink to cmux-control.
   - **claude-panel/panel-dispatch.sh**: role-based permission-mode 자동 분기 (developer/tester/ui-designer/refactor-cleaner/doc-updater/build-error-resolver → acceptEdits, 그 외 plan), output-format default `text` (이전 stream-json 의 JSON raw 가독성 문제 해결).
   - **agent 정의 (analyst/reviewer/developer/tester/ui-designer)**: master 1차 sanity 의무 + run_in_background 호출 의무 명시.
6. **plan/plan-full.md 분리**: 기존 `prompt_plan.md` (Phase 3 Obsidian 플러그인 설계서) → `plan/phase-3-full.md` 로 이전. `plan/plan-full.md` 신규 (전체 6-Phase 로드맵 + Agents 운영 체제 + 문서 조직 규칙).

**다음 세션 진입점**:

- **§5.1 live smoke (E1/E2/E3)** — ✅ **2026-04-25 master 직접 수행 완료**. Obsidian CDP 기동 + dist runtime 에서 fixture 7종/baseline 30종 end-to-end 실행, PII 누출 차단 7/7 + FP 0/30 확증. wiki pre-check BRN/CEO 0 hit.
- **§5.1 quality follow-up (신규 subject)** — ceo-structural over-masking 이슈 (라벨 단어 `주소`·`등기일`·`서울시 어`·`딘가` 오인 매치 4건, fixture CDP smoke 에서 발견). 누출은 차단되지만 sanitize 초과 → 본문 damage. 수정 방향: (a) `valueExcludePrefixes` 에 common field label 추가 (YAML 선언) (b) `valuePattern` 을 "공백 포함 한글 이름" 으로 엄격화 `[가-힣][ \t]+[가-힣](?:[ \t]*[가-힣]){0,2}` (c) 이름 vs label 구별용 heuristic (label 뒤 colon 이면 label 로 간주). 다음 세션에서 선택.
- **§5.2 검색 재현율 + §5.3 인제스트 증분 (P1 핵심)** — Anthropic contextual chunk / hash 기반 증분.
- **§5.4.1 Stage 1 schema.yaml 로더화 (P2 비전 gate)** — PMBOK 하드코딩 외재화.
- **인프라 follow-up**:
  - cmux pane border color 가 ghostty `split-divider-color` 와 동기화 안 됨 (cmux 자체 settings.json `workspaceColors` 조사 필요).
  - claude-panel text 모드는 완료 시 일괄 출력 — 실시간 가독성 원하면 stream-json + jq/python pretty-print wrapper 추가.
  - `panel-dispatch.sh pick` 의 `--direction right` 고정이 grid 규칙 위반 → master 가 매번 재배치. 자동화 검토.
  - **자동 세션 핸드오프 (PreCompact hook)** — 다음 세션에서 update-config 스킬로 settings.json 에 hook 추가.
- **읽기 권장**:
  - `plan/phase-5-todox-5.1-structural-pii.md` v4 (계획서 단일 소스, codex PASS)
  - `activity/phase-5-result.md §5.1` (구현 결과 타임라인)
  - `~/.claude/skills/cmux-control/SKILL.md` (panel 운영 공통 레퍼런스)

---

## 2026-04-24 session 8 종료 시점 — **Phase 4 본체 완성 + PII 엔진 도입**. 다음 = Phase 5

**상태**: `plan/phase-4-todo.md` D.0.a~o 전부 `[x]`, D.1~D.5 본체 완성 선언 블록 완료. `activity/phase-4-result.md §4.8` 블록 append. 525 tests / 0 build errors.

**세션 8 성과**:
1. D.0.k codex Panel Mode D 재검증: 1차 REJECT / CRITICAL: 1 → 3건 수정 (commit `c2f4165`) → 재검증 APPROVE / CRITICAL: 0.
2. D.0.l Agent 위임 smoke (~2h 10m): Pass A/B 6/6 pipeline PASS + 보조 2b/3b PASS + §4.C PASS + D.0.m sidecar grep PASS. wiki body PII 전파 2건 (C-A1 filename + C-A2 CEO 공백) 발견.
3. D.0.n capabilities.json runtime bug fix (`node:fs/promises` → `require`, commit `e362d3c`) + reindex 3-status 수동 유도 확증.
4. **PII 패턴 엔진 도입** (사용자 지시 "하드코딩 안됨"): `pii-patterns.ts` 신규 (YAML loader + DEFAULT_PATTERNS + user override) + `sanitizeForLlmPrompt` 단일 진입점. `brn-hyphen` look-around (`_` 경계) + `ceo-label` 단일라인 공백 변형. C-A1 완전 해결 / C-A2 단일라인 해결 / multi-line 구조 폼은 Phase 5 §5.1 (P0, 우선순위 재조정) 신규.
5. Audit row error Notice UI info-column 이동 — filename 공간 보존 (사용자 피드백).
6. **Phase 5 우선순위 기반 전면 재번호** (session 8 말미, 사용자 요청): §5.1~§5.9 를 긴급도·성능영향·의존성 3축으로 재배치. §우선순위 가이드 섹션 신설. 이전 번호는 각 섹션의 `이전 번호: was §5.N` 주석으로 추적.

**다음 세션 진입점 — Phase 5** (재번호 반영):
- **§5.1 구조적 PII (P0 긴급)** — multi-line 폼 label↔name 상관 해결. NER / table parser / context-window heuristic 중 선택 조사. D.0.l 에서 발견된 실누출 케이스 대응.
- **§5.2 검색 재현율 + §5.3 인제스트 증분 (P1 핵심)** — Anthropic contextual chunk / hash 기반 증분 재인제스트.
- **§5.4.1 Stage 1 schema.yaml 로더화 (P2 비전 gate)** — PMBOK 하드코딩 외재화. self-extending 로드맵의 첫 실 구현 단계.
- **읽기 권장**:
  - `plan/phase-5-todo.md` § 우선순위 가이드 + §5.1 + §5.4 + §5.8
  - `activity/phase-4-result.md §4.8` (완성 선언 증거)
  - `activity/phase-4-resultx-4.6-smoke-2026-04-24-v2/README.md` (smoke PARTIAL ACCEPT 상세)
  - memory `feedback_pii_no_hardcoding.md` (PII 코딩 원칙)

---

## 2026-04-24 session 7 종료 시점 — (완료 → session 8 으로 계승)

**Todo 단일 소스 = `plan/phase-4-todo.md` D.0 블록 (D.0.a~o) + D 본체 완성 선언 블록.** 여기에는 세션별 진입 맥락 · 명령어 hint · 변경 snapshot 만 기록.

### 진입 맥락

- 구현 상세: `activity/phase-4-result.md §4.7`.
- 구현 계획·경계: `plan/phase-4-todox-4.6-critical-fix-plan.md` v6 (구현 완료된 diff 기준으로 codex 재검증 필요).
- 체크박스 상태: `plan/phase-4-todo.md` — a~j `[x]` / k~o `[ ]` / D.1~5 (본체 완성 선언) `[ ]` (2026-04-24 session 7).

### 다음 세션 목표 — **단일 세션에서 Phase 4 본체 완성 선언**

구현은 완료 (session 7) 되었고 남은 것은 검증 + 선언 문서 작업이므로 **분할 없이 1 세션에서 완주**. 예상 ~3~4h. 순서:

1. D.0.k — codex Panel Mode D 재검증 (구현 diff 기반, cmux panel, ~30min)
2. D.0.l — 통합 smoke 재실행 (Pass A 6/6 + Pass B 6/6 + 보조 2b/3b, CDP 자동, ~1.5h)
3. D.0.m — PDF sidecar redact grep (`***` 확인, ~10min)
4. D.0.n — 런타임 sanity (`capabilities.json` 생성 + `reindex.sh --check --json` 3-status 수동 유도, ~15min)
5. D.0.o — `activity/phase-4-resultx-4.6-smoke-<DATE>-v2/README.md` 작성 (~30min)
6. D.1~D.5 — `activity/phase-4-result.md` 맨 아래 "Phase 4 본체 완성 선언" 블록 + todo 상단 "본체 완성" 상태 + Phase 5 §5.6 Stage 1 착수점 고정 + memory "완료" + 단일 commit `feat(phase-4): 본체 완성 선언 ...` + push (~45min)

**분할 조건**: D.0.k 에서 codex 가 CRITICAL 발견 → 구현 수정 필요 → 그 시점에만 세션 분할. 그 외 경우는 **연속 완주가 기본**.

### 다음 세션 시작 시 체크

1. `git pull` → 최근 commit (`684455b` rules 분리) 확인
2. `cd wikey-core && npx vitest run` → **511 passed / 25 files** 확인 (회귀 없음)
3. `npm run build --workspaces` → 0 errors (wikey-core tsc + wikey-obsidian esbuild)
4. Obsidian Cmd+R → 플러그인 reload → `ls -la ~/.cache/wikey/capabilities.json` 생성 확인 (D.0.n 선행)
5. cmux panel 준비 → codex Panel Mode D (D.0.k 로 착수)

### smoke 재실행 시나리오 (D.0.l 의 보조 자료)

| 파일 | Guard | Allow | RedactMode | 기대 결과 |
|------|-------|-------|-----------|----------|
| 1. llm-wiki.md | ON | OFF | mask | 정상 (PII 없음) |
| 2. 사업자등록증.pdf | ON | **ON** | mask | redact 후 ingest (BRN `***`), sidecar `*.pdf.md` 에도 `***` |
| 3. SK 계약서.pdf | ON | **ON** | mask | redact 후 ingest (BRN/CEO `***`), sidecar 에도 `***` |
| 4. PMS.pdf | ON | OFF | mask | 정상 |
| 5. 스마트공장.hwp | ON | OFF | mask | 정상 |
| 6. Examples.hwpx | ON | OFF | mask | 정상 |
| 보조 2b | **OFF** | — | — | 원문 그대로 (advanced skip 확인, sidecar 에 원문 BRN 잔존) |
| 보조 3b | ON | **OFF** | — | **PiiIngestBlockedError Notice** (strict 확인) |

### 세션 7 미커밋 변경 목록 (commit 전 snapshot)

- 신규 (5): `wikey-core/src/pii-redact.ts`, `wikey-core/src/capability-map.ts`, 3 test 파일 (`pii-redact.test.ts`, `capability-map.test.ts`, `scripts-runner.test.ts`)
- 수정 (12): `wikey-core/src/{ingest-pipeline, scripts-runner, source-resolver, query-pipeline, index}.ts`, `wikey-core/src/__tests__/query-pipeline.test.ts`, `wikey-obsidian/src/{main, commands, settings-tab, ingest-modals, sidebar-chat}.ts`, `wikey-obsidian/styles.css`, `scripts/audit-ingest.py`, `scripts/reindex.sh`
- 빌드 산출물 (2): `wikey-obsidian/main.js`, `wikey-obsidian/styles.css`
- 문서 (6): `activity/phase-4-result.md` (§4.7 append), `plan/phase-4-todo.md` (D.0 체크박스 + 상단 상태), `plan/phase-4-todox-4.6-critical-fix-plan.md` §7 (todo 이관 — phase-4-todo 참조로 대체), `wiki/log.md` (신규 엔트리), `plan/session-wrap-followups.md` (본 섹션 갱신), memory 2개

---

## 2026-04-23 session 5 종료 시점 — ~~A 통합 smoke + D 본체 완성~~ (완료 → §4.6 D.0 으로 전환됨)

### ⭐ 다음 세션 플레이북 (4.5~7 시간, 세션 분할 권장)

**진입점**: Phase 4 본체 완성 체크리스트의 **A (Phase 1~4 통합 smoke, 2-pass)**. **단일 소스 = `plan/phase-4-todox-4.6-integrated-test.md` (v6, codex Panel Mode D APPROVE-WITH-CHANGES)**. 실행 주체 = **Claude (CDP localhost:9222 + wikey-cdp.py)**. 사용자 개입 없음. 6종 파일 × 3-stage × 2-pass → 리포트 → D (완성 선언) 실행.

| 블록 | 상태 | 작업 |
|------|------|------|
| **A** | 🔴 대기 | Phase 1~4 통합 smoke 2-pass (Claude CDP 자동). Pass A (Ingest 패널, 6파일, Ingest+Move 2-step) → smoke-reset → Pass B (Audit 패널, 6파일, Ingest 1-step 자동 이동) → §4.C 덤 smoke. 상세: `plan/phase-4-todox-4.6-integrated-test.md` v3. |
| **B** | 🟢 완료 | §4.5.2 삭제 안전장치 — `reset.ts::computeDeletionImpact` + `DeleteImpactModal` + `registerDeleteCommand` 2 palette entries (462→474 tests) |
| **C** | 🟢 완료 | §4.5.2 초기화 기능 — `reset.ts::previewReset` + `ResetImpactModal` + `registerResetCommand` 5 palette entries + `renderResetSection` Settings Tab |
| **D** | 🔴 A 뒤 | 본체 완성 선언 — result 끝 "Phase 4 본체 완성 선언" 블록 + todo 상단 상태 라인 "본체 완성" 갱신 + `plan/phase-5-todo.md §5.6 Stage 1` 첫 착수점 고정 + memory + 단일 commit push |

**Session 5 완료 내역** (detail: `activity/phase-4-result.md §4.5.2` + `plan/phase-4-todox-4.6-integrated-test.md`):
- **§4.5.2.1 삭제 안전장치** — `wikey-core/src/reset.ts::computeDeletionImpact` + 6 vitest. `wikey-obsidian/src/reset-modals.ts::DeleteImpactModal` + `commands.ts::registerDeleteCommand` (raw source picker + wiki-page active file). `DEL <id>` 타이핑 확인.
- **§4.5.2.2 초기화 기능** — `reset.ts::previewReset` + `ResetScope` 5-way + 6 vitest (unknown scope 방어 포함). `ResetImpactModal` + `registerResetCommand` 5 palette entries + `settings-tab.ts::renderResetSection`. `RESET <SCOPE>` 타이핑 확인.
- **통합 smoke 계획서 v2 수립** — `plan/phase-4-todox-4.6-integrated-test.md` 556 라인. codex Panel Mode D 피어리뷰: 초기 REJECT 4 P1 → v2 반영 후 APPROVE-WITH-CHANGES. 6종 파일 (llm-wiki.md / 사업자등록증 PDF (PII) / SK바이오텍 계약서 6p / PMS 31p / HWP / HWPX) × 3-stage 반복.
- **검증**: `npm test` 22 files / 474 tests passed · `npm run build` 0 errors · commits `188a507` + `9e9407b`.

### 🔴 A 통합 smoke 절차 (v3, 2-pass, Claude CDP 자동)

**실행 단일 소스**: `plan/phase-4-todox-4.6-integrated-test.md` v3. 상세는 계획서 참조.

1. **환경 준비**: Obsidian `--remote-debugging-port=9222 --remote-allow-origins=*` 로 기동 → `curl localhost:9222/json` 응답 확인 → `cp -a raw/0_inbox/ /tmp/wikey-smoke-inbox-backup/` 로 백업 → `scripts/smoke-reset.sh` 초기화 → Settings baseline (Ingest Briefs=Always, Verify=ON, Auto Ingest=OFF) → Cmd+R.
2. **§4.0 UI pre-smoke** (Pass A 진입 전 1회만): Chat/Ingest/Audit 패널 · provider/model 편집 · DEFAULT 라벨 · 500px 폭 · `/clear`.
3. **Pass A — Ingest 패널 (6 파일 루프)**: 각 파일마다 §7.4.a CDP snippet 시퀀스 실행 — Ingest 버튼 click → Brief/Processing/Preview/Confirm → Notice 대기 → Move 버튼 click → post-ingest movePair → Index-ready gate → Stage 2 (§7.4.c) → Stage 3 (§7.4.d shell mv). 각 파일 `pass-a-file-<N>-*.md` 리포트.
4. **clean-slate**: `bash scripts/smoke-reset.sh` → inbox 6개 복원 + wiki 비우기 + registry 초기화 + qmd purge.
5. **Pass B — Audit 패널 (6 파일 루프)**: 각 파일마다 §7.4.b snippet — Audit 패널 체크 → Ingest 버튼 click (자동 이동) → Notice 대기 → Index-ready gate → Stage 2 → Stage 3. `pass-b-file-<N>-*.md` 리포트.
6. **§4.C 덤 smoke** (1회): 팔레트 7 entries + Delete/Reset modal sequence → typing gate 직전 Cancel.
7. **리포트 집계**: `pass-a-readme.md` + `pass-b-readme.md` + `cross-compare.md` + 최종 `README.md` + `dump/*.log` 6×2.
8. **파일 2 PII 주의**: §3.2 redaction — 질문은 "업종·소재지(시/도)" 만. 답변·mentions·wiki 에 PII 포함 시 FAIL + rollback + 그 파일의 Pass 재실행.
9. **Acceptance** (§6): Pass A 6/6 + Pass B 6/6 + tier-label 6/6 일치 + PII 0 + Console ERROR 0 → D 실행 가능.

### 🛠 실행 전 준비 스크립트 (계획서에만 정의, 아직 미생성)

- `scripts/smoke-reset.sh` — clean-slate 헬퍼. 계획서 §2.1.1 참조. 세션 시작 전 생성 필요.
- `scripts/smoke-cdp.sh` — CDP click/type/wait wrapper. 계획서 §7.2 참조. 세션 시작 전 생성 필요.

### ⚠️ 세션 분할 권장

4.5~7 시간은 단일 세션 context 에 부담. 권장 분할:
- **Session X**: Pass A 완료 + pass-a-readme.md.
- **Session X+1**: clean-slate → Pass B → §4.C → cross-compare → 최종 README + D 본체 완성 선언.

---

## 2026-04-23 session 4 종료 시점 — **다음 세션은 Phase 4 종료** (아카이브)

### ⭐ 다음 세션 플레이북 (한 세션 내 완결 목표)

**진입점**: 이 세션은 **Phase 4 본체 완성 선언 세션**. `plan/phase-4-todo.md` 맨 아래 **"Phase 4 본체 완성 체크리스트"** 를 단일 소스로 따른다. 3 블록 (A/B/C) 모두 완료 후 D (완성 선언) 실행.

| 블록 | 작업 | 예상 시간 |
|------|------|----------|
| **A** | §4.3 통합 smoke (Obsidian UI 수동) — 5 체크리스트 | ~30 분 |
| **B** | §4.5.2 삭제 안전장치 (TDD, `reset.ts` + commands) | ~2~3 시간 |
| **C** | §4.5.2 초기화 기능 (TDD, 5-way scope) | ~2~3 시간 |
| **D** | 본체 완성 선언 (result/todo/plan/memory 동기화 + commit) | ~30 분 |

**시작 체크**: Obsidian 1.12.7 구동 가능 여부 + `~/.codex/` 전역 세션 충돌 없음 (`bash ~/.claude/skills/codex/preflight.sh` exit 0 확인) + Gemini API 키 quota 잔량.

**수동 UI smoke 가 A 의 유일한 리스크**: Obsidian 플러그인 리로드 필요 (`Cmd+R`), 인제스트 1 건 ~5 분 + citation 클릭 3경로 확인 ~10 분. 실패 시 `activity/phase-4-result.md §4.3.smoke` 에 재현 방법 기록 + `plan/phase-4-todo.md` fix 항목 추가 → 수정 후 재시도.

### Session 4 완료 내역 요약 (detail: `activity/phase-4-result.md §4.3.1 / §4.3.2.3 / §4.3.codex-verify`)

Session 4 에서 **§4.3.2 Part B (source-resolver + citations + sidebar 보조 링크)** + **§4.3.1 (3-stage prompt override)** 구현 완료. plan v3 가 완료 스냅샷 + codex 2차 timeout 기록 + v2 self-review 4건 ↔ 실구현 1:1 매핑 제공 (`plan/phase-4-todox-4.3-plan.md §12`).

**Session 4 완료 내역** (detail: `activity/phase-4-result.md §4.3.1 / §4.3.2 Part B`):
- **Part B — 쿼리 응답 원본 backlink**
  - `wikey-core/src/source-resolver.ts` 신규 (~165 라인) + 11 vitest (happy / bare id / absolutePath / 미등록 / 부재 / 빈 입력 / tombstone / PARA 이동 / external uri-hash / sync / sync miss)
  - `query-pipeline.ts` citations 구조화 + 6 vitest (buildCitationFromContent 4 + collectCitationsWithWikiFS 2)
  - `sidebar-chat.ts::attachCitationBacklinks` — wikilink 뒤 `📄` 보조 버튼 + 3-dispatch (tombstone Notice / external window.open / internal openLinkText)
  - `styles.css .wikey-citation-link` 철학 가드 (`0.68em` + `opacity: 0.7` + tombstone grayscale)
- **§4.3.1 — 3-stage prompt override**
  - 경로 상수 + `loadEffectiveStage1/2/3Prompt` + `BUNDLED_STAGE2_MENTION_PROMPT`
  - `canonicalizer.ts::buildCanonicalizerPrompt` optional `overridePrompt?: string` (plan v2 §4.4)
  - `settings-tab.ts::renderIngestPromptSection` 3-stage 리팩토링 + `renderPromptRow` 헬퍼 + inline hints
  - vitest +9 (stage loaders) + canonicalizer +2 (full replacement + whitespace ignore)
- **ancillary**: Part A session 3 커밋 `4588ea2` 의 tsc readonly 회귀 4 errors 를 `parseProvenance` local builder 패턴으로 수정 (master HEAD 도 동일 문제였음).
- **codex rescue 2차 `bsmflco7z`**: 1차 `b2p8s3sgq` 와 동일하게 analysis 턴 후반 freeze (8794 bytes 에서 15분 무활동). self-review 4건 + vitest 463 green + pair-move smoke 6/6 으로 가드 대체 확증.
- 증거: wikey-core 437 → **463 PASS (+26)** · `npm run build` 0 errors (wikey-core tsc + wikey-obsidian esbuild).

### 🔴 §4.3 통합 smoke — Obsidian UI 수동 확인 (다음 세션)

`plan/phase-4-todox-4.3-plan.md §12.4` 에 5개 체크리스트. 요점:

```
1. Part B 보조 링크 렌더 — 소스 인제스트 → 답변 wikilink 뒤 📄 → 클릭 시 원본 열림
2. Part B external URI — uri-hash 기반 source 에서 📄 → 새 창
3. Part B tombstone — 원본 삭제 후 기존 답변 📄 → Notice + grayscale
4. §4.3.1 Stage 2/3 override — Ingest Prompts 섹션 Edit/Reset 동작
5. §4.3.3 source 페이지 본문 strip — 인제스트 후 wiki/sources/source-*.md 에 깨진 wikilink 없음
```

확인 후 결과를 `activity/phase-4-result.md §4.3.x.smoke` 에 기록.

Session 3 는 `plan/phase-4-todox-4.3-plan.md` v2 확정 (codex rescue 가 analysis 턴에서 최종 응답 캡처 실패 → self-review 4건 보강) + **Part A (Provenance data model)** + **§4.3.3 (stripBrokenWikilinks source 페이지 재후처리)** 완료. **다음 세션 진입점은 §4.3.2 Part B (source-resolver + citations + sidebar 렌더) + §4.3.1 (Stage 2/3 prompt override + settings UI)** — Phase 4 본체 완성 직전 마지막 단계.

**Session 3 완료 내역** (detail: `activity/phase-4-result.md §4.3`):
- **plan v2 수립**: Part A / Part B / §4.3.1 / §4.3.3 설계. self-review 4건 (Obsidian Electron API / canonicalizer 시그니처 optional / Preview 모달 순서 / Stage 1 override 가이드) + open question 5건 decision.
- **Part A** (§4.3.2): `types.ts ProvenanceType union + ProvenanceEntry` + `wiki-ops.ts::injectProvenance` (dedupe + frontmatter 보존, vitest +3) + `ingest-pipeline.ts` Stage 2/3 배선 (canonicalize 모든 페이지에 `{type:extracted, ref:sources/<id>}` 자동 주입) + `index.ts` export.
- **§4.3.3**: ingest-pipeline 에서 canonicalize 완료 후 + Preview 모달 호출 이전 `stripBrokenWikilinks(source_page.content, keepBases)` 배선. Preview/저장본 bit-identical 보장.
- 증거: wikey-core 434 → **437 PASS (+3)**, build 0 errors.
- 커밋: `4588ea2` (Part A + §4.3.3 feat), 이번 세션 마무리 커밋 (docs 동기화).

### 📜 Session 3 아카이브 참조 (아래는 session 3 마무리 시점의 후속 작업 원본 — 완료된 항목 포함)

> ⚠ **session 4 재설계 주의**: 이 아카이브의 "S3-3 Audit Re-classify 토글 UI" + "S3-4 CLASSIFY.md 피드백 append" 는 2026-04-23 session 4 (commit `54f05b9`) 에 **전량 철회**되었습니다. 최종 구현은 `classify.ts::ClassifyFileOptions.paraRoot` 옵션 + `swapParaRoot` + LLM prompt 필수 제약 블록 3축으로 단순화. 현행 기능/UI 상태는 `plan/phase-4-todo.md §4.2.3` + `activity/phase-4-result.md §4.2.3.3/§4.2.3.4` 를 단일 소스로 참조.

### 🔴 Part B — 쿼리 응답 원본 backlink 렌더링 (다음 세션 착수)

상세 설계: `plan/phase-4-todox-4.3-plan.md §3`. 의존성: Part A + §4.2 source-registry — 둘 다 완료.

```
1. wikey-core/src/source-resolver.ts 신규
   - resolveSource(wikiFS, vaultName, absoluteBasePath, sourceIdOrRef) → ResolvedSource | null
   - 내부: loadRegistry → findById (prefix 관용 + full-hash verify) → tombstone 체크 → URI derive
   - vitest 4 (존재 / 미등록 / tombstone / PARA 이동 후 해석)
2. query-pipeline.ts citations 구조화
   - QueryResult 에 optional citations?: Citation[] 추가
   - searchResults 각 페이지 frontmatter parse → provenance[].ref → source_id dedupe → Citation
   - 기존 sources 필드 유지 (backward compat)
   - vitest +2
3. sidebar-chat.ts 답변 렌더 (Electron renderer API)
   - 답변 wikilink 뒤 📄 보조 버튼 attach
   - 클릭 3 경로: app.workspace.openLinkText / app.openWithDefaultApp / window.open / tombstone Notice
   - CSS: 0.68em + opacity 0.7 + aria-label (철학 가드 — wiki 계층 우회 방지)
   - 수동 UI smoke
4. 통합 smoke: 실제 PMS PDF 인제스트 → 쿼리 실행 → 📄 클릭 → 원본 PDF 열림
```

### 🔴 §4.3.1 — Stage 2/3 prompt override (다음 세션 Part B 뒤)

상세 설계: `plan/phase-4-todox-4.3-plan.md §4 + §4.5`. Part A/§4.3.3 와 독립 — 순서 유연.

```
1. loadEffectiveStage2Prompt / loadEffectiveStage3Prompt 헬퍼 (wiki-ops 또는 ingest-pipeline)
   - 패턴: loadEffectiveIngestPrompt 재사용
   - 반환: { prompt: string; overridden: boolean }
2. canonicalizer.ts::buildCanonicalizerPrompt 시그니처 확장 (optional 파라미터)
   - overridePrompt?: string — 있으면 bundled 대체, 없으면 기존 동작 (backward compat)
3. ingest-pipeline.ts Stage 2 mention extractor 에 override 주입
4. settings-tab.ts Ingest Prompt 섹션에 3개 prompt 탭 (Edit/Reset/상태 표시)
5. vitest +3 (override 미존재 / 존재 / canonicalize override)
6. 수동 UI smoke (settings 탭에서 Stage 2 prompt 편집 → 다음 인제스트 반영 확인)
```

**§4.3.1 에서 Phase 5 이관 확정**:
- 도메인별 프리셋 (기술문서 / 논문 / 매뉴얼 / 회의록 / 제품 스펙) → Phase 5 §5.6 self-extending (자동 프리셋 선택과 중복)
- 모델별 품질 baseline 측정 → Phase 5 §5.4 variance diagnostic

### 🎯 다음 세션 실행 체크리스트

```
1. plan/phase-4-todox-4.3-plan.md 재확인 (§3 Part B + §4 §4.3.1 상세)
2. source-resolver.ts TDD (vitest 4, RED → GREEN)
3. query-pipeline citations (vitest +2)
4. sidebar-chat 답변 렌더 + CSS (수동 smoke)
5. §4.3.1 loadEffectiveStage2/3Prompt + canonicalizer signature (vitest +3)
6. settings-tab UI (수동 smoke)
7. 통합 smoke (실제 PMS PDF 인제스트 + 쿼리)
8. npm test 445+ 목표, npm run build 0 errors
9. 문서 동기화 (result/todo/plan/followups/memory)
10. 단일 commit + push
```

**시간 예상**: Part B 2~3h + §4.3.1 1~1.5h + 통합 smoke 0.5h + 문서 동기화 0.5h ≈ **4~5.5h**. 긴 세션 이므로 시작 전 codex rescue 2차 검증 재시도 고려 (이번 세션의 timeout 패턴 회피 위해 timeout 연장).

### 📋 이관 대기 (§4.3 이후)

- **§4.5.2 운영 안전** — 삭제 안전장치 + 초기화. Phase 4 본체 완성 선언 직전 마지막 체크포인트.
- **Phase 4 본체 완성 선언** — §4.3 + §4.5.2 완료 후 commit 메시지에 "Phase 4 본체 완성" 명시.
- Phase 5 착수 — §5.4 variance diagnostic (AMBIGUOUS 리뷰 UI 확장 포함) / §5.6 self-extending (도메인 프리셋) / 그 외.

### 📊 Phase 4.3 전체 진행 (2026-04-23 session 3 종료 시점)

| 항목 | 상태 | 테스트 / 증거 | 비고 |
|------|------|---------------|------|
| 계획 v2 (`plan/phase-4-todox-4.3-plan.md`) | ✅ 확정 | 11개 섹션, self-review 4건, open question 5건 decision | codex rescue 는 session 3 시점 미작동 (timeout) |
| §4.3.2 Part A (Provenance data model) | ✅ 완료 (session 3) | wiki-ops +3 green (types + inject + dedupe + YAML scalar) | MVP — 모든 페이지 `extracted` type 자동. `inferred`/`ambiguous` 구분은 Phase 5 §5.4 |
| §4.3.3 stripBrokenWikilinks | ✅ 완료 (session 3) | 기존 unit tests 재사용 + ingest-pipeline 배선 | Preview/저장본 bit-identical |
| §4.3.2 Part B (쿼리 backlink) | ⏳ 다음 세션 | source-resolver 4 + query-pipeline +2 + sidebar 수동 | Part A/§4.2 모두 완료 — 바로 착수 가능 |
| §4.3.1 (3-stage override) | ⏳ 다음 세션 | canonicalizer +1 + ingest-pipeline +2 + settings UI 수동 | Part A 와 독립 |
| 총 wikey-core tests | 430 → **437** (+7, 최종 목표 **445+**) | — | — |

---

## 2026-04-23 세션 2 docs 동기화 후속 — result/todo/plan §4.2 1:1 mirror 정비

Session 2 의 Stage 3+4 완료 직후 사용자 요청으로 `result-doc-writer` 스킬 규칙에 따라 문서 구조를 정비. 이전에 result `§4.2.3 = Stage 2` / todo `§4.2.3 = Stage 3` 로 번호가 어긋나 있던 문제를 해소:

- `activity/phase-4-result.md §4.2` — 번호 mirror 로 재정렬: §4.2.1 Stage 1 / §4.2.2 Stage 2 (Integration + Session 1 evidence 흡수) / §4.2.3 Stage 3 / §4.2.4 Stage 4 (링크 안정성 회귀선 .7/.8 + Session 2 evidence .9 흡수) / §4.2.5 호환성 전략 / §4.2.6 범위 밖 — Phase 5 이관. 각 섹션에 `> tag: #...` 라인 추가, 구 §4.2.7 "Stage 3/4 잔여 작업 상세 설계" 는 실제 구현 완료로 흡수 제거.
- `plan/phase-4-todox-4.2-plan.md` — Stage 1/2/3/4 각 섹션에 "완료 확증" 블록 추가, §6 세션 실행 기록 리라이트, §8 검증 기준 표에 실제 증거 컬럼 추가 (테스트 434 / +82 / 실측 증거), §10 codex finding 표에 ✅ 컬럼, §11 "본 계획 완결 선언" 신규.
- `plan/phase-4-todo.md` — 구조는 이미 올바름 (§4.2.1/2/3/4 전량 [x]). 상태 라인 일관성만 확인.

다음 세션 진입점은 아래 블록 그대로 §4.3.

---

## 2026-04-23 세션 2 마무리 — §4.2 본체 완결 (Stage 1~4 All Done)

### ⭐ 다음 세션 최우선: §4.3 본체 인제스트 (3-stage 프롬프트 + Provenance Part A/B + stripBrokenWikilinks)

Session 2 는 §4.2 Stage 3 (LLM 분류 정제) + Stage 4 (vault listener + startup reconcile) 를 같은 세션에 묶어 완료. §4.1.1.9 두 번째 체크박스도 자동 해소. **다음 세션 진입점은 §4.3 본체 인제스트** — 본체 완료 선언 직전 마지막 data model 변경 (frontmatter `provenance` + 쿼리 응답 원본 backlink 렌더링).

**완료 내역** (detail: `activity/phase-4-result.md §4.2.8 / §4.2.9 / §4.2.10`):
- **Stage 3 (S3-1~S3-4)**: `classifyWithLLM` 4차 slug 힌트 inject + `CLASSIFY_PROVIDER`/`MODEL` 키 + Audit Re-classify 체크박스 + CLASSIFY.md 피드백 로그. (S3-3/S3-4 는 session 4 에 재설계 — 체크박스+피드백 철회 · paraRoot 옵션 도입, commit `54f05b9`.)
- **Stage 4 (S4-1~S4-4)**: `vault-events.ts` (RenameGuard · reconcileExternalRename · handleExternalDelete) + `source-registry.reconcile` 확장 (tombstone/restore) + main.ts 이벤트 라우팅 + onload reconcile + path API deprecation warn.
- **링크 안정성 회귀선** (사용자 2026-04-23 지적 반영): `integration-pair-move.test.ts` +2 — entity/concept 페이지 `[[source-xxx]]` wikilink 가 파일 이동 후에도 bit-identical 유지됨을 명시적으로 회귀 방지.
- 신규: `wikey-core/src/vault-events.ts`, `__tests__/vault-events.test.ts`.
- 변경 (session 2): `classify.ts` (listExistingSlugFolders · movePair renameGuard), `wiki-ops.ts` (+appendClassifyFeedback [session 4 철회] · appendDeletedSourceBanner), `source-registry.ts` (reconcile extended), `config.ts`/`types.ts` (CLASSIFY_*), `main.ts` (vault listener + onload reconcile), `commands.ts`/`sidebar-chat.ts` (renameGuard + Re-classify UI [session 4 철회] + feedback [session 4 철회]), `styles.css` (Re-classify CSS [session 4 철회]), `wikey.conf`.
- 증거: wikey-core 399→**430 PASS (+31)**. bash pair-move smoke 6/6. build 0 errors.

### 🟢 Stage 3/4 실측 권장 (관찰 세션)

Stage 4 는 단위/통합 테스트 전량 green 이지만 수동 UI smoke 는 관찰 세션에서 재확인이 안전:
- Obsidian UI 에서 raw/ 파일을 PARA 폴더로 드래그 이동 → 0.2s 뒤 registry/frontmatter 자동 갱신 + sidecar 동행 확인.
- `mv` 로 오프라인 이동 후 Obsidian 재기동 → console 에 `startup reconcile complete — active=N` 출력 + registry path 갱신.
- raw/ 에서 원본 삭제 → source 페이지에 `[!warning] 원본 삭제됨` callout 1회 추가 + tombstone=true.
- 삭제 후 같은 파일 복원 (같은 해시) → 다음 기동 reconcile 이 restoreTombstone + recordMove.

### 📋 이관 대기 (§4.2 이후)

- **§4.3 본체 인제스트** — 3-stage prompt override + **§4.3.2 Provenance tracking Part A (frontmatter data) / Part B (쿼리 응답 원본 backlink 렌더링)** + stripBrokenWikilinks. 본체 완료 선언 전 마지막 data model 변경.
- **§4.5.2 운영 안전** — 삭제 안전장치 + 초기화.
- 경로 기반 API 완전 제거 · Audit hash 판정 일반화 · LLM 피드백 few-shot 자동 재프롬프트 · registry 대용량 볼트 최적화 → Phase 5 §5.3/§5.6/§5.5.

### 🎯 다음 세션 실행 체크리스트 (§4.3 본체 인제스트)

```
1. plan/phase-4-todox-4.2-plan.md 패턴 따라 §4.3 계획 초안 작성 (codex rescue 2차 검증 사이클 권장)
2. Part A (frontmatter provenance): entities/concepts/analyses 공통 스키마 확장 + wiki-ops helper + 기존 페이지 migration (fresh vault 이므로 no-op)
3. Part B (원본 backlink 렌더링): query-pipeline citations 구조화 + source-resolver (source_id → current_path/uri/mime_type) + sidebar-chat 답변 렌더 (internal/external/tombstone 클릭 핸들러)
4. §4.3.1 3-stage 프롬프트 override (Stage 1/2/3 각각 override 지원 — 현재 Stage 1 만 지원)
5. stripBrokenWikilinks 구현 + ingest-pipeline 배선
6. npm test 450+ 목표, build 0 errors
7. 문서 동기화 (result/todo/followups/memory) + 단일 commit
```

### 📊 Phase 4.2 전체 진행 (2026-04-23 session 2 종료 시점)

| Stage | 상태 | 테스트 수 | 비고 |
|-------|------|----------|------|
| Stage 1 (ID/registry) | ✅ 완료 (session 1) | uri 17 + registry 12 → 16 (Stage 4 확장) + wiki-ops +7 | |
| Stage 2 (pair move + rewrite) | ✅ 완료 (session 1) | move-pair 8 + integration 3 → 5 (링크 안정성 +2) | |
| Stage 3 (LLM 분류 정제 · UI) | ✅ 완료 (session 2) | classify +5 (20 → 24) + config +4 + wiki-ops +4 | UI 수동 smoke 권장 |
| Stage 4 (listener · reconcile) | ✅ 완료 (session 2) | vault-events 9 + source-registry +4 + wiki-ops +3 | UI 수동 smoke 권장 |
| 총 wikey-core tests | 352 → **430** (+78) | — | — |

---

## 2026-04-23 세션 1 마무리 — §4.2 Stage 1+2 완료

### ⭐ 다음 세션 최우선: §4.2 Stage 3 → Stage 4 → §4.3 (본체 인제스트)

2026-04-23 세션은 §4.2 Stage 1 (URI/registry foundation) + Stage 2 (pair move + frontmatter rewrite) 완료로 마감. **다음 세션 진입점**은 Stage 3 · Stage 4 — 그 뒤 §4.3 (3-stage prompt override + Provenance tracking + stripBrokenWikilinks) 로 이어진다.

**완료 내역** (detail: `activity/phase-4-result.md §4.2`):
- plan v1→v2→v3 진화, codex rescue 2차 검증 FAIL gate 6 concern (Critical 2 · High 2 · Medium 3) 전부 반영.
- 신규: `uri.ts`, `source-registry.ts`, `move-pair.test.ts`, `integration-pair-move.test.ts`, `registry-update.mjs`, `migrate-ingest-map.mjs`, `pair-move.smoke.sh`, `plan/phase-4-todox-4.2-plan.md`.
- 변경: `classify.ts (+movePair)`, `wiki-ops.ts (+injectSourceFrontmatter/rewriteSourcePageMeta)`, `ingest-pipeline.ts (buildV3SourceMeta)`, `commands.ts / sidebar-chat.ts (movePair 전환)`, `classify-inbox.sh / classify-hint.sh (pair + sidecar 표시)`, `measure-determinism.sh (registry cleanup)`.
- 증거: wikey-core 352→**399 PASS (+47)**. bash smoke 6/6. build 0 errors.

### 🔴 Stage 3 — LLM 3/4차 분류 정제 (다음 세션 착수 후보)

- **S3-1** `classifyWithLLM` 프롬프트 — 4차 제품 slug 힌트 강화 ("기존 폴더 재사용 우선, 없으면 `NNN_topic` 규칙"). vitest 4.
- **S3-2** `CLASSIFY_PROVIDER` / `CLASSIFY_MODEL` — `resolveProvider('classify', cfg)` 추가. 미지정 시 `ingest` 승계. vitest 2.
- **S3-3** Audit 패널 "Re-classify with LLM" 토글 — 2차만 결정된 row.
- **S3-4** CLASSIFY.md 피드백 append — 사용자 dropdown 변경 시 "## 피드백 로그" 섹션에 line append.

### 🔴 Stage 4 — Vault listener + startup reconciliation (별도 세션 필수)

- **S4-1** `main.ts` `vault.on('rename')` — registry recordMove + pair 자동 동행. debounce 200ms + expectedRename queue 로 movePair 유래 이벤트 skip (double-move guard).
- **S4-2** `vault.on('delete')` — `recordDelete` + source 페이지 "원본 삭제됨" callout.
- **S4-3** `main.ts` onload → `registry.reconcile(vault.getFiles())` startup scan — bash/외부 이동 유실분 복구 (codex High #4 이중 안전망).
- **S4-4** Audit 파이프라인 hash 기반 판정 — `findByHash(hash) !== null && vault_path 다름` → 재인제스트 제외. 경로 기반 API deprecation warning.
- 리스크: double-rename race / debounce tuning 이 까다로움. Stage 3 과 같은 세션에 섞지 말 것 권장.

### 📋 이관 대기 (Stage 3/4 이후)

- §4.3 본체 인제스트 — 3-stage prompt override + **§4.3.2 Provenance tracking Part A (frontmatter data) / Part B (쿼리 응답 원본 backlink 렌더링, 2026-04-22 확장 기록)** + stripBrokenWikilinks.
- §4.1.1.9 두 번째 체크박스 (`vault.on('rename')` sidecar 처리) — Stage 4 에서 자동 해소 예정.
- 경로 기반 API 완전 제거 · Audit hash 판정 일반화 → Phase 5 §5.3.

### 🎯 다음 세션 실행 체크리스트

**옵션 A: Stage 3 단독 (~3h)** — 단독 진입 가능, Stage 1/2 와 독립. 상세: `phase-4-todo.md §4.2.3` + `plan/phase-4-todox-4.2-plan.md §4` + `activity/phase-4-result.md §4.2.7.1`.

```
1. S3-1 classifyWithLLM 프롬프트 4차 slug 힌트 (vitest 4, RED→GREEN)
   - 기존 NNN_topic 폴더 목록을 프롬프트 컨텍스트에 inject
   - hallucination guard: "목록에 없는 slug 제안 시 reason 에 이유 명시"
2. S3-2 CLASSIFY_PROVIDER / CLASSIFY_MODEL 키 (vitest 2)
   - types.ts + config.ts resolveProvider('classify') 추가, 미지정 시 ingest 승계
   - wikey.conf 주석 블록 — 저가 모델 안내
3. S3-3 Audit Re-classify 토글 UI (sidebar-chat.ts, needsThirdLevel row 에만)
4. S3-4 CLASSIFY.md 피드백 append (appendFeedbackLogEntry 헬퍼)
5. 통합 smoke (실제 inbox 파일로 Re-classify → feedback 엔트리 확인)
6. npm test → 405+ PASS, npm run build → 0 errors
7. 문서 동기화 + 단일 commit
```

**옵션 B: Stage 4 단독 (~4h + 측정)** — 별도 세션 필수. Stage 1 의 reconcile / Stage 2 의 movePair 의존. 상세: `phase-4-todo.md §4.2.4` + `plan/phase-4-todox-4.2-plan.md §5` + `activity/phase-4-result.md §4.2.7.2`.

```
1. S4-1 vault.on('rename') + expectedRenames queue 프로토콜 (unit test 3)
   - movePair 가 newPath 를 queue 에 pre-register → 리스너에서 매칭 시 skip
   - queue 매칭 실패 = 사용자 UI 이동 → sidecar 자동 동행 + 200ms debounce
2. S4-2 vault.on('delete') — recordDelete + source 페이지 callout append
3. S4-3 onload reconcile — app.vault.getFiles() walker + mtime skip 최적화 (integ test 확장)
4. S4-4 Audit hash 판정 + 경로 API deprecation warning (1회 로그)
5. 수동 smoke: Obsidian UI 이동, bash mv 후 재기동 모두 registry 복구 확인
6. pair-move.smoke.sh 재실행 + npm test 405+ PASS
7. §4.1.1.9 두 번째 체크박스 자동 해소 (todo 에서 [x])
8. 문서 동기화 + 단일 commit
```

**권장 순서**: A → B (분류 안정화 먼저 → listener 는 race 디버깅 고립 세션). 시간 여유 있으면 A+B 같은 세션, 커밋은 분리.

### 📊 Phase 4.2 전체 진행 상태 (Stage 별)

| Stage | 상태 | 테스트 | 비고 |
|-------|------|--------|------|
| Stage 1 (ID/registry) | ✅ 완료 | 17+12+7 | wikey-core 399 PASS |
| Stage 2 (pair move) | ✅ 완료 | 8+3+smoke 6/6 | movePair + frontmatter rewrite |
| Stage 3 (분류 정제) | ⏸️ 대기 | +6 예정 | Stage 1/2 와 독립 |
| Stage 4 (listener+reconcile) | ⏸️ 대기 | +6 예정 | Stage 1/2 의존 |

**Phase 4.2 완료 시점 → §4.3 본체 인제스트 (3-stage + Provenance A/B + stripBrokenWikilinks) 진입.**

---

## 2026-04-22 세션 마무리 — §4.5.1.7.2/7.3 완료 + Phase 재편

### ⭐ 다음 세션 최우선: §4.2 (URI + 분류) → §4.3 (본체 인제스트)

2026-04-22 세션은 본체 variance 해소 (§4.5.1.7.2/7.3) 와 Phase 구조 재편으로 마감됐다. **Phase 4 본체의 다음 진입점은 §4.2 (URI 기반 안정 참조 + LLM 3/4 차 분류) + §4.3 (3-stage prompt override + Provenance tracking + stripBrokenWikilinks)**. §4.5.1.7.2 Concepts CV 실측은 Phase 5 §5.4 diagnostic 세션에서 자연 회귀.

**§4.3.2 Provenance 확장 (2026-04-22 세션 말 추가 기록)**: frontmatter `provenance` data model 뿐 아니라 **쿼리 응답에 원본 파일 backlink 렌더링** 까지 §4.3.2 Part B 로 포함. 현재 답변이 wiki 페이지 wikilink 까지만 걸리는 3-hop 을 1-hop 으로 단축 (답변 → 원본). wikilink 는 주 링크, 원본은 📄 보조 링크 (약한 affordance) 로 배치해 wiki 계층 우회 습관 방지. 구현은 §4.2.2 source-registry + §4.3.2 Part A frontmatter 가 선결. 철학 점검 완료 (citation/provenance 강화, raw/ 불변성 영향 없음).

**§4.5.1.7.2 (PMBOK 10 prompt hint) — 완료**:
- `canonicalizer.ts buildCanonicalizerPrompt` 작업 규칙 7번 항목 신규 (PMBOK 10 영역 개별 concept, hallucination guard 포함).
- 단위 테스트 anchor 신규. 352/352 PASS.
- 효과 검증 위임: Phase 5 §5.4 variance diagnostic 측정에서 Concepts CV <15% 확증 여부 자연 판정.

**§4.5.1.7.3 (measure-determinism robustness) — 완료**:
- `restoreSourceFile()` boolean 반환, per-run timeout 10분 → 15분, `--strict` CLI 플래그.
- 정적 검증 (bash/python/JS) 통과. 다음 측정 세션에서 자동 회귀.

**덤**: master 에 있던 `hasRedundantEmbeddedImages(md, stripped, pdfPageCount)` arity 버그 (commit `bb09b79` 에서 convert-quality.ts 만 변경하고 호출부 미갱신) 도 같은 세션에서 복구. 해당 커밋의 "343 tests PASS, tsc 0 errors" 기록은 실제로 성립하지 않고 있었음.

### 📋 §4.5.1.7 sub-task 최종 상태 (Phase 재편 + [x] 전환 반영)

| sub-task | 상태 | 근거 |
|---|---|---|
| **§4.5.1.7.2 Concepts prompt (PMBOK 10)** | 🟢 **완료** | 코드 deliverable 확정, 실측은 Phase 5 §5.4 자연 회귀 |
| **§4.5.1.7.3 측정 infra robustness** | 🟢 **완료** | 2026-04-22 구현, 다음 측정에서 자동 회귀 |
| §4.5.1.7.1 attribution ablation | → Phase 5 §5.4.1 | diagnostic, 본체 CV 확보 후 선택 |
| §4.5.1.7.4 Route SEGMENTED (Ollama) | → Phase 5 §5.4.2 | production guide |
| §4.5.1.7.5 Lotus-prefix variance | ✅ **자동 해결** | §4.1.3 으로 Entities CV 2.3% 수렴 |
| §4.5.1.7.6 BOM 재분할 판단 | → Phase 5 §5.4.3 | 월 1 회 모니터 |
| §4.5.1.7.7 log_entry axis cosmetic | → Phase 5 §5.4.4 | cosmetic |

**권장 순서**: §4.2 URI + 분류 → §4.3 본체 인제스트 (3-stage prompt + Provenance + stripBrokenWikilinks) → §4.5.2 본체 운영 안전 (삭제 안전장치 + 초기화) → **Phase 4 본체 완성 선언** → Phase 5 (§5.6 Stage 1 → §5.4 diagnostic / §5.1 검색 / §5.2 그래프 / §5.5 성능) → Phase 6 (웹).

### 🆕 Phase 재편 (2026-04-22) — Phase 5 신규 (튜닝·고도화), 기존 Phase 5 → Phase 6 (웹)

본체 정의 확정: **원본 → wiki ingest 프로세스가 완성되어 더 이상 wiki 를 초기화하거나 재생성할 일이 없는 상태**. frontmatter/데이터 모델/워크플로우 구조가 고정되고, 이후 내용은 축적되지만 구조는 변경되지 않는다.

Phase 4 (본체) 에 남는 항목:
- §4.0 UI / §4.1 문서 전처리 (완료)
- §4.2 분류·URI 참조 (본체 data model)
- §4.3 인제스트 본체 (3-stage prompt override / **Provenance tracking — frontmatter 추가라 Phase 4 필수** / stripBrokenWikilinks)
- §4.5.1 결정성 (§4.5.1.7.2/7.3 실측 대기)
- §4.5.2 본체 운영 안전 (삭제 안전장치 + 초기화만)

Phase 5 신규 (튜닝·고도화·개선·확장, `plan/phase-5-todo.md`):
- §5.1 검색 재현율 고도화 (←§4.4.1 contextual chunk)
- §5.2 지식 그래프·시각화 (←§4.4.2 NetworkX / §4.4.3 AST)
- §5.3 인제스트 증분 업데이트 (←§4.3.3)
- §5.4 variance 기여도·diagnostic (←§4.5.1.7.1/.4/.6/.7)
- §5.5 성능·엔진 확장 (←§4.5.3 llama.cpp / §4.5.4 rapidocr)
- **§5.6 표준 분해 self-extending (←§4.5.5, 현재 §4.5.1.7.2 PMBOK 하드코딩이 Stage 0)**
- §5.7 운영 인프라 포팅 (←§4.5.2 일부)

Phase 6 (`plan/phase-6-todo.md`): 기존 Phase 5 웹 환경 전체 이관.

### 🆕 §5.6 표준 분해 규칙 self-extending 구조 (2026-04-22 신규, §4.5.1.7.2 실측 gated)

§4.5.1.7.2 의 PMBOK 10 영역 하드코딩은 **Stage 0 사전 검증**. 철학 선언은 `wiki/analyses/self-extending-wiki.md` (wiki 본체 analysis 페이지) 에 정식 기록됨.

**4 단계 로드맵 (상세: `plan/phase-5-todo.md §5.6`)**:
1. **Stage 1** — `.wikey/schema.yaml` `standard_decompositions` 필드 + canonicalizer 로더화. 두 번째 표준 등장 시 즉시 착수.
2. **Stage 2** — extraction graph 기반 suggestion. Audit UI "표준 분해로 등록하시겠습니까?" carding.
3. **Stage 3** — 소스 본문의 "표준 개요 섹션" 을 section-index 가 감지해 runtime decomposition 자동 생성.
4. **Stage 4** — wiki 전체 mention graph cross-source convergence (Phase 5 내 최후 단계, Phase 6 이관 없음).

§5.6 가 **실행 로드맵 단일 기록 소스**, `wiki/analyses/self-extending-wiki.md` 가 **철학 선언 단일 기록 소스** (drift 방지). canonicalizer.ts 주석·phase-4-result §4.5.1.7.2·memory·본 followups 는 모두 포인터.

---

## 2026-04-22 §4.1.3 전체 완료 — source PDF 기반 근본 감지 (scan + text layer corruption) + OCR engine fallback

### ⭐ (이전 세션 최우선: §4.5.1.7.2 — 위 2026-04-22 항목에서 코드 완료로 전환됨)

### 🟢 §4.5.4 rapidocr Linux 실측 (맨 뒤 todo 로 이동, 2026-04-22 신규)

§4.1.3 의 OCR engine fallback 은 코드 레벨 등록 완료 (`defaultOcrEngine()` + `defaultOcrLangForEngine()`), macOS 환경에서만 실측. Linux/Windows 환경의 rapidocr + PP-OCRv5 Korean 실측은 별도 세션 (별도 Linux 환경 필요).

### 📦 §4.1.3 전체 구현 요약

- 구현:
  - `buildDoclingArgs` mode 3-mode (`default` / `no-ocr` / `force-ocr`)
  - `scoreConvertOutput` 5번째 signal `image-ocr-pollution` + decision `'retry-no-ocr'`
  - `extractPdfText` Tier 1a (`--no-ocr`) escalation + Tier 1b 원인 분기 (scan vs kloss)
  - `hasRedundantEmbeddedImages` — tier 기반 sidecar strip 판정
  - **source PDF scan 감지** (pymupdf 이미지 덮힘률 + text layer 검증)
  - **`defaultOcrEngine()` + `defaultOcrLangForEngine()`** — platform 별 engine/lang 자동 매핑
  - `scripts/benchmark-tier-4-1-3.mjs` — 5 코퍼스 회귀 + sidecar 저장
  - Tests 315 → **351 PASS** (+36)
- 5 코퍼스 최종 매핑 (`activity/phase-4-resultx-4.1.3-benchmark-2026-04-22.md`):
  - PMS → `1a-docling-no-ocr` raw (UI 스크린샷)
  - ROHM → `1b-force-ocr-kloss` raw (diagram)
  - RP1 → `1-docling` raw
  - GOODSTREAM → `1b-force-ocr-scan` stripped 393 chars ✓
  - CONTRACT → `1b-force-ocr-scan` stripped 6024 chars, **한글 0 → 2810 복원** ✓
- PMS 10-run clean baseline (`activity/phase-4-resultx-4.1.3.5-pms-10run-clean-2026-04-22.md`):
  - Total CV 10.3% / Entities 2.3% / Concepts 24.6%

---

## 2026-04-22 §4.1.3 전체 완료 — Bitmap OCR 본문 오염 차단 + clean baseline 측정 (초기 기록)

### ⭐ 다음 세션 시작점

**§4.1.3.1~6 완료**. clean MD 위에서 variance baseline 확보.

- 구현:
  - `buildDoclingArgs` mode 3-mode (`default` / `no-ocr` / `force-ocr`) + `DoclingMode` type export
  - `scoreConvertOutput` 5번째 signal `image-ocr-pollution` (`hasImageOcrPollution` 필터 + 기준 A/B) + decision `'retry-no-ocr'`
  - `extractPdfText` Tier 1a (`--no-ocr`) escalation + score 비교 (false positive 방어)
  - `scripts/benchmark-tier-4-1-3.mjs` — 4 코퍼스 회귀 + sidecar `.md` 저장
  - Tests 315 → 335 PASS
- 4 코퍼스 회귀 (`activity/phase-4-resultx-4.1.3-benchmark-2026-04-22.md`):
  - PMS: Tier 1 retry-no-ocr → Tier 1a accept, lines **1922 → 532 (−72%)**, koreanChars 18654 → 15549 (OCR 파편 3,105자 제거), score 0.53 → 0.91
  - ROHM: Tier 1 retry → Tier 1b force-ocr accept (koreanLoss 경로)
  - RP1/GOODSTREAM: Tier 1 accept
- PMS 10-run clean measurement (`activity/phase-4-resultx-4.1.3.5-pms-10run-clean-2026-04-22.md`):
  - **Total CV 10.3%** (mean 42.20, range 36–46, {36, 44, 46} 3 값 양자화)
  - **Entities CV 2.3%** (mean 22.60, range 22–23) — 거의 결정적
  - **Concepts CV 24.6%** (mean 18.60, range 12–22) — PMBOK 9 영역 진동
  - §4.5.1.6 29-run 9.2% (오염) vs §4.1.3.5 10.3% (clean) — 거의 동일 → canonicalizer 3차 효과 확증.

### 🔴 §4.5.1.7 gate 판정 완료 — 다음 세션 우선순위

CV 10.3% 는 "5–10%" 와 ">10%" 경계. 각 sub-task 필요성 재정리:

| §4.5.1.7.x | 필요성 | 근거 |
|---|---|---|
| **§4.5.1.7.2 Concepts prompt (PMBOK 9 영역)** | **필수** | Concepts CV 24.6% 잔여, range [12–22] 는 PMBOK 9 영역이 일부 run 에서만 추출. 결정성 flag + canon 3차로도 해결 안 됨 → prompt-level 변경 필요 |
| §4.5.1.7.1 attribution ablation | 재평가 (축소) | Entities CV 2.3% 로 사실상 해결. Concepts variance 의 3 레버 (determinism / canon / depollution) 기여도 분해만 선택적. |
| §4.5.1.7.5 Lotus variance | **불필요** | Entities 이미 결정적. Lotus OCR 파편이 entity 화되던 것이 §4.1.3 으로 자동 해결. |
| §4.5.1.7.3 측정 infra | 유지 (독립) | run 30 outlier `restoreSourceFile()` 재발 방지. |
| §4.5.1.7.4 Route SEGMENTED | 유지 (독립) | Ollama 환경 production guide. |
| §4.5.1.7.6 BOM 재분할 | 유지 (독립) | 실무 판단. |
| §4.5.1.7.7 log_entry cosmetic | 유지 (독립) | 빠름. |

**권장 순서**: §4.5.1.7.2 → §4.5.1.7.3 → §4.2 URI 참조 (§4.1.1.9 listener 합동) → §4.3 인제스트 고도화.

### 🟡 남은 작업 — 이전 세션에서 이관

**§4.5.1.6 완료 상태 (2026-04-22 앞서)**:

| 지표 | §4.5.1.5 baseline | §4.5.1.6 10-run | §4.5.1.6 29-run | 누적 Δ 상대 |
|------|------------------:|-----------------:|-----------------:|------------:|
| Total CV | 24.3% | 7.2% | **9.2%** | **−62.1%** |
| Entities CV | 36.4% | 13.9% | 11.1% | −69.5% |
| Concepts CV | 31.1% | 28.9% | 27.0% | −13.2% |
| Union size (E+C) | 87 | 53 | 53 | −39.1% |

**이 baseline 은 오염된 MD 위에서 측정** — §4.1.3.5 로 재해석 예정.

---

## 2026-04-22 §4.5.1.6 완료 — determinism + canonicalizer 3차 (29-run Total CV 9.2%, 오염 baseline)

### ⭐ 다음 세션 시작점

**§4.5.1.6 전체 완료** (구현 §4.5.1.6.1/3/4 + 측정 §4.5.1.6.2/6):

| 지표 | §4.5.1.5 baseline | §4.5.1.6 10-run | §4.5.1.6 29-run | 누적 Δ 상대 |
|------|------------------:|-----------------:|-----------------:|------------:|
| Total CV | 24.3% | 7.2% | **9.2%** | **−62.1%** |
| Entities CV | 36.4% | 13.9% | 11.1% | −69.5% |
| Concepts CV | 31.1% | 28.9% | 27.0% | −13.2% |
| Union size (E+C) | 87 | 53 | 53 | −39.1% |

- 구현 (commit 29ca6a9):
  - `WIKEY_EXTRACTION_DETERMINISM` config → Gemini `temperature=0 + seed=42` summary/extract/canonicalize 3 지점 주입
  - SLUG_ALIASES 5→20 (alimtalk 4-variant + ERP/SCM/MES -system suffix + BOM 4-variant + RESTful/TCP-IP/MQTT spelled-out)
  - FORCED_CATEGORIES 3→13 pin (ERP/SCM/MES/PLM/APS/전자결재/SSO/TCP-IP/VPN/BOM)
  - Obsidian 플러그인 `extractionDeterminism` setting + `measure-determinism.sh -d` CLI
  - Tests 290→315 PASS, build 0 errors
- 10-run 측정 (§4.5.1.6.2): Total CV 7.2% (상대 −70.4%). Run10 10분 timeout outlier.
- 30-run 측정 (§4.5.1.6.6): 29-run valid 기준 Total CV 9.2%. Run 30 은 툴 edge case (0/0/0 3s — `restoreSourceFile` 복구 실패).
- Total 값이 **{35, 41, 43, 45} 4 값** 으로 극도로 양자화 — determinism + canon 3차 가 LLM output 을 이산 분포로 수렴시킴.
- 판정: Phase A/B 목표 (<15%, <10%) 모두 달성. §4.5.1.6.5 는 <10% 달성으로 §4.5.1.7 이관.

### 🔴 다음 세션 최우선 후보 (하나 선택)

1. **§4.5.1.7 variance 분해 + prompt 개선 + 측정 인프라** — §4.5.1.6 종료 후 3 축 잔여 작업 (7 sub-task). 상세: `plan/phase-4-todo.md §4.5.1.7`. 핵심 필요성:
   - (attribution) 3 레버 기여도 미분리 → Ollama (seed 미지원) 환경에서 canon 만으로 <10% 가능한지 답 없음
   - (Concepts 27% 잔여) PMBOK 9 sub-area 결정화 필요 — prompt-level 변경
   - (infra) run 30 outlier edge case 재발 방지 — N≥30 대규모 측정 신뢰성 확보
2. **§4.2 URI 기반 안정 참조** — `.ingest-map.json` → `.wikey/source-registry.json` (hash 키). wiki/sources 프론트매터 `source_id` 필드 추가. `§4.1.1.9 vault rename/delete listener` 합동 구현. PARA 이동 내성 확보.
3. **§4.3 인제스트 고도화** — 3-stage 프롬프트 override (`.wikey/stage1/stage2/stage3_*.md`), provenance tracking (EXTRACTED/INFERRED/AMBIGUOUS), 증분 업데이트.

### 🟡 측정 인프라 followup (이번 세션 발견)

- **`measure-determinism.sh restoreSourceFile()` edge case** — 30-run 중 run 30 에서 파일 복구 실패로 0/0/0 3s outlier 발생. `walk()` 가 raw/ 트리 전체를 탐색하지만 extension 변경·심링크·이동 큐 race 중 하나에서 놓침. 재현 빈도 낮음 (1/40) 이나 대규모 측정 신뢰성 문제. `adapter.exists(SOURCE_PATH)` 체크 후 absent 일 때 명시적 error 반환으로 수정하면 통계에 outlier 섞이지 않음.
- **run-level timeout 재발 검토** — 10-run run10 이 10분 초과 timeout. 30-run 에서는 재현 안 함. provisional 가설: Gemini quota/latency spike. 재발 시 script 의 per-run timeout 을 15-20분 으로 상향.

### 🟢 저우선 / 보류

- **log.md "엔티티/개념 생성" 문구 불일치** — canonicalizer.ts `assembleCanonicalResult` 의 `logEntry: raw.log_entry` 는 LLM 원본 (pin 적용 전 axis). FORCED_CATEGORIES 로 이동된 slug 는 파일 위치 ↔ log 문구 엇갈림. cosmetic 이슈, 파일 위치는 정확. 개선: pin 후 log body 를 결정적으로 재생성 (wiki-ops.ts `appendLog` 패턴 참조).
- **BOM 축 재분할** — §4.5.1.6.3 eBOM/mBOM/engineering-BOM 전부 `bill-of-materials` 로 collapse. 실무상 eBOM vs mBOM 구분 필요 시 re-split 검토 (§4.5.1.7+).
- **`scripts/cache-stats.sh`** — `~/.cache/wikey/convert/index.json` 직접 열람 가능하므로 우선순위 낮음.
- **§4.1.1.5 `ps aux` 실측 검증** — 별도 security audit 세션.
- **Ollama Route SEGMENTED 병렬화 (`Promise.all`)** — 별도 세션.
- **Canonicalizer prompt 개선** — §4.5.1.7 후보 (Concepts CV 27% 남은 이유: project-management 9개 하위 영역을 LLM 이 일부 run 에서만 concept 로 추출).

### 참고 명령

```bash
# 현재 코드베이스 상태
npm run build           # wikey-core tsc + wikey-obsidian esbuild, 0 errors
npm test                # 315 tests PASS

# determinism 재현 (prod 에서도 사용 가능)
echo "WIKEY_EXTRACTION_DETERMINISM=1" >> wikey.conf

# 측정 재실행
./scripts/measure-determinism.sh raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf -n 10 -d
./scripts/measure-determinism.sh raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf -n 30 -d

# 측정 후 wiki/ 오염 revert (필수)
git checkout -- wiki/entities/goodstream-co-ltd.md wiki/index.md wiki/log.md
```

---

## 2026-04-22 §4.5.1.5 측정 세션 완료 (이전)

### ⭐ 다음 세션 시작점

**§4.5.1.5 완료 요약**:
- **30-run PMS 측정**: Total CV **32.5% → 24.3%** (baseline 대비 −8.2pp, 상대 −25.2%), 30/30 성공
- **Gate 판정 (ratio 0.748)**: 섹션 경계 지터는 "주범(>50%)" 이 아닌 "기여자(20-50%)" → N=30 이 smoke 3-run 판정을 반증
- **잔여 variance 75%**: (a) LLM 수준 (temperature=0.1/seed 미설정) + (b) canonicalizer 미도달 패턴 (`alimtalk` 5-variant, ERP/SCM/MES 3-variant, BOM 5-variant, E/C 경계 왕복)
- **Selective rollback 불필요**: Phase A/B/C 유지 (철학적 근거 `wikey.schema.md §19·§21` + 25% 감소 증거 + 290 PASS)
- **측정 infra 개선**: `scripts/measure-determinism.sh` panel refresh 패치 (`selectPanel` re-click guard 우회 — audit→chat→audit routing)
- **산출물**: `activity/phase-4-resultx-4.5.1.5-pms-30run-2026-04-22.md` (30-run 원본), `activity/phase-4-result.md §4.5.1.5.11~.14`

→ 후속 작업으로 §4.5.1.6 신규 생성 (위 섹션 참조).

---

## 2026-04-21 (Phase 4 §4.1 문서 전처리 파이프라인 재편) 완료

### ⭐ 다음 세션 시작점

**현재 상태**: Phase 4 §4.1 완료 (Docling 메인화 + unhwp + MarkItDown fallback 강등 + 자동 force-ocr 감지 + 5개 코퍼스 실증 + UI override 완전 제거). 251 tests PASS. 4개 커밋 누적 (`e9af2bb → 708f9fc → d6f9a93 → f648e72`).

**핵심 결과** (`activity/phase-4-resultx-4.1-converter-benchmark.md` 참조):
- **Docling 212 headings + 294 실제 tables vs MarkItDown 0/0** — 계획서 +20% 기준 수십 배 초과
- **OMRON vector-only PDF 결정적 케이스**: MarkItDown 1 byte / pdftotext 48 bytes 실패 vs Docling `--force-ocr` 9.2KB 성공 → `isLikelyScanPdf` 자동 감지 정당성 실증
- **자동 판정 3신호** (UI override 대체): `koreanLongTokenRatio > 30%` (ROHM) + `isLikelyScanPdf` (OMRON) + `hasKoreanRegression`/`hasBodyRegression` (PMS·TWHB force-ocr 독성 방어)

**산출물**:
- `wikey-core/src/{rag-preprocess,convert-cache,convert-quality}.ts` + 각 테스트 파일
- `wikey-core/src/ingest-pipeline.ts` — tier 체인 재구성 + 자동 감지 로직 + sidecar md 저장
- `wikey-obsidian/src/{env-detect,settings-tab,sidebar-chat,commands}.ts` — Docling/unhwp 감지 + 설정 UI
- `scripts/vendored/unhwp-convert.py` + `scripts/benchmark-converters.sh`
- `docs/samples/{rp1-peripherals,Examples.hwpx,스마트공장...hwp,GOODSTREAM...md,ROHM_Wi-SUN.*}`
- `activity/phase-4-resultx-4.1-converter-benchmark.md` (5개 코퍼스 종합 리포트)
- `activity/phase-4-result.md §4.1` 전체 + §4.1.2 완료 선언
- `plan/phase-4-todox-4.1-agile-crystal.md` 계획서 (이번 Phase 시작 시 작성)

### 🔴 최우선 다음 작업: §4.5.1.5 LLM extraction variance 재측정

**선행 의존 §4.1 완료로 해제됨**. Docling 구조적 markdown 기준으로 variance "전처리 품질" 성분 분리 측정 가능.

**목표**:
1. Docling 변환본으로 PMS PDF 10+ run baseline (5-run으론 Gemini 2.5 Flash true CV 측정 불가)
2. Chunk 분할 결정성 확인 — `extractPdfText` stderr 로그에 chunk 수 + 경계 토큰 출력 추가
3. Temperature=0 + seed 재검증 (v6.1에서 기각됐지만 v7 schema + canonicalizer + Docling 환경에서 다시)
4. `allimtalk` (오타) → `alimtalk` 추가 + `*-system` suffix 기술스택 anti-pattern 검토
5. 측정 명령: `./scripts/measure-determinism.sh raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf -n 10`

**주의사항**:
- 자동 스크립트는 selector swap·CDP 응답 경로·snapshot diff 모두 정비됨 (§4.5.1 인프라)
- `cleanupForRerun`은 신규 파일만 삭제 → pre-existing 페이지 modification (goodstream-co-ltd.md, index.md, log.md)는 diff 범위 밖 → 측정 후 `git checkout -- <paths>` 수동 revert 필요

### 🟡 차순위 작업

2. **§4.2 URI 기반 안정 참조** — `§4.1.1.9 vault rename/delete listener`와 합동 구현 (sidecar md 자동 이동/삭제).
   - `.ingest-map.json` → `.wikey/source-registry.json` (hash 키)
   - wiki/sources 프론트매터에 `source_id` 필드
3. **§4.3 인제스트 고도화** — 3-stage 프롬프트 override (`.wikey/stage1/stage2/stage3_*.md`), provenance tracking (EXTRACTED/INFERRED/AMBIGUOUS), 증분 업데이트.

### 🟢 §4.1 범위 외로 이관된 저우선 과제

- **§4.1.1.5 `ps aux` 실측 검증** — API 키 env 주입 구현은 완료, 실 ingest run 중 수동 확인만 남음. 별도 security audit 세션 권장.
- **`scripts/cache-stats.sh`** — `~/.cache/wikey/convert/index.json` 직접 열람 가능하므로 우선순위 낮음.

### 기술 부채·메모

- **docling --force-ocr 주의**: 벡터 PDF에 적용하면 한국어 OCR 실패 (ocrmac 래스터화 열화). 자동 로직이 regression guard로 방어하지만 수동 호출 시 주의.
- **MarkItDown tables 수치 신뢰 X**: TWHB에서 tables 571개로 표시됐지만 실제 구조가 아닌 셀 구분자 오잘. Docling의 TableFormer 수치만 신뢰.
- **docling 초기 실행**: ML 모델 ~1.5GB 다운로드 (`~/.cache/docling/`). 첫 인제스트 시 수분 지연 발생 가능.

### 참고 명령

```bash
# 현재 코드베이스 상태
npm run build   # wikey-core tsc + wikey-obsidian esbuild, 0 errors
npm test        # 251 tests PASS

# 벤치마크 재현
bash scripts/benchmark-converters.sh <source_file> [output_dir]

# 캐시 직접 확인
ls -la ~/.cache/wikey/convert/
cat ~/.cache/wikey/convert/index.json | python3 -m json.tool | head -30
```

---

## 2026-04-21 (Phase 4 §4.0 UI 사전작업) 마감

### ⭐ 다음 세션 시작점

**현재 상태**: Phase 4 §4.0 UI 사전작업 9개 항목 모두 완료. wikey-obsidian 플러그인 UI 전면 정비 — chat을 first-class 패널로 분리, 비-chat 패널은 `Default AI Model : Provider | model` readonly 라벨만 노출, trash 아이콘 대신 `/clear` 슬래시 커맨드, dashboard 아이콘 home→bar-chart, provider/model 편집 UI는 chat 패널에서만, 사이드바 초기 폭 500px 1회 자동 적용, DEFAULT 라벨 통일, 드롭다운 자연 너비 + 좌측 정렬.

**검증**: `npm run build` 0 errors, `npm test` 197 PASS. CDP 9222 수동 측정 — 사이드바 500px, 드롭다운 180/240, active 버튼 배경, readonly bar 포맷, `/clear` 동작, 재시작 시 메시지 초기화 모두 확인.

**산출물**:
- `wikey-obsidian/src/sidebar-chat.ts` (+120/-40): 아이콘·PanelName·selectPanel·applyPanelVisibility·prettyProvider·PROVIDER_OPTIONS·readonlyModelBar·/clear
- `wikey-obsidian/src/main.ts` (+14/-4): `initialSidebarWidthApplied` + `applyInitialSidebarWidth()` + savedChatHistory 복원 제거
- `wikey-obsidian/src/settings-tab.ts` (라벨 일괄 치환): `(use Default Model)`/`(provider default)` → `DEFAULT`
- `wikey-obsidian/styles.css` (+30/-8): readonly-model-bar 신규, header-btn-active focus 변형, provider-model-bar 자연 너비·좌측·min-width, dashboard/help flex+border 정비, chat-model-row field-sizing
- `activity/phase-4-result.md` §4.0 (신규 9개 하위 섹션)
- `plan/phase-4-todo.md` §4.0 체크박스 모두 `[x]`

**바로 시작 가능한 작업**:

1. **🟢 §4.1.1 Docling 메인화 + unhwp 위임** (다음 우선순위 — §4.5.1.5의 선행)
   - IBM Docling을 PDF/DOCX/PPTX/XLSX/HTML/이미지/TXT의 Tier 1 메인 컨버터로 승격
   - HWP/HWPX는 unhwp로 위임
   - MarkItDown 체인을 fallback(tier 3)으로 강등
   - 설치 경로, `extractPdfText` 체인 재정렬, `env-detect.ts` 보강, 설정 탭 상태 라인
   - 상세: `plan/phase-4-todo.md` §4.1.1.1~8
2. **🔵 §4.5.1.5 LLM extraction variance 원인 분석** (Docling 전환 후)
3. **🔵 §4.2 URI 기반 안정 참조** (독립 가능, PARA 이동 내성)

---

## 2026-04-21 (Phase 4 §4.5.1.4 canonicalizer 2차 확장) 마감

### ⭐ 다음 세션 시작점

**현재 상태**: Phase 4 §4.5.1.4 완료. canonicalize.ts에 SLUG_ALIASES + FORCED_CATEGORIES + applyForcedCategories 후처리 landed. **기능은 확증 (pin된 `mqtt`/`restful-api`/`single-sign-on-api`가 5/5 run에서 올바른 pool)**. 그러나 **정량 CV 개선은 실패** — 2회 재측정 모두 Total CV 32%, baseline 5.7% 대비 악화. 원인: LLM extraction volume의 run간 진동 (20~50 total). Post-processing 밖의 variance source.

**결론**: 코드 유지 (pin 일관성은 정량 확증됨), CV 개선은 §4.5.1.5로 분할 이관.

**산출물**:
- `wikey-core/src/canonicalizer.ts` — SLUG_ALIASES + FORCED_CATEGORIES + applyForcedCategories
- `wikey-core/src/__tests__/canonicalizer.test.ts` — 11 new tests (197 tests total PASS)
- `activity/phase-4-resultx-4.5.1-determinism-pms-v7-4514-prompt-attempt-2026-04-21.md` — prompt 힌트 시도 결과 (기각)
- `activity/phase-4-resultx-4.5.1-determinism-pms-v7-4514-2026-04-21.md` — 후처리만 시도 결과 (최종)
- `activity/phase-4-result.md` §4.5.1.4 — 솔직 보고 + 결정 로그
- `plan/phase-4-todo.md` §4.5.1.5 신규 생성 (variance 원인 분석 이관)

**바로 시작 가능한 작업**:

1. **🔴 §4.5.1.5 LLM extraction variance 원인 분석** (신규, 1-2 세션)
   - chunk 분할 결정성: 동일 PDF의 `extractPdfText` → chunk 수 run간 동일한지 확인 (log stderr 추가)
   - 10+ run baseline: 5-run으론 Gemini 2.5 Flash의 true CV 측정 불가 → N≥10
   - Temperature=0 + seed 재검증: v6.1에서 기각된 실험, v7 schema + canonicalizer 환경에서 다시
   - 새 slug 변이 추가: `allimtalk` (오타) → `alimtalk`, `*-system` suffix 기술 스택 (point-of-production-system 등) anti-pattern 검토

2. **🟢 §4.1.1 Docling 메인화 + unhwp 위임** (큰 효과, 별도 세션)
   - §4.5.1.5 결과 관계없이 진행 가능 (문서 전처리 레이어)
   - MarkItDown → Docling 승격, HWP/HWPX → unhwp

3. **🟡 §4.2.2 URI 기반 안정 참조** (중간 작업, PARA 이동 내성)

### §4.5.1.4 구현 요점 (재참조)

```typescript
// canonicalize.ts 내 exports
export const SLUG_ALIASES = {
  allimtok: 'alimtalk', alrimtok: 'alimtalk',
  'sso-api': 'single-sign-on-api', 'single-sign-on': 'single-sign-on-api',
  'integrated-member-db': 'integrated-member-database',
}
export const FORCED_CATEGORIES = {
  mqtt: { category: 'entity', type: 'tool' },
  'restful-api': { category: 'concept', type: 'standard' },
  'project-management-system': { category: 'entity', type: 'product' },
}
```

- `canonicalizeSlug(base)` — `validateAndBuildPage` 에서 normalizeBase 이후 적용
- `applyForcedCategories(entities, concepts, ...)` — `assembleCanonicalResult` 끝에서 후처리

### 측정 교훈

- Gemini 2.5 Flash + PMS 제품문서(기술 스택 섹션 포함)는 extraction volume variance 큼
- 5-run 표본 CV 는 **신뢰도 낮음** — 적어도 10-run 이상으로 true CV 추정 필요
- Post-processing (pin/alias)은 naming-level 변동 해소에는 유효하지만 **extraction volume variance에는 영향 없음**

---

## 2026-04-21 (Phase 4 §4.5.1 측정 인프라 완료) 마감

### ⭐ 다음 세션 시작점

**현재 상태**: Phase 4 진행중. §4.5.1 결정성 측정 인프라 정비 완료. `scripts/measure-determinism.sh` 전면 개편 — selector class-swap 대응, snapshot-diff 기반 cleanup, 15KB 최소 크기 가드, CDP 응답 추출 경로 수정. PMS PDF 5-run 자동 측정 성공 (Total CV 5.7%, 수동 드라이브와 동일 분포 범위 재현). 자동 스크립트가 수동 드라이브 대체 가능 확증.

**산출물**:
- `activity/phase-4-result.md` (신규) — Phase 4 result 문서 시작, §4.5 섹션 첫 기록
- `activity/phase-4-resultx-4.5.1-determinism-pms-auto-2026-04-21.md` — 5-run 자동 측정 결과
- `plan/phase-4-todo.md` — §4.5.1.1/1.2/1.3 체크박스 전부 완료 + `## 4.0~4.5` #tag 부착

**바로 시작 가능한 작업**:

1. **🟢 §4.5.1.4 canonicalizer 2차 확장** (naming-level 변동 해소, ~1-2h)
   - 음역 다중 슬러그 정규화: `alimtalk`/`allimtok`/`alrimtok` → 하나
   - 약어/동의어 흡수: `sso-api`/`single-sign-on-api`/`single-sign-on` → 하나
   - E/C 경계 3건 `.wikey/schema.yaml` 고정: `restful-api`=concept, `mqtt`=entity, `project-management-system`=entity
   - 측정: 수정 후 동일 PMS 5-run → Entities CV 목표 ≤15%

2. **🟢 §4.1.1 Docling 메인화 + unhwp 위임** (가장 큰 효과, 별도 세션)
   - 현재 tier 1 MarkItDown을 tier 3으로 강등
   - Docling tier 1 (PDF/DOCX/PPTX/XLSX/HTML/이미지/TXT)
   - unhwp tier 1b (HWP/HWPX)
   - 캐싱 + OCR API 키 env 전환 (§4.1.1.4, §4.1.1.5)

3. **🟡 §4.2.2 URI 기반 안정 참조** (PARA 이동 내성, 중간 작업)
   - `.ingest-map.json` → `.wikey/source-registry.json` (hash 키)
   - wiki/sources 프론트매터에 `source_id` 필드

### §4.5.1 완료 상세

- **selector fix (핵심)**: `getActionBtn()` helper로 class-agnostic 탐지. `sidebar-chat.ts:999-1000`의 apply↔cancel class swap에 무관하게 작동. 시작 probe 60×500ms(30s window) + 완료 probe 양쪽 통일.
- **snapshot-diff**: pre-run `snapshotDirs()` + post-run `listDiff(baseline)` → 신규 파일만 정확 집계·삭제. `readSourceTagsOf` content-match 제거로 frontmatter `sources:` 형식 mismatch 리스크 제거.
- **CDP 응답 추출 경로 수정**: `Runtime.evaluate` + `returnByValue=True` 실제 구조 `{id, result: {result: {type, value}}}` — `d['result']['value']`는 항상 빈 `[]` fallback. `d['result']['result']['value']` 로 교정 + fallback에 `cdp_error` 덤프.
- **크기 가드**: 15KB 미만 (chunk <3 예상) → exit 2. `-f/--force` 우회.
- **Stale Cancel guard**: 루프 진입 시 `Cancel` 텍스트 감지 → 자동 click으로 취소.
- **5-run 검증**: PMS 3.5MB PDF, 5/5 성공. Total CV 5.7% (수동 v7 post 7.9%와 동일 범위). Time mean 278s (수동 320s 대비 -13%, CDP 연속 실행 이득).

### 남은 measure-determinism 주의사항

- `cleanupForRerun`은 **신규 파일만** 삭제 → pre-existing 페이지 modification (e.g. `goodstream-co-ltd.md`, `index.md`, `log.md`)은 diff 범위 밖 → 측정 후 `git checkout -- <paths>` 수동 revert 필요.
- Final cleanup 이후 파일 수는 baseline 정확히 복구되지만, modified 페이지 내용은 남음.

---

## 2026-04-20 (§B/§C-1/§C-2 정리) 마감

### ⭐ 다음 세션 시작점

**현재 상태**: Phase 3 사실상 완료. 8 commits (`f35d3b1`~`61c7830`), 159 tests pass. OMRON HEM-7600T 인제스트 + tier 6 page-render Vision OCR + WikiFS hidden folder fix + wiki/ self-cycle guard + 결정성 자동 측정 도구(`scripts/measure-determinism.sh`) + Gemini model dropdown 정리 + schema decision tree 모두 반영. `activity/phase-3-result.md` §14에 상세.

**바로 시작 가능한 작업**:

1. **🟢 v7-1+v7-2 schema 효과 정량 측정** (highest, ~10분)
   ```bash
   osascript -e 'quit app "Obsidian"' && sleep 3
   /Applications/Obsidian.app/Contents/MacOS/Obsidian --remote-debugging-port=9222 '--remote-allow-origins=*' &
   ./scripts/measure-determinism.sh raw/0_inbox/<small-source>.md -n 5
   ```
   - 04-20 baseline: Concepts CV 21.1% (Greendale)
   - 목표: ~15% 도달 → v7-1 decision tree 효과 검증
   - 결과는 `activity/determinism-<slug>-<date>.md`에 자동 기록

2. **🟡 v7-3 Anthropic-style contextual chunk 재작성** (큰 작업, 별도 세션 권장)
   - 검색 재현율 개선 (인제스트와 별개 retrieval 전처리)
   - 참조: <https://www.anthropic.com/engineering/contextual-retrieval>

3. **🟡 v7-5 schema yaml 사용자 override** (중간 작업)
   - `.wikey/schema.yaml`로 사용자 정의 entity/concept 타입 허용
   - schema.ts에 `loadSchemaOverride()` 추가, 기본 7 + 사용자 N 합산

### Phase 3에서 발견한 Phase 4 후보 (4건)

`activity/phase-3-result.md` §14.13 참조:
1. brief generation + ingest의 OCR 중복 제거 (캐싱) — §14.2
2. canonicalize에 stripBrokenWikilinks 적용 (source_page 한국어 wikilink 자동 정리) — §14.5
3. Stage 2 mention extraction + Stage 3 canonicalize에 사용자 prompt override 지원 — §14.3
4. OCR 호출 시 API 키 process listing 노출 → env/stdin 전환 — §14.2

---

## 2026-04-19 저녁 (v6 = 3-Stage Pipeline + Schema-Guided + UI 폴리싱) 마감

> ⚠️ 아래 잔여 작업은 모두 2026-04-20 세션에서 정리됨. 참고용으로 보존.

### 처리됨 (2026-04-20)

1. ~~🔴 다른 inbox 파일 인제스트 검증~~ → OMRON HEM-7600T E2E 완료 (`f35d3b1`). HEM-7156T-AP 88p는 선택적 잔여.
2. ~~🟡 v6 결정성 추가 측정~~ → Greendale 5-run 완료 (`2e47c3b`). Entities CV 8.4% / Concepts CV 21.1% / Total 12.9%.
3. ~~🟡 Lint 세션 — wiki 정리~~ → log.md cosmetic + validate PASS (`a739a20`).

### 잔여 (이전 세션부터 누적, 우선순위 재정렬)

- **🟢 [v7-1]** schema에 `methodology` vs `document_type` 경계 명확화 (concept CV 감소)
- **🟢 [v7-2]** anti-pattern에 운영 항목 추가 발굴 (인제스트 누적 중 발견 시)
- **🟢 [v7-3]** Anthropic-style contextual chunk 재작성 (검색 재현율 개선, 인제스트와 별개)
- **🟢 [v7-4]** 5회 std dev 자동 측정 → activity 로그 (회귀 감지 자동화)
- **🟢 [v7-5]** schema yaml 사용자 override (`.wikey/schema.yaml`) — Phase D는 표시만, 편집 미구현
- **🟢 [v7-6]** Pro 모델(`gemini-3.1-pro-preview`)을 옵션으로 노출 (Concept 보수적 분류 원할 때)
- **🟡 [B-2 #4]** markitdown-ocr fallback E2E (OMRON 스캔 PDF) — 다음 세션 #1과 통합 가능
- **🟡 [B-2 #5]** `.wikey/ingest_prompt_user.md` override E2E
- **🟡 [B-2 #6]** wiki/ 폴더 인제스트 가드 도입 결정

### 이번 세션 완료 (v6 = Phase A + B + C + D + UI 9건 + audit auto-move)

**인제스트 코어 재설계**:
- `wikey-core/src/schema.ts` 신규: 4 entity (organization·person·product·tool) + 3 concept (standard·methodology·document_type) + anti-pattern detector (한국어/UI/business/op/list/report/form)
- `wikey-core/src/canonicalizer.ts` 신규: 단일 LLM 호출, schema-guided, cross-pool dedup, 약어/풀네임 자동 통합, 기존 페이지 재사용
- `wikey-core/src/ingest-pipeline.ts`: 3-stage (summary + extractMentions + canonicalize)
- `wikey-core/src/wiki-ops.ts`: writtenPages 기반 결정적 index/log backfill, stripBrokenWikilinks (LLM 누락/dropped 항목 자동 정리), normalizeBase + extractFirstSentence helper 추가
- `wikey-core/src/types.ts`: WikiPage entityType/conceptType, Mention, CanonicalizedResult 타입 추가, LLMCallOptions.seed (v7 옵션)
- `wikey-core/src/llm-client.ts`: Gemini generationConfig.seed 전달 지원

**UI 9건**:
1. Modal close 차단 (backdrop + ESC) + Processing 단계 [X] confirm 다이얼로그
2. Modal resize 핸들 11×11 @ 315deg + 코너 안착 (modalEl 직접 부착)
3. Modal 하단 button-row sticky (콘텐츠 길이 무관 항상 하단)
4. Audit panel [Ingest][Delay] 우측 정렬 + provider/model 하단 고정
5. Ingest panel bottom bar 고정 (audit과 동일, gap 10px) — `.wikey-ingest-progress:empty {display:none}`로 빈 progress 영역 차지 제거
6. Brief 모달 schema preview 라인
7. NFC/NFD 한글 검색 fix (audit 패널)
8. Plugin 아이콘 search → book → book-open
9. styles.css resize handle 1.5배(7→11px) + 방향 cw-180

**audit panel auto-move PARA**:
- `wikey-obsidian/src/commands.ts`의 runIngestCore에 `autoMoveFromInbox?: boolean` 옵션 추가
- audit applyBtn은 true 전달 → ingest 후 raw/0_inbox/ 파일을 classifyFileAsync (CLASSIFY.md + LLM fallback)로 PARA 자동 라우팅
- moveFile + updateIngestMapPath 자동 호출
- inbox panel 'auto'는 기존 동작 유지 (plan phase classify + moveBtn explicit move)

**기타**:
- v6.1 실험 (temperature=0 + seed=42) → CV 악화 → 롤백
- pro 모델 (gemini-3.1-pro-preview) 1회 시험 → Concept 매우 보수적 (7개)
- PMS 원본 PDF를 `raw/0_inbox/` → `raw/3_resources/30_manual/`로 수동 이동 + ingest-map 키 갱신 + 백링크 점검 (모두 파일명 기반 wikilink, 위치 무관 → 무결)
- 테스트 97 → **143** (+46): schema.test.ts (20) + canonicalizer.test.ts (12) + wiki-ops.test.ts (+13)

**문서**:
- `plan/phase-3-todox-3.C-ingest-core-rebuild.md` 신규 (Plan 본체 + v6 결과 + v6.1 실험 분석)
- `activity/phase-3-resultx-3.C-ingest-comparison/README.md` 갱신 (v1~v6 종합 비교 표)
- `activity/phase-3-resultx-3.C-ingest-comparison/v3-file-list.txt` 신규
- CLAUDE.md 갱신 (canonicalizer.ts, schema.ts, ingest-modals.ts 경로 추가)

---

## 2026-04-19 오전 (Stay-involved UX + chunk 과다분할 진단 세션) 마감

### ⭐ 다음 세션 최우선 작업: PMS v2 재인제스트 + v1/v2 비교

**목표**: 금번 세션 마지막에 수정한 `callLLMForExtraction` 프롬프트가 v1 과다분할(581 → 20~40) 해소하는지 검증.

1. Obsidian **Cmd+R** (새 빌드 로드) → Audit 패널 → `raw/0_inbox/PMS_제품소개_R10_20220815.pdf` (이미 inbox에 복원됨) 선택 → Ingest
2. 생성 파일 수·UI 라벨 여부·업계 표준 보존·log/index 등재율·시간/토큰 측정
3. 결과를 `activity/phase-3-resultx-3.C-ingest-comparison/README.md` v2 섹션에 기록
4. v1(581) vs v2 정량 비교 표 완성

**이전 세션부터 누적된 잔여**:
- [#1] Audit 패널 인제스트 E2E — 이번 세션에 v1으로 실행됨, v2로 재검증 필요
- [#3] Obsidian UI 수동 테스트 — 재설계분 사람 눈 평가
- [B-2 #4] markitdown-ocr fallback E2E (OMRON 스캔 PDF)
- [B-2 #5] `.wikey/ingest_prompt_user.md` override E2E
- [B-2 #6] wiki/ 폴더 인제스트 가드 도입 결정

### 이번 세션 완료 (주요 10건)

**UX — Stay-involved 모달**:
- `IngestFlowModal` 통합 단일 모달 (Brief → Processing → Preview stepper)
- Brief 로딩 상태 + 비동기 `setBrief()` (즉시 모달 open, 10~30s LLM 대기 중 사용자 시각 피드백)
- Processing [Back] → Brief 복귀 (guide 유지, runIngest while 루프)
- Modal drag (h3 handle) + resize (SE corner grip 20×20, CSS 변수 기반 Obsidian max-width 우회)
- 이모지 제거 (CLAUDE.md 규칙 준수)

**UX — Audit 패널 대규모 개편**:
- Stat chip 3개 (All/Ingested/Missing) 클릭 토글 + **완전 원형 pill** (border-radius: 9999px) + active 상태 accent
- Filter row: `[Folder] [Search...] [List|Tree]` 오른쪽 정렬
- Select All 라인 우측에 "Total | N" (16px bold)
- Tree view: raw/ 최상위 숨김, SVG chevron (회전 애니메이션)
- List/Tree 토글 (동일 데이터, 뷰 전환)
- Fail/Cancelled 시각 구분 (fail=red, cancelled=gray)
- Cancel 후 재시도 UX: 체크 유지 + renderList() 호출로 stale UI 해소
- Provider/Model 셀렉트 **맨 아래로 배치** (Ingest 패널과 레이아웃 공유)
- Provider/Model 기본값 `(use Default Model)` + `(provider default)` — API 리스트 첫 항목 자동 선택 버그 방지

**UX — Ingest 패널 확장**:
- Provider/Model 셀렉트 추가 (Audit와 동일 패턴, 맨 아래 배치)
- Ingest 버튼은 기존 위치 유지

**UX — Dashboard**:
- Wiki 섹션에 `?` info 아이콘 (hover 툴팁 + 클릭 → `docs/ingest-decomposition.md`)
- Missing 경고 알림 문구 제거 (사용자 요구)

**기능 — Classify LLM fallback**:
- `classifyFile` PDF default 30_manual 제거 → LLM fallback 트리거
- DEWEY 카테고리 4 → **10개 확장** (000/100/200/300/400/500/600/700/800/900)
- `classifyFileAsync` + `classifyWithLLM` + `loadClassifyRules` 신설
- CLASSIFY.md에 템플릿·예시 섹션 추가 (LLM 참조용)
- 하드코딩 매칭 실패 시에만 LLM 호출 (비용 최소화)

**기능 — Ingest 핵심 수정**:
- `ingest-map.json` 슬래시 중복 정규화(`normalizeRawPath`) + `updateIngestMapPath` (이동 후 매핑 갱신)
- moveBtn 흐름 역전: 이동-후-인제스트 → **인제스트 성공 후 이동** (실패 시 inbox 잔류 → 재시도 가능)
- `skipPostMove` 옵션 추가 (PARA 이동은 호출자가 담당)
- Progress subStep/subTotal 세밀화: chunk i/N 진행률이 모달+row bar 양쪽에 부드러운 %로 반영
- `loadSettings` DEFAULT 명시 저장 (누락된 필드 자동 채움)
- generateBrief 404 로깅 강화 (`[Wikey brief] start: provider=X model=Y`)

**수정 — Gemini 404 원인 확정**:
- Google이 `gemini-2.0-flash` alias를 신규 사용자에게 **deprecate** — `models.list`는 여전히 반환하지만 `generateContent` 호출 시 404 ("no longer available to new users")
- `fetchModelList`에서 `gemini-2.0-flash`·`gemini-2.0-flash-lite` alias 필터링 (명시 버전 `-001`은 유지)
- `PROVIDER_CHAT_DEFAULTS.gemini = 'gemini-2.5-flash'` 단일 소스 확인

**진단 — chunk 프롬프트 과다분할 (v1 baseline)**:
- PMS 3.5MB PDF → 28,993자 → chunks 분할 → 각 청크 독립 추출 → **concepts 519 + entities 61 = 581 파일**
- 원인: `callLLMForExtraction` 프롬프트에 재사용 필터·환각 방지·상한 **전혀 없음** (이전 세션 보정은 `BUNDLED_INGEST_PROMPT`에만 적용)
- 과다 유형: UI 메뉴·기능명(`announcement`, `address-book`, `all-services` 등)이 concept 승격
- 정상 유지: 업계 표준 용어(`pmbok`, `wbs`, `gantt-chart`, `erp`, `mes` 등 14개)
- 현재: v1 파일 전부 원복(삭제) + PDF inbox 복귀 + chunk 프롬프트 새 버전(v2) 빌드
- 비교 데이터 저장: `activity/phase-3-resultx-3.C-ingest-comparison/{README.md, v1-file-list.txt, v1-concepts-sample.txt}`

---

### (구) 이번 세션 완료 (커밋 9개) — 직전 세션 기록

### 이번 세션 완료 (커밋 9개)

- `f597133` **lint**: Phase 3 E2E 중복 13건 제거 + slug 정규화 (23 files, +80/−280)
- `fb0a471` **feat(ingest)**: UI 재설계 + provider resolver + updateIndex 카테고리 분기 (30 files, +834/−83)
- `f93b061` **fix(ingest)**: I2 로컬 타임존 + I3 classify 2차 서브폴더 (4 files, +142/−18)
- `dc4d30c` **feat(classify)**: Dewey Decimal 자연계 3차 분류 + setup-para-folders.sh (4 files, +256/−34)
- `b9b5339` **docs**: 세션 정리 — 계획/메모 동기화 (3 files, +102/−7)
- `08990c1` **fix(settings)**: Default Model 섹션에 Model 필드 추가
- `cc94cfe` **refactor(settings)**: API 동적 Model 로드 + `.wikey-select` 통일 + Re-detect 위치 이동
- `8da2045` **style(select)**: 외곽 테두리 제거 + chevron #999→#bbb (밝게)
- `468564e` **style(select)**: box-shadow/outline 제거 (focus/hover 포함)
- `64cf969` **docs(session-wrap)**: UI 폴리싱 4 커밋 반영
- `3db253f` **refactor(defaults)**: `provider-defaults.ts` 단일 소스 도입 + gemini-flash 동급 통일
- (신규) **feat(setup)**: PARA 방법론 전체 반영 (Areas/Resources/Archive 동일 구조) + `setup-para.ts` TS 포팅으로 플러그인 onload 자동 배포

### 이번 세션 주요 변경

**UI 재설계 (Ingest 패널)**
- 상단 bulk 3버튼 제거 → drop zone + `[Add]` + inbox 섹션 통합
- inbox 행: filename + filesize + Cloud/Local 뱃지
- 하단 바: `[PARA select] [Ingest] [Delay]` (Move → Ingest로 교체)
- Fail state 10분 TTL 보존 (renderInboxStatus 재렌더 간)

**자동 Ingest**
- Settings: `autoIngest` toggle + interval (0/10/30/60s)
- `vault.on('create')` → debounce → 자동 `runIngest`

**OCR/Provider resolver (근본 수정)**
- `isModelCompatible()` guard: qwen이 gemini로 전달되는 404 버그 예방
- Provider onChange 시 ingestModel + cloudModel 동시 clear
- `WIKEY_MODEL` fallback 제거 → wikey-core가 provider 기본값 선택
- **Default Model 섹션에 상세 Model 드롭다운 추가** (이전엔 Provider만 있어 PROVIDER_DEFAULTS 하드코딩 의존)
- **Default/Ingest Model 상세 모델 = API 동적 드롭다운** (`fetchModelList` 재사용, Gemini/OpenAI/Anthropic/Ollama 모두)
- OCR 전용 설정 (`ocrProvider`/`ocrModel`), 미설정 시 basicModel 상속
- `resolveOcrEndpoint()`: gemini/openai/ollama OpenAI-compat 자동 선택
- 5-tier PDF 추출 체크포인트 console.info/warn (silent fail 해소)

**설정 UI 폴리싱 (세션 후반)**
- 설정 패널 6 selects 모두 `.wikey-select` 통일 (Audit/Ingest 패널과 동일 chevron 스타일)
- Environment `Re-detect` 버튼 하단 → h3 헤더 우측 이동 (`.wikey-settings-section-header`)
- `.wikey-select`: border / box-shadow / outline 제거 + chevron `#999`→`#bbb` (밝게)

**Provider-defaults 단일 소스 리팩토링 (세션 종반)**
- 신규 `wikey-core/src/provider-defaults.ts` — provider별 기본 모델 한 파일에 집중
- 하드코딩 6곳 → import 교체 (config / llm-client / ingest-pipeline OCR / query-pipeline / main.ts CONTEXTUAL / settings-tab ping)
- 기본 모델을 `gemini-2.5-flash` 동급 가성비로 통일:
  - gemini: `gemini-2.5-flash`
  - anthropic: `claude-haiku-4-5-20251001` (sonnet → haiku)
  - openai: `gpt-4.1-mini` (gpt-4.1 → 4.1-mini)
  - ollama: `qwen3:8b`
- Vision (OCR) 전용: gpt-4o-mini / gemma4:26b (로컬)
- 이후 모델명 변경은 `provider-defaults.ts` 한 곳만 수정하면 전 파이프라인 반영

**classify 개편**
- Dewey Decimal 10개 대분류 (000_general~900_lifestyle)
- 토큰 기반 매칭 (regex `\b` → `tokenize + Set.has`로 `_` 경계 해소)
- PARA 경로 버그 fix: `raw/resources/` → `raw/3_resources/`
- `scripts/setup-para-folders.sh` 신규 (66개 폴더 사전 생성)

**updateIndex 카테고리 분기**
- 기존: 모든 항목이 "## 분석" 섹션으로만 append
- 수정: `{entry, category}` 객체 받아 엔티티/개념/소스/분석 섹션에 insert

**I2 로컬 타임존**
- `toISOString().slice(0,10)` → `formatLocalDate()` (getFullYear/Month/Date)
- KST 00~09시 UTC 날짜로 하루 뒤로 찍히는 버그 fix

### 검증 결과

- 단위 테스트: **95/95 PASS** (이전 65/70 → 95)
- 빌드: 0 errors
- validate-wiki.sh: PASS (5/5)
- E2E Raspberry Pi HQ Camera: 18 페이지 (source 1 + entities 9 + concepts 8) 생성 + index.md 카테고리별 정렬 검증
- OCR 경로 관찰: OMRON 6.3MB 스캔 PDF → markitdown-ocr + gemma4:26b vision 트리거 확인

### 발견 이슈/기록

- **OCR 하드코딩** `gemma4:26b` — 수정 완료 (resolveOcrEndpoint)
- **Silent fail** — UI에 fail 상태 2초 후 사라지는 UX 버그 → 10분 TTL로 수정
- **classify PARA 경로** — `raw/resources/` 하드코딩 (PARA 재구조화 누락) → 수정
- **Provider/model 불일치** — settings migration 없어 basicModel 변경 시 ingestModel stale → isModelCompatible guard + onChange clear
- **index.md updateIndex 버그** — 모든 신규 항목이 "분석" 섹션으로만 → 카테고리 분기
- **Date UTC 편향** — toISOString의 날짜 shift → formatLocalDate
- **`.ingest-map.json` stale 항목** — `nanovna-v2-notes.md` 삭제 후에도 남음 (follow-up)

### Phase 4 이관 (이번 세션 신규 추가)

- **§4-4b LLM 기반 3차/4차 분류** — Dewey Decimal 매칭 실패 시 LLM으로 대분류 선택 + 제품 4차 폴더 제안 + Audit 패널 "Re-classify with LLM" 토글 + 피드백 학습 + 저가 모델 옵션

### 기존 스킬 후보 (유지)

| ID | 후보 | 비고 |
|----|------|------|
| S1 | `obsidian-e2e-scaffold` 스킬 | obsidian-cli + Notice MutationObserver + Monitor 폴링 |
| S2 | `diagnostic-logger.ts` 유틸 | 파이프라인 단계별 console.info 헬퍼 |
| S4 | `wiki-validate-cleanup` 스킬 | validate-wiki.sh + audit-ingest.py 체이닝 |

### 이번 세션 신규 환경 변경

- `.claude/settings.local.json`: `Monitor`, `TaskStop` 자동 승인 추가
- Obsidian 실행: `--remote-debugging-port=9222 --remote-allow-origins=*` (CDP E2E용). 테스트 종료 후엔 일반 재시작 권장

---

## 2026-04-18 (E2E + 리팩토링 세션) 마감

### ⭐ 다음 세션 핵심 작업: Phase 3 잔여 검증

**파일**: `plan/phase-3-todo.md` §B-1 + §B-2

#### B-1 Phase 3 원래 잔여
1. Audit 패널 인제스트 E2E (UI 클릭 흐름)
2. 인제스트 품질 검증 (16 entities + 12 concepts 신규 페이지 리뷰)
3. Obsidian UI 수동 테스트 (사람 눈 평가)

#### B-2 이번 세션 발생 follow-up
4. markitdown-ocr fallback E2E (실 스캔 PDF)
5. 단일 프롬프트 override 경로 E2E (`.wikey/ingest_prompt.md`)
6. wiki/ 폴더 인제스트 가드 도입 여부 결정

### 이번 세션 완료 (커밋됨, 7개)
- `92c9637` fix(ingest): OCR fallback + 4 이슈 수정 (race / logging / Ollama 404 / UI race)
- `7809d8f` docs: Phase 3 Obsidian E2E 테스트 결과 (`activity/phase-3-resultx-3.B-test-results.md`)
- `0421d7c` config(wikey): default 모델 변경 (basic=gemini, ollama=qwen3.6:35b-a3b)
- `79a458e` wiki: E2E 테스트 인제스트 아티팩트 + 자동 정리 (16E+12C)
- `ef63156` refactor(ingest-prompt): 단일 프롬프트 모델 + 모달 편집 UI
- `786983d` fix(ingest): log.md 헤더 형식 (`## [YYYY-MM-DD] ingest | <filename>`)
- `741040c` ui(sidebar): 헤더 탭 순서 (dashboard → ingest → audit → help) + 대시보드 hint eye 아이콘

### 이번 세션 검증 결과
- E2E 9 시나리오 (1, 2, 3, 3-1, 4, 4-1, 5a, 5b, 5c) 자동 실행
- PASS 6 (1/2/4/4-1/5a/5c) / PARTIAL 2 (3 silent skip, 5b 모호 메시지) / FAIL 1 (3-1 race)
- 발견 이슈 5건 → 4건 수정 + 회귀 검증 (이슈 5는 결정 보류)
- 단일 프롬프트 리팩토링 + 단위 70/70 + smoke test 통과
- 빌드 0 errors

### 스킬 후보 (다음 세션 또는 Phase 4에서 구현 결정)

| ID | 후보 | 비고 |
|----|------|------|
| S1 | `obsidian-e2e-scaffold` 스킬 | obsidian-cli + Notice MutationObserver + Monitor 폴링 패턴 자동화 (이번 세션 9회 반복) |
| S2 | `diagnostic-logger.ts` 유틸 | 파이프라인 단계별 console.info 헬퍼 + 누락 필드 warn (ingest-pipeline.ts에 적용한 패턴 재사용) |
| S4 | `wiki-validate-cleanup` 스킬 | validate-wiki.sh + audit-ingest.py 체이닝 + 자동 수정 (dupe 제거, 깨진 링크 변환, log 형식, index 등재) |

### 추가 follow-up (이번 세션 발견, plan/phase-4-todo.md 또는 phase-3-todo.md §B에 통합 예정)

| ID | 작업 | 우선 |
|----|------|------|
| F1 | wikey-obsidian 단위 테스트 (commands/sidebar/settings) | HIGH |
| F2 | `scripts/llm-ingest.sh` bash CLI 회귀 테스트 (4건 fix 동기화 또는 deprecate 결정) | MED |
| F4 | Scenario 3 (대규모 PDF + qwen3.6:35b-a3b) 재실행 — diagnostic 로깅으로 silent partial 원인 확정 | MED |

### Phase 4 이관 아이디어 (구현 X, 기록만)

- **model-benchmark.py** — Ollama × source × prompt 벤치 하니스 (이번 세션에 반복 작성한 /tmp/*.py 패턴 재사용 가능)
- **ollama-health.sh** — top PhysMem + /api/ps 메모리/VRAM 실시간 체크 헬퍼
- **prompt-baseline.py** — basic+user 프롬프트로 테스트 코퍼스 배치 실행 후 entity/concept counts diff

### 선택 문서 보강 (생략됨, 필요 시)
- `docs/getting-started.md` — Ingest Prompt 사용자 커스텀(A-1) 섹션 추가
- `local-llm/model-selection-guide.md` — Qwen3.6를 8B 업그레이드 경로로 명시
- `CLAUDE.md` — 플러그인 Ingest Model 설정 섹션 언급

---

## 과거 세션 (참고용)

> 생성일: 2026-04-10
> 이전 세션: wikey 프로젝트 초기 설정 + 계획 수립 (v2)

## 즉시 시작 (Step 1-3, Week 1)

### 1. [HIGH] Step 1: CLAUDE.md → wikey.schema.md 분리

CLAUDE.md(30KB, 모놀리식)를 분리:
- `wikey.schema.md` — 프로바이더 독립 마스터 스키마 (3계층 아키텍처, 워크플로우, 페이지 컨벤션, PII 규칙, LLM 다층 검색)
- `CLAUDE.md` — 경량화: "wikey.schema.md 읽으라" + Claude Code 도구 사용법
- `AGENTS.md` — "wikey.schema.md 읽으라" + Codex 특화 지시
- `local-llm/system-prompt.md` — 스키마 요약 + 로컬 LLM 제약

참고: `plan/phase-1-todo.md` Step 1 (1-1 ~ 1-4)

### 2. [HIGH] Step 2: 디렉토리 구조 + Git 초기화

- wiki/index.md, log.md, overview.md 빈 템플릿 생성
- raw/, wiki/ 하위 디렉토리 생성 확인
- scripts/, local-llm/ 디렉토리 생성
- .gitignore 작성 (raw/, .DS_Store, *.gguf)
- `git init` + `gh repo create wikey --private --source=. --push`

### 3. [HIGH] Step 3: validate-wiki.sh + check-pii.sh + pre-commit hook

- 5가지 정합성 검증 (프론트매터, 위키링크, 인덱스 등재, 로그 형식, 중복)
- PII 패턴 스캐닝 (한국 전화번호, 이메일, 주민번호)
- Git pre-commit hook 연동

## 이후 (Step 4-7, Week 1-2)

### 4. [MEDIUM] Step 4: Claude Code로 첫 인제스트 5건

- llm-wiki.md, idea-comment.md를 raw/로 복사하여 소스 1-2로 사용
- 웹 기사 1건, 메모 1건, PDF 1건 (청킹 테스트)
- 20+ 위키 페이지 생성 목표

### 5. [MEDIUM] Step 5: 쿼리 워크플로우 검증 5건

- 사실·교차합성·분석·엔티티·빈결과 쿼리 각 1건

## 현재 프로젝트 상태 요약

- 파일: CLAUDE.md, llm-wiki.md, llm-wiki-kor.md, idea-comment.md, plan/phase-3-full.md, plan/
- 미생성: wikey.schema.md, AGENTS.md, local-llm/, scripts/, .gitignore, Git
- wiki/, raw/: 빈 디렉토리 (콘텐츠 없음)
- 도구: Obsidian 1.12.7 + CLI 활성화, kepano/obsidian-skills 설치, Ollama 설치, Codex CLI 설치
