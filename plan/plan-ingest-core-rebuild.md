# 인제스트 파이프라인 v6 재설계 — 3-Stage + Schema-Guided

## Context

PMS PDF(28,993자)를 동일 입력으로 6회 인제스트하면서 결과가 581 → 35 → 96 → 71 → 39 → 102 → 52로 진동했다. **결과의 비결정성은 솔루션으로서 치명적**이다.

근본 원인 — Codex 진단 + GraphRAG/LightRAG/LlamaIndex/Notion AI/Confluence 등 커뮤니티 검증 패턴 종합:

> `callLLMForExtraction()`이 **chunk-local LLM에서 "분류 + 페이지 초안"을 동시 생성**한다. 후처리 dedup은 파일명 정규화만 하고 의미 통합을 못 한다. 차단 메시지를 강화하면 LLM은 entity ↔ concept ↔ 한국어 라벨 사이를 회피 이동한다.

**이번 변경의 목표는 분량 최적화가 아니라 결정성·일관성 확보**. 동일 입력에 동일 출력. Karpathy의 compounding 원칙(같은 entity = 한 페이지)을 코드 레벨에서 보장.

비목표:
- UI 변경 (이번 세션에서 이미 적용 완료)
- 검색 품질 개선 (Anthropic-style contextual chunk는 v7로 분리)
- 분량 최적화 (3-stage가 안정화되면 자연 효과)

---

## 핵심 설계 — 3-Stage Pipeline + Schema-Guided

```
Stage 1: chunk LLM = Mention Extractor (페이지 X, 분류 X)
   출력: [{ name: string, type_hint?: string, evidence: string }]

Stage 2: 문서-전역 Canonicalizer (단일 LLM 호출)
   입력: 모든 chunk mention + 기존 wiki 인덱스 + 사용자 schema
   출력: canonical {entities, concepts} + index_additions + log_entry
   - Schema-guided: 4 entity 타입 + 3 concept 타입만 허용
   - LightRAG-style: 약어↔풀네임/기존 페이지 재사용 일괄 결정
   - Strict mode: 타입 위반 시 reject (LlamaIndex SchemaLLMPathExtractor 패턴)

Stage 3: 코드 결정적 페이지 작성 + index/log
   - written 페이지 = Stage 2 결정 그대로
   - updateIndex: written 페이지 100% 등재 (LLM 의존 X)
   - appendLog: written 페이지 목록에서 코드 생성
```

**Schema 정의** (신규 `wikey-core/src/schema.ts`):
- entity 타입: `organization` | `person` | `product` | `tool`
- concept 타입: `standard` | `methodology` | `document_type`
- 위 7개 외는 거부 → "비즈니스 객체 회피" 패턴 차단
- 사용자가 `.wikey/schema.yaml`로 오버라이드 가능 (Phase D)

---

## Phase 분해 (검증 가능한 단위)

### Phase A — Index/Log 결정적 생성 (0.5일, 가장 안전, 즉시 효과)

**대상 파일**:
- `wikey-core/src/wiki-ops.ts:25-53` — `updateIndex()` 시그니처 확장
- `wikey-core/src/ingest-pipeline.ts:198-234` — write 단계에서 결정적 호출

**변경**:
1. `updateIndex(wikiFS, additions, writtenPages)` 시그니처 추가
   - `writtenPages: Array<{filename, category, description}>` 받아서 LLM `index_additions`와 머지
   - LLM 누락분을 `extractFirstSentence()` (이미 `ingest-pipeline.ts:431` 존재) 사용해 자동 채움
2. `appendLog()`도 동일하게 written 페이지 목록 기반 fallback 추가
3. ingest-pipeline.ts:198-234에서 `parsed.index_additions`만 보내던 것을 `writtenPages` 함께 전달

**재사용**:
- `extractFirstSentence()` (ingest-pipeline.ts:431) — Phase A에서 wiki-ops로 이동 또는 export
- `normalizeBase()` (ingest-pipeline.ts:336) — index dedup에 활용

**검증**:
- 단일 PMS PDF 인제스트 후 `wc -l wiki/sources/*` `wc -l wiki/concepts/*` `wc -l wiki/entities/*` 합계 == index.md 신규 라인 수
- orphan 검사: `for f in wiki/concepts/*.md; do grep -l "[[$basename]]" wiki -r | wc -l`이 모든 페이지 ≥1
- 기존 vitest 97/97 유지 + wiki-ops.test.ts에 written-pages-fallback 케이스 3개 추가

---

### Phase B — Schema 정의 + Validation (0.5일)

**대상 파일**:
- `wikey-core/src/schema.ts` (신규) — entity/concept 타입 정의
- `wikey-core/src/__tests__/schema.test.ts` (신규) — validation 케이스
- `wikey-core/src/types.ts:67-71` — WikiPage에 `entityType?` / `conceptType?` 옵션 추가

**변경**:
1. `schema.ts`에 ENTITY_TYPES / CONCEPT_TYPES 상수 정의 + `validateMention()` 함수
2. `Mention` 타입 신규 정의 (`name`, `type_hint`, `evidence`, `source_chunk_id`)
3. `CanonicalizedResult` 타입 신규 (`entities: WikiPage[]`, `concepts: WikiPage[]`, `dropped: Mention[]`)
4. WikiPage에 entityType/conceptType 메타 필드 추가 (frontmatter에 반영)

**재사용**:
- `IngestRawResult` (ingest-pipeline.ts:475) — 기존 호환성 유지하면서 새 타입과 매핑
- vitest 패턴 (config.test.ts/wiki-ops.test.ts와 동형)

**검증**:
- schema.test.ts에 18케이스 (각 타입 valid 1 + invalid 1, dropped reason 명시)
- 기존 97 + 18 = 115 tests pass

---

### Phase C — Mention Extractor + Canonicalizer (1.5일, 핵심)

**대상 파일**:
- `wikey-core/src/ingest-pipeline.ts:268-317` — `callLLMForExtraction` 재작성 (분류 제거, mention만)
- `wikey-core/src/ingest-pipeline.ts:77-161` — large-doc 흐름에서 Stage 2 canonicalizer 호출
- `wikey-core/src/canonicalizer.ts` (신규) — 단일 LLM 호출로 mention → canonical pages

**변경**:
1. `callLLMForExtraction()`을 `extractMentions()`로 개명, 출력 타입을 `Mention[]`로 변경
   - 프롬프트: "분류하지 말고 발견한 mention만 나열" (40줄 이내)
2. `canonicalize(mentions, existingWiki, schema)` 신규 함수
   - 단일 LLM 호출: 모든 chunk의 mention 통합 + 기존 wiki entity/concept 목록 + schema 7개 타입 주입
   - 출력: `{entities, concepts, dropped}` — strict 검증 후 schema 위반은 dropped
   - 약어↔풀네임 매칭은 LLM이 결정 (정규식 dedupAcronymsCrossPool 제거)
3. ingest-pipeline.ts large-doc 흐름:
   - Step B: 각 chunk → extractMentions() → `allMentions[]`에 누적
   - Step C: canonicalize(allMentions, existingWiki, schema) → parsed
   - existingWiki 로드: `wikiFS.list('wiki/entities')` + `list('wiki/concepts')` (v3.1처럼 hint X, canonicalizer LLM에만 전달)
4. small-doc 흐름도 동일: extract → canonicalize 2단계 (단순화: 작은 문서는 chunk 1개로 취급)

**재사용**:
- `extractJsonBlock()` (ingest-pipeline.ts:485) — 그대로 활용
- `callLLMWithRetry()` (ingest-pipeline.ts:319) — extractMentions/canonicalize 양쪽에서 사용
- `splitIntoChunks()` (ingest-pipeline.ts:441) — 변경 없음
- `injectGuideHint()` (ingest-pipeline.ts:528) — canonicalize 프롬프트에만 적용

**제거**:
- `dedupAcronymsCrossPool()` — canonicalizer LLM이 의미 dedup
- `autoFillIndexAdditions()` — Phase A에서 wiki-ops가 결정적 생성
- `normalizeBase()` — Stage 3 createPage에서만 사용 (path defensive)

**검증**:
- PMS PDF로 5회 연속 인제스트 → 합계 std deviation < 5% (현재: 35~102 사이 진동)
- entity vs concept 타입 분류 일관성: 5회 중 4회 동일 분류 (LLM 변동성 허용)
- UI 라벨/한국어 라벨 0건 (schema 위반으로 dropped 가야 함)
- ingest-pipeline.test.ts에 Mock LLM으로 canonicalize 케이스 5개 추가

---

### Phase D — Stay-Involved 강화 (0.5일)

**대상 파일**:
- `wikey-obsidian/src/ingest-modals.ts:325-365` — Brief phase에 schema preview 추가
- `wikey-obsidian/src/main.ts` — settings에 `schemaOverridePath` 옵션 (기본 `.wikey/schema.yaml`)

**변경**:
1. Brief 모달에 "활성 스키마: 4 entity / 3 concept (편집)" 한 줄 표시
2. 클릭 시 `.wikey/schema.yaml` 열기 (있으면) 또는 default를 보여줌 (Markdown view)
3. Karpathy 원칙 1 ("강조할 점 안내") 충족: guide_hint와 schema 둘 다 사용자 통제

**재사용**:
- 기존 BriefOutcome 타입 (ingest-modals.ts:18-24) — 변경 없음
- 기존 settings 패턴 (main.ts) — `schemaOverridePath: string` 추가

**검증**:
- E2E: 사용자가 `.wikey/schema.yaml` 편집 후 인제스트 → 새 타입이 적용됨
- 미편집 시 기본 schema로 동작

---

## 위험 + 완화

| 위험 | 영향 | 완화 |
|------|------|------|
| Canonicalizer LLM 호출 1회 추가로 토큰 비용 ↑ | 중 — gemini-flash 기준 약 5K 토큰 추가 | 청크 LLM의 출력이 mention만이라 더 짧음. 순 토큰은 비슷 |
| Canonicalizer가 strict 거부로 너무 적게 출력 | 고 — 누락 우려 | dropped 페이지 별도 로그 → Stage 2 Preview에서 사용자에게 표시, 필요시 schema 확장 |
| 기존 `.ingest-map.json`/`wiki/.ingest-map.json` 스키마 호환 | 저 | written 페이지만 기록하므로 기존 포맷 그대로 |
| 기존 wikey.schema.md "인제스트 분할 전략" 섹션과 충돌 | 저 | wikey.schema.md는 사용자 승인 필요 — 문서 갱신은 별도 PR |

---

## 실행 순서 권장

A → B → C → D 순차. 각 Phase 완료 후 PMS PDF로 검증.

총 예상: **3일 (full-time)**

Phase A는 0.5일이고 즉시 가시 효과(orphan/index 누락 해결)가 있으니 첫 commit으로 분리. Phase C가 핵심 변경으로 가장 시간 소요.

---

## 변경 대상 파일 요약

**수정**:
- `wikey-core/src/wiki-ops.ts` (Phase A)
- `wikey-core/src/ingest-pipeline.ts` (Phase A, C)
- `wikey-core/src/types.ts` (Phase B)
- `wikey-obsidian/src/ingest-modals.ts` (Phase D)
- `wikey-obsidian/src/main.ts` (Phase D)

**신규**:
- `wikey-core/src/schema.ts` (Phase B)
- `wikey-core/src/canonicalizer.ts` (Phase C)
- `wikey-core/src/__tests__/schema.test.ts` (Phase B)
- `wikey-core/src/__tests__/canonicalizer.test.ts` (Phase C)

**삭제 (코드만, 함수 export는 유지하되 미호출)**:
- `dedupAcronymsCrossPool` 호출부 (Phase C 완료 후)
- `autoFillIndexAdditions` 호출부 (Phase A 완료 후)

---

## 검증 (전체)

1. **단위**: `npm test` → 97 + 신규 23 = **120 tests pass**
2. **빌드**: `npm run build` exit 0
3. **End-to-end (PMS PDF, gemini-2.5-flash)**:
   - 5회 연속 인제스트 → 페이지 합계 std deviation < 5%
   - 동일 entity는 동일 base name으로 통합
   - UI 라벨 / 한국어 라벨 0건
   - `wc -l wiki/concepts/*.md wiki/entities/*.md` 합계 == index.md 신규 라인 수
   - orphan 0개 (모든 페이지가 다른 페이지에서 ≥1회 참조)
4. **회귀**: 기존 `wiki/sources/source-goodstream-biz-reg-cert-2015.md` 등 9개 source는 영향 없음
5. **결과 archive**: `activity/ingest-comparison/v6-file-list.txt` + README.md에 v6 결과 기록

---

## 실행 결과 (Phase A + B + C 완료, 2026-04-19)

### 구현 완료
- **Phase A**: `wiki-ops.ts` updateIndex/appendLog가 writtenPages 받아 결정적 backfill (4 신규 테스트)
- **Phase B**: `schema.ts` 신규 (4 entity + 3 concept 타입) + 20 테스트
- **Phase C**: `canonicalizer.ts` 신규 (단일 LLM 호출) + chunk LLM은 mention만 추출 + 12 테스트
- **테스트**: 97 → **133 통과** (+36)
- **빌드**: 0 errors

### 6회 실험 결과 (PMS PDF 동일 입력, gemini-2.5-flash)

| Run | Total | Entities | Concepts | Duration | guide_hint |
|-----|-------|----------|----------|----------|-----------|
| 1 | 32 | 13 | 18 | 260s | (없음) |
| 2 | 30 | 12 | 17 | 260s | (없음) |
| 3 | 22 | 12 | 9 | 275s | (없음) |
| 4 | 38 | 12 | 25 | 290s | (없음) |
| 5 | 32 | 17 | 14 | 300s | (없음) |
| 6 | 32 | 11 | 20 | 355s | "제품의 기능과 사양에 대한 정확한 분석" |

### 결정성 통계 (Run 1~5, guide_hint 없음)

| 지표 | mean | std | CV % | range |
|------|------|-----|------|-------|
| Total | 30.8 | 5.2 | **16.9%** | 22~38 (16) |
| Entities | 13.2 | 1.9 | **14.7%** | 12~17 (5) |
| Concepts | 16.6 | 5.6 | **33.4%** | 9~25 (16) |
| Duration | 277s | 17s | 6.1% | 260~300s |

### v1~v6 진동 비교

| 버전 | Range | 폭 | 특징 |
|------|-------|----|------|
| v1~v5 | 35~102 | **67** | chunk LLM 분류 흔들림, 회피 패턴 반복 |
| **v6 5회** | **22~38** | **16** | **76% 축소** — chunk는 mention만, canonicalizer가 분류 |

### 품질 검증 (모든 6회 공통)

| 항목 | 결과 |
|------|------|
| 한국어 라벨 (회의실/결재시스템 등) | **0개** ✅ schema anti-pattern으로 자동 dropped |
| UI 라벨 (mobile-app-service 등) | **0개** ✅ |
| 비즈니스 객체 (quotation/order 등) | **0개** ✅ |
| 약어 자동 통합 | ✅ pmbok→풀네임, erp→풀네임, wbs→풀네임, bom→풀네임 |
| 기존 entity 재사용 | ✅ goodstream-co-ltd "업데이트" 마크 (v1~v5에서 풀지 못함) |

### Run 6 (guide hint) 추가 관찰

- 처리 시간 +60s (255~300s → 355s) — guide hint 토큰 추가
- 결과 분량은 v6 평균 범위 안 (32개)
- **새로 등장한 항목**: `3d-workspace`, `risk-register`, `single-sign-on-api`, `electronic-bill-of-materials`, `advanced-planning-and-scheduling`
  → "기능과 사양 정확 분석" 가이드가 PMS 시스템 구성 요소를 더 세분화함
- guide hint가 **분류 안정성을 깨지 않음** (UI 라벨 0건 유지)
- guide hint가 **분량 진동에는 영향 없음** (평균 범위 32)

---

## 결과 분석 (논의용)

### 성공한 것

1. **분류 안정성 확보** — entity 12-17 (CV 14.7%)는 거의 변동 없음. v1~v5처럼 entity↔concept↔한국어 라벨 사이 회피 이동 현상 종결.
2. **회피 패턴 차단** — schema 7개 타입 + anti-pattern detection 이중 검증으로 한국어/UI/비즈니스 객체 0건 유지.
3. **약어/풀네임 자동 통합** — canonicalizer LLM이 의미 dedup. v3.2 정규식 dedup의 실패 사례(약어가 entity 풀로 회피)가 사라짐.
4. **기존 페이지 재사용** — goodstream-co-ltd가 새 페이지 만들지 않고 업데이트로 합류. wikey 의 compounding 원칙 코드 레벨 보장.
5. **처리 속도 개선** — chunk LLM이 mention만 뽑으니 chunk별 응답 짧음. canonicalize +1회 호출 추가됐지만 net 단축 (v5 525s → v6 평균 277s, **47% 단축**).
6. **Index/Log 100% 등재** — Phase A의 writtenPages 백필이 LLM 누락분 자동 보충. orphan 0개 보장.

### 미완 / 한계

1. **Concept 분류 변동성 (CV 33%)** — Run 3에서 9개, Run 4에서 25개. canonicalizer LLM이 같은 mention 집합에서도 "concept으로 승격"할지 "drop"할지 흔들림. 현재 schema의 `methodology` / `document_type` 경계가 모호해서 LLM이 같은 항목을 다르게 분류.
2. **Plan 목표 std dev <5% 미달** — gemini-2.5-flash temperature 기본값 + LLM 본질적 비결정성 한계. temperature=0 + seed 고정으로 추가 실험 필요.
3. **잔여 노이즈 항목** — `barcode`, `meeting-minutes`, `incoming-inspection`, `issue-log`, `turnkey-contract`, `delivery-specification`, `capacity-analysis`. schema의 `document_type`/`methodology`로 통과하지만, "기능/운영 항목"에 가까움.
4. **Run 5 entity=17 outlier** — 평균 12-13 사이에서 갑자기 17. canonicalizer LLM 응답 형식이 일관되지 않은 경우 발생.

### 결정성 vs 비결정성 본질

LLM 기반 시스템에서 100% 결정성은 본질적으로 불가능하지만:
- **분류는 안정** (entities 12-13으로 5회 중 4회 동일, anti-pattern 차단 100%)
- **분량만 변동** (concept 9-25)

이는 v1~v5의 "근본적 회피 패턴 진동"과 다른 차원. 사용자 관점에서:
- 동일 인제스트 1번에 어떤 페이지가 만들어질지 예측 가능 (schema가 강제)
- 분량만 ±25% 정도 변동 (수용 가능)

### 추가 개선 후보 (v7+)

| 우선순위 | 작업 | 예상 효과 |
|---------|------|---------|
| ~~🔴 높음~~ | ~~temperature=0 + seed 고정 실험~~ | **v6.1 실험 완료 — 롤백** (아래 참조) |
| 🟡 중간 | schema에 `methodology`/`document_type` 경계 더 명확화 | concept 분류 일관성 향상 |
| 🟡 중간 | anti-pattern에 운영 항목 추가 (issue-log, meeting-minutes 등) | 노이즈 7개 제거 |
| 🟢 낮음 | Phase D — Brief 모달에 schema preview/편집 UI | UX 개선 |
| 🟢 낮음 | 운영 사이클: 5회 std dev 자동 측정 → activity 로그 | 회귀 감지 |

---

## v6.1 실험 결과 (temp=0 + seed=42, 2026-04-19, 롤백)

### 실험 동기
v6 결정성 검증에서 std dev <5% 미달. Gemini의 `generationConfig.seed`로 결정성 추가 잠금 가능성 시험.

### 코드 변경
- `types.ts`: `LLMCallOptions.seed?: number` 추가
- `llm-client.ts`: `callGemini`가 `opts.seed` → `generationConfig.seed`로 전달
- `ingest-pipeline.ts` / `canonicalizer.ts`: `callLLMWithRetry`에 `temperature: 0, seed: 42` 전달

### 5회 결과 (gemini-2.5-flash, seed=42, temp=0)

| Run | Total | E | C | Duration |
|-----|-------|---|---|----------|
| flash-1 | 43 | 16 | 26 | 275s |
| flash-2 | 36 | 15 | 20 | 265s |
| flash-3 | 24 | 6 | 17 | 240s |
| flash-4 | 42 | 18 | 23 | 290s |
| flash-5 | 34 | 10 | 23 | 330s |
| **mean** | **35.8** | **13.0** | **21.8** | **280s** |

### v6 vs v6.1 CV%

| 지표 | v6 | v6.1 | 변화 |
|------|----|----|------|
| Total | 16.9% | 20.9% | ↑ 악화 |
| Entities | 14.7% | **36.3%** | ↑↑ 크게 악화 |
| Concepts | **33.4%** | 15.5% | ↓↓ 크게 개선 |

### 1회 추가: gemini-3.1-pro-preview (temp=0, seed=42)

| Run | Total | E | C | Duration |
|-----|-------|---|---|----------|
| pro | 24 | 16 | 7 | **220s** |

- Entity 16개 — flash 평균(13)보다 +23%
- Concept 7개 — flash 평균(22)보다 -68% (매우 보수적)
- 처리 시간 -21% (Pro의 thinking 효율)

### 결론

1. **seed=42는 결정성 보장 X** — Gemini "best-effort" 한계 명시 사실 확인
2. **temperature=0의 부작용** — 평균 분량 +5 증가, entities/concepts trade-off만 발생
3. **종합 CV는 오히려 악화** — 16.9% → 20.9%
4. **롤백** — `ingest-pipeline.ts`/`canonicalizer.ts`의 `temperature: 0, seed: 42` 제거. `LLMCallOptions.seed` 필드와 `llm-client.ts`의 seed 전달 로직은 v7 재실험 옵션으로 유지

### v6 = final 결정

- 5회 std dev 16.9% (분량 22-38)는 **LLM 본질적 비결정성 한계**
- v1~v5 시절의 "분류 자체 흔들림"(581→35→102)은 종결
- 분량 ±25% 변동은 **사용자 관점 수용 가능** (페이지 종류는 안정)

### Pro 모델 활용 가치 (참고)

Pro는 Concept을 매우 보수적으로 분류. 사용자가 "정확/엄격 분류"를 원할 때 모델 옵션으로 제공 가치 있음 (UX 작업으로 분리).

---

## 참조 (Karpathy + 커뮤니티)

- [Karpathy LLM Wiki gist](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f) — compounding 원칙
- [GraphRAG Indexing](https://microsoft.github.io/graphrag/index/overview/) — 추출/분류/요약 분리
- [LightRAG paper](https://arxiv.org/html/2410.05779v1) — deduplication을 정식 단계로
- [LlamaIndex SchemaLLMPathExtractor](https://docs.llamaindex.ai/en/stable/module_guides/indexing/lpg_index_guide/) — strict schema validation
- [Anthropic Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval) — v7 reference
- [Notion AI Autofill](https://www.notion.com/help/autofill) / [Mem Collections](https://help.mem.ai/features/collections) — 본문/분류 객체 분리
