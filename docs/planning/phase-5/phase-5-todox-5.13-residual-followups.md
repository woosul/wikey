---
phase: 5
section: 5.13
title: §5.12 잔존 follow-up 3 항목 — raw wikilink 병기 + validator link/extension 양방 매칭 + LLM source filename prefix
status: completed
created: 2026-05-06
updated: 2026-05-07
version: v2
---

# Phase 5 §5.13 — §5.12 잔존 follow-up 3 항목 (정식 todox)

> **상위 문서**: [`docs/planning/phase-5/phase-5-todo.md`](./phase-5-todo.md) · [`docs/sessions/phase-5/phase-5-result.md`](../../sessions/phase-5/phase-5-result.md)
>
> **이슈 출처**: §5.12 종결 시 scope 외 분리 항목 3개. `phase-5-resultx-5.12-...md §5` + `phase-5-todox-5.12-...md §9` + `session-wrap-followups.md` 다음 세션 액션 마지막 줄에 분산 기록 → 본 §5.13 으로 정식 등록 (사용자 요청 2026-05-06).
>
> **상태**: **in_progress (v1)** — session 21 (2026-05-06) 본격 진행. 각 항목 atomic commit 분리 (B → C → A 순). v1 변경 이력은 §변경 이력 참조.
>
> **사용자 결정** (2026-05-06 session 21): **옵션 A1 + B2 + C4** 채택 — v1 진행.
> - A1 = concept/entity 페이지 `## 출처` 에 raw **wikilink** 병기 (paradigm 미세 조정: v0.1 의 plain markdown link → wikilink, B2 매칭과 결합 paradigm 일관)
> - B2 = validator link 자체 매칭 + extension fallback 양방 시도
> - C4 = LLM prompt 강제 + ingest-pipeline normalize 결합 (defense in depth)
>
> **commit 순서** (의존 관계): B2 (validator 보강) → A1 (B2 매칭에 의존) → C4 (독립).
>
> 진행 흐름은 §종결부 "진행 흐름" 참조.

## 변경 이력

| version | date | 주요 변경 |
|---------|------|----------|
| v0.1 | 2026-05-06 | 사용자 임시 결정 등록 (A1+B2+C4) — draft |
| v1 | 2026-05-06 session 21 | A1 paradigm 미세 조정 (markdown link → wikilink, args chain 변경 불요) + AC 표 + LOC 추정 + test names + self-check #1 |
| v2 | 2026-05-07 session 21 | codex cycle #1 finding fix — A1 PII guard 흐름 반영 (`rawSourceFilename` arg 1개 추가, mask 안 된 원본 — args chain 변경 5~6 함수) + C4 normalize 위치 정정 (write 직전 → callLLMForSummary 내부 line 870 직후, sourcePageBase derive 전) + (d) entity/concept ## 출처 normalized base 확증 test 추가 + (e) §A.3 옵션별 구현 윤곽 v1 paradigm 으로 동기화 + (b)(g) 메모 강화 |

---

## 항목 A — raw sidecar 매칭 부활 (concept/entity 페이지에서 raw 파일로 직접 jump)

### A.1 본질 (쉬운 설명)

위키 작성 흐름은 raw 폴더의 원문 (PDF/HWP/HWPX/Markdown 등) 을 읽고 `wiki/sources/source-<base>.md` (요약 페이지) + `wiki/concepts/*.md` + `wiki/entities/*.md` 를 만든다. concept/entity 페이지의 끝 `## 출처` 섹션은 source 페이지를 가리키는 wikilink 가 있다.

**§5.3 follow-up #11 의 원래 의도** 는 사용자가 concept 페이지에서 wikilink 한 번 클릭으로 **raw 파일을 직접 열기** 였다 (PDF 원문 즉시 확인). 그래서 `[[example.pdf.md|example]]` 같은 raw sidecar 형식을 만들었다. 그런데 이 형식이 `validate-wiki.sh` 와 mismatch (§5.12 본질) 였고, §5.12 에서 `[[source-example|example]]` 로 변경 — **이제는 source 페이지를 거쳐서 raw 로 가야 한다**. one-hop 추가.

### A.2 현재 동작 (§5.12 후)

```
사용자 클릭 [[source-pmbok-overview|pmbok-overview]]
  ↓
wiki/sources/source-pmbok-overview.md 열림 (요약 페이지)
  ↓
사용자가 다시 frontmatter 의 vault_path 또는 본문 내 raw link 찾아 클릭
  ↓
raw/3_resources/pmbok-overview.md (원문) 열림
```

장점: validator PASS, wiki/sources/ 단일 진실 소스 명확.
단점: raw 파일 즉시 열기 = 2 클릭 필요.

### A.3 변경 예상 형태 (옵션 후보)

**옵션 A1 (v2 revised) — concept/entity 페이지 `## 출처` 에 source 요약 + raw 원문 wikilink 병기**:

```markdown
## 출처

- [[source-pmbok-overview|pmbok-overview]]  (../요약)
- [[pmbok-overview.md|원문]]
```

v0.1 의 plain markdown link `raw (raw/3_resources/, 옛 dead)` 에서 wikilink 으로 paradigm 변경한 이유:

1. **B2 매칭과 결합**: B2 의 `find raw -name "${link}"` (link 자체) 가 raw/<bucket>/pmbok-overview.md 매칭 → validator PASS.
2. **Obsidian native**: basename matcher 가 raw/<bucket>/pmbok-overview.md 자동 매칭 → 클릭 1 회 raw 원문 열림.
3. **movePair robust**: raw 파일이 PARA bucket 사이 이동 (3_resources → 4_archive) 해도 basename 동일 → wikilink 자동 유효 (Obsidian 이 link 갱신 불요).

**v2 paradigm 재조정 (codex cycle #1 P1 finding (a) fix)**: PII guard 가 default ON (`piiGuardEnabled: true`, ingest-pipeline.ts:394). `llmSourceFilename = sanitizeForLlmPrompt(sourceFilename, ...)` (line 414) 가 PII 패턴 매치 시 filename 자체에 mask 적용. canonicalize 에 `sourceFilename: llmSourceFilename` (line 890) 전달 → masked filename 이 buildPageContent 의 `sourceFilename` 으로 전파. **A1 의 raw wikilink target 이 masked filename 이면 raw 파일과 매칭 깨짐**.

→ **fix**: `canonicalize` / `assembleCanonicalResult` / `validateAndBuildPage` / `buildPageContent` / `rebuildPageWithCrossLinks` args 에 `rawSourceFilename: string` 1 인자 추가 (mask 안 된 원본 raw basename). buildPageContent 의 raw wikilink target = `${rawSourceFilename}` (PII safe). 기존 `sourceFilename` 은 frontmatter `sources:` 배열 (LLM body 등재용, mask 적용 후) 그대로 유지 — backward compat.

ingest-pipeline 호출 사이트 (line 890 등): `rawSourceFilename: sourceFilename` 전달 (mask 적용 전 원본).

장점: 양 jump 모두 1 클릭 + paradigm 일관 (raw wikilink target = mask 안 된 원본) + frontmatter `sources:` backward compat.
단점:
- args chain 변경 5~6 함수 (canonicalize → assembleCanonicalResult → buildEntityPages/buildConceptPages → validateAndBuildPage → buildPageContent + rebuildPageWithCrossLinks). LOC 추정 ~35 → ~55.
- raw 파일이 동일 basename 으로 vault 다른 곳에 있으면 충돌 (B2 self-check 결과 wiki/sources/ 는 source- prefix 라 충돌 0, 그러나 향후 entity/concept 가 raw basename 동일하게 만들어지면 충돌 가능 — codex P2 finding (b)). 향후 conflict detection 별도 follow-up 으로 분리 (본 §5.13 scope 외).

**옵션 A2 — wikilink target 을 raw 와 source 양쪽 매칭하는 alias 형식**:

```markdown
## 출처

- [[source-pmbok-overview|pmbok-overview]]  (../요약 + raw 자동 mapping)
```

source 페이지 frontmatter 에 `raw_path: raw/3_resources/pmbok-overview.md` 등 명시 → Obsidian plugin 이 hover/preview 에서 raw 도 노출. 단점: plugin 코드 변경.

**옵션 A3 — 별도 H2 섹션 `## 원문` 추가** (raw 파일 link 만):

```markdown
## 출처

- [[source-pmbok-overview|pmbok-overview]]

## 원문

- raw/3_resources/pmbok-overview.md (raw/3_resources/, 옛 dead)
```

장점: 단순. 단점: raw 이동 시 stale.

### A.4 사용자 결정 (확정)

옵션 A1 채택 — v1 paradigm 조정 (wikilink 형식, args chain 0, B2 와 결합).

### A.5 AC 표

| AC ID | 명세 |
|-------|------|
| AC-A1-1 | concept page `## 출처` 에 source wikilink + raw wikilink 두 줄 — `- [[<sourcePageBase>\|<sourceDisplay>]]\n- [[<rawSourceFilename>\|원문]]` |
| AC-A1-2 | entity page `## 출처` 도 동일 형식 |
| AC-A1-3 | rawSourceFilename 다양한 확장자 (.md / .pdf / .hwp / .hwpx / .txt) 모두 동일 형식 출력 |
| AC-A1-4 | 기존 첫 줄 `[[<sourcePageBase>\|<sourceDisplay>]]` 회귀 없음 — §5.12 paradigm 보존 |
| AC-A1-5 | rebuildPageWithCrossLinks (`## 관련` 추가 시) 도 raw wikilink 줄 보존 |
| AC-A1-6 | validate-wiki.sh PASS (B2 와 결합 — A1 의 raw wikilink 가 B2 매칭으로 통과) |
| AC-A1-7 | **PII guard ON 시 (default true) 도 raw wikilink target 이 mask 안 된 원본 raw basename**. ingest-pipeline 이 `rawSourceFilename: sourceFilename` (mask 전) 전달, frontmatter `sources:` 만 masked `sourceFilename` 사용 — paradigm 분리 |

### A.6 우선순위

**MEDIUM** — 사용자가 §5.13 진행 결정 (2026-05-06 session 21).

### A.7 LOC 추정 (v2)

- canonicalizer.ts: +12 line
  - `buildPageContent` args + render: +3 line
  - `rebuildPageWithCrossLinks` args + 호출 chain (assembleCanonicalResult, buildEntityPages/buildConceptPages, validateAndBuildPage, applyCrossLinks): +9 line (각 함수 args 1개 추가 + 전달)
- `CanonicalizeArgs` interface (line 100~150 일대): +1 line
- ingest-pipeline.ts 호출 사이트: +2 line (line 890 + line 904 근방, `rawSourceFilename: sourceFilename` 전달)
- canonicalizer.test.ts: +50~60 line (6 AC × test case + rawSourceFilename arg 추가)
- Total impl + test: ~55 LOC

### A.8 신규 test names (v2)

assertion 은 line-level exact phrase match — `expect(content).toContain('- [[${rawSourceFilename}|원문]]')`. test name 자체에는 phrase 표시 X (codex finding (g) 반영).

- `§5.13 AC-A1-1: ## 출처 — entity raw wikilink 병기 (rawSourceFilename .md)`
- `§5.13 AC-A1-2: ## 출처 — concept raw wikilink 병기 (rawSourceFilename .md)`
- `§5.13 AC-A1-3: ## 출처 — rawSourceFilename 다양한 확장자 (.pdf/.hwp/.hwpx/.txt)`
- `§5.13 AC-A1-4: ## 출처 — 첫 줄 source wikilink 회귀 없음 (§5.12 paradigm)`
- `§5.13 AC-A1-5: rebuildPageWithCrossLinks — raw wikilink 줄 보존`
- `§5.13 AC-A1-7: ## 출처 — PII guard ON 시 raw wikilink target = unmasked rawSourceFilename` (sourceFilename 이 masked 일 때 rawSourceFilename 별도 전달 확증)

---

## 항목 B — `validate-wiki.sh` 의 `find raw -name "${link}.*"` 패턴 개선

### B.1 본질 (쉬운 설명)

`scripts/validate-wiki.sh` 는 wiki 페이지의 wikilink (`[[...]]`) 가 깨지지 않았는지 검증한다. wikilink target 에 `/` 가 없으면 (basename 형식) 다음 순서로 매칭:

1. `find wiki -name "${link}.md"` — wiki/ 안 .md 파일
2. fallback: `find raw -name "${link}.*"` — raw/ 안 임의 확장자 파일

문제: **`find -name "X.*"` 의 `.*` 패턴은 `.<chars>` 즉 1+ 문자 확장자 요구**. raw 의 `pmbok-overview.md` 같은 자체-`.md` 파일을 매칭하려면 link = `pmbok-overview.md` 이지만 `find raw -name "pmbok-overview.md.*"` 가 되어 `.<chars>` 추가 검색 → 매칭 실패.

§5.12 에서는 이 fallback 자체를 안 쓰는 wikilink 형식 (`[[source-<base>|<base>]]`) 으로 우회. 하지만 사용자가 직접 `[[my-raw-file]]` 같은 wikilink 를 만들거나, 다른 ingest 흐름이 raw 매칭을 의도하면 여전히 깨진다.

### B.2 현재 동작

```bash
# scripts/validate-wiki.sh:46
found=$(find raw -name "${link}.*" -print -quit 2>/dev/null)
```

raw/Examples.hwpx → link `Examples` → `find raw -name "Examples.*"` → 매칭 ✓
raw/pmbok-overview.md → link `pmbok-overview` → `find raw -name "pmbok-overview.*"` → 매칭 ✓
**raw/pmbok-overview.md → link `pmbok-overview.md` → `find raw -name "pmbok-overview.md.*"` → 매칭 ✗** (.md 다음에 또 `.<chars>` 요구)

### B.3 변경 예상 형태

**옵션 B1 — `find raw -name "${link}*"` (점 없이)**:

```bash
found=$(find raw -name "${link}*" -print -quit 2>/dev/null)
```

`pmbok-overview.md*` → `pmbok-overview.md` 매칭 ✓ + `pmbok-overview.md.bak` 매칭 ✓ (false positive 위험).

**옵션 B2 — link 자체 매칭 + extension 매칭 양쪽 시도**:

```bash
# 1. link 자체 (extension 포함된 경우)
found=$(find raw -name "${link}" -print -quit 2>/dev/null)
# 2. fallback: link.* (extension 없는 경우)
[ -z "$found" ] && found=$(find raw -name "${link}.*" -print -quit 2>/dev/null)
```

장점: 양 케이스 cover, false positive 위험 ↓.

**옵션 B3 — link 가 .md / .txt / 등 알려진 확장자로 끝나면 자체 매칭, 그 외 .* fallback**:

```bash
case "$link" in
  *.md|*.txt|*.pdf|*.hwp|*.hwpx)
    found=$(find raw -name "${link}" -print -quit 2>/dev/null)
    ;;
  *)
    found=$(find raw -name "${link}.*" -print -quit 2>/dev/null)
    ;;
esac
```

장점: deterministic. 단점: 확장자 list 유지 필요.

### B.4 추천 옵션

**옵션 B2** (Karpathy Simplicity + 양 케이스 cover + 안전).

### B.5 AC 표

| AC ID | 명세 |
|-------|------|
| AC-B2-1 | raw/`<base>.md` 파일 + wikilink `[[<base>.md]]` → validator PASS (link 자체 매칭) |
| AC-B2-2 | raw/`<base>.pdf` 파일 + wikilink `[[<base>]]` (확장자 없음) → validator PASS (.* fallback 매칭, 현재 동작 유지) |
| AC-B2-3 | raw/`<base>.hwpx` 파일 + wikilink `[[<base>.hwpx]]` → validator PASS (link 자체 매칭) |
| AC-B2-4 | raw 에 없는 wikilink (예: `[[non-existent]]`) → validator FAIL (회귀 없음) |
| AC-B2-5 | wiki/<X>.md 파일 + wikilink `[[<X>]]` (basename only) → validator PASS (현재 동작 유지) |
| AC-B2-6 | wiki/<X>.md 파일 + wikilink `[[<X>.md]]` (extension 포함) → validator PASS (link 자체 매칭, wiki 분기에도 추가) |

### B.6 우선순위

**HIGH** — A1 의 raw wikilink (`[[pmbok-overview.md|원문]]`) 가 B2 매칭에 의존. A1 이전에 commit 필요.

### B.7 LOC 추정

- scripts/validate-wiki.sh: +6 line (wiki + raw 양쪽에 link 자체 매칭 1단계 추가)
- scripts/validate-wiki.test.sh (신규 또는 fixture extend): +40~50 line (6 AC × bash assert)
- Total: ~50 LOC

### B.8 신규 test names

- `validate-wiki.sh — B2 raw .md link 자체 매칭`
- `validate-wiki.sh — B2 raw .pdf .* fallback 회귀 없음`
- `validate-wiki.sh — B2 raw .hwpx link 자체 매칭`
- `validate-wiki.sh — B2 비존재 wikilink FAIL 회귀 없음`
- `validate-wiki.sh — B2 wiki .md basename 매칭 회귀 없음`
- `validate-wiki.sh — B2 wiki .md link 자체 매칭 (extension 포함)`

---

## 항목 C — LLM `source_page.filename` emit prefix 강제

### C.1 본질 (쉬운 설명)

ingest pipeline 에서 LLM (Gemini / OpenAI / Anthropic) 은 stage 1 에서 `summary` 를 생성하고 그 안에 `source_page` 객체를 emit:

```json
{
  "source_page": {
    "filename": "source-pmbok-overview.md",
    "content": "# PMBOK 7판 개요\n..."
  },
  ...
}
```

이 `filename` 이 `wiki/sources/<filename>` 위치의 source page 가 된다 (`ingest-pipeline.ts:673` 그대로 사용). 현재 `source-` prefix 는 LLM prompt 의 example (`source-{name}.md`, `source-example.md`) 만으로 강제됨 — **LLM 자율로 prefix 누락 가능** (`pmbok-overview.md` 만 emit).

§5.12 의 `sourcePageBase` invariant 로 canonicalizer 의 broken link 위험은 0 (LLM emit 한 base 그대로 사용). 하지만 wiki/sources/ 의 page 이름이 일관되지 않으면 사용자 검색·index 등재 등에서 혼란 가능.

### C.2 현재 동작

LLM prompt example (ingest-pipeline.ts:1366/1379/1413):
```
"source_page": {"filename": "source-example.md", "content": "..."}
```

LLM 응답 (정상):
```json
{ "source_page": { "filename": "source-pmbok-overview.md", ... } }
```

LLM 응답 (drift, 가능):
```json
{ "source_page": { "filename": "pmbok-overview.md", ... } }
```

→ `wiki/sources/pmbok-overview.md` (no prefix) 저장됨. canonicalizer 는 그 base 그대로 wikilink 생성 → 시스템 일관성은 유지되지만 wiki/sources/ 내 page 이름 형식 일관성 깨짐.

### C.3 변경 예상 형태

**옵션 C1 (v2 revised) — `callLLMForSummary` 내부 line 870 직후 normalize**:

```typescript
// wikey-core/src/ingest-pipeline.ts callLLMForSummary 함수 내부
// LLM JSON parse 결과 받은 직후 (line 870 일대), sourcePageBase derive (line 887) 보다 먼저
const parsed = await callLLMWithRetry(llm, prompt, ...)
if (parsed.source_page?.filename) {
  const original = parsed.source_page.filename
  if (!original.startsWith('source-')) {
    console.warn(`[Wikey ingest] LLM emit drift — auto-normalizing source_page.filename: ${original} → source-${original}`)
    parsed.source_page.filename = `source-${original}`
  }
}
```

**v2 위치 정정 이유 (codex cycle #1 P1 finding (c) fix)**:
- v0.1 / v1 의 plan 명시 위치 = "wiki write 직전 line 673 근방". 그러나 `sourcePageBase = normalizeBase(summaryParsed.source_page.filename)` 이 line 887 (assembleCanonicalResult 내부) 에서 먼저 derive → entity/concept `## 출처` wikilink 가 prefix 없는 base 로 생성됨 → §5.12 paradigm 회귀.
- callLLMForSummary 내부 line 870 직후 normalize → line 887 의 normalizeBase 가 prefix 포함된 filename 받음 → entity/concept `## 출처` 의 wikilink 도 자동으로 `[[source-pmbok-overview|...]]` 일관.
- 호출 사이트 (line 528, 562 근방) 무관 — 함수 책임 분리 (LLM parse + normalize = 같은 layer).

장점: deterministic + 호출 사이트 망각 위험 0 + §5.12 paradigm 회귀 0.
단점: LLM 이 의도적으로 다른 prefix (`raw-`, `archive-`) 를 emit 한 경우 강제 변환 (사용자 결정 = force, 보존 X).

**옵션 C2 — schema 검증 + retry**:

LLM 응답 schema 검증 (`source_page.filename` 이 `^source-` 매치 필수) → 실패 시 1회 retry. 단점: latency ↑, LLM cost ↑.

**옵션 C3 — prompt 에 명시적 강제 문구 추가**:

```
"source_page.filename" 은 **반드시** `source-` 로 시작해야 합니다.
예: `source-pmbok-overview.md`. 다른 prefix 허용 X.
```

장점: 비용 0, LLM 자율 흐름 유지. 단점: LLM 이 강제 무시 가능 (확률 ↓ 이지만 0 아님).

**옵션 C4 — 옵션 C1 + 옵션 C3 결합**: prompt 명시 + ingest-pipeline normalize 안전망.

### C.4 추천 옵션

**옵션 C4** (prompt 강제 + safety net normalize). Karpathy "Defense in depth" + Simplicity 균형.

### C.5 AC 표 (v2)

| AC ID | 명세 |
|-------|------|
| AC-C4-1 | LLM emit `source-pmbok-overview.md` (prefix 정상) → 그대로 사용 (회귀 없음). entity/concept `## 출처` 첫 줄 wikilink = `[[source-pmbok-overview\|...]]` |
| AC-C4-2 | LLM emit `pmbok-overview.md` (prefix 누락) → callLLMForSummary 가 `source-` 자동 prepend → wiki 에 `wiki/sources/source-pmbok-overview.md` 저장 + warn 로그. **entity/concept `## 출처` 첫 줄 wikilink 도 normalized base = `[[source-pmbok-overview\|...]]`** (codex P1 (d) — FULL route entity/concept normalized 확증) |
| AC-C4-3 | LLM emit `raw-pmbok.md` (다른 prefix) → `source-` prepend (force) → `wiki/sources/source-raw-pmbok.md` 저장 + warn 로그 (사용자 결정 = force, 보존 X). entity/concept `## 출처` 도 `[[source-raw-pmbok\|...]]` |
| AC-C4-4 | normalize 후 sourcePageBase derive 도 일관 — `normalizeBase('source-pmbok-overview.md')` = `source-pmbok-overview` (line 887 의 derive 가 normalize 결과 사용) |
| AC-C4-5 | prompt template 에 명시 강제 문구 포함 — `source_page.filename 은 반드시 'source-' prefix 로 시작` (line 1430~1438 근방) |
| AC-C4-6 | **SEGMENTED route** (Route SEGMENTED 의 다중 chunk 처리 case) 도 normalized base 일관 — segmented summary 의 source_page.filename 도 normalize → entity/concept `## 출처` 첫 줄 wikilink = normalized base. (codex P1 (d) — SEGMENTED route 확증) |

### C.6 우선순위

**MEDIUM** — A1, B2 와 독립. 단독 commit 가능.

### C.7 LOC 추정 (v2)

- ingest-pipeline.ts:
  - callLLMForSummary 내부 normalize: +5 line
  - prompt template 강제 문구: +3 line (line 1430 근방)
- ingest-pipeline.test.ts (6 AC × test case + FULL/SEGMENTED route 분리): +60~70 line
- Total: ~78 LOC

### C.8 신규 test names (v2)

- `§5.13 AC-C4-1: callLLMForSummary — LLM emit prefix 정상 시 그대로 사용 (회귀)`
- `§5.13 AC-C4-2 (FULL route): callLLMForSummary — prefix 누락 시 source- 자동 prepend + warn + entity/concept ## 출처 normalized base 일관`
- `§5.13 AC-C4-3: callLLMForSummary — 다른 prefix (raw-) 시 force prepend + entity/concept ## 출처 normalized base 일관`
- `§5.13 AC-C4-4: assembleCanonicalResult — sourcePageBase derive 가 normalized filename 사용`
- `§5.13 AC-C4-5: callLLMForSummary — prompt template 강제 문구 포함 (line-level grep)`
- `§5.13 AC-C4-6 (SEGMENTED route): callLLMForSummary — segmented summary 도 normalize 일관 + entity/concept ## 출처 normalized base`

---

## 진행 흐름 (v1 진행 중 — session 21)

1. ~~사용자 raise~~ → 사용자 임시 결정 등록 (A1+B2+C4, v0.1, 2026-05-06).
2. ~~착수 직전 최종 confirm~~ → 사용자 결정 확정 (2026-05-06 session 21 메시지 "5.13 진행하자").
3. ~~본 §5.13 todox 갱신 v0.1 → v1~~ (각 옵션 별 AC 표 + LOC + test names + paradigm 미세 조정 — A1 wikilink). **완료 (2026-05-07 session 21)**.
4. **codex Mode D Panel cycle (v1 검증, 진행 중)** — narrow scope 라 1 cycle 충분 예상.
5. **TDD RED → GREEN → REFACTOR (Phase 3a 회귀 + Phase 3b BLUE 분리)** — commit 순서 = B2 → A1 → C4 (B2 가 A1 의 dependency).
6. **라이브 검증**:
   - 항목 A: 라이브 ingest 1 source → concept 페이지 `## 출처` 에 raw wikilink 병기 + Obsidian 클릭 시 raw 직접 열림 확증 (master 책임 — `obsidian-cdp` SKILL).
   - 항목 B: validate-wiki.sh shell test (6 AC bash assert) + 기존 wiki PASS.
   - 항목 C: ingest-pipeline.test.ts (5 AC unit test) + 라이브 ingest 1 source 시 wiki/sources/ 결과 prefix 확증.
7. **codex post-impl** (impl 완료 후 1 cycle).
8. **commit + push + result 문서**.

각 항목 atomic commit 분리 (§5.13.B → §5.13.A → §5.13.C 순). 모두 §5.12 paradigm 의 보강 (단일 진실 소스 명확화 / validator robust / LLM drift 방어).

### 옵션 별 구현 윤곽 (착수 시 v1 상세화)

#### A1 (v2) — concept/entity 페이지 `## 출처` 에 raw wikilink 병기

**현재 동작**:
```markdown
## 출처

- [[source-pmbok-overview|pmbok-overview]]
```

**변경 예상**:
```markdown
## 출처

- [[source-pmbok-overview|pmbok-overview]]  (../요약)
- [[pmbok-overview.md|원문]]
```

**구현 위치**:
- `wikey-core/src/canonicalizer.ts` `buildPageContent` (line 475~523) — args `rawSourceFilename: string` 추가 + `## 출처` render 에 raw wikilink line append
- `wikey-core/src/canonicalizer.ts` args chain (`canonicalize` → `assembleCanonicalResult` → `buildEntityPages` / `buildConceptPages` → `validateAndBuildPage` → `buildPageContent` + `rebuildPageWithCrossLinks`) 에 `rawSourceFilename` 전달 — 5~6 함수
- `CanonicalizeArgs` interface (line 100~150 일대) `rawSourceFilename: string` 추가
- `wikey-core/src/ingest-pipeline.ts` 호출 사이트 (line 890 근방) `rawSourceFilename: sourceFilename` 전달 (mask 적용 전 원본)

**필요 정보**:
- `rawSourceFilename`: PII-mask 적용 전 raw basename (예: `pmbok-overview.md`). ingest-pipeline 이 mask 전 `sourceFilename` 보존 → `rawSourceFilename` 으로 전달.
- `sourceFilename` (frontmatter `sources:` 배열용, mask 적용 후) 은 backward compat 유지.

**raw vault path 미사용 이유**: wikilink basename 형식이라 vault path 없이 Obsidian 이 자동 매칭 (raw/<bucket>/<rawSourceFilename> 위치 무관 — basename 동일이면 매칭). PARA bucket 이동 (3_resources → 4_archive) 후에도 wikilink 자동 유효 — Obsidian 이 link 갱신 불필요.

**잠재 risk**:
- raw 파일이 동일 basename 으로 vault 다른 곳 (entity/concept 가 raw basename 동일하게 만들어진 경우) 충돌 — 현재 vault basename 충돌 0 확증 (self-check (f), 2026-05-07). 향후 conflict detection 별도 follow-up 으로 분리 (본 §5.13 scope 외).
- PII guard ON + filename PII match 시 `sourceFilename` (masked) ≠ `rawSourceFilename` (unmasked) — A1 의 raw wikilink target 은 unmasked rawSourceFilename 사용. mitigation = paradigm 분리 (frontmatter sources: = masked / raw wikilink = unmasked).

#### B2 — validator link 자체 + extension fallback 양방 시도

**현재 동작** (`scripts/validate-wiki.sh:46`):
```bash
found=$(find raw -name "${link}.*" -print -quit 2>/dev/null)
```

**변경 예상**:
```bash
# 1. link 자체 (extension 포함된 경우)
found=$(find raw -name "${link}" -print -quit 2>/dev/null)
# 2. fallback: link.* (extension 없는 경우)
[ -z "$found" ] && found=$(find raw -name "${link}.*" -print -quit 2>/dev/null)
```

**구현 위치**: `scripts/validate-wiki.sh:46` 일대.

**테스트**: shell-based fixture test (각 케이스 fixture raw 파일 + 예상 PASS/FAIL). `bats` 도구 또는 간단 bash spec.

#### C4 (v2) — LLM prompt 강제 + ingest-pipeline normalize 결합

**현재 동작**:
- prompt example (ingest-pipeline.ts:1437): `"filename": "source-example.md"` 만 example
- LLM 응답: 자율 (prefix 누락 가능)
- ingest-pipeline.ts:887: `sourcePageBase = normalizeBase(summaryParsed.source_page.filename)` — derive
- ingest-pipeline.ts:647/655: `wiki/sources/${parsed.source_page.filename}` 그대로 사용

**변경 예상**:

(a) prompt 명시 강제 (ingest-pipeline.ts 의 stage 1 summary prompt template, line 1430~1457 근방):
```
### "source_page.filename" 규칙 (필수)
- 반드시 `source-` 로 시작
- 예: `source-pmbok-overview.md`
- 다른 prefix (e.g., `raw-`, `archive-`) 또는 prefix 없음 → 무효
```

(b) ingest-pipeline.ts `callLLMForSummary` 내부 line 870 직후 normalize (sourcePageBase derive 전):
```typescript
const parsed = await callLLMWithRetry(llm, prompt, ...)
if (parsed.source_page?.filename && !parsed.source_page.filename.startsWith('source-')) {
  const original = parsed.source_page.filename
  console.warn(`[Wikey ingest] LLM emit drift — auto-normalizing source_page.filename: ${original} → source-${original}`)
  parsed.source_page.filename = `source-${original}`
}
return parsed
```

**v2 위치 정정 이유 (codex cycle #1 P1 finding (c) fix)**: v0.1 / v1 의 plan 명시 위치 = "wiki write 직전 line 673 근방". 그러나 line 887 의 `sourcePageBase = normalizeBase(...)` 가 먼저 derive → entity/concept `## 출처` 의 wikilink 가 prefix 없는 base 로 생성 → §5.12 paradigm 회귀.

→ callLLMForSummary 내부 line 870 직후 normalize → line 887 의 normalizeBase 가 prefix 포함된 filename 받음 → entity/concept `## 출처` wikilink 도 자동으로 normalized base 일관.

**구현 위치**:
- prompt: `wikey-core/src/ingest-pipeline.ts:1430~1457` 근방 (stage 1 summary prompt template `## 출력 형식` 직전 또는 example 옆)
- normalize: `wikey-core/src/ingest-pipeline.ts:870` 직후 (callLLMForSummary 함수 내부, parsed 받은 후, return 직전)

**테스트** (codex cycle #1 P1 finding (d) — entity/concept ## 출처 normalized base 확증):
- unit: ingest-pipeline mock 으로 LLM 이 prefix 없는 filename emit → callLLMForSummary 가 normalize → assembleCanonicalResult 의 sourcePageBase derive 가 normalized 받음 → entity/concept `## 출처` wikilink 도 normalized base 사용 확증 (FULL/SEGMENTED 양 route)
- 라이브: 다양한 source 형식 (영어 .md, 한국어 .md, .pdf, .hwp, .hwpx) 1개씩 ingest → wiki/sources/ + entity/concept `## 출처` 모두 `source-` prefix 일관

---

## self-check #2 (v2, codex cycle #1 finding 반영 후 7-anchor 재검증)

| # | Anchor | 결과 |
|---|--------|------|
| (a) 시그니처 일관성 | `buildPageContent` + 호출 chain 5~6 함수 args 에 `rawSourceFilename: string` 1 인자 추가 (mask 안 된 원본). PII guard 흐름과 paradigm 분리 (codex P1 (a) fix) | OK |
| (b) state/data 표 | rawSourceFilename ext (.md/.pdf/.hwp/.hwpx/.txt) → raw wikilink display = `원문` 일관. vault-wide basename 충돌 = 현재 0 (self-check (f) 확증), 향후 conflict detection 별도 follow-up (codex P2 (b) 메모 강화) | OK |
| (c) 분기 코드 | C4 normalize 위치 = callLLMForSummary 내부 line 870 직후 (sourcePageBase derive 전). 호출 사이트 무관 + §5.12 paradigm 회귀 0 (codex P1 (c) fix) | OK |
| (d) AC test 1:1 | A1 = 6 AC × 6 test (AC-A1-1~5 + AC-A1-7 PII guard). AC-A1-6 (validator PASS) = 라이브 검증. B2 = 6 AC × 6 test. C4 = 6 AC × 6 test (FULL/SEGMENTED 양 route + entity/concept ## 출처 normalized base 확증, codex P1 (d) fix) | OK |
| (e) drift | v1 의 §A.3 wikilink paradigm 과 §A1 outline (line 364~390) 모두 wikilink + rawSourceFilename arg 명시. v0.1 markdown link / sourcePageRawPath 잔존 0 (codex P1 (e) fix) | OK |
| (f) footer / 변경 이력 | header version v2 ↔ §변경 이력 v2 ↔ frontmatter v2 일관 | OK |
| (g) exact phrase | A1 의 raw wikilink line-level match assertion (`expect(content).toContain('- [[${rawSourceFilename}\|원문]]')`) 명시. test name 자체에는 phrase 표시 X (codex P2 (g) 정리) | OK |

## 메모

- 본 §5.13 은 **v1 in_progress** 상태. session 21 (2026-05-07) 진행 시작.
- **commit 순서**: B2 → A1 → C4 (B2 가 A1 의 validator dependency).
- 라이브 검증은 master 책임 (`obsidian-cdp` SKILL — full cycle smoke). tester 는 단위 / 통합 시뮬레이션 (mock fs + mock LLM).
- TDD-BLUE 누락 보완 — Phase 3a (회귀 검증) + Phase 3b (BLUE refactor) 분리 적용.
- session 21 추가 hot fix: ingest modal `.wikey-modal-plan-list` height 적응형 (commit 569abba) — §5.13 와 무관, 동일 세션 별도 commit.
