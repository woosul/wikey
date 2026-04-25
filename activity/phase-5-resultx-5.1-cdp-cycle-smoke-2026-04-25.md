---
title: §5.1 PII fix 후속 — Obsidian CDP UI full cycle smoke (1 파일)
phase: 5
section: 5.1
date: 2026-04-25
type: resultx
---

> **상위 문서**: [`../activity/phase-5-result.md`](./phase-5-result.md) · [`../plan/phase-5-todo.md`](../plan/phase-5-todo.md)

## 1. 목적

§5.1 over-mask fix (commit `5e32ec4`) 와 example placeholder constants module (이번 commit) 변경이 plugin 경로 (Ingest 패널 → wiki 생성 → Query → citation) 전체에서 회귀 없이 동작하는지 1 파일로 확증. master 직접 CDP 실행 (사용자 정책: tester 위임은 다음 세션부터).

## 2. 환경

| 항목 | 값 |
|------|------|
| Obsidian | 1.12.7 (CDP `--remote-debugging-port=9222 --remote-allow-origins='*'`) |
| Plugin build | `npm run build` (cjs, `import.meta.url` 경고 1건 — bundled YAML loader fallback 동작) |
| Plugin path | `vault/.obsidian/plugins/wikey/main.js` (symlink → `wikey-obsidian/main.js`) |
| LLM Provider | Gemini 2.5 Flash (Brief/Mention/Canonicalize 동일) |
| 시작 baseline | commit `5e32ec4` (이전 PII over-mask fix 적용 상태) |

## 3. 샘플

| 파일 | 크기 | PII | 비고 |
|------|------|-----|------|
| `raw/_delayed/nanovna-v2-notes.md` | 35 lines, ~1.7 KB | 0 (BRN/CEO/주소 0 hits) | technical note, RF/안테나 |

## 4. 진행 (timing)

| 단계 | 시작 | 끝 | 시간 | 비고 |
|------|------|------|------|------|
| Plugin reload | — | — | — | `app.plugins.disable+enable('wikey')` |
| File open | — | — | — | `app.workspace.getLeaf().openFile()` |
| `wikey:ingest-current-note` | — | — | — | Brief modal 등장 |
| **Brief → Proceed** | — | — | 즉시 | 모달 [Proceed] 클릭 (이 클릭 누락이 첫 시도 hang 원인) |
| Processing | 12:01:05 | 12:02:30 | 1분 25초 | Stage 1 brief + Stage 2 mention + Stage 3 canonicalize. Notice 안 보였지만 console log `[Wikey brief] start: ...` 만 진입 표시 |
| Preview modal | 12:02:30 | — | — | Approve & Write 버튼 등장 확인 |
| **Approve & Write** | — | — | 즉시 | 모달 클릭 → wiki write |
| Wiki write | 12:02:30 | 12:02:35 | ~5초 | 14 + 1 + 3 = 18 file write (entities/concepts/source/log/index/.ingest-map.json) |
| Query 1 (reindex 전) | — | — | ~30초 | 답변 OK 사실 인용, 그러나 **citation 0** ("Wikey 위키에서 직접적 검색 결과 없음") |
| `./scripts/reindex.sh` | — | — | 12초 | 16 new + 2 updated indexed, 53 chunks embedded |
| Query 2 (reindex 후) | — | — | ~20초 | citation **포함** — `[[nanovna-v2]] 📄` + `[[source-nanovna-v2-notes]]` + 원본 backlink |

## 5. wiki 생성물 (ingest 직후)

```
wiki/log.md          (새 entry)
wiki/index.md
wiki/.ingest-map.json
wiki/sources/source-nanovna-v2-notes.md
wiki/entities/
  nanovna-v2.md / nanovna-qt.md / nanovna-v2-plus4.md / dji-o3-air-unit.md / vector-network-analyzer.md
wiki/concepts/
  s11-parameter.md / s21-parameter.md / s-parameter.md / standing-wave-ratio.md /
  smith-chart.md / sma-connector.md / mmcx-connector.md /
  first-person-view.md / fpv-digital-transmission.md
```

총 **5 entities + 9 concepts + 1 source** = 15 신규 페이지 + log/index/ingest-map 갱신.

## 6. Query 결과 비교

### Query 1 (reindex 전)

```
질문: NanoVNA V2의 주파수 범위와 측정 가능한 항목(S-파라미터 등)은? 관련 위키 페이지도 알려줘.

답변 (1186 chars, citation 0):
"죄송합니다. Wikey 위키에서 'NanoVNA V2'에 대한 직접적인 검색 결과나 관련 페이지를
찾을 수 없었습니다. 하지만 일반적인 정보에 기반하여 ... 50 kHz ~ 3 GHz ... S11/S21/...
관련 위키 페이지: 현재 Wikey 위키에는 'NanoVNA V2'에 대한 전용 페이지가 없지만 ..."
```

원인: `./scripts/reindex.sh --check` → "마지막 인덱싱: 2026-04-24 21:09 / 변경된 파일 17 stale". qmd 인덱스에 새 페이지 미등록.

### Query 2 (reindex 후)

```
질문: NanoVNA V2의 주파수 범위와 측정 항목은? 관련 위키 페이지 링크도 같이 알려줘.

답변 (184 chars, citation 4):
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
- 사실 정확성: 50kHz~3GHz / S11/S21/임피던스/스미스 차트/SWR 모두 fixture 본문과 일치
- Wiki citation: `[[nanovna-v2]]` entity + `📄` wikey-citation-link
- Source citation: `[[source-nanovna-v2-notes]]`
- **원본 backlink** (Phase 4 §4.3.2 Part B): `raw/_delayed/nanovna-v2-notes.md` 1-hop
- Hallucination 0 (없는 사실 등장 없음)
- PII 누출 0 (NanoVNA fixture PII free 라 자연 OK)

## 7. 발견·교훈

| # | 항목 | 비고 |
|---|------|------|
| 1 | Brief modal Proceed 미클릭 hang | 첫 시도 5분+ hang. 모달 클릭이 cycle 의 **명시적 단계**. 메모리 `feedback_obsidian_modal_proceed.md` + `~/.claude/skills/obsidian-cdp/SKILL.md §6.3` 명문화 |
| 2 | reindex 누락 시 citation 0 | ingest 직후 검색 안 됨. cycle 의 의무 단계로 reindex 명문화 (skill §6.6 직후) |
| 3 | 이전 산출물 미참조 → 재발명 | `scripts/smoke-cdp.sh` + `phase-4-todox-4.6-integrated-test.md` 가 정확한 패턴 보유. 메모리 `feedback_reuse_prior_artifacts.md` |
| 4 | cjs build `import.meta.url` 경고 | bundled YAML loader 가 plugin 경로에서 fallback 동작. structural PII 패턴 미사용 가능성 — 별도 ticket (이번 cycle 은 PII free 샘플이라 영향 X) |
| 5 | tester CDP 책임 (다음 세션부터) | 사용자 정책. `~/.claude/agents/tester.md` "CDP·E2E 검증 1차 책임" 추가 |

## 8. 판정

- **Ingest cycle**: PASS (ingest → wiki write → Query 답변 + citation + 원본 backlink 모두 확증).
- **§5.1 over-mask fix 회귀**: 영향 없음 (PII free 샘플로 검증). PII-heavy 샘플 (예: 사업자등록증 PDF) 은 별도 ticket.
- **example placeholder constants module**: prompt few-shot 에 새 placeholder 가 들어간 채 LLM 이 정상 응답 (canonicalize 결과물 형식 깨지지 않음, 14 entity/concept 정상 생성).

## 9. 발견된 원인 (현 세션 진단) + Follow-up (다음 세션 fix)

### 9.1 자동 reindex 실패 — 원인 후보 좁힘

**코드 wiring 정상** (`ingest-pipeline.ts:498` `runReindexAndWait` 항상 호출, `commands.ts:422-425` plugin 의 `onFreshnessIssue` callback 등록):
```ts
// ingest-pipeline.ts:497-498
onProgress?.({ step: 4, total: 4, message: 'Indexing...' })
await runReindexAndWait(opts?.basePath, opts?.execEnv, log, opts?.onFreshnessIssue)
```

**그런데** 본 cycle 직후 `./scripts/reindex.sh --check` → "마지막 인덱싱 2026-04-24 21:09 / 변경된 파일 17 stale" (24시간 전). 자동 reindex 가 호출됐지만 인덱스 timestamp 갱신 안 됨. callback Notice 도 발동 안 함 ("인덱싱 실패" / "인덱스 갱신 지연" 없었음).

**원인 후보 (확정은 다음 세션에서 console log 캡처 + reindex --quick 단독 실행으로)**:
1. **`reindex.sh --quick` silent fail** — quick 모드는 `qmd update + embed` 만. 빠르게 exit 0 반환하지만 새 wiki 파일이 disk 에 다 flush 되기 전 실행됐을 가능성 (race). `runReindexAndWait` 호출 시점이 `appendLog` 직후 (Step 3 끝, `entries written` 직후) — wiki/entities/*.md 등이 fsync 전일 수도.
2. **plugin execEnv 의 PATH 누락** — `runReindexAndWait` 가 `extraPaths = ['/usr/local/bin', '/opt/homebrew/bin']` 추가하지만 `qmd` binary 가 다른 경로에 있을 수도. silent ENOENT 가능.
3. **`reindex.sh --quick` 의 timestamp 갱신 누락** — `--quick` 가 qmd update 만 하고 `last_indexed_at` 같은 metadata 미갱신. `--check` 가 그 metadata 로 stale 판정 → 항상 stale 보고. 코드 조사 필요 (`reindex.sh` 스크립트 + qmd binary 의 stale flag 위치).
4. **`waitUntilFresh` timeout 60s default** — 1.7KB 파일이라 short 하지만 wiki 17 파일 신규 색인 + embed (10초 측정) → quick 으로도 가능. 60s 안에 fresh 안 되면 silent timeout (warn 만, throw 안 함).

**다음 세션 진단 routine**:
1. 새 fixture 1개 ingest + console log 전체 capture (`init-log` 후 끝까지 보존, 중간 `capture-logs` 호출 금지)
2. log 에서 `reindex --quick OK` / `freshness wait timed out` / `reindex --quick failed` 중 어느 메시지 발생했는지 확인
3. 동시에 `bash ./scripts/reindex.sh --quick` 단독 실행 → exit code + stderr + 후속 `--check` timestamp 변화 측정
4. 후보 1~4 중 매치 → 코드 fix (race → debounce / PATH → execEnv 보강 / timestamp → quick metadata 갱신 / timeout → setting up)

### 9.2 movePair 미발동 — **결함 아님, 사용자 의도된 동작**

`commands.ts:442` 의 정확한 가드:
```ts
if (ctx.autoMoveFromInbox && sourcePath.startsWith('raw/0_inbox/')) {
  // classify + movePair
}
```

→ **`raw/0_inbox/` 외 위치에서 ingest 하면 movePair 자체 발동 안 함**. `raw/_delayed/` 같은 사용자 보류 폴더는 분류 자동 이동 대상 아님 (의도된 동작). 본 cycle 결함 = "샘플을 _delayed/ 에 둔 채로 ingest 진행" — IV.A 검증 (movePair) 항목 자체를 검증 못함.

→ skill `obsidian-cdp` §6.0 에 "샘플은 반드시 raw/0_inbox/" 명시 추가됨.

### 9.3 답변 짧음 + 연관 wiki 미인용 — 원인 좁힘

**Prompt** (`query-pipeline.ts:310 buildSynthesisPrompt`):
```
당신은 wikey 위키 전문가입니다. 아래 위키 페이지 내용을 종합하여 확정적으로 답변하세요.
- 여러 페이지에 흩어진 정보를 종합하여 하나의 완성된 답변
- 답변 끝에 "참고: [[페이지명]], [[페이지명]]" 형식으로 출처를 나열
```

**한계 (확정 원인)**:
1. **검색 chunk 가 적음** — `WIKEY_QMD_TOP_N = 5` (`wikey.conf` + `config.ts:15` default). 17 신규 + 기존 페이지 중 LLM 에게 전달되는 건 top-5 chunk. NanoVNA 질문 → nanovna-v2.md, source-nanovna-v2-notes.md 가 top hit, 나머지 9 concepts (smith-chart 등) 는 score 낮아 미포함.
2. **Prompt 가 "모든 관련 페이지" 인용 강제 없음** — "참고: [[..]]" 형식만. LLM 은 보수적으로 직접 search 결과만 참조. 그래프 traversal (entity → 관련 concept) 지시 없음.
3. **답변 길이 강제 없음** — "확정적", "종합" 만. min 답변 길이 / 모든 검색 hit cover 같은 강제 없음.

**Fix 방향 (다음 세션)**:
- **단기**: TOP_N 7~10 으로 상향 (Phase 5 §5.2 검색 재현율과 합쳐 진행). prompt 에 "검색된 모든 페이지 + 그 페이지가 link 한 wiki 페이지까지 인용" 지시 추가.
- **중기**: query-pipeline 에 **graph expansion** — search top-N 의 wikilink target 을 1-hop 추가로 fetch (Phase 5 §5.5 지식 그래프 직결). entity/concept cross-reference 자동 풍부화.
- **장기**: Anthropic contextual retrieval (Phase 5 §5.2) — chunk 자체에 문서 맥락 prefix 주입 → 작은 TOP_N 으로도 의미 풍부.

### 9.4 그 외

- PII-heavy 샘플 (사업자등록증 PDF 같이 BRN/CEO 포함) 의 cycle smoke — over-mask fix 가 plugin 경로에서 정확히 동작하는지
- cjs `import.meta.url` 경고 → bundled YAML loader 의 plugin-환경 호환 (structural PII 가 plugin 안에서 동작하는지 확증)
- `wikey:ingest-current-note` 진행 중 Notice 미표시 — UX 개선 검토
