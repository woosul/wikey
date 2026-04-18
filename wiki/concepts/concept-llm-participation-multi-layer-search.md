---
title: LLM 참여형 다층 검색
created: 2026-04-10
updated: 2026-04-10
sources: [source-wikey-design-decisions]
tags: [design, architecture, wikey]
---

# LLM 참여형 다층 검색

LLM 참여형 다층 검색은 검색 과정에서 LLM이 양쪽 끝에 참여하는 방식을 의미합니다. 중간 대량 스캔은 외부 도구가 담당하며, 이는 RAG와의 차이점으로, 검색의 효율성과 정확성을 높이는 데 기여합니다.