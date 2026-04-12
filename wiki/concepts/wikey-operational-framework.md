---
title: Wikey 운영 프레임워크
type: concept
created: 2026-04-12
updated: 2026-04-12
sources: [source-claude-code-config.md]
tags: [워크플로우, 아키텍처, 에이전트, 프로세스]
---

# Wikey 운영 프레임워크

이 문서는 wikey 프로젝트를 관리하고 에이전트가 작업을 수행하기 위한 표준화된 운영 절차(SOP)와 아키텍처 가이드를 정의한다. 이는 Claude Code 세션에서 작업할 때의 도구 사용법과 실행 체크리스트를 포함한다. [[wikey.schema.md]]에 정의된 핵심 원칙을 기반으로 한다.

## 1. 아키텍처 및 규칙

### 3계층 아키텍처
위키는 원시 소스(Raw) / 위키(Wiki) / 스키마(Schema)의 3계층 구조를 따른다. [[three-layer-architecture]]

### 쓰기 규칙
| 대상 | 권한 |
|------|------|
| `wiki/` | 읽기/쓰기 (페이지 생성·수정·삭제, 인덱스·로그 갱신) |
| `raw/` | **내용 수정 금지** (inbox→PARA 분류 이동은 허용, 사용자 승인 후) |
| `wikey-core/` | 읽기/쓰기 (TypeScript 핵심 로직) |
| `wikey-obsidian/` | 읽기/쓰기 (Obsidian 플러그인) |
| `wikey.schema.md` | **사용자 승인 없이 수정 금지** |
| `CLAUDE.md` | **사용자 승인 없이 수정 금지** |

## 2. 핵심 워크플로우 및 도구

### 도구 사용 패턴
에이전트는 다음 도구들을 활용한다:
*   **Read**: wiki/ 페이지 읽기, raw/ 소스 읽기, wikey.schema.md 참조
*   **Write**: 새 위키 페이지 생성 (프론트매터 포함)
*   **Edit**: 기존 위키 페이지 부분 수정 (index.md 갱신, 내용 추가 등)
*   **Bash**: Git 명령, `setup.sh`, `validate-wiki.sh`, `check-pii.sh` 등 시스템 스크립트 실행.
*   **qmd MCP**: 위키 하이브리드 검색 (BM25+벡터+RRF). FTS5 인덱스는 한국어 형태소 전처리 적용됨 (`korean-tokenize.py --batch`).

### 주요 세션 체크리스트

**1. 인제스트 세션:**
1. `wikey.schema.md` 읽기
2. `raw/` 소스 읽기
3. 핵심 시사점 논의
4. `wiki/sources/source-{name}.md` 생성 또는 업데이트 (멱등)
5. `wiki/entities/`, `wiki/concepts/` 페이지 생성 또는 업데이트
6. `wiki/index.md` 갱신
7. `wiki/log.md`에 항목 추가
8. `wiki/overview.md` 갱신
9. `scripts/check-pii.sh` 실행 → 통과 확인
10. `scripts/reindex.sh` 실행 → 전체 인덱싱
11. Git 커밋

**2. 쿼리 세션:**
1. `wiki/index.md` 읽기 → 관련 페이지 식별
2. 해당 페이지 읽기
3. 인용과 함께 답변 종합
4. 가치 있는 답변 → `wiki/analyses/`에 저장 → index.md, log.md 갱신

**3. 린트 세션:**
1. `git diff`로 최근 변경 페이지 식별
2. 점검: 모순, 고아, 깨진 링크, 인덱스 누락, 삭제된 소스 의존
3. 발견 사항 보고 및 사용자 승인 후 수정 실행
4. `log.md`에 lint 항목 추가
5. `validate-wiki.sh` → Git 커밋

## 3. 대용량 소스 처리

20페이지 이상의 PDF 등은 **2단계 인제스트** 절차를 따른다:
*   **Phase A:** `Read` 도구로 20p씩 순차 읽기 → 섹션 인덱스 생성
*   **Phase B:** 핵심 섹션만 상세 읽기 → 위키 페이지 생성
*   **Phase C:** 쿼리 시 섹션 인덱스 참조 → 해당 페이지만 온디맨드 읽기

## 4. API 키 및 보안

*   **API 키 관리:** `.env` 파일로 관리하며, 이 파일은 `.gitignore`에 포함되어야 한다. **절대 Read 도구로 열지 않는다.**
*   **PII 주의:** `scripts/check-pii.sh`를 커밋 전 반드시 실행한다.