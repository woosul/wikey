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

## 활동 기록 문서 규칙

`activity/phase-*-result.md` 작성·재구성 규칙은 **`result-doc-writer` 스킬**에 정의되어 있다. 해당 문서를 수정하거나 세션 결과를 기록할 때 그 스킬이 자동 트리거된다. (이전에 이 CLAUDE.md에 직접 기록하던 3원칙·번호체계·`#tag` 규칙은 2026-04-20에 스킬로 이관, 전역 토큰 절약.)

