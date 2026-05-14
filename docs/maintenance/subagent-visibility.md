# Subagent 가시성 3 패턴

> 2026-04-25 사용자 영구 결정. 모든 subagent 호출의 가시성 룰.
> 사용자 원문: "동작이 명확해야 내가 오해를 안해요." / "모든 subAgent는 백그라운드 동작을 하거나, 다른 패널에서 동작하거나 동작블럭을 대기작업 블럭위에 표시될 수 있도록 해줘."

## 룰

모든 subagent 동작은 다음 3 패턴 중 하나로 실행. 그 외 = **금지**.

| 패턴 | 사용자 채팅창 가시화 | 사용 도구 | 비고 |
|------|------------------|----------|------|
| **C. Agent UI 블럭 (★ 진짜 채팅 가시화)** | ✅ **채팅에 Agent 동작 블럭 직접 표시** (토큰·duration 카운터) | `Agent` tool 새 spawn | analyst · Explore · Plan · reviewer (panel wrap) — **채팅창 가시화 의무 시 유일 선택** |
| B. 다른 cmux 패널 (옆 화면 관찰) | ⚠️ 별도 cmux UI 화면에서만 (채팅창엔 안 보임) | claude-panel · codex · gemini-panel 스킬 | 사용자가 옆 패널 직접 봄. 채팅 가시화는 별도 wrapper (C) 필요 |
| A. background bash + task notification | ❌ **채팅에 블록 표시 안 됨** (master 만 task ID 인식) | Bash tool `run_in_background: true` | master 의 내부 polling 메커니즘 (output file + 완료 알림). 사용자 가시화 0 — 단독 사용 금지 |

## 금지

- `SendMessage` 로 기존 subagent 에 message 만 보내고 background resume 시키는 패턴 — UI 비표시 → 사용자가 진행 여부 모름.

## codex/panel review 패턴 (★ 2026-04-25 수신 로직 개편 — 룰 2/3/4)

**룰 2 — 새 panel default**: codex review/검증은 매번 `panel-dispatch.sh pick-fresh` 로 새 panel 생성. 기존 panel 재사용 금지 (scrollback 가득 → classify viewport 40 라인 안에 잔존 "Working" 위험. 실측: surface:1 재사용 시 5분+ stuck, 새 panel surface:12 22초 정상).

**룰 3 — review cycle 종료 후 close**: capture 완료 후 `panel-dispatch.sh close <surface>` 로 panel 정리. 누적 방지.

**룰 4 — master 직접 panel 호출, subagent 는 분석만**:
- master 가 `pick-fresh + send + wait + capture` 한 블록 (background bash, run_in_background: true) 으로 실행. master 의 Bash run_in_background task-notification 메커니즘 검증됨 (실측: 진단 sample 22초 정상).
- subagent (reviewer 등) 는 capture 결과를 inline prompt 로 받아 **분석/4 카테고리 정리만** 수행 (foreground, 짧음). subagent 의 background bash 결과 알림 메커니즘이 master 와 비대칭 — subagent 가 turn 종료 후 idle 진입 → 알림 못 받음 (실측: a787c99d281a04439 / af52bf7a79823ec17 모두 stuck).
- 가시화: master 의 task block (A) + cmux 옆 panel (B) + 분석 단계 subagent Agent block (C) — 3 패턴 동시.

## 적용 원칙

- **codex / claude-panel / gemini-panel 검증 호출** → 반드시 `Agent` tool (subagent_type=reviewer / developer / tester / ui-designer) 로 **wrap**. reviewer 안에서 panel send/wait/capture (A+B 조합) 사용. 채팅창에는 reviewer 의 Agent UI 블럭이 표시 → 사용자가 진행 시각화 (C 패턴).
- master 가 직접 `Bash run_in_background: true` 단독 호출 = **금지**. 사용자 채팅 가시화 0. 디버그·즉시 capture 등 짧은 (10s 미만) bash 만 허용.
- **같은 세션 안에서 같은 agent 후속 작업** → SendMessage 가 아니라 **새 Agent 다시 spawn** (C 패턴 가시성 유지). 이전 transcript 끊기지만 가시성 우선.
- **부득이 SendMessage 사용 시** → master 가 호출 즉시 다음 명시:
  > "background resume — UI 블럭 비표시. 5분 단위 transcript tail capture 로 진행 보고하겠습니다."
  
  자동 보고 cadence = 5 분.
- panel-mode 의 polling 자체는 reviewer Agent **내부**에서 background bash (A) 로 실행 — 가시화 책임은 reviewer Agent 의 채팅 블럭이 담당.

## Hybrid wait polling (panel-dispatch.sh `cmd_wait`)

panel-mode subagent 의 wait 함수는 다음 hybrid 패턴 (`~/.claude/skills/codex/panel-dispatch.sh` 등):

| Phase | 시간 구간 | polling interval | 감지 기준 |
|-------|----------|------------------|----------|
| 1 | 0 ~ 300s | **10s** | `classify_surface = ready` 만 |
| 2 | 300s+ | **60s** | `classify_surface = ready` OR 마지막 30 라인 hash 2회 연속 동일 + state ≠ busy → `WAIT_STABLE_IDLE` |

**Why hybrid**: codex 출력이 길어 capture-pane 40 라인 viewport 에서 `OpenAI Codex` 배너가 밀려나면 `classify_surface=unknown` 으로 빠져 ready 감지 실패 → wait 가 timeout 까지 무한 대기. Phase 2 stable check 가 그 케이스의 안전망 (실측: wikey 2026-04-25 §5.3 검증 시 30분 wait 알림 누락).

## 영향 받는 문서

- `~/.claude/skills/codex/SKILL.md` — 가시성 3 패턴 + hybrid wait 명세
- `~/.claude/skills/claude-panel/SKILL.md` — 가시성 3 패턴 명세
- `~/.claude/skills/gemini-panel/SKILL.md` — 가시성 3 패턴 명세
- `~/.claude/skills/codex/panel-dispatch.sh cmd_wait` — hybrid 패턴 구현
- `~/.claude/skills/claude-panel/panel-dispatch.sh cmd_wait` — interval 10s
- `~/.claude/skills/gemini-panel/panel-dispatch.sh cmd_wait` — interval 10s
- `~/.claude/projects/-Users-denny-Project-wikey/memory/feedback_subagent_visibility.md` — feedback memory

## 참조

- 본 wikey CLAUDE.md `## Subagent 위임 기준` 섹션의 `참조` 라인에서 본 파일 link.
- 사용자 발언 출처: 2026-04-25 wikey §5.3 plan codex 검증 사이클 turn.
