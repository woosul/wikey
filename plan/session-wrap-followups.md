# 다음 세션 후속 작업

> 최신 갱신: 2026-04-18 (Phase 3 E2E 자동 실행 + 이슈 4건 수정 + 단일 프롬프트 리팩토링)
> 생성일: 2026-04-10

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
