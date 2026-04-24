# Pass B File 1: llm-wiki.md (Audit panel)

> **상위 문서**: [`README.md`](./README.md) · [`pass-b-readme.md`](./pass-b-readme.md)

## 메타
- 진입: Audit 패널 (Pass B, `autoMoveFromInbox=true`)
- 실행: 21:10:32 → 21:13:17 (~3분)
- source: 11,923 chars, route=FULL, sections=9
- Provider: gemini / gemini-2.5-flash

## Stage 1
- 변환: N/A (md skip)
- Stage 2 mentions: **15** (Pass A 17 → variance -2)
- Stage 3: **9 entities, 5 concepts, dropped=1** (Pass A 10+4+1 → -1 entity, +1 concept)
- 분류: `raw/3_resources/60_note/000_computer_science/` (Pass A 와 동일) ✅
- auto-moved to PARA 로그: `raw/0_inbox/llm-wiki.md → raw/3_resources/60_note/000_computer_science/llm-wiki.md (노트/기사) sidecar=false [is-md-original]`

## 판정
**PASS** — Pass A 대비 tier/분류 동일, entity/concept count variance (LLM 특성) 허용 범위.
