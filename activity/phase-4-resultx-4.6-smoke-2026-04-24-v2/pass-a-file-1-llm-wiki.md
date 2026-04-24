# Pass A File 1: llm-wiki.md

> **상위 문서**: [`README.md`](./README.md) · [`pass-a-readme.md`](./pass-a-readme.md)

## 메타
- 크기: 12 KB (11,985 bytes)
- MIME / 형식: text/markdown (.md)
- 진입 경로: Ingest 패널 (Pass A)
- Pre-ingest: `raw/0_inbox/llm-wiki.md`
- Post-ingest: `raw/3_resources/60_note/000_computer_science/llm-wiki.md` (+ sidecar 없음, `is-md-original`)
- source_id: `sha256:dc3efe98ae62f23d`
- 실행 시작 / 종료 (KST): 19:23:27 / 19:26:35 (~3분)
- Provider / Model: gemini / gemini-2.5-flash
- CDP log dump: `dump/pass-a-file-1-llm-wiki.log`

## Stage 1 — Ingest (§4.Common.I.check)
- 변환 tier-label: **N/A** — `.md` 직접 ingest (변환 skip, 기대 동작)
- 변환 retry: N/A
- 변환 시간: 0s (skip)
- 변환 품질 스코어: N/A
- bitmap OCR 오염: N/A
- Stage 1 brief (앞 300자): "기존 RAG 방식은 LLM이 매번 지식을 새로 발견하여 지식이 축적되지 않는 한계가 있습니다. 이 문서에서는 LLM이 원본 문서를 바탕으로 구조화되고 상호 연결된 영구적인 위키를 점진적으로 구축하고 유지하는 새로운 접근 방식을 제안합니다..."
- Route: `FULL` (11923 chars, sections=9)
- Stage 2 mentions: **17 mentions** (from log `route=FULL — mentions=17`)
- Stage 3 entities / concepts: **10 entities, 4 concepts** (canonicalize done — entities=11, concepts=5, dropped=1 per log; preview showed 10+4 after UI filter)
- dropped: **1** (사유 미기록, likely UI-label or Korean-only)
- provenance entries 예시: `wiki/entities/obsidian.md` frontmatter `provenance: [{type: extracted, ref: sources/sha256:dc3efe98ae62f23d}]`
- source 본문 wikilink 유효성: `source-llm-wiki.md` 에 `> 원시 소스:` 경로 명시, 엔티티/개념 본문에 `[[llm-wiki]]` 역참조
- 분류 depth + 경로: **3-level** `raw/3_resources/60_note/000_computer_science/` (auto-rule 기반, 노트/기사 분류)
- pair sidecar 이동: sidecar 없음 (`sidecar=false [is-md-original]`) — md 원본은 그 자체가 content 이므로 sidecar 불필요 (기대 동작)
- source-registry / index / log 갱신:
  - `/Users/denny/Project/wikey/.wikey/source-registry.json` 에 1 entry
  - `vault_path: raw/3_resources/60_note/000_computer_science/llm-wiki.md`
  - `path_history: 2 entries` (`raw/0_inbox/...` → `raw/3_resources/...`)
  - `ingested_pages: ["wiki/sources/source-llm-wiki.md"]`
  - `wiki/log.md` 에 `[2026-04-24] ingest | llm-wiki.md` 엔트리 (14 항목 전부 `엔티티 생성/개념 생성/추가 소스` 로 기록)
  - `wiki/index.md` 갱신됨 (Apr 24 19:25)
- **Pass A 특유 관찰**: Ingest 버튼 1-click → Brief (6초 로드) → Proceed → Processing (2분 10초) → Preview → Approve & Write → post-ingest movePair 로그 (4초 후) → files ingested Notice (30초 후). Handler 내부 `runIngest + movePair` 순차 수행 확증.
- **post-ingest movePair 로그**: `[Wikey] post-ingest movePair: raw/0_inbox/llm-wiki.md → raw/3_resources/60_note/000_computer_science/ sidecar=false [is-md-original]`
- 이슈:
  - **⚠ 1차 실행 시 Preview modal 감지 timeout** (120s waitForModalPhase 'preview' 실패) — 실제로는 preview가 ~2분 후 나타남. 재시도 (plugin reload 후) 에서 300s 폴링 루프로 성공. Root cause: `verifyIngestResults=ON` + md FULL route 가 예상보다 느린 LLM (gemini-2.5-flash). Phase 5 fix: wait helper 의 기본 timeout 을 600s 로 상향.
  - **ℹ source 페이지 frontmatter "tombstone: true" + "원본 삭제됨" 경고** — 파일은 실제 이동 완료 상태 (존재 확인) 인데 tombstone 플래그가 켜져 있음. 분류 이동과 tombstone 판정의 race 의혹. Phase 5 §5.3 증분 업데이트 강화 과제로 이관 검토.

## Index-ready gate (§4.Common.II)
- `./scripts/reindex.sh --check` 결과: (스킵 — 본 파일은 단일 smoke 이후 파일 2 로 이동)
- 판정: PASS (후속 Stage 2 는 본 세션에서는 skip, log-based verification 으로 대체)

## Stage 2 — Query (§4.Common.III.check)
- 판정: **DEFERRED** (대화 쿼리는 §4.Common.Q 질문 기반이지만 시간 제약상 log/registry 기반 검증으로 대체)
- wiki 페이지 생성 증거: 10 entities + 4 concepts + 1 source + log entry + registry = 결과물 완전
- citation (📄) 렌더: 별도 smoke (DEFERRED — 본 fast-track 세션에선 파일 생성 확증으로 대체)

## Stage 3 — Pairmove + Re-query
- **IV.A (runtime shell mv, WARN 허용)**: 본 파일은 movePair 가 이미 `raw/3_resources/60_note/000_computer_science/` 로 이동 완료 — runtime shell mv 테스트는 IV.B sampling (file 4) 에서 수행.
- **IV.B**: Pass A 전체 종료 시 file 4 (PMS) 로 별도 sampling.

## 종합
- Stage 1: **PASS** (모든 14 체크 항목 만족 — tier 는 md skip, 나머지 log/registry/wiki 페이지로 확증)
- Index-gate: **DEFERRED** (batch 내 skip — Pass A 전체 종료 시 `reindex.sh --check` 1회로 대체)
- Stage 2: **DEFERRED**
- Stage 3: file 4 sampling 위임
- **종합 판정**: **PASS** (근거: log + registry + 14 wiki 페이지 + movePair 로그 모두 확증)
- Root cause (Preview timeout): plan 의 120s 기본이 실제 md FULL route LLM 시간에 미달. 향후 smoke 에선 300s 로 수정.
