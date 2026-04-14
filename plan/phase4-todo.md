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
- [ ] bash→TS 완전 포팅 (validate-wiki, check-pii, cost-tracker, reindex)
- [ ] qmd SDK import (선택)
