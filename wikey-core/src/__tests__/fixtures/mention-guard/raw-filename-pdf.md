---
title: Raw filename .pdf/.docx mention sample
type: concept
created: 2026-05-13
updated: 2026-05-13
sources: [whitepaper.pdf]
tags: []
---

# Raw filename .pdf/.docx mention sample

LLM 이 binary source (PDF / DOCX 등) 의 raw filename 을 그대로 wikilink target 으로 emit 한
케이스. mention-guard 가 `[[whitepaper.pdf]]` 와 `[[report.docx]]` 를 plain text 로 변환해야 한다.

- `[[whitepaper.pdf]]` 는 plain text `whitepaper.pdf` 로 변환된다 (AC-S1-1).
- `[[report.docx]]` 도 동일 (extension 카테고리).
- 본문에 `whitepaper.pdf` / `report.docx` 단어는 남는다 (AC-S1-2 정보 보존).
