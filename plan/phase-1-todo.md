# Phase 1: Todo — 기반 인프라 + 워크플로우 검증 + BYOAI

> 기간: 2026-04-10 ~ 2026-04-11
> 상태: **완료** (필수 12/12, 중요 5/5, 선택 3/4)
> 번호: `N / N.M` 계층. 주제 그룹은 `activity/phase-1-result.md`와 1:1 미러.
> 상세 결과: `activity/phase-1-result.md`

---

## 1.1 개요 및 타임라인
> tag: #docs, #architecture

- [x] 1.1 Phase 1 타임라인 (2026-04-10 착수 → 04-11 완료)

## 1.2 스키마 + 프로바이더 설정
> tag: #framework, #architecture

- [x] 2.1 `wikey.schema.md` 작성 — 3계층 아키텍처(raw/wiki/index), 워크플로우, 페이지 컨벤션, 핵심 원칙 정의
- [x] 2.2 프로바이더 독립 스키마 — Anthropic/OpenAI/Gemini/Ollama 모두 동일 schema로 동작
- [x] 2.3 `local-llm/wikey.conf` 초안 — WIKEY_BASIC_MODEL 단일 토글

## 1.3 검증 인프라 (validate · pii · pre-commit)
> tag: #ops, #utility

- [x] 3.1 `scripts/validate-wiki.sh` — 프론트매터 / 위키링크 / index 등재 / log 형식 / 중복 파일명 5가지 검증
- [x] 3.2 `scripts/check-pii.sh` — 개인정보 패턴 탐지 (주민번호·전화·이메일·계좌)
- [x] 3.3 Git pre-commit hook — validate-wiki + check-pii 자동 실행

## 1.4 위키 콘텐츠 + 인제스트된 소스
> tag: #workflow, #main-feature

- [x] 4.1 wiki 스켈레톤 — `wiki/{entities,concepts,sources,analyses}` + `index.md` + `log.md` + `overview.md`
- [x] 4.2 인제스트된 소스 6건 — (1) llm-wiki.md (2) idea-comment.md (3) append-and-review-note.md (4) wikey-design-decisions.md (5) nanovna-v2-notes.md (6) DJI O3 Air Unit 매뉴얼

## 1.5 워크플로우 검증 (인제스트 · 쿼리 · 린트 · Obsidian CLI)
> tag: #workflow, #eval

- [x] 5.1 인제스트 워크플로우 5건 — Claude Code로 raw/→wiki/ 파이프라인, 프론트매터·위키링크·인덱스·로그 자동 생성 검증
- [x] 5.2 쿼리 워크플로우 5건 — 위키 검색 + 합성 답변 + 인용 추적
- [x] 5.3 린트 워크플로우 — 고아 페이지 / 깨진 링크 / 인덱스 누락 / 삭제된 소스 의존 자동 감지
- [x] 5.4 Obsidian CLI 연계 — search / backlinks / property:set / tags 4개 기본 도구 동작 검증

## 1.6 BYOAI 검증 (Codex CLI)
> tag: #eval, #main-feature

- [x] 6.1 Codex CLI 0.118.0 (GPT-5.4) 접근 테스트 — API 키·모델 동작 확인
- [x] 6.2 Codex CLI 인제스트 테스트 — 동일 소스로 Claude Code 결과와 비교, 프론트매터/구조 일치
- [x] 6.3 Codex CLI 교차 린트 — 독립 agent가 Claude Code 결과 검증, validate/pii PASS, false positive 1건

## 1.7 로컬 LLM 검증 (Gemma 4 + vLLM-Metal)
> tag: #eval, #infra

- [x] 7.1 모델 설치 — Ollama 0.20.5 + `gemma4:12b` 다운로드 + 헬스체크
- [x] 7.2 위키 쿼리 테스트 5건 — 로컬 basic backend 평균 44초, 모두 정상 응답 + 위키링크 인용
- [x] 7.3 쿼리 확장 테스트 (Phase 2 사전 검증) — Gemma 4로 쿼리 확장 → qmd에 전달 가능성 검증
- [x] 7.4 오프라인 테스트 — 네트워크 차단 상태에서 인제스트 + 쿼리 + 린트 모두 동작
- [x] 7.5 Gemma 3 → Gemma 4 업그레이드 (Phase 1 완료 후) — thinking 모델 전환, 답변 품질 개선
- [x] 7.6 vLLM-Metal 0.2.0 설치 — M-series 배치 추론 백엔드 (Phase 2+ 활용)

## 1.8 패키징
> tag: #infra, #docs

- [x] 8.1 배포 파일 구조 11/11 확인 — README / LICENSE / CONTRIBUTING / wikey.schema.md / scripts/ / local-llm/ / raw/ 스켈레톤 / wiki/ 스켈레톤 / .env.example / CLAUDE.md / AGENTS.md
- [x] 8.2 README "5분 시작 가이드" + 4가지 사용자 시나리오 (Claude Code / Codex / 로컬 / BYOAI)
- [x] 8.3 공개 저장소 — GitHub public 준비, .gitignore로 raw/ + .env + credentials 보호

## 1.9 핵심 발견 및 교훈
> tag: #docs

- [x] 9.1 BYOAI가 실제로 작동한다 — Codex + Claude Code + Gemma 모두 동일 스키마로 동작
- [x] 9.2 스키마가 LLM 행동을 결정한다 — wikey.schema.md 가 LLM이 무엇을 할지 결정
- [x] 9.3 pre-commit hook이 품질을 보장한다 — 커밋 실패 사례에서 학습
- [x] 9.4 로컬 LLM은 쿼리에 충분하다 — 인제스트는 품질 한계 있음
- [x] 9.5 듀얼 서빙 백엔드가 Phase 확장에 필수적이다 — Ollama(단일) + vLLM-Metal(배치)
- [x] 9.6 PDF 청킹 전략이 유효하다 — 대용량 매뉴얼을 구조화된 wiki로 환원

## 1.10 완료 체크리스트
> tag: #docs

- [x] 10.1 필수 (Must) — 12/12
- [x] 10.2 중요 (Should) — 5/5
- [x] 10.3 선택 (Could) — 3/4 (Phase 2 "Obsidian 플러그인 프로토타입"만 Phase 3으로 이월)

## 1.11 Phase 2 준비 상태
> tag: #docs, #architecture

- [x] 11.1 Phase 2 착수 전제 충족 — wikey.schema.md 확정, validate/pii/log 인프라 안정, BYOAI 검증 완료, 로컬 LLM 백엔드 준비. Phase 2 PARA 재구조화 + qmd 연동 즉시 진입 가능.
