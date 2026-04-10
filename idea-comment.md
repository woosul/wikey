# 커뮤니티 의견 및 사례 정리

> 출처:
> - [Karpathy LLM Wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 댓글 30개 (2026-04-04)
> - [GeekNews — LLM-Wiki](https://news.hada.io/topic?id=28208) 한국 커뮤니티 댓글 15개 + Hacker News 의견 (2026-04-05)

---

## 0. Karpathy 후속 코멘트: LLM Wiki 개인화의 4가지 장점

Farzapedia(일기·메모·메시지 2,500건 → 400개 위키 문서) 사례를 언급하며 정리:

| 장점 | 설명 |
|------|------|
| **명시성(Explicit)** | AI의 지식이 위키로 가시화됨. 무엇을 알고 모르는지 직접 확인·관리 가능 |
| **데이터 소유권(Yours)** | 로컬 저장, 특정 업체에 종속되지 않음 |
| **파일 우선(File over app)** | 마크다운 등 범용 포맷. Unix 도구·CLI·Obsidian 등 어디서든 활용 |
| **AI 선택 자유(BYOAI)** | Claude, Codex, OpenCode 등 원하는 AI 연결. 오픈소스 파인튜닝도 가능 |

> "에이전트 활용 능력(agent proficiency)은 21세기의 핵심 스킬" — Karpathy

---

## 1. 실제 사용 사례

### `.brain` 폴더 패턴 — @samflipppy

프로젝트 루트에 `.brain/` 폴더를 두고, 마크다운 파일을 AI 에이전트의 영구 메모리로 사용하는 방식.

**구조:**
- `index.md` — 프로젝트 현재 상태, 배포 현황, 우선순위
- `architecture.md` — 스택, 데이터 플로우, 파일 맵, 설계 패턴
- `decisions.md` — 모든 아키텍처 결정과 근거, 트레이드오프
- `changelog.md` — 변경 이력 (파일명 포함)
- `deployment.md` — URL, 환경변수, 배포 방법
- `firestore-schema.md` — 컬렉션, 필드, 관계
- `pipeline.md` — 실제 데이터 (커밋 제외, 로컬 전용)

**규칙:** 변경 전 `.brain` 읽기 → 변경 후 `.brain` 업데이트 → git에는 커밋하지 않음

**핵심 가치:** 세션 간 컨텍스트 손실 해결. 3일 후 새 대화를 시작해도 에이전트가 이전 상태를 정확히 파악. changelog만으로도 "우리가 Genkit 스키마 강제에서 수동 JSON 파싱으로 전환한 이유는 Gemini가 구조화된 출력에 계속 실패했기 때문. 되돌리지 말 것" 같은 맥락을 유지.

### 학습 디렉토리 패턴 — @bhagyeshsp

개인 `learning/` 디렉토리에 주제별 하위 디렉토리를 두고, 루트에 `progress.md`를 관리하는 15-30분 학습 스프린트 시스템.

- 에이전트가 학습자 프로필과 선호에 맞춰 개념을 가르침
- 하나의 개념 레이어가 끝나면 세션 종료
- 관련 주제의 진행 파일 업데이트, 다음 세션 목표 기록
- 다음 날 에이전트 인스턴스가 이어서 진행

### Gist를 에이전트 간 메시지로 활용 — @SoMaCoSF

개발 중 에이전트에게 현재 상태를 gist로 발행하도록 지시. SVG 다이어그램, Mermaid, Sankey 로직을 포함. 그 gist를 다른 프론티어 모델(@grok 등)에게 읽히고, 응답을 또 다른 에이전트에게 전달하는 멀티-에이전트 워크플로우.

### Obsidian + Zed 코드 에디터 조합 — @logancautrell

Zed 코드 에디터와 Obsidian을 함께 사용하여 유사한 프로세스를 이미 구축. Karpathy의 gist로 워크플로우를 정제할 계획.

### llmbase 오픈소스 구현 — @Hosuke

Karpathy 아이디어의 오픈소스 구현: [github.com/Hosuke/llmbase](https://github.com/Hosuke/llmbase)

- Obsidian 대신 **React 웹 UI**를 탑재하여 어디서든 단일 명령으로 배포 가능
- "탐색이 축적된다" 원칙이 가장 강력했음 — Q&A 답변이 위키에 저장되고, 린트가 새 연결을 제안
- **모델 폴백 체인** 유용: 1차 LLM 타임아웃 시 2차 모델이 이어받아 위키가 수동 개입 없이 계속 성장
- 자율 워커를 통한 지속적 인제스트와 잘 결합됨

### 프론트매터 + 연결 패턴 — @jshph

위키 페이지에 `created: "[[2026-04-04]]"` 같은 프론트매터를 추가하고, CLAUDE.md에서 에이전트가 새 지식을 구성하는 방법을 기술. 에이전트가 최신 콘텐츠 중심으로 작업 기억을 구축하되, 핵심 아이디어는 전체 볼트에 걸쳐 매핑하는 설계 패턴.

### Farzapedia — 개인 Wikipedia 실사례 — @xguru (GeekNews 소개)

일기, Apple Notes, iMessage 대화 **2,500개 항목**을 입력으로 **400개의 상세 위키 문서**를 자동 생성한 사례.

- 친구, 스타트업, 관심 연구 분야, 좋아하는 애니메이션과 그 영향까지 포함, 백링크로 상호 연결
- 위키는 개인 열람용이 아닌 **에이전트가 활용하는 지식 베이스**로 설계 — 파일 구조와 백링크가 에이전트가 크롤링하기 용이한 형태
- Claude Code를 위키에 연결하고 `index.md`를 진입점으로 삼아 에이전트가 필요한 페이지를 직접 탐색
- 활용 예: "최근 영감을 받은 이미지와 영화를 참고해 카피와 디자인 아이디어를 줘" → 에이전트가 Studio Ghibli 다큐 기반 "철학" 문서, YC 기업 랜딩 페이지, 1970년대 Beatles 굿즈 이미지까지 종합해 답변
- 1년 전 RAG 기반으로 유사 시스템 구축했으나 **성능이 좋지 않았고**, 에이전트가 파일 시스템을 통해 직접 탐색하는 방식이 훨씬 효과적

### seCall — 한국어 지원 구현체 — @kurthong (GeekNews)

[github.com/hang-in/seCall](https://github.com/hang-in/seCall)

- 여러 하드웨어 사용 시 Obsidian 볼트를 **GitHub 백업으로 연동**
- Codex, Gemini용 파서 내장
- **BM25가 한글 검색에 약한 문제**를 해결하기 위한 한국어 가드레일 적용

### Claude Code superpowers로 즉시 구축 — @stadia (GeekNews)

기본 볼트를 초기화하고 gist 파일 하나를 읽게 한 뒤 "이 아이디어를 구체화하고 싶다"고 이야기하니, Claude Code의 **브레인스톰 스킬**과 함께 전체 틀을 잡고 CLAUDE.md와 Obsidian 플러그인 설정까지 완료.

### 번아웃 상황에서의 멀티에이전트 위임 — Hacker News

번아웃과 가족 간병으로 집중력이 떨어지자 **멀티에이전트 워크플로우**에 많은 부분을 위임. Obsidian 기반 마크다운 위키 중심으로 작동하지만, 결과적으로 **새로운 형태의 기술 부채**가 생김 — "마치 뇌의 일부가 비어 있는 느낌." 그래도 이 위키 워크플로우는 너무 중독적이라 멈추기 어렵다고 함.

---

## 2. 개선 제안 및 질문

### 팀 공유 방법 — @geetansharora

**질문:** 지식 베이스를 팀과 어떻게 공유할 수 있는가?

현재 팀에서는 RAG를 만들고 MCP 서버를 구축한 뒤, 다른 사용자가 해당 MCP 서버에 연결하여 접근하는 방식. LLM Wiki도 유사한 접근을 따를지, 다른 방법이 있는지에 대한 질문.

### 실패 모드 — @alinawab

**질문:** 시스템이 어디서부터 사용자와 충돌하기 시작하는가?

위키가 성장하면서 LLM이 사용자의 의도와 다르게 행동하기 시작하는 지점, 한계, 실패 패턴에 대한 질문.

### 페이지 생성 vs 편집 기준 — @alinawab

**질문:** 새 페이지를 만들 때와 기존 페이지를 편집할 때를 어떻게 결정하는가?

위키 구조 설계의 핵심 판단 기준에 대한 질문.

### 이미지 처리 대안 — @jamesalmeida, @lightningRalf

원문에서 "LLM은 인라인 이미지가 포함된 마크다운을 한 번에 읽을 수 없다"는 제약에 대해:

- **@jamesalmeida:** 별도 패스 대신, LLM이 이미지에 대한 상세 설명을 사전 생성하여 텍스트에 포함시키면 향후 읽기에서 전체 컨텍스트를 한 번에 처리 가능
- **@lightningRalf:** Pi에게 해당 기능을 위한 확장을 만들라고 지시하면 됨

### Dataview vs Bases 플러그인 — @ppeirce

원문이 Dataview 플러그인을 언급하지만, Obsidian의 **퍼스트파티 Bases 플러그인**이 이제 더 나은 대안.

### append-and-review 노트와의 통합 — @expectfun

Karpathy의 별도 블로그 포스트 [The append-and-review note](https://karpathy.bearblog.dev/the-append-and-review-note) (2025)에서 설명한 "추가하고 검토하는 노트" 패턴이 에이전트와 함께 더 좋아질 수 있으며, LLM Wiki의 일부가 될 수 있을 것. 두 아이디어의 결합 가능성에 대한 탐색 제안.

### Cursor Plan 모드와의 비교 — @tomicz

Cursor의 Plan 모드와 유사한 점에 대한 질문. (답: LLM Wiki는 코드가 아닌 지식 전반에 대한 영구 위키 패턴으로, Plan 모드보다 범위가 넓다.)

### 위키 컨텍스트 확장 한계 — @sudoeng (GeekNews)

AI가 점점 쌓여가는 위키 컨텍스트를 감당할 수 있을지에 대한 우려. @kurthong은 "큰 맥락에선 과거 대화의 검색이라 정리 이슈만 교통정리를 잘하면 좋은 아이디어"라고 답변.

### 모델 붕괴(Model Collapse) 우려 — Hacker News

LLM이 문서를 작성할수록 기존의 정확한 정보를 점점 덜 간결하게 재작성하며 품질이 누적 저하된다는 Nature 논문 언급. 다만 반론: 이 gist는 LLM을 **훈련**하는 것이 아니라, 이미 학습된 모델을 이용해 개인용 위키를 **작성**하는 내용이므로 모델 붕괴와는 다른 문제.

### "LLM이 claude.md 하나도 제대로 유지 못한다" — Hacker News

실제 사용 경험에서 LLM이 단일 설정 파일도 일관되게 유지하지 못하는 한계를 지적. 위키 전체는 더 불가능하다는 회의론.

### 차세대 모델이 해결할 문제인가 — Hacker News

10M 컨텍스트나 1000tps급 차세대 모델이 나오면 이런 접근은 무의미해질 것이라는 의견. 반론: "다음 세대 모델이 다 해결할 것"이라는 논리를 믿으면 **아무것도 만들지 않게 된다**. 목표는 모든 컨텍스트를 유지하는 게 아니라 **질의 가능한 메모리**를 만드는 것.

### 깊이 생각하는 능력 상실 우려 — Hacker News

LLM에 위키 관리를 위임하면 '깊이 생각하는 능력'을 잃을 수 있다는 우려. **"문서 작성의 진짜 가치는 결과물이 아니라, 작성 과정에서 사고가 정리되는 것."** 오프라인 취미(산책, 수영 등)로 생각할 시간을 되찾으라는 조언.

### "이건 결국 RAG 아닌가" 논쟁 — Hacker News

벡터 DB는 없지만 의미적 연결 인덱스를 만들고 계층적 구조를 구성해 검색을 돕는 점에서 RAG와 동일하다는 의견. 반론: LLM이 **위키를 직접 작성하고 유지**하며 백링크와 불일치 검사를 수행하는 것은 검색이 아니라 **지식 합성(knowledge synthesis)**에 가깝다. "LLM이 스스로 Zettelkasten을 관리하는 느낌."

### 구조화된 데이터와 마크다운의 한계 — Hacker News

문서와 구조화된 데이터(작업 항목, ADR 등)를 섞으면 마크다운만으로는 질의가 어려워짐. **Binder** 프로젝트: 구조화된 DB에 데이터를 저장하되 양방향 동기화된 마크다운으로 렌더링. LSP로 자동완성과 검증을 제공하고, 에이전트나 스크립트는 CLI/MCP를 통해 동일 데이터에 접근.

---

## 3. 관련 도구 및 리소스

### 구현체 및 대안 프로젝트

| 도구/리소스 | 설명 | 출처 |
|------------|------|------|
| [llmbase](https://github.com/Hosuke/llmbase) | LLM Wiki 오픈소스 구현 (React UI, 모델 폴백 체인) | @Hosuke (gist) |
| [seCall](https://github.com/hang-in/seCall) | 한국어 지원 구현체 (GitHub 백업, Codex/Gemini 파서, BM25 한글 가드레일) | @kurthong (GeekNews) |
| [hmem](https://github.com/) | 관리 중심 접근 — 작업공간 기억을 태스크/프로젝트와 연결, SPA 인터페이스 | HN |
| [commonplace](https://github.com/) | LLM 기반 KB — "이론이 곧 런타임"이 되는 구조 | HN |
| [llmdoc](https://github.com/) | 코드베이스 전용 — 파일 변경 해시 감지, LLM 요약 캐시, CLI 접근 | HN |
| [atomic](https://github.com/) | 위키 합성과 비슷한 아이디어의 AI 지식베이스 | HN |
| Binder | 구조화된 DB + 양방향 마크다운 동기화 + LSP + MCP | HN |
| [AS Notes](https://asnotes.io) | VS Code용 PKM — 위키링크, mermaid, LaTeX 지원 | HN |

### Obsidian 생태계 도구

| 도구 | 설명 | 출처 |
|------|------|------|
| [qmd](https://github.com/tobi/qmd) | 로컬 마크다운 검색 엔진 (BM25/벡터, MCP 서버) | 원문 |
| Obsidian Web Clipper | 웹 기사 → 마크다운 변환 | 원문 |
| Obsidian Bases | 퍼스트파티 데이터 쿼리 플러그인 (Dataview 대안) | @ppeirce (gist) |
| Obsidian Graph View | 위키 연결 구조 시각화 | 원문 |
| Marp | 마크다운 → 슬라이드 덱 | 원문 |
| Obsidian CLI | 공개된 CLI 도구 | GeekNews 관련글 |

### 참고 자료

| 리소스 | 설명 | 출처 |
|--------|------|------|
| [append-and-review 노트](https://karpathy.bearblog.dev/the-append-and-review-note) | Karpathy의 추가-검토 메모 패턴 (2025) | @expectfun (gist) |
| [Tolkien Gateway](https://tolkiengateway.net/wiki/Main_Page) | 팬 위키 사례 (수천 개 상호링크 페이지) | 원문 |
| Licklider "Man-Computer Symbiosis" (1960) | 인간이 목표 설정, 컴퓨터가 가설→모델→검증. 지능 증폭(IA) 개념 | HN |
| Vannevar Bush "Memex" (1945) | 개인 큐레이션 지식 저장소, 연상 트레일 | 원문 |
| DocMason | Multimodal KB + Agentic RAG — PPT/Excel 다이어그램 추출 후 에이전트 분석 | HN |

---

## 4. 핵심 인사이트 요약

### 합의된 강점

1. **컨텍스트 손실이 최대 문제** — `.brain` 폴더든 위키든, 세션 간 지식 영속성이 핵심 가치
2. **탐색의 축적이 가장 강력** — Q&A 결과를 다시 위키에 저장하면 지식이 복리로 성장 (@Hosuke, Farzapedia 확인)
3. **RAG보다 에이전트 직접 탐색이 효과적** — Farzapedia: 1년 전 RAG는 성능이 좋지 않았으나, 파일 시스템 직접 탐색 방식으로 전환 후 효과 극대화
4. **4가지 차별점**: 명시성, 데이터 소유권, 파일 우선, AI 선택 자유 (Karpathy)

### 미해결 과제

5. **팀 공유 방법** — 개인 위키에서 팀 위키로의 전환은 추가 설계 필요 (MCP 서버? Git 공유?)
6. **한국어 검색 한계** — BM25가 한글에 약해 별도 가드레일 필요 (@kurthong)
7. **위키 컨텍스트 확장성** — AI가 점점 쌓이는 위키를 감당할 수 있는지 (@sudoeng)
8. **이미지 처리** — 사전 설명 생성, 전용 확장 등으로 현재 제약 완화 가능

### 주요 반론 및 리스크

9. **"LLM이 claude.md 하나도 제대로 유지 못한다"** — 단일 설정 파일도 일관 유지 어려운 현실 (HN)
10. **새로운 기술 부채** — LLM에 위임하면 "뇌의 일부가 비어 있는 느낌", 깊이 생각하는 능력 상실 우려 (HN)
11. **"차세대 모델이 해결할 문제"** — 10M 컨텍스트 모델이 나오면 무의미할 수 있음. 반론: 그걸 기다리면 아무것도 못 만듦
12. **검색 vs 합성 논쟁** — "결국 RAG" vs "지식 합성(Zettelkasten 관리)은 다르다"
13. **문서 작성의 본질적 가치** — "문서 작성의 진짜 가치는 결과물이 아니라 사고 정리 과정" (HN)
