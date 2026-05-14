# Wikey Ingest Pipeline v2 — 단계별 상세 분석

> **작성 기준**: 2026-05-07 master (Phase 5 §5.14 본체 종결 직후, commit `8c703fc`).
>
> **변경 정합 reference**: §5.10.4 D-wide ontology + §5.11 v2 promotion threshold + §5.12 source wikilink format + §5.13.A1/B2/C4/D follow-up + §5.14 BLUE refactor (Tier 2-4 + Layer 6 + sidebar-chat narrow). 모든 항목 master commit 에 반영됨.
>
> **이전 버전**: [`docs/architecture/wikey-ingest-pipeline.md`](./wikey-ingest-pipeline.md) — 2026-05-05 작성, §5.10.4 D-wide 채택 직후 시점. v2 와의 비표 평가는 §15 참조.
>
> **본 문서의 위치**: `wikey.schema.md` (마스터 스키마, Karpathy 4 원칙) + `llm-wiki.md` (원문 패턴) 의 *철학* 을 wikey 의 실제 코드 (`wikey-core/src/*.ts` + `wikey-obsidian/src/*.ts` + `scripts/*.sh`) 위에 매핑한 운영 가이드. 코드의 line 번호는 master `8c703fc` 기준이며, 별도 명시 없으면 `wikey-core/src/` 하위.

---

## 0. 철학 매핑 — llm-wiki.md ↔ wikey.schema.md ↔ 실제 파이프라인 (v2 갱신)

| llm-wiki.md 핵심 명제 | wikey.schema.md 매핑 | 파이프라인 구현 |
|---|---|---|
| "RAG 는 매 쿼리마다 지식을 *재발견* — 축적이 없다" | 3계층 아키텍처: `raw/` (불변) ↔ `wiki/` (LLM 누적) | Step 5~7 (mention → canonical → page write) 가 *멱등* 으로 wiki 갱신 |
| "지식은 한 번 컴파일되고 *최신 상태로 유지* 된다" | "탐색은 축적된다" 핵심 원칙 #3 | Step 0.5 incremental reingest (hash diff → force/protect/skip 5분기) |
| "단일 source 는 10–15 개 wiki 페이지를 건드린다" | "인제스트 분할 전략" §, 4 카테고리 분해 | Step 5/6 mention extractor → canonicalizer 가 entities/concepts/sources 로 fan-out |
| "사용자는 큐레이션·질문, LLM 은 *bookkeeping* 을 한다" | 역할 분담 표 (사용자=raw, LLM=wiki) | Step 1 (분류 LLM fallback) + Step 2 (brief preview) 만 사용자 승인, Step 5~7 모두 LLM + 결정적 코드 |
| "Obsidian 은 IDE, LLM 은 프로그래머, wiki 는 코드베이스" | "Obsidian 의 역할" § | wiki/ 는 markdown + frontmatter (BYOAI 호환), 검색은 qmd vendored, validate-wiki.sh 가 IDE-level lint |
| "*Explicit*: AI 가 무엇을 알고 모르는지 직접 본다" | 핵심 원칙 + 4가지 장점 | provenance frontmatter + index.md + log.md (모든 LLM 행위 추적) + `## 출처` v2 (sourcePageBase + raw wikilink 병기, §5.12 + §5.13.A1) |
| "*File over app*: 마크다운 + Unix 도구" | 4가지 장점 | sidecar `<src>.md` + `## 출처` 둘째 줄 raw wikilink 가 grep / fzf / open 호환 |

이 매핑이 깨지는 순간 wikey 는 *RAG 와 다를 게 없는 도구* 로 퇴화한다 — §5.10 paradigm shift 가 그 경계를 짚었고, §5.11/§5.12/§5.13 이 그 경계를 *코드 invariant* 로 강제한다.

---

## 1. 파이프라인 개요 — 8 step 매트릭스 (v2)

raw 파일 1 개가 wiki 페이지 N 개로 분해되기까지의 8 단계.

| Step | 이름 | 트리거 | 입력 | 결정적/LLM | LLM 개입 | 핵심 산출 | v2 변경점 |
|------|------|--------|------|-----------|----------|----------|----------|
| **1** | 인입·분류 (Inbox → PARA + Dewey) | 사용자가 `raw/0_inbox/` 에 추가 | filename, ext | 결정적 1차 + LLM 2차 fallback | classify-LLM (저가, JSON `{destination, reason}`) | `raw/{PARA}/NN_type/NNN_topic/` 경로 결정 | (v1 동일) |
| **2** | 인제스트 트리거 + Brief | Ingest 패널 / `llm-ingest.sh` | source path | LLM 1콜 (200~300자 요약) | brief-LLM (sample 6KB, sanitize) | 사용자 검토용 brief + guide hint 폼 | (v1 동일) |
| **3** | 변환 (Conversion) | brief 후 "Proceed" | binary/markdown source | 결정적 외부 도구 fork + cache | (PDF tier 4/5 만 vision-LLM) | unified markdown + paired sidecar `<src>.md` | (v1 동일) |
| **4** | PII gate + Reingest 결정 | 변환 직후 | markdown + raw bytes | 결정적 (regex + sha256) | 미개입 | redacted markdown + 5분기 action | sanitize 적용 지점 4개 (sourceContent / sidecar / `llmSourceFilename` / brief sample) |
| **5** | 추출 (Stage 1 Summary + Stage 2 Mention) | force/protect 분기 | markdown + sectionIndex | LLM N+1 콜 (summary 1 + mention 1 또는 N) | summary-LLM, mention-LLM | `IngestRawResult{source_page, …}` + `Mention[]` | **§5.13.C4 normalize** — `callLLMForSummary` 내부 `normalizeSourcePageFilename` 으로 `source-` prefix 강제 |
| **6** | 표준화 (Canonicalize) | mentions 수집 후 | `Mention[]` + 기존 wiki page list + `aliases` | LLM 1콜 (doc-global) | canonicalizer-LLM (자율 type 출력) | `entities[] / concepts[] / dropped[]` | **§5.11 v2 promotion gate** + **§5.12 sourcePageBase chain** + **§5.13.A1 rawSourceFilename arg** + **§5.14 BLUE extract** (`applyPromotionGate` / `buildCategoryPages` / `rebuildPageWithCrossLinks`) |
| **7** | 페이지 write + 인덱스 갱신 + reindex | canonicalize 결과 | `WikiPage[]` | 결정적 (idempotent createPage) | 미개입 | `wiki/sources/`, `wiki/entities/`, `wiki/concepts/`, `index.md`, `log.md` 갱신 + qmd reindex + freshness gate | **§5.14 Layer 6 freshness** — `runReindexAndWait` 가 `countWikiMdFiles(cwd)` 를 `expectMinIndexed` 로 전달 → 빈 collection silent-fresh 회귀 detect |
| ~~**8**~~ | ~~Self-extending~~ | **D-wide 폐기 (§5.10.4)** — Stage 1~4 (BUILTIN_STANDARD_DECOMPOSITIONS / suggestion / convergence / self-declaration) 모두 제거. | — | — | — | — |
| **Q** | 쿼리 (별도 트리거) | 사용자 질문 | 자연어 | LLM 2~3콜 + qmd 검색 | cross-lingual 키워드 추출 (Ollama 우선) + 합성 | answer + citations + 1-hop wikilink expansion + `원본:` footer | **citation 마커 폐기** — `attachCitationBacklinks` 호출 비활성, wikilink + `원본:` footer 만 |

각 step 의 상세는 §2 부터. **LLM 콜 횟수 합계** (1 raw, route=FULL): brief 1 + summary 1 + mention 1 + canonical 1 = **4 콜**. classify-LLM 은 inbox 분류 시점 1 회 (별도). SEGMENTED 면 mention N 콜 (core/support 섹션 수).

---

## 2. Step 1 — 인입·분류 (Inbox → PARA)

### 2.1 위치

- 코드: `classify.ts` (647 LOC)
- 데이터: `raw/CLASSIFY.md` (사용자 편집 가능 분류 규칙) + `raw/{1_projects, 2_areas, 3_resources, 4_archive, 9_assets}/`
- UI: Audit 패널 (`wikey-obsidian/src/sidebar-chat.ts`) row Action

### 2.2 분류 기준 — 2 단계 캐스케이드

#### (a) 결정적 1차 분류 (`classifyFile`, line 1~232)

확장자 + 파일명 토큰 매칭. LLM 호출 없음. (v1 매트릭스 참조 — v2 동일)

| 입력 | 규칙 | 예시 destination |
|------|------|------------------|
| `*.meta.yaml` | URI 참조 → destination 빈 문자열 (외부 처리) | `''` |
| 폴더 | LLM 판단 필요 | `raw/3_resources/` + `needsThirdLevel=true` |
| `*.pdf` + `(report|paper|논문|백서|리포트|분석)` | PDF_REPORT_RE 매칭 | `raw/3_resources/20_report/{Dewey}/` |
| `*.pdf` + `(manual|guide|datasheet|매뉴얼|가이드|핸드북)` | PDF_MANUAL_RE 매칭 | `raw/3_resources/30_manual/{Dewey}/` |
| `*.md \| *.txt` | 노트/기사 | `raw/3_resources/60_note/{Dewey}/` |
| `*.stl/.step/.obj/.3mf` | CAD | `raw/3_resources/40_cad/{Dewey}/` |
| `*.c/.h/.cpp/.ino/.py/.exe/.dll/.bin/.hex` | 소스코드/바이너리 | `raw/3_resources/50_firmware/{Dewey}/` |

3차 (Dewey Decimal 10 대분류 — DDC 표준 000~900) 매칭은 `withThirdLevel(hint2nd, basename)` 이 `DEWEY[]` 키워드 표 (한글/영문 약 200 단어) 와 토큰 매치. 미매치면 2차까지만 + `needsThirdLevel=true`.

#### (b) LLM 2차 fallback (`classifyWithLLM`, line 314~)

`needsThirdLevel=true` 또는 1차 destination 이 빈 문자열일 때 호출.

- **provider/model**: `resolveProvider('classify', config)` — 미지정 시 ingest 의 provider 승계, 저가 모델 override 가능.
- **prompt 입력 (4 블록)**:
  1. `raw/CLASSIFY.md` 원문 (사용자 정의 규칙, `cachedRules` 모듈-레벨 캐시)
  2. 분류 대상 (filename + isDir + 하드코딩 2차 hint)
  3. **기존 NNN_topic (4차) 폴더 목록** (`listExistingSlugFolders` — 재사용 우선 가이드)
  4. PARA pin 제약 (사용자가 UI 에서 PARA 강제 시)
- **출력**: `{ destination: "raw/3_resources/NN_type/NNN_topic/", reason: "한 문장 50자 이내" }` JSON. parser 는 `extractJsonBlock` 재사용 (`ingest-pipeline.ts`).
- **fallback 정책**: LLM 실패 / JSON parse 실패 → `hint2nd \|\| 'raw/3_resources/'` 보수적 default.

**왜 LLM 인가**: PARA 의 PR vs Area vs Resource 구분은 *시간성·계약 유무* 같은 의미 판단이라 토큰 매칭 부족. Dewey 4차 slug 도 사용자 vault 에서 점진 진화 — LLM 이 *기존 폴더 재사용 우선* 룰을 적용해야 자연스러움.

### 2.3 생성·수정 규칙

- **이동 (생성 X)**: 사용자 승인 후 `raw/0_inbox/<file>` → `<destination><file>` *이동만*. 내용 변경 없음 (불변 원칙).
- **재분류**: 같은 파일이 다른 destination 으로 다시 분류되어도 LLM 은 `raw/CLASSIFY.md` + 기존 폴더 목록을 매번 새로 읽어 결정.

### 2.4 v2 변경 사항

(v1 대비) 본 step 자체는 변경 없음. 단, §5.14 BLUE 의 historical 주석 cleanup 으로 line 카운트 일부 압축.

---

## 3. Step 2 — 인제스트 트리거 + Brief (LLM 사전 요약)

### 3.1 위치

- 코드: `ingest-pipeline.ts::generateBrief` (line 1299~1338)
- UI: `wikey-obsidian/src/ingest-modals.ts` (`FlowPhase = 'brief' | 'processing' | 'preview' | 'done'`)

### 3.2 동작

사용자가 Ingest 패널에서 raw 파일 선택 → Brief 모달 즉시 open (loading 상태) → `generateBrief()` 백그라운드 호출 → 200~300 자 요약 표시 → 사용자가 "guide hint" 자유 입력 + verify=on/off 선택 → "Proceed" 클릭.

### 3.3 LLM 개입 포인트 (1 콜)

```ts
// generateBrief (ingest-pipeline.ts:1299)
const llmSample = sanitizeForLlmPrompt(content.slice(0, 6000), { guardEnabled }, piiPatterns)
const llmFilename = sanitizeForLlmPrompt(filename, { guardEnabled }, piiPatterns)
const prompt = `다음 문서의 핵심 포인트를 2~4문장(총 150~300자)으로 요약하세요.
존댓말(해요체). 목록·제목·마크다운 없이 평문.

문서: ${llmFilename}
${llmSample}`
const resp = await llm.call(prompt, { provider, model, timeout: 60000 })
```

- **provider/model**: `resolveProvider('ingest', config)` 와 동일.
- **입력 가공 (4 layer)**:
  - `content.slice(0, 6000)` — 첫 6 KB 만
  - `sanitizeForLlmPrompt(sample)` — 사용자 PII 가 LLM 으로 새지 않도록
  - filename 도 `sanitizeForLlmPrompt(filename)` — Phase 5 §5.8.1 C-A1 leak 방지
  - PDF 처리: `extractPdfText` 의 `stripped` 만 사용 (sidecar 저장은 Step 3 본 ingest)
- **실패 처리**: brief 실패 = ingest 중단 X. 모달에 `(brief 생성 실패 · provider=... · model=...)` 표시 + Proceed 가능.

### 3.4 Brief 의 의미

llm-wiki.md "Ingest" §: *"I read the summaries, check the updates, and guide the LLM on what to emphasize."* — Brief 는 사용자가 본 인제스트 *전에* 핵심 파악 + guide hint 로 강조점 주입의 입구. guide hint 는 Stage 1 ingest prompt 의 `## 사용자 강조 지시` 블록으로 주입되어 entities/concepts 선별·요약을 사용자 의도로 편향 (`injectGuideHint`, line 1275).

### 3.5 분류·생성·수정 기준

- **생성 X**: brief 자체는 wiki 에 저장되지 않음 (대화 컨텍스트만).
- **결정**: Proceed → Step 3 (옵션: `preconverted` 주입으로 Step 1 분기 skip — `opts.preconverted`), Cancel → 흐름 종료.

---

## 4. Step 3 — 변환 (Conversion to Markdown)

### 4.1 위치

- 코드: `ingest-pipeline.ts` line 372~419 (확장자 분기) + `extractPdfText` (1819~) + `extractDocumentText` (1636~) + `extractHwpText` (1578~)
- 외부 도구: `docling`, `markitdown`, `pymupdf`, `unhwp`
- 캐시: `convert-cache.ts` (212 LOC, `~/.cache/wikey-conv/`)

### 4.2 변환 매트릭스

| 확장자 | 1차 컨버터 | fallback | 출력 |
|--------|----------|----------|------|
| `.md`, `.txt` | 직접 read + `stripEmbeddedImages` | — | content 그대로 (sidecar 미생성) |
| `.pdf` | docling tier 1 | tier 1a no-ocr / tier 2 markitdown / tier 3 PyMuPDF / tier 4 markitdown-OCR / tier 5 Vision OCR / tier 6 force-OCR | `{stripped, sidecarCandidate}` |
| `.docx, .pptx, .xlsx, .html, .csv, 이미지` | docling | — | unified markdown |
| `.hwp, .hwpx` | unhwp | — | markdown |
| (`opts.preconverted` 주입) | brief 단계에서 이미 변환됨 | — | sourceContent 직접 사용 (Step 1 분기 skip) |

`DOCLING_DOC_FORMATS` (ingest-pipeline.ts:114) 가 docling 라우팅 대상 확장자 set.

### 4.3 LLM 개입

**원칙적 LLM 미개입** — 변환은 *결정적·재현 가능* 해야 한다 (수정 1 줄 → 같은 markdown 보장 → §5 deterministic mode 와 짝).

**예외 단 한 곳** — PDF tier 4/5 (`extractPdfText`):
- markitdown-ocr 는 OpenAI-compatible vision API 요구 → Anthropic 키만 있으면 *Ollama vision fallback* (LlaVA 등) 으로 자동 분기.
- 이 분기에서만 *이미지 → 텍스트* 변환에 vision LLM 호출. 본문 의미 분석 LLM 은 절대 아님.

### 4.4 캐싱 (재실행 안정성)

`convert-cache.ts` 의 `computeCacheKey({sourceBytes, converter, majorOptions})` → `~/.cache/wikey-conv/` 에 markdown stash. 같은 파일 재 ingest 시 변환 step skip → LLM step 만 새로 돈다.

### 4.5 Sidecar (paired markdown)

PDF/HWP/DOCX 등 비-markdown 원본은 변환된 markdown 을 `<source>.md` 로 *원본 옆에* 저장 (line 474~505).

```ts
const defaultSidecarPath = `${sourcePath}.md`   // canonical
const target = await protectSidecarTargetPath(sourcePath, wikiFS)  // protect = .md.new[.1~.9]
```

이유:
- llm-wiki.md "Yours / File over app": 사용자가 *LLM 이 본 텍스트* 를 직접 검증 가능
- §5.3.1 sidecar_hash 로 사용자 수정 감지 → reingest 보호 (Step 4 Hook 1)

### 4.6 품질 자동 평가 (`scoreConvertOutput`)

`convert-quality.ts` (344 LOC) — 한국어 공백 손실률, 페이지당 character count, 이미지 OCR 오염률 등으로 retry 결정. 결정적 score.

### 4.7 v2 변경 사항

(v1 대비) 본 step 자체는 변경 없음. tier 6 force-OCR 분기는 `defaultOcrEngine()` (line 1710) + `defaultOcrLangForEngine()` 으로 ocrmac (macOS) / RapidOCR (Linux fallback) / Tesseract 자동 선택.

---

## 5. Step 4 — PII Gate + Reingest 결정

### 5.1 위치

- 코드: `pii-redact.ts` (514 LOC, `applyPiiGate`) + `pii-patterns.ts` (428 LOC) + `incremental-reingest.ts` (366 LOC, `decideReingest`)
- 데이터: `~/.config/wikey/pii-patterns.yaml`, `<basePath>/.wikey/pii-patterns.yaml`, `.wikey/source-registry.json`

### 5.2 PII Gate (2-layer)

#### (a) 패턴 로드 — *하드코딩 금지* (사용자 영구 결정)

```ts
const piiPatterns = loadPiiPatterns(opts?.basePath)
// (1) <basePath>/.wikey/pii-patterns.yaml
// (2) ~/.config/wikey/pii-patterns.yaml
// (3) DEFAULT_PATTERNS (compileDefaults)
```

`feedback_pii_no_hardcoding.md` 명시 — PII 패턴은 코드 분리 + YAML override.

#### (b) 2-layer 옵션

| 옵션 | 기본 | 의미 |
|------|------|------|
| `guardEnabled` (advanced) | `true` | `false` = PII 검사 자체 skip (사용자 신뢰 경계) |
| `allowIngest` (basic) | `false` | `false` + PII 감지 → `PiiIngestBlockedError` throw |
| `mode` | `mask` | `display \| mask \| hide` (치환 방식) |

#### (c) 적용 지점 (4 곳)

ingest-pipeline.ts line 421~463 + line 446 (filename) + line 450~462 (sidecar) + generateBrief (line 1299~).

| 적용 대상 | 호출 |
|-----------|------|
| `sourceContent` (LLM 입력 본문) | `applyPiiGate(sourceContent, {guardEnabled, allowIngest, mode})` |
| `pdfSidecarCandidate` (디스크 저장 sidecar) | `applyPiiGate(pdfSidecarCandidate, {guardEnabled, allowIngest:true, mode})` (이미 본문 gate 통과 → throw 방지) |
| `llmSourceFilename` (LLM prompt metadata) | `sanitizeForLlmPrompt(sourceFilename, {guardEnabled}, piiPatterns)` — Phase 5 §5.8.1 C-A1 |
| `brief` 호출 sample + filename | `generateBrief` 내부 `sanitizeForLlmPrompt` 2회 |

**LLM 개입 X** — 모두 결정적 regex.

### 5.3 Reingest 결정 (`decideReingest`)

raw bytes hash + registry diff 를 collect-then-decide 패턴으로 처리 (incremental-reingest.ts head comment).

#### Phase A — conflicts 수집 (short-circuit X)

| conflict kind | 조건 |
|---------------|------|
| `sidecar-user-edit` | registry.sidecar_hash ≠ disk sidecar hash |
| `source-page-user-edit` | wiki/sources/source-*.md 에 `## 사용자 메모` H2 존재 |
| `duplicate-hash` | 같은 hash 가 다른 path 에 등록됨 (`R_byHash != null && R_byPath == null`) |
| `legacy-no-sidecar-hash` | hash 변경 + 기존 sidecar 존재하지만 hash 미기록 |
| `unmanaged-paired-sidecar` | registry 미등록 + disk paired sidecar 존재 (사용자가 미리 만들어 둔 변환본) |

#### Phase B — action 결정 (5 분기)

| 시나리오 | action | reason |
|---------|--------|--------|
| `R == null` (신규) + conflict 0 | `force` | `new-source` |
| `R_byHash != null && R_byPath == null` | `skip` | `duplicate-hash-other-path` (duplicate_locations append) |
| `R.hash == H_now` + sidecar_hash 미존재 + disk sidecar 있음 | `skip-with-seed` | `hash-match-sidecar-seed` (legacy 첫 hash-match — sidecar_hash 만 채움) |
| `R.hash == H_now` + sidecar 일치 | `skip` | `hash-match` (LLM/page write 0) |
| `R.hash == H_now` + sidecar disk diff | `skip` | `hash-match-sidecar-edit-noted` |
| `R.hash != H_now` + conflict 0 | `force` | `hash-changed-clean` |
| `R.hash != H_now` + conflict ≥1 + onConflict | `prompt` | `hash-changed-with-conflicts` (사용자 UI 선택) |
| `R.hash != H_now` + conflict ≥1 + UI 없음 | `protect` | `hash-changed-with-conflicts` |
| `opts.forceReingest === true` (caller override) | `force` | `hash-changed-clean` (skip → force 강제) |

★ KEY INVARIANT: `sourceBytes` MUST be raw disk bytes — NEVER post-conversion text. `readRawDiskBytes` (line 216) 가 basePath 우선 fs.readFileSync, 없으면 wikiFS.read → TextEncoder.encode 폴백.

### 5.4 Hook 1/2 (사용자 작업 보호)

- **Hook 1 (sidecar protect)**: protect 모드에서 sidecar 를 `.md.new[.1~.9]` 로 격리 저장, canonical 보존 + `pending_protections` 기록. `protectSidecarTargetPath` (incremental-reingest.ts:116) 가 비-충돌 target 결정, 0~9 모두 점유 시 `IngestProtectionPathExhaustedError` throw.
- **Hook 2 (source page user-marker preserve)**: 기존 `wiki/sources/source-*.md` 에서 `## 사용자 메모` (또는 `## User Notes` / `## 메모`, `USER_MARKER_HEADERS`) 블록 추출 → LLM 생성 본문에 merge (idempotent). entity/concept 페이지는 LLM determinism risk 로 미커버 (post-follow-up #4).

### 5.5 분류·생성·수정 기준

- **분류**: action 5 종류 중 1 (force / protect / prompt / skip / skip-with-seed).
- **생성·수정**:
  - `force`: 모든 wiki page overwrite + sidecar canonical write
  - `protect`: sidecar `.md.new[.N]` 격리, source page 는 user marker merge 후 write
  - `skip*`: LLM 0 콜, page write 0 (registry 만 갱신)

### 5.6 v2 변경 사항

(v1 대비) 본 step 자체 동작은 변경 없음. action enum 의 `prompt` 분기는 caller 가 `opts.onConflict` callback 제공 시만 활성 (변경 X). PII pattern engine 의 default rule set + custom override shape 은 §5.10.4 D-wide 결정으로 schema.yaml 에서 분리되어 별 file (`.wikey/pii-patterns.yaml`) 로 이동 — 이 변경은 v1 시점에 이미 반영됨.

---

## 6. Step 5 — 추출 (Stage 1 Summary + Stage 2 Mention)

### 6.1 위치

- 코드: `ingest-pipeline.ts::callLLMForSummary` (line 881~893), `extractMentions` (979~999), `BUNDLED_INGEST_PROMPT` (line 1441~1521), `BUNDLED_STAGE2_MENTION_PROMPT` (line 1002~1051)
- Override: `.wikey/stage1_summary_prompt.md` (loadEffectiveStage1Prompt), `.wikey/stage2_mention_prompt.md` (loadEffectiveStage2Prompt), `.wikey/stage3_canonicalize_prompt.md` (loadEffectiveStage3Prompt)
- Route 결정: `provider-defaults.ts::selectRoute` (line 121~125, token budget 기반)

### 6.2 Route 결정 — `selectRoute`

```ts
// provider-defaults.ts:121
export function selectRoute(md: string, provider: string, model: string): 'FULL' | 'SEGMENTED' {
  const b = getProviderBudget(provider, model)
  const usable = b.contextTokens * (1 - b.outputReserve) - b.promptOverhead
  return estimateTokens(md) <= usable ? 'FULL' : 'SEGMENTED'
}
```

- `estimateTokens` 휴리스틱: 영문 0.25 token/char, 한국어 0.67 token/char, mixed 0.4 token/char + 30% margin
- FULL: summary 1 + mention 1 + canonical 1 = 3 LLM 콜
- SEGMENTED: summary 1 + mention N (core+support priority 섹션) + canonical 1
- Ollama 같은 소형 context (`contextTokens` 작음) 는 대부분 SEGMENTED

`section-index.ts::buildSectionIndex` (line 106) 가 markdown 을 결정적 섹션 트리로 파싱 — heading + body + warnings + heuristic priority.

### 6.3 LLM 개입 포인트 (a) — Summary (Stage 1, 1 콜)

```ts
// ingest-pipeline.ts:881
async function callLLMForSummary(...): Promise<IngestRawResult> {
  const prompt = buildIngestPrompt(sourceContent, sourceFilename, indexContent, promptTemplate)
  const parsed = await callLLMWithRetry(llm, prompt, provider, model, deterministic)
  // §5.13.C4: LLM emit drift 방어 — `source_page.filename` 의 `source-` prefix 강제.
  return normalizeSourcePageFilename(parsed)
}
```

- **provider/model**: `resolveProvider('ingest', config)` (Gemini 2.5 Flash 기본).
- **입력**: `{{TODAY}}` + `{{INDEX_CONTENT}}` (기존 wiki/index.md) + `{{SOURCE_FILENAME}}` (sanitized) + `{{SOURCE_CONTENT}}` (Ollama 면 `truncateSource(text)` — TRUNCATE_LIMIT=12000).
- **guide hint 주입**: `injectGuideHint(template, guideHint)` (line 1275) 가 `## 사용자 강조 지시` 블록 추가.
- **출력 schema** (JSON):
  ```json
  {
    "source_page": {"filename": "source-...md", "content": "..."},
    "index_additions": ["- [[...]] — ..."],
    "log_entry": "...",
    "guide_reflection": "..."
  }
  ```
- **`entities/concepts` 는 무시** — v6 부터 mention extractor + canonicalizer 로 분리.
- **deterministic mode** (`WIKEY_EXTRACTION_DETERMINISM=true`): `temperature=0 + seed=42` 주입 → CV <15% 보장.
- **재시도**: `MAX_JSON_RETRIES=2`. JSON parse 실패 → `extractJsonBlock` (코드 블록 → bare object 순서) → 재시도.

#### §5.13.C4 normalize (NEW v2)

```ts
// ingest-pipeline.ts:903 — export 됨 (테스트 가능)
export function normalizeSourcePageFilename(parsed: IngestRawResult): IngestRawResult {
  if (!parsed.source_page?.filename) return parsed
  const original = parsed.source_page.filename
  if (original.startsWith('source-')) return parsed
  console.warn(`[Wikey ingest] LLM emit drift — auto-normalizing source_page.filename: ${original} → source-${original}`)
  return {
    ...parsed,
    source_page: { ...parsed.source_page, filename: `source-${original}` },
  }
}
```

LLM 이 prompt 의 `source_page.filename 은 반드시 source- prefix` 명시를 무시하고 `pmbok.md` / `raw-pmbok.md` / `archive-pmbok.md` 같은 변형 emit 하는 케이스를 force prepend. assembleCanonicalResult 의 `sourcePageBase derive` (`normalizeBase`) 보다 *먼저* 진행 → entity/concept `## 출처` 의 `[[<sourcePageBase>|...]]` wikilink 가 §5.12 paradigm (wiki/sources/source-*.md 단일 진실) 정합 유지. **1차 방어선 = prompt 강제 문구 (line 1467), 2차 방어선 = 본 함수 (defense in depth).**

### 6.4 LLM 개입 포인트 (b) — Mention extraction (Stage 2)

```ts
// ingest-pipeline.ts:979
async function extractMentions(
  llm, chunkContent, sourceFilename, provider, model, chunkIdx, deterministic, promptTemplate
): Promise<Mention[]> {
  const template = promptTemplate ?? BUNDLED_STAGE2_MENTION_PROMPT
  const prompt = template
    .replaceAll('{{SOURCE_FILENAME}}', sourceFilename)
    .replaceAll('{{CHUNK_CONTENT}}', chunkContent)
  const raw = await callLLMWithRetry(llm, prompt, provider, model, deterministic)
  const mentions = ((raw as any).mentions ?? [])
  return mentions
    .filter((m) => m.name && m.name.trim().length > 0)
    .map((m) => ({
      name: m.name!.trim(),
      type_hint: (m.type_hint as Mention['type_hint']) ?? 'unknown',
      evidence: (m.evidence ?? '').trim(),
      source_section_idx: chunkIdx,
    }))
}
```

- **콜 횟수**: FULL=1, SEGMENTED=N (core/support priority 섹션 수, `computeHeuristicPriority` 가 `'skip' | 'core' | 'support'` 결정).
- **prompt 의 핵심** (BUNDLED_STAGE2_MENTION_PROMPT, §5.11 v2 갱신):
  - "분류하지 마세요. 페이지를 만들지 마세요. 단지 wiki 후보를 짧게 나열만 하세요."
  - 출력: `{name, type_hint, evidence}`. `type_hint` 자유 string (organization / person / methodology / algorithm / dataset / event / regulation 등).
  - 명시 거부: UI 라벨, 기능명 (X-management), 비즈니스 객체 (quotation/order), 한국어 일반 명사.
  - **§5.11 v2 핵심 변경**: "수가 적어도 (1~3개) 관계없음. 페이지 의도와 직접 관련된 명확한 entity/concept 만." — 이전 cap (청크당 0~15개) 폐기, *의미·관련도 기반 promotion* 으로 패러다임 전환. canonicalizer 의 deterministic gate (Step 6 §7.3) 와 짝.
- **SEGMENTED 의 peer context**: `formatPeerContext(sectionIndex, currentIdx, 300)` (section-index.ts:120) — DOC_OVERVIEW + GLOBAL_REPEATERS + prev/next 섹션 1줄 요약 → 섹션 LLM 이 *문서 전체* 를 일부라도 보게 보장.

### 6.5 추출 기준 (분류·생성·수정 가이드)

| 행위 | 기준 |
|------|------|
| **mention 생성** | 산업표준 용어, 회사·인물·제품·도구 고유명, 정식 문서 유형. evidence 1 문장 (200자 이내). |
| **mention 거부** | UI 라벨, 단순 기능명, 비즈니스 객체, 한국어 일반 명사, 단순 출처/장소/단편 사실 (§5.11 v2 추가). LLM 자체 거부. |
| **source_page 생성** | summary LLM 이 항상 1 개. 멱등 (filename 같으면 update). `normalizeSourcePageFilename` 으로 prefix 강제. |
| **source_page 수정** | `appendSectionTOCToSource(content, sectionIndex)` (line 1211) 가 결정적 섹션 TOC append (Phase C enablement). |

### 6.6 v2 변경 사항 vs v1

| 영역 | v1 | v2 |
|------|----|----|
| Stage 2 prompt cap | "청크당 0~15 개. 모르는 것보다 빠뜨리는 게 낫습니다." | **§5.11 v2** — 수량 cap 폐기, "수가 적어도 (1~3개) OK. 페이지 의도와 직접 관련만." |
| `source_page.filename` 보장 | LLM emit 따라 (drift 가능) | **§5.13.C4** — `callLLMForSummary` 내부에서 `normalizeSourcePageFilename` 강제 (defense in depth) |
| Stage 1 prompt | filename 형식 가이드 ("소스 페이지: source-{name}.md") | **§5.13.C4** — `**source_page.filename 은 반드시 source- prefix 로 시작**` 강제 문구 추가 (1차 방어선) |
| 한국어 alias | 영문 base + 한국어 표기 alias 일반 가이드 | **§5.11 v2** — `name` (원문 언어 base) ↔ `aliases` (반대 언어 transliteration) 명시 + `display_name` 원문 표기 보존 (frontmatter title + H1 매칭) |

### 6.7 schema 매핑

> wikey.schema.md "인제스트 분할 전략" §. raw 1개 → wiki N개 (5~15 권장 범위, §5.11 v2 후 단순 서류는 1~3개도 OK). Step 5 mention extractor 가 *후보 풀* 을 만든다 — 어떤 mention 이 페이지가 될지는 Step 6 가 결정.

---

## 7. Step 6 — 표준화 (Canonicalize, v2 핵심 변경)

### 7.1 위치

- 코드: `canonicalizer.ts` (659 LOC)
- 데이터: `.wikey/schema.yaml` (사용자 `aliases:` 만 — D-wide 후 entity_types/concept_types/standard_decompositions/custom_types/pii_patterns 모두 폐기)
- BLUE 추출 함수 (§5.14): `applyPromotionGate` (line 321) / `buildCategoryPages` (line 354) / `rebuildPageWithCrossLinks` (line 547)

### 7.2 시그니처 chain (v2 핵심)

§5.12 + §5.13.A1 으로 6 함수 시그니처에 **2 인자 chain** 이 추가됨:

```ts
// canonicalizer.ts:117~131
export interface CanonicalizeArgs {
  ...
  /** §5.13.A1: PII-mask 적용 안 된 원본 raw basename (raw wikilink target). */
  readonly rawSourceFilename: string
  /** §5.12: wiki/sources/<sourcePageBase>.md 단일 진실 소스 base. */
  readonly sourcePageBase: string
  ...
}
```

| 함수 | 시그니처 추가 |
|------|---------------|
| `canonicalize` (line 167) | `rawSourceFilename, sourcePageBase` |
| `assembleCanonicalResult` (line 380) | 동일 |
| `buildCategoryPages` (line 354) | 동일 |
| `validateAndBuildPage` (line 454) | 동일 |
| `buildPageContent` (line 489) | 동일 |
| `applyCrossLinks` (line 589) | 동일 |
| `rebuildPageWithCrossLinks` (line 547) | 동일 |

ingest-pipeline.ts 의 양 route (FULL line 569~578 + SEGMENTED line 626~636) 가 호출 시:

```ts
parsed = await canonicalizeAndAssembleParsed({
  ...
  llmSourceFilename, rawSourceFilename: sourceFilename,
  summaryParsed, today, ...
  sourceBody: <route 별 다름>,
  log,
})
```

`canonicalizeAndAssembleParsed` (ingest-pipeline.ts:922, **§5.14.B BLUE extract**) 가 양 route 의 stage 2.3 canonicalize 호출 + dropped sample log + IngestRawResult assembly 공통화. mentions / sourceBody 만 route 별 다르고 나머지 동일.

### 7.3 LLM 개입 포인트 — doc-global 1 콜

```ts
// canonicalizer.ts:167
export async function canonicalize(args: CanonicalizeArgs): Promise<CanonicalizedResult> {
  const prompt = buildCanonicalizerPrompt({
    mentions, existingEntityBases, existingConceptBases,
    sourceFilename, guideHint, schemaOverride, overridePrompt,
  })
  const raw = await callLLMWithRetry(llm, prompt, provider, model, deterministic)
  return assembleCanonicalResult(raw, mentions, sourceFilename, rawSourceFilename, sourcePageBase, today, userAliases, sourceBody)
}
```

- **provider/model**: ingest 와 동일 (single-doc-global 한 콜이라 quality 우선 — Gemini 2.5 Pro 권장).
- **prompt 입력 (D-wide 갱신, §5.11 v2 + §5.13 시그니처)**:
  1. 기존 wiki 페이지 base name 목록 (`existingEntityBases ∪ existingConceptBases`, 최대 80 개) → *재사용 우선*.
  2. mention 리스트 (Stage 2 산출, evidence 200 자 이내).
  3. `aliasBlock` — `.wikey/schema.yaml` 의 `aliases` (canonical slug normalization).
  4. `guideBlock` — 사용자 강조 지시.
  5. **§5.11 v2 promotion threshold prompt 블록** — "페이지 의도·관련도 기준. 단순 출처/장소/단편 사실 제외. 수량 제한 없음 — 수가 적어도 OK."
  6. **§5.11 v2 원문 언어 중심 alias 블록** — "한국어 source → name=한국어 base, aliases=[영어 transliteration / 표준 영문 약어]. 영어 source → 반대."

### 7.4 §5.11 v2 Page Promotion Threshold (NEW v2 핵심)

#### Layer 1 — LLM prompt 의 의미·관련도 가이드 (위 §7.3.5)

#### Layer 2 — `applyPromotionGate` deterministic gate (line 321~344)

```ts
const PROMOTION_THRESHOLD = 2

function applyPromotionGate(
  rawPages: readonly RawPage[],
  sourceBody: string | undefined,
  userAliases?: Readonly<Record<string, string>>,
): { allowed: readonly RawPage[]; drops: Map<string, string> } {
  if (sourceBody === undefined) {
    return { allowed: rawPages, drops: new Map() }   // backward compatible
  }
  const drops = new Map<string, string>()
  const allowed: RawPage[] = []
  for (const p of rawPages) {
    const occ = countOccurrences(p.name ?? '', p.aliases ?? [], sourceBody)
    if (occ < PROMOTION_THRESHOLD) {
      const reason = `single-mention (${occ} occurrence) — not promoted to page`
      drops.set(canonicalizeSlug(normalizeBase(p.name ?? ''), userAliases), reason)
      for (const alias of p.aliases ?? []) {
        drops.set(canonicalizeSlug(normalizeBase(alias), userAliases), reason)
      }
      continue
    }
    allowed.push(p)
  }
  return { allowed, drops }
}
```

#### `countOccurrences` 의 한국어 변형 처리 (line 293)

```ts
function countOccurrences(name: string, aliases: readonly string[], sourceBody: string): number {
  const base = [name, ...aliases].map((s) => s.trim()).filter((s) => s.length > 1)
  // §5.11 v2 한국어 대응 — 하이픈 ↔ 공백 변형 모두 substring search
  const candidates = Array.from(
    new Set(base.flatMap((c) => (c.includes('-') ? [c, c.replace(/-/g, ' ')] : [c]))),
  )
  const haystack = sourceBody.toLowerCase()
  let total = 0
  for (const c of candidates) {
    const needle = c.toLowerCase()
    if (!needle) continue
    let idx = 0
    while ((idx = haystack.indexOf(needle, idx)) !== -1) {
      total++
      idx += needle.length
    }
  }
  return total
}
```

- **threshold = 2**: 1회만 mention 된 고유명사는 페이지로 promote 안 됨 (단순 출처·장소·단편 사실 차단).
- **한국어 변형**: `'전라남도-테크노파크'` base 가 본문 `'전라남도 테크노파크'` 와도 매치 (하이픈 ↔ 공백).
- **length ≤ 1 candidate 제외**: false positive 방지 (단일 문자).
- **alias 누적 카운트**: `name + aliases` 모든 변형의 substring count 합산.

#### `dropped[]` 추적 with reason

```ts
// canonicalizer.ts:407~417
const dropped: Array<{ mention: Mention; reason: string }> = []
for (const m of mentions) {
  const base = canonicalizeSlug(normalizeBase(m.name), userAliases)
  if (pinnedBases.has(base)) continue
  // §5.11: prefer the precise promotion-threshold reason over the generic fallback.
  const reason = promotionDrops.get(base) ?? computeDropReason(m)
  dropped.push({ mention: m, reason })
}
```

ingest-pipeline 양 route 가 dropped sample 을 console log 로 surface (line 959~962, **§5.14.B BLUE 후**):

```
stage 2.3 canonicalize done in 4521ms — entities=6, concepts=8, dropped=4
dropped sample: 회의실 (single-mention (1 occurrence) — not promoted to page), 결재시스템 (single-mention ...), +2 more
```

### 7.5 §5.12 Source Wikilink Format (v2 핵심)

`buildPageContent` (line 489~538) 가 entity/concept 페이지의 `## 출처` 섹션 생성:

```ts
// canonicalizer.ts:519~537
return `---
title: ${titleValue}
type: ${category}
${typeField}
${aliasesField}created: ${today}
updated: ${today}
sources: [${sourceFilename}]
tags: []
---

# ${titleValue}

${description}

${relatedSection}## 출처

- [[${sourcePageBase}|${sourceDisplay}]]
- [[${rawSourceFilename}|원문]]
`
```

- **첫 줄** `[[<sourcePageBase>|<sourceDisplay>]]` — wiki/sources/<sourcePageBase>.md 단일 진실 소스 매칭 (§5.12).
  - `sourcePageBase = normalizeBase(summaryParsed.source_page.filename)` (ingest-pipeline.ts:947) — LLM emit drift 방어 + §5.13.C4 normalize 결과의 derive.
  - 예: `[[source-pmbok-overview|pmbok-overview]]`.
- **둘째 줄** `[[<rawSourceFilename>|원문]]` — Obsidian basename matcher 가 raw/<bucket>/<rawSourceFilename> 매칭 (§5.13.A1).
  - `rawSourceFilename = sourceFilename` (mask 안 된 원본). PII guard ON 시 sourceFilename 은 mask 적용된 형식이라 raw wikilink target 으로 부적합 → 별도 인자.
  - 예: `[[pmbok-overview.md|원문]]`.
- **`## 관련` 섹션**: optional sandwich — entity ↔ concept cross-link (§5.2.1). `relatedLinks` 비어있으면 section 자체 생략 (no empty H2).

### 7.6 §5.14.A BLUE 추출 함수 (코드 quality)

| 함수 | 위치 | 책임 |
|------|------|------|
| `applyPromotionGate` | line 321 | entity/concept 공통 substring-count drop logic. raw / drops 분리 반환. |
| `buildCategoryPages` | line 354 | 단일 카테고리 (entity 또는 concept) build — promotion gate → validateAndBuildPage. concept pass 는 cross-pool dedup 적용 (entity 와 같은 base 면 skip). `keptBases` Set mut. |
| `rebuildPageWithCrossLinks` | line 547 | 단일 페이지 + `## 관련` cross-link section rebuild. `extractFrontmatterScalar(title)` + `extractFrontmatterList(aliases)` 로 §5.10.4 P2-1 원문 표기 보존. |
| `RawPage` interface | line 314 | LLM emit 의 mention shape (`name?`, `display_name?`, `type?`, `description?`, `aliases?`). |

이전 (§5.14 전) 의 `assembleCanonicalResult` 가 entity loop + concept loop + dropped tracking + cross-link 4 책임 혼재 (~100 LOC) → BLUE 후 helper 3 개로 분해 + main flow 50 LOC.

### 7.7 분류 (D-wide LLM 자율, §5.10.4)

D-wide 채택 후 entity/concept *type* 분류는 LLM 자율. 7-type union (organization/person/product/tool/standard/methodology/document_type) + `CONCEPT_DECISION_TREE` + `FORCED_CATEGORIES` 강제 pin 모두 폐기.

| 영역 | D-wide 동작 |
|------|------------|
| entity / concept *카테고리* (대분류) | wiki/entities/ vs wiki/concepts/ 디렉토리 구분으로 보존 |
| entity / concept *type* (세분류) | LLM 자율 string 출력. 도메인별 자유 (PMBOK → `process`/`knowledge_area`. 잡지 → `event`/`trend`) |
| alias 정규화 | `canonicalizeSlug(normalizeBase(name), userAliases)` + `.wikey/schema.yaml` `aliases` (다국어 / 동명이인 / 약어) |
| dedup | 같은 slug entity ↔ concept 동시 등장 시 concept keep (보존 layer) |

### 7.8 동시-cycle entity ↔ concept 자동 link (`applyCrossLinks`)

같은 cycle 의 entity 페이지에 `## 관련` H2 + 모든 concept 의 wikilink 추가 (역방향도). `rebuildPageWithCrossLinks` 호출 — 결정적, LLM 비개입.

### 7.9 분류·생성·수정 기준 (v2)

| 행위 | 기준 |
|------|------|
| **새 페이지 생성** | mention → canonical slug 가 기존 wiki page 목록에 없음 + `applyPromotionGate` 통과 (§5.11 v2 substring count ≥ 2) + `validateAndBuildPage` 통과 (empty name/type 거부) |
| **기존 페이지 재사용** | LLM prompt 의 "기존 wiki 페이지" 목록과 base 매칭 → filename 그대로 재사용 |
| **수정 (overwrite)** | 같은 slug 가 다시 mention 됨 → `createPage` 멱등 write |
| **drop** | (a) `single-mention` (§5.11 v2 promotion gate) — 1회만 substring 등장. (b) `empty name` / `empty type` — minimal validation. (c) `cross-pool dedup` — entity 와 concept 동시 등장 시 concept drop. dropped reason 정확 surface. |

---

## 8. Step 7 — 페이지 write + 인덱스 갱신 + reindex (결정적, LLM X)

### 8.1 위치

- 코드: `wiki-ops.ts` (512 LOC)
  - `createPage` (line 267) / `injectSourceFrontmatter` (line 23) / `injectProvenance` (line 44) / `updateIndex` (line 319) / `appendLog` (line 410)
- reindex: `ingest-pipeline.ts::runReindexAndWait` (line 2361) + `scripts-runner.ts::reindexQuick / waitUntilFresh` (line 113 / 171) + `scripts/reindex.sh` (`cmd_reindex` / `cmd_check_json`)

### 8.2 write 순서 (line 666~854)

1. **Source page**:
   - `appendSectionTOCToSource(content, sectionIndex)` → `## 섹션 인덱스` append (idempotent, line 1211).
   - Hook 2 user marker merge (`isSourcePageProtect` 시 `mergeUserMarkers(llmSourceBody, preservedMarkers)`).
   - `injectSourceFrontmatter` 로 v3 frontmatter (`source_id, vault_path, sidecar_vault_path, hash, size, first_seen`) 주입.
   - `wiki/sources/source-*.md` write (멱등 — 존재하면 update).
2. **Source registry upsert** (`registryUpsert`) + sidecar_hash 갱신 (canonical write 한 경우만, `isCanonicalSidecarWritten` flag) + protect 분기 시 `pending_protections` append (`appendPendingProtection`).
3. **Entity / Concept pages**:
   - `injectProvenance(content, [{type:'extracted', ref:'sources/<source_id>'}])` → frontmatter 의 provenance 배열 append (dedupe, `dedupeProvenance`).
   - `wiki/entities/<base>.md` / `wiki/concepts/<base>.md` write.
4. **Index update**:
   - `tagged = parsed.index_additions ?? []` 의 each entry → first wikilink 매칭으로 category 자동 분류 (line 823~831).
   - `updateIndex(wikiFS, tagged, writtenPages)` — LLM `index_additions` + 결정적 backfill (LLM 누락 페이지 자동 등재, `extractFirstSentence` 로 한 줄 설명 생성).
5. **Log append**:
   - `appendLog(wikiFS, entry, writtenPages)` — LLM `log_entry` 또는 결정적 헤더 (`## [YYYY-MM-DD] ingest | <filename>`). `stripBrokenWikilinks` 로 dropped 페이지 link 제거 (line 460).
6. **Reindex** — `runReindexAndWait` (다음 §8.3).

### 8.3 §5.14 Layer 6 freshness gate (NEW v2)

```ts
// ingest-pipeline.ts:2361
async function runReindexAndWait(basePath, execEnv, log, onIssue, onOk): Promise<void> {
  const cwd = basePath ?? process.cwd()
  ...
  try {
    await reindexQuick(cwd, env, timeoutMs)
    log(`reindex --quick OK in ${Date.now() - t0}ms, waiting for freshness (timeout=${timeoutMs}ms)`)
  } catch (err) {
    onIssue?.('reindex-failed', errorMessage(err))
    return
  }
  try {
    // §5.14 Layer 6: pass wiki/.md count as expectMinIndexed so waitUntilFresh detects
    // collection-empty silent-fresh 회귀 (qmd query 0-result symptom).
    const expectMinIndexed = countWikiMdFiles(cwd)
    await waitUntilFresh(cwd, env, timeoutMs, undefined, expectMinIndexed)
    log(`index is fresh (total ${elapsed}ms, expected ${expectMinIndexed} indexed)`)
    onOk?.(elapsed)
  } catch (err) {
    onIssue?.('freshness-timeout', errorMessage(err))
  }
}

// ingest-pipeline.ts:85
function countWikiMdFiles(cwd: string): number {
  // recursive find of wiki/**.md (excluding hidden dirs)
  ...
}
```

`waitUntilFresh` (scripts-runner.ts:171) 가 `expectMinIndexed` 인자로 polling gate 추가:

```ts
// scripts-runner.ts:188
const indexedOk = expectMinIndexed === 0 || res.indexed === -1 || res.indexed >= expectMinIndexed
if (res.status === 'fresh' && res.stale === 0 && indexedOk) return
```

`reindex.sh` (line 96~126) 의 `cmd_check_json` 이 `indexed` 필드 채움:

```bash
# §5.14 L6: indexed count — sqlite 미가용 시 -1 (caller 가 legacy 로 처리)
indexed=$(sqlite3 "${HOME}/.cache/qmd/index.sqlite" "SELECT count(*) FROM documents WHERE active=1;" 2>/dev/null || echo "-1")
# Schema: { "stale": number, "status": "fresh" | "stale" | "never", "indexed": number }
```

#### Layer 6 의 진단 가치

이전 (§5.14 전) `waitUntilFresh` 는 `status='fresh' && stale=0` 만 검사 — **빈 collection** (sqlite documents 테이블 비어있는 상태) 도 통과 → ingest 성공한 것처럼 보이지만 query 시 0 결과 (silent fail). qmd Node ABI mismatch / native binding fail / collection path 잘못 / PATH 우선순위 등 6 layer silent fail 진단의 핵심 신호.

`expectMinIndexed > 0 && indexed < expectMinIndexed` 시 polling 지속 → timeout 시 error message:

```
freshness timeout after 60000ms (last status=fresh, stale=0, indexed=0, expectMin=12)
```

→ 사용자가 `race vs PATH vs ABI vs collection-empty` 중 어느 layer 인지 즉시 식별 가능.

#### Backwards compat

- `reindex.sh` 구버전 (`indexed` 필드 emit 안 함) → `indexed = -1` (legacy fallback)
- `expectMinIndexed = 0` (caller 가 미지정) → 검사 skip
- 기존 caller (intervalMs 미지정) 회귀 0 — `expectMinIndexed=0` default

### 8.4 멱등성 보장

- **createPage**: 같은 filename → overwrite. *내용 누적은 LLM 책임 X* — 매 ingest 마다 LLM 이 *전체* 페이지를 다시 작성한다 (description 1~2 문장 중심).
- **frontmatter sources 배열**: `injectSourceFrontmatter` 가 LLM YAML 보존 + managed key (source_id 등) 만 교체. user/LLM frontmatter (title, tags) 는 보존.
- **provenance dedup**: `dedupeProvenance` 로 (type, ref) 중복 제거.
- **index.md**: LLM `index_additions` 와 *실제 written pages* 를 cross-check, 누락 자동 backfill (`writtenBases` Set + `llmCoveredBases` Set).
- **log.md**: append-only (prepend-newest, line 410). `stripBrokenWikilinks` 가 LLM 이 mention 한 dropped 페이지 link 정리.

### 8.5 분류·생성·수정 기준

| 행위 | 기준 |
|------|------|
| **신규 page** | `wikiFS.exists()` false → `createdPages[]` |
| **기존 page update** | exists true → `updatedPages[]` (overwrite, frontmatter merge) |
| **index 항목 신규** | LLM 출력 + writtenPages backfill |
| **index 항목 update** | 같은 wikilink target 의 line 교체 |
| **log 항목** | append-only (prepend-newest, 수정·삭제 절대 X) |

### 8.6 schema 매핑

> "인덱스를 항상 최신으로 / 로그는 추가만" 핵심 원칙 #4, #5. **LLM 이 누락해도 결정적 코드가 보강** — Karpathy "AI 가 무엇을 알고 모르는지 직접 본다" 의 implementation safety net.
>
> §5.11 v2 log.md 의미 재정의: 작업 log (lint/query) 가 아닌 *문서/지식 log only*. ingest 시 어떤 source 로부터 어떤 페이지가 생성·업데이트됐는지만 기록.

### 8.7 v2 변경 사항 vs v1

| 영역 | v1 | v2 |
|------|----|----|
| `runReindexAndWait` freshness gate | `status='fresh' && stale=0` 만 | **§5.14 L6** — `expectMinIndexed = countWikiMdFiles(cwd)` 추가 → 빈 collection silent-fresh 회귀 detect |
| `reindex.sh --check --json` schema | `{stale, status}` | **§5.14 L6** — `{stale, status, indexed}` (sqlite count) |
| `waitUntilFresh` 시그니처 | `(basePath, env, timeoutMs, intervalMs)` | **§5.14 L6** — `(basePath, env, timeoutMs, intervalMs, expectMinIndexed=0)` |
| 회귀 detect 능력 | qmd query 0-result symptom 만 (사용자 raise 후 진단) | **error message 에 `indexed=N, expectMin=M`** surface (race/PATH/ABI/collection-empty 자동 식별) |

---

## 9. Step 8 — Self-Extending — **D-wide 폐기 (§5.10.4)** 잔존 historical reference

> ⚠️ **D-wide 결정으로 본 §9 전체 deprecated**. Stage 1~4 (BUILTIN_STANDARD_DECOMPOSITIONS / suggestion-detector / self-declaration / convergence) 모두 제거. 본 섹션은 *historical reference* 로만 보존.

(v1 §9 와 동일 — v2 시점 변경 없음, schema.yaml 의 보존 영역은 `aliases` 단독, PII custom rule 은 별 file `.wikey/pii-patterns.yaml`)

---

## 10. Step Q — 쿼리 (질문 → 답변 → 선택적 저장)

### 10.1 위치

- 코드: `query-pipeline.ts` (663 LOC)
- 외부 도구: `tools/qmd/dist/cli/qmd.js` (BM25 + 벡터 + RRF 융합)
- 한국어 전처리: `scripts/korean-tokenize.py` (kiwipiepy 형태소)
- BLUE 추출 (§5.14.E): `renderContextPages` (line 479) / `ONE_HOP_CAP = 5` (line 476)

### 10.2 흐름 (4 step, line 30~103)

| Step | 동작 | LLM 콜 |
|------|------|--------|
| 1 | qmd 바이너리 탐색 (`findQmdBin`, line 629) | X |
| 2 | qmd search (`execQmdSearch`, line 296) — lex + vec + cross-lingual lex | X (단, cross-lingual 키워드 추출은 LLM, line 596) |
| 3a | 검색 결과 0 → fallback 단답 LLM | 1 콜 |
| 3b | 검색 결과 → wiki/ 본문 read + 1-hop wikilink expansion (`buildContextWithWikiFS` 또는 `buildContextFromFS`) | X |
| 4 | LLM 합성 (`buildSynthesisPrompt`) + citation collect + `appendOriginalLinks` | 1 콜 |

### 10.3 LLM 개입 포인트

#### (a) Cross-lingual 키워드 추출 (Korean → English)

```ts
// query-pipeline.ts:596
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
- **이유**: 한국어 질문 → wiki 의 영문 base name (mqtt, pmbok) 매칭. lex line 에 추가.
- **vec query** 는 `-` → space 치환 (qmd negation 오인 차단, §5.2.9).

#### (b) Synthesis (메인 답변)

```ts
// query-pipeline.ts:375
export function buildSynthesisPrompt(context: string, question: string): string {
  // §5.10.2.1 AC-C5.1: context 의 page section (`--- <basename>.md ---`) 으로부터
  // available page basename 자동 추출. LLM 이 *실제 존재* 페이지만 [[wikilink]] 처리.
  const PAGE_HEADER_RE = /^--- (.+?)\.md ---$/gm
  const availablePages: string[] = []
  for (const match of context.matchAll(PAGE_HEADER_RE)) { ... }
  const availableBlock = availablePages.length > 0
    ? `[Available pages]: ${availablePages.join(', ')}`
    : '[Available pages]: (none)'
  return `당신은 wikey 위키 전문가입니다. ...
- 답변에 등장한 entity/concept 중 위 페이지 base name 목록에 있는 것만 첫 등장 시 [[페이지명]] 으로 링크하세요. 목록에 없는 entity/concept 은 plain text 로 표기하세요 (broken link 차단).
...
${availableBlock}
---
위키 페이지:
${context}
---
질문: ${question}`
}
```

핵심 규칙:
- "확정적으로 설명하세요" — "~에 언급되었습니다" 같은 소극 표현 금지.
- "여러 페이지 정보 종합 → 하나의 완성된 답변".
- "해요체(존댓말)".
- "답변 끝 `참고: [[페이지명]], [[페이지명]]`".
- **§5.10.2.1 broken wikilink 차단**: `[Available pages]` 목록에 있는 base name 만 wikilink, 그 외는 plain text.
- "검색 페이지 본문 [[wikilink]] 가 있으면 1-hop target 도 활용".

### 10.4 1-hop wikilink expansion

`expandWithOneHopWikilinks(baseResults, reader, cap=ONE_HOP_CAP=5)` (line 445):
1. baseResults (qmd top-N, 보통 8) 본문에서 `[[wikilink]]` 추출 (`extractWikilinkBasenames`, line 419).
2. frequency desc + first-seen 순서로 정렬.
3. baseResults 에 없는 신규 wikilink → wiki/{entities,concepts,sources,analyses}/<base>.md 순서로 read (`reader` callback).
4. 최대 5 개까지 context 에 추가.

`renderContextPages(pages)` (line 479, **§5.14.E BLUE extract**) 가 base + expansion 을 `--- <basename>.md ---` delimited 로 직렬화 → `buildSynthesisPrompt` 입력.

### 10.5 Citation + 원본 링크

- `collectCitationsWithWikiFS(results, wikiFS)` (line 110) — 각 페이지 frontmatter 의 `provenance:` block 파싱 → `Citation[]` (sourceIds).
  - `extractProvenanceRefs` (line 275) 가 YAML block scalar 형식 (`provenance:` → `- type:` items with indented `ref:`) 파싱.
- `appendOriginalLinks(answer, citations, mode)` (line 204):

```ts
const target = mode === 'sidecar' ? deriveSidecarPath(resolved.rawVaultPath) : resolved.rawVaultPath
const display = basenameWithoutExt(resolved.rawVaultPath)
links.push(`[[${target}|${display}]]`)
...
return `${trimmed}\n\n원본: ${links.join(', ')}`
```

| mode | display |
|------|---------|
| `'raw'` (default) | registry 의 `vault_path` (PDF/HWP 원본). 답변 끝에 `원본: [[<path>|<basename>]], ...` |
| `'sidecar'` | `<vault_path>.md` (변환된 markdown sidecar) |
| `'hidden'` | footer 미출력 |

failure modes:
- citations 비어있음 → `원본: (없음 — 외부 근거 없음)`
- 모든 resolve 실패 → `원본: (해석 실패 — registry 점검 필요)`

### 10.6 Citation 마커 폐기 (NEW v2)

v1 시점에는 wikilink 뒤 `[원본]` / 📄 보조 마커가 chat UI 에 attach 됐었음 (`attachCitationBacklinks`). 사용자 정책 (2026-05-06 session 20) 으로 폐기 — wikilink 만으로 충분 + 마커가 wiki 페이지에 stale 진입할 위험.

```ts
// wikey-obsidian/src/sidebar-chat.ts:501~503
// 사용자 정책 (2026-05-06 session 20): wikilink 뒤 보조 citation 마커 ([원본] / 📄)
// 자체 폐기. wikilink 만으로 충분. attachCitationBacklinks / buildCitationButton 은
// 호출되지 않음 (코드는 §4.3.2 Part B 의 historical reference 로 보존하지만 dead path).
```

`attachCitationBacklinks` 함수 자체는 line 515 에 잔존 (historical reference) 하지만 호출 site 가 0 — dead path.

### 10.7 분류·생성·수정 기준

- **생성 X (default)**: 쿼리는 wiki 변경 안 함 (대화 컨텍스트만).
- **선택적 생성**: "가치 있는 답변" 을 사용자가 wiki/analyses/<name>.md 로 명시 저장 — 그 시점에 index.md, log.md 갱신 (별도 ingest 흐름).
- **index.md 자동 갱신 X** — schema 명시 ("쿼리 시 자동 갱신되지 않는다 — 답변이 위키에 저장될 때만").

### 10.8 v2 변경 사항 vs v1

| 영역 | v1 | v2 |
|------|----|----|
| `ONE_HOP_CAP` | 매직 넘버 (`cap=5` inline) | **§5.14.E BLUE** — `const ONE_HOP_CAP = 5` 명명 (line 476) |
| context 직렬화 | inline (buildContextWithWikiFS / buildContextFromFS 중복) | **§5.14.E BLUE** — `renderContextPages(pages)` extract (line 479) |
| Citation 마커 (chat UI) | wikilink 뒤 `[원본]` / 📄 attach | **폐기** — `attachCitationBacklinks` 호출 site 0 (코드 잔존, dead path) |
| 답변 footer | `원본: [[...]], ...` | (변경 없음) |

---

## 11. 전체 LLM 콜 흐름 다이어그램 (v2)

```
사용자: raw/0_inbox/<file> 추가
   │
   ▼
[Step 1] classifyFile (deterministic) ─┐
                                       │ (needsThirdLevel)
                                       ▼
                                   [LLM콜 #0] classify-LLM (선택, classify-LLM resolveProvider)
                                       │
사용자 승인 → raw/{PARA}/{NN}/{NNN}/<file>
   │
   ▼
[Step 2] generateBrief
   │   [LLM콜 #1] brief-LLM (sample 6KB, sanitized filename + sample, ingest provider)
   ▼
사용자: guide hint + Proceed
   │
   ▼
[Step 3] extract (Docling/markitdown/PyMuPDF/unhwp) — deterministic + cache
   │   (PDF tier 4/5 만 vision-LLM, 본문 의미 X)
   ▼
[Step 4] applyPiiGate (4 적용 지점) + decideReingest (5 분기) — deterministic
   │
   ├─ skip / skip-with-seed → 종료 (LLM 0 콜)
   │
   ▼ (force / protect)
[Step 5] Stage 1 + Stage 2
   │   [LLM콜 #2] summary-LLM → callLLMForSummary → normalizeSourcePageFilename (§5.13.C4 prefix 강제)
   │   [LLM콜 #3..N+2] mention-LLM (FULL=1, SEGMENTED=N, peer context)
   ▼
[Step 6] canonicalize (D-wide LLM 자율 type)
   │   [LLM콜 #N+3] canonicalizer-LLM (doc-global, alias guide + existing pages + §5.11 v2 promotion 가이드)
   │   ├─ applyPromotionGate Layer 2 (substring count ≥ 2, §5.11 v2)
   │   ├─ buildCategoryPages (entity / concept) — cross-pool dedup (§5.14.A BLUE)
   │   ├─ buildPageContent (`## 출처` sourcePageBase + rawSourceFilename, §5.12 + §5.13.A1)
   │   └─ applyCrossLinks → rebuildPageWithCrossLinks (§5.14.A BLUE)
   ▼
[Step 7] write pages + index + log + reindex
   │   ├─ injectSourceFrontmatter (v3) + Hook 2 user marker merge
   │   ├─ injectProvenance (entity/concept frontmatter)
   │   ├─ updateIndex (LLM additions + writtenPages backfill)
   │   ├─ appendLog (stripBrokenWikilinks 정리)
   │   └─ runReindexAndWait → waitUntilFresh(expectMinIndexed = countWikiMdFiles, §5.14 L6)
   ▼
~~[Step 8]~~ **D-wide 폐기 (§5.10.4)** — Stage 1~4 self-extending 모두 제거.

──────── 별도 트리거 ────────

사용자: 질문
   │
   ▼
[Step Q-1] korean-tokenize.py (deterministic)
   │   [LLM콜 #Q1] cross-lingual-LLM (Ollama 우선, 50 토큰, 한국어 → 영문 키워드)
[Step Q-2] qmd search (BM25 + vec + RRF) — deterministic
[Step Q-3] read top-N + 1-hop wikilink expansion (renderContextPages, §5.14.E BLUE)
   │   [LLM콜 #Q2] synthesis-LLM (확정적 답변, broken wikilink 차단, 1-hop 활용, 해요체)
   │   citation collect (provenance refs) → appendOriginalLinks(mode='raw' default)
   ▼
사용자: 답변 + `참고:` wikilink + `원본:` raw link footer
   │
   ▼ (선택)
사용자: "이 답변 wiki/analyses/ 에 저장해" → Step 5~7 재진입
```

**평균 LLM 콜 수** (1 raw 인제스트, route=FULL): **3 콜** (summary + mention + canonicalize). Brief 포함 시 4 콜. classify-LLM 은 inbox 분류 시점 1 회 (별도).

---

## 12. 결정성·재현 가능성 보장 (v2)

| 메커니즘 | 위치 | 효과 |
|----------|------|------|
| `WIKEY_EXTRACTION_DETERMINISM=true` | ingest-pipeline.ts:519 | summary/mention/canonicalize LLM 에 `temperature=0 + seed=42` 주입 → CV <15% |
| `JSON parse retry × 2` | callLLMWithRetry (line 1110) | 형식 깨짐 자동 복구 |
| `SLUG_ALIASES` + `.wikey/schema.yaml` `aliases` | canonicalizer.ts:51 + schema.ts | 30-run 측정 표기 변동 → canonical 강제 (D-wide 잔존 alias layer) |
| ~~`FORCED_CATEGORIES`~~ | (canonicalizer.ts old) | **D-wide 폐기 (2026-05-05)** — LLM 자율 type 분류로 대체 |
| `convert-cache.ts` | computeCacheKey | 같은 source bytes → 같은 markdown 보장 |
| `section-index.ts` (deterministic parse) | parseSections (line 60) | LLM-free 섹션 트리 — Route 판정·peer context 안정 |
| **§5.13.C4 normalizeSourcePageFilename** | ingest-pipeline.ts:903 | `source_page.filename` LLM emit drift 방어 (`source-` prefix force prepend) — defense in depth |
| **§5.12 sourcePageBase derive** | ingest-pipeline.ts:947 | `normalizeBase(summaryParsed.source_page.filename)` 가 `## 출처` wikilink 단일 진실 소스 |
| **§5.11 v2 applyPromotionGate** | canonicalizer.ts:321 | `countOccurrences(name, aliases, sourceBody) ≥ PROMOTION_THRESHOLD(2)` — 단순 출처/장소/단편 사실 결정적 차단 |
| **§5.14 L6 expectMinIndexed gate** | scripts-runner.ts:171 | `waitUntilFresh` 가 빈 collection silent-fresh 회귀 detect |
| **§5.13.D vault-wide basename collision** | scripts/validate-wiki.sh:114~126 | `find raw -name "*.md"` ↔ `find wiki -name "$base"` 충돌 시 FAIL — Obsidian basename matcher path-proximity 우회 방어 |
| Hook 1/2 (sidecar/source-page protect) | incremental-reingest.ts | 사용자 수정 보호 → ingest 재현성과 사용자 작업 양립 |
| ~~Stage 2 suffix detector + Stage 4 union arbitration~~ | ~~suggestion/convergence~~ | **D-wide 폐기** — self-extending 메커니즘 전체 제거 |

---

## 13. Validate-wiki.sh 6 검증 (v2)

`scripts/validate-wiki.sh` 가 wiki/ 정합성 lint:

| 검증 | 대상 | v2 추가 |
|------|------|---------|
| 1 | YAML 프론트매터 존재 | — |
| 2 | 위키링크 대상 파일 존재 (basename matching) | — |
| 3 | index.md 등재 (wiki 페이지 ↔ index 링크 1:1) | — |
| 4 | log.md 형식 (`## [YYYY-MM-DD] ingest \| <name>`) | — |
| 5 | 중복 파일명 (`find ... -exec basename`) | — |
| **6** | **vault-wide basename 충돌 (raw vs wiki)** | **NEW (§5.13.D)** — `find raw -name "*.md"` 의 each basename 이 `wiki/{entities,concepts,sources,analyses}/<X>.md` 와 동일 시 FAIL. 이유: §5.13.A1 raw wikilink `[[<rawSourceFilename>|원문]]` 가 Obsidian basename matcher 의 path-proximity rule 로 wiki page 선택 → §5.13.A1 paradigm 위반. |

검증 6 의 fixture: `scripts/validate-wiki.test.sh` 4 케이스 (collision FAIL / no-collision PASS / 다른 확장자 false positive 방어 / multi-collision).

---

## 14. 관련 문서

- [`wikey.schema.md`](../wikey.schema.md) — 마스터 스키마 (단일 진실 소스, Karpathy 4 원칙)
- [`llm-wiki.md`](../llm-wiki.md) — Karpathy 원문 패턴
- [`docs/architecture/wikey-ingest-pipeline.md`](./wikey-ingest-pipeline.md) — v1 (이전 버전, 2026-05-05)
- [`docs/architecture/ingest-decomposition.md`](./ingest-decomposition.md) — 분해 전략 예시·운영 원칙
- [`docs/planning/plan-full.md`](../docs/planning/plan-full.md) — 전체 로드맵 + Phase 별 spec
- [`docs/planning/phase-5/phase-5-todox-5.10-graph-emergent-ontology.md`](../docs/planning/phase-5/phase-5-todox-5.10-graph-emergent-ontology.md) — D-wide paradigm shift
- [`docs/planning/phase-5/phase-5-todox-5.11-page-promotion-threshold.md`](../docs/planning/phase-5/phase-5-todox-5.11-page-promotion-threshold.md) — Page Promotion Threshold v2
- [`docs/planning/phase-5/phase-5-todox-5.12-source-wikilink-format.md`](../docs/planning/phase-5/phase-5-todox-5.12-source-wikilink-format.md) — Source Wikilink Format
- [`docs/planning/phase-5/phase-5-todox-5.13-residual-followups.md`](../docs/planning/phase-5/phase-5-todox-5.13-residual-followups.md) — A1+B2+C4+D 5 follow-up
- [`docs/planning/phase-5/phase-5-todox-5.14-retrospective-blue-refactor.md`](../docs/planning/phase-5/phase-5-todox-5.14-retrospective-blue-refactor.md) — TDD-BLUE refactor + 본체 종결
- [`docs/sessions/phase-5/phase-5-result.md`](../docs/sessions/phase-5/phase-5-result.md) — Phase 5 진행 timeline

---

## 15. v2 변경 요약 + v1 대비 비표 평가

### 15.1 변경 요약 (master `8c703fc` 기준)

| Subject | commit chain | 본체 영향 |
|---------|--------------|----------|
| **§5.11 v2** Page Promotion Threshold | `7320c4d` (wiki reset) → `dab00f7` (canonicalizer rule 8 v2 + rule 9 + countOccurrences normalize + B1/B6 prompt) → `d1330b8` (overview.md 폐기 + sidebar-chat 주석) → `be5449c` (docs sync) | Step 5 prompt + Step 6 deterministic gate (Layer 2 substring count) + dropped reason precision |
| **§5.12** Source Wikilink Format | `1199284` (canonicalizer chain + ingest-pipeline derive) → `12f2085` (docs sync) | Step 5 → Step 6 sourcePageBase chain (5 함수) + `## 출처` 첫 줄 wikilink wiki/sources/source-*.md 단일 진실 |
| **§5.13.A1/B2/C4** raw wikilink 병기 + validator cascade + LLM filename prefix | `5d87995` (B2) → `58914d8` (A1) → `dfc5e6a` (C4) → `e3b2882` (codex post-impl narrow fix) | Step 5 normalizeSourcePageFilename + Step 6 rawSourceFilename arg + `## 출처` 둘째 줄 raw wikilink |
| **§5.13.D** vault-wide basename 충돌 | `7c53e3e` | validate-wiki.sh 검증 6 추가 |
| **§5.14 BLUE refactor** Tier 2-4 | `888317f` (BLUE Tier 2-4) → `7b1ccc3` (docs sync) | canonicalizer.ts BLUE 추출 (`applyPromotionGate` / `buildCategoryPages` / `rebuildPageWithCrossLinks`) + ingest-pipeline.ts BLUE (`canonicalizeAndAssembleParsed`) + query-pipeline.ts BLUE (`renderContextPages` / `ONE_HOP_CAP`) — 동작 변경 0, 코드 quality 만 |
| **§5.14 Layer 6** waitUntilFresh 강화 | `f8476d4` | runReindexAndWait `expectMinIndexed` arg + reindex.sh schema `indexed` 필드 + ingest-pipeline `countWikiMdFiles` wiring |
| **§5.14 sidebar-chat narrow** | `7a166f4` | renderAuditSection 727→687 LOC (3 helper 추출 + audit fetch DRY + dynamic import 제거) |
| **§5.14 본체 종결** 잔존 4 항목 결정 | `8c703fc` | 잔존 4 항목 (UI E2E test 의존) 의도적 유지 결정 — 코드 변경 0, 문서 mirror only |

### 15.2 v2 vs v1 step-by-step 비표 평가

| Step | v1 시점 동작 | v2 시점 동작 | Δ (개선) | Δ (위험) |
|------|-------------|-------------|---------|---------|
| 1 인입·분류 | 결정적 1차 + LLM 2차 fallback | (변경 없음) | — | — |
| 2 Brief | sample 6KB + sanitize | (변경 없음) | — | — |
| 3 변환 | docling/markitdown/pymupdf/unhwp + cache | (변경 없음) | — | — |
| 4 PII gate | regex 4 적용 지점 + decideReingest 5분기 | (변경 없음) | — | — |
| **5 추출 (Stage 1+2)** | LLM emit `source_page.filename` 신뢰 | **§5.13.C4 normalize** — `source-` prefix force prepend (defense in depth) | 1차 prompt 강제 + 2차 코드 normalize 로 LLM drift 방어. validate-wiki.sh broken wikilink 0 invariant. | — |
| | Stage 2 prompt cap "0~15개" | **§5.11 v2** — cap 폐기, "수가 적어도 (1~3개) OK. 페이지 의도 직접 관련만" | wiki noise ↓ (단순 출처/장소/단편 사실 차단). 한국어 alias 보존 (`name = 한국어 base, aliases = [영어 transliteration]`). | LLM 이 prompt 무시하고 cap 적용 시 회귀 가능 — Layer 2 deterministic gate 가 안전망. |
| **6 표준화** | 시그니처 단순 (`sourceFilename`) | **§5.12 + §5.13.A1** — 6 함수 시그니처 chain (`sourcePageBase + rawSourceFilename` 추가) | `## 출처` 첫 줄 = wiki/sources 단일 진실, 둘째 줄 = raw 파일 직링크. PII guard ON 시 raw wikilink 분리로 mask 적용에도 raw jump 1 클릭 보장. | 시그니처 chain 6 함수 — 외부 caller (테스트) 가 baseArgs 갱신 필요 (test fixture 4 case 갱신됨). |
| | 단순 entity loop + concept loop 혼재 (~100 LOC `assembleCanonicalResult`) | **§5.14.A BLUE** — `applyPromotionGate` / `buildCategoryPages` / `rebuildPageWithCrossLinks` 추출 | 가독성 ↑, 단위 test 가능, dropped reason 정확도 ↑. | (동작 변경 0) |
| | (없음) | **§5.11 v2 applyPromotionGate** — substring count ≥ 2 deterministic Layer 2 | 단일 mention 차단 + 한국어 변형 (하이픈 ↔ 공백) cover. dropped sample console log surface. | `sourceBody` 미전달 시 backward-compatible (gate skip). |
| **7 페이지 write + reindex** | `waitUntilFresh(status='fresh' && stale=0)` 만 | **§5.14 L6** — `expectMinIndexed = countWikiMdFiles(cwd)` 추가 gate | 빈 collection silent-fresh 회귀 detect. error message `indexed=N, expectMin=M` 으로 race/PATH/ABI/collection-empty 자동 식별. | 구버전 reindex.sh 호환 (`indexed=-1` legacy fallback) — 회귀 0. |
| | (없음) | **validate-wiki.sh 검증 6** | raw vs wiki basename 충돌 시 FAIL — §5.13.A1 paradigm 위반 사전 차단. | (lint only — runtime 영향 X) |
| **8 self-extending** | (이미 D-wide 폐기) | (변경 없음) | — | — |
| **Q 쿼리** | citation 마커 (`[원본]` / 📄) wikilink 뒤 attach | **citation 마커 폐기** — `attachCitationBacklinks` dead path | 답변 가독성 ↑ (마커 noise 제거), wikilink + `원본:` footer 만 | (코드 잔존 — 향후 cleanup 후보) |
| | inline `cap=5` 매직 넘버 + buildContextWith/FromFS 중복 직렬화 | **§5.14.E BLUE** — `ONE_HOP_CAP` 명명 + `renderContextPages` extract | 가독성 ↑ + duplication ↓ | (동작 변경 0) |

### 15.3 v2 의 장점

#### A. **Defense in depth** — LLM emit drift 방어 layer 추가
- **§5.13.C4** `normalizeSourcePageFilename`: prompt 강제 (1차) + 코드 normalize (2차) → LLM 자율 흐름이 prompt 무시해도 invariant 보장
- **§5.14 L6** `expectMinIndexed`: status/stale gate (1차) + count gate (2차) → 빈 collection silent fail 차단
- **§5.13.D** validate-wiki 검증 6: lint 단계에서 paradigm 위반 사전 detect

#### B. **Wiki noise ↓** — promotion threshold 의미·관련도 기반 전환
- **§5.11 v2** prompt cap (수량) → 의도·관련도 기준 (질) 패러다임 전환
- substring count ≥ 2 deterministic Layer 2 가 LLM-only 차단의 안전망
- 한국어 source 의 영문화 회귀 차단 (원문 언어 base + 반대 언어 alias)

#### C. **`## 출처` 사용성 ↑** — 1 wikilink → 2 wikilink (sourcePageBase + raw)
- 첫 줄: wiki/sources/source-*.md (knowledge 단일 진실)
- 둘째 줄: raw 파일 직링크 (원문 1 클릭 jump)
- PII guard 와 직교 — mask 적용해도 raw 접근 보장

#### D. **Code quality** — §5.14 BLUE 의 결정적 추출
- 거대 함수 분해 (`assembleCanonicalResult` 100+ → 50 LOC + helpers)
- 매직 넘버 명명 (`ONE_HOP_CAP`, `PROMOTION_THRESHOLD`)
- DRY (FULL+SEGMENTED route 의 stage 2.3 공통화 `canonicalizeAndAssembleParsed`)
- 동작 변경 0 (test 결과 byte-by-byte identical 확증, codex post-impl APPROVE)

#### E. **진단 가능성 ↑**
- error message 에 `indexed=N, expectMin=M` 명시 → 6 layer silent fail 의 어느 layer 인지 즉시 식별
- dropped sample console log surface (`canon.dropped.slice(0, 10).map(...)`)
- validate-wiki.sh 검증 6 가 paradigm 위반을 lint 단계에서 detect

### 15.4 v2 의 단점·리스크

#### A. **시그니처 chain 6 함수 — caller burden**
- canonicalizer 의 5 함수 + ingest-pipeline 의 호출처 양 route 가 `sourcePageBase + rawSourceFilename` 동시 전달 필요
- 외부 test fixture 갱신 비용 (canonicalizer.test.ts 4 case + 신규 §5.12/§5.13 테스트)
- 위험 완화: type-checked args object pattern (CanonicalizeArgs interface) 으로 typo / 누락 방어

#### B. **§5.11 v2 promotion threshold = 2 의 hyperparameter 성격**
- 1회 mention 인 *진짜 중요한* 고유명사도 차단될 수 있음 (false negative)
- 위험 완화: dropped sample console log + canon.dropped reason precision 으로 사용자가 원인 파악 가능. PROMOTION_THRESHOLD 상수 export 안 함 — 향후 .wikey/promotion-threshold.yaml override 추가 여지.

#### C. **citation 마커 폐기로 dead code 잔존**
- `attachCitationBacklinks` (sidebar-chat.ts:515) + `buildCitationButton` 코드 살아 있음, 호출 site 0
- §5.14 잔존 4 항목 본체 종결 결정에 따라 의도적 유지 — 향후 §5.x cleanup cycle 에서 제거 후보

#### D. **§5.14 잔존 4 항목 — UI 코드 deep split 미진행**
- sidebar-chat.ts (2325 LOC) / settings-tab.ts (1175 LOC) / main.ts (785 LOC) / commands.ts (676 LOC) 의 거대 함수 분해 미완
- 위험 완화: Karpathy Simplicity First / Surgical Changes 원칙 + closure state 캡슐화 정당화 + UI E2E test 인프라 부재 (별도 phase / future work)

### 15.5 v2 → v1 마이그레이션 가이드 (역방향 — historical reference)

코드 자체는 master branch 누적이라 v2 만 활성. v1 시점 commit (`b9130f5` D-wide 종결) 으로 git checkout 시:
1. canonicalizer 의 sourcePageBase + rawSourceFilename 인자 chain 부재 → caller 호출처 8 곳 (test 4 + ingest-pipeline 2 + 직접 caller 2) 회귀
2. `applyPromotionGate` deterministic gate 부재 → wiki noise 잠재 회귀 (단, 사용자가 PMBOK 류 ingest 시 단순 출처/장소가 페이지화)
3. `normalizeSourcePageFilename` 부재 → LLM emit drift 시 `## 출처` wikilink 가 wiki/sources/<base> 매칭 실패 (validate-wiki broken)
4. `waitUntilFresh expectMinIndexed` gate 부재 → 빈 collection silent-fresh 회귀 (qmd query 0-result symptom)
5. `validate-wiki.sh 검증 6` 부재 → vault-wide basename 충돌 미detect

→ master `8c703fc` 유지가 production 권장.

### 15.6 v3 후보 (향후 세션 raise 시)

- **wikey-obsidian UI E2E test 인프라** (vitest + Obsidian API mock + jsdom) — §5.14 잔존 4 항목 deep split 의 enabler
- **PROMOTION_THRESHOLD override** — `.wikey/promotion-threshold.yaml` 사용자 정의 (현재 hardcoded 2)
- **citation 마커 dead code cleanup** — `attachCitationBacklinks` / `buildCitationButton` 함수 + 호출처 코드 완전 삭제
- **Phase 6 (웹 환경) 진입** — Phase 5 본체 종결 (§5.1~§5.4 + §5.10~§5.14) 충족, plan-full §3.3.6 진입 조건 검토
- **Phase 5 P3/P4 잔여** — §5.5 (그래프) / §5.6 (엔진) / §5.7 (운영 인프라) / §5.8 (D.0.l 잔여) / §5.9 (Variance)

---

## 16. 한 눈 요약 (v2)

> **wikey 의 ingest 파이프라인 v2 는 v1 의 "결정적 코드 + LLM 의 전략적 개입" 7:3 혼합 위에 *defense in depth* 와 *paradigm 강제* 를 추가한 형태.** §5.10.4 D-wide (LLM 자율 ontology) 의 epistemological 단순화 위에 §5.11 v2 (의미·관련도 promotion) + §5.12 (`## 출처` 단일 진실) + §5.13 (raw wikilink + LLM drift 강제) + §5.14 (BLUE refactor + Layer 6 freshness) 의 4 layer 가 invariant 를 강화한다.
>
> Karpathy 4 원칙 매핑:
> - **Explicit**: provenance frontmatter + index.md + log.md + dropped sample console log + `indexed=N, expectMin=M` 진단 메시지
> - **Yours**: PII gate 4 적용 지점 + sidecar 로컬 + raw wikilink 로 원문 1 클릭 jump
> - **File over app**: markdown + git + sidecar `<src>.md` + grep 호환 `## 출처` 평문 wikilink
> - **BYOAI**: provider 5 키 (`ingest`, `classify`, `chat`, `default`, `embedding`) 독립 구성, Gemini/Claude/OpenAI/Ollama 자유 교체
>
> Phase 5 본체 종결 (§5.14) 직후 시점이라 코드 surface area 안정. 다음 작업 후보 = Phase 6 웹 환경 진입 또는 §5.5~§5.9 잔여 P3/P4 subject 또는 wikey-obsidian UI E2E test 인프라 구축 (별도 phase).
