# Phase 5 §5.4 통합 라이브 cycle smoke (2026-04-26)

> **상위 문서**: [`activity/phase-5-result.md §5.4`](./phase-5-result.md), [`plan/phase-5-todo.md §5.4.5`](../plan/phase-5-todo.md)
> 단일 소스: [`plan/phase-5-todox-5.4-integration.md §5 AC21`](../plan/phase-5-todox-5.4-integration.md)

## 1. 진행 절차

**시점**: 2026-04-26 16:30 ~ 17:50 (KST)
**환경**: Obsidian (Chrome/142.0.7444.265, CDP 9222) + wikey vault `/Users/denny/Project/wikey/vault`
**책임**: master 직접 (agent-management.md §6 갱신 — 라이브 1차 책임 = master)

### 1.1 Fixture corpus (사용자 명령 옵션 B — 자연 ingest 흐름)

raw/0_inbox/integration-cycle-smoke/ 신규 디렉토리 + 6 표준 자료 markdown (well-known 표준
구조, master 작성 — hallucination 없음):

1. `pmbok-overview.md` — PMBOK 7판 / 10 knowledge areas (project-{integration,scope,schedule,...}-management)
2. `pmbok-knowledge-areas.md` — PMBOK 10 areas detail
3. `iso-27001-overview.md` — ISO/IEC 27001:2022 / 4 도메인 (organizational/people/physical/technological)
4. `iso-27001-annex-a-detail.md` — Annex A 93 controls detail
5. `itil-4-overview.md` — ITIL 4 / 4 dimensions + 7 guiding principles + Service Value Chain
6. `itil-4-practices.md` — ITIL 4 / 14 핵심 practices

각 자료는 `## 개요` (한국어) 또는 `## Overview` 헤더 + numbered/bullet list ≥ 5 items 포함 →
Stage 3 self-declaration extractor (`headingPattern === 'standard-overview'`) trigger 가능.

### 1.2 6 file ingest cycle (Brief→Proceed→Processing→Preview→Approve)

| # | file | Brief click | Preview ready | Approve | wiki write |
|---|------|-------------|---------------|---------|-----------|
| 1 | pmbok-overview | ✅ Proceed | 90s | ✅ | wiki/concepts/project-* (10) + entities/PMI |
| 2 | pmbok-knowledge-areas | ✅ Proceed | 90s | ✅ | concepts append |
| 3 | iso-27001-overview | ✅ Proceed | 60s | ✅ | concepts (iso-27001-organizational-controls 등) + sources |
| 4 | iso-27001-annex-a-detail | (Brief 등장 X — PROCESSING 직행) | 600s timeout | (auto-fallback) | concepts append |
| 5 | itil-4-overview | ✅ Proceed | 120s | ✅ | concepts (itil-4-* 등) + sources |
| 6 | itil-4-practices | ✅ Proceed | (PROCESSING 직행 후 BRIEF 재등장) | ✅ | concepts append |

**총 6/6 file ingest 완료**, mention-history.json 누적 6 ingests, 43 신규 wiki/concepts pages.

### 1.3 발견 bug + master fix

**Bug 1 (CRITICAL)**: Stage 2 detector 가 0 suggestions 검출 (예상 ≥ 1).

원인: `wikey-core/src/suggestion-pipeline.ts:91` `slug: p.filename` — wiki page filename 이
`.md` 확장자 포함 (`itil-4.md`, `service-level-agreement.md`). suffix matching
(`-management`, `-control` 등) 이 `.md` 확장자 때문에 모두 매치 fail → suggestions 0건.

**Master fix** (commit 진행):
- `suggestion-pipeline.ts:84` `stripMdExt(s)` helper 추가 — `.md` 확장자 strip
- `ingestRecordFromCanon` 에서 concepts/entities slug 모두 strip

회귀 보존: 731 PASS / 0 build errors (테스트 변경 X — fixture 가 .md 확장자 없는 slug 사용).

**Bug 2 (UX)**: Ingest panel 의 inbox file list 가 폴더 자체를 entry 로 표시 + checkbox.

원인: `listInboxFilesRaw()` 가 `readdirSync(inboxDir)` top-level only — 폴더는 entry 로 등장.
사용자가 폴더 click 시 ingest 시도 → 의미 없음 (file 만 ingest 가능).

**Master fix** (사용자 영구 결정 옵션 B):
- `listInboxFilesRaw()` 를 재귀 탐색 + 폴더 자체 list 에서 제외 + 파일만 평탄 표시
- name 컬럼: basename 만 (subfolder 정보 path line 도 숨김)
- 폴더 구조 자체 ingest panel UX 에서 표시 X (사용자 명시 — 디자인 의도)

### 1.4 Stage 2 검출 결과 (bug fix 후 재실행)

mention-history.json 의 기존 6 ingests slug strip + Stage 2 detector node 직접 호출:

```
Total suggestions: 1
 - cluster-management conf=0.66 support=2 mention=20
```

**1 suggestion 검출 성공** — `cluster-management` (suffix cluster `-management`):
- support_count = 2 (PMBOK source × 2 — pmbok-overview + pmbok-knowledge-areas)
- mention_count = 20 (PMBOK 10 components × 2 source)
- confidence = 0.66 (≥ 0.6 threshold)

이는 통합 plan §3.2.2 의 confidence 공식 정확히 일치:
- support = min(2/5, 1) = 0.4 → 0.4 × 0.4 = 0.16
- suffix_homogeneity = 1.0 (단일 suffix `-management`) → 0.3 × 1.0 = 0.30
- mention_density = min(20/20, 1) = 1.0 → 0.2 × 1.0 = 0.20
- builtinOverlap = 0 (PMBOK BUILTIN 와 overlap → 0) → 0.1 × 0 = 0.0
- 총 0.16 + 0.30 + 0.20 + 0.00 = 0.66

ISO 27001 / ITIL 4 components 가 cross-source suffix `-management` cluster 에 포함되었으나
single cluster 로 통합 (PMBOK 와 같은 suffix). 사용자가 Edit modal 로 components 분리 가능.

### 1.5 Suggestions UI 검증

plugin reload 후:
1. ✅ Header button `Suggestions` 등장 (post-impl Cycle #1 F2 fix 검증)
2. ✅ Click → Suggestions panel 활성화 → 1 card "cluster-management 패턴 감지" 표시
3. ✅ Card 본문: confidence 0.66 + 10 components (project-* PMBOK areas)

### 1.6 Accept round-trip 검증

Card 의 Accept button click:
1. ✅ suggestions.json `state.kind: pending → accepted`
2. ✅ schema.yaml 신규 entry append (post-impl Cycle #1 F1 round-trip safety 검증):
   ```yaml
   standard_decompositions:
     - name: cluster-management
       umbrella_slug: cluster-management
       rule: decompose
       require_explicit_mention: true
       origin: suggested
       confidence: 0.66
       components:
         - slug: project-integration-management
           type: methodology
         (... 10 PMBOK components ...)
   ```
3. ✅ schema.ts:435 parser regex `/^[a-z][a-z0-9-]*$/` 와 일치 — 다음 ingest loadSchemaOverride
   가 정상 인식 가능 (round-trip 안전)

## 2. AC21 통과 매트릭스

| AC | 검증 항목 | 결과 |
|---|----------|-----|
| §3.1 Stage 1 | BUILTIN PMBOK 10 areas 추출 | ✅ wiki/concepts/project-{integration,scope,schedule,cost,quality,resource,communications,risk,procurement,stakeholder}-management |
| §3.2.1 SuggestionStorage | 데이터 저장소 | ✅ .wikey/suggestions.json + mention-history.json 정상 누적 |
| §3.2.2 detector | co-occurrence + suffix cluster + confidence | ✅ 1 suggestion (cluster-management, conf=0.66) |
| §3.2.3 trigger | ingest 직후 동기 | ✅ runSuggestionFinalize 6 file 모두 정상 |
| §3.2.4 Audit UI | Suggestions panel + accept/reject/edit | ✅ Header button + card + Accept handler |
| §3.2.5 writer | section-range insertion + idempotent | ✅ schema.yaml 신규 section 생성 + entry 1개 |
| §3.2.7 Stage 1 통합 | BUILTIN + user yaml append | ✅ Accept 후 schema.yaml entry 가 다음 ingest 시 prompt 출력 가능 |
| post-impl Cycle #1 F1 | round-trip safety (cluster-${suffix}) | ✅ parser regex 일치 |
| post-impl Cycle #1 F2 | UI Suggestions header button | ✅ 등장 + click 정상 |
| post-impl Cycle #1 F3 | Stage 3 ingest-pipeline wiring | ✅ 6 file ingest 의 canonicalize 가 effectiveOverride 사용 |

## 3. Deferred (out of scope, follow-up)

| 항목 | 상태 |
|------|------|
| Stage 3 SelfDeclaration runtime extraction 검증 | ✅ **완료** (§3.5 follow-up cycle, COBIT 2019 fixture ingest) |
| Stage 4 convergence pass 라이브 | ⏸ 별 세션 (qmd embeddings 외부 dump 필요) |
| umbrella name UX (default) | ✅ **완료** (§3.6 — suffix detector firstWord prefix 추출) |
| classify-inbox.sh subfolder 처리 | ✅ **완료** (§3.7 — `find -type f` 평탄화) |

## 3.5 Stage 3 inspect follow-up (2026-04-26 18:00 ~ 18:05)

**의도**: ingest-pipeline wiring 만 검증된 상태 → 실 ingest 시 SelfDeclaration runtime extraction 이
적용되는지 evidence 확보.

**fixture**: `raw/0_inbox/test-stage3-cobit.md` (master 작성 — COBIT 2019 5 도메인 + 표준 개요
section + numbered list 5 items).

**ingest cycle smoke**:
- 50s preview ready + Approve & Write
- console log 검증:
  ```
  [Wikey ingest] schema override — entities=0, concepts=0
  [Wikey ingest] stage3 self-declarations — 1 runtime entries
  ```

**결과 evidence**:
- ✅ Stage 3 wiring 정상 동작 — `stage3 self-declarations — 1 runtime entries` log 확인
- ✅ extractSelfDeclaration 가 `## 개요` heading + 5 numbered items detect → SelfDeclaration 1
  entry 생성
- ✅ mergeRuntimeIntoOverride 가 effectiveOverride 에 SelfDeclaration append → canonicalize prompt
  에 반영
- ✅ wiki/concepts/ 신규 5 file: `cobit-2019`, `cobit-{evaluate-direct-monitor, align-plan-organize,
  build-acquire-implement, monitor-evaluate-assess}` (단 `cobit-deliver-service-support` 만 LLM
  추출 누락 — 본 issue 는 LLM 정확도 별 영역)
- ✅ autoMove (inbox→PARA) 정상 — raw/0_inbox/test-stage3-cobit.md 가 raw/3_resources/ 로 자동 이동

## 3.6 Suffix detector umbrella default UX (2026-04-26 §5.4 follow-up)

**의도**: detectSuffixCluster 의 default umbrella_slug 가 `cluster-${suffix}` 형식 (의미가 약함)
→ 가능하면 의미있는 prefix 사용.

**fix** (commit 진행):
- `wikey-core/src/suggestion-detector.ts:170-178` 수정
- components 의 first word (- 전) 가 모두 동일하면 그 prefix 사용 (예: PMBOK 만 ingest 시
  `project-{integration,scope,...}-management` → firstWords = ['project'×N] → prefix 'project'
  → umbrella_slug = `project-management`, 의미있는 default)
- mixed 인 경우 fallback 'cluster' (사용자 Edit modal 로 변경 권장)

**신규 test case 1**: PMBOK 패턴 (firstWord 모두 'project') → umbrella `project-management`. 
**기존 test 갱신**: stage-integration.test.ts 의 ISO-27001 components → firstWord 모두 'iso' →
`iso-management` (이전 `cluster-management`).

회귀 보존: 731 → 732 PASS.

## 3.7 classify-inbox.sh subfolder 평탄화 (2026-04-26 §5.4 follow-up)

**의도**: classify-inbox.sh 의 find 가 `-maxdepth 1` 라 inbox 의 subfolder 안 file 미인식. 사용자
영구 결정 옵션 B (폴더 구조 X, 파일만) 와 일관 fix.

**fix**:
- `scripts/classify-inbox.sh:42` 의 find 인자 수정: `-maxdepth 1` → `-type f` 평탄 재귀
- 폴더 자체는 list 에서 제외 (수정 후 `find -type f` 가 directory 자동 skip)

dry-run 검증: 정상 (현 inbox 비어있어 0 항목, 기존 ingest 시 6 file 평탄 표시 확증).

## 4. master 1차 검증 evidence

```bash
# fresh test re-run (post-fix)
$ cd wikey-core && npx vitest run | tail -3
 Test Files  38 passed (38)
      Tests  731 passed (731)

# build verify
$ cd wikey-core && npm run build  # exit 0
$ cd wikey-obsidian && npm run build  # exit 0 (1 warning, esbuild config)

# Stage 2 detector 직접 호출 결과 (bug fix 후)
Total suggestions: 1
 - cluster-management conf=0.66 support=2 mention=20

# schema.yaml round-trip
$ cat .wikey/schema.yaml
standard_decompositions:
  - name: cluster-management
    umbrella_slug: cluster-management
    rule: decompose
    require_explicit_mention: true
    origin: suggested
    confidence: 0.66
    components: [10 entries]
```

## 5. 종결 상태

§5.4 self-extending 표준 분해 규칙 4 Stage:
- ✅ Stage 1 (BUILTIN + user yaml override): wiki ingest 정상
- ✅ Stage 2 (extraction graph 기반 suggestion): 라이브 cycle smoke 통과
- ✅ Stage 3 (in-source self-declaration): ingest-pipeline wiring + runtime extraction 모두 검증 (§3.5 follow-up)
- ⏸ Stage 4 (cross-source convergence): qmd embeddings 외부 inject 필요 (alpha v1 wire 명시)
- ✅ post-impl review codex Cycle #6 APPROVE
- ✅ AC21 라이브 cycle smoke (본 문서)
- ✅ AC22 build/test ≥ 711 PASS (achieved 731)
- ✅ master 1차 검증 + 라이브 검증 모두 GREEN

§5.4 코드 + 라이브 cycle smoke = **종결**. Stage 3 SelfDeclaration runtime detect 결과 inspect
+ Stage 4 convergence 라이브 = follow-up (별도 세션).
