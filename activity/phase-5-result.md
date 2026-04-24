# Phase 5: 튜닝·고도화·개선·확장 — 활동 기록

> 기간: Phase 4 (본체 완성) 완료 후 — 착수 시 갱신.
> 상태: **skeleton** — 2026-04-22 Phase 재편으로 생성. 실제 진행 시 subject 별 타임라인을 아래에 채운다.
> 전제: Phase 4 본체에서 원본 → wiki ingest 프로세스가 wiki 재생성 유발 없이 돌아가는 구조가 확정되어 있다. 본 Phase 는 성능·품질·범위 확장과 self-extending 구조를 덧붙이되, 기존 wiki 재생성을 요구하지 않는 범위로 한정.
> 구성 원칙: 번호·제목·태그는 `plan/phase-5-todo.md` 와 1:1 mirror. subject 내부는 시간 순 타임라인 + 수치/커밋/파일경로 증거 보존.
> 이력:
> - 2026-04-22 Phase 재편으로 Phase 4 의 일부 subject (§4.4.1/.2/.3, §4.5.1.7.1/.4/.6/.7, §4.5.2 일부, §4.5.3/.4/.5) 를 본체 완성 정의 ("wiki 재생성 없음") 기준으로 이관해 신규 Phase 5 생성. 기존 Phase 5 (웹) 는 Phase 6 으로 이동 (`plan/phase-6-todo.md`).
> - 2026-04-25 P0~P4 재번호 반영으로 섹션 재구성 (2026-04-24 session 8 Phase 4 본체 완성 선언 + `plan/phase-5-todo.md` 전면 재번호와 mirror).

## 관련 문서

- **Todo mirror**: [`plan/phase-5-todo.md`](../plan/phase-5-todo.md)
- **보조 문서**: 착수 시 `phase-5-todox-<section>-<topic>.md` · `phase-5-resultx-<section>-<topic>-<date>.md` 형식으로 추가 (`CLAUDE.md §문서 명명규칙·조직화` 참조).
- **프로젝트 공통**: [`plan/decisions.md`](../plan/decisions.md) · [`plan/plan_wikey-enterprise-kb.md`](../plan/plan_wikey-enterprise-kb.md).

---

## 5.1 구조적 PII 탐지 (P0)
> tag: #pii, #structure, #ner
> **이전 번호**: `was §5.8.6` (2026-04-24 session 8 신설, 우선순위 재조정으로 §5.1 승격).

### 5.1.1 본체 구현 — Context window heuristic (안 C) 채택 (2026-04-25)

**목표 (계획서 §12 E1~E11)**: Phase 4 D.0.l smoke 실누출 재현을 재현 불능으로 만드는 structural 패턴 엔진 착륙. 하드코딩 금지 — 이름·슬러그·회사명 blacklist 는 YAML 단일 소스.

**산출물 (§9 단계 분해)**:
- `wikey-core/src/pii-patterns.ts` — discriminated union 도입. `PiiPattern = SingleLinePiiPattern | StructuralPiiPattern` (`patternType` discriminator). `CompiledPiiPattern` 도 union 화. loader/compiler 전부 `patternType === 'structural'` 분기. legacy YAML (patternType 누락) → single-line fallback. loader ESM 전환 완료 (`require('node:fs|path|os')` → top-level `import`).
- `wikey-core/src/pii-redact.ts` — `detectPiiInternal` 에 `collectStructuralMatches()` 분기 추가. non-empty 줄 기반 windowLines, multi-value capture, valueExcludePrefixes (candidate 직접 접두어 + 같은 줄 직전 1~2 token) 검사. `sanitizeForLlmPrompt` 시그니처 확장: `{ guardEnabled, structuralAllowed?: boolean }` (default false — filename/LLM prompt 경로는 structural 자동 차단).
- `wikey-core/src/defaults/pii-patterns.default.yaml` (신규) — bundled default 6 패턴 (기존 single-line 4 + structural CEO/BRN). `new URL('./defaults/...', import.meta.url)` + `fs.readFileSync` 로 런타임 로드, 실패 시 TS `DEFAULT_PATTERNS` (single-line 4종) fallback.
- `wikey-core/package.json` — build 스크립트에 `node -e "require('node:fs').cpSync('src/defaults','dist/defaults',{recursive:true})"` 추가. 신규 런타임 의존성 0 (E8).
- `wikey-core/src/__tests__/fixtures/pii-structural/` (신규 7종) — `ceo-3-block-real-repro.md` · `ceo-blank-line.md` · `ceo-4th-line-ceo.md` · `ceo-out-of-window.md` · `ceo-table-cell.md` · `brn-label-line-break.md` · `false-positive-corp-name.md`. 전부 synthetic (`주식회사 테스트벤치` · `홍 길 동` 등).
- `wikey-core/src/__tests__/fixtures/pii-structural-baseline/` (신규 30종) — synthetic PII-free 한국어 테크 문서 (Python/React/Docker/OAuth 등). `대표자`·`사업자등록번호` 같은 label 키워드 포함 금지.
- `wikey-core/src/__tests__/pii-structural.test.ts` (신규) — 12 tests: fixture 기반 매칭 8 + YAML loader/discriminator 2 + mergePatterns 1 + FP baseline 0/30 1.

**RED → GREEN 증거 (Karpathy #4)**:
- RED (구현 전, 2026-04-25 02:45): `npx vitest run src/__tests__/pii-structural.test.ts` → 8 failed / 3 passed. 실패는 전부 `pii-redact.ts:114 p.regex.lastIndex — Cannot set properties of undefined` — detectPiiInternal 에 structural 분기 부재 증거.
- GREEN (구현 후, 2026-04-25 02:52): `npx vitest run src/__tests__/pii-structural.test.ts` → 12 passed (11 fixture+loader + 1 FP baseline).
- 전체 회귀 (2026-04-25 02:53): `npm test` → **537 passed / 26 test files** (Phase 4 기준 525 → +12 structural). 0 failed.
- 빌드 (2026-04-25 02:53): `npm run build` → 0 errors. `dist/defaults/pii-patterns.default.yaml` (2634 bytes) 번들 산출물 존재.

**§12 성공 기준 대응**:

| # | 기준 | 상태 | 증거 |
|---|------|------|------|
| E1 | smoke 재실행 BRN 누출 0건 | ✅ | 2026-04-25 master 직접 CDP smoke: Obsidian `--remote-debugging-port=9222` 기동 후 `dist/pii-patterns.js` + `dist/pii-redact.js` detectPii 로 fixture 7종 + baseline 30종 end-to-end 실행. BRN 라벨+줄바꿈 (`123-45-67890`) 은 `brn-hyphen` single-line 으로 매치 → 누출 차단 확증. `wiki/sources/` · `wiki/entities/` pre-check grep 결과 0 hit. |
| E2 | structural matcher 작동 + entity 페이지 0 | ✅ | (a) structural matcher 작동: CDP smoke 7 fixture 에서 `ceo-structural` 이 `홍 길 동`·`김 철 수`·`이 영 희` 전부 매치. (b) entity 페이지: `wiki/entities/` pre-check grep 결과 0 hit (이미 깨끗). |
| E3 | `wiki/index.md`·`wiki/log.md` CEO 성명 확산 0건 | ✅ | pre-check grep: `wiki/sources/` + `wiki/entities/` BRN 0, CEO romanization 0. |
| E4 | `pii-redact.test.ts` 21 tests GREEN | ✅ | 537 전체 중 기존 pii-redact 전부 pass, `sanitizeForLlmPrompt` default `structuralAllowed=false` 하위 호환. |
| E5 | `pii-structural.test.ts` ≥10 tests GREEN | ✅ | 12 tests passed (fresh 실행). |
| E6 | `npm test` 525+ / `npm run build` 0 errors | ✅ | 537 / 0 errors. |
| E7 | FP baseline — **fixtures 0/30** mandatory | ✅ | `pii-structural.test.ts §5.1.1.9` — 30 파일 전부 detectPii 결과 structural match 0 건. `offenders=[]`. |
| E8 | 의존성 diff 0 | ✅ | `wikey-core/package.json` devDependencies 3개 (vitest, typescript, coverage-v8) 유지. runtime deps 0. js-yaml 미도입. |
| E9 | §5.1 범위 하드코딩 0 | ✅ | `grep -rnE '주식회사\|㈜\|유한회사' wikey-core/src/**/*.ts` → canonicalizer.ts (범위 밖 — §13 v4 Q1 메모) + pii-patterns.ts:241 (parser 주석 내 예시, code literal 아님). 신규 test .ts 는 assertion string 허용. |
| E10 | 문서 동기화 | ✅ | 본 subject + `plan/phase-5-todo.md §5.1` + `wiki/log.md` 업데이트. |
| E11 | commit 메시지 | 위임 | 본 turn 은 unstaged 로 두고 master 가 `feat(phase-5): §5.1 structural PII detection — multi-line form coverage` 로 커밋. |

**Master 직접 CDP smoke (2026-04-25 03:20)** — 사용자 지시 "subagent CDP 불가 시 master 직접 실행":
- Obsidian `osascript -e 'quit app "Obsidian"'; /Applications/Obsidian.app/Contents/MacOS/Obsidian --remote-debugging-port=9222 '--remote-allow-origins=*'` 로 기동 → CDP port 9222 OPEN 확증.
- `dist/pii-patterns.js` + `dist/pii-redact.js` (번들 build 산출물) 을 node ESM 으로 import → fixture 7종 + baseline 30종 실 runtime 실행.
- **결과**: PII 누출 차단 7/7 (`홍 길 동`·`이 영 희`·`김 철 수` + BRN `123-45-67890` 전부 매치), baseline FP 0/30, wiki pre-check BRN/CEO 0 hit.
- **발견된 quality issue (follow-up subject)**: ceo-structural `valuePattern='[가-힣](?:[ \t]*[가-힣]){1,3}'` 가 한글 2~4자 label 단어 (`주소`·`등기일`·`서울시 어`·`딘가`) 를 over-mask. 누출 아닌 과차단. `valueExcludePrefixes` 에 common field label 추가 or valuePattern 엄격화 (공백 포함 이름만) — `plan/session-wrap-followups.md` 에 §5.1 quality follow-up 으로 기록.

**다음 단계**: tester 에이전트가 §12 E1/E2.b/E3 — Obsidian CDP 경유 live smoke 재실행 + entity 페이지 scan — 을 담당.

---

## 5.2 검색 재현율 고도화 (P1)
> tag: #eval, #engine
> **이전 번호**: `was §5.1`.

(착수 전 — 2026-04-22 Phase 4 §4.4.1 에서 이관. Phase 4 §4.5.1.7.3 실측 완료 + 재현율 개선 실험 착수 시 타임라인 시작. Anthropic contextual retrieval 스타일 chunk 재작성 PoC 범위: qmd 인덱스 재빌드 파이프라인에 "contextual rewrite" 스테이지 추가 → baseline vs rewrite 재현율 측정 (MRR, Recall@10). 결정 기준: 재현율 개선 ≥ 15% 시 상설 통합.)

---

## 5.3 인제스트 증분 업데이트 (P1)
> tag: #workflow, #engine
> **이전 번호**: `was §5.3` (번호 유지).

(착수 전 — 2026-04-22 Phase 4 §4.3.3 에서 이관. Phase 4 §4.2.2 URI 참조 + source-registry `hash` 필드 완비 후 진입 가능. **Provenance 는 본체에 남아 §4.3.2 로 처리됨** — frontmatter data model 변경이라 구조 변경 없음 조건 위반.)

---

## 5.4 표준 분해 규칙 self-extending 구조 (P2)
> tag: #framework, #engine, #architecture
> **이전 번호**: `was §5.6`. 2026-04-22 Phase 4 §4.5.1.7.2 PMBOK 하드코딩이 Stage 0 사전 검증에 해당.

**Stage 0 사전 검증** (2026-04-22, Phase 4 내 진행 중):
- Phase 4 §4.5.1.7.2 에서 PMBOK 10 knowledge areas 를 canonicalizer prompt 에 단발 하드코딩 (A안). `canonicalizer.ts buildCanonicalizerPrompt` "작업 규칙" 7번 항목 신규 + `canonicalizer.test.ts` 단위 테스트 anchor. 352/352 PASS.
- 철학 선언은 `wiki/analyses/self-extending-wiki.md` (wiki 본체 analysis) 에 정식 기록.
- 실측: PMS 5-run 재측정으로 Concepts CV 24.6% → <15% 달성 여부 확증 (후속 Obsidian CDP 세션). 효과 확증 시 Stage 1 진입.

**§5.4 gate**: Phase 4 §4.5.1.7.2 PMS 5-run 실측 (Concepts CV 24.6% → <15%) 에서 효과 확증. 미달 시 Stage 1 진입 전에 A안 재설계 또는 B안 보강 (9 slug FORCED_CATEGORIES pin).

**Stage 1~4** (미진입):

| Stage | 상태 | 트리거 |
|---|---|---|
| Stage 1 외부화 (`.wikey/schema.yaml`) | 대기 | Stage 0 실측 + 두 번째 표준 corpus (ISO/ITIL 등) 등장 |
| Stage 2 extraction graph suggestion | 대기 | Stage 1 안정 동작 + 표준 ≥5 누적 |
| Stage 3 in-source self-declaration | 대기 | Stage 2 accept rate ≥ 80% |
| Stage 4 cross-source convergence | 대기 | Stage 3 누적 ≥ 3 표준 × 2 소스 |

**기록 책임**: 실행 로드맵 단일 소스는 `plan/phase-5-todo.md §5.4`, 철학 선언 단일 소스는 `wiki/analyses/self-extending-wiki.md`. `wikey-core/src/canonicalizer.ts` 작업 규칙 #7 위 주석, `plan/session-wrap-followups.md`, memory 는 포인터만.

---

## 5.5 지식 그래프 · 시각화 (P3)
> tag: #main-feature, #utility
> **이전 번호**: `was §5.2`.

(착수 전 — 2026-04-22 Phase 4 §4.4.2/§4.4.3 에서 이관. 본체 완성 후 wiki 관계 그래프 시각화 + AST 기반 코드 파싱 경로 확장 스코프. NetworkX + vis.js/Obsidian Graph View 연동, Leiden 클러스터링, graph.json/graph.html/GRAPH_REPORT.md 산출. 코드 파일은 tree-sitter AST 로 LLM 없이 구조 추출.)

---

## 5.6 성능 · 엔진 확장 (P3)
> tag: #infra, #engine
> **이전 번호**: `was §5.5`.

(착수 전 — 2026-04-22 Phase 4 §4.5.3 (llama.cpp PoC) / §4.5.4 (rapidocr Linux) 에서 이관. Ollama vs llama.cpp 실측 gap ≥15% 면 전환. rapidocr + `korean,english` 는 Linux 환경 실측 필요 — macOS 세션에서는 ocrmac 만 검증 가능.)

---

## 5.7 운영 인프라 포팅 (P4)
> tag: #utility, #infra
> **이전 번호**: `was §5.7` (번호 유지).

(착수 전 — 2026-04-22 Phase 4 §4.5.2 의 bash→TS 포팅 + qmd SDK import 두 항목에서 이관. 삭제 안전장치 + 초기화는 Phase 4 본체 유지. 우선순위 낮음 — 현 exec 래퍼로 안정 동작 중.)

---

## 5.8 Phase 4 D.0.l 이관 과제 — 잔여 (P4)
> tag: #pii, #classify, #reindex, #phase4-handover
> **이전 번호**: `was §5.8` — 일부 이관·완료 반영해 재정리.

### 5.8.0 세션 8 완료 요약 (2026-04-24)
> tag: #done, #summary

2026-04-24 session 8 D.0.l smoke 재실행에서 파이프라인·운영 안전 확증 / wiki body PII 전파 2건 발견. smoke 리포트 `activity/phase-4-resultx-4.6-smoke-2026-04-24-v2/README.md` §이관 과제 테이블을 단일 소스화. 사용자 방침: **"PII 관련 하드코딩은 안된다"** (2026-04-24).

다음 3건은 세션 8 에서 완료 또는 재배치됨:

- **(완료) C-A1 filename PII sanitize**: `sanitizeForLlmPrompt(text, { guardEnabled }, patterns)` 단일 진입점 신규. `ingest-pipeline.ts::ingest()` + `generateBrief()` 모두 LLM 호출 전 filename sanitize 적용. `brn-hyphen` 패턴도 `\b` → `(?<!\d)...(?!\d)` 로 `_` word-boundary 케이스 커버. 유닛 테스트 4종. 이전 todo: §5.8.1.
- **(부분 완료) C-A2 CEO 이름 공백 변형 (단일 라인)**: default `ceo-label` 패턴 capture 그룹을 `[가-힣](?:[ \t]*[가-힣]){1,3}` 로 확장 (줄바꿈은 금지 — cross-line 오탐 방지). 이전 todo: §5.8.2. **잔여** (multi-line 폼) 은 §5.1 로 승격.
- **(이관) 구조적 PII 탐지**: 이전 §5.8.6 → 우선순위 재조정으로 §5.1 (P0) 으로 승격.

### 5.8.1 W-A3 동명이인 romanization dedup (Med)
> tag: #pii, #dedup
> **이전 번호**: `was §5.8.3`.

(착수 전 — 2026-04-24 session 8 smoke 재실행에서 발견. 같은 이름이 romanize 단계에서 variance 로 중복 entity 생성 (`kim-myeong-ho.md` vs `kim-myung-ho.md`). 해결 방향: canonicalizer dedup 로직 강화 — 한국어 원본 이름 기준으로 canonical key 생성, romanization variance 허용. PII 룰 엔진과 별개이나 같은 ingest path 에 위치.)

### 5.8.2 W-B1 file 6 classify 2차 분류 variance (Low)
> tag: #classify, #variance
> **이전 번호**: `was §5.8.4`.

(착수 전 — 2026-04-24 session 8 smoke 재실행에서 발견. Pass A 는 `20_report/000_general`, Pass B 는 `60_note/000_general` — LLM reasoning 수준의 non-determinism. tier/분류 1차 depth 6/6 일치는 이미 PASS 이므로 우선순위 낮음.)

### 5.8.3 W-C1 reindex --quick non-fatal exit=1 (Low)
> tag: #reindex
> **이전 번호**: `was §5.8.5`.

(착수 전 — 2026-04-24 session 8 smoke 재실행에서 발견. 양 pass 에서 `runReindexAndWait` 가 `reindex --quick failed (non-fatal)` 12회 emit. stderr 비어있으나 exit=1. 해결 방향: `scripts/reindex.sh --quick` 내부 원인 조사 — stale 정상 경로라면 exit 0 이어야. 현재는 warn 로 다운그레이드 + `onFreshnessIssue` Notice 표시 → 사용자 UX 영향 없음.)

---

## 5.9 Variance 기여도 · Diagnostic (P4)
> tag: #eval
> **이전 번호**: `was §5.4`.

(착수 전 — 2026-04-22 Phase 4 §4.5.1.7.1/.7.4/.7.6/.7.7 에서 이관. Phase 4 §4.5.1.7.2/7.3 실측으로 본체 CV <10% 확보 이후 선택적 diagnostic. 4-points ablation (all-off/determinism-only/canon-only/all-on) + SEGMENTED 10-run Ollama baseline + BOM 축 재분할 판단 + log_entry axis 불일치 cosmetic 수정.)
