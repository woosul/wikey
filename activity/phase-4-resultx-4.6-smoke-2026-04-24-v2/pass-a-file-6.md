# Pass A File 6: Examples.hwpx

> **상위 문서**: [`README.md`](./README.md) · [`pass-a-readme.md`](./pass-a-readme.md)

## 메타
- 크기: 1.2 MB
- 형식: HWPX (OOWPML zip)
- 진입: Ingest 패널 (Pass A)
- Pre/Post: `raw/0_inbox/Examples.hwpx` → `raw/3_resources/20_report/000_general/Examples.hwpx` + sidecar
- source_id: `sha256:9d72a7a14`
- 실행: 21:03:32 → 21:04:30 (~1분)

## Stage 1 — Ingest
- **변환 tier**: `unhwp` (cache hit — 544 chars) — 기대 분기 확증
- Stage 1 brief: "Examples.hwpx는 한글 워드프로세서 문서 예제..."
- Stage 2 mentions: **3**
- Stage 3 canonicalize: **3 entities, 0 concepts, dropped=0**
  - entities: `naver-map`, `ibook`, `hangeul`
  - concepts: 0
- 분류: **3-level** `raw/3_resources/20_report/000_general/` (LLM fallback: "일반적인 문서 파일(.hwpx)이며, 특정 주제나 용도가 명확하지 않아 일반 참조 자료로 분류합니다")
- pair sidecar 이동: ✅ `sidecar=true`
- PII: 없음

## 종합
- Stage 1 파이프라인: **PASS** (HWPX → unhwp 직행 성공, pair move)
- **종합 판정**: **PASS**
