---
title: Append-and-Review 패턴
type: concept
created: 2026-04-10
updated: 2026-04-10
sources: [source-append-and-review.md, source-llm-wiki-community.md]
tags: [note-taking, productivity, pattern]
---

# Append-and-Review 패턴

[[andrej-karpathy]]가 수년간 사용해온 노트 테이킹 방법. 단일 노트에 추가(append)하고, 주기적으로 검토(review)하는 극도로 단순한 시스템.

## 원칙

1. **단일 노트**: 폴더 구조, 태그, 메타데이터 없이 하나의 텍스트 파일만 유지
2. **추가**: 생각나면 맨 위에 텍스트로 추가. 분류하지 않음
3. **검토**: 가끔 스크롤하며 중요한 것은 위로 구출, 관련 항목은 병합. 나머지는 자연스럽게 가라앉음

## "중력" 메타포

새 항목이 위에 추가되면 기존 항목은 아래로 가라앉는다. **반복 검토에서 살아남는 항목만 상위에 머문다.** 삭제가 아닌 자연 소멸 — 잃어버리는 것이 아니라 관심 우선순위가 바뀔 뿐.

## [[llm-wiki]]와의 결합 가능성

커뮤니티에서 제안된 아이디어 (@expectfun):

| Append-and-Review | LLM Wiki | 결합 시 |
|-------------------|----------|--------|
| 비구조적, 단순 | 구조화, 교차참조 | 사용자는 단순하게 추가, LLM이 구조화 |
| 수동 검토 | 자동 린트 | LLM이 검토 후보 제안 |
| 관련 항목 수동 병합 | 자동 교차참조 | LLM이 병합 후보 추천 |

가능한 워크플로우: 사용자가 append-and-review 스타일로 `raw/0_inbox/`에 간편하게 소스 추가 → LLM이 주기적으로 새 노트를 인제스트하여 위키에 통합.

## 관련 항목

- [[andrej-karpathy]] — 창시자
- [[llm-wiki]] — 결합 대상 패턴
- [[knowledge-compounding]] — 축적 원리의 다른 형태
- [[source-append-and-review]] — 출처
