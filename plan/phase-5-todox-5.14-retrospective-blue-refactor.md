---
phase: 5
section: 5.14
title: Phase 5 retrospective TDD-BLUE refactor — §5.11 v2 + §5.12 GREEN 단계 누락 보완
status: draft
created: 2026-05-06
updated: 2026-05-06
version: v0
priority: P0 (다음 세션 최우선 과제)
---

# Phase 5 §5.14 — retrospective TDD-BLUE refactor (다음 세션 최우선)

> **상위 문서**: [`plan/phase-5-todo.md`](./phase-5-todo.md) · [`activity/phase-5-result.md`](../activity/phase-5-result.md)
>
> **이슈 출처**: 사용자 raise 2026-05-06 — §5.11 v2 + §5.12 SDD+TDD 진행 시 RED + GREEN 은 명시 진행했으나 **BLUE (Refactor)** 가 사실상 누락 (Phase 3 가 회귀 검증만 수행, 코드 quality 개선 활동 X). retrospective 으로 BLUE 단계를 별도 cycle 로 보강.
>
> **상태**: **draft / 다음 세션 최우선 (P0)**. §5.13 (A1+B2+C4) 보다 우선 진행.

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
