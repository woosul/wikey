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
| **Korean** | KR/EN tech term normalization (Phase 2) | - | Morphological analysis | - |
| **Wiki Builder** | Ingest / Query / Lint | Ingest / Query / Lint | Session-to-wiki | Search only |
| **Enterprise Path** | Phase 3-4 roadmap | - | - | - |

## Quick Start

### 1. Prerequisites

- [Obsidian](https://obsidian.md) 1.12+ (with CLI enabled)
- An LLM agent: [Claude Code](https://claude.com/claude-code), [Codex CLI](https://github.com/openai/codex), or [Ollama](https://ollama.com) (Gemma 4)

### 2. Setup

```bash
# Clone
git clone https://github.com/woosul/wikey.git
cd wikey

# Open this folder as a vault in Obsidian
# (vault icon at bottom-left → Open folder as vault → select wikey)

# Create raw/ directories (gitignored — not committed)
mkdir -p raw/{0_inbox,1_projects,2_areas,3_resources,4_archive,9_assets}
```

### 3. First Ingest

In a Claude Code session:
```
Read the CLAUDE.md in this project and ingest the sources in raw/0_inbox/.
```

In Codex CLI:
```
Read AGENTS.md and ingest the sources in raw/0_inbox/.
```

### 4. Browse

Open Obsidian and browse `wiki/`. Use Graph View to visualize connections.

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
| **Phase 1** | Zero-setup personal wiki + BYOAI | **Complete** |
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
