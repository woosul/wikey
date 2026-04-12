# Phase 3: Todo List — Obsidian 플러그인 (wikey-core + wikey-obsidian)

> 기간: 2026-04-12 ~
> 상태: **대기** (0/0 필수, 0/0 중요, 0/0 선택)
> 전제: Phase 2 완료 (필수 7/7, 중요 6/6)
> 인프라: Ollama 0.20.5 + Gemma 4 (12B), qmd 2.1.0 (vendored), Node.js + Bun
> 핵심 계획: `prompt_plan.md`
> 리뷰: CEO (SELECTIVE EXPANSION) + Eng 완료

---

## 스크립트 → TypeScript 포팅 매핑

> 원본: plan/phase3-ux-architecture.md (통합 후 삭제됨)

| 현재 (bash/python) | wikey-core (TypeScript) | 비고 |
|---|---|---|
| `scripts/lib/llm-api.sh` | `llm-client.ts` | curl → fetch/requestUrl |
| `scripts/llm-ingest.sh` | `ingest-pipeline.ts` | 프롬프트 + JSON 파싱 동일 |
| `local-llm/wikey-query.sh` | `query-pipeline.ts` | qmd CLI → qmd JS API (v2) |
| `scripts/reindex.sh` | `reindex.ts` (또는 exec 유지) | child_process.exec 래핑 |
| `scripts/contextual-retrieval.py` | exec 유지 | Gemma 4 Ollama 호출 |
| `scripts/korean-tokenize.py` | exec 유지 (Python 필수) | kiwipiepy는 Python only |
| `local-llm/wikey.conf` | `config.ts` | INI 파싱 |
| `scripts/cost-tracker.sh` | exec 유지 (선택적 포팅) | 상태 바에서 호출 |

---

## Step 0: 프로젝트 스캐폴딩

> 모노레포 구조 생성, 빌드 파이프라인 확인, 빈 플러그인 Obsidian 로드 검증.

### 0-1. 루트 package.json + npm workspaces

- [ ] **0-1-1.** 루트 `package.json` 생성
  - `workspaces: ["wikey-core", "wikey-obsidian"]`
  - `private: true`
  - 기존 프로젝트 파일(wiki/, raw/, scripts/ 등)에 영향 없음 확인

### 0-2. wikey-core 스캐폴딩

- [ ] **0-2-1.** `wikey-core/package.json` 생성
  - `name: "wikey-core"`, `type: "module"`, `main: "dist/index.js"`
  - devDependencies: `typescript`, `vitest`
- [ ] **0-2-2.** `wikey-core/tsconfig.json` 생성
  - `strict: true`, `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "bundler"`
- [ ] **0-2-3.** 빈 소스 파일 생성
  - `src/index.ts` (re-export)
  - `src/types.ts` (WikiPage, IngestResult, QueryResult, WikeyConfig 등 타입 정의)
  - `src/config.ts`, `src/llm-client.ts`, `src/wiki-ops.ts` (빈 셸)
  - `src/query-pipeline.ts`, `src/ingest-pipeline.ts` (빈 셸)
- [ ] **0-2-4.** `src/prompts/ingest.txt` 생성 — `llm-ingest.sh`의 `build_ingest_prompt()` 프롬프트 추출 [H1]
  - bash와 TS 양쪽에서 동일 프롬프트 참조 (DRY)
- [ ] **0-2-5.** `npm run build` (tsc) → `dist/` 생성 확인

### 0-3. wikey-obsidian 스캐폴딩

- [ ] **0-3-1.** `wikey-obsidian/package.json` 생성
  - `dependencies: { "wikey-core": "workspace:*" }`
  - devDependencies: `@types/node`, `esbuild`, `obsidian`, `typescript`
- [ ] **0-3-2.** `wikey-obsidian/tsconfig.json` 생성
- [ ] **0-3-3.** `wikey-obsidian/manifest.json` 생성
  - `id: "wikey"`, `name: "Wikey"`, `version: "0.1.0"`
  - `isDesktopOnly: true`, `minAppVersion: "1.5.0"`
- [ ] **0-3-4.** `wikey-obsidian/esbuild.config.mjs` 생성 (Obsidian 커뮤니티 플러그인 표준)
- [ ] **0-3-5.** `wikey-obsidian/styles.css` 생성 (빈 파일)
- [ ] **0-3-6.** 빈 소스 파일 생성
  - `src/main.ts`, `src/sidebar-chat.ts`, `src/settings-tab.ts`
  - `src/status-bar.ts`, `src/commands.ts`
- [ ] **0-3-7.** `npm run build` → `wikey-obsidian/main.js` 단일 파일 생성 확인

### 0-4. 개발 환경 설정

- [ ] **0-4-1.** `.obsidian/plugins/wikey/` → `wikey-obsidian/` 심볼릭 링크 생성
  - `main.js`, `manifest.json`, `styles.css` 연결
- [ ] **0-4-2.** Obsidian에서 wikey 플러그인 로드 확인 (빈 플러그인, 에러 없음)
- [ ] **0-4-3.** `.gitignore` 업데이트
  - `wikey-core/dist/`, `wikey-core/node_modules/`
  - `wikey-obsidian/main.js`, `wikey-obsidian/node_modules/`
  - `node_modules/` (루트)
- [ ] **0-4-4.** 기존 CLI 스크립트 정상 동작 확인 (`wikey-query.sh`, `llm-ingest.sh`)

### 0-5. 완료 기준

- [ ] **0-5-1.** `npm run build` → `wikey-obsidian/main.js` 생성
- [ ] **0-5-2.** Obsidian 커뮤니티 플러그인에서 "Wikey" 표시 + 활성화 가능
- [ ] **0-5-3.** 기존 CLI 워크플로우 미영향 확인
- [ ] **0-5-4.** Git 커밋

---

## Step 1: wikey-core 구현 (TDD)

> bash/python 스크립트 핵심 로직을 TypeScript로 포팅. 모든 모듈은 테스트 먼저.

### 1-1. config.ts (0.5일)

> 포팅 원본: `local-llm/wikey.conf` + `scripts/lib/llm-api.sh`의 `_llm_load_config()`, `resolve_provider()`

- [ ] **1-1-1.** `WikeyConfig` 타입 정의 (types.ts에 추가)
  - `WIKEY_BASIC_MODEL`, `WIKEY_SEARCH_BACKEND`, `WIKEY_MODEL`, `WIKEY_QMD_TOP_N`
  - `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OLLAMA_URL`
  - `INGEST_PROVIDER`, `LINT_PROVIDER`, `SUMMARIZE_PROVIDER`, `CONTEXTUAL_MODEL`
- [ ] **1-1-2.** `parseWikeyConf(content: string)` 구현
  - INI 파싱 (key=value, `#` 주석, 빈 줄 스킵)
  - 인라인 주석 제거 (`value # comment` → `value`)
- [ ] **1-1-3.** `loadConfig(projectDir: string)` 구현
  - `.env` 파일 로드 (dotenv 호환)
  - `wikey.conf` 파싱
  - 우선순위: 환경변수 > wikey.conf > 하드코딩 기본값
- [ ] **1-1-4.** `resolveProvider(process: string, config: WikeyConfig)` 구현
  - `llm-api.sh`의 `resolve_provider()` 로직 그대로 포팅
- [ ] **1-1-5.** vitest 테스트 작성 + 통과
  - INI 파싱 정확성 (주석, 빈 줄, 인라인 주석)
  - 환경변수 오버라이드 우선순위
  - resolveProvider 프로세스별 분기 (ingest/lint/summarize/cr/default)
  - 누락 키 기본값 폴백

### 1-2. llm-client.ts (1일)

> 포팅 원본: `scripts/lib/llm-api.sh`의 `_llm_call_gemini()`, `_llm_call_anthropic()`, `_llm_call_openai()`, `_llm_call_ollama()`

- [ ] **1-2-1.** `HttpClient` 인터페이스 정의 (types.ts에 추가)
  ```typescript
  interface HttpClient {
    request(url: string, opts: HttpRequestOptions): Promise<HttpResponse>
  }
  ```
- [ ] **1-2-2.** `FetchHttpClient` 구현 (CLI/테스트용, `fetch()` 래퍼)
- [ ] **1-2-3.** `LLMClient` 클래스 구현
  - `call(prompt, opts?)` → `Promise<string>` (전체 응답)
  - httpClient 주입 (생성자 매개변수)
  - 프로바이더별 페이로드 구성:
    - Gemini: `POST /v1beta/models/{model}:generateContent` [llm-api.sh:72-99]
    - Anthropic: `POST /v1/messages` [llm-api.sh:172-219]
    - OpenAI: `POST /v1/chat/completions` [llm-api.sh 참조]
    - Ollama: `POST /api/generate` [llm-api.sh 참조]
  - `execFile()` 사용 패턴 (셸 미개입) [H2]
- [ ] **1-2-4.** 에러 핸들링
  - API 키 누락 → 명확한 에러 메시지
  - 네트워크 오류 → 재시도 안내
  - Rate limit → 대기 후 재시도 (Gemini 429)
  - 타임아웃 (60초 기본)
- [ ] **1-2-5.** vitest 테스트 작성 + 통과
  - 각 프로바이더 페이로드 구성 검증 (목 HttpClient)
  - API 키 누락 시 에러
  - 응답 파싱 (Gemini candidates, Anthropic content, OpenAI choices, Ollama response)

### 1-3. wiki-ops.ts (0.5일)

> 포팅 원본: `scripts/llm-ingest.sh`의 `apply_ingest_result()` 내 파일 생성 로직

- [ ] **1-3-1.** `WikiFS` 인터페이스 정의 (types.ts에 추가)
  ```typescript
  interface WikiFS {
    read(path: string): Promise<string>
    write(path: string, content: string): Promise<void>
    exists(path: string): Promise<boolean>
    list(dir: string): Promise<string[]>
  }
  ```
- [ ] **1-3-2.** `NodeWikiFS` 구현 (CLI/테스트용, Node.js `fs` 래퍼)
- [ ] **1-3-3.** `createPage(wikiFS, category, filename, content)` 구현
  - 경로 검증: `wiki/` 프리픽스 하드체크 [M2]
  - 프론트매터 포함 확인
  - 이미 존재 시 업데이트 모드
- [ ] **1-3-4.** `updateIndex(wikiFS, additions)` 구현
  - index.md에 새 항목 추가 (카테고리별 위치에 삽입)
  - 중복 방지 (이미 등재된 페이지 스킵)
- [ ] **1-3-5.** `appendLog(wikiFS, entry)` 구현
  - log.md 맨 위에 날짜별 항목 추가
- [ ] **1-3-6.** `extractWikilinks(content)` 유틸리티
  - `[[page-name]]` 패턴 추출
- [ ] **1-3-7.** vitest 테스트 작성 + 통과
  - 페이지 생성 (프론트매터 포함)
  - 경로 검증 (`wiki/` 외부 경로 거부)
  - index.md 항목 추가 (중복 방지)
  - 위키링크 추출

### 1-4. query-pipeline.ts (1일)

> 포팅 원본: `local-llm/wikey-query.sh` 전체

- [ ] **1-4-1.** `QueryResult` 타입 정의 (types.ts)
  - `answer: string`, `sources: SearchResult[]`, `tokensUsed?: number`
- [ ] **1-4-2.** `query(question, opts)` 구현
  - qmd 검색 (MVP: `execFile('qmd', ['query', '--json', '-n', topN, question])`)
  - qmd 출력 JSON 파싱
  - 검색 결과 + 질문 → LLM 합성 프롬프트 구성
  - `wikey-query.sh`의 합성 프롬프트를 템플릿 리터럴로 이식
  - LLM 호출 → 답변 반환
- [ ] **1-4-3.** qmd 경로 자동 탐지
  - 설정값 우선 → `which qmd` → `tools/qmd/bin/qmd` 순서
- [ ] **1-4-4.** 한국어 형태소 전처리 (선택적)
  - `execFile('python3', ['scripts/korean-tokenize.py', '--mode', 'query', question])`
  - kiwipiepy 미설치 시 graceful fallback (원문 그대로)
- [ ] **1-4-5.** vitest 테스트 작성 + 통과
  - qmd CLI 출력 파싱 (모의 JSON)
  - 합성 프롬프트 구성 (검색 결과 + 질문 포함 확인)
  - qmd 경로 자동 탐지 로직

### 1-5. ingest-pipeline.ts (1일)

> 포팅 원본: `scripts/llm-ingest.sh` 전체

- [ ] **1-5-1.** `IngestResult` 타입 정의 (types.ts)
  - `createdPages: string[]`, `updatedPages: string[]`, `sourcePage: string`
- [ ] **1-5-2.** `IngestProgress` 콜백 타입 정의 [CEO 추가]
  - `onProgress(step: number, total: number, message: string)`
  - 단계: 1/4 소스 읽기 → 2/4 LLM 호출 → 3/4 파일 생성 → 4/4 인덱싱
- [ ] **1-5-3.** `ingest(sourcePath, opts)` 구현
  - 소스 읽기 (WikiFS.read — 마크다운만, PDF는 v2)
  - index.md 읽기 (기존 페이지 목록 확인)
  - 인제스트 프롬프트 로드 (`prompts/ingest.txt` + 동적 부분 조합) [H1]
  - LLM 호출 → JSON 응답 추출
  - wiki-ops로 파일 생성/수정 (source, entities, concepts)
  - index.md, log.md 갱신
- [ ] **1-5-4.** JSON 추출 로직 구현
  - ` ```json ... ``` ` 블록 추출
  - JSON.parse() + 실패 시 최대 2회 재시도 (LLM 재호출)
  - 구조화 출력 API 지원 (Gemini `response_mime_type: "application/json"`)
- [ ] **1-5-5.** reindex 트리거
  - `execFile('scripts/reindex.sh', ['--quick'])` — 백그라운드 실행
- [ ] **1-5-6.** vitest 테스트 작성 + 통과
  - JSON 블록 추출 (정상/불완전/누락 케이스)
  - 인제스트 프롬프트 구성 (소스 내용 + 인덱스 포함 확인)
  - 파일 생성 호출 검증 (모의 WikiFS)

### 1-6. 통합 확인

- [ ] **1-6-1.** `npm test` — wikey-core 전체 테스트 통과 (19+ 케이스, 0 failures)
- [ ] **1-6-2.** `npm run build` — wikey-core 컴파일 성공
- [ ] **1-6-3.** Git 커밋

---

## Step 2: Obsidian 플러그인 MVP

> wikey-core를 Obsidian UI로 연결. 4개 MVP 기능 구현.

### 2-1. main.ts + 어댑터 (0.5일)

- [ ] **2-1-1.** `WikeyPlugin extends Plugin` 구현
  - `onload()`: 리본 아이콘, 커맨드, 설정 탭, 채팅 뷰, 상태 바 등록
  - `onunload()`: 리소스 정리
  - `loadData()` / `saveData()` — 설정 로드/저장
- [ ] **2-1-2.** `ObsidianWikiFS implements WikiFS` 구현
  - `Vault.read()`, `Vault.create()`, `Vault.modify()` 래핑
  - 경로 변환: 상대 경로 ↔ Obsidian TFile
- [ ] **2-1-3.** `ObsidianHttpClient implements HttpClient` 구현
  - Obsidian `requestUrl()` 래핑 (CORS 우회)
- [ ] **2-1-4.** wikey-core 인스턴스 초기화
  - config 로드 → LLMClient 생성 → WikiOps 생성
  - 채팅 히스토리를 플러그인 인스턴스에 저장 (뷰와 분리) [L2]

### 2-2. settings-tab.ts (0.5일)

- [ ] **2-2-1.** `WikeySettingTab extends PluginSettingTab` 구현
- [ ] **2-2-2.** BASIC_MODEL 드롭다운
  - 옵션: `claude-code | gemini | codex | ollama`
- [ ] **2-2-3.** API 키 입력 (비밀번호 마스킹)
  - Gemini, Anthropic, OpenAI 각각
  - Obsidian Sync 사용 시 경고 문구 표시 [M1]
- [ ] **2-2-4.** Ollama URL + 연결 테스트 버튼
  - 기본값: `http://localhost:11434`
  - "연결 확인" → Ollama `/api/tags` 호출 → 초록/빨강 표시
- [ ] **2-2-5.** qmd 바이너리 경로
  - 자동 탐지 (which → 프로젝트 내 탐색) + 수동 입력
- [ ] **2-2-6.** 비용 한도 설정 ($50 기본)
- [ ] **2-2-7.** 설정 저장 시 `wikey.conf` 양방향 동기화 [M3]
  - Obsidian data.json → wikey.conf 쓰기 (원자적)
  - 플러그인 활성화 시 wikey.conf → data.json 재로드

### 2-3. sidebar-chat.ts (3~4일) — MVP 핵심

- [ ] **2-3-1.** `WikeyChatView extends ItemView` 구현
  - `getViewType()`: `"wikey-chat"`
  - `getDisplayText()`: `"Wikey"`
  - `getIcon()`: `"search"` 또는 커스텀
- [ ] **2-3-2.** 채팅 UI 레이아웃 (HTML + CSS)
  ```
  ┌─────────────────────────────┐
  │  🔍 Wikey            [설정] │  ← 헤더
  ├─────────────────────────────┤
  │  메시지 목록 (스크롤)        │
  │  Q: ...                     │
  │  A: ...                     │
  ├─────────────────────────────┤
  │  [질문을 입력하세요...]  [↩] │  ← 입력
  └─────────────────────────────┘
  ```
- [ ] **2-3-3.** 질문 전송 → query-pipeline 호출 → 응답 표시
  - 로딩 인디케이터 ("답변을 생성하고 있습니다...")
  - 에러 표시 (API 키 누락, 네트워크 오류 등)
  - AbortController — 이전 요청 진행 중 새 질문 시 취소
- [ ] **2-3-4.** 마크다운 렌더링
  - Obsidian `MarkdownRenderer.render()` 사용
  - 코드 블록, 테이블, 리스트 등 지원
- [ ] **2-3-5.** 위키링크 처리
  - `[[page-name]]` → 클릭 가능한 링크로 변환
  - 클릭 시 `app.workspace.openLinkText(linktext, '')` 호출
- [ ] **2-3-6.** 세션 내 대화 유지
  - 채팅 히스토리를 플러그인 인스턴스에 저장
  - 사이드바 닫았다 열어도 유지 (뷰 재생성 시 복원)
- [ ] **2-3-7.** 스타일링
  - Obsidian CSS 변수 사용 (`--background-primary`, `--text-normal` 등) [L1]
  - 다크/라이트 모드 자동 대응
  - 최소 너비 250px, 반응형

### 2-4. commands.ts — 인제스트 (1일)

- [ ] **2-4-1.** `Cmd+Shift+I` 핫키 등록: "Wikey: Ingest current note"
- [ ] **2-4-2.** 커맨드 팔레트 등록
  - "Wikey: Ingest current note"
  - "Wikey: Ingest file..." (파일 선택 모달 — `FuzzySuggestModal`)
- [ ] **2-4-3.** 인제스트 실행 + 진행률 표시
  - `Notice("1/4 소스 읽기...")` → `Notice("2/4 LLM 호출...")` → ... [CEO 추가]
  - 완료: `Notice("인제스트 완료: 3개 페이지 생성 — [[esc]], [[pid-loop]], [[source-esc-guide]]")`
  - 실패: `Notice("인제스트 실패: API 키를 확인하세요")`
- [ ] **2-4-4.** raw/ 외부 파일 경고
  - 현재 파일이 `raw/` 디렉토리 밖이면 확인 모달 표시
- [ ] **2-4-5.** Obsidian URI 프로토콜 등록 [CEO 추가]
  - `obsidian://wikey?query=ESC` → 사이드바 열기 + 자동 쿼리
  - `obsidian://wikey?ingest=path/to/file.md` → 인제스트 실행
  - Alfred/Raycast 연동 가능

### 2-5. status-bar.ts (0.5일)

- [ ] **2-5-1.** 상태 바 아이템 등록
  - 왼쪽: `📚 29 pages` (wiki/ 내 .md 파일 수)
  - 오른쪽: `$21.13/50` (cost-tracker.sh exec) [M4: 미존재 시 fallback]
- [ ] **2-5-2.** 주기적 갱신
  - 5분마다 자동 갱신
  - 인제스트 완료 이벤트 시 즉시 갱신
- [ ] **2-5-3.** 클릭 시 상세 모달
  - 위키 통계 (entities/concepts/sources/analyses 수)
  - 최근 인제스트 이력 (log.md 최근 5건)
  - 인덱스 상태 (qmd status exec)

### 2-6. 완료 기준

- [ ] **2-6-1.** 설정 탭 → API 키 저장 → Obsidian 재시작 → 키 유지
- [ ] **2-6-2.** Ollama 연결 테스트 → 초록 체크마크
- [ ] **2-6-3.** 채팅에서 "ESC란?" → 위키 기반 답변 + `[[esc]]` 링크
- [ ] **2-6-4.** `[[esc]]` 클릭 → `wiki/entities/` 내 파일 열림
- [ ] **2-6-5.** `Cmd+Shift+I` → `wiki/sources/` 파일 생성
- [ ] **2-6-6.** 상태 바 "29 pages indexed" 정확
- [ ] **2-6-7.** 기존 CLI `wikey-query.sh "ESC"` 동일 결과
- [ ] **2-6-8.** Git 커밋

---

## Step 3: 통합 테스트 + 마무리

> 단위 테스트, 수동 통합 테스트, 에러 케이스, 배포 준비.

### 3-1. 단위 테스트 보강 (1일)

- [ ] **3-1-1.** wikey-core vitest 전체 통과 (19+ 케이스)
  - config: INI 파싱, 환경변수 오버라이드, resolveProvider (4건)
  - llm-client: 4개 프로바이더 페이로드, API 키 누락, 응답 파싱 (5건)
  - wiki-ops: 페이지 생성, 경로 검증, index 갱신, 위키링크 추출 (4건)
  - query-pipeline: qmd 출력 파싱, 합성 프롬프트 (2건)
  - ingest-pipeline: JSON 추출, 프롬프트 구성, 재시도 (3건+)
- [ ] **3-1-2.** 테스트 커버리지 확인 (80%+ 목표)

### 3-2. 수동 통합 테스트 (1일)

- [ ] **3-2-1.** 첫 실행 시나리오
  - Obsidian 설정 → Wikey 탭 → API 키 입력 → 저장 → 재시작 → 키 유지
- [ ] **3-2-2.** Ollama 쿼리 시나리오
  - BASIC_MODEL: ollama → 채팅 "ESC란?" → 답변 수신 + [[esc]] 링크 → 클릭 → 파일 열림
- [ ] **3-2-3.** Gemini 쿼리 시나리오
  - BASIC_MODEL을 gemini로 변경 → 동일 질문 → 답변 수신
- [ ] **3-2-4.** 인제스트 시나리오
  - raw/ 소스 열기 → Cmd+Shift+I → wiki/sources/ 파일 생성 확인
  - 진행률 Notice 4단계 표시 확인
- [ ] **3-2-5.** 에러 시나리오
  - API 키 삭제 → 쿼리 → 에러 메시지 + 설정 안내
  - Ollama 중지 → 쿼리 → "Ollama가 실행 중이 아닙니다" 메시지
- [ ] **3-2-6.** CLI 병행 시나리오
  - 플러그인 사용 후 → `wikey-query.sh "ESC"` → 동일 결과 확인

### 3-3. 에러 케이스 처리 (1일)

- [ ] **3-3-1.** API 키 미설정 → 설정 탭으로 안내 (채팅 인라인 + Notice)
- [ ] **3-3-2.** Ollama 미실행 → "Ollama를 먼저 실행해주세요" + 3초 타임아웃
- [ ] **3-3-3.** qmd 바이너리 없음 → "qmd를 찾을 수 없습니다" + 설치 가이드
- [ ] **3-3-4.** qmd DB 비어있음 → "위키가 인덱싱되지 않았습니다" + reindex 안내
- [ ] **3-3-5.** LLM 응답 지연 → 60초 타임아웃 + 취소 버튼
- [ ] **3-3-6.** LLM JSON 파싱 실패 → 원본 응답 표시 + 수동 처리 안내
- [ ] **3-3-7.** kiwipiepy 미설치 → graceful fallback + "한국어 검색이 제한될 수 있습니다" 안내
- [ ] **3-3-8.** cost-tracker.sh 미존재 → 비용 미표시 (상태 바 페이지 수만) [M4]

### 3-4. 배포 준비 (0.5일)

- [ ] **3-4-1.** manifest.json 최종 확인 (id, name, version, minAppVersion, isDesktopOnly)
- [ ] **3-4-2.** `.obsidian/plugins/wikey/` 심볼릭 링크 검증
- [ ] **3-4-3.** BRAT 배포 테스트 (수동 설치 확인)
- [ ] **3-4-4.** CLAUDE.md 업데이트 — Obsidian 플러그인 관련 도구/세션 추가
- [ ] **3-4-5.** AGENTS.md 동기화 업데이트
- [ ] **3-4-6.** Git 태깅 (`v0.1.0-alpha`)

### 3-5. 최종 검증

- [ ] **3-5-1.** `npm test` — 0 failures
- [ ] **3-5-2.** `npm run build` — 0 errors
- [ ] **3-5-3.** Obsidian 플러그인 로드 → 4개 MVP 기능 동작
- [ ] **3-5-4.** 기존 CLI 워크플로우 미영향
- [ ] **3-5-5.** Git 커밋 + 태그

---

## Eng 리뷰 이슈 추적

> prompt_plan.md 12절에서 식별된 이슈. 각 항목이 위 todo에 반영된 위치를 표시.

### HIGH

| # | 이슈 | todo 위치 | 상태 |
|---|------|----------|------|
| H1 | 인제스트 프롬프트 DRY | Step 0-2-4, Step 1-5-3 | [ ] |
| H2 | child_process 셸 주입 방지 (execFile) | Step 1-2-3, Step 1-4-2 | [ ] |
| H3 | qmd DB 동시 접근 WAL 확인 | Step 2-6-7 (CLI 병행 테스트) | [ ] |

### MEDIUM

| # | 이슈 | todo 위치 | 상태 |
|---|------|----------|------|
| M1 | Obsidian Sync API 키 경고 | Step 2-2-3 | [ ] |
| M2 | wiki-ops 경로 검증 | Step 1-3-3 | [ ] |
| M3 | wikey.conf 동시 수정 방지 | Step 2-2-7 | [ ] |
| M4 | cost-tracker.sh fallback | Step 2-5-1, Step 3-3-8 | [ ] |

### LOW

| # | 이슈 | todo 위치 | 상태 |
|---|------|----------|------|
| L1 | 다크/라이트 모드 CSS 변수 | Step 2-3-7 | [ ] |
| L2 | 채팅 히스토리 뷰 분리 | Step 2-1-4, Step 2-3-6 | [ ] |

---

## CEO 리뷰 추가 항목 추적

| 항목 | todo 위치 | 상태 |
|------|----------|------|
| Obsidian URI 프로토콜 | Step 2-4-5 | [ ] |
| 인제스트 진행률 단계 표시 | Step 1-5-2, Step 2-4-3 | [ ] |

---

## 연기 항목 (v2 / Phase 3.5)

| 항목 | 이유 | 비고 |
|------|------|------|
| 드래그앤드롭 inbox | Obsidian 파일 드롭 이벤트 복잡도 | `wikey-obsidian/src/inbox-dropzone.ts` |
| 자동 인제스트 (file watch) | 비용 통제 문제 | fswatch → 자동 LLM 호출 |
| PDF 인제스트 | pdftotext/Gemini native 추가 복잡도 | v2에서 지원 |
| 인라인 린트 | EditorView 데코레이션 | `EditorExtension` |
| 비용 대시보드 | 모달/뷰로 월별 차트 | Chart.js 또는 커스텀 |
| qmd SDK import | better-sqlite3 Electron ABI | wasm 또는 Electron rebuild |
| 웹 인터페이스 (Phase 4) | wikey-core 재사용 | Next.js + wikey-web/ |
| 마켓플레이스 등록 (Phase 4) | 보안 리뷰 통과 필요 | child_process, API 키 |
