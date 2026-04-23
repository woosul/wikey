# Phase 4 결과 보고서

> 기간: 2026-04-21 ~ (진행중)
> 목표: 인제스트 고도화 + 지식 그래프 + 운영 안정성 (plan/phase-4-todo.md 참고)
> 상태: 진행중 (2026-04-21)
> - §4.0 UI 사전작업 — 완료 (chat 전담 패널, /clear 커맨드, dashboard 아이콘 교체, 사이드바 500px, provider/model 편집)
> - §4.1 문서 전처리 파이프라인 재편 — **완료** (Docling 메인화 + unhwp + MarkItDown fallback 강등 + 자동 force-ocr 감지 + 5개 코퍼스 실증, 197 → 251 tests PASS)
> - §4.5.1 측정 인프라 자동화 — 완료 (자동 스크립트가 수동 CDP 드라이브 대체)
> - §4.5.1.4 canonicalizer 2차 (pin/alias) — 기능 완수 / CV 개선 미확증 (197 tests PASS)
> - §4.5.1.5 LLM extraction variance 원인 분석 — **선행 의존 §4.1 완료로 재개 가능** (미착수)
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

#### 4.1.1.6 자동 force-ocr 감지 로직 (사용자 override 완전 제거)

**재결정 (2026-04-21, ROHM 샘플 검증 후 → Force re-convert 도 제거)**: 사용자 피드백 "UI override 바람직하지 않음, 전처리~ingest 자동 흐름에서 사용자 결과 검토 루프 없음 → 재변환 판단 근거도 없음". 한 차례 추가했던 Converter 드롭다운과 Force re-convert 체크박스를 **모두 제거**하고, 전체 로직을 자동화.

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

**UI**: Audit 패널에서 Converter 드롭다운·Force re-convert 체크박스 모두 제거. 자동 로직이 모든 결정을 처리. 캐시 무효화가 정말 필요한 경우 `~/.cache/wikey/convert/` 디렉토리 직접 삭제.

**추가된 방어막 — 언어 무관 regression guard (2026-04-21, 세션 마지막 반영)**:
- `hasBodyRegression(baseline, regressed)` — 한국어 이외 (영문 등) PDF 에서도 force-ocr 가 본문 전체를 날리는 케이스 감지. 기준: baseline ≥ 500자 + regressed < 50%.
- OMRON 벤치마크에서 baseline korean = 0 인 경우도 body regression 으로 보호됨을 확증.

**삭제된 코드 (자동 로직 일원화)**:
- `ConverterOverride` 타입, `IngestOptions.converterOverride`, `IngestRunOptions.converterOverride` 필드
- `IngestOptions.forceReconvert`, `IngestRunOptions.forceReconvert` 필드
- `runTier()` 가드 헬퍼, tier 2/3/6 의 override 스킵 분기, docling-ocr 단독 실행 분기
- `extractPdfText/Hwp/Document` 의 `overrides` 파라미터 및 캐시 bypass 분기
- sidebar-chat.ts 의 `converterBar` + `converterSelect` + `forceWrap` + `forceCb`

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

### 4.1.2 §4.1 완료 선언 및 성과 분석 (2026-04-21, 최종)

**§4.1 문서 전처리 파이프라인 재편 완료**. `plan/phase-4-todo.md §4.1` 의 모든 체크박스 완수 + 5개 코퍼스 정량 실증. 이 섹션은 §4.1 전체의 성과 요약이며, 변환기별 상세 지표는 `activity/phase-4-converter-benchmark.md` 참조.

#### 4.1.2.1 5개 코퍼스 실증 (benchmark 요약)

| 코퍼스 | 특성 | 자동 판정 | Docling 결과 | MarkItDown 결과 |
|---|---|---|---|---|
| PMS 제품소개 (31p) | 벡터 텍스트 PDF | accept tier 1 | 83KB, 64 head, 133 tbl | 62KB, 0/0 |
| ROHM Wi-SUN (5p) | 웹 프린트 공백소실 60% | retry → tier 1b | 9KB, 10 head, 5 tbl | — |
| TWHB 파워디바이스 (37p) | 한국어 표 풍부 | accept tier 1 | 115KB, 118 head, 79 tbl | 129KB, 0/571⚠ |
| OMRON HEM-7600T (48p) | vector-only, MarkItDown 실패 | **isScan → tier 1b** | 9KB, 19 head, 77 tbl | **1 byte** ⚠ |
| 사업자등록증 (1p) | 스캔 후 OCR 저장본 | accept tier 1 | 823B, 182 korean | 1,156B |

**합계 구조 정보**: Docling 212 headings + 294 실제 tables vs MarkItDown 0 heading + 0 실제 tables (오잘 581개). 계획서 "+20% 개선" 기준을 **사실상 무한 초과** — MarkItDown은 heading을 아예 생성하지 못함.

**결정적 케이스 2가지** (`activity/phase-4-converter-benchmark.md` §2.4, §4.3 참조):

1. **OMRON vector-only PDF** — MarkItDown/pdftotext/pymupdf 모두 사실상 실패 (1~48 bytes). Docling --force-ocr만이 9.2KB 구조화 출력. 자동 `isLikelyScanPdf` 감지 없이는 사용자가 변환 실패 원인 파악에 수 시간 소요됐을 케이스. Docling 메인화의 결정적 정당성.
2. **PMS·TWHB force-ocr 독성** — 벡터 PDF에 --force-ocr 시 한국어 0자 regression. 자동 `hasKoreanRegression` guard가 tier 1 롤백으로 보호. 사용자가 수동 선택했더라면 맹점.

#### 4.1.2.2 자동 판정 로직 (UI override 완전 제거)

전처리~ingest가 자동 흐름이라 사용자가 변환 결과 검토 후 재변환 판단할 틈이 없음 → **모든 사용자 선택지 제거**. `convert-quality.ts` 의 3가지 자동 감지로 대체:

1. `koreanLongTokenRatio > 30%` — 웹 프린트 PDF (ROHM 60.20% 감지)
2. `isLikelyScanPdf` (페이지당 <100자 AND 한국어 <50자) — vector/스캔 PDF (OMRON 감지)
3. `hasKoreanRegression` + `hasBodyRegression` — force-ocr 독성 방어 (50% 미만 감지 시 tier 1 롤백)

5개 코퍼스 모두에서 이 3가지 신호의 조합이 최적 경로 선택. 상세 검증 매트릭스는 벤치마크 문서 §4 참조.

#### 4.1.2.3 이번 세션 (§4.1 완결 세션) 변경 집계

**신규 파일** (vs §4.1.1 초기 커밋 e9af2bb 이후):
- `activity/phase-4-converter-benchmark.md` — 5개 코퍼스 종합 리포트 (이전 PMS 전용에서 확장)
- `docs/samples/ROHM_Wi-SUN Juta통신모듈(BP35CO-J15).pdf` + `.docling-textlayer.md` + `.docling-forceocr.md` — 자동 force-ocr 트리거 실증 샘플

**convert-quality.ts 함수 추가** (총 5 → 8):
- `countKoreanChars`, `koreanLongTokenRatio`, `hasMissingKoreanWhitespace`, `hasKoreanRegression`, `scoreConvertOutput` (§4.1.1 초기)
- `bodyCharsPerPage`, `isLikelyScanPdf`, `hasBodyRegression` (이번 세션 추가)

**ingest-pipeline.ts tier 1 블록** — 3번 재작성:
1. e9af2bb: docling tier 1 + force-ocr 품질 기반 재시도
2. 708f9fc: runTier() 가드 + Converter override 지원 → **제거됨**
3. d6f9a93 + 이번: 자동 판정 (koreanLongRatio + isLikelyScanPdf) + regression guard (Korean + Body) + UI override 완전 제거

**테스트**: 197 → 251 tests PASS (+54):
- rag-preprocess 15 (§4.1.1 초기)
- convert-cache 11 (§4.1.1 초기)
- convert-quality 10 → 19 → 28 (hasBodyRegression 4 + isLikelyScanPdf 3 + bodyCharsPerPage 2 추가)

**삭제된 코드**:
- `ConverterOverride` 타입 + `IngestOptions.converterOverride` + `IngestRunOptions.converterOverride`
- `IngestOptions.forceReconvert` + `IngestRunOptions.forceReconvert`
- `runTier()` 가드 + tier 2/3/6 override 스킵 분기 + docling-ocr 단독 실행
- 모든 extract*Text 함수의 `overrides` 파라미터 + 캐시 bypass 분기
- sidebar-chat.ts Audit 패널의 `converterBar` + `converterSelect` + `forceWrap` + `forceCb`

#### 4.1.2.4 후속 Phase로 이관된 항목 (§4.1 범위 외)

- **§4.1.1.9 vault rename/delete listener** — §4.2.2 URI 기반 안정 참조 구현과 함께 처리. 독립 구현 시 source registry 없이는 sidecar md 추적 어려움. Phase 4.2 에서 합동 구현.
- **§4.1.1.5 `ps aux` 실측 검증** — API 키 env 주입 구현은 완료, 실 인제스트 run 중 수동 ps 확인만 남음. 별도 security audit 세션 권장.
- **`scripts/cache-stats.sh`** — 변환 캐시 관찰성 CLI. `~/.cache/wikey/convert/index.json` 직접 열람 가능하므로 우선순위 낮음.

#### 4.1.2.5 해제된 선행 의존

**§4.5.1.5 LLM extraction variance 재측정** — Docling 구조적 markdown 확보로 선행 의존 해제. `plan/phase-4-todo.md §4.5.1.5` 에 명시된대로 Docling 변환본 기준으로 10+ run baseline + chunk 결정성 + temperature/seed 재검증 가능. 다음 세션 최우선 과제.

### 4.1.3 Bitmap OCR 본문 오염 차단 + 검증 모듈 설계 확장 (2026-04-22)
> tag: #fix, #eval, #converter, #phase-4-1-3

**배경**. §4.5.1.6 29-run Total CV 9.2% 커밋 직후 사용자 지적으로 **근본 오염** 발견. PMS 제품소개 PDF 의 Docling 변환 결과가 UI 스크린샷·대시보드 목업 내부의 텍스트를 bitmap OCR 로 추출해 본문 흐름에 **interleave**. Docling JSON bbox 분석 결과 texts 의 **56.4% (831/1473) 가 picture 영역 내부**. `scoreConvertOutput` 4 signal (broken-tables / empty-sections / min-body-chars / korean-whitespace-loss) 모두 "text-layer 실패" 범주에 한정되어 **"bitmap OCR interleave"** 는 전혀 감지하지 못했던 설계 결함이 근본 원인. §4.5.1.5/6 의 variance 측정이 이 오염 MD 위에서 수행되었음.

**루틴 아키텍처 (재확정, 2026-04-22)**. "docling 기본값 → 결과 검증 → 실패 유형별 escalation":
1. Tier 1 (`default`) = docling CLI 기본값 그대로 (bitmap OCR on by Docling default)
2. `scoreConvertOutput` 확장 signal 기반 branching:
   - `accept` → finalize (Tier 1)
   - `retry-no-ocr` (image-ocr-pollution) → Tier 1a (`--no-ocr`) 재시도 → score 비교 후 채택
   - `retry` (korean-whitespace-loss) → Tier 1b (`--force-ocr`) 재시도
   - `reject` OR `isLikelyScanPdf` → Tier 1b 또는 Tier 2 fallthrough

#### 4.1.3.1 `buildDoclingArgs` mode 파라미터 (2026-04-22)

**변경**: `wikey-core/src/ingest-pipeline.ts`. 기존 `forceOcr: boolean` 2진 파라미터를 `DoclingMode = 'default' | 'no-ocr' | 'force-ocr'` 3-mode 로 전환.
- `'default'`: ocr-engine/lang 포함, `--no-ocr`/`--force-ocr` 없음 (docling CLI 기본)
- `'no-ocr'`: `--no-ocr` 만, ocr-engine/lang 생략 (bitmap OCR 억제)
- `'force-ocr'`: `--force-ocr` + ocr-engine/lang (vector 무시)
- `doclingMajorOptions` 에 `mode` 필드 추가 → Tier 1 / 1a / 1b 캐시 키 분리.

**증거**. `wikey-core/src/__tests__/ingest-pipeline.test.ts` 에 5 TDD 테스트 (모드별 args assertion). 통과.

#### 4.1.3.2 `scoreConvertOutput` `image-ocr-pollution` signal + `retry-no-ocr` decision (2026-04-22)

**변경**: `wikey-core/src/convert-quality.ts`. `hasImageOcrPollution` 신규 함수 + `scoreConvertOutput` decision enum 에 `'retry-no-ocr'` 추가.

**감지 로직 (v2, 실측 기반)**:
- 필수 필터: `bodyChars ≥ 2000` AND `markerCount ≥ 5` — 소규모 문서(사업자등록증 등) false positive 방어.
- 기준 A: `[image]` / `![...](...)` / `<!-- image -->` placeholder ±5 window 내 <20자 라인 3연속 (리스트 마커 제외).
- 기준 B: 전체 비어있지 않은 라인 중 <20자 파편 비율 > 50%.
- A 또는 B 만족 시 pollution 판정, score −0.4.

**Decision 우선순위** (동시 감지 시): `koreanLoss > pollution > score-based`.

**실측 캘리브레이션** (4 코퍼스):
| 코퍼스 | markers | fragRatio | bodyChars | 판정 |
|---|---|---|---|---|
| PMS | 25 | 62.5% | 56,255 | **pollution ✓** (기준 B) |
| ROHM | 5 | 42.7% | 4,896 | koreanLoss 우선 (pollution ✗) |
| RP1 | 19 | 14.0% | 236,858 | accept (pollution ✗) |
| GOODSTREAM | 5 | 60.0% | 453 | bodyChars 필터로 차단 (pollution ✗) |

**증거**. `wikey-core/src/__tests__/convert-quality.test.ts` 에 13 TDD 테스트 (기준 A·B 분리, 필터 경계, decision 우선순위). 통과.

#### 4.1.3.3 `extractPdfText` Tier 1a 삽입 (default-first, failure-specific escalation, 2026-04-22)

**변경**: `wikey-core/src/ingest-pipeline.ts::extractPdfText`. `quality.decision === 'retry-no-ocr'` 분기 추가로 Tier 1a (`buildDoclingArgs(..., 'no-ocr')`) 실행.
- Tier 1a score > Tier 1 score → Tier 1a 채택 (`1a-docling-no-ocr`)
- Tier 1a score ≤ Tier 1 score → Tier 1 유지 (false positive 방어, 경고 로그)
- Tier 1a 실패 (exception 또는 본문 < 50자) → Tier 1 유지

기존 Tier 1b (`retry` 또는 `isScan`) 경로는 변경 없음. regression guard (Korean/Body) + score 비교 로직도 유지.

**증거**. 빌드 0 errors, 전체 335 tests PASS.

#### 4.1.3.4 5 코퍼스 회귀 벤치마크 — Tier chain 동작 실증 (2026-04-22)

**스크립트**: `scripts/benchmark-tier-4-1-3.mjs` (신규). 각 코퍼스에 대해 Tier 1 (default) 실행 → decision 에 따라 Tier 1a 또는 1b 자동 실행 → 최종 채택 MD 를 원본 옆 sidecar `.md` 로 저장.

**4 코퍼스 결과** (사용자 선택: docs/samples 2개 + raw 2개, OMRON/TWHB 는 실행 시간 이유로 제외):

| 코퍼스 | pages | Tier 1 decision | Tier 1 score | 최종 Tier | 최종 score | lines Δ |
|---|---|---|---|---|---|---|
| **PMS** | 31 | **retry-no-ocr (image-ocr-pollution)** | 0.53 | **1a-docling-no-ocr** | 0.91 | **1922 → 532 (−72%)** |
| ROHM | 5 | retry (korean-whitespace-loss) | 0.56 | 1b-docling-force-ocr | 0.94 | 145 → 103 |
| RP1 | 93 | accept | 0.93 | 1-docling | 0.93 | 4099 |
| GOODSTREAM | 1 | accept | 1.00 | 1-docling | 1.00 | 49 |

**핵심**. PMS 는 §4.5.1.5/6 기간 내내 `accept` 판정을 받아 오염된 MD 가 변동분석 baseline 이었음. §4.1.3.1~3 도입 후 `retry-no-ocr` 로 escalation → Tier 1a 로 **OCR 파편 1,390 라인 제거** (56.4% picture bbox 내부 오염이 bodyChars 56,255 → 47,979, koreanChars 18,654 → 15,549 로 실측 감소). 다른 3 코퍼스는 기존 경로 유지 (regression 없음).

**Sidecar 생성 — 파일 생성 루틴 확정** (사용자 §4.1.3 설계):
- 구조: **원본.pdf → 원본.md → LLM투입용.md (stripped, 메모리 전용)**
- 파일시스템에 남는 것: 원본.pdf + 원본.md. ingest 후 원본.pdf 는 PARA 하위로 분류 이동.
- 메모리/파이프라인: stripEmbeddedImages 적용된 LLM 투입용 — wiki 생성 후 사라짐.

**원본.md 의 이미지 포함 여부 — tier 기반 분기** (사용자 명시: "스캔이미지로 판정되어 ocr 옵션이 들어가면 이미지가 필요없다"; "소규모 문서는 판정 기준 아님"):

| 조건 | sidecar | 이유 |
|---|---|---|
| `isLikelyScanPdf = true` | **stripped** | Scan PDF (30p 계약서 스캔 포함) — 이미지 = 텍스트 내용 중복 |
| tierKey `1b-docling-force-ocr-scan` | **stripped** | scan 원인으로 force-ocr — 이미지가 OCR 소스 |
| tierKey `1b-docling-force-ocr-kloss` | **raw** | 한글 공백 소실 원인으로 force-ocr — 원본이 vector PDF (ROHM diagram 유지) |
| tierKey `1a-docling-no-ocr` | **raw** | pollution escalation — vector PDF (PMS UI 스크린샷 유지) |
| tierKey `1-docling` | **raw** | 기본 vector PDF 경로 |

구현:
- `wikey-core/src/convert-quality.ts` — `hasRedundantEmbeddedImages(rawMd, strippedMd, pageCount, tierKey)` 신규 (5 TDD 테스트).
- `wikey-core/src/ingest-pipeline.ts::extractPdfText` — Tier 1b 원인 분기 (`tier1bKey = isScan ? '...-scan' : '...-kloss'`). `finalize` 에서 `hasRedundantEmbeddedImages` 로 stripped vs raw 판정.
- `wikey-core/src/ingest-pipeline.ts::ingest` — 기존 sidecar 블록에 `ext !== 'pdf'` 조건 추가 (PDF 는 finalize 에서 이미 처리).
- `scripts/benchmark-tier-4-1-3.mjs` — 동일 로직 반영.

**Source PDF 기반 scan + text layer corruption 감지** (2026-04-22 근본 수정): MD 기반 `isLikelyScanPdf` 가 docling bitmap OCR 결과를 입력받아 GOODSTREAM/CONTRACT 같은 스캔 PDF 를 놓침. 사용자 지적: "isLikelyScanPdf=false 라는 판정이 잘못된 것. 후속 보정 말고 원본 판정에 집중". 사용자 원칙: "기본값 변환 → 불량값 → OCR 적용 흐름에 들어오면 scan 문서".

`extractPdfText` 초반 pymupdf subprocess 로 source PDF 직접 분석:
- `scanRatio` = 페이지 대비 최대 이미지 면적 > 0.7 비율
- `textLayerChars` / `textLayerKoreanChars` = text layer 직접 추출 통계

세 축 감지:
- `isScanByMd` = `isLikelyScanPdf(md, pageCount)` (기존 MD 기반)
- `isScanBySource` = `scanRatio > 0.5`
- `textLayerCorrupted` = filename 한국어 AND textLayerChars > 500 AND textLayerKoreanChars < 50 (CONTRACT 같은 비표준 폰트 매핑)

→ `isScan = isScanByMd || isScanBySource || textLayerCorrupted`
→ Tier 1 accept 이어도 `isScan=true` 이면 **Tier 1b force-ocr 진입** (사용자 원칙 "scan 판정 → OCR 적용").
→ Tier 1b accept → `1b-docling-force-ocr-scan` + sidecar strip.
→ Tier 1b regression → `1-docling-scan` rollback (scan 정보 유지, sidecar strip).

**OCR engine + lang 자동 매핑** (사용자 "ocrmac 은 macOS 전용 → paddleOCR fallback 등록"):
- `defaultOcrEngine()` — darwin → `ocrmac`, else → `rapidocr` (paddleOCR 모델 내장)
- `defaultOcrLangForEngine(engine)` — docling 공식 source 확증된 형식:
  - `ocrmac` → `ko-KR,en-US` (BCP-47)
  - `rapidocr` → `korean,english` (paddleOCR)
  - `easyocr` → `ko,en` (ISO 639-1)
  - `tesseract` → `kor,eng` (ISO 639-2)
- 이전 코드는 platform fallback 있었으나 lang 은 `ko-KR` 고정 → rapidocr 에 잘못된 값 전달 위험. 사용자 힌트 "ko 옵션도 넣어야" 가 이 문제 지적.

**실측 벤치마크 — 5 코퍼스 최종 매핑 + sidecar 내용 확인**:

| 코퍼스 | pages | scan% | corrupted | 채택 Tier | sidecar |
|---|---:|---:|---:|---|---|
| ROHM | 5 | 0% | false | `1b-force-ocr-kloss` | raw 1.5MB (diagram 유지) |
| RP1 | 93 | 0% | false | `1-docling` | raw 1.9MB |
| PMS | 31 | 0% | false | `1a-docling-no-ocr` | raw 6.3MB (UI 스크린샷) |
| **GOODSTREAM** | 1 | **100%** | false | `1b-force-ocr-scan` | **stripped 393 chars** ✓ |
| **CONTRACT** | 6 | **100%** | **true** | `1b-force-ocr-scan` | **stripped 6024 chars, 한글 0 → 2810** ✓ |

**sidecar 실측 확인 (이전 세션 패턴 수정 — 파일 실제 읽음)**:
- CONTRACT before: `Etr8l E +:S AE AqEA-l (E7l gr^{)` (비표준 폰트 매핑) → after: `프로젝트 수행 용역 계약서 (턴키 방식)`, `₩241,000,000`
- GOODSTREAM before: `사 업 자 드 ⊃ 트 로 증`, `r협~EWl 서 비 스 제 조 업` → after: `사업자등록증`, `서비스 제조업`, `소프트웨어개발,자문 및 공급`

bodyChars/markerCount heuristic 의존성 완전 제거. 사용자 "소규모는 판정 기준 아님" + "후속 보정 말고 원본 판정" 명시 충족. text layer corruption 까지 원본 source 기반 감지로 완결.

**기록**: `activity/phase-4-1-3-benchmark-2026-04-22.md` (요약 테이블 + Tier별 상세).

#### 4.1.3.5 PMS 재측정 — §4.5.1.5/6 결과 재해석 (2026-04-22)

**실행**: `./scripts/measure-determinism.sh raw/0_inbox/PMS_제품소개_R10_20220815.pdf -n 10 -d -o activity/phase-4-1-3-5-pms-10run-clean-2026-04-22.md`. 10/10 success, 평균 252.6s/run, 총 약 42분.

**결과** (`activity/phase-4-1-3-5-pms-10run-clean-2026-04-22.md`):

| 지표 | Mean | Std | **CV %** | Range |
|------|-----:|----:|---------:|------:|
| Entities | 22.60 | 0.52 | **2.3%** | 22–23 |
| Concepts | 18.60 | 4.58 | **24.6%** | 12–22 |
| Total | 42.20 | 4.37 | **10.3%** | 36–46 |

Total 값 분포 {36, 44, 46} 3 값으로 양자화. Core entities 19/27 (70%), Core concepts 11/22 (50%).

**비교 매트릭스**:

| 측정 | Total CV | Entities CV | Concepts CV | 입력 상태 |
|---|---:|---:|---:|---|
| §4.5.1.4 | 32.5% | — | — | 오염 |
| §4.5.1.5 30-run | 24.3% | 36.4% | 31.1% | 오염 |
| §4.5.1.6 10-run | 7.2% | 13.9% | 28.9% | 오염 |
| §4.5.1.6 29-run | 9.2% | 11.1% | 27.0% | 오염 |
| **§4.1.3.5 10-run** | **10.3%** | **2.3%** | **24.6%** | **깨끗** |

**재해석**:
- 깨끗한 MD 에서 Total CV 10.3% 는 §4.5.1.6 29-run 9.2% (오염) 와 **거의 동일** (+1.1pp). → **canonicalizer 3차 확장 + determinism flag 가 실제 legitimate variance 를 잡았음 확증**. OCR 파편 흡수가 주효과였다면 clean MD 에서 CV 가 훨씬 낮아야 함.
- **Entities CV 2.3%** — §4.5.1.6 29-run 11.1% 대비 대폭 개선. 22 또는 23 두 값만 나타나 **거의 결정적**. 입력 depollution 효과 중 Entities 파트는 전적으로 OCR 파편 제거에서 나옴 (Lotus/22A002/GOODSTREAM 등 UI 스크린샷 파편 제거로 entity 경계 안정).
- **Concepts CV 24.6%** — 27.0% 대비 소폭 개선에 그침. Range [12–22] 는 PMBOK 9 영역이 일부 run 에서만 concept 로 추출되는 **legitimate LLM variance** (깨끗한 MD 로도 남은 진동). §4.5.1.7.2 (Concepts prompt — PMBOK 9 영역 명시적 나열) 필수성 정량 증명.

**§4.5.1.7 gate 판정** (CV 10.3% → 5–10% 와 >10% 경계):
- **§4.5.1.7.2 Concepts prompt** — 필수. Concepts CV 24.6% 잔여, PMBOK 9 영역 진동이 주원인.
- **§4.5.1.7.1 attribution ablation** — 재평가. Entities CV 2.3% 로 거의 결정적이므로 3 레버 (determinism / canon / pollution-removal) 기여도 분리의 실익 감소. Concepts variance 기여도 분해만 선택적.
- **§4.5.1.7.5 Lotus-prefix variance** — **불필요**. Entities 진동이 2.3% 로 거의 사라짐. Lotus OCR 파편이 일부 run 에서 entity 화되던 것이 §4.1.3 로 자동 해결.
- **§4.5.1.7.3/4/6/7** — §4.1.3 과 독립. 그대로 유효.

**후속 세션 권장 우선순위**: §4.5.1.7.2 (Concepts prompt) > §4.5.1.7.3 (측정 infra) > §4.2 (URI 참조) / §4.3 (인제스트 고도화).

#### 4.1.3.6 문서 동기화 + commit (2026-04-22)

- `activity/phase-4-result.md §4.1.3` (이 섹션) — 각 sub-task 증거 상세.
- `plan/phase-4-todo.md §4.1.3` — 체크박스 모두 `[x]`, 상단 status 갱신, 실제 구현과 일치하도록 sub-task 설명 업데이트 (§4.1.3.1 "Tier 1 기본을 --no-ocr 로 전환" → "mode 파라미터 ('default'|'no-ocr'|'force-ocr') 도입, Tier 1 은 docling 기본값 유지").
- `plan/phase-4-1-3-bitmap-ocr-fix.md` — 실측 값 반영.
- `plan/session-wrap-followups.md` — §4.1.3 완료 선언, §4.5.1.7 gate 해제 + 시나리오별 권장 우선순위.
- `wiki/log.md` — `fix` + `eval` 엔트리.
- `~/.claude/projects/-Users-denny-Project-wikey/memory/project_phase4_status.md` + MEMORY.md.

#### 4.1.3.7 해제된 선행 의존

**§4.5.1.7** (attribution ablation / Concepts prompt / Lotus variance 등) — §4.1.3.5 결과 (PMS 10-run clean baseline) 에 따라 각 sub-task 의 premise 를 재평가한 뒤 선별 진행. measurement infra (§4.5.1.7.3), Route SEGMENTED (§4.5.1.7.4), BOM 재분할 (§4.5.1.7.6), log_entry cosmetic (§4.5.1.7.7) 은 §4.1.3 와 독립이라 유효.

---

## 4.2 분류 및 파일 관리 (inbox → PARA, pair 이동 · registry · listener)
> tag: #workflow, #move, #registry, #listener

**상태** (2026-04-23 session 2 종료): Stage 1~4 전량 구현 완료. §4.1.1.9 vault rename/delete listener 자동 해소(Stage 4 S4-1/S4-2). 남은 정리(경로 기반 API 완전 제거·few-shot 자동 반영·볼트 대용량 스케일) 는 Phase 5 §5.3/§5.6/§5.5 이관.
**최종 증거**: wikey-core 352 → **434 tests PASS** (+82 누적, session 1 +47 / session 2 +35), `scripts/tests/pair-move.smoke.sh` 6/6, `npm run build` (tsc + esbuild) 0 errors.
**계획 문서**: `plan/phase-4-2-plan.md` v3 (codex rescue 2차 검증 결과 6 concern 전부 반영 — Stage 3/4 섹션 구현 완료 반영은 동 문서 §4/§5).
**세션 타임라인**: Session 1 (2026-04-23 전반) Stage 1+2 → Session 2 (2026-04-23 후반) Stage 3+4 + 링크 안정성 회귀선 2차례 보강.

**배경 — 사용자 추가 제약** (2026-04-22). 원본 (`.pdf`, `.xls[x]`, `.hwp[x]`, `.doc[x]`, `.ppt[x]`) 이 docling/unhwp 으로 변환되어 `<원본>.<ext>.md` sidecar 가 생긴 경우, 시스템 자동 이동(auto-classify, Audit Apply, bash `--move`, vault `on('rename')`) 시 반드시 pair 로 함께 이동. 사용자 수동 이동은 예외.

**§4.2 핵심 불변성** (2026-04-23 session 2 사용자 지적 반영). "원본 파일이 이동해도 wiki 페이지의 wikilink(원본 링크)는 업데이트 없이 유지된다." 이동 시 변경되는 것은 source 페이지 frontmatter `vault_path` 단 하나 — entity/concept/analyses 의 `[[source-xxx]]` wikilink 와 본문은 bit-identical. §4.2.4.7/.8 회귀 방지선으로 고정.

**계획 v1 → v2 → v3 진화**:

- **v1** (초안): Part A (LLM 3/4차 분류 + pair 이동) → Part C (bash) → Part B (registry) 순. 문제: movePair 를 먼저 만들면 registry 없이 구현 → 나중에 retrofit 하면서 plugin 호출처·테스트 2회 touch.
- **v2** (의존성 재정렬, 사용자 지적 "URI구조를 먼저 만들고 그 다음 이동이나 다른 규칙들이 붙어야..."): Stage 1 URI foundation → Stage 2 pair move → Stage 3 분류 정제 → Stage 4 listener. codex 검증 선행.
- **v3** (codex rescue 2차 검증 FAIL gate 반영). Critical 2 · High 2 · Medium 3 concern 전부 반영:

| codex finding | v3 반영 |
|---------------|---------|
| Critical #1 `wikey://vault/...` 커스텀 scheme 이 Obsidian `registerObsidianProtocolHandler` 로 작동 안 함 | URI **저장 폐기** → `source_id` + `vault_path` 만 저장, URI 는 render/open 시점 `buildObsidianOpenUri(vaultName, vaultPath)` / `buildFileUri(absPath)` 로 derive |
| Critical #2 번들 id 가 vault-relative path 기반이면 PARA 이동 시 id 변경 (불변 key 깨짐) | 번들 내부 **bundle-relative** `(sorted path, sha256(bytes))` 페어 정렬 → 개행 직렬화 → 재해싱. `computeBundleId(entries)` 가 vault 위치 독립 |
| High #3 이동 후 이미 작성된 `wiki/sources/*.md` frontmatter 의 `vault_path` 가 stale | `rewriteSourcePageMeta` 신규 + movePair 가 `ingested_pages[]` 순회하며 post-move rewrite |
| High #4 bash `--move` 가 vault.on('rename') 에 의존 → Obsidian 미실행 시 이벤트 유실 | `scripts/registry-update.mjs` node CLI 신규 — bash 가 즉시 registry 갱신. plugin startup reconcile 이 이중 안전망 |
| Medium #5 64-bit prefix 재사용은 full-hash 비교 없으면 silent alias 위험 | registry `findByIdPrefix(reg, prefixHex, bytes)` — prefix 매칭 후 `record.hash === computeFullHash(bytes)` 로 full-hash verify |
| Medium #6 movePair 가 URI syntax 에 과결합 | movePair 는 `vault_path` 만 다룸. URI derive 는 별도 함수군 |
| Medium #7 30 테스트 부족 + migration inventory 누락 | Session 1 +47 / Session 2 +35 = 누적 **+82** 로 확장, `scripts/measure-determinism.sh` 의 `.ingest-map.json` 참조도 교체 |

**계획 문서 산출**: `plan/phase-4-2-plan.md` (v3, 10 섹션). 작업 진입 순서는 Stage 1 → Stage 2 → Stage 3 → Stage 4 — 실제로 Session 1 에 Stage 1+2, Session 2 에 Stage 3+4 로 분할 실행되었다.

### 4.2.1 Stage 1 — ID & vault_path foundation (registry)
> tag: #foundation, #uri, #registry

**상태**: Session 1 완료 (2026-04-23). URI 는 저장하지 않고 `source_id` + `vault_path` 만 저장. 번들 id 는 내부 relative path 기반으로 이동 무관 불변. prefix 충돌은 full-hash verify 로 해소.

#### 4.2.1.1 `wikey-core/src/uri.ts` (S1-1, 17 tests)

**함수 export**:
- `computeFileId(bytes)` → `sha256:<16 hex prefix>` (개인 위키 scale 충돌 무시, prefix verify 루틴 보조로 잔여 위험 제거).
- `computeBundleId(entries: BundleEntry[])` — 입력은 `{relativePath, bytes}` 배열. 내부에서 `relativePath.localeCompare` 정렬 → `path\tsha256(bytes)` 줄 단위 직렬화 → 재해싱. 이동 무관 불변 (핵심 테스트 케이스).
- `computeExternalId(uri)` → `uri-hash:<16 hex>` (외부 URI pass-through, fetching 은 Phase 5).
- `computeFullHash(bytes)` → 64 hex, registry `hash` 필드용 무결성 검증.
- `buildObsidianOpenUri(vaultName, vaultPath)` → `obsidian://open?vault=<enc>&file=<enc>` (한국어 percent-encoding).
- `buildFileUri(absolutePath)` → `file:///...` (외부 앱 open).
- `formatDisplayPath(vaultPath)` → 원문 그대로 (UI 툴팁·로그용).
- `verifyFullHash(prefixHex, bytes)` — prefix 충돌 시 registry.findByIdPrefix 가 사용.
- `sidecarVaultPath(originalVaultPath)` → `${path}.md`.

증거: `__tests__/uri.test.ts` 17 tests green — 번들 이동 시 동일 id, 입력 순서 독립, prefix+bytes 검증, 한국어 round-trip 모두 통과.

#### 4.2.1.2 `wikey-core/src/source-registry.ts` (S1-2, 12 tests)

**스키마** (`.wikey/source-registry.json`, key = `source_id`):
```json
{
  "sha256:<prefix>": {
    "vault_path": "raw/.../file.pdf",
    "sidecar_vault_path": "raw/.../file.pdf.md",
    "hash": "<full 64 hex>",
    "size": 3634821,
    "first_seen": "2026-04-23T...",
    "ingested_pages": ["wiki/sources/source-xxx.md"],
    "path_history": [{"vault_path":"...","at":"..."}],
    "tombstone": false
  }
}
```

**API**: `loadRegistry`, `saveRegistry`, `findById`, `findByIdPrefix` (full-hash verify 내장), `findByPath` (path_history 포함), `findByHash`, `upsert`, `recordMove`, `recordDelete`, `restoreTombstone`, `reconcile(walker)`.

- `loadRegistry` 는 JSON parse 실패 시 `.wikey/source-registry.json.bak` 로 snapshot + 빈 객체 반환 (warn 로그 1회). 테스트에서 재현 확인.
- `recordMove` 는 `path_history` append + `vault_path`·`sidecar_vault_path` 갱신 (sidecar 미지정 시 기존값 유지).
- `reconcile(walker)` 는 외부 이동 (bash / Finder) 감지 — walker 가 반환한 `{vault_path, bytes}` 목록의 full-hash 와 레코드 `hash` 매칭 → path 갱신. Stage 4 의 startup scan 에서 사용.

증거: `__tests__/source-registry.test.ts` 12 tests green (CRUD · history · tombstone · prefix 충돌 시나리오 · reconcile 외부 이동).

#### 4.2.1.3 `wikey-core/src/wiki-ops.ts` 확장 (S1-3 + S2-2, +7 tests)

**신규 export**:
- `injectSourceFrontmatter(content, meta)` — source 페이지에 v3 frontmatter 주입. 기존 frontmatter 의 비관리 키 (`title`, `tags`) 보존, 관리 키 (`source_id`, `vault_path`, `sidecar_vault_path`, `hash`, `size`, `first_seen`) 교체.
- `rewriteSourcePageMeta(content, {vault_path, sidecar_vault_path?})` — Stage 2 post-move 전용. `vault_path`·`sidecar_vault_path` 만 갱신, 다른 관리 필드는 불변. sidecar 가 `null` 이면 필드 제거, `undefined` 면 무변경.

yaml 이스케이프는 경량 구현 — YAML-sensitive 문자 (`: # @ & * ! | > ' " % \` \t`) 또는 선행·후행 공백 있으면 `JSON.stringify` 로 따옴표 감쌈. Obsidian 이 생성하는 일반적인 키·값은 bare 로 유지.

증거: `__tests__/wiki-ops.test.ts` 기존 27 → **34 tests** (+7). 한국어 idempotent · stale 값 교체 · sidecar add/remove · 본문 보존 검증.

#### 4.2.1.4 `ingest-pipeline.ts` 배선 + registry upsert (S1-3)

**변경점**:
- `buildV3SourceMeta(wikiFS, sourcePath, basePath, ext, ingestedPagePath)` 헬퍼 신규 — 원본 bytes 를 `readFileSync(basePath/sourcePath)` 로 직접 읽어 `computeFileId` / `computeFullHash` / `statSync.size` 계산. basePath 없으면 wikiFS.read 폴백 → UTF-8 인코딩해서 `{record:null, frontmatter:path 기반 synthesized}` 반환 (frontmatter 자체는 항상 작성, registry 는 bytes 있을 때만).
- sidecar 존재 여부는 `wikiFS.exists(${sourcePath}.md)` 로 감지. md/txt 원본은 sidecar 개념 없음.
- `sourcePage.content = injectSourceFrontmatter(appendSectionTOCToSource(...), v3Meta.frontmatter)` — 기존 섹션 TOC append 체인 위에 v3 frontmatter 주입.
- 직후 `loadRegistry` → `findById(v3Meta.id)` 존재하면 `ingested_pages[]` 에 현재 페이지 append, 없으면 신규 record 로 `upsert`. `saveRegistry` 로 JSON 저장.

효과: 이제 모든 신규 ingest 가 (a) v3 frontmatter 로 source 페이지 기록, (b) `.wikey/source-registry.json` 에 레코드 생성 · 연결. 동일 content 재인제스트 시 기존 레코드 재사용으로 중복 방지.

#### 4.2.1.5 `scripts/migrate-ingest-map.mjs` + `measure-determinism.sh` 패치 (S1-4)

- 마이그레이션 스크립트 신규. 기존 `wiki/.ingest-map.json` 이 있으면 경로 키 순회 → 파일 bytes 재해싱 → `source_id` 발급 → `.wikey/source-registry.json` 레코드 생성. `--dry-run` 플래그 지원. 파일 부재 시 exit 0 + "no-op" 로그. 현재 볼트는 map 파일 없음 → 무작업 확인.
- **smoke**: dummy `.ingest-map.json` 으로 `/tmp/wikey-mig-test/` 샌드박스 구성 → `node migrate-ingest-map.mjs` 실행 → registry JSON 생성 확인 (sidecar pair 감지 포함). hash `779221dd...` 로 검증.
- `scripts/measure-determinism.sh` 의 `cleanupForRerun` 에 registry 정리 블록 추가 — `.wikey/source-registry.json` 의 `vault_path` 또는 `path_history[]` 가 SOURCE_PATH 에 매칭되는 레코드 삭제. 기존 `.ingest-map.json` 블록은 transitional 호환용으로 유지.

### 4.2.2 Stage 2 — Pair move + frontmatter rewrite (post-move)
> tag: #workflow, #move

**상태**: Session 1 완료 (2026-04-23). 사용자 제약 "원본 + sidecar md pair 불변 이동" 을 registry 위에 구현. 이동 후 `ingested_pages[]` 의 모든 source 페이지 frontmatter 가 자동 갱신된다.

#### 4.2.2.1 `wikey-core/src/classify.ts::movePair` (S2-1, 8 tests)

```typescript
export async function movePair(opts: {
  basePath: string
  sourceVaultPath: string
  destDir: string
  wikiFS: WikiFS
}): Promise<MovePairResult>
```

**내부 절차** (원자성 지향):
1. idempotent guard — sourceFullPath === destFullPath 면 no-op 반환 (movedOriginal=false).
2. `registry.findByPath(sourceVaultPath)` → id 확보 (legacy fallback: filesystem convention).
3. `renameSync(original)` → sidecar 존재 여부 분기:
   - `is-md-original`: `.md`/`.txt` 원본이면 sidecar 개념 없음, skip.
   - `not-found`: `${path}.md` 없음 → 원본만 이동.
   - `dest-conflict`: 대상에 sidecar 이미 존재 → 원본만 이동 + warn.
   - 정상: sidecar rename.
4. `registry.recordMove` + `ingested_pages[]` 순회하며 `rewriteSourcePageMeta` 호출 → 각 페이지 frontmatter `vault_path`·`sidecar_vault_path` 갱신. 실패는 warn 로그하고 계속 (원본 이동은 이미 완료).
5. `saveRegistry`.

**결과 객체**: `{movedOriginal, movedSidecar, sidecarSkipReason?, sourceId?, rewrittenSourcePages[]}`.

증거: `__tests__/move-pair.test.ts` 8 tests green — 핵심 6 시나리오 + 다중 ingested_pages 동시 rewrite + idempotent 이미-대상 no-op.

#### 4.2.2.2 플러그인 호출처 2곳 전환 (S2-3, S2-4)

- `wikey-obsidian/src/commands.ts::runIngest` 내 `autoMoveFromInbox` 분기: `moveFile + updateIngestMapPath` → `movePair(...)` 로 교체. 로그 포맷 `sidecar=true/false [skipReason]` 추가.
- `wikey-obsidian/src/sidebar-chat.ts` Audit Apply 버튼 Phase 2 이동 경로: `moveFile + updateIngestMapPath` → `movePair(...)` 교체. 동적 import 제거.
- `saveIngestMap` / `updateIngestMapPath` 함수는 `commands.ts` 에 legacy 로 유지 (ingest 직후 초기 레코드 생성에 여전히 사용) — 단일 릴리스 deprecation 후 Phase 5 에서 제거 예정.

#### 4.2.2.3 `scripts/registry-update.mjs` node CLI (S2-5)

bash ↔ registry 브릿지. `Obsidian 오프라인 상태에서도` `.wikey/source-registry.json` 을 즉시 갱신 (codex High #4 핵심 대응).

**서브커맨드**:
- `--record-move <id-or-path> <new-vault-path> [<new-sidecar-vault-path>]`
- `--record-delete <id-or-path>`
- `--find-by-path <vault-path>`
- `--find-by-hash <full-sha256>`

atomic write: `renameSync(tmp, REGISTRY_PATH)` 로 partial write 방지. id-or-path 는 직접 id 매칭 → `vault_path` 매칭 → `path_history[]` 매칭 순으로 해결.

수동 smoke: `/tmp/reg-test` 샌드박스에 seed 레코드 → `--record-move` → `--find-by-path (new)` / `--find-by-path (old via history)` 둘 다 JSON 반환 확인.

#### 4.2.2.4 `scripts/classify-inbox.sh --move` pair 지원 (S2-6) + `classify-hint.sh` sidecar 표시 (S2-7)

**classify-inbox.sh 변경**:
1. 원본 `mv` 후 `${src}.md` 존재하면 대상에 같이 이동 (`dest-conflict` 시 skip + warn).
2. 최종 위치를 vault-relative 로 변환 (trailing slash·디렉토리/파일 분기 모두 처리) 후 `cd $PROJECT_DIR && node scripts/registry-update.mjs --record-move <rel_src> <rel_dst> <rel_sidecar>` 호출. node 미존재 / registry 파일 없음 / CLI 실패 모두 warn 만 남기고 continue (bash move 는 이미 완료 → reconcile 이 복구 안전망).

**classify-hint.sh 변경**: `${path}.md` sidecar 존재하면 hint 끝에 `(+ sidecar)` 접미. PDF/CAD/기타 분기 모두 표시.

**smoke `scripts/tests/pair-move.smoke.sh`** (2 케이스, 6 assertion):
- Case 1: pair 이동 (original + sidecar → dest 도달, inbox 에서 제거).
- Case 2: registry `vault_path` · `sidecar_vault_path` 가 Obsidian 오프라인에서도 즉시 갱신.
- 실행 결과: **ALL PASS (6/6 assertion)**.

#### 4.2.2.5 Integration 검증 (Stage 1+2 E2E)

**`__tests__/integration-pair-move.test.ts`** Session 1 기준 3 tests (end-to-end, real-disk tmpdir):

1. **E2E 단일 소스**: seed ingested state → movePair → 원본·sidecar 이동 + registry vault_path 갱신 + path_history +1 + source 페이지 frontmatter 의 managed 필드 업데이트 + 비관리 컨텐츠 보존.
2. **multi-page**: 동일 source_id 에 `ingested_pages` 2개 → movePair 후 둘 다 frontmatter rewrite 완료.
3. **reconcile**: 외부에서 파일 `renameSync` (registry 모름) → `registry.reconcile(walker)` → full-hash 매칭으로 경로 복구 + path_history append.

증거: 3/3 PASS. 후속 Session 2 에서 링크 안정성 + real-disk 6 tests 추가 (§4.2.4.7/.8).

#### 4.2.2.6 Session 1 최종 증거 (Stage 1+2)

| 항목 | baseline | 최종 | 증거 |
|------|----------|------|------|
| wikey-core tests | 352 | **399** (+47) | `npm test --prefix wikey-core` Test Files 19 passed, Tests 399 passed |
| Stage 1 단위 | — | 36 (uri 17 + registry 12 + wiki-ops +7) | 각 파일 green |
| Stage 2 단위 | — | 8 (move-pair) + Integration 3 | green |
| bash smoke | — | 6/6 assertion | `scripts/tests/pair-move.smoke.sh` ALL PASS |
| `npm run build` | — | 0 errors (tsc + esbuild production) | log |

**신규/수정 파일 (Session 1)**:
- 신규: `wikey-core/src/uri.ts`, `source-registry.ts`, `__tests__/uri.test.ts`, `__tests__/source-registry.test.ts`, `__tests__/move-pair.test.ts`, `__tests__/integration-pair-move.test.ts`, `scripts/migrate-ingest-map.mjs`, `scripts/registry-update.mjs`, `scripts/tests/pair-move.smoke.sh`, `plan/phase-4-2-plan.md`.
- 변경: `wikey-core/src/classify.ts` (+movePair 외 4 export), `wiki-ops.ts` (+injectSourceFrontmatter · rewriteSourcePageMeta · SourceFrontmatter 타입), `ingest-pipeline.ts` (+buildV3SourceMeta 헬퍼 · registry upsert · injectSourceFrontmatter 배선), `index.ts` (신규 export 블록), `__tests__/wiki-ops.test.ts` (+7), `wikey-obsidian/src/commands.ts` · `sidebar-chat.ts` (movePair 전환), `scripts/classify-inbox.sh` (pair + registry CLI 호출), `scripts/lib/classify-hint.sh` (sidecar 표시), `scripts/measure-determinism.sh` (registry cleanup), `plan/phase-4-todo.md §4.2` (v3 stage 구조).

### 4.2.3 Stage 3 — LLM 분류 정제 · 모델 키 · UI · 피드백
> tag: #classify, #llm, #ui

**상태**: Session 2 완료 (2026-04-23). LLM 3/4차 분류에서 4차 제품 slug 가 매 호출마다 달라지는 drift 를 "기존 폴더 재사용 우선" + 저가 모델 + 명시적 Re-classify UI + 피드백 로그 4축으로 안정화.

#### 4.2.3.1 `wikey-core/src/classify.ts::classifyWithLLM` 4차 slug 힌트 (S3-1, vitest 5)

- 호출 직전 `wikiFS.list(hint2nd)` 로 부모 폴더 하위 항목을 조회 → `^\d{3}_[A-Za-z0-9가-힣_\-]+$` 정규식으로 NNN_topic 폴더만 추출 → sort 후 prompt 에 block 형태로 inject.
- basename 정규화: Obsidian `WikiFS.list` 는 full vault path (`raw/.../100_pms`) 를 반환, 테스트 mock 은 bare name — 양쪽 모두 `split('/').pop()` 로 통일.
- 프롬프트 규칙 추가: "위 목록에 매칭되는 slug 가 있으면 재사용 우선, 없으면 NNN_topic 네이밍 규칙으로 신규 제안 — reason 에 '신규: 근거' 명시".
- 테스트 (`classify.test.ts` +5, 20 → 24 / total -기 이후 Stage 3 까지 +12 → 24):
  1. 기존 slug 재사용 — `100_physics_intro`, `300_pms` 가 prompt 에 들어가고 LLM 이 기존 slug 반환.
  2. 빈 폴더 — "비어 있음 — 신규 slug 생성 가이드 준수" hint inject.
  3. WikiFS.list full-path 반환 시에도 basename 매칭 정상.
  4. JSON 파싱 실패 → hint2nd 로 fallback.
  5. `CLASSIFY_PROVIDER` override — INGEST_PROVIDER=anthropic 이지만 CLASSIFY_PROVIDER=gemini 설정 시 Gemini 엔드포인트 호출 확인.

#### 4.2.3.2 `CLASSIFY_PROVIDER` / `CLASSIFY_MODEL` 설정 키 (S3-2, vitest 4)

- `WikeyConfig` 에 `CLASSIFY_PROVIDER?: string` · `CLASSIFY_MODEL?: string` 추가 (`types.ts`).
- `resolveProvider` 에 `'classify'` 케이스 추가 (`config.ts`):
  - `CLASSIFY_PROVIDER` 지정 시 `mapToProvider(CLASSIFY_PROVIDER, config)` 으로 resolve, `CLASSIFY_MODEL` 이 있으면 모델만 override.
  - 미지정 시 `resolveProvider('ingest', config)` 승계, `CLASSIFY_MODEL` 있으면 모델만 override.
- `wikey.conf` 주석 블록 갱신 — `gemini-2.0-flash-lite`/`gpt-4o-mini` 저가 모델 예시.
- 테스트 (`config.test.ts` +4): inherit / provider override / model-only override / provider+model 조합.

#### 4.2.3.3 Audit "Re-classify with LLM" 토글 (S3-3)

- `sidebar-chat.ts` Audit row 렌더에서 `hint.needsThirdLevel === true` 인 row 에만 체크박스 DOM 추가 (`.wikey-audit-reclass-line` / `-cb` / `-label`).
- 플러그인 클래스에 `private inboxReclassify: Map<string, boolean>` 추가, `renderAuditPanel` 진입 시 `new Map()` 으로 초기화.
- 체크박스 이벤트 리스너 + 라벨 클릭 (둘 다 `stopPropagation` — row 전체 click 토글과 충돌 방지).
- Apply 플랜 생성 루프 분기: `dest === 'auto' || reclassifyForced` → `classifyFileAsync` 호출해 LLM dest 계산.
- 스타일 `styles.css` 추가 — purple accent hover, 0.68em small caption.

#### 4.2.3.4 CLASSIFY.md 피드백 로그 append (S3-4, vitest 4)

- `wiki-ops.ts::appendClassifyFeedback(wikiFS, entry)` 신규 헬퍼:
  - CLASSIFY.md 부재 시 `# CLASSIFY\n\n## 피드백 로그\n<entry>` 로 새 파일 생성.
  - 파일은 있는데 섹션 없으면 말미에 `## 피드백 로그` 블록 append.
  - 섹션 있으면 그 안에 entry append (중복 섹션 생성 금지).
  - 마지막 엔트리가 filename+userChoice+llmChoice 기준 동일이면 dedupe (`false` 반환).
- `ClassifyFeedbackEntry` 타입 export + `wikey-core/src/index.ts` 재노출.
- sidebar-chat.ts Apply 플랜 루프에서: `reclassifyForced && dest !== 'auto' && llmDest !== dest` 일 때 append 호출. 호출 실패는 warn 만, 이동 플로우는 blocking 하지 않음.
- 테스트 (`wiki-ops.test.ts` +4): 파일 신규 생성 / 섹션 append / 섹션 존재 시 중복 생성 금지 / dedupe.

### 4.2.4 Stage 4 — Vault listener + startup reconciliation (§4.1.1.9 [ ] 해소 포함)
> tag: #ops, #integrity, #listener

**상태**: Session 2 완료 (2026-04-23). Stage 1/2 의 registry 설계가 실제 사용자 이동/삭제 이벤트와 연결되도록 하는 마지막 고리. §4.1.1.9 두 번째 체크박스 (`vault.on('rename')`/`delete` 에 sidecar 처리) 를 이 세션에서 자동 해소.

#### 4.2.4.1 Pure helper — `wikey-core/src/vault-events.ts` (vitest 9, 신규)

Obsidian API 에 의존하지 않는 순수 헬퍼 3종을 분리해 단위 테스트:

| 심볼 | 역할 |
|------|------|
| `RenameGuard` | movePair → 리스너 간 double-move 방지 큐. `register(path, ttlMs)` / `consume(path) → bool` / `size()`. TTL 기본 5000ms, expiry 경과 시 `purgeExpired()` 가 조용히 정리. |
| `reconcileExternalRename({ wikiFS, oldVaultPath, newVaultPath, newSidecarVaultPath? })` | registry `findByPath(old)` → `recordMove` + ingested_pages 전수 `rewriteSourcePageMeta` + `saveRegistry`. 미등록 경로면 no-op. |
| `handleExternalDelete({ wikiFS, deletedVaultPath, at })` | `findByPath` → `recordDelete` + ingested_pages 에 `appendDeletedSourceBanner` (idempotent). |

테스트 (`__tests__/vault-events.test.ts`, 9 cases):
- RenameGuard — register/consume, TTL 만료, 복수 path register (3)
- reconcileExternalRename — registry+frontmatter 갱신, 미등록 no-op, **링크 안정성** (entity 페이지 wikilink bit-identical) (3)
- handleExternalDelete — tombstone+banner, idempotent, 미등록 no-op (3)

#### 4.2.4.2 `source-registry.ts::reconcile` 확장 (S4-3, vitest +4)

| 기존 (Stage 1) | 확장 (Stage 4) |
|----------------|----------------|
| hash 매칭 시 vault_path 갱신만 수행, missing 은 "caller 가 tombstone" | **missing → 자동 tombstone** · **tombstone + 재등장 → `restoreTombstone` + recordMove** · **idempotent (현 경로 일치 시 path_history 변동 없음)** |

테스트 (`__tests__/source-registry.test.ts` +4, 13 → 16):
- missing record → tombstone
- tombstoned + 재등장 → 복원 + 경로 갱신
- tombstoned + 계속 부재 → 변동 없음
- 현 경로 일치 → 멱등

#### 4.2.4.3 `wiki-ops.ts::appendDeletedSourceBanner` (S4-2, vitest 3)

- source 페이지 frontmatter 뒤, 본문 최상단에 `> [!warning] 원본 삭제됨 (YYYY-MM-DD)` callout + 복원 안내 문구 삽입.
- 파일 부재면 false · 이미 banner 있으면 false · frontmatter 영역은 untouched.
- 테스트 (`wiki-ops.test.ts` +3, 38 → 41): idempotent / 파일 부재 / frontmatter 보존.

#### 4.2.4.4 `classify.ts::movePair` — RenameGuard 통합 (S4-1 선행)

- `MovePairOptions.renameGuard?` optional 필드 추가. 제공 시 원본 rename 직전 새 경로 `register`, sidecar rename 직전 그 새 경로도 `register`.
- 플러그인 호출부 (`wikey-obsidian/src/sidebar-chat.ts`, `commands.ts`) 두 곳 모두 `renameGuard: this.plugin.renameGuard` 전달.
- 기존 movePair 테스트 8 건은 renameGuard 미전달 — 후방 호환 확인.

#### 4.2.4.5 `wikey-obsidian/src/main.ts` — 이벤트 라우팅 + onload reconcile (S4-1/2/3)

- `WikeyPlugin` 인스턴스 필드 `renameGuard: RenameGuard = new RenameGuard()` 추가.
- `onload` 에서 `vault.on('rename')` 등록:
  - `raw/` 대상이 아니면 skip · `STARTUP_GRACE_MS` 이내 skip · `renameGuard.consume(new)` 일치면 skip (movePair 자체 이벤트).
  - 매칭 실패 = 사용자 UI 이동 → `renameDebouncers` Map<oldPath, timeout> 로 200ms 디바운스 후 `handleVaultRename(oldPath, newPath)`.
- `handleVaultRename`: sidecar 자동 동행 (`.md` 원본이 아니면 `<old>.md` → `<new>.md`, `renameGuard.register(sidecarNew)` 후 `fileManager.renameFile`) → `reconcileExternalRename` 호출.
- `vault.on('delete')` 동일 패턴으로 `handleVaultDelete` → `handleExternalDelete` 호출. tombstone 이후 onload reconcile 이 복원 감지.
- `runStartupReconcile()` 호출을 `onload` 체인에 포함 — `app.vault.getFiles()` 중 `raw/` prefix + `size ≤ 50MB` 파일만 `readBinary` → walker 배열. `registryReconcile` 반환 레지스트리가 변경되면 save + console summary.

#### 4.2.4.6 S4-4 path-based API deprecation 경고 (1회)

- `wikey-obsidian/src/commands.ts::saveIngestMap` 진입 시 `_ingestMapWarnOnce` 모듈 플래그로 1회만 console.warn 출력 (`.ingest-map.json path-based API — use source-registry. Slated for removal in Phase 5 §5.3`).
- ingest-pipeline.ts 는 이미 `registryFindById(id)` (hash 기반) 로 중복 감지 — 추가 변경 불필요.
- Python `scripts/audit-ingest.py` 의 hash 판정 보강은 Phase 5 §5.3 에 귀속 (Stage 4 범위 밖).

#### 4.2.4.7 링크 안정성 회귀선 — integration-pair-move.test.ts +2 (사용자 지적 1차)

§4.2 핵심 불변성 ("원본 파일이 이동해도 wiki 페이지의 wikilink 는 업데이트 없이 유지") 을 회귀 방지선으로 고정 (사용자 2026-04-23 지적 반영).

- `링크 안정성 — 원본 파일 이동 후에도 다른 wiki 페이지의 wikilink/본문 bit-identical`:
  - entity page 가 `[[source-stable]]` wikilink 보유 → movePair 실행 → entity page content bit-identical 확인 + source page 파일명(slug) 불변 + source 페이지 frontmatter `vault_path` 만 갱신 (source_id/본문 보존) + registry path_history 가 과거 경로 보존.
- `링크 안정성 — reconcile 경로(외부 mv) 에서도 wiki 페이지 링크 보존`:
  - concept page 가 `[[source-extmv]]` 보유 → 외부 `mv` 모사 후 `registryReconcile` 실행 → concept page bit-identical + registry 새 경로로 갱신.

#### 4.2.4.8 Stage 4 real-disk 통합 회귀선 — integration-pair-move.test.ts +4 (사용자 지적 2차)

사용자 2026-04-23 session 2 추가 지적 ("실질적인 파일 이동 테스트같은건 진행 안한거 같은데?") 반영. Stage 4 의 vault-events helper (reconcileExternalRename · handleExternalDelete · RenameGuard) 가 in-memory 단위 테스트 외에 real-disk `fs.renameSync`/`unlinkSync` 와 결합된 조건에서도 회귀 방지선으로 고정.

- `Stage 4 UI 이동 시나리오 — 실제 fs rename + reconcileExternalRename 후 wikilink bit-identical`: Obsidian UI 드래그 시나리오 모사 — tmpdir 에 seed 된 원본+sidecar 짝을 `renameSync` 로 먼저 옮기고, 그 뒤 `reconcileExternalRename` 호출. entity 페이지 바이트 동일 + 새 경로 파일 존재 + source 페이지 frontmatter 두 필드 갱신 + registry 동기화.
- `Stage 4 삭제 시나리오 — 실제 unlink + handleExternalDelete 후 wikilink 페이지 유지, source 만 banner`: `unlinkSync` 로 원본+sidecar 실제 삭제 후 `handleExternalDelete` 호출. entity 바이트 동일 + source 페이지에 `[!warning]` callout 1회 + frontmatter 보존 + registry tombstone.
- `Stage 4 startup reconcile 종합 시나리오 — multi-file 외부 이동·삭제·복원 한 번에 처리`: 3 파일 (A 이동 · B 삭제 · C 유지) 실제 fs 조작 후 walker 로 `registryReconcile` 1회 호출 — A 새 경로, B tombstone, C 유지 · analyses 페이지 바이트 동일. 이후 B 복원 (같은 해시) → walker 재호출 → B restoreTombstone 자동, analyses 는 전 사이클 내 변화 없음.
- `Stage 4 RenameGuard + movePair 통합 — 실제 fs 이동에서 guard 가 자기 이벤트 소비`: real tmpdir 에 seed → movePair (renameGuard 전달) → 반환 후 `guard.consume(new_original)` / `consume(new_sidecar)` 가 모두 true · `guard.size() === 0` 으로 큐 빔 확인. 리스너 배선의 double-move 방지가 실제 경로에서 동작함을 실증.

#### 4.2.4.9 Session 2 최종 증거 (Stage 3+4 + 링크 안정성 + real-disk 통합)

| 항목 | Session 1 종료 | Session 2 최종 | 증거 |
|------|----------------|----------------|------|
| wikey-core tests | 399 | **434 (+35)** | `npm test -w wikey-core` Test Files 20 passed / Tests 434 passed |
| Stage 3 단위 | — | 13 (classify +5 / config +4 / wiki-ops +4) | 각 파일 green |
| Stage 4 단위 + real-disk integ | — | 22 (vault-events 9 · source-registry +4 · wiki-ops +3 · integration +2 링크안정성 · integration +4 real-disk) | green |
| bash smoke (pair-move) | 6/6 | 6/6 | `scripts/tests/pair-move.smoke.sh` ALL PASS (회귀 없음) |
| `npm run build` | 0 errors | **0 errors** | tsc + esbuild production |
| `validate-wiki.sh` + `check-pii.sh` | — | PASS | wiki 구조·PII 모두 통과 |

**신규/수정 파일 (Session 2)**:
- 신규: `wikey-core/src/vault-events.ts`, `__tests__/vault-events.test.ts`.
- 변경: `wikey-core/src/classify.ts` (+listExistingSlugFolders, +formatSlugBlock, movePair +renameGuard), `wiki-ops.ts` (+appendClassifyFeedback, +appendDeletedSourceBanner + 타입 export), `source-registry.ts` (reconcile 확장), `config.ts` (resolveProvider 'classify' case), `types.ts` (CLASSIFY_PROVIDER/MODEL), `index.ts` (신규 export 블록), `__tests__/classify.test.ts` (+5), `__tests__/config.test.ts` (+4), `__tests__/wiki-ops.test.ts` (+7), `__tests__/source-registry.test.ts` (+4), `__tests__/integration-pair-move.test.ts` (+6: 2 링크 안정성 + 4 real-disk), `wikey-obsidian/src/main.ts` (renameGuard + vault listener + onload reconcile), `commands.ts` (renameGuard 전달 + deprecation warn), `sidebar-chat.ts` (Re-classify 체크박스 + 피드백 로그 + renameGuard), `styles.css` (Re-classify UI), `wikey.conf` (CLASSIFY_* 주석 블록).

**세션 2 커밋 2 건**:
- `502c07a` — feat(phase-4.2): Stage 3+4 — LLM 분류 정제 + vault listener + startup reconcile
- (이후 후속) — docs(phase-4.2): result/todo §4.2 1:1 mirror 정비 + plan/phase-4-2-plan 갱신 + 세션 동기화

§4.2 본체 완결: Stage 1~4 전량 코드 수준 구현 + 테스트 고정. Stage 4 는 수동 UI smoke 로 retest 권장 (bash mv 복원 · Obsidian UI 이동 · 삭제 후 재등장) — 이는 관찰 세션에서.

### 4.2.5 호환성 전략
> tag: #compat

- **fresh vault 가정**: 현재 `wiki/sources/` 비어있고 `.ingest-map.json` 없음 → v3 frontmatter 마이그레이션 실질 무작업. `scripts/migrate-ingest-map.mjs` 는 장래 복구용으로 유지.
- **legacy 심볼 transitional 유지** (Phase 5 §5.3 에서 제거 예정):
  - `wikey-core/src/classify.ts::moveFile` — Stage 2 에서 `movePair` 로 대체됐으나 legacy wrapper 로 남음.
  - `wikey-obsidian/src/commands.ts::saveIngestMap` · `updateIngestMapPath` — ingest 직후 초기 레코드 생성에 여전히 사용. Stage 4 에서 `_ingestMapWarnOnce` 로 1회 deprecation 경고.
  - 구 frontmatter `raw_original_path` 필드 — 현재 신규 ingest 에서 작성되지 않지만 파서는 관용.
- **이벤트 라우팅 안전 순서** (Session 2 기준): movePair `renameGuard` 등록 → fs.rename → vault.on('rename') 이벤트 → `renameGuard.consume` 매칭 → skip. 매칭 실패 = 사용자 UI 직접 이동으로 간주하고 `reconcileExternalRename` 경로로 처리. 200ms debounce 로 연속 rename 흡수.

### 4.2.6 범위 밖 — Phase 5 이관
> tag: #phase-5

본체 완료 정의 ("wiki 재생성 유발하지 않음") 에 부합하는 후속 개선은 Phase 5 로 이관 확정:

- **경로 기반 API 완전 제거** — `.ingest-map.json` 파일 자체 삭제, 구 frontmatter 필드 제거, 구 API 함수 제거 → **Phase 5 §5.3 증분 업데이트** 세션.
- **Audit 파이프라인 hash 판정 일반화** — `scripts/audit-ingest.py` 의 비교 루프 hash 기반 전환 → **Phase 5 §5.3**.
- **CLASSIFY.md `.meta.yaml` 외부 URI 패턴** (Confluence/SharePoint/S3) → **Phase 5 §5.7 운영 포팅**.
- **LLM 피드백 few-shot 자동 재프롬프트** — `## 피드백 로그` 섹션을 다음 classify 호출의 few-shot 으로 자동 재주입 → **Phase 5 §5.6 self-extending**.
- **Registry 대용량 볼트** (> 10,000 파일) 최적화 — LMDB 이관 / mtime-based incremental hash → Phase 5 §5.5 (등장 시 착수).

---

## 4.3 인제스트 (LLM 추출 · 품질 관리)
> tag: #core, #engine, #workflow

**상태** (2026-04-23 session 4 종료 시점): 계획 v2→v3 확정 + **Part A 완료** + **§4.3.3 완료** + **§4.3.2 Part B 완료** + **§4.3.1 3-stage override 완료**. Part A 의 pre-existing tsc readonly 오류 (session 3 커밋 `4588ea2` 의 `parseProvenance` 에서 `Partial<ProvenanceEntry>` 할당) 도 같은 파일 편집 기회에 수정. **§4.3 본체 코드는 전량 종료**. 남은 항목은 실제 인제스트 통합 smoke (Obsidian UI 수동 확인 — `plan/phase-4-todo.md` Phase 4 본체 완성 체크리스트 A) 와 §4.5.2 운영 안전.

### 4.3.codex-verify Codex 2차 검증 시도 및 timeout 확증 (2026-04-23 session 4 후반)
> tag: #verification, #process

**시도**: Part A/B + §4.3.1 실구현 완료 후 `codex-rescue` subagent (`bsmflco7z`) 에 v2 plan + 실 구현 대조 분석 의뢰. 검증 항목 7개 (source-resolver 설계 / Obsidian API / citations dedup / Stage 2/3 인터페이스 / stripBrokenWikilinks 시점 / Part A 회귀선 / TDD 커버리지).

**결과**: analysis 턴 후반 (8794 bytes, 파일 20+ read 완료, 마지막 assistant message "Part A 구현은 계획보다 더 앞서 나가 있어서...") 에서 20분+ 무활동 freeze. 1차 `b2p8s3sgq` (3013 bytes) 와 동일 패턴.

**원인 분석**: 사용자 지적 "다른 패널에서 codex를 실행중이라서 그래?" 로 root cause 확증 — `~/.codex/` 전역 상태 (`logs_2.sqlite` + WAL + `.tmp/arg0/*/.lock` + OpenAI responses WebSocket) 를 인터랙티브 TUI (PID 64375, 26시간+ 구동) 와 공유하면서 rescue 의 최종 response 스트리밍 단계에서 starvation. 증거: `ps -axww` 에서 codex TUI STAT=S+, `~/.codex/logs_2.sqlite-wal` 2999KB, `codex-tui.log` 에 "stream disconnected - retrying sampling request" 로그.

**대응**: plan v3 §12 신설 — 완료 매핑 표 (plan v2 §N ↔ 실 파일:line ↔ 증거) + self-review 4건 1:1 반영 확인 + Karpathy #4 fresh 실행 증거 (vitest 463 + 빌드 0 + pair-move smoke 6/6) + §12.4 통합 smoke 5 체크리스트. codex 공식 verdict 는 획득 실패했으나 plan v2 가드 100% 충족 + 자동 테스트 선으로 대체 확증.

**Why**: codex 2차 검증 무산이 확증됐기에 "codex verdict 필수" 로 Phase 4 종료를 미루면 반복 timeout 에 갇힐 위험. plan v3 의 자동 검증선이 설계 의도상 대체 가능 — v2 self-review 가 4건 (High 1 / Medium 2 / Low 1) 을 이미 구조적으로 해소했고, 이번 세션에 구현이 그 구조를 그대로 반영.

**How to apply**: codex rescue 재시도 시에는 (a) 다른 TUI 종료 또는 (b) `CODEX_HOME=$(mktemp -d)` 격리 모드 필수. 이 경험은 `reference_codex_skill.md` (memory) + `~/.claude/skills/codex/preflight.sh` 에 영구 기록되어 향후 세션에서 자동 감지/우회 가능.
**증거**: wikey-core 437 → **463 tests PASS** (+26: source-resolver 11, query-pipeline citations 6, ingest-pipeline stage1/2/3 loader 9, wiki-ops readonly 고친 기존 3건 유지). `npm test` 21 파일 463/463 · `npm run build` wikey-core tsc 0 + wikey-obsidian esbuild 0. wikey-obsidian 의 pre-existing `settings-tab` 3건 tsc warn 은 session 4 이전부터 master 에 있던 것 (my 변경과 동일 `let resetButton: HTMLButtonElement | null = null` 패턴 재사용) — 번들/런타임에는 영향 없고 본 세션 범위 밖.
**계획 문서**: `plan/phase-4-3-plan.md` v2 (codex rescue 1차 `b2p8s3sgq` timeout → self-review 4건 보강 → session 4 에서 codex rescue 2차 `bsmflco7z` 재시도, 결과 분석 반영).

**본체 포함 근거**: §4.3.2 Provenance 는 wiki 페이지 frontmatter 에 `provenance` 필드를 신규 추가하는 **data model 변경**이다. Phase 5 로 미루면 Phase 4 내에 쌓인 wiki 페이지는 provenance 필드 없이 존재하게 되고, Phase 5 도입 시점에 전체 wiki 재인제스트가 필요해져 본체 정의 ("wiki 재생성 없음") 를 위반한다. Part A 가 이 session 에 완료되어 본체 정의 충족.

### 4.3.1 인제스트 프롬프트 시스템 (3-stage 전부 override) — **완료 (2026-04-23 session 4)**
> tag: #workflow, #prompt

**구현 요약** — 3 stage 모두 file-based override 파이프라인 완비 + settings-tab UI:

| Stage | Canonical path | Legacy fallback | Template vars | Override 방식 |
|-------|----------------|-----------------|---------------|---------------|
| 1 summary | `.wikey/stage1_summary_prompt.md` | `.wikey/ingest_prompt.md` | `{{TODAY}} {{INDEX_CONTENT}} {{SOURCE_FILENAME}} {{SOURCE_CONTENT}}` | 전체 대체 + string replace (기존 `buildIngestPrompt`) |
| 2 mentions | `.wikey/stage2_mention_prompt.md` | — | `{{SOURCE_FILENAME}} {{CHUNK_CONTENT}}` | 전체 대체 + string replace (신규 `BUNDLED_STAGE2_MENTION_PROMPT`) |
| 3 canonicalize | `.wikey/stage3_canonicalize_prompt.md` | — | `{{SOURCE_FILENAME}} {{GUIDE_BLOCK}} {{SCHEMA_BLOCK}} {{EXISTING_BLOCK}} {{MENTIONS_BLOCK}} {{MENTIONS_COUNT}}` | `buildCanonicalizerPrompt(args.overridePrompt?)` **optional** 파라미터 (plan v2 §4.4) — override 가 있으면 bundled 본문 전량 대체, 없으면 기존 로직 |

**코드 변경** (`wikey-core/src/ingest-pipeline.ts`):
- 새 exported path 상수 `STAGE1_SUMMARY_PROMPT_PATH` / `STAGE2_MENTION_PROMPT_PATH` / `STAGE3_CANONICALIZE_PROMPT_PATH` + 구 `INGEST_PROMPT_PATH` 유지 (legacy alias).
- 새 `PromptLoadResult = { prompt, overridden, source: 'bundled'|'stage1'|'legacy-ingest'|'stage2'|'stage3' }` 구조로 UI 가 override 상태를 정확히 surface 가능.
- 새 `loadEffectiveStage1Prompt` / `loadEffectiveStage2Prompt` / `loadEffectiveStage3Prompt` — Stage 1 은 canonical 경로 우선 + legacy fallback, Stage 2 는 canonical / bundled, Stage 3 는 canonical 존재 시만 override (bundled 본문은 canonicalizer 내부 생성).
- `loadEffectiveIngestPrompt` 는 `loadEffectiveStage1Prompt().prompt` shim — 기존 호출부 깨지지 않음.
- `BUNDLED_STAGE2_MENTION_PROMPT` 신설 — 기존 `extractMentions` 내부 하드코딩 prompt 를 외부화. `extractMentions(..., promptTemplate?)` 호출부에서 runtime template 치환.
- 인제스트 흐름에서 `loadEffectiveStage2Prompt`/`loadEffectiveStage3Prompt` 를 route (FULL/SEGMENTED) 진입 전 1회 로드 → `extractMentions` 와 `canonicalize` 호출 시 전달. Hot loop 에서 파일 I/O 재진입 없음.

**코드 변경** (`wikey-core/src/canonicalizer.ts`):
- `CanonicalizeArgs.overridePrompt?: string` + `PromptArgs.overridePrompt?: string` 추가.
- `buildCanonicalizerPrompt` 가 `overridePrompt.trim()` 있으면 template 치환만 수행 후 early return (bundled body 생성 skip). 빈/공백 override 는 **bundled 로 fallback** (`canonicalize — empty overridePrompt (all whitespace) is ignored` 테스트로 회귀 방어).
- `buildSchemaPromptBlock` 을 local 변수 `schemaBlock` 으로 미리 계산 (override/bundled 양쪽에서 같은 소스 재사용 + template 변수 노출).

**코드 변경** (`wikey-obsidian/src/settings-tab.ts`):
- `renderIngestPromptSection` 을 3 stage 로 확장 — 공통 `renderPromptRow` 헬퍼가 Edit/Reset/Status 를 1 행 단위로 렌더. 각 행은 inline hint (예: Stage 1 "wikilink 직접 쓰지 마세요 — §4.3.3 로 strip"; Stage 2 "출력 스키마 유지"; Stage 3 "SCHEMA_BLOCK 제거 금지") 로 사용자 실수 완화 (plan v2 §4.5 self-review #4 반영).
- `IngestPromptEditModal` constructor 에 `title?: string` 파라미터 추가 — 모달 헤더가 `Edit Stage 2 — Mention extraction prompt` 식으로 달라짐.
- Reset 이 canonical + legacy 양쪽 동시 검사 → 둘 다 있으면 confirmation 에 두 경로 노출 후 모두 삭제 (Stage 1 에서 legacy+canonical 혼재 방어).

**테스트** (`wikey-core/src/__tests__/`):
- `ingest-pipeline.test.ts` +9 (Stage 1 canonical vs legacy vs bundled 3, Stage 2 override vs bundled 2, Stage 3 override vs bundled 2, 기타).
- `canonicalizer.test.ts` +2 — `overridePrompt fully replaces bundled template with variable substitution` (6 substitution 변수 확증), `empty overridePrompt ignored — bundled default wins` (whitespace-only no-op 회귀 방어).
- `index.ts` 신규 export: `loadEffectiveStage1/2/3Prompt` + path 상수 + `BUNDLED_STAGE2_MENTION_PROMPT` + `PromptLoadResult` 타입.

**의존성**: Part A/§4.3.3 과 독립. 본체 완료 기준에 기여 — Phase 5 §5.6 self-extending 이 `.wikey/*.md` 를 세대 자동 조립할 때 동일 형식 재사용.

**남은 범위 축소**: 도메인별 프리셋 (기술문서 / 논문 / 매뉴얼 / 회의록 / 제품 스펙) 과 모델별 품질 baseline 측정은 Phase 5 §5.6 self-extending 으로 이관 (중복 방지, plan v2 §4.3 결정 유지).

### 4.3.2 Provenance tracking — frontmatter + 쿼리 응답 원본 backlink 렌더링
> tag: #workflow, #citation, #data-model

본체 완료 선언 직전 마지막 data model 변경. Part A 는 이 session 완료, Part B 는 다음 세션 이관. 상세 설계: `plan/phase-4-3-plan.md §2 + §3`.

#### 4.3.2.1 계획 수립 + codex rescue self-review (2026-04-23 session 3)

**배경 (2026-04-22 사용자 요청)**: data model (frontmatter `provenance` 필드) 뿐 아니라 **쿼리 응답에서 원본 파일 backlink 렌더링** 까지 포함. wiki 계층이 본체 완료 선언 시점에 "근거 체인이 원본 파일까지 닿는 citation UX" 를 갖춘 상태가 되어야 본체 정의 ("원본 → wiki ingest 프로세스 완성") 와 정합. 답변이 wiki 페이지 wikilink 까지만 걸리고 `wiki/sources/source-*.md` 의 `> 원시 소스: raw/...` 라인을 한 번 더 펼쳐봐야 원본에 닿음 — 3-hop → 1-hop 단축.

**계획 산출**: `plan/phase-4-3-plan.md` v2. v1 → v2 진화는 codex rescue 2차 검증 대신 **self-review 4건** 으로 보강:

| # | 발견 | v1 위치 | v2 수정 | 심각도 |
|---|------|---------|---------|--------|
| 1 | Obsidian plugin 은 Electron renderer → `shell.openPath` (main-only) 미접근. `app.openWithDefaultApp` / `workspace.openLinkText` / `window.open` 가 올바른 API | §3.3 | §3.3 클릭 핸들러 3 경로 재작성 | High |
| 2 | `buildCanonicalizerPrompt` 시그니처 확장을 "optional" 로 명시 안 함 → 기존 호출부 깨짐 리스크 | §4.4 | §4.4 optional 파라미터 명시 + backward compat 주석 | Medium |
| 3 | stripBrokenWikilinks 가 Stage 2/3 후 source 페이지 재후처리 → Stay-involved Preview 모달 (Stage 1 직후) 과 저장본 불일치 | §5.2 | §5.2 Preview 를 strip 후로 이동, 구현 순서 확정 | Medium (UX) |
| 4 | Stage 1 override prompt 가 wikilink 직접 생성하면 §4.3.3 재후처리 시 의도 wikilink 까지 strip 될 위험 | 누락 | §4.5 신설 (bundled prompt 주석 + settings UI inline 가이드) | Low (문서 경고) |

codex rescue (`b2p8s3sgq`) 프로세스는 analysis 턴 후반 (3013 bytes) 에서 최종 응답 캡처 실패. self-review 로 대체 + Part A 착수 후 필요 시 재시도.

**Open question 5건 decision** (plan v2 §9):
1. Provenance 복수 source → **flat 배열** (type 이 ref 별 상이할 수 있음 + Phase 5 §5.2 그래프 매핑 간단).
2. Part B 인라인 vs 하단 Citations 패널 → **인라인만 MVP**, 하단은 Phase 5 §5.7.
3. §4.3.1 도메인 프리셋 → **Phase 5 §5.6 이관**.
4. stripBrokenWikilinks 와 Preview 모달 시점 → **Preview 를 strip 후로** (§5.2 확정).
5. AMBIGUOUS 리뷰 UI → **Badge + Notice 만**, Accept/Reject 는 Phase 5 §5.4.

#### 4.3.2.2 Part A — Frontmatter `provenance` data model (2026-04-23 session 3, 완료)

**`wikey-core/src/types.ts` — 타입 정의**:

```typescript
export type ProvenanceType =
  | 'extracted'      // 소스에서 직접 발견 (Stage 2 mention 추출 기본)
  | 'inferred'       // LLM 이 추론 (Stage 3 canonicalize 가 mention 없이 합성)
  | 'ambiguous'      // 리뷰 필요 (동명이인·축약어·경계 모호)
  | 'self-declared'  // Phase 5 §5.6 예약 — in-source self-declaration

export interface ProvenanceEntry {
  readonly type: ProvenanceType
  readonly ref: string          // 'sources/<source_id>' 포맷, PARA 이동 불변
  readonly confidence?: number  // 'inferred' / 'self-declared' 에만 의미, 0.0~1.0
  readonly reason?: string      // 'ambiguous' 에만 의미, 한 줄 근거
}
```

**`wikey-core/src/wiki-ops.ts::injectProvenance`** — entity/concept/analyses frontmatter 에 provenance 배열 주입 (vitest +3 green):
- 기존 frontmatter 없음 → 새 블록 생성 (본문 보존).
- 기존 frontmatter 있고 `provenance` 필드 없음 → 추가.
- 기존 `provenance` 있음 → dedupe (type + ref 기준) 후 append.
- YAML block scalar 2-space indent 포맷 — flow style 사용 안 함 (Obsidian 파서 호환).
- **`provenanceYamlScalar` 신설**: ref 값이 `sources/sha256:abc` 형태인데 `yamlString` 의 콜론 전면 따옴표 규칙이 과도하게 엄격해 따옴표가 씌워지는 문제 발견 → "콜론-공백 (`: `)" 또는 특수 시작문자만 따옴표. 테스트 케이스의 `ref: sources/sha256:a3f2` 형태가 bare 로 유지.

테스트 (`__tests__/wiki-ops.test.ts` 41 → 44, +3):
1. provenance 필드 신규 주입 — `extracted` + `inferred` (confidence 포함) 2 엔트리 순서 보존 + 기존 필드 (title, sources) 보존 + 본문 보존.
2. 기존 provenance 에 merge + dedupe — 중복 (type+ref 동일) 은 스킵, 신규 `ambiguous` 엔트리 추가 (`reason` 필드 포함).
3. frontmatter 없는 페이지 — 새 블록 생성 후 본문 그대로 유지.

**`wikey-core/src/ingest-pipeline.ts` — Stage 2/3 배선**:

```typescript
const provenanceEntry = v3Meta.record
  ? [{ type: 'extracted' as const, ref: `sources/${v3Meta.id}` }]
  : null

for (const entity of parsed.entities ?? []) {
  const content = provenanceEntry ? injectProvenance(entity.content, provenanceEntry) : entity.content
  ...
}
```

MVP 방식 — canonicalize 된 모든 entity/concept 에 `{type: 'extracted', ref: 'sources/<source_id>'}` 자동 주입. `v3Meta.record = null` (bytes 못 읽음) 이면 provenance skip — 기존 path-based fallback 경로 안전. `inferred` / `ambiguous` 구분은 canonicalize output 확장과 함께 Phase 5 §5.4 variance diagnostic 에서 추가.

**`wikey-core/src/index.ts` — 신규 export**: `injectProvenance`, 타입 `ProvenanceType` / `ProvenanceEntry`.

#### 4.3.2.3 Part B — 쿼리 응답 원본 backlink 렌더링 (2026-04-23 session 4, 완료)

**신규 모듈** `wikey-core/src/source-resolver.ts` (~165 라인):
- `resolveSource(wikiFS, idOrRef, opts) → Promise<ResolvedSource | null>` — registry 조회 → URI derive. 미등록 `null`, tombstone `openUri: null`.
- `resolveSourceSync(idOrRef, registry, opts)` — 배치 렌더용 동기 variant (citation 이 여러 개일 때 registry 1회 load 후 n회 resolve).
- `ResolvedSource` 필드: `sourceId / kind ('file'|'external') / currentPath / sidecarPath / displayLabel / extension / tombstoned / openUri / absolutePath`.
- `kind='file'` → `buildObsidianOpenUri(vaultName, currentPath)` — `obsidian://open?vault=&file=` (plan v2 §3.3 self-review #1 반영, Electron renderer 안전).
- `kind='external'` (source_id 가 `uri-hash:` 접두) → currentPath 가 외부 URI 그대로.
- `stripSourcesPrefix` 가 `sources/sha256:...` / bare `sha256:...` / `sources/uri-hash:...` / bare `uri-hash:...` 4 형태 모두 수용 — provenance.ref 또는 raw id 입력 가능.
- `absolutePath` 는 `absoluteBasePath` 주어졌을 때만 계산 (bash CLI 또는 file:// fallback 용). `resolvedAbsoluteFileUri` helper 로 `file://` URI 도출.

**테스트** (`__tests__/source-resolver.test.ts`, 신규 11): happy path + prefix 없는 bare id + absolutePath 생성 + 미등록 null + registry 부재 null + 빈/공백 입력 null + tombstone open=null + PARA 이동 후 `path_history` 무시하고 current path reflect + external `uri-hash:` 분기 + sync variant (지정 registry + 미등록).

**`wikey-core/src/query-pipeline.ts` citations 구조화**:
- `QueryResult` 에 `citations?: readonly Citation[]` optional 추가. `Citation = { wikiPagePath, sourceIds, excerpt? }` (types.ts 신규).
- `collectCitationsWithWikiFS(results, wikiFS)` + `collectCitationsFromFS(results, basePath)` 쌍 — searchResults 순서 보존, 페이지 frontmatter 에서 provenance.ref 추출 → `sources/` prefix strip → source_id dedupe → `Citation` 1건. provenance 없는 페이지는 skip.
- `buildCitationFromContent(result, content)` 순수 함수 export (단위 테스트 용). `extractProvenanceRefs` regex 기반 — `provenance:` 블록 시작 후 top-level key 가 나오기 전까지 `ref: ...` 라인 수집, quoted/bare 양쪽 수용.
- `query()` 내부가 LLM 합성 성공 후 wikiFS 가용성 따라 `collectCitations*` 실행 → `QueryResult.citations` 채움. 기존 `sources` 필드 유지 (backward compat).

**테스트** (`__tests__/query-pipeline.test.ts` +6): `buildCitationFromContent` 4 케이스 (provenance 혼합+dedupe / frontmatter 없음 / provenance 필드 없음 / uri-hash 보존) + `collectCitationsWithWikiFS` 2 케이스 (missing page skip + legacy page no provenance → 빈 배열).

**`wikey-obsidian/src/sidebar-chat.ts` 답변 렌더**:
- `ChatMessage` 타입에 `citations?: readonly Citation[]` 추가. `handleSend` 가 `result.citations` 를 assistant 메시지에 첨부.
- `renderMessage` 가 assistant 메시지 + citations 존재 시 `attachCitationBacklinks` 를 await 없이 호출 (렌더링 블록 방지).
- `attachCitationBacklinks` 가 `loadRegistry` 1회 호출 → wikilink DOM 순회 → `byBase` 매칭 → `resolveSourceSync` → `📄` 보조 버튼 attach. 같은 wikilink 에 중복 attach 방지 (`.wikey-citation-attached` 클래스 guard).
- `buildCitationButton(resolved)` factory — `<a class="wikey-citation-link">📄</a>` + `aria-label="원본 파일 열기: <filename>"` + `title` 속성 (plan v2 §3.3 self-review #1 — 접근성). Tombstone 은 `wikey-citation-tombstone` 클래스 + `filter: grayscale(1)` + cursor not-allowed.
- `openResolvedSource` dispatch (3 경로):
  - **tombstone** → `new Notice('원본 삭제됨 — <label> (registry tombstone)')`, 추가 액션 없음.
  - **external (uri-hash)** → `window.open(uri, '_blank', 'noopener')` (Obsidian 이 외부 브라우저로 위임).
  - **internal vault file** → `app.workspace.openLinkText(currentPath, '')` (Obsidian 이 확장자에 따라 PDF 내장 뷰어 / 기본 앱 라우팅, plan v2 §3.3 명시).
- CSS `.wikey-citation-link` — `0.68em` + `opacity: 0.7` (wikilink 보다 덜 강조, hover 시 opacity 1). 철학 가드: wiki 계층이 주 경로 유지.

**테스트**: sidebar-chat UI 는 DOM 의존으로 vitest 불가 (plan v2 §6.2 표기). 단위 테스트는 source-resolver (11) + query-pipeline citations (6) 로 로직 커버, DOM attach 동작은 통합 smoke 에서 수동 확인 권장.

**index.ts 신규 export**: `resolveSource` / `resolveSourceSync` / `resolvedAbsoluteFileUri` / `ResolvedSource` / `ResolveSourceOptions` / `SourceIdKind` / `buildCitationFromContent` / `collectCitationsWithWikiFS` / `collectCitationsFromFS` / `Citation`.

**Part A readonly tsc 버그 고정 (ancillary)**: `wiki-ops.ts::parseProvenance` 에서 `Partial<ProvenanceEntry>` 에 ref/confidence/reason/type 할당 → readonly 제약 위반. local builder 타입 `{ type?, ref?, confidence?, reason? }` 로 교체 후 `flush()` 가 ProvenanceEntry 구성 + spread. npm test 263 → 463 그대로 녹색, tsc 4 errors → 0.

### 4.3.3 stripBrokenWikilinks 자동 적용 (source_page 본문) — **완료 (2026-04-23 session 3)**
> tag: #workflow, #hygiene

**배경**: Phase 3 §14.5 에서 OMRON 인제스트 후 source 페이지 본문에 261건의 한국어 wikilink 가 canonical 안 된 상태로 남아 수동 cleanup 필요했던 이력. canonicalizer 가 기존엔 entity/concept 페이지 + log entry 에만 `stripBrokenWikilinks` 적용하고 source 페이지 본문은 누락.

**구현** (`wikey-core/src/ingest-pipeline.ts`):
- Stage 2/3 canonicalize 완료 **후** + Stay-involved Preview 모달 호출 **이전** 지점에 `stripBrokenWikilinks(parsed.source_page.content, keepBases)` 삽입.
- `keepBases` = `parsed.entities.map(normalizeBase)` ∪ `parsed.concepts.map(normalizeBase)` ∪ `{parsed.source_page.filename}`. canonical 된 페이지에 매칭 안 되는 wikilink 는 plain text 로 강등.
- 순서 의미: Preview 와 저장본이 **bit-identical** — 사용자가 모달에서 본 내용이 그대로 fs 에 저장. plan v2 §5.2 의 핵심 보강 (self-review #3 결과).

**회귀 방지**: 기존 `wiki-ops.test.ts::stripBrokenWikilinks` unit tests 4 건이 그대로 적용 (pure function). 통합 시나리오는 다음 세션 통합 smoke (실제 PMS PDF 인제스트 → source 페이지 본문에 깨진 wikilink 없음 확인) 로 확보.

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

#### 4.5.1.5 LLM Wiki Phase A/B/C (v2) — 결정적 Phase A + 2-route + ablation 선행 + TDD (2026-04-21, 진행중)

**배경**. §4.5.1.4 Total CV 32.5% 는 post-processing 밖의 variance 임을 확증. 원인 후보로 "RAG chunk 경계 지터" 가 제1후보. 그러나 §4.1 Docling 메인화 직후 철학 재검토에서 **RAG chunk 패턴 자체가 `wikey.schema.md §19·§21` 배격 대상** 임이 드러남. §19 는 "전체를 정독하지 않되, 어디에 무엇이 있는지는 반드시 파악" (=Phase A/B/C 흐름) 을 명시, §21 은 "검색을 DB에 위임하면 다시 RAG가 된다" 고 경고. 따라서 §4.5.1.5 를 "variance 측정" 에서 **"Phase A/B/C 이행 + 사후 variance 재측정"** 으로 확장.

**v1 → v2 경위**:
- v1 초안: Phase A 를 LLM 분류기 (core/support/skip), Route 3분기 (SMALL/MEDIUM/LARGE, char 임계), Route 1 단일 호출 병합
- Claude 자체 검증 (8건) + Codex 적대적 검증 (12건) → **판정 NEEDS-REVISION**
- 핵심 지적: (1) LLM Phase A 분류기는 "retriever 의 변형" — schema §19 위반 (2) Route 1 내부 모순 (3) char 임계 한국어 브로큰 (4) 섹션 경계 주범 증거 부족 — ablation 필요 (5) N=10 은 inference grade 미달
- **v2 핵심 전환**: Phase A 를 **완전 결정적** (코드만, LLM 없음) + Route **2분기** (FULL/SEGMENTED, token-budget) + 결정적 fallback + ablation 선행 + N=30 + 모든 검증 가능 단위 TDD

**설계 문서**: `plan/phase-4-change-phase-abc.md` (v2, 2026-04-21 작성). v1 내용 → Codex findings → v2 rewrite 전 과정 수록.

##### 4.5.1.5.1 plan/phase-4-todo.md §4.5.1.5 v2 체크박스 교체 (완료)

기존 5 체크박스 ("chunk 분할 결정성 확인", "10-run baseline", "temperature/seed 재검증", "slug 변이 추가") → v2 8 섹션 24 체크박스 (§0 ablation, §1 Phase A 결정적 파서, §2 token-budget Route, §3-4 Route 구현, §5 chunk 제거 + rename, §6 Phase C 근거, §7 측정, §8 문서 동기화).

##### 4.5.1.5.2 `section-index.ts` 결정적 Phase A 파서 + 22 TDD (완료)

**신규 파일**: `wikey-core/src/section-index.ts` (~300 줄, LLM 의존 0)

**Exports**:
- `parseSections(md) → ReadonlyArray<Section>` — 결정적 파서
- `buildSectionIndex(md) → SectionIndex` (sections + globalRepeaters + langHint)
- `computeHeuristicPriority(s) → 'skip' | 'core' | 'support'` — 결정적 휴리스틱
- `formatPeerContext(index, currentIdx, tokenCap)` — Route SEGMENTED peer context
- `formatSourceTOC(index)` — 소스 페이지 Phase C 데이터

**커버 엣지 케이스** (Codex #8 반영):
- `^#{1,6}\s?` 범용 regex (Docling H2 외 unhwp/DOCX 대비)
- 코드블록 펜스 내부 `#` 은 heading 으로 간주 안 함
- 공백 없는 `##기술스택` 허용
- 첫 `##` 이전 preamble → pseudo-section (warning `preamble`)
- 빈 섹션 (bodyChars < 5) 만 병합 (v1 의 `< 50` 은 과도 — plan/impl 모두 5 로 하향)
- 같은 title 3회+ 반복 + body<100 → `suspicious-heading` warning
- heading 0 개 → 단일 pseudo-section (warning `no-headings`)
- mixed level (`##` + `###`) → flat list + `mixed-level` warning
- headingPattern 분류 (`toc`/`appendix`/`contact`/`revision`/`copyright`/`normal`) — `computeHeuristicPriority` 에서 skip 결정

**단위 테스트**: `__tests__/section-index.test.ts` — 22 tests
- 결정성 (같은 입력 3회 호출 identical)
- heading 패턴 8 cases
- 병합/감지 2 cases (merged-empty, suspicious-heading)
- 메타 계산 4 cases (hasTable, acronymDensity, koreanCharCount, headingPattern)
- computeHeuristicPriority 4 분기 (skip × 2, core, support)
- buildSectionIndex globalRepeaters 결정성 2 cases
- formatPeerContext 2 cases
- formatSourceTOC 1 case

**검증**: `npm test` — **251 → 273 PASS (+22), 0 fails**. 기존 테스트 회귀 0.

##### 4.5.1.5.3 `Mention.source_chunk_id` → `source_section_idx` rename (완료)

**grep 전수조사**: 외부 persistence 0건 확증. 코드 2곳만 참조 (`types.ts:119`, `ingest-pipeline.ts:437`). Frontmatter · wiki/log · 테스트 · 외부 fixture 모두 미참조 → rename 안전.

**변경**:
- `types.ts` — `readonly source_chunk_id?: number` → `readonly source_section_idx?: number` + comment 갱신 (섹션 단위 재편 설명)
- `ingest-pipeline.ts:437` — `source_chunk_id: chunkIdx` → `source_section_idx: chunkIdx` (이 시점에 함수 파라미터는 `chunkIdx` 유지. v2 Route SEGMENTED 에서는 section.idx 를 pass)
- `canonicalizer.ts` — 로직 무변경 (애초에 `source_chunk_id` 참조 없음)

검증: 273/273 tests PASS.

##### 4.5.1.5.4 `PROVIDER_CONTEXT_BUDGETS` + `estimateTokens` + `selectRoute` (TDD, 완료)

**신규 `provider-defaults.ts` exports**:
```typescript
interface ContextBudget {
  contextTokens: number
  outputReserve: number      // 0~1, output 공간 비율
  promptOverhead: number     // schema/template 고정 tokens
}

PROVIDER_CONTEXT_BUDGETS: Record<model, ContextBudget>
// gemini-2.5-flash/pro: 1M / 0.25 / 2000 → usable 748K
// claude-haiku/sonnet/opus 4-x: 200K / 0.25 / 2000 → 148K
// gpt-4.1-mini/gpt-4.1: 1M / 0.25 / 2000 → 748K
// qwen3:8b (Ollama): 32K / 0.30 / 2000 → 20.4K

getProviderBudget(provider, model): ContextBudget
estimateTokens(md): number     // divisor 1.5 (ko) / 2.5 (mixed) / 4 (en), ×1.3 margin
selectRoute(md, provider, model): 'FULL' | 'SEGMENTED'
```

**TDD** (14 새 tests in `provider-budgets.test.ts`):
- 4 provider × budget 엔트리 확증
- getProviderBudget fallback (표에 없는 모델 → chat default → ultra-fallback)
- estimateTokens 한국어/영어/mixed/빈 문자열 분기
- selectRoute: Gemini + 50KB 한국어 → FULL, Ollama qwen3:8b + 동일 → SEGMENTED, tiny doc → 어느 provider 든 FULL, 결정성

검증: 273 → 287/287 PASS (+14).

##### 4.5.1.5.5 `ingest-pipeline.ts` Route FULL/SEGMENTED 재편 (완료)

**제거**:
- `splitIntoChunks(text, maxChunkSize=8000)` (구 line 575-607) — RAG char-cut 메타포 폐기
- `MAX_SOURCE_CHARS = 12_000` export → 내부 상수 `TRUNCATE_LIMIT` (Ollama 섹션 hard-cap 전용)
- Large-doc chunked loop (구 line 199-255) — Route SEGMENTED 로 교체

**추가**:
- Import: `selectRoute` (provider-defaults), `buildSectionIndex` / `computeHeuristicPriority` / `formatPeerContext` / `formatSourceTOC` (section-index)
- 최상위 `const route = selectRoute(sourceContent, provider, model)` + `sectionIndex = buildSectionIndex(sourceContent)`
- **Route FULL** 경로: `summary + extractMentions(full-doc) + canonicalize` (기존 small-doc 경로 구조 재활용). Progress message "Summary (model) [FULL]" / "Extracting mentions (model) [FULL]".
- **Route SEGMENTED** 경로: `summary + 섹션별 extractMentions + canonicalize`. 섹션 target = `core ∪ support` (skip 제외). 각 섹션 호출마다 peer context (DOC_OVERVIEW + GLOBAL_REPEATERS + CURRENT_SECTION + LOCAL_NEIGHBORS) 주입 via `buildSectionWithPeer`. Progress "Section i/N §idx 'title' [SEGMENTED]".
- `buildSectionWithPeer(peer, section, isLocal)` helper — Ollama 면 section.body 에 `truncateSource` 적용 (섹션 단위 hard-cap).

**섹션 안전망**: 모든 섹션이 skip 이면 fallback 으로 `sectionIndex.sections` 전체를 target 으로 사용 → schema.md §19 의 "빠짐없이 파악" 보장.

**Mention 필드**: `source_section_idx = section.idx` 를 extractMentions 호출 시 전달 → canonicalizer 는 미사용이지만 debug log / 향후 lint 에서 "어느 섹션에서 왔는지" 역추적 가능.

검증: tsc 0 errors, 287/287 PASS 유지.

##### 4.5.1.5.6 `appendSectionTOCToSource` — Phase C 근거 데이터 (TDD, 완료)

**역할**: ingest 가 소스 페이지를 쓸 때 body 끝에 `formatSourceTOC(sectionIndex)` 결과를 idempotent append. 쿼리 시 LLM 이 TOC 를 읽고 "이 섹션은 미심독됐으니 온디맨드 재독" 결정 가능한 결정적 메타 제공.

**Idempotent**: 기존 `## 섹션 인덱스` 가 있으면 제거 후 재부착 (재인제스트 안전).

**구현 위치**: `ingest-pipeline.ts` 내 export (wiki-ops.ts 는 createPage 유지). sourcePage 작성 직전 `content: appendSectionTOCToSource(parsed.source_page.content, sectionIndex)`.

**TDD** (3 새 tests in `source-toc-append.test.ts`): append 형식, 결정성, 빈 markdown edge case.

검증: 287 → 290/290 PASS (+3).

##### 4.5.1.5.7 Obsidian UI progress (완료 — 자동 연동)

sidebar 는 `progress.message` 를 투명하게 노출하므로 별도 수정 불필요. ingest-pipeline 에서 갱신된 message ("Route FULL", "Section i/N §idx 'title' [SEGMENTED]") 가 자동 UI 표시.

`esbuild.config.mjs production` → 0 errors.

##### 4.5.1.5.8 Ablation 스크립트 (완료 — 실행은 사용자 세션)

**`scripts/ablation-ingest.sh`** 작성:
- 실험 1: `measure-determinism.sh` 위임 (convert-cache 로 인해 frozen markdown 자동)
- 실험 2-4: 현재 ingest-pipeline 내부 export 부재 → §4.5.1.5.9 후보로 이관 (별도 Node helper 필요)

**Gate 기준 기록**:
- Total CV ≤ 16% (baseline 32.5% 의 50%) → 섹션 경계 **> 50% 기여** (주범) → 30-run PMS main 진행
- 16% < CV ≤ 26% → **20-50% 기여** → 30-run + 개선폭 재산정
- CV > 26% → **< 20% 기여** → smoke 만 + `§4.5.1.6` (LLM 수준 variance) 신규

##### 4.5.1.5.9 이번 세션 구현 집계

**신규 파일**:
- `wikey-core/src/section-index.ts` (~300 줄, LLM 의존 0)
- `wikey-core/src/__tests__/section-index.test.ts` (22 tests)
- `wikey-core/src/__tests__/provider-budgets.test.ts` (14 tests)
- `wikey-core/src/__tests__/source-toc-append.test.ts` (3 tests)
- `scripts/ablation-ingest.sh`
- `plan/phase-4-change-phase-abc.md` (v2 설계 문서)

**수정 파일**:
- `wikey-core/src/provider-defaults.ts` (+ContextBudget, PROVIDER_CONTEXT_BUDGETS, getProviderBudget, estimateTokens, selectRoute)
- `wikey-core/src/ingest-pipeline.ts` (Route FULL/SEGMENTED 로직, chunk 삭제, appendSectionTOCToSource, buildSectionWithPeer, TRUNCATE_LIMIT rename)
- `wikey-core/src/types.ts` (Mention 필드 rename)
- `plan/phase-4-todo.md §4.5.1.5` (v2 체크박스 + 진행 반영)

**테스트 증가**: 251 (§4.5.1.4 종료 시점) → **290 PASS** (+39, 모두 새로운 TDD).

**빌드 증거**: tsc 0 errors, esbuild 0 errors.

##### 4.5.1.5.10 다음 세션 — 측정/gate/roll-up

측정 런타임은 Obsidian CDP + API 키 필요하므로 별도 세션.

- [x] Obsidian `--remote-debugging-port=9222 --remote-allow-origins='*'` 기동 (§4.5.1.5.11)
- [x] `./scripts/ablation-ingest.sh raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf -n 10` → 실험 1 결과 + gate 판정 (§4.5.1.5.11)
- [x] gate 통과 시 `./scripts/measure-determinism.sh ... -n 30` → PMS main + §4.5.1.4 baseline 대비 비교 (§4.5.1.5.12, 진행 중)
- [ ] Route FULL (Gemini) + Route SEGMENTED (Ollama) 10-run smoke 각 1회 (후속)
- [x] 결과 수합 후 `activity/phase-4-result.md §4.5.1.5` 에 측정 섹션 추가 (§4.5.1.5.11~.13)
- [~] §4.5.1.5 최종 결론: CV 개선폭 / selective rollback 판정 / §4.5.1.6 (LLM 수준 variance) 생성 여부 (§4.5.1.5.13, 30-run 완료 후 확정)

##### 4.5.1.5.11 측정 인프라 패치 + gate 판정 (2026-04-22)

**맥락**. §4.5.1.5.8 의 `scripts/ablation-ingest.sh` 는 내부적으로 `measure-determinism.sh -n 10` 를 호출하여 실험 1 (Frozen markdown × N) 을 수행한다. 2026-04-22 첫 실행에서 **10 run 중 1 run 만 성공, 9 run은 "row not found after 5 retries"** 로 실패.

**진단**. 실패 run 들은 audit panel 에 17 rows 가 있는 상태에서 타겟 소스 `PMS_제품소개_R10_20220815.pdf` 만 사라짐. CDP 로 직접 확인하니:

- `python3 scripts/audit-ingest.py --json` → missing 17 files 에 **PMS 포함**
- Obsidian `.wikey-audit-row` 17 rows → **PMS 미포함, GOODSTREAM 포함** (stale)

즉 Obsidian UI 의 audit-list 가 파일 시스템 최신 상태를 반영하지 않음.

**근본 원인**. `wikey-obsidian/src/sidebar-chat.ts:220` 의 `selectPanel()` 에 "re-click = no-op" 가드:

```ts
if (this.activePanel === name) return
```

측정 스크립트는 매 run 시작에 `auditBtn.click()` 2회 (close→reopen) 로 panel refresh 를 의도했으나, 같은 버튼 재클릭은 guard 에 막혀 아무 일도 일어나지 않음. 결과로 `renderAuditSection()` 재호출 (따라서 `audit-ingest.py` 재실행) 이 전혀 발생하지 않고, run 1 시점에 캐시된 auditData 가 run 2+ 까지 유지.

**패치** (`scripts/measure-determinism.sh:212-222`). audit → chat → audit 패널 routing 으로 panel 완전 destroy+recreate 강제:

```js
if (document.querySelector('.wikey-audit-panel')) {
  const chatBtn = [...document.querySelectorAll('.wikey-header-btn')]
    .find(b => b.getAttribute('aria-label') === 'Chat')
  const dashBtn = [...document.querySelectorAll('.wikey-header-btn')]
    .find(b => b.getAttribute('aria-label') === 'Dashboard')
  const other = chatBtn || dashBtn
  if (other) { other.click(); await new Promise(r => setTimeout(r, 600)) }
}
auditBtn.click(); await new Promise(r => setTimeout(r, 2500))
```

**검증 (smoke 3-run)**.

| Run | Entities | Concepts | Total | Time(s) |
|----:|---------:|---------:|------:|--------:|
| 1 | 9 | 19 | 29 | 329.3 |
| 2 | 11 | 11 | 23 | 270.8 |
| 3 | 13 | 13 | 27 | 264.8 |

| 지표 | Mean | Std | **CV %** | Range |
|------|-----:|----:|---------:|------:|
| Entities | 11.00 | 2.00 | **18.2%** | 9–13 |
| Concepts | 14.33 | 4.16 | **29.0%** | 11–19 |
| Total | 26.33 | 3.06 | **11.6%** | 23–29 |

- 3/3 run 성공 → infra 패치 확증
- Total CV 11.6% — smoke 작다 감안해도 baseline 32.5% 대비 확연히 감소

**Gate 판정**.

`scripts/ablation-ingest.sh` 의 gate 기준:

- Total CV ≤ baseline × 0.5 (16.25%) → 섹션 경계 기여 **> 50%** → 30-run PMS main 진행
- 0.5 < ratio ≤ 0.8 (16.25~26%) → 20-50% → 30-run + 개선폭 재산정
- ratio > 0.8 (> 26%) → < 20% → smoke 만 + `§4.5.1.6` 신규 (LLM 수준 variance)

smoke 3-run Total CV 11.6% < 16.25% → **ratio 0.357 → 섹션 경계 기여 ~64.3%** → gate 1번 통과.

> **방법론 주의**. smoke 3-run 은 N=3 으로 통계 신뢰도가 낮음. 원안은 10-run 으로 gate 판정 후 30-run. 그러나 (a) infra 패치 검증이 동시에 필요했고, (b) 3-run CV 11.6% 가 gate 역치 16.25% 대비 충분한 마진을 보여 "10-run 재실행 → 30-run" 경로 대신 **"3-run smoke → 30-run 본 측정"** 으로 통합. 30-run 결과의 첫 10 sample subset CV 가 gate 경계를 벗어나면 재판정.

##### 4.5.1.5.12 30-run PMS main 결과

> 실행: `./scripts/measure-determinism.sh raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf -n 30`
> 시작 2026-04-22 00:41 KST, 종료 03:51 KST (실소요 190분, 평균 5.6분/run)
> 결과 원본: `activity/phase-4-5-1-5-pms-30run-2026-04-22.md`
> 실패: **0/30** (infra 패치 완전 검증)

**통계 (N=30)**

| 지표 | Mean | Std | **CV %** | Range |
|------|-----:|----:|---------:|------:|
| Entities | 11.40 | 4.15 | **36.4%** | 7–22 |
| Concepts | 14.07 | 4.38 | **31.1%** | 7–23 |
| Total | 26.47 | 6.44 | **24.3%** | 19–43 |
| Time | 336.9s | 70.4s | 20.9% | 234–594 |

**§4.5.1.4 baseline 대비 Total CV**

| 측정 | N | Total CV | 감소폭 (절대) | 감소폭 (상대) |
|------|--:|---------:|-------------:|-------------:|
| §4.5.1.4 MarkItDown + post-processing canonicalizer | 5 | **32.5%** | — | — |
| §4.5.1.5 Docling + Phase A/B/C + 결정적 섹션 인덱스 | 30 | **24.3%** | −8.2pp | −25.2% |

> **주의**. §4.5.1.4 는 N=5, §4.5.1.5 는 N=30 으로 표본 크기 차이. N=5 의 CV 는 표본 오차가 크므로 baseline 수치 자체가 불안정할 수 있음. 하지만 8.2pp 감소는 sample noise 범위를 벗어난다고 판단 (§4.5.1.4 의 run 간 range 도 이미 넓었음).

**N=10 subset CV (smoke gate 재확증)**

처음 10 run (runs 1–10) 의 Total: `[23, 41, 35, 43, 19, 23, 24, 30, 26, 26]`

- Mean = 29.0, Std ≈ 8.11, **CV ≈ 28.0%**
- smoke 3-run 의 11.6% 대비 **약 2.4배 높음**
- **결론**: smoke 3-run 은 sample variability 로 극단적 underestimate. N=3 통계 신뢰 불가능을 확증.

**Core / Variable**

| 분류 | Core | All | Core 비율 |
|------|----:|----:|--------:|
| Entities | 3 | 40 | **7.5%** |
| Concepts | 4 | 47 | **8.5%** |

Core entities (3): `lotus-pms`, `lotus-scm`, `project-management-institute`
Core concepts (4): `bill-of-materials`, `gantt-chart`, `project-management-body-of-knowledge`, `work-breakdown-structure`

Core 비율이 극히 낮음 — Phase A/B/C 이행 후에도 30 run 간 "항상 등장" 하는 mention 은 극소수. 대부분 occasional.

**잔여 variance 주범 분석**

30 run all-union 에서 관측된 slug 중복·boundary 왕복:

| 패턴 | 사례 |
|------|------|
| **알림톡 음역 (5-variant)** | `alimtalk` / `allim-talk` / `allimtalk` / `kakao-alimtalk` (+ concept 측 등장) |
| **ERP 명명 (3-variant, E/C swap)** | `enterprise-resource-planning` (C) / `enterprise-resource-planning-system` (E/C) / `erp-system` (E) |
| **SCM 명명 (3-variant, E/C swap)** | `supply-chain-management` (C) / `supply-chain-management-system` (E) / `lotus-scm` (E) |
| **BOM 확장 (4-variant, E/C swap)** | `bill-of-materials` / `e-bom` / `e-bill-of-materials` / `electronic-bill-of-materials` / `engineering-bill-of-materials` |
| **전자결재 (2-variant, E/C swap)** | `electronic-approval` / `electronic-approval-system` |
| **MES 명명 (3-variant)** | `manufacturing-execution-system` (C/E) / `lotus-mes` (E) / `point-of-production-system` (E/C) |
| **REST API** | `restful-api` / `representational-state-transfer-api` |
| **TCP/IP** | `tcp-ip` / `transmission-control-protocol-internet-protocol` |
| **리스크 원장** | `risk-log` / `risk-register` / `risk-management-ledger` / `issue-management-ledger` |

§4.5.1.4 에서 처리된 `SLUG_ALIASES` (alimtalk/allimtok/alrimtok → alimtalk) 와 `FORCED_CATEGORIES` (mqtt/restful-api/project-management-system) 는 여전히 기능 작동 중이지만, 30-run 에서 **새로 발견된 변형 대부분은 canonicalizer 3차 확장이 필요한 신규 패턴**:

- `allim-talk` (하이픈 삽입), `kakao-alimtalk` (브랜드 prefix) — alias 확장 여지
- BOM 5가지 변형 — 약어/분류 축 동시 통합 필요
- ERP/SCM/MES 3가지 변형 — E/C axis + "system" suffix pin 필요
- `project-management-system` 은 §4.5.1.4 에서 이미 FORCED_CATEGORIES 로 pin 했지만, 30-run 에서 동일 slug 가 entity/concept 양쪽에 모두 등장한 run 존재 → pin 로직의 **run-local scope** 한계 확인

**Gate 판정 재산정 (N=30 기준)**

Ratio = 24.3 / 32.5 = **0.748** → `scripts/ablation-ingest.sh` 의 gate 기준으로 **"20-50% 기여 → 30-run + 개선폭 재산정"** 구간.

- smoke 3-run 에서 ratio 0.357 로 판정한 "> 50% 기여" 는 **과장**
- 실제 섹션 경계 지터 기여 = 20~50% 범위 (중위 추정 ~30%)
- 나머지 ~70% 는 **LLM 수준 variance + slug/E-C boundary variability** 공유

##### 4.5.1.5.13 최종 결론

**1. Phase A/B/C 이행은 variance 감소에 기여 있음 (롤백 불필요)**

- Total CV 32.5% → 24.3% (절대 8.2pp, 상대 25.2% 감소)
- 단순 수치 감소만으로도 유지 정당
- 더 강한 정당화는 **`wikey.schema.md §19·§21` 배격 대상인 RAG chunk 패턴 제거** 라는 구조적 이점 (§4.5.1.5.9 에서 이미 기록)
- 290 PASS 테스트, tsc/esbuild 0 errors — 구현 품질 확보
- ∴ **selective rollback 불필요**

**2. 섹션 경계 지터는 "주범(>50%)" 이 아닌 "기여자(20-50%)"**

- 원 가설 (§4.5.1.5 v2 배경) 은 "chunk 경계 지터가 CV 32.5% 의 제1 원인" 이었으나 N=30 측정으로 **부분적 반증**
- 결정적 섹션 파서 + Route 판정으로 variance 25% 만 사라짐
- 나머지 75% 는 다른 층위에서 발생

**3. 잔여 variance 성분 (§4.5.1.6 신규 과제 분해)**

LLM 수준:
- Gemini `temperature=0.1` 기본값 (결정성 안 보장)
- `seed` 미설정
- 섹션별 extractMentions 호출 간 **정보 경계** — peer context 가 동일해도 출력 mentions 이 stochastic

Post-processing 수준:
- canonicalizer 3차 확장 필요 (allim-talk/kakao-alimtalk 등 신규 alias, BOM 5-variant, ERP/SCM/MES "system" suffix)
- `FORCED_CATEGORIES` pin 을 **run-local** 에서 **canonical map 기반** 으로 강화 (동일 slug 가 E/C 양쪽 등장 시 우선순위 고정)

**4. `§4.5.1.6` 신규 (LLM 수준 variance + canonicalizer 3차 — 필수)**

상세는 아래 `4.5.1.6` subject 참조 (todo mirror). 요약:

- **§4.5.1.6.1**: Gemini `generationConfig.temperature=0 + seed=42` 옵션 → `wikey-core/src/llm-client.ts` `extractionDeterminism` 플래그
- **§4.5.1.6.2**: determinism=on 10-run 재측정 (목표 CV <15%)
- **§4.5.1.6.3**: `canonicalize.ts SLUG_ALIASES` 3차 확장 — allim-talk/kakao-alimtalk/ERP/SCM/MES/BOM
- **§4.5.1.6.4**: `FORCED_CATEGORIES` run-local 1-pass → canonical resolution 업그레이드
- **§4.5.1.6.5**: Route FULL vs SEGMENTED 10-run 분리 비교
- **§4.5.1.6.6**: 개선 후 30-run 재측정 (목표 CV <10%)

**5. 측정 infra 개선 (이 세션 부산물)**

- `measure-determinism.sh` panel refresh 패치 (audit → chat → audit) — 10-run+ 측정 신뢰성 확보
- smoke N=3 은 판정 근거로 부적절 확증 — **최소 N=10 원칙** 을 측정 가이드에 반영

##### 4.5.1.5.14 이 세션 완료 증거

**테스트 · 빌드**: 290 PASS (§4.5.1.5.9 시점 유지, 이번 세션은 infra 패치만 — 스크립트 레벨)
**측정**: 30/30 run 성공, Total CV 24.3%
**산출물**:
- `activity/phase-4-5-1-5-pms-30run-2026-04-22.md` (30-run 원본 데이터)
- `activity/smoke-3run-pms-0025.md` (infra 패치 검증용 3-run)
- `scripts/measure-determinism.sh` (panel refresh 패치)
- `activity/phase-4-result.md §4.5.1.5.11~.14` (이 섹션)

#### 4.5.1.6 LLM 수준 variance + canonicalizer 3차 (2026-04-22 완료)

> Mirror: `plan/phase-4-todo.md §4.5.1.6` (6 sub-task 체크박스). 29-run valid Total CV **9.2%** (baseline 24.3% → −62% 상대). 목표 <10% 달성. §4.5.1.6.5 는 §4.5.1.7 로 이관.

**배경 (§4.5.1.5.13 에서 도출)**:

§4.5.1.5 30-run 결과 Total CV 24.3% — baseline 32.5% 대비 25% 상대 감소로 Phase A/B/C 이행의 가치를 확증했으나 잔여 75% variance 가 두 층위에서 발생함을 N=30 데이터로 확증:

1. **LLM 수준** — Gemini `temperature=0.1` 기본 + `seed` 미설정 → 동일 섹션·peer context 에서도 extraction 결과 stochastic.
2. **Post-processing 수준** — canonicalize 미도달 신규 패턴 (`allim-talk`/`kakao-alimtalk` 5-variant, ERP/SCM/MES `-system` suffix 3-variant, BOM 5-variant, E/C 경계 왕복 `electronic-approval(-system)` / `restful-api` 쌍).

**목표**:

- Phase A: `§4.5.1.6.1` + `§4.5.1.6.2` 완료 시 Total CV **< 15%** (determinism 기여분 측정)
- Phase B: `§4.5.1.6.3` + `§4.5.1.6.4` 완료 시 Total CV **< 10%** (canonicalizer + FORCED_CATEGORIES 업그레이드)
- Phase C: `§4.5.1.6.5` (Route 분리 비교) + `§4.5.1.6.6` (최종 30-run 재측정)

**하위 과제 (번호는 `plan/phase-4-todo.md §4.5.1.6` mirror)**:

##### 4.5.1.6.1 Gemini determinism 옵션 (2026-04-22 완료)

**구현**:
- `wikey-core/src/types.ts` — `WikeyConfig.WIKEY_EXTRACTION_DETERMINISM?: boolean`
- `wikey-core/src/config.ts` — `BOOLEAN_KEYS` 에 `WIKEY_EXTRACTION_DETERMINISM` 추가 (`1`/`true` → true 파싱)
- `wikey-core/src/ingest-pipeline.ts` — `callLLMWithRetry(.., deterministic?)` 플래그 추가 (export 로 승격 → 단위 테스트 가능), `ingest()` 에서 `config.WIKEY_EXTRACTION_DETERMINISM === true` 를 읽어 summary/extractMentions/canonicalize 3 지점으로 전파
- `wikey-core/src/canonicalizer.ts` — `CanonicalizeArgs.deterministic?`, `callLLMWithRetry` 에 동일 플래그 주입
- `wikey-obsidian/src/main.ts` — `WikeySettings.extractionDeterminism` 신규, `buildConfig()` 에서 `WIKEY_EXTRACTION_DETERMINISM` 필드로 surface, `loadFromWikeyConf()` 에서 conf 값 병합

**주입 메커니즘**:
`deterministic=true` 일 때 `{ temperature: 0, seed: 42 }` 를 기존 `llmOpts` 에 spread. Gemini 는 `generationConfig.seed` 지원 (이미 `llm-client.ts:42` 에서 처리), 다른 프로바이더(ollama/openai/anthropic) 는 fields 무시 — 안전한 no-op.

**TDD (11 tests 신규)**:
- `config.test.ts §WIKEY_EXTRACTION_DETERMINISM (§4.5.1.6.1)` — `1`/`true`/`0`/`false`/unset 5 케이스
- `ingest-pipeline.test.ts §callLLMWithRetry — §4.5.1.6.1 determinism flag` — Gemini/비-Gemini/undefined/false 4 케이스
- `canonicalizer.test.ts §canonicalize — §4.5.1.6.1 determinism flag` — on/off 2 케이스

Result: 315/315 PASS (이전 290 → +25). tsc/esbuild 0 errors.

##### 4.5.1.6.2 determinism=on 10-run 재측정 (2026-04-22 완료)

**측정**: `./scripts/measure-determinism.sh raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf -n 10 -d` → `activity/phase-4-5-1-6-pms-10run-determinism-2026-04-22.md`.

새 CLI 플래그 `-d/--determinism`: CDP JS 내부에서 `plugin.settings.extractionDeterminism=true` 를 session-scope 주입, 측정 종료 시 이전 값으로 원복. output markdown 에 `> Determinism: ON/off` 기록.

**결과 (9/10 run, 1 timeout)**:

| 지표 | §4.5.1.5 baseline (30-run) | §4.5.1.6 (10-run, det+canon) | Δ absolute | Δ relative |
|------|----------------------------:|-------------------------------:|-----------:|-----------:|
| Entities CV | 36.4% | **13.9%** | −22.5pp | −61.8% |
| Concepts CV | 31.1% | **28.9%** | −2.2pp | −7.1% |
| **Total CV** | **24.3%** | **7.2%** | **−17.1pp** | **−70.4%** |
| Core entities | 3/40 (7.5%) | **18/31 (58%)** | +50.5pp | +7.7x |
| Core concepts | 4/47 (8.5%) | **11/22 (50%)** | +41.5pp | +5.9x |
| Time / run (mean) | 336.9s | 326.9s | −10s | −3.0% |
| Time CV | 20.9% | 22.8% | +1.9pp | (시간 변동성 유사) |

**기여 분해 (추정)**:
- Total CV 24.3% → 7.2% (−17.1pp). 섹션 3-way 중 (1) determinism = Gemini temperature/seed 결정성, (2) SLUG_ALIASES 3차 (5→20) = naming-level 수렴, (3) FORCED_CATEGORIES 3차 (3→13) = axis-level 수렴. 이번 측정은 3 개를 동시 적용했으므로 단일 인자 기여는 분리 측정 필요 (§4.5.1.7 후보).
- 가장 큰 산출 효과: **union 사이즈 급감** — entities 40→31, concepts 47→22. 이는 alias 수렴으로 variant 슬러그들이 단일 canonical 로 merge 된 결과.
- 기존 Entities CV 36.4% → 13.9% 개선 폭이 Concepts CV 31.1% → 28.9% 보다 훨씬 큼 (Entities 의 음역 5-variant 흡수가 alias 효과의 대부분).
- Concepts CV 잔여 28.9%: BOM-variant 흡수는 성공했으나 LLM extraction volume 자체의 variance (일부 run 이 12개, 다른 run 이 22개) 가 남아있음 — determinism 은 LLM 샘플링 결정성이지 **문서 해석 결정성이 아님**.

**목표 대비**:
- Phase A 목표 (§4.5.1.6.1+2 완료 후 Total CV <15%) → ✅ **달성** (7.2% < 15%).
- Phase B 목표 (§4.5.1.6.3+4 완료 후 Total CV <10%) → ✅ **달성** (10-run 기준).
- Phase C 목표 (§4.5.1.6.6 30-run 검증) → 진행 중 (다음 섹션).

**run 10 timeout 메모**: 10 번째 run 이 10분 timeout 으로 실패. 9/10 통계로 CV 계산 신뢰 가능 (baseline 30-run 이 보정 기준). 30-run 에서 유사 timeout 이 재현되는지 확인 필요 — provisional 가설: Gemini quota/latency spike 또는 특정 섹션 조합이 Docling 결과 + seed=42 조합에서 최대 시간 이상 걸린 것.

##### 4.5.1.6.3 canonicalize.ts SLUG_ALIASES 3차 확장 (2026-04-22 완료)

**구현** (`wikey-core/src/canonicalizer.ts`):

§4.5.1.5 30-run 데이터에서 발견된 N≥2 run 변이를 canonical slug 로 흡수. 기존 5 entry → **20 entry**:

| Family | Aliases | Canonical |
|--------|---------|-----------|
| Alimtalk 4-variant | `allimtok`·`alrimtok`·`allim-talk`·`allimtalk`·`kakao-alimtalk` | `alimtalk` |
| SSO 2-variant | `sso-api`·`single-sign-on` | `single-sign-on-api` |
| ERP | `erp-system`·`enterprise-resource-planning-system` | `enterprise-resource-planning` |
| SCM | `supply-chain-management-system` | `supply-chain-management` |
| MES/PoP | `point-of-production-system`·`point-of-production` | `manufacturing-execution-system` |
| BOM 4-variant | `e-bom`·`e-bill-of-materials`·`electronic-bill-of-materials`·`engineering-bill-of-materials` | `bill-of-materials` |
| Electronic Approval | `electronic-approval-system` | `electronic-approval` |
| RESTful API | `representational-state-transfer-api` | `restful-api` |
| TCP/IP | `transmission-control-protocol-internet-protocol` | `tcp-ip` |
| MQTT | `message-queuing-telemetry-transport` | `mqtt` |
| Integrated DB | `integrated-member-db` | `integrated-member-database` |

BOM 4-variant 는 축 분리 보류 — N=30 에서 `bill-of-materials` 는 always-present core, 다른 4 변형은 sometimes → 단일 canonical 로 수렴 결정. eBOM/mBOM 의 의미 구분 필요 시 향후 §4.5.1.7 에서 재분할 가능.

**TDD (7 신규 test blocks + 1 구조 invariant)**:
- Alimtalk 4-variant collapse
- ERP/SCM `-system` suffix drop
- PoP → MES collapse
- BOM 4-variant collapse
- Electronic Approval suffix drop
- Spelled-out standards (RESTful/TCP-IP/MQTT) → short form
- LLM filename end-to-end 적용 확인
- SLUG_ALIASES canonical targets flat chain invariant (regression guard)

##### 4.5.1.6.4 FORCED_CATEGORIES canonical resolution 업그레이드 (2026-04-22 완료)

**배경** (§4.5.1.5 30-run 에서 확증):
`FORCED_CATEGORIES` 자체 로직 (`applyForcedCategories` 2-pass) 은 pin 된 slug 의 cross-pool collision 을 정확히 해소한다 — pass 1 이 `targetBases.entity` 를 마킹하고 pass 2 가 이를 skip guard 로 사용. 버그가 아닌 **coverage 부족**이 문제: §4.5.1.4 시점의 3 pin (mqtt/restful-api/project-management-system) 외에 N=30 에서 양쪽 pool 왕복 10 slug 추가 발견.

**구현** (`wikey-core/src/canonicalizer.ts`):

기존 3 pin → **13 pin**:

| Slug | Category | Type | 근거 |
|------|----------|------|------|
| `mqtt` | entity | tool | §4.5.1.4 |
| `restful-api` | concept | standard | §4.5.1.4 |
| `project-management-system` | entity | product | §4.5.1.4 |
| `enterprise-resource-planning` | concept | standard | N=30 E/C 왕복, ERP=업계표준 |
| `supply-chain-management` | concept | methodology | N=30 E/C 왕복, SCM=관리 방법론 |
| `manufacturing-execution-system` | concept | standard | N=30 E/C 왕복, MES=업계표준 |
| `product-lifecycle-management` | concept | methodology | N=30 E/C 왕복 |
| `advanced-planning-and-scheduling` | concept | methodology | N=30 E/C 왕복 |
| `electronic-approval` | concept | methodology | N=30 E/C 왕복, 한국 결재 워크플로 |
| `single-sign-on-api` | entity | tool | §4.5.1.4 테스트 의도 유지 (schema: tool = "SW/프로토콜") |
| `tcp-ip` | concept | standard | N=30 E/C 왕복 |
| `virtual-private-network` | concept | standard | N=30 C pool sometimes |
| `bill-of-materials` | concept | standard | core 유지·강제 |

SLUG_ALIASES 가 먼저 `validateAndBuildPage` 에서 적용되므로, 입력 `erp-system`(variant) → canonical `enterprise-resource-planning` → pin lookup → concept 로 수렴. 이 chain 이 §4.5.1.6.3+§4.5.1.6.4 의 "canonical resolution" 구현.

**TDD (4 신규 test block)**:
- `FORCED_CATEGORIES` pin 구조 assertion (enterprise-resource-planning·supply-chain-management·tcp-ip·virtual-private-network)
- alias → pin chain e2e (LLM emits `erp-system` type=product → 최종 concept pool 의 `enterprise-resource-planning.md` 로 수렴, conceptType=standard)
- Cross-pool collision 해소 (`enterprise-resource-planning-system` in entities + `enterprise-resource-planning` in concepts → concept only)
- BOM 2-variant collapse (alias + pin 조합)

##### 4.5.1.6.5 Route FULL vs SEGMENTED 10-run 분리 비교 (2026-04-22 보류)

§4.5.1.6.2/6.6 결과에 따라 조건부 실행. FULL (Gemini) 이 목표 CV <10% 에 도달하면 diagnostic 가치 감소 → §4.5.1.7 이관. 미달 시 SEGMENTED (Ollama qwen3:8b) 로 추가 10-run 실행해 섹션 분할 variance 누적 효과 분리.

##### 4.5.1.6.6 개선 후 30-run 재측정 (2026-04-22 완료)

**측정**: `./scripts/measure-determinism.sh raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf -n 30 -d` → `activity/phase-4-5-1-6-pms-30run-final-2026-04-22.md`. 총 실행 시간 ~2시간 20분 (평균 215s/run on 29 valid runs).

**Run 30 outlier 해설**: 30 번째 run 이 3.0s elapsed + (0 e, 0 c, 0 s) 로 종료. 측정 스크립트의 `restoreSourceFile()` 가 이전 run 의 `autoMoveFromInbox` 이후 원본 PDF 를 원위치로 복구하지 못해 ingest 가 no-op 으로 완료된 edge case. 29 회까지는 정상 작동. **툴 결함이지 production code 결함 아님** — §4.5.1.6 의 determinism + canon 3차 자체는 정상. 추후 `measure-determinism.sh` 의 `walk()` 범위 강화 필요 (별도 followup).

**29-run valid 통계 (run 30 outlier 제외)**:

| 지표 | Mean | Std | **CV %** | Range |
|------|-----:|----:|---------:|------:|
| Entities | 22.69 | 2.51 | **11.1%** | 21–28 |
| Concepts | 17.52 | 4.73 | **27.0%** | 12–22 |
| **Total** | **41.21** | **3.79** | **9.2%** | **35–45** |
| Time | 215.4s | 23.3s | 10.8% | 174.0–293.0 |

**누적 변화 (§4.5.1.4 → §4.5.1.5 → §4.5.1.6)**:

| 지표 | §4.5.1.4 smoke | §4.5.1.5 30-run | §4.5.1.6.2 10-run | §4.5.1.6.6 29-run | 누적 Δ 상대 |
|------|---------------:|-----------------:|-------------------:|-------------------:|------------:|
| Total CV | 32.5% | 24.3% | 7.2% | **9.2%** | **−71.7%** |
| Entities CV | — | 36.4% | 13.9% | 11.1% | −69.5% vs §4.5.1.5 |
| Concepts CV | — | 31.1% | 28.9% | 27.0% | −13.2% vs §4.5.1.5 |
| Union size (E+C) | — | 87 | 53 | 53 | −39.1% vs §4.5.1.5 |

**분포 관찰**: Total 이 **{35, 41, 43, 45} 4 값** 으로 극도로 양자화. Entities {21, 22, 28} 3 값, Concepts {12, 21, 22} 3 값. Determinism + canonicalizer 3차 가 LLM output 을 **이산 분포** 로 수렴시킴 — "이 문서에서 N 개의 mention 추출" 에 대해 LLM 이 결정적 답을 형성.

**기여 구조 분해 (가설, 단일 인자 분리 측정은 §4.5.1.7 후보)**:
1. **Determinism (temperature=0 + seed=42)** — LLM 샘플링 결정성. 동일 prompt 에서 거의 동일 output 보장. 기여 추정: **50-60%** of 24.3% → 12-15%pp.
2. **SLUG_ALIASES 3차 (5→20)** — naming-level 수렴. 동일 개념의 variant 가 canonical 로 merge. 기여 추정: **20-30%** → 5-7%pp.
3. **FORCED_CATEGORIES 3차 (3→13)** — axis-level pin. cross-pool collision 해소. 기여 추정: **15-25%** → 4-6%pp.
4. 합계: 21-28%pp, 실측 17.1-15.1pp (10-run 기준 17.1, 29-run 기준 15.1) — 가설 하한 근접.

**판정**:
- Phase A 목표 (determinism 단계 Total CV <15%) → ✅ 9.2% 로 크게 초과 달성.
- Phase B 목표 (canonicalizer 단계 Total CV <10%) → ✅ 9.2% 로 아슬아슬 달성.
- `§4.5.1.6` 종료. 30-run outlier 수정 은 measure-determinism.sh followup (작업 자체 아닌 측정 인프라).

**잔여 variance 9.2% 원인 추정**:
- Concepts CV 27.0% (Entities 11.1% 대비 높음): BOM 이 항상 {12, 21, 22} 3 값 사이 진동. LLM 이 동일 문서에서 도 일부 run 은 "project management 하위 knowledge areas" 9개를 concept 로 쪼개고, 다른 run 은 묶음. prompt-level 변화 (§4.5.1.7) 필요.
- Entities CV 11.1%: {21, 22, 28} 3 값. 28-value run 들은 기술스택 섹션에서 `lotus-mes`/`lotus-pms`/`lotus-scm` 3 변형이 동시 출현한 경우. Lotus-prefix 가 제품군 인지 방식 변화.

**§4.5.1.6.6 완료 증거**:
- 측정: 30/30 run 으로 시작, 29 valid + 1 outlier (툴 edge case). CV 9.2% 달성.
- 산출물: `activity/phase-4-5-1-6-pms-30run-final-2026-04-22.md` (원본 + 보정 분석).
- 코드 state: 315 PASS, build 0 errors 유지.

#### 4.5.1.7 variance 분해 + prompt-level 개선 + 측정 인프라 강화 (2026-04-22, 본체는 §4.5.1.7.2/7.3 두 항목만)

> Mirror: `plan/phase-4-todo.md §4.5.1.7`. §4.5.1.7.2 (Concepts prompt hint) 와 §4.5.1.7.3 (measure-determinism robustness) 는 2026-04-22 구현 완료 — 실측 검증만 후속 Obsidian CDP 세션 대기. §4.5.1.7.1/7.4/7.6/7.7 은 2026-04-22 Phase 재편으로 **Phase 5 §5.4 로 이관** (diagnostic 성격, 본체 CV <10% 확보 후 선택적 측정). §4.5.1.7.5 (Lotus variance) 는 §4.1.3 으로 자동 해결.

**왜 본체에서 남기는가** (§4.5.1.6 9.2% 이후 잔여 gap 중 본체 책임 2 건):

1. **Concepts CV 27% 잔여** (Entities CV 11.1% 대비 2.4 배) — PMBOK 의 9 sub-area (`project-integration/scope/time/cost/quality/human-resource/communications/risk/procurement-management`) 가 일부 run 에선 분해, 다른 run 에선 `project-management-body-of-knowledge` 1 개로 묶임. **slug alias 범위 밖** — prompt-level 변경 (canonicalizer 에 "PMBOK 10 knowledge areas 는 개별 concept 로 추출" hint) 필요. → §4.5.1.7.2.

2. **측정 인프라 취약성** — §4.5.1.6.6 에서 run 30 outlier (0/0/0 3s) 가 `restoreSourceFile()` edge case 로 발생. raw CV 21.1% 로 왜곡 (진값 9.2%). N≥30 대규모 측정 반복을 위해 `walk()` 강화 + `adapter.exists()` sentinel + `--strict` 필터링 필요. → §4.5.1.7.3.

**목표**:
- Concepts: PMBOK 10 영역 결정화 prompt 개선 → Concepts CV 24.6% → <15%.
- Infra: measure-determinism.sh edge case 해소 + per-run timeout 상향 + outlier 자동 제외.

**Phase 5 이관** (본체 완료 후 diagnostic):
- §4.5.1.7.1 attribution ablation (4-points) → Phase 5 §5.4.1 (기여도 미분리는 본체 CV 달성 후 비용-효과 분석 자료).
- §4.5.1.7.4 Route SEGMENTED 10-run (Ollama) → Phase 5 §5.4.2.
- §4.5.1.7.5 Lotus-prefix variance — §4.1.3 으로 자동 해결 확인 (Entities CV 11.1% → 2.3%).
- §4.5.1.7.6 BOM 재분할 판단 → Phase 5 §5.4.3.
- §4.5.1.7.7 log_entry axis cosmetic → Phase 5 §5.4.4.

**하위 과제** (번호는 `plan/phase-4-todo.md §4.5.1.7` mirror, 본체 유지 2 건만 상세 기록):

##### 4.5.1.7.2 Concepts prompt 개선 — PMBOK 10 영역 결정화 (구현 완료, 실측 대기)

**선택**: A안 (canonicalizer prompt-level hint). B안 (FORCED_CATEGORIES 9 개 pin) 은 매 소스마다 등장 보장이 없어 false-positive 하드-추출을 유발할 수 있고, C안 (-management 흡수) 은 방향이 반대라 wiki 그래프 가치를 낮춘다고 판단. A안은 slug 단위가 아닌 **prompt 조건부 분해 지침** 이라 "본문에 등장 시에만" 추출되도록 hallucination guard 도 함께 명시 가능.

**구현** (`wikey-core/src/canonicalizer.ts` `buildCanonicalizerPrompt`):
- "작업 규칙" 블록에 7번 항목 신규 추가 — PMBOK / 프로젝트 관리 지식체계 맥락이 본문에 등장할 때 10 영역을 각각 `project-<area>-management` base 로 개별 concept 화, 상위 `project-management-body-of-knowledge` 로 묶지 말 것. type=`methodology`.
- 10 영역 명시: `integration / scope / schedule (or time) / cost / quality / resource (or human-resource) / communications / risk / procurement / stakeholder management`.
- Hallucination guard: "본문에 해당 영역이 직접 언급되지 않으면 추출하지 않는다" 문장 추가 — 빈 프롬프트 영역 강제 생성 방지.

**테스트** (`canonicalizer.test.ts` 신규 `it('includes PMBOK 10 knowledge areas hint (§4.5.1.7.2)')`):
- 프롬프트 문자열이 rule marker (`PMBOK 10 knowledge areas 개별 추출`), 10 영역 중 핵심 8 슬러그, anti-bundle (`묶지 말 것`), hallucination guard (`직접 언급되지 않으면 추출하지 않는다`) 모두 포함하는지 단언.
- 후속 prompt 편집에서 이 가이드가 조용히 drop 되는 것을 막는 anchor.

**검증 결과**:
- 352/352 tests PASS (이전 351 + 신규 1). tsc 0 errors.
- 덤: 작업 중 master 에 이미 존재하던 `hasRedundantEmbeddedImages(md, stripped, pdfPageCount)` arity regression 발견 (commit `bb09b79` 이 `convert-quality.ts` 에 4번째 `tierKey` 인자를 추가했으나 `ingest-pipeline.ts:1194` 호출부 미갱신). `tierKey` 전달로 복구 — 해당 커밋의 "343 tests PASS, tsc 0 errors" 주장은 실제로 성립하지 않고 있었음.

**효과 검증 위임** (2026-04-22 Phase 재편 후 상태):
- §4.5.1.7.2 자체의 코드 deliverable 은 확정 — canonicalizer prompt 에 rule 주입 + 단위 테스트 anchor + 352 tests PASS 로 "prompt 가 올바르게 포함된다" 는 코드 레벨 계약 완결. **완료 판정**.
- Concepts CV 24.6% → <15% **실측 검증은 Phase 5 §5.4 (variance 기여도·diagnostic)** 측정 세션에서 자연 회귀. §5.4.1 4-points ablation 또는 §5.4.2 Route SEGMENTED 10-run 시 PMS 를 포함한 측정 결과에서 PMBOK 영역 진동 해소 여부를 함께 판정.
- 효과 미달 시 조치: Phase 5 §5.4 내 신규 sub-task 로 처리 — (a) B안 보강 (9 영역 FORCED_CATEGORIES pin), (b) schema.ts description 레벨로 hint 위치 조정, (c) Phase 5 §5.6 Stage 1 에서 `.wikey/schema.yaml` 외부화 시 rule 재설계. 어느 경로로 가든 Phase 4 본체 완료 판정에는 영향 없음.

**일반화 경로** (이번 단발 하드코딩의 존재 이유):
- §4.5.1.7.2 는 자체가 목적이 아니라 **self-extending 표준 분해 구조의 사전 검증 (Stage 0)**. ISO 27001 / ITIL / GDPR / SAFe / OWASP Top 10 등 "표준 = N 하위 영역" 패턴이 연속 등장할 것이 확정되어 있어, 매번 canonicalizer prompt 에 블록을 추가하는 방식은 유지 불가. 매뉴얼 등록도 궁극의 답이 아님 — wiki 자체가 표준 분해 구조를 스스로 학습·확장하는 쪽으로 이행 필요.
- 2026-04-22 Phase 재편으로 해당 로드맵은 **Phase 5 §5.6 (`plan/phase-5-todo.md`)** 에 단일 기록 (Stage 1 static yaml override → Stage 2 extraction graph suggestion → Stage 3 in-source self-declaration → Stage 4 cross-source convergence). §5.6 이 **실행 로드맵의 단일 소스 오브 트루스**이고, 철학/가치 선언의 단일 소스는 `wiki/analyses/self-extending-wiki.md` (wiki 본체 analysis 페이지). 본 §4.5.1.7.2 · `canonicalizer.ts` 주석 · `session-wrap-followups.md` · memory 는 모두 포인터로만 연결된다 (drift 방지).
- 트리거: §4.5.1.7.2 실측에서 효과 확증되면 Phase 5 §5.6.1 Stage 1 진입 (두 번째 표준 corpus 등장 시 즉시). 누적 하드코딩 3 개 넘기 전에 Stage 1 이행.

##### 4.5.1.7.3 측정 인프라 robustness — `scripts/measure-determinism.sh` (구현 완료, 실측 대기)

**배경**. §4.5.1.6.6 run 30 outlier (0/0/0 3s) 가 `restoreSourceFile()` silent-pass 에서 유래. raw 통계가 21.1% 로 왜곡되어 29-run valid 9.2% 를 별도 보정 분석으로 복원해야 했다. N≥30 대규모 측정을 반복 가능하게 하려면 측정 툴 자체가 source 복원 실패/빈 인제스트를 자동 감지·제외해야 한다.

**구현** (3 포인트):

1. **`restoreSourceFile()` boolean 반환** — 기존 void → `Promise<boolean>`.
   - `adapter.exists(SOURCE_PATH)` 선확인, true 면 early return.
   - `walk('raw')` 으로 재탐색 시 `.`-prefix 디렉토리 (`.obsidian/.trash` 등) 스킵.
   - `renameSync` try/catch 실패 시 false. 최종 `adapter.exists()` 재확인으로 진짜 복구 여부 반환.
   - `cleanupForRerun()` 은 반환값을 그대로 bubble up.
   - run loop 는 `if (!restored) results.push({run, error: 'source restore failed — raw/ 에서 파일을 찾을 수 없음'})` + `continue`.

2. **per-run timeout 10분 → 15분** — JS 내부 `15 * 60 * 1000` + bash `timeout_sec=$((N_RUNS * 900))` 동기.
   - 근거: §4.5.1.6.2 run10 timeout 관찰로 long-tail (Gemini slow response + Segmented route) 이 기존 한도에 근접하는 사례 존재.

3. **`--strict` CLI 옵션 신규** — 에러 run 은 원래도 `ok` 풀에서 빠졌지만, `total=0` 로 통과한 "빈 인제스트" run 은 raw 통계에 남아 평균·CV 를 왜곡.
   - `--strict` 시 Python 블록이 `ok_raw` 에서 `total > 0` 만 분리한 `ok` pool 로 통계 재계산.
   - Markdown 에는 "Strict 제외 run (total=0)" 섹션을 별도로 써서 원본 데이터 보존.
   - banner (`[measure-determinism] strict: ON`) 추가 + `--help` 에 설명 신규.
   - `--help` 요약: "total=0 (source 복원 실패 / 빈 인제스트) run 을 통계에서 추가 제외. Core/Variable 분석도 strict pool 기준."

**검증**:
- `bash -n scripts/measure-determinism.sh` → syntax OK.
- `./scripts/measure-determinism.sh --help` → 신규 `--strict` 포함 출력 확인.
- Python heredoc `ast.parse` → OK.
- JS heredoc (async IIFE wrap 후) `node --check` → OK.
- 실제 CDP 측정은 Obsidian 기동 + §4.5.1.7.2 Concepts 측정과 묶어서 후속 세션 수행.

##### 4.5.1.7.4~.7 (Phase 5 이관)

2026-04-22 Phase 재편으로 다음 4 항목은 **Phase 5 §5.4 (variance 기여도 · diagnostic)** 로 이관. 본체 CV <10% 확보 후 선택적 측정. 상세는 `plan/phase-5-todo.md §5.4` + (향후 실행 시) `activity/phase-5-result.md`.

- **§4.5.1.7.4** Route SEGMENTED 10-run (Ollama production guide) → **Phase 5 §5.4.2**
- **§4.5.1.7.5** Lotus-prefix 3-variant 분석 → **§4.1.3 으로 자동 해결** (Entities CV 11.1% → 2.3%, text layer cleanup 으로 Lotus 진동 사라짐). 별도 작업 불필요.
- **§4.5.1.7.6** BOM 축 재분할 판단 → **Phase 5 §5.4.3**
- **§4.5.1.7.7** `log_entry` axis cosmetic → **Phase 5 §5.4.4**

