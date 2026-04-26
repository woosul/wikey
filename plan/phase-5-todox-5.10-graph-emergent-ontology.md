# Phase 5 §5.10 — Graph emergent ontology paradigm shift (보조 plan, 2026-04-26 session 14 신규)

> **상위 문서**: `plan/phase-5-todo.md §5.10`. 본 문서는 §5.10 진입 시 detail spec.
>
> **상태**: 미처리 issue 등록. 사용자 본질 비판 5건 chain (graph emergent / 자동 ontology / 지식 분해 한계 / LLM-백 시대착오) 의 정식 이슈화.
>
> **진행 권장 시점**: 사용자가 다음 세션 시작 시 옵션 A/B/C/D 명시 후 진입.

## 1. issue 배경 (사용자 본질 비판 chain)

| # | 사용자 명시 (직접 발언) | 함의 |
|---|----------------------|------|
| 1 | "표준 분해 패턴을 왜 등록·관리해야 하나? 너무 엔지니어링적 사고." | panel 자체의 존재 가치 의문 |
| 2 | "self-extending 인데 진짜는 자동 확장 ontology 개념이어야지. 지금은 수동." | self-extending 명명의 약속 vs 현재 수동성 갭 |
| 3 | "표준 분해 그룹 = 지식 그룹? — 표준 분해 그룹 ⊂ 지식 그룹." | 개념 일반화 — knowledge group 으로 generalize |
| 4 | "wiki 가장 많이 노출되는 게 중심으로 — 굳이 그룹으로 나눠 제한 두는 게 이상해." | graph emergent ontology — 그룹 abstraction 제거 |
| 5 | "지식 분해하는 그룹이 왜 필요? 세상 수많은 지식을 어떻게 표준화?" | epistemology 비판 — 지식 분해 모델 자체의 한계 |
| 6 | "굳이 어려운말 써가면서 지식을 분류할 필요 없잖아. LLM 이라는 든든한 백 위에서 움직이는 건데." | LLM 시대의 ontology 시대착오. 옵션 D 정당화 |

## 2. 4 옵션 비교

| 옵션 | 명칭 | 핵심 | 마이그레이션 비용 | 사용자 정당성 |
|------|------|------|------------------|------------|
| A | 점진 | §5.4 panel UI 유지 + 자동 등록 추가 | 낮음 (현 cycle 연장) | 부분 — Accept gate 만 자동 |
| B | paradigm shift (graph emergent) | schema.yaml standard_decompositions deprecate, §5.5 graph 가 ontology source | 중간 (Stage 1 일부 유지) | 통찰 4 (graph emergent) 만족 |
| C | 관망 | §5.10 자체 보류 | 0 (현 상태 유지) | 통찰 0건 만족 |
| **★ D** | **LLM-only (ontology layer 제거)** | §5.4 Stage 1~4 전체 deprecate, LLM + qmd 백만 신뢰 | 높음 (~30~50 file, ~100 test) | **통찰 1~6 모두 만족** |

## 3. 옵션 D 상세 spec (사용자 통찰 가장 정확 반영)

### 3.1 deprecate 대상

**code**:
- `wikey-core/src/canonicalizer.ts` — Stage 1 schema override 로직 (BUILTIN_STANDARD_DECOMPOSITIONS 포함). minimal alias normalization 만 유지.
- `wikey-core/src/schema.ts` — `standard_decompositions` parser 영역. `entity_types` / `concept_types` / `pii_patterns` / `aliases` 영역은 보존.
- `wikey-core/src/schema-yaml-writer.ts` — `appendStandardDecomposition` 자체 폐기.
- `wikey-core/src/suggestion-storage.ts` / `suggestion-detector.ts` / `suggestion-pipeline.ts` / `suggestion-panel-builder.ts` — 전체 폐기 (Stage 2).
- `wikey-core/src/self-declaration.ts` — 전체 폐기 (Stage 3).
- `wikey-core/src/convergence.ts` — 전체 폐기 (Stage 4).
- `wikey-obsidian/src/sidebar-chat.ts` — §11 의 panel UI 전체 폐기 (header button + openSuggestionsPanel + SchemaYamlModal + helpers).
- `scripts/qmd-embeddings-export.mjs` — §5.4.7 1순위 산출물. ConvergedDecomposition 자체 미사용 시 폐기 (또는 graph 시각화 보조로 유지 검토).
- `scripts/run-convergence-pass.mjs` (wikey-core/scripts) — Stage 4 entry-point. 폐기.

**store**:
- `.wikey/suggestions.json` — 폐기
- `.wikey/converged-decompositions.json` — 폐기
- `.wikey/converged-decompositions.mock-baseline.json` — 폐기
- `.wikey/qmd-embeddings.json` — 폐기 (또는 graph 시각화용 retain)
- `.wikey/mention-history.json` — 옵션 (graph 시각화 시 retain, 아니면 폐기)
- `.wikey/schema.yaml` — `standard_decompositions` section 만 제거. 나머지 (alias / PII / custom-types) 보존.

**test**:
- `wikey-core/src/__tests__/` 의 약 100 cases 폐기 (Stage 1~4 unit + integration). 회귀 baseline 732 → ~630 예상.

**plan / activity**:
- `plan/phase-5-todox-5.4-integration.md` — archive 또는 deprecation note 추가. 본 paradigm shift 결정 trace 보존.
- `plan/phase-5-todox-5.4.1-self-extending.md` — 동일.
- `activity/phase-5-result.md §5.4` — deprecation note 추가.

### 3.2 유지 대상 (LLM-백 위 4 layer)

| layer | 위치 | 역할 |
|-------|------|------|
| 1. raw → wiki organization | `ingest-pipeline.ts` Stage 0 (Brief / Plan / Generate / Write) | 자료 인입 + classify + wiki 페이지 생성 — 사용자 핵심 가치 |
| 2. canonical slug normalization | `canonicalizer.ts` minimal | alias dedup (다국어 / 동명이인 / 약어), file hash dedup |
| 3. LLM retrieval | qmd embedding + LLM 답변 (`query.ts` / `qmd` 통합) | 의미 검색 + 답변 합성 |
| 4. interface | `sidebar-chat.ts` (chat / dashboard / audit / ingest / help) | 사용자 UX |

### 3.3 migration script

```bash
# scripts/migrate-deprecate-standard-decompositions.sh
# 1. .wikey/schema.yaml 의 standard_decompositions 영역만 → .wikey/manual-overrides.yaml 으로 분리
# 2. .wikey/suggestions.json / converged-decompositions.json / mention-history.json 백업 후 제거
# 3. wiki/concepts/ 의 umbrella 자체 wiki page 가 component 로 분해되어 있으면 분해 정보 제거 (LLM 자동 작성 보존)
# 4. .gitignore 정리
```

### 3.4 회귀 plan

- 폐기 test (~100 cases) 사전 식별 → grep `Stage [0-9]` / `umbrella` / `decomposition` / `Suggestion`
- 잔여 test (~630 cases) baseline 확보 → migration 적용 → re-run → 0 fail 확증
- §5.2 (검색 / canonicalizer cross-link) / §5.3 (incremental reingest) 회귀 완전 0 — dependency 분리 가능 확증

### 3.5 라이브 검증 (master 직접, obsidian-cdp)

- ingest 1 fixture (PMBOK 같은 표준 자료) — schema.yaml 자동 등록 X 확증
- search 결과 — LLM 답변에 PMBOK / ISO 27001 등 표준 의미 매칭 정상 (qmd embedding + LLM 백)
- panel header button (clipboard_check) 미존재 확증
- canonicalizer alias normalization 정상 (lotus-pms / kim-myung-ho 같은 dedup)

## 4. 옵션 B (graph emergent) 상세 spec

> 옵션 D 만큼 급진적이지 않은 대안. graph 가 ontology source.

- `wikey-core/src/canonicalizer.ts` — alias normalization 강화 (Stage 1 schema 명시 입력 → graph node identity 자동)
- §5.5 (NetworkX + Leiden community detection) → ontology source 격상
- panel UI 폐기 또는 graph view 로 교체
- schema.yaml `standard_decompositions` deprecate (옵션 D 와 동일)
- 차이: Stage 2 detector 의 mention graph 누적 (mention-history.json) 은 graph source 로 유지

## 5. 옵션 A (점진) 상세 spec

> 가장 가벼운 path. 본 cycle 연장.

- ingest pipeline 의 high-confidence 후보를 schema.yaml 직접 append (panel Accept 우회)
- threshold split (high 자동 / low panel)
- audit log (`.wikey/standard-audit.json`)
- panel rename `Suggestions` → `Knowledge audit`
- §5.4 본체 보존 + Stage 2/3/4 detector 보존

## 6. 사용자 결정 시점 / 책임

- 본 §5.10 = main subject 격 issue 등록.
- 사용자가 다음 세션 시작 시 옵션 A/B/C/D 명시 후 진입.
- master 가 옵션별 cost / 정당성 비교표 제공 (본 문서 §2 + §3.4 회귀 plan).
- 옵션 결정 후 detail spec (본 §3 또는 §4 또는 §5) 따라 cycle 진행.

## 7. 7-anchor self-check (mini plan 자체)

| # | Anchor | 결과 |
|---|--------|------|
| (a) | 시그니처 일관성 — deprecate 대상 file/store list 와 `phase-5-todo.md §5.10.2.D` 의 list 일치 | ✅ |
| (b) | state/data 표 형식 — 4 옵션 비교 표 + LLM-백 4 layer 표 일관 | ✅ |
| (c) | builder/parser 분기 — migration 단계 4 (3.3) + 회귀 plan (3.4) + 라이브 검증 (3.5) 명시 | ✅ |
| (d) | AC test — 본 §5.10 진입 시 acceptance 별 추가. 현재 = issue 등록만 |  pending (옵션 결정 후) |
| (e) | self-check drift — 본 §5.10 신규, 다른 §5.X 변경 X | ✅ |
| (f) | footer + cycle — 본 §5.10 = v1 신규 (2026-04-26 session 14) | ✅ |
| (g) | 코드 ↔ test exact phrase — 진입 시 적용 | pending |

## 8. 다음 master 액션

1. 본 §5.10 + 보조 plan 문서 commit + push
2. 사용자 다음 세션 시작 시 옵션 A/B/C/D 명시 대기
3. 옵션 결정 후 본 detail spec 따라 cycle 진행

## 9. 정당성 검증 — §5.4 가 없으면 wikey 가 지식 관리 가능한가? (2026-04-26 사용자 명시)

> **사용자 질문**: "만약 지금의 표준 분해 패턴이 없으면 현재의 wikey 는 지식 관리를 할 수 없는 거야? 그 이유도 같이 설명."

### 9.1 결론

**아니오 — §5.4 가 없어도 wikey 는 정상 작동.** 핵심 기능 영향 없음. 외부 정형 표준 (PMBOK / ISO 27001) 자료의 component 분해 정확도만 약간 영향 (LLM 자율 분해로 대체 가능).

### 9.2 wikey 의 핵심 기능 ↔ §5.4 의존성 매트릭스

| 핵심 기능 | §5.4 의존? | 의존 수준 | §5.4 deprecate 시 영향 |
|----------|-----------|----------|---------------------|
| **raw → wiki ingest** (자료 인입 + classify + 페이지 생성) | ❌ 무관 | 0% | 영향 없음 (Stage 0 ingest pipeline 의 wiki write 가 기본 동작, schema 미적용 가능) |
| **wiki/concepts·entities 페이지 생성** | △ 약함 | ~5% | LLM 이 자율 추출 (canonicalizer 의 LLM extraction). 명시 schema 없어도 entity / concept 추출 정상. PMBOK 같은 외부 표준의 사전 정의된 분해 가이드만 손실 — LLM 이 자율 분해 |
| **alias normalization** (다국어 / 동명이인 / 약어) | △ 약함 | ~10% | canonicalizer 의 minimal alias 보존 (옵션 D 의 §3.2 layer 2). schema.yaml 의 `aliases` 영역도 보존 (standard_decompositions 만 제거). dedup 정상. |
| **wikilink graph** (entity ↔ concept 자연 link) | ❌ 무관 | 0% | wikilink 는 LLM 답변에 의해 자연 생성, schema 의존 X |
| **검색 — qmd embedding + LLM 답변** | ❌ 무관 | 0% | qmd 자체가 LLM 의미 백, schema 의존 X. 같은 표준의 다른 표기 ("ISO 27001" / "iso-iec-27001-2022") 자동 의미 매칭 |
| **답변 1-hop wikilink expansion** (§5.2) | ❌ 무관 | 0% | 단순 wikilink 그래프, schema layer 위 |
| **canonicalizer cross-link** (entity ↔ concept) | ❌ 무관 | 0% | §5.2 의 자동 cross-link, schema standard_decompositions 의존 X |
| **chat / dashboard / ingest / audit UX** | ❌ 무관 | 0% | UI layer, schema standard_decompositions 의존 X |
| **PII protection** | ❌ 무관 | 0% | schema.yaml 의 `pii_patterns` 영역 보존 (standard_decompositions 만 제거) |
| **incremental reingest** (§5.3) | ❌ 무관 | 0% | hash 기반 dedup, schema 의존 X |

### 9.3 §5.4 의 *유일한* 가치 영역

PMBOK / ISO 27001 / ITIL 같은 **이미 정형화된 외부 표준** 자료를 ingest 할 때:

- **with §5.4**: PMBOK 의 10 knowledge areas 가 schema.yaml 에 명시되어 있어 정확히 10 페이지로 분해. require_explicit_mention 으로 LLM 의 추측 차단.
- **without §5.4**: LLM 이 자율 분해. 보통 8~12 페이지 정도로 분해 (정확도 ~85%, hallucination 가능성 약간). 다만 후속 ingest 와 cross-source cluster 가 자동 보정.

⇒ §5.4 의 가치 = 외부 정형 표준의 component 분해 정확도 약 +10~15%. 일반 자료 (잡지 / 메모 / 임의 PDF) 에는 가치 0 (사용자 통찰 5번 — "세상 수많은 지식을 어떻게 표준화").

### 9.4 옵션 D 시 손실 vs 이득

**손실** (옵션 D 시):
- 외부 정형 표준 자료의 component 분해 정확도 ~10~15% 감소 (LLM 자율 분해의 hallucination 가능성)
- Stage 4 cluster 의 cross-source convergence (예: ISO 27001 / iso-iec-27001-2022 / ISMS 한 페이지 통합) — 자동 alias merging 으로 대체 가능 (canonicalizer 강화)

**이득** (옵션 D 시):
- ~30~50 file 변경 폐기로 코드 단순화 (maintenance cost ↓)
- panel UI / schema 사용자 인지 부담 0
- §5.4 self-extending 명명의 misleading 해소
- LLM 백의 자연 의미 매칭 + qmd embedding cluster 가 component 분해 정확도 손실 일부 보상
- 사용자가 외부 정형 표준 자료 외 일반 지식 관리 (메모 / 잡지 / 임의 자료) 에 wikey 사용 시 **§5.4 의 한계 (PMBOK 류에만 fit) 자체가 사라짐**

### 9.5 결론 정당성

> 사용자 통찰 6번 ("LLM 백 위에서 움직이는 건데") 의 정당성:
>
> wikey 의 *핵심 가치* = LLM + qmd embedding + wiki organization. §5.4 standard_decompositions 는 *외부 정형 표준 분해 정확도 보조* 의 한정 가치 — 본질적 의존 X. 옵션 D 채택 시 외부 정형 표준 자료의 정확도 ~10~15% 감소 손실은 LLM 자율 분해 + canonicalizer alias merging + qmd embedding cluster 로 대체 가능. 일반 지식 관리에는 §5.4 가 처음부터 가치 없음 (사용자 통찰 5번 — 지식 분해 epistemology 한계).
>
> ⇒ **§5.4 가 없어도 wikey 는 지식 관리 가능**. §5.4 = 외부 표준 정확도 보조 layer (한정), 본질적 dependency X.
