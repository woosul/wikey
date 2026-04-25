---
title: Phase A — Claude Code 세션 유지·context 안정화 인프라
phase: a
type: cross-phase-infra
created: 2026-04-25
status: 구현 완료 + smoke 검증 OK (2026-04-25 13:52)
---

> **이 문서의 위치**: cross-phase 인프라 작업. Phase 1~6 의 도메인 작업과 별개로 Claude Code 자체의 context 관리 안정화. wikey 프로젝트 한정 + (일부) 글로벌 영향. todo 단일 소스 원칙은 phase-N 한정 — 본 phase-a 는 자체 체크박스 보유 OK.

## 관련 문서

- **이번 세션 evidence**: 본 문서는 2026-04-25 session 10 의 §5.1.2 + §5.1.3 + cycle smoke 진행 중 발견된 context handoff 패턴 (post-compact-handoff.md 수동 작성) 의 자동화·일반화 결정.
- **글로벌 정책**: `~/.claude/CLAUDE.md` (Karpathy 4원칙) + `~/.claude/settings.json`
- **wikey 정책**: `/Users/denny/Project/wikey/CLAUDE.md` (문서 동기화 플로우, 명명규칙, PII 정책) + `/Users/denny/Project/wikey/.claude/settings.local.json`
- **관련 메모리**: `feedback_no_defer_to_next_session.md`, `feedback_reuse_prior_artifacts.md`, `feedback_obsidian_modal_proceed.md`, `feedback_no_circled_numbers.md`
- **참조 docs (Anthropic)**: [Context windows](https://docs.claude.com/en/docs/build-with-claude/context-windows), [How Claude Code works](https://code.claude.com/docs/en/how-claude-code-works), [Hooks reference](https://code.claude.com/docs/en/hooks), [Checkpointing](https://code.claude.com/docs/en/checkpointing), [Sessions](https://code.claude.com/docs/en/agent-sdk/sessions)

## 1. 배경

### 1.1 3 개념 정의 (조사 확정)

| 개념 | 정의 | 보존 / 잘림 | 제어 |
|------|------|-----------|------|
| **Compact** | context 자동 95% 압축 또는 `/compact [focus]` 수동 | 보존: user msg / code / CLAUDE.md. 잘림: 오래된 tool output / 초기 지시 | `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` env, `PreCompact` hook |
| **Handoff** | 세션 간 / 이벤트 전후 정보 전달 (disk-persistent file) | n/a — file 자체가 살아남음 | session-wrap-followups (영구 누적) + post-compact-handoff (일시 단발) + result/todo (영구 작업 기록) |
| **Rewind** | `Esc Esc` 또는 `/rewind` — file write 추적 reversible, bash 명령 미추적 | UI 옵션: conversation only / code only / both | 별도 설정 없음. 사용자 단축키 |

### 1.2 wikey session 10 (2026-04-25) 측정 평가

- post-compact-handoff.md 수동 작성 패턴이 검증됨 (`session-wrap-followups.md` 와 명확히 분리되는 단발 disk persistence)
- session-wrap-followups.md 는 archive 누적으로 잘 작동
- compact 자동 95% threshold 는 대형 작업 (cycle smoke + codex review + skill 정비 동시) 에서 안전망 부족 — 본 세션 1회 compact 에서 evidence 수동 보존 부담 발생
- subagent 위임 기준 (tester CDP 1차) 이 이번 세션에서 정립됐으나 글로벌 패턴 미명문화

## 2. 현 settings 매핑 (Claude Code 2.1.120)

```json
~/.claude/settings.json:
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1",
    "ENABLE_TOOL_SEARCH": "auto:5"
    // ★ CLAUDE_AUTOCOMPACT_PCT_OVERRIDE 미설정 → default 95%
  },
  "hooks": {
    "PreToolUse": [...],
    "SessionStart": [...],
    "UserPromptSubmit": [...],
    "PostToolUse": [...],
    "Stop": [...],
    "TaskCompleted": [...]
    // ★ PreCompact 미등록
    // ★ SessionEnd 미등록
  },
  "permissions": { /* allow + safety deny + MCP */ }
}
```

## 3. 합의된 결정 (2026-04-25, AskUserQuestion 결과)

| ID | 결정 | 비고 |
|----|------|------|
| **A** | **a2 — PreCompact archive + handoff 자동 생성** | 가장 큰 개선. 이번 세션 수동 패턴의 완전 자동화 |
| **B** | **b2 — autoCompact threshold 80%** | 안전망 강화. compact 1-2회 더 발생 가능성 수용 |
| **C** | **c1 — SessionStart hook 강화 (wikey project 한정)** | wikey 의 session-wrap 패턴이 검증됐으니 그 project 만 |
| **D** | **wikey CLAUDE.md 에 Subagent 위임 기준 명문화** | tester CDP 1차 정책의 일반화 |
| **E** | **/sync 출력에 context% gauge 추가** | 임계 도달 시 "이 세션 종료 권고" sign |
| ~~F~~ | (제외) rewind/clear memory feedback | 사용 빈도 낮음, 후순위 |

## 4. 구현 계획

### 4.1 Hook script 작성

- [ ] **`~/.claude/hooks/pre-compact-wikey.sh`** 신설
  - 입력: stdin 으로 hook context (session_id, transcript_path, trigger=manual|auto, custom_instructions)
  - 동작 (wikey project 한정 — `cwd` 가 `/Users/denny/Project/wikey/` 로 시작할 때만):
    1. transcript JSONL archive: `~/.claude/archives/wikey-<session_id>-<timestamp>.jsonl` 으로 cp
    2. `plan/post-compact-handoff.md` 자동 생성 (overwrite OK):
       - frontmatter: `created`, `session_id`, `compact_trigger`, `last_commit`
       - section: `## 1. 마지막 N user message` (transcript JSONL 에서 마지막 5 user turn 의 content text 추출)
       - section: `## 2. uncommitted git status + diff stat` (`git status --short` + `git diff --stat HEAD`)
       - section: `## 3. 진행 중 task` (TaskList 상태 dump — 시스템 reminder 마지막 task 목록 사용. 없으면 skip)
       - section: `## 4. 다음 action 체크리스트` (post-compact 차례에 cat 으로 read 후 수행할 첫 액션 가이드)
    3. wikey project 외에서는 archive 만 (handoff 생성 skip)
  - 출력: stdout 무시 (PreCompact 는 decision: "block" 만 의미. 정상 동작이면 exit 0)
  - 권한: `chmod +x`
- [ ] **(선택) `~/.claude/hooks/session-start-wikey.sh`** 신설
  - 입력: stdin 으로 hook context
  - 동작 (wikey project 한정):
    1. `cat /Users/denny/Project/wikey/plan/session-wrap-followups.md` 의 상단 "다음 세션 첫 액션" 섹션만 (line 7~25 정도) print → stdout
    2. `[ -f /Users/denny/Project/wikey/plan/post-compact-handoff.md ] && cat ...` (있을 때만)
    3. `git -C /Users/denny/Project/wikey status --short` print → stdout
  - 출력: stdout 이 SessionStart hook 으로 Claude context 에 inject

### 4.2 settings.json 변경

- [ ] `~/.claude/settings.json` 의 `env` 에 추가:
  ```json
  "CLAUDE_AUTOCOMPACT_PCT_OVERRIDE": "80"
  ```
- [ ] `hooks` 에 `PreCompact` matcher 추가:
  ```json
  "PreCompact": [
    {
      "matcher": "",
      "hooks": [{"type": "command", "command": "~/.claude/hooks/pre-compact-wikey.sh", "timeout": 10000}]
    }
  ]
  ```
- [ ] `hooks.SessionStart` 의 기존 entry 옆에 wikey 용 entry 추가 (matcher 로 cwd 분기 — Claude Code 가 hook input 에 cwd 제공하므로 script 안에서 분기 가능)

### 4.3 wikey CLAUDE.md Subagent 위임 기준 추가

- [ ] `/Users/denny/Project/wikey/CLAUDE.md` 적합한 위치 (Agent 섹션 또는 신규 "Subagent 위임 기준" 섹션) 에 추가:

  ```markdown
  ## Subagent 위임 기준 (Claude Code context 보호)

  다음 경우 main session 에서 직접 처리하지 말고 subagent (claude-panel / codex / gemini-panel /
  general-purpose) 위임:

  - **Output 500+ lines**: log tail, test 전체 출력, 대량 grep 결과
  - **Long-running 5분+**: npm build·test, docling 변환, qmd reindex (full)
  - **Isolated domain**: DB review (database-reviewer), security audit (reviewer/codex),
    UI review (gemini-panel/ui-designer)
  - **Obsidian CDP UI smoke**: tester (1차) — `~/.claude/skills/obsidian-cdp/SKILL.md §1` 책임 매트릭스
  - **Plan 검증**: codex Mode D Panel — `~/.claude/skills/codex/SKILL.md` 기본 정책

  **위임 호출 형식**:
  - Agent tool prompt 에 (a) 목표 (b) 입력 file 경로 (c) 출력 형식 명시
  - subagent 결과만 main 으로 복귀 — large output 은 subagent context 에만 남음
  - 결과 통합: parent 는 summary + key finding 만 수신
  ```

### 4.4 /sync skill context% gauge 추가

- [ ] `~/.claude/skills/sync/SKILL.md` 의 출력 포맷 (Phase 3 끝 또는 Phase 0 끝) 에 context gauge block 추가:

  ```
  [Context Health]
    현재 사용량:  N% (estimated from tokens used)
    임계 (80%):   {OK | WARN: 이 세션 종료 권장}
    last compact: <session 내 N분 전 | 없음>
  ```

- [ ] gauge 산출 방법: Claude Code 가 `/cost` 또는 환경 정보로 token 사용량 노출하는 경우 활용. 정확한 값 미가용 시 sync skill 실행 시점의 transcript file 크기 / heuristic.
- [ ] 임계 도달 시 sync skill 출력 마지막 줄에 강조 표시:
  ```
  ⚠ context 80% 임계 도달 — 다음 작업 시작 전 /clear 또는 fresh session 권장
  ```

### 4.5 검증

- [ ] **PreCompact hook 수동 trigger**: `/compact` 실행 → `~/.claude/archives/wikey-*.jsonl` 생성 확증 + `plan/post-compact-handoff.md` 자동 생성 확증
- [ ] **SessionStart hook 수동 trigger**: `claude --continue` 또는 새 session → 자동 inject 된 stdout 이 Claude context 에 들어왔는지 첫 응답으로 확인
- [ ] **autoCompactThreshold 80%**: long task 진행 중 80% 도달 시 자동 compact 발동 확증 (token 사용량 추적)
- [ ] **CLAUDE.md Subagent 기준 적용 회귀**: 다음 세션에서 large output 작업 발생 시 master 가 자동으로 subagent 위임 선택하는지 관찰
- [ ] **/sync gauge**: sync skill 실행 시 context% 표시 OK

## 5. 구현 결과 (2026-04-25 session 10, 13:50~13:52)

### 5.1 산출물

| 파일 | 종류 | 비고 |
|------|------|------|
| `~/.claude/hooks/pre-compact-wikey.sh` | 신규 (5450 bytes, chmod +x) | wikey 한정. transcript archive + handoff 자동 생성 |
| `~/.claude/hooks/session-start-wikey.sh` | 신규 (2597 bytes, chmod +x) | wikey 한정. session-wrap 상단 + handoff (있으면) + git status stdout inject |
| `~/.claude/settings.json` (실제 `claude-forge-custom/settings.json`) | 변경 | env `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=80` + PreCompact hook entry + SessionStart wikey entry. `.bak.20260425` 백업 보관 |
| `wikey/CLAUDE.md` | 변경 | "Subagent 위임 기준" 섹션 신설 (위임 대상 6 / 호출 형식 / 위임 안 하는 경우) |
| `~/.claude/skills/sync/SKILL.md` | 변경 | Phase 3 출력 끝에 `[Context Health]` block 추가 (사용량 % / threshold / last compact / last archive / 임계 sign) + 산출 방법 명세 |

### 5.2 smoke 검증 결과

PreCompact hook 수동 stdin 주입 (`session_id=smoke-test, cwd=/Users/denny/Project/wikey, trigger=manual`):
- transcript archive: `~/.claude/archives/wikey-smoke-test-20260425-135233.jsonl` (7.1 MB) 생성 OK
- handoff 자동 생성: `plan/post-compact-handoff.md` (3 KB) — last commit `e510f90` + uncommitted (M CLAUDE.md) + diff stat 정확
- exit code 0
- smoke 산출물 (handoff) 정리됨, archive 는 transcript 백업 가치라 유지

SessionStart hook 수동 smoke:
- wikey 외 cwd (/tmp): 즉시 exit (silent OK)
- wikey cwd: session-wrap 상단 30 lines + git status + last commit 정확 출력 OK

### 5.3 미검증 항목 (실측 확인 필요, 다음 세션)

- [ ] **autoCompactThreshold 80% 실측** — 실제 long task 진행 중 80% 도달 시 자동 compact 발동 + PreCompact hook 자동 trigger 확증. 현 세션은 수동 stdin smoke 만.
- [ ] **SessionStart hook inject 확증** — `claude --continue` 또는 새 session 시작 시 stdout 이 Claude context 에 자동 반영되어 첫 응답에 영향 주는지 관찰.
- [ ] **/sync gauge 동작** — 다음 /sync 실행 시 `[Context Health]` block 출력 OK.
- [ ] **CLAUDE.md Subagent 기준 회귀** — 다음 large output 작업에서 master 가 자동으로 subagent 위임 선택하는지 관찰.

## 6. 다음 action

1. 본 phase-a 구현 완료. 다음 세션부터 자동 작동 (`claude --continue` 또는 새 session 시작 시 SessionStart hook 자동 발동, compact 80% 임계 도달 시 PreCompact hook 자동 발동).
2. `phase-5-todo.md §5.2` 본 작업 진입 (사용자 정책 — tester 1차 / master fallback). 첫 후보:
   - §5.2.0 Ingest/Audit UI paired sidecar.md 일관화 (UI only, 빠른 fix)
   - §5.2.1 ★ entity↔concept cross-link 자동 생성 (canonicalizer Stage 3, 답변 풍부도 결정적)
   - §5.2.5 자동 reindex silent fail 진단 (4 후보 좁힘)
3. §5.3 미검증 4 항목은 실 사용 중 자연 검증.

## 7. 변경 이력

- **2026-04-25 13:46 (session 10, 합의)**: 본 문서 신설. 사용자 ↔ master 합의 결과 (A=a2, B=b2, C=c1, D, E). F (rewind/clear memory) 는 후순위로 제외.
- **2026-04-25 13:52 (session 10, 구현)**: 합의 5건 모두 구현 + smoke 검증 OK. status `합의 완료, 구현 진입 대기` → `구현 완료 + smoke 검증 OK`.
