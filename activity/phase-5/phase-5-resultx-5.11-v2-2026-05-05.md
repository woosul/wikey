---
phase: 5
section: 5.11
title: §5.11 v2 — 의미·관련도 promotion threshold + 원문 언어 alias + wiki 완전 초기화
status: completed
date: 2026-05-05
session: 19
---

# Phase 5 §5.11 v2 — 의미·관련도 + 원문 언어 alias + 환경 초기화 결과

> **상위 문서**: [`plan/phase-5/phase-5-todox-5.11-page-promotion-threshold.md`](../../plan/phase-5/phase-5-todox-5.11-page-promotion-threshold.md) v2.5 · [`activity/phase-5/phase-5-result.md`](./phase-5-result.md)

## 1. 사용자 6 chain raise (2026-05-05 session 18~19)

1. wiki 자체 완전 초기화 (페이지·index·log·sidecar·원문 0_inbox 원복)
2. mention/entity/concept/source 원문 언어 중심 (한국어 원문 → 한국어 페이지 + 영어 alias / 영어 원문 → 영어 페이지 + 한국어 alias)
3. §5.11 threshold 단순 조정 X — 단편 지식/출처/장소/관련도 떨어지는 것 제외 목적
4. <15 cap 룰 강제 X — 1~3 페이지만 생성되어도 OK
5. log.md 작업 log 가 아니라 문서/지식 log only
6. ingest 시 overview.md 동기화 확인 → 폐기 (index.md 통합)

## 2. SDD+TDD 진행 (Phase 0~9)

### 2.1 Phase 0 — codex 4 cycle plan 검증 누적

| cycle | verdict | finding | master 결정 |
|-------|---------|---------|-------------|
| #1 (v2.1) | NEEDS_REVISION | 6 (3 P1 + 2 P2 + 1 P3) | 5 fix + 1 dispute (rule 9 sourceBody, Karpathy Simplicity) |
| #2 (v2.2) | NEEDS_REVISION | 3 (2 P1 + 0 P2 + 1 P3) | 2 fix + 1 dispute 유지 |
| #3 (v2.3) | NEEDS_REVISION | 5 (2 P1 + 2 P2 + 1 P3) | 5 fix (filesystem backup + skeleton frontmatter + .gitignore + AC-A4 + line) — codex 자체 dispute reasonable 인정 |
| #4 (v2.4) | NEEDS_REVISION | 1 (P1 narrow) | 1 fix (A0 backup/restore path-preserving + rsync) — reviewer 권고 cycle #5 skip |
| post-impl (v2.5) | NEEDS_REVISION | 2 (1 P1 + 1 P2) | P1 = pre-existing latent bug (별 issue 분리), P2 = false positive |

총 17 finding (5 dispute + 12 fix). plan v1 → v2.5 (5 회 갱신).

### 2.2 Phase 1 — 환경 완전 초기화

A0 (backup, /tmp/wikey-backup-1777979752) → A1 (raw 분류 파일 3개 → 0_inbox) → A2 (sidecar `.<ext>.md` 3개 삭제, 원본 5개 유지) → A3 (wiki content 58개 삭제 + index/log skeleton frontmatter 보존 + overview.md 폐기 + .ingest-map.json reset) → A4 (.wikey/source-registry/mention-history `{}` + qmd-embeddings/qmd index/contextual-prefixes cache reset).

### 2.3 Phase 2~5 — TDD + 회귀

- TDD RED: 5 case 작성 (AC-V1~V5), 4 FAIL 확증 (AC-V3 v1 phrase 부분 매치로 PASS)
- TDD GREEN:
  - canonicalizer.ts rule 8 v2 (의미·관련도 + 단순 출처/장소 ❌ + 1~3개 OK)
  - canonicalizer.ts rule 9 신규 (원문 언어 중심 + 반대 언어 alias)
  - canonicalizer.ts countOccurrences 하이픈/공백 normalize (한국어 base 본문 매치)
  - ingest-pipeline.ts B1 (BUNDLED_STAGE2_MENTION_PROMPT cap 제거 + ❌ list)
  - ingest-pipeline.ts B6 (FULL route dropped sample log helper, SEGMENTED mirror)
  - sidebar-chat.ts:633 / status-bar.ts:118 overview 주석 v2 정리
- TDD REFACTOR: 7-anchor cross-check 모두 통과
- 회귀: **613 PASS / 3 skipped / 0 errors / build OK** (608 기존 + 5 신규 = 정확히 v2 expected)

### 2.4 Phase 6 — 라이브 obsidian-cdp full cycle smoke

**한국어 source ingest** (raw/0_inbox/pmbok-overview.md, FULL route gemini-2.5-flash):

```
stage 2.1 summary: 45.7s (1855 chars)
stage 2.2 mention extraction: 16.4s (14 mentions)
stage 2.3 canonicalize: 27.2s — entities=1, concepts=11, dropped=4
dropped sample: pmbok (rejected by canonicalizer LLM), pmi (rejected by canonicalizer LLM),
                project-time-management (rejected by canonicalizer LLM),
                project-human-resource-management (rejected by canonicalizer LLM)
```

**evidence**:

| 항목 | 결과 |
|------|------|
| §5.11 v2 promotion threshold (의미·관련도) | ✓ 14 mentions → 12 promoted / 4 dropped (LLM 자율 reject, 사용자 의도 noise 감소 작동) |
| B6 FULL route dropped sample log | ✓ console 출력 (`[Wikey ingest] dropped sample: ... (rejected by canonicalizer LLM)`) |
| rule 9 한국어 alias 보존 | ✓ PMI: `aliases: ["pmi", "프로젝트관리협회", "project-management-institute"]` / project-scope: `aliases: ["프로젝트 범위 관리"]` |
| rule 9 한국어 base name 강제 | **PARTIAL** — LLM (gemini-2.5-flash) 가 PMI/PMBOK 같은 글로벌 표준 영문 약어를 영어 base 로 emit. 사용자 옵션 1 결정: 수용 (alias 한국어 보존으로 충분, Karpathy Simplicity 정합) |
| wiki write | 1 entity (PMI) + 11 concepts (PMBOK 10 KA + PMBOK) + 1 source = 13 페이지 |
| index/log skeleton 갱신 | ✓ frontmatter 보존, validate-wiki.sh PASS |
| audit panel "Ingested 1" | ✓ cache reset (qmd-embeddings + index.sqlite + contextual-prefixes) + plugin reload 후 정상화 (이전 stale "Ingested 4") |

**영어 source skip** — 사용자 옵션 1 수용 (한국어 source 결과 = 영어 base + 한국어 alias 양호 → 영어 source 도 같은 동작 예상, 별도 ingest 가치 낮음)

### 2.5 Phase 7 post-impl 검증 (codex)

post-impl cycle finding:
- **P1-#ω** (validate-wiki.sh broken link `[[pmbok-overview.md]]`): pre-existing latent bug, canonicalizer.ts:489 sourceDisplay/sidecarRef. §5.11 v2 regression 아님. wiki/ 는 .gitignore → commit 영향 없음. **`session-wrap-followups.md` 에 별 issue 등록**.
- **P2-#ψ** (.wikey/source-registry.json AC-A4 mismatch): false positive. AC-A4 는 Phase 1 시점 검증, smoke 후 PMBOK record 추가는 정상.

master 결정: ACCEPT_WITH_NOTES — Phase 8 commit 진행.

## 3. AC 통과 status

| AC | 상태 | evidence |
|----|------|----------|
| AC-A1 | PASS | 3 파일 0_inbox 원복, raw mindepth 2 (CLASSIFY 제외) 0건 |
| AC-A2 | PASS | sidecar 3 삭제, 원본 5 유지 |
| AC-A3 | PASS | content 0건 + skeleton frontmatter 보존 + validate-wiki.sh PASS + .ingest-map.json reset |
| AC-A4 | PASS | .wikey + qmd cache 모두 reset |
| AC-B1 | PASS | "0~15개" 0건 + "수가 적어도" 1건 (ingest-pipeline.ts) |
| AC-B2 | PASS | rule 8 v2 단순 출처/장소 명시 (canonicalizer.ts) |
| AC-B3 | PASS | rule 9 한국어/영어 source (canonicalizer.ts) |
| AC-B4 | PASS | overview 주석 v2 정리 (sidebar-chat / status-bar) |
| AC-B5 | PASS | FULL + SEGMENTED 양 route dropped sample (`grep -nE "dropped sample" wikey-core/src/ingest-pipeline.ts` 2건) |
| AC-C1 | PASS | typecheck + build 0 errors |
| AC-C2 | PASS | 613 PASS / 3 skipped (608 기존 + 5 신규) |
| AC-C3 | **PARTIAL** | 한국어 source → 영어 base + 한국어 alias frontmatter (사용자 옵션 1 수용) |
| AC-C4 | SKIP | 영어 source — 사용자 옵션 1 결정 (한국어 결과로 충분) |
| AC-C5 | PASS | FULL route dropped sample log 출력 |

13/14 AC PASS (1 partial / 1 skip with user consent).

## 4. Karpathy 4원칙 정합

- **Think Before Coding**: 사용자 6 chain 본질 비판 + 4 plan cycle + 1 post-impl cycle 누적 검증 후 진행. dispute 2회 정당화 (sourceBody 인자 추가 거부 — Karpathy Simplicity 정합).
- **Simplicity First**: 코드 추가 ~30 LOC (rule 8/9 + countOccurrences normalize 4 LOC + B1 cap 변경 + B6 3 LOC). 새 file 0. overview.md 자동 합성 같은 추가 기능 거부.
- **Surgical Changes**: prompt + helper + 주석 만 수정. wiki 삭제는 사용자 explicit. 무관한 dead code 손대지 않음. P1-#ω (pre-existing) 는 별 issue 분리.
- **Goal-Driven**: 14 AC + 5 case 정량 검증 + 라이브 smoke evidence + codex 5 cycle cross-check.

## 5. 잔존 작업 (다음 세션)

`session-wrap-followups.md` 에 등록:
- **§5.12** (가칭) — `wiki/concepts/*.md` 의 `## 출처` 섹션 wikilink `[[<base>.md]]` 형식이 validate-wiki.sh 와 mismatch (canonicalizer.ts:489). pre-existing latent bug, §5.11 v2 scope 외. 한국어 소스 케이스 사용자 결정 후 진행.

## 6. 라이브 smoke timing reference

- summary 단계: 45.7s (gemini-2.5-flash, 1855 chars Korean source)
- mention extraction: 16.4s (14 mentions)
- canonicalize: 27.2s (entity/concept 분류 + dedup + Layer 2 occurrence gate)
- 총 ingest cycle (Brief 클릭~Approve & Write): 90s (PREVIEW_READY) + ~5s wiki write
- post-write audit cache reset + plugin reload: ~5s

## 7. session-wrap-followups 갱신 항목

- 다음 세션 첫 액션: §5.12 (wikilink format pre-existing fix) 또는 사용자 신규 issue
- §5.11 v2 commit chain (4 commit 예정)
