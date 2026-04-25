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
- **보조 문서**: 착수 시 `phase-5-todox-<section>-<topic>.md` · `phase-5-resultx-<section>-<topic>-<date>.md` 형식으로 추가.
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

### 5.2.1 Entity ↔ Concept cross-link 자동 생성 (★ 답변 풍부도 결정적 fix)

- [ ] canonicalizer Stage 3 (`wikey-core/src/canonicalizer.ts`) 가 **같은 ingest 사이클의 entity ↔ concept** 사이 wikilink 를 본문에 자동 삽입
  - 현재: `index_additions` 만 wiki/index.md 에 추가. entity/concept 본문은 LLM JSON 의 `description` 만 (1~2 문장).
  - 목표: entity 본문 끝에 `## 관련` H2 섹션 + 같이 만들어진 concept 들의 `[[wikilink]]` list. concept 본문 끝에도 entity 와의 양방향 link.
  - LLM prompt 에 "entity-concept 관계 추출" 단계 추가 또는 같은 source 기반이라 자동 cross-ref 정책 ("같은 source 의 entity 와 concept 은 서로 link") 으로 결정적 생성
  - 측정: NanoVNA fixture 재실행 시 nanovna-v2.md 본문에 smith-chart, swr, s11/s21 등 wikilink 등장 확인
- [ ] **wiki 재생성 없음 확증**: 신규 ingest 부터 적용. 기존 wiki entity/concept 본문은 손대지 않음 (사용자가 reset 후 재인제스트 선택).

### 5.2.2 답변 prompt 강화 — 검색 hit 의 wikilink 1-hop 활용

- [ ] `query-pipeline.ts buildSynthesisPrompt` 에 다음 지시 추가:
  - "검색된 페이지 본문에 `[[wikilink]]` 로 언급된 다른 wiki 페이지가 있으면, 그 페이지의 정보도 가능한 활용해 답변에 포함"
  - "답변에 등장한 모든 entity/concept 은 첫 등장 시 `[[페이지명]]` 으로 링크"
  - "답변 끝 `참고:` 블록에는 직접 인용 페이지 + 1-hop link target 페이지를 모두 나열"
- [ ] 측정: NanoVNA 동일 질문 재실행 시 답변 길이 + citation 수 + 인용된 concept 수 비교
- [ ] **wiki 재생성 없음 확증**: prompt 변경만, 인덱스/wiki 무관

### 5.2.3 검색 graph expansion — 1-hop wikilink target 자동 fetch

- [ ] `query-pipeline.ts` 의 `buildContextFromFS` / `buildContextWithWikiFS` 가 검색 top-N 페이지의 본문 wikilink 를 parse → target 페이지 추가 fetch (1-hop only, depth=1 cap)
  - 예: nanovna-v2.md 가 `[[smith-chart]]`, `[[swr]]` 인용 → smith-chart.md, swr.md 본문도 LLM context 에 추가 (TOP_N=5 검색 → context 페이지 = 5 + 1-hop expansion ≤ N)
  - cap: expansion 으로 추가되는 페이지 수 ≤ 5 (token budget). 우선순위 = 검색 score + wikilink 빈도
  - Phase 5 §5.5 (지식 그래프) 의 일부 구현 (cross-ref). 본 항목은 query 시점 expansion 만, §5.5 는 사전 인덱스화.
- [ ] **wiki 재생성 없음 확증**: query 시 fetch 만, 인덱스/wiki 무관

### 5.2.4 TOP_N 상향 + 측정 (단기 quick win)

- [ ] `WIKEY_QMD_TOP_N` default 5 → 7~10 (`wikey.conf` + `wikey-core/src/config.ts`)
- [ ] 비용 영향 측정: prompt token 증가, LLM cost 증가
- [ ] §5.2.2/§5.2.3 적용 전 baseline 측정 → 적용 후 개선 폭 비교

### 5.2.5 자동 reindex silent fail 진단·수정 (검색 freshness 직결)

- [ ] **재현·진단** (cycle smoke 2026-04-25 실측, `activity/phase-5-resultx-5.1-cdp-cycle-smoke-2026-04-25.md §9.1` 4 후보):
  - (a) `reindex.sh --quick` race — `appendLog` 직후 호출 시 wiki 파일 fsync 전 가능성
  - (b) plugin execEnv PATH 누락으로 `qmd` binary ENOENT (silent)
  - (c) `--quick` 가 timestamp metadata 미갱신 → `--check` 가 stale 판정
  - (d) `WIKEY_REINDEX_TIMEOUT_MS` default 60s 부족 → silent timeout
- [ ] **routine**:
  1. NanoVNA fixture 재실행, `init-log` 후 끝까지 console capture (중간 `capture-logs` 금지)
  2. log 에서 `reindex --quick OK` / `freshness wait timed out` / `reindex --quick failed` 어느 메시지인지 확인
  3. 동시에 `bash ./scripts/reindex.sh --quick` 단독 실행 → exit code + stderr + 후속 `--check` timestamp 변화
  4. 후보 매치 → fix (race → debounce / PATH → execEnv 보강 / timestamp → quick metadata 갱신 / timeout → setting up)
- [ ] fix 적용 후 cycle smoke 재실행 → reindex 자동 OK + Notice 정상 발동 확증

### 5.2.6 페이지 내부 H2 섹션 의미 활용 (탐구)

- [ ] wikey 페이지의 표준 H2 섹션 (`## 출처`, `## 관련`, `## 분류` 등) 이 검색·답변에 의미적으로 활용되는지 확인
  - 현재: qmd 인덱스는 페이지 본문 전체를 통째로 임베딩 + BM25. H2 메타데이터 미사용.
  - 탐구: H2 섹션별 임베딩 + 답변 시 "출처 섹션" 우선 인용 같은 의미적 routing 가치 측정.
  - 결정 기준: §5.2.1~3 적용 후에도 정확도/풍부도 부족하면 진입.

### 5.2.7 (archived) Anthropic-style contextual chunk 재작성 — wikey 철학 위배

> **2026-04-25 archive 결정**: Phase 4 §4.5.1.5 v2 가 RAG chunk 패턴 자체를 schema §19·§21 배격 대상으로 결정·코드 제거 완료 (`source_chunk_id` 삭제, `splitIntoChunks` 삭제). chunk-level contextual retrieval 적용은 그 결정과 충돌. **본 항목 archive**, 재현율 추가 개선이 필요하면 페이지 단위 contextual prefix (Phase 2 Step 3-2 Gemma4 contextual prefix 로 이미 구현 — 페이지 임베딩 시 문서 맥락 prefix 주입) 강화 방향으로 재검토.

### 5.2.8 검증

- [ ] cycle smoke 재실행 (NanoVNA 1 파일 + PII-heavy 1 파일) — entity/concept cross-link + 답변 풍부도 + reindex 자동성 + citation 수 모두 측정
- [ ] 측정 항목 baseline (cycle smoke 2026-04-25): citation 2건 / 답변 184 chars / cross-link 0건 / reindex stale (silent fail)
- [ ] 목표: citation ≥ 5건 / 답변 ≥ 500 chars / cross-link ≥ 3건 (entity 당) / reindex auto fresh

---

## 5.3 인제스트 증분 업데이트 (P1)
> tag: #workflow, #engine
> **이전 번호**: `was §5.3` (번호 유지).

> **배경**. Phase 4 §4.2.2 URI 참조 + source-registry `hash` 필드가 구축된 위에서 hash diff 기반 증분 재인제스트 로직만 추가. Phase 4 §4.3.3 에서 이관. **Provenance 는 본체에 남아 §4.3.2 로 처리됨** (frontmatter data model 변경이라 구조 변경 없음 조건 위반).

### 5.3.1 hash 기반 증분 재인제스트

- [ ] `.wikey/source-registry.json` hash 필드로 소스 변경 감지 → 해당 wiki 페이지만 재생성
- [ ] 삭제된 소스 → 의존 wiki 페이지 자동 "근거 삭제됨" 표시 / 정리
- [ ] 부분 재인제스트 — section diff 기반 증분 (`section-index.ts parseSections` H2 단위 hash 매칭. Phase 4 §4.5.1.5 §5 의 chunk → section 전환에 정합)
- [ ] **wiki 재생성 없음 확증**: source-registry 스키마는 Phase 4 §4.2.2 에서 선결정. 본 항목은 로직만 추가, 기존 wiki 는 hash 변경된 소스만 재인제스트로 갱신.

---

## 5.4 표준 분해 규칙 self-extending 구조 (P2)
> tag: #framework, #engine, #architecture
> **이전 번호**: `was §5.6`. 2026-04-22 Phase 4 §4.5.1.7.2 PMBOK 하드코딩이 Stage 0 사전 검증에 해당.

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

- [ ] `SchemaOverride.standard_decompositions: StandardDecomposition[]` 필드 추가 (`schema-override.test.ts` 확장)
- [ ] `canonicalizer.ts` 에 `buildStandardDecompositionBlock(override)` 로더 함수 신규 — 현재 하드코딩된 작업 규칙 #7 블록을 동적 생성
- [ ] PMBOK 하드코딩 **제거**, default vault 템플릿 `.wikey/schema.yaml` 에 `PMBOK` entry 포함 (사용자 vault 가 override 안 해도 동작 유지)
- [ ] 단위 테스트: override 에 ISO-27001 entry 주입 → 프롬프트에 93 controls 블록이 동적으로 포함
- [ ] 트리거: 두 번째 표준 corpus (ISO/ITIL 등) 가 wiki 에 인제스트될 때

### 5.4.2 Stage 2 — extraction graph 기반 suggestion (Stage 1 완료 후, 중기)

- [ ] 전제: Stage 1 이 안정 동작. 수동 등록이 번거로운 수준으로 표준 수 누적 (≥5 개)
- [ ] canonicalizer 가 인제스트 결과의 mention graph 위에 패턴 탐지:
  - co-occurrence: 동일 소스에서 N 개 mention 이 같은 상위 concept (`*-management`, `*-control`, `*-principle`) 의 sibling 으로 등장
  - suffix clustering: `-management`, `-domain`, `-practice`, `-control`, `-principle` 등 suffix 빈도 + 같은 표준명 co-mention
  - confidence score: support count × suffix homogeneity × mention count 에서 임계 이상
- [ ] Audit UI 에 suggestion 카드 — "PMBOK 패턴 감지: 9 candidate components. 표준 분해로 등록하시겠습니까?" (accept/reject/edit)
- [ ] 승인 시 `.wikey/schema.yaml` append (`origin: 'suggested'`, `confidence: <score>`)
- [ ] 리스크: false positive — marketing 카피에 나열된 feature 리스트가 오인될 수 있음. 임계값 튜닝 + 사용자 승인 필수

### 5.4.3 Stage 3 — in-source self-declaration (장기, Stage 2 정확도 증명 후)

- [ ] 전제: Stage 2 suggestion 의 accept rate ≥ 80% — 즉 패턴 탐지가 신뢰할 수준
- [ ] 소스 본문이 "이 표준은 다음 N 영역을 갖습니다: A, B, C..." 같이 enumerate 하면 `section-index.ts` 가 "표준 개요" 섹션을 감지 → structured decomposition extraction
- [ ] runtime-scope decomposition: 해당 소스 인제스트 세션에만 적용, 세션 종료 시 자동 persist 제안 or 폐기
- [ ] 장점: 사용자·Stage 2 suggestion 개입 없이 문서 하나로 확장
- [ ] 리스크: 문서가 marketing 용이거나 부정확하면 오염 전파 — Phase 4 §4.3.2 provenance tracking 과 직접 연계 필수

### 5.4.4 Stage 4 — cross-source convergence (Phase 5 내 최후 단계, 실험적)

- [ ] 여러 소스가 같은 표준을 다른 각도에서 언급 → wiki 전체 mention graph 를 배치 분석해 canonical decomposition 을 inference
- [ ] 예: 소스 A 는 PMBOK 3 영역, 소스 B 는 다른 5 영역, 소스 C 는 umbrella 만 → union 으로 canonical decomposition 확증
- [ ] 구현 경로: qmd vector index + clustering + LLM arbitration. `reindex.sh` batch job 에 convergence pass 훅 추가
- [ ] 데이터 선결 조건: Stage 3 까지의 decomposition 인스턴스가 cross-validation 가능할 만큼 누적 (최소 3 개 표준 × 2 소스 이상). 선결 미충족 시 §5.4.4 는 대기 상태로 남고 Phase 5 종료 시 §5.4.1~3 까지만 closed
- [ ] **Phase 6 이관 없음** — Phase 6 은 웹 인터페이스 스코프. self-extension 모든 단계는 Phase 5 안에서 완결

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

### 5.8.3 W-C1 reindex --quick non-fatal exit=1 (Low)
> tag: #reindex
> **이전 번호**: `was §5.8.5`.

- [ ] 문제: 양 pass 에서 `runReindexAndWait` 가 `reindex --quick failed (non-fatal)` 12회 emit. stderr 비어있으나 exit=1.
- [ ] 해결 방향: `scripts/reindex.sh --quick` 내부 원인 조사 (qmd CLI 의 stale 상태 처리 exit code). stale 은 정상 경로라면 exit 0 이어야.
- [ ] 현재는 warn 로 다운그레이드 + `onFreshnessIssue` Notice 표시 → 사용자 UX 영향 없음. 원인 해소 후 가드 일관성 확보.

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
