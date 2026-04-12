# Wikey — LLM-Agnostic Knowledge Wiki

> A personal knowledge base that LLMs incrementally build and maintain. Based on [Andrej Karpathy's LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) pattern.

## What is Wikey?

RAG rediscovers knowledge from scratch on every query. Wikey is different. The LLM reads your sources and **incrementally builds a persistent wiki** — cross-references already exist, contradictions are already flagged, and the synthesis already reflects everything you've read.

```
User → Add source → LLM builds wiki → Browse in Obsidian
        (raw/)       (wiki/)            (graph view, backlinks)
```

## Differentiators

| | Wikey | llmbase | seCall | qmd |
|---|---|---|---|---|
| **Setup** | Install Obsidian skill + copy schema | Install React app | Build from Rust | npm install |
| **BYOAI** | Claude, Codex, Gemini, Gemma 4 | OpenAI-dependent | - | - |
| **Korean** | kiwipiepy morpheme preprocessing + term normalization | - | kiwi-rs morpheme analysis | - |
| **Wiki Builder** | Ingest / Query / Lint | Ingest / Query / Lint | Session-to-wiki | Search only |
| **Enterprise Path** | Phase 3-4 roadmap | - | - | - |

## Quick Start (5분 안에 시작하기)

### 1. Clone + Setup

```bash
git clone https://github.com/moosuhan/wikey.git
cd wikey
./scripts/setup.sh          # 자동 설정 (Ollama, Python, qmd)
```

setup.sh가 자동으로 확인/설치하는 것:
- Ollama + Gemma 4 (12B) — 로컬 쿼리/검색
- Python + kiwipiepy — 한국어 형태소 처리
- qmd 검색 컬렉션 초기화
- .env 템플릿 복사

### 2. LLM 프로바이더 선택

```bash
# 프로바이더 상태 확인
./scripts/check-providers.sh

# wikey.conf에서 기본 모델 선택 (하나만 있어도 됨)
# WIKEY_BASIC_MODEL=claude-code   ← Claude Pro/Max 구독자
# WIKEY_BASIC_MODEL=codex         ← OpenAI API 사용자
# WIKEY_BASIC_MODEL=gemini        ← 저가/무료 (API 키만)
# WIKEY_BASIC_MODEL=ollama        ← 완전 오프라인 (무료)
```

상세 가이드: [`local-llm/model-selection-guide.md`](local-llm/model-selection-guide.md)

### 3. 첫 인제스트

소스 파일을 `raw/0_inbox/`에 넣고:

```bash
# 방법 A: 스크립트 인제스트 (모든 프로바이더)
./scripts/llm-ingest.sh raw/0_inbox/my-source.md

# 방법 B: Claude Code 세션
# → "이 소스를 인제스트해줘"

# 방법 C: Codex CLI
# codex exec "Read AGENTS.md and ingest raw/0_inbox/my-source.md"
```

### 4. 쿼리

```bash
# 로컬 쿼리 (Gemma 4, $0)
./local-llm/wikey-query.sh "질문"

# 검색만 (합성 없이)
./local-llm/wikey-query.sh --search "키워드"
```

### 5. Obsidian에서 브라우징

Obsidian에서 이 폴더를 볼트로 열면 `wiki/`를 그래프뷰, 백링크로 탐색할 수 있습니다.

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
├── scripts/
│   ├── setup.sh             # One-command setup
│   ├── llm-ingest.sh        # Script-based ingest (any provider)
│   ├── reindex.sh           # Full indexing pipeline (1 command)
│   ├── check-providers.sh   # LLM provider status check
│   ├── cost-tracker.sh      # Cost tracking CLI
│   └── validate-wiki.sh     # Wiki validation
├── local-llm/
│   ├── wikey.conf           # Unified LLM config (BASIC_MODEL)
│   ├── wikey-query.sh       # Local query CLI (qmd + Gemma 4)
│   └── model-selection-guide.md  # Provider comparison guide
└── tools/qmd/               # Search infrastructure (vendored, tobi/qmd)
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
| **Phase 1** | Zero-setup personal wiki + BYOAI foundation | **Complete** |
| **Phase 2** | Korean search + multi-LLM pipeline + vault template packaging | **Complete** |
| **Phase 3** | Obsidian plugin (GUI: chat sidebar, drag-and-drop ingest, settings) | Planned |
| **Phase 4** | Web interface (Next.js, shared core with Phase 3) | Planned |
| **Phase 5+** | Enterprise package (team server, RBAC, audit trail) | Planned |

## Inspired By

- [Andrej Karpathy — LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [llmbase](https://github.com/Hosuke/llmbase) — React UI implementation
- [seCall](https://github.com/hang-in/seCall) — Korean search support
- [qmd](https://github.com/tobi/qmd) — Local hybrid search engine
- [kepano/obsidian-skills](https://github.com/kepano/obsidian-skills) — Obsidian agent skills

## License

[MIT](LICENSE)
