# Phase 4.1 — 문서 전처리 파이프라인 재편 (Docling 메인화 + unhwp + MarkItDown 강등)

> **상위 문서**: [`activity/phase-4-result.md`](../activity/phase-4-result.md) · [`plan/phase-4-todo.md`](./phase-4-todo.md) — 본 문서는 §4.1 (문서 전처리 파이프라인 재편 (agile/crystal 메서드)) 보조 자료. 명명규칙: `phase-N-todox-<section>-<topic>.md` / `phase-N-resultx-<section>-<topic>-<date>.md` — `CLAUDE.md §문서 명명규칙·조직화` 참조.


## Context

현재 `extractPdfText` (wikey-core/src/ingest-pipeline.ts:842-1063)는 **PDF 전용 6-tier fallback**으로 동작한다: MarkItDown → pdftotext → mdimport → pymupdf/PyPDF2 → markitdown-ocr → page-render Vision. 이 체인은 Phase 3까지 안정적으로 돌았지만 3가지 누적 문제를 드러냈다.

1. **품질 상한이 낮다** — MarkItDown은 한국어 OCR, 복잡 표, 다단 레이아웃에서 정확도가 낮다. `§4.5.1.5`에서 관찰된 LLM extraction CV 악화의 원인 후보 중 하나가 "MarkItDown이 미구조화 markdown을 생성 → chunk 경계가 run마다 흔들림"이다.
2. **포맷 커버리지 부족** — 현재 `ingest-pipeline.ts:75`의 확장자 분기는 `.pdf`만 처리. DOCX/PPTX/XLSX/HTML/이미지/HWP/HWPX는 `wikiFS.read()`로 직접 읽어 바이너리가 그대로 LLM에 들어갈 수 있다.
3. **보안 갭** — tier 5/6에서 `execFileAsync` args로 API 키를 평문 전달 → `ps aux`에 노출 (phase-4-todo.md §4.1.1.5).

**결정 (2026-04-21)**: IBM Docling(TableFormer + layout model + ocrmac/RapidOCR/Tesseract)을 **tier 1 메인 컨버터**로 승격하여 PDF/DOCX/PPTX/XLSX/HTML/이미지/TXT를 담당시키고, HWP/HWPX는 **unhwp**에 위임한다. MarkItDown은 docling 미설치 환경 fallback으로 tier 3 강등. 공통 `strip_base64_images()` 로직을 **wikey-core**로 이식하여 LLM 투입 직전 이미지(base64 data URI + 외부 이미지 URL)를 `[image: alt]` placeholder로 치환한다 — 토큰 폭증 차단 + alt text 보존.

목표 산출물: §4.5.1.5 variance 재개가 가능한 "구조적 markdown" 확보, 그리고 Phase 4 전반의 입력 품질 개선.

## 샘플 이미지 패턴 (확증된 회귀 케이스)

| 샘플 | 파일 | 크기 | 이미지 수 | 패턴 | strip 후 |
|---|---|---:|---:|---|---:|
| docling PDF | `docs/samples/rp1-peripherals.docling.md` | 1.90 MB | 19 | `![Image](data:image/png;base64,…)` (alt 대문자 `Image` 고정) | ~237 KB (8×) |
| unhwp HWPX | `docs/samples/Examples.hwpx.md` | 1.72 MB | 13 | `![image](data:image/{png\|bmp};base64,…)` (alt 소문자 `image` 고정) | ~635 B (2700×) |
| unhwp HWP | `docs/samples/스마트공장...개최.hwp.md` | 1.4 KB | 0 | — (텍스트 전용 HWP) | 변화 없음 |
| Obsidian Web Clipper | `docs/samples/GOODSTREAM Solutions…md` | 10 KB | 1 | `![alt](https://….svg)` (외부 URL) | -1행 축약 |

**파생 규칙** — strip 함수는 다음 두 패턴을 모두 덮어야 한다.

1. `!\[([^\]]*)\]\(data:[^)]+\)` — docling/unhwp 공통 base64 embed
2. `!\[([^\]]*)\]\((https?://[^)]+\.(svg|png|jpe?g|gif|webp|bmp)(\?[^)]*)?)\)` — 외부 이미지 URL (Web Clipper, 기타 WebFetch류)

외부 텍스트 링크 `[텍스트](https://…)`는 보존 (이미지 확장자만 매칭).

## Architecture Overview

### 확장자 기반 분기 (새 진입점)

`wikey-core/src/ingest-pipeline.ts:75` 의 `isPdf` 체크를 **`selectConverter()`** helper로 교체:

```
ext == .hwp | .hwpx      → unhwp (vendored convert.py)
ext == .pdf              → extractPdfText() ← docling-led 체인
ext ∈ {.docx,.pptx,.xlsx,.html,.htm,.png,.jpg,.jpeg,.tiff,.csv}
                         → extractDocumentText() ← docling 단일 경로
ext == .md / .txt        → wikiFS.read()  (현행 유지)
```

### 새 tier 체인 (extractPdfText 재구성)

| Tier | 도구 | 담당 | 비고 |
|---|---|---|---|
| **1** | **docling CLI** | 모든 PDF + DOCX/PPTX/XLSX/HTML/이미지 | `--table-mode accurate`, `--image-export-mode embedded` (기본), `--device mps` |
| 2 | markitdown-ocr | embedded raster image OCR (Vision API) | 기존 tier 5 위치에서 올림 — docling이 ocrmac/tesseract로 커버 못한 스캔본 보조 |
| **3** | **MarkItDown** | docling 미설치 환경 fallback | 기존 tier 1 → tier 3 강등 |
| 4 | pdftotext | 텍스트 PDF 저비용 백업 | 현행 유지 |
| 5 | pymupdf / PyPDF2 | 최후 텍스트 추출 | 현행 유지 |
| 6 | page-render Vision OCR | vector-only PDF 최후수단 | 현행 유지 |

mdimport(기존 tier 3)는 macOS Spotlight 의존·출력 품질 낮음·docling으로 대체 가능 → **삭제**.

### 이미지 placeholder 처리 (LLM 투입 직전)

모든 tier 의 출력은 `extractPdfText`/`extractDocumentText` 반환 직전에 **`stripEmbeddedImages(md)`**를 통과한다. 원본 `.md`는 `raw/` 옆에 보존 → Obsidian 렌더링·사용자 열람용. LLM 입력과 qmd 인덱싱은 strip 결과.

- alt가 빈 문자열 또는 `"image"`(대소문자 무관) → `[image]`
- alt 가 그 외 → `[image: {alt}]` (docling `Image`는 고정 alt → `[image: Image]`; 의도적)

## 파일별 변경 계획

### 4.1.1.1 Docling 통합 (tier 1 메인)

**신규 파일**:
- `scripts/vendored/docling-convert.py` — Python CLI 래퍼. docling DocumentConverter 또는 CLI 호출, `--image-export-mode embedded`, `--table-mode $DOCLING_TABLE_MODE` (기본 `accurate`), `--device $DOCLING_DEVICE` (자동 감지: `mps` on Apple Silicon, 없으면 `cpu`), `--ocr-engine $DOCLING_OCR_ENGINE` (기본 `ocrmac` on macOS, `rapidocr` elsewhere), `--ocr-lang ko-KR,en-US`. stdin으로 입력 경로 받고 stdout으로 markdown 출력.
- 또는 execFile로 시스템 `docling` CLI 직접 호출 (설치 경로: `uv tool install docling` → `~/.local/bin/docling`). **권장**: 시스템 CLI 직접 호출 (기존 markitdown-ocr 패턴과 일치, Python import 불필요).

**변경**:
- `wikey-core/src/ingest-pipeline.ts:842-1063`
  - 새 tier 1 블록 추가 (`docling` 호출). timeout 300000ms, maxBuffer 50MB.
  - 한국어 공백 소실 감지 helper (`hasMissingKoreanWhitespace(md)`) 추가 — docling SKILL.md `reference/korean-ocr-advanced.md` 기반. 임계 미달 시 docling `--force-ocr --ocr-lang ko-KR,en-US` 재시도 (tier 1b).
  - 기존 tier 1 (MarkItDown) → tier 3으로 이동.
  - mdimport 호출 삭제.
- 신규 config keys (`wikey-core/src/types.ts` `WikeyConfig` 확장 + `config.ts` 파싱):
  - `DOCLING_TABLE_MODE` (`accurate`/`fast`, 기본 `accurate`)
  - `DOCLING_DEVICE` (`mps`/`cuda`/`cpu`, 자동 감지 후 오버라이드)
  - `DOCLING_OCR_ENGINE` (`ocrmac`/`rapidocr`/`tesseract`, OS별 기본)
  - `DOCLING_OCR_LANG` (기본 `ko-KR,en-US`)
  - `DOCLING_TIMEOUT_MS` (기본 300000)
- `wikey.conf` 주석 블록 추가 — "# Docling (tier 1 메인 컨버터)" 섹션.

### 4.1.1.2 unhwp 통합 (HWP/HWPX 전용)

**신규 파일**:
- `scripts/vendored/unhwp-convert.py` — `claude-forge-custom/skills/unhwp/convert.py:1-76` 그대로 복사. 플러그인 자족 운영을 위해 원격 SKILL 파일 의존 회피.

**변경**:
- `wikey-core/src/ingest-pipeline.ts:74-86` 의 `isPdf` 분기 → `selectConverter(ext)` 리팩토링:
  ```typescript
  const ext = sourceFilename.toLowerCase().split('.').pop()
  if (ext === 'hwp' || ext === 'hwpx') {
    sourceContent = await extractHwpText(sourcePath, opts?.basePath, opts?.execEnv)
  } else if (ext === 'pdf' || DOCLING_FORMATS.has(ext)) {
    sourceContent = await extractPdfText(sourcePath, opts?.basePath, opts?.execEnv, config)
  } else {
    sourceContent = await wikiFS.read(sourcePath)
  }
  ```
  - `DOCLING_FORMATS = new Set(['pdf','docx','pptx','xlsx','html','htm','png','jpg','jpeg','tiff','csv'])`
  - `extractHwpText()` 신규 helper — `python3 scripts/vendored/unhwp-convert.py <src> <tmp_dir>` 호출 → stdout 이 md 경로 → 파일 읽고 strip.
- `scripts/vendored/unhwp-convert.py` 실행을 위한 Python 의존성: `pip install unhwp` — 미설치 시 사용자 안내.

### 4.1.1.3 MarkItDown 체인 fallback 강등

**변경**:
- `wikey-core/src/ingest-pipeline.ts` tier 1 MarkItDown 블록 (`:889-898`) → tier 3 위치로 이동. 로그 라벨 `tier 1/6 start: markitdown` → `tier 3/6 start: markitdown (fallback)`.
- `accept()` 임계: MarkItDown 출력이 docling 결과와 경쟁해야 하므로 현행 50 chars 유지. 단 docling 없을 때만 실행되므로 체인 진입 조건 없음.
- `ingest-pipeline.ts:79` 진행 메시지 `"Extracting (MarkItDown)..."` → `"Extracting (Docling)..."` (환경에 따라 동적).

### 4.1.1.4 OCR 중복 호출 제거 (캐시)

**신규 파일**:
- `wikey-core/src/convert-cache.ts` — 메모이제이션 모듈.
  - 캐시 키: `sha256(originalBytes) + converterTier + majorOptions(table_mode, ocr_engine, dpi, image_export_mode)`.
  - 저장 경로: `~/.cache/wikey/convert/<hash>.md` (TTL 30일, 기본; `WIKEY_CACHE_TTL_DAYS` 설정).
  - API: `getCached(hash)`, `setCached(hash, md)`, `invalidate(hash)`.

**변경**:
- `extractPdfText`/`extractHwpText`/`extractDocumentText` 진입 시 bytes → sha256 → `getCached` 확인. 히트 시 tier 호출 스킵.
- Audit 패널의 per-file 옵션에 "Force re-convert" 토글 (§4.1.1.8 와 통합).
- 테스트: `wikey-core/src/__tests__/convert-cache.test.ts` — 동일 sha256 두 번째 호출이 디스크 i/o만 하고 tier 호출은 안 하는 것을 spy로 assert.

### 4.1.1.5 API 키 process listing 노출 제거 (보안)

**변경** — `wikey-core/src/ingest-pipeline.ts`:
- tier 5 markitdown-ocr (`:962-977`) 와 tier 6 page-render Vision (`:996-1054`) 의 `execFileAsync` args 에서 `ocr.apiKey` 제거. Python 스크립트는 `os.environ['OPENAI_API_KEY']` 로 직접 참조.
- `env` 객체에 provider별 env var 주입:
  ```typescript
  const ocrEnv = { ...env, OPENAI_API_KEY: ocr.apiKey }  // openai SDK가 기본 참조
  ```
  Gemini endpoint 도 openai SDK 의 base_url 오버라이드 + `OPENAI_API_KEY`=gemini key 패턴으로 동작.
- Python 스크립트 수정: `OpenAI(base_url=sys.argv[2])` — api_key 인자 삭제. SDK 가 env 참조.
- 검증: `ps aux | grep -E "markitdown|ocr|docling"` 실행 중 결과에 `AIza…`/`sk-…`/`ssk-…` 전무 확인.

### 4.1.1.6 변환 품질 감지 및 tier 분기

**신규 파일**:
- `wikey-core/src/convert-quality.ts` — 품질 스코어링.
  - `brokenTableRatio(md)`: ` | ` 만 연속되는 라인 비율
  - `emptySectionRatio(md)`: 헤딩 직후 본문 50자 미만 비율
  - `minBodyChars`: 전체 본문 최소 문자 수
  - `hasMissingKoreanWhitespace(md)`: docling SKILL.md §"승격 판정" 로직 — 15자 이상 한글 토큰 비율 > 30%
  - 결과: `{ score: 0-1, flags: string[], decision: 'accept'|'retry'|'reject' }`

**변경**:
- `extractPdfText` tier 1 docling 출력 → 품질 평가 → `retry` 시 tier 1b (docling `--force-ocr`) 재시도 → 여전히 미달이면 tier 2 (markitdown-ocr) 로 폴스루.
- Audit 패널 (`wikey-obsidian/src/sidebar-chat.ts` 또는 `ingest-modals.ts`) 에 파일별 "Converter override" 드롭다운: `auto / docling / docling-ocr / markitdown / markitdown-ocr / vision-ocr`.
- 설정 키: `DOCLING_QUALITY_MIN_SCORE` (기본 0.6), `DOCLING_RETRY_ON_KR_WHITESPACE` (기본 true).

### 4.1.1.7 성능 비교 테스트 (정량 baseline)

**신규 파일**:
- `scripts/benchmark-converters.sh` — 코퍼스 4개 × 변환기 7개 매트릭스 실행.
- `activity/phase-4-converter-benchmark-2026-04-22.md` — 결과 리포트 (수동 생성).

**코퍼스**:
- `raw/3_resources/.../TWHB-16_001 파워디바이스.pdf` (3.3MB, 한국어 표)
- `raw/3_resources/.../OMRON HEM-7600T.pdf` (48p, 한국어/다국어)
- 스캔 PDF 1건 (docs/samples 또는 raw에서 선정 — 사용자와 확정)
- `docs/samples/Examples.hwpx`, `docs/samples/스마트공장...개최.hwp`

**메트릭**:
- 챕터 보존율 (docling JSON 출력의 section_title 수 vs 수동 grep)
- 테이블 행/열 정확도 (수동 검증 10샘플)
- 이미지 캡션 추출 (embedded alt text 수)
- 처리 시간 (wall-clock)
- 메모리 (peak RSS via `/usr/bin/time -l`)
- 한국어 정확도 (공백 소실 토큰 비율)

**검증기준**: docling이 평균 챕터 보존율·테이블 정확도에서 MarkItDown 대비 +20% 이상 개선. 미달이면 tier 배치 재검토.

### 4.1.1.8 변환 결과 캐시 (SHA256 기반 영속 캐시)

§4.1.1.4 에서 이미 구현된 `convert-cache.ts` 를 일반화해 모든 변환기에 공통 적용. 추가:

- `.wikey/cache-index.json` — 관찰성용 (해시 → 원본 경로, 변환 시각, tier, 소요 시간).
- CLI: `scripts/cache-stats.sh` — 히트율/크기/오래된 항목 리포트.
- Audit 패널 "Force re-convert" 체크박스 — 해당 파일의 캐시를 `invalidate(hash)` 후 재변환.

### 4.1.1.9 md 변환 결과 저장, 활용 및 이동

**신규 동작**:
- 변환 완료 시 원본 소스 옆에 `.md` 사본 저장. 예: `raw/3_resources/30_electronics/300_raspberry-pi/rp1-peripherals.pdf` → 같은 폴더에 `rp1-peripherals.pdf.md` (embedded 원본, 사람 확인용).
- `.wikey/source-registry.json` (§4.2.2 선행 구현 필요) 에 `converted_md_path` 필드 기록.
- PARA 이동 (`vault.on('rename')`) 감지 시 `.md` 사본도 함께 이동 — `wikey-obsidian/src/main.ts` 의 rename handler 에서 sidecar 매핑.
- 삭제 (`vault.on('delete')`) 시 사본·캐시 함께 정리.

**변경**:
- `wikey-core/src/ingest-pipeline.ts` — 변환 직후 `wikiFS.write(${sourcePath}.md, rawMd)` (원본 embedded 유지). LLM 에는 strip 결과 전달.
- `wikey-obsidian/src/main.ts` — rename/delete listener 에 sidecar `.md` 처리 추가.
- `.gitignore` — `raw/**/*.md` (원본 사본) 제외 여부 사용자 판단 필요 — **기본 제외** 권장 (원본 .pdf와 동일 정책).

### 공통 — 이미지 placeholder strip

**신규 파일**:
- `wikey-core/src/rag-preprocess.ts`:
  ```typescript
  const DATA_URI = /!\[([^\]]*)\]\(data:[^)]+\)/g
  const EXTERNAL_IMG = /!\[([^\]]*)\]\((https?:\/\/[^)]+\.(svg|png|jpe?g|gif|webp|bmp)(\?[^)]*)?)\)/gi

  export function stripEmbeddedImages(md: string): string {
    return md
      .replace(DATA_URI, (_, alt) => placeholderFor(alt))
      .replace(EXTERNAL_IMG, (_, alt) => placeholderFor(alt))
  }

  function placeholderFor(alt: string): string {
    const a = (alt ?? '').trim()
    if (!a || a.toLowerCase() === 'image') return '[image]'
    return `[image: ${a}]`
  }
  ```
- `wikey-core/src/__tests__/rag-preprocess.test.ts` — 4개 샘플 고정 입력 (docling 패턴 5건, unhwp 패턴 5건, Web Clipper 외부 URL 2건, 보존되어야 할 일반 링크 3건) → 고정 출력 스냅샷 assert.

**호출 지점**:
- `extractPdfText`, `extractHwpText`, `extractDocumentText` 반환 직전.
- `ingest-pipeline.ts:84` 의 `wikiFS.read(sourcePath)` (markdown/txt 경로) 반환 후에도 적용 — Obsidian Web Clipper 결과가 이 경로로 들어오기 때문.

### env-detect.ts 보강

**변경** — `wikey-obsidian/src/env-detect.ts`:

```typescript
// EnvStatus 에 추가
hasDocling: boolean
doclingVersion: string
hasUnhwp: boolean
```

```typescript
async function checkDocling(env): Promise<{ ok: boolean; version: string }> {
  try {
    const { stdout } = await execFileAsync('docling', ['--version'], { env, timeout: 5000 })
    return { ok: true, version: stdout.trim() }
  } catch { return { ok: false, version: '' } }
}

async function checkUnhwp(pythonPath, env): Promise<boolean> {
  if (!pythonPath) return false
  try {
    await execFileAsync(pythonPath, ['-c', 'import unhwp'], { env, timeout: 5000 })
    return true
  } catch { return false }
}
```

`detectEnvironment()` 마지막에 호출 추가. `issues` 에 `hasDocling=false` 시 warning 추가 (fail 은 아님, MarkItDown fallback 있음).

### settings-tab.ts Environment 섹션

**변경** — `wikey-obsidian/src/settings-tab.ts` (`renderEnvStatusSection`, 라인 31-136):

`items` 배열에 2 항목 삽입 (MarkItDown 위):

```typescript
{ label: 'Docling', value: env.hasDocling ? env.doclingVersion : 'Not installed', ok: env.hasDocling, desc: 'Main converter for PDF/DOCX/PPTX/XLSX/HTML/image. uv tool install docling' },
{ label: 'unhwp', value: env.hasUnhwp ? 'Installed' : 'Not installed', ok: env.hasUnhwp, optional: true, desc: 'HWP/HWPX converter. pip install unhwp' },
```

MarkItDown 항목의 description 을 `Fallback converter (docling 미설치 시)` 로 수정.

## 단계별 실행 순서 (의존성 그래프)

1. **공통 strip 함수** (`rag-preprocess.ts`) + 테스트 → 이후 모든 tier 출력에 적용 가능
2. **env-detect 보강** (docling/unhwp 감지) → settings-tab 에서 상태 표시
3. **vendored scripts 준비** (`scripts/vendored/unhwp-convert.py` 복사, `docling-convert.py` 작성)
4. **extractPdfText 재구성** (tier 재배치, docling tier 1 추가, mdimport 삭제)
5. **selectConverter 리팩토링** + `extractHwpText` / `extractDocumentText` helpers
6. **보안 수정** (§4.1.1.5) — API key env 전환
7. **품질 감지** (§4.1.1.6) — `convert-quality.ts` + tier 재시도 로직
8. **캐시** (§4.1.1.4 + §4.1.1.8) — `convert-cache.ts` + Audit UI "Force re-convert"
9. **md 사본 저장/이동** (§4.1.1.9) — rename/delete listener, sidecar 정책
10. **벤치마크 스크립트 + 리포트** (§4.1.1.7)

1~6 은 필수 구현, 7~10 은 같은 세션 내 후속. variance 재개(§4.5.1.5)는 1~5 완료 시점부터 시도 가능.

## Verification

### 단위 테스트 (`wikey-core/src/__tests__/`)

- `rag-preprocess.test.ts` — 4개 샘플 고정 입력 스냅샷, 일반 링크 보존 assert.
- `convert-cache.test.ts` — 동일 sha256 두 번째 호출 spy, TTL 만료, invalidate.
- `convert-quality.test.ts` — 공백 소실·빈 섹션 비율·테이블 깨짐 탐지.
- `ingest-pipeline.test.ts` 확장 — `selectConverter` 분기 매트릭스 (pdf/hwp/hwpx/docx/md/unknown).

목표: 기존 197 tests + 신규 ~25 tests, 전부 PASS.

### 통합 테스트 (샘플 파일 기반)

```bash
# 1. Docling 경로 (PDF)
node -e "..."  # extractPdfText(docs/samples/rp1-peripherals.pdf) → markdown 에 [image: Image] 19개 치환 확인

# 2. unhwp 경로 (HWPX)
node -e "..."  # extractHwpText(docs/samples/Examples.hwpx) → markdown 에 [image] 13개, strip 후 ≤1KB

# 3. Web Clipper 경로 (md)
node -e "..."  # wikiFS.read + stripEmbeddedImages(GOODSTREAM.md) → ![Arch](https://...svg) → [image: Arch]

# 4. MarkItDown fallback 경로 (docling 비활성화)
env DOCLING_DISABLE=1 node -e "..."  # tier 3 으로 폴스루 확인
```

### 보안 검증 (§4.1.1.5)

인제스트 중 다른 터미널에서:
```bash
ps aux | grep -E "markitdown|docling|ocr" | grep -E "AIza|sk-|ssk-"
# 결과: 0건 (key 미노출)
```

### 실제 인제스트 (regression)

Obsidian 플러그인 빌드 → 재시작 → PMS PDF 인제스트 → §4.5.1.5 measurement 파이프라인으로 3회 run.
- 성공 기준: 0 errors, chunk 수가 run 간 ±1 이내 (Docling 구조화 markdown 효과), 총 entity+concept 수 CV < 10%.

## Risks & Mitigations

| 리스크 | 완화 |
|---|---|
| docling 초기 실행 ML 모델 ~1.5GB 다운로드 → 첫 인제스트 수분 지연 | 설정탭 "Prewarm" 버튼 (`docling --help` 또는 dummy 변환으로 유도). 진행률 로그. |
| `uv tool install docling` 미설치 사용자 → tier 3 fallback 으로 조용히 내려감 (품질 저하 인지 어려움) | settings-tab Environment 섹션 "Docling: Not installed" 배지 + 인제스트 진행 메시지에 현재 tier 명시. |
| `pip install unhwp` 미설치 → `.hwp` 인제스트 실패 | env-detect 시점에 감지, Audit 패널에서 해당 파일 업로드 시 즉시 에러 + 설치 가이드. |
| 이미지 strip 이 의도치 않게 일반 링크 제거 | `EXTERNAL_IMG` regex 는 `image/` MIME 또는 확장자(svg/png/…)만 매칭, 테스트에 일반 `[텍스트](https://…)` 보존 케이스 포함. |
| 캐시 hash 충돌 (다른 파일 + 같은 옵션) | sha256 + tier + options JSON 직렬화 → 실질 충돌 확률 0. `.wikey/cache-index.json` 에 원본 경로 기록해 디버깅 가능. |
| md 사본 저장으로 raw/ 폴더 비대화 | `.gitignore` 에 `raw/**/*.pdf.md`, `raw/**/*.hwp.md` 등 포함. 캐시 TTL + Audit "정리" 버튼으로 관리. |

## Critical Files

- `wikey-core/src/ingest-pipeline.ts:74-86, 842-1063, 790-840` — 분기·tier 체인·OCR endpoint
- `wikey-obsidian/src/env-detect.ts:8-25, 166-195, 197-259` — EnvStatus·check 함수·detectEnvironment
- `wikey-obsidian/src/settings-tab.ts:31-136` — Environment 섹션
- `claude-forge-custom/skills/docling/SKILL.md`, `rag_preprocess.py` — 참조 구현
- `claude-forge-custom/skills/unhwp/SKILL.md`, `convert.py` — 참조 구현 + vendoring 대상
- `wikey-core/src/config.ts`, `types.ts` — WikeyConfig 확장
- `wikey.conf` — 설정 키 추가
- `docs/samples/*` — regression snapshot 입력

## Out of Scope

- §4.5.1.5 variance 재측정 자체는 본 계획 완료 후 시작 (선행 의존).
- Docling Python API 직접 import(프로젝트 venv 경유). 현재 계획은 CLI execFile 단일 경로.
- VLM pipeline (`docling --pipeline vlm`) — 비용·추가 모델 관리 부담, phase 5+ 재검토.
- qmd SDK import 전환 (§4.5.2) — 별개 과제.
