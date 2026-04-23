# Phase 4 통합 smoke 테스트 계획서 (v2 — codex APPROVE-WITH-CHANGES)

> **목적**: Phase 1~4 본체 완성 직전의 통합 회귀 smoke. Phase 4.0/4.1/4.2/4.3/4.5 의 모든 사용자 경로가
> 6종 서로 다른 스타일의 문서를 재료로 실 사용자 시나리오 (파일 선택 → 변환 → ingest → 분류 → 질의·답변 → 보조 링크 → 임의 이동 후 재질의) 에서 정상 동작하는지 확인.
>
> **작성일**: 2026-04-23 session 5 (commit `9e9407b` 직후)
> **상태**: v2 — codex (gpt-5.4 xhigh, Panel Mode D) 피어리뷰 수용.
> - v1 초기 판정: **REJECT** (P1 4건 미반영)
> - v2 반영: 실행 경로 고정 (Audit 패널 only) · clean-slate + settings baseline · index-ready gate · 파일 2 PII redaction 규칙 · 파일별 프로파일 실측 보정 · tier 이름 현행화 · Phase 4.0 UI pre-smoke · 리포트 템플릿 항목 14 로 보정.
> - v2 예상 판정: **APPROVE-WITH-CHANGES** (codex 명시).
>
> **수립 근거**: `plan/phase-4-todo.md` Phase 4 본체 완성 체크리스트 **A (§4.3 통합 smoke)** 확장 — 당초 단일 소스에 대한 5-항목 smoke 를 6종 × 3-stage 통합 회귀로 확장 (Phase 4.0/4.2/4.3/4.5.2 모두 포괄).
> **사용자 제약**: Obsidian CDP 자동화 금지. **실제 사용자 방식 (클릭·입력)** 만 사용. 파일별 리포트 필수.

---

## 1. 스코프

### 1.1 In-scope (Phase 1~4 본체 검증 대상)

| Phase | 대상 |
|-------|------|
| Phase 1 | wiki 3계층 (sources/entities/concepts/analyses), index.md, log.md, frontmatter |
| Phase 2 | qmd 하이브리드 검색 (BM25+벡터+RRF), 한국어 kiwipiepy 토크나이즈, Contextual Retrieval Gemma 4 프리픽스 |
| Phase 4.0 | Chat 패널, Audit/Ingest 패널, provider/model 편집, DEFAULT 라벨, 500px 초기 폭 |
| Phase 4.1 | Docling (PDF/DOCX/PPTX/XLSX/HTML/IMG) + unhwp (HWP/HWPX) + MarkItDown fallback + bitmap OCR 차단 (§4.1.3) + 변환 캐시 |
| Phase 4.2 | source-registry (sticky source_id + path_history), movePair (raw + sidecar pair 이동), CLASSIFY.md + LLM 3/4차 분류, vault listener + startup reconcile |
| Phase 4.3 | 3-stage prompt pipeline (Stage 1 summary / Stage 2 mentions / Stage 3 canonicalize) + frontmatter provenance + stripBrokenWikilinks + Part B citation (`📄` 보조 링크) |
| Phase 4.5.1 | Stage 별 Stay-involved 모달 (brief → processing → preview) |
| Phase 4.5.2 | 삭제·초기화 안전장치 (팔레트 7 entries + Settings Reset 섹션) — **덤 smoke** 로 최소 1회만 확인 |

### 1.2 Out-of-scope

- Phase 4 **본체 완성 선언** (D 블록) — 본 smoke 통과 후 별도 수행
- Phase 5 항목 (§5.1~§5.7) 전체
- Phase 3 완료분 회귀 (자동 vitest 474 green 으로 대체)
- 장기 결정성 측정 (§4.5.1 variance) — Phase 5 §5.4 에서 별도

---

## 2. 전제 조건 (Preconditions)

| 항목 | 기준 | 확인 방법 |
|------|------|----------|
| wikey-core | 474/474 tests green | `npm test` |
| wikey-obsidian | esbuild 0 errors | `npm run build` |
| Git HEAD | `9e9407b` (docs sync 직후) | `git log -1 --format=%h` |
| Obsidian | 1.12.x 실행 가능 | 앱 실행 |
| 플러그인 리로드 | Cmd+R 1회 수행 | 플러그인 리스트에서 wikey enabled 확인 |
| docling | 설치됨 (Settings → Env Status) | "v<x.y.z>" 표기 |
| unhwp | 설치됨 (Settings → Env Status) | "Installed" 표기 |
| Ollama or Gemini | 1 종 이상 동작 | check-providers.sh 또는 Settings Env Status |
| inbox 파일 | 6종 배치 | `ls raw/0_inbox/` 6 개 확인 |
| wiki 상태 | entities/concepts/sources 비어있음 (analyses 1건 `self-extending-wiki.md` 제외) | `ls wiki/` |
| source-registry.json | 비어있음 또는 `{}` | `cat wiki/.wikey/source-registry.json 2>/dev/null` |
| qmd 인덱스 | 재빌드 권장 (clean slate) | `./scripts/reindex.sh --check` |

### 2.1 Clean-slate + Settings Baseline (smoke 직전 1회)

**[P1 반영 — codex review]** 재현 가능성 확보를 위해 baseline 을 명시적으로 고정.

#### 2.1.1 fs/인덱스 clean-slate

```bash
# 1. 현재 wiki 콘텐츠 백업 (종료 시 복원)
mv wiki/analyses/self-extending-wiki.md /tmp/self-extending-wiki.bak.md

# 2. registry 초기화 (팔레트 "Wikey: Reset registry only" 로도 가능)
rm -f wiki/.wikey/source-registry.json

# 3. wiki 본문 비우기 (entities/concepts/sources) — analyses 는 이미 비어있음
rm -f wiki/sources/*.md wiki/entities/*.md wiki/concepts/*.md
# → 또는 팔레트 "Wikey: Reset wiki + registry" (자동 raw/ 유지)

# 4. index.md / log.md 는 유지. smoke 중 추가되는 엔트리가 곧 증거.

# 5. qmd 인덱스 purge
./scripts/reindex.sh --purge   # 또는 팔레트 "Wikey: Reset qmd index"

# 6. 빌드 확인
npm run build && npm test   # 474/474 green + 0 errors

# 7. 6 inbox 파일 원본 보존 확인
ls raw/0_inbox/ | wc -l   # 6 이어야 함
```

#### 2.1.2 Obsidian Settings 고정 (Wikey Settings Tab)

| 항목 | 값 | 이유 |
|------|----|----|
| **Ingest Briefs** | `Always` | Stay-involved modal (Brief 단계) 가 반드시 뜨도록 고정. `Never`/`Session` 은 Brief phase skip. |
| **Verify results before writing** | `ON` | Stay-involved Preview 단계를 강제. off 면 Preview 미표시 → plan 가정 위배. |
| **Auto Ingest** | `OFF` | inbox watcher 의 자동 트리거 차단. 수동 클릭 시나리오만 재현. |
| **Basic Model / Ingest Provider** | 세션 시작 시 값 기록 | 리포트에 provider/model 명시. |
| **Extraction Determinism** | 그대로 (OFF 기본) | 결정성 측정은 Phase 5, smoke 는 실 사용 조건. |

#### 2.1.3 플러그인 reload

```
Obsidian: Cmd+R
```

- 세션 내 `skipIngestBriefsThisSession` latch 초기화 (Stage 1 Brief 의 "Skip this session" 클릭이 없었던 상태로 보장).
- 변경된 Settings 이 `buildConfig()` 에 반영되도록.

#### 2.1.4 종료 후 복원 절차 (smoke 끝난 뒤)

```bash
# analyses 복원
mv /tmp/self-extending-wiki.bak.md wiki/analyses/self-extending-wiki.md

# 또는 smoke 결과를 유지하고 self-extending-wiki 는 별도 commit 으로 되돌리기:
git checkout wiki/analyses/self-extending-wiki.md
```

---

## 3. 파일별 프로파일 (6종)

**[P2 반영 — codex review]** 실제 tier 이름 (`ingest-pipeline.ts:1422`, `classify.ts:419` 기준) · 로컬 `pdfinfo` 실측 페이지 수 · 예상 변환 분기 를 명시.

| # | 파일 | 크기 | 형식 | 페이지 | 변환 경로 예상 | 특이 검증 |
|---|------|------|------|------|---------------|----------|
| 1 | `llm-wiki.md` | 12 KB | Markdown | N/A | **변환 skip** (`.md` 직접 ingest) | Karpathy 철학 원문, 개념·정의 밀집. 원문에 `[[...]]` 없음. |
| 2 | `사업자등록증C_(주)굿스트림_301-86-19385(2015).pdf` | 316 KB | PDF (scan, Adobe Scan Library) | 1p | **`1b-docling-force-ocr-scan`** 가능성 높음 — text layer corrupted 판정 시 OCR 강제 | **PII — redaction 규칙 §3.2** 엄격 적용. 답변에 사업자번호·주민번호·대표자명 노출 금지. |
| 3 | `C20260410_용역계약서_SK바이오텍전자구매시스템구축.pdf` | 3.2 MB | PDF (Canon scan) | **6p** | `1-docling` 또는 text-layer corruption → **`1b-docling-force-ocr-scan`** 가능. `pdftotext` spot check 결과 깨진 glyph (`Etr8l E +:S AE AqEA-l`) 다수 → corruption 확증. | 계약 당사자·계약금액·계약기간·의무조항 같은 조항 단위 개념 추출. |
| 4 | `PMS_제품소개_R10_20220815.pdf` | 3.6 MB | PDF 1.6 (Optimized) | **31p** | `1-docling` 성공 예상. 삽화 많을 경우 **`image-ocr-pollution` 감지 → `1a-docling-no-ocr` retry 분기** (§4.1.3) 검증축. | PMS 제품 모듈 4~6건 + Lotus 단일진동 이력 없음 (§4.1.3 cleanup 후 회귀 baseline). |
| 5 | `스마트공장 보급확산 합동설명회 개최.hwp` | 17 KB | HWP 5.x 바이너리 | — | **`unhwp`** 직행. 실패 시 **fail** (markitdown fallback 허용 안 함). | 한국어 공문 구조 (공고·주최·일정·안건). |
| 6 | `Examples.hwpx` | 1.2 MB | HWPX (OOWPML zip) | — | **`unhwp`** 직행. 실패 시 **fail**. | HWPX 전용 경로. zip 내 추가 리소스는 무시 (본문만 추출). |

### 3.1 각 파일 예상 리스크 · 분기 검증축

| # | 리스크 | 완화 | 핵심 분기 |
|---|-------|------|----------|
| 1 | Stage 1 이 Karpathy 철학을 한국어 요약으로 압축 시 용어 누락 | Stage 2 mention 수 ≥3 이면 통과 | — |
| 2 | text-layer corruption → OCR 과잉 → PII 추출 | `check-pii.sh` 필수 + §3.2 redaction 규칙 | `1-docling` vs `1b-force-ocr-scan` 판정 기록 |
| 3 | 계약서 6p × corruption → OCR 후 조항 분리 | convert-quality ≥ 0.6 + 조항 수 ≥ 4 | text-layer 품질 vs force-ocr 결과 비교 |
| 4 | 31p 대용량 PDF 변환 캐시 miss 시 3~5 분 소요 | 첫 실행 인내. 두번째부터 <5s | `1-docling` 성공 vs `image-ocr-pollution` → `1a-docling-no-ocr` retry |
| 5 | unhwp 미설치 시 markitdown fallback 허용? | **불허** — Settings Env Status 에서 "Installed" 확인 후만 진행 | `unhwp` vs `fail` (fallback 아님) |
| 6 | HWPX zip 내부 추가 리소스 파싱 실패 | 본문만 추출되면 pass | `unhwp` vs `fail` |

### 3.2 파일 2 PII Redaction 규칙 (Critical — [P1] 반영)

**[P1 반영 — codex review]** 사업자등록증은 PII 농도가 가장 높은 단일 소스. wiki 전파·LLM 답변 누출을 막기 위해 다음 carve-out 을 **모든 Stage** 에 적용한다.

#### 3.2.1 PII 정의 (이 smoke 맥락)

- 주민등록번호 (`\d{6}-\d{7}`)
- 사업자등록번호 (`\d{3}-\d{2}-\d{5}`) — 단, **(주)굿스트림 자체의 법인 레코드로서의 상호·소재지** 는 일반 공개 정보로 허용 (위키는 "굿스트림" entity 를 만들 수 있음).
- 대표자 성명 (주민번호 하단의 개인 식별 조합)
- 주소 상세 번지 (법정동·지번 포함) — 단, 시/도/구 수준 은 허용.
- 전화번호 (`\d{2,3}-\d{3,4}-\d{4}`) / 이메일

#### 3.2.2 Stage 별 검증

- **Stage 1 (convert → summary)**:
  - 변환 직후 `scripts/check-pii.sh <converted.md>` 실행 → RED 시 **Ingest 중단 + 원본 raw/0_inbox/ 유지**.
  - Stage 1 summary 는 LLM 출력 그대로 저장되지만, summary 생성 직후 `check-pii.sh` 재실행 (source 페이지 본문 상대).
- **Stage 2 (mentions)**:
  - mention.evidence 필드에 PII 원문이 들어갈 수 있음 → Stage 2 출력 JSON 을 콘솔 덤프 후 PII 패턴 regex 점검.
- **Stage 3 (canonicalize)**:
  - canonical name 에 PII 가 포함된 엔트리 (예: `"홍길동"` 대표자명) 는 **dropped 로 강등되어야 함** (schema-invalid, 사유 "PII-name").
  - dropped 에 나타나지 않고 wiki/entities 에 써졌다면 FAIL.
- **frontmatter provenance**:
  - `ref` 는 `sources/<id>` 형식이라 PII 없음 — 점검 불필요. `reason` 필드에 PII 유입 여부만 점검.
- **Stage 2 질의/답변** (§4.2.2 Q2):
  - 질문: "굿스트림 법인의 업종과 소재지(시/도 수준)는?" 로 강제 — 대표자 정보는 요청하지 않음.
  - 답변에 주민번호/사업자번호/상세 번지/대표자 성명 포함 시 FAIL. Notice + 즉시 wiki 페이지 rollback.

#### 3.2.3 FAIL 시 rollback 절차

```bash
# 1. 생성된 wiki 페이지 제거 (commit 전)
git checkout wiki/sources/ wiki/entities/ wiki/concepts/ wiki/index.md wiki/log.md

# 2. registry 에서 해당 source_id tombstone
# (팔레트) Wikey: Delete source (dry-run) → 사업자등록증 선택 → DEL <id> 타이핑 → Confirm

# 3. raw/ 파일은 보존 (smoke 재시도 위함)
# 4. 리포트의 PII 항목에 원인 + 노출 범위 명시
```

---

## 4. 테스트 단계

### 4.0 Phase 4.0 UI pre-smoke (파일 루프 전 1회)

**[P2 반영 — codex review]** Phase 4.0 UI 항목은 파일 단위로 반복할 필요 없음. 루프 시작 전 1회 고정 체크.

1. Obsidian 사이드바에서 Wikey 리본 클릭 → Chat 패널 기본 활성 확인.
2. Chat 패널 하단 provider / model `<select>` 2개 모두 **편집 가능**, provider 변경 시 model 리스트 자동 재로딩 확인.
3. Audit 패널 / Ingest 패널 각각 클릭 → 패널 하단에 **"Default AI Model : provider | model"** readonly bar 표시 확인.
4. Audit 패널 inbox 리스트에서 "DEFAULT" 라벨이 provider/model 미설정 row 에 일관적으로 표시 확인.
5. 새 Obsidian 세션 (vault 처음 열기) 인 경우, 사이드바 초기 폭이 **500px** 로 자동 설정됨 확인 (이미 폭이 설정된 기존 세션이면 건너뜀).
6. `/clear` 슬래시 커맨드 Chat 창에서 동작 → history 비워지고 인사 메시지 재출력 확인.

체크리스트:
- [ ] Chat 기본 활성
- [ ] provider / model 편집 가능 + model list 재로딩
- [ ] 비-chat 패널 readonly model bar 표시
- [ ] DEFAULT 라벨 일관성
- [ ] 500px 초기 폭 (새 세션에 한함)
- [ ] `/clear` 동작

FAIL 시 파일 루프 진입 금지. 관련 회귀는 `activity/phase-4-result.md §4.0` 참조.

---

각 파일은 **Stage 1 → 2 → 3** 순서로 수행. 실패 시 해당 파일 리포트에 기록 후 다음 파일로 진행 (진행 불가 수준이면 중단 후 root cause).

### 4.1 Stage 1 — Ingest

#### 4.1.1 수동 절차 (CDP 금지, **Audit 패널만** 사용)

**[P1 반영 — codex review]** `autoMoveFromInbox: true` 는 **Audit 패널 경로에서만** 설정됩니다 (`sidebar-chat.ts:1259,1639`). Ingest 패널 및 `Cmd+Shift+I` (`commands.ts:25`) 경로는 자동 분류·이동을 수행하지 않습니다. Phase 4.2 classify + movePair 를 smoke 에 포함시키려면 **Audit 패널만** 사용합니다.

1. Obsidian 우측 Wikey 사이드바 → **Audit 패널** 탭 버튼 클릭 (말풍선 아이콘 옆의 bar-chart 계열 아이콘).
2. Audit 패널 inbox 리스트에서 **대상 파일 한 건만** 체크박스 선택 (다중 선택 금지 — 파일별 리포트를 1:1 로 기록하기 위함).
3. Audit 패널의 `Ingest` 버튼 클릭. (**Ingest 패널의 Ingest 버튼 / Cmd+Shift+I 단축키 / URI `wikey://ingest` 는 본 smoke 에서 사용 금지 — auto-classify 를 우회함.**)
4. **IngestFlowModal Brief 단계**: brief 텍스트 약 5~10s 내 표시됨 확인 (Ollama cold start 시 ~30s 허용). guide hint 는 공란 유지 → `Next` 클릭.
5. **Processing 단계**: 진행 bar `1/4~4/4` 이동. Stage 1 summary → Stage 2 mentions → Stage 3 canonicalize → write.
6. **Preview 단계** (verifyIngestResults=ON baseline): source 페이지 요약 + 생성 예정 entity/concept 리스트 확인 → `Confirm` 클릭.
7. Modal 자동 close + Notice `"인제스트 완료: N개 페이지"` 5초 표시.
8. **Developer Console** (`Cmd+Opt+I`) 에서 `[Wikey ingest]` 로그 scroll — 변환 tier / Stage 별 LLM 토큰 / 분류 결과 확인. Console 로그를 리포트 dump 로 복사.
9. 파일 탐색기에서 `raw/0_inbox/<file>` 가 **자동 분류된 PARA/DDC 경로** 로 이동됐는지 확인 (Audit 경로에서만 기대).
10. `wiki/sources/source-*.md` · `wiki/entities/*.md` · `wiki/concepts/*.md` 신규 페이지 확인.
11. `wiki/index.md` 신규 섹션 등재 확인.
12. `wiki/log.md` 에 `ingest` 타입 엔트리 추가 확인.
13. `wiki/.wikey/source-registry.json` 에 해당 `sha256:...` 엔트리 + `vault_path` 최신 경로 확인.

#### 4.1.2 체크리스트 (파일별 리포트에 기록, 14 항목)

**[P3 반영 — codex review]** tier 라벨과 로그 문자열을 실제 구현 (`ingest-pipeline.ts:1422`, `classify.ts:419`) 기준으로 현행화.

- [ ] 변환 tier 판정 — 로그 `tier N/6 start` + `tier-label` (`1-docling` / `1a-docling-no-ocr` / `1b-docling-force-ocr-scan` / `1b-docling-force-ocr-kloss` / `2-markitdown-ocr` / `3-markitdown` / `unhwp`) 중 어느 분기인지 기록
- [ ] 변환 retry 여부 (image-ocr-pollution → `1a-docling-no-ocr` retry 감지 시 기록)
- [ ] 변환 소요 시간 (cache miss / cache hit `— pdf:N-docling` 로그)
- [ ] 변환 품질 스코어 (`convert-quality` 0~1)
- [ ] bitmap OCR 본문 오염 없음 (§4.1.3)
- [ ] Stage 1 summary 글자수 (기대 300~600)
- [ ] Stage 2 mentions 수 (기대 ≥3) + evidence PII 점검 (파일 2 전용)
- [ ] Stage 3 canonicalize 된 entity / concept 수
- [ ] `dropped` (schema-invalid) 수 + 사유 (PII-name 이 파일 2 에 나타나면 정상)
- [ ] frontmatter provenance entries 수 (entity/concept 페이지 마다 ≥1)
- [ ] source 페이지 본문 wikilink 유효성 (§4.3.3 stripBrokenWikilinks)
- [ ] 자동 분류 PARA/DDC depth 기록 — `N_para` (1자리) / `NN_type` (2자리) / `NNN_topic` (3자리) 몇 레벨까지 결정됐는지 + 규칙 매칭 vs LLM fallback 구분 (`[Wikey classify] auto-rule` / `LLM fallback: "<file>" → <dest> (<hint>)` 로그 문자열)
- [ ] raw 파일 이동 후 pair sidecar 동반 이동 (`<file>.md` 확인)
- [ ] source-registry.json vault_path 최신 + index.md 등재 / log.md 엔트리

#### 4.1.3 Index-ready gate (Stage 1 → 2 사이 반드시 통과)

**[P1 반영 — codex review]** Ingest 완료 직후 qmd reindex 는 **background fire-and-forget** 으로 실행됩니다 (`ingest-pipeline.ts:425,1823`). Notice 가 뜨자마자 Stage 2 질의를 보내면 qmd 인덱스가 stale 상태일 수 있어 답변이 빈 결과 또는 오래된 페이지만 참조합니다. Stage 2 는 **인덱스가 최신임이 확인된 뒤에만** 진행합니다.

수동 절차:

1. Ingest 완료 Notice 표시 후, 터미널에서 `./scripts/reindex.sh --check` 실행.
2. 출력에서 `stale=0` (또는 "모든 문서 최신" 류 메시지) 확인.
3. 확인 전에 Stage 2 에서 답변이 비거나 깨지면 **setup fail 로 분류** (제품 fail 아님) — 인덱스 완료 대기 후 재질의.
4. (대안) Settings Tab → Wiki Tools → `Reindex Check` 버튼 사용.

이 gate 를 통과하기 **전의** Stage 2 실패는 리포트에 "setup: reindex not ready" 로 기록하고 제품 판정에서 제외합니다.

### 4.2 Stage 2 — Wiki 검색

#### 4.2.1 수동 절차

1. 사이드바 **Chat 패널** 클릭 (헤더 말풍선 아이콘).
2. 아래 **4.2.2 파일별 질문** 중 해당 번호 질문을 메시지창에 **타이핑**.
3. Enter 또는 Send 버튼 클릭.
4. 답변 생성 (LLM + qmd 검색) 대기 (~3~15초).
5. 답변 본문의 `[[wikilink]]` 개수 세기.
6. 각 wikilink 뒤에 `📄` 보조 아이콘 렌더 확인 (CSS `.wikey-citation-link`, opacity 0.7, 크기 0.68em).
7. wikilink 클릭 → Obsidian 이 해당 wiki/*.md 페이지 오픈 확인.
8. `📄` 아이콘 클릭 → 원본 파일 (raw/ PDF/HWP/MD) 이 내장 viewer 또는 기본 앱에서 오픈 확인.
9. 생성된 wiki 페이지 하나를 열어 Obsidian 기본 **Backlinks** 패널에서 `source-*.md` 가 역참조 되는지 확인.

#### 4.2.2 파일별 질문 (고유)

| # | 파일 | 질문 |
|---|------|------|
| 1 | llm-wiki.md | "Karpathy 가 제안한 LLM wiki 가 기존 RAG 와 차별화되는 핵심 원리는?" |
| 2 | 사업자등록증 굿스트림 | "굿스트림 법인의 업종과 소재지(시/도 수준)는?" (**PII 강제**: 대표자 성명 / 주민번호 / 사업자번호 / 상세 번지 요청 금지. 답변에 PII 포함 시 FAIL + §3.2.3 rollback.) |
| 3 | SK바이오텍 계약서 | "SK바이오텍 전자구매시스템 계약의 범위와 주요 조항은?" |
| 4 | PMS 제품소개 | "PMS 제품의 핵심 기능 모듈은 무엇인가?" |
| 5 | 스마트공장 HWP | "스마트공장 보급확산 합동설명회의 주최·일정·주요 안건은?" |
| 6 | Examples HWPX | "Examples 문서의 주요 섹션 구성은?" |

#### 4.2.3 체크리스트

- [ ] 답변 생성 (empty 아님, 2문장 이상)
- [ ] wikilink `[[...]]` ≥ 1개
- [ ] 각 wikilink 뒤 `📄` 보조 링크 렌더
- [ ] wikilink 클릭 → wiki/*.md 오픈 정상
- [ ] `📄` 클릭 → 원본 파일 오픈 정상 (내장 또는 외부)
- [ ] source-*.md 의 Obsidian Backlinks 패널에 참조 페이지 노출
- [ ] LLM 답변 소요 시간 기록
- [ ] 답변 내용의 사실 정확성 spot check (소스 원문 대조)
- [ ] (파일 2 전용) PII 노출 없음 — 사업자번호/주민번호 패턴 답변 포함 여부

### 4.3 Stage 3 — 분류 내 임의 이동 (pairmove) + 재검색

#### 4.3.1 수동 절차

1. Obsidian 파일 탐색기에서 Stage 1 에서 이동된 `raw/<PARA>/<DDC>/<file>` 를 확인.
2. 해당 파일을 같은 PARA 내 **다른 DDC 폴더** 또는 다른 PARA 폴더로 **마우스 드래그 이동** (또는 우클릭 `Move file to...`).
3. Obsidian 이 rename 이벤트 발행 → Wikey 플러그인 `vault-events.ts::reconcileExternalRename` 호출.
4. Developer Console 에서 `[vault-events]` 로그 확인: `reconcileExternalRename` → registry.vault_path 갱신 + sidecar `<file>.md` 함께 이동.
5. 파일 탐색기에서 새 경로에 원본 + sidecar 쌍이 존재 확인.
6. `wiki/.wikey/source-registry.json` 에서 해당 `source_id` 의 `vault_path` 가 새 경로로 업데이트됐는지 + `path_history` 에 이전 경로가 append 됐는지 확인.
7. `wiki/sources/source-*.md` frontmatter `vault_path` 가 새 경로로 rewrite 됐는지 확인 (`wiki-ops.ts::rewriteSourcePageMeta`).
8. **Stage 2 와 동일한 질문을 Chat 패널에 재입력** → 답변 + wikilink + `📄` 재확인.
9. `📄` 클릭 → **새 경로** 에서 원본 오픈 확인.

#### 4.3.2 체크리스트

- [ ] `[vault-events] reconcileExternalRename` 로그 관찰
- [ ] raw 원본 + sidecar `.md` 쌍 이동 확인 (같은 폴더에 두 파일)
- [ ] source-registry.json `vault_path` 최신
- [ ] source-registry.json `path_history` 이전 경로 포함
- [ ] source-*.md frontmatter `vault_path` rewrite
- [ ] Stage 2 질문 재수행 wikilink + `📄` 정상
- [ ] `📄` 클릭 → 새 경로에서 open

### 4.4 Stage 4 — (덤 smoke) §4.5.2 삭제·초기화 UI 노출 확인

**[P3 반영 — codex review]** modal sequence 기준으로 재작성. 파괴 실행은 skip — typing gate 직전까지 확인 후 Cancel.

#### 4.4.1 팔레트 노출 확인

1. 명령 팔레트 (`Cmd+P`) → `Wikey:` 입력 → 목록에 **7 entries 모두 표시** 확인:
   - `Wikey: Delete source (dry-run)`
   - `Wikey: Delete wiki page (dry-run)`
   - `Wikey: Reset wiki + registry`
   - `Wikey: Reset wiki only`
   - `Wikey: Reset registry only`
   - `Wikey: Reset qmd index`
   - `Wikey: Reset settings (data.json)`

#### 4.4.2 Delete modal sequence (각 entry 1회)

**Delete source (dry-run)**:
1. 팔레트에서 entry 선택.
2. `DeleteSourceSuggestModal` (FuzzySuggestModal) 표시 → 임의 source 1건 선택.
3. `DeleteImpactModal` 헤더 (`Delete source: raw/...`) + impact 요약 (N pages / M registry / L backlinks) + 페이지 목록 ≤20 표시 확인.
4. "확인 문자열" input + `Confirm delete` 버튼 `disabled` 확인 (입력 전).
5. 확인 문자열 input 에 **잘못된 문자열** (예: `WRONG`) 입력 → `Confirm delete` 버튼 여전히 `disabled` 확인.
6. **여기서 중단** — `Cancel` 버튼 클릭. 실제 삭제 skip.

**Delete wiki page (dry-run)**:
1. wiki 페이지 하나 활성 상태 (편집기에 open).
2. 팔레트 → entry 선택.
3. `DeleteImpactModal` 표시 + backlink 수 표시 확인 → `Cancel`.

#### 4.4.3 Reset modal sequence (5 scope 각 1회)

각 scope (`wiki+registry` / `wiki-only` / `registry-only` / `qmd-index` / `settings`) 마다:
1. 팔레트에서 해당 `Wikey: Reset <scope>` 선택.
2. `ResetImpactModal` 헤더 한글 라벨 확인 (예: "Reset: wiki + registry (raw/ 유지)").
3. 파일 목록 ≤30 + bytes 표기 확인.
4. 확인 문자열 placeholder 가 `RESET <SCOPE>` 형식임을 확인 (예: `RESET WIKI+REGISTRY`).
5. 입력 없이 `Cancel`.

#### 4.4.4 Settings Tab Reset 섹션

1. Settings → Wikey → "Reset" 섹션 확인 (`renderToolsSection` 다음 위치).
2. Scope dropdown 에 5 option 모두 표시 확인.
3. `Preview & Reset` 버튼 → `ResetImpactModal` 등장 → `Cancel`.

#### 4.4.5 체크리스트
- [ ] 팔레트 7 entries 노출
- [ ] DeleteImpactModal: source 경로, impact 요약, 페이지 목록, typing gate disabled 상태 확인
- [ ] DeleteImpactModal: wiki-page 분기 backlink 수 표시
- [ ] ResetImpactModal: 5 scope 각각 한글 라벨 + bytes + `RESET <SCOPE>` phrase
- [ ] Settings Tab Reset 섹션 dropdown + Preview & Reset 버튼 동작

---

## 5. 파일별 리포트 생성

### 5.1 디렉터리 구조

```
activity/phase-4-smoke-2026-04-24/   # 세션 실행일 (YYYY-MM-DD)
├── README.md                          # 집계 리포트 (통과/실패 매트릭스 + 총평)
├── file-1-llm-wiki.md
├── file-2-사업자등록증-굿스트림.md
├── file-3-계약서-sk바이오텍.md
├── file-4-pms-제품소개.md
├── file-5-hwp-스마트공장.md
├── file-6-hwpx-examples.md
└── dump/                              # (선택) console 로그 tail, screenshot
```

### 5.2 파일별 리포트 템플릿

```markdown
# File <N>: <basename>

## 메타
- 크기 / MIME / 형식:
- Pre-move 경로: raw/0_inbox/<file>
- Post-move 경로: raw/<PARA>/<DDC>/<file>
- source_id (sha256): <16+hex>
- 실행 시작: YYYY-MM-DD HH:MM (한국시간)
- 실행 종료: YYYY-MM-DD HH:MM

## Stage 1 — Ingest
- 변환 tier (label): `1-docling` / `1a-docling-no-ocr` / `1b-docling-force-ocr-scan` / `1b-docling-force-ocr-kloss` / `2-markitdown-ocr` / `3-markitdown` / `unhwp` 중 하나
- 변환 retry 여부 (image-ocr-pollution → no-ocr retry 발생시):
- 변환 시간 (ms): cache miss / cache hit
- 변환 품질 스코어 (0~1):
- Stage 1 summary (앞 300자):
- Stage 2 mentions 수 / evidence PII 유출 점검 (파일 2 전용):
- Stage 3 entities / concepts 수:
- dropped 수 + 사유 (파일 2: `PII-name` 1 건 이상 기대):
- provenance entries 예시 (1 건):
- 분류 depth (N_para / NN_type / NNN_topic 몇 레벨) + 결정 경로 (auto-rule / LLM-3차 / LLM-4차 fallback hint):
- 체크리스트 **14 항목** pass/fail 표:
- **이슈**: (있을 경우)

## Stage 2 — Query
- 질문:
- 답변 요약:
- 답변 소요 (s):
- wikilink 수:
- 📄 citation 수:
- 📄 클릭 결과 (파일 경로 / 앱):
- backlinks 확인 (source-*.md 에서):
- PII 체크 (파일 2 만): pass / fail + 내용
- **이슈**:

## Stage 3 — Pairmove + Re-query
- 이동 전 → 이동 후 경로:
- reconcileExternalRename 로그 (1~2줄 excerpt):
- path_history 업데이트 확인:
- source 페이지 frontmatter rewrite 확인:
- 재질의 답변 일관성 (Stage 2 답변과 비교 — 의미 동등):
- 📄 새 경로 클릭 정상:
- **이슈**:

## 종합
- Stage 1 / 2 / 3 각 pass / fail / partial
- 종합 판정: PASS / FAIL / WARN
- Root cause + 후속 조치 (FAIL 시)
```

### 5.3 README.md (집계) 템플릿

```markdown
# Phase 4 통합 smoke 결과 집계 (YYYY-MM-DD)

## 매트릭스

| # | 파일 | Stage 1 | Stage 2 | Stage 3 | 종합 |
|---|------|---------|---------|---------|------|
| 1 | llm-wiki.md | ✅ | ✅ | ✅ | PASS |
| 2 | 사업자등록증 | ... | ... | ... | ... |
| ...

## 총 통계
- 변환 tier 분포 (세분): `1-docling` N / `1a-docling-no-ocr` N / `1b-docling-force-ocr-scan` N / `1b-docling-force-ocr-kloss` N / `2-markitdown-ocr` N / `3-markitdown` N / `unhwp` N
- 분류 depth 분포: 1-level N / 2-level N / 3-level N · auto-rule N / LLM-3차 N / LLM-4차 N
- 총 생성 페이지 수 (sources/entities/concepts):
- 총 provenance entries:
- 총 dropped (schema-invalid) + 사유 집계 (PII-name / UI-label / Korean-only 등):
- 총 LLM 토큰 소비 (provider 별):
- 총 실행 시간:
- PII 노출 사건: 0 / 발생 (발생시 root cause + rollback 조치 기록)

## Phase 별 통과 요약
- Phase 4.0 UI: ...
- Phase 4.1 변환: ...
- Phase 4.2 분류/이동/registry: ...
- Phase 4.3 인제스트+citation: ...
- Phase 4.5.2 덤 smoke: ...

## 후속 조치
- (FAIL 이슈 → plan/phase-4-todo.md 에 fix 항목 추가)
- (WARN → session-wrap-followups 이관)

## Phase 4 본체 완성 판정
- [ ] 6/6 파일 PASS → D 본체 완성 선언 수행 가능
- [ ] N/6 PASS → 잔여 항목 먼저 fix
```

---

## 6. Acceptance Criteria (6/6 PASS 기준)

- **필수 (Critical)**:
  - 6/6 파일 Stage 1 PASS (변환 + ingest + 자동 분류 + 페어 이동)
  - 6/6 파일 Stage 2 PASS (답변 생성 + wikilink ≥1 + `📄` 렌더)
  - 6/6 파일 Stage 3 PASS (pairmove 후 citation 재기능)
  - PII 노출 0건 (파일 2 사업자등록증)
  - Console `ERROR` 0건 (WARN 는 허용)

- **권장 (Recommended)**:
  - 변환 품질 스코어 ≥ 0.7 (모든 파일)
  - Stage 3 답변이 Stage 2 답변과 의미 동등
  - Stage 4 덤 smoke 4/4 UI 노출

- **실패 시 처리**:
  - Critical 1건 이상 FAIL → Phase 4 본체 완성 선언 **보류**. fix 후 재측정.
  - Recommended 만 FAIL → WARN 로 집계, session-wrap-followups 에 이관 후 본체 선언 진행.

---

## 7. 실패 시 디버깅 순서

1. 변환 실패 → Settings → Env Status → docling/unhwp 재설치 (Homebrew `uv tool install docling` / `pip install unhwp`).
2. LLM 실패 → Settings → API Keys 확인 + `check-providers.sh` + Ollama `ps`.
3. Stage 1/2/3 timeout → Developer Console `[Wikey ingest]` stderr 확인.
4. citation 미렌더 → `attachCitationBacklinks` 브레이크포인트 + `provenance` frontmatter 직접 확인.
5. pairmove 실패 → `[vault-events]` 로그 + `source-registry.json` 직접 조회 + `renameGuard.consume` 타이밍 확인.
6. PII 노출 → 즉시 wiki 페이지 rollback + `check-pii.sh` 로 재검증 + root cause (Stage 1 prompt 누출인지 Stage 3 inferred 인지 구분).

---

## 8. 소요 시간 예상

- Pre-flight 정리: 10 분
- 파일당 Stage 1~3: 15~25 분 × 6 = 90~150 분
- Stage 4 덤 smoke: 10 분
- 리포트 작성: 30 분
- **총계**: 2 시간 20분 ~ 3 시간 20분

한 세션 내 완결 가능. 중간에 Obsidian 재시작이 필요하면 session-wrap-followups 에 재현 체크포인트 기록.

---

## 9. 다음 단계

통합 smoke 통과 → **Phase 4 본체 완성 선언 (D 블록)** — `plan/phase-4-todo.md` Phase 4 본체 완성 체크리스트 D.1~D.5 실행. 집계 README 의 "Phase 4 본체 완성 판정" 블록이 그 트리거.

---

## 10. 변경 이력

- **v1** (2026-04-23 session 5): 초안 작성.
- **v2** (2026-04-23 session 5): codex (gpt-5.4 xhigh, Panel Mode D) 피어리뷰 반영.
  - 초기 VERDICT **REJECT** (4 P1 블로커) → v2 반영 후 codex 명시 VERDICT **APPROVE-WITH-CHANGES**.
  - **P1 4건 수용**:
    - (A) 실행 경로 고정 — §4.1.1 에서 Audit 패널만 사용, Ingest 패널 / Cmd+Shift+I / URI 는 auto-move skip 으로 금지 명시.
    - (B) Clean-slate + Settings baseline — §2.1 을 2.1.1 fs clean-slate / 2.1.2 Settings 고정 (Ingest Briefs=Always, Verify=ON, Auto Ingest=OFF) / 2.1.3 Cmd+R / 2.1.4 종료 복원 으로 확장.
    - (C) Index-ready gate — §4.1.3 신규 (qmd reindex fire-and-forget 대응, `reindex.sh --check stale=0` 확인 gate).
    - (D) 파일 2 PII redaction 규칙 — §3.2 신규 (PII 정의 · Stage 별 검증 · rollback 절차) + §4.2.2 질문 재작성 (대표자 정보 요청 제거).
  - **P2 3건 수용**:
    - 파일별 프로파일 실측 보정 — 계약서 PDF 6p / PMS 31p / `1b-docling-force-ocr-scan` · `image-ocr-pollution → 1a-docling-no-ocr` 분기 명시.
    - 분류 depth 기록 강화 — NN_type / NNN_topic + auto-rule vs LLM-3차/4차 fallback 구분 (체크리스트 + 리포트 템플릿).
    - Phase 4.0 UI pre-smoke — §4.0 신규 (파일 루프 전 1회).
  - **P3 3건 수용**:
    - Stage 4 삭제/초기화 modal sequence 재작성 (4.4.1~4.4.5 — 팔레트 노출 → Delete/Reset modal → typing gate 직전 Cancel).
    - 체크리스트 13 → **14 항목** + 실제 tier 이름 (`1-docling` / `1a-docling-no-ocr` / `1b-docling-force-ocr-scan` / `1b-docling-force-ocr-kloss` / `2-markitdown-ocr` / `3-markitdown` / `unhwp`) 현행화.
    - 로그 문자열 현행화 (`tier N/6 start`, `[Wikey classify] LLM fallback: ...`, `cache hit — pdf:N-docling`).
  - 리포트 README 총 통계: tier 분포 세분 + 분류 depth 분포 + dropped 사유 집계 추가.
