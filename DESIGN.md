<!-- generated 2026-05-03 by gemini-2.5-pro (gemini-panel cycle #1, OAuth subscription); reviewed by master -->

# Wikey Design System

Wikey 플러그인을 위한 작고 일관된 디자인 시스템입니다. 이 시스템은 Obsidian의 네이티브 스타일에 의존하면서, Wikey 고유의 UI 요소를 위한 최소한의 토큰을 정의합니다. 목표는 "한 명의 디자이너가 머릿속에 모두 담을 수 있는" 단순함입니다.

## 디자인 원칙

이 디자인 시스템은 `wikey.schema.md`에 명시된 Karpathy의 4가지 핵심 원칙을 따릅니다.

1.  **명시성 (Explicit):** 모든 디자인 결정은 명시적인 토큰으로 정의됩니다. 하드코딩된 값이나 암묵적인 규칙을 최소화하여 AI와 개발자 모두가 시스템의 시각적 언어를 쉽게 이해하고 사용할 수 있도록 합니다.
2.  **데이터 소유권 (Yours):** 시스템은 Obsidian의 핵심 변수를 존중하고 확장합니다. 특정 프레임워크나 외부 라이브러리에 대한 종속성을 만들지 않아 사용자가 자신의 디자인 자산을 완전히 소유할 수 있습니다.
3.  **파일 우선 (File over app):** 모든 토큰은 CSS 변수로 정의되어, CSS라는 범용적인 파일 형식을 통해 관리됩니다. 이는 CLI, 빌드 도구 등 다양한 환경과의 호환성을 보장합니다.
4.  **AI 선택 자유 (BYOAI):** 단순하고 명확한 토큰 기반 시스템은 어떤 LLM 에이전트라도 쉽게 이해하고 적용할 수 있는 안정적인 기반을 제공합니다.

## 디자인 토큰

모든 wikey 토큰은 `--wk-` 접두사를 사용합니다. Obsidian 네이티브 변수가 존재할 경우, `var(--obsidian-variable, var(--wk-fallback))` 형태로 우선 사용하며 호환성을 유지합니다.

### 1. 색상 (Color)

색상 토큰은 기본, 텍스트, 상태, 상호작용 색상으로 나뉩니다. 기존 `styles.css` 파일에서 하드코딩된 값들을 추출하여 토큰으로 표준화했습니다.

#### 기본 (Base)

| 토큰 | 값 | 설명 | 사용처 (styles.css) |
| :--- | :--- | :--- | :--- |
| `--wk-color-primary-bg` | `#1e1e1e` | 기본 배경색 (Fallback) | L2315, L2343, L2373, L2398 |
| `--wk-color-secondary-bg` | `#2a2a2a` | 보조 배경색 (Fallback) | L2481, L2537 |
| `--wk-color-border` | `#3a3a3a` | 테두리 색상 (Fallback) | L2342, L2371, L2433, L2461, L2529, L2539, L2581, L2639, L2646, L2748, L2765, L2785 (+`#444`: L2313, L2396) |
| `--wk-color-hover-bg` | `#333` | 호버 시 배경색 (Fallback) | L2549 |

#### 텍스트 (Text)

| 토큰 | 값 | 설명 | 사용처 (styles.css) |
| :--- | :--- | :--- | :--- |
| `--wk-color-text-normal` | `#ddd` | 일반 텍스트 (Fallback) | L2316, L2399 |
| `--wk-color-text-muted` | `#999` | 흐린 텍스트 (Fallback) | L2341, L2348, L2434, L2462, L2777 |
| `--wk-color-text-on-accent`| `#fff` | 강조색 위 텍스트 (Fallback)| L837, L843, L2328, L2413, L2445, L2474, L2556, L2573 |

#### 상호작용 (Interactive)

| 토큰 | 값 | 설명 | 사용처 (styles.css) |
| :--- | :--- | :--- | :--- |
| `--wk-color-accent` | `#8a5cf5` | 주요 강조색 | L2352, L2379, L2412, L2444, L2473, L2482, L2491, L2550, L2555, L2557, L2596, L2665, L2714, L2771 |
| `--wk-color-accent-alt` | `#4a78c4` | 대체 강조색 (레거시) | L2321, L2327, L2405 (마이그레이션 대상) |

#### 상태 (Status)

| 토큰 | 값 | 설명 | 사용처 (styles.css) |
| :--- | :--- | :--- | :--- |
| `--wk-color-status-success`| `#00c853`| 성공 상태 | L473, L801, L1576, L1649, L1680 (+`#00a848`: L2220) |
| `--wk-color-status-warning`| `#ffab00`| 경고 상태 | L474, L1654, L1675 |
| `--wk-color-status-warning-strong`| `#f57c00` | 강한 경고 (테두리/호버) | L838, L842 |
| `--wk-color-status-error` | `var(--text-error)` | 오류 상태 | (Obsidian 네이티브 변수 사용) |

**통합된 색상:**
*   `--wk-color-status-warning` (`#ffab00`)은 `#d29922` (L755, L756), `#ff9800` (L836), `#f5a500` (L2739)을 대표합니다.
*   `--wk-color-border` (`#3a3a3a`)는 `#444` (L2313, L2396)를 포함합니다.
*   `--wk-color-status-success` (`#00c853`)는 `#00a848` (L2220)을 포함합니다.

### 2. 간격 (Spacing)

4px 기반의 배수 시스템을 사용하여 일관된 간격 체계를 구축합니다.

| 토큰 | 값 | 사용 예시 |
| :--- | :--- | :--- |
| `--wk-spacing-1` | `2px` | 미세 조정 |
| `--wk-spacing-2` | `4px` | 아이콘, 텍스트 간격 |
| `--wk-spacing-3` | `6px` | 컴포넌트 내부 간격 |
| `--wk-spacing-4` | `8px` | 작은 컴포넌트 간 간격 |
| `--wk-spacing-5` | `10px` | 일반적인 컴포넌트 내부 패딩 |
| `--wk-spacing-6` | `12px` | 섹션 내부 패딩 |
| `--wk-spacing-7` | `14px` | 패널, 카드 패딩 |
| `--wk-spacing-8` | `16px` | 큰 섹션 간 간격 |

### 3. 타이포그래피 (Typography)

상대 단위인 `em`을 사용하여 Obsidian의 기본 글꼴 크기 설정에 유연하게 반응합니다.

| 토큰 | 값 | 설명 |
| :--- | :--- | :--- |
| `--wk-font-size-s` | `0.82em` | 작은 텍스트 (경고 배너, 버튼) |
| `--wk-font-size-m` | `0.92em` | 본문 텍스트 (채팅 메시지, 목록) |
| `--wk-font-size-l` | `1em` | 헤더, 제목 |
| `--wk-font-weight-regular` | `400`| 일반 굵기 |
| `--wk-font-weight-medium` | `500` | 중간 굵기 |
| `--wk-font-weight-semibold` | `600`| 세미볼드 굵기 |
| `--wk-font-weight-bold` | `700` | 볼드 굵기 |

#### Font Family

`font-family`는 wikey 자체 토큰을 정의하지 않고 Obsidian 네이티브 변수에 100% 위임합니다. 사용자가 선택한 Obsidian 테마와 글꼴 설정을 그대로 존중하기 위함이며, BYOAI 원칙 (사용자 자산 소유권) 의 시각적 표현입니다.

| 컨텍스트 | 사용 값 | 비고 |
| :--- | :--- | :--- |
| 본문 텍스트 (채팅 메시지, 목록 등) | (정의 없음) | CSS 상속으로 Obsidian 본문 글꼴 사용 |
| UI 인터페이스 텍스트 | `var(--font-interface)` | 헤더·라벨·버튼 텍스트 |
| 코드 / 모노스페이스 영역 | `var(--font-monospace)` | 코드 블록, 토큰 표시, 타이머 등 |
| 폼 요소 (textarea 등) | `inherit` | 부모로부터 상속 |

→ wikey CSS 코드 안에서 `font-family` 를 새로 선언할 때는 위 4 가지 외 다른 값을 쓰지 않습니다.

### 4. 테두리 반경 (Radius)

일관된 테두리 반경 값을 정의하여 통일성 있는 UI를 제공합니다.

| 토큰 | 값 | 사용 예시 |
| :--- | :--- | :--- |
| `--wk-radius-s` | `4px` | 버튼, 인풋, 작은 요소 |
| `--wk-radius-m` | `6px` | 카드, 중간 크기 컨테이너 |
| `--wk-radius-l` | `8px` | 채팅 버블, 패널 |
| `--wk-radius-full`| `9999px`| 원형, 알약 형태 버튼 |

### 5. 모션 (Motion)

UI 요소의 상태 변화를 부드럽게 표현하기 위한 전환 효과입니다.

| 토큰 | 값 | 설명 |
| :--- | :--- | :--- |
| `--wk-motion-duration` | `0.15s` | 빠른 상호작용(호버, 클릭)의 전환 속도 |
| `--wk-motion-easing` | `ease` | 기본 이징 함수 |

## 모달 컴포넌트 표준

Wikey 의 모든 모달 (Ingest flow / Conflict / Reset / Delete impact 등) 은 다음 표준을 따릅니다 (Phase 5 §5.10.3.10 옵션 C 영구 결정).

### 1. 언어 — 모든 text 영어 (한국어/영어 병기 금지)

- 모달 제목, 본문 라벨, 버튼 라벨, placeholder, hint, fallback message — **모두 영어**.
- 사용자 시스템 언어 무관 일관성 우선. (한국어 i18n 은 별 phase 에서 다국어 시스템 도입 시 검토.)
- 버튼 라벨 단일 단어 권장: `Proceed` · `Cancel` · `Approve & Write` · `Back` · `Preserve` · `Overwrite`. 부연 `(discard)` 같은 병기 금지.
- 한국어/영어 병기 (예: `'사용자 수정 보존 (preserve)'`) 금지. 영어 단일 (`'Preserve'`).

### 2. 사이즈 — 적응형 + init 1 회

- `applyModalSize()` 에서 width / height 모두 init 1 회 설정 (예: `760 × 672`, viewport 0.92/0.82 cap).
- `min-height` / `max-height` 절대값 금지 — 사용자 resize 핸들 동작 깨짐.
- 사용자 resize 시 `modalEl.style.height` 갱신 (init 값 override). 갱신값 우선.
- 모든 phase rerender 시 modal 자체 height 변경 X (contents 만 변경) → 깜빡임 차단.

### 3. Layout — 적응형 보장

- modal contentEl: `display: flex; flex-direction: column; height: 100%; max-height: 100%;`
- body (`.wikey-modal-body`): `flex: 1 1 auto; overflow-y: auto;` — 작은 창에서도 contents scroll 가능.
- Button row (`.wikey-modal-button-row-bottom`): `position: sticky; bottom: 0; background: var(--background-primary);` — overflow body 에서도 button 안 가려짐.
- Progress bar / progress group: button row 위에 sticky 또는 `margin-top: auto` (flex spacer) — 항상 button 바로 위에 위치.

### 4. Multi-phase stepper

- 다단계 모달 (Ingest flow 등) 은 stepper UI 로 phase 시각화.
- Stepper labels 와 `progressTotal` 일치 (예: 4-phase = 4 labels, `progressTotal: 4`).
- Phase 전환 시 stepper active label 만 갱신 (modal 크기 그대로).
- 비-md → md 변환 등 phase 별 분기 — stepper 자체는 동일 (label 통일), body message 만 분기 ("Reading source..." vs "Converting PDF → markdown...").

### 5. Stage indicator + progress bar

- `wikey-modal-progress-msg`: `{step}/{total} · {message}` 형식.
- `wikey-modal-progress-pct`: `{N}%`.
- Progress bar fill = `{step / total}` 또는 sub-step interpolation.
- Spinner: 회전 애니메이션 (CSS @keyframes wikey-spin).

### 6. File label (변환 모달 전용)

- `wikey-modal-file-label`: `{original.ext} → {converted.md}` (비-md 만 → 표시).
- md / txt 는 → 표시 없음 (변환 없음).

### 7. Drag / Resize

- Title bar `drag-handle` — modal 위치 이동.
- 우하단 `resize-handle` — 사이즈 조절. min 480 × 360, max viewport 40px 안쪽.
- 사용자 resize 결과 (modalEl.style.height/width) 가 phase 전환 후에도 보존.

### 8. Close 보호

- backdrop click + ESC 차단 (mousedown/click capture).
- Close button (`.modal-close-button`): converting/processing phase 에서 confirm dialog (`'Ingest in progress. Close anyway?'`).

### 9. Body scroll behavior

- 큰 contents (Preview plan list 30+ entries) 시 body `overflow-y: auto` 로 자동 scroll.
- Sticky button row 가 scroll 영역 위에 항상 보임.

### 10. 색상 / 토큰

- `--background-primary` (modal background, sticky button row).
- `--interactive-accent` (file-original, accent button).
- `--text-faint` (file-sep), `--text-muted` (file-converted, hints).
- `--background-modifier-border` (spinner border), `--font-monospace` (file-converted).

### 위반 사례 (영구 등록)

- 2026-05-05 §5.10.3.10 cycle: `min-height: 480px / 560px` 절대값 추가 → 사용자 resize 작아짐 시 progress/button 모달 영역 밖. 정정: min-height 제거 + applyModalSize() init height + button row sticky bottom.
- 2026-05-05 §5.10.3.10 cycle: 모달 한국어 텍스트 (`'활성 스키마: '`, `'생성/업데이트될 페이지'`, `'사용자 수정 보존 (preserve)'`) 잔재. 정정: 모든 user-facing text 영어 일괄 변환.

## 패널 패턴

Wikey 사이드바의 6개 패널은 고유한 레이아웃과 토큰 조합을 가집니다.

### 1. Chat 패널

- **특징:** 사용자와 어시스턴트의 메시지가 번갈아 나타나는 대화 형식의 레이아웃.
- **주요 클래스:** `.wikey-chat-container`, `.wikey-chat-message`, `.wikey-chat-user`, `.wikey-chat-assistant`
- **사용 토큰:**
    - `color`: `--wk-color-text-normal`, `--wk-color-accent` (위키링크)
    - `spacing`: `--wk-spacing-5`, `--wk-spacing-6` (메시지 패딩)
    - `radius`: `--wk-radius-l` (메시지 버블)

### 2. Dashboard 패널

- **특징:** 통계 카드 그리드와 태그 순위 막대 그래프로 구성된 정보 중심 레이아웃.
- **주요 클래스:** `.wikey-dashboard`, `.wikey-dashboard-grid`, `.wikey-dashboard-card`, `.wikey-dashboard-tag-row`
- **사용 토큰:**
    - `color`: `--wk-color-accent`, `--wk-color-text-muted`
    - `spacing`: `--wk-spacing-3`, `--wk-spacing-7` (카드, 섹션 간격)
    - `radius`: `--wk-radius-m` (카드)

### 3. Ingest 패널

- **특징:** 파일 드래그 앤 드롭 영역과 처리 대기 목록을 포함한 파일 인입 워크플로우.
- **주요 클래스:** `.wikey-ingest-panel`, `.wikey-ingest-dropzone`, `.wikey-audit-row` (파일 목록에 재사용)
- **사용 토큰:**
    - `color`: `--wk-color-accent` (드롭존, 버튼), `--wk-color-text-on-accent`
    - `spacing`: `--wk-spacing-8` (드롭존 패딩)
    - `radius`: `--wk-radius-l` (드롭존)

### 4. Audit 패널

- **특징:** 파일 목록, 상태별 필터링 칩, 진행률 표시줄을 갖춘 목록 중심의 인터페이스.
- **주요 클래스:** `.wikey-audit-panel`, `.wikey-audit-summary-row`, `.wikey-audit-stat`, `.wikey-audit-row`
- **사용 토큰:**
    - `color`: `--wk-color-status-success`, `--wk-color-status-warning`, `--wk-color-accent`
    - `spacing`: `--wk-spacing-2`, `--wk-spacing-4` (목록 아이템 내부)
    - `radius`: `--wk-radius-full` (상태 필터링 칩)

### 5. Suggestions 패널

- **특징:** Audit 패널과 유사한 체크박스 목록 기반 레이아웃. 표준 분해 후보를 검토하고 적용.
- **주요 클래스:** `.wikey-suggestions-panel`, `.wikey-suggestion-row`, `.wikey-audit-apply-btn` (재사용)
- **사용 토큰:**
    - `color`: `--wk-color-accent` (Accept 버튼), `--wk-color-border`
    - `spacing`: `--wk-spacing-4`
    - `radius`: `--wk-radius-s` (버튼)

### 6. Help 패널

- **특징:** 마크다운으로 렌더링된 정적인 가이드 문서.
- **주요 클래스:** `.wikey-chat-help`
- **사용 토큰:**
    - `color`: `--wk-color-text-normal`, `--wk-color-accent` (제목)
    - `spacing`: `--wk-spacing-8` (패널 패딩)

## 마이그레이션 계획

`styles.css` 파일을 새로운 디자인 토큰 시스템으로 점진적으로 전환하는 계획입니다.

1.  **`:root` 블록 추가:** `styles.css` 파일 최상단에 모든 `--wk-*` CSS 변수를 정의하는 `:root` 블록을 추가합니다.

    ```css
    :root {
      /* Color Tokens */
      --wk-color-primary-bg: #1e1e1e;
      --wk-color-secondary-bg: #2a2a2a;
      --wk-color-border: #3a3a3a;
      --wk-color-hover-bg: #333;
      --wk-color-text-normal: #ddd;
      --wk-color-text-muted: #999;
      --wk-color-text-on-accent: #fff;
      --wk-color-accent: #8a5cf5;
      --wk-color-accent-alt: #4a78c4; /* Legacy, for replacement */
      --wk-color-status-success: #00c853;
      --wk-color-status-warning: #ffab00;
      --wk-color-status-warning-strong: #f57c00;

      /* Spacing Tokens */
      --wk-spacing-1: 2px;
      --wk-spacing-2: 4px;
      --wk-spacing-3: 6px;
      --wk-spacing-4: 8px;
      --wk-spacing-5: 10px;
      --wk-spacing-6: 12px;
      --wk-spacing-7: 14px;
      --wk-spacing-8: 16px;

      /* Radius Tokens */
      --wk-radius-s: 4px;
      --wk-radius-m: 6px;
      --wk-radius-l: 8px;
      --wk-radius-full: 9999px;
      
      /* Typography & Motion */
      --wk-font-size-m: 0.92em;
      --wk-font-weight-bold: 700;
      --wk-motion-duration: 0.15s;
      --wk-motion-easing: ease;
    }
    ```

2.  **색상 값 교체:** `styles.css` 전체에서 하드코딩된 색상 값(`#8a5cf5`, `#3a3a3a` 등)을 `var(--wk-color-...)` 토큰으로 교체합니다. Obsidian 네이티브 변수를 사용하는 곳은 `var(--interactive-accent, var(--wk-color-accent))`와 같이 fallback을 유지합니다.

3.  **간격 및 반경 값 교체:** `padding`, `margin`, `gap`, `border-radius` 등의 속성 값을 `var(--wk-spacing-...)`, `var(--wk-radius-...)` 토큰으로 교체합니다.

4.  **레거시 색상 통합:** `--wk-color-accent-alt` (`#4a78c4`)를 사용하는 부분을 찾아 `--wk-color-accent`으로 교체하고, 통합된 다른 경고/성공 색상들도 단일 토큰을 사용하도록 수정합니다.

5.  **검토 및 리팩토링:** 모든 하드코딩 값이 토큰으로 교체되었는지 확인하고, 불필요한 스타일 규칙을 정리하여 코드의 일관성과 가독성을 높입니다.
