---
title: LLM 참여형 다층 검색
created: 2026-04-10
updated: 2026-04-10
sources: [source-wikey-design-decisions.md]
tags: [design, architecture, wikey]
---

# LLM 참여형 다층 검색

Wikey의 핵심 개념 중 하나. 검색을 DB에 위임하면 다시 RAG가 된다. LLM이 검색의 양쪽 끝에 참여하되, 중간 대량 스캔만 외부 도구가 담당. 이는 RAG와의 차이를 강조하는 핵심 설계 원칙.