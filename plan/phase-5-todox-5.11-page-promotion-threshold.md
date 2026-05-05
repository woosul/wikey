---
phase: 5
section: 5.11
title: Page Promotion Threshold (Issue B)
status: implementing
created: 2026-05-05
---

# Phase 5 §5.11 Page Promotion Threshold (Issue B) 구현계획

> **상위 문서**: [`plan/phase-5-todo.md`](./phase-5-todo.md) · [`activity/phase-5-result.md`](../activity/phase-5-result.md)
>
> **작성일**: 2026-05-05 (session 18)
> **버전**: v1
> **이슈 출처**: 사용자 raise 2026-05-05 session 17 (`session-wrap-followups.md` §1순위 §2순위)

## 1. 배경

사용자 보고 (D-wide cycle 중):

> "wiki 생성이 <15인거는 알겠는데, 생성조건이 궁금할 정도임. '전라남도 테크노파크' 같은 고유명사는 일단 생성하고 보는건지? 전체 내용에서 의미가 있는 내용이 아닌 단순 출처 정도인데 굿이 wiki페이지로 생성되어야 하는지 궁금할 정도."

증상: 단순 출처 / 단순 행사 장소 / 1회 mention 만 있는 고유명사도 자체 wiki 페이지 (entity/concept) 로 생성되어 wiki/ 의 noise 증가.

## 2. Root cause

현재 canonicalizer (Stage 3) prompt 와 code gate 모두 mention 을 entity/concept 으로 자유롭게 promote. promotion 기준 = LLM 의 type 분류 + canonicalizer 의 alias normalization 만. **본문 occurrence count** 또는 **의미 비중 (action/property/relation)** 기준 부재.

## 3. 채택 path: 2-Layer promotion gate

### Layer 1 (LLM 자율, prompt-level)

`canonicalizer.ts::buildCanonicalizerPrompt` 의 작업 규칙에 promotion threshold guidance 추가:

> 8. **promotion threshold**: 본문 전체에서 의미 있는 등장 (action / property / relation 서술) 이 2회 이상이거나 다른 mention 들이 cross-reference 하는 hub 역할일 때만 entity/concept 으로 출력. 단순 출처 (예: "개최 장소: X", "출처: Y"), 단순 인용, 1회 mention 만 있는 고유명사는 entities/concepts 에서 **제외**. 본문 의미에 비례한 promotion 만.

### Layer 2 (deterministic, code gate)

`canonicalizer.ts::assembleCanonicalResult` 의 `validateAndBuildPage` 에 substring occurrence count gate 추가:

```ts
const PROMOTION_THRESHOLD = 2

function countOccurrences(name: string, aliases: readonly string[], sourceBody: string): number {
  const candidates = [name, ...aliases].map((s) => s.trim()).filter((s) => s.length > 1)
  const haystack = sourceBody.toLowerCase()
  let total = 0
  for (const c of candidates) {
    const needle = c.toLowerCase()
    let idx = 0
    while ((idx = haystack.indexOf(needle, idx)) !== -1) {
      total++
      idx += needle.length
    }
  }
  return total
}

// 본문에서 mention name + alias 의 substring 등장이 < 2 면 drop
const occurrences = countOccurrences(name, raw.aliases ?? [], sourceBody)
if (occurrences < PROMOTION_THRESHOLD) {
  return { ok: false, reason: `single-mention (${occurrences} occurrence) — not promoted to page` }
}
```

`canonicalize()` args 에 `sourceBody?: string` 추가. ingest-pipeline 의 caller 에서 `content` (full source 또는 SEGMENTED 합산) 전달. 미전달 시 gate skip (backward-compatible — 기존 test/caller 무관).

### Karpathy 4원칙 정합

- **Simplicity First**: 2 layer 모두 ≤ 30 line 추가. settings 노출 / 복잡한 evidence quality DSL 도입 X.
- **Surgical Changes**: 새 file 0. canonicalizer.ts 만 수정. test 추가 1 file (canonicalizer.test.ts 의 신규 describe).
- **Goal-Driven**: AC = "단일 mention + short evidence 인 LLM 출력은 dropped 으로 분류" — test 로 검증.
- **Think Before Coding**: schema gate (D-wide 폐기) 와 별 layer. Layer 1/2 는 ontology 정의가 아니라 noise filtering. wikey.schema.md 의 LLM-only ontology 원칙과 충돌 없음 (LLM 출력 + Layer 2 backup).

## 4. Acceptance Criteria

- **AC1**: `canonicalize()` args 에 `sourceBody?: string` optional 추가. 미전달 시 기존 동작 (gate 미적용).
- **AC2**: `sourceBody` 전달 + mention 본문 occurrence < 2 → entity/concept 출력 0 + dropped reason `single-mention (N occurrence)`.
- **AC3**: `sourceBody` 전달 + occurrence ≥ 2 → 정상 promotion.
- **AC4**: alias 등장도 occurrence count 에 합산 (한 alias 라도 ≥ 1 회 + name 1 회 = 2).
- **AC5**: canonicalizer prompt 에 promotion threshold rule (8번) 텍스트 포함.
- **AC6**: ingest-pipeline FULL/SEGMENTED 양쪽 모두 sourceBody 전달.
- **AC7**: 회귀 — 기존 604 PASS 유지 + 신규 ≥ 3 case (single mention drop / multi-occurrence promote / alias 합산).

## 5. Test plan

신규 `describe('canonicalize — §5.11 promotion threshold')` 블록:

```ts
it('AC2: single-mention with sourceBody → dropped', async () => {
  const mentions: Mention[] = [{ name: '전라남도-테크노파크', evidence: '개최 장소: 전라남도 테크노파크' }]
  const llm = makeMockLLM(JSON.stringify({
    entities: [{ name: 'jeonnam-technopark', type: 'organization', description: 'Event venue' }],
    concepts: [],
  }))
  const sourceBody = '...개최 장소: 전라남도 테크노파크 (1F 강당)... [본문 다른 곳에는 등장 안함]'
  const result = await canonicalize({ ...baseArgs, llm, mentions, sourceBody })
  expect(result.entities).toHaveLength(0)
  expect(result.dropped[0].reason).toContain('single-mention')
})

it('AC3: multi-occurrence with sourceBody → promoted', async () => {
  const sourceBody = 'PMS 시스템... PMS 의 핵심 기능... PMS 의 license 관리...'  // 3회
  // ... LLM emits PMS entity → promoted
})

it('AC4: alias 합산 → promoted', async () => {
  const sourceBody = 'ERP 시스템... enterprise resource planning 의 도입...'  // ERP 1 + ERP 명시 1
  // LLM emits enterprise-resource-planning with alias 'ERP'
  // count = 2 (ERP 1 + 'enterprise resource planning' 1)
})

it('AC1 backward: sourceBody 미전달 → gate 미적용 (기존 모든 entity/concept 통과)', ...)
```

## 6. 라이브 smoke

사용자 vault 에서 다음 cycle smoke (PMBOK / smart-factory / examples) ingest 1회씩:
- 다음 ingest 시 `console` 에서 `[Wikey ingest] dropped sample: X (single-mention 1 occurrence)` 등 log 확인.
- wiki/entities/jeonnam-technopark.md 같은 단순 출처 page 가 신규 ingest 에서 생성 안 되는지 확인 (기존 page 는 별 cleanup task).

## 7. Self-check

| # | Anchor | 상태 |
|---|--------|------|
| (a) | canonicalize args type 일관 (sourceBody?: string) | spec line 32 ↔ AC1 line 60 일관 |
| (b) | promotion threshold const 정의 1곳 (canonicalizer.ts) | spec line 25 |
| (c) | LLM 자율 + code gate 2 layer 명시 | §3 layer 1/2 |
| (d) | AC7 test count 산수 | 604 + ≥ 3 = ≥ 607 |
| (e) | 라이브 smoke 항목 명시 | §6 |
| (f) | header version + 작성일 | line 4-5 |
| (g) | 코드 ↔ test exact phrase | "single-mention (N occurrence)" — gate reason ↔ AC2 test assert |
