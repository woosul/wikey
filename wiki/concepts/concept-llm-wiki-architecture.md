---
title: LLM Wiki 아키텍처
created: 2026-04-10
updated: 2026-04-10
sources: [source-wikey-design-decisions]
tags: [design, architecture, wikey]
---

# LLM Wiki 아키텍처

LLM Wiki 아키텍처는 원시 소스 / 위키 / 스키마 3계층 구조를 기반으로 설계되었습니다. 이 구조는 LLM이 영구적 위키를 점진적으로 구축·유지하는 패턴을 반영하며, 지식이 복리로 축적되는 원리에 기반합니다. 이 아키텍처는 지식의 정확성과 유연성을 동시에 확보합니다.