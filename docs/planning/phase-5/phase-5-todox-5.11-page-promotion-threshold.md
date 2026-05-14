---
phase: 5
section: 5.11
title: Page Promotion Threshold (Issue B) — v2.5 SDD+TDD + master 1차 + codex 2차 + 라이브 smoke
status: planning
created: 2026-05-05
updated: 2026-05-05
version: v2.5
---

# Phase 5 §5.11 Page Promotion Threshold (Issue B) v2.5 — SDD+TDD + 의미·관련도 + 원문 언어 alias + codex cycle #1+#2+#3+#4 fix

> **상위 문서**: [`docs/planning/phase-5/phase-5-todo.md`](./phase-5-todo.md) · [`docs/sessions/phase-5/phase-5-result.md`](../../docs/sessions/phase-5/phase-5-result.md)
>
> **버전 이력**:
> - v1 (2026-05-05 session 18 commit c311561, occurrence ≥ 2 gate)
> - v2 (2026-05-05 session 19, 의미·관련도 + 원문 언어 중심 alias + wiki 완전 초기화)
> - v2.1 (2026-05-05 session 19, SDD+TDD 구조 + master 1차 7-anchor + codex Mode D Panel 2차 + obsidian-cdp 라이브 smoke 의무 추가)
> - v2.2 (2026-05-05 session 19, codex cycle #1 6 finding fix: P1 3건 (AC-A3 skeleton 유지 / AC-V5 WikiPage 시그니처 / AC-A1 CLASSIFY.md 제외) + P2-#2 옵션 B (FULL route dropped sample log helper, B6+AC-B5 신규) + P3-#1 (12→14 AC 통일). P2-#1 dispute (rule 9 LLM 자율 — Karpathy Simplicity).)
> - v2.3 (2026-05-05 session 19, codex cycle #2 3 finding 처리: P1-#A (rule 9 sourceBody re-raise) → P2 강등 + dispute 유지 + plan 텍스트 1단어 보강 ("sourceFilename 또는 mention evidence"). P1-#B (AC-A3 skeleton 7-line vs ≤ 5 모순) → AC 검증식 ≤ 10 으로 변경. P3-#C (v2.1 stale 4곳) → v2.3 통일.)
> - v2.4 (2026-05-05 session 19, codex cycle #3 5 finding 처리: P1-#α (filesystem backup + preflight 누락) → A0 신규 추가. P1-#β (skeleton frontmatter 부재 → validate-wiki.sh fail) → frontmatter 보존 명시 + AC-A3 에 validate-wiki.sh PASS 추가. P2-#γ (D4 commit 모순 — wiki/raw .gitignore) → D4 commit 1 정정 + local vault state 명시. P2-#δ (AC-A4 mention-history 검증 누락) → AC 추가. P3-#ε (line 번호 + D4 v2 stale) → 정정. P1-#A dispute 최종 정당화 (codex cycle #3 reasonable 인정).)
> - **v2.5 (2026-05-05 session 19, codex cycle #4 1 finding 처리: P1-#θ (A0 backup/restore path mismatch — backup 은 `/tmp/.../0_inbox/` 인데 restore 는 `cp -r .../* .` 로 root 에 풀어 `./0_inbox/` 로 복원되어 raw/ prefix 누락) → 옵션 2 (path-preserving backup `$BACKUP/raw/0_inbox/` + path-specific rsync restore) 채택. cycle #5 skip — reviewer 권고 (1 line fix, master 직접 수정 후 사용자 confirm).)**
>
> **이슈 출처**: 사용자 raise 2026-05-05 session 18~19 (의미·관련도 본질, <15 cap 룰 완화, 원문 언어 alias, wiki 초기화, overview.md 정책, SDD+TDD 의무, master/codex 검증)

## 1. 배경 (사용자 6 chain raise)

v1 commit (c311561) 직후 사용자 본질 비판 6 chain:

1. **wiki 초기화 필요**: 현 wiki/ + .wikey/ stale. 깨끗한 baseline 에서 §5.11 v2 검증.
2. **단순 occurrence 부족**: "단편지식, 출처, 장소 또는 페이지 의도/관련도 떨어지는 것은 제외하는 것이 목적" — count 만으로는 의미 분별 불가.
3. **<15 cap 완화**: mention extractor prompt 의 "0~15개 정도" cap 강제 X. "1~3개만 생성되어도 관계없음".
4. **원문 언어 중심 alias**: Korean source → 한국어 페이지명 + 영어 alias / English source → 영어 페이지명 + 한국어 alias.
5. **log.md 의미 재정의**: 작업 log NOT, 문서/지식 log only.
6. **overview.md 폐기**: index.md 로 통합 (사용자 결정 — query/ingest 코드 영향 0).

## 2. Root cause 재진단

| 영역 | v1 한계 | v2 해결 |
|------|---------|---------|
| Layer 1 (mention extractor prompt) | "청크당 0~15개" cap 명시 → 단순 출처/장소도 mention 으로 잡힘 | cap 표현 제거 + 의미·관련도 ❌ list 추가 |
| Layer 1 (canonicalizer prompt rule 8) | occurrence ≥ 2 또는 hub 만 명시 | "페이지 의도와의 관련도" + 단편 사실 / 단순 출처 / 단순 장소 예시 명시 |
| Layer 1 (canonicalizer prompt — alias 정책) | 영어 슬러그 위주 출력 (현 wiki/ 12 entities 모두 영어 슬러그) | 원문 언어 우선 + 반대 언어 alias 룰 명시 |
| Layer 2 (occurrence count gate) | v1 그대로 유지 (이미 동작) | 변경 없음 — backup safety net |

## 3. 진행 구조 — SDD + TDD 강제 (v2.1+ 추가)

**Spec-Driven + Test-Driven 의무 흐름**:

```
Phase 0  Spec lock (본 todox v2.5) → master 7-anchor 1차 grep → codex Mode D Panel 2차 검증 (cycle #1~4 누적, cycle #5 skip — reviewer 권고)
                                                                  ↓ APPROVE / NEEDS_REVISION
Phase 1  Step A — 환경 초기화 (.wikey 백업 → wiki/raw/sidecar destructive)
Phase 2  Step B — TDD RED: 단위 테스트 신규 5 case 작성 (canonicalizer.test.ts) → 모두 FAIL 확증
Phase 3  Step B — TDD GREEN: prompt rule 8 v2 + rule 9 + mention extractor 강화 → 5 case PASS
Phase 4  Step B — TDD REFACTOR: master 7-anchor cross-check + Karpathy 4원칙 (Simplicity/Surgical) 검증
Phase 5  Step C — 단위 typecheck + build + 613+ PASS 회귀
Phase 6  Step C — 라이브 obsidian-cdp full cycle smoke (master 직접, 2 source — 한국어 + 영어)
Phase 7  Step B 코드 + Step C smoke 결과 → codex Mode D Panel 2차 검증 (cycle #2 post-impl)
Phase 8  Step D — 문서 동기화 (schema.md / activity result / followups) + 4 commit
Phase 9  최종 master 1차 검증 + 사용자 사전 보고
```

**검증 의무 (rules.md §10 + agent-management.md §7)**:

| 단계 | master 1차 | codex 2차 (Mode D Panel) | tester | 라이브 smoke |
|------|-----------|--------------------------|--------|--------------|
| Phase 0 spec lock | 본 §8 7-anchor grep | cycle #1 (plan APPROVE 받기) | — | — |
| Phase 2~4 TDD | 매 RED/GREEN/REFACTOR 후 fresh `npm test` | — | (master 가 직접 — TDD 강제) | — |
| Phase 5 회귀 | typecheck + build + test fresh re-run | — | — | — |
| Phase 6 라이브 smoke | obsidian-cdp full cycle (Brief→Proceed→Processing→Preview→Approve→write) **master 직접** | — | — | **의무** (2 source) |
| Phase 7 post-impl | grep diff + Karpathy cross-check | cycle #2 (코드 + smoke evidence APPROVE) | — | — |
| Phase 9 최종 | 14 AC line-by-line 증거 매핑 | — | — | — |

## 4. 채택 path: 4 단계 (A 환경 → B prompt → C 검증 → D 동기화)

### Step A — 환경 완전 초기화 (destructive, user-explicit, Phase 1)

> **중요** (codex cycle #3 P2-#γ fix): `wiki/`, `raw/`, `.wikey/mention-history.json` 은 모두 `.gitignore` 대상 — Step A 의 destructive 작업은 **local vault state operation 이며 git diff 0 이다**. git tracked 파일은 `.wikey/source-registry.json` 만 (`.gitignore` line 8 주석 "historic tracked → 유지").

**A0. preflight + filesystem backup** (codex cycle #3 P1-#α + cycle #4 P1-#θ fix: path-preserving backup + rsync restore):

```bash
TS=$(date +%s)
BACKUP="/tmp/wikey-backup-$TS"
mkdir -p "$BACKUP/raw"
cp -r wiki/ "$BACKUP/wiki/"
cp -r raw/0_inbox/ "$BACKUP/raw/0_inbox/"
cp -r raw/3_resources/ "$BACKUP/raw/3_resources/"  # 분류된 PARA 디렉토리
cp -r .wikey/ "$BACKUP/.wikey/"
echo "BACKUP: $BACKUP" > /tmp/wikey-backup-latest.txt
git status --short  # tracked uncommitted ≤ plan/ 만 (master 작업) — 그 외 발견 시 사용자 보고
```

복구 절차 (Phase 1~9 어느 단계에서 abort 시) — path-specific rsync (codex cycle #4 P1-#θ fix):
```bash
rsync -a "$BACKUP/wiki/" wiki/
rsync -a "$BACKUP/raw/0_inbox/" raw/0_inbox/
rsync -a "$BACKUP/raw/3_resources/" raw/3_resources/
rsync -a "$BACKUP/.wikey/" .wikey/
```
(소유자 파일이라 chown 불필요. raw/ 전체 backup 미사용 — PII 노출 최소화 + Simplicity.)

**A1. raw/ 분류 파일 → 0_inbox 원복** (3 파일):
- `raw/3_resources/60_note/200_social/pmbok-overview.md`
- `raw/3_resources/20_report/500_technology/pms/PMS_제품소개_R10_20220815.pdf`
- 위 PDF 의 sidecar `.pdf.md`
- 빈 PARA 디렉토리는 유지 (구조 보존)

**A2. sidecar `<file>.<ext>.md` 삭제** (raw/0_inbox 내 변환 캐시):
- `raw/0_inbox/스마트공장 보급확산 합동설명회 개최.hwp.md`
- `raw/0_inbox/Examples.hwpx.md`
- `raw/0_inbox/PMS_제품소개_R10_20220815.pdf.md` (A1 이동된 후)
- 원본 (.hwp / .hwpx / .pdf) 보존

**A3. wiki/ content 삭제 + meta skeleton reset** (codex cycle #1 P1-#1 + cycle #3 P1-#β fix):
- **삭제**: `wiki/overview.md` (폐기 — 사용자 결정)
- **삭제**: `wiki/entities/*.md` 12개, `wiki/concepts/*.md` 42개, `wiki/sources/*.md` 4개
- **skeleton 유지** (필수: ingest 시 wiki-ops.ts `updateIndex`/`appendLog` 가 read 호출 + validate-wiki.sh:20 가 모든 wiki/*.md frontmatter `---` 시작 검증):
  - `wiki/index.md` → frontmatter + 빈 카테고리 헤더 (codex cycle #3 P1-#β fix: frontmatter 보존):
    ```
    ---
    title: 위키 인덱스
    type: index
    created: 2026-04-10
    updated: 2026-05-05
    ---

    ## 엔티티

    ## 개념

    ## 소스

    ## 분석
    ```
  - `wiki/log.md` → frontmatter + 헤더 (append-only):
    ```
    ---
    title: 위키 활동 로그
    type: log
    created: 2026-04-10
    updated: 2026-05-05
    ---

    # 위키 활동 로그
    ```
- **`wiki/.ingest-map.json` reset → `{}`** (Phase 6 라이브 smoke 발견 결함 fix: A3 에서 .md 파일만 삭제하면 audit panel 의 ingested count 가 stale)
- 디렉토리 골격 (`entities/`, `concepts/`, `sources/`, `analyses/`) 은 유지

**A4. .wikey/ 부분 초기화 + cache 전체 reset** (Phase 6 사용자 요청 추가 — wiki content 와 직결된 모든 cache 동시 reset):
- 초기화: `.wikey/source-registry.json` → `{}`, `.wikey/mention-history.json` → `{}`
- **cache reset** (wiki content 의존이라 wiki reset 시 stale): `.wikey/qmd-embeddings.json` → `{}`, `~/.cache/qmd/index.sqlite{,-shm,-wal}` 삭제, `~/.cache/qmd/contextual-prefixes.json` 삭제
- **wiki/.ingest-map.json** → `{}` (audit panel ingested count 의 source — A3 에서 함께 reset, AC-A3 에 명시)
- **plugin reload** (Audit panel 의 in-memory cache dispose — `app.plugins.disablePlugin('wikey'); enablePlugin('wikey')`)
- 보존: `.wikey/manual-overrides.yaml`, `.wikey/schema.yaml`, `~/.cache/qmd/index.sqlite.bak-*` (역사 백업), `~/.cache/qmd/models/` (GGUF 모델), `.wikey/.migration-backup-*/`

### Step B — §5.11 v2 prompt 강화 (mention extractor + canonicalizer, Phase 2~4 TDD)

**TDD 흐름 의무**:
1. **RED**: C1 의 5 case 모두 작성 → `npm test` 5 FAIL 확증 후 commit (`test: §5.11 v2 RED — 5 case`)
2. **GREEN**: B1/B2/B3/B5 prompt 변경 → 5 case PASS + 기존 608 PASS 유지 (`feat: §5.11 v2 GREEN — prompt 강화`)
3. **REFACTOR**: master 7-anchor cross-check + Karpathy Simplicity/Surgical → 잔재 정리 (`refactor: §5.11 v2 REFACTOR — 7-anchor 정합`)


**B1. `BUNDLED_STAGE2_MENTION_PROMPT` 강화** (`wikey-core/src/ingest-pipeline.ts`):

```diff
-## 가이드 분량
-
-청크당 0~15개 정도. 모르는 것보다 **빠뜨리는 게 낫습니다**. 명확한 것만.
+## 가이드 분량 + 의미·관련도 (§5.11 v2)
+
+페이지 의도와 직접 관련된 명확한 entity/concept 만 추출. **수가 적어도 (1~3개) 관계없음**.
+페이지의 핵심 주제·방법론·도구·인물·조직·표준에 해당하는 것만.
+
+❌ 제외 대상 (의도/관련도 기반):
+- 단순 출처 (예: "출처: X", "발급기관: Y")
+- 단순 행사 장소 / 개최 장소 (예: "개최: Z 회의장")
+- 1회 등장 + action/property/relation 서술 없는 단순 명칭
+- 단편적 사실 (날짜, 일정, 단순 위치) 자체
+- 페이지 의도와 약한 관련의 고유명사 (page intent 와 1-hop relation 없음)
```

**B2. canonicalizer rule 8 강화** (`wikey-core/src/canonicalizer.ts::buildCanonicalizerPrompt`):

```diff
-8. **promotion threshold (§5.11)**: 본문 전체에서 의미 있는 등장 (action / property / relation 서술) 이 **2회 이상**이거나 다른 mention 이 cross-reference 하는 hub 역할일 때만 entity/concept 으로 출력. 단순 출처 (예: "개최 장소: X", "출처: Y"), 단순 인용, 1회 mention 만 있는 고유명사는 entities/concepts 에서 **제외**. 본문 의미에 비례한 promotion 만 — wiki noise 방지.
+8. **promotion threshold (§5.11 v2)**: 본문 의미·관련도 기준으로 entity/concept 결정.
+   - **포함**: 페이지 의도(주제)와 1-hop 직접 관련 + action/property/relation 서술이 있는 명사. 다른 mention 들이 cross-reference 하는 hub.
+   - **제외**: 단순 출처/발급기관/개최 장소/단순 인용/단편 사실(날짜·위치)/1회 mention. 페이지 의도와 약한 관련의 고유명사.
+   - 수량 제한 없음 — 1~3개만 출력해도 OK. 본문 의미에 비례한 promotion 만.
```

**B3. canonicalizer 에 원문 언어 중심 alias 룰 추가** (rule 9 신규):

```diff
+9. **원문 언어 중심 + 반대 언어 alias (§5.11 v2)**:
+   - 한국어 source (소스 본문이 주로 한국어) → name = 한국어 base, aliases = [영어 transliteration 또는 표준 영문 약어]
+   - 영어 source → name = 영어 base, aliases = [한국어 transliteration]
+   - 예 (한국어 source):
+     `{"name": "전라남도-테크노파크", "aliases": ["jeonnam-technopark", "JTP"]}`
+   - 예 (영어 source):
+     `{"name": "project-management-institute", "aliases": ["프로젝트관리협회", "PMI"]}`
+   - source language 판단: **sourceFilename 또는 mention evidence** 의 한글 (Hangul) 비중 ≥ 30% → Korean. 그 외 → English. (codex cycle #2 P1-#A clarify: prompt 에 sourceFilename + mention evidence 가 이미 전달되므로 LLM 자율 판단 가능 — sourceBody 인자 추가 불필요)
```

**B4. canonicalizer 의 slug normalization 호환**:
- 한국어 base name 도 `canonicalizeSlug` 통과 (lowercase + 하이픈) — 이미 한글 보존 코드 (commit 83a6f00 / d8e37dd). 추가 변경 없음.
- alias dedup 시 한국어 ↔ 영어 cross-reference 가능: SLUG_ALIASES + `.wikey/schema.yaml aliases:` 가 이미 양방향 처리.

**B5. wiki/overview.md 폐기 부수 정리**:
- `wikey-obsidian/src/sidebar-chat.ts:631` 주석에서 "overview" 제거 (1라인)
- `wikey-obsidian/src/status-bar.ts:118` 주석 동일 정리
- `wikey.schema.md` 의 overview.md 관련 줄 제거 (사용자 승인 후)

**B6. FULL route dropped sample log helper 추가** (codex cycle #1 P2-#2 옵션 B fix):

`ingest-pipeline.ts:546` 의 FULL route canonicalize 직후 dropped sample log 3줄 추가 (현재 SEGMENTED route 만 보유, line 611-614). FULL/SEGMENTED 양 route 의 dropped sample 출력 일관 → AC-C5 가 어느 route 에서도 검증 가능.

```ts
// ingest-pipeline.ts:546 직후 (FULL route)
if (canon.dropped.length > 0) {
  const droppedSummary = canon.dropped.slice(0, 10).map((d) => `${d.mention.name} (${d.reason})`).join(', ')
  log(`dropped sample: ${droppedSummary}${canon.dropped.length > 10 ? `, +${canon.dropped.length - 10} more` : ''}`)
}
```

Karpathy Surgical Changes — 3 line 추가, 새 file 0, 기존 SEGMENTED 로직과 동일 형식 mirror.

### Step C — 검증 (단위 + obsidian-cdp 라이브 smoke, Phase 5~7)

**라이브 smoke 의무 (Phase 6, master 직접)**:

CLAUDE.md §6 (라이브 검증 master 직접) + `~/.claude/skills/obsidian-cdp/SKILL.md` 따라 **반드시 2 source full cycle smoke 진행**.

```
1. Obsidian Vault 띄우기 + CDP 9222 attach
2. 한국어 source ingest (raw/0_inbox/pmbok-overview.md)
   - Brief → Proceed → Processing → Preview → Approve & Write
   - 검증: wiki/entities/<korean>.md 한국어 파일명 + frontmatter aliases 영어
   - 검증: console log dropped reason ("low-relevance" or "single-mention" 등)
3. 영어 source ingest (raw/0_inbox/llm-wiki.md)
   - 동일 cycle
   - 검증: wiki/entities/<english>.md 영어 파일명 + frontmatter aliases 한국어
4. dashboard 의 wiki Total = 양 source 분해 결과 합 (≥ 2, ≤ 합리적 수준)
5. evidence: docs/sessions/phase-5/phase-5-resultx-5.11-v2-2026-05-05.md 에 console capture + screenshot path
```

**라이브 smoke 미통과 시**: 사용자 보고 + 환경 fallback (CDP attach 실패 등) 재시도. master 임의 skip 금지.


**C1. 단위 테스트** (`wikey-core/src/__tests__/canonicalizer.test.ts` 신규 describe):

```ts
describe('§5.11 v2 — relevance/intent + 원문 언어 alias', () => {
  it('AC-V1: prompt 에 "수가 적어도 관계없음" 문구 포함', () => {
    const p = buildCanonicalizerPrompt({...})
    expect(p).toMatch(/1~3개만 출력해도 OK|수가 적어도/)
  })

  it('AC-V2: prompt 에 "원문 언어 중심" alias 룰 (rule 9) 포함', () => {
    const p = buildCanonicalizerPrompt({...})
    expect(p).toContain('한국어 source')
    expect(p).toContain('영어 source')
  })

  it('AC-V3: prompt 에 단순 출처/장소 제외 명시', () => {
    const p = buildCanonicalizerPrompt({...})
    expect(p).toMatch(/단순 출처|발급기관|개최 장소/)
  })

  it('AC-V4: BUNDLED_STAGE2_MENTION_PROMPT 의 "0~15개" cap 제거 + 의미·관련도 명시', () => {
    expect(BUNDLED_STAGE2_MENTION_PROMPT).not.toMatch(/0~15개 정도/)
    expect(BUNDLED_STAGE2_MENTION_PROMPT).toMatch(/수가 적어도/)
  })

  it('AC-V5: 한국어 source mock LLM 출력 통과 — Korean filename + English alias frontmatter (codex cycle #1 P1-#2 fix)', async () => {
    const mockLLM = makeMockLLM(JSON.stringify({
      entities: [{ name: '전라남도-테크노파크', aliases: ['jeonnam-technopark'], type: 'organization', description: '...' }],
      concepts: [],
    }))
    const result = await canonicalize({ ...baseArgs, llm: mockLLM, mentions: [...] })
    // WikiPage 타입은 { filename, content, category, entityType?, conceptType? } — name/aliases 필드 직접 X.
    // alias 는 content frontmatter 의 aliases: yaml 리스트로 검증.
    expect(result.entities[0].filename).toBe('전라남도-테크노파크.md')
    expect(result.entities[0].content).toMatch(/aliases:\s*\n\s*-\s*jeonnam-technopark|aliases:\s*\[.*jeonnam-technopark/)
  })
})
```

**C2. 회귀 — 기존 608 PASS 유지 + 신규 ≥ 5 case** (canonicalizer + ingest-pipeline).

**C3. typecheck + npm run build + npm test**: 0 errors / 613+ PASS.

**C4. 라이브 cycle smoke** (master 직접, CLAUDE.md §6 master 책임):
- `raw/0_inbox/pmbok-overview.md` (한국어 source) ingest 1회 → wiki/entities, concepts 의 한국어 name + 영어 alias 검증
- `raw/0_inbox/llm-wiki.md` (영어 source) ingest 1회 → 영어 name + 한국어 alias 검증
- 단순 출처 / 행사 장소 mention 이 dropped 로 표시되는지 console log 확인
- evidence: `docs/sessions/phase-5/phase-5-resultx-5.11-v2-2026-05-05.md`

### Step D — 문서 동기화 + commit (Phase 8)

**D1. wikey.schema.md 부분 업데이트** (사용자 승인 후):
- "워크플로우 1 (인제스트)" 의 overview.md 갱신 라인 제거
- "log.md 형식" 을 "문서/지식 log" 로 재정의 (예: `[2026-05-05] PMBOK 6 KA 학습 — concepts/scope-management 신규` — 행위가 아닌 결과물)
- 디렉토리 구조 트리에서 overview.md 제거

**D2. docs/sessions/phase-5/phase-5-result.md + docs/sessions/phase-5/phase-5-resultx-5.11-v2-2026-05-05.md 작성**:
- 4단계 진행 결과 + 라이브 smoke evidence

**D3. session-wrap-followups.md 업데이트** (다음 세션 진입점)

**D4. 커밋** (논리 단위, 4 commit — codex cycle #3 P2-#γ fix: wiki/raw 초기화는 .gitignore 대상 → git diff 0, local vault state operation only):
1. `chore(reset): .wikey/source-registry.json 초기화 (local vault: wiki/raw 삭제는 .gitignore 대상 — git 흔적 0)`
   ※ `wiki/`, `raw/`, `.wikey/mention-history.json` 은 `.gitignore` 대상 — git 에는 흔적 X. local vault state only. tracked 변경: `.wikey/source-registry.json` (`{}` reset) 만.
2. `feat(§5.11 v2): mention extractor + canonicalizer prompt 강화 — 의미·관련도 + 원문 언어 alias` (B1+B2+B3+B6 prompt + dropped sample helper)
3. `refactor(overview.md 폐기): sidebar-chat / status-bar 주석 정리 + wikey.schema.md 갱신` (B5)
4. `docs(sync): §5.11 v2.x result + todox v2.5 + session-wrap-followups`

## 5. Acceptance Criteria

| ID | 조건 | 검증 |
|----|------|------|
| AC-A1 | raw/ 분류 파일 3개 → 0_inbox 이동 + 빈 PARA 디렉토리 유지 (codex cycle #1 P1-#3 fix: CLASSIFY.md 제외) | (1) `raw/0_inbox/pmbok-overview.md` 존재 (2) `raw/0_inbox/PMS_제품소개_R10_20220815.pdf` + `.pdf.md` 존재 (3) `find raw -mindepth 2 -not -path "*0_inbox*" -not -path "*_delayed*" -name "*.md" -not -name CLASSIFY.md` 0건 |
| AC-A2 | raw/0_inbox/`<file>.<ext>.md` sidecar 3개 삭제 | `ls raw/0_inbox/*.{hwp,hwpx,pdf}.md` 0건 |
| AC-A3 | wiki/ content 삭제 + meta skeleton reset + .ingest-map.json reset (entities/concepts/sources/analyses 만 비우고, index.md/log.md 는 skeleton 유지 with frontmatter, overview.md 삭제, .ingest-map.json `{}`) | `find wiki/entities wiki/concepts wiki/sources wiki/analyses -name "*.md"` 0건 + `test ! -e wiki/overview.md` + `wc -l wiki/index.md wiki/log.md` 각 ≤ 15 (frontmatter 포함 8-13 line) + `./scripts/validate-wiki.sh` exit 0 + `cat wiki/.ingest-map.json` = `{}` 또는 미존재 (codex cycle #2 P1-#B + cycle #3 P1-#β + Phase 6 audit-stale fix) |
| AC-A4 | .wikey + 외부 cache 전체 reset (codex cycle #3 P2-#δ + Phase 6 cache fix) | `cat .wikey/source-registry.json` = `{}` AND `cat .wikey/mention-history.json` = `{}` AND `cat .wikey/qmd-embeddings.json` = `{}` AND `test ! -e ~/.cache/qmd/index.sqlite` AND `test ! -e ~/.cache/qmd/contextual-prefixes.json` |
| AC-B1 | BUNDLED_STAGE2_MENTION_PROMPT 의 "0~15개" cap 제거 + 의미·관련도 ❌ list | grep "0~15개" 0건 + grep "수가 적어도" 1건 |
| AC-B2 | canonicalizer rule 8 v2 — 단순 출처/장소/단편 사실 명시 | grep "단순 출처\|개최 장소" canonicalizer.ts |
| AC-B3 | canonicalizer rule 9 신규 — 원문 언어 중심 alias 룰 | grep "한국어 source\|영어 source" canonicalizer.ts |
| AC-B4 | wiki/overview.md 참조 코드 제거 (sidebar-chat, status-bar 주석) | grep "overview" wikey-obsidian/src 결과 0 lines (test 제외) |
| AC-B5 | FULL route dropped sample log helper 추가 (B6, codex cycle #1 P2-#2 옵션 B fix) | `grep -nE "dropped sample" wikey-core/src/ingest-pipeline.ts` 결과 ≥ 2 (FULL + SEGMENTED 양 route) |
| AC-C1 | typecheck + build 0 errors | `npm run typecheck && npm run build` exit 0 |
| AC-C2 | 기존 608 PASS 유지 + 신규 ≥ 5 case | `npm test` 613+ PASS |
| AC-C3 | 라이브 한국어 source ingest → 한국어 name + 영어 alias | wiki/entities/*.md 의 한국어 파일명 + frontmatter aliases 영어 |
| AC-C4 | 라이브 영어 source ingest → 영어 name + 한국어 alias | wiki/entities/*.md 의 영어 파일명 + frontmatter aliases 한국어 |
| AC-C5 | 단순 출처 / 장소 dropped reason 출력 | console log 의 `[Wikey ingest] dropped sample: ... (single-mention\|low-relevance)` |

## 6. Karpathy 4원칙 정합

- **Think Before Coding**: 사용자 6 chain 본질 비판 (의미·관련도, <15 룰, 원문 alias, log.md, overview.md, 초기화) 모두 §1 명시 후 진행. 가정 X.
- **Simplicity First**: 코드 추가 ~30 LOC (prompt rule 8 v2 + rule 9 + mention extractor 가이드). 새 file 0. overview.md 자동 합성 같은 추가 기능 거부.
- **Surgical Changes**: 기존 canonicalizer.ts + ingest-pipeline.ts 의 prompt 만 교체. wiki 삭제는 사용자 explicit. occurrence count gate (v1) 는 유지 — backup safety net.
- **Goal-Driven**: AC 14개 정량 + 라이브 smoke evidence 로 검증.

## 7. 위험 + 대응

| 위험 | 대응 |
|------|------|
| 한국어 파일명 OS/git rename case 이슈 | git config core.precomposeunicode true 확인 + commit 시 `git status` 검증 |
| 라이브 smoke 환경 부재 | tester scope 외 — master 직접 obsidian-cdp 실행 (CLAUDE.md §6) |
| LLM 이 한국어 source 에서 영어 슬러그 emit | rule 9 명시 + 라이브 smoke 에서 verify. **codex cycle #1 P2-#1 dispute**: rule 9 의 source language 판단은 LLM 자율 (mention evidence 의 한글 비중 보고 판단) — buildCanonicalizerPrompt 에 sourceBody 인자 주입은 Karpathy Simplicity 위반. AC-V1/V2 의 prompt 문구 존재 검증으로 충분. |
| .wikey 부분 reset 으로 schema.yaml 손실 | 보존 명시 + reset 전 `cp -r .wikey/ /tmp/.wikey-backup-$(date +%s)/` |
| canonicalizer 의 한국어 base 가 SLUG_ALIASES dedup 실패 | 기존 commit 83a6f00 / d8e37dd 의 한글 보존 검증된 코드 신뢰. 신규 테스트 case AC-V5 추가. |

## 8. Self-check (codex 송부 전 master 7-anchor — rules.md §10)

| # | Anchor | 상태 |
|---|--------|------|
| (a) | rule 8 v2 + rule 9 신규 시그니처 일관성 | §4 B2/B3 ↔ §5 AC-B2/B3 ↔ §8 (g) test exact phrase 일치 |
| (b) | mention extractor "0~15개" cap 제거 phrase | §4 B1 diff ↔ §5 AC-B1 ↔ §6 test AC-V4 일치 |
| (c) | wiki 초기화 scope (entities/concepts/sources + meta) | §4 A3 ↔ §5 AC-A3 ↔ wikey.schema.md §"디렉토리 구조" |
| (d) | AC test 시나리오 매핑 (14 AC + 5 신규 case) | AC-A1~A4 + AC-B1~B5 + AC-C1~C5 = 14 AC, AC-V1~V5 = 5 case |
| (e) | self-check 7 anchor 모든 행 | 본 §8 |
| (f) | header version + 작성일 + Phase 0~9 (codex cycle #3 P3-#ε fix: 실제 frontmatter line 번호) | frontmatter line 8 (`version: v2.5`) + line 7 (`updated: 2026-05-05`) + §3 Phase 0~9 |
| (g) | 코드 ↔ test exact phrase | "수가 적어도", "한국어 source", "영어 source", "단순 출처" — prompt body ↔ test toMatch/toContain |

## 9. master 1차 + codex 2차 검증 절차 (rules.md §10 + agent-management.md §7)

### 9.1 master 1차 (본 todox v2.5 송부 전 grep)

```bash
# §8 self-check anchor 자동 검증
grep -nE '^[0-9]+\. \*\*' wikey-core/src/canonicalizer.ts | head    # rule 번호 확증
grep -nE 'BUNDLED_STAGE2_MENTION_PROMPT' wikey-core/src/ingest-pipeline.ts | head
grep -c '0~15개 정도' wikey-core/src/ingest-pipeline.ts  # 0 expected (post-impl)
grep -c '수가 적어도' wikey-core/src/ingest-pipeline.ts  # ≥1 (post-impl)
grep -c '한국어 source\|영어 source' wikey-core/src/canonicalizer.ts  # ≥2 (post-impl)
```

stale ≥ 1건 발견 시 즉시 master 직접 fix 후 재 grep. 0건 확증 후 codex 송부.

### 9.2 codex 2차 (Mode D Panel, 2 cycle 의무)

**Cycle #1 — plan 검증** (Phase 0):
- prompt: 본 todox v2.5 + wikey.schema.md + rules.md §10 + Karpathy 4원칙 → 7-anchor 정합 / Karpathy 정합 / SDD+TDD 흐름 정합 / AC 충분성 verdict
- panel: fresh `panel-dispatch.sh dispatch reviewer` + capture 1500
- master 결정: APPROVE → Phase 1 진행. NEEDS_REVISION → 본 todox 갱신 후 cycle #2 (재 plan 검증).

**Cycle #2 — post-impl 검증** (Phase 7):
- prompt: 코드 diff (canonicalizer.ts + ingest-pipeline.ts) + 단위 test 결과 + 라이브 smoke evidence (docs/sessions/phase-5/phase-5-resultx-5.11-v2-2026-05-05.md) → finding scrutiny + Karpathy 4원칙 cross-check verdict
- panel: 새 fresh surface (cycle #1 surface 재사용 금지)
- master 결정: APPROVE → Phase 8 commit + 사용자 보고. NEEDS_REVISION → fix 후 cycle #3 (필요 시).

**panel 운영 (rules.md §11.2)**:
- 매 cycle = fresh panel + close-after-cycle (cmux close-surface)
- panel 이름: `cmux rename-tab --surface "$SURFACE" "codex: §5.11 v2.5 cycle #N"`
- polling: Monitor 도구 30~60s 간격, verdict grep 패턴 다양화 (rules.md §7.1.1) 준수
- master polling 진행 채팅 노출 X (백그라운드, agent-management.md §7.1)
- verdict + master 결정만 채팅 명시
