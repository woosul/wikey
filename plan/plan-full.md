# Wikey — 프로젝트 전체 계획 (plan-full)

> **역할**: wikey 프로젝트의 전체 로드맵·운영 체제·기술 스택·문서 체계를 한 페이지로 요약한 단일 진입점. Phase 별 상세는 `plan/phase-N-todo.md` + `activity/phase-N-result.md` 로 위임.
> **최종 개정**: 2026-04-25 (Phase 5 진입 시점)
> **이력**: 2026-04-25 기존 Phase 3 설계서였던 `plan/plan-full.md` 를 `plan/phase-3-full.md` 로 분리하고, 본 파일을 전체 계획 문서로 신규 작성.

## 1. 프로젝트 정체성

Wikey 는 Andrej Karpathy 의 [LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 패턴을 기반으로 한 **개인 지식 베이스** 입니다. LLM 이 원시 소스를 읽고 구조화된 위키를 점진적으로 구축·유지하며, 지식이 매 쿼리마다 재도출되는 RAG 와 달리 **영구적으로 축적** 된다는 점이 차별점입니다.

핵심 철학은 `wikey.schema.md` 에 고정되어 있으며, 다음 네 가지 원칙으로 요약됩니다.

| 원칙 | 설명 |
|------|------|
| **Explicit** | LLM 의 지식을 위키 파일로 가시화 — 무엇을 알고 모르는지 사용자가 직접 확인·관리 |
| **Yours** | 모든 데이터를 로컬 마크다운으로 보유. 특정 LLM 업체에 종속되지 않음 |
| **File over app** | 마크다운·YAML·Git 등 범용 포맷 — Unix 도구·Obsidian·CLI 에서 모두 열람 가능 |
| **BYOAI** | Claude / Codex / Gemini / Ollama 등 프로바이더를 자유롭게 교체. wikey.schema.md 가 단일 진실 소스 |

wikey.schema.md 의 가장 중요한 성질은 **"사용자 + LLM 공동 진화의 단일 소스"** 라는 점입니다. 프로바이더별 설정 파일 (`CLAUDE.md`·`AGENTS.md`·`local-llm/system-prompt.md`) 은 스키마를 따르고, 스키마의 변경만이 LLM 행동을 변경할 수 있습니다. 이 설계가 "BYOAI 로 여러 LLM 을 번갈아 써도 결과가 일관되는" 특성을 지탱합니다.

---

## 2. 3계층 아키텍처

wikey 는 크게 **데이터 3계층** 과 **코드 2계층** 으로 구성됩니다.

```
┌─────────────────────────────────────────────────────────┐
│ 데이터 계층                                              │
│   raw/           ← 사용자 소유, 불변, PARA 분류, gitignore │
│     │ (인제스트)                                          │
│     ▼                                                   │
│   wiki/          ← LLM 소유, entities/concepts/sources/  │
│     │            │  analyses + index.md + log.md        │
│     │ (참조)                                             │
│     ▼                                                   │
│   wikey.schema.md ← 사용자+LLM 공동 진화, 단일 진실 소스   │
├─────────────────────────────────────────────────────────┤
│ 코드 계층                                                │
│   wikey-core/    ← TypeScript 핵심 로직                  │
│     (query-pipeline · ingest-pipeline · wiki-ops ·       │
│      llm-client · pii-patterns · config)                 │
│   wikey-obsidian/ ← Obsidian 플러그인 (Phase 3 산출물)    │
│     (main · sidebar-chat · settings-tab · commands ·     │
│      status-bar)                                         │
└─────────────────────────────────────────────────────────┘
```

### 2.1 쓰기 권한 (CLAUDE.md 와 일치)

| 대상 | 권한 |
|------|------|
| `wiki/` | 읽기/쓰기 (LLM 이 페이지 생성·수정·삭제, 인덱스·로그 갱신) |
| `raw/` | **내용 수정 금지** (inbox→PARA 분류 이동만 허용, 사용자 승인 후) |
| `wikey-core/` · `wikey-obsidian/` | 읽기/쓰기 (TypeScript 핵심 로직 + 플러그인) |
| `wikey.schema.md` · `CLAUDE.md` | **사용자 승인 없이 수정 금지** |

---

## 3. 6-Phase 로드맵

현재 wikey 의 전체 개발 여정은 6 개 Phase 로 정의되어 있습니다.

| Phase | 범위 | 상태 | 중심 문서 |
|-------|------|------|----------|
| Phase 1 | CLI 인프라 · 스키마 · validate/pii · BYOAI 검증 · 로컬 LLM | 완료 (2026-04-11) | [`phase-1-todo.md`](./phase-1-todo.md) · [`phase-1-result.md`](../activity/phase-1-result.md) |
| Phase 2 | PARA 재구조화 · qmd 하이브리드 검색 · 한국어 형태소 · Contextual Retrieval · Qwen3-Embedding | 완료 (2026-04-18) | [`phase-2-todo.md`](./phase-2-todo.md) · [`phase-2-result.md`](../activity/phase-2-result.md) |
| Phase 3 | Obsidian 플러그인 (`wikey-core` + `wikey-obsidian`) — 사이드바 채팅·인제스트 UI·v6 파이프라인 | 완료 (2026-04-24 session 8) | [`phase-3-todo.md`](./phase-3-todo.md) · [`phase-3-full.md`](./phase-3-full.md) (설계서) · [`phase-3-result.md`](../activity/phase-3-result.md) |
| Phase 4 | 본체 완성 — 원본 → wiki ingest 고정 + Docling 메인화 + PII 패턴 엔진 + D.0 Critical Fix | 완료 (2026-04-24 session 8) | [`phase-4-todo.md`](./phase-4-todo.md) · [`phase-4-result.md`](../activity/phase-4-result.md) |
| Phase 5 | 튜닝·고도화·개선·확장 (9 subject, P0~P4 우선순위) | **진행 중** (2026-04-25~) | [`phase-5-todo.md`](./phase-5-todo.md) · [`phase-5-result.md`](../activity/phase-5-result.md) |
| Phase 6 | 웹 환경 (Next.js/SvelteKit · REST/tRPC · Docker · 클라우드) | 대기 | [`phase-6-todo.md`](./phase-6-todo.md) |

### 3.1 Phase 4 "본체 완성" 정의 (2026-04-22)

Phase 4 는 "원본 → wiki ingest 프로세스가 **더 이상 wiki 를 초기화하거나 재생성할 일이 없는** 상태". frontmatter · data model · 워크플로우 구조가 고정되고, 이후에는 내용만 축적되고 구조는 변경되지 않습니다. 이 조건이 튜닝·고도화 (Phase 5) 와 웹 환경 (Phase 6) 을 분리하는 기준입니다.

### 3.2 Phase 5 P0~P4 (2026-04-24 session 8 재번호)

| 우선순위 | 섹션 | 작업 | 이유 |
|----------|------|------|------|
| **P0 긴급** | §5.1 | 구조적 PII (multi-line 폼) | Phase 4 smoke 에서 실누출 재현. 보안 직결 |
| **P1 핵심** | §5.2 / §5.3 | 검색 재현율 / 인제스트 증분 | 질의·축적 양쪽 경로 품질·확장성 직격 |
| **P2 비전** | §5.4 | self-extending 표준 분해 로드맵 | wikey 철학의 기술적 gate. Stage 1 이 PMBOK 하드코딩 외재화 |
| **P3 개선** | §5.5 / §5.6 | 지식 그래프·시각화 / 성능·엔진 확장 | UX·인프라 투자. 수요 확인 후 |
| **P4 잔여** | §5.7 / §5.8 / §5.9 | 운영 포팅 / Phase 4 D.0.l 잔여 / Variance 진단 | 시간 여유 시, 현 상태로도 동작 |

추천 실행 순서: §5.1 (P0) → §5.2+§5.3 (P1 병행) → §5.4 Stage 1 (P2 gate) → §5.4.2~4 / §5.5 / §5.6 (상황별) → §5.7~9.

---

## 4. Agents 운영 체제 (2026-04-24 재편)

메인 세션이 **master** 역할로 아래 에이전트들을 엔진·실행방식별로 조율합니다 (전역 `~/.claude/CLAUDE.md` §7 에 정의).

### 4.1 범용 5

| 에이전트 | 역할 | 엔진 | 실행 방식 | 모델 |
|----------|------|------|-----------|------|
| **analyst** | 요구사항 분석·계획 수립 (`plan/` 디렉토리 관리) | Claude | A (in-process) | opus |
| **reviewer** | 계획·코드·보안 리뷰 | **Codex** | C (codex 스킬 Panel Mode D) | sonnet |
| **developer** | 코드 구현 | Claude | **C (claude-panel)** | opus |
| **tester** | 테스트 작성·pipeline 검증 | Claude | **C (claude-panel)** | opus |
| **ui-designer** | UI/UX·접근성 리뷰 | **Gemini** | C (gemini-panel) | sonnet |

흡수 맵: planner+architect → analyst / code-reviewer+security-reviewer → reviewer / tdd-guide → tester+developer / e2e-runner+verify-agent → tester / (신규) → ui-designer.

### 4.2 특화 4 (직접 호출)

| 에이전트 | 역할 | 모델 |
|----------|------|------|
| database-reviewer | DB 스키마·쿼리·RLS·인덱스 | opus |
| build-error-resolver | 빌드 에러 진단·복구 | sonnet |
| refactor-cleaner | 데드코드·중복·unused import 제거 | sonnet |
| doc-updater | README·CODEMAP·가이드 문서 동기화 | sonnet |

### 4.3 실행 엔진 스킬

| 스킬 | 대상 에이전트 | 설명 |
|------|--------------|------|
| `claude-panel` | developer, tester | `claude -p` non-interactive in cmux 새 패널 (완전 독립 프로세스) |
| `codex` | reviewer | codex Mode D (cmux Panel) cross-model 2차 검토 |
| `gemini-panel` | ui-designer | `gemini -p` non-interactive in cmux (Google 구독 OAuth) |

### 4.4 Master 오케스트레이션 규칙

- 새 기능·리팩토링 → **analyst** → (사용자 승인) → **developer** ↔ **reviewer** 루프 → **tester** → 정리
- UI 변경 포함 → analyst 뒤·developer 앞에 **ui-designer** 삽입
- 1줄·오타 수정 → developer → reviewer (analyst/tester 생략)
- DB 스키마 변경 → database-reviewer 선행
- 빌드 깨짐 → build-error-resolver 우선
- 데드코드 정리 → refactor-cleaner
- 문서 sync → doc-updater
- 독립 작업 병렬 실행 원칙 유지 (Subagent 결과만 반환, Team 은 고비용 멀티 컨텍스트 한정)

---

## 5. 핵심 기술 스택

| 축 | 스택 | 비고 |
|----|------|------|
| **LLM 프로바이더** | Gemini · Anthropic · OpenAI · Ollama (BYOAI 4 개) | `wikey-core/src/llm-client.ts` + provider-defaults |
| **로컬 LLM 모델** | `qwen3:8b` (인제스트 기본) · `qwen3.6:35b-a3b` (인제스트 옵션) · `gemma4:26b` (쿼리 전용 · contextual prefix) | Phase 3 session 9 확정 |
| **문서 변환 — 메인** | Docling (PDF/DOCX/XLSX/PPTX/HTML/이미지/TXT) | TableFormer + layout model + ocrmac/RapidOCR/Tesseract |
| **문서 변환 — 한글** | unhwp (HWP/HWPX/HWP 3.x) | 순수 Python 휠, Rust/JVM/한컴오피스 불필요 |
| **문서 변환 — fallback** | MarkItDown | docling 미설치 환경 전용, tier 강등 (Phase 4 §4.1) |
| **OCR 선택지** | ocrmac (macOS) · RapidOCR (Linux fallback, Phase 5 §5.6.2) · Tesseract | force-ocr 자동 감지 |
| **임베딩** | Qwen3-Embedding-0.6B (8192 context) | Phase 2 step 3-3 확정, jina-v3 기각 |
| **한국어 처리** | kiwipiepy 0.23.1 형태소 전처리 + Gemma4 contextual prefix | `scripts/korean-tokenize.py --batch` |
| **검색** | qmd 2.1.0 하이브리드 — BM25 (FTS5) + 벡터 + RRF 융합 | `tools/qmd/` vendored · Top-1 60% · vector Recall 97% |
| **PII 엔진** | `wikey-core/src/pii-patterns.ts` — declarative YAML (하드코딩 금지) | Phase 4 session 8 도입 |
| **테스트** | 525 PASS (Phase 4 본체 기준) · TDD RED→GREEN 필수 · 80%+ 커버리지 | Vitest (wikey-core) |
| **빌드·런타임** | Node.js 22.17.0 · TypeScript · Electron (Obsidian) · npm workspaces | 데스크톱 전용 (`isDesktopOnly: true`) |

후보 (미착수): llama.cpp PoC (Phase 5 §5.6.1, provider 추가용).

---

## 6. 문서 조직 규칙

### 6.1 중심 문서 vs 보조 문서

- **중심**: `plan/phase-N-todo.md` · `activity/phase-N-result.md` (단일 소스)
- **보조**: `plan/phase-N-todox-<section>-<topic>.md` · `activity/phase-N-resultx-<section>-<topic>-<date>.md`
- 접미사 `x` 가 alphabet-sort 에서 중심 문서를 맨 앞으로 보장 (`_`·`-` 금지)

### 6.2 필수 블록

| 문서 타입 | 필수 요소 |
|-----------|-----------|
| 중심 문서 (todo/result) | meta 블록 직후 `## 관련 문서` 섹션 + 보조 문서 section 번호 순 나열 |
| 보조 문서 (todox/resultx) | 타이틀 아래 `> **상위 문서**:` 역참조 블록 + todo 체크박스 금지 (phase-N-todo 단일 소스) |

`/sync` 스킬 Phase 0-4.7 이 무결성 자동 검증.

### 6.3 동기화 플로우 (2026-04-21 고정, CLAUDE.md)

사용자가 "문서 동기화", "sync docs", "관련 문서 정리", "result/todo 업데이트" 유사 요청을 하면 **반드시 다음 순서**:

1. **result/todo 먼저** — `result-doc-writer` 스킬 invoke 로 `activity/phase-*-result.md` + `plan/phase-*-todo.md` 구조·번호·제목·태그·mirror 점검
2. **관련 문서 동기화** — `wiki/log.md` 엔트리, `plan/session-wrap-followups.md` 다음 세션 시작점, `~/.claude/projects/-Users-denny-Project-wikey/memory/` phase status, 필요 시 `wikey.schema.md`·`README.md`
3. **단일 논리적 commit/push** — 이 turn 미커밋 변경 전체를 "docs 동기화 + 관련 문서" 메시지로 묶음

예외: 단순 오타·한 줄 코드 변경.

---

## 7. 데이터 경로

| 경로 | 역할 | 소비자 |
|------|------|--------|
| `~/.cache/qmd/index.sqlite` | 메인 검색 DB (문서, FTS5, 벡터) | qmd CLI + Obsidian 플러그인 |
| `~/.cache/qmd/contextual-prefixes.json` | Gemma4 contextual prefix 캐시 | qmd indexer |
| `~/.cache/qmd/models/` | GGUF 모델 캐시 | Ollama/llama.cpp |
| `./wikey.conf` | 통합 설정 (BASIC_MODEL · 프로바이더 · URL · 검색 · 비용) | bash 스크립트 + Obsidian 플러그인 (공유) |
| `~/.config/wikey/credentials.json` | API 키 (Gemini/Anthropic/OpenAI) | bash + 플러그인 (공유) — **Read 금지** |
| `.obsidian/plugins/wikey/data.json` | 채팅 히스토리·피드백·탐지 경로·UI 상태 | 플러그인 전용 |
| `.wikey/schema.yaml` | 사용자 vault 별 schema override (v7-5) | `wikey-core` canonicalizer |
| `.wikey/ingest_prompt.md` | 사용자 vault 별 ingest prompt override | wikey-obsidian 설정 탭 Edit/Reset |
| `.wikey/source-registry.json` | source hash + URI 참조 (Phase 4 §4.2.2) | ingest-pipeline 증분 재인제스트 (Phase 5 §5.3) |

`credentials.json` 의 키 존재 여부 확인은 `cat ... | python3 -c "import sys,json; d=json.load(sys.stdin); print({k:len(v) for k,v in d.items()})"` 만 허용 (CLAUDE.md PII 주의사항).

---

## 8. 현재 진입점

"지금 뭘 할지" 의 최신 답 (2026-04-25).

- **Phase 5 §5.1 (P0 긴급)** — 구조적 PII 탐지 계획서 작성 완료 (`plan/phase-5-todox-5.1-structural-pii.md`), codex 검증 진행 예정. multi-line 폼 label↔value 상관 해결이 PII-heavy 문서 보안에 직결.
- **Phase 5 §5.2 / §5.3 (P1 병행)** — 검색 재현율 고도화 (Anthropic-style contextual chunk) + 인제스트 증분 재인제스트 (source-registry hash 기반). 두 축이 독립이라 병렬 실행 가능.
- **Phase 5 §5.4 Stage 1 (P2 gate)** — `.wikey/schema.yaml` 에 `standard_decompositions` 필드 도입해 PMBOK 하드코딩 외재화. Phase 4 §4.5.1.7.2 PMS 5-run 실측 (Concepts CV <15%) 확증 대기.
- **일정 제약 없음.** 완료 기준은 각 subject 의 성공 기준 (`phase-5-todo.md` 참조) + fresh 실행 증거 (전역 rules §1 Evidence-Based Completion).

---

## 9. 참조 · 통합 계획

- [`plan/plan_wikey-enterprise-kb.md`](./plan_wikey-enterprise-kb.md) (2026-04-10) — enterprise KB 장기 비전. 현재 실행 단위 아님. 향후 Phase 6+ 또는 별도 프로젝트 scope 로 재평가 예정.
- [`plan/decisions.md`](./decisions.md) — 설계 의사결정 누적
- [`plan/session-wrap-followups.md`](./session-wrap-followups.md) — 세션 간 이어받는 다음 시작점
- [`plan/phase-3-full.md`](./phase-3-full.md) — Phase 3 Obsidian 플러그인 상세 구현 설계서 (2026-04-12 원본)
- [`wikey.schema.md`](../wikey.schema.md) — 프로바이더 독립 마스터 스키마 (단일 진실 소스)
- [`CLAUDE.md`](../CLAUDE.md) — Claude Code 프로바이더 설정 (도구 사용 패턴 + 동기화 플로우)

---

> **Phase 재편 이력 요약** (2026-04-22 ~ 2026-04-24): 2026-04-22 Phase 재편으로 기존 Phase 5 (웹 환경) 를 Phase 6 으로 이동하고 Phase 4 의 일부 고도화 항목 (§4.4.1/.2/.3, §4.5.1.7.x, §4.5.2/.3/.4 일부) 을 신규 Phase 5 로 이관. 2026-04-24 session 8 에서 Phase 5 9 subject 를 우선순위 기반 P0~P4 3축으로 전면 재번호 (§5.1 PII / §5.2 검색 / §5.3 증분 / §5.4 self-extending / §5.5 그래프 / §5.6 엔진 / §5.7 운영 / §5.8 D.0.l 잔여 / §5.9 Variance). 세부 before→after 매핑은 각 `plan/phase-5-todo.md §섹션 "이전 번호"` 주석 참조.
