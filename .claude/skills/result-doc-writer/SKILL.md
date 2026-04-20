---
name: result-doc-writer
description: Write or update phase/session result documents (activity/phase-*-result.md) and their todo mirrors (plan/phase-*-todo.md) in wikey's canonical structure. Use whenever the user asks to record a work result, add session findings, reorganize a result doc, regroup sections by subject, renumber headings to N/N.M, tag subjects with #category, or keep todo/result in sync. Triggers: "결과 기록", "activity 문서", "세션 정리", "phase result", "주제별로 묶어", "번호 체계 정리", "태그 추가", "result 문서 작성".
---

# Result Doc Writer — `activity/phase-N-result.md` 작성 규칙

wikey 프로젝트에서 작업 결과를 `activity/phase-N-result.md`에 기록하거나 재구성할 때 따를 원칙. 이 규칙은 사용자가 2026-04-20에 영구 고정한 것이며, CLAUDE.md 대신 이 스킬에서 관리한다.

## 핵심 원칙 (3+1)

### 1. Subject에 의한 그룹화

최상위 섹션(`## N. 주제`)은 **작업 주제(기능·영역·범위) 단위**다. 시간이나 세션이 아니라 특성으로 묶는다.

예 — Phase 3 result에서 사용된 subject:
- `wikey-core 코어 구현`
- `Obsidian 플러그인 MVP`
- `UI/UX 고도화`
- `인제스트 파이프라인 v1~v6 + 3-stage 재설계`
- `스키마 안정화 + 결정성 측정 (v7 시리즈)`
- `문서 전처리 (PDF · OCR tier chain)`
- `프롬프트 시스템 (single prompt + override)`
- `로컬 LLM 모델 검증`
- `디버깅 · 운영 안정성`
- `E2E 자동 검증 + CDP`

피해야 할 패턴 — **세션/날짜 기반 subject**:
- ❌ `2026-04-19 저녁 세션`, `§C-2 정리 세션`, `Step 5 인제스트`
- 이런 건 subject가 아니라 subject 내부의 timeline entry 레이블로 쓴다.

### 2. 상세 타임라인에 의한 상세 기록

각 subject 내부(`### N.M`)는 진행 시간 순으로 기록하고, 각 항목은 **"이전 상태 → 작업 내용 → 결과"**를 자세히 담는다.

필수 구체 증거:
- 수치 (CV %, 처리 시간, 토큰 수, 파일 크기)
- 커밋 해시 (7자리 short hash)
- 파일 경로 (`wikey-core/src/schema.ts:42`)
- 모듈·함수명 (`loadSchemaOverride`, `extractPdfText`)
- 에러 메시지 (원문 혹은 핵심 키워드)

**요약하지 말고 보존한다.** Result 문서의 가치는 "그 당시 무엇이 일어났는지"를 나중에 추적할 수 있게 하는 데 있다. 긴 설명이 정리 대상 1순위가 아니다.

### 3. 다른 주제 진행 중 이전 주제 관련 내용이 나오면 그 이전 subject의 타임라인 하단에 append

새 subject를 만들지 않는다.

예: 04-19 UI 재설계 세션에서 04-18 프롬프트 이슈의 후속 수정이 나오면 → **"프롬프트 시스템" subject의 타임라인 말미**에 `(2026-04-19 추가)` 라벨로 덧붙인다.

### 4. (파생) Todo와 Result의 관계

`plan/phase-N-todo.md`는 result의 subject 구조를 **1:1 미러하는 체크리스트**다.

- Subject 구성이 바뀌면 **result 먼저 고치고, todo가 그 구조를 따라간다**.
- Todo는 간결 (한 줄 체크박스), result는 상세.
- 대분류 #tag도 todo에 동일하게 반영한다.

## 번호 체계 (필수)

- `N. / N.M / N.M.K` 3-레벨 순수 숫자만 사용.
- **이질 prefix 금지**: `Step N`, `Phase X-Y-Z`, `§A-N`, `(Must)`, `[v7-3]` 등을 섹션 헤더에 섞지 않는다.
- 본문 텍스트에서 커밋 컨벤션·히스토리 참조 용도로는 `v7-5`, `§C-2` 같은 히스토리 레퍼런스 표기를 그대로 사용해도 된다 — heading이 아니라 본문 참조로.

## 대분류 #tag (시스템 구성요소 관점)

각 subject(`## N.` 최상위 섹션) 제목 끝에 **다중 `#tag`**로 대분류를 부착한다. 같은 subject가 여러 구성요소에 걸치면 복수로 붙인다.

예:
```markdown
## 4. UI/UX 고도화 #design #workflow
## 7. 문서 전처리 (PDF · OCR tier chain) #core #workflow
## 9. 로컬 LLM 모델 검증 #eval #infra
```

### 허용 대분류 (필요시 확장)

| tag | 의미 |
|-----|------|
| `#architecture` | 시스템 구조, 계층, 디자인 결정 |
| `#framework` | 공통 기반 (schema, config, 타입·프로토콜) |
| `#core` / `#engine` | 핵심 로직 (LLM, canonicalizer, wiki-ops, query pipeline) |
| `#workflow` | 작업 흐름 (인제스트·쿼리·린트·분류·E2E) |
| `#main-feature` | 사용자에게 노출되는 주요 기능 단위 |
| `#design` | UI/UX, 시각·컴포넌트·테마 |
| `#utility` / `#helper` | 보조 도구, 스크립트, CLI 래퍼 |
| `#infra` | 배포·설정·CI·의존성 |
| `#ops` | 운영·디버깅·안정성·비용 추적 |
| `#eval` | 측정·벤치마크·결정성·성능 |
| `#docs` | 문서·스키마 변경·가이드 |

새 태그가 필요한데 목록에 없으면 이 목록에 먼저 추가한 뒤 사용한다.

## 자동화 툴

`result + todo`를 주제별로 재구성해야 할 때 참고할 수 있는 기존 아티팩트:

- 이번 Phase 1/2/3 재구성에 사용된 Python 스크립트 패턴 — 섹션 atom 추출 → theme classify → 새 번호 부여.
- 본 스킬은 규칙만 정의하며, 자동화가 필요하면 Python·Bash로 생성·반복 실행 가능.

## 문서 레이아웃 체크리스트

새 result 파일을 작성할 때:

1. 최상단 meta 블록 (기간, 상태, 전제, 인프라, 참조 파일)
2. `---` 구분선
3. 첫 subject는 보통 `## 1. 개요 및 타임라인 #docs #architecture`
4. 이후 subject들 (`## 2.` ~ `## N.`)은 위 원칙에 따라 주제별
5. 마지막 subject는 "Phase X 완료 체크리스트" 또는 "다음 Phase 준비 상태" 또는 "Phase N+1 이관 + 종료 선언" 중 해당 상황에 맞게

## 대응되는 todo 파일 체크리스트

`plan/phase-N-todo.md`:

1. meta 블록 (result와 동일하되 "번호 계층·mirror" 안내 포함)
2. `---`
3. `## N. 제목 #tag1 #tag2` — result와 동일한 번호·제목·태그
4. 하위 `- [x] N.M 한 줄 요약`으로 체크박스 리스트
5. 완료 안 된 항목은 `- [ ]` 또는 `- [~]`(진행 중)로 구분

## Anti-patterns (하지 말 것)

- ❌ result를 축약·요약한다 — **내용 보존이 최상위 가치**
- ❌ subject를 세션/날짜 이름으로 만든다
- ❌ `Step 1-2-A`, `§B-2 #4` 같은 prefix를 heading에 남긴다
- ❌ 같은 번호(`## 3`)를 두 번 쓴다 (시간순 추가의 부작용)
- ❌ CLAUDE.md 또는 글로벌 메모리에 이 규칙을 중복 기록 — 이 스킬이 단일 소스
