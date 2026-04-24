# Pass B File 2: 사업자등록증 (Audit panel)

> **상위 문서**: [`README.md`](./README.md) · [`pass-b-readme.md`](./pass-b-readme.md)

## 메타
- 진입: Audit 패널
- 실행: 21:13:30 → 21:14:32 (~1분)
- source: 453 chars (redacted), route=FULL
- PII 설정: `allowPiiIngest=true, piiGuardEnabled=true`

## Stage 1
- 변환 tier: `1-docling` (cache hit) — Pass A 와 동일
- **PII redacted: 2 match, mode=mask** ✅ (양쪽 — main + sidecar)
- Stage 2 mentions: **6** (Pass A 동일) ✅
- Stage 3: **3 entities, 2 concepts, dropped=1** (Pass A 와 동일) ✅
- 분류: `raw/3_resources/20_report/300_social_sciences/` (Pass A 와 동일) ✅

## PII 검증
### Sidecar
- mask hits: 2 ✅
- raw BRN: 0 ✅
- **Pass A ≡ Pass B (결정적 일치)**

### Wiki
- source 페이지 본문: raw BRN **0 hits** (Pass A 는 3 hits → Pass B 가 더 낫다; LLM variance)
  - Pass B source: `wiki/sources/source-goodstream-business-registration.md`
  - vault_path frontmatter 만 filename BRN 포함 (unavoidable without filename sanitize)
- CEO `***` 본문 보존 (1 hit) — Pass A 동일 이슈
- entity `wiki/entities/kim-myung-ho.md` 생성 — Pass A (`kim-myeong-ho`) 와 다른 canonical name (variance)

## 판정
**PARTIAL** (Pass A 보다 개선 — source body BRN 없음, 단 CEO entity 는 여전). tier/분류/mentions 결정적 일치.
