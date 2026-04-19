# Phase 3: Todo List — Obsidian 플러그인 (wikey-core + wikey-obsidian)

> 기간: 2026-04-12 ~
> 상태: **진행 중** (Step 0~6 완료, Must/Should 완료, Could 3/5 완료, Eng H3+M3 완료)
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

### 선택 (Could) — 3/3 완료 (qmd SDK import는 Phase 4로 이관)

- [x] **대화 히스토리 영구 저장** — settings 토글, 최대 100건, 디바운스 2초
- [x] **Obsidian Sync 경고 → 설정 통합으로 해소** — API 키가 항상 credentials.json에 저장, data.json에 미포함
- [x] **BRAT 배포 + v0.1.0-alpha 태그** — versions.json + GitHub Actions + 태그 갱신

> qmd SDK import, CLI script → TS 완전 포팅은 Phase 4 §4-6으로 이관됨.

### Phase 3 마지막 작업

**A. 테스트 + 검증 (우선)**

- [x] UI 영문 전환 — dashboard, audit, inbox, settings, help 전체
- [x] Dashboard 숫자 통일 — audit 기반 Raw Sources (ingested/total per PARA folder)
- [x] Audit 패널 UI 개편 — 상단 상태, 하단 provider+model+Ingest/Cancel+Delay
- [x] Inbox UI 개편 — checkbox + Move(auto-ingest) + Delay
- [x] 설정 Ingest Model 섹션 추가 — provider + model 기본값
- [x] 로컬 LLM 모델 평가 — qwen3:8b(최적), gemma4:26b(차선), supergemma4(탈락)
- [x] Ollama think 파라미터 처리 — Gemma=think:true, Qwen3=think:false
- [x] jsonMode 옵션 추가 — Qwen3 format:"json", Gemma 프롬프트 기반
- [x] LLM 타임아웃 60s → 300s

> 잔여 검증 항목은 §B로 통합 (중복 제거)

**A-1. 인제스트 파이프라인 개선 (Graphify 분석 결과 수용)**

- [x] **MarkItDown 전처리** — PDF→md 변환 (MarkItDown→pdftotext→pymupdf fallback)
- [x] **Graphify-style 챕터 분할** — 12K+ 문서는 ## 헤더 기준 분할 → 순차 추출 → 병합
  - Step A: 전체 요약 → source_page (로컬: truncate, 클라우드: full text)
  - Step B: 챕터별 → entities + concepts 추출
  - Step C: 중복 제거 후 병합
- [x] **maxOutputTokens 65K** — Gemini finishReason:MAX_TOKENS 문제 해결
- [x] **Gemini 에러 처리** — finishReason/candidates 없는 경우 상세 에러 메시지
- [x] **LLM 파일명 경로 strip** — LLM이 wiki/entities/x.md 반환 시 자동 정리
- [x] **프롬프트 파일 분리** — 2026-04-18 완료
  - `wikey-core/src/prompts/ingest_prompt_basic.md` (시스템, 번들 불변) + `<vault>/.wikey/ingest_prompt_user.md` (사용자 편집, 선택)
  - `loadUserPrompt()` 로더 + `USER_PROMPT_TEMPLATE` export + HTML 주석 자동 제거
  - 설정 탭 Ingest Prompt 섹션: Create & Edit / Reset 버튼, 파일 상태 표시
  - `buildIngestPrompt()` 시그니처에 `userPrompt` 파라미터 추가 (chunked 파이프라인에도 전달)
  - 신규 테스트 5건 (65→70 tests passed)

> **A-2 항목은 Phase 4로 이동 → `plan/phase4-todo.md`**

**B. Phase 3 잔여 (다음 세션)**

- [x] **로컬 LLM 모델 검증** — qwen3:8b(인제스트 기본), gemma4:26b(쿼리 전용) 확정
  - Gemma4 26B 인제스트: 32min, 5E+3C — **인제스트 제외** (thinking 오버헤드 + 한국어 약함)
  - Gemma4 26B는 쿼리/채팅 전용으로만 유지
- [x] **Qwen3 14B 테스트** — 2026-04-18 smoke test 완료 → **탈락**
  - 3K chunk: 42.0s, 4E+5C (qwen3:8b 22.3s, 5E+5C 대비 2배 느리고 entity 적음)
  - `ollama rm qwen3:14b` 실행 (9.3GB 해제)
- [x] **Qwen3.6:35b-a3b 평가** — 2026-04-18 smoke test 완료 → **인제스트 옵션 추가**
  - 3K chunk: 42.6s, 5E+5C, **가장 풍부한 description** (수치 + 고수준 개념 정확 추출)
  - MoE 35B/3B active → 14B dense와 동일 시간에 더 높은 품질
  - 한국어 도메인 용어 처리 우수 (ROHM, 절연 파괴 전계, 200V, 10배 등)
  - **메모리 부담**: 27GB VRAM, M4 Pro 48GB 기준 loaded 시 47G/48G 사용 (114MB 여유)
  - 인제스트 전용 (상시 로드 비권장), 32K ctx 기본 유지 (262K 확장 시 RAM 부족)
- [x] **Qwen3.6:35b-a3b E2E 테스트** — 2026-04-18 완료 → **Qwen3 8B 대비 압도**
  - 74KB 텍스트 (pdftotext), 10 chunks, 총 **7.6분**, **30E + 50C = 80 페이지**
  - 이전 결과 대비: Qwen3 8B (17분, 27E+26C=53), Gemini (10분, 46E+170C=216)
  - **속도 2.2배 우위** + **품질 1.5배** (concepts granularity 현저히 우수)
  - 도메인 특수 용어 포착: 4H-SiC, Trench 구조 MOSFET, dV/dt 파괴, 단락 내량, 바디 다이오드
  - 인제스트 권장 모델 업그레이드 검토 가능 (메모리 여유 확인된 환경 한정)
### B-1. Phase 3 원래 잔여 (검증 필요)

- [x] **Audit 패널 인제스트 E2E** — 2026-04-19 저녁 세션 v6 검증으로 완료 (커밋 77e9c9d)
  - audit panel [Ingest] 버튼으로 PMS PDF 6회 인제스트 + Approve & Write 검증
  - audit panel auto-move PARA 추가: 인제스트 후 raw/0_inbox/ → classifyFileAsync로 PARA 자동 라우팅
- [x] **인제스트 품질 검증** — 생성된 wiki 페이지 내용 리뷰 (2026-04-19 완료, 커밋 f597133)
  - 중복 13건 제거 (entity-/concept- 접두어 변형) + slug 정규화 (SiC-* → sic-*)
  - canonical 병합: nanovna-v2, architecture-decision-records
  - 원인 기록: Scenario 4 custom 프롬프트가 기본 프롬프트와 slug 규칙 충돌
- [ ] **Obsidian UI 수동 테스트** — 사람 눈 평가
  - 대시보드 숫자/카드 시각
  - Audit 패널 체크박스 + provider/model 선택
  - Ingest 패널 재설계 (drop header + Add + filesize + Cloud/Local + Ingest 버튼)
  - Settings: Auto Ingest toggle/interval + OCR Provider/Model
  - Fail state 10분 TTL 보존 확인

### B-2. 2026-04-18 E2E 세션 후속 (이번 세션 발생분)

- [ ] **markitdown-ocr fallback E2E** — 실제 스캔 PDF (텍스트 레이어 없는 이미지 PDF)로 OCR 경로 검증
  - 코드 경로만 확인됨 (textPDF는 1단계 markitdown으로 처리되어 OCR fallback 미발동)
  - Ollama gemma4:26b vision 호출 + extract 품질 평가
- [ ] **단일 프롬프트 모델 override E2E** — `.wikey/ingest_prompt.md` 작성 시 custom 경로 정상 동작 검증
  - Smoke test는 bundled default 경로만 검증
  - 단위 테스트 15건은 통과
- [ ] **이슈 5 결정**: wiki/ 폴더 인제스트 가드 도입 여부 (현재 가드 없음 → wiki→wiki 사이클 위험, `activity/phase-3-test-results.md` 참조)

### B-3. 2026-04-19 chunk 프롬프트 보정 검증 (신규)

- [x] **PMS 재인제스트 v2~v6 실행** — 2026-04-19 저녁 세션 v6 완료 (커밋 77e9c9d)
  - v2~v5 진동 (35→102) → **v6 = 22~38 (CV 16.9%, 76% 축소)**
  - 한국어/UI/business/op 라벨 **0건** (schema-guided + anti-pattern 차단)
  - 업계 표준 100% 보존, 약어 자동 풀네임 통합 (pmbok/erp/wbs/bom/scm/mes/plm/aps)
  - log/index 등재율 **100%** (Phase A writtenPages 결정적 backfill)
  - 처리 시간 평균 290s (v5 525s 대비 -45%)
  - 상세 결과 → `activity/ingest-comparison/README.md` v6 섹션
- [x] **chunk step index/log 누락 수정** — 2026-04-19 저녁 세션 v6 Phase A로 해결 (커밋 77e9c9d)
  - `wiki-ops.ts` updateIndex/appendLog가 writtenPages 받아 결정적 backfill
  - LLM 누락분 자동 보충 + 3-stage pipeline에서 chunk → mention → canonicalize로 분리
  - 추가 fix: stripBrokenWikilinks (LLM dropped 항목 자동 정리)
  - v2 테스트 결과가 양호하면 (UI 라벨 제거로 자연히 해소) 별도 수정 불필요할 수도

### C. 2026-04-19 저녁 세션 (v6 인제스트 코어 재설계) 후속

#### C-1. 다음 세션 즉시 작업 (3건)

- [ ] **🔴 OMRON inbox 파일 인제스트로 audit auto-move PARA 추가 검증**
  - `raw/0_inbox/OMRON_HEM-7156T-AP_*.pdf` (49.6MB), `OMRON_HEM-7600T.pdf` 남음
  - audit panel [Ingest] → classifyFileAsync 자동 라우팅 + moveFile + ingest-map 갱신 확인
  - 큰 PDF의 markitdown-ocr fallback E2E와 동시 테스트 가능 (B-2 #4와 통합)
- [ ] **🟡 v6 결정성 다른 입력에서 일관성 확인**
  - 사업자등록증 등 다른 소스로 5회 std dev 측정 → CV 비교
  - PMS와 유사한 안정성 (Total CV 16.9%, Entities CV 14.7%) 재현되는지 확인
- [ ] **🟡 Lint 세션 — wiki 정리**
  - 이번 세션 인제스트로 작성된 페이지들 중복/품질 검토
  - log.md `, ,` cosmetic 잔존 (이전 인제스트 시점) 정리
  - validate-wiki.sh 실행 (현재 PASS)

#### C-2. v7 후속 (인제스트 안정화 보강, 6건)

- [ ] **[v7-1] schema에 `methodology` vs `document_type` 경계 명확화**
  - 현재 Concepts CV 33.4% (5중 9~25 진동) — canonicalizer LLM이 같은 mention을 다르게 분류
  - schema.ts 타입 설명 (CONCEPT_TYPE_DESCRIPTIONS) 보강 + canonicalizer 프롬프트에 분류 결정 트리 추가
  - 목표: Concepts CV ~15% 이하
- [ ] **[v7-2] anti-pattern에 운영 항목 추가 발굴**
  - 인제스트 누적 중 새 회피 패턴 발견 시 schema.ts OPERATIONAL_ITEMS 또는 정규식 접미사에 추가
  - 현재 차단: 한국어 / X-management/-service/-support / business object / *-list/-report/-form
- [ ] **[v7-3] Anthropic-style contextual chunk 재작성 (검색 재현율 개선)**
  - 현재 wikey의 Gemma 4 contextual prefix는 생성 단계 프롬프트 보강용
  - Anthropic 의도: chunk를 재작성해 embedding/BM25 인덱스에 반영 (retrieval 전처리)
  - 인제스트와 별개로 검색 재현율 개선 효과 측정
  - 참조: <https://www.anthropic.com/engineering/contextual-retrieval>
- [ ] **[v7-4] 5회 std dev 자동 측정 → activity 로그 (회귀 감지 자동화)**
  - 현재 `/tmp/v6-determinism.py` 같은 ad-hoc 스크립트로 측정
  - `scripts/measure-determinism.sh` 신규 또는 cost-tracker 확장
  - activity/determinism-log.md에 기록 → CI 통합 가능
- [ ] **[v7-5] schema yaml 사용자 override (`.wikey/schema.yaml`)**
  - Phase D는 표시만 (활성 스키마 라인) — 편집 미구현
  - schema.ts에 loadSchemaOverride() 추가, 사용자 정의 entity/concept 타입 허용
  - 기본 7개 타입 + 사용자 추가 N개 = 합산 schema
- [ ] **[v7-6] Pro 모델 (`gemini-3.1-pro-preview`) 옵션 노출**
  - 1회 시험: total=24, e=16, c=7, 220s — Concept을 매우 보수적으로 분류 (-68%)
  - 사용자가 "정확/엄격 분류" 원할 때 Audit/Ingest 패널 model select에서 선택 가능
  - settings.ingestModel + UI dropdown에 추가

> **운영 안정성, 완전 통합, llama.cpp PoC는 Phase 4로 이동 → `plan/phase4-todo.md`**

---

## Eng 리뷰 이슈 추적

| # | 이슈 | 상태 |
|---|------|------|
| H1 | 인제스트 프롬프트 DRY | **완료** |
| H2 | child_process 셸 주입 (execFile) | **완료** |
| H3 | qmd DB 동시 접근 | **완료** (busy_timeout=5000 추가) |
| M1 | Obsidian Sync API 키 경고 | **완료** |
| M2 | wiki-ops 경로 검증 | **완료** |
| M3 | 설정 파일 통합 | **완료** (wikey.conf 단일 소스 + credentials.json) |
| M4 | cost-tracker.sh fallback | **완료** |

## CEO 추가 항목

| 항목 | 상태 |
|------|------|
| Obsidian URI 프로토콜 | **완료** |
| 인제스트 진행률 단계 표시 | **완료** (파일별 프로그레스바) |
