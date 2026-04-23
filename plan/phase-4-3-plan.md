# Phase 4.3 구현 계획 v2 — 인제스트 본체 (Provenance data model + 쿼리 원본 backlink + 3-stage prompt override + stripBrokenWikilinks)

> 작성: 2026-04-23 (session 2 후속) · v1 → v2 (self-review 후 4개 보강) / 대상: `plan/phase-4-todo.md §4.3`.
> **현재 상태**: §4.2 Stage 1~4 완료 (commit `876c409` 까지). fresh vault — `wiki/entities/`·`wiki/concepts/`·`wiki/analyses/` 모두 비어있음 → Provenance data model migration **실질 no-op**. 본 계획은 그 장점을 활용해 가볍게 진입.
> **v1 → v2 변경 요약** (§11 Self-review 참조): (A) Obsidian plugin 은 Electron main process `shell` 미접근 → `app.openWithDefaultApp` / `workspace.openLinkText` / `window.open` 로 교체 (§3.3). (B) `buildCanonicalizerPrompt` 시그니처 확장을 **optional 파라미터** 로 명시 (§4.4). (C) stripBrokenWikilinks 시점과 Stay-involved Preview 모달 순서 확정 — Preview 에 Stage 2/3 완료 후 stripped 버전만 노출 (§5.2). (D) Stage 1 override 가이드 — override prompt 가 wikilink 를 직접 쓰면 Stage 2/3 에서 strip 될 수 있음 고지 (§4.5 신설).
> **핵심 원칙**: (a) data model 변경 (`provenance` 필드) 은 본체 완료 선언 전 고정 — Phase 5 로 미루면 wiki 재생성 필요. (b) 원본 링크는 기존 wikilink 를 대체하지 않고 보조 affordance 로 추가 — wiki 계층 우회 방지. (c) 3-stage override 와 stripBrokenWikilinks 는 기존 시스템 확장.

---

## 0. 사용자 제약 및 원칙 점검

**제약 (2026-04-22 재확인)**:
- 원본 파일 (`raw/`) 은 **읽기 전용 링크만** — Phase 4 내내 불변.
- 쿼리 응답에서 wikilink 가 **주 링크**, 원본 backlink 는 약한 affordance (`📄` 아이콘 + 괄호 안 파일명 정도).
- `provenance.ref` 는 `source_id` 기반 — PARA 이동 후에도 경로 독립.

**Wikey Schema 정합 체크** (wikey.schema.md §19/§21):
- provenance 필드 = "근거 체인 strengthen", decomposition + compounding 축 유지 (✓).
- 원본 backlink = wiki → source → 원본 3-hop 을 1-hop 으로 단축하는 UX 개선, citation/provenance 강화 방향 (✓).
- Phase 5 §5.6 self-extending 의 Stage 3 (in-source self-declaration) 이 `provenance.type = 'self-declared'` 를 요구 → 본 계획이 그 type enum 을 미리 포함하면 Phase 5 에서 데이터 모델 재설계 없이 로직만 추가 가능.

---

## 1. 의존성 그래프

```
Part A — Provenance data model        Part B — 쿼리 원본 backlink        §4.3.1 3-stage prompt override      §4.3.3 stripBrokenWikilinks
─────────────────────────────         ──────────────────────────         ─────────────────────────────       ──────────────────────────
types.ts Provenance 타입 ─┐           query-pipeline.ts citations        stage2_mention_prompt.md         canonicalizer.ts writtenPages
wiki-ops.ts provenance  ──┼─>  source-resolver.ts (id→path) ──┐         stage3_canonicalize_prompt.md       ingest-pipeline.ts
injectSourceFrontmatter   │            sidebar-chat.ts 렌더 ────┘         settings-tab.ts Prompt 탭           source_page 본문 후처리
ingest-pipeline.ts Stage 1│
Stage 2/3 payload 확장 ──┘
```

- Part A 는 인제스트 파이프라인에 직접 꽂는다 (Stage 1 summary 결과 + Stage 2 mention → canonicalize 에 `provenance` 를 함께 기록).
- Part B 는 Part A 의 `provenance.ref = sources/<source_id>` 규약 + §4.2 source-registry 에 의존.
- §4.3.1 과 §4.3.3 은 data model 과 독립 — 순서 조정 자유.
- **권장 순서**: Part A → §4.3.3 (신규 wiki 페이지가 깨진 wikilink 를 갖지 않도록 선제 방어) → Part B (citation UX) → §4.3.1 (3-stage override, 도메인 프리셋 제외).

---

## 2. Part A — Frontmatter `provenance` Data Model

### 2.1 타입 정의 (`wikey-core/src/types.ts`)

```typescript
/** §4.3.2 Part A: wiki 페이지 관계의 출처 표시 */
export type ProvenanceType =
  | 'extracted'      // 소스에서 직접 발견 (Stage 2 mention 추출 기본)
  | 'inferred'       // LLM 이 추론 (Stage 3 canonicalize 가 mention 없이 합성)
  | 'ambiguous'      // 리뷰 필요 (동명이인 · 축약어 · 경계 모호)
  | 'self-declared'  // (Phase 5 §5.6 Stage 3 예약) 원본 안 in-source self-declaration 로 생성된 decomposition

export interface ProvenanceEntry {
  readonly type: ProvenanceType
  /** `sources/<source_id>` 포맷. PARA 이동 불변. Part B 에서 source-resolver 로 해석. */
  readonly ref: string
  /** 'inferred' / 'self-declared' 에만 의미 있음. 0.0~1.0. */
  readonly confidence?: number
  /** 'ambiguous' 에만 의미 있음. 한 줄 근거. */
  readonly reason?: string
}
```

**확장 포인트**:
- 추후 `type: 'user-asserted'` (사용자가 수동 추가) 등 새 variant 가 필요하면 union 확장만으로 추가 가능.
- `ref` 는 현재 단일 source_id 가정 — 복수 source 는 배열 `provenance` 의 여러 엔트리로 표현 (동일 `type`, 다른 `ref`).

### 2.2 wiki 페이지 frontmatter 스키마 확장

기존 (entity 예시):
```yaml
---
title: Kakao Alimtalk
type: entity
entity_type: product
created: 2026-04-23
updated: 2026-04-23
sources: [source-pms-r10.md]   # wikilink 기반 (기존 유지, UI navigation)
tags: []
---
```

확장 후:
```yaml
---
title: Kakao Alimtalk
type: entity
entity_type: product
created: 2026-04-23
updated: 2026-04-23
sources: [source-pms-r10.md]
provenance:                     # §4.3.2 Part A 신규 (optional array)
  - type: extracted
    ref: sources/sha256:a3f2b19c4e8d0f72
tags: []
---
```

**호환성**:
- `provenance` 는 **optional** — 기존 페이지에 없어도 schema validation 통과.
- 신규 ingest 는 반드시 1개 이상 엔트리 작성 (소스 없이 생성되는 페이지는 현재 없음).
- `sources: [...]` 필드는 유지 — wikilink 기반 UI 는 그대로, provenance 는 hash 기반 추가 레이어.

### 2.3 `wiki-ops.ts` 확장

```typescript
/** §4.3.2 Part A: entity/concept/analyses 페이지 frontmatter 에 provenance 배열 주입.
 *  이미 있으면 dedupe (type+ref 기준) 후 merge. */
export function injectProvenance(
  content: string,
  entries: readonly ProvenanceEntry[],
): string
```

- 기존 `injectSourceFrontmatter` 는 source 페이지 전용 (source_id 관리 필드). `injectProvenance` 는 entity/concept/analyses 전용 — 다른 필드를 건드리지 않는다.
- YAML 이스케이프: 기존 `yamlString` 재사용. `ref` 는 `sha256:...` 형태라 escape 불필요, `reason` 은 escape 필요.

### 2.4 ingest-pipeline.ts 배선

| 지점 | 변경 |
|------|------|
| Stage 1 summary 결과 — source 페이지 frontmatter | 변경 없음 (source 페이지에는 provenance 불필요, `source_id` 자체가 anchor). |
| Stage 2 mention extract 결과 | 각 mention 에 `source_section_idx?` 는 이미 존재 — 이제 `source_id` 도 함께 전달해서 provenance.ref 채움. |
| Stage 3 canonicalize | mention → page 변환 시점에 `provenance: [{type:'extracted', ref:'sources/<source_id>'}]` 주입. LLM 이 생성한 mention 없는 inferred concept 는 `type:'inferred'` + `confidence` (기본 0.7). |
| `canonicalizer.ts` schema 검증 | provenance 필드 존재 확인 (엄격 모드는 Phase 5, 현재는 warn only). |

### 2.5 Audit 패널 AMBIGUOUS 리뷰 UI (범위 축소)

원 계획에는 "Audit 패널에서 AMBIGUOUS 항목 리뷰 UI — accept/reject/edit" 가 있으나, **Phase 4 MVP 에서는 생성만 지원** (리뷰 UI 는 Phase 5 §5.4 variance diagnostic 연계로 이관 권장). 현재 세션 산출물:
- LLM 이 모호한 mention 을 만나면 `type: 'ambiguous'` + `reason` 으로 기록.
- 사이드바 Audit 패널은 "AMBIGUOUS N 건" Badge 만 표시 (클릭 시 관련 페이지 목록 Notice).
- Accept/reject 버튼 UI 는 Phase 5 §5.4 에서 variance 분석과 함께 구축.

이렇게 축소해도 data model 은 완전 (Phase 5 에서 추가 로직만 붙임).

---

## 3. Part B — 쿼리 응답 원본 backlink 렌더링

### 3.1 `wikey-core/src/source-resolver.ts` (신규)

```typescript
export interface ResolvedSource {
  readonly sourceId: string        // 'sha256:...'
  readonly title: string           // source 페이지의 frontmatter title 또는 원본 파일명
  readonly currentPath: string     // registry.vault_path (PARA 이동 후 최신)
  readonly mimeType: string        // 'application/pdf' / 'text/markdown' 등 (확장자 기반)
  readonly isExternal: boolean     // uri-hash:* 접두면 true
  readonly tombstoned: boolean     // registry.tombstone
  readonly openUri: string         // buildObsidianOpenUri 또는 buildFileUri 결과
}

export async function resolveSource(
  wikiFS: WikiFS,
  vaultName: string,
  absoluteBasePath: string,
  sourceIdOrRef: string,           // 'sha256:...' 또는 'sources/sha256:...'
): Promise<ResolvedSource | null>
```

- 내부에서 `loadRegistry` → `findById` (prefix 관용) → tombstone 체크 → URI derive.
- `ref` 입력은 `sources/sha256:...` prefix 허용 (provenance 필드 그대로 전달 가능).
- registry 미등록 id 는 `null` 반환 (동기 렌더 경로에서 tombstone 처럼 "원본 삭제됨" 처리).

### 3.2 `query-pipeline.ts` citations 구조화

기존 `QueryResult`:
```typescript
{ answer: string, sources: SearchResult[], tokensUsed?: number }
```

확장 후:
```typescript
{
  answer: string
  sources: SearchResult[]
  tokensUsed?: number
  citations?: readonly Citation[]  // 신규
}

export interface Citation {
  readonly wikiPagePath: string          // 'wiki/entities/xxx.md'
  readonly sourceIds: readonly string[]  // 해당 페이지의 provenance → 고유 source_id 목록
  readonly excerpt?: string              // 검색 결과 snippet 재사용
}
```

- 생성 로직: `searchResults` 각 페이지의 frontmatter 를 파싱 → `provenance[].ref` → source_id dedupe → `Citation` 1건.
- 답변 텍스트에 나온 wikilink 와 `citations[].wikiPagePath` 가 일치하면 사이드바 렌더링에서 보조 링크 attachment 대상.
- **호환성**: `citations` 는 optional — UI 가 없어도 기존 `sources` 필드는 그대로 유지.

### 3.3 `sidebar-chat.ts` 답변 렌더링

**현재**: markdown renderer + wikilink 치환 (`[[source-xxx]]` → internal-link).

**변경**:
1. 답변 렌더 직후 `citations` 가 있으면, 각 wikilink 뒤에 `📄` 보조 버튼 attach.
2. 클릭 핸들러 (v2 수정 — Obsidian plugin 은 Electron main process `shell` API 에 직접 접근 불가):
   - **내부 vault 파일**: `this.app.workspace.openLinkText(vaultPath, '')` — Obsidian 이 라우팅 (PDF/MD/IMG 는 내장 뷰어, 기타 확장자는 기본 앱 위임).
   - **외부 앱 위임 필요 시** (대용량 PDF 를 내장 뷰어 대신 OS 기본 앱으로 열기): `app.openWithDefaultApp(vaultPath)` — Obsidian 1.5+ 에 존재, fallback 은 `window.open('file://'+absolutePath)` (Electron renderer 에서 허용).
   - **외부 URI** (`uri-hash:*` prefix): `window.open(uri, '_blank', 'noopener')`.
   - **tombstone**: `new Notice('원본 삭제됨 (registry tombstone)')`, 버튼은 disabled + opacity 0.4.
3. **철학 가드 CSS**: 보조 링크 크기 `0.68em`, 투명도 `opacity: 0.7`, wikilink 보다 눈에 덜 띄게 (wikey-audit-reclass-line 패턴 재사용).
4. **접근성** (v2 추가): 보조 링크에 `aria-label="원본 파일 열기: <filename>"` + `title` 속성. 색약 사용자는 아이콘 + 텍스트 조합으로 구분 가능. 필요 시 Phase 5 §5.7 에서 사용자 설정 toggle 로 아이콘-only / 텍스트-only 선택 가능하게.

### 3.4 실제 공유: 답변 하단 "근거 소스" 패널 (옵션)

답변 본문의 인라인 보조 링크 외에도, 답변 하단에 `Citations` 섹션 (접을 수 있는 details) 으로 모든 citation 목록 렌더링. 사용자가 원본을 훑어보고 싶을 때 유용. **MVP 범위**: 인라인만 구현, 하단 패널은 후속.

---

## 4. §4.3.1 3-stage 프롬프트 Override (도메인 프리셋 제외)

### 4.1 현재 상태

- Stage 1 (summary → source_page) — `.wikey/ingest_prompt.md` override **지원**.
- Stage 2 (chunk → Mention) — override **미지원**. 프롬프트는 `ingest-pipeline.ts` 내부 상수.
- Stage 3 (mention → canonical entity/concept) — override **미지원**. 프롬프트는 `canonicalizer.ts::buildCanonicalizerPrompt` 내부.

### 4.2 목표

- Stage 2/3 에도 override 파일 지원: `.wikey/stage2_mention_prompt.md`, `.wikey/stage3_canonicalize_prompt.md`.
- 기존 `ingest_prompt.md` 는 `stage1_summary_prompt.md` 로 **심볼릭 링크 호환** 유지 (파일 이름만 변경, 내용은 그대로).
- 설정 탭 Ingest Prompt 섹션: 3개 prompt 모두 Edit/Reset 버튼 + "적용 여부" 상태 표시.

### 4.3 범위 축소

**Phase 4 에서 제외** (Phase 5 §5.6 self-extending 에 귀속):
- 도메인별 프리셋 (기술문서 / 논문 / 매뉴얼 / 회의록 / 제품 스펙) — self-extending 의 prompt 자동 선택이 등장하는 §5.6 Stage 2 와 중복 논의 가능성.
- 모델별 품질 baseline 측정 — Phase 5 §5.4 variance diagnostic 과 묶어서 측정.

**Phase 4 에서 수행**: file-based override 인프라만 구축. 콘텐츠는 사용자가 필요 시 직접 작성.

### 4.4 구현 포인트

- `wikey-core/src/ingest-pipeline.ts::loadEffectiveIngestPrompt` 재사용 패턴으로 `loadEffectiveStage2Prompt` · `loadEffectiveStage3Prompt` 추가. 미존재 시 bundled fallback.
- `canonicalizer.ts::buildCanonicalizerPrompt` 시그니처 확장 — **optional 파라미터** 로 `overridePrompt?: string` 추가 (v2 명시). 기존 호출부는 argument 추가 없이 그대로 호출 가능 (backward compat). override 가 있으면 bundled prompt 대체, 없으면 기존 동작.
- `wikey-obsidian/src/settings-tab.ts` Ingest Prompt 섹션 렌더를 3개 prompt 로 복제 — 각각 Edit / Reset / "적용 여부" 상태 표시.
- `loadEffectiveStage2Prompt(wikiFS) → Promise<{ prompt: string; overridden: boolean }>` 패턴으로 "적용 여부" 를 UI 에 surface 가능하게 설계.

### 4.5 Stage 1 override 가이드 (v2 신설 — §4.3.3 stripBrokenWikilinks 와 상호작용)

Stage 1 override prompt 가 source 페이지 본문에 직접 wikilink (`[[어떤개념]]`) 를 생성하도록 유도하면, §4.3.3 의 재후처리 시점에 canonical 된 entity/concept 페이지에 매칭되지 않는 wikilink 는 plain text 로 강등된다. 이는 의도된 유지 wikilink 를 잃는 위험.

**완화책**:
- `.wikey/stage1_summary_prompt.md` 상단에 주석 가이드 추가 (bundled prompt 에 예시 포함): "source_page 본문에서 `[[...]]` wikilink 를 작성하지 마십시오 — Stage 2/3 에서 canonical 된 페이지만 wikilink 로 남고 나머지는 plain text 로 강등됩니다. 맥락 힌트는 굵게/이탤릭 또는 코드 블록으로 표현하세요."
- settings-tab Edit UI 의 Stage 1 탭에 같은 가이드를 inline 설명으로 렌더.
- 진짜로 wikilink 를 유지해야 하는 경우: Stage 2/3 override 로 해당 개념을 whitelist 하도록 사용자가 두 prompt 를 함께 조정 (Phase 5 §5.6 의 자동 프리셋이 이 합동 조정을 대행할 예정).

---

## 5. §4.3.3 stripBrokenWikilinks 자동 적용

### 5.1 현재 상태

- `wiki-ops.ts::stripBrokenWikilinks(text, keepBases)` 함수 존재 — canonicalizer 가 entity/concept 페이지 + log entry 에 호출.
- **누락**: Stage 1 summary 가 생성하는 source 페이지 본문 wikilink 는 적용 안 됨 → OMRON 세션 261 건 한국어 wikilink 수동 cleanup 필요했던 이력 (Phase 3 §14.5).

### 5.2 변경 (v2 — Stay-involved Preview 모달 순서까지 확정)

**핵심 순서**:
1. Stage 1: source 페이지 **임시 생성** (wikilink 포함 상태, fs 미저장 — 메모리 only).
2. Stage 2/3: entity/concept 페이지 canonicalize → `writtenPages` 확정.
3. **신규** `stripBrokenWikilinks(sourcePageContent, keepBases)` — wiki 페이지로 존재하는 wikilink 만 남기고 나머지는 plain text 로 강등.
4. **그 뒤에** Stay-involved Preview 모달 표시 — 사용자는 stripped 버전만 본다 (저장본과 동일). Preview Apply 시 `wiki-ops.ts::createPage` 로 최종 저장.

**주의 — v1 대비 보강된 이유**: v1 초안은 Stage 1 직후 source 페이지를 fs 에 바로 저장하고 Stage 2/3 완료 후 덮어쓰는 구조였다. 이 경우 Stay-involved Preview 단계 (현재는 Stage 1 이후 실행) 에서 사용자가 본 wikilink 가 최종 저장본에서는 plain text 로 바뀌어 "사용자 UX 불일치" 발생. v2 는 Preview 를 Stage 2/3 완료 + strip 후로 미뤄 저장본과 Preview 가 bit-identical 이 되게 한다.

**기존 Stay-involved 구조 영향**:
- `runIngest` 흐름에서 `stage1PreviewModal` 호출 지점을 Stage 3 canonicalize 완료 이후로 이동.
- Brief 모달 (ingest 시작 전 Guide emphasis) 은 그대로 — 사용자 입력은 Stage 1 실행에 영향을 주므로 시작 단계 유지.
- Processing 모달 (Stage 2/3 진행 상황) 은 그대로.

**대안**: 사용자가 "Stage 1 직후 즉시 Preview" 를 원하는 경우가 있을 수 있음 (긴 인제스트 시간 동안 중간 검증). 그 경우 Preview 의 상단에 `⚠ 아직 canonicalize 전이라 wikilink 가 plain text 로 바뀔 수 있습니다` 경고 배너 추가 — v2 에서는 **기본을 후행 Preview 로**, Phase 5 에서 사용자 선택 옵션 고려.

**구현 세부**:
- `ingest-pipeline.ts::runIngestInternal` 가 Stage 3 완료 후 `stripBrokenWikilinks` 호출 → `sourcePage.content` 갱신 → 그 다음 Preview hook + createPage.
- `keepBases` 는 Stage 2/3 에서 canonical 된 entity/concept 페이지 filename Set — 이미 `writtenPages` 로 집계 중. `normalizeBase` 로 정규화 후 Set 구성.

### 5.3 회귀선

- 기존 `wiki-ops.test.ts::stripBrokenWikilinks` 단위 테스트 그대로 유지.
- `ingest-pipeline.test.ts` 에 신규 통합 테스트 1건: source 페이지 본문에 `[[없는개념]]` 과 `[[존재하는-entity]]` 가 모두 있을 때 후자만 유지됨 확인.

---

## 6. 실행 순서 / TDD 계획

### 6.1 순서

1. **Part A** — types.ts 타입 정의 → wiki-ops.ts `injectProvenance` + vitest +3 → ingest-pipeline Stage 2/3 배선 + vitest +3.
2. **§4.3.3 stripBrokenWikilinks** — source 페이지 재후처리 추가 + vitest +1. (Part A 가 쓴 페이지가 깨진 wikilink 를 갖지 않도록 선제 방어.)
3. **Part B** — source-resolver.ts 신규 + vitest +4 → query-pipeline.ts citations 구조화 + vitest +2 → sidebar-chat.ts 렌더 + CSS (수동 smoke).
4. **§4.3.1 3-stage override** — loadEffectiveStage2/3Prompt + vitest +2 → canonicalizer signature 확장 + vitest +1 → settings-tab UI (수동 smoke).
5. 통합 smoke — 실제 PMS PDF 인제스트 1회 → 생성된 entity/concept 페이지에 provenance 필드 존재 + 쿼리 응답에서 원본 backlink 표시 확인.
6. 문서 동기화 (result → todo → plan → followups → memory) + 단일 commit + push.

### 6.2 TDD 테스트 총계 목표

| 파일 | 신규/확장 | 테스트 수 |
|------|-----------|----------|
| `__tests__/wiki-ops.test.ts` (+injectProvenance) | 확장 +3 | +3 |
| `__tests__/ingest-pipeline.test.ts` (Provenance 배선 + stripBrokenWikilinks + stage2/3 override) | 확장 +6 | +6 |
| `__tests__/source-resolver.test.ts` | 신규 | 4 |
| `__tests__/query-pipeline.test.ts` (citations 구조화) | 확장 +2 | +2 |
| `__tests__/canonicalizer.test.ts` (stage3 prompt override) | 확장 +1 | +1 |

**총 +16 목표** (434 → 450+). 각 파일 80%+ 라인 커버리지 유지.

### 6.3 통합 smoke (실제 인제스트)

- 대상: `raw/3_resources/30_manual/500_natural_science/PMS_제품소개_R10_20220815.pdf` (재이동 안 된 경우 `raw/0_inbox/` 에 복사본으로 재인제스트).
- 확인:
  - 생성된 `wiki/entities/*.md` 에 `provenance: [{type: extracted, ref: sources/sha256:...}]` 존재.
  - `wiki/concepts/*.md` 중 LLM-inferred 인 것은 `type: inferred` + `confidence`.
  - source 페이지 본문에 깨진 한국어 wikilink 없음 (§4.3.3 확증).
  - 쿼리 `"PMS 의 주요 기능은?"` 실행 → 답변에 wikilink 가 `📄 보조 링크` 와 함께 렌더링, 클릭 시 원본 PDF 열림.

---

## 7. 검증 기준 (Karpathy #4)

| 주장 | 증거 |
|------|------|
| Provenance 타입 정의 | `types.ts` ProvenanceType / ProvenanceEntry export, tsc 0 errors |
| provenance 주입 idempotent + dedupe | `wiki-ops.test.ts` injectProvenance 3 tests green |
| ingest 시 provenance 자동 작성 | `ingest-pipeline.test.ts` +3 green, 통합 smoke 로 실제 생성 페이지 확인 |
| source-resolver registry 연계 | `source-resolver.test.ts` 4 tests — 존재 / 미등록 / tombstone / PARA 이동 후 해석 모두 green |
| query-pipeline citations | 기존 `QueryResult.sources` 유지 + `citations` optional 추가 후 +2 tests green |
| sidebar 렌더 보조 링크 | 수동 smoke — 답변 wikilink 뒤 📄 아이콘, 클릭 동작 3경로 (내부/외부/tombstone) 모두 확인 |
| 3-stage override file-based | `loadEffectiveStage2/3Prompt` +2 tests (override 미존재 / 존재) green |
| stripBrokenWikilinks source 페이지 | 통합 테스트 1건 — `[[없는]]` 제거 + `[[있는]]` 유지 |
| 테스트 회귀 | 434 → **450+** green, 실패 0 |
| 빌드 | `npm run build` 0 errors (tsc + esbuild) |
| wiki 구조·PII | `validate-wiki.sh` + `check-pii.sh` PASS |

---

## 8. 리스크와 롤백

| 리스크 | 대응 |
|-------|------|
| provenance 스키마가 Phase 5 에서 확장 필요해짐 | ProvenanceType union + optional fields 설계로 후방 호환 보장. 새 type 추가는 비파괴. |
| LLM 이 citation 에 없는 source_id 를 환각 | provenance.ref 는 Stage 2/3 생성 시점에 code-side 로 주입 (LLM 출력 신뢰 안 함). |
| source-resolver 대용량 볼트 성능 | registry 조회는 O(1) (id → record). 필요 시 `Map` 캐시. |
| 3-stage override 가 결정성 측정에 영향 | override 는 사용자 opt-in — 기본 경로는 bundled prompt 그대로. measure-determinism.sh 는 bundled 기준으로 돌림. |
| stripBrokenWikilinks 가 의도된 wikilink 를 제거 | `keepBases` 에 이번 ingest 에서 생성되는 페이지 전부 포함 → 같은 세션 내에서 생성된 링크는 안전. 다른 세션 wiki 페이지는 사용자가 Stage 2/3 결과를 검토하는 Audit 패널에서 추가 보강 (Phase 5 §5.4 연계). |
| sidebar 보조 링크가 wikilink 를 overpower | CSS 로 크기·투명도 낮춤 (§3.3). 필요 시 사용자 설정 toggle (Phase 5 §5.7 이관 가능). |

**롤백 단위**: Part A 커밋 / Part B 커밋 / §4.3.1 커밋 / §4.3.3 커밋 분리. provenance 필드는 optional 이라 작성 중단해도 기존 페이지 파괴 없음.

---

## 9. Open question — v2 self-review 결정

v1 작성 시 open 이었던 5 항목 모두 v2 에서 decision 명시:

| # | 질문 | v2 결정 | 근거 |
|---|------|---------|------|
| 1 | Provenance 복수 source 표현 — flat 다중 엔트리 vs `refs:[...]` 단일 | **flat 유지** | entity 가 source A 에서는 extracted, source B 에서는 inferred 인 경우가 일반적 — type 이 ref 별 상이해야 함. 또한 Phase 5 §5.2 지식 그래프가 entity→source 에지를 만들 때 각 provenance 엔트리당 1 에지로 매핑 간단. |
| 2 | Part B 인라인 vs 하단 Citations 패널 | **인라인만 MVP** | 답변 본문의 wikilink 와 근접하게 렌더 → 컨텍스트 유지. 하단 패널은 Phase 5 §5.7 운영 포팅에서 "Export to PDF" 등 별도 사용 케이스와 함께. |
| 3 | §4.3.1 도메인 프리셋 포함 여부 | **Phase 5 이관** | Phase 5 §5.6 self-extending 의 자동 프리셋 선택과 중복. Phase 4 에선 file-based override 인프라만 구축. 사용자가 직접 필요한 override 작성. |
| 4 | stripBrokenWikilinks 와 Stay-involved Preview 모달 시점 | **Preview 를 Stage 2/3 + strip 후로 이동** (§5.2 확정) | Preview 와 저장본 bit-identical 보장 → 사용자 UX 불일치 제거. 긴 인제스트 중간 검증이 필요한 케이스는 Phase 5 에서 옵션 toggle 고려. |
| 5 | AMBIGUOUS 리뷰 UI | **Badge + Notice 만** (Phase 5 §5.4 에서 Accept/Reject 확장) | data model 은 완전 (`type: ambiguous` 기록). Accept/Reject 로직은 Phase 5 variance 분석과 묶어서 ROI 확보. 본체 완료 정의에 위배 아님 — wiki 재생성 없이 후속 로직만 추가. |

---

## 10. 다음 액션

1. v2 self-review 완료 — v1 의 4 개 잠재 결함 (Obsidian Electron API · canonicalizer 시그니처 backward compat · Preview 모달 순서 · Stage 1 override 가이드) 을 plan v2 본문에 반영.
2. codex rescue 검증은 프로세스가 analysis 턴 후반에 최종 응답 캡처 실패 (3013 bytes 에서 동결) → v2 는 self-review 로 대체 진행. 이후 구현 중 변경 사유 발생 시 v3 재작성.
3. **Part A 착수** (TDD):
   - (a) `types.ts` 에 `ProvenanceType` / `ProvenanceEntry` export.
   - (b) `wiki-ops.ts` 에 `injectProvenance` + vitest +3 (주입 / dedupe / merge).
   - (c) `ingest-pipeline.ts` Stage 2/3 에서 provenance 주입 배선 + vitest +3 (extracted / inferred / ambiguous).
4. Part A green 확인 후 §4.3.3 stripBrokenWikilinks 재후처리 배선 → Part B → §4.3.1 순.

---

## 11. v2 Self-review 기록 (codex 대체)

codex rescue agent 가 분석 완료 전 프로세스 종료 (b2p8s3sgq.output 3013 bytes 에서 동결, 최종 assistant 응답 캡처 실패) 로 외부 2차 검증 대신 self-review 수행. 계획서 각 섹션을 "구현 시 깨질 수 있는 가정" 관점으로 재독해한 결과 v1 대비 4 개 잠재 결함 발견.

### 11.1 발견 결함과 v2 반영

| # | 발견 | v1 위치 | v2 수정 위치 | 심각도 |
|---|------|---------|--------------|--------|
| 1 | Obsidian plugin 은 Electron renderer process 라 `shell.openPath` (main-only API) 직접 접근 불가. `app.openWithDefaultApp` 또는 `window.open('file://...')` 가 올바른 API. | §3.3 | §3.3 (클릭 핸들러 3 경로 재작성) | High — 구현 시 runtime error 확실 |
| 2 | `buildCanonicalizerPrompt` 시그니처 확장을 "optional" 로 명시 안 함. 기존 호출부 깨짐 리스크. | §4.4 | §4.4 (optional 파라미터 명시 + backward compat 주석) | Medium |
| 3 | stripBrokenWikilinks 가 Stage 2/3 후 source 페이지 재후처리 — 기존 Stay-involved Preview 모달이 Stage 1 직후 실행되면 사용자가 본 내용 ≠ 저장본 불일치 발생. | §5.2 | §5.2 (Preview 를 strip 후로 이동, 구현 순서 확정) | Medium — UX 문제, data 안전 |
| 4 | Stage 1 override prompt 가 wikilink 를 직접 생성하도록 유도하면 §4.3.3 재후처리 시 의도된 wikilink 까지 strip 될 위험. | 누락 | §4.5 신설 (bundled prompt 주석 + settings UI inline 가이드) | Low — 문서 경고로 완화 가능 |

### 11.2 self-review 결정이 남긴 잔존 위험

- Phase 5 §5.6 self-extending 의 `provenance.type = 'self-declared'` 구현 시 추가 메타 (예: `declared_at_page`) 가 필요해지면 optional 필드 추가로 non-breaking 확장 가능. 재설계 없음.
- source_id prefix 가 Phase 5 에서 24hex 로 확장되는 경우 (§4.2 plan v3 §2.1 의 rare escalation): source-resolver 가 prefix 관용 + full-hash verify 사용 → 기존 페이지 provenance ref 도 계속 resolve. 재설계 없음.
- `WIKEY_EXTRACTION_DETERMINISM=true` 모드와 `provenance.confidence` 상호작용: confidence 는 LLM 생성 값, determinism 모드에서도 seed 고정이라 재현 가능 → 정합성 문제 없음.

### 11.3 codex 2차 검증 재시도 권고

본 v2 착수 후 Part A 완료 시점 (실제 코드 + vitest +3 green) 에서 Codex 에 한 번 더 검증 의뢰 가능 — 그때는 분석 대상이 계획서 + 실제 구현이라 더 구체적 피드백 기대. 이번처럼 분석 완료 전 timeout 하는 경우 재시도 주기를 짧게 잡고 output 파일 watch. Phase 4 본체 완료 선언 전 최종 검증을 걸면 안전.
