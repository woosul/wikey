---
phase: 5
section: 5.14
title: Phase 5 retrospective TDD-BLUE refactor — 본체 종결
status: completed
created: 2026-05-06
updated: 2026-05-07
version: v1 (session 19) → executed (session 20) → narrow continuation (session 22) → terminal verdict (session 23)
priority: P0 (종결)
---

# Phase 5 §5.14 — retrospective TDD-BLUE refactor (본체 종결)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md`](./phase-5-todo.md) · [`activity/phase-5/phase-5-result.md`](../../activity/phase-5/phase-5-result.md)
>
> **이슈 출처**: 사용자 raise 2026-05-06 — §5.11 v2 + §5.12 SDD+TDD 진행 시 RED + GREEN 은 명시 진행했으나 **BLUE (Refactor)** 가 사실상 누락 (Phase 3 가 회귀 검증만 수행, 코드 quality 개선 활동 X). retrospective 으로 BLUE 단계를 별도 cycle 로 보강.
>
> **상태**: **종결 (session 23, 2026-05-07)**. Tier 2-4 narrow BLUE + Layer 6 + sidebar-chat narrow 완료. 잔존 4 항목 (UI E2E test 의존) 은 `§9 본체 종결 결정` 참고 — 의도적 유지 + 근거 명시.
>
> **버전 이력**:
> - v0 (2026-05-06 session 19, narrow scope = §5.11 v2 + §5.12 만)
> - v1 (2026-05-06 session 19, 사용자 raise "전체 코드 refactoring 필요할 수도" → master 코드 health 진단 후 scope 4 tier 로 확장. Tier 2 시작 권고)
> - executed (2026-05-06 session 20, Tier 2-4 narrow BLUE 진행 + codex post-impl APPROVE)
> - narrow continuation (2026-05-07 session 22, Layer 6 waitUntilFresh 강화 + sidebar-chat narrow refactor)
> - **terminal (2026-05-07 session 23, 잔존 4 항목 본체 종결 결정 — §9)**

---

## 0. master 사전 진단 (2026-05-06)

### 0.1 파일 별 LOC 분포

| 파일 | LOC | 영역 |
|------|-----|------|
| `wikey-core/src/ingest-pipeline.ts` | **2319** | 핵심 (거대) |
| `wikey-obsidian/src/sidebar-chat.ts` | **2300** | UI 패널 (거대) |
| `wikey-obsidian/src/settings-tab.ts` | **1175** | UI 설정 |
| `wikey-obsidian/src/main.ts` | 782 | UI plugin entry |
| `wikey-obsidian/src/commands.ts` | 676 | UI 명령 |
| `wikey-core/src/query-pipeline.ts` | 661 | 핵심 |
| `wikey-obsidian/src/ingest-modals.ts` | 655 | UI modal |
| `wikey-core/src/classify.ts` | 647 | 핵심 |
| `wikey-core/src/canonicalizer.ts` | **626** (§5.12 +25) | 핵심 |
| `wikey-core/src/wiki-ops.ts` | 529 | 핵심 |
| `wikey-core/src/pii-redact.ts` | 517 | 핵심 |

### 0.2 코드 health metric

| metric | 값 | 의미 |
|--------|-----|------|
| TODO / FIXME / XXX | **0건** | 깨끗 ✓ |
| `console.*` | **51건** (대부분 ingest log, 의도적) | 검토 필요 |
| § historical 주석 | ingest-pipeline 67 / canonicalizer 37 / sidebar-chat 13 / commands 20 / main 16 / source-registry 16 | 압축 후보 |
| deprecated / legacy / 폐기 마커 | **179건** | Phase 폐기 후 cleanup 미진행 |

→ **사용자 지적 정당** — narrow scope (§5.11 v2 + §5.12) 만으로는 underscope. 거대 파일 (2300+ LOC) + 누적 historical context 압축 + dead code marker cleanup 모두 BLUE 후보.

## 1. 본질 (왜 BLUE 가 필요한가)

TDD 정통 흐름 = **RED → GREEN → BLUE (refactor)**:

- **RED**: 실패하는 test 작성 (요구사항 명세화)
- **GREEN**: 최소 코드로 PASS (동작 확보)
- **BLUE**: 동작 유지하며 코드 quality 개선 (중복 / naming / 함수 분해 / 가독성 / 추상화 적정성)

§5.11 v2 + §5.12 만 BLUE 누락이 아니라 **Phase 5 전체 (§5.1 ~ §5.12) 가 동일 패턴** 으로 진행됐을 가능성 ↑. 거대 파일 + 누적 marker 가 그 증거.

## 2. Scope (4 tier 단계화)

### Tier 1 — narrow (확증된 BLUE 누락만)

§5.11 v2 + §5.12 변경 영역만:
- canonicalizer.ts:113-178 / 304-410 / 421-516 / 528-567 (sourcePageBase chain + buildPageContent)
- ingest-pipeline.ts:520-640 (FULL + SEGMENTED stage 2 추가 부분)
- canonicalizer.test.ts:21-30 / 449-580 (baseArgs default + §5.12 case)

**LOC 영향**: ~150 lines / **시간 추정**: 1 cycle 4~6 시간.

### Tier 2 — Phase 5 핵심 코드 (★ 사용자 raise 기반 추천 시작점)

Tier 1 + Phase 5 의 핵심 파일 전체:
- `canonicalizer.ts` 전체 (626 LOC)
- `ingest-pipeline.ts` 전체 (**2319 LOC** — 함수 분해 / 거대 함수 / 중복 패턴 검토 핵심)
- `wiki-ops.ts` 전체 (529 LOC)
- `pii-redact.ts` 전체 (517 LOC)
- `query-pipeline.ts` 전체 (661 LOC)

**LOC 영향**: ~4600 lines / **시간 추정**: 3~5 cycle 12~20 시간.

### Tier 3 — wikey-obsidian (UI 측)

Tier 2 + UI 거대 파일:
- `sidebar-chat.ts` (2300 LOC — 거대 UI 패널)
- `settings-tab.ts` (1175 LOC)
- `main.ts` (782 LOC)
- `commands.ts` (676 LOC)
- `ingest-modals.ts` (655 LOC)

**LOC 영향**: ~5588 lines / **시간 추정**: Tier 2 + 3~4 cycle 추가.

### Tier 4 — 전체 codebase sampling

Tier 3 + 잔여 (`classify.ts` 647 / `section-index.ts` 427 / `source-registry.ts` 382 / `incremental-reingest.ts` 366 / `convert-quality.ts` 344 / `pii-patterns.ts` 428 / `llm-client.ts` 292 / 기타).

**LOC 영향**: 전체 ~13000 lines / **시간 추정**: Tier 3 + 2~3 cycle.

### 추천: **Tier 2 시작** (사용자 raise 기반)

Tier 1 만으로는 underscope. Tier 2 가 Phase 5 핵심 + 거대 파일 (ingest-pipeline 2319 LOC) 의 본질적 quality 영향. Tier 3 / 4 는 Tier 2 결과 검토 후 사용자 별 결정.

**병행 진행 옵션**: Tier 2 의 5 파일을 **파일 별 sub-cycle** 로 분리 (§5.14.A canonicalizer / §5.14.B ingest-pipeline / §5.14.C wiki-ops / §5.14.D pii-redact / §5.14.E query-pipeline). 각 sub-cycle 독립 RED→GREEN→BLUE→post-impl.

## 3. 의심 지점 (master 사전 분석, Tier 2 기준)

### 3.1 함수 길이 / 분해

| 함수 | 위치 | LOC | 의심 |
|------|------|-----|------|
| `assembleCanonicalResult` | canonicalizer.ts:310-410 | ~100 | entity loop + concept loop + dropped tracking + cross-link 4 책임 혼재. extract 후보: `applyPromotionGate` (entity/concept 공통), `trackDroppedMentions` |
| `applyCrossLinks.rebuild` | canonicalizer.ts:536-562 | ~27 | nested arrow function. extract 후보: top-level `rebuildPageWithCrossLinks` |
| `buildPageContent` | canonicalizer.ts:468-516 | ~48 | frontmatter + body + 출처 3 섹션 직조립. extract 후보: `buildFrontmatter` / `buildSourceSection` |
| ingest FULL route stage 2 | ingest-pipeline.ts:520-560 | ~40 | summary + extract + canonicalize + dropped log + parse merge 직선 |
| ingest SEGMENTED route stage 2 | ingest-pipeline.ts:560-640 | ~80 | section loop + canonicalize + dropped log + parse merge — FULL 과 거의 동일 후반부 |
| ingest-pipeline.ts 본체 | ingest-pipeline.ts | **2319 LOC** | 거대 monolith. ingest entry + summary + canonicalize + wiki write + reindex + utils 혼재 → 모듈 분해 후보 |
| `query-pipeline.ts` | 661 LOC | 거대 query orchestrator | search + LLM + cite + format 분해 후보 |

### 3.2 Naming inconsistency (Tier 1 기준 — Tier 2 확장 시 추가)

- `sourceFilename` (raw 원본 파일명, e.g., `pmbok-overview.md`)
- `sourcePageBase` (§5.12 신규, wiki/sources/ page base, e.g., `source-pmbok-overview`)
- `sourceBase` (ingest-pipeline.ts:814, 동의어)
- `sourceDisplay` (canonicalizer.ts:493, sourceFilename - extension)
- `llmSourceFilename` (ingest-pipeline.ts, sanitize 된 sourceFilename)

→ **document mapping** 또는 type alias 통한 의미 명확화 필요. Tier 2 진행 시 ingest-pipeline / wiki-ops / pii-redact 의 naming 도 함께.

### 3.3 중복 패턴 (FULL + SEGMENTED route)

ingest-pipeline.ts:539-559 (FULL) vs 608-630 (SEGMENTED) 후반부 거의 동일 → extract 후보: `runCanonicalizeAndMerge(args): { parsed: Parsed; logs: string[] }`.

### 3.4 주석 quality (Tier 1+ )

- §5.3 / §5.4 / §5.10.4 / §5.11 / §5.12 historical context 누적 (ingest-pipeline 67건 / canonicalizer 37건)
- 본질 + 현재 상태 압축 검토. 폐기된 paradigm (§5.10.4 D-wide schema 폐기 등) 의 explanation 은 commit history 로 충분 — 코드 주석 cleanup
- deprecation marker 179건 — section 별 정리 (관련 코드 자체 제거 후보 검토)

### 3.5 Test fixture / 명명

- `canonicalizer.test.ts` 의 §5.3 follow-up #11 4 case 가 §5.12 기대값으로 replace 되었지만 describe/it 제목이 stale 가능
- baseArgs.sourcePageBase default 일관 검증
- 새 §5.12 신규 case 의 describe block 이름 일관

### 3.6 console.* 51건 — 의도적 vs 누락 검토

ingest log 는 의도적 (사용자 visibility) 이지만 debug 잔재 가능성 있음. 51건 inventory + 정당화 또는 logger abstraction.

## 4. AC (Acceptance Criteria — Tier 2 기준)

| AC | 영역 | 검증 |
|----|------|------|
| AC-1 | 함수 분해 (§3.1) — 거대 함수 추출 후보 검토 + 적용 결정 + LOC 변동 명시 | 코드 review + LOC diff |
| AC-2 | Naming (§3.2) — 5+ 변수 의미 mapping document 또는 type alias | grep 일관 |
| AC-3 | 중복 패턴 (§3.3) — `runCanonicalizeAndMerge` extract 또는 의도적 유지 결정 | LOC 비교 |
| AC-4 | 주석 (§3.4) — historical context 압축 + deprecation marker 179 → ≤50 cleanup (Tier 2 후) | grep `deprecated\|legacy\|폐기` |
| AC-5 | Test (§3.5) — describe/it 명명 §5.12 정합 | grep 일관 |
| AC-6 | console.* (§3.6) — inventory + 정당화 | grep `console\.` 분류 |
| AC-7 | 회귀 0 — 615 PASS / 3 skipped 유지 (Tier 2 까지) | npm test |
| AC-8 | build 0 errors | npm run build |
| AC-9 | validate-wiki.sh PASS | exit 0 |
| AC-10 | 라이브 ingest smoke 1 source — refactor 가 ingest 흐름에 영향 없음 | obsidian-cdp full cycle |

## 5. 진행 흐름 — SDD+TDD with **Phase 3a/3b 분리** (영구 정책)

```
Phase 0: codex Mode D Panel cycle 검증 (BLUE plan v1 — extract / naming / dedup 결정)
Phase 1: TDD RED — 신규 test 필요 시만 (대부분 회귀 안전망 으로 충분)
Phase 2: TDD GREEN — refactor 가 중심 (새 기능 X)
Phase 3a: 회귀 검증 (npm test + build + validate-wiki.sh)
Phase 3b: **BLUE refactor (명시 분리)** — §3 의심 지점 별 적용 + 회귀 검증 반복
Phase 4: 라이브 smoke (필요 시) — refactor 가 ingest 흐름에 영향 없음 보장
Phase 5: codex post-impl
Phase 6: master verdict + commit + push + result 문서
```

**Tier 2 의 sub-cycle 분리**:
- §5.14.A canonicalizer.ts (시작 권고 — sourcePageBase chain 직접 영향)
- §5.14.B ingest-pipeline.ts (거대 — 가장 큰 영향)
- §5.14.C wiki-ops.ts
- §5.14.D pii-redact.ts
- §5.14.E query-pipeline.ts

각 sub-cycle 독립 RED→GREEN→BLUE→post-impl→commit. 5 commit chain.

## 6. Karpathy 4원칙 적용 (refactor 만의 특수 고려)

- **Think Before Coding**: 의심 지점 우선 진단 + 옵션 제시 (extract / 유지 + 근거). 무차별 refactor 금지. Tier 2 라도 파일 별 sub-cycle 분할.
- **Simplicity First**: extract 가 LOC 줄이는가 vs indirection 추가만 하는가. 200줄 → 50줄 가능 시만 진행. 순수 cosmetic refactor (이름 변경만) 도 의미 있음 (mental model).
- **Surgical Changes**: 동작 변경 0. test 결과 byte-by-byte identical 확증. naming 만 변경해도 회귀 strict.
- **Goal-Driven**: AC-7 회귀 0 + 코드 quality 정량 (LOC / 함수 길이 / naming consistency grep / deprecation marker 갯수) 가능한 metric 수치화.

## 7. 정책 영구 등록 (2026-05-06 사용자 결정)

본 §5.14 진행과 함께 **TDD-BLUE Phase 3a/3b 분리 정책 영구 등록**:

- `wikey/CLAUDE.md` (project-specific)
- `claude-forge-custom/rules/testing.md` (global, 모든 프로젝트 master 적용)

내용: "모든 SDD+TDD cycle 의 Phase 3 = Phase 3a (회귀 검증) + Phase 3b (BLUE refactor 명시) 분리 의무. 사소한 작업 (오타 / 1-line fix) 은 판단으로 생략 가능."

## 8. 진행 우선순위

**P0 — 다음 세션 최우선 과제** (사용자 명시 2026-05-06).

- **Tier 2 시작 권고** (canonicalizer / ingest-pipeline / wiki-ops / pii-redact / query-pipeline 5 파일)
- 사용자가 sub-cycle 별 진행 결정 — 5 sub-cycle 일괄 또는 §5.14.A 부터 순차

§5.13 (A1+B2+C4) 는 본 §5.14 완료 후 착수.

---

## 메모

- 본 §5.14 는 **draft v1**. 착수 직전 v2 (sub-cycle 별 AC 구체화 + Tier 결정 final).
- master 사전 진단 (§0) 은 2026-05-06 시점 기준. 착수 시 재진단 권고 (LOC / metric 변동 가능).
- TDD-BLUE Phase 3a/3b 분리 정책은 본 §5.14 commit 과 함께 영구 등록 (§7).

---

## 1. 본질 (왜 BLUE 가 필요한가)

TDD 정통 흐름 = **RED → GREEN → BLUE (refactor)**:

- **RED**: 실패하는 test 작성 (요구사항 명세화)
- **GREEN**: 최소 코드로 PASS (동작 확보)
- **BLUE**: 동작 유지하며 코드 quality 개선 (중복 / naming / 함수 분해 / 가독성 / 추상화 적정성)

§5.11 v2 + §5.12 회고:

| 단계 | 명목 | 실제 |
|------|------|------|
| RED | test FAIL 확증 | ✅ 진행 |
| GREEN | test PASS | ✅ 진행 + 동시 일부 simplification (분기 제거 등) |
| **BLUE** | **별도 refactor cycle** | ❌ **`npm test + build` 회귀 검증으로 그침** |
| 라이브 검증 | smoke / validator | ✅ 진행 |
| codex post-impl | cross-model 리뷰 | ✅ 진행 (일부 BLUE 역할 대신 — LOC / 시그니처 / 잔재) |

→ 외부 cross-model 검토 (codex) 가 BLUE 의 일부를 우연히 보완했지만, **명시 단계로 분리되어 진행 안 됨**. naming / 중복 패턴 / 함수 분해 같은 본질적 BLUE 활동은 미수행.

## 2. Scope (우선 §5.11 v2 + §5.12 narrow start)

### 2.1 1차 scope (확증된 BLUE 누락 지점)

| 영역 | 파일 | 검토 차원 |
|------|------|----------|
| canonicalizer.ts | `wikey-core/src/canonicalizer.ts` | 함수 분해 / naming / 주석 |
| ingest-pipeline.ts | `wikey-core/src/ingest-pipeline.ts` | FULL + SEGMENTED 중복 / 주석 |
| canonicalizer.test.ts | `wikey-core/src/__tests__/canonicalizer.test.ts` | fixture 정리 / test 명명 일관 |

### 2.2 2차 scope (옵션, 사용자 결정 후)

§5.1 ~ §5.10 의 retrospective BLUE — 이미 commit 완료된 코드 sampling. 명시 BLUE 미수행 지점 식별 후 narrow 진행.

본 v0 은 1차 scope 만 명시. 2차 는 1차 완료 후 사용자 별 raise.

## 3. 의심 지점 (master 사전 분석, 착수 시 v1 검증)

### 3.1 함수 길이 / 분해

| 함수 | 위치 | LOC | 의심 |
|------|------|-----|------|
| `assembleCanonicalResult` | canonicalizer.ts:310-410 | ~100 | entity loop + concept loop + dropped tracking + cross-link 4 책임 혼재. extract 후보: `applyPromotionGate` (entity/concept 공통 로직), `trackDroppedMentions` |
| `applyCrossLinks.rebuild` | canonicalizer.ts:536-562 | ~27 | nested arrow function. extract 후보: top-level `rebuildPageWithCrossLinks` |
| `buildPageContent` | canonicalizer.ts:468-516 | ~48 | frontmatter + body + 출처 3 섹션 직조립. extract 후보: `buildFrontmatter` / `buildSourceSection` |
| ingest FULL route stage 2 | ingest-pipeline.ts:520-560 | ~40 | summary + extract + canonicalize + dropped log + parse merge 직선 |
| ingest SEGMENTED route stage 2 | ingest-pipeline.ts:560-640 | ~80 | section loop + canonicalize + dropped log + parse merge — FULL 과 거의 동일 후반부 |

### 3.2 Naming inconsistency

- `sourceFilename` (raw 원본 파일명, e.g., `pmbok-overview.md`)
- `sourcePageBase` (§5.12 신규, wiki/sources/ page base, e.g., `source-pmbok-overview`)
- `sourceBase` (ingest-pipeline.ts:814, normalizeBase(sourcePage.filename) — 문맥상 sourcePageBase 와 동일하지만 이름 다름)
- `sourceDisplay` (canonicalizer.ts:493, sourceFilename - extension)
- `llmSourceFilename` (ingest-pipeline.ts, sanitize 된 sourceFilename)

→ **document mapping** 또는 type alias 통한 의미 명확화 필요.

### 3.3 중복 패턴 (FULL + SEGMENTED route)

ingest-pipeline.ts:539-559 (FULL) vs 608-630 (SEGMENTED):

```typescript
const sourcePageBase = normalizeBase(summaryParsed.source_page.filename)
const canon = await canonicalize({ ... sourcePageBase ... })
log(`stage 2.3 canonicalize done in ${...}ms — entities=${canon.entities.length}, concepts=${canon.concepts.length}, dropped=${canon.dropped.length}`)
if (canon.dropped.length > 0) {
  const droppedSummary = canon.dropped.slice(0, 10).map((d) => `${d.mention.name} (${d.reason})`).join(', ')
  log(`dropped sample: ${droppedSummary}${...}`)
}
parsed = {
  source_page: summaryParsed.source_page,
  entities: canon.entities.map((p) => ({ filename: p.filename, content: p.content })),
  concepts: canon.concepts.map((p) => ({ filename: p.filename, content: p.content })),
  index_additions: ...,
  log_entry: ...,
}
```

→ extract 후보: `runCanonicalizeAndMerge(args): { parsed: Parsed; logs: string[] }` — FULL + SEGMENTED 양 route 가 호출.

### 3.4 주석 quality

- §5.3 follow-up #11 잔재 (canonicalizer.ts) — §5.12 GREEN 에서 갱신했지만 문장 다듬기 가능
- §5.10.4 P2-1 / D-wide 같은 historical context comment — 본질 + 현재 상태 압축 검토
- TODO / FIXME 잔재 검색 (`grep -nE "TODO|FIXME|XXX" wikey-core/src/canonicalizer.ts wikey-core/src/ingest-pipeline.ts`)

### 3.5 Test fixture / 명명

- `canonicalizer.test.ts` 의 §5.3 follow-up #11 4 case 가 §5.12 기대값으로 replace 되었지만 describe/it 제목이 stale 가능 (e.g., "## 출처 — paired pdf source" 가 §5.12 paradigm 에서는 정확한 표현인지 검토)
- `baseArgs.sourcePageBase: 'source-PMS_test'` default 가 일관 (sourceFilename: 'PMS_test.pdf' base + 'source-' prefix)
- 새 §5.12 신규 case 의 describe block 이름 일관 (`§5.12 source wikilink format invariant`)

## 4. AC (Acceptance Criteria — v0 개략, v1 에서 구체화)

| AC | 영역 | 검증 |
|----|------|------|
| AC-1 | 함수 분해 (§3.1) — 의심 5 함수 중 추출 후보 검토 + 적용 결정 | 코드 review + LOC 변동 명시 |
| AC-2 | Naming (§3.2) — `sourceFilename` / `sourcePageBase` / `sourceBase` 의미 mapping document 또는 type alias | grep 일관 |
| AC-3 | 중복 패턴 (§3.3) — `runCanonicalizeAndMerge` extract 또는 의도적 유지 결정 + 근거 명시 | LOC 비교 |
| AC-4 | 주석 (§3.4) — historical context 압축 + TODO 0 | grep `TODO\|FIXME` |
| AC-5 | Test (§3.5) — describe/it 명명 §5.12 정합 | grep 일관 |
| AC-6 | 회귀 0 — 615 PASS / 3 skipped 유지 | npm test |
| AC-7 | build 0 errors | npm run build |
| AC-8 | validate-wiki.sh PASS 유지 | exit 0 |

## 5. 진행 흐름 — SDD+TDD with **Phase 3a/3b 분리**

```
Phase 0: codex Mode D Panel cycle 검증 (BLUE plan v1 — extract / naming / dedup 결정)
Phase 1: TDD RED — 신규 test 필요 시만 (대부분 회귀 안전망 으로 충분)
Phase 2: TDD GREEN — 본 §5.14 는 GREEN 새 기능 X, refactor 가 중심
Phase 3a: 회귀 검증 (npm test + build)
Phase 3b: **BLUE refactor (명시 분리)** — §3 의심 지점 별 적용 + 회귀 검증 반복
Phase 4: 라이브 smoke (필요 시) — refactor 가 ingest 흐름에 영향 없음 보장
Phase 5: codex post-impl
Phase 6: master verdict + commit + push + result 문서
```

**핵심 차이**: Phase 3a / 3b 명시 분리. Phase 3b 가 본 §5.14 의 본질.

## 6. Karpathy 4원칙 적용 (refactor 만의 특수 고려)

- **Think Before Coding**: 의심 지점 우선 진단 + 옵션 제시 (extract / 유지 + 근거). 무차별 refactor 금지.
- **Simplicity First**: extract 가 LOC 줄이는가 vs indirection 추가만 하는가. 200줄 → 50줄 가능 시만 진행.
- **Surgical Changes**: 동작 변경 0. test 결과 byte-by-byte identical 확증. naming 만 변경해도 회귀 strict.
- **Goal-Driven**: AC-6 회귀 0 + 코드 quality 정량 (LOC / 함수 길이 / naming consistency grep) 가능한 metric 수치화.

## 7. 정책 영구 등록 후보 (사용자 별 결정)

본 §5.14 진행 결과를 바탕으로 향후 SDD+TDD cycle 의 표준 흐름 변경 영구 등록:

- `wikey/CLAUDE.md` 또는 `~/.claude/CLAUDE.md` 또는 `claude-forge-custom/rules/testing.md` 에 "Phase 3 = 3a 회귀 + 3b BLUE 분리 의무" 명시
- 모든 SDD+TDD plan template 에 Phase 3a / 3b 분리 행 추가

→ 사용자 별 결정 후 반영.

## 8. 진행 우선순위

**P0 — 다음 세션 최우선 과제** (사용자 명시 2026-05-06).

§5.13 (A1+B2+C4) 는 본 §5.14 완료 후 착수.

---

## 메모

- 본 §5.14 는 **draft v0**. 착수 직전 v1 으로 갱신 (의심 지점별 옵션 결정 + AC 구체화).
- 1차 scope 만 명시 (§5.11 v2 + §5.12 retrospective). 2차 (§5.1~§5.10 sampling) 은 사용자 결정 후.
- §5.14 가 §5.13 보다 우선이라는 사용자 임시 결정은 변경 가능 (§5.13 항목별 우선 진행도 옵션).

---

## 9. 본체 종결 결정 (session 23, 2026-05-07)

> **사용자 명시**: "5.14 의 잔존 작업 'UI E2E test 의존' 과 관련해서 진행해줘. 이제 본체 관련된 모든 작업은 이것으로 종결되어야 함."
>
> **결론**: 잔존 4 항목 모두 **deep split 의도적 유지** 결정. 본 §5.14 본체 종결.

### 9.0 종결 근거 — 인프라·원칙 cross-check

| 시각 | 평가 |
|------|------|
| **Test 인프라** | `wikey-obsidian/package.json` 에 vitest/jest 의존성·`test` script 0건. 모든 unit test 는 wikey-core 에만 존재. UI 코드 deep split 시 안전망 = 라이브 obsidian-cdp full cycle smoke 만 가용 (5 패널 render + console 0 error). |
| **Karpathy Simplicity First** | extract 가 LOC 줄이는가 vs indirection 추가만 하는가 — 4 항목 모두 후자에 해당 (closure state ≥6, props 인터페이스 신설 비용 > 함수 길이 절감). |
| **Karpathy Surgical Changes** | 본인이 만든 잔재만 정리. 잔존 항목들은 본 §5.14 cycle 이 만든 게 아니라 plugin lifecycle scoped state 의 자연스러운 캡슐화. |
| **Goal-Driven** | AC-7 회귀 0 / AC-8 build 0 errors / AC-9 validate-wiki PASS 모두 만족 (session 22 종결 시점 635 PASS). 추가 cycle 의 marginal benefit ↓ |

### 9.1 항목별 정량 분석 + 의도적 유지 근거

#### Item 1 — `sidebar-chat.ts` `renderAuditSection` deeper split

| 항목 | 값 |
|------|-----|
| 현 LOC | 862 ~ 1546 (684 lines) |
| 외부 closure state | 12+ (auditMode mut / viewMode mut / searchQuery mut / treeExpand Map mut / auditData / ingestedSet / unsupportedSet / auditAllSet / container / basePath / env / this.app / this.plugin) |
| inner closure (extract 후보) | renderList (95 LOC) / renderTree (95 LOC) / ingest btn click handler (196 LOC) |
| extract 비용 | 12 fields props 객체 + 4 setter callback (mut state) + module-level fn 의 module scope import — props formalization +50 LOC 추가 |
| LOC 절감 | renderAuditSection 자체 200~250 LOC 잔존 + helper 들 95+95+196+(props 형식화 50) = ~436 LOC 격상 → **net LOC ≈ 0**, indirection 만 추가 |
| 결정 | **의도적 유지** — Simplicity First 위반 (200줄 → 50줄 대신 zero gain). 추후 vitest+obsidian mock UI E2E test 인프라 구축 시 재평가. |

#### Item 2 — `settings-tab.ts` setting group 별 분해

| 항목 | 값 |
|------|-----|
| 현 LOC | 1175 |
| 구조 | 이미 `render*Section` 으로 section-decomposed (renderEnvStatusSection 148 / renderGeneralSection 180 / renderProvidersSection / renderModelsSection / renderIngestSection / renderPiiSection 등) |
| 추가 split 후보 | 같은 setting group 내 관련 setting 들을 sub-helper 로 분리 |
| 비용 | UI 행 정렬과 코드 정렬의 1:1 매핑 깨뜨림 — 사용자 raise: "settings UI 한 화면에서 인접 행이 코드에서도 인접해야 직관적" (인지 비용 ↑) |
| 결정 | **의도적 유지** — artificial split 우려. 현재 section 단위가 UX-meaningful 단위와 일치. |

#### Item 3 — `main.ts` `onload` 분해

| 항목 | 값 |
|------|-----|
| 현 LOC | 163~293 (131 lines) |
| closure state | 8 (startTime / STARTUP_GRACE_MS / bypassBatch / bypassTimer / autoQueue / autoTimer / scheduleAutoIngest / renameDebouncers Map) |
| 이미 method 추출됨 | `handleVaultRename` / `handleVaultDelete` (private async) |
| 잔존 inline | `handleVaultCreate` (inbox auto-ingest queue + bypass detection) |
| extract 비용 | 6 closure state instance field 격상 → plugin lifecycle scoped state 의 외부 노출 표면 확장 (캡슐화 약화) |
| triggerReconcile (5 LOC) | extract 가능하나 5 LOC 의 비용·가치 균형 ≈ 0 |
| 결정 | **의도적 유지** — onload closure 가 plugin lifecycle scoped state 의 자연스러운 캡슐화. method 격상은 캡슐화 약화 + indirection 추가. |

#### Item 4 — `commands.ts` `runIngest` 113 LOC

| 항목 | 값 |
|------|-----|
| 현 LOC | runIngest 113 |
| 구조 | fast path (skip branch — early return) / stay-involved flow / inner loop 3 단계 cleanly structured + step 별 주석 |
| extract 후보 | 명확히 없음 (각 단계가 5~30 LOC 의 작은 step) |
| LOC 절감 | 0 (각 step 추출 시 함수 호출 1줄 + 함수 정의 N+2 줄, indirection 만) |
| 결정 | **의도적 유지** — 분해 가치 < 0. 이미 cleanly structured. |

### 9.2 잔존 항목 → "결정 후 종결" 분류 변경

기존 `[ ] UI E2E test 의존` (defer) → **`[x] 의도적 유지 결정 (2026-05-07)`** 로 변경. 추후 wikey-obsidian 에 vitest + obsidian mock + jsdom 인프라 구축 시 (별도 phase / future work) 본 결정 재평가 가능. 본체 §5.14 는 종결.

### 9.3 본체 §5.14 종결 verdict

| 영역 | 상태 |
|------|------|
| Tier 2 (core 6 파일) BLUE | ✅ session 20 commit `888317f` (canonicalizer / ingest-pipeline / wiki-ops / pii-redact / query-pipeline / schema) |
| Tier 3 (UI 4 파일) narrow cleanup | ✅ session 20 commit `888317f` |
| Tier 4 wikey-core 잔여 sampling | ✅ session 20 commit `888317f` |
| Layer 6 waitUntilFresh 강화 | ✅ session 22 commit `f8476d4` |
| sidebar-chat narrow refactor | ✅ session 22 commit `7a166f4` (renderAuditSection 727→687 LOC) |
| 잔존 4 항목 (UI E2E test 의존) | ✅ session 23 의도적 유지 결정 (본 §9) |
| TDD-BLUE Phase 3a/3b 영구 정책 | ✅ session 19 commit `0cb2e06` + `eccf98a` |

**§5.14 종결**. 본체 BLUE refactor 작업 완료. 미래 UI E2E test 인프라가 갖춰지면 잔존 4 항목 deep split 재평가 가능 — 그 때까지 현 closure 캡슐화가 정당.
