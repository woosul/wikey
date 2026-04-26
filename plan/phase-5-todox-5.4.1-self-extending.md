# Phase 5 §5.4.1 Stage 1 self-extending 구현계획 v7

> **상위 문서**: [`plan/phase-5-todo.md §5.4.1`](./phase-5-todo.md#541-stage-1--static-wikeyschemayaml-override-가까운-후속-두-번째-표준-등장-시-즉시-착수) · [`plan/phase-5-todox-5.4-integration.md`](./phase-5-todox-5.4-integration.md) (§5.4 통합 plan, Stage 1~4 모두 포괄) · [`activity/phase-5-result.md`](../activity/phase-5-result.md) — 본 문서는 **§5.4.1 Stage 1 한정** 보조 자료. file rename 2026-04-26 사용자 명명 정책 (기존 `phase-5-todox-5.4-self-extending.md` → `phase-5-todox-5.4.1-self-extending.md` — 5.4 자체는 통합 plan 으로 별 파일). 명명규칙: `phase-N-todox-<section>-<topic>.md` ([`rules/docs-organization.md`](../rules/docs-organization.md) 참조).
>
> **작성일**: 2026-04-26
> **버전**: v7 (cycle #8 APPROVE_WITH_CHANGES — MED 1건: §3.1 line 171 `type StandardDecompositionsState` 미-export ↔ AC1 line 448 export 요구 일관성 — master 직접 1-word fix (`type` → `export type`). cycle #9 final APPROVE 검증 대기 → APPROVE 시 사용자 승인 받아 developer hand-off. 잔여 미결정 0.)
> **v1 → v2 변경 요지**: M1 baseline 못박음 (584→648 PASS / build 0 errors) · M2 AC6 → AC6.a + AC6.b 분리 · M3 fallback 3-state · M4 YAML 실패 정책 silent skip + warn · M5 trigger 명료화 · M6 slug 충돌 first-wins.
> **v2 → v3 변경 요지**: F1 replace → **append** (built-in PMBOK + user entries 모두 출력) · F2 parser null 조건 + [] 3분리 (discriminated union) · F3 legacy PMBOK anchor 보존 (component aliases 도입, `project-time-management` / `project-human-resource-management`) · F4 `{{STANDARD_DECOMPOSITION_BLOCK}}` placeholder · F5 `components[].type: string` 런타임 검증 + entity 허용 일반화 · F6 ISO AC5 → AC5.a (5-control unit) + AC5.b (93-control fixture) · F7 entry gate vs no-regression 분리 · UNDECIDED #2 §5.5 deferral 확정. 상세 §7.
> **v3 → v4 변경 요지**: UNDECIDED #1 = (A) discriminated union + absent 단일화 (`undefined` 자체) · P2-1 disable 문법 (flow style 1 사용처 예외) · P2-2 §3.2.2/3.2.3 union 일관성 · P2-3 AC5.b line count 제거 · P2-4 default template PMBOK comment-out · P2-5 builder exact phrase ("묶지 말 것" + "직접 언급되지 않으면 추출하지 않는다") 보존 · P3 STANDARD_EXCEPTIONS 갱신 (canonical slug 2개) AC1 추가. 상세 §7.4.
> **v4 → v5 변경 요지**: codex cycle #3 NEEDS_REVISION = v4 fix 가 헤더/§3.2.2/§7.4 만 갱신했고 본문 6 위치에 stale 잔존. master 직접 일괄 정정 — §1.1 목표 2 (시그니처) / §3.1 SchemaOverride 정의 / §3.3 builder JSDoc + 분기 / §3.4 기존 vault 호환 / §3.5 AC2 (3) + AC3 (b) / §5 step 5 (PMBOK comment-out reference) / §8 self-check #1 + #3 / footer. v5 = stale 0건 확증 대상.
> **v5 → v6 변경 요지**: codex cycle #4 NEEDS_REVISION = v5 에 추가 stale 4 finding (HIGH 2 + MED 2). master 직접 정정 — §3.1 state 표 TS 표현 (`[]` / `readonly StandardDecomposition[]` → `{ kind: 'empty-explicit' }` / `{ kind: 'present', items: ... }`) / §3.2.1 parser null 조건 (`'absent'` → `undefined`) / §8 self-check #3 + #6 + #9 ("4-state" → "4 시나리오 = 3 union kind + undefined") / §3.1 append 정책 단락 (v4 mergeWithBuiltin 미지원 명료화 — yaml 한 파일에서 `[]` 와 entries 동시 불가능) / §3.6 R9 + §6.3 promotion 표 (같은 limitation 명시) / §5 step 3 builder 분기 표현 / §3.4 SCHEMA_OVERRIDE_TEMPLATE comment.
> **v6 → v7 변경 요지**: codex cycle #8 APPROVE_WITH_CHANGES (cycle #7 capture truncated → cycle #8 fresh retry, BUILD_BREAK_RISK: LOW). MED 1건 — §3.1 line 171 의 TS 예시 코드에서 `type StandardDecompositionsState = ...` 가 비-export 였음. AC1 (line 448) 은 "타입 export" 일관성을 명시 + §6.3 self-check #2 가 "BUILTIN_STANDARD_DECOMPOSITIONS export" 를 보장하는데 union state 만 export 누락 = drift. master 직접 1-word fix → `export type StandardDecompositionsState = ...`. 본문 다른 위치 (line 99/180 SchemaOverride 필드 사용) 는 type 정의 자체가 아니므로 영향 없음. v7 = stale 0건 + AC1 명시 일관성 확보.
> **우선순위**: P2 비전 gate. **즉시 착수 의도 아님.** 진입 trigger = 두 번째 표준 corpus (ISO 27001 / ITIL 4 / GDPR / SAFe / OWASP / OSI 7 Layer / 12 Factor App 등) 인제스트 시.
> **실행 단일 소스**: `plan/phase-5-todo.md §5.4` (체크박스 = 진행 상태). 본 문서는 Stage 1 상세 설계 + Stage 2~4 gate 정의만 기술 (체크박스 금지).
> **wiki 재생성 없음 확증**: 모든 Stage 는 신규 인제스트 경로에만 영향. 기존 wiki 페이지 보존 — 본체 §5.4 line 277 원칙.

---

## 1. 목표 / 비목표

### 1.1 목표 (Stage 1 v3 범위)

1. **하드코딩 제거 + built-in 보존** (M3) — `canonicalizer.ts:262` 작업 규칙 #7 의 PMBOK 10 영역 인라인을 제거하되, **코드 default (built-in PMBOK decomposition)** 로 이전 (모듈 내 상수 `BUILTIN_STANDARD_DECOMPOSITIONS`). `.wikey/schema.yaml` 의 `standard_decompositions` 가 미정의 (= override.standardDecompositions === undefined) 시 built-in 자동 사용.
2. **타입 확장** — `SchemaOverride` 에 `standardDecompositions?: StandardDecompositionsState` 필드 추가 (`types.ts:143-146`, v4 codex cycle #2 결정). State semantics: `undefined` = key 부재 (built-in 사용) / `{ kind: 'empty-explicit' }` = 명시 disable / `{ kind: 'empty-all-skipped', skippedCount: N }` = entries 모두 invalid skip (built-in fallback) / `{ kind: 'present', items: [...] }` = **append (built-in PMBOK + user entries 모두 출력)** (F1 v3).
3. **YAML 파서 확장** — `parseSchemaOverrideYaml` 가 `standard_decompositions:` top-level section 을 인식 (`schema.ts:289-354`). 빈 list (`standard_decompositions: []`) 와 미선언 (top-level key 부재) 과 모든 entry invalid skip 결과 빈 list 를 구분하여 전파 (F2 v3 명시).
4. **프롬프트 동적 생성** — `buildStandardDecompositionBlock(override)` 신규 함수가 작업 규칙 #7 블록을 동적으로 생성하고, `buildCanonicalizerPrompt` 가 해당 블록을 inline 치환. 3-state 입력에 따라 분기. **`{{STANDARD_DECOMPOSITION_BLOCK}}` placeholder 도 `overridePrompt` 분기에 추가** (F4).
5. **회귀 무결성** — 기존 PMBOK ingest 결과 (PMS 5-run Concepts CV) 가 변경 전후 동일 (deterministic 등가성). 라이브 측정은 AC6.b (tester 책임).
6. **두 번째 표준 즉시 등록 가능 + 명시 disable 옵션** (M3 v3 갱신) — (a) 기본: 사용자가 vault 에 entry 만 추가하면 **built-in PMBOK 위에 user-yaml 항목이 append (자동 통합 = 둘 다 작업 규칙 #7 텍스트에 출력)** (F1 v3 정정). (b) 사용자가 `standard_decompositions: []` 로 명시 disable 하면 작업 규칙 #7 블록 자체가 빈 상태 (PMBOK 분해 끔). (c) 두 번째 표준 (예: ISO-27001) entry 1 개 추가 → built-in PMBOK 유지 + ISO-27001 추가 출력 (R3 자동 해소).
7. **표준 분해의 entity 허용 일반화** (F5) — `StandardDecompositionComponent.type` 은 `string` 으로 두되, 런타임에 `getEntityTypes(override) ∪ getConceptTypes(override)` (`schema.ts:82-89`) 와 비교 검증. prompt 텍스트도 "별도 concept" → **"별도 entity 또는 concept"** 로 일반화 (예: 표준이 entity-type tool 을 component 로 가질 수 있음).

### 1.2 비목표 (out of scope, v3)

- **Stage 2~4 의 정확한 알고리즘**. v3 는 gate 조건만 정의 (§4 참조). Stage 2~4 측정 방식은 §4 안에서 보강 (Scrutiny d).
- **wiki 재생성 유발하는 모든 변경**. 본체 §5.4 원칙 — 기존 페이지 mutation 금지.
- **사용자 vault 강제 마이그레이션**. v3 의 3-state 정책 (M3) + append (F1) 로 기존 vault 는 schema.yaml 변경 없어도 built-in PMBOK 자동 적용 — §4.5.1.7.2 회귀 위험 해소. `SCHEMA_OVERRIDE_TEMPLATE` 갱신은 신규 vault 가 yaml 안에서 PMBOK 구조를 학습할 수 있도록 **참고용 주석 + 예시 entry** 추가 수준 (사용자가 자유로이 비활성화 가능).
- **runtime self-declaration / suggestion UI**. Stage 2~4 영역.
- **`FORCED_CATEGORIES` (`canonicalizer.ts:117-142`) 통합**. 별도 메커니즘으로 유지 — 표준 분해와 카테고리 핀은 의미가 다름.
- **Audit panel 의 YAML warning 통합** (M4 deferral, **UNDECIDED #2 v3 결정 = §5.5 후순위**). v3 는 `console.warn` 까지만 + spy 패턴 테스트 (AC2). UI 노출은 §5.5 별도 plan.
- **`loadSchemaOverride` 시그니처 확장** (UNDECIDED #2 v3 결정). `{ override, warnings }` 변경은 §5.5 후순위. v3 §5.4.1 안에서는 호출 site 6 곳 (ingest-pipeline `:491` + schema-override.test 5 곳) 미변경.

---

## 2. 현재 코드 사실 (analyst 직접 확인)

| 항목 | 위치 | 현재 상태 |
|---|---|---|
| `SchemaOverride` 타입 | `wikey-core/src/types.ts:143-146` | `entityTypes`, `conceptTypes` 만 (각 `SchemaCustomType[]`) |
| 작업 규칙 #7 PMBOK 하드코딩 | `wikey-core/src/canonicalizer.ts:262` | 10 knowledge areas slug 인라인 (`project-integration-management` … `project-stakeholder-management`) |
| PMBOK 이행 안내 주석 | `wikey-core/src/canonicalizer.ts:209-216` | "다음 표준이 들어와도 여기 추가하지 말고 §5.6(현 §5.4) Stage 1 먼저 착수" 명시 |
| `buildSchemaPromptBlock` | `wikey-core/src/schema.ts:236-266` | entity/concept 블록 동적 생성 (built-in + override) |
| `parseSchemaOverrideYaml` | `wikey-core/src/schema.ts:289-354` | `entity_types:` / `concept_types:` 만 인식. `standard_decompositions:` 미지원 |
| `loadSchemaOverride` | `wikey-core/src/schema.ts:360-367` | `WikiFS` 통해 `.wikey/schema.yaml` 읽음 (default path) |
| ingest 진입 지점 | `wikey-core/src/ingest-pipeline.ts:490-494` | `loadSchemaOverride(wikiFS)` 호출 → canonicalizer 인자로 forward |
| 사용자 vault default template | `wikey-obsidian/src/settings-tab.ts:1118-1135` | `SCHEMA_OVERRIDE_TEMPLATE` 상수. entity/concept type 예시만 (PMBOK entry 없음) |
| 사용자 vault Modal | `wikey-obsidian/src/settings-tab.ts:1141+` | `SchemaOverrideEditModal` — 사용자가 vault `.wikey/schema.yaml` 직접 편집 |
| Phase 4 §4.5.1.7.2 PMBOK hint test | `wikey-core/src/__tests__/canonicalizer.test.ts` | `it('includes PMBOK 10 knowledge areas hint (§4.5.1.7.2)')` 존재 — Stage 1 변경 시 함께 갱신 필요 |
| schema-override 기존 테스트 | `wikey-core/src/__tests__/schema-override.test.ts:253-279` | `.wikey/schema.yaml` 로드 + `custom/schema.yaml` 경로 + 빈 파일 케이스 |

**주의**: 본체 §5.4 line 271 의 "이전 번호 §5.6" 표기는 todo 재편 결과 — 코드 주석 (`canonicalizer.ts:214`) 은 아직 §5.6 표기. Stage 1 작업 시 함께 §5.4 로 정정 (Surgical: 같은 함수 주석이라 동일 changeset 안에서 처리).

---

## 3. Stage 1 상세 설계 (즉시 착수 가능)

### 3.1 데이터 모델 (`types.ts` 확장)

```ts
// wikey-core/src/types.ts — line 143 부근

/**
 * Stage 1 (§5.4.1): 표준 분해 규칙. 한 표준 (예: PMBOK, ISO 27001) 이 N 하위 영역으로
 * 분해되는 구조를 schema.yaml 에서 선언적으로 등록한다. canonicalizer 프롬프트의 작업
 * 규칙 #7 (PMBOK 10 areas 하드코딩) 을 대체. require_explicit_mention=true 면 본문에
 * 해당 영역이 직접 등장해야만 추출 (hallucination guard).
 *
 * v3 변경 (F3, F5):
 *  - components[].aliases: alternate slug (예: project-time-management, project-human-resource-management)
 *  - components[].type: string (런타임 검증으로 ConceptType ∪ EntityType ∪ override 추가분 확인)
 */
export interface StandardDecompositionComponent {
  readonly slug: string                            // canonical slug (lowercase, hyphen-separated)
  readonly type: string                            // F5: 런타임 검증 (getEntityTypes ∪ getConceptTypes)
  readonly aliases?: readonly string[]             // F3: 동일 component 의 alternate slug (legacy 보존)
}

export interface StandardDecomposition {
  readonly name: string                            // "PMBOK" — display name
  readonly aliases: readonly string[]              // ["Project Management Body of Knowledge", "프로젝트 관리 지식체계"]
  readonly umbrella_slug: string                   // "project-management-body-of-knowledge"
  readonly components: readonly StandardDecompositionComponent[]
  readonly rule: 'decompose' | 'bundle'            // decompose = 하위 개별 추출, bundle = umbrella 1개로 묶음
  readonly require_explicit_mention: boolean       // default true (hallucination guard)
  readonly origin?: 'hardcoded' | 'user-yaml' | 'suggested' | 'self-declared' | 'converged'
  readonly confidence?: number                     // Stage 2+ 자동 학습 산출물일 때만
}

export interface SchemaOverride {
  readonly entityTypes: readonly SchemaCustomType[]
  readonly conceptTypes: readonly SchemaCustomType[]
  readonly standardDecompositions?: StandardDecompositionsState   // v4: discriminated union 3-state, undefined = absent
}

// wikey-core/src/schema.ts — 모듈 내 상수 (export, F3 component aliases 포함)
export const BUILTIN_STANDARD_DECOMPOSITIONS: readonly StandardDecomposition[] = [
  {
    name: 'PMBOK',
    aliases: ['Project Management Body of Knowledge', '프로젝트 관리 지식체계'],
    umbrella_slug: 'project-management-body-of-knowledge',
    rule: 'decompose',
    require_explicit_mention: true,
    origin: 'hardcoded',
    components: [
      { slug: 'project-integration-management', type: 'methodology' },
      { slug: 'project-scope-management', type: 'methodology' },
      // F3: legacy alternate slug 보존 — Phase 4 §4.5.1.7.2 prompt 의 "(또는 ...)" 텍스트 동등성
      { slug: 'project-schedule-management', type: 'methodology', aliases: ['project-time-management'] },
      { slug: 'project-cost-management', type: 'methodology' },
      { slug: 'project-quality-management', type: 'methodology' },
      { slug: 'project-resource-management', type: 'methodology', aliases: ['project-human-resource-management'] },
      { slug: 'project-communications-management', type: 'methodology' },
      { slug: 'project-risk-management', type: 'methodology' },
      { slug: 'project-procurement-management', type: 'methodology' },
      { slug: 'project-stakeholder-management', type: 'methodology' },
    ],
  },
]
```

**3-state 의미** (M3 + F1 v3 append 확정):

| 상태 | YAML 표현 | TS 표현 (`override.standardDecompositions`) | 효과 |
|---|---|---|---|
| **default (built-in)** | `standard_decompositions:` 키 부재 | `undefined` | `BUILTIN_STANDARD_DECOMPOSITIONS` (PMBOK) 사용. §4.5.1.7.2 효과 자동 보존. |
| **명시 disable** | `standard_decompositions: []` (block-empty 또는 flow `[]` 예외) | `{ kind: 'empty-explicit' }` | 작업 규칙 #7 블록이 빈 상태 — PMBOK 분해 끔. |
| **all-skipped fallback** | `standard_decompositions: <list>` + 모든 entry invalid | `{ kind: 'empty-all-skipped', skippedCount: N }` | console.warn 후 built-in PMBOK 적용 (silent disable 방지). |
| **append (built-in + user)** (F1 v3 정정) | `standard_decompositions: [{...}, ...]` | `{ kind: 'present', items: readonly StandardDecomposition[] }` (length ≥ 1) | **`BUILTIN_STANDARD_DECOMPOSITIONS` 위에 user entries 를 append** 하여 둘 다 작업 규칙 #7 텍스트에 출력. user 가 ISO-27001 추가 → PMBOK 유지 + ISO-27001 추가. R3 (사용자가 ISO 만 추가하면 PMBOK 끊김) 위험 자동 해소. |

**선택 이유** (v3 갱신):
- 기존 vault `.wikey/schema.yaml` 가 PMBOK entry 미보유 시 자동 built-in fallback → R1 (High → Low) 해소.
- 사용자 명시 disable 경로 보존 (`[]`) → "user-yaml > hardcoded" 원칙 유지.
- **append 정책 (F1 v3, v4 명료화)**: 사용자가 ISO-27001 entry 만 추가해도 PMBOK 자동 유지 — silent regression 방지. 사용자가 PMBOK 끄고 싶으면 `standard_decompositions: []` 명시 (= `{ kind: 'empty-explicit' }`). **단 v4 설계 한계**: append 정책 + M6 first-wins 결합으로 user 가 PMBOK 을 *본인 정의로 교체* 하는 경로가 없음 — `[]` 와 user entries 를 동시에 표현 불가능 (`empty-explicit` vs `present` 는 mutually exclusive), append 정책상 user 의 PMBOK entry 는 built-in 과 first-wins 충돌로 drop. 이 use case 는 v4 미지원 — 필요 시 future `mergeWithBuiltin: 'replace' \| 'append'` 옵션 도입 (Stage 2 이후, §6.3 잔여 결정 X = v4 mergeWithBuiltin 미도입).
- `undefined` vs `[]` 구분 필요 → `parseSchemaOverrideYaml` 가 두 상태를 별개로 반환해야 함 (§3.2).
- **F5 components[].type: string**: ConceptType ∪ EntityType ∪ override 추가분이 모두 valid. 컴파일 타임 union 으로 묶으면 override 추가분이 결정 못 됨 — 런타임 검증으로 일반화.
- **F3 component aliases**: Phase 4 §4.5.1.7.2 의 prompt 가 "schedule (또는 time)", "resource (또는 human-resource)" 표기를 가지므로 v3 의 legacy anchor 보존 필요. component 단위 aliases 도입.

**테스트 영향**: 기존 6 fixture (`schema-override.test.ts`) 는 `entityTypes/conceptTypes` 만 검증해 `standardDecompositions` 필드 미사용 → 호환 OK. 신규 3-state + append + component aliases 검증 테스트는 AC2 + AC3 + AC4 에서 추가.

### 3.2 YAML 파서 확장 (`schema.ts:289-354`)

기존 파서는 single-level (`name`, `description`) flat shape 만 처리. `standard_decompositions:` 는 nested + list-of-list 가 필요해 **별도 sub-parser 분리**. 기존 `entity_types/concept_types` 루프는 그대로 두고 새 section 만 추가.

#### 3.2.1 parser null 반환 조건 변경 (F2 v3 명시)

**현재 코드** (`schema.ts:352`): `if (entityTypes.length === 0 && conceptTypes.length === 0) return null`.

**v4 변경**:
- `standard_decompositions` 만 유효한 경우에도 SchemaOverride 반환되어야 함.
- 신규 조건: `entityTypes.length === 0 && conceptTypes.length === 0 && standardDecompositions === undefined` 일 때만 null 반환.
- 즉 **세 section 모두 entry 없음 + standard_decompositions 키 자체 부재** 시에만 null.
- explicit `standard_decompositions: []` (key 존재, 항목 0) 인 경우는 SchemaOverride 객체 반환 — `standardDecompositions: { kind: 'empty-explicit' }` 로 caller 가 explicit disable 의도를 인지.

#### 3.2.2 [] semantics 3분리 (F2 v3 + Scrutiny b)

YAML 의 세 가지 시나리오를 parser 가 모두 구분 가능해야 함. **(A) discriminated union 채택** (codex cycle #2 결정, 2026-04-26):

```ts
// wikey-core/src/types.ts — SchemaOverride 의 standardDecompositions 필드 정밀화
//
// 결정 (codex cycle #2): absent 는 별도 kind 로 표현하지 않고 `standardDecompositions === undefined`
// 자체로 의미. union 은 3-state — empty-explicit | empty-all-skipped | present. 이 단일화로
// "absent" 가 두 가지로 표현될 가능성 (`undefined` vs `{ kind: 'absent' }`) 완전 차단.
export type StandardDecompositionsState =
  | { readonly kind: 'empty-explicit' }                               // YAML: standard_decompositions: [] (block-empty)
  | { readonly kind: 'empty-all-skipped'; readonly skippedCount: number }  // entries 모두 invalid skip
  | { readonly kind: 'present'; readonly items: readonly StandardDecomposition[] }

export interface SchemaOverride {
  readonly entityTypes: readonly SchemaCustomType[]
  readonly conceptTypes: readonly SchemaCustomType[]
  // standardDecompositions === undefined ⟺ YAML 키 부재 (absent). 정의되어 있으면 위 3 kind 중 하나.
  readonly standardDecompositions?: StandardDecompositionsState
}
```

**[] semantics state 표** (4 시나리오 = `undefined` 1 + 3 union kind, P2-1 명시 disable 문법 + P2-2 union 일관성, codex cycle #2 fix):

| YAML | parser 결과 (`standardDecompositions`) | block 동작 (§3.3) |
|---|---|---|
| `standard_decompositions:` 키 부재 | `undefined` | built-in PMBOK 적용 |
| `standard_decompositions:` (값 부재, block-empty) | `{ kind: 'empty-explicit' }` | 빈 string `''` (explicit disable) |
| `standard_decompositions: []` (flow style, **이 한 사용처에 한해 허용** — 다른 위치 미지원) | `{ kind: 'empty-explicit' }` | 빈 string `''` (explicit disable) |
| `standard_decompositions: <list>` + 모든 entry invalid silent skip | `{ kind: 'empty-all-skipped', skippedCount: N }` + 추가 `console.warn('[wikey] all standard_decompositions entries dropped (N invalid), falling back to built-in PMBOK')` | **built-in PMBOK 적용** (silent disable 방지) |
| `standard_decompositions: <list>` + 일부 valid | `{ kind: 'present', items: [...] }` | built-in + user items append (F1) |

**P2-1 명시 disable 문법** (codex cycle #2): YAML "minimal subset" 정책 (§3.2.3) 은 일반적으로 flow style `[...]` inline 미지원이지만, **explicit disable 의 한 사용처 — `standard_decompositions: []` 형태 — 만 예외 허용**. 또한 `standard_decompositions:` 값 부재 (block-empty) 도 동일 의미로 인식. parser 가 두 형태 모두 `{ kind: 'empty-explicit' }` 로 정규화. 다른 어떤 위치 (`aliases`, `components` 등) 에서도 flow style 금지.

**(B) 안 검토 결과 — 폐기**: 단순 `StandardDecomposition[] | undefined` 는 empty-explicit vs empty-all-skipped 구분이 builder 의 sideband 정보 (warn flag) 에 의존해야 함 → 시그니처 외부에서 disable 의도 식별 불가. `loadSchemaOverride` 호출 site 6 곳에 분기 1 줄 추가 비용 < empty-all-skipped silent disable 위험 회피 가치. UNDECIDED #2 §5.5 deferral 영향 없음 — `loadSchemaOverride` 시그니처는 그대로 `SchemaOverride | null` 유지, 내부 필드만 union.

#### 3.2.3 검증 규칙 + Scrutiny (c) 명문화

**신규 schema 형식 + minimal YAML subset 명세** (Scrutiny c):

- **indentation**: 2-space (default) 또는 4-space 만. **tab 거부** (만나면 line skip + warn). YAML anchors/aliases (`&`, `*`), multi-line scalars (`|`, `>`), flow style (`{...}`, `[...]` inline) **미지원** — **단 1개 예외**: `standard_decompositions: []` 의 explicit disable 용도 한 사용처만 허용 (P2-1, §3.2.2 표 참조). 다른 어떤 키도 flow style 거부 + warn.
- **aliases (top-level standard) 와 components[].aliases**: 둘 다 list-of-string 이며 같은 shape.
- **components**: list of `{ slug, type, aliases? }`. `slug` 와 `type` 누락 시 항목 skip + warn. `aliases` optional list-of-string.

```yaml
standard_decompositions:
  - name: PMBOK
    umbrella_slug: project-management-body-of-knowledge
    rule: decompose
    require_explicit_mention: true
    aliases:                         # list of strings (top-level)
      - Project Management Body of Knowledge
      - 프로젝트 관리 지식체계
    components:                      # list of { slug, type, aliases? }
      - slug: project-integration-management
        type: methodology
      - slug: project-schedule-management
        type: methodology
        aliases:                     # F3 — alternate slug (component 단위, optional)
          - project-time-management
      # ... 8 more
```

검증 규칙 (실패 시 항목 silent skip + console.warn — 기존 `entity_types` 와 동일 정책):

| 검증 | 실패 시 |
|---|---|
| `name` 비어있지 않음 | 항목 skip |
| `umbrella_slug` lowercase + hyphen-only (`/^[a-z][a-z0-9-]*$/`) | 항목 skip |
| `rule` ∈ {`decompose`, `bundle`} | 항목 skip |
| `components` ≥ 1 entry | 항목 skip |
| `components[].slug` 누락 또는 lowercase + hyphen-only 위반 (Scrutiny c) | **component skip** (decomposition 자체는 보존, 해당 component 만 drop) + warn |
| `components[].slug` 동일 항목 안에서 중복 없음 | 중복만 skip |
| `components[].type` (F5 v3 — `string` 런타임 검증) ∈ `getEntityTypes(override) ∪ getConceptTypes(override)` | **component skip** + warn (decomposition 자체는 보존) |
| `components[].aliases` (F3, optional) — list-of-string, 동일 항목 안에서 중복 없음 | 중복만 skip |
| `umbrella_slug` 가 같은 schema 안 다른 decomposition 의 component slug 와 충돌 | 항목 skip |
| **component slug 충돌 (서로 다른 decomposition 간 — built-in 포함)** (M6 + F1 append) | **first-wins** + `console.warn('[wikey] decomposition component slug duplicate: ${slug} owned by ${first.name}, skipped from ${second.name}')`. 두 번째 decomposition 의 해당 component 만 drop, decomposition 자체는 보존. **append 정책으로 built-in vs user 충돌도 동일 first-wins** = built-in 측이 우선. |
| `require_explicit_mention` 누락 | default `true` |
| `origin` 누락 | default `'user-yaml'` (built-in 의 경우 `'hardcoded'` — `BUILTIN_STANDARD_DECOMPOSITIONS` 상수가 명시) |
| `aliases` (top-level) 누락 | default `[]` |
| `aliases` (component 단위) 누락 | undefined (optional) |
| **모든 entry invalid skip** (F2 v3 신규) | parser 가 `{ kind: 'empty-all-skipped', skippedCount: N }` 반환 (빈 array `[]` 가 아닌 discriminated union) + 추가 warn `[wikey] all standard_decompositions entries dropped (N invalid), falling back to built-in PMBOK`. builder 가 built-in 으로 fallback. |

**파싱 실패 정책** (M4 — v2 확정):

- **항목 단위 silent skip + `console.warn`** — entity_types / concept_types 와 일관. 단일 entry 가 검증 실패하면 그 entry 만 빠지고 나머지는 통과.
- 메시지 형식: `[wikey] schema.yaml standard_decomposition skipped (<entry index or name>): <reason>`.
- **section 부재 vs explicit disable vs all-skipped 구분** (P2-2, codex cycle #2 fix): 파서는 다음 4 시나리오를 정확히 구분 (§3.2.2 표 참조):
  1. `standard_decompositions:` top-level key 자체 부재 → `standardDecompositions` 필드 자체를 SchemaOverride 에 **포함하지 않음** (= `undefined`).
  2. 키 + 값 부재 (block-empty) 또는 `standard_decompositions: []` (flow exception) → `{ kind: 'empty-explicit' }`.
  3. 키 + 항목 ≥ 1 + 모두 검증 실패 silent skip → `{ kind: 'empty-all-skipped', skippedCount: N }` + warn.
  4. 키 + 항목 ≥ 1 + 일부 valid → `{ kind: 'present', items: [...] }`.
  - **§3.2.2 표가 단일 진실** — §3.2.3 검증 규칙 표 마지막 행 ("모든 entry invalid skip 결과 빈 list") 도 위 시나리오 3 = `empty-all-skipped` kind 반환. parser 가 빈 array `[]` 를 직접 반환하지 않음 (always discriminated union).
- **시그니처 변경 deferral** (M4 codex 의견 청취): `loadSchemaOverride` 가 `{ override, warnings: string[] }` 로 확장하는 안은 v2 미채택. 현재는 `console.warn` 까지. UI 노출 (Audit panel) 통합은 §5.5 후순위 — codex 가 "warning 가 사용자에게 보이지 않으면 silent failure 와 같다" 판단 시 시그니처 확장으로 revise (§6.3 잔여 미결정 #2).
- **호출 site 영향**: 시그니처 유지 → `loadSchemaOverride` 호출 site 6 곳 (grep 기준: ingest-pipeline `:491`, schema-override.test 5 곳) 변경 없음. Surgical 원칙 유지.

**파서 구현 메모**:
- 기존 flat parser (line 323-349) 와 분리 — `parseStandardDecompositionsSection()` private helper.
- list 안에 list (`components: - slug: x type: y`) 가 필요. 기존 `current = { name, description }` accumulator 패턴을 nested state machine 으로 확장.
- 의존성 추가 회피 (yaml 라이브러리 도입 거부 — `parseSchemaOverrideYaml` doc 주석 line 277-287 의 minimal subset 정책 유지).

### 3.3 `buildStandardDecompositionBlock` 신규 함수

```ts
// wikey-core/src/schema.ts — buildSchemaPromptBlock 직후 (line 267 부근)

/**
 * Stage 1 (§5.4.1): build the canonicalizer 프롬프트 작업 규칙 #7 (표준 분해) 블록.
 *
 * v4 분기 (F1 append + F2 discriminated union, codex cycle #2 단일화 — absent 는 undefined):
 *   state === undefined                 → built-in PMBOK 만 출력 (key 부재 = absent)
 *   state.kind === 'empty-explicit'     → '' (explicit disable)
 *   state.kind === 'empty-all-skipped'  → built-in PMBOK 만 출력 (silent disable 방지)
 *   state.kind === 'present'            → BUILT-IN PMBOK 위에 user items 를 append
 *
 * F3 component aliases: components[].aliases 가 있으면 prompt 텍스트에 "(또는 alt-slug)" 형태로 포함.
 * F5 entity 일반화: prompt 텍스트는 "별도 entity 또는 concept 로 분해".
 */
export function buildStandardDecompositionBlock(
  override?: SchemaOverride,
): string {
  const state = override?.standardDecompositions   // discriminated union (F2)

  // F2: kind 별 분기
  if (state?.kind === 'empty-explicit') return ''   // explicit disable

  // undefined (absent) | empty-all-skipped → built-in only
  // present → built-in + user items (F1 append)
  let decomps: readonly StandardDecomposition[]
  if (!state || state.kind === 'empty-all-skipped') {   // v4: !state 가 undefined (absent) 잡음
    decomps = BUILTIN_STANDARD_DECOMPOSITIONS
  } else {
    // F1 append: built-in 위에 user items 를 합침 (M6 first-wins 검증은 parser 가 이미 처리)
    decomps = [...BUILTIN_STANDARD_DECOMPOSITIONS, ...state.items]
  }

  if (decomps.length === 0) return ''   // defensive — 정상 경로에선 도달 X

  const sections: string[] = []
  for (const d of decomps) {
    if (d.rule === 'bundle') {
      sections.push(
        `- **${d.name}** (rule: bundle): 본문 등장 시 \`${d.umbrella_slug}\` 1 개로 묶고 하위 영역 분해 금지.`,
      )
      continue
    }
    // rule === 'decompose'
    // F3 component aliases — 출력에 "(또는 alt-slug)" 형태로 포함 (legacy anchor 보존)
    const componentsList = d.components
      .map((c) => {
        const altPart = c.aliases && c.aliases.length > 0
          ? ` (또는 ${c.aliases.map((a) => `\`${a}\``).join(' / ')})`
          : ''
        return `\`${c.slug}\`${altPart} (${c.type})`
      })
      .join(', ')
    // P2-5 codex cycle #2 fix: legacy PMBOK prompt test exact phrases 보존 —
    // canonicalizer.test.ts:230 의 두 anchor phrase '묶지 말 것' + '직접 언급되지 않으면 추출하지 않는다' 가
    // 정확히 텍스트에 등장해야 기존 648 baseline regression 회피.
    const explicit = d.require_explicit_mention
      ? '본문에 해당 영역이 직접 언급되지 않으면 추출하지 않는다 (hallucination 금지).'
      : '관련 영역 모두 추출 가능.'
    sections.push(
      `- **${d.name}** (rule: decompose, ${d.components.length}개 영역): ` +
      `본문에 ${d.name} / ${d.aliases.join(' / ') || d.umbrella_slug} 맥락이 등장하면 ` +
      `다음 ${d.components.length}개 영역은 각각 **별도 entity 또는 concept** 로 분해하고 ` +   // F5 일반화 + "다음 N 영역" 형식 보존
      `상위 \`${d.umbrella_slug}\` 하나로 묶지 말 것. ${explicit} ` +   // P2-5: "묶지 말 것" exact phrase
      `대상: ${componentsList}.`,
    )
  }
  return ['## 표준 분해 규칙 (작업 규칙 #7)', '## PMBOK 10 knowledge areas 개별 추출 (concepts 결정화)', '', ...sections].join('\n')
  // ↑ "PMBOK 10 knowledge areas 개별 추출" marker 는 §4.5.1.7.2 prompt 의 anchor 보존용 (F3, AC6.a)
}
```

**선택 이유** (v3 갱신):
- `state.kind` 분기 = F2 discriminated union 핵심. `empty-explicit` 만 빈 string, `empty-all-skipped` 는 built-in 으로 fallback (silent disable 방지).
- F1 append: `[...BUILTIN..., ...state.items]` — user 가 ISO-27001 만 추가해도 built-in PMBOK 자동 유지.
- F3 component aliases: `(또는 alt-slug)` 텍스트로 §4.5.1.7.2 prompt 의 legacy anchor 보존.
- F5 entity 일반화: "별도 concept 로 분해" → "별도 entity 또는 concept 로 분해". component[].type 이 entity-type 일 때도 prompt 의미 일관.
- "PMBOK 10 knowledge areas 개별 추출" marker line 추가: AC6.a string-equivalence 가 §4.5.1.7.2 prompt 의 marker 텍스트를 그대로 anchor 로 검증할 수 있도록 보존 (F3).
- **P2-5 (codex cycle #2)**: `canonicalizer.test.ts:230` 의 exact phrase 두 개 — `'묶지 말 것'` + `'직접 언급되지 않으면 추출하지 않는다'` — builder 출력에 정확히 등장. text:
  - `... 하나로 묶지 말 것.` — "묶지 말고" → "묶지 말 것." 로 바꿈
  - `본문에 해당 영역이 직접 언급되지 않으면 추출하지 않는다 (hallucination 금지).` — exact phrase 그대로
  - 추가로 §4.5.1.7.2 prompt 의 "다음 N 영역" 표현도 빌더 출력에 포함 — `다음 ${count}개 영역은 각각 별도 entity 또는 concept 로 분해`.
- `schema.ts` 에 두는 이유: 같은 파일의 `buildSchemaPromptBlock` 과 일관 (둘 다 prompt block builder + override 인자).
- LLM 프롬프트 텍스트는 한국어 유지 (현재 `canonicalizer.ts:248-286` 가 한국어).

### 3.4 `canonicalizer.ts` 변경

현재 (line 254-262):

```ts
return `당신은 wikey LLM Wiki의 canonicalizer입니다. ...

## 작업 규칙

1. **분류**: ...
...
7. **PMBOK 10 knowledge areas 개별 추출** (concepts 결정화): 본문에 PMBOK / 프로젝트 관리 지식체계 맥락이 등장하면 다음 10 영역은 각각 **별도 concept** 로 추출하고 상위 \`project-management-body-of-knowledge\` 하나로 묶지 말 것. ...

## 입력 mention (${mentions.length}개)
```

Stage 1 변경 (default prompt 분기 + overridePrompt 분기 모두 F4 placeholder 적용):

```ts
const decompositionBlock = buildStandardDecompositionBlock(schemaOverride)

// F4 v3: overridePrompt 분기에 {{STANDARD_DECOMPOSITION_BLOCK}} placeholder 추가
if (overridePrompt && overridePrompt.trim()) {
  return overridePrompt
    .replaceAll('{{SOURCE_FILENAME}}', sourceFilename)
    .replaceAll('{{GUIDE_BLOCK}}', guideBlock)
    .replaceAll('{{SCHEMA_BLOCK}}', schemaBlock)
    .replaceAll('{{STANDARD_DECOMPOSITION_BLOCK}}', decompositionBlock)   // F4 신규
    .replaceAll('{{EXISTING_BLOCK}}', existingBlock)
    .replaceAll('{{MENTIONS_BLOCK}}', mentionsBlock)
    .replaceAll('{{MENTIONS_COUNT}}', String(mentions.length))
}

// default prompt 분기 (작업 규칙 #7 인라인 → decompositionBlock 치환)
return `당신은 wikey LLM Wiki의 canonicalizer입니다. ...

## 작업 규칙

1. **분류**: ...
6. **description**: 1~2문장, 산업 표준 정의 위주 (기능 설명 X).
${decompositionBlock ? '\n' + decompositionBlock + '\n' : ''}
## 입력 mention (${mentions.length}개)
```

**변경 라인 수**: import 1 줄 + decompositionBlock 변수 1 줄 + 작업 규칙 #7 약 80자 인라인 제거 + default 치환부 1 줄 + overridePrompt placeholder 1 줄 (F4) = 순감 (Surgical 원칙). built-in 상수는 `schema.ts` 에 추가 (canonicalizer.ts 무관).

**default vault 보존** (M3 v2 + P2-4 codex cycle #2 fix): 코드 default 가 `BUILTIN_STANDARD_DECOMPOSITIONS` 로 PMBOK 을 보장. **append 정책 (F1) 으로 인한 중복 위험 차단** — `SCHEMA_OVERRIDE_TEMPLATE` 의 PMBOK entry 를 active YAML 로 두면 built-in + template = duplicate PMBOK (M6 first-wins 로 component slug 충돌 발생). 따라서 v4 결정: **template 의 PMBOK entry 전체를 comment-out** (`#` prefix). 사용자에게 학습용 reference 로만 노출, 실제 yaml parse 대상에서 제외. ISO-27001 등 추가 표준 등록 시 사용자가 comment 해제 후 자기 entry 추가하는 방식.

```yaml
# (기존 entity_types / concept_types 그대로)

# Standard decomposition rules (§5.4 Stage 1)
# - 이 키 자체를 생략하면 built-in PMBOK 분해가 자동 적용됨 (default).
# - 명시적으로 PMBOK 을 끄려면 `standard_decompositions: []` (빈 list).
# - 추가 표준 (ISO-27001 / ITIL 4 등) 은 아래 주석된 형식을 참고해 entry 추가.
# - 아래 PMBOK entry 는 **built-in 의 yaml 표현** — 코드가 자동 적용하므로 yaml 에 다시 작성하지 말 것.
#   참고용으로 comment-out 상태 유지. v4 설계상 user 가 PMBOK 을 *본인 정의로 교체* 는 미지원
#   (append + first-wins 결합) — future mergeWithBuiltin 옵션 등장 시 enable. 현재는 PMBOK 끄려면 [] 만.
#
# standard_decompositions:
#   - name: PMBOK
#     umbrella_slug: project-management-body-of-knowledge
#     rule: decompose
#     require_explicit_mention: true
#     aliases:
#       - Project Management Body of Knowledge
#       - 프로젝트 관리 지식체계
#     components:
#       - slug: project-integration-management
#         type: methodology
#       - slug: project-scope-management
#         type: methodology
#       - slug: project-schedule-management
#         type: methodology
#         aliases:
#           - project-time-management
#       - slug: project-cost-management
#         type: methodology
#       - slug: project-quality-management
#         type: methodology
#       - slug: project-resource-management
#         type: methodology
#         aliases:
#           - project-human-resource-management
#       - slug: project-communications-management
#         type: methodology
#       - slug: project-risk-management
#         type: methodology
#       - slug: project-procurement-management
#         type: methodology
#       - slug: project-stakeholder-management
#         type: methodology
```

**기존 vault 호환** (M3 v2 + F1 v3 append + v4 discriminated union 단일화, R1/R3 해소): `.wikey/schema.yaml` 가 이미 vault 에 존재하고 `standard_decompositions:` 키 자체가 없으면 → `parseSchemaOverrideYaml` 결과의 `standardDecompositions` 필드가 `undefined` (= absent) → `buildStandardDecompositionBlock` 가 `BUILTIN_STANDARD_DECOMPOSITIONS` 사용 → §4.5.1.7.2 효과 자동 보존. **R1 (High) → Low 로 등급 하향**. 사용자가 의도적으로 PMBOK 을 끄려면 `standard_decompositions: []` 명시. **F1 v3 append 정책으로** 사용자가 ISO-27001 만 추가해도 PMBOK 자동 유지 — R3 자체 제거.

### 3.5 acceptance criteria (Stage 1, v3 — 9 AC, ≥ 16 신규 cases)

- [ ] **AC1**: `SchemaOverride.standardDecompositions` 필드 추가 + `StandardDecomposition` / `StandardDecompositionComponent` (with optional `aliases`) 타입 export + `StandardDecompositionsState` discriminated union (3-state: empty-explicit / empty-all-skipped / present, F2 + codex cycle #2 단일화 — absent 는 `undefined` 자체) + `BUILTIN_STANDARD_DECOMPOSITIONS` 상수 (export, F3 component aliases 포함) 정의 (`schema.ts`). **추가 — STANDARD_EXCEPTIONS 갱신 (P3 codex cycle #2)**: `schema.ts:143` 의 STANDARD_EXCEPTIONS Set 에 PMBOK canonical slug 2개 추가 — `project-schedule-management`, `project-resource-management` (현재 alias `project-time-management`, `project-human-resource-management` 만 있음). canonical slug 가 functional suffix `-management` 로 끝나서 anti-pattern 으로 잡히지 않도록. `tsc` 빌드 0 errors.
- [ ] **AC2**: `parseSchemaOverrideYaml` 가 `standard_decompositions:` section 인식. 신규 단위 테스트 **≥ 9 cases**:
  - (1) standard_decompositions only YAML → 파서 non-null + entityTypes [] (F2 null 조건 변경)
  - (2) explicit `standard_decompositions: []` → state `{ kind: 'empty-explicit' }`
  - (3) `standard_decompositions:` 키 부재 → `standardDecompositions` 필드 `undefined` (v4: absent 단일화 — 별도 `kind: 'absent'` 없음)
  - (4) 모든 entry invalid silent skip + warn → state `{ kind: 'empty-all-skipped', skippedCount: N }` + builder built-in fallback 검증
  - (5) component slug 충돌 first-wins (M6) + warn 메시지 검증 (vi.spyOn(console, 'warn'))
  - (6) tab indentation 거부 + warn (Scrutiny c)
  - (7) components[].type 이 invalid (override + built-in 어디에도 없음) → component skip + warn (F5 런타임 검증)
  - (8) 잘못된 rule (`decompose|bundle` 외) → 항목 skip
  - (9) components[].aliases (F3) 정상 파싱 + 동일 항목 안 중복 skip
  - **추가 spy 검증** (UNDECIDED #2 v3): 각 warn 케이스에서 `vi.spyOn(console, 'warn')` 으로 메시지 capture 확인 — `loadSchemaOverride` 시그니처 변경 없이도 warning 관측 가능.
- [ ] **AC3**: `buildStandardDecompositionBlock(override)` 의 **F2 discriminated union 분기 + F1 append 검증**. 신규 단위 테스트 **≥ 5 cases**:
  - (a) `override === undefined` → built-in PMBOK 블록 (10 components + 2 alternate slugs anchor 포함).
  - (b) `state === undefined` (parser 가 standardDecompositions 필드 자체 미포함) → (a) 와 동일 anchor.
  - (c) state `{ kind: 'empty-explicit' }` → 빈 string `''` (명시 disable).
  - (d) state `{ kind: 'empty-all-skipped', skippedCount: 2 }` → built-in PMBOK 블록 (silent disable 방지, F2 v3).
  - (e) state `{ kind: 'present', items: [{ ISO-27001 ... }] }` → **built-in PMBOK + ISO-27001 둘 다** prompt 안에 텍스트 출력 (F1 append v3 정정). bundle rule 도 별도 case 추가.
- [ ] **AC4**: `canonicalizer.ts` 작업 규칙 #7 PMBOK 인라인 제거. `buildCanonicalizerPrompt` 에 `decompositionBlock` 치환 적용. 신규 단위 테스트 **≥ 2 cases**:
  - (i) `schemaOverride === undefined` (default 경로) → 출력 prompt 에 built-in PMBOK 블록 + "PMBOK 10 knowledge areas 개별 추출" marker 포함 (M3 default fallback + F3 anchor).
  - (ii) `overridePrompt` (custom prompt) 가 `{{STANDARD_DECOMPOSITION_BLOCK}}` placeholder 포함 → 출력에 PMBOK 블록 텍스트 치환 (F4 v3 신규).
- [ ] **AC5.a (5-control unit, F6 v3)**: ISO-27001 5 controls 샘플 yaml → `buildCanonicalizerPrompt` 출력에 5 slugs + ISO-27001 name + **built-in PMBOK 도 동시에** 포함 (F1 append). 단위 테스트 1 case.
- [ ] **AC5.b (93-control fixture smoke, F6 v3 + P2-3 codex cycle #2 fix)**: ISO-27001 전체 93 controls fixture → `buildStandardDecompositionBlock` 정상 처리. 검증: (i) 출력 string 에 93 slugs 모두 substring match, (ii) 함수 실행 시간 < 100ms (performance 회귀 방지). **line-count 조건 제거** — builder pseudocode (§3.3) 가 components 를 comma-joined 단일 line 으로 출력해서 §4.5.1.7.2 hardcoded prompt 와 string-equivalence (AC6.a) 를 보존하는 설계와 충돌하므로. 1 case (smoke).
- [ ] **AC6.a (코드 검증, M2 + F3 anchor 보강)**: default schema fixture 또는 `override === undefined` 입력 → `buildCanonicalizerPrompt` 출력 string 의 작업 규칙 #7 블록이 §4.5.1.7.2 시기 hardcoded prompt 와 **anchor 3 가지 모두 일치**:
  - (i) marker 텍스트 "PMBOK 10 knowledge areas 개별 추출" (또는 동등 표현) 포함
  - (ii) 10 main PMBOK slugs (`project-integration-management` … `project-stakeholder-management`)
  - (iii) **2 alternate slugs**: `project-time-management`, `project-human-resource-management` (F3 v3 신규 — legacy anchor 보존)
  - 단위 테스트 1 case (canonicalizer.test.ts). codex 권고: AC6.a string-eq + AC6.b live CV **둘 다** 통과해야 §5.4.1 close.
- [ ] **AC6.b (라이브 측정, tester 책임, F7 v3 명료화)**: PMS 코퍼스 cycle smoke 5/5 run, **Concepts CV ≤ post-change baseline**.
  - **post-change baseline 정의**: 본 §5.4.1 코드 변경 시점에 entry gate (Phase 4 §4.5.1.7.2 PMS 5-run 실측) 가 도달한 Concepts CV 값. 현재 `activity/phase-4-result.md:659` 기준 = **24.6%**.
  - 만약 entry gate 가 향후 < 15% 로 강화되어 그 baseline 이 새로 측정되면 그 값으로 자동 갱신.
  - 즉 **AC6.b 는 "entry gate 도달 시점의 baseline 이하 유지" no-regression 검증** (F7).
  - tester 세션에서 실측. 결과는 `activity/phase-5-result.md §5.4.1` 에 5-run 표 + run-by-run Concepts count 형태로 기록. 본 §5.4.1 close 의 **필수 조건** — AC6.a 만으로는 완료 불가.
- [ ] **AC7 (M1, baseline 못박음)**: **빌드 0 errors 유지 + 회귀 전체 테스트 ≥ 648 PASS 유지** (`plan/session-wrap-followups.md:3` 의 §5.3 종결 시점 baseline = "회귀 584 → 648 PASS, build 0 errors"). Stage 1 완료 시점에 fresh `npm test` + `npm run build` 출력 첨부. 신규 ≥ 16 cases (AC2 ≥ 9 + AC3 ≥ 5 + AC4 ≥ 2 + AC5.a 1 + AC5.b 1 + AC6.a 1 = ≥ 19 신규 — 일부 fixture 공유 가능) 추가만큼 PASS 카운트 상승 허용 (≥ 648 + 신규 case 수).

### 3.6 위험 + 완화 (v3 갱신)

| ID | 위험 | 영향 | 완화 |
|---|---|---|---|
| R1 | 기존 vault 가 `.wikey/schema.yaml` 보유 + PMBOK entry 미보유 → 작업 규칙 #7 블록 사라져 PMBOK ingest 품질 회귀 | **Low** (M3 v2 결정으로 강등) | M3 3-state 정책으로 자동 해소: `standard_decompositions:` 키 부재 = built-in PMBOK 자동 적용. 사용자가 의도적으로 `[]` 로 disable 한 경우만 §4.5.1.7.2 효과 빠짐. |
| R2 | YAML 파서가 의존성 없이 nested list 처리 → edge case 누락 (들여쓰기 변형, tab) | Medium | (a) parser 단위 테스트 ≥ 9 cases (Scrutiny c). (b) 명세에 "minimal YAML subset" 명시 (2/4-space indent only, tab 거부, anchors/aliases/multiline scalars 미지원) + 사용자에게 yamllint 권장. |
| R3 | ~~user override 시 built-in PMBOK replace~~ | **제거 (F1 v3 append 확정)** | F1 v3 append 정책으로 R3 자체 사라짐 — user 가 ISO-27001 만 추가해도 built-in PMBOK 자동 유지. AC5.a 가 `built-in + user 둘 다 출력` 검증. |
| R4 | YAML 파싱 warning 이 `console.warn` 만 — 사용자에게 silent failure | Low (UNDECIDED #2 v3 deferral) | (a) v3 는 console.warn 으로 진행 (M4). (b) Audit panel 통합은 §5.5 후순위 — UNDECIDED #2 v3 결정 = §5.5 deferral. (c) AC2 spy 패턴 (vi.spyOn(console, 'warn')) 으로 테스트 관측 가능 → silent 가 아닌 testable failure. |
| R5 | `buildStandardDecompositionBlock` 한국어 prompt 가 다국어 ingest source 에서 LLM 혼란 유발 | Low (§4.5.1.7.2 도 같은 한국어 prompt) | 변경 없음 (Phase 4 결정 그대로). |
| R6 | Phase 5 §5.2 / §5.3 진행 중 동시 schema.yaml 편집 시 충돌 | Low | §6.2 충돌 분석 — schema.yaml 직접 편집 영역만 충돌, 본 §5.4 는 ingest path 만 변경. |
| R7 | `BUILTIN_STANDARD_DECOMPOSITIONS` 가 코드 안에 묻혀 사용자 가시성 낮음 | Low | (a) `schema.ts` 상단 export + JSDoc. (b) `SCHEMA_OVERRIDE_TEMPLATE` 주석에 "built-in PMBOK 이 자동 적용" 명시. (c) Stage 2 suggestion UI 에서 origin='hardcoded' entry 도 audit 가능하게 노출 (장기). |
| R8 | F2 discriminated union 도입이 SchemaOverride 외부 사용자에게 breaking change | **Medium (신규 v3, F2 부산물)** | (a) `SchemaOverride.standardDecompositions` 는 신규 필드 → 기존 caller (entityTypes/conceptTypes 만 사용) 영향 없음. (b) 신규 필드 사용 caller 만 `state?.kind` 분기 필요 — `loadSchemaOverride` 호출 site 6 곳 (ingest-pipeline `:491` + 5 fixture) 중 ingest-pipeline 만 신규 필드 read = 1 줄 분기. (c) 대안 = 단순 `readonly StandardDecomposition[] | undefined` 도 §3.2.2 에 (B) 옵션으로 명시. codex Cycle #2 결정. |
| R9 | F1 append + M6 first-wins 충돌 시 사용자 직관과 다를 수 있음 — 사용자가 자기 PMBOK 정의 등록해도 built-in 측이 win | Medium (F1 부산물, v4 명료화) | (a) §3.1 선택 이유 단락에 명시 — **v4 설계상 PMBOK 본인 정의로 교체는 미지원** (yaml 한 파일에서 `[]` 와 user entries 동시 표현 불가능, append + first-wins 결합으로 user PMBOK entry 는 항상 drop). (b) `SCHEMA_OVERRIDE_TEMPLATE` 주석에 명시. (c) 장기 — Stage 2 suggestion UI 에서 `mergeWithBuiltin: 'append' \| 'replace'` 필드 신설 시 enable. v4 default = append, replace 옵션 v4 미도입. |

---

## 4. Stage 2~4 gate 정의 (v3 high-level — Scrutiny d 보강)

각 Stage 진입은 다음 조건이 **모두** 충족된 시점에 새 보조 plan (`phase-5-todox-5.4.<N>-<topic>.md`) 으로 분기.

### 4.1 Stage 2 진입 조건 (extraction graph 기반 suggestion)

- [ ] Stage 1 안정 동작 — 정량 정의: **두 표준 (PMBOK + 1 추가) 이 schema.yaml 으로 ingest 되어 Concepts CV ≤ 15% 유지** 가 5-run 측정으로 확증.
- [ ] 누적 표준 수 ≥ 5 개 — 사용자가 yaml 수동 등록을 부담스러워하는 수준.
- [ ] **mention graph 데이터 인프라** (Scrutiny d 보강) — 측정 corpus = PMS + 두 번째 표준 ingest 후 wiki, query set = N=20 random mention pairs (`select-sampler` script TBD). qmd index co-occurrence query 평균 latency **≤ 200ms** (현재 PMS 1 corpus 환경에서 미측정 — Stage 2 진입 직전 측정).
- [ ] Phase 4 §4.3.2 provenance tracking 구현 완료 (suggestion 카드의 evidence 표시에 필요).

### 4.2 Stage 3 진입 조건 (in-source self-declaration)

- [ ] Stage 2 suggestion accept rate ≥ 80% (≥ 10 suggestion 표본).
- [ ] Stage 2 false positive 사례에 대한 회귀 테스트 fixture 누적 (false-positive corpus ≥ 5 examples).
- [ ] **`section-index.ts` heading classifier** (Scrutiny d 보강) — fixture: ≥ 5 표준 corpus (PMBOK / ISO 27001 / ITIL 4 / GDPR / OWASP) 의 H2/H3 headings, 100 samples manual labeled (label = "표준 개요" / "기타"). 평가 기준: **precision ≥ 0.9 / recall ≥ 0.7**. fixture 위치 TBD (`wikey-core/src/__fixtures__/heading-classifier/`).

### 4.3 Stage 4 진입 조건 (cross-source convergence)

- [ ] Stage 3 까지의 decomposition 인스턴스 누적 ≥ 3 표준 × 2 소스 = 6 instance.
- [ ] qmd vector clustering API 가 mention-level granularity 지원 (현재 page-level).
- [ ] **LLM arbitration 비용 모델** (Scrutiny d 보강) — qmd 벡터 clustering pass 의 expected token = `(mention_count × 평균 prompt 토큰 + LLM arbitration 토큰)`. 측정 방식 = log file `~/.cache/qmd/convergence-pass-tokens.log` 에서 line `tokens=<N>` 합산 (1 pass 1 line). **1 회당 < 50K** 유지. log 형식 + sampler 는 Stage 4 진입 직전 정의.
- [ ] Phase 4 §4.2.2 URI 기반 안정 참조 완료 (cross-source canonical 참조 필수).

**Phase 6 이관 없음**: 본체 §5.4 line 331. Stage 4 는 Phase 5 안에서 종료. Stage 4 선결 미충족 시 Phase 5 종료 시 §5.4.1~3 까지만 closed 로 마감.

---

## 5. 실행 순서 (Stage 1 만, 두 번째 표준 등장 시 착수, v3 — 10 단계)

1. **types.ts 확장 + schema.ts BUILTIN 상수** → 검증: `tsc --noEmit` 통과, `SchemaOverride` 사용 지점 6곳 (grep 결과) 모두 빌드 OK. F2 discriminated union (`StandardDecompositionsState`) + F3 component aliases + F5 type: string 모두 포함. (AC1)
2. **schema.ts: parseSchemaOverrideYaml 확장 (F2 null 조건 + 3분리 + F5 type 런타임 검증 + M4 silent skip + M6 first-wins + Scrutiny c YAML subset)** → 검증: 신규 단위 테스트 (AC2 의 ≥ 9 cases, console.warn spy 포함) RED → GREEN.
3. **schema.ts: buildStandardDecompositionBlock 신규 (F1 append + F2 state 분기: `undefined` + 3 union kind / 총 4 시나리오 + F3 component aliases 출력 + F5 entity 일반화)** → 검증: 신규 단위 테스트 (AC3 의 ≥ 5 cases) RED → GREEN.
4. **canonicalizer.ts: 작업 규칙 #7 인라인 제거 + default 분기 decompositionBlock 치환 + F4 overridePrompt 분기 `{{STANDARD_DECOMPOSITION_BLOCK}}` placeholder 추가** → 검증: AC4 (≥ 2 cases — default + custom prompt placeholder) + AC6.a 코드 검증 (3-anchor: marker + 10 main slugs + 2 alternate slugs).
5. **settings-tab.ts: SCHEMA_OVERRIDE_TEMPLATE 에 commented-out PMBOK reference (P2-4 v4) + 3-state 주석 + F1 append 정책 주석 추가** → 검증: 신규 vault 가 default template 로 ingest 시 작업 규칙 #7 블록이 prompt 에 포함됨 (built-in 자동 적용 — template 의 PMBOK YAML 은 모두 `#` prefix 로 inactive). built-in 자동 fallback 동작 검증.
6. **canonicalizer.ts:209-216 주석 갱신** → 검증: §5.6 → §5.4 표기 정정, "Stage 1 진입 — schema.yaml 로 이전됨 (built-in fallback 보장 + F1 append)" 으로 변경.
7. **ISO-27001 5-control + 93-control fixture 작성 (F6 v3)** → 검증: AC5.a (5-control unit) + AC5.b (93-control fixture smoke, < 100ms) RED → GREEN.
8. **빌드 + 회귀 baseline 확정 (AC7, M1)** → 검증: `npm test` ≥ 648 + 신규 case 수 PASS / `npm run build` 0 errors. fresh 출력 첨부.
9. **PMS 5-run 라이브 회귀 측정 (AC6.b, tester 책임, F7 v3)** → 검증: cycle smoke 5/5 run, Concepts CV ≤ post-change baseline (현재 24.6%). 결과를 `activity/phase-5-result.md §5.4.1` 에 5-run 표 + run-by-run Concepts count 형태로 기록.
10. **두 번째 표준 (예: ISO-27001) 등록 시나리오 + append 검증 (AC5.a)** → 검증: 통합 테스트 PASS + 사용자가 vault yaml 에 ISO-27001 entry 추가만으로 prompt 에 PMBOK + ISO-27001 둘 다 등장 (F1 append).

각 단계 1~7 은 단일 commit, 8~10 은 별도 측정/검증 commit (활동 기록 분리). 9 (라이브 측정) 은 tester 세션에서 별도 수행 — close 의 필수 조건.

---

## 6. 종속 / 충돌

### 6.1 종속 (v3 entry gate vs no-regression 분리, F7)

#### 6.1.1 Entry gate (Stage 1 진입 조건)

- **Phase 4 §4.5.1.7.2 PMS 5-run Stage 0 사전 검증** — 본체 §5.4 line 273, 296 정의: **Concepts CV 24.6% → < 15% 확증** 시 Stage 1 진입.
- **현 상태 진단** (F7 v3 신규): 본체 line 273 = "Concepts CV 24.6% — <15% 미달". Phase 4 §4.5.1.7.2 의 hint 추가가 24.6% 를 < 15% 로 못 끌어내림. 즉 entry gate 실측 미달. **두 옵션**:
  - **(A) Stage 1 진입 보류** — entry gate < 15% 도달 후 진입.
  - **(B) entry gate 완화 협의** — analyst/master/사용자 합의로 baseline 24.6% 를 entry gate 로 재정의 (Stage 1 의 가치 = self-extending 구조 자체로 인정).
- v3 권고: 본 plan 자체는 Stage 1 진입 조건 변경 영역 아님 (Surgical) — entry gate 결정은 본체 §5.4 line 296 에서 담당. 본 plan 은 **AC6.b 가 entry gate 도달 시점의 baseline 이하 유지** 를 약속.

#### 6.1.2 Post-change no-regression (Stage 1 완료 조건)

- **AC6.b**: Stage 1 코드 변경 후 PMS 5-run 측정 Concepts CV **≤ entry baseline** (즉 entry gate 도달 시점의 측정값 이하).
- 현재 baseline 후보 = 24.6% (Phase 4 §4.5.1.7.2 시점). entry gate 가 향후 < 15% 로 강화되면 그 값으로 자동 갱신.

#### 6.1.3 기타 종속

- **Phase 4 §4.3.2 provenance tracking** — Stage 3 self-declaration 오염 제어 (Stage 2 도 evidence 표시에 필요).
- **Phase 4 §4.2.2 URI 기반 안정 참조** — Stage 4 cross-source convergence 의 canonical 식별자.
- **현재 PMS cycle smoke 인프라** (`activity/phase-5-result.md §5.2`) — AC6.b 라이브 회귀 측정의 실행 환경.

### 6.2 충돌 가능성

| 충돌 영역 | 충돌 대상 | 해결 |
|---|---|---|
| `.wikey/schema.yaml` 동시 편집 | §5.2.1 entity↔concept cross-link (현재 진행 중) — schema.yaml 의 entity/concept type 추가 가능성 | §5.2.1 은 **prompt + 페이지 본문 빌드** 변경, schema.yaml top-level section 미사용. **충돌 없음** (다른 section 만 추가). |
| canonicalizer.ts 라인 충돌 | §5.2.1 이 `buildCanonicalizerPrompt` 작업 규칙에 #8 추가 가능 | §5.2.1 v1 (`phase-5-todox-5.2.1-crosslink.md`) 검토 필요. analyst 가 §5.4 진입 시 §5.2.1 commit graph 확인 + rebase. |
| `loadSchemaOverride` 시그니처 변경 | 없음 — 본 §5.4 는 시그니처 유지 | — |
| 사용자 vault default template 변경 | settings-tab.ts:1118 `SCHEMA_OVERRIDE_TEMPLATE` 만 변경. Modal 동작 변경 없음 | — |

### 6.3 미결정 사항 (v3 정리)

**v1 → v2 promotion 결과** (master 6 finding 반영):

| v1 # | 항목 | v2 결정 | promotion 위치 |
|---|---|---|---|
| 1 | YAML 파싱 실패 정책 (M4) | silent skip + console.warn 항목 단위. 시그니처 변경 deferral. | §3.2 파싱 실패 정책 단락 |
| 2 | 기존 vault PMBOK fallback (M3) | 3-state 정책 — `undefined` → built-in / `[]` → disable / `[{...}]` → user (v2 replace, **v3 append**) | §3.1 3-state 표 + §3.3 함수 분기 |
| 3 | Stage 1 진입 trigger (M5) | (a) 두 번째 표준 corpus 임박 → (b) 사용자 yaml entry 추가 → (c) ingest 실행 시 자동 통합. (a)~(c) 단계 명시. | 본 §6.3 아래 "M5 trigger 정의" 단락 |
| 4 | decomposition slug 충돌 (M6) | first-wins + console.warn. Stage 2 suggestion UI 가 명시적 충돌 해결 제공 (장기). | §3.2 검증 규칙 표 |

**v2 → v3 promotion 결과** (codex Cycle #1 결정):

| v2 잔여 # | 항목 | v3 결정 | promotion 위치 |
|---|---|---|---|
| 1 | M3 부산물: built-in merge 정책 (replace vs append) | **append 확정** (codex 권고). user 가 ISO 만 추가해도 PMBOK 자동 유지. R3 자체 제거. `mergeWithBuiltin: 'append' \| 'replace'` 옵션은 v4 미도입 (장기 Stage 2 suggestion UI 영역). v4 한계: user 가 PMBOK 본인 정의로 교체 불가 — yaml 한 파일에서 `[]` 와 user entries 동시 표현 불가능, append + first-wins 결합으로 user PMBOK entry drop. | §1.1 목표 6 / §3.1 state 표 / §3.3 함수 / §3.5 AC3 (e) AC5.a / §3.6 R3 제거 R9 v4 명료화 |
| 2 | M4 deferral: Audit panel YAML warning UI | **§5.5 deferral 확정**. v3 §5.4.1 안에서는 console.warn + AC2 spy 패턴까지. 시그니처 변경 없음. | §1.2 비목표 / §3.6 R4 / AC2 spy 케이스 |

**M5 trigger 정의** (v2 명시화 — 본체 §5.4 line 304 와 정합):

본체 line 304 = "두 번째 표준 corpus (ISO/ITIL 등) 가 wiki 에 인제스트될 때". 이 표현은 다음 3 단계를 압축한 것:

- **(a) 사전 신호 (user-side)**: 사용자가 두 번째 표준 corpus 의 ingest 를 임박 결정 (ISO 27001 등). PMBOK 1 코퍼스만 있을 때는 §5.4.1 진입 의미 적음 — 본체 line 273.
- **(b) user action gate**: 사용자가 vault `.wikey/schema.yaml` 에 두 번째 표준의 `standard_decompositions:` entry 를 추가 (Modal 또는 직접 편집). 이것이 본체 trigger 의 실제 발화 시점.
- **(c) 코드 동작 gate**: ingest 실행 → `loadSchemaOverride` 가 yaml 읽음 → `parseSchemaOverrideYaml` 가 신규 entry 인식 → `buildStandardDecompositionBlock` 가 작업 규칙 #7 동적 생성 → canonicalizer 가 두 표준 모두 분해.

본 §5.4.1 plan 의 **deliverable 은 (c) 가 동작하도록 코드를 준비하는 것**. (a)/(b) 는 사용자 행동이라 plan 의 직접 acceptance 대상 아님 — AC5 가 (c) 를 ISO-27001 fixture 로 검증.

---

**v4 잔여 미결정**: **0건** (codex Cycle #2 모든 결정 v4 반영 완료).

| v3 잔여 | v4 결정 (codex cycle #2) | 반영 위치 |
|---|---|---|
| (F2 부산물) discriminated union vs simple array | **(A) discriminated union 채택**. union 3-state (empty-explicit / empty-all-skipped / present), absent = `undefined` 자체로 단일화. simple array (B) 폐기 — empty-explicit vs empty-all-skipped 구분이 builder sideband 의존. | §3.1 SchemaOverride 시그니처 / §3.2.2 표 / §3.5 AC1 |

(v1/v2/v3 의 다른 미결정은 모두 결정 사항으로 promotion 됨. UNDECIDED #1 append 확정 + #2 §5.5 deferral 확정 + cycle #2 jurisdiction 확정.)

---

## 7. 변경 이력

### 7.1 v1 → v2 (master 1차 검증)

master 1차 검증 (7-check + 추가 2-check = 9-check) 통과 후 6 finding (M1~M6) 반영. 각 finding 1:1 매핑.

| Finding | 영역 | v1 상태 | v2 결정 | 반영 위치 |
|---|---|---|---|---|
| **M1** | AC7 baseline 못박기 | "현재 baseline 확인 필요" (소프트) | "회귀 ≥ 648 PASS 유지 + build 0 errors" 명문화. 출처 = `plan/session-wrap-followups.md:3` (§5.3 종결 시점 baseline) | §3.5 AC7 |
| **M2** | AC6 evidence 분리 | AC6 1개로 string-equivalence + 라이브 측정 혼재 | AC6.a (코드, unit test) + AC6.b (라이브, tester 책임) 로 분리. AC list 7 → 8 개 | §3.5 AC6.a/AC6.b |
| **M3** | R1 fallback 정책 | "자동 주입 거부 (user-yaml > hardcoded)" — R1 High 잔존 | 3-state 정책: `undefined` → built-in PMBOK / `[]` → 명시 disable / `[{...}]` → user (v2 replace, **v3 append**). `BUILTIN_STANDARD_DECOMPOSITIONS` 상수 도입. R1 High → Low 강등. | §1.1 목표 6 / §3.1 3-state 표 / §3.3 함수 분기 |
| **M4** | YAML 파싱 실패 정책 | silent skip 제안 + 시그니처 확장 검토 (애매) | silent skip + `console.warn` 확정. 시그니처 변경 v2 미채택. Audit panel 통합은 §5.5 후순위 deferral. | §3.2 파싱 실패 정책 / §3.6 R4 |
| **M5** | trigger 정의 | "사용자 명시 등록 시점" (단일 표현) | (a) 사전 신호 → (b) user action gate → (c) 코드 동작 gate 3 단계. 본체 §5.4 line 304 와 정합. | §6.3 M5 단락 |
| **M6** | decomposition slug 충돌 | silent skip (모호) | first-wins + console.warn. 메시지 형식 명문화. | §3.2 검증 규칙 표 |

### 7.2 v2 → v3 (codex Mode D Cycle #1)

codex Cycle #1 = NEEDS_REVISION. 7 finding (F1~F7) + 2 undecided 결정 + 4 scrutiny 답변 (a~d) 반영. 각 항목 1:1 매핑.

| Finding | 영역 | v2 상태 | v3 결정 | 반영 위치 |
|---|---|---|---|---|
| **F1 (HIGH)** | replace → append | 3-state 의 length≥1 = user replace (built-in 대체) | **append 확정** — built-in PMBOK + user entries 모두 작업 규칙 #7 출력. user 가 ISO 만 추가해도 PMBOK 자동 유지. R3 자체 제거. | 헤더 v3 변경 요지 / §1.1 목표 2/6 / §3.1 3-state 표 마지막 행 (replace → append) / §3.3 분기 (`[...BUILTIN..., ...state.items]`) / §3.5 AC3 (e) + AC5.a "둘 다 출력" / §3.6 R3 제거 + R9 신규 / §6.3 v2→v3 promotion 표 |
| **F2 (HIGH)** | parser null 조건 + [] 3분리 | null 반환 = entityTypes/conceptTypes 둘 다 0 / [] semantics 1개 | (a) null 조건 = 세 section 모두 entry + key 부재. (b) `StandardDecompositionsState` discriminated union 도입 (`absent` / `empty-explicit` / `empty-all-skipped` / `present`). (c) all-skipped 시 built-in fallback + warn. | §1.1 목표 3 / §3.1 SchemaOverride 시그니처 / §3.2.1 null 조건 단락 신규 / §3.2.2 [] 3분리 표 신규 / §3.3 분기 (4-state) / §3.5 AC2 cases (1)(2)(3)(4) + AC3 cases (b)(c)(d)(e) / §3.6 R8 신규 / §6.3 v3 잔여 #1 |
| **F3 (HIGH)** | legacy PMBOK anchor 보존 | BUILTIN_STANDARD_DECOMPOSITIONS 에 alternate slug 누락 → AC6.a 깨짐 | (a) `StandardDecompositionComponent.aliases?: readonly string[]` 신설. (b) PMBOK `project-schedule-management` 에 `aliases: ['project-time-management']`, `project-resource-management` 에 `aliases: ['project-human-resource-management']`. (c) builder 가 `(또는 \`alt\`)` 출력. (d) marker line "PMBOK 10 knowledge areas 개별 추출" 보존. | §1.1 목표 7 / §3.1 component aliases 추가 + BUILTIN 정의 / §3.3 builder altPart 분기 + marker line / §3.5 AC6.a 3-anchor (i)(ii)(iii) |
| **F4 (MEDIUM)** | `{{STANDARD_DECOMPOSITION_BLOCK}}` placeholder | overridePrompt 분기 (`canonicalizer.ts:238-246`) 의 replaceAll 목록에 신규 placeholder 누락 | overridePrompt 분기에 `'{{STANDARD_DECOMPOSITION_BLOCK}}', decompositionBlock` 1 줄 추가. | §1.1 목표 4 / §3.4 overridePrompt 분기 코드 / §3.5 AC4 (ii) cases |
| **F5 (MEDIUM)** | `components[].type` 정책 | `ConceptType \| EntityType` (built-in only) — 검증 규칙 표의 "override 추가분" 와 모순 | `type: string` + 런타임 검증 (`getEntityTypes(override) ∪ getConceptTypes(override)`). prompt 텍스트 "별도 concept" → "별도 entity 또는 concept" 일반화. | §1.1 목표 7 / §3.1 component type / §3.2 검증 규칙 표 (component type 행) / §3.3 builder 일반화 |
| **F6 (MEDIUM)** | ISO AC5 분리 | AC5 1개 (5-control unit + integration 혼재) | AC5.a (5-control unit, 빠른 단위 테스트) + AC5.b (93-control fixture smoke, length/line/perf < 100ms). AC list 8 → 9 개. | §3.5 AC5.a + AC5.b / §5 실행 순서 7 단계 (fixture 작성) |
| **F7 (MEDIUM)** | entry gate vs no-regression 분리 | §6.1 종속이 두 개념 혼재 — 24.6% 가 baseline 인지 entry gate 인지 모호 | (a) Entry gate (Stage 1 진입) = Phase 4 §4.5.1.7.2 PMS 5-run 실측 < 15% (본체 §5.4 line 273, 296). (b) Post-change no-regression (AC6.b) = entry gate 도달 시점 baseline 이하. (c) 현 상태: entry gate 미달 (24.6%) — 본체 §5.4 결정 영역. | §6.1.1 entry gate / §6.1.2 no-regression 분리 / §3.5 AC6.b post-change baseline 정의 |
| **UNDECIDED #1** | replace vs append (v2 잔여 #1) | undecided | append 확정 (= F1) | F1 항목과 동일 |
| **UNDECIDED #2** | loadSchemaOverride 시그니처 (v2 잔여 #2) | undecided | **§5.5 deferral 확정**. v3 §5.4.1 안에서 시그니처 변경 없음. AC2 에 console.warn spy 패턴 케이스 추가 (silent 가 아닌 testable failure). | §1.2 비목표 / §3.6 R4 / §3.5 AC2 spy / §6.3 v2→v3 promotion 표 |
| **Scrutiny (a)** | replace 정책 정합성 | "user override 가 빈 array 로 disable + entry 추가 시 자동 통합" 표현이 모순 (replace 면 자동 통합 X) | F1 append 로 모순 자체 해소 | F1 과 동일 |
| **Scrutiny (b)** | [] semantics | empty-explicit vs empty-all-skipped 미구분 | discriminated union (F2) 로 4-state 구분 | F2 와 동일 |
| **Scrutiny (c)** | parser state machine | nesting 설명 모호 | (a) indentation = 2/4-space only, tab 거부. (b) anchors/aliases/multiline scalars/flow style 미지원 명시. (c) aliases (top-level) 와 components[].aliases 가 같은 list-of-string shape 명시. (d) components[].slug 누락 시 component skip + warn. | §3.2 minimal YAML subset 단락 신규 + 검증 규칙 표 보강 |
| **Scrutiny (d)** | Stage 2-4 측정 방식 | "≤ 200ms / ≥ 80% / < 50K" 단순 수치만 | (a) Stage 2: corpus + N=20 query set + 측정 시점. (b) Stage 3: fixture (≥ 5 표준 corpus, 100 samples) + precision ≥ 0.9 / recall ≥ 0.7. (c) Stage 4: token log file + sampler. | §4.1 / §4.2 / §4.3 |

### 7.3 부수 변경 (v3)

- §1.1 v2 6 항목 → v3 7 항목 (F5 entity 일반화 추가)
- §1.2 v2 6 항목 → v3 7 항목 (UNDECIDED #2 §5.5 deferral 명시)
- §3.5 v2 8 AC → v3 9 AC (AC5 → AC5.a + AC5.b 분리)
- §3.6 v2 7 R → v3 9 R (R3 제거 / R8 신규 (discriminated union breaking) / R9 신규 (append + first-wins 직관 차이))
- §5 실행 순서 v2 9 단계 → v3 10 단계 (ISO fixture 작성 단계 신규)
- §6.1 종속을 6.1.1 entry gate / 6.1.2 no-regression / 6.1.3 기타 로 분리 (F7)
- §3.2 sub-section 분리 (3.2.1 null 조건 / 3.2.2 [] 3분리 / 3.2.3 검증 규칙)
- 헤더 버전 v2 → v3, v2→v3 변경 요지 추가

### 7.4 v3 → v4 (codex Mode D Cycle #2 — master 직접 fix)

codex Cycle #2 = APPROVE_WITH_CHANGES. 5 P2 + 1 P3 + UNDECIDED #1 (A) 확정. master 가 analyst 호출 없이 직접 plan Edit 으로 fix (cycle 단축).

| Finding | 영역 | v3 상태 | v4 결정 | 반영 위치 |
|---|---|---|---|---|
| **UNDECIDED #1 (codex cycle #2 결정)** | discriminated union vs simple array | (A) v3 default — `absent` / `empty-explicit` / `empty-all-skipped` / `present` 4-state | **(A) 확정 + absent 단일화** — `standardDecompositions === undefined` 자체가 absent. union 은 3-state (empty-explicit / empty-all-skipped / present). simple array (B) 폐기. | §3.1 SchemaOverride 시그니처 |
| **P2-1** | 명시 disable 문법 자체 모순 | `standard_decompositions: []` (flow style) vs flow style 미지원 명문 충돌 | flow style 1 사용처 예외 — `standard_decompositions: []` (block-empty 도 동등) 만 허용. parser 가 두 형태 모두 `{ kind: 'empty-explicit' }` 정규화. | §3.2.2 표 / §3.2.3 indentation 룰 |
| **P2-2** | §3.2.2 union vs §3.2.3 [] 반환 충돌 | §3.2.3 검증 규칙 표 끝 행이 "빈 list 반환" 으로 약식 표기 | parser 가 `[]` 직접 반환 안 함 — always discriminated union. §3.2.3 마지막 행 명시 갱신 + section 부재 vs disable vs all-skipped 4 시나리오 표 §3.2.3 추가. | §3.2.3 마지막 행 / §3.2.3 section 부재 단락 |
| **P2-3** | AC5.b line ≥ 93 vs builder comma-joined 한 줄 충돌 | line count 조건이 builder pseudocode (single line comma-joined) 와 모순 | line count 조건 제거. 검증 = (i) 93 slugs substring match + (ii) < 100ms. builder 는 §4.5.1.7.2 string-equivalence 보존 위해 comma-joined 유지. | §3.5 AC5.b |
| **P2-4** | default template active PMBOK 중복 | append 정책상 built-in + template = duplicate PMBOK | template 의 PMBOK entry 전체 comment-out (`#` prefix). 학습용 reference 로만. component aliases 도 주석에 포함. | §3.4 default vault 보존 단락 |
| **P2-5** | 기존 PMBOK prompt test exact phrase 깨질 위험 | builder = "묶지 말고", "직접 언급된 영역만 추출" — `canonicalizer.test.ts:230` exact anchor 와 불일치 | builder 텍스트 정정: (a) "묶지 말 것." (b) "본문에 해당 영역이 직접 언급되지 않으면 추출하지 않는다 (hallucination 금지)." 두 phrase 정확히 등장. "다음 N 영역" 표현도 보존. | §3.3 builder pseudocode + 선택 이유 P2-5 단락 |
| **P3** | STANDARD_EXCEPTIONS 누락 | canonical slug `project-schedule-management` / `project-resource-management` 가 anti-pattern exception 에 없음 (legacy alias 만 존재) | AC1 에 STANDARD_EXCEPTIONS Set 갱신 명시. canonical slug 2개 추가 — `schema.ts:143`. | §3.5 AC1 |

---

## 8. self-check 결과 (analyst 9-check, v3 재검증)

| # | 항목 | 결과 | 비고 |
|---|---|---|---|
| 1 | 결정 트리 분기 reachability | ✅ | v4 codex cycle #2 단일화: `undefined` (absent) + 3-kind union (`empty-explicit` / `empty-all-skipped` / `present`) 모두 reachable. `state?.kind === 'empty-explicit'` 만 빈 string, undefined / `empty-all-skipped` 는 built-in fallback, `present` 는 built-in + user append. F1 append 분기 `[...BUILTIN..., ...state.items]` 도달 가능. rule {decompose, bundle} 외 silent skip 유지. |
| 2 | 코드 식별자 실재 grep | ✅ | v1/v2 식별자 + 신규 `BUILTIN_STANDARD_DECOMPOSITIONS` (export, F3 component aliases 포함), `StandardDecompositionsState` discriminated union, `StandardDecompositionComponent.aliases` 모두 v3 도입 상수/타입 (실재 아님 — Stage 1 구현 시 추가). 기존 grep 확인: `getEntityTypes`/`getConceptTypes` (`schema.ts:82-89` 실재, F5 런타임 검증 의존), `canonicalizer.ts:238-246` overridePrompt replaceAll 분기 (F4 placeholder 추가 위치 실재), `schema.ts:352` null 반환 (F2 변경 위치 실재). |
| 3 | 외부 schema 정합 | ✅ | YAML schema 신규 — 기존 schema 와 충돌 없음. v4 4 시나리오 = **3 union kind + undefined**: YAML key 부재 (`undefined`) / `[]` 또는 block-empty (`{ kind: 'empty-explicit' }`) / 모두 invalid skip (`{ kind: 'empty-all-skipped' }`) / valid items (`{ kind: 'present', items: [...] }`) 로 명확 표현. components[].aliases (F3) 도 list-of-string shape 으로 top-level aliases 와 일관. |
| 4 | identity / hash / id 정책 모순 | N/A | 본 §5.4 는 hash/id 무관. |
| 5 | 신규 용어 plan 전체 일관성 | ✅ | `standardDecompositions` (camelCase TS) / `standard_decompositions` (snake_case YAML) / `BUILTIN_STANDARD_DECOMPOSITIONS` (SCREAMING_SNAKE_CASE) / `StandardDecompositionsState` (PascalCase) — case convention 일관. F1 append 표현이 §1.1 목표 6 / §3.1 3-state 표 / §3.3 함수 분기 / §3.5 AC3 (e) AC5.a / §3.6 R3 제거 R9 신규 모든 위치에 일관 적용. v2 의 "replace" 단어는 §7.2 변경 이력 표와 §6.3 promotion 표에만 잔존 (변경 이력 의도). 본문 검색: `grep -c "user replace\|built-in 비치환\|built-in 대체"` = 0 (변경 이력 텍스트 외). |
| 6 | 명세 ↔ implementation 동기화 | ✅ | §3.1 (state 시나리오 표 = 3 union kind + undefined / BUILTIN 정의 with F3 aliases) ↔ §3.2 (parser null 조건 + 검증 규칙 표 with F5 runtime check) ↔ §3.3 (state 분기 코드: `!state` (undefined) + 3 union kind + F1 append + F3 altPart + F5 entity 일반화) ↔ §3.4 (F4 placeholder) ↔ §3.5 AC1~AC7 (특히 AC2 9 cases / AC3 5 cases / AC4 2 cases / AC5.a/AC5.b / AC6.a 3-anchor) 1:1 매핑. |
| 7 | parent doc narrowing 적용 | ✅ | 본체 `plan/phase-5-todo.md §5.4 line 298-304` 5 체크박스 = v3 §3 의 AC1~AC5.b + R1 (강등) + R3 (제거) + AC6.a/AC6.b + AC7 + 주석 정정 = 9 AC + 위험 갱신 + 1 주석. **master 가 본체 §5.4 line 298-304 의 5 체크박스를 v3 의 AC1~AC7 + 라이브 측정 (AC6.b) 으로 narrowing 권장** — 잔여 미결정 #1 (discriminated union vs simple) 결정 후 본체 sync. **본체 §5.4 line 296 entry gate (24.6% → <15%)** 는 본 plan 의 책임 영역 아님 (F7) — 본 plan 은 AC6.b post-change no-regression 만 약속. |
| 8 | 변경 이력 표 | ✅ | §7.1 v1 → v2 (M1~M6 × 1:1) + §7.2 v2 → v3 (F1~F7 + UNDECIDED #1/#2 + Scrutiny a~d × 1:1) + §7.3 부수 변경 작성. 12 finding × 1:1 매핑 모두 위치 명시. |
| 9 | test 카운트 합산 | ✅ | AC2 ≥ 9 (v2 6 → v3 9, F2 + F5 + Scrutiny c 추가 cases) + AC3 ≥ 5 (v2 4 → v3 5, F2 state 4 시나리오 = `undefined` + 3 union kind) + AC4 ≥ 2 (v2 1 → v3 2, F4 custom prompt) + AC5.a 1 + AC5.b 1 + AC6.a 1 = **신규 ≥ 19 cases**. AC6.b 는 라이브 측정 (단위 테스트 N/A). AC7 baseline = 648 + 19 = ≥ 667 PASS 예상 (Stage 1 완료 시). |

PASS (9/9). codex Mode D Cycle #9 진입 준비 (cycle #8 MED 1건 — §3.1 line 171 union state export 누락 — master 직접 1-word fix → final APPROVE 검증).

---

**v7 작성 완료. cycle 누적 결과**:
- Cycle #1 (codex Mode D, v2 review) — 7 finding (F1~F7) + 2 undecided + 4 scrutiny → v3 1:1 반영
- Cycle #2 (codex Mode D, v3 review) — 5 P2 + 1 P3 + UNDECIDED #1 (A) → v4 master 직접 fix
- Cycle #3 (codex Mode D, v4 review) — stale `kind: 'absent'` 잔존 6 위치 + minor drift 1 → v5 master 직접 fix
- Cycle #4 (codex Mode D, v5 review) — 추가 stale 4 finding (HIGH 2 + MED 2) → v6 master 직접 fix
- Cycle #5 (reviewer Agent + codex Mode D, v6 review) — APPROVE_WITH_CHANGES (P3 1건: §8 #9 + footer 갱신) → master 직접 fix
- Cycle #6 (master 직접 codex Mode D, v6 review) — APPROVE_WITH_CHANGES (P3 1건: header line 6 stale) → master 직접 fix
- Cycle #7 (master 직접 codex Mode D, v6 review) — capture truncated → cycle #8 fresh-panel retry
- Cycle #8 (master 직접 codex Mode D, v6 review) — APPROVE_WITH_CHANGES (MED 1건: §3.1 line 171 `type StandardDecompositionsState` 비-export ↔ AC1 export 요구 drift) BUILD_BREAK_RISK: LOW → master 직접 1-word fix (본 갱신 v7)

**v7 잔여 미결정 0건**. 모든 codex 결정 사항이 plan 본문에 일관 반영. 구현 진입 준비 완료 — **Cycle #9 final APPROVE 후 사용자 승인 받아 developer hand-off**.
