---
title: 활동 로그
type: log
created: 2026-04-10
updated: 2026-04-22
---

## [2026-04-22] eval | §4.5.1.6 측정 — determinism + canon 3차 → 29-run Total CV 9.2% (baseline 24.3% → −62% 상대)

- 구현: §4.5.1.6.1 `WIKEY_EXTRACTION_DETERMINISM` flag (Gemini temperature=0 + seed=42), §4.5.1.6.3 SLUG_ALIASES 3차 (5→20, alimtalk 4-variant + ERP/SCM/MES -system suffix + BOM 4-variant + RESTful/TCP-IP/MQTT spelled-out), §4.5.1.6.4 FORCED_CATEGORIES 3차 (3→13 pin, ERP/SCM/MES/PLM/APS/전자결재/SSO/TCP-IP/VPN/BOM). Tests 290→315 PASS, build 0 errors.
- 10-run 측정 (§4.5.1.6.2): Total CV **24.3% → 7.2%** (−17.1pp, 상대 −70.4%). Entities CV 36.4% → 13.9%. Core entities 3/40 (8%) → 18/31 (58%), concepts 4/47 (9%) → 11/22 (50%). Union 사이즈 급감 87 → 53 (alias 수렴). 9/10 run 성공 (run10 timeout).
- 30-run 측정 (§4.5.1.6.6, 29-run valid + 1 tool outlier): Total CV **9.2%** (목표 <10% 달성), Entities CV 11.1%, Concepts CV 27.0%. Total 값이 {35, 41, 43, 45} 4 값으로 극도로 양자화. Mean 41.21 (10-run mean 41.89와 일치).
- Run 30 outlier 해설: 0/0/0 + 3s elapsed. 측정 스크립트 `restoreSourceFile()` 가 이전 run 의 `autoMoveFromInbox` 후 원본 복구 실패. 툴 버그, production code 아님 — followup 로 `walk()` 강화 필요.
- 기여 추정 (분리 측정은 §4.5.1.7): determinism ~50-60%, SLUG_ALIASES ~20-30%, FORCED_CATEGORIES ~15-25% of 24.3% baseline.
- 잔여 variance 9.2% 원인: Concepts CV 27.0% (BOM/project-knowledge-areas variance), Entities CV 11.1% (Lotus-prefix 3 변형 가끔 동시 출현).
- 판정: Phase A/B 목표 모두 달성. §4.5.1.6 종료. §4.5.1.6.5 Route 비교는 <10% 달성으로 §4.5.1.7 이관 (diagnostic 가치 감소).
- 산출물: `activity/phase-4-5-1-6-pms-10run-determinism-2026-04-22.md` (10-run 원본), `activity/phase-4-5-1-6-pms-30run-final-2026-04-22.md` (30-run 원본 + 29-run 보정), `activity/phase-4-result.md §4.5.1.6.1~.6`, `plan/phase-4-todo.md §4.5.1.6` 모두 완료.
- wiki 오염 revert: 측정 중 `wiki/log.md`, `wiki/index.md`, `wiki/entities/goodstream-co-ltd.md` 수정 발생 → `git checkout` 원복.
- Commits: 29ca6a9 (§4.5.1.6.1/3/4 구현 + 10-run), 1f2783e (session-wrap docs).

## [2026-04-22] eval | §4.5.1.5 측정 — 30-run PMS Total CV 24.3% (baseline 32.5%, −8.2pp)

- 측정: `./scripts/measure-determinism.sh raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf -n 30` (Gemini 2.5 Flash, Obsidian CDP). 30/30 성공, 평균 5.6분/run, 총 190분.
- Total CV **32.5% → 24.3%** (−8.2pp, 상대 −25.2%). Entities CV 36.4%, Concepts CV 31.1%. Core entities 3/40 (7.5%), Core concepts 4/47 (8.5%).
- Gate ratio 24.3/32.5 = 0.748 → "20-50% 기여" 구간. smoke 3-run (CV 11.6%, ratio 0.357) 의 "> 50% 기여" 판정은 sample variability 로 과장 확인. N=10 subset CV ≈ 28% 로 N=3 신뢰 불가 재확증.
- 잔여 variance 75%: (a) LLM 수준 (Gemini `temperature=0.1` 기본, seed 미설정), (b) canonicalizer 미도달 패턴 — `alimtalk` 5-variant (`allim-talk`, `kakao-alimtalk` 등), ERP/SCM/MES 3-variant, BOM 5-variant, E/C 경계 왕복 (`electronic-approval`/`-system`, `restful-api`/`representational-state-transfer-api`).
- 판정: Phase A/B/C 이행 **유지** (CV 감소 + `wikey.schema.md §19·§21` 철학 + 290 PASS). Selective rollback 불필요.
- 측정 infra 패치: `scripts/measure-determinism.sh` 에서 audit panel refresh 버그 수정. `selectPanel` 의 re-click guard (`if activePanel===name return`) 때문에 `auditBtn.click() × 2` 가 no-op → 첫 실행 10-run 중 1-run 만 성공. 해결: audit → chat → audit routing 으로 panel 강제 destroy+recreate.
- 선결 실패: 첫 10-run (1/10 성공). 원인 확정 후 패치 → smoke 3-run (3/3) → 30-run (30/30) 순으로 검증.
- 후속: §4.5.1.6 승격 — LLM determinism 플래그 (`temperature=0 + seed=42`) + canonicalizer 3차 확장 (ERP/SCM/MES suffix, BOM 5-variant, alimtalk 신규 alias) + FORCED_CATEGORIES canonical resolution 업그레이드. 목표 CV <15% (determinism) → <10% (canonicalizer 3차).
- 산출물: `activity/phase-4-5-1-5-pms-30run-2026-04-22.md` (30-run 원본), `activity/smoke-3run-pms-0025.md`, `activity/phase-4-result.md §4.5.1.5.11~.14`, `plan/phase-4-todo.md §4.5.1.6` (신규 6 sub-task), `plan/session-wrap-followups.md` (§4.5.1.6 최우선).
- wiki 오염 revert: 측정 중 ingest 로 `wiki/log.md` (+825), `wiki/index.md` (+85), `wiki/entities/goodstream-co-ltd.md`, `wiki/concepts/business-registration-certificate.md` 수정 발생 → `git checkout` 으로 원복 (measure-determinism.sh `cleanupForRerun` 는 신규 파일만 삭제, pre-existing mod 은 범위 밖).

## [2026-04-22] feat | §4.5.1.5 v2 RAG chunk 폐지 + LLM Wiki Phase A/B/C 이행 (구현 완료, 측정 분리)

- 배경: §4.5.1.4 에서 SLUG_ALIASES/FORCED_CATEGORIES 로도 Total CV 32.5% 해소 못 함. 원인이 post-processing 밖임을 확증. §4.1 Docling 완료 직후 철학 재검토에서 **RAG chunk 자체가 `wikey.schema.md §19·§21` 배격 대상** 임이 드러남 — §19 "책을 훑어 목차+색인 만들고 필요한 장만 읽기" (Phase A/B/C), §21 "검색을 DB에 위임하면 다시 RAG". 현 `splitIntoChunks(8000)` 는 schema 위반 + variance 의 구조적 원인.
- v1 → v2 경위: 초안(LLM Phase A 분류기 + Route 3분기 + char 임계)은 Claude 자체검증 8건 + Codex 적대적검증 12건 NEEDS-REVISION. 핵심 지적 수용 — (1) LLM Phase A 는 "retriever 변형" → 완전 결정적 파서로 전환 (2) Route 3분기 → 2분기 (FULL/SEGMENTED) (3) char 임계 → token-budget (한국어 ×2-3 margin) (4) "모두 core" fallback → 결정적 휴리스틱 (5) ablation 선행 (6) N=10 → N=30 (PMS main).
- 신규 파일: `wikey-core/src/section-index.ts` (결정적 Phase A 파서, LLM 의존 0) + 테스트 3건 (22+14+3). `plan/phase-4-change-phase-abc.md` (v2 설계 문서). `scripts/ablation-ingest.sh`.
- 수정 파일: `provider-defaults.ts` (ContextBudget + estimateTokens + selectRoute), `ingest-pipeline.ts` (splitIntoChunks/MAX_SOURCE_CHARS 삭제, Route FULL/SEGMENTED 로직, appendSectionTOCToSource for Phase C), `types.ts` (`Mention.source_chunk_id` → `source_section_idx` rename).
- Route 결정: `selectRoute(md, provider, model)` — Gemini 2.5 Flash + PMS 83KB 한국어 → FULL, Ollama qwen3:8b + 동일 → SEGMENTED. SEGMENTED 는 core ∪ support 섹션만 추출 (skip 은 제외), 각 호출에 peer context (DOC_OVERVIEW + GLOBAL_REPEATERS + CURRENT_SECTION + LOCAL_NEIGHBORS, ~300 tok cap) 주입.
- Phase C 근거: 소스 페이지 body 에 섹션 TOC (priority/본문 chars/warnings) 결정적 append — 쿼리 시 LLM 이 미심독 섹션 판단 근거.
- 엣지 커버: heading-0, mixed level (##+###), 코드블록 내부 #, `##기술스택` (공백 없음), 반복 page header (suspicious-heading), bodyChars<5 merge (v1 의 50 은 과도 → 5 로 하향), table-only, preamble.
- 검증: 251 → **290 tests PASS** (+39). tsc 0 errors, esbuild 0 errors.
- 측정 분리: 10-run/30-run variance 측정은 Obsidian CDP (port 9222) + Gemini/Ollama API 키 환경에서 사용자 별도 세션. Ablation gate (섹션 경계 기여도 >50% / 20-50% / <20%) 후 30-run 진행 여부 결정. §4.5.1.4 baseline CV 32.5% 대비 개선 확증 대기.
- 산출물: `plan/phase-4-change-phase-abc.md` v2, `activity/phase-4-result.md §4.5.1.5` (구현 집계 + 다음 세션 측정 가이드).

## [2026-04-21] eval | §4.1 완료 — 5개 코퍼스 벤치마크 + UI override 완전 제거 + body regression guard

- 배경: 사용자 피드백 "전처리~ingest 자동 흐름이므로 사용자 UI override 부담 없애고 로직을 탄탄하게". Force re-convert 체크박스도 사용자가 변환 결과를 검토할 틈이 없어 실용성 없음.
- 추가 벤치마크 (3건): TWHB 파워디바이스 (37p 한국어 표), OMRON HEM-7600T (48p vector-only), 사업자등록증 (1p 스캔 후 OCR). 총 5개 코퍼스 (기존 PMS + ROHM 포함).
- 결정적 발견: OMRON vector-only PDF 에서 MarkItDown/pdftotext/pymupdf 모두 1~48 bytes 출력 (사실상 실패). Docling --force-ocr 만이 9.2KB 구조화 출력 (19 headings + 77 tables). 자동 `isLikelyScanPdf` 감지 로직의 존재 이유를 실증.
- UI override 완전 제거: `ConverterOverride` 타입 + `IngestOptions.converterOverride` + `IngestOptions.forceReconvert` + sidebar-chat Audit 패널의 converterBar / converterSelect / forceCb. `runTier()` 가드, extract*Text 의 overrides 파라미터, cache bypass 분기 모두 제거.
- 로직 강화: `hasBodyRegression(baseline, regressed)` 신규 — 언어 무관 본문 regression 감지. baseline ≥ 500자 중 50% 미만으로 떨어지면 tier 1 롤백. OMRON 처럼 한국어 없는 PDF 에서도 force-ocr 독성 방어.
- 구조 보존 정량 (5개 코퍼스 합계): Docling 212 headings + 294 실제 tables vs MarkItDown 0 heading + 0 실제 tables (TWHB/사업자등록증에서 셀 구분자 오잘 581개). 계획서 +20% 기준 수십 배 초과.
- 검증 빌드: 242 → 251 tests PASS (hasBodyRegression 4 + isLikelyScanPdf 3 + bodyCharsPerPage 2), wikey-core tsc + wikey-obsidian esbuild 0 errors.
- 산출물: `activity/phase-4-converter-benchmark.md` (5개 코퍼스 종합 리포트), `activity/phase-4-result.md §4.1.2` (완료 선언 + 성과 분석).
- 해제된 선행 의존: **§4.5.1.5 variance 재측정** — Docling 구조적 markdown 확보로 "전처리 품질" 성분 분리 측정 준비 완료. 다음 세션 최우선.
- 후속 Phase 로 이관: §4.1.1.9 vault rename/delete listener (§4.2.2 URI 참조와 합동), §4.1.1.5 ps aux 실측 (security audit 별도), scripts/cache-stats.sh (우선순위 낮음).

## [2026-04-21] feat | §4.1.1.6 자동 force-ocr 감지 로직 (사용자 UI override 제거)

- 배경: 사용자 피드백 "UI override 바람직하지 않음, 프로그램 로직으로 자동 판정". ROHM Wi-SUN 샘플(웹페이지 프린트 PDF)과 스캔 PDF 는 force-ocr 필요, PMS 제품소개(벡터 PDF)는 force-ocr 시 한국어 0자 regression — 자동 감지가 세 케이스를 모두 올바르게 처리해야.
- 변경 (convert-quality.ts 신규 함수 4개): `countKoreanChars`, `koreanLongTokenRatio`, `hasKoreanRegression`, `bodyCharsPerPage`, `isLikelyScanPdf`. 테스트 9건 추가 (233 → 242 PASS).
- 변경 (ingest-pipeline.ts tier 1 블록): 자동 retry 조건 확장 — `quality.decision === 'retry' OR isLikelyScanPdf(ok, pageCount)`. Regression guard 추가 — tier 1b 한국어가 tier 1 의 50% 미만이면 tier 1 롤백. Tier 1b 실패 시 tier 1 vs tier 1b score 비교 후 높은 쪽 채택.
- 삭제 (사용자 override 제거): `ConverterOverride` 타입, `IngestOptions.converterOverride`, `IngestRunOptions.converterOverride`, `runTier()` 가드, tier 2/3/6 의 override 스킵 분기, docling-ocr 단독 실행 분기, sidebar-chat.ts 의 Converter 드롭다운 + 6개 option.
- 유지: `Force re-convert` 체크박스 (캐시 bypass 디버그 토글 용).
- 검증:
  - ROHM Wi-SUN textlayer: 공백소실 60.20% > 30% → retry 자동 발동 (OK)
  - ROHM Wi-SUN force-ocr: 공백소실 0.27%, 한국어 2,083 (textlayer 2,021 보다 개선) → accept
  - PMS 제품소개 textlayer: 공백소실 4.93% < 30% → retry 스킵, accept (불필요한 비용 없음)
  - PMS 제품소개 regression 가상 케이스: tier 1b 한국어 0 → tier 1 롤백 (안전)
  - 스캔 PDF: 페이지당 < 100자 AND 한국어 < 50자 → retry 자동 발동
- 검증 빌드: 242 PASS, wikey-core tsc + wikey-obsidian esbuild 0 errors.
- 산출물: docs/samples/ROHM_Wi-SUN*.md 3종 실증 비교 기반.

## [2026-04-21] feat | §4.1.1 Docling 메인화 + unhwp + MarkItDown 강등 (전처리 파이프라인 전면 재편)

- 결정: IBM Docling(TableFormer + layout model + ocrmac/RapidOCR/Tesseract)을 tier 1 메인 컨버터로 승격. HWP/HWPX는 unhwp 전용, MarkItDown은 tier 3 fallback 강등. 이미지(base64 data URI + 외부 URL)는 LLM 투입 직전 `[image] / [image: alt]` placeholder로 치환.
- 변경 (core): wikey-core/src/{rag-preprocess,convert-cache,convert-quality}.ts 신규 + `extractPdfText` 전체 재구성 + `extractHwpText`·`extractDocumentText` 신규 + `selectConverter` 확장자 분기. `DOCLING_TABLE_MODE/DEVICE/OCR_ENGINE/OCR_LANG/TIMEOUT_MS/DISABLE` 설정 키. `ConverterOverride` 타입 + `IngestOptions.converterOverride/forceReconvert`.
- 변경 (obsidian): env-detect에 `checkDocling`/`checkUnhwp` + `hasDocling/doclingVersion/hasUnhwp` 필드. settings-tab Environment 섹션에 Docling/unhwp 라인 + 설치 가이드 버튼. sidebar-chat Audit 패널 bottom bar에 Converter 드롭다운(6개 옵션, docling-ocr에 "벡터 PDF 비권장" title hint) + Force re-convert 체크박스.
- 보안: tier 2 markitdown-ocr + tier 6 Vision OCR의 `execFile` args에서 `ocr.apiKey` 제거 → env(`OPENAI_API_KEY`/`OPENAI_BASE_URL`) 주입. ps aux 노출 제거.
- 캐시: `sha256(sourceBytes) + converter + majorOptions` 키, `~/.cache/wikey/convert/<hash>.md`, TTL 30일. `forceReconvert` bypass.
- 품질 감지: broken tables / empty sections / min body / korean whitespace loss 스코어링 → accept / retry(--force-ocr) / reject 결정. 한국어 공백 소실 감지 시 tier 1b 자동 재시도.
- sidecar: 변환 후 원본 옆 `<source>.md` 저장 (LLM 투입 결과 사용자 확인용).
- 벤치마크: `scripts/benchmark-converters.sh` 신규. PMS PDF(3.5MB, 31p) 실측 → Docling 83KB stripped / 64 headings / 133 tables / 15,549 korean / 19.71s. MarkItDown 62KB / 0 headings / 0 tables / 16,565 korean / 3.16s. **docling이 구조 보존에서 MarkItDown 대비 압도적**. 함정: docling --force-ocr 는 벡터 PDF에서 한국어 0자 (ocrmac 래스터화 열화).
- 실샘플 회귀 (docs/samples/ 4종): docling PDF 8×, unhwp HWPX 2017×, Web Clipper 1건 외부 URL strip. 계획서 표와 일치.
- 검증: 197 → 233 tests PASS (+36). wikey-core tsc + wikey-obsidian esbuild 빌드 0 errors.
- 산출물: plan/phase-4-4-1-agile-crystal.md (계획서), activity/phase-4-result.md §4.1.1, activity/phase-4-converter-benchmark-2026-04-21.md.
- 후속: 추가 코퍼스 벤치마크 (TWHB/OMRON/스캔/HWPX 이미지 포함), ps aux 실측, cache-stats.sh, vault rename/delete listener.
- 해제: §4.5.1.5 variance 재측정 선행 의존 완료 → Docling 구조적 markdown 기준으로 재개 가능.

## [2026-04-21] ui | §4.0 UI 사전작업 — Chat 전담 패널 + /clear + 사이드바 500px + DEFAULT 라벨

- 변경: wikey-obsidian 플러그인 UI 전면 정비. chat을 first-class 패널로 승격 (header 첫 아이콘, 비-chat 패널은 composer 숨기고 `Default AI Model : Provider | model` readonly 라벨), dashboard 아이콘 home→bar-chart, trash 버튼 삭제하고 `/clear` 슬래시 커맨드로 대체, chat 패널 provider/model 모두 편집 가능 (span→select 전환).
- UX: `togglePanel→selectPanel` rename (재클릭 no-op, on/off 아닌 re-select). 재시작/reload 시 `chatHistory=[]` 초기화 (savedChatHistory 복원 블록 제거). 사이드바 초기 폭 500px 1회 자동 적용 (`initialSidebarWidthApplied` 플래그 + `rightSplit.setSize(500)`).
- CSS: `.wikey-readonly-model-bar` 신규, dashboard/help `flex:1 + overflow-y:auto`로 readonly bar 하단 고정, header-btn-active에 `:focus`/`:focus-visible` 변형 (1-click accent 배경 복구), provider-model-bar 드롭다운 `field-sizing:content + flex:0 0 auto + justify-content:flex-start` 좌측 정렬·자연 너비, provider 180px / model 240px min-width.
- 라벨: `(use Default Model)` / `(provider default)` → `DEFAULT` 9개 위치 일괄 통일.
- 검증: `npm run build` 0 errors, `npm test` 197 PASS. CDP 9222 수동 검증 — 사이드바 500px, 버튼 순서, readonly bar 포맷, `/clear`, active 버튼 배경, 드롭다운 폭 180/240 모두 확인.
- 산출물: activity/phase-4-result.md §4.0, plan/phase-4-todo.md §4.0 체크
- 변경 파일: wikey-obsidian/src/{sidebar-chat.ts,main.ts,settings-tab.ts}, wikey-obsidian/styles.css

## [2026-04-21] eval | §4.5.1.4 canonicalizer 2차 확장 (pin/alias 기능 확증, CV 개선 미확증)

- 변경: `canonicalize.ts`에 `SLUG_ALIASES` (음역·약어 통일) + `FORCED_CATEGORIES` (E/C 경계 pin) + `applyForcedCategories` 후처리. 단위 테스트 11건 추가 (197 tests PASS).
- 측정: PMS PDF 5-run × 2회 (prompt 힌트 시도 1 + 후처리만 시도 2). 기능은 5/5 run에서 정상 동작 (mqtt→entity/tool, restful-api→concept/standard, single-sign-on-api 통합).
- 결과: Total CV 5.7% → 32% (악화). 원인: post-processing 밖 LLM extraction volume variance. §4.5.1 baseline 자체가 Gemini sampling의 행운 값 가능성.
- 판정: 코드 유지 (pin 일관성 정량 확증), CV 개선은 별도 원인 분석 후속 과제로 §4.5.1.5 분할.
- 산출물: activity/determinism-pms-v7-4514-{prompt-attempt,}-2026-04-21.md, activity/phase-4-result.md §4.5.1.4
- 후속: §4.5.1.5 — chunk 결정성 + 10+ run baseline + temperature/seed 재검증 + `allimtalk` 오타 추가.

## [2026-04-21] eval | 결정성 측정 자동 스크립트 재검증 (PMS 5-run, 자동)

- 배경: Phase 4 §4.5.1로 scripts/measure-determinism.sh 개편 (selector class-agnostic, snapshot-diff, CDP 응답 경로 수정, 15KB 크기 가드). 자동 스크립트가 수동 드라이브 대체 가능한지 확증.
- 대상: raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf (동일 소스, 수동 v7 post 비교 baseline)
- 방법: `./scripts/measure-determinism.sh -n 5` (audit panel 자동 클릭 + 텍스트 기반 버튼 상태 탐지 + pre/post dir snapshot diff)
- 결과: 5/5 성공, Entities CV 20.1% / Concepts CV 15.7% / Total CV 5.7% / Time 278s
- 수동 대비: Total CV -2.2pp, mean -1.8, Time -13% (동일 분포 범위 재현)
- 판정: 자동 스크립트가 수동 CDP 드라이브 대체. 향후 결정성 회귀 감지 자동화 가능.
- 산출물: activity/determinism-pms-auto-2026-04-21.md, activity/phase-4-result.md §4.5.1
- 후속: §4.5.1.4 canonicalizer 2차 확장 (음역 정규화, E/C 경계 고정) → naming-level CV 추가 감소 목표

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
