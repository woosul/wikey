# Wikey — Claude Code 설정

> 이 파일은 Claude Code 세션에서 wikey 프로젝트를 작업할 때의 도구 사용법과 실행 체크리스트를 정의한다.

## 필수: 스키마 먼저 읽기

**작업 시작 전 `wikey.schema.md`를 반드시 읽어라.** 위키의 3계층 아키텍처, 워크플로우, 페이지 컨벤션, 핵심 원칙이 모두 그 파일에 정의되어 있다. Karpathy 의 [llm-wiki.md](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) 철학이 고스란히 녹아 있는 *유일한 단일 진실 소스*.

**모든 에이전트 (master / analyst / developer / tester / reviewer / ui-designer) 위임 시 wikey.schema.md 첫 read 의무**. 특히 **analyst (계획 수립)** 가 plan / todox / 신규 issue / paradigm shift 검토를 할 때 본 schema 의 4 원칙 (Explicit / Yours / File over app / BYOAI) + 3계층 + 워크플로우 + 페이지 컨벤션과 일치 여부 cross-check 필수. master 가 analyst 에게 task prompt 작성 시 schema 참고 의무를 명시.

4 핵심 문서 (README.md 갱신 source):
- [`wikey.schema.md`](./wikey.schema.md) — 마스터 스키마 (단일 진실 소스, Karpathy 철학)
- [`docs/planning/plan-full.md`](./docs/planning/plan-full.md) — 전체 로드맵 + 각 Phase 목표·핵심 spec 상세
- [`CLAUDE.md`](./CLAUDE.md) — 본 파일 (Claude Code 도구 사용 + 실행 체크리스트)
- [`DESIGN.md`](./DESIGN.md) — 디자인 시스템 (`--wk-*` CSS 변수 토큰 + 5 패널 패턴 + `styles.css` 마이그레이션 계획)

## 쓰기 규칙

| 대상 | 권한 |
|------|------|
| `wiki/` | 읽기/쓰기 (페이지 생성·수정·삭제, 인덱스·로그 갱신) |
| `raw/` | **내용 수정 금지** (inbox→PARA 분류 이동은 허용, 사용자 승인 후) |
| `wikey-core/` | 읽기/쓰기 (TypeScript 핵심 로직) |
| `wikey-obsidian/` | 읽기/쓰기 (Obsidian 플러그인) |
| `wikey.schema.md` | **사용자 승인 없이 수정 금지** |
| `CLAUDE.md` | **사용자 승인 없이 수정 금지** |

## Claude Code 도구 사용 패턴

### 파일 읽기/쓰기

| 도구 | 용도 |
|------|------|
| **Read** | wiki/ 페이지 읽기, raw/ 소스 읽기, wikey.schema.md 참조 |
| **Write** | 새 위키 페이지 생성 (프론트매터 포함) |
| **Edit** | 기존 위키 페이지 부분 수정 (index.md 갱신, 내용 추가 등) |
| **Bash** | Git 명령, `setup.sh`, `validate-wiki.sh`, `check-pii.sh`, `update-qmd.sh`, `korean-tokenize.py --batch`, `watch-inbox.sh`, `classify-inbox.sh`, `summarize-large-source.sh`, `llm-ingest.sh`, `reindex.sh`, `check-providers.sh`, `cost-tracker.sh` 실행. 공유 라이브러리: `scripts/lib/llm-api.sh` |
| **Glob** | wiki/ 내 파일 목록 확인 |
| **Grep** | 위키링크 추적, 소스 인용 검색 |
| **qmd MCP** | 위키 하이브리드 검색 (BM25+벡터+RRF). 쿼리 세션에서 관련 페이지 탐색 시 활용. FTS5 인덱스는 한국어 형태소 전처리 적용됨 (`korean-tokenize.py --batch`) |

### LLM 설정

프로세스별 LLM은 `local-llm/wikey.conf`에서 통합 관리한다. 환경변수로 오버라이드 가능.

```bash
# 프로바이더 상태 확인
./scripts/check-providers.sh

# 인덱스 상태 확인 + 전체 재인덱싱
./scripts/reindex.sh --check
./scripts/reindex.sh
```

### 데이터 위치

| 경로 | 역할 |
|------|------|
| `~/.cache/qmd/index.sqlite` | 메인 DB (문서, FTS5, 벡터) |
| `~/.cache/qmd/contextual-prefixes.json` | Gemma 4 맥락 프리픽스 캐시 |
| `~/.cache/qmd/models/` | GGUF 모델 캐시 |
| `./wikey.conf` | 통합 설정 (CLI + 플러그인 공유) |
| `~/.config/wikey/credentials.json` | API 키 (bash + 플러그인 공유) |

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

5개 세션 유형 (인제스트·쿼리·린트·소스 삭제·분류) + 대용량 소스 2단계 처리 절차는 **[`docs/maintenance/session-checklists.md`](./docs/maintenance/session-checklists.md)** 에 정리. 각 유형의 순차 단계·scripts 호출 순서를 필요 시 참조.

## 시스템 언어 = 영문 (2026-05-12 LOCK)

모든 사용자 인터페이스 텍스트 (button label / panel title / Notice / Modal message / tooltip / settings 설명 / status message / placeholder) 는 **영문** 작성. 단일 진실 소스: `wikey.schema.md §핵심 원칙 #6`.

**예외 (한글 허용)**:
- 내부 코드 주석 / JSDoc / variable name
- `docs/planning/` · `docs/sessions/` · `wiki/` · `wiki/log.md` · `docs/` (개발자 documentation + 사용자 콘텐츠)
- `scripts/validate-wiki.sh` 등 script output 의 parse regex (production format 으로 고정된 한글 키워드 — 예: `깨진 위키링크`)
- wiki content (LLM 이 생성한 한글 page 본문)

**위반 시정**: 사용자 raise 시 즉시 sweep — UI string + 영향 test fixture 동시 변경 (Spec change sweep 절차, `rules/testing.md §5`).

## SDD+TDD 흐름 — Phase 3a/3b 분리 의무 (2026-05-06 영구 등록)

모든 비-사소 SDD+TDD cycle 의 **Phase 3 는 두 단계로 분리**:

- **Phase 3a — 회귀 검증**: `npm test` + `npm run build` + `./scripts/validate-wiki.sh`. 결과 PASS 확증.
- **Phase 3b — BLUE refactor (명시)**: 코드 quality 개선
  - 함수 분해 (50+ LOC 함수 — extract 후보 결정)
  - Naming consistency (변수 / 함수 의미 mapping)
  - 중복 패턴 제거 (DRY, extract or 의도적 유지 + 근거)
  - 주석 quality (TODO/FIXME 0 / historical context 압축 / deprecation marker cleanup)
  - 가독성 (nested arrow / magic number)
  - 회귀 검증 반복 (각 refactor 후 PASS)

**배경**: wikey §5.11 v2 + §5.12 (2026-05-05 session 19) 진행 시 Phase 3 가 회귀 검증으로만 그치고 BLUE refactor 가 사실상 누락됨 (사용자 raise 2026-05-06). retrospective 보강을 §5.14 로 정식 등록 + 향후 모든 cycle 에 본 정책 의무 적용.

**예외**: 사소한 작업 (오타 1-line / config 1줄 / dependency bump) 은 master 판단으로 BLUE 생략 가능.

**Global 정책 단일 소스**: `claude-forge-custom/rules/testing.md` (모든 프로젝트 적용). 본 wikey CLAUDE.md 는 project-specific mirror.

**위반 시정**: 사용자 지적 시 즉시 retrospective BLUE cycle 진행. codex post-impl 검토에서 BLUE 누락이 finding 으로 raise 될 수 있음.

## 설정 체계

단일 소스 원칙: `wikey.conf`(공유 설정) + `credentials.json`(API 키) + `data.json`(플러그인 상태).

| 파일 | 역할 | 소비자 |
|------|------|--------|
| `./wikey.conf` | 모델, 프로바이더, URL, 검색, 비용 | bash + 플러그인 (공유) |
| `~/.config/wikey/credentials.json` | API 키 (Gemini/Anthropic/OpenAI) | bash + 플러그인 (공유) |
| `.obsidian/plugins/wikey/data.json` | 채팅 히스토리, 피드백, 탐지 경로, UI | 플러그인만 |

```bash
# 프로바이더 상태 확인
./scripts/check-providers.sh
```

**주의: `credentials.json`을 Read 도구로 절대 열지 않는다.** API 키가 대화 컨텍스트에 노출된다. 키 존재 여부 확인은 `cat ~/.config/wikey/credentials.json | python3 -c "import sys,json; d=json.load(sys.stdin); print({k:len(v) for k,v in d.items()})"` 사용.

## PII 주의사항

- `scripts/check-pii.sh`를 커밋 전 반드시 실행
- 소스에 PII가 있을 경우 위키 페이지에 전파하지 않도록 주의
- PII가 위키에 이미 전파된 경우, 사용자 지시에 따라 제거

## Obsidian 플러그인 (Phase 3 산출물)

wikey-core / wikey-obsidian 의 디렉터리 맵 + 빌드·개발 세션은 **[`docs/maintenance/obsidian-plugin.md`](./docs/maintenance/obsidian-plugin.md)** 참조. npm 스크립트: `npm run build`, `npm test`, `npm run dev`.

**사이드바 패널 5종** (sidebar-chat.ts, §5.10.4 D-wide 후 Suggestions 폐기):

| 패널 | header icon | 용도 |
|------|------|------|
| Chat | chat | LLM 답변 + citation + 1-hop wikilink |
| Dashboard | dashboard | wiki 통계 + tag ranking + recent queries |
| Ingest | plus | 파일 인입 + brief / approve & write 흐름 |
| Audit | audit | raw 파일별 ingest 상태 + retry / delay |
| Help | question | guide 마크다운 |

**§5.10 paradigm shift D-wide 채택 (2026-05-05 session 17, §5.10.4)**: 사용자 본질 비판 6 chain → 옵션 D-wide (LLM-only ontology) 채택 + 구현 완료. §5.4 self-extending Stage 1~4 (BUILTIN_STANDARD_DECOMPOSITIONS / suggestion-detector / self-declaration / convergence) + 7-type schema gate (`ENTITY_TYPES` / `CONCEPT_TYPES` / `FORCED_CATEGORIES` / `buildSchemaPromptBlock`) 모두 폐기. canonicalizer 는 LLM 자율 type 분류 + minimal alias normalization (SLUG_ALIASES + `.wikey/schema.yaml` `aliases:`) 만 잔존. Suggestions panel UI 폐기 (sidebar 6→5 패널).

## 활동 기록 문서 규칙

`docs/sessions/phase-N/phase-N-result.md` 작성·재구성 규칙은 **`result-doc-writer` 스킬**에 정의되어 있다. 해당 문서를 수정하거나 세션 결과를 기록할 때 그 스킬이 자동 트리거된다. (이전에 이 CLAUDE.md에 직접 기록하던 3원칙·번호체계·`#tag` 규칙은 2026-04-20에 스킬로 이관, 전역 토큰 절약.)

## 문서 명명규칙·조직화 (필수)

상세 규칙은 **[`docs/maintenance/docs-organization.md`](./docs/maintenance/docs-organization.md)** 에 정리. 핵심만 요약:

- 중심: `docs/planning/phase-N/phase-N-todo.md` · `docs/sessions/phase-N/phase-N-result.md`
- 보조: `docs/planning/phase-N/phase-N-todox-<section>-<topic>.md` · `docs/sessions/phase-N/phase-N-resultx-<section>-<topic>-<date>.md` (`x` 접미사가 alphabet-sort 에서 중심을 맨 앞에 오게 보장 — `_`·`-` 금지)
- 중심 문서 의무: meta 블록 직후 `## 관련 문서` 섹션 + 보조 문서 section 번호 순 나열.
- 보조 문서 의무: 타이틀 아래 `> **상위 문서**:` 역참조 블록 + todo 체크박스 금지 (phase-N-todo 단일 소스).
- `/sync` 스킬 Phase 0-4.7 이 무결성 자동 검증.

## 문서 동기화 플로우 (필수)

사용자가 "문서 동기화", "sync docs", "관련 문서 정리", "result/todo 업데이트" 유사 요청을 하면 **반드시 다음 순서**로 진행한다 (2026-04-21 고정):

1. **result/todo 먼저** — `result-doc-writer` 스킬을 invoke해서 `docs/sessions/phase-N/phase-N-result.md` + `docs/planning/phase-N/phase-N-todo.md`의 구조·번호·제목·태그·mirror를 점검·보강. 신규 subject가 있으면 result에 먼저 반영하고 todo가 그 구조를 따른다.
2. **체크박스 갱신 의무** (2026-05-12 LOCK) — result/todo mirror 이후 **반드시** 이번 세션 종결 작업의 `docs/planning/phase-N/phase-N-todo.md` + `docs/planning/phase-N/phase-N-todox-<section>-<topic>.md` 체크박스 갱신: `[ ]` → `[x]` (완료) 또는 `[-]` (의도적 스킵). result 에 종결 표기했는데 todo 체크박스가 `[ ]` 그대로면 drift — mirror 미완성. 종결 cycle 의 경우 §section title 에 ✅ + tag `#done` 추가. 단일 진실 소스: `~/.claude/skills/sync/SKILL.md §0-4.5.5`.
3. **관련 문서 동기화** — `wiki/log.md` (해당 작업 eval/ingest/lint 엔트리), `docs/planning/session-wrap-followups.md` (다음 세션 시작점), `~/.claude/projects/-Users-denny-Project-wikey/memory/` (phase status, MEMORY.md 인덱스), 필요 시 `wikey.schema.md`·`README.md` 등 result가 참조되는 곳 모두 업데이트.
4. **추가·변경 파일 포함 commit/push** — 이 turn에서 미커밋인 변경 전체를 하나의 논리적 커밋으로 묶어 메시지에 "docs 동기화 + 관련 문서" 취지를 명시한 뒤 push.

예외: 단순 오타 수정·한 줄 코드 변경처럼 문서 mirror가 불필요한 경우는 이 플로우를 건너뛰어도 된다. 판단 기준은 "result에 기록할 새 작업인가" — 그렇다면 반드시 이 순서.

## Subagent 위임 기준 (Claude Code context 보호 — 2026-04-25 phase-a 합의)

다음 경우 main session 에서 직접 처리하지 말고 subagent (claude-panel / codex / gemini-panel / general-purpose / Explore) 위임. main context 를 보호하고 large output 을 격리한다.

**위임 대상 (확정)**:
- **Output 500+ lines**: log tail, test 전체 출력, 대량 grep 결과, file list 100+ entries
- **Long-running 5분+**: `npm run build`, `npm test` (전체), docling 변환, qmd reindex full, llm-ingest 1 파일 이상
- **Domain isolated**: DB review (database-reviewer), security audit (reviewer/codex), UI/UX review (gemini-panel/ui-designer), refactor cleanup (refactor-cleaner)
- **Obsidian CDP UI smoke**: **master 1차 책임** (2026-05-12 LOCK, 사용자 명시) — `~/.claude/skills/obsidian-cdp/SKILL.md §1`. tester 는 단위/통합 시뮬레이션 (mock fs + mock LLM) 만. 라이브 cycle smoke 는 master 가 cdp 직접 호출. 이전 정책 ("tester 1차") 폐기.
- **Plan 검증**: codex Mode D Panel — `~/.claude/skills/codex/SKILL.md` 기본 정책. 길이 무관 Mode D 우선.
- **3 query 이상 codebase 탐색**: Explore agent (Glob+Grep+Read).

**위임 호출 형식**:
- Agent tool prompt 에 (a) 목표 (b) 입력 file 경로 (c) 출력 형식 명시. self-contained.
- subagent 종료 후 결과만 main 으로 복귀 — large output 은 subagent context 에만 남고 main 은 summary 수신.
- 결과 통합: master 가 subagent 결과의 "summary + key finding + 다음 액션" 만 user 에게 보고. 원본 raw 는 inline 인용 금지 (필요 시 file 경로만).

**위임 안 하는 경우**:
- 1-2 line code edit
- 단일 file Read (300 lines 이하)
- bash 1-3 command 즉답
- 사용자가 "직접 처리" 명시

**참조**: `docs/planning/phase-a/phase-a-session-maintenance.md §3.D`, `feedback_no_defer_to_next_session.md`, `feedback_reuse_prior_artifacts.md`, [`docs/maintenance/subagent-visibility.md`](./docs/maintenance/subagent-visibility.md) (가시성 3 패턴, 2026-04-25), [`docs/maintenance/master-pre-validation.md`](./docs/maintenance/master-pre-validation.md) (subagent 산출물 → codex 직송 금지, master 1차 검증 의무, 2026-04-25).

