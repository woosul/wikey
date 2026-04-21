# Phase 1 결과 보고서

> 기간: 2026-04-10 ~ 2026-04-11 (2일)
> 목표: Zero-Setup 개인 위키 + BYOAI 검증
> 결과: **완료** (필수 12/12, 중요 5/5, 선택 3/4)

---

---

> 문서 구성: 11개 주제 그룹 × `N / N.M` 계층 번호. 같은 그룹 내 순서는 원래 등장 순서(실질적으로 시간순) 유지.

---

## 1.1 개요 및 타임라인
> tag: #docs, #architecture

### 1.1.1 타임라인

| 날짜 | 커밋 | Step | 주요 작업 |
|------|------|------|----------|
| 04-10 17:51 | `7223ff4` | — | 프로젝트 초기화 (스키마, 플랜, Obsidian 스킬) |
| 04-10 17:53 | `74543c0` | — | master 브랜치 전환, README 영문 번역 |
| 04-10 19:40 | `61b4c67` | 1-3 | BYOAI 스키마 분리 + 위키 템플릿 + 검증 스크립트 |
| 04-10 19:48 | `505c832` | 4-1~4-3 | 소스 1-2 인제스트 (LLM Wiki 원문 + 커뮤니티) |
| 04-10 19:52 | `d4dbeb5` | 4-4~4-5 | 소스 3-4 인제스트 (append-and-review + 설계 의사결정) |
| 04-10 19:53 | `a41c677` | 5-3 | 첫 분석 쿼리 (LLM Wiki 리스크) |
| 04-10 21:18 | `1a93759` | 4-6 | 소스 5 인제스트 (DJI O3 33p PDF 청킹 테스트) |
| 04-10 21:21 | `f23061b` | — | 대용량 소스 2단계 인제스트 전략 문서화 |
| 04-10 21:25 | `e7eb789` | 5-7 | 쿼리 5건 + 린트 + Obsidian CLI 검증 |
| 04-11 01:17 | `cf2b00d` | 8-10 | Codex BYOAI + Gemma 3 로컬 LLM + 패키징 |

총 10개 커밋, 2일 소요.

---

---

## 1.2 스키마 + 프로바이더 설정
> tag: #framework, #architecture

### 1.2.1 스키마 및 프로바이더 설정

| 파일 | 역할 | 비고 |
|------|------|------|
| `wikey.schema.md` | 프로바이더 독립 마스터 스키마 | 3계층 아키텍처, 워크플로우, 컨벤션, 핵심 원칙 |
| `CLAUDE.md` | Claude Code 어댑터 | 스키마 참조 + Read/Write/Edit/Bash/Obsidian CLI 패턴 |
| `AGENTS.md` | Codex CLI 어댑터 | 스키마 참조 + cat/grep/find 패턴 |
| `local-llm/system-prompt.md` | 로컬 LLM (Gemma) | 읽기 전용 어시스턴트, 축약 스키마 |

---

## 1.3 검증 인프라 (validate · pii · pre-commit)
> tag: #ops, #utility

### 1.3.1 검증 인프라

| 파일 | 기능 |
|------|------|
| `scripts/validate-wiki.sh` | 프론트매터, 위키링크, 인덱스 등재, log.md 형식, 중복 파일 검증 |
| `scripts/check-pii.sh` | 전화번호, 이메일, 주민번호 패턴 스캔 |
| `.git/hooks/pre-commit` | 위 2개 스크립트를 커밋 전 자동 실행 |
| `.gitignore` | raw/, .obsidian/workspace, 모델 바이너리, .DS_Store |

---

## 1.4 위키 콘텐츠 + 인제스트된 소스
> tag: #workflow, #main-feature

### 1.4.1 위키 콘텐츠

**최종 위키 규모: 26개 페이지**

| 카테고리 | 수량 | 페이지 목록 |
|---------|------|------------|
| 엔티티 | 8 | andrej-karpathy, farzapedia, llmbase, secall, obsidian, qmd, dji-o3-air-unit, nanovna-v2 |
| 개념 | 10 | llm-wiki, three-layer-architecture, knowledge-compounding, ingest-query-lint, rag-vs-wiki, byoai, schema-layer, memex, append-and-review, fpv-digital-transmission |
| 소스 | 6 | source-llm-wiki-gist, source-llm-wiki-community, source-append-and-review, source-wikey-design-decisions, source-dji-o3-air-unit, source-nanovna-v2-notes |
| 분석 | 2 | risks-of-llm-wiki, vision-vs-reality |
| 메타 | 3 | index.md, log.md, overview.md |

### 1.4.2 인제스트된 소스 (6건)

| # | 소스 | 유형 | 크기 | 인제스트 LLM | 생성 페이지 |
|---|------|------|------|-------------|-----------|
| 1 | Karpathy LLM Wiki 원문 gist | 마크다운 | ~12KB | Claude Code | 1 source + 2 entity + 7 concept |
| 2 | GeekNews + gist 댓글 + HN | 마크다운 | ~15KB | Claude Code | 1 source + 3 entity + 1 concept |
| 3 | Karpathy Append-and-Review 블로그 | 웹 기사 | ~4KB | Claude Code | 1 source + 1 concept |
| 4 | Wikey 설계 의사결정 7개 ADR | 개인 메모 | ~3KB | Claude Code | 1 source |
| 5 | DJI O3 Air Unit 매뉴얼 | PDF 33p | ~19MB | Claude Code | 1 source + 1 entity + 1 concept |
| 6 | NanoVNA V2 개인 노트 | 개인 메모 | ~2KB | **Codex CLI** | 1 source + 1 entity |

---

---

## 1.5 워크플로우 검증 (인제스트 · 쿼리 · 린트 · Obsidian CLI)
> tag: #workflow, #eval

### 1.5.1 인제스트 워크플로우

| 테스트 | 결과 | 상세 |
|--------|------|------|
| 소스 → 위키 페이지 생성 | PASS | 6건 모두 정상 생성 |
| 교차참조 (위키링크) | PASS | 기존 페이지에 새 소스 참조 자동 추가 |
| 멱등성 | PASS | 동일 소스 재인제스트 시 중복 생성 없음 |
| index.md 자동 갱신 | PASS | 새 페이지 등재 + 기존 항목 소스 수 갱신 |
| log.md 기록 | PASS | 인제스트 7건 모두 기록 |
| PDF 청킹 (33p) | PASS | 3분할 읽기 → 섹션 인덱스 → 합성 |
| validate-wiki.sh | PASS | 매 인제스트 후 통과 |

### 1.5.2 쿼리 워크플로우

| 쿼리 유형 | 질문 | 결과 | 저장 |
|----------|------|------|------|
| 단순 사실 | 3계층 아키텍처 설명 | PASS — 직접 참조 | 불필요 |
| 교차 합성 | 비전 vs 현실 비교 | PASS — 2소스 종합 | vision-vs-reality |
| 분석 | LLM Wiki의 리스크 | PASS — 5대 리스크 도출 | risks-of-llm-wiki |
| 엔티티 조회 | Karpathy 정보 | PASS — 직접 참조 | 불필요 |
| 빈 결과 | 양자 컴퓨팅 | PASS — "소스 없음" 응답 | 불필요 |

### 1.5.3 린트 워크플로우

| 의도적 결함 | 감지 방법 | 결과 |
|------------|----------|------|
| 고아 페이지 (인바운드 링크 없음) | LLM 린트 | PASS — 감지 |
| 깨진 위키링크 | validate-wiki.sh | PASS — 감지 (exit 1) |
| 인덱스 미등재 | validate-wiki.sh | PASS — 감지 (exit 1) |

수정 후 재검증 PASS. 고아 페이지는 스크립트 범위 외이므로 LLM 린트에서 보완.

### 1.5.4 Obsidian CLI 연계

| 명령 | 결과 |
|------|------|
| `obsidian search query="LLM Wiki"` | PASS |
| `obsidian read file="index"` | PASS |
| `obsidian backlinks file="overview"` | PASS |
| `obsidian tags sort=count counts` | PASS |
| `obsidian property:set` | PASS |

---

---

## 1.6 BYOAI 검증 (Codex CLI)
> tag: #eval, #main-feature

### 1.6.1 Codex CLI (GPT-5.4) — 접근 테스트

```
codex exec -C /Users/denny/Project/wikey "Read AGENTS.md and summarize..."
→ 모델: gpt-5.4, sandbox: read-only
→ AGENTS.md + wikey.schema.md 정상 읽기
→ 한국어 3항목 요약 생성
→ 토큰: 35,281
```

- Codex가 `AGENTS.md`의 "스키마 먼저 읽기" 지시를 따라 `wikey.schema.md`까지 자발적으로 읽음
- 한국어 문서 이해 및 요약 품질 양호

### 1.6.2 Codex CLI — 인제스트 테스트

```
codex exec --full-auto -C /Users/denny/Project/wikey "인제스트 세션 수행..."
→ 모델: gpt-5.4, sandbox: workspace-write
→ NanoVNA V2 노트 → source + entity 2페이지 생성
→ index.md, log.md 갱신
→ validate-wiki.sh PASS
```

**일관성 검증 (Claude Code vs Codex 비교):**

| 항목 | Claude Code 생성 | Codex 생성 | 일치 |
|------|-----------------|-----------|------|
| 프론트매터 필드 | title, type, created, updated, sources, tags | 동일 | O |
| 파일명 규칙 | 소문자, 하이픈 | 동일 | O |
| 위키링크 형식 | `[[page-name]]` | 동일 | O |
| index.md 등재 형식 | `- [[name]] — 설명 (소스: N개)` | 동일 | O |
| log.md 항목 형식 | `## [YYYY-MM-DD] type \| title` | 동일 | O |
| validate-wiki.sh | PASS | PASS | O |

**결론: 두 LLM이 동일한 스키마를 읽고 동일한 컨벤션으로 위키를 생성. BYOAI 설계 검증 완료.**

### 1.6.3 Codex CLI — 교차 린트

```
codex exec --full-auto "린트 세션 수행... JSON으로 결과 출력"
→ 토큰: 71,790
→ 4건 발견
```

| # | 유형 | 파일 | 판정 |
|---|------|------|------|
| 1 | broken_wikilink | source-wikey-design-decisions.md | 오탐 — Obsidian 파이프 문법 `[[byoai\|BYOAI]]`는 정상 |
| 2 | missing_from_index | overview.md | 의도적 — 메타 페이지는 인덱스에 미등재 |
| 3 | orphan_page | overview.md | 의도적 — 메타 페이지 |
| 4 | consistency_mismatch | overview.md | **유효** — 인제스트 후 통계 미갱신 (소스 5→6, 엔티티 7→8) |

Issue 4는 Codex 인제스트 후 overview.md 통계가 업데이트되지 않은 실제 불일치. 수정 완료.

**교차 린트의 가치**: Claude Code가 놓친 overview 불일치를 Codex가 발견. 다른 LLM의 독립적 시각이 품질 보완에 효과적.

---

---

## 1.7 로컬 LLM 검증 (Gemma 4 + vLLM-Metal)
> tag: #eval, #infra

### 1.7.1 모델 설치

```
ollama pull gemma3
→ gemma3:latest (3.3 GB)
→ Ollama v0.18.2
```

계획에서는 "Gemma 4"로 표기했으나, 2026-04-11 기준 Ollama에서 사용 가능한 최신 Gemma 계열은 `gemma3`. 동일 목적(로컬 쿼리)으로 대체 검증.

### 1.7.2 위키 쿼리 테스트

**테스트 1: 단일 문서 쿼리**

```
cat wiki/index.md wiki/concepts/fpv-digital-transmission.md |
  ollama run gemma3 "FPV 디지털 영상 전송 기술의 핵심 특징을 3가지로 요약"
```

결과:
1. 높은 화질 — HD/4K 고화질 영상 제공
2. 낮은 지연 — 28-40ms 실시간 비행 제어
3. 안정적인 전송 — 듀얼밴드, 듀얼 편파 안테나

- 한국어 답변 O
- 소스 인용 시도 O (형식은 `[[source-dji-o3-air-unit.md]]`로 약간 부정확)
- 위키 내용 기반 답변 O

**테스트 2: 교차 문서 + "근거 없음" 규칙**

```
cat local-llm/system-prompt.md wiki/index.md wiki/entities/nanovna-v2.md wiki/concepts/rag-vs-wiki.md |
  ollama run gemma3 "NanoVNA V2와 RAG-vs-Wiki 개념의 공통점이 있다면?"
```

결과: "직접적인 공통점은 확인할 수 없습니다."

- 시스템 프롬프트의 "근거 없음" 안내 규칙 준수 O
- 두 주제가 연결되지 않음을 올바르게 판단 O

### 1.7.3 쿼리 확장 테스트 (Phase 2 사전 검증)

```
echo "LLM Wiki의 실패 모드는?" |
  ollama run gemma3 "검색할 동의어와 관련 키워드를 5개 생성"
```

생성된 키워드:
1. 모델 실패 (Model Failure) / 실패 사례 (Failure Case)
2. 환각 (Hallucination) / 거짓 정보 생성 (False Information Generation)
3. 편향 (Bias) / 차별적 결과 (Discriminatory Outcome)
4. 제한된 지식 (Limited Knowledge) / 지식 갭 (Knowledge Gap)
5. 컨텍스트 이해 부족 (Lack of Context Understanding) / 맥락 이해 실패 (Contextual Understanding Failure)

- 한영 병렬 키워드 생성 O
- 의미적 관련성 높음 O
- Phase 2 쿼리 확장 파이프라인에서 사용 가능한 수준

### 1.7.4 오프라인 테스트

스킵 (네트워크 차단 필요). Ollama가 로컬에서 모델을 실행하므로 원리적으로 오프라인 동작 보장.

### 1.7.5 Gemma 3 → Gemma 4 업그레이드 (Phase 1 완료 후)

초기 검증은 Gemma 3 (4B, 3.3GB)로 수행. 이후 인프라 구축 단계에서 Gemma 4로 업그레이드:

```
Ollama 0.18.2 → 0.20.5 (curl install.sh로 업데이트)
gemma3 (4B, 3.3GB) → gemma4 (12B, 9.6GB)
```

**Gemma 4 개선 사항:**
- Thinking 프로세스 내장 (CoT 추론 후 답변)
- 위키링크 `[[페이지명]]` 인용 정확도 향상
- 128K 컨텍스트 윈도우 (Gemma 3: 8K)
- 멀티모달 지원 (텍스트 + 이미지)

**추가 인프라 구축:**
- `local-llm/Modelfile` — Gemma 4 기반 wikey 커스텀 모델 (시스템 프롬프트 내장, temp 0.3, ctx 32K)
- `local-llm/wikey-query.sh` — CLI 래퍼 (쿼리/확장/리랭킹 3모드)
- `local-llm/README.md` — 아키텍처, 듀얼 백엔드, Phase별 로드맵

### 1.7.6 vLLM-Metal 설치

Ollama(인터랙티브)와 별도로, OpenAI-호환 API 서버로 vLLM-Metal 설치:

```
vllm-metal 0.2.0 (vLLM 0.19.0 기반)
→ ~/.venv-vllm-metal/
→ Apple Silicon MLX 백엔드
→ vllm serve google/gemma-4-12b-it --port 8000
```

**듀얼 백엔드 전략:**
- Ollama: 터미널 대화, 스크립트, 빠른 조회 (Phase 1-2)
- vLLM-Metal: OpenAI API 호환, 배치 처리, 동시 요청 (Phase 3+)

---

---

## 1.8 패키징
> tag: #infra, #docs

### 1.8.1 배포 파일 구조 (11/11 확인)

```
wikey/
├── README.md                  ✅ 영문, Quick Start 포함
├── wikey.schema.md            ✅ 마스터 스키마
├── CLAUDE.md                  ✅ Claude Code 어댑터
├── AGENTS.md                  ✅ Codex CLI 어댑터
├── local-llm/
│   ├── README.md              ✅ 아키텍처, 듀얼 백엔드, Phase별 로드맵
│   ├── Modelfile              ✅ Gemma 4 + 시스템 프롬프트 내장
│   ├── system-prompt.md       ✅ 시스템 프롬프트 원본
│   └── wikey-query.sh         ✅ CLI 래퍼 (쿼리/확장/리랭킹)
├── wiki/
│   ├── index.md               ✅ 콘텐츠 인덱스
│   ├── log.md                 ✅ 활동 로그
│   └── overview.md            ✅ 위키 개요
├── scripts/
│   ├── validate-wiki.sh       ✅ 정합성 검증
│   └── check-pii.sh           ✅ PII 스캔
└── .gitignore                 ✅ raw/, .obsidian, 모델 바이너리
```

### 1.8.2 README 상태

- 영문 작성 완료
- Quick Start (Clone → Obsidian → 첫 인제스트) 포함
- BYOAI 프로바이더 비교표 포함
- Phase 1 → **Complete** 표기

### 1.8.3 공개 저장소

Phase 2에서 결정 예정. Phase 1에서는 GitHub private 저장소로 운영.

---

---

## 1.9 핵심 발견 및 교훈
> tag: #docs

### 1.9.1 BYOAI가 실제로 작동한다

- Claude Code와 Codex CLI가 **동일한 스키마 파일**을 읽고 **동일한 컨벤션**으로 위키를 생성
- `validate-wiki.sh`가 프로바이더 간 일관성을 자동으로 검증하는 안전망 역할
- 교차 린트에서 다른 LLM이 새로운 관점의 문제를 발견 (overview 통계 불일치)

### 1.9.2 스키마가 LLM 행동을 결정한다

- `wikey.schema.md` + 프로바이더별 어댑터(`CLAUDE.md`, `AGENTS.md`)로 LLM 행동을 제어
- 프론트매터 규칙, 위키링크 형식, 인덱스 갱신 절차가 스키마에 정의되어 있으므로 LLM이 달라도 결과가 일관적
- 로컬 LLM도 축약 시스템 프롬프트(`local-llm/system-prompt.md`)로 "근거 없으면 말하지 않기" 규칙을 따름

### 1.9.3 pre-commit hook이 품질을 보장한다

- 10개 커밋 모두 `validate-wiki.sh` + `check-pii.sh` 통과 후 커밋
- 린트 테스트에서 의도적 결함을 넣었을 때 hook이 커밋을 차단 (exit 1)
- LLM이 실수해도 스크립트가 마지막 방어선 역할

### 1.9.4 로컬 LLM은 쿼리에 충분하다

- Gemma 3 (3.3GB)로 초기 검증 후 Gemma 4 (9.6GB)로 업그레이드
- Gemma 4는 Thinking 프로세스 내장, 위키링크 인용 정확도 크게 향상
- 쿼리 확장(동의어/키워드 생성)에서 Phase 2 활용 가능성 확인
- 위키 수정(인제스트/린트)은 클라우드 LLM에 위임하는 전략이 적절

### 1.9.5 듀얼 서빙 백엔드가 Phase 확장에 필수적이다

- Phase 1-2: Ollama (인터랙티브) — 터미널 대화, 스크립트 파이핑
- Phase 3+: vLLM-Metal (API 서버) — 배치 리랭킹, 동시 요청, MCP 연동
- 두 백엔드 모두 동일한 Gemma 4 모델을 사용하므로 결과 일관성 보장

### 1.9.6 PDF 청킹 전략이 유효하다

- 33p PDF를 3분할 읽기로 처리 (TOC→본문→스펙)
- Read 도구의 `pages` 파라미터로 분할 가능
- 200p+ 소스를 위한 2단계 인제스트 전략 문서화 완료

---

---

## 1.10 완료 체크리스트
> tag: #docs

### 1.10.1 필수 (Must) — 12/12

- [x] `wikey.schema.md` 작성 완료 (프로바이더 독립 마스터 스키마)
- [x] `CLAUDE.md` 경량화 (스키마 참조 + Claude 특화)
- [x] `AGENTS.md` 작성 (스키마 참조 + Codex 특화)
- [x] `local-llm/system-prompt.md` 작성
- [x] Git 초기화 + GitHub private push
- [x] `scripts/validate-wiki.sh` 동작 + pre-commit hook
- [x] `scripts/check-pii.sh` 동작
- [x] 6개 소스 인제스트 (Claude Code 5건 + Codex 1건)
- [x] 26개 위키 페이지 생성 (목표 20+)
- [x] 쿼리 5건 테스트 (분석 2건 저장)
- [x] 린트 동작 (의도적 결함 3종 감지 확인)
- [x] log.md에 활동 기록

### 1.10.2 중요 (Should) — 5/5

- [x] Codex로 1건 인제스트 성공 (NanoVNA V2)
- [x] Codex 인제스트 후 `validate-wiki.sh` 통과 (일관성 확인)
- [x] Gemma 4 로컬 위키 쿼리 동작 (Ollama + wikey-query.sh)
- [x] Obsidian Graph View 스크린샷 확인
- [x] 대용량 소스 청킹 인제스트 1건 (DJI O3 33p PDF)

### 1.10.3 선택 (Could) — 3/4

- [x] Codex 독립 린트 (교차 검증 — 4건 발견, 유효 1건)
- [x] Gemma 4 쿼리 확장 테스트 (한영 5개 키워드 생성)
- [x] README 초안 (영문)
- [ ] Gemma 4 오프라인 쿼리 테스트 (스킵 — 네트워크 차단 필요)

---

---

## 1.11 Phase 2 준비 상태
> tag: #docs, #architecture

### 1.11.1 Phase 2 준비 상태

| Phase 2 항목 | Phase 1에서의 사전 검증 | 준비도 |
|-------------|----------------------|--------|
| 한국어 검색 | Gemma 4 한국어 쿼리 동작 확인 | 준비됨 |
| LLM 다층 검색 | qmd 엔티티 등재, 아키텍처 문서화 | 설계 완료 |
| 쿼리 확장 | Gemma 4 한영 키워드 생성 + wikey-query.sh --expand | 프로토타입 완료 |
| 리랭킹 파이프라인 | vLLM-Metal 설치 + wikey-query.sh --rerank | 인프라 준비됨 |
| 커뮤니티 배포 | README + 배포 구조 14파일 확인 | 구조 준비됨 |
| fswatch 반자동 인제스트 | 수동 인제스트 6건으로 워크플로우 안정화 | 자동화 대상 확정 |
