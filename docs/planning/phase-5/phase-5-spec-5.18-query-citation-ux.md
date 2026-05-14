---
phase: 5
section: 5.18
title: Query citation UX — 원본 1개당 1줄 + 전체 원본 링크 + wiki backlink + registry mismatch logging (Spec)
status: draft
created: 2026-05-11
updated: 2026-05-12
version: v0.6
---

# Phase 5 §5.18 Query citation UX (Spec, WHAT)

> **상위 문서**: [`docs/planning/phase-5/phase-5-todo.md §5.18`](./phase-5-todo.md) · [`docs/planning/phase-5/phase-5-todox-5.18-query-citation-ux.md`](./phase-5-todox-5.18-query-citation-ux.md)

## 0. Context

**도출 source**: 사용자 본체 완성 시점 테스트 (2026-05-11) 1-3 보고.

- 거의 모든 query 결과에서 `원본: (해석 실패 — registry 점검 필요)` 출력 — `query-pipeline.ts:319` fallback.
- 원본이 단 하나만 링크됨 (현재 `, ` join inline → 시각적으로 "하나" 처럼 보임).
- 관련된 원본 전체 링크 + 1개 원본 / 1줄 요청.
- 추가: 답변 wiki 페이지의 **backlink** (Obsidian backlink panel 등가) 표시 요청.
- 원본 확장자 일치 (md → md, pdf → pdf) — 이미 §5.15.D + §5.12 v3 에서 `## 출처` wikilink + sidecar 분기 구현되어 있으나 footer "원본:" 줄과의 정합 재검증.

### Step "1" 실측 결과 (v0.2 보강 — 2026-05-12 analyst 측정)

**registry 상태** (`.wikey/source-registry.json`):
- 총 14 records, tombstone = 0, active = 14
- extension 분포: md=12, pdf=1, hwp=1 (전부)

**wiki 페이지 provenance 분포** (217 총 wiki page 중 201 페이지가 provenance ref 보유):
- 1 unique sourceId / page (refs-per-page avg=1.00, max=1, min=1) — 현 corpus 에서 다 소스 citation 페이지는 0
- 전체 provenance ref 201 건, unique sourceId 14 개

**registry mismatch 실측**:
- unique sourceId 14 개 중 **1 개 (`sha256:679cf2dd6db75e3a`) 가 registry 누락** → mismatch 비율 = **7.1%** (1/14)
- 그러나 그 1 개의 sourceId 가 **38 페이지** (concept 2 + entity 36 — `claude-code` / `anthropic` / `openai-codex` / `gemma3` / `markitdown` / `marker` / `large-language-model` / `retrieval-augmented-generation` 등 hot 검색 page) 를 점유
- 38 / 201 = **18.9% fallback trigger rate** (페이지 단위)
- 가장 자주 surface 되는 entity 다수 포함 → 사용자 체감 "거의 모든 query" 와 정합 (실 평균 비율 19% 라도, hot page 다수 점유로 perception 100% 에 근접)

**source 분포 top-5** (page count):
| sourceId | pages | status |
|----------|-------|--------|
| `sha256:85e8ca8fef1b74cf` | 47 | REG (lotus-pms) |
| `sha256:679cf2dd6db75e3a` | 38 | **MISS** (llm-wiki 첫 ingest 추정, registry hash drift) |
| `sha256:dcbe5dd3f5325d4b` | 30 | REG |
| `sha256:f7dfcf192c179cfd` | 14 | REG |
| `sha256:1b53c2b4e431c903` | 12 | REG |

**fallback 발화 trigger 분석** (`query-pipeline.ts:282 appendOriginalLinks`):
1. `loadRegistry().catch(() => ({}))` — registry load 실패 시 빈 record set (`{}`) — **silent**, log X
2. `for (const citation of citations) → for (const sourceId of citation.sourceIds)` — citation.sourceIds 의 매 id 마다 `resolveSource` 호출
3. `resolveSource` 실패 분기:
   - (a) `stripSourcesPrefix(idOrRef) === null` (정규화 실패) — return null
   - (b) `findById(registry, sourceId) === null` (registry 미등록) — return null
   - (c) `record.tombstone === true` → openUri null 이지만 `rawVaultPath` 는 history fallback 유효 → links 추가 가능
4. resolve 가 null 이거나 `!resolved.rawVaultPath` 면 `continue` — **silent skip**
5. 모든 citation 의 모든 sourceId 가 skip 되면 `links.length === 0` → fallback 발화 `(해석 실패 — registry 점검 필요)`

핵심 trigger 조건: **citation 의 모든 sourceId 가 (a) / (b) 케이스에 해당** 시 발화. 본 vault 실측에서는 `sha256:679cf2dd6db75e3a` 단독 ref 인 38 페이지 query 시 100% 발화.

**citation 분포 sample** (refs-per-page):
- 1 ref / page = 201 (100%), 2+ ref = 0 (현재 corpus)
- 결론: multi-source 시각화 효과는 **검색 Top-K (default 5+) 이 서로 다른 sourceId 페이지를 묶을 때** 발화. 단일 페이지 답변 시 inline `, ` join 이 single citation 처럼 보였던 것은 **dedup 후 1 결과** 이기 때문 (사용자 perception 정확).

**MetadataCache.resolvedLinks 안정성** (`Q1`):
- 기존 sidebar-chat.ts 사용처 grep:
  - `sidebar-chat.ts:1662` — `metadataCache.getFileCache(file)` (tag ranking 수집)
  - `sidebar-chat.ts:2333` — `metadataCache.getFirstLinkpathDest(href, '')` (resolve-before-open broken link 차단)
- 두 site 모두 plugin context 안에서 stable 사용 중 (§5.10.2.2 AC-C5.2 이래 운영, 회귀 0).
- `resolvedLinks` 는 Obsidian 공식 API (`app.metadataCache.resolvedLinks: Record<string, Record<string, number>>`) — source path → 참조 link path map. 역방향 backlink 도출: `Object.entries(resolvedLinks).filter(([_, links]) => target in links).map(([source]) => source)`.
- API surface: cache 가 fully indexed 가 보장된 시점 (plugin onload + workspace ready) 이후 안정. async load race 위험 0 (sidebar-chat 은 ItemView 라서 workspace ready 이후 mount).
- **결론**: I4 안전 채택 가능.

### 이득 (fix 후)

- 정량 — `(해석 실패)` fallback 발화율 ≤ 5% (현 18.9% 페이지 단위, hot-page perception 으로는 거의 100%). registry mismatch 가 발화 시 어떤 sourceId 가 mismatch 인지 WARN log (telemetry) + 사용자 diagnostic command 로 38 페이지 mismatch 즉시 인지 가능.
- 정성 — 사용자 답변 가독성: 원본 1개당 1줄 + extension hint (`(md)` / `(pdf)` / `(hwp)`) badge + wiki backlink section.
- 정성 — schema §"쿼리 워크플로우" 의 "인용과 함께 답변 제공" 원칙 강화.

### Trade-off

- citation list 가 길면 chat 메시지 길이 증가 — backlink section default **collapse LOCK** (Q2, 사용자 결정), `원본:` list 본문은 unchanged.

## 1. Specs

### Spec 1: 원본 1개당 1줄 표시

- **Goal**: `appendOriginalLinks` 의 출력 format 을 `, ` inline join → `\n- ` 줄바꿈 list 로 변경.
- **Invariants**:
  - I1: 1줄 = 1 unique raw vault path (현 dedup 로직 유지 — `seen: Set<string>`).
  - I2: extension badge: filename basename 끝 extension lowercased 표시 (`(md)` / `(pdf)` / `(hwp)` / 기타 dynamic — hardcoded mapping 0건). 도출 = `path.extname(rawVaultPath).slice(1).toLowerCase()` 또는 동치 inline derive. ext 없는 file (e.g., README) → `(file)` fallback.
  - I3: 답변 본문 ≤ 1줄 공백 후 `원본:` heading + 줄바꿈 후 `- [[<target>|<display>]] (<ext>)` list.
  - I3a: list 항목 순서 = citation 발견 순 (안정성 — search Top-K 순서 보존).
- **Acceptance Scenarios**:
  - **Multi-source** (3 citation: md/pdf/hwp): footer = `원본:\n- [[a.md|a]] (md)\n- [[b.pdf|b]] (pdf)\n- [[c.hwp|c]] (hwp)` (3 줄 list + 각 줄 끝 ext badge).
  - **Single-source** (1 citation): 동일 list format (1줄), `, ` inline 제거. `원본:\n- [[a.md|a]] (md)`.
  - **Zero citation**: `원본: (없음 — 외부 근거 없음)` 유지 (변경 X).
  - **All resolve failed**: `원본: (해석 실패 — registry 점검 필요)` 유지 + WARN log (Spec 3).
  - **Ext fallback** (`README` like, no ext): `- [[README|README]] (file)` — 빈 ext 회피.

### Spec 2: wiki 페이지 backlink section

- **Goal**: 답변에 등장한 wiki page 들이 어느 wiki page 에서 참조되는지 (Obsidian backlink) 별도 section 으로 표시.
- **Invariants**:
  - I4: backlink 조회는 Obsidian `app.metadataCache.resolvedLinks` 역방향 lookup (Step "1" 안정성 LOCK). sidebar-chat 의 `wikey-wikilink` (line 2351) DOM rendering 과 별 layer — 답변 텍스트 post-process 단계에서 추가.
  - **I4a (v0.5 갱신 — wikey 3계층 scope filter)**: backlink source path 는 settings `backlinkScope` 옵션에 따라 filter. **raw/ 는 모든 scope 에서 항상 제외** (wiki/ ingest 후 raw sidecar 의 wikilink 가 wiki page 와 dup). default `'wiki'` = wiki/ 페이지만 (LLM-made 지식 자산). opt-in `'extended'` = wiki/ + 외부 폴더 (plan/, activity/, 사용자 메모) — 단순 참조 가시화. ingest 의 본질은 raw → wiki LLM 의미 normalize + 4 카테고리 분해 + 검색 인덱싱이라 wiki/ 만이 "지식 자산", 외부 폴더 는 단순 wikilink graph reference (지식 확장 X, 검색 인덱스 비대상).
  - **I5b (v0.6 폐기)**: v0.5 의 entry badge `(+)` 는 폐기. v0.6 의 2 section 분리 (`참고` vs `확장`) 가 동일 정보를 section header 로 더 명확 노출 — entry 레벨 badge 불필요 (사용자 결정 2026-05-12).
  - **I6 (v0.6 갱신 — 빈 section 미출력)**: wiki array 0 → `참고` section 생략. external array 0 → `확장` section 생략. 양쪽 0 → 빈 string (전체 backlink section 미출력). scope='wiki' default 케이스에서는 항상 external=[] 이므로 `참고` 만 잠재적 출현.
  - **I5 (v0.6 — 2 section 분리, 사용자 raise 2026-05-12)**: 답변 footer 3 layer 구분 — `원본:` (raw) / `참고 (N)` (wiki backlink) / `확장 (M)` (external backlink, extended scope opt-in 시만 출현). `참고` + `확장` 두 `<details><summary>` 구조 — wiki/ 정식 지식과 외부 단순 참조를 section 자체로 명확 분리.
  - I5a: default **collapse** (Q2 LOCK 2026-05-12): HTML `<details><summary>` 구조 — open attribute 없음. Obsidian markdown renderer 가 details/summary 지원.
  - I6: backlink 0 개면 section 생략 (no-op) — 빈 collapse 도 출력 X.
  - I7: backlink list ≤ 5 개 (truncation). 5 초과 시 마지막 줄 `\n- ... (총 N 개, 모두 보려면 Obsidian backlink panel 참조)` — 더보기 button 대신 안내 텍스트 (modal/state 회피, Karpathy Simplicity First).
  - I7a: 답변 텍스트 안 `[[wikilink]]` parsing → target 정규화 → resolvedLinks 역방향 lookup → backlink page paths union → dedup → 답변 본문에 mention 된 wiki page 자체는 backlink list 에서 제외 (self-reference 회피).
- **Acceptance Scenarios**:
  - **Happy** (3 backlink, 1 hop): 답변 본문에 `[[lotus-pms]]` mention → backlink section 에 lotus-pms 를 참조하는 entity/concept page list 3 줄 (collapsed default).
  - **Truncation** (8 backlink): 5 줄 + `... (총 8 개, ...)` 안내.
  - **Zero backlink**: 답변에 mention 된 wiki page 가 어디서도 참조 X → section 미출력.
  - **Self-reference 회피**: 답변에 `[[A]] / [[B]]` 둘 다 mention 이고 A 가 B 를 ref 해도 A 는 B 의 backlink list 에서 제외 (답변 본문 안 중복 회피).

### Spec 3: registry mismatch logging + diagnostic command

- **Goal**: `appendOriginalLinks` 의 `resolveSource` 실패 시 어떤 sourceId 가 registry 에 없는지 / tombstoned 인지 console.warn 으로 log + 사용자 diagnostic command.
- **Invariants**:
  - I8: WARN log format = `[wikey citation] sourceId=<id> not found in registry (page=<wiki page path>)` — sourceId 는 raw form (`sha256:679cf...`) 만, **sensitive content X**: wiki page path (`wiki/entities/claude-code.md`) 까지만, raw vault path X / 답변 본문 X (Q4 LOCK).
  - I8a: WARN 은 citation per sourceId 단위 (page 마다 N 번 — N=sourceId 수, 본 corpus 는 1). dedup 은 별 cycle scope (debug noise 회피는 사용자 콘솔에서 자체 가능).
  - I9: 신규 command `Wikey: Diagnose citation mismatches` (id = `wikey-diagnose-citation-mismatches`) — registerCommands 등록 (`wikey-obsidian/src/commands.ts`).
  - I9a: diagnostic 실행: 모든 wiki page (`wiki/**/*.md`) frontmatter provenance.ref 스캔 → registry 와 cross-check → mismatch sourceId list + 영향 page list 도출.
  - I9b: 결과 출력 = **별 Modal** (Q3 LOCK 2026-05-12): `MismatchDiagnosticModal extends Modal` — title `Citation Registry Diagnostic`, body = (1) summary line `N sourceId mismatch / M total, K pages affected` (2) per-mismatch sourceId block — sourceId 단축 (앞 24 자) + 영향 page list (≤ 10 + 더보기 hint). 닫기 버튼.
- **Acceptance Scenarios**:
  - **Mismatch detected** (query): 38-page entity query → citation 1개 (sha256:679cf...) → resolveSource null → 1 WARN log + footer "(해석 실패)" 표시.
  - **Diagnostic command — clean**: 모든 sourceId registry 일치 → modal 본문 `0 mismatch / 14 sourceIds checked`.
  - **Diagnostic command — mismatch**: 본 corpus 실행 → modal 본문 `1 mismatch / 14 sourceIds, 38 pages affected` + sourceId block `sha256:679cf2dd6db75e3a... → 38 pages: claude-code, anthropic, openai-codex, ... (총 38, 모두 보려면 Console 참조)`.

## 2. Out of Scope

- registry rebuild / 자동 fix — 본 cycle 은 detect + logging + diagnostic 만, fix 는 §5.19 maintenance suite.
- 다국어 alias 통합 (§5.7.9 candidate #3 별 cycle).
- citation 우선순위 정렬 (§5.7.9 candidate #5 별 cycle).
- backlink section "더보기" button 인터랙션 — Spec 2 I7 truncation 안내 텍스트로 대체 (modal/state 회피).

## 3. Dependencies

- `wikey-core/src/query-pipeline.ts:282` `appendOriginalLinks` (format change + WARN log) — **+25 ~ +30 LOC** (extension badge derive + list format + WARN call).
- `wikey-core/src/source-resolver.ts` — 변경 X (resolve 실패 분기 그대로 활용, log 는 query-pipeline 측에서 발화).
- `wikey-obsidian/src/sidebar-chat.ts` — backlink section render (renderMarkdown post-process 또는 답변 finalize hook) — **+60 ~ +80 LOC** (resolvedLinks 역방향 lookup + 본문 [[wikilink]] parse + dedup + collapse markup).
- `wikey-obsidian/src/commands.ts` — diagnostic command 등록 + `MismatchDiagnosticModal` 신규 class — **+120 ~ +140 LOC** (v0.3 정정 — interface + JSDoc + runner 포함: scanCitationMismatches 43 LOC / Modal class 38 LOC / runner 15 LOC / MismatchScanResult interface 8 LOC).
- `wikey-obsidian/styles.css` — `details > summary` 스타일 (`참조 페이지:` section + modal layout) — **+15 ~ +25 LOC**.

**총 변경 면**: ~ 220 ~ 275 LOC + 신규 test 3 ~ 4 개 (v0.3 정정 — commands.ts 실측 +140 LOC 반영). Spec 2 I7 truncation 으로 modal/state 추가 회피하여 80 LOC 절감 확보.

## 4. 진행 순서 (SDD+TDD)

- **Step A (analyst v0.2)**: Step "1" 결과 — 사용자 vault 의 registry mismatch 실측 (몇 % 가 fallback 발화? sourceId 분포?). ✅ **done v0.2 (2026-05-12)** — 실측 18.9% 페이지 단위 (1/14 unique sourceId, 38/201 page), Q1~Q4 LOCK.
- **Step B (tester RED)**: query-pipeline.test.ts (format 5 시나리오 — multi/single/zero/all-fail/no-ext) + sidebar-chat backlink test (resolvedLinks mock + parse + truncation + self-ref) + commands.test.ts (diagnostic scan).
- **Step C (developer GREEN)**: format 변경 + extension badge derive (hardcoded mapping X) + WARN log + backlink section (collapse default) + diagnostic command + modal.
- **Step D — Phase 3a 회귀**: `npm test` + `npm run build` + `./scripts/validate-wiki.sh`.
- **Step E — Phase 3b BLUE**: backlink section helper extract (`collectBacklinks(resolvedLinks, mentioned)`) + WARN log dedup 고려.
- **Step F — codex post-impl review** (cycle #1+).
- **Step G — master 라이브 cycle smoke**: PMS query (47-page entity, 정상 footer) + claude-code query (38-page missing → fallback + WARN) + multi-source query (search Top-K cross sourceId — n>=2 list) + diagnostic command (modal 1 mismatch / 38 pages).

## 5. 변경 이력

- v0.1 (2026-05-11): draft 신규.
- v0.2 (2026-05-12 analyst): Step "1" 실측 evidence 추가 (registry 14 record, 1 mismatch, 38 page fallback trigger, hot-page perception 100% 설명), Spec 1 I2 extension badge dynamic derive 명시 (anchor k 하드코딩 금지), Spec 2 I5a default collapse LOCK (Q2) + I7 truncation 안내 텍스트 (modal 회피, Karpathy Simplicity), Spec 3 I8 WARN log 형식 LOCK (Q4 sensitive X) + I9b 별 Modal 출력 LOCK (Q3), §3 LOC budget 재추정 (180~235 LOC), §4 Step A done 갱신.
- v0.3 (2026-05-12 master): codex post-impl cycle #2 MED finding closure — §3 `commands.ts` LOC budget 정정 (`+80~+100` → `+120~+140`, interface + JSDoc + runner 포함). 총 변경 면 `180~235 LOC` → `220~275 LOC` (실측 반영, commands.ts +140 정합). 코드 변경 X (codex 권고대로 spec 주석만 sync).
- v0.4 (2026-05-12 master): **wikey 3계층 원칙 위반 fix (사용자 raise)** — `collectBacklinks` + `mentioned` 가 vault 전체 (`resolvedLinks` + `getFirstLinkpathDest`) 사용 → wiki/ 외부 source (raw/, plan/, activity/, .obsidian/ 등) 가 backlink 로 포함됨. wikey.schema.md 3계층 "wiki/ 는 LLM-made knowledge layer" 위반. **신규 invariant I4a (scope filter)**: `collectBacklinks(resolvedLinks, mentioned, opts: { scope: 'wiki' | 'vault' })` — default `'wiki'` (wiki/ 시작 source 만, wikey 철학 정합), opt-in `'vault'` (vault 전체, 이미 wikilink graph 가 광범위한 vault 통합 사용자용). 사용자 결정 (2026-05-12) "옵션화 — 일부 vault 는 전체 폴더 link 대상 케이스 있음". WikeySettings 신규 필드 `backlinkScope: 'wiki' | 'vault'` + settings-tab dropdown. 변경 면: collectBacklinks +2 LOC (filter 라인) + main.ts +5 LOC (interface + default) + settings-tab.ts +20 LOC (dropdown) + sidebar-chat.ts +4 LOC (settings 읽기 + scope 전달) + 2 신규 test T14 wiki filter / T15 vault opt-in. wikey-obsidian 134 PASS (132 → 134), 회귀 0.
- v0.5 (2026-05-12 master): **raw/ 제외 + entry badge + header "참고" reword (사용자 raise 추가)** — (a) **`BacklinkScope` rename**: `'vault'` → `'extended'` (의미 명확화). raw/ 는 모든 scope 에서 항상 제외 (wiki/ ingest 후 raw sidecar 의 wikilink 가 wiki page 와 dup, 사용자 결정 "raw/ 와 wiki/ 중복 회피"). (b) **I5b 신규 entry badge**: wiki/ entry = plain `[[path]]`, 외부 (plan/, activity/, 사용자 메모) entry = `[[path]] (+)` 단순 참조 표시. (c) **I5 header reword**: `참조 페이지 (N)` → `참고 (N)` (사용자 표현 "참고:, 원본:" 정확 반영). (d) **handleSend mentioned wiki/ filter**: 답변 `[[wikilink]]` 가 raw/ 또는 외부 폴더로 resolve 되면 mentioned 셋 제외 (wikey 지식 자산 아님). 변경 면: collectBacklinks `'vault'` → `'extended'` + raw/ unconditional skip / buildBacklinkSection entry badge + header label / handleSend `dest.path.startsWith('wiki/')` filter / settings-tab label + value rename / main.ts type rename / 1 신규 test T16 (entry badge) + T10/T10b "참고" sweep + T15 raw/ 제외 검증. wikey-obsidian 135 PASS (134 → 135), 회귀 0. **사용자 raise 본질 질문 답변**: ingest = raw → wiki LLM 의미 normalize + 4 카테고리 분해 + 검색 인덱싱 (wiki/ 만 인덱싱). 단순 참조 = backlink section 가시화 only, 검색 인덱스 비대상 (지식 자산 X, graph reference 만). 검색 대상 만들려면 raw/ 로 옮겨 ingest 의무.
- v0.6 (2026-05-12 master): **답변 footer 3 layer 명확 구분 — `원본:` / `참고:` / `확장:` 분리 (사용자 raise 추가)** — v0.5 의 단일 `참고 (N)` section + `(+)` entry badge → v0.6 의 두 section `참고 (N)` (wiki backlink) + `확장 (M)` (external backlink, extended scope opt-in 시만) 분리. **I5 reword**: 2 section 분리. **I5b 폐기**: (+) badge 제거 (section header 가 동일 정보 더 명확 노출). **I6 갱신**: wiki=0 → 참고 생략 / external=0 → 확장 생략 / 양쪽 0 → 전체 미출력. **collectBacklinks signature**: `string[]` → `BacklinkResult { wiki: string[]; external: string[] }`. **buildBacklinkSection signature**: 단일 array → `BacklinkResult` (legacy array 호환 path 유지, §5.18 외 호출처 보호). 변경 면: sidebar-chat.ts collectBacklinks 두 set 분리 (+10 LOC) / buildBacklinkSection renderBacklinkBlock 추출 + 2 section 합쳐 출력 (+25 LOC, legacy array 호환 5 LOC 포함) / handleSend BacklinkResult 사용 (+2 LOC) / test T8/T9/T11/T13a/T14/T15 return shape `{wiki, external}` 변경 + T10/T10b/T10c/T11b/T16 v0.6 section 분리 검증 + 신규 T17 (wiki=0 + external>0) / T18 (wiki>0 + external=0). wikey-obsidian 135 → **137 PASS** (+2 T17/T18) / 회귀 0 / build 0 errors. **사용자 본질 질문 답변 (인덱싱 layer 명확화)**: 단순 참조 (외부 폴더) 는 검색 인덱싱 0 — qmd/Orama 는 wiki/ 만, LLM 답변 retrieval 도 wiki/ 만. backlink section 의 외부 폴더 link 는 graph reference 만, 사용자가 클릭 시 Obsidian 이 그 page 직접 열어줌 (wikey 의 답변 LLM 은 그 page 의 내용 모름). 답변 정확성 = wiki/ 만 책임, extended scope 은 답변 본문 영향 0.
