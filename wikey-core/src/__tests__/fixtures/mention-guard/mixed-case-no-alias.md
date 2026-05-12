---
title: Mixed-case wikilink without alias sample
type: concept
created: 2026-05-13
updated: 2026-05-13
sources: [llm-models.md]
tags: []
---

# Mixed-case wikilink without alias sample

LLM 이 wikilink target 만 mixed case 로 emit (alias 없음) 한 케이스.
mention-guard 는 target 을 lowercase canonical 로 변환해야 한다 (AC-S2-1).

- `[[GPT-4o]]` → `[[gpt-4o]]`
- `[[Anthropic]]` → `[[anthropic]]`
