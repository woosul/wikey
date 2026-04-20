---
title: 활동 로그
type: log
created: 2026-04-10
updated: 2026-04-21
---

## [2026-04-21] eval | 결정성 측정 (PMS v6 vs v7 post)

- 대상: raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf
- 방법: 수동 CDP 드라이브 audit panel (5-run, 각 run 후 entity/concept/source 삭제 + ingest-map 정리)
- 결과: Entities CV 17.9%, Concepts CV 21.2% (-37% vs v6 33.4%), Total CV 7.9% (-53% vs v6 16.9%), 범위 22-26, 평균 320s
- 판정: v7-1 decision tree + v7-2 anti-pattern + v7-5 schema override의 Concepts CV 목표(≤25%) 정량 확증
- 산출물: activity/determinism-pms-post-v7-2026-04-21.md (Core/Variable 분석 + 잔여 canonicalization 변동 해부)
- 후속: slug canonicalizer 2차 확장·E/C 경계 3건 schema 고정·measure-determinism.sh selector fix → Phase 4 §4.5.1

## [2026-04-20] ingest | OMRON_HEM-7600T.pdf

- 엔티티 생성: [[omron]]
- 엔티티 생성: [[japanese-society-of-hypertension]]
- 엔티티 생성: [[omron-healthcare-co-ltd]]
- 엔티티 생성: [[bluetooth-sig-inc]]
- 엔티티 생성: [[apple-inc]]
- 엔티티 생성: [[omron-customer-service-center]]
- 엔티티 생성: [[omron-healthcare-korea]]
- 엔티티 생성: [[marler-jr]]
- 엔티티 생성: [[hem-7600t]]
- 엔티티 생성: [[intellisense]]
- 엔티티 생성: [[aaa-alkaline-battery]]
- 엔티티 생성: [[omron-connect]]
- 엔티티 생성: [[hem-7600t-w]]
- 엔티티 생성: [[iphone]]
- 엔티티 생성: [[app-store]]
- 엔티티 생성: [[bluetooth]]
- 엔티티 생성: [[magnetic-resonance-imaging]]
- 엔티티 생성: [[ct-scanner]]
- 개념 생성: [[electromagnetic-compatibility]]
- 개념 생성: [[bluetooth-low-energy]]
- 개념 생성: [[iso-81060-2-2013]]
- 개념 생성: [[iec-60529]]
- 개념 생성: [[iec-60601-1-2-2007]]
- 개념 생성: [[cispr-11]]
- 개념 생성: [[iec-61000-4-2]]
- 개념 생성: [[quality-guarantee-certificate]]
- 개념 생성: [[medical-guideline]]
- 추가 소스: [[source-omron-hem-7600t-manual]]


## [2026-04-19] ingest | 사업자등록증C_(주)굿스트림_301-86-19385(2015).pdf

- 소스 요약 생성: [[source-goodstream-biz-reg-cert-2015]]
- 엔티티 생성: [[goodstream-co-ltd]], [[kim-myung-ho]], [[cheongju-tax-office]], [[national-tax-service]]
- 개념 생성: [[business-registration-certificate]], [[corporate-business]], [[software-development]], [[wireless-communication-application-device-manufacturing]], [[business-unit-taxation]], [[electronic-tax-invoice]]
- 인덱스 갱신


## [2026-04-18] ingest | Raspberry_Pi_High_Quality_Camera_Getting_Started.pdf

- 소스 요약 생성: [[source-raspberry-pi-high-quality-camera]]
- 엔티티 생성: [[raspberry-pi-high-quality-camera]], [[raspberry-pi]], [[c-mount-lens]], [[cs-mount-lens]], [[raspbian]], [[raspistill]], [[raspberry-pi-trading-ltd]], [[mipi-alliance-inc]], [[raspberry-pi-foundation]]
- 개념 생성: [[back-focus-adjustment]], [[ir-filter]], [[c-cs-adapter]], [[tripod-mount]], [[regulatory-compliance]], [[safety-information]], [[mipi-dsi]], [[mipi-csi]]
- 인덱스 갱신


## [2026-04-18] lint | Phase 3 E2E 중복 제거 (B-1 #2 품질 검증)

- 중복 제거 13건: `entity-byoai`, `entity-wikey`, `entity-zero-setup`, `entity-korean-enterprise-specialization`, `entity-architecture-decision-records`, `entity-nanovna-v2`, `ROHM-Co-Ltd`, `sic-power-devices`, `SiC-파워-디바이스`, `concept-architecture-decision-records`, `concept-llm-participation-multi-layer-search`, `concept-llm-wiki-architecture`, `sources/nanovna-v2-notes` (canonical로 내용 병합 후 삭제)
- 슬러그 rename 3건: `SiC-MOSFET` → `sic-mosfet`, `SiC-SBD` → `sic-sbd`, `Full-SiC-파워-모듈` → `full-sic-power-module` (lowercase-hyphen 규칙 통일)
- 위키링크 리라이트: log.md / index.md 참조 갱신
- plain-text 참조 → 위키링크 변환: `rohm.md`, `sic-power-device.md`, `sic.md` (`sic-sbd`, `sic-mosfet`, `full-sic-power-module`)
- 자기참조 제거: `sic-power-device.md`
- canonical 보강: `nanovna-v2.md` (entity-nanovna-v2 내용 병합), `architecture-decision-records.md` (ADR-001~007 정보 추가)
- index.md 전면 재작성 (E2E 테스트 섹션 제거, 엔티티/개념 일관 정렬)
- 원인: Scenario 4 custom 프롬프트(`entity-` 접두사 + 영문 대문자 slug)가 기본 프롬프트 산출과 슬러그 충돌
- 검증: validate-wiki.sh PASS (5/5)

## [2026-04-18] ingest | wikey-design-decisions.md (smoke test)

- 소스 요약 생성: [[source-wikey-design-decisions]]
- 엔티티 생성: [[zero-setup]], [[byoai]], [[korean-enterprise-specialization]], [[architecture-decision-records]]
- 개념 생성: [[architecture-decision-records]], [[llm-participation-multi-layer-search]], [[llm-wiki]]
- 인덱스 갱신


## [2026-04-18] ingest | Phase 3 E2E test
- 소스 요약 생성: [[source-wikey-design-decisions]]
- 엔티티 생성: [[wikey]], [[zero-setup]], [[byoai]], [[korean-enterprise-specialization]]
- 개념 생성: [[architecture-decision-records]], [[llm-participation-multi-layer-search]], [[morphological-analysis-guardrail]]
- 인덱스 갱신


## [2026-04-18] ingest | Phase 3 E2E test
- 소스 요약 생성: [[source-nanovna-v2-notes]]
- 엔티티 생성: [[nanovna-v2]]
- 개념 생성: [[concept-antenna-measurement]]
- 인덱스 갱신


## [2026-04-18] ingest | Phase 3 E2E test
- 소스 요약 생성: [[overview]]
- 엔티티 생성: [[andrej-karpathy]], [[farzapedia]], [[llmbase]], [[secall]], [[obsidian]], [[qmd]], [[dji-o3-air-unit]], [[nanovna-v2]]
- 개념 생성: [[llm-wiki]], [[three-layer-architecture]], [[knowledge-compounding]], [[ingest-query-lint]], [[rag-vs-wiki]], [[byoai]], [[schema-layer]], [[memex]], [[append-and-review]], [[fpv-digital-transmission]]
- 인덱스 갱신


## [2026-04-18] ingest | Phase 3 E2E test
- 소스 요약 생성: [[source-wikey-design-decisions]]
- 엔티티 생성: [[claude-code]], [[codex-cli]], [[gemini]], [[gemma-4]]
- 개념 생성: [[korean-enterprise-specialization]], [[file-over-app]], [[rag-synthesis-layer]], [[llm-provider-independence]], [[korean-search-strategy]], [[morphological-analysis-guardrail]]
- 인덱스 갱신


## [2026-04-18] ingest | Phase 3 E2E test
- 소스 요약 생성: [[source-wikey-design-decisions]]
- 엔티티 생성: [[wikey]], [[zero-setup]], [[byoai]], [[korean-enterprise-specialization]]
- 개념 생성: [[architecture-decision-records]], [[llm-participation-multi-layer-search]], [[llm-wiki]]
- 인덱스 갱신


## [2026-04-18] ingest | Phase 3 E2E test
- 소스 요약 생성: [[source-wikey-design-decisions]]
- 엔티티 생성: [[wikey]], [[byoai]], [[zero-setup]]
- 개념 생성: [[architecture-decision-records]], [[llm-participation-multi-layer-search]]
- 인덱스 갱신


# 활동 로그

> 형식: `## [YYYY-MM-DD] type | title`
> type: ingest, query, lint, delete, re-ingest
> 이 파일은 append-only. 과거 항목을 수정하지 않는다.

## [2026-04-10] ingest | Karpathy LLM Wiki 원문

- 원시 소스: `raw/articles/llm-wiki.md`
- 소스 요약 생성: [[source-llm-wiki-gist]]
- 엔티티 생성: [[andrej-karpathy]], [[qmd]]
- 개념 생성: [[llm-wiki]], [[three-layer-architecture]], [[knowledge-compounding]], [[ingest-query-lint]], [[rag-vs-wiki]], [[schema-layer]], [[memex]]
- 인덱스 갱신: 12개 항목 등재

## [2026-04-10] ingest | LLM Wiki 커뮤니티 반응과 사례

- 원시 소스: `raw/articles/idea-comment.md`
- 소스 요약 생성: [[source-llm-wiki-community]]
- 엔티티 생성: [[farzapedia]], [[llmbase]], [[secall]]
- 개념 생성: [[byoai]]
- 엔티티 업데이트: [[andrej-karpathy]], [[qmd]] (소스 추가)
- 개념 업데이트: [[llm-wiki]], [[knowledge-compounding]], [[rag-vs-wiki]], [[memex]] (커뮤니티 사례 반영)
- 인덱스 갱신: 15개 항목 등재

## [2026-04-10] ingest | Karpathy Append-and-Review Note

- 원시 소스: `raw/articles/append-and-review-note.md` (웹 기사, defuddle로 추출)
- 소스 요약 생성: [[source-append-and-review]]
- 개념 생성: [[append-and-review]]
- 엔티티 업데이트: [[andrej-karpathy]] (소스 추가, append-and-review 섹션 추가)
- 인덱스 갱신

## [2026-04-10] ingest | Wikey 설계 의사결정

- 원시 소스: `raw/notes/wikey-design-decisions.md` (개인 메모)
- 소스 요약 생성: [[source-wikey-design-decisions]]
- 기존 개념/엔티티에 교차참조 추가 (ADR → byoai, schema-layer, rag-vs-wiki)
- 인덱스 갱신

## [2026-04-10] query | LLM Wiki의 가장 큰 리스크는 무엇인가?

- 분석 저장: [[risks-of-llm-wiki]]
- 참조 페이지: source-llm-wiki-community, source-wikey-design-decisions, llm-wiki, byoai
- 인덱스 갱신: 분석 카테고리에 1건 추가

## [2026-04-10] ingest | DJI O3 Air Unit 사용자 매뉴얼 (PDF 청킹 테스트)

- 원시 소스: `raw/manual/00.게임기기/830 FPV/DJI O3 Air Unit/DJI_O3_Air_Unit_User_Manual_v1.0_EN.pdf` (33p)
- 청킹 방법: 3분할 읽기 (p1-5 TOC+경고, p6-15 본체+설치+고글UI, p16-33 호환장비+스펙)
- 소스 요약 생성: [[source-dji-o3-air-unit]]
- 엔티티 생성: [[dji-o3-air-unit]]
- 개념 생성: [[fpv-digital-transmission]]
- 인덱스 갱신

## [2026-04-10] query | 쿼리 워크플로우 검증 5건

- 5-1 단순 사실: "3계층 아키텍처" → [[three-layer-architecture]] 직접 참조, 저장 불필요
- 5-2 교차 합성: "비전 vs 현실" → 분석 저장: [[vision-vs-reality]]
- 5-3 분석: "가장 큰 리스크" → 분석 저장: [[risks-of-llm-wiki]] (이전 커밋)
- 5-4 엔티티: "Karpathy" → [[andrej-karpathy]] 직접 참조, 저장 불필요
- 5-5 빈 결과: "양자 컴퓨팅" → 위키에 해당 주제 없음 확인

## [2026-04-10] lint | 린트 워크플로우 검증

- 의도적 결함 3건 생성: 고아 페이지, 깨진 위키링크, 인덱스 누락
- validate-wiki.sh 감지: 깨진 위키링크 1건, 인덱스 미등재 1건 (exit 1)
- 고아 페이지(인바운드 링크 부재)는 스크립트 범위 외 → LLM 린트로 보완 필요
- 결함 수정 후 재검증: PASS

## [2026-04-11] restructure | raw/ PARA 마이그레이션

- raw/ 디렉토리를 flat type-based 구조에서 PARA 구조로 재편
- 1,073개 파일 재분류: inbox/ + projects/ + areas/ + resources/ + archive/
- 분류 기준 문서 생성: `raw/CLASSIFY.md` (하이브리드 규칙+자연어 가이드+피드백 로그)
- 기존 로그 항목의 raw/ 경로는 역사적 기록으로 유지
- wiki/sources/ 페이지의 원시 소스 경로 6건 갱신
- 영향 페이지: 모든 source-*.md, [[obsidian]], [[append-and-review]]

## [2026-04-11] feat | Phase 2 Step 3-0/3-1 — 한국어 검색 사전 조사 + 형태소 전처리

- Step 3-0 사전 조사 완료: 5개 병렬 에이전트 + FTS5 실증 테스트
  - 채택: kiwipiepy 형태소 전처리, Contextual Retrieval (Gemma 4), jina-embeddings-v3
  - 기각: Chonkie SemanticChunker (NAACL 2025 반증), Late Chunking (문서 1청크), FTS5 커스텀 토크나이저
- Step 3-1 형태소 전처리 구현 완료:
  - `scripts/korean-tokenize.py` 신규 생성 (kiwipiepy, index/query/fts5/batch 모드)
  - FTS5 인덱스 29문서 형태소 전처리 — 한국어 조사 분리로 BM25 recall +74 hits
  - `wikey-query.sh` search/basic/gemma4 3개 모드에 lex 쿼리 전처리 통합
  - 영어 토큰 보존 확인 (BM25, FPV 등)
- 조사 결과 상세: `plan/step3-0-research-report.md`
- 영향 페이지: [[qmd]], wikey-query.sh, qmd-comprehension-guide.md

## [2026-04-11] infra | Phase 2 Step 2 — qmd 다층 검색 파이프라인 구축

- qmd 2.1.0 소스 클론 → `tools/qmd/`에 vendored (tobi/qmd@cfd640e)
- `~/.claude.json`에 MCP 서버 글로벌 등록
- wiki/ 인덱싱: 29 문서, 36 청크, EmbeddingGemma-300M
- `wikey-query.sh` backend 분리: basic(qmd 내장) / gemma4(Gemma 4 지능 레이어)
- `local-llm/wikey.conf` 환경 설정 파일 생성
- `scripts/update-qmd.sh` upstream 관리 스크립트 (git pull 기반)
- `tools/qmd-comprehension-guide.md` 소스 완전 분석 가이드 (아키텍처+평가+커스터마이징)
- 벤치마크: basic Top-1 0/5, gemma4 Top-1 1/5 (한국어) → Step 3 청킹 혁신 필요
- Semantic Chunking 커뮤니티 조사 완료 (Contextual Retrieval 유력)
- idea-comment.md 한국어 프로젝트 참조 추가 (seCall BM25 가드레일)
- 영향 페이지: [[qmd]], wikey.schema.md, CLAUDE.md, local-llm/README.md

## [2026-04-11] ingest | NanoVNA V2 개인 노트

- 원시 소스: `raw/notes/nanovna-v2-notes.md`
- 소스 요약 생성: [[source-nanovna-v2-notes]]
- 엔티티 생성: [[nanovna-v2]]
- 기존 엔티티/개념과 교차참조 연결: [[dji-o3-air-unit]], [[fpv-digital-transmission]]
- 인덱스 갱신

## [2026-04-11] infra | Contextual Retrieval (Gemma 4) 구현

- `scripts/contextual-retrieval.py` 생성 — Anthropic Contextual Retrieval 구현
- Gemma 4 12B로 29개 문서 맥락 프리픽스 생성 (~7분)
- FTS5 body에 프리픽스 prepend → BM25 키워드 풍부화
- `store.ts` 임베딩 파이프라인에 프리픽스 후킹 추가
- BM25 Top-1 정확도: 5/10 → 6/10, Top-3: 7/10 → 8/10
- 핵심 교정: "FPV digital transmission" Top-1 → fpv-digital-transmission.md
- 파이프라인: contextual-retrieval.py --batch → korean-tokenize.py --batch

## [2026-04-12] ingest | SiC 파워 디바이스의 기초 (Gemini → Claude Code 파이프라인)

- 원시 소스: `raw/3_resources/20_report/TWHB-16_001_kr_파워디바이스의기초.pdf` (37p, 3MB)
- 인제스트 방법: Gemini 2.5 Flash 1차 요약 → Claude Code 위키 통합 (Step 5-1-2)
- 소스 요약 생성: [[source-power-device-basics]]
- 인덱스 갱신: 소스 1건 등재
- 비용: Gemini $0.02 (요약) + Claude Code 세션 비용 (통합)

## [2026-04-12] infra | Phase 2 Step 5 — 멀티 LLM 워크플로우 최적화

- 비용 추적 인프라: `scripts/cost-tracker.sh` + `activity/cost-log.md`
- Gemma 4 로컬 쿼리 5건 검증 (평균 44초, basic backend)
- Codex CLI 교차 검증 린트 1회 (71K 토큰, $0.17)
- Gemini → Claude Code 대용량 인제스트 파이프라인 1건 검증
- 비용 분석: 프로바이더별 요금, 워크플로우별 비용 효율
