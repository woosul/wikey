# Phase 1: Todo List — Zero-Setup 개인 위키 + BYOAI

> 기간: 2–3주
> 현재 상태: 스키마(CLAUDE.md) + 참조문서만 존재. 위키 콘텐츠·Git·스크립트 없음.
> Ollama, Codex CLI 설치 확인됨.

---

## Week 1: 기반 구축

### Step 1: 프로바이더 독립 스키마 설계

- [ ] **1-1.** 현재 `CLAUDE.md`에서 프로바이더 독립 내용을 `wikey.schema.md`로 분리
  - 3계층 아키텍처, 시스템 워크플로우, 디렉토리 구조
  - 원시 소스 관리 (추가/수정/삭제 절차)
  - 워크플로우 (인제스트/쿼리/린트) 상세 흐름
  - 페이지 컨벤션 (프론트매터, 네이밍, 위키링크, index.md/log.md 형식)
  - 핵심 원칙 5가지
  - 검색 확장 전략, LLM 다층 검색 아키텍처
  - PII 규칙
- [ ] **1-2.** `CLAUDE.md`를 경량화: `wikey.schema.md`를 읽으라는 지시 + Claude Code 특화 도구 사용법
  - Read, Write, Edit, Bash, Obsidian CLI 사용 패턴
  - Claude Code 세션에서의 인제스트/쿼리/린트 실행 방법
- [ ] **1-3.** `AGENTS.md` 작성: `wikey.schema.md`를 읽으라는 지시 + Codex CLI 특화 지시
  - Codex의 도구 사용법, 파일 접근 패턴
- [ ] **1-4.** `local-llm/system-prompt.md` 작성: `wikey.schema.md` 핵심 요약 + 로컬 LLM 제약 사항
  - 제한된 컨텍스트 대응 (요약된 스키마)
  - 읽기 전용 쿼리에 집중 (위키 수정은 클라우드 LLM에 위임)

### Step 2: 디렉토리 구조 + Git 초기화

- [ ] **2-1.** 위키 템플릿 파일 생성
  - `wiki/index.md` — 빈 카테고리 구조 (엔티티/개념/소스/분석)
  - `wiki/log.md` — 빈 로그 (`## [YYYY-MM-DD] type | title` 형식 안내)
  - `wiki/overview.md` — 빈 개요 ("아직 소스가 인제스트되지 않았습니다")
- [ ] **2-2.** 하위 디렉토리 확인 (이미 존재하는 것 체크)
  - `raw/articles/`, `raw/papers/`, `raw/notes/`, `raw/assets/`
  - `wiki/entities/`, `wiki/concepts/`, `wiki/sources/`, `wiki/analyses/`
  - `scripts/`
  - `local-llm/`
- [ ] **2-3.** `.gitignore` 생성
  ```
  raw/
  .obsidian/workspace.json
  .DS_Store
  local-llm/*.gguf
  local-llm/*.bin
  ```
- [ ] **2-4.** Git 초기화 + GitHub private 저장소 생성 + push
  ```bash
  git init
  git add .
  git commit -m "init: wikey project — LLM Wiki schema + Obsidian skills"
  gh repo create wikey --private --source=. --push
  ```

### Step 3: 위키 정합성 검증 스크립트

- [ ] **3-1.** `scripts/validate-wiki.sh` 작성
  - 검증 1: `wiki/` 내 모든 `.md` 파일에 YAML 프론트매터 존재 확인
  - 검증 2: 모든 `[[위키링크]]` 추출 → 대상 파일 존재 여부 확인
  - 검증 3: `wiki/entities/`, `wiki/concepts/`, `wiki/sources/`의 모든 파일이 `index.md`에 등재 확인
  - 검증 4: `log.md`의 각 항목이 `## [YYYY-MM-DD]` 형식 준수 확인
  - 검증 5: 중복 파일명 없음 확인
  - 종료 코드: 0=통과, 1=실패 (실패 항목 출력)
- [ ] **3-2.** `scripts/check-pii.sh` 작성
  - 한국 전화번호 패턴: `010-\d{4}-\d{4}`
  - 이메일 패턴: `\S+@\S+\.\S+`
  - 주민번호 패턴: `\d{6}-[1-4]\d{6}`
  - `wiki/` 디렉토리를 스캔, 발견 시 경고 출력
- [ ] **3-3.** Git pre-commit hook 설정
  ```bash
  # .git/hooks/pre-commit
  #!/bin/sh
  ./scripts/validate-wiki.sh && ./scripts/check-pii.sh
  ```
  - 두 스크립트 모두 통과해야 커밋 허용

---

## Week 1-2: 워크플로우 검증

### Step 4: Claude Code로 인제스트 검증 (5건)

- [ ] **4-1.** 테스트 소스 준비 — `raw/articles/`에 5개 파일 추가
  - 소스 1: `llm-wiki.md` 원문 (이미 존재, raw로 복사)
  - 소스 2: GeekNews 기사 내용 (idea-comment.md에서 원문 발췌)
  - 소스 3: 웹 기사 1건 (Obsidian Web Clipper 또는 URL 전달)
  - 소스 4: 개인 메모/노트 1건
  - 소스 5: PDF 또는 긴 문서 1건 (청킹 테스트용, 20p+)
- [ ] **4-2.** 소스 1 인제스트 (llm-wiki.md)
  - Claude Code에 지시: "raw/articles/llm-wiki.md를 인제스트해줘"
  - 확인: source 페이지 생성, 엔티티/개념 페이지 생성, index.md 갱신, log.md 항목
  - `validate-wiki.sh` 실행 → 통과 확인
  - Git 커밋
- [ ] **4-3.** 소스 2 인제스트 (GeekNews 기사)
  - 기존 위키 페이지가 올바르게 업데이트되는지 확인 (교차참조 추가)
  - 멱등성 확인: 같은 소스 재인제스트 시 중복 생성 안 되는지
- [ ] **4-4.** 소스 3 인제스트 (웹 기사)
- [ ] **4-5.** 소스 4 인제스트 (개인 메모)
- [ ] **4-6.** 소스 5 인제스트 (대용량 PDF — 청킹 테스트)
  - 20p+ 소스를 섹션별 분할 → 중간 노트 → 합성 패스 흐름 확인
- [ ] **4-7.** 인제스트 결과 검증
  - 20개 이상 위키 페이지가 생성되었는지 확인
  - Obsidian Graph View에서 상호연결 구조 확인 (스크린샷)
  - log.md에 5건 인제스트 기록 + 토큰 사용량 기록

### Step 5: 쿼리 워크플로우 검증 (5건)

- [ ] **5-1.** 단순 사실 쿼리: "LLM Wiki의 3계층 아키텍처를 설명해줘"
  - LLM이 index.md에서 관련 페이지를 찾고, 내용을 읽고, 인용과 함께 답변하는지 확인
- [ ] **5-2.** 교차 문서 합성 쿼리: "Karpathy의 LLM Wiki와 커뮤니티 반응을 비교해줘"
  - 여러 소스에서 정보를 종합하는지 확인
- [ ] **5-3.** 분석 쿼리: "LLM Wiki의 가장 큰 리스크는 무엇인가?"
  - 답변이 wiki/analyses/에 저장되는 흐름 확인
- [ ] **5-4.** 엔티티 쿼리: "Andrej Karpathy에 대해 알려줘"
- [ ] **5-5.** 빈 결과 쿼리: "양자 컴퓨팅에 대해 알려줘" (위키에 없는 주제)
  - "해당 주제의 소스가 없습니다" 류의 적절한 응답 확인

### Step 6: 린트 워크플로우 검증

- [ ] **6-1.** 의도적 결함 생성
  - 고아 페이지: `wiki/concepts/orphan-test.md` 생성 (다른 페이지에서 링크 안 함)
  - 깨진 위키링크: 기존 페이지에 `[[존재하지-않는-페이지]]` 추가
  - 인덱스 누락: 새 페이지를 만들되 index.md에 등재하지 않음
- [ ] **6-2.** 증분 린트 실행: "최근 변경된 페이지만 린트해줘"
  - git diff 기반으로 변경 페이지만 점검하는지 확인
- [ ] **6-3.** 전체 린트 실행: "위키 전체를 린트해줘"
  - 위 3가지 의도적 결함을 모두 감지하는지 확인
- [ ] **6-4.** 린트 결과 반영
  - 사용자 승인 후 LLM이 결함을 수정하는지 확인
  - log.md에 lint 항목 기록

### Step 7: Obsidian CLI 연계 검증

- [ ] **7-1.** Obsidian 앱에서 CLI 활성화 확인
  - `obsidian vault=wikey help` 동작 확인 (이미 완료)
- [ ] **7-2.** 주요 CLI 명령 테스트
  ```bash
  obsidian vault=wikey search query="LLM Wiki"
  obsidian vault=wikey read file="index"
  obsidian vault=wikey backlinks file="overview"
  obsidian vault=wikey tags sort=count counts
  obsidian vault=wikey property:set name="updated" value="2026-04-10" file="overview"
  ```
- [ ] **7-3.** CLAUDE.md에 CLI 활용 패턴 반영 확인
  - 인제스트 시 `obsidian search`로 기존 페이지 확인
  - `obsidian backlinks`로 영향 범위 파악

---

## Week 2-3: BYOAI + 로컬 LLM + 배포 준비

### Step 8: BYOAI 검증 — Codex CLI

- [ ] **8-1.** Codex CLI에서 wikey 디렉토리 접근 확인
  ```bash
  codex -C /Users/denny/Project/wikey "AGENTS.md를 읽고 내용을 요약해줘"
  ```
- [ ] **8-2.** Codex로 인제스트 1건 실행
  - 새 소스를 `raw/`에 추가 후 Codex에 인제스트 지시
  - Codex가 `wikey.schema.md` + `AGENTS.md`를 읽고 올바른 워크플로우를 따르는지 확인
- [ ] **8-3.** 일관성 검증
  - Claude Code가 만든 위키에 Codex가 새 페이지를 추가한 후:
    - 프론트매터 형식이 동일한가?
    - 위키링크 규칙을 따르는가?
    - index.md 갱신 형식이 일관적인가?
    - log.md 항목 형식이 일관적인가?
  - `validate-wiki.sh` 통과 확인
- [ ] **8-4.** Codex 독립 린트 (교차 검증)
  - Claude Code가 인제스트한 위키를 Codex에게 린트 요청
  - Claude와 다른 시각에서 문제를 발견하는지 확인

### Step 9: Gemma 4 로컬 LLM 셋업

- [ ] **9-1.** Ollama에 Gemma 4 모델 설치
  ```bash
  ollama pull gemma3   # 또는 gemma4 (가용 모델 확인)
  ```
- [ ] **9-2.** 로컬 모델 위키 쿼리 테스트
  ```bash
  cat wiki/index.md | ollama run gemma3 "이 인덱스를 읽고, LLM Wiki의 핵심 개념을 요약해줘"
  ```
- [ ] **9-3.** `local-llm/system-prompt.md` + 위키 페이지로 쿼리 테스트
  - 시스템 프롬프트에 스키마 요약 포함
  - 위키 페이지 2-3개를 컨텍스트로 전달하여 답변 품질 확인
- [ ] **9-4.** 오프라인 시나리오 테스트
  - 네트워크 연결 없이 Gemma 4로 위키 조회 가능한지 확인
- [ ] **9-5.** 쿼리 확장 능력 테스트 (Phase 2 사전 검증)
  ```bash
  echo "LLM Wiki의 실패 모드는?" | ollama run gemma3 \
    "이 질문에 대해 검색할 동의어와 관련 키워드를 5개 생성해줘"
  ```
  - 로컬 모델이 쿼리 확장에 쓸 수 있는 수준인지 확인

### Step 10: Obsidian 스킬 패키징

- [ ] **10-1.** 배포용 파일 구조 정리
  ```
  wikey-starter/
  ├── README.md              # "5분 안에 LLM Wiki 시작하기"
  ├── wikey.schema.md        # 마스터 스키마
  ├── CLAUDE.md              # Claude Code용
  ├── AGENTS.md              # Codex용
  ├── local-llm/
  │   └── system-prompt.md   # 로컬 LLM용
  ├── wiki/                  # 빈 템플릿
  │   ├── index.md
  │   ├── log.md
  │   └── overview.md
  ├── scripts/
  │   ├── validate-wiki.sh
  │   └── check-pii.sh
  └── .gitignore
  ```
- [ ] **10-2.** README.md 작성 (한국어 + 영어)
  - 설치 방법: Obsidian에서 볼트 열기 → 파일 복사 → LLM 에이전트 실행
  - 지원 LLM: Claude Code, Codex, Gemini, Gemma 4 (로컬)
  - 첫 인제스트 가이드 (스크린샷 포함)
  - 차별점: Zero-setup, BYOAI, 한국어 지원 (Phase 2)
- [ ] **10-3.** GitHub 공개 저장소 생성 여부 결정
  - Phase 2에서 공개 예정이지만, Phase 1에서 구조만 준비

---

## Phase 1 완료 체크리스트

### 필수 (Must)

- [ ] `wikey.schema.md` 작성 완료 (프로바이더 독립 마스터 스키마)
- [ ] `CLAUDE.md` 경량화 (스키마 참조 + Claude 특화)
- [ ] `AGENTS.md` 작성 (스키마 참조 + Codex 특화)
- [ ] `local-llm/system-prompt.md` 작성
- [ ] Git 초기화 + GitHub private push
- [ ] `scripts/validate-wiki.sh` 동작 + pre-commit hook
- [ ] `scripts/check-pii.sh` 동작
- [ ] 5개 이상 소스 인제스트 (Claude Code)
- [ ] 20개 이상 위키 페이지 생성
- [ ] 쿼리 5건 테스트 (분석 페이지 저장 포함)
- [ ] 린트 동작 (의도적 결함 감지 확인)
- [ ] log.md에 토큰 사용량 기록

### 중요 (Should)

- [ ] Codex로 1건 인제스트 성공 (BYOAI 검증)
- [ ] Codex 인제스트 후 `validate-wiki.sh` 통과 (일관성 확인)
- [ ] Gemma 4 로컬 위키 쿼리 동작
- [ ] Obsidian Graph View 스크린샷 확인
- [ ] 대용량 소스 청킹 인제스트 1건 성공

### 선택 (Could)

- [ ] Codex 독립 린트 (교차 검증)
- [ ] Gemma 4 쿼리 확장 테스트 (Phase 2 사전 검증)
- [ ] 스킬 패키지 README 초안
- [ ] Gemma 4 오프라인 쿼리 테스트
