# Wikey — Codex CLI 설정

> 이 파일은 OpenAI Codex CLI에서 wikey 프로젝트를 작업할 때의 도구 사용법과 실행 체크리스트를 정의한다.

## 필수: 스키마 먼저 읽기

**작업 시작 전 `wikey.schema.md`를 반드시 읽어라.** 위키의 3계층 아키텍처, 워크플로우, 페이지 컨벤션, 핵심 원칙이 모두 그 파일에 정의되어 있다.

## 쓰기 규칙

| 대상 | 권한 |
|------|------|
| `wiki/` | 읽기/쓰기 (페이지 생성·수정·삭제, 인덱스·로그 갱신) |
| `raw/` | **읽기만** (절대 수정하지 않음) |
| `wikey.schema.md` | **사용자 승인 없이 수정 금지** |
| `AGENTS.md` | **사용자 승인 없이 수정 금지** |

## Codex CLI 도구 사용 패턴

### 파일 접근

Codex는 셸 명령을 통해 파일을 읽고 쓴다:

```bash
# 소스 읽기
cat raw/articles/source.md

# 위키 페이지 생성 (프론트매터 포함)
cat > wiki/entities/entity-name.md << 'EOF'
---
title: 엔티티 이름
type: entity
created: 2026-04-10
updated: 2026-04-10
sources: [source-name.md]
tags: [태그1]
---

# 엔티티 이름

내용...
EOF

# 기존 페이지에 내용 추가
# → 파일을 읽고, 수정한 전체 내용을 다시 쓰기
```

### 검색

```bash
# 위키 내 키워드 검색
grep -r "검색어" wiki/ --include="*.md"

# 위키링크 추적 (특정 페이지를 참조하는 파일 찾기)
grep -r "\[\[page-name\]\]" wiki/ --include="*.md"

# 파일 목록
find wiki/ -name "*.md" | sort
```

### Git 사용

```bash
# 인제스트 완료 후 커밋
git add wiki/
git commit -m "ingest: 소스 제목 — N개 페이지 생성/수정"

# 검증 스크립트 실행
./scripts/validate-wiki.sh
./scripts/check-pii.sh
```

## 세션 실행 체크리스트

### 인제스트 세션

```
1. wikey.schema.md 읽기 (cat wikey.schema.md)
2. raw/ 소스 읽기
3. 핵심 시사점을 사용자와 논의
4. wiki/sources/source-{name}.md 생성 또는 업데이트 (멱등)
5. wiki/entities/, wiki/concepts/ 페이지 생성 또는 업데이트
6. wiki/index.md 갱신
7. wiki/log.md에 항목 추가
8. wiki/overview.md 갱신 (필요시)
9. ./scripts/validate-wiki.sh 실행 → 통과 확인
10. ./scripts/check-pii.sh 실행 → 통과 확인
11. Git 커밋
```

### 쿼리 세션

```
1. wikey.schema.md 읽기
2. wiki/index.md 읽기 → 관련 페이지 식별
3. 해당 페이지 읽기
4. 인용과 함께 답변 종합
5. 가치 있는 답변 → wiki/analyses/에 저장 → index.md, log.md 갱신
```

### 린트 세션

```
1. wikey.schema.md 읽기
2. 증분: git diff --name-only HEAD~5 -- wiki/
   전체: find wiki/ -name "*.md"
3. 점검: 모순, 고아, 깨진 링크, 인덱스 누락
4. 발견 사항을 사용자에게 보고
5. 사용자 승인 후 수정
6. log.md에 lint 항목 추가
7. validate-wiki.sh → Git 커밋
```

## Claude Code와의 일관성 유지

Codex로 작업할 때도 **동일한 컨벤션**을 따라야 한다:

- 프론트매터: `title`, `type`, `created`, `updated`, `sources`, `tags` 필수
- 파일명: 소문자, 하이픈 구분
- 위키링크: `[[페이지명]]` 형식
- index.md: 카테고리별 정렬, 한 줄 설명 포함
- log.md: `## [YYYY-MM-DD] type | title` 형식

`validate-wiki.sh`가 이 컨벤션을 자동 검증한다.
