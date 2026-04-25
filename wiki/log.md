---
title: 활동 로그
type: log
created: 2026-04-10
updated: 2026-04-25
---

## [2026-04-25] phase-5 | §5.3 hash 기반 증분 재인제스트 + sidecar/wiki 사용자 수정 보호 (plan v11 6-step TDD 종결)

- **§5.3.1 + §5.3.2 결합 종결** — `plan/phase-5-todox-5.3.1-incremental-reingest.md` v11 (codex Mode D APPROVE_WITH_CHANGES, 11 cycle 수렴 P1 0건). 6-step TDD 모두 GREEN.
- **Step 1 source-registry**: 5 신규 optional 필드 (`sidecar_hash` / `reingested_at` / `last_action` / `pending_protections` / `duplicate_locations`) + 4 helper (`appendPendingProtection` / `clearPendingProtection` / `appendDuplicateLocation` / `recordMoveWithSidecar` discriminated option) + reconcile() duplicate-aware (Map<hash, paths[]>). 11 신규 test PASS.
- **Step 2 incremental-reingest** (신규 290 lines): `decideReingest` 단일 helper (5 action `skip`/`skip-with-seed`/`force`/`protect`/`prompt`) + raw bytes invariant + Phase A conflicts collect-then-decide + USER_MARKER_HEADERS / extractUserMarkers 멱등 / mergeUserMarkers / protectSidecarTargetPath (.1~.9 + .10 throw) / computeSidecarHash NFC. 24 신규 test PASS.
- **Step 3 ingest-pipeline 통합**: Step 0 (rawDiskBytes) + Step 0.5 (decideReingest) + Step 0.6 분기 (skip → SkippedIngestResult, skip-with-seed → registry seed, force/protect → 본 흐름) + Hook 1 (sidecar `.md.new` protect, P1-2 단일 규칙) + Hook 2 (source page user marker preserve, P1-5 source 한정) + Hook 3 (registry merge with isCanonicalSidecarWritten 조건, P1-2 + v9/v10/v11 정정) + buildV3SourceMeta(rawDiskBytes, preservedSourceId?) + IngestResult / SkippedIngestResult union. 5 신규 integration test (skip 분기 testable subset) PASS.
- **Step 4 movePair**: sidecar pre-resolve (원본 이동 전) + onSidecarConflict='skip'|'rename' + dest-conflict-exhausted (.1~.9 모두 충돌 → 원본 이동 안 함) + recordMoveWithSidecar atomic + skip 분기 frontmatter sidecar_vault_path preserve. 6 신규 test PASS.
- **Step 5 audit-ingest.py**: JSON 5 신규 array (orphan_sidecars / source_modified_since_ingest / sidecar_modified_since_ingest / duplicate_hash / pending_protections, additive only) + Python NFC 정규화 (TS 와 일관) + WIKEY_AUDIT_ROOT env (fixture smoke 지원). 6 fixture shell smoke PASS exit 0.
- **Step 6 plugin entry + ConflictModal** (신규 95 lines): `IngestOptions.forceReingest` (caller-only override) + `onConflict` callback + plugin runIngestCore default ConflictModal injection (silent auto-protect 차단) + SkippedIngestResult `'skipped' in result` type guard + IngestCancelledByUserError handling.
- **Cycle smoke 5/5 PASS** (master CDP 직접): synthetic md sample 로 first ingest (force=new-source) → 같은 ingest (skip=hash-match, **LLM 0회**) → duplicate copy (skip=duplicate-hash-other-path, registry.duplicate_locations append) → raw bytes append (force, **source_id 보존 = preservedSourceId 작동**) → source page `## 사용자 메모` + raw 변경 (protect, **ConflictModal 자동 등장 → preserve 클릭 → Hook 2 user marker preserve 작동**).
- **PMS 실 ingest** — `raw/3_resources/20_report/500_technology/PMS_제품소개_R10_20220815.pdf` (3.6MB, paired sidecar 6.4MB) 사용자 직접 ingest. wiki 19 페이지 신규 + registry record `sha256:dcbe5dd3f5325d4b` + sidecar_hash 정상 채워짐. **★ 사용자 paired sidecar disk 보존** (mtime 22:17 / hash d66c44b0... 변화 없음). GAP 발견: R==null + paired sidecar 미보호 (후속 follow-up #10).
- **후속 follow-up 4건 추가 구현** (사용자 발견·통찰 기반):
  - **Approve & Write UX**: button click 시 `disabled=true` + `Writing… (please wait)` 라벨 + spinner CSS (`wikey-modal-btn-busy::before` + cursor: progress). 다중 클릭 차단.
  - **Original-link footer mode** (`OriginalLinkMode = 'raw' | 'sidecar' | 'hidden'`): `appendOriginalLinks` mode 분기 + `deriveSidecarPath(vaultPath)` (`.md`/`.txt` 자체 / 그 외 `<vaultPath>.md`) + alias `[​[<full path>|<basename without ext>]​]` (디렉토리/확장자 숨김, rollover 시 full path tooltip). 6 신규 test PASS.
  - **Plugin settings UI**: `originalLinkMode` setting + dropdown UI (PII 모드 다음 위치). default 'raw'.
  - **Settings i18n**: settings-tab.ts 35 한글 라인 → 0 (전부 영문, 일관된 Sentence case + 짧은 dropdown 라벨 + description 에 자세한 설명).
- **잔재 정리**: cycle-smoke-5-3 의 raw / wiki (1 source + 5 entities + 9 concepts EXCLUSIVE) / registry record / .ingest-map.json / wiki/index.md 14 라인 / wiki/log.md ingest H2 block 모두 정리. PMS / NanoVNA 무결성 영향 없음. /tmp 백업·smoke 산출물 모두 삭제.
- **회귀**: 584 → **640 PASS** (+56 신규), build 0 errors (core + obsidian, 1 import.meta warning 기존). audit fixture smoke 6/6 PASS exit 0.
- **Wiki 재생성 없음 확증**: §5.3 변경 = ingest 진입 분기 + Hook 3곳 + helper 신규 + audit 컬럼 5개 + plugin Modal 신규. 기존 Phase 4 데이터 (registry/wiki/qmd) 모두 backwards compat read 가능. legacy record 는 skip-with-seed 자동 마이그레이션.
- 참조: `activity/phase-5-result.md §5.3`, `plan/phase-5-todox-5.3.1-incremental-reingest.md`, `plan/phase-5-todo.md §5.3`.

## [2026-04-25] ingest | PMS_제품소개_R10_20220815.pdf

- 엔티티 생성: [[lotus-pms]]
- 엔티티 생성: [[good-stream]]
- 엔티티 생성: [[lotus-scm]]
- 엔티티 생성: [[mobile-app]]
- 엔티티 생성: [[project-management-institute]]
- 엔티티 생성: [[enterprise-resource-planning]]
- 엔티티 생성: [[manufacturing-execution-system]]
- 엔티티 생성: [[product-lifecycle-management]]
- 엔티티 생성: [[lotus-mes]]
- 개념 생성: [[project-management-body-of-knowledge]]
- 개념 생성: [[work-breakdown-structure]]
- 개념 생성: [[bill-of-materials]]
- 개념 생성: [[gantt-chart]]
- 개념 생성: [[functional-specification]]
- 추가 개념: [[supply-chain-management]]
- 추가 소스: [[source-lotus-pms-product-intro]]


## [2026-04-25] ingest | nanovna-v2-notes.md

- 엔티티 생성: [[nanovna-v2]]
- 엔티티 생성: [[nanovna-v2-plus4]]
- 엔티티 생성: [[nanovna-qt]]
- 엔티티 생성: [[dji-o3-air-unit]]
- 개념 생성: [[swr]]
- 개념 생성: [[s-parameter]]
- 개념 생성: [[s11]]
- 개념 생성: [[s21]]
- 개념 생성: [[smith-chart]]
- 개념 생성: [[sma-connector]]
- 개념 생성: [[mmcx-connector]]
- 개념 생성: [[open-short-load-calibration]]
- 추가 소스: [[source-nanovna-v2-notes]]

## [2026-04-25] ingest | nanovna-v2-notes.md

- 엔티티 생성: [[nanovna-v2]]
- 엔티티 생성: [[vector-network-analyzer]]
- 엔티티 생성: [[nanovna-v2-plus4]]
- 엔티티 생성: [[nanovna-qt]]
- 엔티티 생성: [[dji-o3-air-unit]]
- 개념 생성: [[user-manual]]
- 개념 생성: [[standing-wave-ratio]]
- 개념 생성: [[impedance]]
- 개념 생성: [[s-parameter]]
- 개념 생성: [[smith-chart]]
- 개념 생성: [[sma-connector]]
- 개념 생성: [[mmcx-connector]]
- 개념 생성: [[open-short-load-calibration]]
- 추가 소스: [[source-nanovna-v2-notes]]

## [2026-04-25] ingest | nanovna-v2-notes.md

- 엔티티 생성: [[nanovna-v2]]
- 엔티티 생성: [[vna]]
- 엔티티 생성: [[v2-plus4]]
- 엔티티 생성: [[nanovna-qt]]
- 엔티티 생성: [[dji-o3-air-unit]]
- 엔티티 생성: [[dji]]
- 개념 생성: [[swr]]
- 개념 생성: [[s-parameter]]
- 개념 생성: [[sma]]
- 개념 생성: [[mmcx]]
- 추가 소스: [[source-nanovna-v2-notes]]

## [2026-04-25] phase-5 | §5.2.0~5 검색·답변 품질 6건 통합 (commit f108e0c)

- **§5.2.0 paired sidecar.md UI** — `wikey-core/paired-sidecar.ts` 신규 (helper + 17 unit tests). `wikey-obsidian/sidebar-chat.ts` 의 Ingest list / Audit list / Audit tree 3 row builders 모두 `<base>.<ext>.md` row 숨김 + `<base>.<ext>` row 에 [md] 뱃지 (`.wikey-pair-sidecar-badge` CSS) + tooltip (`📄 sidecar` + `📅 created`) + 카운트 정정 (auditData filter 후 ingested/missing/total 재계산). UI 레이어만 변경 — registry/movePair/wiki/ 데이터 무관.
- **§5.2.1 ★ entity↔concept cross-link** — `canonicalizer.ts` `applyCrossLinks` helper 신규. 같은 ingest 사이클 entity ↔ concept 사이 결정적 양방향 wikilink. `## 관련` H2 (description ↔ `## 출처` 사이) + alphabetical bullets. self-link 차단. FORCED_CATEGORIES post-pin 적용. plan: `phase-5-todox-5.2.1-crosslink.md` (analyst v2). codex Mode D Panel APPROVE_WITH_CHANGES → P1 3건 정정 (baseline 4건 / TDD edge 3건 추가 / option B scope 명시) 반영. 8 unit tests (happy, empty, concept-only, FORCED_CATEGORIES post-pin, determinism, SLUG_ALIASES self-link, dual-pool, rebuild idempotent).
- **§5.2.2 답변 prompt 강화** — `query-pipeline.ts buildSynthesisPrompt` 에 (1) 검색 페이지 본문 `wikilink` 활용 (2) 답변 첫 등장 entity/concept 을 `페이지명` 으로 링크 (3) "참고:" 블록에 직접 인용 + 1-hop target 모두 나열 — 3 지시 추가. 3 unit tests.
- **§5.2.3 검색 graph expansion** — `extractWikilinkBasenames` + `expandWithOneHopWikilinks` pure helpers (5 tests). `buildContextFromFS` / `buildContextWithWikiFS` 가 top-N 페이지 본문의 `wikilink` parse → wiki/{entities,concepts,sources,analyses}/<base>.md 4-카테고리 resolve → cap 5 추가 fetch (frequency desc, first-seen tie-break). 4 unit tests.
- **§5.2.4 TOP_N default 5 → 8** — `config.ts` + `wikey.conf` + query-pipeline fallback 모두 8.
- **§5.2.5 reindex silent fail observability + race fix** — `waitUntilFresh` timeout 시 last status + stale count 노출 (진단성). `ingest-pipeline.ts` `onFreshnessOk` callback 신규 (성공 시 plugin 이 Notice "✓ 검색 인덱스 최신 (Xs)" 발동 — silent fail 자체 제거). `commands.ts` post-movePair re-reindex (autoMove 로 인한 wiki/sources/source-*.md frontmatter rewrite 가 STAMP_FILE 갱신 후 발생해 stale 트리거하던 race 차단).
- **검증**: `npx vitest run wikey-core/src/` → 577/577 (37 신규). `npm run build` 0 errors (core + obsidian). CDP UI cycle smoke (§5.2.8): 4 PASS / 1 PARTIAL (495→500+ fix) / 1 FAIL (observability ✓, qmd plugin-only exit=1 = §5.8.3 W-C1 영역). commit `7ae636f` 로 reindex.sh stderr 보존 + prompt 보강 추가.
- 참조: `activity/phase-5-result.md §5.2.0~5 / §5.2.8`, `activity/phase-5-resultx-5.2-cycle-smoke-2026-04-25.md`, `plan/phase-5-todox-5.2.1-crosslink.md`, `plan/phase-5-todo.md §5.2`.

## [2026-04-25] phase-5 | §5.1 over-mask fix + P2 분리 + cycle smoke (master 직접)

- **§5.1.2 Phase A** (commit `5e32ec4`) — `ceo-multiline-form.valueExcludePrefixes` 13 라벨 추가 + `isCandidateExcluded` same-line 전체 토큰 검사. master CDP smoke 발견 over-mask 4건 (`등기일`/`주소`/`서울시 어`/`딘가`) 차단. 회귀 테스트 `pii-over-mask-prevention.test.ts` 2건 신규. 539/539 pass.
- **§5.1.2 Phase B** (commit `3f1fa6d`) — codex Mode D Panel review (gpt-5.5 xhigh) FAIL → 분리 fix:
  - P2: `valueExcludePrefixes` (회사명, candidate startsWith) vs `contextLabelPrefixes` (라벨 신규 필드, candidate `===` 정확 일치 + same-line startsWith) 2-list 분리. 한국 이름 false-negative 방지 (`'주소영'` 같이 라벨 첫 음절과 겹치는 실재 이름).
  - P3: `canonicalizer.test.ts` fixture placeholder constants 사용 + `canonicalizer.ts` 본문 hardcoded 회사명 example placeholder 모듈로 통합 (`example-placeholders.ts` 신규 + 5 파일 7 ref import 교체). production 0 hits.
  - 540/540 pass.
- **§5.1.3 Master Obsidian CDP UI 1-cycle smoke** (NanoVNA 1 파일, `raw/_delayed/nanovna-v2-notes.md`) — `wikey:ingest-current-note` → Brief modal Proceed → Processing 1분 25초 (Gemini 2.5 Flash) → Preview Approve & Write → wiki write 18 file (5 entities + 9 concepts + 1 source + log/index/.ingest-map). reindex 수동 (12초) 후 query 답변 184 chars + citation 4건 (`nanovna-v2` entity + `wikey-citation-link 📄` 보조 + `source-nanovna-v2-notes` source + 원본 `raw/_delayed/nanovna-v2-notes.md`). 사용자 지시로 산출물 reset + `nanovna-v2-notes.md` → `raw/0_inbox/` 이동.
- **발견된 follow-up (모두 §5.2 통합)**: 자동 reindex silent fail (4 후보 좁힘) / 답변 짧음 — entity↔concept cross-link 누락 root cause / TOP_N 5 / movePair 미발동 (의도된 가드: `commands.ts:442`).
- **§5.2 재정의** (todo) — chunk 기반 → wikey 철학 (chunk 배제, H2 section 단위, 페이지 단위 검색, Phase 4 §4.5.1.5 v2 결정 정합) 으로 전면 재작성. cycle smoke 발견 5건 통합. §5.2.1 entity↔concept cross-link, §5.2.2 답변 prompt 강화, §5.2.3 graph expansion, §5.2.4 TOP_N 상향, §5.2.5 reindex 진단, §5.2.6 H2 의미 활용, §5.2.7 Anthropic chunk 재작성 archive.
- **인프라 정비**: `~/.claude/skills/obsidian-cdp/SKILL.md` 신설 (full cycle + Query 검증 + 모달 셀렉터 + 함정 카탈로그). `~/.claude/agents/tester.md` 갱신 (CDP UI 1차 책임). 메모리 4건 신설 (`feedback_no_circled_numbers`, `feedback_no_defer_to_next_session`, `feedback_obsidian_modal_proceed`, `feedback_reuse_prior_artifacts`).
- 참조: `activity/phase-5-result.md §5.1.2 / §5.1.3`, `activity/phase-5-resultx-5.1-cdp-cycle-smoke-2026-04-25.md`, `plan/phase-5-todo.md §5.1.1.12 / §5.2.1~5`.

## [2026-04-25] impl | Phase 5 §5.1 구조적 PII 탐지 착륙 (P0 긴급)

- **범위**: 계획서 `plan/phase-5-todox-5.1-structural-pii.md` v4 §5.1.1.1~10. Context window heuristic (안 C) + multi-value capture + valueExcludePrefixes (YAML 선언).
- **코드**: `wikey-core/src/pii-patterns.ts` (discriminated union `PiiPattern = SingleLinePiiPattern | StructuralPiiPattern`, `patternType` discriminator, loader/compiler union-aware, ESM 전환) + `wikey-core/src/pii-redact.ts` (`collectStructuralMatches()` 신규, non-empty 줄 windowLines, prefix exclude same-line 1~2 token, `sanitizeForLlmPrompt({structuralAllowed?: boolean})` default false filename skip).
- **설정**: `wikey-core/src/defaults/pii-patterns.default.yaml` (신규, 6 패턴: single-line 4 + structural CEO/BRN). `package.json` build 스크립트에 `dist/defaults/` 복사 훅 추가. 신규 런타임 의존성 0.
- **테스트**: `__tests__/pii-structural.test.ts` (신규 12 tests, RED → GREEN, fresh). fixture 7종 (synthetic `주식회사 테스트벤치` · `홍 길 동` 등) + FP baseline 30종 (synthetic PII-free 한국어 테크 문서) → structural match 0/30 확증.
- **결과**: `npm test` **537 passed / 26 files** (525 → +12). `npm run build` 0 errors. 기존 pii-redact 21 tests GREEN 회귀 없음.
- **§12 상태**: E4~E10 PASS. E1/E2.b/E3 (live smoke 재실행 기반) 은 tester 에이전트 후속 — Obsidian CDP 경유.
- **관련 동기화**: `activity/phase-5-result.md §5.1.1` (신규 타임라인), `plan/phase-5-todo.md §5.1` (체크박스 갱신 예정).

## [2026-04-24] milestone | Phase 4 본체 완성 선언 (session 8, 단일 세션)

- **결과**: D.0 Critical Fix Plan v6 15 항목 (a~o) 전체 충족. `activity/phase-4-result.md §4.8` append + `plan/phase-4-todo.md` 본체 완성 헤더 전환 + `plan/phase-5-todo.md` 우선순위 재조정 (P0~P4 전면 재번호) + memory `project_phase4_status.md` "완료" + `feedback_pii_no_hardcoding.md` 신규.
- **D.0.k codex Panel Mode D 재검증**: 1차 REJECT / CRITICAL: 1 (sidebar unsupported guard + PII settings persist + reindex 사용자 Notice) → 3건 수정 (commit `c2f4165`) → 재검증 APPROVE / CRITICAL: 0 / FINDINGS: none.
- **D.0.l Agent 위임 smoke** (~2h 10m): Pass A/B 6/6 pipeline PASS + 보조 2b/3b PASS + §4.C palette 9 entries + typing gate PASS + cross-compare tier 6/6 / classify 5/6. wiki body PII 전파 2건 (C-A1 filename BRN + C-A2 CEO 공백) 발견.
- **D.0.m PDF sidecar redact grep**: 양 pass 결정적 일치 `***-**-*****` + `******-*******`, 원문 BRN 0 hit.
- **D.0.n runtime sanity**: capabilities.json 생성 (bug fix `node:fs/promises` → `require`, commit `e362d3c`) + `reindex.sh --check --json` fresh/stale/never 3-status 수동 유도 확증.
- **PII 패턴 엔진 도입** (사용자 지시 "하드코딩 안됨"): `wikey-core/src/pii-patterns.ts` 신규 (YAML loader + DEFAULT_PATTERNS 4종 + user override 병합) + `sanitizeForLlmPrompt` 단일 진입점 + `brn-hyphen` look-around (`_301-86-19385(` 같은 filename 케이스) + `ceo-label` 단일라인 공백 변형 (`김 명 호`). 525 vitest passed (511 → +14). C-A1 filename leak 완전 해결 / C-A2 단일라인 해결 / multi-line 구조 폼 (blank line 분리 label↔name) 은 Phase 5 §5.1 (P0 긴급) 로 승격.
- **UI**: audit row 에러 Notice 위치 info-column 내부로 이동 (filename 공간 보존, 사용자 피드백).
- **Phase 5 재구성**: 기존 §5.1~§5.8 번호가 역사적·주제별이라 실행 순서 반영 안됨 → 사용자 요청으로 P0~P4 긴급도 기반 전면 재번호. §5.1 구조적 PII (P0, was §5.8.6), §5.2 검색 (was §5.1), §5.3 증분 (번호 유지), §5.4 self-extending (was §5.6), §5.5 그래프 (was §5.2), §5.6 엔진 (was §5.5), §5.7 운영 포팅, §5.8 D.0.l 잔여 (P4), §5.9 Variance (was §5.4). `plan/phase-5-todo.md § 우선순위 가이드` 참조.
- **다음**: Phase 5 착수. 첫 진입점 = §5.1 (P0) 또는 §5.4.1 (P2 gate) — 사용자 판단.

## [2026-04-24] impl | Phase 4 D.0.a~j 구현 완료 (session 7, 단일 세션)

- **범위**: `plan/phase-4-todox-4.6-critical-fix-plan.md` v6 §4.1~§4.5 중 D.0.a (TDD pii-redact) 부터 D.0.j (빌드+테스트) 까지 10개 태스크 순차 완료. D.0.k~o (codex 재검증/smoke/D 선언) 은 차기 세션.
- **신규 파일**: `wikey-core/src/pii-redact.ts` (2-layer gate + 3-mode redact + hide 3-단 fallback), `wikey-core/src/capability-map.ts` (pure function + dumpCapabilityMap), `wikey-core/src/__tests__/pii-redact.test.ts` +21, `__tests__/capability-map.test.ts` +5, `__tests__/scripts-runner.test.ts` +7.
- **수정 파일**: `ingest-pipeline.ts` (extractPdfText 반환형 `{stripped, sidecarCandidate}` 승격 + 중앙 PII wrapper line 150 + awaitable `runReindexAndWait`), `scripts-runner.ts` (ScriptResult.exitCode + runScript timeoutMs + reindexQuick/reindexCheckJson/waitUntilFresh), `source-resolver.ts` (ResolvedSource.rawVaultPath), `query-pipeline.ts` (appendOriginalLinks + query() 자동 호출), `scripts/audit-ingest.py` (capabilities.json runtime bridge + entries/unsupported_files/capabilities JSON schema), `scripts/reindex.sh` (`--check --json` contract), `main.ts` (onLayoutReady + renameGuard.consume + dumpCapabilityMap + DOC_EXT_RE), `settings-tab.ts` (PII 3 필드 UI), `commands.ts` (PiiIngestBlockedError Notice), `ingest-modals.ts` (fileLabel + DOM 재정렬), `sidebar-chat.ts` (auditData 확장), `styles.css` (row-unsupported / banner-warn / file-label).
- **테스트 합계**: 511 passed (25 files, base 462 → +49 net; pii-redact +21 / capability-map +5 / scripts-runner +7 / query-pipeline +4). 플랜 목표 496+ 초과.
- **빌드**: `npm run build --workspaces` 0 errors (wikey-core tsc + wikey-obsidian esbuild). `main.js` 247KB / `styles.css` 46KB.
- **런타임 sanity**: `bash scripts/reindex.sh --check --json` → `{"stale":1,"status":"stale"}` / `python3 scripts/audit-ingest.py --summary` → 신규 "미지원" 라인 + fallback capability 확인.
- **범위 내 결정 3건**: (1) extractPdfText cache hit 시 sidecarCandidate=cached (2) Audit UI missing 뷰에 unsupported 통합 (3) runReindexAndWait 실패 warn downgrade.
- **관련 동기화**: `activity/phase-4-result.md §4.7` (신규 상세 subject, tags #implementation #core #workflow #eval), `plan/phase-4-todo.md` D.0.a~j `[x]` + 상단 상태 헤더, `plan/session-wrap-followups.md` 진입점, memory `project_phase4_status.md` + `MEMORY.md`.

## [2026-04-24] plan | Phase 4 D.0 Critical Fix Plan v6 수립 — codex Panel Mode D APPROVE / CRITICAL:None

- **배경**: 2026-04-23 통합 smoke 2-pass (Pass A 5/6, Pass B 3/4) → 5 Critical (C1 harness block / C2 BRN·CEO 노출 / C3 audit 확장자 / C4 reconcile race / C5 qmd staleness) + C6 UX 5건 → D 선언 보류.
- **사용자 결정 4건 (누적)**: (1) mask default (2) 변환 후 redact → harness 순서 (3) md 원본도 동일 프로세스 (4) C안 2-layer — basic `allowPiiIngest` (OFF=block / ON=redact) + advanced `piiGuardEnabled` (OFF=detect 자체 skip, 공시용).
- **codex Panel Mode D 4 라운드**: v1 REJECT (P1 4건) → v3 REJECT (P1 3건: PDF sidecar leak / reindex contract 부재 / audit-ingest.py static) → v4 APPROVE-WITH-CHANGES (4 CHANGES) → v5 APPROVE-WITH-CHANGES / **CRITICAL: None** (2 문서 일관성) → v6 구현 착수 승인.
- **산출물**: `plan/phase-4-todox-4.6-critical-fix-plan.md` 690+ lines. 구현 범위 = `pii-redact.ts` 신규 + 중앙 wrapper (ingest-pipeline.ts:150) + PDF sidecar 재설계 (extractPdfText caller 2개) + `scripts/reindex.sh --check --json` contract + `env-detect.ts` capability map + `~/.cache/wikey/capabilities.json` bridge + C4 onLayoutReady + C6.1~C6.4 UI.
- **병행 개선**: `~/.claude/skills/sync/SKILL.md` v7→v8.1 — Phase 0 (프로젝트 특화 pre-sync) + Phase 0-4.5 (plan/todo 정합성 체크) + Phase 3 (단일 commit/push). `.claude/skills/result-doc-writer/SKILL.md` 에 "⚠️ result 상세하게" 최우선 원칙 추가.
- **관련 동기화**: `activity/phase-4-result.md §4.6` (신규 상세 subject), `plan/phase-4-todo.md` §4.6 mirror + 본체 완성 체크리스트에 **D.0 블록** 신설, `plan/session-wrap-followups.md` 다음 세션 = D.0 구현.

## [2026-04-23] plan | Phase 4 통합 smoke 계획서 v6 — codex Panel Mode D APPROVE-WITH-CHANGES

- v3 REJECT (P1 5건) → v4 REJECT (P1 5 중 4 부분해소) → v5 REJECT (P1 2 남음) → **v6 APPROVE-WITH-CHANGES** (P1 0건).
- v6 핵심: IV.A 를 WARN 허용 관찰로 강등 (실행 중 shell mv 가 vault watcher 에 잡힌다는 코드상 보장 없음 수용) + IV.B 를 registry diff 1차 판정으로 주 검증축 격상 + §7.4 snippet 전부 복붙 실행 가능 (helper / boolean IIFE) + §7.6 실행 순서 mode 명시 (init/between-pass/final + Obsidian quit/launch cycle).
- APPROVE 직후 P2 2건 (IV.B snippet jq 명령 삽입 + 4.A.teardown mode 명시) + P3 3건 (버전 표기 잔재) 반영.
- 관련 동기화: plan/phase-4-todo.md A 블록 + plan/session-wrap-followups.md 진입점 + memory.

## [2026-04-23] plan | Phase 4 통합 smoke 계획서 v3 — 2-pass + Claude CDP 자동 실행

- 사용자 피드백으로 v2 → v3 대폭 재설계. 핵심 변경 3건:
  - **실행 주체**: 사용자 수동 → **Claude 가 CDP (localhost:9222, `/tmp/wikey-cdp.py`) 로 UI event 순차 발행**. DOM/내부 API 우회 금지, 백그라운드·병렬 금지.
  - **구조**: 단일 pass (Audit only) → **2-pass** (Pass A: Ingest 패널, 일반 사용자 경로, Ingest+Move 2-step / Pass B: Audit 패널, 운영자 감사 경로, 1-step 자동 이동). 양 pass 사이 `smoke-reset.sh` 로 완전 clean-slate (inbox backup/restore 포함).
  - **Audit 만 돌리면 Ingest 패널의 일반 사용자 경로는 검증되지 않는다**는 사용자 지적 반영. 두 경로 모두 통과해야 본체 완성 선언.
- §4 전면 재편: §4.Common (I Stage1 core / II Index-ready gate / III Stage2 / IV Stage3) 공용 절차 + §4.A Pass A + §4.B Pass B + §4.B.cross Pass A/B 교차 대조 + §4.C 덤 smoke.
- **§7 신규 "Claude 실행 플로우"**: `scripts/smoke-cdp.sh` wrapper 설계 (click/type/key/wait/text/capture-logs/init-log) + UI selector 카탈로그 + Stage 별 CDP snippet (7.4.a~d) + 안전 레일 (파일당 15분 상한, 3 연속 FAIL 중단).
- §5 리포트 2-pass 구조: pass-a-readme + pass-b-readme + cross-compare + 파일별 12개 (6×2).
- §6 Acceptance 2-pass: Pass A 6/6 + Pass B 6/6 + tier 6/6 일치 + PII 0 + ERROR 0.
- 소요 시간 2~3h → **4.5~7h**. 세션 분할 권장.
- 관련 동기화: `plan/phase-4-todo.md` 본체 체크리스트 A 블록을 2-pass 6 체크박스로 재작성 · `plan/session-wrap-followups.md` 진입점 전면 갱신 · memory `project_phase4_status.md` description + `MEMORY.md` 인덱스.
- codex Panel Mode D 재검증 실행 중 (v2 → v3 delta).

## [2026-04-23] plan | Phase 4 통합 smoke 테스트 계획서 수립 (v2, codex Panel Mode D APPROVE-WITH-CHANGES)

- 신규: `plan/phase-4-todox-4.6-integrated-test.md` (556 라인). Phase 1~4 본체 완성 직전의 통합 회귀 smoke. 6종 파일 (llm-wiki.md / 사업자등록증 PDF (PII) / SK바이오텍 계약서 PDF 6p / PMS 제품소개 PDF 31p / 스마트공장 HWP / Examples HWPX) 을 Stage 1 Ingest → Stage 2 Wiki 검색 → Stage 3 Pairmove + 재검색 의 3-stage 로 반복. Obsidian CDP 자동화 금지, 실제 사용자 클릭·입력만. 파일별 리포트 + 집계 README 필수.
- codex 검증 (Panel Mode D, gpt-5.4 xhigh, cmux surface:2 재사용) —
  - 초기 VERDICT **REJECT** (4 P1 블로커): (A) 실행 경로 애매 (Ingest 패널·Cmd+Shift+I 는 autoMoveFromInbox=false), (B) clean-slate + settings baseline 미정의, (C) index-ready gate 부재 (qmd reindex 가 fire-and-forget), (D) 파일 2 PII redaction 규칙 부재.
  - v2 반영 후 codex 명시 VERDICT **APPROVE-WITH-CHANGES**.
  - P2 3건 수용: 파일별 프로파일 실측 보정 (계약서 6p / PMS 31p / `1b-docling-force-ocr-scan` 가능성 / `image-ocr-pollution → 1a-docling-no-ocr` retry 분기) · 분류 depth 기록 강화 · Phase 4.0 UI pre-smoke §4.0 신규.
  - P3 3건 수용: Stage 4 삭제/초기화 modal sequence 재작성 · 체크리스트 13 → 14 항목 · tier 이름/로그 문자열 현행화.
- `plan/phase-4-todo.md` Phase 4 본체 완성 체크리스트 A 블록을 "6종 × 3-stage 통합 회귀" 로 확장 + 단일 소스를 `plan/phase-4-todox-4.6-integrated-test.md` 로 지정. 예상 소요 30분 → 2~3 시간.
- 다음 세션 플레이북: A smoke (사용자 수동, 2~3h) → D 본체 완성 선언. 계획서 §2.1 clean-slate 실행 → §4.0 UI pre-smoke → §4.1~4.3 파일 루프 → §4.4 Stage 4 덤 smoke → §5 리포트.

## [2026-04-23] docs | §4.5.2 result/todo 상세 보강 (1:1 mirror, 세부 번호 6+6)

- `activity/phase-4-result.md §4.5.2` 세분화: 4.5.2.1.1~1.6 (computeDeletionImpact 시그니처 · vitest 6 라벨 테이블 · DeleteImpactModal · 팔레트 2 엔트리 표 · source/wiki-page 실 삭제 경로) + 4.5.2.2.1~2.6 (previewReset 시그니처 · vitest 6 라벨 · ResetImpactModal · 팔레트 5 엔트리 표 · executeReset scope 디스패치 표 · renderResetSection 배치) + 4.5.2.3 검증 증거 + 4.5.2.4 범위 제한 메모 + 4.5.2.5 다음 단계.
- `plan/phase-4-todo.md §4.5.2` 체크박스를 4.5.2.1.1~1.6 / 4.5.2.2.1~2.6 하위 번호 체계로 재구성 (result 와 1:1 mirror). "§4.5.2 에서 Phase 5 이관" 에 wiki-page backlink strip (§5.4) + 삭제 undo 항목 명시적 추가.
- 본 commit 은 코드 변경 없음 — docs-only sync. commit `188a507` 의 코드 deliverable 이 불변.

## [2026-04-23] feat | §4.5.2 운영 안전 — 삭제·초기화 안전장치 (Phase 4 본체 체크리스트 B + C) — commit `188a507`

- **배경**: Phase 4 본체 완성 체크리스트의 B (삭제) + C (초기화) 항목. A 는 Obsidian UI 수동 smoke 라 본 세션에선 코드 루프만 처리.
- **신규 파일**:
  - `wikey-core/src/reset.ts` — `computeDeletionImpact` (source/wiki-page 영향 계산) + `previewReset` (5-way scope 파일·바이트 합산). 순수 함수, fs 부작용 없음.
  - `wikey-core/src/__tests__/reset.test.ts` — vitest +12 (computeDeletionImpact 6 + previewReset 6). 462 → 474 tests.
  - `wikey-obsidian/src/reset-modals.ts` — `DeleteImpactModal` + `ResetImpactModal`. impact 요약 ≤20~30건 표시 + `DEL <id>` / `RESET <SCOPE>` 타이핑 필수 + warning 버튼 2중 게이트.
- **수정 파일**:
  - `wikey-core/src/index.ts` — reset.ts 공개 API (`computeDeletionImpact`, `previewReset`, `QMD_INDEX_MARKER`, `SETTINGS_MARKER`, 타입 6개).
  - `wikey-obsidian/src/commands.ts` — `registerDeleteCommand` (2 palette entries) + `registerResetCommand` (5 palette entries) + `executeReset` export (Settings Tab 재사용).
  - `wikey-obsidian/src/settings-tab.ts` — `renderResetSection` (Settings 탭 Reset 섹션: scope dropdown + Preview & Reset 버튼).
- **삭제 경로**: source → `ingested_pages[...]` + sidecar + raw 원본 `fs.unlinkSync` + `registryRecordDelete` tombstone. wiki-page → 해당 md 만 `fs.unlinkSync`, backlink 는 경고만.
- **리셋 경로**: wiki/registry 스코프 → preview 파일 `fs.unlinkSync` (+ registry-only 는 빈 JSON 복원). qmd-index → `~/.cache/qmd/index.sqlite` 삭제 (lazy 재빌드). settings → `data.json` 삭제 (재시작 시 DEFAULT_SETTINGS 복원).
- **검증**: `npm test` 22 files / **474 tests passed** + `npm run build` 0 errors.
- **미완 (A)**: Obsidian UI 수동 smoke 5건 (Part B 보조 링크 렌더 · external URI · tombstone · Stage 2/3 override · source page strip). 사용자가 Obsidian 에서 수동 진행 후 본체 완성 선언 블록 추가.
- 참조: `activity/phase-4-result.md §4.5.2` 신규 세부 기록 · `plan/phase-4-todo.md §4.5.2` [x] + 본체 체크리스트 B·C [x] · `plan/session-wrap-followups.md` 최상단 블록 갱신 · memory `project_phase4_status.md` description.

## [2026-04-23] refactor | §4.2.3 Audit UI 재설계 — Re-classify 체크박스 철회 + paraRoot 옵션

- 사용자 피드백 "UI가 이상해졌어. 불필요해. 1) auto 는 자동 LLM fallback, 2) 수동 지정은 수동분류 — 이중 선택 불필요" + "수동 지정은 PARA 만, sub-folder 는 CLASSIFY.md + LLM" 반영.
- **제거**:
  - `sidebar-chat.ts` Re-classify checkbox DOM (per-row `.wikey-audit-reclass-line` + label)
  - `inboxReclassify: Map<string, boolean>` 상태 및 reset
  - `appendClassifyFeedback` 호출처 + import
  - `styles.css` `.wikey-audit-reclass-*` 4 rules
  - `wiki-ops.ts::appendClassifyFeedback` + `ClassifyFeedbackEntry` + `isDuplicateLastEntry`
  - `index.ts` export 2건 (`appendClassifyFeedback` · `ClassifyFeedbackEntry`)
  - `wiki-ops.test.ts` appendClassifyFeedback describe 블록 (-4 tests)
- **추가 (수동 PARA 지정 경로)**:
  - `classify.ts::ClassifyFileOptions = { paraRoot?: string }` + `swapParaRoot` 헬퍼 (정규식 `^raw\/[1-4]_[a-z_]+` 기반 PARA prefix 교체).
  - `classifyFileAsync(filename, isDir, deps, options?)` — paraRoot 지정 시 rules + LLM 결과 양쪽의 PARA prefix 강제 swap.
  - `classifyWithLLM(.., paraRoot?)` — prompt 에 "필수 제약 · destination 은 반드시 `<paraRoot>/` 로 시작" 블록 주입.
  - `index.ts::ClassifyFileOptions` export.
  - `classify.test.ts` +3 (prompt constraint / rules swap / LLM swap 방어) = 24 → 27.
- **sidebar-chat Apply 로직 단순화**: 분기 `dest === 'auto' || reclassifyForced` 제거 → `classifyFileAsync(f, isDir, deps, { paraRoot: dest === 'auto' ? undefined : dest })` 한 줄.
- 증거: wikey-core 463 → **462 PASS** (+3 신규 -4 제거) · `npm run build` 0 errors (tsc + esbuild). Karpathy #2 simplicity + #3 surgical — 본인 변경으로 생긴 orphan 은 제거.
- 참조: `activity/phase-4-result.md §4.2.3.3/§4.2.3.4` (재설계 기록 + 철회 사유), `plan/phase-4-todo.md §4.2.3 S3-3/S3-4` (재설계 체크리스트), 이번 커밋.

## [2026-04-23] feat | §4.3 Part B (citations UI) + §4.3.1 3-stage prompt override + codex 2차 검증 착수

- **§4.3 codex rescue 2차 검증** 진행 — 1차 `b2p8s3sgq` 가 analysis 턴 후반 timeout 했던 후속. 2차 `bsmflco7z` 가 Part A 완료 이후 실제 구현 + plan v2 동반 분석. 검증 결과는 plan v3 로 반영 예정.
- **§4.3.2 Part B — 쿼리 응답 원본 backlink** 완료
  - `wikey-core/src/source-resolver.ts` 신규 (~165 라인) — `resolveSource(wikiFS, idOrRef, { vaultName, absoluteBasePath?, registry? })` + `resolveSourceSync` 배치 variant. registry 조회 → `obsidian://open?vault=&file=` / external URI / tombstone 분기. `sources/sha256:...` / bare / `uri-hash:...` 4 형태 input 수용. vitest 11 green.
  - `wikey-core/src/query-pipeline.ts` citations 구조화 — `QueryResult.citations?: Citation[]` optional 필드. `buildCitationFromContent` (순수) + `collectCitationsWithWikiFS` / `collectCitationsFromFS` 공용. provenance 없는 페이지는 skip. vitest +6.
  - `wikey-obsidian/src/sidebar-chat.ts` 답변 렌더 — 각 wikilink 뒤 `📄` 보조 버튼 attach. `attachCitationBacklinks` 가 registry 1회 load 후 `resolveSourceSync` 재사용. 클릭 dispatch 3 경로 (tombstone Notice / external window.open / internal `app.workspace.openLinkText`, plan v2 §3.3 Obsidian API 호환).
  - CSS `.wikey-citation-link` — `0.68em` + `opacity: 0.7` 철학 가드 (wiki 계층 주 강조 유지), hover 시 1, tombstone `grayscale(1)` + cursor not-allowed.
  - `index.ts` 신규 export: `resolveSource` / `resolveSourceSync` / `resolvedAbsoluteFileUri` / `ResolvedSource` / `ResolveSourceOptions` / `SourceIdKind` / `buildCitationFromContent` / `collectCitationsWithWikiFS` / `collectCitationsFromFS` / `Citation` type.
- **§4.3.1 — 3-stage 프롬프트 override** 완료
  - 경로 상수 `STAGE1_SUMMARY_PROMPT_PATH` / `STAGE2_MENTION_PROMPT_PATH` / `STAGE3_CANONICALIZE_PROMPT_PATH` + 기존 `INGEST_PROMPT_PATH` 는 Stage 1 legacy fallback.
  - `loadEffectiveStage1Prompt` / `loadEffectiveStage2Prompt` / `loadEffectiveStage3Prompt` — `PromptLoadResult = { prompt, overridden, source }`. `loadEffectiveIngestPrompt` 는 Stage 1 shim.
  - `BUNDLED_STAGE2_MENTION_PROMPT` 신설 — 기존 하드코딩 prompt 를 외부화. 템플릿 변수 `{{SOURCE_FILENAME}}` / `{{CHUNK_CONTENT}}`.
  - `canonicalizer.ts::buildCanonicalizerPrompt` 에 **optional** `overridePrompt?: string` (plan v2 §4.4 self-review #2) — 빈/공백은 bundled fallback, 본문 있으면 6 template 변수 (`SOURCE_FILENAME / GUIDE_BLOCK / SCHEMA_BLOCK / EXISTING_BLOCK / MENTIONS_BLOCK / MENTIONS_COUNT`) 치환.
  - `ingest-pipeline.ts` Route FULL / SEGMENTED 양 경로 모두 `extractMentions(..., stage2Template)` + `canonicalize({ ..., overridePrompt: stage3OverridePrompt })` 전달. route 진입 전 1회 로드.
  - `settings-tab.ts::renderIngestPromptSection` 3-stage 리팩토링 — 공통 `renderPromptRow` 헬퍼가 Edit/Reset/Status/inline 경고 (plan v2 §4.5). Reset 이 canonical + legacy 동시 검사 → 양쪽 삭제 confirmation.
  - `IngestPromptEditModal` 에 `title?` 파라미터 — 모달 헤더가 stage 별 달라짐.
  - vitest +9 (Stage 1 3, Stage 2 2, Stage 3 2, 기타) + canonicalizer +2 (full replacement + whitespace-only ignore).
- **Part A tsc readonly 회귀 수정** (ancillary) — commit `4588ea2` 의 `parseProvenance` 가 `Partial<ProvenanceEntry>` 에 readonly 필드 할당 → 4 errors on master HEAD. 같은 파일 편집 기회에 local builder 타입 + `flush()` 에서 ProvenanceEntry 구성 + spread 로 수정. tsc 4 → 0 errors.
- 증거: wikey-core 437 → **463 PASS (+26)** · `npm run build` wikey-core tsc 0 + wikey-obsidian esbuild 0 · `scripts/tests/pair-move.smoke.sh` 6/6 · wikey-obsidian settings-tab 3건 tsc warn 은 session 3 이전부터 있던 pre-existing.
- 참조: `activity/phase-4-result.md §4.3.1 / §4.3.2 Part B`, `plan/phase-4-todo.md §4.3.1 + §4.3.2 Part B (전량 [x])`, `plan/phase-4-todox-4.3-plan.md` (v3 는 codex 2차 결과 후 작성).
- 남은 항목: 통합 smoke (Obsidian UI 수동 확인 — 인제스트 1회 → citations 📄 rendering + 원본 열림) → §4.5.2 운영 안전 (삭제/초기화 가드) → Phase 4 본체 완성 선언.

## [2026-04-23] feat | §4.3 plan v2 + Part A Provenance data model + §4.3.3 stripBrokenWikilinks

- **§4.3 계획 v2 수립** (`plan/phase-4-todox-4.3-plan.md`, 11 개 섹션, 약 250 라인)
  - v1 → v2 진화: codex rescue 1차 검증 시도 중 analysis 턴 후반 (3013 bytes) 에서 프로세스 종료 + 최종 응답 캡처 실패 → self-review 4건 보강으로 v2 확정.
  - Self-review 4건: (High) Obsidian plugin 은 Electron renderer 라 `shell.openPath` 미접근 → `app.openWithDefaultApp` / `workspace.openLinkText` / `window.open` 로 교체 · (Medium) `buildCanonicalizerPrompt` 시그니처 optional 명시 (backward compat) · (Medium) Stay-involved Preview 를 stripBrokenWikilinks 이후로 이동 (Preview/저장본 bit-identical) · (Low) Stage 1 override 가이드 신설.
  - Open question 5건 모두 decision 명시 — flat 배열 provenance / 인라인 citation MVP / 도메인 프리셋 Phase 5 이관 / Preview 시점 확정 / AMBIGUOUS Badge-only.
- **§4.3.2 Part A — Frontmatter `provenance` data model** 완료
  - `wikey-core/src/types.ts`: `ProvenanceType` union (extracted / inferred / ambiguous / self-declared — 마지막은 Phase 5 §5.6 예약) + `ProvenanceEntry` interface (type, ref, confidence?, reason?).
  - `wiki-ops.ts::injectProvenance`: entity/concept/analyses frontmatter 에 provenance 배열 주입 — dedupe (type+ref 기준) + 기존 필드 보존 + frontmatter 없는 페이지에 블록 신규 생성. vitest +3 green.
  - `provenanceYamlScalar` 헬퍼 — ref 가 `sources/sha256:abc` 형태일 때 콜론 전면 quote 규칙 완화 ("콜론-공백" 만 quote). 테스트 케이스의 bare format 유지.
  - `ingest-pipeline.ts`: Stage 2/3 canonicalize 된 모든 entity/concept 에 `{type:'extracted', ref:'sources/<source_id>'}` 자동 주입. v3Meta.record=null (bytes 못 읽음) 이면 skip. MVP — inferred/ambiguous 는 Phase 5 §5.4 canonicalize output 확장과 함께.
  - `index.ts`: injectProvenance + ProvenanceType + ProvenanceEntry export.
- **§4.3.3 stripBrokenWikilinks source 페이지 본문 재후처리** 완료
  - Phase 3 §14.5 OMRON 261건 한국어 wikilink 수동 cleanup 회귀선.
  - `ingest-pipeline.ts`: canonicalize 완료 후 + Stay-involved Preview 모달 호출 이전 지점에 `stripBrokenWikilinks(parsed.source_page.content, keepBases)` 삽입. keepBases = entity/concept/source 페이지 filename normalized base Set. canonical 페이지에 없는 wikilink 는 plain text 로 강등.
  - Preview/저장본 bit-identical 보장 (plan v2 §5.2 self-review #3 결과).
- 증거: wikey-core 434 → **437 PASS (+3)** · `npm run build` 0 errors (tsc + esbuild) · `validate-wiki.sh` + `check-pii.sh` PASS.
- 참조: `activity/phase-4-result.md §4.3`, `plan/phase-4-todo.md §4.3.2 Part A + §4.3.3 (전량 [x])`, `plan/session-wrap-followups.md` top-block session 3, `plan/phase-4-todox-4.3-plan.md` v2 전체.
- 다음 세션 진입점: Part B (source-resolver + query-pipeline citations + sidebar-chat 답변 렌더) + §4.3.1 (Stage 2/3 prompt override + settings UI) + 통합 smoke → Phase 4 본체 완성 선언.

## [2026-04-23] feat | §4.2 Stage 3+4 — LLM 분류 정제 + vault listener + startup reconcile

- **§4.2.8 Stage 3 (LLM 3/4차 분류 정제 · 모델 키 · UI · 피드백)** 완료
  - `classifyWithLLM` 프롬프트 4차 slug 힌트 inject: `wikiFS.list` → `^\d{3}_[A-Za-z0-9가-힣_\-]+$` 정규식 + basename 정규화 (Obsidian full-path/mock bare-name 대응). "재사용 우선, 신규 시 reason 에 '신규:' 명시" 규칙. vitest 5.
  - `CLASSIFY_PROVIDER` / `CLASSIFY_MODEL` 설정 키 — `resolveProvider('classify', cfg)` 추가. 미지정 시 ingest 승계, MODEL 만 override 가능. `wikey.conf` 주석 블록에 저가 모델 예시. vitest 4.
  - Audit 패널 "Re-classify with LLM" 체크박스 — `hint.needsThirdLevel === true` row 에만 노출. `inboxReclassify: Map` 로컬 상태. Apply 플랜 루프 분기.
  - CLASSIFY.md 피드백 로그 append (`wiki-ops.ts::appendClassifyFeedback`) — 파일/섹션 자동 생성 + 중복 dedupe. vitest 4.
- **§4.2.9 Stage 4 (Vault listener + Startup reconcile)** 완료 — §4.1.1.9 자동 해소
  - Pure helpers `wikey-core/src/vault-events.ts` 분리: `RenameGuard` (TTL 기반 double-move 방지), `reconcileExternalRename` (UI 이동 시 registry + frontmatter 동기화), `handleExternalDelete` (tombstone + banner). vitest 9.
  - `source-registry.reconcile` 확장: missing → tombstone, 재등장 → restore + recordMove, idempotent. vitest +4.
  - `wiki-ops.appendDeletedSourceBanner` — source 페이지 본문 최상단 `[!warning]` callout. frontmatter 보존 · idempotent. vitest 3.
  - `classify.ts::movePair` 에 `renameGuard?` optional 파라미터 추가 — 원본·sidecar rename 직전 pre-register.
  - `wikey-obsidian/src/main.ts` 이벤트 라우팅: `vault.on('rename')` 200ms debounce + sidecar 자동 동행 (fileManager.renameFile), `vault.on('delete')`, onload `runStartupReconcile` (`size ≤ 50MB` 필터).
  - `commands.ts::saveIngestMap` 에 1회 deprecation warn (`.ingest-map.json path-based API` → Phase 5 §5.3).
- **링크 안정성 회귀선** (사용자 2026-04-23 session 2 지적 2건 반영):
  1. movePair 경로 + reconcile 경로 모두 entity/concept 페이지의 source 페이지 wikilink (테스트 내 source-stable · source-extmv 를 내부 링크로 참조) + 본문 bit-identical 유지 확증. `integration-pair-move.test.ts` +2.
  2. Stage 4 real-disk 통합: `reconcileExternalRename` 실제 fs.renameSync 결합, `handleExternalDelete` 실제 unlinkSync 결합, multi-file 외부 이동·삭제·복원 + analyses 페이지 링크 불변, RenameGuard + movePair 실제 fs 통합. `integration-pair-move.test.ts` +4 real-disk.
- 증거: wikey-core 399 → **434 PASS (+35, Stage 3 13 + Stage 4 18 + real-disk integ 4)** · `scripts/tests/pair-move.smoke.sh` 6/6 · `npm run build` 0 errors (tsc + esbuild).
- 참조: `activity/phase-4-result.md §4.2.8 / §4.2.9 / §4.2.10`, `plan/phase-4-todo.md §4.2.3 / §4.2.4 (전량 [x])`, `plan/session-wrap-followups.md` top-block session 2.

## [2026-04-23] feat | §4.2 Stage 1+2 — URI/registry foundation + pair move + frontmatter rewrite

- 계획: plan v1→v2→v3 진화 (codex rescue 2차 검증 FAIL gate 6 concern 전부 반영). URI 저장 폐기, `source_id` + `vault_path` 만 저장, URI 는 view-time derive. 번들 id 는 내부 relative path 기반. 64-bit prefix + full-hash verify. bash 가 node CLI 로 registry 즉시 갱신. 계획서: `plan/phase-4-todox-4.2-plan.md`.
- 신규 모듈: `wikey-core/src/uri.ts` (computeFileId/BundleId/ExternalId, buildObsidian/FileUri, verifyFullHash, sidecarVaultPath), `source-registry.ts` (CRUD + findByIdPrefix full-hash verify + reconcile walker).
- frontmatter: `wiki-ops.ts` 에 `injectSourceFrontmatter` (비관리 키 보존) + `rewriteSourcePageMeta` (post-move patch). `ingest-pipeline.ts` 가 `buildV3SourceMeta` 헬퍼로 bytes 에서 id/hash 계산 → frontmatter 주입 + registry upsert.
- 이동: `classify.ts::movePair` (registry 경유 + post-move frontmatter rewrite, 6 케이스 + 원자성). plugin `commands.ts` autoMoveFromInbox · `sidebar-chat.ts` Audit Apply 둘 다 `movePair` 전환.
- bash: `scripts/registry-update.mjs` 신규 CLI (`--record-move/delete/find-by-*`, atomic write). `classify-inbox.sh --move` 가 pair + registry CLI 호출. `lib/classify-hint.sh` 에 `(+ sidecar)` 표시.
- migration: `scripts/migrate-ingest-map.mjs` (no-op 현재) + `scripts/measure-determinism.sh` registry cleanup 블록 교체.
- 테스트: 352 → **399 PASS (+47)**. uri 17 + source-registry 12 + wiki-ops +7 + move-pair 8 + integration 3. bash smoke 6/6. `npm run build` 0 errors.
- Stage 3 (LLM 3/4차 분류 정제) · Stage 4 (vault listener + startup reconcile) 다음 세션. 호환성: `wiki/sources/` 비어있음 + `.ingest-map.json` 없음 → 마이그레이션 무작업.

## [2026-04-22] reset | 초기화 — §4.1.3 실험 baseline 확보

- raw/: PMS_제품소개_R10_20220815.pdf 만 raw/0_inbox/ 에 남김, 나머지 PARA 하위 모두 raw/_delayed/ 로 이동
- wiki/: entities/concepts/sources/analyses 모두 삭제, index.md / log.md / overview.md 초기 템플릿으로 리셋, .ingest-map.json 삭제
- 캐시: ~/.cache/wikey/convert/ 무효화
- 목적: §4.1.3 (Bitmap OCR 본문 오염 차단 + 검증 모듈 설계 확장) 실험의 깨끗한 baseline 확보. `plan/phase-4-todox-4.1.3-bitmap-ocr-fix.md` 참조.

## [2026-04-22] fix | §4.1.3.1~3 Bitmap OCR 본문 오염 차단 (TDD)

- `wikey-core/src/ingest-pipeline.ts`: `buildDoclingArgs` mode 파라미터 (`DoclingMode = 'default' | 'no-ocr' | 'force-ocr'`). `doclingMajorOptions` 에 `mode` 필드. Tier 1 은 docling 기본값 유지 (사용자 원칙 "기본값 → 검증 → escalation"). `extractPdfText` 에 `retry-no-ocr` 분기 → Tier 1a (`--no-ocr`) 재시도 + score 비교 후 채택 (false positive 방어).
- `wikey-core/src/convert-quality.ts`: 5번째 signal `hasImageOcrPollution` (필터 `bodyChars ≥ 2000` + `markers ≥ 5`, 기준 A 마커 ±5 window 내 <20자 라인 3연속 OR 기준 B 전체 <20자 파편 비율 > 50%). `scoreConvertOutput` decision 에 `'retry-no-ocr'` 추가, score −0.4. 우선순위 `koreanLoss > pollution > score`.
- 영향 파일: convert-quality.ts · ingest-pipeline.ts · `__tests__/convert-quality.test.ts` · `__tests__/ingest-pipeline.test.ts`.
- 테스트: 315 → **335 PASS** (+20). 빌드 0 errors.

## [2026-04-22] eval | §4.1.3.4 Tier chain 4 코퍼스 회귀 + sidecar md 저장

- 스크립트: `scripts/benchmark-tier-4-1-3.mjs` (신규). `wikey-core/dist/convert-quality.js` 재활용.
- 대상: PMS / ROHM / RP1 / GOODSTREAM 4 코퍼스 (OMRON/TWHB 는 실행 시간 이유로 제외).
- 결과 (`activity/phase-4-resultx-4.1.3-benchmark-2026-04-22.md`):
  - PMS: Tier 1 retry-no-ocr → Tier 1a `1a-docling-no-ocr` accept — lines **1922 → 532 (−72%)**, score 0.53 → 0.91. koreanChars 18,654 → 15,549 (OCR 파편 3,105자 제거).
  - ROHM: Tier 1 retry (koreanLoss) → Tier 1b force-ocr accept (기존 경로 유지).
  - RP1, GOODSTREAM: Tier 1 accept.
- Sidecar `.md` 4 개 생성 (원본 옆).

## [2026-04-22] fix | §4.1.3 sidecar 저장 정책 수정 — 원본.md = 이미지 포함 raw

- 사용자 설계 확정: **원본.pdf → 원본.md (이미지 포함 raw) → LLM투입용.md (stripped, 메모리 전용)**. 파일시스템에 남는 것은 원본.pdf + 원본.md. stripped 는 wiki 생성 후 사라짐.
- 이전 구현은 stripped (LLM 투입용) 을 sidecar 로 저장. 원본 이미지가 소실되는 문제.
- 변경:
  - `wikey-core/src/ingest-pipeline.ts::extractPdfText::finalize` — sidecar 를 **raw md (이미지 embedded)** 로 저장. stripped 는 cache + caller 반환 유지.
  - `ingest-pipeline.ts` ingest 함수의 sidecar 블록 (131-144) — `ext !== 'pdf'` 조건 추가. PDF 는 finalize 에서 raw 로 이미 저장됐으므로 stripped 로 덮어쓰기 차단. hwp/hwpx/docx/... 는 기존 로직 유지 (후속 작업에서 동일 정책 확장).
  - `scripts/benchmark-tier-4-1-3.mjs` — `{ md, raw }` 구조로 분리. analyze 는 stripped, sidecar 저장은 raw.
- 재실행 결과 (sidecar 크기 급증, 이미지 포함 확증):
  - PMS: 47,979 → **6,339,748 chars**
  - ROHM: 4,714 → **1,505,611 chars**
  - RP1: 236,858 → **1,897,465 chars**
  - GOODSTREAM: 453 → **599,454 chars**
- raw/ 하위 sidecar 는 `.gitignore` 의 `raw/` 규칙으로 자동 제외. docs/samples/ 하위 sidecar 만 git tracked.

## [2026-04-22] feat | §4.1.3 OCR engine fallback 등록 — engine 별 lang 자동 매핑

- 사용자 요청: "ocrmac 은 macOS 전용 → paddleOCR fallback 등록".
- docling 공식 source (`pipeline_options.py`) 확증된 engine 별 lang 형식:
  - ocrmac: BCP-47 (`ko-KR,en-US`)
  - rapidocr: 언어명 (`korean,english`) — paddleOCR 모델
  - easyocr: ISO 639-1 (`ko,en`)
  - tesseract/tesserocr: ISO 639-2 (`kor,eng`)
- 신규 export: `defaultOcrEngine()` — platform 별 (darwin → ocrmac, else → rapidocr).
- 신규 export: `defaultOcrLangForEngine(engine)` — engine 에 맞는 기본 lang 자동 선택.
- `buildDoclingArgs` / `doclingMajorOptions` 에서 `DOCLING_OCR_LANG` 명시 설정 없으면 engine 에 맞는 기본값 적용 (기존 ocrmac 고정 형식 오류 해소).
- `wikey.conf` 주석 업데이트 — platform fallback 동작 + engine 별 lang 형식 문서화.
- 테스트: 343 → **351 PASS** (+8: defaultOcrEngine 1, defaultOcrLangForEngine 5, engine-aware args 2).
- macOS 환경 실측: 기존 ocrmac + ko-KR,en-US 동일 결과 유지 (regression 없음).
- Linux/Windows 환경 실측은 다음 세션 — paddleOCR PP-OCRv5 Korean 모델 다운로드 + rapidocr CLI 경로 검증.

## [2026-04-22] fix | §4.1.3 sidecar — tier 기반 이미지 strip 분기 + source PDF scan 감지

- 사용자 명시: "스캔이미지로 판정되어 ocr 옵션이 들어가면 이미지가 필요없다" (30p 계약서 스캔 포함). "소규모 문서" 는 판정 기준 아님. 단 "한글 관련 문제는 다른 케이스" (ROHM 은 vector PDF diagram 유지 필요).
- `wikey-core/src/convert-quality.ts::hasRedundantEmbeddedImages(rawMd, strippedMd, pageCount, tierKey)`:
  - `isLikelyScanPdf = true` → strip (MD 기반 fallback)
  - tierKey `1b-docling-force-ocr-scan` → strip (scan 원인 OCR)
  - tierKey `1-docling-scan` → strip (Tier 1 accept 이지만 source PDF 가 scan, GOODSTREAM/CONTRACT)
  - tierKey `1b-docling-force-ocr-kloss` → **유지** (한글 공백 소실 원인, vector PDF diagram)
  - tierKey `1a-docling-no-ocr` → 유지 (pollution escalation)
  - tierKey `1-docling` → 유지 (기본 vector PDF)
- `extractPdfText` Tier 1b 채택 시 tierKey suffix 분기: `tier1bKey = isScan ? '...-scan' : '...-kloss'`.
- **Source PDF scan 감지** (근본 수정, 2026-04-22): MD 기반 `isLikelyScanPdf` 가 docling bitmap OCR 결과를 입력받아 GOODSTREAM 같은 "기존 OCR 저장 스캔본" 을 놓침. pymupdf 로 페이지 대비 **최대 이미지 면적 비율** 직접 측정. `scanRatioBySource > 0.5` → `isScanBySource=true`. Tier 1 accept + source scan 이면 `tierKey = '1-docling-scan'` 로 설정해 sidecar strip.
- `benchmark-tier-4-1-3.mjs` 도 동일 로직 + `getScanRatioBySource()` helper.
- 테스트 340 → **343 PASS** (+3: tier 분기 2 + `1-docling-scan` 1).
- **실측 5 코퍼스 매핑**:
  - PMS (scan 0%) → `1a-docling-no-ocr` raw
  - ROHM (scan 0%) → `1b-docling-force-ocr-kloss` raw (diagram 유지)
  - RP1 (scan 0%) → `1-docling` raw
  - GOODSTREAM (scan **100%**, 1p 사업자등록증) → `1-docling-scan` **stripped 453 chars** ✓
  - CONTRACT (scan **100%**, 6p 용역계약서, bodyChars 8114 — 소규모 아님) → `1-docling-scan` **stripped 8114 chars** ✓
- bodyChars 임계 의존성 제거 — "소규모는 판정 기준 아님" 사용자 명시 충족.

## [2026-04-22] eval | §4.1.3.5 PMS 10-run determinism (clean MD baseline)

- 실행: `./scripts/measure-determinism.sh raw/0_inbox/PMS_제품소개_R10_20220815.pdf -n 10 -d -o activity/phase-4-resultx-4.1.3.5-pms-10run-clean-2026-04-22.md`
- 10/10 success, 평균 252.6s/run, 총 약 42분.
- **Total CV 10.3%** (mean 42.20, range 36–46, 분포 {36, 44, 46} 3 값으로 양자화)
- **Entities CV 2.3%** (mean 22.60, range 22–23) — 거의 결정적. 29-run 11.1% 대비 대폭 개선.
- **Concepts CV 24.6%** (mean 18.60, range 12–22) — 29-run 27.0% 대비 소폭 개선. PMBOK 9 영역 추출이 일부 run 에서만 포함되는 진동 여전.
- Core entities 19/27 (70%), Core concepts 11/22 (50%).
- 재해석:
  - 깨끗한 MD 에서도 §4.5.1.6 29-run 9.2% (오염) 와 거의 동일 (10.3%) → **canonicalizer 3차 확장이 실제 legitimate variance 를 잡았음** 확증 (OCR 파편 흡수가 주효과였다면 clean MD 에서 CV 가 훨씬 더 낮아야).
  - 잔여 variance 는 **Concepts PMBOK 9 영역 추출 진동** 이 주원인 (Entities 는 2.3% 거의 결정적).
- 판정: CV 10.3% 는 §4.5.1.7 gate "5–10%" 와 ">10%" 경계. **§4.5.1.7.2 (Concepts prompt, PMBOK 9 영역 강제 나열)** 은 필수. §4.5.1.7.1 (attribution), §4.5.1.7.5 (Lotus variance) 등은 재평가 (Entities CV 2.3% 면 Lotus 진동 자동 해결 가능성 높음).
- 산출물: `activity/phase-4-resultx-4.1.3.5-pms-10run-clean-2026-04-22.md`.

## [2026-04-22] feat | §4.5.1.7.2 + §4.5.1.7.3 코드 구현 완료 — 실측 대기

- **§4.5.1.7.2** (`wikey-core/src/canonicalizer.ts`): `buildCanonicalizerPrompt` "작업 규칙" 7번 항목 신규 — PMBOK / 프로젝트 관리 지식체계 맥락이 본문에 등장할 때 PMBOK 10 knowledge areas (`integration / scope / schedule (or time) / cost / quality / resource (or human-resource) / communications / risk / procurement / stakeholder`) 을 각각 `project-<area>-management` 개별 concept 로 추출, 상위 `project-management-body-of-knowledge` 로 묶지 말 것, type=`methodology`, "본문에 직접 언급되지 않으면 추출하지 않는다" hallucination guard 포함. A안 채택 (B=false-positive 위험, C=wiki 그래프 가치 역행).
- 단위 테스트 신규 (`canonicalizer.test.ts`): prompt 문자열 anchor — rule marker + 8 슬러그 + anti-bundle + hallucination guard 모두 present 단언. 352/352 PASS (+1), tsc 0 errors.
- **§4.5.1.7.3** (`scripts/measure-determinism.sh`): `restoreSourceFile()` → `Promise<boolean>` 전환, `.`-prefix 디렉토리 스킵, 실패 시 run 에러 명시 기록 (run 30 outlier 재현 차단). per-run timeout 10분 → 15분 (JS `15*60*1000` + bash `timeout_sec=$((N_RUNS*900))`). `--strict` CLI 플래그 신규 — `total=0` run 을 통계에서 추가 제외, Markdown 에 "Strict 제외 run (total=0)" 섹션으로 원본 보존. banner + `--help` 문구 동기.
- 검증: `bash -n` syntax OK, Python heredoc `ast.parse` OK, JS heredoc `node --check` (async IIFE wrap 후) OK.
- 덤: master에 존재하던 `hasRedundantEmbeddedImages(md, stripped, pdfPageCount)` arity 버그 (`bb09b79` 커밋이 `convert-quality.ts` 에만 4번째 `tierKey` 추가, `ingest-pipeline.ts:1194` 호출부 미갱신) 도 `tierKey` 인자 전달로 복구. 해당 커밋의 "343 tests PASS, tsc 0 errors" 주장은 실제로 성립하지 않고 있었음.
- **실측 대기**: §4.5.1.7.2 효과 검증 (PMS 5-run 재측정, Concepts CV 24.6% → <15% 목표) 은 Obsidian CDP 세션에서 후속. §4.5.1.7.3 robustness 는 다음 측정 세션에서 자동 회귀.
- 참조: `activity/phase-4-result.md §4.5.1.7.2 / §4.5.1.7.3` (구현 완료 + 실측 대기 로 전환), `plan/phase-4-todo.md §4.5.1.7.2 [~]` / `§4.5.1.7.3 [x]`, `plan/session-wrap-followups.md` 최상단 블록.

## [2026-04-22] refactor | Phase 4/5/6 재편 — 본체 완성 정의 확정

- **본체 정의**: 원본 → wiki ingest 프로세스가 완성되어 더 이상 wiki 를 초기화하거나 재생성할 일이 없는 상태. frontmatter/데이터 모델/워크플로우 구조가 고정되고 이후 내용은 축적되지만 구조는 변경되지 않는다.
- **Phase 4 (본체)** 유지: §4.0/§4.1 완료 · §4.2 분류+URI · §4.3 인제스트 본체 (3-stage prompt override / Provenance tracking / stripBrokenWikilinks) · §4.5.1 결정성 (§4.5.1.7.2/7.3 실측 대기) · §4.5.2 본체 운영 안전 (삭제 안전장치 + 초기화).
- **Phase 5 신규** (`plan/phase-5-todo.md`): 튜닝·고도화·개선·확장 스코프. §5.1 검색 재현율 / §5.2 지식 그래프·시각화 / §5.3 증분 업데이트 / §5.4 variance diagnostic / §5.5 성능·엔진 확장 / §5.6 표준 분해 self-extending (현재 §4.5.1.7.2 PMBOK 하드코딩이 §5.6 Stage 0 사전 검증) / §5.7 운영 인프라 포팅. `activity/phase-5-result.md` skeleton 신규.
- **Phase 6** (`plan/phase-6-todo.md`, 기존 `phase-5-todo.md` 에서 rename): 웹 인터페이스 전체 이관. §6.1 프론트엔드 / §6.2 백엔드 API / §6.3 배포.
- **판정 뒤집힌 1 항목**: §4.3.2 Provenance tracking 은 frontmatter 에 `provenance` 필드 신규 추가 = data model 변경 → Phase 5 로 미루면 wiki 재생성 유발 → **Phase 4 본체에 유지 확정**.
- **wiki 에 철학 선언 정식 등재**: `wiki/analyses/self-extending-wiki.md` 신규 — "LLM Wiki 의 self-extending 지향" analysis 페이지. Stage 0~4 현 상태 + 경계 (무엇이 self-extension 이 아닌가) + 왜 wiki 에 기록하는가 명문화. `wiki/index.md` 분석 섹션에 등재.
- **기록 책임 (drift 방지)**: 실행 로드맵 단일 소스 = `plan/phase-5-todo.md §5.6`. 철학 선언 단일 소스 = `wiki/analyses/self-extending-wiki.md`. `wikey-core/src/canonicalizer.ts` 주석 · `activity/phase-4-result.md §4.5.1.7.2` 일반화 단락 · `plan/session-wrap-followups.md` · memory 는 모두 포인터.
- 참조: `plan/phase-4-todo.md` 상단 "Phase 5/6 이관 맵", `plan/phase-5-todo.md` 전문, `plan/phase-6-todo.md` 전문.

## [2026-04-22] session-wrap | 세션 마무리 — §4.5.1.7.2 [x] 전환 + 문서 동기화

- **§4.5.1.7.2 [~] → [x]** 로 전환 확정. 이유: 코드 deliverable (canonicalizer prompt rule + 단위 테스트 anchor + 352 tests PASS) 는 완료됐고, Concepts CV <15% 효과 검증은 Phase 5 §5.4 variance diagnostic 측정에서 자연 회귀하므로 §4.5.1.7.2 자체의 완료 판정에 영향 없음. Phase 4 본체 완료 판정과 독립.
- **2026-04-22 세션 전체 요약** (커밋 3 개):
  1. `f9299e1` feat(phase-4.5.1.7) — §4.5.1.7.2 canon PMBOK 10 hint + §4.5.1.7.3 measure robustness + 덤 master arity regression 복구 (352 tests).
  2. `17d46d2` refactor(phases) — Phase 4/5/6 재편 (본체 정의 확정, §4.3.2 Provenance 본체 복귀, 11 항목 Phase 5 이관, 기존 Phase 5 → Phase 6, `wiki/analyses/self-extending-wiki.md` 정식 등재).
  3. (이번 커밋) session-wrap — §4.5.1.7.2 [x] 전환 + followups/memory/log 톤 통일 ("실측 대기" → "Phase 5 §5.4 자연 회귀").
- **Phase 4 본체 다음 진입점**: §4.2 URI + LLM 3/4 차 분류 → §4.3 본체 인제스트 (3-stage prompt override + Provenance tracking frontmatter + stripBrokenWikilinks) → §4.5.2 운영 안전 (삭제 안전장치 + 초기화) → **Phase 4 본체 완성 선언** → Phase 5 착수.
- 참조: `plan/session-wrap-followups.md` 최상단 블록 갱신, `activity/phase-4-result.md §4.5.1.7.2` "효과 검증 위임" 단락, `plan/phase-4-todo.md §4.5.1.7.2 [x]`, memory `project_phase4_status.md` + `MEMORY.md`.

## [2026-04-22] docs | §4.3.2 범위 확장 — 쿼리 응답 원본 backlink 렌더링 (Part B)

- 사용자 질문: 대화창 답변에 wiki 페이지 링크는 걸리는데 **원본 (raw/ 소스) 에 대한 backlink** 도 걸렸으면 좋겠다. 어느 단계에서 하는 게 좋은가?
- 판정: **Phase 4 §4.3.2 Provenance tracking 에 Part B 로 포함**. data model (frontmatter `provenance`) 과 쿼리 응답 렌더링은 같은 의미론 단위 — 본체 완료 선언 시점에 "근거 체인이 원본 파일까지 닿는 citation UX" 를 갖춰야 본체 정의와 정합.
- 철학 점검 (사용자 `llm-wiki-kor.md` + `wikey.schema.md` 기준): **위배 없음**. citation/provenance 강화 방향, raw/ 불변성 영향 없음 (읽기 링크만), 3 계층 분리 영향 없음. 현재도 `wiki/sources/source-*.md` 본문에 원본 경로가 `> 원시 소스:` 라인으로 이미 명시되어 있어 data flow 는 존재 — Part B 는 답변 → wiki → source → 원본 3-hop 을 답변 → 원본 1-hop 으로 단축하는 UX 개선.
- 가드: wikilink 주 링크, 원본 📄 보조 링크 (약한 affordance). wiki 계층 우회 습관 방지 위해 CSS/레이아웃 제약. `wiki/analyses/self-extending-wiki.md` 의 "경계" 단락과 같은 궤.
- §4.3.2 신규 3 체크박스: (a) `query-pipeline.ts` citations 구조화 반환, (b) `source-resolver.ts` (source_id → current_path/uri/mime_type 해석), (c) `sidebar-chat.ts` 응답 렌더링 (내부/외부/tombstone 클릭 핸들러). + 철학 가드 한 줄.
- 선결: §4.2.2 source-registry + §4.3.2 Part A frontmatter `provenance`.
- 참조: `plan/phase-4-todo.md §4.3.2` (Part A + Part B 분리 기록), `plan/session-wrap-followups.md` 최상단 블록, memory `project_phase4_status.md` description.
