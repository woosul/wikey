# Phase 2: Todo List — 한국어 + LLM 다층 검색 + 커뮤니티

> 기간: 2026-04-11 ~ (2–3주 설정 + 3개월 운영)
> 상태: **진행 중**
> 전제: Phase 1 완료 (12/12 필수, 5/5 중요, 3/4 선택)
> 인프라: Ollama 0.20.5 + Gemma 4 (12B), vLLM-Metal 0.2.0, Codex CLI 0.118.0

---

## Step 0: raw/ PARA 재구조화 + 분류 시스템 (Phase 2 기반 작업)

> Step 3 반자동 인제스트의 전제 조건. inbox 단일 진입점 확보 + 분류 기준 문서 시스템 구축.

### 0-1. 분류 기준 문서 생성

- [ ] **0-1-1.** `raw/CLASSIFY.md` 생성 — 하이브리드 분류 기준 문서
  - PARA 카테고리 정의 (projects/areas/resources/archive)
  - inbox 처리 모드 (파일 단위 vs 폴더 단위 — 폴더는 번들로 즉시 분류)
  - URI 기반 등록 설계 (기업용, Phase 3-4 구현 — `.meta.yaml` 패턴)
  - 자동 분류 규칙 (확장자/경로 패턴 → 분류 대상)
  - LLM 판단 가이드 (규칙 미매칭 시 판단 순서)
  - resources/ 하위폴더 정의 (11개 토픽: rc-car, fpv, bldc-motor, sim-racing, flight-sim, rf-measurement, ham-radio, sdr, test-equipment, esc-fc, wikey-design)
  - 제품 폴더 네이밍 규칙 (영문 kebab-case, 원본 대소문자 유지 가능)
  - 새 하위폴더 생성 규칙 (LLM 제안 → 사용자 승인 → CLASSIFY.md 등재)
  - 피드백 로그 섹션 (사용자 이의 기록 → 규칙 업데이트 트리거)

### 0-2. 마이그레이션 스크립트 + 실행

- [ ] **0-2-1.** `scripts/migrate-raw-to-para.sh` 작성
  - PARA 스켈레톤 디렉토리 생성 (inbox, projects, areas, resources, archive)
  - resources/ 하위 토픽 디렉토리 생성 (11개)
  - 파일 매핑 규칙:
    - `raw/articles/*.md` (3개) → `raw/resources/wikey-design/`
    - `raw/notes/wikey-design-decisions.md` → `raw/projects/wikey/`
    - `raw/notes/nanovna-v2-notes.md` → `raw/areas/rf-measurement/`
    - `raw/manual/00.게임기기/100 Car/{각 제품폴더}` → `raw/resources/rc-car/{kebab-name}/`
    - `raw/manual/00.게임기기/200 Model Assembling` → `raw/resources/rc-car/model-assembling/`
    - `raw/manual/00.게임기기/810 RF Receiver` → `raw/resources/rc-car/rf-receiver/`
    - `raw/manual/00.게임기기/830 FPV/{각 제품폴더}` → `raw/resources/fpv/{name}/`
    - `raw/manual/00.게임기기/860 BLDC Motor` → `raw/resources/bldc-motor/`
    - `raw/manual/00.게임기기/862 ESC_FC` → `raw/resources/esc-fc/`
    - `raw/manual/00.게임기기/910 Sim Racing/*` → `raw/resources/sim-racing/`
    - `raw/manual/00.게임기기/913 AirSim/*` → `raw/resources/flight-sim/`
    - `raw/manual/00.게임기기/915 DriveHub/*` → `raw/resources/sim-racing/`
    - `raw/manual/02.무선통신/NanoVNA V2` → `raw/resources/rf-measurement/NanoVNA-V2/`
    - `raw/manual/02.무선통신/CW Pokemon` → `raw/resources/ham-radio/CW-Pokemon/`
    - `raw/manual/02.무선통신/MALAHIT-DSP SDR` → `raw/resources/sdr/MALAHIT-DSP/`
  - 빈 폴더 스킵 (300 Drone), 빈 구 디렉토리 삭제 (articles/, manual/, notes/, papers/)
- [ ] **0-2-2.** 마이그레이션 전 파일 매니페스트 생성
  ```bash
  find raw/ -type f > /tmp/wikey-raw-manifest-before.txt
  ```
- [ ] **0-2-3.** 스크립트 실행
- [ ] **0-2-4.** 마이그레이션 후 검증
  ```bash
  find raw/ -type f | wc -l   # 1,073 확인
  # 파일명 기준 전후 diff로 누락/추가 없음 확인
  ```

### 0-3. 위키 소스 경로 갱신

- [ ] **0-3-1.** `wiki/sources/source-llm-wiki-gist.md` — `raw/articles/llm-wiki.md` → `raw/resources/wikey-design/llm-wiki.md`
- [ ] **0-3-2.** `wiki/sources/source-llm-wiki-community.md` — `raw/articles/idea-comment.md` → `raw/resources/wikey-design/idea-comment.md`
- [ ] **0-3-3.** `wiki/sources/source-append-and-review.md` — `raw/articles/append-and-review-note.md` → `raw/resources/wikey-design/append-and-review-note.md`
- [ ] **0-3-4.** `wiki/sources/source-wikey-design-decisions.md` — `raw/notes/wikey-design-decisions.md` → `raw/projects/wikey/wikey-design-decisions.md`
- [ ] **0-3-5.** `wiki/sources/source-dji-o3-air-unit.md` — `raw/manual/00.게임기기/830 FPV/DJI O3 Air Unit/...` → `raw/resources/fpv/DJI-O3-Air-Unit/...`
- [ ] **0-3-6.** `wiki/sources/source-nanovna-v2-notes.md` — `raw/notes/nanovna-v2-notes.md` → `raw/areas/rf-measurement/nanovna-v2-notes.md`

### 0-4. 위키 페이지 및 로그 업데이트

- [ ] **0-4-1.** `wiki/entities/obsidian.md` — Web Clipper 경로 `raw/articles/` → `raw/inbox/`
- [ ] **0-4-2.** `wiki/concepts/append-and-review.md` — `raw/notes/` → `raw/inbox/`
- [ ] **0-4-3.** `wiki/log.md`에 마이그레이션 항목 추가 (append-only, 기존 항목 미수정)
  ```
  ## [2026-04-11] restructure | raw/ PARA 마이그레이션
  ```

### 0-5. 스키마 및 설정 문서 업데이트

- [ ] **0-5-1.** `wikey.schema.md` 업데이트 (사용자 승인 필요)
  - 디렉토리 구조도 (line 111-115): flat → PARA 구조
  - Obsidian Web Clipper (line 72): `raw/articles/` → `raw/inbox/`
  - 소스 유형 매핑 테이블 (line 418-426): 모든 소스 → `raw/inbox/` 진입
  - 인제스트 지시 예시 (line 430-433): inbox 기반으로 변경
  - 원시 소스 관리 섹션 (line 404-478): PARA 워크플로우 + CLASSIFY.md 참조 + 분류 세션 추가
  - LLM 쓰기 권한 (line 410): inbox→PARA 이동 허용 (내용 수정 금지 유지)
- [ ] **0-5-2.** `CLAUDE.md` 업데이트
  - raw/ 권한: "읽기만" → "내용 수정 금지, inbox→분류 이동은 허용 (사용자 승인 후)"
  - 분류 세션 체크리스트 추가
- [ ] **0-5-3.** `AGENTS.md` 동일 업데이트
- [ ] **0-5-4.** `README.md` 업데이트
  - `mkdir -p raw/{articles,papers,notes,assets}` → `mkdir -p raw/{inbox,projects,areas,resources,archive,assets}`
  - 첫 인제스트 안내: `raw/articles/` → `raw/inbox/`
- [ ] **0-5-5.** `.obsidian/app.json` — `attachmentFolderPath: "raw/assets"` 설정
- [ ] **0-5-6.** Obsidian Web Clipper 저장 위치 변경 안내 (사용자가 브라우저에서 수동: → `raw/inbox`)

### 0-6. 검증 + 커밋

- [ ] **0-6-1.** `./scripts/validate-wiki.sh` → PASS
- [ ] **0-6-2.** `./scripts/check-pii.sh` → PASS
- [ ] **0-6-3.** wiki/sources/ 6개 파일의 `원시 소스:` 경로가 실제 파일과 일치하는지 확인
- [ ] **0-6-4.** Git 커밋 (wiki/ + 스키마 + 스크립트 + 설정 변경)

---

## Step 1: LLM 다층 검색 파이프라인 구축

> qmd MCP 서버 + Gemma 4 (로컬) 조합으로 쿼리확장→하이브리드검색→리랭킹→합성 파이프라인 구축

### 1-1. qmd MCP 서버 설치 + 위키 인덱싱

- [ ] **1-1-1.** qmd MCP 서버 설치 및 Claude Code 연동 확인
  - `claude mcp add qmd ...` 또는 `.mcp.json`에 등록
- [ ] **1-1-2.** `wiki/` 디렉토리를 qmd에 인덱싱
  - BM25 인덱스 생성
  - 벡터 인덱스 생성 (임베딩 모델 선택)
- [ ] **1-1-3.** 기본 검색 테스트 5건 (qmd 단독)
  - 단순 키워드, 한국어, 영어, 한영 혼합, 엔티티명

### 1-2. Gemma 4 쿼리 확장 파이프라인

- [ ] **1-2-1.** `local-llm/wikey-query.sh --expand` 개선
  - 입력 쿼리 → Gemma 4에게 동의어/한영 변환/의미 변형 5개 생성 요청
  - 출력: 원본 쿼리 + 확장 키워드 리스트
- [ ] **1-2-2.** 쿼리 확장 품질 테스트 10건
  - 한국어 기술 용어 → 영어 동의어 생성 확인
  - 약어 → 풀네임 확장 확인

### 1-3. Gemma 4 리랭킹 파이프라인

- [ ] **1-3-1.** `local-llm/wikey-query.sh --rerank` 개선
  - qmd 검색 결과 상위 30개 → Gemma 4에게 관련성 점수 부여 요청
  - 출력: 재정렬된 상위 10개
- [ ] **1-3-2.** vLLM-Metal API 서버 기반 리랭킹 (배치 처리)
  - Ollama(인터랙티브) 대신 vLLM API로 동시 요청 처리
- [ ] **1-3-3.** 리랭킹 전/후 비교 테스트 5건
  - qmd 기본 순위 vs Gemma 4 리랭킹 후 순위 비교

### 1-4. 통합 파이프라인 테스트

- [ ] **1-4-1.** 전체 흐름 연결: 쿼리 → 확장 → qmd 검색 → 리랭킹 → 합성
  ```
  사용자 질문 → Gemma 4 확장 → qmd BM25+벡터 → RRF 융합 → Gemma 4 리랭킹 → Claude 합성
  ```
- [ ] **1-4-2.** 10건 쿼리 벤치마크 (파이프라인 유무 비교)
  - 파이프라인 없이 (index.md 기반 직접 검색) vs 파이프라인 사용 시 답변 품질 비교
- [ ] **1-4-3.** 지연 시간 측정 (쿼리 → 답변 완료)

---

## Step 2: 한국어 검색 특화

### 2-1. 형태소 분석 적용

- [ ] **2-1-1.** mecab-ko (또는 Lindera) 설치
- [ ] **2-1-2.** qmd BM25 인덱스에 형태소 분석 적용 확인
  - "쿠버네티스 배포 전략" → 형태소 분리 후 검색 정확도 개선 확인
- [ ] **2-1-3.** 형태소 분석 전/후 검색 품질 비교 5건

### 2-2. 한영 기술 용어 정규화

- [ ] **2-2-1.** 용어 정규화 사전 초안 작성 (`local-llm/term-normalization.yaml`)
  ```yaml
  - ko: [쿠버네티스, 쿠베]
    en: [Kubernetes, k8s, K8s]
  - ko: [배포]
    en: [deploy, deployment]
  ```
- [ ] **2-2-2.** 정규화 레이어를 쿼리 확장에 통합
  - Gemma 4 쿼리 확장 시 정규화 사전 참조
- [ ] **2-2-3.** 정규화 효과 테스트 5건 (한국어 쿼리 → 영어 위키 페이지 매칭)

### 2-3. 검색 벤치마크

- [ ] **2-3-1.** 벤치마크 쿼리셋 50-100개 작성
  - 한글 단순 쿼리, 영문 단순 쿼리, 한영 혼합, 기술 약어, 엔티티 조회, 교차 문서 합성
- [ ] **2-3-2.** 벤치마크 실행 및 정확도 측정
- [ ] **2-3-3.** **게이트**: 80%+ 정확도 달성 여부 판단
  - 미달 시: 형태소 분석 튜닝, 정규화 사전 확장, 임베딩 모델 교체 검토

---

## Step 3: 반자동 인제스트 파이프라인

> Step 0의 inbox 단일 진입점 위에 구축

### 3-1. inbox 모니터링

- [ ] **3-1-1.** `scripts/watch-inbox.sh` 작성
  - fswatch로 `raw/inbox/` 감시
  - 새 파일/폴더 감지 시 알림 (macOS Notification 또는 터미널 출력)
- [ ] **3-1-2.** 알림 → 분류 → 인제스트 흐름 연결
  - 파일 감지 → CLASSIFY.md 기반 분류 제안 → 사용자 승인 → 이동 → 인제스트 트리거
- [ ] **3-1-3.** 폴더 단위 감지 테스트
  - `inbox/`에 제품 매뉴얼 폴더 추가 → 번들 분류 → resources/ 이동 → 인제스트

### 3-2. 대용량 소스 처리

- [ ] **3-2-1.** Gemini API 연동 (1M+ 컨텍스트 활용)
  - 100p+ PDF → Gemini 1차 요약 → 요약본을 Claude Code에 전달하여 위키 통합
- [ ] **3-2-2.** 대용량 처리 테스트 1건 (100p+ PDF)
- [ ] **3-2-3.** 미승인 소스 대기 목록 관리 방안 정의
  - inbox에 체류 중인 미분류 파일 목록 출력 스크립트

---

## Step 4: 멀티 LLM 워크플로우 최적화

### 4-1. 프로바이더별 최적 배분 검증

- [ ] **4-1-1.** 일상 인제스트 — Claude Code 5건 인제스트, 토큰 비용 기록
- [ ] **4-1-2.** 대용량 소스 — Gemini 1차 요약 + Claude Code 통합 1건
- [ ] **4-1-3.** 독립 린트 — Codex CLI로 교차 검증 1회
- [ ] **4-1-4.** 오프라인 쿼리 — Gemma 4 로컬 쿼리 5건

### 4-2. 비용 모니터링

- [ ] **4-2-1.** 프로바이더별 토큰 사용량 + 비용 기록 시작
  - 월간 목표: $50 이하 (개인)
- [ ] **4-2-2.** 비용 효율 분석 (로컬 vs 클라우드 비율 최적화)

---

## Step 5: 커뮤니티 공개

### 5-1. 배포 준비

- [ ] **5-1-1.** GitHub 공개 저장소 전환 (private → public)
  - raw/ .gitignore 확인 (PII 보호)
  - 민감 정보 커밋 이력 검사
- [ ] **5-1-2.** README.md 최종화 (한국어 + 영어)
  - "5분 안에 LLM Wiki 시작하기" 가이드
  - BYOAI 프로바이더 비교표
  - 스크린샷 (Obsidian Graph View, 인제스트 결과)

### 5-2. 공개 + 홍보

- [ ] **5-2-1.** Obsidian 커뮤니티 포럼 게시
- [ ] **5-2-2.** GeekNews 공유
- [ ] **5-2-3.** 초기 피드백 수집 (GitHub Issues)

---

## Step 6: 장기 운영 데이터 수집 (3개월)

### 6-1. 운영 목표

- [ ] **6-1-1.** 100+ 소스 인제스트 (현재 6건)
- [ ] **6-1-2.** 200+ 위키 페이지 (현재 26건)
- [ ] **6-1-3.** 일관성 추이 기록 (lint 오류율)
- [ ] **6-1-4.** 프로바이더별 토큰 비용 월간 기록

### 6-2. Phase 2→3 게이트 평가

- [ ] **6-2-1.** LLM 위키 일관성: lint 오류율 감소 추세인가?
- [ ] **6-2-2.** 토큰 비용: 월 $50 이하인가?
- [ ] **6-2-3.** 커뮤니티: 10+ GitHub stars, 사용자 피드백 있는가?
- [ ] **6-2-4.** BYOAI: 2+ 프로바이더로 위키 교대 운영 성공했는가?
- [ ] **6-2-5.** 팀 수요: 2-3명 파일럿 긍정적인가?

---

## Phase 2 완료 체크리스트

### 필수 (Must)

- [ ] raw/ PARA 재구조화 완료 (1,073개 파일 재분류)
- [ ] CLASSIFY.md 분류 기준 문서 동작
- [ ] LLM 다층 검색 파이프라인 동작 (쿼리확장→검색→리랭킹→합성)
- [ ] 한국어 벤치마크 80%+ 정확도
- [ ] validate-wiki.sh + check-pii.sh 통과
- [ ] wikey.schema.md, CLAUDE.md, AGENTS.md 업데이트 완료

### 중요 (Should)

- [ ] inbox 모니터링 (fswatch) 동작
- [ ] Gemini 대용량 소스 처리 1건+ 성공
- [ ] Gemma 4 로컬 쿼리 확장/리랭킹 동작
- [ ] 50+ 소스, 100+ 위키 페이지
- [ ] GitHub 공개 + README 최종화

### 선택 (Could)

- [ ] vLLM-Metal 배치 리랭킹 동작
- [ ] 한영 용어 정규화 사전 50+ 항목
- [ ] 커뮤니티 피드백 반영 1회+
- [ ] 3개월 운영 데이터 수집 완료

> 상세 결과: `activity/phase-2-result.md`에 기록 예정
