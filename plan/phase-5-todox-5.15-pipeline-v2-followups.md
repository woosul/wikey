---
phase: 5
section: 5.15
title: Pipeline v2 후속 — UI E2E test 인프라 + PROMOTION_THRESHOLD override + citation 마커 dead code cleanup
status: draft
created: 2026-05-07
updated: 2026-05-07
version: v0 (session 23)
priority: P2 (다음 세션 후보)
---

# Phase 5 §5.15 — Pipeline v2 후속 3 항목

> **상위 문서**: [`plan/phase-5-todo.md`](./phase-5-todo.md) · [`activity/phase-5-result.md`](../activity/phase-5-result.md) · [`docs/wikey-ingest-pipeline-v2.md §15.6`](../docs/wikey-ingest-pipeline-v2.md)
>
> **이슈 출처**: 2026-05-07 session 23 — `docs/wikey-ingest-pipeline-v2.md` 작성 시 §15.4 단점·리스크 + §15.6 v3 후보 로 도출된 3 항목. 사용자가 §5.15 로 정식 등록 결정.
>
> **상태**: **draft v0 / 다음 세션 후보 (P2)**. §5.14 본체 종결 (session 23, commit `8c703fc`) 직후, Phase 5 본체 작업 모두 종결 상태에서 진입.
>
> **3 sub-section 분리**:
> - **§5.15.A** UI E2E test 인프라 — wikey-obsidian 에 vitest + Obsidian API mock + jsdom (큰 작업, 별도 phase 격 가능)
> - **§5.15.B** PROMOTION_THRESHOLD override — `.wikey/promotion-threshold.yaml` 사용자 정의 (작은 작업, UX flexibility)
> - **§5.15.C** citation 마커 dead code cleanup — `attachCitationBacklinks` / `buildCitationButton` 제거 (작은 작업, code hygiene)

---

## 0. 본 §5.15 가 가져올 효과 — 알기 쉽게

세 항목은 *서로 독립* 이지만 모두 **"v2 가 만들었지만 v2 시점에 처리 못 한 잔재"** 를 정리하는 cleanup + flexibility 묶음. 각 항목의 효과를 한 문장으로:

| Sub | 한 문장 효과 | 비유 |
|-----|-------------|------|
| **§5.15.A** | wikey-obsidian UI 코드를 *안전하게* 깊이 분해할 수 있게 한다 | 안전망 없이 외줄타기를 하던 곡예사에게 *안전망* 을 깔아주는 일 |
| **§5.15.B** | PROMOTION_THRESHOLD 를 도메인별로 사용자가 *코드 수정 없이* 조정할 수 있게 한다 | 자동차 시트를 매번 공장에 보내 조절하던 걸 *운전석 레버* 로 바꾸는 일 |
| **§5.15.C** | dead code (호출 안 되는 함수 60+ LOC) 를 정리한다 | 이미 떠난 옛 임차인이 두고 간 가구를 치우는 일 |

### 0.1 §5.15.A 효과 상세 — 안전망의 정체

**현재 상황**: `wikey-obsidian/package.json` 에 `vitest` / `jest` / 기타 test runner 의존성 **0 건**, `test` script **0 건**. UI 코드 (sidebar-chat 2325 LOC, settings-tab 1175 LOC, main.ts 785 LOC, commands.ts 676 LOC) 가 변경되면 회귀 검증 수단은:

| 현재 가용 검증 | 한계 |
|----------------|------|
| `npm run build` | 타입 체크만 — 동작 회귀 검출 불가 |
| `obsidian-cdp` full cycle smoke | 5 패널 render + console 0 error — *전체 smoke* 만 (특정 클로저 로직은 검출 안 됨) |
| 사용자 직접 클릭 | 시간 비용 ↑ + 상황별 reproduction 어려움 |

**§5.14 잔존 4 항목 의도적 유지 결정의 본질** (session 23, `phase-5-todox-5.14 §9`):
- sidebar-chat `renderAuditSection` 의 inner closure (renderList 95 / renderTree 95 / ingest btn click handler 196 LOC) 를 props 객체 기반 helper 로 추출하려면 **closure state 12+ field 가 props interface 로 이동** → unit test 가 없으면 mut state (auditMode/viewMode/searchQuery/treeExpand) 의 setter callback 동작이 회귀해도 즉시 detect 안 됨
- main.ts `handleVaultCreate` extract 시 6 closure state instance field 격상 → vault event 흐름 회귀 detect 안 됨
- settings-tab section split 시 setting 등록 순서·display 회귀 detect 안 됨

**§5.15.A 인프라 구축 후 효과**:

```ts
// 가상 예: sidebar-chat__renderAuditSection.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderAuditSection } from '../sidebar-chat'
import { mockApp, mockVault } from './helpers/obsidian-mock'

describe('renderAuditSection — closure state 추출 후 회귀', () => {
  it('auditMode 변경 시 statMissing 클릭 → list re-render', async () => {
    const { container, plugin } = mockApp({ ... })
    await renderAuditSection(plugin, container)
    container.querySelector('.wikey-audit-stat-warn')!.dispatchEvent(new Event('click'))
    expect(container.querySelector('.wikey-audit-list-row')!.textContent).toContain('missing')
  })
})
```

→ §5.14 잔존 4 항목 모두 **deep split 재평가 + 진행 가능**. 인프라 구축 자체가 본 §5.15.A 의 산출.

**부가 효과**:
- 향후 UI 코드 변경 시 라이브 smoke 시간 ↓ (sidebar-chat 1 변경 → 30분 obsidian-cdp full cycle 대신 5초 vitest)
- closure state 가 lifecycle scoped 하다는 *주장* 을 코드로 *검증* 가능 (캡슐화 정당성 cross-check)
- 사용자 PR 리뷰 시 "회귀 0" 주장의 evidence 가 강해짐

**비용 추정**:
- vitest + jsdom + happy-dom 의존성 추가
- Obsidian API mock layer (App, Vault, TFile, Notice, ItemView, FuzzySuggestModal 등 15+ 인터페이스) — Obsidian 1.7.x API surface 부분 mock
- TS 설정 분리 (test 전용 tsconfig) + esbuild 빌드 영향 0 보장
- **추정 LOC**: mock layer 600~1000 / 초기 test 300~500 / 설정 50~100 = 1000~1600 LOC 신규
- **추정 cycle**: 3~5 cycle (Step A1 인프라 구축 → A2 sidebar-chat 1 함수 cover → A3 main.ts onload cover → A4 §5.14 잔존 4 항목 deep split 재평가)

---

### 0.2 §5.15.B 효과 상세 — 운전석 레버의 정체

**현재 상황**: `wikey-core/src/canonicalizer.ts:291`

```ts
const PROMOTION_THRESHOLD = 2
```

§5.11 v2 의 page promotion gate 핵심 hyperparameter. 1회만 mention 된 고유명사는 페이지로 promote 안 됨 (단순 출처/장소/단편 사실 차단).

**현재 한계**:
- 한 도메인 (예: PMBOK 류 정형 표준) 에 fit 한 threshold=2 가 다른 도메인에서는 false negative 위험
  - 논문 인용에서 1회만 mention 된 *진짜 중요한* 알고리즘 / 인물명 → 차단됨
  - 기술 매뉴얼에서 한 모델명만 1회 등장하지만 그 모델 페이지가 필요한 경우 → 차단됨
- 사용자가 threshold 조정하려면 **canonicalizer.ts 직접 수정 + npm run build + plugin reload** — 비-개발자에게는 사실상 불가

**§5.15.B 도입 후 효과**:

```yaml
# .wikey/promotion-threshold.yaml (사용자 vault 단위 설정)
default: 2

# (옵션) 도메인별 override — sourceFilename 패턴 매칭
patterns:
  - match: ".*\\.pdf$"     # PDF 류 (논문·매뉴얼 가정)
    threshold: 1
  - match: "^paper-.*"     # paper- prefix sources
    threshold: 1
  - match: "^pmbok-.*"     # PMBOK 표준 분해 — 엄격
    threshold: 3
```

또는 더 단순하게 (default 만):

```yaml
# .wikey/promotion-threshold.yaml
threshold: 1   # 모든 mention 페이지화 (단순 출처도 포함)
```

→ 사용자가 자기 vault 의 ingest 패턴에 맞춰 노이즈 vs recall 트레이드오프 조정 가능.

**부가 효과**:
- §5.11 v2 의 false negative 사례 (사용자 raise 시) 를 코드 수정 없이 즉시 대응
- 사용자가 직접 도메인별 wiki noise 정책 설정 → wikey 의 "Yours" 원칙 (사용자 데이터 소유권) 강화
- override 부재 시 default=2 backwards compatible — 기존 wiki 회귀 0

**비용 추정**:
- YAML loader (기존 `loadUserAliases` 패턴 재사용) — 50 LOC
- canonicalizer.ts `applyPromotionGate` 시그니처에 `threshold: number` 추가 — 30 LOC
- 단위 test (default / override 매칭 / pattern match / fallback) — 100 LOC
- **추정 LOC**: 200~300 신규
- **추정 cycle**: 1 cycle (Spec → RED → GREEN → BLUE → live smoke 1 source)

---

### 0.3 §5.15.C 효과 상세 — 옛 가구 정리의 정체

**현재 상황**: `wikey-obsidian/src/sidebar-chat.ts:501~503`

```ts
// 사용자 정책 (2026-05-06 session 20): wikilink 뒤 보조 citation 마커 ([원본] / 📄)
// 자체 폐기. wikilink 만으로 충분. attachCitationBacklinks / buildCitationButton 은
// 호출되지 않음 (코드는 §4.3.2 Part B 의 historical reference 로 보존하지만 dead path).
this.addMessageActions(msgEl, msg.content)
```

`attachCitationBacklinks` (line 515~) 함수 자체는 잔존, 호출 site **0**. `buildCitationButton` 도 동일.

**현재 영향**:
- sidebar-chat.ts 2325 LOC 중 ~60+ LOC 가 dead code (호출 안 됨)
- 향후 refactor 시 dead path 분기 검토 비용 ↑ (이 함수가 활성인지 미활성인지 매번 확인 필요)
- §5.14 BLUE refactor 시 본 dead code 가 historical reference 로 보존됨 (Karpathy Surgical Changes — 본인이 만든 잔재만 정리 원칙)

**§5.15.C cleanup 후 효과**:
- `attachCitationBacklinks` + `buildCitationButton` + 관련 import / type 완전 삭제
- `addMessageActions` 위 historical 주석 압축 또는 제거
- sidebar-chat.ts ~2260 LOC (60+ LOC 감소)
- dead path 검토 비용 0 — codebase 의 "활성 / 비활성" 경계 명확

**부가 효과**:
- §5.14 잔존 4 항목 (`renderAuditSection` deeper split) 진행 시 sidebar-chat.ts 의 *진짜* 활성 코드만 분석 대상 → §5.15.A 인프라 구축 후 deep split 재평가 시 비용 ↓
- v2 ingest pipeline 의 "Q 쿼리 / citation 마커 폐기" 정책이 코드로 완결 — 문서·정책 ↔ 코드 간 drift 0

**비용 추정**:
- `attachCitationBacklinks` (60 LOC) + `buildCitationButton` (~30 LOC) + 관련 historical 주석 정리
- `Citation` 타입 import 가 다른 활성 코드에서 사용되는지 cross-check (활성이면 import 보존, 미사용이면 삭제)
- **추정 LOC**: net -100 (감소만 — 신규 코드 X)
- **추정 cycle**: narrow 1 cycle (코드 직접 삭제 + npm test/build + 라이브 smoke 1 source)

---

## 1. 본질 (왜 이 3 항목을 §5.15 로 묶었는가)

세 항목은 모두 **v2 ingest pipeline 의 단점·잔재로 v15 평가에서 도출**:

| 항목 | v2 평가 위치 | 분류 |
|------|--------------|------|
| §5.15.A UI E2E test 인프라 | `docs/wikey-ingest-pipeline-v2.md §15.4 D` 단점 | **enabler** (자체 가치 + §5.14 잔존 4 항목 deep split unblock) |
| §5.15.B PROMOTION_THRESHOLD override | `docs/wikey-ingest-pipeline-v2.md §15.4 B` 단점 | **flexibility** (사용자 도메인별 정책 강화) |
| §5.15.C citation 마커 dead code | `docs/wikey-ingest-pipeline-v2.md §15.4 C` 단점 | **hygiene** (Karpathy Surgical Changes 원칙) |

서로 *코드 영역 독립* — 동시 또는 순차 진행 모두 가능. **추천 순서: C → B → A** (작은 hygiene 부터 큰 인프라 구축으로). 그러나 사용자 우선순위에 따라 어느 sub-section 부터든 진행 가능.

## 2. Scope

### 2.1 §5.15.A — UI E2E test 인프라

**대상 파일** (test 인프라 신규):
- `wikey-obsidian/package.json` — devDependencies 에 vitest, jsdom (또는 happy-dom), @testing-library/dom 추가
- `wikey-obsidian/vitest.config.ts` — 신규
- `wikey-obsidian/tsconfig.test.json` — 신규 (test 전용 TS 설정)
- `wikey-obsidian/src/__tests__/__mocks__/obsidian.ts` — Obsidian API mock layer (App, Vault, TFile, Notice, ItemView, FuzzySuggestModal, MarkdownRenderer 등)
- `wikey-obsidian/src/__tests__/helpers/` — test fixture / setup helpers
- `wikey-obsidian/src/__tests__/sidebar-chat.test.ts` — 1차 cover 대상 (renderAuditSection 부분)
- `wikey-obsidian/src/__tests__/main.test.ts` — onload + handleVaultCreate
- `.gitignore` — vitest cache / coverage 추가

**대상 파일** (테스트 후 §5.14 잔존 4 항목 deep split 재평가 시):
- `wikey-obsidian/src/sidebar-chat.ts` (renderAuditSection deep split — 12+ closure state → props 객체)
- `wikey-obsidian/src/main.ts` (handleVaultCreate method 추출 — 6 closure state → instance field)
- `wikey-obsidian/src/settings-tab.ts` (section split 재평가 — UI/코드 1:1 mapping 검증 후)
- `wikey-obsidian/src/commands.ts` (runIngest 분해 재평가)

### 2.2 §5.15.B — PROMOTION_THRESHOLD override

**대상 파일**:
- `wikey-core/src/canonicalizer.ts` — `PROMOTION_THRESHOLD` 상수 → `applyPromotionGate(rawPages, sourceBody, userAliases, threshold)` 인자 추가
- `wikey-core/src/promotion-config.ts` — 신규 (`loadPromotionThreshold(basePath, sourceFilename): Promise<number>`)
- `wikey-core/src/ingest-pipeline.ts` — `canonicalizeAndAssembleParsed` 가 threshold 인자 전달 (`canonicalize` 호출 chain)
- `wikey-core/src/__tests__/canonicalizer.test.ts` — threshold=1 / 2 / 3 case 추가
- `wikey-core/src/__tests__/promotion-config.test.ts` — 신규 (default / pattern match / fallback)
- `.wikey/promotion-threshold.yaml.example` — 신규 (사용자 가이드)

### 2.3 §5.15.C — citation 마커 dead code cleanup

**대상 파일**:
- `wikey-obsidian/src/sidebar-chat.ts` — `attachCitationBacklinks` (line 515~) + `buildCitationButton` (있으면) 함수 삭제 + 관련 historical 주석 정리
- `wikey-obsidian/src/sidebar-chat.ts` import 부분 — `Citation` 타입이 다른 활성 코드에서 사용되는지 cross-check

## 3. AC (Acceptance Criteria)

### §5.15.A — UI E2E test 인프라

| AC | 내용 | 검증 |
|----|------|------|
| AC-A1 | `npm test` 실행 가능 (wikey-obsidian) | exit 0 |
| AC-A2 | Obsidian API mock layer 가 App / Vault / TFile / Notice / ItemView 최소 5 인터페이스 cover | 단위 test PASS |
| AC-A3 | sidebar-chat.ts `renderAuditSection` 의 audit fetch + render 흐름 1+ test PASS | mock fixture 기반 |
| AC-A4 | main.ts `handleVaultCreate` (옵션) — vault create event → autoIngest queue / bypass detection 분기 1+ test PASS | mock vault |
| AC-A5 | esbuild 빌드 영향 0 — `npm run build` 회귀 0 | exit 0 |
| AC-A6 | (옵션) §5.14 잔존 4 항목 중 1+ deep split 안전 진행 + 회귀 0 | npm test PASS |

### §5.15.B — PROMOTION_THRESHOLD override

| AC | 내용 | 검증 |
|----|------|------|
| AC-B1 | `.wikey/promotion-threshold.yaml` 부재 시 default=2 (backwards compatible) | unit test |
| AC-B2 | `threshold: 1` 설정 시 `applyPromotionGate` 가 1회 mention 도 allowed | unit test |
| AC-B3 | `threshold: 3` 설정 시 2회 mention 도 drop | unit test |
| AC-B4 | (옵션) `patterns:` 배열 매칭 — sourceFilename regex match → 도메인별 override | unit test |
| AC-B5 | YAML parse 실패 / 잘못된 schema → default fallback + warn log | unit test |
| AC-B6 | 라이브 smoke 1 source — `.wikey/promotion-threshold.yaml` 만들고 ingest → dropped sample console log 가 새 threshold 반영 | obsidian-cdp full cycle |

### §5.15.C — citation 마커 dead code cleanup

| AC | 내용 | 검증 |
|----|------|------|
| AC-C1 | `attachCitationBacklinks` 함수 정의 / import / 호출 0 | grep `attachCitationBacklinks` → 0 result |
| AC-C2 | `buildCitationButton` 함수 정의 / import / 호출 0 (존재 시) | grep `buildCitationButton` → 0 result |
| AC-C3 | `Citation` 타입 import 가 다른 활성 코드에서 사용되는지 cross-check + 미사용 시 import 정리 | grep `Citation` → 활성 코드만 매치 |
| AC-C4 | sidebar-chat.ts LOC 60+ 감소 | wc -l |
| AC-C5 | npm test / build / validate-wiki 회귀 0 | exit 0 |
| AC-C6 | 라이브 smoke 1 source — chat 응답에 citation footer (`원본:` line) 정상 표시, 마커 (`[원본]` / 📄) 부재 | obsidian-cdp |

## 4. 진행 흐름 — SDD+TDD 5단계 with Phase 3a/3b 분리

### 4.1 §5.15.A 진행 흐름 (3~5 cycle)

```
Phase 0 (cycle 1): codex Mode D Panel — vitest + obsidian mock 인프라 plan 검증
Phase 1 (cycle 1): TDD RED — Obsidian mock layer 의 5 인터페이스 minimum test
Phase 2 (cycle 1): TDD GREEN — mock layer 구현 + 1+ sidebar-chat test PASS
Phase 3a: 회귀 (npm test wikey-core 635 PASS / wikey-obsidian npm test 신규)
Phase 3b: BLUE refactor — mock layer 의 의도적 단순화 / DRY
Phase 4: 라이브 smoke (sidebar-chat 5 패널 모두 render 회귀 0)
Phase 5: codex post-impl
Phase 6: master verdict + commit + push + result 문서

(cycle 2~5): §5.14 잔존 4 항목 deep split 재평가 + 진행
```

### 4.2 §5.15.B 진행 흐름 (1 cycle)

```
Phase 0: codex Mode D Panel — promotion-config plan 검증
Phase 1: TDD RED — loadPromotionThreshold default / override / pattern match
Phase 2: TDD GREEN — promotion-config.ts 구현 + canonicalizer 시그니처 chain
Phase 3a: 회귀 (635+ PASS)
Phase 3b: BLUE refactor (시그니처 chain 일관성)
Phase 4: 라이브 smoke (1 source ingest with .wikey/promotion-threshold.yaml)
Phase 5: codex post-impl
Phase 6: master verdict + commit + push + result 문서
```

### 4.3 §5.15.C 진행 흐름 (narrow 1 cycle)

```
Phase 0 (skip): plan 단순 — codex 검증 생략 가능 (사용자 명시 시만)
Phase 1: dead code cleanup 직접 진행 (TDD 새 test X — 기존 test 가 회귀 안전망)
Phase 2: 회귀 (npm test / build / validate-wiki PASS)
Phase 3: 라이브 smoke (chat 응답 citation footer 정상)
Phase 4: codex post-impl (옵션)
Phase 5: master verdict + commit + push + result 문서
```

## 5. Karpathy 4원칙 적용

- **Think Before Coding**:
  - §5.15.A: vitest vs jest 선택 / jsdom vs happy-dom / mock layer 범위 (5 vs 15 인터페이스) — 옵션 명시 후 사용자 결정
  - §5.15.B: YAML schema 결정 (default 만 vs default+patterns) — 단순 시작 (default 만) → 필요 시 patterns 확장
  - §5.15.C: `Citation` 타입 import 살아있는지 cross-check 후 정리
- **Simplicity First**:
  - §5.15.A: mock layer 는 *시작 minimum 5 인터페이스* 만 — 향후 test 추가 시 점진 확장. 처음부터 15 인터페이스 mock 시 over-engineering
  - §5.15.B: YAML schema 는 default-only 부터 시작 (`threshold: N`) — patterns 는 사용자 raise 시 확장
  - §5.15.C: 함수 + import 만 삭제. 인접 코드 "정리" 금지 (Surgical Changes)
- **Surgical Changes**:
  - §5.15.A: 기존 ts 파일 변경 없이 `__tests__/` 하위만 신규
  - §5.15.B: canonicalizer 의 `applyPromotionGate` 시그니처 1 인자 추가만
  - §5.15.C: dead 함수 삭제 + 호출 site 0 확증만, 활성 코드 손대지 않음
- **Goal-Driven**:
  - §5.15.A: AC-A1 (npm test 가능) + AC-A3 (1+ test PASS) 검증 가능 metric
  - §5.15.B: AC-B1~B6 정량 case 명시
  - §5.15.C: AC-C1~C6 정량 grep 결과

## 6. 진행 우선순위

**다음 세션 시작 시 master 가 사용자에게 옵션 제시 후 결정**:

| 옵션 | 추천 순서 | 근거 |
|------|----------|------|
| (1) **C 만 narrow** | 빠른 cleanup 1 cycle | code hygiene 즉시 완료, 다음 본격 작업 진행 환경 정리 |
| (2) **C + B 묶음** | 2 cycle | 작은 cleanup + UX flexibility 동시 — 둘 다 narrow scope |
| (3) **A 단독 (P2 enabler)** | 3~5 cycle | §5.14 잔존 4 항목 deep split unblock — 큰 작업이지만 가장 가치 ↑ |
| (4) **C → B → A 순차 진행** ★ | 5~7 cycle 합 | 작은 것 먼저 마무리하면서 점진 진입 — 추천 |
| (5) **§5.15 미진행 → Phase 6 진입** | 0 cycle | Phase 5 본체 종결 (§5.14) 충족 확증, 웹 환경 시작 |

**master 추천 = 옵션 (4) C → B → A 순차** — Karpathy Simplicity First (작은 것 먼저) + Goal-Driven (각 cycle 독립 verifiable). 단, 사용자가 옵션 (3) UI E2E 인프라를 우선 선택해도 정당.

---

## 7. AC 7-anchor 검증 (master 자기 1차 검증 의무)

본 plan v0 은 신규 작성 — 7-anchor (rules.md §10) 적용:

| # | Anchor | 검증 |
|---|--------|------|
| (a) | 시그니처 일관성 | `applyPromotionGate(... threshold)` 의 caller chain 일관 — AC-B1~B5 |
| (b) | state/data 표 형식 | `.wikey/promotion-threshold.yaml` schema 명시 (§0.2) |
| (c) | 분기 코드 | `loadPromotionThreshold` 의 fallback / pattern match 분기 — AC-B5 |
| (d) | AC test 매핑 | AC-A1~A6 / AC-B1~B6 / AC-C1~C6 모두 검증 명시 |
| (e) | self-check drift | (本 v0 신규 — drift 0 자명) |
| (f) | footer + 변경 이력 + cycle 번호 | header v0 / version 이력 1 줄 |
| (g) | 코드 ↔ test exact phrase | `attachCitationBacklinks` / `buildCitationButton` grep 패턴 명시 (AC-C1/C2) |

→ 7-anchor 통과. codex 송부 시점 (실제 진행 cycle 1) 에 master 1차 grep 재검증 의무.

---

## 8. 메모

- 본 §5.15 는 **draft v0**. 착수 직전 v1 으로 갱신 (sub-section AC 구체화 + 옵션 결정 + scope final).
- §5.14 본체 종결 (session 23, commit `8c703fc`) 직후 Phase 5 본체 작업 모두 종결 상태 — 본 §5.15 는 *follow-up flexibility / hygiene* 성격.
- §5.15.A 가 §5.14 잔존 4 항목 deep split 의 enabler — A 진행 후 §5.14 잔존 결정 재평가 가능 (현재 의도적 유지).
- §5.15.B 의 PROMOTION_THRESHOLD override 는 §5.11 v2 paradigm (의미·관련도 promotion) 의 사용자 정의 layer — paradigm 변경 X.
- §5.15.C 는 Karpathy Surgical Changes 의 *지연된 cleanup* — 사용자 정책 (2026-05-06 session 20) 으로 폐기됐지만 §5.14 BLUE cycle 시점에 surgical 원칙으로 보존됐던 dead code 의 완결 정리.

---

## 9. 효과 요약 — 한 눈에

| Sub | 한 줄 효과 | 사용자 체감 변화 |
|-----|-----------|------------------|
| **§5.15.A** | UI 코드 변경 시 회귀 detect 5초 (vitest) — 30분 (라이브 smoke) → 360x 단축 | 향후 wikey-obsidian PR 의 안전망 ↑ + §5.14 잔존 4 항목 deep split unblock |
| **§5.15.B** | promotion threshold 코드 수정 (15 분) → YAML 1 줄 편집 (5 초) → 180x 단축 | 도메인별 wiki noise 정책 사용자 통제 |
| **§5.15.C** | sidebar-chat.ts -60 LOC, dead path 검토 비용 0 | codebase 정리 + 향후 refactor 시 *진짜* 활성 코드만 분석 |
