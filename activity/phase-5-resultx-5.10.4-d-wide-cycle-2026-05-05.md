---
phase: 5.10.4
session: 17 (D-wide Phase 4 — UI/docs/migration/라이브/종결)
date: 2026-05-05
status: in_progress
---

# §5.10.4 Phase 4 — D-wide cycle (UI/docs/migration/라이브/종결) 결과

> **상위 문서**: `plan/phase-5-todo.md §5.10.4` (Phase 4 spec) + `plan/phase-5-todox-5.10-graph-emergent-ontology.md` v5.4 (paradigm shift D-wide 보조 plan).
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

## 3. R5 — `docs/wikey-ingest-pipeline.md` 정정 (5 spot + Step 8 banner)

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
[[project-management-body-of-knowledge|PMBOK]] (Project Management Body of Knowledge)
[[project-management-institute|PMI]] (Project Management Institute)
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

[F 단계 진입 시 갱신]

## 8. AC 매핑 (R0~R8 + M + L)

| AC | 상태 | Evidence |
|----|------|----------|
| R0 (`ingest-pipeline.ts:909~` BUNDLED_STAGE2_MENTION_PROMPT type_hint LLM 자율) | Phase 3 적용 (commit `77982c6`) | — |
| R1 (`schema.ts` validation helpers + buildSchemaPromptBlock + YAML parser entityTypes/conceptTypes/customTypes 폐기) | Phase 3 (commit `77982c6`) | — |
| R2 (`canonicalizer.ts` FORCED_CATEGORIES + detectAntiPattern + 7-type 검증 폐기) | Phase 3 (commit `77982c6`) | — |
| R3 (`types.ts` EntityType / ConceptType union → string 완화) | Phase 3 (commit `77982c6`) | — |
| **R4** (`settings-tab.ts:1118~` schema sample 정정) | ✅ Phase 4 commit `348e02f` | §2 |
| **R5** (`docs/wikey-ingest-pipeline.md` 5 line spot + §9/§12/§14 banner) | ✅ Phase 4 commit `348e02f` | §3 |
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
