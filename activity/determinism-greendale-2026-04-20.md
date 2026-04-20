# v6 결정성 측정 — Greendale 2026 Annual Report Excerpt

> 일시: 2026-04-20
> 목적: PMS PDF 외 다른 입력에서 v6 인제스트 결정성 (CV) 재현 여부 확인 (§C-1 #2)
> 설정: Gemini 2.5 Flash, Audit panel [Ingest], briefSetting=never (모달 우회)

## 입력

- **파일**: `raw/0_inbox/determinism-test-source.md` (1.6KB, ~360 단어 영어)
- **도메인**: 가공 산업 분석 장비 메이커 (가상)
- **콘텐츠**: 회사·인물·제품 라인 3개·산업 표준 5+개·파트너십 1건 포함

## 5회 측정 결과

| Run | Entities | Concepts | Total | Time(s) |
|-----|---------:|---------:|------:|--------:|
| 1   | 11       | 9        | 21    | 105.1   |
| 2   | 11       | 8        | 20    | 105.1   |
| 3   | 9        | 5        | 15    | 118.6   |
| 4   | 11       | 8        | 20    | 96.1    |
| 5   | 11       | 9        | 21    | 125.1   |

### 통계

| 지표      | Mean  | Std  | **CV %** | Range    |
|-----------|------:|-----:|---------:|---------:|
| Entities  | 10.6  | 0.89 | **8.4%** | 9–11     |
| Concepts  | 7.8   | 1.64 | **21.1%**| 5–9      |
| Total     | 19.4  | 2.51 | **12.9%**| 15–21    |
| Time      | 110.0s| 11.7s| 10.6%    | 96–125s  |

## PMS와 비교

| 지표       | Greendale | PMS v6   | 비고 |
|------------|----------:|---------:|------|
| Entities CV| **8.4%**  | 14.7%    | -43% |
| Concepts CV| **21.1%** | 33.4%    | -37% |
| Total CV   | **12.9%** | 16.9%    | -24% |

→ Greendale은 PMS보다 **모든 지표에서 더 안정적**.

추정 원인:
1. 작은 소스 (1.6KB vs PMS 28KB) → chunk 1개 → chunk 분할 변동 없음
2. 깔끔한 도메인 용어 (산업 표준명) vs PMS의 비즈니스 UI 라벨 모호성

## Core / Variable 분리

### Entities — 11종 중 9개가 항상 등장 (82%)

**Core (5/5 runs)**: bayer-ag, flowguard-xr, greendale-industrial-solutions-gmbh, hart-7, lisa-hoffmann, namur, particlescan-v, sentry-nir, stefan-wagner

**Variable**: spectranet (4/5), xr-200 (4/5)
- spectranet은 알고리즘 이름. canonicalize가 product feature로 dropping할 가능성
- xr-200은 product variant. 하위 모델 분리 vs 상위 통합 변동

### Concepts — 9종 중 5개가 항상 등장 (56%)

**Core (5/5)**: fda-21-cfr-part-11, iso-13320, namur-recommendation-ne-174, opc-ua-companion-specification-for-pharmaceutical-industry, process-analytical-technology

**Variable**: active-pharmaceutical-ingredient (2/5), atex-zone-1 (4/5), good-manufacturing-practice (4/5), nist-srm-1003 (4/5)
- 모두 표준/규격 용어. "standard vs methodology vs document_type" 분류 boundary 모호
- v7-1 (`schema methodology vs document_type 경계 명확화`) 효과 검증 후보

## 결론

1. v6 결정성은 **다른 입력에서도 재현됨** (PMS와 유사한 패턴, 더 안정적)
2. Concepts CV 21.1%는 여전히 높음 → **v7-1 schema 강화로 ~10% 목표** 가능성
3. Entities core ratio 82%는 양호 — canonicalize의 "drop borderline" 정책이 잘 작동
4. 시간 변동 11s (10.6%)는 Gemini API 일반적 변동 범위 — 우려 없음
