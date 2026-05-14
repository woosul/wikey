---
phase: 5
section: 5.17
title: Ingest 분해 결과 밸런싱 calibration — promotion threshold floor/ceiling + write performance (Spec)
status: draft
created: 2026-05-11
updated: 2026-05-11
version: v0.3
---

# Phase 5 §5.17 Ingest 분해 결과 밸런싱 calibration (Spec, WHAT)

> **상위 문서**: [`docs/planning/phase-5/phase-5-todo.md §5.17`](./phase-5-todo.md) · [`docs/planning/phase-5/phase-5-todox-5.17-ingest-balance-calibration.md`](./phase-5-todox-5.17-ingest-balance-calibration.md)
>
> **버전 이력**: v0.1 (2026-05-11 draft, 사용자 테스트 1-7 두 케이스 양극단 분해 결과 통합) · v0.2 (2026-05-11 analyst Step A — 9 corpus sample 실측 evidence 반영, ratio 외부화, HWP Spec 3 분리) · v0.3 (2026-05-11 developer codex cycle #1 NEEDS_REVISION 6 finding closure — §I1 numeric 정정 / `ceiling.mode` 제거 / LOC budget 갱신 / Spec 3 threshold 명시).

## 0. Context

**도출 source**: 사용자 본체 완성 시점 테스트 (2026-05-11) 보고 1-7.

- **케이스 A (109KB MD, gemini-2.5-flash, 12:30 총)**:
  - 입력: `MarkItDown으로 모든 문서를 마크다운으로 변환하기.md` — registry record `sha256:85e8ca8fef1b74cf`, `size: 111742` bytes (109.1 KB raw), body 79,013 char (frontmatter 제거 후).
  - 결과: source 1 + Entities 64 + Concepts 19 = **83 페이지** (entity+concept frontmatter `sources: [...]` + body wikilink 추적 결과).
  - 비율: **952 char/page** (body 기준) / **1,346 B/page** (raw 기준).
  - 시간: ingest 8:30 (25% / 33% / 42% / 100%) + write 3분.
  - 평가: schema §"인제스트 분할 전략" (5~15 page) + §5.11 v2 (의미 비례) 위반. 과다 분해.
- **케이스 B (스마트공장 보급확산 HWP, sha256:b63bddfadc4cd812, 16,896 B raw)**:
  - 변환 후 markdown body = **842 char** (raw 16,896 B → body 842 char, **95% 손실**). 표 위주 행정 안내문이라 LLM 변환이 본문을 거의 살리지 못함.
  - 결과: source 1 만, Entities/Concepts = 0.
  - "인덱스 갱신 지연" Notice 1회 발화 (Q4 grep 결과: `wikey-obsidian/src/commands.ts:598`, reindex polling timeout).
  - 평가: **변환 손실이 주원인** (842 char 본문에서 의미 있는 entity/concept 추출 곤란). promotion gate 는 정상 작동. → Spec 3 별 cycle 분리.

**근본 원인 가설 검증 (Step A 1) 실측)**:
- H1 (입력 길이 비례 floor 부재 → 과다 분해): **부분 확증**. case A 109KB 가 83 page = 외곽치. 그러나 *다른 large corpus* (finetree-rag 143KB → 14 page / finetree-bot 116KB → 10 page) 는 schema 권고 5~15 안. **즉 case A 의 과다 분해는 source 자체의 entity density 가 높은 특수 케이스 — ceiling 은 "예외적 outlier 안전망" 으로 필요하되, default 가 typical 분해를 막아서는 안 됨**.
- H2 (HWP 변환 손실): **확증** (842 char / 16,896 B raw = 5% 보존). Spec 3 → 별 cycle.
- H3 (write phase O(N) latency): **유효** — case A 83 page 에서 3분, page 당 약 2.2s. batching 으로 단축 여지.

**Step A 1) 9 corpus sample 측정 (raw_B / body_char / pages / body char/page)**:

| source | raw_B | body_char | pages | char/page |
|--------|------:|----------:|------:|----------:|
| markitdown-guide | 111,742 | 79,013 | 83 | 952 |
| finetree-rag-solution | 143,511 | 6,158 | 14 | 440 |
| finetree-bot | 116,318 | 5,654 | 10 | 565 |
| pmbok-knowledge-areas | 2,662 | 3,094 | 12 | 258 |
| pmbok-overview | 2,889 | 3,479 | 1 | 3,479 |
| itil-4-overview | 2,388 | 2,707 | 9 | 301 |
| iso-27001-overview | 2,549 | 2,367 | 6 | 394 |
| llm-wiki | 11,985 | 11,789 | 6 | 1,965 |
| smart-factory-briefing (case B) | 16,896 | 842 | 0 | — |

요약 (n=8, pages>0):
- body char/page mean **1,044** · median **503** · stdev 1,132 (heavy skew, llm-wiki 1965 + pmbok-overview 3479 outlier)
- case A 952 char/page 는 mean 근방.
- raw B/page mean 3,628 · median 1,672.

**해석**:
- v0.1 의 hardcoded 1,500 char/page 가설은 **case A 한 점에서 derive 한 heuristic**. 9 corpus 측정 결과 median 503 char/page — typical corpus 는 더 dense (작은 source 도 분해 mention 多).
- 그러나 median 503 으로 ceiling 좁히면 case A 109KB ceiling = 157 → 의미 없음. 더 중요한 건 **자명한 outlier 만 cap 하는 큰 ceiling**.
- 따라서 default 1,500 char/page 는 *합리적 upper-bound heuristic* (Karpathy Simplicity First). 그러나 **외부화 의무** (`.wikey/promotion-threshold.yaml`) — 코드 hardcode 가 아닌 yaml override 가능.

**이득 (fix 후)**:
- 정량 — source 1개당 entity+concept 분해 page count 가 5~15 (schema 권고) 범위 ≥ 80% 안착 (random 10 source sample). 과다·과소 양극단 분포 ≤ 20%.
- 정량 — write phase latency p95 ≤ 60s / source 1개 (현 3분 대비 5배 향상).
- 정성 — schema §"인제스트 분할 전략" 의 "의미 비례" 원칙 정량 검증 가능.

**Trade-off**:
- promotion threshold ceiling 도입 시 LLM 자율 판정 영역 축소 우려 (Karpathy #2 hardcoding) — *그러나 ratio 외부화 (yaml) + count cap 만 + individual entity 채택은 LLM 그대로* → §5.10.4 D-wide + §5.11 v3 호환 (analyst.md §4 k anchor 충족: hardcoded entity/concept list 0건, ratio 1500 도 yaml override 가능).
- write 병렬화 시 file system race condition + index/log atomic 보장 비용. 본 cycle 은 batch (group N pages → progress yield + final index/log flush) 만 검토, parallel X.

## 1. Specs

### Spec 1: promotion threshold ceiling (의미 비례 outlier cap)

- **Goal**: source 1개 분해 결과의 entity+concept page count 가 input length 에 비례한 합리 upper-bound 안에 수렴. *typical 분해는 LLM 자율*, *outlier (case A 류) 만* cap.
- **Inputs**:
  - `inputCharLen: number` — source markdown body 의 char count (frontmatter 제외).
  - `proposedPages: { entities: ProposalPage[], concepts: ProposalPage[] }` — LLM extractMentions + canonicalizer 산출.
  - `config: PromotionThresholdConfig` — `.wikey/promotion-threshold.yaml` (기존 §5.15.B 구조 확장).
- **Outputs**:
  - `selected: { entities: ProposalPage[], concepts: ProposalPage[] }` — ceiling 적용 후. proposed > ceiling 인 경우 LLM 이 부여한 confidence 또는 mention frequency 내림차순으로 top-K 선택 (tie-break = mention 첫 등장 위치).
  - `decision: PromotionDecision` — `{ inputCharLen, proposedCount, selectedCount, ceiling, charsPerPage, reason }` (telemetry).
- **Invariants**:
  - **I1 (ratio 외부화)**: `ceiling = min(proposedCount, max(ceilingMin, floor(inputCharLen / charsPerPage)))`.
    - `charsPerPage` default = **1,500** (code fallback, 코드 const `DEFAULT_CHARS_PER_PAGE`). 9 corpus 실측 evidence (mean 1,044 / median 503) 보다 보수적 upper-bound — typical 분해를 막지 않고 case A 류 outlier 만 cap.
    - `.wikey/promotion-threshold.yaml` 의 `ceiling.charsPerPage` 가 있으면 override (Karpathy Simplicity First + analyst.md §4 k anchor: hardcoded ratio 외부화).
    - `ceilingMin` default = **8** (5~15 schema 권고 lower-mid).
    - `.wikey/promotion-threshold.yaml` 의 `ceiling.absolute` 가 있으면 `min(absolute, formula)` 로 추가 cap (사용자 강제 hard cap).
    - 케이스 A 실측: `inputCharLen = 79,013` (body chars, frontmatter 제외) → `floor(79013/1500) = 52` → `min(83, max(8, 52)) = 52` → 83 proposed → 52 selected (~37% reduction). `109KB ÷ 1500 ≈ 74` 는 raw bytes 기준 단위 계산이지 invariant 의 `inputCharLen` (body char) 기준이 아님 — v0.3 정정.
    - **`ceiling.mode` 필드 제거 (v0.3)**: `absolute` hard cap 이 이미 `min(absolute, formula)` 로 정의되어 mode 분기 redundant. Karpathy Simplicity First.
  - **I2 (floor = 1 source)**: 분해 0 인 경우에도 source 페이지 1개는 항상 생성. 단, mention 이 충분한데 promotion threshold 가 너무 보수면 WARN 발화 (Step B 의 케이스 B 진단 — case B 는 promotion 보수가 아닌 변환 손실이라 본 invariant 발화 X).
  - **I3 (hardcoded list 0건)**: ceiling/floor 는 *count* 만 제어, 어떤 entity 가 채택될지는 LLM 자율 (§5.11 v3 + §5.10.4 D-wide 정합). entity/concept name list / category mapping / static slug allowlist 0건. analyst.md §4 k anchor 충족.
  - **I4 (config override 우선)**: `.wikey/promotion-threshold.yaml` 의 사용자 설정 > 코드 default (§5.15.B 패턴 유지). yaml 부재 시 default 적용 (regression-safe).
- **Acceptance Scenarios**:
  - **Happy A (case A 109KB)**: input body 79,013 char (실측) → ceiling `min(83, max(8, floor(79013/1500))) = min(83, max(8, 52)) = 52`. 83 proposed → 52 selected. 회귀 비교: 기존 83 vs fix 후 52 (~37% reduction). schema 권고 5~15 *상회* 하지만 typical large source 의 합리 outlier (사용자 본인이 yaml `absolute: 30` 설정하면 추가 cap).
  - **Happy B (typical mid corpus)**: input body 11,789 char (llm-wiki) → ceiling `min(6, max(8, 7)) = 6`. 6 proposed → 6 selected (cap 적용 X, formula `floor(11789/1500)=7` 이지만 proposed 6 이 더 작아 그대로). 정상.
  - **Happy C (small corpus)**: input body 2,707 char (itil-4-overview) → ceiling `min(9, max(8, 1)) = 8`. 9 proposed → 8 selected (cap 1 만 적용, schema 권고 내). ceiling*Min* 이 5~15 권고 lower-mid 를 보장.
  - **Edge (config override absolute)**: `.wikey/promotion-threshold.yaml` 에 `ceiling: { charsPerPage: 1500, absolute: 30 }` → case A 109KB 도 30 cap (사용자 hard limit).
  - **Edge (config override charsPerPage 보수)**: `.wikey/promotion-threshold.yaml` 에 `ceiling: { charsPerPage: 3000 }` → case A 109KB ceiling `floor(79013/3000)=26` → 26 cap (더 빡빡한 cap).

### Spec 2: write phase batching + progress yield (latency p95 cap)

- **Goal**: 분해 결과 page 들의 wiki write 가 sequential N개에서 batched + progress yield 로 변경 — latency p95 ≤ 60s / source.
- **현재 구조** (Step "1" grep 결과, `wikey-obsidian/src/main.ts:1636-1664` `ObsidianWikiFS.write`):
  - 각 page write 마다 `vault.modify` (existing) 또는 `vault.create` (new) 1회 호출. Obsidian 내부적으로 fs tmp+rename atomic write 사용 → **per-file atomic 보장**.
  - **multi-file atomicity 미보장** — N page sequential 호출 중간 cancel / crash 시 partial state 가능.
  - index/log 갱신 (`ingest-pipeline.ts` line 535~688) 은 write loop 끝에 1회.
- **Invariants**:
  - **I5 (per-file atomic 유지)**: Obsidian Vault API (`vault.modify` / `vault.create` / `vault.adapter.write`) 가 per-file atomic 보장하므로 write 자체는 그대로 활용. tmp+rename 추가 layer X (Karpathy Simplicity First — 이중 atomic 불필요).
  - **I6 (batch progress yield)**: page write 매 5~10개마다 `await new Promise(r => setTimeout(r, 0))` 또는 `microtaskQueue.flush()` 로 UI thread yield. 사용자가 cancel 가능. 단위 page 처리 비용 = LLM 호출 0 + fs write 1 → 100ms/page 미만 (현재 sequential 3분 = page LLM 호출 시간 아닌 fs + Obsidian metadata 재인덱싱 비용).
  - **I7 (index/log batch flush)**: index.md / log.md 갱신은 write loop 종료 후 1회 atomic write. 현재도 그러하나 명시 invariant. partial write 후 crash 시 다음 ingest 가 reconcile (§5.3 incremental reingest 와 호환).
  - **I8 (cancel rollback)**: 사용자가 cancel 시 이미 write 된 page 는 wiki/ 에 잔존. partial 상태 → `wiki/log.md` 에 `cancelled` 표시 + 다음 ingest 가 incremental reingest 로 reconcile. 완전 rollback 은 *out of scope* (Karpathy Simplicity First, 그러나 사용자 명시 가능).
- **Acceptance Scenarios**:
  - **Happy (case A 83 → 52 page after Spec 1 cap)**: write phase ≤ 30s (page 52개 × 평균 500ms = 26s, 현 3min 대비).
  - **Cancel during write**: 사용자 cancel 시 wiki/ 의 부분 page 보존 + log.md `cancelled` 표시 + Notice. 다음 ingest 시 incremental reingest 가 hash 비교로 자동 재진입.
  - **Index lag Notice**: 이미 구현되어 있음 (`commands.ts:598-600`). Spec 2 은 메시지 명확화 — `'인덱스 갱신 지연 — N초 후 검색 가능 ({기존 message})'` 으로 estimated time 추가 (optional, Step C 판단).

### Spec 3: HWP 변환 품질 진단 (out of scope flag — 별 cycle 등재)

- **Goal**: case B 의 entity/concept 0 가 promotion gate 문제인지 HWP 변환 손실 문제인지 분리 진단.
- **Step "1" 측정 결과**: 변환 손실이 주원인 (842 char body / 16,896 B raw, 95% 손실). promotion gate 정상.
- **결정**: **별 cycle 분리** — `§5.18 (가칭) HWP/PDF 변환 품질 향상` 후보로 등재 + Phase 6 candidate. 본 §5.17 안에서는:
  - `ingest-pipeline.ts` 의 변환 후 markdown body length 측정 helper 만 추가 (≤ 10 LOC) — telemetry 용. **본문 length < 1,000 char + raw size > 10 KB** 인 경우 WARN log + Notice (`'변환 품질 의심 — 본문 N자 / 원본 NKB'`). 임계 1,000 은 case B 실측 (842 char / 16,896 B raw) ground truth — fixture T16 (842 char) 이 WARN trigger 하도록 정렬 (v0.3 정정; v0.2 의 "500 char" 표기는 codex cycle #1 P2 finding 으로 detect 된 numerical typo 였음).
- **본 cycle inclusion 범위**: WARN telemetry helper 만. 변환 엔진 자체 개선 (unhwp / pdf-parse alternative) 은 Spec 3 의 별 cycle.

## 2. Out of Scope

- HWP unhwp 변환 엔진 자체 개선 (Spec 3 별 cycle 분리, §5.18 후보).
- write phase parallelize (file system race).
- §5.11 v3 paradigm 자체 변경.
- 완전 rollback (cancel 시 written page 삭제) — partial 보존 + incremental reingest reconcile 로 충분.

## 3. Dependencies

- `wikey-core/src/promotion-config.ts` — `PromotionThresholdConfig` 인터페이스에 `ceiling: { charsPerPage?: number; absolute?: number }` 필드 추가 (≤ 75 LOC; v0.3 실측 ~55 LOC). v0.3: `mode?` 필드 제거 (codex cycle #1 P2 finding).
- `wikey-core/src/canonicalizer.ts` — `applyCeilingCap` 신규 export + sort by confidence (≤ 75 LOC; v0.3 실측 ~50 LOC).
- `wikey-core/src/ingest-pipeline.ts` — `applyCeilingCap` 통합 (canonicalizeAndAssembleParsed 직후) + `writePagesWithBatchYield` 신규 export + `assessConversionQuality` 신규 export + body length telemetry (≤ 110 LOC; v0.3 P1 integration 포함).
- `wikey-core/src/incremental-reingest.ts` — index lag alert path 확인됨 (`onFreshnessIssue` → `commands.ts:598` Notice), 코드 변경 없음 (Q4 grep 확인).
- `.wikey/promotion-threshold.yaml.example` (§5.15.B) — `ceiling` section example 추가 (≤ 10 LOC).

**합계 추정 (v0.3)**: ≤ 260 LOC code + 10 LOC yaml example + 신규 test. P1 integration (`applyCeilingCap` ingest 호출 + `writePagesWithBatchYield` sequential write 대체 + `assessConversionQuality` Notice/log) 포함. 변경 면 Karpathy Surgical Changes 합리.

## 4. 진행 순서 (SDD+TDD)

- **Step A — analyst v0.2 보강**: ✅ done (2026-05-11, 본 spec).
- **Step B — tester RED**: `promotion-config.test.ts` (ceiling 계산) + `canonicalizer.test.ts` (cap 적용 + sort) + `ingest-pipeline.test.ts` (batch yield + WARN telemetry) AC 매핑.
- **Step C — developer GREEN**: ceiling/charsPerPage 외부화 + cap 분기 + write batch yield + HWP WARN helper.
- **Step D — Phase 3a 회귀**: npm test / build / validate-wiki.
- **Step E — Phase 3b BLUE**: telemetry decision struct cleanup + 의도적 hardcode 0건 self-check.
- **Step F — codex post-impl review**.
- **Step G — master 라이브 cycle smoke**: case A 109KB MD 재 ingest (분해 52 page 안착 검증) + case B HWP 재 ingest (WARN Notice 발화 검증) + write latency 측정.

## 5. 변경 이력

- v0.1 (2026-05-11): draft 신규.
- v0.2 (2026-05-11): analyst Step A — 9 corpus sample 실측 evidence 반영. (a) 1,500 char/page hardcode → yaml `ceiling.charsPerPage` 외부화 + default 1,500 코드 fallback. (b) ceiling formula 명시 (`min(proposedCount, max(ceilingMin=8, floor(inputCharLen / charsPerPage)))`). (c) HWP case B 변환 손실 진단 — Spec 3 별 cycle 분리, 본 cycle 안에는 WARN telemetry helper 만. (d) Q4 "인덱스 갱신 지연" grep — `commands.ts:598` 확인, 코드 변경 없음. (e) write batching 은 atomic 이중 layer X, microtask yield 만 (Karpathy Simplicity First).
- v0.3 (2026-05-11): developer codex post-impl review cycle #1 NEEDS_REVISION 6 finding closure. (a) **P1 CRITICAL**: `applyCeilingCap` / `writePagesWithBatchYield` / `assessConversionQuality` 3 신규 함수의 ingest 파이프라인 통합 — `canonicalizeAndAssembleParsed` 직후 cap 적용 + sequential write 대체 + WARN telemetry 발화. (b) **P2 threshold**: Spec 3 임계 v0.2 "500 char" 표기 → 1,000 char 로 정정 (T16 fixture 842 char ground truth 기준). (c) **P2 mode 필드 제거**: `PromotionThresholdConfig.ceiling.mode` 폐기 — `absolute` hard cap 으로 redundant. (d) **P2 adapter**: `applyCeilingCap` 통합 시 `WikiPage → ProposalForCeiling` adapter — `confidence = 1` (LLM 미제공) + `mentionPosition = canon array index`. (e) **P3 §I1 numeric**: "109KB ÷ 1500 ≈ 74" → "79,013 char ÷ 1500 ≈ 52" (~37% reduction) 정정. (f) **P3 LOC budget**: `promotion-config ≤ 75 / canonicalizer ≤ 75 / ingest-pipeline ≤ 110` 으로 갱신.
