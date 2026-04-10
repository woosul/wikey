# Wikey — LLM-Agnostic Knowledge Wiki

> LLM이 점진적으로 구축·유지하는 개인 지식 베이스. [Andrej Karpathy의 LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 패턴 기반.

## What is Wikey?

RAG는 매 쿼리마다 지식을 재검색합니다. Wikey는 다릅니다. LLM이 소스를 읽고, 구조화된 위키를 **점진적으로 구축·유지**합니다. 교차참조는 이미 존재하고, 모순은 이미 표시되어 있으며, 종합 분석은 이미 반영된 상태입니다.

```
사용자 → 소스 추가 → LLM이 위키 구축 → Obsidian으로 브라우징
         (raw/)       (wiki/)            (그래프 뷰, 백링크)
```

## Differentiators

| | Wikey | llmbase | seCall | qmd |
|---|---|---|---|---|
| **Setup** | Obsidian 스킬 설치 + 스키마 복사 | React 앱 설치 | Rust 빌드 | npm 설치 |
| **BYOAI** | Claude, Codex, Gemini, Gemma 4 | OpenAI 종속 | - | - |
| **Korean** | 한영 혼합 기술 용어 정규화 (Phase 2) | - | 형태소 분석 | - |
| **Wiki Builder** | 인제스트/쿼리/린트 | 인제스트/쿼리/린트 | 세션→위키 | 검색만 |
| **Enterprise Path** | Phase 3-4 로드맵 | - | - | - |

## Quick Start

### 1. Prerequisites

- [Obsidian](https://obsidian.md) 1.12+ (CLI 활성화)
- LLM 에이전트: [Claude Code](https://claude.com/claude-code), [Codex CLI](https://github.com/openai/codex), 또는 [Ollama](https://ollama.com) (Gemma 4)

### 2. Setup

```bash
# Clone
git clone https://github.com/woosul/wikey.git
cd wikey

# Obsidian에서 이 폴더를 볼트로 열기
# (좌하단 금고 아이콘 → Open folder as vault → wikey 선택)

# raw/ 디렉토리 생성 (gitignore 대상)
mkdir -p raw/{articles,papers,notes,assets}
```

### 3. First Ingest

Claude Code 세션에서:
```
이 프로젝트의 CLAUDE.md를 읽고, raw/articles/에 있는 소스를 인제스트해줘.
```

Codex CLI에서:
```
AGENTS.md를 읽고, raw/articles/에 있는 소스를 인제스트해줘.
```

### 4. Browse

Obsidian에서 `wiki/` 디렉토리를 브라우징. 그래프 뷰로 연결 구조를 확인.

## Architecture

```
wikey/
├── wikey.schema.md          # Master schema (provider-agnostic)
├── CLAUDE.md                # Claude Code adapter
├── AGENTS.md                # Codex CLI adapter
├── raw/                     # Source documents (immutable, .gitignore)
├── wiki/                    # LLM-maintained wiki (markdown)
│   ├── index.md             # Content catalog
│   ├── log.md               # Activity log (append-only)
│   ├── entities/            # People, orgs, tools
│   ├── concepts/            # Theories, methods
│   ├── sources/             # Source summaries
│   └── analyses/            # Query results saved as pages
├── scripts/                 # Validation & automation
└── local-llm/               # Local LLM prompts (Gemma 4)
```

### Three Layers

| Layer | Location | Owner | Description |
|-------|----------|-------|-------------|
| Raw Sources | `raw/` | User | Immutable. Source of truth. LLM reads only. |
| Wiki | `wiki/` | LLM | Creates, updates, cross-references pages. |
| Schema | `wikey.schema.md` | User+LLM | Conventions, workflows, co-evolved over time. |

### BYOAI — Use Any LLM

| Provider | Role | Best For |
|----------|------|----------|
| Claude Code | Primary ingest/query/lint | Highest quality synthesis |
| Codex CLI | Independent review, cross-verification | Second opinion |
| Gemini | Large source processing (1M+ context) | Long PDFs, transcripts |
| Gemma 4 (local) | Query expansion, reranking, offline | Free, private, offline |

## Roadmap

| Phase | Focus | Status |
|-------|-------|--------|
| **Phase 1** | Zero-Setup personal wiki + BYOAI | In progress |
| **Phase 2** | Korean search + LLM multi-layer search + Community | Planned |
| **Phase 3** | Team server + Web UI | Planned |
| **Phase 4** | Korean enterprise tech KB | Planned |

## Inspired By

- [Andrej Karpathy — LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [llmbase](https://github.com/Hosuke/llmbase) — React UI implementation
- [seCall](https://github.com/hang-in/seCall) — Korean search support
- [qmd](https://github.com/tobi/qmd) — Local hybrid search engine
- [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills) — Obsidian agent skills

## License

[MIT](LICENSE)
