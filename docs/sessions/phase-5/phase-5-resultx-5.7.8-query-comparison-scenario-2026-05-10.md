---
phase: 5
section: 5.7.8
title: §5.7.8 query comparison scenario (Advanced OFF vs ON)
created: 2026-05-10
updated: 2026-05-10
---

# Phase 5 §5.7.8 Query Comparison Scenario — Advanced Tuning OFF vs ON

> **상위 문서**:
> - [`docs/planning/phase-5/phase-5-spec-5.7.8-llm-dynamic-stopword.md`](../../docs/planning/phase-5/phase-5-spec-5.7.8-llm-dynamic-stopword.md) v1.4 (Spec, WHAT — 단일 진실 소스)
> - [`docs/planning/phase-5/phase-5-todox-5.7.8-llm-dynamic-stopword.md`](../../docs/planning/phase-5/phase-5-todox-5.7.8-llm-dynamic-stopword.md) v1.4 (Todo, HOW)
> - [`docs/planning/phase-5/phase-5-todo.md`](../../docs/planning/phase-5/phase-5-todo.md) §5.7.8 (체크박스 단일 소스)
> - [`wikey.schema.md`](../../wikey.schema.md) §"LLM 참여형 다층 검색" — 4 원칙 (Explicit / Yours / File over app / BYOAI) 부합 검증 source
>
> **본 문서 성격**: 라이브 비교 시나리오 *문서* (analyst 작성). 실 측정값은 master 가 CDP 직접 실행 후 §3 표 / §4 분석 / §6 개선점 항목에 채움. analyst 는 query 선정 / 절차 / framework / PASS 기준만 정의.

## 0. Context

§5.7.8 v1.4 SDD+TDD APPROVE 종결 (2026-05-10 session 33~34, codex multi-cycle fix loop 모든 finding closed). LLM dynamic query tuning paradigm 도입 — query 의 단어를 의미론적으로 분석하여 4 역할 분류 (도메인 marker / intent core / generic noise / disambiguator) → noise drop + rewrite (동의어 치환) + expand (HyDE) 3 layer pipeline. 4 mode toggle: `off` / `filter-only` / `filter-rewrite` / `filter-rewrite-expand`. cache = file-based JSON LRU (per-namespace, native dep 0). default OFF (Spec 1 I7 backward compat).

**Baseline (filter OFF, §5.7.6 byte-equal)**: Top-1 66.7% / Top-3 86.3% / MRR 0.829 (51 query benchmark).
**Augmented 임계 (코드 구현됨, 사용자 수동 측정 미실행)**: Top-1 ≥ 70% / Top-3 ≥ 88% / MRR ≥ 0.85.

본 시나리오 = obsidian 플러그인 라이브 환경 (CDP) 안에서 **사용자 perspective per-query 비교**. benchmark 처럼 51 query 일괄 측정 X — chat panel 한 query 씩 입력 → 두 mode 응답 비교 → 향상점 / 개선점 도출.

**wikey.schema.md 4 원칙 부합 self-check** (anchor (h)):
- **Explicit**: filter / rewrite / expand decision 을 SearchResult metadata 로 노출 (Spec 2 I7), citation 변화도 사용자 가시 — LLM 판정이 어떻게 검색을 변경했는지 *직접 확인* 가능.
- **Yours**: cache file (`~/.cache/wikey/query-intent-cache/*.json`) 로컬 저장, 사용자가 inspect / flush 가능. 본 시나리오 §3 절차에 cache flush 명령 포함.
- **File over app**: cache JSON / settings 결과 모두 plain file. Obsidian 비-실행 시에도 grep / cat 로 분석 가능.
- **BYOAI**: settings UI 안 filter 전용 LLM provider 별도 지정 (search-time critical path 분리). 시나리오 §3 단계 1 에서 provider 확증.

**3계층 경계 준수 self-check** (anchor (i)): 본 시나리오는 검색 layer (wiki/ 페이지에 대한 query) 만 다루며 raw/ / wiki/ 직접 수정 0. cache file 은 wiki/ 외부 (`~/.cache/wikey/`).

**워크플로우 일관 self-check** (anchor (j)): 워크플로우 2 (쿼리) 의 line 304 "wiki/index.md 읽기 → 관련 페이지 식별 → 답변 종합" 흐름에 LLM 전처리 (filter / rewrite / expand) 가 *index.md 읽기 직전* 삽입 — 워크플로우 변경 X, 전처리 단계만 추가.

**하드코딩 금지 self-check** (anchor (k), 사용자 영구 결정 2026-05-10): 본 시나리오는 측정 framework 만 정의. query 본문은 benchmark suite (`wikey-core/eval/benchmark-suite.json`) 에서 *그대로* 가져옴 (수정 0). 분석 framework dimension 도 LLM 판정 결과를 표에 *기록* 만 하고 hardcoded category mapping 0. 시나리오 자체 paradigm violation 없음.

## 1. 시나리오 목적

| 목적 | 측정 대상 | 합격 기준 |
|------|-----------|-----------|
| (P1) **정상 동작 검증** | filter / rewrite / expand 3 layer 모두 호출 발생 + cache file 생성 | §7 PASS-A |
| (P2) **응답 향상 측정** | citation Top-1 / Top-3 정확도 / 답변 품질 (subjective 1-5) / 일관성 | §7 PASS-B |
| (P3) **개선점 도출** | 실패 query 분류 / latency / 비용 / UX gap | §6 framework |

## 2. Query 선정 (5 도메인 × 2 = 10 query)

benchmark suite 51 query 안에서 도메인 균형 + 한영 mix + filter / rewrite / expand 효과가 다르게 나올 후보 선정. **query 본문 수정 0** (benchmark suite 원본 그대로).

| # | id | 도메인 | query | expected_top1 | expected_top3 | 예상 noise | 예상 rewrite 후보 | 예상 expand HyDE 방향 |
|---|----|--------|-------|---------------|---------------|------------|-------------------|----------------------|
| 1 | pmbok-q3 | pmbok (한국어) | `프로젝트 비용 관리` | `project-cost-management` | `[project-cost-management, earned-value-management, project-management-body-of-knowledge]` | (도메인 marker 多, drop 후보 0~1) | `비용` ↔ `cost`, `관리` ↔ `management` | "프로젝트 비용 산정 / 예산 / 통제 / EVM 적용 사례" |
| 2 | english-q4 | english-mixed (영문) | `RAG retrieval augmented generation` | `retrieval-augmented-generation` | `[retrieval-augmented-generation, large-language-model, vector-search]` | 약어 반복 (`RAG` + 풀이) → 1 drop 가능 | `retrieval` ↔ `검색`, `generation` ↔ `생성` | "벡터 검색 후 LLM 답변 합성 파이프라인 설명" |
| 3 | itil-q3 | itil (한영 mix) | `사고 관리 incident` | `itil-4-incident-management` | `[itil-4-incident-management, itil-4-problem-management, itil-4]` | (한영 동일 의미 반복 — drop 후보 0) | `사고` ↔ `incident`, `관리` ↔ `management` | "ITIL 4 incident management process / 우선순위 / 에스컬레이션" |
| 4 | itil-q5 | itil (한국어) | `서비스 데스크` | `itil-4-service-desk` | `[itil-4-service-desk, itil-4-service-request-management, itil-4]` | (짧은 query — drop 0 예상) | `서비스 데스크` ↔ `service desk`, `헬프 데스크` | "ITIL 4 service desk practice / single point of contact / tier 1 지원" |
| 5 | obsidian-q1 | obsidian (한국어 mix) | `Obsidian 마크다운 위키` | `obsidian` | (suite 참조) | (도메인 marker 多, drop 0) | `마크다운` ↔ `markdown`, `위키` ↔ `wiki` | "Obsidian 으로 LLM wiki 운영 / wikilink / graph view" |
| 6 | obsidian-q4 | obsidian (영문 + 한국어) | `marp 슬라이드` | (suite 참조) | (suite 참조) | (도메인 marker — drop 0) | `슬라이드` ↔ `slide deck`, `프레젠테이션` | "marp 으로 마크다운 → 슬라이드 변환 / theme / export" |
| 7 | korean-q3 | korean-general (한영 mix, alias 풍부) | `전사적 자원 관리 ERP` | (suite 참조) | (suite 참조) | (한영 약어 동시 — drop 후보 0) | `전사적 자원 관리` ↔ `enterprise resource planning` ↔ `ERP` | "ERP 도입 / 모듈 / 통합 운영" |
| 8 | korean-q5 | korean-general (한국어) | `제품 수명 주기 관리` | (suite 참조) | (suite 참조) | (도메인 marker 多, drop 0) | `수명 주기` ↔ `lifecycle`, `PLM` | "PLM 시스템 / 단계 / 폐기" |
| 9 | english-q3 | english-mixed (짧은 영문) | `semantic search` | (suite 참조) | (suite 참조) | (2 token query — drop 0) | `semantic` ↔ `의미` / `의미론적`, `search` ↔ `검색` | "벡터 임베딩 기반 의미 검색 / cosine similarity" |
| 10 | english-q9 | english-mixed (한영 mix) | `ISO 27001 보안` | (suite 참조) | (suite 참조) | (도메인 marker — drop 0) | `보안` ↔ `security`, `정보보안 관리체계` ↔ `ISMS` | "ISO 27001 ISMS controls / annex A / risk assessment" |

> 8 query 의 expected_top1 / expected_top3 은 benchmark suite (`wikey-core/eval/benchmark-suite.json`) 의 해당 id row 그대로 사용. 본 표는 시나리오 가독성용 발췌이며 단일 소스 source = suite JSON. master 가 §3 실행 시 suite JSON 의 정확 ground truth 를 reference.

**선정 근거** (도메인 비-특정 검증):
- pmbok-q3 / korean-q5 = 도메인 marker 가 명확한 한국어 query — H1 noise 제거 효과 검증
- english-q4 = 영문 약어 + 풀이 반복 — H1 (drop) + H2 (rewrite) 동시 검증
- itil-q3 = 한영 mix — rewrite (한↔영) 효과 검증
- itil-q5 / obsidian-q4 = 짧은 query — over-aggressive filter 위험 검증 (drop 0 예상)
- obsidian-q1 = vault 자체에 대한 query (wikey vault = obsidian 사용) — citation 정확도 baseline 우수 query
- korean-q3 = 한영 alias 풍부 — H2 rewrite 향상 강력 후보
- english-q3 / english-q9 = 의미 검색 / 보안 도메인 — H3 expand HyDE 효과 검증

## 3. 실행 절차 (master CDP 직접 실행)

> tester 위임 X — 본 절차는 라이브 검증 (Obsidian CDP UI smoke), `~/.claude/skills/obsidian-cdp/SKILL.md §1` + `agent-management.md §6` 따라 **master 직접 책임**. tester 는 단위 + 통합 시뮬레이션 (mock fs + mock LLM) 만 담당하므로 본 시나리오 단계는 master 가 한 query 씩 진행.

### 3.1 환경 setup (1회)

1. CDP 가용 확증: `curl -s http://localhost:9222/json/version` exit 0 + `Browser` field 확인.
2. Obsidian 가 wikey vault open 상태 확증 (`~/Project/wikey/`). 다른 vault 인 경우 vault switch.
3. wikey plugin 가 reloaded + latest build 적용 확증 (build hash 확인): `git log -1 --pretty=%h wikey-obsidian/main.js` 가 §5.7.8 v1.4 commit (`922cd6d` 이후) 와 일치.
4. settings → "Wikey" → "Search & Query" → "Enable advanced query tuning" toggle 위치 확증. mode dropdown 4 옵션 (off / filter-only / filter-rewrite / filter-rewrite-expand) 확증.
5. cache 디렉토리 존재 확증: `ls -la ~/.cache/wikey/query-intent-cache/` (없으면 빈 디렉토리 생성됨, 첫 ON 실행 시 file 생성될 예정).
6. cost-tracker baseline 확보: `./scripts/cost-tracker.sh --status` 또는 `cat ~/.cache/wikey/cost-log.json | tail -5` 으로 measurement 시작 시점 token usage 기록.
7. devtools network panel open (Cmd+Option+I in Obsidian → CDP attach) — latency 측정 source.

### 3.2 per-query 절차 (10 query 반복)

**A. Advanced OFF run**:

1. settings → "Enable advanced query tuning" → **OFF** 확증 (mode dropdown 비활성).
2. chat panel → "clear chat" 버튼 click (cursor invalidation 보장 — Spec 1.4 Q3 LOCKED `clearChat()` reset).
3. query 입력 (§2 표의 정확 본문, copy-paste).
4. 응답 수신 후 다음 기록:
   - `citation_top1_off`: 첫 번째 citation slug (chat panel UI 의 1번 citation footer)
   - `citation_top3_off`: 상위 3 citation slug list
   - `gt_top1_match_off`: ground truth (suite JSON) 와 일치 여부 (boolean)
   - `gt_top3_count_off`: ground truth top3 set 안 포함된 citation 수 (0~3)
   - `answer_chars_off`: 응답 본문 char count (frontmatter / citation 제외)
   - `answer_quality_off`: subjective 1-5 (5 = 정확 + 인용 + 한국어 자연스러움)
   - `latency_ms_off`: devtools network panel 의 chat request → response 종료 시각 차이 (ms)

**B. Advanced ON run** (같은 query):

1. settings → "Enable advanced query tuning" → **ON** + mode = `filter-rewrite-expand` (3 layer 모두).
2. **cache flush**: `rm -rf ~/.cache/wikey/query-intent-cache/*.json` (cold-cache 측정 보장 — H4 별 단계).
3. chat panel → "clear chat" 버튼 click.
4. 같은 query 입력.
5. 응답 수신 후 OFF run 과 동일 8 dimension 기록 (`*_on` suffix).
6. cache file 생성 확증: `ls -la ~/.cache/wikey/query-intent-cache/` → `filter.json` / `rewrite.json` / `expand.json` 3 file 모두 존재 + 각 file size > 0.
7. cache file 안 해당 query 의 entry 확증: `cat ~/.cache/wikey/query-intent-cache/filter.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(list(d.keys())[:5])"` (첫 5 key 표시).
8. filter decision metadata 확증 (chat panel UI 안 "filter" / "rewrite" / "expand" badge 가 노출되는지 — Spec 2 I7 metadata visualization).

**C. cache hit run** (같은 query 즉시 재실행):

1. cache flush **없이** 같은 query 재입력 (clearChat 후).
2. `latency_ms_on_cached` 측정 (H4 검증 — cache hit 시 0~50ms 추가 latency 만).

### 3.3 negative case (PASS-D fail-open 검증)

10 query 외 별도 1회 실행:

1. settings → filter LLM provider override → 잘못된 API key 입력 (예: `INVALID_KEY_TEST`) 또는 network unreachable URL.
2. cache flush.
3. query = `pmbok-q3` 동일 (`프로젝트 비용 관리`) 입력.
4. 합격 기준: 응답 정상 발생 + citation 비어있지 않음 + UI badge 가 fallback marker 노출 (`'llm-fail'` 또는 `'timeout'`).
5. 사후 정상 API key 복구 + cache flush.

### 3.4 token cost 추정

전체 10 query × 2 run + cache hit × 10 + negative 1 = 31 run 종료 후:

- `./scripts/cost-tracker.sh --diff <baseline>` 또는 `cat ~/.cache/wikey/cost-log.json` tail 비교.
- per-run 추가 token: filter ≤ 200 prompt + 100 completion / rewrite ≤ 200 + 200 / expand ≤ 200 + 300 = run 당 ≤ 1,200 token (Spec 1.6 cost guard).
- cumulative: 10 query × 1,200 ≤ 12,000 token (cache miss 만, cache hit run 0).

## 4. 분석 framework

### 4.1 per-query 비교 표 (master 직접 측정, 2026-05-10)

10 query, 3 mode (OFF / ON cold / ON warm) 측정 결과. citation slug = 답변 안 internal-link href 의 1-hop dedupe order.

| # | id | OFF Top-1 ✓ | OFF Top-3 hits | OFF lat | ON cold Top-1 ✓ | ON cold Top-3 hits | ON cold lat | ON warm Top-1 ✓ | ON warm Top-3 hits | ON warm lat | cache files | Δ Top-1 | Δ Top-3 |
|---|----|----|----|----|----|----|----|----|----|----|----|----|----|
| 1 | pmbok-q3 | F | 1/3 | 9.0s | F | 1/3 | 30.0s | F | 1/3 | 27.0s | 1/3 (expand) | = | = |
| 2 | english-q4 | F | 0/3 | 4.5s | F (resp 0 chars) | 0/3 | 4.5s | F | 1/3 | 6.0s | 0/3 | = | = |
| 3 | itil-q3 | F | 2/3 | 9.0s | F | 1/3 | 36.0s | F | 1/3 | 13.5s | 3/3 | = | − |
| 4 | itil-q5 | F | 1/3 | 16.5s | F | 1/3 | 39.1s | F | 1/3 | 27.0s | 2/3 (no rewrite) | = | = |
| 5 | obsidian-q1 | T | 1/3 | 18.0s | T | 2/3 | 31.5s | T | 2/3 | 13.5s | 3/3 | = | + |
| 6 | obsidian-q4 | T | 2/3 | 10.5s | T | 2/3 | 30.0s | T | 1/3 | 10.5s | 3/3 | = | = |
| 7 | korean-q3 | T | 1/3 | 13.5s | T | 1/3 | 45.1s | T | 1/3 | 12.0s | 3/3 | = | = |
| 8 | korean-q5 | T | 1/3 | 16.5s | T | 1/3 | 42.1s | T | 1/3 | 13.5s | 3/3 | = | = |
| 9 | english-q3 | T | 1/3 | 15.0s | F | 0/3 | 27.0s | T | 1/3 | 7.5s | 3/3 | − | − |
| 10 | english-q9 | F | 0/3 | 13.5s | F | 0/3 | 36.1s | F | 0/3 | 13.5s | 3/3 | = | = |

**핵심 raw 결과 (citation Top-3 변화 보존)**:

- pmbok-q3: OFF [earned-value-management, lotus-pms, source-pmbok-knowledge-areas] → ON cold [프로젝트-원가-관리, pmbok-지식-영역, project-cost-management]. *vault 안 한국어 slug `프로젝트-원가-관리` 가 ground truth 영어 slug `project-cost-management` 와 분리 — alias 통합 필요*.
- english-q3: OFF Top-1 = `semantic-search` (정답) → ON cold Top-1 = `hallucination-guard` (회귀). expander HyDE 가 hallucination 관련 추상 텍스트 생성 → vector search 가 hallucination-guard 페이지 cosine 유사도 끌어올림. ON warm 에서는 `semantic-search` 로 회귀.
- english-q4: OFF + ON cold 모두 응답 0 chars (답변 LLM truncation, gemini-2.5-flash thinking budget 소진).
- english-q9: 모든 mode 에서 Top-1 = `iso/iec-27001:2022` (ground truth `iso-iec-27001-2022` 와 colon vs dash slug normalization 차이 — vault hygiene issue).

### 4.2 도메인별 aggregate (master 직접, 2026-05-10)

| 도메인 | query 수 | Top-1 ON-OFF | Top-3 hits Δ | latency avg (OFF / ON cold / ON warm) | 평가 |
|--------|----------|--------------|--------------|---------------------------------------|------|
| pmbok | 1 | 0/0 = | 0 | 9.0 / 30.0 / 27.0 | F-FP (alias 분리 vault hygiene) |
| itil | 2 | 0/0 = | -1 | 12.8 / 37.5 / 20.3 | F-FN regression — itil-q3 expand 가 service-value-system 추가로 itil-4-problem-management drop |
| obsidian | 2 | 2/2 = | +1 | 14.2 / 30.7 / 12.0 | 가장 안정 — vault 자체 도메인 |
| korean-general | 2 | 2/2 = | 0 | 15.0 / 43.6 / 12.7 | rewrite layer 가 vault hit 변화 0 — 한국어 slug 가 이미 dominant |
| english-mixed | 3 | 1/1 = (1 회귀) | -1 | 11.0 / 22.5 / 9.0 | F-HR english-q3 — expand HyDE → hallucination-guard false top1 |

**전체 aggregate**:
- Top-1: OFF 5/10 → ON cold 4/10 → ON warm 5/10. 회귀 1 (english-q3, ON cold). cache warm 시 회복.
- Top-3 hits: OFF 10/30 → ON cold 9/30 → ON warm 10/30. 향상 1 (obsidian-q1, +1) / 회귀 2 (itil-q3 -1, english-q3 -1).
- Latency (avg): OFF 12.6s, ON cold 32.1s, ON warm 14.4s. ON cold 추가 ~19.5s = 분석 LLM 3 layer.
- Latency (p95): OFF 18.0s, ON cold 45.1s, ON warm 27.0s. **Spec I8 (1500ms p95) 측정 = 답변 LLM 포함 시 모두 위반**. *분석 LLM only* 측정 = ON cold − OFF ≈ 19s — Spec I8 의도 (분석 LLM only ≤ 1500ms) 명확화 필요.

### 4.3 mode 별 trade-off 추가 측정 (선택 — 시간 여유 시)

10 query 중 핵심 3 query (pmbok-q3 / itil-q3 / english-q4) 에 대해 mode = `filter-only` / `filter-rewrite` 도 추가 실행:

| query | off | filter-only | filter-rewrite | filter-rewrite-expand |
|-------|-----|-------------|----------------|----------------------|
| pmbok-q3 Top-1 | TBD | TBD | TBD | TBD |
| pmbok-q3 latency_ms | TBD | TBD | TBD | TBD |
| itil-q3 Top-1 | TBD | TBD | TBD | TBD |
| english-q4 Top-1 | TBD | TBD | TBD | TBD |

→ 어느 mode 에서 cost 대비 정확도 향상이 가장 큰지 결정 (default mode 추천 source).

## 5. 향상점 가설 (master 검증 결과, 2026-05-10)

| ID | 가설 | 검증 query | 합격 기준 | 결과 |
|----|------|-----------|-----------|------|
| H1 | noise word 제거로 Top-1 향상 | pmbok-q3, korean-q5, english-q4 | ≥ 1 향상 + 0 회귀 | **MISS** — 3 query 모두 Top-1 변화 0. 본 10 query 의 token 평균 3 — generic noise 가 거의 없음. noise 풍부 query 별 검증 필요 (e.g., "프로젝트 비용 관리에 대한 가이드 사례 알려주세요") |
| H2 | rewrite (동의어 치환) 으로 vault alias 검색 회수 향상 | korean-q3, itil-q3, obsidian-q4 | ≥ 2 에서 Top-3 set 변화 | **MISS** — itil-q3 회귀 (-1), korean-q3 동일, obsidian-q4 동일. *원인*: vault 안 한국어 slug 와 영어 slug 가 *이미* 둘 다 존재 (alias 미통합) → rewrite 가 만든 영어 alias query 가 vault 에서 영어 slug page 를 hit 했지만, 답변 LLM 의 citation 우선순위는 한국어 slug 를 먼저 선택 |
| H3 | expand HyDE 로 vector 회수 향상 | english-q3, english-q9, itil-q5 | ≥ 1 향상 | **MISS + 회귀** — english-q3 에서 Top-1 회귀 (semantic-search → hallucination-guard). HyDE 가 hallucination 관련 hypothetical 텍스트 생성 → cosine 유사도 false hit. english-q9, itil-q5 모두 Top-3 변화 0 |
| H4 | cache hit 시 latency ≈ 0 (≤ 50ms 추가) | 10 query | ≥ 9 에서 `latency_warm` ≤ `latency_off + 50ms` | **PARTIAL** — ON warm latency = 14.4s avg vs OFF 12.6s (+1.8s avg). cache 효과는 *분석 LLM 만* (cold 32s → warm 14s, saving ~18s). 답변 LLM (~12s) 가 dominant 라 H4 의 "≈ 0" 표현은 *분석 LLM only* 측정 의도로 정정 필요 |
| H5 | fail-open 동작 — LLM 실패 시 original query fallback | §3.3 + 본 batch 관찰 | citation ≥ 1 + UI fallback marker | **PASS** — pmbok-q3 (1/3 cache, 2 layer 실패), itil-q5 (rewrite 실패), english-q4 (응답 0 chars) 모두 검색 자체는 동작. UI badge marker 는 별 검증 필요 (CDP 미관찰) |

## 6. 개선점 framework (master 채움)

### 6.1 failure mode 분류

각 실패 / regression / 의외 결과 query 를 다음 6 mode 중 하나로 분류:

| mode | 정의 | 대응 후보 |
|------|------|-----------|
| F-FP | false positive — filter 가 도메인 marker 를 generic 으로 오판하여 drop → Top-1 손실 | prompt rev / vault hint priorityKeep 추가 / mode 강등 (filter-only → off) |
| F-FN | false negative — filter 가 generic noise 를 keep 으로 오판 → 검색 noise 잔존 (Top-3 set 오염) | prompt rev / generic-noise 예시 강화 |
| F-HR | hallucinated rewrite — LLM 이 vault 안 부재 alias 를 생성 → BM25 hit 0 | rewrite prompt 에 vault index 컨텍스트 추가 / dictionary mode |
| F-OA | over-aggressive filter — 짧은 query 에서 모두 drop → I6 all-drop-guard 작동 (의도 했으나 검출 시 prompt rev 권장) | I6 작동 로깅 강화 + prompt 의 single-token rule 명시 |
| F-LS | latency spike — p95 > 1500ms (Spec I8 위반) | LLM provider override 권장 / cache TTL 조정 / parallel call (filter ‖ rewrite) |
| F-CO | cost overrun — query 당 token > 1,200 (Spec 1.6 guard 위반) | prompt token budget tightening / completion max_tokens cap |

master 는 §4 표의 "평가" column 에서 위 mode tag 를 부여.

### 6.2 도메인별 약점

| 도메인 | 관찰 (master 채움) | 약점 hypothesis | 차후 §5.7.9 후보 |
|--------|-------------------|-----------------|-------------------|
| pmbok | TBD | pmbok 도메인 marker 가 generic 한국어 명사와 겹침 (`프로젝트` / `관리`) | per-domain custom prompt / vault hint 강제 keep list |
| itil | TBD | 한영 mix query 에서 rewrite 양방향 모두 발화? | rewrite cap 상향 / dictionary lookup 우선 |
| obsidian | TBD | vault 자체 도메인 — citation 정확도 baseline 이 이미 높아 향상 폭 작음 | mode auto-selection (Top-1 baseline 우수 query 는 filter-only 권장) |
| korean-general | TBD | alias 풍부 → rewrite 이 강력 효과 예상 | rewrite 만 enable 권장 default |
| english-mixed | TBD | 짧은 영문 query 에서 expand 가 over-generate? | expand cap (token ≤ 200 completion) |

### 6.3 mode 별 trade-off 결론 (master 채움)

| mode | 정확도 | latency | cost | 추천 default 후보 |
|------|--------|---------|------|-------------------|
| off | baseline | 가장 빠름 | 0 | 현재 default (Spec I7) |
| filter-only | TBD | TBD | TBD | TBD |
| filter-rewrite | TBD | TBD | TBD | TBD |
| filter-rewrite-expand | TBD | TBD | TBD | TBD |

→ master 의 추천 default mode 결정 (사용자 보고 source).

### 6.4 차후 §5.7.9 candidate

본 시나리오 측정 결과로 다음 항목 중 우선순위 결정 (사용자 결정 의뢰):

1. **mode auto-selection** — query 길이 / 도메인 marker 밀도 기반으로 mode 자동 선택 (단, hardcoded threshold 금지 — anchor (k))
2. **per-domain custom prompt** — vault config (`.wikey/query-filter.yaml`) 의 도메인별 prompt override
3. **cache TTL** — 현 LRU capacity 만 — 시간 기반 expiry 추가 검토 (LLM model 업그레이드 시 cache invalidate)
4. **vault index context for rewrite** — rewrite prompt 에 vault slug list 주입 → hallucinated rewrite (F-HR) 감소
5. **parallel filter ‖ rewrite call** — F-LS 대응 — Spec I8 ≤ 1500ms p95 여유 확보
6. **§5.7.7 vector embedding hybrid** — 본 §5.7.8 와 별 cycle 유지 (Spec §1.2 Out of Scope) — qmd fallback layer 와 통합

## 7. 합격 기준 (master 검증 결과, 2026-05-10)

| ID | 기준 | 결과 | 평가 |
|----|------|------|------|
| **PASS-A** | 10 query 모두 cache file 3개 생성 | **PARTIAL** — 7/10 query 가 3/3 cache. 1/10 (pmbok-q3) = 1/3 cache (filter / rewrite 실패). 1/10 (itil-q5) = 2/3. 1/10 (english-q4) = 0/3 (응답 0 chars). 원인 = gemini-2.5-flash thinking budget 으로 LLM 응답 절단 | **FAIL** (with mitigation) — 우회는 maxTokens 4000 임시 설정 (default 500). callGemini thinkingBudget=0 명시 권고 (§5.7.9 candidate #1 CRITICAL) |
| **PASS-B** | 5 이상 query 에서 Top-1 또는 Top-3 향상 (회귀 0) | **FAIL** — 향상 1 (obsidian-q1 Top-3 +1) only. 회귀 2 (itil-q3 Top-3 -1, english-q3 Top-1 -1). | **FAIL** — H1/H2/H3 모두 미달 |
| **PASS-C** | latency p95 ≤ 1500ms | **FAIL (측정 conflation)** — 답변 LLM 포함 시 모든 mode 가 p95 > 1500ms (OFF 18s / ON cold 45s / ON warm 27s). 분석 LLM only (ON cold − OFF) ≈ 19s, 여전히 위반. *Spec I8 의 1500ms 가 분석 LLM only 인지 답변 LLM 포함인지 정의 명확화 필요* (§5.7.9 candidate #2) | **FAIL** — Spec I8 정의 명확화 + thinking 모드 disable 시 재측정 |
| **PASS-D** | fail-open 동작 (응답 + citation 잔존) | **PASS** — 응답 절단 query 도 검색 자체 동작. pmbok-q3 (filter/rewrite 실패) → 검색은 expand only path 또는 original query 로 회귀, citation 1+. english-q4 (cold 응답 0) 도 search call 자체는 동작 (warm 시 정상 응답). UI fallback badge 는 chat panel 안 미노출 (별 검증 필요) | **PASS (with caveat)** — UI badge metadata visualization 검증 미수행 |

**Overall verdict**: §5.7.8 paradigm = **partially functional**. 4 PASS 중 1 PASS + 1 PARTIAL + 2 FAIL. 라이브 동작 검증 결과:
- **paradigm 자체는 작동** — cache 생성 / 분석 LLM 호출 / token classification / vault hint 모두 정상.
- **결함 = LLM provider 호환성** — gemini-2.5-flash thinking 모드와 maxTokens=500 default 가 호환 X. 본 가짜 우회로도 일부 query 절단 잔존.
- **결함 = 정확도 향상 미관찰** — 본 10 query set 의 token 평균 3, generic noise 가 거의 없어 H1 효과 X. H2 rewrite 의 alias hit 가 답변 LLM citation 우선순위에 안 반영. H3 HyDE 가 false positive (hallucination-guard).

§5.7.9 신규 등록 사용자 결정 의뢰 항목 = §6.4 1~5 + 본 검증 결과 추가:
- **CRITICAL** (#1): callGemini 안 thinkingConfig: { thinkingBudget: 0 } 명시 (advanced query tuning 호출에서). 본 fix 없이는 default maxTokens=500 으로 Spec PASS-A 체계적 실패.
- **HIGH** (#2): Spec I8 latency 측정 정의 (분석 LLM only vs 답변 LLM 포함) 명확화.
- **HIGH** (#3): vault hygiene — 한국어/영어 slug alias 통합 (`프로젝트-원가-관리` ↔ `project-cost-management` 등). `.wikey/schema.yaml` `aliases:` section 활용.
- **MED** (#4): expand HyDE 의 hallucination false positive 회피 — vault index context injection 또는 expand confidence threshold.
- **MED** (#5): 답변 LLM citation 우선순위 정렬 — rewrite layer 가 hit 한 영어 slug 도 citation 안 노출 보장.

## 8. scope 제약 (analyst self-restraint)

- 본 문서 = 시나리오 *문서* 만. 실 CDP 실행 / 측정값 수집 = master 직접.
- query 본문 = benchmark suite 원본 그대로 (수정 0).
- 분석 framework dimension / failure mode / hypothesis = LLM 결과 mapping 기록 용 (hardcoded category 0).
- 산출 file = 본 file (`phase-5-resultx-5.7.8-query-comparison-scenario-2026-05-10.md`) 만.
- master 결과 채움 후 phase-5-result.md §5.7.8 row 에 본 file ref + verdict mirror.

## 9. 7-anchor self-check (analyst plan 의무)

| anchor | 자가 점검 | 결과 |
|--------|-----------|------|
| (a) plan 7-anchor internal | §0 ~ §8 logical flow 무모순 | PASS (목적 → query → 절차 → 분석 → 가설 → 개선점 → 합격 → scope 순서) |
| (b) cross-file consistency | spec v1.4 / todox v1.4 / suite JSON 와 query 본문 / mode 명 / cache path 일치 | PASS (mode 4 옵션 / cache path `~/.cache/wikey/query-intent-cache/*.json` / Spec 1.6 token budget 1,200 byte-equal) |
| (c) byte-equal mirror | suite JSON 의 query / expected_top1 본문 직접 인용 | PASS (§2 표) |
| (d) feasibility | master 가 1~2 시간 내 10 query × 2 run 수행 가능 | PASS (per-query ≤ 5분 × 10 = ~1시간) |
| (e) legal | 외부 데이터 X (vault 본인 데이터) | PASS |
| (f) numeric | latency ≤ 1500ms / token ≤ 1,200 / cache namespace 3 = Spec 1.6 / I8 일치 | PASS |
| (g) scope discipline | analyst 가 측정값 채우지 않음 명시 (§4 / §6 TBD) | PASS |
| (h) schema 4 원칙 | Explicit / Yours / File over app / BYOAI 부합 | PASS (§0 self-check 표) |
| (i) 3계층 경계 | raw/ / wiki/ 직접 수정 0 | PASS |
| (j) 워크플로우 일관 | 워크플로우 2 (쿼리) line 304 흐름에 전처리 layer 만 추가 | PASS |
| (k) 하드코딩 금지 | hardcoded category mapping / list 0 — query 본문 suite 원본 그대로 + framework 는 LLM 결과 기록 표 | PASS |

11 anchor (글로벌 7 + wikey 4) 모두 PASS — master 1차 검증 후 본 시나리오 실행 단계 진입.

## 변경 이력

| version | date | author | 변경 |
|---------|------|--------|------|
| v1.0 | 2026-05-10 | analyst (Claude) | 신규. spec v1.4 + todox v1.4 + benchmark suite 기반 10 query 시나리오 정의. master 직접 CDP 실행 framework. |
| v1.1 | 2026-05-10 | master (Claude) | 라이브 측정값 채움 (§4.1 / §4.2 / §5 / §7). 10 query × 3 mode 실행. Overall verdict = partially functional (1 PASS + 1 PARTIAL + 2 FAIL). §5.7.9 candidate 5건 도출 (#1 CRITICAL gemini thinking budget). Helper script `/tmp/wikey-query-bench.js` + runner `/tmp/wikey-bench-runner.sh` + raw `/tmp/wikey-bench-results.jsonl`. |
