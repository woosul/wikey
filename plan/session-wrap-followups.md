# 다음 세션 후속 작업

> 최신 갱신: 2026-04-19 (UI 재설계 + provider/classify 근본 수정 + Dewey Decimal 3차 분류)
> 생성일: 2026-04-10

---

## 2026-04-19 (UI 재설계 + 근본 수정 세션) 마감

### ⭐ 다음 세션 핵심 작업

**Phase 3 B-1 잔여**:
1. **[#1] Audit 패널 인제스트 E2E** — 이번 세션은 Ingest 패널로 우회. Audit 패널(👁 아이콘) 체크박스→Ingest 클릭 흐름 검증 필요
2. **[#3] Obsidian UI 수동 테스트** — UI 재설계 변경분(header 없음, Add 버튼, Cloud/Local 뱃지, Auto Ingest 토글, OCR 설정) 사람 눈 평가
3. **[B-2 #4] markitdown-ocr fallback E2E** — 이번 세션에 OMRON 스캔 PDF에서 OCR 경로 발동 관찰됨 (gemma4:26b vision). 작은 스캔 PDF로 완주 검증 필요
4. **[B-2 #5] `.wikey/ingest_prompt_user.md` override E2E**
5. **[B-2 #6] wiki/ 폴더 인제스트 가드 도입 결정**

### 이번 세션 완료 (커밋 9개)

- `f597133` **lint**: Phase 3 E2E 중복 13건 제거 + slug 정규화 (23 files, +80/−280)
- `fb0a471` **feat(ingest)**: UI 재설계 + provider resolver + updateIndex 카테고리 분기 (30 files, +834/−83)
- `f93b061` **fix(ingest)**: I2 로컬 타임존 + I3 classify 2차 서브폴더 (4 files, +142/−18)
- `dc4d30c` **feat(classify)**: Dewey Decimal 자연계 3차 분류 + setup-para-folders.sh (4 files, +256/−34)
- `b9b5339` **docs**: 세션 정리 — 계획/메모 동기화 (3 files, +102/−7)
- `08990c1` **fix(settings)**: Default Model 섹션에 Model 필드 추가
- `cc94cfe` **refactor(settings)**: API 동적 Model 로드 + `.wikey-select` 통일 + Re-detect 위치 이동
- `8da2045` **style(select)**: 외곽 테두리 제거 + chevron #999→#bbb (밝게)
- `468564e` **style(select)**: box-shadow/outline 제거 (focus/hover 포함)

### 이번 세션 주요 변경

**UI 재설계 (Ingest 패널)**
- 상단 bulk 3버튼 제거 → drop zone + `[Add]` + inbox 섹션 통합
- inbox 행: filename + filesize + Cloud/Local 뱃지
- 하단 바: `[PARA select] [Ingest] [Delay]` (Move → Ingest로 교체)
- Fail state 10분 TTL 보존 (renderInboxStatus 재렌더 간)

**자동 Ingest**
- Settings: `autoIngest` toggle + interval (0/10/30/60s)
- `vault.on('create')` → debounce → 자동 `runIngest`

**OCR/Provider resolver (근본 수정)**
- `isModelCompatible()` guard: qwen이 gemini로 전달되는 404 버그 예방
- Provider onChange 시 ingestModel + cloudModel 동시 clear
- `WIKEY_MODEL` fallback 제거 → wikey-core가 provider 기본값 선택
- **Default Model 섹션에 상세 Model 드롭다운 추가** (이전엔 Provider만 있어 PROVIDER_DEFAULTS 하드코딩 의존)
- **Default/Ingest Model 상세 모델 = API 동적 드롭다운** (`fetchModelList` 재사용, Gemini/OpenAI/Anthropic/Ollama 모두)
- OCR 전용 설정 (`ocrProvider`/`ocrModel`), 미설정 시 basicModel 상속
- `resolveOcrEndpoint()`: gemini/openai/ollama OpenAI-compat 자동 선택
- 5-tier PDF 추출 체크포인트 console.info/warn (silent fail 해소)

**설정 UI 폴리싱 (세션 후반)**
- 설정 패널 6 selects 모두 `.wikey-select` 통일 (Audit/Ingest 패널과 동일 chevron 스타일)
- Environment `Re-detect` 버튼 하단 → h3 헤더 우측 이동 (`.wikey-settings-section-header`)
- `.wikey-select`: border / box-shadow / outline 제거 + chevron `#999`→`#bbb` (밝게)

**classify 개편**
- Dewey Decimal 10개 대분류 (000_general~900_lifestyle)
- 토큰 기반 매칭 (regex `\b` → `tokenize + Set.has`로 `_` 경계 해소)
- PARA 경로 버그 fix: `raw/resources/` → `raw/3_resources/`
- `scripts/setup-para-folders.sh` 신규 (66개 폴더 사전 생성)

**updateIndex 카테고리 분기**
- 기존: 모든 항목이 "## 분석" 섹션으로만 append
- 수정: `{entry, category}` 객체 받아 엔티티/개념/소스/분석 섹션에 insert

**I2 로컬 타임존**
- `toISOString().slice(0,10)` → `formatLocalDate()` (getFullYear/Month/Date)
- KST 00~09시 UTC 날짜로 하루 뒤로 찍히는 버그 fix

### 검증 결과

- 단위 테스트: **95/95 PASS** (이전 65/70 → 95)
- 빌드: 0 errors
- validate-wiki.sh: PASS (5/5)
- E2E Raspberry Pi HQ Camera: 18 페이지 (source 1 + entities 9 + concepts 8) 생성 + index.md 카테고리별 정렬 검증
- OCR 경로 관찰: OMRON 6.3MB 스캔 PDF → markitdown-ocr + gemma4:26b vision 트리거 확인

### 발견 이슈/기록

- **OCR 하드코딩** `gemma4:26b` — 수정 완료 (resolveOcrEndpoint)
- **Silent fail** — UI에 fail 상태 2초 후 사라지는 UX 버그 → 10분 TTL로 수정
- **classify PARA 경로** — `raw/resources/` 하드코딩 (PARA 재구조화 누락) → 수정
- **Provider/model 불일치** — settings migration 없어 basicModel 변경 시 ingestModel stale → isModelCompatible guard + onChange clear
- **index.md updateIndex 버그** — 모든 신규 항목이 "분석" 섹션으로만 → 카테고리 분기
- **Date UTC 편향** — toISOString의 날짜 shift → formatLocalDate
- **`.ingest-map.json` stale 항목** — `nanovna-v2-notes.md` 삭제 후에도 남음 (follow-up)

### Phase 4 이관 (이번 세션 신규 추가)

- **§4-4b LLM 기반 3차/4차 분류** — Dewey Decimal 매칭 실패 시 LLM으로 대분류 선택 + 제품 4차 폴더 제안 + Audit 패널 "Re-classify with LLM" 토글 + 피드백 학습 + 저가 모델 옵션

### 기존 스킬 후보 (유지)

| ID | 후보 | 비고 |
|----|------|------|
| S1 | `obsidian-e2e-scaffold` 스킬 | obsidian-cli + Notice MutationObserver + Monitor 폴링 |
| S2 | `diagnostic-logger.ts` 유틸 | 파이프라인 단계별 console.info 헬퍼 |
| S4 | `wiki-validate-cleanup` 스킬 | validate-wiki.sh + audit-ingest.py 체이닝 |

### 이번 세션 신규 환경 변경

- `.claude/settings.local.json`: `Monitor`, `TaskStop` 자동 승인 추가
- Obsidian 실행: `--remote-debugging-port=9222 --remote-allow-origins=*` (CDP E2E용). 테스트 종료 후엔 일반 재시작 권장

---

## 2026-04-18 (E2E + 리팩토링 세션) 마감

### ⭐ 다음 세션 핵심 작업: Phase 3 잔여 검증

**파일**: `plan/phase3-todo.md` §B-1 + §B-2

#### B-1 Phase 3 원래 잔여
1. Audit 패널 인제스트 E2E (UI 클릭 흐름)
2. 인제스트 품질 검증 (16 entities + 12 concepts 신규 페이지 리뷰)
3. Obsidian UI 수동 테스트 (사람 눈 평가)

#### B-2 이번 세션 발생 follow-up
4. markitdown-ocr fallback E2E (실 스캔 PDF)
5. 단일 프롬프트 override 경로 E2E (`.wikey/ingest_prompt.md`)
6. wiki/ 폴더 인제스트 가드 도입 여부 결정

### 이번 세션 완료 (커밋됨, 7개)
- `92c9637` fix(ingest): OCR fallback + 4 이슈 수정 (race / logging / Ollama 404 / UI race)
- `7809d8f` docs: Phase 3 Obsidian E2E 테스트 결과 (`activity/phase-3-test-results.md`)
- `0421d7c` config(wikey): default 모델 변경 (basic=gemini, ollama=qwen3.6:35b-a3b)
- `79a458e` wiki: E2E 테스트 인제스트 아티팩트 + 자동 정리 (16E+12C)
- `ef63156` refactor(ingest-prompt): 단일 프롬프트 모델 + 모달 편집 UI
- `786983d` fix(ingest): log.md 헤더 형식 (`## [YYYY-MM-DD] ingest | <filename>`)
- `741040c` ui(sidebar): 헤더 탭 순서 (dashboard → ingest → audit → help) + 대시보드 hint eye 아이콘

### 이번 세션 검증 결과
- E2E 9 시나리오 (1, 2, 3, 3-1, 4, 4-1, 5a, 5b, 5c) 자동 실행
- PASS 6 (1/2/4/4-1/5a/5c) / PARTIAL 2 (3 silent skip, 5b 모호 메시지) / FAIL 1 (3-1 race)
- 발견 이슈 5건 → 4건 수정 + 회귀 검증 (이슈 5는 결정 보류)
- 단일 프롬프트 리팩토링 + 단위 70/70 + smoke test 통과
- 빌드 0 errors

### 스킬 후보 (다음 세션 또는 Phase 4에서 구현 결정)

| ID | 후보 | 비고 |
|----|------|------|
| S1 | `obsidian-e2e-scaffold` 스킬 | obsidian-cli + Notice MutationObserver + Monitor 폴링 패턴 자동화 (이번 세션 9회 반복) |
| S2 | `diagnostic-logger.ts` 유틸 | 파이프라인 단계별 console.info 헬퍼 + 누락 필드 warn (ingest-pipeline.ts에 적용한 패턴 재사용) |
| S4 | `wiki-validate-cleanup` 스킬 | validate-wiki.sh + audit-ingest.py 체이닝 + 자동 수정 (dupe 제거, 깨진 링크 변환, log 형식, index 등재) |

### 추가 follow-up (이번 세션 발견, plan/phase4-todo.md 또는 phase3-todo.md §B에 통합 예정)

| ID | 작업 | 우선 |
|----|------|------|
| F1 | wikey-obsidian 단위 테스트 (commands/sidebar/settings) | HIGH |
| F2 | `scripts/llm-ingest.sh` bash CLI 회귀 테스트 (4건 fix 동기화 또는 deprecate 결정) | MED |
| F4 | Scenario 3 (대규모 PDF + qwen3.6:35b-a3b) 재실행 — diagnostic 로깅으로 silent partial 원인 확정 | MED |

### Phase 4 이관 아이디어 (구현 X, 기록만)

- **model-benchmark.py** — Ollama × source × prompt 벤치 하니스 (이번 세션에 반복 작성한 /tmp/*.py 패턴 재사용 가능)
- **ollama-health.sh** — top PhysMem + /api/ps 메모리/VRAM 실시간 체크 헬퍼
- **prompt-baseline.py** — basic+user 프롬프트로 테스트 코퍼스 배치 실행 후 entity/concept counts diff

### 선택 문서 보강 (생략됨, 필요 시)
- `docs/getting-started.md` — Ingest Prompt 사용자 커스텀(A-1) 섹션 추가
- `local-llm/model-selection-guide.md` — Qwen3.6를 8B 업그레이드 경로로 명시
- `CLAUDE.md` — 플러그인 Ingest Model 설정 섹션 언급

---

## 과거 세션 (참고용)

> 생성일: 2026-04-10
> 이전 세션: wikey 프로젝트 초기 설정 + 계획 수립 (v2)

## 즉시 시작 (Step 1-3, Week 1)

### 1. [HIGH] Step 1: CLAUDE.md → wikey.schema.md 분리

CLAUDE.md(30KB, 모놀리식)를 분리:
- `wikey.schema.md` — 프로바이더 독립 마스터 스키마 (3계층 아키텍처, 워크플로우, 페이지 컨벤션, PII 규칙, LLM 다층 검색)
- `CLAUDE.md` — 경량화: "wikey.schema.md 읽으라" + Claude Code 도구 사용법
- `AGENTS.md` — "wikey.schema.md 읽으라" + Codex 특화 지시
- `local-llm/system-prompt.md` — 스키마 요약 + 로컬 LLM 제약

참고: `plan/phase1-todo.md` Step 1 (1-1 ~ 1-4)

### 2. [HIGH] Step 2: 디렉토리 구조 + Git 초기화

- wiki/index.md, log.md, overview.md 빈 템플릿 생성
- raw/, wiki/ 하위 디렉토리 생성 확인
- scripts/, local-llm/ 디렉토리 생성
- .gitignore 작성 (raw/, .DS_Store, *.gguf)
- `git init` + `gh repo create wikey --private --source=. --push`

### 3. [HIGH] Step 3: validate-wiki.sh + check-pii.sh + pre-commit hook

- 5가지 정합성 검증 (프론트매터, 위키링크, 인덱스 등재, 로그 형식, 중복)
- PII 패턴 스캐닝 (한국 전화번호, 이메일, 주민번호)
- Git pre-commit hook 연동

## 이후 (Step 4-7, Week 1-2)

### 4. [MEDIUM] Step 4: Claude Code로 첫 인제스트 5건

- llm-wiki.md, idea-comment.md를 raw/로 복사하여 소스 1-2로 사용
- 웹 기사 1건, 메모 1건, PDF 1건 (청킹 테스트)
- 20+ 위키 페이지 생성 목표

### 5. [MEDIUM] Step 5: 쿼리 워크플로우 검증 5건

- 사실·교차합성·분석·엔티티·빈결과 쿼리 각 1건

## 현재 프로젝트 상태 요약

- 파일: CLAUDE.md, llm-wiki.md, llm-wiki-kor.md, idea-comment.md, prompt_plan.md, plan/
- 미생성: wikey.schema.md, AGENTS.md, local-llm/, scripts/, .gitignore, Git
- wiki/, raw/: 빈 디렉토리 (콘텐츠 없음)
- 도구: Obsidian 1.12.7 + CLI 활성화, kepano/obsidian-skills 설치, Ollama 설치, Codex CLI 설치
