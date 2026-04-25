# Phase 5 §5.2.1 — Entity ↔ Concept Cross-link 자동 생성 보조 계획서

> **상위 문서**: [`plan/phase-5-todo.md §5.2.1`](./phase-5-todo.md#521-entity--concept-cross-link-자동-생성--답변-풍부도-결정적-fix) · [`activity/phase-5-result.md`](../activity/phase-5-result.md) — 본 문서는 §5.2.1 보조 자료. 명명규칙: `phase-N-todox-<section>-<topic>.md` — `rules/docs-organization.md` 참조.

> **작성일**: 2026-04-25
> **버전**: v1 (초안 — analyst, 사용자 승인 전)
> **실행 단일 소스**: `plan/phase-5-todo.md §5.2.1` (체크박스 = 진행 상태). 본 문서는 설계·비교·테스트 전략만 기술 (체크박스 금지).
> **작성 주체**: analyst → codex Mode D Panel 검증 예정
> **결정성 우선 원칙**: `wikey.schema.md:155-160` (페이지 단위 검색 + wikilink 그래프) + Phase 4 §4.5.1.5 v2 ("RAG chunk 패턴 자체가 schema §19·§21 배격 대상", `phase-4-todo.md:446-494`) — 본 fix 도 동일 철학 (deterministic 우선, LLM 호출 추가 회피).

---

## 1. 배경 요약 (root cause + 단일 소스)

`plan/phase-5-todo.md §5.2 line 73-77` cycle smoke (2026-04-25, NanoVNA 1 파일) 실측:

- ingest 결과: 5 entities + 9 concepts + 1 source 생성. 모두 같은 ingest 사이클 (= 같은 source).
- entity 본문 = LLM `description` 1줄 + `## 출처` H2 + source wikilink 1개 (`canonicalizer.ts::buildPageContent` line 466-490). 같이 만들어진 9 concepts 로의 cross-ref 0건.
- query 답변 = 184 chars / citation 2건 (entity + source) — 같이 ingest 된 9 concepts 미인용.
- 사용자 평가: "재조합 문제 아님, **인제스트 단계에서 cross-link 가 안 만들어진 것이 root cause**" (commit `3f1fa6d` 직후 사용자 발화).

근본 원인: `canonicalizer.ts::buildPageContent` 가 entity/concept 페이지 본문을 만들 때 같은 사이클의 다른 페이지 정보를 **모르는 상태**. `assembleCanonicalResult` 가 entities + concepts 를 모두 모은 뒤에야 양쪽 슬러그 set 이 확정되는데, 페이지 content 는 이미 그 전에 생성됨 (line 461 → 472 순). 즉 **stage 분리 자체는 가능** (정보는 모두 있음), 누가 어디서 본문에 link 를 박아넣을지가 결정 안 됐던 것뿐.

---

## 2. 현재 코드 분석 (Stage 1/2/3 책임 + 삽입 지점 후보)

### 2.1 canonicalizer.ts 의 Stage 책임 분리

> wikey 의 "Stage 1/2/3" 명명은 `ingest-pipeline.ts:942` 주석 + `canonicalizer.ts:15-28` JSDoc 기준.

| Stage | 위치 | 입력 | 출력 | LLM 호출 |
|-------|------|------|------|----------|
| Stage 1 (extractMentions) | `ingest-pipeline.ts:539, extractMentions()` | source 본문 (FULL) 또는 H2 섹션 (SEGMENTED) | `Mention[]` (name + type_hint + evidence) | 1 회 (FULL) / N 회 (SEGMENTED) |
| Stage 2 (canonicalize) | `canonicalizer.ts:179, canonicalize()` | mentions + existing wiki + schema | `CanonicalizedResult { entities, concepts, dropped }` | 1 회 |
| Stage 3 (assembly + write) | `canonicalizer.ts:291, assembleCanonicalResult()` + `wiki-ops.ts` | RawCanonical JSON | `WikiPage[]` + index_additions + log_entry | 0 회 (deterministic) |

**핵심 관찰**: cross-link 삽입 지점 후보 3 곳 — 어디에 넣느냐가 옵션 A/B/C 의 본질.

| 후보 | 위치 | 특성 |
|------|------|------|
| **(α) Stage 2 LLM prompt 내** | `buildCanonicalizerPrompt` line 217-287 (작업 규칙 #7 옆에 #8 추가) | LLM 이 entity-concept 관계를 추출. 비결정적, prompt 길이 ↑. = 옵션 A |
| **(β) Stage 3 본문 빌드 직전, post-processing** | `assembleCanonicalResult` line 291-342 의 `applyForcedCategories` (line 322) **직후** + `buildPageContent` 재호출 또는 본문 patch | 양쪽 풀 확정 후 결정적으로 cross-link 삽입. LLM 호출 없음. = 옵션 B/C |
| **(γ) 별도 Stage 4 (write 단계)** | `ingest-pipeline.ts` 의 `writePages` 직전 | wiki-ops 레이어 — canonicalizer 책임 분리 위반 |

### 2.2 buildPageContent 의 현재 본문 구조 (canonicalizer.ts:466-490)

```
---
title: <name>
type: entity|concept
entity_type|concept_type: <type>
created: <today>
updated: <today>
sources: [<sourceFilename>]
tags: []
---

# <name>

<description>

## 출처

- [[<source-base>]]
```

→ `## 관련` H2 섹션을 **`## 출처` 와 본문 사이 또는 `## 출처` 다음** 어느 쪽에 둘지 §5 에서 결정.

### 2.3 영향 범위 (line + 함수 단위)

수정 필요 (예상):
- `wikey-core/src/canonicalizer.ts`
  - `buildPageContent` (line 466-490) — `## 관련` 섹션 inject 지원 (relatedLinks 인자 추가)
  - `assembleCanonicalResult` (line 291-342) — 양 풀 확정 후 cross-link 계산 + buildPageContent 재호출 또는 in-place patch
  - 신규 helper `applyCrossLinks(entities, concepts, sourceFilename, today)` (옵션 B 채택 시)
- `wikey-core/src/__tests__/canonicalizer.test.ts` — `describe('canonicalize — cross-link insertion')` 신규 (≥3 cases)
- 신규 fixture: 없음 (LLM mock JSON 으로 충분 — entity 1+ concept 1+ 같은 사이클 시나리오)

수정 불필요:
- `ingest-pipeline.ts` — canonicalize 호출부 시그니처 변경 없음 (cross-link 은 결과의 content 안에 이미 박혀 나옴)
- `wiki-ops.ts` — page write 로직 무관 (content 만 받아 파일로 write)
- `query-pipeline.ts` — 본 §5.2.1 범위 외 (§5.2.2/§5.2.3 가 prompt + 1-hop expansion 담당)

### 2.4 비용 / 결정성 / prompt 길이 영향

- 옵션 A (prompt 추가): canonicalizer LLM call 1 회의 prompt 길이 +20~40 lines (관계 추출 지시 + 출력 schema 확장 `relations: [{from, to}]`). 응답 토큰 +N 건의 관계 수 만큼. 비결정성 noise 추가 (temp=0 + seed=42 로도 결정성 보장 어려움 — gemini-2.5-flash 의 jsonMode 가 strict deterministic 아님).
- 옵션 B (deterministic policy): LLM 호출 0 회, prompt 변경 0, 결정성 100%. 단 "같은 source 의 entity 와 concept 모두 cross-link" 정책상 의미 무관 link 도 생성 (예: entity `nanovna-v2` 와 concept `pmbok` 이 어쩌다 같은 source 에 있으면 link).
- 옵션 C (hybrid): 옵션 B 의 결정적 모두-link 위에 LLM 1 회 추가로 "이 link 중 무관한 것 제거" — LLM call +1 회 (canonicalizer 외 별도), 비용·복잡도 ↑.

---

## 3. 옵션 trade-off 비교

| 축 | A: LLM prompt 추가 | **B: Deterministic policy** ★ | C: Hybrid (B + LLM 정제) |
|----|---|---|---|
| 정확도 (의미적 매칭) | 高 (LLM 이 의미 평가) | 中 (같은 source = 관련 가정. NanoVNA 1 파일 기준 높음, 다중 도메인 source 에서 noise) | 高 (B 의 모두-link 위에 LLM 정제) |
| 비용 (LLM token) | +20~40 prompt lines × ingest 회 + 응답 token | 0 | 별도 LLM call +1 회 (per ingest) |
| 결정성 | 低 (gemini jsonMode 도 deterministic 미보장) | **100%** (순수 정책) | 中 (LLM 정제 단계에서 변동) |
| 복잡성 (구현) | 中 (prompt + 응답 schema + parsing) | **低** (assembleCanonicalResult 후 helper 1 개) | 高 (B + 별도 LLM call + 결과 재 patch) |
| Phase 4 §4.5.1.5 v2 정합 (chunk-style RAG infra 회피) | 위반 위험 (LLM 호출 1 단계 추가) | **부합** | 부분 위반 |
| 위험 (false positive cross-link) | 低 | 中 (의미 무관 link — NanoVNA 도메인 특성상 1 파일 = 1 도메인 → 실측상 무시 가능) | **低** |
| TDD 검증 가능성 | 어려움 (LLM mock 필요, 응답 다양성 노이즈) | **쉬움** (입력 set → 출력 link set 1:1 함수) | 중 (B 단계 검증 + LLM mock 검증 분리) |
| `wikey.schema.md` 결정성 우선 정합 | 약함 | **강함** | 중 |
| §5.2.4 측정 baseline 도입 후 재평가 가능성 | 매몰 비용 ↑ | **낮음** (A/C 로 ratchet up 가능) | 중 |

---

## 4. 권장 옵션 + 근거

**채택: 옵션 B (Deterministic policy) — `같은 ingest 사이클의 entity ∩ concept 은 모두 양방향 wikilink`.**

> **Scope (codex P1-3 정정, 2026-04-25)**: 옵션 B 는 "1차 정책 (single-domain source 가정)". false positive cap = 측정 시 cross-link 1건 당 무관 link 비율. **전환 트리거 — 옵션 C (LLM filter)** 진입 조건:
> - 다중 도메인 source 의 cross-link 무관율 > 30% 측정 (sample size ≥ 5 source) OR
> - 사용자 정성 평가 "관련 wikilink 가 답변 정확도를 떨어뜨림" 명시
> 위 조건 미충족 시 옵션 B 유지.

### 핵심 근거 (3 줄)

1. **wikey 결정성 철학 정합**: Phase 4 §4.5.1.5 v2 (`phase-4-todo.md:446-494`) 가 RAG chunk 패턴 자체를 schema §19·§21 배격 대상으로 결정·코드 제거 (`splitIntoChunks` 삭제, `source_chunk_id` → `source_section_idx`). 본 §5.2.1 도 동일 결정성 기조 — "LLM 한 단계 더" 보다 "결정적 정책 + 측정" 우선.
2. **NanoVNA 1 파일 = 1 도메인 패턴**: cycle smoke 에서 같은 사이클 entity/concept 들이 모두 NanoVNA 도메인 (smith-chart, swr, s11/s21 등). 같은 source 가정의 false positive 위험이 실측상 무시 가능. 다중 도메인 source 가 등장하면 §5.2.6 (페이지 H2 의미 활용) 또는 옵션 C 로 ratchet up 가능 (sunk cost 낮음).
3. **TDD 검증 용이**: `(entities[], concepts[]) → page contents with [[wikilink]]` 가 순수 함수 → unit test 가 결정적. LLM mock 없음. RED→GREEN 사이클 명료.

### 단일 source 1 페이지 cross-link 정책 변형 (사소 결정)

- 같은 사이클에 entity 만 있고 concept 0 → entity 본문 `## 관련` H2 생략 (빈 섹션 금지).
- 같은 사이클에 entity ≥1 + concept ≥1 → entity 마다 `## 관련` H2 + 모든 concept wikilink 나열 (역방향: 모든 concept 마다 `## 관련` + 모든 entity wikilink).
- entity ↔ entity / concept ↔ concept 는 **link 하지 않음** — entity-concept 관계만 (사용자 명세 line 102 "같은 source 의 entity 와 concept 은 서로 link" 명시 범위).

---

## 5. `## 관련` H2 섹션 형식 (결정)

### 5.1 위치 — `## 출처` **앞** (description ↔ 출처 사이)

```
# <name>

<description>

## 관련

- [[<related-1>]]
- [[<related-2>]]

## 출처

- [[<source-base>]]
```

### 5.2 근거

- `## 출처` 가 wikey 페이지 컨벤션 상 **마지막 H2 위치** 가 자연스러움 (사용자 입장: description → 관련 → 출처). codex P2 검증 (2026-04-25) 결과 `validate-wiki.sh` 가 "마지막 H2" hard-depend 하지는 않으나 (lint relax 불필요), 페이지 시각 컨벤션 유지 차원에서 `## 관련` 을 `## 출처` **앞** 에 위치.
- 사용자 입장: 페이지 열어 description → 관련 → 출처 순으로 위→아래 자연스러움.

### 5.3 Bullet style

```
- [[<base-name>]]
```

- 무 description, 무 type 표기 (페이지 클릭하면 보임). Obsidian preview 에서 hover 로 description preview 자동 노출.
- 정렬: alphabetical (결정적). `Array.sort()` on bases.

### 5.4 빈 섹션 처리

- 같은 사이클 cross-link 0 건 → `## 관련` H2 자체를 **생략**. (빈 H2 + bullet 0 은 lint warning 유발.)

### 5.5 (탐구) 카테고리 라벨 추가 가능성

향후 §5.5 지식 그래프 진입 시 `## 관련` 안에서 entity / concept 그룹 분리 (`### 엔티티`, `### 개념`) 가능. 현 §5.2.1 범위에선 단일 list — 1 hop 효과만 우선 검증.

---

## 6. 회귀 위험 분석

| 위험 | 영향 | 대응 |
|------|------|------|
| 기존 wiki 페이지 format 호환 | `## 관련` 신규 H2 추가만 — 기존 페이지 본문 무변경 | 신규 ingest 부터만 적용 (사용자 명세 line 104) |
| frontmatter 영향 | 0 (frontmatter unchanged) | — |
| `validate-wiki.sh` lint | `## 출처` 위치 검증 로직이 "마지막 H2" 가정이면 깨질 수 있음 | sed/grep 으로 lint 스크립트 검토 → 필요 시 "마지막 또는 끝에서 두 번째 H2" 로 완화 |
| `qmd reindex` BM25/벡터 | 페이지 본문 길이 +N lines (3-9 wikilink) → 임베딩 약간 dilute. 영향 < 5% (cycle smoke baseline 184 chars 대비 H2 + 9 wikilink ≈ +120 chars) | §5.2.4 baseline 측정에 포함 |
| Obsidian Graph View | 백링크 +N 건 자동 표시 — wiki/concepts/smith-chart.md 가 nanovna-v2 의 backlink 로 노출됨 | 사용자 가치 — positive |
| `## 관련` 와 사용자 수동 추가 collision | 신규 ingest 가 항상 본문을 새로 build (canonicalizer 가 LLM `description` 위에 buildPageContent 로 재생성) — 기존 페이지 incremental 업데이트는 §5.3 hash 기반 (별도 작업) | 신규 ingest 가 기존 페이지 덮어쓰는 케이스에서만 영향. 현 ingest-pipeline 동작 = 기존 페이지 발견 시 wiki-ops layer 가 어떻게 처리하는지 verify 후 완성 |
| canonicalizer.test.ts 기존 테스트 | `buildPageContent` 시그니처 변경 (`relatedLinks` 추가) → 기존 테스트의 content 어설션 (`'## 출처'` 등) 영향 검증 | 기존 어설션 유지 + 신규 어설션 추가. 기본값 `relatedLinks=[]` → `## 관련` 생략 → 기존 테스트 그대로 통과 |

---

## 7. wiki 재생성 정책 (사용자 명세 line 104 그대로)

- **신규 ingest** 부터 적용. canonicalize 결과의 content 에 `## 관련` 자동 포함.
- **기존 wiki entity/concept 본문 무변경**. cycle smoke 에서 발견된 nanovna-v2.md / smith-chart.md 등은 사용자가 의도적으로 reset 후 재인제스트할 때만 새 format 적용.
- 기존 wiki 의 stale 본문에 cross-link 가 없는 것은 알려진 한계 — Phase 5 §5.3 hash 기반 증분 재인제스트 도입 시 자동 갱신 경로 확보.
- migration 스크립트 작성 **하지 않음** — 사용자 명세 + 결정성 (one-way upgrade 회피) 양쪽 정합.

---

## 8. 구현 단계 (TDD: RED → GREEN → REFACTOR)

총 4 step. 각 step 은 acceptance 가 fresh 실행 증거 (`rules.md §1`).

### Step 1 (RED): 테스트 작성 — `canonicalizer.test.ts` 의 `describe('canonicalize — cross-link insertion')`

**파일**: `wikey-core/src/__tests__/canonicalizer.test.ts` (기존 파일 확장, 신규 describe block)

**Test cases (8, 사용자 명세 5 + codex P1-2 추가 3)**:
1. **happy**: mock LLM 이 entity 1 (nanovna-v2) + concept 2 (smith-chart, swr) 반환 → entity 본문에 `## 관련` H2 + `[[smith-chart]]` + `[[swr]]` (alphabetical) 등장 + 두 concept 본문에 `## 관련` + `[[nanovna-v2]]` 등장.
2. **edge — empty pool**: mock LLM 이 entity 1 + concept 0 → entity 본문에 `## 관련` H2 **미등장** (빈 섹션 금지).
3. **edge — concept only**: mock LLM 이 entity 0 + concept 2 → 양쪽 concept 본문 모두 `## 관련` H2 미등장 (entity ↔ concept cross-link 만 정책).
4. **error/regression — FORCED_CATEGORIES post-pin**: mock LLM 이 entity 풀에 `restful-api` (FORCED_CATEGORIES → concept) + entity `nanovna-v2` 반환 → pin 으로 restful-api 가 concept 풀로 이동 후 cross-link 계산 → nanovna-v2 본문에 `[[restful-api]]` 등장 (pin 적용 **후** cross-link).
5. **regression — alphabetical 결정성**: 같은 입력 2 회 호출 → content byte-for-byte 동일.
6. **edge (codex P1-2) — SLUG_ALIASES self-link 방지**: entity 1 + concept 1 이 alias collapse 후 같은 base 가 되면 self-link `[[자신]]` 생성 금지. (또는 alias collapse 시 그쪽 풀에서 사라지므로 자연 cover 되는지 검증)
7. **edge (codex P1-2) — dual-pool cross-pool dedup**: 같은 base (예: `swr`) 가 entity 풀 + concept 풀 양쪽에 들어왔을 때 cross-link 가 자기 자신 가리키지 않음 + 한쪽 풀에서만 유지됨.
8. **edge (codex P1-2) — rebuild idempotent**: 이미 `## 관련` 섹션이 있는 페이지 본문이 다시 buildPageContent 거칠 때 `## 관련` 섹션이 1개만 존재 + bullet list 중복 없음.

**Acceptance (RED 증거)**: `npx vitest run canonicalizer.test.ts -t "cross-link"` → 8 fail / 0 pass / fresh stdout 캡처.

### Step 2 (GREEN): canonicalizer.ts 수정 — minimal 구현

**파일**: `wikey-core/src/canonicalizer.ts`

**변경**:
1. `buildPageContent` 시그니처에 `relatedLinks?: readonly string[]` 추가. 기본값 `undefined` → `## 관련` 생략 (기존 호출부 호환).
2. 신규 helper `function applyCrossLinks(entities: WikiPage[], concepts: WikiPage[], sourceFilename: string, today: string): { entities: WikiPage[], concepts: WikiPage[] }` —
   - entity 풀 base set + concept 풀 base set 분리.
   - entity 마다 `relatedLinks = sortedConceptBases` 로 buildPageContent 재호출 (description 은 기존 content 에서 `extractDescription` 으로 회수).
   - 역방향 동일.
   - 한쪽 풀이 비면 그쪽은 patch 하지 않음 (기존 content 그대로).
3. `assembleCanonicalResult` 가 `applyForcedCategories` 결과 (line 322 `pinned`) 를 `applyCrossLinks` 로 후처리. 반환 객체의 entities/concepts 만 교체.

**Acceptance (GREEN 증거)**: `npx vitest run canonicalizer.test.ts` → 기존 테스트 + cross-link 8 케이스 모두 pass / 0 fail / fresh stdout. `npm test src/` 전체 → "현재 baseline + 8" passed / 0 failed (codex P2: 정확한 baseline 은 implementation time 에 측정).

### Step 3 (REFACTOR): 중복 제거 + 가독성

- `applyCrossLinks` 의 entity-loop 와 concept-loop 가 거울 구조 → 내부 helper `rebuildWithLinks(page, related, sourceFilename, today, category)` 로 추출.
- buildPageContent 의 string 템플릿이 cross-link 분기로 가독성 저해 시 sub-section helper 분리.
- 테스트는 그대로 GREEN 유지.

**Acceptance**: `npm run build` 0 errors + `npm test` 전체 GREEN 재확인.

### Step 4 (CDP smoke + measurement, optional in scope)

> 본 step 은 §5.2.8 (검증) 와 부분 겹침. §5.2.1 단독 cross-link 효과만 따로 측정.

- master CDP smoke (`obsidian-cdp` skill) 로 NanoVNA fixture 재인제스트 → wiki/entities/nanovna-v2.md 본문 grep:
  - `grep -c '\[\[smith-chart\]\]\|\[\[swr\]\]' wiki/entities/nanovna-v2.md` ≥ 3
  - `wc -l wiki/entities/nanovna-v2.md` ≥ baseline + 5 (관련 H2 + bullet 3+)
- `activity/phase-5-resultx-5.2.1-crosslink-smoke-2026-04-25.md` 신규 — fixture / 출력 / grep 결과 / git diff 캡처.

**Acceptance**: nanovna-v2.md 본문에 smith-chart / swr / s11 또는 s21 중 ≥3 wikilink 등장. cycle smoke baseline (citation 2건 / 답변 184 chars / cross-link 0건) 대비 cross-link ≥3건 (entity 당) 측정값 기록.

---

## 9. Acceptance Criteria 종합 (§5.2.1 완료 정의)

> 체크박스는 `plan/phase-5-todo.md §5.2.1` 단일 소스. 아래는 acceptance 항목 정의만.

- (RED 증거) 신규 `cross-link insertion` describe 8 케이스 — 구현 전 8 fail / fresh stdout 캡처.
- (GREEN 증거) `npx vitest run src/` 전체 pass ("현재 baseline + 8") / `npm run build` 0 errors / fresh stdout 캡처.
- (회귀) 기존 canonicalizer 테스트 + ingest-pipeline 테스트 그대로 pass.
- (smoke, codex P1-1 정정) NanoVNA fixture 재인제스트 결과 nanovna-v2.md 본문 grep:
  - `grep -oE '\[\[[^\]|#]+' wiki/entities/nanovna-v2.md | sort -u | wc -l` ≥ 3 (distinct wikilink targets, alias/anchor 제거)
  - 측정 baseline: `phase-5-resultx-5.1-cdp-cycle-smoke-2026-04-25.md` 의 citation **4건** + entity 본문 1줄 (재측정 시 commit + query 핀)
- (lint) `scripts/validate-wiki.sh` 가 신규 `## 관련` 섹션 추가된 페이지에서 false-positive 발생 안 함.
- (문서 동기화) `activity/phase-5-result.md §5.2.1` mirror entry + `wiki/log.md` 엔트리 + 본 todox v2+ 에 codex 검증 결과 반영.
- (memory) `~/.claude/projects/-Users-denny-Project-wikey/memory/project_phase5_status.md` 의 §5.2.1 상태 갱신.

---

## 10. codex 검증 요청 포인트 (Mode D Panel)

본 plan 의 다음 결정·코드 변경에 대해 codex (cross-model: GPT-5 / sonnet) 의 cross-validation 요청:

1. **옵션 B 선택의 정합성**: wikey 결정성 철학 + Phase 4 §4.5.1.5 v2 (RAG chunk 배격) 결정 정합한가? 옵션 C 가 1 파일 = 1 도메인 가정의 일반화 실패에 대한 안전망으로 더 적절한가?
2. **`## 관련` 위치 (description / 출처 사이)**: wikey 페이지 컨벤션 + lint 와 충돌 없는가? `## 출처` 가 "마지막 H2" 라는 묵시적 가정이 코드 어디에서 hard-depend 하는가? (`wiki-ops.ts`, `validate-wiki.sh`, query-pipeline 의 출처 인용 추출 등)
3. **`applyCrossLinks` 의 buildPageContent 재호출 방식**: 기존 content 에서 `extractDescription` 으로 description 회수 → buildPageContent 재호출이 idempotent 한가? frontmatter `created`/`updated` 가 today 기준 재생성 시 의도와 합치하는가?
4. **FORCED_CATEGORIES post-pin 적용 순서**: cross-link 계산이 pin **이후** 라는 결정 (Step 1 case 4) 이 옳은가? pin 전 entity 풀에 들어가 있던 슬러그가 pin 으로 concept 풀로 이동했을 때 cross-link 가 자연스럽게 그 슬러그를 가리키는가?
5. **TDD 5 케이스의 누락**: edge case 누락 (예: SLUG_ALIASES collapse 후 self-link 발생 가능성, 같은 base 가 entity + concept 양쪽 풀에 들어가 cross-pool dedup 거친 후의 동작) — 추가해야 할 case 가 있는가?
6. **§5.2.4 TOP_N 상향과의 상호작용**: cross-link 도입으로 페이지 본문이 길어지면 qmd 임베딩에 영향 → §5.2.4 measurement 가 cross-link 도입 전 baseline 을 별도로 잡아야 하는가? 본 §5.2.1 단독 측정 vs §5.2.2/.3/.4 통합 측정의 분리 기준.

---

## 11. 오픈 질문 (사용자 결정 대기)

1. **`## 관련` 섹션 라벨링 (Q-A)**: 본 plan 은 `## 관련` 단일 H2 + 단순 bullet 채택. entity 와 concept 을 H3 로 분리 (`### 엔티티`, `### 개념`) 하는 방안은 §5.5 (지식 그래프) 진입 시 도입할지, §5.2.1 에 미리 도입할지?
2. **CDP smoke 책임 분담 (Q-B)**: Step 4 의 NanoVNA 재인제스트 smoke 는 master 가 직접 (=§5.1 처럼 commit `2da88cb`) 수행할지, tester subagent 위임할지?
3. **§5.2.8 통합 검증 시점 (Q-C)**: §5.2.1 GREEN 즉시 cycle smoke 재실행 vs §5.2.2 (prompt 강화) + §5.2.5 (reindex fix) 까지 묶어 한 번에 cycle smoke 재실행 — 어느 쪽이 측정 효율적?

---

## 12. 변경 이력

- 2026-04-25 v1 — 초안 (analyst). 옵션 B 채택, `## 관련` H2 위치 = description / 출처 사이, TDD 5 case + 4 step. codex 검증 + 사용자 승인 대기.
