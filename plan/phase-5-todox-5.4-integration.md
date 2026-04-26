# Phase 5 §5.4 self-extending **통합 개발 계획서** v5

> **상위 문서**: [`plan/phase-5-todo.md §5.4`](./phase-5-todo.md#54-표준-분해-규칙-self-extending-구조-p2) · [`activity/phase-5-result.md`](../activity/phase-5-result.md)
> **자매 보조**: [`plan/phase-5-todox-5.4.1-self-extending.md`](./phase-5-todox-5.4.1-self-extending.md) v7 (codex Cycle #9 APPROVE 2026-04-26) — Stage 1 단독 plan, 본 통합 plan 의 §3.1 reference 단일 소스
>
> **작성일**: 2026-04-26
> **버전**: v5 (codex Cycle #4 NEEDS_REVISION — 2 finding [MED 2] master 직접 fix → cycle #5 final APPROVE 검증 대기)
> **v1 → v2 변경 요지**: **codex Cycle #1 NEEDS_REVISION 5 fix 모두 master 직접 정정** — (Issue 1 HIGH §3.2.5) schema.yaml writer append-only → **section-range insertion** (header `[]` reject + 다음 top-level key 직전 insert). (Issue 2 HIGH §3.4.1/§3.4.3/AC17) `confidence` → `arbitration_confidence` 통일 (line 879/1327-1328). (Issue 3 MED §5/§AC22) test count 산수 정정 (≥710 PASS / 신규 ≥42 → ≥711 PASS / 신규 ≥41, Stage 2 ≥17 → ≥20). (U1 §3.2.1) JSON store 분리 — suggestions.json (rotation 안 함, negativeCache 영구) + mention-history.json (rotation 5000 ingest 또는 10MB). (U3 §3.4.2) Stage 4 alpha / page-level-limited 명시. (U4 AC21) fixture corpus 6 자료 owner = master, Stage 2 cycle 시작 전 마련 의무 + 위치 명시. (U5 §3.2.2) 임계값 alpha default + baseline calibration 의무 명시. U2 deferral OK (변경 X).
> **v2 → v3 변경 요지**: **codex Cycle #2 NEEDS_REVISION 3 fix 모두 master 직접 정정** — (Issue 1 HIGH §2 line 78 + §7 R2 line 1455 + §3.2.5 한계 line 502) stale "append-only writer" / "파일 끝 append" 표현 → "section-range insertion" 으로 정정 (구현자 mis-read 방지). (Issue 2 HIGH §3.4.2 line 854/863/869) Stage 4 LLM arbitration prompt 의 `confidence` → `arbitration_confidence` + parse/mapper 명시 (LLM JSON 계약 ↔ ConvergedDecomposition TS 타입 일관, `result.arbitration_confidence` undefined 위험 해소). (Issue 3 MED §9 line 1572-1573) self-check 표 v1 → v2/v3 갱신 (drift 없음 anchor 본인 신뢰 회복).
> **v3 → v4 변경 요지**: **codex Cycle #3 NEEDS_REVISION 3 fix 모두 master 직접 정정 + bonus self-fix 1** — (Issue 1 HIGH §3.2.5 제목 line 413) 헤딩 자체에 "append-only" 잔존 → "section-range insertion" 정정 (제목/본문 일관). (Issue 2 MED §1.1 line 31 표 + §1.2 line 42 비목표 + §4.3 line 1129 충돌 처리) Stage 4 prose 의 단독 `confidence` → `arbitration_confidence` 통일 (총 3 위치). (Issue 3 MED footer line 1624-1625) 다음 master 액션의 v2/Cycle #2 stale → v3/Cycle #3 갱신. v4 self-fix cross-check 시 잔재 0 확증.
> **v4 → v5 변경 요지**: **codex Cycle #4 NEEDS_REVISION 2 MED fix 모두 master 직접 정정** — (Issue 1 MED §8 D3 decision 표 line 1585) decision matrix 의 D3 가 "writer = append-only" 잔재 (§9 retrospective 밖, 본 D3 는 영속 결정 표라 stale 안 됨) → "section-range insertion (parse 안 함, line-level scan, header `[]` reject)" 으로 정정. (Issue 2 MED footer 다음 master 액션 line 1644-1647) v3/Cycle #3 stale → v5/Cycle #5 갱신. v5 잔재 0 확증, BUILD_BREAK_RISK LOW 유지.
> **목적**: §5.4 의 4 Stage 전체 (Stage 1 ~ Stage 4) 통합 개발 계획. Stage 1 (구현 staged, codex Cycle #9 APPROVE 직전) 의 결정사항을 **불변 reference** 로 두고, Stage 2 / Stage 3 / Stage 4 의 detailed 설계 + 단계 간 데이터 흐름 + 통합 시나리오 + 통합 acceptance criteria 를 모두 포괄. 사용자 명시 ("부분부분 진행할 부분만 계획이 세워지면 통합후 예외상황이 많이 발생하지 않겠어." 2026-04-26) 에 대응.
>
> **TDD 강제** (rules/rules.md §1 Evidence-Based + Stage 1 v7 가 입증한 패턴): 모든 22 AC 가 RED→GREEN→REFACTOR 사이클. 라이브 검증 (obsidian-cdp full cycle smoke) 은 별 AC (AC21) 로 분리. Mega-test 금지 (한 테스트가 10 behavior 검증 X). waitForTimeout 등 임의 대기 금지 — 구체적 조건 대기.
>
> **wiki 재생성 없음 확증**: 모든 Stage 는 신규 인제스트 경로에만 영향. 기존 wiki 페이지 보존 — 본체 §5.4 line 277 원칙 + Stage 1 v7 §1.2 비목표.
>
> **검증 cycle 흐름**: analyst v1 (본 문서) → master 1차 검증 (rules.md §10 7-anchor grep) → reviewer (codex Mode D Panel) 2차 검증 → NEEDS_REVISION 시 fix → APPROVE 까지 cycle 반복. 본 cycle 은 v1 작성 완료 시점에 종료, 후속 cycle 은 master 가 진행.

---

## 1. 목표 / 비목표 / 통합 원칙

### 1.1 목표 — §5.4 self-extending 의 4 단계 점진적 달성

§5.4 의 본질 = **수동 등록 (canonicalizer.ts 인라인 + schema.yaml 수동 편집) → 자동 등록 (인제스트 graph 분석 + LLM arbitration)** 으로의 단계적 이행. wikey 가 표준 분해 구조를 스스로 학습·확장하는 구조 (`wiki/analyses/self-extending-wiki.md` 의 철학을 코드 레벨로 실현).

| Stage | 자동화 수준 | 입력 | 산출물 | 사용자 개입 |
|---|---|---|---|---|
| **Stage 1** (구현 완료, staged) | static `.wikey/schema.yaml` override + BUILTIN PMBOK default | YAML (사용자 명시 편집) + BUILTIN 상수 | `buildStandardDecompositionBlock` 으로 동적 prompt 생성 | yaml 직접 편집 (또는 `SchemaOverrideEditModal`) |
| **Stage 2** (계획 대상) | extraction graph 기반 **suggestion** | mention graph (canonicalizer 결과) + suffix clustering | suggestion 카드 (`.wikey/suggestions.json`) → 사용자 accept → schema.yaml append | accept/reject 버튼 1 click |
| **Stage 3** (계획 대상) | in-source self-declaration | section-index `parseSections` 결과 + LLM "표준 개요" detector | runtime-scope decomposition (해당 ingest 세션만) 또는 사용자 승인 후 schema.yaml append | runtime-scope 자동 적용 (사용자 인지) → persist 시 accept |
| **Stage 4** (계획 대상) | cross-source convergence | qmd vector index (mention graph 전체) + LLM arbitration | `wiki/analyses/converged-decomposition.md` reference (또는 schema.yaml suggestion) | arbitration_confidence ≥ 임계값 시 review modal |

### 1.2 비목표 (out of scope, 본 통합 plan)

- **Stage 5 이상** — 본 plan 은 Stage 1~4 까지. 자동 LLM agent loop 는 Phase 6+ 영역.
- **Phase 6 웹 인터페이스** — 본 plan 은 Obsidian 플러그인 UI 영역만. 웹 UI 는 Phase 6 (`plan/phase-6-todo.md`).
- **다른 표준 도메인 메커니즘과의 통합** — `canonicalizer.ts:117-142 FORCED_CATEGORIES` 는 별개 메커니즘 (특정 slug 를 entity/concept type 으로 강제 핀). 본 plan 의 standard_decompositions 와는 의미가 다름 — 통합하지 않음.
- **wiki 재생성 유발 변경** — 본체 §5.4 line 277 원칙 (Stage 1 v7 §1.2 와 동일).
- **사용자 vault 강제 마이그레이션** — Stage 1 의 `undefined` (absent) → BUILTIN fallback 정책 (Stage 1 v7 §3.1 표) 그대로. 사용자 yaml 편집 없이도 모든 Stage 가 호환.
- **`loadSchemaOverride` 시그니처 확장** — Stage 1 v7 §1.2 비목표 그대로 (`{ override, warnings }` 변경은 §5.5 후순위).
- **runtime self-declaration 의 자동 persist 강제** — Stage 3 의 자동 persist 옵션은 사용자 승인 게이트 필수 (§3.3.3).
- **Stage 4 LLM arbitration 의 자동 schema.yaml append 강제** — arbitration_confidence 임계값 + 사용자 review modal 필수 (§3.4.5).

### 1.3 통합 원칙 (모든 Stage 공통)

1. **후행 Stage 가 선행 Stage 의 데이터 모델·시그니처를 깨면 안 됨** — Stage 1 의 `StandardDecomposition` / `StandardDecompositionsState` / `BUILTIN_STANDARD_DECOMPOSITIONS` / `buildStandardDecompositionBlock` 4 시나리오 분기 (undefined / empty-explicit / empty-all-skipped / present) 모두 불변. Stage 2/3/4 가 추가 필드 (예: `confidence`, `origin`, `support_count`) 를 요구하면 **optional 필드만 추가**, 기존 caller 영향 없도록.
2. **`origin` 필드로 출처 구분** — Stage 1 에선 `'hardcoded'` (BUILTIN) 또는 `'user-yaml'` (사용자 yaml). Stage 2 추가 시 `'suggested'`, Stage 3 추가 시 `'self-declared'`, Stage 4 추가 시 `'converged'`. **우선순위**: 사용자 직접 yaml > suggestion accepted > self-declared > converged > hardcoded (fallback). §4.4 fallback chain 참조.
3. **사용자 승인 게이트 (자동 schema.yaml append 금지)** — Stage 2/3/4 의 자동 메커니즘은 모두 suggestion / runtime-scope / review modal 까지. 영구 schema.yaml append 는 사용자 명시 accept 후에만.
4. **mention graph 데이터 = canonicalizer 산출 + ingest-pipeline DB record** — Stage 2 패턴 탐지의 입력. Stage 4 cross-source convergence 의 입력. 별도 데이터 fetch 인프라 신규 X — 기존 ingest 결과 재활용.
5. **TDD + 라이브 cycle smoke 의무** — 모든 단위 코드 = RED→GREEN→REFACTOR. 통합은 별 AC (AC21) 로 obsidian-cdp full cycle smoke (Brief→Proceed→Processing→Preview→Approve→wiki write).
6. **Stage 1 결정사항 불변** — todox v7 §3.1~§3.6 의 모든 결정사항은 본 plan 안에서 reference 만 (§3.1 1:1 인용). Stage 2/3/4 는 그 위에 add-on.
7. **AC 단위 분해 (mega-test 금지)** — 각 AC = 1 component (예: `SuggestionStorage` 단독, `co-occurrence detector` 단독). 한 테스트가 여러 component 검증 X.

---

## 2. 현재 코드 사실 (analyst 직접 grep + read 로 확인, 2026-04-26)

### 2.1 Stage 1 staged 코드 (todox v7 §2 그대로)

| 항목 | 위치 | 현재 상태 | Stage 1 변경 |
|---|---|---|---|
| `SchemaOverride` 타입 | `wikey-core/src/types.ts:185-188` | `entityTypes` + `conceptTypes` + **`standardDecompositions?: StandardDecompositionsState`** (staged) | Stage 1 신규 필드 (v7 §3.1) |
| `StandardDecomposition` 타입 | `wikey-core/src/types.ts:161-167` | staged (v7 §3.1) | `name` / `aliases` / `umbrella_slug` / `components` / `rule` / `require_explicit_mention` / `origin?` / `confidence?` |
| `StandardDecompositionComponent` 타입 | `wikey-core/src/types.ts:149-153` | staged (v7 §3.1, F3) | `slug` / `type` / `aliases?` (F3 legacy slug 보존) |
| `StandardDecompositionsState` 3-kind union | `wikey-core/src/types.ts:179-182` | staged (v7 §3.2.2 codex Cycle #2 결정) | `empty-explicit` \| `empty-all-skipped` \| `present`. absent = `undefined` 자체 (단일화) |
| `BUILTIN_STANDARD_DECOMPOSITIONS` 상수 | `wikey-core/src/schema.ts:284-307` | staged (v7 §3.1, PMBOK 10 areas + F3 component aliases) | export, F3 `project-schedule-management` aliases `['project-time-management']` + `project-resource-management` aliases `['project-human-resource-management']` |
| `parseSchemaOverrideYaml` (확장) | `wikey-core/src/schema.ts:322-610` | staged (v7 §3.2 — `standard_decompositions:` section 인식) | 4 시나리오 (undefined / empty-explicit / empty-all-skipped / present) 분리 + console.warn spy 가능 |
| `buildStandardDecompositionBlock` 함수 | `wikey-core/src/schema.ts:626-680` | staged (v7 §3.3 — 4 시나리오 분기) | F1 append (`[...BUILTIN..., ...state.items]`) + F3 component aliases 출력 + F5 entity 일반화 |
| `STANDARD_EXCEPTIONS` Set | `wikey-core/src/schema.ts:147` | **갱신 대기 (P3 codex Cycle #2)** | `project-schedule-management` / `project-resource-management` canonical slug 2개 추가 |
| canonicalizer.ts 작업 규칙 #7 | `wikey-core/src/canonicalizer.ts:236` | staged (v7 §3.4 — `decompositionBlock` 변수 + `{{STANDARD_DECOMPOSITION_BLOCK}}` placeholder F4) | PMBOK 10 areas 인라인 제거 + dynamic build |

### 2.2 Stage 2/3/4 가 변경 또는 reference 할 위치

| 항목 | 위치 | 현재 상태 | Stage 변경 영향 |
|---|---|---|---|
| **mention graph 데이터 출처** | `wikey-core/src/canonicalizer.ts:300-340` (`assembleCanonicalResult`) → `CanonicalizedResult { entities, concepts, dropped }` | 매 ingest 시 entity/concept pool + dropped reason 산출. SQLite 영속 X | Stage 2 패턴 탐지 입력. **신규: ingest 결과를 누적 저장하는 mention-history table** (qmd index DB 확장 또는 별도 sqlite). §3.2.1 |
| **ingest-pipeline integration point** | `wikey-core/src/ingest-pipeline.ts:490-494` (`loadSchemaOverride` 호출) | Stage 1 의 schema.yaml 로딩 위치 | Stage 2 가 ingest 후 suggestion 누적 trigger 호출 추가 (§3.2.3). Stage 3 이 section-index "표준 개요" 감지 후 runtime-scope decomposition 주입 (§3.3.2). 시그니처 영향 0 — Stage 2/3 모두 별도 함수로 분리 |
| **Audit panel UI 진입점** | `wikey-obsidian/src/sidebar-chat.ts:783-815` (`openAuditPanel`/`renderAuditSection`) | 현재 = audit-ingest.py JSON 결과 표시 (file table). Stage 2 suggestion 카드는 audit 와 다른 패널 — **신규 패널 "Suggestions"** 추가 (§3.2.4) |
| **`.wikey/schema.yaml` writer 후보** | 현재 = 없음 (사용자가 `SchemaOverrideEditModal` 으로 직접 편집, `wikey-obsidian/src/settings-tab.ts:1185-1227`) | Stage 2 accept 시 **section-range insertion writer** 신규 (§3.2.5, codex Cycle #1 HIGH 후속 v2 정정). yaml 보존 (기존 entries 보존, idempotent). yaml 라이브러리 의존성 추가 거부 (Stage 1 v7 §3.2 minimal subset 정책) — **line-level scan writer** = `standard_decompositions:` 키 위치 + 다음 top-level key 직전까지 section 범위 결정 후 그 안에 line splice. header `[]` (사용자 명시 disable) 인 경우 `header-unsafe` reject. parse 안 함 |
| **`section-index.ts`** | `wikey-core/src/section-index.ts:60-104` (`parseSections`) | H2 section 분할 + heading classifier (`headingPattern` 7 종) | Stage 3 의 "표준 개요" detector 입력. **신규: heading classifier 에 `'standard-overview'` pattern 추가** (§3.3.2) |
| **qmd vector index** | `~/.cache/qmd/index.sqlite` (FTS5 + 벡터 + RRF) | 현재 = 페이지 단위 벡터 (Phase 2~3 산출) | Stage 4 의 cross-source convergence 입력. **신규: mention-level 벡터** 또는 **page-level 벡터의 mention substring match** 둘 중 하나 (§3.4.2). v1 plan 은 page-level 벡터 + LLM arbitration 으로 시작, mention-level granularity 는 v4 deferral |
| **reindex.sh** | `scripts/reindex.sh:1-10` (qmd update + embed + CR + 한국어) | 인덱스 갱신 batch | Stage 4 convergence pass 훅 추가 (§3.4.3). reindex 후 convergence-pass 자동 실행 옵션 (default off) |

### 2.3 mention graph 의 현재 vault 사실 (2026-04-26 snapshot)

- `wiki/concepts/` = 22 개 (PMBOK 10 + RF/MES/PMS 도메인 12)
- `wiki/entities/` = 14 개 (DJI / NanoVNA / Lotus / GoodStream / PMI / etc.)
- `wiki/sources/` = 2 개 (NanoVNA + ?)
- PMBOK umbrella `project-management-body-of-knowledge.md` + 10 component (`project-integration-management.md` … `project-stakeholder-management.md`) = Phase 4 §4.5.1.7.2 hint 산출물
- 두 번째 표준 (ISO 27001 / ITIL 4) 미인제스트 → Stage 1 trigger 미발화

이 vault 가 Stage 2 의 첫 측정 baseline. PMBOK 10 components 만 mention graph 에 누적 → 현 시점에선 Stage 2 의 co-occurrence detector / suffix clustering 둘 다 신규 표준 발견 가능성 0% (PMBOK 1 표준만). Stage 2 의 의미 있는 측정은 **두 번째 표준 (Stage 1 trigger 후 ISO 27001 등) 인제스트 후** 가능.

---

## 3. Stage 별 상세 설계

### 3.1 Stage 1 — Stage 1 v7 plan reference (불변 baseline)

> **단일 소스**: [`plan/phase-5-todox-5.4.1-self-extending.md`](./phase-5-todox-5.4.1-self-extending.md) v7 (codex Cycle #9 APPROVE 직전, 2026-04-26)
>
> **본 §3.1 = todox v7 §3.1~§3.6 의 결정사항 1:1 인용**. Stage 2/3/4 는 본 §3.1 의 결정사항을 **모두 보존** 해야 함. 깨면 회귀.

#### 3.1.1 데이터 모델 (todox v7 §3.1 인용)

**`StandardDecompositionComponent`** (`types.ts:149-153`):
```ts
export interface StandardDecompositionComponent {
  readonly slug: string                            // canonical slug
  readonly type: string                            // F5: 런타임 검증 (getEntityTypes ∪ getConceptTypes)
  readonly aliases?: readonly string[]             // F3: alternate slug (legacy 보존)
}
```

**`StandardDecomposition`** (`types.ts:161-167`):
```ts
export interface StandardDecomposition {
  readonly name: string
  readonly aliases: readonly string[]
  readonly umbrella_slug: string
  readonly components: readonly StandardDecompositionComponent[]
  readonly rule: 'decompose' | 'bundle'
  readonly require_explicit_mention: boolean
  readonly origin?: 'hardcoded' | 'user-yaml' | 'suggested' | 'self-declared' | 'converged'
  readonly confidence?: number
}
```

**`StandardDecompositionsState`** (3-kind union, `types.ts:179-182`):
```ts
export type StandardDecompositionsState =
  | { readonly kind: 'empty-explicit' }                                // YAML: standard_decompositions: []
  | { readonly kind: 'empty-all-skipped'; readonly skippedCount: number }
  | { readonly kind: 'present'; readonly items: readonly StandardDecomposition[] }
```

**`SchemaOverride`** (`types.ts:185-188`):
```ts
export interface SchemaOverride {
  readonly entityTypes: readonly SchemaCustomType[]
  readonly conceptTypes: readonly SchemaCustomType[]
  readonly standardDecompositions?: StandardDecompositionsState   // undefined = absent
}
```

#### 3.1.2 BUILTIN_STANDARD_DECOMPOSITIONS (todox v7 §3.1 인용)

`schema.ts:284-307` — PMBOK 10 areas + F3 component aliases. **export 의무** (Stage 2 가 BUILTIN 위에 user/suggested entries append 할 때 base reference).

#### 3.1.3 parseSchemaOverrideYaml 4 시나리오 (todox v7 §3.2 인용)

| YAML | parser 결과 (`standardDecompositions`) |
|---|---|
| `standard_decompositions:` 키 부재 | `undefined` (absent) |
| `standard_decompositions:` (값 부재, block-empty) 또는 `standard_decompositions: []` (flow style 1 사용처 예외) | `{ kind: 'empty-explicit' }` |
| `standard_decompositions: <list>` + 모든 entry invalid silent skip | `{ kind: 'empty-all-skipped', skippedCount: N }` + `console.warn` |
| `standard_decompositions: <list>` + 일부 valid | `{ kind: 'present', items: [...] }` |

#### 3.1.4 buildStandardDecompositionBlock 4 시나리오 분기 (todox v7 §3.3 인용)

```ts
const state = override?.standardDecompositions
if (state?.kind === 'empty-explicit') return ''   // explicit disable
let decomps: readonly StandardDecomposition[]
if (!state || state.kind === 'empty-all-skipped') {
  decomps = BUILTIN_STANDARD_DECOMPOSITIONS                // undefined / all-skipped → built-in fallback
} else {
  decomps = [...BUILTIN_STANDARD_DECOMPOSITIONS, ...state.items]   // F1 v3 append
}
```

#### 3.1.5 F1 v3 append 정책 (todox v7 §3.1 + §3.5 AC3 인용)

사용자가 ISO-27001 entry 만 추가해도 **PMBOK 자동 유지** (BUILTIN + user append). user 가 PMBOK 끄고 싶으면 `standard_decompositions: []` 명시. v4 한계: user 가 PMBOK 본인 정의로 *교체* 는 미지원 (yaml 한 파일에서 `[]` + entries 동시 표현 불가능, append + first-wins 결합으로 user PMBOK entry drop, todox v7 §3.6 R9).

#### 3.1.6 require_explicit_mention=true hallucination guard (todox v7 §3.1)

default `true`. 본문에 해당 영역이 직접 언급되지 않으면 추출하지 않는다. canonicalizer LLM 이 BUILTIN PMBOK 10 areas 를 추측으로 추출하지 않도록 prompt anchor — `'직접 언급되지 않으면 추출하지 않는다 (hallucination 금지).'` (Stage 1 v7 §3.3 builder pseudocode + AC6.a anchor).

#### 3.1.7 STANDARD_EXCEPTIONS canonical slug (todox v7 §3.5 AC1 P3)

`schema.ts:143` Set 갱신 — `project-schedule-management` / `project-resource-management` 추가. canonical slug 가 functional suffix `-management` 로 끝나서 anti-pattern (canonicalizer.ts) 으로 잡히지 않도록.

#### 3.1.8 Stage 1 acceptance 요약 (todox v7 §3.5 인용)

- **9 AC 합의** (AC1 ~ AC7 + AC5 split + AC6 split)
- **신규 ≥ 19 cases** (AC2 ≥ 9 + AC3 ≥ 5 + AC4 ≥ 2 + AC5.a 1 + AC5.b 1 + AC6.a 1)
- **baseline 보존**: `npm test` ≥ 648 → ≥ 667 PASS / `npm run build` 0 errors
- **AC6.b 라이브 측정**: PMS 5-run Concepts CV ≤ post-change baseline (현재 24.6%). tester 책임.

**본 통합 plan 의 §3.2~§3.4 가 위 1.3.1 ~ 1.3.7 결정사항을 모두 보존하는지** 매 단계 self-check (§9) 의무.

---

### 3.2 Stage 2 — extraction graph 기반 suggestion (detailed)

> **목표**: ingest 결과의 mention graph 를 분석해 "PMBOK 패턴이 N 개 sibling concept 으로 등장" 같은 표준 후보를 자동 탐지 → 사용자 accept 시 schema.yaml 자동 append → Stage 1 의 `BUILTIN + user append` 정책으로 즉시 적용.

#### 3.2.1 데이터 모델

**`Suggestion`** (신규 타입, `wikey-core/src/types.ts` 확장):
```ts
export interface SuggestionEvidence {
  readonly source: string                     // wiki/sources/<source>.md path
  readonly mentions: readonly string[]        // co-occurring mention slugs
  readonly observedAt: string                 // ISO datetime (ingest 시점)
}

export interface Suggestion {
  readonly id: string                         // sha1 of canonical signature (umbrella + sorted components)
  readonly umbrella_slug: string              // 추정된 표준 umbrella (e.g., "iso-27001")
  readonly umbrella_name?: string             // optional human-readable (e.g., "ISO 27001")
  readonly candidate_components: readonly StandardDecompositionComponent[]
  readonly support_count: number              // co-occurrence 발생 source 수
  readonly suffix_score: number               // 0~1 (suffix homogeneity)
  readonly mention_count: number              // 누적 mention 수
  readonly confidence: number                 // 0~1 (combined formula §3.2.2)
  readonly evidence: readonly SuggestionEvidence[]   // 최대 5개 sample
  readonly state: SuggestionState             // 사용자 액션 추적
  readonly createdAt: string                  // ISO datetime
  readonly updatedAt: string
}

export type SuggestionState =
  | { readonly kind: 'pending' }
  | { readonly kind: 'accepted'; readonly acceptedAt: string }
  | { readonly kind: 'rejected'; readonly rejectedAt: string; readonly reason?: string }
  | { readonly kind: 'edited'; readonly userEdits: Partial<StandardDecomposition> }
```

**저장소**: `.wikey/suggestions.json` (신규 file, JSON — yaml 보존 위험 없음). schema:
```jsonc
{
  "version": 1,
  "suggestions": [
    {
      "id": "<sha1>",
      "umbrella_slug": "iso-27001",
      "candidate_components": [
        { "slug": "iso-27001-a-5", "type": "methodology" },
        ...
      ],
      "support_count": 3,
      "suffix_score": 0.85,
      "mention_count": 17,
      "confidence": 0.72,
      "evidence": [
        { "source": "wiki/sources/source-iso-27001-overview.md", "mentions": ["iso-27001-a-5", "iso-27001-a-6"], "observedAt": "2026-05-01T12:34:56Z" }
      ],
      "state": { "kind": "pending" },
      "createdAt": "2026-05-01T12:34:56Z",
      "updatedAt": "2026-05-01T12:34:56Z"
    }
  ],
  "negativeCache": [
    "<sha1 of rejected suggestion 1>",
    ...
  ]
}
```

**negativeCache** = 사용자가 reject 한 suggestion id. 이후 ingest 에서 동일 signature suggestion 재생성 안 함 (§4.5 사용자 거부 흐름).

**`SuggestionStorage`** (신규 모듈, `wikey-core/src/suggestion-storage.ts`):
```ts
export interface SuggestionStorageReader {
  readonly load: () => Promise<SuggestionStore>
}

export interface SuggestionStorageWriter {
  readonly save: (store: SuggestionStore) => Promise<void>
}

export interface SuggestionStore {
  readonly version: 1
  readonly suggestions: readonly Suggestion[]
  readonly negativeCache: readonly string[]
}

// API: pure functions (immutable)
export function addSuggestion(store: SuggestionStore, s: Suggestion): SuggestionStore
export function updateSuggestionState(store: SuggestionStore, id: string, state: SuggestionState): SuggestionStore
export function rejectSuggestion(store: SuggestionStore, id: string, reason?: string): SuggestionStore   // state + negativeCache 모두 업데이트
export function isInNegativeCache(store: SuggestionStore, id: string): boolean
```

#### 3.2.2 패턴 탐지 알고리즘

**입력**: 매 ingest 마다 `CanonicalizedResult` (canonicalizer 산출) — `entities`, `concepts`, `dropped`. 누적 형식 = 신규 sqlite table (또는 `.wikey/mention-history.json`):

```jsonc
{
  "version": 1,
  "ingests": [
    {
      "source": "wiki/sources/source-iso-27001-overview.md",
      "ingestedAt": "2026-05-01T12:00:00Z",
      "concepts": [
        { "slug": "iso-27001-a-5", "type": "methodology" },
        { "slug": "iso-27001-a-6", "type": "methodology" },
        ...
      ],
      "entities": []
    },
    ...
  ]
}
```

본 v1 plan = JSON 으로 시작 (qmd sqlite 확장 X — Surgical). 

**저장소 분리** (codex Cycle #1 U1 결정):
- `.wikey/suggestions.json` — `SuggestionStore` ({ suggestions, negativeCache }) 영구 보존, **rotation 안 함**. negativeCache 가 사용자 reject 영구 의사이므로 오래되어도 보존.
- `.wikey/mention-history.json` — Stage 2 패턴 탐지용 ingest 누적 데이터. **rotation 대상**: 임계 도달 시 oldest dropped (audit log 따로). 임계 = ingest 5000 건 또는 file size 10MB 중 먼저 도달 (alpha default — §3.2.6 baseline calibration 후 조정).
- 임계 초과 시 sqlite migration trigger: file size > 10MB 또는 read/write 시간 > 500ms (Stage 2 v2 플랜, mention-history 만 sqlite 로 이전 — suggestions.json 은 그대로).

**(a) co-occurrence detector**:

같은 source 안에서 N (≥ 3) 개 concept 이 동일 prefix 또는 동일 suffix 로 등장하면 후보. 예:
- `iso-27001-a-5`, `iso-27001-a-6`, `iso-27001-a-7` → prefix `iso-27001-` 공통, suffix `-a-N` 패턴
- `gdpr-principle-1`, `gdpr-principle-2` → prefix `gdpr-principle-` 공통

```ts
function detectCoOccurrence(
  ingest: IngestRecord,
  minSiblings: number = 3,            // 임계: source 안에서 N 개 sibling
  minPrefixLen: number = 5,           // 공통 prefix 최소 길이 (slug char 단위)
): ReadonlyArray<CandidatePattern>
```

**(b) suffix clustering**:

같은 suffix (`-management`, `-control`, `-principle`, `-domain`, `-practice`, `-area`) 가 여러 source 에 걸쳐 동일 base prefix 와 결합되어 등장하면 후보. 예:
- source A 의 `risk-management`, `quality-management` + source B 의 `cost-management`, `procurement-management` → suffix `-management` + 표준 후보 inferred from BUILTIN PMBOK aliases match (= PMBOK already covered, suggestion drop)
- source A 의 `iso-27001-a-5-information-security-policy`, source B 의 `iso-27001-a-12-operational-security` → prefix `iso-27001-` + suffix `-policy/-security` mixed → 표준 후보 `iso-27001`

```ts
function detectSuffixCluster(
  history: IngestRecord[],
  minSources: number = 2,             // 임계: 별 source ≥ 2 에서 등장
  suffixWhitelist: ReadonlyArray<string> = ['-management', '-control', '-principle', '-domain', '-practice', '-area'],
): ReadonlyArray<CandidatePattern>
```

**(c) confidence score formula**:

```ts
function computeConfidence(p: CandidatePattern): number {
  const support = Math.min(p.support_count / 5, 1.0)              // 최대 5 source 에서 등장 = 1.0
  const suffix_homogeneity = p.unique_suffixes <= 1 ? 1.0 : 0.5   // 단일 suffix → 1.0, 여러 → 0.5
  const mention_density = Math.min(p.mention_count / 20, 1.0)     // 누적 mention ≥ 20 = 1.0
  const builtinOverlap = p.overlapsWithBuiltin ? 0.0 : 1.0        // BUILTIN 과 중복 시 0 (drop)
  return 0.4 * support + 0.3 * suffix_homogeneity + 0.2 * mention_density + 0.1 * builtinOverlap
}
```

**임계** (codex Cycle #1 U5 결정 — alpha default + baseline calibration 의무): `confidence ≥ 0.6` 일 때만 suggestion 생성. 0.6 미만 = silent drop (overhead 회피). **본 임계 + minSiblings ≥ 3 + minSources ≥ 2 모두 alpha default — 측정 데이터 없이 임의값**. Stage 2 alpha 단계 (cycle #2~#6 구현 + 라이브 검증 후) baseline calibration 필수: false positive rate / false negative rate 측정 → hardening 임계 결정 → v2 plan 또는 본 v2 부록에 영구 등록. 그 전까지 임계 hardening 금지 (premature optimization 회피).

**선택 이유**:
- 0.4 * support: 가장 강한 신호 (cross-source 누적 = 사람이 봐도 신뢰)
- 0.3 * suffix_homogeneity: 단일 suffix = 표준다운 패턴
- 0.2 * mention_density: 충분히 자주 등장하는지
- 0.1 * builtinOverlap: BUILTIN 과 겹치면 drop (PMBOK 등 이미 적용)

**false positive 방지** (§3.2.6 와 연계):
- BUILTIN PMBOK 의 component slug 와 substring match → suggestion drop
- marketing 카피 distinguish: section index `headingPattern === 'normal'` 인 section 안 mention 만 신뢰. `headingPattern === 'toc'` 등 보조 section mention 은 weight 0.

#### 3.2.3 Suggestion 생성 trigger

**옵션 A**: ingest 직후 동기 (`ingest-pipeline.ts:494` 근처에서 `loadSchemaOverride` 다음에 `analyzeForSuggestions(history, current)` 호출).

**옵션 B**: 별 batch (예: reindex.sh 실행 시).

**v1 plan 결정 = 옵션 A (ingest 직후 동기)** — 이유:
- 사용자가 ingest 직후 Audit panel 에서 즉시 suggestion 카드 확인 가능 (UX)
- batch 도입 시 별도 schedule 인프라 필요 (Surgical 위반)
- ingest 1 건당 분석 비용 = O(N concepts × M history sources) = N=20, M=100 → 2K 비교 = 100ms 이내

**구현 위치**: `ingest-pipeline.ts` 의 finalize 단계에서 `appendIngestHistory(current)` + `runSuggestionAnalysis(history)` + `savePendingSuggestions(suggestions)`. ingest 의 critical path 가 100ms 정도 늘어남 (acceptable).

#### 3.2.4 Audit UI suggestion 카드

**위치**: `wikey-obsidian/src/sidebar-chat.ts` 에 신규 panel `'suggestions'` 추가 (현 panel: ingest / audit / chat). header button 신규 — `🔔 Suggestions (N)` (N = pending suggestion 수, badge 표시).

**카드 UI**:
```
┌──────────────────────────────────────────────────┐
│ 🔔 표준 분해 후보 (confidence 0.72)              │
│                                                  │
│ ISO 27001 패턴 감지 (3 source 에서 17 mention)   │
│ - iso-27001-a-5-information-security-policy      │
│ - iso-27001-a-6-organization                     │
│ - iso-27001-a-12-operational-security            │
│ - ... (5 more)                                   │
│                                                  │
│ Evidence:                                        │
│ - source-iso-27001-overview.md (8 mentions)      │
│ - source-iso-27001-controls-detail.md (7)        │
│ - source-iso-27001-audit-checklist.md (2)        │
│                                                  │
│ [Accept] [Edit] [Reject]                         │
└──────────────────────────────────────────────────┘
```

**액션 핸들러**:
- **Accept**: `appendToSchemaYaml(suggestion)` → `updateSuggestionState({kind:'accepted'})` → 카드 제거
- **Edit**: `SuggestionEditModal` 열기 — 사용자가 umbrella name / aliases / require_explicit_mention 등 수정. Save 시 accept 동등.
- **Reject**: 사용자가 reason 입력 (선택) → `rejectSuggestion()` (state + negativeCache 모두 업데이트). 카드 제거.

**현재 Audit panel 와의 관계**: Audit panel 은 file ingest status 표시 (audit-ingest.py JSON). Suggestion panel 은 별도 — 둘 다 sidebar 의 sub-panel.

#### 3.2.5 schema.yaml writer (idempotent + comment 보존 + section-range insertion)

**제약** (Stage 1 v7 §3.2 minimal YAML subset 정책):
- yaml 라이브러리 의존성 추가 금지
- 기존 entries 보존 (사용자 수동 편집 손상 X)
- comment 보존 (사용자 주석 무시 X)
- idempotent (같은 suggestion 두 번 accept 해도 한 번만 추가)

**전략**: **section-range insertion writer** (parse 안 함, line-level scan, codex Cycle #1 HIGH issue 해소). header 형태별 분기 + section 범위 결정 (다음 top-level key 직전까지) 후 그 안에 insert.

```ts
// wikey-core/src/schema-yaml-writer.ts (신규 모듈)

export async function appendStandardDecomposition(
  wikiFS: WikiFS,
  suggestion: Suggestion,
): Promise<{ appended: boolean; reason?: 'already-exists' | 'header-unsafe' }> {
  const path = '.wikey/schema.yaml'
  let content = await wikiFS.read(path).catch(() => '')

  // (a) idempotency check: 같은 umbrella_slug 가 이미 있으면 skip
  const marker = `umbrella_slug: ${suggestion.umbrella_slug}`
  if (content.includes(marker)) {
    return { appended: false, reason: 'already-exists' }
  }

  const block = formatSuggestionAsYaml(suggestion, /* indent */ 2)
  const lines = content.split('\n')

  // (b) standard_decompositions: 키 위치 찾기 (top-level only — column 0)
  let stdIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (/^standard_decompositions\s*:/.test(lines[i])) { stdIdx = i; break }
  }

  // (c) 키 부재 → EOF 위치에 신규 standard_decompositions section 생성 (다른 top-level section 과 분리, 충돌 없음)
  if (stdIdx === -1) {
    if (content.length > 0 && !content.endsWith('\n')) content += '\n'
    content += '\nstandard_decompositions:\n' + block
    if (!content.endsWith('\n')) content += '\n'
    await wikiFS.write(path, content)
    return { appended: true }
  }

  // (d) header 형태 분기: empty-explicit `[]` 인 경우 → 사용자 명시 disable, reject
  //     (사용자 의도 명시 disable 을 자동 등록이 무시하면 안 됨 — §4.5 사용자 거부 흐름)
  if (/^standard_decompositions\s*:\s*\[\s*\]\s*$/.test(lines[stdIdx])) {
    return { appended: false, reason: 'header-unsafe' }
  }

  // (e) section 범위 결정: stdIdx+1 ~ 다음 top-level key (column 0 시작 alphabetic) 또는 EOF
  //     YAML 들여쓰기 규칙 — top-level 다음 column 0 alphabetic = 새 section
  let sectionEnd = lines.length
  for (let i = stdIdx + 1; i < lines.length; i++) {
    if (/^[a-zA-Z_]/.test(lines[i])) { sectionEnd = i; break }
  }

  // (f) section 끝 직전에 block insert (다음 top-level 직전, 또는 EOF)
  const blockLines = block.replace(/\n+$/, '').split('\n')
  lines.splice(sectionEnd, 0, ...blockLines)
  content = lines.join('\n')
  if (!content.endsWith('\n')) content += '\n'

  await wikiFS.write(path, content)
  return { appended: true }
}

function formatSuggestionAsYaml(s: Suggestion, indent: number): string {
  const pad = ' '.repeat(indent)
  const lines: string[] = []
  lines.push(`${pad}- name: ${s.umbrella_name ?? s.umbrella_slug}`)
  lines.push(`${pad}  umbrella_slug: ${s.umbrella_slug}`)
  lines.push(`${pad}  rule: decompose`)
  lines.push(`${pad}  require_explicit_mention: true`)
  lines.push(`${pad}  origin: suggested`)
  lines.push(`${pad}  confidence: ${s.confidence.toFixed(2)}`)
  lines.push(`${pad}  components:`)
  for (const c of s.candidate_components) {
    lines.push(`${pad}    - slug: ${c.slug}`)
    lines.push(`${pad}      type: ${c.type}`)
    if (c.aliases && c.aliases.length > 0) {
      lines.push(`${pad}      aliases:`)
      for (const a of c.aliases) lines.push(`${pad}        - ${a}`)
    }
  }
  return lines.join('\n') + '\n'
}
```

**한계** (v2 — section-range insertion 정책 반영):
- comment 위치 보존 = section-range insertion writer 가 `standard_decompositions:` 다음 top-level key 직전 line splice 하므로 section 밖 comment (다른 top-level section 이전) 는 손상 X. 단 `standard_decompositions:` section 안 inline comment 가 있을 경우 신규 entry 가 그 comment 와 다음 entry 사이에 splice 될 수 있음 (comment 의 의미 부분 보존되나 위치 이동 가능). v2 한계 — 사용자에게 "suggestion accept 가 standard_decompositions section 끝에 splice 한다" 명시.
- header `[]` 인 경우 (사용자 명시 disable) reject — `header-unsafe` reason 반환. 사용자가 schema.yaml 의 `[]` 를 비우거나 entry 형태로 변경해야 자동 등록 진행 (사용자 명시 disable 의도 보호).
- yaml syntax 정확성 = formatter 가 deterministic + 단순 (indent 2-space). yamllint 권장. parser 가 잘못된 indent 발견 시 silent skip + warn (Stage 1 v7 §3.2.3).

**대안 검토 — 폐기**:
- yaml 라이브러리 (예: `yaml`) 도입 → Stage 1 v7 §3.2 의 "minimal YAML subset" 정책 위배. 라이브러리는 모든 yaml feature 처리하지만, wikey 의 정책은 "최소 subset 만 인식" 이라 일관성 깨짐.
- AST-level merge → comment 위치 정확히 보존 가능하지만 complexity ↑ (Karpathy Simplicity First 위반).

#### 3.2.6 false positive 방지

**위험**: marketing 카피의 feature 리스트가 표준처럼 분류될 가능성 (예: "우리 제품의 5 핵심 기능: feature-a, feature-b, ..." → suffix `-a/-b` 패턴이 false positive).

**완화**:
- (a) **임계 조정**: confidence ≥ 0.6 (§3.2.2). 이하 silent drop.
- (b) **suffix whitelist**: `['-management', '-control', '-principle', '-domain', '-practice', '-area']` 외 suffix 는 0.5 weight. marketing 의 `-feature` `-benefit` `-value` 는 미포함.
- (c) **사용자 accept 필수**: 자동 schema.yaml append 금지. 모든 suggestion = pending state.
- (d) **negativeCache**: reject 한 suggestion 은 동일 signature 로 재생성 안 됨.
- (e) **section 가중**: `section-index.headingPattern === 'normal'` 인 section 안 mention 만 weight 1.0. `'toc' / 'appendix' / 'contact' / 'revision' / 'copyright'` 인 section 은 weight 0 (carve out).

**측정**: §5 AC2~AC8 의 unit test fixture (PMBOK 실측 + ISO-27001 실측 + marketing 코퍼스 실측) → false positive rate < 10% 목표.

#### 3.2.7 Stage 1 와 통합

**핵심 정책**: Stage 2 가 schema.yaml 에 append 한 entry 는 Stage 1 의 `parseSchemaOverrideYaml` 가 즉시 파싱 → `BUILTIN + user append` 정책 (Stage 1 v7 §3.1.5) 으로 PMBOK + 신규 표준 둘 다 prompt 출력.

**충돌 시**:
- (a) component slug 충돌: Stage 1 v7 §3.2.3 의 "first-wins" 정책 적용 — BUILTIN 우선 (`BUILTIN_STANDARD_DECOMPOSITIONS` 가 spread 의 앞).
- (b) umbrella_slug 충돌: Stage 2 의 `appendStandardDecomposition` idempotency check (substring match) 로 자동 skip.

**`origin` 필드**:
- Stage 2 가 append 하는 entry = `origin: 'suggested'` + `confidence: <score>` 명시. 사용자는 schema.yaml 에서 origin 으로 출처 구분 가능.

#### 3.2.8 Stage 2 → Stage 3 데이터 흐름

Stage 3 의 in-source self-declaration (§3.3) 이 발견한 표준이 이미 Stage 2 suggestion 으로 등장한 경우:
- (a) 같은 umbrella_slug 의 suggestion 이 이미 pending → Stage 3 은 신규 suggestion 생성 안 함, 기존 suggestion 의 evidence 에 추가 (`evidence.push(new SuggestionEvidence)`)
- (b) 같은 umbrella_slug 의 suggestion 이 negativeCache → Stage 3 도 silent drop (사용자가 거부한 표준)
- (c) 같은 umbrella_slug 의 suggestion 이 accepted → Stage 1 schema.yaml entry 에 이미 존재 → Stage 3 은 runtime-scope decomposition 생성 안 함 (이미 지속 적용)

**충돌 방지 함수**:
```ts
function shouldStage3ProposeRuntime(
  store: SuggestionStore,
  umbrella_slug: string,
): boolean {
  const matching = store.suggestions.find((s) => s.umbrella_slug === umbrella_slug)
  if (!matching) return true                              // 신규 후보 → Stage 3 생성 OK
  if (matching.state.kind === 'accepted') return false    // 이미 accepted → schema.yaml 에 있음
  if (matching.state.kind === 'rejected') return false    // 사용자 거부 → silent drop
  return true                                              // pending / edited → Stage 3 evidence 추가만
}
```

---

### 3.3 Stage 3 — in-source self-declaration (detailed)

> **목표**: 소스 본문이 "이 표준은 다음 N 영역을 갖습니다: A, B, C..." 같이 enumerate 하면 `section-index.ts` 가 "표준 개요" 섹션을 감지 → structured decomposition extraction → runtime-scope (해당 ingest 세션만) 또는 사용자 승인 후 persist.

#### 3.3.1 데이터 모델

**`SelfDeclaration`** (신규 타입):
```ts
export interface SelfDeclaration {
  readonly umbrella_slug: string                              // detected 표준 umbrella
  readonly umbrella_name: string                              // 본문에서 추출한 display name
  readonly components: readonly StandardDecompositionComponent[]
  readonly rule: 'decompose' | 'bundle'
  readonly require_explicit_mention: boolean                  // default true
  readonly source: string                                     // wiki/sources/<source>.md path
  readonly section_idx: number                                // section-index.ts 의 idx (provenance)
  readonly section_title: string
  readonly extractor: 'pattern-matching' | 'llm'              // 알고리즘 출처 (§3.3.2)
  readonly extractedAt: string                                // ISO datetime
  readonly persistChoice: SelfDeclarationPersistChoice        // §3.3.3
}

export type SelfDeclarationPersistChoice =
  | { readonly kind: 'runtime-only' }                         // 해당 ingest 세션만
  | { readonly kind: 'pending-user-review' }                  // 사용자 승인 대기 (modal)
  | { readonly kind: 'persisted'; readonly persistedAt: string }   // schema.yaml append 완료
```

**`Provenance`** (Phase 4 §4.3.2 와 연계, 본 plan 안에서는 metadata 만):
```ts
// SelfDeclaration 자체에 source + section_idx + extractedAt 모두 포함 = provenance
// Phase 4 §4.3.2 가 구현되면 그 인프라 사용. 본 v1 plan 은 inline metadata 로 충분.
```

**저장소**: runtime-only 는 메모리만 (ingest session 종료 시 GC). pending-user-review 는 `.wikey/self-declarations.json` (suggestions 와 별 file). persisted = schema.yaml append (Stage 2 와 동일 writer).

#### 3.3.2 알고리즘

**(a) "표준 개요" detector** (`section-index.ts` 확장):

`headingPattern` 7 종 (`'toc' | 'appendix' | 'contact' | 'revision' | 'copyright' | 'normal'` + 신규 `'standard-overview'`) 으로 확장. 신규 classifier:

```ts
function classifyHeadingPattern(title: string): HeadingPattern {
  // ... 기존 분기 ...

  // §5.4 Stage 3: 표준 개요 detection
  // 한국어/영어 표준 keyword + 분해 표현
  const normalized = title.toLowerCase().trim()
  const standardKeywords = [
    /개요|overview|introduction/,
    /구조|structure|architecture/,
    /구성|composition/,
    /영역|domain|area/,
    /지식체계|body of knowledge/,
    /knowledge\s+area/,
  ]
  const hasStandardKeyword = standardKeywords.some((re) => re.test(normalized))

  // 추가 조건: 본문에 enumerate 형식 (numbered list / bullet list ≥ 5 items)
  // 이 조건은 classifyHeadingPattern 에서 검사 X (title 만 입력) — 별도 후처리에서 검사
  if (hasStandardKeyword) return 'standard-overview'
  return 'normal'
}
```

**(b) structured decomposition extractor**:

`headingPattern === 'standard-overview'` section 에 대해:

**옵션 (i) deterministic pattern matching** (default, LLM 호출 없음):
- section body 에서 numbered list (`^\d+\.\s+`) 또는 bullet list (`^-\s+`) ≥ 5 items 검색
- list item text → slug 변환 (`canonicalizeSlug`)
- list item ≥ 5 + 모두 같은 slug prefix 또는 같은 slug pattern → SelfDeclaration 후보

**옵션 (ii) LLM 호출** (옵션, expensive):
- section body 를 LLM 에 보내 "이 섹션이 정의하는 표준 영역의 slug 리스트를 추출하라" prompt
- 비용 ↑, 정확도 ↑. v1 plan = (i) deterministic 만 구현. (ii) 는 v2 deferral.

```ts
function extractSelfDeclaration(
  section: Section,
  source: string,
  options: { llm?: false } = {},
): SelfDeclaration | null {
  if (section.headingPattern !== 'standard-overview') return null

  // (i) deterministic extractor
  const lines = section.body.split('\n')
  const listItems: string[] = []
  for (const line of lines) {
    const m = line.match(/^(?:\d+\.|\-)\s+(.+?)(?:\s*[\(\[].*)?$/)
    if (m) listItems.push(m[1].trim())
  }
  if (listItems.length < 5) return null                          // 임계: ≥ 5 items

  // umbrella_slug 추론: section title 에서 표준 이름 추출
  const umbrellaName = inferUmbrellaName(section.title)         // e.g., "ISO 27001"
  const umbrellaSlug = canonicalizeSlug(umbrellaName)            // "iso-27001"

  const components: StandardDecompositionComponent[] = listItems.map((item) => ({
    slug: canonicalizeSlug(item),
    type: 'methodology',                                          // default — Stage 3 v1 은 single type
  }))

  return {
    umbrella_slug: umbrellaSlug,
    umbrella_name: umbrellaName,
    components,
    rule: 'decompose',
    require_explicit_mention: true,
    source,
    section_idx: section.idx,
    section_title: section.title,
    extractor: 'pattern-matching',
    extractedAt: new Date().toISOString(),
    persistChoice: { kind: 'runtime-only' },                     // default, §3.3.3 에서 elevation
  }
}
```

#### 3.3.3 runtime-scope vs persist 결정

**Decision tree**:
1. **runtime-only** (default) — SelfDeclaration 생성 즉시. 해당 ingest 세션의 `schemaOverride.standardDecompositions` 에 inject (BUILTIN + user yaml + runtime self-declared 모두 append). 세션 종료 시 GC.
2. **pending-user-review** — 같은 source 가 두 번째 ingest (re-ingest) 시 자동 elevation. `.wikey/self-declarations.json` 저장. Audit panel 에서 사용자 review modal 등장.
3. **persisted** — 사용자 review modal 에서 accept 시 `appendStandardDecomposition` (§3.2.5) 호출. 이후 BUILTIN + user yaml + persisted self-declared = 모두 같은 schema.yaml 안.

**왜 자동 persist X**:
- false positive 위험 (marketing 자료 본문이 enumerate 형태로 표준처럼 보일 가능성 — §3.3.5)
- 사용자 직접 수정 권한 보존 (Karpathy "AI's knowledge is yours")
- runtime-scope 로 충분한 use case (대부분 ingest 1 회 + 결과 검토)

**Stage 1 와의 통합** — runtime-scope 의 schemaOverride 주입:

```ts
// ingest-pipeline.ts 의 canonicalizer 호출 직전
const schemaOverride = await loadSchemaOverride(wikiFS).catch(() => null) ?? undefined
const selfDeclarations = collectRuntimeSelfDeclarations(sectionIndex, sourcePath)
                        // = 본 ingest 세션의 SelfDeclaration[] (persistChoice: 'runtime-only')

const effectiveOverride = mergeRuntimeIntoOverride(schemaOverride, selfDeclarations)
// effectiveOverride.standardDecompositions = (BUILTIN ∪ user yaml ∪ runtime) all-append
// 동일 umbrella_slug 충돌 시: user yaml > runtime > BUILTIN (first-wins 의 reverse)
//   — runtime self-declared 가 user 명시 yaml 보다 약함 (§4.4 fallback chain)

const result = await canonicalize({ ..., schemaOverride: effectiveOverride })
```

**`mergeRuntimeIntoOverride`** (신규 helper):
```ts
function mergeRuntimeIntoOverride(
  override: SchemaOverride | undefined,
  runtime: readonly SelfDeclaration[],
): SchemaOverride | undefined {
  if (runtime.length === 0) return override
  const runtimeItems: StandardDecomposition[] = runtime.map((sd) => ({
    name: sd.umbrella_name,
    aliases: [],
    umbrella_slug: sd.umbrella_slug,
    components: sd.components,
    rule: sd.rule,
    require_explicit_mention: sd.require_explicit_mention,
    origin: 'self-declared' as const,
  }))

  const baseState = override?.standardDecompositions
  let newItems: StandardDecomposition[]
  if (!baseState || baseState.kind === 'empty-all-skipped') {
    newItems = runtimeItems                                     // BUILTIN 은 builder 가 add (Stage 1 v7 §3.3)
  } else if (baseState.kind === 'empty-explicit') {
    return override                                              // 명시 disable — runtime 도 무시 (사용자 의도 보존)
  } else {
    newItems = [...baseState.items, ...runtimeItems]            // user yaml + runtime append
  }

  return {
    entityTypes: override?.entityTypes ?? [],
    conceptTypes: override?.conceptTypes ?? [],
    standardDecompositions: { kind: 'present', items: newItems },
  }
}
```

**중요**: `empty-explicit` 시 runtime 도 무시 — 사용자가 PMBOK 등 모든 분해를 명시 disable 한 상태이면 self-declaration 도 적용 X (의도 보존). `empty-all-skipped` 시 runtime 만 (BUILTIN 은 builder 가 add).

#### 3.3.4 Stage 2 suggestion 과 충돌 처리

§3.2.8 의 `shouldStage3ProposeRuntime` 함수가 결정. 흐름:

1. SelfDeclaration 생성 직전, suggestion store load
2. `shouldStage3ProposeRuntime(store, sd.umbrella_slug)`:
   - 기존 pending suggestion 있음 → SelfDeclaration evidence 만 suggestion.evidence 에 추가, runtime SelfDeclaration 도 적용
   - rejected suggestion (negativeCache) → SelfDeclaration silent drop
   - accepted suggestion → SelfDeclaration silent drop (이미 schema.yaml 에 있음)
   - 신규 → SelfDeclaration runtime-scope 적용 + suggestion store 에 신규 record (origin: 'self-declared') 추가

#### 3.3.5 false positive 방지

**위험**: marketing 자료의 "5 가지 핵심 기능" 같은 list 가 표준 후보로 잡힐 가능성.

**완화** (Stage 2 §3.2.6 와 동일 + 추가):
- (a) "표준 개요" classifier 의 keyword 가 marketing-specific term 미포함 (`feature`, `benefit`, `핵심 기능` 등 제외)
- (b) section body enumerate ≥ 5 items 임계 (4 이하 = silent drop)
- (c) component slug 길이 ≥ 5 chars (짧은 slug = false positive 위험)
- (d) **default = runtime-only** (persist 자동 X). 사용자 review modal 까지 시간 buffer.
- (e) Phase 4 §4.3.2 provenance tracking 연계 — section_idx 로 출처 추적 가능, 사용자가 의심 시 source 본문 직접 확인 가능

#### 3.3.6 Stage 3 → Stage 4 데이터 흐름

Stage 4 cross-source convergence (§3.4) 가 분석할 mention graph 에 Stage 3 의 SelfDeclaration 도 포함. Stage 3 가 source A 에서 발견한 ISO-27001 5 components + Stage 4 가 source B 에서 다른 5 components 발견 → Stage 4 LLM arbitration 으로 union (10 components) 추론 → ConvergedDecomposition 생성.

Stage 3 → Stage 4 인터페이스:
- Stage 3 SelfDeclaration 이 mention-history 에 누적 (`origin: 'self-declared'` 표시)
- Stage 4 의 cluster 알고리즘이 mention-history 전체 (suggestions accepted + self-declarations + 일반 mentions) 분석

---

### 3.4 Stage 4 — cross-source convergence (detailed)

> **목표**: 여러 소스가 같은 표준을 다른 각도에서 언급 → wiki 전체 mention graph 를 batch 분석해 canonical decomposition 을 LLM arbitration 으로 inference. Stage 1+2+3 까지의 결정 위에 cross-source 통합 layer.

#### 3.4.1 데이터 모델

**`ConvergedDecomposition`** (신규 타입):
```ts
export interface SourceMention {
  readonly source: string
  readonly mentioned_components: readonly string[]    // slugs
  readonly is_umbrella_only: boolean                  // umbrella 만 언급, components 없음
}

export interface ConvergedDecomposition {
  readonly umbrella_slug: string
  readonly umbrella_name: string
  readonly converged_components: readonly StandardDecompositionComponent[]
  readonly source_mentions: readonly SourceMention[]                    // 어느 source 가 어느 components 언급
  readonly arbitration_method: 'union' | 'llm'                          // §3.4.2
  readonly arbitration_confidence: number                               // 0~1 (LLM 일 경우 LLM self-report)
  readonly arbitration_log?: string                                     // LLM 호출 시 prompt + response 요약
  readonly convergedAt: string                                          // ISO datetime
}
```

**저장소**: `.wikey/converged-decompositions.json` (별 file). 사용자 review modal 에서 accept 시 schema.yaml append (Stage 2 writer 재사용).

#### 3.4.2 알고리즘

**(a) mention graph clustering** (qmd vector index 활용):

```ts
// mention-history.json 의 모든 ingest 결과 → page-level vector cluster
// embeddings 는 alpha v1 wire 로 외부에서 inject (post-impl Cycle #2 F4 fix — §3.4.3 alpha v1 wire 참조)
// cluster algorithm: simple agglomerative + cosine similarity threshold ≥ 0.75
// post-impl Cycle #3 F4 fix: singleton (mention_slugs.length < 2) cluster drop — graceful skip 계약

function clusterMentionsAcrossSources(
  history: readonly IngestRecord[],
  embeddings: ReadonlyMap<string, readonly number[]>,
): ReadonlyArray<MentionCluster> {
  // 1. 모든 unique mention slug 수집
  // 2. embeddings Map 에서 각 slug 의 vector lookup (외부 도구 inject — qmd vsearch / sqlite3 / Python helper / qmd MCP)
  // 3. cluster (cosine ≥ 0.75)
  // 4. cluster 안 ≥ 3 source 에 등장 + mention_slugs.length ≥ 2 (singleton drop) 이면 ConvergedDecomposition 후보
}

interface MentionCluster {
  readonly cluster_id: string
  readonly mention_slugs: readonly string[]
  readonly source_count: number
  readonly mention_count: number
}
```

**v1 plan 한계** (codex Cycle #1 U3 결정 — alpha 명시): page-level 벡터만 사용. mention-level granularity (각 mention 의 context window embedding) 는 v2 deferral. **본 Stage 4 정확도 = alpha / page-level-limited** — false convergence 위험 존재 (다른 표준이 같은 page 에 우연히 co-occur 시), arbitration_confidence 임계 + 사용자 review modal 이 필수 guard. mention-level 정확도는 v2 영역. **이유**: qmd index 가 page-level. mention-level 추가 = 인덱싱 비용 ↑ + 새 데이터 schema 필요.

**(b) LLM arbitration**:

cluster 의 mention slugs + 각 slug 의 source context (wiki page snippet) 를 LLM 에 보내:

```
prompt: """
다음은 mention graph 의 한 cluster 입니다. 같은 표준의 다른 측면일 가능성이 높습니다.

cluster mentions:
- iso-27001-a-5-information-security-policy (source A 에서 언급)
- iso-27001-a-6-organization (source A 에서 언급)
- iso-27001-a-12-operational-security (source B 에서 언급)
- ...

각 mention 의 source context:
[source A snippet ...]
[source B snippet ...]

질문: 이 cluster 가 같은 표준 (umbrella) 의 components 인지 판정하고, 그렇다면:
  1. umbrella name (e.g., "ISO 27001")
  2. canonical umbrella slug (e.g., "iso-27001")
  3. 각 component 의 type (entity / concept)
  4. arbitration_confidence (0~1)
  5. arbitration_reasoning (1-2 문장)

JSON 으로 답변:
{
  "is_standard": true | false,
  "umbrella_name": "...",
  "umbrella_slug": "...",
  "components": [{"slug":"...", "type":"..."}],
  "arbitration_confidence": 0.0~1.0,
  "arbitration_reasoning": "..."
}
"""
```

**LLM 응답 → `ConvergedDecomposition` mapping** (codex Cycle #2 HIGH 정정 — TS 타입과 LLM JSON 계약 일관):
```ts
// arbitrate() 안에서 LLM JSON 응답 → ConvergedDecomposition 변환
const llmJson = await callLLM(promptText)
const parsed = JSON.parse(llmJson)  // schema validation 권장
return {
  umbrella_slug: parsed.umbrella_slug,
  umbrella_name: parsed.umbrella_name,
  converged_components: parsed.components,
  source_mentions: cluster.mentions,
  arbitration_method: 'llm',
  arbitration_confidence: parsed.arbitration_confidence,  // ← 필드명 일관 (cycle #1 Issue 2)
  arbitration_log: parsed.arbitration_reasoning,
  convergedAt: new Date().toISOString(),
}
```

**arbitration_confidence ≥ 0.7** 일 때만 사용자 review modal 등장 (line 909 의 `result.arbitration_confidence >= 0.7` 분기). 미만 silent drop.

**v1 plan 옵션 (b) 결정 = LLM arbitration enabled but optional**:
- default = `union` 알고리즘 (LLM 호출 없음, 비용 0)
- `--arbitration llm` flag 또는 settings 로 enable 시 LLM 호출
- LLM 비용 = qmd convergence pass 1 회 당 < 50K tokens 임계 (Stage 1 v7 §4.3 와 일관)

#### 3.4.3 reindex.sh batch job 통합

**기존 reindex.sh 흐름**:
1. qmd update (파일 스캔)
2. qmd embed (벡터 임베딩)
3. CR (contextual retrieval prefix)
4. 한국어 토큰화

**Stage 4 추가 — convergence pass 훅** (default off, opt-in):

```bash
# scripts/reindex.sh 끝에 추가
if [ "$WIKEY_CONVERGENCE_ENABLED" = "true" ]; then
  echo "→ §5.4.4 convergence pass 실행"
  node "$PROJECT_DIR/wikey-core/dist/scripts/run-convergence-pass.mjs" \
    --history "$WIKI_DIR/.wikey/mention-history.json" \
    --qmd-db "$HOME/.cache/qmd/index.sqlite" \
    --output "$WIKI_DIR/.wikey/converged-decompositions.json" \
    --arbitration "${WIKEY_ARBITRATION_METHOD:-union}" \
    --token-budget "${WIKEY_CONVERGENCE_TOKEN_BUDGET:-50000}" \
    ${WIKEY_CONVERGENCE_EMBEDDINGS:+--embeddings "$WIKEY_CONVERGENCE_EMBEDDINGS"}
fi
```

**alpha v1 wire 명시** (post-impl Cycle #2 F4 fix):
- v1 acceptance: `--embeddings <json-path>` 인자로 외부 도구가 미리 계산한 mention-slug → vector dump 를 inject. dump 형식: `{ "<slug>": [number, ...], ... }`. 환경변수 `WIKEY_CONVERGENCE_EMBEDDINGS` 로 reindex.sh hook 에 forward.
- 외부 도구 후보 (사용자 환경 책임): qmd vsearch 결과 변환 / sqlite3 CLI 직접 query / Python 헬퍼 / qmd MCP server. 어느 도구든 위 JSON 형식으로 export 가능하면 즉시 plug-in.
- v2 deferral: qmd-db 직접 query 통합 (sqlite3 subprocess 또는 sqlite-vec extension load). v1 은 advisory 인자로만 보존.
- `--embeddings` 미지정 시: 빈 Map → cluster 0 → graceful skip + warn. 사용자에게 "no embeddings provided, alpha v1 — external dump required" 알림.

신규 script `wikey-core/scripts/run-convergence-pass.mjs` — entry point (post-impl Cycle #2 F4 alpha v1 wire 갱신):
```ts
// args 파싱 → mention-history load → embeddings JSON load (옵션) → cluster → arbitration → save
async function main() {
  const config = createConvergencePass(process.argv.slice(2))
  const history = await loadHistoryJson(config.history)

  // alpha v1 wire: 외부 도구 dump 한 JSON 을 Map<slug, vec> 으로 inject. 미지정/load 실패 시 빈 Map.
  const embeddings = new Map<string, readonly number[]>()
  if (config.embeddings) {
    try {
      const parsed = JSON.parse(await fs.readFile(config.embeddings, 'utf-8'))
      for (const [slug, vec] of Object.entries(parsed)) {
        if (Array.isArray(vec) && vec.every((n) => typeof n === 'number')) embeddings.set(slug, vec)
      }
    } catch (err) { console.warn(`embeddings load failed: ${err.message}`) }
  }

  // empty embeddings → singleton clusters → drop (post-impl Cycle #3 F4 fix). graceful skip.
  const converged = await runConvergencePass(history, {
    arbitration: config.arbitration, tokenBudget: config.tokenBudget, embeddings,
  })
  // runConvergencePass 안: cluster.source_count >= 3 + arbitration_confidence >= 0.7 만 emit
  if (converged.length > 0) await saveConvergedDecompositions(config.output, converged)
}
```

#### 3.4.4 데이터 선결 조건

Stage 4 가 의미 있게 동작하려면:
- (a) mention-history 누적 ≥ 3 표준 × 2 source = 6 instance (Stage 1 v7 §4.3 조건)
- (b) qmd index 가 latest (reindex.sh 직후)
- (c) Phase 4 §4.2.2 URI 기반 안정 참조 완료 (canonical 식별자 보장)

**선결 미충족 시**:
- run-convergence-pass.mjs 는 즉시 exit 0 + warning ("insufficient mention diversity for convergence: N standards × M sources, threshold 3 × 2"). 사용자 보고만, error X.

#### 3.4.5 Stage 1/2/3 결정과 충돌 시 우선순위

**우선순위 (높음 → 낮음)**:

```
1. 사용자 직접 yaml (origin: 'user-yaml')         ← 사용자가 schema.yaml 에 직접 작성
2. 사용자 accepted suggestion (origin: 'suggested', state: accepted)   ← Stage 2 accept 한 entry
3. 사용자 persisted self-declaration (origin: 'self-declared', persisted)   ← Stage 3 persist 한 entry
4. ConvergedDecomposition (origin: 'converged', user-accepted)         ← Stage 4 사용자 accept 한 entry
5. ConvergedDecomposition (origin: 'converged', auto-applied)          ← Stage 4 confidence ≥ 0.9 자동 (v2 deferral, v1 = 사용자 review 필수)
6. SelfDeclaration runtime-only (Stage 3 default)                      ← runtime-scope (세션 한정)
7. BUILTIN_STANDARD_DECOMPOSITIONS (origin: 'hardcoded')                ← Stage 1 default
```

**충돌 처리** (높은 priority 가 낮은 priority overrides):
- 같은 umbrella_slug → 높은 priority 만 prompt 출력
- 같은 component slug 다른 umbrella → first-wins (Stage 1 v7 §3.2.3 규칙) — append 순서가 우선순위 따름
- ConvergedDecomposition 이 user-yaml 과 충돌 → ConvergedDecomposition 적용 안 함 (사용자 의도 보존)

**구현**:
```ts
function mergeAllSources(
  baseOverride: SchemaOverride | undefined,         // user yaml 만 (Stage 1 의 결과)
  acceptedSuggestions: readonly Suggestion[],       // Stage 2 accepted (이미 schema.yaml 에 있음, 중복 제외)
  persistedSelfDeclarations: readonly SelfDeclaration[],   // Stage 3 persisted (이미 schema.yaml 에 있음, 중복 제외)
  convergedAccepted: readonly ConvergedDecomposition[],    // Stage 4 user-accepted (이미 schema.yaml 에 있음)
  runtimeSelfDeclarations: readonly SelfDeclaration[],     // Stage 3 runtime-only
): SchemaOverride | undefined {
  // 우선순위 1~4 는 모두 schema.yaml 에 이미 append 되어 있으므로 baseOverride 에 통합되어 있음
  // 우선순위 6 (runtime-only) 만 별도 inject

  return mergeRuntimeIntoOverride(baseOverride, runtimeSelfDeclarations)   // §3.3.3 helper 재사용
  // BUILTIN (priority 7) 은 buildStandardDecompositionBlock 가 자동 add (Stage 1 v7 §3.3 분기)
}
```

---

## 4. 통합 시나리오 — Stage 1 → 2 → 3 → 4 데이터 흐름

### 4.1 Fresh ingest flow (사용자 vault 가 처음일 때)

**시점 0**: 사용자가 wikey vault 신규 생성. `.wikey/schema.yaml` 미존재. PMBOK 1 corpus (`raw/PMBOK-Guide.pdf`) 만 있음.

```
사용자 → "ingest raw/PMBOK-Guide.pdf" 지시
  ↓
ingest-pipeline.ts:490 loadSchemaOverride(wikiFS) → null (.wikey/schema.yaml 없음)
  ↓
schemaOverride = undefined
  ↓
collectRuntimeSelfDeclarations(sectionIndex, sourcePath) → [] (Stage 3 미발견 — section "표준 개요" 없음 또는 components < 5)
  ↓
mergeRuntimeIntoOverride(undefined, []) → undefined
  ↓
canonicalize({ schemaOverride: undefined })
  ↓
buildStandardDecompositionBlock(undefined) → BUILTIN PMBOK 만 (Stage 1 v7 §3.3 분기 1)
  ↓
prompt 안 작업 규칙 #7 = PMBOK 10 areas
  ↓
LLM canonicalizer → entities + concepts (PMBOK 10 components 모두 추출)
  ↓
finalize: appendIngestHistory(current) + runSuggestionAnalysis(history)
  ↓
Stage 2 runSuggestionAnalysis: PMBOK 10 components 등 검출. 그러나 BUILTIN overlap 0 → confidence drop. suggestion 0건.
  ↓
사용자 → Audit panel 확인. ingest 완료. Suggestions panel = empty.
```

**시점 1**: 사용자가 ISO 27001 corpus 추가 (`raw/ISO-27001-Overview.pdf`). 같은 ingest 명령.

```
사용자 → "ingest raw/ISO-27001-Overview.pdf" 지시
  ↓
ingest-pipeline.ts:490 loadSchemaOverride(wikiFS) → null (여전히 .wikey/schema.yaml 없음)
  ↓
schemaOverride = undefined
  ↓
sectionIndex 분석: ISO-27001 PDF 의 section "ISO 27001 개요" → headingPattern: 'standard-overview'
  ↓
extractSelfDeclaration(section) → SelfDeclaration {
  umbrella_slug: 'iso-27001',
  components: [{ slug: 'iso-27001-a-5-information-security-policy', ... }, ...10 items],
  persistChoice: 'runtime-only',
}
  ↓
collectRuntimeSelfDeclarations → [SelfDeclaration]
  ↓
shouldStage3ProposeRuntime(suggestionStore, 'iso-27001') → true (신규)
  ↓
mergeRuntimeIntoOverride(undefined, [SelfDeclaration]) → SchemaOverride { standardDecompositions: { kind: 'present', items: [SelfDeclaration as StandardDecomposition] } }
  ↓
canonicalize({ schemaOverride: effective })
  ↓
buildStandardDecompositionBlock(effective) → BUILTIN PMBOK + runtime ISO-27001 (F1 append) prompt 출력
  ↓
LLM canonicalizer → entities + concepts (PMBOK 10 + ISO-27001 components 모두 추출)
  ↓
finalize: runSuggestionAnalysis(history)
  ↓
Stage 2 runSuggestionAnalysis: ISO-27001 prefix mention ≥ 3 sources (PMBOK + ISO-27001 자체) → suggestion 후보 1건 생성 (confidence > 0.6).
  ↓
SuggestionStorage 에 누적 (state: 'pending'). negativeCache 미존재 (사용자가 거부한 적 없음).
  ↓
사용자 → Audit panel 확인. Suggestions panel 에 1 카드 (ISO-27001).
  ↓
사용자 → Accept 버튼 click
  ↓
appendStandardDecomposition(suggestion) → .wikey/schema.yaml 신규 생성 + ISO-27001 entry append (origin: 'suggested')
  ↓
SuggestionState → { kind: 'accepted' }
```

**시점 2**: 사용자가 GDPR corpus 추가. 다음 ingest 부터 schema.yaml 의 ISO-27001 entry 가 적용됨 (Stage 1 의 `parseSchemaOverrideYaml` → `'present'` state → builder F1 append).

**시점 N (≥ 3 표준 × 2 source 누적)**: 사용자가 reindex.sh 실행 + `WIKEY_CONVERGENCE_ENABLED=true`:

```
reindex.sh
  ↓
qmd update + embed
  ↓
run-convergence-pass.mjs (--embeddings <json> 외부 inject — alpha v1 wire)
  ↓
clusterMentionsAcrossSources(history, embeddings) → singleton drop + cluster 들 발견
  ↓
각 cluster (≥ 3 source, mention_slugs ≥ 2) → arbitrate(cluster, 'llm', 50K tokens)
  ↓
ConvergedDecomposition 후보 (arbitration_confidence ≥ 0.7) → .wikey/converged-decompositions.json 저장
  ↓
사용자 → Audit panel "Converged" sub-panel (또는 Suggestions panel 의 별 tab) 에서 review
  ↓
사용자 → Accept → appendStandardDecomposition (Stage 2 writer 재사용)
  ↓
이후 ingest 부터 ConvergedDecomposition entry 도 prompt 출력
```

### 4.2 Incremental flow (이미 vault 에 표준 누적 시)

**시점 N**: 사용자 vault 에 PMBOK + ISO-27001 + GDPR + ITIL 4 누적. schema.yaml 에 4 entries (PMBOK 은 BUILTIN 이라 yaml 안 X). suggestion store 에 7 pending (potential 표준 후보).

새 source ingest (`raw/SAFe-Configurations.pdf`):

```
loadSchemaOverride → schema.yaml read → 3 entries (ISO + GDPR + ITIL 4) parse → state.kind='present' items=3
  ↓
sectionIndex 분석 → SAFe section "SAFe 4 Configurations" → 'standard-overview'
  ↓
extractSelfDeclaration → SelfDeclaration { umbrella_slug: 'safe-4-configurations', components: 4 items, runtime-only }
  ↓
shouldStage3ProposeRuntime(store, 'safe-4-configurations') → true (신규, suggestion store 미보유)
  ↓
mergeRuntimeIntoOverride(schemaOverride, [SafeSelfDecl])
  → state = 'present', items = [...3 user yaml entries, SafeSelfDecl as StandardDecomposition]
  ↓
buildStandardDecompositionBlock(merged) → BUILTIN PMBOK + 3 user yaml + 1 runtime (F1 append) prompt 출력
  ↓
LLM canonicalizer → entities + concepts 모두 추출
  ↓
finalize:
  - SafeSelfDecl mention 누적 → 다음 ingest 에서 suggestion 후보 elevation 가능
  - SuggestionStorage 분석: SAFe slug 패턴 발견 → suggestion 신규 생성
```

### 4.3 사용자 vault 수동 편집 흐름

**시점**: 사용자가 schema.yaml 직접 편집 (Modal 또는 외부 editor) — 신규 표준 entry 추가:

```yaml
standard_decompositions:
  - name: ITIL 4
    umbrella_slug: itil-4
    rule: decompose
    require_explicit_mention: true
    origin: user-yaml                  # 사용자 명시
    components:
      - slug: itil-4-service-design
        type: methodology
      - ... 4 more
```

**충돌 처리**:
- 같은 umbrella_slug 가 Stage 2 suggestion 으로 pending → user yaml 우선순위 1 → 사용자 yaml 적용. suggestion 은 사용자 review modal 에서 "이미 yaml 에 있음" 표시 + auto-rejected 가능 (v1 plan = manual reject 만, auto X).
- 같은 umbrella_slug 가 Stage 4 ConvergedDecomposition 으로 arbitration_confidence 0.9 → user yaml 우선순위 1 → ConvergedDecomposition 무시.
- component slug 가 BUILTIN PMBOK 의 slug 와 충돌 → `parseSchemaOverrideYaml` 의 first-wins 정책 (Stage 1 v7 §3.2.3) → BUILTIN 우선, user yaml component drop + warn.

### 4.4 Stage 간 fallback

Stage 4 LLM arbitration fail (LLM API down, token budget exceeded) → Stage 3 fallback. Stage 3 self-declaration 미발견 → Stage 2 suggestion fallback. Stage 2 suggestion 0 건 → Stage 1 (수동 yaml + BUILTIN) fallback.

```
Stage 4 fail (LLM down)
  ↓ Stage 3 가능?
  → SelfDeclaration 발견 시 runtime-scope 적용
  → 미발견 시
  ↓ Stage 2 가능?
  → 누적 mention history + suggestion store 확인
  → suggestion accepted 가 schema.yaml 에 이미 append → 자동 적용
  → pending 만 있고 accept 안 됨 → 적용 안 함 (사용자 승인 대기)
  ↓ Stage 1 (default)
  → schema.yaml entry + BUILTIN 만으로 ingest (모든 신규 표준 적용 안 됨, 사용자 yaml 직접 편집 필요)
```

**우아한 degradation**: 모든 Stage 가 fail 해도 BUILTIN PMBOK + user yaml 만으로 정상 ingest 가능 (Stage 1 alone). 자동 메커니즘 fail = 자동 등록 안 됨이지 ingest 차단 아님.

### 4.5 사용자 거부 (reject) 흐름

**Stage 2 suggestion reject**:
- 사용자 → reject 버튼 click + reason 입력 (선택)
- `rejectSuggestion(store, id, reason)` → state = `'rejected'` + negativeCache 에 id 추가
- 같은 signature 의 suggestion 재생성 안 됨 (`isInNegativeCache(store, id)` true)

**Stage 3 SelfDeclaration auto-runtime 적용 후 사용자 거부**:
- runtime-scope 는 ingest 세션 한정이라 GC 됨
- 사용자가 명시적으로 reject 하려면 Audit panel 의 "ingest history" 에서 해당 source 의 self-declaration 을 reject 표시 → suggestion store 에 negative cache 추가 (Stage 2 와 동일 메커니즘)
- **v1 plan 결정**: runtime-scope 는 자동 GC. reject 는 Stage 2 suggestion elevation 시점에서만. 사용자 인지 비용 vs UX 단순화 trade-off.

**Stage 4 ConvergedDecomposition reject**:
- review modal 에서 reject → `.wikey/converged-decompositions.json` 의 해당 entry state = 'rejected'
- 다음 convergence pass 에서 같은 cluster signature → silent drop
- negativeCache 공유 (Stage 2/3/4 모두 같은 store)

---

## 5. Acceptance Criteria (통합, 전 Stage 통과 기준, **TDD 강제**)

> **TDD 정책** (rules/rules.md §1 Evidence-Based + Stage 1 v7 가 입증한 패턴):
> - 매 AC 는 단위 테스트 RED→GREEN→REFACTOR 사이클 강제
> - 라이브 검증 (obsidian-cdp full cycle smoke) 은 별 AC (AC21)
> - 모든 신규 코드 = "test 먼저 (RED + 실패 확인) → 최소 구현 (GREEN + 통과 확인) → REFACTOR (필요 시 + 통과 유지)"
> - Mega-test 금지 (한 테스트가 10 behavior 검증 X)
> - waitForTimeout 등 임의 대기 금지 — 구체적 조건 대기

### AC 합계 — 22 AC

| AC | 영역 | 신규 cases | 산출물 |
|---|---|---|---|
| AC1 | Stage 1 회귀 0 | 0 (기존 19 유지) | 기존 670 PASS |
| AC2 | Stage 2 SuggestionStorage | ≥ 3 | suggestion-storage.test.ts |
| AC3 | Stage 2 co-occurrence detector | ≥ 4 | suggestion-detector.test.ts |
| AC4 | Stage 2 suffix clustering | ≥ 3 | suggestion-detector.test.ts |
| AC5 | Stage 2 confidence formula | ≥ 3 | suggestion-detector.test.ts |
| AC6 | Stage 2 Audit UI suggestion | ≥ 2 | sidebar-chat.test.ts (또는 UI smoke) |
| AC7 | Stage 2 schema.yaml writer | ≥ 3 | schema-yaml-writer.test.ts |
| AC8 | Stage 2 ingest pipeline trigger | ≥ 2 | ingest-pipeline.test.ts |
| AC9 | Stage 3 SelfDeclaration 타입 | ≥ 1 | self-declaration.test.ts |
| AC10 | Stage 3 section-index "표준 개요" detector | ≥ 3 | section-index.test.ts |
| AC11 | Stage 3 structured decomposition extractor | ≥ 3 | self-declaration-extractor.test.ts |
| AC12 | Stage 3 runtime-scope vs persist | ≥ 2 | self-declaration.test.ts |
| AC13 | Stage 3 Stage 2 suggestion 충돌 처리 | ≥ 2 | self-declaration.test.ts (shouldStage3ProposeRuntime) |
| AC14 | Stage 3 false positive guard | ≥ 1 | self-declaration-extractor.test.ts |
| AC15 | Stage 4 ConvergedDecomposition 타입 | ≥ 1 | converged-decomposition.test.ts |
| AC16 | Stage 4 mention graph clustering | ≥ 2 | convergence-pass.test.ts |
| AC17 | Stage 4 LLM arbitration | ≥ 2 | convergence-pass.test.ts |
| AC18 | Stage 4 reindex.sh hook | ≥ 1 | reindex.sh shell test 또는 scripts/__tests__ |
| AC19 | Stage 4 Stage 1/2/3 우선순위 충돌 | ≥ 2 | converged-decomposition.test.ts |
| AC20 | Stage 4 데이터 선결 조건 검증 | ≥ 1 | run-convergence-pass.test.ts |
| AC21 | 통합 라이브 cycle smoke | N/A (라이브) | obsidian-cdp full cycle |
| AC22 | build/test baseline | N/A (집계) | npm run build 0 errors / npm test ≥ 711 PASS |

**합계 신규 cases ≥ 41** (AC2~AC20 누적: Stage 2 ≥ 20 [AC2 3+AC3 4+AC4 3+AC5 3+AC6 2+AC7 3+AC8 2] + Stage 3 ≥ 12 [AC9 1+AC10 3+AC11 3+AC12 2+AC13 2+AC14 1] + Stage 4 ≥ 9 [AC15 1+AC16 2+AC17 2+AC18 1+AC19 2+AC20 1]). AC21/AC22 = 라이브 + 집계.

### AC1 — Stage 1 회귀 0

- **scope**: Stage 1 v7 의 9 AC + 신규 19 cases + 670 PASS baseline 모두 유지
- **검증 방식 (TDD)**: 기존 테스트 그대로 fresh 실행 → 670 PASS 확증
- **GREEN 증거**: `npm test 2>&1 | tail -5` 출력에 "670 passed" + exit 0
- **불변 항목**:
  - `BUILTIN_STANDARD_DECOMPOSITIONS` 정의 (PMBOK 10 + F3 component aliases)
  - `parseSchemaOverrideYaml` 4 시나리오 분기
  - `buildStandardDecompositionBlock` 4 시나리오 분기 (undefined / empty-explicit / empty-all-skipped / present)
  - F1 v3 append 정책
  - require_explicit_mention=true hallucination guard
  - STANDARD_EXCEPTIONS 갱신 (canonical slug 2개)
  - 9 AC 의 anchor phrase ('묶지 말 것' + '직접 언급되지 않으면 추출하지 않는다' + 'PMBOK 10 knowledge areas 개별 추출')
- **acceptance 라인**: `npm test --reporter=verbose 2>&1 | grep -c "✓ "` ≥ 670

### AC2 — Stage 2 SuggestionStorage

- **impl**: `wikey-core/src/suggestion-storage.ts`
- **test**: `wikey-core/src/__tests__/suggestion-storage.test.ts`
- **Test Spec (RED)** — tester 가 먼저 작성:
  - **Happy**: `addSuggestion(emptyStore, s1)` → store.suggestions.length === 1, s1 동일성 보존 (deep equal)
  - **Edge case empty**: `addSuggestion(undefined, s1)` 호출 시 throw (sanity)
  - **Idempotent**: `addSuggestion(addSuggestion(empty, s1), s1)` → length === 1 (같은 id 중복 방지)
- **Implementation (GREEN)** — developer 가 통과시키는 최소 코드 작성. immutable update.
- **Acceptance**:
  - RED 증거: 첫 실행 → 테스트 3 fail
  - GREEN 증거: 구현 후 → 3 passed
  - Coverage: ≥ 80% (모듈 단위)

### AC3 — Stage 2 co-occurrence detector

- **impl**: `wikey-core/src/suggestion-detector.ts` (`detectCoOccurrence` 함수)
- **test**: `wikey-core/src/__tests__/suggestion-detector.test.ts`
- **Test Spec (RED)**:
  - **Happy**: source 1 안 5 개 concept (`iso-27001-a-5`, `iso-27001-a-6`, ..., `iso-27001-a-9`) → CandidatePattern 1건 (umbrella_slug='iso-27001', components.length=5)
  - **Below threshold**: source 1 안 2 개 concept (minSiblings=3 미달) → 0건
  - **No common prefix**: source 1 안 5 개 concept 서로 prefix 다름 → 0건
  - **BUILTIN overlap drop**: source 1 안 PMBOK 10 components → 0건 (BUILTIN 과 100% overlap)
- **Acceptance**: RED → GREEN 4 passed

### AC4 — Stage 2 suffix clustering

- **impl**: `wikey-core/src/suggestion-detector.ts` (`detectSuffixCluster` 함수)
- **test**: `wikey-core/src/__tests__/suggestion-detector.test.ts`
- **Test Spec (RED)**:
  - **Happy**: history 에 source A (`iso-27001-a-5-policy`, `iso-27001-a-6-org`) + source B (`iso-27001-a-12-security`, `iso-27001-a-13-asset`) → CandidatePattern 1건 (umbrella='iso-27001', sources=2)
  - **Single source**: source A 만 4 mentions → 0건 (minSources=2 미달)
  - **Suffix outside whitelist**: 4 sources 의 mention 모두 suffix `-feature` (whitelist 외) → weight 0.5 → confidence 미달 가능
- **Acceptance**: RED → GREEN 3 passed

### AC5 — Stage 2 confidence formula

- **impl**: `wikey-core/src/suggestion-detector.ts` (`computeConfidence` 함수)
- **test**: `wikey-core/src/__tests__/suggestion-detector.test.ts`
- **Test Spec (RED)**:
  - **Max score**: support=5, suffix_homogeneity=1.0, mention_density=1.0, builtinOverlap=1.0 → confidence === 1.0 (`0.4*1+0.3*1+0.2*1+0.1*1`)
  - **BUILTIN overlap zero**: builtinOverlap=0.0 → confidence ≤ 0.9
  - **Below threshold**: support=1, suffix=0.5, density=0.1, overlap=1.0 → confidence < 0.6 (silent drop)
- **Acceptance**: RED → GREEN 3 passed

### AC6 — Stage 2 Audit UI suggestion

- **impl**: `wikey-obsidian/src/sidebar-chat.ts` (`renderSuggestionsPanel` 신규 함수)
- **test**: 단위 테스트는 sidebar-chat 의 jsdom mock 환경에서. `wikey-obsidian/src/__tests__/sidebar-chat-suggestions.test.ts`
- **Test Spec (RED)**:
  - **Happy**: suggestion store 에 1 pending suggestion → renderSuggestionsPanel(container) 호출 시 container.querySelector('.wikey-suggestion-card') 존재
  - **Empty state**: empty store → renderSuggestionsPanel → "No pending suggestions" 텍스트 표시
- **Acceptance**: RED → GREEN 2 passed
- **Note**: 라이브 UI smoke 는 AC21 에서.

### AC7 — Stage 2 schema.yaml writer

- **impl**: `wikey-core/src/schema-yaml-writer.ts` (`appendStandardDecomposition` 함수)
- **test**: `wikey-core/src/__tests__/schema-yaml-writer.test.ts`
- **Test Spec (RED)**:
  - **Happy fresh write**: 빈 wikiFS + `appendStandardDecomposition(suggestion)` → wikiFS.read('.wikey/schema.yaml') 가 `standard_decompositions:\n  - name: ...\n    umbrella_slug: iso-27001\n    ...` 포함
  - **Idempotent**: 동일 suggestion 두 번 호출 → 두 번째 호출 결과 `{ appended: false, reason: 'already-exists' }`
  - **Comment preservation**: 사용자가 yaml 에 `# user comment` 가 있는 상태 → append 후에도 comment 보존 (substring match)
- **Acceptance**: RED → GREEN 3 passed
- **GREEN 증거 grep**: `grep -F "umbrella_slug: iso-27001" .wikey/schema.yaml` → 1 hit (idempotent 후도 1 hit)

### AC8 — Stage 2 ingest pipeline trigger

- **impl**: `wikey-core/src/ingest-pipeline.ts` (`runSuggestionAnalysis` 호출 추가, `loadSchemaOverride` 다음)
- **test**: `wikey-core/src/__tests__/ingest-pipeline.test.ts` (suggestion 통합 부분)
- **Test Spec (RED)**:
  - **Happy**: ingest 결과 mention graph 에 ISO-27001 패턴 5+ → finalize 단계에서 suggestion 1 건 생성, suggestion store 에 persist
  - **No pattern**: ingest 결과 mention graph 가 모두 BUILTIN PMBOK overlap → suggestion 0 건 (silent)
- **Acceptance**: RED → GREEN 2 passed

### AC9 — Stage 3 SelfDeclaration 타입

- **impl**: `wikey-core/src/types.ts` (`SelfDeclaration`, `SelfDeclarationPersistChoice` 타입 추가)
- **test**: `wikey-core/src/__tests__/types-self-declaration.test.ts` (타입만 테스트하는 sanity)
- **Test Spec (RED)**:
  - **Type construct**: SelfDeclaration object 생성 가능 + persistChoice 3 종 (`runtime-only` / `pending-user-review` / `persisted`) discriminated union
- **Acceptance**: RED → GREEN 1 passed (`tsc --noEmit` 0 errors + 1 runtime test)

### AC10 — Stage 3 section-index "표준 개요" detector

- **impl**: `wikey-core/src/section-index.ts` (`classifyHeadingPattern` 확장 — `'standard-overview'` 추가)
- **test**: `wikey-core/src/__tests__/section-index.test.ts` (신규 cases)
- **Test Spec (RED)**:
  - **Happy KO**: title "PMBOK 개요" → `'standard-overview'`
  - **Happy EN**: title "ISO 27001 Overview" → `'standard-overview'`
  - **Marketing reject**: title "5 핵심 기능" → `'normal'` (keyword 없음)
- **Acceptance**: RED → GREEN 3 passed
- **Note**: 기존 7 종 classifyHeadingPattern 회귀 0 (regression suite 같이 실행)

### AC11 — Stage 3 structured decomposition extractor

- **impl**: `wikey-core/src/self-declaration-extractor.ts` (`extractSelfDeclaration` 함수)
- **test**: `wikey-core/src/__tests__/self-declaration-extractor.test.ts`
- **Test Spec (RED)**:
  - **Happy numbered list**: section.body 가 "1. policy\n2. organization\n3. asset\n4. access\n5. crypto\n" → SelfDeclaration { components.length=5 }
  - **Below threshold**: section.body 의 list ≤ 4 items → null
  - **Bullet list**: "- iso-27001-a-5\n- iso-27001-a-6\n- ...5 more" → SelfDeclaration { components.length=5 }
- **Acceptance**: RED → GREEN 3 passed

### AC12 — Stage 3 runtime-scope vs persist

- **impl**: `wikey-core/src/self-declaration.ts` (`mergeRuntimeIntoOverride` 함수)
- **test**: `wikey-core/src/__tests__/self-declaration.test.ts`
- **Test Spec (RED)**:
  - **Happy runtime + builtin**: mergeRuntimeIntoOverride(undefined, [SelfDecl]) → SchemaOverride { standardDecompositions: { kind: 'present', items: [SelfDecl as StandardDecomposition] } }
  - **Empty-explicit override → runtime ignored**: override.standardDecompositions = { kind: 'empty-explicit' } + runtime [SelfDecl] → 결과 unchanged (사용자 disable 의도 보존)
- **Acceptance**: RED → GREEN 2 passed

### AC13 — Stage 3 Stage 2 suggestion 충돌 처리

- **impl**: `wikey-core/src/self-declaration.ts` (`shouldStage3ProposeRuntime` 함수)
- **test**: `wikey-core/src/__tests__/self-declaration.test.ts`
- **Test Spec (RED)**:
  - **No prior suggestion → propose**: shouldStage3ProposeRuntime(emptyStore, 'iso-27001') === true
  - **Rejected suggestion → drop**: store with rejected ISO suggestion → shouldStage3ProposeRuntime returns false
  - **Accepted suggestion → drop (이미 schema.yaml 에 있음)**: store with accepted ISO suggestion → returns false
- **Acceptance**: RED → GREEN 3 passed (실제 ≥ 2 — happy + 2 reject 분기 = 3)

### AC14 — Stage 3 false positive guard

- **impl**: `extractSelfDeclaration` 의 component slug ≥ 5 chars 임계 + headingPattern 추가 검증
- **test**: `wikey-core/src/__tests__/self-declaration-extractor.test.ts`
- **Test Spec (RED)**:
  - **Marketing list**: section title "5 핵심 기능" + body 5 items "feature-a" ~ "feature-e" → headingPattern='normal' → null (extractSelfDeclaration 호출 시점에 X)
- **Acceptance**: RED → GREEN 1 passed

### AC15 — Stage 4 ConvergedDecomposition 타입

- **impl**: `wikey-core/src/types.ts` (`ConvergedDecomposition`, `SourceMention` 타입 추가)
- **test**: `wikey-core/src/__tests__/types-converged.test.ts`
- **Test Spec (RED)**:
  - **Type construct**: ConvergedDecomposition object 생성 가능 + arbitration_method ('union' | 'llm') discriminated
- **Acceptance**: RED → GREEN 1 passed

### AC16 — Stage 4 mention graph clustering

- **impl**: `wikey-core/src/convergence-pass.ts` (`clusterMentionsAcrossSources` 함수, qmd vector index mock 으로 테스트)
- **test**: `wikey-core/src/__tests__/convergence-pass.test.ts`
- **Test Spec (RED)**:
  - **Happy**: mock qmd index 가 cosine 0.8 반환 (≥ 0.75) → 2 mention 같은 cluster
  - **Below threshold**: cosine 0.5 → cluster 분리
- **Acceptance**: RED → GREEN 2 passed

### AC17 — Stage 4 LLM arbitration

- **impl**: `wikey-core/src/convergence-pass.ts` (`arbitrate` 함수, LLM client mock)
- **test**: `wikey-core/src/__tests__/convergence-pass.test.ts`
- **Test Spec (RED)**:
  - **Happy union**: arbitration='union' + cluster ≥ 3 source → ConvergedDecomposition { arbitration_method: 'union', arbitration_confidence: 1.0 }
  - **Happy llm**: arbitration='llm' + LLM mock 응답 arbitration_confidence=0.8 → ConvergedDecomposition with arbitration_method='llm'
- **Acceptance**: RED → GREEN 2 passed

### AC18 — Stage 4 reindex.sh hook

- **impl**: `scripts/reindex.sh` 의 마지막에 conditional block (`WIKEY_CONVERGENCE_ENABLED=true` 일 때만)
- **test**: `scripts/__tests__/reindex-convergence-hook.bats` (또는 `wikey-core/scripts/__tests__/reindex-convergence-hook.test.mjs`)
- **Test Spec (RED)**:
  - **Hook off (default)**: `WIKEY_CONVERGENCE_ENABLED=` (unset) → reindex.sh 실행 후 `.wikey/converged-decompositions.json` 변경 0
  - **Hook on**: `WIKEY_CONVERGENCE_ENABLED=true` + mock convergence-pass.mjs (echo "OK") → reindex.sh 가 mock 실행
- **Acceptance**: RED → GREEN 1 passed (실제 ≥ 1)

### AC19 — Stage 4 Stage 1/2/3 우선순위 충돌

- **impl**: `wikey-core/src/converged-decomposition.ts` (`mergeAllSources` 함수)
- **test**: `wikey-core/src/__tests__/converged-decomposition.test.ts`
- **Test Spec (RED)**:
  - **User-yaml > converged**: user yaml 에 ITIL-4 entry + ConvergedDecomposition 도 ITIL-4 → user yaml 만 prompt 출력 (ConvergedDecomposition 무시)
  - **Empty schema + converged accepted**: schema.yaml 빈 상태 + ConvergedDecomposition accept 후 schema.yaml append → 다음 호출 mergeAllSources 가 ConvergedDecomposition entry (이미 yaml 에 있음) 만 사용
- **Acceptance**: RED → GREEN 2 passed

### AC20 — Stage 4 데이터 선결 조건 검증

- **impl**: `wikey-core/scripts/run-convergence-pass.mjs` (`if (uniqueStandardCount * uniqueSourceCount < 6) return warning_exit_0`)
- **test**: `wikey-core/scripts/__tests__/run-convergence-pass.test.mjs`
- **Test Spec (RED)**:
  - **Insufficient data**: history 에 1 표준 + 1 source → exit 0 + stderr "insufficient mention diversity for convergence" message
- **Acceptance**: RED → GREEN 1 passed

### AC21 — 통합 라이브 cycle smoke (tester 책임)

- **scope**: vault 의 실제 mention graph 에서 Stage 1+2+3+4 통합 시나리오 검증
- **검증 도구**: obsidian-cdp full cycle smoke (`~/.claude/skills/obsidian-cdp/SKILL.md`)
- **fixture corpus 준비** (codex Cycle #1 U4 결정 — Stage 2 구현 전 필수): 3 표준 × 2 source = 6 자료. **owner = master** (analyst/tester 아님, master 가 Stage 2 cycle 시작 전에 직접 마련). 후보:
  - 표준 A = PMBOK: `raw/3_resources/20_report/500_technology/PMS_제품소개_R10_20220815.pdf` (이미 vault, PMBOK 영역 일부 한국어 등장) + 신규 1 source (사용자 제공 또는 master 가 별도 PMBOK 요약 짧은 자료 마련 — 예: PMI 공개 PMBOK 7th overview)
  - 표준 B = ISO 27001: 신규 2 source (5-control + 93-control, 단위 테스트 fixture 와 별개로 라이브 PDF 또는 markdown 형식). master 가 사용자에게 공개 자료 link 제공 받거나 별도 마련.
  - 표준 C = ITIL 4 또는 SAFe 또는 OWASP: 신규 2 source. 도메인 다양성 보장.
  - 위치: `raw/__fixtures__/integration-cycle-smoke/` 신규 디렉토리 (raw 본 영역과 분리, .gitignore 검토 또는 git LFS).
  - **gate**: master 가 Stage 2 cycle (cycle #2 또는 #3) 시작 전 본 fixture 6 자료 마련 완료. 미달 시 Stage 2 구현 불가 (AC21 라이브 검증 불가).
- **시나리오**:
  1. Vault reset (testing fixture 사용, `wiki/` 직접 변경 X)
  2. fixture corpus 6 자료 인제스트
  3. Audit panel → Suggestions panel → 1 suggestion 확인 (Stage 2)
  4. Accept → schema.yaml append 확증
  5. 다음 ingest → 신규 표준 분해 등장 확증
  6. Stage 3 — section "ISO 개요" 인 source 인제스트 → runtime-scope decomposition 적용 확증 (concept 출력)
  7. Stage 4 — `WIKEY_CONVERGENCE_ENABLED=true` reindex.sh 실행 → ConvergedDecomposition review modal 등장
  8. wiki write 정합성 (entity / concept page 생성)
- **acceptance**: 본 plan 은 정의만, 실행은 tester 위임. 결과는 `activity/phase-5-resultx-5.4-integration-cycle-smoke-<date>.md` 신규 작성.

### AC22 — build/test baseline

- **scope**: 전체 build + test 통과
- **검증**:
  - `npm run build` → 0 errors
  - `npm test` → 기존 670 baseline + 신규 cases (Stage 2 ≥ 20 + Stage 3 ≥ 12 + Stage 4 ≥ 9 + Stage 1 maintenance 0 = ≥ 41 신규) → ≥ 711 PASS
  - `wikey-obsidian` build OK
- **GREEN 증거**: fresh `npm test 2>&1 | tail -5` 출력 + `npm run build 2>&1 | tail -10` 출력 + exit 0

---

## 6. 단계적 cycle 분해 (master 가 본 plan 승인 후 진행)

| cycle # | 작업 | 산출물 | 검증 |
|---|---|---|---|
| **1** | 본 통합 plan v1 작성 (analyst) | `phase-5-todox-5.4-integration.md` v1 | self-check 7-anchor (§9) |
| **2** | master 1차 검증 + codex 2차 검증 | NEEDS_REVISION 또는 APPROVE_WITH_CHANGES | codex Mode D Panel |
| **3** | (필요 시) v2 fix + codex 재검증 | v2 또는 v3 | APPROVE 까지 cycle |
| **4** | 사용자 승인 + Stage 2 detailed sub-plan (별 todox) | `phase-5-todox-5.4.2-extraction-graph.md` | analyst |
| **5~7** | Stage 2 구현 (developer + tester) + 검증 (reviewer) | AC2~AC8 GREEN | TDD RED→GREEN |
| **8** | Stage 3 detailed sub-plan | `phase-5-todox-5.4.3-self-declaration.md` | analyst |
| **9~11** | Stage 3 구현 + 검증 | AC9~AC14 GREEN | TDD RED→GREEN |
| **12** | Stage 4 detailed sub-plan | `phase-5-todox-5.4.4-convergence.md` | analyst |
| **13~15** | Stage 4 구현 + 검증 | AC15~AC20 GREEN | TDD RED→GREEN |
| **16** | 통합 라이브 cycle smoke (AC21) | `activity/phase-5-resultx-5.4-integration-cycle-smoke-<date>.md` | tester (obsidian-cdp) |
| **17** | 종합 closing — `phase-5-result.md §5.4` 업데이트 + memory 갱신 | result + memory | doc-updater |

**v1 plan 의 본 cycle = #1 만 (작성 완료 시점에 분기)**. cycle #2 부터는 master 가 진행.

---

## 7. 위험 / 대안 (R1~R5)

### R1 — false positive 누적 (Stage 2 + 3 모두 발생 가능)

- **영향**: Medium
- **완화**:
  - Stage 2 confidence ≥ 0.6 임계 + suffix whitelist + builtinOverlap drop
  - Stage 3 default = runtime-only (자동 persist X)
  - negativeCache 메커니즘 (사용자 거부 영구 기록)
  - false-positive corpus fixture (≥ 5 examples) 누적 + 회귀 테스트

### R2 — schema.yaml writer 가 사용자 편집 손상

- **영향**: High (사용자 신뢰)
- **완화** (v2 — section-range insertion 정책 반영):
  - **section-range insertion writer** (parse 안 함, line-level scan, codex Cycle #1 HIGH 정정) — `standard_decompositions:` 다음 top-level key 직전 line splice. 다른 top-level section 손상 위험 0. header `[]` 시 `header-unsafe` reject (사용자 명시 disable 의도 보호)
  - idempotency check (substring match `umbrella_slug:` 마커)
  - 사용자 standard_decompositions section 안 inline comment 는 위치 이동 가능하나 의미 보존 → v2 plan 명시 한계 + 사용자 안내 필수
  - 미래 v2 — AST-level merge (yaml 라이브러리 도입 검토, 단 Stage 1 v7 §3.2 minimal subset 정책과 충돌)

### R3 — Stage 4 LLM 비용 증가

- **영향**: Medium
- **완화**:
  - default = `union` 알고리즘 (LLM 호출 없음)
  - LLM arbitration 은 opt-in (`WIKEY_ARBITRATION_METHOD=llm`)
  - token-budget 임계 (`WIKEY_CONVERGENCE_TOKEN_BUDGET=50000`, Stage 1 v7 §4.3 와 일관)
  - cluster filter — `source_count ≥ 3` 만 arbitration (대다수 cluster silent skip)

### R4 — Stage 1 회귀

- **영향**: High
- **완화**:
  - F1 append 정책 / `parseSchemaOverrideYaml` 시그니처 / `buildStandardDecompositionBlock` 4 시나리오 분기 모두 불변 (§3.1 reference)
  - AC1 = Stage 1 의 670 PASS 모두 유지
  - 모든 Stage 2/3/4 코드는 별 모듈 (`suggestion-storage.ts`, `self-declaration.ts`, `convergence-pass.ts` 등) 신규 추가 — Stage 1 모듈 (`schema.ts`, `canonicalizer.ts`, `types.ts`) 수정 X (단, types.ts 에 신규 타입 추가만)

### R5 — 사용자 vault 가 표준 도메인 아닐 때 (예: 펌프/펌웨어)

- **영향**: 정상 (silent disable)
- **완화**:
  - 모든 Stage 가 enumerate 형식 / suffix whitelist / cluster threshold 등 임계로 silent skip
  - 표준 도메인 외 vault 는 BUILTIN PMBOK 만 prompt 출력 (사용자가 [] 명시 disable 가능)
  - false positive 도 0 — confidence 임계 + 사용자 승인 게이트
  - **사용자 안내 필수** (settings tab 또는 README): "표준 도메인 외 vault 는 §5.4 자동 메커니즘 미발현이 정상"

---

## 8. 변경 이력 (v1 → v2 → v3 → v4 → v5 master → v6 Cycle #1 → v7 Cycle #2 → v8 Cycle #3 → v9 Cycle #4 → v10 Cycle #5 fix)

### 8.10 v10 post-implementation Cycle #5 master 직접 fix (2026-04-26, codex Cycle #5 REJECT 후속 — §4.1 fresh ingest flow stale)

**codex Cycle #5 발견 1 finding** (LOW):

| Finding | severity | 위치 | master 결정 + fix |
|---|---|---|---|
| **§4.1 fresh ingest flow stale** | LOW | plan line 1089 | 동의. §3.4.2 + §3.4.3 + convergence.ts 모두 갱신했으나 §4.1 fresh ingest flow 의 시퀀스 다이어그램 안 `clusterMentionsAcrossSources(history, qmdIndex)` 잔존. fix: alpha v1 embeddings inject + singleton drop 흐름으로 갱신 (`(history, embeddings)` + `mention_slugs ≥ 2`) |

**v10 self-check** (master 1차 검증 의무 + cross-check):
- (a) ✅ 시그니처 cross-file 일관 — §3.4.2 + §3.4.3 + §4.1 + convergence.ts 모두 (history, embeddings)
- (b) ✅ Union kind 무변경
- (c) ✅ singleton drop guard 명시 §3.4.2 + §3.4.3 + §4.1 + convergence.ts 일관
- (d) ✅ AC1~AC22 + 신규 cases 누적 731 PASS 보존
- (e) ✅ stale 0: §4.1 fresh ingest flow 갱신, 잔존 grep hit (line 1533/1555) 은 history row only — 활성 finding 아님 (codex 도 확인)
- (f) ✅ header v5 ↔ §8.10 v10 ↔ footer (post-impl Cycle #5)
- (g) ✅ exact phrase 보존 + alpha v1 embeddings inject + singleton drop 표현 일관

**baseline 보존**: 731 PASS / 0 build errors (코드 변경 없음 — plan 문서 수정만).

### 8.9 v9 post-implementation Cycle #4 master 직접 fix (2026-04-26, codex post-impl Cycle #4 REJECT 후속 — LOW lingering)

**codex Cycle #4 발견 1 finding** (LOW stale lingering):

| Finding | severity | 위치 | master 결정 + fix |
|---|---|---|---|
| **plan §3.4.2 stale pseudocode** | LOW | plan §3.4.2 line 815-818 | 동의. §3.4.3 의 pseudocode 만 갱신했고 §3.4.2 의 동일 pseudocode 잔존 (`clusterMentionsAcrossSources(history, qmdIndex: QmdIndexClient)` v0 표현). fix: alpha v1 embeddings inject 흐름 + singleton drop 명시로 갱신 |

**참고**: codex verdict 가 REJECT 였으나 finding 자체는 LOW 1건만 (regression PASS / F4 PASS / Cycle #3 fix 정상 confirm). codex 가 LOW 만으로 REJECT verdict 한 경우는 master 결정 = LOW fix 적용 후 cycle #5.

**v9 self-check** (master 1차 검증 의무 + cross-check):
- (a) ✅ 시그니처 cross-file 일관: §3.4.2 pseudocode + §3.4.3 pseudocode + convergence.ts 모두 (history, embeddings) 시그니처 일관
- (b) ✅ Union kind 무변경
- (c) ✅ singleton drop 명시 §3.4.2 + §3.4.3 + convergence.ts:142-146 일관
- (d) ✅ AC1~AC22 + 신규 cases 누적 731 PASS 보존
- (e) ✅ stale 0: §3.4.2 + §3.4.3 + convergence.ts 주석 모두 alpha v1 wire 일관
- (f) ✅ header v5 ↔ §8.9 v9 ↔ footer (post-impl Cycle #4)
- (g) ✅ exact phrase 보존 + alpha v1 embeddings inject + singleton drop 표현 일관

**baseline 보존**: 731 PASS / 0 build errors (코드 변경 없음 — plan 문서 수정만).

### 8.8 v8 post-implementation Cycle #3 master 직접 fix (2026-04-26, codex post-impl Cycle #3 NEEDS_REVISION 후속)

**codex Cycle #3 발견 2 finding** (HIGH 1 + LOW 1):

| Finding | severity | 위치 | master 결정 + fix |
|---|---|---|---|
| **F4 lingering** singleton cluster graceful-skip 깨짐 | HIGH | convergence.ts clusterMentionsAcrossSources line 135-149 | 동의 (codex 직접 실행 confirm — empty embeddings + 3 slugs × 2 sources → 3 singleton ConvergedDecomposition 생성). fix: clusterMentionsAcrossSources 가 mention_slugs.length < 2 인 singleton cluster 를 flatMap 으로 drop. empty embeddings → 모든 cluster singleton → 빈 배열 반환 → graceful skip 계약 회복. AC16 test 정정 (cosine < 0.75 → 0 cluster, 이전 2 → singleton drop) + AC20 신규 case 1 (empty embeddings + threshold-satisfied → 빈 결과) |
| **plan/주석 stale** | LOW | plan §3.4.3 line 920-935 + convergence.ts line 81-83 | 동의. plan §3.4.3 의 pseudocode 가 QmdIndexClient (v0 표현) 잔존 → alpha v1 외부 JSON inject + singleton drop 흐름으로 갱신. convergence.ts 주석도 alpha v1 wire (외부 도구 후보 4종 + v2 deferral) 명시 |

**v8 self-check** (master 1차 검증 의무 + cross-check):
- (a) ✅ 시그니처 cross-file 일관 (변경 X)
- (b) ✅ Union kind 무변경
- (c) ✅ clusterMentionsAcrossSources flatMap 분기로 singleton drop 명확
- (d) ✅ AC1~AC22 + 신규 AC20 empty-embeddings case 1 (총 ≥ 62 신규 cases, achieved 731 PASS)
- (e) ✅ stale 0: plan §3.4.3 pseudocode 갱신, convergence.ts 주석 갱신, 둘 다 alpha v1 wire 일관
- (f) ✅ header v5 ↔ §8.8 v8 ↔ footer (post-impl Cycle #3)
- (g) ✅ exact phrase 보존 + alpha v1 graceful skip 계약 명시 phrase 일관

**baseline 갱신**: 730 → 731 PASS (신규 empty-embeddings AC20 case 1).

### 8.7 v7 post-implementation Cycle #2 master 직접 fix (2026-04-26, codex post-impl Cycle #2 NEEDS_REVISION 후속)

**codex Cycle #2 발견 2 finding** (CRITICAL 1 + MEDIUM 1):

| Finding | severity | 위치 | master 결정 + fix |
|---|---|---|---|
| **F4 lingering** Stage 4 qmd vector stub | CRITICAL | run-convergence-pass.mjs:58 | 동의 (codex 정확). alpha 단계 명시만으로는 wire 미흡. fix: createConvergencePass 에 `--embeddings <json>` 인자 추가 + mjs wrapper 가 JSON load → Map<slug, vec> inject. reindex.sh 가 `WIKEY_CONVERGENCE_EMBEDDINGS` env forward. plan §3.4.3 의 alpha v1 wire 명시 강화 (외부 도구 inject + v2 deferral 명확화) |
| **F2 lingering** sidebar-chat accept handler | MEDIUM | sidebar-chat.ts:653 | 동의. fix: appendStandardDecomposition 가 invalid-slug / header-unsafe / already-exists 반환 시 suggestion state 전환 안 함 + 카드 보존 + reason 별 사용자 알림 (Notice). 사용자가 fix 후 재시도 가능 |

**v7 self-check** (master 1차 검증 의무 + cross-check):
- (a) ✅ 시그니처 cross-file 일관: ConvergencePassConfig.embeddings? optional 추가, 기존 시그니처 보존
- (b) ✅ Union kind 무변경
- (c) ✅ writer 분기 무변경 (Cycle #1 fix invalid-slug 그대로)
- (d) ✅ AC1~AC22 + 신규 AC18 embeddings inject case 1 (총 ≥ 61 신규 cases, achieved 730 PASS)
- (e) ✅ stale 0: F4 alpha v1 wire 명확화, F2 lingering accept handler fix 명확
- (f) ✅ header v5 (acceptance 부분 변경 X) ↔ §8.7 v7 (변경 이력) ↔ footer (post-impl Cycle #2)
- (g) ✅ exact phrase 보존: cluster-management 형식 + arbitration_confidence 일관 + section-range insertion writer 표현 + alpha v1 wire 표현 (—embeddings JSON inject)

**baseline 갱신**: 729 → 730 PASS (신규 embeddings inject AC18 case 1).

### 8.6 v6 post-implementation Cycle #1 master 직접 fix (2026-04-26, codex post-impl review NEEDS_REVISION 후속)

**codex post-impl Cycle #1 발견 4 finding** (CRITICAL 1 + HIGH 2 + MEDIUM 1):

| Finding | severity | 위치 | master 결정 + fix |
|---|---|---|---|
| **F1** Stage 2 round-trip violation | HIGH | suggestion-detector.ts:169 + schema-yaml-writer.ts | 동의. suffix cluster umbrella_slug `*${suffix}` → `cluster-${suffix}` 변경 (parser regex `/^[a-z][a-z0-9-]*$/` 와 일치). schema-yaml-writer 에 invalid-slug reject 추가 (umbrella + components 모두). 신규 case 1 (round-trip safety) |
| **F2** UI Suggestions panel unreachable | HIGH | sidebar-chat.ts header | 동의. `selectPanel('suggestions')` 호출 button 추가 (icon: ICONS.question, title: 'Suggestions') |
| **F3** Stage 3 ingest-pipeline wiring 누락 | (CRITICAL implicit) | ingest-pipeline.ts:494 schemaOverride 흐름 | 동의. self-declaration 추출 + mergeRuntimeIntoOverride wiring 추가 (FULL/SEGMENTED 둘 다). canonicalize 호출 site 의 `schemaOverride` 인자 → `effectiveOverride` |
| **F4** Stage 4 qmd vector stub | CRITICAL | run-convergence-pass.mjs:58 | **이견** (alpha 단계 명시 잔존 — plan §3.4.2 line 833 "alpha / page-level-limited" 명시). real qmd 통합은 v2 (Stage 4 acceptance 의 "alpha" granularity 가 의도). embeddings inject 인터페이스로 mock 테스트 가능. 본 v1 plan 안에서 stub 유지 + post-impl review 에서 alpha 단계 acceptance 재확인 |
| **F5** AC21 fixture/live smoke absence | MEDIUM | plan §5 AC21 | **이견** (사용자 영구 결정 — vault 변경 위험으로 별도 세션 진행. plan §5.4.5 deferred 명확화). 본 §5.4 commit scope = 코드 + 시뮬레이션 integration test. 라이브 cycle smoke 는 사용자 환경 fixture 마련 후 별도 (§5.4.5 todo 갱신 — agent-management.md §6 master 1차 책임 갱신 반영) |

**v6 self-check** (master 1차 검증 의무 + cross-check):
- (a) ✅ 시그니처 cross-file 일관 (수정 후 round-trip 안전)
- (b) ✅ Union kind 무변경
- (c) ✅ writer: invalid-slug reject 추가, 기존 already-exists/header-unsafe 보존
- (d) ✅ AC1~AC22 + 신규 invalid-slug case 1 (총 ≥ 60 신규 cases, achieved 729 PASS)
- (e) ✅ stale 0: F1/F2/F3 fix 명확, F4/F5 master 이견 정당화 본문 명시
- (f) ✅ header v5 (plan acceptance 부분 변경 X) ↔ §8.6 v6 (변경 이력) ↔ footer (post-impl Cycle #1)
- (g) ✅ exact phrase 보존: cluster-management 형식 + arbitration_confidence 일관 + section-range insertion writer 표현 보존

**baseline 갱신**: 728 → 729 PASS (신규 invalid-slug 1 case + 기존 7 cases umbrella_slug 형식 정정).

### 8.5 v5 master 직접 fix (2026-04-26, codex Cycle #4 NEEDS_REVISION 후속)

**codex Cycle #4 발견 2 finding** (MED 2, BUILD_BREAK_RISK: LOW):

| Finding | severity | 위치 | master fix |
|---|---|---|---|
| **Issue 1** | MED | §8 D3 decision 표 line 1585 | decision matrix D3 가 "writer = append-only" 잔재 — 본 D3 는 영속 결정 표 (§9 retrospective 영역 밖) 라 stale 시 구현자가 다른 영역 (§3.2.5) 와 모순 정책 따를 위험 → "section-range insertion (parse 안 함, line-level scan, header `[]` reject)" 정정. v2 정정 후 v3/v4 일관 명시 |
| **Issue 2** | MED | footer 다음 master 액션 line 1644-1647 | v3/Cycle #3 표현 stale → v5/Cycle #5 갱신. footer self-check 와 일관 |

**v5 self-check** (master 1차 검증 의무 + cross-check):
- (a) ✅ 시그니처 cross-file 일관 (변경 X — Issue 1/2 모두 prose/decision 표만)
- (b) ✅ Union kind: kind:'absent' literal 0
- (c) ✅ writer: §3.2.5 제목 + 본문 + D3 decision 모두 section-range insertion 일관
- (d) ✅ AC1~AC22: ≥ 41 / ≥ 711 PASS 일관
- (e) ✅ stale 0: append-only 본문 + decision 잔존 0. footer 다음 master 액션 v5 일관
- (f) ✅ header v5 ↔ §8.5 v5 ↔ footer v5 일관
- (g) ✅ exact phrase 보존 + arbitration_confidence 일관

### 8.4 v4 master 직접 fix (2026-04-26, codex Cycle #3 NEEDS_REVISION 후속)

**codex Cycle #3 발견 3 finding** (HIGH 1 + MED 2):

| Finding | severity | 위치 | master fix |
|---|---|---|---|
| **Issue 1** | HIGH | §3.2.5 헤딩 line 413 | `#### 3.2.5 schema.yaml writer (idempotent + comment 보존 + append-only)` 제목에 `append-only` 잔존 — §3.2.5 본문은 v2 에서 section-range insertion 으로 변경됐으나 제목 미정정 → 제목/본문 일관성 깨짐, 구현자 헤딩만 보고 잘못된 정책 따를 위험. 제목 → `section-range insertion` 정정 |
| **Issue 2** | MED | §1.1 line 31 표 + §1.2 line 42 비목표 + §4.3 line 1129 충돌 처리 | Stage 4 prose 3 위치에 단독 `confidence` 잔존 — `arbitration_confidence` (TS 타입 + LLM mapper) 와 일관 깨짐 → 모두 `arbitration_confidence` 통일 |
| **Issue 3** | MED | footer 다음 master 액션 line 1624-1625 | "본 v2 plan ... Cycle #2 송부" 표현 잔재 → "v3 ... Cycle #3 송부 (surface:23)" 갱신 (footer self-check 와 일관) |

**v4 self-check** (master 1차 검증 의무 + cross-check):
- (a) ✅ 시그니처 cross-file 일관 (변경 X — Issue 2 는 prose 만)
- (b) ✅ Union kind: kind:'absent' literal 0
- (c) ✅ writer: §3.2.5 제목 + 본문 모두 section-range insertion 일관
- (d) ✅ AC1~AC22: ≥ 41 / ≥ 711 PASS 일관
- (e) ✅ stale 0: append-only 잔존 0 (제목 fix 후), 단독 confidence 잔존 = Suggestion 타입 line 246 + mapper trigger line 887 + changelog 인용만 (Stage 4 prose 0)
- (f) ✅ header v4 ↔ §8.4 v4 ↔ footer v4 일관
- (g) ✅ exact phrase 보존 + arbitration_confidence 일관

### 8.3 v3 master 직접 fix (2026-04-26, codex Cycle #2 NEEDS_REVISION 후속)

**codex Cycle #2 발견 3 finding** (HIGH 2 + MED 1):

| Finding | severity | 위치 | master fix |
|---|---|---|---|
| **Issue 1** | HIGH | §2 line 78 + §7 R2 line 1455 + §3.2.5 한계 line 502 | stale "append-only writer" / "파일 끝 append" 표현 잔재 (v2 §3.2.5 정책은 section-range insertion 인데 본 3 위치는 v1 표현 유지) → 모두 "section-range insertion" 으로 정정 + 다른 top-level section 손상 위험 0 명시 + header `[]` reject 명시 |
| **Issue 2** | HIGH | §3.4.2 line 854 / 863 / 869 (Stage 4 LLM arbitration prompt) | LLM prompt 의 `confidence` 필드 + JSON 응답 schema 의 `confidence: 0.0~1.0` → `arbitration_confidence` 로 정정 (TS 타입 ConvergedDecomposition.arbitration_confidence 와 일관). LLM 응답 → ConvergedDecomposition mapper 명시 추가 (parse code block) — `result.arbitration_confidence` undefined 위험 해소. line 869 trigger 분기도 `arbitration_confidence ≥ 0.7` 로 정정 |
| **Issue 3** | MED | §9 self-check 표 line 1572-1573 | v1 작성 첫 cycle 표현 잔재 → v2/v3 master self-fix 결과 반영. (e) drift 없음 anchor 본인이 stale 이면 self-check 신뢰 불가 — v3 갱신으로 stale 0 확증 + 정정한 위치 명시. (f) header v3 / §8.3 / footer v3 일관 |

**v3 self-check** (master 1차 검증 의무):
- (a) ✅ 시그니처 cross-file: ConvergedDecomposition.arbitration_confidence 사용 site (line 794, 909, 1357-1358, LLM mapper) 모두 일관
- (b) ✅ Union kind: kind:'absent' literal 0
- (c) ✅ writer 분기: section-range insertion + header-unsafe reject branch 일관
- (d) ✅ AC1~AC22: ≥ 41 / ≥ 711 PASS 일관
- (e) ✅ stale 0: "append-only" / "파일 끝 append" 표현 v3 본문 잔존 0건. LLM prompt `confidence` 표현 0건. §9 self-check (e) (f) 자체 v3 갱신
- (f) ✅ header v3 ↔ §8.3 v3 ↔ footer v3 일관
- (g) ✅ exact phrase 보존 + arbitration_confidence 일관

### 8.2 v2 master 직접 fix (2026-04-26, codex Cycle #1 NEEDS_REVISION 후속)

**codex Cycle #1 발견 5 finding** (HIGH 2 + MED 1 + U1/U4 본 cycle 결정 + U3/U5 alpha 표기):

| Finding | severity | 위치 | master fix |
|---|---|---|---|
| **Issue 1** | HIGH | §3.2.5 line 414-443 (writer pseudocode) | append-only → **section-range insertion** (header `[]` → `header-unsafe` reject + `standard_decompositions:` 다음 top-level key 직전 line splice) |
| **Issue 2** | HIGH | §3.4.1 line 764, §3.4.3 line 879, AC17 line 1327-1328 | `confidence` 산발 사용 → `arbitration_confidence` 통일 (ConvergedDecomposition 필드명 일관) |
| **Issue 3** | MED | §5 표 line 1155, line 1157, AC22 line 1377 | test count 산수 정정: ≥710 PASS / 신규 ≥42 → ≥711 PASS / 신규 ≥41. Stage 2 ≥17 → ≥20. AC2~AC20 합산 cross-check 추가 |
| **U1** (본 cycle 결정) | — | §3.2.1 store 정책 | suggestions.json (rotation 안 함, negativeCache 영구) ↔ mention-history.json (rotation 5000 ingest 또는 10MB) 분리. sqlite migration trigger = mention-history 만 |
| **U3** (alpha 표기) | — | §3.4.2 v1 plan 한계 단락 | "Stage 4 정확도 = alpha / page-level-limited" 명시 + arbitration_confidence + 사용자 review modal 필수 guard 강조 |
| **U4** (본 cycle 결정) | — | AC21 fixture corpus | owner = master (Stage 2 cycle #2~#3 시작 전 6 자료 마련). 위치 = `raw/__fixtures__/integration-cycle-smoke/`. 후보 표준 A/B/C 명시 (PMBOK + ISO 27001 + ITIL/SAFe/OWASP). gate: 미달 시 Stage 2 구현 불가 |
| **U5** (alpha 표기) | — | §3.2.2 임계 단락 | "alpha default + baseline calibration 의무" 명시. 임계 hardening 금지 (cycle #2~#6 라이브 검증 후 false positive/negative 측정 → v2 부록 등록) |
| **U2** | — | (변경 X) | deferral OK (v1 그대로) |

**v2 self-check** (master 1차 검증 의무 — rules.md §10 7-anchor):
- (a) ✅ 시그니처 cross-file: 8 종 export 그대로 (Issue 2 fix 후 ConvergedDecomposition.arbitration_confidence 사용 site 일관)
- (b) ✅ Union kind: kind:'absent' literal 0
- (c) ✅ builder 분기: writer 알고리즘 신규 (header `[]` reject branch 추가, 다음 top-level key 직전 splice branch 추가)
- (d) ✅ AC1~AC22: 합계 ≥ 41 + 711 PASS 일관
- (e) ✅ stale 0: v1 의 "append-only writer" 표현 → v2 의 "section-range insertion" 으로 대체. v1 의 "≥ 42 / ≥ 710" → v2 의 "≥ 41 / ≥ 711"
- (f) ✅ header v2 ↔ §8.2 v2 ↔ footer v2 일관
- (g) ✅ exact phrase 보존 (3-anchor + arbitration_confidence)

### 8.1 v1 작성 (2026-04-26, analyst cycle #1)

**작성 의도** (사용자 핵심 요구 2026-04-26):
- 5.4 통합 개발 계획서 신규 작성. Stage 1 (이미 v7 APPROVE / 구현 staged) 의 결정사항을 **불변 reference** 로, Stage 2/3/4 는 **detailed 설계 + 단계 간 dependency + 통합 시나리오 + 통합 acceptance** 까지 모두.
- TDD 기반 — 모든 22 AC 가 RED→GREEN→REFACTOR 사이클.
- 5.4.1 plan v7 (codex Cycle #9 APPROVE 직전) 의 결정사항 1:1 인용 (불변).
- 검증 cycle: analyst v1 → master 1차 → codex 2차 → APPROVE 까지.

**v1 의 핵심 결정**:

| 결정 | 내용 | 위치 |
|---|---|---|
| **D1** | Stage 2 = JSON 기반 suggestion store (`.wikey/suggestions.json`) — sqlite migration 은 v2 deferral | §3.2.1 |
| **D2** | Stage 2 trigger = 옵션 A (ingest 직후 동기) — batch (옵션 B) deferral | §3.2.3 |
| **D3** | Stage 2 schema.yaml writer = section-range insertion (parse 안 함, line-level scan, header `[]` reject) — yaml 라이브러리 도입 거부 (v2 정정 후 v3/v4 일관) | §3.2.5 |
| **D4** | Stage 3 default = runtime-only — 자동 persist 금지 (사용자 review modal 필수) | §3.3.3 |
| **D5** | Stage 3 알고리즘 = deterministic pattern matching (default) — LLM 호출 옵션 (ii) v2 deferral | §3.3.2 |
| **D6** | Stage 4 default = union 알고리즘 — LLM arbitration opt-in | §3.4.2 |
| **D7** | Stage 4 = page-level 벡터만 (qmd index 그대로) — mention-level granularity v2 deferral | §3.4.2 |
| **D8** | 우선순위 = user-yaml > suggested > self-declared > converged > runtime > BUILTIN (high → low) | §3.4.5 |
| **D9** | 모든 Stage 가 fail 시 우아한 degradation — Stage 1 alone 으로 정상 동작 | §4.4 |
| **D10** | 통합 라이브 smoke = AC21 (별 AC, tester 책임) — vault fixture 신규 필요 (`fixture/standards-corpus/`) | §5 AC21 |

**Stage 1 reference (불변)**:

| Stage 1 항목 | todox v7 §위치 | 본 plan §위치 |
|---|---|---|
| 데이터 모델 (`StandardDecomposition` / `Component` / `DecompositionsState` 3-kind union) | v7 §3.1 | §3.1.1 |
| `BUILTIN_STANDARD_DECOMPOSITIONS` (PMBOK 10 + F3 aliases) | v7 §3.1 | §3.1.2 |
| `parseSchemaOverrideYaml` 4 시나리오 | v7 §3.2 | §3.1.3 |
| `buildStandardDecompositionBlock` 4 시나리오 분기 | v7 §3.3 | §3.1.4 |
| F1 v3 append 정책 | v7 §3.1 + §3.5 AC3 | §3.1.5 |
| `require_explicit_mention=true` hallucination guard | v7 §3.1 | §3.1.6 |
| `STANDARD_EXCEPTIONS` 갱신 (canonical slug 2개) | v7 §3.5 AC1 P3 | §3.1.7 |
| 9 AC + 19 신규 cases + 670 PASS baseline | v7 §3.5 + §3.6 | §3.1.8 + AC1 |

**v1 잔여 미결정 (codex review 대상)**:

| 미결정 | 영역 | 본 plan 결정 | codex 평가 요청 |
|---|---|---|---|
| **U1** | Stage 2 JSON store 의 rotation 임계 (현재 ingest 100 건) | 임의값 (1000 ingest = 4MB) | 임계 적정성 + 미래 sqlite migration trigger 정의 필요? |
| **U2** | Stage 3 LLM 호출 옵션 (ii) 의 deferral 적정성 | v1 deferral, v2 가능 | 사용자가 자료 본문 자체에서 표준 분해 추출을 요구하는 use case 의 우선순위? |
| **U3** | Stage 4 mention-level granularity 의 deferral | v1 deferral (page-level only) | qmd index 확장 비용 vs convergence 정확도 trade-off 평가 |
| **U4** | AC21 라이브 smoke 의 fixture corpus 정의 | "3 표준 × 2 source = 6 PDF" 명시만, 실제 fixture 미작성 | tester 가 cycle #4 이전에 fixture 준비? |
| **U5** | Stage 2 false positive guard 의 임계 (confidence ≥ 0.6 / minSiblings ≥ 3 / minSources ≥ 2) | 임의값 | 측정 데이터 없이 임계 결정 가능? Stage 2 alpha 단계에서 baseline 측정 후 조정? |

---

## 9. 7-anchor self-check (master 송부 전)

> rules.md §10 7-anchor 검증. analyst 산출 *전* 다음 7-anchor 를 grep 으로 자체 검증. stale ≥ 1건 시 즉시 fix.

| # | Anchor | 검증 결과 | 비고 |
|---|--------|----------|------|
| **(a)** | **시그니처 일관성** — type/interface 정의가 cross-file 동일 | ✅ | `Suggestion` / `SuggestionState` / `SelfDeclaration` / `SelfDeclarationPersistChoice` / `ConvergedDecomposition` / `SourceMention` 모두 §3.2.1 / §3.3.1 / §3.4.1 에서 한 번씩 정의 + 사용 위치 (§3.2.5 writer / §3.3.3 merge / §3.4.5 mergeAllSources) 에서 동일 시그니처. Stage 1 타입 (StandardDecomposition / StandardDecompositionsState / SchemaOverride) 은 §3.1.1 에서 todox v7 인용 그대로. cross-file 일관 ✅. |
| **(b)** | **state/data 표 형식** — 표 TS 표현이 §타입 정의 union kind 와 정확히 일치 | ✅ | StandardDecompositionsState 3-kind (empty-explicit / empty-all-skipped / present) — §3.1.3 표 + §3.1.4 builder 분기 + §3.3.3 mergeRuntimeIntoOverride 분기 모두 동일 kind 사용. SuggestionState 4-kind (pending / accepted / rejected / edited) — §3.2.1 정의 + §3.2.4 핸들러 + §3.2.8 shouldStage3ProposeRuntime 모두 동일. ConvergedDecomposition.arbitration_method ('union' \| 'llm') — §3.4.1 정의 + §3.4.2 arbitrate 함수 + AC17 test spec 모두 동일. SelfDeclarationPersistChoice 3-kind (runtime-only / pending-user-review / persisted) — §3.3.1 정의 + §3.3.3 decision tree + AC12 test spec 모두 동일. |
| **(c)** | **builder/parser 분기 코드** — 조건문이 모든 union kind / state 시나리오 처리 | ✅ | `buildStandardDecompositionBlock` 4 시나리오 (undefined / empty-explicit / empty-all-skipped / present) — §3.1.4 인용 + Stage 1 v7 §3.3 본체. 변경 X. `mergeRuntimeIntoOverride` 분기 (undefined / empty-all-skipped / empty-explicit / present) — §3.3.3 명시. `mergeAllSources` 우선순위 분기 — §3.4.5 명시. `shouldStage3ProposeRuntime` 분기 (no prior / pending / accepted / rejected) — §3.2.8 명시. 모든 union kind 도달 가능. |
| **(d)** | **AC test 케이스** — 각 AC 가 §시나리오와 1:1 매핑 | ✅ | AC1 → §3.1 (Stage 1 reference) / AC2~AC8 → §3.2 / AC9~AC14 → §3.3 / AC15~AC20 → §3.4 / AC21 → §4 (통합 시나리오) / AC22 → build+test baseline. 22 AC 가 모든 §3.X.Y subsection 과 1:1 매핑. 빠진 시나리오 0. |
| **(e)** | **self-check #N 모든 행** — drift 없음 (이전 버전 표현 잔존 0) | ✅ (v5 갱신) | v5 master self-fix cross-check 후 stale 0 확증: (1) "append-only" 본문 + decision 표 잔재 0 (§3.2.5 제목 + §8 D3 모두 v4/v5 정정). (2) Stage 4 prose 단독 `confidence` 잔존 0. (3) footer 다음 master 액션 v5/Cycle #5 일관. (4) §9 본 self-check 표 자체 v5 갱신. v5 본문 잔재 = Suggestion 타입 confidence (별 영역) + LLM mapper trigger + changelog 인용만. |
| **(f)** | **footer + 변경 이력 + cycle 번호** — header v # ↔ 변경 이력 ↔ footer cycle # 일관 | ✅ (v5 갱신) | header line 1 = "v5" / line 7 = "v5 (codex Cycle #4 NEEDS_REVISION 2 MED fix 완료...)" / §8.5 = "v5 master 직접 fix (2026-04-26, codex Cycle #4 NEEDS_REVISION 후속)" / footer = "v5 작성 완료 ... cycle #5 final APPROVE 검증 대기". 다음 master 액션 = "v5 plan ... Cycle #5 송부" v5 일관. 모두 v5 일관. |
| **(g)** | **코드 ↔ test exact phrase** — test assert string 이 builder/code 출력에 정확히 포함 | ✅ | AC1 의 anchor phrase ('묶지 말 것' + '직접 언급되지 않으면 추출하지 않는다 (hallucination 금지).' + 'PMBOK 10 knowledge areas 개별 추출') = Stage 1 v7 §3.3 builder pseudocode + §3.5 AC6.a 와 동일. AC7 의 grep `umbrella_slug: iso-27001` = §3.2.5 formatSuggestionAsYaml 출력 line 와 동일. AC10 의 title "PMBOK 개요" / "ISO 27001 Overview" = §3.3.2 classifyHeadingPattern keyword regex (`/개요|overview|introduction/`) 매치. AC18 의 `WIKEY_CONVERGENCE_ENABLED=true` = §3.4.3 reindex.sh hook bash variable 와 동일. exact phrase 모두 일관. |

**self-check 결과**: 7/7 ✅. master 송부 가능.

---

**v5 작성 완료. cycle 누적 결과**:
- Cycle #1 (codex Mode D, v1 review) — NEEDS_REVISION / MEDIUM. 5 finding → master 직접 fix → v2
- Cycle #2 (codex Mode D, v2 review) — NEEDS_REVISION / MEDIUM. 3 finding → master 직접 fix → v3
- Cycle #3 (codex Mode D, v3 review) — NEEDS_REVISION / MEDIUM. 3 finding → master 직접 fix → v4
- Cycle #4 (codex Mode D, v4 review) — NEEDS_REVISION / **LOW** (BUILD_BREAK_RISK 강등). 2 MED finding (§8 D3 decision append-only 잔재 + footer next-action v3 stale) → master 직접 fix → v5 (본 갱신)

**v5 잔여 미결정 0**. 모든 codex 결정사항 plan 본문 반영. cycle #5 final APPROVE 검증 대기.

**다음 master 액션**:
1. 본 v5 plan 의 7-anchor grep cross-check (master self-fix cross-check 의무 — rules.md §10.2) — v5 작성 시점에 수행, stale 0 확증
2. codex Mode D Panel Cycle #5 송부 (fresh panel, agent-management.md §2 따름)
3. APPROVE 시 사용자 승인 받아 Stage 2 구현 cycle 진입 (developer Agent in-process, agent-management.md §0 따름) + AC21 fixture corpus 6 자료 마련 (master 책임, U4)

---

## 10. v6 — 실 qmd embeddings 통합 (1순위 deferred follow-up, 2026-04-26 session 14)

> **배경**: v5 plan (Stage 4 alpha v1 wire) 은 mock embeddings JSON 으로만 검증 완료 — 실 의미 유사도 cluster 미검증. 본 §10 = phase-5-todo §5.4.7 1순위 deferred 작업의 mini plan.
>
> **목표**: qmd vector store 에서 mention 별 실 embedding 을 dump → run-convergence-pass.mjs 의 `--embeddings` 인자로 inject → ConvergedDecomposition 의 cluster 가 다국어 / synonym 자동 통합 인식.

### 10.1 정찰 결과 (2026-04-26 session 14 사전 정찰)

| # | 사실 | 출처 |
|---|------|------|
| (i) | qmd DB 위치 | `~/.cache/qmd/index.sqlite` (10.2 MB, 2026-04-26 18:03) |
| (ii) | sqlite-vec extension 가용성 | Python: ❌ macOS system Python sqlite3 binding 이 SQLITE_OMIT_LOAD_EXTENSION build (`enable_load_extension` 미지원). Node.js: ✅ `tools/qmd/node_modules/sqlite-vec` (v0.1.9, getLoadablePath() 가용) |
| (iii) | qmd schema (vec0 virtual table) | `vectors_vec(hash_seq TEXT PRIMARY KEY, embedding float[1024] distance_metric=cosine)`. content_vectors(hash, seq, model, embedded_at) 메타. documents.hash JOIN content.hash. |
| (iv) | mention-history schema | `{ version, ingests: [{ source, ingestedAt, concepts: [{slug, type}], entities: [{slug, type}] }] }`. 현재 7 ingests · **59 unique slug** (concepts/entities 통합) |
| (v) | qmd documents.path 형식 | `concepts/<slug>.md` / `entities/<slug>.md` (collection `wikey-wiki` 기준, base `/Users/denny/Project/wikey/wiki`) |
| (vi) | run-convergence-pass.mjs --embeddings 입력 형식 | `{ "<slug>": [number, ...×1024] }` JSON. 미지정 또는 load 실패 시 빈 Map → cluster 0 → graceful skip + warn (alpha v1 wire 본문 기존 명시) |

### 10.2 채택 path: Node.js + better-sqlite3 + sqlite-vec extension

**기각**:
- **Path 1 — Python sqlite-vec**: 정찰 (ii) 의 sqlite3 binding 한계. 별도 pyenv `--enable-loadable-sqlite-extensions` build 비용 ≥ 1 시간.
- **Path 3 — qmd CLI subprocess**: `qmd` CLI 명령 (query/search/vsearch/get/embed) 중 raw vector dump 명령 부재.

**채택**:
- **Path 2 — Node.js + better-sqlite3 + sqlite-vec**: tools/qmd/ 가 같은 stack 으로 검증. wikey-core 는 zero-deps 정책이라 deps 미보유 → tools/qmd/node_modules/ 의 deps 를 createRequire 로 재사용. **read-only SELECT 만** (qmd CLAUDE.md "DB 직접 수정 금지" 정책 준수). Float32 binary blob 은 Buffer → Float32Array reinterpret 으로 디코딩.

### 10.3 작업 단계

| # | 단계 | 산출 | 검증 |
|---|------|------|------|
| 1 | `scripts/qmd-embeddings-export.mjs` 작성 | 실행 가능 Node.js script | --help 동작 + dry-run 으로 schema 확증 |
| 2 | mention-history slug 추출 + qmd DB JOIN export | `.wikey/qmd-embeddings.json` (≤ 59 entry × 1024-dim, missing slug 은 warn skip) | JSON parse 가능 + dim 일관 (모든 vec.length === 1024) |
| 3 | run-convergence-pass.mjs 실 embeddings 실행 | 갱신된 `.wikey/converged-decompositions.json` | 결과 ≥ 1 ConvergedDecomposition 생성 (mock baseline 4 와 비교) |
| 4 | cluster 정확도 spot check | 한/영 페어 또는 synonym 페어 cosine ≥ 0.85 의미 유사도 | 본 §10.4 평가 표 채움 |

### 10.4 평가 표 (실 cluster 후 채움)

| umbrella_slug | components (실 embedding) | cluster size | spot-check (cosine 또는 의미) | 판정 |
|---------------|--------------------------|--------------|-------------------------------|------|
| (실행 후 채움) | | | | |

### 10.5 산출 위치

- 본 §10 = mini plan (analyst 위임 없이 master 직접 작성, todox 보조 문서 단일 소스)
- script: `scripts/qmd-embeddings-export.mjs`
- intermediate output: `.wikey/qmd-embeddings.json` (`.gitignore` 기존 `.wikey/` 정책 따름 — 가공 산출물)
- ConvergedDecomposition 갱신: `.wikey/converged-decompositions.json` (기존 위치)
- 결과 활동 문서: `activity/phase-5-result.md` 의 §5.4.7 1순위 → §5.4.8 신규 (실 qmd 통합) + 필요 시 보조 `activity/phase-5-resultx-5.4-real-qmd-embeddings-2026-04-26.md`

### 10.6 Acceptance

- [ ] script 실행 시 59 slug 중 가용한 모든 slug embedding 추출 (없는 slug 은 warn + skip, exit 0)
- [ ] convergence-pass 가 실 embeddings 로 ≥ 1 ConvergedDecomposition 생성 (mock baseline 4 와 비교 — 변동 시 본문 기록)
- [ ] cluster 정확도 spot-check ≥ 0.85 cosine 또는 의미 평가 PASS (한/영 / synonym 1 페어 이상)
- [ ] 회귀 baseline 유지 (732 PASS) — 본 mini plan 은 회귀 코드 변경 없는 범위 (script + 산출 JSON 만)
- [ ] activity/phase-5-result.md §5.4.7 1순위 [x] mark + commit

### 10.7 7-anchor self-check (mini plan 자체)

- (a) 시그니처 — 본 §10 은 신규 helper script 단일 + 기존 v5 plan 의 §3.4 데이터 모델 (ConvergedDecomposition / SourceMention) 그대로 사용. cross-file 일관 ✅.
- (b)~(g) — 본 §10 는 v5 본문 type/state 변경 없는 helper layer 추가라 기존 §9 self-check 결과 (7/7 ✅) 가 그대로 유효.

**다음 master 액션** (본 §10):
1. `scripts/qmd-embeddings-export.mjs` 작성 (Task #2)
2. 실행 → `.wikey/qmd-embeddings.json` 생성 (Task #3)
3. run-convergence-pass.mjs 실행 → 결과 비교 (Task #3)
4. cluster spot-check + activity 문서 + commit (Task #4)
