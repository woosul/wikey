# Phase 3 — Obsidian E2E Test Results

> **상위 문서**: [`activity/phase-3-result.md`](./phase-3-result.md) · [`plan/phase-3-todo.md`](../plan/phase-3-todo.md) — 본 문서는 §3.B (Obsidian E2E 테스트 결과) 보조 자료. 명명규칙: `phase-N-todox-<section>-<topic>.md` / `phase-N-resultx-<section>-<topic>-<date>.md` — `CLAUDE.md §문서 명명규칙·조직화` 참조.


> 실행 일시: 2026-04-18
> 환경: Mac mini M4 Pro 48GB, Ollama 0.20.5, Obsidian 1.12.7
> 자동화: obsidian-cli + dev:console (Notice MutationObserver 패치)
> 플랜: `plan/phase-3-todox-3.B-obsidian-test.md`

---

## 결과 요약

| 시나리오 | 상태 | 소요 | 핵심 결과 |
|---------|------|------|----------|
| 사전: markitdown-ocr fallback | PASS | 5분 | openai 패키지 설치, ingest-pipeline.ts에 5번째 fallback 추가, env-detect/UI에 hasMarkitdownOcr 추가 |
| Scenario 1 — 환경 감지 | PASS | 1분 | 10개 항목 모두 Installed/OK (MarkItDown OCR 포함) |
| Scenario 2 — 작은 파일 + qwen3:8b | PASS | 66초 | 3 entities + 2 concepts 신규, log/index/map 정상 갱신 |
| Scenario 3 — 큰 PDF + qwen3.6:35b-a3b | PARTIAL | 24분 | source + 7 entities 작성됐으나 log/index/.ingest-map 미갱신 |
| Scenario 3-1 — 큰 PDF + gemini-2.5-flash | FAIL (race) | 8분 | "File already exists" 오류 — S4와 동시 실행으로 동일 파일 충돌 |
| Scenario 4 — 작은 파일 + qwen3:8b + custom prompt | PASS | 80초 | 슬러그 규칙 준수 (영문 소문자+하이픈), log/map 갱신 |
| Scenario 4-1 — 작은 파일 + gemini-2.5-flash + custom prompt | PASS | 35초 | 4 entities + 6 concepts, 슬러그 규칙 준수, log 갱신 |
| Scenario 5a — Ollama 중단 | PASS | 12초 | "인제스트 실패: socket hang up" — 명확한 네트워크 오류 |
| Scenario 5b — 존재하지 않는 모델 | PARTIAL | 40초 | 에러 잡힘, 메시지가 "JSON parse failed"로 모호 |
| Scenario 5c — raw/ 외부 파일 | PASS (no guard) | 108초 | wiki/overview.md 인제스트 가능 → 19페이지 생성, 가드 없음 |

---

## 발견 이슈 (4건)

### 이슈 1: 청크형 인제스트의 log/index 갱신 누락 (Scenario 3)

**증상**: `qwen3.6:35b-a3b` + 큰 PDF 인제스트 시 source 페이지와 entities 7개는 작성되지만 `wiki/log.md`, `wiki/index.md`, `wiki/.ingest-map.json`이 갱신되지 않음.

**가설**:
- LLM SUMMARY 응답에서 `index_additions` / `log_entry` 필드가 누락됐을 가능성
- 또는 페이지 작성 후 `await wikiFS.write()` 단계에서 Obsidian vault adapter가 행(hang)

**검증 데이터**:
- 18:21:18 인제스트 트리거 → 18:45:15 source + 7 entities 작성 → 이후 무반응
- Notice DOM 미수집 (자동 dismiss)
- 콘솔에 진행 로그 없음 (Notice만 있고 console.log 없음)

**개선안**:
1. 인제스트 진행을 `console.info('[Wikey ingest]', ...)`로 영구 기록 (자동 dismiss 회피)
2. SUMMARY 응답에서 `index_additions`/`log_entry` 누락 시 명시적 경고
3. 청크형 파이프라인 종료 후 saveIngestMap 호출 보장 (try/finally)

### 이슈 2: 동시 인제스트 race condition (Scenario 3-1)

**증상**: 두 인제스트(S3-1 gemini PDF + S4 qwen3:8b 작은 파일)를 병행 실행 시 후행 인제스트가 "인제스트 실패: File already exists." 오류.

**근본 원인**:
- `ObsidianWikiFS.write()`는 `getAbstractFileByPath` 체크 후 `vault.create` 호출
- 두 인제스트가 동시에 동일 파일명을 만나면 첫 번째가 create 후, 두 번째의 exists 체크는 메타데이터 캐시 지연으로 null 반환 → 두 번째도 create 시도 → "already exists" 예외

**개선안**:
1. `wikiFS.write()`를 try/catch로 감싸 already-exists 시 재시도(modify) — atomic upsert
2. 또는 인제스트 단위 mutex 도입 (한 번에 하나의 인제스트만 실행)

### 이슈 3: 잘못된 모델명 에러 메시지 모호 (Scenario 5b)

**증상**: 존재하지 않는 모델(`fakemodel:7b`) 지정 시 "LLM JSON parse failed — max retries exceeded"로 표시. 사용자가 "모델 없음"임을 알기 어려움.

**근본 원인**: Ollama가 404 반환 → 응답 본문이 LLM JSON과 다름 → JSON parse 실패로 표시.

**개선안**:
1. `LLMClient.callOllama`에서 HTTP 404 응답 시 명시적 에러: `Model 'X' not found. Run: ollama pull X`
2. 또는 인제스트 시작 전 `/api/show`로 모델 존재 사전 검증

### 이슈 4: Settings [Create & Edit] 버튼이 사전 존재 파일에 실패

**증상**: `.wikey/ingest_prompt_user.md`이 이미 존재할 때 (예: 외부 도구로 생성, 또는 Obsidian metadata 캐시 지연) [Create & Edit] 클릭 시 "Failed to open user prompt: File already exists." 에러.

**근본 원인** (`wikey-obsidian/src/settings-tab.ts:215`):
```js
let file = vault.getAbstractFileByPath(USER_PROMPT_PATH)
if (!(file instanceof TFile)) {
  file = await vault.create(USER_PROMPT_PATH, USER_PROMPT_TEMPLATE)  // 파일이 디스크에 있지만 Obsidian 캐시 미반영 시 throw
}
```

**개선안**:
1. `await vault.adapter.exists(USER_PROMPT_PATH)`로 디스크 검사 추가
2. 또는 `vault.create` 실패 시 `vault.getAbstractFileByPath` 재시도 후 modify로 우회

### 이슈 5: 라지 PDF 가드 없음 (Scenario 5c와 관련)

**증상**: wiki/ 폴더 내 파일도 인제스트 가능 → 위키가 자기 자신을 재인제스트 가능. 의도치 않은 자기 참조 사이클 위험.

**현재 동작**: 가드 없음 (Option A 채택).

**개선안 (선택)**: wiki/ 폴더 내 파일 인제스트 시 경고 다이얼로그 표시 — 사용자가 의도한 경우 진행, 그 외에는 차단.

---

## 추가 작업 (사전 준비)

### markitdown-ocr fallback 추가

**배경**: 사용자가 "이미지 스캔 PDF 처리를 위해 markitdown-ocr이 fallback으로 정의되어야 함"을 지적.

**구현 변경**:
- `wikey-core/src/ingest-pipeline.ts:extractPdfText` — 5번째 fallback 추가
  - 텍스트 레이어 추출 4단계 모두 빈 결과 반환 시 → markitdown-ocr 사용
  - Ollama OpenAI 호환 endpoint(`/v1`)로 `gemma4:26b` (vision) 호출
  - 환경변수: `WIKEY_OCR_MODEL`, `OLLAMA_URL` 오버라이드 가능
- `wikey-obsidian/src/env-detect.ts` — `hasMarkitdownOcr` 필드 + `checkMarkitdownOcr()` 함수
- `wikey-obsidian/src/settings-tab.ts` — Environment 섹션에 "MarkItDown OCR" 행 (Optional)
- `pip install openai` (markitdown-ocr가 OpenAI 호환 클라이언트 요구)

**검증**:
- `python3 -c 'import markitdown_ocr, openai'` 통과
- Ollama gemma4:26b(`vision` 능력)에 OpenAI 호환 호출 정상 응답 (text completion 테스트)
- Settings UI에 "MarkItDown OCR: Installed" 표시

---

## 개별 시나리오 상세

### Scenario 1 — 환경 감지 (PASS)

10개 항목 모두 Installed/OK 표시:
- Node.js: `/Users/denny/.nvm/versions/node/v22.17.0/bin/node`
- Python3: `/Users/denny/.pyenv/shims/python3`
- kiwipiepy: Installed
- qmd: `/Users/denny/Project/wikey/tools/qmd/bin/qmd`
- Ollama: Running (3 models)
- Qwen3 8B: Installed
- Qwen3.6:35b-a3b: Installed
- Gemma4: Installed
- MarkItDown: Installed
- **MarkItDown OCR: Installed** (사전 준비에서 추가)

### Scenario 2 — 작은 파일 + qwen3:8b (PASS, 66초)

대상: `raw/1_projects/wikey/wikey-design-decisions.md` (2.5KB)

생성 결과:
- entities (3 신규): entity-zero-setup.md, entity-wikey.md, entity-byoai.md
- concepts (2 신규): concept-llm-participation-multi-layer-search.md, concept-architecture-decision-records.md
- source 페이지: source-wikey-design-decisions.md (기존 업데이트)
- log/index/.ingest-map: 모두 정상 갱신

### Scenario 3 — 큰 PDF + qwen3.6:35b-a3b (PARTIAL, 24분)

대상: `raw/3_resources/20_report/TWHB-16_001_kr_파워디바이스의기초.pdf` (3.3MB → 129KB markdown, 14 chunks)

작성됨:
- source-power-device-basics.md (업데이트)
- 7 entities (모두 신규): SiC-MOSFET, SiC-SBD, Full-SiC-파워-모듈, ROHM-Co-Ltd, rohm, sic-power-devices, SiC-파워-디바이스

**미작성** (이슈 1):
- log.md, index.md, .ingest-map.json 갱신 누락

엔티티 슬러그 일관성 부족: 일부는 PascalCase(SiC-MOSFET), 일부는 lowercase(rohm) — 커스텀 프롬프트 미적용 상태였음.

### Scenario 3-1 — 큰 PDF + gemini-2.5-flash (FAIL, race)

대상: 동일 PDF, provider=gemini-2.5-flash

진행:
- Summary (4분) → Chunk 1/13 ~ Chunk 13/13 (각 25-40초)
- "Creating pages..." 단계에서 즉시 "File already exists" 예외

원인: Scenario 4(qwen3:8b 작은 파일)를 병행 실행 → 동일 concept 파일에 충돌 (이슈 2).

### Scenario 4 — 작은 파일 + qwen3:8b + custom prompt (PASS, 80초)

커스텀 프롬프트(`vault/.wikey/ingest_prompt_user.md`):
```
엔티티 slug는 반드시 영문 소문자만 사용하고 언더스코어(_)는 절대 사용하지 마세요.
슬래시나 공백 대신 하이픈(-)을 사용하세요.
```

생성된 슬러그: 모두 영문 소문자 + 하이픈, 언더스코어 없음 ✓
- entities: rohm.md, entity-korean-enterprise-specialization.md, sic-power-device.md, sic.md
- concepts: concept-llm-wiki-architecture.md (외 2)
- log/index/.ingest-map: 모두 정상 갱신

### Scenario 4-1 — 작은 파일 + gemini-2.5-flash + custom prompt (PASS, 35초)

동일 커스텀 프롬프트, provider=gemini-2.5-flash. 11 페이지 생성.

생성된 슬러그: 모두 영문 소문자 + 하이픈 ✓
- entities (4): claude-code, codex-cli, gemini, gemma-4
- concepts (6): llm-provider-independence, korean-enterprise-specialization, file-over-app, rag-synthesis-layer, korean-search-strategy, morphological-analysis-guardrail

품질 비교:
- qwen3:8b는 wikey 자체 개념(wikey/zero-setup/byoai)에 집중
- gemini는 LLM 도구 생태계(claude-code/codex-cli/gemini/gemma-4)에 집중
- 둘 다 유효한 해석, 모델별 관점 차이

### Scenario 5a — Ollama 중단 (PASS, 12초)

`pkill -9 -f "ollama serve"` 후 인제스트 트리거. 12초 후 "인제스트 실패: socket hang up" 알림. macOS Ollama.app이 자동 재시작 → 후속 인제스트 정상 가능.

### Scenario 5b — 존재하지 않는 모델 (PARTIAL, 40초)

설정: `fakemodel:7b` 지정 → 인제스트 트리거.

결과: "인제스트 실패: LLM JSON parse failed — max retries exceeded" — 에러는 잡혔지만 사용자에게 "모델 없음" 정보 미전달 (이슈 3).

### Scenario 5c — raw/ 외부 파일 (PASS, 108초)

대상: `wiki/overview.md` (위키 자체 파일).

결과: 인제스트 정상 진행 → 19개 페이지 생성. 가드 없음 (Option A). wiki/가 wiki/ 자체를 재인제스트 가능 — 사이클 위험 (이슈 5 참조).

---

## 이슈 수정 결과 (4건 적용)

| 이슈 | 수정 | 검증 |
|------|------|------|
| 1 (HIGH) | ingest-pipeline.ts에 `[Wikey ingest]` console.info 로깅 추가 (start, source meta, summary done, chunks done, pages written, index/log update, done). commands.ts에 console.error + stack 추가. summary가 index_additions/log_entry 누락 시 console.warn | 회귀 테스트 시 단계별 진행이 dev:console에 영구 기록됨 |
| 2 (HIGH) | `ObsidianWikiFS.write()` 원자적 upsert: try create → "already exists" 캐치 → modify로 fallback. 디스크에 있지만 vault 캐시 미반영 시 adapter.write 사용 | 동시 인제스트 2건 (wikey-design-decisions + nanovna) 동시 트리거 → 두 건 모두 성공, "File already exists" 0건 |
| 3 (MED) | `LLMClient.callOllama`에서 응답 본문의 `data.error` 검사 → "not found"/"does not exist" 패턴 시 친절한 메시지: "Ollama model 'X' not found. Run: ollama pull X" | `fakemodel:7b` 재시도 → "인제스트 실패: Ollama model 'fakemodel:7b' not found. Run: ollama pull fakemodel:7b" 정확히 표시 |
| 4 (LOW) | `settings-tab.ts`의 [Create & Edit] 핸들러: vault.create 호출 전 `vault.adapter.exists`로 디스크 사전 검사. metadata 캐시 지연 시 50ms 대기 후 재조회 | 동작 검증은 다음 세션에서 (manual 테스트 필요) |
| 5 (LOW) | 미수정 — wiki/ 가드는 사용자 의도에 따라 선택 가능, 별도 결정 후 추가 | — |

## 회귀 테스트 결과

### Issue 3 (Ollama model not found) — VERIFIED

```
[+0s] 21:27:16 [NOTICE] 인제스트 실패: Ollama model 'fakemodel:7b' not found. Run: ollama pull fakemodel:7b
```

이전 메시지 ("LLM JSON parse failed — max retries exceeded")보다 행동 가능한 명시적 안내.

### Issue 2 (race condition) — VERIFIED

두 작은 파일을 1초 간격 (≈동시) 인제스트 트리거:
- 21:27:44 ingest 1 start (wikey-design-decisions, qwen3:8b, 1474 chars)
- 21:27:45 ingest 2 start (nanovna-v2-notes, qwen3:8b, 1039 chars)
- 21:28:46 ingest 2 DONE — entities=1, concepts=1, index_additions=2, log_entry=yes, pages=3
- "File already exists" 0건 확인

### Issue 1 (diagnostic logging) — VERIFIED

console.info에서 회귀 테스트 진행을 단계별로 확인:
```
[INFO] [Wikey ingest] start: ...
[INFO] [Wikey ingest] source: 1039 chars, large=false, provider=ollama, model=qwen3:8b
[INFO] [Wikey ingest] small-doc LLM done — entities=1, concepts=1, index_additions=2, log_entry=yes
[INFO] [Wikey ingest] writing pages — source=nanovna-v2-notes.md, entities=1, concepts=1
[INFO] [Wikey ingest] pages written — created=3, updated=0
[INFO] [Wikey ingest] index.md updated with 2 entries
[INFO] [Wikey ingest] log.md prepended
[INFO] [Wikey ingest] done: ...
```

향후 Scenario 3와 같이 silent partial completion 발생 시, 어느 단계에서 실패했는지 즉시 식별 가능.

## 잔여 후속 작업

- Scenario 3 재테스트 (qwen3.6:35b-a3b 큰 PDF) — 진단 로깅으로 silent partial completion 원인 확정
- 진정한 스캔 PDF로 markitdown-ocr fallback 단독 검증
- 이슈 5 (wiki/ 가드) 도입 여부 결정

---

## 환경

- macOS Darwin 25.3.0, Mac mini M4 Pro 48GB
- Ollama 0.20.5 (3 models: qwen3:8b 5.2GB, qwen3.6:35b-a3b 23GB, gemma4:26b 17GB)
- Python 3.14.0 (markitdown 0.1.5, markitdown-ocr 0.1.0, openai 2.32.0)
- Node 22.17.0 (qmd ABI 호환)
- Obsidian 1.12.7
- 자동화 도구: obsidian-cli (eval/dev:console/dev:screenshot/command)
