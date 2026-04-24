# 문서 명명규칙·조직화 (필수, 2026-04-24 고정)

> CLAUDE.md 에서 분리 (2026-04-24). CLAUDE.md 는 진입점·요약만, 상세 규칙은 여기. `/sync` 스킬 Phase 0-4.7 이 이 규칙의 무결성을 검증한다.

`activity/`·`plan/` 디렉터리는 **Phase 별 중심 문서 2개 + 그 주위에 보조 문서** 구조로 정리된다. 중심 문서가 alphabetical listing 에서 **항상 먼저** 등장하도록 명명규칙이 엄격히 고정돼 있다.

## 파일 종류

| 종류 | 경로 | 예시 |
|------|------|------|
| 중심 plan | `plan/phase-N-todo.md` | `plan/phase-4-todo.md` |
| 중심 result | `activity/phase-N-result.md` | `activity/phase-4-result.md` |
| 보조 plan | `plan/phase-N-todox-<section>-<topic>.md` | `plan/phase-4-todox-4.6-critical-fix-plan.md` |
| 보조 result | `activity/phase-N-resultx-<section>-<topic>-<date>.md` | `activity/phase-4-resultx-4.6-smoke-2026-04-23/` |

- `N` = Phase 번호 (1, 2, 3, ...).
- `todox` / `resultx` — "x" 는 extension (보조) 을 뜻한다. 핵심 규칙: `phase-N-todo` 와 `phase-N-result` 뒤에 **알파벳 한 글자** 를 붙인 형태여야 한다. `_` (언더스코어) 나 `-` (하이픈) 은 로케일 정렬에서 중심 문서보다 앞에 와버려 금지. 테스트로 `ls`·`LC_ALL=C ls` 양쪽에서 중심 문서가 맨 앞에 오는지 확인.
- `<section>` = result·todo 내부 section 번호 그대로 (`4.1`, `4.1.3`, `4.5.1.5`, `4.6`, `3.B`, `2.Step3-0` 등). 같은 section 의 여러 문서는 하나의 `<section>` 을 공유한다.
- `<topic>` = kebab-case 간단 주제 식별자 (`critical-fix-plan`, `bitmap-ocr-fix`, `determinism-pms-auto`).
- `<date>` = `YYYY-MM-DD` — 측정·리포트 계열만 (계획서는 date 생략).

## 중심 문서 의무

1. 각 중심 문서 **최상단 meta 블록 바로 아래에 `## 관련 문서` 섹션**을 유지.
2. 해당 Phase 의 모든 보조 문서를 **section 번호 오름차순** 으로 나열.
3. 프로젝트 공통 문서 (`plan/decisions.md`·`plan/plan_wikey-enterprise-kb.md`·`plan/session-wrap-followups.md`) 는 별도 항목으로 분리.
4. 새 보조 문서 추가 시 중심 문서의 `관련 문서` 섹션을 즉시 갱신.

## 보조 문서 의무

- 각 보조 문서 **타이틀 바로 아래 `> **상위 문서**: ...` 역참조 블록**을 유지. 상위 result · todo 링크 + `§<section> (<topic>)` + 본 명명규칙 참조.
- Todo 체크박스 (`- [ ]` / `- [x]`) 는 오직 `plan/phase-N-todo.md` 에만. 보조 계획서는 범위·의미 정의만 표현 (참고: `sync` 스킬 Phase 0-4.6).

## 이관 시점

- 한 Phase 가 진행되는 동안 새 보조 문서가 필요하면 위 명명규칙으로 즉시 생성. Ad-hoc 이름으로 만들고 나중에 이관하지 말 것.
- 기존 잘못 명명된 파일이 있다면 `git mv` + sed 로 참조 일괄 갱신 후 단일 commit (예: 2026-04-24 session 에서 일괄 이관).
