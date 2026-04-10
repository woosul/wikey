# 설계 결정 기록 (Architecture Decision Records)

> 프로젝트: Wikey — LLM Wiki 기반 지식저장소
> 최초 작성: 2026-04-10

---

## ADR-001: Phase 1 접근법 → Obsidian 중심

- **상태**: 확정 (2026-04-10)
- **결정**: Obsidian + CLI를 중심으로 개인 위키 운영. 커스텀 도구는 필요 시 구축.
- **맥락**: CEO 리뷰(Obsidian 중심), Codex 리뷰(도메인 모델 먼저) 의견 분기
- **선택 이유**:
  - Karpathy 원문 철학: "Obsidian is the IDE; the LLM is the programmer; the wiki is the codebase"
  - 도구는 "as the need arises" — 사전 구축이 아닌 필요 발생 시 구축
  - 검증 전 엔지니어링 투자 최소화
- **기각된 대안**: 도메인 모델 먼저 구현 (Codex) — Phase 3 전환 비용 절감 장점이 있으나, 개인 사용 검증이 우선
- **수용한 위험**: Phase 1→3 전환 시 Obsidian 의존 코드 재작성 비용
- **완화 조치**: Phase 2에서 WikiStore 추상화 인터페이스 문서 정의

---

## ADR-002: 제품 범위 → 개인 도구(검증) / 기업 제품(별도 결정)

- **상태**: 확정 (2026-04-10)
- **결정**: Phase 1-2는 개인 도구로 독립 검증. Phase 3-4 진행은 3개월 사용 데이터 기반 별도 의사결정.
- **맥락**: CEO 리뷰(2개 분리), Codex 리뷰(지금 결정) 의견 분기
- **선택 이유**:
  - 원문: "intentionally abstract... optional and modular... instantiate a version that fits your needs"
  - 개인 사용으로 패턴 체화 후 기업 적용 판단이 원문 접근법
  - 고객 검증 없이 기업 아키텍처 투자는 시기상조 (CEO + Codex 합의)
- **기각된 대안**: 지금 1개로 결정 (Codex) — 저장소 모델 분기를 빨리 잡을 수 있으나, PMF 이전 과잉 투자 위험
- **게이트 조건**:
  - LLM 위키 일관성 유지 여부 (lint 결과 추이)
  - 월별 토큰 비용 지속 가능성
  - 팀 공유 수요 존재 여부 (2-3명 파일럿)
  - 패턴 체화 여부 (일상적 사용 빈도)

---

## ADR-003: 데이터 모델 → 마크다운 파일 + 추상화 인터페이스

- **상태**: 확정 (2026-04-10)
- **결정**: Phase 1-2는 마크다운 파일 직접 사용. WikiStore 인터페이스를 Phase 2에서 문서 정의, Phase 3에서 구현.
- **맥락**: CEO+Eng(마크다운+추상화), Codex(구조화 저장소 우선) 의견 분기
- **선택 이유**:
  - 원문: "The wiki — a directory of LLM-generated markdown files"
  - "a git repo of markdown files... version history, branching, and collaboration for free"
  - "index.md... works surprisingly well at moderate scale... avoids the need for embedding-based RAG infrastructure"
  - 구조화 저장소를 먼저 만드는 것은 원문이 피하라고 한 사전 인프라 최적화
- **기각된 대안**: SQLite/JSON 우선 (Codex) — 기업 확장 시 필수이나, Phase 1-2에서는 복잡도만 추가
- **전환 전략**:
  - Phase 2: WikiStore 인터페이스 문서 정의 (read/write/list/search/validate/getBacklinks)
  - Phase 3: FileSystemWikiStore 구현 → 향후 DatabaseWikiStore 전환 가능

---

## ADR-004: RAG 포지셔닝 → "대체"가 아닌 "합성 레이어"

- **상태**: 확정 (2026-04-10)
- **결정**: RAG "대체제"가 아닌, RAG 앞단의 **지식 합성 레이어**로 포지셔닝.
- **맥락**: Codex 리뷰에서 "계획 자체가 Phase 4에서 RAG 하이브리드를 도입하므로 '대체'는 모순" 지적
- **선택 이유**:
  - 위키는 컴파일된 핵심 지식 (핸드북, 스펙, ADR) 응답에 최적
  - 롱테일/히스토리는 RAG가 필요 (과거 티켓, 아카이브, 규정 문서)
  - 두 접근은 상호 보완적이며, 규모에 따라 혼용

---

## 리뷰 프로세스 기록

### 2026-04-10 자동 리뷰 [4] 실행

**참여자**:
- Claude (CEO 리뷰): 범위/비전/전제 검토
- Claude (Eng 리뷰): 아키텍처/엣지케이스/테스트/성능/보안
- Codex (독립 검토): 전제, 아키텍처, 타임라인, 한국어 시장, 기업 적합성, 핵심 리스크

**합의 항목 (10개)**: 자동 반영 완료
1. 위키 일관성 검증 Phase 1 게이트 격상
2. Phase 3을 3개 서브페이즈로 분할 (4+4+2주)
3. Phase 4를 단일 테넌트 파일럿으로 축소
4. PII 대응 Phase 1로 앞당김
5. 한국어 검색 벤치마크 50-100개로 강화
6. 대용량 소스 청킹 전략 추가
7. 인제스트 멱등성 보장
8. 증분 린트 도입
9. RAG "대체" → "하이브리드" 포지셔닝 변경
10. LLM 비용 추적 Phase 1부터

**Taste 결정 (3건)**: llm-wiki.md 원문 철학 기반으로 전부 [A] 선택
- Taste 1: Obsidian 중심 [A] — "Obsidian is the IDE"
- Taste 2: 2개 분리 [A] — "optional and modular"
- Taste 3: 마크다운 + 추상화 [A] — "just a git repo of markdown files"

---

## ADR-005: BYOAI — 프로바이더 독립 설계 (신규)

- **상태**: 확정 (2026-04-10)
- **결정**: wikey.schema.md를 마스터 스키마로, 프로바이더별 파일(CLAUDE.md, AGENTS.md 등)은 스키마 참조 + 도구 특화 지시만 포함
- **맥락**: 사용자 요청 — Claude Code, Gemini, Codex, Gemma 4(로컬) 모두 지원 필요
- **프로바이더별 역할 분담**:
  - Claude Code: 메인 인제스트/쿼리/린트 (최고 품질)
  - Codex: 독립 2차 리뷰, 교차 검증
  - Gemini: 대용량 소스 1차 요약 (1M+ 컨텍스트)
  - Gemma 4 (로컬): 쿼리 확장, 리랭킹, 오프라인 쿼리 (무료)
- **검증 계획**: Phase 1에서 Claude Code + Codex 교대 인제스트로 BYOAI 일관성 검증

---

## ADR-006: 차별화 전략 — Zero-Setup + BYOAI + 한국어 기업 특화 (신규)

- **상태**: 확정 (2026-04-10)
- **결정**: llmbase/seCall/qmd 대비 3가지 차별점으로 포지셔닝
- **맥락**: 기존 프로젝트 대비 기능적 차별점이 약하다는 분석 결과
- **차별점**:
  1. Zero-setup: Obsidian 스킬 설치 + 스키마 복사 = 끝 (llmbase는 앱 설치 필요)
  2. BYOAI: 4개 LLM 프로바이더 동시 지원 (llmbase는 OpenAI 종속적)
  3. 한국어 기업 기술 KB: 한영 혼합 용어 정규화 + 한국 기업 도구 연동 (시장에 없음)
- **검증**: Phase 2에서 GitHub 공개 + 커뮤니티 반응으로 판단

---

## ADR-007: LLM 다층 검색 — DB 위임이 아닌 LLM 참여형 (신규)

- **상태**: 확정 (2026-04-10)
- **결정**: 검색을 DB에 위임하면 다시 RAG가 됨. LLM이 검색의 양쪽 끝(쿼리 확장 + 리랭킹)에 참여하는 구조 채택
- **맥락**: index.md 전체 읽기는 기업 규모에서 비용 폭발. 그러나 DB 위임은 LLM Wiki의 지능적 합성 장점을 상실
- **해법**: 로컬 LLM(Gemma 4)이 쿼리 확장/리랭킹 담당 (무료), 클라우드 LLM이 최종 합성 담당 (고품질)
- **참조**: qmd 4단계 파이프라인 (LLM 확장 → BM25+벡터 → RRF → LLM 리랭킹)
