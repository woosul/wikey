# Phase 5 §5.20 Knowledge Gap management — Todo (HOW)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.20`](./phase-5-todo.md) · [`plan/phase-5/phase-5-spec-5.20-knowledge-gap-management.md`](./phase-5-spec-5.20-knowledge-gap-management.md)

## 진행 매트릭스 (Step A~G)

- [x] **Step A — analyst v0.2 LOCK → v0.3 / v0.4 / v0.5 / v0.6 sweep** (Q1~Q4 + privacy I1~I3 + codex cycle #1 8 finding LOCK + v0.4 UX 3 enhancement + v0.5 query list + v0.6 year-partition / range)
- [x] **Step B — tester RED → +12 test sweep** (knowledge-gap.test.ts 33 + sidebar-chat-querylog.test.ts 3 = 36 acceptance)
- [x] **Step C — developer GREEN → v0.6 sweep** (`wikey-core/src/knowledge-gap.ts` ~470 LOC + sidebar-chat hook + slash `/knowledge-gap [YYYYMM-YYYYMM]` + commands runner + settings toggle + Help section + 4 helper `extractCreatedFromFrontmatter` / `validateClusterResultShape` / `computeGapStatistics` / `parseQueryLogRange`)
- [x] **Step D — Phase 3a 회귀** (core 939/942 + obsidian 191/191 + build 0 errors + validate-wiki PASS)
- [x] **Step E — Phase 3b BLUE refactor** (함수 분해 / naming / 중복 제거 / 주석 quality 6 활동 명시 + Help UI 5 follow-up)
- [x] **Step F — codex post-impl review** (cycle #1 8 finding → cycle #2 3 잔류 → cycle #3 master verdict APPROVE)
- [x] **Step G — master CDP smoke 5 entry point** (command palette / slash no-arg / slash range 202605-202605 / slash invalid Notice / Help panel button + legacy migration 확증 + master fixture smoke 7/7)

## Step A LOCK 결정 사항 (의문점 해소, 2026-05-13)

### Q1: query log 저장 위치 → **LOCK = `<vault>/.wikey/query-log.jsonl`**

근거:
- `data.json` 안 array 는 plugin reload 시 매번 full rewrite — O(n) 비용.
- JSONL append = `fs.appendFile` 1 syscall, O(1).
- vault 안 `.wikey/` 폴더 = 사용자에게 보이지 않는 internal config 영역 (PII 보호 + Obsidian dot-folder 캐시 바이패스 정합).
- Unix 도구 (`grep`, `wc -l`, `jq`) 직접 호환 (Karpathy "File over app" 원칙 정합).

### Q2: topic clustering LLM → **LOCK = `settings.basicModel` resolve**

근거:
- 답변 LLM (default model) 보다 latency / cost 낮음.
- clustering 은 의미적 분류 단순 task — basic 충분.
- Fallback: LLM 호출 실패 시 deterministic token-overlap clustering (Kiwi 형태소 noun 교집합). hardcoded keyword / stopword 0건 (§5.10.4 D-wide 정합).

### Q3: 자동 schedule → **LOCK = out of scope (v0.2)**

근거:
- manual command `Wikey: Generate knowledge gap report` 만 v0.2 범위.
- §5.19 maintenance suite 통합은 별 cycle (v0.3 후보).
- 자동화 도입 시 사용자 알림 / opt-in / 빈도 결정 등 추가 spec 면 → scope 분리.

### Q4: gap score formula 단위 → **LOCK = UTF-16 char count (`string.length`)**

근거:
- tokenization dependency 0 (Kiwi WASM 부재 환경에서도 동작).
- 정수 ≥ 0 보장, 결정성.
- formula 보정 (divide-by-zero 가드):
  ```javascript
  gapScore = frequency
           * Math.log(1 + 1 / Math.max(avgAnswerLen, 1))
           * Math.log(1 + 1 / (avgCitationCount + 0.5))
  ```
- avgAnswerLen=0 → `max(0, 1)=1` → factor = `log(2) ≈ 0.693`.
- avgCitationCount=0 → `0 + 0.5 = 0.5` → factor = `log(1 + 2) = log(3) ≈ 1.099`. 무한대 회피.
- 수치 fixture (frequency=5, avgAnswerLen=10, avgCitationCount=0) → gapScore ≈ `0.523`.

### Privacy 정책 LOCK (I1/I2/I3)

- **I1 (local-only, LOCK)**: log 저장 100% local. `fetch` / `XMLHttpRequest` / 외부 endpoint 호출 0건. grep `knowledge-gap.ts` + `sidebar-chat.ts` 신규 hook 영역 검증.
- **I2 (opt-out toggle, LOCK)**: settings `knowledgeGapLogEnabled: boolean` (default **`true`** ON). settings UI toggle 으로 OFF 가능. OFF 시 신규 append 중지 (기존 entry 보존).
- **I3 (schema minimize, LOCK)**: log entry 키 집합 정확히 5개 — `{ ts: string /* ISO-8601 */, query: string, answerLen: number /* UTF-16 char */, citationCount: number, resolveFailed: boolean }`. answer body / wiki page path / sources 배열 미저장.

### 추가 LOCK (구현 단순화, v0.3 sweep)

- **Clustering 출력 schema (LOCK v0.3)**: LLM 응답 = `{ topics: [{ name: string, queryIndices: integer[] }] }` (정수 only — `validateClusterResultShape` 가 non-integer reject). 단일 batch call (per-month report 생성 시 1회).
- **report 파일명 규칙 (LOCK)**: `wiki/analyses/knowledge-gaps-YYYY-MM.md` (월 단위). 동일 월 재실행 = overwrite (idempotent). `created` 보존 (기존 frontmatter parse), `updated` = run 실제 ISO 날짜.
- **report frontmatter (LOCK v0.3)**: `type: analysis` + `created` + `updated` + `tags: [knowledge-gap, auto-report]` + `sources: []` (schema 페이지 컨벤션 정합).
- **report 본문 template (LOCK v0.3)**: deterministic only — `## Top N gaps\n\n### {topic.name} (gapScore: X.XX, frequency: N)\n- average answer length: M chars\n- average citation count: K`. **No LLM-generated suggestion line** (deferred to v0.4, see spec §2 Out of Scope).
- **index.md + log.md 갱신 (LOCK)**: `appendLog` + `updateIndex` (`wiki-ops.ts`) 재사용. ingest pipeline 동급.

## 변경 면 추정

| 파일 | 변경 종류 | LOC 추정 |
|------|-----------|----------|
| `wikey-core/src/knowledge-gap.ts` | 신규 | ≤ 180 |
| `wikey-obsidian/src/sidebar-chat.ts` (line 663~ handleSend 후 hook) | 수정 | ≤ 30 |
| `wikey-obsidian/src/commands.ts` (신규 command) | 수정 | ≤ 60 |
| `wikey-obsidian/src/settings-tab.ts` (toggle) | 수정 | ≤ 20 |
| `wikey-core/src/types.ts` 또는 `wikey-obsidian/src/settings.ts` (`knowledgeGapLogEnabled`) | 수정 | ≤ 10 |
| `wikey-core/tests/knowledge-gap.test.ts` | 신규 | ≤ 250 (≥ 10 test) |
| `wikey-obsidian/src/__tests__/sidebar-chat-log-capture.test.ts` | 신규 | ≤ 120 (≥ 3 test) |
| **합계** | — | **≤ 670 LOC** |

## 변경 이력

- **v0.3.1 (2026-05-13)** — codex review cycle #2 NEEDS_REVISION 3 잔류 finding master sweep.
  - HIGH-1 regression (todox §"추가 LOCK" body template 잔류) → 본 section 의 본문 template 도 v0.3 deterministic 으로 갱신 (`추천 raw source 후보` line 삭제, `## Top N gaps` 영문 정합).
  - LOW-2 잔류 (` ```json` 공백 패턴) → `/```\s*(?:json\s*)?/gi` 으로 강화.
  - NEW MEDIUM (`queryIndices` non-integer) → `validateClusterResultShape` 가 `Number.isInteger` 추가 reject. AC-S2-10 신규 test.
- **v0.3 (2026-05-13)** — codex review cycle #1 NEEDS_REVISION 8 finding master sweep.
  - I11 recommendation → Out of Scope (v0.4 candidate), deterministic 통계 surface only.
  - I9 created preservation → render `{createdDate?, updatedDate?}` + command 가 `extractCreatedFromFrontmatter` 로 기존 보존.
  - I3a wording → single-process safe append (WikiFS interface 신규 method 미추가).
  - LLM shape validation → `validateClusterResultShape` 신규 + command runner 적용.
  - LLM fence case-insensitive (`/```(?:json)?\s*/gi`).
  - sources frontmatter (`sources: []`) — 페이지 컨벤션 정합.
  - 주석 wording (LOW-1 grep 매치 회피).
  - PII residual 경고 settings description + Out of Scope 명시.
  - Test +5: AC-S3-3 createdDate/updatedDate 분리, AC-S3-4 extractCreatedFromFrontmatter, AC-S2-7/8 validateClusterResultShape OK/throw, AC-S2-9 validation throw → fallback path.
- **v0.2 (2026-05-13, LOCK)** — Q1~Q4 + privacy I1~I3 + clustering schema + report 규칙 LOCK. SDD+TDD 진입 가능. 변경 면 정량화 (≤ 670 LOC 총).
- v0.1 (2026-05-11): draft 신규.
