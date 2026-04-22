---
title: LLM Wiki 의 self-extending 지향
type: analysis
created: 2026-04-22
updated: 2026-04-22
sources: []
tags: [philosophy, architecture, llm-wiki]
---

# LLM Wiki 의 self-extending 지향

> wikey 가 지향하는 핵심 속성 — "하나의 단발 사례를 씨앗으로, wiki 가 스스로 분류·확장해 가는 구조". 본 문서는 이 지향을 **wiki 자체에** 정식으로 기록해 두기 위해 작성됐다. 구현 로드맵은 `plan/phase-5-todo.md §5.6` 가 단일 소스이며, 이 분석은 그 **존재 이유(why)** 만 다룬다.

## 배경 — 왜 단발 하드코딩으로는 안 되는가

§4.5.1.7.2 에서 PMBOK 10 knowledge areas 를 canonicalizer prompt 에 하드코딩했다. 효과가 확증되면 같은 패턴이 반복 등장할 것이 확정되어 있다: ISO 27001 controls (93개), ITIL 4 practices (34개), GDPR 7 원칙, SAFe configurations, OWASP Top 10, OSI 7 Layer, 12 Factor App, Scrum events (5개), Agile principles (12개). 매번 prompt 블록을 추가하는 방식은 세 가지 이유로 수명이 짧다:

1. **유지 비용**. 표준 수가 누적되면 prompt 가 비대해지고, 충돌하는 suffix 패턴 (`-management`, `-control`, `-principle`, `-practice`) 이 서로 간섭한다.
2. **코드 수정 의존**. 새 표준마다 canonicalizer.ts 를 고치고 빌드·배포해야 한다. wiki 운영자가 "자기 도메인의 표준" 을 스스로 추가하지 못한다.
3. **wiki 본래 정신과 불일치**. wiki 는 소스가 축적될수록 구조를 **스스로 발견·수렴** 해야 하는데, 하드코딩은 구조를 바깥에서 주입하는 방향이라 정반대다.

## 지향 — self-extending 4 단계

로드맵 상세는 `plan/phase-5-todo.md §5.6`. 여기는 철학 선언만.

- **Stage 1 — 외부화**. 하드코딩된 분해 규칙을 `.wikey/schema.yaml` 로 내려 사용자/vault 가 선언·수정할 수 있게 한다. canonicalizer 는 순수 로더가 된다. 이행 트리거는 "두 번째 표준 corpus 등장" 이다.
- **Stage 2 — 제안**. 여러 소스를 인제스트한 결과의 mention graph 에서 "N 개 형제가 같은 상위 개념 아래 반복 출현하는" 패턴을 감지해 사용자에게 분해 규칙 등록을 제안한다. 사용자는 Audit UI 에서 accept/reject/edit 만 한다.
- **Stage 3 — 자기 선언**. 소스 본문이 "이 표준은 다음 N 영역을 갖습니다: A, B, C..." 같이 스스로 enumerate 하면 인제스트가 그 섹션을 구조적으로 읽어 runtime-scope decomposition 을 생성한다. 사용자 개입 없음.
- **Stage 4 — 교차 수렴**. 여러 소스가 같은 표준을 다른 각도에서 언급할 때, wiki 전체 mention graph 를 배치 분석해 canonical decomposition 을 inference 한다. qmd vector index + clustering + LLM arbitration 조합.

각 단계는 다음 단계의 인프라이며, 앞 단계의 **오용 가능성이 측정되어야** 다음 단계로 간다. 전량 구현은 목표가 아니다 — Stage 2 까지만 해도 운영상 충분할 수 있다.

## 왜 wiki 에 기록하는가

이 문서가 `plan/` 이나 `activity/` 가 아니라 `wiki/analyses/` 에 있는 이유:

1. **지향은 프로젝트 가치** 다. 특정 phase 의 작업 결과가 아니라 wikey 가 장기적으로 어떤 모양이 되어야 하는지에 대한 **합의된 방향**. wiki 의 핵심 속성은 wiki 안에 있어야 한다.
2. **self-extension 의 첫 instance**. wiki 가 자기 자신에 대한 메타 분석을 기록하는 것은, 바로 그 "스스로 확장하는" 속성의 씨앗 사례가 된다. 이 페이지 자체가 Stage 1 의 prototype 이다.
3. **검색 가능성**. qmd 인덱스에 올라가면 향후 세션에서 "wikey 의 지향" / "self-extending" 쿼리로 바로 회수된다. `plan/phase-5-todo.md §5.6` 는 phase 완료 후 보관될 수 있지만, 이 지향은 사라지지 않아야 한다.

## 경계 — 무엇이 self-extension 이 아닌가

- **LLM 이 맘대로 구조를 바꾸는 것** 은 self-extension 이 아니다. 모든 단계는 "신호 감지 → 사용자 가시화 or 명시적 룰" 경로를 거친다. Stage 3 의 자기 선언조차 provenance tracking (§4.3) 으로 소스 출처를 추적해야 하며, 소스가 marketing 카피거나 부정확할 때 오염이 전파되지 않게 한다.
- **무한 성장** 이 목적이 아니다. 새로 등록되는 decomposition 의 confidence score 와 사용자 accept rate 를 측정해, 기준 미달이면 자동 등록을 자체 억제한다.
- **canonicalizer 외부 학습** 이 아니다. 분해 규칙의 학습은 vault 내부 데이터 (인제스트된 소스 + wiki graph) 에만 의존한다. 외부 모델에 vault 데이터를 보내 학습시키는 경로는 포함하지 않는다 (BYOAI 원칙, `llm-wiki-kor.md`).

## 현 상태 (2026-04-22)

2026-04-22 Phase 재편으로 본 로드맵은 Phase 5 §5.6 에 위치하며, 현재 진행 중인 Phase 4 §4.5.1.7.2 (PMBOK 10 영역 prompt 하드코딩) 은 §5.6 의 **Stage 0 사전 검증**에 해당한다.

- **Stage 0** — PMBOK 10 영역 prompt 하드코딩 + 단위 테스트 anchor (Phase 4 §4.5.1.7.2, `canonicalizer.ts buildCanonicalizerPrompt` 작업 규칙 #7). 실측 전.
- **Stage 1** — 미진입. Phase 4 §4.5.1.7.2 실측 효과 확증 + 두 번째 표준 corpus 등장을 트리거로 대기.
- **Stage 2~4** — 설계 스케치만. 로드맵은 `plan/phase-5-todo.md §5.6`.

## 관련 참조

- 로드맵 단일 소스: `plan/phase-4-todo.md §4.5.5 (Stage 1/2/3/4 + 공통 타입 스케치)`.
- 구현 씨앗: `wikey-core/src/canonicalizer.ts buildCanonicalizerPrompt` 작업 규칙 #7 (PMBOK 하드코딩).
- 사전 검증: `activity/phase-4-result.md §4.5.1.7.2 일반화 경로` 단락.
- 철학 원문: `llm-wiki-kor.md` — compounding asset 로서의 wiki, 소스→다중 페이지 분해, 백링크 그래프 가치.
