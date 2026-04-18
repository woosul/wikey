---
title: RAG 합성 레이어
type: concept
created: 2026-04-18
updated: 2026-04-18
sources: [source-wikey-design-decisions.md]
tags: [RAG, Wikey, 지식 합성, 검색]
---

# RAG 합성 레이어

[[wikey]]가 RAG(Retrieval Augmented Generation)와 경쟁하는 대신, RAG 위에 지식 합성 레이어를 얹는 방식으로 포지셔닝하는 전략입니다. 검색은 외부 도구에 위임하고, LLM은 검색된 정보를 바탕으로 지식을 합성하는 역할을 담당합니다.