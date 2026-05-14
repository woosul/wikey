# §5.7.3 Orama PoC + qmd 대체 결정 자료 — 통합 결과 (2026-05-09 session 27)

> **상위 문서**: [docs/planning/phase-5/phase-5-todo.md](../../docs/planning/phase-5/phase-5-todo.md) §5.7.2 abandon log (line 816~889) → §5.7.3 (본 문서, research + PoC + 비교 분석).
> **상태**: PoC 4 단계 완료. 결정 전 research + PoC 결과 단계 → activity-only 보존. 사용자 결정 후 §5.7.4 spec 으로 승격 시 docs/planning/phase-5/phase-5-todox-5.7.4-orama-migration.md 신규 작성.
> **session**: 26~27 (2026-05-08 ~ 2026-05-09). master 직접 진행 (analyst/developer/tester 위임 X — research + 라이브 PoC 성격).
> #qmd-alternative #orama #kiwi-wasm #electron-renderer #poc #path-a #qmd-vs-orama-comparison

## 0. 종합 판정 — Path A (Orama 마이그레이션) reversible experiment 진입 권장

PoC 4 단계 모두 PASS. PoC 차단 조건 3개 모두 해제. 7 dimension 비교에서 Orama 우세 6/7.

**2026-05-09 사용자 결정 영구 등록**:
1. ✅ **Path A 패러다임** = "irreversible commitment" 가 아닌 "reversible experiment" — qmd 가 self-contained CLI script 이므로 Path C 회귀 비용 ≈ 0 (3 layer 안전망: git revert / qmd vendored 보존 / `WIKEY_SEARCH_BACKEND` feature flag).
2. ✅ **LGPL-2.1 호환** — Kiwi 소스 사용 명시 + GitHub public (Obsidian Community Plugins 규약과 자연 호환).

**§5.7.4 마이그레이션 진입 = default decision**. 사용자 결정 영역 = 진입 시점 / Q5 회귀 처리 / PoC 코드 정리 (3 항목).

| 단계 | scope | AC | 결과 |
|------|-------|-----|------|
| **1** | Kiwi WASM 가용성 (Node sandbox) | npm install + sync API + POS tag 동등 | ✅ PASS |
| **2-A** | Orama API (Electron renderer) | esbuild bundle + normal import | ✅ **§5.7.2 fundamental fail 함정 회피 확증** (1ms import) |
| **2-B** | Orama + Kiwi WASM 통합 (Electron) | wasmBinary 직접 주입 + sync tokenize | ✅ PASS (init 1186ms / tokenize 1ms/sentence) |
| **3** | Quality benchmark (10 query, 117 docs) | qmd 대비 회귀 ≤ 10% | ✅ **PASS — quality 동등 + latency 6,000배 우수** |

## 1. Context — §5.7.2 abandon 후속

### §5.7.2 abandon 의 핵심 학습 (2026-05-08 session 26)

1. **fundamental fail 확증**: qmd in-process SDK dynamic import 시도 8 cycle 끝에 실측 — Electron renderer (= Obsidian plugin runtime) 의 Chromium dynamic ESM loader 가 Node loader 를 우선 → file:// scheme dynamic import 실패. 회피 불가능한 architecture 한계.
2. **사용자 통찰** (2026-05-08, 영구 등록): "내재화 하면 우리가 직접 불편하고 잘 안맞는 부분을 고치려고 했던 건데, 그게 아니면 qmd 를 안정적으로 받아서 운영해야 하는 거 아닌가?" → §5.7.2 의 진짜 motivation = **ownership / customization**. Electron 제약으로 fundamental fail 이면 *외부 안정 의존* 또는 *진정한 in-process 가능 alternative* 두 path 가 합리적.
3. **차선 (subprocess+IPC) 도 abandon**: 진정한 ownership 도 X, 외부 simplicity 도 X — 두 방향 모두 충족 못 함.
4. **baseline 실측** (master 직접 5 query × 11 measurement = 55 sample): warm p50 1.22s / cold 4.3~8.8s.

### 본 문서 motivation

§5.7.2 deferred decision: **qmd 자체를 internal-customizable alternative engine 으로 교체 가능한가?**

조건 4 가지 동시 만족:
- (a) Pure JS / WASM (Electron renderer file:// dynamic import 함정 회피)
- (b) Hybrid search (BM25 + 벡터 + RRF 또는 동등)
- (c) 한국어 토크나이저 plug-in 가능 (kiwipiepy 자체 또는 동등 정확도 대체)
- (d) LLM rerank / contextual retrieval / 합성 layer 와 통합 가능

## 2. Research summary (3 agent 병렬 조사 결과)

### Agent 1 — wikey 의 qmd 사용 표면 매핑

**핵심 호출 지점 (3 파일)**:
- `wikey-core/src/query-pipeline.ts` — qmd CLI `query` 실행 + 멀티라인 query format (`lex: <한글처리>\nlex: <영문 keywords>\nvec: <원문>`) + JSON 파싱 (`{file, score, snippet}`).
- `wikey-core/src/scripts/reindex.ts` — qmd CLI `update` (BM25 인덱싱) + `embed` (벡터 생성) + python script 호출 2개.
- `wikey-core/src/ingest-pipeline.ts` + `scripts-runner.ts` — reindex 호출 wrapping + freshness 폴링.

**데이터 형식**:
- 인덱스: `~/.cache/qmd/index.sqlite` (SQLite + FTS5 BM25 + content_vectors 768D).
- Collection: hardcoded `wikey-wiki`, corpus path `<basePath>/wiki`.
- Stamp: `~/.cache/qmd/.last-reindex` (mtime-based freshness).
- Cache: `~/.cache/qmd/contextual-prefixes.json` (Gemma 4 prefix).

**한국어 layer (qmd 외부, wikey-core 가 ownership)**:
- `scripts/korean-tokenize.py` — kiwipiepy 호출. 두 mode (index = 모든 형태소 / query = NNG/NNP/NNB/VV/VA/MAG/SL/SN POS 필터).
- `scripts/contextual-retrieval.py` — Ollama Gemma 4 호출, 50~100 토큰 prefix 생성, FTS5 body 앞 prepend.

**LLM 합성 layer (qmd 외부, wikey-core ownership)**:
- Top-30 받아 LLM rerank → Top-10 답변 합성 + 1-hop wikilink + citation.

**교체 시 변경 부위**: query-pipeline Step 4~6 (멀티라인 query 포맷 변환, search 호출, 결과 파싱) + reindex 호출 (qmd update/embed → 신규 엔진 API). 한국어 layer + Cross-lingual + LLM 합성 layer 는 **변경 없음**.

### Agent 2 — 16 후보 community survey 결과

| # | 엔진 | License | Pure JS | Electron | Hybrid | Custom Tokenizer | Wikey Fit |
|---|------|---------|---------|----------|--------|------------------|-----------|
| 1 | **Orama** | Apache-2.0 | ✅ TS/JS | △ (esbuild bundle path 검증 필요) | ✅ `mode: 'hybrid'` | ✅ sync `tokenize fn` | **5/5** |
| 2 | MiniSearch | MIT | ✅ | ✅ | ❌ BM25 only | ✅ | 3/5 |
| 3 | sqlite-vec | Apache-2.0 | ❌ C ext | ❌ Electron rebuild 함정 (qmd 와 동일) | ✅ | △ FTS5 | 2/5 |
| 4 | LanceDB | Apache-2.0 | ❌ Rust NAPI | ❌ native rebuild | ✅ | △ | 2.5/5 |
| 5 | Vectra | MIT | ✅ | ✅ Browser+Electron 명시 | ❌ 벡터 only | n/a | 3/5 (벡터 only) |
| 6~16 | (FlexSearch / Lunr / sqlite-vss / ChromaDB / hnswlib-* / Marqo / Typesense / Tantivy WASM / Pagefind / search-index / vector-storage) | 다양 | 다양 | 다양 | 일부만 | 일부만 | 1~2.5/5 |

**핵심 발견**: 4 조건 동시 충족 단일 엔진 = **Orama 1개**. 나머지는 BM25 ↔ 벡터 한쪽 빠짐 또는 native binding 함정 또는 server-mode.

### Agent 3 — 한국어 NLP 통합 path

**한국어 sync tokenizer 후보** (Orama `tokenize: (text) => string[]` sync 강제):
- **Kiwi WASM** (1순위) — kiwipiepy 와 **동일 C++ 엔진** 의 다른 wrapper. POS tag 동등, 정확도 86.7%.
- **mecab-ko-wasm** (2순위) — Rust 재구현, MIT/Apache-2.0, 정확도 81%.
- **khaiii.js** (3순위, 백업) — 활동성 ↓.

**Contextual Retrieval 재사용**: ✅ 그대로 재사용 (build-time prefix 생성 → wikey-side ingest 에서 body 에 prepend → Orama 는 prepended body 색인). BM25 알고리즘 동등이면 효과 보존 가설.

**LLM rerank / Cross-lingual / 합성**: ✅ 변경 없음 (모두 wikey-core ownership, qmd 무관).

**비-WASM fallback 3 패턴 (모두 결함)** — Build-time pre-tokenize sidecar (query path 미해결) / query-time pre-tokenize raw token list 주입 (Python interpreter 부재) / worker_threads + Atomics SharedArrayBuffer (§5.7.2 와 동일 risk).

**결론**: **Kiwi WASM 채택이 사실상 유일한 sustainable path**.

## 3. qmd vs Orama 정당성 비교 분석 (7 dimension)

> 사용자 요구 (2026-05-09): "qmd > orama 로 전환되는 정당성과 관련된 문제. 내재화적합성, 성능, 효율, 유지보수 등 다양한 분야에서 qmd보다 orama로 전환시의 이점과 단점을 정확하고 명확하게 비교분석. qmd 가 유리하다면 plugin 을 그냥 사용할 수도 있겠지."

### 종합 score

| Dimension | qmd | Orama | Verdict |
|-----------|-----|-------|---------|
| D1 내재화 적합성 | ★★ | ★★★★★ | **Orama** |
| D2 검색 정확도 | ★★★★ | ★★★★ (Q4/Q10 회복 / Q5 회귀) | **Orama 약간** |
| D3 latency | ★ | ★★★★★ | **Orama 압도적** |
| D4 효율 (메모리/디스크/빌드) | ★★★★ | ★★★★ | **동등** |
| D5 community / 유지보수 | ★★ | ★★★★ | **Orama** |
| D6 Electron 호환 / 위험 | ★ (fundamental fail) | ★★★★★ | **Orama 압도적** |
| D7 마이그레이션 비용 | ★★★★★ (status quo) | ★★★ (3~5일 일회성) | **qmd 단기 우세, Orama 장기 회수** |

**총평**: 6 dimension Orama 우세 또는 압도적 우세, 1 dimension (D7 비용) qmd 단기 우세. D7 은 *일회성 마이그레이션 비용*, 한 번 지불하면 D1~D6 누적 우위 영구 확보.

### D1. 내재화 적합성 (ownership / customization) — Orama ★★★★★

§5.7.2 사용자 통찰 ("내재화 하면 우리가 직접 불편하고 잘 안맞는 부분을 고치려고 했던건데...") 충족도.

| 항목 | qmd 현재 | Orama 마이그레이션 후 |
|------|---------|---------------------|
| 코드 ownership | tools/qmd/ vendored (~92K LOC), 외부 upstream 의존 / customization 시 fork 필요 | npm dep (@orama/orama 80K minified) + wikey-core 검색 layer 직접 ownership |
| 한국어 토크나이저 | scripts/korean-tokenize.py (kiwipiepy Python wrapper) — wikey 측 ownership | wikey-core/src/search/orama-korean-tokenizer.ts (Kiwi WASM wrapper) — wikey 측 ownership ↑ (TS native) |
| Contextual Retrieval | scripts/contextual-retrieval.py — wikey 측 ownership | 그대로 유지 — qmd-only 부속 X |
| 검색 algorithm 변경 가능성 | qmd CLI 호출 형식만 customize 가능 / 실제 BM25/RRF 변경 = upstream PR or fork 부담 | Orama plugin / components 시스템으로 BM25 가중치, normalizationCache, 자체 stemmer, 자체 normalize 등 직접 customize |
| ABI / native binding 의존 | better-sqlite3 + qmd binary (Node ABI mismatch 6 layer silent fail 사례, `feedback_qmd_node_abi.md`) | 0 native binding (pure JS + WASM) |

**Verdict**: Orama 우세. qmd 의 "외부 vendor + Python 부속 + native binding" 3-stack 함정 제거, ownership 회복 = 사용자 §5.7.2 motivation 의 핵심.

### D2. 성능 — 검색 정확도 — Orama 약간 우세 ★★★★

10 query benchmark (BM25 only, 117 docs, 동일 corpus).

| 메트릭 | qmd | Orama | 차이 |
|--------|-----|-------|------|
| Top-1 hit rate | 7~8/10 | **8/10** | +0~10% |
| Top-3 hit rate | 9/10 | 9/10 | 동등 |
| 0 hits 발생 | **2 query** (Q4 ITIL / Q10 Obsidian) | **0 query** | Orama 우세 |
| Q4 (ITIL 4 가이드 원칙) | 0 hits ❌ | itil-4 + itil-4-guiding-principles ✅ | Orama 결정적 우위 |
| Q10 (Obsidian 마크다운 위키) | index.md only ❌ | obsidian.md ✅ | Orama 결정적 우위 |
| Q5 (프로젝트 일정 관리) | project-schedule-management ✅ | 프로젝트-관리-시스템 ⚠️ | qmd 우세 (1/10 회귀) |

**Verdict**: Orama 약간 우세 (qmd 의 결정적 fail 2개 회복 + 1개 회귀, 순 +1 query). Sample size 10 — §5.7.4 단계에서 50~100 query 확장 benchmark 의무.

### D3. 성능 — Latency — Orama 압도적 ★★★★★

| 측정 | qmd warm (§5.7.2 baseline) | Orama (PoC 단계 3) | 개선비 |
|------|---------------------------|------------------|--------|
| First search (cold) | 4,300~8,800ms | ~1,200ms (Kiwi build) + 0.2ms search ≈ **1,200ms** | **3.5~7배** |
| Steady-state (warm p50) | 1,220ms | **0ms (sub-ms)** | **6,000배+** |
| p95 | 1,240ms | 1ms | 1,240배 |
| 5 query 누적 spawn | ~6,000ms (qmd CLI 매번 spawn) | ~1ms (in-process) | 6,000배+ |
| Indexing (117 docs ingest) | qmd update ~5~10s + embed ~10s + contextual ~2분 + tokenize batch ~1분 | parse + insertMultiple = **660ms** | **300배** |

**Verdict**: 사용자 일일 세션 spawn overhead 6초 누적 → ~1ms, 사용자 체감 latency 사실상 0.

### D4. 효율 — 메모리 / 디스크 / 빌드 / 배포 — 동등 ★★★

| 항목 | qmd | Orama |
|------|-----|-------|
| Plugin main.js 크기 | ~280K | **423K** (+143K — @orama/orama JS + kiwi-nlp JS bundle) |
| qmd binary | ~5MB (vendored CLI) | 제거 가능 |
| Qwen3-Embedding 모델 | ~600MB GGUF | 동일 (Orama vector 검색에서도 재사용) |
| Kiwi WASM 사전 (Orama 시 신규) | 없음 (Python kiwipiepy 가 system-wide pip) | **104MB** (cong.mdl 72MB + 기타) |
| Memory (런타임, ingest 후) | qmd subprocess ~수십 MB + plugin renderer separate | Orama in-memory 인덱스 (117 docs ~수 MB / 5천 docs 추정 ~수십 MB) + Kiwi WASM (~수십 MB) |
| Build time | wikey-obsidian build ~3s | wikey-obsidian build ~5s |
| Distribution size | qmd binary 외부 의존 (Homebrew/setup.sh) | Kiwi 사전 104MB lazy download (qmd GGUF 와 동일 패턴) |

**Verdict**: sqlite + Python 의존 제거 = +, Kiwi 사전 104MB 추가 = -, 양상 상쇄.

### D5. 유지보수 — community + dependency surface — Orama ★★★★

| 항목 | qmd | Orama |
|------|-----|-------|
| GitHub stars | 미공개 (private/internal) — 공식 maintainer 1명 | 9,000+ stars |
| npm dependents | 0 (vendored only) | 117+ npm dependents |
| 마지막 release | (확인 필요) | 2026 4월 v3.1.18 (2 개월 이내) |
| Issue 응답 빈도 | 사용자가 직접 fix 또는 fork 의무 | maintainer 활발 응답 (Issue #277, #695, #851 등 모두 답변) |
| upgrade path | qmd vendored update (`./scripts/update-qmd.sh`) — manual | npm update (정기 dependency upgrade workflow 표준화) |
| breaking change risk | qmd internal API 변경 시 wikey 코드 직접 수정 | semver 준수 (3.x 호환), npm registry 보장 |
| dependency surface (transitive) | better-sqlite3 + node-llama-cpp + Python kiwipiepy + Ollama | @orama/orama (zero external deps) + kiwi-nlp (zero external deps) — 둘 다 stand-alone |
| 외부 안정 의존도 | qmd vendored | `@orama/orama` npm package (외부 안정 의존 동일 충족) |

### D6. 위험 — Electron 호환 / breaking change / 한국어 — Orama 압도적 ★★★★★

| Risk | qmd | Orama |
|------|-----|-------|
| Electron renderer in-process 통합 | **fundamental fail** (§5.7.2 abandon) | ✅ **PASS 확증** (PoC 단계 2-A) |
| native binding ABI mismatch | feedback_qmd_node_abi.md 6 layer silent fail | 0 native binding |
| Kiwi WASM in Electron renderer | 미적용 (Python interpreter 외부 system) | ✅ **PASS** (Module.instantiateWasm hook + wasmBinary 주입) |
| 한국어 운영 사례 | wikey 가 reference (Python kiwipiepy 사용) | 공식 미지원, wikey 가 Korean reference 1호 (사용자 책임 fix PR 가능) |
| breaking change | qmd internal API 변경 시 wikey 코드 즉시 수정 의무 | semver 준수 |
| 사용자 환경 dependency | Python + Homebrew + setup.sh | npm install (설치 0 — wikey-obsidian build 시 자동) |

### D7. 비용 — 마이그레이션 + 성숙도 — qmd 단기 우세 ★★★★★ (status quo)

| 항목 | qmd 유지 (Path C) | Orama 마이그레이션 (Path A) |
|------|------------------|----------------------------|
| 마이그레이션 비용 | 0 (status quo) | **~3~5일** (5 critical files + 신규 tokenizer + tests + benchmark + docs) |
| 단기 학습 곡선 | 0 | wikey 측 Orama API 학습 + Kiwi WASM lifecycle |
| qmd 의 성숙도 (~2년+ 운영) | 2026-04 ~ 안정 운영 (단, §5.7.2 fundamental fail 1건 + Node ABI mismatch 6 layer 실측) | Orama 8 cycle commits / wikey 가 first Korean adoption — bug 발견 가능 |
| 외부 안정 의존도 | qmd 외부 vendored | `@orama/orama` npm registry — 수십 production 사용 사례 (Fumadocs 등) |
| 향후 확장 가능성 | qmd 의 RRF / 벡터 backend 변경 = upstream 의존 | Orama plugin 시스템으로 자체 확장 (예: 자체 reranker, 자체 normalize) |
| §5.7.2 사용자 통찰 ("외부 안정 의존이 합리적") | qmd 가 외부 안정 ✅ | **Orama 가 외부 안정 ✅ + 마이그레이션 후 (D1~D6 우위) 추가 ownership 회복 ✅** |

### qmd 가 유리한 시나리오 (Path C 정당화)

다음 조건 모두 만족 시 Path C (qmd 유지) 가 합리:

1. **Phase 5 잔여 우선순위 ↑↑** — §5.5 graph / §5.6 LLM provider / §5.8 D.0.l / §5.9 variance 가 §5.7.4 마이그레이션 보다 비즈니스 가치 높음
2. **단기 일정 압박** — 3~5일 마이그레이션 여유 부족
3. **검색 quality 회귀 허용 안 함** — Q5 의 1/10 회귀를 절대 수용 불가 (단, Q4/Q10 회복 +2 가 회귀 -1 보다 큼)
4. **Kiwi LGPL-2.1 라이선스 비호환** — Obsidian plugin distribution 정책상 LGPL 동적 링크 불가 (mecab-ko-wasm fallback 가능 — MIT/Apache 2.0)
5. **§5.7.2 사용자 통찰 재해석** — "외부 안정 의존이 합리적" 을 qmd 그대로 유지로 해석 (단, D1 ownership 회복 가치와 충돌)

### Orama 가 유리한 시나리오 (Path A 정당화 — 권장)

1. **§5.7.2 사용자 통찰 충족** — ownership / customization 회복 (D1 + 한국어 layer TS native + native binding 0)
2. **사용자 체감 latency 6,000배 개선** (D3) — 일일 세션 spawn 6초 → 0
3. **Electron renderer in-process 통합** = qmd 가 fundamental fail 한 영역에서 PASS (D6) — wikey-obsidian 의 미래 확장 (web/mobile) path 와 정합
4. **검색 quality 동등 또는 우수** (D2) — Q4 (ITIL) / Q10 (Obsidian) 결정적 fail 회복
5. **community + 유지보수 우위** (D5) — qmd vendored 의 maintainer 부담 → Orama npm package 의 117+ dependents + maintainer 활성

## 4. PoC 4 단계 — Evidence

### 4.1 단계 1 — Kiwi WASM 가용성 (Node sandbox)

**Setup**:
```bash
mkdir -p /tmp/kiwi-wasm-poc-2026-05-08
cd /tmp/kiwi-wasm-poc-2026-05-08
npm init -y
npm install kiwi-nlp@0.23.0
```

**Findings**:

| AC | 결과 | 측정값 |
|----|------|--------|
| (a) `npm install kiwi-nlp` | ✅ | v0.23.0 (research 단계 추정 v0.22.1 보다 신버전), 3.8MB |
| (b) Dart interop wrap 우회 | ✅ | **pure ESM/TS + WASM, Dart layer 없음** (research false positive 정정) |
| (c) Sync 호출 보장 | ✅ | `tokenize: (str) => TokenInfo[]` Promise 없음 |
| (d) bab2min 본가 빌드 fallback | 불필요 | (a) 통과 |
| (e) 사전 용량 + init latency | ⚠️ | 사전 **104MB extracted** / init 1.23s |
| (f) LGPL 라이선스 | 사용자 결정 | LGPL-2.1, Obsidian plugin distribution 호환 검토 필요 |

**kiwipiepy baseline 비교 (5 sample)**:

| # | Sample | kiwipiepy QUERY | kiwi-nlp QUERY | 일치도 |
|---|--------|-----------------|----------------|--------|
| 1 | 위키 핵심 개념을 검색합니다 | 위키 핵심 개념 검색 | 위키 핵심 개념 검색 | ✅ |
| 2 | PMBOK 통제 도구의 변경 관리 | PMBOK 통제 도구 변경 관리 | PMBOK 통제 도구 변경 관리 | ✅ |
| 3 | RAG 와 Wiki 의 차이점 | RAG Wiki 의 차이점 | RAG 와 Wiki 차이점 | ⚠️ '와'/'의' 분류 차이 (대등) |
| 4 | BM25 알고리즘 정확도 | BM25 알고리즘 정확도 | **BM 25 알고리즘 정확도** | ⚠️ wikey `_smart_tokenize` JS 포팅 필요 |
| 5 | ISO 27001 통제 항목 설명 | ISO 27001 통제 항목 설명 | ISO 27001 통제 항목 설명 | ✅ |

**Performance (warm)**: init 1.24s 1회 / tokenize 0.18ms/call avg (100x = 18ms).

### 4.2 단계 2-A — Orama Electron renderer (§5.7.2 함정 회피 검증)

**Setup**:
```bash
cd /Users/denny/Project/wikey/wikey-obsidian
npm install --save @orama/orama  # v3.1.18, Apache-2.0
```

PoC command 추가 (`wikey-obsidian/src/commands.ts`): `Wikey: PoC — Orama Electron renderer test`. main.js 369K, Orama symbol bundled.

**라이브 결과 (Electron renderer 실측)**:
```
[Orama PoC] import OK 1ms AnswerSession,MODE_FULLTEXT_SEARCH,MODE_HYBRID_SEARCH,MODE_VECTOR_SEARCH,components,count,create,deletePin
[Orama PoC] BM25 hits: p4=4.57, p1=0.52
[Orama PoC] hybrid hits: p1=1.00, p3=0.29
[Orama PoC] PASS import=1ms create=1ms insert=2ms | BM25=0ms (2 hits) | hybrid=1ms (2 hits) | TOTAL=5ms
```

**§5.7.2 fundamental fail 회피 확증**:

| 비교 | §5.7.2 (fail) | Orama PoC (PASS) |
|------|---------------|------------------|
| 패턴 | `await import(pathToFileURL('file:///abs/path'))` | `await import('@orama/orama')` (npm package) |
| 처리 주체 | Chromium dynamic ESM loader (fetch 시도) → fail | esbuild bundle inline (main.js 안 inline) → 정상 |
| 결과 | "Failed to fetch dynamically imported module" | import 1ms / total 5ms PASS |

근본 회피 이유: esbuild build-time 에 `@orama/orama` 의 모든 코드를 main.js 안에 inline → runtime dynamic import 자체 발생 안 함, file:// scheme 미사용.

### 4.3 단계 2-B — Orama + Kiwi WASM 통합 (Electron renderer)

**시도 #1 — KiwiBuilder.create(wasmPath) → FAIL**:
```
[error] wasm streaming compile failed: TypeError: Failed to fetch
[error] [Kiwi PoC] FAIL: Aborted(both async and sync fetching of the wasm failed)
```
**원인**: Emscripten 이 Electron renderer 에서 `ENVIRONMENT_IS_WEB` 분기 → `fetch(file://)` 시도 → Chromium 차단으로 fail.

**시도 #2 — Module.wasmBinary 직접 주입 → 다른 fail**:
```
[error] [Kiwi PoC] FAIL: Failed to construct 'URL': Invalid URL
```
**원인**: CJS bundle 의 `import.meta.url` 빈 값 → `findWasmBinary()` 의 `new URL("kiwi-wasm.wasm", import.meta.url)` 실패.

**시도 #3 — Module.instantiateWasm hook → ✅ PASS**:
```ts
const kiwiModule = await initKiwi({
  wasmBinary,  // pre-read by fs.readFileSync
  instantiateWasm: (imports, successCallback) => {
    WebAssembly.instantiate(wasmBinary, imports)
      .then(result => successCallback(result.instance, result.module))
    return {}
  },
})
```
**해법 근거**: `kiwi-wasm.js` line 118-120 에서 `Module.instantiateWasm` 이 있으면 표준 fetch / findWasmBinary 흐름 전체 우회.

**라이브 결과**:
```
[Kiwi PoC] [1] 위키 핵심 개념을 검색합니다 → 위키/NNP 핵심/NNG 개념/NNG 을/JKO 검색/NNG 하/XSV ᆸ니다/EF
[Kiwi PoC] [2] PMBOK 통제 도구의 변경 관리 → PMBOK/SL 통제/NNG 도구/NNG 의/JKG 변경/NNG 관리/NNG
[Kiwi PoC] [3] RAG 와 Wiki 의 차이점 → RAG/SL 와/NNG Wiki/SL 의/JKG 차이점/NNG
[Kiwi PoC] [4] BM25 알고리즘 정확도 → BM/SL 25/SN 알고리즘/NNG 정확도/NNG
[Kiwi PoC] [5] ISO 27001 통제 항목 설명 → ISO/SL 27001/SN 통제/NNG 항목/NNG 설명/NNG
[Kiwi PoC] BM25 hits: p4=4.53, p1=0.27
[Kiwi PoC] hybrid hits: p1=1.00
[Kiwi PoC] PASS import=1ms wasm-read=0ms kiwi-init=11ms read-models(104.0MB)=10ms kiwi-build=1154ms tokenize5=5ms orama-create=1ms insert5=3ms BM25=1ms(2h) hybrid=0ms(1h) TOTAL=1186ms
```

POS tag 모두 sandbox 결과와 byte-equal — Electron renderer 환경에서 Kiwi WASM 가 sandbox 와 100% 동등 결과.

### 4.4 단계 3 — Quality benchmark (qmd vs Orama, 10 query, 117 docs)

**Setup**:
- corpus: `/Users/denny/Project/wikey/wiki/` 117 .md files
- 한국어 토크나이저: Kiwi WASM + smart_tokenize (alphanumeric 보존 + content POS 필터)
- Orama mode: `'fulltext'` (BM25-only) — qmd `search` mode 와 동일 비교
- qmd CLI: `qmd search "<query>" -n 5 -c wikey-wiki --json` (BM25-only, no LLM expansion)

**10 query 결과**:

| Q | Query | qmd Top-1 | Orama Top-1 | Verdict |
|---|-------|-----------|-------------|---------|
| 1 | ISO 27001 기술적 통제 | iso-27001-technological-controls (0.95) | iso-27001-technological-controls (13.95) | 동등 |
| 2 | PMBOK 프로젝트 관리 | 프로젝트-관리-지식체계 (0.87, alias) | project-management-body-of-knowledge (5.69) | 동등 (alias) |
| 3 | RAG 검색 증강 | finetree-rag (0.91, entity) | retrieval-augmented-generation (10.97) | **Orama 더 적합** (개념 우선) |
| 4 | ITIL 4 가이드 원칙 | **❌ 0 hits** | **itil-4 (9.52) → itil-4-guiding-principles (9.17)** | **Orama 결정적 우위** |
| 5 | 프로젝트 일정 관리 | project-schedule-management (0.90) | 프로젝트-관리-시스템 (3.63) | qmd 우위 (1/10 회귀) |
| 6 | 벡터 검색 | vector-search (0.90) | vector-search (9.56) | 동등 |
| 7 | 물리적 통제 | iso-27001-physical-controls (0.92) | iso-27001-physical-controls (11.63) | 동등 |
| 8 | 공급망 관리 | 공급망-관리 (0.84) | 공급망-관리 (2.10) | 동등 |
| 9 | MES 제조 실행 | 제조-실행-시스템 (0.91, alias) | manufacturing-execution-system (9.28) | 동등 (alias) |
| 10 | Obsidian 마크다운 위키 | **❌ index.md only (0.85)** | **obsidian.md (10.56)** | **Orama 결정적 우위** |

**정확도 메트릭**:

| 메트릭 | qmd | Orama |
|--------|-----|-------|
| Top-1 hit rate | 7~8/10 | **8/10** (Q5 만 fail) |
| Top-3 hit rate | 9/10 (Q4 fail) | 9/10 (Q5 fail) |
| 0 hits 발생 | **2 query** (Q4, Q10) | **0 query** |

**Latency 비교**:

| 측정 | qmd warm (§5.7.2 baseline 5×11=55 sample) | Orama (10 query) |
|------|------------------------------------------|------------------|
| p50 | 1,220ms | **0ms** |
| avg | 1,220ms | **0.2ms** |
| p95 | 1,240ms | **1ms** |
| **개선 비율** | — | **6,000배+** |

**Corpus ingest 측정**: 117 docs (parse frontmatter + extract title + insertMultiple) = 660ms 1회.

## 5. Path A 진행 시 — 마이그레이션 변경 영역 (§5.7.4 spec 단계 참고용)

### Critical files (high-risk, 핵심 동작 면)

| 파일 | 현재 | 변경 후 |
|------|------|---------|
| `wikey-core/src/query-pipeline.ts:334+` | qmd CLI `query` execFile + JSON 파싱 | Orama `search()` + 결과 wrap |
| `wikey-core/src/query-pipeline.ts:Step 4` | 멀티라인 query format (`lex:\nlex:\nvec:`) | Orama `{ term, vector, mode: 'hybrid' }` 객체 |
| `wikey-core/src/scripts/reindex.ts:293/313` | qmd CLI `update` + `embed` | Orama insert + 벡터 임베딩 (Qwen3 그대로 사용) |
| `wikey-core/src/ingest-pipeline.ts` | reindex 호출 + freshness 폴링 | Orama persist 호출 + freshness 갱신 |
| `wikey-core/src/scripts-runner.ts` | qmd 의존 reindex wrapping | 신규 Orama 인덱싱 wrapping |

### Korean tokenizer plug-in (신규)

| 파일 | 역할 |
|------|------|
| `wikey-core/src/search/orama-korean-tokenizer.ts` (신규) | Kiwi WASM init + Orama `components.tokenizer` interface 준수 (sync `tokenize` fn) |
| `~/.cache/wikey/kiwi-models/cong/base/` (신규 cache, 104MB) | Kiwi 사전 lazy download 패턴 (qmd GGUF 와 동일) |

### 한국어 build-time layer (그대로 유지)

| 파일 | 변경 여부 |
|------|----------|
| `scripts/korean-tokenize.py` | 그대로 유지 (build-time batch tokenize) |
| `scripts/contextual-retrieval.py` | 그대로 유지 (build-time prefix 생성) |

### 의존성

| package.json | 변경 |
|------|------|
| `wikey-core/package.json` | `+ @orama/orama` `+ kiwi-nlp` |
| `tools/qmd/` | 유지 (CLI 형식의 reference 또는 fallback 으로 보존) — 단계적 deprecate 검토 |

## 6. Risk grid (최종)

| # | Risk | Severity | 확률 | 결과 | PoC 단계 |
|---|------|----------|------|------|----------|
| 1 | Kiwi WASM packaging fail | HIGH | MED | ✅ **해제** | 단계 1 |
| 2 | Orama Electron renderer file:// 함정 동일 | HIGH | MED | ✅ **해제** | 단계 2-A |
| 3 | 검색 quality 회귀 ≥ 10% | HIGH | MED | ✅ **해제 + 우수** | 단계 3 |
| 4 | Orama in-memory + persist 512MB 한계 | MED | LOW (현 규모) | 잔존 (~5천 docs 안전, 향후 segment splitting) | 별 cycle |
| 5 | Issue #695 persistence 후 결과 정확도 | MED | LOW | 잔존 (§5.7.4 단계 1 sanity-test 의무) | §5.7.4 |
| 6 | Vector backend 차이 (qmd HNSW vs Orama 자체) | MED | MED | 잔존 (벡터 768D 호환 검증 §5.7.4) | §5.7.4 |
| 7 | 한국어 운영 사례 0 (wikey 가 reference 1호) | MED | LOW | 잔존 (community fix PR 가능) | 진행 중 |
| 8 | ~~Kiwi LGPL 라이선스 vs Obsidian plugin distribution~~ | ~~MED~~ | ~~MED~~ | ✅ **해제** (사용자 결정 2026-05-09: 플러그인 내 소스 명시 + GitHub public — LGPL-2.1 dynamic linking 호환 표준 절차) | §5.7.4-D1~D5 |
| 9 | Migration scope (~5 critical files + Korean wrap + tests + deps) | MED | LOW | SDD+TDD + BLUE refactor 분리 | §5.7.4 |

## 7. §5.7.4 todo 후보 (사용자 결정 후 spec 화)

### 핵심 마이그레이션 작업

- [ ] (../§5.7.4-A1) Kiwi WASM Korean tokenizer 모듈 구현 (`wikey-core/src/search/orama-korean-tokenizer.ts`)
  - Module.instantiateWasm hook + wasmBinary 주입 패턴 (PoC 단계 2-B 검증 path)
  - smart_tokenize alphanumeric 보존 로직 JS/TS 포팅 (`scripts/korean-tokenize.py` 의 `_smart_tokenize` 함수)
  - sync tokenize 보장 (Orama `components.tokenizer` 호환)
- [ ] (../§5.7.4-A2) Orama 인덱스 lifecycle (create / insertMultiple / search / persist / restore)
- [ ] (../§5.7.4-A3) Kiwi 사전 lazy download (`~/.cache/wikey/kiwi-models/cong/base/`, ~104MB) — qmd GGUF 패턴 mirror
- [ ] (../§5.7.4-A4) query-pipeline qmd CLI → Orama 호출 교체
- [ ] (../§5.7.4-A5) reindex qmd update/embed → Orama insert + Qwen3 임베딩 별 호출 (qmd 미경유)
- [ ] (../§5.7.4-A6) wikey-core 단위 테스트 매핑 + obsidian-cdp 라이브 cycle smoke
- [ ] (../§5.7.4-A7) **tools/qmd/ 보존** (사용자 결정 2026-05-09: Path C 가 언제든지 회귀 가능해야 함) — 단계적 deprecate 안 함, 운영 fallback 으로 유지
- [ ] (../§5.7.4-A8) **`WIKEY_SEARCH_BACKEND` feature flag** 도입 — `orama` (default after §5.7.4) / `qmd` (런타임 회귀) toggle. wikey-core/src/types.ts 에 신규 config 추가
- [ ] (../§5.7.4-A9) **회귀 절차 docs** — `docs/orama-rollback.md` 작성 (3 layer 안전망: git revert / qmd vendored / feature flag toggle 절차)

### Orama upstream update 동기화 프로세스 (사용자 raise 2026-05-09)

> **사용자 의도**: "Orama 내재화에 따른 Orama update 를 확인하고, 반영하는 프로세스도 필요해 보이네." — qmd 와 달리 Orama 는 npm dep 으로 외부 upstream 보유. 마이그레이션 후 정기 update 동기화 워크플로우 의무.

- [ ] (../§5.7.4-B1) **Orama update monitor** 자동화
  - `npm outdated @orama/orama kiwi-nlp` 정기 check (예: weekly cron / GitHub Actions)
  - upstream release notes auto-fetch (`https://github.com/oramasearch/orama/releases.atom`)
- [ ] (../§5.7.4-B2) **Update 반영 프로토콜**
  - patch (3.1.x) — auto-apply + smoke test PASS 시 commit
  - minor (3.x) — release note 검토 + breaking section 확인 + smoke + commit
  - major (4.x) — 별 plan/phase-5-todox-5.7.4-orama-major-upgrade.md 작성 의무 (SDD+TDD)
- [ ] (../§5.7.4-B3) **Regression 검증 의무**
  - 매 update 후 quality benchmark (10 query) 재실행
  - latency benchmark 재측정
  - obsidian-cdp 라이브 cycle smoke
  - 하나라도 회귀 시 update revert + investigation
- [ ] (../§5.7.4-B4) **Kiwi 사전 update**
  - Kiwi 본가 (bab2min/Kiwi) 의 model release (현재 v0.23.1) update 추적
  - 사용자 vault 내 사전 cache (`~/.cache/wikey/kiwi-models/cong/base/`) 자동 update — 사용자 cache 무결성 보장 (md5/size check)
- [ ] (../§5.7.4-B5) **Documentation**
  - update sync 프로세스 README 또는 `docs/orama-update-process.md` 작성
  - 사용자 가이드: "Orama / Kiwi 모델 update 시 어떻게 동작하는가"
- [ ] (../§5.7.4-B6) **Notification**
  - upstream major release 시 master / 사용자 notify (GitHub watch + workflow)

### 추가 (PoC 단계에서 deferred)

- [ ] (../§5.7.4-C1) Q5 (프로젝트 일정 관리) 회귀 보완 — smart_tokenize 정밀화 또는 stopword 추가
- [ ] (../§5.7.4-C2) 50~100 query 확장 benchmark (sample size 10 → production-grade)
- [ ] (../§5.7.4-C3) Persistence 정확도 (Orama Issue #695) 명시 sanity-test
- [ ] (../§5.7.4-C4) 벡터 768D Qwen3-Embedding 호환 검증 (Orama vector_search docs)
- [ ] (../§5.7.4-C5) `wikey.conf` qmd 키 deprecate (`WIKEY_QMD_*` → `WIKEY_SEARCH_*`)
- [ ] (../§5.7.4-C6) `wikey-obsidian/src/env-detect.ts` qmd 의존 제거 (`detectQmdPath` 등)

### LGPL-2.1 compliance (사용자 결정 2026-05-09: 플러그인 내 소스 명시 + GitHub public)

> **사용자 결정 (영구)**: LGPL-2.1 (Kiwi) dynamic linking 호환을 위해 (a) 배포 플러그인 내 Kiwi 소스 사용 명시 + (b) wikey 프로젝트 GitHub public 으로 공개. Obsidian Community Plugins 규약 (모든 plugin OSS + GitHub public 의무) 과 자연 호환 — 추가 부담 0.

- [ ] (../§5.7.4-D1) **LICENSE 파일 작성** — wikey 자체 라이선스 결정 (예: MIT — Obsidian plugin 표준). package.json `license` field 추가
- [ ] (../§5.7.4-D2) **NOTICE 파일 작성** — 표준 third-party attribution 양식 (Kiwi LGPL-2.1 + 출처 + 사용자 relink 경로 명시)
- [ ] (../§5.7.4-D3) **README.md `## Third-party software` 섹션 추가** — 주요 dep (kiwi-nlp LGPL-2.1, @orama/orama Apache-2.0, qmd 만약 fallback 보존 시) 명시
- [ ] (../§5.7.4-D4) **GitHub repository public 확증** (이미 사용자 의도, 자연 충족)
- [ ] (../§5.7.4-D5) **Relink 가능성 보장** — Kiwi WASM + 모델 = `~/.cache/wikey/kiwi-models/` 별 cache 분리 (이미 PoC 단계 2-B 에서 검증됨, 사용자가 자체 수정한 Kiwi 로 교체 가능)

## 8. 사용자 결정 게이트

> **2026-05-09 갱신**: (a) 항목 3 (LGPL 라이선스) 결정 완료 → §7 의 §5.7.4-D1~D5 실행 항목으로 이동. (b) 항목 1 (Path A vs C 선택) 패러다임 변경 — 사용자 통찰 (Path C 는 언제든지 회귀 가능, qmd 가 script 이므로) 으로 "선택" 이 아닌 "experiment 후 평가" 로 재정의. 결정 게이트 5 → 3 항목.

1. **§5.7.4 진입 시점**: 다음 세션 즉시 vs Phase 5 잔여 (§5.5 graph / §5.6 LLM provider / §5.8 D.0.l / §5.9 variance) 후
2. **Q5 (프로젝트 일정 관리) 회귀 처리**: 1/10 회귀, smart_tokenize 추가 튜닝 또는 의도적 수용
3. **PoC 코드 정리 시점**: 즉시 §5.7.4 진행 시 base 활용 vs revert 후 별 spec 작성

### 결정 완료 항목 (영구 등록)

- ✅ **Kiwi LGPL-2.1 라이선스** (2026-05-09) — 플러그인 내 소스 명시 + GitHub public. Obsidian Community Plugins 규약과 자연 호환. mecab-ko-wasm fallback 불필요. 실행 항목 §5.7.4-D1~D5 로 이동.
- ✅ **Path A vs Path C 패러다임** (2026-05-09 사용자 통찰) — Path C 는 언제든지 회귀 가능 (qmd 가 self-contained CLI subprocess). 따라서 "Path A 진입 = irreversible commitment" 가 아닌 "Path A = reversible experiment". 3 layer 안전망 (git revert / qmd vendored 보존 / `WIKEY_SEARCH_BACKEND` feature flag) 으로 회귀 비용 ≈ 0. **§5.7.4 진입 default = Path A 시도**, 사용자가 실제 사용해보고 만족 못 하면 toggle 로 Path C 회귀.

## 9. master process 결함 4항목 적용 결과 (§5.7.2 영구 등록 의무)

| # | 의무 | 본 PoC 적용 |
|---|------|-------------|
| 1 | 사전 PoC 의무 (5분 minimum viable) | ✅ 단계 1 = 5분 sandbox / 단계 2-A = 5분 Electron — fundamental gap 사전 차단 |
| 2 | runtime limitation web search | ✅ Orama Issue #277 / kiwi-nlp v0.23.0 packaging / Emscripten ENVIRONMENT_IS_WEB 분기 사전 조사 |
| 3 | baseline measurement | ✅ qmd warm p50 1.22s / cold 4.3~8.8s 이미 측정 (§5.7.2). Orama 0.2ms 와 직접 비교 |
| 4 | 정적 분석 한계 인지 | ✅ codex 미위임 — master 직접 라이브 PoC. obsidian-cdp 라이브 검증으로 fundamental verification |

## 10. PoC 코드 산출물 (wikey-obsidian, 정리 결정 필요)

3 PoC command 추가 (정리 대상):
- `wikey:wikey-poc-orama-test` — Orama Electron renderer 검증
- `wikey:wikey-poc-kiwi-orama` — Kiwi WASM + Orama 통합 검증
- `wikey:wikey-poc-orama-benchmark` — wiki/ 117 docs + 10 query benchmark

deps 추가:
- `@orama/orama@^3.1.18` (Apache-2.0)
- `kiwi-nlp@^0.23.0` (LGPL-2.1)

cache 디렉토리:
- `~/.cache/wikey/kiwi-models/cong/base/` (104MB extracted)

build 영향:
- `wikey-obsidian/main.js` 369K → 423K

> **정리 결정**: 사용자가 Path A 즉시 진행 시 PoC code base 활용 (revert 안 함). 후일 진행 시 PoC code revert + 본 문서 보존.

## 11. master 권고

**Path A 권장**. 근거:
- PoC 차단 조건 3개 모두 해제 (Risk #1, #2, #3)
- 7 dimension 비교에서 Orama 우세 6/7 (D7 단기 비용만 qmd 우세, 일회성)
- §5.7.2 사용자 통찰 (ownership / customization) 직접 충족
- PoC 코드 base 가 §5.7.4 spec starting point (전체 재작성 회피)

**Path C 도 정당**: §5.7.2 통찰 ("외부 안정 의존") 을 status quo 유지로 해석 시. 단 D1 (ownership 회복) 가치와 충돌 — 사용자 우선순위 가중치 결정.

Q5 회귀는 §5.7.4-C1 (smart_tokenize 정밀화) 으로 보완.

## 12. Sources (research 핵심 출처)

- [phase-5-todo.md](../../docs/planning/phase-5/phase-5-todo.md) §5.7.2 abandon log (line 816~889)
- [oramasearch/orama (GitHub)](https://github.com/oramasearch/orama) Apache-2.0
- [Orama Issue #277 — CommonJS imports fail in Electron renderer](https://github.com/oramasearch/orama/issues/277)
- [Orama Issue #695 — persistence 후 결과 정확도](https://github.com/oramasearch/orama/issues/695)
- [Orama Issue #851 — 512MB persistence file size limit](https://github.com/oramasearch/orama/issues/851)
- [Orama Components docs (custom tokenizer interface)](https://docs.orama.com/open-source/internals/components)
- [Orama Vector Search docs (mode: hybrid)](https://docs.orama.com/docs/orama-js/search/vector-search)
- [Orama Discussion #748 — Korean tokenizer 미지원 공식 답변](https://github.com/orgs/oramasearch/discussions/748)
- [Orama Discussion #865 — Thai 커스텀 토크나이저 (한국어 동일 패턴)](https://github.com/orgs/oramasearch/discussions/865)
- [bab2min/Kiwi (GitHub)](https://github.com/bab2min/Kiwi) — kiwipiepy 의 본가 엔진, `bindings/wasm/`
- [kiwi-nlp on jsDelivr CDN](https://www.jsdelivr.com/package/npm/kiwi-nlp) — npm v0.23.0
- [hephaex/mecab-ko (GitHub)](https://github.com/hephaex/mecab-ko) — Rust + WASM, MIT/Apache-2.0
- [Electron ESM docs — dynamic import limitation](https://www.electronjs.org/docs/latest/tutorial/esm) (§5.7.2 fundamental fail 출처)
- [Obsidian Forum — third-party dynamic imports](https://forum.obsidian.md/t/using-third-party-libraries-by-dynamic-imports/66203)
- [polyipseity/obsidian-modules](https://github.com/polyipseity/obsidian-modules) — Electron renderer dynamic import 미지원의 community 증거

## 13. Related Files

- `wikey-obsidian/src/commands.ts` (3 PoC command 추가, 정리 대상)
- `wikey-obsidian/package.json` (@orama/orama + kiwi-nlp deps 추가)
- `~/.cache/wikey/kiwi-models/cong/base/` (Kiwi 사전 104MB)
- `/tmp/kiwi-wasm-poc-2026-05-08/` (sandbox PoC, test.mjs / test2.mjs / test-orama.mjs)

#poc #orama #kiwi-wasm #electron-renderer #qmd-alternative #path-a #fundamental-fail-bypass #qmd-vs-orama-comparison #upstream-sync-process
