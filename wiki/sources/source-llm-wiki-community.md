---
title: "LLM Wiki — 커뮤니티 반응과 사례"
type: source
created: 2026-04-10
updated: 2026-04-10
sources: [idea-comment.md]
tags: [llm-wiki, community, use-cases]
---

# LLM Wiki — 커뮤니티 반응과 사례

> 원본: Karpathy gist 댓글 30개 (2026-04-04) + GeekNews 댓글 15개 + Hacker News 의견 (2026-04-05)
> 원시 소스: `raw/articles/idea-comment.md`

## 실제 사용 사례

### [[farzapedia]] — 개인 Wikipedia 실사례

일기, Apple Notes, iMessage 대화 **2,500건** → **400개 위키 문서** 자동 생성. 친구, 스타트업, 연구, 애니메이션까지 백링크로 상호 연결. `index.md`를 진입점으로 에이전트가 직접 탐색. 1년 전 RAG 방식은 성능이 좋지 않았으나, 파일 시스템 직접 탐색으로 전환 후 효과 극대화.

### .brain 폴더 패턴 (@samflipppy)

프로젝트 루트에 `.brain/` 폴더 — `index.md`, `architecture.md`, `decisions.md`, `changelog.md` 등. 변경 전 읽기 → 변경 후 업데이트 규칙. **세션 간 컨텍스트 손실 해결**이 핵심 가치.

### [[llmbase]] — 오픈소스 구현 (@Hosuke)

React 웹 UI, 모델 폴백 체인, 자율 워커 지속 인제스트. "[[knowledge-compounding|탐색의 축적]]이 가장 강력" — Q&A 답변 → 위키 저장 → 린트가 새 연결 제안.

### [[secall]] — 한국어 지원 (@kurthong)

GitHub 백업, Codex/Gemini 파서, **BM25 한글 검색 가드레일**. 한국어 형태소 분석 기반 검색 보완.

### 기타 사례

- **학습 디렉토리 패턴** (@bhagyeshsp): 15-30분 학습 스프린트, `progress.md` 관리
- **멀티에이전트 위임** (HN): 번아웃 상황에서 위키 기반 워크플로우에 위임. 단, "뇌의 일부가 비어 있는 느낌" — 새로운 기술 부채
- **Gist 멀티에이전트** (@SoMaCoSF): 에이전트 간 gist 전달 워크플로우

## [[andrej-karpathy|Karpathy]] 후속 코멘트: 4가지 장점

| 장점 | 설명 |
|------|------|
| 명시성(Explicit) | AI 지식이 위키로 가시화. 무엇을 알고 모르는지 확인 가능 |
| 데이터 소유권(Yours) | 로컬 저장, 업체 종속 없음 |
| 파일 우선(File over app) | 마크다운 범용 포맷, Unix 도구 호환 |
| [[byoai|AI 선택 자유(BYOAI)]] | Claude, Codex, 오픈소스 등 자유 연결 |

> "에이전트 활용 능력(agent proficiency)은 21세기의 핵심 스킬" — Karpathy

## 미해결 과제

1. **팀 공유** (@geetansharora): 개인 → 팀 전환 설계 필요 (MCP 서버? Git 공유?)
2. **실패 모드** (@alinawab): 위키 성장 시 LLM과 사용자 의도 충돌 지점
3. **페이지 생성 vs 편집 기준** (@alinawab): 위키 구조 설계의 핵심 판단
4. **이미지 처리**: 사전 설명 생성 또는 전용 확장으로 제약 완화
5. **위키 컨텍스트 확장성** (@sudoeng): 위키가 커질수록 AI 감당 가능한가?

## 주요 반론과 리스크

- **"LLM이 claude.md 하나도 유지 못한다"** (HN): 단일 파일도 일관 유지 어려운 현실
- **모델 붕괴 우려** (HN): LLM이 재작성할수록 품질 저하? 반론: 훈련이 아니라 작성이므로 다른 문제
- **"차세대 모델이 해결"** (HN): 10M 컨텍스트면 불필요? 반론: 기다리면 아무것도 못 만듦
- **깊이 사고 상실** (HN): 문서 작성의 진짜 가치는 사고 정리 과정. LLM 위임 시 이를 잃을 수 있음
- **[[rag-vs-wiki|"결국 RAG 아닌가"]]** (HN): 벡터 DB 없지만 의미적 인덱스 구축. 반론: 검색이 아니라 지식 합성

## 관련 도구

| 도구 | 설명 |
|------|------|
| [[llmbase]] | React UI, 모델 폴백 체인 |
| [[secall]] | 한국어 지원, BM25 가드레일 |
| [[qmd]] | 로컬 마크다운 검색 엔진 |
| Binder | 구조화 DB + 양방향 마크다운 동기화 |
| AS Notes | VS Code용 PKM |

## 관련 항목

- [[source-llm-wiki-gist]] — 원문
- [[llm-wiki]] — 패턴 상세
- [[byoai]] — AI 선택 자유 원칙
- [[farzapedia]] — 대표 사례
