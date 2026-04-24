# Phase 3 결과 보고서

> 기간: 2026-04-12 ~ 2026-04-20
> 목표: Obsidian 플러그인 (wikey-core + wikey-obsidian)
> 상태: **완료** — Step 0~6 + A/A-1 + B 자동 E2E + 04-20 세션에서 §B-1/§B-2/§C-1 모두 정리 + §C-2 v7 5/6 (v7-1/2/4/5/6). 잔여 v7-3 (Anthropic contextual chunk retrieval 전처리)만 Phase 4 §4-9 ①로 이관. Phase 3 끝.
> 전제: Phase 2 완료 (필수 7/7, 중요 6/6)
> 인프라: Ollama 0.20.5 + Qwen3 8B + Qwen3.6:35b-a3b + Gemma4 26B, qmd 2.1.0 (vendored), Node.js 22.17.0

## 관련 문서

- **Todo mirror**: [`plan/phase-3-todo.md`](../plan/phase-3-todo.md)
- **Phase 3 보조 문서** (섹션 번호 순):
  - §3.B Obsidian E2E 테스트 플랜: [`plan/phase-3-todox-3.B-obsidian-test.md`](../plan/phase-3-todox-3.B-obsidian-test.md)
  - §3.B Obsidian E2E 테스트 결과: [`activity/phase-3-resultx-3.B-test-results.md`](./phase-3-resultx-3.B-test-results.md)
  - §3.C 인제스트 파이프라인 v6 재설계 플랜: [`plan/phase-3-todox-3.C-ingest-core-rebuild.md`](../plan/phase-3-todox-3.C-ingest-core-rebuild.md)
  - §3.C 결정성 측정 (v6 Greendale): [`activity/phase-3-resultx-3.C-determinism-greendale-2026-04-20.md`](./phase-3-resultx-3.C-determinism-greendale-2026-04-20.md)
  - §3.C 결정성 측정 (v7 PMS post-v7): [`activity/phase-3-resultx-3.C-determinism-pms-post-v7-2026-04-21.md`](./phase-3-resultx-3.C-determinism-pms-post-v7-2026-04-21.md)
  - §3.C 인제스트 v1/v2/v3 비교: [`activity/phase-3-resultx-3.C-ingest-comparison/README.md`](./phase-3-resultx-3.C-ingest-comparison/README.md)
  - Phase 3 기간 중 분석 (2026-04-14): [`activity/graphify-analysis.md`](./graphify-analysis.md)
- **프로젝트 공통**: [`plan/decisions.md`](../plan/decisions.md) · [`plan/plan_wikey-enterprise-kb.md`](../plan/plan_wikey-enterprise-kb.md).

---

---

> 문서 구성: 15개 주제 그룹 × `N / N.M` 계층 번호. 같은 그룹 내 순서는 문서 내 원래 등장 순서 유지 (실질적으로 시간순).

---

## 3.1 개요 및 타임라인
> tag: #docs, #architecture

### 3.1.1 타임라인

| 날짜  | Step       | 주요 작업                                                                                                  |
| ----- | ---------- | ---------------------------------------------------------------------------------------------------------- |
| 04-12 | 3-0        | 모노레포 스캐폴딩 (npm workspaces, wikey-core, wikey-obsidian)                                             |
| 04-12 | 3-1-A      | config.ts — INI 파싱, resolveProvider (17 tests)                                                          |
| 04-12 | 3-1-C      | wiki-ops.ts — createPage, updateIndex, appendLog, extractWikilinks (11 tests)                             |
| 04-12 | 3-1-B      | llm-client.ts — 4개 프로바이더 (Gemini/Anthropic/OpenAI/Ollama) (13 tests)                                |
| 04-12 | 3-1-D      | query-pipeline.ts — qmd exec, 합성 프롬프트 (6 tests)                                                     |
| 04-12 | 3-1-E      | ingest-pipeline.ts — JSON 추출, 프롬프트 DRY, reindex (10 tests)                                          |
| 04-12 | 3-2-A      | main.ts — WikeyPlugin, ObsidianWikiFS, ObsidianHttpClient 어댑터                                          |
| 04-12 | 3-2-B      | settings-tab.ts — BASIC_MODEL, API 키, Ollama 연결, Sync 경고                                             |
| 04-12 | 3-2-C      | sidebar-chat.ts — 채팅 UI, 마크다운 렌더링, 위키링크, CSS                                                 |
| 04-12 | 3-2-D      | commands.ts — Cmd+Shift+I, 파일 선택, URI 프로토콜, 진행률                                                |
| 04-12 | 3-2-E      | status-bar.ts — 페이지 수, 통계 모달                                                                      |
| 04-12 | 3-3        | 디버깅 5건 (CORS, PATH, ABI, qmd 경로, localhost)                                                          |
| 04-12 | 3-3        | 합성 프롬프트 3회 개선 (확정적 답변, 해요체)                                                               |
| 04-12 | 3-3        | env-detect.ts — 로그인 셸 PATH + ABI 호환 node 자동 탐지                                                  |
| 04-12 | 4          | 채팅 UI 고도화 — Q/A 삭제, 질문 블록, purple 테마, 피드백                                                 |
| 04-12 | 5          | 인제스트 패널 — drag/drop, 3버튼, 프로그레스바, inbox 감시                                                |
| 04-12 | 6          | CLI 포팅 — PDF 인제스트, classify, validate/pii/reindex/cost exec                                         |
| 04-13 | Could      | 대화 히스토리 영구 저장 (persistChatHistory 토글, 디바운스 저장)                                           |
| 04-13 | Could      | Sync 보호 + credentials.json 분리 (syncProtection 토글)                                                    |
| 04-13 | Could      | BRAT 배포 인프라 (versions.json, GitHub Actions, v0.1.0-alpha)                                             |
| 04-13 | H3         | qmd busy_timeout=5000 추가 — 동시 접근 안전                                                               |
| 04-13 | M3         | 설정 통합 — wikey.conf 단일 소스 + credentials.json 공유                                                  |
| 04-13 | M3         | Sync 보호 → 설정 통합으로 흡수 (syncProtection 제거, API 키 항상 외부)                                    |
| 04-14 | A          | UI 영문 전환 — dashboard, audit, inbox, settings, help, 프로그레스 메시지 전체                            |
| 04-14 | A          | Dashboard 숫자 통일 — audit 기반 Raw Sources (ingested/total per PARA folder + Delayed)                   |
| 04-14 | A          | Dashboard home 아이콘, PARA별 ingested accent color                                                        |
| 04-14 | A          | Audit 패널 UI 개편 — 상단 좌(stats)+우(status), 하단 provider+model+Ingest/Cancel+Delay                   |
| 04-14 | A          | Audit 모델 드롭다운 — API 동적 로드, provider별 (Local/Gemini/OpenAI Codex/Anthropic Claude)              |
| 04-14 | A          | Audit Cancel 기능 — Ingest→Cancel 전환, 완료 건 유지+진행 중단                                           |
| 04-14 | A          | Audit 행 정보 강화 — 파일 크기, 추천 모델(Local/Cloud), 실시간 시간 카운터, 완료 시 green 유지            |
| 04-14 | A          | Inbox UI 개편 — checkbox + bottom bar (Move+auto-ingest / Delay), 분류 Auto/Project/Area/Resource/Archive |
| 04-14 | A          | Select UI 표준화 — background+border+shadow 통일                                                          |
| 04-14 | A          | 설정 영문 전환 + 용어 통일 (Local/Google Gemini/Anthropic Claude/OpenAI Codex)                             |
| 04-14 | A          | 설정 Ingest Model 섹션 추가 — provider + model 기본값                                                     |
| 04-14 | A          | 설정 환경 상태 — 항목별 설명 추가, Qwen3/MarkItDown 상태 표시, MarkItDown 설치 버튼                       |
| 04-14 | A-1        | 로컬 LLM 커뮤니티 조사 — Gemma4 JSON/think 버그(#15260), Qwen3 한국어 우수                                |
| 04-14 | A-1        | 모델 설치 — qwen3:8b, gemma4:26b, supergemma4:26b(GGUF import+chat template)                              |
| 04-14 | A-1        | 모델 비교 테스트 (TCP/IP PDF) — Qwen3 53s OK, Gemma4 78s OK, SuperGemma4 FAIL(빈 응답)                    |
| 04-14 | A-1        | SuperGemma4 디버그 — chat template 누락 → think:true 필요 → thinking loop(40K chars) → 탈락            |
| 04-14 | A-1        | 모델 정리 — wikey:latest 삭제, gemma4:latest(8B) 삭제, supergemma4 삭제                                   |
| 04-14 | A-1        | Ollama think 파라미터 — Gemma=think:true(빈 응답 방지), Qwen3=think:false(토큰 절감)                      |
| 04-14 | A-1        | jsonMode 옵션 — Qwen3 format:"json", Gemma 프롬프트 기반(#15260 회피)                                     |
| 04-14 | A-1        | LLM 타임아웃 60s → 300s, maxOutputTokens 8K → 65K                                                        |
| 04-14 | A-1        | Gemini 에러 처리 — finishReason:MAX_TOKENS 원인 발견+해결, candidates null 방어                           |
| 04-14 | A-1        | MarkItDown 전처리 — PDF→md 변환 우선(→pdftotext→pymupdf fallback)                                      |
| 04-14 | A-1        | Graphify-style 챕터 분할 — 12K+ 문서는 ## 헤더 기준 분할 → 순차 추출 → 병합                             |
| 04-14 | A-1        | provider별 truncate — Local만 12K 제한, Cloud는 전체 전송                                                 |
| 04-14 | A-1        | LLM 파일명 경로 strip — wiki/entities/x.md 반환 시 자동 정리                                              |
| 04-14 | A-1        | E2E 테스트 (파워디바이스 88KB) — Qwen3 17min 27E+26C, Gemini 10min 46E+170C, Gemma4 32min 5E+3C           |
| 04-14 | A-1        | audit-ingest.py — inbox+_delayed 포함, per-folder breakdown (ingested/total)                              |
| 04-14 | A-1        | Graphify 종합 분석 → activity/graphify-analysis.md                                                        |
| 04-14 | A-1        | Phase 재구성 — Phase 4(인제스트 고도화+지식그래프), Phase 5(웹환경, 기존 4)                               |
| 04-18 | B 사전     | markitdown-ocr fallback 추가 (extractPdfText 5단계, Ollama gemma4:26b vision via OpenAI 호환)              |
| 04-18 | B E2E      | 9 시나리오 자동 실행 (obsidian-cli + Notice MutationObserver) — 6 PASS / 2 PARTIAL / 1 FAIL               |
| 04-18 | B 후속     | 이슈 4건 수정 + 회귀 검증 — race condition / silent partial / Ollama 404 / Settings UI race               |
| 04-18 | B 후속     | log.md 헤더 형식 수정 (`## [YYYY-MM-DD] ingest \| <filename>`)                                            |
| 04-18 | B 리팩토링 | 단일 프롬프트 모델 —`loadEffectiveIngestPrompt`, 모달 [Edit]/[Reset], `.wikey/ingest_prompt.md`       |
| 04-18 | B UI       | 사이드바 헤더 탭 순서 변경 (dashboard → ingest → audit → help), 대시보드 hint eye SVG 통일              |

---

### 3.1.2 다음 세션 작업

- [ ] Audit 인제스트 세부 테스트 (다양한 PDF, 에러 케이스)
- [ ] 인제스트 품질 검증 (wiki 페이지 내용 리뷰)
- [ ] Obsidian UI 수동 테스트

---

### 3.1.3 Phase 재구성

| Phase                | 범위                                          | 상태             |
| -------------------- | --------------------------------------------- | ---------------- |
| 3                    | Obsidian 플러그인 + 인제스트 기본             | 진행 중 (B 잔여) |
| **4 (신규)**   | 인제스트 고도화 + 지식 그래프 (Graphify 수용) | 계획             |
| **5 (기존 4)** | 웹 환경 구축                                  | 이동             |

### 3.1.4 세션 목표와 흐름

Phase 3 B-1 #2(인제스트 품질 검증) 수행 → Ingest 패널 CDP E2E 중 404 발견 → 근본 원인 5건 연쇄 추적 수정 → UI 전면 재설계 → Dewey Decimal 분류 체계 도입 → 설정 UI 폴리싱 → 전 파이프라인 모델 리터럴 하드코딩 제거.

### 3.1.5 v6 인제스트 코어 재설계 (2026-04-19 저녁 세션)

> **참조**: 정량 비교 데이터·v1~v6 진동·결정성 통계·6회 실행 결과 → [`activity/phase-3-resultx-3.C-ingest-comparison/README.md`](./phase-3-resultx-3.C-ingest-comparison/README.md)

> **참조**: Plan 본체·Phase 분해·위험 분석·검증 기준 → [`plan/phase-3-todox-3.C-ingest-core-rebuild.md`](../plan/phase-3-todox-3.C-ingest-core-rebuild.md)

### 3.1.6 배경

PMS PDF(28,993자) 동일 입력 6회 인제스트에서 결과가 581 → 35 → 96 → 71 → 39 → 102 → 52로 진동. **결정성 부재가 솔루션의 치명적 결함**으로 식별. Codex 진단 + GraphRAG/LightRAG/LlamaIndex/Notion AI/Confluence 커뮤니티 패턴 종합:

> `callLLMForExtraction()`이 chunk-local LLM에서 "분류 + 페이지 초안"을 동시 생성. 후처리 dedup은 파일명 정규화만 하고 의미 통합 못 함. 차단 메시지를 강화하면 LLM은 entity ↔ concept ↔ 한국어 라벨 사이를 회피 이동.

### 3.1.7 2026-04-20 잔여 정리 세션 개요

> 8개 commit (`f35d3b1` ~ `61c7830`), 143 → **159 tests** pass (+16), 모든 위키 검증 PASS.
> 세션 목표: 13.9에 기록된 잔여(B-1, B-2, C-1, C-2 v7) 우선순위대로 정리.

### 3.1.8 이번 세션 commit 요약

| Commit      | 영역              | 내용                                                          |
| ----------- | ----------------- | ------------------------------------------------------------- |
| `f35d3b1` | feat(ingest)      | tier 6 page-render Vision OCR + OMRON 48p E2E                 |
| `3e472fb` | fix(obsidian)     | WikiFS hidden folder support + ingest_prompt.md override 검증 |
| `0fa0a19` | feat(ingest)      | assertNotWikiPath guard — wiki/ self-cycle 차단              |
| `2e47c3b` | docs(determinism) | Greendale 5회 측정 (CV 측정)                                  |
| `a739a20` | chore(wiki)       | log.md cosmetic + lint                                        |
| `b95b2aa` | feat(scripts)     | measure-determinism.sh 자동화                                 |
| `8add8c4` | feat(llm)         | Gemini model list filter+sort                                 |
| `61c7830` | feat(schema)      | v7-1 decision tree + v7-2 anti-pattern                        |

---

## 3.2 wikey-core 코어 구현
> tag: #core, #framework

### 3.2.1 프로젝트 스캐폴딩

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

| 항목             | 결정                  | 이유                                                   |
| ---------------- | --------------------- | ------------------------------------------------------ |
| 모노레포 도구    | npm workspaces        | pnpm/turborepo는 오버킬 (2 패키지)                     |
| 번들러           | esbuild               | Obsidian 커뮤니티 플러그인 표준                        |
| TS target        | ES2022                | Electron 기반, top-level await 등 지원                 |
| moduleResolution | bundler               | esbuild 호환 최적                                      |
| wikey-core 참조  | `"wikey-core": "*"` | npm workspaces 자동 해석 (`workspace:*`는 pnpm 전용) |

**빌드 검증:**

| 항목                                 | 결과                                                |
| ------------------------------------ | --------------------------------------------------- |
| `npm install`                      | 67 packages, 0 vulnerabilities                      |
| `npm run build:core` (tsc)         | 0 errors, dist/ 15개 파일 생성                      |
| `npm run build:obsidian` (esbuild) | main.js 627 bytes                                   |
| `npm run build` (전체)             | 0 errors                                            |
| Obsidian 심볼릭 링크                 | main.js, manifest.json, styles.css 3개 연결         |
| 기존 CLI 스크립트                    | llm-ingest.sh, wikey-query.sh, llm-api.sh syntax OK |

---

### 3.2.2 config.ts

**포팅 원본:** `local-llm/wikey.conf` + `scripts/lib/llm-api.sh`의 `_llm_load_config()`, `resolve_provider()`

**구현 내용:**

| 함수                                 | 역할                                                          |
| ------------------------------------ | ------------------------------------------------------------- |
| `parseWikeyConf(content)`          | INI 파싱 (key=value, # 주석, 인라인 주석 제거, 공백 트림)     |
| `loadConfig(projectDir)`           | .env + wikey.conf + 환경변수 우선순위 (MVP: 기본값 반환)      |
| `resolveProvider(process, config)` | 프로세스별 프로바이더 분기 (ingest/lint/summarize/cr/default) |

**resolveProvider 분기 로직 (bash 1:1 포팅):**

| 프로세스  | 결정 규칙                                             |
| --------- | ----------------------------------------------------- |
| ingest    | INGEST_PROVIDER ∥ WIKEY_BASIC_MODEL ∥ 'claude-code' |
| lint      | LINT_PROVIDER ∥ WIKEY_BASIC_MODEL ∥ 'claude-code'   |
| summarize | SUMMARIZE_PROVIDER ∥ WIKEY_BASIC_MODEL ∥ 'gemini'   |
| cr        | CONTEXTUAL_MODEL ∥ 'ollama' (항상 ollama)            |
| default   | WIKEY_BASIC_MODEL ∥ 'claude-code'                    |

**claude-code 해석:** ANTHROPIC_API_KEY 있으면 → anthropic, 없으면 → ollama 폴백 (bash 동일)

**테스트 (17건):** INI 파싱 7건, resolveProvider 10건 — 전부 통과

---

### 3.2.3 wiki-ops.ts

**포팅 원본:** `scripts/llm-ingest.sh`의 `apply_ingest_result()` 파일 생성 로직

**구현 내용:**

| 함수                               | 역할                                                          |
| ---------------------------------- | ------------------------------------------------------------- |
| `createPage(wikiFS, page)`       | wiki/{category}/{filename} 경로에 페이지 생성. 경로 검증 [M2] |
| `updateIndex(wikiFS, additions)` | index.md에 새 항목 추가 (중복 방지)                           |
| `appendLog(wikiFS, entry)`       | log.md 헤더 바로 뒤에 날짜별 항목 삽입                        |
| `extractWikilinks(content)`      | `[[page-name]]` 패턴 추출 (중복 제거, display text 지원)    |

**보안 (M2):** `buildPath()`에서 `..`와 `/`가 포함된 filename 거부 → 디렉토리 트래버설 차단

**테스트 (11건):** createPage 4건, updateIndex 2건, appendLog 1건, extractWikilinks 4건 — 전부 통과

---

### 3.2.4 llm-client.ts

**포팅 원본:** `scripts/lib/llm-api.sh`의 4개 프로바이더 함수

**구현 내용:**

| 프로바이더 | API URL                                                                     | 인증                      | 응답 파싱                                |
| ---------- | --------------------------------------------------------------------------- | ------------------------- | ---------------------------------------- |
| Gemini     | `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | `?key=` 쿼리            | `candidates[0].content.parts[0].text`  |
| Anthropic  | `api.anthropic.com/v1/messages`                                           | `x-api-key` 헤더        | `content[0].text`                      |
| OpenAI     | `api.openai.com/v1/chat/completions`                                      | `Authorization: Bearer` | `choices[0].message.content`           |
| Ollama     | `{OLLAMA_URL}/api/chat`                                                   | 없음                      | `message.content` (thinking 블록 제거) |

**핵심 설계:**

- `HttpClient` 인터페이스 주입 → Obsidian `requestUrl()` vs `fetch()` 교체 가능
- API 키 누락 시 명확한 에러 메시지 (설정 안내)
- Gemma 4 thinking 블록 제거: "done thinking" 마커 이후만 반환
- `responseMimeType` 지원 (Gemini 구조화 출력)

**테스트 (13건):** Gemini 3건, Anthropic 3건, OpenAI 3건, Ollama 4건 — 전부 통과

---

### 3.2.5 query-pipeline.ts

**포팅 원본:** `local-llm/wikey-query.sh` 전체

**구현 내용:**

| 함수                                        | 역할                                                   |
| ------------------------------------------- | ------------------------------------------------------ |
| `query(question, config, httpClient)`     | 전체 파이프라인: qmd 검색 → 컨텍스트 구성 → LLM 합성 |
| `parseQmdOutput(stdout)`                  | qmd JSON 출력 파싱, URI→경로 변환                     |
| `buildSynthesisPrompt(context, question)` | wikey-query.sh 합성 프롬프트 1:1 이식                  |

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

### 3.2.6 ingest-pipeline.ts

**포팅 원본:** `scripts/llm-ingest.sh` 전체

**구현 내용:**

| 함수                                                               | 역할                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------- |
| `ingest(sourcePath, wikiFS, config, httpClient, onProgress?)`    | 전체 파이프라인: 읽기 → LLM → JSON → wiki-ops              |
| `extractJsonBlock(text)`                                         | LLM 응답에서 JSON 추출 (```json 블록 → bare JSON 순서)       |
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

---

## 3.3 Obsidian 플러그인 MVP
> tag: #main-feature, #design

### 3.3.1 main.ts + 어댑터

| 구현                                         | 역할                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------- |
| `WikeyPlugin extends Plugin`               | onload: 리본 아이콘, 커맨드, 설정 탭, 채팅 뷰, 상태 바 등록             |
| `ObsidianWikiFS implements WikiFS`         | Vault API 래핑 (read/write/exists/list, 자동 디렉토리 생성)             |
| `ObsidianHttpClient implements HttpClient` | `requestUrl()` 래핑 (CORS 우회)                                       |
| `WikeySettings`                            | data.json 기반 설정 (basicModel, API 키, ollamaUrl, qmdPath, costLimit) |
| `buildConfig()`                            | 설정 → WikeyConfig 변환                                                |
| `activateChatView()`                       | 채팅 사이드바 열기 (기존 뷰 재활용)                                     |

### 3.3.2 settings-tab.ts

| 항목               | 구현                                                  |
| ------------------ | ----------------------------------------------------- |
| 기본 모델 드롭다운 | ollama / gemini / anthropic / openai / claude-code    |
| Ollama URL         | 텍스트 입력 (기본: http://localhost:11434)            |
| 연결 테스트 버튼   | `/api/tags` 호출 → 모델 수 표시 / 실패 안내        |
| API 키 입력        | Gemini, Anthropic, OpenAI 각각 (password 마스킹)      |
| Sync 경고 [M1]     | ⚠️ "Obsidian Sync 사용 시 API 키 동기화됩니다" 문구 |
| qmd 경로           | 자동 탐지 + 수동 입력                                 |
| 비용 한도          | 숫자 입력 (기본: $50)                                 |

### 3.3.3 sidebar-chat.ts — MVP 핵심

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

| 기능            | 구현                                                               |
| --------------- | ------------------------------------------------------------------ |
| 채팅 UI         | ItemView 기반 사이드바, 메시지 목록 + textarea 입력                |
| 쿼리 실행       | Enter 키 →`query()` 호출 → 마크다운 답변 표시                  |
| 마크다운 렌더링 | `MarkdownRenderer.render()` — 코드블록, 테이블, 리스트 지원     |
| 위키링크        | `[[page]]` → 클릭 가능한 링크, `app.workspace.openLinkText()` |
| 세션 대화 유지  | chatHistory를 플러그인 인스턴스에 저장 (뷰 재생성 시 복원)         |
| 로딩            | 스피너 애니메이션 + "답변을 생성하고 있습니다..."                  |
| 에러 처리       | API 키 누락, qmd 없음, 네트워크 오류별 안내 메시지                 |
| 스타일링        | Obsidian CSS 변수 사용 (다크/라이트 모드 자동 대응) [L1]           |

### 3.3.4 commands.ts

| 기능                | 구현                                                                 |
| ------------------- | -------------------------------------------------------------------- |
| Cmd+Shift+I         | 현재 열린 노트 인제스트 (raw/ 외부 시 경고)                          |
| "Ingest file..."    | FuzzySuggestModal — wiki/ 제외한 마크다운 파일 선택                 |
| 진행률 Notice [CEO] | "1/4 소스 읽기..." → "2/4 LLM 호출..." → ...                       |
| 완료 Notice         | "인제스트 완료: 3개 페이지 — [[esc]], [[pid-loop]], [[source-esc]]" |
| URI 프로토콜 [CEO]  | `obsidian://wikey?query=ESC` → 사이드바 열기 + 자동 쿼리          |
|                     | `obsidian://wikey?ingest=path/to/file.md` → 인제스트 실행         |

### 3.3.5 status-bar.ts

| 기능                       | 구현                                                               |
| -------------------------- | ------------------------------------------------------------------ |
| 상태 바                    | "📚 29 pages" (wiki/ 내 .md 재귀 카운트)                           |
| 갱신 주기                  | 5분마다 자동 갱신                                                  |
| 클릭                       | 상세 통계 모달 (entities/concepts/sources/analyses/meta 각각 표시) |
| cost-tracker fallback [M4] | 비용 표시 미구현 (cost-tracker.sh 미존재 시 페이지 수만 표시)      |

---

---

## 3.4 UI/UX 고도화
> tag: #design, #workflow

### 3.4.1 UI 고도화

- Q/A 아이콘 삭제 → 질문=배경 블록(radius 8), 답변=전체 너비
- 좌우 여백 0 (헤더~입력 전체)
- 헤더 5개 plain icon: [+][?][🗑][↻][✕], hover=purple, active=purple bg+white
- 입력창 x1.5 + 전송 plain icon 중앙 + 모델 태그(purple, 0.92em)
- 답변 하단: 복사/좋아요/나빠요 (피드백 data.json 저장)
- 테이블: 세로선 없음, 가로선 1px, 상하단 2px
- 도움말 [?] 인라인 + scrollIntoView
- Purple accent 테마 통일

---

### 3.4.2 인제스트 UI

- [+] → 인제스트 패널 (상단 토글)
- 3개 액션 버튼: Add to inbox / Ingest inbox / Add+Ingest
- 네이티브 파일 탐색기 (input type=file), drag/drop
- 파일별 프로그레스바 (2px) + 결과 wikilink
- inbox→_processed/ 자동 이동
- inbox 감시 (vault.on('create') + Notice)

---

### 3.4.3 UI 영문 전환 + 표준화

모든 시스템 인터페이스를 English로 전환:

- sidebar-chat.ts: 헤더 tooltip, welcome, help, loading, error, 피드백, 진행 메시지
- settings-tab.ts: 섹션명, 설명, 버튼 텍스트, Notice 메시지
- ingest-pipeline.ts: onProgress 메시지 (Reading source, Calling LLM, Creating pages, Indexing)

Provider 명칭 통일:

- `Local (Ollama)` / `Google Gemini` / `Anthropic Claude` / `OpenAI Codex`

### 3.4.4 Dashboard 숫자 통일

**문제:** Raw Sources "Total 10" vs Undigested "Ingested 6" — 카운팅 방법 불일치 (top-level vs recursive)

**해결:**

- audit-ingest.py에 inbox + _delayed 추가, per-folder breakdown 출력
- Dashboard Raw Sources를 audit 데이터 단일 소스로 통합
- Row 1: Total Files / Ingested (accent) / Missing
- Row 2: PARA별 `ingested / total` (Inbox, Projects, Areas, Resources, Archive, Delayed)
- Undigested Documents 섹션 제거 (Raw Sources에 병합)

검산: `0+1+1+4+0 = 6 = Ingested`, `3+0+0+129+25 = 157 = Missing` ✓

### 3.4.5 Audit 패널 UI 개편

**Before:** 하단에 `N개 선택됨 + provider select + 적용 + 보류`
**After:**

- 상단: 좌측 stats (Total/Ingested/Missing) + **우측 status** (2 selected / 1/2 processing)
- 하단: **Provider** + **Model** (API 동적 로드) + **Ingest/Cancel** + **Delay**
- 행 정보: 파일명 + **파일크기(우)** + 폴더경로(전체) + **추천모델(우)** + **시간 카운터**
- Cancel: Ingest→빨간 Cancel 전환, 완료 건 유지 + 진행 중단
- 완료 행: 제거하지 않고 **파일명 green** 전환 + 소요 시간 표시
- 추천 모델: ≤1MB → Local, >1MB → Cloud (purple)

### 3.4.6 Inbox UI 개편

**Before:** 파일별 select + 이동 버튼
**After:**

- 제목: `inbox | N` (숫자 16px bold white)
- 행: checkbox + 파일명 + classify hint
- 하단: `N selected` + classify select (Auto/Project/Area/Resource/Archive) + **Move** + **Delay**
- Move 시 자동 ingest (audit 동일 progress bar)

### 3.4.7 설정 탭 정리

- 섹션 구조: Environment → Default Model → **Ingest Model (신규)** → General → API Keys → Search → Cost → Wiki Tools → Advanced
- 환경 상태: 항목별 **용도 설명** 추가 (deep gray)
- Qwen3 / Gemma4 / MarkItDown 개별 상태 표시
- MarkItDown 미설치 시 **Install** 버튼 (pip3 install markitdown[pdf] 자동 실행)
- Advanced: ingestProvider 제거 (별도 섹션으로 이동), lint/summarize만 유지

### 3.4.8 Ingest 패널 UI 재설계 — Before vs After

**Before**

```
[Add to inbox] [Ingest inbox] [Add + Ingest]   ← bulk 3버튼
📥 Drag files here [Browse]                    ← drop zone
Pending (N)                                    ← pending list
inbox | N
  ☐ file1 │ PDF 문서
  ☐ file2 │ PDF 문서
0 selected  [Auto▾] [Move] [Delay]             ← Move만 (분류 전용)
```

**After**

```
Insert file to inbox               [Add]       ← 헤더 + Add 버튼
📥 Drag files here [Browse]                    ← drop zone
Pending (N)                                    ← pending list, [Add] 누르면 inbox 복사
inbox | N
  ☐ file1 │ 6.3MB │ Cloud                      ← filesize + Cloud/Local
  ☐ file2 │ 502KB │ Local
0 selected  [Auto▾] [Ingest] [Delay]           ← Move → Ingest (분류+인제스트 통합)
```

**주요 변화**:

- 상단 bulk 3버튼 완전 제거 (사용자 관점: "inbox는 자동 관문, bulk 액션 불필요")
- drop zone에 명확한 제목 `Insert file to inbox` + 우측 `[Add]` 버튼 (pending → inbox 이행)
- inbox 각 행에 filesize + Cloud/Local 뱃지 (Audit 패널 패턴 복제). 1MB 초과 → Cloud 권장
- 하단 [Ingest] 버튼: classify select('auto')로 PARA 자동 분류 + 인제스트 통합 실행

### 3.4.9 자동 Ingest 도입

**설정**:

- `autoIngest: boolean` (기본 off)
- `autoIngestInterval: 0 | 10 | 30 | 60` 초 (기본 30)
  - 0: Immediately
  - 10/30/60: debounce window

**동작**:

- `vault.on('create')` 이벤트에서 `raw/0_inbox/` 새 파일 감지
- 자동 queue에 path 추가 → debounce 후 `flushAutoIngestQueue` 호출
- 각 파일에 대해 `runIngest(plugin, relPath)` 순차 실행
- 완료 시 `Auto-ingest 완료: N 성공 / M 실패` Notice

### 3.4.10 UI 변경 9건

1. Modal close 차단 (backdrop + ESC) + Processing 단계 [X] confirm 다이얼로그
2. Modal resize 핸들 7→11px (1.5배) + 315deg + 코너 안착 (modalEl 직접 부착)
3. Modal 하단 button-row sticky (콘텐츠 길이 무관 항상 하단)
4. Audit panel [Ingest][Delay] 우측 정렬 + provider/model 하단 고정
5. Ingest panel bottom bar 고정 (audit과 동일, gap 10px) — `.wikey-ingest-progress:empty {display:none}` 추가
6. Brief 모달 schema preview 라인
7. NFC/NFD 한글 검색 fix (audit 패널)
8. Plugin 아이콘 search → book → book-open
9. Modal stripBrokenWikilinks tidy 강화 (multiple commas → 단일)

---

## 3.5 인제스트 파이프라인 v1~v6 + 3-stage 재설계
> tag: #core, #workflow

### 3.5.1 인제스트 파이프라인 개선

**발견된 문제들:**

1. LLM 타임아웃 60s → 로컬 모델 인제스트에 부족
2. Gemini finishReason:MAX_TOKENS → maxOutputTokens 8K 부족
3. PDF 원문 254KB → 로컬 모델 컨텍스트 초과
4. Gemma4 JSON 스키마 불일치 (source_page 대신 다른 키)
5. LLM이 파일명에 경로 포함 (wiki/entities/x.md)

**해결:**

| 문제            | 해결                                                     | 코드                               |
| --------------- | -------------------------------------------------------- | ---------------------------------- |
| 타임아웃        | 60s → 300s                                              | llm-client.ts DEFAULT_TIMEOUT      |
| 출력 토큰       | 8K → 65K                                                | llm-client.ts DEFAULT_MAX_TOKENS   |
| PDF 전처리      | MarkItDown 우선 (→pdftotext→pymupdf fallback)          | ingest-pipeline.ts extractPdfText  |
| 대용량 분할     | 12K+ 문서 → ## 헤더 기준 챕터 분할 → 순차 추출 → 병합 | ingest-pipeline.ts splitIntoChunks |
| provider별 제한 | Local만 12K truncate, Cloud는 전체 전송                  | ingest-pipeline.ts ingest()        |
| 파일명 경로     | 자동 strip (wiki/entities/x.md → x.md)                  | wiki-ops.ts buildPath              |
| Gemini 에러     | candidates null 방어 + finishReason 상세 메시지          | llm-client.ts callGemini           |
| think 제어      | Gemma=think:true, Qwen3=think:false                      | llm-client.ts callOllama           |
| jsonMode        | Qwen3 format:"json", Gemma 프롬프트 기반                 | llm-client.ts callOllama           |

**Graphify-style 2단계 파이프라인:**

- 소문서 (≤12K): 기존 1회 호출
- 대문서 (>12K): Step A(요약→source_page) + Step B(챕터별→entities/concepts) + Step C(중복 제거 병합)

### 3.5.2 Graphify 분석

Graphify (safishamsi/graphify) 아키텍처 분석 → `activity/graphify-analysis.md` 저장.

**Wikey Phase 4에 수용 결정된 항목:**

- 지식 그래프 (NetworkX + vis.js)
- 증분 업데이트 (SHA256 해시 기반 delta)
- Provenance tracking (EXTRACTED/INFERRED/AMBIGUOUS)
- 추출 기준 명확화 (모델 간 결과 일관성)

### 3.5.3 새 아키텍처 (3-Stage Pipeline + Schema-Guided)

```
Stage 1: chunk LLM = Mention Extractor (분류 X, 페이지 X)
   출력: [{ name, type_hint, evidence }]

Stage 2: 문서-전역 Canonicalizer (단일 LLM 호출)
   - Schema-guided: 4 entity (organization·person·product·tool)
                    + 3 concept (standard·methodology·document_type)
   - Cross-pool dedup: 약어↔풀네임/기존 페이지 재사용 일괄 결정
   - Strict mode: schema 위반은 dropped

Stage 3: 코드 결정적 페이지 작성 + index/log
   - written 페이지 = Stage 2 결정 그대로
   - updateIndex/appendLog는 writtenPages 기반 deterministic backfill
   - LLM 의존 0 (orphan/누락 구조적 차단)
```

### 3.5.4 구현 (Phase A+B+C+D + C-boost)

**신규 파일**:

- `wikey-core/src/schema.ts` — ENTITY_TYPES (4) + CONCEPT_TYPES (3) + validateMention + detectAntiPattern + buildSchemaPromptBlock
- `wikey-core/src/canonicalizer.ts` — canonicalize() 단일 LLM 호출, schema 검증, cross-pool dedup, page assembly
- `wikey-core/src/__tests__/schema.test.ts` — 20 케이스
- `wikey-core/src/__tests__/canonicalizer.test.ts` — 12 케이스

**수정 파일**:

- `wikey-core/src/types.ts` — WikiPage entityType/conceptType, Mention, CanonicalizedResult, LLMCallOptions.seed
- `wikey-core/src/llm-client.ts` — Gemini generationConfig.seed 전달
- `wikey-core/src/wiki-ops.ts` — updateIndex/appendLog에 writtenPages 옵션, normalizeBase + extractFirstSentence 이동, stripBrokenWikilinks 신규
- `wikey-core/src/ingest-pipeline.ts` — 3-stage 흐름 (extractMentions + canonicalize), dedupAcronymsCrossPool/autoFillIndexAdditions 호출 제거
- `wikey-obsidian/src/ingest-modals.ts` — Brief 모달 schema preview 라인, processing 단계 [X] confirm
- `wikey-obsidian/src/commands.ts` — autoMoveFromInbox 옵션 + classifyFileAsync + moveFile 통합
- `wikey-obsidian/src/sidebar-chat.ts` — audit applyBtn에 autoMoveFromInbox:true 전달, NFC/NFD 정규화 (한글 검색 fix), book-open 아이콘
- `wikey-obsidian/src/main.ts` — book-open 리본 아이콘
- `wikey-obsidian/styles.css` — modal resize handle 11px @ 315deg 코너 안착, ingest panel `.wikey-ingest-progress:empty {display:none}` 등 다수 수정

### 3.5.5 v6.1 실험 (롤백)

`temperature=0 + seed=42` (Gemini) — Total CV 16.9% → 20.9% **악화**. Entities CV 14.7% → 36.3% 크게 악화. Concepts CV는 개선 (33.4% → 15.5%) trade-off만. Gemini seed "best-effort" 한계 명시 사실 확인. 호출자에서 temperature/seed 제거. `LLMCallOptions.seed` 필드 + llm-client 전달 로직은 v7 재실험 옵션으로 유지.

`gemini-3.1-pro-preview` 1회 시험: total=24, e=16, c=7, 220s — Concept을 매우 보수적으로 분류. v7 옵션으로 노출 가치 있음.

### 3.5.6 audit panel auto-move PARA

이전 디자인: "ingest 후 raw 파일은 inbox에 잔류, 사용자가 수동 PARA 이동" (혼동 유발)
신규 디자인: audit ingest 후 raw/0_inbox/ 파일은 `classifyFileAsync` (CLASSIFY.md + LLM fallback)로 PARA 자동 라우팅 + `moveFile` + `updateIngestMapPath` 자동 호출.

inbox panel "auto" 옵션은 기존 동작 유지 (plan phase classify + moveBtn explicit move) — 사용자가 plan 미리 보고 일괄 실행하는 inbox 워크플로우 보존.

PMS 원본 PDF는 수동 이동 완료: `raw/0_inbox/PMS_제품소개_R10_20220815.pdf` → `raw/3_resources/30_manual/`. 백링크 점검 결과 모든 wiki 참조가 파일명 기반 wikilink (위치 무관) → **무결**.

### 3.5.7 wiki/ self-cycle 가드 (commit `0fa0a19`)

**리스크 분석**

- `ingest()` 진입점이 `sourcePath`에 검증 없음.
- `IngestFileSuggestModal`은 `wiki/` 필터링이지만 다음 경로는 무방비:
  1. `Cmd+Shift+I` (current note 인제스트) — 사용자가 wiki/ 페이지 열고 단축키 누르면 자기 자신을 source로 entities/concepts 생성 → 무한 사이클
  2. URI handler `obsidian://wikey?ingest=wiki/...`
  3. 외부 플러그인의 직접 호출

**구현 (`wikey-core/src/ingest-pipeline.ts`)**

```typescript
export function assertNotWikiPath(sourcePath: string, caller: string): void {
  const norm = sourcePath.replace(/^\.?\//, '').replace(/^\/+/, '')
  if (norm === 'wiki' || norm.startsWith('wiki/')) {
    throw new Error(
      `${caller}: cannot ingest from wiki/ (would create self-cycle). ` +
      `Move the source out of wiki/ first or pass a raw/* path. Got: ${sourcePath}`
    )
  }
}
```

`ingest()` + `generateBrief()` 진입점에서 호출. 정규화 처리: `wiki/`, `./wiki/`, `/wiki/`, `wiki` (root) 모두 reject. `raw/wiki-archive/`, `raw/3_resources/wikipedia.md` 등 substring 매치는 통과.

**테스트**: 7건 추가 (bare path / dot-prefix / slash-prefix / root / raw allowed / substring allowed / error 메시지 포함).

---

## 3.6 스키마 안정화 + 결정성 측정 (v7 시리즈)
> tag: #framework, #eval

### 3.6.1 v6 결정성 다른 입력 측정 (commit `2e47c3b`)

**소스**: `Greendale Industrial Solutions — 2026 Annual Report Excerpt` (1.6KB 영어 가공 분석 장비 회사 가상)

**5-run 결과**

| Run | Entities | Concepts | Total | Time(s) |
| --- | -------: | -------: | ----: | ------: |
| 1   |       11 |        9 |    21 |   105.1 |
| 2   |       11 |        8 |    20 |   105.1 |
| 3   |        9 |        5 |    15 |   118.6 |
| 4   |       11 |        8 |    20 |    96.1 |
| 5   |       11 |        9 |    21 |   125.1 |

**통계 vs PMS v6**

| 지표        |       Greendale | PMS v6 | 변화 |
| ----------- | --------------: | -----: | ---: |
| Entities CV |  **8.4%** |  14.7% | -43% |
| Concepts CV | **21.1%** |  33.4% | -37% |
| Total CV    | **12.9%** |  16.9% | -24% |

**Core ratio**: Entities 9/11 (82%) · Concepts 5/9 (56%). 변동의 주체는 concept 분류 boundary (active-pharmaceutical-ingredient, atex-zone-1, good-manufacturing-practice, nist-srm-1003가 sometimes 등장).

→ 작은 입력일수록 안정적 (chunk 분할 변동 없음).
→ Concepts 변동은 **v7-1 schema decision tree로 개선 후보** (이번 세션에 구현 — 14.10).

상세: `activity/phase-3-resultx-3.C-determinism-greendale-2026-04-20.md`

### 3.6.2 v7-4 자동 결정성 측정 스크립트 (commit `b95b2aa`)

`scripts/measure-determinism.sh <source-path> [-n N] [-o output.md]` 신규 (351 lines).

**아키텍처**

- 헤더: source-path 검증 (wiki/ 가드 우회), CDP 연결 확인 (`curl http://localhost:9222/json`)
- 본문: 매개변수화된 JS 템플릿을 `sed`로 주입, `/tmp/wikey-cdp.py`를 통해 실행
- N회 루프 마다:
  1. cleanupForRerun: source/entities/concepts 페이지 삭제 (content + filename fuzzy match), ingest-map 정리, log.md 정규식 제거, 인제스트 후 PARA 위치에서 raw/ 위치로 자동 복원
  2. audit panel close+open 으로 데이터 새로고침 (5회 retry로 race condition 처리)
  3. 타깃 행 체크 + Ingest 클릭 + apply 버튼이 "Ingest"로 복원될 때까지 대기 (타임아웃 10분)
  4. 결과 파일 카운트
- 통계: Mean/Std/CV/Range 계산 + Core/Variable 분리
- 출력: 콘솔 + `activity/determinism-<slug>-<date>.md` (Markdown 표)

**Smoke test**: 3-run with Quanta Robotics 가짜 소스 → Entities CV 8.7% / Concepts CV 0% / Total CV 6.0% (Greendale 결과 재현). 정상 동작 확인 후 테스트 아티팩트 정리.

**향후**: v7-1+v7-2 schema 변경 효과 검증 시 `./scripts/measure-determinism.sh raw/0_inbox/<source> -n 5` 한 줄로 비교 가능.

### 3.6.3 v7-6 Pro 모델 dropdown 가시성 (commit `8add8c4`)

**발견**

- `fetchModelList`는 이미 모든 Gemini 모델 동적 로드 → Pro 모델도 dropdown에 있었음.
- 그러나 비텍스트 변종(tts, image, video, customtools, native-audio, computer-use, robotics)도 함께 노출되어 Pro 모델 식별 어려움 (총 20개).

**Fix (`wikey-core/src/llm-client.ts`)**

```typescript
.filter((n: string) => !(
  /-(?:tts|customtools|image|video|embedding|robotics)(?:-|$)/.test(n)
  || /-native-audio-/.test(n)
  || /-computer-use-/.test(n)
))
.sort((a, b) => sortGeminiModelsRecommended(a, b))
```

**`sortGeminiModelsRecommended` (신규 export)** — 추천 family 우선:

1. `gemini-2.5-flash` (recommended ingest default)
2. `gemini-2.5-flash-*` family
3. `gemini-2.5-pro`
4. `gemini-2.5-pro-*` family
5. `gemini-3.x-flash-*`
6. `gemini-3.x-pro-*`
7. legacy/specialized

**E2E 결과**: 13개 모델 (필터 전 20개), Pro 위치 4 (`gemini-2.5-pro`) / 7 (`gemini-3-pro-preview`) / 8 (`gemini-3.1-pro-preview`).

**테스트**: 5건 추가 (filter 정규식 + 정렬 동작 검증).

### 3.6.4 v7-1 + v7-2 schema 강화 (commit `61c7830`)

**v7-1 — Concept 분류 결정 트리**

`CONCEPT_TYPE_DESCRIPTIONS` 강화:

```typescript
// 기존: 한 줄 설명 + 예시 1~3개
// 신규: "판단 기준" + 예시 4~5개 + 표준화 기관/약어/양식/절차 구분 명시
standard:
  '공식 발행되거나 산업 합의된 명명된 규격·프레임워크·프로토콜 ' +
  '(예: pmbok, work-breakdown-structure, gantt-chart, iso-13320, ' +
  'fda-21-cfr-part-11, hart-7, atex-zone-1). ' +
  '판단 기준: 표준화 기관 또는 약어로 식별되며, 다수 조직이 공유하는 정의가 있다.',
```

신규 `CONCEPT_DECISION_TREE` export — 4단계 트리:

1. 표준화 기관/약어 명시 → `standard`
2. 발행 가능 양식 → `document_type`
3. 절차/기법 → `methodology`
4. 모호 → drop

`buildSchemaPromptBlock`에 트리 자동 주입 → canonicalizer 프롬프트에서 LLM이 분류 결정 시 참조.

**v7-2 — 추가 anti-pattern**

- **OPERATIONAL_ITEMS** 8개 추가: workhours, employeerole, departmentcode, productcategory, paymentterm, shipmentstatus, returnpolicy, warrantyperiod
- **UI element suffix** 신규 차단: `*-button/-menu/-tab/-page/-screen/-dialog/-modal/-section/-panel/-widget/-icon`
- **DB column suffix** 신규 차단: `*-id/-code/-number/-key/-flag/-status/-count/-amount/-total` (3-hyphen 이내만 — 긴 자연어는 통과 예: `international-securities-identification-number`)

**테스트**: 4건 추가 (operational variants / UI suffixes / DB suffixes / long-name 예외).

**검증 권장 (다음 세션)**: `./scripts/measure-determinism.sh raw/0_inbox/<source> -n 5` 로 동일 입력 5-run 비교 → Concepts CV가 Greendale 21.1% → ~15% 도달하는지 정량 측정.

### 3.6.5 v7-5 schema yaml 사용자 override (2026-04-20 완료)

**목표**: 빌트인 4 entity + 3 concept 타입 외에 사용자가 도메인별 타입을 `.wikey/schema.yaml`로 확장.

**구현 범위**

1. **YAML 파서** (`wikey-core/src/schema.ts`)
   - 의존성 없는 소형 파서 (`parseSchemaOverrideYaml`): `entity_types` / `concept_types` 배열 2개만 지원
   - 이름 정규화(lowercase + `_` 외 특수문자 `_` 대체), 빌트인 타입과 이름 충돌 시 silent drop
   - description 없거나 빈 항목은 건너뜀
2. **FS 로더** (`loadSchemaOverride(wikiFS, path='.wikey/schema.yaml')`)
   - 파일 없으면 `null`, 있으면 파싱 결과 반환
   - Obsidian hidden folder 경로 → `vault.adapter` fallback 경로 (기존 `.wikey/` 패치 재사용)
3. **validation + prompt 통합**
   - `isValidEntityType/ConceptType`, `validateMention`, `buildSchemaPromptBlock` 모두 `schemaOverride?` 파라미터 받음
   - `buildSchemaPromptBlock`이 추가 타입을 `(user-defined)` 라벨과 함께 prompt 블록에 포함 ("Entity 타입 (5개)" 식으로 카운트 반영)
4. **canonicalizer.ts** — `CanonicalizeArgs.schemaOverride` 추가, validateAndBuildPage에 전달
5. **ingest-pipeline.ts** — 인제스트 진입 시 `loadSchemaOverride(wikiFS)` 자동 로드, small/large 두 canonicalize 호출 모두에 전달
6. **Obsidian 설정 탭** — `Schema Override` 섹션 + `SchemaOverrideEditModal`
   - Edit: 현재 내용 또는 기본 템플릿 로드 → textarea → Save → `.wikey/schema.yaml` 저장
   - Remove: 파일 삭제 → 빌트인만 활성
   - 상태 표시: "Built-in only" / "+N entity, +M concept from ..." / "parses to no valid types"

**예시 `.wikey/schema.yaml`**

```yaml
entity_types:
  - name: dataset
    description: 공개된 구조화된 데이터 모음 (예: imagenet, kaggle-titanic)
  - name: location
    description: 지리적 지명·시설 (예: seoul, leverkusen)

concept_types:
  - name: regulation
    description: 특정 국가·기관의 규제·법령 (예: gdpr, k-fda-guidelines)
```

**테스트**: 27건 추가 (YAML 파서 8 · validation 5 · getEntityTypes/ConceptTypes 2 · promptBlock 3 · FS 로더 4 · canonicalizer 통합 3 · prompt 주입 1 · built-in+override 1). 159→**186 pass**, 빌드 0 errors.

**한계 (Phase 4 후보 §4-9 ④)**: 현재 v7-5는 **schema 타입**만 확장. Stage 2 mention extraction 프롬프트와 Stage 3 canonicalize 프롬프트 자체는 override 미지원. 필요 시 `.wikey/canonicalize_prompt.md`, `.wikey/mention_prompt.md`로 확장 가능.

### 3.6.6 v7-1 + v7-2 + v7-5 통합 결정성 재측정 — PMS v6 baseline 대비 (2026-04-21 완료)

- 결과 파일: `activity/phase-3-resultx-3.C-determinism-pms-post-v7-2026-04-21.md`
- Baseline (PMS v6, 2026-04-19): Total CV **16.9%**, Entities **14.7%**, Concepts **33.4%**
- 목표: Concepts CV 33.4% → ≤25% (v7-1 decision tree + v7-2 anti-pattern 효과 확인)

**5-run 결과 (2026-04-21, 수동 CDP 드라이브)**

| Run | Entities | Concepts | Total | Time(s) |
| --: | -------: | -------: | ----: | ------: |
|   1 |       10 |       15 |    26 |     309 |
|   2 |       13 |       12 |    26 |     282 |
|   3 |       14 |        8 |    23 |     380 |
|   4 |       12 |       13 |    26 |     343 |
|   5 |        9 |       12 |    22 |     286 |

**통계 vs v6 baseline**

| 지표        | v6 baseline | v7 post |   변화 |
| ----------- | ----------: | ------: | -----: |
| Entities CV |       14.7% |   17.9% |   +22% |
| Concepts CV |       33.4% | **21.2%** | **-37%** ✅ |
| Total CV    |       16.9% |  **7.9%** | **-53%** ✅ |
| Total mean  |         ~30 |    24.6 |   -18% |
| Time mean   |       ~275s |   320s  |   +16% |

**판정**: v7-1 decision tree + v7-2 anti-pattern + v7-5 schema override의 Concepts CV 목표(≤25%) **정량 확증 완료**. Total CV -53%는 기대 이상. 2026-04-20 4회 시도 실패는 측정 스크립트의 **selector 버그** (아래) — 파이프라인 자체는 정상 동작.

**Core / Variable 분리**

- Core Entities: 4/23 (17%) — `goodstream-co-ltd`, `lotus-pms`, `lotus-scm`, `project-management-institute`
- Core Concepts: 7/20 (35%) — `bill-of-materials`, `enterprise-resource-planning`, `gantt-chart`, `manufacturing-execution-system`, `project-management-body-of-knowledge`, `supply-chain-management`, `work-breakdown-structure`

**남은 변동의 성격** (count-level은 안정, **naming/canonicalization**이 잔재):

1. 음역 다중 슬러그: 한국어 "알림톡" → `alimtalk` / `allimtok` / `alrimtok`
2. 축약 불일치: `integrated-member-database` ↔ `integrated-member-db`, `sso-api` ↔ `single-sign-on-api`
3. BOM 동의어 상호배타: `e-bom` / `electronic-bom` / `engineering-bom`
4. **E/C 경계 왕복**: `mqtt` / `project-management-system` / `restful-api` — run 에 따라 entity/concept 재분류

**이전 세션 실패 원인 해명 (2026-04-20 → 2026-04-21)**

`scripts/measure-determinism.sh`의 "ingest did not start" 4회 오진은 **selector 버그**였다 (React state propagation 문제 아님):

```js
// 버그: ingest 시작 시 class swap (apply-btn → cancel-btn) 후 null 반환
const btnProbe = document.querySelector('.wikey-audit-panel .wikey-audit-apply-btn')?.textContent?.trim() || ''
```

`sidebar-chat.ts:999-1000`에서 ingest 시작 시 `applyBtn.removeClass('wikey-audit-apply-btn'); applyBtn.addClass('wikey-audit-cancel-btn')` 수행 → selector가 null 반환 → transition 미감지. 수정:

```js
const btns = [...panel.querySelectorAll('button')].filter(b => /apply|cancel/.test(b.className))
```

이번 세션은 수동 CDP 드라이브 (`/tmp/wikey-det-{setup,start,poll,collect}.js`)로 5/5 성공. `scripts/measure-determinism.sh`의 selector 패치는 Phase 4 §4.5.1로 이관.

**다음 단계**

- slug-level canonicalizer 2차 확장 (음역/축약/동의어 사전) → Phase 4 §4.5
- E/C 경계 왕복 3건 schema에 고정 → Phase 4 §4.5
- `scripts/measure-determinism.sh` selector 수정 → Phase 4 §4.5.1

---

## 3.7 문서 전처리 (PDF · OCR tier chain)
> tag: #core, #workflow

### 3.7.1 E2E 인제스트 테스트 결과 (파워디바이스 PDF)

| 모델                       | 경로                                | 시간             | E  | C   | 총 페이지 | 판정                         |
| -------------------------- | ----------------------------------- | ---------------- | -- | --- | --------- | ---------------------------- |
| **Qwen3 8B**         | local, MarkItDown 88KB, chunked (6) | 17min            | 27 | 26  | 54        | 인제스트 기본 (보수)         |
| **Gemini 2.5 Flash** | cloud, MarkItDown 88KB, chunked (6) | 10min            | 46 | 170 | 217       | 최고 품질 (클라우드)         |
| **Gemma4 26B**       | local, MarkItDown 88KB, chunked (6) | 32min            | 5  | 3   | 9         | **인제스트 제외**      |
| **Qwen3 14B**        | local, 3K smoke test                | 42s              | 4  | 5   | 9         | **제외 (8B 열등)**     |
| **Qwen3.6:35b-a3b**  | local, pdftotext 74KB, chunked (10) | **7.6min** | 30 | 50  | 80        | **인제스트 옵션 추가** |

**Gemma4 26B 인제스트 탈락 이유:** thinking 오버헤드 (매 호출마다 think:true 필수), 한국어 약함, 추출 granularity 최저

**Qwen3 14B 탈락 이유 (2026-04-18 smoke):** 동일 3K chunk에서 qwen3:8b(22.3s/5E+5C) 대비 42.0s/4E+5C — 2배 느리면서 entity 적음. `ollama rm qwen3:14b` 실행.

**Qwen3.6:35b-a3b 채택 근거 (2026-04-18):**

- MoE 35B total / 3B active → 14B dense와 동일 latency
- 3K smoke: 42.6s/5E+5C/854 out_tokens (8B의 646 대비 풍부)
- E2E 74KB: 7.6분/30E+50C — **Qwen3 8B 대비 속도 2.2배 + concepts 1.9배**
- 한국어 도메인 용어 우수: 4H-SiC, Trench 구조 MOSFET, dV/dt 파괴, 단락 내량, 바디 다이오드
- **메모리 부담**: 27GB VRAM, M4 Pro 48GB 기준 로드 시 47G/48G (114MB 여유)
- 인제스트 전용 (Ollama 5분 idle auto-unload), 32K ctx 기본, 상시 로드 비권장

### 3.7.2 사전 준비: markitdown-ocr fallback

사용자 지적: 이미지 스캔 PDF는 텍스트 레이어가 없어 기존 4단계 fallback (markitdown / pdftotext / mdimport / pymupdf) 모두 빈 결과 반환.

**구현** (`wikey-core/src/ingest-pipeline.ts:extractPdfText`):

- 5번째 단계 추가: 4단계 모두 실패 시 markitdown-ocr 호출
- LLM Vision 클라이언트로 Ollama OpenAI 호환 endpoint(`/v1`) + `gemma4:26b` (vision capability) 사용
- 환경변수 `WIKEY_OCR_MODEL`, `OLLAMA_URL`로 오버라이드 가능
- `pip install openai` (markitdown-ocr 의존)

**환경 감지** (`wikey-obsidian/src/env-detect.ts`):

- `EnvStatus.hasMarkitdownOcr` 필드 + `checkMarkitdownOcr()` (`markitdown_ocr` + `openai` 둘 다 import 가능 여부)
- Settings 환경 섹션에 "MarkItDown OCR" 행 (Optional 표시)

### 3.7.3 markitdown-ocr fallback E2E + tier 6 신규 (commit `f35d3b1`)

**문제 발견**

- `raw/0_inbox/OMRON_HEM-7600T.pdf` (48p 한국어 매뉴얼) 인제스트 시도 → 기존 tier 1~5 모두 실패.
- 원인: PDF가 **vector-only (text-as-paths, embedded images 0개)**. ToUnicode CMap 누락 추정.
- pdftotext/pymupdf: 0 chars 추출. markitdown-ocr (tier 5)는 `pdfplumber.page.images`가 비어있어 OCR 미발동, 약 93~973 chars만 반환 (cover image 일부만).
- accept threshold가 50자 (글자 수만 기준) → vector PDF는 짤막한 OCR 결과로 통과되어 tier 6 미진입.

**해결: tier 6 신규 (`extractPdfText`) — page-render Vision OCR**

```typescript
// 신규: 페이지 전체를 PNG 렌더 → 병렬 vision LLM 호출
import fitz  // pymupdf
from concurrent.futures import ThreadPoolExecutor
// DPI 180 기본, parallel 4 기본, max 200 페이지
```

- pymupdf로 페이지를 PNG 렌더 (configurable DPI, default 180)
- ThreadPoolExecutor로 병렬 OCR (configurable parallel, default 4)
- 각 페이지에 vision LLM (`gemini-2.5-flash` default) 전송 → markdown 추출 + 페이지 마커
- 새 config 키 3개: `OCR_DPI`, `OCR_PARALLEL`, `OCR_MAX_PAGES` (`WikeyConfig`)

**Page-aware accept threshold**

- 기존 50자 → `max(200, pageCount × 30)` (cap 2000)로 변경.
- 48p OMRON 기준 1440자 floor → tier 5의 1128자 거부 → tier 6 진입.
- 1페이지짜리 brochure는 200자 floor → 정상 통과 보존.

**E2E 검증 결과 (Audit panel [Ingest] → 자동 PARA 라우팅)**

| 단계                                                                   | 결과                                                                                                     |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| tier 1 markitdown                                                      | 0 chars → reject                                                                                        |
| tier 2 pdftotext                                                       | 0 chars → reject                                                                                        |
| tier 3 mdimport                                                        | error                                                                                                    |
| tier 4 pymupdf/PyPDF2                                                  | 0 chars → reject                                                                                        |
| tier 5 markitdown-ocr                                                  | 1128 chars (1440 floor 미달) → reject                                                                   |
| **tier 6 page-render Vision (gemini/2.5-flash, DPI 180, par 4)** | **35686 chars OK**                                                                                 |
| Stage 1 summary                                                        | gemini (27216 chars source 기준)                                                                         |
| Stage 2 mentions (chunked)                                             | 4 chunks → 34 mentions                                                                                  |
| Stage 3 canonicalize                                                   | **18 entities + 9 concepts**                                                                       |
| 자동 PARA                                                              | `raw/0_inbox/OMRON_HEM-7600T.pdf` → `raw/3_resources/30_manual/600_technology/` (DDC 600 기술 정확) |

생성된 페이지: omron, hem-7600t, intellisense, japanese-society-of-hypertension, omron-healthcare-co-ltd, bluetooth-sig-inc, omron-connect, marler-jr 등 + IEC 60601-1-2-2007, ISO 81060-2-2013, FDA 21 CFR Part 11, Bluetooth Low Energy 등.

**비용**: 48p × ~$0.0008/page = **~$0.04 per ingest** (Gemini 2.5 Flash vision).
**갭 (Phase 4 후보)**: 동일 PDF에 대해 brief 생성 + 본 인제스트가 각각 `extractPdfText` 호출 → **2× OCR 비용**. 캐싱 필요.

### 3.7.4 OMRON HEM-7600T 인제스트 (§3.7.3와 통합 검증)

위 14.2 결과로 함께 검증. raw/0_inbox/ → raw/3_resources/30_manual/600_technology/ 자동 라우팅 확인. 잔여: HEM-7156T-AP (49.6MB, 88p)는 동일 경로 재현 확인용으로 선택적 (markitdown-ocr 갭은 tier 6로 해소).

**Wiki 위생 처리**: source-omron-hem-7600t-manual.md의 한국어 wikilinks 261건 → canonical slug 자동 매핑 (Python 스크립트로 79건 정상 + 나머지 텍스트화). validate-wiki PASS. (canonicalize에 stripBrokenWikilinks 적용 누락 발견, Phase 4 후보)

---

## 3.8 프롬프트 시스템 (single prompt + override)
> tag: #core, #framework

### 3.8.1 단일 프롬프트 모델 리팩토링

**배경**: 사용자 지적 — 기존 2-layer (번들 base + `.wikey/ingest_prompt_user.md` 추가) 모델이 모호하고 "Failed to open user prompt: File already exists" 류 에러 발생.

**설계 변경**:

- ONE source of truth: `.wikey/ingest_prompt.md` 존재 시 그것이 전체 시스템 프롬프트, 미존재 시 `BUNDLED_INGEST_PROMPT` 상수
- 설정 UI: [Edit] (모달 팝업, effective prompt 로드 → 편집 → 저장) + [Reset] (override 파일 삭제)
- "Create" 동작 없음 — Edit이 항상 현재 프롬프트 표시

**코드 변경**:

- `wikey-core/src/ingest-pipeline.ts`:
  - `USER_PROMPT_PATH` / `USER_PROMPT_TEMPLATE` / `loadUserPrompt` 제거
  - `INGEST_PROMPT_PATH = '.wikey/ingest_prompt.md'` + `BUNDLED_INGEST_PROMPT` export
  - `loadEffectiveIngestPrompt(wikiFS)` 추가
  - `buildIngestPrompt(...)`: `userPrompt` 파라미터 → `templateOverride?` (full template 교체)
  - `{{USER_PROMPT}}` placeholder 번들에서 제거
- `wikey-core/src/index.ts`: re-export 갱신
- `wikey-obsidian/src/settings-tab.ts`:
  - `renderIngestPromptSection` 재작성 (Edit/Reset 두 버튼만)
  - `IngestPromptEditModal` 클래스 (textarea + Save/Cancel + 도움말)
  - `.wikey/`는 dotted 폴더라 vault metadata 미추적 → `vault.adapter.exists`로 비동기 상태/Reset enable 갱신
- `wikey-obsidian/styles.css`: `.wikey-ingest-prompt-modal/help/textarea/footer` 스타일 추가
- 기존 `.wikey/ingest_prompt_user.md` 삭제 (Phase 3 E2E 테스트 잔재)

**검증**:

- 단위 테스트 70/70 (15 ingest-pipeline tests 갱신)
- Smoke test: bundled default 경로 인제스트 정상 (82s, 8 페이지)
- UI 테스트: Save → "Custom override" + Reset 활성화, Reset → "Bundled default"

### 3.8.2 prompt override E2E + WikiFS hidden folder bug (commit `3e472fb`)

**버그 발견**

- 사용자가 `.wikey/ingest_prompt.md` 작성해도 LLM은 항상 bundled default 프롬프트 사용.
- 원인: `ObsidianWikiFS.exists/read`가 `vault.getAbstractFileByPath`만 사용. Obsidian의 vault metadata cache는 `.`로 시작하는 hidden folder를 인덱싱하지 않음 → `.wikey/ingest_prompt.md`는 영원히 발견 불가.
- `loadEffectiveIngestPrompt`는 정상이었으나, 어댑터 레벨에서 false 반환 → bundled fallback.

**Fix (`wikey-obsidian/src/main.ts`)**

```typescript
async exists(path: string): Promise<boolean> {
  if (this.plugin.app.vault.getAbstractFileByPath(path) !== null) return true
  // Hidden folders (e.g. .wikey/) bypass Obsidian's vault metadata — check adapter
  return this.plugin.app.vault.adapter.exists(path)
}
async read(path: string): Promise<string> {
  const file = this.plugin.app.vault.getAbstractFileByPath(path)
  if (file) return this.plugin.app.vault.read(file as any)
  const { adapter } = this.plugin.app.vault
  if (await adapter.exists(path)) return adapter.read(path)
  throw new Error(`File not found: ${path}`)
}
```

**E2E 검증**

- `.wikey/ingest_prompt.md` 작성 (커스텀 marker `override-marker-20260420` 포함) → audit ingest
- 결과 `wiki/sources/source-test-prompt-override.md` frontmatter: `tags: ["override-marker-20260420"]` ✓
- **한계 발견**: override는 Stage 1 summary call에만 적용. Stage 2 mention extraction과 Stage 3 canonicalize는 하드코딩된 자체 프롬프트 사용 → entity/concept 페이지엔 marker 없음.
- → Phase 4 후보: Stage 2/3 프롬프트도 사용자 override 가능하게 하기.

---

## 3.9 로컬 LLM 모델 검증
> tag: #eval, #infra

### 3.9.1 로컬 LLM 모델 평가

**커뮤니티 조사 결과:**

- Gemma4 JSON/think 버그 확인 (Ollama #15260): think=false 시 format 파라미터 깨짐
- Qwen3: JSON 구조화 출력 가장 안정적, 한국어 CJK 최적화 (201개 언어)
- SuperGemma4: Jiunsong 파인튜닝, uncensored, HuggingFace GGUF

**설치 모델:**

| 모델               | 크기  | 출처                    |
| ------------------ | ----- | ----------------------- |
| qwen3:8b           | 5.2GB | ollama pull             |
| gemma4:26b (MoE)   | 17GB  | ollama pull             |
| supergemma4:26b    | 16GB  | HuggingFace GGUF import |
| gemma4:latest (8B) | 9.6GB | 기존                    |
| wikey:latest       | 9.6GB | 기존 Modelfile          |

**SuperGemma4 디버그 과정:**

1. 첫 테스트: 빈 응답 (0 chars, eval 100 tokens) — chat template 누락
2. Modelfile에 Gemma4 chat template 추가 → 여전히 빈 응답
3. think:true 추가 → 간단 프롬프트 성공 (`{"ok": true}`)
4. 인제스트 프롬프트: thinking 40,146자 소비 → content 0자 — **thinking loop**
5. 결론: 복잡한 프롬프트에서 thinking에 토큰 전부 소비, 답변 미생성 → **탈락**

**JSON 출력 테스트 (TCP/IP PDF, curl 직접 호출, 3000자 소스):**

| 모델            | 시간   | JSON           | source_page | entities | concepts |
| --------------- | ------ | -------------- | ----------- | -------- | -------- |
| qwen3:8b        | 49.5s  | OK             | OK          | 4        | 3        |
| gemma4:26b      | 99.6s  | OK             | OK          | 6        | 8        |
| supergemma4:26b | 187.4s | **FAIL** | —          | —       | —       |

**모델 정리:** wikey:latest 삭제, gemma4:latest(8B) 삭제, supergemma4:26b 삭제

### 3.9.2 provider-defaults.ts 단일 소스 리팩토링 (세션 종반)

**문제**: 모델 리터럴이 6곳에 분산 하드코딩 → `gpt-4o` vs `gpt-4.1` 같은 불일치 재발.

**해결**: `wikey-core/src/provider-defaults.ts` 신규 — 단일 진실 원천.

```ts
PROVIDER_CHAT_DEFAULTS = {
  gemini:    'gemini-2.5-flash',
  anthropic: 'claude-haiku-4-5-20251001',  // flash 동급 가성비
  openai:    'gpt-4.1-mini',
  ollama:    'qwen3:8b',
}

PROVIDER_VISION_DEFAULTS = {
  gemini:    'gemini-2.5-flash',
  anthropic: 'claude-haiku-4-5-20251001',  // (미사용, Ollama fallback)
  openai:    'gpt-4o-mini',
  ollama:    'gemma4:26b',
}

CONTEXTUAL_DEFAULT_MODEL = 'gemma4:26b'
ANTHROPIC_PING_MODEL = 'claude-haiku-4-5-20251001'
```

**가성비 동급 기준**:

- sonnet-4 → haiku-4-5 (대형 → 경량)
- gpt-4.1 → gpt-4.1-mini
- gpt-4o → gpt-4o-mini (vision)

**교체 6곳**:

1. `wikey-core/src/config.ts` `PROVIDER_DEFAULTS` → `PROVIDER_CHAT_DEFAULTS` (+ `CONTEXTUAL_MODEL` 기본값)
2. `wikey-core/src/llm-client.ts` 4개 provider fallback (gemini/anthropic/openai/ollama)
3. `wikey-core/src/ingest-pipeline.ts` `resolveOcrEndpoint` 4분기
4. `wikey-core/src/query-pipeline.ts` ollama fallback (`'gemma4'` → `qwen3:8b`)
5. `wikey-obsidian/src/main.ts` `buildConfig` `CONTEXTUAL_MODEL`
6. `wikey-obsidian/src/settings-tab.ts` Anthropic API Test 버튼 ping 모델

**테스트 조정**: `config.test.ts` anthropic default 기대값 변경 (`claude-sonnet-4-20250514` → `claude-haiku-4-5-20251001`).

---

## 3.10 디버깅 · 운영 안정성
> tag: #ops

### 3.10.1 디버깅 (5건 해결)

Obsidian Electron 환경의 제약으로 5건의 런타임 이슈 발견 및 해결:

| # | 문제           | 원인                                     | 해결                                             |
| - | -------------- | ---------------------------------------- | ------------------------------------------------ |
| 1 | CORS 차단      | `import('node:path')` → 웹 fetch 취급 | `require()` 전환                               |
| 2 | node not found | Electron PATH에 nvm 미포함               | 로그인 셸 PATH 탐지 (`env-detect.ts`)          |
| 3 | ABI mismatch   | Electron node ≠ 시스템 node             | qmd 호환 node 자동 선택 (`findCompatibleNode`) |
| 4 | localhost 차단 | `requestUrl()` CORS                    | Node.js `http` 모듈 직접 호출                  |
| 5 | 빈 검색 결과   | qmd URI에 `wiki/` 누락                 | `parseQmdOutput`에 접두사 추가                 |

---

### 3.10.2 Could 완료 3/4

| 항목                                      | 구현                                                                      | 상태           |
| ----------------------------------------- | ------------------------------------------------------------------------- | -------------- |
| **대화 히스토리 영구 저장**         | `persistChatHistory` 토글, 최대 100건, 2초 디바운스, onunload flush     | **완료** |
| **Sync 경고 → 설정 통합으로 해소** | API 키가 항상 `credentials.json`에 저장. `syncProtection` 토글 제거됨 | **완료** |
| **BRAT 배포 + v0.1.0-alpha 태그**   | `versions.json`, `.github/workflows/release.yml`, 태그 갱신           | **완료** |
| **qmd SDK import**                  | Phase 3 마지막 또는 Phase 4 연기                                          | 미착수         |

---

### 3.10.3 H3: qmd DB 동시 접근 — 완료

- `tools/qmd/src/store.ts`에 `PRAGMA busy_timeout = 5000` 추가
- WAL 모드 + busy_timeout으로 CLI/플러그인 동시 접근 안전
- 동시 접근 테스트 통과 (쓰기 중 읽기 에러 없음)

### 3.10.4 M3: 설정 파일 통합 — 완료

**변경 전 (3파일 분리):**

```
.env                     ← API 키 (bash만)
local-llm/wikey.conf     ← 모델 설정 (bash만)
data.json                ← 전체 설정 (플러그인만)
```

**변경 후 (단일 소스):**

```
./wikey.conf                        ← 공유 설정 (CLI + 플러그인)
~/.config/wikey/credentials.json    ← API 키 (CLI + 플러그인 공유)
data.json                           ← 플러그인 상태만
```

**역할 분담 (변경 후):**

| 파일                                  | 저장 내용                                 | 소비자          | Git              |
| ------------------------------------- | ----------------------------------------- | --------------- | ---------------- |
| `./wikey.conf`                      | 모델, 프로바이더, URL, 검색, 비용 한도    | bash + 플러그인 | 추적             |
| `~/.config/wikey/credentials.json`  | API 키 (Gemini/Anthropic/OpenAI)          | bash + 플러그인 | N/A (vault 외부) |
| `.obsidian/plugins/wikey/data.json` | 채팅 히스토리, 피드백, 탐지 경로, UI 상태 | 플러그인만      | .gitignore       |

**키 이동:**

| 키                             | 이전 위치                                | 이후 위치               |
| ------------------------------ | ---------------------------------------- | ----------------------- |
| WIKEY_BASIC_MODEL 등 모델 설정 | wikey.conf (bash) + data.json (플러그인) | wikey.conf (공유)       |
| GEMINI_API_KEY 등 API 키       | .env (bash) + data.json (플러그인)       | credentials.json (공유) |
| OLLAMA_URL                     | data.json                                | wikey.conf              |
| COST_LIMIT                     | data.json                                | wikey.conf              |
| chatHistory, feedback          | data.json                                | data.json (유지)        |

**파일별 변경 상세:**

| 파일                                         | 변경 내용                                                                                             |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `local-llm/wikey.conf` → `./wikey.conf` | 프로젝트 루트로 `git mv`. `local-llm/wikey.conf`는 심볼릭 링크                                    |
| `./wikey.conf`                             | 헤더 갱신 ("통합 설정, 단일 소스"),`OLLAMA_URL` 주석 해제, `COST_LIMIT=50` 추가, API 키 안내 주석 |
| `wikey-core/src/config.ts`                 | `loadConfig()` 스텁 → 실제 구현: wikey.conf 파싱 + credentials.json 읽기                           |
| `wikey-obsidian/src/main.ts`               | `loadFromWikeyConf()`: wikey.conf 읽어 settings에 머지                                              |
|                                              | `saveToWikeyConf()`: 모델/프로바이더 변경을 wikey.conf에 정규식 치환으로 쓰기 (주석/구조 보존)      |
|                                              | `buildPluginOnlyData()`: data.json에 플러그인 상태만 저장 (모델/키 제외)                            |
|                                              | `syncProtection` 필드 제거 (API 키가 항상 vault 외부 → 토글 불필요)                                |
|                                              | `buildPersistableSettings()` 제거 (buildPluginOnlyData로 대체)                                      |
|                                              | `deleteCredentials()` 제거 (credentials.json 항상 유지)                                             |
| `wikey-obsidian/src/settings-tab.ts`       | Sync 보호 토글 제거, API Keys 섹션에 저장 위치 안내 문구                                              |
| `scripts/lib/llm-api.sh`                   | conf 경로 `./wikey.conf`로 변경, `_load_credentials()` 추가 (jq → grep fallback)                 |
| `scripts/check-providers.sh`               | conf 경로 변경 + credentials.json 로딩                                                                |
| `scripts/summarize-large-source.sh`        | credentials.json 로딩 추가                                                                            |
| `scripts/setup.sh`                         | "API 키" 섹션을 credentials.json 기준으로 재작성, wikey.conf 경로 변경                                |
| `.env.example`                             | 삭제 (wikey.conf 헤더에 안내 통합)                                                                    |

**bash credentials.json 로딩 (`_load_credentials`):**

```
우선순위: 환경변수 > credentials.json > .env (폴백) > wikey.conf
```

- jq 사용 가능 시: `jq -r ".$key // empty"` 파싱
- jq 미설치 시: grep+sed fallback (순수 bash)
- camelCase→SCREAMING_SNAKE 매핑: `geminiApiKey`→`GEMINI_API_KEY`

**saveToWikeyConf 로직:**

```
1. wikey.conf를 fs.readFileSync로 읽기
2. 변경 키별 정규식: /^(#\s*)?KEY=.*$/m
3. 매치 시 교체, 미매치 시 파일 끝에 추가
4. 주석 처리된 키(# KEY=...)도 활성화
5. wikey.conf 미존재 시 무시 (CLI 미사용 환경)
```

### 3.10.5 발견 이슈 5건 → 4건 수정 + 회귀 검증

| # | 이슈                                                          | 우선순위 | 수정 내용                                                                                            | 회귀 검증                                                                                                                                                   |
| - | ------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1 | 청크형 인제스트 silent partial (log/index/.ingest-map 미갱신) | HIGH     | `[Wikey ingest]` console.info 단계별 로깅 + 누락 필드 warn + commands.ts에 console.error+stack     | dev:console에 `start`/`source meta`/`summary done`/`chunks done`/`pages written`/`index updated`/`log prepended`/`done` 단계 영구 기록 확인 |
| 2 | 동시 인제스트 race ("File already exists")                    | HIGH     | `ObsidianWikiFS.write` 원자적 upsert (try create → catch already-exists → modify)                | 2건 동시 트리거 → 둘 다 성공, "already exists" 0건                                                                                                         |
| 3 | Ollama 404 모델 메시지 모호                                   | MED      | `LLMClient.callOllama`에서 `data.error` 검사 → "not found"/"does not exist" 패턴 시 친절 메시지 | `fakemodel:7b` → "Ollama model 'fakemodel:7b' not found. Run: ollama pull fakemodel:7b"                                                                  |
| 4 | Settings [Create & Edit] 버튼 metadata 캐시 race              | LOW      | `vault.adapter.exists` 디스크 사전 검사 + 50ms 대기 후 재조회                                      | (수동 검증 잔여)                                                                                                                                            |
| 5 | wiki/ 폴더 인제스트 가드 부재                                 | LOW      | **보류** — 다음 세션에서 결정                                                                 | —                                                                                                                                                          |

### 3.10.6 부수 수정

- **log.md 헤더 형식**: `## YYYY-MM-DD` → `## [YYYY-MM-DD] ingest | <filename>` (validate-wiki.sh 규칙 일치)
- **사이드바 헤더 탭 순서**: dashboard → audit → ingest → help → **dashboard → ingest → audit → help** (논리적 순서)
- **대시보드 hint 아이콘**: `☑` Unicode → audit eye SVG 인라인 (시각적 통일)

### 3.10.7 wiki/ 인제스트 아티팩트

E2E 테스트로 생성된 페이지를 자동 정리 후 커밋 (`79a458e`):

- 16 신규 entities (SiC-MOSFET, claude-code, gemini, gemma-4 등)
- 12 신규 concepts (file-over-app, rag-synthesis-layer, korean-search-strategy 등)
- 23 modified (overview 인제스트로 기존 페이지 갱신)

**자동 정리 (validate hook 통과)**:

- 중복 파일 3건 제거 (concepts/byoai, entities/korean-enterprise-specialization, sources/overview)
- 깨진 wikilink 41건을 plain text로 변환 (4 파일)
- log.md 형식 6건 정규화
- index.md에 누락 항목 17건 추가
- 잔여 1건 수동 수정 (log.md `[[llm-wiki-architecture]]` → `[[concept-llm-wiki-architecture]]`)

### 3.10.8 근본 수정 11건 상세

#### 3.12.3.1 B-1 #2 인제스트 품질 검증 — 중복 13건 정리

2026-04-18 Scenario 4 custom 프롬프트(`.wikey/ingest_prompt_user.md`)의 slug 규칙(`entity-` 접두사 + 영문 대문자)이 기본 프롬프트의 lowercase-hyphen 규칙과 충돌하여 34 신규 페이지 중 13건 중복.

**삭제 (canonical로 병합)**:

- 접두사 변형 9건: `entity-byoai`, `entity-wikey`, `entity-zero-setup`, `entity-korean-enterprise-specialization`, `entity-architecture-decision-records`, `entity-nanovna-v2`, `concept-architecture-decision-records`, `concept-llm-participation-multi-layer-search`, `concept-llm-wiki-architecture`
- 영한 혼합/대문자 변형 4건: `ROHM-Co-Ltd` (→ rohm), `sic-power-devices` (→ sic-power-device), `SiC-파워-디바이스` (→ sic-power-device), `sources/nanovna-v2-notes` (→ source-nanovna-v2-notes)

**Rename (lowercase-hyphen 통일)**:

- `SiC-MOSFET` → `sic-mosfet`
- `SiC-SBD` → `sic-sbd`
- `Full-SiC-파워-모듈` → `full-sic-power-module`

**Canonical 병합**:

- `nanovna-v2.md` (상세 내용 보강)
- `architecture-decision-records.md` (ADR-001~007 정보 추가)

**부가 정리**:

- plain-text 참조를 위키링크로 변환 (`rohm.md`, `sic-power-device.md`, `sic.md`)
- `sic-power-device.md` 자기 참조 제거
- `index.md` 전면 재작성 (카테고리별 정렬)
- `validate-wiki.sh` PASS (5/5) + PII PASS

#### 3.12.3.2 Provider/Model 불일치 404 — 근본 수정

**현상**: OMRON 스캔 PDF Ingest 시 `[error] Request failed, status 404` + 로그 `provider=gemini, model=qwen3.6:35b-a3b`

**원인 체인**:

1. 사용자가 이전에 Ingest Model=`qwen3.6:35b-a3b`(Ollama)로 설정
2. basicModel을 gemini로 변경했으나 `settings.ingestModel` stale로 남음
3. `buildConfig`의 `WIKEY_MODEL = ingestModel || cloudModel || 'qwen3:8b'` fallback에서 cross-provider 조합 그대로 통과
4. `mapToProvider('gemini', cfg)` → userModel=`qwen3.6:35b-a3b`가 그대로 model로 세팅
5. Gemini API가 `qwen3.6:35b-a3b` 모델 모름 → 404

**수정**:

- `isModelCompatible(model, provider)` guard in `main.ts buildConfig`
  - 모델 prefix로 provider 호환성 검증 (`gemini-*`, `gpt-*`, `claude-*` → 해당 provider만, 그 외 → ollama만)
  - 부적합 시 `validatedModel = ''` → wikey-core `resolveProvider`가 provider 기본값 선택
- `WIKEY_MODEL` fallback 제거 (`|| 'qwen3:8b'` 삭제)
- settings-tab Provider 드롭다운 onChange 시 `ingestModel` + `cloudModel` 동시 clear + Notice
- `renderModelDropdown()` 헬퍼로 Default/Ingest Model 모두 API 동적 드롭다운 (fetchModelList)

**검증**: Raspberry Pi 재시도 시 로그 `provider=gemini, model=gemini-2.5-flash` 확인 + 18 페이지 정상 생성.

#### 3.12.3.3 Silent Fail UX 버그

**현상**: Ingest 실패 시 UI row에 fail 클래스 설정됐지만 `renderInboxStatus(2000ms)` 재호출로 상태 즉시 리셋 → 사용자가 에러 못 봄.

**수정**:

- Plugin-level state `inboxFailState: Map<filename, {error, timestamp}>` (10분 TTL)
- `renderInboxStatus`가 각 row 렌더링 시 state 확인 → fail 클래스 + 에러 메시지 복원
- moveBtn(Ingest) 핸들러 진입 시 선택 파일의 failState 삭제 (Retry semantics)
- TTL 초과 항목 자동 정리

#### 3.12.3.4 classify.ts PARA 경로 하드코딩

**현상**: classify가 모든 destination을 `raw/resources/`로 설정. PARA 규칙은 `raw/3_resources/`. 이동 시 PARA 아닌 신규 폴더 생성.

**원인**: Phase 2 Step 1 PARA 재구조화 시 classify.ts(`classify-hint.sh` 포팅본) 업데이트 누락.

**수정**: `raw/resources/` → `raw/3_resources/` 4곳 sed (PDF/MD/CAD/소스코드/기본값).

#### 3.12.3.5 wiki-ops.updateIndex 카테고리 분기 없음

**현상**: Raspberry Pi 첫 인제스트 후 `index.md` "## 분석" 섹션에 18개 신규 항목이 전부 몰림 (엔티티 9 + 개념 8 + 소스 1 섞여서).

**원인**: 기존 `updateIndex(fs, string[])` 시그니처가 카테고리 정보 없이 파일 끝(즉, 마지막 섹션 = 분석)에 단순 append.

**수정**:

- 시그니처 확장: `IndexAddition = string | { entry, category: 'entities' | 'concepts' | 'sources' | 'analyses' }`
- `CATEGORY_HEADERS` 매핑 (`entities → '## 엔티티'`, `concepts → '## 개념'`, `sources → '## 소스'`, `analyses → '## 분석'`)
- `insertIntoSection(content, header, entries)` 헬퍼 — 다음 `## ` 헤더 직전 또는 EOF 위치에 insert
- 기존 string 입력은 `analyses`로 fallback (backward compat, legacy 테스트 통과)
- `ingest-pipeline`: `parsed.index_additions`의 각 entry에서 첫 위키링크 추출 → `sourcePage.filename`/`entities[].filename`/`concepts[].filename`과 매칭해 category 태깅

**테스트**: 6 신규 (category routing / mixed / legacy / 중복 방지 등).

#### 3.12.3.6 log.md 날짜 UTC 편향 (I2)

**현상**: KST 00~09시 인제스트 시 `log.md` 헤더에 전날 날짜.

**원인**: `new Date().toISOString().slice(0,10)` (UTC 기준).

**수정**: `formatLocalDate(d)` 헬퍼 (getFullYear/Month/Date 로컬). 3곳 교체 (small-doc 경로 / summary 경로 / merge 경로).

**테스트**: 3 신규 (로컬 타임존 확인 / zero-pad / 10-char 포맷).

#### 3.12.3.7 OCR 모델 하드코딩 → Provider 설정 기반 (I1 선제 처리)

**현상**: `resolveOcrEndpoint`의 vision 모델이 `gemma4:26b` 하드코딩. 사용자 basicModel이 gemini여도 OCR은 강제로 Ollama.

**수정**:

- Settings에 `OCR Provider` + `OCR Model` 전용 필드 (미설정 시 basicModel 상속)
- `resolveOcrEndpoint(config)`: 4 provider OpenAI-compat 엔드포인트 자동 선택
  - gemini → `https://generativelanguage.googleapis.com/v1beta/openai/`
  - openai → `https://api.openai.com/v1`
  - anthropic → Ollama fallback (OpenAI-compat vision 미지원)
  - ollama → `http://localhost:11434/v1`
- 5-tier PDF 추출 각 단계에 `[Wikey ingest][pdf-extract] tier N/5 ...` 체크포인트 로깅 (silent fail 해소)
- `extractPdfText` 시그니처에 `config?` 추가

#### 3.12.3.8 classify 세부 서브폴더 미지원 → Dewey Decimal 10대분류

**기존**: 11개 제품별 3차 폴더 (`101_build_rccar`, `102_build_fpv`, `201_radio_rf-measurement`, `301_equip_test-equipment`, `901_wikey_design` 등) — 과도하게 디테일 + CLASSIFY.md 지속 유지 부담.

**교체**: Dewey Decimal 간소화 10대분류 (`000_general`~`900_lifestyle`)

- `300_science` — 물리/화학/수학/반도체
- `400_engineering` — 회로/CAD/기계/모터
- `500_technology` — IT/AI/임베디드/컴퓨팅
- `600_communication` — 무선/카메라/영상/안테나
- `900_lifestyle` — 취미/RC/시뮬레이터/오디오
- 나머지 000/100/200/700/800 구조만 사전 생성

**구현 세부**:

- 기존 regex `\b` → `tokenize + Set.has` (파일명 `_` 경계 문제 해소)
- 한국어 키워드는 substring 매칭 (한글은 word boundary 없음)
- 첫 매칭 확정, 매칭 없으면 2차 폴더까지만

**PARA 방법론 전체 반영**: Projects(1_)는 프로젝트별 고유 폴더라 제외, **Areas / Resources / Archive** 모두 동일 2차×3차 구조 공유 (주제 기반 분류는 세 카테고리 모두 동일해야 한다는 Forte PARA 원칙).

**Script**: `scripts/setup-para-folders.sh` (idempotent)

- 1차 PARA 6 (0_inbox, 1_projects, 2_areas, 3_resources, 4_archive, 9_assets)
- Areas/Resources/Archive × 2차 6 × 3차 10 = 180 폴더 전부 사전 생성
- `mkdir -p`로 멱등, 기존 폴더 skip
- 실행(최종): 204개 폴더 확보

**플러그인 배포 자동화**: `wikey-obsidian/src/setup-para.ts` 신규 — `ensureParaFolders(app)` TypeScript 포팅. 플러그인 onload에서 자동 호출 → 신규 vault에도 기본 구조 배포. 사용자가 별도 스크립트 실행 불필요.

**CLASSIFY.md 갱신**: 3차 섹션 재작성 (로컬만, `raw/` gitignore로 git 미추적).

#### 3.12.3.9 Default Model UI 상세 모델 미지정 → API 동적 드롭다운

**기존**: Default Model 섹션에 Provider 드롭다운만. 사용자가 `gemini-2.5-pro` vs `gemini-2.5-flash` 등을 선택할 수 없고 `PROVIDER_DEFAULTS` 하드코딩된 `gemini-2.5-flash` 강제.

**수정**:

- Default Model / Ingest Model 섹션 양쪽에 Model 필드 추가
- `renderModelDropdown()` 헬퍼 (`fetchModelList(provider, config, httpClient)` 동적 로드)
- Provider API 미설정/오프라인 시 `(API unavailable — check API key)` 표시
- 기존 custom 값은 `(custom)` 라벨로 보존 (API가 리스트 못 주는 특수 모델 대응)
- `(provider default)` 옵션으로 wikey-core 기본값 위임 가능 (명시적 미설정)
- `cloudModel` 필드 재활용 (Chat 패널 모델 선택과 공유 — follow-up: coupling 정리)

#### 3.12.3.10 설정 Dropdown 스타일 비일관 → `.wikey-select` 전체 통일

**기존**: Obsidian `Setting.addDropdown`(`.dropdown`) + Audit 패널의 `.wikey-select` 공존 → 같은 설정 탭 내에서 UI 불일치.

**수정**:

- `renderStandardDropdown(container, name, desc, options, currentValue, onChange)` 헬퍼
- 설정 6 selects 모두 `.wikey-select` 적용 (Default Provider / Ingest Provider / Auto Ingest Interval / OCR Provider / Default Model / Ingest Model)
- Audit/Ingest 패널과 chevron 스타일 통일

**CSS 조정**:

- `.wikey-select { border: none; box-shadow: none; outline: none; }`
- `:focus`, `:hover` 상태에서도 shadow/outline 제거
- chevron SVG fill `#999` → `#bbb` (배경 속에서 살짝 밝게)

#### 3.12.3.11 Environment Re-detect 위치 이동

**기존**: Environment 섹션 하단에 `Setting().addButton` → 긴 상태 목록 스크롤 후에야 보임.

**수정**:

- h3 헤더와 같은 행에 우측 고정 (`.wikey-settings-section-header` flex row)
- `.wikey-settings-section-btn` — small right-aligned button with border/radius

### 3.10.9 Lint 세션 (commit `a739a20`)

- `wiki/log.md` L43 `, ,` cosmetic 정리 (정규식 `,(?:\s*,)+` → `,`)
- `validate-wiki.sh` PASS (broken index links 0, 빈 페이지 0)
- 64 entities / 53 concepts / 11 sources 정합성 확인

---

## 3.11 E2E 자동 검증 + CDP
> tag: #eval, #workflow

### 3.11.1 E2E 자동 실행 (9 시나리오)

`plan/phase-3-todox-3.B-obsidian-test.md` 5 시나리오 + 사용자 요청으로 3-1, 4-1 (Gemini 변형) 추가.

**자동화 도구**:

- `obsidian-cli` (`eval`, `dev:console`, `dev:screenshot`, `command`, `plugin:reload`)
- Notice MutationObserver 패치로 auto-dismiss 우회 → `[NOTICE] HH:MM:SS <text>` 콘솔 영구 기록
- Monitor 도구로 인제스트 완료 폴링

**결과**:

| 시나리오                       | 모델             | 결과                                  | 소요 |
| ------------------------------ | ---------------- | ------------------------------------- | ---- |
| 1. 환경 감지                   | —               | PASS                                  | 1m   |
| 2. 작은 파일                   | qwen3:8b         | PASS (3E+2C)                          | 66s  |
| 3. 큰 PDF                      | qwen3.6:35b-a3b  | PARTIAL (source+7E, log/index 미갱신) | 24m  |
| 3-1. 큰 PDF                    | gemini-2.5-flash | FAIL (race "File already exists")     | 8m   |
| 4. 작은 파일 + custom prompt   | qwen3:8b         | PASS (slug 규칙 준수)                 | 80s  |
| 4-1. 작은 파일 + custom prompt | gemini-2.5-flash | PASS (4E+6C, slug 준수)               | 35s  |
| 5a. Ollama 중단                | —               | PASS ("socket hang up")               | 12s  |
| 5b. 잘못된 모델명              | fakemodel:7b     | PARTIAL ("JSON parse failed" 모호)    | 40s  |
| 5c. raw/ 외부 파일             | qwen3:8b         | PASS (가드 없음, 19페이지 생성)       | 108s |

상세 결과: `activity/phase-3-resultx-3.B-test-results.md` (291줄).

### 3.11.2 Obsidian CDP E2E 패턴 도입

실 사용자 클릭 흐름 자동 검증을 위한 인프라.

**실행 절차**:

1. Obsidian 종료 → `--remote-debugging-port=9222 --remote-allow-origins=*` 플래그로 재실행
2. `/tmp/wikey-cdp.py` 헬퍼 (websocket-client + CDP `Runtime.evaluate`)
3. 콘솔 monkey-patch → `window.__wikeyConsoleBuffer`에 `[Wikey ...]` 로그 버퍼링
4. Monitor tool로 주기적 폴링 → row 상태 class 기반 terminal 감지

**핵심 발견**:

- Chrome 111+ 정책상 `--remote-allow-origins=*` 필수 (없으면 WebSocket 403 Forbidden)
- `*`는 zsh에서 glob 되므로 작은따옴표로 감싸야 함

**패널 셀렉터 (재사용)**:

- `.wikey-header-btn[aria-label="Dashboard|Ingest|Audit|Help|Clear Chat|Reload|Close"]`
- `.wikey-ingest-panel`, `.wikey-audit-panel`
- `.wikey-ingest-inbox .wikey-audit-row` / `.wikey-audit-cb` / `.wikey-audit-apply-btn`

**플러그인 리로드**:

```js
await app.plugins.disablePlugin('wikey')
await app.plugins.enablePlugin('wikey')
```

전체 참고: `~/.claude/projects/.../memory/reference_obsidian_cdp_e2e.md`.

### 3.11.3 검증 결과

| 지표                   | 결과                                                                                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 단위 테스트            | **95/95 PASS** (이전 65 → 70 → 95, +30)                                                                                                                                                     |
| 빌드                   | **0 errors**                                                                                                                                                                                  |
| validate-wiki.sh       | **PASS** (5/5)                                                                                                                                                                                |
| check-pii.sh           | **PASS**                                                                                                                                                                                      |
| CDP E2E (Raspberry Pi) | **성공** — Ingest 패널 체크박스 → Ingest 버튼 → Gemini 2.5 Flash → 18 페이지 (source 1 + entities 9 + concepts 8), classify='auto'로 `raw/3_resources/30_manual/500_technology/`로 이동 |
| OCR 경로 관찰          | OMRON 6.3MB 스캔 PDF → markitdown-ocr + gemma4:26b vision 트리거 확인 (완주 검증은 §B-2 #4)                                                                                                       |
| UI 검증 (CDP)          | 설정 패널 6 selects 모두 `.wikey-select` 적용, Environment Re-detect 헤더 우측 배치, Ingest 패널 재설계(drop header + Add + filesize/Cloud + Ingest) 모두 확인                                    |

### 3.11.4 검증 결과

| 지표                      | v5 (이전)   | v6 (현재)                                          |
| ------------------------- | ----------- | -------------------------------------------------- |
| 5회 std deviation (Total) | (cancelled) | **CV 16.9%** (range 22~38)                   |
| Entities 분류 일관성      | 흔들림      | **5중 4회 12-13**                            |
| Concepts CV               | (cancelled) | 33.4%                                              |
| 한국어 라벨               | (회피 발생) | **0건**                                      |
| UI 라벨 / 비즈니스 객체   | 발생        | **0건**                                      |
| 약어 자동 통합            | 부분        | **100%** (pmbok/erp/wbs/bom/scm/mes/plm/aps) |
| 기존 entity 재사용        | 0%          | **100%** (goodstream-co-ltd "업데이트")      |
| 처리 시간 평균            | 525s        | **290s** (-45%)                              |
| log/index 등재율          | LLM 의존    | **100%** (Phase A 결정적 backfill)           |

### 3.11.5 Obsidian UI 수동 테스트 (사용자 검증 완료)

- 사용자가 직접 6 시나리오 점검 → 별도 코드 변경 없음.
- `plan/phase-3-todo.md` §B-1 → `[x]` 마킹.

---

## 3.12 Eng 리뷰 이슈 + CEO 추가
> tag: #ops, #docs

### 3.12.1 HIGH

| #  | 이슈                  | 반영                                                                                                                                 | 상태           |
| -- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| H1 | 인제스트 프롬프트 DRY | `prompts/ingest.txt` 추출 + `buildIngestPrompt()` 플레이스홀더 치환                                                              | **완료** |
| H2 | child_process 셸 주입 | 모든 외부 프로세스 호출에 `execFile()`/`spawn()` 사용                                                                            | **완료** |
| H3 | qmd DB 동시 접근      | `PRAGMA busy_timeout = 5000` 추가 (`store.ts:777`). WAL + busy_timeout으로 CLI/플러그인 동시 접근 안전. 쓰기 중 읽기 테스트 통과 | **완료** |

### 3.12.2 MEDIUM

| #  | 이슈                      | 반영                                                                                                                                                                                                                                                                           | 상태                               |
| -- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- |
| M1 | Obsidian Sync API 키 경고 | API 키가 항상 `~/.config/wikey/credentials.json`에 저장 (vault 외부). M3 통합으로 `syncProtection` 토글 자체가 불필요해져 제거                                                                                                                                             | **완료 (M3에 흡수)**         |
| M2 | wiki-ops 경로 검증        | `buildPath()`에서 `..`, `/` 차단                                                                                                                                                                                                                                         | **완료**                     |
| M3 | 설정 파일 통합            | 3종(`.env`, `wikey.conf`, `data.json`) → 단일 소스 체계. `wikey.conf` 프로젝트 루트 이동, `loadConfig()` 실제 구현, 플러그인 `loadFromWikeyConf()`/`saveToWikeyConf()`/`buildPluginOnlyData()` 추가, bash `_load_credentials()` 추가, `.env.example` 삭제 | **완료**                     |
| M4 | cost-tracker.sh fallback  | 비용 미표시, 페이지 수만 표시                                                                                                                                                                                                                                                  | **완료** (graceful fallback) |

### 3.12.3 CEO 추가 항목

| 항목                  | 반영                                       | 상태           |
| --------------------- | ------------------------------------------ | -------------- |
| Obsidian URI 프로토콜 | `obsidian://wikey?query=` + `?ingest=` | **완료** |
| 인제스트 진행률       | Notice 4단계 표시                          | **완료** |

---

---

## 3.13 CLI 포팅
> tag: #utility

### 3.13.1 CLI 포팅

| 스크립트                  | 포팅                 | 모듈                              |
| ------------------------- | -------------------- | --------------------------------- |
| llm-ingest.sh             | 완전 포팅            | `ingest-pipeline.ts`            |
| wikey-query.sh            | 완전 포팅            | `query-pipeline.ts`             |
| llm-api.sh                | 완전 포팅            | `llm-client.ts` + `config.ts` |
| classify-inbox.sh         | 규칙 엔진 포팅       | `classify.ts`                   |
| summarize-large-source.sh | PDF 텍스트 추출 포팅 | `ingest-pipeline.ts`            |
| validate-wiki.sh          | exec 래퍼            | `scripts-runner.ts`             |
| check-pii.sh              | exec 래퍼            | `scripts-runner.ts`             |
| reindex.sh                | exec 래퍼            | `scripts-runner.ts`             |
| cost-tracker.sh           | exec 래퍼            | `scripts-runner.ts`             |

---

---

## 3.14 코드 규모 추이 + 커밋 이력
> tag: #docs, #ops

### 3.14.1 코드 규모 (현재)

| 영역                           | 파일           | 라인 수          |
| ------------------------------ | -------------- | ---------------- |
| wikey-core/src (구현)          | 9개 (.ts)      | ~1,300           |
| wikey-core/src/__tests__ | 5개 (.test.ts) | ~600             |
| wikey-obsidian/src             | 6개 (.ts)      | ~1,100           |
| wikey-obsidian/styles.css      | 1개            | ~400             |
| **합계**                 | **21개** | **~3,400** |

65 tests passed, 빌드 0 errors.
커밋: 31개 (Phase 3 시작 이후)

---

### 3.14.2 완료

- [X] 상태 바 "0 pages" — onLayoutReady + vault 이벤트 debounced
- [X] Obsidian 통합 테스트 — 6 시나리오 프로그래매틱 검증
- [X] PDF 인제스트 E2E — Raspberry Pi PDF 7페이지 생성 성공
- [X] Summary 대시보드 — wiki/raw 현황, 태그 랭킹, 미인제스트 통계
- [X] classify UI — PARA 드롭다운 + 이동
- [X] 비용 추적/reindex/validate/pii UI — 설정 탭 위키 도구 섹션

### 3.14.3 추가 구현

- [X] **Audit 패널** — 헤더 [👁] 아이콘, 미인제스트 문서 관리
  - 체크박스 선택 + 전체선택 + 폴더 필터
  - 프로바이더 선택 (기본=basicModel) + [적용] [보류] 버튼
  - 파일별 프로그레스바 (행 하단선, stripe 애니메이션, 가중치 5/80/90/100%)
  - ingest-map.json 매핑 영속화 (재시작 시 정확한 인식)
  - 실패 파일 목록 유지 + 에러 메시지 표시 + 파일별 즉시 카운터 갱신
- [X] **Cross-lingual 검색** — 한국어→영문 키워드 추출 + CR bilingual 프롬프트
- [X] **클라우드 LLM 모델 선택** — API 동적 로드 + .wikey-select chevron UI 통일
- [X] **헤더 배타적 토글** — 4패널 중 1개만 활성 + active 스타일
- [X] **헤더/입력 고정** — overflow:hidden + flex-shrink:0
- [X] **inbox 우회 감지** — 시작 10초 grace + 배치 알림
- [X] **pdftotext PATH** — Electron 환경 /opt/homebrew/bin 보강
- [X] **audit-ingest.py** — raw/ 미인제스트 문서 감지 스크립트

### 3.14.4 코드 규모 (갱신)

| 영역                           | 파일           | 라인 수          |
| ------------------------------ | -------------- | ---------------- |
| wikey-core/src (구현)          | 9개 (.ts)      | ~1,600           |
| wikey-core/src/__tests__ | 5개 (.test.ts) | ~600             |
| wikey-obsidian/src             | 6개 (.ts)      | ~1,800           |
| wikey-obsidian/styles.css      | 1개            | ~700             |
| scripts/audit-ingest.py        | 1개            | ~120             |
| **합계**                 | **22개** | **~4,820** |

65 tests passed, 빌드 0 errors.

### 3.14.5 코드 규모 (04-13 시점)

| 영역                           | 파일           | 라인 수          |
| ------------------------------ | -------------- | ---------------- |
| wikey-core/src (구현)          | 9개 (.ts)      | ~1,650           |
| wikey-core/src/__tests__ | 5개 (.test.ts) | ~600             |
| wikey-obsidian/src             | 6개 (.ts)      | ~1,950           |
| wikey-obsidian/styles.css      | 1개            | ~700             |
| scripts/audit-ingest.py        | 1개            | ~120             |
| **합계**                 | **22개** | **~5,020** |

65 tests passed, 빌드 0 errors.

---

### 3.14.6 코드 규모 (04-14 갱신)

| 영역                           | 파일           | 라인 수          |
| ------------------------------ | -------------- | ---------------- |
| wikey-core/src (구현)          | 9개 (.ts)      | ~1,500           |
| wikey-core/src/__tests__ | 5개 (.test.ts) | ~600             |
| wikey-obsidian/src             | 6개 (.ts)      | ~2,990           |
| wikey-obsidian/styles.css      | 1개            | ~1,260           |
| scripts/audit-ingest.py        | 1개            | ~150             |
| **합계**                 | **22개** | **~6,500** |

65 tests passed, 빌드 0 errors.

---

### 3.14.7 커밋 7건

| 커밋        | 내용                                                                                |
| ----------- | ----------------------------------------------------------------------------------- |
| `92c9637` | fix(ingest): OCR fallback + 4 race/UX 이슈 수정                                     |
| `7809d8f` | docs: Phase 3 Obsidian E2E 테스트 결과 (`activity/phase-3-resultx-3.B-test-results.md` 291줄) |
| `0421d7c` | config(wikey): default 모델 (basic=gemini, ollama=qwen3.6:35b-a3b)                  |
| `79a458e` | wiki: E2E 인제스트 아티팩트 + 자동 정리                                             |
| `ef63156` | refactor(ingest-prompt): 단일 프롬프트 모델 + 모달 편집 UI                          |
| `786983d` | fix(ingest): log.md 헤더 형식                                                       |
| `741040c` | ui(sidebar): 헤더 탭 순서 + 대시보드 hint 아이콘                                    |
| `6630a3c` | docs(plan): Phase 3 잔여 정리 + 이번 세션 follow-up 추가                            |

### 3.14.8 코드 규모 (04-18 갱신)

| 영역                           | 파일           | 라인 수                                                      |
| ------------------------------ | -------------- | ------------------------------------------------------------ |
| wikey-core/src (구현)          | 9개 (.ts)      | ~1,560 (+60: 로깅, OCR fallback, BUNDLED_INGEST_PROMPT)      |
| wikey-core/src/__tests__ | 5개 (.test.ts) | ~620 (+20: loadEffectiveIngestPrompt 3 tests)                |
| wikey-obsidian/src             | 6개 (.ts)      | ~3,090 (+100: 모달, race fix, env hasMarkitdownOcr, 탭 순서) |
| wikey-obsidian/styles.css      | 1개            | ~1,304 (+44: 모달 스타일)                                    |
| scripts/audit-ingest.py        | 1개            | ~150                                                         |
| **합계**                 | **22개** | **~6,724**                                             |

**테스트**: 70/70 pass (65 → 70, +5 tests).
**빌드**: 0 errors.

### 3.14.9 완료 커밋 12건

| #  | 해시        | 카테고리 | 제목                                                              | 변경량              |
| -- | ----------- | -------- | ----------------------------------------------------------------- | ------------------- |
| 1  | `f597133` | lint     | Phase 3 E2E 인제스트 중복 제거 + slug 정규화                      | 23 files, +80/−280 |
| 2  | `fb0a471` | feat     | UI 재설계 + provider resolver + updateIndex 카테고리 분기         | 30 files, +834/−83 |
| 3  | `f93b061` | fix      | I2 로컬 타임존 + I3 classify 2차 서브폴더                         | 4 files, +142/−18  |
| 4  | `dc4d30c` | feat     | Dewey Decimal 자연계 3차 분류 + setup-para-folders.sh             | 4 files, +256/−34  |
| 5  | `b9b5339` | docs     | 세션 정리 (중간) — 계획/메모 동기화                              | 3 files, +102/−7   |
| 6  | `08990c1` | fix      | Default Model 섹션에 Model 필드 추가                              | 1 file, +25/−5     |
| 7  | `cc94cfe` | refactor | API 동적 Model 로드 +`.wikey-select` 통일 + Re-detect 위치 이동 | 2 files, +224/−124 |
| 8  | `8da2045` | style    | 외곽 테두리 제거 + chevron `#999`→`#bbb`                     | 1 file, +2/−2      |
| 9  | `468564e` | style    | box-shadow/outline 제거 (focus/hover)                             | 1 file, +8/−0      |
| 10 | `64cf969` | docs     | UI 폴리싱 4 커밋 반영                                             | 1 file, +14/−2     |
| 11 | `3db253f` | refactor | `provider-defaults.ts` 단일 소스 도입 + gemini-flash 동급 통일  | 9 files, +93/−29   |

### 3.14.10 코드 규모 (04-19 갱신)

| 영역                           | 파일                               | 라인 수                                                                                            |
| ------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| wikey-core/src (구현)          | 10개 (.ts, provider-defaults 신규) | ~1,750 (+190: OCR resolver, tokenize classify, updateIndex 카테고리, Dewey DEWEY, formatLocalDate) |
| wikey-core/src/__tests__ | 6개 (.test.ts, classify.test 신규) | ~850 (+230: Dewey 테스트, updateIndex 카테고리 테스트, formatLocalDate)                            |
| wikey-obsidian/src             | 6개 (.ts)                          | ~3,400 (+310: Auto Ingest, OCR 설정, Default Model 드롭다운, fail state TTL, 동적 modelList)       |
| wikey-obsidian/styles.css      | 1개                                | ~1,360 (+56: drop-header, section-header, select border/shadow 제거)                               |
| scripts/setup-para-folders.sh  | 1개 (신규)                         | ~72                                                                                                |
| **합계**                 | **24개**                     | **~7,432**                                                                                   |

**테스트**: 95/95 pass (+25 tests vs 04-18 세션).
**빌드**: 0 errors.

### 3.14.11 코드 규모 (04-19 저녁 갱신)

| 영역                           | 파일                                       | 라인 수          |
| ------------------------------ | ------------------------------------------ | ---------------- |
| wikey-core/src (구현)          | 12개 (.ts, schema·canonicalizer 신규)     | ~2,200 (+450)    |
| wikey-core/src/__tests__ | 8개 (.test.ts, schema·canonicalizer 신규) | ~1,250 (+400)    |
| wikey-obsidian/src             | 8개 (.ts, ingest-modals 추가)              | ~3,800 (+400)    |
| wikey-obsidian/styles.css      | 1개                                        | ~1,940 (+580)    |
| **합계**                 | **29개**                             | **~9,190** |

**테스트**: 95 → **143** pass (+48 tests).
**빌드**: 0 errors.

### 3.14.12 코드 규모 (04-20 갱신)

| 영역                           | 파일                                   |   라인 수 (변화) |
| ------------------------------ | -------------------------------------- | ---------------: |
| wikey-core/src                 | 13개 (.ts)                             |    ~2,400 (+200) |
| wikey-core/src/__tests__ | 8개 (.test.ts)                         |    ~1,400 (+150) |
| wikey-obsidian/src             | 8개 (.ts)                              |     ~3,810 (+10) |
| scripts                        | +1 (measure-determinism.sh, 351 lines) |             +351 |
| **합계**                 | **30개 + 1 script**              | **~9,711** |

**테스트**: 143 → **159 pass** (+16 — 7 wiki/ guard, 5 model filter/sort, 4 schema anti-pattern).
**빌드**: 0 errors.

---

## 3.15 Phase 4 이관 + Phase 3 종료 선언
> tag: #docs, #architecture

### 3.15.1 Phase 3 잔여 (다음 세션)

`plan/phase-3-todo.md` §B-1 (3건) + §B-2 (3건) — 6건 검증/결정 항목.

- §B-1: Audit 패널 UI E2E / 인제스트 품질 리뷰 / 사람 눈 UI 평가
- §B-2: markitdown-ocr 실 스캔 PDF / 단일 프롬프트 override 경로 / wiki/ 가드 결정

---

### 3.15.2 Phase 4 이관 항목 (이번 세션 신규)

`plan/phase-4-todo.md` §4-4b 추가 — **LLM 기반 3차/4차 분류**:

- Dewey Decimal 매칭 실패 시 LLM이 파일명 + 미리보기로 대분류 선택 (`000_general` 안전 배치)
- LLM이 제품 4차 폴더명 slug 추출 (`Kyosho-Mini-Z/`, `DJI-O3-Air-Unit/` 등) + 신규 폴더 생성
- Audit 패널 "Re-classify with LLM" 토글
- 사용자 분류 수정 시 `raw/CLASSIFY.md` 피드백 로그 + few-shot 예시로 반영
- classify 전용 저가 모델(`gemini-2.0-flash-lite` 등) 지정 가능

### 3.15.3 발견한 follow-up (다음 세션 이후 처리)

- **`.ingest-map.json` stale 항목**: `nanovna-v2-notes.md` 삭제 후에도 map에 남음. 인덱스 갱신 시 검증 로직 필요.
- **raw/ 파일 이동 추적 + wiki/ 참조 sync (Phase 4 §4-4c)**:
  - 2026-04-19 세션 증거: Raspberry Pi HQ Camera 파일 3회 이동(`inbox → 3_resources → 3_resources/30_manual → 3_resources/30_manual/500_technology`) 중 `.ingest-map.json` 0회 갱신 → stale key 발견
  - 원인: 현재 아키텍처가 파일 경로 → wiki 페이지 매핑 → PARA 이동 가정과 충돌
  - 복구: 세션 종반에 수동 rewrite (`raw/3_resources//Raspberry_Pi_...pdf` → `raw/3_resources/30_manual/500_technology/Raspberry_Pi_...pdf`)
  - 근본 해결: `vault.on('rename')` 훅, source 페이지 original_path 자동 sync, URI 기반 안정 참조, PARA 적합성 RFC
- **Query 파이프라인 ollama-우선 로직 재검토**: `ollamaAvailable` 체크 시 basicModel이 cloud여도 ollama 시도 → `basicModel`이 cloud면 cloud 사용하도록 개편.
- **`wikey.conf` user override**: `WIKEY_DEFAULT_GEMINI_MODEL=gemini-2.5-pro` 같은 ENV로 provider-defaults override 가능하게 config 파서 확장.
- **Chat cloudModel vs Default Model cloudModel coupling 정리**: 두 UI가 같은 필드 공유 → 의도치 않은 동기화 가능성.
- **Dewey Decimal 세션 내 2회 번호 재조정 이력**:
  - 1차(dc4d30c): 임의 번호(000/100/.../900) 간소화
  - 2차(이번 세션 종반): DDC 원본 표준 번호로 정렬 (000 Computer / 500 Science / 600 Technology / 700 Arts)
  - CLASSIFY.md 표 동기화 + classify.ts DEWEY 테이블 재매핑 + 테스트 기대값 조정

### 3.15.4 Phase 3 잔여 (다음 세션)

`plan/phase-3-todo.md` §B-1 #1/#3 + §B-2 #4/#5/#6 — **5건** (B-1 #2 완료).

- **§B-1 #1**: Audit 패널 인제스트 E2E — UI 재설계 후 재검증
- **§B-1 #3**: Obsidian UI 수동 테스트 — 재설계분 사람 눈 평가
- **§B-2 #4**: markitdown-ocr fallback 완주 검증 — OCR 트리거는 관찰됨, 전체 완주 미검증
- **§B-2 #5**: `.wikey/ingest_prompt_user.md` override 경로 E2E
- **§B-2 #6**: wiki/ 폴더 인제스트 가드 도입 결정

---

### 3.15.5 다음 세션 잔여

`plan/session-wrap-followups.md`의 "2026-04-19 저녁 마감 → 다음 세션 시작점" 섹션 참조.

핵심:

- 🔴 다른 inbox 파일(OMRON) 인제스트로 audit auto-move PARA 추가 검증
- 🟡 v6 결정성 다른 입력에서 일관성 확인
- 🟢 v7 후보 7건 (schema 경계 명확화, anti-pattern 추가, contextual chunk, std dev 자동 측정, schema yaml override, pro 모델 옵션, lint 세션)

---

### 3.15.6 Phase 4로 이관된 항목

Phase 3 완료 시점에 열어둔 항목 → `plan/phase-4-todo.md` 로 이관:

1. **v7-3 Anthropic-style contextual chunk 재작성** — 검색 인덱스 전처리, 재현율 개선 (큰 스코프)
2. brief generation + ingest OCR 중복 제거 (캐싱) — 14.2 발견
3. canonicalize에 stripBrokenWikilinks 자동 적용 (source_page) — 14.5 발견
4. Stage 2/3 프롬프트 사용자 override 지원 — 14.3 발견
5. OCR API 키 process listing 노출 제거 (env/stdin 전환) — 14.2 발견
6. ~~measure-determinism.sh 안정성 보강 + v7 결정성 재측정~~ — **2026-04-21 Phase 3 내 완료** (§3.6.6). 수동 CDP 드라이브로 5/5 성공, Concepts CV 33.4→21.2% (-37%), Total CV 16.9→7.9% (-53%). 스크립트의 selector 패치(apply/cancel 양쪽 매칭)만 Phase 4 §4.5.1로 이관

### 3.15.7 Phase 3 종료 선언

모든 §B/§C 항목 종료. v7-3만 Phase 4로 이관. 다음 세션부터 `plan/phase-4-todo.md` 진행
