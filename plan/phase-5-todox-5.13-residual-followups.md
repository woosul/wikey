---
phase: 5
section: 5.13
title: §5.12 잔존 follow-up 3 항목 — raw sidecar 부활 + validator find raw 패턴 + LLM source filename prefix
status: draft
created: 2026-05-06
updated: 2026-05-06
version: v0
---

# Phase 5 §5.13 — §5.12 잔존 follow-up 3 항목 (정식 todox)

> **상위 문서**: [`plan/phase-5-todo.md`](./phase-5-todo.md) · [`activity/phase-5-result.md`](../activity/phase-5-result.md)
>
> **이슈 출처**: §5.12 종결 시 scope 외 분리 항목 3개. `phase-5-resultx-5.12-...md §5` + `phase-5-todox-5.12-...md §9` + `session-wrap-followups.md` 다음 세션 액션 마지막 줄에 분산 기록 → 본 §5.13 으로 정식 등록 (사용자 요청 2026-05-06).
>
> **상태**: **draft / 미진행**. 사용자 결정 후 착수. 각 항목은 독립적으로 진행 가능 (본 §5.13 안에서도 sub-section 별 분리 가능).

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

## 진행 흐름 (사용자 결정 후 착수 시)

1. **사용자 raise** → 어느 항목 (A / B / C 또는 복합) + 어느 옵션
2. **본 §5.13 todox 갱신** (선택 옵션 명시 + AC 구체화)
3. **codex Mode D Panel cycle 검증** (각 항목 narrow scope 라 1 cycle 충분 예상)
4. **TDD RED → GREEN → REFACTOR**
5. **라이브 검증** (B 는 validate-wiki.sh shell test, C 는 라이브 ingest 1 source)
6. **codex post-impl**
7. **commit + push + result 문서**

각 항목 독립 진행 가능. 모두 §5.12 paradigm 의 보강 (단일 진실 소스 명확화 / validator robust / LLM drift 방어).

---

## 메모

- 본 §5.13 은 **draft / 미진행** 상태. todox 등록만 하고 사용자 결정 대기.
- §5.13 진행 결정 시 본 문서를 v1 으로 갱신 + Phase 0 (codex plan cycle) 부터 시작.
- 항목별 독립이므로 §5.13.A / §5.13.B / §5.13.C 분할 진행도 가능.
- 우선순위 추정 (LOW / LOW / MEDIUM) — 사용자 사용 패턴에 따라 변동 가능.
