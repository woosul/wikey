---
title: LLM 프로바이더 독립
type: concept
created: 2026-04-18
updated: 2026-04-18
sources: [source-wikey-design-decisions.md]
tags: [BYOAI, LLM, 스키마, 독립성]
---

# LLM 프로바이더 독립

[[wikey]]의 [[byoai]](Bring Your Own AI) 원칙을 구현하는 핵심 개념으로, 특정 LLM 프로바이더에 종속되지 않도록 스키마를 설계하는 것을 의미합니다. `wikey.schema.md`가 마스터 스키마 역할을 하며, 프로바이더별 파일은 도구 사용법만 추가합니다.