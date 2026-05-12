# Phase 5 §5.21 Ingest pipeline mention guard — Todo (HOW)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.21`](./phase-5-todo.md) · [`plan/phase-5/phase-5-spec-5.21-ingest-mention-guard.md`](./phase-5-spec-5.21-ingest-mention-guard.md)
>
> **버전**: v0.1 (2026-05-12) — draft 신규.

## 진행 매트릭스 (Step A~G)

- [ ] **Step A — analyst v0.2 LOCK**: Q1~Q2 LOCK (LLM prompt vs post-process / reject vs silent skip) + 근본 원인 1+3 scope 명확화
- [ ] **Step B — tester RED**: ingest fixture 2 + AC-S1/S2 4 test case
- [ ] **Step C — developer GREEN**: `wikey-core/src/wiki/mention-guard.ts` 신규 + Stage 2 hook
- [ ] **Step D — Phase 3a 회귀**
- [ ] **Step E — Phase 3b BLUE**
- [ ] **Step F — codex post-impl review**
- [ ] **Step G — master 라이브 smoke** (실 source 재 ingest → broken count -49% 예상)

## 의문점 (Step A LOCK 대상)

- **Q1 (위치)**: mention guard 가 LLM prompt level (LLM 에게 "raw filename wikilink 금지" 지시) vs post-process level (LLM 출력 후 코드 검사) — 권장: **post-process** (deterministic, prompt drift 무관).
- **Q2 (강도)**: reject 시 wikilink 제거 vs plain text 변환 vs warning log only — 권장: **plain text 변환** (`[[X.pdf]]` → `X.pdf`, 사용자가 vault 내용 인지 가능).
- **Q3 (canonicalizer scope)**: wikilink 본문 X 만 normalize vs alias 도 normalize (`[[X|alias]]` 의 alias) — 권장: target 만 (alias 는 display).

## 변경 면 추정

- 신규 file: `wikey-core/src/wiki/mention-guard.ts` (≤ 200 LOC)
- 신규 test: `wikey-core/src/__tests__/mention-guard.test.ts` + ingest fixture 2
- 기존 edit: `wikey-core/src/ingest-pipeline.ts` Stage 2 hook (≤ 20 LOC)

## 변경 이력

- v0.1 (2026-05-12): draft 신규.
