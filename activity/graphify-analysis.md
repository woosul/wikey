---
title: "Graphify 종합 분석 리포트"
type: analysis
created: 2026-04-14
tags:
  - graphify
  - knowledge-graph
  - code-analysis
  - tooling
  - coding-agent
sources:
  - "https://github.com/safishamsi/graphify"
  - "https://graphify.net/"
  - "https://pypi.org/project/graphifyy/"
---

# Graphify 종합 분석 리포트

> [safishamsi/graphify](https://github.com/safishamsi/graphify) — 코드, 문서, 논문, 이미지, 영상을 하나의 쿼리 가능한 지식 그래프로 변환하는 오픈소스 AI 코딩 어시스턴트 스킬.

## 1. 설치 및 활용

### 1.1 설치

Python 3.10 이상이 필요해요. PyPI 패키지명은 `graphifyy`이지만 CLI 명령어는 `graphify`로 동일하게 사용할 수 있어요.

```bash
pip install graphifyy
graphify install          # 플랫폼 자동 감지 (Claude Code, Codex 등)
```

영상/오디오 트랜스크립션이 필요하면 비디오 옵셔널 의존성을 추가로 설치해요:

```bash
pip install 'graphifyy[video]'
```

플랫폼별 설치 명령어:

| 플랫폼 | 명령어 |
|--------|--------|
| Claude Code | `graphify install` (자동 감지) |
| Codex | `graphify install --platform codex` |
| Cursor | `graphify cursor install` |
| Gemini CLI | `graphify install --platform gemini` |
| GitHub Copilot CLI | `graphify install --platform copilot` |
| Aider | `graphify install --platform aider` |
| OpenCode | `graphify install --platform opencode` |

Claude Code에 설치하면 두 가지가 자동으로 구성돼요:
1. **CLAUDE.md 지시문** — Claude가 아키텍처 질문 전에 `graphify-out/GRAPH_REPORT.md`를 먼저 읽도록 지시
2. **PreToolUse 훅** — `settings.json`에 등록되어 매 `Glob`/`Grep` 호출 전에 그래프를 자동 참조

### 1.2 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `/graphify .` | 현재 디렉토리 전체를 그래프로 변환 |
| `/graphify ./src` | 특정 디렉토리만 처리 |
| `graphify query "..." --budget N` | 서브그래프 추출 (토큰 예산 제한) |
| `graphify path "NodeA" "NodeB"` | 두 노드 간 최단 경로 탐색 |
| `graphify explain "NodeName"` | 노드에 대한 자연어 설명 생성 |
| `graphify add [URL]` | 외부 URL 콘텐츠를 그래프에 추가 |
| `graphify watch ./src` | 코드 변경 시 자동 재빌드 |
| `graphify update ./src` | 코드 파일만 재추출 |
| `graphify cluster-only ./project` | 클러스터링만 재실행 |
| `graphify hook install` | Git 커밋/브랜치 전환 시 자동 재빌드 |

### 1.3 출력물

| 파일 | 형식 | 용도 |
|------|------|------|
| `graphify-out/graph.html` | 인터랙티브 HTML (vis.js) | 브라우저에서 그래프 시각적 탐색 |
| `graphify-out/GRAPH_REPORT.md` | 마크다운 | 자연어 감사 리포트 (god nodes, 지식 갭, 모호성 등) |
| `graphify-out/graph.json` | JSON | 영구 그래프 데이터, 원본 없이도 쿼리 가능 |
| `graphify-out/transcripts/` | 텍스트 | 영상/오디오 트랜스크립트 캐시 |

### 1.4 지원 파일 형식

- **코드**: 23개 언어 (tree-sitter 기반)
- **문서**: Markdown, PDF, 텍스트
- **이미지**: 스크린샷, 다이어그램, 화이트보드 사진, 다국어 이미지
- **영상/오디오**: MP4, MP3, WAV 등 (faster-whisper + yt-dlp)

## 2. 아키텍처 상세

### 2.1 3-Pass 파이프라인

Graphify의 핵심 아키텍처는 3단계 파이프라인이에요. 각 패스는 독립적으로 동작하며 최종적으로 하나의 NetworkX 그래프로 병합돼요.

#### Pass 1: AST 추출 (결정적, LLM 불필요)

| 항목 | 내용 |
|------|------|
| **입력** | 소스 코드 파일 (23개 언어) |
| **도구** | tree-sitter |
| **출력** | 클래스, 함수, 임포트, 콜 그래프, 독스트링, 설계 근거 주석 |
| **특성** | LLM 없이 순수 구문 분석, 결정적이므로 동일 입력 = 동일 출력 |

tree-sitter 지원 23개 언어: Python, JavaScript, TypeScript, Go, Rust, Java, C, C++, Ruby, C#, Kotlin, Scala, PHP, Swift, Lua, Zig, PowerShell, Elixir, Objective-C, Julia, Vue, Svelte, Dart.

#### Pass 2: 트랜스크립션 (로컬 처리)

| 항목 | 내용 |
|------|------|
| **입력** | 영상/오디오 파일 |
| **도구** | faster-whisper + yt-dlp |
| **출력** | 텍스트 트랜스크립트 |
| **특성** | 완전 로컬, 데이터가 외부로 전송되지 않음, 트랜스크립트 캐싱 |

도메인 인식 프롬프트를 적용하는데, 이 프롬프트는 코퍼스의 god nodes에서 파생돼요. 즉 이미 그래프에 있는 핵심 개념을 Whisper에게 힌트로 제공하여 도메인 전문 용어의 인식 정확도를 높이는 방식이에요.

#### Pass 3: 시맨틱 추출 (LLM 병렬 처리)

| 항목 | 내용 |
|------|------|
| **입력** | 문서, 논문, 이미지, 트랜스크립트 |
| **도구** | Claude subagent (또는 GPT-4, 플랫폼 모델) |
| **출력** | 개념, 관계, 설계 근거 |
| **특성** | 서브에이전트가 병렬로 실행, 파일별 독립 추출 |

### 2.2 NetworkX 그래프 구조

**노드 타입**: 클래스, 함수, 모듈, 개념(concept), 논문 섹션, 다이어그램 등

**엣지 타입 및 분류**:

| 엣지 유형 | 소스 | 신뢰도 |
|-----------|------|--------|
| `calls` | AST (코드) | 항상 1.0 (EXTRACTED) |
| `imports` | AST (코드) | 항상 1.0 (EXTRACTED) |
| `rationale_for` | LLM (시맨틱) | EXTRACTED |
| `semantically_similar_to` | LLM (시맨틱) | 0.0~1.0 (INFERRED) |
| 모호한 관계 | LLM | AMBIGUOUS 태그 |

**하이퍼엣지**: 3개 이상의 노드를 연결하는 그룹 관계를 표현해요. 예를 들어 공유 프로토콜을 구현하는 모든 클래스, 인증 플로우의 모든 함수, 논문 한 섹션의 모든 개념이 하나의 하이퍼엣지로 묶일 수 있어요.

**메타데이터**: 각 노드와 엣지에는 소스 파일, 소스 위치(라인), 신뢰도 점수, 커뮤니티 ID가 포함돼요.

### 2.3 Leiden 알고리즘 클러스터링

Graphify는 graspologic 라이브러리의 Leiden 알고리즘을 사용하여 커뮤니티를 탐지해요. 핵심 원리는 **임베딩 없이 그래프 토폴로지만으로 클러스터링**한다는 것이에요.

작동 방식:
1. Pass 1~3에서 생성된 모든 엣지(구조적 + 시맨틱)가 하나의 NetworkX 그래프에 병합
2. LLM이 추출한 `semantically_similar_to` 엣지가 이미 그래프에 포함되어 있으므로, 이 시맨틱 관계도 커뮤니티 탐지에 직접 영향
3. Leiden 알고리즘이 엣지 밀도 기반으로 커뮤니티를 탐지
4. 별도의 벡터 DB나 임베딩 인덱스가 불필요

이 방식의 장점은 벡터 검색과 달리 **구조적 관계가 보존**된다는 것이에요. "누가 누구를 호출하는지", "어떤 모듈이 어떤 모듈에 의존하는지" 같은 정보가 클러스터링에 반영돼요.

### 2.4 증분 업데이트

파일별 SHA256 해시를 캐싱하여 증분 업데이트를 지원해요:
- `graphify update ./src` — 변경된 코드 파일만 재추출
- `graphify watch ./src` — 파일 변경 감지 시 자동 재빌드
- `graphify hook install` — Git 커밋/브랜치 전환 시 트리거
- 트랜스크립트도 `graphify-out/transcripts/`에 캐싱되어 재실행 시 건너뜀
- INFERRED/AMBIGUOUS 엣지가 AST 재빌드 시에도 보존됨 (v4 수정)

## 3. 모델 및 주요 사양

### 3.1 LLM 사용

Pass 3의 시맨틱 추출에서 **플랫폼의 기본 모델**을 사용해요. Claude Code에서는 Claude subagent가, Cursor에서는 Cursor의 모델이, Codex에서는 GPT 계열이 사용돼요. 모델 API 호출이 유일한 네트워크 통신이며, 텔레메트리나 사용 추적은 전혀 없어요.

### 3.2 faster-whisper 설정

- 완전 로컬 실행 (오디오 데이터가 외부로 나가지 않음)
- 코퍼스 god nodes에서 파생된 도메인 인식 프롬프트 사용
- 트랜스크립트 캐싱으로 재실행 시 즉시 완료
- yt-dlp 연동으로 YouTube 등 온라인 영상도 처리 가능

### 3.3 벤치마크

| 지표 | 수치 | 조건 |
|------|------|------|
| **토큰 절감** | 71.5x | 52개 파일 (코드+논문+이미지) 혼합 코퍼스 |
| **평균 쿼리 비용** | ~1.7k 토큰 | 전체 파일 직접 읽기 시 ~123k 토큰 대비 |
| **대규모 코퍼스** | ~2k 토큰 (BFS 서브그래프) | ~500k 단어 코퍼스에서 ~670k 나이브 대비 |

토큰 절감 효과는 코퍼스 크기에 비례하여 커져요. 파일 수가 많을수록 그래프 기반 서브그래프 추출의 효율이 극대화돼요.

## 4. 코딩 에이전트 활용 (핵심 강점)

이 섹션이 Graphify의 핵심 가치 제안이에요. 단순한 코드 시각화 도구가 아니라, **코딩 에이전트의 컨텍스트 엔지니어링 도구**로서의 역할이 가장 중요해요.

### 4.1 대규모 코드베이스 컨텍스트 제공

전통적으로 코딩 에이전트에게 프로젝트를 이해시키려면 전체 소스를 컨텍스트 윈도우에 넣거나, RAG로 청크를 검색해야 해요. Graphify는 제3의 방법을 제시해요:

1. 전체 코드베이스를 그래프로 변환
2. 에이전트의 질문에 맞는 **서브그래프만 추출** (`graphify query "..." --budget 2000`)
3. 서브그래프에는 노드 레이블, 엣지 타입, 신뢰도 태그, 소스 파일, 소스 위치가 포함
4. 에이전트는 이 구조화된 서브그래프를 통해 프로젝트를 이해

### 4.2 토큰 절감 (71.5x)의 근거

| 접근 방식 | 토큰 비용 | 비고 |
|-----------|----------|------|
| 전체 소스 전달 (나이브) | ~123k | 52파일 기준 |
| Graphify 서브그래프 | ~1.7k | 71.5x 절감 |
| 대규모 (500k 단어) 나이브 | ~670k | — |
| 대규모 BFS 서브그래프 | ~2k | 335x 절감 |

코퍼스가 클수록 절감 효과가 더 커져요. 이유는 간단해요: 전체 소스 크기는 선형 증가하지만, 특정 질문에 관련된 서브그래프 크기는 그래프 밀도에 의해 제한되기 때문이에요.

### 4.3 God Nodes

그래프에서 가장 많은 연결을 가진 노드를 "god nodes"라고 불러요. 이 노드들은 프로젝트의 핵심 모듈이에요. GRAPH_REPORT.md에 자동으로 식별되어 포함돼요.

활용 시나리오:
- **에이전트 온보딩**: 새 프로젝트에서 god nodes부터 읽으면 아키텍처의 뼈대를 빠르게 파악
- **리팩토링 우선순위**: 연결이 가장 많은 노드 = 변경 시 파급 범위가 가장 큰 모듈
- **Whisper 도메인 프롬프트**: god nodes에서 핵심 용어를 추출하여 음성 인식 정확도 향상

### 4.4 코드 리뷰 및 리팩토링: 영향 분석

`graphify path "FunctionA" "FunctionB"`로 두 노드 간 경로를 탐색하면, 함수 변경이 어디까지 영향을 미치는지 파악할 수 있어요. 그래프의 엣지가 `calls`, `imports`, `depends_on` 관계를 명시적으로 추적하기 때문에, **변경 영향 범위(blast radius)**를 정확히 산출할 수 있어요.

PreToolUse 훅이 매 Glob/Grep 전에 자동 발동하므로, 에이전트가 파일을 검색하기 전에 이미 그래프 컨텍스트를 가지고 있어요. 이는 불필요한 파일 읽기를 줄이고, 관련 파일만 정확히 타겟팅하는 효과가 있어요.

### 4.5 온보딩

새 개발자(또는 새 에이전트 세션)가 프로젝트에 합류할 때:
1. `graphify explain "AuthModule"` — 특정 모듈의 자연어 설명
2. GRAPH_REPORT.md — 전체 프로젝트의 god nodes, 놀라운 연결, 지식 갭 요약
3. `graph.html` — 인터랙티브 시각화로 전체 구조 탐색

### 4.6 RAG 대비 장점

| 관점 | 벡터 RAG | Graphify (그래프 토폴로지) |
|------|----------|--------------------------|
| **검색 방식** | 임베딩 유사도 (의미적 근접성) | 그래프 토폴로지 (구조적 관계) |
| **관계 보존** | 청킹 시 구조 손실 | 콜 그래프, 임포트, 의존성 완전 보존 |
| **다중 홉 질문** | 여러 청크 검색 필요, 정보 손실 | BFS/DFS로 경로 탐색, 관계 체인 유지 |
| **클러스터링** | 임베딩 공간의 k-NN | 엣지 밀도 기반 Leiden 커뮤니티 |
| **하이퍼엣지** | 표현 불가 | 3개 이상 노드의 그룹 관계 표현 |
| **별도 인프라** | 벡터 DB 필요 | NetworkX만으로 완결 (Neo4j 불필요) |
| **신뢰도** | 유사도 점수만 | EXTRACTED/INFERRED/AMBIGUOUS 분류 |

## 5. Wikey와의 비교 및 시사점

### 5.1 아키텍처 차이

| 관점 | Wikey | Graphify |
|------|-------|----------|
| **패러다임** | 위키 기반 지식 축적 (마크다운 페이지) | 그래프 기반 구조 추출 (NetworkX) |
| **지식 단위** | 위키 페이지 (entity, concept, source, analysis) | 그래프 노드 (function, class, concept) |
| **관계 표현** | 위키링크 (`[[PageName]]`) | 타입드 엣지 (calls, imports, semantically_similar_to) |
| **검색** | qmd 하이브리드 (BM25 + 벡터 + RRF) | BFS/DFS 서브그래프 추출 |
| **클러스터링** | 수동 카테고리 (entities/, concepts/ 등) | Leiden 자동 커뮤니티 탐지 |
| **증분 처리** | LLM 세션별 수동 인제스트 | SHA256 해시 기반 자동 증분 |
| **소스 타입** | PDF, 텍스트, 웹 (raw/ 폴더) | 코드 + 문서 + 이미지 + 영상 |
| **영속성** | 마크다운 파일 (Git 추적) | JSON + HTML (graphify-out/) |
| **LLM 의존도** | 인제스트/쿼리에 LLM 필수 | Pass 1은 LLM 불필요 (tree-sitter) |

### 5.2 위키 기반 vs 그래프 기반

Wikey의 강점은 **인간 가독성**이에요. 위키 페이지는 사람이 Obsidian에서 직접 읽고, 그래프 뷰로 탐색하고, 백링크로 연결을 추적할 수 있어요. 지식이 자연어로 축적되므로 LLM이 새 세션에서도 바로 활용 가능해요.

Graphify의 강점은 **구조적 정밀도**예요. 코드의 콜 그래프, 임포트 체인, 의존성 관계가 타입드 엣지로 정확히 표현되고, 이를 기반으로 영향 분석이나 서브그래프 추출이 가능해요.

두 접근은 상호 배타적이지 않아요. Wikey는 "지식이 무엇인지" 설명하고, Graphify는 "구조가 어떻게 연결되어 있는지" 보여줘요.

### 5.3 Phase 4에서 수용 가능한 기능

1. **증분 해시 캐싱**: Wikey의 현재 인제스트는 세션 기반 수동 실행이에요. Graphify처럼 파일별 SHA256 해시를 도입하면 변경된 소스만 재인제스트하는 자동화가 가능해요.

2. **God Nodes 개념 도입**: `wiki/index.md`에서 가장 많이 참조되는 페이지(허브 노드)를 자동 식별하여 "핵심 개념" 섹션을 GRAPH_REPORT 스타일로 생성할 수 있어요. Obsidian 그래프 뷰의 정량화 버전이에요.

3. **타입드 엣지**: 현재 Wikey의 위키링크는 단순 참조(`[[Page]]`)이지만, 관계 유형(인용, 반박, 확장, 전제 등)을 메타데이터로 추가하면 그래프 기반 분석이 강화돼요.

4. **서브그래프 쿼리**: qmd의 하이브리드 검색에 그래프 토폴로지 기반 검색을 추가할 수 있어요. "이 개념과 2홉 이내의 모든 관련 페이지"같은 쿼리가 가능해져요.

5. **PreToolUse 훅 패턴**: Claude Code 세션에서 매 파일 검색 전에 위키 인덱스를 자동 참조하는 훅을 도입하면, 에이전트의 컨텍스트 효율이 향상돼요.

단, Graphify의 3-Pass AST 파이프라인은 Wikey의 범위 밖이에요. Wikey는 코드베이스가 아닌 지식(논문, 아티클, 메모)을 대상으로 하므로, tree-sitter 기반 코드 분석은 해당되지 않아요. 수용할 가치가 있는 것은 **그래프 구조 + 증분 캐싱 + 토폴로지 검색**이라는 아키텍처 원칙이에요.

---

## 참고 자료

- [safishamsi/graphify GitHub](https://github.com/safishamsi/graphify)
- [Graphify 공식 사이트](https://graphify.net/)
- [graphifyy PyPI](https://pypi.org/project/graphifyy/)
- [Graphify + Claude Code 통합 가이드](https://graphify.net/graphify-claude-code-integration.html)
- [Leiden Community Detection — Graphify](https://graphify.net/leiden-community-detection.html)
- [Knowledge Graphs for AI Coding Assistants — Graphify](https://graphify.net/knowledge-graph-for-ai-coding-assistants.html)
- [From Karpathy's LLM Wiki to Graphify — Analytics Vidhya](https://www.analyticsvidhya.com/blog/2026/04/graphify-guide/)
- [Graphify in Practice — OpenClaw Blog](https://openclawapi.org/en/blog/2026-04-12-graphify-knowledge-graph)
