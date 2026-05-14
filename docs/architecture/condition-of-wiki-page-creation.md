# Wiki 페이지 생성·보강 조건 분석 — 빈 페이지 문제

> **본 문서의 위치**: `docs/architecture/wikey-ingest-pipeline.md §6, §7, §8` (Step 6 canonicalize, Step 7 page write) 의 *생성·보강 조건* 단독 검토. 사용자 관측 ("많은 wiki 페이지가 내용없이 제목만 있는 경우들이 존재") 의 근본 원인 진단 + llm-wiki.md 정책과의 충돌 분석 + 개선 방향 제안.
>
> 결론 요약: 현재 wikey 는 **빈 페이지 (description 1~2 문장 + 출처 1개)** 를 *의도적으로* 생성하고 있으며 (canonicalizer prompt 의 명시 제약), **재 ingest 시 enrich 가 거의 일어나지 않는다** (overwrite 패턴 + sources 누적 미흡). 이는 llm-wiki.md 의 *"the wiki keeps getting richer with every source you add"* 핵심 명제와 정면 충돌한다. 측정: wiki/{entities, concepts} 92 페이지 중 **55 페이지 (60%)** 가 25 줄 이하 — 본문 1~3 줄 + frontmatter + 출처.

---

## 1. 현황 — 정량 측정

### 1.1 페이지 라인 분포 (2026-04-28 master 기준)

| 범위 | 페이지 수 | 비율 | 의미 |
|------|-----------|------|------|
| ≤ 20 줄 | ~30 | ~33% | 본문 1 문장 (description only) |
| 21–25 줄 | ~25 | ~27% | 본문 1 문장 + ## 관련 H2 |
| 26–50 줄 | ~25 | ~27% | 본문 1 문장 + ## 관련 + 다중 출처 |
| 50+ 줄 | ~12 | ~13% | 본문 보강된 정상 페이지 (대부분 source 페이지) |
| **합계** | **92** | **100%** | — |

> 측정 명령: `find wiki/{entities,concepts} -name "*.md" -exec wc -l {} \; | awk '$1 <= 25' | wc -l` → 55. 즉 **60% 가 사실상 stub 페이지**.

### 1.2 실제 stub 페이지 샘플 — `wiki/concepts/encryption.md`

```markdown
---
title: encryption
type: concept
concept_type: methodology
created: 2026-04-26
updated: 2026-04-26
sources: [iso-27001-overview.md]
tags: []
provenance:
  - type: extracted
    ref: sources/sha256:b06dc860b4952f01
---

# encryption

정보를 보호하기 위해 데이터를 특정 알고리즘을 사용하여 변환하여 인가되지 않은 접근을 방지하는 기법.

## 관련

- [[dlp]]

## 출처

- [[iso-27001-overview.md|iso-27001-overview]]
```

→ description 1 문장 + 관련 1 wikilink + 출처 1 개. *encryption* 은 보안 도메인 전체에서 가장 근본적 개념인데도 본문은 사전 정의 1 줄.

### 1.3 source 페이지와의 비대칭

| 카테고리 | 평균 라인 | 본문 |
|----------|-----------|------|
| `wiki/sources/` | 100~174 | section TOC + 핵심 시사점 + summary + 분류표 |
| `wiki/entities/` | 18~25 | description 1 문장 |
| `wiki/concepts/` | 18~25 | description 1 문장 |

→ source 페이지는 LLM 이 *summary prompt* 의 답을 통째 받아 풍부. 그 source 가 mention 한 entity/concept 페이지는 *canonicalizer prompt 의 description 1~2 문장 cap* 으로 stub.

---

## 2. 최초 생성 조건 — 코드 추적

### 2.1 생성 결정 — Step 6 canonicalizer

`wikey-core/src/canonicalizer.ts::buildCanonicalizerPrompt` line 251~289 의 작업 규칙 6:

```
6. **description**: 1~2문장, 산업 표준 정의 위주 (기능 설명 X).
```

→ **빈 페이지의 직접적 근본 원인**. LLM 에게 "description 을 1~2 문장으로 짧게" 지시하고 있음.

### 2.2 페이지 본문 빌드 — `buildPageContent`

`canonicalizer.ts:472~518`:

```ts
function buildPageContent(args: {
  name: string; type: string; description: string;
  category: 'entity' | 'concept'; sourceFilename: string; today: string;
  relatedLinks?: readonly string[];
}): string {
  ...
  return `---
title: ${name}
type: ${category}
${typeField}
created: ${today}
updated: ${today}
sources: [${sourceFilename}]
tags: []
---

# ${name}

${description}        // ← 여기에 1~2 문장만 들어감

${relatedSection}## 출처

- [[${sidecarRef}|${sourceDisplay}]]
`
}
```

→ 페이지 본문 = `# 제목` + `${description}` + (선택) `## 관련` + `## 출처` 4 블록 고정. **페이지 본문에 source 의 *상세 내용* 을 inline 으로 포함하는 경로가 코드 상 존재하지 않음**.

### 2.3 mention 추출 시점 — Step 5

`ingest-pipeline.ts::extractMentions` (line 886~) 의 prompt (`BUNDLED_STAGE2_MENTION_PROMPT` line 909~):

```
각 mention은 다음 정보를 가집니다:
- name: 정규화된 base name
- type_hint: 자유 string (LLM 자율; 예 organization/person/methodology/algorithm/dataset/event 등; §5.10.4 D-wide 후 7-type union 폐기)
- evidence: 1문장 (어디 등장했는지, 200자 이내)
```

→ mention 단계에서 LLM 이 보는 것은 *base name + type_hint + 1 문장 evidence* 만. 페이지 본문이 될 *상세 본문* 은 추출하지 않음.

### 2.4 전체 흐름 — 생성 시점 본문 결정 사슬

```
raw source (수십 KB)
  │
  ▼ Step 5 mention LLM
mention { name, type_hint, evidence(200자 1문장) }    ← evidence 는 추출되지만 페이지 저장 X
  │
  ▼ Step 6 canonicalizer LLM
{ name, type, description(1~2문장), aliases }         ← evidence 가 description 으로 *재생성* (요약 손실)
  │
  ▼ Step 7 buildPageContent
wiki/concepts/<name>.md                              ← description 1 문장 + 관련 + 출처
```

**평균적으로 raw 의 1,000 자 → mention evidence 200 자 → canonicalizer description 100 자 → 페이지 본문 100 자**. 정보 손실률 90%.

### 2.5 생성 *조건* 최소 표

| 조건 | 값 |
|------|-----|
| mention 통과 | name + type_hint (자유 string, LLM 자율; §5.10.4 D-wide 후 7-type union 폐기) |
| canonicalizer 분류 통과 | LLM 자율 type 분류 + slug ≥ 1 char (§5.10.4 D-wide 후 schema gate / anti-pattern / FORCED_CATEGORIES 모두 폐기) |
| dropped 회피 | acronym dedup + minimal alias normalization (SLUG_ALIASES + .wikey/schema.yaml `aliases:`) 후 잔존 |
| 페이지 write | `createPage` 멱등 — exists 면 overwrite |
| 본문 길이 | description 1~2 문장 (LLM 자율 — 일반적으로 50~150 자) |
| frontmatter | sources: [현재 source 1 개] (배열 누적 X — §3.2 참조) |
| ## 관련 | 같은 ingest cycle 의 entity ↔ concept cross-link만 |
| ## 출처 | 현재 source 1 개 ([[<sidecar>|<basename>]] 형식) |

### 2.6 의도된 설계 — schema.md 의 합리화

> wikey.schema.md "인제스트 분할 전략":
> "raw 소스 1개는 wiki 페이지 여러 개(통상 5~15개)로 분해된다. ... 작은 페이지가 Top-K 정확도 높음"

→ "작은 페이지" 가 의도적이긴 하지만, "1 문장 stub" 까지의 극단성은 **검색 효율 vs 콘텐츠 가치** 균형이 깨진 결과. llm-wiki.md 의 "compounding" 원칙과의 충돌은 §3 에서.

---

## 3. llm-wiki.md 정책과의 충돌 분석

### 3.1 핵심 명제 ↔ 현재 구현 차이

#### (a) "richer with every source you add"

llm-wiki.md §The core idea:
> "the wiki keeps getting **richer** with every source you add and every question you ask."

**기대 동작**: source A 가 `encryption` 을 mention → `wiki/concepts/encryption.md` 생성 (1 문장). source B 가 `encryption` 의 *AES vs RSA 비교* 를 다룬다 → 페이지가 *enriched* (3~4 문단 + 비교표 등). source C 가 *2024 년 NIST 가이드* 를 추가 → 페이지가 다시 *enriched*.

**실제 동작**: source B/C 가 같은 mention `encryption` 추출 → canonicalizer 가 다시 description 1~2 문장 생성 → **`createPage` 가 wiki/concepts/encryption.md 를 통째 overwrite** (`wikey-core/src/wiki-ops.ts::createPage` line 279~285):

```ts
export async function createPage(wikiFS: WikiFS, page: WikiPage): Promise<void> {
  const path = buildPath(page.category, page.filename)
  await wikiFS.write(path, page.content)   // ← 무조건 overwrite
}
```

→ **page content append/merge 메커니즘이 코드에 존재하지 않음**.

#### (b) "integrating it into the existing wiki — updating entity pages, revising topic summaries"

llm-wiki.md §The core idea:
> "When you add a new source, the LLM doesn't just index it for later retrieval. It reads it, extracts the key information, and **integrates it into the existing wiki — updating entity pages, revising topic summaries**, noting where new data contradicts old claims, **strengthening or challenging the evolving synthesis**."

**기대 동작**: 새 source 의 정보가 *기존 페이지의 본문* 과 비교되어 보완 / 반박 / 합치 됨. 모순은 별도 표시.

**실제 동작**:
- canonicalizer prompt 가 *기존 wiki 페이지의 본문을 읽지 않음*. 기존 page **base name 만** prompt 에 주입 (`existingEntityBases ∪ existingConceptBases`).
- 모순 감지 / 합치 / 반박 → *린트 워크플로우* (Step 별도) 에 위임. ingest 자동 흐름에는 없음.

#### (c) "A single source might touch 10-15 wiki pages"

llm-wiki.md §Operations:
> "A single source might touch 10-15 wiki pages."

**측정 결과**: 현재 wikey 의 평균 분해 비율 = source 1 개당 entity/concept ~5 개 (`indexAdditions` + `dropped` 추적). 이 자체는 정상. 다만 *touch* 의 의미가 "메타데이터 갱신 (sources 배열 + 출처 wikilink)" 이 아니라 *"페이지 본문이 enriched"* 여야 한다는 게 차이.

### 3.2 frontmatter sources 배열 — 누적 vs 단일

`wikey-core/src/canonicalizer.ts::buildPageContent` line 506:

```ts
sources: [${sourceFilename}]
```

→ **단일 source 만 frontmatter 에 박힘**. 같은 페이지가 두 번째 source 로 update 되면 이 배열이 *덮어쓰기* 되어 첫 source 가 사라짐.

`wikey-core/src/wiki-ops.ts::injectSourceFrontmatter` 는 source page 전용 (frontmatter 의 managed key 보존). entity/concept 페이지는 *완전 overwrite* 분기 (`createPage` 직접 호출).

다만 provenance 배열은 누적 됨:
- Step 7 의 `injectProvenance(content, [{type:'extracted', ref:'sources/<source_id>'}])` 가 dedupe 후 append.
- 따라서 *같은 페이지가 여러 source 에서 mention 됨* 은 `provenance:` 블록에서 추적 가능. 다만 **본문은 새 description 으로 overwrite**.

### 3.3 정합성 표

| llm-wiki.md 명제 | 현재 wikey 구현 | 정합 여부 |
|-----------------|-----------------|----------|
| richer with every source | description 1~2 문장 cap + overwrite | ❌ |
| integrating into existing wiki | 기존 본문 미참조 + overwrite | ❌ |
| updating entity pages | 새 description 으로 *교체* (`update` 아님) | ❌ |
| noting contradictions | 린트 별도 워크플로우 | ⚠ (자동 ingest 에선 X) |
| 10-15 pages touched | 5~10 mention 분해 | ✅ (수치) / ❌ (의미) |
| compounding artifact | provenance 배열만 누적, 본문은 stub | ❌ |

→ **6 명제 중 5 명제 미정합**. 본문 enrich 메커니즘 부재가 핵심.

---

## 4. 향후 빈 페이지에 내용이 추가되는 조건

### 4.1 현재 (자동 흐름) — *거의 없음*

| 시나리오 | 행동 | 본문 enrich 여부 |
|---------|------|-----------------|
| 같은 source 재 ingest | hash 동일 → skip | ❌ (무동작) |
| 같은 source 수정 후 reingest | force 분기 → page overwrite | ❌ (1 문장 description 으로 다시 overwrite) |
| 새 source 가 같은 mention 추출 | canonicalizer 재호출 → page overwrite | ❌ (다른 1 문장 description 으로 overwrite, 첫 source 의 description 손실) |
| 새 source 가 mention 안 함 | 페이지 미접근 | ❌ (본문 그대로) |

### 4.2 현재 (수동 흐름) — 사용자가 직접 보강

| 시나리오 | 행동 | 본문 enrich 여부 |
|---------|------|-----------------|
| 사용자가 `## 사용자 메모` 섹션 추가 | source-page protect Hook 2 가 보존 | ✅ (단 source 페이지만, entity/concept 미적용 — `incremental-reingest.ts::extractUserMarkers` 의 scope) |
| 사용자가 entity/concept 본문 직접 편집 | 다음 ingest 에 *완전 overwrite 됨* | ❌ (보호 메커니즘 없음 — 의도적 설계: entity/concept 사용자 marker 는 LLM determinism risk 로 cover 안 함, plan v11 P1-5 source 한정) |
| 사용자가 쿼리 후 답변을 `wiki/analyses/` 에 저장 | 새 페이지 생성 | ✅ (단 별 카테고리, entity/concept 미증분) |
| 사용자가 린트 워크플로우 실행 | 모순 발견 + 고아 제거 + 누락 cross-ref 보강 | ⚠ (수동 LLM 세션 — 자동 ingest 와 분리) |

### 4.3 보강 조건 — 정량 매트릭스

| 조건 | 현재 충족 여부 | 결과 |
|------|---------------|------|
| 같은 페이지를 여러 source 가 mention | ✅ (sources/source-*.md 의 provenance dedupe) | provenance 배열 누적, 본문 overwrite |
| canonicalizer prompt 가 기존 본문 read | ❌ (existingBases 만 read, content X) | 본문 enrich 불가능 |
| createPage 가 merge mode 지원 | ❌ (단순 overwrite) | 본문 enrich 불가능 |
| frontmatter sources 배열 append | ❌ (1 개로 overwrite) | 출처 추적 incomplete |
| ## 출처 wikilink 누적 | ❌ (1 개로 overwrite) | 출처 시각적 추적 incomplete |
| ## 관련 H2 cross-link 누적 | ❌ (현재 cycle 만, 매번 재생성) | 백링크 손실 |

→ **본문 enrich 의 *유일한 자동 경로* = 같은 mention 이 다음 ingest 에서 다시 추출되어 *우연히 더 좋은 description* 을 받을 때**. 이건 결정성 mode 에선 거의 발생 안 함 (temperature=0 → 같은 prompt → 같은 출력).

---

## 5. 근본 원인 요약

| # | 원인 | 위치 | 영향 |
|---|------|------|------|
| 1 | description 1~2 문장 cap | `canonicalizer.ts::buildCanonicalizerPrompt` 작업 규칙 6 | 페이지 본문 = 1 문장 stub |
| 2 | createPage = overwrite | `wiki-ops.ts::createPage` line 279~285 | 재 ingest 가 enrich 안 함 |
| 3 | 기존 본문 미참조 | canonicalizer prompt 가 `existingEntityBases` (이름만) 받음 | LLM 이 보강 시점 정보 부재 |
| 4 | sources 배열 단일 | `buildPageContent` line 506 | 출처 누적 미작동 (provenance 배열만 누적) |
| 5 | source 본문 inline 미포함 | mention 추출은 1 문장 evidence 만 | source 의 풍부한 텍스트가 페이지 도달 X |
| 6 | entity/concept marker 미보호 | Hook 2 source 한정 (plan v11 P1-5) | 사용자 수동 보강도 다음 ingest 에 손실 |

### 5.1 설계 의도 추적

이 패턴은 *우연* 이 아니라 *의도된 trade-off*:

- **검색 우선 사상** (wikey.schema.md "인제스트 분할 전략"): "qmd 임베딩/BM25는 페이지 단위. 작은 페이지가 Top-K 정확도 높음". 큰 페이지 → 검색 noise.
- **결정성 우선 사상** (Phase 4 §4.5.1.6.1): deterministic mode + 1~2 문장 cap → 30-run CV <15%. 긴 본문 → CV 폭발.
- **린트 워크플로우 분리** (wikey.schema.md "워크플로우 3"): 모순/보강은 *별 워크플로우* 의 책임 — ingest 자동 흐름의 책임 X.

→ 즉, llm-wiki.md 의 "richer compounding" 정책은 *린트 워크플로우* 에 위임된 것. 다만 **린트는 사용자가 명시 트리거해야 발동** → 실제 vault 에서 발동 빈도 낮음 → stub 페이지 누적.

### 5.2 llm-wiki.md 정합 여부 최종 판단

> "현재 wikey 의 자동 ingest 흐름은 *분해 + 인덱싱* 만 정합. *enriching synthesis* 는 사용자 수동 트리거 (린트 워크플로우 / 쿼리 후 analyses 저장) 에 위임된 상태로, llm-wiki.md 의 *자동 compounding* 명제와 부분적 충돌."
>
> Karpathy 는 "the LLM does all the grunt work" 를 명시했고, 그 grunt work 에는 cross-referencing 외에 *summary 갱신* 이 포함됨. 현재 wikey 는 cross-referencing (provenance + applyCrossLinks) 은 자동, summary 갱신은 미자동.

---

## 6. 개선 방향 제안

### 6.1 단기 — canonicalizer prompt 수정 (저비용)

`canonicalizer.ts::buildCanonicalizerPrompt` 작업 규칙 6 변경:

```diff
- 6. **description**: 1~2문장, 산업 표준 정의 위주 (기능 설명 X).
+ 6. **description**:
+    - **신규 페이지**: 3~5 문장 (정의 + 핵심 속성 + 1 응용 예).
+    - **기존 페이지 재방문 (mention 매칭)**: 본 source 의 새 정보를 1~2 문장으로 *추가* (전체 재작성 X).
```

추가로 prompt 에 *기존 페이지 본문 (description 부분 100 자)* 도 주입 → LLM 이 *덧붙이기* 모드로 전환.

### 6.2 중기 — `buildPageContent` 의 merge mode

`wiki-ops.ts::createPage` 가 *merge mode* 지원:

```ts
export async function createOrEnrichPage(
  wikiFS: WikiFS,
  page: WikiPage,
  mode: 'create' | 'enrich' = 'create',
): Promise<void> {
  const path = buildPath(page.category, page.filename)
  if (mode === 'enrich' && await wikiFS.exists(path)) {
    const existing = await wikiFS.read(path)
    const merged = mergeBodies(existing, page.content)  // description append + sources 배열 union + 관련 wikilink union
    await wikiFS.write(path, merged)
  } else {
    await wikiFS.write(path, page.content)
  }
}
```

`mergeBodies` 가 frontmatter 의 sources 배열 누적, description block 자동 append (날짜 prefix), 관련 H2 union — Karpathy 의 "incremental compounding" 정합.

### 6.3 중기 — frontmatter sources 배열 누적

`buildPageContent` line 506 변경:

```diff
- sources: [${sourceFilename}]
+ sources: ${JSON.stringify(unionSources(existingFrontmatter.sources, [sourceFilename]))}
```

기존 프론트매터의 sources 배열 ∪ 현재 source. `## 출처` block 도 동일 누적.

### 6.4 장기 — Karpathy "synthesis update" 자동화

Step 5/6 사이에 *기존 페이지 본문 retrieval + diff 기반 synthesis 결정* 단계 추가:

```
[Step 5b - new] page enrichment LLM (선택, 같은 mention 재방문 시만)
  - 입력: 기존 page 본문 + 현재 source 본문의 해당 mention 주변 100~300 자
  - 출력: { action: 'append' | 'revise' | 'no-change', new_block: '...', contradicts: bool }
  - cost: mention 당 1 콜 (재방문 시만 → 평균 비용 증가 미미)
```

### 6.5 사용자 수동 보강 보호 강화

Hook 2 (`extractUserMarkers`) 의 scope 를 entity/concept 까지 확장 — 단 LLM determinism risk 가 plan v11 P1-5 에서 명시된 만큼, *사용자 명시 toggle* (`WIKEY_PROTECT_ENTITY_MARKERS=true`) 로 opt-in.

### 6.6 린트 자동 트리거

매 ingest 종료 시 *증분 린트* (변경된 페이지만) 자동 실행 — schema.md "워크플로우 3" 의 "증분 린트" 사상을 자동화. 모순 / 고아 / 누락 cross-ref 자동 보고.

---

## 7. 수정 시 회귀 영향 평가

| 변경 | 회귀 테스트 영향 | 사용자 vault 영향 | 검색 정확도 영향 |
|------|------------------|-------------------|------------------|
| §6.1 prompt cap 완화 | -0 / +5 (description 길이 검증) | 미세 (CV 측정 재실행 필요) | + (본문 풍부) |
| §6.2 merge mode | -0 / +20 (mergeBodies + idempotent) | 점진 enrich (기존 stub → 시간 흐름에 보강) | + |
| §6.3 sources 배열 | -3 (단일 sources 가정 test) / +5 | 마이그레이션 1회 (기존 stub 의 sources 배열 union 보정) | 무관 |
| §6.4 enrichment LLM | -0 / +30 | LLM 비용 +10~20% | + (synthesis quality) |
| §6.5 marker 보호 확장 | -0 / +10 | 수동 보강 보존 | 무관 |
| §6.6 자동 증분 린트 | -0 / +15 | 매 ingest 후 모순/고아 보고 | + (long-term wiki quality) |

→ 총 +85 test, -3 obsolete, LLM 비용 +10~20%, 본문 quality 대폭 개선.

---

## 8. 결론

### 8.1 사용자 관측 검증

> "많은 wiki 페이지가 내용없이 제목만 있는 경우들이 존재" — **검증 OK**. 92 페이지 중 55 (60%) 가 description 1~2 문장 stub.

### 8.2 llm-wiki.md 정합 여부

> "최초 생성시에 관련된 페이지가 구성에 되지 않는 형태에서 페이지가 생성되는게 llm-wiki 정책과 맞는것인지" — **불일치**. llm-wiki.md 의 *"richer with every source"* / *"integrating into existing wiki — updating, revising"* 명제와 충돌. 현재 wikey 는 *분해 + 인덱싱* 만 자동, *enriching synthesis* 는 사용자 수동 트리거 (린트 워크플로우 / analyses 저장) 에 위임.

### 8.3 향후 보강 조건

> "이런 빈 페이지에 내용이 추가되는 조건" — **현재 자동 경로 사실상 없음**. 다음 셋 중 하나:
>
> 1. 사용자가 wiki/concepts/<name>.md 직접 편집 (다음 ingest 에 손실 위험)
> 2. 사용자가 린트 워크플로우 명시 트리거
> 3. 사용자가 쿼리 후 답변을 wiki/analyses/ 로 저장 (별 카테고리, entity/concept 미증분)
>
> 자동 흐름에서 본문이 enriched 되는 경로 부재. §6 개선안 (특히 §6.2 merge mode + §6.4 enrichment LLM) 채택 시 자동 compounding 가능.

### 8.4 한 눈 요약

> 현재 wikey 의 entity/concept 페이지는 **검색 정확도 + 결정성 + 린트 워크플로우 분리** 라는 trade-off 의 결과로 *의도된 stub*. 이 의도는 wikey.schema.md 에 명시되어 있으나 llm-wiki.md 의 *자동 compounding* 명제와 부분 충돌. 60% 의 stub 비율은 vault 가 진화할수록 *린트 워크플로우 발동 빈도 낮음* 에 의해 누적된 결과. 단기 prompt 수정 + 중기 merge mode + 장기 enrichment LLM 의 3-단계 개선으로 정합 가능. §5.10 paradigm shift (옵션 D — Step 8 deprecate) 와 결합하면 더 단순하고 정합도 높은 wikey 가 가능.

### 8.5 관련 문서

- [`docs/architecture/wikey-ingest-pipeline.md §6, §7`](./wikey-ingest-pipeline.md) — Step 6 canonicalize, Step 7 page write 상세
- [`docs/architecture/step8-self-extending-analysis.md`](./step8-self-extending-analysis.md) — §5.4 Step 8 폐기 가능성 (별 issue)
- [`wikey.schema.md "인제스트 분할 전략" / "핵심 원칙"`](../../wikey.schema.md)
- [`llm-wiki.md "The core idea" / "Operations"`](../../llm-wiki.md) — Karpathy 원문
- [`wikey-core/src/canonicalizer.ts`](../../wikey-core/src/canonicalizer.ts) — `buildCanonicalizerPrompt`, `buildPageContent`, `applyCrossLinks`
- [`wikey-core/src/wiki-ops.ts`](../../wikey-core/src/wiki-ops.ts) — `createPage`, `injectProvenance`, `updateIndex`, `appendLog`
- [`wikey-core/src/incremental-reingest.ts`](../../wikey-core/src/incremental-reingest.ts) — Hook 1/2 (사용자 marker 보호)
