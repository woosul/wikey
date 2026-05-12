---
title: Raw filename .md mention sample
type: concept
created: 2026-05-13
updated: 2026-05-13
sources: [some-source.md]
tags: []
---

# Raw filename .md mention sample

이 문서는 LLM Stage 2 출력이 raw filename `.md` extension 을 그대로 wikilink target 으로 emit 한
케이스를 simulate 한다. mention-guard 가 본문 wikilink `[[some-source.md]]` 를 plain text
`some-source.md` 로 변환해야 한다 (AC-S1-1, AC-S1-2).

본문 단어 보존 검증용:

- `[[some-source.md]]` 는 plain text 로 변환되어야 한다.
- `[[notes.md]]` 도 동일한 plain text 변환 대상이다.
- 문맥상 `some-source.md` 라는 단어가 결과 본문에 남아야 한다.
