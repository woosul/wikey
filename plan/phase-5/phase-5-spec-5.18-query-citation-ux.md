---
phase: 5
section: 5.18
title: Query citation UX — 원본 1개당 1줄 + 전체 원본 링크 + wiki backlink + registry mismatch logging (Spec)
status: draft
created: 2026-05-11
updated: 2026-05-11
version: v0.1
---

# Phase 5 §5.18 Query citation UX (Spec, WHAT)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.18`](./phase-5-todo.md) · [`plan/phase-5/phase-5-todox-5.18-query-citation-ux.md`](./phase-5-todox-5.18-query-citation-ux.md)

## 0. Context

**도출 source**: 사용자 본체 완성 시점 테스트 (2026-05-11) 1-3 보고.

- 거의 모든 query 결과에서 `원본: (해석 실패 — registry 점검 필요)` 출력 — `query-pipeline.ts:319` fallback.
- 원본이 단 하나만 링크됨 (현재 `, ` join inline → 시각적으로 "하나" 처럼 보임).
- 관련된 원본 전체 링크 + 1개 원본 / 1줄 요청.
- 추가: 답변 wiki 페이지의 **backlink** (Obsidian backlink panel 등가) 표시 요청.
- 원본 확장자 일치 (md → md, pdf → pdf) — 이미 §5.15.D + §5.12 v3 에서 `## 출처` wikilink + sidecar 분기 구현되어 있으나 footer "원본:" 줄과의 정합 재검증.

**이득 (fix 후)**:
- 정량 — `(해석 실패)` fallback 발화율 ≤ 5% (현 거의 100%). registry mismatch 가 발화 시 어떤 sourceId 가 mismatch 인지 WARN log (telemetry).
- 정성 — 사용자 답변 가독성: 원본 1개당 1줄 + extension hint (`md` / `pdf`) badge + wiki backlink section.
- 정성 — schema §"쿼리 워크플로우" 의 "인용과 함께 답변 제공" 원칙 강화.

**Trade-off**:
- citation list 가 길면 chat 메시지 길이 증가 — collapse / 상위 N 제한 (default 5, 더보기 button).

## 1. Specs

### Spec 1: 원본 1개당 1줄 표시

- **Goal**: `appendOriginalLinks` 의 출력 format 을 `, ` inline join → `\n- ` 줄바꿈 list 로 변경.
- **Invariants**:
  - I1: 1줄 = 1 unique raw vault path (현 dedup 로직 유지).
  - I2: extension badge: filename basename 끝 extension lowercased 표시 (`(md)` / `(pdf)` / `(hwp)`).
  - I3: 답변 본문 ≤ 1줄 공백 후 `원본:` heading + `- [[path|display]] (ext)` list.
- **Acceptance Scenarios**:
  - **Multi-source**: citation 3개 (md / pdf / hwp 각 1) → `원본:` heading + 3 줄 list + 각 줄 끝 extension badge.
  - **Single-source**: citation 1개 → 동일 list format (1줄), `, ` inline 제거.
  - **Zero citation**: `원본: (없음 — 외부 근거 없음)` 유지.
  - **All resolve failed**: `원본: (해석 실패 — registry 점검 필요)` 유지 + WARN log (Spec 3).

### Spec 2: wiki 페이지 backlink section

- **Goal**: 답변에 등장한 wiki page 들이 어느 wiki page 에서 참조되는지 (Obsidian backlink) 별도 section 으로 표시.
- **Invariants**:
  - I4: backlink 조회는 Obsidian `MetadataCache.resolvedLinks` 역방향 lookup 사용 (이미 sidebar-chat 2272 의 `wikey-wikilink` 와 별개).
  - I5: 표시 위치 = `원본:` 다음, default collapse (사용자 toggle) — chat 길이 증가 회피.
  - I6: backlink 0 개면 section 생략 (no-op).
- **Acceptance Scenarios**:
  - **Happy**: 답변에 `[[lotus-pms]]` 등장 → backlink section 에 lotus-pms 를 참조하는 entity/concept page list (≤ 5 + 더보기).
  - **No backlink**: 답변에 mention 된 wiki page 가 어디서도 참조 X → section 미출력.

### Spec 3: registry mismatch logging + diagnostic

- **Goal**: `appendOriginalLinks` 의 `resolveSource` 실패 시 어떤 sourceId 가 registry 에 없는지 / tombstoned 인지 console.warn 으로 log + 사용자 diagnostic command.
- **Invariants**:
  - I7: WARN log = `[citation] sourceId=<id> not found in registry (page=<path>)` — sensitive content X (sourceId hash only).
  - I8: 신규 command `Wikey: Diagnose citation mismatches` — 모든 wiki page 의 provenance.ref 스캔 → registry 에 없는 sourceId list 출력.
- **Acceptance Scenarios**:
  - **Mismatch detected**: query 결과에서 citation 모두 fail → console 에 N WARN log + footer "(해석 실패)" 표시.
  - **Diagnostic command**: command palette 호출 → 모든 mismatch sourceId + 영향받은 wiki page list 출력.

## 2. Out of Scope

- registry rebuild / 자동 fix — 본 cycle 은 detect + logging 만, fix 는 §5.19 maintenance suite.
- 다국어 alias 통합 (§5.7.9 candidate #3 별 cycle).
- citation 우선순위 정렬 (§5.7.9 candidate #5 별 cycle).

## 3. Dependencies

- `wikey-core/src/query-pipeline.ts:282` `appendOriginalLinks`.
- `wikey-core/src/source-resolver.ts` — record.tombstone + resolve fail 분기 (변경 없음, log 만 추가).
- `wikey-obsidian/src/sidebar-chat.ts` — backlink section render.
- `wikey-obsidian/src/commands.ts` — diagnostic command 등록.
- `wikey-obsidian/styles.css` — backlink section style.

## 4. 진행 순서 (SDD+TDD)

- **Step A (analyst v0.2)**: Step "1" 결과 — 사용자 vault 의 registry mismatch 실측 (몇 % 가 fallback 발화? sourceId 분포?).
- **Step B (tester RED)**: query-pipeline.test.ts + sidebar-chat backlink test.
- **Step C (developer GREEN)**: format 변경 + backlink section + WARN log + command.
- **Step D~F (회귀 / BLUE / codex review)**.
- **Step G (master 라이브 smoke)**: PMS query / multi-source query / diagnostic command.

## 5. 변경 이력

- v0.1 (2026-05-11): draft 신규.
