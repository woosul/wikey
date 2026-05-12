# Phase 5 §5.18 Query citation UX — Todo (HOW)

> **상위 문서**: [`plan/phase-5/phase-5-todo.md §5.18`](./phase-5-todo.md) · [`plan/phase-5/phase-5-spec-5.18-query-citation-ux.md`](./phase-5-spec-5.18-query-citation-ux.md)

## 진행 매트릭스 (Step A~G)

- [x] **Step A — analyst v0.2 보강** (2026-05-12): Step "1" 결과로 mismatch 실측 비율 + sourceId 분포 측정 후 I7 log format 결정. spec v0.1 → v0.2.
- [x] **Step B — tester RED** (2026-05-12): 18 신규 test (T1~T13a, 16 RED + 2 regression-PASS), 946 PASS 유지.
- [x] **Step C — developer GREEN** (2026-05-12): 4 신규 export (`appendOriginalLinks` format + `collectBacklinks` + `buildBacklinkSection` + `scanCitationMismatches` + `MismatchDiagnosticModal`), 964 PASS.
- [x] **Step D — Phase 3a 회귀** (2026-05-12): wikey-core 832 + wikey-obsidian 132 = 964 PASS / build 0 errors.
- [x] **Step E — Phase 3b BLUE** (2026-05-12): 6 활동 self-applied + master direct `deriveExtBadge` extract → `appendOriginalLinks` 61 → 50 LOC rule compliant.
- [x] **Step F — codex post-impl review** (2026-05-12): 2 cycle — #1 FAIL 4 finding (P1 CRITICAL backlink wiring + P2 title/sourceId/styles + P3 T1) → developer fix → #2 ✅ APPROVE.
- [x] **Step G — obsidian-cdp 라이브 cycle smoke** (2026-05-12): Scenario A citation format + Scenario B `<details>` backlink section + Scenario C `Citation Registry Diagnostic` Modal 38-page mismatch evidence 모두 PASS.

## 의문점 (Step A LOCK 2026-05-12)

### Q1 LOCK — MetadataCache.resolvedLinks 안정성

**질문**: Obsidian `MetadataCache.resolvedLinks` 가 plugin context 에서 안정적인가?

**조사**:
- `metadataCache` 사용처 grep (`wikey-obsidian/src/sidebar-chat.ts`):
  - line 1662 `app.metadataCache.getFileCache(file)` (tag ranking)
  - line 2333 `app.metadataCache.getFirstLinkpathDest(href, '')` (broken-link guard, §5.10.2.2 이래 운영)
- 두 site 모두 plugin context 안 stable 사용, 회귀 0건.
- `resolvedLinks` 는 Obsidian 공식 API: `app.metadataCache.resolvedLinks: Record<string /* source */, Record<string /* target */, number /* count */>>`.
- ItemView (sidebar-chat) 는 workspace ready 후 mount → cache fully indexed 보장.

**LOCK**: I4 안전 채택. backlink 역방향 lookup =
```ts
const backlinks: string[] = []
const resolved = this.app.metadataCache.resolvedLinks
for (const [sourcePath, links] of Object.entries(resolved)) {
  if (targetPath in links) backlinks.push(sourcePath)
}
```

### Q2 LOCK — backlink section default

**질문**: collapse vs expand?

**조사**:
- 사용자 raise (2026-05-11 보고 3): "답변 wiki 페이지의 **backlink** 표시 요청" — but trade-off 는 chat 메시지 길이 증가.
- §5.18 spec §0 Trade-off 명시: "citation list 가 길면 chat 메시지 길이 증가 — collapse / 상위 N 제한".
- backlink list ≤ 5 (Spec 2 I7 truncation) 라도 default expand 시 매 query 결과마다 추가 5 줄 → chat scroll 부담.
- §5.10 paradigm shift 정신 (UI 단순화, Suggestions panel 폐기) 과 정합 → default minimize.

**LOCK**: default **collapse** (HTML `<details>` 구조). 사용자가 한 번 클릭으로 열기. expand 토글은 Obsidian markdown renderer native 지원.

### Q3 LOCK — diagnostic command 결과 출력 형식

**질문**: Notice / modal / new page?

**조사**:
- Notice: 짧음 (수 초 후 사라짐) → 38 page mismatch list 표시 불가.
- 새 page: registry 진단을 wiki/ 에 산물로 남기는 건 schema 와 충돌 ("wiki/ 는 지식 page only", lint/query 행위 결과는 log.md 만 — §5.11 v2).
- modal: 기존 wikey 패턴 (`DeleteImpactModal` / `ResetImpactModal` / `WikeyStatsModal` — `wikey-obsidian/src/reset-modals.ts:26,116` + `status-bar.ts:75`) 과 정합. drawer/scroll 지원, 닫기 시 state 정리.

**LOCK**: 별 **Modal** (`MismatchDiagnosticModal extends Modal`). 위치 = `wikey-obsidian/src/commands.ts` 끝 또는 신규 file `diagnostic-modal.ts` (Step C developer 판단). body summary + per-mismatch block (sourceId + page list ≤ 10 + 더보기 hint).

### Q4 LOCK — WARN log sensitive content

**질문**: WARN log 가 사용자 vault path / 본문 노출 가능성?

**조사**:
- 보호 대상: raw vault path (사용자 폴더 hierarchy 노출), 답변 본문 (LLM 합성 결과 — 사용자 conversational 내용), citation excerpt (page snippet — 사용자 자료 노출).
- 허용: sourceId (이미 frontmatter 에 평문, hash → original 역추적 불가), wiki page path (LLM 가 생성한 표준 slug — `wiki/entities/claude-code.md` 형식).
- console.warn 은 사용자 본인이 devtools 에서만 보는 것이지만, 외부 telemetry 가능성 (Phase 6 web 단계) 까지 고려 시 보수적.

**LOCK**: WARN 형식 = `[wikey citation] sourceId=<id> not found in registry (page=<wiki page path>)`. **포함**: sourceId raw form, wiki page path. **제외**: raw vault path, 답변 본문, excerpt, 사용자 query text.

## 변경 면 추정 (v0.2 갱신)

- `wikey-core/src/query-pipeline.ts` — appendOriginalLinks format + WARN log (+25~30 LOC).
- `wikey-obsidian/src/sidebar-chat.ts` — backlink section render (+60~80 LOC).
- `wikey-obsidian/src/commands.ts` — diagnostic command + MismatchDiagnosticModal (+80~100 LOC).
- `wikey-obsidian/styles.css` — collapse + modal style (+15~25 LOC).
- 신규 test 3~4개 (query-pipeline format + sidebar-chat backlink + commands diagnostic).

**총합**: 180 ~ 235 LOC (≤ 200 LOC budget 근접, modal/state 회피로 절감).

## 변경 이력

- v0.1 (2026-05-11): draft 신규.
- v0.2 (2026-05-12 analyst): Q1~Q4 LOCK + 변경 면 재추정 + Step A 완료 표기.
