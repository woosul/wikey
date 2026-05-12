---
title: §5.13 source link exempt sample
type: concept
created: 2026-05-13
updated: 2026-05-13
sources: [sample.pdf]
tags: []
---

# §5.13 source link exempt sample

본문 영역의 raw filename wikilink 는 plain text 로 변환되어야 하지만,
`## 출처` 섹션 안의 `[[<rawSourceFilename>|원문]]` 형식 (canonicalizer.ts:592-593 deterministic emit)
은 mention-guard scope 외 — 변환 0 (AC-S1-4, Spec 1 I7 exempt).

본문에 `[[sample.pdf]]` 라는 raw extension wikilink 가 등장한다. 이 본문 link 는
plain text `sample.pdf` 로 변환되어야 한다.

## 출처

- [[source-sample|sample.pdf]]
- [[sample.pdf|원문]]
