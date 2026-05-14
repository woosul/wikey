# Phase 5 §5.17 Ingest 분해 결과 밸런싱 calibration — Todo (HOW)

> **상위 문서**: [`docs/planning/phase-5/phase-5-todo.md §5.17`](./phase-5-todo.md) · [`docs/planning/phase-5/phase-5-spec-5.17-ingest-balance-calibration.md`](./phase-5-spec-5.17-ingest-balance-calibration.md)

## 진행 매트릭스 (Step A~G)

- [x] **Step A — analyst v0.2 보강**: ✅ done (2026-05-11). 9 corpus sample 실측 evidence + Q1~Q4 LOCK + spec v0.2 갱신.
- [x] **Step B — tester RED** (2026-05-12): 17 신규 test (T1~T17), 808 PASS 회귀 0.
- [x] **Step C — developer GREEN** (2026-05-12): 4 신규 export (loadPromotionConfig / applyCeilingCap / writePagesWithBatchYield / assessConversionQuality), 825 PASS.
- [x] **Step D — Phase 3a 회귀** (2026-05-12): wikey-core 825 + wikey-obsidian 121 = 946 PASS / build 0 errors.
- [x] **Step E — Phase 3b BLUE** (2026-05-12): 6 활동 self-applied + cycle #2 P2 sweep.
- [x] **Step F — codex post-impl review** (2026-05-12): 3 cycle — #1 NEEDS_REVISION 6 finding → developer fix → #2 NEEDS_REVISION 3 finding → master fix → #3 APPROVE.
- [x] **Step G — obsidian-cdp 라이브 cycle smoke** (2026-05-12): case A 복제본 ingest 59 → 51 cap formula 발화 + latency 180s → 63s (-65%) 확증.

## 의문점 (Step A LOCK — v0.2 2026-05-11)

### Q1: 1,500 char/page 비율은 다른 corpus 도 동일한가? — **LOCK (외부화 + default 유지)**

**측정 결과 (9 corpus sample, body char / pages)**:

| source | raw_B | body_char | pages | char/page |
|--------|------:|----------:|------:|----------:|
| markitdown-guide (case A) | 111,742 | 79,013 | 83 | 952 |
| finetree-rag-solution | 143,511 | 6,158 | 14 | 440 |
| finetree-bot | 116,318 | 5,654 | 10 | 565 |
| pmbok-knowledge-areas | 2,662 | 3,094 | 12 | 258 |
| pmbok-overview | 2,889 | 3,479 | 1 | 3,479 |
| itil-4-overview | 2,388 | 2,707 | 9 | 301 |
| iso-27001-overview | 2,549 | 2,367 | 6 | 394 |
| llm-wiki | 11,985 | 11,789 | 6 | 1,965 |
| smart-factory-briefing (case B) | 16,896 | 842 | 0 | — |

요약 (n=8, pages>0): mean **1,044** · median **503** · stdev 1,132 (heavy skew).

**결론**: 1,500 char/page hardcode 는 case A 한 점에서 derive 한 heuristic — 다른 corpus median 은 503 char/page (작은 corpus 도 분해 mention 多). **그러나 ceiling formula 의 목적은 "outlier cap" 이지 "typical 분해 제한" 이 아니므로 보수적 upper-bound 1,500 default 가 합리적**. 외부화 (`.wikey/promotion-threshold.yaml` 의 `ceiling.charsPerPage` 필드) 로 사용자 조정 가능. analyst.md §4 k anchor 충족 (hardcoded ratio 외부화).

### Q2: HWP case B 는 변환 손실인가 promotion 보수인가? — **LOCK (변환 손실 확증, Spec 3 별 cycle)**

**측정 결과**: smart-factory-briefing (case B) raw 16,896 B → markdown body 842 char (**95% 손실**). 본문 wiki 페이지 (`wiki/sources/source-smart-factory-briefing.md`) 확인 결과 표·필드 구조만 남고 텍스트 내용은 거의 비어 있음 (위치 안내, 일정 표, parentheses 빈 항목 등). promotion gate 가 작동할 본문 자체 부재.

**결론**: 변환 손실이 주원인. Spec 3 별 cycle 분리 (`§5.18 (가칭) HWP/PDF 변환 품질 향상`, Phase 6 candidate). 본 §5.17 안에는 WARN telemetry helper 만 (변환 후 body < 1,000 char + raw > 10 KB 시 Notice — v0.3 spec sync: T16 fixture 842 char 가 ground truth, 500 → 1,000 정정).

### Q3: write batching 시 single fsync vs N fsync — Obsidian Vault API atomic? — **LOCK (per-file atomic 보장, multi-file 미보장)**

**grep 결과**:
- `wikey-obsidian/src/main.ts:1636-1664` `ObsidianWikiFS.write` 가 `vault.modify` (existing) / `vault.create` (new) / `vault.adapter.write` (fallback) 호출. Obsidian 내부적으로 fs tmp+rename 패턴 → **per-file atomic 보장**.
- `vault.adapter.write` 도 same fs adapter 경유 (Obsidian source 확인) — atomic.
- **multi-file atomicity 미보장** — N page sequential 호출 중 cancel/crash 시 partial state 가능. 그러나 §5.3 incremental reingest 가 hash 비교로 다음 호출 시 reconcile.

**결론**: per-file atomic 그대로 활용. tmp+rename 이중 layer 추가 X (Karpathy Simplicity First). batching 의 의미 = "UI thread yield" (every 5~10 pages microtask) — atomic 보장이 아닌 cancellability + responsiveness 목적. I7 (index/log 최종 1회 flush) 명시.

### Q4: "인덱스 갱신 지연 알람" 정확한 string + 발화 조건? — **LOCK (commands.ts:598, reindex timeout)**

**grep 결과**:
- 정확한 string: `'인덱스 갱신 지연'` (라벨) + `' — 잠시 후 검색 가능 ({message.slice(0, 80)})'`. Notice 6 초.
- 위치: `wikey-obsidian/src/commands.ts:598-599`.
- 발화 조건: `onFreshnessIssue(reason, message)` 콜백 호출 시 `reason === 'freshness-timeout'` (vs `'reindex-failed'` 면 `'인덱싱 실패'` 라벨).
- 원인 chain: `ingest-pipeline.ts:2369` 코멘트 "ingest 본체 성공 후에 index lag 은 치명적이지 않음 — warn 레벨 downgrade". `runReindexAndWait` (line 2375+) 가 `reindex.sh --quick` 호출 + `waitUntilFresh` polling — env `WIKEY_REINDEX_TIMEOUT_MS` default 60s, max 300s. 안에서 fresh + stale=0 도달 못 하면 timeout error → onIssue 콜백 → Notice.

**결론**: case B HWP ingest 후 발화한 "인덱스 갱신 지연" = reindex polling timeout (qmd default backend 의 경우 wikilink 추가 분 → wiki 변경 detect → reindex.sh 호출 → 60s 안에 fresh 안 됨). 코드 변경 없음. Spec 2 의 I6/I7 에 reference 만.

## 변경 면 추정 (≤ 120 LOC code + 10 LOC yaml)

- `wikey-core/src/promotion-config.ts` — `PromotionThresholdConfig.ceiling` 필드 (charsPerPage / absolute / mode) + yaml parse + default fallback (≤ 25 LOC).
- `wikey-core/src/canonicalizer.ts` — promotion 적용 시점에 ceiling formula 계산 + cap top-K 선택 (confidence sort, tie-break first-mention-position) + `PromotionDecision` telemetry struct (≤ 35 LOC).
- `wikey-core/src/ingest-pipeline.ts` — write phase batching (microtask yield every N pages) + HWP WARN helper (body < 1,000 char + raw > 10 KB → Notice + log, v0.3 정정) (≤ 110 LOC, P1 integration 포함).
- `.wikey/promotion-threshold.yaml.example` (§5.15.B) — `ceiling` section example (≤ 10 LOC).
- 신규 test 3개 (Step B).

**합계**: ≤ 120 LOC + 10 LOC yaml. Karpathy Surgical Changes 합리.

## Karpathy 4 원칙 cross-check (analyst.md §4 anchor 충족)

| 원칙 | 적용 | 증거 |
|------|------|------|
| Think Before Coding | spec v0.2 Context §0 가 가설 H1/H2/H3 명시 + Step "1" 실측 후 결정 (1500 ratio 외부화 vs 다른 default) | spec §0 |
| Simplicity First | ceiling 은 외부화 default 1500 (코드 const fallback) + count cap 만 + tmp+rename 이중 layer X + WARN helper 단순 if 분기 | spec I1, I5, Spec 3 telemetry |
| Surgical Changes | 변경 면 ≤ 120 LOC + 4 file (promotion-config / canonicalizer / ingest-pipeline / yaml example). 기존 §5.15.B 구조 확장 (재작성 X) | 변경 면 추정 §위 |
| Goal-Driven | 정량 이득 측정 가능 — 분해 5~15 안착 ≥ 80% + write p95 ≤ 60s, master 라이브 smoke Step G 에서 검증 | spec §0 이득 §4 Step G |

**analyst.md §4 (k) "하드코딩 금지 설계 단계부터" anchor**:
- ceiling count cap = LLM 의 *후처리 ranking* 만, entity/concept name list / category mapping / static slug allowlist 0건. ✅
- 1500 char/page ratio = `.wikey/promotion-threshold.yaml.example` 의 `ceiling.charsPerPage` 외부화 + default 1500 코드 const fallback. yaml override 우선. ✅
- 의미론적 판정 (어떤 entity 채택할지) = LLM 자율 (confidence sort + mention position tie-break, 정형 rule X). ✅

## Schema § cross-check

- **§"인제스트 분할 전략" 5~15 권고**: case A 의 83 → 52 cap (1500 default) 는 권고 *상회* 하지만 large source 의 합리 outlier. 사용자 yaml `absolute: 30` 으로 추가 cap 가능. typical mid corpus (llm-wiki 6 page, itil-4 9 page) 는 ceiling 적용 안 됨 (proposed < ceiling). 권고 안 정합.
- **§5.11 v2 (의미 비례)**: ceiling 은 *aggregate count* 만 cap, *개별 mention 채택* 은 LLM 자율 = §5.11 v2 의 "단순 출처/장소/단편 사실은 mention 제외" 원칙 유지. promotion threshold (`default: 2` mention count) 도 그대로.
- **§5.10.4 D-wide LLM-only ontology**: ceiling 은 type 분류 / schema gate / hardcoded category 없음. canonicalizer 의 SLUG_ALIASES + `aliases:` yaml normalization 만 유지. ✅
- **§5.15.B promotion threshold YAML 패턴**: `ceiling` section 추가 — 기존 `default: 2` 와 동일 file. 구조 호환.

## 위험 / 결정 필요

- **위험 1 (1500 default 가 too lenient)**: 9 corpus median 503 char/page → 1500 default 는 typical corpus 에서 ceiling 적용 안 됨 (case A 류 만 cap). 사용자가 더 빡빡한 cap 원하면 yaml `charsPerPage: 800` 설정. **분해 5~15 안착 80% 측정은 Step G master smoke 에서** — 만약 80% 미달이면 default 조정 또는 ceilingMin 8 → 5 검토.
- **위험 2 (write batch yield 가 latency 실제 단축?)**: 현 3분 = page 평균 2.2s. LLM 호출은 이미 끝난 상태 (write phase) — fs write + Obsidian metadata cache 갱신이 병목. microtask yield 가 latency 자체 단축 X, **UI responsiveness 만 개선**. 실제 latency 단축은 Spec 1 의 page 수 감소 (83 → 52, ~37% 감소) 에서 옴. Spec 2 의 p95 ≤ 60s 목표는 *Spec 1 효과 + Spec 2 yield* 합산.
- **결정 필요 (Step C 시점)**:
  - confidence sort tie-break: "first-mention-position" 으로 LOCK 했으나, mention count 가 더 적절한 tie-break 일 가능성. tester RED 단계에서 AC 명시.
  - HWP WARN threshold (body < 1,000 char + raw > 10 KB, v0.3 정정) — heuristic. case B (842 char / 16,896 B) 가 ground truth 로 WARN 발화. Step C 에서 tester fixture 와 정합.

## 변경 이력

- v0.1 (2026-05-11): draft 신규.
- v0.2 (2026-05-11): analyst Step A — Q1~Q4 모두 LOCK, 9 corpus sample 측정 evidence 추가, Karpathy 4 원칙 + schema § cross-check 추가, 변경 면 ≤ 120 LOC 재추정.
- v0.3 (2026-05-11): codex cycle #2 P2 sweep — HWP WARN threshold 500 char → 1,000 char 정정 (3 site: Q2 결론 / 변경 면 추정 / 위험 결정 필요). spec v0.3 sync. ingest-pipeline LOC budget ≤ 50 → ≤ 110 (P1 integration 포함).
