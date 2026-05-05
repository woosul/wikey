# Step 8 — Self-extending + 자율 증분 분석 ⚠️ **D-wide 폐기 (2026-05-05, §5.10.4)** — historical reference

> **상태**: §5.10 paradigm shift 옵션 D-wide 채택 완료 (2026-05-05 §5.10.4 cycle). Step 8 (Stage 1~4 self-extending) 전체 deprecated. 본 문서는 *historical decision-input* 으로만 보존 — 결정 근거 trace.
>
> **본 문서의 원래 위치**: `docs/wikey-ingest-pipeline.md §9` (Step 8) 의 *기능 분석 + 폐기 가능성* 단독 검토. §5.10 paradigm shift issue 의 사용자 결정 (옵션 A~D) 입력 자료.
>
> 결론 요약 (당시 분석): Step 8 은 **외부 정형 표준 (PMBOK / ISO 27001 / ITIL) ingest 시 component 분해 정확도 보조** 라는 좁은 가치만 제공한다. wikey 의 *본질 6 기능* (raw → wiki 분해 / 누적 / 멱등 갱신 / 검색 / 답변 합성 / 그래프) 은 모두 Step 1~7 + Step Q 에 위치하므로 **Step 8 전체 폐기 후에도 wikey 는 100% 작동한다**. 회귀 테스트 영향: 732 PASS → ~604 (실측 폐기 후, ~110 cases 폐기/skip — §5.4 전용 + schema-yaml-writer).
>
> **D-wide 채택 후 실측**: 본 문서의 모든 가설 (Stage 1~4 폐기 안전, 본질 6 기능 영향 0) 이 §5.10.4 라이브 cycle smoke 로 확증됨. PMBOK 10 knowledge areas 가 schema 명시 없이도 LLM 자율로 정확히 10/10 분해 (activity/phase-5-resultx-5.10.4-d-wide-cycle-2026-05-05.md §6.2 L.1 evidence).

---

## 1. 현재 프로젝트에서의 역할

### 1.1 정의

§5.4 self-extending = "raw 자료에서 mention 된 표준 (PMBOK 등) 의 분해 구조를 자동 탐지하고, 사용자 승인 후 `.wikey/schema.yaml` 의 `standard_decompositions:` 에 영구 등재" — 이 등재된 분해 정의가 다음 ingest 의 canonicalizer prompt 에 주입되어 분류 안정성을 높이는 *결정성 booster*.

### 1.2 4 Stage 매트릭스

| Stage | 목적 | 트리거 | LLM 개입 | 산출 |
|-------|------|--------|---------|------|
| Stage 1 | 명시적 정의 (BUILTIN PMBOK + 사용자 yaml) | 사용자 편집 | X | `standard_decompositions:` 정적 entry |
| Stage 2 | mention graph 자동 후보 (co-occurrence + suffix cluster) | 매 ingest 후 | X (deterministic detector + confidence ≥ 0.6) | `.wikey/suggestions.json` (state=pending) |
| Stage 3 | in-source self-declaration (소스 본문 "표준 개요" 자동 추출) | section-index 의 `standard-overview` 매칭 | X (numbered/bullet ≥ 5 패턴) | runtime SelfDeclaration (persist X — 휘발) |
| Stage 4 | cross-source convergence (qmd embedding cluster) | `run-convergence-pass.mjs` 수동 batch | 선택 (`'union'` 0콜 / `'llm'` arbitration) | `.wikey/converged-decompositions.json` |

### 1.3 사용자 접점 — Suggestions panel

사이드바 header icon `clipboard_check`. audit 그리드 + Accept / Reject / Add / Edit 멀티-row UX. "schema.yaml 확인 →" link → modal popup (도메인 tag cloud + 도움말 + 구성요소 list, raw YAML 미노출).

### 1.4 본질 분류 (사용자 영구 결정 — `feedback_pii_no_hardcoding.md` 와 같은 결)

> "이 panel 은 일반 사용자가 거의 안 써도 됨 — 자동 탐지 결과 검토용." (CLAUDE.md §사이드바 패널 6종)

→ panel 의 *기본값 가시성* 자체가 "보조 도구" 신호. 본질 기능이라면 `Ingest` / `Audit` 처럼 ingest 워크플로우의 mandatory step 이었을 것.

---

## 2. 초기 생성과 유사 지식 확장의 긍정 측면

### 2.1 초기 생성 — BUILTIN 사전 분해

`schema.ts::BUILTIN_STANDARD_DECOMPOSITIONS` 가 PMBOK 10 영역 (`integration-management` / `scope-management` / ... / `stakeholder-management`) 를 코드 상수로 박아 둠. 새 vault 에서 PMBOK 자료 첫 ingest 시 LLM 이 "프로젝트 통합 관리" 같은 한국어 mention 을 영문 canonical slug 로 매핑하는 데 직접적 hint 를 받음.

**긍정 효과**:
- PMBOK 같은 *고정된 외부 표준* 은 component 가 사실상 불변 → BUILTIN 정의의 ROI 가 명확.
- 한국어 ↔ 영문 alias 가 prompt 에 박혀 transliteration drift (`alimtalk` ↔ `allimtok`) 자동 통합.
- `FORCED_CATEGORIES` 와 결합하여 30-run 측정 CV <15% 보장.

### 2.2 유사 지식 확장 — Stage 2 detector

`detectCoOccurrence` + `detectSuffixCluster` 가 ingest 누적 mention 에서 *반복 패턴* 을 자동 발견.

**긍정 효과**:
- 사용자 직접 yaml 편집 부담 0 (자동 후보 → Suggestions panel 검토만).
- LLM 비용 0 (pure deterministic).
- confidence 0.6 cutoff 로 noise 차단.

**관측된 실 사례** (활동 기록 §5.4):
- COBIT 5 도메인 (evaluate-direct ↔ monitor-evaluate cosine 0.91) Stage 4 cluster 자동 형성.
- ITIL 4 / ISO 27001 같은 multi-source 표준 자료 ingest 시 cross-source convergence 가 정형 분해 보조.

### 2.3 모듈 구성 — 개선점

| 모듈 | 현재 한계 | 개선점 (옵션 A 점진 채택 시) |
|------|----------|----------------------------|
| `suggestion-detector.ts` | suffix whitelist 6개 (`-management`, `-control`, ...) 하드코딩 | YAML 외부화 + 도메인별 학습 |
| `suggestion-pipeline.ts` | confidence cutoff 0.6 alpha 고정 | baseline calibration (plan §3.2.2 line 359) |
| `convergence.ts` | embeddings JSON 외부 export 의존 (`scripts/qmd-embeddings-export.mjs`) | qmd MCP server 직접 query (v2 deferral) |
| `self-declaration.ts` | runtime persist X (휘발) | persistChoice 상태 전이 panel 확장 |
| `suggestion-panel-builder.ts` | 한 vault 단일 SuggestionStore | multi-domain partition |
| `schema-yaml-writer.ts` | umbrella + components flat list | hierarchical (umbrella → sub-umbrella) |

### 2.4 정량 지표

- **현재 회귀 테스트**: 732 PASS (전체) 중 §5.4 직접 관련 ~100 test (`__tests__/suggestion-*.test.ts`, `convergence.test.ts`, `self-declaration.test.ts`).
- **§5.4 코드량**: ~1,800 줄 (suggestion-* + convergence.ts + self-declaration.ts + suggestion-panel-builder.ts + schema-yaml-writer.ts).
- **runtime 비용**: ingest 당 detector ≤ 50ms (deterministic). Stage 4 batch 는 수동 trigger.
- **사용자 학습 부담**: Suggestions panel UX + schema.yaml 구조 + standard_decompositions 의미 — non-trivial.

---

## 3. 폐기 가능성 — 사용자 본질 비판 6 chain

§5.10 issue 등록 시 사용자 명시 비판 (2026-04-26 session 14 직후).

### 3.1 비판 6 chain

| # | 비판 | 함의 |
|---|------|------|
| 1 | "panel 가치가 낮다" | 일반 사용자가 거의 안 씀 — 사용자 자신이 영구 명시 |
| 2 | "self-extending 명명이 과장" | 실제로는 chain break 에 의한 *반자동* (Accept 수동 필수) |
| 3 | "지식 그룹 ⊂ 가정이 reductionist" | 외부 정형 표준에만 fit, 일반 지식은 mismatch |
| 4 | "graph emergent ontology 가 옳다" | 미리 정의된 분해보다 wikilink 그래프가 자연스럽게 형성되는 ontology 가 본질에 더 가깝다 |
| 5 | "지식 분해 epistemology 가 pre-LLM" | 인간이 도메인을 *명시 분류해야 검색이 가능* 하던 시대 가정 |
| 6 | "LLM 백 시대착오" | LLM 이 의미 처리를 직접 한다 — 분해 layer 는 인위 |

### 3.2 옵션 매트릭스 (사용자 다음 세션 결정)

| 옵션 | 행동 | 회귀 영향 | 파일 변화 |
|------|------|----------|-----------|
| A 점진 | confidence threshold 튜닝 + suffix whitelist YAML 외부화 | +0 test | minor edit |
| B graph emergent | wikilink 그래프 community detection 으로 분해 자동 추출 | -50 / +30 test | mid refactor |
| C 관망 | 그대로 두고 다른 Phase 진입 | 0 변화 | 0 |
| **★ D LLM-only** | **Stage 1~4 전체 deprecate, schema.yaml standard_decompositions 키 폐기** | **-100 test → 632 PASS 예상** | -1,800 LOC |

옵션 D 가 사용자 통찰 가장 정확 반영 (보조 plan `phase-5-todox-5.10-graph-emergent-ontology.md` 의 권장).

### 3.3 폐기 가능 근거

#### (a) qmd embedding 이 의미 layer 자동 처리

Step Q 의 vec query (Qwen3-Embedding 1024-dim) 가 BM25 와 함께 RRF 융합 → "evaluate-direct ↔ monitor-evaluate cosine 0.91" 같은 의미 강결합을 *런타임에* 잡아낸다. schema.yaml standard_decompositions 가 사전에 박아둘 필요 없음.

#### (b) LLM 합성 (Step Q-4) 이 분해 보강

`buildSynthesisPrompt` 가 "검색된 페이지 본문에 [[wikilink]] 가 있으면 1-hop target 도 활용" 명시 → wikilink 그래프가 자연스럽게 분해 구조 역할. Step 8 의 standard_decompositions 가 *prompt 에 박지 않아도* 같은 효과.

#### (c) wikilink 그래프 = emergent ontology

`applyCrossLinks` (canonicalizer.ts:528) 가 ingest cycle 마다 entity ↔ concept `## 관련` H2 자동 생성. Obsidian 그래프 뷰에서 사용자가 시각적 cluster 를 직접 본다 — 이게 "explicit 한 ontology" 의 LLM-시대적 표현.

#### (d) BUILTIN PMBOK 의 ROI 한계

PMBOK 같은 1 표준만 hardcoded → 다른 표준 (ISO / ITIL / GDPR) 추가하려면 사용자가 yaml 편집해야 함 → 결국 *수동 작업* 으로 회귀. self-extending 의 약속이 실제로 깨짐.

---

## 4. Step 8 없이도 wikey 가 존속하는 이유

### 4.1 wikey 의 본질 6 기능 매핑

| 본질 기능 | 정의 | 위치 (Step) | Step 8 의존? |
|-----------|------|-------------|------------|
| **F1 분해 ingest** | raw 1 → wiki N (5~15) | Step 5 (mention) + Step 6 (canonicalize) | **X** |
| **F2 누적 (compounding)** | 매 ingest 마다 wiki/ 갱신, 매 query 가 누적 자산 활용 | Step 7 (createPage idempotent + provenance dedup) | X |
| **F3 멱등 갱신** | 같은 source 재 ingest → 같은 결과 (deterministic mode) | Step 4 (decideReingest) + Step 7 (createPage overwrite) | X |
| **F4 검색** | 한국어 + 영문 + 의미 검색 (BM25 + vec + RRF) | Step Q-2 (qmd) | X |
| **F5 답변 합성** | LLM 양끝 참여 (cross-lingual + 1-hop expansion + synthesis) | Step Q-1, Q-3, Q-4 | X |
| **F6 그래프** | wikilink + Obsidian 그래프 뷰 + emergent ontology | Step 6 (`applyCrossLinks`) + Step Q (1-hop expansion) | X |

→ **6/6 기능 모두 Step 8 무관**. Step 8 은 *F1 의 분해 정확도 boost* 일 뿐.

### 4.2 schema 매핑 — llm-wiki.md 와의 정합

llm-wiki.md 의 핵심 명제 (§The core idea):
> "Instead of just retrieving from raw documents at query time, the LLM **incrementally builds and maintains a persistent wiki**"

→ Step 5/6/7 의 ingest 흐름.

> "the wiki keeps getting richer with every source you add"

→ Step 7 의 멱등 createPage + provenance dedup. Step 8 미언급.

> "good answers can be filed back into the wiki as new pages"

→ Step Q 의 사용자 명시 저장. Step 8 미언급.

llm-wiki.md 어디에도 *standard decomposition self-extending* 같은 layer 가 없다. Step 8 은 wikey 만의 *추가 가설*. 이 가설을 거두면 llm-wiki.md 원형에 가까워진다.

### 4.3 wikey.schema.md 와의 정합

wikey.schema.md "핵심 원칙" 5 가지:
1. 원시 소스는 불변이다 → Step 1~4
2. 위키는 LLM 이 소유한다 → Step 5~7
3. 탐색은 축적된다 → Step Q + 사용자 저장
4. 인덱스를 항상 최신으로 → Step 7 (`updateIndex`)
5. 로그는 추가만 → Step 7 (`appendLog`)

→ **5/5 핵심 원칙 모두 Step 1~7 + Step Q 에 위치, Step 8 미언급**.

§표준 분해 self-extending 구조 § 는 *현재 구현 상태의 사실 기록* 이며 옵션 D 채택 시 deprecate 예정 (schema.md 본문에 명시).

### 4.4 회귀 영향 시뮬레이션

옵션 D 채택 후 wikey 동작:

| 시나리오 | Step 8 있음 | Step 8 없음 (옵션 D) |
|---------|-------------|---------------------|
| 새 raw 추가 → ingest | 정상 + Stage 2 자동 후보 등록 | 정상 (Stage 2 후보 0) |
| PMBOK PDF ingest | BUILTIN hint 로 한국어 ↔ 영문 매칭 | LLM 이 맥락 + qmd alias map (`canonicalizer.ts::SLUG_ALIASES`) 으로 매칭 |
| 같은 표준 다른 자료 추가 | Stage 4 cross-source cluster 후보 | 정상 (사용자가 wikilink 로 cluster 형성) |
| 한국어 질문 | Step Q-1 cross-lingual + qmd vec | 동일 |
| 1-hop wikilink expansion | 동일 | 동일 |
| Obsidian 그래프 뷰 | 동일 | 동일 |

→ 단 1 시나리오 (PMBOK 한국어 ↔ 영문 매칭 정확도) 만 미세 저하. SLUG_ALIASES 보완으로 충분 cover.

### 4.5 정성 비교

| 측면 | Step 8 있음 | Step 8 없음 |
|------|-------------|-------------|
| 외부 정형 표준 분해 정확도 | A+ (BUILTIN + 자동 후보) | A (LLM + qmd embedding) |
| 일반 지식 처리 | A (분해 가정 mismatch 있어도 무해) | A+ (graph emergent 자연 fit) |
| 사용자 학습 부담 | B (Suggestions panel + schema.yaml) | A+ (워크플로우 단순화) |
| 코드 복잡도 | -1,800 LOC | -100 test |
| llm-wiki.md 정합 | B (추가 가설 layer) | A+ (원형) |
| wikey.schema.md 핵심 원칙 정합 | A | A |

→ **순 가치 평가**: Step 8 없음이 사용자 통찰 (§5.10 6 chain) 과 가장 정합. 외부 정형 표준 분해의 미세 정확도 손실은 SLUG_ALIASES + qmd embedding + LLM 합성으로 충분 보완.

---

## 5. 폐기 시 마이그레이션 경로

### 5.1 코드 삭제 범위

| 삭제 대상 | 라인 수 | 의존 |
|-----------|---------|------|
| `wikey-core/src/suggestion-detector.ts` | 209 | — |
| `wikey-core/src/suggestion-pipeline.ts` | 134 | suggestion-detector |
| `wikey-core/src/suggestion-storage.ts` | ~150 | — |
| `wikey-core/src/suggestion-panel-builder.ts` | ~200 | suggestion-storage |
| `wikey-core/src/convergence.ts` | 434 | self-declaration |
| `wikey-core/src/self-declaration.ts` | 240 | section-index |
| `wikey-core/src/schema-yaml-writer.ts` | 117 | suggestion-storage |
| `wikey-core/src/schema.ts` 의 `BUILTIN_STANDARD_DECOMPOSITIONS` + 관련 builder | ~150 | — |
| `scripts/qmd-embeddings-export.mjs` + `scripts/run-convergence-pass.mjs` | ~300 | — |
| `__tests__/suggestion-*.test.ts`, `convergence.test.ts`, `self-declaration.test.ts` | ~100 test | — |
| `wikey-obsidian/src/sidebar-chat.ts::buildSuggestionsPane` | ~400 | — |
| `wikey.schema.md §표준 분해 self-extending 구조` 섹션 | ~40 | — |

### 5.2 보존 대상 (Step 8 폐기해도 유지)

- `canonicalizer.ts::SLUG_ALIASES` — 30-run 측정 표기 변동 정규화. 본질 결정성.
- `canonicalizer.ts::FORCED_CATEGORIES` — entity↔concept 강제 pin. 본질 결정성.
- `section-index.ts` (전체) — Route 판정 + peer context (Stage 3 의 standard-overview 매칭은 사라지지만 sectional parsing 자체는 Step 5 가 사용).
- `wikey-core/src/types.ts::SchemaOverride` — `entityTypes` / `conceptTypes` 부분만 keep, `standardDecompositions` field 삭제.

### 5.3 사용자 영향

- **vault 마이그레이션**: `.wikey/schema.yaml` 의 `standard_decompositions:` 키 자동 무시 (warning + 무동작). `entity_types:` / `concept_types:` 확장은 그대로 작동.
- **기존 ingest 결과**: 무영향. wiki/sources/ entities/ concepts/ 모두 그대로.
- **UI 변화**: Suggestions panel 사이드바에서 사라짐.
- **재 ingest**: 같은 결과 보장 (deterministic mode 유효, Stage 1 BUILTIN 제거로 매우 미세한 boundary case 변화 가능 — codex 같은 도구로 회귀 비교 권장).

### 5.4 단계별 실행 (옵션 D 채택 시)

1. `WIKEY_SELF_EXTENDING=off` 환경변수 도입 (반응형 비활성화 — 마이그레이션 안전망).
2. Suggestions panel UI 부터 hide.
3. ingest-pipeline.ts 의 `runSuggestionFinalize` / runtime SelfDeclaration 호출 제거.
4. `convergence.ts` + 관련 script 삭제.
5. schema.yaml writer / detector / storage 삭제.
6. 회귀 테스트 -100 정리 (-`__tests__/suggestion-*` 등).
7. wikey.schema.md / docs / plan 동기화.

---

## 6. 결론

### 6.1 한 눈 요약

> Step 8 은 **외부 정형 표준 (PMBOK / ISO 27001 / ITIL) 분해 정확도 보조** 라는 좁은 가치만 제공한다. wikey 의 본질 6 기능 (분해 ingest / 누적 / 멱등 / 검색 / 합성 / 그래프) 은 모두 Step 1~7 + Step Q 에 위치하며 Step 8 무관. 사용자 §5.10 본질 비판 6 chain (panel 가치 / self-extending 명명 / reductionism / graph emergent / pre-LLM epistemology / LLM 백 시대착오) 이 옵션 D (deprecate) 의 정당성을 모두 입증한다. 폐기 시 -1,800 LOC + -100 test, 회귀 영향 미세 (한국어 ↔ 영문 매칭 정확도 SLUG_ALIASES 로 보완 가능). llm-wiki.md 원형에 더 가까워진다.

### 6.2 권장 행동

- **다음 세션 첫 액션**: 사용자가 §5.10 옵션 (A / B / C / **★ D**) 명시 결정.
- **D 선택 시**: §5 마이그레이션 단계 따라 Phase 5 후속 cycle 으로 진행.
- **C 선택 시**: 본 문서를 다음 reconsider 시점의 자료로 보존.
- **A/B 선택 시**: §2.3 모듈 개선점 표 기반 plan/phase-5-todox-5.4-* 갱신.

### 6.3 관련 문서

- [`wikey.schema.md §표준 분해 self-extending 구조`](../wikey.schema.md) — 현재 상태 사실 기록
- [`docs/wikey-ingest-pipeline.md §9`](./wikey-ingest-pipeline.md) — Step 8 운영 위치
- [`plan/phase-5-todox-5.4-integration.md`](../plan/phase-5-todox-5.4-integration.md) — 4 Stage 통합 plan (v10 codex APPROVE)
- [`plan/phase-5-todox-5.10-graph-emergent-ontology.md`](../plan/phase-5-todox-5.10-graph-emergent-ontology.md) — paradigm shift 보조 plan
- [`activity/phase-5-result.md §5.4 / §5.10`](../activity/phase-5-result.md) — 진행 timeline + issue 등록 trace
- [`llm-wiki.md`](../llm-wiki.md) — Karpathy 원문 (Step 8 같은 layer 미언급, *원형 정합 근거*)
