---
phase: 5
section: 5.21
title: Ingest pipeline mention guard — broken wikilink 근본 원인 1+3 fix (Result)
created: 2026-05-13
version: v0.1
---

# Phase 5 §5.21 Ingest pipeline mention guard — Result (2026-05-13 session 40)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.21`](../../plan/phase-5/phase-5-todo.md) · [`plan/phase-5/phase-5-spec-5.21-ingest-mention-guard.md`](../../plan/phase-5/phase-5-spec-5.21-ingest-mention-guard.md) (v0.3) · [`plan/phase-5/phase-5-todox-5.21-ingest-mention-guard.md`](../../plan/phase-5/phase-5-todox-5.21-ingest-mention-guard.md) (v0.3) #ingest #mention-guard #canonicalizer #done

## 1. 종결 요약

§5.19 v0.4 broken wikilink 585건 (de-duped) 분석에서 도출된 3 근본 원인 중 **근본 원인 1 (raw filename, 195건 33%) + 근본 원인 3 (case-insensitive, 116건 20%)** 을 ingest pipeline 의 deterministic post-process guard 로 cover. 신규 `wikey-core/src/wiki/mention-guard.ts` (228 LOC) + `ingest-pipeline.ts` post-process hook + Stage 2 prompt hint 추가. 9 unit test (Step B 7 + 기존 회귀) 모두 PASS, build 0 errors, validate-wiki 회귀 -11 (baseline 458 → 447, 새 entity page 가 기존 broken satisfied).

**SDD+TDD cycle**: Step A LOCK (v0.2 → v0.3 codex 7 finding fix) → Step B (tester RED 7/7 FAIL) → Step C (developer GREEN 7/7 PASS) → Step D (Phase 3a 회귀) → Step E (BLUE refactor) → Step F (codex post-impl review NEEDS_REVISION 4 finding fix) → Step G (master 라이브 CDP smoke 2 cycle).

## 2. 산출물

### 2.1 신규 file

- `wikey-core/src/wiki/mention-guard.ts` (228 LOC) — pure function, I/O 없음
  - `parseWikilinksWithRanges(content)` → `{ original, target, alias, range }[]` (I8, dedup 없음 + offset 보존)
  - `applyMentionGuard(content, options)` → `{ content, log }` (I1/I2/I4/I5/I6/I7 deterministic guard)
  - helper 6 (findSourcesSplit / buildCanonicalReplacement / buildPlainTextReplacement / classifyLink / parseWikilinksWithRanges / applyMentionGuard)
- `wikey-core/src/__tests__/mention-guard.test.ts` (7 test case)
- `wikey-core/src/__tests__/fixtures/mention-guard/` (5 fixture)
  - `raw-filename-md.md` / `raw-filename-pdf.md` / `mixed-case-with-alias.md` / `mixed-case-no-alias.md` / `source-link-exempt.md`

### 2.2 기존 edit

- `wikey-core/src/ingest-pipeline.ts` (~ +50 LOC)
  - Stage 2 prompt hint (I3, ≤ 5 LOC, mention extractor prompt)
  - `mentionGuardBases` set + `guardedPageContent` helper (post-process hook)
  - `guardedEntities` / `guardedConcepts` Map → `writtenPages` + return payload propagation (codex Step F MEDIUM #3)
  - `persistMentionGuardLog` helper → `.wikey/mention-guard-<YYYY-MM-DD>.jsonl` append
  - `wiki/log.md` summary 1 line (`mention-guard: N variations applied`, raw `[[X]]` 미포함)
- `wikey-core/src/canonicalizer.ts` (+ 5 LOC)
  - `buildCanonicalizerPrompt` 안 §5.21 wikilink rule hint (codex Step F LOW)

### 2.3 plan 문서

- `plan/phase-5/phase-5-spec-5.21-ingest-mention-guard.md` v0.1 → v0.2 → v0.3 (Step A LOCK + codex review 7 finding fix)
- `plan/phase-5/phase-5-todox-5.21-ingest-mention-guard.md` v0.1 → v0.2 → v0.3 (mirror)
- `plan/phase-5/phase-5-todo.md §5.21` (draft → done 갱신)

## 3. SDD invariants → Test → Impl 4중 정합

| Invariant | Spec | Test | Impl 위치 |
|-----------|------|------|-----------|
| I1 (extension reject → plain text) | Spec 1 | AC-S1-1, AC-S1-2 | `mention-guard.ts:138-140` (EXTENSION_RE) |
| I2 (raw-filename slug + existingBases fallback) | Spec 1 | AC-S1-2 (간접) | `mention-guard.ts:142-156` (RAW_FILENAME_RE + canonicalizeSlug + existingBases) |
| I3 (Stage 2 prompt hint) | Spec 1 | — (best-effort) | `ingest-pipeline.ts` Stage 2 prompt + `canonicalizer.ts` buildCanonicalizerPrompt |
| I4 (target canonicalize) | Spec 2 | AC-S2-1 | `mention-guard.ts:104-114` (buildCanonicalReplacement) |
| I5 (alias preserve) | Spec 2 | AC-S2-2 | `mention-guard.ts:110-112` (`[[canonical|alias]]` shape) |
| I6 (idempotent) | Spec 2 | AC-S2-3 | `mention-guard.ts:109` (canonical === target → null) |
| I7 (§5.13 source link exempt) | Spec 1 | AC-S1-4 | `mention-guard.ts:133-134` (alias === '원문' short-circuit) + `findSourcesSplit` |
| I8 (parser with ranges) | Spec 2 | AC-S2-* (간접) | `mention-guard.ts:73-87` (parseWikilinksWithRanges) |
| AC-S1-3 (log JSON 형식) | Spec 1 | AC-S1-3 | `mention-guard.ts:182-189` (log push) + `ingest-pipeline.ts persistMentionGuardLog` |

## 4. 단계별 진행 evidence

### 4.1 Step A (analyst v0.2 + codex v0.3 fix)

- v0.2 LOCK: Q1 (하이브리드 prompt + post-process) / Q2 (plain text + log) / Q3 (target 만, alias 보존)
- codex Mode D Panel review (cycle #1) NEEDS_REVISION 7 finding → master 직접 fix:
  - HIGH #1: log 위치 `wiki/analyses/mention-guard-<date>.md` → `.wikey/mention-guard-<date>.jsonl` (recursive feedback 회피, §5.19 v0.4 Batch 6 학습)
  - HIGH #2: §5.13 source link scope exempt I7 신규 (canonicalizer.ts:592-593 emit `[[X.pdf|원문]]` 보존)
  - MEDIUM #3: evidence path 정정 (resultx → result.md §5.19.7)
  - MEDIUM #4: §5.20 handoff "future extension" 으로 약화
  - MEDIUM #5: baseline 585 통일 + overlap math (53% before overlap, ~24 overlap, ~49% union)
  - LOW #6: Step A spec/todox byte-mirror
  - LOW #7: 신규 parser API I8

### 4.2 Step B (tester RED)

- fixture 5 + test 7 + stub 1 생성
- `npm test -- mention-guard.test.ts` → **7/7 FAIL** (모두 stub `TODO §5.21 Step C` throw — 의도 일치)

### 4.3 Step C (developer GREEN)

- mention-guard.ts 194 LOC 본체 구현 + ingest-pipeline.ts +23 LOC hook
- `npm test -- mention-guard.test.ts` → **7/7 PASS**
- 전체 `npm test` 회귀 → wikey-core 907 PASS / wikey-obsidian 188 PASS (= 1095 PASS)
- `npm run build` → 0 errors / 5 warnings (기존 kiwi-wasm import.meta, 무관)

### 4.4 Step D (Phase 3a 회귀)

- wikey-core: 907 PASS / 3 skipped
- wikey-obsidian: 188 PASS
- 합계: 1095 PASS (이전 session 39 의 1088 PASS + 7 신규 mention-guard test)
- build: 0 errors
- validate-wiki: 458 FAIL (baseline 유지, retroactive cleanup out of scope)

### 4.5 Step E (Phase 3b BLUE refactor)

- mention-guard.ts: 함수 분해 (6 helper, 각 ≤ 30 LOC) + naming consistency + DRY 충족 + magic number 0 + TODO/FIXME 0 → 추가 refactor 불필요
- ingest-pipeline.ts hook: `guardedEntityContent` → `guardedPageContent` (entity/concept 둘 다 적용 명확) + 주석 "Step C 영역" → "for now, deferred" (Step 진행 후 자연화)
- 회귀 재확증: 907 PASS / 0 build errors

### 4.6 Step F (codex post-impl review)

- codex Mode D Panel review (cycle #2) NEEDS_REVISION 4 finding → master 직접 fix:
  - **HIGH**: `.wikey/mention-guard-<date>.jsonl` disk write + `wiki/log.md` summary 미구현 → `persistMentionGuardLog` helper 추가 + appendLog entry 안 `mention-guard: N variations applied` 1 line
  - **MEDIUM #2**: I2 page 존재 확인 없이 무조건 plain text → `existingBases?: ReadonlySet<string>` option 추가 + canonicalize + match 시 canonical wikilink emit
  - **MEDIUM #3**: writtenPages / return payload 가 unguarded content 사용 → `guardedEntities` / `guardedConcepts` Map 으로 guarded content 전파
  - **LOW**: canonicalizer prompt 도 §5.21 hint 추가 (`buildCanonicalizerPrompt` description rule)
- Fix 후 회귀: 907 PASS / 188 PASS / 0 build errors

### 4.7 Step G (master 라이브 CDP smoke)

**환경**: Obsidian 1.12.7 + CDP port 9222 + `obsidian-cdp` skill (wikey-cdp-wrap.sh).

**Baseline measurement** (ingest 전):
- broken: 458 (Session 38 baseline 유지)
- extension wikilink (no-alias `[[X.pdf]]`): 195 (변환 대상)
- source link `|원문` exempt: 195 (canonicalizer.ts:592-593 emit)
- 대문자 wikilink: 0 (§5.19 v0.4 Batch 5 case-insensitive auto-fix 가 cover)

**Cycle 1 — `raw/0_inbox/test-stage3-cobit.md`**:
- Brief: <1s (이미 cached)
- Proceed → Processing: 54s
- Preview: source-cobit-2019-overview (new) + cobit-2019 concept (new) + index.md +6 entries
- Approve & Write: 65s → wiki write 완료
- 결과: `wiki/concepts/cobit-2019.md` 본문 wikilink 0 (mention-guard 변환 대상 0) + `## 출처` 영역 `[[test-stage3-cobit.md|원문]]` 보존 ✓

**Cycle 2 — `raw/0_inbox/Obsidian Web Clipper.md`**:
- Brief: 1s
- Proceed → Processing: 39s
- Preview: source-obsidian-web-clipper (new) + obsidian (entity update) + index.md +5 entries
- Approve & Write: 74s
- 결과: 새 source page `[[obsidian|vault]]` (canonical lowercase + alias 보존) + `## 출처` `[[Obsidian Web Clipper.md|원문]]` 보존 ✓

**Post-ingest measurement**:
- broken: 458 → **447** (-11, 새 entity page 가 기존 broken 일부 satisfied)
- extension wikilink (no-alias): 195 → **195** (추가 0 ✓ — 회귀 0)
- source link `|원문` exempt: 195 → **196** (+1, Obsidian Web Clipper 새 source — **I7 exempt 라이브 보존 확증**)
- 대문자 wikilink: 0 → 0 (회귀 0)

**검증 결론**:
- ✅ pipeline 통합 동작 (entity/concept page write + index/log update + reindex)
- ✅ I7 §5.13 source link 보존 (`|원문` count +1, plain text 변환 0)
- ✅ 추가 broken / extension wikilink 0 (회귀 0)
- ✅ Stage 2 prompt hint (I3) best-effort 효과 — LLM 출력 처음부터 canonical (mention-guard 변환 트리거 0)

**`.wikey/mention-guard-<date>.jsonl` 미생성**: 두 cycle 모두 변환 0 → log entry 0 → 파일 write 조건 (`length > 0`) 미만족. 정상 동작 (단위 test 7/7 PASS 가 변환 발동 시 file write 동작 확증).

## 5. Karpathy 4 원칙 cross-check

| 원칙 | 충족 |
|------|------|
| **Explicit** | log entry per variation (in-memory + disk JSONL when triggered) — 변환 가시화 |
| **Yours** | plain text fallback (filename 단어 보존) + alias 원형 보존 (가독성) — 사용자 인지 보장 |
| **File over app** | pure function (mention-guard.ts 안 I/O 0) + deterministic + idempotent (I6) + `.wikey/` 외부 영속화 |
| **BYOAI** | post-process deterministic — LLM 모델 무관 (prompt hint 는 best-effort 보조) |

## 6. 다음 세션 후속 작업

- **§5.21 self-extension**: 향후 다수 source ingest 실시 후 `.wikey/mention-guard-*.jsonl` 파일 누적 → mention-guard 실 변환 데이터 수집 → AC-S1-1 (extension 195 → 0) 의 실측 cover rate 측정
- **§5.20 Knowledge Gap** (Phase 5 잔여): 근본 원인 2 (mention only 67%, 390건) cover. broken wikilink no-match → knowledge gap candidate surface. §5.20 spec 갱신 영역
- **Phase 5 잔여 6 subject**: §5.5 / §5.6 / §5.8 / §5.9 / §5.20

## 7. 변경 이력

- v0.1 (2026-05-13): §5.21 종결 (Session 40). SDD+TDD 7 Step 모두 통과 + codex 2 cycle review (Step A + Step F) 7+4 finding 모두 master 직접 fix + master 라이브 CDP smoke 2 cycle 통과.
