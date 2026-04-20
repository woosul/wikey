# Phase 3: Todo — Obsidian 플러그인 (wikey-core + wikey-obsidian)

> 기간: 2026-04-12 ~ 2026-04-20
> 상태: **완료**. 잔여는 `plan/phase-4-todo.md`로 이관.
> 전제: Phase 2 완료 (필수 7/7, 중요 6/6)
> 인프라: Ollama 0.20.5 + Qwen3 8B + Qwen3.6:35b-a3b + Gemma4 26B, qmd 2.1.0 (vendored), Node.js 22.17.0
> 번호: `N / N.M` 계층. 주제 그룹은 `activity/phase-3-result.md`와 1:1 미러.
> 상세 결과: `activity/phase-3-result.md`

---

## 1. 개요 및 타임라인

- [x] 1.1 타임라인 (8일간 6회 주요 세션)
- [x] 1.2 Phase 재구성 — Phase 4 `인제스트 고도화 + 지식 그래프`로 리네임, Phase 5+에 URI 참조·기업 KB 이관
- [x] 1.3 v6 인제스트 코어 재설계 개요 (2026-04-19 저녁 세션)
- [x] 1.4 2026-04-20 잔여 정리 세션 개요

## 2. wikey-core 코어 구현

- [x] 2.1 프로젝트 스캐폴딩 (루트 package.json + npm workspaces, `.obsidian/plugins/wikey/` 심볼릭 링크)
- [x] 2.2 `config.ts` — INI 파싱, `resolveProvider`
- [x] 2.3 `wiki-ops.ts` — `createPage`(경로 검증), `updateIndex`(writtenPages 결정적 backfill), `appendLog`, `extractWikilinks`, `stripBrokenWikilinks`
- [x] 2.4 `llm-client.ts` — Gemini / Anthropic / OpenAI / Ollama 4 프로바이더 + `fetchModelList` + Gemini Pro 필터·정렬(v7-6)
- [x] 2.5 `query-pipeline.ts` — qmd exec, 한국어 전처리, 확정적·해요체 합성 프롬프트, 한국어→영문 키워드 cross-lingual
- [x] 2.6 `ingest-pipeline.ts` — v6 3-stage + 5-tier PDF chain + 챕터 분할 + `assertNotWikiPath` 가드

## 3. Obsidian 플러그인 MVP

- [x] 3.1 `main.ts` + 어댑터 — WikeyPlugin, ObsidianWikiFS (hidden folder `vault.adapter` fallback), ObsidianHttpClient
- [x] 3.2 `settings-tab.ts` — Environment, API 키, 고급 LLM, Ingest Model / Prompt, Schema Override, 비용, 검증·PII, 인덱스, Auto Ingest
- [x] 3.3 `sidebar-chat.ts` — 채팅 UI, Audit · Ingest · Dashboard 패널, 위키링크 클릭
- [x] 3.4 `commands.ts` — `Cmd+Shift+I` 인제스트, URI 프로토콜
- [x] 3.5 `status-bar.ts` — 페이지 수 + 통계 모달

## 4. UI/UX 고도화

- [x] 4.1 메시지 레이아웃 (Q/A 아이콘 삭제, 질문 배경블록 radius 8, 답변 full-width, 좌우 여백 0, purple accent)
- [x] 4.2 인제스트 UI (drop header + Add + filesize + Cloud/Local + Ingest, drag/drop, 진행 스트라이프)
- [x] 4.3 UI 영문 전환 + 표준화 (dashboard / audit / inbox / settings / help)
- [x] 4.4 Dashboard 숫자 통일 (audit 기반 Raw Sources · ingested/total per PARA)
- [x] 4.5 Audit 패널 UI — 체크박스 + provider/model 선택 + 프로그레스바 + auto-move PARA
- [x] 4.6 Inbox UI — checkbox + Move(auto-ingest) + Delay
- [x] 4.7 설정 탭 정리 (Ingest Model 섹션 추가, 환경 탐지 6항목)
- [x] 4.8 Ingest 패널 UI 재설계 Before → After (2026-04-19)
- [x] 4.9 자동 Ingest 도입 (debounce interval)
- [x] 4.10 UI 변경 9건 (v6 저녁 세션)

## 5. 인제스트 파이프라인 v1~v6 + 3-stage 재설계

- [x] 5.1 인제스트 파이프라인 개선 (MarkItDown + 5-tier PDF fallback, maxOutputTokens 65K, LLM 파일명 경로 strip)
- [x] 5.2 Graphify-style 챕터 분할 (12K+ → `##` 헤더 기준 split → 요약 + chunk 병합)
- [x] 5.3 v6 새 아키텍처 (3-Stage Pipeline + Schema-Guided)
- [x] 5.4 v6 구현 (Phase A+B+C+D + C-boost)
- [x] 5.5 v6.1 실험 (temperature=0 + seed=42, CV 악화로 롤백)
- [x] 5.6 audit panel auto-move PARA (인제스트 후 classify→PARA 라우팅)
- [x] 5.7 wiki/ self-cycle 가드 (`assertNotWikiPath` + 7 tests, commit 0fa0a19)

## 6. 스키마 안정화 + 결정성 측정 (v7 시리즈)

- [x] 6.1 v6 결정성 Greendale 5-run (commit 2e47c3b) — Total CV 12.9% / Concepts 21.1% (작은 파일 한계 발견)
- [x] 6.2 v7-4 자동 결정성 측정 스크립트 `scripts/measure-determinism.sh` (commit b95b2aa)
- [x] 6.3 v7-6 Gemini 모델 dropdown filter+sort (commit 8add8c4) — Pro 가시성
- [x] 6.4 v7-1 Concept decision tree + v7-2 추가 anti-pattern (commit 61c7830)
- [x] 6.5 v7-5 `.wikey/schema.yaml` 사용자 override — 27건 신규 테스트 (186 pass)
- [~] 6.6 v7-1/2/5 통합 결정성 재측정 시도 → race/UI reload 이슈 → **Phase 4 §4-11**

## 7. 문서 전처리 (PDF · OCR tier chain)

- [x] 7.1 E2E 인제스트 테스트 (파워디바이스 PDF 37p × 7.6분)
- [x] 7.2 사전 준비: markitdown-ocr fallback
- [x] 7.3 markitdown-ocr fallback E2E + **tier 6 신규** page-render Vision OCR (commit f35d3b1)
- [x] 7.4 OMRON HEM-7600T 48p auto-move PARA (§7.3와 통합 검증, DDC 600 정확)

## 8. 프롬프트 시스템 (single prompt + override)

- [x] 8.1 단일 프롬프트 모델 리팩토링 — bundled `prompts/ingest_prompt_basic.md` + `.wikey/ingest_prompt.md` override + 설정 탭 Edit/Reset
- [x] 8.2 prompt override E2E + WikiFS hidden folder bug fix (commit 3e472fb)

## 9. 로컬 LLM 모델 검증

- [x] 9.1 로컬 LLM 모델 평가 — qwen3:8b(인제스트 기본), gemma4:26b(쿼리 전용), qwen3:14b 탈락, qwen3.6:35b-a3b 인제스트 옵션
- [x] 9.2 `provider-defaults.ts` 단일 소스 리팩토링 (세션 종반)

## 10. 디버깅 · 운영 안정성

- [x] 10.1 디버깅 5건 해결 (CORS, PATH, ABI, qmd 경로, localhost)
- [x] 10.2 Could 완료 3/4 (chat history / Sync 흡수 / BRAT v0.1.0-alpha)
- [x] 10.3 H3 qmd DB 동시 접근 (busy_timeout=5000)
- [x] 10.4 M3 설정 파일 통합 (`wikey.conf` + `credentials.json` 공유)
- [x] 10.5 발견 이슈 5건 → 4건 수정 + 회귀 검증 (04-18 세션)
- [x] 10.6 부수 수정 (pdftotext PATH 보강, LLM 타임아웃 60→300s)
- [x] 10.7 wiki/ 인제스트 아티팩트 정리
- [x] 10.8 근본 수정 11건 상세 (04-19)
- [x] 10.9 Lint 세션 (commit a739a20) — validate-wiki PASS, 64E/53C/11S

## 11. E2E 자동 검증 + CDP

- [x] 11.1 E2E 자동 실행 9 시나리오 (04-18)
- [x] 11.2 Obsidian CDP E2E 패턴 도입 (`reference_obsidian_cdp_e2e.md`)
- [x] 11.3 검증 결과 (04-19)
- [x] 11.4 검증 결과 최종
- [x] 11.5 Obsidian UI 수동 테스트 (2026-04-20 사용자 검증)

## 12. Eng 리뷰 이슈 + CEO 추가

- [x] 12.1 HIGH — H1 프롬프트 DRY, H2 execFile, H3 qmd busy_timeout
- [x] 12.2 MEDIUM — M1 Sync 경고, M2 경로 검증, M3 설정 통합, M4 cost fallback
- [x] 12.3 CEO 추가 — Obsidian URI 프로토콜, 인제스트 진행률 단계 표시

## 13. CLI 포팅

- [x] 13.1 `classify.ts` + `scripts-runner.ts` — validate-wiki / check-pii / reindex / cost-tracker exec 래퍼

## 14. 코드 규모 추이 + 커밋 이력

- [x] 14.1 ~ 14.12 — 코드 규모 타임라인 (Step 3 완료 → 04-12 저녁 → 04-13 → 04-14 → 04-18 → 04-19 → 04-19 저녁 → 04-20) 및 커밋 7/12/8건 요약

## 15. Phase 4 이관 + Phase 3 종료 선언

> Phase 3 완료 시점 열어둔 항목 → `plan/phase-4-todo.md`

- [x] 15.1 v7-3 Anthropic-style contextual chunk 재작성 → §4-8
- [x] 15.2 OCR 중복 호출 캐싱 → §4-1.4
- [x] 15.3 canonicalize stripBrokenWikilinks on source_page → §4-7
- [x] 15.4 Stage 2/3 프롬프트 사용자 override → §4-4
- [x] 15.5 OCR API 키 process listing 노출 제거 → §4-1.5
- [x] 15.6 measure-determinism.sh 안정성 보강 + 재측정 → §4-11
- [x] 15.7 Phase 3 종료 선언 (2026-04-20)
