# Wikey — Claude Code 설정

> 이 파일은 Claude Code 세션에서 wikey 프로젝트를 작업할 때의 도구 사용법과 실행 체크리스트를 정의한다.

## 필수: 스키마 먼저 읽기

**작업 시작 전 `wikey.schema.md`를 반드시 읽어라.** 위키의 3계층 아키텍처, 워크플로우, 페이지 컨벤션, 핵심 원칙이 모두 그 파일에 정의되어 있다.

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

### 인제스트 세션

```
1. wikey.schema.md 읽기
2. raw/ 소스 읽기
3. 핵심 시사점을 사용자와 논의
4. wiki/sources/source-{name}.md 생성 또는 업데이트 (멱등)
5. wiki/entities/, wiki/concepts/ 페이지 생성 또는 업데이트
6. wiki/index.md 갱신 (새 페이지 등재, 기존 요약 수정)
7. wiki/log.md에 항목 추가 (날짜, 타입, 영향 페이지, 토큰)
8. wiki/overview.md 갱신 (필요시)
9. scripts/check-pii.sh 실행 → 통과 확인
10. scripts/reindex.sh 실행 → 전체 인덱싱 (qmd update + embed + CR + 한국어 + validate)
11. Git 커밋
```

### 쿼리 세션

```
1. wikey.schema.md 읽기
2. wiki/index.md 읽기 → 관련 페이지 식별
3. 해당 페이지 읽기 (entities/, concepts/, sources/)
4. 인용과 함께 답변 종합
5. 가치 있는 답변 → wiki/analyses/에 저장 → index.md, log.md 갱신
```

### 린트 세션

```
1. wikey.schema.md 읽기
2. 증분 린트: git diff로 최근 변경 페이지 식별
   전체 린트: wiki/ 전체 스캔
3. 점검: 모순, 고아, 깨진 링크, 인덱스 누락, 삭제된 소스 의존
4. 발견 사항을 사용자에게 보고
5. 사용자 승인 후 수정 실행
6. log.md에 lint 항목 추가
7. validate-wiki.sh → Git 커밋
```

### 소스 삭제 세션

```
1. wikey.schema.md 읽기
2. 삭제된 소스의 wiki/sources/source-{name}.md 확인
3. Grep으로 해당 소스를 인용하는 모든 페이지 검색
4. 각 페이지에서 인용 제거 또는 "근거 삭제됨" 표시
5. wiki/sources/source-{name}.md 삭제 또는 아카이브
6. index.md, log.md 갱신
7. validate-wiki.sh → Git 커밋
```

### 분류 세션

```
1. wikey.schema.md 읽기
2. raw/CLASSIFY.md 읽기
3. `scripts/watch-inbox.sh --status` 또는 `scripts/classify-inbox.sh --dry-run` 실행 → 자동 분류 힌트 확인
4. 각 항목에 대해:
   a. CLASSIFY.md 자동 규칙 매칭 시도
   b. 매칭 실패 시 LLM 판단 가이드 참조
   c. 분류 결과를 사용자에게 제안
5. 사용자 승인 후 `scripts/classify-inbox.sh --move <src> <dst>` 실행
6. CLASSIFY.md 하위폴더 정의에 새 폴더 추가 시 문서 업데이트
7. 이동 완료 후 인제스트 세션 시작 (필요시)
```

## 대용량 소스 처리

20페이지+ PDF, 2시간+ 회의록 등은 `wikey.schema.md`의 **2단계 인제스트** 절차를 따른다:

```
Phase A: Read 도구로 20p씩 순차 읽기 → 섹션 인덱스 생성
Phase B: 핵심 섹션만 상세 읽기 → 위키 페이지 생성
Phase C: 쿼리 시 섹션 인덱스 참조 → 해당 페이지만 온디맨드 읽기
```

Claude Code에서의 구체적 실행:
1. `scripts/summarize-large-source.sh <pdf> --dry-run` 으로 페이지 수 확인
2. 20p+ 이면 `scripts/summarize-large-source.sh <pdf>` 실행 (Gemini 자동 요약)
3. Gemini 미사용 시: `Read` 도구 + `pages` 파라미터로 20p씩 분할
4. source 페이지에 섹션 인덱스 테이블 포함
5. 핵심 섹션을 재읽기하여 위키 페이지 생성

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

## Obsidian 플러그인 (Phase 3)

### 구조

```
wikey-core/                    ← 핵심 로직 (프로바이더 독립)
  src/config.ts                ← wikey.conf 파싱, resolveProvider
  src/llm-client.ts            ← 4 프로바이더 (Gemini/Anthropic/OpenAI/Ollama)
  src/provider-defaults.ts     ← 4 프로바이더 기본 모델 단일 소스 (UI/core 공유)
  src/wiki-ops.ts              ← 페이지 CRUD, index/log 관리
  src/query-pipeline.ts        ← qmd 검색 + LLM 합성
  src/ingest-pipeline.ts       ← 소스→위키 변환 (PDF + chunk v2 프롬프트)
  src/classify.ts              ← inbox 분류 규칙 엔진 + LLM fallback (DEWEY 10개)
  src/scripts-runner.ts        ← validate/pii/reindex/cost exec 래퍼
  src/types.ts                 ← 공유 타입
  src/prompts/                 ← 외부화된 프롬프트 (ingest_prompt_basic.md)
  src/__tests__/               ← vitest (97 tests)

wikey-obsidian/                ← Obsidian 플러그인
  src/main.ts                  ← WikeyPlugin, WikiFS/HttpClient 어댑터
  src/sidebar-chat.ts          ← 채팅 UI, Audit/Ingest 패널
  src/ingest-modals.ts         ← Stay-involved Brief→Processing→Preview 모달 (Drag/Resize)
  src/setup-para.ts            ← PARA 폴더 구조 자동 생성 (0_inbox~4_archives + DDC 3차)
  src/settings-tab.ts          ← 설정 (환경 탐지, 일반 토글, API 키, 고급 LLM)
  src/commands.ts              ← Cmd+Shift+I, URI 프로토콜
  src/status-bar.ts            ← 페이지 수, 통계 모달
  src/env-detect.ts            ← 로그인 셸 PATH + ABI 호환 node 탐지 (kiwipiepy/markitdown/markitdown-ocr 옵셔널 감지 포함)
  styles.css                   ← Purple accent 테마
```

### 개발 명령어

```bash
npm run build          # 전체 빌드 (wikey-core + wikey-obsidian)
npm run build:core     # wikey-core만
npm run build:obsidian # wikey-obsidian만
npm test               # wikey-core vitest
npm run dev            # wikey-obsidian watch 모드
```

### 플러그인 개발 세션

```
1. npm run dev (watch 모드)
2. Obsidian Cmd+R로 리로드
3. 코드 수정 → 자동 빌드 → Cmd+R로 확인
4. npm test → 0 failures 확인
5. npm run build → 0 errors 확인
6. Git 커밋
```

## 활동 기록 문서 (`activity/phase-N-result.md`) 작성 규칙

작업 결과를 `activity/phase-N-result.md`에 기록할 때 다음 3원칙을 지킨다. 이 규칙은 사용자가 2026-04-20에 영구 고정했다.

1. **Subject에 의한 그룹화** — 최상위 섹션(`## N. 주제`)은 작업 주제(기능·영역·범위) 단위다. 시간이나 세션이 아니라 특성으로 묶는다. 예: `스키마 안정화 + 결정성 측정`, `문서 전처리 (PDF · OCR tier chain)`.
2. **상세 타임라인에 의한 상세 기록** — 각 subject 내부는 진행 시간 순으로 기록한다. 각 항목은 "이전 상태 → 작업 내용 → 결과"를 자세히 담는다. 수치·커밋 해시·파일 경로·모듈명·에러 메시지 등 구체 증거를 포함한다. 요약하지 말고 보존한다.
3. **다른 주제 진행 중 이전 주제 관련 내용이 나오면 그 이전 subject의 타임라인 하단에 append** — 새 subject를 만들지 않는다. 예: 04-19 UI 재설계 중 04-18 프롬프트 이슈의 후속 수정이 나오면, "프롬프트 시스템" subject 타임라인 말미에 `(2026-04-19 추가)`로 덧붙인다.

### 번호 체계 (필수)

- `N. / N.M / N.M.K` 3-레벨 순수 숫자만 사용한다.
- `Step N`, `Phase X-Y-Z`, `§A-N`, `(Must)`, `[v7-3]` 같은 이질 prefix를 섹션 헤더에 섞지 않는다. (본문 텍스트에서 커밋 컨벤션·히스토리 참조 용도로는 사용 가능)

### 대분류 태그 (시스템 구성요소 관점)

각 subject(`## N.` 최상위 섹션) 제목 끝에 **다중 `#tag`**로 대분류를 부착한다. 같은 subject가 여러 구성요소에 걸치면 태그를 복수 붙인다 (예: `## 4. UI/UX 고도화 #design #workflow`).

허용 대분류 (필요시 확장):

- `#architecture` — 시스템 구조, 계층, 디자인 결정
- `#framework` — 공통 기반 (schema, config, 타입·프로토콜)
- `#core` / `#engine` — 핵심 로직 (LLM, canonicalizer, wiki-ops, query pipeline)
- `#workflow` — 작업 흐름 (인제스트·쿼리·린트·분류·E2E)
- `#main-feature` — 사용자에게 노출되는 주요 기능 단위
- `#design` — UI/UX, 시각·컴포넌트·테마
- `#utility` / `#helper` — 보조 도구, 스크립트, CLI 래퍼
- `#infra` — 배포·설정·CI·의존성
- `#ops` — 운영·디버깅·안정성·비용 추적
- `#eval` — 측정·벤치마크·결정성·성능
- `#docs` — 문서·스키마 변경·가이드

새 태그가 필요한데 목록에 없으면 이 목록에 먼저 추가한 뒤 사용한다.

### Todo와의 관계

`plan/phase-N-todo.md`는 result의 주제 구조를 **1:1 미러하는 체크리스트**다. Subject 구성이 바뀌면 **result 먼저 고치고, todo는 그 구조를 따라간다**. Todo는 간결, result는 상세. 대분류 태그도 todo에 동일하게 반영한다.

