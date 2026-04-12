# Phase 3 결과 보고서

> 기간: 2026-04-12 ~ 진행 중
> 목표: Obsidian 플러그인 (wikey-core + wikey-obsidian)
> 상태: **진행 중** — Step 0~6 완료 + Must/Should 전체 완료 + Audit 패널 + Cross-lingual 검색
> 전제: Phase 2 완료 (필수 7/7, 중요 6/6)
> 인프라: Ollama 0.20.5 + Gemma 4 (12B), qmd 2.1.0 (vendored), Node.js 22.17.0

---

## 1. 타임라인

| 날짜 | Step | 주요 작업 |
|------|------|----------|
| 04-12 | 3-0 | 모노레포 스캐폴딩 (npm workspaces, wikey-core, wikey-obsidian) |
| 04-12 | 3-1-A | config.ts — INI 파싱, resolveProvider (17 tests) |
| 04-12 | 3-1-C | wiki-ops.ts — createPage, updateIndex, appendLog, extractWikilinks (11 tests) |
| 04-12 | 3-1-B | llm-client.ts — 4개 프로바이더 (Gemini/Anthropic/OpenAI/Ollama) (13 tests) |
| 04-12 | 3-1-D | query-pipeline.ts — qmd exec, 합성 프롬프트 (6 tests) |
| 04-12 | 3-1-E | ingest-pipeline.ts — JSON 추출, 프롬프트 DRY, reindex (10 tests) |
| 04-12 | 3-2-A | main.ts — WikeyPlugin, ObsidianWikiFS, ObsidianHttpClient 어댑터 |
| 04-12 | 3-2-B | settings-tab.ts — BASIC_MODEL, API 키, Ollama 연결, Sync 경고 |
| 04-12 | 3-2-C | sidebar-chat.ts — 채팅 UI, 마크다운 렌더링, 위키링크, CSS |
| 04-12 | 3-2-D | commands.ts — Cmd+Shift+I, 파일 선택, URI 프로토콜, 진행률 |
| 04-12 | 3-2-E | status-bar.ts — 페이지 수, 통계 모달 |
| 04-12 | 3-3 | 디버깅 5건 (CORS, PATH, ABI, qmd 경로, localhost) |
| 04-12 | 3-3 | 합성 프롬프트 3회 개선 (확정적 답변, 해요체) |
| 04-12 | 3-3 | env-detect.ts — 로그인 셸 PATH + ABI 호환 node 자동 탐지 |
| 04-12 | 4 | 채팅 UI 고도화 — Q/A 삭제, 질문 블록, purple 테마, 피드백 |
| 04-12 | 5 | 인제스트 패널 — drag/drop, 3버튼, 프로그레스바, inbox 감시 |
| 04-12 | 6 | CLI 포팅 — PDF 인제스트, classify, validate/pii/reindex/cost exec |

---

## 2. Step별 상세 결과

### 2.1 Phase 3-0: 프로젝트 스캐폴딩

**목표:** npm workspaces 기반 모노레포 구조 생성, 빌드 파이프라인 확인, 빈 플러그인 Obsidian 로드 가능 상태.

**생성된 구조:**

```
wikey/
├── package.json                 ← npm workspaces (wikey-core, wikey-obsidian)
├── wikey-core/
│   ├── package.json             ← name: "wikey-core", type: "module"
│   ├── tsconfig.json            ← strict, ES2022, ESNext, bundler moduleResolution
│   └── src/
│       ├── index.ts             ← re-export (public API)
│       ├── types.ts             ← HttpClient, WikiFS, WikeyConfig, LLMProvider 등 14개 타입
│       ├── config.ts            ← INI 파싱 + resolveProvider
│       ├── llm-client.ts        ← 4 프로바이더 LLM 클라이언트
│       ├── wiki-ops.ts          ← 페이지 CRUD + 인덱스/로그 관리
│       ├── query-pipeline.ts    ← qmd exec + LLM 합성
│       ├── ingest-pipeline.ts   ← 소스 → LLM → JSON → wiki-ops
│       ├── prompts/ingest.txt   ← DRY 인제스트 프롬프트 [H1]
│       └── __tests__/           ← vitest 테스트 5개 파일
│
├── wikey-obsidian/
│   ├── package.json             ← depends: wikey-core (workspace)
│   ├── tsconfig.json            ← noEmit (esbuild가 빌드)
│   ├── manifest.json            ← id: "wikey", isDesktopOnly: true
│   ├── esbuild.config.mjs       ← Obsidian 커뮤니티 플러그인 표준 번들러
│   ├── styles.css               ← 빈 (Phase 3-2에서 구현)
│   └── src/
│       ├── main.ts              ← WikeyPlugin extends Plugin (빈 셸)
│       ├── sidebar-chat.ts      ← WikeyChatView extends ItemView (빈 셸)
│       ├── settings-tab.ts      ← WikeySettingTab (빈 셸)
│       ├── status-bar.ts        ← WikeyStatusBar (빈 셸)
│       └── commands.ts          ← registerCommands (빈 셸)
│
├── .obsidian/plugins/wikey/     ← 심볼릭 링크 (main.js, manifest.json, styles.css)
└── .gitignore                   ← node_modules/, wikey-core/dist/, wikey-obsidian/main.js 추가
```

**의사결정:**

| 항목 | 결정 | 이유 |
|------|------|------|
| 모노레포 도구 | npm workspaces | pnpm/turborepo는 오버킬 (2 패키지) |
| 번들러 | esbuild | Obsidian 커뮤니티 플러그인 표준 |
| TS target | ES2022 | Electron 기반, top-level await 등 지원 |
| moduleResolution | bundler | esbuild 호환 최적 |
| wikey-core 참조 | `"wikey-core": "*"` | npm workspaces 자동 해석 (`workspace:*`는 pnpm 전용) |

**빌드 검증:**

| 항목 | 결과 |
|------|------|
| `npm install` | 67 packages, 0 vulnerabilities |
| `npm run build:core` (tsc) | 0 errors, dist/ 15개 파일 생성 |
| `npm run build:obsidian` (esbuild) | main.js 627 bytes |
| `npm run build` (전체) | 0 errors |
| Obsidian 심볼릭 링크 | main.js, manifest.json, styles.css 3개 연결 |
| 기존 CLI 스크립트 | llm-ingest.sh, wikey-query.sh, llm-api.sh syntax OK |

---

### 2.2 Phase 3-1-A: config.ts

**포팅 원본:** `local-llm/wikey.conf` + `scripts/lib/llm-api.sh`의 `_llm_load_config()`, `resolve_provider()`

**구현 내용:**

| 함수 | 역할 |
|------|------|
| `parseWikeyConf(content)` | INI 파싱 (key=value, # 주석, 인라인 주석 제거, 공백 트림) |
| `loadConfig(projectDir)` | .env + wikey.conf + 환경변수 우선순위 (MVP: 기본값 반환) |
| `resolveProvider(process, config)` | 프로세스별 프로바이더 분기 (ingest/lint/summarize/cr/default) |

**resolveProvider 분기 로직 (bash 1:1 포팅):**

| 프로세스 | 결정 규칙 |
|----------|----------|
| ingest | INGEST_PROVIDER ∥ WIKEY_BASIC_MODEL ∥ 'claude-code' |
| lint | LINT_PROVIDER ∥ WIKEY_BASIC_MODEL ∥ 'claude-code' |
| summarize | SUMMARIZE_PROVIDER ∥ WIKEY_BASIC_MODEL ∥ 'gemini' |
| cr | CONTEXTUAL_MODEL ∥ 'ollama' (항상 ollama) |
| default | WIKEY_BASIC_MODEL ∥ 'claude-code' |

**claude-code 해석:** ANTHROPIC_API_KEY 있으면 → anthropic, 없으면 → ollama 폴백 (bash 동일)

**테스트 (17건):** INI 파싱 7건, resolveProvider 10건 — 전부 통과

---

### 2.3 Phase 3-1-C: wiki-ops.ts

**포팅 원본:** `scripts/llm-ingest.sh`의 `apply_ingest_result()` 파일 생성 로직

**구현 내용:**

| 함수 | 역할 |
|------|------|
| `createPage(wikiFS, page)` | wiki/{category}/{filename} 경로에 페이지 생성. 경로 검증 [M2] |
| `updateIndex(wikiFS, additions)` | index.md에 새 항목 추가 (중복 방지) |
| `appendLog(wikiFS, entry)` | log.md 헤더 바로 뒤에 날짜별 항목 삽입 |
| `extractWikilinks(content)` | `[[page-name]]` 패턴 추출 (중복 제거, display text 지원) |

**보안 (M2):** `buildPath()`에서 `..`와 `/`가 포함된 filename 거부 → 디렉토리 트래버설 차단

**테스트 (11건):** createPage 4건, updateIndex 2건, appendLog 1건, extractWikilinks 4건 — 전부 통과

---

### 2.4 Phase 3-1-B: llm-client.ts

**포팅 원본:** `scripts/lib/llm-api.sh`의 4개 프로바이더 함수

**구현 내용:**

| 프로바이더 | API URL | 인증 | 응답 파싱 |
|-----------|---------|------|----------|
| Gemini | `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | `?key=` 쿼리 | `candidates[0].content.parts[0].text` |
| Anthropic | `api.anthropic.com/v1/messages` | `x-api-key` 헤더 | `content[0].text` |
| OpenAI | `api.openai.com/v1/chat/completions` | `Authorization: Bearer` | `choices[0].message.content` |
| Ollama | `{OLLAMA_URL}/api/chat` | 없음 | `message.content` (thinking 블록 제거) |

**핵심 설계:**

- `HttpClient` 인터페이스 주입 → Obsidian `requestUrl()` vs `fetch()` 교체 가능
- API 키 누락 시 명확한 에러 메시지 (설정 안내)
- Gemma 4 thinking 블록 제거: "done thinking" 마커 이후만 반환
- `responseMimeType` 지원 (Gemini 구조화 출력)

**테스트 (13건):** Gemini 3건, Anthropic 3건, OpenAI 3건, Ollama 4건 — 전부 통과

---

### 2.5 Phase 3-1-D: query-pipeline.ts

**포팅 원본:** `local-llm/wikey-query.sh` 전체

**구현 내용:**

| 함수 | 역할 |
|------|------|
| `query(question, config, httpClient)` | 전체 파이프라인: qmd 검색 → 컨텍스트 구성 → LLM 합성 |
| `parseQmdOutput(stdout)` | qmd JSON 출력 파싱, URI→경로 변환 |
| `buildSynthesisPrompt(context, question)` | wikey-query.sh 합성 프롬프트 1:1 이식 |

**합성 프롬프트 (bash 동일):**

```
아래는 wikey 위키의 관련 페이지 내용입니다.

{CONTEXT}
---
질문: {QUESTION}

위키 내용을 기반으로 답변하세요. 출처는 [[페이지명]] 형식으로 인용하세요.
```

**보안 (H2):** `execFile()` 사용 (셸 미개입) — 쿼리 문자열이 셸 해석되지 않음

**한국어 전처리:** `spawn('python3', ['korean-tokenize.py', '--mode', 'query'])` + stdin pipe. kiwipiepy 미설치 시 원문 그대로 사용 (graceful fallback).

**qmd 경로 자동 탐지:** 설정값 → `tools/qmd/bin/qmd` (vendored) → `which qmd` 순서

**테스트 (6건):** qmd 출력 파싱 4건, 합성 프롬프트 구성 2건 — 전부 통과

---

### 2.6 Phase 3-1-E: ingest-pipeline.ts

**포팅 원본:** `scripts/llm-ingest.sh` 전체

**구현 내용:**

| 함수 | 역할 |
|------|------|
| `ingest(sourcePath, wikiFS, config, httpClient, onProgress?)` | 전체 파이프라인: 읽기 → LLM → JSON → wiki-ops |
| `extractJsonBlock(text)` | LLM 응답에서 JSON 추출 (```json 블록 → bare JSON 순서) |
| `buildIngestPrompt(sourceContent, sourceFilename, indexContent)` | 인제스트 프롬프트 조합 ({{TODAY}}, {{INDEX_CONTENT}} 등 치환) |

**프롬프트 DRY (H1):** `prompts/ingest.txt`를 `llm-ingest.sh`의 `build_ingest_prompt()`에서 추출. bash/TS 양쪽에서 동일 프롬프트 사용 가능. 플레이스홀더: `{{TODAY}}`, `{{INDEX_CONTENT}}`, `{{SOURCE_FILENAME}}`, `{{SOURCE_CONTENT}}`.

**JSON 추출 로직:**
1. ` ```json ... ``` ` 코드 블록 우선 시도
2. ` ``` ... ``` ` (lang 태그 없음) 시도
3. bare JSON (`{...}`) 시도
4. 실패 시 최대 2회 LLM 재호출
5. Gemini: `responseMimeType: "application/json"` 구조화 출력 활용

**진행률 콜백 (CEO 추가):** `IngestProgressCallback(step, total, message)` — 4단계 (소스 읽기 → LLM 호출 → 파일 생성 → 인덱싱)

**reindex 트리거:** fire-and-forget `execFile('scripts/reindex.sh', ['--quick'])` — 실패해도 인제스트 결과에 영향 없음

**테스트 (10건):** JSON 추출 6건, 프롬프트 구성 4건 — 전부 통과

---

## 3. Phase 3-2: Obsidian 플러그인 MVP

### 3.1 Phase 3-2-A: main.ts + 어댑터

| 구현 | 역할 |
|------|------|
| `WikeyPlugin extends Plugin` | onload: 리본 아이콘, 커맨드, 설정 탭, 채팅 뷰, 상태 바 등록 |
| `ObsidianWikiFS implements WikiFS` | Vault API 래핑 (read/write/exists/list, 자동 디렉토리 생성) |
| `ObsidianHttpClient implements HttpClient` | `requestUrl()` 래핑 (CORS 우회) |
| `WikeySettings` | data.json 기반 설정 (basicModel, API 키, ollamaUrl, qmdPath, costLimit) |
| `buildConfig()` | 설정 → WikeyConfig 변환 |
| `activateChatView()` | 채팅 사이드바 열기 (기존 뷰 재활용) |

### 3.2 Phase 3-2-B: settings-tab.ts

| 항목 | 구현 |
|------|------|
| 기본 모델 드롭다운 | ollama / gemini / anthropic / openai / claude-code |
| Ollama URL | 텍스트 입력 (기본: http://localhost:11434) |
| 연결 테스트 버튼 | `/api/tags` 호출 → 모델 수 표시 / 실패 안내 |
| API 키 입력 | Gemini, Anthropic, OpenAI 각각 (password 마스킹) |
| Sync 경고 [M1] | ⚠️ "Obsidian Sync 사용 시 API 키 동기화됩니다" 문구 |
| qmd 경로 | 자동 탐지 + 수동 입력 |
| 비용 한도 | 숫자 입력 (기본: $50) |

### 3.3 Phase 3-2-C: sidebar-chat.ts — MVP 핵심

**UI 구조:**
```
┌─────────────────────────────┐
│  Wikey                      │  ← 헤더
├─────────────────────────────┤
│  Q: ESC란?                   │
│  A: ESC(Electronic Speed... │
│  참고: [[esc]], [[pid-loop]] │  ← 클릭 가능
├─────────────────────────────┤
│  [질문을 입력하세요...]  [↩] │
└─────────────────────────────┘
```

| 기능 | 구현 |
|------|------|
| 채팅 UI | ItemView 기반 사이드바, 메시지 목록 + textarea 입력 |
| 쿼리 실행 | Enter 키 → `query()` 호출 → 마크다운 답변 표시 |
| 마크다운 렌더링 | `MarkdownRenderer.render()` — 코드블록, 테이블, 리스트 지원 |
| 위키링크 | `[[page]]` → 클릭 가능한 링크, `app.workspace.openLinkText()` |
| 세션 대화 유지 | chatHistory를 플러그인 인스턴스에 저장 (뷰 재생성 시 복원) |
| 로딩 | 스피너 애니메이션 + "답변을 생성하고 있습니다..." |
| 에러 처리 | API 키 누락, qmd 없음, 네트워크 오류별 안내 메시지 |
| 스타일링 | Obsidian CSS 변수 사용 (다크/라이트 모드 자동 대응) [L1] |

### 3.4 Phase 3-2-D: commands.ts

| 기능 | 구현 |
|------|------|
| Cmd+Shift+I | 현재 열린 노트 인제스트 (raw/ 외부 시 경고) |
| "Ingest file..." | FuzzySuggestModal — wiki/ 제외한 마크다운 파일 선택 |
| 진행률 Notice [CEO] | "1/4 소스 읽기..." → "2/4 LLM 호출..." → ... |
| 완료 Notice | "인제스트 완료: 3개 페이지 — [[esc]], [[pid-loop]], [[source-esc]]" |
| URI 프로토콜 [CEO] | `obsidian://wikey?query=ESC` → 사이드바 열기 + 자동 쿼리 |
| | `obsidian://wikey?ingest=path/to/file.md` → 인제스트 실행 |

### 3.5 Phase 3-2-E: status-bar.ts

| 기능 | 구현 |
|------|------|
| 상태 바 | "📚 29 pages" (wiki/ 내 .md 재귀 카운트) |
| 갱신 주기 | 5분마다 자동 갱신 |
| 클릭 | 상세 통계 모달 (entities/concepts/sources/analyses/meta 각각 표시) |
| cost-tracker fallback [M4] | 비용 표시 미구현 (cost-tracker.sh 미존재 시 페이지 수만 표시) |

---

## 4. Eng 리뷰 이슈 반영 현황

### HIGH

| # | 이슈 | 반영 | 상태 |
|---|------|------|------|
| H1 | 인제스트 프롬프트 DRY | `prompts/ingest.txt` 추출 + `buildIngestPrompt()` 플레이스홀더 치환 | **완료** |
| H2 | child_process 셸 주입 | 모든 외부 프로세스 호출에 `execFile()`/`spawn()` 사용 | **완료** |
| H3 | qmd DB 동시 접근 | Phase 3-3에서 CLI 병행 테스트로 검증 예정 | 대기 |

### MEDIUM

| # | 이슈 | 반영 | 상태 |
|---|------|------|------|
| M1 | Obsidian Sync API 키 경고 | settings-tab.ts에 경고 문구 표시 | **완료** |
| M2 | wiki-ops 경로 검증 | `buildPath()`에서 `..`, `/` 차단 | **완료** |
| M3 | wikey.conf 동시 수정 방지 | Obsidian data.json 단독 사용 (wikey.conf 양방향 동기화는 v2) | 연기 |
| M4 | cost-tracker.sh fallback | 비용 미표시, 페이지 수만 표시 | **완료** (graceful fallback) |

### CEO 추가 항목

| 항목 | 반영 | 상태 |
|------|------|------|
| Obsidian URI 프로토콜 | `obsidian://wikey?query=` + `?ingest=` | **완료** |
| 인제스트 진행률 | Notice 4단계 표시 | **완료** |

---

## 5. Step 3: 디버깅 (5건 해결)

Obsidian Electron 환경의 제약으로 5건의 런타임 이슈 발견 및 해결:

| # | 문제 | 원인 | 해결 |
|---|------|------|------|
| 1 | CORS 차단 | `import('node:path')` → 웹 fetch 취급 | `require()` 전환 |
| 2 | node not found | Electron PATH에 nvm 미포함 | 로그인 셸 PATH 탐지 (`env-detect.ts`) |
| 3 | ABI mismatch | Electron node ≠ 시스템 node | qmd 호환 node 자동 선택 (`findCompatibleNode`) |
| 4 | localhost 차단 | `requestUrl()` CORS | Node.js `http` 모듈 직접 호출 |
| 5 | 빈 검색 결과 | qmd URI에 `wiki/` 누락 | `parseQmdOutput`에 접두사 추가 |

---

## 6. Step 4: UI 고도화

- Q/A 아이콘 삭제 → 질문=배경 블록(radius 8), 답변=전체 너비
- 좌우 여백 0 (헤더~입력 전체)
- 헤더 5개 plain icon: [+][?][🗑][↻][✕], hover=purple, active=purple bg+white
- 입력창 x1.5 + 전송 plain icon 중앙 + 모델 태그(purple, 0.92em)
- 답변 하단: 복사/좋아요/나빠요 (피드백 data.json 저장)
- 테이블: 세로선 없음, 가로선 1px, 상하단 2px
- 도움말 [?] 인라인 + scrollIntoView
- Purple accent 테마 통일

---

## 7. Step 5: 인제스트 UI

- [+] → 인제스트 패널 (상단 토글)
- 3개 액션 버튼: Add to inbox / Ingest inbox / Add+Ingest
- 네이티브 파일 탐색기 (input type=file), drag/drop
- 파일별 프로그레스바 (2px) + 결과 wikilink
- inbox→_processed/ 자동 이동
- inbox 감시 (vault.on('create') + Notice)

---

## 8. Step 6: CLI 포팅

| 스크립트 | 포팅 | 모듈 |
|---------|------|------|
| llm-ingest.sh | 완전 포팅 | `ingest-pipeline.ts` |
| wikey-query.sh | 완전 포팅 | `query-pipeline.ts` |
| llm-api.sh | 완전 포팅 | `llm-client.ts` + `config.ts` |
| classify-inbox.sh | 규칙 엔진 포팅 | `classify.ts` |
| summarize-large-source.sh | PDF 텍스트 추출 포팅 | `ingest-pipeline.ts` |
| validate-wiki.sh | exec 래퍼 | `scripts-runner.ts` |
| check-pii.sh | exec 래퍼 | `scripts-runner.ts` |
| reindex.sh | exec 래퍼 | `scripts-runner.ts` |
| cost-tracker.sh | exec 래퍼 | `scripts-runner.ts` |

---

## 9. 코드 규모 (현재)

| 영역 | 파일 | 라인 수 |
|------|------|---------|
| wikey-core/src (구현) | 9개 (.ts) | ~1,300 |
| wikey-core/src/__tests__ | 5개 (.test.ts) | ~600 |
| wikey-obsidian/src | 6개 (.ts) | ~1,100 |
| wikey-obsidian/styles.css | 1개 | ~400 |
| **합계** | **21개** | **~3,400** |

65 tests passed, 빌드 0 errors.
커밋: 31개 (Phase 3 시작 이후)

---

## 10. 이번 세션 추가 완료 (2026-04-12 저녁)

### Must 3/3 + Should 5/5 완료

- [x] 상태 바 "0 pages" — onLayoutReady + vault 이벤트 debounced
- [x] Obsidian 통합 테스트 — 6 시나리오 프로그래매틱 검증
- [x] PDF 인제스트 E2E — Raspberry Pi PDF 7페이지 생성 성공
- [x] Summary 대시보드 — wiki/raw 현황, 태그 랭킹, 미인제스트 통계
- [x] classify UI — PARA 드롭다운 + 이동
- [x] 비용 추적/reindex/validate/pii UI — 설정 탭 위키 도구 섹션

### 추가 구현

- [x] **Audit 패널** — 헤더 [👁] 아이콘, 미인제스트 문서 관리
  - 체크박스 선택 + 전체선택 + 폴더 필터
  - 프로바이더 선택 (기본=basicModel) + [적용] [보류] 버튼
  - 파일별 프로그레스바 (행 하단선, stripe 애니메이션, 가중치 5/80/90/100%)
  - ingest-map.json 매핑 영속화 (재시작 시 정확한 인식)
  - 실패 파일 목록 유지 + 에러 메시지 표시 + 파일별 즉시 카운터 갱신
- [x] **Cross-lingual 검색** — 한국어→영문 키워드 추출 + CR bilingual 프롬프트
- [x] **클라우드 LLM 모델 선택** — API 동적 로드 + .wikey-select chevron UI 통일
- [x] **헤더 배타적 토글** — 4패널 중 1개만 활성 + active 스타일
- [x] **헤더/입력 고정** — overflow:hidden + flex-shrink:0
- [x] **inbox 우회 감지** — 시작 10초 grace + 배치 알림
- [x] **pdftotext PATH** — Electron 환경 /opt/homebrew/bin 보강
- [x] **audit-ingest.py** — raw/ 미인제스트 문서 감지 스크립트

### 코드 규모 (갱신)

| 영역 | 파일 | 라인 수 |
|------|------|---------|
| wikey-core/src (구현) | 9개 (.ts) | ~1,600 |
| wikey-core/src/__tests__ | 5개 (.test.ts) | ~600 |
| wikey-obsidian/src | 6개 (.ts) | ~1,800 |
| wikey-obsidian/styles.css | 1개 | ~700 |
| scripts/audit-ingest.py | 1개 | ~120 |
| **합계** | **22개** | **~4,820** |

65 tests passed, 빌드 0 errors.

### 다음 세션 작업

- [ ] Audit 인제스트 세부 테스트 (다양한 PDF, 에러 케이스)
- [ ] 인제스트 품질 검증 (wiki 페이지 내용 리뷰)
- [ ] Obsidian UI 수동 테스트
- [ ] Could 항목 선택적 진행 (대화 영구 저장, BRAT 배포 등)
