# Phase 5: 튜닝·고도화·개선·확장

> 기간: Phase 4 (본체 완성) 완료 후
> 전제: Phase 4 완료 — 원본 → wiki ingest 프로세스가 **wiki 초기화·재생성 없이** 안정적으로 돌아가는 구조 확정. frontmatter/데이터 모델이 고정되어 이후 내용만 축적.
> 범위 정의: 본체가 없어도 wiki 가 돌아가는 것 + 성능·품질·범위 확장 + 진단/계측 도구 + self-extending 구조. **wiki 재생성을 유발하지 않는 것** 만 포함.
> 구성 원칙: 번호·제목·태그는 `activity/phase-5-result.md` 와 1:1 mirror. §5.N 상세 번호 체계 (§5.N.M / §5.N.M.K).
> 이력: 2026-04-22 Phase 재편으로 신규 생성 — 본체 완성 정의 ("구조 변경 없음") 기준으로 Phase 4 에서 이관된 7 subject + §5.6 현재 진행 중 (PMBOK 사전 검증 후 self-extending 로드맵).

## 관련 문서

- **Result mirror**: [`activity/phase-5-result.md`](../activity/phase-5-result.md)
- **보조 문서**: 착수 시 `phase-5-todox-<section>-<topic>.md` · `phase-5-resultx-<section>-<topic>-<date>.md` 형식으로 추가.
- **프로젝트 공통**: [`plan/decisions.md`](./decisions.md) · [`plan/plan_wikey-enterprise-kb.md`](./plan_wikey-enterprise-kb.md).

---

## 5.1 검색 재현율 고도화
> tag: #eval, #engine

> **배경**. 현재 qmd 하이브리드 검색 (BM25 + Qwen3-Embedding + Gemma4 contextual prefix) 는 Phase 2/3 에서 Top-1 60% 수준 확증. 검색 chunk 자체에 문서 맥락을 주입하는 Anthropic contextual retrieval 기법은 재현율 추가 개선 여지가 있으나 인덱스 재빌드 비용이 크므로 본체 완료 후 실험.
>
> **이관 전 위치**: Phase 4 §4.4.1.

### 5.1.1 Anthropic-style contextual chunk 재작성 (v7-3 재검토)

- [ ] chunk 를 재작성해 embedding/BM25 **인덱스에 반영** (retrieval 전처리)
  - Anthropic 의도: 저장된 chunk 자체에 문서 맥락이 주입된 상태로 인덱스 구축
  - 기대 효과: 하이브리드 검색에서 짧은 chunk 의 문맥 손실 감소 → 재현율 개선
  - 참조: https://www.anthropic.com/engineering/contextual-retrieval
- [ ] PoC 범위
  - qmd 인덱스 재빌드 파이프라인에 "contextual rewrite" 스테이지 추가
  - 동일 코퍼스로 baseline vs rewrite 재현율 측정 (MRR, Recall@10)
  - 비용: chunk 수 × 추가 LLM 호출 — 대형 코퍼스에서 부담될 수 있어 로컬 Gemma4 기본
- [ ] 결정 기준: 재현율 개선 ≥ 15% 시 파이프라인에 상설 통합, 미만이면 기각 기록
- [ ] **wiki 재생성 없음 확증**: `~/.cache/qmd/index.sqlite` 만 재빌드, wiki/ 는 읽기 전용 소비

---

## 5.2 지식 그래프 · 시각화
> tag: #main-feature, #utility

> **배경**. 본체 완성 후 wiki 관계 그래프 시각화 · 코드 소스 AST 파싱 등 사용자 대상 부가 가치 기능. Phase 4 §4.4.2/§4.4.3 에서 이관.

### 5.2.1 지식 그래프 (NetworkX)

- [ ] entity/concept 간 관계를 그래프로 구축
  - wiki/entities, wiki/concepts 의 위키링크를 edge 로 변환
  - vis.js 또는 Obsidian Graph View 연동
  - 클러스터링: Leiden 알고리즘 (graspologic) 기반 토픽 그룹핑
- [ ] graph.json 출력 — 영속 그래프 데이터
- [ ] graph.html — 인터랙티브 시각화 (vis.js)
- [ ] GRAPH_REPORT.md — god nodes, 핵심 연결, 추천 질문
- [ ] **wiki 재생성 없음 확증**: wiki/ 읽기 전용, 신규 산출물만 생성

### 5.2.2 AST 기반 코드 파싱

- [ ] 코드 파일은 LLM 없이 tree-sitter 로 구조 추출
  - 함수/클래스/import 관계 자동 매핑
  - 지원 언어: Python, JS/TS, Go, Rust, C/C++
- [ ] 프로젝트 코드베이스도 위키로 관리 가능
- [ ] 코드 변경 시 AST diff 로 영향 범위 자동 감지
- [ ] **wiki 재생성 없음 확증**: 신규 소스 타입 추가 경로, 기존 wiki 무관

---

## 5.3 인제스트 증분 업데이트
> tag: #workflow, #engine

> **배경**. Phase 4 §4.2.2 URI 참조 + source-registry `hash` 필드가 구축된 위에서 hash diff 기반 증분 재인제스트 로직만 추가. Phase 4 §4.3.3 에서 이관. **Provenance 는 본체에 남아 §4.3.2 로 처리됨** (frontmatter data model 변경이라 구조 변경 없음 조건 위반).

### 5.3.1 hash 기반 증분 재인제스트

- [ ] `.wikey/source-registry.json` hash 필드로 소스 변경 감지 → 해당 wiki 페이지만 재생성
- [ ] 삭제된 소스 → 의존 wiki 페이지 자동 "근거 삭제됨" 표시 / 정리
- [ ] 부분 재인제스트 — chunk diff 기반 증분 (chunk hash 매칭)
- [ ] **wiki 재생성 없음 확증**: source-registry 스키마는 Phase 4 §4.2.2 에서 선결정. 본 항목은 로직만 추가, 기존 wiki 는 hash 변경된 소스만 재인제스트로 갱신.

---

## 5.4 Variance 기여도 · Diagnostic
> tag: #eval

> **배경**. §4.5.1.7.2/§4.5.1.7.3 본체 실측 이후 잔여 variance 의 기여 구조 분리 + Ollama production guide + axis 정리 cosmetic. 본체 CV 10% 미만 확보 후 선택적 실행. Phase 4 §4.5.1.7.1/.7.4/.7.6/.7.7 에서 이관.

### 5.4.1 Variance 분해 4-points ablation (←§4.5.1.7.1)

- [ ] point A: all-off (baseline §4.5.1.5 24.3%)
- [ ] point B: determinism-only (`WIKEY_EXTRACTION_DETERMINISM=1`, SLUG_ALIASES/FORCED_CATEGORIES §4.5.1.4 원본 복구)
- [ ] point C: canon-only (alias + pin 최신, determinism=off)
- [ ] point D: all-on (§4.5.1.6 = 9.2%)
- [ ] 산출: A/B/C/D 4 CV 값 + 단일-레버 기여분 (B-A, C-A, D-B 차)
- [ ] 구현 노트: canon off 는 `WIKEY_CANON_V3_DISABLE=1` 같은 env 신규 + canonicalizer.ts 의 v3 entry bypass (v2 유지)

### 5.4.2 Route SEGMENTED 10-run baseline (Ollama) (←§4.5.1.7.4)

- [ ] 전제: Ollama 설치 + qwen3:8b 모델 pull. `WIKEY_BASIC_MODEL=ollama`
- [ ] SEGMENTED Route 강제 (Ollama 32K context → 자동 SEGMENTED)
- [ ] determinism=on 10-run CV 측정
- [ ] 가설: SEGMENTED CV > FULL CV (섹션별 호출 간 variance 누적). production 권장 configuration 결정 근거

### 5.4.3 BOM 축 재분할 판단 (←§4.5.1.7.6)

- [ ] 현재 §4.5.1.6.3: `e-bom`/`engineering-bill-of-materials`/`electronic-bill-of-materials`/`e-bill-of-materials` → `bill-of-materials` 일괄 collapse
- [ ] 실무: eBOM (Engineering, 설계 단계) vs mBOM (Manufacturing, 제조 단계) 은 다른 문서
- [ ] 판단 기준: wiki 가 BOM 을 참조하는 다른 소스 인제스트 시 eBOM/mBOM 을 구별해서 언급하는지 모니터. 월 1 회 lint 에서 확인
- [ ] 재분할 결정 시 canonical 3 개 (`bill-of-materials`, `engineering-bom`, `manufacturing-bom`) + alias 재구성

### 5.4.4 `log_entry` axis 불일치 수정 (cosmetic) (←§4.5.1.7.7)

- [ ] canonicalizer.ts `assembleCanonicalResult` 의 `logEntry: raw.log_entry` 는 LLM 원본. FORCED_CATEGORIES 로 이동된 slug 는 파일 위치 ↔ log 문구 엇갈림
- [ ] 수정: pin 후 `pinned.entities` + `pinned.concepts` 로부터 결정적 log body 재생성. 기존 wiki-ops.ts `appendLog` 패턴 참조
- [ ] TDD: pin 으로 axis 가 바뀐 slug 의 log 엔트리가 "엔티티 생성" → "개념 생성" 으로 올바르게 전환

---

## 5.5 성능 · 엔진 확장
> tag: #infra, #engine

> **배경**. 로컬 추론 엔진 교체 PoC + 플랫폼 OCR fallback 실측. Phase 4 §4.5.3/§4.5.4 에서 이관.

### 5.5.1 llama.cpp PoC (←§4.5.3)

- [ ] **Ollama vs llama.cpp 실측 gap 측정** — M4 Pro 48GB 환경에서 동일 Qwen3.6:35b-a3b GGUF 로 비교
  - Ollama 0.20.5 (MLX 백엔드) vs `brew install llama.cpp` + `llama-server`
  - 동일 chunk · 프롬프트로 latency/토큰/메모리 실측
  - 커뮤니티 측정치: 단일 요청 10~30% overhead (Go 런타임 + HTTP 직렬화)
  - wikey 는 단일 사용자 + 순차 chunk → 동시요청 3x gap 해당 없음
  - **판정 기준**: 실측 gap ≥15% 면 전환, 미만이면 Ollama 유지
- [ ] **전환 시 통합 경로**
  - `llama-server` 는 OpenAI-compat API 제공 → `wikey-core/llm-client.ts` 에 `llamacpp` provider 추가
  - `llama-swap` (Go proxy) 로 모델 auto-load/unload → Ollama 스타일 UX 재현
  - GGUF 파일 직접 관리 (모델 경로 설정 UI 추가)
- [ ] 장점: 속도↑, 세밀한 양자화 제어 (IQ2~BF16, Unsloth Dynamic 2.0), 백그라운드 데몬 불필요
- [ ] 단점: 모델 스와핑 별도 도구 필요, provider 분기 재작성, GGUF 수동 다운로드

### 5.5.2 rapidocr (paddleOCR PP-OCRv5 Korean) fallback 실측 — Linux/Windows 환경 (←§4.5.4)

> **배경**. Phase 4 §4.1.3 에서 `defaultOcrEngine()` + `defaultOcrLangForEngine()` 로 platform 별 engine/lang 자동 매핑 등록 완료. macOS → ocrmac + `ko-KR,en-US`, Linux/Windows → rapidocr + `korean,english`. 코드 레벨은 등록됐으나 **macOS 세션에서 rapidocr 실제 OCR 품질 검증 불가**. Linux 환경에서 실측 필요.

- [ ] **§5.5.2.1** Linux 환경 준비
  - `uv tool install "docling[rapidocr]"` — rapidocr-onnxruntime extras 포함 설치
  - 테스트 환경: Ubuntu 22.04 또는 Docker (wikey-core 실행)
  - 기본 rapidocr 모델: Chinese + English (paddleOCR 기본 탑재). Korean 은 별도 모델 로드 필요할 가능성

- [ ] **§5.5.2.2** rapidocr + `korean,english` CLI 실측
  - 명령: `docling <test.pdf> --to md --output /tmp --ocr-engine rapidocr --ocr-lang korean,english --force-ocr`
  - 테스트 코퍼스: CONTRACT (용역계약서, 한글 OCR 난도 높음), GOODSTREAM (사업자등록증)
  - 검증: rapidocr 가 `korean` lang 지정을 실제로 받아들이는지. 안 받으면 `--ocr-engine easyocr --ocr-lang ko,en` 대안 검토

- [ ] **§5.5.2.3** PP-OCRv5 Korean 모델 수동 로드 (skill 권고 경로)
  - docling skill 문서 `~/.claude/skills/docling/reference/korean-ocr-advanced.md` 의 PaddleOCR PP-OCRv5 Korean 전환 가이드
  - CLI 로는 불가 — Python API (`RapidOcrOptions(rec_model_path=...)`) 경로
  - Korean 가중치 다운로드 (`huggingface_hub: PaddlePaddle/korean_PP-OCRv5_mobile_rec`)
  - `scripts/benchmark-tier-4-1-3.mjs` 를 Python 호출 방식으로 확장하거나 별도 `scripts/ocr-python-api.py` 헬퍼 추가

- [ ] **§5.5.2.4** macOS ocrmac vs Linux rapidocr 품질 비교 (CONTRACT·GOODSTREAM)
  - 동일 PDF 에 대해 두 engine 결과 비교: 한글 자수, OCR 오류 건수, 본문 구조 정확도
  - ocrmac 대비 rapidocr 품질이 충분 (80%+) 하면 production fallback 으로 등록
  - 부족하면 Linux 환경에서는 `markitdown[pdf]` + OpenAI Vision fallback (tier 2/3) 경로 고려

- [ ] **§5.5.2.5** 결과 기록 + fallback 매트릭스 문서화
  - `activity/phase-5-5-2-rapidocr-linux-<date>.md` 신규
  - `~/.claude/skills/docling/reference/korean-ocr-advanced.md` 에 실측 갱신 (커뮤니티 consensus 와 일치 여부)

---

## 5.6 표준 분해 규칙 self-extending 구조 (현재 진행 중)
> tag: #framework, #engine, #architecture

> **현재 위치**. 2026-04-22 Phase 4 §4.5.1.7.2 (PMBOK 10 knowledge areas 프롬프트 하드코딩) 구현 완료, CDP 실측 대기 — 이 사전 검증이 본 §5.6 의 Stage 0 에 해당. 실측에서 Concepts CV 24.6% → <15% 확증되면 Stage 1 (schema.yaml 외부화) 진입.
>
> **배경**. PMBOK 을 canonicalizer 프롬프트에 단발 하드코딩했다. ISO 27001 controls / ITIL 4 practices / GDPR 7 원칙 / SAFe configurations / OWASP Top 10 / OSI 7 Layer / 12 Factor App 등 구조적으로 동일한 "표준 = N 하위 영역" 패턴이 연속 등장할 것이 확정되어 있는 만큼, 매번 prompt 블록을 늘리는 건 유지 불가. **사용자 수동 등록도 궁극의 답이 아니며**, wiki 가 축적될수록 wikey 자체가 표준 분해 구조를 **스스로 학습·확장** 하는 구조로 이행해야 한다.
>
> **wiki 재생성 없음 확증**: 모든 Stage 는 신규 인제스트 경로에만 영향. 기존 wiki 에 PMBOK 으로 이미 생성된 페이지들은 Stage 1 외부화 시점에도 보존되며, yaml 로더가 prompt 를 동적 생성하는 방식으로 전환되어도 기존 데이터는 건드리지 않는다.
>
> **4 단계 로드맵** — 각 단계가 다음 단계의 infra 이며, 앞 단계의 오용 가능성이 측정되어야 다음 단계 착수. 전량 구현 강제 아님.
>
> **공통 데이터 타입 스케치** (미구현):
> ```ts
> // wikey-core/src/types.ts — SchemaOverride 확장 후보
> interface StandardDecomposition {
>   name: string                      // "PMBOK", "ISO-27001"
>   aliases: string[]                 // ["Project Management Body of Knowledge", "프로젝트 관리 지식체계"]
>   umbrella_slug: string             // "project-management-body-of-knowledge"
>   components: Array<{ slug: string; type: ConceptType | EntityType }>
>   rule: 'decompose' | 'bundle'      // decompose = 하위 영역 개별 추출, bundle = 상위 1 개로 묶음
>   require_explicit_mention: boolean // true = hallucination guard (본문 미등장 시 추출 금지)
>   confidence?: number               // Stage 2+ 에서 채워짐 (자동 학습 결과일 때)
>   origin?: 'hardcoded' | 'user-yaml' | 'suggested' | 'self-declared' | 'converged'
> }
> ```

**§5.6 gate**: Phase 4 §4.5.1.7.2 PMS 5-run 실측 (Concepts CV 24.6% → <15%) 에서 효과 확증. 미달 시 Stage 1 진입 전에 A안 재설계 또는 B안 보강 (9 slug FORCED_CATEGORIES pin).

### 5.6.1 Stage 1 — static `.wikey/schema.yaml` override (가까운 후속, 두 번째 표준 등장 시 즉시 착수)

- [ ] `SchemaOverride.standard_decompositions: StandardDecomposition[]` 필드 추가 (`schema-override.test.ts` 확장)
- [ ] `canonicalizer.ts` 에 `buildStandardDecompositionBlock(override)` 로더 함수 신규 — 현재 하드코딩된 작업 규칙 #7 블록을 동적 생성
- [ ] PMBOK 하드코딩 **제거**, default vault 템플릿 `.wikey/schema.yaml` 에 `PMBOK` entry 포함 (사용자 vault 가 override 안 해도 동작 유지)
- [ ] 단위 테스트: override 에 ISO-27001 entry 주입 → 프롬프트에 93 controls 블록이 동적으로 포함
- [ ] 트리거: 두 번째 표준 corpus (ISO/ITIL 등) 가 wiki 에 인제스트될 때

### 5.6.2 Stage 2 — extraction graph 기반 suggestion (Stage 1 완료 후, 중기)

- [ ] 전제: Stage 1 이 안정 동작. 수동 등록이 번거로운 수준으로 표준 수 누적 (≥5 개)
- [ ] canonicalizer 가 인제스트 결과의 mention graph 위에 패턴 탐지:
  - co-occurrence: 동일 소스에서 N 개 mention 이 같은 상위 concept (`*-management`, `*-control`, `*-principle`) 의 sibling 으로 등장
  - suffix clustering: `-management`, `-domain`, `-practice`, `-control`, `-principle` 등 suffix 빈도 + 같은 표준명 co-mention
  - confidence score: support count × suffix homogeneity × mention count 에서 임계 이상
- [ ] Audit UI 에 suggestion 카드 — "PMBOK 패턴 감지: 9 candidate components. 표준 분해로 등록하시겠습니까?" (accept/reject/edit)
- [ ] 승인 시 `.wikey/schema.yaml` append (`origin: 'suggested'`, `confidence: <score>`)
- [ ] 리스크: false positive — marketing 카피에 나열된 feature 리스트가 오인될 수 있음. 임계값 튜닝 + 사용자 승인 필수

### 5.6.3 Stage 3 — in-source self-declaration (장기, Stage 2 정확도 증명 후)

- [ ] 전제: Stage 2 suggestion 의 accept rate ≥ 80% — 즉 패턴 탐지가 신뢰할 수준
- [ ] 소스 본문이 "이 표준은 다음 N 영역을 갖습니다: A, B, C..." 같이 enumerate 하면 `section-index.ts` 가 "표준 개요" 섹션을 감지 → structured decomposition extraction
- [ ] runtime-scope decomposition: 해당 소스 인제스트 세션에만 적용, 세션 종료 시 자동 persist 제안 or 폐기
- [ ] 장점: 사용자·Stage 2 suggestion 개입 없이 문서 하나로 확장
- [ ] 리스크: 문서가 marketing 용이거나 부정확하면 오염 전파 — Phase 4 §4.3.2 provenance tracking 과 직접 연계 필수

### 5.6.4 Stage 4 — cross-source convergence (Phase 5 내 최후 단계, 실험적)

- [ ] 여러 소스가 같은 표준을 다른 각도에서 언급 → wiki 전체 mention graph 를 배치 분석해 canonical decomposition 을 inference
- [ ] 예: 소스 A 는 PMBOK 3 영역, 소스 B 는 다른 5 영역, 소스 C 는 umbrella 만 → union 으로 canonical decomposition 확증
- [ ] 구현 경로: qmd vector index + clustering + LLM arbitration. `reindex.sh` batch job 에 convergence pass 훅 추가
- [ ] 데이터 선결 조건: Stage 3 까지의 decomposition 인스턴스가 cross-validation 가능할 만큼 누적 (최소 3 개 표준 × 2 소스 이상). 선결 미충족 시 §5.6.4 는 대기 상태로 남고 Phase 5 종료 시 §5.6.1~3 까지만 closed
- [ ] **Phase 6 이관 없음** — Phase 6 은 웹 인터페이스 스코프. self-extension 모든 단계는 Phase 5 안에서 완결

**연계**:
- Phase 4 §4.3.2 Provenance tracking (본체) — Stage 3 의 self-declaration 오염 제어 장치로 직접 필요.
- Phase 4 §4.2.2 URI 기반 안정 참조 (본체) — Stage 4 convergence 가 여러 소스의 canonical 참조를 필요로 함.
- `wiki/analyses/self-extending-wiki.md` — 이 §5.6 의 철학을 wiki 본체에 정식 analysis 로 기록한 페이지. 본체 진실이며, 본 todo 는 실행 단위 분해.

**기록 책임** (drift 방지):
- 본 §5.6 가 실행 로드맵 단일 소스.
- 철학/가치 선언의 단일 소스: `wiki/analyses/self-extending-wiki.md`.
- 포인터만 두는 위치: `wikey-core/src/canonicalizer.ts` 작업 규칙 #7 위 주석, `activity/phase-4-result.md §4.5.1.7.2` "일반화 경로" 단락, `plan/session-wrap-followups.md`, `memory/project_phase4_status.md` / `memory/project_phase5_status.md` (생성 시).

---

## 5.7 운영 인프라 포팅
> tag: #utility, #infra

> **배경**. Phase 3 에서 이관된 우선순위 낮은 리팩토링 항목. 동작 유지하면서 구현만 개선. Phase 4 §4.5.2 에서 이관 (삭제 안전장치 + 초기화는 본체 남김).

### 5.7.1 bash→TS 완전 포팅

- [ ] `validate-wiki`, `check-pii`, `cost-tracker`, `reindex` 를 TypeScript 구현으로 포팅
- [ ] 현재 exec 래퍼로 안정 동작 중 → 우선순위 낮음
- [ ] 이점: 크로스 플랫폼, 타입 안전성, 테스트 용이성
- [ ] **wiki 재생성 없음 확증**: 동작 동일성 유지, 실행 경로만 교체

### 5.7.2 qmd SDK import

- [ ] CLI exec → 직접 import 로 전환 시 지연 감소 + 에러 처리 개선
- [ ] 현재 vendored CLI 구조라 난이도 높음
- [ ] 후속 전환 경로: qmd JS/TS 바인딩 확보 또는 RPC 게이트웨이
- [ ] **wiki 재생성 없음 확증**: 인덱스 소비 방식만 변경, 데이터 그대로
