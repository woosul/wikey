---
phase: 5
section: 5.20
title: Knowledge Gap management — query log analysis + auto-report (Spec)
status: lock
created: 2026-05-11
updated: 2026-05-13
version: v0.4
---

# Phase 5 §5.20 Knowledge Gap management (Spec, WHAT)

> **상위 문서**: [`docs/planning/phase-5/phase-5-todo.md §5.20`](./phase-5-todo.md) · [`docs/planning/phase-5/phase-5-todox-5.20-knowledge-gap-management.md`](./phase-5-todox-5.20-knowledge-gap-management.md)
>
> **이력**: 본 §5.20 = 사용자 테스트 2-2 (2026-05-11). Phase 6 (웹 환경) 후보였으나 사용자 결정으로 Phase 5 잔여로 편입. v0.2 (2026-05-13) — Q1~Q4 + privacy I1~I3 LOCK, SDD+TDD 진입 가능 상태.

## 0. Context

**도출 source**: 사용자 본체 완성 시점 테스트 (2026-05-11) 2-2 보고.

- 요청: 자주 질의되지만 wiki 정보가 부족한 주제를 분석 → 자동 리포트 생성 (knowledge gap detect).
- schema §"검색/인덱스 확장 전략" + Karpathy llm-wiki "AI 의 지식이 위키로 가시화됨 (Explicit)" 원칙 강화.

**이득**:
- 정성 — 사용자가 "다음에 어떤 source 를 추가해야 하는가" 결정에 데이터 기반 도움.
- 정성 — wiki 의 *gap 인식* 자체가 wiki 의 일부가 됨 (`analyses/knowledge-gaps-YYYY-MM.md`).
- 정량 — 월 1회 수동 리포트 시 사용자 ingest 우선순위 결정 시간 단축.

**Trade-off**:
- query log 저장 = 사용자 query history privacy 영향. local-only 저장 보장 + 사용자 opt-out toggle + 본문 / wiki page path 미저장 (I3).
- score formula heuristic — v0.2 에서 분모 가드 (divide-by-zero) 보정 LOCK. Step B 실 sample 으로 calibration 가능.

**Karpathy 4 원칙 정합**:
- Explicit — gap 자체가 wiki page (`analyses/`) 로 가시화. "무엇을 모르는지" 명시.
- Yours — log 100% local (vault `.wikey/query-log.jsonl`), 외부 전송 0.
- File over app — JSONL append-only, vault 안. Unix 도구 (`grep`, `wc -l`, `jq`) 호환.
- BYOAI — clustering LLM = `settings.basicModel` resolve (provider 자유 교체).

## 1. Specs

### Spec 1: query log capture + privacy

- **Goal**: sidebar-chat 의 query 결과를 local log (`<vault>/.wikey/query-log.jsonl`, append-only JSONL) 에 저장.
- **Invariants**:
  - **I1 (Privacy local-only, LOCK)**: log 저장 = local only. `fetch` / `xhr` / 외부 endpoint 호출 0건 (grep `knowledge-gap.ts` + `sidebar-chat.ts` 신규 hook 영역). credentials.json 같은 sensitive 영역 grep 0.
  - **I2 (Opt-out toggle, LOCK)**: settings 항목 `knowledgeGapLogEnabled: boolean` — **default `true`** (ON). settings UI toggle 으로 OFF 가능. OFF 시 log 추가 중지 (기존 entry 보존 — 삭제는 별 command).
  - **I3 (Schema minimize, LOCK)**: log entry shape = `{ ts: string /* ISO-8601 */, query: string, answerLen: number /* UTF-16 char count */, citationCount: number, resolveFailed: boolean }`. **answer body 미저장 / wiki page path 미저장 / sources 배열 미저장**. PII 회피.
  - **I3a (저장 위치, LOCK v0.3)**: `<vault>/.wikey/query-log.jsonl` — vault-relative, append-only JSONL (line-based). data.json 안 array 미사용 (plugin reload 시 reformat 비용 회피). 구현 단순화 (v0.3): single-process safe append (Obsidian plugin = renderer 단일 thread 가정). 다중 process 동시 write 는 personal vault 사용 패턴 밖 — Out of Scope.
- **Acceptance**:
  - 사용자 query 1회 (`handleSend` 종료 후 hook) → log entry 1줄 추가 (JSONL).
  - settings opt-out → 다음 query 부터 추가 중지.
  - log 파일 disk 위치 = vault 안 `.wikey/query-log.jsonl` (vault-relative).
  - grep `fetch\|XMLHttpRequest` 신규 모듈 = 0건 (외부 송신 없음 증명).
  - log entry JSON.parse 후 키 집합 정확히 `{ts, query, answerLen, citationCount, resolveFailed}` (extra 키 0).

### Spec 2: gap score formula

- **Goal**: query log 분석으로 gap score 계산.
- **Inputs**: query log entries (`Array<LogEntry>`).
- **Outputs**: `KnowledgeGap[]` — `{ topic: string, frequency: number, avgAnswerLen: number, avgCitationCount: number, gapScore: number, queryIndices: number[] }`.
- **Invariants**:
  - **I4 (Gap score formula, LOCK)**:
    ```
    gapScore = frequency
             * Math.log(1 + 1 / Math.max(avgAnswerLen, 1))
             * Math.log(1 + 1 / (avgCitationCount + 0.5))
    ```
    - `avgAnswerLen` 단위 = **UTF-16 char count** (`string.length`, tokenization dependency 0).
    - 분모 가드: `Math.max(avgAnswerLen, 1)` (avgAnswerLen=0 → factor = `log(2) ≈ 0.693`).
    - 분모 가드: `avgCitationCount + 0.5` (avgCitationCount=0 → factor = `log(1 + 2) ≈ 1.099`). 무한대 회피.
    - frequency 0 → gapScore 0 (자명).
  - **I5 (Topic clustering LLM-only, LOCK)**: topic 추출 = LLM clustering. **hardcoded keyword 0건** (§5.10.4 D-wide 정합). 사용 LLM = `settings.basicModel` resolve (Q2 LOCK).
    - Output schema (LLM 응답): `{ topics: [{ name: string, queryIndices: number[] }] }`. 단일 LLM call (batch). 일괄 분류.
    - Fallback (LLM 실패 시): deterministic token-overlap clustering — Kiwi 형태소 noun 교집합 (`@orama/orama` Kiwi tokenizer 재사용). hardcoded stopword / category 0건.
  - **I6 (출력 전체 listing, LOCK v0.4)**: gapScore desc 정렬. **default = 전체** (limit 없음). `limit` 파라미터로 제한 가능 (옵셔널, 사용자 명시 시만).
- **Acceptance**:
  - 10 query log entry → LLM clustering 1회 호출 → topic cluster 3~5개 → gap score desc 정렬.
  - LLM 강제 fail (mock throw) → fallback deterministic clustering 동작, 결과 ≥ 1 topic.
  - 동일 input → 동일 output (LLM mock 고정 시) — 결정성.
  - frequency=5, avgAnswerLen=10, avgCitationCount=0 → gapScore = `5 * log(1 + 0.1) * log(1 + 2)` ≈ `5 * 0.0953 * 1.0986` ≈ `0.523`. (수치 fixture test).

### Spec 3: 자동 리포트 생성

- **Goal**: gap analysis 결과를 `wiki/analyses/knowledge-gaps-YYYY-MM.md` 로 생성 (사용자 명시 command 만 — Q3 LOCK).
- **Invariants**:
  - **I7 (analyses 카테고리)**: 리포트 페이지 = `wiki/analyses/` (schema §"4 카테고리" 정합). frontmatter `type: analysis`.
  - **I8 (index + log 갱신)**: 페이지 생성 후 `appendLog` (workflow = `ingest` 타입과 동일 형식) + `updateIndex` 재사용 (ingest pipeline 동급 처리).
  - **I9 (페이지명 idempotent, LOCK v0.3)**: 파일명 = `knowledge-gaps-YYYY-MM.md` (월 단위). 동일 월 재실행 시 **overwrite** (idempotent). `created` 는 **첫 생성 유지** (기존 frontmatter parse → 보존), `updated` 만 실제 run 날짜 (ISO `YYYY-MM-DD`) 로 갱신.
  - **I10 (Frontmatter shape, LOCK v0.3)**:
    ```yaml
    ---
    title: Knowledge Gaps — YYYY-MM
    type: analysis
    created: YYYY-MM-DD  # 첫 생성 시 (이후 재실행 보존)
    updated: YYYY-MM-DD  # 실제 run 날짜
    tags: [knowledge-gap, auto-report]
    sources: []  # schema §"페이지 컨벤션" 필수 필드 (auto-report 는 raw source 인용 없음)
    ---
    ```
  - **I11 (본문 구조, LOCK v0.4)**: 3 section — (a) LLM narrative summary (b) deterministic statistics (c) 전체 gap listing.
    ```
    ## Summary

    <LLM-generated narrative (3~6 줄): 어떤 주제 지식 부족 + 어떤 raw source
     추가 권고. basicModel 1회 호출. 사용자 ingest 우선순위 결정 데이터.>

    ## Statistics

    - Total queries logged: N
    - Distinct topic clusters: M
    - Queries with zero citations: K (P%)
    - Average answer length: X chars
    - Reporting period: YYYY-MM-DD ~ YYYY-MM-DD

    ## All gaps

    ### {topic.name} (gapScore: X.XX, frequency: N)
    - average answer length: M chars
    - average citation count: K
    ...
    ```
    Summary LLM 호출 실패 시 graceful fallback: `## Summary` 본문 = `(LLM summary unavailable — see Statistics + listing below.)` — page 자체는 항상 생성.
  - **I12 (Schema 정합)**: 생성 후 `validate-wiki.sh` PASS (frontmatter / wikilink / 카테고리).
  - **I13 (Slash command, LOCK v0.4)**: 사이드바 chat 에서 `/knowledge-gap` 입력 → command 와 동일 동작 trigger. handleSend 진입부에서 `/clear` 다음 분기로 처리.
  - **I14 (Maintenance button, LOCK v0.4)**: Help panel 의 `Wiki Maintenance` section 에 4번째 버튼 "Knowledge gap report". 클릭 시 modal 없이 직접 runner 호출 (status/check/refactoring 와 다름 — findings/recovery 흐름 없음). 결과 = Notice + 생성된 page 경로. command palette / slash / button 3 entry 모두 동일 runner 공유 (single source of truth).
- **Acceptance**:
  - command `Wikey: Generate knowledge gap report` 실행 → `wiki/analyses/knowledge-gaps-2026-05.md` 생성.
  - 결과 페이지 = wikilink 정합, `validate-wiki.sh` PASS (0 errors).
  - 동일 월 재실행 → 파일 1개 (덮어쓰기, 새 file 미생성).
  - index.md 갱신 (`## 분석` section 에 entry 추가 또는 `updated` 갱신).
  - log.md 1줄 추가 (`## [YYYY-MM-DD] ingest | Knowledge Gaps YYYY-MM`).

## 2. Out of Scope (v0.4 LOCK)

- **자동 cron / scheduler** (Q3 LOCK) — manual trigger 만 (command palette / chat slash / maintenance modal 3 entry point 모두 사용자 명시 호출). §5.19 maintenance suite 의 cron 통합은 별 cycle.
- **(v0.3 의 LLM source-suggestion Out-of-Scope 항목은 v0.4 에서 in-scope 로 승격됨 — Spec 3 I11 §"## Summary" 영역. 사용자 요청 2026-05-13)**
- **다중 process 동시 write** (I3a v0.3) — Obsidian plugin = renderer 단일 thread. 다중 Obsidian instance 동시 write 는 personal vault 사용 패턴 밖.
- 외부 source 자동 fetch (사용자 결정 영역).
- 다국어 query clustering (한국어 / 영문 mix 만, §5.7.9 candidate #3 별 cycle).
- log entry 의 answer body / wiki page path 저장 (I3 privacy minimize).
- 사용자별 log 분리 (single-user 가정, multi-user 는 Phase 6 웹 환경 별 cycle).
- query 본문 PII 자동 redaction (LOW finding v0.3 — 사용자가 PII query 식별 책임. 향후 piiGuardEnabled 통합 candidate).

## 3. Dependencies

- **신규** `wikey-core/src/knowledge-gap.ts` (≤ 180 LOC)
  - `appendQueryLog(vaultBase, entry)` — JSONL append.
  - `loadQueryLog(vaultBase)` — JSONL parse.
  - `computeGapScores(entries, clusterer)` — Spec 2 formula.
  - `clusterTopicsLLM(entries, llm, basicModel)` + `clusterTopicsFallback(entries, tokenizer)` — Spec 2 I5.
  - `generateGapReport(gaps, llm)` — Spec 3 본문 LLM 생성.
- **수정** `wikey-obsidian/src/sidebar-chat.ts` (≤ 30 LOC, line 663~)
  - `handleSend` 의 query 결과 직후 `appendQueryLog` hook (settings.knowledgeGapLogEnabled true 시).
  - 입력 = `{ ts: new Date().toISOString(), query: question, answerLen: result.answer.length, citationCount: result.citations?.length ?? 0, resolveFailed: !result.sources?.length }`.
- **수정** `wikey-obsidian/src/commands.ts` (≤ 60 LOC)
  - command `wikey-generate-knowledge-gap-report`: load log → cluster → score → LLM render → write `wiki/analyses/knowledge-gaps-YYYY-MM.md` → appendLog + updateIndex → Notice.
- **수정** `wikey-obsidian/src/settings-tab.ts` (≤ 20 LOC)
  - toggle "Knowledge gap log enabled" (default ON, default ON 명시 영문 description).
- **수정** `wikey-core/src/types.ts` (≤ 10 LOC) — `WikeyConfig` 에 `knowledgeGapLogEnabled?: boolean` 추가 (or `WikeySettings`).
- **재사용**:
  - `appendLog`, `updateIndex` (`wikey-core/src/wiki-ops.ts`) — ingest pipeline 동급.
  - Kiwi tokenizer (`wikey-core/src/search/orama-korean-tokenizer.ts`) — fallback clustering noun 추출.
  - `LLMClient.call` (`wikey-core/src/llm-client.ts`) — basicModel resolve.

## 4. 진행 순서 (SDD+TDD)

| Step | 책임 | 산출 | Acceptance (정량) |
|------|------|------|-------------------|
| **A** | analyst v0.2 | spec/todox LOCK | Q1~Q4 + privacy I1~I3 명시. SDD+TDD 진입 가능. (본 cycle 종결) |
| **B** | tester RED | `knowledge-gap.test.ts` (≥ 10 test) + `sidebar-chat-log-capture.test.ts` (≥ 3 test) | 모든 신규 test RED (구현 전). build 0 errors. |
| **C** | developer GREEN | `knowledge-gap.ts` 신규 + sidebar-chat hook + commands + settings + types | 신규 test 13+ ALL GREEN. 회귀 0 fail. |
| **D** | Phase 3a 회귀 | `npm test` + `npm run build` + `./scripts/validate-wiki.sh` | 회귀 0 fail / build 0 errors / validate-wiki 0 errors. |
| **E** | Phase 3b BLUE refactor | 함수 분해 (50+ LOC) / naming / 중복 제거 / 주석 quality | refactor 후 회귀 재실행 PASS. TODO/FIXME 0. |
| **F** | codex post-impl review | Mode D Panel review prompt | codex `VERDICT: APPROVE` (NEEDS_REVISION 시 fix 후 재 cycle). |
| **G** | master 라이브 smoke | 실 vault 에서 10 query 실행 → command → 결과 페이지 검증 (obsidian-cdp) | `wiki/analyses/knowledge-gaps-2026-05.md` 생성 / validate-wiki PASS / Notice 표시. |

## 5. 변경 이력

- **v0.4 (2026-05-13, LOCK)** — 사용자 요청 3 enhancement (2026-05-13).
  - I6 (Top-N 출력) → 전체 listing default (limit 옵셔널).
  - I11 (본문 구조) → 3 section: LLM narrative summary + deterministic statistics + 전체 listing. v0.3 의 "추천 source 후보" Out-of-Scope 항목 in-scope 승격.
  - I13 (NEW): `/knowledge-gap` slash command — chat 에서 직접 trigger.
  - I14 (NEW): MaintenanceMode `'knowledge-gap'` + Help panel 4번째 버튼.
- **v0.3 (2026-05-13, LOCK)** — codex post-impl review cycle #1 NEEDS_REVISION 8 finding master 결정 sweep.
  - HIGH-1 (I11 recommendation) → Out of Scope (v0.4 candidate). deterministic 통계 surface 만 본 cycle. Karpathy Simplicity.
  - MEDIUM-1 (I9 created preservation) → I9 + I10 명시: `created` 첫 생성 보존, `updated` 만 실제 run 날짜. render `{createdDate?, updatedDate?}` 옵션 + command 가 기존 frontmatter parse.
  - MEDIUM-2 (I3a O(1) append) → single-process safe append 으로 wording 완화. 다중 process Out of Scope. WikiFS interface 신규 method 미추가 (11 impls 영향 회피, Karpathy Surgical).
  - MEDIUM-3 (LLM cluster shape validation) → command runner 가 `{topics: [{name, queryIndices}]}` validate + throw → fallback path 활성화.
  - LOW-1 (I1 grep comment 'fetch' 매치) → knowledge-gap.ts 주석 wording.
  - LOW-2 (fence case-insensitive) → `replace(/```(?:json)?/gi, '')`.
  - LOW-3 (sources frontmatter) → I10 에 `sources: []` 추가 (schema 페이지 컨벤션 정합).
  - LOW-4 (PII residual) → §2 Out of Scope 명시 + settings description warning.
  - Step B 추가 test: AC-S3-3 (created/updated 분리 보존) + AC-S2-7 (LLM invalid shape → fallback).
- **v0.2 (2026-05-13, LOCK)** — Q1~Q4 + privacy I1~I3 LOCK + Karpathy 4 원칙 정합 명시 + Step A~G acceptance 정량화. SDD+TDD 진입 가능.
  - Q1 LOCK: `<vault>/.wikey/query-log.jsonl` (append-only JSONL, data.json array 폐기).
  - Q2 LOCK: `settings.basicModel` resolve + fallback deterministic Kiwi noun overlap.
  - Q3 LOCK: 자동 scheduler out of scope. manual command 만.
  - Q4 LOCK: `avgAnswerLen` 단위 = UTF-16 char count. formula divide-by-zero 가드 (`max(avgAnswerLen, 1)` + `avgCitationCount + 0.5`).
  - Privacy LOCK: I1 (local-only, fetch 0건) + I2 (default ON, opt-out toggle) + I3 (entry shape 5 키 fixed, answer/path 미저장).
  - Spec 3 신규 invariant: I9 idempotent (overwrite same-month) / I10 frontmatter / I11 본문 template / I12 validate-wiki PASS.
- v0.1 (2026-05-11): draft 신규. Phase 6 candidate → Phase 5 편입 (사용자 결정).
