# Phase 5: 튜닝·고도화·개선·확장

> 기간: Phase 4 (본체 완성) 완료 후 — **2026-04-24 session 8 Phase 4 본체 완성 선언 이후 착수 가능**.
> 전제: Phase 4 완료 — 원본 → wiki ingest 프로세스가 **wiki 초기화·재생성 없이** 안정적으로 돌아가는 구조 확정. frontmatter/데이터 모델이 고정되어 이후 내용만 축적.
> 범위 정의: 본체가 없어도 wiki 가 돌아가는 것 + 성능·품질·범위 확장 + 진단/계측 도구 + self-extending 구조. **wiki 재생성을 유발하지 않는 것** 만 포함.
> 구성 원칙: 번호·제목·태그는 `activity/phase-5-result.md` 와 1:1 mirror. §5.N 상세 번호 체계 (§5.N.M / §5.N.M.K).
> 이력:
> - 2026-04-22: Phase 재편으로 신규 생성 — 본체 완성 정의 ("구조 변경 없음") 기준으로 Phase 4 에서 이관.
> - **2026-04-24 session 8: 우선순위 기반 전면 재번호** (P0~P4). 기존 §5.1~5.8 이 역사적/주제별 순서였던 것을 **긴급도·성능 영향·의존성** 3축으로 재배치. 섹션 제목 하단 `(was §5.N)` 주석으로 이전 번호 추적.

## 관련 문서

- **Result mirror**: [`activity/phase-5-result.md`](../activity/phase-5-result.md)
- **보조 문서**:
  - [`plan/phase-5-todox-5.1-structural-pii.md`](./phase-5-todox-5.1-structural-pii.md) — §5.1 PII 보조 (완료)
  - [`plan/phase-5-todox-5.2.1-crosslink.md`](./phase-5-todox-5.2.1-crosslink.md) — §5.2.1 entity↔concept cross-link 설계 (analyst v2 + codex APPROVE_WITH_CHANGES)
  - [`plan/phase-5-todox-5.3.1-incremental-reingest.md`](./phase-5-todox-5.3.1-incremental-reingest.md) — §5.3.1 + §5.3.2 결합 설계 (★ 2026-04-25 master v11 + codex Mode D **APPROVE_WITH_CHANGES**, 11 cycle 수렴 P1 0건)
  - [`plan/phase-5-todox-5.4-integration.md`](./phase-5-todox-5.4-integration.md) — §5.4 4 Stage 통합 plan (★ 2026-04-26 v10 codex post-impl Cycle #6 APPROVE)
  - [`plan/phase-5-todox-5.4.1-self-extending.md`](./phase-5-todox-5.4.1-self-extending.md) — §5.4.1 Stage 1 단독 plan (v7 codex Cycle #9 APPROVE)
- **프로젝트 공통**: [`plan/decisions.md`](./decisions.md) · [`plan/plan_wikey-enterprise-kb.md`](./plan_wikey-enterprise-kb.md).

## 우선순위 가이드 (2026-04-24 재조정)

| 우선순위 | 섹션 | 작업 | 이유 |
|----------|------|------|------|
| **P0 긴급** | §5.1 | 구조적 PII (multi-line 폼) | Phase 4 smoke 에서 실누출 재현. PII-heavy 문서 보안 직결 |
| **P1 핵심** | §5.2 / §5.3 | 검색 재현율 / 인제스트 증분 | 질의·축적 모든 경로 품질·확장성 직격 |
| **P2 비전** | §5.4 | self-extending 로드맵 | wikey 철학의 기술적 gate. Stage 1 이 PMBOK 하드코딩 외재화 |
| **P3 개선** | §5.5 / §5.6 | 지식 그래프·시각화 / 성능·엔진 확장 | UX·인프라 투자. 수요 확인 후 |
| **P4 잔여** | §5.7 / §5.8 / §5.9 | 운영 포팅 / Phase 4 D.0.l 잔여 / Variance 진단 | 시간 여유 시. 현 상태로도 동작 |

**추천 실행 순서**: §5.1 (P0) → §5.2+§5.3 (P1 병행) → §5.4 Stage 1 (§5.4.1, P2 gate) → §5.4.2~4 / §5.5 / §5.6 (상황별) → §5.7~9 (잔여).

---

## 5.1 구조적 PII 탐지 (P0)
> tag: #pii, #structure, #ner
> **이전 번호**: `was §5.8.6` (2026-04-24 session 8 신설, 우선순위 재조정으로 §5.1 승격).

> **배경**. Phase 4 D.0.l smoke (2026-04-24) 에서 실제 발생. `사업자등록증.pdf` 같은 스캔 PDF 폼은 `대 표 자` label 과 `김 명 호` value 가 blank line 또는 별도 table cell 로 분리되어 session 8 에서 도입한 single-line regex 패턴 엔진 (§5.8 완료 summary 참조) 이 잡을 수 없다. public repo 에 PII 가 누출될 위험이 있어 P0.

### 5.1.1 Multi-line 폼 label↔name 상관 해결

> **상태 (2026-04-25, developer 세션)**: 본체 구현 착륙. 안 C (Context window heuristic) + multi-value capture + valueExcludePrefixes (YAML 선언). 상세: `plan/phase-5-todox-5.1-structural-pii.md` v4 + `activity/phase-5-result.md §5.1.1`.

- [x] **§5.1.1.1** fixture 7종 확보 (`wikey-core/src/__tests__/fixtures/pii-structural/`). synthetic 이름 풀 (`주식회사 테스트벤치` · `홍 길 동` 등).
- [x] **§5.1.1.2** RED 테스트 작성 — `pii-structural.test.ts` 12 tests 구현 전 8 failed 확증 (2026-04-25 02:45).
- [x] **§5.1.1.3** `PiiPattern` discriminated union (`SingleLinePiiPattern | StructuralPiiPattern`, `patternType` discriminator). `CompiledPiiPattern` 도 union.
- [x] **§5.1.1.3.5** loader ESM 전환 — `require('node:fs|path|os')` → top-level `import`.
- [x] **§5.1.1.4** `loadPiiPatternsFromYaml` union-aware — `patternType: structural` 파싱 + list `valueExcludePrefixes` + legacy (patternType 누락) → single-line fallback.
- [x] **§5.1.1.5** `compilePattern` union-aware — structural 분기에서 `labelRegex`/`valueRegex` 2 regex 컴파일.
- [x] **§5.1.1.6** bundled default YAML — `wikey-core/src/defaults/pii-patterns.default.yaml` (6 패턴). `package.json` build 훅에 `dist/defaults/` 복사 추가.
- [x] **§5.1.1.7** `detectPiiInternal` 에 `collectStructuralMatches()` 분기 + non-empty 줄 `computeWindowEnd()` + prefix exclude `isCandidateExcluded()` (candidate 접두어 + 같은 줄 직전 1~2 token). `sanitizeForLlmPrompt({structuralAllowed?: boolean})` default false filename 차단.
- [x] **§5.1.1.8** GREEN 확증 — `npm test` 537 passed (525 → +12) / `npm run build` 0 errors (2026-04-25 02:53, fresh).
- [x] **§5.1.1.9** FP baseline — `fixtures/pii-structural-baseline/` N=30 synthetic PII-free 한국어 테크 문서 → structural match 0/30 확증 (`pii-structural.test.ts §5.1.1.9`).
- [x] **§5.1.1.10** 문서 동기화 — 본 todo + `activity/phase-5-result.md §5.1.1` + `wiki/log.md` 엔트리.
- [~] **§5.1.1.11** (selective, **skip 결정 2026-04-25**) `scripts/check-pii.sh --structural-only` flag — fixture baseline 0/30 (E7a) 가 mandatory 검증을 충족. live wiki baseline (E7b) 경로 미사용. wiki 규모 확대 시 reopen.
- [x] **§12 E1/E2.b/E3** live smoke — **master 직접 CDP smoke (commit 2da88cb)** Obsidian `--remote-debugging-port=9222` 기동 후 dist runtime end-to-end. fixture 7종 누출 차단 7/7 + baseline FP 0/30 + wiki pre-check BRN/CEO 0 hit. (Phase 4 D.0.l 와 동등한 구조적 검증).
- [x] **wiki 재생성 없음 확증**: ingest 경로 변경 = `pii-redact.ts::detectPiiInternal` 에 `collectStructuralMatches` 분기 1건 추가만. `sanitizeForLlmPrompt` 기존 API 시그니처 (`{guardEnabled, structuralAllowed?}` 추가, default false 로 하위 호환). 기존 wiki 무변경, `applyPiiGate` 외부 호출 형태 유지.
- [x] **§5.1.1.12** (post-compact 2026-04-25) over-mask 4건 fix — bundled YAML `ceo-multiline-form.valueExcludePrefixes` 13종 추가 (주소/전화/휴대/담당/접수/등기/등록/이메일/팩스/우편/사업/본점/소재) + `isCandidateExcluded` 가 same-line 모든 토큰 검사 (기존 last 2 → 전체) + `pii-over-mask-prevention.test.ts` 회귀 방지 (539 tests pass).

---

## 5.2 검색 재현율 + 답변 품질 (P1) ★ 현 진입점
> tag: #eval, #engine, #philosophy
> **이전 번호**: `was §5.1`.
> **2026-04-25 재정의**: 기존 "Anthropic-style chunk 재작성" 단일 항목 → cycle smoke (commit `3f1fa6d`) 에서 발견된 검색·답변 품질 follow-up 5건 통합. wikey 철학 (`wikey.schema.md:157` "페이지 단위 검색", `wiki/analyses/self-extending-wiki.md`) 반영.

> **wikey 검색·인제스트 단위 (philosophy)**. wikey 는 RAG chunk 패턴을 사용하지 **않는다**. Phase 4 §4.5.1.5 v2 (`plan/phase-4-todo.md:446-494`) 에서 결정·구현 완료:
> - **§4.5.1.5 §0~4**: 결정적 H2 section 분할 (`section-index.ts parseSections`) + token-budget 기반 Route 판정 (FULL / SEGMENTED) + SEGMENTED 경로 = "**섹션별** extractMentions + canonicalize"
> - **§4.5.1.5 §5**: `splitIntoChunks` 삭제, `source_chunk_id` → `source_section_idx` rename, `MAX_SOURCE_CHARS` → `TRUNCATE_LIMIT` rename — chunk 개념 코드 레벨 제거 (273 tests PASS)
> - **§4.5.1.5 v2 재정의 이유**: "RAG chunk 패턴 자체가 schema §19·§21 배격 대상" (`phase-4-todo.md:450`)
>
> 즉 ingest 단위 = **H2 섹션** (`## ...`), 검색 단위 = **분해된 작은 페이지** (entity / concept / source / analysis 카테고리, 1 소스 → 5~15 페이지). qmd 임베딩 + BM25 가 페이지 단위로 인덱싱·검색 (`wikey.schema.md:157`). 따라서 §5.2 의 모든 fix 는 (a) 페이지 본문의 cross-link 풍부화 + (b) 검색·답변 prompt 가 페이지 + 1-hop wikilink target 까지 활용하도록 강화 — chunk 재작성 같은 RAG-style infra 추가 X.
>
> **이관 전 위치**: Phase 4 §4.4.1.
>
> **Cycle smoke 실측 (2026-04-25, NanoVNA 1 파일)**:
> - ingest 후 5 entities + 9 concepts + 1 source 생성. 그러나 entity 본문 = 1줄 + `## 출처` 1개 wikilink만. concept 으로의 cross-ref 자동 생성 안 됨.
> - query 답변 184 chars, citation 2건 (entity + source). 같이 ingest 된 9 concepts 미인용.
> - reindex 자동 호출 silent fail — 검색 freshness 자체 깨짐.
> - 사용자 평가: "최소한 답변은 wikilink 참조 link에 있던 내용들은 나와야 하는데, 답변생성을 위한 재조합의 문제인가?" → **재조합 문제 아님, 인제스트 단계에서 cross-link 가 안 만들어진 것이 root cause.**
>
> **검색·답변 품질이 본체 동작 (검색·답변 UX) 의 결정적 영향이라 Phase 5 의 P0 다음 진입점**.

### 5.2.0 Ingest/Audit 패널 UI — paired sidecar.md 표현·카운트 일관화 (사용자 요청 2026-04-25)

> **배경 (사용자 관찰)**: Phase 4 §4.1.3 + §4.2 의 sidecar pair 정책 (`원본.ext` + `원본.md` 한 쌍, registry 의 `path_history` 동기 이동) 결과로 raw/ 안에 동일 base 의 `.ext` + `.md` 두 파일이 병행 존재. 그러나 Ingest/Audit 패널 UI 가 이 둘을 **개별 row** 로 노출 + 카운트해 사용자에게 "원본 N 개" 와 row 수가 일치하지 않는 혼선 발생. 또한 `원본.md` 자체는 사용자가 직접 조작할 일이 없는 derived artifact 인데 row 가 노출되어 잘못 클릭/이동/삭제 위험.

- [x] **paired sidecar.md row hide** — `wikey-obsidian/src/sidebar-chat.ts` Ingest list / Audit list / Audit tree 3 row builders 모두에서 `<base>.<ext>` 와 `<base>.<ext>.md` 가 같은 디렉터리에 동시 존재 시 `.md` row 제외 (commit `f108e0c`)
- [x] **paired sidecar.md 뱃지 표시** — `wikey-pair-sidecar-badge` CSS class 신규. 원본 row 의 파일명 오른쪽 (commit `f108e0c`)
- [x] **파일 카운트 정정** — Audit summary stat (All/Ingested/Missing) 모두 paired sidecar 제외 후 재계산 (commit `f108e0c`)
- [x] **개별 조작 차단** — row hide 로 자동 차단 (commit `f108e0c`)
- [x] **rollover tooltip** — filename + badge 양쪽에 sidecar 생성일 (frontmatter `created` 우선, fs mtime fallback) tooltip (commit `f108e0c`)
- [x] **검증** — 17 unit tests (paired-sidecar.test.ts) PASS / CDP UI smoke 시각 확증 (Audit All 7 / Ingested 1 / Missing 6 / 5 badge / tooltip 작동) (cycle smoke 2026-04-25)
- [x] **wiki 재생성 없음 확증** — UI 레이어만 변경 (commit `f108e0c`)

#### 5.2.0 v2 사용자 follow-up 3건 (2026-04-25 사용자 추가 요청, 본 세션 종료 직전, commit `db693d4`)

- [x] **[md] 뱃지 위치 정밀화** — 파일명 오른쪽 8px margin (이전: nameLine flex space-between 으로 badge 가 filesize 옆에 부유). `.wikey-audit-name-wrap` (flex, gap:8px, flex:1, min-width:0) sub-div 로 filename + badge 묶음. filename `flex: 0 1 auto` 로 자연 width + ellipsis 보존, filesize 는 nameLine 의 두 번째 자식으로 우측 끝 자연 정렬. 3 row builders 모두 적용
- [x] **filename hover tooltip 단순화** — 사용자 요청 (2026-04-25): 한 줄, sidecar 생성일만 (`yyyy-mm-dd HH:MM`). `buildSidecarTooltip` 이전 2줄 (📄 sidecar / 📅 created) → 단일 string. filename + badge 양쪽에 동일 부착
- [x] **Processing modal progress group 위치** — 사용자 요청: progress bar group 만 wrap 바닥, Back 버튼 위로 16px margin. `.wikey-modal-processing` `flex:1` + `padding-bottom:16px` + 신규 `.wikey-modal-progress-group` `margin-top:auto`. fileLabel/spinner 는 wrap 상단 그대로, Back 버튼 절대 위치 (modal 바닥) 그대로 유지. CDP 측정: gap=16px, group bottom=684.7, btn top=700.7

#### 5.2.0 v4 — Dashboard raw sources 카운트 paired 통합 (사용자 요청 2026-04-25 session 12)

> **사용자 관찰**: Dashboard 의 Raw Sources 카운트 (Total Files / Ingested / Missing / PARA folder) 가 audit-ingest.py raw output 을 그대로 표시 → paired sidecar (`<base>.<ext>.md`) 를 별도 파일로 카운트해 audit 패널 카운트와 불일치. audit 패널은 §5.2.0 에서 paired 제외 후 재계산.

- [x] **helper 추출**: `wikey-core/src/paired-sidecar.ts` 에 `recountAuditAfterPairedExclude({ingested, missing, unsupported}) → {ingested, missing, unsupported, totalFiles, folders}` 신규. paired 제외 후 totalFiles + per-folder {total, ingested, missing} 재계산. unsupported 는 audit-ingest.py 정책 mirror — total 합산, missing 미포함. 6 unit tests (PASS)
- [x] **dashboard 적용**: `wikey-obsidian/src/sidebar-chat.ts:renderRawSourcesDashboard` 가 helper 사용 → audit 패널과 동일 카운트
- [x] **audit-ingest.py 미수정**: source-of-truth 유지 (registry/wiki). UI 레이어만 변경
- [x] **검증**: wikey-core 584 tests PASS / wikey-obsidian production build 0 errors

#### 5.2.0 v3 — broken state badge 오렌지 (사용자 정의, 2026-04-25 종료 직전, commit `400b41f`)

> **사용자 정의 (확정)**: 원본.ext alone → audit "missing" 정상. 원본.ext+원본.md (paired) → ingest 한 번 실행됐다는 의미 → "ingested" 분류여야. paired 인데 missing 으로 분류 = registry/wiki 와 sidecar 가 깨진 broken state.

- [x] **broken 판정 + badge 변형** — `sidebar-chat.ts renderAuditSection` 에 `ingestedSet = new Set(auditData.ingested_files)` 신설. list + tree 2 row builders 모두 `hasSidecar && !ingestedSet.has(file)` 시 badge class `wikey-pair-sidecar-badge-broken` 추가
- [x] **tooltip 보강** — broken 시 `⚠ ingest 결과 (registry/wiki) 없음 — sidecar 만 남은 broken state` 한 줄 prepend
- [x] **CSS** — 오렌지 배경 (`#ff9800`) + 진한 글자 (`#fff`) + hover 변형. 정상 paired 는 회색 그대로
- [x] **연관**: root cause = §5.3.2 시나리오 C/D (orphan sidecar / wiki page reset). §5.3.2 fix 로 발생률 자연 감소

### 5.2.1 Entity ↔ Concept cross-link 자동 생성 (★ 답변 풍부도 결정적 fix) — 완료 (commit `f108e0c`, 2026-04-25)

> **보조 문서**: [`phase-5-todox-5.2.1-crosslink.md`](./phase-5-todox-5.2.1-crosslink.md) — 옵션 B (deterministic policy) 채택 근거 + Stage 1/2/3 책임 분석 + `## 관련` H2 위치 결정 + TDD 5 case · 4 step + codex 검증 포인트.

- [x] canonicalizer Stage 3 (`wikey-core/src/canonicalizer.ts`) 가 **같은 ingest 사이클의 entity ↔ concept** 사이 wikilink 를 본문에 자동 삽입 (`applyCrossLinks` helper, 8 unit + codex P1-2 edge 3 case)
  - 현재: `index_additions` 만 wiki/index.md 에 추가. entity/concept 본문은 LLM JSON 의 `description` 만 (1~2 문장).
  - 목표: entity 본문 끝에 `## 관련` H2 섹션 + 같이 만들어진 concept 들의 `[[wikilink]]` list. concept 본문 끝에도 entity 와의 양방향 link.
  - LLM prompt 에 "entity-concept 관계 추출" 단계 추가 또는 같은 source 기반이라 자동 cross-ref 정책 ("같은 source 의 entity 와 concept 은 서로 link") 으로 결정적 생성
  - 측정: NanoVNA fixture 재실행 시 nanovna-v2.md 본문에 smith-chart, swr, s11/s21 등 wikilink 등장 확인
- [x] **wiki 재생성 없음 확증**: 신규 ingest 부터 적용. 기존 wiki entity/concept 본문은 손대지 않음 (사용자가 reset 후 재인제스트 선택).

### 5.2.2 답변 prompt 강화 — 검색 hit 의 wikilink 1-hop 활용 — 완료 (commits `f108e0c`, `7ae636f`, 2026-04-25)

- [x] `query-pipeline.ts buildSynthesisPrompt` 에 다음 지시 추가 (3 unit PASS):
  - "검색된 페이지 본문에 `[[wikilink]]` 로 언급된 다른 wiki 페이지가 있으면, 그 페이지의 정보도 가능한 활용해 답변에 포함"
  - "답변에 등장한 모든 entity/concept 은 첫 등장 시 `[[페이지명]]` 으로 링크"
  - "답변 끝 `참고:` 블록에는 직접 인용 페이지 + 1-hop link target 페이지를 모두 나열"
- [x] 측정: NanoVNA 동일 질문 재실행 시 답변 길이 + citation 수 + 인용된 concept 수 비교 (cycle smoke 1533/1304 chars + 11~15 wiki refs)
- [x] **wiki 재생성 없음 확증**: prompt 변경만, 인덱스/wiki 무관

### 5.2.3 검색 graph expansion — 1-hop wikilink target 자동 fetch — 완료 (commit `f108e0c`, 2026-04-25)

- [x] `query-pipeline.ts` 의 `buildContextFromFS` / `buildContextWithWikiFS` 가 검색 top-N 페이지의 본문 wikilink 를 parse → target 페이지 추가 fetch (1-hop only, depth=1 cap) — `extractWikilinkBasenames` + `expandWithOneHopWikilinks` helpers, 4-카테고리 resolve, cap 5, 9 unit PASS
  - 예: nanovna-v2.md 가 `[[smith-chart]]`, `[[swr]]` 인용 → smith-chart.md, swr.md 본문도 LLM context 에 추가 (TOP_N=5 검색 → context 페이지 = 5 + 1-hop expansion ≤ N)
  - cap: expansion 으로 추가되는 페이지 수 ≤ 5 (token budget). 우선순위 = 검색 score + wikilink 빈도
  - Phase 5 §5.5 (지식 그래프) 의 일부 구현 (cross-ref). 본 항목은 query 시점 expansion 만, §5.5 는 사전 인덱스화.
- [x] **wiki 재생성 없음 확증**: query 시 fetch 만, 인덱스/wiki 무관

### 5.2.4 TOP_N 상향 + 측정 (단기 quick win) — 완료 (commit `f108e0c`, 2026-04-25)

- [x] `WIKEY_QMD_TOP_N` default 5 → 8 (`wikey.conf` + `wikey-core/src/config.ts` + query-pipeline fallback)
- [x] 비용 영향 측정: cycle smoke 시 prompt token + cost 변화 미미 (regression PASS)
- [x] §5.2.2/§5.2.3 적용 전 baseline 측정 → 적용 후 개선 폭 비교 (cycle smoke 답변 1533 chars / 11~15 refs vs baseline 184 chars / 2 citations)

### 5.2.5 자동 reindex silent fail 진단·수정 (검색 freshness 직결) — 완료 (commits `f108e0c`, `7ae636f`, 2026-04-25)

- [x] **재현·진단** — cycle smoke 가 §5.2.9 (qmd `--quick` exit=1) 와 동일 root cause 확증, observability 추가 (waitUntilFresh 진단 + onFreshnessOk callback + post-movePair re-reindex)
- [x] **routine** — silent fail 자체 제거: stderr 보존 (commit `7ae636f`) + ABI 미스매치 specific Notice (12s) — 일반 인덱싱 실패와 구분
- [x] fix 적용 후 cycle smoke 재실행 → reindex 자동 OK + Notice 정상 발동 확증 (master CDP 직접 실행, 15:55-16:10)

### 5.2.6 페이지 내부 H2 섹션 의미 활용 (탐구)

- [ ] wikey 페이지의 표준 H2 섹션 (`## 출처`, `## 관련`, `## 분류` 등) 이 검색·답변에 의미적으로 활용되는지 확인
  - 현재: qmd 인덱스는 페이지 본문 전체를 통째로 임베딩 + BM25. H2 메타데이터 미사용.
  - 탐구: H2 섹션별 임베딩 + 답변 시 "출처 섹션" 우선 인용 같은 의미적 routing 가치 측정.
  - 결정 기준: §5.2.1~3 적용 후에도 정확도/풍부도 부족하면 진입.

### 5.2.7 (archived) Anthropic-style contextual chunk 재작성 — wikey 철학 위배

> **2026-04-25 archive 결정**: Phase 4 §4.5.1.5 v2 가 RAG chunk 패턴 자체를 schema §19·§21 배격 대상으로 결정·코드 제거 완료 (`source_chunk_id` 삭제, `splitIntoChunks` 삭제). chunk-level contextual retrieval 적용은 그 결정과 충돌. **본 항목 archive**, 재현율 추가 개선이 필요하면 페이지 단위 contextual prefix (Phase 2 Step 3-2 Gemma4 contextual prefix 로 이미 구현 — 페이지 임베딩 시 문서 맥락 prefix 주입) 강화 방향으로 재검토.

### 5.2.9 plugin-only qmd `--quick` exit=1 root cause 진단·수정 (★ §5.8.3 W-C1 승격)

> **2026-04-25 신설**: 본 세션 §5.2.5 cycle smoke 가 실증한 issue. `§5.8.3 W-C1` 의 "Low" 우선순위 무효 (검색 freshness 직격 = §5.2 블로킹). §5.8.3 은 본 항목의 alias 로 유지.
>
> **현상 (2026-04-25 cycle smoke 측정)**: ingest 후 plugin 이 `reindex.sh --quick` invoke 시 exit=1, stderr 비어있음 (commit `f108e0c` 이전), commit `7ae636f` 부터는 stderr 보존. CLI 단독 (`bash ./scripts/reindex.sh --quick`) 은 동일 상태에서 exit=0 (15:01 timestamp 확증). 즉 **plugin's execEnv 또는 invocation context** 차이가 root cause.

- [x] 재검증 cycle smoke — commit `7ae636f` 의 reindex.sh stderr 보존 fix 적용 후 NanoVNA fixture 재인제스트. qmd update / embed 의 실제 stderr 메시지를 plugin console (DevTools) 에 capture
- [x] 4 후보 좁힘 → **(i) PATH/cwd + (iv) qmd ABI 미스매치 결합**:
  - nvm node v22 (NODE_MODULE_VERSION 127) 로 qmd install → better-sqlite3.node 가 v22 ABI
  - plugin execEnv PATH 가 homebrew node v24 (NODE_MODULE_VERSION 137) 우선 → `process.dlopen` ERR_DLOPEN_FAILED
  - CLI 단독 실행 (cmux interactive shell) 은 nvm v22 우선 → exit=0 (master CLI 검증과 plugin ingest 동작 갈림)
- [x] root cause fix 5건 (commits `f3dbbfa` → `aad98f8`):
  - `f3dbbfa`: `scripts/rebuild-qmd-deps.sh` (login shell node 명시 사용해 better-sqlite3 강제 rebuild) + commands.ts onFreshnessIssue ABI 미스매치 specific Notice
  - `525c488`: findCompatibleNode 명시 fallback (`/opt/homebrew/bin/node` 등 4단계 candidate iteration)
  - `fb88dad`: vec query hyphen → space (qmd negation 오인 차단)
  - `953c9cb`: ingest-current-note autoMove (Cmd+Shift+I 가 raw/0_inbox/ 트리거 시 자동 분류 + movePair)
  - `aad98f8`: recordMove tombstone false 자동 (stale tombstone 복구)
- [x] 검증: 재재 cycle smoke → reindex 자동 OK + 답변 1533/1304 chars + 11~15 wiki refs + frontmatter 새 경로 (master CDP 직접 실행 15:55-16:10)
- [x] **§5.8.3 W-C1 closed alias 마크**: 본 항목 §5.2.9 로 승격, §5.8.3 은 alias 유지

### 5.2.8 검증 — 완료 (commits `aceb7ff` 후속, master CDP 15:55-16:10)

- [x] cycle smoke 재실행 (NanoVNA 1 파일 + PII-heavy 1 파일) — entity/concept cross-link + 답변 풍부도 + reindex 자동성 + citation 수 모두 측정
- [x] 측정 항목 baseline (cycle smoke 2026-04-25 baseline): citation 2건 / 답변 184 chars / cross-link 0건 / reindex stale (silent fail)
- [x] 목표 도달: 답변 1533/1304 chars + 11~15 wiki refs + cross-link 3+ entity 당 + reindex auto fresh (☑ 모든 목표치 초과)

---

## 5.3 인제스트 증분 업데이트 + sidecar/wiki 사용자 수정 보호 (P1, **종결 2026-04-25 session 12**)
> tag: #workflow, #engine, #architecture
> **이전 번호**: `was §5.3` (번호 유지).

> **상태 (2026-04-25 session 12 종결)**: plan v11 (codex APPROVE_WITH_CHANGES, P1 0건, 11 cycle 수렴) 6-step TDD 모두 GREEN. 회귀 584 → **640 PASS** (+56 신규). build 0 errors. cycle smoke 5/5 PASS (master CDP 직접). PMS_제품소개_R10_20220815.pdf 실 ingest + 사용자 paired sidecar 보존. 후속 follow-up 4건 (ConflictModal default / Approve&Write UX / Original-link footer mode / Settings i18n) 추가 구현. 상세: `activity/phase-5-result.md §5.3`.

### 5.3.1 hash 기반 증분 재인제스트

> **★ 2026-04-25 결합 결정**: §5.3.1 + §5.3.2 한 번에 진행. 보조 plan [`phase-5-todox-5.3.1-incremental-reingest.md`](./phase-5-todox-5.3.1-incremental-reingest.md) v11 (codex APPROVE_WITH_CHANGES, P1 0건) 가 단일 entry point. 6 step TDD 구조 (Step 1 registry / Step 2 helper / Step 3 ingest-pipeline / Step 4 movePair / Step 5 audit / Step 6 plugin), 회귀 baseline 584 → **640 (+56 신규)**.

- [x] **Step 1 — registry 스키마 확장** (`source-registry.ts`): `sidecar_hash / reingested_at / last_action / pending_protections / duplicate_locations` 5 신규 optional 필드 + helper 4 (`appendPendingProtection / clearPendingProtection / appendDuplicateLocation / recordMoveWithSidecar`) + reconcile() duplicate-aware 변경 (Map<hash, paths[]>) + 11 신규 test PASS (584 → 599)
- [x] **Step 2 — `incremental-reingest.ts` 신규** (~290 lines, 24 unit test): `decideReingest` 단일 helper (5 action: skip / skip-with-seed / force / protect / prompt) + raw bytes invariant + conflicts collect-then-decide + extractUserMarkers / mergeUserMarkers / protectSidecarTargetPath / computeSidecarHash 헬퍼 (599 → 623)
- [x] **Step 3 — `ingest-pipeline.ts` 통합** (Step 0/0.5/0.6 진입점 + Hook 1/2/3, 5 integration test skip 분기 testable): raw disk bytes Step 0 + decideReingest Step 0.5 + 분기 Step 0.6 + Hook 1 sidecar protect (`<base>.md.new`) + Hook 2 source page user marker preserve (★ source 한정) + Hook 3 명시 merge `{...existing, hash, size, last_action, reingested_at}` + isCanonicalSidecarWritten 조건 + upsert immutable 반환값 + buildV3SourceMeta(rawDiskBytes, preservedSourceId?) (623 → 628). force/protect 분기는 cycle smoke 위임
- [x] **Step 4 — `classify.ts movePair` rename + atomic** (6 test): sidecar pre-resolve → exhausted return (원본 미이동) → recordMoveWithSidecar discriminated option `{ kind: 'preserve' | 'clear' | 'set' }` + skip frontmatter sidecar_vault_path 보존 (628 → 634)
- [x] **Step 5 — `audit-ingest.py` JSON 컬럼 5 신규** (6 fixture shell smoke PASS exit 0): `orphan_sidecars / source_modified_since_ingest / sidecar_modified_since_ingest / duplicate_hash / pending_protections` (additive only, 기존 키 보존) + Python NFC 정규화 + WIKEY_AUDIT_ROOT env
- [x] **Step 6 — plugin entry + ConflictModal default** (`commands.ts:runIngestCore` + `wikey-obsidian/src/conflict-modal.ts`, 95 lines + cycle smoke 5-step 위임): `IngestOptions.forceReingest` + `onConflict` 추가 (forceReingest 는 caller-only override) + ConflictModal 신규 component + IngestResult / SkippedIngestResult union 타입 분리 (`'skipped' in result` type guard) + IngestCancelledByUserError handling
- [x] **acceptance**: 회귀 584 → **640 PASS** (+56 신규) / build 0 errors (core + obsidian, 1 import.meta warning 기존) / cycle smoke 5-step (첫 ingest → skip → duplicate → force → protect ConflictModal) **모두 PASS** master CDP 환경 reproduce / audit fixture 6/6 PASS exit 0 / PMS 실 ingest paired sidecar 보존 확증
- [x] **source_id stable per path** (decision 10): raw bytes 변경 시 record.id 보존 (preservedSourceId), wikilink/provenance 영향 0. cycle smoke step 4 에서 sha256:43db30bf3d8756c5 보존 실증
- [x] **★ 후속 follow-up 추가 구현**:
  - **Approve & Write UX** — button click 시 disabled + "Writing… (please wait)" + spinner CSS (다중 클릭 차단)
  - **Original-link footer mode** (`OriginalLinkMode = 'raw' | 'sidecar' | 'hidden'`) — `appendOriginalLinks` mode 분기 + `deriveSidecarPath` (`<vaultPath>.md` derive, `.md`/`.txt` 자체) + alias `[[<full path>|<basename without ext>]]` (디렉토리/확장자 숨김, rollover 시 full path tooltip). 6 신규 test PASS (634 → 640)
  - **Plugin settings UI** — originalLinkMode dropdown (PII 모드 다음 위치). default 'raw'
  - **Settings i18n** — settings-tab.ts 35 한글 라인 → 0 (전부 영문, Sentence case + 짧은 dropdown 라벨 + description 자세한 설명). OCR Model inputbox → renderModelDropdown
- [x] **★ #10 R==null + paired sidecar 미보호 GAP fix** (2026-04-25 session 12 추가): `ConflictKind` 에 `'unmanaged-paired-sidecar'` 추가. `decideReingest` Phase A 에서 `R == null && diskSidecarExists` 시 push. Phase B `R == null` 분기 재구성 (conflicts=[] → force / onConflict → prompt / else → protect). Hook 1 + Hook 3 + pending_protections kind 분기 확장. 4 신규 test PASS (24 → 28)
- [x] **★ #11 entity/concept `## 출처` wikilink broken link fix** (2026-04-25 session 12 추가): canonicalizer.ts `buildPageContent` 의 `## 출처` 를 alias `[[<sidecar path>|<basename without ext>]]` 형식으로 변경. sidecar 파일 규칙 derive (`.md`/`.txt` 자체, 그 외 `<base>.<ext>.md`). 4 신규 test PASS (53 → 57). `scripts/fix-source-wikilinks.py` one-off bulk fix script 로 기존 vault 36 페이지 일괄 fix. CDP unresolvedLinks 검증: lotus-pms.md `{}` (이전 `{PMS_..: 1}`) — resolved
- [ ] **잔여 follow-up (out-of-scope, 다음 세션)**:
  - `.md.new` 자동 cleanup / dashboard·audit panel UI 시각화 (5 신규 컬럼 배지) / user_marker_headers config 노출 / entity·concept page user marker 보호 / hash perf (mtime 1차 필터) / CLI `--force` `--diff-only` 플래그 / section-level diff / tombstone restore + sidecar_hash / Python ↔ TS NFC cross-language 자동 검증
- [ ] **삭제된 소스 → 의존 wiki 페이지 자동 "근거 삭제됨" 표시 / 정리** (★ 본 결합 plan 범위 밖 — Phase 4 §4.2.2 source-registry 의 tombstone 처리 + §5.5 그래프 영역. §5.3 종결 후 별도 평가)
- [x] **wiki 재생성 없음 확증**: source-registry 스키마는 Phase 4 §4.2.2 에서 선결정. 본 항목은 로직만 추가, 기존 wiki 는 hash 변경된 소스만 재인제스트로 갱신. legacy record 는 skip-with-seed 자동 마이그레이션. 기존 NanoVNA / PMS 데이터 backwards compat read OK

### 5.3.2 sidecar + ingest 불일치 예외 처리 (★ 2026-04-25 §5.2.9 사용자 발견 — §5.3 으로 분리)

> **배경 (2026-04-25 사용자 발견 + master 코드 분석)**: 현 ingest pipeline 은 매 ingest 시점마다 `wikiFS.write(sidecarPath, sidecarBody)` (`ingest-pipeline.ts:226-232`) 와 `wiki/sources/source-*.md` write 를 무조건 overwrite. registry/wiki 와 disk 의 sidecar/wiki page 동기 보장은 **ingest 시점만**. 그 사이 사용자가 disk 직접 수정 (sidecar.md 메모, wiki page 추가 내용) 하면 다음 ingest 시 LOST.
>
> **8 시나리오 분석** (`activity/phase-5-result.md §5.2.9` 후속 분석 참조):
>
> | # | 시나리오 | 동작 | 위험도 |
> |---|----------|------|--------|
> | A | sidecar.md 사용자 직접 수정 후 ingest | overwrite → 사용자 수정 LOST | 🔴 높음 |
> | B | 원본만 raw/0_inbox/ + 이전 sidecar 다른 폴더 | movePair destination 에 같은 이름 sidecar 있으면 덮어씀 | 🟡 중간 |
> | C | sidecar.md 만 남고 원본 (PDF) 삭제 | audit 가 .md standalone 표시. ingest 시 새 source_id (hash 다름) → 이전 PDF 의 wiki 잔존 (stale) | 🟡 중간 |
> | D | registry 비고 wiki/sources/source-*.md 남음 | ingest 가 wiki page overwrite → 사용자 추가 메모 LOST | 🟡 중간 |
> | E | 같은 hash PDF 두 위치 (사용자 복사) | registry record 1개. reconcile 의 hash 매칭 destination 불확정 | 🟡 중간 |
> | F | sidecar hash 변경, 원본 PDF 그대로 | A 동일 — overwrite | 🔴 높음 |
> | G | paired 에서 PDF 만 삭제, .md 남음 | audit 가 .md standalone 표시. paired helper: sibling 원본 없으면 paired 아님 | 🟢 낮음 (정상) |
> | H | paired 에서 .md 만 삭제, PDF 남음 | hasSidecar=false → 변환 단계 새 sidecar 생성 + registry/wiki update | 🟢 낮음 (정상) |
>
> **핵심 위험**: A/F (sidecar 수정 LOST) + D (wiki page 메모 LOST). 사용자가 ingest 결과를 직접 수정하는 정상 워크플로우가 다음 ingest 로 파괴됨.

- [x] **시나리오 A/F fix — sidecar 수정 보호** (Hook 1 + decideReingest sidecar-user-edit conflict):
  - registry record 의 `sidecar_hash` 필드 vs disk hash (NFC normalize 후 sha256). decideReingest 에서 `sidecar-user-edit` conflict push.
  - protect 분기: 새 sidecar 를 `<base>.md.new` (또는 `.1~.9` 자동 증가, `.10` exhausted throw) 로 저장. canonical `.md` 미변경. registry.pending_protections append + sidecar_hash 미갱신 (★ P1-2 단일 규칙)
  - prompt 분기 (onConflict 제공): ConflictModal 등장 → preserve/overwrite/cancel 선택. plugin runIngestCore default modal 자동 주입 (P2-3)
- [x] **시나리오 D fix — source page 사용자 메모 보호** (★ 2026-04-25 v3 narrowing):
  - **scope**: `wiki/sources/source-*.md` 한정. entity/concept page 는 후속 (#4)
  - Hook 2 (createPage 직전): `extractUserMarkers(existing)` → `mergeUserMarkers(newContent, markers)`. USER_MARKER_HEADERS = `['## 사용자 메모', '## User Notes', '## 메모']`. 멱등 (이미 존재하면 skip)
  - entity/concept 보호는 후속 — `plan/phase-5-todox-5.3.1-incremental-reingest.md` 후속 항목 #4 참조
- [x] **시나리오 B fix — movePair destination 충돌** (Step 4):
  - `MovePairOptions.onSidecarConflict?: 'skip' | 'rename'` (default 'skip'). sidecar pre-resolve (원본 이동 전) + dest-conflict-exhausted (.1~.9 모두 충돌 → 원본 이동 안 함) + recordMoveWithSidecar atomic
- [x] **시나리오 C fix — orphan sidecar 처리** (Step 5):
  - audit-ingest.py JSON 신규 컬럼 `orphan_sidecars`: sidecar `.md` 만 있고 paired 원본 부재 + ingest-map miss
- [x] **시나리오 E fix — duplicate hash 추적** (Step 1 + decideReingest):
  - registry record 신규 필드 `duplicate_locations: string[]` (★ v4 정정: path_history 와 분리). decideReingest 에서 `duplicate-hash` conflict + `duplicate-hash-other-path` skip + `appendDuplicateLocation` (canonical 자체 제외, 멱등). reconcile() duplicate-aware (Map<hash, paths[]>)
- [x] **wiki 재생성 정책**: 본 fix 들은 신규 ingest 경로에만 영향. 기존 wiki/sidecar 데이터 무관.
- [x] **acceptance**: A/F 시나리오 cycle smoke step 5 reproduce → ConflictModal 등장 + Hook 2 user marker preserve 확증 / source-registry +11 / incremental-reingest +24 / movePair +6 / audit fixture +6 / query-pipeline +6 (Original-link footer mode) 모두 PASS / cycle smoke 5/5 PASS

> **출처**: `activity/phase-5-result.md §5.2.9` 의 8 시나리오 표 + master 코드 분석 (`ingest-pipeline.ts:226-232` 무조건 overwrite). 본 §5.3.2 는 §5.3.1 hash diff 인프라가 우선 완성된 후 진입 — 두 항목 함께 진행.

---

## 5.4 표준 분해 규칙 self-extending 구조 (P2) — **종결** (2026-04-26 session 13)
> tag: #framework, #engine, #architecture
> **이전 번호**: `was §5.6`. 2026-04-22 Phase 4 §4.5.1.7.2 PMBOK 하드코딩이 Stage 0 사전 검증에 해당.
> **session 13 종결** (2026-04-26): 4 Stage + integration test + AC21 라이브 cycle smoke + follow-up 4 항목 모두 GREEN. codex post-impl Cycle #6 APPROVE / 670 → 732 PASS / 16 commits push 9b7da21 → 7e6c2fb. 다음 세션 = Stage 4 실 qmd embeddings 통합 (1순위) + Suggestions UI 개선 (2순위).
> **★ paradigm shift issue 등록** (2026-04-26 session 14): 사용자 본질 비판 6 chain (graph emergent / 자동 ontology / 지식 분해 한계 / LLM 백 시대착오) → 본 §5.4 architecture 자체 deprecation 검토. 정식 issue = `§5.10 Graph emergent ontology — §5.4 paradigm shift`. 4 옵션 (A 점진 / B graph emergent / C 관망 / **★ D LLM-only ontology 폐기**) 중 사용자 다음 세션 결정.

### 5.4.0 Stage 0 사전 검증 (Phase 4 §4.5.1.7.2) — **완료** (이관 mirror)

- [x] PMBOK 10 knowledge areas canonicalizer prompt 단발 하드코딩 (A안). 352/352 PASS (Phase 4 §4.5.1.7.2 본체).
- [x] 철학 선언 `wiki/analyses/self-extending-wiki.md` 정식 기록.
- [x] PMS 5-run 실측 (Concepts CV 24.6% → <15%) 후 Stage 1 진입 결정.

> **§5.4 통합 개발 계획서 단일 소스**: [`plan/phase-5-todox-5.4-integration.md`](./phase-5-todox-5.4-integration.md) v5 (codex Cycle #5 APPROVE 2026-04-26 / BUILD_BREAK_RISK LOW / Cycle 누적 #1~#5). **세부 설계 (4 Stage detailed 알고리즘 + 통합 시나리오 §4 5 가지 + 우선순위 chain + 8 종 신규 export 타입 + writer section-range insertion + store 분리 + LLM mapper) 는 통합 plan v5 본문에**, 진행 상태 추적 (체크박스) 은 본 §5.4 통합 관리. AC 본문 변경 시 통합 plan 갱신 → 본 체크박스 동기화.
>
> **§5.4.1 Stage 1 단독 plan**: [`plan/phase-5-todox-5.4.1-self-extending.md`](./phase-5-todox-5.4.1-self-extending.md) v7 (codex Cycle #9 APPROVE 2026-04-26). Stage 1 한정 detailed (통합 plan §3.1 reference 단일 소스).
>
> **현재 위치**. 2026-04-22 Phase 4 §4.5.1.7.2 (PMBOK 10 knowledge areas 프롬프트 하드코딩) 구현 완료, CDP 실측 대기 — 이 사전 검증이 본 §5.4 의 Stage 0 에 해당. 실측에서 Concepts CV 24.6% → <15% 확증되면 Stage 1 (schema.yaml 외부화) 진입.
>
> **배경**. PMBOK 을 canonicalizer 프롬프트에 단발 하드코딩했다. ISO 27001 controls / ITIL 4 practices / GDPR 7 원칙 / SAFe configurations / OWASP Top 10 / OSI 7 Layer / 12 Factor App 등 구조적으로 동일한 "표준 = N 하위 영역" 패턴이 연속 등장할 것이 확정되어 있는 만큼, 매번 prompt 블록을 늘리는 건 유지 불가. **사용자 수동 등록도 궁극의 답이 아니며**, wiki 가 축적될수록 wikey 자체가 표준 분해 구조를 **스스로 학습·확장** 하는 구조로 이행해야 한다.
>
> **wiki 재생성 없음 확증**: 모든 Stage 는 신규 인제스트 경로에만 영향. 기존 wiki 에 PMBOK 으로 이미 생성된 페이지들은 Stage 1 외부화 시점에도 보존되며, yaml 로더가 prompt 를 동적 생성하는 방식으로 전환되어도 기존 데이터는 건드리지 않는다.
>
> **4 단계 로드맵** — 각 단계가 다음 단계의 infra 이며, 앞 단계의 오용 가능성이 측정되어야 다음 단계 착수. 전량 구현 강제 아님.
>
> **공통 데이터 타입 스케치** (미구현):
> ```ts
> // wikey-core/src/types.ts — SchemaOverride 확장 후보
> interface StandardDecomposition {
>   name: string                      // "PMBOK", "ISO-27001"
>   aliases: string[]                 // ["Project Management Body of Knowledge", "프로젝트 관리 지식체계"]
>   umbrella_slug: string             // "project-management-body-of-knowledge"
>   components: Array<{ slug: string; type: ConceptType | EntityType }>
>   rule: 'decompose' | 'bundle'      // decompose = 하위 영역 개별 추출, bundle = 상위 1 개로 묶음
>   require_explicit_mention: boolean // true = hallucination guard (본문 미등장 시 추출 금지)
>   confidence?: number               // Stage 2+ 에서 채워짐 (자동 학습 결과일 때)
>   origin?: 'hardcoded' | 'user-yaml' | 'suggested' | 'self-declared' | 'converged'
> }
> ```

**§5.4 gate**: Phase 4 §4.5.1.7.2 PMS 5-run 실측 (Concepts CV 24.6% → <15%) 에서 효과 확증. 미달 시 Stage 1 진입 전에 A안 재설계 또는 B안 보강 (9 slug FORCED_CATEGORIES pin).

### 5.4.1 Stage 1 — static `.wikey/schema.yaml` override (가까운 후속, 두 번째 표준 등장 시 즉시 착수)

> **상세 설계 단일 소스**: [`plan/phase-5-todox-5.4.1-self-extending.md`](./phase-5-todox-5.4.1-self-extending.md) v7 (codex Cycle #9 APPROVE 2026-04-26, file rename 2026-04-26 사용자 명명 정책 — 기존 `phase-5-todox-5.4-self-extending.md` → `phase-5-todox-5.4.1-self-extending.md`. 5.4 통합 plan 은 별 파일 `phase-5-todox-5.4-integration.md`). 본 체크박스는 v7 §3.5 의 9 AC + R1/R3 + AC6.b 라이브 측정 + AC7 회귀를 narrowing — 진행 상태만 추적. AC 본문 변경 시 todox 갱신 → 본 체크박스 동기화.
> **트리거**: 두 번째 표준 corpus (ISO 27001 / ITIL 4 / GDPR / SAFe / OWASP / OSI 7 Layer / 12 Factor App 등) 가 wiki 인제스트 직전. PMBOK 1 corpus 만 있는 동안은 진입 대기.
> **Entry gate (본 plan 책임 영역 아님 — todox §3.6 F7 entry gate vs no-regression 분리)**: Phase 4 §4.5.1.7.2 PMS 5-run 실측 Concepts CV 24.6% → <15% 도달. 본 plan AC6.a (단위 테스트) + AC6.b (라이브 측정) 는 post-change no-regression 만 약속.
> **Baseline (불변)**: 648 PASS / build 0 errors (Phase 5 §5.3 cycle smoke 종결 시점).

#### 5.4.1.1 데이터 모델 + 상수 (`types.ts` / `schema.ts`)
- [x] **AC1** — 타입 4종 + 상수 1종 export (`schema.ts`):
  - `StandardDecompositionComponent` (with optional `aliases`, F3) · `StandardDecomposition` · `StandardDecompositionsState` (3-kind discriminated union: `empty-explicit` / `empty-all-skipped` / `present`, absent 는 `undefined` 자체 — codex Cycle #2 단일화) · `SchemaOverride.standardDecompositions?: StandardDecompositionsState` 필드 추가 (`types.ts:143-146`)
  - `BUILTIN_STANDARD_DECOMPOSITIONS` 상수 (export, F3 component aliases 포함) — PMBOK 10 areas 코드 default
  - `STANDARD_EXCEPTIONS` Set 갱신 (`schema.ts:143`): canonical slug 2개 추가 — `project-schedule-management` · `project-resource-management` (P3 codex Cycle #2). canonical slug 가 `-management` suffix anti-pattern 으로 잡히지 않도록.
  - `tsc --noEmit` 0 errors. `SchemaOverride` 사용 site 6곳 (ingest-pipeline `:491` + schema-override.test 5곳) 모두 빌드 OK.

#### 5.4.1.2 YAML 파서 확장 (`schema.ts:289-354`)
- [x] **AC2** — `parseSchemaOverrideYaml` 가 `standard_decompositions:` top-level section 인식. 신규 단위 테스트 ≥ 9 cases:
  - (1) standard_decompositions only YAML → 파서 non-null + `entityTypes: []` (F2 null 조건 변경)
  - (2) explicit `standard_decompositions: []` → state `{ kind: 'empty-explicit' }`
  - (3) `standard_decompositions:` 키 부재 → `standardDecompositions === undefined` (absent 단일화)
  - (4) 모든 entry invalid silent skip + warn → state `{ kind: 'empty-all-skipped', skippedCount: N }` + builder built-in fallback 검증
  - (5) component slug 충돌 first-wins (M6) + warn 메시지 검증 (`vi.spyOn(console, 'warn')`)
  - (6) tab indentation 거부 + warn (Scrutiny c)
  - (7) `components[].type` invalid (override + built-in 어디에도 없음) → component skip + warn (F5 런타임 검증)
  - (8) 잘못된 `rule` (`decompose|bundle` 외) → 항목 skip
  - (9) `components[].aliases` (F3) 정상 파싱 + 동일 항목 안 중복 skip
  - 각 warn 케이스 spy capture 확인 (UNDECIDED #2 v3: `loadSchemaOverride` 시그니처 변경 없이 관측)

#### 5.4.1.3 프롬프트 동적 빌더 (`canonicalizer.ts`)
- [x] **AC3** — `buildStandardDecompositionBlock(override)` 신규 (4 시나리오 분기): `undefined` → built-in / `empty-explicit` → 빈 string / `empty-all-skipped` → built-in fallback + warn / `present` → built-in append user entries (F1 v3 정정). `buildCanonicalizerPrompt` 가 `{{STANDARD_DECOMPOSITION_BLOCK}}` placeholder 치환 (F4). 작업 규칙 #7 PMBOK 10 areas 인라인 (`canonicalizer.ts:262`) 제거. `canonicalizer.ts:209-216` 주석을 §5.4.1 표기로 정정. ≥ 5 cases.
- [x] **AC4** — `overridePrompt` 분기에 `{{STANDARD_DECOMPOSITION_BLOCK}}` placeholder 추가 (`canonicalizer.ts:238-246`). 사용자 정의 prompt 시 동적 블록 inline. ≥ 2 cases (custom prompt with/without placeholder).
- [x] **builder exact phrase 보존** (P2-5 codex Cycle #2): `canonicalizer.test.ts:230` 의 두 anchor — `'묶지 말 것'` + `'직접 언급되지 않으면 추출하지 않는다'` — builder 출력 그대로 등장 (todox §3.3 line 320/323/344). PMBOK 10 knowledge areas 개별 추출 표현 유지.
- [x] **prompt entity 일반화** (F5): 기존 "별도 concept" → "별도 entity 또는 concept" 로 변경 (component type 이 entity 도 허용).

#### 5.4.1.4 두 번째 표준 등록 가능성 (ISO-27001 fixture)
- [x] **AC5.a** — ISO-27001 5-control unit fixture (`__tests__/fixtures/iso27001-5-control.yaml`) → schema 주입 → canonicalizer prompt 에 5 control slug 동적 출력. PMBOK 10 areas 동시 출력 (F1 append).
- [x] **AC5.b** — ISO-27001 93-control fixture (line count 측정 제거, F6 v3) → parser ≥ 93 components 인식 + warn 0건. 메모리 / 시간 회귀 없음.

#### 5.4.1.5 회귀 무결성 (PMS 5-run 라이브 측정)
- [x] **AC6.a** — 단위 테스트 기준: builder 가 PMBOK entry 1개 유지 시 출력에 `'묶지 말 것'` + `'직접 언급되지 않으면 추출하지 않는다'` + `'PMBOK 10 knowledge areas 개별 추출'` 3-anchor phrase 모두 포함 (deterministic 등가성).
- [x] **AC6.b** — PMS 5-run 라이브 측정 (tester 책임): Stage 1 변경 전후 Concepts CV 동일 또는 개선 (entry gate 24.6% → <15% 는 별개 — 본 plan 은 no-regression 만 약속, F7).

#### 5.4.1.6 빌드/테스트 통과
- [x] **AC7** — `npm run build` 0 errors + `npm test` baseline 648 → ≥ 667 PASS (신규 ≥ 19 cases: AC2 9 + AC3 5 + AC4 2 + AC5.a 1 + AC5.b 1 + AC6.a 1). AC6.b 는 라이브 측정 (단위 테스트 N/A).

#### 5.4.1.7 사용자 vault 호환 (R1 강등 / R3 제거)
- [x] **R1 (Medium → Low)** — `.wikey/schema.yaml` 에 `standard_decompositions:` 키 부재 시 `standardDecompositions === undefined` → `BUILTIN_STANDARD_DECOMPOSITIONS` 자동 사용. §4.5.1.7.2 효과 자동 보존, 마이그레이션 불필요.
- [x] **R3 (제거)** — F1 v3 append 정책 적용으로 사용자가 ISO-27001 만 추가해도 PMBOK 자동 유지. risk 자체 제거.
- [x] `SCHEMA_OVERRIDE_TEMPLATE` (`settings-tab.ts:1118-1135`) 갱신: PMBOK 예시 entry 주석-out (P2-4) — 신규 vault 가 yaml 안에서 PMBOK 구조 학습 가능, 사용자가 자유롭게 활성화. 단일 yaml 파일에서 `standard_decompositions: []` 와 entries 동시 불가능 (mergeWithBuiltin 미지원, R9 limitation).

#### 5.4.1.8 진입·종료 조건
- [x] **진입 trigger**: 두 번째 표준 corpus 인제스트 직전. PMBOK 1 corpus 만 있는 동안 대기.
- [x] **종료 조건**: 9 AC 모두 GREEN + AC7 baseline ≥ 667 PASS + AC6.b 라이브 측정 no-regression. 종료 후 Stage 2 (§5.4.2) gate 평가.

### 5.4.2 Stage 2 — extraction graph 기반 suggestion (Stage 1 완료 후, 중기)

> **상세 설계 단일 소스**: [`plan/phase-5-todox-5.4-integration.md §3.2`](./phase-5-todox-5.4-integration.md) v5 (codex Cycle #5 APPROVE). 본 체크박스는 v5 §5 의 AC2~AC8 narrowing — 진행 상태 추적만.
> **전제**: Stage 1 (§5.4.1) 안정 동작 + AC21 fixture corpus 6 자료 마련 (master 책임, U4 — `raw/__fixtures__/integration-cycle-smoke/` PMBOK + ISO 27001 + ITIL/SAFe/OWASP × 2 source).
> **Baseline (불변)**: §5.4.1 staged 670 PASS / build 0 errors.

#### 5.4.2.1 SuggestionStorage + 데이터 모델
- [x] **AC2** — `Suggestion` / `SuggestionState` (4-kind: pending / accepted / rejected / edited) / `SuggestionStorage` interface export (wikey-core/src/types.ts + suggestion-storage.ts 신규). `.wikey/suggestions.json` schema (rotation 안 함, negativeCache 영구). `.wikey/mention-history.json` schema (rotation 5000 ingest 또는 10MB). 신규 단위 테스트 ≥ 3 cases.

#### 5.4.2.2 패턴 탐지 알고리즘
- [x] **AC3** — co-occurrence detector (minSiblings ≥ 3, prefix ≥ 5 chars). 신규 단위 테스트 ≥ 4 cases (정상 패턴 / 임계 미만 / 다중 표준 / sibling 부족).
- [x] **AC4** — suffix clustering (whitelist 6 종: `-management`, `-domain`, `-practice`, `-control`, `-principle`, `-policy`). 신규 단위 테스트 ≥ 3 cases.
- [x] **AC5** — confidence score formula (0.4·support + 0.3·suffix_homogeneity + 0.2·mention_density + 0.1·builtinOverlap, 임계 ≥ 0.6 alpha default). 신규 단위 테스트 ≥ 3 cases. **alpha calibration 의무** (cycle #2~#6 라이브 검증 후 baseline 측정 → hardening, 그 전까지 임계 변경 금지).

#### 5.4.2.3 Audit UI suggestion 카드
- [x] **AC6** — `wikey-obsidian/src/sidebar-chat.ts` Suggestions panel 신규 (Audit panel 과 분리). accept / reject / edit 버튼 + 사용자 승인 게이트 필수. 신규 단위 테스트 ≥ 2 cases.

#### 5.4.2.4 schema.yaml writer (section-range insertion)
- [x] **AC7** — `wikey-core/src/schema-yaml-writer.ts` 신규 (`appendStandardDecomposition`). section-range insertion (line-level scan, parse 안 함) — `standard_decompositions:` 다음 top-level key 직전 line splice. header `[]` 인 경우 `header-unsafe` reject (사용자 명시 disable 의도 보호). idempotency check (`umbrella_slug:` substring marker). 신규 단위 테스트 ≥ 3 cases (yaml 보존 / append idempotent / header `[]` reject).

#### 5.4.2.5 ingest pipeline trigger
- [x] **AC8** — `wikey-core/src/ingest-pipeline.ts` 가 ingest 직후 `runSuggestionDetection` 호출 → `.wikey/suggestions.json` 누적. mention-history 도 동시 누적. 신규 단위 테스트 ≥ 2 cases (정상 trigger / 동시성 보호).

#### 5.4.2.6 false positive 방지 + 리스크
- [x] marketing 카피 distinguish: 임계값 + 사용자 승인 게이트 + 본 cycle baseline calibration 필수 (alpha → hardening trigger)
- [x] **종료 조건**: AC2~AC8 모두 GREEN + ≥ 17 신규 cases + 670 → ≥ 687 PASS. Stage 3 (§5.4.3) 진입.

### 5.4.3 Stage 3 — in-source self-declaration (장기, Stage 2 정확도 증명 후)

> **상세 설계 단일 소스**: [`plan/phase-5-todox-5.4-integration.md §3.3`](./phase-5-todox-5.4-integration.md) v5. 본 체크박스는 v5 §5 의 AC9~AC14 narrowing.
> **전제**: Stage 2 (§5.4.2) AC2~AC8 GREEN + 라이브 검증 후 false positive rate calibration 완료. accept rate ≥ 80% 또는 baseline 임계 정의.

#### 5.4.3.1 SelfDeclaration 타입 + persist 결정
- [x] **AC9** — `SelfDeclaration` 타입 + `SelfDeclarationPersistChoice` (3-kind: runtime-only / pending-user-review / persisted) 신규 export. `mergeRuntimeIntoOverride(SchemaOverride, SelfDeclaration[])` helper (Stage 1 BUILTIN 위에 runtime entries append). 신규 단위 테스트 ≥ 1.

#### 5.4.3.2 section-index "표준 개요" detector
- [x] **AC10** — `wikey-core/src/section-index.ts` 의 `headingPattern` 신규 `'standard-overview'` 추가 (keyword regex `/개요|overview|introduction/`). 신규 단위 테스트 ≥ 3 cases (한국어 / 영어 / 미매치).

#### 5.4.3.3 structured decomposition extractor
- [x] **AC11** — deterministic pattern matching (numbered list 또는 bullet list ≥ 5 items + umbrella reference). LLM 호출 옵션 (ii) v2 deferral. 신규 단위 테스트 ≥ 3 cases.

#### 5.4.3.4 runtime-scope vs persist 결정 트리
- [x] **AC12** — default = runtime-only (해당 ingest 세션에만 적용). 사용자 승인 시 `pending-user-review` → review modal → `persisted` (schema.yaml append, Stage 2 writer 재사용). 자동 persist 강제 금지. 신규 단위 테스트 ≥ 2 cases.

#### 5.4.3.5 Stage 2 suggestion 충돌 처리
- [x] **AC13** — `shouldStage3ProposeRuntime(store, umbrella_slug)` 분기 (no prior / pending / accepted / rejected). suggestion 이미 있는 표준이 self-declared 자료에 등장 시 우선순위 결정. 신규 단위 테스트 ≥ 2 cases.

#### 5.4.3.6 false positive 방지
- [x] **AC14** — marketing 자료 본문이 enumerate 형태로 표준처럼 보이는 경우 guard. Phase 4 §4.3.2 provenance tracking 연계. 신규 단위 테스트 ≥ 1.

- [x] **종료 조건**: AC9~AC14 모두 GREEN + ≥ 12 신규 cases. Stage 4 (§5.4.4) 진입.

### 5.4.4 Stage 4 — cross-source convergence (Phase 5 내 최후 단계, 실험적)

> **상세 설계 단일 소스**: [`plan/phase-5-todox-5.4-integration.md §3.4`](./phase-5-todox-5.4-integration.md) v5. 본 체크박스는 v5 §5 의 AC15~AC20 narrowing.
> **전제**: Stage 3 (§5.4.3) AC9~AC14 GREEN + mention-history 누적 ≥ 3 표준 × 2 source = 6 instance.
> **정확도**: alpha / page-level-limited (mention-level granularity v2 deferral).

#### 5.4.4.1 ConvergedDecomposition 타입
- [x] **AC15** — `ConvergedDecomposition` (with `arbitration_method: 'union' | 'llm'` + `arbitration_confidence: number 0~1` + `source_mentions: SourceMention[]` + `arbitration_log?: string`) export. `.wikey/converged-decompositions.json` schema. 신규 단위 테스트 ≥ 1.

#### 5.4.4.2 mention graph clustering
- [x] **AC16** — page-level qmd vector clustering (cosine similarity ≥ 0.75 임계, alpha default). agglomerative simple. 신규 단위 테스트 ≥ 2 cases (cluster 정상 / 임계 미만).

#### 5.4.4.3 LLM arbitration
- [x] **AC17** — `arbitrate(cluster, 'union' | 'llm', tokenBudget)`. default = `union` (LLM 호출 0). `--arbitration llm` opt-in 시 LLM 호출 + JSON 응답 → ConvergedDecomposition mapper (`arbitration_confidence` 일관 명시). 신규 단위 테스트 ≥ 2 cases (Happy union arbitration_confidence=1.0 / Happy llm arbitration_confidence=0.8).

#### 5.4.4.4 reindex.sh hook
- [x] **AC18** — `scripts/reindex.sh` 마지막에 conditional block (`WIKEY_CONVERGENCE_ENABLED=true` 일 때만, default off). 신규 shell test 또는 mjs test ≥ 1.

#### 5.4.4.5 우선순위 충돌 처리 (`mergeAllSources`)
- [x] **AC19** — 우선순위 chain: user-yaml > suggested > self-declared > converged > runtime > BUILTIN. 같은 umbrella_slug 충돌 시 우선순위 적용. 신규 단위 테스트 ≥ 2 cases.

#### 5.4.4.6 데이터 선결 조건 검증
- [x] **AC20** — `runConvergencePass` 실행 전 mention-history 누적 ≥ 3 표준 × 2 source = 6 instance 검증. 미달 시 skip (사용자 알림). 신규 단위 테스트 ≥ 1.

- [x] **Phase 6 이관 없음** — Phase 6 은 웹 인터페이스 스코프. self-extension 모든 단계는 Phase 5 안에서 완결.
- [x] **종료 조건**: AC15~AC20 모두 GREEN + ≥ 9 신규 cases. §5.4.5 통합 라이브 검증 진입.

### 5.4.5 통합 시나리오 integration test + post-impl review + AC21 라이브 + follow-up 4

> **상세 설계 단일 소스**: [`plan/phase-5-todox-5.4-integration.md §5 AC21/AC22`](./phase-5-todox-5.4-integration.md) v10. **AC21 라이브 1차 책임 = master** (agent-management.md §6 갱신, 2026-04-26 사용자 영구 결정). tester 는 코드/시뮬레이션 (mock fs + mock LLM integration test) 만 담당.
> result mirror: [`activity/phase-5-result.md §5.4.5`](../activity/phase-5-result.md) 4 sub-section (5.4.5.1 시나리오 / 5.4.5.2 codex 6 cycle / 5.4.5.3 AC21 라이브 / 5.4.5.4 follow-up 4).

#### 5.4.5.1 통합 시나리오 integration test
- [x] Scenario 4.1~4.5 — `wikey-core/src/__tests__/stage-integration.test.ts` 7 cases (mock fs + mock LLM). post-impl review Cycle #1~#6 fix 반영 — `cluster-${suffix}` umbrella_slug round-trip 안전 + invalid-slug writer reject + Stage 3 ingest-pipeline wiring + alpha v1 embeddings inject + singleton drop graceful skip. 회귀 721 → 728 PASS.

#### 5.4.5.2 codex post-impl review 6 cycle
- [x] Cycle #1 NEEDS_REVISION (CRITICAL 1 + HIGH 2 + MEDIUM 1) → master fix (HIGH Stage 2 round-trip / HIGH UI Suggestions header / Stage 3 ingest-pipeline wiring / invalid-slug writer reject) — commit 31f3e28
- [x] Cycle #2 NEEDS_REVISION (CRITICAL F4 lingering + MEDIUM F2 lingering) → master fix (alpha v1 embeddings inject wire / accept handler appended:false 처리) — commit c564cd3
- [x] Cycle #3 NEEDS_REVISION (HIGH F4 singleton lingering + LOW stale) → master fix (singleton cluster drop / plan §3.4.3 + convergence.ts 주석 갱신) — commit 0296cc7
- [x] Cycle #4 REJECT (LOW §3.4.2 stale) → master fix (§3.4.2 pseudocode 갱신) — commit 9d15ba5
- [x] Cycle #5 REJECT (LOW §4.1 fresh ingest stale) → master fix (§4.1 시퀀스 다이어그램 갱신) — commit d8f1c78
- [x] Cycle #6 **APPROVE** (Findings: None / regression 731 PASS / exit 0) — commit dc1ee9a

#### 5.4.5.3 AC21 라이브 cycle smoke (master 직접)
- [x] **fixture corpus 6 자료** (master 작성, 옵션 B 자연 ingest 흐름): `raw/0_inbox/integration-cycle-smoke/{pmbok-overview,pmbok-knowledge-areas,iso-27001-overview,iso-27001-annex-a-detail,itil-4-overview,itil-4-practices}.md`. 각 자료 `## 개요` headingPattern + numbered/bullet list ≥ 5 items.
- [x] **6 file ingest cycle smoke**: 6/6 file ingest 완료, mention-history.json 누적 6 ingests, 43 신규 wiki/concepts pages. timing: pmbok-overview 90s / pmbok-knowledge-areas 90s / iso-27001-overview 60s / iso-27001-annex-a-detail 600s timeout (state-machine fallback) / itil-4-overview 120s / itil-4-practices 5s.
- [x] **발견 bug fix CRITICAL** — suggestion-pipeline slug `.md` 확장자 strip (`stripMdExt` helper, `ingestRecordFromCanon` concepts/entities 모두). mention-history 기존 6 ingests slug Python script 로 strip + node 직접 detector 재실행 → 1 suggestion (cluster-management, conf=0.66, support=2, mention=20).
- [x] **UX 옵션 B** — Ingest panel 폴더 평탄화 + 파일 목록만 (사용자 영구 결정): `listInboxFilesRaw()` 재귀 walk + `-type f` + 폴더 list 제외 + name 컬럼 basename + path line classify hint 만.
- [x] **Suggestions panel UI 검증** — header button 등장 (post-impl Cycle #1 F2 fix 라이브 통과) + 1 card "cluster-management 패턴 감지" + Accept round-trip → schema.yaml 신규 entry append (parser regex 일치) + suggestions.json state pending → accepted.
- 결과 문서 [`activity/phase-5-resultx-5.4-integration-cycle-smoke-2026-04-26.md`](../activity/phase-5-resultx-5.4-integration-cycle-smoke-2026-04-26.md) — commit eb4b697.

#### 5.4.5.4 follow-up 4 항목 (사용자 명령 옵션 a "1, 3, 4 모두 본 세션 + 여유 있음 4")
- [x] **§3.5 항목 1 — Stage 3 SelfDeclaration runtime extraction inspect**: 신규 fixture `test-stage3-cobit.md` (COBIT 2019 5 도메인) ingest 50s. console log evidence `stage3 self-declarations — 1 runtime entries`. wiki/concepts 5 신규 (cobit-2019 + cobit-* 4). autoMove 정상. — commit 308bc72
- [x] **§3.6 항목 3 — Suggestions detector umbrella default UX**: `suggestion-detector.ts:170-178` firstWord prefix 추출. PMBOK only ingest 시 firstWords ['project']*N → umbrella `'project-management'` (의미있는 default). mixed 면 fallback 'cluster'. 신규 test 1 case. 731 → 732 PASS. — commit 308bc72
- [x] **§3.7 항목 4 — classify-inbox.sh subfolder 평탄화**: `find -maxdepth 1` → `-type f` 재귀 평탄화. 사용자 영구 결정 옵션 B 와 일관. — commit 308bc72
- [x] **§3.8 항목 2 — Stage 4 라이브 alpha v1 wire 검증**: mock embeddings JSON (59 slug × 1024-dim group axis) → run-convergence-pass.mjs 실행 → 4 ConvergedDecomposition 생성 (project-management-body-of-knowledge / work-breakdown-structure / iso-iec-27001-2022 / itil-4). mjs schema bug fix (`{ version, ingests: [...] }` schema 처리 추가). — commit da42cef

### 5.4.6 종결 회귀 + commits 통계 (mirror activity/phase-5-result.md §5.4.6)

- [x] **회귀 baseline**: 670 → **732 PASS / 38 files / 0 fail** (cd wikey-core && npx vitest run)
- [x] **build**: wikey-core 0 errors / wikey-obsidian 0 errors (npm run build / npx tsc --noEmit)
- [x] **신규 cases 합계**: 62 (Stage 2 = 20 + Stage 3 = 21 + Stage 4 = 10 + integration = 7 + Cycle 후속 = 4)
- [x] **Total commits push (16 commits)**: 9b7da21 → 7e6c2fb (5.4.1 → 5.4.7 + sync v8 정정)
- [x] **보조 문서**: `activity/phase-5-resultx-5.4-integration-cycle-smoke-2026-04-26.md` (master 직접 라이브 cycle smoke 전체 detail).

### 5.4.7 v2 deferral — **다음 세션 첫 액션** (사용자 영구 결정 2026-04-26)

> **fresh session 진입 즉시 첫 cycle 에서 1순위 + 2순위 (UI 수정) 동시 진행**. 3·4순위 는 1·2 완료 후 순차. 별 read 진입점: `plan/session-wrap-followups.md` 의 🎯 섹션 + 본 §5.4.7.

- [x] **1순위 (★ fresh session 첫 작업) — Stage 4 실 qmd embeddings 통합** (2026-04-26 session 14 종결, activity §5.4.8): 다국어 / synonym 자동 통합 인식 (mock 만으로 미검증된 핵심 가치). mini plan = `plan/phase-5-todox-5.4-integration.md §10` (path 결정: Python 기각 — system Python `enable_load_extension` 비활성. **Node.js + better-sqlite3 + sqlite-vec** 채택, isolated `scripts/qmd-export-deps/` 로 wikey-core zero-deps 정책 + tools/qmd Bun ABI 모두 회피).
  - [x] §10.3 단계 1 — `scripts/qmd-embeddings-export.mjs` 작성 (read-only SELECT, Float32 blob 디코딩, chunk 평균, dim sanity check)
  - [x] §10.3 단계 2 — mention-history slug 추출 + qmd DB JOIN export → `.wikey/qmd-embeddings.json` (1.4 MB, **59/59 slug × 1024-dim**, 0 missing)
  - [x] §10.3 단계 3 — `run-convergence-pass.mjs --embeddings .wikey/qmd-embeddings.json` 실행 → `.wikey/converged-decompositions.json` 갱신 (mock 4 → 실 2 ConvergedDecomposition, mock baseline 보관)
  - [x] §10.3 단계 4 — cluster 의미 보존 spot-check: 도메인 내부 (PMBOK 0.59~0.66, COBIT 0.58~**0.91**) ≫ 도메인 간 (0.20~0.36). 한/영 페어 검증은 wiki 한국어 slug 부재로 별 follow-up.
  - [x] §10.6 acceptance — 회귀 baseline **732 PASS 유지** (38 files, 0 fail)
  - [x] activity/phase-5-result.md §5.4.8 신규 + 1순위 [x] mark + commit
  - **alpha v1 wire 한계 발견**: ConvergedDecomposition 의 `components`/`sources` 가 mock 시점에도 0 — alpha v1 wire 는 metadata shell 만 생성. components 채움은 v2 작업 (§5.4.7 3순위 review modal cycle 과 함께 follow-up).
- [x] **2순위 — Suggestions panel UI 개선** (2026-04-26 session 14 종결, activity §5.4.9, mini plan §11): clipboard_check 아이콘 + guide 형식 title + audit 그리드 (Select All + 멀티 row + 상단 패턴명 + 하단 출처) + 하단 고정 버튼 (Accept/Reject 멀티 + Add/Edit in-line) + provider/model bar. ui-designer 위임 없이 master 직접 (사용자 영구 결정).
- [x] **3순위 — Stage 4 ConvergedDecomposition 통합 표시** (2026-04-26 session 14, 2순위와 동일 cycle): 별도 review modal 없이 Suggestions panel 의 row 로 통합 (source badge `wiki`, sourceLabel `wiki (cluster, N sources)`). Accept 시 Stage 2 와 동일 `appendStandardDecomposition` writer 재사용 (Karpathy #2 Simplicity First).
- [x] **4순위 — §5.4 minor follow-up** (2026-04-26 session 14, 2/3순위 통합 cycle): (a) Edit modal 검증 = inline edit 동작으로 자연 통합 / (b) 자료 분류 race = self-resolve scope 외 / (c) "alpha v1 wire components/sources 한계" = 사실 한계 아님 — 1순위 spot-check Python script field 명 오류로 인한 false negative, §5.4.8 정정 반영.

### 5.4.10 미처리 후속 — self-extending 의 진짜 의미 (자동 ontology 확장) 회복 (2026-04-26 session 14 등록)

> **상태**: 미처리. 당장 사용 문제 없음 (현 §5.4.7 종결 panel UI 로 정상 동작). 나중에 또는 다음 세션에 진행 여부 결정.
>
> **★ 사용자 본질 비판** (2026-04-26 session 14, modal tag cloud fix 직후 명시): **"§5.4 의 명명이 self-extending 인데, 진짜는 자동 확장 ontology 개념이어야지. 지금은 수동이잖아 — 표준 분해 그룹을 사용자가 왜 등록하고 관리해야 하는가?"**
>
> 이 비판은 §5.4 architecture 의 약속 (self-extending = 자동 확장) 과 현재 구현 (panel Accept 가 chain 끊음) 의 갭을 정확히 짚음. 사용자 눈에는 "ontology 가 자동 확장 안 하면 self-extending 이 아님" 이 정당.

#### 5.4.10.1 자동/수동 매트릭스 (현재 구현 사실)

| 단계 | 동작 | 자동/수동 |
|------|------|-----------|
| ingest | 자료 → wiki/concepts·entities 페이지 생성 | ✅ 자동 |
| mention 누적 | `.wikey/mention-history.json` | ✅ 자동 |
| Stage 2 detector | mention graph → suggestion 후보 (.wikey/suggestions.json pending) | ✅ 자동 (후보까지) |
| Stage 3 self-declaration | 소스 "표준 개요" 섹션 → runtime SelfDeclaration | ✅ 자동 (runtime, persist X) |
| Stage 4 cluster | qmd embeddings cosine → ConvergedDecomposition (.wikey/converged-decompositions.json) | ✅ 자동 (alpha v1) |
| **schema.yaml 영구 등록** | umbrella + components 등재 | ❌ **panel Accept 수동 (chain 끊는 user gate)** |
| **alias 자동 merging** | "ISO 27001" / "iso-iec-27001-2022" / "ISMS" 한 wiki 페이지 통합 | ❌ **미구현** (현재 각각 별 wiki 페이지) |
| **wiki/concepts/<umbrella>.md** | 그룹 자체의 wiki 페이지 자동 생성 | ❌ **미구현** (component 만 wiki, umbrella 자체 X) |
| **cross-link 자동** | entity ↔ concept ↔ standard 그래프 | △ 일부 (canonicalizer applyCrossLinks Stage 3) |

⇒ schema.yaml 등록 + alias merging + umbrella wiki page = **3 chain break**. 진짜 self-extending 으로 회복 = 본 §5.4.10 의 핵심.

#### 5.4.10.2 사용자 ideal — 자동 ontology

- ingest → LLM 기반 자동 grouping (cluster 결정성 + 자동 등록) → schema.yaml 자동 update
- 같은 ontology 의 다른 표기 자동 merging → 검색 시 통합 결과 (한 wiki 페이지)
- umbrella 자체 wiki 페이지 자동 생성 (group level concept page)
- schema.yaml = internal infra (사용자 노출 X 또는 debug only)
- panel = (가능한 옵션) 폐기 / 조회 only audit / 현재 + audit 강화

#### 5.4.10.3 결정 분기 (panel 자체의 존재 가치)

> 본 §5.4.10 의 자동화 (5.4.10.4) 후 panel 의 의미 재검토.

- **option A — panel 폐기**: 자동 ontology 가 schema.yaml 까지 흐른 후 panel UI 제거. header button (clipboard_check) 제거. schema.yaml 사용자 노출 X 또는 settings tab advanced view 만.
- **option B — 조회 only panel**: schema.yaml 등록 결과 사용자 조회 가치 인정 (debug / transparency). panel = read-only audit. Add/Edit/Accept/Reject 모두 제거.
- **option C — 현재 유지 + audit 강화**: 본 §5.4.10 자동화 + panel 보조 도구로 (오류 케이스 / low-confidence 검토만).

#### 5.4.10.4 ★ 개념 일반화 — "표준 분해 그룹" → "지식 그룹 (knowledge group)" (2026-04-26 사용자 명시)

> **사용자 본질 질문**: "표준 분해 그룹 = 지식 그룹이야?" — 정확히는 표준 분해 그룹 ⊂ 지식 그룹 (좁은 의미 ⊂ 넓은 의미).

| 개념 | 범위 | 예시 |
|------|------|------|
| **표준 분해 그룹** (현재 구현, umbrella) | 외부 표준의 component 분해 — 좁은 의미 | PMBOK 10 areas, ISO 27001 Annex A, ITIL practices |
| **지식 그룹** (사용자 ideal, knowledge group) | 의미적으로 묶이는 모든 지식 단위 — 넓은 의미 | 외부 표준 + 사용자 도메인 (사내 양식) + 자동 cluster (다국어/synonym) + 동일 인물·제품·이론 |

**generalize 영향**:
- schema 변경: `standard_decompositions` → `knowledge_groups` (또는 추가 type field). 외부 표준 / 사용자 도메인 / cluster / synonym 등 type 으로 분류.
- ingest pipeline: 표준 분해 detector 만 아니라 entity dedup (동명이인 / 다국어 표기) / concept synonym (같은 이론 다른 이름) 도 자동 grouping.
- wiki 구조: 그룹 자체의 wiki/concepts/<group>.md 페이지. 그룹 안 component 들이 backlink.
- panel rename: `Suggestions` → `Knowledge groups` 또는 `지식 그룹` (panel 유지 시).

**migration 영향**:
- 기존 schema.yaml 의 `standard_decompositions` 는 호환 (type 미지정 시 default = 'standard-decomposition').
- 사용자가 직접 작성한 schema.yaml 은 그대로 동작. 신규 type 항목은 자동 detector 가 생성.

#### 5.4.10.5 ★★ 더 본질적 통찰 — graph emergent ontology (그룹 abstraction 제거) (2026-04-26 사용자 명시)

> **사용자 본질 통찰**: "wiki 에서 가장 많이 노출되는 게 중심으로 가게 되어 있는데, 굳이 그룹으로 나누어서 제한을 두는게 이상해."

이 통찰은 §5.4 architecture 자체에 대한 근본 비판:
- wiki = mention graph (page = node, wikilink = edge)
- 자연스럽게 mention 빈도 가장 높은 page = 중심 (no need to declare)
- "umbrella" / "표준 분해 그룹" 같은 명시 abstraction = wiki 자연 graph 위 mounted 인위 layer
- 자동 ontology = graph topology 자체에서 emergent — 그룹 명시 정의 불필요

**대안 architecture (graph emergent ontology)**:

| 측면 | 현재 (§5.4 인위 그룹) | 사용자 ideal (graph emergent) |
|------|----------------------|------------------------------|
| ontology 정의 | `.wikey/schema.yaml` 의 `standard_decompositions` 명시 (umbrella + components) | 정의 X — mention graph 자체 |
| 중심 결정 | umbrella_slug 명시 선언 + Accept 흐름 | mention 빈도 / PageRank / community detection 자동 |
| 그룹 형성 | Stage 2 detector + Stage 4 cluster → user Accept → schema 명시 | graph dense subgraph 자동 인식 (lazy, 검색 시점) |
| alias 통합 | umbrella + components.slug 명시 | canonical slug normalization (graph node identity 만, canonicalizer 책임) |
| 검색 | umbrella 매칭 + decompose 분기 | PageRank + 1-hop wikilink expansion (§5.2 에 이미 구현됨) |
| 사용자 노출 | panel UI + schema.yaml | 검색·답변 결과만 (schema 자체 미존재 또는 internal heuristic) |

**implication — §5.4 deprecation 검토**:
- Stage 1 (BUILTIN PMBOK / schema.yaml 외부화) — 일부 보존 (사용자 명시 도메인 정의는 여전히 가치 있음. 사내 양식 / 부서 분류 등 명시적으로 hardcode 필요한 케이스).
- Stage 2 (detector → suggestion) — graph community detection 으로 대체 가능. 별도 schema.yaml 등록 불필요.
- Stage 3 (self-declaration) — graph wikilink 자체로 충분 (page 안 wikilink 가 그룹 신호).
- Stage 4 (cluster) — alias canonicalizer (graph node identity) 로 충분. cluster 명시 schema 등록 불필요.
- panel UI — 폐기 (graph view 가 자연 ontology 시각화) 또는 audit only.

**migration path**:
- 단기: 본 §5.4.7 panel UI 유지. schema.yaml 자동 등록 (5.4.10.5.4) 만 추가.
- 중기: graph community detection 추가. schema.yaml 의 `standard_decompositions` 와 graph 자동 cluster 두 source 병행.
- 장기: schema.yaml `standard_decompositions` deprecate. graph 자체가 ontology source. 사용자 명시 정의 영역만 별 schema (e.g. `aliases.yaml`).

**연계**:
- §5.5 지식 그래프 · 시각화 (NetworkX, Leiden 클러스터링, vis.js / Obsidian Graph View) — 본 §5.4.10.5 의 graph emergent ontology 의 inferred technical foundation. §5.5 진행 시 §5.4 deprecation path 자연 통합.
- §5.2 검색 graph expansion (1-hop wikilink) — 이미 graph emergent 의 일부 구현.

#### 5.4.10.6 ★★★ epistemology 비판 — 지식 분해 모델 자체의 한계 (2026-04-26 사용자 명시)

> **사용자 본질 비판**: "지식을 분해하는 그룹이 글쎄 왜 필요할까? 세상의 수많은 지식을 도대체 어떻게 나누어서 표준화 할라고?"

이 비판은 §5.4 architecture 의 epistemology 가정 자체에 대한 근본 회의:

| 가정 (§5.4) | 현실 (사용자 통찰) |
|------------|------------------|
| 지식 = decomposable (그룹 → components) | 지식 = relational (다차원 graph). 깔끔한 분해 불가능 |
| 모든 지식이 PMBOK 같은 component 구조 | PMBOK / ISO 27001 / ITIL 같은 **이미 그룹 정의된 외부 표준**에만 fit. 일반 자료 (잡지·메모·임의 PDF) 에는 부적절 |
| 표준화로 ontology 완성 | 세상 지식은 무한 차원·끝없이 다양. 표준화는 부분 분류 — 모든 지식 cover 불가 |
| self-extending = 그룹 자동 추가 | 진짜 self-organizing = graph 자체가 emergent. 그룹 명시 X |

⇒ §5.4 의 "표준 분해" = **외부 정형 표준에만 적용 가능한 reductionism**. 일반 지식에는 mismatch.

**wikey 의 진정한 가치 (사용자 통찰 기반)**:
- mention graph (entity ↔ concept ↔ source 자연 wikilink) = relational ontology
- 의미 search (LLM 답변 + qmd embedding) = 그룹 의존 없이 정확 retrieval
- canonical slug normalization (alias dedup) = graph node identity 만 — *그룹화 X*
- mention 빈도 / PageRank / community detection = lazy emergent center

#### 5.4.10.7 paradigm shift 제안 — §5.4 → §5.5 graph

| 폐기 / deprecate | 유지 / 강화 |
|------------------|------------|
| `standard_decompositions` schema.yaml 모델 (현재 §5.4 본체) | mention graph (entity ↔ concept ↔ source 자연 wikilink) |
| umbrella + components 명시 분해 | canonical slug normalization (alias dedup 만, graph node identity) |
| "self-extending" 명명 (오해 야기 — 그룹 자동 추가로 해석) | "self-organizing graph" 또는 "emergent ontology" |
| panel Suggestions UI (현재) | (선택) graph view (Obsidian Graph View 또는 §5.5 NetworkX 시각화) |
| Stage 2/3/4 schema.yaml 등록 chain | Stage 2/3/4 → graph community detection 자동 cluster (lazy, 검색 시점) |
| 사용자 Accept gate | 자동 (graph 가 자연 형성, 명시 등록 X) |

**migration 옵션**:
- **A (점진)**: 본 §5.4.7 panel UI 유지 + §5.4.10.5 자동화 만 추가 + §5.5 graph 시각화 추가. schema.yaml 은 보조 (외부 표준 PMBOK 등 explicit case 만 hardcode).
- **B (paradigm shift)**: schema.yaml `standard_decompositions` 영역 deprecate. §5.5 graph 가 ontology source. canonicalizer (alias dedup) 만 보존. panel 폐기.
- **C (관망)**: 본 §5.4.10 자체 보류. 사용자가 §5.4 본체 (PMBOK 명시 분해) 만 사용. 일반 지식은 §5.2 검색 graph expansion + LLM 답변에 의존.

**기록 책임 (epistemology 비판)**:
- 본 §5.4.10.6/7 = 사용자 philosophy 의 정식 기록. §5.4 self-extending 의 fundamental gap 인정.
- 진행 결정 = 다음 세션 사용자 명시. 옵션 A/B/C 중 선택 + 본 §5.4.10 진행 여부.

#### 5.4.10.8 자동화 task (단기 — self-extending 의 chain break 부분 제거, 옵션 A 시)

- [ ] **(★ 1순위 의문) panel 자체의 존재 가치 재검토**: 사용자 의문 — "표준 분해 패턴을 사용자가 왜 등록/관리해야 하는가? 너무 엔지니어링 사고, 내부 자동 처리만 있으면 됨." 결정 분기:
  - **option A — panel 폐기**: 표준 분해는 internal infra 만. 사용자 노출 X. ingest pipeline 자동 등록 + audit log internal. panel UI / `.wikey/schema.yaml` 사용자 노출 X (또는 settings tab 안 advanced view 만). header button (clipboard_check) 도 제거.
  - **option B — 조회 only panel 유지**: schema.yaml 등록 결과 사용자 조회 가치 인정 (debug / transparency). panel = read-only audit. Add/Edit/Accept/Reject 모두 제거. 자동 등록 결과 + 오류 케이스 표시만.
  - **option C — 현재 유지 + audit 강화**: 본 §5.4.10 의 나머지 항목들 (ingest 자동 등록 + threshold split + audit log) 진행, panel 보조 도구로.
- [ ] **ingest pipeline → schema.yaml 자동 등록 (high-confidence)**: 현재 Stage 2 detector → `.wikey/suggestions.json` (pending) → panel Accept 흐름. 사용자 의도 = ingest 단계에서 confidence ≥ threshold (예: 0.85) 후보를 schema.yaml 에 직접 append. 사용자 Accept 우회. `appendStandardDecomposition` 를 ingest pipeline 에서 직접 호출 path 추가.
- [ ] **Confidence threshold split**: 두 단계 — high (자동 schema.yaml 등록) / low (panel 후보 표시 = 사용자 검토). user setting 으로 threshold 조정 가능 (`wikey.conf` 또는 plugin settings).
- [ ] **자동 등록 audit log**: `.wikey/standard-audit.json` 신규. 자동 등록 이력 trace — 어떤 후보가 어떤 confidence 로 어떤 ingest event 에서 등록됐는지. 사용자가 추후 review 가능.
- [ ] **panel rename**: `Suggestions` → `Audit` 또는 `표준 audit` (사용자 의도 정확 반영). icon (`clipboard_check`) 도 audit 컨셉 적합 검토. header button label / panel title / modal title 모두 일관.
- [ ] **audit-only UI (Add/Edit 더 깊이 숨김)**: 본 cycle 의 secondary 약화 다음 단계 — Add/Edit 을 footer 작은 link 또는 plugin settings tab 으로 이동. 일반 사용자는 거의 안 씀. 진정한 예외 (오류 직접 수정 / 누락 표준 추가) 만.
- [ ] **오류 케이스 audit 표시**: ingest 시 자동 등록 실패 (parser invalid slug / append 충돌 / 형식 위반 등) 항목을 panel 에 별도 row 로 표시 (warning badge). 사용자가 직접 fix → 등록.
- [ ] **자동 / 수동 구분 시각화**: schema.yaml 의 `origin` 필드 (suggested / manual / converged / builtin) 를 panel 조회 시 색상 / icon 으로 구분.
- [ ] **threshold tuning**: 자동 등록 후 false positive (사용자가 schema.yaml 에서 직접 제거) 발생 시 threshold 자동 상향 (자가 학습 — 별 P3 sub-cycle).
- [ ] **이관 plan 작성**: 본 §5.4.10 mini plan 진입 시 `plan/phase-5-todox-5.4-audit-automation.md` 신규 작성 — 본 todo 의 acceptance 별 detail spec.

**연계**:
- 본 §5.4.10 = §5.4 self-extending 의 **자동성 phase**. §5.4.1~9 가 본체 (Stage 1~4 + integration + UI) + §5.4.10 이 자동화 완성.
- 본 §5.4.10 의 audit log 는 §5.4.7 deferred 의 "오류로 등록 안 된 항목만 audit panel 에 표시" 와 정확히 매핑.
- ingest pipeline 변경 = `wikey-core/src/ingest-pipeline.ts` Stage 2 detector 호출 부분 + `appendStandardDecomposition` 직접 호출 path 추가.

**현재 §5.4.7 cycle 안 부분 반영 (사용자 design philosophy 의 panel UI 차원)**:
- Add/Edit 버튼 secondary 스타일 (작고 muted, 우측 정렬) — 사용 자제 시각화
- modal intro 톤 = "조회 위주, Add/Edit 은 예외 케이스" 명시
- modal help button (?) → 충분한 설명 (조회/등록/규칙/팁) 자동 제공
- search input + 자동 필터 (1000+ scaling)
- 기등록 자동 hide (panel 깔끔)
- schema 안내문 + link (조회 흐름 강화)

**기록 책임**: 본 §5.4.10 = phase-5-todo 의 P2 항목. 진입 시 phase-5-todox-5.4-audit-automation.md 신규 + activity §5.4.10 신규.

**연계**:
- Phase 4 §4.3.2 Provenance tracking (본체) — Stage 3 의 self-declaration 오염 제어 장치로 직접 필요.
- Phase 4 §4.2.2 URI 기반 안정 참조 (본체) — Stage 4 convergence 가 여러 소스의 canonical 참조를 필요로 함.
- `wiki/analyses/self-extending-wiki.md` — 이 §5.4 의 철학을 wiki 본체에 정식 analysis 로 기록한 페이지. 본체 진실이며, 본 todo 는 실행 단위 분해.

**기록 책임** (drift 방지):
- 본 §5.4 가 실행 로드맵 단일 소스.
- 철학/가치 선언의 단일 소스: `wiki/analyses/self-extending-wiki.md`.
- 포인터만 두는 위치: `wikey-core/src/canonicalizer.ts` 작업 규칙 #7 위 주석, `activity/phase-4-result.md §4.5.1.7.2` "일반화 경로" 단락, `plan/session-wrap-followups.md`, `memory/project_phase4_status.md` / `memory/project_phase5_status.md`.

---

## 5.5 지식 그래프 · 시각화 (P3)
> tag: #main-feature, #utility
> **이전 번호**: `was §5.2`.

> **배경**. 본체 완성 후 wiki 관계 그래프 시각화 · 코드 소스 AST 파싱 등 사용자 대상 부가 가치 기능. Phase 4 §4.4.2/§4.4.3 에서 이관.

### 5.5.1 지식 그래프 (NetworkX)

- [ ] entity/concept 간 관계를 그래프로 구축
  - wiki/entities, wiki/concepts 의 위키링크를 edge 로 변환
  - vis.js 또는 Obsidian Graph View 연동
  - 클러스터링: Leiden 알고리즘 (graspologic) 기반 토픽 그룹핑
- [ ] graph.json 출력 — 영속 그래프 데이터
- [ ] graph.html — 인터랙티브 시각화 (vis.js)
- [ ] GRAPH_REPORT.md — god nodes, 핵심 연결, 추천 질문
- [ ] **wiki 재생성 없음 확증**: wiki/ 읽기 전용, 신규 산출물만 생성

### 5.5.2 AST 기반 코드 파싱

- [ ] 코드 파일은 LLM 없이 tree-sitter 로 구조 추출
  - 함수/클래스/import 관계 자동 매핑
  - 지원 언어: Python, JS/TS, Go, Rust, C/C++
- [ ] 프로젝트 코드베이스도 위키로 관리 가능
- [ ] 코드 변경 시 AST diff 로 영향 범위 자동 감지
- [ ] **wiki 재생성 없음 확증**: 신규 소스 타입 추가 경로, 기존 wiki 무관

---

## 5.6 성능 · 엔진 확장 (P3)
> tag: #infra, #engine
> **이전 번호**: `was §5.5`.

> **배경**. 로컬 추론 엔진 교체 PoC + 플랫폼 OCR fallback 실측. Phase 4 §4.5.3/§4.5.4 에서 이관.

### 5.6.1 llama.cpp PoC (←§4.5.3)

- [ ] **Ollama vs llama.cpp 실측 gap 측정** — M4 Pro 48GB 환경에서 동일 Qwen3.6:35b-a3b GGUF 로 비교
  - Ollama 0.20.5 (MLX 백엔드) vs `brew install llama.cpp` + `llama-server`
  - 동일 section · 프롬프트로 latency/토큰/메모리 실측 (wikey 의 SEGMENTED Route 가 section 단위 LLM 호출이므로 측정도 section 기준)
  - 커뮤니티 측정치: 단일 요청 10~30% overhead (Go 런타임 + HTTP 직렬화)
  - wikey 는 단일 사용자 + 순차 section 호출 → 동시요청 3x gap 해당 없음
  - **판정 기준**: 실측 gap ≥15% 면 전환, 미만이면 Ollama 유지
- [ ] **전환 시 통합 경로**
  - `llama-server` 는 OpenAI-compat API 제공 → `wikey-core/llm-client.ts` 에 `llamacpp` provider 추가
  - `llama-swap` (Go proxy) 로 모델 auto-load/unload → Ollama 스타일 UX 재현
  - GGUF 파일 직접 관리 (모델 경로 설정 UI 추가)
- [ ] 장점: 속도↑, 세밀한 양자화 제어 (IQ2~BF16, Unsloth Dynamic 2.0), 백그라운드 데몬 불필요
- [ ] 단점: 모델 스와핑 별도 도구 필요, provider 분기 재작성, GGUF 수동 다운로드

### 5.6.2 rapidocr (paddleOCR PP-OCRv5 Korean) fallback 실측 — Linux/Windows 환경 (←§4.5.4)

> **배경**. Phase 4 §4.1.3 에서 `defaultOcrEngine()` + `defaultOcrLangForEngine()` 로 platform 별 engine/lang 자동 매핑 등록 완료. macOS → ocrmac + `ko-KR,en-US`, Linux/Windows → rapidocr + `korean,english`. 코드 레벨은 등록됐으나 **macOS 세션에서 rapidocr 실제 OCR 품질 검증 불가**. Linux 환경에서 실측 필요.

- [ ] **§5.6.2.1** Linux 환경 준비
  - `uv tool install "docling[rapidocr]"` — rapidocr-onnxruntime extras 포함 설치
  - 테스트 환경: Ubuntu 22.04 또는 Docker (wikey-core 실행)
  - 기본 rapidocr 모델: Chinese + English (paddleOCR 기본 탑재). Korean 은 별도 모델 로드 필요할 가능성

- [ ] **§5.6.2.2** rapidocr + `korean,english` CLI 실측
  - 명령: `docling <test.pdf> --to md --output /tmp --ocr-engine rapidocr --ocr-lang korean,english --force-ocr`
  - 테스트 코퍼스: CONTRACT (용역계약서, 한글 OCR 난도 높음), GOODSTREAM (사업자등록증)
  - 검증: rapidocr 가 `korean` lang 지정을 실제로 받아들이는지. 안 받으면 `--ocr-engine easyocr --ocr-lang ko,en` 대안 검토

- [ ] **§5.6.2.3** PP-OCRv5 Korean 모델 수동 로드 (skill 권고 경로)
  - docling skill 문서 `~/.claude/skills/docling/reference/korean-ocr-advanced.md` 의 PaddleOCR PP-OCRv5 Korean 전환 가이드
  - CLI 로는 불가 — Python API (`RapidOcrOptions(rec_model_path=...)`) 경로
  - Korean 가중치 다운로드 (`huggingface_hub: PaddlePaddle/korean_PP-OCRv5_mobile_rec`)
  - `scripts/benchmark-tier-4-1-3.mjs` 를 Python 호출 방식으로 확장하거나 별도 `scripts/ocr-python-api.py` 헬퍼 추가

- [ ] **§5.6.2.4** macOS ocrmac vs Linux rapidocr 품질 비교 (CONTRACT·GOODSTREAM)
  - 동일 PDF 에 대해 두 engine 결과 비교: 한글 자수, OCR 오류 건수, 본문 구조 정확도
  - ocrmac 대비 rapidocr 품질이 충분 (80%+) 하면 production fallback 으로 등록
  - 부족하면 Linux 환경에서는 `markitdown[pdf]` + OpenAI Vision fallback (tier 2/3) 경로 고려

- [ ] **§5.6.2.5** 결과 기록 + fallback 매트릭스 문서화
  - `activity/phase-5-resultx-5.6-rapidocr-linux-<date>.md` 신규
  - `~/.claude/skills/docling/reference/korean-ocr-advanced.md` 에 실측 갱신 (커뮤니티 consensus 와 일치 여부)

---

## 5.7 운영 인프라 포팅 (P4)
> tag: #utility, #infra
> **이전 번호**: `was §5.7` (번호 유지).

> **배경**. Phase 3 에서 이관된 우선순위 낮은 리팩토링 항목. 동작 유지하면서 구현만 개선. Phase 4 §4.5.2 에서 이관 (삭제 안전장치 + 초기화는 본체 남김).

### 5.7.1 bash→TS 완전 포팅

- [ ] `validate-wiki`, `check-pii`, `cost-tracker`, `reindex` 를 TypeScript 구현으로 포팅
- [ ] 현재 exec 래퍼로 안정 동작 중 → 우선순위 낮음
- [ ] 이점: 크로스 플랫폼, 타입 안전성, 테스트 용이성
- [ ] **wiki 재생성 없음 확증**: 동작 동일성 유지, 실행 경로만 교체

### 5.7.2 qmd SDK import

- [ ] CLI exec → 직접 import 로 전환 시 지연 감소 + 에러 처리 개선
- [ ] 현재 vendored CLI 구조라 난이도 높음
- [ ] 후속 전환 경로: qmd JS/TS 바인딩 확보 또는 RPC 게이트웨이
- [ ] **wiki 재생성 없음 확증**: 인덱스 소비 방식만 변경, 데이터 그대로

---

## 5.8 Phase 4 D.0.l 이관 과제 — 잔여 (P4)
> tag: #pii, #classify, #reindex, #phase4-handover
> **이전 번호**: `was §5.8` — 일부 이관·완료 반영해 재정리.

> **배경**. 2026-04-24 session 8 D.0.l smoke 재실행에서 파이프라인·운영 안전 확증 / wiki body PII 전파 2건 발견. 본 섹션은 smoke README `activity/phase-4-resultx-4.6-smoke-2026-04-24-v2/README.md` §이관 과제 테이블을 단일 소스화. 사용자 방침: **"PII 관련 하드코딩은 안된다"** (2026-04-24).

### 5.8.0 세션 8 완료 요약 (참조용)
> tag: #done, #summary

2026-04-24 session 8 에서 다음 3건은 완료 또는 재배치됨:

- **(완료) C-A1 filename PII sanitize**: `sanitizeForLlmPrompt(text, { guardEnabled }, patterns)` 단일 진입점 신규. `ingest-pipeline.ts::ingest()` + `generateBrief()` 모두 LLM 호출 전 filename sanitize 적용. `brn-hyphen` 패턴도 `\b` → `(?<!\d)...(?!\d)` 로 `_` word-boundary 케이스 커버. 유닛 테스트 4종. 이전 todo: §5.8.1.
- **(부분 완료) C-A2 CEO 이름 공백 변형 (단일 라인)**: default `ceo-label` 패턴 capture 그룹을 `[가-힣](?:[ \t]*[가-힣]){1,3}` 로 확장 (줄바꿈은 금지 — cross-line 오탐 방지). 이전 todo: §5.8.2. **잔여** (multi-line 폼) 은 §5.1 로 승격.
- **(이관) 구조적 PII 탐지**: 이전 §5.8.6 → 우선순위 재조정으로 §5.1 (P0) 으로 승격.

### 5.8.1 W-A3 동명이인 romanization dedup (Med)
> tag: #pii, #dedup
> **이전 번호**: `was §5.8.3`.

- [ ] 문제: 같은 이름이 romanize 단계에서 variance 로 중복 entity 생성 (`kim-myeong-ho.md` vs `kim-myung-ho.md`).
- [ ] 해결 방향: canonicalizer dedup 로직 강화 — 한국어 원본 이름 기준으로 canonical key 생성, romanization variance 허용. PII 룰 엔진과 별개이나 같은 ingest path 에 위치.

### 5.8.2 W-B1 file 6 classify 2차 분류 variance (Low)
> tag: #classify, #variance
> **이전 번호**: `was §5.8.4`.

- [ ] 문제: Pass A 는 `20_report/000_general`, Pass B 는 `60_note/000_general` — LLM reasoning 수준의 non-determinism.
- [ ] 해결 방향: CLASSIFY.md 가이드 강화 (기준 명확화), 혹은 LLM prompt stability 개선. tier/분류 1차 depth 6/6 일치는 이미 PASS 이므로 우선순위 낮음.

### 5.8.3 W-C1 reindex --quick non-fatal exit=1 → §5.2.9 로 승격, 동일 issue (2026-04-25, alias closed)
> tag: #reindex
> **이전 번호**: `was §5.8.5`.
> **2026-04-25 status**: §5.2.5 cycle smoke 가 본 issue 정확 재현 + "사용자 UX 영향 없음" 가정 무효 확증 (검색 freshness 직격). **§5.2.9 로 승격, 본 항목은 alias**.

---

## 5.9 Variance 기여도 · Diagnostic (P4)
> tag: #eval
> **이전 번호**: `was §5.4`.

> **배경**. §4.5.1.7.2/§4.5.1.7.3 본체 실측 이후 잔여 variance 의 기여 구조 분리 + Ollama production guide + axis 정리 cosmetic. 본체 CV 10% 미만 확보 후 선택적 실행. Phase 4 §4.5.1.7.1/.7.4/.7.6/.7.7 에서 이관.

### 5.9.1 Variance 분해 4-points ablation (←§4.5.1.7.1)

- [ ] point A: all-off (baseline §4.5.1.5 24.3%)
- [ ] point B: determinism-only (`WIKEY_EXTRACTION_DETERMINISM=1`, SLUG_ALIASES/FORCED_CATEGORIES §4.5.1.4 원본 복구)
- [ ] point C: canon-only (alias + pin 최신, determinism=off)
- [ ] point D: all-on (§4.5.1.6 = 9.2%)
- [ ] 산출: A/B/C/D 4 CV 값 + 단일-레버 기여분 (B-A, C-A, D-B 차)
- [ ] 구현 노트: canon off 는 `WIKEY_CANON_V3_DISABLE=1` 같은 env 신규 + canonicalizer.ts 의 v3 entry bypass (v2 유지)

### 5.9.2 Route SEGMENTED 10-run baseline (Ollama) (←§4.5.1.7.4)

- [ ] 전제: Ollama 설치 + qwen3:8b 모델 pull. `WIKEY_BASIC_MODEL=ollama`
- [ ] SEGMENTED Route 강제 (Ollama 32K context → 자동 SEGMENTED)
- [ ] determinism=on 10-run CV 측정
- [ ] 가설: SEGMENTED CV > FULL CV (섹션별 호출 간 variance 누적). production 권장 configuration 결정 근거

### 5.9.3 BOM 축 재분할 판단 (←§4.5.1.7.6)

- [ ] 현재 §4.5.1.6.3: `e-bom`/`engineering-bill-of-materials`/`electronic-bill-of-materials`/`e-bill-of-materials` → `bill-of-materials` 일괄 collapse
- [ ] 실무: eBOM (Engineering, 설계 단계) vs mBOM (Manufacturing, 제조 단계) 은 다른 문서
- [ ] 판단 기준: wiki 가 BOM 을 참조하는 다른 소스 인제스트 시 eBOM/mBOM 을 구별해서 언급하는지 모니터. 월 1 회 lint 에서 확인
- [ ] 재분할 결정 시 canonical 3 개 (`bill-of-materials`, `engineering-bom`, `manufacturing-bom`) + alias 재구성

### 5.9.4 `log_entry` axis 불일치 수정 (cosmetic) (←§4.5.1.7.7)

- [ ] canonicalizer.ts `assembleCanonicalResult` 의 `logEntry: raw.log_entry` 는 LLM 원본. FORCED_CATEGORIES 로 이동된 slug 는 파일 위치 ↔ log 문구 엇갈림
- [ ] 수정: pin 후 `pinned.entities` + `pinned.concepts` 로부터 결정적 log body 재생성. 기존 wiki-ops.ts `appendLog` 패턴 참조
- [ ] TDD: pin 으로 axis 가 바뀐 slug 의 log 엔트리가 "엔티티 생성" → "개념 생성" 으로 올바르게 전환

---

## 5.10 Graph emergent ontology — §5.4 paradigm shift (P1, ★ 사용자 본질 비판 2026-04-26 session 14)
> tag: #ontology, #architecture, #paradigm-shift, #self-extending, #graph

> **배경**: §5.4 self-extending 구현 (Stage 1~4) 완료 후 panel UI 라이브 검증 중 사용자가 §5.4 architecture 자체에 대한 본질 비판 5건 chain 명시. 본 §5.10 = 그 비판의 정식 이슈화 (큰 작업 main subject 격상). §5.4.10 (sub) 의 내용을 본 §5.10 으로 promote.
>
> **사용자 본질 비판 chain**:
> 1. "표준 분해 패턴을 왜 등록·관리해야 하나? 너무 엔지니어링적 사고."
> 2. "self-extending 인데 진짜는 자동 확장 ontology 개념이어야지. 지금은 수동."
> 3. "표준 분해 그룹 = 지식 그룹? 표준 분해 그룹 ⊂ 지식 그룹."
> 4. "wiki 가장 많이 노출되는 게 중심으로 — 굳이 그룹으로 나눠 제한 두는 게 이상해."
> 5. "지식 분해하는 그룹이 왜 필요? 세상 수많은 지식을 어떻게 표준화?"

### 5.10.1 issue 요약 (정식 이슈화)

| 측면 | 현 §5.4 self-extending | 사용자 ideal (graph emergent) |
|------|----------------------|---------------------------|
| 모델 | 지식 = decomposable (그룹 → components) | 지식 = relational (graph) |
| 적용 범위 | PMBOK / ISO 27001 같은 외부 정형 표준만 fit | 모든 지식 일반 (잡지·메모·임의 PDF) |
| ontology 결정 | schema.yaml 명시 (umbrella + components) | mention graph 자체가 ontology source |
| 등록 chain | 사용자 Accept gate (수동) | 자동 (graph 형성 자체) |
| naming | "self-extending" (오해 야기) | "self-organizing graph" / "emergent ontology" |

### 5.10.2 결정 분기 (다음 세션 사용자 명시)

> **사용자 추가 통찰** (2026-04-26 session 14): "굳이 어려운 말 써가면서 지식을 분류할 필요 없잖아. LLM 이라는 든든한 백 위에서 움직이는 건데." → 옵션 D 추가. 가장 사용자 mental model 에 가까움.

- **A (점진)**: 본 §5.4 panel UI 유지 + §5.10.3 자동화 만 추가 + §5.5 graph 시각화 추가. schema.yaml 보조 (외부 표준 명시 case 만).
- **B (paradigm shift, graph emergent)**: schema.yaml `standard_decompositions` 영역 deprecate. §5.5 graph 가 ontology source. canonicalizer (alias dedup) 만 보존. panel 폐기 또는 graph view 로 교체.
- **C (관망)**: 본 §5.10 자체 보류. §5.4 본체 (PMBOK 명시 분해) 만 사용.
- **★ D (LLM-only, ontology layer 제거)**: §5.4 self-extending 전체 deprecate (Stage 1~4 모두). LLM + qmd embedding 백이 의미 처리 일임. wikey 는 raw → wiki organization + retrieval interface 만. 본 옵션이 사용자 통찰 가장 정확 반영.

#### 5.10.2.D 옵션 D 상세 (LLM-only architecture)

> **사용자 mental model**: LLM 시대의 ontology 시대착오. 전통 ontology (umbrella / decomposition / components / RDF / OWL / Schema.org) = pre-LLM (~2020) reductionist approach. LLM 시대 = 의미 추론 백에서 자동 (예: "ISO 27001" / "iso-iec-27001-2022" / "ISMS" 가 같은 개념임을 LLM 이 이미 인식). schema 명시 = 인위 layer.

**wikey 의 LLM-백 위 layer 정의** (옵션 D 시):
1. raw → wiki organization (자료 인입 + 분류 + 페이지 생성) — 사용자 가치 명확
2. canonical slug normalization (minimal — file hash 기준 dedup, alias 다국어 / 동명이인 정도만)
3. LLM 자연 retrieval (qmd embedding + LLM 답변)
4. 사용자 interface (chat / dashboard / search / settings)

**deprecate 대상** (옵션 D):
- §5.4 Stage 1~4 (self-extending 전체)
- `standard_decompositions` schema 모델
- `.wikey/schema.yaml` 의 standard_decompositions 영역 (alias / PII / custom-types 는 보존)
- `.wikey/suggestions.json` (Stage 2 store)
- `.wikey/converged-decompositions.json` (Stage 4 store)
- `.wikey/mention-history.json` (단 §5.5 graph 시각화 retention 시 보존)
- panel Suggestions UI (header button + sidebar-chat.ts 의 §11 코드 모두 + SchemaYamlModal)
- canonicalizer.ts 의 Stage 1 schema override 로직 (BUILTIN_STANDARD_DECOMPOSITIONS 포함)

**유지** (옵션 D):
- canonicalizer.ts 의 minimal alias normalization (slug → canonical-slug, 동명이인·다국어·약어)
- §5.2 검색 graph expansion (1-hop wikilink) — 단순 wikilink 그래프, ontology layer X
- qmd embedding + LLM 답변 (§5.2 핵심)
- raw → wiki organization (Stage 0 ingest pipeline 의 wiki write)
- entity / concept 페이지 생성 (canonicalizer LLM 추출, schema 명시 없이)

**migration cost** (옵션 D):
- 약 30~50 file 변경 (Stage 1~4 코드 + test + plan + schema)
- §5.4 cycle 의 732 PASS 중 ~100 test 폐기 또는 deprecate (Stage 1~4 unit + integration)
- 회귀 risk: §5.4 가 §5.2 (canonicalizer cross-link) / §5.3 (incremental reingest) 와 직접 dependency 약함 — 분리 가능
- migration script 1 회: 기존 schema.yaml standard_decompositions → `manual-overrides.yaml` (사용자 명시 hardcode 만 보존)

**옵션 D 정당성** (사용자 통찰 기반):
- LLM 백이 의미 처리 자동 → 인위 ontology layer redundant
- 사용자 인지 부담 (panel / schema / Add/Edit/Accept/Reject) 0 → "사용자가 거의 안 써도 됨" design philosophy 완전 실현
- 코드 단순화 → maintenance cost 감소
- §5.4 self-extending 명명 자체 폐기 → naming confusion 해결

**옵션 D 후속 검토** (옵션 D 채택 시):
- §5.5 (graph 시각화) — graph 가 ontology source 가 아니라 *시각화 도구* 로만 유지. 사용자가 wiki 관계 보는 보조 UI.
- §5.6 / §5.7 / §5.8 / §5.9 — 영향 없음, 그대로 진행.

### 5.10.3 작업 단위 (옵션 A 시 — 가장 가벼운 path)

- [ ] **자동/수동 매트릭스 chain break 3 fix**:
  - schema.yaml 등록 자동화 (ingest 시 high-confidence 후보 직접 append, panel Accept 우회)
  - alias 자동 merging (canonicalizer 강화 — 같은 표준의 다른 표기 한 wiki 페이지 통합)
  - umbrella 자체 wiki 페이지 자동 생성 (group level concept page)
- [ ] **자동 등록 audit log** (`.wikey/standard-audit.json`): 자동 등록 이력 trace.
- [ ] **panel rename**: `Suggestions` → `Knowledge audit` 또는 `지식 audit` (audit 컨셉 일치).
- [ ] **threshold split**: high-confidence 자동 / low-confidence panel review.
- [ ] **자동 / 수동 구분 시각화**: schema.yaml `origin` 필드 (suggested / manual / converged / builtin / auto-ingested) 색상 / icon 구분.

### 5.10.4 작업 단위 (옵션 B 시 — paradigm shift, 큰 작업)

- [ ] **§5.4 본체 deprecation 결정**: `standard_decompositions` schema 모델 폐기. 외부 표준 명시는 별 schema (`aliases.yaml` 또는 `manual-overrides.yaml`) 로 분리.
- [ ] **§5.5 graph 시각화 → ontology source 격상**: NetworkX + Leiden community detection 이 자연 cluster 발견. mention graph 가 primary ontology.
- [ ] **canonicalizer alias dedup 강화**: canonical slug normalization 로직 강화 (다국어 / synonym / 동명이인 / 모델 변형 모두 graph node identity 통합).
- [ ] **검색 PageRank 통합** (§5.2 확장): 1-hop wikilink 외에 PageRank-like ranking 으로 자연 중심 search 결과 정렬.
- [ ] **panel UI 폐기 또는 graph view 교체**: header button 제거 또는 graph 시각화 panel 으로 대체.
- [ ] **migration script**: 기존 schema.yaml `standard_decompositions` → `manual-overrides.yaml` (외부 표준 명시 hardcode 만 보존).
- [ ] **wiki/concepts/<umbrella>.md 자동 생성**: graph cluster center 가 자체 wiki 페이지 — 그룹 명시 schema 없이 graph 관계만으로.

### 5.10.5 epistemology 비판 (영구 기록)

> **사용자 명시**: "지식 분해하는 그룹이 왜 필요? 세상 수많은 지식을 어떻게 표준화?"

§5.4 의 "표준 분해" = **외부 정형 표준에만 적용 가능한 reductionism**. 일반 지식 (잡지·메모·임의 자료) 에는 mismatch. wikey 의 *진정한* 가치 = mention graph (relational) + 의미 search (LLM/embedding) — 그룹 분해 X.

본 §5.10 의 epistemology 정당화는 다음 세션 사용자 결정 (옵션 A/B/C) 시점에도 보존.

### 5.10.6 보조 plan 문서

- [ ] `plan/phase-5-todox-5.10-graph-emergent-ontology.md` — 본 §5.10 진입 시 detail spec. migration script + canonicalizer 강화 + graph community detection 알고리즘 + 검색 PageRank 통합 + panel rename / 폐기 결정 로직.
- [ ] `activity/phase-5-result.md §5.10` — 진행 시 timeline + 결정 분기 (A/B/C) + 산출.

### 5.10.7 연계 / dependency

- §5.5 지식 그래프 · 시각화 (NetworkX + Leiden + vis.js) — 본 §5.10 paradigm shift 의 inferred technical foundation. §5.10 진행 시 §5.5 와 통합.
- §5.4 self-extending — 본 §5.10 의 deprecation 또는 보존 대상. 옵션 A/B/C 결정에 따라 §5.4 의 향후 위치 변동.
- §5.2 검색 graph expansion (1-hop wikilink) — graph emergent 의 일부 구현. 본 §5.10 옵션 B 시 PageRank 까지 확장.
- canonicalizer.ts — alias dedup 강화의 단일 진입점. 본 §5.10 옵션 B 의 핵심 수정 대상.

### 5.10.8 진행 권장 시점

- 즉시 진행 X (사용자 결정 대기). 다음 세션 시작 시 옵션 A/B/C 명시 후 진입.
- 본 §5.10 = main subject. §5.4.10 sub-section 의 내용 ⊂ 본 §5.10. §5.4.10 는 promote pointer 로 짧게 유지 또는 본 §5.10 으로 통합.
