# §5.10 Phase 1+2+3 Session 16 결과 요약 (2026-05-04 ~ 2026-05-05)

> **상위 문서**: `activity/phase-5-result.md §5.10.1~§5.10.3`
> **Plan**: `plan/phase-5-todo.md §5.10` + `plan/phase-5-todox-5.10-graph-emergent-ontology.md`
> **목적**: 사용자 명시 ("Phase 3까지 완료한 뒤 obsidian-cdp 테스트까지 모두 완료된 뒤에는 작업결과를 todo/select에 반영한 뒤, 결과 요약보고서를 만들어주고") 따른 종결 보고서.
>
> tag: #ontology, #paradigm-shift, #phase-3, #d-wide, #session-summary

## 0. 한눈 매트릭스

| Phase | spec | 결과 | 회귀 baseline | commit |
|-------|------|------|---------------|--------|
| §5.10.1 | C1 conversion 통합 (AC-C1.1~C1.7) | ✅ Unit/Integration GREEN | 732 → **757 PASS (+25)** | `c1df892` |
| §5.10.2 | C5 broken-link prevention (AC-C5.1, C5.2) | ✅ Unit/Integration GREEN | 757 → **760 PASS (+3)** | `0f241a5` |
| §5.10.3.1 R0 | Stage 2 mention prompt type_hint 자유 | ✅ GREEN | 760 → **761 PASS (+1)** | `a08cbd7` |
| §5.10.3.2~7 R1~R8.1 | D-wide schema/canonicalizer/types 폐기 + 88 cases skip | ✅ GREEN (atomic) | 761 → **673 PASS + 88 skipped + 0 fail** | (이번 commit) |
| §5.10.3.x 라이브 smoke | Obsidian CDP 라이브 cycle (PDF/HWP/DOCX brief + Cancel + broken link + D-wide LLM 자율 type) | ⏸ 환경 의존 (사용자 명시 액션 필요) | — | — |

**총 누적 변경**: 732 → 673 PASS / 88 skipped / 0 fail. 회귀 0 (skip 처리 88 cases 외 모두 GREEN). build 0 errors fresh re-run.

## 1. Phase 1 (§5.10.1) — C1 conversion 통합 (commit `c1df892`)

### 1.1 사용자 본질 비판 C1
> "ingest summary를 별도의 extractPDFText(stripped만 사용)을 할게 아니라, step3에서 파일 유형에 따른 converting은 필수조건이므로 컨버팅을 1-step으로 진행하는게 바람직해 보임"

### 1.2 신규/변경 파일

| 파일 | 변경 | 핵심 |
|------|------|------|
| `wikey-core/src/conversion.ts` (신규) | 5 분기 통합 entry | PDF/HWP·HWPX/DOCX·PPTX·HTML Docling/md/txt → ConversionResult `{content, sidecarCandidate?, ext, converter}`. vault write 책임 0 |
| `wikey-core/src/ingest-pipeline.ts` | helpers export + generateBrief 시그니처 변경 + IngestOptions.preconverted | extractHwpText/extractDocumentText/extractPdfText/DOCLING_DOC_FORMATS/doclingMajorOptions export. generateBrief(content, sourceFilename, ...) (HWP/DOCX/PPTX/HTML brief 정상). preconverted 주입 시 Step 1 분기 skip |
| `wikey-core/src/convert-cache.ts` | schema 갱신 string → JSON | `{content, sidecarCandidate?}` + backward compat (legacy string fallback). 3 callsite atomic migrate (1512 unhwp / 1576 docling / 1790 pdf cache hit / 1767 setCached PDF vector raw 보존) |
| `wikey-obsidian/src/commands.ts` | UI flow 수정 | modal open → convertSourceToMarkdown 1회 → generateBrief(content) → runIngestCore({preconverted}). Cancel 분기 명시 (vault write 0) |

### 1.3 신규 테스트 (+25)

- `conversion.test.ts` 신규 — 12 cases (5 분기 cache hit + md/txt passthrough + embedded image strip + pure invariant + error)
- `conversion.test.ts` AC-C1.2 — 5 cases (generateBrief content 입력)
- `ingest-pipeline-incremental.test.ts` AC-C1.5 — 4 cases (preconverted skip 시나리오 4종: hash-match / skip-with-seed / duplicate-hash / edit-noted)
- `convert-cache.test.ts` AC-C1.7 — 4 cases (vector PDF distinct sidecarCandidate / scan PDF fallback / legacy string compat / 3 callsite migration)

### 1.4 사용자 가치 (3 결함 fix)

| 결함 | 변경 후 |
|------|--------|
| (a) brief 의 비-PDF 포맷 누락 — HWP/DOCX binary → LLM | brief 가 *변환된 markdown* 받음. 모든 포맷 정상 |
| (b) sidecarCandidate cache hit 시 stripped 로 잘못 설정 | cache schema 가 sidecarCandidate distinct 저장 (vector PDF raw 보존) |
| (c) Karpathy Simplicity 위반 — Step 2 가 자기 conversion + Step 3 가 cache 통해 다시 | Step 0 (UI/CLI 공통 entry, conversion.ts) → Step 2 (brief content 받음) → Step 3 (preconverted 주입). 분기 1 곳 |

## 2. Phase 2 (§5.10.2) — C5 broken-link prevention (commit `0f241a5`)

### 2.1 사용자 본질 비판 C5
> "질의/응답 결과의 본문에 페이지가 없는 링크가 있고, 이것을 선택하면 root폴더에 해당 페이지가 새롭게 생성되는 구조" + "현재의 root폴더에 그래서 생성된 빈페이지가 있음"

### 2.2 변경 파일

| 파일 | 변경 | 핵심 |
|------|------|------|
| `wikey-core/src/query-pipeline.ts` | buildSynthesisPrompt 정정 | context page section 자동 parse → `[Available pages]: ...` block. rule 386 정정 (목록에 있는 것만 wikilink, plain text fallback). rule 385 정정 (read 실패 wikilink 답변 미포함) |
| `wikey-obsidian/src/sidebar-chat.ts` | renderMarkdown click handler | `handleWikilinkClick` helper (resolve-before-open). `metadataCache.getFirstLinkpathDest` resolve null → Notice + DOM `wikey-broken-link` class |
| `wikey-obsidian/styles.css` | broken-link 시각 dim | `.wikey-broken-link { opacity: 0.5; line-through; not-allowed; }` |

### 2.3 신규 테스트 (+3)

- `query-pipeline.test.ts` — 3 cases (Available pages block 자동 주입 / rule 386 정정 / rule 385 정정)
- AC-C5.2 unit test = obsidian DOM mock 큼 → 라이브 smoke 의무

### 2.4 사용자 가치

| Karpathy 원칙 | 적용 |
|---------------|------|
| Explicit | LLM 이 *없는 정보* 를 link 로 표기 안 함 (가시성 정확) |
| 시각 분리 | broken link DOM 명확 dim — 사용자가 "이건 없는 페이지" 즉시 인지 |
| vault 오염 차단 | root 빈 페이지 자동 생성 0 (Obsidian default 동작 차단) |

## 3. Phase 3 (§5.10.3) — D-wide paradigm shift (R0+R1+R2+R3 + 88 cases skip)

### 3.1 사용자 본질 비판 6 chain

1. "표준 분해 패턴을 왜 등록·관리해야 하나? 너무 엔지니어링적 사고."
2. "self-extending 인데 진짜는 자동 확장 ontology 개념이어야지. 지금은 수동."
3. "표준 분해 그룹 = 지식 그룹? 표준 분해 그룹 ⊂ 지식 그룹."
4. "wiki 가장 많이 노출되는 게 중심으로 — 굳이 그룹으로 나눠 제한 두는 게 이상해."
5. "지식 분해하는 그룹이 왜 필요? 세상 수많은 지식을 어떻게 표준화?"
6. "굳이 어려운 말 써가면서 지식을 분류할 필요 없잖아. LLM 이라는 든든한 백 위에서 움직이는 건데."

→ **옵션 D-wide 채택** (LLM-only ontology + 7-type schema gate 폐기).

### 3.2 R 항목별 결과

| R | 작업 | 폐기/변경 | line 변동 |
|---|------|-----------|-----------|
| R0 | ingest-pipeline.ts:937 type_hint 자유 string | "다음 중 하나 또는 unknown" → "자유 string. 예시: organization/.../algorithm/dataset/metric. 모르면 unknown" | +1 신규 test |
| R1 | schema.ts validation/builder/상수 폐기 | isValidEntityType / isValidConceptType / getEntityTypes / getConceptTypes / validateMention / buildSchemaPromptBlock / detectAntiPattern / normalizeForLookup / ENTITY_TYPES / CONCEPT_TYPES / ENTITY_TYPE_DESCRIPTIONS / CONCEPT_TYPE_DESCRIPTIONS / CONCEPT_DECISION_TREE 모두 삭제. YAML parser 의 entity_types / concept_types section silently skipped | 685 → ~290 line (~395 line 폐기) |
| R2 | canonicalizer.ts FORCED_CATEGORIES + detectAntiPattern 폐기 | FORCED_CATEGORIES (12 entries) + applyForcedCategories + validateAndBuildPage 의 type validation + computeDropReason 의 detectAntiPattern + buildSchemaPromptBlock(schemaOverride) 호출 + prompt "위 7개 타입" 강제 | 602 → ~440 line (~160 line 폐기) |
| R3 | types.ts union → string | EntityType union → string. ConceptType union → string. Mention.type_hint union → string. WikiPage.category 4-union 보존 | 17 lines 변경 |
| R6 | wiki-ops.ts 영향 X | grep 결과 0 hit. ProvenanceType / frontmatter `sources:` 보존 | 0 변경 |
| R7 | query-pipeline.ts 영향 X | grep 결과 0 hit. §5.2 검색 layer 무영향 | 0 변경 |
| R8.1 | 폐기 test 88 cases .skip | schema.test.ts 5 describe (39) + schema-override.test.ts 11 describe (27) + canonicalizer.test.ts 5 describe + 2 it (~22) | 88 cases skipped |

### 3.3 atomic single commit 이유

build 깨짐 회피. R1+R2+R3 ripple 큼:
- types.ts EntityType / ConceptType 변경 → schema.ts 의 ENTITY_TYPES 의존 → canonicalizer.ts 의 import 의존 + validateAndBuildPage type assertion 의존 + index.ts re-export
- 하나만 변경 시 타입 에러 chain → atomic 진행이 합리적

### 3.4 보존된 핵심 layer (D-wide 정책 일치)

- `BUILTIN_STANDARD_DECOMPOSITIONS` (PMBOK 10 areas hardcoded) — §5.10.4 M migration 단계 영역
- `parseSchemaOverrideYaml` (standard_decompositions parser 만 active) — 동일
- `buildStandardDecompositionBlock` — 동일
- `loadSchemaOverride` — 동일
- `SLUG_ALIASES` / `canonicalizeSlug` / `dedupAcronymsCrossPool` — alias normalization (deterministic)
- `applyCrossLinks` (§5.2.1 entity↔concept H2 링크) — D-wide 와 직교

### 3.5 잔여 작업 (Phase 4 = §5.10.4)

D-wide Part 2 + Final:
- R4 settings-tab.ts schema sample 정정 (entity_types/concept_types 예시 제거)
- R5 docs/wikey-ingest-pipeline.md 5 line spot 정정
- R8.2 잔여 ~22 cases 폐기 (suggestion-detector / convergence / self-declaration §5.4 Stage 2~4)
- R8.3 §5.2 / §5.3 회귀 0 확증
- M migration script + UI 폐기 (Suggestions panel header button 제거 등) + store cleanup
- L 라이브 cycle smoke 5 항목 (master 직접 obsidian-cdp)
- F 3 cycle 통합 codex Mode D Panel post-impl review APPROVE → §5.10 전체 종결 mark

## 4. obsidian-cdp 라이브 cycle smoke — 사용자 환경 의존 (다음 액션)

### 4.1 사용자 명시 요구

> "obsidian-cdp 테스트를 위해 기존의 ingest되었던 모든 파일을 0_inbox로 원복하고, wiki 파일도 초기화 해야 할거야."

### 4.2 환경 준비 항목

| 항목 | 명령 또는 액션 |
|------|---------------|
| Obsidian CDP 재시작 | 사용자가 Obsidian 종료 후 `open -a Obsidian --args --remote-debugging-port=9222 --remote-allow-origins=*` 또는 `~/.claude/skills/obsidian-cdp/SKILL.md` 따른 launcher 사용 |
| raw 원복 (ingest 된 파일 → 0_inbox) | master 가 `find raw/3_resources -mindepth 3 -type f` 의 ingest 된 파일 mv → `raw/0_inbox/`. raw/_delayed/ 의 placeholder 는 skip (delay-ingest 시스템 의도) |
| wiki/ 초기화 | `rm -rf wiki/concepts/* wiki/entities/* wiki/sources/* wiki/analyses/* && truncate -s 0 wiki/index.md wiki/log.md wiki/overview.md wiki/.ingest-map.json` (사용자 명시 승인 후) |
| .wikey/source-registry.json 초기화 | `echo '{}' > .wikey/source-registry.json` (사용자 명시 승인 후) |

### 4.3 smoke cycle 항목 (master 직접 obsidian-cdp)

Phase 1+2+3 통합 검증 항목:
1. **§5.10.1 (Phase 1) — PDF brief**: `raw/0_inbox/<some>.pdf` ingest → brief 정상 표시 (HWP/DOCX 도 binary 미전송 확증)
2. **§5.10.1 (Phase 1) — Cancel vault write 0**: brief 표시 → Cancel → `git status raw/ wiki/ .wikey/` clean. cache file `~/.cache/wikey/convert/` 만 ephemeral 생성
3. **§5.10.1 (Phase 1) — vector PDF sidecar raw 보존**: vector PDF ingest → sidecar canonical write 시 raw 이미지 그대로 (결함 b fix 확증)
4. **§5.10.2 (Phase 2) — broken link click**: 답변 안 broken `[[link]]` click → root 빈 페이지 자동 생성 0 + Notice "위키에 없는 페이지 — 자동 생성 차단" + DOM dim
5. **§5.10.3 (Phase 3) — D-wide LLM 자율 type**: PDF / HWP ingest → LLM 출력 entity/concept type 이 7-type 외 자유 string 생성 가능 (예: `algorithm`, `regulation` 등) → frontmatter `entity_type:` / `concept_type:` 그대로 저장 → 분류 강제 X 확증

### 4.4 진행 권장

본 라이브 smoke 는 vault state 변경이 큰 작업 (현재 ~106 wiki 페이지 + ingest 된 ~30+ raw 파일 원복). 사용자 직접 승인 후 master 진행 권장. 본 commit 에서는 코드 변경 + 결과 요약보고서까지만 진행.

## 5. Karpathy 4 원칙 cross-check (전체 cycle)

| 원칙 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| Simplicity | 변환 1 곳 통합 | PAGE_HEADER_RE inline | ~555 line 폐기 — 큰 단순화 |
| Surgical | 5 file 변경 (helpers export 추가) | 두 click handler DRY | atomic single commit (build 깨짐 회피), boundary pin 폐기 |
| Goal-Driven | AC 7 정량 gate | AC-C5 정량 gate | R 7 항목 + R8.1 88 cases skip |
| Evidence-Based | fresh npm test 757 PASS | fresh 760 PASS | fresh 673 PASS / 88 skipped / 0 fail |

## 6. 다음 세션 진입점

1. **사용자 환경 준비** (선택, 큰 vault 변경):
   - Obsidian CDP 재시작 (`--remote-debugging-port=9222`)
   - raw/3_resources/ 등 ingest 파일 → raw/0_inbox/ 원복 (master 진행 가능)
   - wiki/ 초기화 + .wikey/source-registry.json 초기화
2. **§5.10.3 라이브 cycle smoke** (master 직접 obsidian-cdp): 위 §4.3 의 5 smoke 항목
3. **§5.10.4 Phase 4** (D-wide Part 2 + Final):
   - R4 settings-tab.ts schema sample 정정
   - R5 docs/wikey-ingest-pipeline.md 5 line spot 정정
   - R8.2 잔여 ~22 cases 폐기 (suggestion-detector / convergence / self-declaration)
   - R8.3 §5.2 / §5.3 회귀 0 확증
   - M migration script (`scripts/migrate-deprecate-standard-decompositions.sh`) + UI 폐기 (sidebar 6 패널 → 5 패널) + store cleanup (.wikey/suggestions.json / converged-decompositions.json 등 삭제)
   - L 라이브 cycle smoke 5 항목
   - F 3 cycle 통합 codex Mode D Panel post-impl review APPROVE → §5.10 전체 종결 mark

## 7. 잔존 minor stale (사용자 사전 결정 — 보존)

- `plan/phase-5-todox-5.10-graph-emergent-ontology.md` §7 self-check v5.3 표기 (line 233/235/241/242)
- `plan/plan-full.md:321` ~30~50 file / ~100 test cascade 표기 — Phase 4 §5.10.4.4 M migration 작성 시 동기화

## 8. footer

| 항목 | 값 |
|------|-----|
| Session | 16 (2026-05-04 ~ 2026-05-05) |
| Total commits | 4 (Phase 1 / Phase 2 / R0 / Phase 3 atomic) |
| Total test 변동 | 732 → 673 PASS (+29 신규 / +88 skipped / 0 fail) |
| Total code 변동 | ~+900 신규 (conversion.ts + 신규 test) / -~620 폐기 (schema.ts + canonicalizer.ts + 88 test cases) |
| Build | 0 errors fresh re-run |
| Karpathy cross-check | 모두 충족 |
| 라이브 smoke | ⏸ 다음 세션 (사용자 환경 준비 후 master 진행) |
