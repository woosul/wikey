# 다음 세션 후속 작업

> 최신 갱신: 2026-04-19 저녁 (v6 인제스트 코어 재설계 + UI 9건 + audit auto-move PARA)
> 생성일: 2026-04-10

---

## 2026-04-19 저녁 (v6 = 3-Stage Pipeline + Schema-Guided + UI 폴리싱) 마감

### ⭐ 다음 세션 시작점

**현재 상태**: v6 final commit 완료. PMS 인제스트 결과 wiki에 작성 (concepts 44, entities 46, sources 10). PMS 원본 PDF는 `raw/3_resources/30_manual/`로 자동 이동 (audit auto-move).

**바로 시작 가능한 작업**:

1. **🔴 다른 inbox 파일 인제스트 검증** (highest)
   - `raw/0_inbox/`에 OMRON_HEM-7156T-AP_*.pdf (49.6MB), OMRON_HEM-7600T.pdf 남음
   - audit panel auto-move로 PARA 라우팅 검증
   - 큰 PDF의 markitdown-ocr fallback E2E 동시 테스트

2. **🟡 v6 결정성 추가 측정 (옵션)**
   - 현재 5회 std dev: Total CV 16.9%, Concepts CV 33.4%
   - 다른 입력(사업자등록증 등)에서도 결정성 일관성 확인
   - schema에 `methodology` vs `document_type` 경계 명확화로 Concepts CV 감소 시도

3. **🟡 Lint 세션 — wiki 정리**
   - PMS 인제스트로 작성된 페이지들의 중복/품질 검토
   - log.md `, ,` cosmetic 잔존(이전 인제스트 시점) 정리
   - validate-wiki.sh 실행

### 잔여 (이전 세션부터 누적, 우선순위 재정렬)

- **🟢 [v7-1]** schema에 `methodology` vs `document_type` 경계 명확화 (concept CV 감소)
- **🟢 [v7-2]** anti-pattern에 운영 항목 추가 발굴 (인제스트 누적 중 발견 시)
- **🟢 [v7-3]** Anthropic-style contextual chunk 재작성 (검색 재현율 개선, 인제스트와 별개)
- **🟢 [v7-4]** 5회 std dev 자동 측정 → activity 로그 (회귀 감지 자동화)
- **🟢 [v7-5]** schema yaml 사용자 override (`.wikey/schema.yaml`) — Phase D는 표시만, 편집 미구현
- **🟢 [v7-6]** Pro 모델(`gemini-3.1-pro-preview`)을 옵션으로 노출 (Concept 보수적 분류 원할 때)
- **🟡 [B-2 #4]** markitdown-ocr fallback E2E (OMRON 스캔 PDF) — 다음 세션 #1과 통합 가능
- **🟡 [B-2 #5]** `.wikey/ingest_prompt_user.md` override E2E
- **🟡 [B-2 #6]** wiki/ 폴더 인제스트 가드 도입 결정

### 이번 세션 완료 (v6 = Phase A + B + C + D + UI 9건 + audit auto-move)

**인제스트 코어 재설계**:
- `wikey-core/src/schema.ts` 신규: 4 entity (organization·person·product·tool) + 3 concept (standard·methodology·document_type) + anti-pattern detector (한국어/UI/business/op/list/report/form)
- `wikey-core/src/canonicalizer.ts` 신규: 단일 LLM 호출, schema-guided, cross-pool dedup, 약어/풀네임 자동 통합, 기존 페이지 재사용
- `wikey-core/src/ingest-pipeline.ts`: 3-stage (summary + extractMentions + canonicalize)
- `wikey-core/src/wiki-ops.ts`: writtenPages 기반 결정적 index/log backfill, stripBrokenWikilinks (LLM 누락/dropped 항목 자동 정리), normalizeBase + extractFirstSentence helper 추가
- `wikey-core/src/types.ts`: WikiPage entityType/conceptType, Mention, CanonicalizedResult 타입 추가, LLMCallOptions.seed (v7 옵션)
- `wikey-core/src/llm-client.ts`: Gemini generationConfig.seed 전달 지원

**UI 9건**:
1. Modal close 차단 (backdrop + ESC) + Processing 단계 [X] confirm 다이얼로그
2. Modal resize 핸들 11×11 @ 315deg + 코너 안착 (modalEl 직접 부착)
3. Modal 하단 button-row sticky (콘텐츠 길이 무관 항상 하단)
4. Audit panel [Ingest][Delay] 우측 정렬 + provider/model 하단 고정
5. Ingest panel bottom bar 고정 (audit과 동일, gap 10px) — `.wikey-ingest-progress:empty {display:none}`로 빈 progress 영역 차지 제거
6. Brief 모달 schema preview 라인
7. NFC/NFD 한글 검색 fix (audit 패널)
8. Plugin 아이콘 search → book → book-open
9. styles.css resize handle 1.5배(7→11px) + 방향 cw-180

**audit panel auto-move PARA**:
- `wikey-obsidian/src/commands.ts`의 runIngestCore에 `autoMoveFromInbox?: boolean` 옵션 추가
- audit applyBtn은 true 전달 → ingest 후 raw/0_inbox/ 파일을 classifyFileAsync (CLASSIFY.md + LLM fallback)로 PARA 자동 라우팅
- moveFile + updateIngestMapPath 자동 호출
- inbox panel 'auto'는 기존 동작 유지 (plan phase classify + moveBtn explicit move)

**기타**:
- v6.1 실험 (temperature=0 + seed=42) → CV 악화 → 롤백
- pro 모델 (gemini-3.1-pro-preview) 1회 시험 → Concept 매우 보수적 (7개)
- PMS 원본 PDF를 `raw/0_inbox/` → `raw/3_resources/30_manual/`로 수동 이동 + ingest-map 키 갱신 + 백링크 점검 (모두 파일명 기반 wikilink, 위치 무관 → 무결)
- 테스트 97 → **143** (+46): schema.test.ts (20) + canonicalizer.test.ts (12) + wiki-ops.test.ts (+13)

**문서**:
- `plan/plan-ingest-core-rebuild.md` 신규 (Plan 본체 + v6 결과 + v6.1 실험 분석)
- `activity/ingest-comparison/README.md` 갱신 (v1~v6 종합 비교 표)
- `activity/ingest-comparison/v3-file-list.txt` 신규
- CLAUDE.md 갱신 (canonicalizer.ts, schema.ts, ingest-modals.ts 경로 추가)

---

## 2026-04-19 오전 (Stay-involved UX + chunk 과다분할 진단 세션) 마감

### ⭐ 다음 세션 최우선 작업: PMS v2 재인제스트 + v1/v2 비교

**목표**: 금번 세션 마지막에 수정한 `callLLMForExtraction` 프롬프트가 v1 과다분할(581 → 20~40) 해소하는지 검증.

1. Obsidian **Cmd+R** (새 빌드 로드) → Audit 패널 → `raw/0_inbox/PMS_제품소개_R10_20220815.pdf` (이미 inbox에 복원됨) 선택 → Ingest
2. 생성 파일 수·UI 라벨 여부·업계 표준 보존·log/index 등재율·시간/토큰 측정
3. 결과를 `activity/ingest-comparison/README.md` v2 섹션에 기록
4. v1(581) vs v2 정량 비교 표 완성

**이전 세션부터 누적된 잔여**:
- [#1] Audit 패널 인제스트 E2E — 이번 세션에 v1으로 실행됨, v2로 재검증 필요
- [#3] Obsidian UI 수동 테스트 — 재설계분 사람 눈 평가
- [B-2 #4] markitdown-ocr fallback E2E (OMRON 스캔 PDF)
- [B-2 #5] `.wikey/ingest_prompt_user.md` override E2E
- [B-2 #6] wiki/ 폴더 인제스트 가드 도입 결정

### 이번 세션 완료 (주요 10건)

**UX — Stay-involved 모달**:
- `IngestFlowModal` 통합 단일 모달 (Brief → Processing → Preview stepper)
- Brief 로딩 상태 + 비동기 `setBrief()` (즉시 모달 open, 10~30s LLM 대기 중 사용자 시각 피드백)
- Processing [Back] → Brief 복귀 (guide 유지, runIngest while 루프)
- Modal drag (h3 handle) + resize (SE corner grip 20×20, CSS 변수 기반 Obsidian max-width 우회)
- 이모지 제거 (CLAUDE.md 규칙 준수)

**UX — Audit 패널 대규모 개편**:
- Stat chip 3개 (All/Ingested/Missing) 클릭 토글 + **완전 원형 pill** (border-radius: 9999px) + active 상태 accent
- Filter row: `[Folder] [Search...] [List|Tree]` 오른쪽 정렬
- Select All 라인 우측에 "Total | N" (16px bold)
- Tree view: raw/ 최상위 숨김, SVG chevron (회전 애니메이션)
- List/Tree 토글 (동일 데이터, 뷰 전환)
- Fail/Cancelled 시각 구분 (fail=red, cancelled=gray)
- Cancel 후 재시도 UX: 체크 유지 + renderList() 호출로 stale UI 해소
- Provider/Model 셀렉트 **맨 아래로 배치** (Ingest 패널과 레이아웃 공유)
- Provider/Model 기본값 `(use Default Model)` + `(provider default)` — API 리스트 첫 항목 자동 선택 버그 방지

**UX — Ingest 패널 확장**:
- Provider/Model 셀렉트 추가 (Audit와 동일 패턴, 맨 아래 배치)
- Ingest 버튼은 기존 위치 유지

**UX — Dashboard**:
- Wiki 섹션에 `?` info 아이콘 (hover 툴팁 + 클릭 → `docs/ingest-decomposition.md`)
- Missing 경고 알림 문구 제거 (사용자 요구)

**기능 — Classify LLM fallback**:
- `classifyFile` PDF default 30_manual 제거 → LLM fallback 트리거
- DEWEY 카테고리 4 → **10개 확장** (000/100/200/300/400/500/600/700/800/900)
- `classifyFileAsync` + `classifyWithLLM` + `loadClassifyRules` 신설
- CLASSIFY.md에 템플릿·예시 섹션 추가 (LLM 참조용)
- 하드코딩 매칭 실패 시에만 LLM 호출 (비용 최소화)

**기능 — Ingest 핵심 수정**:
- `ingest-map.json` 슬래시 중복 정규화(`normalizeRawPath`) + `updateIngestMapPath` (이동 후 매핑 갱신)
- moveBtn 흐름 역전: 이동-후-인제스트 → **인제스트 성공 후 이동** (실패 시 inbox 잔류 → 재시도 가능)
- `skipPostMove` 옵션 추가 (PARA 이동은 호출자가 담당)
- Progress subStep/subTotal 세밀화: chunk i/N 진행률이 모달+row bar 양쪽에 부드러운 %로 반영
- `loadSettings` DEFAULT 명시 저장 (누락된 필드 자동 채움)
- generateBrief 404 로깅 강화 (`[Wikey brief] start: provider=X model=Y`)

**수정 — Gemini 404 원인 확정**:
- Google이 `gemini-2.0-flash` alias를 신규 사용자에게 **deprecate** — `models.list`는 여전히 반환하지만 `generateContent` 호출 시 404 ("no longer available to new users")
- `fetchModelList`에서 `gemini-2.0-flash`·`gemini-2.0-flash-lite` alias 필터링 (명시 버전 `-001`은 유지)
- `PROVIDER_CHAT_DEFAULTS.gemini = 'gemini-2.5-flash'` 단일 소스 확인

**진단 — chunk 프롬프트 과다분할 (v1 baseline)**:
- PMS 3.5MB PDF → 28,993자 → chunks 분할 → 각 청크 독립 추출 → **concepts 519 + entities 61 = 581 파일**
- 원인: `callLLMForExtraction` 프롬프트에 재사용 필터·환각 방지·상한 **전혀 없음** (이전 세션 보정은 `BUNDLED_INGEST_PROMPT`에만 적용)
- 과다 유형: UI 메뉴·기능명(`announcement`, `address-book`, `all-services` 등)이 concept 승격
- 정상 유지: 업계 표준 용어(`pmbok`, `wbs`, `gantt-chart`, `erp`, `mes` 등 14개)
- 현재: v1 파일 전부 원복(삭제) + PDF inbox 복귀 + chunk 프롬프트 새 버전(v2) 빌드
- 비교 데이터 저장: `activity/ingest-comparison/{README.md, v1-file-list.txt, v1-concepts-sample.txt}`

---

### (구) 이번 세션 완료 (커밋 9개) — 직전 세션 기록

### 이번 세션 완료 (커밋 9개)

- `f597133` **lint**: Phase 3 E2E 중복 13건 제거 + slug 정규화 (23 files, +80/−280)
- `fb0a471` **feat(ingest)**: UI 재설계 + provider resolver + updateIndex 카테고리 분기 (30 files, +834/−83)
- `f93b061` **fix(ingest)**: I2 로컬 타임존 + I3 classify 2차 서브폴더 (4 files, +142/−18)
- `dc4d30c` **feat(classify)**: Dewey Decimal 자연계 3차 분류 + setup-para-folders.sh (4 files, +256/−34)
- `b9b5339` **docs**: 세션 정리 — 계획/메모 동기화 (3 files, +102/−7)
- `08990c1` **fix(settings)**: Default Model 섹션에 Model 필드 추가
- `cc94cfe` **refactor(settings)**: API 동적 Model 로드 + `.wikey-select` 통일 + Re-detect 위치 이동
- `8da2045` **style(select)**: 외곽 테두리 제거 + chevron #999→#bbb (밝게)
- `468564e` **style(select)**: box-shadow/outline 제거 (focus/hover 포함)
- `64cf969` **docs(session-wrap)**: UI 폴리싱 4 커밋 반영
- `3db253f` **refactor(defaults)**: `provider-defaults.ts` 단일 소스 도입 + gemini-flash 동급 통일
- (신규) **feat(setup)**: PARA 방법론 전체 반영 (Areas/Resources/Archive 동일 구조) + `setup-para.ts` TS 포팅으로 플러그인 onload 자동 배포

### 이번 세션 주요 변경

**UI 재설계 (Ingest 패널)**
- 상단 bulk 3버튼 제거 → drop zone + `[Add]` + inbox 섹션 통합
- inbox 행: filename + filesize + Cloud/Local 뱃지
- 하단 바: `[PARA select] [Ingest] [Delay]` (Move → Ingest로 교체)
- Fail state 10분 TTL 보존 (renderInboxStatus 재렌더 간)

**자동 Ingest**
- Settings: `autoIngest` toggle + interval (0/10/30/60s)
- `vault.on('create')` → debounce → 자동 `runIngest`

**OCR/Provider resolver (근본 수정)**
- `isModelCompatible()` guard: qwen이 gemini로 전달되는 404 버그 예방
- Provider onChange 시 ingestModel + cloudModel 동시 clear
- `WIKEY_MODEL` fallback 제거 → wikey-core가 provider 기본값 선택
- **Default Model 섹션에 상세 Model 드롭다운 추가** (이전엔 Provider만 있어 PROVIDER_DEFAULTS 하드코딩 의존)
- **Default/Ingest Model 상세 모델 = API 동적 드롭다운** (`fetchModelList` 재사용, Gemini/OpenAI/Anthropic/Ollama 모두)
- OCR 전용 설정 (`ocrProvider`/`ocrModel`), 미설정 시 basicModel 상속
- `resolveOcrEndpoint()`: gemini/openai/ollama OpenAI-compat 자동 선택
- 5-tier PDF 추출 체크포인트 console.info/warn (silent fail 해소)

**설정 UI 폴리싱 (세션 후반)**
- 설정 패널 6 selects 모두 `.wikey-select` 통일 (Audit/Ingest 패널과 동일 chevron 스타일)
- Environment `Re-detect` 버튼 하단 → h3 헤더 우측 이동 (`.wikey-settings-section-header`)
- `.wikey-select`: border / box-shadow / outline 제거 + chevron `#999`→`#bbb` (밝게)

**Provider-defaults 단일 소스 리팩토링 (세션 종반)**
- 신규 `wikey-core/src/provider-defaults.ts` — provider별 기본 모델 한 파일에 집중
- 하드코딩 6곳 → import 교체 (config / llm-client / ingest-pipeline OCR / query-pipeline / main.ts CONTEXTUAL / settings-tab ping)
- 기본 모델을 `gemini-2.5-flash` 동급 가성비로 통일:
  - gemini: `gemini-2.5-flash`
  - anthropic: `claude-haiku-4-5-20251001` (sonnet → haiku)
  - openai: `gpt-4.1-mini` (gpt-4.1 → 4.1-mini)
  - ollama: `qwen3:8b`
- Vision (OCR) 전용: gpt-4o-mini / gemma4:26b (로컬)
- 이후 모델명 변경은 `provider-defaults.ts` 한 곳만 수정하면 전 파이프라인 반영

**classify 개편**
- Dewey Decimal 10개 대분류 (000_general~900_lifestyle)
- 토큰 기반 매칭 (regex `\b` → `tokenize + Set.has`로 `_` 경계 해소)
- PARA 경로 버그 fix: `raw/resources/` → `raw/3_resources/`
- `scripts/setup-para-folders.sh` 신규 (66개 폴더 사전 생성)

**updateIndex 카테고리 분기**
- 기존: 모든 항목이 "## 분석" 섹션으로만 append
- 수정: `{entry, category}` 객체 받아 엔티티/개념/소스/분석 섹션에 insert

**I2 로컬 타임존**
- `toISOString().slice(0,10)` → `formatLocalDate()` (getFullYear/Month/Date)
- KST 00~09시 UTC 날짜로 하루 뒤로 찍히는 버그 fix

### 검증 결과

- 단위 테스트: **95/95 PASS** (이전 65/70 → 95)
- 빌드: 0 errors
- validate-wiki.sh: PASS (5/5)
- E2E Raspberry Pi HQ Camera: 18 페이지 (source 1 + entities 9 + concepts 8) 생성 + index.md 카테고리별 정렬 검증
- OCR 경로 관찰: OMRON 6.3MB 스캔 PDF → markitdown-ocr + gemma4:26b vision 트리거 확인

### 발견 이슈/기록

- **OCR 하드코딩** `gemma4:26b` — 수정 완료 (resolveOcrEndpoint)
- **Silent fail** — UI에 fail 상태 2초 후 사라지는 UX 버그 → 10분 TTL로 수정
- **classify PARA 경로** — `raw/resources/` 하드코딩 (PARA 재구조화 누락) → 수정
- **Provider/model 불일치** — settings migration 없어 basicModel 변경 시 ingestModel stale → isModelCompatible guard + onChange clear
- **index.md updateIndex 버그** — 모든 신규 항목이 "분석" 섹션으로만 → 카테고리 분기
- **Date UTC 편향** — toISOString의 날짜 shift → formatLocalDate
- **`.ingest-map.json` stale 항목** — `nanovna-v2-notes.md` 삭제 후에도 남음 (follow-up)

### Phase 4 이관 (이번 세션 신규 추가)

- **§4-4b LLM 기반 3차/4차 분류** — Dewey Decimal 매칭 실패 시 LLM으로 대분류 선택 + 제품 4차 폴더 제안 + Audit 패널 "Re-classify with LLM" 토글 + 피드백 학습 + 저가 모델 옵션

### 기존 스킬 후보 (유지)

| ID | 후보 | 비고 |
|----|------|------|
| S1 | `obsidian-e2e-scaffold` 스킬 | obsidian-cli + Notice MutationObserver + Monitor 폴링 |
| S2 | `diagnostic-logger.ts` 유틸 | 파이프라인 단계별 console.info 헬퍼 |
| S4 | `wiki-validate-cleanup` 스킬 | validate-wiki.sh + audit-ingest.py 체이닝 |

### 이번 세션 신규 환경 변경

- `.claude/settings.local.json`: `Monitor`, `TaskStop` 자동 승인 추가
- Obsidian 실행: `--remote-debugging-port=9222 --remote-allow-origins=*` (CDP E2E용). 테스트 종료 후엔 일반 재시작 권장

---

## 2026-04-18 (E2E + 리팩토링 세션) 마감

### ⭐ 다음 세션 핵심 작업: Phase 3 잔여 검증

**파일**: `plan/phase3-todo.md` §B-1 + §B-2

#### B-1 Phase 3 원래 잔여
1. Audit 패널 인제스트 E2E (UI 클릭 흐름)
2. 인제스트 품질 검증 (16 entities + 12 concepts 신규 페이지 리뷰)
3. Obsidian UI 수동 테스트 (사람 눈 평가)

#### B-2 이번 세션 발생 follow-up
4. markitdown-ocr fallback E2E (실 스캔 PDF)
5. 단일 프롬프트 override 경로 E2E (`.wikey/ingest_prompt.md`)
6. wiki/ 폴더 인제스트 가드 도입 여부 결정

### 이번 세션 완료 (커밋됨, 7개)
- `92c9637` fix(ingest): OCR fallback + 4 이슈 수정 (race / logging / Ollama 404 / UI race)
- `7809d8f` docs: Phase 3 Obsidian E2E 테스트 결과 (`activity/phase-3-test-results.md`)
- `0421d7c` config(wikey): default 모델 변경 (basic=gemini, ollama=qwen3.6:35b-a3b)
- `79a458e` wiki: E2E 테스트 인제스트 아티팩트 + 자동 정리 (16E+12C)
- `ef63156` refactor(ingest-prompt): 단일 프롬프트 모델 + 모달 편집 UI
- `786983d` fix(ingest): log.md 헤더 형식 (`## [YYYY-MM-DD] ingest | <filename>`)
- `741040c` ui(sidebar): 헤더 탭 순서 (dashboard → ingest → audit → help) + 대시보드 hint eye 아이콘

### 이번 세션 검증 결과
- E2E 9 시나리오 (1, 2, 3, 3-1, 4, 4-1, 5a, 5b, 5c) 자동 실행
- PASS 6 (1/2/4/4-1/5a/5c) / PARTIAL 2 (3 silent skip, 5b 모호 메시지) / FAIL 1 (3-1 race)
- 발견 이슈 5건 → 4건 수정 + 회귀 검증 (이슈 5는 결정 보류)
- 단일 프롬프트 리팩토링 + 단위 70/70 + smoke test 통과
- 빌드 0 errors

### 스킬 후보 (다음 세션 또는 Phase 4에서 구현 결정)

| ID | 후보 | 비고 |
|----|------|------|
| S1 | `obsidian-e2e-scaffold` 스킬 | obsidian-cli + Notice MutationObserver + Monitor 폴링 패턴 자동화 (이번 세션 9회 반복) |
| S2 | `diagnostic-logger.ts` 유틸 | 파이프라인 단계별 console.info 헬퍼 + 누락 필드 warn (ingest-pipeline.ts에 적용한 패턴 재사용) |
| S4 | `wiki-validate-cleanup` 스킬 | validate-wiki.sh + audit-ingest.py 체이닝 + 자동 수정 (dupe 제거, 깨진 링크 변환, log 형식, index 등재) |

### 추가 follow-up (이번 세션 발견, plan/phase4-todo.md 또는 phase3-todo.md §B에 통합 예정)

| ID | 작업 | 우선 |
|----|------|------|
| F1 | wikey-obsidian 단위 테스트 (commands/sidebar/settings) | HIGH |
| F2 | `scripts/llm-ingest.sh` bash CLI 회귀 테스트 (4건 fix 동기화 또는 deprecate 결정) | MED |
| F4 | Scenario 3 (대규모 PDF + qwen3.6:35b-a3b) 재실행 — diagnostic 로깅으로 silent partial 원인 확정 | MED |

### Phase 4 이관 아이디어 (구현 X, 기록만)

- **model-benchmark.py** — Ollama × source × prompt 벤치 하니스 (이번 세션에 반복 작성한 /tmp/*.py 패턴 재사용 가능)
- **ollama-health.sh** — top PhysMem + /api/ps 메모리/VRAM 실시간 체크 헬퍼
- **prompt-baseline.py** — basic+user 프롬프트로 테스트 코퍼스 배치 실행 후 entity/concept counts diff

### 선택 문서 보강 (생략됨, 필요 시)
- `docs/getting-started.md` — Ingest Prompt 사용자 커스텀(A-1) 섹션 추가
- `local-llm/model-selection-guide.md` — Qwen3.6를 8B 업그레이드 경로로 명시
- `CLAUDE.md` — 플러그인 Ingest Model 설정 섹션 언급

---

## 과거 세션 (참고용)

> 생성일: 2026-04-10
> 이전 세션: wikey 프로젝트 초기 설정 + 계획 수립 (v2)

## 즉시 시작 (Step 1-3, Week 1)

### 1. [HIGH] Step 1: CLAUDE.md → wikey.schema.md 분리

CLAUDE.md(30KB, 모놀리식)를 분리:
- `wikey.schema.md` — 프로바이더 독립 마스터 스키마 (3계층 아키텍처, 워크플로우, 페이지 컨벤션, PII 규칙, LLM 다층 검색)
- `CLAUDE.md` — 경량화: "wikey.schema.md 읽으라" + Claude Code 도구 사용법
- `AGENTS.md` — "wikey.schema.md 읽으라" + Codex 특화 지시
- `local-llm/system-prompt.md` — 스키마 요약 + 로컬 LLM 제약

참고: `plan/phase1-todo.md` Step 1 (1-1 ~ 1-4)

### 2. [HIGH] Step 2: 디렉토리 구조 + Git 초기화

- wiki/index.md, log.md, overview.md 빈 템플릿 생성
- raw/, wiki/ 하위 디렉토리 생성 확인
- scripts/, local-llm/ 디렉토리 생성
- .gitignore 작성 (raw/, .DS_Store, *.gguf)
- `git init` + `gh repo create wikey --private --source=. --push`

### 3. [HIGH] Step 3: validate-wiki.sh + check-pii.sh + pre-commit hook

- 5가지 정합성 검증 (프론트매터, 위키링크, 인덱스 등재, 로그 형식, 중복)
- PII 패턴 스캐닝 (한국 전화번호, 이메일, 주민번호)
- Git pre-commit hook 연동

## 이후 (Step 4-7, Week 1-2)

### 4. [MEDIUM] Step 4: Claude Code로 첫 인제스트 5건

- llm-wiki.md, idea-comment.md를 raw/로 복사하여 소스 1-2로 사용
- 웹 기사 1건, 메모 1건, PDF 1건 (청킹 테스트)
- 20+ 위키 페이지 생성 목표

### 5. [MEDIUM] Step 5: 쿼리 워크플로우 검증 5건

- 사실·교차합성·분석·엔티티·빈결과 쿼리 각 1건

## 현재 프로젝트 상태 요약

- 파일: CLAUDE.md, llm-wiki.md, llm-wiki-kor.md, idea-comment.md, prompt_plan.md, plan/
- 미생성: wikey.schema.md, AGENTS.md, local-llm/, scripts/, .gitignore, Git
- wiki/, raw/: 빈 디렉토리 (콘텐츠 없음)
- 도구: Obsidian 1.12.7 + CLI 활성화, kepano/obsidian-skills 설치, Ollama 설치, Codex CLI 설치
