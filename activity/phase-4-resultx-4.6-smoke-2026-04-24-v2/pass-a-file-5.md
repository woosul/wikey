# Pass A File 5: 스마트공장 보급확산 합동설명회 개최.hwp

> **상위 문서**: [`README.md`](./README.md) · [`pass-a-readme.md`](./pass-a-readme.md)

## 메타
- 크기: 17 KB
- 형식: HWP 5.x 바이너리
- 진입: Ingest 패널 (Pass A)
- Pre/Post: `raw/0_inbox/...` → `raw/3_resources/20_report/300_social_sciences/...` + sidecar
- source_id: `sha256:b63bddfad`
- 실행: 21:01:54 → 21:03:21 (~1.5분)

## Stage 1 — Ingest
- **변환 tier**: `unhwp` (cache hit — 748 chars) — 기대 분기 (`unhwp` 직행, markitdown fallback 없음) 확증
- Stage 1 brief: "스마트공장 보급확산 합동설명회가 8월 24일과 27일, 광주, 전남, 순천에서 개최됩니다. 8대 스마트공장 지원사업을 소개하고 성공적인 구축 사례를 공유하며 보급확산 추진 전략을 발표할 예정입니다..."
- Stage 2 mentions: **5**
- Stage 3 canonicalize: **4 entities, 0 concepts, dropped=5**
  - entities: `jeonnam-science-and-technology-promotion-center`, `bitgaram-center-for-creative-economy-and-innovation`, `jeonnam-technopark`, `samsung-electronics`
  - concepts: 0 (HWP 공문 특성상 추출 개념 없음)
- dropped=5: 공문 특성 상 UI-label (표제/주최/일시 등) 다수 drop 예상
- 분류: **3-level** `raw/3_resources/20_report/300_social_sciences/` (LLM fallback: "스마트공장 보급확산 관련 행정/정책 보고서로, 사회과학 분야 참조 자료에 해당")
- pair sidecar 이동: ✅ `sidecar=true`
- PII: 없음 (공문 공개 정보)

## 종합
- Stage 1 파이프라인: **PASS** (unhwp 직행 기대 분기 확증, pair move, 4+0 페이지)
- **종합 판정**: **PASS**
