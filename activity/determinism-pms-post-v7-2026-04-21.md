# v7 결정성 측정 — PMS 제품소개 PDF (v6 baseline 대비)

> 일시: 2026-04-21
> Source: `raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf` (3.5MB, chunked)
> Runs: 5/5 성공
> 도구: Obsidian CDP 수동 드라이브 (`/tmp/wikey-det-{setup,start,poll,collect}.js`)
> Ingest 설정: audit panel, `skipIngestBriefsThisSession=true`, config default provider (Gemini 2.5 Flash)

## 핵심 결과

| 지표        | v6 baseline | **v7 post** |   변화 |
| ----------- | ----------: | ----------: | -----: |
| Entities CV |       14.7% |       17.9% |   +22% |
| Concepts CV |       33.4% |   **21.2%** | **-37%** |
| Total CV    |       16.9% |    **7.9%** | **-53%** |
| Total mean  |        ~30  |        24.6 |   -18% |
| Time mean   |      ~275s  |        320s |   +16% |

**판정**: v7-1 decision tree + v7-2 anti-pattern + v7-5 schema override의 Concepts CV 개선 가설 **정량 확증**. Concepts CV 33.4 → 21.2%, 목표(≤25%) 달성.

## 5-run 결과

| Run | Entities | Concepts | Total | Time(s) |
| --: | -------: | -------: | ----: | ------: |
|   1 |       10 |       15 |    26 |     309 |
|   2 |       13 |       12 |    26 |     282 |
|   3 |       14 |        8 |    23 |     380 |
|   4 |       12 |       13 |    26 |     343 |
|   5 |        9 |       12 |    22 |     286 |

## 통계

| 지표 | Mean | Std | **CV %** | Range |
|------|-----:|----:|---------:|------:|
| Entities | 11.60 | 2.07 | **17.9%** | 9–14 |
| Concepts | 12.00 | 2.55 | **21.2%** | 8–15 |
| Total | 24.60 | 1.95 | **7.9%** | 22–26 |
| Time | 320.0s | 41.8s | 13.1% | 282–380 |

## Core / Variable 분석

### Entities — 4/23 core (17%)

**Always present (4)**: `goodstream-co-ltd`, `lotus-pms`, `lotus-scm`, `project-management-institute`

**Sometimes (19)**: `alimtalk`, `allimtok`, `alrimtok`, `approval-system`, `c-sharp`, `electronic-approval-system`, `groupware`, `integrated-member-database`, `integrated-member-db`, `java`, `lotus-mes`, `mariadb`, `mobile-app`, `mqtt`, `pms-integrated-supply-chain-management-system`, `project-management-system`, `restful-api`, `single-sign-on-api`, `sso-api`

### Concepts — 7/20 core (35%)

**Always present (7)**: `bill-of-materials`, `enterprise-resource-planning`, `gantt-chart`, `manufacturing-execution-system`, `project-management-body-of-knowledge`, `supply-chain-management`, `work-breakdown-structure`

**Sometimes (13)**: `advanced-planning-and-scheduling`, `application-programming-interface`, `corrective-and-preventive-action`, `e-bill-of-materials`, `electronic-bill-of-materials`, `engineering-bill-of-materials`, `mqtt`, `product-brochure`, `product-lifecycle-management`, `project-management-system`, `restful-api`, `single-sign-on`, `tcp-ip`

## 남은 변동의 성격

**정량 극복**: 전체 크기(총 항목 수)는 매우 안정(Total CV 7.9%, 범위 22-26). 극값 진동(v6 6회에서 581 → 35) 완전 해소.

**남은 변동은 거의 naming/canonicalization**:

1. **음역 다중 슬러그** (한국어 "알림톡"): `alimtalk` / `allimtok` / `alrimtok` 3가지 변형
2. **축약/확장 불일치**: `integrated-member-database` ↔ `integrated-member-db`, `sso-api` ↔ `single-sign-on-api` ↔ `single-sign-on`
3. **BOM 동의어**: `bill-of-materials` (core) 옆에 `e-bill-of-materials` / `electronic-bill-of-materials` / `engineering-bill-of-materials` 상호배타 등장
4. **E/C 경계 왕복** (동일 개념이 run에 따라 entity/concept 분류 뒤집힘): `mqtt`, `project-management-system`, `restful-api`

v7-1 decision tree는 **count-level**은 안정화했지만 **slug-level canonicalization은 미적용** — 동일 개념의 slug 변형/E·C 재분류가 남은 변동의 주요 원인. 개선은 Phase 4 §4.5에서 canonicalizer 2차 확장으로 흡수.

## 측정 환경

- Obsidian 1.12.7 remote debugging port 9222
- 수동 CDP 드라이브 (audit panel 체크 → Apply 클릭)
- 각 run 사이: 새 entity/concept/source 파일 삭제 + `.ingest-map.json` 엔트리 제거 (snapshot diff 방식, fuzzy match 아님)
- 베이스라인 고정: 51 entities, 40 concepts, 10 sources

## 이전 세션의 측정 실패 근본원인 해명 (2026-04-20)

`scripts/measure-determinism.sh`의 "ingest did not start" 오진은 **selector 버그**였다. 스크립트의 probe:

```js
const btnProbe = document.querySelector('.wikey-audit-panel .wikey-audit-apply-btn')?.textContent?.trim() || ''
```

Ingest 시작 시 버튼 class가 `wikey-audit-apply-btn` → `wikey-audit-cancel-btn`로 **swap** (sidebar-chat.ts:999-1000) → `querySelector('.wikey-audit-apply-btn')` → null → `btnProbe = ''` → transition 조건 미충족 → 20 probe 모두 fail.

이번 세션은 apply/cancel 양 class를 모두 찾는 selector로 수정:

```js
const btns = [...panel.querySelectorAll('button')].filter(b => /apply|cancel/.test(b.className))
```

이 수정은 `scripts/measure-determinism.sh`에도 반영 필요 — Phase 4 §4.5.1 체크리스트에 추가.

## 이전 Run 4 single point 재평가

2026-04-20 1차 시도의 유효했던 Run 4 (15E + 27C = 42) 는 이번 5-run mean (24.6)의 **1.7σ 밖 이상치**. Single data point는 단일 chunk split 변동 흡수 불가 → CV 도출 불가하던 판단은 정확했다. 이번 5-run은 안정 분포 확증.

## 다음 단계

- [X] Phase 3 §15.9 결정성 테스트 → **완료** (CV 달성, 마무리)
- [ ] `scripts/measure-determinism.sh` selector 패치 → Phase 4 §4.5.1
- [ ] slug-level canonicalizer 2차 확장 (음역/축약/동의어 사전) → Phase 4 §4.5
- [ ] E/C 경계 왕복 3건 (`mqtt`, `project-management-system`, `restful-api`) schema에 고정 → Phase 4 §4.5
