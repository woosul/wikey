# Phase 3 구현 계획 — Wikey Obsidian 플러그인

> 작성일: 2026-04-12
> 상태: **구현 진행 중** — Step 0~6 완료, 잔여 작업 있음
> 전제: Phase 2 완료 (필수 7/7, 중요 6/6)
> 참조: plan/phase3-todo.md (체크리스트), activity/phase-3-result.md (결과)
> 리뷰: CEO (SELECTIVE EXPANSION) + Eng 완료

## 1. 요구사항 재정의

### 목표

현재 CLI 전용(bash/python 스크립트 + LLM 세션)인 wikey 시스템에 Obsidian 플러그인을 추가하여, 터미널 없이도 지식 관리의 핵심 워크플로우(쿼리, 인제스트, 설정)를 수행할 수 있게 해요.

### MVP 기능 (Phase 3-2)

| 기능 | 설명 |
|------|------|
| **사이드바 채팅** | 질문 입력 → qmd 검색 + LLM 합성 → 위키링크 클릭 가능한 답변 |
| **인제스트 커맨드** | 현재 노트/선택 파일을 Cmd+Shift+I로 인제스트 (wiki/ 페이지 자동 생성) |
| **설정 탭** | BASIC_MODEL 드롭다운, API 키 입력, Ollama 연결 확인 |
| **상태 바** | "29 pages indexed | $21.13/50" 실시간 표시 |

### 연기 기능 (v2)

드래그앤드롭 inbox, 자동 인제스트(file watch), 인라인 린트, 비용 대시보드

### 제약 조건

- qmd는 이미 TypeScript (`tools/qmd/`)이므로 직접 import 가능
- 한국어 형태소 분석(kiwipiepy)은 Python exec 유지 (TS 포팅 불가)
- Contextual Retrieval은 Gemma 4 (Ollama localhost:11434) exec 유지
- Obsidian 플러그인 환경은 Node.js + Electron (`child_process` 사용 가능)
- 기존 CLI 워크플로우는 그대로 유지해야 해요
- 데스크톱 전용 (`isDesktopOnly: true`)

---

## 2. 아키텍처 개요

### 전체 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                     Obsidian (Electron)                          │
│                                                                   │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────┐   │
│  │ sidebar-chat │   │  commands.ts │   │  settings-tab.ts   │   │
│  │  (View)      │   │  Cmd+Shift+I │   │  BASIC_MODEL, Keys │   │
│  └──────┬───────┘   └──────┬───────┘   └────────┬───────────┘   │
│         │                  │                     │               │
│         ▼                  ▼                     ▼               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    wikey-core/                           │    │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐   │    │
│  │  │query-pipeline│  │ingest-pipeline│  │  config.ts   │   │    │
│  │  │   .ts       │  │   .ts        │  │              │   │    │
│  │  └──────┬──────┘  └──────┬───────┘  └──────────────┘   │    │
│  │         │                │                               │    │
│  │  ┌──────▼──────┐  ┌─────▼──────┐                        │    │
│  │  │ llm-client  │  │  wiki-ops  │                        │    │
│  │  │   .ts       │  │   .ts      │                        │    │
│  │  └──────┬──────┘  └─────┬──────┘                        │    │
│  └─────────┼───────────────┼───────────────────────────────┘    │
│            │               │                                     │
└────────────┼───────────────┼─────────────────────────────────────┘
             │               │
    ┌────────▼────┐   ┌──────▼──────┐
    │ LLM APIs    │   │ Vault FS    │
    │ Gemini      │   │ wiki/*.md   │
    │ Anthropic   │   │ raw/*.md    │
    │ OpenAI      │   │ index.md    │
    │ Ollama      │   │ log.md      │
    └─────────────┘   └─────────────┘
             │
    ┌────────▼────────┐
    │ qmd             │
    │ (CLI exec MVP,  │
    │  SDK import v2) │
    └─────────────────┘
```

### 쿼리 파이프라인 상세 흐름

```
사용자 → [채팅 입력]
         │
         ▼
  sidebar-chat.ts
         │
         ▼ query-pipeline.query(question)
  ┌─────────────────────────────┐
  │  1. qmd 검색                │
  │     MVP: exec('qmd query')  │
  │     v2:  qmdStore.search()  │
  │                             │
  │  2. 검색 결과 취합           │
  │     Top-N 문서 + 스니펫      │
  │                             │
  │  3. LLM 합성 (llm-client)   │
  │     프롬프트: 검색 결과 +    │
  │     질문 → 위키링크 답변     │
  └─────────────┬───────────────┘
                │
                ▼
  sidebar-chat.ts → 마크다운 렌더링
  (위키링크 클릭 → Obsidian 내부 링크 이동)
```

### 인제스트 파이프라인 상세 흐름

```
사용자 → [Cmd+Shift+I]
         │
         ▼
  commands.ts → ingest-pipeline.ingest(filePath)
  ┌─────────────────────────────────┐
  │  1. 소스 파일 읽기 (Vault.read)  │
  │  2. 기존 index.md 읽기          │
  │  3. LLM 호출 (llm-client)       │
  │     프롬프트: llm-ingest.sh의   │
  │     build_ingest_prompt() 동일  │
  │  4. JSON 응답 파싱              │
  │  5. wiki-ops로 파일 생성/수정   │
  │  6. index.md, log.md 갱신       │
  │  7. reindex 트리거 (exec)       │
  └─────────────────────────────────┘
         │
         ▼
  Notice("인제스트 완료: 3개 페이지 생성")
```

---

## 3. 핵심 추상화 설계

### 3-A: httpClient 추상화

wikey-core는 HTTP 클라이언트를 주입받아요 (Obsidian 의존성 제거):

```typescript
interface HttpClient {
  request(url: string, opts: RequestOptions): Promise<Response>
}
// Obsidian: requestUrl() 래퍼
// CLI/테스트: fetch() 래퍼
```

### 3-B: WikiFS 추상화

파일시스템 접근을 인터페이스로 분리:

```typescript
interface WikiFS {
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  exists(path: string): Promise<boolean>
  list(dir: string): Promise<string[]>
}
// Obsidian: Vault API 래퍼
// CLI/테스트: Node.js fs 래퍼
```

### 3-C: 설정 동기화

Obsidian `data.json` ↔ `wikey.conf` 양방향 동기화. 진실의 원천은 `wikey.conf` 유지.

---

## 4. 단계별 구현 계획

### Phase 3-0: 프로젝트 스캐폴딩 (1일)

**생성할 구조**:

```
wikey/
├── package.json            ← 루트: npm workspaces 설정
├── wikey-core/
│   ├── package.json        ← name: "wikey-core", type: "module"
│   ├── tsconfig.json       ← strict, ESM, target: ES2022
│   └── src/
│       ├── index.ts        ← re-export
│       ├── types.ts        ← WikiPage, IngestResult, QueryResult
│       ├── config.ts       ← 빈 셸
│       ├── llm-client.ts   ← 빈 셸
│       ├── wiki-ops.ts     ← 빈 셸
│       ├── ingest-pipeline.ts ← 빈 셸
│       └── query-pipeline.ts  ← 빈 셸
│
├── wikey-obsidian/
│   ├── package.json        ← depends: wikey-core (workspace)
│   ├── tsconfig.json
│   ├── manifest.json       ← Obsidian 플러그인 메타
│   ├── esbuild.config.mjs  ← 번들러 (Obsidian 표준)
│   ├── styles.css
│   └── src/
│       ├── main.ts         ← Plugin 엔트리
│       ├── sidebar-chat.ts ← 빈 셸
│       ├── settings-tab.ts ← 빈 셸
│       ├── status-bar.ts   ← 빈 셸
│       └── commands.ts     ← 빈 셸
```

**의사결정**:

| 항목 | 결정 | 이유 |
|------|------|------|
| 모노레포 도구 | npm workspaces | pnpm/turborepo는 오버킬 |
| 번들러 | esbuild | Obsidian 커뮤니티 플러그인 표준 |
| TS target | ES2022 | Electron 기반, 최신 문법 지원 |
| qmd 통합 | MVP: CLI exec → v2: SDK import | better-sqlite3 네이티브 모듈 이슈 회피 |

**완료 기준**: `npm run build` → `wikey-obsidian/main.js` 생성, Obsidian에서 빈 플러그인 로드 성공

---

### Phase 3-1: wikey-core 구현 (3~4일)

bash/python 스크립트의 핵심 로직을 TypeScript로 포팅. TDD 진행.

#### 3-1-A: config.ts (0.5일)

- 포팅 원본: `local-llm/wikey.conf` + `llm-api.sh`의 `_llm_load_config()`
- wikey.conf INI 파싱 (key=value, `#` 주석)
- 환경변수 오버라이드 (env > conf > 기본값)
- `.env` 파일 로드 (dotenv 호환)
- `resolveProvider()` 로직 포팅
- 의존성: 없음

#### 3-1-B: llm-client.ts (1일)

- 포팅 원본: `scripts/lib/llm-api.sh`의 4개 프로바이더 함수
- 프로바이더별 분기: Gemini, Anthropic, OpenAI, Ollama
- httpClient 주입 패턴 (Obsidian `requestUrl()` vs `fetch()`)
- MVP: non-streaming → Ollama 스트리밍 우선 지원
- 의존성: config.ts

#### 3-1-C: wiki-ops.ts (0.5일)

- 포팅 원본: `llm-ingest.sh`의 `apply_ingest_result()` 파일 생성 로직
- WikiFS 인터페이스 + Obsidian/Node.js 구현체
- 페이지 CRUD, index.md 갱신, log.md 추가
- 위키링크 추출/검증 유틸리티
- 의존성: types.ts

#### 3-1-D: query-pipeline.ts (1일)

- 포팅 원본: `local-llm/wikey-query.sh` 전체
- qmd 검색 (MVP: CLI exec)
- 한국어 형태소 전처리 (Python exec — `korean-tokenize.py --mode query`)
- 검색 결과 + LLM 합성 프롬프트 (wikey-query.sh 프롬프트 그대로)
- 의존성: config.ts, llm-client.ts

#### 3-1-E: ingest-pipeline.ts (1일)

- 포팅 원본: `scripts/llm-ingest.sh` 전체
- 소스 읽기 (마크다운만, PDF는 v2)
- `build_ingest_prompt()` 동일 프롬프트
- LLM → JSON 파싱 (```json 블록 추출 + 재시도)
- wiki-ops로 파일 생성/수정
- reindex 트리거 (exec `reindex.sh --quick`)
- 의존성: config.ts, llm-client.ts, wiki-ops.ts

---

### Phase 3-2: Obsidian 플러그인 MVP (1~1.5주)

#### 3-2-A: main.ts + 기본 구조 (0.5일)

- `WikeyPlugin extends Plugin` 엔트리
- `onload()`: 리본 아이콘, 커맨드, 설정 탭, 뷰, 상태 바 등록
- Obsidian Vault → WikiFS 어댑터 구현
- Obsidian requestUrl → HttpClient 어댑터 구현

#### 3-2-B: settings-tab.ts (0.5일)

- BASIC_MODEL 드롭다운 (`claude-code | gemini | codex | ollama`)
- API 키 입력 (비밀번호 마스킹)
- Ollama URL + 연결 테스트 버튼
- qmd 바이너리 경로 (자동 탐지 + 수동 설정)
- 비용 한도 설정
- 저장: Obsidian data.json + wikey.conf 양방향 동기화

#### 3-2-C: sidebar-chat.ts (3~4일) — MVP 핵심

- `ItemView` 기반 사이드바 패널
- 채팅 UI: 메시지 목록 + 입력 필드
- query-pipeline 호출 → 응답 표시
- Obsidian `MarkdownRenderer.renderMarkdown()` 사용
- 위키링크 클릭 → `app.workspace.openLinkText()` 호출
- 세션 내 대화 유지, 로딩 인디케이터, 에러 표시

```
┌─────────────────────────────┐
│  🔍 Wikey                   │  ← 헤더
├─────────────────────────────┤
│  Q: ESC와 FC의 차이점은?     │
│  A: ESC(전자변속기)와...     │
│  참고: [[esc]], [[fc]]      │  ← 클릭 가능
├─────────────────────────────┤
│  [질문을 입력하세요...]  [↩] │
└─────────────────────────────┘
```

#### 3-2-D: commands.ts — 인제스트 (1일)

- `Cmd+Shift+I`: 현재 열린 노트 인제스트
- 커맨드 팔레트: "Wikey: Ingest current note", "Wikey: Ingest file..."
- 진행/완료/실패 Notice 표시
- ingest-pipeline 호출

#### 3-2-E: status-bar.ts (0.5일)

- "📚 29 pages" (wiki/ 내 .md 수)
- "$21.13/50" (cost-tracker.sh exec)
- 클릭 시 상세 모달
- 5분 주기 또는 인제스트 완료 시 갱신

---

### Phase 3-3: 통합 테스트 + 마무리 (2~3일)

#### 3-3-A: E2E 테스트 (1일)

- 설정 → Ollama 연결 테스트
- 채팅 → 질문/답변 왕복
- 인제스트 → wiki/ 파일 생성 확인
- 위키링크 클릭 → 파일 열림
- 상태 바 숫자 정확성

#### 3-3-B: 에러 케이스 (1일)

- API 키 미설정 → 설정 탭 안내
- Ollama 미실행 → 안내 메시지
- qmd 바이너리 없음 → 설치 가이드
- 네트워크 오류 → 재시도
- LLM JSON 파싱 실패 → 원본 응답 표시

#### 3-3-C: 배포 준비 (0.5일)

- manifest.json 완성
- `.obsidian/plugins/wikey/` 심볼릭 링크 (개발 모드)
- `.gitignore` 업데이트

---

## 5. 의존성 그래프

```
Phase 3-0: 스캐폴딩
    │
    ▼
Phase 3-1-A: config.ts ─────────────────────────────┐
    │                                                 │
    ├──▶ Phase 3-1-B: llm-client.ts                  │
    │         │                                       │
    │         ├──▶ Phase 3-1-D: query-pipeline.ts     │
    │         │                                       │
    │         └──▶ Phase 3-1-E: ingest-pipeline.ts ◀──┤
    │                    │                            │
    │                    ▼                            │
    │         Phase 3-1-C: wiki-ops.ts ───────────────┘
    │
    ▼
Phase 3-2-A: main.ts (모든 core 모듈 필요)
    │
    ├──▶ 3-2-B: settings (병렬 가능)
    ├──▶ 3-2-C: sidebar-chat (병렬 가능)
    ├──▶ 3-2-D: commands (병렬 가능)
    └──▶ 3-2-E: status-bar (병렬 가능)

    ▼
Phase 3-3: 통합 테스트 + 마무리
```

---

## 6. 리스크 분석

### HIGH

| 리스크 | 완화 |
|--------|------|
| better-sqlite3 네이티브 모듈 — qmd SDK import 시 Electron ABI mismatch | MVP: CLI exec 유지. v2에서 wasm 또는 Electron rebuild 검토 |
| LLM JSON 파싱 불안정 — bash에서도 빈번 실패 | JSON 추출 강화 + 구조화 출력 API (Gemini/OpenAI) 활용 |
| Obsidian 마켓플레이스 보안 리뷰 — child_process, API 키 저장 | 초기 수동 설치 (BRAT), 리뷰 기준 사전 확인 |

### MEDIUM

| 리스크 | 완화 |
|--------|------|
| child_process 모바일 미지원 | `isDesktopOnly: true` 명시 |
| qmd CLI 경로 — 사용자마다 다름 | 설정 탭 + 자동 탐지 (which, 프로젝트 내 탐색) |
| 스트리밍 형식 불균일 | MVP: non-streaming 우선, Ollama 스트리밍만 지원 |
| 한국어 kiwipiepy 미설치 | "한국어 강화" 토글, graceful fallback |

### LOW

| 리스크 | 완화 |
|--------|------|
| Obsidian API 변경 | minAppVersion 명시, 릴리스 노트 모니터링 |
| wikey.conf ↔ settings 동기화 충돌 | 플러그인 활성화 시 wikey.conf 재로드 |

---

## 7. 작업량 예상

| 모듈 | 예상 라인 | 복잡도 | 소요 |
|------|----------|--------|------|
| config.ts | 120 | 낮음 | 0.5일 |
| llm-client.ts | 300 | 높음 | 1일 |
| wiki-ops.ts | 200 | 중간 | 0.5일 |
| query-pipeline.ts | 250 | 높음 | 1일 |
| ingest-pipeline.ts | 300 | 높음 | 1일 |
| types.ts | 80 | 낮음 | 포함 |
| main.ts | 100 | 중간 | 0.5일 |
| sidebar-chat.ts | 400 | 높음 | 3~4일 |
| settings-tab.ts | 200 | 중간 | 0.5일 |
| status-bar.ts | 80 | 낮음 | 0.5일 |
| commands.ts | 120 | 중간 | 1일 |
| 테스트 | 600+ | - | 분산 |
| **합계** | **~2,750** | | **~11~14일** |

---

## 8. 일정 요약

```
Week 1:  스캐폴딩 + wikey-core 전체
  Day 1:  Phase 3-0 스캐폴딩
  Day 2:  3-1-A config.ts + 3-1-C wiki-ops.ts (병렬)
  Day 3:  3-1-B llm-client.ts
  Day 4:  3-1-D query-pipeline.ts
  Day 5:  3-1-E ingest-pipeline.ts

Week 2:  Obsidian 플러그인 MVP
  Day 6:  3-2-A main.ts + 3-2-B settings-tab.ts
  Day 7:  3-2-C sidebar-chat.ts (시작)
  Day 8:  3-2-C sidebar-chat.ts (계속)
  Day 9:  3-2-C sidebar-chat.ts (완성) + 3-2-E status-bar.ts
  Day 10: 3-2-D commands.ts

Week 3:  통합 테스트 + 마무리
  Day 11: 3-3-A E2E 테스트
  Day 12: 3-3-B 에러 케이스 + 3-3-C 배포 준비
  Day 13: 버퍼 (예상 못한 이슈)
  Day 14: 최종 검증 + Git 태깅
```

---

## 9. 성공 기준 (검증 가능한 증거)

| 기준 | 검증 방법 |
|------|----------|
| 플러그인 로드 | Obsidian 설정 > 커뮤니티 플러그인에 "Wikey" 표시 |
| 설정 저장/로드 | 재시작 후 API 키 유지 |
| Ollama 연결 | "연결 확인" 버튼 → 초록 체크마크 |
| 채팅 질문/답변 | "ESC란?" → 위키 기반 답변 + [[esc]] 링크 |
| 위키링크 클릭 | [[esc]] 클릭 → wiki/entities/esc.md 열림 |
| 인제스트 | Cmd+Shift+I → wiki/sources/ 파일 생성 |
| 상태 바 | "29 pages indexed" 숫자 정확 |
| 기존 CLI | `wikey-query.sh "ESC"` 동일 결과 |
| 테스트 | `npm test` — 0 failures |

---

## 10. ADR 연계

이전 세션에서 확정된 아키텍처 결정과의 정합성:

| ADR | Phase 3 반영 |
|-----|-------------|
| ADR-001: Obsidian 중심 | Obsidian 플러그인이 첫 번째 GUI |
| ADR-003: 마크다운 = 데이터 모델 | WikiFS 추상화로 Vault API 직접 접근 |
| ADR-005: BYOAI | 4개 프로바이더 (Gemini/Anthropic/OpenAI/Ollama) 지원 |
| ADR-007: LLM 다층 검색 | qmd(검색) + LLM(합성) 분리 구조 유지 |

---

---

## 11. CEO 리뷰 결과

> 모드: SELECTIVE EXPANSION — 현재 범위 유지 + 가치 높은 추가 요소 선별

### 전제 검증

- **전제 유효**: Obsidian → 터미널 → Obsidian 컨텍스트 스위칭 제거가 올바른 문제
- **타이밍 적절**: Phase 2 검색 인프라(qmd + 한국어) 완성 → GUI를 얹을 기반 갖춰짐

### 대안 비교

| 접근 | effort | 판정 |
|------|--------|------|
| A. wikey-core + wikey-obsidian (현재) | 11~14일 | **채택** — Phase 4 웹 재사용 가치 |
| B. Obsidian 전용 (코어 분리 없이) | 7~9일 | 기각 — Phase 4에서 코드 중복 |
| C. CLI 래퍼 (thin shell) | 3~4일 | 기각 — UX 제한 |

### 범위 조정

**추가 채택 (+0.8일)**:
1. Obsidian URI 프로토콜 (`obsidian://wikey?query=ESC`) — Alfred/Raycast 연동
2. 인제스트 진행률 단계 표시 ("1/4 소스 읽기 → 2/4 LLM 호출...")

**명시적 제외**: 드래그앤드롭, 자동 인제스트, PDF 인제스트 — 모두 v2

### 추상화 최소화 원칙

Obsidian용 구현체만 먼저. CLI/웹용 WikiFS, HttpClient 구현체는 Phase 4에서 필요 시 추가.

---

## 12. Eng 리뷰 결과

### HIGH 이슈 (3건)

| # | 이슈 | 해결 | 추가 일정 |
|---|------|------|----------|
| H1 | 인제스트 프롬프트 DRY — bash와 TS 이중 관리 | 프롬프트를 `wikey-core/src/prompts/ingest.txt`로 분리 | +0.5일 |
| H2 | child_process 셸 주입 — 쿼리가 셸 인자로 전달 | `execFile()` 사용 (셸 미개입) | +0.2일 |
| H3 | qmd DB 동시 접근 — CLI exec과 qmd SDK 병행 시 | WAL 모드 확인 + 읽기 전용이므로 잠금 없음 | +0.1일 |

### MEDIUM 이슈 (4건)

| # | 이슈 | 해결 |
|---|------|------|
| M1 | Obsidian Sync API 키 노출 | 설정 탭에 경고 문구 |
| M2 | wiki-ops 경로 검증 누락 | `wiki/` 프리픽스 하드체크 |
| M3 | wikey.conf 동시 수정 경쟁 | 활성화 시 재로드 + 원자적 쓰기 |
| M4 | cost-tracker.sh 미존재 시 에러 | graceful fallback |

### 엣지 케이스 커버리지

- 쿼리: 8건 (qmd 미설치, DB 비어있음, Ollama 미실행, API 키 누락, 응답 지연, 형태소 미설치, 빈 결과, 동시 쿼리)
- 인제스트: 6건 (raw/ 외부 파일, 재인제스트, JSON 파싱 실패, 중단, 대용량, Vault 외부)
- UI: 4건 (없는 위키링크, 리사이즈, 다크모드, 뒤로가기)

### 테스트 전략

- wikey-core: vitest 단위 테스트 (19 케이스)
- Obsidian 플러그인: 수동 테스트 (6 시나리오)

### 성능

병목은 LLM 응답 대기(2~15초)뿐. qmd exec 오버헤드(~200ms)는 무시 가능.

### 보안 권장

1. `execFile()` 사용 (셸 이스케이프 불필요)
2. wiki-ops 경로 검증 (`wiki/` 프리픽스)
3. Obsidian Sync 경고 문구
4. wikey.conf 원자적 쓰기

---

## 13. 최종 일정 (리뷰 반영)

CEO 추가 (+0.8일) + Eng HIGH 이슈 (+0.8일) 반영:

```
총 예상: 13~16일 (기존 11~14일 + 리뷰 반영 +2일)

Week 1:  스캐폴딩 + wikey-core
  Day 1:  3-0 스캐폴딩 + 프롬프트 파일 분리 (H1)
  Day 2:  3-1-A config.ts + 3-1-C wiki-ops.ts (경로 검증 M2 포함)
  Day 3:  3-1-B llm-client.ts (execFile H2 포함)
  Day 4:  3-1-D query-pipeline.ts
  Day 5:  3-1-E ingest-pipeline.ts (진행률 표시 포함)

Week 2:  Obsidian 플러그인 MVP
  Day 6:  3-2-A main.ts + 3-2-B settings-tab.ts (Sync 경고 M1 포함)
  Day 7:  3-2-C sidebar-chat.ts (시작)
  Day 8:  3-2-C sidebar-chat.ts (계속)
  Day 9:  3-2-C sidebar-chat.ts (완성) + 3-2-E status-bar.ts (M4 포함)
  Day 10: 3-2-D commands.ts + URI 프로토콜

Week 3:  통합 테스트 + 마무리
  Day 11: 단위 테스트 (vitest 19 케이스)
  Day 12: 수동 통합 테스트 (6 시나리오)
  Day 13: 에러 케이스 + 배포 준비
  Day 14: 버퍼
```

---

## 14. 향후 확장 (Phase 3 이후)

| 항목 | Phase | 설명 |
|------|-------|------|
| qmd SDK import | 3.5 | better-sqlite3-wasm 또는 Electron rebuild |
| 인라인 린트 | 3.5 | EditorView 데코레이션 |
| 비용 대시보드 | 3.5 | 모달/뷰로 월별 차트 |
| 웹 인터페이스 | 4 | Next.js + wikey-core 재사용 |
| 마켓플레이스 등록 | 4 | 보안 리뷰 통과 후 |

---

## 15. 구현 과정 변경 사항 (계획 대비 실제)

> 이 절은 계획(1~14절)과 실제 구현의 차이를 기록한다.

### 15-1. 추가 구현 (계획에 없었으나 구현)

| 항목 | 이유 | 결과 |
|------|------|------|
| env-detect.ts | Obsidian Electron의 PATH/node ABI 문제 | 로그인 셸 PATH 탐지 + ABI 호환 node 자동 선택 |
| PDF 인제스트 | inbox에 PDF만 있어서 급히 필요 | pdftotext→pymupdf→PyPDF2 3단계 fallback |
| classify.ts | classify-inbox.sh 분류 규칙 TS 포팅 | 확장자/구조 기반 분류 힌트 |
| scripts-runner.ts | validate/pii/reindex/cost-tracker exec 래퍼 | bash 스크립트 Obsidian에서 호출 가능 |
| UI 고도화 (Step 4~5) | 사용자 피드백 반영 | purple 테마, 피드백, 인제스트 패널, 프로그레스바 |
| inbox 감시 | Finder에서 직접 파일 추가 감지 | vault.on('create') 이벤트 |
| Node.js http 직접 호출 | Obsidian requestUrl의 localhost CORS | Ollama 호출 경로 분리 |

### 15-2. 변경 (계획과 다르게 구현)

| 계획 | 실제 | 이유 |
|------|------|------|
| qmd CLI exec 유지 | node + qmd.js 직접 실행 | Electron node ABI mismatch (better-sqlite3) |
| wikey.conf ↔ data.json 양방향 동기화 | data.json 단독 사용 | 동시 수정 경쟁 회피, v2로 연기 |
| 드래그앤드롭 inbox (v2 연기) | MVP에서 구현 | 사용자 요청으로 즉시 구현 |
| Phase 3-3 배포 (BRAT, 태그) | 잔여 작업으로 이동 | 기능 검증 우선 |
| `workspace:*` (pnpm) | `"*"` (npm) | npm workspaces 호환 |

### 15-3. 연기 (계획에 있었으나 미구현)

| 항목 | 이유 | 대안 |
|------|------|------|
| qmd SDK import | 난이도 높음 (better-sqlite3 ABI) | Phase 3 마지막 또는 Phase 4 연기 |
| bash→TS 완전 포팅 | Phase 3 마지막 작업으로 이동 | exec 래퍼 안정 동작 중 |

### 15-3b. 연기 해제 → 구현 완료

| 항목 | 구현 방식 | 상태 |
|------|----------|------|
| 대화 히스토리 영구 저장 | settings 토글 + data.json 저장 (최대 100건, 디바운스 2초) | **완료** |
| Sync 경고 → 설정 통합 | credentials.json으로 API 키 통합, syncProtection 제거 | **완료** |
| BRAT 배포 + v0.1.0-alpha 태그 | versions.json + GitHub Actions + git tag | **완료** |
| H3: qmd 동시 접근 | busy_timeout=5000 추가 | **완료** |
| M3: 설정 파일 통합 | wikey.conf 단일 소스 + credentials.json 공유 | **완료** |

### 15-4. 발견된 Obsidian Electron 제약 (계획에 미예측)

| 제약 | 영향 | 해결 |
|------|------|------|
| `import('node:*')` CORS 차단 | 모든 동적 import 실패 | `require()` 전환 |
| Electron PATH 최소화 | nvm/homebrew node 미포함 | 로그인 셸 PATH 탐지 |
| Electron node ≠ 시스템 node | better-sqlite3 ABI mismatch | ABI 호환 node 자동 선택 |
| `requestUrl()` localhost CORS | Ollama 호출 실패 | Node.js http 모듈 직접 호출 |
| Vault API가 .gitignore 폴더 미반환 | raw/0_inbox/ 목록 안 보임 | Node.js fs 직접 읽기 |

### 15-5. 잔여 작업 (Phase 3 마지막, A→B→C 순서)

**A. 테스트 + 검증 (우선):**
- Audit 패널 인제스트 세부 테스트 (다양한 PDF, 에러 케이스)
- 인제스트 품질 검증 (생성된 wiki 페이지 내용 리뷰)
- Obsidian UI 수동 테스트 (대시보드, audit, 모델 선택 등)

**B. 운영 안정성 (A 완료 후):**
- 로컬 LLM 모델 검증: Gemma4 12B 최적성, Gemma4 27B/Qwen3/Llama 4 대안 조사
- 원본/위키 삭제 안전장치: 출처 무효화 감지, 깨진 링크 정리, dry-run, 삭제 이력
- 초기화 기능: 완전/인제스트/원본/인덱스/설정 선택적 리셋 + 확인 다이얼로그

**C. 완전 통합 (B 완료 후):**
- bash→TS 완전 포팅 (validate-wiki, check-pii, cost-tracker, reindex)
- qmd SDK import (선택)
