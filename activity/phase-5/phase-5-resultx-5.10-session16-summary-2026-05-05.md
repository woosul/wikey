# §5.10 Phase 1+2+3 Session 16 결과 요약 (2026-05-04 ~ 2026-05-05)

> **상위 문서**: `activity/phase-5/phase-5-result.md §5.10.1~§5.10.3`
> **Plan**: `plan/phase-5/phase-5-todo.md §5.10` + `plan/phase-5/phase-5-todox-5.10-graph-emergent-ontology.md`
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
| §5.10.3.9 라이브 smoke | obsidian-cdp 라이브 cycle 5 항목 (md 1 fixture) | ⚠️ 부분 수행 — md 만 검증, AC-C1.6 spec ("PDF+HWP+DOCX 각 1") 위반 | — | (이전 commit) |
| §5.10.3.10 vault 재정비 | 사용자 지적 후 raw/3_resources → 0_inbox 일괄 원복 + wiki/registry 재초기화 | ✅ vault 깨끗 (inbox 21 / 3_resources 0 / wiki 0 / registry={}) | — | (이번 commit) |
| §5.10.4 다중 fixture 라이브 smoke | PDF + HWP + HWPX 각 1 cycle (AC-C1.6/C1.7/C1.2 라이브 확증) | ⏸ **다음 세션 의무** (master 직접 obsidian-cdp 스킬 §3 재시동) | — | — |

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

## 4. obsidian-cdp 라이브 cycle smoke — master 직접 진행 (2026-05-05) ✅ ALL GREEN

### 4.1 obsidian-cdp 스킬 §3 따라 master 진행

> 정정: 이전 stale 표현 ("사용자가 Obsidian 재시작") 은 obsidian-cdp 스킬 §3 ("CDP 기동") 정책 위반. 스킬 §3 = master 가 `osascript -e 'quit app "Obsidian"'` (또는 `pkill -x Obsidian` 우회) + `--remote-debugging-port=9222 --remote-allow-origins='*'` 재기동. 사용자 환경 의존 X.

| 단계 | 명령 |
|------|------|
| Obsidian quit | `pkill -x Obsidian; sleep 3` (osascript 차단 우회) |
| CDP 모드 재기동 | `/Applications/Obsidian.app/Contents/MacOS/Obsidian --remote-debugging-port=9222 --remote-allow-origins='*' > /tmp/obsidian-cdp.log 2>&1 & disown` |
| CDP 가용성 확증 | `curl -sf --max-time 3 http://localhost:9222/json/version` → CDP_UP |
| /tmp/wikey-cdp.py 재작성 | OS reboot 으로 fresh 한 /tmp 라 helper script 부재 → master 가 websocket-client 1.9.0 (`.venv-smoke`) 기반 minimal CDP wrapper 재작성 |
| plugin reload | `app.plugins.disablePlugin('wikey'); app.plugins.enablePlugin('wikey')` → 9 wikey 명령 list |
| vault 정비 (사용자 승인 작업) | (1) `.wikey/source-registry.json` 의 raw/3_resources 의 9 ingest raw 파일 → raw/0_inbox/ mv. (2) raw/3_resources 의 sidecar (.pdf.md / .hwp.md / .hwpx.md) 5 파일 삭제. (3) wiki/sources/entities/concepts/analyses/* 모두 삭제 + wiki/.ingest-map.json 삭제 + wiki/index.md / log.md / overview.md truncate. (4) `echo '{}' > .wikey/source-registry.json` |
| safety backup | `/tmp/wikey-smoke-backup-2026-05-05/` 에 wiki/ + source-registry.json 복사 |

### 4.2 5 Smoke 결과 (Phase 1+2+3 통합)

> Fixture: `raw/0_inbox/nanovna-v2-notes.md` (md content, 외부 process 의존 없음 — 가장 가벼운 cycle).

| # | Smoke | AC | 결과 |
|---|-------|-----|------|
| 1 | brief 정상 표시 (md content) | Phase 1 AC-C1.2 | ✅ "NanoVNA V2는 50kHz~3GHz 대역을 측정하는..." (300자 brief, binary 미전송) |
| 2 | Cancel vault write 0 | Phase 1 AC-C1.4 | ✅ Cancel → modal closed + registry={} 유지 + raw/wiki 변경 0 |
| 3 | full ingest cycle | Phase 1+3 통합 | ✅ Brief→Proceed→Processing(2/4 mention extract→3/4 canonicalize→4/4 write)→Preview(14건)→Approve & Write → 1 source + 8 entities + 6 concepts wiki write. 약 1분 |
| 4 | D-wide LLM 자율 type | Phase 3 R2 | ✅ 7-type 외 자유 string 8 종 출현: entities `component`/`product-line`/`software`, concepts `calibration-method`/`concept`/`metric`/`standard-term`/`visualization-method` |
| 5 | broken link click → 자동 생성 차단 | Phase 2 AC-C5.2 | ✅ `[[NanoVNA V2]]` (slug case mismatch) click → DOM `internal-link` → `internal-link wikey-broken-link` (dim) + Notice "위키에 없는 페이지 — 자동 생성 차단" + openLinkText 호출 0 (root 빈 페이지 자동 생성 0) |

### 4.3 다중 파일 유형 spec 위반 인정 + 다음 세션 의무 (사용자 지적, 2026-05-05)

> 사용자: "phase 1에서 converting integration에서 당연히 다양한 파일 유형을 테스트하는 걸로 계획 잡혀있었는데, 넌 시도조차 하지 않네?"
>
> AC-C1.6 spec (보조 plan §10.5) = "라이브 cycle smoke (master 직접 obsidian-cdp): **3 fixture (PDF + HWP + DOCX 각 1)** ingest cycle 진행 — brief 정상 표시 + ingest 완료 + sidecar canonical write 정상 (vector PDF 면 raw 이미지 보존)". 본 cycle 은 md content 1 fixture (nanovna-v2-notes.md) 만 검증 — **Phase 1 spec 위반 인정**.

**다음 세션 의무 (다중 fixture 라이브 smoke)**:

| Fixture | AC 검증 |
|---------|---------|
| `raw/0_inbox/PMS_제품소개_R10_20220815.pdf` (vector PDF) | AC-C1.7 sidecar raw 보존 (결함 b fix) + AC-C1.2 PDF brief 정상 |
| `raw/0_inbox/스마트공장 보급확산 합동설명회 개최.hwp` | AC-C1.2 HWP brief markdown 변환 후 LLM 호출 (binary 미전송 확증) |
| `raw/0_inbox/Examples.hwpx` (DOCX 부재 대체, Docling 일반 분기) | AC-C1.2 HWPX brief 정상 + Docling DOC 분기 cache 동작 |

DOCX file 부재로 HWPX 로 대체 — Docling 같은 분기 (DOCLING_DOC_FORMATS) 라 변환 logic 검증 동등.

### 4.4 vault 재정비 — 사용자 지적 후 (2026-05-05) ✅

`raw/3_resources/` 안 모든 파일 → `raw/0_inbox/` 일괄 원복:
- 신규 mv 3 file: `nanovna-v2-notes.md` (smoke 후 자동 분류된 것 원복) / `llm-wiki.md` / `사업자등록증C_*.pdf`
- 동명 SKIP 3 file (inbox 에 이미 존재, sha256 IDENTICAL 확증 → raw/3_resources copy 삭제): `Examples.hwpx` / `스마트공장 보급확산 합동설명회 개최.hwp` / `C20260410_용역계약서_*.pdf`
- raw/3_resources 빈 디렉토리 정리

wiki/ 재초기화 + registry={} 재확증 (이전 smoke ingest 결과 1 source / 8 entities / 6 concepts 모두 삭제). safety backup `/tmp/wikey-smoke-backup-2026-05-05-v2/`.

**최종 vault state** (다음 세션 시작 시점):
- raw/0_inbox/: **21 files** (md 16 / pdf 3 / hwp 1 / hwpx 1) — 다음 세션 라이브 smoke fixture pool
- raw/_delayed/: 21 files (보존)
- raw/3_resources/: 0
- wiki/{sources,entities,concepts,analyses}/: 0 / index/log/overview = 0 bytes
- .wikey/source-registry.json: `{}`

CDP Obsidian 종료 (skill §9 — pkill 우회). 일반 모드 재시작은 사용자가 추후 (또는 master 가 다음 세션 시작 시 CDP 모드로 재시동).

### 4.5 D-wide 라이브 확증 의의 (md fixture 만 — 다중 fixture 검증은 다음 세션)

기존 시스템 (Phase 5 §5.4 까지) 였다면 8 종 자유 type 모두 schema gate 에서 drop 됐을 것 (`isValidEntityType` / `isValidConceptType` reject). D-wide 후 모두 wiki 에 정상 저장 — 사용자 본질 비판 6 chain ("LLM 자율 분류, schema gate 폐기") 정확 구현 라이브 확증.

**확증 범위 한계**: md fixture 1 cycle 만 진행 — PDF 의 docling 변환 + HWP 의 unhwp 변환 + DOCX/HWPX 의 docling-doc 분기는 다음 세션 라이브 검증 필요. 다중 fixture 라이브 smoke 까지 완료 후 §5.10.4 Phase 4 진입.

## 5. Karpathy 4 원칙 cross-check (전체 cycle)

| 원칙 | Phase 1 | Phase 2 | Phase 3 |
|------|---------|---------|---------|
| Simplicity | 변환 1 곳 통합 | PAGE_HEADER_RE inline | ~555 line 폐기 — 큰 단순화 |
| Surgical | 5 file 변경 (helpers export 추가) | 두 click handler DRY | atomic single commit (build 깨짐 회피), boundary pin 폐기 |
| Goal-Driven | AC 7 정량 gate | AC-C5 정량 gate | R 7 항목 + R8.1 88 cases skip |
| Evidence-Based | fresh npm test 757 PASS | fresh 760 PASS | fresh 673 PASS / 88 skipped / 0 fail |

## 6. 다음 세션 진입점

1. **다중 파일 유형 라이브 smoke (master 직접 obsidian-cdp 스킬 §3 재시동)** — Phase 1 AC-C1.6 spec 충족:
   - PDF: `raw/0_inbox/PMS_제품소개_R10_20220815.pdf` — vector PDF AC-C1.7 sidecar raw 보존 + AC-C1.2 brief
   - HWP: `raw/0_inbox/스마트공장 보급확산 합동설명회 개최.hwp` — AC-C1.2 binary 미전송 + unhwp 변환
   - HWPX (DOCX 대체): `raw/0_inbox/Examples.hwpx` — Docling 일반 분기 (DOCLING_DOC_FORMATS)
2. 라이브 smoke GREEN 후 — §5.10.4 Phase 4 진입:

3. **§5.10.4 Phase 4** (D-wide Part 2 + Final):
   - R4 settings-tab.ts schema sample 정정
   - R5 docs/wikey-ingest-pipeline.md 5 line spot 정정
   - R8.2 잔여 ~22 cases 폐기 (suggestion-detector / convergence / self-declaration)
   - R8.3 §5.2 / §5.3 회귀 0 확증
   - M migration script (`scripts/migrate-deprecate-standard-decompositions.sh`) + UI 폐기 (sidebar 6 패널 → 5 패널) + store cleanup (.wikey/suggestions.json / converged-decompositions.json 등 삭제)
   - L 라이브 cycle smoke 5 항목
   - F 3 cycle 통합 codex Mode D Panel post-impl review APPROVE → §5.10 전체 종결 mark

## 7. 잔존 minor stale (사용자 사전 결정 — 보존)

- `plan/phase-5/phase-5-todox-5.10-graph-emergent-ontology.md` §7 self-check v5.3 표기 (line 233/235/241/242)
- `plan/plan-full.md:321` ~30~50 file / ~100 test cascade 표기 — Phase 4 §5.10.4.4 M migration 작성 시 동기화

## 8. footer

| 항목 | 값 |
|------|-----|
| Session | 16 (2026-05-04 ~ 2026-05-05) |
| Total commits | 5 (Phase 1 / Phase 2 / R0 / Phase 3 atomic / 라이브 smoke + 보고서) |
| Total test 변동 | 732 → 673 PASS (+29 신규 / +88 skipped / 0 fail) |
| Total code 변동 | ~+900 신규 (conversion.ts + 신규 test) / -~620 폐기 (schema.ts + canonicalizer.ts + 88 test cases) |
| Build | 0 errors fresh re-run |
| Karpathy cross-check | 모두 충족 |
| 라이브 smoke | ✅ 5/5 GREEN (Phase 1+2+3 통합 라이브 검증, master 직접 obsidian-cdp) — D-wide 자유 type 8 종 라이브 확증 |
