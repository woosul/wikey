# PMS 인제스트 프롬프트 비교 실험

> 목적: `callLLMForExtraction` (chunk step 프롬프트) 보정 전/후의 분할 수량·품질을 정량 비교.

---

## Baseline: v1 (프롬프트 보정 **전**)

**일시**: 2026-04-19
**대상 파일**: `raw/0_inbox/PMS_제품소개_R10_20220815.pdf` (3.5MB, markitdown 추출 28,993자)
**LLM**: Google Gemini `gemini-2.5-flash`
**인제스트 경로**: Obsidian Audit 패널 → Ingest
**모달**: Stay-involved (Brief + Guide + Processing + Preview)

### 결과 수치

| 카테고리 | 파일 수 | 비고 |
|---------|:-:|------|
| source | 1 | `source-lotus-pms-product-intro.md` |
| entities | **61** | chunk 루프에서 다수 UI 라벨 생성 |
| concepts | **519** | 제품 UI 기능명 대량 승격 |
| analyses | 0 | — |
| **합계** | **581** | |

### log.md 등재 수 (summary step 결과만)
- entities: 3 (`lotus-pms`, `lotus-scm`, `project-management-institute`)
- concepts: 14 (업계 표준: `pmbok`, `work-breakdown-structure`, `gantt-chart`, `bill-of-materials`, `electronic-approval-system`, `supply-chain-management-system`, `erp`, `mes`, `alimtalk`, `project-standardization`, `drawing-management-system`, 기타)

→ log/index 등재 18개 vs 실제 파일 **581개** — **563개 페이지가 index 누락 상태**

### 과다 생성 유형 (실제 concepts 목록에서 샘플)

**정상 (업계 표준, 재사용 가능)**:
- `project-management-system`, `pmbok`, `work-breakdown-structure`, `gantt-chart`
- `erp`, `mes`, `scm`, `electronic-approval-system`, `bill-of-materials`
- `alimtalk`, `drawing-management-system`

**과다 (UI 기능명·메뉴 라벨 승격)**:
- `announcement`, `announcement-title`, `announcements-for-participating-projects`
- `address-book`, `access-rights`, `actual-work-time`, `add-schedule`
- `all-services`, `all-project-summary-information`, `all-unapproved-approved-list`
- `application-details`, …(500+)

### 근본 원인 분석

1. **`callLLMForExtraction` (chunk step 프롬프트) 보정 미적용**
   - `ingest-pipeline.ts:253` — chunk 루프 호출부가 단순 "Extract entities and concepts"만 사용
   - Summary step(`BUNDLED_INGEST_PROMPT`)에만 재사용 필터·환각 방지·상한 지시 적용된 상태

2. **28,993자 문서가 청크 분할 → 각 청크 독립 추출**
   - 청크당 수십 개 엔티티/개념 → merge 시 filename dedup만 → 수백 개 집적

3. **log.md·index.md는 summary 결과만 기록**
   - chunk 결과는 파일만 생성하고 로그/인덱스 누락 → 고아 대량 발생

---

## Post-fix v2: 프롬프트만 보정 (코드 미수정)

**일시**: 2026-04-19 (PMS 인제스트 #2)
**대상 파일**: 동일 (`PMS_제품소개_R10_20220815.pdf`, 28,993자)
**LLM**: 동일 (`gemini-2.5-flash`)
**처리 시간**: **423초 (7분 3초)**, 4 chunks
**상태**: Approve & Write 완료 → archive 후 원복

### 수정 내용 (v1 → v2)
- `ingest-pipeline.ts` `callLLMForExtraction` 프롬프트 전면 재작성
- UI 기능명·메뉴 라벨 승격 명시 금지 (실제 사례 예시 포함)
- "소프트웨어 기능 항목은 개념이 아니라 source 본문에서 설명" 원칙
- 청크당 0~5 entities, 0~10 concepts 가이드

### 결과 수치

| 카테고리 | v1 | v2 | 감소율 |
|---------|:-:|:-:|:-:|
| source | 1 | 1 | — |
| entities | **61** | **5** | -92% |
| concepts | **519** | **29** | -94% |
| **합계** | **581** | **35** | **-94%** |

### 등재율 (개선)

| 지표 | v1 | v2 | 개선 |
|------|----|----|------|
| log.md 등재 | 18 / 581 = 3% | 12 / 35 = 34% | 11배 |
| index.md 등재 | (낮음) | 11 / 35 = 31% | — |

### 품질 검증

| 항목 | v1 | v2 |
|------|----|----|
| UI 라벨 승격 (announcement/address-book 등) | ~500 | **0** ✅ |
| PMBOK 9개 지식영역 분리 | 0 | **9** ✅ |
| 업계 표준 concept (PMBOK·ERP·WBS 등) | 14 | 29 ✅ |

### v2 잔여 이슈 (v3 작업 대상)

**근본 원인 3개 — 프롬프트로는 해결 불가, 코드 수정 필수:**

#### 이슈 ① — Entity 충돌 (기존 wiki 미참조)
- 기존 `goodstream-co-ltd.md` 존재 → 새로 `goodstream.md` 생성 (중복)
- **원인**: `ingest-pipeline.ts`가 LLM에 기존 entity/concept 목록을 주입하지 않음
- **영향**: wiki의 compounding 철학 직접 위반 (같은 엔티티 = 한 페이지)
- **v3 fix 위치**: `ingest-pipeline.ts` Summary/Chunk 프롬프트 빌더에 `wikiFS.listEntities()` + `listConcepts()` 결과 주입

#### 이슈 ② — 약어-풀네임 중복 5쌍
- `pms ↔ project-management-system`
- `pmbok ↔ project-management-body-of-knowledge`
- `wbs ↔ work-breakdown-structure`
- `bom ↔ bill-of-materials`
- `scm ↔ supply-chain-management-system`
- **원인**: chunk 머지 시점에 약어-풀네임 정규화 로직 없음. LLM은 단일 청크 시야로만 판단
- **영향**: 35개 중 약 5개 실효 중복 (14% 노이즈)
- **v3 fix 위치**: `ingest-pipeline.ts` merge 단계에 canonicalization (LLM 1회 추가 호출 또는 룰 기반 매핑)

#### 이슈 ③ — Index 등재 누락 (concept 0건 → 8건은 됐지만 부분 등재) + Orphan 11개
- index.md 등재: entity 5개 중 3개 (lotus-pms, lotus-scm, project-management-institute), concept 29개 중 8개
- Orphan (백링크 0): pms, pmbok, wbs, bom, scm, sso, electronic-approval, drawing, drawing-management-system, version-control, erp = 11개 (35개 중 31%)
- **원인**: Summary 단계에서 LLM이 "주요" 항목만 log/index 후보로 선정 → 약어 페어/세부 concept 누락
- **v3 fix 위치**:
  1. `wiki-ops.ts` `updateIndex()`: 모든 신규 entity/concept을 자동 후보화
  2. 또는 Summary 프롬프트에 "전체 페이지를 빠짐없이 log/index에 등재" 명시

---

## Post-fix v3 (실패): 코드 3건 수정 → 회귀 발생

**일시**: 2026-04-19 (PMS 인제스트 #3, v2 archive 직후)
**상태**: Preview에서 결과 확인 후 **Cancel** (wiki 미수정)
**처리 시간**: 680초 (v2 423초 대비 +60%)

### v3 수정 내용 (v2 → v3)
1. **Fix ① existingPagesHint**: `ingest-pipeline.ts`가 `wikiFS.list('wiki/entities')` + `list('wiki/concepts')` 결과를 LLM 프롬프트 상단에 주입 → "기존 페이지 재사용 우선" 지시
2. **Fix ② dedupAcronyms**: chunk 머지 시점에 약어-풀네임 정규화 (`wbs` ↔ `work-breakdown-structure` 등)
3. **Fix ③ autoFillIndexAdditions**: LLM이 누락한 entity/concept을 모두 index_additions에 자동 추가

### v3 결과 — 의도와 정반대로 회귀

| 카테고리 | v1 | v2 | v3 | v3 vs v2 |
|---------|:-:|:-:|:-:|:-:|
| source | 1 | 1 | 1 | — |
| entities | 61 | 5 | **20** | +300% |
| concepts | 519 | 29 | **75** | +159% |
| **합계** | **581** | **35** | **96** | **+174%** |
| 약어 중복 페어 | 다수 | 5 | **5+ (분리 잔존)** | 미해결 |
| UI 라벨 차단 | (없음) | 100% | **회귀** | 회귀 |
| index.md 카운트 | 18 | 11 | 179 (중복) | 부정확 |

### 근본 원인 분석 — Fix별 진단

#### Fix ① — 역효과 (existingPagesHint)
- LLM이 hint를 보고 entity/concept 분류 기준을 흔들었음
- 약어들(`wbs`, `pms`, `scm`, `bom`, `pmbok`, `pmi`, `erp`, `mes`, `gantt-chart`)이 모두 **entity로 재분류**됨
- 원래 v2에서는 `pmbok`, `wbs`, `bom`이 concept이었는데 v3에서 entity로 이동
- hint 텍스트가 "기존 entities/concepts 목록"을 보여주면서 LLM이 패턴을 모방하는 부작용
- **추가 부작용**: hint가 v2 차단 메시지("UI 라벨·메뉴 항목·소프트웨어 기능 절대 금지")를 희석 → UI 라벨 회귀

#### Fix ② — dedup 풀 분리로 무력화
- `dedupAcronyms`는 entity 풀과 concept 풀을 **별도로 처리**
- `wbs` (entity)와 `work-breakdown-structure` (concept)는 다른 풀에 있어서 매칭 안 됨!
- 동일 카테고리 내에서도 단일 chunk 내에서만 동시 등장 — chunk 간 교차 매칭 미작동
- 결과: 5+ 중복 페어 잔존 (`gantt-chart`(entity)+`gantt-chart`(concept), `wbs`(entity)+`work-breakdown-structure`(concept), 등)

#### Fix ③ — 카운트 부풀림
- `autoFillIndexAdditions`가 LLM의 index_additions와 신규 페이지를 합치면서 dedup 누락
- 96개 페이지 → 179건 index 표시 → 약 80개 중복

### UI 라벨 회귀 사례 (v2에서 차단됐던 게 v3에서 재등장)

`mobile-app-service`, `work-sharing`, `meeting-management`, `task-processing`, `notification-talk-integration`, `web-based-system`, `multilingual-support`, `meeting-room-management`, `user-management`, `code-management`, `notification-settings`, `login-history-information`, `barcode-printing`, `web-viewer`, `push-notification`

→ v2의 chunk 프롬프트 차단 효과를 hint가 흐려놓음

---

## Post-fix v3.1: 재설계 (진행 중)

### 학습된 원칙
1. **hint는 분류 기준을 흔들지 말 것** — 단순 "재사용 우선" 한 줄이면 충분, 목록 노출은 신중히
2. **dedup은 entity+concept 통합 풀에서** — 카테고리 분리는 LLM이 흔드는 변수
3. **autoFill은 dedup된 페이지에만 적용** — 누락 카운트는 정확하게

### v3.1 수정 계획
1. **Fix ① 재설계**: hint를 entity/concept 라벨 없이 단일 plain text 목록으로, 짧게 (예: "기존 페이지: goodstream-co-ltd, lotus-pms, ...")
2. **Fix ② 재설계**: dedupAcronyms를 통합 base name 집합에 적용 (entity+concept 합쳐서 매칭)
3. **Fix ③ 재설계**: index_additions와 신규 페이지 둘 다 base name 정규화 후 dedup, 정확한 카운트

### v3.1 검증 기준
- 약어-풀네임 중복 0쌍 (entity+concept 교차 매칭 포함)
- UI 라벨 0건 (v2 수준 유지)
- 총 파일 수 ≤ 35 (v2 수준 또는 더 적게)
- index 카운트 = 페이지 수 ± LLM 명시 분량

---

## 비교 지표 (v1 / v2 / v3 / v3.1)

| 지표 | v1 | v2 | v3 (실패) | v3.1 목표 |
|------|----|----|----|----|
| 총 파일 수 | 581 | 35 | 96 | ≤ 35 |
| entities | 61 | 5 | 20 | ≤ 8 |
| concepts | 519 | 29 | 75 | ≤ 25 |
| 약어 중복 페어 | 다수 | 5 | 5+ | 0 |
| UI 라벨 (개) | ~500 | 0 | 15+ | 0 |
| 기존 entity 재사용 | 0 | 0 | 0 (`goodstream-co-ltd`로 분류 됐으나 별도 페이지) | 100% |
| log.md 등재율 | 3% | 34% | (cancelled) | ≥ 80% |
| index.md 등재율 | — | 31% | (cancelled) | ≥ 80% |
| 처리 시간 | 미측정 | 423s | 680s | ≤ 500s |

---

## v4 (2026-04-19) — UI 라벨 차단 강화 시도, 비즈니스 객체로 회피

| 카테고리 | v3.2 | v4 | vs v3.2 |
|---------|:-:|:-:|:-:|
| entities | 7 | 19 | +171% |
| concepts | 31 | 82 | +165% |
| **합계** | **39** | **102** | **+161%** |
| 처리시간 | 440s | 455s | +3% |

차단 사례 12개+판단룰 3개 추가가 LLM을 더 적극적으로 만듦. 비즈니스 객체(quotation/order/invoice 등) 대량 생성 → **회피 패턴 확장**.

## v5 (2026-04-19) — 차단 v2 수준 후퇴 + 한국어 회피

| 카테고리 | v4 | v5 | vs v4 |
|---------|:-:|:-:|:-:|
| entities | 19 | 10 | -47% |
| concepts | 82 | 41 | -50% |
| **합계** | **102** | **52** | **-49%** |
| 처리시간 | 455s | 525s | +15% |

v4 차단 강화 롤백 + "비즈니스 객체 차단" 한 줄 추가. 한국어 라벨로 회피(`협력업체`, `회의실`, `결재시스템` 등). 영어 패턴 매칭의 한계.

---

## v6 (2026-04-19, **FINAL**) — 3-Stage Pipeline + Schema-Guided

### 아키텍처 변경 (Phase A+B+C 통합)

```
Stage 1: chunk LLM = Mention Extractor (분류 X, 페이지 X)
Stage 2: 문서-전역 Canonicalizer (단일 LLM 호출, schema-guided)
Stage 3: 코드 결정적 페이지 작성 + index/log
```

- `wikey-core/src/schema.ts` 신규: 4 entity (organization·person·product·tool) + 3 concept (standard·methodology·document_type) + anti-pattern detector
- `wikey-core/src/canonicalizer.ts` 신규: 단일 LLM 호출, cross-pool dedup, 약어/풀네임 자동 통합, 기존 페이지 재사용
- `wikey-core/src/wiki-ops.ts`: writtenPages 기반 결정적 index/log backfill + stripBrokenWikilinks (LLM 누락/dropped 항목 정리)
- 테스트 97 → **143** (+46)

### 6회 결과 (PMS 동일 입력, gemini-2.5-flash)

| Run | Total | E | C | Duration |
|-----|:-:|:-:|:-:|:-:|
| 1 | 32 | 13 | 18 | 260s |
| 2 | 30 | 12 | 17 | 260s |
| 3 | 22 | 12 | 9 | 275s |
| 4 | 38 | 12 | 25 | 290s |
| 5 | 32 | 17 | 14 | 300s |
| 6 (guide hint) | 32 | 11 | 20 | 355s |
| **mean** | **31.0** | **12.8** | **17.2** | **290s** |

### 결정성 통계 (Run 1~5, guide_hint 없음)

| 지표 | mean | std | CV % | range |
|------|:-:|:-:|:-:|:-:|
| Total | 30.8 | 5.2 | **16.9%** | 22~38 (16) |
| Entities | 13.2 | 1.9 | **14.7%** | 12~17 |
| Concepts | 16.6 | 5.6 | **33.4%** | 9~25 |

### v1~v6 진동 비교

| 버전 | Range | 폭 | 핵심 |
|------|:-:|:-:|------|
| v1~v5 | 35~102 | **67** | chunk LLM 분류 흔들림 + 회피 패턴 반복 |
| **v6** | **22~38** | **16** | **76% 축소** — chunk는 mention만, canonicalizer가 분류 |

### 품질 검증 (6회 모두)

| 항목 | 결과 |
|------|------|
| 한국어 라벨 (회의실/결재시스템 등) | **0건** ✅ schema anti-pattern으로 자동 dropped |
| UI 라벨 (mobile-app-service 등) | **0건** ✅ |
| 비즈니스 객체 (quotation/order 등) | **0건** ✅ |
| 약어 자동 통합 | ✅ pmbok→풀네임, erp→풀네임, wbs→풀네임, bom→풀네임 |
| 기존 entity 재사용 | ✅ goodstream-co-ltd "업데이트" 마크 (v1~v5에서 풀지 못함) |

### v6.1 실험 — temperature=0 + seed=42 (Gemini), 롤백

- 5회 결과: **CV 악화** (Total 16.9% → 20.9%, Entities 14.7% → 36.3%)
- Concepts CV는 개선 (33.4% → 15.5%) — trade-off
- Gemini seed는 "best-effort" 한계 명시 사실 확인
- pro 모델 (gemini-3.1-pro-preview) 1회: total=24, e=16, c=7, 220s — Concept 매우 보수적
- **결론**: ingest-pipeline.ts/canonicalizer.ts 호출자에서 temperature/seed 제거. `LLMCallOptions.seed` 필드 + llm-client 전달 로직은 v7 재실험 옵션으로 유지.

---

## v6 + Phase D + C-boost (2026-04-19) — 운영 항목 차단 + Stay-involved 강화

### Phase D
- Brief 모달에 활성 schema 라인 표시: "활성 스키마: 4 entity (...) / 3 concept (...)"
- Karpathy "stay involved" 원칙 충족 (사용자가 분류 자유도 인지)

### C-boost (Anti-pattern 보강)
- Hyphen-position variants 정규화 (`turnkey-contract` ↔ `turn-key-contract`)
- *-list / *-report / *-form 접미사 패턴 추가
- 운영 항목 list 확장: issue-log, meeting-minutes, incoming-inspection, turnkey-contract, delivery-specification, capacity-analysis, barcode, product-introduction-document, weekly-report, business-registration-number, delivery-confirmation, 3d-workspace
- broken wikilink fix: stripBrokenWikilinks가 written page에 없는 wikilink를 log entry에서 제거 + multi-comma tidy

---

## Audit panel auto-move PARA (2026-04-19)

- 인제스트 후 raw/0_inbox/ 파일은 classifyFileAsync로 PARA 폴더 결정 + moveFile + ingest-map 키 갱신
- 이전 디자인 ("inbox 잔류, 사용자가 수동 이동")에서 변경
- inbox panel "auto" 옵션은 기존 동작 유지 (plan phase classify + moveBtn explicit move)
- 구현: `wikey-obsidian/src/commands.ts`의 runIngestCore에 `autoMoveFromInbox?: boolean` 옵션 추가, audit applyBtn은 true 전달

---

## 종합 비교 (v1 / v2 / v3 / v3.1 / v3.2 / v4 / v5 / v6)

| 지표 | v1 | v2 | v3 | v3.1 | v3.2 | v4 | v5 | **v6** |
|------|----|----|----|------|------|----|----|--------|
| 총 파일 | 581 | 35 | 96 | 71 | 39 | 102 | 52 | **22~38 (5회 mean 30.8)** |
| 약어 중복 | 다수 | 5 | 5+ | 5+ | 0 | 0 | 0 | **0** |
| UI 라벨 | ~500 | 0 | 15+ | 8+ | ~7 | 15+ | (한글) | **0** |
| 기존 entity 재사용 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **100%** |
| 처리 시간 | — | 423s | 680s | 500s | 440s | 455s | 525s | **260~300s** |
| log/index 등재율 | 3% | 34% | — | — | — | — | — | **100%** (Phase A 결정적) |

### v6 vs v5 핵심 개선
- **결정성**: 분류는 안정 (entity 12-13/5회 중 4회), 분량만 변동 (CV 16.9%) — v1~v5는 분류 자체 흔들림
- **속도**: 47% 단축 (525s → 277s 평균)
- **무결성**: log/index 100% 등재 보장 (orphan 0개)
- **회피 패턴 종결**: 한국어/UI/비즈니스 객체/운영 항목 모두 0건

---

## 파일

- `v1-file-list.txt` — v1 생성 파일 583개
- `v1-concepts-sample.txt` — v1 UI 라벨 30개 샘플
- `v2-file-list.txt` — v2 생성 파일 35개
- `v3-file-list.txt` — v3 생성 파일 96개
