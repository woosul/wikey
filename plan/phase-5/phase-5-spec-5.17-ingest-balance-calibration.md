---
phase: 5
section: 5.17
title: Ingest 분해 결과 밸런싱 calibration — promotion threshold floor/ceiling + write performance (Spec)
status: draft
created: 2026-05-11
updated: 2026-05-11
version: v0.1
---

# Phase 5 §5.17 Ingest 분해 결과 밸런싱 calibration (Spec, WHAT)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.17`](./phase-5-todo.md) · [`plan/phase-5/phase-5-todox-5.17-ingest-balance-calibration.md`](./phase-5-todox-5.17-ingest-balance-calibration.md)
>
> **버전 이력**: v0.1 (2026-05-11 draft, 사용자 테스트 1-7 두 케이스 양극단 분해 결과 통합).

## 0. Context

**도출 source**: 사용자 본체 완성 시점 테스트 (2026-05-11) 보고 1-7.

- **케이스 A (109KB MD, gemini-2.5-flash, 12:30 총)**:
  - 입력: `MarkItDown으로 모든 문서를 마크다운으로 변환하기.md` (109 KB).
  - 결과: source 1 + Entities 64 + Concepts 19 = **83 페이지**.
  - 시간: ingest 8:30 (25% / 33% / 42% / 100%) + write 3분.
  - 평가: schema §"인제스트 분할 전략" (5~15 page) + §5.11 v2 (의미 비례) 위반. 과다 분해.
- **케이스 B (스마트공장 보급확산 HWP)**:
  - 결과: source 1 만, Entities/Concepts = 0.
  - "index 갱신 지연 알람" 1회. write 1분+.
  - 평가: promotion gate 과보수 + unhwp 변환 품질 손실 의심.

**근본 원인 가설** (Step A 보강 시 검증):
- H1: §5.11 v2 promotion threshold 가 input length 에 비례 가산 없음 → 긴 source 에 floor 부재 → 과다 분해.
- H2: HWP 변환 결과 markdown 본문 손실 → LLM 이 mention 추출 자체 실패.
- H3: write phase sequential write (Karpathy #2 의도적 simplicity) 가 83 page 에서 O(N) latency.

**이득 (fix 후)**:
- 정량 — source 1개당 entity+concept 분해 page count 가 5~15 (schema 권고) 범위 ≥ 80% 안착 (random 10 source sample). 과다·과소 양극단 분포 ≤ 20%.
- 정량 — write phase latency p95 ≤ 60s / source 1개 (현 3분 대비 5배 향상).
- 정성 — schema §"인제스트 분할 전략" 의 "의미 비례" 원칙 정량 검증 가능.

**Trade-off**:
- promotion threshold floor/ceiling 도입 시 LLM 자율 판정 영역 축소 (Karpathy #2 hardcoding 우려) — 단, *aggregate cap* 만 제한하고 individual entity 채택은 LLM 그대로 유지 → §5.11 v3 paradigm 호환.
- write 병렬화 시 file system race condition + index/log atomic 보장 비용. § 본 cycle 은 batch (group N pages → 1 atomic write) 만 검토, 병렬 X.

## 1. Specs

### Spec 1: promotion threshold floor + ceiling (의미 비례 cap)

- **Goal**: source 1개 분해 결과의 entity+concept page count 가 input length / token count 에 비례한 합리 range 안으로 수렴.
- **Inputs**:
  - `inputCharLen: number` — source markdown body 의 char count (frontmatter 제외).
  - `proposedPages: { entities: ProposalPage[], concepts: ProposalPage[] }` — LLM extractMentions + canonicalizer 산출.
  - `config: PromotionThresholdConfig` — `.wikey/promotion-threshold.yaml` (기존 §5.15.B 구조 확장).
- **Outputs**:
  - `selected: { entities: ProposalPage[], concepts: ProposalPage[] }` — floor / ceiling 적용 후.
  - `decision: PromotionDecision` — `{ inputCharLen, proposedCount, selectedCount, ceiling, floor, reason }` (telemetry).
- **Invariants**:
  - I1: ceiling = `min(proposedCount, max(8, floor(inputCharLen / 1500)))` (default — config override 가능). 109KB ÷ 1500 ≈ 75 → 케이스 A 의 83 → 75 로 cap.
  - I2: floor = 1 (source 자체) — entity/concept 0 인 케이스에서도 fail 0. 단, mention 이 충분한데 promotion threshold 가 너무 보수면 WARN 발화 (Step B 의 케이스 B 진단).
  - I3: hardcoded entity/concept name list 0건 — ceiling/floor 는 *count* 만 제어, 어떤 entity 가 채택될지는 LLM 자율 (§5.11 v3 + §5.10.4 D-wide 정합).
  - I4: `.wikey/promotion-threshold.yaml` 의 사용자 override 우선 (§5.15.B 패턴 유지).
- **Acceptance Scenarios**:
  - **Happy A (109KB)**: input 109,000 char → ceiling 73 → 83 proposed → 73 selected. 회귀 비교: 기존 83 vs fix 후 73 (~12% reduction, 의미 비례).
  - **Happy B (HWP small)**: input 5,000 char → ceiling 8 (max(8, 3)) → 0 proposed → WARN (`promotion-too-conservative`) + Notice 사용자 alert.
  - **Edge (작은 source)**: input 1,000 char → ceiling 8 → 5 proposed → 5 selected (cap 적용 X, floor 1 보장).
  - **Edge (config override)**: `.wikey/promotion-threshold.yaml` 에 `ceiling: { absolute: 30 }` → 109KB 도 30 cap.

### Spec 2: write phase batching (latency p95 cap)

- **Goal**: 분해 결과 page 들의 wiki write 가 sequential 호출 N개에서 batched atomic write 로 변경 — latency p95 ≤ 60s / source.
- **Invariants**:
  - I5: page write atomicity 보장 — partial write 시 rollback (또는 idempotent retry).
  - I6: index/log 갱신은 batch 종료 후 1회 atomic write (현재도 그러나 명시 invariant).
  - I7: 사용자 cancel 시 partial state 가 wiki 에 잔존 X (rollback or skip).
- **Acceptance Scenarios**:
  - **Happy (case A 83 → 73 page)**: write phase ≤ 60s (현 3min 대비).
  - **Cancel during write**: 사용자 cancel 시 wiki/ 무변경 보장.
  - **Index lag alert**: case B 의 "index 갱신 지연 알람" → 정의 명확화 + actionable message.

### Spec 3: HWP 변환 품질 진단 (out of scope flag 후보)

- **Goal**: case B 의 entity/concept 0 가 promotion gate 문제인지 HWP 변환 손실 문제인지 분리 진단.
- **Decision (Step "1" 측정 후)**: 변환 손실이 주원인이면 **별 cycle 분리** (Spec 3 = §5.17 out, unhwp 개선 cycle 신규 후보로 등재 + Phase 6 candidate).
- **본 cycle 안 inclusion 조건**: 진단만 + 변환 후 markdown body length / section count 측정 helper 추가.

## 2. Out of Scope

- HWP unhwp 변환 엔진 자체 개선 (위 Spec 3 분리).
- write phase 의 parallelize (file system race).
- §5.11 v3 paradigm 자체 변경.

## 3. Dependencies

- `wikey-core/src/promotion-config.ts` (§5.15.B 신규 47 LOC) — ceiling/floor 필드 확장.
- `wikey-core/src/canonicalizer.ts` — promotion 적용 시점.
- `wikey-core/src/ingest-pipeline.ts` — write phase batching.
- `wikey-core/src/incremental-reingest.ts` — index 갱신 alert path.
- `.wikey/promotion-threshold.yaml.example` (§5.15.B) — 확장 필드 example.

## 4. 진행 순서 (SDD+TDD)

- **Step A (analyst v0.2)**: Step "1" 결과 (case A registry record + case B 변환 결과) 반영하여 I1 의 1500 char/page 비율 + ceiling default 검증.
- **Step B (tester RED)**: promotion-config.test.ts + canonicalizer.test.ts AC 매핑.
- **Step C (developer GREEN)**: ceiling/floor 적용 + WARN path + write batch.
- **Step D (Phase 3a 회귀)**: npm test / build / validate-wiki.
- **Step E (Phase 3b BLUE)**: telemetry decision struct cleanup.
- **Step F (codex post-impl)**.
- **Step G (master 라이브 cycle smoke)**: case A 109KB MD 재 ingest + case B HWP 재 ingest 비교.

## 5. 변경 이력

- v0.1 (2026-05-11): draft 신규.
