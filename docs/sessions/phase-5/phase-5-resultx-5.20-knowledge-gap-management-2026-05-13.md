---
phase: 5
section: 5.20
title: Knowledge Gap management — query log capture + gap score formula + auto-report (Result v0.6 + Help UI polish)
created: 2026-05-13
updated: 2026-05-13
version: v0.6
---

# Phase 5 §5.20 Knowledge Gap management — Result (2026-05-13 session 41)

> **상위 문서**: [`docs/planning/phase-5/phase-5-todo.md §5.20`](../../planning/phase-5/phase-5-todo.md) · [`docs/planning/phase-5/phase-5-spec-5.20-knowledge-gap-management.md`](../../planning/phase-5/phase-5-spec-5.20-knowledge-gap-management.md) (v0.4) · [`docs/planning/phase-5/phase-5-todox-5.20-knowledge-gap-management.md`](../../planning/phase-5/phase-5-todox-5.20-knowledge-gap-management.md) (v0.3.1) #knowledge-gap #analytics #report #done

## 1. 종결 요약

§5.20 = Phase 5 잔여 5 subject 중 첫 종결 (session 41). **v0.3.1 → v0.4 → v0.5 → v0.6 + Help UI 5 follow-up = 누적 10 commit** 으로 진화. query log capture + gap score formula + auto-report 3 spec + 사용자 raise 4 enhancement (Summary/Statistics/3 entry / per-gap query list / year partition / range filter) + Help panel visual polish 누적. 신규 `wikey-core/src/knowledge-gap.ts` (~470 LOC, pure function) + sidebar-chat hook + `/knowledge-gap [YYYYMM-YYYYMM]` slash + `Wikey: Generate knowledge gap report` command + Help panel "Knowledge gap report" button (status line) + settings toggle (default ON). **36 신규 test** (core 33 knowledge-gap + obsidian 3 sidebar-chat-querylog) ALL GREEN, 회귀 core 939/942 + obsidian 191/191 PASS, build 0 errors, validate-wiki PASS. master CDP smoke 5 entry point ALL PASS + legacy auto-migration 확증.

**Karpathy llm-wiki "Explicit" 원칙 강화** — 위키가 *무엇을 모르는지* 자체가 위키 page (`wiki/analyses/knowledge-gaps-YYYY-MM.md`) 로 가시화.

**SDD+TDD cycle**: Step A (analyst v0.2 LOCK Q1~Q4 + privacy I1~I3 → v0.3 / v0.3.1 sweep) → Step B (tester RED 13+3 FAIL → +AC-S3-3/4 + AC-S2-7/8/9 + AC-S2-10 = 22 total) → Step C (developer GREEN) → Step D (Phase 3a 회귀 core 933/936 + obsidian 191/191 + build 0 + validate-wiki PASS) → Step E (BLUE 6 활동 명시 cross-check) → Step F (codex post-impl review 3 cycle — cycle #1 NEEDS_REVISION 8 finding → master fix → cycle #2 NEEDS_REVISION 3 잔류 → master fix → cycle #3 LOW-2/NEW MEDIUM RESOLVED + HIGH-1 change-log exception → **master verdict APPROVE**) → Step G (master fixture smoke 7/7 + 문서 동기화 + commit).

**codex 3 cycle 결과**:
- cycle #1: 1 HIGH + 5 MEDIUM + 3 LOW = 8 finding → master v0.3 sweep
- cycle #2: 6 RESOLVED + 1 HIGH-1 regression (todox body text 잔류) + 1 LOW-2 (`` ``` json `` 공백 패턴) + 1 NEW MEDIUM (`queryIndices` non-integer)
- cycle #3: 2 RESOLVED (LOW-2 + NEW MEDIUM) + HIGH-1 trace (change-log exception — codex 명시 허용 영역). master verdict APPROVE.

## 2. 산출물

### 2.1 신규 file

- `wikey-core/src/knowledge-gap.ts` (~ 350 LOC, v0.3.1 sweep 포함) — pure function, I/O 만 WikiFS
  - `QUERY_LOG_PATH = '.wikey/query-log.jsonl'` (I3a 단일 진실 소스)
  - `interface QueryLogEntry` (5 키 readonly — I3 schema minimize)
  - `interface KnowledgeGap` (topic / frequency / avg* / gapScore / queryIndices)
  - `interface ClusterResult` + `type TopicClusterer` (I5 primary)
  - `computeGapScore({frequency, avgAnswerLen, avgCitationCount})` (I4 formula)
  - `appendQueryLogEntry(wikiFS, entry)` (JSONL append-only)
  - `loadQueryLogEntries(wikiFS)` (malformed line skip)
  - `rankKnowledgeGaps(entries, clusterer, limit=10)` (I5 fallback + I6 desc sort + slice)
  - internal: `parseEntryLine` / `tokenize` / `clusterTopicsByTokenOverlap` (I5 fallback) / `formatAvg`
  - `renderGapReportMarkdown(gaps, {yearMonth, createdDate?, updatedDate?})` (I9/I10 v0.3 — created 보존 + sources [])
  - **v0.3 신규**: `extractCreatedFromFrontmatter(content)` — pure regex frontmatter parse
  - **v0.3 신규**: `validateClusterResultShape(value)` — LLM shape + Number.isInteger validation
- `wikey-core/src/__tests__/knowledge-gap.test.ts` (19 test 최종 v0.3.1: 13 base + AC-S3-3/4 + AC-S2-7/8/9 + AC-S2-10, MemoryFS in-memory mock)
- `wikey-obsidian/src/sidebar-chat-helpers-querylog.ts` (~22 LOC) — `buildQueryLogEntry(question, result, now?)` pure mapper
- `wikey-obsidian/src/__tests__/sidebar-chat-querylog.test.ts` (3 test)

### 2.2 기존 edit

- `wikey-core/src/index.ts` (+5 export) — `knowledge-gap.ts` re-export
- `wikey-obsidian/src/main.ts` (+8 LOC) — `WikeySettings.knowledgeGapLogEnabled: boolean` field + `DEFAULT_SETTINGS = true` (I2 LOCK default ON)
- `wikey-obsidian/src/settings-tab.ts` (+13 LOC) — toggle "Knowledge gap log" with English description
- `wikey-obsidian/src/sidebar-chat.ts` (+15 LOC, line 718~731) — handleSend 종료 직후 hook: `settings.knowledgeGapLogEnabled !== false` guard → `buildQueryLogEntry` → `appendQueryLogEntry`. try/catch fail-open (`console.warn` only).
- `wikey-obsidian/src/commands.ts` (+75 LOC) — `Wikey: Generate knowledge gap report` command + `runGenerateKnowledgeGapReport` runner (load → cluster LLM (basicModel) → rank → render → write `wiki/analyses/knowledge-gaps-YYYY-MM.md` → appendLog + updateIndex (I8 ingest pipeline 동급))

### 2.3 plan 문서

- `docs/planning/phase-5/phase-5-spec-5.20-knowledge-gap-management.md` v0.1 → v0.2 → **v0.3** (LOCK)
  - Q1 LOCK = `<vault>/.wikey/query-log.jsonl` (JSONL line append, single-process safe)
  - Q2 LOCK = `settings.basicModel` (fallback deterministic token-overlap, hardcoded 0건)
  - Q3 LOCK = manual command 만 (자동 scheduler out of scope)
  - Q4 LOCK = UTF-16 char count
  - Privacy I1~I3 LOCK (local-only / opt-out default ON / 5-key schema minimize)
  - Formula I4 divide-by-zero guards (`max(avgAnswerLen,1)` + `avgCitationCount+0.5`)
  - v0.3 추가: I9 `created` 보존 / I10 `sources: []` / I11 deterministic only (LLM 추천 out-of-scope) / I3a single-process safe wording
- `docs/planning/phase-5/phase-5-todox-5.20-knowledge-gap-management.md` v0.2 → **v0.3.1** (mirror + codex 3 cycle 결과 명시)
- `docs/planning/phase-5/phase-5-todo.md §5.20` (draft → done 갱신)

## 3. SDD invariants → Test → Impl 4중 정합

| Spec | Invariant | Test | Impl | 정합 |
|------|-----------|------|------|------|
| 1 | I1 local-only | grep fetch/XHR new module = 0 | `knowledge-gap.ts` 외부 호출 0 (WikiFS 만) | ✅ |
| 1 | I2 opt-out default ON | (master 1차 verify) | `DEFAULT_SETTINGS.knowledgeGapLogEnabled = true` + sidebar-chat `!== false` guard | ✅ |
| 1 | I3 5-key schema minimize | AC-S1-4 polluted entry → disk 5 키 | `appendQueryLogEntry` 가 `{ts, query, answerLen, citationCount, resolveFailed}` 만 picking | ✅ |
| 1 | I3a vault path | AC-S1-1 `.wikey/query-log.jsonl` exists | `QUERY_LOG_PATH` const single source | ✅ |
| 2 | I4 formula | AC-S2-1 (5/10/0 → 0.523) + AC-S2-2 (guard) + AC-S2-3 (freq=0) | `computeGapScore` 정확 매핑 | ✅ |
| 2 | I5 LLM + fallback | AC-S2-5 (LLM mock) + AC-S2-6 (throwing → fallback) | `rankKnowledgeGaps` try/catch + `clusterTopicsByTokenOverlap` | ✅ |
| 2 | I5 hardcoded 0 | (master 1차 verify) | tokenize 가 단순 길이 ≥ 2 필터, 키워드/stopword list 0 | ✅ |
| 2 | I6 top-N desc sort | AC-S2-5 monotonic desc | `sort((a,b)=>b.gapScore-a.gapScore).slice(0,limit)` | ✅ |
| 3 | I8 index + log | (master 1차 verify command runner) | `runGenerateKnowledgeGapReport` 가 `appendLog` + `updateIndex` 호출 | ✅ |
| 3 | I9 idempotent | (master 1차 verify) | `yearMonth` 기반 파일명 → overwrite | ✅ |
| 3 | I10 frontmatter | AC-S3-1 (title/type/created/updated/tags) | `renderGapReportMarkdown` 정확 매핑 | ✅ |
| 3 | I11 body template | AC-S3-1 (`## Top N gaps` + cluster entry) | render output 정확 | ✅ |

## 4. 검증 증거 (fresh 실행 v0.3.1)

```
cd wikey-core && npm test -- knowledge-gap → 19 passed (19) / 174ms
cd wikey-obsidian && npm test -- sidebar-chat-querylog → 3 passed (3) / 237ms
cd wikey-core && npm test → 933 passed | 3 skipped (936) — 0 fail
cd wikey-obsidian && npm test → 191 passed (191) — 0 fail
cd wikey-core && npm run build → 0 errors
cd wikey-obsidian && npm run build → 0 errors (5 pre-existing kiwi-nlp warnings)
./scripts/validate-wiki.sh → 모든 검증 통과 (0 errors)
node /tmp/wikey-5.20-smoke.mjs → SMOKE OK 7/7 (10 query entries → 5 gap clusters → idempotent render)
```

I1 검증 grep:
```bash
grep -rE "fetch|XMLHttpRequest|requestUrl" wikey-core/src/knowledge-gap.ts wikey-obsidian/src/sidebar-chat-helpers-querylog.ts
# → 0 matches
```

I1 검증 grep:
```bash
grep -rE "fetch|XMLHttpRequest|requestUrl" wikey-core/src/knowledge-gap.ts wikey-obsidian/src/sidebar-chat-helpers-querylog.ts
# → 0 matches
```

## 5. BLUE Phase 3b 6 활동 명시

| # | 활동 | 결과 |
|---|------|------|
| 1 | 함수 분해 | `parseEntryLine`/`tokenize`/`clusterTopicsByTokenOverlap`/`formatAvg` 내부 분리, biggest export ≤ 40 LOC |
| 2 | Naming consistency | `compute*/append*/load*/rank*/render*` 동사 일관 + type 명사 일관 |
| 3 | 중복 제거 | `QUERY_LOG_PATH` 단일 const, `formatAvg` shared between avg fields |
| 4 | 주석 quality | JSDoc 가 spec invariants ID (I1~I12) 직접 참조. TODO/FIXME 0 (grep verified) |
| 5 | 가독성 | magic number 0 (formula 의 0.5/1 은 spec-defined, inline 문서). nested arrow 0 |
| 6 | 회귀 재검증 | GREEN/BLUE 전후 모두 npm test PASS 확증 |

## 6. Karpathy 4 원칙 정합

- **Think Before**: 가정 명시 (Q1~Q4 LOCK), divide-by-zero 가드 명시, fallback path 명시.
- **Simplicity**: 추측 기능 0. 자동 scheduler / multi-user / 외부 fetch out of scope. 약 285 LOC core.
- **Surgical**: 신규 file 4 + 기존 edit 4 (모두 §5.20 직접 영역). 무관 코드 refactor 0.
- **Goal-Driven**: 16 신규 test + invariant 매핑 정량 acceptance.

## 7. wikey schema 4 원칙 정합

- **Explicit**: gap report = wiki page (`analyses/`), Karpathy "무엇을 모르는지" 강화.
- **Yours**: log 100% local (`.wikey/query-log.jsonl`), 외부 송신 0 grep 증명.
- **File over app**: JSONL append-only, vault 내. `jq`/`grep`/`wc -l` 호환.
- **BYOAI**: clustering = `settings.basicModel` resolve (provider 자유 교체) + fallback deterministic.

## 8. v0.4 UX enhancement (사용자 요청 2026-05-13)

v0.3.1 codex verdict APPROVE 직후 사용자 추가 요청 3건:
1. report 본문이 단순 상위 N 리스트가 아닌 **LLM narrative summary + 통계 데이터 상단 block + 전체 listing**.
2. `/knowledge-gap` slash command.
3. Help panel "Wiki Maintenance" section 에 4번째 버튼 "Knowledge gap report".

**구현**:
- `renderGapReportMarkdown` 시그니처 확장: `{ yearMonth, createdDate?, updatedDate?, summary?, statistics? }`. 3 section render — `## Summary` / `## Statistics` / `## All gaps`. summary 미지정 시 graceful fallback message.
- `computeGapStatistics(entries, topicCount)` 신규 helper — total queries / distinct topics / zero-citation % / avg answer length / reporting period.
- `rankKnowledgeGaps` `limit` 옵셔널 변경 (default 전체 listing, 사용자 명시 시 제한).
- commands runner — LLM summary call 추가 (graceful fail), statistics 계산, return path. **export** 해서 sidebar-chat / Help panel button 공유.
- sidebar-chat `/knowledge-gap` slash command (handleSend 분기) + input placeholder 갱신.
- Help panel 4번째 버튼 "Knowledge gap report" — modal 없이 직접 runner 호출 + status line ("Report generating…" → "Report generated. → path").

**신규 test 5**:
- AC-S2-11: rankKnowledgeGaps full listing default (15 cluster → 15 반환).
- AC-S3-5: summary 주입 시 본문 포함.
- AC-S3-6: statistics 주입 시 Statistics block 출력.
- AC-S3-7: computeGapStatistics aggregation.
- AC-S3-8: computeGapStatistics empty entries.

**기존 test 갱신 2**:
- AC-S3-1: `## Top N gaps` → `## Summary` + `## All gaps` (v0.4 새 본문 구조).
- AC-UI-1 (maintenance-modal.test.ts): 3 버튼 → 4 버튼 (Knowledge gap report 추가).

**실 보고서 생성**: `wiki/analyses/knowledge-gaps-2026-05.md` — 12 sample query → 7 cluster (transformer 0.15 top gap, bm25 / embedding / bucket / search / ingest / kiwi 순). validate-wiki PASS.

**부산물 commit**: `.github/workflows/benchmark.yml` 삭제 — 계속 실패하던 GH Action (cache-dependency-path 해소 안 됨), 사용자 결정.

## 9. v0.5 — gap section 별 actual query list (사용자 raise CDP smoke 도중)

CDP smoke 결과 페이지 확인 중 사용자 raise — "어떤 부분에 gap 있는지 확인 불가, 실질적 질문 목록이 gap 섹션별로 나와야".

**구현**: `renderGapReportMarkdown(opts)` 에 `entries?: QueryLogEntry[]` 옵셔널 추가. 주입 시 each gap section 하단에 "Queries in this cluster:" + actual query text + 날짜 + answer length + citation 개수 출력. backward-compat: entries 미주입 시 query list 생략 (v0.4 동작 보존).

**Test 2 신규**: AC-S3-9 (query list inclusion) / AC-S3-10 (backward compat).

commit `8778e60`.

## 10. v0.6 — year-partitioned query log + range filter

사용자 요청 4 항목:
1. `/knowledge-gap` (no option) → 전체 누적 분석
2. `/knowledge-gap 202605-202606` → 시작월-종료월 범위
3. `query-log.jsonl` 년단위 분할 (`.wikey/query-log-YYYY.jsonl`)
4. 다년도 range (예 `202612-202701`) → 두 year file merge

**Data layer 신규**:
- `LEGACY_QUERY_LOG_PATH` 보존 (migration 전용).
- `queryLogPathForYear(year)`: vault-relative 경로.
- `parseQueryLogRange(arg)`: `'YYYYMM-YYYYMM'` → `QueryLogRange | null` (공백 tolerant, month 범위 + start<=end 검증).
- `appendQueryLogEntry`: entry.ts year 추출 → 해당 year file append.
- `loadQueryLogEntries(wikiFS, range?)`: range 미지정 → 모든 year file walk + merge + ts asc / range 지정 → 해당 year file 만 load + yearMonth filter.
- `migrateLegacyQueryLog` (idempotent): legacy file 존재 시 1회 분할 + 빈 string marker.
- `discoverYearFiles`: `WikiFS.list('.wikey')` 로 pattern enumerate.

**Report layer**:
- `renderGapReportMarkdown` opts.titleLabel 추가 — range 시 "2026-05 ~ 2026-06" override.
- commands.ts runner: range → filename `knowledge-gaps-{compactStart}-{compactEnd}.md` + title + appendLog/updateIndex label 반영.

**UI**:
- sidebar-chat `/knowledge-gap` parser: argPart 비면 range=undefined, 있으면 parseQueryLogRange + invalid Notice.
- Help panel: maintenance section 위 "Knowledge Gap Report" section 추가 (4 entry point 사용법 + multi-year merge note).
- input placeholder: `/clear, /knowledge-gap [YYYYMM-YYYYMM]`.

**Test 7 신규**: AC-S1-6 (year split) + AC-V6-1~6 (parse / merge / filter / multi-year / migration).

**CDP smoke 검증**:
- legacy `.wikey/query-log.jsonl` (1606 bytes) → `.wikey/query-log-2026.jsonl` 자동 migration + 0 bytes marker.
- `/knowledge-gap 202605-202605` → `wiki/analyses/knowledge-gaps-202605-202605.md` 생성 + title "Knowledge Gaps — 2026-05 ~ 2026-05" + 5 cluster + query list.
- `/knowledge-gap bad-input` → "invalid range" Notice 정확.

commit `966ebb8`.

## 11. Help UI follow-up (5 commit)

사용자 4 raise (visual polish):

| commit | 변경 |
|--------|------|
| `e68701d` | Help section h3 (Knowledge Gap Report + Wiki Maintenance) 밸런싱 — 0.95em / weight 300 / accent |
| `3c4122f` | Help body heading 5개 (`<p><strong>`) 동일 적용 — Ask Questions / Ingest / Wikilinks / Maintenance Modes / Settings |
| `7250b02` | Ingest heading `(Source → Wiki)` 도 strong 포함 |
| `820e398` | Help body 폰트 통일 (paragraph + li 0.9em / 11.88px / muted grey) + code bold + white |
| `1fc8be3` | Help list item title (Status / Check / Refactoring) → white |

**CDP 실측 최종**:
- heading strong (7개): 12.59px / 300 / accent purple
- paragraph + listItem: 11.88px / 400 / muted grey
- code (command): 11.88px / **700 bold** / white
- li strong (item title): 11.88px / 600 / white

## 12. 다음

- **Phase 5 잔여 4** = §5.5 / §5.6 / §5.8 / §5.9 (4 subject — §5.20 v0.6 종결로 -1).
- **§5.20 v0.7+ candidate** (사용자 결정 영역): 자동 scheduler / multi-process write / 다국어 query clustering / LLM query 본문 PII redaction.
