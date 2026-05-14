---
title: System Prompt Maintenance Guide
description: wikey LLM system prompt 의 4 계층 location matrix, ingest 3-stage prompt 의 변수 contract / 출력 schema / 사용자 override 동작, Settings UI 편집 흐름 검증
created: 2026-05-14
updated: 2026-05-14
tags: [guide, system-prompt, ingest, override, settings, maintenance]
aliases: [prompt-guide, system-prompt-guide]
---

# Wikey — System Prompt Maintenance Guide

> **단일 진실 소스**: `wikey-core/src/ingest-pipeline.ts` + `wikey-core/src/canonicalizer.ts` (ingest 3-stage) / `wikey-core/src/search/*.ts` (query pipeline) / `docs/model/system-prompt.md` (CLI 응답).
>
> **본 가이드 작성 동기 (2026-05-14)**: 사용자 raise — "ingest 관련 시스템 프롬프트는 `docs/model/system-prompt.md` 뿐인거야?" + "Settings UI 의 Ingest Prompts 실제 동작 검증". 답변: **아니다. 4 계층 다층 구조**. 본 가이드는 그 매트릭스 + 편집 절차 + 동작 path 를 정리.

## 1. 4 계층 Location Matrix

| 계층 | 위치 | 소비자 | 사용자 편집 |
|------|------|--------|------------|
| **(1) Bundled default** | `wikey-core/src/ingest-pipeline.ts` (Stage 1·2) + `wikey-core/src/canonicalizer.ts` (Stage 3 builder) | ingest pipeline 의 fallback 소스 — override 없을 때 항상 적용 | 코드 변경 (개발자) |
| **(2) Vault override** | `<vault>/.wikey/stage1_summary_prompt.md` + `stage2_mention_prompt.md` + `stage3_canonicalize_prompt.md` (+ legacy `.wikey/ingest_prompt.md`) | (1) 보다 우선 적용. 존재만 하면 bundled 무시 | **Settings UI 편집 모달** (Stage 1/2/3 row → Edit) 또는 직접 파일 작성 |
| **(3) In-source markdown reference** | `wikey-core/src/prompts/*.prompt.md` (ingest 1 + query 4) | (1) 의 미러 / query pipeline subsystem 참조 | 코드 변경 (개발자) |
| **(4) Local LLM CLI system prompt** | `docs/model/system-prompt.md` | `wikey-query.sh` 같은 CLI 응답용 — **ingest 와 무관** | 직접 파일 편집 |

**결론**: ingest 의 실 동작 prompt 는 **(1)/(2)** 매트릭스. **(4) 는 CLI query 도메인, 절대 ingest 에 적용 안 됨**.

## 2. Ingest 3-stage Prompt 상세

### 2.1 Stage 1 — Source summary

| 항목 | 값 |
|------|---|
| **역할** | source 파일 전체 → `source_page` markdown + `index_additions[]` + `log_entry` 1회 LLM 호출 |
| **bundled symbol** | `BUNDLED_INGEST_PROMPT` (`ingest-pipeline.ts:1650`, 2,573 chars 한글) |
| **vault override path** | `.wikey/stage1_summary_prompt.md` |
| **legacy fallback path** | `.wikey/ingest_prompt.md` (구버전 호환) |
| **resolution 함수** | `loadEffectiveStage1Prompt(wikiFS)` — stage1 > legacy > bundled |
| **호출 site** | `ingest-pipeline.ts:520` (`basePromptTemplate = await loadEffectiveIngestPrompt(wikiFS)`) |

**변수 치환** (반드시 본문에 살아 있어야 함):

| 변수 | 의미 | 누락 시 영향 |
|------|------|-------------|
| `{{TODAY}}` | 오늘 날짜 (ISO `YYYY-MM-DD`) | frontmatter `created/updated` 가 빈 토큰 |
| `{{INDEX_CONTENT}}` | 기존 `wiki/index.md` 내용 발췌 | LLM 이 기존 페이지 인지 못함 → 중복 페이지 생성 |
| `{{SOURCE_FILENAME}}` | 소스 파일명 | 출처 frontmatter 미생성 |
| `{{SOURCE_CONTENT}}` | 소스 본문 전체 | LLM 입력 자체 누락 — 빈 응답 |

**출력 schema (의무)**:

```json
{
  "source_page": "markdown 본문",
  "index_additions": ["- [[page-name]] — 설명 (소스: N개)"],
  "log_entry": "- 소스 요약 생성: [[source-name]]\n- ..."
}
```

### 2.2 Stage 2 — Mention extraction

| 항목 | 값 |
|------|---|
| **역할** | chunk 단위 잠재 wiki 페이지 mention 추출 (분류·정제 없음) |
| **bundled symbol** | `BUNDLED_STAGE2_MENTION_PROMPT` (`ingest-pipeline.ts:1202`) |
| **vault override path** | `.wikey/stage2_mention_prompt.md` |
| **resolution 함수** | `loadEffectiveStage2Prompt(wikiFS)` — stage2 > bundled |
| **호출 site** | `ingest-pipeline.ts:523` |

**변수 치환**:

| 변수 | 의미 |
|------|------|
| `{{SOURCE_FILENAME}}` | chunk 가 속한 소스 파일명 |
| `{{CHUNK_CONTENT}}` | chunk 텍스트 |

**출력 schema (의무)**:

```json
{ "mentions": ["text1", "text2", ...] }
```

**위반 시**: 다른 shape 면 pipeline 이 해당 chunk 를 **0 mentions** 처리 (silent skip). `{"mentions": [...]}` 키 이름 + 배열 타입 정확히.

### 2.3 Stage 3 — Canonicalizer

| 항목 | 값 |
|------|---|
| **역할** | Stage 2 mention list + 기존 wiki state → canonical entity/concept (slug + alias + type 분류 + dedup) |
| **bundled builder** | `buildCanonicalizerPrompt(args)` (`canonicalizer.ts:232`) — 변수 치환 다수의 **동적 builder** (string 상수 아님) |
| **vault override path** | `.wikey/stage3_canonicalize_prompt.md` |
| **resolution 함수** | `loadEffectiveStage3Prompt(wikiFS)` — stage3 override 있으면 그것 / 없으면 bundled builder 그대로 |
| **호출 site** | `ingest-pipeline.ts:524` + `canonicalizer.ts:204` |

**변수 치환** (override 작성 시 필수):

| 변수 | 의미 |
|------|------|
| `{{SOURCE_FILENAME}}` | 소스 파일명 |
| `{{GUIDE_BLOCK}}` | naming 가이드 (slug 규칙) |
| `{{SCHEMA_BLOCK}}` | 허용된 entity/concept type 목록 (D-wide LLM-only ontology) |
| `{{EXISTING_BLOCK}}` | 기존 wiki 페이지 list (dedup 용) |
| `{{MENTIONS_BLOCK}}` | Stage 2 산출 mention list |
| `{{MENTIONS_COUNT}}` | mention 개수 (LLM context 가이드) |

**출력 schema (의무)**:

```json
{
  "entities": [{ "slug": "...", "name": "...", "type": "...", "aliases": [...], ... }],
  "concepts": [{ ... }],
  "index_additions": [...],
  "log_entry": "..."
}
```

**`{{SCHEMA_BLOCK}}` 누락 위험**: canonicalizer 가 type 분류 기준을 잃음 → LLM 이 임의 type 생성 → wiki tag 일관성 파괴.

## 3. Override Resolution Path (런타임 동작)

```
ingest pipeline 진입 (ingest-pipeline.ts:520~524)
  ├── loadEffectiveIngestPrompt(wikiFS)        ← Stage 1
  │     ├── .wikey/stage1_summary_prompt.md 존재? → vault read → return (overridden=true)
  │     ├── .wikey/ingest_prompt.md 존재?      → vault read → return (legacy-ingest)
  │     └── 둘 다 부재 → BUNDLED_INGEST_PROMPT (bundled)
  │
  ├── loadEffectiveStage2Prompt(wikiFS)        ← Stage 2
  │     ├── .wikey/stage2_mention_prompt.md 존재? → vault read → return (overridden=true)
  │     └── 부재 → BUNDLED_STAGE2_MENTION_PROMPT (bundled)
  │
  └── loadEffectiveStage3Prompt(wikiFS)        ← Stage 3
        ├── .wikey/stage3_canonicalize_prompt.md 존재? → vault read → return (overridden=true)
        └── 부재 → '' (empty) → canonicalizer.ts:buildCanonicalizerPrompt() 가 bundled 동적 빌드
```

**LLM 호출 직전**: `effectivePrompt = jsonModeNative ? prompt : JSON_ONLY_PROMPT_PREFIX + prompt` (canonicalizer.ts:713). subscription path 같이 jsonMode 가 `unsupported` 일 때 prefix 강제 부착.

**호출 함수**: `llm.call(effectivePrompt, llmOpts)` — `wikey-core/src/llm-client.ts` 의 provider 별 분기 (gemini / anthropic / openai / ollama).

## 4. Settings UI — Ingest Prompts subsection 편집 흐름

### 4.1 위치

Obsidian Settings → **Wikey** tab → **H3 "Ingest Prompts"** subsection. 위치는 "Ingest Model" subsection 다음, "Schema Override" 이전.

### 4.2 구조

```
H3: Ingest Prompts
intro: "Ingest runs in three stages — Stage 1 summary → Stage 2 mention → Stage 3 canonicalize. Each stage prompt can be overridden independently."

H4: Stage 1 — Source summary
  hint: "Do not write raw [[wikilink]]s in the source_page body — only pages that survive canonicalization..."
  description: "Source → source_page summary. Variables: {{TODAY}}, {{INDEX_CONTENT}}, {{SOURCE_FILENAME}}, {{SOURCE_CONTENT}}. Status: <Bundled default | Custom override at .wikey/stage1_summary_prompt.md | Legacy override at .wikey/ingest_prompt.md>"
  [Edit button] [Reset button (override 미존재 시 disabled)]

H4: Stage 2 — Mention extraction
  hint: "Preserve the output schema ({\"mentions\": [...]}) — any other shape causes the pipeline to treat the chunk as 0 mentions."
  description: "Chunk → Mention JSON. Variables: {{SOURCE_FILENAME}}, {{CHUNK_CONTENT}}. Status: ..."
  [Edit] [Reset]

H4: Stage 3 — Canonicalizer
  hint: "Preserve the JSON output (entities/concepts/index_additions/log_entry). Removing SCHEMA_BLOCK leaves the canonicalizer without a list of allowed types."
  description: "Mention → canonical entity/concept. Variables: {{SOURCE_FILENAME}}, {{GUIDE_BLOCK}}, {{SCHEMA_BLOCK}}, {{EXISTING_BLOCK}}, {{MENTIONS_BLOCK}}, {{MENTIONS_COUNT}}. Status: ..."
  [Edit] [Reset]
```

### 4.3 Edit 동작 (`IngestPromptEditModal`)

`Edit` 클릭 → `IngestPromptEditModal` 열림:

| element | 속성 |
|---------|------|
| modal class | `.wikey-ingest-prompt-modal` |
| h2 | `Edit Stage N — <title>` |
| help paragraph | `Removing template variables ({{...}}) or changing the JSON output schema breaks the pipeline. Edit minimally and keep the bundled version as a reference.` |
| textarea | `.wikey-ingest-prompt-textarea`, `spellcheck=false`, initial content = **현재 override** 또는 **bundled** (loader 결과) |
| footer | `Cancel` (close) + `Save` (`mod-cta`) |

**Save** 누르면:
1. `vault.adapter.exists('.wikey')` 확인 → 없으면 `vault.createFolder('.wikey')`
2. `vault.adapter.write('.wikey/stage{N}_*_prompt.md', next)` — textarea 내용 그대로
3. `new Notice('Stage N — <title> prompt saved.')`
4. `this.display()` — Settings tab 재렌더 → status 가 `Bundled default` → `Custom override at .wikey/...` 으로 즉시 갱신 + Reset 버튼 enabled

### 4.4 Reset 동작

`Reset` 클릭 → confirm dialog → 사용자 OK → `vault.adapter.remove(<canonical>)` + (legacy 있으면 같이) → Notice → display() 재렌더 → Status `Bundled default` 복원.

### 4.5 CDP 라이브 검증 결과 (2026-05-14 Session 43)

| 검증 항목 | 결과 |
|----------|------|
| H3 "Ingest Prompts" 존재 | PASS |
| H4 3 stage 렌더 | PASS (Stage 1 / Stage 2 / Stage 3) |
| 각 row Status text | PASS — 현재 `Bundled default` (vault `.wikey/` 안 override 미존재) |
| Edit button enabled / Reset disabled (override 미존재) | PASS |
| Stage 1 Edit 클릭 → modal open | PASS |
| Modal title | `Edit Stage 1 — Source summary` PASS |
| Modal textarea content len | **2573 chars** (BUNDLED_INGEST_PROMPT 전체) PASS |
| Modal textarea content head | `당신은 wikey LLM Wiki의 인제스트 에이전트입니다.\n아래 소스를 분석하여 위키 페이지를 생성하세요.\n...` PASS |
| Modal footer | Cancel + Save (mod-cta) PASS |
| Cancel 클릭 → modal close | PASS |

**결론**: UI 렌더 + 편집 모달 + Save/Cancel 모두 정상 동작. 실 ingest 호출 시 `loadEffectiveStage{1,2,3}Prompt(wikiFS)` 가 override 우선 적용 (코드 path 확증, `ingest-pipeline.ts:520~524`).

## 5. 편집 시 위험 영역 (Karpathy "Simplicity First" + 출력 schema 정합)

### 5.1 절대 금지

| 금지 | 결과 |
|------|------|
| 변수 치환 마커 `{{TODAY}}` / `{{SOURCE_CONTENT}}` 등 **삭제** | 빈 토큰이 prompt 에 들어가 LLM 이 컨텍스트 없이 동작 → 빈 응답 / hallucination |
| Stage 2 의 `{"mentions": [...]}` JSON shape 변경 | pipeline 이 해당 chunk 를 **0 mentions** 처리 (silent skip) |
| Stage 3 의 `entities/concepts/index_additions/log_entry` 키 변경 | canonicalizer JSON parse 실패 → entire ingest fail |
| Stage 3 의 `{{SCHEMA_BLOCK}}` 삭제 | LLM 이 임의 type 생성 → wiki tag 일관성 파괴 |

### 5.2 권장

- **bundled 본을 backup 으로 유지** — Settings Edit 모달은 항상 현재 *active* prompt 를 보여주므로, 처음 Edit 누르면 bundled 그대로 표시됨. 큰 변경 전에 textarea 내용을 별도 메모로 카피.
- **minimal edit 패턴** — 변수 마커 + 출력 schema JSON template 은 그대로 두고, 자연어 instruction (예: "한국어 응답 유지", "PII 제거 강조") 만 추가.
- **테스트 fixture 로 검증** — `docs/samples/` 의 작은 md 파일 1개를 `raw/0_inbox/` 에 두고 ingest 1 cycle (Brief → Proceed → Processing → Preview) → 결과 확인 후 큰 소스에 적용.

## 6. Query Pipeline Prompt (참고 — ingest 와 별도)

ingest 와 별도로 query 답변·검색 단계에도 system prompt 들이 존재한다. **편집 UI 없음** (코드 변경 영역).

| 파일 | 역할 | bundled symbol |
|------|------|----------------|
| `wikey-core/src/search/query-analyzer.ts` + `prompts/query-analyzer.prompt.md` | `(query, answer)` pair → benchmark suite entry | `BUNDLED_QUERY_ANALYZER_PROMPT` |
| `wikey-core/src/search/query-expander.ts` + `prompts/query-expander.prompt.md` | query 2 complementary expansion | `BUNDLED_QUERY_EXPANDER_PROMPT` |
| `wikey-core/src/search/query-intent-filter.ts` + `prompts/query-intent-filter.prompt.md` | token 별 semantic role 분류 (noise drop) | `BUNDLED_QUERY_INTENT_FILTER_PROMPT` |
| `wikey-core/src/search/query-rewriter.ts` + `prompts/query-rewriter.prompt.md` | filtered token → rewritten query (BM25 recall 향상) | `BUNDLED_QUERY_REWRITER_PROMPT` |
| `wikey-core/src/query-pipeline.ts` 안 inline | RAG context + question → final answer | inline (line 145~802) |

**override 미지원**. 변경 시 wikey-core 코드 수정 + npm test + build 필요.

## 7. Local LLM CLI System Prompt (별도 도메인)

### 7.1 위치

`docs/model/system-prompt.md` (60 lines, 한국어 압축 스키마).

### 7.2 역할

- `wikey-query.sh` 같은 **로컬 CLI** 가 Ollama + Gemma 같은 로컬 모델을 호출할 때 system 메시지로 주입
- wikey.schema.md 의 압축 버전 (로컬 모델의 제한된 context budget 대응)
- **ingest pipeline 은 절대 이 파일을 읽지 않음** — query CLI 응답 도메인 한정

### 7.3 편집

직접 파일 편집. 변경 시:
- `wikey-query.sh` 다음 호출부터 즉시 반영 (cache 없음)
- ingest 동작 영향 0

## 8. 트러블슈팅

| 증상 | 원인 후보 | 진단 |
|------|----------|------|
| ingest 후 wiki 페이지가 빈 frontmatter (created 가 `{{TODAY}}` literal) | `.wikey/stage1_summary_prompt.md` override 에서 `{{TODAY}}` 마커 삭제 | Settings UI Status 확인 → "Custom override at ..." 이면 textarea 안 `{{TODAY}}` grep |
| Stage 2 가 chunk 마다 0 mentions | `.wikey/stage2_mention_prompt.md` 의 출력 schema 가 `{"mentions": [...]}` 가 아님 | textarea 확인 후 Reset 또는 schema 복원 |
| canonicalizer 가 임의 entity type 생성 (wiki tag 일관성 파괴) | Stage 3 override 의 `{{SCHEMA_BLOCK}}` 삭제 또는 잘못된 위치 | Settings Stage 3 textarea 안 `{{SCHEMA_BLOCK}}` 존재 확인 |
| Brief stage 까지 도달 후 무한 hang | Stage 1 prompt 가 LLM context limit 초과 | Stage 1 override 의 `{{INDEX_CONTENT}}` 가 너무 길지 않은지 (사용자 instruction 단축) |
| Settings Status 가 "Legacy override at .wikey/ingest_prompt.md" | 구버전 stage1 fallback 활성 | Reset 후 stage1_summary_prompt.md 신규 작성 권장 |

## 9. 회복 (Reset)

영구 회복:

```bash
# vault 안 .wikey/ 에서 직접 삭제
rm <vault>/.wikey/stage1_summary_prompt.md   # Stage 1 override 회복
rm <vault>/.wikey/ingest_prompt.md            # legacy 회복
rm <vault>/.wikey/stage2_mention_prompt.md   # Stage 2
rm <vault>/.wikey/stage3_canonicalize_prompt.md  # Stage 3
```

또는 Settings UI 각 row 의 `Reset` button (confirm 후 동일 동작 + Notice).

## 10. 단일 진실 소스

| 도메인 | 단일 진실 소스 |
|--------|---------------|
| Stage 1 bundled | `wikey-core/src/ingest-pipeline.ts` `BUNDLED_INGEST_PROMPT` |
| Stage 2 bundled | `wikey-core/src/ingest-pipeline.ts` `BUNDLED_STAGE2_MENTION_PROMPT` |
| Stage 3 bundled | `wikey-core/src/canonicalizer.ts` `buildCanonicalizerPrompt()` |
| resolution 로직 | `wikey-core/src/ingest-pipeline.ts` `loadEffectiveStage{1,2,3}Prompt()` |
| Settings UI 진입점 | `wikey-obsidian/src/settings-tab.ts` `renderIngestPromptsSection()` + `IngestPromptEditModal` |
| Vault override paths | `STAGE{1,2,3}_*_PROMPT_PATH` 상수 (`ingest-pipeline.ts:1589~1595`) |
| CLI query (별도) | `docs/model/system-prompt.md` |

## 부록 A — Settings UI CDP 검증 명령 (재현)

```bash
CDP=~/.claude/skills/obsidian-cdp/scripts/wikey-cdp-wrap.sh

# 1. Settings → Wikey tab 열기
"$CDP" eval "(async () => {
  await app.commands.executeCommandById('app:open-settings');
  await new Promise(r => setTimeout(r, 600));
  const wikeyTab = [...document.querySelectorAll('.vertical-tab-nav-item')].find(t => /wikey/i.test(t.textContent));
  wikeyTab?.click();
})()" await 10

# 2. Stage 1 Edit 클릭 → modal 검증
"$CDP" eval "(async () => {
  const tab = document.querySelector('.vertical-tab-content');
  const h3 = [...tab.querySelectorAll('h3')].find(h => /Ingest Prompts/.test(h.textContent));
  let n = h3.nextElementSibling, editBtn = null;
  while (n && n.tagName !== 'H3') {
    if (n.tagName === 'H4' && /Stage 1/.test(n.textContent)) {
      let m = n.nextElementSibling;
      while (m && m.tagName !== 'H4') {
        const e = [...(m.querySelectorAll?.('button') || [])].find(b => b.textContent.trim() === 'Edit');
        if (e) { editBtn = e; break; }
        m = m.nextElementSibling;
      }
      break;
    }
    n = n.nextElementSibling;
  }
  editBtn?.click();
  await new Promise(r => setTimeout(r, 800));
  const ta = document.querySelector('.wikey-ingest-prompt-modal textarea');
  return { contentLen: ta?.value?.length, head: ta?.value?.slice(0, 80) };
})()" await 15
```

## 부록 B — Override 작성 빠른 시작 예시

`.wikey/stage1_summary_prompt.md` 신규 작성 (Stage 1 한국어 응답 강조 + 표 사용 권장):

```markdown
당신은 wikey LLM Wiki의 인제스트 에이전트입니다.
아래 소스를 분석하여 위키 페이지를 생성하세요.

**중요**: 모든 응답은 한국어 (해요체/합쇼체) 로. 영어 용어는 첫 등장 시 원어 + 한글 음역 병기.

## 컨벤션
(... bundled 본문 유지 ...)

## 변수
- 오늘 날짜: {{TODAY}}
- 기존 wiki index: {{INDEX_CONTENT}}
- 소스 파일명: {{SOURCE_FILENAME}}
- 소스 본문:
{{SOURCE_CONTENT}}

## 출력 (JSON, 강제)
```json
{
  "source_page": "...",
  "index_additions": [...],
  "log_entry": "..."
}
```
```

저장 후 Settings UI Status 가 `Custom override at .wikey/stage1_summary_prompt.md` 로 갱신 + 다음 ingest 부터 즉시 적용.
