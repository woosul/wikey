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

## Post-fix: v2 (프롬프트 보정 **후**)

**예정**: 다음 세션에서 실행

### 수정 내용 (v1 → v2)
- `ingest-pipeline.ts:253` `callLLMForExtraction` 프롬프트 전면 재작성
- UI 기능명·메뉴 라벨 승격 명시 금지 ("announcement, address-book, all-services" 실제 사례 예시)
- "소프트웨어 기능 항목은 개념이 아니라 source 본문에서 설명" 원칙 명시
- "기능 목록 전체를 concept으로 만드는 패턴 금지"
- 엄격한 수치 상한 대신 품질 필터 우선 (청크당 0~5 entities, 0~10 concepts 가이드)
- 환각 방지 유지

### 예상 결과 (가설)

| 카테고리 | v1 | v2 예상 | 감소율 |
|---------|:-:|:-:|:-:|
| source | 1 | 1 | — |
| entities | 61 | 3~8 | ~90% |
| concepts | 519 | 15~30 | ~95% |
| **합계** | **581** | **20~40** | ~93% |

### 검증 기준
- UI 기능명(`announcement`, `address-book` 등) **0개** 생성 → 엄격
- 업계 표준 용어(`pmbok`, `wbs`, `gantt-chart` 등) **유지** → 보존
- source 1 + entity 3~8 + concept 15~30 수준 도달

---

## 비교 지표 (v1 vs v2)

다음 세션 실행 후 기록:

| 지표 | v1 | v2 | 개선 |
|------|----|----|------|
| 총 파일 수 | 581 | ? | ? |
| log.md/index.md 등재율 | 18/581 = 3% | ?/? | ? |
| UI 라벨 concept 수 | ~500 | ? | ? |
| 업계 표준 concept 수 | ~14 | ? | ? |
| Orphan (백링크 0) 수 | ? | ? | ? |
| LLM 호출 시간 (총) | ? | ? | ? |
| 토큰 사용량 | ? | ? | ? |

---

## 파일

- `v1-file-list.txt` — v1 생성 파일 전체 경로 (583개, 최근 2시간 mmin 기준)
- `v2-file-list.txt` — 다음 세션 실행 후 기록
- `v1-concepts-sample.md` — v1 concepts의 UI 라벨 과다 샘플 (다음 세션에서 원복 전에 저장 가능)
