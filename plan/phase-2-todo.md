# Phase 2: Todo — 한국어 + LLM 다층 검색 + 볼트 템플릿 패키징

> 기간: 2026-04-11 ~
> 상태: **완료** (필수 7/7, 중요 6/6, 선택 0/3)
> 전제: Phase 1 완료 (필수 12/12, 중요 5/5, 선택 3/4)
> 인프라: Ollama 0.20.5 + Gemma 4 12B, vLLM-Metal 0.2.0, Codex CLI 0.118.0
> 번호: `N / N.M` 계층. 주제 그룹은 `activity/phase-2-result.md`와 1:1 미러.
> 상세 결과: `activity/phase-2-result.md`

---

## 2.1 개요 및 타임라인
> tag: #docs, #architecture

- [x] 1.1 Phase 2 타임라인 (2026-04-11 착수, 6 Step 완료)

## 2.2 raw/ PARA 재구조화 + 분류 시스템
> tag: #workflow, #framework

- [x] 2.1 `raw/CLASSIFY.md` 분류 기준 문서 — PARA 카테고리 정의, inbox 처리 모드, URI 기반 등록, 자동 분류 규칙, LLM 판단 가이드, 11개 리소스 토픽, 제품 폴더 네이밍, 피드백 로그
- [x] 2.2 `scripts/migrate-raw-to-para.sh` — PARA 스켈레톤 + 11 리소스 토픽 + 파일 매핑 + 빈 폴더 삭제. 1,073 파일 재분류 검증 완료
- [x] 2.3 wiki/sources 경로 6건 + entities `obsidian.md` + concepts `append-and-review.md` PARA 경로로 업데이트
- [x] 2.4 `wiki/log.md`에 `[2026-04-11] restructure` append-only 항목
- [x] 2.5 `wikey.schema.md` + `CLAUDE.md` + `AGENTS.md` + `README.md` + `.obsidian/app.json` + Obsidian Web Clipper 저장 경로 안내 업데이트
- [x] 2.6 `validate-wiki.sh` / `check-pii.sh` PASS + Git 커밋

## 2.3 LLM 다층 검색 파이프라인 (qmd)
> tag: #core, #engine

- [x] 3.1 `@tobilu/qmd@2.1.0` 소스를 `tools/qmd/`에 vendored + 글로벌 MCP 등록
- [x] 3.2 `wiki/` 디렉토리 인덱싱 — BM25 29 문서, 벡터 36 청크 (EmbeddingGemma-300M)
- [x] 3.3 기본 검색 5건 PASS (단순/한국어/영어/한영/엔티티 Top-1 정확)
- [x] 3.4 `wikey-query.sh` qmd 연동 + `--search` 모드 + `--pages` 오버라이드
- [x] 3.5 통합 파이프라인 (쿼리 → qmd 확장·검색·리랭킹 → Gemma 4 합성) 10건 벤치: Top-1 40%, Top-3 60%, 평균 11.3s
- [x] 3.6 `scripts/update-qmd.sh` upstream 관리 (`--check` / `--apply`)
- [x] 3.7 `local-llm/wikey.conf` backend 설정 (`basic` / `gemma4`)
- [x] 3.8 backend 분기 구현 + 5건 비교 (basic 0/5, gemma4 1/5 → Step 3 한국어 특화 필수)

## 2.4 사전 조사 — 청킹 + 검색 품질 혁신
> tag: #eval, #docs

- [x] 4.1 기획 단계 레퍼런스 분석 (seCall, AutoRAG, Farzapedia 커뮤니티 합의)
- [x] 4.2 Chonkie SemanticChunker 조사 → **기각** (NAACL 2025: 구조 문서에서 고정 크기 ≥ 의미적 청킹)
- [x] 4.3 Contextual Retrieval 조사 → **최우선 채택** (Top-20 실패 -49%, Gemma 4 12B 36청크 ~2분)
- [x] 4.4 Late Chunking 조사 → **현재 불필요**, jina-embeddings-v3 대신 채택
- [x] 4.5 한국어 특화: kiwipiepy 채택 (JVM 불필요, 86.7% 모호성 해소)
- [x] 4.6 qmd 소스 커스터마이징 범위 확정 (3건 B+/B/B, 기각 3건 C)

## 2.5 한국어 형태소 전처리 (kiwipiepy)
> tag: #core, #workflow

- [x] 5.1 kiwipiepy 0.23.1 설치 + `scripts/korean-tokenize.py` (index/query/fts5/batch 4 모드, 알파뉴메릭 보존)
- [x] 5.2 qmd FTS5 인덱싱 파이프라인에 전처리 레이어 (`--batch` 후처리 방식, VACUUM INTO WAL 대응)
- [x] 5.3 쿼리 파이프라인에도 동일 전처리 (`preprocess_korean_query()` content words 추출)
- [x] 5.4 BM25 전/후 비교 10건 — 조사 분리 5건 +74 hits, 영어 보존 2건, 복합 3건 동일

## 2.6 Contextual Retrieval (Gemma 4)
> tag: #core, #eval

- [x] 6.1 `scripts/contextual-retrieval.py` 프로토타입 — Anthropic 권장 프롬프트 템플릿, Gemma 4 thinking `num_predict: 1024`, 29/29 문서 프리픽스 성공 (~7분)
- [x] 6.2 프리픽스 품질 수동 검증 10건 — 한국어/영어/혼합 모두 양방향 용어 병기 확인
- [x] 6.3 qmd 인덱싱 파이프라인 통합 — FTS5 `--apply-fts` + 임베딩 `store.ts:generateEmbeddings()` 프리픽스 prepend, 파이프라인 순서 contextual → korean-tokenize
- [x] 6.4 BM25 전/후 정확도 10건 — Top-1 5/10 → 6/10 (+10%), Top-3 7/10 → 8/10 (+10%), FPV digital transmission 교정

## 2.7 임베딩 모델 교체 (Qwen3-Embedding-0.6B)
> tag: #core, #infra

- [x] 7.1 jina-v3 GGUF 시도 → XLM-RoBERTa llama.cpp 미지원 (llama.cpp#9585, #12327). EmbeddingGemma 대비 우위 없음 → Qwen3-Embedding-0.6B 채택
- [x] 7.2 `llm.ts` DEFAULT_EMBED_MODEL + `isJinaEmbeddingModel()` + EMBED_CONTEXT_SIZE 2048→8192, `store.ts` 표시명 + `db.ts` transaction
- [x] 7.3 `qmd embed -f` 재생성 (38 chunks, 29 docs, 9s)
- [x] 7.4 vsearch 10건 — EmbeddingGemma Top-1 4/10 → jina-v3 3~4/10 → **Qwen3-Embedding 10/10** (Top-3도 10/10)

## 2.8 통합 벤치마크 (50건, 게이트 통과)
> tag: #eval

- [x] 8.1 `bench/step3-4-benchmark.json` 50건 (exact 10 · semantic-kr 10 · semantic-en 5 · alias 5 · cross-domain 5 · source 5 · morph 5 · abbrev 5)
- [x] 8.2 `qmd bench` — vector P@k 86% / Recall 97% / MRR 85%, hybrid P@k 79% / Recall 98% / MRR 82%, full P@k 79% / Recall 98% / MRR 82%
- [x] 8.3 게이트 통과 (80%+ 목표, vector Recall 97% · hybrid Recall 98%)

## 2.9 반자동 인제스트 파이프라인
> tag: #workflow, #main-feature

- [x] 9.1 `scripts/watch-inbox.sh` — fswatch 기반 `raw/0_inbox/` 실시간 감시 + macOS Notification + `--status`
- [x] 9.2 `scripts/classify-inbox.sh` — `--dry-run` 분류 제안 + `--move` LLM 에이전트 CLI, 확장자 7개 자동 규칙 + 폴더 번들 감지
- [x] 9.3 폴더 단위 감지 테스트 (번들 분류 → resources/ 이동)
- [x] 9.4 `scripts/summarize-large-source.sh` — Gemini PDF base64 + Ollama Gemma 4 로컬 모드 (섹션 인덱스 생성)
- [x] 9.5 대용량 처리 2건 — 파워디바이스 37p(3MB) + TCP/IP 56p(45MB) Gemini 2.5 Flash 성공
- [x] 9.6 `.env` API 키 관리 + `watch-inbox.sh --status` 미승인 대기 목록

## 2.10 멀티 LLM 워크플로우 최적화
> tag: #workflow, #ops

- [x] 10.1 일상 인제스트 — Claude Code 기존 7건 기반 건당 비용 ~$1.00 추정 (inbox 비어있어 추가 5건 대기)
- [x] 10.2 대용량 소스 — 파워디바이스 37p Gemini 2.5 Flash 요약 $0.01 → source-power-device-basics 통합
- [x] 10.3 독립 린트 — Codex CLI 0.118.0 + GPT-4.1 71K토큰 $0.17, validate/pii PASS
- [x] 10.4 오프라인 쿼리 — Gemma 4 로컬 5건 평균 44s 정상 응답
- [x] 10.5 비용 추적 CLI `scripts/cost-tracker.sh` + `activity/cost-log.md` (11건 기록, $21.13/50 = 42.3%)
- [x] 10.6 비용 효율 분석 `activity/cost-analysis.md` — 검색/임베딩/쿼리 100% 로컬, 월간 시뮬레이션 $14.73 (29.5%)

## 2.11 볼트 템플릿 + LLM 스킬 패키지
> tag: #main-feature, #docs

- [x] 11.1 볼트 스켈레톤 + `.obsidian/` 기본 설정 (app, appearance, core-plugins, graph)
- [x] 11.2 `.gitignore` raw/ 제외 확인 + 민감 정보 이력 없음 (.env.example만 추적)
- [x] 11.3 `scripts/setup.sh` 7단계 자동 점검 (Obsidian, Ollama+gemma4, Python+kiwipiepy, qmd, .env, wikey.conf, 권한) + `--check` 모드
- [x] 11.4 CLAUDE.md · AGENTS.md 인제스트 체크리스트 reindex.sh 통합
- [x] 11.5 로컬 전용 모드 (BASIC_MODEL=ollama) 검증 — 쿼리 동작, 인제스트 JSON 잘림 이슈 (model-selection-guide 문서화)
- [x] 11.6 README "5분 시작 가이드" + setup.sh / check-providers / validate-wiki / reindex --check 전항목 PASS

## 2.12 누적 정확도 추이
> tag: #eval, #docs

- [x] 12.1 베이스라인(40%) → kiwipiepy(+조사 분리 hits) → Contextual Retrieval(+10%p) → Qwen3-Embedding(vsearch 100%) → 통합(Recall 97~98%) 누적 타임라인

## 2.13 산출물 + 인프라 현황
> tag: #infra, #docs

- [x] 13.1 프로젝트 구조 (tools/qmd/, scripts/, bench/, local-llm/wikey.conf, .env.example)
- [x] 13.2 인프라 현황 (Ollama 0.20.5 / Gemma 4 / EmbeddingGemma → Qwen3-Embedding / vLLM-Metal / Codex CLI)
- [x] 13.3 검색 파이프라인 현재 상태 (basic · gemma4 backend 양쪽 동작, wikey-query.sh `--search` 지원)

## 2.14 핵심 발견 및 교훈
> tag: #docs

- [x] 14.1 형태소 전처리 하나로 BM25 한국어 검색이 살아난다
- [x] 14.2 Contextual Retrieval은 소규모 위키(29문서)에서도 효과적 (실패율 -49%)
- [x] 14.3 Gemma 4 thinking 모델에는 충분한 토큰 예산 필요 (thinking ~500 + response ~100)
- [x] 14.4 후처리 레이어 전략이 upstream 충돌을 최소화 (FTS5 배치 후처리 · 인덱싱 직후 prepend)
- [x] 14.5 사전 조사(Step 3 선행)가 시행착오를 방지했다 (Chonkie / Late Chunking 기각 근거)
- [x] 14.6 GGUF 임베딩 모델은 아키텍처 호환성이 핵심 (XLM-RoBERTa 미지원 이슈 발견)

## 2.15 미완료 항목 및 로드맵
> tag: #docs, #architecture

- [ ] 15.1 선택 (Could) — vLLM-Metal 배치 리랭킹
- [ ] 15.2 선택 (Could) — 한영 용어 정규화 사전 50+ 항목
- [x] 15.3 선택 (Could) — Obsidian 플러그인 프로토타입 → Phase 3로 흡수 완료
- [x] 15.4 전체 Phase 로드맵 정리 (Phase 3 Obsidian 플러그인 / Phase 4 인제스트 고도화 + 지식 그래프 / Phase 5+ 기업 패키지)

## 2.16 Phase 2 완료 체크리스트
> tag: #docs

- [x] 16.1 필수 (Must) 7/7 — PARA / CLASSIFY / LLM 다층 / 한국어 벤치 80%+ / validate+pii / 통합 LLM 설정 / 볼트 템플릿
- [x] 16.2 중요 (Should) 6/6 — inbox 감시 / Gemini 대용량 / llm-ingest dry-run / 비용 추적 / reindex / setup.sh --check
- [ ] 16.3 선택 (Could) 0/3 — vLLM 배치 리랭킹 / 한영 용어 사전 / Obsidian 플러그인 프로토타입(→ Phase 3 완료)
