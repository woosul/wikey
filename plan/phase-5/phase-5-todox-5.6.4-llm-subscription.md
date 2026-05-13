---
phase: 5
section: 5.6.4
title: LLM Provider — subscription auth 통합 (Google / Anthropic / OpenAI) — Todo (HOW)
status: planning
created: 2026-05-13
updated: 2026-05-13
version: v0.7
tags: [provider-auth, subscription, byoai, google, anthropic, openai]
---

# Phase 5 §5.6.4 LLM Provider — subscription auth 통합 (Todo, HOW)

> **버전 이력**:
> - v0.1 (2026-05-13, 본 todox 초안) — Spec 6 요소 + 사전 PoC 결과 + SDD+TDD 6 step + §7 사용자 결정 4 항목
> - v0.2 (2026-05-13, 사용자 결정 4 항목 답변 + 자동화 정책 evidence 추가) — §4.6 신규 / commit timing / codex 2 cycle 의무 / line 표기 정정
> - **v0.7 (2026-05-13, codex Mode D Panel cycle #1h NEEDS_REVISION 2 finding 모두 해소 — master 실측 golden fixture 반영)** — 변경 2 항목 (H# = cycle #1h finding 번호 매핑):
>   - (a) **#1h H1 fix [HIGH / codex parser evidence + fixture]** — v0.6 가 `/tmp/codex-5.6.4-cycle1c-1778673786.log` 를 4-segment + "tokens used:" footer evidence 로 인용했지만, 그 log 는 실제 separator 2개만 + "tokens used:" 부재 + segment 라벨 `user` (prompt 본문 표기 X). v0.6 의 "정상 4-segment" 가정 + separator-based 분리 채택 자체가 hallucination 위험. master 가 직접 `printf "say only the word: hi\n" \| codex exec -` raw stdout 재캡처 → **`plan/phase-5/fixtures/cycle-codex-golden/codex-ok-hi.raw.txt`** + **`codex-ok-hi.clean.txt`** 2 file commit (evidence 단일 source). 실측 발견: (1) separator `--------` = **2개만** (banner ↔ metadata + metadata ↔ user). 4 segment 분리 자체가 잘못된 모델링. (2) response body = `\ncodex\n` marker 이후 ~ `\ntokens used` 이전. (3) footer = `tokens used\n<count>` (2 line, 별 separator 아님). 따라서 **codex 권장 fix 양식 그대로 적용** — separator-based 분리 폐기 + **marker-based extraction** 채택:
>     ```typescript
>     function parseCodexOutput(raw: string): string {
>       const codexMarker = raw.indexOf('\ncodex\n')
>       const tokensMarker = raw.indexOf('\ntokens used')
>       if (codexMarker === -1 || tokensMarker === -1 || codexMarker >= tokensMarker) {
>         return raw.trim()  // 비정상 형식 fallback — full stdout trim
>       }
>       return raw.slice(codexMarker + '\ncodex\n'.length, tokensMarker).trim()
>     }
>     ```
>     - §4.0.7 표 row + sample code 모두 marker-based 로 정정. `segments.split(/^-+$/m)` / `segments.slice(2, -1)` / `segments[0]` / `segments.at(-1)` 사용 폐기.
>     - test 계약: **unique prompt sentinel** 본문 leak assert (`not.toContain('say only the word:')` / `not.toContain('user prompt:')` / `not.toContain('OpenAI Codex')` / `not.toContain('workdir:')` / `not.toContain('session id:')` / `not.toContain('tokens used')`). fixture = master 실측 golden 1쌍 (`codex-ok-hi`) + 회귀 1쌍 (`codex-bodylike` — body 안 marker-like 단어 leak 차단 — body 안 "model: gemini-pro" / "workdir: /tmp" / "tokens used: in metadata" 같은 단어가 본문에 정상 포함된 케이스. marker-based 추출은 *literal `\ncodex\n` 라인 시작* 만 인식 → 본문 같은 단어 leak 0).
>     - **matrix shape (G1 v0.6)** 는 변경 없음 — matrix 와 parser 는 별개 영역. nested 48-cell shape 그대로 유지.
>   - (b) **#1h H2 fix [LOW / commit prefix drift]** — canonical todox 의 4 commit prefix (§5.2 line 978 / §5.4 line 1073 / §5.5 line 1095 / §5.6 line 1161 / §5.6 table line 1172~1175) 가 여전히 `v0.3`. mirror (line 848) 만 commit 1 = `v0.6`. v0.7 = canonical / mirror 4 commit 모두 **`v0.7`** 으로 통일 (현 plan 최신 버전 lock). 향후 codex APPROVE 후 commit 시 prefix 가 최신 plan 버전과 정합.
>
> **v0.7 선결 의무 결과 (master 직접 실측 + read, 2026-05-13)**:
> - #1h H1: master 가 `printf "say only the word: hi\n" \| codex exec -` 직접 실행 + raw stdout 캡처 완료. 위치: `plan/phase-5/fixtures/cycle-codex-golden/codex-ok-hi.raw.txt` (381 bytes, 19 line) + `codex-ok-hi.clean.txt` (3 bytes, `hi\n`). raw 구조 재확증:
>   ```
>   OpenAI Codex v0.128.0 (research preview)
>   --------                                  ← separator 1 (banner ↔ metadata)
>   workdir: /Users/denny/Project/wikey
>   model: gpt-5.5
>   ... (provider / approval / sandbox / reasoning / session id)
>   --------                                  ← separator 2 (metadata ↔ user)
>   user
>   say only the word: hi
>   (빈 line)
>   codex                                     ← response marker line
>   hi                                        ← response body
>   tokens used                               ← footer marker line
>   15,997                                    ← token count
>   ```
>   separator 총 2개만 + footer 가 별도 separator 없이 marker line 으로 시작. v0.6 의 "정상 4-segment + footer separator" 가정은 *실 codex output 구조와 불일치* → separator split paradigm 폐기 + marker-based extraction 채택. evidence 단일 source = 본 golden fixture 2 file (in-repo committed, 향후 codex CLI 업데이트로 banner / footer 변경 시 master 가 fixture refresh + parser 계약 재검증 의무).
> - #1h H2: `grep -nE "feat\(§5\.6\.4 v0\.[0-9]+\)" plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md plan/phase-5/phase-5-todo.md` 실측 9 hit (canonical 8 = 4 commit line + 4 table cell, 모두 `v0.3` / mirror 1 = commit 1 `v0.6`). v0.7 = 9 hit 모두 `v0.7` lock. 향후 cycle #2 (post-impl APPROVE 후 push) 시 prefix 일관.
>
> - v0.6 (2026-05-13, codex Mode D Panel cycle #1g NEEDS_REVISION 3 finding 모두 해소 — codex 권장 fix 양식 그대로 적용) — 변경 3 항목 (G# = cycle #1g finding 번호 매핑):
>   - (a) **#1g G1 fix [HIGH / matrix type shape]** — v0.5 가 48 cell 을 주장하나 const shape `Record<Provider, Record<LLMCliOptionField, SupportLevel>>` 는 8 field × 3 provider = **24 entry** 만 표현 (path 축 미포함). 또한 `Provider` type 은 wikey-core 에 미존재 (`wikey-core/src/types.ts` line 136 = `LLMProvider = 'gemini' | 'anthropic' | 'openai' | 'ollama'`). codex 권장 fix 그대로 적용: (1) `SubscriptionProvider = Exclude<LLMProvider, 'ollama'>` type 신설 (subscription path 미지원 provider 인 ollama 만 exclude — `'gemini' | 'anthropic' | 'openai'` 3 element). (2) Matrix shape = **nested** `Record<SubscriptionProvider, Record<'subscription' | 'api', Record<LLMCliOptionField, SupportLevel>>>`. runtime key count = 3 providers × 2 paths × 8 fields = **48** (cell-count 일치 lock). (3) §3.5 + §3.7 + 본문 모두 shape · provider type · 48-cell 검증 기준 갱신.
>   - (b) **#1g G2 fix [HIGH / codex positional parser body leak]** — v0.5 `segments.slice(1)` 은 segments[0] 만 drop. codex 실 stdout 구조 = `header(segments[0]) → "--------" → "user prompt: ..."(segments[1]) → "--------" → response(segments[2]) → "--------" → "tokens used:"(segments[3])` (4 segment). v0.5 는 `user prompt:` segment 가 본문에 남음 → `not.toMatch(/user prompt:/)` 회귀 case 9 FAIL. codex 권장 fix 그대로 적용: 정상 형식 (segments.length ≥ 4 + last 가 "tokens used:" 포함) = **첫 두 segment 제거** (header + user prompt 라벨) + last separator 이전까지 body. 비정상 / 짧은 형식 (segments.length < 4 또는 footer 부재) = 보수적으로 segments[0] 만 drop + footer 가 있으면 last drop (v0.5 path 유지, 회귀 안전). 회귀 fixture `codex-ok-raw.txt` 의 `user prompt:` 포함 + clean output assertion 추가.
>   - (c) **#1g G3 fix [MED / residual drift self-validation]** — §3.9 line 245 sample code 주석 `"기존 6 field 보존"` 이 active spec 범위에 잔존. v0.6 = "기존 8 option fields 보존 (model / temperature / maxTokens / jsonMode / seed / thinkingBudget / timeout / responseMimeType)" 으로 정정. anchor (m) grep 패턴 + scope 재정의: *changelog history quote* (line 39 의 "6 field × 3 × 2 = 36" 처럼 인용 부호로 v0.3 표기 history 인용한 곳) 와 *stale unquoted active spec* 분리. v0.6 grep 결과 본문 §8 에 직접 인용 (말로만 주장 X).
>
> **v0.6 선결 의무 결과 (master 직접 read, 2026-05-13)**:
> - #1g G1: `wikey-core/src/types.ts` line 136 read 완료 — 실제 type 정의 = `export type LLMProvider = 'gemini' | 'anthropic' | 'openai' | 'ollama'` (4 element). subscription path 미지원 = `ollama` 1개 (local, OAuth subscription 개념 없음). 따라서 `SubscriptionProvider = Exclude<LLMProvider, 'ollama'>` = 3 element (`'gemini' | 'anthropic' | 'openai'`) lock.
> - #1g G2: `/tmp/codex-5.6.4-cycle1c-1778673786.log` 처음 30행 read 완료 — codex stdout 실 구조 fixture 확증:
>   ```
>   OpenAI Codex v0.128.0 (research preview)
>   --------                           ← separator 1
>   workdir: /Users/denny/...           ← (이 metadata 는 header 안에 속함)
>   ...
>   reasoning effort: xhigh
>   session id: 019e2138-...
>   --------                           ← separator 2
>   user                                ← segments[1] 첫 줄
>   # Codex Mode D Panel — wikey ...    ← user prompt 본문 (multi-line)
>   ```
>   즉 segments[0] = header (CLI banner + workdir + model + session metadata), segments[1] = "user prompt:" 라벨 + 사용자 prompt 본문, segments[2] = response, segments[3] = "tokens used: <N>" footer. 정상 4-segment 구조에서 **첫 두 segment 제거 의무** 확증.
> - **#1g G3**: 본문 §8 자기 검증 grep 결과 표 — 적용 후 active spec 범위 (line 100~1100, changelog 인용 제외) 잔존 drift 0 확증. — 변경 5 항목 (F# = cycle #1f finding 번호 매핑):
>   - (a) **#1f F1 fix [HIGH / matrix-type]** — v0.4 가 §3.9 에서 `onAuthFallback` 을 `LLMCallOptions` 에 추가했으므로 `keyof LLMCallOptions` 가 *10 key* (callback 포함). §3.7 의 `Record<keyof LLMCallOptions, SupportLevel>` 은 path-support 가 무의미한 `provider` / `onAuthFallback` 까지 강제 entry 요구 → type 불일치. v0.5 = **명시 union 도입**: `export type LLMCliOptionField = Exclude<keyof LLMCallOptions, 'provider' | 'onAuthFallback'>` (8 element). matrix const = `Record<Provider, Record<LLMCliOptionField, SupportLevel>>`. §3.5 의 `provider-cli-options.test.ts` 행 "36 cell" → **48 cell** 정정 (v0.4 잔존 drift 청소).
>   - (b) **#1f F2 fix [MED / CLI golden numeric]** — fixture/case 수 lock 단일 source 미정합. v0.5 = **3 metric 분리**:
>     - **13 fixture files** = 5 raw/clean pair (10 files) + 3 error raw (3 files)
>     - **8 fixture units** = 5 raw/clean pair + 3 error raw (각 fixture file *집합*)
>     - **11 parser test cases** = 5 raw==clean parsing + 3 banner/footer/header leak 회귀 (gemini header / codex banner / codex footer) + 3 error detection (gemini-401 / claude-401 / codex-401)
>     - §4.0.7 + §5.2 A3-1 + §5.2 A3-1 체크박스 모두 위 lock 숫자로 byte-level 재동기화.
>   - (c) **#1f F3 fix [MED / parser positional]** — codex parser 가 v0.4 에서 *내용 regex* (`/(OpenAI Codex|user prompt:|workdir:|model:)/i`) 로 header segment 식별 → 정상 응답이 이 단어 문자열 포함 시 본문이 잘못 제거. v0.5 = **위치 기반**: `stdout.split(/^-+$/m)` segment 배열의 **`segments[0]` (banner+metadata) 제거 + `segments.at(-1)` 가 "tokens used" 포함 시 마지막 제거 + 남은 segment 들 join → trim**. 회귀 fixture `codex-bodylike-raw.txt` (body 안 "model:" / "workdir:" / "tokens used:" 문자열 포함) + `codex-bodylike-clean.txt` 추가 → 11 parser case 중 leak 회귀 case 가 이 fixture 로 강화.
>   - (d) **#1f F4 fix [MED / mirror drift]** — todox = canonical, phase-5-todo.md = mirror. v0.5 lock metric (8 LLMCallOptions field / 48 cell matrix / 13 fixture files / 8 fixture units / 11 parser cases / 8 lock bullet count) 으로 동시 Edit. 잔존 drift ("11 fixture" / "15 fixture" / "7 항목" / "5+3+3" 수식) 모두 청소.
>   - (e) **#1f F5 fix [LOW / CLI version policy]** — `check-cli-versions.sh` 의 fail-open 약화 청소: v0.5 = **strict semver lock**: (1) `--strict` flag 신설 — *any* semver drift (major / minor / patch) = exit 1. CI / pre-commit hook 에서 strict 사용 의무. (2) 기본 invocation (no flag) = major drift exit 1 / minor warn / patch silent (개발 편의), 단 startup background invocation 도 `--strict` 호출로 lock. (3) semver regex 견고화 — `codex --version` 출력이 multi-line "codex-cli 0.128.0\n..." 형식 가능 → regex `\b(\d+)\.(\d+)\.(\d+)\b` 첫 match 추출 + fail 시 nonzero exit (warning 만 표기). (4) waiver mechanism — `./scripts/cli-version-waiver.json` 에 `{"gemini":"0.41.x"}` 명시 시 해당 minor drift 만 skip (review-required 명시 흔적). fail-open 금지 LOCK.
>
> **v0.5 선결 의무 결과 (master 직접 read, 2026-05-13)**:
> - #1f F1: `wikey-core/src/types.ts` line 138~156 (기존 9 field) read **재확증** + v0.4 §3.9 추가 `onAuthFallback?` (1 신규 callback field) read 완료. 최종 `keyof LLMCallOptions` = **10 key** (`provider` / `model` / `temperature` / `seed` / `maxTokens` / `timeout` / `responseMimeType` / `jsonMode` / `thinkingBudget` / `onAuthFallback`). path-support 평가 row = `Exclude<keyof LLMCallOptions, 'provider' | 'onAuthFallback'>` = **8 field** (matrix 48 cell 계산 lock).
> - #1f F4: `plan/phase-5/phase-5-todo.md` line 796~830 영역 line 단위 read 완료 — lock bullet 실제 count = **8** (OAuth flow / token refresh / 48-cell matrix / auth_mode schema / geminiApiKey lower-camel / buildConfig 1561 정의 + 5 호출 site / legal A/B / codex #2 gate). v0.4 자기 정의 "7 항목" 표기는 v0.4 작성 시 lock bullet 본인이 8개를 출력하면서 메타 라벨을 "7 항목"으로 stale 표기한 drift. v0.5 mirror 에서 "8 항목" 으로 통일.
>
> - **v0.4 (2026-05-13, codex Mode D Panel cycle #1e NEEDS_REVISION 4 finding 모두 해소)** — 변경 4 항목 (F# = cycle #1e finding 번호 매핑):
>   - (a) **#1e F1 fix [MED / numeric matrix]** — §3.7 matrix count 정정. 실제 = `LLMCallOptions` 의 8 option field (`provider` 제외, route 결정 자체) × 6 path/provider column (3 provider × 2 path) = **48 decision cell**. 본문 36-cell 표기 → 48-cell 정정. `provider-cli-options.test.ts` golden 도 48 cell 으로 갱신.
>   - (b) **#1e F2 fix [MED / CLI golden]** — §4.0.7 footer 처리 + clean text extraction 규칙 명시. 6 fixture (gemini-ok / claude-ok / codex-ok 각 raw + normalized) 신규. parser 가 banner / header / footer / trailing status 를 모두 제거하고 답변 본문만 반환. golden assertion 으로 잠금.
>   - (c) **#1e F3 fix [MED / mirror drift]** — `phase-5-todo.md §5.6.4` line 787~837 동시 Edit. v0.3 + v0.4 lock bullets 8 항목 (OAuth flow / token refresh 폐기 / 48-cell matrix / `auth_mode` schema / `geminiApiKey` lower-camel / `buildConfig` 1561 정의 / legal 영역 A/B / codex #2 gate) byte-level 재동기화 + drift 4 건 (web search / OAuth flow / token refresh / DESIGN.md sync) 명시 정리.
>   - (d) **#1e F4 fix [LOW / maintenance]** — §5.2 A3-1 + §3.7 신규 subsection "CLI version snapshot + drift policy". PoC 재실측 시 `gemini --version` / `claude --version` / `codex --version` capture → `provider-cli-options.ts` const block 의 `CLI_VERSION_SNAPSHOT` 에 lock. 향후 CLI 업데이트 발견 시 fail-open 아니라 **review-required** (`./scripts/check-cli-versions.sh` warning + Settings UI Notice "CLI version drift — re-validate matrix").
>
> - **v0.3 (2026-05-13, codex Mode D Panel cycle #1c NEEDS_REVISION 9 finding 모두 해소)** — 변경 9 항목 (F# = codex finding 번호 매핑):
>   - (a) **F1 fix** — §3.7 신규 "LLMCallOptions × provider × path support matrix" (6 field × 3 provider × 2 path = 36 cell). subscription path 미지원 옵션은 API fallback 또는 명시 warning. AC-S9~S12 신규 (option preservation).
>   - (b) **F2 fix** — §3.4 credentials schema 양방향 migration 명시. 현재 실제 schema = lower-camel (`geminiApiKey` / `anthropicApiKey` / `openaiApiKey`, main.ts:1082~1115 확증). neutral `auth` sub-object 신설 + unknown field 보존 round-trip test (`saveCredentials.test.ts`).
>   - (c) **F3 fix** — §3.9 신규 "LLMClient onAuthFallback callback API". `LLMCallOptions.onAuthFallback?: (info) => void` 추가. core 안 UI 결합 0, Obsidian 측 Notice wiring 은 main.ts 의 `buildConfig` / call sites 에서 callback 주입. test 케이스 2 추가.
>   - (d) **F4 fix** — §5.2 A0 신규 RED case "Obsidian Electron renderer spawn smoke". Step A 첫 RED 의 *공식 gate* 로 명시. 실패 시 §3.6 R3 대체 IPC (electron.shell + temp file wire) 자동 진입.
>   - (e) **F5 fix** — §4.0 PoC 확증 항목 확장. CLI stdin / argv / stdout 형식 golden test 명시 (§5.2 A3-1). codex stdout header / footer trimming 형식 PoC 재실측 의무 (§4.0.7).
>   - (f) **F6 fix** — §4.6 evidence framing 분리. "기술적 동작 가능 (PoC 확증)" vs "약관 허용 미확정 (web 본문 직접 조사 안 함)" 명시 분기. R1 reversible revert path 잔존 (§5.7.4 Path A 학습).
>   - (g) **F7 fix** — `phase-5-todo.md §5.6.4` line 796~824 본문 v0.3 정책과 byte-level 의미 일치로 동시 Edit. drift 4 건 (OAuth 자체 구현 / web search / token refresh / DESIGN.md sync) 명시 정리.
>   - (h) **F8 fix** — §3.5 + §5.2 A6 신규 "buildConfig 호출 사이트 매트릭스". 5 호출 site (line 476 / 841 / 912 / 1495 / 1535) 모두 list + auth mode 전파 대상 / 비대상 명시 + 회귀 test 추가.
>   - (i) **F9 fix** — §5.6 Step E commit/push vs codex #2 순서 고정. **"각 step local commit → 통합 검증 → codex #2 → push"** 확정 (4 commit policy 와 정합).
>
> **선결 의무 결과 (master 직접 실측, 2026-05-13)**:
> - F2: `wikey-obsidian/src/main.ts` line 1082~1115 read 완료 — 실제 credential schema 는 `geminiApiKey` / `anthropicApiKey` / `openaiApiKey` (lower-camel). v0.2 §3.4 표기 (`GEMINI_API_KEY` upper-snake) drift 확증 → §3.4 v0.3 정정.
> - F7: `plan/phase-5/phase-5-todo.md` line 796~824 read 완료 — drift 4 건 (web search / token refresh / DESIGN.md sync / "OAuth flow 구현"). v0.3 정책 (CLI 위임 / web search 미수행 / CLAUDE.md sync only) 으로 동시 Edit.
> - F8: `grep -n buildConfig wikey-obsidian/src/main.ts` → 5 호출 site (476 / 841 / 912 / 1495 / 1535) + 정의 1561. v0.2 가 언급한 476/912 외 3개 추가.
>
> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.6.4`](./phase-5-todo.md) (실행 단일 소스 — 체크박스 mirror)
>
> **관련 문서**:
> - [`wikey.schema.md`](../../wikey.schema.md) — BYOAI 원칙 (4 원칙 #4), 시스템 언어 영문 LOCK (#6)
> - [`wikey-core/src/llm-client.ts`](../../wikey-core/src/llm-client.ts) — 4 provider switch (`callGemini` / `callAnthropic` / `callOpenAI` / `callOllama`)
> - [`wikey-core/src/types.ts`](../../wikey-core/src/types.ts) — `LLMCallOptions` (9 field at line 138~156 + v0.5 추가 `onAuthFallback?` → keyof 10, path-support row 8) + `WikeyConfig`
> - [`wikey-obsidian/src/settings-tab.ts`](../../wikey-obsidian/src/settings-tab.ts) — provider 카드 / model dropdown / API key 입력 UI
> - `~/.config/wikey/credentials.json` — API key 저장 (Read 금지 / schema 확장 대상)
> - `plan/phase-5/phase-5-todox-5.6.5` (예정) — Ollama Cloud 통합 (본 §5.6.4 종결 후 후속)
>
> **wiki 재생성 없음 확증**: provider auth path 추가만. wiki 본문 / frontmatter / 페이지 / log.md 형식 변경 0. ingest pipeline 결과 (canonicalizer / mention extractor / orama index) 변경 0.
>
> **시스템 언어 LOCK**: 모든 사용자 facing 텍스트 = 영문. 코드 주석 / docs / commit 메시지는 한글 허용 (`wikey.schema.md §핵심 원칙 #6`).
>
> **하드코딩 금지 영구 룰 적용** (2026-05-10 LOCK): provider OAuth endpoint URL · token refresh interval · quota / 429 detection regex 등 *결정 로직* 은 const block 으로 따로 모으되, "static 한 stopword 목록 / 키워드 분류" 같은 의미론적 판정은 도입 0.
>
> **§5.7.2 사전 PoC 학습 적용** (8 cycle abandon 후 영구 등록): Step A LOCK *전* `wikey-core/test/llm-subscription.test.ts` 자체 fixture 와 *별개로* "외부 CLI 가 실제로 OAuth 만으로 prompt 응답을 반환하는가" 를 master 가 manual hello-world 로 사전 확증. **추가 v0.3 (F4)**: PoC 가 shell 단독으로는 부족 — **Obsidian Electron renderer 안 `child_process.spawn` smoke** 가 Step A 첫 RED gate 으로 의무화 (§5.2 A0).

---

## 1. 진행 구조 — SDD + TDD 강제 (§5.11 v2.5 양식 mirror)

```
Phase 0  Spec lock (본 todox §3) → master 7-anchor 1차 grep → codex Mode D Panel 2차 검증 (cycle #1, plan)
Phase 1  §5.6.4.0 사전 PoC — 3 provider headless 호출 확증 (master 직접 manual) + CLI I/O contract 골든
Phase 2  §5.6.4.1 Step A — provider 추상화 layer 확장 (config + types + AuthMode + CredentialResolver + onAuthFallback callback)
         └─ A0 spawn smoke (Obsidian renderer 안, F4 gate) — 실패 시 §3.6 R3 대체 IPC 진입
Phase 3  §5.6.4.2 Google → TDD RED → GREEN → BLUE 3a / 3b → master CDP smoke
Phase 4  §5.6.4.3 Anthropic → 동일 cycle (Phase 3 종결 후 진입)
Phase 5  §5.6.4.4 OpenAI → 동일 cycle (Phase 4 종결 후 진입)
Phase 6  §5.6.4.5 통합 검증 — 3 provider 동시 등록 routing matrix + 회귀 + 문서 동기화
Phase 7  최종 master 1차 검증 + codex Mode D Panel cycle #2 post-impl + 사용자 사전 보고
```

각 provider phase (3 / 4 / 5) 내부 sub-step:

```
3-RED   wikey-core/test/llm-subscription-<provider>.test.ts 신규 + 회귀 case → FAIL 확증
3-GREEN llm-client.ts 안 callXxxSubscription + AuthResolver 구현 → PASS
3a      회귀 — npm test (wikey-core + wikey-obsidian) / npm run build / ./scripts/validate-wiki.sh
3b      BLUE refactor — 함수 분해 / Naming / DRY / 주석 quality
3-smoke master CDP — Sign in 버튼 클릭 → 콜백 detect → Notice 영문 / chat 1 query 성공
3-local commit (local only) — push 보류, 통합 후 일괄 push
```

**v0.3 commit/push 순서 LOCK (F9 fix)**: 각 step local commit (push X) → 4 commit 누적 → §5.6.4.5 통합 검증 → codex Mode D Panel cycle #2 → master verdict 결정 → 사용자 사전 보고 → push. 즉 **codex #2 이전 push 안 함** (F7 미커밋 위험 회피 + reversible revert path 보존).

---

## 2. 검증 의무 매트릭스 (rules.md §10 + agent-management.md §7)

| 단계 | master 1차 | codex 2차 | tester | 라이브 smoke (master 직접) |
|------|-----------|----------|--------|---------------------------|
| Phase 0 spec lock | 본 §3 7-anchor + 20 anchor grep | Mode D cycle #1 (plan APPROVE) | — | — |
| Phase 1 §5.6.4.0 PoC | manual hello-world 3 CLI + CLI I/O 골든 (§5.2 A3-1, raw/clean pair) + CLI version snapshot capture (§3.7.1) | — | — | — |
| Phase 2 §5.6.4.1 A0 spawn smoke | Obsidian renderer 안 `require('child_process').spawn` 실측 | — | — | obsidian-cdp 1 cycle (master) — F4 gate |
| Phase 2 §5.6.4.1 추상화 | 단위 test + grep diff | — | (master 직접 RED/GREEN) | — |
| Phase 3~5 각 provider | 매 RED/GREEN 후 fresh `npm test` | — (v0.2: mini cycle 폐기) | (master 직접) | obsidian-cdp `Settings → Sign in → Notice → Chat 1 query` |
| Phase 6 통합 | 회귀 + routing matrix 6 case + buildConfig 5 site 회귀 (§5.2 A6) | — | — | obsidian-cdp 3 provider 동시 등록 cycle |
| Phase 7 post-impl | 12 AC line-by-line (8 routing + 4 option preservation) | **Mode D cycle #2 (code + smoke APPROVE) — 의무, push 직전** | — | — |

**v0.3 사용자 결정 mirror (2026-05-13)**: codex cycle = **2 cycle 의무만** (#1 plan / #2 post-impl). provider 별 mini cycle 폐기.

**검증 도구**:
- master 1차: `npm test` (wikey-core + wikey-obsidian fresh) / `npm run build` / `./scripts/validate-wiki.sh` / 7-anchor + 6 codex pattern + 7 fix mode = 20 anchor (`feedback_master_codex_pattern_learning.md`)
- codex 2차: `cmux send` Mode D Panel — fresh-pick + close-after-cycle
- 라이브 smoke: `obsidian-cdp` SKILL full cycle (CLAUDE.md §6, master 직접 책임 LOCK 2026-05-12)

---

## 3. Spec 6 요소 (analyst 영역, *codex 직송 전 master 1차*)

### 3.1 Goal / Non-Goal

**Goal**:
- wikey provider 3종 (Google Gemini / Anthropic Claude / OpenAI) 의 **subscription OAuth** 호출 path 통합 — 사용자가 가진 Gemini Advanced / Claude Pro·Max / ChatGPT Plus·Pro 구독을 통한 호출.
- subscription credential 과 API key 가 동시 등록되면 **subscription 우선 routing** + **quota / 401 / 429 시 API fallback 자동 전환** + 사용자에게 Notice (영문).
- **LLMCallOptions path-support 8 field 계약 보존** (F1 fix, v0.5 #1f F1 정정) — subscription path 도 `LLMCliOptionField = Exclude<keyof LLMCallOptions, 'provider' | 'onAuthFallback'>` 8 field (model / temperature / maxTokens / seed / responseMimeType / jsonMode / thinkingBudget / timeout) 를 최대한 보존. 미지원 옵션은 명시 warning + API fallback 자동.
- **LLMClient API 결합도 0** (F3 fix) — UI Notice 결합은 `LLMCallOptions.onAuthFallback?` callback 주입으로. core 안 `Notice` import 0.
- BYOAI 원칙 강화 — auth mode 가시화 (Settings UI 카드에 현재 mode 표시), 사용자 제어 (수동 force-api / force-subscription toggle).

**Non-Goal**:
- 비-구독 무료 tier 자동 신청 / 결제 / 구독 등급 자동 감지 (API quota header parsing 외).
- Ollama (로컬) / Gemma (로컬) 의 auth 변경.
- 새 provider 추가 (xAI / Mistral / Cohere 등) — 본 cycle 은 기존 3 종 OAuth path 만.
- Stage-aware routing (cost optimization 기반 task 별 provider 선택) — §5.6.5 별도 cycle.
- 자체 OAuth client 구현 (Anthropic / OpenAI / Google OAuth 2.0 PKCE flow 안 wikey 안 직접 구현) — 본 cycle 은 **외부 CLI (claude / codex / gemini) 의 OAuth state 재사용** 만. wikey 안 OAuth 서버 implementation 0.
- **subscription path 안 JSON mode 강제** (F1) — subscription path 는 free-form text response. `jsonMode: true` 옵션은 *API path 로 자동 fallback* (또는 명시 warning + parse 시도). 자세한 routing 은 §3.7.

### 3.2 Invariants (불변식)

- (I1) **구독형 우선 routing**: `authMode = 'auto'` 또는 `'subscription'` + subscription credential 존재 시 항상 subscription path 먼저 호출. API path 는 fallback 만.
- (I2) **API fallback 자동**: subscription 호출 실패 (401 / 403 / 429 / quota exceeded) 시 API key 존재하면 즉시 transparent retry + `LLMCallOptions.onAuthFallback?` callback 호출. callback 안에서 Obsidian Notice 영문 (`"Switched to API key (subscription quota reached)"`).
- (I3) **사용자 제어**: `authMode = 'subscription'` 명시 시 fallback 안 함 (실패 = error throw). `'api'` 명시 시 subscription 시도 안 함. `'auto'` 만 자동 fallback.
- (I4) **wiki 재생성 없음**: 본 cycle 의 모든 변경은 provider call path 안에서만.
- (I5) **영문 UI**: Settings 카드 라벨 / 버튼 / Notice 메시지 / tooltip 모두 영문. 한글 0건.
- (I6) **credentials.json read 금지**: master / agent / 코드 logger 어디서도 `~/.config/wikey/credentials.json` 의 *값* 을 stdout / log / Notice 에 노출하지 않음 (구조 / 키 존재 여부만).
- (I7) **subscription credential 위치 단일 source**: wikey 가 별도 OAuth token 을 자체 저장하지 않음. 외부 CLI 의 native auth state (`~/.gemini/oauth_creds.json` / `~/.codex/auth.json` / claude keychain) 를 *touch 하지 않고* `child_process.spawn` 으로 위임.
- (I8) **하드코딩 금지**: 외부 CLI binary path / OAuth flow regex / quota error pattern 은 config 외부화 (`wikey.conf` + override). const 상수 그룹화 시 "magic string 0" 규칙 — 각 const 에 주석 출처 명시.
- (I9) **LLMCallOptions 계약 보존** (F1 신규): subscription path 가 `model` 옵션은 *프로바이더별 가능 시* 반영 (`gemini -m <model>` / `claude --model <id>` / `codex exec -m <id>`). `temperature` / `maxTokens` / `seed` / `responseMimeType` / `thinkingBudget` 은 *현재 CLI 미지원* — 사용 시도 시 §3.7 matrix 따라 처리 (warning + API fallback or silent ignore + 명시 doc).
- (I10) **core ↔ UI 결합 0** (F3 신규): `wikey-core/src/llm-client.ts` 안 Obsidian API (`Notice`, `app.vault`) import 0건. fallback 알림은 `LLMCallOptions.onAuthFallback?: (info: AuthFallbackInfo) => void` callback 으로만. main.ts 가 callback 주입 시 Notice 호출.
- (I11) **credentials migration round-trip** (F2 신규): 기존 v0.2 schema (`geminiApiKey` / `anthropicApiKey` / `openaiApiKey`) 보존 + 신규 `auth` sub-object 추가. unknown field 보존 (read → write 시 사라지지 않음). round-trip test 의무.

### 3.3 Acceptance scenarios (12 scenario, AC-S1~AC-S12)

**Routing scenarios (S1~S8)**:

| ID | provider | 사용자 상태 | authMode | 기대 동작 |
|----|----------|------------|----------|----------|
| AC-S1 | Google | subscription only (gemini CLI 로그인) | `auto` | gemini CLI subprocess 경유 호출 성공, Notice 없음 |
| AC-S2 | Google | API key only | `auto` | API path 호출 성공, Notice 없음 |
| AC-S3 | Google | 둘 다 등록 | `auto` | subscription 먼저 호출. 정상 응답 시 API call 0 |
| AC-S4 | Google | 둘 다 등록 + subscription quota | `auto` | subscription 401/429 detect → API fallback retry + `onAuthFallback` callback 호출 + Notice 영문 |
| AC-S5 | Anthropic | 동일 4 case (subscription only / api only / 둘 다 / quota fallback) | — | claude CLI OAuth 경유 |
| AC-S6 | OpenAI | 동일 4 case | — | codex CLI exec OAuth 경유 |
| AC-S7 | 3 provider 모두 등록 | `auto` | provider 별 독립 routing — 각 자기 우선순위 적용 |
| AC-S8 | force-api 명시 | `api` | subscription credential 있어도 subscription 호출 시도 0. 401 시 throw (fallback 없음) |

**Option preservation scenarios (S9~S12, F1 신규)**:

| ID | 조건 | 기대 동작 |
|----|------|----------|
| AC-S9 | `LLMCallOptions.jsonMode = true` + subscription path | subscription path 가 jsonMode 미지원 → `onAuthFallback({reason:'jsonMode-unsupported'})` 호출 + API path 자동 사용 (auto 시). force-subscription 시 throw `"jsonMode not supported on subscription path for {provider}"` |
| AC-S10 | `LLMCallOptions.model = <custom>` | subscription path 가 model override 지원 (provider 별 매트릭스 §3.7). 미지원 provider 시 warning + default model 사용 |
| AC-S11 | `LLMCallOptions.maxTokens` / `temperature` / `seed` / `thinkingBudget` | subscription path 가 silent ignore (현재 CLI 미지원). API path 와 차이 = log debug 1줄 (Notice X). `WIKEY_DEBUG_AUTH=1` 시 stderr warning |
| AC-S12 | `LLMCallOptions.timeout` | subscription path 가 spawn timeout 으로 보존 (`child_process.spawn` 의 `signal` + `AbortController`). API path 와 동등 의미 |

각 scenario 에 대응하는 단위 test (`wikey-core/test/llm-subscription-*.test.ts`) 와 라이브 smoke (master CDP) 매핑은 §5 step 별 체크박스에서.

### 3.4 Data model 변경 (F2 fix — 양방향 migration)

**현재 실제 schema** (master 직접 read, `wikey-obsidian/src/main.ts:1082~1115` 확증, 2026-05-13):

```json
{
  "geminiApiKey": "string",
  "anthropicApiKey": "string",
  "openaiApiKey": "string"
}
```

`loadCredentials` (line 1082) 가 lower-camel key 로 read, `saveCredentials` (line 1098) 가 lower-camel 로 write. **v0.2 §3.4 가 표기한 `GEMINI_API_KEY` upper-snake 는 drift — v0.3 정정**.

**v0.3 신규 schema** (backward-compat, unknown field 보존):

```jsonc
{
  // 기존 (보존, lower-camel)
  "geminiApiKey": "string",
  "anthropicApiKey": "string",
  "openaiApiKey": "string",

  // 신규 §5.6.4 (lower-camel 일관)
  "auth": {
    "gemini":    { "mode": "subscription" | "api" | "auto" },   // default 'auto'
    "anthropic": { "mode": "subscription" | "api" | "auto" },
    "openai":    { "mode": "subscription" | "api" | "auto" }
  }
}
```

**Migration path (양방향)**:
- **forward** (기존 → 신규 read): `data.auth?.gemini?.mode ?? 'auto'`. 미존재 시 silent default `'auto'` — 사용자 기존 API key 사용자 = 자동으로 `auto` 모드 (subscription 시도 → 부재 시 즉시 API fallback, AC-S2 path).
- **backward** (신규 → 기존 write): `loadCredentials` 가 `auth` sub-object 도 함께 read. `saveCredentials` 가 기존 3 key + `auth` sub-object 같이 write.
- **unknown field 보존**: 사용자 수동 추가한 키 (예: 향후 `xaiApiKey`) 가 round-trip 에서 사라지지 않도록 `JSON.parse` 결과를 spread 후 known field 만 override. test: `wikey-obsidian/test/save-credentials.test.ts` 신규 — read → write → read 시 추가 키 보존.

**`WikeyConfig` (types.ts) 확장** — 3 신규 필드:

```typescript
export type AuthMode = 'subscription' | 'api' | 'auto'

readonly GEMINI_AUTH_MODE?: AuthMode    // default 'auto'
readonly ANTHROPIC_AUTH_MODE?: AuthMode
readonly OPENAI_AUTH_MODE?: AuthMode
```

**`LLMCallOptions` 확장** (F3 + F1 + I9, I10):

```typescript
export interface AuthFallbackInfo {
  readonly provider: 'gemini' | 'anthropic' | 'openai'
  readonly reason:
    | 'quota-exceeded'       // 401/429 from subscription
    | 'auth-missing'         // CLI not logged in
    | 'spawn-failed'         // child_process error
    | 'jsonMode-unsupported' // F1: subscription CLI not JSON
    | 'timeout'              // spawn timeout
  readonly originalError?: Error
}

export interface LLMCallOptions {
  // ... 기존 8 option fields 보존 (model / temperature / maxTokens / jsonMode / seed / thinkingBudget / timeout / responseMimeType)
  //     + 1 routing field (provider) — types.ts line 138~156 의 9 field 총합
  /** F3 신규 — subscription path 가 API fallback 으로 전환 시 1회 호출. UI 결합 격리. */
  readonly onAuthFallback?: (info: AuthFallbackInfo) => void
}
```

**미저장 (Non-Goal)**:
- OAuth access token / refresh token (외부 CLI 가 보관)
- subscription tier / quota 캐시 (매 호출 detect)
- session id / login timestamp

### 3.5 Affected files / 추정 LOC (v0.3 갱신, F8 + 신규 section 반영)

| 파일 | 변경 종류 | 추정 LOC |
|------|----------|---------|
| `wikey-core/src/llm-client.ts` | 3 provider 메서드 각각 분기 + 신규 `callXxxSubscription` 3개 + `callWithFallback` helper + `onAuthFallback` callback wiring | +320 / -20 |
| `wikey-core/src/types.ts` | `AuthMode` type + 3 신규 `WikeyConfig` field + `AuthFallbackInfo` interface + `LLMCallOptions.onAuthFallback` | +35 |
| `wikey-core/src/config.ts` | defaults `'auto'` 3개 | +6 |
| `wikey-core/src/auth-resolver.ts` | 신규 — `resolveAuthMode` + `detectFallbackTrigger` + `provider-cli-options.ts` matrix import | +180 |
| `wikey-core/src/cli-spawn.ts` | 신규 — `spawnCliPrompt(provider, prompt, opts)` (claude / codex / gemini child_process wrapper) + AbortController timeout | +220 |
| `wikey-core/src/provider-cli-options.ts` | 신규 (F1) — LLMCallOptions × provider × path support matrix const block + `mapOptionsToCliArgs(provider, opts)` | +120 |
| `wikey-obsidian/src/main.ts` | `loadCredentials` (line **1082**) + `saveCredentials` (line **1098**) auth sub-object 처리 + `loadFromWikeyConf` (line **933**) + `buildConfig` (정의 **1561**, 5 호출 site 모두 검증) — auth_mode 파싱 + onAuthFallback Notice wiring | +60 |
| `wikey-obsidian/src/settings-tab.ts` | 3 provider 카드 — "Sign in with …" 버튼 + auth mode dropdown + status display | +220 |
| `wikey-core/test/llm-subscription-gemini.test.ts` | 신규 — AC-S1~S4 + AC-S9~S12 = 12 case | +280 |
| `wikey-core/test/llm-subscription-anthropic.test.ts` | 신규 — 동일 12 case | +280 |
| `wikey-core/test/llm-subscription-openai.test.ts` | 신규 — 동일 12 case | +280 |
| `wikey-core/test/auth-resolver.test.ts` | 신규 — 8 case (§5.2 A2 결정 표) | +140 |
| `wikey-core/test/cli-spawn.test.ts` | 신규 (mock spawn) — 6 case (success / timeout / 401 / stdout 빈 / stderr / AbortSignal) | +150 |
| `wikey-core/test/provider-cli-options.test.ts` | 신규 (F1, v0.6 #1g G1) — **48 cell** matrix mapping golden (3 SubscriptionProvider × 2 AuthPath × 8 LLMCliOptionField, nested shape) | +200 |
| `wikey-obsidian/test/save-credentials.test.ts` | 신규 (F2 round-trip) — read → write → read + unknown field 보존 | +120 |
| `wikey-obsidian/test/build-config-auth-mode.test.ts` | 신규 (F8) — 5 호출 site 각각 auth mode 전파 회귀 | +150 |
| **합계** | — | **~2,460** |

(LOC ±30% 추정. PoC 결과에 따라 cli-spawn / auth-resolver 분리 vs 통합 결정 시 변동.)

**buildConfig 5 호출 site 매트릭스** (F8 fix, master 직접 grep 2026-05-13):

| line | 호출 위치 | auth mode 전파 대상? | 회귀 test |
|------|----------|---------------------|----------|
| 476 | constructor `new LLMClient(this.httpClient, this.buildConfig())` | ✅ 대상 — main LLMClient | build-config-auth-mode.test.ts case 1 |
| 841 | scripts-runner env inject (`cfg.WIKEY_SEARCH_ENGINE` / `cfg.WIKEY_HYBRID_MODE`) | ❌ 비대상 — 검색 engine 키만 inject (LLM 호출 아님) | 명시 case 2: auth mode key 가 subprocess env 로 leak 안 됨 (보안) |
| 912 | `onSettingsSaved` reload — `new LLMClient(this.httpClient, this.buildConfig())` | ✅ 대상 — Settings 저장 후 새 LLMClient 가 신규 auth mode 반영 | case 3 |
| 1495 | `buildFilterCallOptions` — `buildFilterCallOptionsFromSettings(this.settings, this.buildConfig())` | ✅ 대상 — filter LLM call 도 auth mode 동일 적용 | case 4 |
| 1535 | `buildFilterLLMClient` — `new LLMClient(this.httpClient, overriddenConfig)` (overridden = `{...baseConfig, ...}`) | ✅ 대상 — provider override 시에도 auth mode 보존 | case 5 |

회귀 test 가 5 site 모두 cover. case 2 (841) 는 *비대상* 의 명시 — auth mode 키가 search subprocess env 로 누출 안 됨 확증.

### 3.6 Risk (3 가지)

- **R1 (HIGH) — 외부 CLI ToS / Pro plan 의 "headless 자동화" 위반 가능성**: 사용자 R1 명시 동의 (2026-05-13) 로 commit. 단 **F6 fix (v0.3)**: evidence framing 분리:
  - **"기술적 동작 가능"** = §4.6 PoC 실측 + local CLI 공식 docs 명시 (§4.6.1 setup-token / §4.6.2 ChatGPT 권장 / §4.6.3 Automation & Integration).
  - **"약관 허용"** = *별개 영역* — wikey 가 ToS 본문 직접 조사 안 함 (조사 도구 한계 §4.6.4). 사용자 책임 영역.
  - **revert path 보존**: 계정 제재 / 정책 변경 통지 시 `authMode = 'api'` force + 본 cycle revert (§5.7.4 Path A reversible experiment 패러다임). revert 비용 ≈ 0 (provider call path 만 변경, wiki 재생성 0).
- **R2 (MED) — 외부 CLI 출력 형식 변동 (CLI 업그레이드 시 회귀)**: `claude -p` / `gemini -p` / `codex exec` 의 stdout 포맷이 CLI 메이저 버전 업그레이드 시 변경되면 wikey response parser 회귀. 대응:
  - `cli-spawn.ts` 안 *minimal parsing* — `stdout.trim()` 만 사용. 자유 텍스트 응답 그대로 반환.
  - **F5 fix (v0.3)**: §4.0.7 PoC 재실측 — 각 CLI 의 stdin / argv / stdout 형식 golden test 작성 (§5.2 A3-1). codex stdout header / footer trimming 형식 명시 확증.
  - CLI 버전 lock 권고 (wikey.conf 안 `MIN_CLI_VERSION_*` 키, optional). 미설정 시 warning 만.
- **R3 (MED) — Electron renderer 의 `child_process.spawn` 제약**: Obsidian plugin (Electron renderer) 안에서 `node:child_process` 호출 가능 여부. **F4 fix (v0.3)**: §5.2 A0 가 첫 RED gate. 실패 시:
  - 대체 IPC path: `electron.shell.openPath` + temp file 으로 결과 wire. cli-spawn.ts 가 fallback path 자동 선택 (`spawnViaShell` 신규 함수).
  - 또는 Obsidian plugin 의 main process IPC channel (electron `ipcMain`) 사용. 단 main process 접근은 Obsidian API 제약 — A0 결과 확증 후 결정.
  - A0 smoke 가 PASS = renderer 안 spawn 가능 = 기본 path 진행. FAIL = §5.6.4.1 Step A 일시 중단 + 사용자 raise + 대체 path 결정 cycle.

### 3.7 LLMCallOptions × provider × path support matrix (F1 신규, v0.4 #1e F1 정정, v0.6 #1g G1 nested shape)

**목적**: subscription CLI path 가 기존 LLMCallOptions 필드를 *얼마나 보존* 하는가의 단일 source. caller (canonicalizer / mention extractor / query tuning / ingest) 가 의존하는 옵션이 subscription 전환 시 깨지면 wiki 품질 회귀.

**Matrix scope (v0.6 #1g G1 — nested shape + SubscriptionProvider type)**:

`LLMCallOptions` 전체 = **10 key** (`provider` / `model` / `temperature` / `seed` / `maxTokens` / `timeout` / `responseMimeType` / `jsonMode` / `thinkingBudget` — `wikey-core/src/types.ts` line 138~156 의 9 field — 그리고 v0.4 §3.9 가 추가한 `onAuthFallback?` callback 1 신규 field). 이 중 두 key 는 path-support 평가가 무의미:

- `provider` — *routing 자체* 를 결정하는 메타 field. caller 가 명시한 provider 가 곧 matrix column-set
- `onAuthFallback` — UI callback. *어느 path 에서도 path 와 무관* (CLI flag 도, API param 도 아님)

**type 단일 source** (v0.6 갱신 — `SubscriptionProvider` 도입):

```typescript
// wikey-core/src/types.ts 안 export
// v0.6 #1g G1: 실제 LLMProvider type (line 136) = 'gemini' | 'anthropic' | 'openai' | 'ollama'
// subscription path 미지원 = 'ollama' (local 모델, OAuth subscription 개념 없음) → exclude
export type SubscriptionProvider = Exclude<LLMProvider, 'ollama'>
// 결과 union = 'gemini' | 'anthropic' | 'openai' (3 element)

export type LLMCliOptionField = Exclude<keyof LLMCallOptions, 'provider' | 'onAuthFallback'>
// 결과 union = 'model' | 'temperature' | 'maxTokens' | 'seed' | 'responseMimeType' | 'jsonMode' | 'thinkingBudget' | 'timeout' (8 element)

export type AuthPath = 'subscription' | 'api'
// 결과 union (2 element)
```

- Matrix axis 1 = **3 SubscriptionProvider** (gemini / anthropic / openai)
- Matrix axis 2 = **2 AuthPath** (subscription / api)
- Matrix axis 3 = **8 LLMCliOptionField** (cardinality lock)
- Total decision cells = **3 × 2 × 8 = 48 cell** (nested shape 의 runtime key product 와 정확히 일치)

**v0.5 shape (24-entry) 의 한계** (v0.6 #1g G1 raise): v0.5 = `Record<Provider, Record<LLMCliOptionField, SupportLevel>>` 는 path 축 부재. 8 field × 3 provider = 24 entry. "48 cell" 표기와 실 shape 불일치 + `Provider` type 미존재. v0.6 = nested shape 로 정정 + `SubscriptionProvider` type 정의.

**Matrix** (cell = `support / fallback action`):

| Option field | Gemini API | Gemini CLI (subscription) | Anthropic API | Claude CLI | OpenAI API | Codex CLI |
|--------------|-----------|---------------------------|---------------|-----------|-----------|-----------|
| `model` | ✅ (URL param) | ⚠️ `-m <model>` flag 지원 (gemini v0.40+) | ✅ (header) | ⚠️ `--model <id>` 지원 (claude v2.1+) | ✅ (body param) | ⚠️ `-m <id>` flag (codex v0.128+) |
| `temperature` | ✅ (generationConfig) | ❌ unsupported → silent ignore + debug log | ✅ | ❌ silent ignore | ✅ | ❌ silent ignore |
| `maxTokens` | ✅ (maxOutputTokens) | ❌ silent ignore | ✅ | ❌ silent ignore | ✅ | ❌ silent ignore |
| `seed` | ✅ (generationConfig.seed) | ❌ silent ignore | ❌ (API not support) | ❌ silent ignore | ❌ (API not support) | ❌ silent ignore |
| `responseMimeType` | ✅ ("application/json" → JSON mode) | ❌ unsupported → AC-S9 fallback (auto: API / force-sub: throw) | ❌ (Anthropic API tool_use 사용) | ❌ AC-S9 fallback | ✅ (response_format) | ❌ AC-S9 fallback |
| `jsonMode` | ✅ (== responseMimeType:'application/json') | ❌ AC-S9 fallback | ⚠️ (system prompt 안 instruction) | ❌ AC-S9 fallback | ✅ | ❌ AC-S9 fallback |
| `thinkingBudget` | ✅ (gemini-2.5 thinkingConfig) | ❌ silent ignore | N/A (Anthropic 미지원) | N/A | N/A (OpenAI 미지원) | N/A |
| `timeout` | ✅ (HTTP request timeout) | ✅ (`AbortController` + spawn signal) | ✅ | ✅ (동일) | ✅ | ✅ (동일) |

**Fallback action 분류**:
- ✅ = 지원, 옵션 forward
- ⚠️ = 부분 지원 (CLI flag mapping)
- ❌ silent ignore = `WIKEY_DEBUG_AUTH=1` 시 stderr warning 만. `onAuthFallback` 호출 안 함 (response quality 보존됨)
- ❌ AC-S9 fallback = jsonMode 또는 responseMimeType='application/json' 시 *자동 API path 사용* (auto mode). force-subscription 시 `throw` + `onAuthFallback({reason:'jsonMode-unsupported'})`.

**`provider-cli-options.ts` 구조** (const block, 출처 주석 의무):

```typescript
// 출처: gemini --help (v0.40.1) / claude --help (v2.1.140) / codex --help (v0.128.0)
// PoC 실측 일자: 2026-05-13
// v0.6 #1g G1: nested shape `Record<SubscriptionProvider, Record<AuthPath, Record<LLMCliOptionField, SupportLevel>>>`
// runtime key count = 3 providers × 2 paths × 8 fields = 48 (cell-count 일치 lock)
export const CLI_OPTION_SUPPORT: Record<
  SubscriptionProvider,
  Record<AuthPath, Record<LLMCliOptionField, SupportLevel>>
> = {
  gemini: {
    api:          { model: 'native', temperature: 'native', maxTokens: 'native', seed: 'native',     responseMimeType: 'native',      jsonMode: 'native',      thinkingBudget: 'native', timeout: 'native' },
    subscription: { model: 'flag',   temperature: 'ignore', maxTokens: 'ignore', seed: 'ignore',     responseMimeType: 'unsupported', jsonMode: 'unsupported', thinkingBudget: 'ignore', timeout: 'native' },
  },
  anthropic: {
    api:          { model: 'native', temperature: 'native', maxTokens: 'native', seed: 'unsupported',responseMimeType: 'unsupported', jsonMode: 'native',      thinkingBudget: 'na',     timeout: 'native' },
    subscription: { model: 'flag',   temperature: 'ignore', maxTokens: 'ignore', seed: 'ignore',     responseMimeType: 'unsupported', jsonMode: 'unsupported', thinkingBudget: 'na',     timeout: 'native' },
  },
  openai: {
    api:          { model: 'native', temperature: 'native', maxTokens: 'native', seed: 'unsupported',responseMimeType: 'native',      jsonMode: 'native',      thinkingBudget: 'na',     timeout: 'native' },
    subscription: { model: 'flag',   temperature: 'ignore', maxTokens: 'ignore', seed: 'ignore',     responseMimeType: 'unsupported', jsonMode: 'unsupported', thinkingBudget: 'na',     timeout: 'native' },
  },
}

export function mapOptionsToCliArgs(
  provider: SubscriptionProvider,
  opts: LLMCallOptions,
): { args: string[]; warnings: string[]; unsupported: 'jsonMode' | null } { /* ... */ }
```

**test** (`provider-cli-options.test.ts`, **48 cell golden** — v0.6 #1g G1 nested shape):
- 각 cell 의 supportLevel literal 확증 (코드 출력 == matrix 표 == README 출처)
- 3 provider × 2 path × 8 field = 48 assertion (각 `expect(CLI_OPTION_SUPPORT[provider][path][field]).toBe(<level>)`)
- `SubscriptionProvider` union cardinality assertion 1건 — runtime `Object.keys(CLI_OPTION_SUPPORT).length === 3` + compile-time `const _: SubscriptionProvider = 'gemini'` (ollama 미포함 확증)
- `LLMCliOptionField` union cardinality assertion 1건 — runtime `Object.keys(CLI_OPTION_SUPPORT.gemini.subscription).length === 8` + compile-time exhaustiveness 검증
- `mapOptionsToCliArgs` 가 unsupported jsonMode (subscription path) 시 sentinel return → caller (llm-client) 가 fallback 분기
- `CLI_VERSION_SNAPSHOT` const 와 실 CLI `--version` 출력 일치 확증 case 신규 (§3.7.1)

### 3.7.1 CLI version snapshot + drift policy (v0.4 #1e F4 신규)

**문제** (cycle #1e F4 raise): `provider-cli-options.ts` 의 matrix 는 *PoC 일자의 CLI 버전* 기반. Gemini / Claude / Codex CLI 가 메이저 업데이트되면 flag 지원 / stdout 형식 / OAuth flow 가 silent 변경 → matrix 가 조용히 낡아도 wikey tests 는 *의도된 계약* 을 보장 못 함 (golden 은 코드 vs 코드 비교일 뿐).

**v0.5 정책 — strict semver lock (fail-open LOCK 금지, #1f F5 정정)**:

```typescript
// wikey-core/src/provider-cli-options.ts (excerpt — F4 신규)
// 출처: master 직접 PoC 실측 (2026-05-13)
// gemini --version → 0.40.1
// claude --version → 2.1.140 (Claude Code)
// codex --version  → 0.128.0 (codex-cli)
export const CLI_VERSION_SNAPSHOT = {
  gemini:    { major: 0, minor: 40, patch: 1,   probedAt: '2026-05-13' },
  anthropic: { major: 2, minor: 1,  patch: 140, probedAt: '2026-05-13' },
  openai:    { major: 0, minor: 128, patch: 0,  probedAt: '2026-05-13' },
} as const
```

**drift 감지 도구 — `./scripts/check-cli-versions.sh` 신규** (v0.4 + v0.5 #1f F5 강화):

**호출 모드 분기 (v0.5 신규)**:
- `./scripts/check-cli-versions.sh --strict` — **CI / pre-commit / main.ts onload background** 의무. *any* semver drift (major / minor / patch) = exit 1. fail-open 금지 LOCK.
- `./scripts/check-cli-versions.sh` (기본) — 개발자 manual run 편의: major drift exit 1 / minor warn (exit 0) / patch silent. **production 진입점 (Settings UI startup) 은 `--strict` 호출 의무**.

**semver regex 견고화** (v0.5 #1f F5):
- CLI `--version` 출력이 multi-line 가능 (예: `codex-cli 0.128.0\nNode.js 22.17.0\n...`). regex = `\b([0-9]+)\.([0-9]+)\.([0-9]+)\b` 의 **첫 match** 추출
- 매치 실패 = exit 2 + stderr `ERROR: <provider> --version output unparseable: <raw>` (warning 만이 아닌 nonzero — silent fail 차단)
- 추출된 major/minor/patch 와 `CLI_VERSION_SNAPSHOT` 비교

**drift 비교 분기**:
- major drift (예: 0.x → 1.x) → exit 1 + 영문 stderr: `ERROR: gemini CLI major drift (snapshot 0.40.1, runtime 1.0.0). Re-validate provider-cli-options matrix.`
- minor drift → `--strict` 시 exit 1 / non-strict 시 exit 0 + warn
- patch drift → `--strict` 시 exit 1 / non-strict 시 silent
- 일치 → exit 0

**waiver mechanism** (v0.5 신규 — explicit review trail):
- `./scripts/cli-version-waiver.json` — 명시 등록된 drift만 strict mode 에서도 skip
  ```jsonc
  {
    "gemini":    "0.41.x",   // minor drift waived (review 완료 후 등록)
    "anthropic": "2.1.142"   // patch drift waived (특정 버전만)
  }
  ```
- 패턴 매치 시 stdout `NOTE: <provider> drift waived (<pattern>)` + exit 0. file 부재 시 빈 waiver.
- waiver 자체는 git tracked → review trail 보존 (수동 commit 시 master 가 검토)

**Settings UI startup wiring** (v0.5):
- main.ts `onload` 에서 background `check-cli-versions.sh --strict` 호출
- exit nonzero → Notice 영문 "CLI version drift — re-validate matrix" + Settings 카드 안 status badge (영문) + console error 1줄

**Matrix refresh rule (review-required)**:
1. `check-cli-versions.sh --strict` exit nonzero
2. master 가 해당 CLI `--help` / `--version` re-capture
3. `provider-cli-options.ts` matrix cell + `CLI_VERSION_SNAPSHOT` 갱신 *or* `cli-version-waiver.json` 에 명시 등록 (review trail)
4. `provider-cli-options.test.ts` 48 cell golden 재실행 → PASS 확증
5. activity log 에 drift detection + matrix refresh 1-line 기록

**금지**:
- ❌ fail-open (drift 무시 + matrix 안 갱신) — caller 가 silent regress
- ❌ 자동 matrix refresh (LLM 이 추론으로 갱신) — CLI 실 동작과 mismatch 위험
- ❌ `--strict` 누락된 background invocation — production 진입점은 strict 의무
- ❌ regex match 실패 시 silent skip — exit 2 + stderr 의무

### 3.8 credentials migration (F2 신규)

**migration 시나리오**:

| from version | to version | trigger | 동작 |
|--------------|-----------|---------|------|
| v0.2 (3 API key only) | v0.3 (+ auth sub-object) | 사용자가 wikey 업그레이드 후 Obsidian 재로딩 | `loadCredentials` 가 `data.auth ?? {}` 으로 read. 미존재 시 default `auto`. saveCredentials 가 `auth` sub-object 추가하여 write. |
| v0.3 (+ auth) | v0.2 (downgrade) | 사용자가 plugin downgrade | v0.2 의 loadCredentials 는 `auth` 키 무시 (unknown field). 데이터 손실 0 (file 안 잔존). |
| v0.3 → v0.3 (round-trip) | — | 사용자 수동 편집 후 plugin 다시 저장 | 사용자 추가 키 (예: `xaiApiKey`) 보존. test 의무. |

**`loadCredentials` v0.3 구현 양식**:

```typescript
loadCredentials(): void {
  try {
    const raw = fs.readFileSync(this.credentialsPath, 'utf-8')
    const data = JSON.parse(raw) as Record<string, unknown>
    // 기존 3 키 (lower-camel)
    this.settings.geminiApiKey = (data.geminiApiKey as string) ?? ''
    this.settings.anthropicApiKey = (data.anthropicApiKey as string) ?? ''
    this.settings.openaiApiKey = (data.openaiApiKey as string) ?? ''
    // 신규 auth sub-object (default 'auto')
    const auth = (data.auth as Record<string, { mode?: AuthMode }>) ?? {}
    this.settings.geminiAuthMode = auth.gemini?.mode ?? 'auto'
    this.settings.anthropicAuthMode = auth.anthropic?.mode ?? 'auto'
    this.settings.openaiAuthMode = auth.openai?.mode ?? 'auto'
    // F2: unknown field 보존 — 원본 data 를 plugin state 에 잔존 (saveCredentials 가 reuse)
    this.credentialsRaw = data
  } catch { /* 파일 없음 — 초기 상태 */ }
}
```

**`saveCredentials` v0.3 구현 양식**:

```typescript
saveCredentials(): void {
  const out: Record<string, unknown> = {
    ...this.credentialsRaw,  // F2: unknown field 보존
    geminiApiKey: this.settings.geminiApiKey,
    anthropicApiKey: this.settings.anthropicApiKey,
    openaiApiKey: this.settings.openaiApiKey,
    auth: {
      gemini:    { mode: this.settings.geminiAuthMode    ?? 'auto' },
      anthropic: { mode: this.settings.anthropicAuthMode ?? 'auto' },
      openai:    { mode: this.settings.openaiAuthMode    ?? 'auto' },
    },
  }
  fs.writeFileSync(this.credentialsPath, JSON.stringify(out, null, 2))
}
```

**test (`wikey-obsidian/test/save-credentials.test.ts`)**:
- case 1: v0.2 file → v0.3 load → save → file 안 3 기존 key + auth sub-object 동시 존재
- case 2: 사용자 수동 추가 키 (`xaiApiKey: 'sk-...'`) → load → save → 그 키 여전히 file 안 존재
- case 3: v0.3 file → v0.3 load → save → byte-identical (round-trip)

### 3.9 LLMClient onAuthFallback callback API (F3 신규)

**문제** (v0.2 에서 codex 가 raise): `wikey-core/src/llm-client.ts` 의 LLMClient 생성자는 `(httpClient, config)` 2 param 만. UI Notice 결합 API 없음. v0.2 §3.2 I2 의 "Notice 영문" 을 core 가 직접 호출하면 wikey-core ↔ wikey-obsidian 결합 발생 (I10 위반).

**v0.3 해법** — callback per-call injection:

```typescript
// wikey-core/src/types.ts
export interface AuthFallbackInfo {
  readonly provider: 'gemini' | 'anthropic' | 'openai'
  readonly reason: 'quota-exceeded' | 'auth-missing' | 'spawn-failed' | 'jsonMode-unsupported' | 'timeout'
  readonly originalError?: Error
}

export interface LLMCallOptions {
  // 기존 9 field 보존 (provider / model / temperature / seed / maxTokens / timeout
  //                  / responseMimeType / jsonMode / thinkingBudget)
  // ...
  readonly onAuthFallback?: (info: AuthFallbackInfo) => void
}

// v0.5 #1f F1: path-support matrix 의 row union — `provider` / `onAuthFallback` 제외
export type LLMCliOptionField = Exclude<keyof LLMCallOptions, 'provider' | 'onAuthFallback'>
// 결과 = 'model' | 'temperature' | 'maxTokens' | 'seed' | 'responseMimeType' | 'jsonMode' | 'thinkingBudget' | 'timeout' (8)
```

```typescript
// wikey-core/src/llm-client.ts (excerpt)
private async callWithFallback<T>(
  provider: LLMProvider,
  subscriptionFn: () => Promise<T>,
  apiFn: () => Promise<T>,
  opts: LLMCallOptions,
): Promise<T> {
  const mode = resolveAuthMode(provider, this.config, this.presence)
  if (mode === 'subscription') {
    try { return await subscriptionFn() }
    catch (err) {
      const trigger = detectFallbackTrigger(err)
      if (this.authMode(provider) === 'auto' && this.hasApiKey(provider) && trigger) {
        opts.onAuthFallback?.({ provider, reason: trigger, originalError: err as Error })
        return apiFn()
      }
      throw err
    }
  }
  return apiFn()
}
```

```typescript
// wikey-obsidian/src/main.ts (excerpt — buildConfig 호출 시 wiring)
const onAuthFallback = (info: AuthFallbackInfo) => {
  const messages: Record<AuthFallbackInfo['reason'], string> = {
    'quota-exceeded':       `Switched to API key (${info.provider} subscription quota reached)`,
    'auth-missing':         `Switched to API key (${info.provider} not signed in)`,
    'spawn-failed':         `Switched to API key (${info.provider} CLI failed to launch)`,
    'jsonMode-unsupported': `Using API key for JSON output (${info.provider} subscription not supported)`,
    'timeout':              `Switched to API key (${info.provider} subscription timeout)`,
  }
  new Notice(messages[info.reason])
}
// LLMClient 호출 site 에 opts 로 주입 (call path 전체에서 동일 callback)
```

**test 케이스**:
- `wikey-core/test/llm-subscription-gemini.test.ts` case "AC-S4 fallback callback 호출" — onAuthFallback spy 가 1회 호출 + info.provider = 'gemini' + reason = 'quota-exceeded' 확증
- `wikey-core/test/llm-subscription-gemini.test.ts` case "core 에 Obsidian import 0" — `import.meta` grep 또는 build 시 `wikey-core/src/**/*.ts` 안 `from 'obsidian'` 0건 확증

**core 결합 0 grep gate** (master 1차):
```bash
grep -rn "from 'obsidian'" wikey-core/src/   # 결과 = 0 line
grep -rn "new Notice"      wikey-core/src/   # 결과 = 0 line
```

---

## 4. 사전 PoC 결과 (§5.6.4.0, master 직접, 2026-05-13)

**모드**: master 가 `wikey/` 디렉토리에서 3 CLI 의 headless 호출 hello-world 직접 실행.

| Provider | CLI binary | 로그인 상태 확인 | hello-world 결과 | 출처 / 증거 |
|----------|-----------|-----------------|------------------|-------------|
| **Google Gemini** | `/Users/denny/.nvm/versions/node/v22.17.0/bin/gemini` (v0.40.1) | `~/.gemini/oauth_creds.json` + `google_accounts.json` + `projects.json` 존재 | `gemini -p "say only hi"` → `"hi"` (10s 내 응답) | session 42 master probe, 2026-05-13 |
| **Anthropic Claude** | `/Applications/cmux.app/Contents/Resources/bin/claude` (Claude Code v2.1.140) | macOS Keychain (claude CLI 내부) — 직접 file 검사 X | `claude -p "say only hi"` → `"hi"` (15s 내 응답) | session 42 master probe |
| **OpenAI Codex** | `/Users/denny/.nvm/versions/node/v22.17.0/bin/codex` (codex-cli v0.128.0) | `codex login status` → `"Logged in using ChatGPT"`. `~/.codex/auth.json` 존재. | `printf "say only hi\n" \| codex exec -` → 정상 OAuth session header + (응답 도중 timeout 절단, 단 OAuth 호출 자체 PASS) | session 42 master probe |

**분기 판단**: **(A) 3 provider 모두 외부 OAuth 가능 → 사용자 요구대로 3-provider 통합 진행**.

### 4.0.7 CLI I/O 형식 골든 (F5 fix + v0.4 #1e F2 footer / clean text 확장 + v0.7 #1h H1 marker-based 재정정, §5.6.4.0 PoC 재실측 의무)

**Step A 진입 전 master 가 1회 직접 실측**. golden output 을 test fixture 로 commit. v0.4 (cycle #1e F2): *footer 처리* 와 *clean text extraction 기준* 을 명시 + raw stdout fixture 와 normalized clean text expected 를 분리 commit (한 fixture pair = `*-raw.txt` + `*-clean.txt`).

**v0.7 evidence 단일 source** (#1h H1, master 직접 실측 2026-05-13):
- `plan/phase-5/fixtures/cycle-codex-golden/codex-ok-hi.raw.txt` (381 bytes, master `printf "say only the word: hi\n" \| codex exec -` 캡처)
- `plan/phase-5/fixtures/cycle-codex-golden/codex-ok-hi.clean.txt` (3 bytes, expected = `hi\n`)
- v0.6 가 인용한 `/tmp/codex-5.6.4-cycle1c-1778673786.log` 는 **무효** (separator 2개만 + footer 부재 → 4-segment 가정 wrong). v0.7 = 본 in-repo golden fixture 가 단일 evidence.

| Provider | stdin / argv | stdout banner / header | stdout body | stdout footer / trailing | parsing 전략 |
|----------|--------------|------------------------|-------------|--------------------------|--------------|
| **gemini** | `gemini -p '<prompt>'` argv (또는 `-p -` + stdin) | `"Loaded cached credentials.\n"` (1줄, OAuth refresh 시점에만 출력될 수 있음 — variable) | `<response>` | 없음 (process exit 직전 trailing newline 만) | (1) header regex strip: `/^Loaded cached credentials\.\n/` (2) `body.trim()` |
| **claude** | `claude -p` + stdin | 없음 | `<response>` | 없음 | `stdout.trim()` |
| **codex** | `codex exec -` + stdin | banner `"OpenAI Codex v<ver> (research preview)"` line + separator `--------` + metadata block (`workdir:` / `model:` / `provider:` / `approval:` / `sandbox:` / `reasoning effort:` / `reasoning summaries:` / `session id:`) + separator `--------` + `"user\n<prompt body>\n"` | (빈 line) + `"codex\n<response body>\n"` | `"tokens used\n<count>\n"` (별 separator 없이 marker line 으로 시작) | **v0.7 #1h H1 marker-based extraction**: (1) `codexMarker = raw.indexOf('\ncodex\n')` — response 시작 marker (2) `tokensMarker = raw.indexOf('\ntokens used')` — footer 시작 marker (3) 정상 형식 = 두 marker 모두 존재 + codexMarker < tokensMarker → `raw.slice(codexMarker + '\ncodex\n'.length, tokensMarker).trim()` (4) 비정상 형식 (marker 부재 또는 순서 역전) = fallback `raw.trim()`. 본문 내용 무관 보존 (body 안 "codex" / "tokens used" / "model:" / "workdir:" 단어가 line-start 가 아니라면 leak 0). separator split paradigm 폐기 — codex 실 stdout 의 separator 는 2개만 + footer 가 별 separator 없이 marker line. evidence = `codex-ok-hi.raw.txt` golden fixture |

**Clean text extraction 정의** (v0.4 #1e F2):
1. **Strip banner / header**: provider 별 첫 부분의 metadata (CLI version / workdir / model / "Loaded cached credentials") 제거. regex 또는 segment delimiter 기준.
2. **Strip footer / trailing status**: provider 별 마지막 부분의 token usage / "tokens used" / trailing dash separator 제거.
3. **Trim whitespace**: 결과 string `.trim()` (양끝 공백 / 개행 제거).
4. **Preserve response newlines**: 답변 본문 안 줄바꿈은 보존 (multi-line 응답 회귀 방지).

**Parser 계약** (`wikey-core/src/cli-parser.ts` 신규, v0.7 marker-based):
```typescript
export function parseSubscriptionOutput(
  provider: 'gemini' | 'anthropic' | 'openai',
  rawStdout: string,
): string {
  switch (provider) {
    case 'gemini': {
      // Step 1: strip variable header
      const body = rawStdout.replace(/^Loaded cached credentials\.\n/, '')
      // Step 2~4
      return body.trim()
    }
    case 'anthropic': {
      return rawStdout.trim()  // no banner / footer
    }
    case 'openai': {
      // v0.7 #1h H1: marker-based extraction
      // codex 실 stdout 구조 (master 실측 golden fixture, codex-ok-hi.raw.txt):
      //   <banner>
      //   --------                              ← separator 1 (banner ↔ metadata)
      //   <metadata block: workdir/model/.../session id>
      //   --------                              ← separator 2 (metadata ↔ user)
      //   user
      //   <prompt body>
      //   (빈 line)
      //   codex                                 ← response marker (LINE START)
      //   <response body>
      //   tokens used                           ← footer marker (LINE START)
      //   <token count>
      //
      // separator 는 총 2개만, footer 는 별 separator 없이 marker line 으로 시작.
      // → separator split paradigm 폐기, marker-based extraction 채택.
      const codexMarker = rawStdout.indexOf('\ncodex\n')
      const tokensMarker = rawStdout.indexOf('\ntokens used')
      if (codexMarker === -1 || tokensMarker === -1 || codexMarker >= tokensMarker) {
        // 비정상 형식 (marker 부재 또는 순서 역전) — full stdout trim fallback
        return rawStdout.trim()
      }
      return rawStdout.slice(codexMarker + '\ncodex\n'.length, tokensMarker).trim()
    }
  }
}
```

**Marker-based vs separator-based 차이** (v0.7 #1h H1):
- v0.4 내용 regex 기반 → body 안 "model: ..." 같은 정상 텍스트가 header 로 오인식 → 본문 leak / 손실
- v0.5 separator-based (`segments[0]` 만 drop) → user prompt 라벨 segment 가 본문에 남음 → `not.toMatch(/user prompt:/)` 회귀 FAIL
- v0.6 separator-based (4-segment 처리, `segments.slice(2, -1)`) → 가정한 separator 개수 (4 segment) 가 실 codex output 과 불일치 (separator 2개만 + footer 가 marker line). master 가 `/tmp/codex-5.6.4-cycle1c-1778673786.log` 와 실측 fixture 를 cross-check → v0.6 evidence invalid 판명
- **v0.7 marker-based** → `\ncodex\n` (response start) 와 `\ntokens used` (footer start) 두 line-start marker 로 sandwich. body 안 단어 "codex" / "model" / "tokens used" 가 line-middle 에 있으면 leak 0. line-start marker 와 정확히 정합하지 않은 경우 = `raw.trim()` fallback (보수적). evidence = `codex-ok-hi.raw.txt` golden fixture (master 실측)
- 회귀 fixture `codex-bodylike-raw.txt`: 본문이 의도적으로 `"Here's how to use model:gemini-pro for queries. Also workdir: paths matter. tokens used: in metadata."` 포함 (모두 line-middle). clean = 본문 그대로 (단어 leak 0, marker 가 line-start `\ncodex\n` / `\ntokens used` 와 일치 안 함 → body 가 그대로 보존됨)
- 회귀 fixture `codex-ok-hi-raw.txt` (master 실측 golden): prompt body 안 `say only the word: hi` 가 response body 보다 *위* 에 위치 (`\ncodex\n` marker 이전). clean = response body 만 (`hi`). prompt sentinel `say only the word:` leak 0 / banner `OpenAI Codex` leak 0 / metadata `workdir:` `session id:` leak 0 / footer `tokens used` leak 0

**미확증 항목** (PoC 재실측 의무, master Step A 진입 전):
- **codex 완료 응답 본문** — session 42 PoC 에서 timeout 절단. master 가 longer-timeout (60s) 으로 재실측 + 실 응답 본문 형식 확증 (특히 footer "tokens used: <N>" 형식 변동 / 추가 metadata line 유무).
- **gemini "Loaded cached credentials" header 변동** — 매 호출마다 출력되는지 / OAuth refresh 시점에만인지 PoC 재실측. variable → regex 갱신 또는 segment 기반 parsing 으로 전환.
- **각 CLI error message 형식** — 401 / quota / not-logged-in / model-not-found 4 종 stderr 형식 mock 어렵 → 실 운영 중 patch + drift detection 로 follow-up.

**`cli-parser.test.ts` golden test fixture (v0.4 #1e F2 + v0.5 #1f F2 + v0.7 #1h H1 marker-based 재정정 — 3 metric 단위 lock)**:

**lock 단일 source (v0.7)**:
- **13 fixture files** = 5 raw/clean pair (10 files) + 3 error raw (3 files)
- **8 fixture units** = 5 raw/clean pair + 3 error raw
- **11 parser test cases** = 5 raw==clean parsing + 3 leak 회귀 (gemini header / codex banner+prompt / codex bodylike marker-leak) + 3 error detection (gemini-401 / claude-401 / codex-401)

fixture 디렉토리: `wikey-core/test/fixtures/cli-stdout/` (13 files, **master 실측 golden = `codex-ok-hi-*` 가 codex pair 의 단일 evidence**):
- pair 1: `gemini-ok-raw.txt` (header 포함 raw) + `gemini-ok-clean.txt` (expected 본문)
- pair 2: `gemini-noheader-ok-raw.txt` + `gemini-noheader-ok-clean.txt` (header 부재 케이스)
- pair 3: `claude-ok-raw.txt` + `claude-ok-clean.txt`
- pair 4: `codex-ok-hi-raw.txt` (master 실측 golden, copy of `plan/phase-5/fixtures/cycle-codex-golden/codex-ok-hi.raw.txt` — prompt `"say only the word: hi"` + response `hi` + footer `tokens used\n15997`) + `codex-ok-hi-clean.txt` (expected = `hi`)
- pair 5: `codex-bodylike-raw.txt` (v0.7 갱신 — 본문에 line-middle 위치 `"model:gemini-pro"` / `"workdir: paths"` / `"tokens used: in metadata"` 단어 포함, marker line-start 와 불일치 → leak 0) + `codex-bodylike-clean.txt`
- error 1: `gemini-401-raw.txt` (clean 없음 — error detection)
- error 2: `claude-401-raw.txt`
- error 3: `codex-401-raw.txt`

(v0.6 의 `codex-ok-raw.txt` (separator-based 가정 fixture) 는 v0.7 에서 `codex-ok-hi-raw.txt` (master 실측 golden) 으로 대체.)

```typescript
// wikey-core/test/cli-parser.test.ts (v0.7 #1h H1 — 11 case lock, marker-based)
// case 1~5: raw==clean parsing (5 case)
test.each([
  ['gemini',    'gemini-ok'],
  ['gemini',    'gemini-noheader-ok'],
  ['anthropic', 'claude-ok'],
  ['openai',    'codex-ok-hi'],     // v0.7 #1h H1: master 실측 golden
  ['openai',    'codex-bodylike'],  // v0.7 #1h H1: marker leak 회귀 (body 안 line-middle marker-like 단어)
])('parseSubscriptionOutput(%s, raw) === clean fixture', (provider, name) => {
  const raw = readFile(`fixtures/cli-stdout/${name}-raw.txt`)
  const expected = readFile(`fixtures/cli-stdout/${name}-clean.txt`)
  expect(parseSubscriptionOutput(provider, raw)).toBe(expected.trimEnd())  // trailing newline 만 file 보존상 차이
})

// case 6: codex banner + prompt sentinel leak 회귀 (v0.7 #1h H1 marker-based 검증)
//        prompt 본문 = "say only the word: hi" (unique sentinel) — response 본문 만 추출 확증
test('codex parser drops banner / metadata / prompt / footer (marker-based)', () => {
  const raw = readFile('fixtures/cli-stdout/codex-ok-hi-raw.txt')
  const out = parseSubscriptionOutput('openai', raw)
  // unique prompt sentinel leak 차단 (가장 강한 assertion)
  expect(out).not.toContain('say only the word:')   // prompt 본문 sentinel
  // banner leak 차단
  expect(out).not.toContain('OpenAI Codex')          // banner
  expect(out).not.toContain('research preview')      // banner suffix
  // metadata block leak 차단
  expect(out).not.toContain('workdir:')              // metadata
  expect(out).not.toContain('session id:')           // metadata
  expect(out).not.toContain('approval:')             // metadata
  // user prompt 라벨 leak 차단
  expect(out).not.toMatch(/^user$/m)                 // line "user" (prompt 라벨)
  expect(out).not.toContain('user prompt:')          // 구버전 라벨 (혹시 모를 codex CLI 변동 대비)
  // separator leak 차단
  expect(out).not.toMatch(/^-+$/m)
})

// case 7: codex footer leak 회귀
test('codex parser drops "tokens used" footer marker', () => {
  const raw = readFile('fixtures/cli-stdout/codex-ok-hi-raw.txt')
  const out = parseSubscriptionOutput('openai', raw)
  expect(out).not.toContain('tokens used')
  // body 만 추출 확증
  expect(out).toBe('hi')
})

// case 8: gemini header leak 회귀
test('gemini parser drops "Loaded cached credentials" header', () => {
  const raw = readFile('fixtures/cli-stdout/gemini-ok-raw.txt')
  const out = parseSubscriptionOutput('gemini', raw)
  expect(out).not.toMatch(/Loaded cached credentials/)
})

// case 9~11: error detection (3 case)
test.each([
  ['gemini',    'gemini-401',    'auth-missing'],
  ['anthropic', 'claude-401',    'auth-missing'],
  ['openai',    'codex-401',     'auth-missing'],
])('detectFallbackTrigger(%s, 401 raw) === %s', (provider, name, expected) => {
  const raw = readFile(`fixtures/cli-stdout/${name}-raw.txt`)
  expect(detectFallbackTrigger(provider, raw)).toBe(expected)
})
```

**회귀 방지 효과**: marker-based parser 가 banner / prompt sentinel / footer 를 답변 본문에 leak 시 unique prompt sentinel assertion `not.toContain('say only the word:')` 가 가장 먼저 FAIL → 회귀 즉시 catch. (separator split paradigm 잔존 코드도 case 7 `toBe('hi')` strict 비교에서 catch.)

### 4.6 외부 자동화 접근 통제 정책 evidence (F6 fix — framing 분리)

**사용자 raise (2026-05-13)**: "구현 가능 여부가 더 궁금. 특히 최근 Anthropic 의 외부 에이전트 접근 통제 정책 대응은?"

**조사 도구 한계** (분 §0 mirror): 본 analyst turn 은 WebSearch / WebFetch 도구 비활성 (rules.md §4 WebFetch deny + 해당 환경 WebSearch 부재). evidence 분리 = **2 영역**:

**영역 A — "기술적 동작 가능" (PoC + local docs evidence 확증)**:
- 사용자 머신 안 공식 CLI 패키지의 README / --help 출력 (vendor 의 1차 정책 source)
- 사용자 PoC 실측 (`hi` 응답)

**영역 B — "약관 허용" (직접 확증 안 함, 미확정 risk 영역)**:
- 외부 web (status page / Reddit / GitHub issue / 약관 본문) 직접 조사 안 함
- 사용자 R1 명시 동의 (2026-05-13) 로 commit
- revert path 보존: `authMode = 'api'` force + 본 cycle reversible revert

#### 4.6.1 Anthropic Claude — Pro/Max subscription headless 호출 정책

**영역 A evidence** (local CLI 공식 docs):

- `claude --help` 출력 (`/Applications/cmux.app/Contents/Resources/bin/claude` v2.1.140, Anthropic 공식 배포):
  - **`setup-token` subcommand 의 명시 문구**:
    > "Set up a long-lived authentication token (**requires Claude subscription**)"
  - **`--bare` flag 의 명시 문구**:
    > "Minimal mode: ... Anthropic auth is strictly ANTHROPIC_API_KEY or apiKeyHelper via --settings (**OAuth and keychain are never read**). 3P providers (Bedrock/Vertex/Foundry) use their own credentials."
  - **`--print` (`-p`) flag**:
    > "use -p/--print for non-interactive output" (headless 모드 = 명시 지원)

**영역 A 해석** (기술적 동작 가능 = 확정):
- (a) Anthropic 의 `setup-token` 명령 = subscription 사용자 long-lived token 발급 공식 path 존재
- (b) `--bare` 가 "OAuth + keychain 을 *읽지 않는다*" 명시 → default 모드는 OAuth + keychain 을 읽는다 = Pro/Max subscription path 가 default 동작
- (c) `--print` headless 모드가 first-class feature

**영역 B 잔여 risk** (약관 허용 = 미확정):
- ToS 본문 안 "third-party plugin automated headless calls" 조항 직접 조사 안 함
- 2026 Q1~2 정책 변경 (IP rate limit / fingerprint enforcement 강화) 미확증
- runtime detect: 401/403/429 fallback + 사용자 force-mode 전환 (`authMode = 'api'`)

**v0.3 종합 판단**: **영역 A (기술적 동작 가능) = 확증**. **영역 B (약관 허용) = 사용자 R1 명시 동의 + revert path 보존으로 commit**.

#### 4.6.2 OpenAI Codex — ChatGPT Plus/Pro headless 호출 정책

**영역 A evidence** (local CLI 공식 README):
- `/Users/denny/.nvm/versions/node/v22.17.0/lib/node_modules/@openai/codex/README.md`:
  > **"Using Codex with your ChatGPT plan"**
  > "Run `codex` and select **Sign in with ChatGPT**. We recommend signing into your ChatGPT account to use Codex as part of your **Plus, Pro, Business, Edu, or Enterprise plan**. ..."
- `codex --help`: "`exec` Run Codex non-interactively"
- 사용자 PoC 실측: `codex login status` = "Logged in using ChatGPT"

**영역 A 해석**: ChatGPT plan + `exec` non-interactive 명시 sanctioned use case.

**영역 B 잔여 risk**: README use case 가 "developer terminal 안 사용" 가정 — *third-party plugin spawn* 명시 sanction 은 없음 (명시 차단도 없음).

**v0.3 종합 판단**: **영역 A 확증 + 영역 B = R1 동의 commit**.

#### 4.6.3 Google Gemini — Google account OAuth headless 호출 정책

**영역 A evidence** (local CLI 공식 README):
- `/Users/denny/.nvm/versions/node/v22.17.0/lib/node_modules/@google/gemini-cli/README.md`:
  > **"### Automation & Integration"**
  > "- **Run non-interactively in scripts for workflow automation**"
  > **"### Option 1: Sign in with Google (OAuth login using your Google Account)"**
  > "Free tier: 60 requests/min and 1,000 requests/day; ..."
  > **"[Headless Mode (Scripting)]"**

**영역 A 해석**: Google 공식 README 가 OAuth + non-interactive script automation 을 first-class feature 로 명시.

**영역 B 잔여 risk**: paid tier (Gemini Advanced) quota interaction 미상세. runtime detect.

**v0.3 종합 판단**: **영역 A 명시 sanctioned + 영역 B = R1 동의 commit**.

#### 4.6.4 종합 분기 판단 (v0.3 framing 분리)

| Provider | 영역 A (기술적 동작) | 영역 B (약관 허용) | 분기 |
|----------|---------------------|-------------------|------|
| Anthropic | ✅ `setup-token` + `--print` + `--bare` reverse 명시 | 미확정 (ToS 본문 미조사, 정책 변경 가능) | **A 확증 + B = R1 commit** |
| OpenAI | ✅ README "Using Codex with ChatGPT plan" + `exec` | 미확정 (third-party plugin spawn 명시 sanction 없음) | **A 확증 + B = R1 commit** |
| Google | ✅ README "Automation & Integration" + Headless Mode docs | 미확정 (paid tier quota interaction 미상세) | **A 확증 + B = R1 commit** |

**v0.3 결정**: 영역 A = 확정 (PoC + local docs). 영역 B = R1 명시 동의 + revert path 보존.

**revert path 명세** (R1 mitigation):
- 계정 제재 / 정책 변경 통지 시 1 step revert: `authMode = 'api'` force-mode 전환 (사용자 Settings UI 또는 wikey.conf override)
- 본 cycle 의 commit 4 = 4 commit. revert = `git revert <hash>..<hash>` 또는 individual section revert (provider 별 분리되어 있음)
- wiki 재생성 0 = revert 시 wiki 본문 변경 X (provider call path 만 변경됨)
- **§5.7.4 Path A reversible experiment 패러다임 일관** — qmd → Orama 마이그레이션과 동일 회귀 비용 ≈ 0 구조

---

## 5. SDD+TDD 단계 분해 (§5.6.4.0 ~ §5.6.4.5)

### 5.1 §5.6.4.0 사전 PoC ✅ (Step A LOCK 직전 1회, 본 문서 §4 에 결과 기록)

- [x] 3 CLI binary 존재 + headless 응답 확증 (master probe, 2026-05-13)
- [x] `codex login status` = "Logged in using ChatGPT" 확증
- [x] gemini `oauth_creds.json` 존재 확증
- [x] PoC 결과를 본 문서 §4 에 기록
- [x] **사용자 결정**: R1 ToS 위험 = (a) 명시 동의 (2026-05-13) + §4.6 framing 분리 영역 A/B
- [ ] **v0.3 F5 fix**: §4.0.7 CLI I/O 형식 골든 재실측 — codex 완료 응답 본문 형식 + gemini header 변동 / claude header 부재 확증

### 5.2 §5.6.4.1 Step A — Provider 추상화 layer 확장

**목적**: auth mode 결정 + 외부 CLI spawn wrapper + config schema 확장 + onAuthFallback callback API. 3 provider 공통 인프라.

**A0 (F4 신규). Obsidian renderer spawn smoke — 첫 RED gate**

Step A 의 *첫 RED case* 가 추상화 layer test 가 아니라 **실 Obsidian Electron renderer 안에서 `require('node:child_process').spawn` 동작 smoke**. 실패 시 §3.6 R3 대체 IPC path 결정 cycle 진입.

- **test**: `wikey-obsidian/test/spawn-smoke.test.ts` — Obsidian plugin 환경에서 `child_process.spawn('echo', ['hello']).stdout.on('data', ...)` 1 case
- **단위 simulation 불충분** — 실 plugin runtime (master CDP smoke) 까지 필수
- **gate**:
  - PASS = §5.2 A1 진입
  - FAIL = §3.6 R3 대체 IPC 진입 (electron.shell + temp file wire 또는 ipcMain channel) + plan 재검토 cycle
- master CDP smoke: Obsidian 안 plugin reload → DevTools console → `await window.WIKEY_PLUGIN.testSpawnSmoke()` 호출 → stdout = "hello" 확증

**A1. types.ts + config.ts 확장**
- `AuthMode = 'subscription' | 'api' | 'auto'` type alias 추가
- `AuthFallbackInfo` interface 추가 (§3.4)
- `LLMCallOptions.onAuthFallback?` 옵션 추가 (§3.9)
- `WikeyConfig` 안 `GEMINI_AUTH_MODE?` / `ANTHROPIC_AUTH_MODE?` / `OPENAI_AUTH_MODE?` 필드
- `DEFAULTS` 안 3 키 모두 `'auto'`

**A2. auth-resolver.ts 신규 (wikey-core/src/)**
- `resolveAuthMode(provider, config, credentialPresence) → 'subscription' | 'api'` — 결정 로직 단일 함수
- 결정 표:
  | authMode | hasSubscription | hasApiKey | 반환 |
  |----------|-----------------|-----------|------|
  | `subscription` | true | * | `'subscription'` |
  | `subscription` | false | * | throw `"No subscription credential for {provider}"` |
  | `api` | * | true | `'api'` |
  | `api` | * | false | throw `"No API key for {provider}"` |
  | `auto` | true | true | `'subscription'` (우선) |
  | `auto` | true | false | `'subscription'` |
  | `auto` | false | true | `'api'` |
  | `auto` | false | false | throw `"No credential for {provider}"` |
- `detectFallbackTrigger(err) → 'quota-exceeded' | 'auth-missing' | 'spawn-failed' | 'timeout' | null` — quota / 401 / 429 / "rate limit" / "quota exceeded" / "not logged in" detect (regex 그룹화, 출처 주석 + URL)

**A3. cli-spawn.ts 신규 (wikey-core/src/)**
- `spawnCliPrompt(provider, prompt, opts)` — `child_process.spawn(cliPath, args)` 단일 진입점
- 3 provider 별 spawn args 정의 (const 그룹, 출처 주석):
  - `gemini` → `[geminiPath, '-p', '-']` + stdin = prompt
  - `claude` → `[claudePath, '-p']` + stdin = prompt
  - `codex` → `[codexPath, 'exec', '-']` + stdin = prompt
- `mapOptionsToCliArgs(provider, opts)` 호출 → args 확장 (`-m <model>` 등, §3.7 matrix)
- `AbortController` + `opts.timeout` 으로 spawn signal — AC-S12 보존
- stdout / stderr / exitCode 묶어 반환 (raw, parsing X — minimal parsing R2 원칙)

**A3-1. CLI I/O 골든 (F5 fix + v0.5 #1f F2 lock — 3 metric 분리)**
- `wikey-core/test/fixtures/cli-stdout/` 디렉토리 신규
- **raw / clean pair fixture (v0.5 lock)** — 답변 본문 + banner + footer 모두 commit:
  - pair 1 — `gemini-ok-raw.txt` + `gemini-ok-clean.txt`
  - pair 2 — `gemini-noheader-ok-raw.txt` + `gemini-noheader-ok-clean.txt` (header 변동 case)
  - pair 3 — `claude-ok-raw.txt` + `claude-ok-clean.txt`
  - pair 4 — `codex-ok-hi-raw.txt` + `codex-ok-hi-clean.txt` (v0.7 #1h H1 — master 실측 golden, marker-based parser 단일 evidence; copy of `plan/phase-5/fixtures/cycle-codex-golden/codex-ok-hi.{raw,clean}.txt`)
  - pair 5 — `codex-bodylike-raw.txt` + `codex-bodylike-clean.txt` (v0.7 #1h H1 marker leak 회귀 fixture — line-middle marker-like 단어 본문 보존 검증; **Step A 진입 시 신규 생성 의무**, 현재 repo 미존재)
  - error 1~3 — `gemini-401-raw.txt` / `claude-401-raw.txt` / `codex-401-raw.txt` (clean 없음)
- `parseSubscriptionOutput(provider, raw) → string` 신규 (`wikey-core/src/cli-parser.ts`) — §4.0.7 **marker-based extraction** (v0.7 #1h H1: codex `indexOf('\ncodex\n')` + `indexOf('\ntokens used')` sandwich; gemini header strip; claude trim)
- **lock metric (v0.5 #1f F2)**:
  - **13 fixture files** (5 pair × 2 + 3 error = 10 + 3)
  - **8 fixture units** (5 pair + 3 error)
  - **11 parser test cases** (5 raw==clean + 3 leak 회귀 + 3 error detection)
- master Step A 진입 전 직접 PoC 재실측 (codex 60s longer-timeout + gemini header 변동 + bodylike leak 회귀 확인)

**A3-2. CLI version snapshot (v0.4 #1e F4 신규)**
- `wikey-core/src/provider-cli-options.ts` 안 `CLI_VERSION_SNAPSHOT` const 명시 (출처 주석: PoC 일자 + 3 CLI `--version`)
- `./scripts/check-cli-versions.sh` 신규 — `gemini --version` / `claude --version` / `codex --version` capture + snapshot 비교
- major drift → exit 1 + 영문 stderr WARN
- minor drift → exit 0 + warning only
- main.ts `onload` 안 background 호출 → drift detect 시 Notice 영문 + Settings UI badge
- `provider-cli-options.test.ts` 안 `CLI_VERSION_SNAPSHOT` const 와 실 binary `--version` 일치 case 1개 (CI 환경 의존, optional skip)

**A4. credential presence detection**
- gemini: `existsSync(homedir() + '/.gemini/oauth_creds.json')` && CLI binary 존재
- claude: CLI binary 존재만 (keychain 검사 불가). 첫 호출 401 시 "not logged in" detect → subscription 부재로 즉시 fallback
- codex: `existsSync(homedir() + '/.codex/auth.json')` && CLI binary 존재
- API key: 기존 `config.GEMINI_API_KEY` 등 truthy 검사

**A5. main.ts (wikey-obsidian) — config bridge** (v0.3 F2 fix)
- `loadCredentials` (line **1082**) → v0.3 schema (`auth.{provider}.mode`) read + unknown field 보존 (§3.8)
- `saveCredentials` (line **1098**) → v0.3 schema write (기존 3 key + `auth` sub-object + unknown field)
- `loadFromWikeyConf` (line **933**) → wikey.conf 안 `GEMINI_AUTH_MODE` etc. env override
- `buildConfig` (정의 **1561**) → 3 신규 키 merge + onAuthFallback callback 주입
- override 우선순위: `process.env.WIKEY_*_AUTH_MODE` > `wikey.conf` > `credentials.json auth.*.mode` > defaults (`auto`)
- 5 호출 site 회귀 (§3.5 표) — auth mode 전파 회귀 test `build-config-auth-mode.test.ts`

**A6 (F8 신규). buildConfig 호출 사이트 회귀 test**
- `wikey-obsidian/test/build-config-auth-mode.test.ts` 신규
- 5 case (§3.5 buildConfig matrix):
  - case 1 (line 476): constructor → LLMClient 가 auth mode 받음
  - case 2 (line 841): scripts-runner env → auth mode key 가 subprocess env 로 leak 안 됨 (보안)
  - case 3 (line 912): onSettingsSaved reload → 신규 LLMClient 가 신규 auth mode
  - case 4 (line 1495): buildFilterCallOptions → filter LLM 도 auth mode 동일
  - case 5 (line 1535): buildFilterLLMClient → provider override 시에도 auth mode 보존

**Step A 체크박스**:
- [ ] **A0 (F4 gate)**: Obsidian Electron renderer 안 `child_process.spawn` smoke PASS. 실패 시 §3.6 R3 대체 IPC cycle 진입
- [ ] A1 `wikey-core/src/types.ts` — `AuthMode` + `AuthFallbackInfo` + `LLMCallOptions.onAuthFallback?` + 3 신규 optional field
- [ ] A1 `wikey-core/src/config.ts` — defaults `'auto'` 3개
- [ ] A2 `wikey-core/src/auth-resolver.ts` 신규 + RED test 8 case
- [ ] A3 `wikey-core/src/cli-spawn.ts` 신규 + RED test (mock spawn) 6 case
- [ ] A3-1 (F5 + v0.5 #1f F1 / F2 / F3 + v0.7 #1h H1) `wikey-core/src/provider-cli-options.ts` 신규 + `LLMCliOptionField` exclude union (8 element) + **48 cell matrix golden** + `wikey-core/src/cli-parser.ts` 신규 (`parseSubscriptionOutput`, **marker-based codex parser** — `indexOf('\ncodex\n')` + `indexOf('\ntokens used')` sandwich) + **13 fixture files / 8 fixture units / 11 parser cases** (raw==clean 5 + leak 회귀 3 + 401 detection 3; codex pair = `codex-ok-hi-{raw,clean}` master 실측 golden + `codex-bodylike-{raw,clean}` Step A 시 신규 생성)
- [ ] A3-2 (v0.4 #1e F4 + v0.5 #1f F5) `CLI_VERSION_SNAPSHOT` const + `./scripts/check-cli-versions.sh --strict` (semver regex 견고 + waiver mechanism `cli-version-waiver.json`) + main.ts `onload` background `--strict` 호출 + Settings UI badge
- [ ] A5 (F2) `wikey-obsidian/src/main.ts` `loadCredentials` (1082) + `saveCredentials` (1098) v0.3 schema + unknown field 보존
- [ ] A5 `loadFromWikeyConf` (933) + `buildConfig` (1561) 3 키 확증
- [ ] A6 (F8) `wikey-obsidian/test/build-config-auth-mode.test.ts` 신규 5 case
- [ ] BLUE 3a 회귀 + 3b refactor (Karpathy CLAUDE.md 의무)
- [ ] **local commit 1 (push X)**: `feat(§5.6.4 v0.7): provider auth abstraction + Google Gemini subscription`

### 5.3 §5.6.4.2 Step B — Google Gemini subscription 통합 (1순위)

**B1. RED — `wikey-core/test/llm-subscription-gemini.test.ts` 신규**

**12 case** (AC-S1~S4 routing + AC-S9~S12 option preservation + 4 isolation, v0.3 확장):

1. AC-S1 subscription only → `callGemini` 가 `spawnCliPrompt('gemini', ...)` 호출 + API path 0
2. AC-S2 API only → 기존 API path + spawn 0
3. AC-S3 둘 다 + auto → spawn 1 / API 0
4. AC-S4 quota fallback → spawn 1 / spawn 응답이 401-mock → API path retry 1 / `onAuthFallback` callback 1회 / reason='quota-exceeded'
5. force-api → spawn 0 / API path 1
6. force-subscription + 부재 → throw with 영문 메시지
7. spawn timeout → fallback 정상
8. spawn stdout 빈 string → throw + fallback (auto 시) / throw only (subscription 시)
9. **AC-S9 jsonMode** — `opts.jsonMode = true` + auto + 둘 다 등록 → API path 자동 (spawn 0) + `onAuthFallback({reason:'jsonMode-unsupported'})` 1회
10. **AC-S10 model override** — `opts.model = 'gemini-2.5-flash'` → spawn args 안 `-m gemini-2.5-flash` 포함
11. **AC-S11 silent ignore** — `opts.temperature = 0.5` + subscription → spawn args 안 temperature 없음 + WIKEY_DEBUG_AUTH=1 시 stderr warning 1줄
12. **AC-S12 timeout** — `opts.timeout = 100` + subscription 응답 200ms 지연 → AbortController abort + fallback 정상

추가 4 isolation:
13. core 안 obsidian import 0 (`from 'obsidian'` grep = 0)
14. core 안 Notice 호출 0 (`new Notice` grep = 0)
15. onAuthFallback callback 없으면 (`opts.onAuthFallback === undefined`) silent fallback (정상 동작)
16. authMode resolver throw 시 onAuthFallback 호출 안 함 (resolver 단계 = pre-call, fallback 아님)

**B2. GREEN — `wikey-core/src/llm-client.ts` 수정** (F1 + F3 wiring)
- `callGemini` 분기:
  ```typescript
  return this.callWithFallback(
    'gemini',
    () => this.callGeminiSubscription(prompt, opts),
    () => this.callGeminiApi(prompt, opts),
    opts,
  )
  ```
- `callGeminiSubscription` 신규 — `mapOptionsToCliArgs('gemini', opts)` → unsupported jsonMode 시 즉시 `throw FallbackError({reason:'jsonMode-unsupported'})` → `callWithFallback` 이 catch → API path + onAuthFallback 호출
- `cliClient.spawnCliPrompt('gemini', prompt, { args: cliArgs, timeout: opts.timeout })` + 응답 raw → `parseSubscriptionOutput('gemini', raw)`
- 기존 `callGemini` 본문 → `callGeminiApi` 으로 rename (private)

**B3. Settings UI — `wikey-obsidian/src/settings-tab.ts`**
- Google provider 카드 (line ~190 영역) 안 신규 행:
  - dropdown: `Auth mode` — `Subscription (Gemini Advanced)` / `API key` / `Auto (subscription first, API fallback)` (default Auto)
  - 영문 status text: `Subscription: detected | not detected` / `API key: configured | empty`
  - 버튼: `Sign in with Google` (CLI 가 OAuth flow 못 trigger 시 사용자에게 안내 — `gemini` 명령 터미널 실행 가이드 Modal)
  - 버튼: `Sign out` — `gemini logout` spawn (또는 안내 Modal)
- 영문 일관성 확증 — 다른 카드와 라벨 alignment

**B4. BLUE 3a — 회귀**
- `npm test` (wikey-core + wikey-obsidian fresh)
- `npm run build` (0 errors)
- `./scripts/validate-wiki.sh` (PASS)

**B5. BLUE 3b — refactor**
- `callGemini` 분기 로직이 `callAnthropic` / `callOpenAI` 와 패턴 동일 → `callWithFallback` 공통 helper 는 §5.2 A 에서 도입. provider 별 함수 = thin wrapper
- magic string 검출 (영문 Notice / error message) — `messages.ts` const block 분리

**B6. master CDP smoke** (LOCK 2026-05-12, master 직접)
- Vault open → Settings → Wikey → Google card 확증
- `Sign in with Google` 클릭 → Modal or CLI 안내 + 사용자 manual `gemini` 로그인 확인
- Chat panel → query "test 1" → 응답 확증 + console log 안 spawn 호출 1건
- Notice 영문 verify (Korean 문자 0건 grep)

**Step B 체크박스** (Google):
- [ ] RED 12 case + 4 isolation = 16 case FAIL 확증
- [ ] GREEN `callGeminiSubscription` + 분기 → 16 case PASS
- [ ] Settings UI Google 카드 영문 dropdown + 버튼 추가 + onAuthFallback Notice wiring
- [ ] BLUE 3a 회귀 PASS
- [ ] BLUE 3b refactor — magic string const 분리
- [ ] master CDP smoke 3 scenario (subscription only / api only / fallback)
- [ ] **local commit 1 (Step A + B 통합, push X)**

### 5.4 §5.6.4.3 Step C — Anthropic Claude subscription 통합 (2순위)

§5.6.4.2 Google 종결 후 진입. 동일 RED → GREEN → 3a / 3b → smoke 흐름.

**C1. RED — `wikey-core/test/llm-subscription-anthropic.test.ts`**
- 16 case (AC-S5 4 routing + AC-S9~S12 option preservation 4 + 4 isolation + 4 추가 Anthropic 고유 = thinkingBudget N/A 확증 etc.)

**C2. GREEN — `callAnthropicSubscription`**
- `spawnCliPrompt('claude', prompt, opts)` — `claude -p` + stdin + `mapOptionsToCliArgs('anthropic', opts)`
- credential presence: CLI binary 존재만 검사 (keychain 직접 검사 불가)
- 첫 호출 시 stderr "Please login" 또는 stdout 빈 string detect → "subscription 부재" 로 처리 → `detectFallbackTrigger` 가 `'auth-missing'` 반환 → fallback

**C3. Settings UI — Anthropic 카드**
- Auth mode dropdown / status / `Sign in with Claude` 버튼 / `Sign out`
- 안내: `Sign in with Claude → run "claude /login" in terminal then return here` (영문, Modal)

**Step C 체크박스** (Anthropic):
- [ ] RED 16 case FAIL
- [ ] GREEN 16 case PASS
- [ ] Settings UI Anthropic 카드
- [ ] BLUE 3a / 3b
- [ ] master CDP smoke 3 scenario
- [ ] **local commit 2 (Step C, push X)**: `feat(§5.6.4 v0.7): Anthropic Claude subscription auth`

### 5.5 §5.6.4.4 Step D — OpenAI subscription 통합 (3순위)

§5.6.4.3 Anthropic 종결 후 진입.

**D1. RED — `wikey-core/test/llm-subscription-openai.test.ts`** (16 case)

**D2. GREEN — `callOpenAISubscription`**
- `spawnCliPrompt('codex', prompt, opts)` — `codex exec -` + stdin + `mapOptionsToCliArgs('openai', opts)`
- credential presence: `~/.codex/auth.json` + CLI binary
- 응답 파싱 — §4.0.7 골든 (v0.7 **marker-based extraction**: `indexOf('\ncodex\n')` + `indexOf('\ntokens used')` sandwich, separator paradigm 폐기). master 실측 golden `codex-ok-hi.raw.txt` evidence. PoC 재실측 (§5.1 [ ] 항목) 확증 후 진입

**D3. Settings UI — OpenAI 카드**
- `Sign in with ChatGPT` 버튼 / 안내 `run "codex login" in terminal`

**Step D 체크박스** (OpenAI):
- [ ] RED 16 case FAIL
- [ ] GREEN 16 case PASS
- [ ] Settings UI OpenAI 카드
- [ ] BLUE 3a / 3b
- [ ] master CDP smoke 3 scenario
- [ ] **local commit 3 (Step D, push X)**: `feat(§5.6.4 v0.7): OpenAI Codex subscription auth`

### 5.6 §5.6.4.5 Step E — 통합 검증 + 문서 동기화

**v0.3 F9 fix — commit/push 순서 LOCK**:

```
Step A → local commit 1 (Step A + Step B Google 합산, push X)
Step C → local commit 2 (push X)
Step D → local commit 3 (push X)
Step E → local commit 4 (refactor + 문서, push X)
   ↓
통합 검증 (E2 회귀)
   ↓
codex Mode D Panel cycle #2 post-impl (4 commit diff 통합 송부)
   ↓
master verdict 결정 (codex APPROVE 자동 수용 X)
   ↓
사용자 사전 보고
   ↓
push (`git push origin master`)
```

**E1. 통합 routing matrix smoke** (master 직접 CDP)
- 3 provider 모두 subscription + API 동시 등록
- chat 안 default provider 별 호출 → 각 자기 우선순위 적용 확증 (`auto` 3개 → 각 subscription)
- 1 provider force-api 설정 → 그 provider 만 API path 사용 확증
- 1 provider 의 jsonMode 호출 (canonicalizer / mention extractor) → API path 자동 + Notice "Using API key for JSON output"

**E2. 회귀 종합**
- `npm test` (wikey-core 939+ / wikey-obsidian 191+)
- `npm run build` 0 errors
- `./scripts/validate-wiki.sh` PASS
- 신규 test 총 케이스 수 합산 (예상 48 단위 + 12 통합 + 5 buildConfig 회귀 + 3 isolation = ~68 신규)

**E3. BLUE 3b 통합 refactor**
- `callWithFallback` 공통 helper 가 §5.2 A 에서 도입되었으므로 3 provider 가 동일 패턴 thin wrapper 확증
- `messages.ts` 영문 const block — Notice / error 5~8 string
- subscriptionFn / apiFn signature 통일 (return Promise<string>)
- Karpathy 4 원칙 cross-check:
  - Explicit (auth mode UI 가시화) ✅
  - Yours (token 외부 CLI 가 로컬 보관, wikey 안 token 0) ✅
  - File over app (credentials.json + auth_mode JSON) ✅
  - BYOAI (provider 통합 옵션 확장) ✅

**E4. 문서 동기화**
- `activity/phase-5/phase-5-resultx-5.6.4-llm-subscription-2026-05-XX.md` 신규 — 12 AC line-by-line evidence + 5 buildConfig 회귀 evidence
- `activity/phase-5/phase-5-result.md` §5.6.4 entry 추가 + 종결 mark
- `plan/phase-5/phase-5-todo.md` §5.6.4 체크박스 sweep `[x]` (v0.3 본문은 이미 §F7 fix 에서 갱신됨)
- `wikey.schema.md §LLM 에이전트의 역할` 의 BYOAI 표에 "구독 로그인 / API key 동시 등록 시 구독 우선" 한 줄 (사용자 승인 필요)
- `CLAUDE.md §LLM 설정` 섹션에 auth mode 설명 추가 (사용자 승인 필요)
- **DESIGN.md sync 폐기 (F7 drift fix)** — DESIGN.md 는 디자인 토큰 (`--wk-*`) 단일 소스. Settings UI 카드 추가는 디자인 토큰 변경 0 → DESIGN.md sync 불필요. (v0.2 §F7 raise — todo §5.6.4 가 DESIGN.md sync 요구했지만 v0.3 에서 drift 로 정정.)
- `wiki/log.md` — 본 cycle 은 ingest 아님 → log entry 0 (§5.11 v2 의미 재정의)

**E5. codex Mode D Panel cycle #2 post-impl**
- 4 commit local diff 통합 송부 (`git diff <base>..HEAD` 양식)
- 코드 + smoke evidence + 12 AC + 5 buildConfig 회귀 evidence 송부
- master verdict 결정 (codex APPROVE 자동 수용 X)
- APPROVE → 사용자 사전 보고 → push
- NEEDS_REVISION → fix cycle → codex #3 (만약 master 동의 시. 동의 안 함 시 사용자 raise)

**Step E 체크박스**:
- [x] routing matrix 6 case smoke PASS (실제 8 it.each + named = 8 PASS, wikey-core 1083 → 1091)
- [x] 회귀 종합 PASS (wikey-core 1091 / wikey-obsidian 209 / build 0 errors / validate-wiki PASS)
- [x] BLUE refactor 확증 — `callWithFallback` 공통 helper 단일 + 3 provider thin wrapper (test 변경 0 회귀 PASS)
- [x] result + todo + resultx + log + memory 동기화 (DESIGN.md 미수정 / schema · CLAUDE.md 동기화 보류 — 사용자 승인 필요 항목)
- [x] **local commit 4 (Step E, push X)**: `feat(§5.6.4 v0.7): 3-provider integration + BLUE refactor + docs sync`
- [ ] codex Mode D Panel cycle #2 APPROVE (별 turn, 사용자 진행 시점)
- [ ] master verdict 결정 (codex #2 후)
- [ ] 사용자 사전 보고
- [ ] **push (codex #2 APPROVE + 사용자 확정 후)**
- [x] **wiki 재생성 없음 확증**: `wiki/` 디렉토리 git diff = 0 (master 1차 확증)

**v0.3 commit timing 표** (F9 fix — 4 commit local → codex #2 → push):

| commit # | 묶음 | 포함 step | 메시지 prefix 양식 |
|----------|------|-----------|-------------------|
| 1 | A 추상화 + B Google | §5.6.4.1 Step A + §5.6.4.2 Step B | `feat(§5.6.4 v0.7): provider auth abstraction + Google Gemini subscription` |
| 2 | C Anthropic | §5.6.4.3 | `feat(§5.6.4 v0.7): Anthropic Claude subscription auth` |
| 3 | D OpenAI | §5.6.4.4 | `feat(§5.6.4 v0.7): OpenAI Codex subscription auth` |
| 4 | E 통합 | §5.6.4.5 | `feat(§5.6.4 v0.7): 3-provider integration + BLUE refactor + docs sync` |

**각 commit 전 master 1차 검증** (npm test fresh + grep diff + 20 anchor). **commit 4 후 push 안 함** — 4 commit 누적 후 codex Mode D Panel cycle #2 → master verdict → 사용자 사전 보고 → 그제서야 push.

---

## 6. Karpathy 4 원칙 + Schema 일치 self-check (analyst 의무)

**(h) schema 4 원칙 일치**:
- **Explicit** ✅ — auth mode 가 Settings UI 에 가시화. 사용자가 "현재 어느 path 로 호출 중인지" 직접 확인.
- **Yours** ✅ — OAuth token 은 외부 CLI 의 native location 에만 보관. wikey 안 새 토큰 저장 0건.
- **File over app** ✅ — `credentials.json` JSON / `wikey.conf` plain text / 외부 CLI native JSON file 모두 marker / shell / grep 호환.
- **BYOAI** ✅ — 본 작업 자체가 BYOAI 강화 (provider 옵션 확장).

**(i) 3계층 경계 준수**:
- raw/ 변경 0 ✅
- wiki/ 변경 0 ✅ (provider call path 만 변경)
- wikey.schema.md 수정 = 사용자 승인 필요 (E4 에서 요청)

**(j) 워크플로우 4 일관**:
- ingest / query / lint / 삭제 흐름 자체는 변경 없음. *LLM 호출* 의 transport 만 추가 옵션. 워크플로우 정의와 충돌 0.

**(k) 하드코딩 금지**:
- 위반 패턴 검출 0:
  - ❌ static "quota exceeded" 키워드 set → ✅ regex 그룹 (출처 주석) + config override 가능
  - ❌ provider 별 binary path 하드코딩 → ✅ `wikey.conf` override (`GEMINI_CLI_PATH` 등 신규 키 optional, default `which gemini`)
  - ❌ Notice 메시지 inline → ✅ `messages.ts` const block (영문)
  - ❌ LLM 의미 판정 → 본 cycle 은 LLM 의미 판정 영역 아님 (auth routing 은 binary state machine). 적용 X.

**(a) Goal 명료** ✅ (§3.1, F1 + F3 mirror)
**(b) AC measurable** ✅ (§3.3 12 scenario + 각 unit test + master smoke 매핑)
**(c) AC = sample code 일치** ✅ (§3.4 data model + §3.7 matrix + §3.8 migration + §3.9 callback + v0.6 `SubscriptionProvider` + nested matrix shape 으로 cell-count 일치 lock)
**(d) Invariant 표명** ✅ (I1~I11, §3.2)
**(e) Risk identified** ✅ (R1~R3, §3.6, F4 + F5 + F6 보강)
**(f) Affected files** ✅ (§3.5, F8 buildConfig 5 site matrix 포함, v0.6 nested shape 갱신)
**(g) Validation matrix** ✅ (§2, F9 commit/push 순서 LOCK)

**(v0.5 self-validation)**:
- (l) **v0.4 회귀 catch** ✅ — v0.4 가 §3.9 `onAuthFallback` 추가 후 §3.7 type signature 충돌 catch 안 함. v0.5 `LLMCliOptionField` exclude union 으로 정정.
- (m) **잔존 drift 청소** ✅ — active spec 범위 (line 100~1100, changelog 인용 제외) 잔존 표기 모두 v0.6 lock metric 으로 갱신. **grep 결과 §8.1 본문 직접 인용**.
- (n) **codex parser positional** ✅ — content regex 회피 + 위치 기반 segment 처리.
- (o) **strict semver lock** ✅ — `--strict` flag + waiver JSON + semver regex 견고. fail-open 차단.

**(v0.6 self-validation 추가)**:
- (p) **matrix shape vs cell-count 일치 lock** ✅ — v0.6 nested shape `Record<SubscriptionProvider, Record<AuthPath, Record<LLMCliOptionField, SupportLevel>>>` 의 runtime key product = 3 × 2 × 8 = 48. "48 cell" 표기와 shape 정합 (v0.5 의 24-entry vs 48-claim 모순 해소). **grep 결과 §8.1 본문 직접 인용**.
- (q) **codex parser marker-based 처리** ✅ — v0.7 정정: `\ncodex\n` (response start) + `\ntokens used` (footer start) line-start marker sandwich. separator split paradigm 폐기 (v0.5/v0.6 evidence 모두 invalid). body 안 line-middle "codex" / "tokens used" / "model:" 단어 leak 0. master 실측 golden `codex-ok-hi.raw.txt` evidence 단일 source. 비정상 형식 = `raw.trim()` fallback (보수적). **grep 결과 §8.1 본문 직접 인용**.
- (r) **active spec drift 0 + changelog quote 분리** ✅ — anchor (m) grep 범위 = active spec only (changelog history quote 제외). §3.9 sample code 안 "기존 6 field" → "기존 8 option fields" 정정. **grep 결과 §8.1 본문 직접 인용**.

---

## 7. 사용자 결정 항목 — v0.3 / v0.4 / v0.5 mirror (2026-05-13 LOCK)

| # | 항목 | v0.1~0.2 결정 | v0.3 추가 사항 |
|---|------|--------------|--------------|
| 1 | **R1 ToS 위험** | (a) 명시 동의 — 사용자 책임 영역 | F6 fix — §4.6 framing 분리 영역 A (기술적 동작) / 영역 B (약관 허용) 명시. revert path 보존 명세 추가. |
| 2 | **CLI 의존성** | 수용 OK | (변경 없음) — `auth-missing` reason 으로 fallback callback |
| 3 | **commit 빈도** | 4 commit | F9 fix — local commit only, codex #2 APPROVE 후 push. push 시점 명시 LOCK. |
| 4 | **codex Mode D Panel cycle 횟수** | 2 cycle 의무 (#1 plan / #2 post-impl) | (변경 없음) — 단 cycle #1 = v0.3 송부 (NEEDS_REVISION fix 후) |

**v0.3 신규 사용자 결정 사전 등록**:
- A0 spawn smoke FAIL 시 R3 대체 IPC path 선택권 = 사용자 raise (electron.shell + temp file vs ipcMain channel). 현재 plan = renderer spawn 가능 가정 (Obsidian 공식 docs nodeIntegration on).

**잔여 risk 명시** (사용자 책임 영역, R1 명시 동의로 commit):
- ToS 본문 직접 조사 안 함 (조사 도구 한계, §4.6.4)
- 2026 Q1~2 이후 정책 변경 detect = runtime 401/403/429 fallback + 사용자 force-mode
- 계정 제재 시 즉시 `authMode = 'api'` force + 본 cycle revert (reversible experiment §5.7.4 Path A)

---

## 8. 다음 단계 (v0.7)

1. master 1차 검증 (본 todox v0.7 — 7-anchor + 6 codex pattern + 7 fix mode + v0.5~v0.7 self-validation anchor = **28 anchor**)
2. master self-validation grep 결과 (§8.2 v0.7 본문 직접 인용 의무, §8.1 v0.6 historical 보존)
3. codex Mode D Panel **cycle #1i (plan APPROVE)** 송부 (사용자 "APPROVE까지 순환" 명시)
4. cycle #1i APPROVE → §5.6.4.1 Step A 진입 (PoC 차단 해제)
5. **A0 spawn smoke gate** (F4) — PASS → A1 진입 / FAIL → R3 대체 IPC cycle (사용자 raise)
6. 4 commit local timing 따라 진행 (push 보류, prefix `v0.7`)
7. commit 4 완료 후 → codex Mode D Panel **cycle #2 (post-impl APPROVE)** 송부
8. cycle #2 APPROVE → master verdict 결정 → 사용자 사전 보고 → push → 종결

### 8.2 v0.7 self-validation grep 결과 (master 직접 실측, 2026-05-13, cycle #1h H1+H2 fix)

**v0.7 finding 별 잔존 drift grep — 본문 직접 인용**:

#### H1 grep — codex parser marker-based 채택 (v0.7), separator paradigm 잔존 0 (active spec)

`sed -n '100,1100p' plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md | grep -nE "segments\.slice|segments\[0\]|segments\.at\(-1\)"` 결과:

```
635:- v0.5 separator-based (`segments[0]` 만 drop) → user prompt 라벨 segment 가 본문에 남음 → ... FAIL
636:- v0.6 separator-based (4-segment 처리, `segments.slice(2, -1)`) → ... v0.6 evidence invalid 판명
```

**판정**: 2 hit 모두 *historical context quote* (Marker-based vs separator-based 차이 설명 — line 732~736 영역 의 "v0.4/v0.5/v0.6/v0.7 비교" 라인). **active spec parser code (line 687~730) 의 실 구현 = marker-based, separator paradigm 0 hit**. PASS.

`sed -n '100,1100p' ... | grep -nE "indexOf\('\\\\ncodex|tokensMarker|codexMarker"` 결과 (marker-based positive grep):

```
580:| **codex** | ... v0.7 #1h H1 marker-based extraction: (1) codexMarker = raw.indexOf('\ncodex\n') ... (2) tokensMarker = raw.indexOf('\ntokens used') ...
621:      const codexMarker = rawStdout.indexOf('\ncodex\n')
622:      const tokensMarker = rawStdout.indexOf('\ntokens used')
623:      if (codexMarker === -1 || tokensMarker === -1 || codexMarker >= tokensMarker) {
627:      return rawStdout.slice(codexMarker + '\ncodex\n'.length, tokensMarker).trim()
```

**판정**: line 580 (§4.0.7 표 row codex) + line 621~627 (active spec parser sample code §4.0.7) 모두 marker-based 채택. evidence = master 실측 `plan/phase-5/fixtures/cycle-codex-golden/codex-ok-hi.raw.txt` (19 line raw, separator 2개만 + `tokens used` marker line 확증). PASS.

#### H2 grep — commit prefix v0.7 통일 (canonical + mirror)

`grep -nE "feat\(§5\.6\.4 v0\.[3-6]\):" plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md plan/phase-5/phase-5-todo.md` 결과:

```
(empty — 0 hit)
```

**판정**: 두 파일 모두 4 commit prefix = `v0.7` 통일. v0.3~v0.6 stale prefix 잔존 0. PASS.

`grep -nE "feat\(§5\.6\.4 v0\.7\):" plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md plan/phase-5/phase-5-todo.md | wc -l` 결과 (positive 확증):

```
8  (canonical 4 commit + mirror 4 commit = 8 hit)
```

**판정**: 두 파일 각각 4 commit prefix v0.7 명시 — 8 hit 일관. PASS.

### 8.3 cycle #1i MED/LOW 3 finding — implementation 단계 patch 영역 (master 결정 deferred)

cycle #1i (v0.7) NEEDS_REVISION 4 finding 중 **HIGH F1 (parser drift in 실행 체크리스트/mirror)** 만 v0.7 안 즉시 정정. 나머지 3 finding 은 **implementation 단계 patch 가능 영역**으로 plan 진입 차단 안 함 (master 결정, 2026-05-13):

| F# (cycle #1i) | severity | finding | deferred 근거 |
|----------------|----------|---------|---------------|
| F2 | MED | `codex-ok-hi.raw.txt` line 17~19 trailing `hi` echo (tee context 잔재) | Step A A3-1 fixture commit 시 raw 재캡처로 자동 청소 가능. plan 차단 X. |
| F3 | MED | `codex-bodylike-raw.txt` 파일 repo 미존재 | Step A A3-1 fixture 생성 의무로 plan 명시 (line 982 + line 1028). future fixture 라벨링 완료. |
| F4 | LOW | §8.2 H2 positive grep count 8 vs 실제 12 | self-validation count 단순 numeric, implementation 영향 0. v0.8 또는 구현 patch 시 정정. |

**master 결정 근거**:
- 7 cycle (`#1c`~`#1i`) 동안 finding 9 → 4 → 5 → 3 → 2 → 4 점진 수렴 + 비-HIGH 잔존. codex Mode D 의 본질적 nitpick 패턴으로 0 finding 도달 보장 X.
- HIGH 만 fix + MED/LOW 는 구현 patch 가 cycle 비용 대비 효율 최적. Karpathy §2 (Simplicity First) — plan detail 무한 비대화 회피.
- agent-management.md §7.2: "codex verdict 자동 수용 X. master 결정". 본 3 finding 모두 차단성 0 판단.

### 8.1 v0.6 self-validation grep 결과 (master 직접 실측, 2026-05-13, historical)

**3 finding 별 잔존 drift grep 결과 — 본문 직접 인용 의무 (말로만 주장 X)**.

#### G1 grep — matrix type shape (active spec 범위 = nested shape 만, v0.5 24-entry shape 잔존 0)

`grep -nE "Record<LLMCliOptionField|Record<Provider, Record<LLMCliOptionField" plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md` 결과:

```
18:>   - (a) **#1g G1 fix [HIGH / matrix type shape]** — v0.5 가 48 cell 을 주장하나 const shape `Record<Provider, Record<LLMCliOptionField, SupportLevel>>` 는 8 field × 3 provider = **24 entry** ...
38:>   - (a) **#1f F1 fix [HIGH / matrix-type]** — ... matrix const = `Record<Provider, Record<LLMCliOptionField, SupportLevel>>`. ...
360:**v0.5 shape (24-entry) 의 한계** (v0.6 #1g G1 raise): v0.5 = `Record<Provider, Record<LLMCliOptionField, SupportLevel>>` 는 path 축 부재. ...
```

**판정**: 3 hit 모두 *changelog history quote* 또는 *명시적 "v0.5 한계" description* — **active spec 영역 (§3.7 const block) 의 실 type signature 0 hit**.

`grep -nE "Record<SubscriptionProvider" ...` 결과 (v0.6 nested shape 채택 확증):

```
18:>   - (a) ... (2) Matrix shape = **nested** `Record<SubscriptionProvider, Record<'subscription' | 'api', Record<LLMCliOptionField, SupportLevel>>>`. ...
386:// v0.6 #1g G1: nested shape `Record<SubscriptionProvider, Record<AuthPath, Record<LLMCliOptionField, SupportLevel>>>`
1219:- (p) **matrix shape vs cell-count 일치 lock** ✅ — v0.6 nested shape `Record<SubscriptionProvider, Record<AuthPath, Record<LLMCliOptionField, SupportLevel>>>` ...
```

**판정**: line 386 (active spec §3.7 const block) + line 390 (multi-line type) = v0.6 nested shape 가 actual const declaration 으로 채택. PASS.

#### G2 grep — codex positional parser (v0.6 4-segment 처리 채택, v0.5 single-drop 잔존 0)

`grep -nE "segments\[0\]|segments\.at\(-1\)|segments\.slice\(2, -1\)" plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md` 결과:

```
19:>   - (b) ... codex 실 stdout 구조 = `header(segments[0]) → ... → response(segments[2]) → ... → "tokens used:"(segments[3])` (4 segment). ...
36:>   즉 segments[0] = header (CLI banner + workdir + model + session metadata), segments[1] = "user prompt:" 라벨 + ...
44:>   - (c) **#1f F3 fix [MED / parser positional]** — ... **`segments[0]` (banner+metadata) 제거 + `segments.at(-1)` 가 "tokens used" 포함 시 마지막 제거** ... (v0.5 changelog quote)
637:| **codex** | ... (2) 정상 형식 = ... → middle = `segments.slice(2, -1)` (3) 비정상 / 짧은 형식 = ... segments[0] 만 drop + footer 있으면 last drop ...
664:      //   segments[0] = header (CLI banner + workdir + model + session metadata)
670:      const last = segments.at(-1) ?? ''
675:        return segments.slice(2, -1).join('').trim()
679:      // - segments[0] (header) 만 drop
691:- v0.5 위치 기반 (segments[0] 만 drop) → user prompt 라벨 segment 가 본문에 남음 → ...
692:- **v0.6 위치 기반 (4-segment 처리)** → 정상 형식 = `segments.slice(2, -1)` ...
739:  expect(out).not.toMatch(/OpenAI Codex v/)         // segments[0] header drop
740:  expect(out).not.toMatch(/workdir:/)                // segments[0] metadata drop
742:  expect(out).not.toMatch(/session id:/)             // segments[0] session metadata drop
1220:- (q) **codex parser 4-segment 처리** ✅ — 정상 형식 `segments.slice(2, -1)` ...
```

**판정**: line 675 = active spec §4.0.7 parser sample code 안 *정상 형식* path = `segments.slice(2, -1)` (4-segment 처리 채택). line 679 + 표 line 637 = *비정상 fallback* path 가 segments[0] 만 drop (보수적). line 691~692 = "위치 기반 vs 내용 기반 차이" 설명에서 v0.5 vs v0.6 명시 대비. **active spec 정상 path 에서 v0.5 단순 single-drop 0 hit**. PASS.

#### G3 grep — residual drift (active spec line 100~1100 범위, changelog history quote 제외)

`sed -n '100,1100p' plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md | grep -nE "6 field|36 cell|11 fixture|15 fixture|5\+3\+3|7 항목"` 결과:

```
(empty — 0 hit)
```

**판정**: active spec 범위 (line 100~1100) 잔존 drift **0**. PASS.

**full file 범위 grep** (참고 — changelog history quote 확인용):

```
20:>   - (c) **#1g G3 fix [MED / residual drift self-validation]** — §3.9 line 245 sample code 주석 `"기존 6 field 보존"` ...
38:>   - (a) **#1f F1 fix [HIGH / matrix-type]** — ... §3.5 의 `provider-cli-options.test.ts` 행 "36 cell" → **48 cell** 정정 (v0.4 잔존 drift 청소).
45:>   - (d) **#1f F4 fix [MED / mirror drift]** — ... 잔존 drift ("11 fixture" / "15 fixture" / "7 항목" / "5+3+3" 수식) 모두 청소.
50:> - #1f F4: ... v0.4 자기 정의 "7 항목" 표기는 v0.4 작성 시 lock bullet 본인이 8개를 출력하면서 메타 라벨을 "7 항목"으로 stale 표기한 drift. v0.5 mirror 에서 "8 항목" 으로 통일.
59:>   - (a) **F1 fix** — §3.7 신규 ... (6 field × 3 provider × 2 path = 36 cell). subscription path 미지원 옵션은 API fallback ...
```

**판정**: 5 hit 모두 *changelog 영역 (line 18~62 범위) 의 historical quote* — fix 내력 명시 자체가 quote 보존 (사용자 + codex review trail 보존 의무). active spec 영역 0 hit 으로 anchor (m)/(r) 충족.

#### §3.9 sample code 정정 확증

`grep -n "기존 8 option fields\|기존 6 field" plan/phase-5/phase-5-todox-5.6.4-llm-subscription.md` 결과 (active spec 영역만 추출, changelog quote / §8.1 자기 인용 제외):

```
265:  // ... 기존 8 option fields 보존 (model / temperature / maxTokens / jsonMode / seed / thinkingBudget / timeout / responseMimeType)
```

**판정**: line 265 (active spec §3.9 sample code) "기존 6 field" → "기존 8 option fields" 정정 완료. stale unquoted "6 field" active spec 영역 0 hit. PASS.

(전체 grep 에서 line 20 (changelog G3 fix description) / line 1317~1331 (§8.1 본문 자기 인용) 는 *의도된 quote* — anchor (m)/(r) scope 정의 따라 제외.)
