# Phase 5 §5.22 — 시스템 UI 영문화 sweep (Activity)

> **상위 문서**: [`docs/sessions/phase-5/phase-5-result.md §5.22`](./phase-5-result.md) · [`docs/planning/phase-5/phase-5-spec-5.22-ui-english-sweep.md`](../../planning/phase-5/phase-5-spec-5.22-ui-english-sweep.md)
>
> **날짜**: 2026-05-12 session 39

## 종합

사용자 명시 결정: §5.22 = "계획 필요 없음" 직접 처리. SDD+TDD Step A LOCK 단계 스킵 + 단순 string sweep + 영문 매핑 직접 결정 + test fixture 동시 sweep.

후속: 사용자 추가 명시 — "시스템 언어는 '영문'을 기준 문서에 명시" → `wikey.schema.md §핵심 원칙 #6` + `CLAUDE.md §시스템 언어 = 영문` 신규 LOCK 등재.

## 변경 file (8)

| File | 변경 line 수 | 주요 string |
|------|-------------|------------|
| `wikey-obsidian/src/sidebar-chat.ts` | ~11 | `취소됨` → `Cancelled` / `참고`·`확장` → `Referenced`·`Extended` / warning banner / dashboard tooltip / sidecar broken banner / unsupported tooltip / Notice ("위키에 없는 페이지", "미지원 파일") |
| `wikey-obsidian/src/commands.ts` | ~12 | Notice (인제스트 완료/실패 / qmd 인덱스 / 설정 초기화 / ABI 불일치 / 인덱싱 실패 / 검색 인덱스 최신 / hash-match 분기 / 인제스트 취소 / PII 감지 / 파일명 normalize) + Citation Modal text |
| `wikey-obsidian/src/main.ts` | ~7 | Notice (Kiwi 사전 / inbox 새 파일 / inbox 우회 감지 ×2 / Auto-ingest 시작·완료) + console.log (환경 탐지 시작·완료 / inbox 우회 감지) |
| `wikey-obsidian/src/ingest-modals.ts` | 1 | Schema type info text |
| `wikey-obsidian/src/settings-tab.ts` | ~5 | RRF k value 설명 + Backlink scope dropdown label / desc (`참고`·`확장` → `Referenced`·`Extended`) |
| `wikey-obsidian/src/status-bar.ts` | ~7 | Stats Modal title + table label (`엔티티`·`개념`·`소스`·`분석`·`메타`·`총 위키 페이지`) |
| `wikey-obsidian/src/reset-modals.ts` | ~14 | Delete/Reset Modal text (영향 페이지 / 확인 문자열 / 삭제 완료 / 리셋 완료 / 5-way scope label) |
| `wikey-obsidian/src/env-detect.ts` | ~6 | issues.push (node/python3/qmd/Kiwi 부재) + console.log (qmd 호환 node / ABI 불일치) |
| `wikey-obsidian/src/__tests__/sidebar-chat-helpers.test.ts` | 1 | `취소됨` expected → `Cancelled` |
| `wikey-obsidian/src/__tests__/sidebar-chat-backlink.test.ts` | ~6 | `참고`·`확장`·`총 N 개` expected → `Referenced`·`Extended`·`N total` |

## 기준 문서 변경

| File | 변경 |
|------|------|
| `wikey.schema.md` | §핵심 원칙 #6 신규 — "시스템 언어 = 영문" LOCK + 예외 (코드 주석 / docs / parse regex / wiki content) |
| `CLAUDE.md` | §시스템 언어 = 영문 (2026-05-12 LOCK) 신규 — schema 단일 진실 소스 reference + 예외 + 위반 시정 절차 |

## 검증

| Step | 결과 |
|------|------|
| Test (wikey-core + wikey-obsidian workspaces) | **1065 PASS** (66 + 20 test files, 3 skipped) |
| Build (wikey-obsidian) | **0 errors** (warnings 만 — kiwi-wasm import.meta, 기존 baseline) |
| validate-wiki | 458 errors (§5.21 대상 broken wikilink baseline, §5.22 변경 무관) |
| `grep '[가-힣]' wikey-obsidian/src/**/*.ts` (test 제외, comment·regex 제외) | UI string 0 — comment 만 잔존 (out of scope) |

## SDD+TDD 단계

사용자 명시 "계획 필요 없음" → Step A (LOCK) 스킵.

- ❌ Step A — 사용자 LOCK 사전 결정 (사용자가 직접 sweep 진행 요청)
- ✅ Step B — test fixture sweep (sidebar-chat-helpers + sidebar-chat-backlink 7 expected 갱신)
- ✅ Step C — developer (8 file sweep, sed pattern 대신 file 별 Edit, 영문 매핑 직접 결정)
- ✅ Step D — Phase 3a 회귀 (npm test 1065 PASS / npm run build 0 errors)
- ⏭ Step E — Phase 3b BLUE refactor (단순 string 변경, BLUE 6 활동 무관 — 함수 분해 / DRY / naming 변경 0, 의도적 생략)
- ⏭ Step F — codex post-impl review (사용자 "계획 필요없음" 결정, master 1차 검증으로 충분)
- ✅ Step G — master grep `[가-힣]` 확증 (test fixture·comment·regex 제외 UI string 0)

## 잔존 한국어 (out of scope, 의도적 유지)

- **inline code comment / JSDoc**: 8 file 합산 ~150+ line, dev only, 영구 한글 OK
- **maintenance-modal-views.ts / maintenance-runner.ts regex**: `깨진 위키링크` parse pattern, validate-wiki.sh production output format 매칭 — 변경 시 wiki-check report 동작 깨짐
- **`__tests__/` test description**: dev only, fixture sweep 외 영문화 미 필요

## 다음 액션

- §5.21 Ingest mention guard 진입 (분석 결과 broken wikilink 458 의 근본 원인 — raw filename guard + canonicalizer 호출 강제 fix)
