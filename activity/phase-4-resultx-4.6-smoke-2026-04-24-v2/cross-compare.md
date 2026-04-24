# Pass A vs Pass B 교차 대조 (2026-04-24)

> **상위 문서**: [`README.md`](./README.md) — 최종 집계.

## 결정론적 일치 항목 (tier-label / 분류 depth)

| 파일 | A tier | B tier | 일치 | A 분류 | B 분류 | 일치 |
|------|--------|--------|------|--------|--------|------|
| 1 llm-wiki.md | md skip | md skip | ✅ | `3_resources/60_note/000_computer_science` | `3_resources/60_note/000_computer_science` | ✅ |
| 2 사업자등록증 | `1-docling` | `1-docling` | ✅ | `3_resources/20_report/300_social_sciences` | `3_resources/20_report/300_social_sciences` | ✅ |
| 3 SK 계약서 | `1b-force-ocr-scan` | `1b-force-ocr-scan` | ✅ | `3_resources/20_report/300_social_sciences` | `3_resources/20_report/300_social_sciences` | ✅ |
| 4 PMS | `1-docling` → `1a-no-ocr` | `1-docling` → `1a-no-ocr` | ✅ | `3_resources/20_report/500_technology` | `3_resources/20_report/500_technology` | ✅ |
| 5 스마트공장 HWP | `unhwp` | `unhwp` | ✅ | `3_resources/20_report/300_social_sciences` | `3_resources/20_report/300_social_sciences` | ✅ |
| 6 Examples HWPX | `unhwp` | `unhwp` | ✅ | `3_resources/20_report/000_general` | `3_resources/60_note/000_general` | **❌** |

- **tier-label**: **6/6 완전 일치** ✅ (변환 캐시 공유로 결정적)
- **분류 depth**: 6/6 모두 3-level ✅
- **분류 경로**: 5/6 완전 일치. file 6 은 PARA 2차 (`20_report` vs `60_note`) 만 차이 — LLM reasoning variance (same file classified as "일반 참조" vs "개인 노트")

## LLM variance 허용 항목 (답변 · entity/concept 수)

| 파일 | A entity | B entity | A concept | B concept | A dropped | B dropped |
|------|----------|----------|-----------|-----------|-----------|-----------|
| 1 llm-wiki.md | 10 | 9 | 4 | 5 | 1 | 1 |
| 2 사업자등록증 | 3 | 3 | 2 | 2 | 1 | 1 |
| 3 SK 계약서 | 6 | 7 | 8 | 7 | 0 | 15 |
| 4 PMS | 8 | 6 | 7 | 9 | 6 | 4 |
| 5 스마트공장 HWP | 4 | 7 | 0 | 0 | 5 | 9 |
| 6 Examples HWPX | 3 | 3 | 0 | 0 | 0 | 0 |

- 평균 entity/concept 결정성: entity Δ 평균 1.2, concept Δ 평균 0.83 (LLM variance 허용 범위)
- dropped variance: file 3 (0 → 15), file 5 (5 → 9) 큰 변동 — Pass B 가 더 보수적으로 mention drop
- **주요 wikilink 공통도**: 각 파일 canonical entity/concept 이름 공통도는 대부분 70%+ (file 2 CEO 이름 `kim-myeong-ho` vs `kim-myung-ho` 같은 romanization variance 제외)

## 분기 차이 (의도적 — 코드 경로)

| 파일 | A handler 시간 (view-side `runIngest+movePair`) | B handler 시간 (core `autoMoveFromInbox`) | Δ |
|------|------|------|------|
| 1 | 3분 | 2.5분 | -30s (캐시 없음, LLM variance) |
| 2 | 2분 | 1분 | -1분 (캐시 hit) |
| 3 | 3분 | 4분 | +1분 |
| 4 | 6분 | 7분 | +1분 |
| 5 | 1.5분 | 1.5분 | 0 (캐시 hit) |
| 6 | 1분 | 1분 | 0 (캐시 hit) |

총 Pass A: ~17분, Pass B: ~17분. 거의 동등. Pass B 는 3 PDF 캐시 hit 이므로 pure LLM 시간만 차이.

## PII 교차 대조

| 항목 | Pass A | Pass B |
|------|--------|--------|
| sidecar mask hits (file 2) | 2 | 2 ✅ 동일 |
| sidecar raw BRN (file 2) | 0 | 0 ✅ 동일 |
| sidecar mask hits (file 3) | 2 | 2 ✅ 동일 |
| sidecar raw BRN (file 3) | 0 | 0 ✅ 동일 |
| source page body raw BRN (file 2) | **3** (❌) | **0** (✅ 개선) |
| wiki entity CEO (file 2 ***) | `kim-myeong-ho.md` | `kim-myung-ho.md` (canonical variance) |
| wiki entity CEO (file 3 ***) | `lee-hee-rim.md` | `lee-hee-rim.md` (Pass B 중복 생성) |

**관찰**: 
- Sidecar redact 는 **완전 결정적** (Pass A ≡ Pass B).
- Source page body BRN 은 LLM variance (Pass A에서 filename hallucination, Pass B에서는 발생 안 함) — 단일 실행만으로 신뢰 불가, 반드시 filename sanitize 필요.
- CEO entity 는 양 pass 모두 생성됨 — canonicalizer 차원 fix 필요.

## 최종 판정

- [x] Pass A 6/6 파이프라인 PASS (PII 제외)
- [x] Pass B 6/6 파이프라인 PASS (PII 제외)
- [x] 교차 tier-label 6/6 일치 ✅
- [x] 교차 분류 depth 5/6 완전 일치 (file 6 PARA 2차만 variance)
- [ ] PII 완전 차단: **FAIL** — 2건 (filename BRN leak + CEO entity) 미해결
- [x] §4.1.3 image-ocr-pollution retry 양 pass 동일 확증
- [x] D.0 redact sidecar 양 pass 결정적 일치 (`PII redacted — 2 match, mode=mask` × 4)

**Phase 4 본체 완성 선언 가능?**: **조건부 YES** — 파이프라인 (tier/classify/pair move/registry) 결정성 확증, D.0 sidecar redact 기대대로 작동. PII wiki 전파 2건 (filename BRN leak + CEO entity) 은 **Phase 5 §5.4 (PII 강화)** 로 이관 가능. D.0 Critical Fix v6 의 sidecar-level redaction 목표는 달성됨; wiki-level 재누출은 원래 D.0 범위 밖이었음 (canonicalizer + filename sanitize 는 별도 티켓).
