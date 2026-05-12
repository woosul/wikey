# Phase 5 §5.21 Ingest pipeline mention guard — Todo (HOW)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.21`](./phase-5-todo.md) · [`plan/phase-5/phase-5-spec-5.21-ingest-mention-guard.md`](./phase-5-spec-5.21-ingest-mention-guard.md)
>
> **버전**: v0.4 (2026-05-13) — Spec 3 (mention-only cover) 확장. 사용자 raise "mention-only 도 post-process 로 제거 가능". §5.21 cover ~49% → **~100%** (deterministic).

## 진행 매트릭스 (Step A~G)

- [x] **Step A — analyst v0.2 LOCK + codex review v0.3 fix** (2026-05-13): Q1~Q3 LOCK + Karpathy 4 원칙 cross-check + Spec 1/2 invariants 갱신 (I3/I5/I6/I7/I8 신규 + AC-S1-3/AC-S1-4/AC-S2-3 신규). codex 7 finding (HIGH 2 + MEDIUM 3 + LOW 2) master 직접 fix.
- [x] **Step B — tester RED** (2026-05-13): ingest fixture 5 + AC-S1/S2 7 test case 생성. `npm test -- mention-guard.test.ts` → 7/7 FAIL (stub `TODO §5.21 Step C` throw, 의도 일치).
- [x] **Step C — developer GREEN** (2026-05-13): `wikey-core/src/wiki/mention-guard.ts` 194 LOC + ingest-pipeline.ts +23 LOC hook. 7/7 PASS + 회귀 0 + build 0 errors.
- [x] **Step D — Phase 3a 회귀** (2026-05-13): wikey-core 907 PASS / wikey-obsidian 188 PASS / build 0 / validate-wiki 458 baseline 유지.
- [x] **Step E — Phase 3b BLUE** (2026-05-13): helper rename (guardedEntityContent → guardedPageContent) + 주석 정리. 추가 refactor 불필요 (함수 ≤ 30 LOC / DRY / magic number 0).
- [x] **Step F — codex post-impl review** (2026-05-13): cycle #2 NEEDS_REVISION 4 finding (HIGH 1 + MEDIUM 2 + LOW 1) master 직접 fix. `.wikey/mention-guard-<date>.jsonl` disk write 추가 + I2 existingBases option + guarded content propagation + canonicalizer prompt hint.
- [x] **Step G — master 라이브 smoke** (2026-05-13): CDP 2 cycle (cobit + Obsidian Web Clipper) PASS. broken 458 → 447 (-11), extension no-alias 195 baseline 유지 (회귀 0), source link 원문 exempt 195 → 196 (I7 보존 확증).

## LOCK 결정 v0.2 (Step A 산출, 2026-05-13)

### Q1 (위치) — **하이브리드** (prompt hint + post-process deterministic guard)

- Stage 2 system prompt 끝 "raw filename / file extension wikilink 금지, canonical slug 사용" 1 문장 hint (≤ 30 토큰)
- post-process mention-guard.ts 가 단일 진실 (deterministic safety net)
- 근거: post-process 단독 = 토큰 낭비 / prompt 단독 = BYOAI 위반 (모델별 drift) / 하이브리드 = best-effort 감소 + deterministic guarantee

### Q2 (강도) — **plain text 변환 + log 기록**

- `[[X.pdf]]` → `X.pdf` (단어 보존)
- mention-guard log entry: `{ phase: 'ingest', sourceSha, page, original, transformed, reason }` JSON line per variation
- **log 위치 v0.3 변경 (recursive feedback 회피)**: `.wikey/mention-guard-<YYYY-MM-DD>.jsonl` (vault `.wikey/` hidden dir, **wiki/ 외부**) — JSON line append. `wiki/log.md` ingest summary 안 mention-guard 1 line append (`mention-guard: N variations applied`, **raw `[[X]]` 미포함 텍스트만**). 학습: §5.19 v0.4 Batch 6 `wiki/analyses/wiki-check-<date>.md` 안 raw `[[X]]` → 11,271 recursive broken loop.
- 근거: 완전 제거 = 정보 손실 / warning only = AC-S1-1 미달성 / plain text + log = Karpathy "Yours" (사용자 인지) + "Explicit" (변환 가시화)

### Q3 (canonicalizer scope) — **target 만 (alias 보존)**

- `[[GPT-4o|GPT-4o]]` → `[[gpt-4o|GPT-4o]]` (target lowercase, alias 원형)
- canonicalizer 호출 site = wikilink target 1 위치만. alias 영역 호출 금지 (가드)
- 근거: alias = display label (Obsidian 표준) / Karpathy "Yours" (가독성 보존) / link 매칭은 target slug 기반

### Karpathy 4 원칙 cross-check

| 원칙 | Q1 | Q2 | Q3 |
|------|-----|-----|-----|
| Explicit | post-process + log = 변환 가시화 | log entry = silent 변환 X | canonical slug 가시화 |
| Yours | 사용자 인지 보존 | 본문 단어 보존 | alias display 가독성 |
| File over app | post-process deterministic | 결과 stable | canonicalize 멱등 |
| BYOAI | post-process = 모델 무관 | log 형식 = 프로바이더 독립 | canonicalizer = pure |

4 원칙 모두 충족, paradigm violation 0.

## 변경 면 추정 (v0.3 갱신)

- 신규 file: `wikey-core/src/wiki/mention-guard.ts` (≤ **250 LOC** — v0.3 상향, scope exempt + 신규 parser 추가) — I1/I2/I4/I5/I6/I7/I8 + log entry 생성 + `parseWikilinksWithRanges` 신규 parser
- 신규 test: `wikey-core/src/__tests__/mention-guard.test.ts` + ingest fixture **5** (raw .md / raw .pdf / mixed case alias / mixed case no alias / **§5.13 source link exempt** — `## 출처` 영역)
- 기존 edit:
  - `wikey-core/src/ingest-pipeline.ts` Stage 2 prompt hint 추가 (≤ 5 LOC) + post-process hook (≤ 20 LOC)
  - `wiki/log.md` ingest entry format 확장 (mention-guard summary 1 line, **raw `[[X]]` 미포함 텍스트만**, §5.11 v2 ingest log format 안)
- 신규 (vault metadata):
  - `.wikey/mention-guard-<YYYY-MM-DD>.jsonl` — wiki/ **외부** hidden dir, JSON line append (recursive feedback 회피)

## 다음 Step (Step B tester RED)

Step A LOCK + codex v0.3 fix 완료. 다음 Step B 진행 가능. tester RED prompt 작성 시 의무 포함:

1. fixture **5** (raw filename .md / .pdf / mixed case + alias / mixed case no alias / **§5.13 source link `## 출처` exempt**) Markdown 생성
2. AC-S1-1 (extension 195 → 0) / AC-S1-2 (plain text 단어 존재) / AC-S1-3 (log entry JSON 형식 + `.wikey/` 경로 검증) / **AC-S1-4 (§5.13 source link exempt, `[[sample.pdf|원문]]` 변환 0)** / AC-S2-1 (case 116 → 0) / AC-S2-2 (target lowercase + alias 원형) / AC-S2-3 (idempotent byte-identical) **7 test case**
3. mention-guard.ts API signature 제안 — `parseWikilinksWithRanges(content)` returning `{ original, target, alias, range }[]` + `applyMentionGuard(content, options)` returning `{ content, log }`
4. RED 단계 = test 작성 + npm test FAIL 확증 (GREEN 단계 = developer 영역)

## 변경 이력

- v0.1 (2026-05-12): draft 신규.
- v0.2 (2026-05-13): Step A LOCK. Q1/Q2/Q3 결정 + 근거 + Karpathy 4 원칙 cross-check 추가. 변경 면 추정 갱신 (fixture 4, AC 6, prompt hint + log entry 신규). Step A 체크박스 [x]. Step B 진행 가능 명시.
- v0.3 (2026-05-13): codex Mode D Panel review NEEDS_REVISION 7 finding (HIGH 2 + MEDIUM 3 + LOW 2) master 직접 fix. log 위치 `.wikey/` 외부 변경 (HIGH-1 recursive feedback 회피) / §5.13 source link scope exempt I7 신규 (HIGH-2) / fixture 5 + AC 7 / 신규 parser API I8 / LOC 한계 200 → 250 / `wiki/log.md` summary raw `[[X]]` 미포함 명시.
- v0.4 (2026-05-13): **사용자 raise — mention-only (67%, 390건) 도 post-process 로 cover 가능**. Spec 3 신규 (I9/I10 + AC-S3-1~3). reason enum 에 `'mention-only'` 추가. classifyLink default 분기 확장 — 모든 wikilink target 의 canonicalize 결과가 existingBases 미존재 시 plain text. existingBases scope 확장 — 이번 ingest set ∪ vault 기존 wiki/entities + wiki/concepts + wiki/sources (ingest-pipeline.ts existingEntityBases/existingConceptBases 재사용 + 신규 existingSourceBases). fixture 6 (mention-only) + test 3 (AC-S3-1~3) sweep 의무. cover 비율 ~49% → ~100% (deterministic).
