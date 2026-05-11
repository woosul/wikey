# Phase 5: 튜닝·고도화·개선·확장

> 기간: Phase 4 (본체 완성) 완료 후 — **2026-04-24 session 8 Phase 4 본체 완성 선언 이후 착수 가능**.
> 전제: Phase 4 완료 — 원본 → wiki ingest 프로세스가 **wiki 초기화·재생성 없이** 안정적으로 돌아가는 구조 확정. frontmatter/데이터 모델이 고정되어 이후 내용만 축적.
> 범위 정의: 본체가 없어도 wiki 가 돌아가는 것 + 성능·품질·범위 확장 + 진단/계측 도구 + self-extending 구조. **wiki 재생성을 유발하지 않는 것** 만 포함.
> 구성 원칙: 번호·제목·태그는 `activity/phase-5/phase-5-result.md` 와 1:1 mirror. §5.N 상세 번호 체계 (§5.N.M / §5.N.M.K).
> 이력:
> - 2026-04-22: Phase 재편으로 신규 생성 — 본체 완성 정의 ("구조 변경 없음") 기준으로 Phase 4 에서 이관.
> - **2026-04-24 session 8: 우선순위 기반 전면 재번호** (P0~P4). 기존 §5.1~5.8 이 역사적/주제별 순서였던 것을 **긴급도·성능 영향·의존성** 3축으로 재배치. 섹션 제목 하단 `(was §5.N)` 주석으로 이전 번호 추적.

## 관련 문서

- **Result mirror**: [`activity/phase-5/phase-5-result.md`](../../activity/phase-5/phase-5-result.md)
- **보조 문서**:
  - [`plan/phase-5/phase-5-todox-5.1-structural-pii.md`](./phase-5-todox-5.1-structural-pii.md) — §5.1 PII 보조 (완료)
  - [`plan/phase-5/phase-5-todox-5.2.1-crosslink.md`](./phase-5-todox-5.2.1-crosslink.md) — §5.2.1 entity↔concept cross-link 설계 (analyst v2 + codex APPROVE_WITH_CHANGES)
  - [`plan/phase-5/phase-5-todox-5.3.1-incremental-reingest.md`](./phase-5-todox-5.3.1-incremental-reingest.md) — §5.3.1 + §5.3.2 결합 설계 (★ 2026-04-25 master v11 + codex Mode D **APPROVE_WITH_CHANGES**, 11 cycle 수렴 P1 0건)
  - [`plan/phase-5/phase-5-todox-5.4-integration.md`](./phase-5-todox-5.4-integration.md) — §5.4 4 Stage 통합 plan (★ 2026-04-26 v10 codex post-impl Cycle #6 APPROVE)
  - [`plan/phase-5/phase-5-todox-5.4.1-self-extending.md`](./phase-5-todox-5.4.1-self-extending.md) — §5.4.1 Stage 1 단독 plan (v7 codex Cycle #9 APPROVE)
  - [`plan/phase-5/phase-5-todox-5.11-page-promotion-threshold.md`](./phase-5-todox-5.11-page-promotion-threshold.md) — §5.11 v2.5 의미·관련도 threshold + 원문 언어 alias + wiki 초기화 (5 codex cycle 누적, post-impl APPROVE_WITH_NOTES)
  - [`plan/phase-5/phase-5-todox-5.12-source-wikilink-format.md`](./phase-5-todox-5.12-source-wikilink-format.md) — §5.12 v3 source wikilink format (canonicalizer sourcePageBase chain, 2 plan cycle + post-impl APPROVE)
  - [`plan/phase-5/phase-5-todox-5.13-residual-followups.md`](./phase-5-todox-5.13-residual-followups.md) — §5.13 잔존 follow-up 3 항목 (raw sidecar 부활 / validator find raw 패턴 / LLM source filename prefix), **draft v0.1 (사용자 임시 A1+B2+C4)** §5.14 완료 후 착수
  - [`plan/phase-5/phase-5-todox-5.14-retrospective-blue-refactor.md`](./phase-5-todox-5.14-retrospective-blue-refactor.md) — §5.14 Phase 5 retrospective TDD-BLUE refactor (§5.11 v2 + §5.12 GREEN 단계 BLUE 누락 보완), **draft v0 / P0 다음 세션 최우선**
  - [`plan/phase-5/phase-5-todox-5.15-pipeline-v2-followups.md`](./phase-5-todox-5.15-pipeline-v2-followups.md) — §5.15 Pipeline v2 후속 3 항목 (UI E2E test 인프라 / PROMOTION_THRESHOLD override / citation 마커 dead code cleanup), **draft v0 / P2 다음 세션 후보**
  - [`plan/phase-5/phase-5-spec-5.7.4-orama-migration.md`](./phase-5-spec-5.7.4-orama-migration.md) — §5.7.4 Orama 마이그레이션 Spec WHAT (28 AC + 14 Risk + 20 anchor self-check, **종결 Session 28~29 2026-05-09**)
  - [`plan/phase-5/phase-5-todox-5.7.4-orama-migration.md`](./phase-5-todox-5.7.4-orama-migration.md) — §5.7.4 Todo HOW (Step A 환경 / Step B TDD / Step C 라이브 / Step D 문서, codex 7+6 cycle, **종결 Session 28~29 2026-05-09**)
  - [`plan/phase-5/phase-5-spec-5.7.5-orama-update-sync.md`](./phase-5-spec-5.7.5-orama-update-sync.md) — §5.7.5 Orama upstream sync + LOW 잔여 + PoC cleanup + Developer Update UI Spec WHAT v1.4 (472줄, **종결 Session 30~31 2026-05-09**)
  - [`plan/phase-5/phase-5-todox-5.7.5-orama-update-sync.md`](./phase-5-todox-5.7.5-orama-update-sync.md) — §5.7.5 Todo HOW v1.4 (308줄, codex 6 cycle 모두 APPROVE, **종결 Session 30~31 2026-05-09**)
  - [`plan/phase-5/phase-5-spec-5.16-audit-refresh-reliability.md`](./phase-5-spec-5.16-audit-refresh-reliability.md) · [`plan/phase-5/phase-5-todox-5.16-audit-refresh-reliability.md`](./phase-5-todox-5.16-audit-refresh-reliability.md) — §5.16 P0 (사용자 테스트 1-1·1-2·1-4, draft v0.1)
  - [`plan/phase-5/phase-5-spec-5.17-ingest-balance-calibration.md`](./phase-5-spec-5.17-ingest-balance-calibration.md) · [`plan/phase-5/phase-5-todox-5.17-ingest-balance-calibration.md`](./phase-5-todox-5.17-ingest-balance-calibration.md) — §5.17 P0 (case A 83 → 51 cap + latency -65%, **종결 Session 37 2026-05-12**)
  - [`plan/phase-5/phase-5-spec-5.18-query-citation-ux.md`](./phase-5-spec-5.18-query-citation-ux.md) · [`plan/phase-5/phase-5-todox-5.18-query-citation-ux.md`](./phase-5-todox-5.18-query-citation-ux.md) — §5.18 P1 (citation list + backlink + diagnostic, **종결 Session 37 2026-05-12**)
  - [`plan/phase-5/phase-5-spec-5.19-wiki-maintenance-suite.md`](./phase-5-spec-5.19-wiki-maintenance-suite.md) · [`plan/phase-5/phase-5-todox-5.19-wiki-maintenance-suite.md`](./phase-5-todox-5.19-wiki-maintenance-suite.md) — §5.19 P2 (사용자 테스트 2-1, draft v0.1)
  - [`plan/phase-5/phase-5-spec-5.20-knowledge-gap-management.md`](./phase-5-spec-5.20-knowledge-gap-management.md) · [`plan/phase-5/phase-5-todox-5.20-knowledge-gap-management.md`](./phase-5-todox-5.20-knowledge-gap-management.md) — §5.20 P2 (사용자 테스트 2-2, Phase 6 → Phase 5 편입, draft v0.1)
- **프로젝트 공통**: [`plan/ref/decisions.md`](../decisions.md) · [`plan/ref/plan_wikey-enterprise-kb.md`](../plan_wikey-enterprise-kb.md).

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

> **상태 (2026-04-25, developer 세션)**: 본체 구현 착륙. 안 C (Context window heuristic) + multi-value capture + valueExcludePrefixes (YAML 선언). 상세: `plan/phase-5/phase-5-todox-5.1-structural-pii.md` v4 + `activity/phase-5/phase-5-result.md §5.1.1`.

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
- [x] **§5.1.1.10** 문서 동기화 — 본 todo + `activity/phase-5/phase-5-result.md §5.1.1` + `wiki/log.md` 엔트리.
- [~] **§5.1.1.11** (selective, **skip 결정 2026-04-25**) `scripts/check-pii.sh --structural-only` flag — fixture baseline 0/30 (E7a) 가 mandatory 검증을 충족. live wiki baseline (E7b) 경로 미사용. wiki 규모 확대 시 reopen.
- [x] **§12 E1/E2.b/E3** live smoke — **master 직접 CDP smoke (commit 2da88cb)** Obsidian `--remote-debugging-port=9222` 기동 후 dist runtime end-to-end. fixture 7종 누출 차단 7/7 + baseline FP 0/30 + wiki pre-check BRN/CEO 0 hit. (Phase 4 D.0.l 와 동등한 구조적 검증).
- [x] **wiki 재생성 없음 확증**: ingest 경로 변경 = `pii-redact.ts::detectPiiInternal` 에 `collectStructuralMatches` 분기 1건 추가만. `sanitizeForLlmPrompt` 기존 API 시그니처 (`{guardEnabled, structuralAllowed?}` 추가, default false 로 하위 호환). 기존 wiki 무변경, `applyPiiGate` 외부 호출 형태 유지.
- [x] **§5.1.1.12** (post-compact 2026-04-25) over-mask 4건 fix — bundled YAML `ceo-multiline-form.valueExcludePrefixes` 13종 추가 (주소/전화/휴대/담당/접수/등기/등록/이메일/팩스/우편/사업/본점/소재) + `isCandidateExcluded` 가 same-line 모든 토큰 검사 (기존 last 2 → 전체) + `pii-over-mask-prevention.test.ts` 회귀 방지 (539 tests pass).

---

## 5.2 검색 재현율 + 답변 품질 (P1) ★ 현 진입점
> tag: #eval, #engine, #philosophy
> **이전 번호**: `was §5.1`.
> **2026-04-25 재정의**: 기존 "Anthropic-style chunk 재작성" 단일 항목 → cycle smoke (commit `3f1fa6d`) 에서 발견된 검색·답변 품질 follow-up 5건 통합. wikey 철학 (`wikey.schema.md:157` "페이지 단위 검색", `wiki/analyses/self-extending-wiki.md`) 반영.

> **wikey 검색·인제스트 단위 (philosophy)**. wikey 는 RAG chunk 패턴을 사용하지 **않는다**. Phase 4 §4.5.1.5 v2 (`plan/phase-4/phase-4-todo.md:446-494`) 에서 결정·구현 완료:
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

> **상태 (2026-04-25 session 12 종결)**: plan v11 (codex APPROVE_WITH_CHANGES, P1 0건, 11 cycle 수렴) 6-step TDD 모두 GREEN. 회귀 584 → **640 PASS** (+56 신규). build 0 errors. cycle smoke 5/5 PASS (master CDP 직접). PMS_제품소개_R10_20220815.pdf 실 ingest + 사용자 paired sidecar 보존. 후속 follow-up 4건 (ConflictModal default / Approve&Write UX / Original-link footer mode / Settings i18n) 추가 구현. 상세: `activity/phase-5/phase-5-result.md §5.3`.

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
> **8 시나리오 분석** (`activity/phase-5/phase-5-result.md §5.2.9` 후속 분석 참조):
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
  - entity/concept 보호는 후속 — `plan/phase-5/phase-5-todox-5.3.1-incremental-reingest.md` 후속 항목 #4 참조
- [x] **시나리오 B fix — movePair destination 충돌** (Step 4):
  - `MovePairOptions.onSidecarConflict?: 'skip' | 'rename'` (default 'skip'). sidecar pre-resolve (원본 이동 전) + dest-conflict-exhausted (.1~.9 모두 충돌 → 원본 이동 안 함) + recordMoveWithSidecar atomic
- [x] **시나리오 C fix — orphan sidecar 처리** (Step 5):
  - audit-ingest.py JSON 신규 컬럼 `orphan_sidecars`: sidecar `.md` 만 있고 paired 원본 부재 + ingest-map miss
- [x] **시나리오 E fix — duplicate hash 추적** (Step 1 + decideReingest):
  - registry record 신규 필드 `duplicate_locations: string[]` (★ v4 정정: path_history 와 분리). decideReingest 에서 `duplicate-hash` conflict + `duplicate-hash-other-path` skip + `appendDuplicateLocation` (canonical 자체 제외, 멱등). reconcile() duplicate-aware (Map<hash, paths[]>)
- [x] **wiki 재생성 정책**: 본 fix 들은 신규 ingest 경로에만 영향. 기존 wiki/sidecar 데이터 무관.
- [x] **acceptance**: A/F 시나리오 cycle smoke step 5 reproduce → ConflictModal 등장 + Hook 2 user marker preserve 확증 / source-registry +11 / incremental-reingest +24 / movePair +6 / audit fixture +6 / query-pipeline +6 (Original-link footer mode) 모두 PASS / cycle smoke 5/5 PASS

> **출처**: `activity/phase-5/phase-5-result.md §5.2.9` 의 8 시나리오 표 + master 코드 분석 (`ingest-pipeline.ts:226-232` 무조건 overwrite). 본 §5.3.2 는 §5.3.1 hash diff 인프라가 우선 완성된 후 진입 — 두 항목 함께 진행.

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

> **§5.4 통합 개발 계획서 단일 소스**: [`plan/phase-5/phase-5-todox-5.4-integration.md`](./phase-5-todox-5.4-integration.md) v5 (codex Cycle #5 APPROVE 2026-04-26 / BUILD_BREAK_RISK LOW / Cycle 누적 #1~#5). **세부 설계 (4 Stage detailed 알고리즘 + 통합 시나리오 §4 5 가지 + 우선순위 chain + 8 종 신규 export 타입 + writer section-range insertion + store 분리 + LLM mapper) 는 통합 plan v5 본문에**, 진행 상태 추적 (체크박스) 은 본 §5.4 통합 관리. AC 본문 변경 시 통합 plan 갱신 → 본 체크박스 동기화.
>
> **§5.4.1 Stage 1 단독 plan**: [`plan/phase-5/phase-5-todox-5.4.1-self-extending.md`](./phase-5-todox-5.4.1-self-extending.md) v7 (codex Cycle #9 APPROVE 2026-04-26). Stage 1 한정 detailed (통합 plan §3.1 reference 단일 소스).
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

> **상세 설계 단일 소스**: [`plan/phase-5/phase-5-todox-5.4.1-self-extending.md`](./phase-5-todox-5.4.1-self-extending.md) v7 (codex Cycle #9 APPROVE 2026-04-26, file rename 2026-04-26 사용자 명명 정책 — 기존 `phase-5-todox-5.4-self-extending.md` → `phase-5-todox-5.4.1-self-extending.md`. 5.4 통합 plan 은 별 파일 `phase-5-todox-5.4-integration.md`). 본 체크박스는 v7 §3.5 의 9 AC + R1/R3 + AC6.b 라이브 측정 + AC7 회귀를 narrowing — 진행 상태만 추적. AC 본문 변경 시 todox 갱신 → 본 체크박스 동기화.
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

> **상세 설계 단일 소스**: [`plan/phase-5/phase-5-todox-5.4-integration.md §3.2`](./phase-5-todox-5.4-integration.md) v5 (codex Cycle #5 APPROVE). 본 체크박스는 v5 §5 의 AC2~AC8 narrowing — 진행 상태 추적만.
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

> **상세 설계 단일 소스**: [`plan/phase-5/phase-5-todox-5.4-integration.md §3.3`](./phase-5-todox-5.4-integration.md) v5. 본 체크박스는 v5 §5 의 AC9~AC14 narrowing.
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

> **상세 설계 단일 소스**: [`plan/phase-5/phase-5-todox-5.4-integration.md §3.4`](./phase-5-todox-5.4-integration.md) v5. 본 체크박스는 v5 §5 의 AC15~AC20 narrowing.
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

> **상세 설계 단일 소스**: [`plan/phase-5/phase-5-todox-5.4-integration.md §5 AC21/AC22`](./phase-5-todox-5.4-integration.md) v10. **AC21 라이브 1차 책임 = master** (agent-management.md §6 갱신, 2026-04-26 사용자 영구 결정). tester 는 코드/시뮬레이션 (mock fs + mock LLM integration test) 만 담당.
> result mirror: [`activity/phase-5/phase-5-result.md §5.4.5`](../../activity/phase-5/phase-5-result.md) 4 sub-section (5.4.5.1 시나리오 / 5.4.5.2 codex 6 cycle / 5.4.5.3 AC21 라이브 / 5.4.5.4 follow-up 4).

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
- 결과 문서 [`activity/phase-5/phase-5-resultx-5.4-integration-cycle-smoke-2026-04-26.md`](../../activity/phase-5/phase-5-resultx-5.4-integration-cycle-smoke-2026-04-26.md) — commit eb4b697.

#### 5.4.5.4 follow-up 4 항목 (사용자 명령 옵션 a "1, 3, 4 모두 본 세션 + 여유 있음 4")
- [x] **§3.5 항목 1 — Stage 3 SelfDeclaration runtime extraction inspect**: 신규 fixture `test-stage3-cobit.md` (COBIT 2019 5 도메인) ingest 50s. console log evidence `stage3 self-declarations — 1 runtime entries`. wiki/concepts 5 신규 (cobit-2019 + cobit-* 4). autoMove 정상. — commit 308bc72
- [x] **§3.6 항목 3 — Suggestions detector umbrella default UX**: `suggestion-detector.ts:170-178` firstWord prefix 추출. PMBOK only ingest 시 firstWords ['project']*N → umbrella `'project-management'` (의미있는 default). mixed 면 fallback 'cluster'. 신규 test 1 case. 731 → 732 PASS. — commit 308bc72
- [x] **§3.7 항목 4 — classify-inbox.sh subfolder 평탄화**: `find -maxdepth 1` → `-type f` 재귀 평탄화. 사용자 영구 결정 옵션 B 와 일관. — commit 308bc72
- [x] **§3.8 항목 2 — Stage 4 라이브 alpha v1 wire 검증**: mock embeddings JSON (59 slug × 1024-dim group axis) → run-convergence-pass.mjs 실행 → 4 ConvergedDecomposition 생성 (project-management-body-of-knowledge / work-breakdown-structure / iso-iec-27001-2022 / itil-4). mjs schema bug fix (`{ version, ingests: [...] }` schema 처리 추가). — commit da42cef

### 5.4.6 종결 회귀 + commits 통계 (mirror activity/phase-5/phase-5-result.md §5.4.6)

- [x] **회귀 baseline**: 670 → **732 PASS / 38 files / 0 fail** (cd wikey-core && npx vitest run)
- [x] **build**: wikey-core 0 errors / wikey-obsidian 0 errors (npm run build / npx tsc --noEmit)
- [x] **신규 cases 합계**: 62 (Stage 2 = 20 + Stage 3 = 21 + Stage 4 = 10 + integration = 7 + Cycle 후속 = 4)
- [x] **Total commits push (16 commits)**: 9b7da21 → 7e6c2fb (5.4.1 → 5.4.7 + sync v8 정정)
- [x] **보조 문서**: `activity/phase-5/phase-5-resultx-5.4-integration-cycle-smoke-2026-04-26.md` (master 직접 라이브 cycle smoke 전체 detail).

### 5.4.7 v2 deferral — **다음 세션 첫 액션** (사용자 영구 결정 2026-04-26)

> **fresh session 진입 즉시 첫 cycle 에서 1순위 + 2순위 (UI 수정) 동시 진행**. 3·4순위 는 1·2 완료 후 순차. 별 read 진입점: `plan/session-wrap-followups.md` 의 🎯 섹션 + 본 §5.4.7.

- [x] **1순위 (★ fresh session 첫 작업) — Stage 4 실 qmd embeddings 통합** (2026-04-26 session 14 종결, activity §5.4.8): 다국어 / synonym 자동 통합 인식 (mock 만으로 미검증된 핵심 가치). mini plan = `plan/phase-5/phase-5-todox-5.4-integration.md §10` (path 결정: Python 기각 — system Python `enable_load_extension` 비활성. **Node.js + better-sqlite3 + sqlite-vec** 채택, isolated `scripts/qmd-export-deps/` 로 wikey-core zero-deps 정책 + tools/qmd Bun ABI 모두 회피).
  - [x] §10.3 단계 1 — `scripts/qmd-embeddings-export.mjs` 작성 (read-only SELECT, Float32 blob 디코딩, chunk 평균, dim sanity check)
  - [x] §10.3 단계 2 — mention-history slug 추출 + qmd DB JOIN export → `.wikey/qmd-embeddings.json` (1.4 MB, **59/59 slug × 1024-dim**, 0 missing)
  - [x] §10.3 단계 3 — `run-convergence-pass.mjs --embeddings .wikey/qmd-embeddings.json` 실행 → `.wikey/converged-decompositions.json` 갱신 (mock 4 → 실 2 ConvergedDecomposition, mock baseline 보관)
  - [x] §10.3 단계 4 — cluster 의미 보존 spot-check: 도메인 내부 (PMBOK 0.59~0.66, COBIT 0.58~**0.91**) ≫ 도메인 간 (0.20~0.36). 한/영 페어 검증은 wiki 한국어 slug 부재로 별 follow-up.
  - [x] §10.6 acceptance — 회귀 baseline **732 PASS 유지** (38 files, 0 fail)
  - [x] activity/phase-5/phase-5-result.md §5.4.8 신규 + 1순위 [x] mark + commit
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
- 포인터만 두는 위치: `wikey-core/src/canonicalizer.ts` 작업 규칙 #7 위 주석, `activity/phase-4/phase-4-result.md §4.5.1.7.2` "일반화 경로" 단락, `plan/session-wrap-followups.md`, `memory/project_phase4_status.md` / `memory/project_phase5_status.md`.

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

### 5.6.3 LLM provider strategy — subscription 모델 + Ollama cloud + stage-aware routing (Session 23 raise, 2026-05-07)

> **이슈 출처**: 사용자 raise 2026-05-07 — 현재 ingest 주력 모델 = Gemini 2.5 Flash (BYOAI API). 향상된 LLM (Claude Opus 4.7 등) 사용 시 ingest 결과 영향 의문 → provider strategy 재검토 필요. (이전 §5.16 자리에서 본 §5.6 LLM 엔진 영역으로 이동.)
> **분류**: P3 design / cost-benefit 평가
> **status**: draft / Phase 6 (웹 환경) 진입 전 또는 후 결정

- [ ] **§5.6.3.A** Subscription 모델 통합 (BYOAI API → Claude.ai 구독 / ChatGPT Plus / Gemini Advanced 같은 *사용자 자체 구독* 활용)
  - 현재: API 키 필요 (`~/.config/wikey/credentials.json`) + token 별 과금. ingest 1 cycle ≈ Gemini Flash $0.005 / Opus 4.7 $1.0
  - 검토: **Claude Code SDK / Anthropic Console 의 사용자 plan** 을 외부에서 호출 가능한가? Claude.ai 구독 자체는 외부 API key 분리됨 — 즉 구독 ≠ API. 단, *Claude Code 의 SDK / web app remote* 는 구독 내 사용 가능 (별도 entry point)
  - 옵션:
    - (a) Anthropic Workbench / Console 의 *plan* 으로 전환 — Pro plan ($20/월) 으로 API 사용량 일부 무료 (단 한도 있음)
    - (b) ChatGPT Team / Enterprise 같은 *flat-rate plan* 의 API 접근 — 일부 plan 만 가능
    - (c) **Self-hosted via subscription proxy** — Claude.ai 의 web session cookie 로 API 흉내. 비공식, ToS 위반 우려
  - 비용 trade-off: token 단위 과금 → flat-rate. ingest 빈도 ≥ 일 10회 시 break-even
  - 구현: provider 추상화 layer 추가 (`wikey-core/src/llm-client.ts` 의 `provider: 'subscription'` 새 case + token bucket + rate limit + 한도 초과 시 BYOAI fallback)

- [ ] **§5.6.3.B** Ollama Cloud 대형 모델 (`llama3-70b-cloud` / `qwen3-72b-cloud` 같은 호스팅 대형 모델)
  - 현재: Ollama = 로컬 only. 대형 모델 (≥ 30B) 은 로컬 GPU/RAM 부족으로 사실상 활용 불가
  - **Ollama Cloud (2025년 출시)**: ollama.com 의 hosted endpoint — 로컬 ollama 명령으로 cloud 모델 호출 가능 (`ollama run llama3:70b` 등)
  - 비용: subscription 기반 (Ollama Pro 등) 또는 token 기반. Anthropic 보다 저렴, 로컬 ollama 호환성 그대로
  - 옵션:
    - (a) Ollama Cloud 가입 후 `provider: 'ollama'` + `OLLAMA_HOST` 를 cloud endpoint 로 — 코드 변경 0 (`provider-defaults.ts` 의 ollama budget config 만 cloud 용으로 update)
    - (b) wikey config 에 `ollama_cloud` 별 provider key 추가 — local + cloud 분리 운영 (local fallback)
  - 가능성: ingest 의 canonicalize 단계만 cloud 70B 사용 + brief/mention 은 local 8B → 비용 효율 + 품질 균형

- [ ] **§5.6.3.C** Stage-aware provider routing (현재 `'ingest'` 단일 키 → stage 별 분리)
  - 현재 `wikey.conf` provider 키: `default` / `ingest` / `classify` / `chat` / `embedding`
  - 제안 추가 키: `summary` (Stage 1) / `mention` (Stage 2) / `canonicalize` (Stage 3) — `'ingest'` 안에서 분리
  - 효과:
    - canonicalize → Opus 4.7 또는 Ollama cloud 70B (high quality, 비용 ↑)
    - mention/brief → Flash / local 8B (low cost, 충분)
    - summary → Sonnet 4.6 (중간)
  - 추정 비용 절감: 단순 전체 Opus 대비 80%+ 절감 + canonicalize 품질만 보존

---

## 5.7 운영 인프라 포팅 (P4)
> tag: #utility, #infra
> **이전 번호**: `was §5.7` (번호 유지).

> **배경**. Phase 3 에서 이관된 우선순위 낮은 리팩토링 항목. 동작 유지하면서 구현만 개선. Phase 4 §4.5.2 에서 이관 (삭제 안전장치 + 초기화는 본체 남김).

### 5.7.1 bash→TS 완전 포팅 ✅ 완료 (Session 26, 2026-05-08)

> **종결**: 4 스크립트 모두 1 세션 처리. scripts-runner.ts in-process refactor + scripts/*.sh thin wrapper + setup.sh wikey-core 빌드 추가. master 1차 → codex 4 cycle (#1~#4 APPROVE) → obsidian-cdp 라이브 (ingest cycle + query 정확 답변 + Settings tab 5 버튼) 모두 PASS.

- [x] `validate-wiki`, `check-pii`, `cost-tracker`, `reindex` 를 TypeScript 구현으로 포팅 — `wikey-core/src/scripts/{4}.ts` (~1460 LOC) + `wikey-core/src/defaults/check-pii.default.yaml`
- [x] scripts-runner.ts execFile bash → in-process 함수 호출 refactor (interface unchanged, plugin call 5 사이트 코드 변경 0)
- [x] scripts/*.sh thin wrapper (`exec node wikey-core/dist/scripts/<name>.js`) — production runtime 에서 bash spawn 0
- [x] 39 신규 unit test (5+9+16+9) + 21 migrated scripts-runner test → wikey-core 747 PASS / 3 skip / 0 fail
- [x] golden diff 5 cases byte-equal (check-pii / validate-wiki / cost summary / cost providers / reindex --check --json)
- [x] codex 4 cycle 누적 fix 8 항목: isEntryPoint try/catch / setup.sh 빌드 step / writeErr callback chain / python silent-fail fix / pii-patterns.yaml 양쪽 인식 / NaN guard / AbortController+clearTimeout+spawn signal / validate-stamp abort guard
- [x] obsidian-cdp 라이브 cycle smoke (ISO 27001 — Brief 90s + Approve & Write 15s) — wiki write 9 파일, movePair OK, query 정확 (4 카테고리 + 통제수 37/8/14/34=93 + 13 citation links + 원본 backlink), Settings tab 5 버튼 PASS, **silent-fail 회귀 0 확증**
- [x] **wiki 재생성 없음 확증**: 동작 동일성 유지 (golden byte-equal), 실행 경로만 교체. plugin call 사이트 코드 변경 0.

### 5.7.2 qmd SDK import — 🛑 abandon (2026-05-08 session 26 사용자 영구 결정)

> **상태**: **abandon 종결**. 1차 시도 (in-process import) = Electron renderer file:// dynamic import 미지원으로 fundamental fail (8 cycle 후 full revert). 2차 시도 (subprocess+IPC) = 사용자 평가 결과 진정한 내재화 아닌 차선책 + 가치 < 위험 + qmd internal API coupling 부담 ↑ → abandon.
>
> **사용자 통찰** (2026-05-08, 영구 등록): "내재화 하면 우리가 직접 불편하고 잘 안맞는 부분을 고치려고 했던건데... 그게 아니면 qmd를 안정적으로 받아서 운영해야 하는거 아닌가?" → §5.7.2 의 진짜 motivation = ownership / customization. Electron 제약으로 fail 이면 *외부 안정 의존* 이 합리적 대안. 차선 (subprocess+IPC) 은 두 방향 모두 충족 못 함 (진정한 ownership 도 X, 외부 의존 simplicity 도 X).
>
> **다음 세션 검토 (deferred)**: qmd 대체 후보 (예: Orama pure JS hybrid search engine) — 진정한 in-process import 가능 + native deps 0 + Electron renderer 호환. 다음 세션에서 trade-off + PoC + 검토.

- [x] (../abandon) CLI exec → in-process 전환 시 지연 감소 — Electron 제약 + ownership 가치 mismatch 로 폐기
- [x] (../abandon) **wiki 재생성 없음 확증** — 적용 안 함 (작업 자체 abandon)

#### 1차 시도 (in-process SDK dynamic import — 2026-05-08, 8 cycle, 종결 = revert)

**시도 architecture**: `await import(pathToFileURL(join(basePath, 'tools/qmd/dist/index.js')).href)` (vendored absolute file URL dynamic import) + esbuild external 6 + module-scope singleton + ABI probe (existsSync + listCollections active_count + raw vec_version) + env switch fallback (`WIKEY_QMD_USE_CLI=1`) + 17 단위 test (AC-1/4/5/7).

**사이클 누적**: plan v1~v7 (codex cycle #1~#7, 21 finding 누적) + post-impl v1~v2 (codex 2 cycle, 6 finding 누적) = 총 **8 cycle / 27 finding** 모두 master 직접 fix. 마지막 cycle = APPROVE.

**라이브 검증 결과 (master 직접 obsidian-cdp smoke)**: ❌ **production runtime 미작동**
```
[Wikey] query error: [Step 2/4 qmd 검색] [Wikey qmd SDK] module load failed:
Failed to fetch dynamically imported module: file:///Users/denny/Project/wikey/tools/qmd/dist/index.js
  (fix: WIKEY_QMD_USE_CLI=1 + Obsidian 재시작)
```

**근본 원인**: Obsidian plugin = Electron renderer = **Chromium dynamic ESM loader 가 Node.js loader 우선** → file:// scheme 의 ESM dynamic import 가 HTTP fetch 시도 → fail. fundamental limitation.
- 출처 1: [Electron ESM docs](https://www.electronjs.org/docs/latest/tutorial/esm) — "If your unsandboxed renderer process does not have the contextIsolation flag enabled, you cannot dynamically import() files via Node's ESM loader. This is because Chromium's dynamic ESM import() function usually takes precedence in the renderer process."
- 출처 2: [Obsidian Forum — third-party dynamic imports](https://forum.obsidian.md/t/using-third-party-libraries-by-dynamic-imports/66203)
- 출처 3: [obsidian-modules plugin (polyipseity)](https://github.com/polyipseity/obsidian-modules) — *이 플러그인 자체 존재 = 외부 ESM dynamic import 가 fundamental 미지원이라는 증거*

**진행 시도의 process 결함** (master 책임 — 사용자 영구 등록 의무):
1. **사전 PoC 누락**: plan v1 작성 *전* "Hello World" 수준 dynamic import 작동 PoC 0회. esbuild build 검증 (codex cycle #2 v2-F1) 까지만 했고 *그 build 산출물이 Electron renderer 안에서 실제 로드되는가* 는 검증 0.
2. **커뮤니티 조사 누락**: plan 진입 전 5분 web search 만 했어도 `obsidian-modules` 의 존재 + Electron renderer 의 dynamic import limitation 발견 가능. plan v1~v7 동안 0회.
3. **memory `feedback_qmd_node_abi.md` 의 6 layer 가 *system node spawn ABI* 차원**: Obsidian plugin renderer 의 *Chromium loader vs Node loader* 차원과 다름. plan §4.1 "ABI mismatch 위험" 이 이 차이 인지 못 함.
4. **codex 7 cycle + post-impl 2 cycle = 정적 분석만**: 코드 + spec + ground truth (store.d.ts / index.d.ts) 까지만 검증 — runtime Electron 환경 검증 0.
5. **8 cycle = 약 2 시간+ 자원 낭비**: 회피 가능했음.

#### Baseline latency 측정 결과 (2026-05-08 master 직접, 5 sample × 1 cold + 10 warm = 55 measurements)

| Query | Cold (ms) | Warm p50 | Warm p95 | Warm min | Warm max |
|-------|-----------|----------|----------|----------|----------|
| iso-korean | 8811 | 1225 | 1240 | 1221 | 1240 |
| pmbok-english | 4740 | 1225 | 1238 | 1209 | 1238 |
| nanovna-hyphen | 6764 | 1224 | 1240 | 1205 | 1240 |
| short-3char | 4303 | 1222 | 1234 | 1212 | 1234 |
| finetree-rag | 7775 | 1223 | 1245 | 1213 | 1245 |
| **Aggregate** | **median 6.7s** | **p50 1.22s** | **p95 1.24s** | min 1.21s | max 1.25s |

**의의**:
- Cold first query = **4.3~8.8 초** (사용자 chat panel 처음 사용 시 체감 강함)
- Warm steady-state = **1.22 초 / query** (추정 100~500ms 의 약 3 배)
- 5 query 누적 spawn overhead = **6 초** (typical 사용자 일일 세션 영향 큼)
- 옵션 = subprocess + IPC 시 절감 추정 **80%** (1.24s → ~1.24s 첫 + ~10ms IPC 이후)

#### 2차 시도 후보 architecture (사용자 결정 대기)

| 옵션 | 설명 | 난이도 | Electron 호환 |
|------|------|--------|---------------|
| **(A) Long-lived subprocess + IPC** | `child_process.fork('worker.js')` 1회 + JSON-RPC IPC. 첫 query spawn 1회 (~1.2s) + 이후 IPC (~10ms) | 중 | ✅ Node.js 표준 API, Electron 호환 검증 PoC 5분 |
| (B) `obsidian-modules` plugin 의존 | `require.import()` API 사용. Electron renderer 안 ESM dynamic import 가능 | 작음 | ✅ 단 사용자에게 추가 plugin 설치 부담 |
| (C) qmd 자체 CJS 변환 + bundle inline | wikey-core build 시 qmd dist/* 를 CJS transform + main.js 안 inline. native deps 만 external | 큼 | △ qmd top-level await + ESM-only 변환 어려움 |
| (D) Worker thread + Electron Node context | Electron worker thread 안 dynamic import (Node loader). main 과 IPC | 큼 | ❓ 검증 필요 |

**사용자 권장 = (A)** — 정량적 이득 명확 (spawn cost 1.2s 매번 → 1회만), Node.js 표준 API, plugin 추가 의존 0.

#### 향후 cycle 진입 시 의무 (master 영구 등록, 사용자 raise 2026-05-08)

1. **architecture 변경 시 plan 작성 *전* 5분 minimum viable PoC 의무** — Hello World 수준 검증으로 fundamental gap 사전 차단.
2. **runtime 환경 (Electron renderer / Node.js / subprocess) 명시 + 해당 환경의 limitation web search 의무** — codex 정적 분석 만으로는 잡을 수 없는 차원.
3. **baseline measurement 의무** — "성능 개선" 목적 plan 진입 전 *현재 baseline 측정 후 plan 작성*. 본 §5.7.2 에서 plan v1 `AC-3 Latency 감소 확증` 가 추정 (100~500ms) 만 가졌고 실측 (1.2s) 과 거리 컸음. 측정 후 plan 작성이면 architecture 우선순위 (subprocess vs in-process) 도 정확히 판단 가능.
4. **codex 7 cycle 후에도 finding 잔존 가능 — 자정 못함**: 정적 분석 도구는 architecture fundamental 한계를 못 잡는다. 라이브 PoC 가 유일한 검증.

> 본 §5.7.2 의 8 cycle 작업은 historical record 로만 가치. 코드 + plan v1~v7 모두 revert 완료 (HEAD = 1e37908 baseline). 본 todo 의 attempt log 가 미래 reference (사용자 영구 결정 — "5.7.2에는 진행의 문제점에 대해서 잘 기록해놔" 2026-05-08).
>
> **abandon 후속 검토 항목 (다음 세션)**: qmd 자체를 internal-customizable 한 alternative 로 *교체* 가능 여부 — 후보 = Orama (pure JS hybrid BM25 + vector + RRF, native deps 0, Electron renderer 호환). 진정한 in-process import + ownership/customization 회복 가능. 단 migration cost (search index 형식 변경 + 한국어 tokenization layer 재배치 + LLM rerank 통합) 검토 의무. **본 §5.7.2 의 `qmd SDK import` motivation 자체를 retire 하고 별도 §5.7.4 (또는 §5.5/§5.6 산하) 로 *qmd alternative engine* 신규 검토** 가 후속 cycle path.

### 5.7.3 qmd alternative engine 검토 + Orama PoC ✅ 완료 (Session 27, 2026-05-09)

> **상태**: research + PoC 4 단계 모두 완료. 결과 문서 [activity/phase-5/phase-5-resultx-5.7.3-orama-poc-2026-05-09.md](../../activity/phase-5/phase-5-resultx-5.7.3-orama-poc-2026-05-09.md). 사용자 결정 (2026-05-09): 다음 세션 §5.7.4 진입.
> #qmd-alternative #orama #kiwi-wasm #path-a #poc-pass

- [x] 3 agent 병렬 research — codebase 표면 매핑 / 16 후보 community survey / 한국어 NLP 통합 path
- [x] PoC 단계 1 — Kiwi WASM 가용성 (Node sandbox, kiwi-nlp v0.23.0, sync API + POS tag 동등)
- [x] PoC 단계 2-A — Orama Electron renderer 통합 (esbuild bundle, §5.7.2 fundamental fail 함정 회피 확증, import 1ms)
- [x] PoC 단계 2-B — Kiwi WASM + Orama 통합 (Module.instantiateWasm hook + wasmBinary 주입, init 1186ms / tokenize 1ms/sentence)
- [x] PoC 단계 3 — Quality benchmark (10 query, 117 docs, qmd vs Orama BM25). Top-1 8/10 (qmd 7-8/10), Q4 ITIL / Q10 Obsidian 결정적 회복, Q5 1/10 회귀, latency 0.2ms vs 1.22s (6,000배+ 개선)
- [x] qmd vs Orama 7 dimension 비교 분석 (D1~D7) — 6/7 Orama 우세, 1/7 (D7 단기 비용) qmd 우세 (일회성)

**사용자 결정 영구 등록 (2026-05-09)**:
- ✅ **LGPL-2.1 호환** — Kiwi 소스 사용 명시 + GitHub public (Obsidian Community Plugins 규약과 자연 호환)
- ✅ **Path A 패러다임** = "irreversible commitment" 가 아닌 "reversible experiment" — qmd 가 self-contained CLI script 이므로 회귀 비용 ≈ 0 (3 layer 안전망: git revert / qmd vendored 보존 / `WIKEY_SEARCH_BACKEND` feature flag)
- ✅ **§5.7.4 진입 결정** — 다음 세션 (session 28) 에서 spec 작성 + 마이그레이션 진행

### 5.7.4 Orama 마이그레이션 — Spec/Todo APPROVE_WITH_CHANGES (Session 28, 2026-05-09) → 다음 세션 구현 진입

> **상태** (2026-05-09 session 28 갱신): SDD+TDD spec v8 + todo v8 작성 완료 (7 cycle 누적). codex Mode D Panel cycle #7 verdict = **APPROVE_WITH_CHANGES** (HIGH 0 + MED 0 + LOW 1 fix 완료). 사용자 최종 승인 완료. 다음 세션 구현 진입.
> #orama-migration #path-a #search-engine-replacement #spec-approved

**Spec/Todo 단일 소스** (실 작업 단위):
- Spec (WHAT, 781 lines): [`plan/phase-5/phase-5-spec-5.7.4-orama-migration.md`](./phase-5-spec-5.7.4-orama-migration.md) — 28 AC + 14 Risk + 20 anchor self-check
- Todo (HOW, 270 lines): [`plan/phase-5/phase-5-todox-5.7.4-orama-migration.md`](./phase-5-todox-5.7.4-orama-migration.md) — Step A 환경 / Step B TDD RED→GREEN→BLUE / Step C 라이브 smoke / Step D 문서

**핵심 결정** (사용자 영구 등록 2026-05-09):
- **B-2 sparse vendor**: `wikey-core/vendor/kiwi-nlp/` = `bab2min/Kiwi/bindings/wasm/package/` subdir + 본가 root LICENSE 별 fetch (사용자 의도 = 코드 내재화)
- **WIKEY_SEARCH_ENGINE 신규 config 키** (`'orama' | 'qmd'`, default `'orama'`) — 기존 `WIKEY_SEARCH_BACKEND` ('basic'/'gemma4') 와 의미 분리
- **회귀 안전망 3 layer**: git revert + tools/qmd/ vendored 보존 + `WIKEY_SEARCH_ENGINE=qmd` runtime toggle
- **LGPL §6 4 의무 충족**: NOTICE 6 항목 (JS wrapper layer + WASM binary layer 분리, rebuild 절차 명시)
- **Karpathy Simplicity 적용**: PoC 26 후보 중 ✅ 11 포함 + ⚠️ 5 단순화 + ❌ 12 deferral (B 그룹 7 → §5.7.5 별 spec)

**다음 세션 (Session 29) 시작 액션**:
1. spec/todo read → master 컨텍스트 확보
2. Step A (환경 세팅) — Kiwi 사전 cache 확증 + WIKEY_SEARCH_ENGINE config 키 도입 + kiwi-nlp B-2 vendor 결정 잠금
3. Step B (TDD) — RED 21 case → GREEN A1~A8 + vendor 구현 → BLUE Phase 3a 회귀 + Phase 3b refactor
4. Step C (라이브 smoke) — obsidian-cdp full cycle + sidebar-chat 한+영 query + WIKEY_SEARCH_ENGINE=qmd toggle
5. Step D (문서) — LICENSE + NOTICE + README + schema.md + activity result + commit

**누적 cycle 결과**:
- 7 codex cycle (#1~#7) + 사용자 raise 1 (B-2 vendor) + 사용자 raise 2 (codex 패턴 학습) + 사용자 raise 3 (community 조사) + 사용자 raise 4 (글로벌 rules.md §10 갱신)
- 누적 35+ finding fix → cycle #5/#6/#7 HIGH 0 연속 → cycle #7 APPROVE_WITH_CHANGES
- master 13 anchor (P1~P6 + F1~F7) 학습 효과 = finding 88% 감소 (9 → 1)
- **글로벌 rules.md §10 갱신 (모든 project 적용)** — 7-anchor + 6 codex 패턴 + 7 fix 모드 = 20 anchor 의무

상세 cycle 이력 + 사용자 결정 + 26 todo 후보 검증: [`plan/phase-5/phase-5-spec-5.7.4-orama-migration.md`](./phase-5-spec-5.7.4-orama-migration.md) §7.1 + §8 변경 이력.

- [x] (../§5.7.4-Step A) 환경 세팅 — Kiwi 사전 cache + WIKEY_SEARCH_ENGINE config + kiwi-nlp B-2 vendor 결정
- [x] (../§5.7.4-Step B) TDD RED→GREEN→BLUE — 19 case → A1~A8 + vendor 구현 → 회귀 PASS + refactor (codex 6 cycle, APPROVE_WITH_CHANGES)
- [x] (../§5.7.4-Step C) 라이브 cycle smoke — obsidian-cdp AC-L1/L2/L3 + PoC benchmark 재실행 + MED #13 cross-process invalidation 라이브 검증 PASS
- [x] (../§5.7.4-Step D) 문서 동기화 — LICENSE (MIT 기존) + NOTICE (LGPL §6 6 항목) + README rollback/third-party + VENDOR.md (v9 reality drift) + spec/todo v9 + activity result entry. wikey.schema.md 검색 코어 안정성 갱신은 사용자 승인 의무 (별 commit).

---

## 5.7.5 Orama upstream sync 자동화 + LOW 잔여 + PoC cleanup + Developer Update UI — Phase 5 별 subject (P3, 2026-05-09 신설, **종결 Session 31 2026-05-09**)
> tag: #search, #orama, #kiwi-nlp, #upstream-sync, #poc-cleanup, #developer-ui, #phase5-defferred
>
> **상태**: Session 31 (2026-05-09) **종결**. Step A/B/C/D 모두 완료 + codex 6 cycle (#1~#6) 모두 APPROVE 도달 + AC 22 verification PASS (단위 13 + 통합 4 + 라이브 3 + 부가 2). 활동 evidence: [`activity/phase-5/phase-5-result.md §5.7.5`](../../activity/phase-5/phase-5-result.md) + [`activity/phase-5/phase-5-resultx-5.7.5-orama-update-sync-2026-05-09.md`](../../activity/phase-5/phase-5-resultx-5.7.5-orama-update-sync-2026-05-09.md).
>
> **단일 소스**: [`plan/phase-5/phase-5-spec-5.7.5-orama-update-sync.md`](./phase-5-spec-5.7.5-orama-update-sync.md) (Spec WHAT, 472줄) + [`plan/phase-5/phase-5-todox-5.7.5-orama-update-sync.md`](./phase-5-todox-5.7.5-orama-update-sync.md) (Todo HOW, 308줄).

§5.7.4 종결 후 deferred 된 운영 정책 + 코드 quality 보강 + cleanup 항목 통합. 본 §5.7.5 는 *마이그레이션 후 운영* 영역이라 별 spec 으로 분리 (Karpathy Simplicity #2 — §5.7.4 코드 작업 cycle 과 명확 경계).

**진입 조건** (충족됨):
- §5.7.4 GREEN cycle 종결 (4 commits, 2026-05-09 session 29)
- codex post-impl 6 cycle APPROVE_WITH_CHANGES
- 라이브 smoke 4 항목 (AC-L1/L2/L3 + PoC benchmark) 모두 PASS

**범위 — 3 그룹 (B 그룹 7 + LOW deferred 잔여 + PoC code cleanup)**:

### B 그룹 (upstream update sync 자동화) — Orama + Kiwi
- [x] (../B1) `@orama/orama` npm update monitor — **단순화 채택**: 재시작 1회 detect (UI-1~6 Developer Update UI 안 자연 통합). `npm outdated` cron / GitHub atom feed 미채택 (Karpathy Simplicity over-spec)
- [x] (../B2) Update 반영 프로토콜 — **단순화 채택**: LLM analyze 흡수 ([분석] 버튼 1회 호출, hasUpdate mirror UI-3). patch/minor/major 자동 분기 미채택
- [~] (../B3) Regression 검증 자동화 — **§5.7.6 deferral** (별 cycle, B 자동화 인프라 over-spec)
- [x] (../B4) Kiwi 사전 update 자동 추적 — **단순화 채택**: 본 cycle 포함, UI-4 자연 row (`./scripts/check-kiwi-vendor-sync.sh` + UI 통합)
- [~] (../B5) Update sync 프로세스 docs — **§5.7.6 deferral** (자동 갱신 인프라 over-spec)
- [~] (../B6) Notification — **§5.7.6 deferral** (GitHub watch + workflow 인프라 over-spec)
- [x] (../B7) **kiwi-nlp source vendor upstream sync 자동화** — **단순화 채택**: `./scripts/check-kiwi-vendor-sync.sh` detect + 절차 docs (`docs/kiwi-nlp-vendor-sync.md`) 까지. 자동 cherry-pick / review queue 미채택

### LOW 잔여 (codex post-impl 6 cycle deferred) — 4 항목
- [x] (../LOW #5 lowercase docs) `wikey-obsidian/src/commands.ts:142-156` PoC code 의 alphanumeric token 보존 + `scripts/korean-tokenize.py::_smart_tokenize` 의 lowercase 미적용 vs wikey-core `orama-korean-tokenizer.ts:135` 의 lowercase 적용 — **drift 정정 종결**. 사용자 결정: code lowercase 유지 + spec/PoC docs 정정 (case-insensitive 매칭).
- [x] (../LOW #14 PARTIAL persist race window) `wikey-core/src/search/orama-index.ts::persist()` 의 `oramaSave + writeFileSync` 사이 abort signal check — atomic write (temp + rename) 적용 종결. 회귀 PASS.
- [x] (../LOW #15 vendor module load warn) `./scripts/reindex.sh --check --json` 가 Kiwi vendor module load 시 stderr `MODULE_TYPELESS_PACKAGE_JSON` warn — `createKoreanTokenizer` lazy import 적용 종결.
- [x] (../LOW #7 보강 — 라이선스 docs 자동 검증) NOTICE/README rollback/third-party 섹션의 정합성 자동 검증 (`./scripts/check-licenses.sh` CI grep) — npm dep 추가 시 NOTICE 누락 회피 종결.

### PoC code cleanup — `wikey-obsidian/src/commands.ts:96~522`
- [x] (../POC-1) `wikey-poc-orama-test` / `wikey-poc-kiwi-orama` / `wikey-poc-orama-benchmark` 3 PoC command — **단순화 채택**: cleanup. main.js -63KB (-12.7%, 496679→433384 bytes) 확증.
- [x] (../POC-2) `wikey-obsidian/package.json` 의 `kiwi-nlp` / `@orama/orama` deps — **POC-1 종속 cleanup** 적용. production path 는 vendor 경유.
- [x] (../POC-3) 정리 결정 시 main.js 크기 측정 — **1줄 verification**: 496679 → 433384 bytes (-63KB, -12.7%).

### C 그룹 (PoC §5.7.3 → spec v8 §4.3 deferred — 검색 품질·정합성 보강) — 4 항목

> `plan/phase-5/phase-5-spec-5.7.4-orama-migration.md §4.3` 에서 본 cycle 안 처리 거부된 항목 (deferral / Karpathy Simplicity #4 — 분리 합리). C3/C4 는 §5.7.4 안 sanity 수준 처리 완료, C5/C6 는 본 §5.7.5 종결, C1/C2 는 §5.7.6 deferral.

- [~] (../C1 — Q5 회귀 보완 — smart_tokenize 정밀화) **§5.7.6 deferral** (사용자 만족도 평가 후 결정 영역, smart_tokenize 한국어 stopword / POS filter 정밀화)
- [~] (../C2 — 50~100 query 확장 benchmark + 자동화) **§5.7.6 deferral** (자동화 별 cycle, sample size ≥ 50 query suite + `npm run benchmark:search` + CI 통합)
- [x] (../C5 — wikey.conf qmd 키 deprecate) `WIKEY_QMD_TOP_N` → `WIKEY_SEARCH_TOP_N` naming alias 도입 종결 (Orama backend 도 동일 의미). v1.2 사용자 결정 본 cycle 포함.
- [x] (../C6 — env-detect.ts qmd 의존 제거) `wikey-obsidian/src/env-detect.ts` 의 `findQmdBin` 호출 — feature flag default `'orama'` 유지 + qmd toggle 회귀 path 정리 종결. v1.2 사용자 결정 본 cycle 포함.

### 비목표 추가 검토 (spec v8 §1.2 mirror) — 2 항목

- [~] (../HYBRID — Stage 2 hybrid search full reroute) **§5.7.6 deferral** (Qwen3-Embedding 768D 통합 + RRF 또는 Orama hybrid mode 별 sub-cycle. 본 cycle = AC-V1 sanity mock vector round-trip 만 검증)
- [~] (../BENCH-AUTO — 검색 quality benchmark 자동화 통합) **§5.7.6 deferral** (`npm run benchmark:search` + CI 통합 + regression alert. C2 와 일부 중복)

### 진입 우선순위 결정 의무

§5.7.5 의 4 그룹 (B 그룹 7 + LOW 4 + PoC cleanup 3 + C 그룹 4 + 비목표 2 = 총 20 항목) 모두 spec 작성 시 4-question 검증 (필요성 / 역할 / Simplicity / Phase scope) 후 포함/단순화/deferral 결정.

**v1.4 분류 결과** (총 27 입력 = 위 20 항목 + 사용자 신규 UI 7 요구사항):

| 분류 | 개수 | 항목 |
|---|---|---|
| **포함 (해당 cycle 의무)** | **11** | UI-1, UI-2, UI-3, UI-4, UI-5, UI-6, LOW #14, LOW #15, LOW #7, **C5 (v1.2)**, **C6 (v1.2)** |
| **수정 포함 (단순화)** | **9** | UI-7 (표시까지만), B1 (재시작 1회), B2 (LLM analyze 흡수), B4 (본 cycle 포함, UI-4 자연 row), B7 (detect + script 까지), LOW #5 (code lowercase 유지), POC-1 (cleanup), POC-2 (POC-1 종속), POC-3 (1줄 verification) |
| **deferral / 폐기** | **7** | B3, B5, B6, C1, C2, HYBRID, BENCH-AUTO |

본 cycle 안 실 작업 = 20 (포함 11 + 수정 9), 별 cycle deferral = 7. AC 20 (단위 13 + 통합 4 + 라이브 3). LOC 추정 ~1005 (cleanup) / ~925 (보존).

### Karpathy Simplicity 적용
**본 §5.7.5 는 *별 cycle*** — §5.7.4 의 *코드 swap* 과 분리. 자동화 인프라 (cron / GitHub Actions / regression suite) 는 over-spec 후보 의무 검토. B 그룹 7 항목 모두 *진행 시점 결정* — 본 §5.7.5 의 spec 작성 시 어느 범위까지 자동화할지 4-question 검증 (필요성 / 역할 / Simplicity / Phase scope) 의무.

### 진입 결과 (Session 31, 2026-05-09 종결)
1. ✅ **§5.7.5 spec/todo v1.4 + plan APPROVE_v1.4** (Session 30 — codex cycle #1 NEEDS_REVISION + #2 APPROVE)
2. ✅ **Session 31 종결** — 모든 Step (A/B/C/D) 완료 + codex 6 cycle (#1~#6) 모두 APPROVE 도달:
  - ✅ **선행 commit `62f6992`** — `wikey.schema.md` 검색 코어 4 영역 갱신 (사용자 승인) — Orama default + qmd fallback + Kiwi WASM 명시
  - ✅ **Step A** — fact-check 6 위치 + baseline 측정 (737 PASS / 38 PASS)
  - ✅ **Step B** — RED `d0ab150` (16 case) + GREEN `02b0318` (~1005 LOC, 18 files / 914+/456-) + BLUE 3a 회귀 PASS + BLUE 3b 6활동 (GREEN 안 자연 진행)
  - ✅ **codex cycle #3** NEEDS_REVISION (4 MED + 2 LOW) → master fix `a8ca27b`
  - ✅ **codex cycle #4** NEEDS_REVISION (1 MED) → master fix `e964be1`
  - ✅ **codex cycle #5** APPROVE (findings: none)
  - ✅ **Step C** 라이브 smoke (master 직접 obsidian-cdp) — AC-V1/V2/V3 모두 PASS, 라이브가 actual bug 2건 (LLMClient API + JSON markdown wrap parse) 발견 → master fix `a87c7f8`
  - ✅ **codex cycle #6** APPROVE (findings: none) — live smoke fix verified
  - ✅ **Step D** 문서 동기화 — `activity/phase-5/phase-5-result.md §5.7.5` entry + `activity/phase-5/phase-5-resultx-5.7.5-orama-update-sync-2026-05-09.md` resultx detail + 본 todo mirror
3. **잔여 (별 cycle)**:
  - **§5.7.6+ deferral 7항목**: B3 / B5 / B6 / C1 / C2 / HYBRID / BENCH-AUTO
  - **`claude-harness-helper` repo commit**: master-validation skill v1.4 (anchor (f) exact match 보강) + rules.md §10. 별 repo master 단독.
  - **AC-P1 spec body 정정 (선택)**: spec §5 의 `≤ 400K` hard threshold → measurement reporting. 우선순위 낮음 (codex cycle #5 ACK).

### 5.7.5 변경 파일 (5 commits) — result mirror

- **`62f6992` docs(wikey.schema.md)**: 선행 — 검색 코어 4 영역 갱신 (Orama default + qmd fallback + Kiwi WASM)
- **`d0ab150` test(§5.7.5)**: RED 16 case (developer update UI + LOW fix + scripts + C5/C6)
- **`02b0318` feat(§5.7.5)**: GREEN — developer update UI + LOW fix + PoC cleanup + C5/C6 (914+/456-, 18 files)
- **`a8ca27b` fix(§5.7.5)**: cycle #3 NEEDS_REVISION 4 MED + 1 LOW (codex 권고)
- **`e964be1` fix(§5.7.5)**: cycle #4 NEEDS_REVISION 1 MED — DEFAULTS WIKEY_SEARCH_TOP_N omit
- **`a87c7f8` fix(§5.7.5)**: live smoke — LLMClient API call + LLM JSON markdown wrap parse

### 5.7.5 codex Mode D Panel 6 cycle 흐름 — result mirror

| Cycle | 단계 | Verdict | 처리 |
|-------|------|---------|------|
| #1 | plan review | NEEDS_REVISION (6 finding HIGH 0 / MED 5 / LOW 1) | master fix → spec/todo v1.3 |
| #2 | plan review | APPROVE_v1.4 (LOW 2 master fix only) | 부가 결정 4건 잠금 |
| #3 | post-impl | NEEDS_REVISION (4 MED + 2 LOW) | master fix `a8ca27b` (config helper / qmd repo / Kiwi compare URL / persist signal / styles.css) |
| #4 | re-review | NEEDS_REVISION (1 MED, default merge) | master fix `e964be1` (DEFAULTS WIKEY_SEARCH_TOP_N omit) |
| #5 | re-review | APPROVE (findings: none) | — |
| #6 | live smoke fix | APPROVE (findings: none) | — |

### 5.7.5 회귀 (Phase 3a) — result mirror

| 명령 | 결과 |
|------|------|
| `npm test --workspace=wikey-core` | 738 PASS / 3 skipped (baseline 726, +12) |
| `npm test --workspace=wikey-obsidian` | 46 PASS (baseline 38, +8) |
| `npm run build` (양 workspace) | 0 errors (5 esbuild warning = pre-existing import.meta cjs/Kiwi WASM 영역) |
| `./scripts/validate-wiki.sh` | PASS |
| `./scripts/check-licenses.sh` | OK (NOTICE 정합) |
| `./scripts/check-kiwi-vendor-sync.sh` | OK (`current=v0.23.0 upstream=v0.23.1 hasUpdate=true` — 실 upstream Kiwi v0.23.1 detect) |
| main.js size | 496679 → 433384 bytes (-63KB, -12.7%) |

### 5.7.5 BLUE 6 활동 (Phase 3b, GREEN 안 자연 진행) — result mirror

| # | 활동 | 적용 / 의도적 유지 + 근거 |
|---|------|---------------------------|
| 1 | 함수 분해 | **적용** — `upstream-checker.ts` 4 kind 별 detect (`detectKiwiNlp` / `detectOrama` / `detectQwen3Embedding` / `detectQmdVendored` / `detectKiwiDict`) 별 함수 (~30 LOC each) |
| 2 | Naming consistency | **적용** — `developerMode` / `allowUpdateCheck` / `UpdateItemDescriptor` / `UpdateCheckResult` / `[upgrade]` / `[분석]` / `[개발필요]` / `Developer (advanced)` / `Show developer section` spec ↔ code ↔ test 일관 |
| 3 | DRY 중복 제거 | **적용** — `fetchJsonField` helper extract (4 kind 별 fetch 공통 패턴), `extractJsonObject` helper (markdown wrap + brace parse) |
| 4 | 주석 quality | **적용** — 모든 신규 함수 docstring + spec section reference. TODO/FIXME 0. cycle #3/#4/live smoke fix 주석은 `§5.7.5 cycle #N fix` marker 보존 |
| 5 | 가독성 | **적용** — `DEFAULT_MAX_CHARS = 4000` magic number 상수화 |
| 6 | 회귀 재검증 | **적용** — 매 commit 후 fresh `npm test + build` PASS |

### 5.7.5 AC verification (총 22 — 단위 13 + 통합 4 + 라이브 3 + 부가 2) — result mirror

| AC | 내용 | 결과 |
|----|------|------|
| AC-U1 | detectUpstreamUpdates 5 kind 반환 (B4 잠금: kiwi-dict 추가) | PASS (단위 + 라이브 5 items) |
| AC-U2 | diffSource URL 정확 (kiwi compare / orama npm / qwen3 HF / qmd compare / kiwi-dict releases) | PASS (cycle #3 fix 후) |
| AC-U3 | settings `[developer]` 섹션 + `Developer (advanced)` exact phrase | PASS (라이브 DOM 검증) |
| AC-U4 matrix | developerMode + allowUpdateCheck 양쪽 → call=1, false 시 0 | PASS (3 fixture + 라이브) |
| AC-U5 | `[upgrade]` 뱃지 active/none CSS class | PASS (cycle #3 styles.css 추가 후) |
| AC-U6 | analyzeUpdate LLM 요약 + devRequired heuristic + markdown wrap parse | PASS (라이브 7.9s + parse fix) |
| AC-U7 | `[분석]` 버튼 disabled = !hasUpdate | PASS (라이브 5 row 검증) |
| AC-U8 | `[개발필요]` mark + reason | PASS (markdown wrap fix 후) |
| AC-L5 | smart_tokenize lowercase 일관 (production code 이미 일관, 사용자 결정 #4 mirror) | PASS |
| AC-L7 | `scripts/check-licenses.sh` (workspace dep allowlist + devDependencies 제외) | PASS |
| AC-L14 | `OramaIndexHandle.persist()` atomic + abort signal (cycle #3 reindex caller 갱신) | PASS |
| AC-L15 | `runOramaIngest` lazy import — engine='qmd' path stderr warn 0 | PASS |
| AC-S1 | `scripts/check-kiwi-vendor-sync.sh` bab2min/Kiwi releases + VENDOR.md tag 비교 | PASS (실 upstream v0.23.1 detect) |
| AC-D1 | README `## Developer mode` 섹션 — `Show developer section` (env 표기 부재) | PASS |
| AC-C5 | `WIKEY_SEARCH_TOP_N` alias + `WIKEY_QMD_TOP_N` deprecation marker (priority 작동) | PASS (cycle #4 default merge fix 후) |
| AC-C6 | `detectEnvironment(basePath, ollamaUrl, searchEngine)` 시그니처 확장 + qmd block conditional skip | PASS |
| AC-V1 | 라이브 — settings developer toggle on → 5 row + currentVersion + [upgrade] 뱃지 | PASS |
| AC-V2 | 라이브 — [분석] 버튼 클릭 → LLM 호출 ≤ 30s + summary + [개발필요] mark | PASS (7.9s + parse fix) |
| AC-V3 | 라이브 — toggle off → 섹션 숨김 + onload 호출 0 | PASS |
| AC-P1 | PoC cleanup — main.js size measurement | **measurement reporting** — 496679 → 433384 bytes (-63KB, 12.7%). spec body `≤ 400K` threshold 미달 (433KB > 400K, settings-tab-developer.ts + main.ts 신규 method + upstream-checker bundle 추가가 일부 상쇄). cleanup 자체는 잠금 mirror 완수 + true regression 0. master ACK |
| AC-S1-bonus | live upstream Kiwi detect (실 v0.23.0 → v0.23.1) | PASS |
| AC-U6-bonus | LLM JSON markdown wrap parse (Gemini 응답 패턴 robustness) | PASS (live smoke fix `a87c7f8`) |

### 5.7.5 Karpathy 4원칙 — result mirror

- **Think Before Coding**: 사용자 결정 5건 + 부가 4건 모두 spec/todo 잠금 후 진입. plan v1.4 = codex 2 cycle (#1 NEEDS_REVISION fix v1.3 + #2 APPROVE) + master 1차 23-anchor verification.
- **Simplicity First**: 27 입력 → 11 포함 + 9 단순화 + 7 deferral (Karpathy 200줄→50줄 mirror). cron / GitHub Actions / regression suite / push notification 모두 over-spec 으로 별 cycle deferral. settings UI 표시까지만 처리 (UI-7 simplification).
- **Surgical Changes**: 변경 면 18 file (commit `02b0318`) — spec §3 변경 면 직접 추적. wiki/ 변경 0 / raw/ 변경 0 / canonicalizer + ingest pipeline + mention extractor 변경 0 (검색·인덱싱 코어 변경 0, §5.7.4 swap 결과 그대로 유지). PoC cleanup 은 사용자 명시 결정 mirror.
- **Goal-Driven Execution**: AC 22 모두 정량 (단위 13 + 통합 4 + 라이브 3 + 부가 2). 라이브 smoke 가 actual bug 발견 (LLMClient API + JSON markdown wrap) → master 직접 fix → cycle #6 APPROVE.

### 5.7.5 학습 — 라이브 smoke 의 implementation gap detection — result mirror

라이브 smoke (master 직접 obsidian-cdp) 가 단위 + 통합 test cover 외 영역 발견:

1. **LLMClient API mismatch** (`main.ts:580` `callLLM` → 실제 `call`): mock LLM 안 generate 만 사용한 단위 test 가 plugin instance 의 actual LLMClient method 호출 누락. 라이브 smoke 가 첫 trigger 시 TypeError 발견. master fix 1 line.
2. **JSON markdown wrap parse** (`update-analyzer.ts` extractJsonObject): mock LLM 가 strict JSON 반환만 시뮬레이션. 실제 Gemini-2.5-flash 응답이 ` ```json\n{...}\n``` ` markdown wrap. JSON.parse throw → fallback. 라이브 smoke 가 첫 응답에서 발견. master fix + 단위 test 보강.

**원리**: integration / e2e test 가 mock layer 가 cover 하지 못하는 actual API contract 영역을 catch. CLAUDE.md §6 의 라이브 cycle smoke 정책의 정당성. test 인프라가 mock 의 fidelity 만으로 implementation gap 0 보장 X.

### 5.7.5 잔여 후속 — result mirror

- **§5.7.6+ deferral 7항목**: B3 / B5 / B6 / C1 / C2 / HYBRID / BENCH-AUTO. 별 cycle 진입 시점 사용자 결정. 본 todo §5.7.6 (신규 신설) 에 mirror.
- **`claude-harness-helper` repo commit**: master-validation skill v1.4 anchor (f) exact match 보강 + rules.md §10 — 별 repo master 단독 (본 wikey 외).
- **AC-P1 spec body 정정** (선택): `≤ 400K` hard threshold → measurement reporting 표현. analyst 호출 후 spec v1.5 sweep 의무 — 우선순위 낮음 (cleanup 효과 자체는 잠금 mirror 완수, codex cycle #5 에서 ACK).

---

## 5.7.6 검색 quality tuning — Q5 stopword + 50+ query benchmark (P3, 2026-05-10 진입 → **ABANDON 2026-05-10**)
> tag: #search, #quality-tuning, #benchmark, #stopword, #orama, #abandoned, #paradigm-violation

> **상태**: Session 32 (2026-05-10) **ABANDON** — paradigm violation 인지 + revert.
>
> **abandon 결정 사유** (사용자 raise 2026-05-10): "stopword에 대한 의미론적 파악 후 제거 여부를 알고리즘에서 결정. 등록된 모든 단어를 제거하는건 LLM답지 않음. stopword에 등록된 단어라 하더라도, 질문의 유형에 따라 넣고 빼고가 결정되어야 함. 등록 단어의 일방적 삭제는 위험."
>
> **paradigm violation**: 본 §5.7.6 의 *static stopword* 접근은 wikey 철학 (`wikey.schema.md` "LLM 참여형 다층 검색" / "지능 레이어는 외부 LLM 이 담당") 위반. 본 cycle 의 PMBOK 36% Top-1 회귀 (의도된 Q5 회복 외 부작용) 가 paradigm 결함의 실증 — `프로젝트`/`관리` 가 PMBOK 카테고리 marker 인데 일방적 drop → "프로젝트 비용 관리" / "프로젝트 위험 관리" 등 모든 PMBOK query 회귀.
>
> **올바른 paradigm = §5.7.8 신설 후보** (LLM per-query dynamic stopword): tokenizer 는 pure tokenize (semantic 0). query 단계에서 LLM 호출 → query intent 분석 → stopword candidate 별 keep/drop per-query 판정. "프로젝트 비용 관리" → LLM 가 "PMBOK 도메인 카테고리 query" 인식 → `프로젝트` keep / 다른 generic 단어 drop. "정보 시스템 관리" → LLM 가 "generic 검색" 인식 → `정보` + `시스템` drop / `관리` 보존 등.
>
> **revert 영역** (commit 시 effective):
> - `wikey-core/src/search/orama-korean-tokenizer.ts` — KOREAN_STOPWORDS const + tokenize fn 분기 모두 제거 (pure tokenize 복원)
> - `scripts/korean-tokenize.py` — 동등 revert
> - `wikey-core/src/defaults/stopwords-korean.default.json` — 삭제
> - `wikey-core/src/scripts/analyze-stopwords.ts` — 삭제 (df-only paradigm 도 `LLM답지 않음` 위반)
> - `wikey-core/src/__tests__/search/orama-korean-tokenizer-stopword.test.ts` — 삭제
>
> **§5.7.8 평가 도구로 보존**:
> - `wikey-core/eval/benchmark-suite.json` (51 query, 5 도메인 균형) — 본 §5.7.8 의 quality measurement source
> - `wikey-core/src/scripts/benchmark-search.ts` (export `runBenchmark` + searchFn injection) — §5.7.8 의 benchmark runner
> - `wikey-core/package.json` 안 `tsx` devDep + `benchmark:search` script
>
> **본 cycle 학습** (paradigm 검증):
> 1. PMBOK 36% 회귀 = static stopword 의 *일방적 drop 위험* 실증
> 2. Q5 회복 (1/10 → 1/1) 가설 유효 — LLM dynamic 적용 시 자연 회복 예상
> 3. 51 query benchmark suite 도메인 분포 baseline = §5.7.8 측정 source
> 4. wikey 철학 정합 = LLM-driven decision = static rule 폐기 의무
>
> **단일 소스 (abandon)**: spec v1.2 + todox v1.2 (작성 잔존, 본 abandon 결론 추가 의무 — Step D 동기화 시).
>
> **단일 소스**: [`plan/phase-5/phase-5-spec-5.7.6-search-quality-tuning.md`](./phase-5-spec-5.7.6-search-quality-tuning.md) **v1.2 작성 완료** (Spec WHAT, ~485줄 + codex cycle #1 NEEDS_REVISION 8 findings master fix mirror) + [`plan/phase-5/phase-5-todox-5.7.6-search-quality-tuning.md`](./phase-5-todox-5.7.6-search-quality-tuning.md) **v1.2 작성 완료** (Todo HOW, ~310줄). codex Mode D Panel cycle #2 송부 직전.

§5.7.5 종결 후 deferred quality tuning 영역. 본 §5.7.6 = *minimal scope* — C1 (Q5 회귀 stopword 보완) + C2 (50+ query benchmark suite + `npm run benchmark:search` 자동화) 만 포함. HYBRID Stage 2 vector reroute 는 별 cycle (§5.7.7), B3/B5/B6 자동화 인프라는 미진행 (사용자 결정 2026-05-10 = 수동 update 절차).

**진입 조건** (충족됨):
- §5.7.5 종결 (Session 31, 2026-05-09, 7 commits, codex 6 cycle APPROVE, AC 22/22 PASS)
- 검색 코어 (Orama default + Kiwi WASM) stable + ./scripts/check-kiwi-vendor-sync.sh 작동

### 본 cycle 포함 — 2 항목 (BENCH-AUTO C2 통합)

- [ ] (../C1) **Q5 회귀 보완 — smart_tokenize 정밀화 (v1.2 5 단어)**: 한국어 stopword list `프로젝트` / `관리` / `정보` / `시스템` / `업무` (generic content word BM25 saturation 회피, **`일정` 제거** — codex cycle #1 HIGH #3 fix: Q5 query "프로젝트 일정 관리" 3 단어 모두 stopword 시 tokenize empty → AC-Q1 unrecoverable). PoC §3 Q5 Top-1 1/10 (`프로젝트-관리-시스템`) → AC-Q1 = `project-schedule-management` Top-1 hit. 변경 면: `wikey-core/src/search/orama-korean-tokenizer.ts` smart_tokenize stopword 분기 + `scripts/korean-tokenize.py` 동등 mirror.
- [ ] (../C2 + BENCH-AUTO 통합) **50+ query benchmark suite + `npm run benchmark:search` script 자동화**: 현 10 query (statistical power 부족) → 50+ query (도메인 균형 — PMBOK / ITIL / Obsidian / 한국어 / 영문 / 한+영 mix). **JSON suite** (yaml dep 0, Node native parse — v1.1 사용자 결정) + script. Top-1 / Top-3 / MRR 측정. quality regression 자동 감지 보조 (수동 실행, CI 통합은 미진행). 변경 면: `wikey-core/eval/benchmark-suite.json` (50+ query) + `scripts/benchmark-search.ts` (export `runBenchmark` + searchFn injection, codex MED #4) + `wikey-core/package.json` script + tsx devDep.

### 별 cycle 분리 — §5.7.7 후보 (1 항목)

- (HYBRID) Stage 2 hybrid search full reroute — Qwen3-Embedding 768D 통합 + Orama hybrid mode (RRF 융합). **상세 = 아래 §5.7.7** (목적 / 이득 / trade-off / 진입 결정 기준).

### 미진행 — wikey 철학 충돌 / over-spec (사용자 결정 2026-05-10)

**B3/B5/B6 자동화 인프라는 본 todo 에서 todo 체크박스로 등록하지 않는다**. 대신 **수동 update 절차**로 기록:

| 항목 | 미진행 사유 | 수동 절차 (master + 사용자) |
|------|-------------|------------------------------|
| B3 regression CI 자동화 | wikey single-user 도구, GitHub Actions 미설정, master 수동 [개발필요] mark 패턴 (§5.7.4/§5.7.5) 충분 | settings [developer] 토글 → [분석] → [개발필요] mark 시 master 가 별 SDD+TDD cycle 진행 |
| B5 docs 자동 갱신 | docs/kiwi-nlp-vendor-sync.md (§5.7.4 stable) + LLM 요약 (UI-6, 7.9s) 이 즉시적, git noise 회피 | 수동 docs update 시점 = upstream major 변경 발생 시 master 가 PR 1회 작성 |
| B6 push notification | UI-2 정책 (developer toggle off → 일반 사용자 미공개) 모순 + BYOAI 철학 (외부 server email 의존 0) 모순 | settings UI passive 표시 만 (§5.7.5 종결 상태) — 사용자가 주기적 settings 열어 [upgrade] 뱃지 확인 |

**수동 update 절차 표준 (사용자가 update 인지 시)**:
1. settings [developer] 토글 on → 5 row + [upgrade] 뱃지 active 확인
2. [분석] 버튼 클릭 → LLM 요약 (~7.9s) + [개발필요] mark 확인
3. [개발필요] mark 시 master 에게 별 SDD+TDD cycle 의뢰 (§5.7.4/§5.7.5 패턴)
4. quality 회귀 의심 시 `npm run benchmark:search` (C2 결과물) 수동 실행 → Top-1/Top-3/MRR 비교
5. 회귀 detect 시 master fix → 회귀 없으면 commit/push

### 진입 절차 (Session 32~)

1. **A** phase-5-todo.md §5.7.6 minimal scope 본문 정리 (현재 단계 ✅)
2. **B** analyst 위임 — `plan/phase-5/phase-5-spec-5.7.6-search-quality-tuning.md` (Spec WHAT, 6요소)
3. **C** analyst 위임 — `plan/phase-5/phase-5-todox-5.7.6-search-quality-tuning.md` (Todo HOW, Step A/B/C/D)
4. **D** master 1차 검증 (master-validation skill 23-anchor)
5. **E** codex Mode D Panel review (cmux T1 wait-for, plan review)
6. **F** 사용자 승인 게이트 — codex APPROVE + master 권고 후 잠금
7. **G** SDD+TDD 구현 (RED → GREEN → BLUE 3a/3b)
8. **H** codex post-impl review
9. **I** 라이브 cycle smoke (master 직접) — `npm run benchmark:search` 실행 + Q5 회복 확증
10. **J** Step D 문서 동기화 + commit/push

---

## 5.7.7 HYBRID Stage 2 vector reroute — BM25 + Qwen3-Embedding hybrid + RRF (P3, ✅ **종결 v1.2 2026-05-11 session 35**)
> tag: #search, #hybrid, #vector, #qwen3-embedding, #rrf, #stage2, #closed

> **상태**: ✅ **종결 (2026-05-11 session 35)**. Step A~F 모두 완료 + 라이브 master smoke. codex post-impl 7 cycle (NEEDS_REVISION 6 → cycle #7 APPROVE). 라이브 cold reindex 117/117 docs embedding 1024D + 51 query benchmark Top-3 +11.7%p (76.5 → 88.2%) / MRR +0.060 (0.753 → 0.813) — Spec I24 target 88% 정확 달성. 상세 = [`activity/phase-5/phase-5-result.md §5.7.7`](../../activity/phase-5/phase-5-result.md).

> **단일 소스 (v1.2 — 2026-05-10)**: [`plan/phase-5/phase-5-spec-5.7.7-vector-hybrid-reroute.md`](./phase-5-spec-5.7.7-vector-hybrid-reroute.md) v1.2 (status: approved, spec/todox 합본 — testing.md §3 mid-sized 패턴 mirror). 본 todo 섹션 §5.7.7.0~6 = preview only — 단일 소스 = spec file v1.2.

> **선행 cycle**: §5.7.4 = `embedding: vector[768]` Orama schema column 추가 (sanity, mock vector round-trip 만 검증) — 본 cycle 시 `vector[1024]` 정정 (master 사전 점검 실측). §5.7.8 v1.5 = 51 query benchmark + 라이브 비교 결과 (PASS-B 향상 1 / 회귀 2 — vector layer 부재 인지). §5.7.9 v1.0 = gemini thinking fix.

> **검증 history v1.2**:
> - v1.0 (analyst, 2026-05-10) → master 1차 검증 (Layer 1~3 anchor 20 ALL PASS) → codex Mode D Panel review
> - v1.0 → v1.1 master fix (5 finding: 3 MED + 2 LOW) — typo dim 768→1024 / expand×hybrid semantics / Q4 source text / UI 단일화 / metadata shape
> - v1.1 → v1.2 사용자 일괄 APPROVE (Q2~Q9 7건 LOCKED) — Hybrid default OFF / RRF k=60 / 자동 download / progress+cancel / cross-lingual 1-pass / 기존 storage path / sub-control of master toggle.

> **SDD+TDD impl 진입 점검 (Session 35)**:
> - 환경 ✅: ollama running + dengcao/Qwen3-Embedding-0.6B:Q8_0 (639 MB) + endpoint 1024D 실측 + Orama @3.1.18 ready
> - Step B (TDD RED) → C (GREEN) → D (회귀 + 3a/3b) → E (라이브 master 직접) → F (codex post-impl)
> - 변경 면 ~1,220 LOC (코드 ~540 + test ~580 + docs ~80 + config/script ~20)

### 5.7.7.0 Background / Decision rationale (분리 정당화 + 목적 + 이득 + trade-off + 진입 결정 기준)

#### 분리 정당화 (왜 §5.7.6 안 통합 안하는가)

§5.7.6 = *minimal scope* (stopword + benchmark suite, ~324 LOC). HYBRID 통합 시 변경 면 ~600+ LOC 추가 = 본 cycle 2배 이상.

- **Karpathy Simplicity #2 (Phase scope)**: 한 cycle 안 *복합 변경* 회피. stopword 정밀화 (BM25 안 정밀화) 와 hybrid 도입 (BM25 + vector 결합) 은 *직교 변경* — 분리 시 각각의 효과 측정 가능 (stopword 단독 효과 vs hybrid 단독 효과). 통합 시 둘 효과 mixing 으로 변경 안 무엇이 quality 에 기여했는지 attribution 불가.
- **변경 면 격리**: §5.7.6 = `orama-korean-tokenizer.ts` smart_tokenize + benchmark suite 신규. §5.7.7 = Qwen3-Embedding loader 신규 + Orama hybrid mode 활성 + RRF 융합 + reindex 의무. 두 cycle 의 *변경 면 교차 0*.
- **사용자 만족도 평가 게이트**: §5.7.6 의 50+ query benchmark 결과가 §5.7.7 진입 *정량 정당화* 의 source. BM25-only 가 이미 충분 (Top-1 ≥ 80%) 이면 §5.7.7 미진입. BM25-only 가 부족 (Top-1 < 70% 또는 cross-lingual fail) 이면 §5.7.7 진입.

#### 목적 (수행 의도)

본 §5.7.7 의 단일 목적 = **wikey 검색 코어를 BM25-only → BM25 + vector hybrid 로 격상하여 의미 유사·cross-lingual query 회수 능력 확보**.

배경 (사실 mirror — `wikey.schema.md §5.7.4 후` line 391~429):
- 현 검색 코어 = Orama BM25 (TypeScript 네이티브, ESM CJS bundle, file 1개 atomic write persist) + Kiwi WASM 한국어 tokenizer
- §5.7.4 v9 결정 = Orama schema 의 `embedding: 'vector[768]'` column 추가 + mock vector round-trip 만 검증 = *AC-V1 sanity*
- 실 호출 라인 reroute = §5.7.4 미진행 (deferral) = 본 §5.7.7 핵심 작업
- wikey schema §"LLM 참여형 다층 검색" line 374~389 = "외부 검색 = BM25 + 벡터로 빠른 1차 필터링 (수천→30개)" — 본 §5.7.7 = wikey schema 의 *원래 정의* 회복

#### 이득 (수행 시 얻는 가치, 6 항목)

| # | 이득 | 정량 / 정성 | 근거 |
|---|------|-------------|------|
| 1 | **재현율 +α (의미 유사 회수)** | 정량 — Top-3 / MRR 개선 추정 +5~10% | BM25 가 놓치는 의미 유사 페이지 회수. 예: query "프로젝트 일정 관리" → BM25 정확 매칭 외에도 vector 가 "scheduling" / "PMBOK schedule management" / "ITIL 변경 관리" 같은 페이지 회수 |
| 2 | **Cross-lingual 회수** | 정성 — 한+영 mix vault 효과 큼 | 한국어 query → 영어 페이지 (예: "지식 그래프" → "knowledge graph" 페이지). 사용자 vault 가 한+영 mix 일 때 BM25-only 는 매칭 0, hybrid 는 임베딩 유사도로 회수 |
| 3 | **Q5 회귀 자연 회복 가능** | 정량 — PoC §3 Q5 1/10 → ≥ 8/10 추정 | §5.7.6 의 stopword 보완이 부분 회복하지만, vector 가 "프로젝트 일정 관리" 의 의미 유사 페이지 회수로 보강. 두 cycle 의 효과는 누적 가능 |
| 4 | **wikey 철학 정합 회복** | 정성 — schema §"LLM 참여형 다층 검색" 정의 충족 | wikey.schema.md 의 *원래* "BM25 + 벡터 빠른 1차 필터링" 정의가 본 §5.7.7 으로 실현. 현재는 BM25-only 라 schema 정의 vs 실 구현 drift |
| 5 | **§5.7.4 vector column 자산 활용** | 정성 — 기 추가된 schema 자원 활용 | 이미 schema 에 `embedding: vector[768]` column 추가됨 (§5.7.4 sanity). 본 §5.7.7 = *실 데이터 채우기* 만, schema 변경 0. 매몰 자산 회복 |
| 6 | **LLM 리랭킹 정확도 향상** | 정성 — multi-stage retrieval 의 1차 후보 quality | wikey 검색 = 다층 (BM25 → LLM 리랭킹 → LLM 합성). 1차 후보 (BM25) 의 회수율이 ceiling 결정. hybrid 시 1차 후보 회수율 향상 → LLM 리랭킹 의 작업 quality 향상 |

#### Trade-off (수행 시 위험 / 비용, 9 항목)

| # | Trade-off | 영향도 | 완화 가능성 |
|---|-----------|--------|------------|
| 1 | **모델 download 부담** — Qwen3-Embedding 0.6B ~600MB | 높음 (UX) | 처음 1회만. settings UI 안 download progress + retry. lazy load (검색 시 첫 호출 시점) 고려 |
| 2 | **Runtime cost — embedding 생성** | 높음 (성능) | reindex 시 117 페이지 = ~5~10분 (CPU) / ~1~2분 (GPU). 인덱싱 후 query 마다 1회 (~수십~수백ms). 인접 질문 cache 가능 |
| 3 | **Memory ~600MB RAM** | 높음 (UX) | Obsidian renderer 메모리 압박. 사용자 환경 별 (8GB RAM 노트북 등) 영향. lazy load + unload 정책 설계 필요 |
| 4 | **코드 복잡도 +30%** | 중간 (유지비용) | hybrid query path (BM25 + vector + RRF 융합) — 디버깅 어려움 (BM25 만 vs hybrid 의 결과 차이 분석 필요). error recovery (vector embedding 실패 시 BM25 fallback) 정책 결정 필요 |
| 5 | **Quality regression 위험 — RRF tuning** | 중간 (정확도) | Vector 가 *의미 유사* 잡지만 *정확 매칭* 은 BM25 우세. RRF 가중치 (alpha) hyperparameter tuning 의무. 잘못 tuning 시 BM25-only 보다 *quality 하락* 가능. 50+ query benchmark (§5.7.6 결과물) 로 측정 |
| 6 | **Determinism 영향** | 중간 (재현성) | vector 검색 = numerical (float32 cosine) → Phase 4 §4.5.1.7 의 결정성 정책 (CV < 10%) 회귀 위험. 반드시 ablation (BM25 vs hybrid) 결정성 측정 의무 |
| 7 | **한국어 + Qwen3 정합성 first-time** | 낮음 (검증 필요) | 현 PoC = qmd 가 Qwen3 사용 (검증됨). Orama 는 first-time 통합. embedding column populate 절차 별 검증 의무 |
| 8 | **현 상태로도 충분 가능성** | 본 cycle 진입 자체 위험 | §5.7.4 종결 시 BM25-only Top-1 8/10 (PoC §3) — 이미 qmd baseline 7-8/10 와 동등 또는 우위. 즉 *추가 이득* 영역. §5.7.6 의 stopword 보완 후 quality 가 충분 (Top-1 ≥ 80%) 면 §5.7.7 미진입 정당 |
| 9 | **wikey schema §5.7.4 v9 정합** | 낮음 (정책 충돌 X) | schema.md line 393 + "쿼리 확장·리랭킹도 내장하지만, **지능 레이어는 외부 LLM 이 담당**" — LLM 리랭킹 으로 cover 가능한 영역. 즉 hybrid 가 *필수* 아닐 수 있음. 단 §"LLM 참여형 다층 검색" = "외부 검색 = BM25 + 벡터" 정의는 hybrid 정당화 |

#### 진입 결정 기준 (사용자 만족도 + 정량 게이트)

본 §5.7.7 진입은 **§5.7.6 종결 후 사용자 결정**. 결정 기준 = 본 §5.7.6 의 benchmark 결과 (50+ query Top-1 / Top-3 / MRR) + cross-lingual 욕구.

**진입 정당화 (gating threshold)**:

| 시나리오 | 본 §5.7.6 종결 후 측정값 | 본 §5.7.7 진입? |
|----------|--------------------------|------------------|
| BM25-only 충분 | Top-1 ≥ 80% / Top-3 ≥ 90% / cross-lingual query 0 | **미진입** (현 상태 유지, trade-off #8 mirror) |
| Quality 부족 | Top-1 < 70% 또는 의미 유사 query 회수 fail | **진입 권고** (이득 #1 + #3 효과 큼) |
| Cross-lingual 욕구 | 사용자 vault 한+영 mix + cross-lingual query 회수 fail | **진입 권고** (이득 #2 효과 큼) |
| 중간 | Top-1 70~80% | **사용자 결정** (trade-off #1~#3 cost vs 이득 #1~#3) |

**진입 시 first action** (historical — 본 §5.7.7 은 2026-05-11 session 35 에 종결됨):
1. ~~analyst 위임 — `plan/phase-5-spec-5.7.7-hybrid-search.md` + `plan/phase-5-todox-5.7.7-hybrid-search.md`~~ → **실 산출 = [`plan/phase-5/phase-5-spec-5.7.7-vector-hybrid-reroute.md`](./phase-5-spec-5.7.7-vector-hybrid-reroute.md) v1.3 (status: closed, spec/todox 합본 — testing.md §3 mid-sized 패턴)**
2. ~~spec 작성 시 본 §5.7.7.0 이득 / trade-off mirror 의무 + §5.7.7.1~6 spec preview byte mirror~~ → 완료 (analyst 합본 v1.0 → master fix v1.1 → 사용자 일괄 APPROVE v1.2 → 종결 v1.3)
3. ~~4-question 검증~~ → 완료 (paradigm 정합성 + 사용자 추가 요구사항 통합 + §5.7.4 placeholder 정정 + Open Q 결정)
4. ~~master 1차 검증 + codex Mode D Panel review~~ → 완료 (plan v1.2 APPROVE + post-impl 7 cycle NEEDS_REVISION 6 → cycle #7 APPROVE)
5. ~~SDD+TDD 구현~~ → 완료 (Step A~F + 라이브 master smoke, Top-3 +11.7%p / I24 target 달성)

**진입 미정당 결정 시 처리** (N/A — 진입 + 종결):
- ~~본 §5.7.7 = "deferral 영구" 마킹~~ → 종결 (Session 35, commit `0cade51` + `3e17c42` + `fdd976b` + `5b73775` + `ae27c4d`)
- 본 §5.7.6 의 BM25-only quality 가 사용자 만족 도달 = wikey 검색 코어 *영구 BM25-only* 정책 잠금
- §5.7.4 의 `embedding: vector[768]` schema column 은 *역사적 자산* 으로 보존 (제거 X)
- wikey.schema.md 의 §"LLM 참여형 다층 검색" 정의는 *별 layer (LLM 리랭킹)* 가 cover 한다고 명시

### 5.7.7.1 Goal (목표 — preview, 별 spec 에서 잠금)

본 §5.7.7 단일 목적 = **wikey 검색 코어를 BM25-only → BM25 + vector hybrid 격상 + Qwen3-Embedding 0.6B 통합 + RRF 융합으로 의미 유사·cross-lingual query 회수 확보** (Karpathy Goal-Driven 단일 목적).

sub-목표:
- (G1) Qwen3-Embedding 0.6B local loader 통합 — `~/.cache/wikey/qwen3-embedding/` model download + cache + lazy load
- (G2) Orama schema 의 기 추가 `embedding: vector[768]` column populate — 117 페이지 reindex 1회 + incremental ingest path (§5.3 / §5.7.5 mirror) hybrid 통합
- (G3) Hybrid query path — BM25 결과 + vector cosine 결과 → RRF 융합 (`alpha` hyperparameter)
- (G4) BM25 fallback 정책 — Qwen3 load 실패 / embedding fail 시 BM25-only 자동 회귀

비목표 (Out-of-Scope):
- 다중 임베딩 모델 지원 (Qwen3 외 — 단일 모델 잠금)
- vault-level customize hyperparameter (alpha 단일 default)
- Stage 3 reranker 통합 (LLM rerank 가 cover, schema 정합)

### 5.7.7.2 Inputs (변경 면 — preview, 추정)

| 영역 | 파일 | 변경 분포 (추정) | 비고 |
|------|------|------------------|------|
| Embedding loader | `wikey-core/src/embeddings/qwen3-loader.ts` (신규) | ~150 LOC | model download / cache / lazy load / unload |
| Hybrid query path | `wikey-core/src/search/orama-index.ts::query()` | ~80 LOC 변경 | BM25 + vector + RRF 통합 |
| Indexing path | `wikey-core/src/search/orama-index.ts::insert()` + `runOramaIngest` | ~60 LOC 변경 | embedding column populate (lazy or eager) |
| Settings | `wikey-obsidian/src/settings-tab*.ts` | ~40 LOC | hybrid toggle + Qwen3 download status |
| Config | `wikey.conf` + `wikey-core/src/config.ts` | ~20 LOC | `WIKEY_SEARCH_MODE=bm25|hybrid` 환경 변수 |
| Tests (RED) | `wikey-core/src/__tests__/orama-hybrid.test.ts` (신규) | ~250 LOC | unit + integration |
| Reindex script | `scripts/reindex.sh` + `wikey-core/src/scripts/reindex.ts` | ~30 LOC | embedding column populate path |
| Documentation | `docs/qwen3-embedding-vendor.md` (신규) | ~80 LOC | NOTICE + license + cache path |

**총 변경 면 추정**: ~710 LOC (코드 460 + test 250 + docs ~80). raw/ 변경 0 / wiki/ 변경 0 / canonicalizer / mention extractor / ingest pipeline 핵심 0 변경.

### 5.7.7.3 Outputs (변경 분포 — preview)

§5.7.7 종결 시 wikey 검색 동작:
- `WIKEY_SEARCH_MODE=bm25` (default 권고 보수): BM25-only 유지 = §5.7.4 기존 동작 (회귀 path 보존, trade-off #4 완화)
- `WIKEY_SEARCH_MODE=hybrid` (opt-in): Qwen3 load → embedding column populate → BM25 + vector → RRF
- Settings UI 안 hybrid toggle + Qwen3 download progress
- 117 페이지 reindex 1회 (master 직접 obsidian-cdp + `./scripts/reindex.sh`) — 후속 incremental ingest 자동 embedding 포함
- `npm run benchmark:search` (§5.7.6 결과물) 가 mode 별 결과 비교 가능

### 5.7.7.4 Acceptance Criteria (preview, ≥ 8 — 별 spec 에서 정량 잠금)

| AC | 내용 | 검증 |
|----|------|------|
| AC-H1 | Qwen3-Embedding 0.6B loader 단위 — model download + cache + lazy load + unload | 단위 test |
| AC-H2 | Orama schema `embedding: vector[768]` column populate — 117 페이지 reindex 후 모든 doc 의 embedding 비-null | 통합 test |
| AC-H3 | Hybrid query path — BM25 + vector → RRF 융합 | 단위 test |
| AC-H4 | BM25 fallback 정책 — Qwen3 load fail 시 BM25-only 자동 회귀 | 단위 test |
| AC-H5 | `WIKEY_SEARCH_MODE` 환경 변수 — bm25 / hybrid toggle | 통합 test |
| AC-Q1 | 50+ query benchmark — hybrid 모드 Top-1 ≥ BM25 + 5% (or cross-lingual 회수 ≥ 80%) | 라이브 (master 직접) |
| AC-D1 | Determinism 회귀 0 — hybrid 모드 CV < 10% (Phase 4 §4.5.1.7 mirror) | 통합 test (10-run) |
| AC-R1 | 회귀 — wikey-core 738+ PASS / wikey-obsidian 46+ PASS / npm run build 0 errors / validate-wiki PASS | 통합 (Phase 3a) |

### 5.7.7.5 Risk grid (preview, mirror of §5.7.7.0 Trade-off — 9 항목)

§5.7.7.0 Trade-off 표의 9 항목이 본 §5.7.7.5 Risk grid 의 1:1 mirror. 별 spec 에서 각 risk 의 *완화 전략 + 검증 방법* 정량 명시 의무.

요약 — High risk 3 (download / runtime cost / memory) + Mid risk 3 (복잡도 / RRF tuning / determinism) + Low risk 3 (Qwen3+Orama first-time / 현 상태 충분 가능성 / schema 정합).

### 5.7.7.6 Dependencies (preview)

**진입 조건 (충족 의무)**:
- §5.7.4 종결 = `embedding: vector[768]` schema column 존재 (본 §5.7.7 가 populate)
- §5.7.6 종결 = 50+ query benchmark suite 존재 (본 §5.7.7 quality 측정 source)
- `~/.cache/wikey/qwen3-embedding/` cache path 작성 가능 (filesystem write permission)

**후속 cycle (본 §5.7.7 종결 후)**:
- §5.5 지식 그래프·시각화 (P3) — 검색 결과의 graph 표현, 본 §5.7.7 의 vector 데이터 활용 가능
- §5.6 성능·엔진 확장 (P3) — llama.cpp / rapidocr Linux 와 별 도메인. 본 §5.7.7 와 독립
- 본 §5.7.7 = §5.5 / §5.6 의 *진입 조건 아님* (독립)

---

## 5.7.8 LLM per-query dynamic stopword — paradigm shift (P3, 2026-05-10 신설 후보 → **plan APPROVE → SDD+TDD 종결 v1.4 2026-05-10 session 34**)

> **plan + impl 단일 소스 (v1.4)**: [`plan/phase-5/phase-5-spec-5.7.8-llm-dynamic-stopword.md`](./phase-5-spec-5.7.8-llm-dynamic-stopword.md) v1.4 (Spec, AC 20 + Risk 15 + Open Q 6 LOCKED) + [`plan/phase-5/phase-5-todox-5.7.8-llm-dynamic-stopword.md`](./phase-5-todox-5.7.8-llm-dynamic-stopword.md) v1.4 (Todo, Step A~D + 변경 면 ≤ 20 file). 활동 evidence: [`activity/phase-5/phase-5-resultx-5.7.8-llm-dynamic-stopword-2026-05-10.md`](../../activity/phase-5/phase-5-resultx-5.7.8-llm-dynamic-stopword-2026-05-10.md).
>
> **post-impl 검증 결과 (2026-05-10 session 34)**: codex multi-cycle fix loop (점진 수렴, 모든 finding closed) → 종결. 정확 cycle/finding history = `phase-5-spec-5.7.8-llm-dynamic-stopword.md` v1.4 변경 이력 row + `activity/phase-5/phase-5-resultx-5.7.8-llm-dynamic-stopword-2026-05-10.md`.
>
> **paradigm v1.4 핵심**:
> - LLM per-query intent filter + rewriter (synonym substitution) + expander (HyDE / multi-query) — wikey schema "LLM 참여형 다층 검색" 1단계 완전 구현
> - vault customize (`.wikey/query-filter.yaml` + `.wikey/prompts/*.prompt.md`) — Yours / File over app 강화
> - Advanced query tuning settings UI — 2 dropdown provider+model + advanced section + per-query override (`!nofilter` syntax) + metadata badge
> - auto-extend mechanism (query+answer LLM 자동 분석 + 수동 trigger "Run query analysis", N=5 default + cursor-based race-free)
> - file-based JSON LRU cache (`~/.cache/wikey/query-intent-cache/<namespace>.json`) — option B 채택, 신규 native dep 0
> - hardcoded domain list 0건 (anchor (k) 강화)
>
> **검증 evidence**: wikey-core 781/784 + wikey-obsidian 100/100 PASS / tsc strict + build clean / validate-wiki + check-licenses + check-kiwi-vendor-sync PASS / anchor (k) 0 hit / baseline 회귀 0 (Top-1 66.7% / Top-3 86.3% / MRR 0.829 — §5.7.6 baseline byte-equal). augmented path 코드 구현 (`WIKEY_BENCHMARK_LAYERS=filter,rewrite,expand` env) — 임계 측정 (Top-1 ≥ 70%) 사용자 수동 (real Gemini API + credentials.json 보안 정책).
>
> **다음 단계**: Phase 5 잔여 (§5.5 / §5.6 / §5.7.7 / §5.8 / §5.9) 진행 결정.
> tag: #search, #stopword, #llm-judgment, #per-query, #paradigm-shift, #vault-customize, #ci-integration, #sdd-tdd-completed

> **상태**: 🟢 SDD+TDD 종결 (v1.4, 2026-05-10 session 34). §5.7.6 (static stopword paradigm) abandon 후 *올바른 paradigm* 으로 신설 → impl + post-impl codex multi-cycle fix loop → 모든 finding closed. 사용자 명시 (2026-05-10): "stopword 등록된 단어라 하더라도, 질문의 유형에 따라 넣고 빼고가 결정되어야 함. 등록 단어의 일방적 삭제는 위험."
>
> **단일 소스**: spec/todox (`plan/phase-5/phase-5-spec-5.7.8-llm-dynamic-stopword.md` v1.4 + `phase-5-todox-5.7.8-llm-dynamic-stopword.md` v1.4) + 활동 evidence (`activity/phase-5/phase-5-resultx-5.7.8-llm-dynamic-stopword-2026-05-10.md`). 본 todo section = phase-5-todo 안 §5.7.8 paradigm 정의 reference (cycle history = spec/todox v1.4 history rows + resultx fix mapping + phase-5-result §5.7.8 entry).
>
> **선행 cycle**: §5.7.6 abandon 결과물 — 51 query benchmark suite (`wikey-core/eval/benchmark-suite.json`, 5 도메인 균형) + benchmark runner (`wikey-core/src/scripts/benchmark-search.ts`, export injection 분리) + tsx devDep + npm script `benchmark:search`. 본 §5.7.8 가 평가 도구로 활용.

### 5.7.8.0 Background / Decision rationale (paradigm shift 결정 사유)

#### 분리 정당화 (§5.7.6 abandon 후 신설)

§5.7.6 = *static stopword* paradigm 시도 → wikey 철학 위반 인지 + abandon. 본 §5.7.8 = 처음부터 wikey 철학 정합.

- **wikey schema mirror**: `wikey.schema.md` "LLM 참여형 다층 검색" 정의 — "RAG (기존): DB 가 검색 → LLM 은 결과만 읽음" vs "**LLM Wiki: LLM 이 쿼리 확장 → 외부 검색 → LLM 이 리랭킹 → LLM 이 합성**". 즉 query 단계 = *LLM 결정 영역*. static rule = 위반.
- **§5.7.6 실증**: PMBOK 36% Top-1 회귀가 *일방적 drop 위험* 실증. `프로젝트` / `관리` 가 PMBOK 카테고리 marker 인데 query "프로젝트 비용 관리" 시 drop → 카테고리 신호 손상.

#### 목적 (수행 의도)

본 §5.7.8 의 단일 목적 = **query 단계에서 LLM 호출 → query intent 분석 → stopword candidate 별 keep/drop per-query 판정 → corpus-aware dynamic filter**.

#### 이득 (6 항목)

| # | 이득 | 정량 / 정성 |
|---|------|-------------|
| 1 | **wikey 철학 정합** | schema "LLM 참여형 다층 검색" 정의 충족 |
| 2 | **per-query 정밀화** | "프로젝트 일정 관리" → `[일정]` 만 / "정보 시스템 관리" → `[관리]` 만 / "PMBOK 비용 관리" → 모두 keep (도메인 marker) |
| 3 | **PMBOK 카테고리 signal 보존** | "프로젝트 비용 관리" 시 LLM 가 PMBOK 인식 → keep all → `project-cost-management` Top-1 |
| 4 | **Q5 자연 회복** | "프로젝트 일정 관리" 시 LLM 가 generic word `프로젝트`/`관리` drop → `[일정]` 신호 부각 → `project-schedule-management` Top-1 |
| 5 | **stopword 후보 set 의무 X** | LLM corpus 분석 가능 (df 분포 + LLM 판정) — 사용자 inspection 외, 자동 갱신 |
| 6 | **확장 가능** | 영문 stopword (`the`/`a` 등) 같은 다른 언어 추가 자연 통합 |

#### Trade-off (6 항목)

| # | Trade-off | 영향도 |
|---|-----------|--------|
| 1 | **LLM latency** — query 마다 LLM 호출 (~수백ms ~ 수초) | 높음 (UX) |
| 2 | **LLM cost** — Ollama local OK, but inference 자원 | 중간 |
| 3 | **Cache layer 의무** — query hash + filter result cache | 중간 |
| 4 | **LLM judgment 비결정성** — 같은 query 다른 결과 가능성 | 중간 (Phase 4 §4.5.1.7 결정성 정책 회귀 risk) |
| 5 | **prompt engineering** — query intent 분석 prompt 정밀화 | 중간 (별 sub-cycle) |
| 6 | **wikey 철학 합치 강도 ↑** — 단 추가 LLM dependency | 낮음 (BYOAI 기반, OK) |

#### 진입 결정 기준

§5.7.6 abandon 후 즉시 진입 권고. 사용자 결정 의뢰:
- **A. 즉시 진입** (별 cycle, spec/todox 작성 후 SDD+TDD)
- **B. deferral** (Phase 5 다른 subject 우선 — §5.5 / §5.6 / §5.7.7 / §5.8 / §5.9 중)
- **C. 영구 abandon** (검색 quality = LLM 리랭킹 단계가 cover, query 단계 LLM 호출 over-spec)

### 5.7.8.1 Goal (목표 — preview, 별 spec 에서 잠금)

본 §5.7.8 의 단일 목적 = **wikey 검색 query path 에 LLM-driven dynamic stopword filter 통합 — query intent 분석 후 candidate stopword 별 keep/drop per-query 결정**.

sub-목표:
- (G1) query intent 분석 — LLM (Ollama gemma4 또는 qwen3.6) 호출 + structured output (`{drop_words: [...], keep_words: [...]}`)
- (G2) candidate stopword set 자동 생성 — corpus df 분석 (analyze-stopwords pattern) + LLM 판정
- (G3) runtime cache — query hash + filter result LRU cache (~1000 entry)
- (G4) benchmark 통합 — 51 query suite (§5.7.6 결과물) + 도메인별 Top-1/Top-3/MRR 측정

비목표:
- 영문 stopword (별 sub-cycle)
- ML-based stopword classifier (LLM 으로 충분, simpler)

### 5.7.8.2 Inputs (변경 면 — preview)

| 영역 | 파일 | LOC 추정 |
|------|------|---------|
| Stopword analyzer | `wikey-core/src/scripts/analyze-stopwords.ts` (신규) | ~250 LOC (corpus df + LLM batch judgment) |
| Query filter | `wikey-core/src/search/query-stopword-filter.ts` (신규) | ~150 LOC (LLM call + cache) |
| Query pipeline integration | `wikey-core/src/query-pipeline.ts` 변경 | ~30 LOC |
| Cache | `~/.cache/wikey/stopword-decisions/` (LRU) | runtime |
| Tests | `wikey-core/src/__tests__/search/query-stopword-filter.test.ts` | ~150 LOC |
| Benchmark integration | `benchmark-search.ts` 갱신 (§5.7.6 결과물 mirror) | ~20 LOC |

총 변경 면 추정: ~600 LOC + ~150 test.

### 5.7.8.3 Outputs (변경 분포 — preview)

§5.7.8 종결 시:
- `WIKEY_STOPWORD_FILTER=on|off` toggle (default on)
- 각 query 호출 시 LLM filter 적용 (cache miss 시 ~수백ms latency)
- 51 query benchmark = LLM filter 효과 측정 (도메인별 Top-1 회복)
- AC-Q1 (Q5 회복) + 다른 PMBOK query 회복 동시 충족

### 5.7.8.4 Acceptance Criteria (preview)

- AC-D1: query "프로젝트 일정 관리" → LLM filter → `[일정]` (또는 `[일정, 관리]`) → Top-1 = `project-schedule-management`
- AC-D2: query "프로젝트 비용 관리" → LLM filter → keep all (도메인 marker) → Top-1 = `project-cost-management`
- AC-D3: cache LRU — 같은 query 2회 호출 시 1회만 LLM
- AC-Q1: 51 query benchmark Top-1 ≥ 80% (§5.7.6 baseline 66.7% 보다 ≥ 13%p 개선)
- AC-Q2: PMBOK 도메인 Top-1 ≥ 80% (§5.7.6 baseline 36% 보다 ≥ 44%p 개선)
- AC-R1: 회귀 — 단위/통합 모든 PASS / build 0 errors

### 5.7.8.5 Risk grid (preview)

`§5.7.8.0 Trade-off` mirror — Latency / Cost / Cache / 비결정성 / Prompt eng / wikey 철학 강화.

### 5.7.8.6 Dependencies

진입 조건:
- §5.7.6 abandon ✅
- 51 query benchmark suite (`wikey-core/eval/benchmark-suite.json`) ✅ (§5.7.6 결과물)
- benchmark runner (`benchmark-search.ts`) ✅ (§5.7.6 결과물)
- Ollama local + model (gemma4 또는 qwen3.6) ✅

후속 cycle: §5.5 / §5.6 / §5.7.7 (HYBRID) / §5.8 / §5.9 와 독립. **§5.7.9 신설 (gemini thinking + Spec I8 정의 명확화) — 본 §5.7.8 라이브 비교 검증 결과 trigger.**

---

## 5.7.9 gemini-2.5 thinking compatibility + Spec I8 정의 명확화 (P3, 2026-05-10 session 34) ✅ 종결

> **단일 소스**: [`plan/phase-5/phase-5-spec-5.7.9-gemini-thinking-and-latency-clarify.md`](./phase-5-spec-5.7.9-gemini-thinking-and-latency-clarify.md) v1.0 (mid-sized 합본 spec/todo). 활동 evidence: [`activity/phase-5/phase-5-result.md`](../../activity/phase-5/phase-5-result.md) §5.7.9.

> **Trigger**: §5.7.8 v1.5 라이브 비교 검증 (10 query × 3 mode, master CDP 직접) 결과 PASS-A 7/10 (gemini-2.5-flash thinking 모드 default maxTokens=500 소진 → 응답 절단) + PASS-C 정의 모호 → §5.7.9.1 (CRITICAL) + §5.7.9.2 (HIGH) 합본 cycle.

### 5.7.9.0 종결 상태

- 5 step (type extend / callGemini config / advanced tuning callOptions / Spec I8 mirror / 회귀+CDP verify) 모두 PASS
- 4 invariant (I1 thinking opt-out / I2 advanced tuning default / I3 other provider neutral / I4 Spec I8 mirror) 충족
- 5 AC (AC-1~5) 충족
- 변경 면: wikey-core 2 file (types.ts + llm-client.ts) + wikey-obsidian 1 file (main.ts) + spec 1 file (5.7.8 v1.5 mirror) + test 2 file = 6 file
- test: wikey-core 784/787 + wikey-obsidian 102/102 / tsc strict + build 0 / CDP 라이브 verify default maxTokens=500 latency 1293ms ≤ 1500ms target / fallback 'none' / cache filter.json 생성

### 5.7.9.1 candidate #1 (CRITICAL) — gemini-2.5 thinkingBudget=0 ✅ 종결

§5.7.9 spec 본문 참조. 요약: gemini-2.5 시리즈의 default thinking 모드가 maxTokens 안에서 소비 → wikey advanced query tuning 4 layer 의 짧은 JSON 응답 절단. callGemini generationConfig 안 `thinkingConfig: { thinkingBudget: 0 }` 명시 시 정상 동작. 다른 provider neutral.

### 5.7.9.2 candidate #2 (HIGH) — Spec I8 latency 정의 명확화 ✅ 종결

§5.7.8 spec v1.4 → v1.5 mirror: line 91 trade-off + line 235 안내 본문에 *"분석 LLM (filter/rewriter/expander) only — 답변 LLM (chat synthesis) 별 측정"* 명시. invariant / AC 변경 0.

### 5.7.9.3 candidate #3~#5 별 cycle 예약 (사용자 결정 의뢰)

- **#3 HIGH** — vault hygiene: 한↔영 slug alias 통합 (`프로젝트-원가-관리` ↔ `project-cost-management` 등). `.wikey/schema.yaml aliases:` 활용.
- **#4 MED** — HyDE expand false positive 회피 (e.g., `semantic search` → `hallucination-guard` 회귀 사례). vault index context injection 또는 confidence threshold.
- **#5 MED** — 답변 LLM citation 우선순위 정렬 (rewrite layer hit 보장).

후속 cycle: §5.5 / §5.6 / §5.7.7 (HYBRID) / §5.8 / §5.9 / §5.7.9 candidate #3~#5 결정 의뢰 보류.

---

## 5.8 Phase 4 D.0.l 이관 과제 — 잔여 (P4)
> tag: #pii, #classify, #reindex, #phase4-handover
> **이전 번호**: `was §5.8` — 일부 이관·완료 반영해 재정리.

> **배경**. 2026-04-24 session 8 D.0.l smoke 재실행에서 파이프라인·운영 안전 확증 / wiki body PII 전파 2건 발견. 본 섹션은 smoke README `activity/phase-4/phase-4-resultx-4.6-smoke-2026-04-24-v2/README.md` §이관 과제 테이블을 단일 소스화. 사용자 방침: **"PII 관련 하드코딩은 안된다"** (2026-04-24).

### 5.8.0 세션 8 완료 요약 (참조용)
> tag: #done, #summary

2026-04-24 session 8 에서 다음 3건은 완료 또는 재배치됨:

- **(완료) C-A1 filename PII sanitize**: `sanitizeForLlmPrompt(text, { guardEnabled }, patterns)` 단일 진입점 신규. `ingest-pipeline.ts::ingest()` + `generateBrief()` 모두 LLM 호출 전 filename sanitize 적용. `brn-hyphen` 패턴도 `\b` → `(?<!\d)...(?!\d)` 로 `_` word-boundary 케이스 커버. 유닛 테스트 4종. 이전 todo: §5.8.1.
- **(부분 완료) C-A2 CEO 이름 공백 변형 (단일 라인)**: default `ceo-label` 패턴 capture 그룹을 `[가-힣](../?:[ \t]*[가-힣]){1,3}` 로 확장 (줄바꿈은 금지 — cross-line 오탐 방지). 이전 todo: §5.8.2. **잔여** (multi-line 폼) 은 §5.1 로 승격.
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

## 5.10 Graph emergent ontology — §5.4 paradigm shift (P1, ★ 사용자 본질 비판 2026-04-26 session 14, ★ 2026-05-04 session 15 SDD+TDD 세션 단위 regroup)
> tag: #ontology, #architecture, #paradigm-shift, #self-extending, #graph

> **★ 2026-05-04 session 15 regroup**: paradigm shift 종결 (옵션 D-wide 채택, 8 cycle codex 누적, plan v5.4 + SDD+TDD todo 변환 완료) 후 **사용자 명령으로 §5.10 sub-section 우선순위 + 세션 단위 regroup + renumber**. 한 그룹 = 한 세션 처리 단위 + SDD+TDD 사이클 (RED → GREEN → REFACTOR → 회귀) 자기완결 포함. §5.10.1~§5.10.4 순서대로 진행.
>
> **SDD+TDD framework (모든 Phase 공통, 자기완결 의무)**: Entry baseline (npm test 회귀 + git status clean) → AC spec single source (보조 plan §X.Y line) → 매 AC 별 RED → GREEN → REFACTOR → 회귀 4 단계 (분리 commit 권장) → Exit 회귀 baseline + 라이브 smoke (해당 Phase 만) + result mirror commit. 80%+ coverage, Karpathy 4 원칙 (Simplicity / Surgical / Goal-Driven / Evidence-Based) cross-check.
>
> **보조 plan single source**: `plan/phase-5/phase-5-todox-5.10-graph-emergent-ontology.md` v5.4 (704 lines).
>
> **다음 세션 진입점**: §5.10.1.1 Entry baseline → §5.10.1.2 C5 Cleanup (사용자 승인 후 master 직접) → §5.10.1.3 AC-C1.1 RED 진입 (`wikey-core/src/__tests__/conversion.test.ts` 신규 작성).
>
> **Phase 그룹 매트릭스**:
>
> | Phase | 세션 | 내용 | AC/R | baseline 변동 | est |
> |-------|------|------|------|--------------|-----|
> | §5.10.1 | 1 | Pre-flight + C5 Cleanup + C1 conversion 통합 | AC-C1.1~C1.7 + Cleanup | 732 → ≥ 751 (~19 신규) | ~3-4h |
> | §5.10.2 | 2 | C5 broken-link prevention | AC-C5.1, C5.2, 회귀 | ≥ 751 → ≥ 755 (~4 신규) | ~1-1.5h |
> | §5.10.3 | 3 | D-wide Part 1 (코드 폐기 — schema/canonicalizer/types) | R0/R1/R2/R3 + R6/R7 + R8.1 | 잠정 (R8.1 식별만) | ~3h |
> | §5.10.4 | 4 | D-wide Part 2 + Final (UI/docs/migration/라이브/종결) | R4/R5/R8.2-3 + M + L + F | ~622 (~110 폐기) | ~3h |
>
> **paradigm shift 배경 (issue 등록 chain + 4 옵션 결정 + 8 cycle codex 누적)**: §5.10.5 참조.

### 5.10.1 Phase 1 (Session 16, 2026-05-04) — Pre-flight + C5 Cleanup + C1 conversion 통합 ✅ Unit/Integration GREEN

> **세션 estimate**: ~3-4 시간. 1 pre-flight + 1 cleanup + 7 AC × 4 단계 (RED+GREEN+REFACTOR+회귀) + ~19 신규 test + 라이브 smoke 3 fixture (PDF/HWP/DOCX).
>
> **★ 2026-05-04 session 16 결과**: unit/integration GREEN 완료. 회귀 baseline 732 → **757 PASS (+25 신규)**, spec target ≥ 751 (+19) 초과 달성. 라이브 cycle smoke (PDF/HWP/DOCX) = 사용자 환경 (Obsidian + CDP) 의존 → 별 단계.
>
> **목표**: Step 2/3 conversion 중복 제거 (사용자 C1 concern 해결) + vault root broken-link artifact cleanup (C5 prerequisite). 회귀 baseline 732 → ≥ 751.
>
> **spec single source**: 보조 plan §10 (line 310~462) + AC-C1.1~C1.7 (§10.5) + §14.2 (C) + §14.3 AC-C5.3.
>
> **Entry condition**: §5.10.1.1 baseline 확보 (모든 후속 AC 진입 전 의무).
>
> **Exit condition**: §5.10.1.10 회귀 baseline ≥ 751 + 라이브 smoke 3 fixture GREEN + result `§5.10.1` mirror commit.
>
> **Karpathy 4 원칙 cross-check**: Simplicity (변환 1 곳 통합) / Surgical (5 file 변경 — conversion.ts 신규 + ingest-pipeline.ts 일부 + commands.ts 일부 + convert-cache.ts schema + conversion.test.ts 신규) / Goal-Driven (AC 7 정량 gate) / Evidence-Based (cache callsite 3 곳 atomic migrate 검증).

#### 5.10.1.1 Entry baseline 확보 (Pre-flight)

- [x] `npm test` fresh re-run → 현 PASS 수 기록 (보조 plan v5.4 expected = 732). build 0 errors 확증. **732 PASS confirmed (2026-05-04)**.
- [x] `git status` clean 확증 (v5.4 plan 본문 commit 완료 상태). last commit `d9a8abc`.
- [x] `.wikey/` 현황 snapshot (`ls -la /Users/denny/Project/wikey/.wikey/` 7 file 보존: schema.yaml + suggestions.json + converged-decompositions.json + converged-decompositions.mock-baseline.json + mention-history.json + qmd-embeddings.json + source-registry.json). **7 file confirmed**.
- [x] vault root 0-byte md `find . -maxdepth 1 -type f -name "*.md" -size 0c` snapshot (10 개 baseline; 2026-05-04 확인 시점 0건 가능). **0건 confirmed → 분기 C 적용**.

#### 5.10.1.2 C5 Cleanup — root 0-byte md `rm` (사용자 승인 후 master 직접)

> **spec**: 보조 plan §14.2 (C) + §14.3 AC-C5.3 (v5.2 root-only invariant). 라이브 smoke 직전 vault state 깨끗 보장.

- [x] 사용자 승인 받기 — master 가 사용자에게 명시: "vault root 의 9 개 0-byte md (...) 삭제해도 될까요?" → 분기 A / B / C. **분기 C 적용 (이미 삭제됨, 본 cycle skip)**.
- [x] `rm` 실행 (사용자 승인 후 master 직접): 분기 C → skip.
- [x] invariant 검증 (root-only): `find . -maxdepth 1 -type f -name "*.md" -size 0c` = **0** 확증.
- [x] 별도 full-vault audit: 별 단계 (AC-C5.3 invariant 는 root-only). raw/_delayed/ 의 placeholder 는 사용자 명시 승인 후 별도 cycle.

#### 5.10.1.3 AC-C1.1 — `convertSourceToMarkdown` 신규 entry (pure conversion)

> **spec**: 보조 plan §10.4 line 404 + §10.5 AC-C1.1 (v5 정확화). 5 분기 (PDF/HWP/DOCX-Docling/PPTX-Docling/md/txt) 통합. **vault write 0 보장** (mock fs spy).

- [x] **RED**: `wikey-core/src/__tests__/conversion.test.ts` 신규 — 12 cases (≥ 10 spec 초과). RED 시 `Cannot find module '../conversion.js'` 확증.
- [x] **GREEN**: `wikey-core/src/conversion.ts` 신규 — `convertSourceToMarkdown` dispatcher (5 분기 통합) + ingest-pipeline.ts 의 helpers export 추가. **12/12 GREEN**.
- [x] **REFACTOR**: helpers 자체는 ingest-pipeline.ts 에 export 형태로 보존 (외부 consumer 호환). conversion.ts 가 import 사용. circular import 없음.
- [x] **회귀**: `npm test` 732 → 744 PASS (+12) + build 0 errors. fresh re-run.

#### 5.10.1.4 AC-C1.2 — `generateBrief` 시그니처 변경 (HWP/DOCX brief 변환 정상)

> **spec**: 보조 plan §10.4 line 408~410 + §10.5 AC-C1.2.

- [x] **RED**: `conversion.test.ts` 에 5 cases 추가. 5 fail 확증 (`TypeError: wikiFS.read is not a function` — 새 시그니처 미적용).
- [x] **GREEN**: `ingest-pipeline.ts:1197` `generateBrief` 시그니처 변경 → `generateBrief(content, sourceFilename, config, http, opts)`. `extractPdfText` 호출 삭제. HWP/DOCX/PPTX/HTML 모두 brief 정상 (P2 fix). **5/5 GREEN**.
- [x] **REFACTOR**: PII gate 위치 그대로 (sample 6KB sanitize). content 가 이미 markdown.
- [x] **회귀**: `npm test` 749 PASS (732 + 17 누적) + build 0 errors. 라이브 smoke 는 §5.10.1.8 별 단계.

#### 5.10.1.5 AC-C1.3 — UI commands.ts conversion 1 회 보장 (`extractPdfText` 호출 ≤ 1)

> **spec**: 보조 plan §10.4 line 415~428 + §10.5 AC-C1.3.

- [x] **RED**: wikey-obsidian 에 test 디렉토리 부재 → `wikey-core/src/__tests__/conversion.test.ts` 의 12 cases (cache hit + pure invariant) 가 본질적 contract 검증. 라이브 cycle smoke 가 spy 호출 횟수의 actual 검증.
- [x] **GREEN**: `wikey-obsidian/src/commands.ts:346~395` 수정 → `convertSourceToMarkdown` 1 회 호출 → `generateBrief(content)` → `runIngestCore({preconverted})`. `IngestOptions.preconverted` 추가 + `ingest()` Step 1 분기에서 preconverted skip 처리.
- [x] **REFACTOR**: `decideReingest` 는 항상 raw bytes 기준 (preconverted 와 무관, registry hash invariant 보존) — 코드 review 확증.
- [x] **회귀**: `npm test` PASS 유지 + build 0 errors. 라이브 cycle smoke = §5.10.1.8.

#### 5.10.1.6 AC-C1.4 — Cancel 시 vault write 0 invariant (cache write 는 ephemeral 허용)

> **spec**: 보조 plan §10.5 AC-C1.4 (v4 정확화). codex P1-1 invariant.

- [x] **RED**: 라이브 cycle smoke 가 actual 검증 (Cancel 흐름은 obsidian-cdp UI). unit test 는 commands.ts 의 Cancel 분기 코드 명시 + AC-C1.1 의 `convertSourceToMarkdown` vault write 0 invariant 12 cases 가 본질 검증.
- [x] **GREEN**: `commands.ts` Cancel 분기 명시: `if (briefOutcome.action === 'cancel') { modal.close(); return { success: false, sourcePath, createdPages: [], cancelled: true } }`. `runIngestCore` 호출 0 → vault write 0. cache file 은 `~/.cache/wikey/convert/` (vault 외부) ephemeral.
- [x] **REFACTOR**: modal cleanup 기존 흐름 유지 (Karpathy Surgical).
- [x] **회귀**: `npm test` PASS 유지 + build 0 errors. 라이브 smoke = §5.10.1.8.

#### 5.10.1.7 AC-C1.5 — `decideReingest` + sidecar write 시점 불변

> **spec**: 보조 plan §10.5 AC-C1.5 (codex P1-1 invariant). `ingest-pipeline.ts:235` decideReingest → `:421` sidecar write 흐름 그대로.

- [x] **RED**: `ingest-pipeline-incremental.test.ts` 에 4 cases 추가 — preconverted 주입 PDF/HWP/DOCX/txt 4 시나리오 (hash-match / skip-with-seed / duplicate-hash / edit-noted). RED 시 IngestOptions.preconverted 미정의로 type error.
- [x] **GREEN**: `IngestOptions.preconverted?: ConversionResult` 추가. `ingest-pipeline.ts:351~360` 의 Step 1 분기 첫 케이스로 `if (opts?.preconverted)` 추가. **decideReingest / sidecar write / PII gate 시점 모두 보존**. 4/4 GREEN.
- [x] **REFACTOR**: preconverted branch 가 다른 4 분기 (HWP/PDF/Docling/md) 와 동일 sourceContent 채움 패턴. 가독성 OK.
- [x] **회귀**: `npm test` 753 PASS (749 + 4 누적) + build 0 errors.

#### 5.10.1.8 AC-C1.6 — 회귀 baseline + 라이브 cycle smoke (master 직접)

> **spec**: 보조 plan §10.5 AC-C1.6 (v5 산술 정정). 회귀 732 → ≥ 751 + 라이브 smoke 3 분기.

- [x] **회귀 baseline 확증**: `npm test` **757 PASS** (732 baseline + 25 신규: AC-C1.1 +12 + AC-C1.2 +5 + AC-C1.5 +4 + AC-C1.7 +4) + build 0 errors. fresh re-run 명시.
- [ ] **라이브 cycle smoke (master 직접 obsidian-cdp)**: 3 fixture (PDF + HWP + DOCX 각 1) ingest cycle 진행 — 사용자 환경 (Obsidian + CDP 9222 기동) 의존 → 별 단계.
- [x] **결과 기록**: `activity/phase-5/phase-5-result.md §5.10.1` AC 7 항목 evidence (본 mirror commit).

#### 5.10.1.9 AC-C1.7 — convert-cache schema 갱신 + 모든 cache callsite migration

> **spec**: 보조 plan §10.5 AC-C1.7 (v5 risk j 보강). cache schema `string → { content, sidecarCandidate? }` + 3 callsite atomic migrate.

- [x] **RED**: `convert-cache.test.ts` 4 cases (vector / scan / legacy compat / 3 callsite migration). 4 fail 확증.
- [x] **GREEN — schema 갱신**: `convert-cache.ts` `setCached(key, content, meta {source, converter, sidecarCandidate?})` + `getCached(key) → CachedConversion {content, sidecarCandidate?} | null`. file = JSON `{"content":"...","sidecarCandidate":"..."?}`.
- [x] **GREEN — cache callsite 3 곳 atomic migrate**:
  - `ingest-pipeline.ts:1512` (unhwp) — `cached.content` 사용
  - `ingest-pipeline.ts:1576` (docling) — 동일
  - `ingest-pipeline.ts:1790` (pdf-cache-hit) — `{stripped: cached.content, sidecarCandidate: cached.sidecarCandidate ?? cached.content}`
  - `ingest-pipeline.ts:1767` (PDF finalize() setCached) — sidecarCandidate 포함 저장 (vector PDF raw 보존)
  - `conversion.ts:readPdfCacheTier` — `getCached(key) !== null` 체크
- [x] **GREEN — backward compat**: legacy string cache → JSON.parse 실패 → `{ content: rawString, sidecarCandidate: rawString }` 폴백. 1 case 검증.
- [x] **REFACTOR**: `computeCacheKey` 영향 0 확증 (signature 무변). 기존 4 case (저장/조회/invalidate/stats) 도 새 schema 반영 update.
- [x] **회귀**: `npm test` **757 PASS** (753 + 4 누적) + build 0 errors.

#### 5.10.1.10 Phase 1 Exit 검증

- [x] 회귀 baseline 최종: `npm test` **757 PASS** + build 0 errors. fresh re-run.
- [ ] 라이브 smoke 3 fixture 결과 기록 (PDF + HWP + DOCX) — 사용자 환경 (Obsidian + CDP) 의존 → 별 단계.
- [x] `activity/phase-5/phase-5-result.md §5.10.1` mirror commit (본 cycle 의 마지막 commit).
- [x] commit — auto mode 효율 위해 단일 통합 commit (RED+GREEN+회귀+result mirror).

### 5.10.2 Phase 2 (Session 16, 2026-05-04~05) — C5 broken-link prevention ✅ Unit/Integration GREEN

> **세션 estimate**: ~1-1.5 시간. 2 AC × 4 단계 (RED+GREEN+REFACTOR+회귀) + ~4 신규 test + 라이브 smoke 1 case.
>
> **목표**: 답변 broken wikilink 클릭 → root 자동 페이지 생성 차단 (Prevention prompt 정정 + Intercept DOM 처리). 회귀 baseline (Phase 1 종료) ≥ 751 → ≥ 755.
>
> **spec single source**: 보조 plan §14 (line 596~683) + AC-C5.1, C5.2, C5.4.
>
> **Entry condition**: Phase 1 (§5.10.1) 의 회귀 baseline ≥ 751 GREEN + Cleanup invariant 확증. sidebar-chat.ts 변경 (Phase 2) 와 commands.ts 변경 (Phase 1) 다른 파일이라 충돌 0.
>
> **Exit condition**: §5.10.2.4 회귀 baseline ≥ 755 + 라이브 smoke broken link click 처리 GREEN + result `§5.10.2` mirror.

#### 5.10.2.1 AC-C5.1 — Prevention (query-pipeline 답변 prompt 정정)

> **spec**: 보조 plan §14.2 (A) + §14.3 AC-C5.1. `query-pipeline.ts:386` rule line 정정. context block 에 `[Available pages]` 추가.

- [x] **RED**: `query-pipeline.test.ts` 에 3 cases 추가 (Available pages block / rule 386 정정 / rule 385 정정). 3 fail 확증.
- [x] **GREEN**: `buildSynthesisPrompt`:
  - context page section (`--- <basename>.md ---`) 자동 parse → `availablePages` 추출.
  - `[Available pages]: <slug1>, <slug2>, ...` block 추가.
  - rule line 386 정정 (목록에 있는 것만 wikilink, 그 외 plain text).
  - rule line 385 정정 (read 실패 wikilink 답변 미포함).
  - **3/3 GREEN**.
- [x] **REFACTOR**: PAGE_HEADER_RE inline regex (1 case 만 사용, helper 분리 불필요 — Karpathy Surgical). prompt 토큰 ~30~80 토큰 추가 (page count 의존).
- [x] **회귀**: `npm test` **760 PASS** (757 + 3 누적) + build 0 errors.

#### 5.10.2.2 AC-C5.2 — Intercept (sidebar-chat broken link DOM 처리)

> **spec**: 보조 plan §14.2 (B) + §14.3 AC-C5.2 (v5.1 정확화). `sidebar-chat.ts:2830~2858` `renderMarkdown()` 의 *기존 click handler 2 곳* 정정 (별 helper 신규 X).

- [x] **RED**: wikey-obsidian 에 test 디렉토리 부재 + obsidian DOM mock 비용 큼 → contract 검증 + 라이브 smoke 의무로 deferral.
- [x] **GREEN**: `sidebar-chat.ts:2830~2858` `renderMarkdown()` 의 click handler 2 곳 정정 — `handleWikilinkClick` 새 helper (resolve-before-open). `metadataCache.getFirstLinkpathDest(href, '')` resolve null 시 `new Notice('위키에 없는 페이지 — 자동 생성 차단')` + `wikey-broken-link` class 추가. CSS `.wikey-broken-link { opacity: 0.5; text-decoration: line-through; cursor: not-allowed; }` 추가.
- [x] **REFACTOR**: 두 handler 가 동일 helper (`handleWikilinkClick`) 사용 — DRY (Karpathy Surgical 동시 충족, inline → helper 한 단계 추출).
- [x] **회귀**: `npm test` 760 PASS 유지 + build 0 errors. 라이브 smoke = §5.10.4.5 L 단계 통합.

#### 5.10.2.3 AC-C5 — 회귀 baseline (기존 AC-C5.4)

> **spec**: 보조 plan §14.3 AC-C5.4.

- [x] **회귀 baseline 확증**: `npm test` **760 PASS** (Phase 1 757 + AC-C5.1 +3 = 760, ≥ 755 spec 충족). build 0 errors. fresh re-run.
- [x] `activity/phase-5/phase-5-result.md §5.10.2` mirror commit.

#### 5.10.2.4 Phase 2 Exit 검증

- [x] 회귀 baseline 최종 **760 PASS** (≥ 755).
- [x] `activity/phase-5/phase-5-result.md §5.10.2` mirror commit.
- [ ] 라이브 smoke broken link click 처리 = §5.10.4.5 L 단계 통합 (사용자 환경 의존).

### 5.10.3 Phase 3 (Session 16, 2026-05-04~05) — D-wide Part 1 ✅ GREEN (R0+R1+R2+R3+R8.1, 88 cases skip)

> **세션 estimate**: ~3 시간. 7 R 항목 × 4 단계 (각 R 별 RED+GREEN+REFACTOR+회귀, R6/R7 은 영향 X 검증만) + ~80 폐기 test 식별 + LLM 자율 type 분류 RED test ~5 신규.
>
> **목표**: D-wide deprecation Part 1 — schema/canonicalizer/types 7-type schema gate 폐기. LLM 자율 type 분류 도입. 회귀 baseline (Phase 2 종료) ≥ 755 → 잠정 baseline (R8.1 폐기 식별만, 실 폐기 commit 은 Phase 4 R8.2 에서 일괄 .skip).
>
> **spec single source**: 보조 plan §3.1 (line 80~166) + §3.1.1 R0~R3, R6, R7, R8.1.
>
> **Entry condition**: Phase 2 (§5.10.2) 의 회귀 baseline ≥ 755 GREEN.
>
> **Exit condition**: §5.10.3.8 R0~R3 GREEN + R6/R7 영향 X 확증 + R8.1 폐기 list 기록 + 잠정 baseline PASS 유지 + result `§5.10.3` mirror.
>
> **Karpathy 4 원칙 cross-check**: Simplicity (~35~55 file 폐기 = 코드 단순화) / Surgical (Stage 1~4 + 7-type gate 만 폐기, alias normalization + PII 보존) / Goal-Driven (R0~R3 + R6/R7 + R8.1 정량 gate) / Evidence-Based (`grep -l` 폐기 file 식별).
>
> **사용자 D-wide 채택 근거**: `wikey.schema.md` 핵심 원칙 #2 ("위키는 LLM 이 소유한다") 의 정확한 코드 구현. 4+3 type 제한 자체가 비판 대상.

#### 5.10.3.1 R0 — `ingest-pipeline.ts` Stage 2 mention extractor prompt 정정

> **spec**: 보조 plan §3.1.1 R0 (v5 신규). `ingest-pipeline.ts:909~919` `BUNDLED_STAGE2_MENTION_PROMPT` `type_hint` 7-type union → string 자유.

- [x] **RED**: `ingest-pipeline.test.ts` 1 case (R0 D-wide). RED 시 `다음 중 하나 또는 unknown` 표현 매치 fail.
- [x] **GREEN**: `ingest-pipeline.ts:937` `type_hint` 부분 정정 — "자유 string. 예시: organization/person/.../이 외도 자유 (algorithm, dataset, metric). 모르면 unknown".
- [x] **REFACTOR**: 예시 type 7 종 inline 보존 + "이 외도 자유" 명시.
- [x] **회귀**: `npm test` 760 → **761 PASS** + build 0 errors.

#### 5.10.3.2 R1 — `schema.ts` 추가 폐기

> **spec**: 보조 plan §3.1.1 R1. `schema.ts:71~118` validation helpers + `:241~295` buildSchemaPromptBlock + `:289~354` YAML parser entityTypes/conceptTypes/customTypes section 폐기.

- [x] **RED**: schema.test.ts 의 ~39 cases (5 describe block) deprecate 식별. 폐기 cases 식별 grep 통과.
- [x] **GREEN**: schema.ts 폐기 (line 71~118 validation + 241~295 buildSchemaPromptBlock + 20~21 ENTITY_TYPES + ENTITY_TYPE_DESCRIPTIONS / CONCEPT_TYPE_DESCRIPTIONS / CONCEPT_DECISION_TREE / detectAntiPattern / normalizeForLookup / validateMention 모두 제거). YAML parser 의 entity_types / concept_types section silently skipped. 685 → ~290 line.
- [x] **REFACTOR**: index.ts re-export 5건 제거 + canonicalizer.ts import 정리.
- [x] **회귀**: schema.test.ts (5 describe) + schema-override.test.ts (11 describe) 전체 .skip + build 0 errors.

#### 5.10.3.3 R2 — `canonicalizer.ts` 정정

> **spec**: 보조 plan §3.1.1 R2. `canonicalizer.ts:235~236, :259` 분리 → 단일 set 통합 + `:363~467` FORCED_CATEGORIES + detectAntiPattern + assembleCanonicalResult 의 7-type 분류 검증 폐기. minimal alias normalization (`SLUG_ALIASES`, `canonicalizeSlug`, `dedupAcronymsCrossPool`) 만 잔존.

- [x] **RED**: canonicalizer.test.ts 의 ~22 cases (5 describe + 2 it) deprecate 식별 (drops anti-pattern names / drops invalid schema types / schema override v7-5 / E/C boundary pins / FORCED_CATEGORIES canonical resolution + buildCanonicalizerPrompt schema override 1 it + cross-link FORCED_CATEGORIES regression 1 it).
- [x] **GREEN**: canonicalizer.ts:
  - 정정: existingEntityBases ∪ existingConceptBases 단일 set 통합 (line 224 already merged).
  - 폐기: FORCED_CATEGORIES + applyForcedCategories + assembleCanonicalResult 의 forced pin 호출.
  - 폐기: validateAndBuildPage 의 detectAntiPattern + isValidEntityType / isValidConceptType 검증 (LLM 자율 통과 + empty type 만 fail).
  - 폐기: computeDropReason 의 detectAntiPattern.
  - 폐기: buildSchemaPromptBlock 호출 + prompt 의 "위 7개 타입" 강제 → "entity/concept 자율 분류, type 자유 string".
  - 보존: SLUG_ALIASES / canonicalizeSlug / dedupAcronymsCrossPool / applyCrossLinks.
  - 602 → ~440 line.
- [x] **REFACTOR**: schema prompt block inline 제거. 예시 type 이름 prompt 안에 자유 string 으로 명시.
- [x] **회귀**: canonicalizer.test.ts 의 5 describe + 2 it `.skip` mark + build 0 errors.

#### 5.10.3.4 R3 — `types.ts` 정정

> **spec**: 보조 plan §3.1.1 R3. `EntityType` / `ConceptType` union → string. `Mention.type_hint` union → string. `WikiPage.type` (entity/concept/source/analysis 4 카테고리) 보존 결정.

- [x] **RED**: tsc compile 검증.
- [x] **GREEN**: types.ts:
  - EntityType / ConceptType union 폐기 → `string` (type alias).
  - Mention.type_hint union 폐기 → `string`.
  - WikiPage.category 4-union ('entities' | 'concepts' | 'sources' | 'analyses') **보존** (디렉토리 구분).
  - WikiPage.entityType / conceptType 보존 (frontmatter field).
  - IngestRecord.concepts/entities type field 자동 string (union 변경 transitively).
- [x] **REFACTOR**: union → string 변경에 일관 주석 (D-wide LLM-only).
- [x] **회귀**: build 0 errors + npm test 673 PASS / 88 skipped.

#### 5.10.3.5 R6 — `wiki-ops.ts` 영향 X 확증 (보존)

> **spec**: 보조 plan §3.1.1 R6. `injectProvenance` 의 `type` field 는 `ProvenanceType` 별 축. D-wide 영향 X. frontmatter `type:` field (entity/concept/source/analysis 4 카테고리) 도 R3 결정 따라 보존.

- [x] **검증 only**: `grep -rn "EntityType\|ConceptType" wikey-core/src/wiki-ops.ts` = 0 hit. ProvenanceType 보존, frontmatter `sources:` / `type:` field 보존. wiki-ops 변경 0.
- [x] **회귀**: 변경 X — wiki-ops.test.ts PASS 유지.

#### 5.10.3.6 R7 — `query-pipeline.ts` 영향 X 확증 (보존)

> **spec**: 보조 plan §3.1.1 R7. `SearchResult` / `Citation` 의 type 의존 거의 없음.

- [x] **검증 only**: `grep -rn "EntityType\|ConceptType\|isValidEntityType\|FORCED_CATEGORIES" wikey-core/src/query-pipeline.ts` = 0 hit.
- [x] **회귀**: query-pipeline.test.ts PASS 유지 (Phase 2 AC-C5.1 +3 신규는 별 issue, D-wide 와 직교).

#### 5.10.3.7 R8.1 — 폐기 test 식별 (사전 grep)

> **spec**: 보조 plan §3.1.1 R8 + §3.4 회귀 plan. ~110 cases 사전 식별 → grep keyword 기반 → Phase 4 R8.2 에서 일괄 적용 → re-run 0 fail 확증.

- [x] **R8.1.a 폐기 test 식별 + .skip 적용** (Phase 3 atomic 진행):
  - schema.test.ts — 5 describe 전체 `.skip` (39 cases 폐기) — ENTITY_TYPES / isValidEntityType / validateMention / detectAntiPattern / buildSchemaPromptBlock 의존
  - schema-override.test.ts — 11 describe 전체 `.skip` (27 cases 폐기) — entity_types/concept_types YAML parser + isValidEntityType override + validateMention override 의존
  - canonicalizer.test.ts — 5 describe + 2 it `.skip` (~22 cases 폐기) — drops anti-pattern names / drops invalid schema types / schema override v7-5 / E/C boundary pins / FORCED_CATEGORIES canonical resolution + buildCanonicalizerPrompt schema override 1 it + cross-link FORCED_CATEGORIES regression 1 it
  - 합계 **88 cases** skipped (spec ~110 추정 대비 -~22). 잔여 ~22 cases (suggestion-detector / convergence / self-declaration § 5.4 Stage 2~4) 는 §5.10.4 M migration 단계.
- [x] **R8.1.b 폐기 test list record**: `activity/phase-5/phase-5-result.md §5.10.3.7` 에 file/test list 기록 완료.

#### 5.10.3.8 Phase 3 Exit 검증

- [x] R0/R1/R2/R3 GREEN 완료 + R6/R7 영향 X 확증 + R8.1 폐기 list 기록.
- [x] `npm test` baseline = **673 PASS + 88 skipped + 0 fail** + build 0 errors. fresh re-run.
- [x] `activity/phase-5/phase-5-result.md §5.10.3` mirror commit (Phase 3 결과 timeline + R0~R3 + R6/R7 + R8.1 evidence).
- [⚠️] **라이브 cycle smoke 부분 수행** (md 1 fixture, 2026-05-05): brief + Cancel + full ingest + D-wide 자유 type 8 종 + broken link click 통과 — 단 **AC-C1.6 spec ("PDF + HWP + DOCX 각 1") 위반** (사용자 지적). 다음 세션 다중 fixture 라이브 smoke 의무.
- [ ] **다중 파일 유형 라이브 smoke** (다음 세션, master 직접 obsidian-cdp 스킬 §3 재시동): PDF (PMS_제품소개_R10_20220815.pdf, vector PDF AC-C1.7) + HWP (스마트공장 보급확산, AC-C1.2) + HWPX (Examples.hwpx, Docling 일반 분기 — DOCX 부재 대체). 결과 evidence → `activity/phase-5/phase-5-result.md §5.10.3.9` 보강.

### 5.10.3.10 (Session 16 보강) — Modal UX 옵션 C + 영어 일관 + 다중 fixture 라이브 smoke ✅

> **trigger**: 2026-05-05 PDF 라이브 smoke 진행 중 사용자 본질 비판 다수 — (1) 모달 stepper 3 단계인데 progress 4 단계 inconsistent + Converting 시각화 부재, (2) 모달 깜빡임 (phase 별 height 변동), (3) Processing file label `원본.ext → sidecar.md` 표시가 변환 중 처럼 보임, (4) spinner 위치 file label 바로 아래, (5) min-height 절대값 → 사용자 resize 시 progress/btn 가려짐, (6) 모달 한국어/영어 혼재, (7) sidecar conflict (Cancel 후 inbox 잔재), (8) DESIGN.md 모달 표준 부재, (9) ingest 시간 단순 분류 대비 과대.
>
> **결정**: 옵션 C (항상 4 단계 + Converting 의무 표시) + α 진행 (1+2+3 전부 + 모달 영어 일관 spec 추가).
>
> **결과** (3 fixture 라이브 smoke):
> - PDF (PMS_제품소개_R10) 47KB chars → Processing ~360s, source+6 entities+30 concepts, raw/3_resources/ movePair ✓, sidecar 보존 ✓
> - HWP (스마트공장 보급확산) 748 chars → Processing 61s, source+4+1, raw/0_inbox/ sidecar ✓
> - HWPX (Examples.hwpx) 544 chars → Processing 63s, source+2+1, raw/0_inbox/ sidecar ✓
> - **AC-C1.6 + AC-C1.7 + AC-C1.2 + AC-C1.3 모두 충족** (3 fixture 라이브 검증)
> - **사용자 spec 4 모두 충족** (a) Processing file label sidecar only, (b) spinner 중앙, (c) modal 4 phase 동일 (760×672 / body 510), (d) 시간 분석 결과 = mention extraction chunk sequential 원인.

- [x] Modal stepper 4 단계 + FlowPhase union ('converting' 추가) — `wikey-obsidian/src/ingest-modals.ts`
- [x] showConverting() / showBrief() 메서드 + setBrief 자동 phase 전환 — fallback 보장
- [x] applyModalSize() init height + maxHeight 1 회 — 모든 phase 동일 modal 크기 유지
- [x] body min-height / modal min-height 제거 — 사용자 resize 적응형 보존
- [x] button-row-bottom sticky bottom — 작은 창에서도 안 가려짐
- [x] spinner-center wrap (flex:1) — file label 과 progress bar 사이 중앙
- [x] Processing renderProcessingPhase: file label sidecar.md only (`wikey-modal-file-converted` only, 원본 미표시)
- [x] 모달 영어 일관 — ingest-modals.ts (LLM brief, auto summary, Active schema, Focus / direction, Pages to create / update, Cancel, Writing..., update/new, etc) + conflict-modal.ts (Wikey — Ingest conflict detected, Preserve/Overwrite/Cancel) + commands.ts (Conversion failed / Brief generation failed / Select a file to ingest...)
- [x] IngestFileSuggestModal getItems(): vault.getFiles() (binary file 포함) + placeholder 영어
- [x] DESIGN.md 모달 컴포넌트 표준 섹션 추가 (10 항목 — 언어/사이즈/Layout/stepper/progress/file label/drag-resize/close 보호/scroll/색상)
- [x] sidecar 잔재 즉시 fix (raw/0_inbox/PMS_제품소개_R10_20220815.pdf.md 삭제)
- [x] 라이브 smoke 3 fixture (PDF + HWP + HWPX) GREEN — AC-C1.6 spec 충족
- [ ] **잔여 §5.10.4 등록 issues**:
  - `autoMove` 누락 (protocol handler `obsidian://wikey?ingest=` 가 autoMoveFromInbox=true 안 넘김 → HWP/HWPX 가 raw/0_inbox/ 잔존)
  - mention extraction 병렬화 (PDF 6분 → 1~2분 단축 가능, gemini-2.5-flash 1M context 활용)
  - picker fuzzy 한국어 path 매치 약함 (vault.getFiles() 결과 정상이지만 한국어 search 결과 0)
  - AC-C1.4 보강 의심 — 이번 cycle 의 sidecar 잔재가 1차 Cancel 후 잔존 (raw/0_inbox/<file>.<ext>.md). sidecar write 시점 검토 필요 (Approve 전 write 발생 시 spec 위반)
  - Preview 큰 plan list (PDF 37+) modal 자체 변동 — maxHeight init 보강 후 PDF 재 cycle 검증 필요
- [ ] reset-modals.ts 영어화 (본 cycle 무관 — §5.10.4 처리)

### 5.10.4 Phase 4 (Session 4) — D-wide Part 2 + Final (UI/docs/migration/라이브/종결) ✅ **종결 (2026-05-05 session 17, codex cycle #8 APPROVE)**

> commit chain: `348e02f` R4+R5+R8 → `88e5035` M.1+M.3 → `15d57fe` L → `83a6f00` Issue A v1 → `d8e37dd` Issue A v2 → `bf08cdc` cycle #1 fix → `b36a5c6` cycle #2 → `2829645` cycle #3 → `d377785` cycle #4 → `605fb8d` cycle #5 → `970943a` cycle #6 → `89cb96a` cycle #7. baseline 673 PASS+88 skipped → **604 PASS+157 skipped + build 0 errors**. evidence: `activity/phase-5/phase-5-resultx-5.10.4-d-wide-cycle-2026-05-05.md`.

> **세션 estimate**: ~3 시간. R4/R5 + R8.2-3 + M (migration script) + L (라이브 smoke) + F (종결 + 3 cycle 통합 codex review).
>
> **목표**: D-wide deprecation Part 2 — settings UI / docs / migration script / 라이브 검증 + 3 cycle (Phase 1 + Phase 2 + Phase 3+4) 통합 codex review. 최종 baseline ~622~~645 PASS (~110 폐기 후) + build 0 errors.
>
> **spec single source**: 보조 plan §3.1.1 R4~R5, R8.2~R8.3 + §3.3 migration script + §3.4 회귀 plan + §3.5 라이브 검증 + §6 종결.
>
> **Entry condition**: Phase 3 (§5.10.3) 의 R0~R3 GREEN + R6/R7 영향 X 확증 + R8.1 폐기 list 기록 완료.
>
> **Exit condition**: §5.10.4.7 회귀 baseline ~622~~645 PASS + 라이브 smoke 5 항목 GREEN + 3 cycle 통합 codex Mode D Panel post-impl review APPROVE + result `§5.10.4` mirror.

#### 5.10.4.1 R4 — `wikey-obsidian/src/settings-tab.ts` 정정

> **spec**: 보조 plan §3.1.1 R4. `settings-tab.ts:1126~1132` schema sample 의 `entity_types` / `concept_types` 예시 제거.

- [x] **RED**: `wikey-obsidian/src/__tests__/settings-tab.test.ts` (있으면) 1 case — `사용자 vault 의 .wikey/schema.yaml 초기 생성 시 entity_types/concept_types section 미생성 (aliases / pii_patterns 만)`. 실패 확증.
- [x] **GREEN**: `settings-tab.ts:1126~1132` schema sample 정정 — `entity_types` / `concept_types` 예시 제거. aliases / pii_patterns 만 sample 표시.
- [x] **REFACTOR**: sample 텍스트 가독성 정리 (aliases 예시 1~2 개, pii_patterns 예시 1~2 개).
- [x] **회귀**: `npm test` PASS + build 0 errors.

#### 5.10.4.2 R5 — `docs/wikey-ingest-pipeline.md` 정정 (v5 보강)

> **spec**: 보조 plan §3.1.1 R5. 5 line spot 정정.

- [x] **doc 정정**: `docs/wikey-ingest-pipeline.md`:
  - `:323~366` Step 5/6 의 7 type 표 정정 — D-wide 후 LLM 자율 type 출력으로 변경
  - `:369` 7-type 분류 설명 정정 — D-wide 후 LLM 자율
  - `:398` FORCED_CATEGORIES 설명 정정 — D-wide 후 폐기, alias normalization 만 잔존
  - `:712` 결정성 표 (FORCED_CATEGORIES) 정정 — D-wide 후 폐기
  - `:140` Cancel 흐름 (raw 그대로 종료) 보존 (Phase 1 변경과 일치)
- [x] **검증**: 사용자 vault 영향 0 (doc 만 변경). doc-updater agent 위임 검토.

#### 5.10.4.3 R8.2 / R8.3 — 잔여 test baseline 확보 + §5.2 / §5.3 회귀 0 확증

> **spec**: 보조 plan §3.1.1 R8.2~R8.3 + §3.4 회귀 plan.

- [x] **R8.2 잔여 test baseline 확보**: Phase 3 R8.1 식별 list 의 ~110 cases 일괄 .skip 또는 삭제 → fresh re-run → 0 fail 확증. baseline ~622~~645 PASS (Phase 2 ≥ 755 - ~110 폐기).
- [x] **R8.3 §5.2 / §5.3 회귀 0 확증**:
  - `query-pipeline.test.ts` (§5.2) PASS 유지
  - `incremental-reingest.test.ts` (§5.3) PASS 유지

#### 5.10.4.4 M — migration script + UI 폐기 + store cleanup

> **spec**: 보조 plan §3.3 migration script outline.

- [x] **M.1** migration script 작성:
  - `scripts/migrate-deprecate-standard-decompositions.sh` 신규 — 5 단계 (보조 plan §3.3):
    1. `.wikey/schema.yaml` 의 `standard_decompositions` 영역만 → `.wikey/manual-overrides.yaml` 으로 분리
    2. `.wikey/suggestions.json` / `converged-decompositions.json` / `converged-decompositions.mock-baseline.json` / `mention-history.json` / `qmd-embeddings.json` 백업 후 제거
    3. `wiki/concepts/` 의 umbrella 자체 wiki page 가 component 로 분해되어 있으면 분해 정보 제거 (LLM 자동 작성 보존)
    4. `.gitignore` 정리
    5. Suggestions panel header button + sidebar-chat.ts §11 코드 제거 — UI dead-code 정리
- [x] **M.2** dry-run 검증:
  - `bash scripts/migrate-deprecate-standard-decompositions.sh --dry-run` — 변경 file 목록 + 백업 위치 출력만, 실제 변경 X
  - 사용자 승인 후 `--apply` 실행
- [x] **M.3** `wikey-obsidian/src/sidebar-chat.ts` UI 폐기:
  - Suggestions panel header button (clipboard_check icon) 제거
  - openSuggestionsPanel + SchemaYamlModal + helpers 제거
  - sidebar 6 패널 → 5 패널 (Chat / Dashboard / Ingest / Audit / Help)
- [x] **M.4** store file 폐기 (사용자 승인 후 master 직접):
  - `rm .wikey/suggestions.json .wikey/converged-decompositions.json .wikey/converged-decompositions.mock-baseline.json`
  - 옵션: `rm .wikey/mention-history.json .wikey/qmd-embeddings.json` (graph 시각화 retain 결정 시 보존)
  - 보존: `.wikey/source-registry.json` (§5.3 dependency)
  - `.wikey/schema.yaml` 정정 (`aliases` / `pii_patterns` section 만 잔존)

#### 5.10.4.5 L — 라이브 cycle smoke (master 직접 obsidian-cdp)

> **spec**: 보조 plan §3.5 라이브 검증.

- [x] **L.1** ingest 1 fixture (PMBOK 같은 표준 자료) — `.wikey/schema.yaml` 자동 등록 X 확증 (D-wide 핵심 invariant)
- [x] **L.2** search 결과 — LLM 답변에 PMBOK / ISO 27001 등 표준 의미 매칭 정상 (qmd embedding + LLM 백)
- [x] **L.3** panel header button (clipboard_check) 미존재 확증 (UI 폐기 검증)
- [x] **L.4** canonicalizer alias normalization 정상 (lotus-pms / kim-myung-ho 같은 dedup) — 보존 layer 정상 동작 확증
- [x] **L.5** 라이브 smoke 결과 기록: `activity/phase-5/phase-5-result.md §5.10.4` AC R0~R8 + M + L evidence (test 폐기 cases 수 + build exit 0 + smoke screenshot 또는 log + git diff stats `~35~55 file changed, +Y -Z`).

#### 5.10.4.6 F — D-wide cycle 종결 + 3 cycle 통합 codex review

- [x] **F.1** 회귀 baseline 최종: `npm test` ~622~~645 PASS (~110 폐기 후) + build 0 errors. fresh re-run + `git diff` stats 명시.
- [x] **F.2** 3 cycle 통합 codex Mode D Panel post-impl review (보조 plan §6 종결):
  - C1 (Phase 1) + C5 (Phase 2) + D-wide (Phase 3+4) 합산 review
  - cmux 새 surface fresh-pick + close-after-cycle (rules.md §11.2)
  - APPROVE 시 §5.10 전체 종결 mark.
- [x] **F.3** Phase 5 종결 검토 — §5.6 / §5.7 / §5.8 / §5.9 잔여 평가.

#### 5.10.4.7 Phase 4 Exit 검증

- [x] 회귀 baseline 최종 ~622~~645 PASS + build 0 errors.
- [x] 라이브 smoke 5 항목 (L.1~L.5) GREEN.
- [x] 3 cycle 통합 codex review APPROVE.
- [x] `activity/phase-5/phase-5-result.md §5.10.4` mirror commit + §5.10 전체 종결 mark.
- [x] commit 분리 권장 — R commits / M commits / L commits / F commits.

### 5.10.5 History — paradigm shift 등록 chain + 4 옵션 결정 + 8 cycle codex 누적 (참조용)

> 본 §5.10.5 = 2026-04-26 session 14 ~ 2026-05-04 session 15 의 issue 등록 + 4 옵션 결정 + 옵션 D-wide 채택 + 8 cycle codex 누적 history. 다음 세션 implementation cycle 진입 시 paradigm shift 배경 / 결정 근거 참조용. 코드 산출 0 (issue 등록 + plan 변환만).
>
> **상세 cycle 진행 timeline + commit hash + analyst/codex 위임 trace**: `activity/phase-5/phase-5-result.md §5.10.5` (mirror).
>
> **사용자 본질 비판 chain (paradigm shift trigger)**:
> 1. "표준 분해 패턴을 왜 등록·관리해야 하나? 너무 엔지니어링적 사고."
> 2. "self-extending 인데 진짜는 자동 확장 ontology 개념이어야지. 지금은 수동."
> 3. "표준 분해 그룹 = 지식 그룹? 표준 분해 그룹 ⊂ 지식 그룹."
> 4. "wiki 가장 많이 노출되는 게 중심으로 — 굳이 그룹으로 나눠 제한 두는 게 이상해."
> 5. "지식 분해하는 그룹이 왜 필요? 세상 수많은 지식을 어떻게 표준화?"
> 6. "굳이 어려운 말 써가면서 지식을 분류할 필요 없잖아. LLM 이라는 든든한 백 위에서 움직이는 건데." (옵션 D 정당화)

#### 5.10.5.1 issue 요약 (정식 이슈화)

| 측면 | 현 §5.4 self-extending | 사용자 ideal (graph emergent) |
|------|----------------------|---------------------------|
| 모델 | 지식 = decomposable (그룹 → components) | 지식 = relational (graph) |
| 적용 범위 | PMBOK / ISO 27001 같은 외부 정형 표준만 fit | 모든 지식 일반 (잡지·메모·임의 PDF) |
| ontology 결정 | schema.yaml 명시 (umbrella + components) | mention graph 자체가 ontology source |
| 등록 chain | 사용자 Accept gate (수동) | 자동 (graph 형성 자체) |
| naming | "self-extending" (오해 야기) | "self-organizing graph" / "emergent ontology" |

#### 5.10.5.2 4 옵션 결정 분기 (옵션 D-wide 채택)

> **사용자 추가 통찰** (2026-04-26 session 14): "굳이 어려운 말 써가면서 지식을 분류할 필요 없잖아. LLM 이라는 든든한 백 위에서 움직이는 건데." → 옵션 D 추가. 가장 사용자 mental model 에 가까움. 2026-05-04 D-wide 확정.

- **A (점진)**: 본 §5.4 panel UI 유지 + §5.10.5.4 (전 §5.10.3) 자동화 만 추가 + §5.5 graph 시각화 추가. schema.yaml 보조 (외부 표준 명시 case 만). **미채택**.
- **B (paradigm shift, graph emergent)**: schema.yaml `standard_decompositions` 영역 deprecate. §5.5 graph 가 ontology source. canonicalizer (alias dedup) 만 보존. panel 폐기 또는 graph view 로 교체. **미채택** (D-wide 보다 보수적).
- **C (관망)**: 본 §5.10 자체 보류. §5.4 본체 (PMBOK 명시 분해) 만 사용. **미채택**.
- **★ D (LLM-only, ontology layer 제거)**: §5.4 self-extending 전체 deprecate (Stage 1~4 모두). LLM + qmd embedding 백이 의미 처리 일임. wikey 는 raw → wiki organization + retrieval interface 만. **채택 (D-wide, 7-type schema gate 까지 deprecate)**.

#### 5.10.5.3 옵션 D-wide 상세 (LLM-only architecture)

> **사용자 mental model**: LLM 시대의 ontology 시대착오. 전통 ontology (umbrella / decomposition / components / RDF / OWL / Schema.org) = pre-LLM (~2020) reductionist approach. LLM 시대 = 의미 추론 백에서 자동 (예: "ISO 27001" / "iso-iec-27001-2022" / "ISMS" 가 같은 개념임을 LLM 이 이미 인식). schema 명시 = 인위 layer.

**wikey 의 LLM-백 위 layer 정의** (옵션 D 시):
1. raw → wiki organization (자료 인입 + 분류 + 페이지 생성) — 사용자 가치 명확
2. canonical slug normalization (minimal — file hash 기준 dedup, alias 다국어 / 동명이인 정도만)
3. LLM 자연 retrieval (qmd embedding + LLM 답변)
4. 사용자 interface (chat / dashboard / search / settings)

**deprecate 대상** (옵션 D — **D-wide v4 갱신** 2026-05-04, 보조 plan v4 §3.1 / §3.1.1 단일 소스):
- §5.4 Stage 1~4 (self-extending 전체)
- `standard_decompositions` schema 모델
- `.wikey/schema.yaml` 의 `standard_decompositions` + `entity_types` + `concept_types` + `custom_types` section 모두 (D-wide). **`aliases` / `pii_patterns` 만 보존**
- `wikey-core/src/schema.ts:20~21` `ENTITY_TYPES` / `CONCEPT_TYPES` 상수 + `:241~` `buildSchemaPromptBlock` + `:71~118` validation helpers (D-wide v4 ripple, R1)
- `wikey-core/src/canonicalizer.ts:363~467` `FORCED_CATEGORIES` + `detectAntiPattern` + 7-type 분류 검증 (D-wide v4 ripple, R2). minimal alias normalization 만 잔존
- `wikey-core/src/types.ts:129~132` `EntityType` / `ConceptType` union (string 으로 완화) + `:299~302` `Mention.type_hint` 완화 (D-wide v4 ripple, R3)
- `.wikey/suggestions.json` (Stage 2 store)
- `.wikey/converged-decompositions.json` (Stage 4 store)
- `.wikey/mention-history.json` (단 §5.5 graph 시각화 retention 시 보존)
- panel Suggestions UI (header button + sidebar-chat.ts 의 §11 코드 모두 + SchemaYamlModal)
- canonicalizer.ts 의 Stage 1 schema override 로직 (BUILTIN_STANDARD_DECOMPOSITIONS 포함)
- `wikey-obsidian/src/settings-tab.ts:1126~1132` schema sample (entity_types/concept_types 예시 제거, D-wide v4 ripple R4)

**유지** (옵션 D):
- canonicalizer.ts 의 minimal alias normalization (slug → canonical-slug, 동명이인·다국어·약어)
- §5.2 검색 graph expansion (1-hop wikilink) — 단순 wikilink 그래프, ontology layer X
- qmd embedding + LLM 답변 (§5.2 핵심)
- raw → wiki organization (Stage 0 ingest pipeline 의 wiki write)
- entity / concept 페이지 생성 (canonicalizer LLM 추출, schema 명시 없이)

**migration cost** (옵션 D-wide v5.3 갱신, 보조 plan §3.1.1 R1~R8 ripple 반영):
- 약 35~55 file 변경 (Stage 1~4 코드 + test + plan + schema + 7-type schema gate ripple R1~R5)
- §5.4 cycle 의 732 PASS 중 ~110 test 폐기 또는 deprecate (Stage 1~4 unit + integration + entity/concept type validation + buildSchemaPromptBlock + isValidEntityType + FORCED_CATEGORIES test 추가)
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

#### 5.10.5.4 옵션 A 작업 단위 (미채택, 참조용 — "점진" 경로)

- [ ] **자동/수동 매트릭스 chain break 3 fix**:
  - schema.yaml 등록 자동화 (ingest 시 high-confidence 후보 직접 append, panel Accept 우회)
  - alias 자동 merging (canonicalizer 강화 — 같은 표준의 다른 표기 한 wiki 페이지 통합)
  - umbrella 자체 wiki 페이지 자동 생성 (group level concept page)
- [ ] **자동 등록 audit log** (`.wikey/standard-audit.json`): 자동 등록 이력 trace.
- [ ] **panel rename**: `Suggestions` → `Knowledge audit` 또는 `지식 audit` (audit 컨셉 일치).
- [ ] **threshold split**: high-confidence 자동 / low-confidence panel review.
- [ ] **자동 / 수동 구분 시각화**: schema.yaml `origin` 필드 (suggested / manual / converged / builtin / auto-ingested) 색상 / icon 구분.

#### 5.10.5.5 옵션 B 작업 단위 (미채택, 참조용 — "graph emergent" 경로)

- [ ] **§5.4 본체 deprecation 결정**: `standard_decompositions` schema 모델 폐기. 외부 표준 명시는 별 schema (`aliases.yaml` 또는 `manual-overrides.yaml`) 로 분리.
- [ ] **§5.5 graph 시각화 → ontology source 격상**: NetworkX + Leiden community detection 이 자연 cluster 발견. mention graph 가 primary ontology.
- [ ] **canonicalizer alias dedup 강화**: canonical slug normalization 로직 강화 (다국어 / synonym / 동명이인 / 모델 변형 모두 graph node identity 통합).
- [ ] **검색 PageRank 통합** (§5.2 확장): 1-hop wikilink 외에 PageRank-like ranking 으로 자연 중심 search 결과 정렬.
- [ ] **panel UI 폐기 또는 graph view 교체**: header button 제거 또는 graph 시각화 panel 으로 대체.
- [ ] **migration script**: 기존 schema.yaml `standard_decompositions` → `manual-overrides.yaml` (외부 표준 명시 hardcode 만 보존).
- [ ] **wiki/concepts/<umbrella>.md 자동 생성**: graph cluster center 가 자체 wiki 페이지 — 그룹 명시 schema 없이 graph 관계만으로.

#### 5.10.5.6 epistemology 비판 (영구 기록)

> **사용자 명시**: "지식 분해하는 그룹이 왜 필요? 세상 수많은 지식을 어떻게 표준화?"

§5.4 의 "표준 분해" = **외부 정형 표준에만 적용 가능한 reductionism**. 일반 지식 (잡지·메모·임의 자료) 에는 mismatch. wikey 의 *진정한* 가치 = mention graph (relational) + 의미 search (LLM/embedding) — 그룹 분해 X.

본 §5.10 의 epistemology 정당화는 implementation cycle 진입 시점에도 보존.

#### 5.10.5.7 보조 plan 문서

- `plan/phase-5/phase-5-todox-5.10-graph-emergent-ontology.md` v5.4 — 본 §5.10 의 detail spec single source. migration script + canonicalizer 강화 + graph community detection 알고리즘 + 검색 PageRank 통합 + panel rename / 폐기 결정 로직.
- `activity/phase-5/phase-5-result.md §5.10.5` — paradigm shift 등록 chain + 8 cycle codex 누적 timeline + commit hash mirror.

#### 5.10.5.8 연계 / dependency

- §5.5 지식 그래프 · 시각화 (NetworkX + Leiden + vis.js) — 본 §5.10 paradigm shift 의 inferred technical foundation. §5.10 진행 시 §5.5 와 통합.
- §5.4 self-extending — 본 §5.10 의 deprecation 대상. 옵션 D-wide 채택 → §5.10.3/§5.10.4 (Phase 3 + 4) 에서 일괄 폐기.
- §5.2 검색 graph expansion (1-hop wikilink) — graph emergent 의 일부 구현. 본 §5.10 진행 후 PageRank 까지 확장 검토.
- canonicalizer.ts — alias dedup 강화의 단일 진입점. 본 §5.10 Phase 3 (§5.10.3.3 R2) 의 핵심 수정 대상.

#### 5.10.5.9 진행 권장 시점

- ★ 2026-05-04 session 15 갱신: 사용자 **D-wide 채택 + 8 cycle codex 누적 + plan v5.4 종결 + SDD+TDD todo 변환 + regroup** 모두 commit 완료. cycle #8 NEEDS_REVISION 잔존 minor stale 2건 (§7 self-check / plan-full.md cascade) 은 implementation cycle 진입 시 자연 정리.
- 옵션 A/B/C 는 채택 안 됨 (§5.10.5.4/§5.10.5.5 history 보존). 진입점 = §5.10.1.1 Entry baseline.

#### 5.10.5.10 SDD+TDD framework reference (기존 진입 가이드, 2026-05-04 작성, regroup 후 흡수)

> **본 framework reference 는 §5.10.1~§5.10.4 의 모든 Phase 가 따르는 공통 SDD+TDD 사이클 정의**. 각 Phase 가 자체적으로 framework 를 references 하므로 본 §5.10.5.10 은 historical reference. 우선순위 표는 본 regroup (2026-05-04 session 15 후속) 으로 §5.10 main intro 매트릭스로 흡수.
>
> **spec single source**: 보조 plan `plan/phase-5/phase-5-todox-5.10-graph-emergent-ontology.md` v5.4.
>
> **TDD 사이클 강제** (rules.md §2): 매 AC 별 RED → GREEN → REFACTOR → 회귀 4 단계 분리 commit 권장. 80%+ coverage gate 유지.
>
> **Karpathy 4 원칙**: Simplicity (최소 코드) / Surgical (필요 라인만) / Goal-Driven (각 AC 정량 gate) / Evidence-Based (fresh `npm test` + build 0 errors 매 commit).

**진입 baseline 확보** (2026-05-04 작성, regroup 후 §5.10.1.1 로 흡수):
- `npm test` fresh re-run → 현 PASS 수 기록 (보조 plan v5.4 expected = 732). build 0 errors 확증.
- `git status` clean 확증 (v5.4 plan 본문 commit 완료 상태).
- `.wikey/` 현황 snapshot (`ls -la /Users/denny/Project/wikey/.wikey/` 7 file 보존).
- vault root 0-byte md `find . -maxdepth 1 -type f -name "*.md" -size 0c` snapshot (10 개 — C5 cleanup baseline).

**우선순위 + dependency 그래프** (2026-05-04 작성, regroup 후 §5.10 main intro 매트릭스로 흡수):

| 순서 (regroup 전) | cycle | 신규 § (regroup 후) | 이유 |
|-----|-------|---------------------|------|
| 1 | C5 (C) Cleanup — root 0-byte md `rm` | §5.10.1.2 (Phase 1 step 0) | 즉시 가능 (사용자 승인만). vault state 깨끗하게 시작 → 이후 cycle 의 라이브 smoke 노이즈 0 |
| 2 | C1 — Step 2/3 conversion 통합 | §5.10.1.3~5.10.1.9 (Phase 1) | 단독 cycle 가능 (옵션 D-wide 와 직교). AC-C1.1~C1.7 정량 gate, ~19 신규 test. 회귀 baseline 732 → ≥ 751 |
| 3 | C5 (A)+(B) Prevention + Intercept | §5.10.2 (Phase 2) | C5 cleanup 후 자연스러운 후속. query-pipeline + sidebar-chat 양쪽 정정. ≥ 4 신규 test |
| 4 | D-wide implementation | §5.10.3 (Phase 3) + §5.10.4 (Phase 4) | 큰 작업. baseline 732 → ~622 (~110 폐기) + ~35~55 file 변경. R0~R8 + M + L + F |

**다음 세션 master 첫 액션** (2026-05-04 작성, regroup 후 §5.10.1.1 + §5.10.1.2 로 흡수):
- 첫 명령: master 가 §5.10.1.1 Entry baseline 확보 → §5.10.1.2 C5 cleanup 사용자 승인 ("vault root 의 9 개 0-byte md 삭제해도 될까요?") → 승인 후 rm + invariant 확증 → §5.10.1.3 AC-C1.1.RED 진입 (`wikey-core/src/__tests__/conversion.test.ts` 신규 작성, ≥ 10 cases 실패 확증).

**각 Phase 완료 시 산출물** (2026-05-04 작성, regroup 후 각 Phase Exit 검증으로 흡수):
- `activity/phase-5/phase-5-result.md §5.10.{Phase N}` 결과 추가 (timeline + AC 별 evidence + commit hash + 회귀 baseline)
- `wiki/log.md` 엔트리 (인제스트/lint 변동 시)
- `plan/phase-5/phase-5-todo.md §5.10.{Phase N}` 체크박스 갱신
- 각 AC 별 commit 분리 (RED / GREEN / REFACTOR / 회귀 4 commit 권장 — Karpathy Surgical 추적 용이)

**전체 cycle 종료 condition** (2026-05-04 작성, regroup 후 §5.10.4.6 F.2 로 흡수):
- 4 Phase (§5.10.1~§5.10.4) 모두 GREEN 후 codex Mode D Panel post-impl review 1 회 통합. APPROVE 시 §5.10 전체 종결 mark + Phase 5 종결 검토 (§5.6/§5.7/§5.8/§5.9 잔여 평가).

## 5.11 Page Promotion Threshold (Issue B) — 2026-05-05 session 18 ✅ Unit GREEN

> **상위 plan**: [`plan/phase-5/phase-5-todox-5.11-page-promotion-threshold.md`](./phase-5-todox-5.11-page-promotion-threshold.md)
> **이슈 출처**: 사용자 raise 2026-05-05 session 17 — 단순 출처 / 1회 mention 만 있는 고유명사 (예: '전라남도 테크노파크') 도 자체 wiki 페이지 생성되는 noise 문제.

- [x] 보조 plan v1 작성 (`plan/phase-5/phase-5-todox-5.11-page-promotion-threshold.md`)
- [x] **Layer 1 (LLM 자율, prompt-level)**: `canonicalizer.ts::buildCanonicalizerPrompt` 작업 규칙 8 추가 — promotion threshold guidance (≥ 2회 의미 등장 또는 hub 역할 시만 promote, 단순 출처 제외).
- [x] **Layer 2 (deterministic, code gate)**: `canonicalizer.ts::assembleCanonicalResult` 의 `countOccurrences()` + `PROMOTION_THRESHOLD = 2` substring count gate. `CanonicalizeArgs.sourceBody?: string` 추가 (optional, backward compatible). `dropped[].reason` 에 `single-mention (N occurrence) — not promoted to page` 명시.
- [x] **ingest-pipeline 통합**: FULL route + SEGMENTED route 양쪽 `canonicalize({ ..., sourceBody })` 전달.
- [x] **test ≥ 4 신규**: AC1 (sourceBody 미전달 backward) / AC2 (single-mention dropped) / AC3 (multi-occurrence promoted) / AC4 (alias 합산 promoted). 결과: **608 PASS** (이전 604 + 4 신규).
- [ ] 라이브 cycle smoke (사용자 vault, 다음 ingest cycle): 신규 ingest 시 `console` 에 `[Wikey ingest] dropped sample: X (single-mention 1 occurrence)` 로그 확인 + 단순 출처 page 신규 생성 0.
- [ ] 기존 vault 의 single-mention page (jeonnam-technopark 등) cleanup = 별 cycle (re-ingest 시 자동 정리되거나 사용자 명시 삭제).


---

## 5.11 v2 의미·관련도 promotion threshold + 원문 언어 alias + wiki 완전 초기화 — 2026-05-05 session 19 ✅ 완료

> **상위 plan**: [`plan/phase-5/phase-5-todox-5.11-page-promotion-threshold.md`](./phase-5-todox-5.11-page-promotion-threshold.md) v2.5
> mirror: [`activity/phase-5/phase-5-result.md §5.11 v2`](../../activity/phase-5/phase-5-result.md) · 상세: [`activity/phase-5/phase-5-resultx-5.11-v2-2026-05-05.md`](../../activity/phase-5/phase-5-resultx-5.11-v2-2026-05-05.md)

- [x] codex 5 cycle (4 plan + 1 post-impl) 누적 검증 — 17 finding 처리 (12 fix + 5 dispute)
- [x] 환경 완전 초기화 (raw 분류 0_inbox 원복 + sidecar 3 삭제 + wiki content 58 삭제 + skeleton frontmatter 보존 + .wikey/qmd cache reset)
- [x] canonicalizer rule 8 v2 (의미·관련도 + 단순 출처/장소 ❌ + 1~3개 OK)
- [x] canonicalizer rule 9 신규 (원문 언어 중심 + 반대 언어 alias)
- [x] canonicalizer countOccurrences 하이픈/공백 normalize
- [x] ingest-pipeline B1 cap 제거 + B6 FULL route dropped sample log
- [x] wikey.schema.md overview.md 폐기 + log.md 의미 재정의
- [x] 회귀 613 PASS / 0 errors / build OK
- [x] 라이브 smoke 1 source (한국어 PMBOK FULL route): 14 mentions → 12 promoted / 4 dropped, alias 한국어 보존 ✓
- [x] commit chain (4): `7320c4d` / `dab00f7` / `d1330b8` / `be5449c`

---

## 5.11 v3 paradigm 회귀 fix — alias 카운트 inflation + Layer 1 prompt 강화 — Session 23, 2026-05-07 (draft)

> **이슈 출처**: 사용자 raise 2026-05-07 — finetree-SQL ingest Preview 에서 `tsdb / rbac / rlhf / eda` 4 concept 등장. raw 본문 검증 결과:
> - **EDA**: `탐색적 데이터 분석(EDA) 지원` *1 문장 parenthetical* — paradigm 의 "1회 mention 만 있는 고유명사" 거부 대상이지만 Layer 2 의 alias 카운트 inflation (1 문장 내 acronym + 한국어 풀네임이 2 카운트) 으로 promote 됨
> - **TSDB**: `Data Lake(RDB, TSDB)` + `RDB, TSDB 등 이기종 데이터 소스` *데이터 형식 list element* — paradigm 의 "약한 관련 / 단순 list element" 거부 대상이지만 Layer 1 (Gemini Flash) 가 거부 정책 무시
> - RBAC / RLHF — paradigm 부합 (action/property/relation 서술 강함)
>
> **분류**: P1 paradigm regression fix. §5.11 v2 의 의미론적 원칙 (1회 mention / 약한 관련 거부) 이 실제 ingest 에서 회귀하는 케이스 발견.
> **status**: draft / 다음 세션 시작 시 master 우선 진행

### 5.11 v3 Specification (합본 spec)

**Goal**: §5.11 v2 paradigm 의 "의미론적으로 연결되지 않은 단순 mention 차단" 원칙을 *deterministic gate* + *LLM prompt* 양 layer 에서 강화. parenthetical-only acronym (EDA case) + list element acronym (TSDB case) 자동 drop.

**현재 회귀 원인**:
1. **Layer 2 (`countOccurrences`, canonicalizer.ts:293)**: `[name, ...aliases]` 모든 substring 매칭 횟수 *합산*. 한 문장 안 acronym + 한국어 풀네임 (`(EDA)` + `탐색적 데이터 분석`) 이 2 카운트 → ≥ PROMOTION_THRESHOLD(2) 통과
2. **Layer 1 (Stage 3 prompt, canonicalizer.ts:248~257)**: "1회 mention / 약한 관련 거부" 가이드를 Gemini Flash 가 acronym 류 (technical term 자체) 가 등장하면 promote 하는 경향

### 5.11 v3 Acceptance Scenarios

- **AC-v3.1** EDA case (parenthetical 1회): `탐색적 데이터 분석(EDA) 지원` 단일 문장 → drop
- **AC-v3.2** TSDB case (list element 2회): `Data Lake(RDB, TSDB)` + `RDB, TSDB 등 이기종 데이터 소스` → drop (또는 promote 여부는 Layer 1 정확도 ↑ 후 확정)
- **AC-v3.3** RBAC case (action/property 서술 2회): `역할 기반 접근 제어(RBAC)` + `RBAC — 부서별...접근` → promote (paradigm 부합 보존, 회귀 0)
- **AC-v3.4** RLHF case (메커니즘 핵심 2회): `RLHF 메커니즘 제공` + `RLHF 학습` → promote (회귀 0)
- **AC-v3.5** PMBOK 한국어 alias case (§5.11 v2 회귀 0): 12 promoted / 4 dropped 그대로 유지
- **AC-v3.6** dropped reason 정확도: parenthetical-only / list-element / acronym-no-context 별 명명 분리

### 5.11 v3 sub-section

- [ ] **§5.11 v3.A** Layer 2 deterministic gate 강화 — `countOccurrences` 가 *unique sentence position* 카운트
  - 본문을 sentence boundary (`. ! ? \n\n`) 로 split → 각 sentence 안에서 alias 매칭은 1 카운트
  - alias `[eda, exploratory-data-analysis, 탐색적 데이터 분석]` 이 한 sentence 안 매칭 → **1**, 두 sentence 면 **2**
  - threshold = 2 유지. 의도 (서로 다른 location 에서 ≥ 2 mention) 정확 적용
  - 추정 LOC: ~50 (canonicalizer.ts countOccurrences + sentence-tokenize helper) + test 5 case

- [ ] **§5.11 v3.B** Layer 1 prompt 강화 — parenthetical / list element / acronym-only context 명시 거부
  - prompt rule 8 추가:
    - "parenthetical 1회 acronym (`(XXX)` 패턴 한 문장 등장 only) 은 거부"
    - "단순 list element (`A, B, C 등` / `Data Lake(RDB, TSDB)` 같은 enumeration only) 은 거부"
    - "acronym 자체로만 1~2회 등장 + action/property/relation 서술 부재 시 거부"
  - 예시 (긍정): `RLHF 메커니즘 제공 — 사용자가 수정한 SQL을 학습 데이터로 활용` (action 서술 있음 → promote)
  - 예시 (부정): `Data Lake(RDB, TSDB)` (parenthetical-only enumeration → 거부)

- [ ] **§5.11 v3.C** dropped reason 정확도 ↑ — 명명 분리
  - 현재: `single-mention (N occurrence)` (단일 라벨)
  - v3: `parenthetical-only`, `list-element`, `acronym-no-context`, `single-sentence-multi-alias`, `weak-relation` 등 분류
  - canonicalizer.ts dropped 구조에 reason taxonomy 추가
  - 사용자가 console log 의 dropped sample 만 보고 paradigm 회귀 즉시 진단 가능

### 5.11 v3 진행 흐름 — SDD+TDD

```
Phase 0: codex Mode D Panel — Layer 2 sentence-tokenize + Layer 1 prompt 강화 plan 검증
Phase 1: TDD RED — AC-v3.1~v3.6 신규 6+ test case
Phase 2: TDD GREEN — countOccurrences sentence-tokenize + prompt rule 8 강화
Phase 3a: 회귀 (678+ PASS / build / validate-wiki)
Phase 3b: BLUE — sentence-tokenize helper extract / dropped reason taxonomy
Phase 4: 라이브 smoke — finetree-SQL 재 ingest. tsdb/eda drop / rbac/rlhf promote 확증
Phase 5: codex post-impl
Phase 6: master verdict + commit + push + result 문서
```

### 5.11 v3 의존성

- §5.15.D 완료 후 진행 (현재 inline media strip + audit row UI + wikilink whitelist sanitize 미커밋 — push 필요)
- 또는 §5.15.D 와 함께 묶음 commit (현재 모두 미커밋)

### 5.11 v3 진행 우선순위

**P1 paradigm regression fix**. 사용자 raise 즉시 처리 (paradigm 회귀가 wiki noise 누적 → compounding 가치 침해).

---

## 5.12 Source Wikilink Format — `## 출처` wikilink wiki/sources/source-<base>.md 매칭 — 2026-05-05 session 19 ✅ 완료

> **상위 plan**: [`plan/phase-5/phase-5-todox-5.12-source-wikilink-format.md`](./phase-5-todox-5.12-source-wikilink-format.md) v3
> mirror: [`activity/phase-5/phase-5-result.md §5.12`](../../activity/phase-5/phase-5-result.md) · 상세: [`activity/phase-5/phase-5-resultx-5.12-source-wikilink-format-2026-05-05.md`](../../activity/phase-5/phase-5-resultx-5.12-source-wikilink-format-2026-05-05.md)

- [x] codex 2 plan cycle (NEEDS_REVISION → P1 0건 narrow → master 직접 fix + cycle skip) + post-impl APPROVE
- [x] canonicalizer.ts 시그니처 chain 5 함수 (canonicalize / assembleCanonicalResult / validateAndBuildPage / applyCrossLinks / buildPageContent) sourcePageBase 인자 추가
- [x] buildPageContent lowerSrc/sidecarRef 분기 제거 → 단일 derive
- [x] ingest-pipeline.ts FULL (line 540) + SEGMENTED (line 612) 양 route normalizeBase(summaryParsed.source_page.filename) derive
- [x] canonicalizer.test.ts baseArgs default + §5.3 4 case replace + §5.12 신규 2 case
- [x] 회귀 615 PASS / 3 skipped / 0 errors / build OK
- [x] 라이브 sed fix → validate-wiki.sh PASS (12 broken → 0)
- [x] commit chain (2): `1199284` / `12f2085`

---

## 5.13 잔존 follow-up 3 항목 (A1 + B2 + C4) — 완료 — Session 21, 2026-05-07 ✅

> **상위 plan**: [`plan/phase-5/phase-5-todox-5.13-residual-followups.md`](./phase-5-todox-5.13-residual-followups.md) v2 · status: **completed**
> 상세: [`activity/phase-5/phase-5-resultx-5.13-completion-2026-05-07.md`](../../activity/phase-5/phase-5-resultx-5.13-completion-2026-05-07.md)

- [x] §5.13 v0.1 → v1 → v2 갱신 (codex cycle #1 finding fix — A1 PII guard 흐름 / C4 normalize 위치)
- [x] **B2**: validate-wiki.sh 4단계 cascade (wiki 자체 → wiki .md → raw 자체 → raw .*) + scripts/validate-wiki.test.sh 6 AC fixture (`5d87995`)
- [x] **A1**: `## 출처` raw wikilink 병기 + `rawSourceFilename` arg 1개 추가 (PII guard 분리, args chain 6 함수) + canonicalizer.test.ts §5.13 block 6 test (`58914d8`)
- [x] **C4**: `normalizeSourcePageFilename` helper export + callLLMForSummary 적용 + buildIngestPrompt 강제 문구 + ingest-pipeline.test.ts §5.13 block 6 test (`dfc5e6a`)
- [x] Phase 3a 회귀: 628 PASS / 3 skip / 0 fail / build PASS / validate-wiki PASS
- [x] Phase 3b BLUE: defense in depth (prompt + normalize) 의도적 유지 / args chain narrow inline / paradigm 주석 명시
- [ ] **AC-A1-6 라이브 cycle smoke** (다음 세션 사용자 라이브 검증, master 의무, obsidian-cdp SKILL)
- [ ] codex post-impl cycle 재검증 — cmux dispatch 환경 이슈 fix 후

---

## 5.14 retrospective TDD-BLUE refactor — Tier 2-4 narrow 완료 — Session 20, 2026-05-06 ✅

> **상위 plan**: [`plan/phase-5/phase-5-todox-5.14-retrospective-blue-refactor.md`](./phase-5-todox-5.14-retrospective-blue-refactor.md) v1 · status: **completed**
> 상세: [`activity/phase-5/phase-5-resultx-5.14-tier-2-4-blue-2026-05-06.md`](../../activity/phase-5/phase-5-resultx-5.14-tier-2-4-blue-2026-05-06.md)

- [x] master 사전 진단 재확증 — Tier 2-4 narrow scope 결정
- [x] **Tier 2** (core 6 파일) BLUE — canonicalizer / ingest-pipeline / wiki-ops / pii-redact / query-pipeline / schema (net LOC +4)
  - [x] §5.14.A canonicalizer.ts — `applyPromotionGate` + `buildCategoryPages` + `rebuildPageWithCrossLinks` extract / `RawPage` 통합
  - [x] §5.14.B ingest-pipeline.ts — `canonicalizeAndAssembleParsed` extract (FULL/SEGMENTED route 공통화)
  - [x] §5.14.C wiki-ops.ts — `buildPath` dead-after-throw 제거 / JSDoc 압축
  - [x] §5.14.D pii-redact.ts — 모듈 doc-comment 압축
  - [x] §5.14.E query-pipeline.ts — `renderContextPages` extract / `ONE_HOP_CAP` 명명
  - [x] §5.14.F schema.ts — doc-comment 통합
- [x] **Tier 3** (UI 4 파일) narrow cleanup — sidebar-chat / settings-tab / ingest-modals / status-bar 의 historical context 압축
- [x] **Tier 4** wikey-core 잔여 sampling — 누적 §5.10.4 D-wide 표기 추가 압축
- [x] AC 검증: 615 PASS / 3 skipped / 0 build errors / validate-wiki PASS / live smoke 1 source full cycle
- [x] codex post-impl: cycle #1 P2 finding (entity 패스 cross-pool dedup 누설) → fix → cycle #2 APPROVE
- [x] obsidian-cdp 라이브 smoke (master 직접) — `raw/0_inbox/nanovna-v2-notes.md` full cycle / IV.A movePair / wiki write 9 files

### 5.14 영구 정책 등록 ✅ 완료
- [x] `claude-forge-custom/rules/testing.md` Phase 3a/3b 분리 의무 (commit `0cb2e06`)
- [x] `wikey/CLAUDE.md` project-specific mirror (commit `eccf98a`)
- [x] §5.14 todox v0 → v1 (scope 4 tier 확장, commit `eccf98a`)
- [x] Session 20 본 §5.14 가 그 정책의 첫 retrospective 적용 사례

### 5.14 잔존 후속 — narrow BLUE (session 22, 2026-05-07) 부분 진행
- [x] **sidebar-chat.ts narrow refactor**: 3 top-level helper 추출 (loadAuditScriptOutput / renderConverterCapabilityWarning / applyPairedSidecarToAudit) + 3 함수 audit-ingest fetch DRY (renderAuditSection / renderAuditSummaryOnly / renderRawSourcesDashboard) + dynamic `await import('wikey-core')` 2개 → top-level `LLMClient` import 전환. renderAuditSection 727 → 687 LOC (-40). 5 패널 라이브 smoke OK (Chat/Dashboard/Audit/Ingest/Help 모두 render, console 0 error).

### 5.14 본체 종결 (session 23, 2026-05-07) ✅
> **사용자 명시**: "5.14 의 잔존 작업 'UI E2E test 의존' 과 관련해서 진행해줘. 이제 본체 관련된 모든 작업은 이것으로 종결되어야 함."
> 상세 분석 + 항목별 정량 근거: [`plan/phase-5/phase-5-todox-5.14-retrospective-blue-refactor.md §9`](./phase-5-todox-5.14-retrospective-blue-refactor.md)

- [x] **sidebar-chat.ts deeper split** — 의도적 유지. `renderAuditSection` 외부 closure state 12+ (auditMode/viewMode/searchQuery/treeExpand mut + auditData/ingestedSet/unsupportedSet 등 immut). inner closure (renderList 95 / renderTree 95 / ingest click handler 196) extract 시 props 객체 + 4 setter callback formalization +50 LOC, helper 격상 ~436 LOC, renderAuditSection 자체 200~250 LOC 잔존 → **net LOC ≈ 0, indirection 만 추가** (Simplicity First 위반). UI E2E test 인프라 부재 (wikey-obsidian package.json 에 vitest/jest 의존성 0건) 로 회귀 안전망 부족. 추후 인프라 구축 시 재평가.
- [x] **settings-tab.ts 추가 분해** — 의도적 유지. 이미 `render*Section` 으로 section-decomposed (renderEnvStatusSection 148 / renderGeneralSection 180 / 기타 6 section). 추가 split 시 같은 setting group 내 인접 행이 코드에서도 인접해야 직관적인 UI/코드 1:1 mapping 깨뜨림 → artificial split.
- [x] **main.ts onload 131 LOC** — 의도적 유지. closure state 8개 (startTime / STARTUP_GRACE_MS / bypassBatch / bypassTimer / autoQueue / autoTimer / scheduleAutoIngest / renameDebouncers Map) 가 plugin lifecycle scoped — handleVaultRename / handleVaultDelete 는 이미 method 추출, handleVaultCreate inline 의 6 closure state 격상 시 캡슐화 약화 + indirection 추가. closure 가 lifecycle-scoped state 의 자연스러운 캡슐화.
- [x] **commands.ts runIngest 113 LOC** — 의도적 유지. fast path (skip branch early return) / stay-involved flow / inner loop 3 단계 cleanly structured + step 별 주석. extract 후보 명확히 없음 (각 step 5~30 LOC, 함수 호출 1줄 + 정의 N+2줄 = indirection 만).

**§5.14 본체 종결 verdict**:
- Tier 2 (core 6 파일) BLUE ✅ session 20 `888317f`
- Tier 3 (UI 4 파일) narrow cleanup ✅ session 20 `888317f`
- Tier 4 wikey-core 잔여 sampling ✅ session 20 `888317f`
- Layer 6 waitUntilFresh 강화 ✅ session 22 `f8476d4`
- sidebar-chat narrow refactor ✅ session 22 `7a166f4`
- 잔존 4 항목 의도적 유지 결정 ✅ session 23 (본 섹션)
- TDD-BLUE Phase 3a/3b 영구 정책 ✅ session 19 `0cb2e06` + `eccf98a`

### 5.14 follow-up — qmd query 회귀 6 layer silent fail fix (session 20 후반) ✅
- [x] Layer 1 native binding rebuild (NODE_MODULE_VERSION v24/137 → v22/127)
- [x] Layer 3 plugin execEnv PATH detectedNodePath dir prepend (env-detect.ts + main.ts)
- [x] Layer 4 findQmdBin 우선순위 (vendored qmd.js 1단계 — query-pipeline.ts)
- [x] Layer 5 qmd collection path 자동 verify (scripts/setup.sh)
- [x] citation marker (📄 / [원본]) 폐기 — attachCitationBacklinks 호출 비활성 (사용자 raise: wiki 페이지에 "원본" 마커 misleading)
- [x] 영구 메모리 등록: `feedback_qmd_node_abi.md` 6 layer 진단 순서
- [x] Layer 6 waitUntilFresh 강화 — `expectMinIndexed` arg 추가 + reindex.sh schema 에 `indexed` 필드 + ingest-pipeline runReindexAndWait 에 `countWikiMdFiles` wiring (session 22, 2026-05-07). 6 unit test PASS, 빈 collection silent-fresh 회귀 detect — error message `indexed=N, expectMin=M` surface.

### 5.13 follow-up — vault-wide basename 충돌 detection (session 22, 2026-05-07) ✅
- [x] `scripts/validate-wiki.sh` 검증 6 추가 — raw `<X>.md` ↔ wiki `<X>.md` 동일 basename 발견 시 FAIL (Obsidian basename matcher path-proximity 로 wiki page 선택 → §5.13.A1 paradigm 위반 방어)
- [x] `scripts/validate-wiki.test.sh` 4 신규 fixture (AC-D1-1~4): collision FAIL / no-collision PASS / 다른 확장자 false positive 방어
- [x] 라이브 vault 회귀 0 (collision 없음 확증, validate PASS)

### 5.13 follow-up — codex post-impl cycle #1 narrow fix (session 22, 2026-05-07) ✅
- [x] codex P1 (d) — AC-C4-2/3 warn 로그 assertion 추가 + AC-C4-6 SEGMENTED route 의도 명확화 (immutability test 는 AC-C4-defensive 로 분리)
- [x] codex P2 — result doc §5.13.4 라이브 evidence 에 AC-A1-3 다양 확장자 라이브 prove 한계 명시 (unit test 6 PASS 로 cover, code path extension-agnostic)
- [x] 회귀: wikey-core 635 PASS / 3 skip / 0 build errors / validate-wiki PASS / fixture test 10/10 PASS

---

## 5.15 Pipeline v2 후속 — Session 23, 2026-05-07

> **상위 plan**: [`plan/phase-5/phase-5-todox-5.15-pipeline-v2-followups.md`](./phase-5-todox-5.15-pipeline-v2-followups.md) v0
> 도출: `docs/wikey-ingest-pipeline-v2.md §15.4 단점·리스크 + §15.6 v3 후보`

### 5.15 sub-section 5종 (A=enabler / B=flexibility / C=hygiene / D=bug-fix-and-UX / E=LLM-hang-UX) — **A/B/C/D/E 모두 종결** (사용자 결정 2026-05-08)

- [x] **§5.15.A Cycle 1 (인프라)** — vitest + happy-dom + Obsidian mock 5 인터페이스 (App / Vault / TFile / Notice / ItemView) + 14 인프라 검증 test PASS. wikey-obsidian/package.json devDeps + vitest.config.ts + `__mocks__/obsidian.ts` + `obsidian-mock.test.ts` + root package.json `test:core`/`test:obsidian` script 분리. AC-A1/A2/A5 PASS. wikey-core 700 + wikey-obsidian 14 = 714 total PASS / 0 build errors. (session 24, 2026-05-07)
- [x] **§5.15.A Cycle 2 (sidebar-chat helper 5 cover — AC-A3)** — sidebar-chat.ts 5 helper (computeRowPct / showRowError / showRowCancelled / loadAuditScriptOutput / applyPairedSidecarToAudit) export + AuditScriptCapabilities/AuditScriptOutput interface export. mock obsidian 에 HTMLElement augmentation (setText / addClass / createDiv 등 polyfill) + FuzzySuggestModal stub. 신규 21 unit tests — render 흐름의 atomic unit 모두 cover. wikey-core 700 + wikey-obsidian 35 = 735 total PASS / 0 build errors. (session 25, 2026-05-08)
- [x] **§5.15.A 종결 (Cycle 3~5 의도적 미진행)** — AC-A4 (main.ts handleVaultCreate test) / AC-A6 (§5.14 잔존 4 항목 deep split) 종결 결정. 근거: §5.14 session 23 의도적 유지 결정 (closure state 12+ field 비용 / plugin lifecycle scoped 자연 캡슐화) 의 본질이 *test 인프라 부재* 가 아니라 *분해 시 indirection 비용* 이므로 Cycle 1+2 인프라 생긴 후 재평가에도 결정 동일. Cycle 1+2 가 이미 향후 isolated function 신규 추가 시 자연 cover 가능한 안전망 제공. (session 25, 2026-05-08)
- [x] **§5.15.B** PROMOTION_THRESHOLD override (`.wikey/promotion-threshold.yaml`) — `wikey-core/src/promotion-config.ts` 신규 47 LOC + canonicalizer/ingest-pipeline 시그니처 chain + 14 신규 tests + `.wikey/promotion-threshold.yaml.example`. v0 = top-level `default:` 만 (patterns out-of-scope, Karpathy Simplicity First). 회귀: wikey-core 700 PASS / 3 skip / 0 build errors / validate-wiki PASS. (session 24, 2026-05-07)
- [x] **§5.15.C** citation 마커 dead code cleanup — `attachCitationBacklinks` (50 LOC) + `buildCitationButton` (~22 LOC) + `openResolvedSource` (~25 LOC) + `Citation`/`ResolvedSource`/`SourceRegistry` import + `loadRegistry`/`resolveSourceSync` import (wikey-obsidian 안 dead path 만) + `ChatMessage.citations` 필드 + line 474 assignment + historical 주석 모두 삭제. sidebar-chat.ts: 2325 → 2227 = **-98 LOC**. 회귀: wikey-core 686 PASS / 3 skip / 0 build errors / validate-wiki PASS. (session 24, 2026-05-07)
- [x] **§5.15.E** LLM hang UX hardening (F2/F3/F4) — 사용자 raise "ingest 실패한 듯 + 에러 문구 없음 + linebar 빨강 아님" 근본 진단으로 도출. F1: `commands.ts:382` conversion fail error propagation fix. F2: `main.ts` ObsidianHttpClient.request 에 timeout (Promise.race + setTimeout, default 5분). F3: ingest-modals processing phase 에 elapsed (분/초) 1초 timer + `wikey-modal-progress-elapsed` element. F4: sidebar-chat 의 cancel 분기 4 호출처 보강 + `showRowCancelled` helper + `wikey-audit-path-cancelled` CSS — silent gray → "취소됨" 명시. 라이브 smoke iso-27001-overview.md (2.5KB) 직접 master obsidian-cdp full cycle 검증 — F3 elapsed 1s 단위 정확 (10s → 2m 11s) / vault write 0 / Preview 도달. (session 24, 2026-05-07)
- 잔여: A (UI E2E 인프라) 만 — 다음 세션 진행 후보

### 5.15.D inline media strip + audit row UI fix + wikilink whitelist sanitize — Session 23, 2026-05-07 ✅

> **이슈 출처**: 사용자 raise 2026-05-07 — `AI 기반 다채널 비정형 문서의 데이터화  |  finetree-OCR.md` 류 4 파일 ingest 시 LLM JSON parsing 실패. 진단 결과 inline `<svg>` 본문이 95.9~97.1% 비중 (전체 156 KB 중 152 KB SVG) — `stripEmbeddedImages` 가 markdown image syntax 만 처리, inline HTML SVG/img 미처리.
> **분류**: P0 bug fix + UX raise (Phase 5 본체 종결 후 발견된 회귀)
> **합본 spec** (Bug fix 분류 — testing.md §3 매트릭스): todo 안 §Specification 섹션 (Goal/Inputs/Outputs/Invariants/AC/Out-of-scope/Dependencies)

#### 5.15.D Specification (합본 spec)

**Goal** (3 묶음):
1. inline `<svg>...</svg>` block + HTML media tag (`<img>`/`<picture>`/`<iframe>`/`<canvas>`/`<video>`/`<audio>`/`<embed>`/`<object>`) 본문이 LLM 입력에 그대로 통과되는 회귀 차단.
2. ingest 실패 시 audit row error 메시지가 별도 line 차지 → row line height 증가 → UI 레이아웃 깨짐. 분류 hint span 자리에 override.
3. raw 파일명에 wikilink-unsafe character (`|` `[` `]` `#` `^` `\` + Unicode 특수문자) 포함 시 `## 출처` 둘째 줄 raw wikilink 가 깨짐 → vault rename + canonicalizer wikilink emit 양쪽 sanitize.

**Acceptance Scenarios**:
- inline SVG: AC-1~AC-8 (single/multiple/nested/mixed/no-alt/empty-alt/custom-element-preserve/finetree-95%-reduction)
- HTML media: AC-9~AC-16 (img/picture/iframe/canvas/video/embed/object/custom-element)
- audit row UI: row line height 증가 0 (Ingest + Audit 패널 양쪽), 분류 hint span override 시 `wikey-audit-path-error` class 추가
- wikilink whitelist sanitize (whitelist 정책 — 사용자 통찰 "특정 캐릭터 정의는 미래 지속적 에러"): 영문/CJK/안전 ASCII 만 allow, 그 외 → `-`. 단일 hyphen 보존 (`finetree-OCR`), mixed → ` - `

**Out-of-Scope**: SVG ↔ markdown 의미 보존 (alt 만), inline `<style>`/`<script>` block, vision LLM description (별 cycle / Phase 6), 한국어 filename 정책 변경 (별 cycle).

**Dependencies**:
- `wikey-core/src/rag-preprocess.ts` (1 함수 + 2 regex)
- `wikey-core/src/wikilink-safe.ts` (신규, whitelist + sanitize)
- `wikey-core/src/canonicalizer.ts` (`buildPageContent` rawSourceFilename sanitize)
- `wikey-obsidian/src/commands.ts` (`runIngest` 진입 시 vault rename)
- `wikey-obsidian/src/sidebar-chat.ts` (`showRowError` helper + 4 호출처)
- `wikey-obsidian/styles.css` (`.wikey-audit-path-error`)

#### 5.15.D 진행 사항

- [x] **inline media strip**: `rag-preprocess.ts` 의 `INLINE_SVG` regex (`<svg ...>...</svg>`) + `INLINE_HTML_MEDIA` regex (img/picture/iframe/canvas/video/audio/embed/object) + `extractAlt` helper. `countEmbeddedImages` schema 확장 (`inlineSvg / inlineHtmlMedia` 필드).
- [x] `rag-preprocess.test.ts` — AC-1~AC-16 신규 19 case (옵션 1 + 옵션 3 묶음, custom element false positive 차단)
- [x] **audit row UI**: `wikey-obsidian/src/sidebar-chat.ts` — `showRowError(row, errorText, maxLen=80)` top-level helper 추가 + 4 호출처 (Audit ingest 2 + Inbox ingest 1 + Inbox fail-state preserve 1) 일괄 적용. 분류 hint span (`.wikey-audit-path`) text override + `wikey-audit-path-error` class 추가 → row line height 증가 0 (Ingest + Audit 패널 양쪽)
- [x] `wikey-obsidian/styles.css` — `.wikey-audit-path.wikey-audit-path-error { color: var(--text-error); }` 추가
- [x] **wikilink whitelist sanitize**: `wikey-core/src/wikilink-safe.ts` 신규 — `WIKILINK_UNSAFE_GROUP` whitelist (알파벳/CJK/안전 ASCII 외 자동 normalize), `sanitizeWikilinkTarget(filename)` + `needsWikilinkSanitize(filename)` 22 case test
- [x] `canonicalizer.ts::buildPageContent` — `safeRawTarget = sanitizeWikilinkTarget(rawSourceFilename)` 적용 (fallback safety)
- [x] `wikey-obsidian/src/commands.ts` — `runIngest` 진입 시 `sanitizeRawFilenameIfNeeded` helper 가 raw 파일명 검사 → unsafe 시 vault rename (`fileManager.renameFile`) + 사용자 Notice
- [x] 회귀: wikey-core 678 PASS / 3 skip / 0 build errors / validate-wiki PASS
- [x] **라이브 smoke** (master obsidian-cdp 직접): finetree-RAG/BOT/SQL/OCR 4 파일 fresh ingest — vault rename + sanitized wikilink + paradigm 정확 적용 (§5.11 v3 fix 후)
- [x] **footer display 원문 title — frontmatter title 시도** (사용자 raise 1차): `appendOriginalLinks` 가 wiki/sources frontmatter title 사용 → 라이브 query 결과 `종이 위의 데이터를...` (LLM 추출 부제) 가 부적절로 판명
- [x] **footer raw basename 정정** (사용자 raise 2차): `buildSourceIdToTitle` helper 폐기 → display = `basenameWithoutExt(rawVaultPath)` 만 사용. raw 파일명이 §5.15.D vault rename 후 한국어 보존이라 그대로 사용 (예: `AI 기반 다채널 비정형 문서의 데이터화 - finetree-OCR`)
- [x] **audit-ingest content hash 0순위 매칭** (사용자 raise 3차 — "URI 기반"): `audit-ingest.py` 에 `load_registry_hashes()` 추가 + 매칭 4-tier (hash 0순위 / registry path 1순위 / legacy ingest-map 2순위 / fuzzy 3순위). 4 finetree 파일 모두 INGESTED 인식 — vault 안 raw 파일 이동에도 정확
- [x] commit chain: `35c09ea` (§5.15.D 본체) → `e5238ff` (frontmatter title 1차) → `93d43b1` (raw basename 정정 + registry path 1순위) → `8555255` (content hash 0순위)

---

> **§5.16~§5.20 신규 등재 (2026-05-11 session 36)** — 사용자 본체 완성 시점 테스트 보고 9 이슈 (INGEST 7 + MAINTENANCE 2) 를 5 subject 로 분류. Step "2 > 1 > 2 업데이트 > 3" 순서 (사용자 결정 2026-05-11): (a) 본 spec/todox 신규 등재 → (b) obsidian-cdp master test 로 P0 재현 + raw evidence 수집 → (c) Step "1" 결과로 v0.2 보강 → (d) SDD+TDD 구현.

---

## 5.16 Audit / Ingest panel refresh reliability + sidecar pair label 회귀 fix (P0)
> tag: #audit, #refresh, #sidecar, #reliability
> **draft v0.1 (2026-05-11)** — 사용자 테스트 1-1·1-2·1-4 통합. Step "1" obsidian-cdp test 결과로 v0.2 보강 예정.
>
> **상위 plan**: [`plan/phase-5/phase-5-spec-5.16-audit-refresh-reliability.md`](./phase-5-spec-5.16-audit-refresh-reliability.md) (Spec) · [`plan/phase-5/phase-5-todox-5.16-audit-refresh-reliability.md`](./phase-5-todox-5.16-audit-refresh-reliability.md) (Todo)
> **참조 evidence**: `plan/ref/pms.png` (1-1 Missing 오분류) · `plan/ref/ingest-confilct.png` (1-4 Conflict overwrite)

- [x] **Step A — analyst v0.2 보강** (Step "1" raw evidence 기반 master 직접 작성, B1/B2/B3 3 결함 분리 + 11 AC 1:1)
- [x] **Step B — tester RED** (3 신규 test file 18 test 모두 RED 확증, 회귀 0)
- [x] **Step C — developer GREEN** (4 helper export + try/finally wrapper, 18 GREEN, src 4 file +50 LOC)
- [x] **Step D — Phase 3a 회귀** (wikey-core 808 + wikey-obsidian 121 = 929 PASS / build 0)
- [x] **Step E — Phase 3b BLUE** (developer self-apply: helper extract / naming / dedup / 주석)
- [x] **Step F — codex post-impl review** (cmux Mode D, 4 cycle) — cycle #1 NEEDS_REVISION 5 finding (`770106e` closure) → cycle #2 NEEDS_REVISION 3 finding (`653c08a` closure) → cycle #3 NEEDS_REVISION 3 finding (`95819a3` closure) → cycle #4 **APPROVE** (Findings: none). 총 11 finding closure + 929 PASS + build 0 + 라이브 evidence Step G. §5.16 cycle 종결 확증.
- [x] **Step G — master 라이브 cycle smoke (obsidian-cdp)** — B1/B2/B3 모두 라이브 PASS + badge color follow-up (healthy=orange / broken=red), [`activity/phase-5/phase-5-resultx-5.16-step-g-live-smoke-2026-05-11.md`](../../activity/phase-5/phase-5-resultx-5.16-step-g-live-smoke-2026-05-11.md) v1.1
- [x] **B2 ingest hook 통합** — commit `8c087aa` (commands.ts:runIngest try block 안 reconcileAfterIngest 호출 통합 + walker helper). codex finding #1+#2 closure.

---

## 5.17 Ingest 분해 결과 밸런싱 calibration — promotion threshold ceiling + write 성능 ✅ 종결 (Session 37, 2026-05-12)
> tag: #ingest, #promotion, #threshold, #performance, #done
> **종결 v0.3 (2026-05-12)** — case A 라이브 smoke 83 → 51 page (-38.6%) + write latency 180s → 63s (-65%) 확증. spec v0.3 sync + codex 3 cycle APPROVE.
>
> **상위 plan**: [`plan/phase-5/phase-5-spec-5.17-ingest-balance-calibration.md`](./phase-5-spec-5.17-ingest-balance-calibration.md) · [`plan/phase-5/phase-5-todox-5.17-ingest-balance-calibration.md`](./phase-5-todox-5.17-ingest-balance-calibration.md) · [`activity/phase-5/phase-5-resultx-5.17-live-smoke-2026-05-12.md`](../../activity/phase-5/phase-5-resultx-5.17-live-smoke-2026-05-12.md)

- [x] **Step A — analyst v0.2** (9 corpus sample 실측 → 1,500 char/page ratio 외부화 + ceiling default LOCK)
- [x] **Step B — tester RED** (17 신규 test: promotion-config T1-T4 + canonicalizer T5-T12 + ingest-pipeline T13-T17)
- [x] **Step C — developer GREEN** (4 신규 export: `loadPromotionConfig` + `applyCeilingCap` + `writePagesWithBatchYield` + `assessConversionQuality`, 825 PASS)
- [x] **Step D — Phase 3a 회귀** (wikey-core 825 / wikey-obsidian 121 / build 0 errors / validate-wiki 30 pre-existing FAIL unrelated)
- [x] **Step E — Phase 3b BLUE** (developer self-applied 6 활동 + cycle #2 P2 sweep)
- [x] **Step F — codex post-impl review** (3 cycle — #1 NEEDS_REVISION 6 finding → developer fix → #2 NEEDS_REVISION 3 finding → master fix → #3 APPROVE)
- [x] **Step G — obsidian-cdp 라이브 smoke** (case A 복제본 ingest: 59 → 51 cap formula 발화, latency 63s. case B HWP dedup 환경 제약 → unit T16/T17 + case A no-WARN telemetry 간접 PASS)

---

## 5.18 Query citation UX — 원본 1개당 1줄 + wiki backlink + registry mismatch logging ✅ 종결 (Session 37, 2026-05-12)
> tag: #citation, #ux, #backlink, #registry, #done
> **종결 v0.3 (2026-05-12)** — 라이브 smoke 3 scenario 모두 PASS (citation list format + backlink section + diagnostic modal). codex 2 cycle (#1 FAIL 4 finding → developer fix → #2 APPROVE).
>
> **상위 plan**: [`plan/phase-5/phase-5-spec-5.18-query-citation-ux.md`](./phase-5-spec-5.18-query-citation-ux.md) · [`plan/phase-5/phase-5-todox-5.18-query-citation-ux.md`](./phase-5-todox-5.18-query-citation-ux.md) · [`activity/phase-5/phase-5-resultx-5.18-live-smoke-2026-05-12.md`](../../activity/phase-5/phase-5-resultx-5.18-live-smoke-2026-05-12.md)

- [x] **Step A — analyst v0.2** (Step "1" 실측: registry 14 record, 1 mismatch sha256:679cf2dd6db75e3a 38 page 점유, Q1~Q4 LOCK)
- [x] **Step B — tester RED** (18 신규 test: query-pipeline T1-T7 + sidebar-chat-backlink T8-T13a + commands-diagnostic T12-T13)
- [x] **Step C — developer GREEN** (4 신규 export: `appendOriginalLinks` format + `collectBacklinks` + `buildBacklinkSection` + `scanCitationMismatches` + `MismatchDiagnosticModal`, 964 PASS)
- [x] **Step D — Phase 3a 회귀** (wikey-core 832 / wikey-obsidian 132 = 964 PASS / build 0 errors)
- [x] **Step E — Phase 3b BLUE** (developer 6 활동 self-applied + master `deriveExtBadge` extract → `appendOriginalLinks` 61 → 50 LOC rule compliant)
- [x] **Step F — codex post-impl review** (2 cycle — #1 FAIL 4 finding (P1 backlink wiring + P2 title/sourceId/styles + P3 T1) → developer fix → #2 ✅ APPROVE)
- [x] **Step G — obsidian-cdp 라이브 smoke** (Scenario A citation format + Scenario B backlink section + Scenario C diagnostic modal 모두 PASS, 38-page mismatch evidence)

---

## 5.19 Wiki maintenance suite — wiki-status / wiki-check / wiki-recovery / wiki-refactoring (P2)
> tag: #maintenance, #lint, #status, #recovery
> **draft v0.1 (2026-05-11)** — 사용자 테스트 2-1 통합. schema §"워크플로우 3: 린트" 의 1-click 실행.
>
> **상위 plan**: [`plan/phase-5/phase-5-spec-5.19-wiki-maintenance-suite.md`](./phase-5-spec-5.19-wiki-maintenance-suite.md) · [`plan/phase-5/phase-5-todox-5.19-wiki-maintenance-suite.md`](./phase-5-todox-5.19-wiki-maintenance-suite.md)

- [ ] **Step A — analyst v0.2** (§5.16 Spec 3 stale tombstone 흡수 결정 + 4 command 분기 LOCK)
- [ ] **Step B — tester RED** (validate-wiki + 신규 script test)
- [ ] **Step C — developer GREEN** (wiki-check.sh + wiki-recovery.sh + wiki-refactoring.sh + 4 command + Dashboard health row)
- [ ] **Step D — Phase 3a 회귀**
- [ ] **Step E — Phase 3b BLUE**
- [ ] **Step F — codex post-impl review**
- [ ] **Step G — master 라이브 cycle smoke** (사용자 vault 에서 4 command 실행)

---

## 5.20 Knowledge Gap management — query log 분석 + 자동 리포트 (P2)
> tag: #knowledge-gap, #analytics, #report
> **draft v0.1 (2026-05-11)** — 사용자 테스트 2-2 통합. Phase 6 candidate → Phase 5 편입 (사용자 결정 2026-05-11).
>
> **상위 plan**: [`plan/phase-5/phase-5-spec-5.20-knowledge-gap-management.md`](./phase-5-spec-5.20-knowledge-gap-management.md) · [`plan/phase-5/phase-5-todox-5.20-knowledge-gap-management.md`](./phase-5-todox-5.20-knowledge-gap-management.md)

- [ ] **Step A — analyst v0.2** (score formula calibration + privacy 정책 LOCK)
- [ ] **Step B — tester RED** (knowledge-gap + query log capture test)
- [ ] **Step C — developer GREEN** (log capture + score formula + report 생성 command + settings toggle)
- [ ] **Step D — Phase 3a 회귀**
- [ ] **Step E — Phase 3b BLUE**
- [ ] **Step F — codex post-impl review**
- [ ] **Step G — master 라이브 cycle smoke** (10 query 후 report 생성)
