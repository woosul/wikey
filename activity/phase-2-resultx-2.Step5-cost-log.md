---

> **상위 문서**: [`activity/phase-2-result.md`](./phase-2-result.md) · [`plan/phase-2-todo.md`](../plan/phase-2-todo.md) — 본 문서는 §2.Step5 (LLM 비용 로그) 보조 자료. 명명규칙: `phase-N-todox-<section>-<topic>.md` / `phase-N-resultx-<section>-<topic>-<date>.md` — `CLAUDE.md §문서 명명규칙·조직화` 참조.

title: LLM 비용 로그
type: log
created: 2026-04-12
updated: 2026-04-12
---

# LLM 비용 로그

> 프로바이더별 토큰 사용량 + 비용 추적. 월간 목표: $50 이하.
> 형식: `## [YYYY-MM-DD] provider | task-type | description`
> provider: claude-code | gemini | ollama-local | codex
> task-type: ingest | query | lint | summarize
> 이 파일은 append-only. `scripts/cost-tracker.sh`로 관리한다.

---

## 요금 기준표 (2026-04 기준)

| 프로바이더 | 모델 | Input $/1M | Output $/1M | 비고 |
|-----------|------|-----------|------------|------|
| Claude Code | Opus 4 | $15.00 | $75.00 | 캐시 히트 시 input $1.50 |
| Claude Code | Sonnet 4 | $3.00 | $15.00 | 캐시 히트 시 input $0.30 |
| Gemini | 2.5 Flash | $0.15 | $0.60 | 100만 토큰 컨텍스트 |
| Codex | GPT-4.1 | $2.00 | $8.00 | codex CLI 기본 |
| Ollama | Gemma 4 12B | $0.00 | $0.00 | 로컬 (전기세만) |
| Ollama | Qwen3-Embed | $0.00 | $0.00 | 로컬 임베딩 |

---

## [2026-04-10] claude-code | ingest | Karpathy LLM Wiki 원문 + 커뮤니티 + Append-and-Review

- task: 3건 인제스트 (원문, 커뮤니티 반응, append-and-review 노트)
- pages_created: 12 (entities 3, concepts 7, sources 3, analyses 1)
- est_input_tokens: ~50K (소스 3건 + 위키 읽기)
- est_output_tokens: ~30K (12 페이지 생성)
- est_cost_usd: $3.00
- notes: Phase 1 초기 인제스트, Opus 4 사용

## [2026-04-10] claude-code | ingest | Wikey 설계 의사결정 + DJI O3 + NanoVNA

- task: 3건 인제스트 (설계 메모, PDF 매뉴얼, 개인 노트)
- pages_created: 5 (entities 2, concepts 1, sources 3)
- est_input_tokens: ~80K (PDF 33p + 소스 2건 + 위키 읽기)
- est_output_tokens: ~20K (5 페이지 생성)
- est_cost_usd: $2.70
- notes: DJI O3 PDF는 3분할 읽기 (Phase 1 청킹 테스트)

## [2026-04-10] claude-code | query | 쿼리 워크플로우 검증 5건

- task: 5건 쿼리 (단순 사실, 교차 합성, 분석, 엔티티, 빈 결과)
- pages_created: 2 (analyses 2)
- est_input_tokens: ~40K (위키 페이지 다수 읽기)
- est_output_tokens: ~10K (분석 2건 생성)
- est_cost_usd: $1.35
- notes: 쿼리 워크플로우 검증, 분석 저장 기준 확립

## [2026-04-10] claude-code | lint | 린트 워크플로우 검증

- task: 의도적 결함 3건 생성 → 감지 → 수정
- est_input_tokens: ~20K
- est_output_tokens: ~5K
- est_cost_usd: $0.68
- notes: validate-wiki.sh 감지 확인, 고아 페이지는 LLM 린트 필요

## [2026-04-11] claude-code | infra | Phase 2 Step 1-4 인프라 구축

- task: PARA 재구조화, qmd 파이프라인, 한국어 검색, 반자동 인제스트
- est_input_tokens: ~200K (소스 코드 분석, 벤치마크, 문서 동기화)
- est_output_tokens: ~100K (스크립트 7개, 설정 파일, 문서)
- est_cost_usd: $10.50
- notes: 11개 커밋, 1일 집중 세션. 대부분 인프라 코드 작성

## [2026-04-11] gemini | summarize | 대용량 PDF 2건 요약

- task: 파워디바이스 37p (3MB) + TCP/IP 56p (45MB) Gemini 요약
- model: gemini-2.5-flash
- est_input_tokens: ~120K (PDF 2건 base64)
- est_output_tokens: ~5K (섹션 인덱스 2건)
- est_cost_usd: $0.02
- notes: Gemini 2.5 Flash 초저가, 대용량 처리에 최적

## [2026-04-11] ollama-local | infra | Contextual Retrieval + 벤치마크

- task: Gemma 4로 29문서 맥락 프리픽스 생성 + 50건 벤치마크
- model: gemma4:12b
- est_input_tokens: ~300K
- est_output_tokens: ~50K
- est_cost_usd: $0.00
- duration_min: ~20
- notes: 로컬 실행, 비용 $0. 전기세 약 ₩50 추정 (M-series Mac)


## [2026-04-12] ollama-local | query | Gemma 4 로컬 쿼리 5건 (Step 5-1-4 검증)

- task: Gemma 4 로컬 쿼리 5건 (Step 5-1-4 검증)
- est_cost_usd: $0.00
- duration_min: 4
- notes: 5건 평균 44초, basic backend, 모두 정상 응답+인용 포함

## [2026-04-12] codex | lint | Codex CLI 교차 검증 린트 (Step 5-1-3)

- task: Codex CLI 교차 검증 린트 (Step 5-1-3)
- est_input_tokens: ~71000
- est_output_tokens: ~3000
- est_cost_usd: $0.17
- notes: GPT-4.1, validate+pii+인덱스+위키링크 검사, 이슈 1건 (파이프 별칭 파싱)

## [2026-04-12] gemini | summarize | 파워디바이스 37p PDF 요약 (Step 5-1-2)

- task: 파워디바이스 37p PDF 요약 (Step 5-1-2)
- est_input_tokens: ~60000
- est_output_tokens: ~2000
- est_cost_usd: $0.01
- notes: Gemini 2.5 Flash, 파이프라인 검증용

## [2026-04-12] claude-code | ingest | 파워디바이스 위키 통합 + Step 5 인프라 (5-1-2, 5-2-1)

- task: 파워디바이스 위키 통합 + Step 5 인프라 (5-1-2, 5-2-1)
- est_input_tokens: ~80000
- est_output_tokens: ~20000
- est_cost_usd: $2.70
- pages_created: 1
- notes: Gemini 요약 → source 페이지 1건, cost-tracker.sh, phase-2-resultx-2.Step5-cost-log.md
