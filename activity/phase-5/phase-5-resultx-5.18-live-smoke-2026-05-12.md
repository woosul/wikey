---
phase: 5
section: 5.18
title: Query citation UX — Obsidian CDP 라이브 cycle smoke (Step G)
status: complete
created: 2026-05-12
verdict: LIVE_SMOKE_PASS
---

# Phase 5 §5.18 Step G — Obsidian CDP 라이브 cycle smoke

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.18`](../../plan/phase-5/phase-5-todo.md) · [`plan/phase-5/phase-5-spec-5.18-query-citation-ux.md`](../../plan/phase-5/phase-5-spec-5.18-query-citation-ux.md) · [`activity/phase-5/phase-5-result.md §5.18`](./phase-5-result.md)

## 1. 환경

| 항목 | 값 |
|------|----|
| 날짜 | 2026-05-12 |
| CDP | UP (`localhost:9222`) |
| Git HEAD | `b53ad58` |
| `wikey-obsidian/main.js` md5 | `4342f6d3c6dbba802259bde70e37fcdf` (709 LOC) |
| Plugin reload | OK (`app.plugins.disable/enablePlugin('wikey')`) — commands 11 등록, 그 중 `wikey:wikey-diagnose-citation-mismatches` 1건 |
| Registry state | 14 records, target `sha256:679cf2dd6db75e3a` 누락 (mismatch 유지) |
| Wiki state | `wiki/entities/claude-code.md` provenance ref = `sources/sha256:679cf2dd6db75e3a` (38-page 점유 mismatch sourceId) |
| Test 베이스라인 | wikey-core 832 + wikey-obsidian 132 = 964 PASS (이전 단위/통합 단계에서 확증) |

## 2. Scenario A — Spec 1/3 citation list format + WARN log

### 2.A.1 Query 1 — "claude-code 가 뭐야?"

**답변 textContent (요약)**:
```
위키에 아직 관련 내용이 없어요.
원본:

itil-4-practices (md)
itil-4-overview (md)

참조 페이지 (19)

wiki/concepts/configuration-item.md
...
... (총 19 개, 모두 보려면 Obsidian backlink panel 참조)
```

**innerHTML 발췌**:
```html
<p dir="auto">원본:</p>
<ul>
  <li><a class="internal-link" href="raw/3_resources/60_note/500_technology/itil-4-practices.md">itil-4-practices</a> (md)</li>
  <li><a class="internal-link" href="raw/3_resources/60_note/500_technology/itil-4-overview.md">itil-4-overview</a> (md)</li>
</ul>
<details>
  <summary>참조 페이지 (19)</summary>
  <ul>
    <li><a class="internal-link" href="wiki/concepts/configuration-item.md">wiki/concepts/configuration-item.md</a></li>
    ...
    <li>... (총 19 개, 모두 보려면 Obsidian backlink panel 참조)</li>
  </ul>
</details>
```

검증:
- (a) `원본:` heading 후 `<ul><li>` list format (inline `, ` 사용 X) — **PASS** (Spec 1 I3)
- (b) ext badge `(md)` lowercase — **PASS** (Spec 1 I2)
- (c) `<details>` default closed (`open` attribute 없음) — **PASS** (Spec 2 I5a)

### 2.A.2 Query 2 — "Claude Code anthropic LLM agent 가 뭐야?"

**답변 textContent**:
```
Claude Code는 Anthropic이 개발한 터미널 기반의 AI 코딩 에이전트입니다. ...
참고: claude-code, anthropic, claude, large-language-model
원본:

itil-4-practices (md)
itil-4-overview (md)

참조 페이지 (98)
...
... (총 98 개, 모두 보려면 Obsidian backlink panel 참조)
```

- Backlink truncation (98개 → 5 + 안내) 정상 — **PASS** (Spec 2 I7)
- 답변 본문이 `claude-code` mention → backlink section 발화 (98 page) — **PASS** (Spec 2 Happy path)

### 2.A.3 Query 3 — "claude code 와 codex 차이는?" → WARN log evidence

**Console buffer dump** (`window._wikeyLog` 직접 peek):
```
[warn] [wikey citation] sourceId=sha256:679cf2dd6db75e3a not found in registry (page=wiki/entities/claude-code.md)
[warn] [wikey citation] sourceId=sha256:679cf2dd6db75e3a not found in registry (page=wiki/entities/openai-codex.md)
[warn] [wikey citation] sourceId=sha256:679cf2dd6db75e3a not found in registry (page=wiki/entities/claude.md)
```

검증:
- (a) WARN format = `[wikey citation] sourceId=<id> not found in registry (page=<wiki page path>)` — **PASS** (Spec 3 I8 정확)
- (b) sourceId raw form 유지 (`sha256:679cf...`) — **PASS**
- (c) sensitive 정보 누출 X (raw vault path / 답변 본문 미포함, wiki page path 만) — **PASS** (Spec 3 I8 Q4 LOCK)
- (d) page 별 dedup 없이 매 site 발화 (3 page → 3 log) — **PASS** (Spec 3 I8a)

**Scenario A verdict: PASS** (Spec 1 + Spec 3 모두 충족)

## 3. Scenario B — Spec 2 backlink section

Scenario A 의 Query 1 + Query 2 에서 동시 검증됨:

| 검증 항목 | Query 1 (19 backlink) | Query 2 (98 backlink) |
|-----------|----------------------|----------------------|
| `<details>` element 생성 | PASS | PASS |
| default closed (`open` X) | PASS (`open: false`) | PASS (`open: false`) |
| summary 텍스트 = `참조 페이지 (N)` | PASS (N=19) | PASS (N=98) |
| backlink count 정합 | 19 = page mention 수 | 98 = page mention 수 |
| truncation 안내 (≥ 5) | PASS (`... 총 19 개 ...`) | PASS (`... 총 98 개 ...`) |
| self-reference 회피 | PASS (답변 본문 페이지 backlink list 미포함 — `[[claude-code]]` mention 시 claude-code 자체는 제외) | PASS |

**Scenario B verdict: PASS** (Spec 2 모든 invariants 충족)

## 4. Scenario C — Spec 3 diagnostic command + Modal

**Command 트리거**:
```js
app.commands.executeCommandById('wikey:wikey-diagnose-citation-mismatches')
```

**Modal 본문 (textContent 캡처)**:
```
Citation Registry Diagnostic
1 mismatch / 14 sourceIds, 38 pages affected
sha256:679cf2dd6db75e3a
wiki/concepts/large-language-model.md
wiki/concepts/retrieval-augmented-generation.md
wiki/entities/anthropic.md
wiki/entities/autogen.md
wiki/entities/azure-document-intelligence.md
wiki/entities/chromadb.md
wiki/entities/claude-code.md
wiki/entities/claude.md
wiki/entities/docker.md
wiki/entities/docling.md
... (총 38 개, 모두 보려면 Console 참조)
```

검증:
- (a) Modal title = `Citation Registry Diagnostic` (no "Wikey:" prefix) — **PASS** (Spec 3 I9b)
- (b) Summary line = `1 mismatch / 14 sourceIds, 38 pages affected` — **PASS** (Spec 3 acceptance "Mismatch" scenario)
- (c) sourceId 표시 = `sha256:679cf2dd6db75e3a` (23 chars, ≤ 24 자 spec I9b 부합) — **PASS**
- (d) 영향 page list (10건 표시 + 더보기 안내) — **PASS** (Spec 3 I9b 정확)
- (e) Modal close (Escape) — **PASS** (modal_count 0)

**Scenario C verdict: PASS** (Spec 3 I9 + I9a + I9b 모든 invariants 충족)

## 5. 결정

### 5.1 산출 검증

| Spec | Scenario | Test | Status |
|------|----------|------|--------|
| Spec 1 (citation list) | Multi/Single | A.1 / A.2 (`원본:` + `<ul><li>` + `(md)` ext) | PASS |
| Spec 1 (citation list) | All-fail fallback | A.3 (registry mismatch → footer 발화) | PASS (footer 정합 + WARN log evidence) |
| Spec 2 (backlink section) | Happy | A.1 (19 backlink, collapsed default) | PASS |
| Spec 2 (backlink section) | Truncation | A.2 (98 backlink → 5 + 안내) | PASS |
| Spec 2 (backlink section) | Self-reference 회피 | A.2 (답변 mention page 자체 미포함) | PASS |
| Spec 3 (WARN log) | I8 format | A.3 (`[wikey citation] sourceId=... not found in registry (page=...)`) | PASS |
| Spec 3 (WARN log) | I8 sensitive 차단 | A.3 (raw vault path / 답변 본문 미포함) | PASS |
| Spec 3 (diagnostic) | I9 command 등록 | reload 시 11개 commands 에 `wikey-diagnose-citation-mismatches` 포함 | PASS |
| Spec 3 (diagnostic) | I9b Modal | C (`Citation Registry Diagnostic` title + summary + sourceId + 38 pages) | PASS |

### 5.2 종합 verdict

**LIVE_SMOKE_PASS** — §5.18 Spec 1 / Spec 2 / Spec 3 의 모든 acceptance scenario 가 라이브 환경에서 evidence 발화 확증. 사용자 vault 의 실측 mismatch (sha256:679cf2dd6db75e3a, 38 page) 가 fix 후 동작 그대로 재현.

### 5.3 사이드 effect

- Wiki 변경 X (read-only query + diagnostic).
- Vault 상태 변경 X (registry mismatch 38 page 그대로 유지).
- Plugin reload 시 startup reconcile 동작 (`§5.16 B2 reconcileAfterIngest restored=1 ids=sha256:679cf2dd6db75e3a`) 발화하나 registry 추가는 X — 추후 §5.19 maintenance fix.

### 5.4 다음 단계 (master 결정 영역)

- §5.18 SDD+TDD cycle 종결 (모든 spec 라이브 검증 완료).
- 사용자에게 보고 + commit/push (master).
- registry `sha256:679cf2dd6db75e3a` 실 fix 는 §5.19 별 cycle.
