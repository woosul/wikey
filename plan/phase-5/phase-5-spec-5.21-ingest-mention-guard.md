---
phase: 5
section: 5.21
title: Ingest pipeline mention guard — broken wikilink 근본 원인 1+3 fix (Spec)
status: draft
created: 2026-05-12
updated: 2026-05-13
version: v0.3
---

# Phase 5 §5.21 Ingest pipeline mention guard (Spec, WHAT)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.21`](./phase-5-todo.md) · [`plan/phase-5/phase-5-todox-5.21-ingest-mention-guard.md`](./phase-5-todox-5.21-ingest-mention-guard.md)

## 0. Context

**도출 source**: §5.19 v0.4 세션 마지막 broken wikilink **585건 (de-duped)** 철저 분석 — 3 근본 원인 (Session 38, 2026-05-12). Evidence 위치: [`activity/phase-5/phase-5-result.md §5.19.7`](../../activity/phase-5/phase-5-result.md) (라인 ~4188+ "세션 마지막 broken wikilink 철저 분석").

**근본 원인 분포** (baseline = 585 de-duped):

| Category | Count | % | 근본 원인 |
|----------|-------|---|----------|
| normal ASCII slug | 390 | **67%** | mention only, entity page 생성 누락 (promotion threshold 미통과) — 근본 원인 2 |
| 파일 확장자 포함 (`.md`/`.pdf`) | 195 | **33%** | raw source filename 그대로 wikilink — 근본 원인 1 |
| 대문자 차이 | 116 | **20%** | case-insensitive inconsistency — 근본 원인 3 |

> **카테고리 overlap 주의**: 위 % 합은 wikilink 1건이 여러 카테고리에 동시 속할 수 있어 100% 초과 (예: `[[GPT-4o.pdf]]` = 확장자 + 대문자). 근본 원인 1+3 합 = 195+116 = 311 (53% before overlap). 실제 cover 는 union 으로 311 − overlap (extension ∩ uppercase ≈ 24 추정) ≈ 287 (~49%). spec 의 "49% 감소 예상" 은 union 기반 추정치.

### §5.21 cover scope

- **근본 원인 1 (33%, 195건)**: ingest pipeline mention stage 에서 raw filename → wiki slug 변환 강제 + file extension 포함 wikilink reject
- **근본 원인 3 (20%, 116건)**: LLM ingest 출력 의 wikilink 본문 canonicalizer 호출 강제 (case-insensitive normalize)

### Out of Scope (§5.21)

- **근본 원인 2 (67%, 390건)**: mention only + promotion 미통과 entity = **future §5.20 extension**. 현재 §5.20 spec 은 query log 기반 knowledge gap 만 cover — broken wikilink no-match candidates 추가는 §5.20 v0.3 후속 작업 (별 cycle, §5.21 종결 후 §5.20 spec 갱신 영역).
- §5.19 wiki-check 의 cleanup detect (이미 종결 — 본 §5.21 은 *예방* 측면).
- **canonicalizer `## 출처` 영역의 raw source link (§5.13)** — `[[<rawSourceFilename>|원문]]` 형식은 canonicalizer 가 의도적으로 emit (canonicalizer.ts:592-593). mention-guard scope 외 (HIGH-2 exempt, §1.7 참조).

## 1. Specs

### Spec 1: Raw filename → slug 변환 (근본 원인 1)

- **Goal**: ingest pipeline 의 LLM mention stage 출력 중 wikilink target 이 raw filename (`.md`/`.pdf`/`.hwp`/공백 포함) 형식이면 자동 reject 또는 slug-ify. **Scope**: LLM 이 생성하는 entity / concept page body prose (= LLM mention 본문). **§5.13 source link 영역 (`## 출처` 안의 `[[<rawSourceFilename>|원문]]`) 은 exempt** — canonicalizer.ts:592-593 가 deterministic 으로 emit (의도적 raw filename link).
- **Invariants** (v0.3 LOCK 반영):
  - I1 (extension reject — post-process deterministic): file extension (`.md`/`.pdf`/`.hwp`/`.docx`/`.pptx`/`.txt`) 포함 wikilink target → **plain text 변환** (`[[X.pdf]]` → `X.pdf`) + mention-guard log 기록. wikilink 완전 제거 X (정보 손실 회피).
  - I2 (slug-ify): 공백 + 한글 + 특수문자 포함 raw filename 형태 wikilink → canonicalizer slug 변환 후 page 존재 확인 + 미존재 시 **plain text 변환** (I1 과 동일 강도).
  - I3 (prompt-level hint): ingest pipeline Stage 2 prompt 에 "raw filename / file extension 포함 wikilink 금지, canonical slug 사용" 1 문장 추가 (발생률 감소 — best effort, deterministic guarantee 는 I1/I2 post-process 가 담당).
  - I7 (scope exempt — 신규 v0.3): mention-guard 는 page body prose 영역만 가드. `## 출처` 섹션 + `[[<X>|원문]]` 형식 (alias = "원문") + frontmatter `sources:` field 는 통과. 구현: applyMentionGuard 가 `## 출처` heading 까지의 본문만 transform (`## 출처` 이후 raw exempt) + alias === "원문" 일 때 short-circuit return.
- **Acceptance**:
  - **AC-S1-1**: §5.19 broken category "파일 확장자 포함" 195건 → 0 (인제스트 직후 plain text 변환).
  - **AC-S1-2**: 신규 ingest test fixture (raw filename mention) → 결과 wiki page 본문에 해당 wikilink 0건 + plain text 단어 존재 (사용자 인지 보존).
  - **AC-S1-3**: mention-guard log entry 형식 = `{ phase: 'ingest', sourceSha: <sha>, page: <path>, original: '[[X.pdf]]', transformed: 'X.pdf', reason: 'extension|raw-filename' }` JSON line per variation. **저장 위치 = `.wikey/mention-guard-<YYYY-MM-DD>.jsonl`** (wiki/ 외부, recursive feedback 회피 — §5.19 v0.4 Batch 6 학습).
  - **AC-S1-4 (신규 v0.3)**: `## 출처` 섹션의 `[[sample.pdf|원문]]` (canonicalizer.ts emit) → fixture 통과 (mention-guard 변환 0). idempotent.

### Spec 2: Canonicalizer wikilink normalize (근본 원인 3)

- **Goal**: LLM ingest 출력 의 wikilink **target 만** (`[[X]]` 의 X, `[[X|alias]]` 의 X) canonicalizer `canonicalizeSlug` 호출하여 case-insensitive normalize 강제. **alias 영역 (display label) 은 보존**. Scope = Spec 1 과 동일 (I7).
- **Invariants** (v0.3 LOCK 반영):
  - I4 (target normalize): `[[GPT-4o]]` → `[[gpt-4o]]` (canonical slug). SLUG_ALIASES + `.wikey/schema.yaml` aliases merge 적용.
  - I5 (alias preserve): `[[GPT-4o|GPT-4o]]` → `[[gpt-4o|GPT-4o]]` (target = canonical, alias = display 원형 보존, 사용자 가독성 위반 X).
  - I6 (idempotent): 같은 source 재 ingest 시 wikilink 동일 결과 (canonicalize 멱등).
  - I8 (parser — 신규 v0.3): `extractWikilinks` (`wiki-ops.ts:488`) dedup + target only 한계 회피 위해 mention-guard.ts 안 신규 parser `parseWikilinksWithRanges` 추가 — `{ original, target, alias, range: [start, end] }[]` 반환. `WIKILINK_RE` 동일 정규식 재사용 + match offset 보존.
- **Acceptance**:
  - **AC-S2-1**: §5.19 broken category "대문자 차이" 116건 → 0 (canonicalize 후 자체 페이지 매치).
  - **AC-S2-2**: ingest test fixture (mixed case mention) → 결과 wikilink **target 모두 lowercase canonical**, alias 는 원형 보존.
  - **AC-S2-3**: idempotent — 동일 fixture 2회 ingest → wikilink 본문 byte-identical.

## 1.5 의문점 LOCK 결정 v0.2 (Step A, 2026-05-13)

### Q1 (위치): **하이브리드 — prompt-level hint + post-process deterministic guard**

**결정**: Stage 2 prompt 에 "raw filename / file extension wikilink 금지" 1 문장 hint (I3) + post-process mention-guard 가 deterministic safety net (I1/I2). post-process 가 단일 진실 (final invariant guarantor).

**근거**:
1. **post-process 단독 한계**: LLM 이 매 ingest 마다 raw filename wikilink 를 계속 생성 → 토큰 낭비 + post-process 가 매번 정리. prompt hint 로 발생률 감소 = 토큰 효율 개선.
2. **prompt-only 단독 한계**: LLM drift 위험 (모델별 효과 다름). Claude / GPT / Gemini 가 hint 무시 가능. → **BYOAI 원칙 위반** (모델 교체 시 effect 가변).
3. **하이브리드 = 두 layer 보완**: prompt = best-effort 발생 감소 / post-process = deterministic guarantee. BYOAI 안전 (post-process 가 모델 무관 deterministic).
4. **Karpathy "File over app"**: post-process deterministic → 매 ingest 동일 결과 (idempotent). prompt 만 의존 시 결과 변동.

**구현 분리**:
- prompt hint = `wikey-core/src/ingest-pipeline.ts` Stage 2 system prompt 끝 1 문장 (≤ 30 토큰 추가)
- post-process guard = 신규 `wikey-core/src/wiki/mention-guard.ts` (Stage 2 output parse → wikilink scan → I1/I2 적용)

### Q2 (강도): **plain text 변환 + mention-guard log 기록**

**결정**: file extension / raw filename / canonicalize 후 미존재 page wikilink → **plain text 변환** (`[[X.pdf]]` → `X.pdf`) + mention-guard log entry 1 line (JSON, Spec 1 AC-S1-3 형식). wikilink 완전 제거 / warning only / silent skip 모두 기각.

**근거**:
1. **완전 제거 기각** = 정보 손실. LLM 이 의도한 reference 가 본문에서 사라짐. 사용자가 "이게 source 였다" 인지 불가.
2. **warning log only 기각** = 본문에 wikilink 그대로 남음 → §5.19 broken 595건 변화 없음. AC-S1-1 (195건 → 0) 미달성.
3. **plain text 변환 채택**:
   - Karpathy "Yours": 본문에 `X.pdf` 단어 남음 → 사용자가 vault 내 source 인지 가능 (§5.19 분석 일치).
   - AC-S1-1 (wikilink 0건) 달성 + 정보 보존 동시 충족.
4. **mention-guard log 의무**:
   - Karpathy "Explicit": silent 변환 = LLM 지식의 변형이 사용자에게 invisible → explicit 원칙 위반.
   - log entry 로 변환 사실 가시화 (master / 사용자 inspect 가능).
   - **log 위치 (v0.3 변경 — recursive feedback 회피)**: `.wikey/mention-guard-<YYYY-MM-DD>.jsonl` (vault `.wikey/` hidden dir, **wiki/ 외부**) — JSON line append. 또한 `wiki/log.md` ingest summary 안 mention-guard 1 line append (`mention-guard: N variations applied` 형식, **raw `[[X.pdf]]` 단어 미포함** — 텍스트만). 상세 JSON 은 `.wikey/` 안 (wiki scanner 가 `.wikey/` 스킵 — 기존 `WikiFS.walk` exclusion 확증 필요, §5.19 v0.4 Batch 6 학습: `wiki/analyses/` 안 raw `[[X]]` → 11,271 recursive broken loop).

### Q3 (canonicalizer scope): **target 만 (alias 보존)**

**결정**: wikilink `[[target|alias]]` 의 **target** 만 `canonicalizeSlug` 호출. **alias** (display label) 는 원형 보존. `[[GPT-4o|GPT-4o]]` → `[[gpt-4o|GPT-4o]]`.

**근거**:
1. **alias = display label**: Obsidian 표준 `[[target|display]]` shape. alias 는 사용자 가독성 위한 표시 텍스트.
2. **Karpathy "Yours"**: alias lowercase 변환 = 사용자 화면 가독성 손상 ("gpt-4o" vs "GPT-4o"). 사용자 소유 자산의 가독성 위반.
3. **AC-S2-2 명확화**: "lowercase canonical" = wikilink target 의미. alias 영역은 spec scope 외.
4. **target 만 normalize 의 충분성**: link 매칭은 target slug 기반 (`wiki/concepts/gpt-4o.md` 매치). alias 는 매칭 무관 (display only).
5. **Spec 2 I5 신규 추가**: 명시적 alias preserve invariant — 구현 시 canonicalizer 호출 site 가 target / alias 둘 다 normalize 하지 않도록 가드.

## 1.7 codex Mode D Panel Review fix (v0.3, 2026-05-13)

codex review (NEEDS_REVISION, 7 finding) 의 7 issue master 직접 fix 반영:

| # | Severity | Issue | Fix 위치 |
|---|----------|-------|----------|
| 1 | HIGH | mention-guard log 안 raw `[[X.pdf]]` → §5.19 recursive feedback 재발 위험 (11,271 broken 학습) | §1.5 Q2 + AC-S1-3 — log 위치를 `.wikey/mention-guard-<date>.jsonl` (wiki/ 외부) 로 변경. `wiki/log.md` summary 는 raw `[[X]]` 미포함 텍스트만. |
| 2 | HIGH | canonicalizer.ts:592-593 가 emit 하는 `[[<rawSourceFilename>|원문]]` (§5.13 source link) 과 충돌 | Spec 1 Goal scope 명시 + I7 신규 + AC-S1-4 신규 — `## 출처` 섹션 + alias === "원문" exempt |
| 3 | MEDIUM | P1 evidence path mismatch (resultx 가 아닌 `phase-5-result.md §5.19.7`) | §0 Context — evidence path 정정 + 라인 ~4188+ 명시 |
| 4 | MEDIUM | §5.20 handoff: 현재 §5.20 spec 은 query log only, broken wikilink candidate 미명시 | §0 Out of Scope — "future §5.20 extension" 으로 약화. §5.20 spec 수정은 별 cycle |
| 5 | MEDIUM | numeric drift — 585 vs 595 baseline / 49% vs 53% | §0 Context — baseline 585 통일 + overlap math 명시 (53% before overlap, ~24 overlap, ~49% union) |
| 6 | LOW | spec Step A vs todox mirror drift (AC-S2-3 누락) | §4 Step A — AC-S2-3 추가 + todox 와 byte-mirror (§4 갱신 + v0.3 변경 이력) |
| 7 | LOW | `extractWikilinks` dedup + target only → alias/offset/original 손실 | Spec 2 I8 신규 — mention-guard.ts 안 `parseWikilinksWithRanges` 신규 parser API 명시 |

## 1.6 Karpathy 4 원칙 cross-check (v0.2)

| 원칙 | Q1 (하이브리드) | Q2 (plain text + log) | Q3 (target 만) |
|------|-----------------|------------------------|----------------|
| **Explicit** | ✅ post-process + log = 변환 가시화 | ✅ log entry = silent 변환 X | ✅ canonical slug 가시화 |
| **Yours** | ✅ 사용자 인지 보존 (plain text) | ✅ 본문 단어 보존 | ✅ alias display 가독성 보존 |
| **File over app** | ✅ post-process deterministic → idempotent | ✅ 변환 결과 stable | ✅ canonicalize 멱등 (I6) |
| **BYOAI** | ✅ post-process = 모델 무관 deterministic | ✅ log 형식 = 프로바이더 독립 | ✅ canonicalizer = pure function (LLM 무관) |

**결론**: v0.2 LOCK 4 원칙 모두 충족. paradigm violation 없음.

## 2. Out of Scope

- 근본 원인 2 (mention only entity, 67%) — **future §5.20 extension** (별 cycle). 현재 §5.20 spec 갱신 X.
- Stub page 자동 생성 (promotion 미통과 entity 의 plain text 변환만, page 생성 X) — §5.20 candidate.
- 기존 wiki/ 의 broken wikilink retroactive cleanup — §5.19 wiki-recovery Fix link 가 cover.
- mention-guard log UI 시각화 (Help / Dashboard panel surface) — v0.3 LOCK 범위 외, future cycle.
- **§5.13 raw source link (`## 출처`) 영역** — canonicalizer.ts:592-593 가 deterministic 으로 emit 하는 `[[<rawSourceFilename>|원문]]` 형식은 mention-guard scope 외 (I7 exempt).

## 3. Dependencies

- `wikey-core/src/ingest-pipeline.ts` — Stage 2 prompt hint 추가 + Stage 2 output post-process hook (≤ 20 LOC)
- `wikey-core/src/canonicalizer.ts` — `canonicalizeSlug` 재사용 (변경 0)
- `wikey-core/src/wiki-ops.ts` — `extractWikilinks` (`:488`) **재사용 불가** (dedup + target only — alias/offset/original 손실, codex LOW #7). mention-guard.ts 안 신규 parser `parseWikilinksWithRanges` 추가 (`WIKILINK_RE` 정규식 재사용 + match offset 보존, I8).
- 신규 `wikey-core/src/wiki/mention-guard.ts` (≤ 250 LOC, v0.3 한계 상향) — I1/I2/I4/I5/I6/I7/I8 구현 + log entry 생성 + scope exempt 가드
- 신규 test fixture: ingest raw filename + mixed case mention + `## 출처` exempt (≤ 5 fixture markdown)
- `wiki/log.md` append 1 line per ingest (mention-guard summary, **raw `[[X]]` 미포함 텍스트만**) — §5.11 v2 ingest log format 확장
- **신규 (vault metadata)**: `.wikey/mention-guard-<YYYY-MM-DD>.jsonl` — wiki/ 외부 hidden dir, JSON line append (recursive feedback 회피)

## 4. 진행 순서 (SDD+TDD)

- **Step A (analyst v0.2 LOCK + codex review v0.3 fix)** ✅ 2026-05-13: Q1/Q2/Q3 LOCK + Karpathy 4 원칙 cross-check + Spec 1/2 invariants 갱신 (I3/I5/I6 신규 + AC-S1-3 신규) + codex Mode D Panel review NEEDS_REVISION 7 finding master 직접 fix → v0.3 (I7/I8 신규 + AC-S1-4 신규 + log 위치 `.wikey/` 외부 변경 + scope exempt + evidence path 정정 + baseline overlap math)
- **Step B (tester RED)**: ingest fixture 5 case (raw filename .md / raw filename .pdf / mixed case alias / mixed case no alias / **§5.13 source link exempt**) + AC-S1-1/S1-2/S1-3/**S1-4**/S2-1/S2-2/S2-3 **7 test case**
- **Step C (developer GREEN)**: `wikey-core/src/wiki/mention-guard.ts` 신규 (I1/I2/I4/I5/I6/I7/I8 + `parseWikilinksWithRanges` parser + scope exempt 가드) + `ingest-pipeline.ts` Stage 2 prompt hint (I3) + post-process hook
- **Step D — Phase 3a 회귀**
- **Step E — Phase 3b BLUE** (mention-guard.ts function 분해 검토 / naming / 중복)
- **Step F — codex post-impl review** (Mode D Panel)
- **Step G (master 라이브 smoke)**: 실 source 재 ingest → broken wikilink 결과 측정 (§5.19 baseline 585 → 예상 union ~298, 근본 원인 1+3 합 ~49% 감소 — 311 minus overlap ~24)

## 5. 변경 이력

- v0.1 (2026-05-12): draft 신규. §5.19 분석 결과 (3 근본 원인) cross-link. §5.20 와 책임 분리 (mention only entity = §5.20).
- v0.2 (2026-05-13): Step A LOCK. Q1 (하이브리드) / Q2 (plain text + log) / Q3 (target 만) 결정 + 근거 + Karpathy 4 원칙 cross-check (§1.6). Spec 1 invariants 갱신 (I1 plain text 명시 / I3 prompt hint 신규) + AC-S1-3 신규 (mention-guard log entry 형식). Spec 2 invariants 갱신 (I4 → I4/I5/I6 분리, alias preserve 명시) + AC-S2-3 신규 (idempotent). Out of Scope 4번째 추가 (mention-guard log UI). Dependencies 갱신 (log.md append + analyses page 누적). Step A 종결 표기.
- v0.3 (2026-05-13): codex Mode D Panel review NEEDS_REVISION 7 finding (HIGH 2 + MEDIUM 3 + LOW 2) master 직접 fix. (1) HIGH-1 recursive feedback 회피 — log 위치 `wiki/analyses/mention-guard-<date>.md` → `.wikey/mention-guard-<date>.jsonl` (wiki/ 외부); `wiki/log.md` summary 는 raw `[[X]]` 미포함 텍스트만 (§1.5 Q2 + AC-S1-3 갱신). (2) HIGH-2 §5.13 source link 충돌 회피 — Spec 1 Goal scope 명시 + I7 신규 (scope exempt) + AC-S1-4 신규 (`## 출처` exempt fixture). (3) MEDIUM-3 evidence path 정정 — `phase-5-result.md §5.19.7` (~4188+) 로 변경. (4) MEDIUM-4 §5.20 handoff wording "future §5.20 extension" 으로 약화. (5) MEDIUM-5 baseline 585 통일 + overlap math 명시 (53% before overlap, ~24 overlap, ~49% union). (6) LOW-6 Step A byte-mirror — spec § 4 AC-S2-3 명시 + todox v0.3 mirror. (7) LOW-7 신규 parser API I8 (`parseWikilinksWithRanges` returning `{ original, target, alias, range }`). Dependencies 갱신 (wiki-ops.ts:488 재사용 불가 명시). mention-guard.ts LOC 한계 200 → 250 (scope exempt + parser 추가).
