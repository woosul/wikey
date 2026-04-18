# Phase 4: 인제스트 고도화 + 지식 그래프 (Graphify 방식 수용)

> 기간: Phase 3 완료 후
> 전제: Phase 3 (Obsidian 플러그인 + 인제스트 파이프라인) 완료
> 참고: Graphify (safishamsi/graphify) 아키텍처 분석 결과

---

## 4-1. 지식 그래프 (NetworkX)

- [ ] entity/concept 간 관계를 그래프로 구축
  - wiki/entities, wiki/concepts의 위키링크를 edge로 변환
  - vis.js 또는 Obsidian Graph View 연동
  - 클러스터링: Leiden 알고리즘 (graspologic) 기반 토픽 그룹핑
- [ ] graph.json 출력 — 영속 그래프 데이터
- [ ] graph.html — 인터랙티브 시각화 (vis.js)
- [ ] GRAPH_REPORT.md — god nodes, 핵심 연결, 추천 질문

## 4-2. 증분 업데이트 (file hash)

- [ ] .ingest-map.json에 file hash (SHA-256) 저장
- [ ] 소스 변경 감지 → 해당 wiki 페이지만 재생성
- [ ] 삭제된 소스 → 의존 wiki 페이지 자동 표시/정리
- [ ] 기존 ingest-map.json 확장 (path → {hash, ingested_at, pages})

## 4-3. Provenance tracking

- [ ] 추출된 관계에 출처 표시
  - EXTRACTED: 소스에서 직접 발견
  - INFERRED: LLM이 추론 (confidence score 포함)
  - AMBIGUOUS: 리뷰 필요 (사용자 확인 대기)
- [ ] 위키 페이지 프론트매터에 `provenance` 필드 추가
- [ ] Audit 패널에서 AMBIGUOUS 항목 리뷰 UI

## 4-4. AST 기반 코드 파싱

- [ ] 코드 파일은 LLM 없이 tree-sitter로 구조 추출
  - 함수/클래스/import 관계 자동 매핑
  - 지원 언어: Python, JS/TS, Go, Rust, C/C++
- [ ] 프로젝트 코드베이스도 위키로 관리 가능
- [ ] 코드 변경 시 AST diff로 영향 범위 자동 감지

## 4-5. 인제스트 프롬프트 시스템

- [ ] 프롬프트 파일 분리 — ingest_prompt_basic.md(시스템) + ingest_prompt_user.md(사용자)
  - 사용자가 설정에서 링크 클릭으로 user 프롬프트 편집
  - Reset 버튼으로 기본값 복원
- [ ] 도메인별 프롬프트 프리셋 (기술문서, 논문, 매뉴얼 등)
- [ ] **추출 기준 명확화** — 모델 간 결과 일관성 확보
  - entity 정의: "고유명사 단위 1개 = 1페이지" (제품명, 기관명, 규격명 등)
  - concept 정의: "핵심 개념 최대 N개" (세부 변형은 본문 내 설명으로)
  - granularity 가이드라인: Qwen3(27E) vs Gemini(46E) 수준의 차이 방지
  - 프롬프트에 예시 entity/concept 목록 포함 (few-shot)
  - 모델별 결과 품질 기준선(baseline) 정의 및 검증 테스트

## 4-6. 운영 안정성

- [ ] 원본/위키 삭제 안전장치 — dry-run 미리보기, 영향 범위 표시
- [ ] 초기화 기능 — 선택적 리셋 (완전/인제스트/원본/인덱스/설정)
- [ ] **bash→TS 완전 포팅** (validate-wiki, check-pii, cost-tracker, reindex) — Phase 3에서 이관, exec 래퍼는 안정 동작 중이라 우선순위 낮음
- [ ] **qmd SDK import** — Phase 3에서 이관. CLI exec → 직접 import로 전환 시 지연 감소 + 에러 처리 개선. 난이도 높음 (현재 vendored CLI 구조)

## 4-7. 로컬 추론 엔진 검토 (llama.cpp PoC)

- [ ] **Ollama vs llama.cpp 실측 gap 측정** — M4 Pro 48GB 환경에서 동일 Qwen3.6:35b-a3b GGUF로 비교
  - Ollama 0.20.5 (MLX 백엔드) vs `brew install llama.cpp` + `llama-server`
  - 동일 chunk·프롬프트로 latency/토큰/메모리 실측
  - 커뮤니티 측정치: 단일 요청 10~30% overhead (Go 런타임 + HTTP 직렬화)
  - wikey는 단일 사용자 + 순차 chunk → 동시요청 3x gap 해당 없음
  - **판정 기준**: 실측 gap ≥15%면 전환, 미만이면 Ollama 유지
- [ ] **전환 시 통합 경로**
  - `llama-server`는 OpenAI-compat API 제공 → `wikey-core/llm-client.ts`에 `llamacpp` provider 추가
  - `llama-swap` (Go proxy)로 모델 auto-load/unload → Ollama 스타일 UX 재현
  - GGUF 파일 직접 관리 (모델 경로 설정 UI 추가)
- [ ] 장점: 속도↑, 세밀한 양자화 제어 (IQ2~BF16, Unsloth Dynamic 2.0), 백그라운드 데몬 불필요
- [ ] 단점: 모델 스와핑 별도 도구 필요, provider 분기 재작성, GGUF 수동 다운로드

## 4-8. 문서 변환 Tiered Pipeline (MarkItDown + markitdown-ocr → Docling/Kreuzberg)

MarkItDown GitHub 이슈 트래커 확인된 주요 문제:
- HTML의 동적 데이터 변환 시 데이터 손실
- PDF 내 이미지 링크 추출 오류
- 복잡한 레이아웃 (멀티컬럼, 테이블) 변환 품질 저하

**현재 상태 (2026-04-18, Phase 3 완료분)**:
- Tier 1: MarkItDown (기본 텍스트 PDF/DOCX 변환)
- Tier 2: pdftotext / mdimport / pymupdf (텍스트 레이어 fallback)
- Tier 3: markitdown-ocr + Ollama gemma4:26b vision (이미지 스캔 PDF용 OCR)
- 위치: `wikey-core/src/ingest-pipeline.ts:extractPdfText` (5단계 chain)

**Phase 4 권장 전략**: MarkItDown 계열을 "1차 변환기(first-pass)"로 활용하고, 변환 품질이 부족한 문서에 대해서는 Docling / Kreuzberg 같은 고정확도 도구로 폴백하는 **tiered pipeline**으로 확장.

- [ ] **변환 품질 감지** — MarkItDown / markitdown-ocr 출력의 신호 기반 품질 스코어 (테이블 깨짐, 이미지 누락, 빈 섹션 비율, OCR 신뢰도)
- [ ] **Docling 통합** (Tier 4 — markitdown + ocr 모두 미흡 시 fallback) — IBM Research 고정확도 파서, 구조 보존 우수
  - `pip install docling` → Python exec 래퍼 추가 (`extractPdfText`의 6번째 fallback 단계)
  - PDF/DOCX/PPTX 레이아웃 분석, 테이블·이미지 OCR (자체 OCR 엔진 내장 — markitdown-ocr와 중복 검토 필요)
  - 처리 시간은 MarkItDown 대비 2~5배 느림 → 품질 필요 시에만 선택적 사용
  - **markitdown-ocr 대비 비교 포인트**: (a) 한국어 OCR 정확도 (b) 테이블 구조 보존 (c) 그림 캡션 추출 (d) 메모리/시간 비용
- [ ] **Kreuzberg 통합** (Tier 4 대안) — 경량·빠른 정확도 파서 (MarkItDown과 Docling 사이 포지션)
  - 이미지 링크 추출 안정, HTML 동적 데이터 보존
- [ ] **파이프라인 분기**:
  - Tier 1 (기본): MarkItDown → 품질 스코어 ≥ 임계값 → 그대로 사용
  - Tier 2-3 (fallback): pdftotext / mdimport / pymupdf / markitdown-ocr (현재 구현)
  - Tier 4 (고품질 fallback): 스코어 미달 or 사용자 지정 → Docling 또는 Kreuzberg 재변환
  - 사용자 오버라이드: Audit 패널에 파일별 변환기 선택 옵션
- [ ] **성능 비교 테스트** — 동일 PDF로 4개 변환기 출력 대조 (markitdown vs markitdown-ocr vs Docling vs Kreuzberg)
  - 평가 코퍼스: TWHB-16_001 파워디바이스 PDF (3.3MB, 텍스트 레이어 있음) + 별도 스캔 PDF 1건 (이미지 only)
  - 메트릭: 챕터/테이블/이미지 보존율, 처리 시간, 메모리 사용량, 한국어 정확도
- [ ] **캐시 전략** — 변환 결과 캐시 (SHA256 기반) → 재인제스트 시 변환 스킵
