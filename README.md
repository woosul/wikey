# Wikey — LLM이 만드는 개인 지식 위키

> Bring Your Own AI. 어떤 LLM이든, 하나만 있으면 됩니다.

## 이게 뭔가요?

RAG는 질문할 때마다 문서를 다시 찾습니다. Wikey는 다릅니다.
LLM이 소스를 읽고 **영구적인 위키**를 직접 만들어 놓습니다.

```
당신이 하는 일           LLM이 하는 일
─────────────           ──────────────
소스 파일을 넣는다  →   위키 페이지 자동 생성
질문한다           →   위키 기반으로 답변
(가끔) 린트 요청   →   모순/깨진 링크 수정
```

**Obsidian**에서 그래프뷰, 백링크로 위키를 탐색합니다.

## 빠른 시작

```bash
git clone https://github.com/moosuhan/wikey.git
cd wikey
./scripts/setup.sh
```

하나의 명령어로 설치 완료. 상세 가이드: [docs/getting-started.md](docs/getting-started.md)

### LLM 선택 (하나만 있으면 됩니다)

| 프로바이더 | 비용 | 한 줄 설정 |
|-----------|------|-----------|
| Claude Code | 월 $20~100 | `WIKEY_BASIC_MODEL=claude-code` |
| Codex CLI | 토큰 과금 | `WIKEY_BASIC_MODEL=codex` |
| Gemini | 거의 무료 | `WIKEY_BASIC_MODEL=gemini` |
| Ollama (Gemma 4) | **완전 무료** | `WIKEY_BASIC_MODEL=ollama` |

```bash
# 프로바이더 상태 확인
./scripts/check-providers.sh
```

### 소스 넣기 → 인제스트

```bash
cp ~/Downloads/article.md raw/0_inbox/
./scripts/llm-ingest.sh raw/0_inbox/article.md
```

### 질문하기

```bash
./local-llm/wikey-query.sh "이 위키에서 가장 중요한 개념은?"
```

## BYOAI — 어떤 AI든 연결

| 프로바이더 | 인제스트 | 쿼리 | 대용량 PDF | 린트 |
|-----------|---------|------|-----------|------|
| Claude Code | 최고 | 최고 | 200K ctx | 최고 |
| Codex CLI | 좋음 | 좋음 | 128K ctx | 좋음 |
| Gemini API | 스크립트 | 스크립트 | **1M ctx** | 스크립트 |
| Gemma 4 (로컬) | 기본 | **무료** | 131K ctx | 기본 |
| **로컬 검색 (항상)** | — | **$0** | — | — |

검색/임베딩/쿼리 합성은 항상 **로컬**에서 무료로 동작합니다 (Ollama + qmd).
클라우드 LLM은 인제스트/린트에만 사용합니다.

## 구조

```
wikey/                          ← 이 폴더 = Obsidian 볼트 = Git 저장소
├── wiki/                       ← LLM이 만드는 위키 (마크다운)
│   ├── index.md                   전체 페이지 목록
│   ├── entities/                  사람, 도구, 제품
│   ├── concepts/                  이론, 방법, 패턴
│   ├── sources/                   소스 요약
│   └── analyses/                  분석 결과
├── raw/                        ← 소스 문서 (사용자 소유, git 미추적)
├── scripts/                    ← 자동화 스크립트
│   ├── setup.sh                   원커맨드 설치
│   ├── llm-ingest.sh              스크립트 인제스트
│   ├── reindex.sh                 검색 인덱스 갱신
│   └── check-providers.sh        프로바이더 상태 확인
├── local-llm/                  ← 로컬 LLM 설정
│   ├── wikey.conf                 통합 설정 (BASIC_MODEL)
│   └── wikey-query.sh             로컬 쿼리 CLI
├── tools/qmd/                  ← 검색 엔진 (BM25+벡터+리랭킹)
├── wikey.schema.md             ← 위키 컨벤션 (마스터 스키마)
├── CLAUDE.md                   ← Claude Code 어댑터
└── AGENTS.md                   ← Codex CLI 어댑터
```

### 3계층 아키텍처

| 계층 | 위치 | 소유자 | 역할 |
|------|------|--------|------|
| 원시 소스 | `raw/` | 사용자 | 불변. 진실의 원천. LLM은 읽기만. |
| 위키 | `wiki/` | LLM | 페이지 생성/수정, 교차참조, 일관성 유지 |
| 스키마 | `wikey.schema.md` | 사용자+LLM | 컨벤션, 워크플로우 규칙 |

## 로드맵

| Phase | 목표 | 인터페이스 | 상태 |
|-------|------|----------|------|
| **1** | 개인 위키 기반 | 터미널 + Obsidian | **완료** |
| **2** | 한국어 검색 + 멀티 LLM | CLI + 스크립트 | **완료** |
| **3** | Obsidian 플러그인 | 채팅 사이드바, 드래그앤드롭 | 계획 |
| **4** | 웹 인터페이스 | 브라우저 | 계획 |
| **5+** | 기업용 | 팀 서버, RBAC | 계획 |

## 문서

| 문서 | 내용 |
|------|------|
| [설치 및 활용 가이드](docs/getting-started.md) | 초보자를 위한 단계별 가이드 |
| [모델 선택 가이드](local-llm/model-selection-guide.md) | 프로바이더별 비교, 비용, 시나리오 |
| [Phase 3 UX 아키텍처](plan/phase3-ux-architecture.md) | Obsidian 플러그인 → 웹 확장 계획 |

## 영감

- [Andrej Karpathy — LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [llmbase](https://github.com/Hosuke/llmbase) — React UI 구현
- [seCall](https://github.com/hang-in/seCall) — 한국어 검색
- [qmd](https://github.com/tobi/qmd) — 로컬 하이브리드 검색 엔진

## 라이선스

[MIT](LICENSE)
