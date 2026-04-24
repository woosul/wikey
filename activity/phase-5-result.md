# Phase 5: 튜닝·고도화·개선·확장 — 활동 기록

> 기간: Phase 4 (본체 완성) 완료 후 — 착수 시 갱신.
> 상태: **skeleton** — 2026-04-22 Phase 재편으로 생성. 실제 진행 시 subject 별 타임라인을 아래에 채운다.
> 전제: Phase 4 본체에서 원본 → wiki ingest 프로세스가 wiki 재생성 유발 없이 돌아가는 구조가 확정되어 있다. 본 Phase 는 성능·품질·범위 확장과 self-extending 구조를 덧붙이되, 기존 wiki 재생성을 요구하지 않는 범위로 한정.
> 구성 원칙: 번호·제목·태그는 `plan/phase-5-todo.md` 와 1:1 mirror. subject 내부는 시간 순 타임라인 + 수치/커밋/파일경로 증거 보존.
> 이력: 2026-04-22 Phase 재편으로 Phase 4 의 일부 subject (§4.4.1/.2/.3, §4.5.1.7.1/.4/.6/.7, §4.5.2 일부, §4.5.3/.4/.5) 를 본체 완성 정의 ("wiki 재생성 없음") 기준으로 이관해 신규 Phase 5 생성. 기존 Phase 5 (웹) 는 Phase 6 으로 이동 (`plan/phase-6-todo.md`).

## 관련 문서

- **Todo mirror**: [`plan/phase-5-todo.md`](../plan/phase-5-todo.md)
- **보조 문서**: 착수 시 `phase-5-todox-<section>-<topic>.md` · `phase-5-resultx-<section>-<topic>-<date>.md` 형식으로 추가 (`CLAUDE.md §문서 명명규칙·조직화` 참조).
- **프로젝트 공통**: [`plan/decisions.md`](../plan/decisions.md) · [`plan/plan_wikey-enterprise-kb.md`](../plan/plan_wikey-enterprise-kb.md).

---

## 5.1 검색 재현율 고도화
> tag: #eval, #engine

(착수 전 — 2026-04-22 Phase 4 §4.4.1 에서 이관. Phase 4 §4.5.1.7.3 실측 완료 + 재현율 개선 실험 착수 시 타임라인 시작.)

---

## 5.2 지식 그래프 · 시각화
> tag: #main-feature, #utility

(착수 전 — 2026-04-22 Phase 4 §4.4.2/§4.4.3 에서 이관.)

---

## 5.3 인제스트 증분 업데이트
> tag: #workflow, #engine

(착수 전 — 2026-04-22 Phase 4 §4.3.3 에서 이관. Phase 4 §4.2.2 URI 참조 + source-registry `hash` 필드 완비 후 진입 가능.)

---

## 5.4 Variance 기여도 · Diagnostic
> tag: #eval

(착수 전 — 2026-04-22 Phase 4 §4.5.1.7.1/.7.4/.7.6/.7.7 에서 이관. Phase 4 §4.5.1.7.2/7.3 실측으로 본체 CV <10% 확보 이후 선택적 diagnostic.)

---

## 5.5 성능 · 엔진 확장
> tag: #infra, #engine

(착수 전 — 2026-04-22 Phase 4 §4.5.3 (llama.cpp PoC) / §4.5.4 (rapidocr Linux) 에서 이관.)

---

## 5.6 표준 분해 규칙 self-extending 구조
> tag: #framework, #engine, #architecture

**Stage 0 사전 검증** (2026-04-22, Phase 4 내 진행 중):
- Phase 4 §4.5.1.7.2 에서 PMBOK 10 knowledge areas 를 canonicalizer prompt 에 단발 하드코딩 (A안). `canonicalizer.ts buildCanonicalizerPrompt` "작업 규칙" 7번 항목 신규 + `canonicalizer.test.ts` 단위 테스트 anchor. 352/352 PASS.
- 철학 선언은 `wiki/analyses/self-extending-wiki.md` (wiki 본체 analysis) 에 정식 기록.
- 실측: PMS 5-run 재측정으로 Concepts CV 24.6% → <15% 달성 여부 확증 (후속 Obsidian CDP 세션). 효과 확증 시 Stage 1 진입.

**Stage 1~4** (미진입):

| Stage | 상태 | 트리거 |
|---|---|---|
| Stage 1 외부화 (`.wikey/schema.yaml`) | 대기 | Stage 0 실측 + 두 번째 표준 corpus (ISO/ITIL 등) 등장 |
| Stage 2 extraction graph suggestion | 대기 | Stage 1 안정 동작 + 표준 ≥5 누적 |
| Stage 3 in-source self-declaration | 대기 | Stage 2 accept rate ≥ 80% |
| Stage 4 cross-source convergence | 대기 | Stage 3 누적 ≥ 3 표준 × 2 소스 |

**기록 책임**: 실행 로드맵 단일 소스는 `plan/phase-5-todo.md §5.6`, 철학 선언 단일 소스는 `wiki/analyses/self-extending-wiki.md`. `wikey-core/src/canonicalizer.ts` 작업 규칙 #7 위 주석, `plan/session-wrap-followups.md`, memory 는 포인터만.

---

## 5.7 운영 인프라 포팅
> tag: #utility, #infra

(착수 전 — 2026-04-22 Phase 4 §4.5.2 의 bash→TS 포팅 + qmd SDK import 두 항목에서 이관. 삭제 안전장치 + 초기화는 Phase 4 본체 유지.)
