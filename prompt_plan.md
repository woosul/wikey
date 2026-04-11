# Implementation Plan: Wikey — LLM-Agnostic 개인 지식저장소 → 한국어 기업 기술지식저장소

> 확정일: 2026-04-10 (v2 — 차별화 + BYOAI 반영)
> 리뷰: CEO + Eng + Codex 자동 리뷰 완료, Taste 결정 3건 확정

## 차별화 전략

### 문제

llmbase(React UI), seCall(한국어 검색), qmd(LLM 다층 검색)가 이미 존재. 기능만으로는 차별점이 약함.

### Wikey의 포지션

```
                    위키 빌더            검색 엔진
                  ┌───────────┐     ┌───────────┐
                  │ llmbase   │     │ qmd       │
                  │ (React UI)│     │ (LLM 리랭킹)│
                  └───────────┘     └───────────┘
                        │                 │
                        │    Wikey가       │
                        │    결합하는 영역   │
                        ▼                 ▼
    ┌─────────────────────────────────────────────────┐
    │  Wikey = Obsidian 네이티브 + BYOAI + 한국어 특화   │
    │                                                   │
    │  1. 가장 낮은 진입 장벽 (Obsidian 스킬 설치만)      │
    │  2. 어떤 LLM이든 연결 (BYOAI)                     │
    │  3. 한국어 기업 기술 KB = 미개척 시장               │
    └─────────────────────────────────────────────────┘
```

**핵심 차별점 3가지:**

1. **Zero-setup**: Obsidian에 스킬셋 설치 + 스키마 파일 복사 = 끝. 앱 설치, 서버 구축, DB 설정 불필요
2. **BYOAI**: Claude Code, Codex, Gemini, Gemma 4(로컬) 등 어떤 LLM 에이전트든 연결. 특정 모델에 종속되지 않음
3. **한국어 기업 특화**: 한영 혼합 기술 용어 정규화, 한국 기업 도구(Slack KR, Jira KR) 연동 — 이 조합은 시장에 없음

---

## 설계 결정 기록 (ADR)

### ADR-001: Obsidian 중심 [A] — 유지

### ADR-002: 2개 분리 (개인 검증 → 기업 별도 결정) [A] — 유지

### ADR-003: 마크다운 + 추상화 [A] — 유지

### ADR-004: RAG "합성 레이어" 포지셔닝 — 유지

### ADR-005: BYOAI — LLM 프로바이더 독립 (신규)

**결정**: 스키마를 프로바이더 독립적으로 설계. 하나의 스키마에서 여러 LLM 에이전트를 지원.

**구조:**
```
wikey/
├── wikey.schema.md          # 프로바이더 독립 스키마 (마스터)
├── CLAUDE.md                # Claude Code용 → wikey.schema.md include + Claude 특화 지시
├── AGENTS.md                # Codex CLI용 → wikey.schema.md include + Codex 특화 지시
├── .gemini/                 # Gemini용 설정
│   └── settings.json
└── local-llm/               # 로컬 LLM (Gemma 4) 용 프롬프트
    └── system-prompt.md
```

**프로바이더별 역할:**

| 프로바이더 | 용도 | 장점 | 한계 |
|-----------|------|------|------|
| **Claude Code** | 메인 인제스트/쿼리/린트 | 최고 품질 합성, 도구 사용 능력 | 비용, 온라인 필수 |
| **Codex CLI** | 독립 2차 리뷰, 병렬 인제스트 | 독립 관점, Claude와 다른 시각 | API 별도 |
| **Gemini** | 대용량 소스 처리 (긴 컨텍스트) | 1M+ 컨텍스트, 무료 티어 | 도구 연동 약함 |
| **Gemma 4 (로컬)** | 쿼리 확장, 리랭킹, 오프라인 작업 | 무료, 프라이버시, 오프라인 | 합성 품질 낮음 |

**워크플로우별 최적 조합:**

| 워크플로우 | 기본 | 대안 | 로컬 폴백 |
|-----------|------|------|----------|
| 인제스트 (소스 분석 + 위키 작성) | Claude Code | Codex | - |
| 쿼리 (검색 + 합성) | Claude Code | Gemini (대량 컨텍스트) | Gemma 4 (단순 쿼리) |
| 린트 (상태 점검) | Claude Code | Codex (독립 검증) | - |
| 쿼리 확장 + 리랭킹 (Phase 2+) | Gemma 4 (로컬) | qmd 내장 모델 | - |
| 대용량 소스 1차 요약 | Gemini | Claude Code | Gemma 4 |

---

## Phase 1: Zero-Setup 개인 위키 + BYOAI 기반 (2–3주)

> 목표: "Obsidian 스킬 설치 + 스키마 복사 = 바로 시작"하는 가장 쉬운 LLM Wiki 경험
> 차별화: llmbase(앱 설치 필요)보다 낮은 진입 장벽 + 어떤 LLM이든 사용 가능

### 1-1. 프로바이더 독립 스키마 설계

```
wikey/
├── wikey.schema.md          # 마스터 스키마 (프로바이더 독립)
│   ├── 디렉토리 구조
│   ├── 3계층 아키텍처
│   ├── 워크플로우 (인제스트/쿼리/린트)
│   ├── 페이지 컨벤션 (프론트매터, 네이밍, 위키링크)
│   ├── 원시 소스 관리 (추가/수정/삭제)
│   └── 핵심 원칙
│
├── CLAUDE.md                # "wikey.schema.md를 읽고 따르라" + Claude Code 특화 지시
│   └── Claude 도구 사용법 (Read, Write, Edit, Bash, Obsidian CLI)
│
├── AGENTS.md                # "wikey.schema.md를 읽고 따르라" + Codex 특화 지시
│   └── Codex 도구 사용법
│
└── local-llm/
    └── system-prompt.md     # Gemma 4용 시스템 프롬프트 (wikey.schema.md 요약 + 로컬 제약)
```

**핵심**: `wikey.schema.md`가 모든 LLM이 공유하는 단일 규칙 문서. 프로바이더별 파일은 "이 스키마를 따르되, 이 도구를 써라"만 추가.

### 1-2. 디렉토리 구조 + Git 초기화

```
wikey/
├── wikey.schema.md
├── CLAUDE.md
├── AGENTS.md
├── raw/                     # .gitignore 대상 (PII 보호)
│   ├── articles/
│   ├── papers/
│   ├── notes/
│   └── assets/
├── wiki/
│   ├── index.md
│   ├── log.md
│   ├── overview.md
│   ├── entities/
│   ├── concepts/
│   ├── sources/
│   └── analyses/
├── scripts/
│   └── validate-wiki.sh
├── .claude/skills/          # Obsidian 스킬 (설치 완료)
└── .obsidian/               # Obsidian 볼트 설정
```

- Git 초기화 + GitHub private 연동
- `.gitignore`: `raw/`, `.obsidian/workspace.json`, `.DS_Store`, `local-llm/*.gguf`

### 1-3. 위키 정합성 검증 + PII 보호

- `scripts/validate-wiki.sh`: 프론트매터, 위키링크, 인덱스 등재, 중복 검사
- Git pre-commit hook 연동
- PII 패턴 스캐닝 (한국 전화번호, 이메일, 주민번호)

### 1-4. Claude Code로 인제스트/쿼리/린트 검증

- 테스트 소스 5개 인제스트 (1건씩, 관여하며)
- 쿼리 5건 테스트, 분석 페이지 저장
- 린트 실행 (증분 + 전체)
- 대용량 소스 청킹 검증 (20p+ PDF)

### 1-5. BYOAI 검증 — Codex로 동일 위키 운영 테스트

- Codex CLI에서 `AGENTS.md` 읽고 인제스트 1건 실행
- Claude Code로 만든 위키에 Codex가 일관되게 추가할 수 있는지 검증
- **두 LLM이 같은 위키를 교대로 유지할 수 있는가?** → BYOAI 핵심 검증

### 1-6. Gemma 4 로컬 LLM 셋업

- Ollama 또는 llama.cpp로 Gemma 4 로컬 실행
- `local-llm/system-prompt.md`에 위키 스키마 요약 포함
- 단순 쿼리 (위키 페이지 읽기 + 요약) 동작 확인
- 오프라인 환경에서 위키 조회 가능한지 검증

### 1-7. Obsidian 스킬 패키징 (배포 준비)

- 현재 `.claude/skills/`의 kepano 스킬 + wikey 스키마를 **하나의 설치 가능한 패키지**로 정리
- README: "Obsidian에서 이 스킬 설치 + wikey.schema.md 복사 = LLM Wiki 시작"
- GitHub 공개 저장소로 배포 준비 (Phase 2에서 공개)

### 완료 기준

- [ ] wikey.schema.md (프로바이더 독립 마스터 스키마) 작성
- [ ] CLAUDE.md + AGENTS.md가 동일 스키마를 참조
- [ ] Claude Code로 5+ 소스 인제스트, 20+ 위키 페이지
- [ ] Codex CLI로 1건 인제스트 성공 (BYOAI 검증)
- [ ] Gemma 4 로컬에서 위키 쿼리 동작
- [ ] validate-wiki.sh + pre-commit hook 동작
- [ ] Obsidian Graph View에서 상호연결 확인
- [ ] 스킬 패키지 README 작성

---

## Phase 2: 한국어 + LLM 다층 검색 + 커뮤니티 (2–3주 설정 + 3개월 운영)

> 목표: 한국어 검색 특화 + LLM 참여형 검색 도입 + Obsidian 커뮤니티 공개
> 차별화: qmd의 LLM 다층 검색 + seCall의 한국어 형태소 분석을 결합한 유일한 솔루션

### 2-0. raw/ PARA 재구조화 + 분류 시스템 (Phase 2 기반 작업)

> Phase 2-3 반자동 인제스트의 전제 조건. inbox 단일 진입점 + 분류 기준 문서 시스템 구축.

**현황**: Phase 1에서 flat 구조(articles/papers/notes/assets/) 사용. 1,073개 파일(1.7GB) 중 99.5%가 manual/에 비체계적으로 적재.

**변경**:
```
raw/
├── inbox/           # 단일 진입점 — 모든 새 파일은 여기에 추가
├── projects/        # 활성 프로젝트 (기한 있음)
├── areas/           # 지속적 관심 영역
├── resources/       # 주제별 참고 자료 (하드웨어 매뉴얼, 웹 기사, 논문)
├── archive/         # 완료/비활성 항목
├── assets/          # 이미지, 첨부파일 (Obsidian)
└── CLASSIFY.md      # 분류 기준 문서 (규칙 + 자연어 가이드 + 피드백 로그)
```

**분류 워크플로우**:
1. 사용자가 `raw/inbox/`에 파일 또는 폴더 드롭
2. LLM이 `CLASSIFY.md` 참조하여 자동 분류 제안 (폴더는 번들 단위로 즉시 분류)
3. 사용자 승인 후 해당 PARA 카테고리로 이동
4. 사용자 이의 시 → `CLASSIFY.md` 피드백 로그에 기록 + 규칙 업데이트

**URI 기반 등록 (Phase 3-4 기업용)**:
- 기업 저장소(Confluence, SharePoint 등)의 소스는 복사 시 중복 문제 발생
- 파일 복사 대신 `.meta.yaml`에 URI + 메타데이터만 등록 → LLM이 URI로 원본 접근하여 인제스트
- CLASSIFY.md 분류 규칙은 메타데이터 기반으로 동일 적용

**분류 기준 문서 (`raw/CLASSIFY.md`)** — 하이브리드 형식:
- 자동 규칙: 확장자/경로 패턴 → 즉시 분류 (예: *.pdf + 제품폴더 → resources/{topic}/{product}/)
- 자연어 가이드: 규칙 미매칭 시 LLM 판단 기준 (판단 순서, 애매한 경우 처리)
- 하위폴더 정의: resources/ 내 11개 토픽 폴더 + 제품별 리프 폴더
- 새 하위폴더 생성 규칙: LLM 제안 → 사용자 승인 → CLASSIFY.md에 즉시 등재
- 피드백 로그: 분류 이의 기록 (사용자 수정 사유 → 규칙/가이드 업데이트 트리거)

**네이밍**: 영문 kebab-case (카테고리: `rc-car/`, 제품: `Kyosho-Mini-Z/`)

**마이그레이션**: `scripts/migrate-raw-to-para.sh`로 기존 1,073개 전체 재분류
- articles/ (3개) → resources/wikey-design/
- notes/wikey-design-decisions.md → projects/wikey/
- notes/nanovna-v2-notes.md → areas/rf-measurement/
- manual/00.게임기기/* → resources/{rc-car,fpv,bldc-motor,sim-racing,...}/
- manual/02.무선통신/* → resources/{rf-measurement,ham-radio,sdr}/

**문서 업데이트**: wikey.schema.md (디렉토리 구조, 소스 관리, LLM 권한), CLAUDE.md/AGENTS.md (분류 세션 추가), wiki/sources/ 6개 (경로 갱신), README.md

**LLM 권한 변경**: raw/ "읽기만" → "내용 수정 금지, inbox→분류 이동은 허용 (사용자 승인 후)"

**2-3과의 연결**: inbox 단일 진입점이 확보되면 fswatch 모니터링 대상이 `raw/inbox/` 하나로 단순화됨.

### 2-1. LLM 다층 검색 파이프라인 구축

qmd MCP 서버 + 로컬 LLM(Gemma 4) 조합:

```
사용자 질문
  │
  ▼
Gemma 4 (로컬): 쿼리 확장                    ← 무료, 오프라인
  │  (동의어, 한영 변환, 의미 변형)
  │
  ├─► qmd BM25 검색 (한국어 형태소 분석)
  ├─► qmd 벡터 검색 (의미 유사도)
  │
  ▼
RRF 융합 → 상위 30개 후보
  │
  ▼
Gemma 4 (로컬): 리랭킹                       ← 무료, 오프라인
  │
  ▼
최종 상위 10개 → Claude/Codex/Gemini: 합성    ← 고품질 합성
```

**핵심**: 쿼리 확장과 리랭킹은 **로컬 LLM(무료)**이 담당, 최종 합성만 **클라우드 LLM(고품질)**이 담당. 토큰 비용 최소화 + 지능적 검색 유지.

### 2-2. 한국어 검색 특화

- seCall 패턴의 한국어 형태소 분석 (Lindera/mecab-ko) 적용
- 한영 기술 용어 정규화 레이어:
  ```
  "삼성 SDI" ↔ "Samsung SDI"
  "쿠버네티스" ↔ "Kubernetes" ↔ "k8s"
  "배포" ↔ "deploy" ↔ "deployment"
  ```
- **벤치마크**: 50–100개 쿼리 (한영 혼합, 기술 약어, 엔티티 조회, 교차 문서 합성)
- **게이트**: 80%+ 정확도

### 2-3. 반자동 인제스트 파이프라인

- `scripts/watch-raw.sh`: fswatch → 알림 → 사용자 승인 → 인제스트
- 미승인 소스 대기 목록 관리
- Gemini 활용: 대용량 소스(100p+ PDF) 1차 요약 → Claude Code가 위키에 통합

### 2-4. 멀티 LLM 워크플로우 최적화

| 작업 | 최적 프로바이더 | 이유 |
|------|---------------|------|
| 일상 인제스트 | Claude Code | 도구 사용 + 파일 편집 능력 최고 |
| 대용량 소스 1차 요약 | Gemini | 1M+ 컨텍스트, 무료 티어 활용 |
| 쿼리 확장 + 리랭킹 | Gemma 4 (로컬) | 무료, 빠름, 프라이버시 |
| 최종 합성 | Claude Code 또는 Codex | 고품질 |
| 독립 린트 (2차 검증) | Codex | Claude와 다른 시각으로 교차 검증 |
| 오프라인 쿼리 | Gemma 4 (로컬) | 네트워크 없이 위키 조회 |

### 2-5. 커뮤니티 공개

- GitHub 공개: wikey.schema.md + 스킬 패키지 + 설치 가이드
- "5분 안에 LLM Wiki 시작하기" 한국어/영어 README
- Obsidian 커뮤니티 포럼 + GeekNews 공유

### 2-6. 장기 운영 데이터 수집

- 3개월간 일상 사용 (목표: 100+ 소스, 200+ 페이지)
- 수집 데이터: 일관성 추이, 프로바이더별 토큰 비용, 검색 정확도, 커뮤니티 피드백

### 완료 기준

- [ ] LLM 다층 검색 파이프라인 동작 (로컬 확장+리랭킹 + 클라우드 합성)
- [ ] 한국어 벤치마크 80%+ 정확도
- [ ] Gemini 대용량 소스 처리 동작
- [ ] Gemma 4 로컬 쿼리 확장/리랭킹 동작
- [ ] GitHub 공개 + README 작성
- [ ] 50+ 소스, 100+ 위키 페이지
- [ ] 3개월 운영 데이터 수집

### Phase 2→3 게이트

| 기준 | 통과 | 실패 |
|------|------|------|
| LLM 위키 일관성 | lint 오류율 감소 | 오류 누적 증가 |
| 토큰 비용 | 월 $50 이하 (개인) | 월 $100+ |
| 커뮤니티 | 10+ GitHub stars, 사용자 피드백 | 무반응 |
| BYOAI | 2+ 프로바이더로 위키 교대 운영 성공 | 프로바이더 전환 시 일관성 파괴 |
| 팀 수요 | 2-3명 파일럿 긍정 | 무관심 |

---

## Phase 3: 팀 협업 + 기업 파일럿 (10주, 3개 서브페이즈)

> 전제: Phase 2 게이트 통과 후에만 진행

### Phase 3a: 헤드리스 서버 (4주)

- TypeScript/Node.js 위키 엔진 (WikiStore 인터페이스 구현)
- LLM 프로바이더 추상화: Claude API, Gemini API, Ollama(Gemma 4) 지원
- LLM 다층 검색 서버 모듈화 (쿼리확장→하이브리드검색→리랭킹→합성)
- REST API + Docker 패키징

### Phase 3b: 웹 UI (4주)

- 위키 브라우징 + 그래프 뷰 + 검색 + 인제스트 업로드

### Phase 3c: 팀 + 한국 기업 도구 연동 (2주)

- Git 기반 동기화 + Slack KR 연동
- 3명 팀 2주 파일럿

---

## Phase 4: 한국어 기업 기술 KB (8–12주)

> 전제: Phase 3 팀 파일럿 긍정 결과 후에만 진행
> 차별화: 한국어 기업 기술지식저장소 = 시장에 없음

### 4-1. 접근 제어 + 감사 (단일 테넌트)

### 4-2. LLM 다층 검색 기업 확장

- 쿼리 확장/리랭킹: Gemma 4 로컬 (기업 프라이버시 보장)
- 하이브리드 검색: BM25(한국어 형태소) + 벡터
- 합성: 기업이 선택한 LLM (Claude/GPT/Gemini/자체 모델)
- 보조 DB: 린트 자동화 + 구조 분석용 (검색의 주체는 LLM)

### 4-3. 한국 기업 소스 연동

| 소스 | 연동 |
|------|------|
| Slack (한국어 채널) | Bot → 한영 혼합 스레드 → 정규화 → `raw/` |
| Jira/Linear | API → 이슈/ADR → `raw/` |
| Confluence | API → 페이지 → 마크다운 변환 → `raw/` |
| GitHub | Webhook → PR/이슈 → `raw/` |
| 회의록 (한국어) | Clova/Whisper → 텍스트 → `raw/` |

### 4-4. 법적 삭제 + PII 자동 처리

---

## 리스크 분석

| 리스크 | 심각도 | 대응 | Phase |
|--------|--------|------|-------|
| LLM 위키 일관성 유지 실패 | CRITICAL | validate-wiki.sh + pre-commit + 인제스트 후 diff 리뷰 | 1 |
| BYOAI: 프로바이더 전환 시 일관성 파괴 | HIGH | 프로바이더 독립 스키마 + 전환 테스트 검증 | 1 |
| 한국어 검색 정확도 부족 | HIGH | seCall 형태소 분석 + 50-100개 벤치마크 게이트 | 2 |
| Gemma 4 로컬 품질 부족 | HIGH | 쿼리확장/리랭킹에만 사용, 합성은 클라우드 LLM | 2 |
| 다중파일 인제스트 중 실패 | CRITICAL | Git 브랜치 작업 → 검증 후 merge | 1 |
| PII 유출 | HIGH | .gitignore + PII 규칙 + pre-commit 스캔 | 1 |
| Phase 3 전환 비용 | HIGH | WikiStore 인터페이스 문서화 + 위키링크 파서 자체 구현 | 2-3 |
| 커뮤니티 무반응 | MEDIUM | Phase 2 게이트에서 판단, 실패 시 개인 도구로 유지 | 2 |

## 기술 스택

| 레이어 | Phase 1-2 | Phase 3-4 |
|--------|-----------|-----------|
| 위키 저장소 | 마크다운 + Git | WikiStore → FileSystem/DB |
| 검색 | index.md → qmd + Gemma 4 | qmd 확장 + 한국어 BM25 |
| 인제스트 LLM | Claude Code (메인) | Claude/Codex API |
| 합성 LLM | Claude Code / Codex | 기업 선택 (BYOAI) |
| 쿼리확장/리랭킹 | Gemma 4 (로컬) | Gemma 4 (로컬, 프라이버시) |
| 대용량 처리 | Gemini (1M+ 컨텍스트) | Gemini API |
| 뷰어 | Obsidian | Obsidian → 웹 UI |
| 인프라 | 로컬 + GitHub | Docker → 클라우드 |

## 타임라인

| Phase | 기간 | 핵심 차별화 | 게이트 |
|-------|------|-----------|--------|
| **1: Zero-Setup + BYOAI** | 2–3주 | 가장 쉬운 시작 + 4개 LLM 검증 | 20+ 페이지, BYOAI 동작 |
| **2: 한국어 + 다층 검색 + 공개** | 2–3주 + 3개월 | 로컬 LLM 검색 + 한국어 특화 + GitHub 공개 | 커뮤니티 반응, 80%+ 검색 정확도 |
| **3: 팀 서버** | 10주 | 멀티 LLM 서버 + 한국 기업 도구 | 3명 팀 파일럿 |
| **4: 한국어 기업 KB** | 8–12주 | 유일한 한국어 LLM Wiki 기업 솔루션 | 10명 1개월 파일럿 |
