---
title: Mixed-case wikilink with alias sample
type: concept
created: 2026-05-13
updated: 2026-05-13
sources: [llm-models.md]
tags: []
---

# Mixed-case wikilink with alias sample

LLM 이 wikilink target 을 mixed case 로 emit 하고 alias 도 함께 지정한 케이스.
mention-guard 는 target 만 lowercase canonical 로 변환하고 alias 는 원형을 보존해야 한다 (AC-S2-2).

- `[[GPT-4o|GPT-4o]]` → `[[gpt-4o|GPT-4o]]` (target lowercase, alias 원형 보존)
- `[[Claude-Opus|Claude Opus]]` → `[[claude-opus|Claude Opus]]` (alias 의 공백·case 보존)
