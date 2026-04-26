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
- **§5.1 보조 문서**:
  - [`plan/phase-5-todox-5.1-structural-pii.md`](../plan/phase-5-todox-5.1-structural-pii.md) — 구조적 PII 탐지 계획 (v4 codex APPROVE)
  - [`activity/phase-5-resultx-5.1-cdp-cycle-smoke-2026-04-25.md`](./phase-5-resultx-5.1-cdp-cycle-smoke-2026-04-25.md) — Obsidian CDP UI 1-cycle smoke 실측 (NanoVNA 1 파일, master 직접)
- **§5.3 보조 문서**:
  - [`plan/phase-5-todox-5.3.1-incremental-reingest.md`](../plan/phase-5-todox-5.3.1-incremental-reingest.md) — §5.3.1 + §5.3.2 결합 설계 (v11 codex Mode D **APPROVE_WITH_CHANGES**, 11 cycle 수렴 P1 0건)
- **§5.4 보조 문서** (2026-04-26 session 13 종결):
  - [`plan/phase-5-todox-5.4-integration.md`](../plan/phase-5-todox-5.4-integration.md) — 4 Stage 통합 plan (v10, codex post-impl Cycle #6 APPROVE)
  - [`plan/phase-5-todox-5.4.1-self-extending.md`](../plan/phase-5-todox-5.4.1-self-extending.md) — Stage 1 단독 plan (v7, codex Cycle #9 APPROVE)
  - [`activity/phase-5-resultx-5.4-integration-cycle-smoke-2026-04-26.md`](./phase-5-resultx-5.4-integration-cycle-smoke-2026-04-26.md) — AC21 라이브 cycle smoke + Stage 3 inspect + Stage 4 alpha v1 wire 검증 (master 직접)
- **추후 보조 문서**: `phase-5-todox-<section>-<topic>.md` · `phase-5-resultx-<section>-<topic>-<date>.md` 형식 (`CLAUDE.md §문서 명명규칙·조직화` 참조).
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

**다음 단계**: tester 에이전트가 §12 E1/E2.b/E3 — Obsidian CDP 경유 live smoke 재실행 + entity 페이지 scan — 을 담당. (이후 §5.1.2 / §5.1.3 에서 master 가 직접 진행 + over-mask quality follow-up 처리.)

### 5.1.2 Over-mask 4건 fix + isCandidateExcluded 분리 + example placeholder 모듈 (2026-04-25 post-compact + cycle smoke)

**배경**: §5.1.1 본체 commit `2da88cb` 의 master CDP smoke 에서 PII 누출 차단은 7/7 통과했으나 ceo-structural valuePattern (`[가-힣](?:[ \t]*[가-힣]){1,3}`) 가 한글 2~4자 form label 단어를 over-mask 하는 quality issue 발견 (`ceo-blank-line.md` → `['홍 길 동', '등기일']`, `ceo-table-cell.md` → `['이 영 희', '주소', '서울시 어', '딘가']`). 누출 아닌 과차단이지만 사용자 본문 손상 가능성. session-wrap-followups.md 에 §5.1 quality follow-up 으로 기록 후 post-compact 처리.

**Phase A — Over-mask fix (commit `5e32ec4`, 2026-04-25)**:
- `wikey-core/src/defaults/pii-patterns.default.yaml` — `ceo-multiline-form.valueExcludePrefixes` 에 일반 폼 라벨 13종 추가: 주소/전화/휴대/담당/접수/등기/등록/이메일/팩스/우편/사업/본점/소재.
- `wikey-core/src/pii-redact.ts:isCandidateExcluded` — same-line check 를 last-2 토큰만 → **모든** prefix 토큰 검사로 확장. 테이블 셀 `| 주소 | 서울시 어딘가 |` 처럼 라벨이 multi-token 떨어진 케이스 차단.
- `wikey-core/src/__tests__/pii-over-mask-prevention.test.ts` (신규 2 tests) — bundled YAML default 로 `ceo-blank-line.md` → `['홍 길 동']` / `ceo-table-cell.md` → `['이 영 희']` 정확 1건 회귀 방지.
- 검증: `npm test` **539/539 passed** (537 + 신규 over-mask 2). `npm run build` 0 errors.
- Reproduction (dist runtime, fix 후): `ceo-blank-line.md: ['홍 길 동']` / `ceo-table-cell.md: ['이 영 희']`.

**Phase B — codex Mode D Panel review P2/P3 + isCandidateExcluded 분리 (commit `3f1fa6d`, 2026-04-25)**:

codex review (cmux Panel surface:3, gpt-5.5 xhigh) verdict FAIL — 2 findings:
- [P2] Phase A 의 13개 form label 이 candidate 자체에도 `startsWith` 적용. `'주소영'` 같은 실재 한국 이름 (성씨 '주') false-negative 위험. **Split candidate-prefix exclusions from same-line context-label exclusions**.
- [P3] `canonicalizer.test.ts` L43-58, L270/285 의 `goodstream-co-ltd` hardcoded fixture 가 placeholder constants 사용 안 함.

**P2 fix — discriminated 2-list 도입**:
- `wikey-core/src/pii-patterns.ts` — `StructuralPiiPattern` / `CompiledStructuralPiiPattern` 인터페이스에 `contextLabelPrefixes?: readonly string[]` 필드 추가. loader (`buildPatternFromYamlEntry`) + compiler (`compilePattern`) 양쪽 처리.
- `wikey-core/src/pii-redact.ts:isCandidateExcluded` — 2 list 분리 검사:
  - `valueExcludePrefixes` (회사명): candidate `startsWith` + same-line tokens `startsWith` (둘 다)
  - `contextLabelPrefixes` (라벨): candidate `===` (정확 일치만) + same-line tokens `startsWith`
  - 분리 이유: 라벨 단어 ('주소', '등기' 등) 가 한국 이름의 첫 음절과 겹칠 수 있어 startsWith 적용 시 false-negative. `===` 는 라벨 단어 단독 candidate (`'주소'`) 만 차단하고 `'주소영'` 은 매치.
- `wikey-core/src/defaults/pii-patterns.default.yaml` — Phase A 의 13 prefix 를 `valueExcludePrefixes` (회사명만 7종 유지) → `contextLabelPrefixes` (라벨 13종 + 변형 `등기일`/`등기부` 명시) 로 이전.
- `wikey-core/src/__tests__/pii-over-mask-prevention.test.ts` — `'주 소 영'` 매치 확증 회귀 테스트 추가 (총 3 tests).

**Phase B 부수 작업 — example placeholder constants module**:
- `wikey-core/src/example-placeholders.ts` (신규) — LLM few-shot prompt 의 hardcoded 회사명/제품명/인명을 export 상수로 통합:
  - `EXAMPLE_ORG_BASE='example-corp-ltd'` / `EXAMPLE_ORG_ALIAS='example-corp'` / `EXAMPLE_ORG_KO='주식회사 예제'` / `EXAMPLE_ORG_DESC_KO`
  - `EXAMPLE_PERSON_BASE='example-person'` / `EXAMPLE_PRODUCT_BASE='example-product'`
  - `EXAMPLE_CONCEPT_BASE='project-management-body-of-knowledge'` / `EXAMPLE_CONCEPT_ALIAS='pmbok'`
- 5 파일 7 ref import 교체:
  - `canonicalizer.ts:254` (existing-entity 설명) — `EXAMPLE_ORG_BASE` / `EXAMPLE_ORG_ALIAS`
  - `canonicalizer.ts:270/276/278` (entities/concepts/index/log few-shot) — 4개 placeholder 모두 import 사용
  - `schema.ts:19-21` (entity type description 의 `goodstream-co-ltd`/`kim-myung-ho`/`lotus-pms`) — `EXAMPLE_ORG_BASE`/`PERSON_BASE`/`PRODUCT_BASE`
  - `ingest-pipeline.ts:570` (Stage 2 mention prompt 의 description 가이드) — `EXAMPLE_CONCEPT_ALIAS`/`EXAMPLE_ORG_BASE`
  - `ingest-pipeline.ts:596` (Stage 2 mention few-shot) — 3개 placeholder
- `wikey-core/src/__tests__/canonicalizer.test.ts` (P3 fix) — L41-58 + L266/281 fixture 도 `EXAMPLE_ORG_BASE` import 사용. existing pages block 검증 테스트 (기존 'goodstream-co-ltd' 입력으로 우연 매치되던 false signal) 정정 — bundled prompt 의 `${existingBlock}` 변수 미사용을 발견·문서화 (사전 버그, P3 범위 밖).
- 테스트 fixture 파일 (`pii-redact.test.ts`, `wiki-ops.test.ts` 등) 의 동일 문자열은 PII test 의도 데이터로 보존 (production code 만 cleanup, 0 hits 확증).

**검증 (Phase B 후)**:
- `npm test`: **540/540 passed** (539 + over-mask self-검증 1).
- `npm run build`: 0 errors.
- `grep -rn 'goodstream\|굿스트림\|lotus-pms\|kim-myung-ho' wikey-core/src/` (production only, test 제외): 0 hits.
- Reproduction 유지: `ceo-blank-line.md: ['홍 길 동']` / `ceo-table-cell.md: ['이 영 희']` (over-mask 0).
- 신규 회귀: `'주 소 영'` 검출됨 (P2 false-negative 방지 확증).

**관련 문서**: `plan/phase-5-todo.md §5.1.1.12` (over-mask fix mark) + `plan/phase-5-todo.md §5.2.1` (entity↔concept cross-link 신규 진입점, cycle smoke 후 발견 follow-up).

### 5.1.3 Master 직접 Obsidian CDP UI 1-cycle smoke (2026-04-25, NanoVNA 1 파일)

**배경**: Phase B (commit `3f1fa6d`) 통합 후, 사용자 정책 "tester 1차 / master fallback" 적용 — 단 "다음 세션부터 tester" 명시이므로 본 세션은 master 직접. 목표: §5.1 over-mask fix + example placeholder 변경이 plugin 경로 (Ingest 패널 → Brief modal Proceed → Processing → Preview Approve → wiki write → reindex → query → citation) 전체에서 회귀 없이 동작하는지 1 파일로 확증.

**환경**:
- Obsidian 1.12.7 — `osascript -e 'quit app "Obsidian"'; /Applications/Obsidian.app/Contents/MacOS/Obsidian --remote-debugging-port=9222 '--remote-allow-origins=*'`
- Plugin build (cjs, esbuild) 1 warning: `import.meta.url` cjs 환경에서 빈 값 — bundled YAML loader fallback 동작 (잠재 issue, follow-up 등록).
- Plugin path: `vault/.obsidian/plugins/wikey/main.js` (symlink → `wikey-obsidian/main.js`).
- LLM Provider: Gemini 2.5 Flash (Brief / Mention / Canonicalize 동일).

**샘플**: `raw/_delayed/nanovna-v2-notes.md` (35 lines, ~1.7 KB, technical RF/안테나 노트, PII 0 hits — BRN/CEO/주소 0).

**Timeline (timing)**:
| 단계 | 시각 | 시간 | 비고 |
|------|------|------|------|
| Plugin reload | — | — | `app.plugins.disable+enable('wikey')` |
| `wikey:ingest-current-note` | — | — | Brief modal 등장 |
| Brief → **Proceed** | — | 즉시 | 모달 [Proceed] 클릭 — **이 클릭 누락이 첫 시도 brief stage 5분+ hang 원인** |
| Processing | 12:01:05 | 1분 25초 | Stage 1 brief + Stage 2 mention + Stage 3 canonicalize, Gemini 2.5 Flash |
| Preview modal | 12:02:30 | — | Approve & Write 버튼 등장 확증 |
| **Approve & Write** | — | 즉시 | wiki write |
| Wiki write | 12:02:30 | ~5초 | 18 file write |
| Query 1 (reindex 전) | — | ~30초 | 답변 OK + 사실 인용, **citation 0** ("Wikey 위키에서 직접적 검색 결과 없음") |
| `./scripts/reindex.sh` (master 수동) | — | 12초 | 16 new + 2 updated indexed, 53 chunks embedded |
| Query 2 (reindex 후) | — | ~20초 | citation 4건 — `[[nanovna-v2]] 📄` + `[[source-nanovna-v2-notes]]` + 원본 backlink |

**wiki 산출물 (ingest 직후)**: 5 entities (nanovna-v2 / nanovna-qt / nanovna-v2-plus4 / dji-o3-air-unit / vector-network-analyzer) + 9 concepts (s11-parameter / s21-parameter / s-parameter / standing-wave-ratio / smith-chart / sma-connector / mmcx-connector / first-person-view / fpv-digital-transmission) + 1 source (`source-nanovna-v2-notes.md`) + log/index/.ingest-map.json 갱신 = 총 18 file write.

**Query 답변 비교 (reindex 전 → 후)**:

Query 1 (reindex 전, 1186 chars, citation 0):
```
"죄송합니다. Wikey 위키에서 'NanoVNA V2'에 대한 직접적인 검색 결과나 관련 페이지를
찾을 수 없었습니다. 하지만 일반적인 정보에 기반하여 ... 50 kHz ~ 3 GHz ... S11/S21/...
관련 위키 페이지: 현재 Wikey 위키에는 'NanoVNA V2'에 대한 전용 페이지가 없지만 ..."
```

원인: `./scripts/reindex.sh --check` → "마지막 인덱싱 2026-04-24 21:09 / 변경된 파일 17 stale". qmd 인덱스에 새 페이지 미등록.

Query 2 (reindex 후, 184 chars, citation 4):
```
"NanoVNA V2는 50kHz부터 3GHz까지의 주파수 대역을 측정해요.
이 장비는 S11(반사), S21(전송), 임피던스, 스미스 차트, 정재파비(SWR)를 측정할 수 있어요.
참고: nanovna-v2📄, source-nanovna-v2-notes
원본: raw/_delayed/nanovna-v2-notes.md"

links:
- internal-link wikey-citation-attached → nanovna-v2
- wikey-citation-link → 📄 (보조 backlink)
- internal-link → source-nanovna-v2-notes
- internal-link → raw/_delayed/nanovna-v2-notes.md
```

검증 통과:
- 사실 정확성: 50kHz~3GHz / S11/S21/임피던스/스미스 차트/SWR 모두 fixture 본문과 일치 (hallucination 0).
- Wiki citation: `[[nanovna-v2]]` entity + `📄` wikey-citation-link (Phase 4 §4.3.2 Part A — provenance frontmatter).
- Source citation: `[[source-nanovna-v2-notes]]`.
- **원본 backlink** (Phase 4 §4.3.2 Part B): `raw/_delayed/nanovna-v2-notes.md` 1-hop.
- PII 누출 0 (NanoVNA fixture PII free 라 자연 OK).

**판정**: Ingest cycle PASS (ingest → wiki write → Query 답변 + citation + 원본 backlink 모두 확증). §5.1 over-mask fix + example placeholder 변경 회귀 영향 0 (PII free 샘플로 검증, PII-heavy 샘플은 follow-up).

**발견된 follow-up (모두 `phase-5-todo.md §5.2` 로 통합 등록, 2026-04-25)**:
1. **자동 reindex silent fail** — `ingest-pipeline.ts:498` `runReindexAndWait` 가 `reindex.sh --quick` 호출 + `waitUntilFresh` polling. 코드 wiring 정상 (`commands.ts:422-425` plugin onFreshnessIssue callback 등록) 인데 stale 17 파일. 4 후보 (race / PATH / quick metadata / timeout). → `§5.2.5` 진단 routine 명시.
2. **답변 짧음 (184 chars) + 연관 wiki 미인용** — `nanovna-v2.md` entity 본문 = 1줄 + `## 출처` 1개 wikilink만. concept (smith-chart, swr 등 9건) 으로의 cross-link 자동 생성 안 됨. 즉 재조합 (synthesis) 문제 아님 — **인제스트 단계에서 entity↔concept cross-link 가 안 만들어진 것** 이 root cause. → `§5.2.1` (canonicalizer Stage 3 fix, ★ 답변 풍부도 결정적).
3. **답변 prompt 강화 + graph expansion + TOP_N** — `query-pipeline.ts:246` `WIKEY_QMD_TOP_N=5`, `buildSynthesisPrompt` 에 "관련 모든 wiki + 1-hop wikilink target 인용" 지시 부재. → `§5.2.2/§5.2.3/§5.2.4`.
4. **movePair 미발동** — `commands.ts:442` `if (ctx.autoMoveFromInbox && sourcePath.startsWith('raw/0_inbox/'))` 가드. 본 cycle 샘플이 `raw/_delayed/` 라 정상적으로 발동 안 함 (의도된 동작). → 결함 아님, skill `obsidian-cdp` §6.0 에 "샘플 위치 = raw/0_inbox/" 명시 추가.
5. **cjs `import.meta.url` 경고** — bundled YAML loader (esbuild cjs 출력) 에서 빈 값. structural PII 가 plugin 안에서 동작하는지 확증 follow-up.
6. **ingest 진행 중 Notice 미표시** — UX 개선.

**부수 산출물 (이번 세션 인프라 정비)**:
- 신설: `~/.claude/skills/obsidian-cdp/SKILL.md` — Obsidian CDP UI 자동화 책임 매트릭스 (tester 1차 / master fallback) + `scripts/smoke-cdp.sh` 헬퍼 카탈로그 + Brief Proceed / Preview Approve & Write 모달 셀렉터 + Query 검증 단계 (§6.7) + 6-파일 통합 smoke (§7) + PII smoke (§8) + 함정 (§10).
- 갱신: `~/.claude/agents/tester.md` — "CDP·E2E 검증 1차 책임 (2026-04-25 update)" — Obsidian CDP UI smoke 가 tester 기본 책임으로 격상, master 는 fallback.
- 신규 메모리 4건: `feedback_no_circled_numbers.md`, `feedback_no_defer_to_next_session.md`, `feedback_obsidian_modal_proceed.md`, `feedback_reuse_prior_artifacts.md`.
- 정리: `plan/post-compact-handoff.md` 삭제 (post-compact 처리 완료 후 archive).

**상세 활동 문서**: [`activity/phase-5-resultx-5.1-cdp-cycle-smoke-2026-04-25.md`](./phase-5-resultx-5.1-cdp-cycle-smoke-2026-04-25.md) — timing 표, query 결과 비교, 9.x follow-up 진단 (현 세션에서 좁혀진 4 후보 + fix 방향).

---

## 5.2 검색 재현율 + 답변 품질 (P1)
> tag: #eval, #engine, #philosophy
> **이전 번호**: `was §5.1`. 2026-04-25 §5.1.3 cycle smoke 후 검색·답변 품질 follow-up 5건 통합으로 재정의.

**진입 조건 충족** (2026-04-25): §5.1.3 Obsidian CDP cycle smoke 가 검색·답변 단계의 결정적 결함 (entity↔concept cross-link 누락 + 자동 reindex silent fail + 답변 짧음) 을 정량 측정. wikey 철학 (RAG chunk 배제, H2 section 단위, 페이지 단위 검색 — Phase 4 §4.5.1.7.2 v2 결정) 정합 작업.

### 5.2.0~5 통합 구현 (commit `f108e0c`, 2026-04-25)

| § | 항목 | 변경 | TDD |
|---|------|------|-----|
| 5.2.0 | paired sidecar.md UI | wikey-core/paired-sidecar.ts (helper) + sidebar-chat.ts 3 row builders ([md] 뱃지 + tooltip + 카운트 정정) + styles.css | 17 unit |
| 5.2.1 ★ | entity↔concept cross-link | canonicalizer.ts applyCrossLinks helper — `## 관련` H2 (description ↔ `## 출처` 사이) 결정적 양방향 wikilink | 8 unit (codex P1-2 edge 3건 추가 반영) |
| 5.2.2 | 답변 prompt 강화 | buildSynthesisPrompt 에 wikilink 1-hop 활용 + 첫 등장 [[페이지명]] 링크 + 1-hop target 참고 블록 지시 3건 | 3 unit |
| 5.2.3 | 검색 graph expansion | extractWikilinkBasenames + expandWithOneHopWikilinks pure helpers + buildContextFromFS/buildContextWithWikiFS 가 top-N 페이지의 wikilink 를 1-hop fetch (cap 5) | 9 unit |
| 5.2.4 | TOP_N 5 → 8 | config.ts default + wikey.conf + query-pipeline fallback | (regression covered) |
| 5.2.5 | reindex silent fail observability + race fix | waitUntilFresh timeout 시 last status + stale count 노출 / onFreshnessOk 신규 callback (성공 Notice) / commands.ts post-movePair re-reindex | (existing tests) |

**unit 신규 37개 / wikey-core 577/577 passed / build 0 errors.** plan: `plan/phase-5-todox-5.2.1-crosslink.md` (analyst v2 + codex APPROVE_WITH_CHANGES P1 3건 정정 반영).

### 5.2.6 (탐구) 페이지 H2 섹션 의미 활용
(미착수 — §5.2.1~5 적용 후 정확도 부족 시 진입.)

### 5.2.7 (archived) Anthropic-style contextual chunk 재작성
2026-04-25 archive — Phase 4 §4.5.1.5 v2 가 RAG chunk 패턴 자체 배격 결정과 충돌.

### 5.2.9 plugin-only qmd `--quick` exit=1 root cause 진단·수정 (★ §5.8.3 W-C1 승격, commit `f3dbbfa`)

**근본 원인 (master minimal-PATH 재현 으로 확증, 2026-04-25 15:08-15:14)**:
- nvm node v22 (NODE_MODULE_VERSION 127) 로 처음 install → `tools/qmd/node_modules/better-sqlite3/build/Release/better_sqlite3.node` 가 v22 ABI 로 컴파일됨
- plugin's execEnv (`env-detect.ts:64 makeEnv`) = login shell PATH (`zsh -l -c 'echo $PATH'`) → homebrew node v24 (NODE_MODULE_VERSION 137) 가 nvm bin 보다 앞에 위치 → qmd 의 `node "$DIR/dist/cli/qmd.js"` 가 v24 로 호출됨 → better-sqlite3 의 `process.dlopen` 에서 `ERR_DLOPEN_FAILED` (NODE_MODULE_VERSION 불일치)
- CLI 단독 (cmux interactive shell) 은 nvm v22 우선 → 동일 ABI → exit=0. 그래서 master CLI 검증과 plugin ingest 동작이 갈렸음.

**4 후보 매치**: (i) PATH/cwd → ✓ confirmed (PATH 순서 차이)와 (iv) qmd 자체 (ABI 미스매치) 의 결합. (ii) dyld 일반 / (iii) wiki write race 는 무관.

**Fix 3건**:
- `scripts/rebuild-qmd-deps.sh` (신규, 실행 가능) — login shell node 명시 사용해 better-sqlite3 강제 rebuild. nvm vs homebrew 어느 쪽 install 이든 plugin 이 쓸 node 와 ABI 매칭 보장. 사용자 node 업그레이드 후 재실행 가능.
- `wikey-obsidian/src/commands.ts onFreshnessIssue` — stderr 의 `NODE_MODULE_VERSION` / `ERR_DLOPEN_FAILED` 패턴 감지 시 specific Notice 12s ("qmd 네이티브 모듈 ABI 불일치 — bash ./scripts/rebuild-qmd-deps.sh") 표시. 일반 인덱싱 실패와 구분.
- `plan/phase-5-todo.md §5.2.9` 신설 + `§5.8.3 W-C1` alias 마크.

**검증**:
- master 가 `./scripts/rebuild-qmd-deps.sh` 1회 실행 — homebrew node v24 로 better-sqlite3 재빌드 완료 (15:09).
- master 가 minimal PATH 환경 (homebrew node v24 강제) 에서 `bash ./scripts/reindex.sh --quick` → exit=0, 26초, 정상 동작 확증.
- plugin 검증은 §5.2.8 재실행 cycle smoke (tester 분기) 결과 확정 후 closed.

**후속 fix 4건 (cycle smoke 발견 → 본 세션 즉시 처리)**:

| commit | 항목 | 변경 |
|--------|------|------|
| `525c488` | findCompatibleNode 명시 fallback | candidate iteration 4단계로 `/opt/homebrew/bin/node`, `/usr/local/bin/node`, `/usr/bin/node` 추가. 모든 nvm 후보 ABI fail 시도 homebrew v24 시도해서 cache → search 작동 |
| `fb88dad` | vec query hyphen → space | `query-pipeline.ts:251` 가 question 의 hyphen 을 vec line 에 그대로 넘기던 것을 space 치환. qmd 의 `Negation (-term) is not supported in vec/hyde queries` 차단. 답변 1533 chars + 15 wiki refs 확증 |
| `953c9cb` | ingest-current-note autoMove | `commands.ts:36` (Cmd+Shift+I) 가 inbox 파일 트리거 시 `autoMoveFromInbox: true` 자동 패스. 이전: ingest 후 원본 inbox 잔재 + frontmatter `vault_path` inbox 가리킴. 이후: raw/0_inbox/ → raw/3_resources/60_note/600_technology/ 자동 분류 + frontmatter rewrite + 답변 backlink 새 경로 |
| `aad98f8` | recordMove tombstone false 자동 | `source-registry.ts:98` 의 `recordMove` 가 `tombstone` field 안 건드리던 bug. 이전 reconcile case 3 (walker 누락 → tombstone) 이 잘못 마킹한 record 가 후속 movePair 100번 해도 false 안 됨. `tombstone: false` 명시 추가 + TDD 신규 case + 현 stale tombstone 직접 복구 |

**최종 검증** (master CDP cycle smoke 직접 실행, 2026-04-25 15:55-16:10):
- console: `[Wikey] qmd 호환 node 발견: /opt/homebrew/bin/node` ✓
- `qmd results: 5` (검색 정상) ✓
- ingest-current-note → `inbox=False, resources=True` (movePair 작동) ✓
- frontmatter `vault_path: raw/3_resources/60_note/600_technology/nanovna-v2-notes.md` ✓
- 답변 `원본:` 새 경로 ✓
- 답변 길이 1533/1304 chars + 11~15 wiki refs ✓

**578/578 tests + build 0 errors. §5.2 + §5.2.9 완전 종결.**

#### 5.2.0 v2 — 사용자 UI follow-up 3건 (2026-04-25 종료 직전, commit `db693d4`)

사용자 요청 직접 처리, master CDP 시각 확증:

| # | 항목 | 변경 | 측정 |
|---|------|------|------|
| 1 | [md] 뱃지 위치 = 파일명 오른쪽 8px margin | `.wikey-audit-name-wrap` sub-div (flex, gap:8px) 신규. filename + badge 묶음. 3 row builders 모두 (Ingest list / Audit list / Audit tree) | DOM 확증: `<div class="wikey-audit-name-wrap"><span class="wikey-audit-name">...</span><span class="wikey-pair-sidecar-badge">md</span></div>` |
| 2 | filename hover tooltip 단순화 | `buildSidecarTooltip` 이전 2줄 → 단일 `yyyy-mm-dd HH:MM`. filename + badge 양쪽 동일 title | sample title="2026-04-24 21:21" |
| 3 | Processing modal progress group 위치 | `.wikey-modal-processing` `flex:1` + `padding-bottom:16px` + 신규 `.wikey-modal-progress-group` `margin-top:auto`. fileLabel/spinner 위치 그대로, Back 버튼 절대 위치 (modal 바닥) 그대로 유지 | wrap top=502.7 bottom=684.7, group bottom=684.7 (wrap 바닥에 정확히), btn top=700.7 → **gap=16px** |

**대시보드 카운트 검증** (사용자 추가 요청): Audit `All 7 / Ingested 1 / Missing 6` 정확. raw/3_resources/ 안 supported 원본 (paired sidecar 5건 제외) + nanovna-v2-notes (ingested 1) = 7.

#### 5.2.0 v4 — Dashboard raw sources 카운트 paired 통합 (사용자 요청 2026-04-25 session 12)

**사용자 관찰**: Dashboard 의 Raw Sources 카운트 (Total Files / Ingested / Missing / PARA folder) 가 audit-ingest.py raw output 을 그대로 표시 → paired sidecar (`<base>.<ext>.md`) 를 별도 파일로 카운트해 audit 패널 카운트와 불일치. audit 패널은 §5.2.0 에서 paired 제외 후 재계산.

**구현**:
- `wikey-core/src/paired-sidecar.ts` 에 `recountAuditAfterPairedExclude({ingested, missing, unsupported}) → {ingested, missing, unsupported, totalFiles, folders}` 신규 helper. paired 제외 후 totalFiles + per-folder {total, ingested, missing} 재계산. unsupported 는 audit-ingest.py 정책 mirror — total 합산, missing 미포함
- `wikey-obsidian/src/sidebar-chat.ts:renderRawSourcesDashboard` 가 helper 사용 → audit 패널과 동일 카운트
- audit-ingest.py 는 source-of-truth 유지 (registry/wiki). UI 레이어만 변경

**검증**:
- TDD 6 신규 unit (`paired-sidecar.test.ts`): paired 제외 + per-folder + unsupported total-only + 빈 입력 + mixed fixture + immutability
- wikey-core 584 tests PASS / wikey-obsidian production build 0 errors

**audit panel sweep 미수행 (surgical)**: audit panel (sidebar-chat.ts:820-840) 의 inline 카운트 정정 로직은 기존대로 유지. 본 변경은 dashboard 한정.

#### 5.2.0 v3 — broken state badge 오렌지 (사용자 정의, 2026-04-25 종료 직전, commit `400b41f`)

**사용자 정의 (확정)**:
- 원본.ext alone (no .md sidecar) → audit "missing" 정상
- **원본.ext + 원본.md (paired) → 이미 ingest 가 한 번 실행돼서 sidecar 가 만들어진 상태 → "ingested" 분류여야 함**
- paired 인데 audit 가 missing 으로 분류 = **registry/wiki 와 sidecar 가 깨진 broken state**

**구현**:
- `sidebar-chat.ts renderAuditSection`: `ingestedSet = new Set(auditData.ingested_files)` 신설
- list view + tree view row 빌드 시: `hasSidecar(filePath, auditAllSet) && !ingestedSet.has(filePath)` → `isBroken=true`
- broken 시 badge class = `wikey-pair-sidecar-badge wikey-pair-sidecar-badge-broken` (CSS 신규 변형)
- broken 시 tooltip 앞에 `⚠ ingest 결과 (registry/wiki) 없음 — sidecar 만 남은 broken state` 라인 추가
- CSS: `.wikey-pair-sidecar-badge-broken { background: #ff9800; color: #fff; border-color: #f57c00; }` + hover 변형

**연관 분석** (§5.3.2): broken state 의 root cause = sidecar+ingest 불일치 (시나리오 C/D). 사용자가 wikey 외부에서 wiki/ 또는 .wikey/ 삭제했거나 reset 명령 후 sidecar 만 남은 케이스. §5.3.2 에서 시나리오 C/D fix (orphan sidecar 처리, wiki page user marker 보호) 와 함께 처리되면 broken state 발생률 자연 감소.

**별개 분석 → §5.3.2 로 이관** (사용자 지시): sidecar+ingest 불일치 8 시나리오 (A~H). 위험 3건 (A/F/D — 사용자 직접 수정 LOST), 정상 2건 (G/H), 충돌 가능 3건 (B/C/E). 본 §5.2 가 아닌 §5.3 인제스트 증분 영역에서 hash diff + user marker 보호 로 처리 예정.

### 5.2.8 검증 (cycle smoke) — 1차 완료, fix 적용 후 재검증 권장
2026-04-25 tester 분기 (CDP UI smoke) — `activity/phase-5-resultx-5.2-cycle-smoke-2026-04-25.md`.

| § | 결과 | 측정값 |
|---|------|--------|
| 5.2.0 [md] 뱃지 | **PASS** | Audit List/Tree + Ingest 3곳 모두 5건 노출, tooltip 정상, 7 rows (12 raw → sidecar 5 dedupe), 카운트 정정 |
| 5.2.1 cross-link | **PASS** | nanovna-v2.md `## 관련` H2 + 4 concepts 양방향 (mmcx/s-parameter/sma/swr), distinct=5, 27 lines (+5). swr/s-parameter 본문에 6 entity backlink |
| 5.2.2 답변 길이/citation | **PARTIAL → FIX 적용** | 495 chars (목표 500 미달 5 chars), 참고 11 wiki refs (≥5 ✓), inline 15+ → commit `7ae636f` prompt "충분히 풍부하게" 1줄 추가 |
| 5.2.3 graph expansion | **PASS** | 답변에 1-hop target dji/dji-o3-air-unit 등장 |
| 5.2.4 TOP_N=8 | **PASS** | wikey.conf + plugin runtime 8 적용, corpus 부족 시 cap 동작 |
| 5.2.5 reindex Notice | **FAIL → FIX 적용** | console warn observable ✓ but stderr 비어있어 근본 원인 미식별. STAMP 미갱신 → commit `7ae636f` reindex.sh 가 qmd update/embed 실패 시 stderr 로 full output dump. plugin-only exit=1 자체는 `§5.8.3 W-C1` 영역 (Phase 4 D.0.l 잔여, Low) |

**산출물**: 신규 wiki 11 files (1 source + 6 entities + 4 concepts) + 양방향 cross-link 완비. fixture: `raw/0_inbox/nanovna-v2-notes.md`.

**다음 cycle smoke 권장 시점**: commit `7ae636f` 적용 후 (a) §5.2.2 답변 ≥500 chars 재측정 + (b) §5.2.5 qmd 실제 stderr 메시지 확보 → §5.8.3 상세 진단으로 연결.

---

## 5.3 인제스트 증분 업데이트 + sidecar/wiki 사용자 수정 보호 (P1, **종결**)
> tag: #workflow, #engine, #architecture
> **이전 번호**: `was §5.3` (번호 유지).

**상태 (2026-04-25 session 12 종결)**: plan v11 (codex APPROVE_WITH_CHANGES, P1 0건, 11 cycle 수렴) 의 6-step TDD 모두 GREEN. 회귀 baseline 584 → 640 PASS (+56 신규 case). build 0 errors (core + obsidian). cycle smoke 5/5 PASS (실 obsidian CDP). PMS_제품소개_R10_20220815.pdf (3.6MB, paired sidecar 6.4MB) 실 ingest 성공 + 사용자 paired sidecar 보존. ★ 후속 follow-up 으로 ConflictModal default injection / Approve&Write UX (button disable + spinner) / Original-link footer mode (raw / sidecar / hidden) / settings UI 영문 i18n 추가 구현.

**진행 timeline** (2026-04-25 19:00 ~ 22:50, ~4시간):

### 5.3.1 Step 1 — Registry 스키마 확장

**파일**: `wikey-core/src/source-registry.ts` (185 → 308 lines), `wikey-core/src/__tests__/source-registry.test.ts` (268 → 568 lines)

**SourceRecord 5 신규 optional 필드** (모두 backwards compat):
- `sidecar_hash?: string` — sha256(NFC(sidecar body)) at last canonical write. ★ plan v11 P1-2 단일 규칙: canonical `<sourcePath>.md` 가 (re)write 된 직후에만 갱신, `.md.new` write 시 미갱신.
- `reingested_at?: readonly string[]` — ISO timestamps (first_seen 이후).
- `last_action?: ReingestAction` — 직전 결정 결과 (진단용). union type `'skip' | 'skip-with-seed' | 'force' | 'protect' | 'prompt'`.
- `pending_protections?: readonly PendingProtection[]` — `<base>.md.new` 누적 추적. `kind: 'sidecar-md-new'` 단일.
- `duplicate_locations?: readonly string[]` — 같은 hash 사용자 복사본. ★ v4 정정: `path_history` 와 분리하여 findByPath / reconcile 의 identity lookup 의미 보존.

**4 신규 helper** (모두 immutable spread):
- `recordMoveWithSidecar(reg, id, newVaultPath, sidecar: { kind: 'preserve' | 'clear' | 'set'; path? })` — atomic vault_path + sidecar_vault_path 갱신. discriminated union 으로 caller 가 의도 명확히 선언.
- `appendPendingProtection(reg, id, entry)` — protect 분기 산출물 추가.
- `clearPendingProtection(reg, id, path)` — 사용자가 promote/삭제 후 cleanup (P2-1).
- `appendDuplicateLocation(reg, id, duplicatePath)` — 멱등 (canonical 자체는 append 안 함, 같은 path 중복 차단).

**reconcile() duplicate-aware 변경** (★ codex v4 P1 정정):
- `Map<hash, paths[]>` 로 확장 (이전: `Map<hash, vault_path>` 단일).
- canonical 결정 우선순위: (1) `record.vault_path` 가 walker 에 있으면 그것 보존 (move 안 함), (2) `record.duplicate_locations` 의 path 는 canonical 후보에서 제외, (3) 그 외 paths 만 promote → recordMove.
- promoted path 가 duplicate_locations 에 있었으면 거기서 제거 (canonical 으로 이동).

**Test (RED → GREEN)** — 11 신규 case (기존 21 + 신규 11 = 32 total):
- 1개 happy upsert all new fields, 1개 legacy load (5 필드 모두 undefined)
- 2개 appendPendingProtection (append + 기존 entry 보존)
- 1개 clearPendingProtection
- 3개 appendDuplicateLocation (basic + idempotent + canonical 자체 거부)
- 3개 recordMoveWithSidecar (preserve / clear / set)
- 4개 reconcile duplicate-aware (canonical preserved / walker order reverse 무관 / canonical missing → promote / true move)

**Acceptance**: 21 → 32 PASS (584 → 599, +15 신규 누적). build 0 errors.

### 5.3.2 Step 2 — `incremental-reingest.ts` 신규 helper

**파일**: `wikey-core/src/incremental-reingest.ts` 신규 (290 lines), `wikey-core/src/__tests__/incremental-reingest.test.ts` 신규 (370 lines).

**핵심 invariant (P1-1 raw bytes)**: `decideReingest({ sourceBytes })` 의 `sourceBytes` 는 **raw disk bytes** — 변환된 텍스트 절대 금지. caller (ingest-pipeline.ts Step 0) 책임. registry.hash 가 raw bytes 기준이므로 비교도 raw bytes 로 해야 의미 있음.

**5 action union** (`ReingestAction`):
- `skip` — raw bytes 동일 + sidecar_hash 일치 → LLM/page write 0
- `skip-with-seed` — legacy (sidecar_hash 미존재) 첫 hash-match → sidecar_hash seed only (P1-3)
- `force` — raw bytes 변경 + conflicts=[] → 정상 재인제스트
- `protect` — raw bytes 변경 + conflicts ≠ [] → sidecar `.md.new` / source page user marker 보호
- `prompt` — conflicts + onConflict 제공 → UI modal 응답 분기

**Phase A conflicts collect-then-decide (P1-4)** — sequential return 금지, 모든 conflict 먼저 수집 후 action 결정:
- `sidecar-user-edit` — disk sidecar bytes != registry.sidecar_hash (시나리오 A/F, ★ v10 정정: R.hash 와 무관하게 수집)
- `source-page-user-edit` — wiki/sources/source-*.md 본문에 USER_MARKER 존재 (시나리오 D, ★ P1-5 source 한정)
- `duplicate-hash` — 같은 hash 가 다른 path 등록 (시나리오 E)
- `legacy-no-sidecar-hash` — registry.hash != raw hash + sidecar_hash 미존재 + disk sidecar 존재 → 보수적 protect (P1-3)

**Phase B 결정 트리** (★ codex v3 정정 — duplicate 분기를 hash-match 앞으로):
```
R == null                           → action='force', reason='new-source'
R_byHash != null && R_byPath == null → action='skip', reason='duplicate-hash-other-path'
R.hash == sourceHash:
  sidecar_hash null + disk         → action='skip-with-seed', reason='hash-match-sidecar-seed'
  sidecar_hash + disk diff          → action='skip', reason='hash-match-sidecar-edit-noted'
  else                              → action='skip', reason='hash-match'
R.hash != sourceHash:
  conflicts.length == 0             → action='force', reason='hash-changed-clean'
  onConflict provided               → action='prompt'
  else                              → action='protect'
```

**ReingestDecision interface** — preservedSourceId (★ 결정 10 stable per path), duplicateOfId (R_byHash.id 노출), duplicatePathToAppend (P1-6 + v4), conflicts[], registry/disk sidecar hash 모두 캡처.

**user-marker preservation helpers** (Hook 2 용):
- `USER_MARKER_HEADERS = ['## 사용자 메모', '## User Notes', '## 메모']` (config 노출은 후속).
- `extractUserMarkers(existingPage)` — NFC 정규화 후 line-start `^## ` 매칭, 다음 H2 또는 EOF 까지 본문 추출. 들여쓴 (4-space indent) 라인은 매칭 안 함. ★ P2-6 multiline regex.
- `mergeUserMarkers(newContent, markers)` — newContent 에 같은 헤더 라인이 이미 있으면 skip (P2-5 멱등). 빈 markers 면 newContent 그대로.

**sidecar protection helpers** (Hook 1 용):
- `protectSidecarTargetPath(sourcePath, wikiFS)` — default `<sourcePath>.md.new` → 충돌 시 `.md.new.1` ~ `.md.new.9` 자동 증가 → `.10` 도달 시 `IngestProtectionPathExhaustedError` throw.
- `computeSidecarHash(wikiFS, sidecarPath)` — `wikiFS.read` → `content.normalize('NFC')` → `TextEncoder().encode` → `computeFullHash`. Python ↔ TS 일관성 보장 (P2-7).

**Test (RED → GREEN)** — 24 신규 case (모듈 신규 → 모두 RED):
- 13개 decideReingest decision tree (new-source / hash-match / clean change / sidecar-user-edit / source-page-user-edit / duplicate / prompt branch / raw-bytes invariant / skip-with-seed legacy / skip-with-seed no disk sidecar / 동시 conflicts / legacy raw-hash mismatch / hash-match sidecar-edit-noted)
- 7개 user-marker (NFC composed/decomposed / happy / no marker / multiline regex / mergeUserMarkers idempotent / happy / empty)
- 3개 protectSidecarTargetPath (default / .1~.9 collision / .10 exhausted)
- 2개 computeSidecarHash (happy NFC / not-found null)
- 1개 USER_MARKER_HEADERS export

**Acceptance**: 0 → 24/24 PASS (599 → 623, +24). build 0 errors.

### 5.3.3 Step 3 — `ingest-pipeline.ts` 통합 (Step 0/0.5/0.6 + Hook 1/2/3)

**파일**: `wikey-core/src/ingest-pipeline.ts` (1965 → ~2150 lines, surgical 변경 6 곳), `wikey-core/src/__tests__/ingest-pipeline-incremental.test.ts` 신규 (190 lines).

**진입점 신규** (line 138 직후):
- `Step 0`: `rawDiskBytes = await readRawDiskBytes(wikiFS, sourcePath, opts?.basePath)` — basePath 우선 `fs.readFileSync`, 없으면 `wikiFS.read` → `TextEncoder.encode` 폴백. buildV3SourceMeta 와 동일 변수 재사용 (TOCTOU 회피).
- `Step 0.5`: `decision = await decideReingest({ sourcePath, sourceBytes: rawDiskBytes, wikiFS, basePath, onConflict: opts?.onConflict })`.
- `Step 0.6` 분기:
  - `forceReingest=true` + skip/skip-with-seed → caller-side override (helper 시그니처 미포함, ★ P2-2)
  - `prompt` → `onConflict({decision})` callback → 'overwrite'/'preserve'/'cancel' (cancel 시 `IngestCancelledByUserError` throw)
  - `skip` → `SkippedIngestResult` build, duplicate-hash 면 `appendDuplicateLocation` + saveRegistry, 즉시 return
  - `skip-with-seed` → registry sidecar_hash + last_action='skip-with-seed' 갱신만, LLM/page write/reindex 0, return (P1-3)

**Hook 1 (sidecar write block, line 226 부근)** — protect/canonical 분기:
```
isSidecarProtect = (decision.action === 'protect') &&
                   (conflicts.includes('sidecar-user-edit') OR
                    conflicts.includes('legacy-no-sidecar-hash'))   // ★ v11 정정
↓
protect: target = await protectSidecarTargetPath(sourcePath, wikiFS) → write `.md.new[.1~.9]`
         protectedSidecarPath set, canonicalSidecarPath null
canonical: target = `<sourcePath>.md` → write
           canonicalSidecarPath set
```
write 실패 시 `IngestProtectionFailedError` throw (P2-2 best-effort).

**Hook 2 (source page createPage 직전, line 417 부근)** — ★ P1-5 source 한정:
```
isSourcePageProtect = (decision.action === 'protect') &&
                       conflicts.includes('source-page-user-edit')
↓
existing = await wikiFS.read(`wiki/sources/${sourcePage.filename}`).catch(()=>'')
markers = extractUserMarkers(existing)
sourcePage.content = mergeUserMarkers(LLM_body, markers)
```
entity/concept page 는 미적용 (후속 follow-up #4 — LLM 결정적 출력 + 우연 H2 위험 분석 후 도입).

**Hook 3 (registry upsert, ★ v8/v9/v10/v11 정정)** — caller-side merge with isCanonicalSidecarWritten 조건:
```ts
const isSidecarProtected =
  decision.action === 'protect' &&
  (conflicts.includes('sidecar-user-edit') ||
   conflicts.includes('legacy-no-sidecar-hash'))   // ★ v11: legacy 도 cover
const isCanonicalSidecarWritten = !isSidecarProtected

const merged: SourceRecord = {
  ...existing,           // 기존 모든 필드 보존
  hash, size,
  last_action: decision.action,
  reingested_at: [...(existing.reingested_at ?? []), today],
  ingested_pages,
  ...(isCanonicalSidecarWritten ? {
    sidecar_vault_path: canonicalSidecarPath,
    sidecar_hash: await computeSidecarHash(wikiFS, canonicalSidecarPath),
  } : {})  // ★ protect 분기는 sidecar_hash 미갱신 (P1-2)
}
const nextReg = upsert(reg, sourceId, merged)  // ★ v9: immutable 반환값 사용 의무
await saveRegistry(wikiFS, nextReg)            // ★ 옛 reg 가 아닌 nextReg
```
protectedSidecarPath 가 set 이면 추가로 `appendPendingProtection(reg, sourceId, {kind:'sidecar-md-new', path, conflict})`.

**buildV3SourceMeta 시그니처 변경**:
```diff
- buildV3SourceMeta(wikiFS, sourcePath, basePath, ext, ingestedPagePath)
+ buildV3SourceMeta(wikiFS, sourcePath, rawDiskBytes, ext, ingestedPagePath, preservedSourceId?)
```
- rawDiskBytes 인자 신규 → 함수 내부 두 번째 disk read 제거.
- `preservedSourceId` 인자 신규 → R != null 분기에서 R.id 보존 (★ 결정 10 source_id stable per path). 기존 wikilink/provenance 영향 0.

**IngestResult / SkippedIngestResult union type** (★ v6 → v7 분리):
```ts
export interface SkippedIngestResult {
  readonly sourceId: string
  readonly skipped: true
  readonly skipReason: 'hash-match' | 'hash-match-sidecar-seed' | 'hash-match-sidecar-edit-noted' | 'duplicate-hash-other-path'
  readonly ingestedPages: readonly string[]
  readonly seededSidecarHash?: boolean
  readonly duplicateOfId?: string
}
export type IngestReturn = IngestResult | SkippedIngestResult
```
`ingest()` return type → `Promise<IngestResult | SkippedIngestResult>`. caller (commands.ts) 가 `'skipped' in result` type guard 분기.

**신규 IngestOptions 필드**: `forceReingest?: boolean` (caller-only override), `onConflict?: (info) => Promise<'overwrite'|'preserve'|'cancel'>`.

**신규 error 타입**: `IngestCancelledByUserError`, `IngestProtectionFailedError`.

**Test (skip 분기 testable subset)** — 5 신규 integration case (LLM 미호출 분기만):
- case 2 hash-match → ThrowingHttpClient 도 reach 안 됨, SkippedIngestResult.skipReason='hash-match'
- case 3 skip-with-seed → registry sidecar_hash 채워짐, last_action='skip-with-seed', seededSidecarHash=true
- case 9 duplicate-hash → SkippedIngestResult.duplicateOfId set, registry.duplicate_locations 에 신규 path
- case 13 hash-match-sidecar-edit-noted → raw 동일 + sidecar disk 다름 → skip
- forceReingest=false 검증

force/protect 분기는 LLM/canonicalize/reindex 의 광범위 mock 필요 → cycle smoke 로 검증 위임.

**Acceptance**: 0 → 5/5 PASS (623 → 628, +5). 회귀 0. build 0 errors.

### 5.3.4 Step 4 — `classify.ts movePair` sidecar pre-resolve + atomic

**파일**: `wikey-core/src/classify.ts` (576 → ~610 lines), `wikey-core/src/__tests__/move-pair.test.ts` (269 → 510 lines).

**MovePairOptions 확장**: `onSidecarConflict?: 'skip' | 'rename'` (default `'skip'`).

**MovePairResult 확장**: `renamedSidecarTo?: string`, `sidecarSkipReason` enum 에 `'dest-conflict-exhausted'` 추가.

**핵심 변경 (★ P1-7)** — 원본 `renameSync` **이전** sidecar 목적지 pre-resolve:
```
1) registry lookup
2) sidecar 목적지 후보 결정:
   - 'skip' + dest 충돌 → resolved=null, sidecarSkipReason='dest-conflict'
   - 'rename' + 충돌 → .1~.9 순차. 미존재 첫 path = resolved
                    모두 충돌 = 'dest-conflict-exhausted', 원본 이동 전 return
   - dest 미존재 → resolved = sidecarDest
3) 원본 renameSync (sidecar 처리 결정 완료 상태)
4) sidecar: resolved 있으면 renameSync, 없으면 skip
5) registry.recordMoveWithSidecar(reg, id, newOriginalVaultPath, sidecarOption)
   sidecarOption = resolved ? { kind: 'set', path } : { kind: 'preserve' }
```
이 atomic 한 단일 helper 호출로 vault_path + sidecar_vault_path race 방지.

**frontmatter rewrite 정정** (★ codex v3 P2 정정 — v4 명시):
- `rewriteSourcePageMeta(content, { vault_path, sidecar_vault_path })`
- skip 분기에서 `sidecar_vault_path = lookup.record.sidecar_vault_path ?? null` (existing 보존, null 덮어쓰기 금지)

**Test (RED → GREEN)** — 6 신규 case (기존 8 + 신규 6 = 14 total):
- case 1 dest-conflict default skip — registry/frontmatter sidecar_vault_path = 이전 위치 보존
- case 2 onSidecarConflict='rename' — `<base>.md.1` 생성, existing `.md` untouched
- case 3 exhausted (.1~.9 모두 충돌) — original NOT moved, sidecarSkipReason='dest-conflict-exhausted'
- case 4 rename success — registry.recordMoveWithSidecar atomic
- case 5 skip mode registry sidecar_vault_path = 이전 위치 (audit-friendly)
- case 6 skip 분기 source-page frontmatter sidecar_vault_path preserve (existing not null)

**Acceptance**: 8 → 14/14 PASS (628 → 634, +6). build 0 errors.

### 5.3.5 Step 5 — `audit-ingest.py` 5 신규 컬럼 + fixture smoke

**파일**: `scripts/audit-ingest.py` (228 → 320 lines), `scripts/__tests__/audit-fixtures/run.sh` 신규 (200 lines).

**JSON 5 신규 array** (★ additive only, 기존 키 보존 — `recountAuditAfterPairedExclude` UI helper 호환):
- `orphan_sidecars` — sidecar `.md` 만 있고 paired 원본 부재 (시나리오 C). raw/* 트리 walk 후 sibling 매칭.
- `source_modified_since_ingest` — `registry.hash != sha256(disk raw bytes)` (★ P1-8 분리 — raw hash diff)
- `sidecar_modified_since_ingest` — `registry.sidecar_hash != sha256(NFC(disk sidecar))` (★ P1-8 분리)
- `duplicate_hash` — 같은 hash 다중 path. canonical + duplicate_locations 합집합 후 grouped (`{hash, paths[]}`).
- `pending_protections` — `registry.pending_protections` snapshot (P2-1).

**Python ↔ TS NFC 일관성**: `unicodedata.normalize('NFC', content).encode('utf-8')` → `hashlib.sha256` (P2-7). 단독 raw bytes 는 NFC 미적용 (binary).

**WIKEY_AUDIT_ROOT env** — fixture smoke 지원 신규. `os.environ.get('WIKEY_AUDIT_ROOT')` 우선, 미지정 시 `Path(__file__).parent.parent`. 기존 동작 보존.

**Fixture smoke (6 case shell test)**:
1. clean state — 5 신규 array 모두 `[]`, exit 0
2. orphan sidecar — `raw/.../x.pdf.md` 만 있고 PDF 없음 → orphan_sidecars 에 등장
3. source modified — registry.hash mismatch → source_modified_since_ingest 만 채움 (sidecar_modified 비어있음, ★ negative-cross)
4. sidecar modified — registry.sidecar_hash mismatch + raw hash 동일 → sidecar_modified_since_ingest 만 채움
5. duplicate hash — registry.duplicate_locations 에 신규 path → duplicate_hash 에 `[{hash, paths}]`
6. pending_protections — registry 의 `pending_protections: [{kind:'sidecar-md-new', ...}]` 그대로 노출

**Acceptance**: 6/6 PASS exit 0 (`scripts/__tests__/audit-fixtures/run.sh` shell smoke). 본 vault 실측 sanity OK (clean state + canonical 무결성).

### 5.3.6 Step 6 — plugin entry + ConflictModal default + SkippedIngestResult type guard

**파일**: `wikey-obsidian/src/conflict-modal.ts` 신규 (95 lines), `wikey-obsidian/src/commands.ts` (수정 +50 lines), `wikey-core/src/index.ts` (export 확장).

**ConflictModal**: Obsidian Modal 상속, 3 button (`사용자 수정 보존 (preserve)` / `덮어쓰기 (overwrite)` / `취소 (cancel)`) + diff snippet 표시 (200 char 미리보기). `decided` flag + onClose fallback (윈도우 dismiss → cancel) 로 race 차단.

**plugin runIngestCore default modal injection** (★ P2-3):
```ts
const defaultConflict = (info) =>
  new Promise((resolve) => new ConflictModal(plugin.app, info, resolve).open())
const onConflict = ctx.onConflict ?? defaultConflict
// ingest 호출 시 onConflict 자동 주입 → silent auto-protect 위험 제거
```

**SkippedIngestResult type guard 처리**:
```ts
if ('skipped' in result) {
  const labels = {
    'hash-match': '이미 인제스트 완료 (변경 없음)',
    'hash-match-sidecar-seed': 'sidecar baseline 만 갱신 (LLM 호출 없음)',
    'hash-match-sidecar-edit-noted': '사용자 sidecar 수정 보존 (raw 변경 없음)',
    'duplicate-hash-other-path': `중복 detect — 동일 hash 가 ${duplicateOfId}`,
  }
  new Notice(`Wikey: ${labels[skipReason]}`, 4000)
  return { success: true, sourcePath, createdPages: [] }
  // saveIngestMap, classifyFileAsync, movePair 모두 skip — registry 가 이미 보유
}
```

**IngestCancelledByUserError handling** — PlanRejectedError 와 유사 패턴, `cancelled: true` 반환.

**wikey-core export 확장**:
- `ingest`, `IngestCancelledByUserError`, `IngestProtectionFailedError` 추가
- `SkippedIngestResult`, `ConflictInfo`, `ReingestDecision`, `OriginalLinkMode`, `ReingestAction`, `ConflictKind` 타입 export
- `decideReingest`, `USER_MARKER_HEADERS`, `protectSidecarTargetPath`, `computeSidecarHash`, `IngestProtectionPathExhaustedError` 함수/상수/error export

**Acceptance**: ConflictModal/plugin 단위 test 는 obsidian Modal mock 부재로 cycle smoke 위임. 회귀 wikey-core 634 PASS / wikey-obsidian build 0 errors.

### 5.3.7 Cycle Smoke — Obsidian CDP 5-step 시나리오 (실증)

**환경**: Obsidian 1.12.7 + `--remote-debugging-port=9222 --remote-allow-origins='*'`. wikey vault. plugin reload 후 진입.

**Sample**: `raw/0_inbox/cycle-smoke-5-3.md` (793 bytes synthetic md, PII-free, 4 H2 sections).

| # | 시나리오 | 분기 | LLM 비용 | 결과 |
|---|---|---|---|---|
| 1 | 첫 ingest | force=new-source | 1회 (Brief + Stage 1+2+3, ~2 min Gemini 2.5 Flash) | wiki 12 페이지 신규 (1 source + 5 entities + 8 concepts + index/log/.ingest-map). registry hash=43db..., last_action='force', ingested_pages=[source-cycle-smoke-5-3.md], path_history 2 entries (movePair raw/0_inbox→raw/3_resources/60_note/500_technology/) |
| 2 | 같은 ingest | skip=hash-match | **0회** | 로그 `skip (reason=hash-match, conflicts=[]) — no LLM/page write` + `skip — reason=hash-match sourceId=sha256:43db30bf3d8756c5`. modal close, plan stage 미진입 |
| 3 | 같은 bytes 다른 path (`cycle-smoke-5-3-copy.md`) | skip=duplicate-hash-other-path | **0회** | 로그 `skip (reason=duplicate-hash-other-path, conflicts=[duplicate-hash])`. registry.duplicate_locations=['raw/0_inbox/cycle-smoke-5-3-copy.md'], canonical vault_path 보존 |
| 4 | raw bytes append (793 → 1036 bytes) | force=hash-changed-clean | 1회 | hash: 43db... → 18b3..., last_action='force', reingested_at[1]. **★ source_id sha256:43db30bf3d8756c5 보존** (preservedSourceId 작동). size 갱신 |
| 5 | source page user marker (`## 사용자 메모`) + raw bytes 변경 | protect=hash-changed-with-conflicts (source-page-user-edit) | 1회 | **ConflictModal 자동 등장** (3 buttons preserve/overwrite/cancel). preserve 클릭 → action='protect' 변환. **Hook 2 작동: source page 새 LLM 본문 끝에 `## 사용자 메모` block 정확히 보존**. hash: 18b3... → 723a..., last_action='protect', reingested_at[2] |

**검증 evidence (실 vault)**:
- Step 2 console log 캡처: `[Wikey ingest] skip (reason=hash-match, conflicts=[]) — no LLM/page write`
- Step 4 source_id 보존: `registry['sha256:43db30bf3d8756c5'].hash` 가 변경되었지만 record key 동일
- Step 5 user marker preserve: `wiki/sources/source-cycle-smoke-5-3.md` tail 에 `## 사용자 메모\n\nThis is a critical user note that MUST be preserved...` 정확히 잔존

### 5.3.8 PMS 실 ingest — paired sidecar 보존 실증

**대상**: `raw/3_resources/20_report/500_technology/PMS_제품소개_R10_20220815.pdf` (3.6MB, 사용자 paired sidecar 6.4MB hash `d66c44b0...` 이미 disk 에 존재). registry 미등록.

**진행** (사용자 직접 ingest, master 모니터링):
- 22:21:46 baseline — registry 미등록, sidecar mtime 22:17 / hash d66c44b0...
- 22:21:50 즉시 backup `/tmp/PMS_..backup-20260425-222005` (Hook 1 도달 전 안전 확보)
- 22:21~22:22 ingest 진행 (Brief Proceed → Processing → Preview Approve&Write)
- 22:22:11 modal close, 19 wiki 파일 신규 (mtime < 2min)

**결과 (실측)**:

| 항목 | baseline (22:21:46) | post-write (22:23:06) | 변화 |
|---|---|---|---|
| sidecar size | 6,370,862 | 6,370,862 | **동일** |
| sidecar mtime | 22:17 | 22:17 | **동일** |
| sidecar hash | d66c44b0c57a7513... | d66c44b0c57a7513... | **동일** |
| wiki PMS 페이지 | 0 | 19 신규 (`source-lotus-pms-product-intro.md` + 6 entities + 9 concepts + index/log/map) | +19 |
| registry record | 미등록 | `sha256:dcbe5dd3f5325d4b` | 신규 |
| registry.sidecar_hash | — | d66c44b0... (= disk hash 일치) | 정상 |
| pending_protections | — | None | 정상 (force 분기) |
| last_action | — | force | 정상 (new-source) |

**해석**: Hook 1 의 `wikiFS.write` 가 호출되었으나 disk mtime 미변경 — 가능 원인: (a) Docling 변환 결과가 사용자 paired sidecar 와 byte-identical (사용자가 같은 docling 설정으로 미리 변환), 또는 (b) Obsidian vault adapter 의 same-content write disk skip. 어느 쪽이든 사용자 데이터 손실 0.

**GAP 발견 — R == null + paired sidecar 미보호** (plan v11 미커버):
- decideReingest 의 `sidecar-user-edit` conflict 검사가 `R != null && R.sidecar_hash != null` 조건 — 첫 ingest (R = null) 는 미통과
- 따라서 사용자가 이미 만들어 둔 paired sidecar 가 disk 에 있어도 force 분기 진입 → Hook 1 의 canonical overwrite 가 사용자 sidecar 를 덮어쓸 수 있음
- 본 PMS 케이스는 운 좋게 byte-identical 이라 손실 없었지만, 사용자가 paired sidecar 에 직접 메모/수정한 경우 위험 실현 가능
- **분석 시점에서 사용자 통찰**: "ingest 안 된 상태에서 overwrite 할 게 뭐가 있냐" — registry 미등록 = wiki 데이터 자체가 없으니 손실 risk 낮음. 정확한 통찰. 단 paired sidecar 자체에 사용자 편집이 있다면 손실 가능
- **후속 follow-up #10 등재 권장**: `R == null && diskSidecarBytes != null` 시 conflict 'unmanaged-paired-sidecar' push → action='protect' (또는 'prompt')

### 5.3.9 잔재 정리 (cycle smoke 산출물)

**삭제 대상**:
- `/tmp/PMS_..backup-..` + `/tmp/wikey-smoke-5.3` + `/tmp/PMS-monitor-snapshot.txt` + `/tmp/wikey-smoke-probe.js` + `/tmp/wikey-smoke-reg-*.json` + `/tmp/wikey-smoke/` (디렉토리)
- `raw/3_resources/60_note/500_technology/cycle-smoke-5-3.md` (raw)
- `wiki/sources/source-cycle-smoke-5-3.md` (source)
- `wiki/entities/{qmd-index, wikey, cycle-smoke, source-registry, bm25}.md` — 5 EXCLUSIVE entity (다른 source reference 없음)
- `wiki/concepts/{incremental-reingest, markdown, hash-based-decision-tree, hwp, bm25, 3-tier-architecture, pdf, wikey-source-registry-json, sha256}.md` — 9 EXCLUSIVE concept
- `wiki/.ingest-map.json` — 2 cycle-smoke entries 제거
- `.wikey/source-registry.json` — record `sha256:43db30bf3d8756c5` 완전 삭제
- `wiki/index.md` — cycle-smoke wikilinks 14 라인 제거
- `wiki/log.md` — cycle-smoke-5-3 ingest H2 block 모두 제거 (★ §5.2/§5.1 phase-5 entries 보존 — 의도치 않은 1차 over-removal 후 git checkout + 정확한 H2 패턴 재제거 + PMS ingest entry prepend 복원)

**최종 상태**: 2 registry record (NanoVNA + PMS), 2 ingest-map entries, raw/wiki PMS 무결성 영향 없음.

### 5.3.10 후속 follow-up — ConflictModal default + Approve&Write UX + Original-link footer mode + settings i18n

**파일**: `wikey-obsidian/src/conflict-modal.ts` (위 §5.3.6), `wikey-obsidian/src/ingest-modals.ts` (수정), `wikey-obsidian/styles.css` (CSS 추가), `wikey-core/src/query-pipeline.ts` (mode 분기), `wikey-obsidian/src/main.ts` (settings), `wikey-obsidian/src/sidebar-chat.ts` (caller), `wikey-obsidian/src/settings-tab.ts` (UI dropdown + 영문화).

**Approve & Write UX (사용자 발견)**:
- 사용자 보고: "버튼이 클릭되고 아무런 반응이 없어서 여러번 누르게 되네"
- 진단: `resolvePreview(true)` 가 resolver=null 체크로 다중 호출은 차단되지만, button 자체가 disable 안 되고 visual feedback 없어 반복 클릭 발생
- 수정 (`ingest-modals.ts:474`): click 시 `approveBtn.disabled = true` + `cancelBtn.disabled = true` + 라벨 `Writing… (please wait)` + class `wikey-modal-btn-busy` 추가
- CSS 신규 (`styles.css:1808`): `.wikey-modal-btn-busy::before` 좌측 12px 회전 spinner (`wikey-spin` keyframe 재사용) + cursor: progress

**Original-link footer mode (`OriginalLinkMode = 'raw' | 'sidecar' | 'hidden'`)**:
- 사용자 통찰 1: "어떤 경우에는 실제원본, 어떤 경우에는 sidecar 가 연결되는것 같다" — 정확한 진단
- 분석: 답변 "원본:" footer (`appendOriginalLinks`) 는 항상 `registry.vault_path` (raw 원본). raw 가 .md 면 markdown 으로 열림 (NanoVNA 케이스), .pdf 면 attachment 로 열림 (PMS 케이스) — 동일 정책의 형식별 결과
- 사용자 통찰 2: "원천을 건드릴 필요는 없고 sidecar 의 파일 규칙을 이용하면 될듯. ....ext.md 형태로 생성되니까 이걸 이용하면 될듯한데" — 정확
- 구현: `deriveSidecarPath(vaultPath)` helper — `.md`/`.txt` 로 끝나면 자체 반환, 그 외에는 `<vaultPath>.md`. registry.sidecar_vault_path 의존 0 (legacy record 자동 호환)
- 사용자 통찰 3: "링크만 제대로 살아있으면 되잖아. rollover 시는 링크를 tooltip 에 표현해주고" — Obsidian alias 형식 `[[<full path>|<display>]]` 로 정확히 부합
- 사용자 통찰 4: "원본 파일명만 보여줘. 뒤의 extension 은 안 보여줘도 될듯" — `basenameWithoutExt(path)` helper
- 결과 형식:
  - mode='raw' (default): `원본: [[raw/.../foo.pdf|foo]]`
  - mode='sidecar': `원본: [[raw/.../foo.pdf.md|foo]]` (paired) / `원본: [[raw/.../note.md|note]]` (단독 md)
  - mode='hidden': footer 미출력
- Test 6 신규: raw default / sidecar paired / sidecar 단독md / sidecar txt / hidden / display 디렉토리 미포함 (slash 검증)

**Settings UI 영문화 일관성** (사용자 요청 "다른 것들도 영문으로 해. 일관성 있게."):
- 35 한글 라인 → 0 한글 라인 (settings-tab.ts 1173 lines 중)
- 변경 항목: Reset 안내/Scope dropdown, Ingest Prompts intro/Stage 1-3 description+inlineHint, Verify results desc, Allow ingest when PII is detected toggle/desc, PII redaction mode dropdown+desc, Original file link in answer footer, OCR fallback 주석, Enable PII detection toggle/desc (Advanced), IngestPromptEditModal 주의, SCHEMA_OVERRIDE_TEMPLATE 예시
- 일관성 원칙: Sentence case (toggle/setting names), 한 두 문장 description 첫 글자 대문자/마침표 종결, dropdown options 짧은 라벨 + 자세한 설명은 description, `Variables: {{...}}` 패턴 통일, `(default)` 영문 통일

**Test (RED → GREEN)** — query-pipeline.test.ts +6 신규 case (29 → 35 total):
- mode='sidecar' paired pdf → `[[<base>.pdf.md|<base>]]`
- mode='sidecar' 단독 md → `[[<path>.md|<basename>]]` (.md.md 가 되지 않아야)
- mode='sidecar' txt → 자체
- mode='hidden' → `원본:` 미출력
- mode='raw' default → alias 형식 (디렉토리/확장자 숨김)
- display 디렉토리 미포함 검증 (slash 매칭)

**Acceptance**: 35/35 PASS (629 → 640, +6 신규 final). build 0 errors (core + obsidian).

### 5.3.11 회귀 + 종합

**테스트 누적 변화**:
- baseline: 584 (Phase 5 §5.1.1 + §5.2 종결 시점)
- Step 1 source-registry: +15 (584 → 599)
- Step 2 incremental-reingest: +24 (599 → 623)
- Step 3 ingest-pipeline-incremental (skip 분기 testable): +5 (623 → 628)
- Step 4 move-pair: +6 (628 → 634)
- §5.3.10 query-pipeline (Original-link footer mode): +6 (634 → 640)
- **누적 +56 신규** (plan v11 명시 +61 보다 5 부족 — Step 6 ConflictModal/plugin 의 Obsidian Modal mock 부재로 cycle smoke 위임)

**Build 0 errors** (wikey-core + wikey-obsidian, 1 import.meta warning 기존).

**audit-ingest fixture smoke**: 6/6 PASS exit 0.

**Cycle smoke**: 5/5 PASS (master CDP 직접 실행).

**Wiki 재생성 없음 확증**: 본 §5.3 변경은 ingest pipeline 의 진입 분기 + Hook 3곳 추가 + helper 신규 + audit-ingest 컬럼 5개 추가 + plugin Modal 신규. 기존 Phase 4 데이터 (registry, wiki, qmd) 는 모두 backwards compat 으로 read 가능. legacy record 는 skip-with-seed 분기로 자동 마이그레이션.

### 5.3.12 후속 follow-up #10/#11 종결 (2026-04-25 session 12 추가 작업)

본 세션 PMS 실 ingest 분석 + 사용자 통찰 ("어떤 경우엔 raw, 어떤 경우엔 sidecar 가 연결") 에서 도출된 GAP 2건. plan v11 미커버 영역. 사용자 지시로 동일 세션에서 즉시 해결.

#### 5.3.12.1 #10 fix — R==null + paired sidecar 보호

**파일**: `wikey-core/src/source-registry.ts` (ConflictKind union 확장), `wikey-core/src/incremental-reingest.ts` (Phase A + Phase B), `wikey-core/src/ingest-pipeline.ts` (Hook 1 + Hook 3 + pending_protections kind 분기), `wikey-core/src/__tests__/incremental-reingest.test.ts` (+4 신규 case).

**ConflictKind 확장**:
```ts
export type ConflictKind =
  | 'sidecar-user-edit'
  | 'source-page-user-edit'
  | 'duplicate-hash'
  | 'orphan-sidecar'
  | 'legacy-no-sidecar-hash'
  | 'unmanaged-paired-sidecar'   // ★ 신규 — R==null + disk sidecar 존재
```

**decideReingest Phase A 확장** — `R == null && diskSidecarExists` 시 `'unmanaged-paired-sidecar'` push:
```ts
if (R == null && diskSidecarExists) {
  conflicts.push('unmanaged-paired-sidecar')
}
```

**Phase B `R == null` 분기 재구성** (이전: 무조건 force):
```ts
if (R == null) {
  if (conflicts.length === 0) → action='force', reason='new-source'
  else if (onConflict provided) → action='prompt', reason='new-source'
  else → action='protect', reason='new-source'
}
```

**Hook 1 (`isSidecarProtect`) + Hook 3 (`isSidecarProtected`) 조건 확장** — `'unmanaged-paired-sidecar'` 도 sidecar 보호 분기:
```ts
const isSidecarProtect = protectMode &&
  (conflicts.includes('sidecar-user-edit') ||
   conflicts.includes('legacy-no-sidecar-hash') ||
   conflicts.includes('unmanaged-paired-sidecar'))   // ★ #10
```

**pending_protections kind 분기 확장**:
```ts
const conflict = decision.conflicts.includes('sidecar-user-edit')
  ? 'sidecar-user-edit'
  : decision.conflicts.includes('unmanaged-paired-sidecar')   // ★ #10
  ? 'unmanaged-paired-sidecar'
  : 'legacy-no-sidecar-hash'
```

**Test (RED → GREEN)** — 4 신규 case (24 → 28 total):
- case A: R==null + disk sidecar → action='protect', conflicts=['unmanaged-paired-sidecar']
- case B: R==null + disk sidecar + onConflict → action='prompt'
- case C: R==null + disk sidecar 부재 → action='force' (이전 동작 유지, 회귀 0)
- case D: hwp 파일에 paired md → 'unmanaged-paired-sidecar' (md/pdf 외 포맷도 동일)

**Acceptance**: 24 → 28 PASS. 회귀 0. build 0 errors.

#### 5.3.12.2 #11 fix — entity/concept `## 출처` wikilink alias 표준화

**파일**: `wikey-core/src/canonicalizer.ts` (`buildPageContent` 의 `## 출처` 형식), `wikey-core/src/__tests__/canonicalizer.test.ts` (+4 신규 case), `scripts/fix-source-wikilinks.py` 신규 (one-off bulk fix script).

**형식 변경 (`buildPageContent`)**:
```diff
- - [[${sourceFilename.replace(/\.[^.]+$/, '')}]]
+ const lower = sourceFilename.toLowerCase()
+ const sidecarRef = lower.endsWith('.md') || lower.endsWith('.txt')
+   ? sourceFilename
+   : `${sourceFilename}.md`
+ const sourceDisplay = sourceFilename.replace(/\.[^.]+$/, '')
+ - [[${sidecarRef}|${sourceDisplay}]]
```

결과:
- PDF: `[[PMS_제품소개_R10_20220815.pdf.md|PMS_제품소개_R10_20220815]]` — sidecar md 로 resolve, 화면에 raw basename 표시
- 단독 md: `[[note.md|note]]` — 자체로 resolve (`.md.md` 가 되지 않음)
- HWP: `[[doc.hwp.md|doc]]` — 단독 md 와 동일 패턴
- TXT: `[[plain.txt|plain]]` — 자체로 resolve (sidecar 미생성 정책 정합)

**Test (RED → GREEN)** — 4 신규 case (53 → 57 total):
- paired pdf alias 형식 + 이전 broken 형식 잔존 안 함
- 단독 md alias 형식 + `.md.md` 미발생 검증
- hwp alias 형식
- txt alias 형식 (sidecar 미생성)

**기존 vault broken link 일괄 fix script** (`scripts/fix-source-wikilinks.py`):
- `wiki/sources/source-*.md` frontmatter 의 `vault_path` 읽어 source index 구축
- `wiki/entities/*.md` + `wiki/concepts/*.md` 의 `## 출처` 섹션 안 `- [[<basename>]]` (alias 아닌 형태) 매칭 시 alias 형식으로 교체
- idempotent — 이미 alias 형식이면 skip
- `LINE_RE = /^(- \[\[)([^\]\|]+)(\]\])\s*$/m` — `|` 없는 형태만 매칭 (alias 형식 무시)

**일괄 fix 실행 결과**:
- source index: 2 entries (NanoVNA + PMS)
- 36 페이지 fix: PMS 6 entities/9 concepts + NanoVNA 4 entities (nanovna-v2 / nanovna-v2-plus4 / vector-network-analyzer / vna 등) + 11 concepts + 2 source 페이지의 자체 entity 도 포함
- ★ 0 unchanged → 모든 페이지가 broken 형식이었음 (cycle smoke 잔재 정리 후 남은 것 모두 해당)

**CDP unresolvedLinks 재검증** — fix 후:
- `wiki/entities/lotus-pms.md` unresolvedLinks: `{}` (이전: `{ PMS_제품소개_R10_20220815: 1 }`)
- resolvedLinks count: 9 → **10** (출처 link 가 resolved 로 이동)
- `metadataCache.getFirstLinkpathDest('PMS_제품소개_R10_20220815.pdf.md', ...)` → resolved (sidecar md 로 매칭)

**Acceptance**: 53 → 57 canonicalizer test PASS. 36 wiki 페이지 broken link 모두 fix. CDP 검증 unresolved 0.

#### 5.3.12.3 회귀 + Build (#10 + #11 합산)

- wikey-core test: 640 → **648 PASS** (+8 신규: #10 +4 + #11 +4)
- build 0 errors (core + obsidian, 1 import.meta warning 기존)
- plugin reload 완료
- 잔여 follow-up (다음 세션):
  - `.md.new` 자동 cleanup (P2-1)
  - dashboard/audit panel UI 시각화 (5 신규 컬럼 배지)
  - `user_marker_headers` config 노출
  - entity/concept page user marker 보호 (LLM 결정적 출력 분석 후)
  - Hash perf (file size + mtime 1차 필터)
  - CLI `--force` `--diff-only` 플래그
  - Section-level diff (H2 단위 hash 매칭)
  - Tombstone restore + sidecar_hash 정합성
  - Python ↔ TS NFC cross-language 자동 검증

---

## 5.4 표준 분해 규칙 self-extending 구조 (P2) — **종결** (2026-04-26 session 13)
> tag: #framework, #engine, #architecture
> **이전 번호**: `was §5.6`. 2026-04-22 Phase 4 §4.5.1.7.2 PMBOK 하드코딩이 Stage 0 사전 검증.
> **session 13 종결** (2026-04-26): 4 Stage + integration test + AC21 라이브 cycle smoke + follow-up 4 항목 모두 GREEN. codex post-impl review Cycle #6 APPROVE. Stage 4 = alpha v1 wire mock embeddings 검증 완료, 실 qmd 통합은 v2 deferral (다음 세션 진입점).

### 5.4.0 Stage 0 사전 검증 (Phase 4 §4.5.1.7.2)

- PMBOK 10 knowledge areas 를 canonicalizer prompt 에 단발 하드코딩 (A안). 352/352 PASS.
- 철학 선언: `wiki/analyses/self-extending-wiki.md`.
- 실측: PMS 5-run 후 Stage 1 진입 결정 (별 작업).

### 5.4.1 Stage 1 — static `.wikey/schema.yaml` override (commit 9b7da21, 2026-04-26 14:09)

**Plan v7 (codex pre-impl Cycle #9 APPROVE)**: `plan/phase-5-todox-5.4.1-self-extending.md`. cycle #1~#13 master fix 누적 (line 1 / b / c / d / e / f / g 7-anchor 검증 통과).

**구현 (4 file, +69/-1)**:
- `wikey-core/src/types.ts:172-260` (+42): `StandardDecompositionComponent` (slug + type + optional aliases, F3) / `StandardDecomposition` (name + aliases + umbrella_slug + components + rule + require_explicit_mention + origin) / `StandardDecompositionsState` 3-kind discriminated union — `{ kind: 'empty-explicit' }` (사용자 명시 disable, header `[]`) / `{ kind: 'empty-all-skipped'; skippedCount: N }` (silent skip + warn) / `{ kind: 'present'; items: ... }` (정상). absent ⟺ `undefined` 자체 (codex Cycle #2 단일화 결정 — `kind: 'absent'` literal 폐기). `SchemaOverride.standardDecompositions?: StandardDecompositionsState` 추가.
- `wikey-core/src/schema.ts:284-464` (+358/-31):
  - `BUILTIN_STANDARD_DECOMPOSITIONS` 상수 (line 284, export): PMBOK 10 areas — project-{integration, scope, schedule (alias project-time), cost, quality, resource (alias project-human-resource), communications, risk, procurement, stakeholder}-management. 6판 → 7판 변경 (`project-time-management` → `project-schedule-management`, `project-human-resource-management` → `project-resource-management`) F3 aliases 로 backward compat.
  - `parseSchemaOverrideYaml` 4 시나리오: (1) `standard_decompositions:` 키 부재 → `standardDecompositions === undefined` (BUILTIN 자동) (2) `standard_decompositions: []` → `kind: 'empty-explicit'` (사용자 명시 disable) (3) entry invalid silent skip + warn → `kind: 'empty-all-skipped'` + `skippedCount` (4) 정상 entries → `kind: 'present'`.
  - `STANDARD_EXCEPTIONS` Set (line 143) 갱신: `project-schedule-management` + `project-resource-management` canonical slug 2 추가 (anti-pattern `-management` suffix 차단으로부터 보호) — codex Cycle #2 P3 정정.
  - `buildStandardDecompositionBlock(override)` 4 시나리오 분기 (line 600-680): `undefined` → BUILTIN 만 / `empty-explicit` → 빈 string (disable 의도 보존) / `empty-all-skipped` → BUILTIN fallback + warn / `present` → BUILTIN + user entries append (F1 v3 정책 — 사용자가 ISO-27001 만 추가해도 PMBOK 자동 유지).
- `wikey-core/src/canonicalizer.ts:209-262` (+13/-7): 작업 규칙 #7 의 PMBOK 10 areas 인라인 (line 262) 제거 → `{{STANDARD_DECOMPOSITION_BLOCK}}` placeholder 치환 (F4). overridePrompt 분기 (line 238-246) 도 동일 placeholder. prompt 의 "별도 concept" → "별도 entity 또는 concept" (F5 — component type 이 entity 도 허용).
- `wikey-core/src/__tests__/{canonicalizer,schema-override}.test.ts` (+141/+328): 22 신규 cases — parseSchemaOverrideYaml 9 (4 시나리오 + warn capture spy) + builder 5 + override 2 + ISO-27001 fixtures 2 + AC6.a 3-anchor phrase 1 + AC7 build/test 1.
- ISO 27001 fixtures: `__tests__/fixtures/iso27001-{5,93}-control.yaml` (5 control / 93 control 으로 메모리·시간 회귀 검증, F6 v3).

**의사결정 근거**:
- 3-kind union vs nullable: `null` 단일화 → `empty-explicit` (사용자 명시) vs `empty-all-skipped` (자동 fallback) 의미 구분 불가. discriminated union 으로 builder 분기 명확.
- F1 append vs replace: 사용자가 ISO-27001 1개만 추가해도 PMBOK 사라지면 신규 vault 가 갑자기 분해 정확도 ↓ (R3 risk). append 가 사용자 부담 0.
- v3 append 정책: built-in PMBOK + user yaml 의 same umbrella_slug 충돌 시 first-wins (BUILTIN spread 가 array 앞). 사용자 명시 user-yaml 이 BUILTIN 을 override 가능 (codex Cycle #2 정정).

**검증** (commit 9b7da21):
- 단위 회귀: 525 → **670 PASS** (Stage 1 신규 22 cases + 기존 525 + 누적 123). build 0 errors (`npx tsc --noEmit`).
- codex Cycle #1~#13 (plan v1 → v7 master fix 누적 13 사이클): F1~F8 finding 누적 18건 master fix → v7 final APPROVE.
- 7-anchor self-check (rules.md §10): (a)(b)(c)(d)(e)(f)(g) 모두 GREEN.

### 5.4.2 Stage 2 — extraction graph suggestion (commit ce547ca, 2026-04-26 14:31, +20 cases)

**Plan**: `phase-5-todox-5.4-integration.md §3.2` (통합 plan v5 codex pre-impl Cycle #5 APPROVE / BUILD_BREAK_RISK LOW).

**구현 (5 신규 module + 4 수정 file, +1360/-2)**:

- **`wikey-core/src/suggestion-storage.ts`** (신규): pure functions `addSuggestion(store, s)` (id 기반 filter + replace, dedup) / `updateSuggestionState(store, id, state)` (immutable map) / `rejectSuggestion(store, id, reason?)` (state 'rejected' + negativeCache append) / `isInNegativeCache(store, id)` / `emptyStore()`. SuggestionStore = `{ version: 1, suggestions, negativeCache }`. Spread immutable.
- **`wikey-core/src/suggestion-detector.ts`** (신규):
  - `detectCoOccurrence(ingest, minSiblings=3, minPrefixLen=5)` (line 65-103): 같은 source 안 N 개 concept 이 동일 prefix 길이 ≥ 5 chars 공유 시 후보. 예: `iso-27001-a-5/-6/-7` 3 sibling, prefix `iso-27001-a-` (12 chars).
  - `detectSuffixCluster(history, minSources=2, suffixWhitelist=['-management', '-control', '-principle', '-domain', '-practice', '-area'])` (line 132-180): cross-source `-management` 같은 whitelisted suffix 가 ≥ 2 distinct source 등장 시 후보. umbrella_slug = `cluster-${suffix}` (post-impl Cycle #1 F1 fix 후 firstWord prefix 우선, follow-up §3.6).
  - `computeConfidence(p)` (line 199): `0.4 * Math.min(p.support_count / 5, 1) + 0.3 * (p.unique_suffixes <= 1 ? 1.0 : 0.5) + 0.2 * Math.min(p.mention_count / 20, 1) + 0.1 * (p.overlapsWithBuiltin ? 0 : 1)`. 임계 ≥ 0.6 alpha (라이브 baseline calibration 의무 — line 14 주석).
- **`wikey-core/src/schema-yaml-writer.ts`** (신규): `appendStandardDecomposition(wikiFS, suggestion, path?)` 6 분기 (a) round-trip validation (post-impl Cycle #1 F1) — umbrella_slug + components.slug 가 schema.ts:435 parser regex `/^[a-z][a-z0-9-]*$/` 일치 검증, 미일치 시 `invalid-slug` reject (b) idempotency — `umbrella_slug: <slug>` substring marker (c) `standard_decompositions:` top-level key 위치 line scan (d) header `[]` reject (`header-unsafe`, 사용자 명시 disable 의도 보호) (e) section 범위 결정 (다음 top-level alphabetic key 직전까지) (f) block insert. yaml lib 의존성 추가 X (minimal subset 정책).
- **`wikey-core/src/suggestion-pipeline.ts`** (신규): `runSuggestionDetection({history, sourcePath, ingestedAt, canon, negativeCache})` — co-occurrence + suffix cluster detect → confidence ≥ 0.6 + signature 가 negativeCache 외 → Suggestion 생성. `ingestRecordFromCanon` (post-impl 라이브 cycle smoke fix: filename 의 `.md` 확장자 strip — slug suffix matching 정확).
- **`wikey-core/src/suggestion-panel-builder.ts`** (신규): `buildSuggestionCardModel(suggestion)` HTML model (title, confidenceLabel, summary, componentSlugs, evidenceLines, actions) + `acceptSuggestion(store, id)` + `rejectSuggestionFromPanel(store, id)` DOM 액션 핸들러. 실 DOM 통합은 sidebar-chat.ts.
- **`wikey-core/src/types.ts`** 확장 (+69 line 196-265): `IngestRecord` (source / ingestedAt / concepts / entities) / `CandidatePattern` (umbrella_slug / components / support_count / unique_suffixes / mention_count / overlapsWithBuiltin / evidence) / `SuggestionEvidence` / `SuggestionState` 4-kind union (pending / accepted with acceptedAt / rejected with rejectedAt + reason / edited with userEdits) / `Suggestion` (id sha1 + signature) / `SuggestionStore` / `SuggestionStorage*` interface.
- **`wikey-core/src/index.ts`** barrel export +41 lines (Stage 2 신규 export 모두).
- **`wikey-core/src/ingest-pipeline.ts`** finalize 단계 hook (+90 lines):
  - line 506 canonResult 호이스팅 — FULL/SEGMENTED route 후 finalize 에서 read 가능.
  - line 830 `runSuggestionFinalize(wikiFS, sourcePath, canonResult, log)` 신규 helper — ingest 완료 직후 `.wikey/mention-history.json` (raw `{ version, ingests: [...] }`) + `.wikey/suggestions.json` (raw `{ version, suggestions, negativeCache }`) 자동 누적. 동시성 보호 (sourcePath + ingestedAt dedup).
- **`wikey-obsidian/src/sidebar-chat.ts`** Suggestions panel (+110 lines): PanelName 'suggestions' 추가, sidebar header button (post-impl Cycle #1 F2 fix 후 정상 노출), 카드 layout (h4 title + p confidence/summary + ul components + details evidence + actions: Accept/Edit/Reject).

**의사결정 근거**:
- minSiblings=3 vs 2: 2 면 false positive 多 (모든 표준의 단일 sub-section 도 후보). 3 이 alpha sweet spot.
- suffixWhitelist 6 종: marketing 의 `-feature`, `-benefit` 차단. 표준 도메인 suffix 만 (PMBOK / ISO / ITIL / GDPR 패턴 분석).
- confidence 공식 가중치 (0.4 / 0.3 / 0.2 / 0.1): cross-source support 가 가장 강한 신호 (사람이 봐도 신뢰). suffix homogeneity 가 표준다운 패턴. mention density 보조. builtin overlap 은 drop trigger.
- 임계 ≥ 0.6: 4 가중치 weighted sum 의 mean (0.5 좀 위) 으로 marginal 후보 차단. 라이브 calibration 의무 (premature hardening 회피).

**검증** (commit ce547ca):
- 단위 회귀: 670 → **690 PASS** (+20: AC2 3 + AC3 4 + AC4 3 + AC5 3 + AC6 2 + AC7 3 + AC8 2). build 0 errors.
- TDD RED→GREEN 매 AC 마다 (vitest verbose). RED: `Cannot find module '../suggestion-storage.js'` → GREEN: `Tests N passed`.
- Karpathy 4원칙: yaml lib 신규 X (minimal subset writer) / 임계 hardening 안 함 (alpha calibration comment) / Stage 1 코드 무변경 surgical / TDD 정량 검증.

### 5.4.3 Stage 3 — in-source self-declaration (commit c34b128, 2026-04-26 14:41, +21 cases)

**Plan**: 통합 plan §3.3 (line 560-776).

**구현 (1 신규 module + 3 수정 file, +622/-1)**:

- **`wikey-core/src/self-declaration.ts`** (신규, ~190 lines):
  - **타입 (types.ts:267-310, +29 line)**:
    - `SelfDeclaration` 11 필드 (umbrella_slug / umbrella_name / components / rule / require_explicit_mention / source / section_idx / section_title / extractor: 'pattern-matching' | 'llm' / extractedAt / persistChoice). 모두 readonly.
    - `SelfDeclarationPersistChoice` 3-kind discriminated union: `{ kind: 'runtime-only' }` (default — 해당 ingest 세션만) / `{ kind: 'pending-user-review' }` (재 ingest 시 자동 elevation) / `{ kind: 'persisted'; persistedAt: string }` (Stage 2 writer append 후).
  - **함수 5 export**:
    - `mergeRuntimeIntoOverride(override, runtime)` 4 시나리오 (line 30-75): (1) `runtime.length === 0` → override 그대로 (early return) (2) `override === undefined` 또는 baseState `empty-all-skipped` → 새 SchemaOverride 생성 + runtime items 만 (BUILTIN 은 builder 가 add) (3) `empty-explicit` → override 그대로 (사용자 명시 disable 보존, runtime 무시) (4) `present` → BUILTIN + user yaml + runtime append.
    - `extractSelfDeclaration(section, source, options)` (line 142-194): section.headingPattern !== 'standard-overview' guard (defensive null) → section.body 의 numbered (`/^\d+\.\s+/`) 또는 bullet (`/^-\s+/`) list 추출 → listItems ≥ 5 임계 → umbrella_slug 추론 (section.title 의 표준 이름 → canonicalizeSlug) → components map (slug + type 'methodology' default) → `SelfDeclaration` 생성 (extractor 'pattern-matching' / persistChoice 'runtime-only' default).
    - `elevateToReview(declaration)` (line 200-205): `persistChoice: { kind: 'pending-user-review' }` 로 transition.
    - `persistDeclaration(declaration, persistedAt)` (line 211-216): `persistChoice: { kind: 'persisted', persistedAt }` 로 transition.
    - `shouldStage3ProposeRuntime(store, umbrella_slug)` 4 분기 (line 220-235): (1) 매칭 suggestion 없음 → true (신규) (2) accepted → false (이미 schema.yaml 에 있음) (3) rejected → false (negativeCache, 사용자 거부) (4) pending|edited → true (evidence 추가).
- **`wikey-core/src/section-index.ts`** 갱신 (line 23 + 368-378):
  - HeadingPattern union 7 종: 기존 `'toc' | 'appendix' | 'contact' | 'revision' | 'copyright' | 'normal'` + 신규 `'standard-overview'`.
  - `classifyHeadingPattern(title)` 의 standard keyword 분기 (line 368-378): 한국어/영어 6 regex — `/개요|overview|introduction/`, `/구조|structure|architecture/`, `/구성|composition/`, `/영역|domain|area/`, `/지식체계|body of knowledge/`, `/knowledge\s+area/`. 매치 시 `'standard-overview'` 반환 (`'normal'` 분기 직전).
- **`wikey-core/src/index.ts`** barrel export +12 lines (Stage 3 5 함수 + 2 타입).

**테스트 (`__tests__/self-declaration.test.ts` +303 lines, 21 cases)**:
- AC9 mergeRuntimeIntoOverride 5 cases (runtime 비어있음 early return / undefined 신규 생성 / empty-explicit 무시 / empty-all-skipped runtime 만 / present append)
- AC10 classifyHeadingPattern 'standard-overview' 3 cases (한국어 "ISO 27001 개요" / 영어 "Body of Knowledge" / 미매치 "Project Plan")
- AC11 extractSelfDeclaration 4 cases (정상 numbered list / bullet list / listItems < 5 / standard-overview 가 아니면 null)
- AC12 persist transition 2 cases (elevateToReview → 'pending-user-review' / persistDeclaration → 'persisted' + persistedAt)
- AC13 shouldStage3ProposeRuntime 5 cases (4 분기 시나리오 + edge case)
- AC14 false positive guard 2 cases ("5 핵심 기능" marketing keyword silent drop / component slug < 5 chars 차단)

**의사결정 근거**:
- runtime-only default vs persist 자동: marketing 자료의 enumerate list 가 표준처럼 보일 위험 → 사용자 review modal 까지 시간 buffer. 자동 persist 는 false positive 누적.
- 6 keyword regex (한/영): "지식체계" (Body of Knowledge) 같은 PMBOK 한국어 표현 + ISO "knowledge area" 같은 영어 표현 모두 cover.
- 4-분기 shouldStage3ProposeRuntime: Stage 2 suggestion 과 redundancy 방지 (같은 umbrella_slug 가 양쪽 store 에 중복 X).

**검증** (commit c34b128):
- 단위 회귀: 690 → **711 PASS** (+21).  build 0 errors.
- 의도된 RED phase 확인 (`Error: Cannot find module '../self-declaration.js'`) → GREEN.
- 7-anchor self-check: (a) 시그니처 cross-file 일관 / (c) builder 4 분기 / (d) AC test ≥ 12 cases — 모두 PASS.

### 5.4.4 Stage 4 — cross-source convergence (commit 87969fa, 2026-04-26 14:53, +10 cases)

**Plan**: 통합 plan §3.4 (line 778-981). alpha / page-level-limited (mention-level granularity v2 deferral).

**구현 (1 신규 module + 1 신규 script + 4 수정 file, +977/-1)**:

- **`wikey-core/src/convergence.ts`** (신규):
  - **타입 (types.ts:401-430, +37 line)**:
    - `SourceMention` (source / mentioned_components / is_umbrella_only). 모두 readonly.
    - `ConvergedDecomposition` (umbrella_slug / umbrella_name / converged_components / source_mentions / arbitration_method: `'union' | 'llm'` / **arbitration_confidence**: number 0~1 / arbitration_log? / convergedAt). 필드명 `arbitration_confidence` (NOT `confidence`) — codex Cycle #2 정정 명시 (line 405-407 주석).
    - `MentionCluster` (cluster_id / mention_slugs / source_count / mention_count).
  - **함수 5 export**:
    - `clusterMentionsAcrossSources(history, embeddings)` (line 91-162): page-level alpha agglomerative clustering. cosine similarity ≥ `COSINE_THRESHOLD` (0.75 const). 알고리즘: 각 slug 가 자기 cluster 시작 → cosine ≥ 0.75 pair merge → 더 이상 merge 없을 때까지 반복. **post-impl Cycle #3 F4 fix** (line 142-161): `flatMap` 으로 singleton (mention_slugs.length < 2) cluster drop — empty embeddings 시 모든 cluster singleton → 빈 배열 → graceful skip. 이전엔 singleton 도 emit → source_count >= 2 면 union arbitration_confidence=1.0 으로 false output 생성.
    - `arbitrate(cluster, method, tokenBudget, llmCaller?)` (line 165-260): default `'union'` (LLM 호출 0, arbitration_confidence=1.0, converged_components = mention_slugs map → StandardDecompositionComponent type 'methodology' default). `'llm'` opt-in: prompt 통합 plan §3.4.2 line 839-870 형식 → JSON parse → arbitration_confidence (LLM self-report) + arbitration_log (reasoning).
    - `createConvergencePass(args)` (line 271-311): CLI args parse → ConvergencePassConfig (history / qmdDb / output / arbitration / tokenBudget / **embeddings?**). post-impl Cycle #2 F4 fix: `--embeddings <path>` optional 인자 추가 (alpha v1 wire — 외부 도구 inject).
    - `mergeAllSources(baseOverride, runtimeSelfDeclarations)` (line 320-340): 우선순위 chain 1~6 (user-yaml > suggested > self-declared > converged > runtime > BUILTIN). 1~4 는 schema.yaml append 되어 baseOverride 통합. 6 만 별도 inject — Stage 3 mergeRuntimeIntoOverride 재사용 (delegation only, Karpathy §2 Simplicity).
    - `runConvergencePass(history, options)` (line 360-410): precondition 검증 (≥ 3 표준 × 2 source = 6 instance, 통합 plan §3.4.4 line 940). 미달 시 `[]` + warn ("insufficient mention diversity for convergence: N standards × M sources, threshold 3 × 2"). 충족 시 cluster + arbitrate.
- **`wikey-core/scripts/run-convergence-pass.mjs`** (신규, ~95 lines):
  - Node.js entry point. args parse → mention-history JSON load (post-impl Cycle #2 F4 fix: `{ version, ingests: [...] }` schema 처리 + legacy bare array backward compat) → `--embeddings` JSON load (post-impl Cycle #2 F4 fix: 외부 도구 dump 한 `{ "<slug>": [vec...], ... }` → Map<slug, vec> inject. load 실패/미지정 시 빈 Map → graceful skip + warn).
  - `runConvergencePass` 호출 + 결과 atomic write (`tmp + rename` 패턴) → `.wikey/converged-decompositions.json`.
- **`scripts/reindex.sh`** cmd_reindex 끝 직전 conditional hook block (+15 line):
  - `WIKEY_CONVERGENCE_ENABLED=true` 일 때만 trigger (default off).
  - `dist/scripts/run-convergence-pass.mjs` 부재 시 `log_skip` graceful, 실패 시 `log_err` 후 계속 진행.
  - `WIKEY_CONVERGENCE_EMBEDDINGS` env → `--embeddings` 자동 forward (alpha v1).
- **`wikey-core/package.json`** build script 갱신: `cpSync('scripts','dist/scripts')` 추가 (mjs 산출물 보장).

**테스트 (`__tests__/convergence.test.ts` +319 lines, 10 cases)**:
- AC15 ConvergedDecomposition shape: 1 case (필드 존재 + JSON round-trip)
- AC16 clusterMentionsAcrossSources: 2 cases (정상 cluster cosine ≥ 0.75 / post-impl Cycle #3 F4 fix 후 singleton drop)
- AC17 arbitrate: 2 cases (Happy union arbitration_confidence=1.0 / Happy llm mock JSON 0.8)
- AC18 createConvergencePass: 2 cases (defaults / `--embeddings` optional)
- AC19 mergeAllSources: 2 cases (baseOverride + runtime inject / 같은 umbrella_slug 충돌 baseOverride 우선)
- AC20 runConvergencePass: 3 cases (precondition 미달 빈 배열 + warn / 충족 시 union output / empty embeddings 시 빈 결과 — post-impl Cycle #3 F4 graceful skip)

**의사결정 근거**:
- COSINE_THRESHOLD 0.75: jina-v3 / Qwen3-Embedding 표준 의미 유사도 cluster 임계 (Anthropic Contextual Retrieval 가이드).
- arbitration_method 'union' default: LLM 호출 0 → 비용 0. 'llm' opt-in 시만 LLM. mention slug 별 cluster 가 같은 표준의 다른 측면임을 검증할 때만 필요.
- arbitration_confidence ≥ 0.7 modal trigger (line 909): false convergence 차단 (alpha 단계).
- mention-history precondition ≥ 6 instance: cluster 형성 의미 있게 하려면 표준 ≥ 3 × source ≥ 2 = 6 최소 (Stage 1 v7 §4.3 와 일관).
- alpha v1 wire (post-impl Cycle #2 F4 fix): qmd 직접 통합 (sqlite-vec extension load) 은 v2 → 외부 도구 (qmd vsearch / sqlite3 / Python helper / qmd MCP) JSON dump inject 인터페이스 만 제공.

**end-to-end smoke** (commit 87969fa):
- `node dist/scripts/run-convergence-pass.mjs --history empty.json ...` → "insufficient mention diversity" warn + exit 0 (precondition 미달 graceful skip 확증).
- 단위 회귀: 711 → **721 PASS** (+10).  build 0 errors.

### 5.4.5 통합 시나리오 integration test + post-impl review + AC21 라이브 + follow-up 4

#### 5.4.5.1 통합 시나리오 integration test (commit bdc0773, 2026-04-26 14:58, +7 cases)

**Plan**: 통합 plan §4 (line 985-1170) 5 시나리오.

**테스트 (`wikey-core/src/__tests__/stage-integration.test.ts` +433 lines, 7 cases)** — mock fs + mock LLM (in-memory canonicalize):
- **Scenario 4.1 Fresh ingest** (2 cases): 시점 0 (PMBOK 1 corpus, schema.yaml 미존재) → BUILTIN PMBOK 만 / 시점 1 (ISO 27001 추가) → SelfDeclaration runtime + BUILTIN + runtime ISO append.
- **Scenario 4.2 Incremental** (1 case): mention-history 임계 충족 → suggestion 생성 → appendStandardDecomposition → 다음 ingest 의 loadSchemaOverride 가 user yaml 인식.
- **Scenario 4.3 사용자 vault 수동 편집** (1 case): `standard_decompositions: []` → empty-explicit kind → buildStandardDecompositionBlock 빈 string + mergeRuntimeIntoOverride runtime 무시 (사용자 명시 disable 보존).
- **Scenario 4.4 Stage 간 fallback** (2 cases): runConvergencePass mention-history < 6 instance → 빈 배열 + warn graceful / reindex.sh hook env unset → skip.
- **Scenario 4.5 사용자 거부** (1 case): rejectSuggestion → negativeCache 등록 → isInNegativeCache silent drop / shouldStage3ProposeRuntime false.

**RED sanity check** (Karpathy #4 Goal-Driven 증거): Scenario 4.1 (e) 의 `expect(block).toContain('PMBOK')` 를 `'NONEXISTENT-MARKER'` inversion → 1 fail 정확히 catch → 즉시 revert. assertion 빈 통과 아님 확증.

**검증**: 721 → **728 PASS** (+7). build 0 errors.

#### 5.4.5.2 post-impl review codex 6 cycle (commits 31f3e28 → dc1ee9a, 2026-04-26 15:04~15:31)

cmux Panel Mode D (codex `gpt-5.5 xhigh`) 6 fresh-pick + close-after-cycle (rules.md §11.2). master 가 finding 별 동의/이견 판단 후 fix.

**Cycle #1 NEEDS_REVISION** (4 finding: CRITICAL 1 + HIGH 2 + MEDIUM 1) — capture window 1500:
- F1 HIGH Stage 2 round-trip violation: `suggestion-detector.ts:169` `umbrella_slug: \`*${suffix}\`` 가 schema.ts:435 parser regex `/^[a-z][a-z0-9-]*$/` 와 불일치 → accepted suggestion → schema.yaml append 후 다음 ingest 시 parser reject → suggestion 무용지물. **master fix** (commit 31f3e28): `cluster-${suffixBase}` 형식 + schema-yaml-writer 의 `appendStandardDecomposition` 진입에 round-trip validation 추가 (umbrella_slug + components.slug 검증, `'invalid-slug'` reason 추가, AppendResult.reason 3 → 4 union).
- F2 HIGH UI Suggestions panel unreachable: `wikey-obsidian/src/sidebar-chat.ts:144` PanelName 'suggestions' 정의되어 있으나 `selectPanel('suggestions')` 호출 button 부재 → 사용자 액세스 불가 (AC6 user approval gate 사실상 비활성). **master fix**: line 144 `Suggestions` button 추가 (`makeHeaderBtn(actions, ICONS.question, 'Suggestions', () => this.selectPanel('suggestions'))`).
- F3 (CRITICAL implicit) Stage 3 ingest-pipeline wiring 누락: developer 가 Stage 3 module 만 작성, ingest 흐름에 hook 안 됨 → Stage 3 코드가 deadcode 위험. **master fix**: `ingest-pipeline.ts:496-540` 에 sectionIndex.sections 의 'standard-overview' headingPattern section 마다 extractSelfDeclaration → mergeRuntimeIntoOverride → effectiveOverride. canonicalize 호출 site 2곳 (FULL line 544 + SEGMENTED line 604) 의 schemaOverride 인자 → effectiveOverride. `ingest-pipeline.ts` +90 lines.
- F4 CRITICAL Stage 4 qmd vector stub: run-convergence-pass.mjs 가 항상 `new Map()` empty embeddings → cluster 0 → real execution 시 무의미. **master 이견**: alpha 단계 명시 잔존 (plan §3.4.2 line 833 "alpha / page-level-limited"). real qmd 통합은 v2 deferral (mention-level granularity v2). 본 v1 plan 안에서 stub 유지 + plan §8.6 변경 이력에 명시.
- F5 MEDIUM AC21 fixture/live smoke absence: plan v5 가 fixture corpus 6 자료 + live cycle smoke gate 명시. **master 이견**: 사용자 영구 결정 (vault 변경 위험 + 별 세션 진행). plan §5.4.5 deferred 명확화 + agent-management.md §6 갱신 (라이브 1차 책임 = master).
- 신규 case: `schema-yaml-writer.test.ts` invalid-slug round-trip safety 1 (728 → 729 PASS).

**Cycle #2 NEEDS_REVISION** (CRITICAL F4 lingering + MEDIUM F2 lingering) — 2 finding:
- F4 lingering: master 의 "alpha 단계 명시" 만으로는 wire 미흡. codex 가 alpha 명시 reject. **master 동의 + fix** (commit c564cd3): `convergence.ts:271-311` `ConvergencePassConfig.embeddings?` optional 추가 + `createConvergencePass` 가 `--embeddings <path>` parse. `run-convergence-pass.mjs:43-82` JSON load + Map<slug, vec> inject. load 실패/미지정 시 graceful skip + warn. `scripts/reindex.sh:212-228` `WIKEY_CONVERGENCE_EMBEDDINGS` env → `--embeddings` 자동 forward. plan §3.4.3 alpha v1 wire 명시 강화 (외부 도구 후보 4종: qmd vsearch / sqlite3 CLI / Python helper / qmd MCP server).
- F2 lingering: `sidebar-chat.ts:653` acceptBtn handler 가 `appendStandardDecomposition` 의 `appended: false` 결과 무시하고 무조건 state transition → schema 미기록 항목이 panel 에서 lost. **master fix** (commit c564cd3): `appended: false` 면 state 전환 안 함 + 카드 보존 + reason 별 사용자 알림 (`invalid-slug` / `header-unsafe` / `already-exists` 별 친절 안내) + return early. 사용자 fix 후 재시도 가능.
- 신규 case: AC18 `--embeddings` optional 1 (729 → 730 PASS).

**Cycle #3 NEEDS_REVISION** (HIGH F4 singleton + LOW stale) — codex 가 직접 실행으로 confirm:
- F4 singleton: codex 가 `node --input-type=module ...` 으로 empty embeddings + 3 slugs × 2 sources → 3 singleton ConvergedDecomposition 생성 confirm. `clusterMentionsAcrossSources` 가 singleton (mention_slugs.length < 2) 도 emit → source_count >= 2 면 union arbitration_confidence=1.0 으로 false output. **master 동의 + fix** (commit 0296cc7): `convergence.ts:142-161` flatMap 으로 singleton drop. empty embeddings → 모든 cluster singleton → 빈 배열 → graceful skip.
- LOW stale: plan §3.4.3 pseudocode + convergence.ts:81-83 주석 의 `QmdIndexClient` (v0 표현) 잔존. **master fix**: alpha v1 외부 JSON inject 흐름 + singleton drop 명시로 갱신.
- AC16 test 갱신 (cosine < 0.75 → 0 cluster expected) + AC20 신규 case 1 (empty embeddings + threshold-satisfied → 빈 결과). 730 → **731 PASS**.

**Cycle #4 REJECT** (LOW §3.4.2 stale) — finding 1건만이지만 verdict REJECT. master 결정: LOW fix 적용 후 cycle #5.
- plan §3.4.2 line 815-818 의 `clusterMentionsAcrossSources(history, qmdIndex: QmdIndexClient)` 잔존 (Cycle #3 fix 가 §3.4.3 만 갱신). **master fix** (commit 9d15ba5): `(history, embeddings: ReadonlyMap<string, readonly number[]>)` + singleton drop 명시.

**Cycle #5 REJECT** (LOW §4.1 fresh ingest stale):
- plan §4.1 line 1089 fresh ingest flow 시퀀스 다이어그램 안 `clusterMentionsAcrossSources(history, qmdIndex)` 잔존. **master fix** (commit d8f1c78): `(history, embeddings)` + singleton drop + `--embeddings <json>` 외부 inject 명시.

**Cycle #6 APPROVE** (Findings: None / regression PASS):
- 모든 stale + alpha v1 wire + singleton drop guard 일관. master 1차 검증 (grep) 결과: 활성 plan/code 안 `qmdIndex|QmdIndexClient` 0 건 (잔존 2 건은 §8.8/§8.9 history row only).
- §5.4 코드 부분 종료 선언 (commit dc1ee9a): plan/phase-5-todo.md §5.4.5 의 6 cycle 결과 + `[x] §5.4 코드 부분 종료` 표기.

#### 5.4.5.3 AC21 라이브 cycle smoke (commit eb4b697, 2026-04-26 16:30~17:50)

**책임**: master 직접 (agent-management.md §6 갱신 — 라이브 1차 책임 = master, tester 는 코드/시뮬레이션 only).

**환경 확인**:
- Obsidian PID 63510 + CDP 9222 endpoint UP (Browser Chrome/142.0.7444.265, Protocol 1.3)
- wikey-cdp.py 재작성 (`/tmp/wikey-cdp.py` reboot 으로 사라져서 master 직접 작성, ~80 lines, websocket-client + Runtime.evaluate)
- plugin reload (`app.plugins.disablePlugin('wikey'); enablePlugin('wikey')`) 정상

**fixture corpus 6 자료** (사용자 명령 옵션 B — 자연 ingest 흐름, master 작성, well-known 표준 구조 hallucination 없음):
- `raw/0_inbox/integration-cycle-smoke/pmbok-overview.md` — PMBOK 7판 + 10 knowledge areas (project-{integration, scope, schedule, ...}-management)
- `raw/0_inbox/integration-cycle-smoke/pmbok-knowledge-areas.md` — 같은 10 areas detail (cross-source ≥ 2 충족용)
- `raw/0_inbox/integration-cycle-smoke/iso-27001-overview.md` — ISO/IEC 27001:2022 / 4 도메인 (organizational/people/physical/technological)
- `raw/0_inbox/integration-cycle-smoke/iso-27001-annex-a-detail.md` — Annex A 93 controls
- `raw/0_inbox/integration-cycle-smoke/itil-4-overview.md` — ITIL 4 / 4 dimensions + 7 guiding principles + Service Value Chain
- `raw/0_inbox/integration-cycle-smoke/itil-4-practices.md` — ITIL 4 / 14 practices

각 자료 `## 개요` (한국어) 또는 `## Overview` 헤더 + numbered/bullet list ≥ 5 items 포함 → Stage 3 self-declaration extractor trigger 가능.

**6 file ingest cycle smoke**:
| # | file | Brief click | Preview ready | Approve | wiki write |
|---|------|-------------|---------------|---------|-----------|
| 1 | pmbok-overview | Proceed | 90s | OK | wiki/concepts/project-* (10) + entities/PMI |
| 2 | pmbok-knowledge-areas | Proceed | 90s | OK | concepts append |
| 3 | iso-27001-overview | Proceed (master 직접 click — background loop sleep 6 timing fail) | 60s | OK | concepts (iso-27001-organizational-controls 등) + sources |
| 4 | iso-27001-annex-a-detail | Brief 등장 X (PROCESSING 직행 — race) | 600s timeout | (state-machine driver fallback) | concepts append |
| 5 | itil-4-overview | Proceed | 120s | OK | concepts (itil-4-* 등) + sources |
| 6 | itil-4-practices | state-machine 5s 만 (PREVIEW 즉시 detect) | 5s | OK | concepts append |

**총 6/6 file ingest 완료**, mention-history.json 누적 6 ingests, 43 신규 wiki/concepts pages.

**발견 bug**:
1. **CRITICAL `suggestion-pipeline.ts:91`** Stage 2 detector slug `.md` 확장자 포함: wiki page filename (`itil-4.md`, `service-level-agreement.md`) 의 `.md` 가 suffix matching `-management` 와 매치 fail → 0 suggestions. **master fix**: `stripMdExt(s)` helper 추가 + `ingestRecordFromCanon` concepts/entities slug 모두 strip. mention-history 의 기존 6 ingests slug 도 Python script 로 strip + node 직접 detector 재실행 → **1 suggestion (`cluster-management`, conf=0.66, support=2, mention=20)** 검출. 공식 정확히 일치: `0.4 * min(2/5,1) + 0.3 * 1.0 + 0.2 * min(20/20,1) + 0.1 * 0 (BUILTIN PMBOK overlap → drop) = 0.16 + 0.30 + 0.20 + 0.00 = 0.66`.
2. **UX 옵션 B** Ingest panel 폴더 자체 표시 (사용자 영구 결정): `sidebar-chat.ts:1856` `listInboxFilesRaw()` `readdirSync(inboxDir)` top-level only → 폴더 entry + checkbox 등장 (의미 X). **master fix**: 재귀 walk + `-type f` 평탄화 + 폴더 자체 list 제외 + name 컬럼 basename + path line classify hint 만 (subfolder 정보 숨김).
3. **F2 fix UI 등장**: plugin reload 후 Suggestions header button 정상 노출 (post-impl Cycle #1 F2 라이브 검증 통과).

**Suggestions panel UI 검증**:
- Click → "🔔 표준 분해 후보" panel + 1 card "cluster-management 패턴 감지" 표시
- Card 본문: confidence 0.66 + 10 components (project-* PMBOK areas)
- Accept button click → suggestions.json `state.kind: pending → accepted` + schema.yaml 신규 entry append (round-trip safety 검증):
  ```yaml
  standard_decompositions:
    - name: cluster-management
      umbrella_slug: cluster-management
      rule: decompose
      require_explicit_mention: true
      origin: suggested
      confidence: 0.66
      components: [10 entries]
  ```

**검증**: 731 PASS / build 0 errors. 보조 문서: [`activity/phase-5-resultx-5.4-integration-cycle-smoke-2026-04-26.md`](./phase-5-resultx-5.4-integration-cycle-smoke-2026-04-26.md) (전체 detail + Stage 3 inspect + Stage 4 alpha v1 wire 검증).

#### 5.4.5.4 follow-up 4 항목 (commits 308bc72 + da42cef, 2026-04-26 18:00~18:30)

**§3.5 항목 1 — Stage 3 SelfDeclaration runtime extraction inspect**:
- 의도: ingest-pipeline wiring 만 검증된 상태 → 실 ingest 시 SelfDeclaration runtime 적용 evidence 확보.
- fixture: `raw/0_inbox/test-stage3-cobit.md` (master 작성 — COBIT 2019 5 도메인 + 표준 개요 section + numbered list 5 items).
- ingest 50s preview + Approve & Write. console log: `[Wikey ingest] schema override — entities=0, concepts=0` + `[Wikey ingest] stage3 self-declarations — 1 runtime entries`.
- wiki/concepts 5 신규: cobit-2019 (umbrella) + cobit-{evaluate-direct-monitor, align-plan-organize, build-acquire-implement, monitor-evaluate-assess} (cobit-deliver-service-support 만 LLM 추출 누락 — 본 issue 별 영역).
- autoMove 정상: raw/0_inbox/test-stage3-cobit.md → raw/3_resources/.

**§3.6 항목 3 — Suggestions detector umbrella default UX**:
- 의도: `cluster-${suffix}` default 가 의미 약함. components 의 first word (- 전) 가 모두 동일하면 prefix 사용.
- fix (`suggestion-detector.ts:170-178`): firstWords 추출 + allFirstSame 검사 → prefix = firstWords[0] 또는 fallback 'cluster'. PMBOK 만 ingest → firstWords = ['project']*N → prefix 'project' → umbrella_slug `'project-management'` (의미있는 default). mixed (PMBOK + ITIL) → fallback 'cluster' (사용자 Edit modal 권장).
- 신규 test 1 case + 기존 test 갱신 (ISO-27001 firstWord 'iso' → 'iso-management'). 731 → **732 PASS**.

**§3.7 항목 4 — classify-inbox.sh subfolder 평탄화**:
- 의도: `find -maxdepth 1` 라 폴더 안 file 미인식 → 사용자 영구 결정 옵션 B 와 일관.
- fix (`scripts/classify-inbox.sh:42`): `-type f` 재귀 평탄화 + hidden 제외. dry-run 정상.
- 자료 분류 race 1 case: itil-4-practices 가 inbox 잔존 → 시간 지나며 self-resolve (autoMove 자동 trigger), reproduce 못함. follow-up X (단발적).

**§3.8 항목 2 — Stage 4 라이브 alpha v1 wire 검증**:
- 의도: mock embeddings (sqlite-vec extension load macOS Python 제한, 실 qmd 통합은 v2 deferral) 로 alpha v1 wire 정상 동작 검증.
- mock embeddings 생성: 59 slug × group axis 1.0 (1024-dim, project/iso/itil/cobit/other axis). `/tmp/mock-embeddings.json`.
- mjs schema bug fix (`run-convergence-pass.mjs:43-58`): mention-history `{ version, ingests: [...] }` schema 처리 추가 (이전엔 bare array 만 expect).
- run-convergence-pass.mjs 실행: `loaded 59 embeddings` + `wrote 4 ConvergedDecomposition(s)`:
  | umbrella | components | sources | method | conf |
  |---|---|---|---|---|
  | project-management-body-of-knowledge | 12 | 2 | union | 1.0 |
  | work-breakdown-structure | 28 | 7 | union | 1.0 |
  | iso-iec-27001-2022 | 5 | 3 | union | 1.0 |
  | itil-4 | 9 | 2 | union | 1.0 |
- alpha v1 wire 정상 동작 확증. v2 통합 path 3 후보 (Python sqlite-vec / Node.js sqlite-vec wrapper / qmd CLI subprocess) 다음 세션 진입점.

### 5.4.6 종결 회귀 + commits 통계

- baseline: 670 → **732 PASS / 38 files / 0 fail**
- build: wikey-core 0 errors / wikey-obsidian 0 errors
- 신규 cases 합계: 62 (Stage 2 20 + Stage 3 21 + Stage 4 10 + integration 7 + Cycle 후속 4)
- Total commits push (15 commits): 9b7da21 → e749515 (16번째 sync commit 15ff6ff 포함)
- 보조 문서: [`activity/phase-5-resultx-5.4-integration-cycle-smoke-2026-04-26.md`](./phase-5-resultx-5.4-integration-cycle-smoke-2026-04-26.md)

### 5.4.7 v2 deferral (다음 세션 진입점, 사용자 영구 결정 2026-04-26)

| 우선순위 | 항목 | 가치 |
|---|---|---|
| **1** | Stage 4 실 qmd embeddings 통합 | 다국어 / synonym 자동 통합 인식 (mock 만으로 미검증된 핵심) |
| **2** | Suggestions panel UI 개선 | 카드 디자인 / Edit modal / 정렬 / 필터 / negativeCache view (ui-designer/gemini-panel 권장) |
| 3 | ConvergedDecomposition review modal | Stage 2 패턴 재사용 |
| 4 | §5.4 minor follow-up | 자료 분류 race / Edit modal 검증 |

**기록 책임**: 실행 로드맵 단일 소스 = `plan/phase-5-todo.md §5.4`. 철학 선언 = `wiki/analyses/self-extending-wiki.md`. 보조 활동 기록 = `activity/phase-5-resultx-5.4-integration-cycle-smoke-2026-04-26.md`. memory + session-wrap-followups 는 포인터만.

### 5.4.8 1순위 종결 — Stage 4 실 qmd embeddings 통합 (2026-04-26 session 14)
> tag: #convergence, #embedding, #stage-4

> **mini plan**: `plan/phase-5-todox-5.4-integration.md §10` (master 직접 작성, analyst 위임 생략). **회귀 영향**: 0 (script + 산출 JSON 만, 회귀 코드 변경 없음). **732 PASS 유지**.

**채택 path**:
- ❌ Python sqlite-vec — macOS system Python 의 sqlite3 binding 이 SQLITE_OMIT_LOAD_EXTENSION build 로 `enable_load_extension` 미지원
- ❌ qmd CLI subprocess — raw vector dump 명령 부재
- ✅ **Node.js + better-sqlite3 + sqlite-vec** — 별도 `scripts/qmd-export-deps/` (40 packages, prebuilt binary, Node v22 ABI 호환). wikey-core zero-deps 정책 + tools/qmd Bun ABI 모두 회피.

**산출**:
- `scripts/qmd-embeddings-export.mjs` — read-only SELECT (qmd CLAUDE.md "DB 직접 수정 금지" 준수), Float32 BLOB 디코딩, chunk 평균, dim sanity check, missing slug warn skip
- `scripts/qmd-export-deps/` — minimal package.json (better-sqlite3 12.8.0 / sqlite-vec 0.1.9)
- `.wikey/qmd-embeddings.json` (1.4 MB) — **59 / 59 slug × 1024-dim 추출** (0 missing / 0 no-vector / 0 dim-mismatch)
- `.wikey/converged-decompositions.json` 갱신 — 실 embeddings 기반 ConvergedDecomposition 2건 (mock baseline 4 와 다른 cluster 결과)
- `.wikey/converged-decompositions.mock-baseline.json` 보관 — 비교용 mock 결과

**의미 보존 spot-check** (cosine similarity, 직접 계산):

| 분류 | 페어 | cosine | 판정 |
|---|---|---|---|
| **PMBOK 10 areas 내부** (같은 표준) | project-integration-management ↔ project-schedule-management | 0.6576 | ✅ 도메인 결합 |
| | project-scope-management ↔ project-cost-management | 0.6108 | ✅ |
| | (4 areas 6 페어 평균) | ~0.63 | ✅ |
| **COBIT 도메인 내부** (같은 표준) | cobit-evaluate-direct-monitor ↔ cobit-monitor-evaluate-assess | **0.9128** | ✅ 의미 강결합 |
| | cobit-2019 ↔ cobit-monitor-evaluate-assess | 0.6303 | ✅ |
| **CIA triad** (의미 강결합) | availability ↔ confidentiality | 0.6324 | ✅ |
| **보안 vs PM** (다른 도메인) | confidentiality ↔ project-cost-management | 0.1950 | ✅ 무관 (낮음) |
| | iso-iec-27001-2022 ↔ work-breakdown-structure | 0.2077 | ✅ |
| | access-control ↔ project-schedule-management | 0.3552 | ✅ |
| **무관 페어** | access-control ↔ work-breakdown-structure | 0.2807 | ✅ |
| | availability ↔ project-schedule-management | 0.3487 | ✅ |

⇒ **도메인 내부 (0.59~0.91) ≫ 도메인 간 (0.20~0.36)**. 의미 보존 확증. (한/영 페어 spot check 는 wiki 에 한국어 slug 자체가 없어 미수행 — 다국어 cluster 검증은 실 한국어 자료 ingest 후 별 cycle.)

**ConvergedDecomposition 실 cluster 결과 — 의미 보존 확증** (2026-04-26 session 14 추가 검증):

이전 § 본문에서 "alpha v1 wire 한계 — components / sources 가 0" 으로 기록했으나, 이는 spot-check Python script 의 잘못된 field 명 접근 (`components`/`sources` vs 실제 `converged_components`/`source_mentions`) 로 인한 false negative. 정정.

| umbrella_slug | converged_components (실 cluster) | source_mentions | arbitration |
|---|---|---|---|
| **iso-iec-27001-2022** | 4건: `iso-iec-27001-2022`, `iso-iec-27001`, `isms-certification`, `iso-27001` (같은 표준의 연도/약어/별칭 변형) | 3 sources: `iso-27001-overview.md`, `iso-27001-annex-a-detail.md`, `itil-4-practices.md` | union, confidence 1.0 |
| **itil-4** | 2건: `itil-4`, `itil-v3` (ITIL 버전 변형) | 2 sources: `itil-4-overview.md`, `itil-4-practices.md` | union, confidence 1.0 |

⇒ alpha v1 wire **정상 작동**. ConvergedDecomposition 이 mention graph + cosine cluster + arbitration 를 거쳐 실제로 같은 표준의 다른 표기를 통합. ISO 27001 cluster 의 `iso-iec-27001-2022` ↔ `iso-27001` 통합이 정확히 사용자가 의도한 "다른 표현 자동 통합 인식" 의 alpha 단계 결실.

**검증 합계**:
- ✅ script 실행 시 59 / 59 slug embedding 추출 (`extracted: 59 / 59`)
- ✅ convergence-pass 실 embeddings inject 작동 (`loaded 59 embeddings → wrote 2 ConvergedDecomposition(s)`)
- ✅ cluster 의미 spot-check — 도메인 내부 ≫ 도메인 간 (cosine 차이 ≥ 0.3)
- ✅ ConvergedDecomposition.converged_components / source_mentions 모두 채워진 의미 cluster — alpha v1 wire 정상 (이전 false negative 정정)
- ✅ 회귀 baseline 732 PASS 유지 (38 files / 0 fail)
- ⚠️ 한/영 cluster cosine ≥ 0.85 검증은 wiki 한국어 slug 부재로 보류 — `plan/phase-5-todo.md §5.4.7` 후속 follow-up

### 5.4.9 2/3/4순위 통합 종결 — Suggestions panel UI 개선 (2026-04-26 session 14)
> tag: #ui, #suggestion, #stage-2, #stage-4

> **mini plan**: `plan/phase-5-todox-5.4-integration.md §11`. 사용자 영구 결정 (2026-04-26 session 14): "2/3/4순위 동시 진행. 위임 없이 master 직접". UI 변경 단일 file (sidebar-chat.ts) + 1 type export 추가 (wikey-core index.ts) + CSS append. **회귀 코드 0 변경 → 732 PASS 유지**.

**사용자 UI spec (2026-04-26 직접 명시)**:
1. 아이콘: clipboard_check (Bootstrap, 신규 ICONS 추가)
2. title: guide 패널 형식 (`## Wikey Suggestions` 마크다운 렌더)
3. 패턴 후보 목록: audit 패널 그리드 동일 — Select All checkbox + 멀티 row + 상단 패턴명 + 하단 출처
4. 버튼 (하단 고정): Accept (멀티) / Reject (멀티) / Add (in-line edit) / Edit (mode → row → in-line)
5. LLM 모델명: audit 패널 최하단 default ai model 출력 형식 (provider+model select)

**구현 (single file sidebar-chat.ts + 1 export 추가)**:
- ICONS.clipboardCheck 추가 (Bootstrap SVG)
- header button icon = clipboardCheck (기존 question 대체)
- `SuggestionsPanelRow` discriminated union (3-kind: `suggestion` / `converged` / `user-added`) — Stage 2 Suggestion + Stage 4 ConvergedDecomposition + user Add 통합 표시
- `rowToSuggestionShape` helper — ConvergedDecomposition + user-added 를 Suggestion shape 으로 wrap → `appendStandardDecomposition` writer 재사용 (회귀 0)
- `loadConvergedStoreFromVault` / `saveConvergedStoreToVault` 신규 helper — `.wikey/converged-decompositions.json` read-only load + Reject/Accept 후 persist write
- `openSuggestionsPanel()` 전면 재구현 — audit 그리드 패턴 (Select All + 멀티 row + 하단 고정 버튼 + provider/model bar)
- Accept (multi): 선택 row 모두 → `appendStandardDecomposition(wikiFS, suggestion)` 재사용 → Stage 2 = SuggestionStore.state=accepted / Stage 4 = converged store 제거 / user-added = in-memory 제거. 실패 시 reason hint Notice
- Reject (multi): Stage 2 = `rejectSuggestionFromPanel` (negativeCache) / Stage 4 = converged store 제거 / user-added = in-memory 제거
- Add: 빈 user-added row 상단 insert + editMode 자동 활성화 + 선택 → input 두 줄 (umbrella_slug + umbrella_name) → Enter Save
- Edit: editMode 토글 → row 선택 → inline input 표시 → Enter Save → 기존 row 를 user-added shape 으로 대체 (semantics: "이 행 기반으로 사용자 정의 변형 등록")
- CSS: audit row pattern 재사용 + suggestion 전용 변형 (source badge wiki/user/origin 색상, edit input, edit mode active button, disabled apply button) — `wikey-obsidian/styles.css` append

**type export 추가** (wikey-core/src/index.ts):
- `StandardDecompositionComponent`, `StandardDecomposition` re-export — UI 에서 row.components 타입 사용

**4순위 처리** (사용자 지적 후 정정):
- (a) Edit modal 검증 → 본 §11 의 inline edit 동작으로 자연 통합 (별 modal 없이 row inline input 채택, Karpathy #2 Simplicity First)
- (b) 자료 자동 분류 race condition → self-resolve, scope 외 (재발 시 별 cycle)
- (c) "alpha v1 wire 한계 — components/sources 채움" → **사실 한계 아님**. 1순위 spot-check Python script field 명 오류 (false negative). 실 데이터 정상 채워짐 (iso-iec-27001-2022 cluster 4 components / 3 sources, itil-4 cluster 2 components / 2 sources). §5.4.8 본문 정정 반영.

**검증 합계**:
- ✅ wikey-core build 0 errors
- ✅ wikey-obsidian build 0 errors (1 기존 warning — pii-patterns.js cjs/import.meta, §5.3 부터 알려진 항목)
- ✅ 회귀 baseline 732 PASS 유지 (38 files / 0 fail) — UI 변경 + 1 type re-export, 회귀 코드 0 변경
- ⚠️ 라이브 UI cycle smoke (Obsidian CDP) — 본 활동 기록 시점 사용자 vault 에서 실 ingest 결과 (ConvergedDecomposition 2건) 와 함께 master 직접 검증 권장

**Out of scope (후속)** — `plan/phase-5-todox-5.4-integration.md §11.8`:
- Stage 3 SelfDeclaration 'origin' source persist 통합 (현재 runtime-only, store 신규 추가 필요)
- 정렬 / 필터 / negativeCache view (MVP 후 확장)
- ConvergedDecomposition arbitration_method 'llm' (현 'union' default 충분)

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
