# Phase 5 §5.2 Cycle Smoke — 2026-04-25

> **상위 문서**: `activity/phase-5-result.md` §5.2 / `plan/phase-5-todo.md` §5.2.0~5
> **commit 검증 대상**: `f108e0c feat(phase-5): §5.2.0~5 검색·답변 품질 6건 통합`
> **호출자**: tester (1차) — claude-panel
> **CDP**: localhost:9222 (Obsidian remote-debug)
> **fixture**: `raw/0_inbox/nanovna-v2-notes.md` (1851 bytes, NanoVNA V2 한국어 노트)

## 요약

| 항목 | 결과 | 측정값 |
|------|------|--------|
| §5.2.0 [md] 뱃지 (Audit List) | **PASS** | `wikey-pair-sidecar-badge` 5건 (PDF/HWP/HWPX), 7 rows from 12 raw files (sidecar 5건 hide) |
| §5.2.0 [md] 뱃지 (Audit Tree) | **PASS** | 7 files, 5 badged (확장 후), 2 unbadged = 진짜 .md (nanovna, llm-wiki) |
| §5.2.0 [md] 뱃지 (Ingest List) | **PASS** | inbox=1 (nanovna only, 사이드카 없음 — 정상) |
| §5.2.0 tooltip | **PASS** | hover시 `📄 sidecar: PMS_제품소개_R10_20220815.pdf.md\n📅 created: 2026-04-24 21:21` |
| §5.2.0 카운트 | **PASS** | "All 7 / Ingested 0 / Missing 7" — 사이드카 제외 후 정확 |
| §5.2.1 cross-link (entity) | **PASS** | nanovna-v2.md distinct wikilinks=5 (≥3 ✓), `## 관련` H2 등장, `## 출처` 앞 위치 ✓ |
| §5.2.1 cross-link (concept→entity) | **PASS** | swr.md / s-parameter.md 둘 다 6 entity 백링크 (`[[nanovna-v2]]`, `[[vna]]`, `[[v2-plus4]]`, `[[nanovna-qt]]`, `[[dji-o3-air-unit]]`, `[[dji]]`) |
| §5.2.1 본문 길이 | **PASS** | 27 lines (baseline 22 → +5 lines) |
| §5.2.2 답변 길이 | **PARTIAL** | 495 chars (목표 500 미달, 5 chars 차이) |
| §5.2.2 citation | **PASS** | 11 wiki refs in `참고:` 블록, inline links 15+ |
| §5.2.3 graph expansion | **PASS** | 답변 `참고:` 블록에 1-hop target 등장 (dji, dji-o3-air-unit — 질문 외 페이지가 graph 확장으로 등장) |
| §5.2.4 TOP_N=8 | **PASS** | `wikey.conf`: `WIKEY_QMD_TOP_N=8` 적용 (런타임 결과는 corpus 의존: results=5/1) |
| §5.2.5 reindex success Notice | **FAIL** | console에 `[warn] reindex --quick failed (non-fatal): exit=1` 표출. STAMP_FILE 미갱신 (pre-ingest 14:10:48 그대로) |

## §5.2.0 paired sidecar UI 일관화 — PASS

### Audit List view

7 rows (sidecar.md 5건 dedupe 후):
- nanovna-v2-notes.md (no sidecar)
- PMS_제품소개_R10_20220815.pdf **md**
- 스마트공장_보급확산_합동설명회_개최.hwp **md**
- C20260410_용역계약서_SK바이오텍...pdf **md**
- 사업자등록증C_(주)궛스트림...pdf **md**
- Examples.hwpx **md**
- llm-wiki.md (no sidecar)

DOM 구조: `<span class="wikey-pair-sidecar-badge" title="📄 sidecar: <name>\n📅 created: <date>">md</span>`.

Summary stat: `All 7 / Ingested 0 / Missing 7 / 0 selected` — 사이드카 dedupe 후 정확.

### Audit Tree view

수동 expand 후 같은 7 file (5 badged). caret class `wikey-audit-tree-chev-open` 으로 확장 상태 감지.

### Ingest panel

raw/0_inbox/ 만 표시 (1 file: nanovna). 사이드카는 inbox에 없어 dedupe 효과는 없지만 동일 row builder 사용 확인.

## §5.2.1 entity↔concept cross-link — PASS

### nanovna-v2.md (생성 직후)

```markdown
# nanovna-v2

NanoVNA V2는 50kHz~3GHz 대역을 측정하는 소형 벡터 네트워크 분석기(VNA)이다.

## 관련

- [[mmcx]]
- [[s-parameter]]
- [[sma]]
- [[swr]]

## 출처

- [[nanovna-v2-notes]]
```

- `## 관련` H2: ✓ 등장
- `## 출처` 앞 위치: ✓
- alphabetical concept wikilink: 4건 (mmcx, s-parameter, sma, swr) ≥ 3 ✓
- `grep -oE '\[\[[^]|#]+' wiki/entities/nanovna-v2.md | sort -u | wc -l` = **5** (4 concepts + 1 source)
- 본문 27 lines (baseline ~22 → +5)

### concept → entity 양방향 (예: swr.md)

```markdown
# swr

SWR(Standing Wave Ratio)은 전송선로에서 ...

## 관련

- [[dji]]
- [[dji-o3-air-unit]]
- [[nanovna-qt]]
- [[nanovna-v2]]
- [[v2-plus4]]
- [[vna]]

## 출처

- [[nanovna-v2-notes]]
```

같은 cycle 의 entities 6건 모두 backlink — bidirectional cross-link 완비.

## §5.2.2~3 답변 prompt 강화 + graph expansion — PASS / PARTIAL

질문: `"NanoVNA가 무엇이고 어떤 측정에 사용되나요?"`

답변 (495 chars, **목표 500 미달 5 chars**):

```
nanovna-v2는 50kHz에서 3GHz 대역을 측정하는 소형 vna(Vector Network Analyzer)입니다.
vna는 RF 장비의 주파수 응답 특성을 측정하는 도구이며, NanoVNA는 이러한 주파수 응답
특성을 측정하는 데 사용됩니다.
NanoVNA는 s-parameter와 swr 같은 특성을 측정합니다. nanovna-v2의 확장 모델인
v2-plus4는 주파수 측정 범위가 4.4GHz까지 확장된 소형 벡터 네트워크 분석기입니다.
NanoVNA 장비를 제어하고 측정 데이터를 시각화하기 위해 nanovna-qt라는 오픈소스
소프트웨어 도구를 사용합니다. 이 장비는 일반적으로 sma 및 mmcx 커넥터를 사용합니다.
참고: nanovna-v2, vna, v2-plus4, nanovna-qt, dji-o3-air-unit, dji, swr,
s-parameter, sma, mmcx, source-nanovna-v2-notes
원본: (없음 — 외부 근거 없음)
```

inline citation links (`a[href*="obsidian.md/"]`): **15+** (nanovna-v2 ×3, vna ×2, v2-plus4 ×2, nanovna-qt ×2, sma, mmcx, s-parameter, swr, dji-o3-air-unit, dji 등).

`참고:` 블록 wiki refs: **11** (목표 ≥5 ✓).

graph expansion 증거: 질문은 NanoVNA 만 묻지만 `dji`, `dji-o3-air-unit` 이 답변 + 참고에 등장 → search top-N + 1-hop expansion (concept↔entity cross-link 따라가서) 동작 확증.

## §5.2.4 TOP_N=8 — PASS

`wikey.conf`: `WIKEY_QMD_TOP_N=8` 명시. 답변 시 console:
```
qmd results: 5
qmd results: 1
```
TOP_N은 cap 이며 corpus 부족 시 ≤8 반환. cap 자체는 적용됨.

## §5.2.5 reindex silent fail observability — FAIL

ingest 직후 console 로그:
```
[info] [Wikey ingest] index.md updated — LLM entries=14, total written pages=15
[warn] [Wikey ingest] reindex --quick failed (non-fatal): reindex --quick failed (exit=1):
```

- STAMP_FILE (`~/.cache/qmd/.last-reindex`) 미갱신: pre-ingest `Apr 25 14:10:48` 그대로
- 후속 `bash ./scripts/reindex.sh --check` 결과:
  ```
  마지막 인덱싱: 2026-04-25 14:10
  변경된 파일: wiki/log.md, wiki/index.md, wiki/concepts/sma.md, ...
  → ./scripts/reindex.sh 실행 추천
  ```

**§5.2.5 의 본질은 "silent fail observable" — observable 부분 ✓ (warn 표출). 그러나 success Notice 미등장 + STAMP 미갱신 = 사용자에게 "최신" Notice가 안 보임.**

근본 원인 추적 필요: `reindex --quick` exit=1 의 stderr가 build script 에서 swallowed (메시지 본문 비어있음). 다음 단계로 reindex --quick 자체의 실패 진단 (Phase 5 §5.2.5 follow-up).

## 산출물

- 신규 wiki: 11 files (1 source + 6 entities + 4 concepts) + index/log update
- entity ↔ concept cross-link 양방향 완성
- 답변 prompt 강화 적용 (495 chars, citation 11, graph expansion 작동)

## 후속 follow-up

1. **§5.2.5 reindex --quick exit=1 근본 원인** — stderr 보존 + 실패 시 `reindex` Notice 별도 표시 (silent → loud).
2. **§5.2.2 답변 길이 +5 chars buffer** — prompt 길이 임계값 재조정 (현 ~495, 목표 ≥500). 1 sentence 추가 prompt 가이드.
3. **§5.2.0 cycle 후 Audit count refresh** — 새로 ingest된 source는 Audit가 즉시 반영하는지 별도 smoke (현 cycle 에선 inbox만 1건이라 검증 보류).

## 환경 메타

- node v22.17.0 / Obsidian CDP --remote-debugging-port=9222
- gemini-2.5-flash (ingest provider)
- wikey-obsidian/main.js: 259900 bytes, mtime 2026-04-25 14:38
- plugin reload via `disablePlugin/enablePlugin` 후 진행
- ingest cycle wall-clock: ~50s (Brief load → Proceed → Preview ready), Approve & Write → wiki write ~3min
