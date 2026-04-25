# Master 1차 검증 의무 (subagent → codex 사이)

> 2026-04-25 사용자 영구 결정. analyst·developer·tester 등 subagent 산출물을 codex / 다른 검증자에게 송부하기 전에 master 가 반드시 1차 sanity check.
> 사용자 원문: "에이전트가 계획하면 너가 반드시 1차검증하고 codex로 검증요청해. 명문화...너무 반복적이고 계획이 오래 걸려"

## 룰

**subagent 산출물 → codex 직송 금지**. master 가 다음 1차 검증 통과 후에만 codex 송부.

## 1차 검증 체크리스트 (master 의무)

| # | 검증 | 도구 |
|---|------|------|
| 1 | 결정 트리·분기 순서 모순 — 앞 분기에서 뒤 분기 unreachable 되는가 | Read plan + 흐름 추적 |
| 2 | 참조한 코드 식별자가 실재하는가 (함수명·필드명·플래그) | `grep` |
| 3 | 참조한 외부 schema 가 실재 코드와 일치하는가 (JSON 키, type 시그니처, 인자) | `grep` + `Read` 해당 파일 |
| 4 | identity / hash / id 정책이 기존 코드 정책과 모순 없는가 | `grep "computeFileId\|computeFullHash\|source_id"` |
| 5 | 본문 전체에 등장하는 신규 용어·필드명 일관성 (case 다름·typo) | `grep -c` 회수 비교 |
| 6 | acceptance criteria 의 "수정 위치" 가 본문에 실제 반영됐는지 sample 2~3건 spot check | Read 여러 위치 |
| 7 | 상위 문서 (todo / spec) 와 acceptance 가 충돌하지 않는가 | Read parent doc + diff |

## 적용

- analyst v1 → master 1차 검증 → codex
- analyst v2 정정 → master 1차 검증 → codex (직송 금지)
- developer 구현 → master 1차 검증 → tester / codex
- tester 결과 → master 1차 검증 → 사용자 보고
- 1차 검증 fail 항목은 master 가 Edit 으로 직접 수정 또는 analyst 재호출 (cycle 1회 더 가능)

## 왜 의무화

본 세션 (2026-04-25 wikey §5.3) 측정값:

| Cycle | 잔여 P1 | master 1차 검증 |
|-------|---------|----------------|
| analyst v1 → codex (직송) | **8건** | ❌ 안 함 |
| analyst v2 → codex (직송) | **5건** (그 중 ≥3건은 grep/read 로 잡힘) | ❌ 안 함 |

cycle 이 늘어나면 사용자 대기 시간 누적. **master 1차 검증 1회 (5분) 가 codex 한 cycle (30~60분) 보다 짧다**.

이 룰은 codex SKILL.md "master 1차 검증 필수" 섹션 (이미 존재) 의 격상. wikey project 차원에서 wikey/rules 로 영구 fix.

## 영향 받는 문서

- 본 wikey CLAUDE.md `## Subagent 위임 기준` 섹션의 `참조` 라인
- `~/.claude/skills/codex/SKILL.md` "master 1차 검증 필수" — 본 rule 과 cross-reference
- `~/.claude/agents/analyst.md` — "산출물은 master 1차 검증 후 codex 송부 가능" 한 줄 추가 권장
- `~/.claude/projects/-Users-denny-Project-wikey/memory/feedback_master_pre_validation.md` — feedback memory

## 참조

- 사용자 발언 출처: 2026-04-25 wikey §5.3 codex v1 REJECT (8건) → v2 REJECT (5건) 사이클 후 turn.
