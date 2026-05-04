# Phase 5 §5.10 — Graph emergent ontology paradigm shift (보조 plan)

> **상위 문서**: `plan/phase-5-todo.md §5.10`. 본 문서는 §5.10 진입 시 detail spec.
>
> **상태 (v5.4, 2026-05-04)**: ★ codex cycle #7 NEEDS_REVISION (3 P3 minor — §8 next action v3/cycle #2 잔존 + §9.4 ~30~50 file 잔존 + parent/activity mirror 상단 v5.2/cycle #6 잔존) → master 직접 fix (사용자 cycle #8 마지막 시도 결정). 본 v5.4 = v5.3 의 in-place cleanup: (1) §8 next master action v3/cycle #2 → v5.4/cycle #8 갱신 (cycle #1~#7 누적 + C5 cleanup + cycle #8 NEEDS_REVISION 시 무조건 종료 명시). (2) §9.4 이득 항목 ~30~50 file → ~35~55 동기화. (3) parent (phase-5-todo:856) + activity (phase-5-result:23~24) 상단 mirror v5.2/cycle #6 → v5.4/cycle #8 갱신 + cycle 진화 v1→v5.4 명시. (4) header v5.3 → v5.4 + 변경 이력 v5.4 row + footer cycle #8. **사용자 명시**: cycle #8 마지막 시도 — NEEDS_REVISION 시 무조건 v5.4 보존 + 종료 (cycle pattern 8 회 누적, plan 700 lines 구조적 risk 인식). codex cycle #8 검증 대기. <br>**이전 상태 (v5.3)**: cycle #6 NEEDS_REVISION (2 P3 minor) fix + panel-dispatch.sh skill 영구 fix. 본 v5.3 = v5.2 의 in-place cleanup: (1) §7 self-check 표 v5.1/cycle #5 → v5.3/cycle #7 갱신 + (e)/(f) row 에 v5.2/v5.3 cleanup 반영. (2) `plan/phase-5-todo.md:918` + `activity/phase-5-result.md:1441` migration cost ~30~50/~100 → ~35~55/~110 동기화 (보조 plan §3.1.1 R1~R8 ripple 일치). (3) header v5.2 → v5.3 + 변경 이력 v5.3 row + footer cycle #7. **추가**: panel-dispatch.sh skill 의 `start_codex` 에 update notification auto-skip 통합 (master "2" 강제 송부 폐기, 사용자 명시 영구 fix). codex cycle #7 검증 대기. <br>**이전 상태 (v5.2)**: cycle #5 NEEDS_REVISION (3 minor finding — §14.2 본문 stale + AC-C5.3 invariant 부정확 + mirror) fix. 본 v5.2 = v5.1 의 in-place cleanup: (1) §14.2 (B) intercept 본문 정정 — `attachCitationButtons (line 532~) 또는 별 helper` → `renderMarkdown() (line 2830~2858) 의 *기존 click handler 2 곳*` (handler 1 line 2835~2840 + handler 2 line 2853~2858). (2) AC-C5.3 root-only invariant 정확화 — `find . -maxdepth 1 -size 0c` 으로 좁힘. raw/_delayed/ 의 0-byte placeholder 5 개 별도 audit (사용자 승인 필수, AC 범위 외). (3) mirror phase-5-todo §5.10 + activity:23 v5.2/cycle #6 갱신. codex cycle #6 검증 대기. <br>**이전 상태 (v5.1)**: cycle #4 NEEDS_REVISION (4 minor finding) fix. v5: cycle #3 NEEDS_REVISION (6 finding) fix. 본 v5.1 = v5 의 in-place cleanup: (1) §0 제목 "4 concern" → "5 concern" + C5 row 매핑 §15 → §14 정정. (2) §14 (C5) 하위 heading 15.1~15.5 → 14.1~14.5 renumber. (3) AC-C5.2 정확화 — `sidebar-chat.ts:2830~2858 renderMarkdown()` 의 *기존 click handler* 안에서 `getFirstLinkpathDest` resolve-before-open 으로 동작 (별 helper X). (4) AC-C5.3 분기 명시 — Untitled.md 보존 (분기 A: 9 개 삭제, vault 0-byte md 1) vs 삭제 (분기 B: 10 개 삭제, vault 0-byte md 0). (5) §7 self-check v5 갱신 — anchor (a)~(g) 모두 R0/cache callsite/C5 spot 추가 cover. codex cycle #5 검증 대기.
>
> **이전 상태 (v5, 2026-05-04)**: ★ codex cycle #3 NEEDS_REVISION (P1×2 + P2×2 + P3 stale 다수 + 신규 risk (j), 6 finding) → master 직접 fix (사용자 cycle #4 master fix 결정). (1) P1-1 §11.2 본문 (line 484) entity_types/concept_types 보존 표현 정정 → aliases/pii_patterns 만. (2) P1-2 §10.3 (line 346) + §10.4 (line 431) "disk write 0" 표현 모두 → "vault write 0 (cache write 는 ephemeral 허용)" 정정. (3) P2-1 AC-C1.6 산술 정정 (10+5+1+1+2 = ≥19, 732→≥751). (4) P2-2 §3.1.1 R checklist 보강 — R0 신규 (`ingest-pipeline.ts:919` extractMentions type_hint prompt 폐기) + R5 보강 (docs/wikey-ingest-pipeline.md:369/398/712 추가). (5) P3 stale 다수 fix — §3.4 (~100/~630 → ~110/~622), §7 anchor (f) (v3/cycle #2 → v5/cycle #4), §12.2 (AC 4항목/732→740 → AC 7항목/732→≥751), activity:24 (v3/cycle #2 → v5/cycle #4). (6) 신규 risk (j) AC-C1.7 보강 — cache callsite migration (line 1504 unhwp, 1568 docling, 1782 pdf-cache-hit) 모두 `{ content, sidecarCandidate }` 처리 추가. codex cycle #4 검증 대기.
>
> **버전 이력**:
> - v1 (2026-04-26 session 14): 사용자 본질 비판 6 chain 의 정식 이슈화. 4 옵션 A/B/C/D 정의. §3.1~§3.5 옵션 D 상세. §9 정당성 검증 (§5.4 없어도 wikey 작동).
> - v2 (2026-05-04): 사용자 4 concern (C1~C4) 추가 등록. C1 = §10 신규 (Step 2/3 conversion 통합 efficiency issue). C2/C3/C4 = §11 옵션 D 보강 (4 concern → spec layer 매핑). §12 = Karpathy 4 원칙 + 4 코딩 원칙 cross-check. §13 = wikey.schema.md "핵심 원칙 #2" 일치 검증. §7 self-check 7-anchor 갱신.
> - v3 (2026-05-04): ★ codex Mode D Panel cycle #1 NEEDS_REVISION (P1-1 + P1-2 + P2 + P3) → master 직접 fix. 사용자 옵션 **D-wide** 채택 — 옵션 D 의 정의를 *7-type schema gate 까지* deprecate 로 확정 (D-narrow 폐기). §0 D-narrow vs D-wide 결정 표 추가. §2 옵션 D 행 D-wide 명시. §3.1 deprecate list 에 `schema.ts:20~21 ENTITY_TYPES/CONCEPT_TYPES` + `buildSchemaPromptBlock` 7-type gate 추가. §3.2 layer 2 정정 (canonical slug normalization 만, 7-type guide 폐기). §10.2 결함 (a) HWP/DOCX brief 누락 정확 진단. §10.3/§10.4 의사 흐름도 정정 (`convertSourceToMarkdown` = pure conversion only — PII gate / sidecar write 책임 ingest() 잔존). §10.5 AC 에 Cancel/Back 시 disk write 0 + HWP/DOCX brief 변환 추가. §11.1 D-wide 매핑 정정. §11.3 "출력 형식 규약" 표현 제거 (entity_types/concept_types 자체 deprecate). §13 D = D-wide 명시. §14 변경 이력 v3 추가.
> - v4 (2026-05-04): ★ codex Mode D Panel cycle #2 NEEDS_REVISION (P1×3 + P2 + P3, 5 finding) → master 직접 fix. (1) §3.1 store schema.yaml 보존 영역 정정 (entity_types/concept_types/custom-types 제거, aliases/pii_patterns 만). (2) phase-5-todo §5.10.2.D + activity §5.10.4 mirror 정정 (D-wide 갱신, "alias / PII / custom-types 보존" → "alias / PII 만 보존"). (3) §10.5 AC-C1.4 Cancel invariant → **vault write 0** 으로 정확화 (cache write 는 ephemeral 허용). (4) §10.5 AC-C1.7 신규 — convert-cache 의 PDF sidecarCandidate 보존 cache 정정 (cache schema 갱신: stripped 단독 → `{ content, sidecarCandidate }`). (5) §3.1.1 D-wide ripple checklist 신규 (schema.ts validation helpers + canonicalizer.ts:363~467 forced/drop/frontmatter + types.ts EntityType/ConceptType union + settings-tab.ts:1126~1132 + docs/wikey-ingest-pipeline.md:323~366 모두 명시). (6) §7 self-check anchor (a) `schema.ts:17~18` → `:20~21` 정정. (7) §3.1/§12 v2 stale 수치 (~100 test) → ~110 일치. §14 변경 이력 v4 추가.

---

## 0. 사용자 5 concern 한눈 매핑 (v2 신규 + v5 C5 추가)

본 v2 의 trigger = 사용자가 `docs/wikey-ingest-pipeline.md` 전체 검토 후 4 concern raised. master 가 §5.10 v1 chain (6 항) 과 cross-check 후 매핑 결과:

| concern | 사용자 명시 (직접 인용) | 본 plan §매핑 | 분류 |
|---------|----------------------|-------------|------|
| **C1** | "ingest summary를 별도의 extractPDFText(stripped만 사용)을 할게 아니라, step3에서 파일 유형에 따른 converting은 필수조건이므로 컨버팅을 1-step으로 진행하는게 바람직해 보임" | §10 (신규) | **독립 efficiency issue** — §5.10 옵션과 무관, 어느 옵션 채택해도 적용 권장 |
| **C2** | "내부적으로 entities/concepts등의 개념을 LLM을 이용해서 충실하게 생성하고 확장할 수 있음에도 표준화라는 개념으로 후보풀, mention, canonicalization, schema.yaml, built-in-standard-decomposition(4entities+3concept type으로 제한) > 거부시의 프로세스 추가 (자율적 생성과 확장이 더 중요하게 아닌가?)" | §11.1 (옵션 D 보강) | **옵션 D 정당성 핵심** — chain 1·2·3·5 직접 확장 |
| **C2-부속** | "2)번의 연장선상으로 내부 기준을 불필요하게 많이 생성하고 있는데, 특히 .wikey/schema.yaml, *.json들" | §11.2 (옵션 D 보강) | **store 폐기 list cross-check** — 6 개 file 영향 범위 확정 |
| **C3** | "Self-extending에도 지식 자율 확장에 대한 정의만 필요하지, schema.yaml에 특정한 틀안으로 뭔가 지식을 꾸겨넣은듯 한 느낌이 있음. 모든 것은 내부에 들어오는 지식, 문서의 유형에 따라 계속 분류값이나 지식확장 기준이 자동 변경되고 확장되어야함." | §11.3 (옵션 D 보강) | **chain 2·4 확장** — naming "self-extending" misleading + 자율 확장 정의 |
| **C4** | "karpathy의 철학에서도 사용자는 wiki를 관리할 수 없다. > LLM을 활용해서 관리" | §11.4 (옵션 D 보강) + §13 | **chain 6 직접 강화** — wikey.schema.md "핵심 원칙 #2: 위키는 LLM 이 소유한다" 와 정확 일치 → 옵션 D 정당성 schema 직결 |
| **C5 (v5 신규)** | "질의/응답 결과 본문에 페이지가 없는 링크가 있고, 이것을 선택하면 root폴더에 해당 페이지가 새롭게 생성되는 구조. 단어/명칭/어구가 페이지가 없는 곳에 링크는 필요없음. 페이지가 없는 링크를 사용자가 선택해서 새로운 페이지 생성할 일 없음" + "현재의 root폴더에 그래서 생성된 빈페이지가 있음" | §14 (신규) | **독립 prevention + cleanup issue** — §5.10 옵션과 무관. 어느 옵션 채택해도 적용. master 직접 grep 으로 root 0-byte .md 10 개 확증 (Phase 4.md / PMBOK.md / 운영 안전.md / 증분 재인제스트.md / 검색 graph expansion.md / Audit UI.md / cross-link.md / qmd embeddings.md / Phase 5.md / Untitled.md). |

**관찰 (v5 갱신)**: C1 + C5 는 §5.10 옵션과 직교 (어느 옵션이든 적용). C2/C2-부속/C3/C4 는 모두 옵션 D-wide 의 4 가지 다른 layer 정당화 — 옵션 D 채택 정당성이 v1 (chain 6) 대비 v5 까지 *layer 별 매핑* 으로 정밀화됨.

### 0.1 옵션 D 정의 결정 — D-wide 채택 (v3 신규, codex P1-2 fix)

> codex Mode D Panel cycle #1 (2026-05-04) 가 옵션 D 의 정의가 두 가지로 갈리는 것을 finding (P1-2). v2 plan 이 §11.1 (LLM 자율 entity/concept 추출) 과 §11.3 (entity_types/concept_types 보존 + 7-type prompt guide 유지) 사이에서 oscillate. **사용자 결정 (2026-05-04 직접 명시): D-wide 채택**.

| 정의 | 폐기 범위 | 보존 범위 | 사용자 C2 비판 매칭 |
|------|---------|---------|---------------------|
| **D-narrow (폐기)** | `standard_decompositions` schema 만 (Stage 1~4 self-extending 폐기) | `ENTITY_TYPES` (organization/person/product/tool) + `CONCEPT_TYPES` (standard/methodology/document_type) + `buildSchemaPromptBlock` 7-type gate | **❌ 부분만** — 사용자 C2 "BUILTIN_STANDARD_DECOMPOSITION (4 entities + 3 concept type 으로 제한)" 비판이 **그대로 잔존** |
| **★ D-wide (채택)** | `standard_decompositions` + `ENTITY_TYPES` + `CONCEPT_TYPES` + `buildSchemaPromptBlock` 7-type gate + `schema.ts:245` "이 외 분류는 거부됨" prompt | `canonicalizer.ts` minimal alias normalization (slug dedup, 다국어/약어/동명이인) | **✅ 정확** — LLM 이 entity / concept *type* 자체를 자율 결정 (input 문서 유형에 따라 자동 변경, C3 정확 충족) |

**D-wide 정당성 (사용자 결정 trace)**:
- C2 사용자 원문: "built-in-standard-decomposition (4 entities + 3 concept type 으로 제한)" — 4+3 type *제한* 자체가 비판 대상. D-narrow 는 이 비판 미충족 (codex P1-2 finding 의 정확한 echo).
- C3 사용자 원문: "문서의 유형에 따라 계속 분류값이나 지식확장 기준이 자동 변경되고 확장되어야함" — schema 가 7 type 만 강제하면 문서 유형별 자동 변경 X. D-wide 만 가능.
- Karpathy 철학: "사용자는 wiki 를 관리할 수 없다 → LLM 이 관리" — type union 자체가 사용자 명시 schema 라면 사용자가 *암묵적으로* wiki 분류 기준 관리. D-wide 가 진짜 LLM-only.
- LLM 능력: GPT-4 / Claude Opus / Gemini 2.5 Pro 모두 entity / concept 자율 분류 (PMS 30-run 측정에서 type 분류 자체는 안정. 기존 7-type gate 는 *"분류 변동성 줄이기"* 용으로 도입했으나 사용자 우선순위는 *"자율 확장"*).

**D-wide trade-off** (사용자 결정에 포함 의도):
- **+** wikey 가 "외부 표준 분해 도구" 한계 벗어남 (잡지/메모/임의 자료 모두 wikey 적용 가능)
- **+** schema layer 0 (옵션 D 의 핵심 약속 완전 실현)
- **+** LLM 자율 type extension (예: 새 도메인 진입 시 LLM 이 `algorithm` / `dataset` / `format` 등 자동 추가)
- **-** entity / concept 분류 변동성 ↑ (PMS 30-run 측정의 CV 24.6% → ~30~35% 예상, §5.4.1 deterministic mode 보호 안 됨)
- **-** PMBOK 같은 외부 정형 표준 분해 정확도 ~10~15% 감소 (§9.4 옵션 D 손실 추정 — D-narrow 동일 손실, D-wide 추가 영향 X)

⇒ 본 plan v3 부터 옵션 D = **D-wide** 단일 정의. v2 의 oscillation 은 §3.1 / §11.1 / §11.3 모두 v3 에서 D-wide 일관 정정.

---

## 1. issue 배경 (사용자 본질 비판 chain — v1 보존)

| # | 사용자 명시 (직접 발언) | 함의 |
|---|----------------------|------|
| 1 | "표준 분해 패턴을 왜 등록·관리해야 하나? 너무 엔지니어링적 사고." | panel 자체의 존재 가치 의문 |
| 2 | "self-extending 인데 진짜는 자동 확장 ontology 개념이어야지. 지금은 수동." | self-extending 명명의 약속 vs 현재 수동성 갭 |
| 3 | "표준 분해 그룹 = 지식 그룹? — 표준 분해 그룹 ⊂ 지식 그룹." | 개념 일반화 — knowledge group 으로 generalize |
| 4 | "wiki 가장 많이 노출되는 게 중심으로 — 굳이 그룹으로 나눠 제한 두는 게 이상해." | graph emergent ontology — 그룹 abstraction 제거 |
| 5 | "지식 분해하는 그룹이 왜 필요? 세상 수많은 지식을 어떻게 표준화?" | epistemology 비판 — 지식 분해 모델 자체의 한계 |
| 6 | "굳이 어려운말 써가면서 지식을 분류할 필요 없잖아. LLM 이라는 든든한 백 위에서 움직이는 건데." | LLM 시대의 ontology 시대착오. 옵션 D 정당화 |

## 2. 4 옵션 비교 (v1 보존)

| 옵션 | 명칭 | 핵심 | 마이그레이션 비용 | 사용자 정당성 |
|------|------|------|------------------|------------|
| A | 점진 | §5.4 panel UI 유지 + 자동 등록 추가 | 낮음 (현 cycle 연장) | 부분 — Accept gate 만 자동 |
| B | paradigm shift (graph emergent) | schema.yaml standard_decompositions deprecate, §5.5 graph 가 ontology source | 중간 (Stage 1 일부 유지) | 통찰 4 (graph emergent) 만족 |
| C | 관망 | §5.10 자체 보류 | 0 (현 상태 유지) | 통찰 0건 만족 |
| **★ D-wide (v3 채택)** | **LLM-only (ontology layer + 7-type gate 제거)** | §5.4 Stage 1~4 + `ENTITY_TYPES`/`CONCEPT_TYPES`/`buildSchemaPromptBlock` 7-type gate 모두 deprecate, LLM 자율 entity/concept type 분류 | 높음 (~35~55 file, ~110 test) | **통찰 1~6 + C2/C3/C4 모두 정확 충족 (v3 명확)** |

## 3. 옵션 D 상세 spec (사용자 통찰 가장 정확 반영)

### 3.1 deprecate 대상

**code (D-wide v3 갱신)**:
- `wikey-core/src/canonicalizer.ts` — Stage 1 schema override 로직 (`BUILTIN_STANDARD_DECOMPOSITIONS` 포함) + 7-type 분류 prompt 분기 (`ENTITY_TYPES`/`CONCEPT_TYPES` 사용처). **minimal alias normalization 만 유지** (slug dedup, 다국어/약어/동명이인). 신규 LLM 자율 type extraction prompt 로 교체 (entity / concept *type* 자체를 LLM 자율 결정, prompt 가이드만 제공).
- `wikey-core/src/schema.ts` — **D-wide 갱신**:
  - 폐기: `standard_decompositions` parser 영역, `ENTITY_TYPES` / `CONCEPT_TYPES` 상수 (line 20~21), `ENTITY_TYPE_DESCRIPTIONS` / `CONCEPT_TYPE_DESCRIPTIONS`, `buildSchemaPromptBlock` (line 241~, line 245 = `'## 분류 스키마 (이 외 분류는 거부됨)'` prompt)
  - 보존: `pii_patterns` 영역 (별 layer), `aliases` 영역 (canonical slug normalization 보조)
- `wikey-core/src/types.ts` — **D-wide 갱신**: `EntityType`/`ConceptType` union 정의 폐기 (LLM 출력 자유 string 으로 대체). `Mention` / `WikiPage` 의 type 필드를 `string` 으로 완화.
- `wikey-core/src/schema-yaml-writer.ts` — `appendStandardDecomposition` 자체 폐기. (`appendCustomType` 도 7-type extension 용이라 D-wide 에서 무용 — 폐기).
- `wikey-core/src/suggestion-storage.ts` / `suggestion-detector.ts` / `suggestion-pipeline.ts` / `suggestion-panel-builder.ts` — 전체 폐기 (Stage 2).
- `wikey-core/src/self-declaration.ts` — 전체 폐기 (Stage 3).
- `wikey-core/src/convergence.ts` — 전체 폐기 (Stage 4).
- `wikey-obsidian/src/sidebar-chat.ts` — §11 의 panel UI 전체 폐기 (header button + openSuggestionsPanel + SchemaYamlModal + helpers).
- `scripts/qmd-embeddings-export.mjs` — §5.4.7 1순위 산출물. ConvergedDecomposition 자체 미사용 시 폐기 (또는 graph 시각화 보조로 유지 검토).
- `scripts/run-convergence-pass.mjs` (wikey-core/scripts) — Stage 4 entry-point. 폐기.

**file count 영향 (v3 갱신)**: D-narrow ~30~50 file → D-wide ~35~55 file (schema.ts / types.ts / canonicalizer.ts 의 7-type 사용처 추가 정정). test 폐기 ~100 → ~110 (entity/concept type 검증 test 추가 폐기).

### 3.1.1 D-wide ripple checklist (v4 신규, codex P2 fix + v5 R0/R5 보강 codex P2-2 fix)

> codex cycle #2 가 D-wide implementation entry 의 ripple coverage 부족 finding (P2). master 직접 grep 으로 영향 범위 식별 후 ripple 항목 명시 — implementation cycle 진입 시 본 checklist 가 AC gate. v5 cycle #3 가 R0 (extractMentions prompt) + R5 보강 (docs 추가 line) finding → master 추가 fix.

**(R0) `ingest-pipeline.ts` Stage 2 mention extractor prompt 정정 (v5 신규, codex P2-2 fix)**:
- `ingest-pipeline.ts:909~` `BUNDLED_STAGE2_MENTION_PROMPT` 의 `type_hint` 정의 (line 919 부근) — 7-type union (`organization`/`person`/`product`/`tool`/`standard`/`methodology`/`document_type`/`unknown`) 폐기 → LLM 자율 type 출력 (string 자유, prompt 가이드는 *예시* 만)
- 사용자 prompt 의 "❌ 분류하지 마세요" → 유지 (mention extraction 자체 의도). 단 "type_hint 8 종 union" → "type_hint string (LLM 자유, 예시: organization/person/methodology/algorithm/dataset/event 등)"

**(R1) `schema.ts` 추가 폐기**:
- `schema.ts:71~118` — `isValidEntityType` / `isValidConceptType` / `getEntityTypes` / `getConceptTypes` validation helpers (LLM 출력 type 의 BUILTIN/user 비교 로직 — D-wide 에서 모든 string type 자유 통과)
- `schema.ts:241~295` — `buildSchemaPromptBlock` (canonicalizer prompt 의 "## 분류 스키마 (이 외 분류는 거부됨)" 블록 생성 — 폐기 후 LLM 자율 type 가이드 prompt 로 교체)
- `schema.ts:289~354` — YAML parser 의 `entityTypes` / `conceptTypes` / `customTypes` section parser 폐기 (`aliases` / `pii_patterns` parser 만 보존)

**(R2) `canonicalizer.ts` 정정**:
- `canonicalizer.ts:235~236, :259` — `existingEntityBases ∪ existingConceptBases` 분리 → 단일 base name set 으로 통합 (entity/concept 분류 자체 폐기, LLM 이 type 자유 결정)
- `canonicalizer.ts:363~467` — `FORCED_CATEGORIES` (slug → entity/concept 강제 pin) + `detectAntiPattern` schema reject 로직 + `assembleCanonicalResult` 의 7-type 분류 검증 폐기. minimal alias normalization (`SLUG_ALIASES`, `canonicalizeSlug`, `dedupAcronymsCrossPool`) 만 잔존.
- `canonicalizer.ts:478~506` — `applyCrossLinks` (entity ↔ concept 자동 link H2) 보존 또는 단순화. D-wide 에서는 type 무관한 generic relation H2 로 변환 가능.

**(R3) `types.ts` 정정**:
- `types.ts:129~132` — `EntityType` / `ConceptType` union type 폐기 → `string` (또는 `string` alias)
- `types.ts:232~233` — `IngestRecord` 의 `entity[]` / `concept[]` 분리 → 단일 `mention[]` 또는 `wiki_page[]` (type field 가 string 으로 자유)
- `types.ts:299~302` — `Mention.type_hint` 의 union (`'organization'|'person'|...|'unknown'`) → `string` (LLM 자율 출력)
- `types.ts` 의 `WikiPage.type` (frontmatter `type:` field) 도 `'entity'|'concept'|'source'|'analysis'` union 인지 확인 필요. 보존 가능 — 이건 *카테고리* (4 종) 이지 7-type 의 type 분류 아님. wiki/entities/ vs wiki/concepts/ 디렉토리 구분과 직결, 폐기 시 디렉토리 구조 영향 → **D-wide v4 에서 보존 결정** (entity/concept 디렉토리는 wiki/ 의 자연 구조).

**(R4) `wikey-obsidian/src/settings-tab.ts` 정정**:
- `settings-tab.ts:1126~1132` — schema sample (사용자 vault 의 .wikey/schema.yaml 초기 생성용 sample) 의 `entity_types` / `concept_types` 예시 제거. aliases / pii_patterns 만 sample 표시.

**(R5) `docs/wikey-ingest-pipeline.md` 정정 (v5 보강, codex P2-2 fix — 추가 line)**:
- `wikey-ingest-pipeline.md:323~366` — Step 5/6 의 7 type 표 정정. D-wide 후 LLM 자율 type 출력으로 변경.
- `wikey-ingest-pipeline.md:369` — 7-type 분류 설명 정정 (D-wide 후 LLM 자율)
- `wikey-ingest-pipeline.md:398` — FORCED_CATEGORIES 설명 정정 (D-wide 후 폐기, alias normalization 만 잔존)
- `wikey-ingest-pipeline.md:712` — 결정성 표 (FORCED_CATEGORIES) 정정 (D-wide 후 폐기)
- `wikey-ingest-pipeline.md:140` — Cancel 흐름 (raw 그대로 종료) 보존 (C1 변경과 일치).

**(R6) `wiki-ops.ts` 정정 (확인 필요)**:
- `injectProvenance` 의 `type` field — 이건 `ProvenanceType` ('extracted' / 'manual' / 'cross-source-linked' 등) 으로 *별 축* (entity/concept type 무관). **D-wide 영향 X** — 보존.
- frontmatter `sources:` 배열 — D-wide 무관, 보존.
- frontmatter `type:` field — `entity` / `concept` / `source` / `analysis` (4 카테고리) — R3 결정 따라 보존.

**(R7) `query-pipeline.ts` 정정 (확인 필요)**:
- `SearchResult` / `Citation` 의 type 의존 — codex grep 결과 거의 없음. **D-wide 영향 X** — 보존.

**(R8) test 영향**:
- `__tests__/canonicalizer*.test.ts` — entity/concept 분류 / FORCED_CATEGORIES / drop logic test 폐기 또는 LLM 자율 출력 검증으로 변경 (~30 cases)
- `__tests__/schema*.test.ts` — buildSchemaPromptBlock / isValidEntityType / isValidConceptType test 폐기 (~15 cases)
- `__tests__/suggestion-*.test.ts` / `__tests__/convergence*.test.ts` / `__tests__/self-declaration*.test.ts` — Stage 2~4 폐기 (~50 cases)
- `__tests__/ingest-pipeline*.test.ts` — entity/concept type 분기 test 정정 (~15 cases)
- 합계 ~110 cases 폐기 (R8 합산이 §3.1 의 ~110 추정 정합)

**ripple 합산**: R1~R8 통합 시 D-wide implementation cycle 의 영향 file = ~35~55 (§3.1 추정 정합), 폐기 test = ~110 (§3.1 정합), Karpathy Surgical 적용 (인접 코드 / 무관 cleanup 금지).

**store** (v2 master grep `ls -la /Users/denny/Project/wikey/.wikey/` 2026-05-04 확정 — C2-부속 cross-check):
- `.wikey/suggestions.json` (현재 2762 bytes) — 폐기
- `.wikey/converged-decompositions.json` (현재 2095 bytes) — 폐기
- `.wikey/converged-decompositions.mock-baseline.json` (현재 10816 bytes) — 폐기
- `.wikey/qmd-embeddings.json` (현재 1.46 MB) — 폐기 (또는 graph 시각화용 retain)
- `.wikey/mention-history.json` (현재 8430 bytes) — 옵션 (graph 시각화 시 retain, 아니면 폐기)
- `.wikey/schema.yaml` (현재 889 bytes) — D-wide v4: `standard_decompositions` + `entity_types` + `concept_types` + `custom_types` section 모두 제거. **`aliases` / `pii_patterns` 만 보존** (각각 canonical slug normalization / PII 보호 — D-wide 와 무관한 별 layer).

**보존 store**:
- `.wikey/source-registry.json` (현재 6655 bytes) — incremental reingest §5.3 dependency, §5.4 무관, 보존.

**test (v4 갱신)**:
- `wikey-core/src/__tests__/` 의 약 **110 cases** 폐기 (Stage 1~4 unit + integration + 7-type schema gate test 추가 — entity/concept type validation, buildSchemaPromptBlock, isValidEntityType/isValidConceptType, FORCED_CATEGORIES). 회귀 baseline 732 → ~622 예상.

**plan / activity**:
- `plan/phase-5-todox-5.4-integration.md` — archive 또는 deprecation note 추가. 본 paradigm shift 결정 trace 보존.
- `plan/phase-5-todox-5.4.1-self-extending.md` — 동일.
- `activity/phase-5-result.md §5.4` — deprecation note 추가.

### 3.2 유지 대상 (LLM-백 위 4 layer, D-wide v3 갱신)

| layer | 위치 | 역할 (D-wide 정정) |
|-------|------|------|
| 1. raw → wiki organization | `ingest-pipeline.ts` Stage 0 (convertSourceToMarkdown / generateBrief / runIngestCore / wiki write) | 자료 인입 + classify + wiki 페이지 생성. **LLM 자율 entity/concept type 추출** (7-type schema gate 없이) |
| 2. canonical slug normalization | `canonicalizer.ts` minimal (D-wide) | alias dedup (다국어 / 동명이인 / 약어), file hash dedup. **type 분류 가이드 X** (LLM 출력 string type 그대로 보존, dedup 만 수행) |
| 3. LLM retrieval | qmd embedding + LLM 답변 (`query.ts` / `qmd` 통합) | 의미 검색 + 답변 합성. type 무관 (qmd 는 lexical + vector, type 의존 X) |
| 4. interface | `sidebar-chat.ts` (chat / dashboard / audit / ingest / help — Suggestions 폐기) | 사용자 UX. panel UI 의 schema 관리 gate 0 (Karpathy "사용자는 wiki 관리 X" 정확 충족) |

**D-wide 핵심 변화 (v3 명시)**: layer 1 의 entity / concept *type* 결정이 LLM 자율. 예: PMBOK 자료 ingest 시 `process` / `knowledge_area` 같은 type 자동 생성. 잡지 자료 ingest 시 `event` / `trend` 같은 type 자동 생성. wikey 가 *문서 유형 따라 자동 변경* — C3 정확 충족.

### 3.3 migration script

```bash
# scripts/migrate-deprecate-standard-decompositions.sh
# 1. .wikey/schema.yaml 의 standard_decompositions 영역만 → .wikey/manual-overrides.yaml 으로 분리
# 2. .wikey/suggestions.json / converged-decompositions.json / converged-decompositions.mock-baseline.json
#    / mention-history.json / qmd-embeddings.json 백업 후 제거
# 3. wiki/concepts/ 의 umbrella 자체 wiki page 가 component 로 분해되어 있으면 분해 정보 제거
#    (LLM 자동 작성 보존)
# 4. .gitignore 정리
# 5. (v2 추가) Suggestions panel header button + sidebar-chat.ts §11 코드 제거 — UI dead-code 정리
```

### 3.4 회귀 plan (v5 갱신)

- 폐기 test (~110 cases) 사전 식별 → grep `Stage [0-9]` / `umbrella` / `decomposition` / `Suggestion` / `ENTITY_TYPES` / `CONCEPT_TYPES` / `buildSchemaPromptBlock` / `FORCED_CATEGORIES`
- 잔여 test (~622 cases) baseline 확보 → migration 적용 → re-run → 0 fail 확증
- §5.2 (검색 / canonicalizer cross-link) / §5.3 (incremental reingest) 회귀 완전 0 — dependency 분리 가능 확증

### 3.5 라이브 검증 (master 직접, obsidian-cdp)

- ingest 1 fixture (PMBOK 같은 표준 자료) — schema.yaml 자동 등록 X 확증
- search 결과 — LLM 답변에 PMBOK / ISO 27001 등 표준 의미 매칭 정상 (qmd embedding + LLM 백)
- panel header button (clipboard_check) 미존재 확증
- canonicalizer alias normalization 정상 (lotus-pms / kim-myung-ho 같은 dedup)

## 4. 옵션 B (graph emergent) 상세 spec

> 옵션 D 만큼 급진적이지 않은 대안. graph 가 ontology source.

- `wikey-core/src/canonicalizer.ts` — alias normalization 강화 (Stage 1 schema 명시 입력 → graph node identity 자동)
- §5.5 (NetworkX + Leiden community detection) → ontology source 격상
- panel UI 폐기 또는 graph view 로 교체
- schema.yaml `standard_decompositions` deprecate (옵션 D 와 동일)
- 차이: Stage 2 detector 의 mention graph 누적 (mention-history.json) 은 graph source 로 유지

## 5. 옵션 A (점진) 상세 spec

> 가장 가벼운 path. 본 cycle 연장.

- ingest pipeline 의 high-confidence 후보를 schema.yaml 직접 append (panel Accept 우회)
- threshold split (high 자동 / low panel)
- audit log (`.wikey/standard-audit.json`)
- panel rename `Suggestions` → `Knowledge audit`
- §5.4 본체 보존 + Stage 2/3/4 detector 보존

## 6. 사용자 결정 시점 / 책임

- 본 §5.10 = main subject 격 issue 등록.
- 사용자가 다음 세션 시작 시 옵션 A/B/C/D 명시 후 진입.
- master 가 옵션별 cost / 정당성 비교표 제공 (본 문서 §2 + §3.4 회귀 plan + §11~§13 v2 갱신).
- 옵션 결정 후 detail spec (본 §3 또는 §4 또는 §5) 따라 cycle 진행.
- **C1 (§10) 은 옵션 결정과 분리 — 단독 cycle 진행 가능**.

## 7. 7-anchor self-check (mini plan 자체, v5.3 갱신)

| # | Anchor | v5.3 검증 결과 | 검증 명령 / 위치 |
|---|--------|-----------|----------------|
| (a) | 시그니처 일관성 — deprecate 대상 file/store list 와 mirror 일치 + v3 의 D-wide 7-type gate (`schema.ts:20~21`, `:241~`, `:245`) 와 코드 grep 일치 + v4 mirror 정정 + v5 cache callsite 3 곳 (`ingest-pipeline.ts:1504/1568/1782`) 코드 grep 일치 + v5 R0 (`ingest-pipeline.ts:919~921 type_hint`) 코드 grep 일치 + v5 C5 root cause (`query-pipeline.ts:386`) + intercept 위치 (`sidebar-chat.ts:2830~2858`) 코드 grep 일치 + disk root 0-byte md 10 개 ground truth 일치 | ✅ | `ls -la .wikey/` 7 file + `grep -n` 모두 line-level 정확 + `find . -maxdepth 1 -size 0c -name "*.md"` 10 개 |
| (b) | state/data 표 형식 — 4 옵션 비교 + LLM-백 4 layer + v2 §0 5 concern (v5 갱신) + v3 §0.1 D-narrow vs D-wide + §10 (C1) 통합 vs 현 + §11 4 concern → 정당성 + §12 Karpathy 8 원칙 + §13 옵션 일치도 + §14 (C5) root cause / 3 단계 spec / AC 표 모두 일관 | ✅ | 본 §0 / §0.1 / §2 / §3.2 / §10.3 / §11 / §12 / §13 / §14 |
| (c) | builder/parser 분기 — migration 단계 5 + 회귀 plan + 라이브 검증 + §10.4 (D-wide v3 정정) + §14.2 C5 3 단계 (Prevention/Intercept/Cleanup) + R0~R8 ripple 명시 | ✅ | §3.3 / §3.4 / §3.5 / §3.1.1 / §10.4 / §14.2 |
| (d) | AC test — C1 AC 1~7 (§10.5 v5 보강 — Cancel vault write 0 + AC-C1.7 cache callsite migration) + C5 AC 1~4 (§14.3 v5 신규 + v5.1 정확화 — renderMarkdown handler resolve-before-open + Untitled.md 분기). D-wide implementation AC 는 옵션 결정 후 (pending) | C1 AC 7 항목 ✅ + C5 AC 4 항목 ✅ + D-wide AC pending (사용자 cycle 종료 후) | §10.5 / §14.3 |
| (e) | self-check drift — v1 본문 (§1~§9) 보존 + v2 신규 (§0/§10/§11/§12/§13/§14_footer) + v3 in-place + v4 in-place + v5 in-place (§14 C5 신규) + v5.1 in-place (numbering) + v5.2 in-place (§14.2 본문 + AC-C5.3 root-only) + v5.3 in-place (§7 갱신 + parent/activity migration cost 동기화). 다른 §5.X 변경 X | ✅ — 모든 버전 본문 보존, in-place 정정 위치 §15 변경 이력 명시 |
| (f) | footer + cycle — header v5.3 (2026-05-04) ↔ 변경 이력 ↔ §15 footer 일관 + cycle #7 입력 명시 + parent/activity mirror migration cost 동기화 (35~55 file / ~110 test) | ✅ | 본 문서 header / §15 / 마지막 PLAN_FILE+VERDICT + phase-5-todo.md:918 + activity/phase-5-result.md:1441 grep 일치 |
| (g) | 코드 ↔ test exact phrase — C1 진입 시 test assert (`extractPdfText 호출 횟수 ≤ 1`, `Cancel 후 vault hash diff 0`, `convertSourceToMarkdown pure 보장 — vault write 0`, `cache hit 후 sidecarCandidate 정확`, `cache callsite 3 곳 atomic migrate`). D-wide 진입 시 (`buildSchemaPromptBlock 미호출`, `LLM 자율 type 출력 정상`, `EntityType/ConceptType union string 완화`, `FORCED_CATEGORIES 분기 미실행`, `extractMentions type_hint string 자유`). C5 진입 시 (`getFirstLinkpathDest null 시 Notice + 자동 생성 0`, `[Available pages] block 명시`, `unresolved entity plain text 출력`) | pending — 진입 후 적용 | §10.5 / §14.3 / §3.1.1 |

## 8. 다음 master 액션 (v5.4 갱신, cycle #1~#7 누적 후 마지막 cycle #8 진행 중)

1. 본 §5.10 v5.4 + mirror (phase-5-todo §5.10 + activity/phase-5-result.md v5.4/cycle #8 갱신) commit + push (사용자 결정)
2. codex Mode D Panel cycle #8 검증 (cycle #7 P3 3건 fix 정합 확증 — §8/§9.4/mirror)
3. cycle #8 APPROVE 시:
   - C1 (§10) 단독 implementation cycle 즉시 개시 가능 (옵션 D-wide 와 분리, AC-C1.1~AC-C1.7 정량 gate)
   - D-wide implementation cycle 별도 (analyst → 폐기 file ~35~55 식별 + migration script + ~110 test 폐기 plan + 회귀 baseline 보호)
   - C5 (§14) cleanup 즉시 진행 (root 9개 0-byte .md `rm` + Untitled.md 사용자 확인)
4. cycle #8 NEEDS_REVISION 시: 사용자 명시 — 무조건 v5.4 보존 + 종료 (cycle pattern 8 회 누적, 구조적 risk 인식). minor stale 은 implementation cycle 진입 시 자연 정리.

## 9. 정당성 검증 — §5.4 가 없으면 wikey 가 지식 관리 가능한가? (2026-04-26 사용자 명시, v1 보존)

> **사용자 질문**: "만약 지금의 표준 분해 패턴이 없으면 현재의 wikey 는 지식 관리를 할 수 없는 거야? 그 이유도 같이 설명."

### 9.1 결론

**아니오 — §5.4 가 없어도 wikey 는 정상 작동.** 핵심 기능 영향 없음. 외부 정형 표준 (PMBOK / ISO 27001) 자료의 component 분해 정확도만 약간 영향 (LLM 자율 분해로 대체 가능).

### 9.2 wikey 의 핵심 기능 ↔ §5.4 의존성 매트릭스

| 핵심 기능 | §5.4 의존? | 의존 수준 | §5.4 deprecate 시 영향 |
|----------|-----------|----------|---------------------|
| **raw → wiki ingest** (자료 인입 + classify + 페이지 생성) | ❌ 무관 | 0% | 영향 없음 (Stage 0 ingest pipeline 의 wiki write 가 기본 동작, schema 미적용 가능) |
| **wiki/concepts·entities 페이지 생성** | △ 약함 | ~5% | LLM 이 자율 추출 (canonicalizer 의 LLM extraction). 명시 schema 없어도 entity / concept 추출 정상. PMBOK 같은 외부 표준의 사전 정의된 분해 가이드만 손실 — LLM 이 자율 분해 |
| **alias normalization** (다국어 / 동명이인 / 약어) | △ 약함 | ~10% | canonicalizer 의 minimal alias 보존 (옵션 D 의 §3.2 layer 2). schema.yaml 의 `aliases` 영역도 보존 (standard_decompositions 만 제거). dedup 정상. |
| **wikilink graph** (entity ↔ concept 자연 link) | ❌ 무관 | 0% | wikilink 는 LLM 답변에 의해 자연 생성, schema 의존 X |
| **검색 — qmd embedding + LLM 답변** | ❌ 무관 | 0% | qmd 자체가 LLM 의미 백, schema 의존 X. 같은 표준의 다른 표기 ("ISO 27001" / "iso-iec-27001-2022") 자동 의미 매칭 |
| **답변 1-hop wikilink expansion** (§5.2) | ❌ 무관 | 0% | 단순 wikilink 그래프, schema layer 위 |
| **canonicalizer cross-link** (entity ↔ concept) | ❌ 무관 | 0% | §5.2 의 자동 cross-link, schema standard_decompositions 의존 X |
| **chat / dashboard / ingest / audit UX** | ❌ 무관 | 0% | UI layer, schema standard_decompositions 의존 X |
| **PII protection** | ❌ 무관 | 0% | schema.yaml 의 `pii_patterns` 영역 보존 (standard_decompositions 만 제거) |
| **incremental reingest** (§5.3) | ❌ 무관 | 0% | hash 기반 dedup, schema 의존 X |

### 9.3 §5.4 의 *유일한* 가치 영역

PMBOK / ISO 27001 / ITIL 같은 **이미 정형화된 외부 표준** 자료를 ingest 할 때:

- **with §5.4**: PMBOK 의 10 knowledge areas 가 schema.yaml 에 명시되어 있어 정확히 10 페이지로 분해. require_explicit_mention 으로 LLM 의 추측 차단.
- **without §5.4**: LLM 이 자율 분해. 보통 8~12 페이지 정도로 분해 (정확도 ~85%, hallucination 가능성 약간). 다만 후속 ingest 와 cross-source cluster 가 자동 보정.

⇒ §5.4 의 가치 = 외부 정형 표준의 component 분해 정확도 약 +10~15%. 일반 자료 (잡지 / 메모 / 임의 PDF) 에는 가치 0 (사용자 통찰 5번 — "세상 수많은 지식을 어떻게 표준화").

### 9.4 옵션 D 시 손실 vs 이득

**손실** (옵션 D 시):
- 외부 정형 표준 자료의 component 분해 정확도 ~10~15% 감소 (LLM 자율 분해의 hallucination 가능성)
- Stage 4 cluster 의 cross-source convergence (예: ISO 27001 / iso-iec-27001-2022 / ISMS 한 페이지 통합) — 자동 alias merging 으로 대체 가능 (canonicalizer 강화)

**이득** (옵션 D-wide v5.4 갱신, §3.1.1 R1~R8 ripple 일치):
- ~35~55 file 변경 폐기로 코드 단순화 (maintenance cost ↓)
- panel UI / schema 사용자 인지 부담 0
- §5.4 self-extending 명명의 misleading 해소
- LLM 백의 자연 의미 매칭 + qmd embedding cluster 가 component 분해 정확도 손실 일부 보상
- 사용자가 외부 정형 표준 자료 외 일반 지식 관리 (메모 / 잡지 / 임의 자료) 에 wikey 사용 시 **§5.4 의 한계 (PMBOK 류에만 fit) 자체가 사라짐**

### 9.5 결론 정당성

> 사용자 통찰 6번 ("LLM 백 위에서 움직이는 건데") 의 정당성:
>
> wikey 의 *핵심 가치* = LLM + qmd embedding + wiki organization. §5.4 standard_decompositions 는 *외부 정형 표준 분해 정확도 보조* 의 한정 가치 — 본질적 의존 X. 옵션 D 채택 시 외부 정형 표준 자료의 정확도 ~10~15% 감소 손실은 LLM 자율 분해 + canonicalizer alias merging + qmd embedding cluster 로 대체 가능. 일반 지식 관리에는 §5.4 가 처음부터 가치 없음 (사용자 통찰 5번 — 지식 분해 epistemology 한계).
>
> ⇒ **§5.4 가 없어도 wikey 는 지식 관리 가능**. §5.4 = 외부 표준 정확도 보조 layer (한정), 본질적 dependency X.

---

## 10. C1 — Step 2/3 conversion 통합 (v2 신규, 옵션 무관 efficiency issue)

> **사용자 raise**: "ingest summary를 별도의 extractPDFText(stripped만 사용)을 할게 아니라, step3에서 파일 유형에 따른 converting은 필수조건이므로 컨버팅을 1-step으로 진행하는게 바람직해 보임"
>
> **분류**: 옵션 A/B/C/D 와 직교. 어느 옵션 채택해도 적용 가치. **단독 cycle 가능**.

### 10.1 현 코드 진단 (master grep 2026-05-04 ground truth)

| 위치 | line | 동작 |
|------|------|------|
| `wikey-core/src/ingest-pipeline.ts:357~364` | Step 3 (ingest 본 흐름) | `if (ext === 'pdf') { const pdfResult = await extractPdfText(...); sourceContent = pdfResult.stripped; pdfSidecarCandidate = pdfResult.sidecarCandidate }` |
| `wikey-core/src/ingest-pipeline.ts:1211~1220` | Step 2 (brief 흐름) | `if (isPdf) { const { stripped } = await extractPdfText(...); content = stripped }` (sidecarCandidate 무시) |
| `wikey-obsidian/src/commands.ts:346~363` | UI controller | brief 흐름 → modal open → `generateBrief()` (별 호출) → 사용자 input 대기 → `runIngestCore()` (다시 ingest 호출 → 다시 extractPdfText) |
| `wikey-core/src/convert-cache.ts` (`computeCacheKey`) | cache layer | sourceBytes + converter + majorOptions 기반 cache key. 같은 PDF 동일 키 → ingest 시 cache hit |

### 10.2 진단 — 중복 호출 정확한 본질

**표면 관찰**: `extractPdfText` 가 한 ingest cycle 안에 2 번 호출된다 (brief + ingest).

**실제 영향** (cache layer 고려):
- **첫 호출 (brief)**: cache miss → docling tier 1 실행 (PDF 1~10 초) → `setCached(stripped)`.
- **둘째 호출 (ingest)**: cache hit (같은 sourceBytes) → 즉시 return `{ stripped: cached, sidecarCandidate: cached }` (`ingest-pipeline.ts:1786`).

**그러나 사용자 concern 의 본질** (3 가지 결함):

| 결함 | 위치 | 영향 |
|------|------|------|
| (a) **brief 의 비-PDF 포맷 누락 + 분기 산재** (v3 codex P2 fix) | brief 흐름 (`ingest-pipeline.ts:1211`) 은 PDF만 `extractPdfText`, **HWP/DOCX/PPTX/XLSX/HTML 등은 `wikiFS.read()` 로 raw bytes 직접 read** (변환 X — binary 그대로 LLM 입력될 위험). ingest 흐름 (`ingest-pipeline.ts:357~375`) 은 PDF/HWP/Docling 모두 분기. *동일 분기 spec 이 2 곳에 산재 + brief 가 일부 포맷 미지원* | 유지보수 시 한 쪽 빠짐 risk + brief 가 HWP/DOCX 의 binary 를 LLM 에 직접 보내는 결함 (현재는 사용자가 PDF 만 brief 사용해서 묻혀 있음) |
| (b) **sidecarCandidate 정보 손실** | brief 시 `extractPdfText` 가 `{ stripped, sidecarCandidate }` 모두 계산하지만 brief 는 `stripped` 만 사용. cache 는 stripped 만 저장. ingest 에서 cache hit 하면 `sidecarCandidate = stripped` 로 잘못 설정 (raw 가 아닌 stripped) (`ingest-pipeline.ts:1786`) | vector PDF 의 raw 이미지 sidecar 가 stripped 로 대체됨 — sidecar 품질 저하 |
| (c) **Karpathy Simplicity 위반** | "Step 3 conversion 은 필수, Step 2 는 사용자 brief 시 *그것의 산물* 을 활용" 이 자연스러운 의존 방향. 현 코드는 *역방향* (Step 2 가 자기 conversion 호출, Step 3 가 cache 통해 다시 호출) | 신규 conversion 추가 시 양쪽 손대야 함 |

### 10.3 해결안 — `convertSourceToMarkdown` = pure conversion only (v3 codex P1-1 정정)

**원칙 (v3 정정)**: conversion 은 "순수 markdown 추출 1 단계" 로 분리 — `convertSourceToMarkdown` 은 *결정적 변환 결과 (markdown + sidecarCandidate)* 만 반환. **PII gate / sidecar write / reingest decision / protect 결정은 모두 ingest() 내부 잔존**.

> **codex P1-1 finding 반영**: v2 plan 의 흐름도가 sidecar write 를 brief 전에 배치 → Cancel 시 disk 에 sidecar 남는 결함. 현 코드 invariant (sidecar write = `decideReingest` decision + protect 분기 후, `ingest-pipeline.ts:421` 부근) 보존 필수.

**의사 흐름도 (D-wide v3)**:

```
사용자: raw 파일 선택
   │
   ▼
[1. Pure Conversion (UI/CLI 공통 entry)]
   │   conversionResult = await convertSourceToMarkdown(sourcePath, ext, opts)
   │     → PDF / HWP / DOCX / md / txt 분기 (한 곳, ingest-pipeline.ts:357~375 흡수)
   │     → returns ConversionResult { content, sidecarCandidate?, ext, converter }
   │   ※ vault write 0 (raw/wiki/.wikey 변경 0), PII gate 0, registry diff 0 — pure
   │   ※ cache write 는 ephemeral (~/.cache/wikey/convert/, vault 외부, 30일 TTL)
   │
   ▼
[2. Brief (already-converted content 기준)]
   │   generateBrief(conversionResult.content, sourceFilename, config, http, opts)
   │     → extractPdfText / extractHwpText 호출 X (이미 변환됨)
   │     → PII gate (sample 6KB sanitize) → LLM brief
   │   사용자: brief 검토 + guide hint 입력
   │
   ├─► (Cancel) → 흐름 종료. **vault write 0** (raw 그대로 + .wikey/ + wiki/ 변경 0). cache file 은 ephemeral 보존, conversionResult 휘발.
   │
   ▼ (Proceed)
[3. ingest(conversionResult, ...) — 기존 ingest() 흐름 유지]
   │   ① readRawDiskBytes (registry hash 비교용)
   │   ② decideReingest (registry diff + conflicts) → action ∈ {force, protect, prompt, skip, skip-with-seed}
   │   ③ skip / skip-with-seed → 종료 (LLM 0 콜, sidecar write 0)
   │   ④ prompt → 사용자 선택 (overwrite / preserve / cancel)
   │   ⑤ force / protect →
   │        - PII gate (sourceContent + sidecarCandidate)
   │        - sidecar write (canonical OR .new[.N] — protect 분기 결과 따라)
   │        - Stage 1+2 (summary + mention LLM)
   │        - Stage 3 canonicalize LLM (D-wide: type 자율)
   │        - wiki page write + index + log
   │        - registry update (sidecar_hash 갱신)
```

vs 현재 (변경 전):

```
[Brief 흐름 (commands.ts:346~363)]   [Ingest 흐름 (commands.ts → runIngestCore)]
generateBrief(sourcePath)             runIngestCore(sourcePath)
   │                                     │
   ├─ if PDF: extractPdfText (cache miss)├─ readRawDiskBytes
   ├─ else: wikiFS.read (HWP binary !)   ├─ decideReingest
   └─ brief LLM                          ├─ if PDF: extractPdfText (cache HIT, but sidecarCandidate=stripped 결함 b)
                                         ├─ if HWP/Docling: extract*Text (cache miss, brief 미수행 자료)
                                         ├─ PII gate
                                         ├─ sidecar write (force / protect)
                                         └─ Stage 1~3 + write
```

**v3 변경 본질**: 변환 단일화 + brief 가 변환 결과 받기 + sidecar write 시점은 *그대로 ingest() 내부 (decideReingest 후)* 보존.

### 10.4 변경 spec (코드 file path + 변경 후 의사 흐름, v3 codex P1-1/P2 정정)

**신규 file** (변경 전 0):
- `wikey-core/src/conversion.ts` — `convertSourceToMarkdown(sourcePath, ext, opts) → ConversionResult` 단독 entry. extractPdfText / extractHwpText / extractDocumentText / readMd 4 분기 흡수. cache layer 통합. **PII gate / sidecar write / registry diff 책임 X — pure conversion only** (codex P1-1 fix).

**기존 변경**:
- `wikey-core/src/ingest-pipeline.ts:357~375` — Step 3 분기 코드 → `convertSourceToMarkdown` 1 줄 호출로 대체. **decideReingest / PII gate / sidecar write 로직 그대로 유지** (Step 4~7 책임, 시점 불변).
- `wikey-core/src/ingest-pipeline.ts:1197~1248` — `generateBrief` 시그니처 변경:
  - **변경 전**: `generateBrief(sourcePath, wikiFS, config, http, opts)` — 자체 extractPdfText (PDF 만, HWP/DOCX binary 누락 — codex P2)
  - **변경 후**: `generateBrief(content, sourceFilename, config, http, opts)` — 변환 *결과* 받음. **HWP/DOCX/PPTX/HTML 등 모든 포맷 brief 지원** (P2 fix)
- `wikey-core/src/ingest-pipeline.ts:235~430` — `ingest()` 시그니처에 `preconverted?: ConversionResult` optional 추가:
  - 있으면 Step 0 의 `convertSourceToMarkdown` 재호출 skip (UI 흐름에서 brief 가 이미 변환했음을 신호)
  - 없으면 기존 흐름 (CLI / 테스트 / forceReingest 케이스)
  - **decideReingest 는 항상 raw bytes 기준** (preconverted 와 무관, registry hash invariant 보존)
- `wikey-obsidian/src/commands.ts:346~363` — UI flow 수정:
  - **변경 전**: `modal.open() → generateBrief(sourcePath) → user input → runIngestCore()` (재변환)
  - **변경 후**:
    ```ts
    modal.open()
    const conversionResult = await convertSourceToMarkdown(sourcePath, ext, opts)  // 1 회
    generateBrief(conversionResult.content, sourceFilename, ...).then(modal.setBrief)
    const briefOutcome = await modal.awaitBrief()
    if (briefOutcome.action === 'cancel') {
      modal.close()
      return { success: false, sourcePath, createdPages: [], cancelled: true }  // vault write 0 (codex P1-1 invariant; cache write ephemeral 허용)
    }
    runIngestCore(sourcePath, { preconverted: conversionResult, ... })  // 재변환 X
    ```
- `wikey-core/src/conversion.test.ts` — 신규 unit test (`convertSourceToMarkdown` 5 분기 (PDF/HWP/Docling-doc/md/txt) + cache 통합 + pure 보장 (sidecar 미생성)).

**삭제 (Karpathy Surgical 적용)**:
- `wikey-core/src/ingest-pipeline.ts:1214~1217` (brief 의 PDF 분기 + HWP/DOCX 누락 코드) — `convertSourceToMarkdown` 으로 위임.

**보존 (변경 X)**:
- `extractPdfText` / `extractHwpText` / `extractDocumentText` 자체는 `conversion.ts` 의 *내부 helper* 로 보존 (외부 export 도 보존, 다른 consumer 가 있을 가능성 — grep 으로 확증 후 결정).
- cache layer (`convert-cache.ts`) 그대로. brief 변경 후 호출 1 회로 줄어 cache miss 도 1 회로 단축 — 결함 (b) sidecarCandidate 손실 자동 해소.
- **decideReingest + protect 분기 + sidecar write 시점 불변** (codex P1-1 invariant 명시 보존). `ingest-pipeline.ts:235` (decideReingest 위치) ~ `:421` (sidecar write 위치) 흐름 그대로.

### 10.5 acceptance criteria (C1 단독 cycle, v4 P1-1/P1-3/P2 보강 + AC-C1.7 신규)

| AC | 검증 |
|----|------|
| **AC-C1.1** (v5 정확화) | `wikey-core/src/conversion.ts` 신규 export `convertSourceToMarkdown(sourcePath, ext, opts) → ConversionResult { content, sidecarCandidate?, ext, converter }`. 5 분기 (PDF / HWP / DOCX-Docling / PPTX-Docling / md/txt) 통합. unit test ≥ 10 cases (각 분기 happy + error + cache hit). **vault write 0 보장**: 함수 내부에서 vault 디렉토리 (`raw/` / `wiki/` / `.wikey/`) write / registry update / PII gate 호출 0 (mock fs spy 검증, vault 경로만). cache write (`~/.cache/wikey/convert/`) 는 함수 책임이지만 vault 외부 ephemeral, separate test (`AC-C1.7` 의 cache schema 검증) 에서 다룸. |
| **AC-C1.2** | `generateBrief` 시그니처 변경 (content / sourceFilename 입력) + extractPdfText / extractHwpText 호출 0. **HWP/DOCX brief 변환 정상**: HWP/DOCX 1 ingest cycle 에서 brief 가 *변환된 markdown* 으로 LLM 호출 (binary 미전송) — integration test 1 case + 라이브 smoke 1 case. unit test ≥ 5 cases (PDF/HWP/DOCX/md/txt content 직접 주입). |
| **AC-C1.3** | `wikey-obsidian/src/commands.ts:346~363` 수정 — conversion 1 회 + brief + ingest 가 같은 `ConversionResult` 공유. integration test (mock fs + mock LLM): PDF 1 회 ingest cycle 에서 `extractPdfText` 호출 횟수 ≤ 1 회 (현 ≥ 2 회). HWP / DOCX 도 동일 (`extractHwpText` ≤ 1 / `extractDocumentText` ≤ 1). |
| **AC-C1.4** (codex P1-1, **v4 정확화**) | **Cancel 시 vault write 0 invariant** (cache write 는 ephemeral 허용): `briefOutcome.action === 'cancel'` 분기에서 *vault 디렉토리* (`raw/` / `wiki/` / `.wikey/`) 변경 0 — sidecar canonical / `wiki/sources/` / `.wikey/source-registry.json` 모두 변경 X. **`~/.cache/wikey/convert/` 의 cache file write 는 허용** (변환 결과 ephemeral 보존, 다음 ingest 재사용). integration test 1 case (Cancel 후 vault hash diff 0, cache file 존재 가능). 라이브 smoke 1 case (PDF brief 표시 → Cancel → vault 변경 0 확증, cache file 자동 cleanup 30일 TTL). |
| **AC-C1.5** (codex P1-1) | **`decideReingest` + `sidecar write` 시점 불변**: `ingest()` 내부 흐름 (line 235 decideReingest → line 421 sidecar write) 그대로 — `preconverted` optional 주입이 이 시점에 영향 X. integration test (force / protect / skip / skip-with-seed 4 시나리오 모두 기존 동작 유지). |
| **AC-C1.6** (v5 산술 정정, codex P2-1 fix) | 회귀 baseline `npm test` 732 PASS → ≥ **751** (신규 ≥ **19 cases** — AC-C1.1 의 10 + AC-C1.2 의 5 + AC-C1.4 의 1 + AC-C1.5 의 1 + AC-C1.7 의 ≥ 2). build 0 errors. 라이브 cycle smoke (master 직접 obsidian-cdp): PDF + HWP + DOCX 각 1 ingest → brief 정상 표시 + ingest 완료 + sidecar canonical write 정상 (vector PDF 면 raw 이미지 보존 — 결함 (b) fix 확증). |
| **AC-C1.7** (codex P1-3 + v5 risk j 보강) | **PDF sidecarCandidate cache-hit 결함 fix** + **모든 cache callsite migration** (현 `ingest-pipeline.ts:1786` `return { stripped: cached, sidecarCandidate: cached }` 결함 b 의 직접 fix): <br>**(1) cache schema 갱신**: `setCached(key, content, sidecarCandidate?, meta)` + `getCached(key) → { content, sidecarCandidate? } \| null`. cache file 형식 = JSON `{ content: string, sidecarCandidate?: string }` (단순 string → object). <br>**(2) cache callsite 3 곳 모두 migrate** (v5 risk j): <br>&nbsp;&nbsp;&nbsp;- `ingest-pipeline.ts:1504` (unhwp `getCached(cacheKey)`) — 신규 schema 따라 `{ content }` 받음, sidecarCandidate undefined 처리 <br>&nbsp;&nbsp;&nbsp;- `ingest-pipeline.ts:1568` (docling-doc `getCached(cacheKey)`) — 동일 <br>&nbsp;&nbsp;&nbsp;- `ingest-pipeline.ts:1782` (pdf-cache-hit `getCached(doclingKey)`) — `{ content, sidecarCandidate }` 모두 사용 <br>&nbsp;&nbsp;&nbsp;- `convert-cache.ts:setCached/getCached` 시그니처 변경 + 모든 caller 동시 fix (atomic 변경) <br>**(3) backward compat**: 기존 cache file (string 형식, JSON.parse 실패) 은 `{ content: rawString, sidecarCandidate: rawString }` 폴백 (legacy 호환). <br>**(4) test**: ≥ 2 cases (vector PDF / scan PDF cache hit 후 sidecarCandidate 정확) + cache callsite migration 검증 1 case (3 callsite 모두 새 schema 호환). |

### 10.6 trade-off

| 트레이드 | 평가 |
|---------|------|
| **+** 코드 중복 제거 (분기 1 곳) | Karpathy Simplicity / Surgical |
| **+** sidecarCandidate 정보 손실 (결함 b) 자동 해소 | sidecar 품질 향상 |
| **+** brief UI 응답 속도 동일 (cache hit + miss 패턴 동일) | 사용자 영향 0 |
| **-** generateBrief 시그니처 breaking change | external consumer 가 wikey-obsidian/commands.ts 단 1 곳 (grep 확증) — 영향 최소 |
| **-** test re-fixture | ≥ 8 신규 + 3 갱신 — 약 2~3 시간 작업 |

⇒ **C1 진행 권장**. 단독 cycle, 옵션 결정과 무관.

---

## 11. C2/C3/C4 — 옵션 D 보강 매핑 (v2 신규)

본 섹션은 사용자 5 concern (v5 갱신, C5 별 §14) 중 C2/C2-부속/C3/C4 가 옵션 D 의 어느 layer 를 정당화하는지 정밀 매핑. C1 → §10, C5 → §14 (별 섹션).

### 11.1 C2 — 표준화 reductionism vs LLM 자율

> **사용자 raise**: "내부적으로 entities/concepts등의 개념을 LLM을 이용해서 충실하게 생성하고 확장할 수 있음에도 표준화라는 개념으로 후보풀, mention, canonicalization, schema.yaml, built-in-standard-decomposition(4entities+3concept type으로 제한) > 거부시의 프로세스 추가 (자율적 생성과 확장이 더 중요하게 아닌가?)"

**옵션 D 매핑**:

| 사용자 우려 | 옵션 D §3.1 deprecate 항목 | chain # |
|------------|------------------------|---------|
| "후보풀" (suggestion candidate pool) | `suggestion-storage.ts` / `suggestion-detector.ts` (Stage 2) | 1, 2 |
| "mention" (mention extractor 자체가 아니라, mention 후처리 standardization) | `convergence.ts` (Stage 4 cluster mention 기반 표준 후보 생성) | 4 |
| "canonicalization" (= "표준화") | `canonicalizer.ts` 의 standard_decomposition 분기 (BUILTIN + user yaml). 단, **minimal alias normalization** 은 보존 (옵션 D §3.2 layer 2) | 1, 5 |
| "schema.yaml" (standard_decompositions section) | `schema.ts` 의 parser 영역 + `.wikey/schema.yaml` 의 standard_decompositions section | 5 |
| "built-in-standard-decomposition (4 entities + 3 concept type 으로 제한)" | `BUILTIN_STANDARD_DECOMPOSITIONS` 상수 (PMBOK 등) + `schema.ts` BUILTIN type union | 3, 5 |
| "거부 시의 프로세스 추가" | `suggestion-pipeline.ts` 의 negativeCache + `detectAntiPattern` schema reject | 1 |

**자율적 생성·확장 이전 (D-wide v3)**: canonicalizer 가 **`schema.ts` 의 7-type 분류 prompt 자체를 deprecate** (`buildSchemaPromptBlock` + `ENTITY_TYPES` + `CONCEPT_TYPES` + `ENTITY_TYPE_DESCRIPTIONS` + `CONCEPT_TYPE_DESCRIPTIONS` 폐기) → LLM 자율 entity / concept *type* 추출. 신규 prompt 는 type 가이드 *예시* (organization / person / methodology 등) 만 제공하고, "이 외 분류는 거부됨" 강제 prompt 제거. LLM 이 입력 문서 유형에 따라 새 type (`algorithm`, `dataset`, `event`, `trend` 등) 자율 생성. 옵션 D §3.2 layer 1 (raw → wiki organization) 가 이 자율성을 직접 구현 — schema 명시 X 에서도 LLM 이 entity / concept 분류 + 새 type 생성 정상 (§9.2 매트릭스 검증 + §0.1 D-wide 정당성 표).

**v2 → v3 정정 trace**: v2 §11.1 가 "BUILTIN 7 type 제약 없이 LLM 자율" 라고 *주장* 했지만 v2 §11.3 가 "entity_types/concept_types 보존 + 7-type prompt guide 유지" 로 모순. codex P1-2 finding 정확. v3 = D-wide 일관 정의 — 7-type schema gate 자체 deprecate.

### 11.2 C2-부속 — `.wikey/*.yaml` + `*.json` 과다

> **사용자 raise**: "2)번의 연장선상으로 내부 기준을 불필요하게 많이 생성하고 있는데, 특히 .wikey/schema.yaml, *.json들"

**옵션 D 매핑** (master 가 `ls -la /Users/denny/Project/wikey/.wikey/` 2026-05-04 직접 확증):

| 현 file | 크기 | 옵션 D 처리 | 정당성 |
|---------|------|----------|------|
| `schema.yaml` | 889 B | D-wide v5: `standard_decompositions` + `entity_types` + `concept_types` + `custom_types` section 모두 제거. **`aliases` / `pii_patterns` 만 보존** | aliases = canonical slug normalization (LLM 자율 type 분류와 별 layer), pii_patterns = PII 보호 (핵심 보안) |
| `suggestions.json` | 2762 B | **폐기** | Stage 2 store, panel UI 없으면 무용 |
| `converged-decompositions.json` | 2095 B | **폐기** | Stage 4 store |
| `converged-decompositions.mock-baseline.json` | 10816 B | **폐기** | Stage 4 mock baseline |
| `mention-history.json` | 8430 B | **선택 폐기** (graph 시각화 옵션 채택 시 retain) | Stage 2/4 detector input |
| `qmd-embeddings.json` | 1.46 MB | **선택 폐기** (graph 시각화 옵션 채택 시 retain) | Stage 4 vector cluster input |
| `source-registry.json` | 6655 B | **보존** | §5.3 incremental reingest dependency, §5.4 무관 |

⇒ 옵션 D 채택 시 6 file 중 3~5 file 폐기. 사용자 부담 ↓. 보존 file (`schema.yaml` aliases / pii_patterns + `source-registry.json`) 은 *기능 dependency* 가 명확.

### 11.3 C3 — Self-extending 틀 강제 vs 자율 확장 정의

> **사용자 raise**: "Self-extending에도 지식 자율 확장에 대한 정의만 필요하지, schema.yaml에 특정한 틀안으로 뭔가 지식을 꾸겨넣은듯 한 느낌이 있음. 모든 것은 내부에 들어오는 지식, 문서의 유형에 따라 계속 분류값이나 지식확장 기준이 자동 변경되고 확장되어야함."

**옵션 D 매핑** (chain 2 + 4 직접 확장):

| 현 §5.4 self-extending 측면 | 사용자 비판 | 옵션 **D-wide** 응답 (v3) |
|------------------------|----------|-----------|
| "Self-extending" 명명 | 약속 vs 현재 (수동 Accept 게이트) 갭 | naming 자체 폐기 — wikey 는 raw → wiki + LLM retrieval. self-extending layer 자체 deprecate. |
| schema.yaml 의 `standard_decompositions` 정의 틀 | "특정 틀 안으로 꾸겨넣은 느낌" | section 삭제 + `entity_types` / `concept_types` *user 확장* 도 폐기 (D-wide 에서 BUILTIN 7-type 자체가 사라지므로 user 확장도 무용). 보존: `aliases` / `pii_patterns` 만. |
| 문서 유형에 따른 분류값 변경 | "자동 변경되고 확장되어야 함" | **LLM 자율 type 생성** (`schema.ts` ENTITY_TYPES/CONCEPT_TYPES 폐기). 입력 문서 유형 따라 새 type (`algorithm`/`dataset`/`event`/`trend`) 자동 생성. canonicalizer prompt 는 *type 예시* 만 제공 (강제 X). |
| 지식 확장 기준 (Suggestion 후보 → Accept → schema 등재) | "정의만 필요" (=의미 처리 정의, 표준 정의 X) | Suggestion / Accept / 등재 chain 폐기 — LLM + qmd embedding 이 의미 자동 처리 (옵션 D §3.2 layer 2/3). 사용자가 manual 등록 / Accept 의무 0. |

**핵심 통찰 (D-wide v3)**: 사용자 "정의만 필요" = wikey 의 자율 확장 *철학 정의* (= wikey.schema.md "위키는 LLM 이 소유한다" 핵심 원칙) 만 명시하면 충분, **schema layer 0**. v2 의 "출력 형식 규약" 같은 약한 schema 도 D-wide 에서는 사용자 비판 미충족 (codex P1-2 finding 의 의미). 본 §5.10 v3 = schema layer 완전 0 정의.

### 11.4 C4 — Karpathy 철학 정확 일치

> **사용자 raise**: "karpathy의 철학에서도 사용자는 wiki를 관리할 수 없다. > LLM을 활용해서 관리"

**옵션 D 매핑** (chain 6 직접 강화):

| Karpathy llm-wiki.md 명제 | wikey.schema.md 매핑 | 옵션 D 응답 |
|----------------------|--------------------|-----------|
| "I read the summaries, check the updates, and **guide** the LLM" | 핵심 원칙 #2: "위키는 LLM 이 소유한다 — 사용자는 읽고 지시하고, LLM 이 작성·유지한다" | ✅ 옵션 D 가 이 원칙 정확 구현 — 사용자 = guide / read, LLM = write |
| "사용자는 wiki 를 관리할 수 없다" (사용자 raise) | "역할 분담" 표: 사용자 = 큐레이션·질문·지시, LLM = 작성·유지 | ✅ 옵션 D 의 panel UI 폐기로 사용자 manual edit gate 제거 |
| "LLM 을 활용해서 관리" (사용자 raise) | "BYOAI" + "쓰기 범위 = wiki/ 전체" | ✅ 옵션 D 의 LLM-only 의미 처리 (qmd embedding + LLM 답변) 가 정확 일치 |

**현 §5.4 self-extending 의 위반**:
- panel UI 의 "Suggestions / Accept / Add / Edit / Reject" = 사용자가 wiki 분류 *기준* 을 manual 등재. → "사용자는 wiki 를 관리한다" 의 약한 형태. Karpathy 의 "guide" 가 아닌 "configure".
- schema.yaml `standard_decompositions` = 사용자가 LLM 의 분류 자유도를 *제한*. → LLM 자율 분해 X.

**옵션 D 정당성 강화 (C4 직결)**: schema.yaml + panel UI deprecate = 사용자 → guide / read 만, LLM → 모든 wiki 관리. wikey.schema.md "핵심 원칙 #2" 의 정확한 코드 구현.

---

## 12. Karpathy 4 원칙 + 4 코딩 원칙 cross-check (v2 신규)

본 §5.10 v2 가 Karpathy 8 원칙 모두와 일치 검증.

### 12.1 wikey 4 원칙 (wikey.schema.md "LLM Wiki 개인화의 4가지 장점")

| 원칙 | v2 본문 일치 검증 | C# 매핑 |
|------|----------------|---------|
| **Explicit** (AI 의 지식이 위키로 가시화) | ✅ — 옵션 D 도 wiki/ 페이지 자체 (markdown + frontmatter) 보존. 가시화 X 변경 X. C2/C3 의 schema layer 폐기는 *사용자 인지 부담* 만 감소, AI 지식 가시화 layer (wiki/) 영향 0. | C2, C3 |
| **Yours** (로컬 저장, 특정 업체 비종속) | ✅ — `.wikey/*.json` 폐기 = 로컬 데이터 *덜 생성*. 업체 비종속 영향 0. PII gate 보존 (옵션 D §3.2 보존). | C2-부속 |
| **File over app** (마크다운 등 범용 포맷) | ✅ — wiki/ markdown 보존. schema.yaml 의 standard_decompositions section 만 삭제 — 범용 포맷 영향 0. | C2-부속, C3 |
| **BYOAI** (AI 자유 교체) | ✅ — 옵션 D 의 LLM-only 백 = qmd embedding + LLM 답변 = provider 교체 자유 (Claude / Codex / Gemini / Ollama). schema layer 가 *없을수록* BYOAI 강화. | C4 |

⇒ **wikey 4 원칙 모두 옵션 D 와 일치, 충돌 0.** v2 추가 4 concern 도 모두 4 원칙 강화 방향.

### 12.2 Karpathy 4 코딩 원칙 (~/.claude/CLAUDE.md)

| 원칙 | v2 본문 일치 검증 | C# 매핑 |
|------|----------------|---------|
| **#1 Think Before Coding** (가정 금지, 트레이드오프 제시) | ✅ — §10.6 trade-off 표 (5 항목) + §11 4 concern 매핑 정밀 + §9 정당성 (§5.4 없어도 wikey 작동) 명시. 가정 X. | C1 |
| **#2 Simplicity First** (문제 해결의 최소 코드) | ✅ — 옵션 D-wide 코드 ~35~55 file 폐기 + ~110 test 폐기 = simplicity 정확 적용 (v4 갱신). C1 도 conversion 1 곳 통합 = simplicity. 옵션 A 는 add (panel rename + audit log 등) → simplicity 약함. | C1, C2 |
| **#3 Surgical Changes** (필요한 것만 수정) | ✅ — v2 가 v1 본문 (§1~§9) 보존 + §0/§10/§11/§12/§13 신규 추가만. v1 file rewrite X. C1 도 generateBrief 시그니처만 변경, 다른 함수 무관. 옵션 α (기존 file v1→v2) 선택 — surgical 정확. | (전체) |
| **#4 Goal-Driven Execution** (검증 가능한 성공 기준) | ✅ — §10.5 AC 7 항목 (v5 갱신, AC-C1.1~7 정량 정의 — test ≥ 19 신규 / call ≤ 1 / build 0 errors / 회귀 732 → ≥ 751 / cache callsite 3 곳 migrate). 옵션 D-wide 진입 시 별 AC 추가 (§7 (d) pending). | C1 |

⇒ **Karpathy 4 코딩 원칙 모두 일치, 충돌 0.**

---

## 13. wikey.schema.md 핵심 원칙 #2 정확 일치 검증 (v2 신규)

> wikey.schema.md "## 핵심 원칙" §:
> 2. **위키는 LLM 이 소유한다** — 사용자는 읽고 지시하고, LLM 이 작성·유지한다

본 원칙 = **C4 (사용자 raise) 와 정확 일치**. 옵션 D 가 본 원칙의 **유일한 정확 구현**:

| 옵션 | 핵심 원칙 #2 일치도 | 근거 (v3 갱신) |
|------|----------------|------|
| A (점진) | △ 부분 (60%) | panel 보존 → 사용자가 schema 관리 (read + 지시 외 *configure*) |
| B (graph emergent) | ○ 거의 (85%) | panel 폐기 + graph ontology — LLM 자동 ontology 생성, 단 mention-history 누적 사용자 가시 X |
| C (관망) | ❌ 위반 (40%) | 현 panel UI 유지 → 사용자 wiki 관리 active |
| D-narrow | ○ 거의 (85%) | panel + standard_decompositions 폐기, 단 7-type schema gate 잔존 → LLM 자율 type 생성 X (사용자 C2 4+3 type 제한 비판 미충족) |
| **★ D-wide (v3 채택)** | **✅ 정확 일치 (100%)** | **panel + standard_decompositions + 7-type schema gate 모두 폐기 → 사용자 = read + guide. LLM = 모든 wiki 작성·유지·의미 처리·type 생성** |

⇒ **wikey.schema.md 핵심 원칙 #2 + C4 (Karpathy 직접 인용) + C2 (4+3 type 제한 비판) 의 정확한 코드 구현 = 옵션 D-wide**. v3 가 이 정당성을 schema 직결로 완전 강화 (codex P1-2 fix).

**충돌 검증**: v2 본문 어느 항목도 wikey.schema.md 의 4 원칙 / 5 핵심 원칙 / 3계층 아키텍처 / 4 워크플로우 / 페이지 컨벤션과 충돌 X.
- 3계층 보존 (raw / wiki / schema)
- raw 불변 보존 (옵션 D 의 layer 1 ingest)
- wiki LLM 소유 강화 (옵션 D 의 핵심)
- schema 사용자 승인 필수 보존 (옵션 D 진입 자체가 사용자 결정)
- 4 워크플로우 (ingest / query / lint / 삭제) 모두 옵션 D 와 무관 — wiki/ 위에서 동작

---

## 14. C5 — 답변 broken wikilink 자동 페이지 생성 차단 (v5 신규, 옵션 무관 prevention + cleanup issue)

> **사용자 raise** (2026-05-04): "질의/응답 결과의 본문에 페이지가 없는 링크가 있고, 이것을 선택하면 root폴더에 해당 페이지가 새롭게 생성되는 구조" + "단어/명칭/어구가 페이지가 없는 곳에 링크는 필요없음" + "페이지가 없는 링크를 사용자가 선택해서 새로운 페이지 생성할 일 없음" + "현재의 root폴더에 그래서 생성된 빈페이지가 있음".
>
> **분류**: 옵션 A/B/C/D 와 직교. C1 처럼 단독 cycle 가능. **점검 결과**: wiki/ 내부 빈 페이지 0 (✅ 안전), root 폴더에 0-byte .md 10 개 발견 (broken wikilink 클릭으로 생성된 artifact).

### 14.1 root cause 분석 (master grep 2026-05-04 ground truth)

| 위치 | line | 동작 |
|------|------|------|
| `wikey-core/src/query-pipeline.ts:386` | buildSynthesisPrompt | "답변에 등장한 모든 entity/concept 은 첫 등장 시 [[페이지명]] 으로 링크하세요" — 위키 페이지 *존재 여부 검증 X* |
| `wikey-core/src/query-pipeline.ts:385` | buildSynthesisPrompt | "검색된 페이지 본문에 [[wikilink]] 로 언급된 다른 wiki 페이지가 있으면 ... 활용" — 1-hop expansion 도 broken link 가능성 |
| Obsidian default 행동 | sidebar-chat 답변 렌더 후 클릭 | unresolved `[[link]]` 클릭 → vault root 에 `<link>.md` 빈 파일 자동 생성 (Obsidian 핵심 동작) |
| 사용자 vault root | `/Users/denny/Project/wikey/` | `Phase 4.md` / `PMBOK.md` / `운영 안전.md` / `증분 재인제스트.md` / `검색 graph expansion.md` / `Audit UI.md` / `cross-link.md` / `qmd embeddings.md` / `Phase 5.md` / `Untitled.md` 10 개 0-byte 파일 |

**핵심 본질**: LLM 이 *답변 풍부함* 위해 모든 entity/concept 을 [[wikilink]] 처리 → 그 중 일부는 wiki/ 에 페이지 X (unresolved) → Obsidian default 가 클릭 시 root 에 빈 페이지 자동 생성 → vault 오염.

### 14.2 해결안 — 3 단계 (prevention + intercept + cleanup)

#### (A) Prevention — query-pipeline 답변 prompt 정정 (v5 권장 핵심)

**원칙**: LLM 이 *위키에 실제 존재하는* entity/concept 만 [[wikilink]] 로 표기. 없는 것은 plain text.

**변경 spec**:
- `wikey-core/src/query-pipeline.ts:buildSynthesisPrompt`:
  - context section 에 "위키 페이지 base name 목록" (queried 결과 + 1-hop wikilink target 의 *존재 확증* 된 base) 주입
  - rule line 386 정정: "답변에 등장한 entity/concept 중 **위 페이지 base name 목록에 있는 것만** 첫 등장 시 [[페이지명]] 으로 링크하세요. 목록에 없는 entity/concept 은 plain text 로 표기하세요."
  - rule line 385 정정 (1-hop): "검색된 페이지 본문의 [[wikilink]] 중 **`expandWithOneHopWikilinks` 로 실제 read 된** 페이지의 정보만 활용. read 실패 (wiki/ 에 없는) wikilink 는 답변에 [[link]] 로 포함하지 마세요."
  - context 에 `[Available pages]: <slug1>, <slug2>, ...` block 추가 (LLM 이 명시 참조)

#### (B) Intercept — Obsidian sidebar-chat 답변 렌더 broken link 차단 (보조 안전망)

**원칙**: LLM 이 prompt 무시하고 broken wikilink 출력해도 클릭 시 자동 페이지 생성 차단.

**변경 spec (v5.1 정확화 codex P2-1 fix)**:
- `wikey-obsidian/src/sidebar-chat.ts:2830~2858` `renderMarkdown()` 의 *기존 click handler 2 곳* 정정 (별 helper 신규 X — 동일 location 의 handler 안에서 resolve-before-open):
  - **handler 1** (line 2835~2840): `el.querySelectorAll('a.internal-link')` 의 `addEventListener('click', e => { e.preventDefault(); openLinkText(href, '') })` 부분
  - **handler 2** (line 2853~2858): `node.querySelectorAll('.wikey-wikilink')` 의 동일 패턴 (markdown render 후 `[[link]]` regex 치환 결과)
  - **fix 패턴 (양쪽 동일)**: `e.preventDefault()` 후 `app.metadataCache.getFirstLinkpathDest(href, '')` 로 resolve.
    - resolve 성공 (existing TFile) → `app.workspace.openLinkText(href, '')` 호출 (기존 동작)
    - resolve 실패 (null = broken) → `new Notice('위키에 없는 페이지 — 자동 생성 차단')` + link DOM 에 `wikey-broken-link` class 추가 (시각 dim)
- **적용 범위**: 답변 영역 (sidebar chat `renderMarkdown` 호출 대상) 만. vault 일반 편집 (Obsidian 다른 view, file explorer click 등) 영향 X.
- **CSS 추가** (`styles.css` 또는 inline): `.wikey-broken-link { opacity: 0.5; text-decoration: line-through; cursor: not-allowed; }`

#### (C) Cleanup — 기존 root 빈 페이지 사용자 승인 후 삭제

**점검 결과** (2026-05-04 master 직접 ls):
```
/Users/denny/Project/wikey/Phase 4.md (0 bytes)
/Users/denny/Project/wikey/Phase 5.md (0 bytes)
/Users/denny/Project/wikey/PMBOK.md (0 bytes)
/Users/denny/Project/wikey/Audit UI.md (0 bytes)
/Users/denny/Project/wikey/cross-link.md (0 bytes)
/Users/denny/Project/wikey/qmd embeddings.md (0 bytes)
/Users/denny/Project/wikey/검색 graph expansion.md (0 bytes)
/Users/denny/Project/wikey/운영 안전.md (0 bytes)
/Users/denny/Project/wikey/증분 재인제스트.md (0 bytes)
/Users/denny/Project/wikey/Untitled.md (0 bytes — Obsidian "New note" 결과 가능성, 사용자 의도 확인 필요)
```

**처리 절차** (master 가 직접 진행, 사용자 명시 승인 후):
1. `Untitled.md` 제외 (사용자 의도 가능성) — 사용자에게 확인
2. 9 개 broken-link artifact 일괄 `rm` (single command). git ignore 안 됨 (raw/ 외 root) — 단순 cleanup
3. 단, vault 의 다른 폴더 (raw/ 하위 등) 의 0-byte 파일 점검도 필요 — `find . -type f -name "*.md" -size 0c` 로 추가 검색

### 14.3 acceptance criteria (C5 단독 cycle)

| AC | 검증 |
|----|------|
| **AC-C5.1** (Prevention) | `query-pipeline.ts buildSynthesisPrompt` 의 context block 에 `[Available pages]: ...` 명시 + rule line 385/386 정정 (실제 존재 페이지만 wikilink). unit test ≥ 3 cases — (1) 답변에 unresolved entity 가 있을 때 plain text 출력 (2) resolved entity 만 [[wikilink]] (3) 1-hop wikilink read 실패 시 답변에 포함 안 됨. |
| **AC-C5.2** (Intercept, v5.1 정확화 codex P2-1 fix) | `sidebar-chat.ts:2830~2858` `renderMarkdown()` 의 *기존 click handler* 정정 (broken-link intercept 가 별 helper 가 아니라 동일 location 의 handler 안에서 resolve-before-open 으로 동작): <br>**현 코드** (line 2835~2840 + line 2853~2858): `link.addEventListener('click', e => { e.preventDefault(); const href = link.getAttribute('data-href'); if (href) this.app.workspace.openLinkText(href, '') })` <br>**변경 후**: `e.preventDefault()` 후 `app.metadataCache.getFirstLinkpathDest(href, '')` 로 resolve. <br>&nbsp;&nbsp;- resolve 성공 → `app.workspace.openLinkText(href, '')` 호출 (기존 동작) <br>&nbsp;&nbsp;- resolve 실패 (broken) → `new Notice('위키에 없는 페이지 — 자동 생성 차단')` + link DOM 에 `wikey-broken-link` class 추가 (시각 dim) <br>**적용 범위**: 답변 영역 (sidebar chat) 만. vault 일반 편집 (Obsidian 다른 view) 영향 X. <br>**test**: integration test 1 case (mock vault, broken `[[link]]` click → `getFirstLinkpathDest` null → Notice 표시 + vault 변경 0) + 라이브 smoke 1 case (실제 답변에 broken link 발생 시 click → vault root 빈 페이지 생성 0). |
| **AC-C5.3** (Cleanup, v5.2 root-only invariant 정확화 codex P2-2 fix) | vault **root** 의 0-byte broken-link artifact 일괄 삭제 (master 가 사용자 승인 후 직접 `rm`). **두 분기 (root 만)**: <br>**(분기 A) Untitled.md 보존 결정**: 9 개 (Phase 4.md / Phase 5.md / PMBOK.md / Audit UI.md / cross-link.md / qmd embeddings.md / 검색 graph expansion.md / 운영 안전.md / 증분 재인제스트.md) 삭제. **final invariant (root-only)**: `find . -maxdepth 1 -type f -name "*.md" -size 0c` = **1 (Untitled.md)**. <br>**(분기 B) Untitled.md 도 삭제 결정**: 10 개 모두 삭제. **final invariant (root-only)**: `find . -maxdepth 1 -type f -name "*.md" -size 0c` = 0. <br>**사용자 결정 절차**: master 가 cleanup 시점에 사용자에게 Untitled.md 의도 확인 (Obsidian "New note" 결과인지, broken-link 결과인지). <br>**별도 full-vault audit (사용자 승인 필수, AC-C5.3 범위 외)**: vault 전체 `find . -type f -name "*.md" -size 0c -not -path "./node_modules/*" -not -path "./.git/*"` 실행 시 `raw/_delayed/` 의 0-byte placeholder (NanoVNA V2 / FPV / DJI O3 등 5 개 — delay-ingest 시스템의 의도적 placeholder, broken-link X) 도 검출됨. **raw/ 영역의 0-byte 파일은 wikey 내부 시스템 placeholder 가능성 — 사용자 명시 승인 후 별도 cycle 로 정리. AC-C5.3 invariant 는 root-only.** |
| **AC-C5.4** | 회귀 baseline `npm test` (현 v5 cycle 진행 중 수치) PASS 유지 + AC-C5.1 신규 ≥ 3 cases 추가 → ≥ 754 (또는 v5 baseline 기준). build 0 errors. |

### 14.4 trade-off

| 트레이드 | 평가 |
|---------|------|
| **+** vault 오염 차단 (root 빈 페이지 더 이상 안 생김) | 사용자 vault state 깔끔 보장 |
| **+** Karpathy "Explicit": LLM 이 *없는 정보* 를 link 로 표기 안 함 (가시성 정확) | wiki 가 "AI가 무엇을 알고 모르는지 직접 본다" 원칙 강화 |
| **+** 답변 가독성 향상 (broken link 강조 X 또는 시각 구분) | UX 개선 |
| **-** LLM prompt 가 길어짐 (`[Available pages]` block 추가, ~50~100 토큰) | 비용 미미 |
| **-** intercept layer 가 Obsidian default 동작 변경 — 사용자 wiki/ 외부 의도적 페이지 생성도 차단 가능성 | scope 한정 (sidebar-chat 답변 영역만, vault 일반 편집은 영향 X) |

⇒ **C5 진행 권장**. 단독 cycle, 옵션 결정과 무관. C1 + C5 단독 cycle 병합 고려 가능 (둘 다 query/ingest pipeline 의 efficiency / hygiene fix 성격).

### 14.5 cleanup 우선 진행 (사용자 승인 대기)

C5 의 (A)/(B) implementation 은 cycle 필요. 단 **(C) cleanup 은 즉시 가능** — 사용자 승인 후 master 가 9 개 0-byte 파일 `rm` 진행. Untitled.md 는 사용자 의도 확인 후 결정.

---

## 15. footer + 변경 이력

| 버전 | 날짜 | 변경 | cycle |
|------|------|------|-------|
| v1 | 2026-04-26 | 초안 — 사용자 본질 비판 6 chain 정식 이슈화. 4 옵션 (A/B/C/D) 정의. §3 옵션 D 상세. §9 정당성 검증. | session 14 (analyst) |
| v2 | 2026-05-04 | 사용자 4 concern (C1~C4) 추가 등록. C1 = §10 신규 (Step 2/3 conversion 통합 efficiency issue, 옵션 무관). C2/C3/C4 = §11 옵션 D layer 별 보강. §12 Karpathy 8 원칙 cross-check. §13 wikey.schema.md 핵심 원칙 #2 일치 검증. §0 4 concern 매핑 표 신규. §7 self-check anchor (a)~(g) v2 갱신. | analyst v2 cycle (master 위임) |
| v3 | 2026-05-04 | ★ codex Mode D Panel cycle #1 NEEDS_REVISION (P1×2 + P2 + P3) → master 직접 fix. 사용자 옵션 **D-wide** 채택. (1) §0.1 D-narrow vs D-wide 결정 표 신규 + 사용자 trace. (2) §2 옵션 D 행 D-wide 명시. (3) §3.1 deprecate list 에 `schema.ts` ENTITY_TYPES/CONCEPT_TYPES + buildSchemaPromptBlock 7-type gate + types.ts EntityType/ConceptType union 추가. (4) §3.2 layer 2 정정 (canonical slug normalization 만, 7-type guide 폐기). (5) §10.2 결함 (a) 정확 진단 (brief HWP/DOCX binary 누락). (6) §10.3 의사 흐름도 정정 (`convertSourceToMarkdown` = pure conversion only, sidecar/PII/registry 책임 ingest() 잔존). (7) §10.4 변경 spec 재작성 (preconverted optional 주입 + Cancel 시 disk write 0). (8) §10.5 AC 보강 (AC-C1.4 Cancel invariant + AC-C1.5 sidecar write 시점 불변 + HWP/DOCX brief 변환 추가). (9) §11.1 D-wide 매핑 정정 (7-type schema gate 자체 deprecate). (10) §11.3 정정 ("출력 형식 규약" 표현 제거, entity_types/concept_types 도 deprecate). (11) §13 D-wide 행 추가. (12) §14 변경 이력 v3. mirror: phase-5-todo §5.10 + activity/phase-5-result.md 짧은 v2/v3 등록 (codex P3 fix). | master 직접 fix cycle (codex cycle #1 NEEDS_REVISION 후) |
| v4 | 2026-05-04 | ★ codex Mode D Panel cycle #2 NEEDS_REVISION (P1×3 + P2 + P3, 5 finding) → master 직접 fix. (1) P1-1 §3.1 store schema.yaml 보존 영역 정정 (entity_types/concept_types/custom-types 제거, aliases/pii_patterns 만) + mirror phase-5-todo §5.10.2.D + activity §5.10.4 동일 정정. (2) P1-2 §10.5 AC-C1.4 Cancel invariant → **vault write 0** 정확화 (cache write 는 ephemeral 허용). (3) P1-3 §10.5 AC-C1.7 신규 — convert-cache schema 갱신 (stripped 단독 → `{ content, sidecarCandidate }` JSON, vector PDF cache hit 결함 fix). (4) P2 §3.1.1 D-wide ripple checklist 신규 (R1~R8: schema.ts validation helpers + canonicalizer.ts:363~467 forced/drop/frontmatter + types.ts EntityType/ConceptType + settings-tab.ts:1126~1132 + docs/wikey-ingest-pipeline.md:323~366 + test 영향 ~110 합산). (5) P3 §7 anchor (a) `schema.ts:17~18` → `:20~21` 정정 + §3.1 baseline 732→~622 갱신 + §12.2 v2 stale 수치 (~30~50 file / ~100 test) → ~35~55 / ~110 정정. §14 변경 이력 v4. | master 직접 fix cycle (codex cycle #2 NEEDS_REVISION 후) |
| v5.4 | 2026-05-04 | ★ codex Mode D Panel cycle #7 NEEDS_REVISION (3 P3 minor — §8 next action v3/cycle #2 잔존 + §9.4 ~30~50 file 잔존 + parent/activity 상단 v5.2/cycle #6 잔존) → master 직접 fix (사용자 cycle #8 마지막 시도). (1) §8 next action v5.4/cycle #8 갱신 + cycle #8 NEEDS_REVISION 시 무조건 종료 명시. (2) §9.4 이득 ~30~50 → ~35~55 동기화. (3) parent + activity 상단 mirror v5.4/cycle #8 갱신 + cycle 진화 history v1→v5.4 명시. (4) header v5.3 → v5.4 + footer cycle #8 final. | master 직접 fix cycle (codex cycle #7 NEEDS_REVISION 후, 사용자 cycle #8 마지막 시도) |
| v5.3 | 2026-05-04 | ★ codex Mode D Panel cycle #6 NEEDS_REVISION (2 P3 minor — §7 self-check v5.1/cycle #5 잔존 + parent/activity mirror migration cost ~30~50/~100 잔존) → master 직접 fix (사용자 cycle #7 결정). (1) §7 self-check 표 v5.1 → v5.3 + (e)/(f) row 에 v5.2/v5.3 cleanup 반영 + cycle #7 입력 명시. (2) `phase-5-todo.md:918` + `activity/phase-5-result.md:1441` migration cost ~30~50/~100 → ~35~55/~110 동기화. (3) header v5.2 → v5.3 + footer cycle #7. **추가 fix**: panel-dispatch.sh `start_codex` 에 update notification auto-skip 통합 (사용자 명시 — master "2" 강제 송부 폐기, 글로벌 skill 영구 fix). | master 직접 fix cycle (codex cycle #6 NEEDS_REVISION 후) |
| v5.2 | 2026-05-04 | ★ codex Mode D Panel cycle #5 NEEDS_REVISION (3 minor finding — §14.2 본문 stale + AC-C5.3 invariant 부정확 + mirror) → master 직접 fix (사용자 cycle #6 결정 = 결정적 마무리). (1) §14.2 (B) intercept 본문 정정 (`renderMarkdown() line 2830~2858 의 기존 click handler 2 곳` 명시, attachCitationButtons / 별 helper 표현 제거). (2) AC-C5.3 root-only invariant 정확화 (`find . -maxdepth 1 -size 0c` = 0/1) + raw/_delayed/ 의 5 개 0-byte placeholder 별도 audit 명시 (사용자 승인 필수, AC 범위 외). (3) mirror phase-5-todo §5.10 + activity:23 v5.2/cycle #6 갱신. | master 직접 fix cycle (codex cycle #5 NEEDS_REVISION 후) |
| v5.1 | 2026-05-04 | ★ codex Mode D Panel cycle #4 NEEDS_REVISION (4 minor finding — numbering / §7 갱신 / AC-C5 정확화 / §0 매핑) → master 직접 fix (사용자 cycle #5 결정). (1) §0 제목 "4 concern" → "5 concern" 정정 + C5 row 매핑 §15 → §14. (2) §14 (C5) 하위 heading 15.1~15.5 → 14.1~14.5 renumber. (3) AC-C5.2 정확화 (`sidebar-chat.ts:2830~2858` `renderMarkdown()` 안 click handler 에서 `getFirstLinkpathDest` resolve-before-open). (4) AC-C5.3 분기 명시 (Untitled.md 보존 = 9 개 삭제 / Untitled.md 삭제 = 10 개 삭제). (5) §7 self-check v5 갱신 (anchor (a)~(g) 모두 R0/cache callsite/C5 spot 추가 cover). | master 직접 fix cycle (codex cycle #4 NEEDS_REVISION 후) |
| v5 | 2026-05-04 | ★ codex Mode D Panel cycle #3 NEEDS_REVISION (P1×2 + P2×2 + P3 stale 다수 + 신규 risk j, 6 finding) → master 직접 fix (사용자 cycle #4 master fix 결정). 추가: 사용자 신규 issue C5 raise → §14 신규 등록. (1) P1-1 §11.2 line 484 본문 entity_types/concept_types 보존 표현 정정 → aliases/pii_patterns 만 (변경 이력 예외 X 본문). (2) P1-2 §10.3 line 346 + §10.4 line 431 (AC-C1.1) "disk write 0" → "**vault write 0** (cache write 는 ephemeral 허용)" 일관 정정. (3) P2-1 AC-C1.6 산술 정정 (10+5+1+1+2 = ≥19, 732→≥751). (4) P2-2 §3.1.1 R0 신규 (`ingest-pipeline.ts:909~919` BUNDLED_STAGE2_MENTION_PROMPT type_hint 7-type 폐기) + R5 보강 (docs/wikey-ingest-pipeline.md:369/398/712 추가). (5) P3 stale 다수 fix — §3.4 (~100/~630 → ~110/~622), §7 anchor (f) (header v3/cycle #2 → v5/cycle #4), §12.2 (AC 4항목/732→740 → AC 7항목/732→≥751), activity:24 (v3/cycle #2 → v5/cycle #4). (6) 신규 risk (j) AC-C1.7 보강 — cache callsite migration 3 곳 (`ingest-pipeline.ts:1504` unhwp, `:1568` docling, `:1782` pdf-cache-hit) 모두 `{ content, sidecarCandidate }` schema 처리 + atomic 변경 명시. **(7) §14 C5 신규 — 답변 broken wikilink 자동 페이지 생성 차단 (사용자 신규 raise) + 점검 결과 root 0-byte .md 10 개 발견. (A) Prevention: query-pipeline buildSynthesisPrompt 정정 (`[Available pages]` block + 실제 존재 페이지만 wikilink). (B) Intercept: sidebar-chat broken link DOM 처리. (C) Cleanup: 9 개 root artifact 삭제 (Untitled.md 사용자 확인). AC-C5.1~C5.4. §0 4 → 5 concern 매핑 갱신.** §15 변경 이력 v5. | master 직접 fix cycle (codex cycle #3 NEEDS_REVISION 후 + 사용자 C5 신규 raise) |

---

PLAN_FILE: /Users/denny/Project/wikey/plan/phase-5-todox-5.10-graph-emergent-ontology.md
VERDICT: READY_FOR_CODEX_REVIEW (cycle #8 final)
