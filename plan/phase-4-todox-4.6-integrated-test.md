# Phase 4 통합 smoke 테스트 계획서 (v6 — IV.A 관찰 강등 + snippet 복붙 실행 가능)

> **상위 문서**: [`activity/phase-4-result.md`](../activity/phase-4-result.md) · [`plan/phase-4-todo.md`](./phase-4-todo.md) — 본 문서는 §4.6 (통합 smoke 테스트 계획서 v6) 보조 자료. 명명규칙: `phase-N-todox-<section>-<topic>.md` / `phase-N-resultx-<section>-<topic>-<date>.md` — `CLAUDE.md §문서 명명규칙·조직화` 참조.

> **체크박스 주의**: 본 문서 내부의 `- [ ]` 는 설계 당시의 플래닝 아티팩트이며 **실 todo 아님**. 실제 추적은 `plan/phase-N-todo.md` 의 해당 section 에서 수행. (sync 스킬 Phase 0-4.6 의 "미이관 결정 케이스" — historical plan)


> **목적**: Phase 1~4 본체 완성 직전의 통합 회귀 smoke. Phase 4.0/4.1/4.2/4.3/4.5 의 모든 사용자 경로가
> 6종 서로 다른 스타일의 문서를 재료로 실 사용자 시나리오 (파일 선택 → 변환 → ingest → 분류 → 질의·답변 → 보조 링크 → 임의 이동 후 재질의) 에서 정상 동작하는지 확인.
>
> **작성일**: 2026-04-23 session 5
> **상태**: v6 — v3/v4/v5 REJECT 피드백 반영 최종 계획서. v1~v5 상세는 §11 변경 이력.
> - **v6 핵심**:
>   - 실행 주체 = **Claude (CDP + wikey-cdp.py)**. 순차 실행, DOM·API 우회 금지, `app.fileManager.renameFile` 등 Obsidian API 직접 호출 금지 (UI event only).
>   - 구조 = **2-pass, 양 패널 모두 Ingest 1-click**. Pass A (Ingest 패널, view-side handler `runIngest+movePair`) · Pass B (Audit 패널, core `autoMoveFromInbox:true` 경로). Move 버튼 별도 click 없음.
>   - **selector 카탈로그 실사 기반** (§7.3 실제 DOM 검증됨): aria-label 매칭 / `.wikey-audit-row` + `.wikey-audit-name` 텍스트 매칭 / modal 3 phase DOM 존재 / 버튼 textContent / Notice 실 문자열 (`"N files ingested"` / `"N completed"`).
>   - **Stage 3 분리 + 강등**: IV.A (실행 중 shell mv 관찰, **WARN 허용** — vault watcher 감지 여부는 코드상 결정적이지 않음) + IV.B (종료 → mv → 재시작 → `registryReconcile`, **주 판정축**, registry before/after diff 1차 기준).
>   - **snippet 복붙 실행 가능**: wait helper 는 boolean expression 만, `const ...; return ...` statement block 은 helper (`waitForLog`, `waitForNoticeText`) 또는 IIFE 로 대체. XPath 문법 없음.
>
> **수립 근거**: `plan/phase-4-todo.md` Phase 4 본체 완성 체크리스트 **A** 확장. 단일 경로 smoke 가 제품 전체를 커버하지 못한다는 사용자 지적 반영 — Ingest 패널 (대부분의 실사용 경로) 과 Audit 패널 (운영자 감사 경로) 양쪽 모두 검증해야 분석 결과가 신뢰된다.
> **자동화 제약**: UI event 시뮬레이션 허용. **DOM·wikey-core API 우회 금지**. 파일별 리포트 + pass 별 리포트 필수.

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
| Git HEAD | `4e458aa` 이후 (v2 기준) | `git log -1 --format=%h` |
| Obsidian | **1.12.x 실행 + `--remote-debugging-port=9222 --remote-allow-origins=*`** | 시작 플래그 적용된 런처 실행 |
| CDP 접근 | `localhost:9222/json` 이 target 리스트 반환 | `curl -s localhost:9222/json \| head -40` |
| wikey-cdp.py | `/tmp/wikey-cdp.py` 존재 + `websocket` 모듈 | `python3 -c 'import websocket'` |
| 플러그인 리로드 | Cmd+R 1회 수행 | 플러그인 리스트에서 wikey enabled 확인 |
| docling | 설치됨 (Settings → Env Status) | "v<x.y.z>" 표기 |
| unhwp | 설치됨 (Settings → Env Status) | "Installed" 표기 |
| Ollama or Gemini | 1 종 이상 동작 | `./scripts/check-providers.sh` 또는 Settings Env Status |
| inbox 파일 | 6종 배치 | `ls raw/0_inbox/` 6 개 확인 |
| inbox 백업 | 2-pass 간 원복 용 | `cp -a raw/0_inbox/ /tmp/wikey-smoke-inbox-backup/` |
| wiki 상태 | entities/concepts/sources 비어있음 (analyses 1건 `self-extending-wiki.md` 제외) | `ls wiki/` |
| source-registry.json | 비어있음 또는 `{}` | `cat wiki/.wikey/source-registry.json 2>/dev/null` |
| qmd 인덱스 | 재빌드 권장 (clean slate) | `./scripts/reindex.sh --check` |

> **왜 CDP 를 쓰는가 (실행 주체 Claude 의 기술적 전제)**: Claude 가 사용자처럼 Obsidian 을 조작하려면 실제 click/keydown/input 이벤트를 발행할 채널이 필요하다. macOS 접근성 (cliclick/osascript) 은 해상도·윈도우 위치에 취약해 재현성이 낮다. CDP `Runtime.evaluate` 로 `btn.click()` · `inputEl.dispatchEvent(new KeyboardEvent(...))` 를 호출하면 **Obsidian 내부 listener 가 실제 사용자 이벤트와 동일하게 수신**한다 (userGesture: true). 단, 이 채널로 **플러그인 내부 상태 직접 수정 (e.g. `plugin.settings.autoMoveFromInbox = true`) · 함수 직접 호출 (e.g. `classifyFileAsync(...)`) 은 금지** — 순수 UI event 만.

### 2.1 Clean-slate + Settings Baseline (Pass A 시작 전 · Pass B 시작 전 각 1회)

**[P1 반영 — codex v2 review + v3 2-pass 요구]** 양 pass 간 **완전 clean-slate** 재사용. Pass A 완료 리포트만 보존, 나머지 vault 상태는 초기 상태로 복구 후 Pass B 진입.

#### 2.1.1 fs/인덱스 clean-slate 스크립트 (`scripts/smoke-reset.sh` — registry 기반 teardown 포함)

**[v4 codex REJECT 수용]** Pass A 에서 PARA 하위로 이동된 파일을 **registry `path_history` 기반으로 역추적** 해 정확히 해당 파일만 삭제. 기존 raw/ 무관 파일은 건드리지 않음. wiki/index.md 와 wiki/log.md 도 양 pass 간 동일 baseline 유지 (`git checkout` 으로 HEAD 복원).

```bash
#!/usr/bin/env bash
# scripts/smoke-reset.sh — Phase 4 통합 smoke clean-slate helper (v6)
# 사용법:
#   smoke-reset.sh init           (smoke 착수 전 1회 — 현재 inbox 를 backup)
#   smoke-reset.sh between-pass   (Pass A 종료 후 · Pass B 시작 전)
#   smoke-reset.sh final          (Pass B 종료 후 — analyses 복원 + backup 삭제)
set -euo pipefail

REPO="/Users/denny/Project/wikey"
BACKUP="/tmp/wikey-smoke-inbox-backup"
ANALYSES_BAK="/tmp/self-extending-wiki.bak.md"
REG="wiki/.wikey/source-registry.json"

cd "$REPO"

teardown_moved_files() {
  # registry 의 각 레코드의 최종 vault_path + sidecar 를 삭제 (smoke 에서 이동된 것만).
  # registry 가 없으면 skip.
  [ -f "$REG" ] || return 0
  python3 - <<'PY'
import json, os, pathlib
reg_path = "wiki/.wikey/source-registry.json"
try:
    reg = json.load(open(reg_path))
except Exception:
    reg = {}
for _id, r in reg.items():
    vp = r.get("vault_path", "")
    sp = r.get("sidecar_vault_path", "")
    for p in (vp, sp):
        if p and p.startswith("raw/") and os.path.isfile(p):
            try: os.remove(p); print(f"  removed: {p}")
            except Exception as e: print(f"  skip: {p} ({e})")
PY
}

case "${1:-between-pass}" in
  init)
    # smoke 최초 1회 — 현재 0_inbox 를 backup + wiki analyses backup
    [ -d "$BACKUP" ] && { echo "ERROR: $BACKUP exists — run 'final' or delete first"; exit 2; }
    mkdir -p "$BACKUP"
    cp -a raw/0_inbox/. "$BACKUP"/
    [ -f wiki/analyses/self-extending-wiki.md ] && cp wiki/analyses/self-extending-wiki.md "$ANALYSES_BAK"
    echo "OK: init done (inbox backed up to $BACKUP, analyses to $ANALYSES_BAK)"
    ;;

  between-pass)
    # 1. registry 기반 이동 파일 정리 (wiki 폴더 비우기 전에 먼저 — registry 참조 필요)
    teardown_moved_files
    # 2. wiki 본문 전부 비우기 (양 pass 동일 baseline)
    rm -f wiki/sources/*.md wiki/entities/*.md wiki/concepts/*.md wiki/analyses/*.md
    # 3. wiki/index.md, wiki/log.md 를 HEAD (git) 상태로 복원 — Pass A 흔적 제거
    git checkout -- wiki/index.md wiki/log.md 2>/dev/null || echo "  note: git checkout skipped (no such files in HEAD)"
    # 4. registry 초기화
    rm -f "$REG"
    # 5. qmd 인덱스 purge
    ./scripts/reindex.sh --purge >/dev/null
    # 6. inbox 복원 ($BACKUP → raw/0_inbox)
    rm -rf raw/0_inbox/*
    cp -a "$BACKUP"/. raw/0_inbox/
    # 7. 빌드 · 테스트 확인
    npm run build >/dev/null && npm test --silent >/dev/null
    echo "OK: between-pass clean-slate complete"
    ;;

  final)
    # 모든 smoke 종료 후 — analyses 복원 + backup 삭제
    [ -f "$ANALYSES_BAK" ] && cp "$ANALYSES_BAK" wiki/analyses/self-extending-wiki.md
    rm -f "$ANALYSES_BAK"
    rm -rf "$BACKUP"
    echo "OK: final cleanup done (analyses restored, backup removed)"
    ;;

  *)
    echo "usage: $0 {init|between-pass|final}" >&2; exit 2
    ;;
esac
```

**사용 순서** (중요: `between-pass` 와 `final` 은 **Obsidian 종료 후** 실행 — live vault watcher 가 raw/wiki change 에 반응하면 `vault.on('delete'|'create')` 가 race 를 만듦):

```bash
# 1. 최초 1회 (Obsidian 실행 여부 무관)
bash scripts/smoke-reset.sh init

# 2. Pass A 수행 — Obsidian 실행
open -a Obsidian --args --remote-debugging-port=9222 --remote-allow-origins=*

# 3. Pass A 완료 + pass-a-readme 작성 → IV.B (Pass A teardown) → **Obsidian 종료**
osascript -e 'quit app "Obsidian"'
sleep 3

# 4. Pass A → Pass B 전환 clean-slate (앱 종료 상태에서 실행)
bash scripts/smoke-reset.sh between-pass

# 5. Pass B 수행 — Obsidian 재시작
open -a Obsidian --args --remote-debugging-port=9222 --remote-allow-origins=*

# 6. Pass B 완료 + pass-b-readme + cross-compare → IV.B (Pass B teardown) → §4.C 덤 smoke

# 7. 모든 smoke 종료 후 → **Obsidian 종료** → final cleanup
osascript -e 'quit app "Obsidian"'
sleep 3
bash scripts/smoke-reset.sh final
```

#### 2.1.2 변경 파일 검증 (clean-slate 직후)

```bash
ls raw/0_inbox/ | wc -l   # 6 (원본 복원 확인)
find raw/1_projects raw/2_areas raw/3_resources raw/4_archive -name "$FILENAME*" 2>/dev/null   # 이동된 파일 0개
ls wiki/sources/ wiki/entities/ wiki/concepts/ wiki/analyses/ 2>/dev/null | wc -l   # 0
cat "$REG" 2>/dev/null || echo "(absent — OK)"
./scripts/reindex.sh --check   # 인덱스 empty 확인
git diff --stat wiki/index.md wiki/log.md   # 두 파일 HEAD 상태 (변경 없음)
```

#### 2.1.3 Obsidian Settings 고정 (Wikey Settings Tab)

| 항목 | 값 | 이유 |
|------|----|----|
| **Ingest Briefs** | `Always` | Stay-involved modal (Brief 단계) 가 반드시 뜨도록 고정. `Never`/`Session` 은 Brief phase skip. |
| **Verify results before writing** | `ON` | Stay-involved Preview 단계를 강제. off 면 Preview 미표시 → plan 가정 위배. |
| **Auto Ingest** | `OFF` | inbox watcher 의 자동 트리거 차단. 수동 클릭 시나리오만 재현. |
| **Basic Model / Ingest Provider** | 세션 시작 시 값 기록 | 리포트에 provider/model 명시. |
| **Extraction Determinism** | 그대로 (OFF 기본) | 결정성 측정은 Phase 5, smoke 는 실 사용 조건. |

#### 2.1.4 플러그인 reload

```
Obsidian: Cmd+R
```

- 세션 내 `skipIngestBriefsThisSession` latch 초기화 (Stage 1 Brief 의 "Skip this session" 클릭이 없었던 상태로 보장).
- 변경된 Settings 이 `buildConfig()` 에 반영되도록.

#### 2.1.5 종료 후 복원 절차 (smoke 완전 종료 시)

```bash
bash scripts/smoke-reset.sh final
# (analyses 복원 + backup/analyses-bak 삭제. registry/wiki 는 smoke 결과 그대로 보존)
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

#### 3.2.2 Stage 별 검증 (check-pii.sh 현황 반영)

**[v4 codex REJECT 수용]** `scripts/check-pii.sh` 는 현재 `wiki/` 하드코딩 전체 스캔만 지원 (인자 불수용, 전화번호/이메일/주민번호 3 패턴). **사업자번호는 미커버**. 변환 산출물 단일 파일 검사는 별도 inline grep 패턴으로 대체. `canonicalizer.ts` 에 `PII-name` drop reason 은 **없음** — dropped 분포를 PII 단서로 쓰려던 기존 가정 철회, 생성된 wiki 페이지 수동 grep 으로 검증.

**공통 PII grep 패턴** (Stage 1/2/3 에서 재사용):

```bash
# 리포트에 기록할 공통 regex
RRN='[0-9]{6}-[1-4][0-9]{6}'                    # 주민등록번호
BRN='[0-9]{3}-[0-9]{2}-[0-9]{5}'                # 사업자등록번호
PHONE='(010|02|031|032|0[3-9][0-9])-[0-9]{3,4}-[0-9]{4}'
EMAIL='[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
# 주소: (a) 도로명 주소 — "<지명> <로/길> <숫자>[,숫자]" 형식 (예: 충청북도 청주시 흥덕구 공단로 134,613)
# (b) 지번 주소 — "<시/도> ... <시/군/구> ... <숫자>번지|<숫자>-<숫자>"
ADDR_ROAD='[가-힣]+[로길]\s*[0-9]+(,[0-9]+)?(\s*\([가-힣]+\))?'
ADDR_LOT='(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충[북남]|전[북남]|경[북남]|제주).*(시|군|구)[^가-힣]*[0-9]+(번지|-[0-9]+)'
ADDR="($ADDR_ROAD|$ADDR_LOT)"
# CEO 성명은 source 마다 다름 — 파일 2 전용으로 굿스트림 대표자 이름을 smoke 실행 전 별도 확인.
```

검증 시점:

- **Stage 1a (변환 직후, LLM 투입 전)**:
  - 변환 산출물 `.wikey/cache/convert/*/out.md` 또는 임시 변환 결과 — 인자 기반 grep:
    ```bash
    CONVERTED=$(find .wikey/cache/convert -name 'out.md' -newer <마커> | head -1)
    egrep -nE "$RRN|$BRN|$ADDR|$PHONE" "$CONVERTED" && echo "PII in converted.md" || echo "clean"
    ```
  - RED 시: 변환은 완료됐으나 Stage 2/3 LLM 투입 전에 사용자에게 경고 후 진행 여부 결정. 단, smoke 목적으로는 **그대로 진행** — LLM 이 Stage 3 에서 걸러내는지가 검증 포인트.

- **Stage 1 완료 후 (wiki 페이지 쓰기 직후)**:
  - `./scripts/check-pii.sh` 실행 → wiki/ 전체 스캔. RED 시 파일 2 rollback (§3.2.3).
  - **사업자번호 패턴 추가 검증**: `egrep -rE "$BRN" wiki/sources/ wiki/entities/ wiki/concepts/` (check-pii.sh 가 이 패턴을 잡지 못하므로).

- **Stage 2 mentions 로그 덤프**:
  - `window._wikeyLog` 에서 Stage 2 출력을 dump → `pass-<a|b>-file-2-stage1.log` 에 저장 → PII regex grep.
  - evidence 필드에 PII 발견 시 Stage 3 가 해당 mention 을 dropped 에 넣었는지 Stage 3 로그 확인.

- **Stage 3 canonicalize 결과**:
  - `wiki/entities/*.md`, `wiki/concepts/*.md` 에 PII-bearing 페이지 생성 여부. 사업자번호/주민번호/CEO 성명이 **filename 또는 본문** 에 포함됐다면 FAIL.
  - `dropped` 통계는 일반 사유 (UI-label, Korean-only, Unknown 등) 만 확인. `PII-name` 같은 전용 reason 은 현재 canonicalizer 에 없으므로 기대하지 않음.

- **Stage 2 질의/답변**:
  - 질문: `"굿스트림 법인의 업종과 소재지(시/도 수준)는?"` 으로 강제 (§4.Common.Q 파일 2).
  - 답변 본문 dump → 위 4가지 regex grep. 포함 시 FAIL + §3.2.3 rollback.

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

## 4. 테스트 단계 (2-pass)

### 4.0 UI pre-smoke (Pass A 진입 전 1회만)

Phase 4.0 UI 항목은 파일 단위 반복 불필요. Pass A 시작 전 1회 고정 체크 (Pass B 재진입 시 skip — clean-slate 가 Settings 는 건드리지 않으므로 UI 상태 유지됨).

절차:
1. Obsidian 사이드바에서 Wikey 리본 클릭 → Chat 패널 기본 활성 확인.
2. Chat 패널 하단 provider / model `<select>` 2개 모두 **편집 가능**, provider 변경 시 model 리스트 자동 재로딩 확인.
3. Audit 패널 / Ingest 패널 각각 클릭 → 패널 하단에 **"Default AI Model : provider | model"** readonly bar 표시 확인.
4. Audit 패널 inbox 리스트에서 "DEFAULT" 라벨 일관성 확인.
5. 새 세션 (vault 처음 열기) 이면 사이드바 초기 폭 500px 확인.
6. Chat `/clear` 동작 확인.

체크리스트 6 항목. FAIL 시 Pass A/B 모두 진입 금지.

---

### 4.Common — 공통 Stage 절차 (Pass A/B 모두 참조)

각 Pass 안의 파일 루프는 아래 4 Stage 를 순차 적용. Pass A 와 Pass B 의 **차이는 §4.A.entry / §4.B.entry** 진입 단계에만 있고, 이후 Stage I/II/III 는 동일.

#### 4.Common.I — Stage 1 core (Brief → Processing → Preview → Confirm)

**Ingest 버튼 click 직후** 공통 플로우:

1. **Brief 단계** — `IngestFlowModal` 렌더 대기 (Ollama cold start 시 ~30s). CDP 로 `.wikey-ingest-flow-modal .wikey-modal-brief` 존재 + `.wikey-modal-brief-loading` class 사라질 때까지 polling. 텍스트 ≥ 30자 확인 후 `guide textarea` (`.wikey-modal-textarea`) 공란 유지 → Modal 안 `button` textContent="Proceed" click (`.mod-cta`).
2. **Processing 단계** — `.wikey-modal-processing` DOM 존재 확인. 진행 bar 는 `.wikey-modal-progress-bar` / 퍼센트 `.wikey-modal-progress-pct`. Preview phase 로 전환될 때까지 polling (= `.wikey-modal-plan-list` 렌더). OCR 대형 PDF 는 ≤ 600s 허용.
3. **Preview 단계** (verifyIngestResults=ON baseline) — source 페이지 요약 + entity/concept 리스트 (`.wikey-modal-plan-list`) 확인 후 Modal 안 `button` textContent="Approve & Write" click.
4. **Modal 닫힘 대기** — `.wikey-ingest-flow-modal` 사라질 때까지 polling.
5. **완료 Notice** — Pass A (Inbox): `.notice` textContent 에 `"files ingested"` 포함 대기. Pass B (Audit): `.notice` textContent 에 `"completed"` 포함 대기. 실패 시 `"Done X / Failed Y"` 또는 `"Done X / Cancelled Y"`. **주의**: `"인제스트 완료: N개 페이지"` 는 Cmd+Shift+I 경로의 문자열 — 본 smoke 에서는 안 뜸.
6. **Developer Console 로그 덤프** — `[Wikey convert] tier N/6 start ...` / `[Wikey classify] LLM fallback: ...` / `[Wikey] post-ingest movePair: ...` (Pass A) / `[Wikey ingest] auto-moved to PARA: ...` (Pass B) 추출.

체크리스트 (14 항목, §4.Common.I.check 로 리포트에 기록):
- [ ] 변환 tier-label (`1-docling` / `1a-docling-no-ocr` / `1b-docling-force-ocr-scan` / `1b-docling-force-ocr-kloss` / `2-markitdown-ocr` / `3-markitdown` / `unhwp`)
- [ ] 변환 retry 여부 (`image-ocr-pollution → 1a-docling-no-ocr`)
- [ ] 변환 시간 (cache miss / hit `— pdf:N-docling`)
- [ ] 변환 품질 스코어 (`convert-quality` 0~1)
- [ ] bitmap OCR 본문 오염 없음 (§4.1.3)
- [ ] Stage 1 summary 글자수 (기대 300~600)
- [ ] Stage 2 mentions 수 (≥3) + evidence PII 점검 (파일 2)
- [ ] Stage 3 entities / concepts 수
- [ ] `dropped` 수 + 사유 분포 (UI-label / Korean-only / Unknown / 기타 — 파일 2 는 사업자번호·주민번호를 포함한 mention 이 dropped 로 갔는지 evidence 확인, canonicalizer 는 PII 전용 reason 없음)
- [ ] provenance entries 수 (entity/concept 페이지마다 ≥1)
- [ ] source 페이지 본문 wikilink 유효성 (§4.3.3)
- [ ] 자동 분류 PARA/DDC depth + 경로 (auto-rule / LLM-3차 / LLM-4차) — 양 pass 모두 Ingest 1-click 후 handler 완료 시점 기록 (Pass A = `post-ingest movePair` 로그, Pass B = `auto-moved to PARA` 로그)
- [ ] raw 파일 + sidecar pair 이동
- [ ] source-registry.json + index.md + log.md 갱신

#### 4.Common.II — Index-ready gate (Stage 1 → 2 사이 반드시 통과)

Ingest 완료 직후 qmd reindex 는 **background fire-and-forget** (`ingest-pipeline.ts:425,1823`). Stage 2 는 인덱스 최신임이 확인된 뒤에만.

1. Notice 표시 후 `./scripts/reindex.sh --check` → `stale=0` 확인.
2. 확인 전 Stage 2 실패는 "setup fail: reindex not ready" 로 분류.

#### 4.Common.III — Stage 2 (Wiki 검색, 공통 절차)

1. Chat 패널 click → 메시지창에 §4.Common.Q 질문 타이핑 → Enter.
2. 답변 대기 (~3~15s).
3. 답변의 `[[wikilink]]` 수 세기.
4. 각 wikilink 뒤 `📄` 아이콘 렌더 확인 (`.wikey-citation-link`).
5. wikilink click → wiki/*.md 오픈 확인.
6. `📄` click → 원본 파일 오픈 확인 (내장 또는 외부).
7. wiki 페이지 하나 열어 Backlinks 패널에 source-*.md 역참조 확인.

체크리스트 (9 항목, §4.Common.III.check):
- [ ] 답변 생성 (≥2문장)
- [ ] wikilink ≥1
- [ ] `📄` 렌더
- [ ] wikilink click → wiki 오픈
- [ ] `📄` click → 원본 오픈
- [ ] source-*.md backlinks 노출
- [ ] 답변 소요 시간
- [ ] 사실 정확성 spot check
- [ ] (파일 2) PII 노출 없음

#### 4.Common.IV — Stage 3 (Pairmove + Re-query)

**[codex review v4 수용]** 두 경로가 실제 코드에서 **다른 handler** 를 탄다:
**[v6 재설계 — codex v5 REJECT 수용]** 코드 주석 (main.ts:182 "사용자 UI 이동은 reconcileExternalRename 로 처리" + main.ts:212 "bash/Finder 외부 이동/삭제 누락 복구 (startup reconcile)") 이 두 경로를 분리한다. **실행 중 shell mv 가 `vault.on('rename')` 으로 반드시 잡힌다는 보장이 코드상 없음** — Electron vault watcher 가 external fs change 를 rename 이벤트로 올릴지 아니면 delete+create 로 올릴지 결정적이지 않다. 따라서:

- **IV.A (보조 관찰, WARN 허용)**: Obsidian 실행 상태에서 shell mv → vault watcher 가 감지하면 `vault rename reconciled:` 로그 발생 → PASS. **감지 안 되면 FAIL 이 아닌 WARN** + Phase 5 §5.3 (증분 업데이트 경로 강화) 과제로 이관. Stage 3 주 판정에는 영향 없음.
- **IV.B (주 판정, PASS 필수)**: Obsidian **종료 후** shell mv → 재시작 시 `registryReconcile(walker)` 가 누락 복구 수행 (main.ts:308~336). 이 경로는 코드상 명시적으로 external fs 이동을 다루므로 결정적이다. **1차 판정은 `wiki/.wikey/source-registry.json` 의 `path_history` 에 새 경로가 append 됐는지 (bash 로 확인)** — 로그는 보조 증거.

둘 다 **shell mv** 를 사용 — `app.fileManager.renameFile` 같은 Obsidian JS API 호출은 "UI event only" 제약 위반이므로 사용 금지.

두 경로는 판정 기준도 다름 — 본 smoke 는 **3a 만 파일별 루프 안에서 수행**. 3b 는 **Pass A/B 각 종료 시 1회씩** 별도 서브-smoke.

##### 4.Common.IV.A — 실행 중 shell mv 관찰 (보조, WARN 허용)

각 파일 루프의 Stage 3 끝에 수행. 감지 안 되면 Stage 3 전체 FAIL 이 아닌 WARN + Phase 5 과제. 검증 축은 "실행 중 external change 를 vault watcher 가 rename 이벤트로 올리는가?".

1. Obsidian **실행 상태** 유지. 현재 경로 조회 (`source-registry.json`) 후 터미널에서 `mv <cur_path> <new_path>` + sidecar 동반.
2. CDP `waitForLog 'vault rename reconciled:' 30` 수행.
3. **감지 성공** → 다음 step:
   - `source-registry.json` `path_history` 에 이전 경로 append 확인
   - Stage 2 동일 질문 재입력 + `📄` click 새 경로 open
   - IV.A.check PASS
4. **감지 실패 (timeout)** → `WARN: IV.A runtime watcher 미감지 (`, `Phase 5 §5.3 이관)` 리포트에 기록 + Stage 3 전체 판정은 IV.B 결과로 결정. 파일은 실제로는 이미 이동된 상태.

##### 4.Common.IV.B — 종료 상태 shell mv + 재시작 reconcile (주 판정, Pass A/B 각 종료 시 1회)

대상: 6 파일 중 임의 1건 (IV.A 에서 이동된 파일이 있으면 그것을 재사용). Pass 루프 후 `4.A.teardown` / `4.B.teardown` **전**에 수행.

1. Obsidian 완전 종료 (`osascript -e 'quit app "Obsidian"' && sleep 3`). CDP 끊김 확인 (`curl -sS localhost:9222/json` → connection refused).
2. Finder/shell 로 `raw/<PARA>/<DDC>/<file>` + sidecar `.md` 를 다른 PARA 로 `mv`.
3. `source-registry.json` 의 before snapshot 저장 (`jq '.' > /tmp/reg-before.json`).
4. Obsidian 재시작 (`open -a Obsidian --args --remote-debugging-port=9222 --remote-allow-origins=*`). CDP 재연결까지 polling.
5. Obsidian 이 `onload` 에서 `registryReconcile(walker)` 수행 (main.ts:308~336).
6. **1차 판정 (필수)**: 재시작 후 5~10초 대기 → `jq '.' wiki/.wikey/source-registry.json > /tmp/reg-after.json` → `diff /tmp/reg-before.json /tmp/reg-after.json` 으로 해당 `source_id` 의 `vault_path` 갱신 + `path_history` 에 이전 경로 append 확인. 이 확인이 Stage 3 주 판정.
7. **2차 보조 (있으면 기록, 없어도 OK)**: CDP `init-log` 설치 후 `capture-logs | grep 'startup reconcile complete'` 즉시 조회. init-log 는 재시작 후 설치라 onload 단계 로그는 놓칠 수 있음 — race 인정, 로그 유무가 판정에 영향 없음.
8. Stage 2 동일 질문 재입력 + `📄` click → 새 경로 open.

체크리스트 (§4.Common.IV.B.check):
- [ ] registry before/after diff 로 `vault_path` 갱신 확인 (1차, 필수)
- [ ] `path_history` 에 이전 경로 append
- [ ] sidecar `.md` 동반 이동
- [ ] source 페이지 frontmatter `vault_path` rewrite
- [ ] `📄` click 새 경로 open
- [ ] (보조) `startup reconcile complete` 로그 — 없어도 OK

**두 서브-smoke 의 판정 기준** (v6 재정의):
- **IV.A (WARN 허용)**: 실행 중 mv 가 rename watcher 에 잡히는지 **관찰**. 잡히면 PASS, 안 잡히면 WARN + Phase 5 §5.3 fix 과제. Stage 3 주 판정에 영향 없음.
- **IV.B (PASS 필수)**: 종료 → mv → 재시작 → registryReconcile 로 복구. 1차 판정은 registry before/after diff. Stage 3 주 판정 축.
- **Acceptance**: IV.B 6/6 파일 중 Pass A·B 각 1건씩 **총 2건 PASS 필수** (샘플링). IV.A 는 각 파일별로 수행하지만 PASS·WARN 여부만 기록, 실패해도 blocking 아님.

#### 4.Common.Q — 파일별 질문 (Pass A/B 공통, 고유 질문 1건/파일)

| # | 파일 | 질문 |
|---|------|------|
| 1 | llm-wiki.md | "Karpathy 가 제안한 LLM wiki 가 기존 RAG 와 차별화되는 핵심 원리는?" |
| 2 | 사업자등록증 굿스트림 | "굿스트림 법인의 업종과 소재지(시/도 수준)는?" (**PII 강제** — §3.2 규칙. 대표자 성명/주민번호/사업자번호/상세 번지 요청 금지. 답변 포함 시 FAIL + rollback.) |
| 3 | SK바이오텍 계약서 | "SK바이오텍 전자구매시스템 계약의 범위와 주요 조항은?" |
| 4 | PMS 제품소개 | "PMS 제품의 핵심 기능 모듈은 무엇인가?" |
| 5 | 스마트공장 HWP | "스마트공장 보급확산 합동설명회의 주최·일정·주요 안건은?" |
| 6 | Examples HWPX | "Examples 문서의 주요 섹션 구성은?" |

---

### 4.A — Pass A: Ingest 패널 (일반 사용자 경로, 6 파일)

**목적**: 대부분의 실사용자가 택하는 Ingest 패널 경로. 이 패널은 `moveBtn.addEventListener('click', ...)` (sidebar-chat.ts:1858) 한 handler 안에서 `runIngest` (Phase 1) → `movePair` (Phase 2) 를 **자동 순차 수행**한다. 사용자에게는 Ingest 1-click 으로 보이지만 코드상 2-phase. classify 는 `classifyFileAsync(f, isDir, { paraRoot? })` 로 dropdown 값 (`auto`=classify automation / 또는 특정 PARA 지정) 을 반영.

#### 4.A.entry — 파일 루프 (6회 반복, **Ingest 1-click**)

각 파일 순회 (`llm-wiki.md` → `사업자등록증.pdf` → `계약서.pdf` → `PMS.pdf` → `스마트공장.hwp` → `Examples.hwpx`):

1. 사이드바 **Ingest 패널** 진입 — `button.wikey-header-btn[aria-label="Ingest"]` click.
2. Inbox 리스트에서 **대상 파일 1건만** 체크박스 click — `.wikey-audit-row` 중 `.wikey-audit-name` 텍스트가 대상 파일명과 일치하는 row 의 `.wikey-audit-cb` click.
3. 사전 분류 힌트 표시 확인 — 파일명 기반 `classifyFile(f, isDir)` 결과가 row 에 미리 렌더돼야 함 (sidebar-chat.ts:1793).
4. **classifySelect dropdown** 은 기본 `auto` 로 유지 (수동 PARA override 없이 classify automation 검증).
5. **Ingest 버튼 click** — `.wikey-audit-apply-btn.wikey-inbox-move-btn` (label="Ingest") 단일 click.
6. Handler 는 내부적으로: (a) `classifyFileAsync` 로 dest 결정 (CLASSIFY.md 규칙 + 필요 시 LLM 3/4차 fallback) → (b) `runIngest(plugin, "raw/0_inbox/<file>")` 로 IngestFlowModal Brief → Processing → Preview → write → (c) `runIngest` 성공 시 `movePair` 로 PARA/DDC 이동 + sidecar 동반 + registry 갱신 (sidebar-chat.ts:1930,1955). 사용자는 추가 버튼 누르지 않음.
7. **Stage 1 core** (§4.Common.I) — 본 CDP snippet 은 §7.4.a 참조.
8. Handler 완료 시 batch Notice: `"<N> files ingested"` 또는 `"Done <X> / Failed <Y>"` 또는 `"Done <X> / Cancelled <Y>"` (sidebar-chat.ts:1993~1998).
9. 파일 탐색기에서 `raw/<PARA>/<DDC>/<file>` 로 이동 + sidecar `.md` 동반 확인.
10. **Index-ready gate** (§4.Common.II).
11. **Stage 2** (§4.Common.III) — 해당 파일 §4.Common.Q 질문.
12. **Stage 3** (§4.Common.IV) — pairmove + 재질의. (IV.A UI rename / IV.B external reconcile 분리 — §4.Common.IV 참조).
13. 파일별 리포트 `pass-a-file-<N>-<name>.md` 작성.

#### 4.A.observation — Pass A 특이 관찰

- **1-click 완결성**: Ingest 버튼 1-click 후 Notice 가 뜰 때까지 사용자 추가 조작 없음. 중간 modal 조작 (Brief Proceed / Preview Approve) 은 계획된 user gesture — 팔레트 `Cmd+Shift+I` 와 달리 여기선 stay-involved modal 동작.
- **Phase 1 실패 → Phase 2 skip**: `runIngest.success === false` 면 movePair 미수행 → 파일 `raw/0_inbox/` 잔류. 이 edge 는 실패 case 에서만 발생. 정상 case 는 반드시 이동.
- **classifySelect dropdown 상태**: smoke 는 `auto` 고정. 수동 PARA override 는 Phase 5 후속 과제.
- **파일 2 PII**: §3.2 규칙. Stage 1 직후 변환 산출물 + 생성 wiki 페이지 모두 PII grep.

#### 4.A.check — Pass A 종합 체크리스트

6 파일 각각에 대해 §4.Common.I.check (14) + §4.Common.III.check (9) + §4.Common.IV.check (7) = **30 × 6 = 180 항목** 기록. Pass A README 에 매트릭스 집계.

#### 4.A.teardown — Pass A 종료

1. 6 파일 모두 완료 후 파일별 리포트 6건 + `pass-a-readme.md` 완성.
2. **Pass A IV.B** (1건 샘플링) 수행 — 종료 → mv → 재시작 → registry diff (§4.Common.IV.B 절차 참조).
3. Obsidian 종료: `osascript -e 'quit app "Obsidian"' && sleep 3`.
4. **`bash scripts/smoke-reset.sh between-pass`** 실행 — wiki 비우기 + registry 초기화 + qmd purge + inbox 복원 + `git checkout -- wiki/index.md wiki/log.md`. analyses 는 `/tmp/self-extending-wiki.bak.md` 에 backup 유지.
5. 다음 Pass B 시작 전 `ls raw/0_inbox/ | wc -l` 으로 6 복원 확인.

---

### 4.B — Pass B: Audit 패널 (운영자 감사 경로, 6 파일)

**목적**: Audit 패널의 1-click 경로. 이 패널은 `applyBtn.click` handler (sidebar-chat.ts:1259) 안에서 `runIngest(..., { autoMoveFromInbox: true })` 를 호출하고, 그 내부 (`commands.ts::runIngestCore`, line 426) 에서 Phase 1 완료 직후 `classifyFileAsync` + `movePair` 를 수행. 즉 Pass A 와 동일한 1-click UX, 차이는 코드 경로 (view-side handler vs core 내부 autoMove flag).

#### 4.B.entry — 파일 루프 (6회 반복, **Ingest 1-click**)

각 파일 순회:

1. 사이드바 **Audit 패널** 진입 — `button.wikey-header-btn[aria-label="Audit"]` click.
2. Audit 필터 `missing` 확인 (기본값) — 필요 시 `.wikey-audit-stat` 클릭으로 전환.
3. Audit 리스트에서 **대상 파일 1건만** 체크박스 click — `.wikey-audit-row` 에서 `.wikey-audit-name` 텍스트 매칭 후 `.wikey-audit-cb` click.
4. **Ingest 버튼 click** — `.wikey-audit-apply-btn` (label="Ingest") 단일 click.
5. Handler 는 내부적으로: (a) `runIngest(plugin, f, ..., { autoMoveFromInbox: true })` → (b) `runIngestCore` (commands.ts:306~460) 안에서 IngestFlowModal + Stage 1 + `autoMoveFromInbox: true` 분기로 `classifyFileAsync` + `movePair` 자동 수행. 사용자는 추가 버튼 없음.
6. Handler 완료 시 batch Notice: `"<N> completed"` 또는 `"Done <X> / Failed <Y>"` 또는 `"Done <X> / Cancelled <Y>"` (sidebar-chat.ts:1342~1346).
7. 파일이 Stage 1 완료와 동시에 `raw/<PARA>/<DDC>/<file>` 로 이동됨. sidecar 동반.
8. **Index-ready gate** (§4.Common.II).
9. **Stage 2** (§4.Common.III) — §4.Common.Q 질문 동일.
10. **Stage 3** (§4.Common.IV).
11. 파일별 리포트 `pass-b-file-<N>-<name>.md` 작성.

#### 4.B.observation — Pass B 특이 관찰

- **Pass A 와의 차이는 코드 경로뿐**: 사용자 UX 는 1-click 동일, 결과물 (PARA 이동 + wiki 생성) 기대치 동일. tier-label / 분류 결과는 변환 캐시 hit 으로 결정적 일치 기대.
- **Batch Notice 형식**: Audit 은 `"${N} completed"` (성공만), Inbox 는 `"${N} files ingested"` (성공만) — 배치 단위 1회 Notice. 혼동 금지.
- **파일 2 PII**: Pass A 와 동일 §3.2 규칙.

#### 4.B.check — Pass B 종합 체크리스트

6 파일 × 30 항목 = 180 항목. Pass B README 매트릭스 + Pass A 와 교차 비교 표 포함.

#### 4.B.cross — Pass A/B 교차 비교 (Pass B 완료 후)

| 파일 | tier-label 동일? | 분류 depth 동일? | 답변 의미 동등? | Stage 3 pairmove 동등? |
|------|------|------|------|------|
| 1 | ... | ... | ... | ... |
| ...|

두 경로는 **autoMoveFromInbox 분기 외 동일 파이프라인** 이므로 tier/분류 결과는 결정적 일치해야 (Gemini variance 허용). 답변 variance 는 LLM 특성상 허용되지만 주요 wikilink 집합은 공통.

---

### 4.C — (덤 smoke) §4.5.2 삭제·초기화 UI 노출 확인

**[P3 반영 — codex review]** modal sequence 기준으로 재작성. 파괴 실행은 skip — typing gate 직전까지 확인 후 Cancel.

#### 4.C.1 팔레트 노출 확인

1. 명령 팔레트 (`Cmd+P`) → `Wikey:` 입력 → 목록에 **7 entries 모두 표시** 확인:
   - `Wikey: Delete source (dry-run)`
   - `Wikey: Delete wiki page (dry-run)`
   - `Wikey: Reset wiki + registry`
   - `Wikey: Reset wiki only`
   - `Wikey: Reset registry only`
   - `Wikey: Reset qmd index`
   - `Wikey: Reset settings (data.json)`

#### 4.C.2 Delete modal sequence (각 entry 1회)

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

#### 4.C.3 Reset modal sequence (5 scope 각 1회)

각 scope (`wiki+registry` / `wiki-only` / `registry-only` / `qmd-index` / `settings`) 마다:
1. 팔레트에서 해당 `Wikey: Reset <scope>` 선택.
2. `ResetImpactModal` 헤더 한글 라벨 확인 (예: "Reset: wiki + registry (raw/ 유지)").
3. 파일 목록 ≤30 + bytes 표기 확인.
4. 확인 문자열 placeholder 가 `RESET <SCOPE>` 형식임을 확인 (예: `RESET WIKI+REGISTRY`).
5. 입력 없이 `Cancel`.

#### 4.C.4 Settings Tab Reset 섹션

1. Settings → Wikey → "Reset" 섹션 확인 (`renderToolsSection` 다음 위치).
2. Scope dropdown 에 5 option 모두 표시 확인.
3. `Preview & Reset` 버튼 → `ResetImpactModal` 등장 → `Cancel`.

#### 4.C.5 체크리스트
- [ ] 팔레트 7 entries 노출
- [ ] DeleteImpactModal: source 경로, impact 요약, 페이지 목록, typing gate disabled 상태 확인
- [ ] DeleteImpactModal: wiki-page 분기 backlink 수 표시
- [ ] ResetImpactModal: 5 scope 각각 한글 라벨 + bytes + `RESET <SCOPE>` phrase
- [ ] Settings Tab Reset 섹션 dropdown + Preview & Reset 버튼 동작

---

## 5. 리포트 생성 (2-pass)

### 5.1 디렉터리 구조

```
activity/phase-4-smoke-<YYYY-MM-DD>/
├── README.md                          # 최종 집계 (Pass A + B 교차 매트릭스)
├── pass-a-readme.md                   # Pass A (Ingest 패널) 매트릭스
├── pass-a-file-1-llm-wiki.md
├── pass-a-file-2-사업자등록증-굿스트림.md
├── pass-a-file-3-계약서-sk바이오텍.md
├── pass-a-file-4-pms-제품소개.md
├── pass-a-file-5-hwp-스마트공장.md
├── pass-a-file-6-hwpx-examples.md
├── pass-b-readme.md                   # Pass B (Audit 패널) 매트릭스
├── pass-b-file-1-llm-wiki.md
├── pass-b-file-2-사업자등록증-굿스트림.md
├── ... (Pass B 6건)
├── cross-compare.md                   # Pass A vs B 교차 대조
├── stage4-dump-smoke.md               # §4.C 결과
└── dump/                              # Console log 덤프, screenshot
    ├── pass-a-file-1-stage1.log
    ├── pass-a-file-1-stage2.log
    └── ...
```

### 5.2 파일별 리포트 템플릿 (Pass A/B 공용)

```markdown
# [Pass A|B] File <N>: <basename>

## 메타
- 크기 / MIME / 형식:
- 진입 경로: Ingest 패널 (Pass A) | Audit 패널 (Pass B)
- Pre-ingest 경로: raw/0_inbox/<file>
- Post-ingest 경로 (Ingest 1-click handler 완료 시점, 양 pass 공통): raw/<PARA>/<DDC>/<file> + sidecar <file>.md 동반
- source_id (sha256 16-hex):
- 실행 시작 / 종료 (KST):
- CDP log dump: dump/pass-<a|b>-file-<N>-*.log

## Stage 1 — Ingest (§4.Common.I.check 14 항목)
- 변환 tier-label:
- 변환 retry 발생 여부:
- 변환 시간 (cache miss / hit):
- 변환 품질 스코어:
- bitmap OCR 오염:
- Stage 1 summary (앞 300자):
- Stage 2 mentions 수 / evidence PII 점검 (파일 2):
- Stage 3 entities / concepts:
- dropped 수 + 사유 분포 (파일 2 는 PII 포함 mention 의 evidence 여부만 기록):
- provenance entries 예시 1건:
- source 본문 wikilink 유효성:
- 분류 depth + 경로 (auto-rule / LLM-3차 / LLM-4차):
- pair sidecar 이동:
- source-registry / index / log 갱신:
- **Pass A 전용**: Ingest 버튼 1-click 후 handler 내부 `runIngest → movePair` 순차 수행 관찰. `post-ingest movePair:` 로그 타이밍 (Modal close 후 N초).
- **Pass B 전용**: Notice 시점과 파일 이동 시점의 race 관찰 (`auto-moved to PARA:` 로그가 Notice 전·후·동시 중 어디?).
- 이슈:

## Index-ready gate (§4.Common.II)
- `./scripts/reindex.sh --check` 결과 (stale=0 확인):
- gate 통과까지 소요 (s):
- 이슈:

## Stage 2 — Query (§4.Common.III.check 9 항목)
- 질문 (§4.Common.Q 참조):
- 답변 요약 (앞 500자):
- 답변 소요 (s):
- wikilink 수 / citation 📄 수:
- 📄 click 결과 (파일 경로 / 앱):
- source-*.md backlinks 확인:
- 사실 정확성 spot check:
- PII 체크 (파일 2 만): pass / fail + 내용 근거:
- 이슈:

## Stage 3 — Pairmove + Re-query
- **IV.A (실행 중 shell mv, WARN 허용)** — 이동 전 → 이동 후 경로:
  - 판정: `vault rename reconciled:` 로그 감지 여부 (PASS / WARN)
  - WARN 시 Phase 5 §5.3 이관 기록
- **IV.B (Pass 종료 시 1회, PASS 필수)** — 이동 전 → 이동 후 경로:
  - **1차 판정 (필수)**: `diff /tmp/wikey-smoke/reg-before.json ... reg-after.json` — `vault_path` 갱신 + `path_history` 길이 +1 이상
  - 2차 보조 (있으면 기록): `startup reconcile complete` 로그 excerpt (init-log race 로 missing 가능, FAIL 아님)
  - source 페이지 frontmatter `vault_path` rewrite 확인 (`wiki-ops.ts::rewriteSourcePageMeta`)
  - Stage 2 재질의 답변 의미 동등 (Stage 2 와 비교)
  - 📄 새 경로 open 정상
- 이슈:

## 종합
- Stage 1 / Index-gate / 2 / 3 각 PASS/FAIL/WARN
- 종합 판정:
- Root cause + 후속 조치 (FAIL 시):
```

### 5.3 Pass README 템플릿 (`pass-a-readme.md` / `pass-b-readme.md`)

```markdown
# Phase 4 통합 smoke — Pass <A|B> (<YYYY-MM-DD>)

**진입 경로**: Ingest 패널 (Pass A) | Audit 패널 (Pass B)
**autoMoveFromInbox**: false (Pass A) | true (Pass B)

## 매트릭스

| # | 파일 | Stage 1 | Index gate | Stage 2 | Stage 3 | 종합 |
|---|------|---------|-----------|---------|---------|------|
| 1 | llm-wiki.md | | | | | |
| 2 | 사업자등록증 | | | | | |
| 3 | SK바이오텍 계약서 | | | | | |
| 4 | PMS 제품소개 | | | | | |
| 5 | 스마트공장 HWP | | | | | |
| 6 | Examples HWPX | | | | | |

## Pass 통계
- 변환 tier 분포 (세분 7 종):
- 분류 depth 분포: 1-level N / 2-level N / 3-level N · auto-rule N / LLM-3차 N / LLM-4차 N
- 총 생성 페이지 (sources/entities/concepts/analyses):
- 총 provenance entries:
- 총 dropped 사유 집계:
- 총 LLM 토큰 (provider 별):
- 총 실행 시간:
- PII 노출 사건: 0 / 발생

## Phase 별 통과 요약
- Phase 4.0 UI: (Pass A 에서만 기록)
- Phase 4.1 변환:
- Phase 4.2 분류/이동/registry:
- Phase 4.3 인제스트+citation:

## 후속 조치
- FAIL → plan/phase-4-todo.md fix 항목
- WARN → session-wrap-followups 이관
```

### 5.4 교차 대조 (`cross-compare.md`)

Pass B 완료 후 작성. Pass A 와 Pass B 의 **동일 파일별** 결과 비교.

```markdown
# Pass A vs Pass B 교차 대조 (<YYYY-MM-DD>)

## 결정론적 일치 항목 (tier-label / 분류 depth)

| 파일 | A tier | B tier | 일치? | A 분류 | B 분류 | 일치? |
|------|--------|--------|-------|--------|--------|-------|

- **기대**: tier-label 100% 일치 (변환 캐시 공유). 분류 결과는 auto-rule 경로 동일, LLM fallback 은 seed 다를 수 있어 경로 차이 허용.

## LLM variance 허용 항목 (답변 · entity/concept 수)

| 파일 | A wikilinks | B wikilinks | 공통 대상 | A/B 답변 의미 동등? |
|------|------|------|---------|------|

- **기대**: 주요 wikilink 페이지 ≥70% 공통. 답변 의미 동등 (표현 차이 허용).

## 분기 차이 (의도적)

| 파일 | A handler 시간 (view-side `runIngest+movePair`) | B handler 시간 (core `autoMoveFromInbox`) | 소요 차이 |
|------|------|------|------|

## 최종 판정

- [ ] Pass A 6/6 PASS + Pass B 6/6 PASS + 교차 tier 100% 일치 → **Phase 4 본체 완성 선언 가능**
- [ ] 그 외 → 잔여 fix 필요
```

### 5.5 최종 집계 README (`README.md`)

Pass A/B readme 요약 + cross-compare 요약 + §4.C 덤 smoke 결과 + Phase 4 본체 완성 판정 체크박스.

---

## 6. Acceptance Criteria (2-pass 기준)

### 6.1 필수 (Critical — 본체 완성 선언 필수 조건)

- **Pass A**: 6/6 파일 Stage 1 PASS + Index-gate PASS + Stage 2 PASS + Stage 3 PASS.
- **Pass B**: 6/6 파일 Stage 1 PASS + Index-gate PASS + Stage 2 PASS + Stage 3 PASS.
- **교차**: Pass A 와 B 의 tier-label 6/6 일치 (변환 캐시 hit 이므로 결정적 일치 기대).
- **PII**: 파일 2 사업자등록증 Pass A/B 어느 쪽도 PII 노출 0건.
- **Console ERROR**: Pass A/B 통틀어 0건 (WARN 허용).
- **§4.C 덤 smoke**: 팔레트 7 + Delete/Reset 모달 노출 확인 ALL.

### 6.2 권장 (Recommended)

- 변환 품질 스코어 ≥ 0.7 (모든 파일, 양 pass).
- Pass A Ingest 1-click 후 `post-ingest movePair:` 로그까지 총 시간 < 60초 (LLM 처리 시간 포함).
- Pass B Ingest Notice 와 파일 이동 race 없음 (Notice 시점에 이미 이동 완료).
- Pass A/B 답변 의미 동등 (LLM variance 허용하되 주요 wikilink ≥70% 공통).

### 6.3 실패 시 처리

- **Critical 1건 이상 FAIL** → Phase 4 본체 완성 선언 **보류**. 해당 경로 fix 후 관련 Pass 재측정.
- **Recommended 만 FAIL** → WARN 로 집계, `plan/session-wrap-followups.md` 에 이관 후 본체 선언 진행 가능.
- **Pass A Critical FAIL & Pass B PASS** → Ingest 패널 경로에 제품 결함 존재. Phase 4 본체 완성 선언 보류 + `plan/phase-4-todo.md` 에 fix 항목 추가.

---

### 6.4 원래 v2 Acceptance (참고용)

v2 에선 단일 pass 기준이었음 (Audit 만):

- **필수 (Critical)**:
  - 6/6 파일 Stage 1 PASS (변환 + ingest + 자동 분류 + 페어 이동)
  - 6/6 파일 Stage 2 PASS (답변 생성 + wikilink ≥1 + `📄` 렌더)
  - 6/6 파일 Stage 3 PASS (pairmove 후 citation 재기능)
  - PII 노출 0건 (파일 2 사업자등록증)
  - Console `ERROR` 0건 (WARN 는 허용)

---

## 7. Claude 실행 플로우 (자동화 상세)

**v3 신규 — Claude 가 실행 주체**. 본 섹션은 Claude 가 CDP (localhost:9222) + `wikey-cdp.py` 로 UI event 를 발행하는 구체 절차를 정의한다.

### 7.1 원칙

1. **UI event 만** — `el.click()`, `inputEl.dispatchEvent(new KeyboardEvent(...))`, `el.value = '...'; el.dispatchEvent(new Event('input'))`. 내부 상태 setter (`plugin.settings.X = Y`), 함수 직접 호출 (`classifyFileAsync(...)`), Obsidian API 조작 (`app.vault.rename(...)` 등 UI 우회) **금지**.
2. **순차 진행** — 다음 step 은 이전 step 의 readiness 가 확인된 뒤에만. fire-and-forget 금지. 병렬 파일 처리 금지.
3. **readiness polling** — Modal open, Notice 표시, Button enable, Progress 완료 같은 상태 변화는 CDP `Runtime.evaluate` 로 최대 N초 (N=30 기본, Ollama 는 60s) polling. 조건 미충족시 해당 파일 FAIL 처리.
4. **로그 캡처** — 각 step 전·후로 `console._wikeyLog` (자체 주입) 또는 `Runtime.consoleAPICalled` 구독으로 로그 수집. 파일별 리포트의 dump/ 디렉터리에 `.log` 로 저장.
5. **실패 isolation** — 한 파일이 FAIL 하면 리포트에 기록 + 다음 파일로 계속. 5 파일 연속 FAIL 이면 전체 중단하고 root cause 분석.

### 7.2 wikey-cdp.py 헬퍼 인터페이스

현재 `/tmp/wikey-cdp.py` 는 `eval` / `file` 두 모드 지원 (JS expression 실행). 본 smoke 는 다음 래퍼 스크립트를 `scripts/smoke-cdp.sh` 에 배치:

```bash
#!/usr/bin/env bash
# scripts/smoke-cdp.sh — Claude 가 Stage 각 step 에서 호출하는 CDP 래퍼.
set -euo pipefail
CDP="/tmp/wikey-cdp.py"

case "${1:-}" in
  click)          # smoke-cdp.sh click '.selector'
    python3 "$CDP" eval "document.querySelector($(jq -cn --arg s "$2" '$s')).click()"
    ;;
  type)           # smoke-cdp.sh type '.selector' 'text'
    python3 "$CDP" eval "(() => { const el = document.querySelector($(jq -cn --arg s "$2" '$s')); el.focus(); el.value = $(jq -cn --arg t "$3" '$t'); el.dispatchEvent(new Event('input', {bubbles:true})); el.dispatchEvent(new Event('change', {bubbles:true})); })()"
    ;;
  key)            # smoke-cdp.sh key '.selector' 'Enter'
    python3 "$CDP" eval "(() => { const el = document.querySelector($(jq -cn --arg s "$2" '$s')); el.focus(); el.dispatchEvent(new KeyboardEvent('keydown', {key:$(jq -cn --arg k "$3" '$k'), bubbles:true})); el.dispatchEvent(new KeyboardEvent('keyup', {key:$(jq -cn --arg k "$3" '$k'), bubbles:true})); })()"
    ;;
  wait)           # smoke-cdp.sh wait 'JS expr returning bool' [timeout=30]
    python3 "$CDP" eval "(async () => { const start = Date.now(); const timeout = ${3:-30} * 1000; while (Date.now() - start < timeout) { if ($2) return true; await new Promise(r => setTimeout(r, 200)); } return false; })()" await "${3:-35}"
    ;;
  text)           # smoke-cdp.sh text '.selector'
    python3 "$CDP" eval "(() => { const el = document.querySelector($(jq -cn --arg s "$2" '$s')); return el ? el.textContent : null; })()"
    ;;
  capture-logs)   # smoke-cdp.sh capture-logs — dumps _wikeyLog buffer
    python3 "$CDP" eval "(() => { const logs = window._wikeyLog || []; window._wikeyLog = []; return logs.join('\\n'); })()"
    ;;
  init-log)       # smoke-cdp.sh init-log — install console wrapper
    python3 "$CDP" eval "(() => { if (window._wikeyLog) return 'already'; window._wikeyLog = []; ['log','warn','error','info'].forEach(lvl => { const orig = console[lvl]; console[lvl] = function(...a) { window._wikeyLog.push('['+lvl+'] '+a.join(' ')); return orig.apply(this, a); }; }); return 'ok'; })()"
    ;;

  # ── 고수준 helper (P3 권장: selector-free) ──
  clickPanelButton)  # smoke-cdp.sh clickPanelButton 'Ingest'
    python3 "$CDP" eval "(() => { const b = document.querySelector('button.wikey-header-btn[aria-label=' + $(jq -cn --arg n "$2" '$n') + ']'); if (!b) return { error: 'panel button not found: $2' }; b.click(); return { clicked: b.getAttribute('aria-label') }; })()"
    ;;
  clickRowByName)    # smoke-cdp.sh clickRowByName '<파일명>'
    python3 "$CDP" eval "(() => { const rows = [...document.querySelectorAll('.wikey-audit-row')]; const target = rows.find(r => r.querySelector('.wikey-audit-name')?.textContent?.trim() === $(jq -cn --arg f "$2" '$f')); if (!target) return { error: 'row not found: $2', visibleRows: rows.length }; const cb = target.querySelector('.wikey-audit-cb'); if (!cb) return { error: 'checkbox missing in row' }; cb.click(); return { clicked: true, row: target.outerHTML.slice(0, 120) }; })()"
    ;;
  clickButtonByText) # smoke-cdp.sh clickButtonByText '<root-selector>' '<button-text>'
    python3 "$CDP" eval "(() => { const root = document.querySelector($(jq -cn --arg r "$2" '$r')); if (!root) return { error: 'root not found: $2' }; const btns = [...root.querySelectorAll('button')]; const target = btns.find(b => b.textContent.trim() === $(jq -cn --arg t "$3" '$t')); if (!target) return { error: 'button not found: $3', buttons: btns.map(b => b.textContent.trim()) }; if (target.disabled) return { error: 'button disabled: $3' }; target.click(); return { clicked: true }; })()"
    ;;
  waitForModalPhase) # smoke-cdp.sh waitForModalPhase brief|processing|preview [timeout=60]
    PHASE_SEL=""
    case "$2" in
      brief)      PHASE_SEL=".wikey-ingest-flow-modal .wikey-modal-brief" ;;
      processing) PHASE_SEL=".wikey-ingest-flow-modal .wikey-modal-processing" ;;
      preview)    PHASE_SEL=".wikey-ingest-flow-modal .wikey-modal-plan-list" ;;
      closed)     PHASE_SEL="___closed___" ;;  # 특수: modal 사라짐
      *) echo "unknown phase: $2" >&2; exit 2 ;;
    esac
    T="${3:-60}"
    if [ "$PHASE_SEL" = "___closed___" ]; then
      python3 "$CDP" eval "(async () => { const start = Date.now(); const timeout = $T * 1000; while (Date.now() - start < timeout) { if (!document.querySelector('.wikey-ingest-flow-modal')) return { ok: true, ms: Date.now() - start }; await new Promise(r => setTimeout(r, 300)); } return { ok: false, timeout: $T }; })()" await "$((T + 5))"
    else
      python3 "$CDP" eval "(async () => { const start = Date.now(); const timeout = $T * 1000; while (Date.now() - start < timeout) { if (document.querySelector($(jq -cn --arg s "$PHASE_SEL" '$s'))) return { ok: true, ms: Date.now() - start }; await new Promise(r => setTimeout(r, 300)); } return { ok: false, timeout: $T }; })()" await "$((T + 5))"
    fi
    ;;
  waitForNoticeText) # smoke-cdp.sh waitForNoticeText '<substring>' [timeout=30]
    T="${3:-30}"
    python3 "$CDP" eval "(async () => { const start = Date.now(); const timeout = $T * 1000; const needle = $(jq -cn --arg n "$2" '$n'); while (Date.now() - start < timeout) { const hit = [...document.querySelectorAll('.notice')].find(n => n.textContent.includes(needle)); if (hit) return { ok: true, text: hit.textContent }; await new Promise(r => setTimeout(r, 300)); } return { ok: false, timeout: $T }; })()" await "$((T + 5))"
    ;;
  waitForLog)        # smoke-cdp.sh waitForLog '<substring>' [timeout=60]
    T="${3:-60}"
    python3 "$CDP" eval "(async () => { const start = Date.now(); const timeout = $T * 1000; const needle = $(jq -cn --arg n "$2" '$n'); while (Date.now() - start < timeout) { const logs = window._wikeyLog || []; const hit = logs.find(l => l.includes(needle)); if (hit) return { ok: true, line: hit }; await new Promise(r => setTimeout(r, 500)); } return { ok: false, timeout: $T }; })()" await "$((T + 5))"
    ;;

  *)
    echo "usage: $0 {click|type|key|wait|text|capture-logs|init-log|clickPanelButton|clickRowByName|clickButtonByText|waitForModalPhase|waitForNoticeText|waitForLog} [args...]" >&2
    exit 2
    ;;
esac
```

### 7.3 Selector 카탈로그 (실제 DOM 실사 기반)

**전제**: 패널 버튼은 `aria-label` 매칭, Modal 버튼은 텍스트 매칭, row 는 파일명 텍스트 매칭을 기본으로 사용 — class 이름의 brittleness 감소 + build output 변경에 탄력적.

| 의미 | selector (실사 확인) | 근거 (src line) |
|------|---------|-------|
| 패널 탭 버튼 (Chat/Dashboard/Ingest/Audit/Help/Reload/Close) | `button.wikey-header-btn[aria-label="<Name>"]` | sidebar-chat.ts:132~138, :238 |
| 활성 패널 버튼 | 위 selector + `.wikey-header-btn-active` | :284~286 |
| Audit/Inbox row (파일별, 두 패널 공용) | `.wikey-audit-row` 중 자식 `.wikey-audit-name` 텍스트가 파일명과 일치 | :995, :1005, :1801, :1808 |
| row 체크박스 | 위 row 안의 `.wikey-audit-cb` (input type=checkbox) | :998, :1085, :1804 |
| row 상태 class | `.wikey-audit-row-active` / `.wikey-audit-row-done` / `.wikey-audit-row-fail` / `.wikey-audit-row-cancelled` | :1233~1294 |
| Audit 패널 Ingest 버튼 | `.wikey-audit-apply-btn` (textContent="Ingest") | :904, :1335 |
| Ingest 패널 Ingest 버튼 | `.wikey-audit-apply-btn.wikey-inbox-move-btn` (class 둘 다 부착, textContent="Ingest") | :1735 |
| classifySelect dropdown (Inbox 전용) | `.wikey-audit-apply-bar select` (Inbox panel 내) | :1615 근처 |
| IngestFlowModal — contentEl class | `.wikey-ingest-flow-modal` | ingest-modals.ts:161 |
| IngestFlowModal — modalEl wrap class | `.wikey-ingest-flow-modal-wrap` | :162 |
| Modal 현재 phase — Brief 렌더됨 | `.wikey-ingest-flow-modal .wikey-modal-brief` 존재 (loading 은 `.wikey-modal-brief-loading`) | :347~351 |
| Modal 현재 phase — Processing 렌더됨 | `.wikey-ingest-flow-modal .wikey-modal-processing` 존재 | :396 |
| Modal 현재 phase — Preview 렌더됨 | `.wikey-ingest-flow-modal .wikey-modal-plan-list` 존재 | :437 |
| Brief — Proceed 버튼 | Modal 안의 `button.mod-cta`(textContent="Proceed") | :387 |
| Brief — Cancel 버튼 | Modal 안의 `button` textContent="Cancel" | :391 |
| Brief — guide textarea | `.wikey-modal-textarea` (공란 유지) | :368 |
| Processing — progress percentage | `.wikey-modal-progress-pct` | :406 |
| Processing — Back 버튼 | Modal 안의 `button` textContent="Back" | :419 |
| Preview — Approve & Write 버튼 | Modal 안의 `button.mod-cta` textContent="Approve & Write" | :455 |
| Preview — Cancel (discard) 버튼 | Modal 안의 `button` textContent="Cancel (discard)" | :457 |
| Notice (Obsidian native) | `.notice` (body 최상위) | Obsidian built-in |
| Chat 입력창 | `.wikey-chat-input` (textarea) | sidebar-chat.ts:149 |
| Chat Send 버튼 | `.wikey-chat-send-btn` | :153 |
| Chat 메시지 컨테이너 | `.wikey-chat-message.wikey-chat-assistant` (assistant role) / `.wikey-chat-user` / `.wikey-chat-error` | :400 |
| Chat 최신 assistant 답변 본문 | `.wikey-chat-message.wikey-chat-assistant:last-of-type .wikey-chat-content` | :400, :406 |
| wikilink (Obsidian native) | `a.internal-link` (답변 본문 안에서 렌더) | Obsidian Markdown renderer |
| Citation 📄 보조 링크 | `a.wikey-citation-link` | sidebar-chat.ts:82 근처 `attachCitationBacklinks` |

**중요 차이점 (v3 → v4)**:

- v3 의 `.wikey-panel-btn-*`, `.wikey-inbox-row[data-path=...]`, `.wikey-flow-step-num`, `.wikey-flow-next-btn`, `.wikey-flow-confirm-btn`, `.wikey-chat-message-assistant:last-child .wikey-chat-message-body` 등은 **실재하지 않음** → 위 실사 selector 로 교체.
- v3 의 "step=4 로 preview 진입" 감지는 잘못 — 실제 모달은 `brief` / `processing` / `preview` 3 phase. `wikey-flow-step-num` class 는 없고, phase 전환은 `.wikey-modal-brief` / `.wikey-modal-processing` / `.wikey-modal-plan-list` 의 존재 여부로 감지.
- Ingest 패널의 `Move` 라벨 전환 없음 — 버튼 textContent 는 계속 "Ingest", 클릭 시 handler 내부에서 `runIngest → movePair` 자동 수행.

**실행 전 selector 검증 (필수)**:

```bash
# 패널 버튼이 실재하는지
bash scripts/smoke-cdp.sh text 'button.wikey-header-btn[aria-label="Ingest"]'
# Modal phase selector 가 렌더 시 잡히는지 (인제스트 1회 수동 실행 후 확인)
```

### 7.4 Stage 별 CDP snippet (실제 DOM 기반, 복붙 실행 가능)

**helper 추천**: P3 피드백 반영 — raw selector 반복 대신 의도 표현 helper 로 감쌈. 아래 snippet 들은 `scripts/smoke-cdp.sh` 에 추가할 고수준 command 사용:

- `clickPanelButton <aria-label>` — `button.wikey-header-btn[aria-label="<X>"].click()`
- `clickRowByName <filename>` — `.wikey-audit-row` 들 중 자식 `.wikey-audit-name` 텍스트 일치 row 의 `.wikey-audit-cb` click
- `clickButtonByText <selector-root> <text>` — root 내부 `button` 중 textContent 일치 요소 click
- `waitForModalPhase brief|processing|preview <timeout>` — 위 3 selector 로 phase 감지
- `waitForNoticeText <substring> <timeout>` — `.notice` 텍스트 substring 매칭
- `waitForLog <substring> <timeout>` — `window._wikeyLog` 버퍼에서 substring 발견

#### 7.4.a Stage 1 — Ingest (Pass A, Ingest 패널, **1-click**)

```bash
bash scripts/smoke-cdp.sh init-log  # 세션 처음 1회만

# 1. Ingest 패널 진입
bash scripts/smoke-cdp.sh clickPanelButton 'Ingest'
sleep 1

# 2. 대상 파일 row 의 체크박스 click
FILE="사업자등록증C_(주)굿스트림_301-86-19385(2015).pdf"
bash scripts/smoke-cdp.sh clickRowByName "$FILE"

# 3. classifySelect 기본값 'auto' 확인 (수동 override 없음)
# <select>.textContent 는 모든 option 텍스트 합쳐지므로 .value 사용
python3 /tmp/wikey-cdp.py eval "(() => { const sel = document.querySelector('.wikey-audit-apply-bar select'); return sel ? { value: sel.value, options: [...sel.options].map(o => o.value) } : null; })()"
# 기대 value: "auto"

# 4. Ingest 버튼 활성 대기 + 1-click (이후 handler 가 runIngest+movePair 자동 수행)
bash scripts/smoke-cdp.sh wait "!document.querySelector('.wikey-audit-apply-btn.wikey-inbox-move-btn')?.hasAttribute('disabled')" 10
bash scripts/smoke-cdp.sh clickButtonByText '.wikey-audit-apply-bar' 'Ingest'

# 5. Brief modal phase + brief 텍스트 로딩 완료 대기 (loading class 사라짐)
bash scripts/smoke-cdp.sh waitForModalPhase 'brief' 60
# brief 본문이 비어있지 않을 때까지 — helper 대신 간단 boolean expr
bash scripts/smoke-cdp.sh wait "(function(){var b=document.querySelector('.wikey-ingest-flow-modal .wikey-modal-brief');return b&&!b.classList.contains('wikey-modal-brief-loading')&&b.textContent.length>30})()" 60
bash scripts/smoke-cdp.sh clickButtonByText '.wikey-ingest-flow-modal' 'Proceed'

# 6. Processing phase 로 전환 + Preview phase 완료 대기
bash scripts/smoke-cdp.sh waitForModalPhase 'processing' 10
bash scripts/smoke-cdp.sh waitForModalPhase 'preview' 600   # OCR 대형 PDF 최대 10분

# 7. Preview — Approve & Write
bash scripts/smoke-cdp.sh clickButtonByText '.wikey-ingest-flow-modal' 'Approve & Write'

# 8. Modal 닫힘 대기 (helper)
bash scripts/smoke-cdp.sh waitForModalPhase 'closed' 30

# 9. post-ingest movePair 로그 (handler 자동 수행) 대기
bash scripts/smoke-cdp.sh waitForLog 'post-ingest movePair:' 60

# 10. batch Notice — Inbox 패널 성공 메시지 ("N files ingested")
bash scripts/smoke-cdp.sh waitForNoticeText 'files ingested' 30
# 실패 시: "Done X / Failed Y" 또는 "Done X / Cancelled Y" — row 상태 class 로 파일별 판정 (step 11).

# 11. row 최종 상태 확인 — filename 매칭은 JS 로, XPath 금지
python3 /tmp/wikey-cdp.py eval "(() => { const rows=[...document.querySelectorAll('.wikey-audit-row')]; const target=rows.find(r=>r.querySelector('.wikey-audit-name')?.textContent?.trim()===$(jq -cn --arg f "$FILE" '$f')); return target ? { classes: target.className } : { error: 'row not found' }; })()"
# 기대: className 에 'wikey-audit-row-done' 포함 (실패 시 'wikey-audit-row-fail')

# 12. 로그 덤프
bash scripts/smoke-cdp.sh capture-logs > "activity/phase-4-smoke-<DATE>/dump/pass-a-file-<N>-stage1.log"
```

#### 7.4.b Stage 1 — Ingest (Pass B, Audit 패널, **1-click**)

Pass A 와 거의 동일. 차이점만:

```bash
# 1. Audit 패널 진입
bash scripts/smoke-cdp.sh clickPanelButton 'Audit'

# 2. (선택) 필터 'missing' 확인 — 기본이면 skip
bash scripts/smoke-cdp.sh text '.wikey-audit-stat-active'   # 기대: 'Missing' 계열

# 3. 대상 파일 row 의 체크박스 click
bash scripts/smoke-cdp.sh clickRowByName "$FILE"

# 4. Ingest 버튼 click (classifySelect dropdown 없음 — autoMoveFromInbox:true 로 core 가 auto 처리)
bash scripts/smoke-cdp.sh wait "!document.querySelector('.wikey-audit-apply-btn')?.hasAttribute('disabled')" 10
bash scripts/smoke-cdp.sh clickButtonByText '.wikey-audit-apply-bar' 'Ingest'

# 5~8. Modal 플로우는 Pass A 와 동일 (Brief → Proceed → Processing → Preview → Approve & Write)

# 9. auto-move 로그 — commands.ts:429 가 발행
bash scripts/smoke-cdp.sh waitForLog 'auto-moved to PARA:' 60

# 10. batch Notice — Audit 패널 성공 메시지
bash scripts/smoke-cdp.sh waitForNoticeText 'completed' 30
# 또는: 'Done' + 'Failed' — 파일별 row class 로 판정
```

#### 7.4.c Stage 2 — Chat 질의

```bash
bash scripts/smoke-cdp.sh clickPanelButton 'Chat'
sleep 1
bash scripts/smoke-cdp.sh type '.wikey-chat-input' "$QUESTION"
bash scripts/smoke-cdp.sh click '.wikey-chat-send-btn'   # send 버튼 class 선택자로 직접

# 답변 대기 — boolean expression IIFE (wait helper 는 boolean only)
bash scripts/smoke-cdp.sh wait "(function(){var msgs=document.querySelectorAll('.wikey-chat-message.wikey-chat-assistant');if(!msgs.length)return false;var body=msgs[msgs.length-1].querySelector('.wikey-chat-content');return !!body && body.textContent.length>40})()" 90

# wikilink / citation 추출
python3 /tmp/wikey-cdp.py eval "(() => {
  const last = [...document.querySelectorAll('.wikey-chat-message.wikey-chat-assistant')].pop();
  const body = last?.querySelector('.wikey-chat-content');
  if (!body) return null;
  return {
    wikilinks: body.querySelectorAll('a.internal-link').length,
    citations: body.querySelectorAll('a.wikey-citation-link').length,
    textPreview: body.textContent.slice(0, 2000),
  };
})()"

# 📄 click (첫 citation, 내장 viewer or 외부 open)
bash scripts/smoke-cdp.sh click '.wikey-chat-message.wikey-chat-assistant:last-of-type .wikey-chat-content a.wikey-citation-link'
sleep 2
# 열린 탭/viewer 확인 (workspace.openLinkText / window.open / Notice tombstone 중 하나)
bash scripts/smoke-cdp.sh text '.workspace-leaf.mod-active .view-header-title'
```

#### 7.4.d Stage 3 — Pairmove + 재질의

**IV.A (실행 중 shell mv)** — Obsidian 실행된 상태에서 shell/Finder 로 mv. vault watcher 가 감지 → `vault.on('rename')` 경로. `app.fileManager.renameFile` 같은 JS API 호출은 UI event 제약 위반이므로 **사용 금지**.

```bash
# 1. 현재 경로 조회 (bash)
CUR_PATH=$(python3 -c "
import json, sys
reg = json.load(open('wiki/.wikey/source-registry.json'))
for _id, r in reg.items():
    if '$FILE' in r['vault_path']:
        print(r['vault_path']); break
")
[ -z "$CUR_PATH" ] && { echo "FILE not in registry: $FILE"; exit 1; }

# 2. 새 경로 준비 + shell mv (sidecar 동반)
NEW_DIR="raw/1_projects/20_report/999_smoke"
mkdir -p "$NEW_DIR"
mv "$CUR_PATH" "$NEW_DIR/"
[ -f "${CUR_PATH}.md" ] && mv "${CUR_PATH}.md" "$NEW_DIR/"

# 3. vault watcher 가 rename 감지 + reconcileExternalRename 실행 대기 (main.ts:281 로그)
bash scripts/smoke-cdp.sh waitForLog 'vault rename reconciled:' 30

# 4. registry vault_path + path_history 확인 (bash)
python3 -c "
import json
reg = json.load(open('wiki/.wikey/source-registry.json'))
for _id, r in reg.items():
    if '$NEW_DIR' in r['vault_path']:
        print(_id[:23], r['vault_path'], 'history_len=', len(r['path_history']))
"

# 5. source 페이지 frontmatter vault_path rewrite 확인
grep -l "vault_path: $NEW_DIR" wiki/sources/source-*.md

# 6. Stage 2 재질의 (§7.4.c 재실행)
# 7. 📄 click → 새 경로 open 확인
```

**IV.B (종료 상태 mv + 재시작 reconcile)** — Pass A/B 각 종료 시 1건만 샘플링. **1차 판정 = registry before/after diff (필수)**. 로그는 보조 (init-log 는 재시작 후 설치라 race 가능).

```bash
# 1. Obsidian 완전 종료
osascript -e 'quit app "Obsidian"'
sleep 3
curl -sS localhost:9222/json 2>&1 | head -3   # connection refused 기대

# 2. registry before snapshot (이동 전)
mkdir -p /tmp/wikey-smoke
jq '.' wiki/.wikey/source-registry.json > /tmp/wikey-smoke/reg-before.json

# 3. 대상 source_id 식별 + before 경로
CUR_PATH=$(jq -r --arg f "$FILE" '
  to_entries[] | select(.value.vault_path | contains($f)) | .value.vault_path
' /tmp/wikey-smoke/reg-before.json)
SOURCE_ID=$(jq -r --arg f "$FILE" '
  to_entries[] | select(.value.vault_path | contains($f)) | .key
' /tmp/wikey-smoke/reg-before.json)
[ -z "$CUR_PATH" ] && { echo "FAIL: not in registry: $FILE"; exit 1; }
echo "IV.B before: id=$SOURCE_ID cur=$CUR_PATH"

# 4. shell mv — raw + sidecar 다른 PARA 로
NEW_DIR="raw/3_resources/30_manual/991_moved_by_smoke"
mkdir -p "$NEW_DIR"
mv "$CUR_PATH" "$NEW_DIR/"
[ -f "${CUR_PATH}.md" ] && mv "${CUR_PATH}.md" "$NEW_DIR/"

# 5. Obsidian 재시작 (CDP 플래그 유지)
open -a Obsidian --args --remote-debugging-port=9222 --remote-allow-origins=*
until curl -sS localhost:9222/json >/dev/null 2>&1; do sleep 2; done
sleep 8   # onload registryReconcile 완료 대기

# 6. ★ 1차 판정 (필수): registry after snapshot + diff
jq '.' wiki/.wikey/source-registry.json > /tmp/wikey-smoke/reg-after.json
echo "--- registry field diff (vault_path + path_history for $SOURCE_ID) ---"
jq --arg id "$SOURCE_ID" '
  .[$id] | {vault_path, path_history_len: (.path_history | length), last_path: (.path_history | last)}
' /tmp/wikey-smoke/reg-before.json /tmp/wikey-smoke/reg-after.json

# 판정 (PASS 조건):
#   after.vault_path 가 새 PARA 경로로 갱신됐는가
#   after.path_history 길이가 before 보다 +1 이상
#   마지막 history entry 의 vault_path 가 새 경로
NEW_PATH="$NEW_DIR/$(basename "$CUR_PATH")"
PASS=$(jq -n \
  --slurpfile b /tmp/wikey-smoke/reg-before.json \
  --slurpfile a /tmp/wikey-smoke/reg-after.json \
  --arg id "$SOURCE_ID" --arg np "$NEW_PATH" '
    ($a[0][$id].vault_path == $np)
    and (($a[0][$id].path_history | length) > ($b[0][$id].path_history | length))
  ')
if [ "$PASS" = "true" ]; then
  echo "IV.B PASS (registry diff 확인)"
else
  echo "IV.B FAIL — registry 갱신 안 됨"; exit 1
fi

# 7. 2차 보조 (있으면 기록, 없어도 OK): startup reconcile log
bash scripts/smoke-cdp.sh init-log   # 재시작 후 설치 — 이전 onload 로그는 유실됨
LOG_AFTER=$(bash scripts/smoke-cdp.sh capture-logs 2>/dev/null | grep -o 'startup reconcile complete[^"]*' | head -1)
echo "IV.B 2차 보조 log: ${LOG_AFTER:-(missing — init-log race, OK)}"

# 8. 📄 click → 새 경로 open 확인 (Stage 2 query 재수행)
```

### 7.5 순차 체크포인트 (안전 레일)

- **파일 1건 완주 시간 상한**: 일반 15 분, OCR 대형 PDF 25 분. 초과 시 즉시 중단 + FAIL.
- **연속 FAIL 상한**: 3 파일 연속 FAIL → 전체 Pass 중단 후 root cause 분석.
- **Modal orphan 감지**: phase 대기 timeout 시 `.wikey-ingest-flow-modal` 여전히 존재하면 **Cancel / Cancel (discard)** 버튼 textContent 클릭으로 명시 종료. Processing 중 Escape 는 차단되므로 Cancel 버튼 사용 필수 (ingest-modals.ts 참조).
- **CDP disconnect**: `curl -sS localhost:9222/json` 실패 시 Obsidian 재시작 필요 — `--remote-debugging-port=9222` 플래그 누락 / 앱 crash 여부 확인.
- **Phase 잘못 감지 방지**: Brief/Processing/Preview 의 selector 는 `.wikey-modal-brief` / `.wikey-modal-processing` / `.wikey-modal-plan-list` 로 **각 phase 에서만 존재**하는 요소. "step 번호" 로 감지하지 말 것 — 그런 DOM 은 없음.

### 7.6 실행 순서 요약 (Claude 의 step 루프, v6 mode 명시)

`smoke-reset.sh` 의 3 모드 (`init` / `between-pass` / `final`) 를 명시적으로 사용. reset 전에 반드시 Obsidian 종료.

```bash
# ── PRELUDE (최초 1회) ──
bash scripts/smoke-reset.sh init              # inbox + analyses backup (Obsidian 상태 무관)
open -a Obsidian --args --remote-debugging-port=9222 --remote-allow-origins=*

# ── Pass A (Ingest 패널) ──
# (1회) UI pre-smoke §4.0
# for f in [file-1..6]:
#   Stage 1 core §7.4.a          → IV Stage 1 check 14 items
#   Index-ready gate §4.Common.II
#   Stage 2 §7.4.c                → 9 items
#   Stage 3 IV.A 관찰 (WARN 허용) §4.Common.IV.A
# Pass A IV.B (1회) — Obsidian 종료 필요 → 아래 quit 후 재시작에서 수행
# → Pass A README (pass-a-readme.md)

# ── Pass A IV.B + Pass A→B 전환 clean-slate ──
osascript -e 'quit app "Obsidian"' && sleep 3
# IV.B shell mv (§4.Common.IV.B) — 임의 1건 선택 + 다른 PARA 로 mv
# registry before snapshot → mv → Obsidian 재시작 후 after diff 로 판정
open -a Obsidian --args --remote-debugging-port=9222 --remote-allow-origins=*
# IV.B 판정 완료 후 다시 종료
osascript -e 'quit app "Obsidian"' && sleep 3
bash scripts/smoke-reset.sh between-pass      # wiki 비우기 + registry 초기화 + qmd purge + inbox 복원

# ── Pass B (Audit 패널) ──
open -a Obsidian --args --remote-debugging-port=9222 --remote-allow-origins=*
# for f in [file-1..6]:
#   Stage 1 core §7.4.b / Index-gate / Stage 2 / Stage 3 IV.A 관찰
# Pass B IV.B (1회) — Obsidian 종료 필요 → 아래 quit 후 재시작에서 수행
# → Pass B README (pass-b-readme.md)

# ── Pass B IV.B + §4.C 덤 smoke ──
osascript -e 'quit app "Obsidian"' && sleep 3
# IV.B shell mv 1건
open -a Obsidian --args --remote-debugging-port=9222 --remote-allow-origins=*
# IV.B 판정
# §4.C 덤 smoke (팔레트 7 + Delete/Reset modal sequence)
# → cross-compare.md + 최종 README.md

# ── FINAL ──
osascript -e 'quit app "Obsidian"' && sleep 3
bash scripts/smoke-reset.sh final             # analyses 복원 + backup 삭제
```

---

## 8. 실패 시 디버깅 순서

1. 변환 실패 → Settings → Env Status → docling/unhwp 재설치 (`uv tool install docling` / `pip install unhwp`).
2. LLM 실패 → Settings → API Keys 확인 + `check-providers.sh` + Ollama `ps`.
3. Stage 1/2/3 timeout → Developer Console `[Wikey ingest]` stderr 확인 + `capture-logs` dump.
4. citation 미렌더 → `attachCitationBacklinks` 브레이크포인트 + `provenance` frontmatter 직접 확인.
5. pairmove 실패 → `[vault-events]` 로그 + `source-registry.json` 직접 조회 + `renameGuard.consume` 타이밍 확인.
6. PII 노출 → 즉시 wiki 페이지 rollback + `check-pii.sh` 로 재검증 + root cause.
7. CDP selector 부재 → smoke 중단 + wikey-obsidian CSS 확장 (class 추가) 후 재빌드 → 재시작.
8. Obsidian hang → Cmd+R 리로드 → clean-slate 재실행 → 해당 파일만 재시도.

---

## 9. 소요 시간 예상 (2-pass)

- Pre-flight + UI pre-smoke: 15 분
- Pass A: 파일당 20~30 분 × 6 = **120~180 분**
- clean-slate 전환: 10 분
- Pass B: 파일당 15~25 분 × 6 = **90~150 분** (변환 캐시 hit 으로 Pass A 보다 약간 빠름; Ingest 1-click UX 동일)
- §4.C 덤 smoke: 15 분
- 교차 대조 리포트: 20 분
- **총계**: **4.5 ~ 7 시간** (한 세션 단일 실행은 긴 편, Obsidian 장시간 운영 시 안정성 추가 관찰 필요)

세션 분할 권장:
- Session X: Pass A 완료 + README.
- Session X+1: Pass B 완료 + 교차 대조 + §4.C 덤 smoke + D 본체 완성 선언.

---

## 10. 다음 단계

통합 smoke 양 pass 모두 PASS → **Phase 4 본체 완성 선언 (D 블록)** — `plan/phase-4-todo.md` Phase 4 본체 완성 체크리스트 D.1~D.5 실행. Pass A/B README 와 교차표가 D 블록의 증거.

---

## 11. 변경 이력

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
- **v3** (2026-04-23 session 5): 사용자 지시로 구조 재설계. codex 재검증 pending.
  - **사용자 피드백 1**: "Ingest 패널 (일반 사용자 경로) 과 Audit 패널 (운영자 경로) 둘 다 테스트해야 분석이 된다. 2-pass 로 돌려라."
  - **사용자 피드백 2**: "사용자는 개입하지 않음. Claude 가 직접 Obsidian 을 컨트롤하되, 실제 사용자처럼 순서대로 진행."
  - **사용자 피드백 3**: "CDP 를 UI event simulator 로 허용. DOM 직접 조작·내부 API 우회 금지. 백그라운드·병렬 금지."
  - **구조 변경**:
    - 헤더 상태 라인: v2 → v3, 실행 주체 = Claude (CDP 기반).
    - §2 전제조건: CDP 9222 + wikey-cdp.py + `cp -a raw/0_inbox/ /tmp/wikey-smoke-inbox-backup/` 추가.
    - §2.1: Pass A/B 각 시작 전 재실행 가능한 `smoke-reset.sh` 로 재구성. inbox backup/restore 포함.
    - §4 전체 재편: **§4.0 UI pre-smoke (Pass A 진입 전 1회)** → **§4.Common (I~IV 공통 Stage 절차)** → **§4.A Pass A (Ingest 패널, 6 파일, Ingest + Move 2-step)** → **§4.B Pass B (Audit 패널, 6 파일, Ingest 1-step 자동 이동)** → **§4.C 덤 smoke**.
    - §4.A.observation: Pass A 전용 edge 케이스 (Move 전 Stage 2 질의 가능 — 0_inbox 유지 상태) 관찰 포인트.
    - §4.B.cross: Pass A/B 교차 대조 기반 마련.
    - §5 리포트 2-pass 구조: pass-a-readme.md / pass-b-readme.md / cross-compare.md / 최종 README.md + 파일당 2 리포트 (A, B 각각) = 총 12 파일별 리포트.
    - §6 Acceptance 2-pass 기준: Pass A 6/6 + Pass B 6/6 + 교차 tier 100% 일치 + PII 0 + console ERROR 0.
    - **§7 신규 "Claude 실행 플로우"** — 원칙 (UI event only · 순차 · readiness polling · 로그 캡처 · 실패 isolation) + `scripts/smoke-cdp.sh` wrapper 설계 (click/type/key/wait/text/capture-logs/init-log) + UI selector 카탈로그 + Stage 별 CDP snippet (7.4.a Pass A Stage 1, 7.4.b Pass B Stage 1, 7.4.c Stage 2, 7.4.d Stage 3) + 안전 레일 (파일당 15분 상한, 3 연속 FAIL 중단).
    - §9 소요 시간: v2 2~3h → v3 **4.5~7h**. 세션 분할 권장 (Pass A 한 세션, Pass B+덤+선언 한 세션).
  - **codex 재검증**: Panel Mode D (2026-04-23 session 5) — **VERDICT: REJECT**. 5 P1 + 3 P2 + 3 P3.
    - P1 1) Pass A 2-click 가정 틀림 (실제 1-click handler 내부 2-phase).
    - P1 2) §7.3 selector 카탈로그 대부분 실재 안 함.
    - P1 3) §7.4 readiness polling 비현실 (모달 3 phase, step=4 없음, Notice 문자열 다름).
    - P1 4) Stage 3 shell mv ≠ UI drag (별도 경로인데 혼용).
    - P1 5) smoke-reset.sh clean-slate 미완 (PARA 이동 파일 teardown 없음).
    - P2) check-pii.sh 인자 미지원, canonicalizer PII-name 없음, registryCache 가짜 API.
    - P3) selector-free helper, Stage 3 분리, 임시 vault 기반 teardown.

- **v4** (2026-04-23 session 5): v3 REJECT 5 P1 + P2/P3 전수 수용. codex Mode D 재검증 pending.
  - **실사 조사** (sidebar-chat.ts / ingest-modals.ts / commands.ts / main.ts / canonicalizer.ts / check-pii.sh) 로 selector 카탈로그 전면 교체.
  - **§4.A/§4.B Ingest 1-click 플로우 재작성**: Pass A 는 `sidebar-chat.ts:1858` handler 가 `runIngest → movePair` 내부 순차 수행. Pass B 는 `commands.ts:429` `runIngestCore` 가 `autoMoveFromInbox:true` 분기로 동일 수행. 사용자 추가 조작 없음.
  - **§7.3 selector 카탈로그 전면 교체**: `button.wikey-header-btn[aria-label="X"]` 매칭 · `.wikey-audit-row` + `.wikey-audit-name` 텍스트 매칭 · `.wikey-audit-apply-btn(.wikey-inbox-move-btn)` · `.wikey-ingest-flow-modal` + phase 3 개 (`.wikey-modal-brief` / `.wikey-modal-processing` / `.wikey-modal-plan-list`) · Modal 버튼 textContent (`Proceed` / `Approve & Write`) · `.wikey-chat-message.wikey-chat-assistant:last-of-type .wikey-chat-content`.
  - **§7.4 snippet 재작성**: selector-free helper (`clickPanelButton`, `clickRowByName`, `clickButtonByText`, `waitForModalPhase brief|processing|preview`, `waitForNoticeText`, `waitForLog`). Notice 실제 문자열 반영 (`"N files ingested"` / `"N completed"`). `Escape` 복구 대신 `Cancel` 버튼 textContent 클릭.
  - **§4.Common.IV Stage 3 분리**: IV.A UI rename (`app.fileManager.renameFile`) — 파일별 루프 안 수행. IV.B external fs reconcile (Obsidian 종료 → bash mv → 재시작) — Pass 종료 시 1회. 판정 기준 별도.
  - **§2.1.1 smoke-reset.sh v4**: `init` / `between-pass` / `final` 3-mode. registry `path_history` 기반 이동 파일 역추적 teardown. `git checkout -- wiki/index.md wiki/log.md` 으로 HEAD baseline 복원. analyses backup 복원.
  - **§3.2 PII gate 현실화**: check-pii.sh 는 wiki/ 전체 스캔만 지원 (인자 불수용). 변환 산출물 단일 파일 검사는 inline egrep (`RRN/BRN/ADDR/PHONE/EMAIL` 공통 패턴). canonicalizer `PII-name` drop reason 가정 제거, Stage 3 결과는 wiki 페이지 수동 grep 으로 검증. 사업자번호 (`BRN`) 패턴 추가 (check-pii.sh 미커버 보완).
  - **selector 실사 증거**: sidebar-chat.ts:132~138,:238 (panel button aria-label), :904,:1735 (apply btn), :1801~1808 (row), :1342~1346, :1993~1998 (Notice strings), ingest-modals.ts:161,:347,:396,:437 (modal phase DOM), :387,:391,:455,:457 (modal button texts).

- **v5** (2026-04-23 session 5): v4 REJECT 피드백 5건 (부분 해소 P1 + P2/P3) 전수 수용.
  - **v3 잔재 청소**: §4.Common.I 본문에서 `.wikey-brief-text`, `.wikey-modal-step-num`, `"인제스트 완료"` 문구 제거 → 실제 selector (`.wikey-modal-brief`, `.wikey-modal-progress-bar`, `.wikey-modal-plan-list`) + 실제 Notice (`"files ingested"` / `"completed"`) 로 교체. 파일별 리포트 템플릿 "Move 버튼 click 시점" / "raw/0_inbox 유지" / "shell mv 명령" 잔재 제거.
  - **§7.2 helper command 구현 추가**: `clickPanelButton`, `clickRowByName`, `clickButtonByText`, `waitForModalPhase`, `waitForNoticeText`, `waitForLog` 를 실제 case 분기로 작성 (각각 wikey-cdp.py eval 호출). §7.4 snippet 이 호출 가능한 형태로 복원.
  - **§4.Common.IV.A `app.fileManager.renameFile` 제거 → shell mv**: 실행 중 shell mv 가 Obsidian vault watcher 에 의해 `vault.on('rename')` 경로로 감지됨 (Finder 에서 mv 하는 것과 동등). `app.fileManager.renameFile` JS API 호출은 UI event 제약 위반이므로 제거.
  - **성공 로그 문자열 정확화**: main.ts 실측 — IV.A `[Wikey] vault rename reconciled:` (main.ts:281), IV.B `[Wikey] startup reconcile complete` (main.ts:336).
  - **between-pass / final 은 Obsidian 종료 후 실행 명시**: live vault watcher race 방지. 사용 순서에 `osascript -e 'quit app "Obsidian"' → sleep 3 → smoke-reset.sh ... → open -a Obsidian ...` 명시.
  - **§3.2 ADDR regex 보강**: 도로명 주소 `[가-힣]+[로길]\s*[0-9]+(,[0-9]+)?` 패턴 추가 (실제 사업자등록증의 "공단로 134,613" 같은 형식 대응). 지번 주소 regex 는 유지.
  - **§7.4.a classifySelect 검증 `value` 로**: `<select>.textContent` 는 모든 option 합쳐지므로 `.value` 를 읽는 방식으로 변경.
  - **codex 재검증 결과**: v5 Panel Mode D → **REJECT** (v4 5 P1 중 3 해소 + 2 남음).
    - 남은 P1-1: IV.A live external mv 가 `vault.on('rename')` 으로 잡힌다는 보장 없음 (코드 주석이 UI rename vs external fs 를 분리).
    - 남은 P1-2: §7.4 예시 중 `wait "const ...; return ..."` 형태 + `:has(.wikey-audit-name[text()='$FILE'])` XPath 섞인 selector 가 wait helper/ CSS selector 문법에 맞지 않아 복붙 실행 불가.
    - P2: IV.B 로그 race (init-log 는 재시작 후 설치) · §7.6 요약이 mode 명시 없이 `bash scripts/smoke-reset.sh` 한 줄.
    - P3: §7.3/7.4 제목에 "v4" 잔존.

- **v6** (2026-04-23 session 5): v5 REJECT 2 P1 + P2/P3 전수 수용.
  - **IV.A 를 WARN 허용 관찰로 강등**: 실행 중 shell mv 가 vault watcher 에 잡힌다는 코드상 보장이 없음을 수용. 각 파일 루프 안에서 IV.A 시도 후 감지되면 PASS, 미감지 시 **WARN + Phase 5 §5.3 이관** 으로 분류. Stage 3 주 판정은 IV.B 로 대체.
  - **IV.B 를 주 검증축 + 샘플링**: Pass A·B 각 종료 시 1건씩 총 2건 PASS 필수. 6 파일 × 2 pass 전수 대신 대표 샘플. 판정 1차 기준을 **registry before/after diff** 로 전환 (로그 race 인정, `startup reconcile complete` 로그는 보조 증거).
  - **§7.4 snippet 복붙 실행 가능**: `wait` statement block → helper (`waitForModalPhase closed`, `waitForLog`, `waitForNoticeText`) 또는 boolean IIFE `(function(){...})()` 로 변환. XPath `[text()='$FILE']` → `querySelectorAll('.wikey-audit-row') + find (textContent)` JS 패턴. Chat send 버튼 클릭은 class selector `.wikey-chat-send-btn` 로 직접.
  - **§7.6 실행 순서 요약 v6 재작성**: `init` / `between-pass` / `final` 3 mode 명시. 각 단계에 `osascript -e 'quit app "Obsidian"'` + `sleep 3` + `open -a Obsidian ...` flow 명시. IV.B 를 quit/restart cycle 안에 자연스럽게 배치.
  - **§7.3/§7.4 제목의 "v4" 표기 제거**. smoke-reset.sh 헤더 (v4) → (v6) 업데이트.
  - **codex 재검증 결과 (Panel Mode D)**: **VERDICT = APPROVE-WITH-CHANGES**. P1 없음. P2 2건 (IV.B snippet placeholder · 4.A.teardown mode 문구) + P3 3건 (버전 표기 잔여) 지적 받음.
  - **v6 APPROVE 후속 P2/P3 반영** (codex commit 전):
    - §7.4.d IV.B snippet 에 `jq` 기반 registry before/after diff 실제 명령 추가. placeholder `"(same as IV.A step 4)"` 제거.
    - 파일별 리포트 템플릿 Stage 3 를 IV.A (WARN 허용) / IV.B (registry diff 1차, 로그 보조) 구조로 재작성.
    - §4.A.teardown 에 `bash scripts/smoke-reset.sh between-pass` 로 mode 명시. Obsidian quit + IV.B 수행 단계 추가.
    - §2.1.1 / §3.2.2 / §9 제목의 잔여 (v4) · (v3, 2-pass) 버전 표기 제거.
