# Phase 3 UX 아키텍처 — Obsidian 플러그인 → 웹 확장

> 결정일: 2026-04-12
> 배경: Phase 2 완료 후 사용자 환경 분석
> 핵심 문제: 현재 wikey는 개발자 도구(터미널+LLM 세션)이나, 타겟은 일반 지식 관리자

## 1. 사용자 환경 현황과 Gap

### 현재 (Phase 2 — 개발자 워크플로우)

```
사용자 → 터미널 (scripts/*.sh)  → wiki/
        → LLM 세션 (claude/codex) → wiki/
        → Obsidian (브라우징 전용)
```

- 파일 추가: Finder에서 raw/0_inbox/에 복사
- 인제스트: 터미널에서 `llm-ingest.sh` 또는 Claude Code 세션
- 쿼리: 터미널에서 `wikey-query.sh` 또는 Claude Code 세션
- 브라우징: Obsidian
- 설정: `.env`, `wikey.conf` 수동 편집

### 타겟 (일반 지식 관리자가 기대하는 경험)

```
사용자 → Obsidian 내 wikey 패널 → wiki/
        드래그앤드롭 → 자동 인제스트
        채팅 입력 → 위키 기반 답변
        설정 GUI → BASIC_MODEL 선택
```

## 2. 아키텍처 전략 — 공유 코어 + 교체 가능 UI

### 핵심 원칙

1. **코어 로직을 TypeScript 모듈로 분리** — LLM 호출, 위키 CRUD, 파이프라인
2. **UI는 교체 가능한 레이어** — 1단계 Obsidian, 2단계 Web
3. **CLI는 계속 유지** — 파워유저/자동화용

### 모듈 구조

```
wikey-core/                      ← npm 패키지 (공유)
├── src/
│   ├── llm-client.ts            ← LLM API 래퍼 (Gemini/Anthropic/OpenAI/Ollama)
│   ├── wiki-ops.ts              ← 위키 CRUD (페이지 생성, 인덱스, 위키링크)
│   ├── ingest-pipeline.ts       ← 소스 → 위키 변환
│   ├── query-pipeline.ts        ← qmd 검색 + LLM 합성
│   ├── reindex.ts               ← 인덱싱 파이프라인
│   ├── config.ts                ← wikey.conf 파싱 + BASIC_MODEL 폴백
│   └── types.ts                 ← 공유 타입 (WikiPage, IngestResult, etc.)
└── package.json

wikey-obsidian/                  ← Obsidian 플러그인 (1단계)
├── src/
│   ├── main.ts                  ← 플러그인 엔트리
│   ├── sidebar-chat.ts          ← 쿼리 채팅 패널
│   ├── inbox-dropzone.ts        ← 파일 드래그앤드롭 인제스트
│   ├── settings-tab.ts          ← 설정 GUI (BASIC_MODEL, API 키)
│   ├── status-bar.ts            ← 인덱스 상태, 비용 표시
│   └── commands.ts              ← Obsidian 커맨드 팔레트 등록
├── manifest.json
└── package.json                 ← depends: wikey-core

wikey-web/                       ← 웹 인터페이스 (2단계)
├── pages/
│   ├── index.tsx                ← 채팅 + 업로드 홈
│   ├── wiki/[slug].tsx          ← 마크다운 렌더러
│   └── settings.tsx             ← 설정 페이지
├── api/
│   ├── ingest.ts                ← POST /api/ingest
│   ├── query.ts                 ← POST /api/query
│   └── status.ts                ← GET /api/status
└── package.json                 ← depends: wikey-core
```

### 현재 스크립트 → TypeScript 매핑

| 현재 (bash/python) | wikey-core (TypeScript) | 비고 |
|---|---|---|
| `scripts/lib/llm-api.sh` | `llm-client.ts` | curl → fetch/axios |
| `scripts/llm-ingest.sh` | `ingest-pipeline.ts` | 프롬프트 + JSON 파싱 동일 |
| `local-llm/wikey-query.sh` | `query-pipeline.ts` | qmd CLI → qmd JS API |
| `scripts/reindex.sh` | `reindex.ts` | child_process.exec 래핑 |
| `scripts/contextual-retrieval.py` | `reindex.ts` 내부 | Python → TS 포팅 또는 exec |
| `scripts/korean-tokenize.py` | exec 유지 (Python 필수) | kiwipiepy는 Python only |
| `local-llm/wikey.conf` | `config.ts` | INI 파싱 |
| `scripts/cost-tracker.sh` | `cost-tracker.ts` | 선택적 포팅 |

## 3. Phase 3 로드맵

### 3-1. 코어 모듈화 (2~3일)

현재 bash/python 스크립트의 핵심 로직을 TypeScript로 포팅.
qmd는 이미 TypeScript(tools/qmd/)이므로 직접 import 가능.

### 3-2. Obsidian 플러그인 MVP (1~2주)

**MVP 기능:**
1. **사이드바 채팅 패널** — 질문 입력 → query-pipeline → 답변 표시 (위키링크 클릭 가능)
2. **인제스트 커맨드** — 현재 열린 노트 또는 선택한 파일을 인제스트 (Cmd+Shift+I)
3. **설정 탭** — BASIC_MODEL 선택, API 키 입력, Ollama 상태 확인
4. **상태 바** — "30 pages indexed | $21.13/50" 표시

**연기 기능 (v2):**
- 드래그앤드롭 inbox
- 자동 인제스트 (파일 감지 → 자동 실행)
- 린트 결과 인라인 표시
- 비용 대시보드

### 3-3. 웹 인터페이스 (Phase 3~4)

Obsidian 플러그인 완성 후, 동일한 wikey-core를 사용하여 Next.js 웹 앱 구축.
주 목적: Obsidian 없는 사용자, 모바일 접근, 팀 공유.

## 4. 단계별 사용자 경험

### Phase 2 (현재 — 개발자)

```
설치: git clone + ollama pull + pip install + .env 설정
사용: 터미널 + LLM 세션 + Obsidian 브라우징
```

### Phase 3-2 (Obsidian 플러그인 MVP)

```
설치: Obsidian 마켓플레이스에서 wikey 설치 → 설정에서 API 키 입력 → 끝
사용:
  - 인제스트: Obsidian에서 파일 열기 → Cmd+Shift+I → 자동 위키 생성
  - 쿼리: 사이드바 채팅에서 질문 → 위키 기반 답변
  - 브라우징: Obsidian 네이티브 (그래프뷰, 백링크, 검색)
  - 설정: Obsidian 설정 → wikey 탭 → BASIC_MODEL 드롭다운
```

### Phase 4 (웹 인터페이스)

```
설치: npx wikey-web (localhost:3000) 또는 Docker
사용:
  - 인제스트: 웹에서 파일 업로드 → 자동 위키 생성
  - 쿼리: 웹 채팅 UI
  - 브라우징: 웹 마크다운 렌더러 (또는 Obsidian 병행)
```

## 5. 기술 의사결정

### Obsidian 플러그인 API 핵심 기능

| Obsidian API | wikey 용도 |
|---|---|
| `Plugin.addRibbonIcon()` | 사이드바 아이콘 |
| `Plugin.addCommand()` | Cmd+Shift+I 인제스트 |
| `Plugin.addSettingTab()` | 설정 GUI |
| `Plugin.registerView()` | 채팅 사이드바 |
| `Vault.create()` / `modify()` | 위키 페이지 생성/수정 |
| `Vault.read()` | 소스/위키 읽기 |
| `requestUrl()` | LLM API 호출 |
| `Notice()` | 인제스트 완료 알림 |

### qmd 통합

qmd는 이미 TypeScript + Node.js. 두 가지 통합 방식:
1. **CLI exec**: `child_process.exec('qmd query ...')` — 간단, 현재와 동일
2. **JS import**: qmd 소스에서 직접 import — 성능 최적, Obsidian 번들에 포함 가능

MVP는 CLI exec로 시작, 안정화 후 JS import로 전환.

### Ollama 통합

Obsidian 플러그인에서 `requestUrl()`로 Ollama localhost:11434 직접 호출 가능.
브라우저 환경(웹)에서도 CORS 설정 시 동일하게 동작.

## 6. 현재 CLI 워크플로우 유지

Obsidian 플러그인/웹이 추가되더라도 기존 CLI 워크플로우는 계속 동작:
- `wikey-query.sh` — 터미널 쿼리
- `llm-ingest.sh` — 스크립트 인제스트
- `reindex.sh` — 수동 인덱싱
- Claude Code/Codex 세션 — 에이전트 인제스트/린트

이는 자동화, CI/CD, 파워유저를 위한 인터페이스로 유지.
