# Pass B File 6: Examples HWPX (Audit panel)

> **상위 문서**: [`README.md`](./README.md) · [`pass-b-readme.md`](./pass-b-readme.md)

## 메타
- 진입: Audit 패널
- 실행: 21:27:15 → 21:28:11 (~1분)
- source: 544 chars (cache hit unhwp)

## Stage 1
- 변환 tier: `unhwp` cache hit ✅ (Pass A 와 동일)
- Stage 2 mentions: **3** (Pass A 동일) ✅
- Stage 3: **3 entities, 0 concepts, dropped=0** (Pass A 와 동일) ✅
- **분류 차이**: `raw/3_resources/60_note/000_general/` (Pass A 는 `raw/3_resources/20_report/000_general/` — PARA 2차 분류 diff — LLM reasoning variance: Pass A "일반 참조 자료", Pass B "참조용 개인 노트")

## 판정
**PASS** (tier 동일, Stage 3 counts 완전 일치, 분류 LLM variance — `20_report` vs `60_note` 차이)
