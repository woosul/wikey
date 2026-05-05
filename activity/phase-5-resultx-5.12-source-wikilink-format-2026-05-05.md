---
phase: 5
section: 5.12
title: §5.12 — Source Wikilink Format (`## 출처` 섹션 wiki/sources/source-<base>.md 매칭)
status: completed
date: 2026-05-05
session: 19
---

# Phase 5 §5.12 — Source Wikilink Format 결과

> **상위 문서**: [`plan/phase-5-todox-5.12-source-wikilink-format.md`](../plan/phase-5-todox-5.12-source-wikilink-format.md) v3 · [`activity/phase-5-result.md`](./phase-5-result.md)

## 1. 본질

§5.11 v2.5 post-impl codex P1-#ω 가 분리 등록한 pre-existing latent bug 해결. `wiki/concepts/*.md` 와 `wiki/entities/*.md` 의 `## 출처` 섹션 wikilink 가 `[[pmbok-overview.md|pmbok-overview]]` 형식 → `validate-wiki.sh` resolver (`find wiki -name "${link}.md"` + `find raw -name "${link}.*"`) 와 mismatch → **12 broken links** 상시 발생. wiki/ 가 `.gitignore` 라 발견 안 됐음.

§5.3 follow-up #11 의 raw sidecar `<base>.<ext>.md` 매칭 의도 자체가 validator 와 mismatch — 폐기. `wiki/sources/source-<base>.md` 가 source page 의 단일 진실 소스이므로 wikilink 도 거기를 가리키도록 정합.

## 2. SDD+TDD 진행 (Phase 0~6)

### 2.1 Phase 0 — codex 2 cycle plan 검증

| cycle | verdict | finding | master 결정 |
|-------|---------|---------|-------------|
| #1 (v1) | NEEDS_REVISION | 3 (2 P1 + 1 P3) | 3 fix → v2 (기존 §5.3 4 case replace + canonicalize 시그니처에 sourcePageBase 인자) |
| #2 (v2) | NEEDS_REVISION | 4 (0 P1 + 2 P2 + 2 P3) | 4 fix → v3, P1 0건 narrow → master 직접 fix + cycle #3 skip |
| #3 (post-impl) | **APPROVE** | 0 잔존 | master 동의 → commit + push |

총 7 finding (모두 fix). plan v1 → v3 (2 회 갱신).

### 2.2 Phase 1~3 — TDD RED → GREEN → REFACTOR

**RED** (canonicalizer.test.ts):
- baseArgs 에 `sourcePageBase: 'source-PMS_test'` default 추가 (P3-#4 fix)
- 기존 §5.3 follow-up #11 4 case (`[[*.pdf.md|...]]` / `[[note.md|note]]` / `[[doc.hwp.md|doc]]` / `[[plain.txt|plain]]`) 를 §5.12 기대값 (`[[source-<base>|<base>]]`) 으로 replace + sourcePageBase 인자 명시
- 신규 2 case 추가: AC-5a (sourcePageBase 정상), AC-5b (LLM emit drift 방어 — prefix 없는 case)
- **6 FAIL 확증** (4 replace + 2 신규)

**GREEN**:
- `canonicalizer.ts` 시그니처 chain 5 함수 (canonicalize / assembleCanonicalResult / validateAndBuildPage / applyCrossLinks / buildPageContent) 모두 `sourcePageBase: string` 인자 추가
- `buildPageContent` 의 `lowerSrc / sidecarRef` 분기 제거 → 단일 사용 `[[${sourcePageBase}|${sourceDisplay}]]`
- §5.3 follow-up #11 주석 → §5.12 갱신 (raw sidecar 매칭 폐기 + invariant 명시)
- `ingest-pipeline.ts` FULL route (line 540) + SEGMENTED route (line 612) 양쪽: `const sourcePageBase = normalizeBase(summaryParsed.source_page.filename)` derive + canonicalize 호출 시 인자

**REFACTOR**:
- `npm test` (wikey-core): **615 PASS / 3 skipped** (608 기존 + 5 §5.11 v2 + 2 §5.12 = plan v3 expected 정확 일치)
- `npm run build` (wikey-core): **0 errors**
- `npm run build` (wikey-obsidian): 1 pre-existing warning (esbuild import.meta CJS, scope 외)

### 2.3 Phase 4 — 라이브 검증

**옵션 1 채택 (sed 일괄 fix)** — 코드 검증은 unit test 가 담당, 라이브는 validator PASS 만 필요:

```bash
find wiki/concepts wiki/entities -name '*.md' -print0 \
  | xargs -0 sed -i '' 's/\[\[pmbok-overview\.md|/[[source-pmbok-overview|/g'
```

**evidence**:
- 변경 전: 12 broken links (`[[pmbok-overview.md|pmbok-overview]]`)
- 변경 후: 0 broken / 14 new format (12 `## 출처` wikilink + log.md 1 + index.md 1)
- `./scripts/validate-wiki.sh` → **PASS: 모든 검증 통과**

### 2.4 Phase 5 — codex post-impl

post-impl verdict: **APPROVE** (잔존 finding 0).

Verified by codex:
- canonicalizer.ts 5 함수 sourcePageBase chain 일관 (extractCanonicalLLM / lowerSrc / sidecarRef 모두 부재)
- ingest-pipeline.ts FULL + SEGMENTED 양 derive 정확
- canonicalizer.test.ts baseArgs default + ~10개 호출 자동 사용 + source-link case 만 명시 override
- 라이브 wiki 12 페이지 신 형식 적용 + 구 형식 0건
- fresh `validate-wiki.sh PASS` + `npm test 615 PASS / 3 skipped` + `npm run build 0 errors` + `git diff --check clean`

## 3. AC 통과 status

| AC | 상태 | evidence |
|----|------|----------|
| AC-1 | PASS | sidecarRef 분기 제거 + sourcePageBase 단일 사용 |
| AC-2 | PASS | ingest-pipeline FULL line 540 + SEGMENTED line 612 양 derive |
| AC-3 | PASS | canonicalizer.ts:482-490 주석 §5.3 → §5.12 갱신 |
| AC-4 | PASS | §5.3 4 case replace + baseArgs default sourcePageBase |
| AC-5 | PASS | §5.12 신규 2 case (AC-5a + AC-5b drift 방어) GREEN |
| AC-6 | PASS | 615 PASS / 3 skipped (정확) |
| AC-7 | PASS | build 0 errors |
| AC-8 | PASS | sed 14 wikilink 변환 |
| AC-9 | PASS | validate-wiki.sh exit 0 |

9/9 AC PASS.

## 4. Karpathy 4원칙 정합

- **Think Before Coding**: post-impl P1-#ω 본질 분석 → §5.3 follow-up #11 자체가 validator 와 mismatch 였음 확증. codex cycle #1 P1-#2 의 LLM emit drift 위험 인정 → derive 가 raw 가 아닌 진실 소스 (parsed.source_page.filename) 의존하도록 dependency flow 자연화.
- **Simplicity First**: ~25 LOC 변경 (시그니처 chain 5 함수 + ingest-pipeline 6 + 주석 5). 새 file 0. 분기 제거 (.md/.txt vs 비-`.md`). sourceBody (§5.11 v2 dispute) 와 차원 다름 — sourcePageBase 는 string 1개 + LLM context bloat 무관.
- **Surgical Changes**: canonicalizer.ts (5 함수) + ingest-pipeline.ts (양 route) + test (4 replace + 2 신규 + baseArgs default). wiki sed 1회. 무관한 코드/주석 손대지 않음. P1-#ω 별 issue 분리 → §5.12 narrow scope 유지.
- **Goal-Driven**: 9 AC 정량 + validate-wiki.sh PASS + LLM emit drift 양 시나리오 (prefix O / prefix X) test cover + codex post-impl APPROVE.

## 5. 잔존 작업 (다음 세션)

- raw sidecar 매칭 의도 자체 부활 (concept/entity 에서 raw 로 직접 jump): 사용자 요구 시 별 issue. wiki/sources/ 페이지 frontmatter 의 vault_path / sidecar_vault_path 로 충분.
- `validate-wiki.sh` 의 `find raw -name "${link}.*"` 패턴 (`.<chars>` 요구) 개선: scope 외.
- LLM `source_page.filename` emit prefix 강제 (현재 prompt example + LLM 자율): 사용자 요구 시 별 issue. v3 sourcePageBase invariant 로 canonicalizer-side broken link 위험 0.

## 6. 변경 파일

```
wikey-core/src/canonicalizer.ts                    | ~25 LOC
wikey-core/src/ingest-pipeline.ts                  | ~6 LOC
wikey-core/src/__tests__/canonicalizer.test.ts     | ~50 LOC
plan/phase-5-todox-5.12-source-wikilink-format.md  | (신규)
activity/phase-5-resultx-5.12-source-wikilink-format-2026-05-05.md | (신규, 본 문서)
```

새 file: 2 (plan + result). 코드 새 file 0.
