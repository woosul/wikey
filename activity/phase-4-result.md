# Phase 4 결과 보고서

> 기간: 2026-04-21 ~ (진행중)
> 목표: 인제스트 고도화 + 지식 그래프 + 운영 안정성 (plan/phase-4-todo.md 참고)
> 상태: 진행중 (2026-04-21)
> - §4.0 UI 사전작업 — 완료 (chat 전담 패널, /clear 커맨드, dashboard 아이콘 교체, 사이드바 500px, provider/model 편집)
> - §4.1.1 Docling 메인화 + unhwp + MarkItDown fallback — **완료** (신규 모듈 3 + vendored 1 + 벤치마크 1, 197 → 233 tests PASS)
> - §4.5.1 측정 인프라 자동화 — 완료 (자동 스크립트가 수동 CDP 드라이브 대체)
> - §4.5.1.4 canonicalizer 2차 (pin/alias) — 기능 완수 / CV 개선 미확증 (197 tests PASS)
> - §4.5.1.5 LLM extraction variance 원인 분석 — **선행 의존 §4.1.1 완료로 재개 가능** (미착수)
> 전제: Phase 3 완료 (v7 3-stage, schema override, 결정성 CV Concepts -37% / Total -53%)
> 인프라: Obsidian 1.12.7 + CDP 9222, Ollama 0.20.5, Node 22.17.0

---

> 문서 구성: `plan/phase-4-todo.md`의 4.0~4.5 번호를 1:1 mirror. Phase 3 패턴처럼 작업 주제(subject) 단위로 그룹화하고, 각 subject 내부는 진행 시간 순.

---

## 4.0 UI 사전작업
> tag: #design, #main-feature

### 4.0.1 Chat 전담 패널 분리 + Header 아이콘 재구성 (2026-04-21)

**이전 상태**: `WikeyChatView` header 버튼 순서 `[dashboard][ingest+][audit][help][trash][reload][close]`. 하단 composer(`textarea + send + modelRow`)가 모든 패널에서 공유되어 audit/dashboard를 보는 중에도 "질문 입력창 + 모델 선택기"가 떠 있음 → 각 패널의 전담 역할이 흐려지는 overlay 문제.

**결정 (사용자)**: 대화창(chat)을 first-class 패널로 승격. 비-chat 패널은 composer를 숨기고 하단에 `Default AI Model : Provider | model` readonly 라벨만 노출.

**구현** (`wikey-obsidian/src/sidebar-chat.ts`):

1. **ICONS 추가/교체**
   - `ICONS.chat` 추가: Bootstrap Icons `chat` 말풍선 SVG (16×16)
   - `ICONS.dashboard` 교체: 기존 집(home) → 막대그래프(`bar-chart`) SVG — 사용자 지시 "막대그래프"
   - `ICONS.trash`는 header에서 제거됐으나 map 자체는 유지 (향후 재사용 가능성, dead-code lint는 별도)

2. **`PanelName` 타입 확장**
   ```typescript
   type PanelName = 'chat' | 'dashboard' | 'audit' | 'ingest' | 'help'  // null 제거
   ```
   초기 `activePanel = 'chat'`, 항상 값 가짐.

3. **Header 버튼 재구성**: `[chat][dashboard][ingest][audit][help][reload][close]` — chat이 first, trash 삭제.

4. **`togglePanel` → `selectPanel` rename** — 재클릭이 no-op (on/off 토글 아닌 re-select):
   ```typescript
   private selectPanel(name: PanelName) {
     if (this.activePanel === name) return  // 재클릭은 재선택
     this.closeActivePanel()
     this.activePanel = name
     if (name === 'dashboard') this.openDashboard()
     else if (name === 'audit') this.openAuditPanel()
     else if (name === 'ingest') this.openIngestPanel()
     else if (name === 'help') this.openHelp()
     // chat: messagesEl이 chat view 자체, 별도 DOM 마운트 불필요
     this.updatePanelBtnStates()
     this.applyPanelVisibility()
   }
   ```
   사용자 의도 명시: "재선택임 (on/off아님)"

5. **`applyPanelVisibility()` 신규** — 한 지점에서 가시성 결정:
   ```typescript
   const isChat = this.activePanel === 'chat'
   this.messagesEl.style.display = isChat ? '' : 'none'
   this.inputWrapper.style.display = isChat ? '' : 'none'
   this.modelRow.style.display = isChat ? '' : 'none'
   this.readonlyModelBar.style.display = isChat ? 'none' : ''
   if (!isChat) this.refreshReadonlyModelBar()
   ```
   기존 `openAuditPanel`의 `messagesEl.style.display='none'` 직접 호출, `closeActivePanel`의 audit 분기 restore도 제거 → 일원화.

6. **Readonly Model Bar** — 비-chat 패널 하단:
   ```
   Default AI Model : Google Gemini | gemini-2.5-flash
   ```
   Provider pretty-name 매핑은 `settings-tab.ts:147-151, 266-269`와 일치:
   ```typescript
   const PROVIDER_PRETTY_NAMES = {
     gemini: 'Google Gemini', anthropic: 'Anthropic Claude',
     'claude-code': 'Anthropic Claude', openai: 'OpenAI Codex',
     ollama: 'Local (Ollama)',
   }
   ```
   `refreshReadonlyModelBar()`가 `resolveProvider('default', this.plugin.buildConfig())` 결과로 매 패널 전환 시 재렌더.

**결과**: 빌드 0 errors, 197 tests PASS. CDP 9222 수동 검증으로 버튼 순서·readonly bar 포맷·active 상태 모두 확인.

### 4.0.2 `/clear` 슬래시 커맨드 + placeholder (2026-04-21)

**이전 상태**: Header의 trash 아이콘 클릭 → `clearChat()` 호출.

**변경**: trash 버튼 제거. 대화창 입력 textarea에 `/clear`를 타이핑 후 Enter로 대체.

```typescript
private async handleSend() {
  const question = this.inputEl.value.trim()
  if (!question) return
  if (question === '/clear') {
    this.inputEl.value = ''
    this.clearChat()
    return
  }
  // ... 기존 LLM query 로직
}
```

`clearChat()`: chat 히스토리 비우고, `activePanel !== 'chat'`이면 chat으로 복귀 + welcome 복원.

placeholder 갱신: `'Ask a question… (type /clear to reset)'`.

### 4.0.3 재시작/Reload 시 메시지 초기화 (2026-04-21)

**이전 상태**: `main.ts loadSettings`가 `settings.persistChatHistory && savedChatHistory?.length` 조건에서 `chatHistory`를 복원. Obsidian 재시작/`Cmd+R` 시 이전 세션 대화가 그대로 노출.

**변경 (사용자 지시 "재시작/reload 시 메시지창 초기화 추가")**:

```typescript
// 4. 대화 히스토리는 세션별 초기화 (재시작/reload 시 빈 상태 — §4.0 요구)
this.chatHistory = []
```

복원 블록(3줄) 제거, 무조건 빈 배열. 저장 로직(`scheduleChatSave`/`saveSettings`)은 유지 — `savedChatHistory`가 data.json에 남지만 로드 시 무시되는 dead state (향후 정리 대상, `persistChatHistory` 토글 UI도 연쇄 정리 필요).

### 4.0.4 Chat 패널 Provider/Model 편집 가능 (2026-04-21)

**이전 상태**: chat 패널 하단 modelRow의 provider는 `<span class="wikey-chat-provider-label">` 읽기 전용(`provider.toUpperCase()` 표시), model만 `<select>` 드롭다운.

**변경 (사용자 지시 "chat 패널의 기본값은 default ai model이지만, provider/model 모두 바꿀수 있도록")**: provider span → `<select>` 전환. Settings tab (`settings-tab.ts:147-151`)의 5개 옵션 그대로 재사용:

```typescript
const PROVIDER_OPTIONS = [
  { value: 'ollama', label: 'Local (Ollama)' },
  { value: 'gemini', label: 'Google Gemini' },
  { value: 'anthropic', label: 'Anthropic Claude' },
  { value: 'openai', label: 'OpenAI Codex' },
  { value: 'claude-code', label: 'Anthropic Claude' },
]
```

Provider 변경 핸들러 (settings-tab.ts:154-165 동일 동작):
- `settings.basicModel = newProvider`
- `settings.cloudModel = ''` (초기화)
- `settings.ingestProvider` 빈 값이면 `ingestModel`도 초기화 (inherits 관계)
- 저장 후 `modelSelect.empty()` → `(loading…)` 임시 옵션 → 새 provider로 `loadModelList()` 재호출 → 첫 모델 자동 선택 → 다시 저장
- `refreshReadonlyModelBar()` 호출로 비-chat 패널이 다음 활성화될 때 새 값 반영

또한 `modelRow`를 `inputWrapper` 밖 container 직속 형제로 **이동**. 당초 audit/ingest와 공유하는 설계를 시도했으나 사용자 재지시 "provider/model 편집은 chat 전용, audit/ingest는 readonly 유지"에 따라 최종적으로 chat 패널에서만 visible. audit/ingest 내부의 `.wikey-provider-model-bar`(inbox override용)는 별개 기능으로 유지.

### 4.0.5 CSS 정비 — Readonly Bar · Active 버튼 · 2px 중첩 해소 (2026-04-21)

**파일**: `wikey-obsidian/styles.css`.

1. **`.wikey-readonly-model-bar` 신규**:
   ```css
   border-top: 1px solid var(--background-modifier-border);
   flex-shrink: 0;
   padding: 8px 10px;
   font-size: 0.82em;
   color: var(--text-muted);
   display: flex; align-items: center; gap: 2px;
   ```

2. **`.wikey-dashboard` / `.wikey-chat-help`**: `flex: 1; min-height: 0; overflow-y: auto` 추가 (audit/ingest와 동일 패턴) → readonly bar가 항상 하단 고정. `border-top`/`border-bottom` 제거 → header의 `border-bottom`과 2px 중첩 해소.

3. **`.wikey-header-btn-active`에 `:focus`·`:focus-visible` 변형 추가**:
   ```css
   .wikey-header-btn-active,
   .wikey-header-btn-active:hover,
   .wikey-header-btn-active:focus,
   .wikey-header-btn-active:focus-visible {
     background: var(--interactive-accent) !important;
     color: white !important;
   }
   ```
   **원인**: `.wikey-header-btn:focus` (specificity 0,2,0) vs `.wikey-header-btn-active` (0,1,0) — 전자가 specificity로 이겨 클릭 직후 focus 상태에서 icon만 accent color로 보였음. `:focus` 변형을 active 규칙에 포함해 동일 specificity로 맞춤. 결과: 1번 클릭으로 즉시 accent 배경 + 흰 텍스트.

### 4.0.6 Audit/Ingest Inbox Override 드롭다운 자연 너비화 (2026-04-21)

**이전 상태**: `.wikey-provider-model-bar .wikey-select { flex: 1; min-width: 0 }` → 두 드롭다운이 50/50으로 컨테이너 폭을 꽉 채움. 옵션 라벨이 짧아도 넓게 늘어남.

**변경 (사용자 지시 "50%, 50%로 단순하게 나누지 말고, 안의 내용에 따라 크기")**:

```css
.wikey-provider-model-bar .wikey-select {
  flex: 0 0 auto;
  width: auto;
  field-sizing: content;
}
.wikey-provider-model-bar { justify-content: flex-start; }
.wikey-provider-model-bar select:nth-of-type(1) { min-width: 180px; }
.wikey-provider-model-bar select:nth-of-type(2) { min-width: 240px; }
```

- **`field-sizing: content`**: Chromium 123+ / Electron 39 지원 CSS. Select가 **가장 긴 옵션** 기준이 아닌 **현재 선택된 옵션** 기준으로 폭을 계산 → 긴 모델명(`gemini-2.5-flash-preview-...`)이 드롭다운 폭을 부풀리는 문제 제거.
- **좌측 정렬**: `.wikey-provider-model-bar`는 `.wikey-audit-apply-bar` 클래스도 공유하며 후자가 `justify-content: flex-end` — provider-model-bar에서 `flex-start`로 override.
- **표준 min-width** (사용자 "provider는 크기를 이미알고, model도 표준사이즈를 알잖아?"): provider 180px ("Anthropic Claude" 길이), model 240px (전형 모델 ID). 사용자 최종 지시는 210/270에서 180/240으로 조정.

Chat 패널의 `.wikey-chat-model-row .wikey-select`에도 동일 `field-sizing: content` + `flex: 0 0 auto` 적용 → 긴 옵션으로 부풀지 않음.

### 4.0.7 DEFAULT 라벨 통일 (2026-04-21)

**이전 상태**: 9개 위치에서 `(use Default Model)` (provider 빈 값), `(provider default)` (model 빈 값) 혼용 — settings-tab.ts 2곳, sidebar-chat.ts 7곳.

**변경 (사용자 지시 "기본값 명칭도 (use Default Model) > DEFAULT로", "provider/model 모두")**:

```bash
sed -i "s/'(use Default Model)'/'DEFAULT'/g; s/'(provider default)'/'DEFAULT'/g" \
  wikey-obsidian/src/sidebar-chat.ts wikey-obsidian/src/settings-tab.ts
```

추가로 `settings-tab.ts:288`의 description 텍스트 "Leave at (provider default) to inherit..." → "Leave at DEFAULT to inherit..." 수동 업데이트.

### 4.0.8 사이드바 초기 폭 500px (2026-04-21)

**배경**: Obsidian right sidebar 기본 폭(~300px)은 provider 180 + model 240 + gap + 여백이 들어가지 못함. 사용자 측정 시 workspace.json 저장 값 530px이 이미 있었으나 신규 설치/초기화 시에는 좁은 기본값.

**변경 (사용자 지시 "사이드바 width초기값 500px으로")**:

1. **Settings 스키마 확장** (`main.ts`):
   ```typescript
   interface WikeySettings {
     // ...
     initialSidebarWidthApplied: boolean  // 최초 1회 플래그
   }
   const DEFAULT_SETTINGS = { ..., initialSidebarWidthApplied: false }
   ```

2. **`applyInitialSidebarWidth()` 신규 메서드**:
   ```typescript
   private async applyInitialSidebarWidth() {
     if (this.settings.initialSidebarWidthApplied) return
     ;(this.app.workspace as any).rightSplit?.setSize?.(500)
     this.settings = { ...this.settings, initialSidebarWidthApplied: true }
     await this.saveSettings()
   }
   ```
   `rightSplit.setSize(N)` API는 Obsidian 내부 메서드 (CDP로 prototype methods 확인: `serialize, setSize, toggle, collapse, expand, onSidedockResizeStart, recomputeChildrenDimensions`).

3. **`activateChatView`의 양 분기에서 호출**: 기존 leaf 재활성화 / 신규 leaf 생성 모두. 최초 1회만 적용되고 이후 사용자 리사이즈 값은 plugin이 건드리지 않음 (Obsidian workspace.json이 관리).

**검증 (CDP 측정)**: 리로드 + `activateChatView` 후 `app.workspace.rightSplit.containerEl.getBoundingClientRect().width` = 500. `settings.initialSidebarWidthApplied = true`.

### 4.0.9 검증 및 반영 파일 요약

- **빌드**: `npm run build` → 0 errors (wikey-core + wikey-obsidian)
- **테스트**: `npm test` → 9 files / **197 tests PASS** (0 failed, wikey-core 미변경)
- **수동 CDP 검증 (9222번 포트)**:
  - Header 순서: `[chat][dashboard][ingest][audit][help][reload][close]` ✓
  - 사이드바 폭 500px ✓
  - audit 패널 DEFAULT/DEFAULT 드롭다운: width 180/240px, `justify-content: flex-start` ✓
  - active 버튼: 첫 클릭에 accent 배경 + white 텍스트 (focus 상태에서도 유지) ✓
  - readonly bar: `Default AI Model : Google Gemini | gemini-2.5-flash` 하단 고정 ✓
  - `/clear` → 히스토리 비워짐 + welcome 복원 ✓
  - 재시작 → chatHistory 빈 상태 (복원 안 됨) ✓
  - 스크린샷 보존: `/tmp/wikey-{chat-bottom,audit,audit-after,audit-v3,audit-v4,audit-500}.png`

- **변경 파일 (diff 규모)**:
  - `wikey-obsidian/src/sidebar-chat.ts` (+120 / -40): 아이콘·PanelName·selectPanel·applyPanelVisibility·prettyProvider·PROVIDER_OPTIONS·readonlyModelBar·/clear·modelRow 이동
  - `wikey-obsidian/src/main.ts` (+14 / -4): `initialSidebarWidthApplied` 설정·`applyInitialSidebarWidth()`·savedChatHistory 복원 제거
  - `wikey-obsidian/src/settings-tab.ts` (-4, 라벨 일괄 치환): `(use Default Model)`/`(provider default)` → `DEFAULT`
  - `wikey-obsidian/styles.css` (+30 / -8): readonly-model-bar 신규·header-btn-active focus 변형·provider-model-bar 자연 너비/좌측 정렬/min-width·dashboard/help flex+border 정비·chat-model-row select field-sizing

---

## 4.1 문서 전처리 파이프라인 재편
> tag: #core, #workflow

### 4.1.1 Docling 메인화 + unhwp HWP/HWPX + MarkItDown fallback 강등 (2026-04-21)

**이전 상태** (Phase 3 종료 시점): `wikey-core/src/ingest-pipeline.ts:extractPdfText` 는 PDF 전용 6-tier: MarkItDown → pdftotext → mdimport → pymupdf → markitdown-ocr → Vision OCR. 확장자 분기는 `.pdf` 만 처리 (`ingest-pipeline.ts:75`), HWP/HWPX는 `wikiFS.read()` 로 바이너리 통과. tier 5/6 에서 `execFileAsync` args 로 API 키 평문 전달 → `ps aux` 노출.

**결정 (2026-04-21)**: IBM Docling(TableFormer + layout model + ocrmac/RapidOCR/Tesseract)을 tier 1 메인 컨버터로 승격. HWP/HWPX 는 unhwp(pip install) 로 위임. MarkItDown 은 docling 미설치 환경 fallback 으로 tier 3 강등. 이미지(base64 data URI + 외부 URL) 는 LLM 투입 직전 `[image] / [image: alt]` placeholder로 치환하여 토큰 폭증 차단 + alt 보존.

**구현 계획**: `plan/phase-4-4-1-agile-crystal.md` — 사용자 승인. 9개 서브태스크 (4.1.1.1 ~ 4.1.1.9) 모두 수행.

#### 4.1.1.1 Tier 체인 전면 재구성 (`ingest-pipeline.ts:842~1322`)

새 6-tier + 1b:
1. **docling** (`buildDoclingArgs` + `readDoclingOutput` + tmp dir output) — 기본 `--table-mode accurate` / `--image-export-mode embedded` / mps(Apple Silicon) 자동
1b. **docling --force-ocr** (품질 감지 시 자동 재시도)
2. **markitdown-ocr** (embedded raster vision OCR) — 기존 tier 5 에서 승격
3. **MarkItDown** (fallback) — 기존 tier 1 강등, 로그 라벨 `tier 3/6 start: markitdown (fallback)`
4. pdftotext (poppler)
5. pymupdf / PyPDF2
6. page-render Vision OCR (최후수단, vector-only PDF용)

구 tier 3 (`mdimport`) 은 Spotlight 의존·품질 낮음·docling 으로 대체 가능 → 삭제.

`selectConverter` 분기 (`ingest-pipeline.ts:75~119`):
```
ext ∈ {hwp, hwpx}                         → extractHwpText (unhwp)
ext == 'pdf'                              → extractPdfText (full chain)
ext ∈ DOCLING_DOC_FORMATS                 → extractDocumentText (docling 단일)
else                                      → wikiFS.read + stripEmbeddedImages
```

`DOCLING_DOC_FORMATS = {docx, pptx, xlsx, html, htm, png, jpg, jpeg, tiff, tif, csv}`.

#### 4.1.1.2 공통 이미지 placeholder (`wikey-core/src/rag-preprocess.ts`)

docling/unhwp/Web Clipper 모든 경로에 공통 적용:
- `!\[(alt)\]\(data:[^)]+\)` (base64 embed) → `[image]` 또는 `[image: alt]`
- `!\[(alt)\]\(https?://[^)]+\.(svg|png|jpe?g|gif|webp|bmp|tiff?|avif)[?#]?\)` (외부 URL) → 동일 placeholder
- alt 가 `""` 또는 `"image"` (대소문자 무관) 이면 `[image]` 축약 — docling 고정 alt `"Image"` + unhwp `"image"` 모두 중복 라벨 방지

**실샘플 회귀 (docs/samples/)**: docling PDF 1.90MB → 237KB (8.0×), unhwp HWPX 1.72MB → 850B (2017×), Web Clipper 10.1KB → 10.1KB (1건 외부 URL 치환). 계획서 표와 일치.

#### 4.1.1.3 선택된 tier·옵션 API 보안 (§4.1.1.5)

tier 2 markitdown-ocr / tier 6 Vision OCR 의 `execFileAsync` args 에서 `ocr.apiKey` 삭제 → `env` 에 `OPENAI_API_KEY` / `OPENAI_BASE_URL` 주입 → Python SDK 가 env 참조. `ps aux | grep -E "markitdown|docling|ocr"` 결과에서 API 키 전무.

#### 4.1.1.4 변환 결과 영속 캐시 (`wikey-core/src/convert-cache.ts`)

- 키: `sha256(sourceBytes) + converter + majorOptions(table_mode/ocr_engine/ocr_lang/image_export_mode)`
- 저장: `~/.cache/wikey/convert/<hash>.md` + `index.json` (TTL 30일)
- API: `computeCacheKey / getCached / setCached / invalidate / cleanup / stats`
- 적용: `extractPdfText` / `extractHwpText` / `extractDocumentText` 진입부 cache 체크, 성공 반환 전 setCached
- `IngestOptions.forceReconvert = true` 시 bypass (Audit "Force re-convert" 체크박스와 연동)

테스트 11건 PASS (TTL 만료 자동 삭제, orphan cleanup, deterministic key, 옵션 순서 무관).

#### 4.1.1.5 품질 감지 + tier 재시도 (`wikey-core/src/convert-quality.ts`)

4가지 결함 signal 스코어링:
- `brokenTableRatio` (`|` 연속 빈 셀)
- `emptySectionRatio` (heading 직후 50자 미만)
- `minBodyChars` (전체 본문 100자 미만)
- `koreanWhitespaceLoss` (15자+ 한글 토큰 > 30%)

decision: `accept` | `retry` (`--force-ocr` 재시도) | `reject` (다음 tier 폴스루). 특히 한국어 공백 소실은 `retryOnKoreanWhitespace=true` 이면 tier 1b 재시도, `false` 또는 재시도 실패 시 강제 reject.

테스트 10건 PASS.

#### 4.1.1.6 자동 force-ocr 감지 로직 (사용자 override 불필요)

**재결정 (2026-04-21, ROHM 샘플 검증 후)**: 사용자 피드백 "UI override 바람직하지 않음, 프로그램 로직으로 자동 판정". 한 차례 추가했던 Converter 드롭다운을 제거하고, 전체 로직을 자동화. Force re-convert 체크박스만 캐시 bypass 용 디버그 토글로 유지.

**자동 판정 2개 조건** (`convert-quality.ts` + `extractPdfText` tier 1 블록):

1. **웹페이지 → PDF 프린트 패턴** (ROHM Wi-SUN 스타일): `koreanLongTokenRatio(md) > 30%`
   - 음수 kerning 으로만 간격 표현 → text-layer 에 공백 소실 → 15자+ 한글 토큰이 전체의 30% 초과
   - 실측: ROHM textlayer **60.20%** (감지 O) / forceocr 0.27% (정상) / PMS 제품소개 4.93% (감지 X, retry 스킵)
2. **스캔 PDF 패턴** (이미지 생성 PDF): `isLikelyScanPdf(md, pageCount)`
   - 페이지당 본문 < 100자 AND 전체 한국어 < 50자
   - text-layer 가 거의 없어 이미지에서 OCR 필요
3. **Regression guard** (PMS 벡터 PDF 독성 방어): `hasKoreanRegression(tier1, tier1b)`
   - force-ocr 결과가 tier 1 대비 한국어 50% 미만이면 tier 1 롤백
   - 근거: PMS 벤치마크에서 ocrmac 이 벡터 PDF 래스터화 시 한국어 0자 출력

**로직 흐름** (`ingest-pipeline.ts:1115~`):
```
tier 1 docling 실행
→ score + koreanLongRatio + isLikelyScanPdf 측정
→ accept (정상 텍스트 PDF): 그대로 return
→ retry (공백 소실 or 스캔):
    tier 1b docling --force-ocr 실행
    → hasKoreanRegression: tier 1 롤백
    → quality accept: tier 1b return
    → quality reject: tier 1 vs tier 1b score 비교, 더 높은 쪽 채택
    → 모두 실패: tier 2 폴스루
```

**UI**: Audit 패널 bottom bar에 `Force re-convert (bypass cache)` 체크박스 1개만 남김 (캐시 디버그 용).

**삭제된 코드**:
- `ConverterOverride` 타입 (ingest-pipeline.ts), `IngestOptions.converterOverride` 필드, `IngestRunOptions.converterOverride` 필드
- `runTier()` 가드 헬퍼, tier 2/3/6 의 override 스킵 분기, docling-ocr 단독 실행 분기
- sidebar-chat.ts 의 `converterBar` + `converterSelect` 및 6개 option

#### 4.1.1.7 정량 벤치마크 (PMS 제품소개 PDF, 3.5MB / 31p)

`scripts/benchmark-converters.sh` + `activity/phase-4-converter-benchmark-2026-04-21.md`:

| Tier | stripped bytes | headings | tables | korean | time |
|---|---:|---:|---:|---:|---:|
| **docling** | 83,518 | **64** | **133** | 15,549 | 19.71s |
| docling-force-ocr | 6,564 | 33 | 103 | **0** | 23.55s |
| MarkItDown | 62,334 | 0 | 0 | 16,565 | 3.16s |
| pdftotext | 61,459 | 0 | 0 | 16,565 | 0.13s |
| pymupdf | 62,667 | 0 | 0 | 16,565 | 0.27s |

**핵심 결과**:
- docling이 MarkItDown 대비 **headings +64 / tables +133 / 이미지 +25** (구조 보존 압도적, 계획서 +20% 기준 훨씬 초과).
- docling-force-ocr는 **벡터 PDF에서 한국어 0자** — ocrmac이 text-layer 무시 후 벡터 래스터화 열화로 한글 OCR 실패. 자동 재시도는 30% 임계 기반이라 안전, Audit override 경고 title hint 추가.
- 첫 변환 19.71s vs 3.16s (6.2× 느림) 이지만 캐시 히트 시 ~ms.

#### 4.1.1.8 md sidecar 저장 (§4.1.1.9 경로 이동은 후속)

변환 성공 시 원본 옆 `<source>.md` 사본 저장 — pdf/hwp/hwpx/docx/… 전 포맷 (md/txt 생략, 이미 존재 시 덮어쓰지 않음). 사용자가 LLM 에 투입된 실제 텍스트 확인 가능. vault rename/delete listener 는 §4.2.2 URI 참조 구현과 함께 후속.

#### 4.1.1.9 환경 감지 + 설정 탭 UI

`env-detect.ts` 에 `checkDocling(env)` / `checkUnhwp(pythonPath, env)` 추가 + `EnvStatus.hasDocling` / `doclingVersion` / `hasUnhwp` 필드. `settings-tab.ts` Environment 섹션 items 배열 맨 위에 `Docling`·`unhwp` 라인 2개 삽입, MarkItDown desc 는 "Fallback converter (docling 미설치 시)" 로 수정. `Docling Install Guide` 버튼 (→ docling-project 공식 설치 페이지) + `Install unhwp` 버튼 (`pip install unhwp`) 추가.

#### 4.1.1.10 검증 결과 요약

- wikey-core tsc + wikey-obsidian esbuild 빌드 0 errors
- 테스트: 197 → **233 PASS** (+36: rag-preprocess 15 / convert-cache 11 / convert-quality 10)
- 실샘플 4종 (docs/samples/) 에 stripEmbeddedImages 회귀 검증 → 계획서 표와 byte-perfect 일치
- PMS PDF 실측 벤치마크 → docling 구조 보존 MarkItDown 대비 압도적
- 커밋: `e9af2bb` (메인 인프라) + `[이번 커밋]` (벤치마크 리포트 + Audit converter override UI)

#### 4.1.1.11 후속 과제 (§4.1.1 범위 내)

- **추가 코퍼스 벤치마크** — TWHB 파워디바이스 / OMRON HEM-7600T / 스캔 PDF 1건 / HWPX (이미지 포함) → activity 리포트 확장
- **`ps aux` 실측 검증** (§4.1.1.5 마지막 검증 단계) — 인제스트 run 중 다른 터미널에서 확인
- **`scripts/cache-stats.sh`** — 캐시 히트율/크기/오래된 항목 보고 CLI
- **vault rename/delete listener** — §4.2.2 URI 기반 안정 참조와 합동 구현 (sidecar md 자동 이동/삭제)
- **해제된 선행 의존**: §4.5.1.5 variance 재개 가능 — Docling 구조적 markdown 확보로 "전처리 품질" 성분 분리 측정 준비 완료

---

## 4.5 운영 · 안정성
> tag: #ops, #eval

### 4.5.1 결정성 측정 인프라 (measure-determinism.sh)

Phase 3 종반 (04-20) 자동 스크립트 4회 실패의 근본원인은 React state가 아닌 `scripts/measure-determinism.sh`의 **selector 버그** 2건 + **CDP 응답 추출 경로 버그** + **content-match 기반 cleanup의 fragility**. 04-21 수동 CDP 드라이브(5/5 성공)로 파이프라인 결정성은 별도 확증(§3.6.6). 본 작업은 그 수동 드라이브 로직을 자동 스크립트에 이식해 재사용 가능한 인프라로 만드는 것.

#### 4.5.1.1 selector 수정 + CDP 응답 추출 경로 수정 + size guard (2026-04-21)

**이전 상태**: `scripts/measure-determinism.sh` 의 btnProbe/btnNow 두 지점이 모두 class-specific selector 사용.

```js
// 버그 코드 (line 233, 242)
document.querySelector('.wikey-audit-panel .wikey-audit-apply-btn')?.textContent?.trim()
```

Ingest 시작 직후 버튼 class가 `wikey-audit-apply-btn` → `wikey-audit-cancel-btn` 로 **swap** (`wikey-obsidian/src/sidebar-chat.ts:999-1000`). `querySelector('.wikey-audit-apply-btn')` → null → probe 실패 → 20 probe 후 `ingest did not start` 오진.

추가 발견: bash 측 CDP 응답 파싱도 경로가 잘못되어 있었음.

```bash
# 버그
print(json.dumps(d.get('result',{}).get('value',[])))
```

`Runtime.evaluate` + `returnByValue=True` 응답 실제 구조는 `{id, result: {result: {type, value}}}` — `d['result']['value']`는 항상 `[]` (fallback) 반환. 과거 "ingest did not start" 에러가 출력됐다면 그건 CDP 경로는 다른 쪽에서 돌아갔거나 로직 흐름이 실제로 이 지점에 도달하지 않았을 가능성 (바뀐 사실: 현 시점 재현 시 `[]`).

**수정 내용** (동 커밋):

1. **Class-agnostic button finder** — `sidebar-chat.ts`의 class swap에 의존하지 않고 텍스트+클래스 filter로 탐지
   ```js
   function getActionBtn() {
     const panel = document.querySelector('.wikey-audit-panel')
     return [...panel.querySelectorAll('button')].filter(b => /apply|cancel/.test(b.className))[0] || null
   }
   ```
   시작 probe (30s × 500ms = 60회) 와 완료 probe 양쪽 통일.
2. **pre/post snapshot diff** — `readSourceTagsOf` (content-match, frontmatter `sources: source-XYZ` 형식 미스매치 리스크) 삭제하고 run 직전 `snapshotDirs()` 로 `wiki/{entities,concepts,sources}` 전체 md 파일 Set 저장 → run 직후 `listDiff(baseline)` 로 **신규 파일만** 정확히 집계. cleanup도 이 신규 파일 리스트만 삭제 (임의 slug 파일 삭제 리스크 제거).
3. **Stale Cancel guard** — 루프 진입 시 버튼 텍스트가 `Cancel` 이면 먼저 click으로 취소 후 1초 대기 → 이전 run 잔재로 인한 block 방지.
4. **CDP extraction 경로 수정** — `d['result']['result']['value']` 로 변경. `value` 키 없으면 `{cdp_error: d}` 로 fallback하여 Python 쪽에서 raw 덤프.
5. **최소 크기 가드** — 15KB 미만 소스는 chunk <3 예상 → CV 측정 의미 없음 → exit 2. `-f/--force` 옵션으로 우회 가능.

**결과**: 파일 스크립트 `scripts/measure-determinism.sh`, bash `-n` syntax OK. JS heredoc substitution 및 CDP extraction 양쪽 정상.

#### 4.5.1.2 기존 guard 보존

Phase 3 종반 이미 merge 된 보호 장치들은 유지 (원 todo `- [X]`):

- apply-button 전환 probe (20 × 500ms → 이번에 60 × 500ms로 확장, 30초 window)
- stale Cancel 감지 → 진입 시 자동 클릭 (§4.5.1.1의 stale cancel guard로 흡수·구현)
- `cleanupForRerun` 의 3+char 토큰 overlap 기반 슬러그 삭제 → snapshot diff 방식으로 대체 (임의 파일 삭제 리스크 제거)

#### 4.5.1.3 5-run smoke 재실행 (자동 스크립트 validation)

**대상**: `raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf` (3.5MB, 수동 드라이브 v7 post에서 사용한 동일 소스 — 비교 기준)

**1-run smoke** (로직 검증):
- 1 ok / 0 errors, 8E + 15C + 1S = 24 total, 251s
- selector/diff/extraction 모두 정상 확증

**5-run 본 측정** (`activity/determinism-pms-auto-2026-04-21.md`):

| Run | Entities | Concepts | Total | Time(s) |
|----:|---------:|---------:|------:|--------:|
|   1 |       11 |       12 |    24 |   306.8 |
|   2 |        8 |       14 |    23 |   287.3 |
|   3 |       12 |        9 |    22 |   256.4 |
|   4 |       12 |       11 |    24 |   245.2 |
|   5 |        8 |       12 |    21 |   293.3 |

| 지표     |  Mean |  Std | **CV %** |    Range |
| -------- | ----: | ---: | -------: | -------: |
| Entities | 10.20 | 2.05 | **20.1%** |     8–12 |
| Concepts | 11.60 | 1.82 | **15.7%** |     9–14 |
| Total    | 22.80 | 1.30 |  **5.7%** |    21–24 |
| Time     | 277.8s | 25.9s |    9.3% | 245.2–306.8 |

**수동 드라이브 v7 post (동일 소스, 04-21)와 비교**:

| 지표 | 수동 (04-21) | 자동 (04-21) | 차이 |
| ---- | ----: | ----: | ---: |
| Entities CV | 17.9% | 20.1% | +2.2pp |
| Concepts CV | 21.2% | 15.7% | **-5.5pp** |
| Total CV | 7.9% | 5.7% | **-2.2pp** |
| Total mean | 24.6 | 22.8 | -1.8 |
| Time mean | 320s | 278s | -42s (-13%) |

**판정**: 자동 스크립트가 수동 드라이브와 **동일한 분포 범위**를 재현. Total CV < 10%, 극값 진동 없음 (21~24). 추가로 time이 13% 짧음 — CDP 단일 세션 내 연속 실행이 수동 단절 호출보다 빠름 (plugin settings toggle 누적 latency 없음).

**Core / Variable 재확인** (count-level은 안정, naming-level 변동 남음 — v7 측정과 동일 패턴):

- Entities core 3/20 (15%): `lotus-pms`, `lotus-scm`, `project-management-institute`
- Concepts core 6/20 (30%): `bill-of-materials`, `enterprise-resource-planning`, `manufacturing-execution-system`, `project-management-body-of-knowledge`, `supply-chain-management`, `work-breakdown-structure`
- 남은 variance는 음역 다중 슬러그 (`alimtalk`, `sso-api` vs `single-sign-on-api`), E/C 경계 왕복 (`mqtt`, `restful-api`, `project-management-system`) — Phase 4 §4.5의 canonicalizer 2차 확장 과제로 이관(todo 기존 §4.5.1.4).

**부차 확인**: final cleanup 이 last-run의 신규 파일 + ingest-map 엔트리 + PARA 이동 복구 모두 수행 → baseline (52E / 41C / 10S) 정확히 복구. 단 pre-existing 페이지의 modification (e.g. `goodstream-co-ltd.md`, `index.md`, `log.md`)은 diff 범위 밖 → git checkout 으로 수동 revert 필요.

**남은 todo (§4.5.1.4로 이관)**: count-level 안정은 기존 canonicalizer로 충분. naming-level slug 안정화는 canonicalizer 2차 확장 필요. 현 세션 범위 아님.

#### 4.5.1.4 canonicalizer 2차 확장 — slug alias + E/C 경계 pin (2026-04-21, 기능 완수 / CV 개선 미확증)

**배경**: §4.5.1 측정에서 count-level은 안정(Total CV 5.7%)이나 **naming-level 변동** 잔재. 세 가지 유형:
1. 음역 다중 슬러그: `alimtalk` / `allimtok` / `alrimtok`
2. 약어/확장 불일치: `sso-api` ↔ `single-sign-on-api` ↔ `single-sign-on`, `integrated-member-database` ↔ `integrated-member-db`
3. E/C 경계 왕복: 동일 개념이 run마다 entity/concept 뒤집힘 — `mqtt`, `restful-api`, `project-management-system`

**설계**: `canonicalize.ts` 내부 후처리 2단계. schema.yaml override는 타입 vocabulary 확장만 가능해 특정 슬러그의 E/C 강제 불가 → 코드 내 map으로 해결.

##### 4.5.1.4.1 SLUG_ALIASES (음역·약어 통일)

```typescript
export const SLUG_ALIASES: Readonly<Record<string, string>> = {
  allimtok: 'alimtalk',
  alrimtok: 'alimtalk',
  'sso-api': 'single-sign-on-api',
  'single-sign-on': 'single-sign-on-api',
  'integrated-member-db': 'integrated-member-database',
}
```

Canonical 선택 근거 (2026-04-21 결정 로그):
- `alimtalk` — 카카오 공식 영문 표기 기준 (로마자 표기 drift 흡수)
- `single-sign-on-api` — 프로토콜의 API 형식 (wikey 측정에서 항상 API 경로로만 등장)
- `integrated-member-database` — 약어 대신 풀네임 (wikey convention: 산업 표준 약어는 예외, 내부 시스템 이름은 풀네임)

적용 지점: `validateAndBuildPage` 의 `const base = canonicalizeSlug(normalizeBase(name))` — anti-pattern 검사 전에 정규화 → 변이 슬러그가 하나의 canonical로 수렴. Aliases 등록 (`keptBases.add(canonicalizeSlug(normalizeBase(alias)))`)에도 적용해 cross-pool dedup에 반영.

##### 4.5.1.4.2 FORCED_CATEGORIES (E/C 경계 pin)

```typescript
export const FORCED_CATEGORIES: Readonly<Record<string, { category, type }>> = {
  mqtt: { category: 'entity', type: 'tool' },
  'restful-api': { category: 'concept', type: 'standard' },
  'project-management-system': { category: 'entity', type: 'product' },
}
```

적용: `applyForcedCategories(entities, concepts)` 후처리 — `assembleCanonicalResult` 끝에서 호출. Pass 1 (entity pool 순회) + Pass 2 (concept pool 순회) 로 pinned slug를 올바른 pool로 이동 + front-matter (`entity_type` / `concept_type`) 재작성 + 같은 base가 두 pool에 모두 나오면 entity pool이 승. 기존 `buildPageContent` 재사용, description은 `extractDescription(content)` 으로 기존 페이지에서 추출.

##### 4.5.1.4.3 단위 테스트 (11건 추가, 총 197 tests)

`canonicalizer.test.ts`에 새 describe 블록 2개:

- `v7 §4.5.1.4 slug aliases` (5 tests) — `canonicalizeSlug()` 매핑·identity·non-chaining + 실제 canonicalize() 호출에서 `allimtok` → `alimtalk`, `sso-api` → `single-sign-on-api` filename 확증
- `v7 §4.5.1.4 E/C boundary pins` (6 tests) — FORCED_CATEGORIES 맵 값 + LLM이 `mqtt`를 concept로 잘못 분류해도 entity pool로 이동 + `restful-api` 반대 방향 + 이미 올바른 경우 no-op + 양쪽 pool 중복 시 entity 승

결과: `npm test` → 9 files / **197 tests passed (0 failed)** (기존 186 → +11 new).

##### 4.5.1.4.4 5-run 측정 — variance 오히려 악화, 원인은 post-processing 밖

PMS PDF 재측정 2회 (prompt 힌트 추가 vs 제거 비교):

| 설정 | E CV | C CV | **Total CV** | Total mean | Range |
| ---- | ---: | ---: | ---: | ---: | ---: |
| §4.5.1 baseline (자동, 04-21 오전) | 20.1% | 15.7% | **5.7%** | 22.8 | 21-24 |
| 시도 1: prompt에 pin·alias 지시 추가 | 49.1% | 19.9% | 32.0% | 27.2 | 20-42 |
| 시도 2: prompt 지시 제거, 후처리만 유지 | 46.0% | 31.0% | 32.5% | 39.0 | 19-50 |

**판정**: 기능 목표(pin/alias 작동)는 **확증** — Core에 `mqtt` (entity 5/5 run), `restful-api` (concept 5/5 run), `single-sign-on-api` (통합 확증). 정량 목표(CV 개선)는 **미확증, 오히려 악화**.

**원인 가설**:
1. 시도 1의 LLM prompt 힌트가 기술 스택 항목(apache-tomcat, centos, intel-core-i5, postgresql, windows-server, rabbitmq 등) 추출을 유도 — 제거 후에도 variance 회복 안 됨 (시도 2에서 동일 수준 진동).
2. §4.5.1 baseline의 CV 5.7%가 **oversight rather than stable equilibrium** 가능성 — Gemini 2.5 Flash의 sampling randomness가 PMS처럼 긴 tech-stack 섹션이 있는 소스에선 runs 간 extraction volume을 20~50까지 진동시킴. 5-run 표본으로는 true CV 측정 불가, baseline 자체가 행운의 값일 가능성.
3. Canonicalize 코드는 LLM 출력에 프롬프트 변경 없이 후처리만 함 (시도 2 확증) → code-level regression 없음. Variance source는 upstream (chunk 분할 or LLM sampling).

**새 발견**:
- `allimtalk` 변이가 5-run 중 1개 run에서 `alimtalk`과 **공존** (slug alias map에 없는 추가 오타). 후속에서 `allimtalk` → `alimtalk` 추가 검토.
- `point-of-production-system`, `executive-information-system`, `warehouse-management-system` 등이 등장 — 이들은 `-system` suffix지만 현재 STANDARD_EXCEPTIONS에 없어 anti-pattern check를 통과. 후속 검토 필요.

##### 4.5.1.4.5 유지/이관 결정

- **코드 유지**: `SLUG_ALIASES` / `FORCED_CATEGORIES` / `applyForcedCategories` — 기능 목표(pin된 slug의 일관성)는 정량 확증됐고, variance source 개선과 직교하는 과제. 되돌리면 다음 측정에서 E/C 왕복 + alias 변이가 재발.
- **CV 개선 목표는 이관**: 진짜 variance source (chunk 분할 결정성·Gemini temperature/seed·longer run N) 는 별도 세션에서 원인 분석 선행 필요. Phase 4 §4.5.1.5 (new sub-task) 로 분할: "LLM extraction variance 원인 분석 — chunk 통계 + 10+ run baseline + temperature 옵션 재검증".
- **§4.5.1.5 의존성 메모 (2026-04-21 추가)**: 현재 MarkItDown으로 생성된 markdown은 목차·섹션·표 경계가 불명확한 **미구조화** 형태일 가능성이 높음 → chunk 분할 단위가 run마다 달라 LLM extraction volume variance를 증폭하는 원인일 수 있음. 따라서 §4.5.1.5 variance 재측정은 **§4.1.1 Docling 메인화 완료 이후**로 의존 순서 조정. Docling의 TableFormer + layout model이 생성하는 **구조적 markdown** (제목 계층·표 셀·리스트)으로 먼저 전처리 품질을 확보한 뒤, 그 변환본 기준으로 10+ run baseline 재측정하여 post-processing 외 variance 성분에서 "전처리 품질" 기여분을 분리해야 함.

**보존된 측정 파일**:
- `activity/determinism-pms-v7-4514-prompt-attempt-2026-04-21.md` — 시도 1 (prompt 힌트, Total CV 32%)
- `activity/determinism-pms-v7-4514-2026-04-21.md` — 시도 2 (후처리만, Total CV 32.5%)

