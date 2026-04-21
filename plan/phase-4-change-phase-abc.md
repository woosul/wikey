# Phase 4.5.1.5 — RAG Chunk 폐지 + LLM Wiki Phase A/B/C 이행 (v2)

> v1 → v2 (2026-04-21): Claude 자체 검증(8건) + Codex 적대적 검증(12건, 판정 NEEDS-REVISION) 반영.
> 주요 변경: Phase A 를 **완전 결정적**으로 전환(LLM 분류기 제거), Route 3분기 → **2분기**, char 임계 → **token budget**, "모두 core" fallback → **결정적 휴리스틱**, ablation 측정을 구현 **선행** 조건으로 상향, N=10 → N=30 (PMS 본 비교), **모든 verification 작업 TDD (RED → GREEN → REFACTOR)**.

## Context

**왜 이 변경을 하는가.**

`wikey.schema.md §19·§21` 은 LLM Wiki 의 문서 이해 모델을 명시적으로 정의한다: "전체를 정독하지 않되, 어디에 무엇이 있는지는 반드시 파악" — 즉 **독자가 먼저 훑고 색인을 만들고, 핵심 섹션만 심독**하는 Phase A/B/C 흐름. 동시에 `§21` 은 "검색을 DB에 위임하면 다시 RAG가 된다" 고 경고하며 RAG chunk 메타포를 명시적으로 배격한다.

그러나 현재 `wikey-core/src/ingest-pipeline.ts` 의 ingest 경로는 이와 어긋난다:

- `MAX_SOURCE_CHARS = 12_000` 초과 → `splitIntoChunks(maxChunkSize=8000)` (line 575) 8KB char cut → 각 chunk 독립 LLM 호출 → canonicalize 로 병합.
- chunk LLM 은 local view 만 → cross-section 엔티티 변이.
- `Mention.source_chunk_id` 는 canonicalize 에서 미사용 (`canonicalizer.ts:228-237`).
- `truncateSource` (line 1409) 는 Ollama 에서 중간 손실 위험.

`§4.5.1.4` 5-run 측정 (`activity/determinism-pms-v7-4514-2026-04-21.md`): **Total CV 32.5%, Entities 8–29 (3.6x), Concepts 10–25 (2.5x)**. Core entity 5/33 (15%), Core concept 8/35 (23%). Variable 리스트에 기술스택 (apache-tomcat, centos, intel-xeon, postgresql, rabbitmq 등) 집중.

2026-04-21 `§4.1` 완료로 Docling 구조적 markdown (H2 heading tree) 확보 — Phase A/B/C 이행 선행 조건 해제.

**목표**: RAG chunk 폐지 → LLM Wiki schema 부합하는 Phase A(**결정적 섹션 인덱스**) / Phase B(**전체 또는 섹션별 심독**) / Phase C(쿼리 시 온디맨드, 기존 index.md 활용) 로 전면 재편. **추가 LLM stochastic 단계 도입 없이** 철학 회복.

---

## v1 → v2 변경 요약

| 영역 | v1 | v2 | 이유 |
|---|---|---|---|
| Phase A | LLM 분류기 (core/support/skip) | **결정적 파서 + 휴리스틱 메타만** | LLM 분류기는 "retriever 의 변형" — schema §19 는 "어디에 무엇이 있는지 색인" 만 요구. 추가 stochastic 단계가 variance 증폭 |
| Route 분기 | 3분기 (SMALL/MEDIUM/LARGE) | **2분기 (FULL/SEGMENTED)** | 3-route 는 구현 복잡도 대비 효용 부족 |
| Route 판정 | char 임계 (30KB/200KB) | **token-budget (provider context)** | 한국어 1자 ≈ 2-3 토큰, 영어 1자 ≈ 0.3 토큰 → char 임계는 한국어에서 브로큰 |
| Route 1 병합 콜 | A+B+canon 단일 호출 | **삭제** | 내부 모순 + `ingest-pipeline.ts:447` 역사적 교훈 위반 |
| Peer context | title + priority 만 | **DOC_OVERVIEW + GLOBAL_REPEATERS + LOCAL_NEIGHBORS + DISAMBIGUATION_HINTS (~300 tok cap)** | title 만으로는 `PMS` 가 product/category/methodology 중 뭔지 모름 |
| Phase A 실패 fallback | "모두 core 처리" | **결정적 휴리스틱 (heading 매칭)** | "모두 core" 는 noise/variance/cost 최대화 |
| 섹션 파서 엣지 케이스 | heading-0 / >8KB / 빈 섹션 | **+ mixed levels, OCR `##` 노이즈, 가짜 heading, `##기술스택` (공백 없음), unhwp/DOCX 미검증** | v1 은 Docling H2-only 에 overfit |
| 측정 N | N=10 | **N=30 for PMS main, N=10 for route smoke** | N=10 sample SD 95% CI 0.69x-1.83x — inference 주장 불가 |
| CV ≤15% | ship gate | **aspiration (지향점), 실제 gate 는 selective rollback 기준** | 정량 floor mid-teens~low-20s |
| Ablation | 명시 안 함 | **선행 필수** | "섹션 경계가 주범" 은 정황 증거 — 성분 분해 후 진행 |
| Rollback | CV 미달 시 전량 revert | **per-component selective** | parseSections+TOC 유지, 문제 부분만 revert |
| temperature 가정 | 0.7-1.0 | **실측 0.1 확인** (llm-client.ts:6, 39, 138) | variance 원인 재평가 필요 |
| 구현 방식 | 일반 구현 | **모든 검증 가능 단위 TDD (RED → GREEN → REFACTOR)** | Karpathy #4 (Evidence-Based Completion) + CLAUDE.md 규약 |

---

## 현 구조의 문제 정리

| 증상 | 원인 | 증거 |
|---|---|---|
| Total CV 32.5%, Entities 8–29 | chunk 별 독립 LLM 의 cross-section blindness | `determinism-pms-v7-4514-2026-04-21.md` |
| 기술스택 항목 run마다 들락 | 기술스택 섹션이 chunk 경계에 걸림 (가설) | Variable 리스트 22건 중 11건이 기술스택 |
| `source_chunk_id` 무용 | canonicalize 에서 미참조 | `canonicalizer.ts:228-237` |
| Ollama 중간 손실 가능 | chunk > 12KB 시 truncateSource head/tail cut | `ingest-pipeline.ts:1409-1417` |
| LLM 호출 N+2 선형 | chunk 수 = 호출 수 | PMS 83KB → 8~12 chunks |
| schema §19 미구현 | ingest 가 RAG chunk 패턴 | `splitIntoChunks(8000)` line 575 |

**반증 가능성 (Codex #3 수용)**: 섹션 경계 주범설은 아직 **정황 증거**. 대체 요인:
- 추출 프롬프트 편향 ("빠뜨리는 게 낫다", "0~15개 정도") — `ingest-pipeline.ts:409`
- Canonicalizer 가 200자 evidence 만 봄 — `canonicalizer.ts:147`
- SLUG_ALIASES 5건, FORCED_CATEGORIES 3건만 (coverage 얕음)
- Seed 미설정 + default temperature 0.1
- JSON parse retry 가 다른 결과를 낼 수 있음

→ **§0 Ablation 으로 원인 분해 선행**.

---

## RAG chunk vs Phase A/B/C (v2) — 장단점

### 현재 RAG chunk 방식

**장점**: 구현 단순, 메모리 예측 가능, Ollama 바로 동작, 병렬화 용이

**단점**: 의미 경계 무시, cross-section blindness, variance 증폭, long-context 미활용, canonicalize prompt 팽창, schema §21 배격 대상, 대용량 급격 열화.

### Phase A/B/C v2 (결정적 A + token-budget 2-route)

**장점**:
- schema §19·§21 부합 (결정적 Phase A = LLM 은 독자로만 동작)
- 의미 경계 보존 (Docling H2 기반)
- Cross-section awareness (Route SEGMENTED peer context)
- LLM 호출 감소 (FULL 2콜, SEGMENTED N+1콜 but semantic boundaries)
- Long-context 활용
- Phase C 자연 enablement (섹션 TOC)
- source_section_idx 로 debug/lint
- **stochastic 단계 추가 없음** (v1 대비 variance 리스크 절감)

**단점**:
- 구현 복잡도 (~300-500 줄 신규, v1 대비 -40%)
- Ollama 경로 분기 필요
- 섹션 edge case (v2 확장)
- 측정 비용 (N=30 PMS ≈ 150분+)
- **섹션 경계가 진짜 원인 아니면 CV 개선 없음** → ablation 선행

---

## Phase A/B/C v2 설계

### §0 Ablation (구현 선행)

**목표**: "섹션 경계가 variance 주범" 가설의 정량 증거. 현 코드 변경 **없이** 측정만.

**실험 4건**:
1. **Frozen markdown**: 같은 Docling 출력본을 N회 ingest → source conversion variance 제거. CV 여전히 32% 면 경계 주범 아님.
2. **Extraction-only variance**: frozen markdown + frozen chunk split → `extractMentions` 만 N회 → mention list 변이.
3. **Canonicalizer-only variance**: frozen mention set → `canonicalize` 만 N회.
4. **Seed/temperature 실험**: Gemini `generationConfig.seed=42, temperature=0` 재검증.

**구현**: `scripts/ablation-ingest.sh` (§7.8). 각 실험 N=10 smoke.

**Gate**: 성분 파이차트 확보. 섹션 경계 기여 <30% → Phase A/B/C 이행 가치 재평가.

### §1 Phase A — 결정적 섹션 파서 (LLM 호출 0)

**입력**: Docling stripped markdown → **출력**: `Section[]`

```typescript
interface Section {
  idx: number; title: string; level: 1 | 2 | 3 | 4 | 5 | 6
  startLine: number; endLine: number
  body: string; bodyChars: number
  warnings: ReadonlyArray<SectionWarning>
  hasTable: boolean; tableRows: number
  acronymDensity: number      // 대문자 2-6자 토큰 / total tokens
  koreanCharCount: number
  headingPattern: 'toc'|'appendix'|'contact'|'revision'|'copyright'|'normal'
}

type SectionWarning =
  'merged-empty' | 'internal-split' | 'mixed-level' |
  'suspicious-heading' | 'table-only' | 'no-headings' | 'preamble'

type HeuristicPriority = 'skip' | 'core' | 'support'

function computeHeuristicPriority(s: Section): HeuristicPriority {
  if (s.headingPattern !== 'normal') return 'skip'
  if (s.bodyChars < 100) return 'skip'
  if (s.bodyChars > 200 && (s.acronymDensity > 0.05 || s.hasTable)) return 'core'
  return 'support'
}
```

**로직 (v2 확장, Codex #8 반영)**:
1. `^#{1,6}\s` 범용 regex (Docling 외 unhwp/DOCX 대비)
2. 첫 `##` 이전 preamble → pseudo-section idx=0 title="preamble" + warning `preamble`
3. 코드블록 (` ``` ` 펜스 내부) 의 `#` 은 heading 으로 간주 **안 함**
4. 반복 page header/footer 감지 — 같은 title 3회+ 반복 + body < 100자 → `'suspicious-heading'` + merge
5. 빈 섹션 (bodyChars < 50) → 이전 섹션 병합 + `'merged-empty'`
6. 테이블만 있는 섹션 (paragraph split 불가) → 테이블 행 단위 soft-split + `'table-only'`
7. heading 0 → 단일 pseudo-section + `'no-headings'`
8. mixed level (## + ###) → flat list, level 기록 + `'mixed-level'`
9. 결정성: 같은 입력 3회 호출 → 같은 출력 (테스트로 확증)

### §2 Route 판정 (token-budget)

```typescript
function estimateTokens(md: string): number {
  const koreanRatio = koreanCharCount(md) / md.length
  const divisor = koreanRatio > 0.6 ? 1.5 : koreanRatio > 0.2 ? 2.5 : 4.0
  return Math.ceil((md.length / divisor) * 1.3)   // 30% margin
}

function selectRoute(md: string, provider: string, model: string): 'FULL' | 'SEGMENTED' {
  const budget = getProviderBudget(provider, model)
  const usable = budget.contextTokens * (1 - budget.outputReserve) - budget.promptOverhead
  return estimateTokens(md) <= usable ? 'FULL' : 'SEGMENTED'
}
```

**Provider budget (provider-defaults.ts 확장)**:
- `gemini-2.5-flash`: 1_000_000 / 0.25 / 2000 → usable ≈ 748K tok
- `claude-haiku-4.5`: 200_000 / 0.25 / 2000 → 148K tok
- `gpt-4.1-mini`: 1_000_000 / 0.25 / 2000 → 748K tok
- `qwen3:8b` (Ollama): 32_000 / 0.3 / 2000 → 20.4K tok

PMS 83KB 한국어 (≈55K tok): Gemini/Claude/GPT → FULL, Ollama qwen3:8b → SEGMENTED.

### §3 Route FULL (2 LLM calls)

1. `parseSections` 결과 보관 (소스 페이지 TOC)
2. **Call 1**: `extractMentions` — 전체 markdown + 섹션 인덱스 메타 (peer context = 전체 TOC 자체)
3. **Call 2**: `canonicalize` (기존 유지)

### §4 Route SEGMENTED (Ollama 등)

priority heuristic 으로 섹션 분류:
- `core` 섹션 → Phase B 섹션당 1콜
- `support` 섹션 → snippet 만 마지막 core 콜에 묶어 전달
- `skip` 섹션 → 제외 (소스 페이지 TOC 에만 기록)

**Peer context 포맷 (Codex #4, ~300 tok cap)**:

```text
DOC_OVERVIEW: <TOC heading 쉼표 구분, 200자 cap>
GLOBAL_REPEATERS: <전체 doc 에서 3회+ 등장하는 acronym/고유명 상위 10개>

CURRENT_SECTION:
- idx: 12
- title: 기술 스택
- priority: core (heuristic)
- hasTable: true, acronymDensity: 0.08

LOCAL_NEIGHBORS:
- prev §11 시스템 개요 | core | tokens: pms, mes, scm
- next §13 인프라 요구사항 | core | tokens: centos, rabbitmq, postgresql

DISAMBIGUATION_HINTS:
- `PMS` 는 이 문서에서는 주로 `lotus-pms` (product)
- tech stack 이름들은 supporting tools, product feature 아님
```

**GLOBAL_REPEATERS 추출 결정적**: 전 섹션 bodies 에서 대문자 2-6자 토큰 + 고유명 후보 빈도, frequency ≥ 3 상위 10개.

### §5 Canonicalize (현행 유지)

schema validation + SLUG_ALIASES + FORCED_CATEGORIES 변경 없음. `Mention.source_chunk_id` → `source_section_idx` rename.

### §6 Phase C (기존 구조 재사용 + 소스 페이지 섹션 TOC)

신규 LLM 없음. 소스 페이지 body 에 섹션 TOC append:

```markdown
## 섹션 인덱스

| § | 제목 | 본문 | priority (heuristic) | 경고 |
|:-:|:-|-:|:-:|:-|
| 0 | 서두 | 420 chars | core | — |
| 1 | 기술 스택 | 2,180 chars | core | — |
| 2 | 참고문헌 | 520 chars | skip | — |
```

priority 는 **결정적 휴리스틱**. 쿼리 시 LLM 이 TOC 를 읽고 "이 섹션 재독" 결정은 §4.5.1.5 범위 외.

---

## §7 파일별 변경 계획

### §7.1 신규 — `wikey-core/src/section-index.ts` (~250 줄)

Pure 함수만, LLM client 의존 없음.

Exports:
- `parseSections(md) → ReadonlyArray<Section>`
- `buildSectionIndex(md) → SectionIndex` (sections + globalRepeaters + langHint)
- `computeHeuristicPriority(s) → HeuristicPriority`
- `formatPeerContext(index, currentIdx, tokenCap?) → string`
- `formatSourceTOC(index) → string`

### §7.2 수정 — `wikey-core/src/ingest-pipeline.ts`

**삭제**: `splitIntoChunks` (575-607), Large-doc block (199-255), `MAX_SOURCE_CHARS` 참조

**추가**: `estimateTokens`, `selectRoute`, `getProviderBudget`, `runRouteFull`, `runRouteSegmented`

**수정**: `callLLMForSummary`/`extractMentions` 시그니처에 `sectionIndex?` 추가. `truncateSource` → 섹션 단위 (Route SEGMENTED 에서 단일 섹션이 budget 초과 시에만)

### §7.3 수정 — `wikey-core/src/types.ts`

- `Mention.source_chunk_id?: number` → `source_section_idx?: number` (frontmatter/log 전수조사 후 rename)

### §7.4 수정 — `wikey-core/src/canonicalizer.ts`

필드 rename 반영 + debug log 에 섹션 번호 출력. 로직 무변경.

### §7.5 수정 — `wikey-core/src/provider-defaults.ts`

`PROVIDER_CONTEXT_BUDGETS` 신규 export.

### §7.6 신규 — `wikey-core/src/__tests__/section-index.test.ts`

TDD 기반 15+ tests (pure 함수, LLM mock 없음).

### §7.7 수정 — `wikey-core/src/__tests__/ingest-pipeline.test.ts`

Route FULL/SEGMENTED 테스트로 교체.

### §7.8 신규 — `scripts/ablation-ingest.sh`

§0 ablation 자동화 (4 실험 × N=10 smoke).

### §7.9 수정 — `scripts/measure-determinism.sh`

- N=30 지원 (timeout 스케일)
- "Route selected" + "Section priority per run" 로그 추가

### §7.10 수정 — `wikey-core/src/wiki-ops.ts`

source 카테고리 createPage 시 섹션 TOC append (formatSourceTOC 사용).

### §7.11 수정 — `wikey-obsidian/src/{sidebar-chat,commands}.ts`

Progress UI: "Chunk i/N" → "Route FULL" 또는 "Section i/N (SEGMENTED)".

### §7.12-14 문서 업데이트

- `plan/phase-4-todo.md §4.5.1.5` v2 체크박스 (§13)
- `plan/session-wrap-followups.md` 완료 상태
- `activity/phase-4-result.md §4.5.1.5` 신규 섹션
- `wiki/log.md` 엔트리

---

## §8 단계별 실행 순서 — TDD 기반

각 구현 단계는 **RED (실패 테스트 작성) → GREEN (최소 구현) → REFACTOR (단순화)** 사이클을 명시적으로 돈다. 🔄 병렬 가능.

```
1. plan/phase-4-todo.md §4.5.1.5 v2 체크박스 교체

2. 🔄 Ablation: scripts/ablation-ingest.sh 작성 + PMS 실행 (백그라운드 ~60분)
   └ RED: ablation 결과 비어있음 → GREEN: 4 실험 출력 확보

3. 🔄 TDD: section-index.ts
   3.1 RED: parseSections 결정성 테스트 (빈 입력 → 빈 배열) → 함수 stub 추가 → PASS
   3.2 RED: 단일 `##` heading → 1 섹션
   3.3 RED: 코드블록 내부 `#` 제외
   3.4 RED: 빈 섹션 병합 warning
   3.5 RED: 반복 page header/footer 감지
   3.6 RED: `##기술스택` 공백 없음 허용
   3.7 RED: heading 0 개 pseudo-section
   3.8 RED: mixed level (## + ###) flat list
   3.9 RED: 결정성 3회 호출
   3.10 RED: computeHeuristicPriority 각 분기
   3.11 RED: globalRepeaters 추출 결정성
   3.12 RED: formatPeerContext token cap
   (각 RED 후 GREEN, 마지막에 REFACTOR)

4. TDD: types.ts rename + canonicalizer.ts 반영
   4.1 grep 전수조사: `source_chunk_id` 외부 노출 확인
   4.2 RED: canonicalizer.test.ts 기존 테스트 필드명 갱신 → FAIL
   4.3 GREEN: types.ts + canonicalizer.ts rename
   4.4 REFACTOR: 불필요한 legacy 분기 제거

5. TDD: provider-defaults.ts budget
   5.1 RED: PROVIDER_CONTEXT_BUDGETS 키 없음 테스트
   5.2 GREEN: 4 provider budget 추가

6. TDD: ingest-pipeline.ts selectRoute
   6.1 RED: estimateTokens 한국어/영어/mixed 분기 테스트
   6.2 GREEN: estimateTokens 구현
   6.3 RED: selectRoute — Gemini + PMS 크기 → FULL
   6.4 RED: selectRoute — Ollama qwen3:8b + PMS → SEGMENTED
   6.5 GREEN: selectRoute 구현

7. TDD: runRouteFull (mock LLM)
   7.1 RED: 2-call (extractMentions + canonicalize) mock 시퀀스 검증
   7.2 GREEN: runRouteFull 구현

8. TDD: runRouteSegmented (mock LLM)
   8.1 RED: 섹션 수 = 호출 수 + 1 (canonicalize)
   8.2 RED: peer context 포맷 검증 (DOC_OVERVIEW / GLOBAL_REPEATERS / LOCAL_NEIGHBORS 포함)
   8.3 RED: priority skip 섹션은 호출 없음
   8.4 GREEN: runRouteSegmented 구현

9. 기존 chunk 삭제
   9.1 splitIntoChunks 삭제 + large-doc block 제거
   9.2 MAX_SOURCE_CHARS 제거
   9.3 기존 large-doc 통합 테스트 제거 (새 Route 테스트로 교체됨)
   9.4 npm test 전체 PASS 확증

10. TDD: wiki-ops.ts 섹션 TOC
    10.1 RED: source 카테고리 createPage → TOC 섹션 포함
    10.2 GREEN: formatSourceTOC append 로직

11. Obsidian UI progress 갱신 + E2E smoke
    11.1 sidebar-chat.ts/commands.ts "Route …" 메시지
    11.2 esbuild 0 errors
    11.3 수동 Cmd+R + 간단 ingest 확인

12. 전체 빌드 + 테스트 게이트
    12.1 npm run build:core (tsc 0)
    12.2 npm run build:obsidian (esbuild 0)
    12.3 npm test — 251 → 266+ PASS, 0 fails
    12.4 Karpathy #4: fresh 실행 증거 로그

13. Ablation 결과 수합 (단계 2 병렬 진행분)
    13.1 activity/ablation-pms-<date>.md 생성
    13.2 변수 분해 파이차트 + 해석
    13.3 Gate 판정: 경계 기여도 <20/20-50/>50% 분기

14. 10-run smoke × 2 route (ablation gate 관계없이)
    14.1 Route FULL (Gemini PMS)
    14.2 Route SEGMENTED (Ollama PMS)

15. 30-run PMS main (ablation gate 통과 또는 "철학 가치" 판정 시)
    15.1 measure-determinism.sh N=30
    15.2 activity/determinism-pms-v8-<date>.md 작성
    15.3 §4.5.1.4 baseline 대비 비교 표

16. activity/phase-4-result.md §4.5.1.5 기록
    16.1 배경 + v1→v2 경위 + ablation 요약 + 측정 결과 + selective rollback 결정

17. 문서 동기화 (CLAUDE.md 플로우 준수)
    17.1 result-doc-writer 스킬로 §4.5.1.5 result/todo mirror 점검
    17.2 wiki/log.md 엔트리
    17.3 plan/session-wrap-followups.md 갱신

18. 단일 commit + push
```

**Checkpoint 방식**: 각 단계 완료 후 간단 보고 ("[N/18] …"). 중간 중단 가능.

**Ablation Gate (단계 13 후)**:
- 경계 기여 > 50% → 15 예정대로 30-run 진행
- 20~50% → 30-run 진행 + Expected CV 개선폭 재산정
- <20% → 구현 유지(철학 가치) + 15 smoke 로 축소 + `§4.5.1.6` (LLM 수준 variance 분석) 신규 생성 → 사용자 확인

---

## §9 Verification (모두 TDD)

### 단위 테스트 — RED/GREEN 명시

- `section-index.test.ts` (§7.6): 12+ RED → GREEN cycles
- `ingest-pipeline.test.ts` (§7.7): Route FULL/SEGMENTED RED → GREEN
- `canonicalizer.test.ts`: 필드 rename RED → GREEN
- `provider-defaults.test.ts` (신규 소형): PROVIDER_CONTEXT_BUDGETS RED → GREEN
- **Gate**: 251 → 266+ PASS, 0 fails, **fresh 실행 출력 복사**

### 빌드 — 증거 캡처

```
$ npm run build:core
# tsc output 0 errors

$ npm run build:obsidian
# esbuild 0 errors
```

### Ablation 측정 (단계 2)

```bash
./scripts/ablation-ingest.sh raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf -n 10
# → activity/ablation-pms-<date>.md
```

### 10-run smoke + 30-run main

```bash
./scripts/measure-determinism.sh raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf -n 10   # smoke
./scripts/measure-determinism.sh raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf -n 30   # main
```

**Gate (지향점)**:
- Total CV: aspiration ≤15%, ship gate = "ablation 예상 기여도 × 추정 해소율 이상의 개선폭"
- Core entities: aspiration ≥40%
- Core concepts: aspiration ≥50%
- **Route 판정 결정성: 같은 문서 10회 → 같은 Route 100%**
- **섹션 priority 결정성: run 별 priority 100% 동일**

### 수동 검증

- Obsidian Cmd+R → PMS PDF ingest → 소스 페이지 TOC 노출 + priority 정확
- Ingest progress UI "Route FULL" / "Section i/N (SEGMENTED)" 노출
- `wiki/log.md` 엔트리 형식 정상

---

## §10 Risks & Mitigations

| 위험 | 영향 | 완화 |
|---|---|---|
| Ablation: 섹션 경계 주범 아님 판명 | Phase A/B/C ship 근거 약화 | 구현은 유지 (철학·Phase C), gate 변경 → selective rollback, `§4.5.1.6` 신규 |
| token estimation 부정확 | Route 오선택 | 30% margin + runtime overflow 감지 시 Route 자동 downgrade |
| 섹션 파서 엣지 miss | 섹션 수 오분할 | warnings 배열 기록, 측정 시 warning 분포 추적 |
| Route SEGMENTED 섹션 >30개 | LLM 호출 폭증 | support 섹션 묶어 1콜 spill, heuristic core filter 강화 |
| Progress UI 회귀 | 사용자 인지 부정확 | E2E CDP smoke (수동) |
| Ollama 200KB 한국어 overflow | FULL 불가 + SEGMENTED 섹션 큼 | 섹션 내 paragraph fallback + token-capped snippet |
| canonicalize 가 bottleneck 지속 | variance 개선 한정 | SLUG_ALIASES 확장은 별 과제 (§4.5.1.7 후보) |
| source_chunk_id 외부 persistence 존재 | rename 시 호환성 깨짐 | 4.1 전수 grep (frontmatter/log 포함) |

---

## §11 Critical Files

- `/Users/denny/Project/wikey/wikey-core/src/section-index.ts` (**신규**, ~250줄)
- `/Users/denny/Project/wikey/wikey-core/src/ingest-pipeline.ts` (수정, -200 +250줄)
- `/Users/denny/Project/wikey/wikey-core/src/types.ts` (rename)
- `/Users/denny/Project/wikey/wikey-core/src/canonicalizer.ts` (rename + debug log)
- `/Users/denny/Project/wikey/wikey-core/src/provider-defaults.ts` (PROVIDER_CONTEXT_BUDGETS)
- `/Users/denny/Project/wikey/wikey-core/src/wiki-ops.ts` (섹션 TOC)
- `/Users/denny/Project/wikey/wikey-core/src/__tests__/section-index.test.ts` (**신규**)
- `/Users/denny/Project/wikey/wikey-core/src/__tests__/ingest-pipeline.test.ts` (갱신)
- `/Users/denny/Project/wikey/wikey-obsidian/src/{sidebar-chat,commands}.ts` (progress)
- `/Users/denny/Project/wikey/scripts/ablation-ingest.sh` (**신규**)
- `/Users/denny/Project/wikey/scripts/measure-determinism.sh` (N=30 + 로그)
- `/Users/denny/Project/wikey/plan/phase-4-todo.md §4.5.1.5` (v2 재작성)
- `/Users/denny/Project/wikey/activity/phase-4-result.md §4.5.1.5` (신규 섹션)
- `/Users/denny/Project/wikey/plan/session-wrap-followups.md` (완료 후 상태)
- `/Users/denny/Project/wikey/wiki/log.md` (엔트리)

---

## §12 Out of Scope

- Phase C 자동화 — Phase 5 후보
- `.wikey/phase_a_prompt_user.md` — Phase A 결정적이라 N/A
- Ollama SEGMENTED 병렬화 — 별도 세션
- Temperature=0 + seed 공식 도입 — ablation 실험 4 결과 보고 `§4.5.1.6` 후보
- Canonicalizer prompt 개선 — `§4.5.1.7` 후보
- HWP/DOCX heading tree 검증 — `§4.2` 합동
- 섹션별 캐시 — 현 sourceBytes+converter 키 유지

---

## §13 v2 todo 체크박스 (plan/phase-4-todo.md §4.5.1.5 교체 대상)

```markdown
#### 4.5.1.5 LLM Wiki Phase A/B/C (v2) — 결정적 Phase A + 2-route + ablation 선행 + TDD

v1 (Codex NEEDS-REVISION) → v2: Phase A 완전 결정적, Route 2분기, token-budget, 결정적 fallback, ablation 선행, N=30, 모든 verification TDD.

**§0 Ablation (구현 선행)**
- [ ] TDD: `scripts/ablation-ingest.sh` 신규 (RED: dry-run → GREEN: 4 실험 실행)
- [ ] PMS PDF N=10 smoke
- [ ] `activity/ablation-pms-<date>.md` variance 성분 분해

**§1 Phase A 결정적 파서 (TDD)**
- [ ] RED: parseSections 결정성 (3회 동일 출력)
- [ ] RED: heading 패턴 다양성 (0개, ## only, mixed, 공백 없음, 코드블록 제외)
- [ ] RED: 빈 섹션 병합 + 반복 heading merge
- [ ] RED: table-only / preamble / headingless 문서
- [ ] RED: computeHeuristicPriority 각 분기
- [ ] RED: globalRepeaters / formatPeerContext / formatSourceTOC
- [ ] GREEN: section-index.ts 구현 (~250줄)
- [ ] REFACTOR: 중복 제거

**§2 Token-budget Route 판정 (TDD)**
- [ ] RED: estimateTokens 한국어/영어/mixed
- [ ] RED: selectRoute Gemini/Claude/OpenAI/Ollama 각 케이스
- [ ] GREEN: provider-defaults.ts PROVIDER_CONTEXT_BUDGETS + estimateTokens + selectRoute

**§3-4 Route 구현 (TDD)**
- [ ] RED: runRouteFull 2-call 시퀀스
- [ ] RED: runRouteSegmented 섹션 수 = N+1 호출
- [ ] RED: peer context 포맷 (DOC_OVERVIEW/GLOBAL_REPEATERS/LOCAL_NEIGHBORS/DISAMBIGUATION_HINTS)
- [ ] RED: priority skip 섹션 호출 없음
- [ ] GREEN: runRouteFull + runRouteSegmented 구현
- [ ] truncateSource 섹션 단위 정비

**§5 기존 chunk 제거 + rename (TDD)**
- [ ] grep 전수조사: source_chunk_id 외부 노출
- [ ] RED: 기존 테스트 필드명 갱신 → FAIL
- [ ] GREEN: types.ts + canonicalizer.ts rename
- [ ] splitIntoChunks 삭제, MAX_SOURCE_CHARS 제거
- [ ] 기존 large-doc 테스트 제거

**§6 Phase C 근거 데이터 (TDD)**
- [ ] RED: source 카테고리 createPage → TOC 섹션 포함
- [ ] GREEN: wiki-ops.ts formatSourceTOC append
- [ ] sidebar UI progress "Route …/Section i/N"

**§7 측정**
- [ ] 10-run smoke × 2 route (FULL Gemini, SEGMENTED Ollama)
- [ ] 30-run PMS main (Gemini, ablation gate 후)
- [ ] Route 판정 + 섹션 priority 결정성 확증

**§8 문서 동기화**
- [ ] `activity/phase-4-result.md §4.5.1.5` 기록
- [ ] `wiki/log.md` 엔트리
- [ ] `plan/session-wrap-followups.md` 갱신
- [ ] 단일 commit + push
```

---

## §14 시작점

이 계획 저장 직후 **단계 1 (plan/phase-4-todo.md §4.5.1.5 v2 체크박스 교체)** 부터 순차. 단계 2 (ablation 백그라운드) 와 단계 3 (section-index.ts TDD) 는 병렬. 단계 13 결과가 단계 15 gate.
