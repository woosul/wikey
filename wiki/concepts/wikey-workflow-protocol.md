---
title: Wikey 워크플로우 프로토콜
type: concept
created: 2026-04-12
updated: 2026-04-12
sources: [source-claude-code-setup]
tags: [워크플로우, 프로세스, 개발]
---

# Wikey 워크플로우 프로토콜

wikey 프로젝트의 모든 작업(인제스트, 쿼리, 린트, 분류 등)은 체계적인 프로토콜을 따르며, 이는 [[wikey.schema.md]]에 정의된 원칙을 기반으로 한다. 이 프로토콜은 개발자가 일관성을 유지하며 지식을 점진적으로 구축하는 것을 목표로 한다.

## 주요 세션별 체크리스트

### 1. 인제스트 세션

새로운 소스(raw/)가 들어왔을 때, 다음 단계를 거쳐 위키에 통합한다:
1. `wikey.schema.md` 읽기
2. `raw/` 소스 읽기
3. 핵심 시사점 논의
4. `wiki/sources/source-{name}.md` 생성/업데이트
5. `wiki/entities/`, `wiki/concepts/` 페이지 생성/업데이트
6. `wiki/index.md` 갱신
7. `wiki/log.md`에 항목 추가
8. `wiki/overview.md` 갱신
9. `scripts/check-pii.sh` 실행 → 통과 확인
10. `scripts/reindex.sh` 실행 → 전체 인덱싱
11. Git 커밋

### 2. 쿼리 세션

사용자 질문에 답변할 때, 다음 단계를 따른다:
1. `wikey.schema.md` 읽기
2. `wiki/index.md` 읽기 → 관련 페이지 식별
3. 해당 페이지 읽기 (entities/, concepts/, sources/)
4. 인용과 함께 답변 종합
5. 가치 있는 답변 → `wiki/analyses/`에 저장 → `index.md`, `log.md` 갱신

### 3. 린트 세션

위키의 무결성을 검사하는 과정으로, 모순, 고아 페이지, 깨진 링크 등을 점검한다.
1. `wikey.schema.md` 읽기
2. 증분/전체 린트 실행
3. 발견 사항 보고 및 사용자 승인 후 수정
4. `log.md`에 lint 항목 추가
5. `validate-wiki.sh` → Git 커밋

## 기타 핵심 워크플로우

*   **소스 삭제 세션:** 소스 삭제 시, 해당 소스를 인용하는 모든 페이지에서 인용을 제거하고 `index.md`, `log.md`를 갱신한다.
*   **분류 세션:** `raw/CLASSIFY.md`를 참조하여 자동 분류 규칙을 매칭하고, 사용자 승인 후 `scripts/classify-inbox.sh`를 실행한다.