# Phase 3: Todo List — Obsidian 플러그인 (wikey-core + wikey-obsidian)

> 기간: 2026-04-12 ~
> 상태: **진행 중** (Phase 3-0~3-3 완료, Phase 3-4 UI 고도화 완료, 잔여 작업 있음)
> 전제: Phase 2 완료 (필수 7/7, 중요 6/6)
> 인프라: Ollama 0.20.5 + Gemma 4 (12B), qmd 2.1.0 (vendored), Node.js 22.17.0
> 핵심 계획: `prompt_plan.md`
> 결과: `activity/phase-3-result.md`

---

## Step 0: 프로젝트 스캐폴딩 — 완료

- [x] 루트 package.json + npm workspaces
- [x] wikey-core 스캐폴딩 (package.json, tsconfig, 소스 파일, prompts/ingest.txt)
- [x] wikey-obsidian 스캐폴딩 (package.json, tsconfig, manifest, esbuild)
- [x] 개발 환경 (.obsidian/plugins/wikey/ 심볼릭 링크, .gitignore)
- [x] `npm run build` 성공, Obsidian 로드 확인

---

## Step 1: wikey-core 구현 (TDD) — 완료

- [x] config.ts — INI 파싱, resolveProvider (23 tests)
- [x] llm-client.ts — Gemini/Anthropic/OpenAI/Ollama 4프로바이더 (13 tests)
- [x] wiki-ops.ts — createPage(경로검증 M2), updateIndex, appendLog, extractWikilinks (12 tests)
- [x] query-pipeline.ts — qmd exec, 한국어 전처리, 합성 프롬프트 (7 tests)
- [x] ingest-pipeline.ts — JSON 추출, 프롬프트 DRY H1, PDF 지원 (10 tests)
- [x] classify.ts — classify-hint.sh 분류 규칙 포팅
- [x] scripts-runner.ts — validate/pii/reindex/cost-tracker exec 래퍼

---

## Step 2: Obsidian 플러그인 MVP — 완료

- [x] main.ts — WikeyPlugin, ObsidianWikiFS, ObsidianHttpClient, 환경 자동 탐지
- [x] settings-tab.ts — 환경 상태 6항목, API 키 연결 테스트, 고급 LLM 설정
- [x] sidebar-chat.ts — 채팅 UI, query-pipeline 통합, 위키링크 클릭
- [x] commands.ts — Cmd+Shift+I 인제스트, URI 프로토콜
- [x] status-bar.ts — 페이지 수, 통계 모달
- [x] env-detect.ts — 로그인 셸 PATH 탐지, qmd ABI 호환 node 선택

---

## Step 3: 통합 테스트 + 디버깅 — 완료

- [x] 64→65 테스트 보강 (커버리지: config 96%, llm-client 97%, wiki-ops 96%)
- [x] Obsidian CORS 차단 해결 (dynamic import → require)
- [x] Electron PATH/node 탐지 (env-detect + ABI mismatch 자동 해결)
- [x] Ollama localhost 연결 (Node.js http 직접 호출)
- [x] qmd 경로 (basePath + wiki/ 접두사)
- [x] 합성 프롬프트 개선 (확정적 답변, 해요체)
- [x] 에러 진단 (단계별 메시지 + 콘솔 로깅)

---

## Step 4: UI 고도화 — 완료

- [x] 메시지 레이아웃 (Q/A 아이콘 삭제, 질문=배경블록 radius 8, 답변=전체너비)
- [x] 좌우 여백 0 (헤더~입력 전체)
- [x] 헤더 5개 plain icon ([+][?][🗑][↻][✕], hover=purple, active=purple bg+white)
- [x] 입력창 x1.5 + 전송 버튼 plain icon 중앙 정렬
- [x] 모델 태그 (purple, 0.92em)
- [x] 복사/좋아요/나빠요 피드백 (data.json 저장)
- [x] 텍스트 선택 가능 (user-select: text)
- [x] 테이블 스타일 (세로선 없음, 가로선 1px, 상하단 2px)
- [x] 도움말 [?] 인라인 (scrollIntoView)
- [x] Purple accent 테마

---

## Step 5: 인제스트 UI — 완료

- [x] [+] 버튼 → 인제스트 패널 (상단, 토글)
- [x] 3개 액션 버튼 (Add to inbox / Ingest / Add+Ingest)
- [x] 네이티브 파일 탐색기 (input type=file)
- [x] drag/drop → pending 파일 목록 (이름 + 크기)
- [x] inbox 상태 (Node.js fs 직접 읽기, 모든 파일 형식)
- [x] 파일별 프로그레스바 (2px, 단계별 진행률)
- [x] 인제스트 결과 요약 (생성 페이지 wikilink 클릭 가능)
- [x] inbox → _processed/ 자동 이동
- [x] inbox 파일 감시 (vault.on('create') + Notice)
- [x] PDF 인제스트 (pdftotext → pymupdf → PyPDF2 fallback)

---

## Step 6: CLI 스크립트 포팅 — 완료

- [x] classify.ts — 분류 규칙 엔진 (classify-hint.sh 포팅)
- [x] scripts-runner.ts — validate-wiki, check-pii, reindex, cost-tracker exec 래퍼

---

## 잔여 작업 — 이번 세션 완료분

### 필수 (Must) — 3/3 완료

- [x] **Obsidian 수동 통합 테스트** — 6 시나리오 프로그래매틱 검증 완료
- [x] **inbox PDF 인제스트 실제 테스트** — Raspberry Pi PDF E2E 성공 (7페이지 생성)
- [x] **상태 바 "0 pages" 수정** — onLayoutReady + vault 이벤트 debounced 갱신

### 중요 (Should) — 5/5 완료

- [x] **Summary 대시보드** — 헤더 [📊] 아이콘, wiki/raw 현황 + 태그 랭킹 + 미인제스트 통계
- [x] **classify → 서브폴더 이동 UI** — inbox 파일별 분류 힌트 + PARA 드롭다운 + 이동 버튼
- [x] **비용 추적 UI** — 설정 탭에 비용 요약 조회 버튼 + 결과 표시
- [x] **reindex 전체 실행 UI** — 설정 탭에 [인덱스 상태 확인] + [전체 인덱싱] 버튼
- [x] **validate/pii UI** — 설정 탭에 [위키 검증] [PII 스캔] 버튼

### 추가 구현 (이번 세션)

- [x] **Audit 패널** — 헤더 [👁] 아이콘, 미인제스트 문서 관리 (체크박스 선택/적용/보류)
  - 폴더 필터, 전체선택, 프로바이더 선택 (기본=basicModel)
  - 파일별 프로그레스바 (행 하단선 활용, stripe 애니메이션)
  - ingest-map.json 매핑 영속화 (재시작 시 정확한 상태)
  - 실패 파일 목록 유지 + 에러 메시지 표시
- [x] **헤더 아이콘 배타적 토글** — 하나만 활성, active 상태 표시
- [x] **패널 위치 통일** — 메시지 영역 상단 insertBefore
- [x] **헤더/입력 고정** — 스크롤 시 움직이지 않음
- [x] **클라우드 LLM 모델 선택** — API 동적 로드 + chevron UI
- [x] **Cross-lingual 검색** — 한국어 질문→영문 키워드 추출 + CR 프롬프트 bilingual 보강
- [x] **pdftotext PATH** — Electron 환경 homebrew 경로 보강
- [x] **inbox 우회 감지** — 시작 10초 grace + 배치 알림 (1건 요약)
- [x] **selectbox 통일** — .wikey-select chevron 스타일 전체 적용
- [x] **welcome 숨김** — 특수 패널 열릴 때 자동 숨김/복원
- [x] **audit-ingest.py** — raw/ 미인제스트 문서 감지 스크립트

### 선택 (Could) — 미착수

- [ ] **대화 히스토리 영구 저장** — 현재 세션 내만 유지
- [ ] **Obsidian Sync 경고 강화** — API 키 동기화 방지 옵션
- [ ] **qmd SDK import** — CLI exec 대신 직접 import (better-sqlite3 wasm)
- [ ] **BRAT 배포 테스트** — 수동 설치 가이드
- [ ] **v0.1.0-alpha Git 태그 갱신** — 현재 코드 기준

### 다음 세션 작업

- [ ] Audit 패널 인제스트 세부 테스트 (다양한 PDF, 에러 케이스)
- [ ] 인제스트 품질 검증 (생성된 wiki 페이지 내용 리뷰)
- [ ] Obsidian UI 수동 테스트 (대시보드, audit, 모델 선택 등)
- [ ] Could 항목 선택적 진행

---

## Eng 리뷰 이슈 추적

| # | 이슈 | 상태 |
|---|------|------|
| H1 | 인제스트 프롬프트 DRY | **완료** |
| H2 | child_process 셸 주입 (execFile) | **완료** |
| H3 | qmd DB 동시 접근 | CLI 병행 테스트에서 검증 예정 |
| M1 | Obsidian Sync API 키 경고 | **완료** |
| M2 | wiki-ops 경로 검증 | **완료** |
| M3 | wikey.conf 동시 수정 방지 | 연기 (data.json 단독 사용) |
| M4 | cost-tracker.sh fallback | **완료** |

## CEO 추가 항목

| 항목 | 상태 |
|------|------|
| Obsidian URI 프로토콜 | **완료** |
| 인제스트 진행률 단계 표시 | **완료** (파일별 프로그레스바) |
