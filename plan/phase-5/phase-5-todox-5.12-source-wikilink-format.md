---
phase: 5
section: 5.12
title: Source Wikilink Format — `## 출처` 섹션 wikilink 가 wiki/sources/source-<base>.md 매칭
status: planning
created: 2026-05-05
updated: 2026-05-05
version: v3
---

# Phase 5 §5.12 Source Wikilink Format — SDD+TDD + master 1차 + codex 2차 + 라이브 smoke

> **상위 문서**: [`plan/phase-5/phase-5-todo.md`](./phase-5-todo.md) · [`activity/phase-5/phase-5-result.md`](../../activity/phase-5/phase-5-result.md)
>
> **버전 이력**:
> - v1 (2026-05-05 session 19, 첫 작성)
> - v2 (2026-05-05 session 19, codex cycle #1 3 finding 처리: P1-#1 (기존 §5.3 follow-up #11 테스트 4 case 충돌 → 기존 case replace + 신규 2 추가로 전환). P1-#2 (canonicalizer derive 가 LLM emit drift 위험 → canonicalize 시그니처에 sourcePageBase 인자 추가, ingest-pipeline 이 parsed.source_page.filename 의 normalizeBase 결과 주입). P3-#3 (13→12 정정)).
> - **v3 (2026-05-05 session 19, codex cycle #2 4 finding 처리, P1 0건 → master 직접 fix + cycle #3 skip: P2-#1 (ingest-pipeline insertion point — line 539 (FULL) + 608 (SEGMENTED), summaryParsed.source_page.filename 사용, parsed 아님). P2-#2 (호출처 1→2개 양 route 명시). P3-#3 (extractCanonicalLLM 제거 — 실제 chain 5 함수). P3-#4 (baseArgs default sourcePageBase 추가 + source-link case 만 override 명시)).**
>
> **이슈 출처**: §5.11 v2.5 post-impl codex P1-#ω — `wiki/concepts/*.md` `## 출처` 섹션 wikilink `[[<base>.md]]` 형식이 `validate-wiki.sh` 와 mismatch. 12 broken links (PMBOK 라이브 smoke 결과). pre-existing latent bug (§5.3 follow-up #11 의 의도 — raw sidecar `<base>.<ext>.md` 매칭 — 이 validator resolver 와 mismatch). wiki/ 가 `.gitignore` 라 상시 발견 안 됐음.

## 1. 배경

§5.11 v2 라이브 smoke 후 `./scripts/validate-wiki.sh` 실행 → **12 FAIL**:

```
FAIL: wiki/concepts/project-scope-management.md: 깨진 위키링크 [[pmbok-overview.md]]
FAIL: wiki/concepts/project-risk-management.md: 깨진 위키링크 [[pmbok-overview.md]]
... (총 12건 — 11 concepts + 1 entity)
```

실제 파일:
- `wiki/sources/source-pmbok-overview.md` 존재 (write 시 `source-` prefix 적용)
- `wiki/concepts/*.md` 의 `## 출처` 섹션: `[[pmbok-overview.md|pmbok-overview]]` (canonicalizer.ts:489-510 derive)

`validate-wiki.sh` link resolver 동작:
1. link 에 `/` 포함 → `[ -f "$link" ]` 직접 검사
2. `/` 미포함 (basename) → `find wiki -name "${link}.md"` (PASS) 또는 `find raw -name "${link}.*"` (fallback)

**근본 원인**:
1. `[[pmbok-overview.md]]` 의 link 부분 = `pmbok-overview.md` (`|` 앞쪽). `/` 미포함 → basename 처리.
2. `find wiki -name "pmbok-overview.md.md"` (.md 추가) → 없음.
3. `find raw -name "pmbok-overview.md.*"` → 없음 (raw 의 사이드카는 `pmbok-overview.md` 자체 — `<base>.md.*` 패턴 매칭 안 됨).
4. § 5.3 follow-up #11 (canonicalizer.ts:482-487 주석) 의 raw `<base>.<ext>.md` sidecar 매칭 의도는 pdf/hwp 같은 비-`.md` source 도 매칭 안 됨 (validator 의 `find -name` 패턴이 `${link}.*` 이라 `<base>.<ext>.md.*` 검색 → 매칭 실패).

## 2. Root cause 재진단

| 항목 | 현 코드 (canonicalizer.ts:488-493) | validate-wiki.sh resolver | 결과 |
|------|---------------------------------|--------------------------|------|
| `.md`/`.txt` source | `[[pmbok-overview.md\|pmbok-overview]]` | basename → `find wiki -name "pmbok-overview.md.md"` 없음 + `find raw -name "pmbok-overview.md.*"` 없음 | **FAIL** |
| pdf/hwp/hwpx source | `[[Examples.hwpx.md\|Examples]]` | basename → `find wiki -name "Examples.hwpx.md.md"` 없음 + `find raw -name "Examples.hwpx.md.*"` 없음 | **FAIL** |
| `.md` raw 가 `raw/3_resources/` 로 movePair 후 | basename → `find raw -name "pmbok-overview.md.*"` | `pmbok-overview.md` 자체는 매칭 안 됨 (`.*` 는 `.<chars>` 요구) | **FAIL** |

→ §5.3 follow-up #11 fix 자체가 validator 와 mismatch. **wiki/sources/ 의 source page 가 단일 진실 소스** 이므로 wikilink 도 거기를 가리켜야 정합.

## 3. 해결 방안 (옵션 B 채택)

### 3.1 옵션 비교

| 옵션 | wikilink 형식 | validator 매칭 | Obsidian resolve | 비용 | Karpathy |
|------|---------------|--------------|-----------------|------|----------|
| **A path** | `[[wiki/sources/source-pmbok-overview.md\|pmbok-overview]]` | `[ -f "wiki/sources/source-pmbok-overview.md" ]` PASS | full path PASS | vault 위치 hardcode (deep coupling) | ❌ |
| **B basename** | `[[source-pmbok-overview\|pmbok-overview]]` | `find wiki -name "source-pmbok-overview.md"` PASS | basename resolve PASS | 1-line fix | ✅ |
| C 현재 유지 | `[[pmbok-overview.md\|pmbok-overview]]` | FAIL | Obsidian 도 .md.md 검색 후 fallback | broken | ❌ |

**옵션 B 채택**:
- Obsidian native (basename matcher)
- vault 디렉토리 구조 변경에 robust
- `source-` prefix 는 wiki-writer 가 이미 적용 중 (ingest-pipeline.ts:819 에서도 사용)
- 단일 진실 소스 = `wiki/sources/source-<base>.md`

### 3.2 구현 (canonicalizer.ts + ingest-pipeline.ts — v2)

**v1 → v2 변경 (codex P1-#2 fix)**: canonicalizer 가 raw `sourceFilename` 으로부터 `source-${base}` derive 하면 LLM 의 `parsed.source_page.filename` drift (no prefix / different base / casing) 시 wiki/sources/ 실제 page 와 mismatch. **`parsed.source_page.filename` 이 진실 소스** (line 673, 681, 697-698 에서 wiki write 시 그대로 사용) 이므로 canonicalize 시그니처에 `sourcePageBase: string` 인자 추가 + ingest-pipeline 이 normalizeBase 결과 주입.

**canonicalizer.ts — Before**:
```typescript
function buildPageContent(args: {
  name: string; ...; sourceFilename: string; today: string;
  relatedLinks?: readonly string[];
}): string {
  ...
  const lowerSrc = sourceFilename.toLowerCase()
  const sidecarRef =
    lowerSrc.endsWith('.md') || lowerSrc.endsWith('.txt')
      ? sourceFilename
      : `${sourceFilename}.md`
  const sourceDisplay = sourceFilename.replace(/\.[^.]+$/, '')
  return `... ## 출처\n\n- [[${sidecarRef}|${sourceDisplay}]]\n`
}
```

**canonicalizer.ts — After**:
```typescript
// §5.12 — wiki/sources/<sourcePageBase>.md 단일 진실 소스 매칭.
// sourcePageBase 는 ingest-pipeline 이 normalizeBase(parsed.source_page.filename) 로 주입
// (LLM emit drift 방어). validator (validate-wiki.sh) 의 `find wiki -name "<link>.md"` +
// Obsidian basename matcher 양쪽에 PASS. raw sidecar 매칭 폐기 (§5.3 follow-up #11
// 의 의도는 validator + 실제 wiki/sources/ 위치와 mismatch).
function buildPageContent(args: {
  name: string; ...; sourceFilename: string; sourcePageBase: string; today: string;
  relatedLinks?: readonly string[];
}): string {
  const { ..., sourceFilename, sourcePageBase } = args
  ...
  const sourceDisplay = sourceFilename.replace(/\.[^.]+$/, '')  // raw base for display ('pmbok-overview')
  return `... ## 출처\n\n- [[${sourcePageBase}|${sourceDisplay}]]\n`
}
```

**ingest-pipeline.ts — FULL route (line 539 근방) + SEGMENTED route (line 608 근방) 양쪽 derive + 호출 수정** (v3 fix):
```typescript
// FULL route (line 539 근방, summary 파싱 직후 + canonicalize 호출 직전):
const sourcePageBase = normalizeBase(summaryParsed.source_page.filename)
const canon = await canonicalize({
  ..., sourceFilename, sourcePageBase, ...
})

// SEGMENTED route (line 608 근방, 동일 패턴):
const sourcePageBase = normalizeBase(summaryParsed.source_page.filename)
const canon = await canonicalize({
  ..., sourceFilename, sourcePageBase, ...
})
```

**중요** (v3 fix): `summaryParsed` 사용 (canonicalize 호출 시점에 이미 stage 1 summary 파싱 완료). `parsed` (line 631 직후) 는 stage 2 canonicalize 결과 + summary merge 시점이라 너무 늦음.

**시그니처 변경 chain** (canonicalizer.ts, v3 fix — 5 함수, extractCanonicalLLM 제거):
- `canonicalize(args)` — `sourcePageBase: string` 추가 (line 156)
- `assembleCanonicalResult(...)` — 인자 추가 (line 304)
- `validateAndBuildPage(...)` — 인자 추가 (line 414)
- `applyCrossLinks(...)` — 인자 추가 (line 522, entity ↔ concept 페이지 rebuild 시 buildPageContent 재호출)
- `buildPageContent(args)` — `sourcePageBase: string` 추가 + sidecarRef 분기 제거 (line 461)

LOC 변경 추정: canonicalizer ~+8 (시그니처 5 함수 + derive 단순화), ingest-pipeline ~+6 (FULL + SEGMENTED 양 derive + 인자), 주석 ~+5. 총 ~19 LOC. 새 file 0.

Karpathy Simplicity: 기존 .md/.txt vs 비-`.md` 분기 제거 (단일 derive). dependency flow 자연 (LLM emit → wiki write → wikilink 모두 동일 base 사용).

## 4. AC (Acceptance Criteria)

| AC | 내용 | 검증 |
|----|------|------|
| AC-1 | canonicalizer.ts buildPageContent — sidecarRef 가 `sourcePageBase` 인자 그대로 사용 (분기 제거) | grep `sourcePageBase` canonicalizer.ts |
| AC-2 | ingest-pipeline.ts — FULL route (line 539 근방) + SEGMENTED route (line 608 근방) 양쪽 모두 `normalizeBase(summaryParsed.source_page.filename)` derive + canonicalize 호출 시 sourcePageBase 주입 (v3: 1→2 호출처) | grep -c `sourcePageBase` ingest-pipeline.ts ≥ 2 |
| AC-3 | canonicalizer.ts:482-487 주석 §5.3 follow-up #11 → §5.12 갱신 (raw sidecar 매칭 폐기 + sourcePageBase invariant 명시) | grep `§5.12` canonicalizer.ts |
| AC-4 | unit test 갱신 — 기존 `__tests__/canonicalizer.test.ts:448` §5.3 follow-up #11 4 case (`[[*.pdf.md|...]]`, `[[note.md|note]]`, `[[doc.hwp.md|doc]]`, `[[plain.txt|plain]]`) 를 §5.12 기대값 (`[[source-<base>\|<base>]]`) 으로 replace. **baseArgs 에 default `sourcePageBase: 'source-PMS_test'` 추가** (v3: P3-#4 fix), source-link case 만 sourcePageBase override | grep `[[source-` canonicalizer.test.ts |
| AC-5 | unit test 신규 2 case — sourcePageBase invariant (AC-5a: prefix 정상 case) + LLM emit drift 방어 (AC-5b: prefix 없는 case) | npm test PASS |
| AC-6 | 회귀: 전체 unit test 0 break (§5.3 4 replaced + §5.11 v2 5 + §5.12 새 1~2 = 총 ~610~611 PASS / 3 skipped) | npm test |
| AC-7 | typecheck + build 0 errors | npm run build |
| AC-8 | wiki sed 일괄 fix → wiki/concepts/*.md (11개) + wiki/entities/*.md (1개) 의 ## 출처 wikilink 가 `[[source-pmbok-overview\|pmbok-overview]]` 형식 (12 페이지) | grep wiki/concepts wiki/entities |
| AC-9 | `./scripts/validate-wiki.sh` PASS (0 errors) | exit 0 |

## 5. 진행 구조 — SDD+TDD

```
Phase 0: codex Mode D Panel cycle 검증 (cycle #1 NEEDS_REVISION → v2, cycle #2 검증)
Phase 1: TDD RED (canonicalizer.test.ts 4 case replace + 신규 1~2 작성, FAIL 확증)
Phase 2: TDD GREEN (canonicalizer.ts 시그니처 chain + ingest-pipeline.ts derive + 주석 갱신)
Phase 3: REFACTOR (npm test + build 회귀)
Phase 4: 라이브 검증 (sed 일괄 fix → validate-wiki.sh PASS)
Phase 5: codex post-impl 1 cycle
Phase 6: master verdict 결정 + commit + push (§5.11 v2 4 commit + §5.12 일괄 + handoff 삭제)
```

**Phase 4 옵션 결정**:
- 옵션 1 (sed 일괄): 기존 wiki/ 12 페이지 의 ## 출처 wikilink 만 `[[pmbok-overview.md|pmbok-overview]]` → `[[source-pmbok-overview|pmbok-overview]]` 로 sed. 새 ingest 안 돌림. 빠름 (수초). `.gitignore` (line 4 `wiki/`) 라 commit 영향 0 (codex git check-ignore 확증).
- 옵션 2 (PMBOK re-ingest): 90s + ingest 비용. canonicalizer 코드 변경이 ingest pipeline 으로 흘러 나오는지 검증 가능 (e2e cross-check).

→ **옵션 1 채택** (Karpathy Simplicity, narrow scope, 코드는 unit test 가 검증, 라이브는 validator PASS 만 확증).

## 6. TDD case (Phase 1)

### 6.1 기존 §5.3 follow-up #11 4 case replace

`wikey-core/src/__tests__/canonicalizer.test.ts:448` 근방 §5.3 follow-up #11 describe 블록:

**Before** (4 case, 모두 raw sidecar 형식 assert):
```typescript
expect(content).toContain('[[example.pdf.md|example]]')   // pdf source
expect(content).toContain('[[note.md|note]]')              // .md source (그대로)
expect(content).toContain('[[doc.hwp.md|doc]]')            // hwp source
expect(content).toContain('[[plain.txt|plain]]')           // .txt source (그대로)
```

**After** (§5.12 기대값 — sourcePageBase 인자):
```typescript
// canonicalize 호출 시 sourcePageBase 인자 추가 (각 case 별 LLM emit source_page.filename 의 normalizeBase)
expect(content).toContain('[[source-example|example]]')    // pdf source, sourcePageBase='source-example'
expect(content).toContain('[[source-note|note]]')           // .md source
expect(content).toContain('[[source-doc|doc]]')             // hwp source
expect(content).toContain('[[source-plain|plain]]')         // .txt source
```

### 6.2 baseArgs default 추가 (v3 P3-#4 fix)

`canonicalizer.test.ts:21` baseArgs 에 default 추가:

```typescript
const baseArgs = {
  existingEntityBases: [],
  existingConceptBases: [],
  sourceFilename: 'PMS_test.pdf',
  sourcePageBase: 'source-PMS_test',  // §5.12 v3 — default. source-link case 만 override.
  today: '2026-04-19',
  provider: 'gemini',
  model: 'gemini-2.5-flash',
}
```

`canonicalize({ ...baseArgs, llm, mentions })` 호출 ~10곳은 default 자동 사용 (override 불필요).

### 6.3 신규 case (sourcePageBase invariant + drift 방어)

새 describe 블록 `§5.12 source wikilink format invariant`:

```typescript
describe('§5.12 source wikilink format invariant', () => {
  test('AC-5a: sourcePageBase 그대로 사용 — sidecarRef = sourcePageBase (raw sourceFilename 무관)', async () => {
    // sourceFilename = 'pmbok-overview.md' (raw), sourcePageBase = 'source-pmbok-overview' (LLM emit + normalizeBase)
    const result = await canonicalize({
      ...baseArgs, llm, mentions,
      sourceFilename: 'pmbok-overview.md',
      sourcePageBase: 'source-pmbok-overview',
    })
    const entity = result.entities[0]
    expect(entity.content).toMatch(/^- \[\[source-pmbok-overview\|pmbok-overview\]\]$/m)
    expect(entity.content).not.toMatch(/\[\[pmbok-overview\.md/)  // §5.3 형식 0건
  })

  test('AC-5b: LLM emit drift 방어 — sourcePageBase 가 prefix 없거나 different base 여도 그대로 사용', async () => {
    // LLM 이 source_page.filename = 'pmbok-overview.md' (no prefix) emit → normalizeBase = 'pmbok-overview'
    // canonicalizer 는 raw sourceFilename 기반 derive 안 함 — 받은 base 그대로 사용
    const result = await canonicalize({
      ...baseArgs, llm, mentions,
      sourceFilename: 'pmbok-overview.md',
      sourcePageBase: 'pmbok-overview',  // no source- prefix (drift)
    })
    const entity = result.entities[0]
    expect(entity.content).toMatch(/^- \[\[pmbok-overview\|pmbok-overview\]\]$/m)
    // wiki/sources/pmbok-overview.md 매칭 (LLM 이 prefix 없이 emit 한 결과 따라감)
  })
})
```

**총 case 변동**: §5.3 4 case replace (PASS 유지) + baseArgs default 추가 (회귀 0) + §5.12 신규 2 case = 기존 회귀 0, 새 가산 +2 = 총 ~615 PASS (608 기존 + 5 §5.11 v2 + 2 §5.12 신규 = 615).

## 7. self-check (master 1차 7-anchor — v2)

- (a) **시그니처 일관성** (v3): canonicalize / assembleCanonicalResult / validateAndBuildPage / applyCrossLinks / buildPageContent **5 함수** (extractCanonicalLLM 존재 X) 모두 `sourcePageBase: string` 인자 추가. ingest-pipeline.ts 호출처 **2** (FULL line 539 + SEGMENTED line 608) — summaryParsed 사용.
- (b) **state/data 표 형식**: §3.1 옵션 표 + §2 root cause 표 정합.
- (c) **builder 분기 코드**: lowerSrc/sidecarRef 분기 제거 → 단일 사용 (`sourcePageBase` 인자 그대로).
- (d) **AC test 케이스**: AC-4 (§5.3 4 case replace) + AC-5 (§5.12 신규 2 case — invariant + drift 방어) = LLM emit drift 양 시나리오 cover.
- (e) **self-check 행 drift**: v1 → v2 → v3 갱신 (시그니처 chain 5 함수 정정 + ingest-pipeline 호출처 2 명시 + summaryParsed 사용 + baseArgs default).
- (f) **footer + 변경 이력 + cycle 번호**: header v3 / 변경 이력 v1+v2+v3 / cycle 2 (codex cycle #2 NEEDS_REVISION P1 0건 narrow → master 직접 fix + cycle #3 skip).
- (g) **코드 ↔ test exact phrase**: `[[source-pmbok-overview|pmbok-overview]]` (AC-5a) + `[[pmbok-overview|pmbok-overview]]` (AC-5b drift) + 4 §5.3 replace exact phrase 모두 plan 본문 + test 동일.

## 8. Karpathy 4원칙 정합 (v2)

- **Think Before Coding**: post-impl P1-#ω finding 본질 분석 → §5.3 follow-up #11 자체가 validator 와 mismatch 였음 확증. codex cycle #1 P1-#2 의 LLM emit drift 위험 본질 인정 → derive 가 raw 가 아닌 진실 소스 (parsed.source_page.filename) 의존하도록 dependency flow 자연화.
- **Simplicity First**: ~18 LOC 변경 (시그니처 chain + 분기 제거 + derive 단순 + 주석). 새 file 0. raw sidecar 매칭 + .md/.txt vs 비-`.md` 분기 dead code 제거. sourceBody (§5.11 v2 dispute) 와 다른 차원 — sourcePageBase 는 string 1개 (LLM context bloat 무관).
- **Surgical Changes** (v3): canonicalizer.ts (시그니처 5 함수, extractCanonicalLLM 미존재) + ingest-pipeline.ts (FULL line 539 + SEGMENTED line 608 양 호출처 + 양 derive). test 4 replace + 2 신규 + baseArgs default. wiki sed 1회 (옵션 1). 무관한 코드/주석 손대지 않음.
- **Goal-Driven**: 9 AC 정량 + validate-wiki.sh PASS 검증 + codex post-impl cross-check + LLM emit drift 양 시나리오 (prefix O / prefix X) test cover.

## 9. Scope 외 (다음 이슈)

- raw sidecar 매칭 의도 자체 부활 (§5.3 follow-up #11 의 원래 동기 — concept/entity 페이지에서 raw 로 직접 jump): 사용자 요구 시 별 issue. 현재 wiki/sources/ 페이지에 vault_path / sidecar_vault_path frontmatter 가 있어 source page 거쳐 jump 가능 (codex cycle #1 F 항목 확증).
- validate-wiki.sh 의 `find raw -name "${link}.*"` 패턴 (`.<chars>` 요구) 개선: scope 외.
- LLM source_page.filename emit 의 prefix 강제 (현재는 prompt example 만 + LLM 자율): 사용자 요구 시 별 issue. v2 의 sourcePageBase invariant 로 canonicalizer-side broken link 위험은 0.
