---
phase: 5
section: 5.7.5
title: Orama upstream sync 자동화 + LOW 잔여 + PoC cleanup + Developer Update UI (Todo, HOW)
status: planning
created: 2026-05-09
updated: 2026-05-09
version: v1.4
---

# Phase 5 §5.7.5 Orama upstream sync 자동화 + LOW 잔여 + PoC cleanup + Developer Update UI (Todo, HOW)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.7.5`](./phase-5-todo.md) (실행 단일 소스 — 체크박스 mirror) · [`plan/phase-5/phase-5-spec-5.7.5-orama-update-sync.md`](./phase-5-spec-5.7.5-orama-update-sync.md) (Spec, WHAT — 4-question 검증 + AC + Risk + Dependencies) · [`plan/phase-5/phase-5-spec-5.7.4-orama-migration.md`](./phase-5-spec-5.7.4-orama-migration.md) v9 (선행 cycle, deferral source)
>
> **버전 이력**:
> - v1 (2026-05-09 session 30, analyst 작성): SDD+TDD 흐름 mirror (§5.11 v2.5 양식) + 검증 의무 매트릭스 + Step A~D 단계별 체크박스 + 자체 20-anchor self-check (Layer 1 7-anchor + Layer 2 6 codex 패턴 + Layer 3 7 fix 모드 + wikey override h/i/j 추가).
>
> **wiki 재생성 없음 확증**: 본 §5.7.5 = settings-tab UI + 신규 update-checker 모듈 + scripts/check-* + LOW fix + PoC cleanup. wiki/ 본문 / frontmatter / 페이지 자체 변경 0. canonicalizer / mention extractor / ingest pipeline 변경 0. 검색·인덱싱 코어 변경 0 (§5.7.4 swap 결과 그대로 유지).
>
> **실행 단일 소스**: `plan/phase-5/phase-5-todo.md §5.7.5` (체크박스 = 진행 상태). 본 문서는 step-by-step 분해 + 검증 의무만 기술.

---

## 1. 진행 구조 — SDD + TDD 강제 (§5.11 v2.5 양식 mirror)

**Spec-Driven + Test-Driven 의무 흐름** (§5.7.4 todo v9 mirror, Phase 0~9):

```
Phase 0  Spec lock (phase-5-spec-5.7.5-orama-update-sync.md v1) → master 23-anchor 1차 grep → codex Mode D Panel 2차 검증 (cycle #1)
                                                                    ↓ APPROVE / NEEDS_REVISION
Phase 1  Step A — 환경 세팅 (사용자 결정 5건 잠금 완료 v1.2 — #1 (A) settings 토글 / #2 opt-in / #3 wikey 기본 BYOAI / #4 code lowercase 유지 + docs 정정 / #5 C5/C6 본 cycle 포함, 부가 4건 결정 의뢰 잔존)
Phase 2  Step B — TDD RED: 단위 테스트 신규 case 작성 (upstream-checker + update-analyzer + settings-tab developer 섹션 + LOW fix) → 모두 FAIL 확증
Phase 3  Step B — TDD GREEN: §3 변경 면 모두 구현 → 단위 + 기존 회귀 모두 PASS
Phase 4  Step B — TDD BLUE Phase 3a: 회귀 검증 (npm test + npm run build + ./scripts/validate-wiki.sh)
Phase 5  Step B — TDD BLUE Phase 3b: refactor (함수 분해 / Naming / DRY / 가독성), CLAUDE.md 정책 의무
Phase 6  Step C — typecheck + build + 단위 PASS + 라이브 cycle smoke (master 직접 obsidian-cdp)
Phase 7  Step B 코드 + Step C smoke 결과 → codex Mode D Panel 2차 검증 (cycle #2 post-impl)
Phase 8  Step D — 문서 동기화 (activity/phase-5/phase-5-result.md §5.7.5 entry / wiki/log.md / phase-5-todo.md mirror) + README developer mode 섹션 + commit
Phase 9  최종 master 1차 검증 + 사용자 사전 보고
```

**선행 의무 (Phase 0 직전)**:
1. `wikey.schema.md` 검색 코어 안정성 갱신 — 사용자 승인 의무 (CLAUDE.md 쓰기 규칙). default 권고 = *본 §5.7.5 진입 직전 별 step* (사용자 결정 §7.3 #선행 의무 1).
2. `claude-harness-helper` repo commit (master-validation skill + rules.md §10 압축) — 별 repo, 본 §5.7.5 scope 외 (master 단독 처리).

---

## 2. 검증 의무 매트릭스 (rules.md §10 + agent-management.md §7 + §5.7.4 todo v9 양식)

| 단계 | master 1차 | codex 2차 (Mode D Panel) | tester | 라이브 smoke |
|------|-----------|--------------------------|--------|--------------|
| Phase 0 spec lock | spec §8 self-check 23-anchor grep (Layer 1+2+3 + wikey override h/i/j) | cycle #1 (plan APPROVE) | — | — |
| Phase 1 Step A | 사용자 결정 5건 잠금 확증 + 선행 의무 2 항목 결정 확증 | — | — | — |
| Phase 2~3 TDD RED/GREEN | 매 RED/GREEN 후 fresh `npm test` (wikey-core + wikey-obsidian) | — | (master 직접 — TDD 강제) | — |
| Phase 4~5 BLUE 3a + 3b | 회귀 + refactor 후 fresh test/build/validate-wiki | — | — | — |
| Phase 6 라이브 smoke | obsidian-cdp Obsidian 재시작 + settings developer toggle on + 4 row 검증 + [분석] 버튼 + [개발필요] mark **master 직접** | — | — | **의무 (3 시나리오: AC-V1 / AC-V2 / AC-V3)** |
| Phase 7 post-impl | grep diff + Karpathy 4원칙 cross-check | cycle #2 (코드 + smoke evidence APPROVE) | — | — |
| Phase 9 최종 | **20 AC** line-by-line 증거 매핑 (= 단위 13 + 통합 4 + 라이브 3, v1.2 +AC-C5/C6) | — | — | — |

**검증 도구**:
- master 1차: `npm test` (wikey-core + wikey-obsidian fresh) / `npm run build` / `./scripts/validate-wiki.sh` / 23-anchor grep (rules.md §10 + wikey override)
- codex 2차: `cmux send` Mode D Panel — fresh-pick + close-after-cycle (agent-management.md §2)
- 라이브 smoke: `obsidian-cdp` SKILL — settings UI cycle (CLAUDE.md §6)

---

## 3. 4 단계 (Step A 환경 → B 코드 → C 검증 → D 동기화)

### Step A — 환경 세팅 + 사용자 결정 5건 잠금 (Phase 1)

**목적**: 본 cycle 시작 전 사용자 결정 5건 잠금 + 선행 의무 2 항목 결정 + 코드 변경 위치 fact-check.

**A1. 사용자 결정 5건 잠금** (spec §1.4 + §7.3 mirror)

- [x] **결정 #1** v1.2 잠금 = **(A) settings 토글** (`Show developer section`). §3.3 + AC-D1 mirror 완료.
- [x] **결정 #2** v1.2 잠금 = **opt-in** (사용자 명시 동의 후 호출). AC-U4 default 잠금.
- [x] **결정 #3** v1.2 잠금 = **wikey 기본 BYOAI** (`buildConfig` default provider). §3.2 + AC-U6 mirror.
- [x] **결정 #4** v1.2 잠금 = **code lowercase 유지 + spec/PoC docs 정정**. AC-L5 body 잠금.
- [x] **결정 #5** v1.2 잠금 = **본 cycle 포함** (권고 deferral 와 다름). C5/C6 신규 AC-C5 + AC-C6 도입. §1.2 / §4.5 / §5.1.1 / §4.7 분류 변경 (포함 9→11, deferral 9→7).

**A2. 부가 결정 4건 잠금** (spec §7.3 부가)

- [x] **선행 의무 #1** v1.4 잠금 = **`wikey.schema.md` 진입 직전 별 step** (Step A 직전 master 가 사용자 승인 받고 별 commit 진행).
- [x] **선행 의무 #2** v1.4 잠금 = **`claude-harness-helper` 별 repo master 단독** (본 spec scope 외, 본 cycle 안 master-validation skill anchor (f) exact match 갱신만 본 commit 에 포함, harness-helper repo 별 단계).
- [x] **B4 잠금** = **본 cycle 포함** — `upstream-checker.ts` 안 5번째 `kind: 'kiwi-dict'` row (~104MB 사전 추적, md5 + Kiwi release 비교, ~30 LOC).
- [x] **POC-1 잠금** = **cleanup** (Karpathy Simplicity). 3 PoC command + wikey-obsidian deps 제거 (~80 LOC).

**A3. 코드 변경 위치 fact-check** (spec §2 mirror, master fresh re-grep 의무)

- [x] `wikey-obsidian/src/settings-tab.ts` 의 *맨 마지막* line + section 양식 (`wikey-settings-*` prefix, line 83/94/117/136/396 등) 패턴 확증 (v1.1 fact-check)
- [x] `wikey-obsidian/src/commands.ts:96~522` 3 PoC command 위치 확증 (POC-1 결정에 따라 cleanup)
- [x] `wikey-obsidian/src/commands.ts:142~156` lowercase 부재 위치 확증 (LOW #5)
- [x] `wikey-core/src/search/orama-index.ts::persist()` 위치 확증 (LOW #14 atomic write)
- [x] `./scripts/reindex.sh --check --json` 의 stderr `MODULE_TYPELESS_PACKAGE_JSON` warn 재현 확증 (LOW #15)
- [x] `wikey-core/vendor/kiwi-nlp/VENDOR.md` 의 Kiwi git tag + vendor date 확증 (B7 detect script 의 input)

**A4. wikey-core 신규 모듈 위치 결정**

- [x] `wikey-core/src/update/upstream-checker.ts` (신규)
- [x] `wikey-core/src/update/update-analyzer.ts` (신규)
- [x] `wikey-core/src/__tests__/update/upstream-checker.test.ts` + `update-analyzer.test.ts` (신규)

**A5. wikey-obsidian settings-tab 변경 위치 결정**

- [x] `wikey-obsidian/src/settings-tab.ts` — 맨 마지막에 `wikey-settings-developer-section` 추가 (v1.1 prefix 정정)
- [x] `wikey-obsidian/src/main.ts` — onload 시 `detectUpstreamUpdates` 1회 호출 (사용자 동의 시)
- [x] `wikey-obsidian/src/__tests__/settings-tab-developer.test.ts` (신규)

**A6. scripts 신규 결정**

- [x] `scripts/check-kiwi-vendor-sync.sh` (~50 LOC, B7 detect)
- [x] `scripts/check-licenses.sh` (~30 LOC, LOW #7)

**Step A 체크박스**:

- [x] 사용자 결정 5건 + 부가 결정 4건 모두 잠금
- [x] 선행 의무 #1 (`wikey.schema.md` 갱신) 완료 또는 본 cycle 안 별 step 결정 잠금
- [x] 코드 변경 위치 6 항목 fact-check 완료
- [x] 신규 모듈 / 신규 script 위치 결정 잠금

### Step B — TDD RED→GREEN→BLUE 3a/3b (Phase 2~5)

**B1. RED — 단위 테스트 신규 case 작성** (Phase 2)

전체 신규 단위 테스트 = spec v1.2 의 20 AC 중 단위 부분 = 13 case (§5.1 11 + §5.1.1 2 = AC-C5 + AC-C6) + 통합 단위 가능한 부분 (AC-S1 / AC-L7 / AC-D1 grep) = **총 16 RED case** (단위 13 + 통합 가능 3 — V1~V3 라이브 + AC-P1 size 측정 제외, v1.2 fix: 14 → 16).

- [x] `wikey-core/src/__tests__/update/upstream-checker.test.ts` 신규 — AC-U1 + AC-U2 (2 case, mock fetch + kind 4 fixture)
- [x] `wikey-core/src/__tests__/update/update-analyzer.test.ts` 신규 — AC-U6 (1 case, mock LLM + mock fetch)
- [x] `wikey-obsidian/src/__tests__/settings-tab-developer.test.ts` 신규 — AC-U3 + AC-U5 + AC-U7 + AC-U8 (4 case, mock plugin settings + DOM)
- [x] `wikey-obsidian/src/__tests__/main-update-onload.test.ts` 신규 — AC-U4 (1 case, mock onload + spy)
- [x] `wikey-core/src/__tests__/search/orama-index-persist.test.ts` 확장 — AC-L14 (1 case, atomic write + abort)
- [x] `wikey-core/src/__tests__/scripts/reindex-lazy-import.test.ts` 신규 — AC-L15 (1 case, engine='qmd' branch + stderr capture)
- [x] `wikey-core/src/__tests__/search/lowercase-consistency.test.ts` 신규 — AC-L5 (1 case, 사용자 결정 #4 결과 mirror)
- [x] `scripts/__tests__/check-kiwi-vendor-sync.test.sh` 신규 (또는 wikey-core integration) — AC-S1 (1 case, mock curl + stdout grep)
- [x] `scripts/__tests__/check-licenses.test.sh` 신규 — AC-L7 (1 case, mock package.json + NOTICE diff)
- [x] README docs grep test (작은 verification) — AC-D1 (1 case, grep `Developer (advanced)` + `[upgrade]` + `[분석]` + `[개발필요]`)
- [x] **(v1.2 신규)** `wikey-core/src/__tests__/config-search-top-n-alias.test.ts` 신규 — AC-C5 (1 case, `WIKEY_SEARCH_TOP_N` alias + `WIKEY_QMD_TOP_N` deprecation warn)
- [x] **(v1.3 정정 — finding 2 fix)** `wikey-obsidian/src/__tests__/env-detect-engine-flag.test.ts` 신규 — AC-C6 (2 case: searchEngine='orama' 시 qmd path block call 0 + ABI scan skip / searchEngine='qmd' 시 정상 inline detect)
- [x] 모두 FAIL 확증 후 `npm test` log 보존 → commit `test: §5.7.5 RED — 16 case (developer update UI + LOW fix + scripts + C5/C6 v1.2)`

**B2. GREEN — §3 변경 면 모두 구현** (Phase 3)

순서대로 (의존성 고려):

- [x] **(A4 먼저)** `wikey-core/src/update/upstream-checker.ts` (신규, ~150 LOC) — `detectUpstreamUpdates` + `UpdateItemDescriptor` 4 kind detect (kiwi-nlp / orama / qwen3-embedding / qmd-vendored). AC-U1, AC-U2.
- [x] **(A4 후)** `wikey-core/src/update/update-analyzer.ts` (신규, ~80 LOC) — `analyzeUpdate` LLM 요약 + devRequired heuristic. AC-U6.
- [x] **(A6 script)** `scripts/check-kiwi-vendor-sync.sh` (~50 LOC) — `bab2min/Kiwi` releases API + VENDOR.md 비교. AC-S1.
- [x] **(A6 script)** `scripts/check-licenses.sh` (~30 LOC) — package.json deps + NOTICE grep diff. AC-L7.
- [x] **(A5 settings-tab)** `wikey-obsidian/src/settings-tab.ts` — 맨 마지막에 `[developer]` 섹션 + `renderUpdateRow` helper (~80 LOC). exact phrase: `Developer (advanced)` / `[upgrade]` / `[분석]` / `[개발필요]`. AC-U3, AC-U5, AC-U7, AC-U8.
- [x] **(A5 main.ts onload + v1.3 finding 4 fix)** `wikey-obsidian/src/main.ts` — onload 시 `if (settings.developerMode && settings.allowUpdateCheck) { detectUpstreamUpdates(...) }` 1회 호출 + `runUpdateAnalysis` method (~30 LOC). **`WikeySettings` (main.ts:34)** + **`DEFAULT_SETTINGS` (main.ts:87)** + **`buildPluginOnlyData` (main.ts:651)** 에 `developerMode: false` + `allowUpdateCheck: false` field 추가 의무. AC-U4 matrix 3건 검증.
- [x] **(LOW #14)** `wikey-core/src/search/orama-index.ts::persist()` — atomic write (`<cachePath>.tmp` + `fs.renameSync`) + abort signal check (~15 LOC). AC-L14.
- [x] **(LOW #15)** `wikey-core/src/scripts/reindex.ts::runOramaIngest` — `createKoreanTokenizer` lazy import (engine='orama' branch 안에서만 load) (~10 LOC). AC-L15.
- [x] **(LOW #5)** 사용자 결정 #4 결과 mirror — code lowercase 유지 권고 시: PoC `wikey-obsidian/src/commands.ts:142~156` 와 `scripts/korean-tokenize.py::_smart_tokenize` 의 docs 정정 + 단위 테스트. AC-L5.
- [x] **(POC-1)** 사용자 결정 cleanup 권고 시: `wikey-obsidian/src/commands.ts:96~522` 3 PoC command 제거 + `wikey-obsidian/package.json` deps (`kiwi-nlp`, `@orama/orama`) 제거 (~80 LOC 제거). 보존 시: 변경 0. AC-P1.
- [x] **(POC-3)** main.js size 측정 — `ls -la wikey-obsidian/main.js | awk '{print $5}'` 결과 보고 (cleanup 후 ≤ 400K 예상). AC-P1 sub.
- [x] **(C5 v1.2)** `wikey-core/src/config.ts:13` defaults + `wikey-obsidian/src/main.ts:513` `loadFromWikeyConf` parser — `WIKEY_SEARCH_TOP_N` alias 신규 + `WIKEY_QMD_TOP_N` deprecation marker (~30 LOC + console warn 1회). AC-C5.
- [x] **(C6 v1.3 정정 — finding 2 fix)** `wikey-obsidian/src/env-detect.ts:253 detectEnvironment` 시그니처 확장 → `detectEnvironment(basePath, ollamaUrl, searchEngine)`. `searchEngine !== 'qmd'` 분기에서 line 273~283 qmd inline block + `findCompatibleNode` ABI scan **skip** (`status.qmdPath = ''` + `status.nodePath = process.execPath`). 호출 site 갱신 = `wikey-obsidian/src/main.ts` 안 `detectEnvironment` 호출 (~3 위치, fact-check 의무 Step A3). ~30 LOC + 단위 2 case (engine='orama' = qmd block call 0 / engine='qmd' = inline detect 정상). AC-C6.
- [x] 16 RED case 모두 PASS + 기존 wikey-core / wikey-obsidian 회귀 PASS 확증 → commit `feat: §5.7.5 GREEN — developer update UI + LOW fix + PoC cleanup + C5/C6`

**B3. BLUE Phase 3a — 회귀 검증** (Phase 4)

- [x] `npm test` (wikey-core fresh) — 모든 case PASS, 기존 회귀 무손상
- [x] `npm test` (wikey-obsidian fresh) — 회귀 PASS
- [x] `npm run build` (wikey-core + wikey-obsidian) — 0 errors
- [x] `./scripts/validate-wiki.sh` — wiki/ frontmatter 무결성 PASS
- [x] `./scripts/check-licenses.sh` — 본 cycle 직접 실행 (NOTICE / package.json deps 정합성 확증)
- [x] `./scripts/check-kiwi-vendor-sync.sh` — 본 cycle 직접 실행 (현재 vendor 와 upstream 비교 확증)

**B4. BLUE Phase 3b — refactor** (Phase 5, CLAUDE.md SDD+TDD 정책 의무)

- [x] **함수 분해**: 50+ LOC 함수 후보 (예: `detectUpstreamUpdates` 의 4 kind 별 fetch — extract 후보) ~30 LOC 단위로 split
- [x] **Naming consistency**: `UpdateItem*` 시리즈 / `developerMode` / `allowUpdateCheck` 등 일관 점검
- [x] **DRY**: 4 kind 별 fetch 의 공통 패턴 (URL fetch + parse + version 비교) extract — 또는 *의도적 유지* 근거 명시 (kind 별 source 다양 — generic abstraction = over-spec)
- [x] **주석 quality**: TODO/FIXME 0 / historical context 압축 / `[사용자 결정]` 마커 cleanup (사용자 결정 잠금 후 marker 제거 + 결정 결과 명시)
- [x] **가독성**: nested arrow / magic number (e.g. update check timeout `30000ms`) 상수화
- [x] 각 refactor 후 회귀 검증 반복 (`npm test`) → commit `refactor: §5.7.5 BLUE — 함수 분해 / DRY / Naming`

### Step C — 단위 + 라이브 smoke (Phase 6)

- [x] `npm test` final fresh re-run (wikey-core + wikey-obsidian) — 모든 PASS
- [x] `npm run build` final — 0 errors
- [x] `./scripts/validate-wiki.sh` final — PASS
- [x] **라이브 smoke 1 (AC-V1)**: obsidian-cdp Obsidian 재시작 → settings tab 열기 → `Show developer section` 토글 on → `[developer]` 섹션 표시 → 4 row 모두 표시 (kiwi-nlp / orama / qwen3-embedding / qmd-vendored) + 각 row 의 currentVersion 정상 + update 있으면 `[upgrade]` 뱃지 표시. console log + DOM 캡처.
- [x] **라이브 smoke 2 (AC-V2)**: 4 row 중 1 row 의 `[분석]` 버튼 클릭 → LLM 호출 1회 + summary 표시 ≤ 30s. devRequired=true 결과 시 `[개발필요]` 마크 표시 확증.
- [x] **라이브 smoke 3 (AC-V3)**: settings developer toggle off → 섹션 숨김 + plugin onload 시 `detectUpstreamUpdates` 호출 0 (사용자 동의 옵트아웃 path 작동). console log spy.
- [x] 모든 smoke PASS console log 보존 → `activity/phase-5-resultx-5.7.5-orama-update-sync-<date>.md` 작성

### Step D — 문서 동기화 (Phase 8)

- [x] **`activity/phase-5/phase-5-result.md`** §5.7.5 entry 신규 — 마이그레이션 후 운영 결과 + **AC 20 매핑** (= §5.1 11 + §5.1.1 2 + §5.2 4 + §5.3 3, v1.2/v1.3) + cycle 이력 (codex cycle #1 NEEDS_REVISION fix + cycle #2 plan APPROVE + #3 post-impl)
- [x] **`activity/phase-5-resultx-5.7.5-orama-update-sync-<date>.md`** 신규 — 라이브 smoke evidence + AC-V1/V2/V3 console log + AC-P1 main.js size 측정 결과
- [x] **`wiki/log.md`** entry — *infrastructure* 변경 (settings UI + scripts) 라 wikey.schema.md §"log.md 형식 (§5.11 v2 의미 재정의)" 의 *지식 log only* 정책 따라 미기록 가능 (master 판단). 본 cycle 결과로 wiki 페이지 변경 0 확증.
- [x] **`plan/phase-5/phase-5-todo.md §5.7.5`** 체크박스 mirror — 본 todo 의 Step A~D 결과 반영 + 4 그룹 (B 7 + LOW 4 + PoC 3 + C 4 + 비목표 2) 의 *최종 분류* (**포함 11 / 단순화 9 / deferral 7**, v1.2/v1.3) 갱신
- [x] **`README.md ## Developer mode` 섹션** 추가 (~30 줄, v1.3 finding 5 fix — 결정 #1 (A) 잠금 mirror) — toggle 활성화 방법 = **`Show developer section` settings 토글만** (옵션 B: env / 옵션 C: 양쪽 미도입, 코드 변경 0) + 4 row 의미 + `[upgrade]` 뱃지 + `[분석]` 버튼 + `[개발필요]` 마크 흐름 docs. exact phrase: `Developer (advanced)` + `[upgrade]` + `[분석]` + `[개발필요]` + `Show developer section`. AC-D1.
- [x] **`docs/kiwi-nlp-vendor-sync.md`** 갱신 (선택) — 본 §5.7.5 의 `scripts/check-kiwi-vendor-sync.sh` reference 추가 (수동 절차 대신 script 1줄 실행 안내)
- [x] **NOTICE 갱신** (POC-1 cleanup 시) — `kiwi-nlp` / `@orama/orama` 의 wikey-obsidian dep 제거 반영 — `scripts/check-licenses.sh` 실행 후 정합성 확증
- [x] commit 분리 (논리 단위): `feat: §5.7.5 ...` (코드) / `docs: §5.7.5 ...` (문서) / `chore: §5.7.5 LOW fix + PoC cleanup` (정리)

---

## 4. 단계별 체크박스 (요약, AC 1:1 매핑)

| Step | 체크박스 | AC mapping | LOC 추정 |
|------|---------|------------|---------|
| **A1** 사용자 결정 5건 잠금 | [ ] | (전제) | 0 |
| **A2** 부가 결정 4건 잠금 | [ ] | (전제) | 0 |
| **A3** 코드 변경 위치 fact-check | [ ] | (전제) | 0 |
| **A4** wikey-core 신규 모듈 위치 결정 | [ ] | (전제) | 0 |
| **A5** wikey-obsidian settings-tab 변경 위치 결정 | [ ] | (전제) | 0 |
| **A6** scripts 신규 결정 | [ ] | (전제) | 0 |
| **B1** RED 16 case 작성 (v1.2) | [ ] | U1, U2, U3, U4, U5, U6, U7, U8, L5, L7, L14, L15, S1, D1, **C5, C6** | ~440 (test) |
| **B2-upstream-checker** `wikey-core/src/update/upstream-checker.ts` | [ ] | AC-U1, AC-U2 | ~150 |
| **B2-update-analyzer** `wikey-core/src/update/update-analyzer.ts` | [ ] | AC-U6 | ~80 |
| **B2-script-kiwi-sync** `scripts/check-kiwi-vendor-sync.sh` | [ ] | AC-S1 | ~50 |
| **B2-script-licenses** `scripts/check-licenses.sh` | [ ] | AC-L7 | ~30 |
| **B2-settings-tab** `wikey-obsidian/src/settings-tab.ts` `[developer]` 섹션 + renderUpdateRow (CSS prefix `wikey-settings-developer-*`, fact-check v1.1) | [ ] | AC-U3, AC-U5, AC-U7, AC-U8 | ~80 |
| **B2-main-onload** `wikey-obsidian/src/main.ts` onload + runUpdateAnalysis | [ ] | AC-U4 | ~30 |
| **B2-LOW14** `orama-index.ts::persist()` atomic write | [ ] | AC-L14 | ~15 |
| **B2-LOW15** `runOramaIngest` lazy import | [ ] | AC-L15 | ~10 |
| **B2-LOW5** lowercase 정합 (사용자 결정 #4 mirror) | [ ] | AC-L5 | varies |
| **B2-POC1** PoC 3 command cleanup (사용자 결정 mirror) | [ ] | AC-P1 | ~80 (제거) or 0 (보존) |
| **B2-POC3** main.js size 측정 | [ ] | AC-P1 sub | 0 (verify) |
| **B2-C5 (v1.2)** `WIKEY_SEARCH_TOP_N` alias + `WIKEY_QMD_TOP_N` deprecation marker | [ ] | AC-C5 | ~30 |
| **B2-C6 (v1.3)** `env-detect.ts::detectEnvironment(basePath, ollamaUrl, searchEngine)` 시그니처 확장 + qmd block conditional skip | [ ] | AC-C6 | ~30 |
| **B3** BLUE Phase 3a 회귀 검증 | [ ] | (전체) | 0 (검증) |
| **B4** BLUE Phase 3b refactor | [ ] | (전체) | varies |
| **C-V1** 라이브 smoke obsidian-cdp [developer] 섹션 + 4 row | [ ] | AC-V1 | 0 (실행) |
| **C-V2** 라이브 smoke [분석] 버튼 + [개발필요] mark | [ ] | AC-V2 | 0 (실행) |
| **C-V3** 라이브 smoke developer toggle off + onload 호출 0 | [ ] | AC-V3 | 0 (실행) |
| **D-result** activity result + resultx | [ ] | (전체) | varies |
| **D-readme** README.md `## Developer mode` 섹션 | [ ] | AC-D1 | ~30 |
| **D-vendor-sync** `docs/kiwi-nlp-vendor-sync.md` 갱신 (선택) | [ ] | (선택) | ~10 |
| **D-notice** NOTICE 갱신 (POC cleanup 반영) | [ ] | (선택, AC-L7 sub) | varies |
| **D-todo-mirror** plan/phase-5/phase-5-todo.md §5.7.5 mirror | [ ] | (전체) | varies |

**27 입력 항목 검증 결과 mirror** (spec §4.7 mirror):

| 분류 | 개수 | 항목 |
|---|---|---|
| 포함 (해당 cycle 의무) | **11** | UI-1, UI-2, UI-3, UI-4, UI-5, UI-6, LOW #14, LOW #15, LOW #7, **C5 (v1.2)**, **C6 (v1.2)** |
| 수정 포함 (단순화) | **9** | UI-7 (표시까지만), B1 (재시작 1회), B2 (LLM analyze 흡수), B4 (본 cycle 포함, UI-4 자연 row), B7 (detect + script 까지), LOW #5 (code lowercase 유지 + docs 정정), POC-1 (cleanup), POC-2 (POC-1 종속), POC-3 (1줄 verification) |
| deferral / 폐기 | **7** | B3, B5, B6, C1, C2, HYBRID, BENCH-AUTO (v1.2: C5/C6 본 cycle 이동) |

총 27 입력 항목, 본 cycle 안 실 작업 = **20** (포함 11 + 수정 9), 별 cycle deferral = 7.

---

## 5. 자체 23-anchor self-check (Layer 1 7-anchor + Layer 2 6 codex 패턴 P1~P6 + Layer 3 7 fix 모드 F1~F7 + wikey override h/i/j)

본 todo v1 의 self-check (master v1 작성 직후 — Layer 1 + Layer 2 + Layer 3 + wikey project analyst override = 23 anchor):

### 5.1 Layer 1 — 7-anchor (rules.md §10)

| # | Anchor | 결과 | 검증 명령 |
|---|--------|------|-----------|
| (a) | 시그니처 일관성 — `developerMode` / `allowUpdateCheck` / `UpdateItemDescriptor` / `UpdateCheckResult` / `[upgrade]` / `[분석]` / `[개발필요]` / `Developer (advanced)` / `Show developer section` 본 todo + spec cross-file 동일 (v1.3: `WIKEY_DEVELOPER_MODE` env 키 미도입 잠금, history mention 만 보존) | PASS_v1.3 — Step A1 + B2 + Step D-readme + §4 표 + §5 self-check 모두 일관 | `grep -nE "developerMode\|allowUpdateCheck\|UpdateItemDescriptor\|\[upgrade\]\|\[분석\]\|\[개발필요\]\|Developer \(advanced\)\|Show developer section" plan/phase-5/phase-5-todox-5.7.5-orama-update-sync.md plan/phase-5/phase-5-spec-5.7.5-orama-update-sync.md` |
| (b) | state/data 표 형식 — 27 입력 검증 표 + §4 단계 체크박스 표 numbering 일관 | PASS_v1.3 — §4 의 모든 행이 spec v1.3 §4.7 (**11 + 9 + 7 = 27**) 와 동기화 | line-by-line cross-check |
| (c) | builder/parser 분기 — `detectUpstreamUpdates` lifecycle (onload 1회 / [분석] 버튼 trigger) + `developerMode` + `allowUpdateCheck` 양쪽 toggle 분기 (UI 표시 vs 부재 + network 호출 vs 0) 모두 명시 (v1.3 보강) | PASS_v1.3 — Step B2-main-onload + Step B2-settings-tab 모두 명시 + AC-U4 matrix 3건 | grep `"onload"` + `"developerMode"` + `"allowUpdateCheck"` |
| (d) | AC test 케이스 1:1 매핑 — spec v1.3 의 **20 AC** (= §5.1 11 + §5.1.1 2 + §5.2 4 + §5.3 3) 와 §4 표의 AC mapping 행 일대일 | PASS_v1.3 — 모든 AC (U1~8 / L5/L7/L14/L15 / **C5/C6** / S1 / P1 / D1 / V1~V3) 가 §4 표 한 행 이상에 매핑 + B1 RED 16 case 와 cross-check | `grep -cE "AC-[A-Z][0-9]" plan/phase-5/phase-5-todox-5.7.5-orama-update-sync.md` ≥ 20 |
| (e) | self-check 모든 행 drift 없음 — v1.3 작성 직후 stale 0 본문 한정 (변경 이력 + history mention 의도적 보존) | PASS_v1.3 — v1.3 fix 후 stale 0 | (본 §5 line read) |
| (f) | footer + 변경 이력 + cycle 번호 — header v1.3 ↔ §6 변경 이력 v1.3 ↔ footer cycle # (codex #1 NEEDS_REVISION fix → cycle #2 APPROVE) 일관 (exact match — prefix `v1` match 회피) | PASS_v1.3 | `grep -nE "^version: v1\.3$"` exact match |
| (g) | 코드 ↔ test exact phrase — Step A1 의 결정 잠금 (v1.2 #1 (A) settings 토글) ↔ AC-D1 `Show developer section` / Step B2-settings-tab 의 `Developer (advanced)` ↔ AC-U3 / Step B2-script-kiwi-sync 의 `bab2min/Kiwi` ↔ AC-S1 / `[upgrade]` / `[분석]` / `[개발필요]` 양쪽 hit | PASS_v1.3 — `grep -F "[upgrade]"` + `grep -F "[분석]"` + `grep -F "[개발필요]"` + `grep -F "Developer (advanced)"` + `grep -F "Show developer section"` + `grep -F "bab2min/Kiwi"` + `grep -F "Third-party software"` 양쪽 (spec + todo) hit | grep 명령 |

### 5.2 Layer 2 — 6 codex 패턴 P1~P6 (master 1차 self-check 의무)

| Pattern | 결과 (analyst v1 작성 직후) |
|---------|---------------------------|
| **P1 Fact-check** | spec §2 의 grep 직접 read 확증. line number micro drift 가능 — 구현 시 (Step A3) master 가 fresh re-grep + 잠금. |
| **P2 Cross-file consistency** | spec §3 + §4 + §5 + §6 + §7 의 모든 reference + todo §3 + §4 + §5 모두 일관. `[사용자 결정]` 5건 spec §1.4 + §3 + §4 + §7.3 mirror — todo §3 Step A1 + §4 표 mirror. |
| **P3 Spec→Todo byte mirror** | spec §4.7 표 (**11 + 9 + 7 = 27**, v1.2) ↔ todo §4 표 byte-level mirror 의무 — v1.2 작성 시 동일 anchor + 동일 count + 동일 항목명 사용. exact phrase mirror = `Developer (advanced)` / `[upgrade]` / `[분석]` / `[개발필요]` / `bab2min/Kiwi` / `Third-party software` / **`WIKEY_SEARCH_TOP_N`** 양쪽 hit 확증. |
| **P4 Implementation feasibility** | settings-tab `[developer]` 섹션 = 기존 `wikey-settings-*` prefix 패턴 mirror (v1.1 fact-check 결과) — feasible. update-checker fetch DI = test mock 가능. analyzeUpdate LLM = 기존 llm-client wrap. atomic write = `fs.renameSync` 표준. lazy import = esbuild dynamic import 지원. |
| **P5 Legal accuracy** | 본 cycle 의 license 영역 = `scripts/check-licenses.sh` (NOTICE / package.json deps grep diff). 기존 NOTICE (LGPL §6 4 의무) 변경 0 — POC cleanup 시 `kiwi-nlp` / `@orama/orama` 의 wikey-obsidian dep 제거만 반영. license layer accuracy 보존. |
| **P6 Numeric consistency** | `grep -cE "^\| \*\*AC-"` ≥ **20** (5.1 = 11 + 5.1.1 = 2 + 5.2 = 4 + 5.3 = 3 = 20, v1.2 +C5/C6). §4 표 LOC 합계 → 본 cycle **~1005 LOC** cleanup 시 (test ~440 + 코드 ~565: upstream-checker 150 + update-analyzer 80 + scripts 80 + settings-tab 80 + main-onload 30 + LOW14 15 + LOW15 10 + POC1 80 + readme 30 + **C5 30 + C6 20** + LOW5 varies) 또는 **~925 LOC** 보존 시 (POC1 0). spec §4.7 합계 = **11 + 9 + 7 = 27**. spec §1.4 사용자 결정 5건 모두 v1.2 잠금 (#1 (A) / #2 opt-in / #3 wikey 기본 / #4 code 유지 + docs / #5 본 cycle 포함). 모든 count 일치. (v1.2 fix: AC 18→20, RED 14→16, LOC 955→1005 / 875→925, 분류 9+9+9 → 11+9+7) |

### 5.3 Layer 3 — 7 fix 모드 F1~F7 (master 영구 등록)

| # | 실패 모드 | 본 v1 작성 직후 결과 |
|---|---------|-------------------|
| **F1 Partial replacement** | 본 v1 = analyst 작성 — replace_all 누락 risk 0. master fix loop 진입 시 의무. |
| **F2 Cascading rename incomplete** | 본 v1 = rename 0 (신규 작성). |
| **F3 Header/Body mismatch** | §4 표 LOC 추정 합계 = ~1005 LOC (cleanup) / ~925 LOC (보존) ↔ B1 RED 16 case + B2 13 항목 일치 (v1.2 정정). spec §5 헤더 "총 20 개" ↔ §5.1 (11) + §5.1.1 (2) + §5.2 (4) + §5.3 (3) = 20 일치 (cross-check). |
| **F4 Spec→Todo mirror 누락** | 본 todo v1 가 spec v1 의 모든 reference mirror — exact phrase + AC count + 사용자 결정 + 분류 표 모두 매치. 별 grep cross-check 의무. |
| **F5 History context 와 활성 본문 혼동** | §6 변경 이력 = v1 만 — historical 표현 0. |
| **F6 Implementation feasibility 미검증** | P4 와 동일. |
| **F7 Codex 권고 over-literal 적용** | 본 v1 = codex finding 0 (cycle 미진입). |

### 5.4 wikey analyst override anchor h, i, j (project specialization, CLAUDE.md §1)

| # | Anchor | 결과 | 검증 명령 |
|---|--------|------|-----------|
| **(h) schema 4 원칙 일치** | Explicit / Yours / File over app / BYOAI 4 원칙 충돌 0 | PASS_v1.3 — (Explicit) settings UI 가 dep / vendor update 상태 가시화 / (Yours) 모든 dep 가 wikey 안 local — 외부 SaaS 의존 0 / (File over app) NOTICE / VENDOR.md / settings 변경 모두 marker 파일 / (BYOAI) [분석] 버튼이 wikey 기본 provider 사용 (사용자 결정 #3) | wikey.schema.md §"LLM Wiki 개인화의 4가지 장점" cross-check |
| **(i) 3계층 경계 준수** | raw / wiki / schema 권한 위반 0 | PASS_v1.3 — 변경 면 = settings-tab + 신규 update-checker 모듈 + scripts/check-* + NOTICE/README. raw/ 변경 0, wiki/ 변경 0, wikey.schema.md = 사용자 승인 의무 (선행 의무 #1, Step A2 명시) | grep `"raw/"` 변경 0 + grep `"wiki/"` 변경 0 |
| **(j) 워크플로우 4 일관** | ingest / query / lint / 삭제·수정 흐름 schema 정의 일치 | PASS_v1.3 — 변경 면이 4 워크플로우 *동작* 변경 0 (settings-tab UI + 신규 update-checker + LOW fix 는 모두 *infrastructure*). canonicalizer / mention extractor / ingest pipeline 변경 0 = ingest 보존. query path 변경 0 = query 보존. wiki 본문 변경 0 = lint / 삭제·수정 보존 | wikey.schema.md §"시스템 워크플로우" cross-check |

---

## 6. 변경 이력

| 버전 | 일시 | 변경 |
|------|------|------|
| **v1** | 2026-05-09 session 30 (analyst 작성) | 초안 — SDD+TDD 흐름 (Phase 0~9 mirror) + 검증 매트릭스 + Step A~D 체크박스 + 27 입력 검증 mirror (spec §4.7) + 자체 23-anchor self-check (Layer 1 + Layer 2 + Layer 3 + wikey override h/i/j). master fix / codex cycle 미진입 — v1 = analyst 작성 직후 상태. |
| **v1.1** | 2026-05-09 session 30 (master 1차 검증 fix) | master-validation 스킬 23-anchor 적용 결과 2 fix mirror: (1) **P1 fact-check** — settings-tab CSS prefix `wikey-settings-developer-*` 정정 (§4 B2-settings-tab 행 + spec §2/§3.3/AC-U5 mirror). (2) **F3 Header/Body** — §5.2 P6 LOC 합계 ~565 → ~955 (cleanup) / ~875 (보존) 정정 + §5.3 F3 행 mirror. master-validation skill 갱신 의무 0 (M2 = P1 하위 케이스, M5 = F3 일반 케이스). |
| **v1.2** | 2026-05-09 session 30 (사용자 결정 5건 잠금) | 사용자 결정 잠금: #1 (A) settings 토글 / #2 opt-in / #3 wikey 기본 BYOAI / #4 code 유지 + docs 정정 / **#5 C5/C6 본 cycle 포함**. todo mirror: Step A1 모든 결정 [x] (../잠금) + B1 RED 14→16 case (+C5/C6) + B2 GREEN +2 항목 (B2-C5/B2-C6) + §4 표 +2 행 + §4 분류 합계 9/9/9 → **11/9/7** + §1 Phase 9 18→20 AC + §5 self-check Layer 1 (d) AC 18→20 + Layer 2 P3/P6 / Layer 3 F3 LOC 정정 + 변경 이력 v1.2 행 추가. |
| **v1.4** | 2026-05-09 session 30 (codex cycle #2 APPROVE + 부가 결정 잠금) | spec v1.4 mirror — 부가 결정 4건 [x] 잠금 (Step A2): 선행 의무 #1 schema 진입 직전 별 step / #2 harness-helper 별 repo master 단독 / B4 Kiwi 사전 본 cycle 포함 (`kind:'kiwi-dict'` 5번째 row, ~30 LOC) / POC-1 cleanup. self-check (e)/(f) v1.4 mirror + footer v1.4 mirror + cycle #2 APPROVE 추적. master-validation skill anchor (f) exact match 갱신 (사용자 승인). |
| **v1.3** | 2026-05-09 session 30 (codex cycle #1 NEEDS_REVISION fix mirror) | spec v1.3 의 6 finding fix (HIGH 0 / MED 5 / LOW 1) mirror — (1) Step D §결과/todo mirror line 의 `AC 20` + `포함 11/단순화 9/deferral 7` 정정 / (2) **B2-C6 정확화** — `findQmdBin` 부재 fact-check 결과 `detectEnvironment(basePath, ollamaUrl, searchEngine)` 시그니처 확장 + qmd inline block / ABI scan conditional skip 으로 정정. RED test file 이름 = `env-detect-engine-flag.test.ts`. (4) **B2-main-onload 보강** — `WikeySettings.developerMode` + `allowUpdateCheck` field 추가 의무 명시 + AC-U4 matrix 3건. (5) **D-readme** 결정 #1 (A) settings 토글만 문서화 (env 표기 제거, history 잔존만). codex 권고 모두 정확 (false positive 0). master fix 직접. master-validation skill 갱신 후보 0. |

---

> **footer (cycle 추적)**: §5.7.5 todo v1.4 작성 완료 (analyst v1 + master fix v1.1/v1.2 + cycle #1 NEEDS_REVISION fix v1.3 + cycle #2 APPROVE + 부가 결정 잠금 + skill 갱신 v1.4, 2026-05-09 session 30). codex Mode D Panel cycle #2 verdict: **APPROVE**. 다음 단계 = phase-5-todo.md §5.7.5 mirror + 단일 commit. Step B 구현 진입은 **다음 세션** (사용자 결정).
