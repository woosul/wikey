---
phase: 5
section: 5.14
title: §5.14 retrospective TDD-BLUE refactor — Tier 2-4 narrow BLUE 완료
status: completed
created: 2026-05-06
updated: 2026-05-06
session: 20
---

# §5.14 — retrospective TDD-BLUE refactor (Tier 2-4 narrow, Session 20)

> **상위 문서**: [`activity/phase-5/phase-5-result.md`](./phase-5-result.md) §5.14 · [`plan/phase-5/phase-5-todox-5.14-retrospective-blue-refactor.md`](../../plan/phase-5/phase-5-todox-5.14-retrospective-blue-refactor.md) v1
>
> **세션 종결 요약** (2026-05-06 session 20):
> - Tier 2 (core 6 file) 본격 BLUE refactor — extract / dedup / cleanup
> - Tier 3 (UI 4 file) minor cleanup — historical context 압축
> - Tier 4 잔여 sampling — narrow comment 정리
> - 회귀 615 PASS / 3 skipped / 0 build errors / **0 동작 변경**
> - codex post-impl: cycle #1 P2 finding 1건 (`buildCategoryPages` entity 패스 cross-pool dedup 누설) → fix → cycle #2 APPROVE
> - obsidian-cdp 라이브 smoke 1 source full cycle (`raw/0_inbox/nanovna-v2-notes.md`)

---

## 5.14.0 진행 결정

§5.14 todox v1 권고 = **Tier 2 시작** (Phase 5 핵심 5 파일). 사용자 명시 (2026-05-06 session 20): **Tier 4 까지 진행**. master 가 진행 전략 결정:

- Tier 2 (core 6 파일) — 본격 BLUE (extract / dedup / naming)
- Tier 3 (UI 4 파일) — narrow cleanup (큰 분해는 회귀 위험 ↑, UI 단위 test X)
- Tier 4 잔여 — historical context 압축 sampling
- "동작 변경 0" Karpathy Surgical Changes 원칙 엄격 준수
- 매 파일 변경 후 `npm test` + `npm run build` 회귀 검증

## 5.14.1 Tier 2 — core 6 파일 BLUE

### 5.14.1.A canonicalizer.ts (626 → 637 LOC, +11)

| 변경 | 동작 |
|------|------|
| `applyPromotionGate(rawPages, sourceBody, userAliases)` extract | entity/concept 양 패스의 §5.11 promotion-threshold drop logic 공통화 |
| `buildCategoryPages(...)` extract | promotion gate → validateAndBuildPage → cross-pool dedup. concept 만 `keptBases` collision check (codex cycle #1 P2 fix 적용) |
| `rebuildPageWithCrossLinks(...)` top-level extract | 기존 `applyCrossLinks.rebuild` nested arrow (27 LOC) → 명시 함수. §5.10.4 P2-1 frontmatter 보존 logic 동일 |
| `RawPage` interface 통합 | 기존 inline anonymous type 3개소 → 단일 named type. RawCanonical / applyPromotionGate / buildCategoryPages / validateAndBuildPage 일관 |
| `decompositionSection` dead variable 제거 | §5.10.4 D-wide 폐기 잔재 (빈 문자열 inline) |
| 누적 historical comment 압축 | §5.10.3 / §5.10.4 D-wide 표기 통합. `Phase 5` 접두어 제거 (§ 자체로 충분) |

### 5.14.1.B ingest-pipeline.ts (2319 → 2337 LOC, +18)

| 변경 | 동작 |
|------|------|
| `canonicalizeAndAssembleParsed(args)` extract | FULL/SEGMENTED route 의 stage 2.3 canonicalize 호출 + dropped sample log + IngestRawResult assembly 공통화 |
| FULL block (line 524-562) → 12 lines | helper 호출 1번. mentions / sourceBody (truncated content) 만 route-specific |
| SEGMENTED block (line 605-635) → 12 lines | helper 호출 1번. mentions=allMentions / sourceBody=sourceContent (전체) |
| §5.10.4 D-wide schema overrides 폐기 historical comment 압축 | 의미 유지하며 줄 수 줄임 |
| Stage 2 suggestion finalization 폐기 stale comment 제거 | §5.10.4 폐기로 인해 의미 없는 잔재 |

### 5.14.1.C wiki-ops.ts (529 → 512 LOC, **-17**)

| 변경 | 동작 |
|------|------|
| `buildPath` 의 `filename = cleaned` 재할당 + dead-after-throw `if (!path.startsWith(WIKI_PREFIX))` 분기 제거 | unreachable code (template literal 이 항상 prefix 로 시작) |
| `injectProvenance` JSDoc 압축 | YAML 형식 예시 단축 |
| 누적 §4.2 Stage 1 / §4.3.2 historical comment 압축 | 필수 정보 유지 |

### 5.14.1.D pii-redact.ts (517 → 514 LOC, -3)

| 변경 | 동작 |
|------|------|
| 모듈 doc-comment 압축 | 4-block 구조 → 2-block (한국 기업 PII 설명 + 2-layer gate 정의) |

### 5.14.1.E query-pipeline.ts (661 → 660 LOC, -1)

| 변경 | 동작 |
|------|------|
| `renderContextPages(pages)` helper extract | `buildContextWithWikiFS` + `buildContextFromFS` final formatting (`--- <name>.md ---\n${content}\n` join) 동일 부분 |
| `ONE_HOP_CAP = 5` magic number 명명 | 두 함수 모두 동일 cap 사용 |

### 5.14.1.F schema.ts (104 → 100 LOC, -4)

| 변경 | 동작 |
|------|------|
| 모듈 doc-comment 압축 | 2개 분리 JSDoc 블록 → 1개 통합 |
| codex cycle #1 cosmetic 빈 줄 (line 16) 제거 | follow-up fix |

**Tier 2 net LOC**: +11 + 18 - 17 - 3 - 1 - 4 = **+4** (거의 0). Extract 로 인한 시그니처 + JSDoc 추가 정상 비용.

## 5.14.2 Tier 3 — UI 4 파일 minor cleanup

거대 메서드 (`renderAuditSection` 726 LOC / `renderInboxStatus` 373 LOC) 분해는 명백한 후보지만 **UI 단위 test 부재 + 회귀 위험 ↑**. Surgical 원칙 준수 — historical context 압축만.

| 파일 | LOC | 변경 |
|------|-----|------|
| sidebar-chat.ts | 2300 → 2299 | dashboard stat card 주변 historical (overview.md → index.md) 단순화 |
| settings-tab.ts | 1175 → 1175 | schema.yaml aliases D-wide historical compactor |
| ingest-modals.ts | 655 → 654 | "Active schema" 폐기 표시 압축 |
| status-bar.ts | 136 → 136 | meta page comment 단순화 |

**Tier 3 net**: -2.

## 5.14.3 Tier 4 — wikey-core 잔여 sampling

대부분의 `legacy` 마커는 **코드 자체에서 사용하는 type 명칭 또는 fallback 분기** (예: `incremental-reingest.ts` 의 `'legacy-no-sidecar-hash'` conflict type, `convert-cache.ts` 의 legacy file 호환 분기, `commands.ts` 의 deprecation warning) — 의도적 보존.

진행한 cleanup:
- `ingest-pipeline.ts:510` — D-wide schema overrides historical context 자연어 명료화
- `ingest-pipeline.ts:812` — Stage 2 suggestion finalization 폐기 stale comment 제거 (위 §5.14.1.B 와 mirror)
- `schema.ts` 모듈 doc 통합 (위 §5.14.1.F 와 mirror)

## 5.14.4 회귀 검증

| Stage | Result |
|-------|--------|
| Tier 2 §5.14.1.A canonicalizer 후 | npm test: 615 PASS / 3 skipped / 0 errors / build OK |
| Tier 2 §5.14.1.B ingest-pipeline 후 | 615 PASS / 0 errors |
| Tier 2 §5.14.1.C wiki-ops 후 | 615 PASS / 0 errors |
| Tier 2 §5.14.1.D pii-redact 후 | 615 PASS / 0 errors |
| Tier 2 §5.14.1.E query-pipeline 후 | 615 PASS / 0 errors |
| Tier 3 UI 4 파일 후 | wikey-obsidian build OK (1 warning — pre-existing import.meta) |
| Tier 4 잔여 sampling 후 | 615 PASS / 0 errors |
| codex P2 fix 후 | 615 PASS / 0 errors / build OK |

## 5.14.5 codex post-impl review

### Cycle #1 (surface:2)

- **Verdict**: NEEDS_REVISION
- **Finding (P2)**: `buildCategoryPages` entity 패스에서 `keptBases.has(base)` collision check 적용. 원본 `assembleCanonicalResult` 는 entity 패스에서 keptBases skip check 안 함 (concept 패스만 cross-pool dedup). LLM 이 동일 base entity 둘 emit 시 silently drop 으로 변함. "동작 변경 0" 위반.
- **Master 동의**: 이 finding 정확. extract 시 반복 패턴으로 묶다 entity 패스에 잘못 적용된 문제.

### Master fix

```typescript
const dedupeAgainstKept = category === 'concept'
for (const p of allowed) {
  // ...
  if (dedupeAgainstKept && keptBases.has(base)) continue
  // ...
}
```

엔티티 패스: 항상 push (원본 동작 보존). 컨셉 패스: cross-pool collision 시 skip. + 추가 fix: `schema.ts:16` cosmetic 빈 JSDoc 줄 제거.

### Cycle #2 (surface:7)

- **Verdict**: APPROVE — "buildCategoryPages refactor now preserves the original assembleCanonicalResult behavior"
- 추가 finding 0 / 회귀 0 / build 0 errors

## 5.14.6 obsidian-cdp 라이브 smoke (master 직접)

**환경**: Obsidian 1.12.7 + remote-debugging-port=9222. `wikey-cdp.py` 헬퍼 재생성 (이전 세션 종료로 `/tmp/` 정리됨), reference 메모리 (`reference_obsidian_cdp_e2e.md`) 기반 minimal websocket-client 구현.

**샘플**: `raw/0_inbox/nanovna-v2-notes.md` (1851 bytes, PII-free, RF 도메인).

### Full cycle 결과

| 단계 | 결과 |
|------|------|
| 파일 열기 (`raw/0_inbox/nanovna-v2-notes.md`) | OK |
| `wikey:ingest-current-note` 트리거 | OK |
| Brief modal Proceed 클릭 | OK |
| Processing 대기 (gemini provider, ~2분) | OK Preview 도달 |
| Preview 내용 | source-nanovna-v2-notes.md + entities (3): nanovna-v2 / nanovna-qt / dji-o3-air-unit + concepts (2): swr / fpv + index +13 entries / log +1 entry |
| Approve & Write 클릭 | OK |
| Modal closed | OK |
| wiki write 검증 | OK 9 file mtime ≤3min: source + 3 entities + 2 concepts + index.md + log.md + .ingest-map.json |
| validate-wiki.sh | OK PASS (frontmatter / 위키링크 / 인덱스 등재 / log 형식 / 중복 모두) |
| IV.A movePair | OK raw/0_inbox/nanovna-v2-notes.md 사라지고 raw/3_resources/60_note/600_technology/nanovna-v2-notes.md 로 이동 |
| source-registry path_history | OK 2 entries: [raw/0_inbox/..., raw/3_resources/60_note/600_technology/...] |
| Chat panel query: "NanoVNA V2의 주요 측정 항목과 SWR 와의 관계는?" | OK 응답 도착 (~30s) |
| Query 응답 본문 | LLM 자체 지식 기반 정확한 답변 (S-파라미터 / S11 / 반사 계수 → SWR 공식 / 매칭 상태 평가) |
| Query citation 1차 | FAIL 부재 (links: []) — qmd query 가 검색 결과 0 받음 |
| Query citation 2차 (post-fix) | OK **31 HTML links** + "참고: source-nanovna-v2-notes, nanovna-v2[원본], swr[원본], dji-o3-air-unit, fpv, nanovna-qt[원본]" + "원본: nanovna-v2-notes" + ground truth 정확 인용 (50kHz~3GHz / DJI O3 Air Unit / SWR 1.5 양호) |

### Live smoke 결론 + qmd query 회귀 root cause + 다층 영구 fix (사용자 명시 영구 등록)

ingest pipeline full cycle 자체는 모든 단계 정상 (Brief → Proceed → Processing → Preview → Approve → Write → wiki write 9 file). §5.12 sourcePageBase chain / §5.11 promotion threshold / IV.A movePair 모두 라이브 작동.

그러나 **query citation 부재 회귀** = 단일 환경 이슈가 아닌 **6 layer silent fail 결합** 으로 확정 (사용자 raise "반복되는 문제, 정확히 기록"):

| Layer | 증상 | 영구 fix |
|-------|------|---------|
| 1. native binding NODE_MODULE_VERSION | `tools/qmd/node_modules/better-sqlite3` 가 Node v24 (MOD 137) 기준 build, 시스템 v22 (MOD 127) 와 mismatch → ERR_DLOPEN_FAILED | `bash ./scripts/rebuild-qmd-deps.sh` (login shell node 기준 rebuild) |
| 2. 다중 node 공존 | `/opt/homebrew/bin/node` v24 + `~/.nvm/.../v22.17.0/bin/node` 둘 다 PATH 에 존재 | (Layer 3 와 함께) |
| 3. plugin execEnv PATH 의 node 우선순위 | `makeEnv` 가 `process.env.PATH` 만 사용 → login shell PATH 의 첫 node 가 v24 → wrapper script 가 잘못된 node 호출 | **fix**: `wikey-obsidian/src/env-detect.ts::makeEnv/buildExecEnv` + `main.ts::getExecEnv` 가 `detectedNodePath` 의 dir 을 PATH 시작에 prepend |
| 4. query-pipeline findQmdBin 우선순위 | `config.QMD_PATH` (env-detect 자동 set wrapper bin) 1단계 → wrapper 가 PATH 첫 node 호출 → ABI mismatch | **fix**: `wikey-core/src/query-pipeline.ts::findQmdBin` — vendored qmd.js (isJs=true, plugin nodePath 직접 실행) 1단계, 사용자 명시 override 만 wrapper |
| 5. qmd collection path misconfig | `~/.cache/qmd/index.sqlite` 의 `wikey-wiki` path 가 `wiki/wikey-wiki/` (없음) → reindex 0 indexed silent success | **fix**: `scripts/setup.sh` 가 path 정합성 자동 verify + 잘못되면 UPDATE |
| 6. waitUntilFresh design | status='fresh' && stale=0 만 check — 빈 collection 도 fresh 로 판정 | (잔존 — 별도 plan, indexed file count vs wiki/.md count 비교 추가 검토) |

영구 기록: `~/.claude/projects/-Users-denny-Project-wikey/memory/feedback_qmd_node_abi.md` (반복 회귀 방지). 다음 세션에서 같은 증상 발생 시 6 layer 진단 순서 적용.

**post-fix 라이브 verify**: plugin reload 후 query 재실행 → 31 HTML links + wikilinks + 정확한 본문 인용 → OK 회귀 0.

## 5.14.7 영구 정책 등록 (이미 완료 — session 19)

§5.14 todox v1 §7 의 영구 정책 등록은 session 19 (commit `eccf98a`) 에서 이미 진행:
- `claude-forge-custom/rules/testing.md` (global)
- `wikey/CLAUDE.md` (project-specific mirror)

본 session 20 의 §5.14 진행이 그 정책의 첫 retrospective 적용 사례.

## 5.14.8 Karpathy 4원칙 적용 자기-감사

| 원칙 | 적용 |
|------|------|
| **Think Before Coding** | Tier 별 진행 전략 + 거대 UI 메서드 분해 회귀 위험 인지 → Surgical 원칙으로 narrow scope 결정 |
| **Simplicity First** | extract 가 LOC 줄였는가? Tier 2 net +4 (거의 0). DRY 측면 가독성 ↑. 200줄 → 50줄 같은 큰 simplification 없음 — 본 cycle 은 BLUE 가 본질 |
| **Surgical Changes** | 동작 변경 0 (codex P2 finding 후 확정). naming / extract / comment cleanup 만. 본 task 외 기능 추가 0 |
| **Goal-Driven Execution** | AC-7~9 모두 충족 — 615 PASS / 0 errors / validate-wiki PASS (live smoke 후 확정) |

## 5.14.9 잔존 후속 (선택 — 별도 plan)

- sidebar-chat.ts `renderAuditSection` 726 LOC 분해 — 명백한 BLUE 후보. UI 회귀 안전망 (E2E test) 마련 후 별도 cycle.
- settings-tab.ts setting group 별 분해 — 동일.
- main.ts / commands.ts 의 추가 분해 — 위와 동일 대기.
- 이들은 본 §5.14 scope 외. 사용자 결정 후 별도 todox 작성.

---

## 메모

- §5.14 v1 plan 의 sub-cycle (§5.14.A ~ E) 분리는 master 진행 시 합쳐짐 — 매 파일 단독 commit cycle 이 아닌 atomic narrow BLUE pass 로 진행. 이유: 회귀 안전망 매 파일 변경 후 verify, codex review 는 일괄 (cycle 시간 절약).
- Tier 1 (§5.11 v2 + §5.12 narrow) 은 Tier 2 의 §5.14.1.A + §5.14.1.B 로 자연 흡수.
- 다음 세션 = §5.13 (A1+B2+C4 사용자 임시 결정) 착수.
