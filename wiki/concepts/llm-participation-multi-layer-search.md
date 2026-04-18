---
title: LLM 참여형 다층 검색
created: 2026-04-10
updated: 2026-04-10
sources: [source-wikey-design-decisions]
tags: [search, llm, wiki]
---

# LLM 참여형 다층 검색

LLM 참여형 다층 검색은 검색을 DB에 위임하면 다시 RAG가 되므로, LLM이 검색의 양쪽 끝에 참여하되, 중간 대량 스캔만 외부 도구가 담당하는 방식입니다. 이는 검색의 효율성과 정확도를 동시에 높이는 전략입니다.