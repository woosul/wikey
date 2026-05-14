---
phase: 5.10.4
session: 17 (D-wide Phase 4 — UI/docs/migration/라이브/종결)
date: 2026-05-05
status: completed
codex_review: APPROVE (cycle #8, 2026-05-05)
commits: 348e02f / 88e5035 / 15d57fe / 83a6f00 / d8e37dd / bf08cdc / b36a5c6 / 2829645 / d377785 / 605fb8d / 970943a / 89cb96a
baseline: 604 PASS + 157 skipped + build 0 errors
---

# §5.10.4 Phase 4 — D-wide cycle (UI/docs/migration/라이브/종결) 결과

> **상위 문서**: `docs/planning/phase-5/phase-5-todo.md §5.10.4` (Phase 4 spec) + `docs/planning/phase-5/phase-5-todox-5.10-graph-emergent-ontology.md` v5.4 (paradigm shift D-wide 보조 plan).
>
> 본 result 는 §5.10.4.1~§5.10.4.6 (R4 / R5 / R8.2~3 / M / L / F) 의 cycle evidence + commit hash + 회귀 baseline 기록.

## 1. Entry baseline (commit `9d038b7` 직후)

- `npm test` fresh re-run: **673 PASS + 88 skipped (761 total)**, exit 0
- `npm run build`: exit 0 (1 pre-existing import.meta warning — `pii-patterns.js:284`)
- `git status` clean (master branch, last commit `9d038b7 docs(§5.10.3.10)`)
- `.wikey/` 7 files (suggestions / converged / mock-baseline / mention-history / qmd-embeddings / schema / source-registry)
- `wiki/concepts/project-management-body-of-knowledge.md` 기존 존재 (이전 PMBOK ingest 산출)

## 2. R4 — `wikey-obsidian/src/settings-tab.ts` schema sample 정정

> **commit**: `348e02f test+docs(§5.10.4 R4+R5+R8): D-wide ripple — settings-tab/docs/test deprecate`

### 2.1 변경 spot

- `SCHEMA_OVERRIDE_TEMPLATE` (line 1118~) — `entity_types` / `concept_types` / `standard_decompositions` sample 모두 제거 → **`aliases` + `pii_patterns` 만 sample 표시** (D-wide 보존 영역 일치)
- `SchemaOverrideEditModal` description (line 1199 부근) — "Define additional entity/concept types" → aliases / pii_patterns 안내
- 'Edit schema.yaml' Setting desc + status text 동일 갱신 (line 522~529)

### 2.2 검증

- npm test 615 PASS + 146 skipped (R8 와 atomic commit)
- npm run build exit 0

## 3. R5 — `docs/architecture/wikey-ingest-pipeline.md` 정정 (5 spot + Step 8 banner)

> **commit**: `348e02f`

### 3.1 변경 spot

| Spot | 변경 내용 |
|------|----------|
| Header note | "§5.4 Stage 1~4 통합 완료" → "§5.10.4 D-wide cycle. §5.4 Stage 1~4 + 7-type schema gate 폐기" |
| Step 8 row (matrix) | strikethrough + "D-wide 폐기 (2026-05-05)" mark |
| §6.4 Stage 2 mention prompt | `type_hint ∈ {7-type union}` → LLM 자율 string 자유 |
| §7 (Step 6 Canonicalize) | 7 type 분류 표 / CONCEPT_DECISION_TREE / FORCED_CATEGORIES / SLUG_ALIASES 후처리 → LLM 자율 type 출력 + alias normalization 잔존 |
| §7.4 거부·dropped | detectAntiPattern schema-reject 폐기, mention extraction LLM 자체 거부 |
| §7.8 schema.yaml self-extending | 4-layer self-extending → `aliases` + `pii_patterns` 만 보존 |
| §9 (Step 8 Self-extending) | deprecated banner — historical reference only |
| §12 결정성 표 | FORCED_CATEGORIES + Stage 2/4 detector strikethrough |
| §14 한 눈 요약 | "옵션 D 채택 시" → "D-wide 채택 후 (2026-05-05)" |

## 4. R8.2/R8.3 — wikey-core test deprecation (58 cases skip)

> **commit**: `348e02f`

### 4.1 폐기 file (top-level `describe` → `describe.skip` + 상단 @deprecated banner)

| File | Cases | Stage |
|------|-------|-------|
| convergence.test.ts | 12 | Stage 4 cross-source convergence |
| self-declaration.test.ts | 21 | Stage 3 in-source self-declaration |
| stage-integration.test.ts | 7 | Stage 1+2+3+4 통합 시나리오 |
| suggestion-detector.test.ts | 11 | Stage 2 detector |
| suggestion-panel-builder.test.ts | 2 | Stage 2 panel builder |
| suggestion-pipeline.test.ts | 2 | Stage 2 pipeline |
| suggestion-storage.test.ts | 3 | Stage 2 storage |
| **합계** | **58** | — |

### 4.2 baseline 변동

| 단계 | npm test |
|------|----------|
| 진입 (Phase 3 종료 후) | 673 PASS + 88 skipped (761) |
| R8.2 폐기 후 | 615 PASS + 146 skipped (761) — Δ -58 PASS / +58 skipped |

### 4.3 R8.3 회귀 0 확증

- `query-pipeline.test.ts` (§5.2) **38/38 PASS 유지**
- `incremental-reingest.test.ts` (§5.3) **28/28 PASS 유지**

## 5. M — migration script + UI 폐기 + store cleanup

### 5.1 M.1 migration script (`scripts/migrate-deprecate-standard-decompositions.sh`)

> **commit**: `88e5035 feat(§5.10.4 M.1+M.3): D-wide UI 폐기 — Suggestions panel 제거 + migration script`

5 단계 (보조 plan §3.3):
1. schema.yaml backup (자동 split 안전성 위해 backup 만, 사용자 수동 정정)
2. store files rm (suggestions / converged / mock-baseline + 옵션 mention-history / qmd-embeddings)
3. wiki/concepts/ umbrella 페이지 후보 list (자동 X)
4. .gitignore 검토 (자동 X)
5. (UI 코드 폐기는 별 commit, 본 script 는 vault state 만)

옵션: `--dry-run` (default) / `--apply` / `--keep-graph-stores`

### 5.2 M.3 sidebar-chat.ts UI 폐기 (sidebar 6 패널 → 5 패널)

> **commit**: `88e5035`

- Suggestions panel header button (clipboard_check icon) 제거
- panelBtns.suggestions + selectPanel 'suggestions' dispatch 제거
- suggestionsPanel field + closeActivePanel 정리 분기 제거
- §11 SuggestionsPanelRow type union + rowToSuggestionShape 함수 제거
- openSuggestionsPanel + refreshSuggestionRows + renderSuggestionsGrid + replaceRowWithUserAdded 일괄 제거
- load/saveSuggestionStoreFromVault / loadRegisteredStandards / load/saveConvergedStoreFromVault 제거
- SchemaYamlModal 클래스 제거
- ICONS.clipboardCheck (orphaned) 제거
- imports cleanup (Modal, App, appendStandardDecomposition, buildSuggestionCardModel, acceptSuggestion, rejectSuggestionFromPanel, emptyStore, parseSchemaOverrideYaml, Suggestion, SuggestionStore, ConvergedDecomposition, StandardDecompositionComponent)
- PanelName union: 'suggestions' 제거 (5 panel)
- 단일 file 변경 (-913 / +2): sidebar-chat.ts 1185 → 271 lines (대부분 다른 panel 코드 — 별도 file 분리 안 함, 본 cycle scope 외)

### 5.3 M.4 store 삭제 (사용자 명시 승인 후 apply, --keep-graph-stores)

```
=== §5.10.4 M D-wide migration (--apply --keep-graph-stores) ===
[2] store files (deprecate):
    → /Users/denny/Project/wikey/.wikey/suggestions.json (8757 bytes) ✓ backed up + removed
    → /Users/denny/Project/wikey/.wikey/converged-decompositions.json (2095 bytes) ✓ backed up + removed
    → /Users/denny/Project/wikey/.wikey/converged-decompositions.mock-baseline.json (10816 bytes) ✓ backed up + removed
    (--keep-graph-stores: mention-history.json / qmd-embeddings.json 보존)
backup: /Users/denny/Project/wikey/.wikey/.migration-backup-20260505-135918
```

backup 디렉토리 + 3 file (suggestions.json.bak / converged-decompositions.json.bak / converged-decompositions.mock-baseline.json.bak) + schema.yaml.original 보존.

추가 master 직접 fix:
- `.wikey/schema.yaml` 도 `aliases` + `pii_patterns` only 형태로 rewrite (D-wide 정합)
- `.gitignore` 에 `.wikey/manual-overrides.yaml` + `.wikey/.migration-backup-*` 추가

## 6. L — 라이브 cycle smoke (master 직접 obsidian-cdp)

> **환경**: Obsidian 1.12.7 + remote-debugging-port=9222, wikey-obsidian commit `88e5035` (main.js 285937 bytes, 2026-05-05 14:00)
>
> **fixture**: `raw/0_inbox/pmbok-overview.md` (68 lines, PMBOK 7판 10 knowledge areas 명시 — D-wide 후 LLM 자율 type 분류 검증 자료)

### 6.1 L.3 — Suggestions panel 부재 확증 (UI 폐기 검증)

```
Header buttons = ["Chat", "Dashboard", "Ingest", "Audit", "Help", "Reload", "Close"]
                  └────── 5 panels ─────┘  └─ utility ─┘
```

✅ Suggestions panel button (clipboard_check icon) 부재 — sidebar 6 패널 → 5 패널 정상 반영.

### 6.2 L.1 — ingest fixture (PMBOK overview) ✅

| 단계 | 측정 |
|------|------|
| Brief 모달 (Converting → Brief) | ~5s |
| Proceed → Processing → Preview | **81s** |
| Approve & Write → wiki write | ~5s |
| 총 cycle | ~91s |

**Preview 결과 (16 wiki pages)**:
- source-pmbok-overview.md (new)
- entities (1): project-management-institute.md (new)
- concepts (12): project-management-body-of-knowledge.md (update) / 10 knowledge areas (new) / work-breakdown-structure.md (update)
- index.md +13 entries / log.md +1 entry

**핵심 invariant (D-wide 성공 검증)**:

| Invariant | Before | After | 검증 |
|-----------|--------|-------|------|
| **schema.yaml md5** | `1c1df511c04cceeee2ce430984177fbe` | `1c1df511c04cceeee2ce430984177fbe` | ✅ unchanged — D-wide 자동 등록 X 확증 |
| PMBOK 10 areas 분해 정확도 | (BUILTIN_STANDARD_DECOMPOSITIONS PMBOK 정의) | **LLM 자율로 정확히 10/10** | ✅ Stage 1 폐기 후에도 정형 표준 정확도 보존 |
| Umbrella page 재사용 | `project-management-body-of-knowledge.md` 기존 | update (재사용, alias dedup 정상) | ✅ canonicalizer minimal alias layer 정상 |
| LLM 자율 type 출력 | (7-type union 폐기) | `entity_type: organization` (PMI) / `concept_type: standard` (PMBOK) / `methodology` (10 areas) | ✅ R3 LLM 자율 type 정상 |

**movePair (IV.A) 정상**:
- `raw/0_inbox/pmbok-overview.md` → `raw/3_resources/60_note/200_social/pmbok-overview.md`
- `path_history` 2 entries: 0_inbox (05:05:06) → 3_resources (05:05:20.7) ✅

### 6.3 L.4 — canonicalizer alias normalization ✅

PMBOK source 본문에서 한국어 anchor + 영어 slug alias 정상 동작:

```
[[project-management-body-of-knowledge|PMBOK]] (../Project Management Body of Knowledge)
[[project-management-institute|PMI]] (../Project Management Institute)
1. [[project-integration-management|프로젝트 통합 관리]]
2. [[project-scope-management|프로젝트 범위 관리]]
... (10 areas)
```

✅ canonicalizer 의 minimal alias layer (D-wide 보존 영역) 가 source 본문의 다국어 표기 (영어 + 한국어) 를 단일 canonical slug 로 통합하면서 anchor text 보존.

### 6.4 L.2 — query 검증 ✅

**질문**: `PMBOK 의 10 knowledge areas 가 무엇인가? 각각 한 줄 설명.`

**답변** (1244 chars, 28 wikilinks, ~30s 응답):

```
PMBOK📄 (Project Management Body of Knowledge)은 PMI (Project Management Institute)가 발행하는
프로젝트 관리 표준 지식 체계입니다. PMBOK 7판은 원칙 중심으로 재편되었지만, 6판까지의 10가지
지식 영역(Knowledge Areas) 분류 체계는 여전히 산업 표준으로 널리 사용되고 있어요.

PMBOK의 10가지 지식 영역은 다음과 같습니다.
- 프로젝트 통합 관리📄: 프로젝트의 다양한 요소와 프로세스를 통합하고 조정...
- 프로젝트 범위 관리: 프로젝트가 포함해야 할 작업과 제외해야 할 작업을 정의...
... (10 areas 모두 정확히 한 줄 설명)

참고: source-pmbok-overview, project-management-body-of-knowledge📄, project-management-institute,
project-integration-management📄, ..., project-risk-management📄
원본: pmbok-overview
```

**검증**:

| 기준 | 결과 |
|------|------|
| 본문 사실 정확 | ✅ "6판까지는 인적 자원 관리였으나 7판부터 사람과 물적 자원" 같은 PMBOK 7판 vs 6판 차이까지 정확 |
| Wiki 링크 (citation) | ✅ 28 link (PMBOK + PMI + 10 areas + source-pmbok-overview) |
| 한국어 anchor + 영어 slug alias | ✅ 모든 link 가 한국어 anchor (`프로젝트 통합 관리`) + 영어 href (`project-integration-management`) |
| 원본 backlink | ✅ "원본: pmbok-overview" line 마지막에 명시 |
| Hallucination 0 | ✅ source 본문 + entity/concept 페이지로 cross-check 통과 |

### 6.5 L.5 — evidence 기록

본 result 문서 자체.

## 7. F — D-wide cycle 종결 + 3 cycle 통합 codex review

### 7.1 Cycle #1 (surface:19, closed) — verdict NEEDS_REVISION

- 시점: 2026-05-05 14:08, codex Mode D Panel (gpt-5.5 xhigh, 9m 04s)
- prompt: 3-cycle integrated review (Phase 1 C1 + Phase 2 C5 + Phase 3+4 D-wide)
- finding: 2 P1 + 4 P2 + 1 P3
  - **[P1-1]** D-wide deprecation incomplete — `ingest-pipeline.ts:517` schema override + Stage 3 self-declaration extract / canonicalizer.ts:200 buildStandardDecompositionBlock / schema.ts:36/293/328 standardDecompositions parser + builder 잔존
  - **[P1-2]** Stage 2 suggestion finalization 잔존 — `ingest-pipeline.ts:848` runSuggestionFinalize 매 ingest 후 호출, hidden D-wide-retired stores 재생성
  - **[P2-1]** `canonicalizer.ts:453` applyCrossLinks() rebuild 시 d8e37dd display_name + aliases lost
  - **[P2-2]** `schema.ts:66` parser 가 aliases 미인식 (advertise no-op)
  - **[P2-3]** migration script step 1 spec 와 동작 불일치 (backup only, split X)
  - **[P2-4]** `settings-tab.ts:423/567` stale "built-in 4+3" / "domain-specific entity/concept types"
  - **[P3]** wikey.schema.md:183 master schema 가 standard decomposition + Suggestions panel 을 live 명시
- master 1차 cross-check: 모두 사실 확증
- master 결정: NEEDS_REVISION 동의 → 7 finding 모두 fix 진행

### 7.2 Cycle #1 fix — commit `bf08cdc` (8 files, +231/-528)

| Finding | Fix 위치 |
|---------|---------|
| P1-1 D-wide completion | ingest-pipeline.ts:50-58 imports + 517-537 block 제거 / canonicalizer.ts:7,200-213 / schema.ts (~388 lines 삭제, BUILTIN_STANDARD_DECOMPOSITIONS empty stub + loadSchemaOverride stub 만 잔존) / index.ts parseSchemaOverrideYaml export 제거 |
| P1-2 Stage 2 폐기 | ingest-pipeline.ts:819 call + 2281-2354 함수 본체 + loadMentionHistory + loadSuggestionStore 제거 |
| P2-1 applyCrossLinks | extractFrontmatterScalar + extractFrontmatterList helpers 신규, buildPageContent 호출 시 preservedTitle/preservedAliases 전달 |
| P2-2 aliases parser | schema.ts loadUserAliases + parseUserAliasesYaml 신규, canonicalize 에 userAliases plumbing (5 callsite user-aware) |
| P2-3 migration script | step 1 awk split, manual-overrides.yaml 보호, schema.yaml rewrite |
| P2-4 settings-tab stale | 4 statusSpan 라인 정정, loadSchemaOverride import 제거 |
| P3 wikey.schema.md | §183 D-wide 채택 배경 + 보존 sections 명시 |

추가: canonicalizer.test.ts 7 cases skip (PMBOK + standard decomposition tests).
baseline 615 PASS → **608 PASS + 153 skipped**.

### 7.3 Cycle #2 (surface:20, closed) — verdict NEEDS_REVISION

- 시점: 2026-05-05 15:00, codex Mode D Panel (30m 04s)
- prompt: cycle #1 7 finding fix verification
- finding: 1 P1 + 2 P2
  - **[P1]** `settings-tab.ts:1125` PII guidance 결함 — engine 은 .wikey/pii-patterns.yaml + ~/.config/wikey/pii-patterns.yaml 만 load (shape `patterns: - id/kind/mask`), template 은 `pii_patterns: - name/regex/redaction`. 사용자가 따라하면 PII rule 무시 → privacy guard 누락 위험
  - **[P2]** `schema.ts:92` parseUserAliasesYaml 가 variant key 를 raw 보존 → canonicalizeSlug normalizeBase("iso-27001") lookup 매치 실패. 사용자 입력 대부분 (template "ISO 27001" 등) 에서 alias layer non-functional
  - **[P2]** `index.ts:181` Stage 2/3/4 deprecated public API 잔존 export (`appendStandardDecomposition` 등). loadSchemaOverride 항상 null이라 consumer mutate runtime ignore — naming inconsistency
- master 1차 cross-check: 모두 사실 확증
- master 결정: NEEDS_REVISION 동의 → 3 finding 모두 fix

### 7.4 Cycle #2 fix — commit `b36a5c6` (3 files, +49/-94)

| Finding | Fix 위치 |
|---------|---------|
| P1 PII guidance | settings-tab.ts SCHEMA_OVERRIDE_TEMPLATE 에서 pii_patterns 안내 제거. PII 안내는 .wikey/pii-patterns.yaml redirect. SchemaOverrideEditModal description / status text / Setting desc / schema.ts header comment 모두 정정 |
| P2 alias normalize | schema.ts normalizeAliasKey() 신규 (lowercase + 따옴표 strip + non-alnum→space + space/underscore→hyphen + multi-hyphen collapse). parseUserAliasesYaml canonical/variant key 모두 적용 |
| P2 dead exports | index.ts §5.4 Stage 2/3/4 export block 전부 제거 (-66 lines). IngestRecord type 만 보존 |

baseline 유지: **608 PASS + 153 skipped + build 0 errors**.

### 7.5 Cycle #3 (surface:21, closed) — verdict NEEDS_REVISION

- 시점: 2026-05-05 15:20, codex Mode D Panel (5m 29s)
- finding: 1 P1 + 3 P2
  - **[P1]** `wikey.schema.md:194` 단일 진실 소스가 여전히 ".wikey/schema.yaml 보존: aliases + pii_patterns" 명시 — engine 별 file 과 mismatch (cycle #2 P3 fix 누락)
  - **[P2]** `schema.ts:107` parseUserAliasesYaml multi-word/quoted canonical key (`ISO 27001:` / `"ISO 27001":`) 매치 실패 — regex `\S+` 단어 1개만
  - **[P2]** `scripts/reindex.sh:212` Stage 4 convergence pass 잔존 (WIKEY_CONVERGENCE_ENABLED=true 로 .wikey/converged-decompositions.json 재생성 가능)
  - **[P2]** `index.ts:21` SchemaCustomType / SchemaOverride type + loadSchemaOverride 함수 export 잔존 — naming inconsistency
- master 1차 cross-check: 모두 사실 확증
- master 결정: NEEDS_REVISION 동의 → 4 finding 모두 fix

### 7.6 Cycle #3 fix — commit `2829645` (4 files, +27/-38)

| Finding | Fix 위치 |
|---------|---------|
| P1 schema md PII | wikey.schema.md §190+§194 — 보존 영역 aliases 단독 명시, PII 안내 별 file redirect |
| P2 multi-word key | schema.ts parseUserAliasesYaml regex 갱신 (`\S+` → `.+?`), dash 줄 검사 분기 |
| P2 reindex stage 4 | scripts/reindex.sh §5.4.4 convergence pass block 전부 제거 (env 지원 종결) |
| P2 schema-override surface | index.ts SchemaCustomType + SchemaOverride type + loadSchemaOverride 함수 export 모두 제거 |

baseline 유지: **608 PASS + 153 skipped + build 0 errors**.

### 7.7 Cycle #4 (surface:22, closed) — verdict NEEDS_REVISION (severity 급감)

- 시점: 2026-05-05 15:45, codex Mode D Panel (3m 10s)
- finding: 1 P2 + 2 P3 (**0 P1** — D-wide 본질 deprecation 완료, surface cosmetic)
  - **[P2]** `migrate-deprecate-standard-decompositions.sh:96` schema.yaml 의 pii_patterns 도 deprecated section 으로 처리 안 함 — migrated vault 가 inactive PII rule keep
  - **[P3]** `schema.ts:39` JSDoc "보존 = aliases + pii_patterns" 잔재 (cycle #3 P1 fix 의 stale comment)
  - **[P3]** `docs/architecture/wikey-ingest-pipeline.md` operational docs 잔재 (line 348/412 보존 영역 + 652-654 Step 8 active call-flow + 333 "Stage 3 도 다시 거름")

### 7.8 Cycle #4 fix — commit `d377785` (4 files, +26/-18)

| Finding | Fix 위치 |
|---------|---------|
| P2 migration pii | scripts/migrate-deprecate-standard-decompositions.sh awk regex 에 pii_patterns 추가 (extract + rewrite). manual-overrides.yaml header redirect 안내 (PII → 별 file shape) |
| P3 schema JSDoc | wikey-core/src/schema.ts:39 + settings-tab.ts:563 comment 동시 정정 |
| P3 docs operational | docs/architecture/wikey-ingest-pipeline.md §7.1/§7.8/§11 active flow strikethrough + D-wide 폐기 mark + §6.4 implicit Stage 3 reference 정정 |

baseline 유지: **608 PASS + 153 skipped + build 0 errors**.

| Cycle | Finding |
|-------|---------|
| #1 | 7 (2 P1 + 4 P2 + 1 P3) — 본질 결함 |
| #2 | 3 (1 P1 + 2 P2) |
| #3 | 4 (1 P1 + 3 P2) |
| #4 | 3 (**0 P1** + 1 P2 + 2 P3) — surface only |

severity 추세 = D-wide 본질 deprecation 완료 확증.

### 7.9 Cycle #5 (surface:23, closed) — verdict NEEDS_REVISION (severity 0 P1 + 0 P2 + 4 P3)

- 시점: 2026-05-05 16:00, codex Mode D Panel (5m 24s)
- finding: 0 P1 + 0 P2 + **4 P3 (모두 cosmetic)** — D-wide 본질 deprecation 완료 확증
  - **[P3]** migrate-deprecate-standard-decompositions.sh:118 placeholder 가 schema empty 시 still pii_patterns 보존 안내
  - **[P3]** docs/architecture/wikey-ingest-pipeline.md:42 §1 matrix LLM call count "선택 Stage 4 arbitration N" 잔재
  - **[P3]** docs/architecture/wikey-ingest-pipeline.md:405 §7.7 schema 통과/위반 + anti-pattern + invalid type stale
  - **[P3]** wikey-core/src/canonicalizer.ts:14 module JSDoc "schema constraints" / "anti-pattern check" 잔재
- **Migration fixture smoke (codex 직접 mktemp 검증) positive** — pii_patterns split 정상, inactive PII rule 잔존 risk 0 (cycle #4 P2 fix 검증됨)
- master 결정: NEEDS_REVISION 동의 → 4 P3 모두 fix

### 7.10 Cycle #5 fix — commit `605fb8d` (3 files, +18/-13)

| Finding | Fix 위치 |
|---------|---------|
| P3 placeholder | migrate script empty placeholder 갱신 — 보존 section aliases 단독 + 폐기 list 에 pii_patterns 추가 + PII 별 file redirect |
| P3 §1 matrix | docs §1 LLM call count 에서 Stage 4 arbitration 제거 + D-wide 폐기 annotation |
| P3 §7.7 | docs §7.7 D-wide 갱신 — schema gate 폐기, drop 기준 = empty name/type 만 |
| P3 canonicalizer JSDoc | module JSDoc Stage 3 (formerly Stage 2) + LLM 자율 type + minimal alias normalization 명시 |

baseline 유지: **608 PASS + 153 skipped + build 0 errors**.

### 7.11 Cycle #6 (surface:24, closed) — verdict NEEDS_REVISION (broad surface 발견)

- 시점: 2026-05-05 16:00, codex Mode D Panel (5m 04s)
- finding: 0 P1 + 1 P2 + 7 P3 (codex search 깊이 확장으로 broad surface)
  - **[P2]** vault `.wikey/schema.yaml` PII guidance 잔재
  - **[P3]** `.wikey/suggestions.json` 재발생 (P1-2 fix 이전 ingest 잔재)
  - **[P3]** migrate dry-run output / docs/architecture/condition-of-wiki-page-creation.md / ingest-pipeline canonResult unused / canonicalizer FORCED_CATEGORIES comment / convergence script header / schema-yaml-writer test
- master 결정: NEEDS_REVISION 동의 → 8 finding fix

### 7.12 Cycle #6 fix — commit `970943a` (8 files, +150/-24)

baseline: **608 → 604 PASS + 153 → 157 skipped** (4 cases schema-yaml-writer skip 추가)

### 7.13 Cycle #7 (surface:25, closed) — verdict NEEDS_REVISION (UI / docs / styles 신규 area)

- 시점: 2026-05-05 16:20, codex Mode D Panel (~6m, validate-wiki.sh 권한 요청 포함)
- finding: 0 P1 + 2 P2 + 5 P3
  - **[P2]** ingest-modals.ts:444 "Active schema" 4+3 type 강제 표시 (사용자 UI 직접)
  - **[P2]** wiki/overview.md validate 57 errors (broken source links — §5.10.4 scope 외, Phase 5 §5.10.2 잔여)
  - **[P3]** CLAUDE.md sidebar 6/Suggestions/D-wide pending 잔재
  - **[P3]** docs/architecture/wikey-ingest-pipeline.md §9.7 D option awaiting decision
  - **[P3]** docs/architecture/step8-self-extending-analysis.md banner missing
  - **[P3]** wikey-obsidian/styles.css orphan Suggestions + SchemaYamlModal CSS (524 lines)
  - **[P3]** convergence/self-declaration/suggestion-*/schema-yaml-writer module headers active처럼

### 7.14 Cycle #7 fix — commit `89cb96a` (10 files, +31/-553)

baseline 유지: **604 PASS + 157 skipped + build 0 errors**.

### 7.15 Cycle #8 (surface:26, closed) — **verdict APPROVE** (4m 42s) 🟢

- 시점: 2026-05-05 16:30, codex Mode D Panel
- finding: 0 P1 + 0 P2 + 4 P3 (모두 historical/orphan/cosmetic)
  - DESIGN.md Suggestions 패널 docs / run-convergence-pass.mjs orphan import / session-wrap-followups historical / parent result mirror TBD

> **codex cycle #8 verdict 종결 권고**:
> "Cycle assessment: P1/P2 active-surface findings: 0. Runtime/public D-wide invariant holds: sidebar is 5 panels, Suggestions UI is gone, ingest no longer writes suggestion/mention stores, reindex no longer runs convergence, schema.yaml runtime use is aliases-only, and Stage 2/3/4 APIs are not exported from wikey-core. §5.10.4 종결 권고: APPROVE. 남은 항목은 모두 historical/orphan/cosmetic이고, 본질 D-wide deprecation 및 npm test/build 기준은 충족했다."

### 7.16 Final cosmetic cleanup — commit `<TBD>` (cycle #8 P3 4건)

| Finding | Fix 위치 |
|---------|---------|
| DESIGN.md:236 Suggestions 패널 docs | section 5/6 renumber → Help 패널 5번 + D-wide note |
| run-convergence-pass.mjs:40 orphan import | early-exit deprecation banner + exit 2 |
| session-wrap-followups stale next action | §5.10.4 종결 + Phase 5 잔여 평가 redirect |
| parent activity mirror TBD | 본 result file 종결 mark + commit chain reference |

### 7.17 Cycle 누적 종합 — D-wide 종결 검증 (rules.md §7.2 master verdict 결정)

| Cycle | Finding 합계 | P1 | P2 | P3 | Master 결정 |
|-------|------|----|----|----|------|
| #1 | 7 | 2 | 4 | 1 | NEEDS_REVISION 동의 — 7 finding 모두 fix |
| #2 | 3 | 1 | 2 | 0 | NEEDS_REVISION 동의 — 3 finding 모두 fix |
| #3 | 4 | 1 | 3 | 0 | NEEDS_REVISION 동의 — 4 finding 모두 fix |
| #4 | 3 | 0 | 1 | 2 | NEEDS_REVISION 동의 — 3 finding 모두 fix |
| #5 | 4 | 0 | 0 | 4 | NEEDS_REVISION 동의 (cosmetic but consistent) — 4 finding 모두 fix |
| #6 | 8 | 0 | 1 | 7 | NEEDS_REVISION 동의 — 8 finding 모두 fix |
| #7 | 7 | 0 | 2 | 5 | NEEDS_REVISION 동의 — 7 finding fix (1 P2 scope 외) |
| #8 | 4 | 0 | 0 | 4 | **APPROVE 동의 + master verdict 종결** — 4 P3 cosmetic cleanup 후 §5.10.4 mark |

총 finding 누적: 40 (4 P1 + 13 P2 + 23 P3). Cycle #5 시점부터 P1 0 (**4 cycle 째**). 본질 D-wide invariant 4 cycle 연속 유지 → **§5.10.4 종결 안전**.

## 11. session-wrap followups (after L+F)

- §5.10.4 종결 mark commit (본 cycle, docs/planning/phase-5/phase-5-todo.md §5.10.4 [x] 일괄)
- session-wrap-followups.md 갱신 — Phase 5 잔여 (§5.6/§5.7/§5.8/§5.9) 평가 redirect
- Issue A (한국어 wikilink/title) — fix 완료, 차기 ingest 부터 자연 적용
- Issue B (페이지 생성 threshold) — 별 plan 등록 (향후 §5.6 검토 시점)
- Phase 5 §5.10.2 broken-link-prevention 잔여 (validate-wiki 57 errors) — 별 small cycle 또는 §5.10.2 보강 후속

## 8. AC 매핑 (R0~R8 + M + L)

| AC | 상태 | Evidence |
|----|------|----------|
| R0 (`ingest-pipeline.ts:909~` BUNDLED_STAGE2_MENTION_PROMPT type_hint LLM 자율) | Phase 3 적용 (commit `77982c6`) | — |
| R1 (`schema.ts` validation helpers + buildSchemaPromptBlock + YAML parser entityTypes/conceptTypes/customTypes 폐기) | Phase 3 (commit `77982c6`) | — |
| R2 (`canonicalizer.ts` FORCED_CATEGORIES + detectAntiPattern + 7-type 검증 폐기) | Phase 3 (commit `77982c6`) | — |
| R3 (`types.ts` EntityType / ConceptType union → string 완화) | Phase 3 (commit `77982c6`) | — |
| **R4** (`settings-tab.ts:1118~` schema sample 정정) | ✅ Phase 4 commit `348e02f` | §2 |
| **R5** (`docs/architecture/wikey-ingest-pipeline.md` 5 line spot + §9/§12/§14 banner) | ✅ Phase 4 commit `348e02f` | §3 |
| **R8.2** (~58 test 폐기) | ✅ Phase 4 commit `348e02f` | §4 |
| **R8.3** (§5.2/§5.3 회귀 0) | ✅ Phase 4 commit `348e02f` | §4.3 |
| **M.1** (migration script) | ✅ Phase 4 commit `88e5035` | §5.1 |
| **M.3** (Suggestions UI 폐기) | ✅ Phase 4 commit `88e5035` | §5.2 |
| **M.4** (store rm) | ✅ Phase 4 (사용자 apply) | §5.3 |
| **L.3** (panel button 부재) | ✅ live | §6.1 |
| **L.1** (ingest schema.yaml 자동 등록 X) | [pending] | §6.2 |
| **L.2** (query 정상) | [pending] | §6.4 |
| **L.4** (alias dedup) | [pending] | §6.3 |
| **L.5** (evidence) | ✅ 본 문서 | — |
| **F** (3 cycle 통합 codex review) | [pending] | §7 |

## 9. 회귀 baseline 변동

| 시점 | npm test | 변동 |
|------|----------|------|
| Phase 3 종료 (`9d038b7`) | 673 PASS + 88 skipped | — |
| R4+R5+R8 atomic (`348e02f`) | 615 PASS + 146 skipped | -58 PASS / +58 skipped (R8 deprecation) |
| M.1+M.3 atomic (`88e5035`) | 615 PASS + 146 skipped | 0 변동 (UI 변경, test 영향 X) |

build: 매 commit `exit 0` (1 pre-existing import.meta warning — pii-patterns.js).

## 10. 사용자 raise 한 추가 issue (§5.10.4 후속, D-wide 와 직교)

본 §5.10.4 cycle 진행 중 (2026-05-05 session 17) 사용자가 첨부한 query 결과 (스마트공장 보급확산 합동설명회) 분석으로 raise 된 두 issue. D-wide deprecation 과 직교 — wikilink display / 페이지 생성 threshold 의 별 layer.

### 10.1 Issue A — 답변 본문 언어 보존 (한국어/영문 mixing)

**증상**: 한국어-only source ("스마트공장" / "전라남도 테크노파크" 등) 의 query 답변에서 wikilink anchor text 가 영어 slug 으로 직접 표시 (`smart-factory📄`, `jeonnam-technopark📄`). 사용자 의도: 본문은 원문 언어 (한국어) 따라야 하고 영어 slug 은 alias (canonical) 로만 등록.

**Root cause 분석** (PMBOK case 와 비교):
- ✅ **PMBOK case**: source 본문에 영어 + 한국어 both 명시 → canonicalizer 가 alias 표시 (`[[project-integration-management|프로젝트 통합 관리]]`) 정상 생성. anchor text 한국어 + slug 영어. 자연스러움.
- ❌ **스마트공장 case**: source 본문에 한국어 명만 등장 → LLM 이 slug 만 영어 정규화 (`smart-factory`), 한국어 alias display 등록 안 됨 → wikilink 가 영어 slug 그대로 노출.

**개선 방향** (이후 plan 등록 검토):
- Stage 2 mention extractor 또는 canonicalizer prompt 보강 — 한국어-only source 의 entity 추출 시 한국어 표기를 명시 alias 로 frontmatter `aliases:` 또는 wikilink display 에 등록 의무
- query 답변 합성 시 entity frontmatter 의 첫 alias (or `title`) 를 anchor text 로 우선 사용하는 fallback layer

### 10.2 Issue B — wiki 페이지 생성 기준 (단순 출처/장소 mention 제외)

**증상**: '전라남도 테크노파크' 같은 단순 행사 장소 / 출처 mention (보통 1회 등장, 자체 의미 가치 낮음) 도 wiki 페이지로 생성됨. 사용자 의도: page 가 자체 정보 가치 갖는지 (의미 있는 내용 vs 단순 mention) 판별 기준 필요.

**현재 기준** (Stage 2 mention extractor + canonicalizer):
- mention 1회 + evidence 1 문장만 있어도 LLM 이 entity/concept 으로 promote
- 명시 거부 패턴: UI 라벨 / 기능명 / 비즈니스 객체 / 한국어 일반 명사. 그러나 *고유명사* 는 거부 안 됨
- D-wide 후 type 분류는 LLM 자율이라 threshold 강제 layer 부재

**개선 방향 후보**:
1. **Promotion threshold**: mention count ≥ 2 (cross-source) 또는 single-source 내 unique reference (sentence 안 reference 빈도 ≥ 3) 일 때만 wiki 페이지 생성
2. **Evidence quality gate**: evidence 가 단순 출처 ("개최 장소: ...") vs 의미 (action / property / relation) 에 해당하는지 LLM self-judgment
3. **Tombstone 기능**: 사용자가 "이 page 는 의미 없음" 마크 → 다음 ingest cycle 에서 자동 dedup 또는 redirect alias 로 강등

본 issue 는 §5.10 D-wide 종결 후 (`F` 단계) Phase 5 잔여 (§5.6/§5.7/§5.8/§5.9) 평가 시점에 정식 plan 등록 검토.

## 11. session-wrap followups

- §5.10.4 commits (`348e02f`, `88e5035`) commit history 보존
- F (3 cycle 통합 codex review) — 별 cycle 로 진행
- Issue A, Issue B → 별 plan/phase-5-todox-* 또는 §5.6 검토 시점에 우선순위 재평가
