# Wikey Ingest Pipeline — 단계별 상세 분석

> **본 문서의 위치**: `wikey.schema.md` (마스터 스키마) + `llm-wiki.md` (Karpathy 원문 패턴) 의 *철학* 을 wikey 의 실제 코드 (`wikey-core/src/*.ts`) 위에 매핑한 운영 가이드.
>
> Karpathy 의 4 원칙 (Explicit / Yours / File over app / BYOAI) 이 어느 step 에 어떻게 박혀 있는지, 각 step 에서 LLM 이 *언제·왜·어떤 입력으로* 호출되는지, 그리고 *분류·생성·수정* 의 결정 기준이 무엇인지를 추적할 수 있도록 설계되어 있다.
>
> 작성 기준 코드: 2026-05-05 master (Phase 5 §5.10.4 D-wide cycle). §5.10 paradigm shift 옵션 D-wide 채택 — §5.4 self-extending (Stage 1~4) + 7-type schema gate (`ENTITY_TYPES`/`CONCEPT_TYPES` union, `FORCED_CATEGORIES`, `BUILTIN_STANDARD_DECOMPOSITIONS`) 모두 폐기. canonicalizer 는 alias normalization (slug dedup) 만 잔존, type 분류는 LLM 자율.

---

## 0. 철학 매핑 — llm-wiki.md ↔ wikey.schema.md ↔ 실제 파이프라인

| llm-wiki.md 핵심 명제 | wikey.schema.md 매핑 | 파이프라인 구현 |
|---|---|---|
| "RAG 는 매 쿼리마다 지식을 *재발견* — 축적이 없다" | 3계층 아키텍처: `raw/` (불변) ↔ `wiki/` (LLM 누적) | Step 4~6 (mention → canonical → page write) 가 *멱등* 으로 wiki 갱신 |
| "지식은 한 번 컴파일되고 *최신 상태로 유지* 된다" | "탐색은 축적된다" 핵심 원칙 #3 | Step 0.5 incremental reingest (hash diff 후 force/protect/skip) |
| "단일 source 는 10–15 개 wiki 페이지를 건드린다" | "인제스트 분할 전략" §, 4 카테고리 분해 | Step 5/6 canonicalizer 가 mention → entities/concepts/sources 로 fan-out |
| "사용자는 큐레이션·질문, LLM 은 *bookkeeping* 을 한다" | 역할 분담 표 (사용자=raw, LLM=wiki) | Step 1 (분류) 만 사용자 승인, Step 4~7 모두 LLM + 결정적 코드 |
| "Obsidian 은 IDE, LLM 은 프로그래머, wiki 는 코드베이스" | "Obsidian 의 역할" § | wiki/ 는 markdown + frontmatter (BYOAI 호환), 검색은 qmd vendored |
| "*Explicit*: AI 가 무엇을 알고 모르는지 직접 본다" | 핵심 원칙 + 4가지 장점 | provenance frontmatter + index.md + log.md (모든 LLM 행위 추적) |

이 매핑이 깨지는 순간 wikey 는 *RAG 와 다를 게 없는 도구* 로 퇴화한다 — §5.10 paradigm shift issue 가 이 경계를 다시 묻는 중.

---

## 1. 파이프라인 개요 — 8 step 매트릭스

raw 파일 1 개가 wiki 페이지 N 개로 분해되기까지의 8 단계.

| Step | 이름 | 트리거 | 입력 | 결정적/LLM | LLM 개입 | 산출 | 핵심 원칙 |
|------|------|--------|------|-----------|----------|------|----------|
| **1** | 인입·분류 (Inbox → PARA) | 사용자가 `raw/0_inbox/` 에 추가 | filename, ext | 결정적 1차 + LLM 2차 fallback | classify-LLM (cheap, JSON) | `raw/{PARA}/NN_type/NNN_topic/` 경로 결정 | Yours, Explicit |
| **2** | 인제스트 트리거 + Brief | Ingest 패널 / `llm-ingest.sh` | source path | LLM 1콜 (200~300자 요약) | brief-LLM (작은 prompt, ≤6KB sample) | 사용자 검토용 brief + guide hint 입력 폼 | File over app |
| **3** | 변환 (Conversion) | brief 후 "Proceed" 클릭 | binary/markdown source | 결정적 (외부 도구 fork) | **LLM 미개입** (Docling/markitdown/PyMuPDF/unhwp) | unified markdown + paired sidecar `<src>.md` | File over app |
| **4** | PII gate + Reingest 결정 | 변환 직후 | markdown + raw bytes | 결정적 (regex + sha256) | **LLM 미개입** | redacted markdown + force/protect/skip action | Yours (로컬 차단) |
| **5** | 추출 (Stage 1+2) | 변환 OK + reingest=force | markdown sections | LLM N+1 콜 (summary 1 + mention N) | summary-LLM, mention-LLM | source_page md + Mention[] | Explicit |
| **6** | 표준화 (Canonicalize) | mentions 수집 후 | Mention[] + 기존 wiki page list + alias overrides | LLM 1콜 (doc-global) | canonicalizer-LLM (LLM 자율 type 출력) | entities[] / concepts[] / dropped[] | Explicit, BYOAI |
| **7** | 페이지 write + 인덱스 갱신 | canonicalize 결과 | WikiPage[] | 결정적 (idempotent createPage) | **LLM 미개입** | `wiki/sources/`, `wiki/entities/`, `wiki/concepts/`, `index.md`, `log.md` | File over app |
| ~~**8**~~ | ~~Self-extending~~ | **D-wide 폐기 (2026-05-05)** — Stage 1~4 (BUILTIN_STANDARD_DECOMPOSITIONS / suggestion / convergence / self-declaration) 모두 제거. LLM 자연 의미 매칭 + qmd embedding cluster 가 대체. | — | — | — | — | — |
| **Q** | 쿼리 (별도 트리거) | 사용자 질문 | 자연어 | LLM 2~3콜 (cross-lingual 확장 + 합성) | 영문 키워드 추출 (Ollama 우선), 답변 합성 | answer + citations + 1-hop wikilink expansion | LLM 양끝 참여 (RAG ≠ wikey) |

각 step 의 상세는 §2 부터 다룬다. **LLM 콜 횟수 합계**: 1 raw → brief 1 + summary 1 + mention N (route=FULL 이면 N=1) + canonical 1 + (선택) classify 1. 평균 4~5 콜. (Step 8 Stage 4 arbitration 은 §5.10.4 D-wide 폐기.)

---

## 2. Step 1 — 인입·분류 (Inbox → PARA)

### 2.1 위치

- 코드: `wikey-core/src/classify.ts`
- UI: Audit 패널 (`wikey-obsidian/src/sidebar-chat.ts`) 의 row Action
- 데이터: `raw/CLASSIFY.md` (사용자 편집 가능 분류 규칙) + `raw/{1_projects, 2_areas, 3_resources, 4_archive, 9_assets}/`

### 2.2 분류 기준 — 2 단계 캐스케이드

#### (a) 결정적 1차 분류 (`classifyFile`)

확장자 + 파일명 토큰 매칭. LLM 호출 없음.

| 입력 | 규칙 | 예시 destination |
|------|------|------------------|
| `*.meta.yaml` | URI 참조 — destination 빈 문자열 (외부 처리) | `''` |
| 폴더 | LLM 판단 필요 | `raw/3_resources/` + `needsThirdLevel=true` |
| `*.pdf` + `report\|paper\|논문` | 리포트로 매핑 | `raw/3_resources/20_report/{Dewey}/` |
| `*.pdf` + `manual\|guide\|매뉴얼` | 매뉴얼로 매핑 | `raw/3_resources/30_manual/{Dewey}/` |
| `*.pdf` (그 외) | LLM 판단 필요 | `''` + `needsThirdLevel=true` |
| `*.md \| *.txt` | 노트 | `raw/3_resources/60_note/{Dewey}/` |
| `*.stl/.step/.obj/.3mf` | CAD | `raw/3_resources/40_cad/{Dewey}/` |
| `*.c/.h/.cpp/.ino/.py` | 소스코드 | `raw/3_resources/50_firmware/{Dewey}/` |

3 차 (Dewey Decimal 10 대분류) 매칭은 `withThirdLevel()` 이 `DEWEY[]` 키워드 표 (한글/영문 약 200 단어) 와 토큰 매치. 미매치면 2 차까지만 + `needsThirdLevel=true` 로 LLM 위임 신호.

#### (b) LLM 2차 fallback (`classifyWithLLM`)

`needsThirdLevel=true` 또는 1차 destination 이 빈 문자열일 때 호출.

**LLM 개입 포인트**:
- **provider/model**: `resolveProvider('classify', config)` — 미지정 시 ingest 의 provider 승계, 저가 모델 override 가능 (Gemini Flash / Ollama Gemma 등 권장).
- **prompt 입력**:
  - `raw/CLASSIFY.md` 원문 (사용자 정의 규칙)
  - 파일명 + 종류 (file/folder)
  - 하드코딩 1차 hint (있으면)
  - **기존 NNN_topic 폴더 목록** (4 차 slug 재사용 우선 — 이게 핵심)
  - PARA pin 제약 (사용자가 UI 에서 PARA 강제 시)
- **출력**: `{ destination, reason }` JSON. parser 는 `extractJsonBlock` 재사용.
- **fallback 정책**: LLM 실패 / JSON parse 실패 → `hint2nd \|\| 'raw/3_resources/'` 로 보수적 default.

**왜 LLM 이 필요한가**: PARA 의 PR vs Area vs Resource 구분은 *시간성·계약 유무* 같은 의미 판단이라 토큰 매칭이 부족. Dewey 4 차 slug (`100_pms`, `120_keyboards` 등) 도 사용자 vault 에서 점진 진화하므로 *기존 폴더 재사용 우선* 이 핵심 — 이걸 LLM 한테 명시 prompt 로 주입.

### 2.3 생성·수정 규칙

- **생성 (이동)**: 사용자 승인 후 `raw/0_inbox/<file>` → `<destination><file>` 로 *이동*. 내용 변경 없음.
- **수정 금지**: `raw/` 의 파일 *내용* 은 절대 수정 안 함 (불변 원칙). 분류=*경로 이동* 만.
- **재분류**: 같은 파일이 다른 destination 으로 다시 분류되어도 LLM 은 `raw/CLASSIFY.md` + 기존 폴더 목록을 매번 새로 읽어 결정 — 캐시 1 회 (`cachedRules`) 만 모듈 단위.

### 2.4 schema 매핑

> wikey.schema.md "원시 소스 관리 / 추가 (Add)" §. 모든 새 소스는 `raw/0_inbox/` 단일 진입점 → PARA 분류. 이 step 이 그 분류 의 자동화.

---

## 3. Step 2 — 인제스트 트리거 + Brief (LLM 사전 요약)

### 3.1 위치

- 코드: `wikey-core/src/ingest-pipeline.ts::generateBrief()`
- UI: `wikey-obsidian/src/ingest-modals.ts` (`FlowPhase = 'brief' \| 'processing' \| 'preview' \| 'done'`)

### 3.2 동작

사용자가 Ingest 패널에서 raw 파일 선택 → Brief 모달 즉시 open (loading 상태) → `generateBrief()` 백그라운드 호출 → 200~300 자 요약을 모달에 표시 → 사용자가 "guide hint" 자유 입력 + verify=on/off 선택 → "Proceed" 클릭.

### 3.3 LLM 개입 포인트 (1 콜)

```ts
// ingest-pipeline.ts:1233~1247 (요약)
const prompt = `다음 문서의 핵심 포인트를 2~4문장(총 150~300자)으로 요약하세요.
존댓말(해요체). 목록·제목·마크다운 없이 평문.

문서: ${llmFilename}
${llmSample}`  // 첫 6,000자 sample
const resp = await llm.call(prompt, { provider, model, timeout: 60000 })
```

- **provider/model**: `resolveProvider('ingest', config)` 와 동일 (별 키 없음).
- **입력 가공**:
  - `content.slice(0, 6000)` — 첫 6 KB 만 (전 문서 X, brief 는 cheap 비용 우선).
  - PII gate 통과 (`sanitizeForLlmPrompt(sample)`) — 사용자 PII 가 LLM 으로 새지 않도록.
  - filename 도 `sanitizeForLlmPrompt(filename)` — Phase 5 §5.8.1 C-A1 leak 방지.
- **PDF 처리**: `extractPdfText` 의 `stripped` 만 사용 (sidecar 저장은 Step 3 본 ingest 에서).
- **실패 처리**: brief 실패 = ingest 중단 X. 모달에 `(brief 생성 실패 · provider=... · model=...)` 표시 + Proceed 가능.

### 3.4 Brief 의 의미 (Karpathy 철학과의 연결)

llm-wiki.md "Ingest" §:
> "I read the summaries, check the updates, and guide the LLM on what to emphasize."

Brief 는 *사용자가 본 인제스트 전에* 핵심을 파악하고 *guide hint 로 강조점* 을 줄 수 있게 한다 — 이게 "사용자 = 큐레이터" 역할의 입구. guide hint 는 Stage 1 ingest prompt 의 `## 사용자 강조 지시` 블록으로 주입되어 entities/concepts 선별·요약을 사용자 의도로 편향.

### 3.5 분류·생성·수정 기준

- **생성 X**: brief 자체는 wiki 에 저장되지 않음 (대화 컨텍스트만).
- **수정 X**: 사용자 입력은 guide hint 로만 다음 단계에 전달.
- **결정**: Proceed → Step 3, Cancel → 흐름 종료 (raw 그대로).

---

## 4. Step 3 — 변환 (Conversion to Markdown)

### 4.1 위치

- 코드: `wikey-core/src/ingest-pipeline.ts` line 351~375 (확장자 분기) + `extractPdfText` (1723~) + `extractDocumentText` (1540~) + `extractHwpText` (1482~)
- 외부 도구: `docling`, `markitdown`, `pymupdf`, `unhwp`

### 4.2 변환 매트릭스

| 확장자 | 1차 컨버터 | fallback | 출력 |
|--------|----------|----------|------|
| `.md`, `.txt` | 직접 read + `stripEmbeddedImages` | — | content 그대로 (sidecar 미생성) |
| `.pdf` | docling tier 1 | tier 1a no-ocr / tier 2 markitdown / tier 3 PyMuPDF / tier 4 markitdown-OCR / tier 5 Vision OCR / tier 6 force-OCR | `{stripped, sidecarCandidate}` |
| `.docx, .pptx, .xlsx, .html, .csv, 이미지` | docling | — | unified markdown |
| `.hwp, .hwpx` | unhwp | — | markdown |

### 4.3 LLM 개입

**원칙적으로 LLM 미개입** — 변환은 *결정적·재현 가능* 해야 한다 (수정 1 줄 → 같은 markdown 보장 → §5 의 deterministic mode 와 짝).

**예외 단 한 곳** — PDF tier 4/5 (`extractPdfText` 1455 ~):
- markitdown-ocr 는 OpenAI-compatible vision API 를 요구 → Anthropic 키만 있으면 *Ollama vision fallback* (LlaVA 등) 으로 자동 분기.
- 이 분기에서만 *이미지 → 텍스트* 변환에 vision LLM 호출. 본문 의미 분석 LLM 은 절대 아님.

### 4.4 캐싱 (재실행 안정성)

`convert-cache.ts` 의 `computeCacheKey({sourceBytes, converter, majorOptions})` → `~/.cache/wikey-conv/` 에 markdown stash. 같은 파일 재 ingest 시 변환 step skip → LLM step 만 새로 돈다 (사용자 prompt override 변경 시).

### 4.5 Sidecar (paired markdown)

PDF/HWP/DOCX 등 비-markdown 원본은 변환된 markdown 을 `<source>.md` 로 *원본 옆에* 저장 (`canonicalSidecarPath`). 이유:
- llm-wiki.md "Yours / File over app": 사용자가 *LLM 이 본 텍스트* 를 직접 검증 가능.
- §5.3.1 sidecar_hash 로 사용자 수정 감지 → reingest 보호.

### 4.6 분류·생성·수정 기준

- **생성**: 비-md 원본 → `<src>.md` (canonical) 또는 보호 모드 시 `<src>.md.new[.N]` (Step 4 결정).
- **수정**: 사용자가 sidecar 직접 편집한 경우, registry.sidecar_hash 와 disk hash 가 어긋남 → Step 4 가 `protect` 분기 진입.
- **품질 자동 평가** (`scoreConvertOutput`): 한국어 공백 손실률, 페이지당 character count, 이미지 OCR 오염률 등으로 retry 결정 — 이것도 결정적 score 임.

---

## 5. Step 4 — PII Gate + Reingest 결정

### 5.1 위치

- 코드: `wikey-core/src/pii-redact.ts::applyPiiGate`, `pii-patterns.ts`, `incremental-reingest.ts::decideReingest`
- 데이터: `~/.config/wikey/pii-patterns.yaml`, `<basePath>/.wikey/pii-patterns.yaml`, `.wikey/source-registry.json`

### 5.2 PII Gate (2-layer)

#### (a) 패턴 로드 — *하드코딩 금지*

```ts
const piiPatterns = loadPiiPatterns(opts?.basePath)
// (1) <basePath>/.wikey/pii-patterns.yaml
// (2) ~/.config/wikey/pii-patterns.yaml
// (3) DEFAULT_PATTERNS (compileDefaults)
```

`feedback_pii_no_hardcoding.md` 에 명시된 사용자 영구 결정 — PII 패턴은 코드 분리 + YAML override.

#### (b) 2-layer 옵션

| 옵션 | 기본 | 의미 |
|------|------|------|
| `guardEnabled` (advanced) | `true` | `false` = PII 검사 자체 skip (사용자 신뢰 경계) |
| `allowIngest` (basic) | `false` | `false` + PII 감지 → `PiiIngestBlockedError` throw |
| `mode` | `mask` | `display \| mask \| hide` (치환 방식) |

#### (c) 적용 지점

- `sourceContent` (LLM 입력 본문)
- `pdfSidecarCandidate` (디스크 저장 sidecar)
- `llmSourceFilename` (LLM prompt metadata) — Phase 5 §5.8.1 C-A1
- `brief` 호출 sample + filename — §5.8 위반 방지

**LLM 개입 X** — 모두 결정적 regex.

### 5.3 Reingest 결정 (`decideReingest`)

raw bytes hash + registry diff 를 collect-then-decide 패턴으로 처리.

#### Phase A — conflicts 수집 (short-circuit X)

| conflict kind | 조건 |
|---------------|------|
| `sidecar-user-edit` | registry.sidecar_hash 와 disk sidecar hash 가 다름 |
| `source-page-user-edit` | wiki/sources/source-*.md 에 `## 사용자 메모` H2 존재 |
| `duplicate-hash` | 같은 hash 가 다른 path 에 등록됨 |
| `legacy-no-sidecar-hash` | hash 변경 + 기존 sidecar 존재하지만 hash 미기록 |
| `unmanaged-paired-sidecar` | registry 미등록 + disk paired sidecar 존재 (사용자가 미리 만들어 둔 변환본) |

#### Phase B — action 결정

| 시나리오 | action | 의미 |
|---------|--------|------|
| `R == null` (신규) + conflict 0 | `force` | 정상 신규 ingest |
| `R == null` + unmanaged sidecar | `prompt`/`protect` | 첫 ingest 가 사용자 sidecar 덮어쓰기 방지 |
| `byHash != null && byPath == null` | `skip` (`duplicate-hash-other-path`) | 같은 파일이 다른 곳에 있음 |
| `R.hash == H_now` + sidecar_hash 미존재 + disk sidecar 있음 | `skip-with-seed` | legacy 첫 hash-match — sidecar_hash 만 채움 |
| `R.hash == H_now` + sidecar 일치 | `skip` | LLM/page write 0 |
| `R.hash != H_now` + conflict 0 | `force` | 깔끔한 변경 — 정상 reingest |
| `R.hash != H_now` + conflict ≥1 | `prompt` (UI 있으면) / `protect` (없으면) | 사용자 작업 보호 |

### 5.4 Hook 1/2 (사용자 작업 보호)

- **Hook 1 (sidecar protect)**: protect 모드에서 sidecar 를 `.md.new[.1~.9]` 로 격리 저장, canonical 보존 + `pending_protections` 기록.
- **Hook 2 (source page user-marker preserve)**: 기존 `wiki/sources/source-*.md` 에서 `## 사용자 메모` 블록 추출 → LLM 생성 본문에 merge (idempotent).

### 5.5 분류·생성·수정 기준

- **분류**: action 5 종류 (`force / protect / prompt / skip / skip-with-seed`) 중 1.
- **생성·수정**:
  - `force`: 모든 wiki page overwrite + sidecar canonical write.
  - `protect`: sidecar `.md.new[.N]` 격리, source page 는 user marker merge 후 write.
  - `skip*`: LLM 0 콜, page write 0 (registry 만 갱신).

---

## 6. Step 5 — 추출 (Stage 1 Summary + Stage 2 Mention)

### 6.1 위치

- 코드: `wikey-core/src/ingest-pipeline.ts::callLLMForSummary` (870~), `extractMentions` (886~), `BUNDLED_INGEST_PROMPT` (1353~), `BUNDLED_STAGE2_MENTION_PROMPT` (909~)
- 데이터: `.wikey/stage1_summary_prompt.md` (override), `.wikey/stage2_mention_prompt.md` (override)

### 6.2 Route 결정 — `selectRoute`

`section-index.ts::selectRoute(sourceContent, provider, model)` 는 token budget 기반 결정적 분기:

| Route | 조건 | 동작 |
|-------|------|------|
| `FULL` | 토큰 한계 내 | summary 1 콜 + mention 1 콜 (whole doc) |
| `SEGMENTED` | 초대형 / Ollama 같은 소형 context | summary 1 콜 + mention N 콜 (core 섹션별 + peer context) |

`section-index.ts::buildSectionIndex` 가 markdown 을 결정적 섹션 트리로 파싱 (heading + body + warnings + heuristic priority).

### 6.3 LLM 개입 포인트 (a) — Summary (Stage 1)

```ts
const prompt = buildIngestPrompt(sourceContent, llmSourceFilename, indexContent, promptTemplate)
return callLLMWithRetry(llm, prompt, provider, model, deterministic)
```

- **provider/model**: `resolveProvider('ingest', config)` (Gemini 2.5 Flash 기본).
- **입력**:
  - `{{TODAY}}` + `{{INDEX_CONTENT}}` (기존 wiki/index.md) + `{{SOURCE_FILENAME}}` + `{{SOURCE_CONTENT}}` (Ollama 면 `truncateSource`).
  - guide hint 가 있으면 `injectGuideHint` 가 `## 사용자 강조 지시` 블록 추가.
- **출력 schema** (JSON):
  ```json
  {
    "source_page": {"filename": "source-...md", "content": "..."},
    "index_additions": ["- [[...]] — ..."],
    "log_entry": "...",
    "guide_reflection": "사용자 강조점이 어떻게 반영됐는지 1~2문장"
  }
  ```
- **`entities/concepts` 는 무시** — v6 부터 mention extractor + canonicalizer 로 분리.
- **deterministic mode** (§4.5.1.6.1): `WIKEY_EXTRACTION_DETERMINISM=1` 일 때 `temperature=0 + seed=42` 주입 → CV <15% 보장.
- **재시도**: `MAX_JSON_RETRIES=2`. JSON parse 실패 → `extractJsonBlock` (코드 블록 → bare object 순서) → 재시도.

### 6.4 LLM 개입 포인트 (b) — Mention extraction (Stage 2)

```ts
const template = promptTemplate ?? BUNDLED_STAGE2_MENTION_PROMPT
const prompt = template
  .replaceAll('{{SOURCE_FILENAME}}', sourceFilename)
  .replaceAll('{{CHUNK_CONTENT}}', chunkContent)
const raw = await callLLMWithRetry(llm, prompt, provider, model, deterministic)
```

- **콜 횟수**: FULL=1, SEGMENTED=N (core/support priority 섹션 수).
- **prompt 의 핵심** (BUNDLED_STAGE2_MENTION_PROMPT, D-wide 갱신):
  - "분류하지 마세요. 페이지를 만들지 마세요. 단지 wiki 후보를 짧게 나열만 하세요."
  - 출력: `{name, type_hint, evidence}`. `type_hint` 는 LLM 자율 출력 (string, 자유 형식). 예시 가이드: `organization` / `person` / `methodology` / `algorithm` / `dataset` / `event` / `regulation` 등 — 강제 union 없음.
  - 명시 거부 패턴: UI 라벨, 기능명 (X-management), 비즈니스 객체 (quotation/order), 한국어 일반 명사.
  - "청크당 0~15 개. 모르는 것보다 빠뜨리는 게 낫습니다."
- **SEGMENTED 의 peer context**: `formatPeerContext(sectionIndex, currentIdx, 300)` — DOC_OVERVIEW + GLOBAL_REPEATERS + prev/next 섹션 1줄 요약 → 섹션 LLM 이 *문서 전체* 를 일부라도 보게 보장.

### 6.5 추출 기준 (분류·생성·수정 가이드)

| 행위 | 기준 |
|------|------|
| **mention 생성** | 산업표준 용어, 회사·인물·제품·도구의 고유명, 정식 문서 유형. evidence 1 문장. |
| **mention 거부** | UI 라벨, 단순 기능명, 비즈니스 객체, 한국어 일반 명사. *LLM 이 자체 거부* (canonicalizer 가 추가 dropped 추적). |
| **source_page 생성** | summary LLM 이 항상 1 개. 멱등 (filename 같으면 update). |
| **source_page 수정** | `appendSectionTOCToSource` 가 결정적 섹션 TOC append (Phase C enablement). |

### 6.6 schema 매핑

> wikey.schema.md "인제스트 분할 전략" §. raw 1개 → wiki N개 (5~15). Step 5 의 mention extractor 가 이 분할의 *후보 풀* 을 만든다 — 어떤 mention 이 페이지가 될지는 Step 6 가 결정.

---

## 7. Step 6 — 표준화 (Canonicalize, D-wide 갱신)

### 7.1 위치

- 코드: `wikey-core/src/canonicalizer.ts`
- 데이터: `.wikey/schema.yaml` (사용자 `aliases:` 만 — `entity_types` / `concept_types` / `standard_decompositions` / `custom_types` / `pii_patterns` 모두 D-wide 폐기. PII custom rule 은 별 file `.wikey/pii-patterns.yaml` shape `patterns: - id/kind/mask`.)

### 7.2 LLM 개입 포인트 — doc-global 1 콜

```ts
const prompt = buildCanonicalizerPrompt({
  mentions, existingEntityBases, existingConceptBases,
  sourceFilename, guideHint, schemaOverride, overridePrompt,
})
const raw = await callLLMWithRetry(llm, prompt, provider, model, deterministic)
return assembleCanonicalResult(raw, mentions, sourceFilename, today, schemaOverride)
```

- **provider/model**: ingest 와 동일 (single-doc-global 한 콜이라 quality 우선 — Gemini 2.5 Pro 권장).
- **prompt 입력** (D-wide 갱신):
  1. 기존 wiki 페이지 base name 목록 (`existingEntityBases ∪ existingConceptBases`, 최대 80 개) → *재사용 우선*.
  2. mention 리스트 (Stage 2 산출, evidence 200 자 이내).
  3. `aliasBlock` — `.wikey/schema.yaml` 의 `aliases` (canonical slug normalization). 7-type schema gate / standard_decompositions block 폐기.
  4. `guideBlock` — 사용자 강조 지시.

### 7.3 분류 (D-wide 갱신 — LLM 자율)

D-wide 채택 후 entity/concept *type* 분류는 LLM 자율. 7-type union (organization/person/product/tool/standard/methodology/document_type) + `CONCEPT_DECISION_TREE` + `FORCED_CATEGORIES` 강제 pin 모두 폐기.

| 영역 | D-wide 동작 |
|------|------------|
| entity / concept *카테고리* (대분류) | wiki/entities/ vs wiki/concepts/ 디렉토리 구분으로 보존 (자연 구조). LLM 이 카테고리만 결정 |
| entity / concept *type* (세분류) | LLM 자율 string 출력. 도메인별 자유 (예: PMBOK ingest → `process` / `knowledge_area`. 잡지 → `event` / `trend`) |
| alias 정규화 | `canonicalizeSlug` + `.wikey/schema.yaml` `aliases` (다국어 / 동명이인 / 약어) — 결정적 |
| dedup | 같은 slug entity ↔ concept 동시 등장 시 concept keep (보존 layer) |

#### alias 자동 정규화 (결정적, LLM 후처리)

`canonicalizeSlug(normalizeBase(name))` 가 LLM 출력 base name 을 정규화. `.wikey/schema.yaml` 의 `aliases` 영역이 사용자 추가 매핑 layer. 다국어·동명이인·약어 통합 보존 — D-wide 와 직교.

### 7.4 거부·dropped 추적 (D-wide 갱신)

mention extraction 단계에서 LLM 자체가 거부 가이드 (UI 라벨, 기능명, 비즈니스 객체, 한국어 일반 명사) 적용. canonicalizer 의 `detectAntiPattern` schema-reject 로직은 D-wide 폐기 — assembleCanonicalResult 의 dropped[] 추적은 빈 description / 중복 감지 위주로만 유지.

### 7.5 dedup·alias 통합

| 단계 | 동작 |
|------|------|
| `canonicalizeSlug` | 별칭 → canonical |
| Cross-pool exact-name dedup | 같은 base 가 entity + concept 모두에 등장 → concept keep, entity drop |
| `dedupAcronymsCrossPool` | 약어 (≤6 char, no separator) ↔ full name 자동 통합 (initials match) |

### 7.6 동시-cycle entity ↔ concept 자동 link (`applyCrossLinks`)

같은 cycle 의 entity 페이지에 `## 관련` H2 + 모든 concept 의 wikilink 추가 (역방향도). 결정적 — LLM 비개입.

> wikey.schema.md "상호 참조" §: "관련 항목 섹션으로 페이지 하단에 정리". §5.2.1 (관련 H2 sandwich).

### 7.7 분류·생성·수정 기준 (D-wide 갱신)

| 행위 | 기준 |
|------|------|
| **새 페이지 생성** | mention → canonical slug 가 기존 wiki page 목록에 없음. LLM 자율 type 분류 통과 (D-wide 후 schema gate 폐기) |
| **기존 페이지 재사용** | LLM prompt 의 "기존 wiki 페이지" 목록과 base 매칭 → filename 그대로 재사용 |
| **수정 (overwrite)** | 같은 slug 가 다시 mention 됨 → `createPage` 멱등 write (frontmatter 의 sources 배열 누적은 wiki-ops 의 `## 출처` block 갱신으로) |
| **drop** | empty name 또는 empty type (D-wide 후 schema-gate / anti-pattern / type union 검증 모두 폐기 — LLM 자체 거부 + canonicalizer minimal validation 만) |

### 7.8 schema.yaml — D-wide 갱신 (§5.4 4 Stage 폐기)

`.wikey/schema.yaml` 의 D-wide 보존 영역은 **`aliases` 단독 section**. `entity_types` / `concept_types` / `standard_decompositions` / `custom_types` 는 §5.10 D-wide 결정으로 모두 폐기 — Stage 1 BUILTIN_STANDARD_DECOMPOSITIONS / Stage 2 suggestion / Stage 3 self-declaration / Stage 4 converged decomposition 의 4 layer self-extending 메커니즘 전체 제거. 도메인 type 진화는 LLM 자연 의미 매칭 + qmd embedding cluster 가 대체. PII custom rule 은 schema.yaml 에 두지 않음 — 별 file `.wikey/pii-patterns.yaml` (또는 `~/.config/wikey/pii-patterns.yaml`) shape `patterns: - id/kind/mask` 으로 관리 (PII engine 별 layer, `pii-patterns.ts` 참조).

---

## 8. Step 7 — 페이지 write + 인덱스 갱신 (결정적, LLM X)

### 8.1 위치

- 코드: `wikey-core/src/wiki-ops.ts::createPage / injectSourceFrontmatter / injectProvenance / updateIndex / appendLog`

### 8.2 write 순서

1. **Source page**:
   - `appendSectionTOCToSource(content, sectionIndex)` → "## 섹션 인덱스" append (idempotent).
   - Hook 2 user marker merge.
   - `injectSourceFrontmatter` 로 v3 frontmatter (`source_id, vault_path, hash, size, first_seen`) 주입.
   - `wiki/sources/source-*.md` write (멱등 — 존재하면 update).
2. **Source registry upsert** (`registryUpsert`) + sidecar_hash 갱신 (canonical write 한 경우만) + protect 분기 시 `pending_protections` append.
3. **Entity / Concept pages**:
   - `injectProvenance(content, [{type:'extracted', ref:'sources/<source_id>'}])` → frontmatter 의 provenance 배열 append (dedupe).
   - `wiki/entities/<base>.md` / `wiki/concepts/<base>.md` write.
4. **Index update**:
   - `updateIndex(wikiFS, tagged, writtenPages)` — LLM `index_additions` + 결정적 backfill (LLM 누락 페이지 자동 등재).
5. **Log append**:
   - `appendLog(wikiFS, entry, writtenPages)` — LLM `log_entry` 또는 결정적 헤더 (`## [YYYY-MM-DD] ingest | <filename>`).
6. **Reindex** — `runReindexAndWait` 가 `scripts/reindex.sh` invoke + `waitUntilFresh` polling (status='fresh' && stale==0).

### 8.3 멱등성 보장

- **createPage**: 같은 filename → overwrite. *내용 누적은 LLM 의 책임 X* — 매 ingest 마다 LLM 이 *전체* 페이지를 다시 작성한다 (description 1~2 문장 중심).
- **frontmatter sources 배열**: `injectSourceFrontmatter` 가 LLM YAML 보존 + managed key (source_id 등) 만 교체. user/LLM frontmatter (title, tags) 는 보존.
- **provenance dedup**: `dedupeProvenance` 로 (type, ref) 중복 제거.
- **index.md**: LLM `index_additions` 와 *실제 written pages* 를 cross-check, 누락 자동 backfill.

### 8.4 분류·생성·수정 기준

| 행위 | 기준 |
|------|------|
| **신규 page** | `wikiFS.exists()` false → `createdPages[]` |
| **기존 page update** | exists true → `updatedPages[]` (overwrite, frontmatter merge) |
| **index 항목 신규** | LLM 출력 + writtenPages backfill |
| **index 항목 update** | 같은 wikilink target 의 line 교체 |
| **log 항목** | append-only (수정·삭제 절대 X — schema 핵심 원칙 #5) |

### 8.5 schema 매핑

> "인덱스를 항상 최신으로 / 로그는 추가만" 핵심 원칙 #4, #5. **LLM 이 누락해도 결정적 코드가 보강** — Karpathy "AI 가 무엇을 알고 모르는지 직접 본다" 의 implementation safety net.

---

## 9. Step 8 — Self-Extending + 자율 지식 증분 (§5.4 4 Stage) — **D-wide 폐기 (2026-05-05)**

> ⚠️ **D-wide 결정으로 본 §9 전체 deprecated**. Stage 1~4 (BUILTIN_STANDARD_DECOMPOSITIONS / suggestion-detector / self-declaration / convergence) 모두 제거. 본 섹션은 *historical reference* 로만 보존 — 사용자 본질 비판 6 chain (§5.10) 으로 옵션 D-wide 채택, LLM 자연 의미 매칭 + qmd embedding cluster 가 self-extending 가치 대체.

### 9.1 위치

- 코드: `suggestion-detector.ts`, `suggestion-pipeline.ts`, `suggestion-storage.ts`, `suggestion-panel-builder.ts`, `self-declaration.ts`, `convergence.ts`
- 데이터: `.wikey/suggestions.json`, `.wikey/mention-history.json`, `.wikey/converged-decompositions.json`, `.wikey/qmd-embeddings.json`

### 9.2 4 Stage 매트릭스 (지식 자율 증분)

| Stage | 목적 | 트리거 | 출력 | LLM 개입 |
|-------|------|--------|------|----------|
| **Stage 1** | BUILTIN + 사용자 명시 표준 분해 | `.wikey/schema.yaml` 사용자 편집 | `standard_decompositions` 정적 정의 | X |
| **Stage 2** | mention graph 자동 후보 탐지 | 매 ingest 후 (`runSuggestionFinalize`) | `.wikey/suggestions.json` (state=pending) | X (co-occurrence + suffix cluster + confidence ≥ 0.6) |
| **Stage 3** | 소스 본문 self-declaration | ingest 의 section-index 에서 `headingPattern==='standard-overview'` 매칭 | runtime `SelfDeclaration[]` (persist X — schemaOverride 로 merge 후 휘발) | X (deterministic numbered/bullet list ≥ 5 items 패턴) |
| **Stage 4** | cross-source convergence | `run-convergence-pass.mjs` 수동 batch | `.wikey/converged-decompositions.json` | **선택** — `arbitrate` method `'union'` (default, 비용 0) 또는 `'llm'` |

### 9.3 Stage 2 detector 상세

`runSuggestionDetection`:
1. 새 ingest 의 canon 결과를 `IngestRecord` 로 변환 (concept[]/entity[] + slug + type).
2. `mention-history.json` 에 dedup append (source + ingestedAt).
3. `detectCoOccurrence(record)` — 같은 ingest 의 mention cluster (per-source).
4. `detectSuffixCluster(history)` — cross-source suffix pattern (`-management`, `-control`, ...).
5. `computeConfidence` — support_count (다른 source 에서 본 횟수) × suffix_score 등.
6. `negativeCache` 차단 (사용자가 Reject 한 signature).
7. confidence ≥ 0.6 → `Suggestion` (state=pending) 으로 `.wikey/suggestions.json` 저장.

### 9.4 Stage 4 convergence (alpha v1)

`clusterMentionsAcrossSources(history, embeddings)`:
1. `qmd-embeddings.json` 에서 slug → 1024-dim vector map 로드 (Float32 BLOB → JSON, 별 process `scripts/qmd-embeddings-export.mjs`).
2. agglomerative clustering: cosine ≥ 0.75 페어 merge.
3. singleton cluster drop (vector merge 미형성 → graceful skip).
4. `arbitrate(cluster, method='union' \| 'llm')`:
   - `union` (default): components = mention slugs union, confidence=1.0, LLM 0 콜.
   - `llm`: `buildArbitrationPrompt` → JSON 응답 (`is_standard, umbrella_name, components, arbitration_confidence, arbitration_reasoning`).
5. `MIN_DISTINCT_STANDARDS=3 × MIN_DISTINCT_SOURCES=2` precondition — 의미있는 convergence 만.

### 9.5 Suggestions panel UX

`Suggestions` 사이드바 (header icon `clipboard_check`):
- audit 그리드 (Select All + 멀티 row + 상단 그룹 식별자 + 하단 도메인 + 구성요소 preview)
- 하단 고정 버튼: Accept (멀티) / Reject (멀티) / Add (in-line edit) / Edit (mode 토글)
- "schema.yaml 확인 →" link → modal popup (도메인 tag cloud + 도움말 + 구성요소 list, raw YAML 미노출)
- 기등록 umbrella_slug 자동 필터

### 9.6 자동/수동 매트릭스 — chain break

| 단계 | 자동 | 수동 |
|------|------|------|
| ingest, mention 누적, Stage 2/3/4 detector | ✅ | — |
| `.wikey/schema.yaml` 영구 등록 (umbrella + components) | — | ❌ panel Accept (chain break — 사용자 검토 의무) |
| alias 자동 merging | — | ❌ 미구현 (v2 deferral) |

### 9.7 §5.10 paradigm shift — 옵션 D-wide 채택 + 구현 완료 (2026-05-05)

사용자 본질 비판 6 chain (panel 가치 / self-extending 명명 / 지식 그룹 ⊂ / graph emergent / 지식 분해 epistemology / LLM 백 시대착오) 으로 Stage 1~4 의 *pre-LLM reductionism* 가정을 의문. 4 옵션 (A 점진 / B graph / C 관망 / **★ D LLM-only deprecate**) 중 **D-wide 채택** (§5.10.4 cycle 종결). Stage 1~4 코드 + Suggestions panel UI + reindex.sh convergence hook 모두 폐기. qmd embedding + LLM 답변이 의미 처리 자동 담당.

---

## 10. Step Q — 쿼리 (질문 → 답변 → 선택적 저장)

> wikey.schema.md "워크플로우 2: 쿼리". llm-wiki.md "Query" §: "good answers can be filed back into the wiki as new pages."

### 10.1 위치

- 코드: `wikey-core/src/query-pipeline.ts`
- 외부 도구: `tools/qmd/dist/cli/qmd.js` (BM25 + 벡터 + RRF 융합)
- 한국어 전처리: `scripts/korean-tokenize.py` (kiwipiepy 형태소)

### 10.2 흐름 (4 step)

| Step | 동작 | LLM 콜 |
|------|------|--------|
| 1 | qmd 바이너리 탐색 | X |
| 2 | qmd search (lex + vec + cross-lingual lex) | X (단, cross-lingual 키워드 추출은 LLM) |
| 3a | 검색 결과 0 → fallback 단답 LLM | 1 콜 |
| 3b | 검색 결과 → wiki/ 본문 read + 1-hop wikilink expansion | X |
| 4 | LLM 합성 (`buildSynthesisPrompt`) | 1 콜 |

### 10.3 LLM 개입 포인트

#### (a) Cross-lingual 키워드 추출 (Korean → English)

```ts
const prompt = `Extract English search keywords from this Korean question.
Return ONLY space-separated English keywords, nothing else.
Question: ${koreanQuestion}
Keywords:`
const result = await llm.call(prompt, {
  provider: ollamaAvailable ? 'ollama' : default,
  model, maxTokens: 50, temperature: 0, timeout: 15000,
})
```

- **provider**: Ollama 우선 (빠르고 무료), 없으면 default.
- **이유**: 한국어 질문 → wiki 의 영문 base name (mqtt, pmbok) 매칭 위함. lex line 에 추가.
- **vec query** 는 `-` → space 치환 (qmd negation 오인 차단, §5.2.9).

#### (b) Synthesis (메인 답변)

```ts
const prompt = buildSynthesisPrompt(context, question)
const rawAnswer = await llm.call(prompt, { provider, model })
```

`buildSynthesisPrompt` 의 핵심 규칙:
- "확정적으로 설명하세요" — "~에 언급되었습니다" 같은 소극 표현 금지.
- "여러 페이지 정보 종합 → 하나의 완성된 답변".
- "해요체(존댓말)".
- "답변 끝 `참고: [[페이지명]], [[페이지명]]`".
- "답변 등장 entity/concept 첫 등장 시 [[wikilink]]".
- "검색 페이지 본문에 [[wikilink]] 가 있으면 1-hop target 도 활용".
- "위키 정보 부족 시에만 '아직 관련 내용이 없어요'".

### 10.4 1-hop wikilink expansion

`expandWithOneHopWikilinks(baseResults, reader, cap=5)`:
1. baseResults (qmd top-N, 보통 8) 본문에서 `[[wikilink]]` 추출.
2. frequency desc + first-seen 순서로 정렬.
3. baseResults 에 없는 신규 wikilink → wiki/{entities,concepts,sources,analyses}/<base>.md 순서로 read.
4. 최대 5 개까지 context 에 추가.

> Karpathy 의 "the cross-references are already there" — wiki 의 그래프 구조가 답변 생성 시 *자동으로 N-hop expanded* 되어 RAG 보다 풍부.

### 10.5 Citation + 원본 링크

- `collectCitationsWithWikiFS(results, wikiFS)` — 각 페이지 frontmatter 의 `provenance:` block 파싱 → `Citation[]` (sourceIds).
- `appendOriginalLinks(answer, citations, mode)`:
  - `mode='raw'` (default): registry 의 `vault_path` (PDF/HWP 원본).
  - `mode='sidecar'`: `<vault_path>.md` (변환된 markdown sidecar).
  - `mode='hidden'`: footer 미출력.
- 답변 끝에 `원본: [[<path>|<basename>]], ...` append.

### 10.6 분류·생성·수정 기준

- **생성 X (default)**: 쿼리는 wiki 변경 안 함 (대화 컨텍스트만).
- **선택적 생성**: "가치 있는 답변" 을 사용자가 wiki/analyses/<name>.md 로 명시 저장 — 그 시점에 index.md, log.md 갱신 (별도 ingest 흐름과 동일).
- **index.md 자동 갱신 X** — schema 명시 ("쿼리 시 자동 갱신되지 않는다 — 답변이 위키에 저장될 때만").

### 10.7 schema 매핑 — RAG 와의 차별점

> wikey.schema.md "LLM 참여형 다층 검색":
> - RAG: DB 검색 → LLM 결과만 읽음 (수동적)
> - LLM Wiki: **LLM 쿼리 확장** (cross-lingual) → 외부 검색 (qmd BM25+vec+RRF) → **LLM 합성** (1-hop expansion + 인용 + 위키링크)
>
> "지능 레이어는 외부 LLM, 검색 인프라는 qmd. 한국어 환경에서 더 정확."

---

## 11. 전체 LLM 콜 흐름 다이어그램

```
사용자: raw/0_inbox/<file> 추가
   │
   ▼
[Step 1] classifyFile (deterministic) ─┐
                                       │ (needsThirdLevel)
                                       ▼
                                   [LLM콜 #0] classify-LLM (선택)
                                       │
사용자 승인 → raw/{PARA}/{NN}/{NNN}/<file>
   │
   ▼
[Step 2] generateBrief
   │   [LLM콜 #1] brief-LLM (200~300자, sample 6KB)
   ▼
사용자: guide hint + Proceed
   │
   ▼
[Step 3] extract (Docling/markitdown/PyMuPDF/unhwp) — deterministic
   │   (PDF tier 4/5 만 vision-LLM, 본문 의미 X)
   ▼
[Step 4] applyPiiGate + decideReingest — deterministic
   │
   ├─ skip / skip-with-seed → 종료 (LLM 0 콜)
   │
   ▼ (force / protect)
[Step 5] Stage 1 + Stage 2
   │   [LLM콜 #2] summary-LLM (whole or truncated source)
   │   [LLM콜 #3..N+2] mention-LLM (FULL=1, SEGMENTED=N)
   ▼
[Step 6] Stage 3 canonicalize
   │   [LLM콜 #N+3] canonicalizer-LLM (doc-global, schema-guided)
   ▼
[Step 7] write pages + index + log + reindex — deterministic
   │
   ▼
~~[Step 8]~~ **D-wide 폐기 (2026-05-05, §5.10.4)** — Stage 1~4 self-extending
        (suggestion-detector / self-declaration / convergence) 모두 제거.
        ingest 후 추가 자동 처리 없음. canonResult → wiki write 직후 종결.

──────── 별도 트리거 ────────

사용자: 질문
   │
   ▼
[Step Q-1] korean-tokenize.py (deterministic)
   │   [LLM콜 #Q1] cross-lingual-LLM (Ollama 우선, 50 토큰)
[Step Q-2] qmd search (BM25 + vec + RRF) — deterministic
[Step Q-3] read top-N + 1-hop wikilink expansion — deterministic
   │   [LLM콜 #Q2] synthesis-LLM (확정적 답변, 1-hop 활용, 해요체)
   ▼
사용자: 답변 + 출처 + 원본 링크
   │
   ▼ (선택)
사용자: "이 답변 wiki/analyses/ 에 저장해" → Step 5~7 재진입
```

**평균 LLM 콜 수** (1 raw 인제스트, route=FULL): **3 콜** (summary + mention + canonicalize). Brief 포함 시 4 콜. classify-LLM 은 inbox 분류 시점 1 회.

---

## 12. 결정성·재현 가능성 보장

| 메커니즘 | 위치 | 효과 |
|----------|------|------|
| `WIKEY_EXTRACTION_DETERMINISM=1` | ingest-pipeline.ts:475 | summary/mention/canonicalize LLM 에 `temperature=0 + seed=42` 주입 → CV <15% |
| `JSON parse retry × 2` | callLLMWithRetry:1012 | 형식 깨짐 자동 복구 |
| `SLUG_ALIASES` + `.wikey/schema.yaml` `aliases` | canonicalizer.ts:55 + schema.ts | 30-run 측정 표기 변동 → canonical 강제 (D-wide 잔존 alias layer) |
| ~~`FORCED_CATEGORIES`~~ | ~~canonicalizer.ts:117~~ | **D-wide 폐기 (2026-05-05)** — LLM 자율 type 분류로 대체 |
| `convert-cache.ts` | computeCacheKey | 같은 source bytes → 같은 markdown 보장 |
| `section-index.ts` (deterministic parse) | parseSections | LLM-free 섹션 트리 — Route 판정·peer context 안정 |
| ~~Stage 2 suffix detector + Stage 4 union arbitration~~ | ~~suggestion/convergence~~ | **D-wide 폐기 (2026-05-05)** — self-extending 메커니즘 전체 제거 |
| Hook 1/2 (sidecar/source-page protect) | incremental-reingest.ts | 사용자 수정 보호 → ingest 재현성과 사용자 작업 양립 |

---

## 13. 관련 문서

- [`wikey.schema.md`](../wikey.schema.md) — 마스터 스키마 (단일 진실 소스)
- [`llm-wiki.md`](../llm-wiki.md) — Karpathy 원문 패턴
- [`docs/ingest-decomposition.md`](./ingest-decomposition.md) — 분해 전략 예시·운영 원칙
- [`docs/graphify-analysis.md`](./graphify-analysis.md) — wiki 그래프 구조 분석
- [`plan/plan-full.md`](../plan/plan-full.md) — 전체 로드맵 + Phase 별 spec
- [`plan/phase-5-todox-5.4-integration.md`](../plan/phase-5-todox-5.4-integration.md) — §5.4 4 Stage 통합 plan
- [`plan/phase-5-todox-5.10-graph-emergent-ontology.md`](../plan/phase-5-todox-5.10-graph-emergent-ontology.md) — paradigm shift 보조 plan
- [`activity/phase-5-result.md`](../activity/phase-5-result.md) — Phase 5 진행 timeline (§5.4 / §5.10)

---

## 14. 한 눈 요약

> **wikey 의 ingest 파이프라인은 "결정적 코드 + LLM 의 전략적 개입" 의 7:3 혼합.** 변환·PII gate·hash diff·페이지 write·인덱스 갱신은 모두 결정적이며, LLM 은 *분류 fallback (Step 1) → brief (Step 2) → summary + mention (Step 5) → canonicalize (Step 6) → 답변 합성 (Step Q)* 의 5 지점에만 개입한다. 이 분리가 곧 Karpathy 의 4 원칙 — *Explicit (LLM 행위는 모두 frontmatter + log 로 가시화), Yours (PII gate + sidecar 로컬), File over app (markdown + git), BYOAI (provider 교체 자유)* — 의 코드 구현이다.
>
> §5.10 paradigm shift 옵션 D-wide 채택 (2026-05-05) — Step 8 의 Stage 1~4 self-extending + Step 6 의 7-type schema gate / FORCED_CATEGORIES 폐기 완료. 단, Step 1~7 (alias normalization 잔존) + Step Q 는 무관 — wikey 의 본질 (raw → wiki 자동 누적, 멱등 갱신, 검색·합성 양끝 LLM 참여) 은 유지된다.
