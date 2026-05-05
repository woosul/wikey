---
phase: 5
section: 5.13
title: §5.12 잔존 follow-up 3 항목 — raw sidecar 부활 + validator find raw 패턴 + LLM source filename prefix
status: draft
created: 2026-05-06
updated: 2026-05-06
version: v0.1
---

# Phase 5 §5.13 — §5.12 잔존 follow-up 3 항목 (정식 todox)

> **상위 문서**: [`plan/phase-5-todo.md`](./phase-5-todo.md) · [`activity/phase-5-result.md`](../activity/phase-5-result.md)
>
> **이슈 출처**: §5.12 종결 시 scope 외 분리 항목 3개. `phase-5-resultx-5.12-...md §5` + `phase-5-todox-5.12-...md §9` + `session-wrap-followups.md` 다음 세션 액션 마지막 줄에 분산 기록 → 본 §5.13 으로 정식 등록 (사용자 요청 2026-05-06).
>
> **상태**: **draft / 미진행**. 사용자 결정 후 착수. 각 항목은 독립적으로 진행 가능 (본 §5.13 안에서도 sub-section 별 분리 가능).
>
> **사용자 임시 결정** (2026-05-06): **옵션 A1 + B2 + C4** 채택 (변경 가능, 진행 직전 최종 confirm 필요).
> - A1 = concept/entity 페이지 `## 출처` 에 raw link 병기 (요약 + 원문 1 클릭씩)
> - B2 = validator link 자체 매칭 + extension fallback 양방 시도
> - C4 = LLM prompt 강제 + ingest-pipeline normalize 결합 (defense in depth)
>
> 진행 흐름은 §종결부 "진행 흐름" 참조. 본 v0.1 은 옵션 fix 만 등록 — 본문 §A.3 / §B.3 / §C.3 옵션 비교 보존 (변경 시 사용자 재결정 위해).

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

**옵션 A1 — concept/entity 페이지에 raw link 도 함께 표시**:

```markdown
## 출처

- [[source-pmbok-overview|pmbok-overview]]  (요약)
- [raw](raw/3_resources/pmbok-overview.md)  (원문)
```

장점: 양 jump 모두 1 클릭. 단점: 페이지 길이 ↑, raw 파일 이동 시 stale risk.

**옵션 A2 — wikilink target 을 raw 와 source 양쪽 매칭하는 alias 형식**:

```markdown
## 출처

- [[source-pmbok-overview|pmbok-overview]]  (요약 + raw 자동 mapping)
```

source 페이지 frontmatter 에 `raw_path: raw/3_resources/pmbok-overview.md` 등 명시 → Obsidian plugin 이 hover/preview 에서 raw 도 노출. 단점: plugin 코드 변경.

**옵션 A3 — 별도 H2 섹션 `## 원문` 추가** (raw 파일 link 만):

```markdown
## 출처

- [[source-pmbok-overview|pmbok-overview]]

## 원문

- [raw/3_resources/pmbok-overview.md](raw/3_resources/pmbok-overview.md)
```

장점: 단순. 단점: raw 이동 시 stale.

### A.4 사용자 결정 필요

- 사용자가 raw 직접 jump 정말 자주 쓰는가?
- 사용자 답변에 따라 옵션 A1/A2/A3 중 선택 또는 항목 자체 폐기.
- 현재 wiki/sources/ 페이지의 frontmatter 에 `vault_path`, `sidecar_vault_path` 가 이미 있어 source 페이지 거쳐 jump 는 가능 (codex cycle #1 F 항목 확증).

### A.5 우선순위

**LOW** — 기능 누락 없음, 1 클릭 추가 정도. 사용자가 raw 직접 접근을 자주 한다는 신호 (raise) 시 진행.

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

### B.5 AC 개략

- raw/`<base>.md` 파일 + wiki link `[[<base>.md]]` → validator PASS
- raw/`<base>.pdf` 파일 + wiki link `[[<base>]]` → validator PASS (현재 동작 유지)
- raw 에 없는 wikilink → validator FAIL (회귀 없음)
- 신규 unit test: shell test 또는 fixture-based bash test (`bats` 등)

### B.6 우선순위

**LOW** — §5.12 의 우회로 현재 broken case 0건. 사용자가 raw 직접 wikilink 를 쓰는 흐름 raise 시 진행.

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

**옵션 C1 — ingest-pipeline.ts 에서 wiki write 직전 normalize**:

```typescript
// line 673 직전
const filename = parsed.source_page.filename
const normalized = filename.startsWith('source-') ? filename : `source-${filename}`
parsed.source_page.filename = normalized
```

장점: deterministic, LLM emit 무관. 단점: LLM 이 의도적으로 다른 prefix (`raw-`, `archive-`) 를 emit 한 경우 강제 변환.

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

### C.5 AC 개략

- LLM 이 prefix 있는 filename emit → 그대로 사용 (회귀 없음)
- LLM 이 prefix 없는 filename emit → `source-` 자동 추가
- LLM 이 다른 prefix (`raw-` 등) emit → 어떻게 처리? 사용자 결정 (force-rewrite vs preserve)
- 신규 unit test: `ingest-pipeline.test.ts` 에 normalize case

### C.6 우선순위

**MEDIUM** — 현재 broken link 0건이지만 wiki/sources/ 일관성 문제. PMBOK 한국어 source 케이스에서 LLM 이 정상 prefix emit 했지만 다른 source 형식 (특히 영어 source) 에서 drift 가능성 미검증. 사용자가 다양한 source 로 ingest 진행하면서 drift 확증 시 진행.

---

## 진행 흐름 (사용자 결정 후 착수 시 — 옵션 A1+B2+C4 고정)

1. ~~**사용자 raise**~~ → 사용자 임시 결정 등록 완료 (A1+B2+C4, v0.1).
2. **착수 직전 최종 confirm** (사용자 의사 변경 가능: 항목 skip / 옵션 변경 / 우선순위 조정)
3. **본 §5.13 todox 갱신 v0.1 → v1** (각 옵션 별 AC + 구현 details 구체화 + 코드 위치 + LOC 추정)
4. **codex Mode D Panel cycle 검증** (각 항목 narrow scope 라 1 cycle 충분 예상)
5. **TDD RED → GREEN → REFACTOR (BLUE 명시)** — Phase 3 를 회귀 검증 + BLUE refactor 두 단계로 분리 (TDD-BLUE 누락 보완 — 2026-05-06 사용자 raise)
6. **라이브 검증**:
   - 항목 A: 라이브 ingest 1 source → concept 페이지 `## 출처` 에 raw link 병기 확증
   - 항목 B: validate-wiki.sh shell test (.md 자체 link 매칭 + 기존 케이스 회귀 0)
   - 항목 C: 라이브 ingest 1 source → wiki/sources/ filename 이 항상 `source-` prefix 확증 + LLM drift mock test
7. **codex post-impl**
8. **commit + push + result 문서**

각 항목 독립 진행 가능 (§5.13.A / §5.13.B / §5.13.C 분할 또는 일괄). 모두 §5.12 paradigm 의 보강 (단일 진실 소스 명확화 / validator robust / LLM drift 방어).

### 옵션 별 구현 윤곽 (착수 시 v1 상세화)

#### A1 — concept/entity 페이지 `## 출처` 에 raw link 병기

**현재 동작**:
```markdown
## 출처

- [[source-pmbok-overview|pmbok-overview]]
```

**변경 예상**:
```markdown
## 출처

- [[source-pmbok-overview|pmbok-overview]]  (요약)
- [pmbok-overview.md](raw/3_resources/pmbok-overview.md)  (원문)
```

**구현 위치**: `wikey-core/src/canonicalizer.ts:498-510` `buildPageContent` 의 `## 출처` 렌더 부.

**필요 정보**:
- raw 파일의 vault path (`raw/<bucket>/<filename>`) — ingest-pipeline 의 source-registry 또는 sourceFilename + bucket 정보 필요
- canonicalize 호출 시 `sourcePageRawPath: string` 인자 추가 또는 `sourcePageBase` + `sourceBucket` 분리

**잠재 risk**: raw 파일 이동 (movePair 4_archive → 3_resources 등) 시 link stale. mitigation = source-registry 의 vault_path 동기화 trigger 필요.

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

#### C4 — LLM prompt 강제 + ingest-pipeline normalize 결합

**현재 동작**:
- prompt example (ingest-pipeline.ts:1366/1379/1413): `"filename": "source-example.md"` 만 example
- LLM 응답: 자율 (prefix 누락 가능)
- ingest-pipeline.ts:673: `wiki/sources/${parsed.source_page.filename}` 그대로

**변경 예상**:

(a) prompt 명시 강제 (ingest-pipeline.ts 의 stage 1 summary prompt template):
```
### "source_page.filename" 규칙 (필수)
- 반드시 `source-` 로 시작
- 예: `source-pmbok-overview.md`
- 다른 prefix (e.g., `raw-`, `archive-`) 또는 prefix 없음 → 무효
```

(b) ingest-pipeline.ts 의 wiki write 직전 normalize:
```typescript
// line 673 직전, summary parse 직후
const filename = parsed.source_page.filename
if (!filename.startsWith('source-')) {
  console.warn(`[Wikey ingest] LLM emit drift — auto-normalizing source_page.filename: ${filename} → source-${filename}`)
  parsed.source_page.filename = `source-${filename}`
}
```

**구현 위치**:
- prompt: `wikey-core/src/ingest-pipeline.ts:1366-1413` 근방 (stage 1 summary prompt template)
- normalize: `wikey-core/src/ingest-pipeline.ts:673` 직전

**테스트**:
- unit: ingest-pipeline mock 으로 LLM 이 prefix 없는 filename emit → wiki write 시 prefix 추가 확증
- 라이브: 다양한 source 형식 (영어 .md, 한국어 .md, .pdf, .hwp, .hwpx) 1개씩 ingest → wiki/sources/ 결과 모두 `source-` prefix

---

## 메모

- 본 §5.13 은 **draft v0.1 / 미진행** 상태. 사용자 임시 결정 (A1+B2+C4) 등록 완료 — 착수 직전 최종 confirm 필수.
- §5.13 진행 결정 시 본 문서를 v1 으로 갱신 + Phase 0 (codex plan cycle) 부터 시작.
- 항목별 독립이므로 §5.13.A / §5.13.B / §5.13.C 분할 진행도 가능.
- TDD-BLUE 누락 보완 — 2026-05-06 사용자 raise 후 향후 모든 SDD+TDD cycle 에 Phase 3a (회귀 검증) + Phase 3b (BLUE refactor 명시) 분리 적용 예정.
