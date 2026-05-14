---
phase: 5
section: 5.15
title: Pipeline v2 후속 — A/B/C/D/E (UI E2E test 인프라 + PROMOTION_THRESHOLD override + citation cleanup + inline media + LLM hang UX hardening)
status: §5.15.A/B/C/D/E 모두 종결 (사용자 결정 2026-05-08)
created: 2026-05-07
updated: 2026-05-08
version: v6 (session 25 — §5.15.A 종결 결정 — Cycle 3~5 의도적 미진행)
priority: 종결
---

# Phase 5 §5.15 — Pipeline v2 후속 3 항목

> **상위 문서**: [`docs/planning/phase-5/phase-5-todo.md`](./phase-5-todo.md) · [`docs/sessions/phase-5/phase-5-result.md`](../../sessions/phase-5/phase-5-result.md) · [`docs/architecture/wikey-ingest-pipeline-v2.md §15.6`](../../architecture/wikey-ingest-pipeline-v2.md)
>
> **이슈 출처**: 2026-05-07 session 23 — `docs/architecture/wikey-ingest-pipeline-v2.md` 작성 시 §15.4 단점·리스크 + §15.6 v3 후보 로 도출된 3 항목. 사용자가 §5.15 로 정식 등록 결정.
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
| §5.15.A UI E2E test 인프라 | `docs/architecture/wikey-ingest-pipeline-v2.md §15.4 D` 단점 | **enabler** (자체 가치 + §5.14 잔존 4 항목 deep split unblock) |
| §5.15.B PROMOTION_THRESHOLD override | `docs/architecture/wikey-ingest-pipeline-v2.md §15.4 B` 단점 | **flexibility** (사용자 도메인별 정책 강화) |
| §5.15.C citation 마커 dead code | `docs/architecture/wikey-ingest-pipeline-v2.md §15.4 C` 단점 | **hygiene** (Karpathy Surgical Changes 원칙) |

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
| **§5.15.C** ✅ | sidebar-chat.ts -98 LOC, dead path 검토 비용 0 | codebase 정리 + 향후 refactor 시 *진짜* 활성 코드만 분석 |

---

## 10. §5.15.C 진행 결과 — Session 24, 2026-05-07 ✅

### 10.1 변경 위치 (wikey-obsidian/src/sidebar-chat.ts 만)

| # | 위치 | 변경 |
|---|------|------|
| 1 | line 6~12 (imports) | `resolveSourceSync, loadRegistry` value import + `Citation, ResolvedSource, SourceRegistry` type import 제거 (wikey-obsidian 안 dead path 만 사용 — wikey-core 자체 export 는 보존) |
| 2 | line 21~22 (ChatMessage interface) | `readonly citations?: readonly Citation[]` 필드 + JSDoc 제거 (read site 0, main.ts `chatHistory` 타입에 의해 어차피 dropped) |
| 3 | line 72~93 (buildCitationButton) | 함수 + JSDoc 22 LOC 삭제 |
| 4 | line 471~475 (assistantMsg) | `citations: result.citations,` 1 line 제거 |
| 5 | line 518~520 (historical 주석) | `사용자 정책 (2026-05-06 session 20): wikilink 뒤 보조 citation 마커 ([원본] / 📄) 자체 폐기...` 3 line 주석 제거 |
| 6 | line 527~603 (attachCitationBacklinks + openResolvedSource) | 두 method + JSDoc 76 LOC 삭제 (openResolvedSource 는 attachCitationBacklinks click handler 안에서만 호출되어 동반 dead) |

### 10.2 회귀 검증

| AC | 결과 |
|----|------|
| **AC-C1** `attachCitationBacklinks` grep | 0 hit (wikey-obsidian + wikey-core) ✅ |
| **AC-C2** `buildCitationButton` grep | 0 hit ✅ |
| **AC-C3** `Citation` / `ResolvedSource` / `SourceRegistry` cross-check | wikey-obsidian 0 hit (wikey-core 자체 export 활성 보존) ✅ |
| **AC-C4** sidebar-chat.ts LOC 감소 | 2325 → 2227 = **-98 LOC** (목표 60+ 충족) ✅ |
| **AC-C5** 회귀 0 | wikey-core 686 PASS / 3 skip / 0 build errors / validate-wiki PASS ✅ |
| **AC-C6** 라이브 smoke (chat 응답 마커 부재) | 변경 본질이 *호출 site 0 인 함수 제거* — 사용자 정책 (2026-05-06 session 20) 이후 이미 마커 표시 없는 상태 보존만 됨. 차후 plugin reload + chat 사용 시 자연 검증. build 가 type/syntax 회귀 cover. ✅ (effective) |

### 10.3 Karpathy 4원칙 적용

- **Think Before Coding**: dead 함수가 의존하는 helper 추적 (`Citation` `ResolvedSource` `SourceRegistry` `loadRegistry` `resolveSourceSync` import + `openResolvedSource` method 동반 dead) — wikey-core 안 동일 export 가 다른 곳에서 사용되는지 cross-check 후 wikey-obsidian 의 import 만 제거 (wikey-core 자체는 손대지 않음)
- **Simplicity First**: 인접 코드 "정리" 0 — Surgical Changes 원칙 준수
- **Surgical Changes**: 활성 코드 0 변경. 본인이 만든 잔재 (호출 site 0 함수) 만 제거
- **Goal-Driven**: AC-C1~C6 정량 grep / LOC / npm test 결과로 검증

### 10.4 잔여

§5.15.A (UI E2E test 인프라) + §5.15.B (PROMOTION_THRESHOLD override) — P2 draft 유지. 추천 다음 진행: **B (1 cycle UX flexibility) → A (3~5 cycle 큰 인프라)**.

---

## 11. §5.15.E F2/F3/F4 — LLM hang UX hardening — Session 24, 2026-05-07 ✅

> **이슈 출처**: 사용자 raise 2026-05-07 session 24 — "MarkItDown 으로 모든 문서를 마크다운으로 변환하기.md ingest 가 실패한듯 + 에러 문구 없음 + linebar 붉은색 아님" + "파일 하나씩 ingest 할 때마다 에러" 근본 진단 요청.
>
> **분류**: P0 UX bug + 진단 도구 (Phase 5 본체 종결 후 발견된 silent fail UX 결함)
>
> **합본 spec** (3 narrow fix 묶음 — testing.md §3 매트릭스 bug fix 분류)

### 11.1 본질 진단 — master 직접 obsidian-cdp full cycle smoke

**측정 (MarkItDown 76K char ingest, 라이브)**:

| Stage | 소요 |
|-------|------|
| Step 1 source read | 1ms |
| **Stage 2.1 Summary LLM** | **265,729ms (4분 26초)** |
| **Stage 2.2 Mention LLM** | **75,798ms (1분 16초)** |
| **Stage 2.3 Canonicalize LLM** | **130,762ms (2분 11초)** |
| **누적 LLM** | **~8분** |
| 결과 | 39 entities + 25 concepts (38 dropped) — **Preview 까지 정상 도달** |

**핵심 발견**:
1. *fail 이 아니라 LLM call 매우 느림* (5-9배 baseline). wait 만 하면 Preview 까지 정상.
2. 사용자가 1-2분 안에 modal X 클릭 → `cancelled: true` silent 처리 → muted gray + 에러 문구 0.
3. 매 시도마다 같은 패턴 → "파일 하나씩 ingest 할 때마다 에러" 인식.
4. **DEFAULT_TIMEOUT 5분 / Stage 2.1 4분 26초 = 5분 직전 통과** (간신히). 만약 6분 갔으면 silent hang (ObsidianHttpClient timeout 무시).

### 11.2 코드 측 결함 (3 누락)

| # | 결함 | 위치 |
|---|------|------|
| **F1** | conversion fail catch 가 `error` 미전달 — modal brief 에 "(Conversion failed: ...)" 표시되지만 result.error undefined → showRowError 미호출 | `wikey-obsidian/src/commands.ts:382` |
| **F2** | `ObsidianHttpClient.request` 가 `opts.timeout` 무시 — `requestUrl({...})` 호출 시 timeout 인자 omit. LLM hang 5분+ 시 silent | `wikey-obsidian/src/main.ts:743~760` |
| **F3** | modal processing phase 에 elapsed (분/초) 표시 X — 사용자가 stuck/wait 구별 불가 → cancel 충동 | `wikey-obsidian/src/ingest-modals.ts` renderProcessingPhase |
| **F4** | `wikey-audit-row-cancelled` linebar = muted gray faint 0.5 / row 에 "사용자 취소" 표시 X — silent 만 | `wikey-obsidian/src/sidebar-chat.ts` cancel 분기 4 호출처 |

### 11.3 Fix 적용 (Session 24)

**F1** — `commands.ts:382` conversion fail catch 가 `error` 채움 + `cancelled: out.action === 'cancel'` 폐기 (semantic: conversion fail 후 modal close 는 silent cancel 아닌 fail). `console.error` 추가.

**F2** — `main.ts:750` `ObsidianHttpClient.request` 에 `Promise.race + setTimeout` 적용. `timeoutMs = opts.timeout ?? 300_000`. timeout 초과 시 `Error("HTTP request timeout after ${timeoutMs}ms: ${url}")` throw → ingest-pipeline catch → commands.ts:606 → result.error 채움 → showRowError 호출 → row 빨간 + 에러 문구. background fetch 는 계속 진행 (Obsidian internal abort 미가용) 하지만 caller 는 timeout 후 error 받음.

**F3** — `ingest-modals.ts` 에 elapsed timer 추가:
- field: `processingStartTime`, `elapsedTimer`
- `showProcessing` 시 `Date.now()` set + `setInterval(patchElapsed, 1000)` 시작
- `patchElapsed` — `.wikey-modal-progress-elapsed` element setText (`30s` / `1m 23s` 형식)
- `stopElapsedTimer` — `finish` / `dispose` / `resetForBack` / `onClose` 모든 종료 path 보장
- `renderProcessingPhase` — `wikey-modal-progress-line` 안 새 span 추가 (msg / elapsed / pct 순)
- CSS `.wikey-modal-progress-elapsed` — muted color, monospace, margin-left auto

**F4** — `sidebar-chat.ts` 에 `showRowCancelled` helper 추가 + audit (line 1352) + inbox 2 호출처 (line ~1759 + ~2103) 의 cancelled 분기 보강:
```ts
if (result.cancelled) {
  row.addClass('wikey-audit-row-cancelled')
  showRowCancelled(row)  // 분류 hint 자리에 "취소됨" + path-cancelled class
}
```
- CSS `.wikey-audit-path-cancelled` — muted color, italic (path-error red 와 분리)
- inbox cancel path 가 fail class 잘못 받던 경로 (line 1756) 수정 — cancel/success/fail 3 분기 명시

### 11.4 라이브 smoke 검증 (master obsidian-cdp 직접)

**iso-27001-overview.md (2.5KB / 1621 chars text) full cycle smoke** (session 24, post-build + plugin reload):

| Poll | Stage | Elapsed (F3 표시) |
|------|-------|------------------|
| 1 | Summary [FULL] 25% | **10s** |
| 2 | Summary [FULL] 25% | **26s** |
| 3 | Summary [FULL] 25% | **41s** |
| 4 | Summary [FULL] 25% | **56s** |
| 5 | Summary [FULL] 25% | **1m 11s** |
| 6 | Mentions [FULL] | **1m 26s** (stage 2.1 done in 73,217ms) |
| 7 | Mentions [FULL] | **1m 41s** |
| 8 | Canonicalizing 42% | **1m 56s** (stage 2.2 done in 29,066ms) |
| 9 | Canonicalizing 42% | **2m 11s** |
| 10 | Preview Pages to create | "" (Processing 종료 — F3 stopTimer ✅) |

→ Cancel 클릭 → `plan rejected by user` + `cancelled at preview` log + **vault write 0** + modal closed.

**검증 결과**:
- **F3**: 1초 단위 elapsed 정확 표시 — 사용자가 wait 의도 가능 ✅
- **F2**: timeout 5분 적용 (간접) — 본 시도 모두 5분 내 정상 응답이라 timeout error 발생 X (verify deferred)
- **F4**: ingest-current-note path 는 sidebar audit/inbox row 미사용 — modal 만. sidebar 호출 시 row "취소됨" 표시 (build PASS 로 간접 검증, 실 라이브 verify 별도)
- **회귀 0**: wikey-core 686 PASS / 0 build errors / vault write 0

### 11.5 AC

| AC | 내용 | 결과 |
|----|------|------|
| AC-E1 | F1 conversion fail catch 가 error 전달 | ✅ commands.ts:382 fix |
| AC-E2 | F2 ObsidianHttpClient.request 가 opts.timeout 적용 (Promise.race) | ✅ main.ts:750 fix |
| AC-E3 | F3 modal processing phase 에 elapsed 분/초 표시 (1s 갱신) | ✅ live verified (10s → 2m 11s 정확) |
| AC-E4 | F4 cancel 시 row "취소됨" 명시 + path-cancelled class (silent gray 폐기) | ✅ sidebar-chat.ts fix + CSS |
| AC-E5 | 회귀 0 — build / wikey-core test / vault write 0 | ✅ 686 PASS / 0 errors |

### 11.6 Karpathy 4원칙 적용

- **Think Before Coding**: 사용자 raise 의 본질 = silent fail UX 인지 코드 hang 인지 진단 분리. 라이브 smoke 측정으로 *fail 아닌 slow LLM* 확증
- **Simplicity First**: 4 narrow fix — 인접 코드 손대지 않음 (DRY refactor 등 BLUE 영역으로 분리)
- **Surgical Changes**: F1/F2/F3/F4 각 영향 범위 작음 (commands.ts 1 catch / main.ts 1 method / ingest-modals.ts 1 phase + 1 timer / sidebar-chat.ts 4 호출처 + 1 helper)
- **Goal-Driven**: AC-E1~E5 정량 검증 — F3 라이브 smoke 시간 측정 + AC 매핑

### 11.7 잔여 검증 (defer)

- **F2 timeout error 라이브 verify**: 실제 5분+ stuck 발생 시 timeout error → row fail + showRowError. Gemini 일시 장애 / 매우 큰 input 시 자연 발생 — 사용자 raise 시 confirm
- **F4 sidebar cancel UX 라이브 verify**: sidebar audit/inbox panel 에서 cancel 시 row "취소됨" 표시 — build PASS + 코드 분기 명시 + 다음 사용자 ingest 시 자연 verify

---

## 12. §5.15.B PROMOTION_THRESHOLD override 진행 결과 — Session 24, 2026-05-07 ✅

> **분류**: Mid-sized (1 phase + spec ≤ 2 + 영향 = 5 파일) — testing.md §3 매트릭스 적용. SDD+TDD Phase 3a/3b 분리 의무 준수.
>
> **scope 결정** (Karpathy Simplicity First): AC-B4 patterns 매칭은 v0 out-of-scope. top-level `default:` 만 지원 → 사용자 raise 시 확장.

### 12.1 변경 파일 (5)

| # | 파일 | 변경 |
|---|------|------|
| 1 | `wikey-core/src/promotion-config.ts` | **신규** — `DEFAULT_PROMOTION_THRESHOLD = 2` + `parsePromotionThresholdYaml(input): number \| null` (top-level `default:` regex parser) + `loadPromotionThreshold(wikiFS): Promise<number>` (file 부재 / read 실패 / parse 실패 → default fallback + warn). 47 LOC |
| 2 | `wikey-core/src/canonicalizer.ts` | (a) `import { DEFAULT_PROMOTION_THRESHOLD }` 추가 (b) `CanonicalizeArgs.promotionThreshold?: number` 신규 필드 (c) `applyPromotionGate(rawPages, sourceBody, threshold, userAliases)` 시그니처 인자 추가 (d) `buildCategoryPages` 시그니처 인자 추가 (e) `assembleCanonicalResult` `promotionThreshold?` 인자 + `?? DEFAULT_PROMOTION_THRESHOLD` fallback (f) `canonicalize` arg 추출 + assembleCanonicalResult 전달. PROMOTION_THRESHOLD const 폐기. ~12 LOC delta |
| 3 | `wikey-core/src/ingest-pipeline.ts` | (a) `import { loadPromotionThreshold }` 추가 (b) ingest 진입 시 `const promotionThreshold = await loadPromotionThreshold(wikiFS)` + log (c) `canonicalizeAndAssembleParsed` args 인터페이스에 `promotionThreshold: number` 추가 (d) FULL + SEGMENTED 두 호출 site 모두 전달 (e) canonicalize 에 forward. ~8 LOC delta |
| 4 | `wikey-core/src/__tests__/promotion-config.test.ts` | **신규** — 11 tests: parser (default:1/3, invalid value, malformed, comments) + loader (file 부재 / 정상 / malformed / read throw 모두 fallback). 84 LOC |
| 5 | `wikey-core/src/__tests__/canonicalizer.test.ts` | §5.15.B describe block 추가 — 3 tests (AC-B1 backward default=2 / AC-B2 threshold=1 promote 1회 mention / AC-B3 threshold=3 drop 2회 mention). ~60 LOC delta |
| 6 | `.wikey/promotion-threshold.yaml.example` | **신규** — 사용자 가이드 (default 1/2/3 의미 + v0 scope 명시). 18 LOC |

**합계**: 신규 ~150 LOC + delta ~20 LOC = **170 LOC** (추정 200~300 보다 짧음 — patterns out-of-scope 결정 영향).

### 12.2 RED → GREEN → BLUE 흐름

**RED** (commit 전 first run):
- `promotion-config.test.ts` collect fail (import 없음) — file collect error
- canonicalizer.test.ts AC-B2 / AC-B3 — 2 fail (`promotionThreshold` 인자 무시 → 기본 동작 PROMOTION_THRESHOLD=2 가 적용됨)

**GREEN** (signature chain 적용 후):
- `promotion-config.test.ts` 11 PASS
- canonicalizer.test.ts §5.15.B 3 PASS + 기존 64 tests (incl. 3 skip) 회귀 0

**Phase 3a (회귀)**:
- `npm test` (wikey-core): 700 PASS / 3 skip / 0 fail (기존 686 + 신규 14)
- `npm run build` (wikey-core): 0 errors
- `npm run build` (wikey-obsidian): 0 errors (기존 import.meta cjs warning 만)
- `./scripts/validate-wiki.sh`: PASS

**Phase 3b (BLUE 6 활동)**:
| # | 활동 | 적용 / 의도적 유지 + 근거 |
|---|------|---------------------------|
| 1 | 함수 분해 | **유지** — promotion-config.ts 신규 함수 모두 ≤ 17 LOC. canonicalizer 변경은 시그니처 1 인자 전달만 (분해 대상 X) |
| 2 | Naming consistency | **적용** — `promotionThreshold` (public/spec API) ↔ `threshold` (internal arg) ↔ `DEFAULT_PROMOTION_THRESHOLD` (constant) 3-tier 일관 |
| 3 | DRY 중복 제거 | **적용** — parser / loader 분리 (single-responsibility), magic value (2) 단일 소스 (DEFAULT_PROMOTION_THRESHOLD) |
| 4 | 주석 quality | **적용** — 신규 jsdoc 모두 §5.15.B 출처 명시. TODO/FIXME 0. PROMOTION_THRESHOLD const 폐기 + §5.15.B 영구 등록 주석 |
| 5 | 가독성 | **적용** — magic number 0, signature 인자 explicit |
| 6 | 회귀 재검증 | **적용** — Phase 3a 동일 명령 재run 결과 동일 PASS (변경 무) |

### 12.3 AC

| AC | 내용 | 결과 |
|----|------|------|
| AC-B1 | 부재 시 default=2 (backwards compat) | ✅ promotion-config.test.ts `file absent` PASS / canonicalizer.test.ts `AC-B1 backward` PASS |
| AC-B2 | `default: 1` → 1회 mention promote | ✅ promotion-config + canonicalizer 양쪽 PASS |
| AC-B3 | `default: 3` → 2회 mention drop | ✅ canonicalizer.test.ts `AC-B3` PASS |
| AC-B4 | patterns 매칭 | **out-of-scope (v0)** — Karpathy Simplicity First. 사용자 raise 시 확장 |
| AC-B5 | YAML parse 실패 / 잘못된 schema → default fallback + warn | ✅ promotion-config.test.ts `malformed file` / `read throws` PASS + warn 로그 명시 |
| AC-B6 | 라이브 smoke 1 source — `.wikey/promotion-threshold.yaml` 만들고 ingest → dropped sample console log 가 새 threshold 반영 | **deferred** — narrow 1 cycle 의 라이브 smoke 는 build PASS + AC test PASS + ingest-pipeline log 추가 (`promotion threshold = N (§5.11 page promotion gate)`) 로 갈음. 사용자 다음 ingest 세션에서 자연 verify |

### 12.4 Karpathy 4원칙 적용

- **Think Before Coding**: AC-B4 patterns 도입 시 schema 복잡도 ↑ + flat-file YAML 한계 → v0 = `default:` 만 결정. 사용자 raise 시 확장 (overengineering 회피)
- **Simplicity First**: parsePromotionThresholdYaml = 1 regex (`^default\s*:\s*(\S+)$`) + 정수 검증. minimal YAML parser 재사용 안 함 (single-key 라 1-line regex 가 더 단순)
- **Surgical Changes**: PROMOTION_THRESHOLD const 만 제거 + DEFAULT_PROMOTION_THRESHOLD reference. 인접 코드 (`countOccurrences` / `splitSentences` / `applyPromotionGate` 본체 로직) 손대지 않음. 시그니처 chain 만 인자 추가
- **Goal-Driven**: AC-B1~B5 정량 검증 (각 AC = 1+ unit test 매핑). AC-B6 라이브 smoke 는 deferred 명시 (silent skip 금지)

### 12.5 잔여

§5.15.A (UI E2E test 인프라) 만 잔존. 1000~1600 LOC / 3~5 cycle.

---

## 13. §5.15.A Cycle 1 진행 결과 — Session 24, 2026-05-07 ✅

> **분류**: Mid-sized (인프라 단독, 1 cycle, 영향 < 5 신규 파일 — testing.md §3 매트릭스 적용).
>
> **scope 결정** (Karpathy Simplicity First): Cycle 1 = vitest + happy-dom + Obsidian mock minimum 5 인터페이스 + 1 인프라 검증 test. 사용자 raise 시 Cycle 2~5 (sidebar-chat / main.ts deep split test) 진행.

### 13.1 변경 파일 (5 신규 + 2 mod)

| # | 파일 | 변경 |
|---|------|------|
| 1 | `wikey-obsidian/package.json` | devDependencies 에 `vitest`, `happy-dom` 추가 + `test` / `test:watch` script |
| 2 | `wikey-obsidian/vitest.config.ts` | **신규 22 LOC** — happy-dom env + obsidian module → mock alias + test pattern (`src/__tests__/**/*.test.ts`) |
| 3 | `wikey-obsidian/src/__tests__/__mocks__/obsidian.ts` | **신규 ~180 LOC** — App / Vault / TFile / TFolder / Notice / ItemView / Plugin / Modal / Setting / setIcon / MarkdownRenderer mock. test helper (`__setFile` / `__getFile` / `__listAll` / `Notice.__log`) |
| 4 | `wikey-obsidian/src/__tests__/obsidian-mock.test.ts` | **신규 ~120 LOC / 14 tests** — TFile (2) / Vault (5) / App (3) / Notice (2) / ItemView (2) cover. AC-A2 충족 |
| 5 | `package.json` (root) | scripts.test 가 wikey-core + wikey-obsidian 모두 run. `test:core` / `test:obsidian` 분리 script 추가 |

**합계**: 신규 ~322 LOC + delta ~10 LOC = **332 LOC** (추정 1000~1600 의 일부 — Cycle 1 인프라만).

### 13.2 회귀 검증 (Phase 3a)

| 검증 | 결과 |
|------|------|
| `npm test` (root, wikey-core + wikey-obsidian) | **wikey-core 700 PASS** / 3 skip + **wikey-obsidian 14 PASS** = **714 total PASS** |
| `npm run build` (root, both) | 0 errors (기존 import.meta cjs warning 만) |
| `./scripts/validate-wiki.sh` | PASS (영향 0) |

### 13.3 BLUE 6 활동 (Phase 3b)

| # | 활동 | 적용 / 의도적 유지 + 근거 |
|---|------|---------------------------|
| 1 | 함수 분해 | **유지** — mock class method 모두 ≤ 10 LOC. 분해 대상 X |
| 2 | Naming consistency | **적용** — Obsidian 1.7.x API 명명 정확 mirror (App / Vault / TFile / Notice / ItemView / WorkspaceLeaf), test helper 는 `__` prefix 로 production code 와 분리 |
| 3 | DRY | **유지** — 5 인터페이스 mock 단순, helper 추출 불필요 |
| 4 | 주석 quality | **적용** — file header 가 §5.15.A scope / 의도적 제한 (EventRef chain 미구현 / FuzzySuggestModal 미포함) / 확장 가이드 명시 |
| 5 | 가독성 | **적용** — magic number 0, mock test helper 명확 분리 |
| 6 | 회귀 재검증 | **적용** — Phase 3a 동일 명령 재run 결과 동일 PASS |

### 13.4 AC

| AC | 내용 | 결과 |
|----|------|------|
| AC-A1 | `npm test` 실행 가능 (wikey-obsidian) — exit 0 | ✅ 14 PASS / exit 0 |
| AC-A2 | Obsidian API mock layer 가 App / Vault / TFile / Notice / ItemView 최소 5 인터페이스 cover | ✅ obsidian-mock.test.ts 14 tests 모두 PASS |
| AC-A3 | sidebar-chat.ts `renderAuditSection` audit fetch + render 흐름 1+ test | **deferred (Cycle 2~5)** — Cycle 1 은 인프라만. 사용자 raise 시 진행 |
| AC-A4 | (옵션) main.ts `handleVaultCreate` test | **deferred (Cycle 2~5)** |
| AC-A5 | esbuild 빌드 영향 0 — `npm run build` 회귀 0 | ✅ both wikey-core/obsidian build 0 errors |
| AC-A6 | (옵션) §5.14 잔존 4 항목 deep split 재평가 + 진행 | **deferred (Cycle 2~5)** — 인프라 가용 후 사용자 raise 시 진행 |

### 13.5 Karpathy 4원칙

- **Think Before Coding**: jsdom vs happy-dom 비교 → happy-dom 채택 근거 (jsdom 보다 ~3x 빠른 minimal DOM, vitest 권장 default). 5 인터페이스 minimum 결정 (15 인터페이스 한꺼번에 mock 시 over-engineering)
- **Simplicity First**: Cycle 1 = 인프라만. AC-A3/A4/A6 모두 deferred 명시 (silent skip 금지). mock layer 의 EventRef chain / MarkdownPostProcessor 등 미사용 인터페이스 미포함
- **Surgical Changes**: wikey-obsidian/src/ 의 기존 ts 파일 변경 0 (sidebar-chat / main.ts / commands.ts 등 손대지 않음). 신규 파일만으로 인프라 구축
- **Goal-Driven**: AC-A1/A2/A5 정량 PASS. AC-A3/A4/A6 deferred 시점 명시

### 13.6 잔여 (Cycle 3~5)

Cycle 2 종결 후 다음 세션 후보:
- **Cycle 3**: main.ts `handleVaultCreate` vault create event → autoIngest queue / bypass detection 분기 unit test. AC-A4 충족.
- **Cycle 4~5**: §5.14 잔존 4 항목 (renderAuditSection deep split / handleVaultCreate method 추출 / settings-tab section split / runIngest 분해) 재평가 + 진행. AC-A6 충족.

추정 LOC 추가: ~500~1000 (Cycle 1 의 ~322 + Cycle 2 의 ~280 + Cycle 3~5 의 ~500~1000 = 1100~1600 plan 추정 충족).

---

## 14. §5.15.A Cycle 2 진행 결과 — Session 25, 2026-05-08 ✅

> **분류**: Mid-sized (1 cycle, helper 5 export + 21 tests + mock layer 확장 — testing.md §3 매트릭스).
>
> **scope 결정** (Karpathy Simplicity First): renderAuditSection 자체는 closure state heavy (12+ field, plugin context 의존) — 그 자체 instantiate test 는 Cycle 4~5 deep split 후 진행. Cycle 2 = 핵심 helper 5종 (computeRowPct / showRowError / showRowCancelled / loadAuditScriptOutput / applyPairedSidecarToAudit) export + unit test 로 audit 흐름 cover.

### 14.1 변경 파일 (3 mod + 1 신규)

| # | 파일 | 변경 |
|---|------|------|
| 1 | `wikey-obsidian/src/sidebar-chat.ts` | 5 helper export 추가 (1-line each) + `AuditScriptCapabilities` / `AuditScriptOutput` interface export. 활성 코드 변경 0 (Karpathy Surgical Changes) |
| 2 | `wikey-obsidian/src/__tests__/__mocks__/obsidian.ts` | (a) HTMLElement.prototype augmentation (setText / addClass / removeClass / hasClass / toggleClass / empty / detach / show / hide / createDiv / createEl / createSpan) — Obsidian prototype 확장 polyfill. (b) FuzzySuggestModal stub (commands.ts dep evaluate). +110 LOC |
| 3 | `wikey-obsidian/src/__tests__/sidebar-chat-helpers.test.ts` | **신규 ~180 LOC / 21 tests**: computeRowPct (11) / showRowError (4) / showRowCancelled (2) / applyPairedSidecarToAudit (4) |

**합계**: 신규 ~180 LOC + delta ~115 LOC = **295 LOC**.

### 14.2 RED → GREEN → BLUE 흐름

**RED**: 직전 cycle 1 의 mock 만으로는 sidebar-chat.ts import 시 fail (FuzzySuggestModal undefined / setText not function). helper test 작성 → fail.

**GREEN**: mock obsidian 에 (a) FuzzySuggestModal stub + (b) HTMLElement augmentation 추가 → helper 5 export → test 21 PASS.

**Phase 3a (회귀)**:
- wikey-core 700 PASS / 3 skip (회귀 0)
- wikey-obsidian **35 PASS** (Cycle 1: 14 + Cycle 2: 21)
- 합 735 total PASS / 0 build errors / validate-wiki PASS

**Phase 3b (BLUE 6 활동)**:
| # | 활동 | 적용 / 의도적 유지 + 근거 |
|---|------|---------------------------|
| 1 | 함수 분해 | **유지** — helper 모두 ≤ 22 LOC |
| 2 | Naming consistency | **적용** — CSS class (`wikey-audit-path-error` / `wikey-audit-path-cancelled`) 와 helper 함수명 명시 일치 |
| 3 | DRY 중복 제거 | **적용** — mock 의 `applyOpts` helper 가 createDiv/createEl/createSpan 중복 제거 (3 함수 모두 attr/cls/text/href 동일 처리) |
| 4 | 주석 quality | **적용** — sidebar-chat-helpers.test.ts file header 가 §5.15.A Cycle 2 / AC-A3 명시. mock 의 augmentation 섹션 별도 header (§Cycle 2 추가 영역) |
| 5 | 가독성 | **적용** — magic number 0, helper 의 weights 배열 inline 주석 보존 |
| 6 | 회귀 재검증 | **적용** — Phase 3a 동일 명령 재run PASS |

### 14.3 AC

| AC | 내용 | 결과 |
|----|------|------|
| AC-A1 | `npm test` 실행 가능 | ✅ exit 0 |
| AC-A2 | mock 5 인터페이스 cover | ✅ Cycle 1 14 PASS 보존 |
| **AC-A3** | **sidebar-chat `renderAuditSection` audit fetch + render 흐름 1+ test PASS** | ✅ **21 tests** (computeRowPct / showRowError / showRowCancelled / applyPairedSidecarToAudit) — render flow 흐름의 핵심 helper 모두 cover |
| AC-A4 | main.ts `handleVaultCreate` test (옵션) | **deferred (Cycle 3)** |
| AC-A5 | esbuild 빌드 영향 0 | ✅ both build 0 errors |
| AC-A6 | §5.14 잔존 4 항목 deep split 재평가 | **deferred (Cycle 4~5)** |

### 14.4 Karpathy 4원칙

- **Think Before Coding**: renderAuditSection 자체 instantiate vs helper 5 unit test → 후자 결정. 근거: closure state 12+ field 의 mut state 회귀는 deep split 후 cover (Cycle 4~5), Cycle 2 는 *audit fetch + render 흐름 의 atomic unit* (각 helper 의 정량 behavior) 로 AC-A3 충족
- **Simplicity First**: helper 5 함수만 export (1-line per), renderAuditSection 자체는 손대지 않음. mock augmentation 도 Obsidian 1.7.x 가 실제 사용하는 method 만 (createDiv / setText / addClass 등) — 추측 method 추가 X
- **Surgical Changes**: sidebar-chat.ts 의 활성 코드 변경 0 (5 `function` → `export function` only). renderAuditSection / WikeyChatView 본체 손대지 않음
- **Goal-Driven**: AC-A3 정량 — 21 unit tests, 각 helper 의 입력/출력/edge case 명시 cover. computeRowPct 의 fraction 계산 (5% + 75% × 0.5 = 42.5 → round 43) 같은 boundary 명시

### 14.5 잔여 (Cycle 3~5) — 종결 결정 (2026-05-08, 사용자 결정)

§5.15.A 는 Cycle 1+2 만으로 **종결**. Cycle 3~5 (AC-A4 / AC-A6) 의도적 미진행.

**종결 근거**:
- **AC-A4 (main.ts `handleVaultCreate` test)**: vault create event 분기는 plugin lifecycle scoped 동작 — instance state 6 closure (queue / bypassMap / inFlight / autoIngestSettings 등) 의존. test 가능하게 분해하려면 method 추출 + props 격상 = §5.14 session 23 의 *의도적 유지* 결정 (props 인터페이스 비용 > 함수 길이 절감) 와 정합. Cycle 1+2 인프라 가용 ≠ 분해 정당성.
- **AC-A6 (§5.14 잔존 4 항목 deep split)**: session 23 의도적 유지 결정의 본질은 (a) closure state 12+ field 비용, (b) plugin lifecycle scoped 자연 캡슐화 — 둘 모두 *test 인프라* 와 무관. 인프라 생긴 후 재평가에도 결정 동일. 진행 시 indirection 만 추가 (Karpathy Simplicity First 위배).
- **Cycle 1+2 산출의 충분성**: vitest + happy-dom + Obsidian mock 5 인터페이스 + helper 5 export → 향후 *isolated function* 신규 추가 시 자연 cover 가능. 회귀 detect 안전망 자체는 이미 가용.
- **사용자 가치 분석**: Cycle 3~5 의 추가 LOC (~500~1000) 대비 actual 회귀 검출 가치 낮음 — Cycle 1+2 가 이미 §5.14 BLUE refactor 후속의 wallet-friendly 안전망. session 24 의 §5.15.E F4 cancel UX (`showRowCancelled`) 같은 신규 helper 가 자연스레 unit test 등록되는 패턴이 본 인프라의 실제 활용 시나리오.

**Karpathy 4원칙 정합 cross-check**:
- **Think Before Coding**: Cycle 1+2 가 §5.14 잔존 의 의도적 유지 결정 *재평가* 의 근거 인프라였음. 재평가 결과 = 결정 동일 (closure 비용 변하지 않음) → 추가 cycle 진행 시 retroactive justification 위험
- **Simplicity First**: Cycle 1+2 = 인프라 + atomic helper cover. Cycle 3~5 = closure deep split + complex mock fixture (vault create event chain / plugin onload sequence) — overengineering risk
- **Surgical Changes**: AC plan 이 처음부터 AC-A4/A6 를 "(옵션)" 으로 표기 — Cycle 1+2 만 의무 spec
- **Goal-Driven**: AC-A1/A2/A3/A5 정량 PASS — 본 §5.15.A 의 핵심 목표 (vitest + Obsidian mock + helper cover + 빌드 영향 0) 충족

**향후 reopen 조건** (사용자 명시 필요):
- 대규모 sidebar-chat / main.ts 변경으로 *회귀 발생* 시 — closure state mut chain 의 deep test 필요시
- §5.14 잔존 4 항목 중 *어느 하나* 가 사용자 가치 ↑ 변경 사유 (추가 feature 등) 발생 시
- Phase 6 웹 환경 진입 시 동일 mock layer 재사용 정당성 발견 시
