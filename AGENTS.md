# Wikey — Codex CLI 설정

> 이 파일은 OpenAI Codex CLI에서 wikey 프로젝트를 작업할 때의 도구 사용법과 실행 체크리스트를 정의한다.

## 필수: 스키마 먼저 읽기

**작업 시작 전 `wikey.schema.md`를 반드시 읽어라.** 위키의 3계층 아키텍처, 워크플로우, 페이지 컨벤션, 핵심 원칙이 모두 그 파일에 정의되어 있다.

## 쓰기 규칙

| 대상 | 권한 |
|------|------|
| `wiki/` | 읽기/쓰기 (페이지 생성·수정·삭제, 인덱스·로그 갱신) |
| `raw/` | **내용 수정 금지** (inbox→PARA 분류 이동은 허용, 사용자 승인 후) |
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
# qmd 하이브리드 검색 (BM25+벡터+RRF — 권장)
./tools/qmd/bin/qmd query "검색어" -c wikey-wiki

# wikey-query.sh (qmd 검색 → Gemma 4 합성, 한국어 형태소 전처리 포함)
./local-llm/wikey-query.sh "질문"
./local-llm/wikey-query.sh --backend gemma4 "한국어 질문"
./local-llm/wikey-query.sh --search "검색만"

# 한국어 FTS5 인덱스 전처리 (qmd update 후 실행)
python3 scripts/korean-tokenize.py --batch

# inbox 상태 확인 + 분류
./scripts/watch-inbox.sh --status
./scripts/classify-inbox.sh --dry-run
./scripts/classify-inbox.sh --move <src> <dst>

# 대용량 PDF 요약 (Gemini 또는 Ollama)
./scripts/summarize-large-source.sh <pdf> --dry-run
./scripts/summarize-large-source.sh <pdf>

# 위키 내 키워드 검색 (단순)
grep -r "검색어" wiki/ --include="*.md"

# 위키링크 추적
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
11. python3 scripts/contextual-retrieval.py --batch → Gemma 4 맥락 프리픽스 생성 + FTS5 적용
12. python3 scripts/korean-tokenize.py --batch → FTS5 한국어 형태소 전처리 갱신
13. Git 커밋
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

### 소스 삭제 세션

```
1. wikey.schema.md 읽기
2. 삭제된 소스의 wiki/sources/source-{name}.md 확인
3. grep -r "source-{name}" wiki/ 로 해당 소스를 인용하는 모든 페이지 검색
4. 각 페이지에서 인용 제거 또는 "근거 삭제됨" 표시
5. wiki/sources/source-{name}.md 삭제 또는 아카이브
6. index.md, log.md 갱신
7. validate-wiki.sh → Git 커밋
```

### 분류 세션

```
1. wikey.schema.md 읽기
2. raw/CLASSIFY.md 읽기
3. ls raw/0_inbox/ 파일/폴더 목록 확인
4. 각 항목에 대해:
   a. CLASSIFY.md 자동 규칙 매칭 시도
   b. 매칭 실패 시 LLM 판단 가이드 참조
   c. 분류 결과를 사용자에게 제안
5. 사용자 승인 후 해당 PARA 카테고리로 이동
6. CLASSIFY.md 하위폴더 정의에 새 폴더 추가 시 문서 업데이트
7. 이동 완료 후 인제스트 세션 시작 (필요시)
```

## 대용량 소스 처리

20페이지+ PDF, 2시간+ 회의록 등은 `wikey.schema.md`의 **2단계 인제스트** 절차를 따른다:

```
Phase A: 20p씩 순차 읽기 → 섹션 인덱스 생성
Phase B: 핵심 섹션만 상세 읽기 → 위키 페이지 생성
Phase C: 쿼리 시 섹션 인덱스 참조 → 해당 페이지만 온디맨드 읽기
```

## PII 주의사항

- `./scripts/check-pii.sh`를 커밋 전 반드시 실행
- 소스에 PII가 있을 경우 위키 페이지에 전파하지 않도록 주의
- PII가 위키에 이미 전파된 경우, 사용자 지시에 따라 제거

## Claude Code와의 일관성 유지

Codex로 작업할 때도 **동일한 컨벤션**을 따라야 한다:

- 프론트매터: `title`, `type`, `created`, `updated`, `sources`, `tags` 필수
- 파일명: 소문자, 하이픈 구분
- 위키링크: `[[페이지명]]` 형식
- index.md: 카테고리별 정렬, 한 줄 설명 포함
- log.md: `## [YYYY-MM-DD] type | title` 형식

`validate-wiki.sh`가 이 컨벤션을 자동 검증한다.
