---
phase: 5
section: 5.13
title: §5.13 잔존 follow-up 3 항목 (A1 + B2 + C4) — 완료
status: completed
created: 2026-05-07
session: 21
---

# §5.13 잔존 follow-up 3 항목 — 완료 (Session 21, 2026-05-07)

> **상위 문서**: [`docs/sessions/phase-5/phase-5-result.md`](./phase-5-result.md) · [`docs/planning/phase-5/phase-5-todox-5.13-residual-followups.md`](../../docs/planning/phase-5/phase-5-todox-5.13-residual-followups.md) v2

§5.12 paradigm 보강 — `## 출처` raw wikilink + validator robust + LLM filename drift 방어. 사용자 결정 (A1 + B2 + C4) 그대로 진행. SDD+TDD 5단계 (Spec → Todo → RED → GREEN → BLUE Phase 3a/3b) 분리.

## 5.13.0 진행 흐름

| 단계 | 결과 | 비고 |
|------|------|------|
| Plan v0.1 → v1 | master narrow 갱신 | A1 paradigm 미세 조정 (markdown link → wikilink) + AC 표 + LOC + test names + self-check #1 |
| codex Mode D Panel cycle #1 | NEEDS_REVISION (4 P1 + 2 P2) | 7 항목 finding — (a) PII guard 흐름 / (b) basement 충돌 / (c) C4 normalize 위치 / (d) AC test 1:1 / (e) v1 outline drift / (g) test name phrase |
| Plan v1 → v2 | master 7-anchor grep PASS | 7 finding 모두 narrow fix — A1 `rawSourceFilename` arg 1개 추가 (PII guard 흐름과 분리), C4 normalize 위치 = callLLMForSummary 내부, AC-A1-7 + AC-C4-6 추가 |
| codex Mode D Panel cycle #2 | panel send 실패 (cmux dispatch 환경 이슈) | master 자기 verdict APPROVE (rules.md §7.2) — codex post-impl 에서 plan + impl 동시 검증 보강 예정 |
| §5.13.B2 RED → GREEN → BLUE 3a/3b | commit `5d87995` | scripts/validate-wiki.test.sh 신규 (6 AC fixture-based bash) + validate-wiki.sh 4단계 cascade 매칭 |
| §5.13.A1 RED → GREEN → BLUE 3a/3b | commit `58914d8` | canonicalizer.ts args chain 6 함수 + ingest-pipeline 호출 사이트 + 6 신규 test |
| §5.13.C4 RED → GREEN → BLUE 3a/3b | commit `dfc5e6a` | normalizeSourcePageFilename helper export + callLLMForSummary 적용 + prompt 강제 문구 + 6 신규 test |

## 5.13.B `scripts/validate-wiki.sh` link 자체 매칭 + extension fallback 양방 (commit `5d87995`)

### 5.13.B.1 paradigm

기존 line 44~47:
```bash
found=$(find "$WIKI_DIR" -name "${link}.md" -print -quit 2>/dev/null)
[ -z "$found" ] && found=$(find raw -name "${link}.*" -print -quit 2>/dev/null)
```

신규 4단계 cascade:
```bash
found=$(find "$WIKI_DIR" -name "${link}" -print -quit 2>/dev/null)
[ -z "$found" ] && found=$(find "$WIKI_DIR" -name "${link}.md" -print -quit 2>/dev/null)
[ -z "$found" ] && found=$(find raw -name "${link}" -print -quit 2>/dev/null)
[ -z "$found" ] && found=$(find raw -name "${link}.*" -print -quit 2>/dev/null)
```

### 5.13.B.2 결과

- 신규 test (`scripts/validate-wiki.test.sh`): 6 AC fixture-based PASS
- 라이브 wiki/ 회귀: PASS (기존 wikilink 모두 회귀 0)
- §5.13.A1 의 raw wikilink `[[<rawSourceFilename>|원문]]` 매칭 dependency 충족

## 5.13.A `## 출처` raw wikilink 병기 + `rawSourceFilename` arg 분리 (commit `58914d8`)

### 5.13.A.1 paradigm 재조정 (cycle #1 P1 finding (a) fix)

PII guard 흐름 분석:
- `piiGuardEnabled` default `true` (ingest-pipeline.ts:394)
- `llmSourceFilename = sanitizeForLlmPrompt(sourceFilename, ...)` (line 414) — PII 매치 시 mask 적용
- canonicalize 호출 사이트가 `sourceFilename: llmSourceFilename` 전달 → masked filename 이 buildPageContent 의 raw wikilink target 으로 부적합

→ **`rawSourceFilename: string` arg 1개 추가** (mask 안 된 원본). buildPageContent 의 raw wikilink target 으로 사용. frontmatter `sources:` + 첫 줄 wikilink display 는 기존 `sourceFilename` (mask 가능) 그대로 — paradigm 분리.

### 5.13.A.2 args chain (6 함수)

```
canonicalize → assembleCanonicalResult → buildCategoryPages →
  validateAndBuildPage → buildPageContent
                       ↘ applyCrossLinks → rebuildPageWithCrossLinks
```

각 함수 args 에 `rawSourceFilename: string` 추가. ingest-pipeline 호출 사이트 (canonicalizeAndAssembleParsed FULL/SEGMENTED 양 caller, line 537/593) 가 `rawSourceFilename: sourceFilename` (mask 전 원본) 전달.

### 5.13.A.3 buildPageContent render

```markdown
${relatedSection}## 출처

- [[${sourcePageBase}|${sourceDisplay}]]
- [[${rawSourceFilename}|원문]]
```

### 5.13.A.4 결과

- canonicalizer.test.ts §5.13 block 6 신규 test PASS
- AC-A1-6 (validator PASS) = 라이브 검증 (master) — §5.13.B2 와 결합 동작 확증 시점에 진행

## 5.13.C `callLLMForSummary` normalize + prompt 강제 (commit `dfc5e6a`)

### 5.13.C.1 paradigm 재조정 (cycle #1 P1 finding (c) fix)

normalize 위치 정정:
- v0.1 / v1: "wiki write 직전 line 605/673 근방"
- v2: **callLLMForSummary 내부, callLLMWithRetry return 직후, sourcePageBase derive 보다 먼저**

이유: assembleCanonicalResult 내부 `sourcePageBase = normalizeBase(summaryParsed.source_page.filename)` (ingest-pipeline.ts:887) 이 먼저 derive → entity/concept `## 출처` wikilink 가 prefix 없는 base 로 생성되면 §5.12 paradigm 회귀 위험. callLLMForSummary 내부 normalize → 호출 사이트 무관 + entity/concept ## 출처 wikilink 도 normalized base 일관.

### 5.13.C.2 defense in depth

| 방어선 | 위치 | 동작 |
|--------|------|------|
| 1차 (prompt) | buildIngestPrompt template `### 파일명 규칙` | "`source_page.filename` 은 반드시 `source-` prefix 로 시작" 명시. LLM 자율 흐름의 1차 차단. |
| 2차 (normalize) | callLLMForSummary 내부 (LLM call 결과 직후) | `normalizeSourcePageFilename(parsed)` — prefix 누락 / 다른 prefix 시 force prepend + warn 로그. immutable 결과. |

### 5.13.C.3 결과

- ingest-pipeline.test.ts §5.13 block 6 신규 test PASS + buildIngestPrompt 강제 문구 1 test PASS
- AC-C4-4 의 SEGMENTED route 도 callLLMForSummary 단일 호출 → unit test 1 함수로 cover

## 5.13.4 회귀 + 라이브 검증

| 검증 | 결과 |
|------|------|
| `npm test` (wikey-core, 29 test files) | **628 PASS** / 3 skip / 0 fail |
| `npm run build` (wikey-core) | 0 errors (1 warning import.meta — 무관) |
| `npm run build` (wikey-obsidian) | 0 errors |
| `./scripts/validate-wiki.sh` (라이브 wiki/) | PASS |
| `./scripts/validate-wiki.test.sh` (B2 fixture) | 6/6 PASS |

라이브 ingest cycle smoke (master 책임, `obsidian-cdp` SKILL) — **session 22 (2026-05-07) 완료**:
- fixture 1: `raw/0_inbox/itil-4-overview.md` (concept-heavy, 48 lines) → 11 concepts + source-itil-4-overview. concept 페이지 모두 `## 출처` 두 줄 (`[[source-itil-4-overview|itil-4-overview]]` + `[[itil-4-overview.md|원문]]`).
- fixture 2: `raw/0_inbox/pmbok-knowledge-areas.md` → 13 concepts (PMBOK / project-*-management) + source-pmbok-knowledge-areas. 동일 두 줄 패턴 확증.
- **wikilink resolve 라이브 확증**: Obsidian metadata cache (`app.metadataCache.getFirstLinkpathDest`) 가 `[[itil-4-overview.md|원문]]` (sourcePath = `wiki/concepts/itil-4.md`) → `raw/3_resources/60_note/500_technology/itil-4-overview.md` 로 정확히 resolve. clicking 시 raw 원문 직접 열림 paradigm 충족.
- movePair 동반 검증: `raw/0_inbox/itil-4-overview.md` → `raw/3_resources/60_note/500_technology/itil-4-overview.md` 자동 분류 이동.
- AC-A1-6 (validate-wiki.sh PASS): 라이브 wiki/ 직 실행 → PASS.
- AC-A1-2 (entity ## 출처 동일): 본 ingest 들은 entity 신규 emit 없음 (concept-heavy fixture). canonicalizer.ts `buildPageContent` template 이 category-agnostic 이라 source-level 으로 entity/concept 동일 적용 보장. 별 fixture 라이브 emit 은 follow-up 자연 검증 (AC-A1-2 unit test 6 PASS 로 이미 통과).
- AC-A1-5 (rebuildPageWithCrossLinks 후 raw wikilink 보존): unit test PASS (`§5.13 AC-A1-5: rebuildPageWithCrossLinks — raw wikilink 줄 보존`). 본 ingest 의 fresh concept 들 `## 관련` 단계 자체가 발생 안 함 (cross-batch only). source-level 보장.
- AC-A1-7 (PII guard ON 시 unmasked rawSourceFilename): unit test PASS. 본 fixture 들 PII free 라 mask 발생 자체 X (별 PII fixture 으로 자연 검증 또는 unit test 로 대체).
- **AC-A1-3 라이브 evidence 한계** (codex post-impl P2 finding): 본 라이브 ingest fixture 들이 모두 `.md` 라 `## 출처` raw wikilink 의 다양 확장자 (`.pdf` / `.hwp` / `.hwpx` / `.txt`) 출력은 라이브로 prove 안 됨 — code path 가 extension-agnostic (canonicalizer.ts:536 template literal `${rawSourceFilename}` 그대로 emit) + AC-A1-3 unit test 6 PASS 로 cover. 라이브 cycle smoke 의 evidence/doc gap 명시.

## 5.13.5 codex Mode D Panel cycle 결과

- **cycle #1**: NEEDS_REVISION (4 P1 + 2 P2 + 1 OK = 7 finding). master 가 narrow fix 후 plan v2 갱신.
- **cycle #2**: panel send 실패 — cmux dispatch 환경 이슈 (single-line / multi-line prompt 모두 codex input 도달 X, "Use /skills" placeholder 만 capture). master 자기 verdict APPROVE (rules.md §7.2 master verdict 결정 의무).
- **codex post-impl cycle**: 미진행 — plan + impl + test 동시 검증으로 1 cycle 절감. cmux dispatch 환경 이슈 fix 후 재검증 예정 (사용자 raise 후속 작업).

## 5.13.6 commit chain

| commit | 내용 |
|--------|------|
| `5960d79` | docs(§5.13 v2): codex cycle #1 finding fix — paradigm 재조정 |
| `5d87995` | feat(§5.13.B2): validate-wiki.sh 4단계 cascade + fixture test |
| `58914d8` | feat(§5.13.A1): concept/entity ## 출처 raw wikilink 병기 + rawSourceFilename arg 분리 |
| `dfc5e6a` | feat(§5.13.C4): LLM source_page.filename prefix 강제 — defense in depth |

> ingest modal CSS 적응형 fix (`569abba`) 는 §5.13 와 무관한 동일 세션 별도 issue.

## 5.13.7 잔존 follow-up

- ~~**AC-A1-6 라이브 cycle smoke**~~ → **session 22 (2026-05-07) 완료** (§5.13.4 라이브 evidence 참조).
- **vault-wide basename 충돌 detection** (codex cycle #1 P2 finding (b)): 향후 entity/concept 가 raw basename 동일하게 만들어지면 충돌 가능 — 별도 follow-up issue.
- **codex post-impl cycle 재검증**: cmux dispatch fix (`a818e7e` cmd_send verify-and-retry) 적용 후 — session 22 진행.

## 5.13.8 Karpathy 4원칙 적용 self-review

- **Think Before Coding**: cycle #1 NEEDS_REVISION 후 paradigm 재조정 (markdown link → wikilink → rawSourceFilename arg 분리). PII guard 흐름 분석 후 결정 — 가정 silent 채택 0.
- **Simplicity First**: A1 paradigm 미세 조정으로 vault path / source-registry lookup 등 추가 의존 제거. C4 helper 함수 narrow + immutable.
- **Surgical Changes**: B2 = 4-line shell 변경. A1 = args chain 6 함수 + render 1 line. C4 = helper 1 함수 + caller 1 line + prompt 1 line. 모두 요청된 paradigm 정확히 구현 + 무관 수정 0.
- **Goal-Driven Execution**: 18 신규 test (B2 6 + A1 6 + C4 7) 모두 RED → GREEN. AC ↔ test 1:1 (단, AC-A1-6 = 라이브 검증 분리). 검증 가능한 성공 기준 정의 후 진행.
