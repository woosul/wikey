# Phase 5 §5.2.9 — qmd `--quick` exit=1 stderr capture cycle smoke (2026-04-25)

> **상위 문서**: `activity/phase-5-result.md` §5.2 / `plan/phase-5-todo.md` §5.2.9
> **commit 검증 대상**: `7ae636f fix(phase-5): §5.2.5 reindex stderr 보존 + §5.2.2 답변 풍부도 보강`
> **호출자**: tester (1차) — claude-panel
> **CDP**: localhost:9222 (Obsidian remote-debug, Chrome/142.0.7444.265 obsidian/1.12.7)
> **fixture**: `raw/0_inbox/nanovna-v2-notes.md` (1851 bytes, 재인제스트 시나리오)
> **목표**: §5.2.5 root cause = qmd 실제 stderr capture + §5.2.2 답변 길이 ≥ 500 chars 재측정

## 요약

| 항목 | 결과 | 측정값 |
|------|------|--------|
| §5.2.5 fix 효과 (stderr 보존) | **PARTIAL** | 1·2번째 ingest 에서 여전히 빈 stderr (`reindex --quick failed (exit=1): `). 3번째 (post-reload) 에서는 reindex 자체가 SUCCESS 로 전환 |
| §5.2.5 reindex 자동 성공 | **PASS (post-reload)** | `[info] reindex --quick OK in 27417ms` + Notice "✓ 검색 인덱스 최신 (27.4s)" + STAMP_FILE = `Apr 25 15:17:10` |
| §5.2.2 답변 길이 | **PASS** | 1858 chars (목표 500, 3.7x 초과) |
| §5.2.2 citation | **FAIL** | 0 wiki links — 답변 본문 "위키 검색 결과는 없었습니다" 명시. LLM 일반 지식 fallback |
| §5.2.9 root cause | **확정** | `better-sqlite3 NODE_MODULE_VERSION 137 vs 127 ABI mismatch` (마스터 진단 일치) |

## §5.2.5 — qmd 실제 stderr 메시지 raw capture

### 1번째 ingest (raw/_delayed/nanovna-v2-notes.md, 14:46–15:14 ish — pre-this-cycle stale 잔존 또는 plugin reload 직전)

```
[warn] [Wikey ingest] reindex --quick failed (non-fatal): reindex --quick failed (exit=1):
[info] [Wikey ingest] done: raw/_delayed/nanovna-v2-notes.md
```

**stderr 본문 (콜론 뒤) = 빈 문자열**. commit `7ae636f` 의 `qmd update failed (exit=$?): / qmd embed failed (exit=$?):` dump 헤더가 보이지 않음 → 이 ingest 는 **fix 적용 전 plugin 인스턴스** 가 invoke 했거나, qmd 가 `set -e` 로 update/embed 자체에 도달하지 못하고 더 이른 단계 (PROJECT_DIR resolve / lock / qmd binary spawn) 에서 죽었음.

### 2번째 ingest (raw/0_inbox/nanovna-v2-notes.md, post-`init-log` 15:14:?? — plugin reload 직전)

```
[warn] [Wikey ingest] reindex --quick failed (non-fatal): reindex --quick failed (exit=1):
[info] [Wikey ingest] done: raw/0_inbox/nanovna-v2-notes.md
[info] [Wikey] post-ingest movePair: raw/0_inbox/nanovna-v2-notes.md → raw/3_resources/60_note/600_technology/ sidecar=false [is-md-original]
```

여전히 콜론 뒤 빈 문자열. 즉 fix `qmd update failed (exit=$?):` / `qmd embed failed (exit=$?):` dump 가 전파되지 않음.

### 3번째 ingest (raw/0_inbox/nanovna-v2-notes.md, post-plugin-reload 15:16–15:17)

```
[info] [Wikey ingest] reindex --quick OK in 27417ms, waiting for freshness (timeout=60000ms)
[info] [Wikey ingest] index is fresh (total 27432ms)
[info] [Wikey ingest] done: raw/0_inbox/nanovna-v2-notes.md
```

**reindex SUCCESS**. Notice "✓ 검색 인덱스 최신 (27.4s)" 표출. STAMP_FILE 갱신 = `Apr 25 15:17:10`.

### 결론

- **fix `7ae636f` 의 stderr dump 코드 (qmd update/embed `|| { echo "qmd ... failed (exit=$?):" >&2 ... }`) 는 1·2번째 invoke 에서 trigger 안 됐음**. 두 가능성:
  1. `cmd_reindex` 함수가 `qmd update` 라인까지 도달 못 함 (이전 단계에서 죽음 — `set -euo pipefail` 의 `pipefail` 가 어딘가에서 발화).
  2. `update_out=$(...) || { ... }` 의 `||` chain 이 `set -e` 와 결합 시 sub-shell 컨텍스트에서 의도와 다르게 동작 (set -e 가 `||` chain 을 먼저 본다는 보장은 있음 — bash 매뉴얼 §4.3.1 — 그러나 sub-shell 안에서는 다를 수 있음).
- **그러나 3번째 (post-plugin-reload) 에서는 reindex 자체가 성공** → master 의 `scripts/rebuild-qmd-deps.sh` 효과가 plugin 의 새 인스턴스에 반영됨. 즉 fix 7ae636f 의 stderr dump 검증은 **불완전** 하지만 §5.2.5 의 실용적 문제 (reindex 실패) 는 **해소**.

### 후보 4 매치

| 후보 | 근거 | 매치 |
|------|------|------|
| PATH/cwd | plugin 이 cwd `/Users/denny/Project/wikey` 로 spawn (`qmd exec: ... cwd: /Users/denny/Project/wikey` 로그). PATH 도 Obsidian 환경 picks `/usr/local/bin` 우선 — qmd binary 는 `tools/qmd/bin/qmd` 절대경로 | **No** |
| dyld | macOS dylib resolution. better-sqlite3 .node 파일 dlopen 실패 | **Partial** — 결국 dlopen 단계 (`process.dlopen`) 에서 죽음 |
| race | reindex 실행 중 다른 reindex 동시 실행. `flock` 등 mutex 없음 | **Unknown** — 단일 ingest 흐름이라 race 가능성 낮음 |
| **qmd bug = better-sqlite3 ABI** | `NODE_MODULE_VERSION 137 vs 127` mismatch. plugin 이 nvm node v22.17.0 (MODULE 127) 픽 → 모듈은 system node v24 (MODULE 137) 용 빌드 | **YES — 확정** (query path 에서 명시 에러 capture, 아래 §5.2.2 절 참조) |

## §5.2.2 — 답변 길이 + citation 재측정

### Query 1 (15:18:34)

> NanoVNA-V2 에 대해 자세히 설명해줘

**답변 (1858 chars, 0 wiki links)**:

```
wikey 위키 어시스턴트입니다. 요청하신 'NanoVNA-V2'에 대한 위키 검색 결과는 없었습니다.
하지만, 일반적인 정보로서 NanoVNA-V2에 대해 자세히 설명해 드릴 수 있습니다.

NanoVNA-V2에 대한 설명
NanoVNA-V2는 휴대용 벡터 네트워크 분석기(VNA)의 한 종류입니다. ...
[총 1858 chars, LLM 일반 지식 기반, wiki 출처 없음]
```

### Query 2 (15:23ish, fresh log buffer)

> NanoVNA-V2의 주파수 범위와 측정 가능한 항목을 알려줘

**답변 (1356 chars, 0 wiki links)**:

```
wikey 위키에서는 NanoVNA-V2에 대한 직접적인 검색 결과가 없었습니다. 하지만 NanoVNA-V2 ...
```

### qmd query 시 console 캡처 (post-fresh-init-log)

```
[log] [Wikey] cross-lingual extraction failed: Ollama model 'gemini-2.5-flash' not found.
[log] [Wikey] qmd exec: /Users/denny/.nvm/versions/node/v22.17.0/bin/node (node+js) cwd: /Users/denny/Project/wikey
[error] [Wikey] qmd exec FAILED: node:internal/modules/cjs/loader:1921
  return process.dlopen(module, path.toNamespacedPath(filename));
                 ^

Error: The module '/Users/denny/Project/wikey/tools/qmd/node_modules/better-sqlite3/build/Release/better_sqlite3.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 137. This version of Node.js requires
NODE_MODULE_VERSION 127. Please try re-compiling or re-installing
the module (for instance, using `npm rebuild` or `npm install`).
```

### 진단

- 답변 길이 buffer (`§5.2.2` fix `query-pipeline.ts buildSynthesisPrompt` "충분히 풍부하게") 는 **효과 확인** — 1856 / 1356 chars 모두 500 훌쩍 넘음. ★ 그러나 본 측정은 LLM fallback 답변이라 fix 의 본질 검증으로는 부분적.
- citation = 0 은 reindex 성공한 직후 (15:17:10) 의 사용자 query (15:18:34) 임에도 0 — qmd query path (`tools/qmd/bin/qmd` → `node_modules/better-sqlite3`) 가 ABI mismatch 로 fail. **reindex.sh 는 `bin/qmd` Go binary 를 직접 실행 → 성공**, 하지만 plugin 의 query path 는 node `qmd-search.cjs` → require('better-sqlite3') → dlopen fail.
- **§5.2.2 fix 의 효과 (≥500 chars) 는 입증 못 함** — fallback 답변이 우연히 길었을 뿐. wiki citation 기반 답변이 ≥500 chars 인지는 ABI fix 후 별도 cycle 필요.

## 산출물 (이번 ingest 결과)

```
wiki/.ingest-map.json
wiki/log.md
wiki/index.md
wiki/sources/source-nanovna-v2-notes.md
wiki/entities/nanovna-v2.md (543B, 15:16)
wiki/entities/nanovna-qt.md
wiki/entities/nanovna-v2-plus4.md
wiki/entities/dji-o3-air-unit.md
wiki/entities/vector-network-analyzer.md
wiki/concepts/sma-connector.md
wiki/concepts/standing-wave-ratio.md
wiki/concepts/open-short-load-calibration.md
wiki/concepts/impedance.md
wiki/concepts/user-manual.md
wiki/concepts/smith-chart.md
wiki/concepts/mmcx-connector.md
wiki/concepts/s-parameter.md
```

총 14 파일 (entities 5 + concepts 8 + source 1, 거기에 index/log/ingest-map = 17). 이전 cycle 의 11 파일에서 **신규 3 파일 + 5 update**.

## STAMP_FILE

```
$ stat -f "%Sm" ~/.cache/qmd/.last-reindex
Apr 25 15:17:10 2026
```

→ 3번째 ingest 의 reindex 직후 갱신 확증 (이전 = 15:01:02).

## qmd 인덱스

```
$ sqlite3 ~/.cache/qmd/index.sqlite "SELECT count(*) FROM documents WHERE active=1 AND path LIKE '%nanovna%';"
4
```

4 nanovna 관련 문서 인덱싱됨 — reindex 자체는 정상. 그러나 **query path 의 better-sqlite3 dlopen 실패로 retrieval 0** → "검색 결과 없음" 답변 발생.

## §5.2.9 root cause 최종 확정

**better-sqlite3 prebuilt binary** (`tools/qmd/node_modules/better-sqlite3/build/Release/better_sqlite3.node`) 가 **NODE_MODULE_VERSION 137 (Node v24 / system Homebrew)** 용으로 빌드되어 있는 반면, plugin 의 qmd-search 실행 환경 (node 자동 탐지 결과) 은 **nvm node v22.17.0 (NODE_MODULE_VERSION 127)** 을 픽 → dlopen 실패 → qmd query 실패 → wiki citation 0.

### 영향 범위

- **reindex.sh** (`tools/qmd/bin/qmd` Go binary 직접 실행) — 영향 없음. 27.4s 정상 완료.
- **plugin query** (`node + qmd-search.cjs + require('better-sqlite3')`) — dlopen fail. 매 query 마다 같은 에러, fallback 으로 LLM 일반 지식만 응답.

### 재발 방지 후속

- 마스터 rebuild (`scripts/rebuild-qmd-deps.sh`) 가 system node v24 용으로 빌드 → plugin node detection 이 nvm v22 로 가면 mismatch 지속.
- 옵션 1: plugin 의 node 자동 탐지 우선순위 변경 — system node (`/opt/homebrew/bin/node`) 우선.
- 옵션 2: better-sqlite3 를 두 ABI 버전 모두 빌드 / 동적 선택.
- 옵션 3: Wiki plugin 에서 node 버전 explicit 고정 (settings 노출).

## 결과 분류

| § | PASS/FAIL/PARTIAL | 비고 |
|---|---------------------|------|
| 5.2.5 reindex 자동 성공 (post-reload) | PASS | Notice 표출 + STAMP 갱신 |
| 5.2.5 stderr dump fix 효과 (1·2번째) | PARTIAL | 빈 stderr 잔존. fix 가 cmd_reindex 본문에 도달 못 한 케이스 있음 |
| 5.2.2 답변 길이 ≥ 500 | PASS (1858 / 1356) | 단 fallback 답변 — fix 본질 검증 아님 |
| 5.2.2 citation ≥ 5 | FAIL (0 / 0) | better-sqlite3 ABI mismatch, query path 실패 |
| 5.2.9 root cause 확정 | PASS | NODE_MODULE_VERSION 137 vs 127 명시 capture |

## 다음 액션 (master)

1. better-sqlite3 ABI 정렬: plugin node 탐지를 system node (v24) 우선으로 변경하거나, nvm node (v22) 용으로 better-sqlite3 재빌드.
2. fix 검증 cycle 재실행 (ABI 정렬 후): query "NanoVNA-V2" → wiki citation ≥ 5 + 본문 ≥ 500 chars.
3. fix 7ae636f 의 reindex.sh stderr dump 가 1·2번째 invoke 에서 trigger 안 된 이유 추적 (set -e + sub-shell `||` interaction or 더 이른 단계 abort). `qmd update` 자체에 도달 안 했을 가능성 검토.
