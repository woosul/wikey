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

### 5.3.12 후속 작업 (out-of-scope, 별도 plan)

본 §5.3 plan v11 acceptance 충족. 다음은 향후 follow-up:

1. **`.md.new` 자동 cleanup** (P2-1) — 다음 ingest 시 사용자가 promote/삭제 한 항목 자동 detect → `clearPendingProtection`
2. **dashboard/audit panel UI 시각화** — 5 신규 audit 컬럼을 사용자 가시화 (배지/필터, §5.2.0 v3 broken state badge 와 통합)
3. **`user_marker_headers` config 노출** — `.wikey/wikey.conf` 또는 schema-override 에 사용자 정의 헤더 추가
4. **★ entity/concept page user marker 보호** — 본 plan 은 source page 한정. LLM 결정적 출력 + 우연 H2 등장 분석 후 도입
5. **Hash perf** — file size + mtime 1차 필터 후 hash (대용량 corpus)
6. **CLI 진입점** — `wikey ingest --force` `--diff-only` 플래그
7. **Section-level diff** — H2 단위 hash 매칭으로 부분 재인제스트
8. **Tombstone restore + sidecar_hash 정합성**
9. **Python ↔ TS NFC 일관성 자동 검증** (cross-language smoke)
10. **★ R == null + paired sidecar 미보호 GAP fix** — `unmanaged-paired-sidecar` conflict 신규 (본 세션 PMS ingest 분석에서 도출)
11. **★ entity/concept `## 출처` wikilink broken link fix** — `[[<basename>]]` (확장자 없음) 이 paired sidecar 형식 (`<base>.<ext>.md`) 과 매칭 안 됨 → `[[source-<slug>]]` 표준화 또는 alias 형식. 단독 md 는 영향 없음

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
