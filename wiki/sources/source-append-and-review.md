---
title: "The Append-and-Review Note — Karpathy"
type: source
created: 2026-04-10
updated: 2026-04-10
sources: [append-and-review-note.md]
tags: [karpathy, note-taking, productivity]
---

# The Append-and-Review Note — Karpathy

> 원본: [Karpathy Bear Blog](https://karpathy.bearblog.dev/the-append-and-review-note) (2025-03-19)
> 원시 소스: `raw/3_resources/10_article/901_wikey_design/append-and-review-note.md`

## 핵심 아이디어

[[andrej-karpathy]]가 수년간 사용해온 노트 테이킹 방법. 단 하나의 텍스트 노트(Apple Notes)를 유지하며, **추가(append)**와 **검토(review)**의 두 가지 작업만 반복한다.

## 데이터 구조

- Apple Notes 앱의 **단일 노트** ("notes")
- 여러 노트를 폴더 구조로 관리하면 인지 부하가 과도 → 하나의 노트 = CTRL+F만으로 검색
- 구조화된 메타데이터(날짜, 링크, 태그)는 기본적으로 사용하지 않음
- 예외: `watch:`, `listen:`, `read:` 같은 행동 태그만 사용

## 추가 (Append)

아이디어, 할 일, 무엇이든 생각나면 **노트 맨 위에 추가**. PC에서든 iPhone에서든. 메타데이터 없이 순수 텍스트.

## 검토 (Review)

새 항목이 위에 추가되면 나머지는 **중력처럼 아래로 가라앉는다**. 가끔 스크롤하며 훑어보고:
- 관심을 유지할 가치가 있는 항목 → 맨 위로 **구출(rescue)**
- 관련 노트끼리 **병합·가공·그룹화**
- 반복 검토에서 살아남지 못하는 항목은 자연스럽게 가라앉음
- 삭제는 드묾 — 잃어버리는 것이 아니라 관심 우선순위가 낮아질 뿐

## 활용 사례

- 이동 중 떠오른 아이디어 임시 저장
- 추천받은 영화/책/팟캐스트 기록
- 아침 TODO 리스트
- 트윗 초안 → 좀 더 숙고 후 게시
- 실험 로그 (명령어 + 결과)
- 스트레스 해소를 위한 브레인 덤프

## 핵심 통찰

> "무언가를 적으면 즉시 넘어갈 수 있다. 워킹 메모리를 비우고 다른 것에 완전히 집중할 수 있다."

## [[llm-wiki]]와의 관계

커뮤니티에서 append-and-review 패턴과 LLM Wiki의 **결합 가능성**이 제안됨 (@expectfun). append-and-review의 단순함 + LLM Wiki의 구조화·교차참조 능력을 결합하면:

- 사용자는 append-and-review 스타일로 간편하게 소스 추가
- LLM이 자동으로 구조화·분류·교차참조
- review 단계에서 LLM이 관련 노트를 제안하거나 병합 후보를 추천

## 관련 항목

- [[andrej-karpathy]] — 저자
- [[llm-wiki]] — 결합 가능한 패턴
- [[knowledge-compounding]] — 노트 축적의 가치
