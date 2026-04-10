# Wikey — Claude Code 설정

> 이 파일은 Claude Code 세션에서 wikey 프로젝트를 작업할 때의 도구 사용법과 실행 체크리스트를 정의한다.

## 필수: 스키마 먼저 읽기

**작업 시작 전 `wikey.schema.md`를 반드시 읽어라.** 위키의 3계층 아키텍처, 워크플로우, 페이지 컨벤션, 핵심 원칙이 모두 그 파일에 정의되어 있다.

## 쓰기 규칙

| 대상 | 권한 |
|------|------|
| `wiki/` | 읽기/쓰기 (페이지 생성·수정·삭제, 인덱스·로그 갱신) |
| `raw/` | **읽기만** (절대 수정하지 않음) |
| `wikey.schema.md` | **사용자 승인 없이 수정 금지** |
| `CLAUDE.md` | **사용자 승인 없이 수정 금지** |

## Claude Code 도구 사용 패턴

### 파일 읽기/쓰기

| 도구 | 용도 |
|------|------|
| **Read** | wiki/ 페이지 읽기, raw/ 소스 읽기, wikey.schema.md 참조 |
| **Write** | 새 위키 페이지 생성 (프론트매터 포함) |
| **Edit** | 기존 위키 페이지 부분 수정 (index.md 갱신, 내용 추가 등) |
| **Bash** | Git 명령, `validate-wiki.sh` 실행, `check-pii.sh` 실행 |
| **Glob** | wiki/ 내 파일 목록 확인 |
| **Grep** | 위키링크 추적, 소스 인용 검색 |

### Obsidian CLI

Obsidian이 실행 중일 때 활용한다. Claude Code의 Read/Write/Edit로 직접 파일을 다루되, CLI는 **검색·백링크·속성 관리**에 활용한다.

```bash
# 기존 페이지 검색 (인제스트 전 중복 확인)
obsidian search query="검색어" limit=10

# 백링크 확인 (삭제/수정 시 영향 범위 파악)
obsidian backlinks file="overview"

# 속성(프론트매터) 업데이트
obsidian property:set name="updated" value="2026-04-10" file="My Note"

# 태그 현황
obsidian tags sort=count counts
```

### Git 사용

```bash
# 인제스트/린트 완료 후 커밋
git add wiki/
git commit -m "ingest: 소스 제목 — N개 페이지 생성/수정"

# 린트 수정 후 커밋
git commit -m "lint: 고아 페이지 정리, 깨진 링크 수정"

# 변경 이력으로 증분 린트 대상 파악
git diff --name-only HEAD~5 -- wiki/
```

## 세션 실행 체크리스트

### 인제스트 세션

```
1. wikey.schema.md 읽기
2. raw/ 소스 읽기
3. 핵심 시사점을 사용자와 논의
4. wiki/sources/source-{name}.md 생성 또는 업데이트 (멱등)
5. wiki/entities/, wiki/concepts/ 페이지 생성 또는 업데이트
6. wiki/index.md 갱신 (새 페이지 등재, 기존 요약 수정)
7. wiki/log.md에 항목 추가 (날짜, 타입, 영향 페이지, 토큰)
8. wiki/overview.md 갱신 (필요시)
9. scripts/validate-wiki.sh 실행 → 통과 확인
10. scripts/check-pii.sh 실행 → 통과 확인
11. Git 커밋
```

### 쿼리 세션

```
1. wikey.schema.md 읽기
2. wiki/index.md 읽기 → 관련 페이지 식별
3. 해당 페이지 읽기 (entities/, concepts/, sources/)
4. 인용과 함께 답변 종합
5. 가치 있는 답변 → wiki/analyses/에 저장 → index.md, log.md 갱신
```

### 린트 세션

```
1. wikey.schema.md 읽기
2. 증분 린트: git diff로 최근 변경 페이지 식별
   전체 린트: wiki/ 전체 스캔
3. 점검: 모순, 고아, 깨진 링크, 인덱스 누락, 삭제된 소스 의존
4. 발견 사항을 사용자에게 보고
5. 사용자 승인 후 수정 실행
6. log.md에 lint 항목 추가
7. validate-wiki.sh → Git 커밋
```

### 소스 삭제 세션

```
1. wikey.schema.md 읽기
2. 삭제된 소스의 wiki/sources/source-{name}.md 확인
3. Grep으로 해당 소스를 인용하는 모든 페이지 검색
4. 각 페이지에서 인용 제거 또는 "근거 삭제됨" 표시
5. wiki/sources/source-{name}.md 삭제 또는 아카이브
6. index.md, log.md 갱신
7. validate-wiki.sh → Git 커밋
```

## 대용량 소스 처리

20페이지+ PDF, 2시간+ 회의록 등 대용량 소스:

1. 섹션/챕터/시간 세그먼트별 분할하여 읽기
2. 각 청크의 핵심을 중간 노트로 정리
3. 합성 패스: 중간 노트를 종합하여 최종 위키 페이지 생성

## PII 주의사항

- `scripts/check-pii.sh`를 커밋 전 반드시 실행
- 소스에 PII가 있을 경우 위키 페이지에 전파하지 않도록 주의
- PII가 위키에 이미 전파된 경우, 사용자 지시에 따라 제거
