# Phase 4.1.3 — Bitmap OCR 본문 오염 차단 + 검증 모듈 설계 확장

> **상위 문서**: [`activity/phase-4-result.md`](../activity/phase-4-result.md) · [`plan/phase-4-todo.md`](./phase-4-todo.md) — 본 문서는 §4.1.3 (Bitmap OCR 본문 오염 차단 플랜) 보조 자료. 명명규칙: `phase-N-todox-<section>-<topic>.md` / `phase-N-resultx-<section>-<topic>-<date>.md` — `CLAUDE.md §문서 명명규칙·조직화` 참조.


> 작성: 2026-04-22
> 상태: 진행 전 (다음 세션 최우선)
> Mirror: `plan/phase-4-todo.md §4.1.3`, `activity/phase-4-result.md §4.1.3`
> 선행 의존: §4.5.1.6 완료 (2026-04-22, 29-run CV 9.2%)
> 후속 gate: §4.5.1.7 (§4.1.3 완료 후 재평가)

---

## 1. 경위 및 발견

### 1.1 §4.5.1.6 완료 직후 사용자 지적

§4.5.1.6 (29-run Total CV 9.2%) 커밋 직후, "느낌이 들어" 라는 사용자 직관에서 시작된 재검토:

> "원본 자체 (*.md) 로 converting 자체가 잘못되어 있다는거야... PMS_제품소개....pdf 가 docling 에서 convert된 결과물인 pms_제품소개...md 파일이 잘못 컨버팅 되었다고 생각해. 강제로 ocr 로 돌려서 그런지 (그냥 이미지 base64 로 처리되어야 함) 이미지내의 문자를 인식해서 의미있는 문단 다음에 단어들이 파편화 되어 있다고..."

### 1.2 실증 확인

**PMS sidecar MD 관찰** (`raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf.md`):
- 1921 라인 중 다수 라인 (예: line 41-89, 94-96, 106-120) 이 UI 스크린샷·대시보드 목업의 OCR 파편.
- 구체 예:
  - `LOTUS / 일반 / Classic/ New Home / 2022.10.14 | 금요일 / 11:46 AM`
  - `22A002 참여 프로젝트명 01`
  - `작업요청 (6) / 요청 / 오늘 예정된 업무에 최선을 다해 주세요`
  - `미사용시 15분후 홈 돌아오기 V`
  - `로젝트 기관 생산에 최적회원 업무공유출도전: GOODSTREAM 1` (깨진 OCR)
- 본문 중간에 OCR 파편이 interleave → LLM 이 "legit content" 로 해석해 false entity/concept 추출.

**Docling CLI 실측**:
- Tier 1 현재 (default): 1921 라인, OCR 파편 다수.
- `--no-ocr` 전환: 531 라인, OCR 파편 **완전 제거**, 본문 보존, 이미지는 base64 embedded.
- `--image-export-mode placeholder`: 1284 라인, base64 만 제거, OCR 파편은 그대로 남음.

**JSON bbox 분석** (DoclingDocument `--to json`):
- 전체 texts: 1473 개.
- Picture bbox 내부 포함 texts: **831 개 (56.4%)**.
- 즉 현재 Tier 1 MD 본문의 절반 이상이 screenshot OCR 오염.

### 1.3 프로세스 오류 확증

**검증 모듈 (`wikey-core/src/convert-quality.ts::scoreConvertOutput`) 은 존재·호출·실행 모두 정상**:
- 호출 지점: `ingest-pipeline.ts:1194/1227/1232` (Tier 1 직후, Tier 1b 직후, Tier 1 vs 1b 비교).
- 4 개 signal:
  1. `broken-tables` (`|` 빈 행 비율 > 50%)
  2. `empty-sections` (헤딩 직후 50자 미만 비율 > 50%)
  3. `min-body-chars` (전체 본문 < 100자)
  4. `korean-whitespace-loss` (15자+ 한글 토큰 비율 > 30%)

**PMS 에서 4 개 모두 통과** → `decision = 'accept'` → finalize → 캐시 → LLM 파이프라인 전달.
- broken-tables: 0 (정상 테이블)
- empty-sections: 0 (섹션 본문 충분)
- min-body-chars: 83KB stripped (풍부)
- korean-whitespace-loss: **4.93%** (임계 30% 훨씬 미달 — convert-quality.ts line 180 주석에 "PMS 제품소개 textlayer: 4.93% (감지 X, force-ocr 스킵이 정답)" 명시)

**⇒ 검증 모듈의 설계 결함**: 4 개 signal 이 전부 **"text-layer 실패"** 범주만 커버. **"bitmap OCR 이 본문에 interleave"** 범주에 대한 signal 부재. 모듈이 기능적으로 정상이어도 PMS 같은 문서를 잡지 못함.

### 1.4 설계 의도와 구현의 불일치

사용자 설계 의도 (반복 확인):
> "ocr 은 스캔이미지, 또는 인터넷 강제 프린트물에만 사용하는 옵션으로 결정됐었는데."
> "문서 인식은 잘되고 이미지가 있는경우는 기본값인 base64 로 인코딩해서 embedde 하면 되지."
> "tier-2 도 tier-1 에서 문서가 제대로 인식이 안되는 경우에 넘어가는 거잖아... 전체 문서가 스캔이미지 또는 인터넷 프린트처럼 인식이 안되거나 불량률이 많거나 하면 --ocr 옵션을 넣어서 더 결과치가 좋은 것 쓰면 되는 거고..."

정책:
- Tier 1 (기본): vector text + base64 images, **bitmap OCR 없음**.
- Tier 1a (스캔·프린트물 escalation): 본문 인식 실패 / 불량률 높음 → `--ocr` 추가 재시도, 좋은 결과 채택.
- Tier 1b (한국어 공백 소실): `--force-ocr` (기존 유지).

**구현**: 현재 `buildDoclingArgs(forceOcr=false)` 는 `--no-ocr` 을 넘기지 않아 Docling CLI 기본값 `--ocr` (enabled) 가 적용됨. 즉 **설계 의도는 "OCR 없음" 이나 실제로는 항상 bitmap OCR 이 돌고 있음**. Docling CLI 의미:
- `--ocr` / `--no-ocr` (default: `--ocr`): bitmap content 에 OCR 적용.
- `--force-ocr` / `--no-force-ocr` (default: `--no-force-ocr`): 기존 vector text 를 OCR 로 교체.

사용자가 "OCR 은 스캔만" 이라고 한 것은 `--force-ocr` 에 대한 것이고 그건 정확히 구현됨. 그러나 `--ocr` (bitmap 영역) 은 명시적으로 꺼져야 하는데 누락.

### 1.5 §4.5.1.5/6 측정 결과의 재해석 필요

§4.5.1.5 (Phase A/B/C 이행) 및 §4.5.1.6 (determinism + canonicalizer 3차) 의 측정 baseline 은 **모두 이 오염된 MD 위에서 수행**:

| 측정 | CV | 입력 상태 |
|---|---|---|
| §4.5.1.4 baseline | 32.5% | 오염 |
| §4.5.1.5 30-run | 24.3% | 오염 |
| §4.5.1.6 10-run | 7.2% | 오염 |
| §4.5.1.6 29-run | 9.2% | 오염 |

가능한 해석:
- (a) §4.5.1.6 의 canonicalizer 3차 (alias/pin) 가 OCR 파편까지 canonical 로 뭉쳐서 CV 가 낮아진 것일 수 있음 — legitimate variance 를 잡은 건지 불분명.
- (b) determinism (temperature=0 + seed=42) 은 LLM 샘플링 결정화는 확실히 하지만, 오염된 입력 자체가 결정적 해석을 갖는 것은 아님.
- (c) §4.5.1.7 의 대부분 하위 과제 (attribution / Concepts prompt / Lotus variance) 가 오염 위에서 설계됨 → §4.1.3 완료 후 재평가 필수.

---

## 2. 구현 범위 및 우선순위

### 2.0 루틴 아키텍처 (2026-04-22 재확정)

**사용자 원칙**: "docling 을 기본값에서 결과물에 따라 검증하고, 검증 결과에 따라 변경 옵션으로 결과물 확인하는 루틴 적용."

즉 **default-first, verify, failure-specific escalation**:

```
Tier 1: docling (default, --ocr on by Docling default)
  ↓
scoreConvertOutput (5 signals 포함 — 4 기존 + image-ocr-pollution 신규)
  ↓
decision branching:
  ├─ accept                          → finalize (Tier 1)
  ├─ 'retry-no-ocr' (pollution)      → Tier 1a (--no-ocr) 재시도 → 비교 → 나은 것
  ├─ 'retry' (korean whitespace)     → Tier 1b (--force-ocr) 재시도 → regression guard
  ├─ 'reject' OR isLikelyScanPdf     → Tier 2 (markitdown) fallthrough
```

Tier 1 은 **docling CLI 기본값 그대로**. `--no-ocr` 는 **escalation 옵션** (pollution 감지 시에만). `--force-ocr` 는 기존 escalation (korean whitespace loss).

### 2.1 6 개 sub-task

| ID | 제목 | 의존 | 예상 |
|---|---|---|---|
| §4.1.3.1 | `buildDoclingArgs` 에 `mode: 'default' \| 'no-ocr' \| 'force-ocr'` 파라미터 | — | 20 분 |
| §4.1.3.2 | `scoreConvertOutput` `image-ocr-pollution` signal + `retry-no-ocr` decision (TDD) | — (병렬) | 60 분 |
| §4.1.3.3 | `extractPdfText` 루틴 확장 — Tier 1 → (pollution) Tier 1a `--no-ocr` 재시도 + 비교 | §4.1.3.1~2 | 60 분 |
| §4.1.3.4 | 5 개 코퍼스 회귀 테스트 | §4.1.3.1~3 | 60 분 |
| §4.1.3.5 | PMS 재측정 (10-run) + §4.5.1.5/6 재해석 | §4.1.3.4 | 60 분 |
| §4.1.3.6 | 문서 동기화 + commit/push | §4.1.3.5 | 30 분 |

**총 예상 약 5 시간** (단일 세션 가능 범위).

### 2.2 완료 기준 (Evidence-Based)

1. `npm test` 315 → ≥325 PASS (신규 TDD 약 10 개).
2. `npm run build` 0 errors (tsc + esbuild).
3. PMS sidecar `.md` 재생성 후 육안 검증 — OCR 파편 제거 확인.
4. 5 개 코퍼스 quality check 결과표 (accept/retry/reject + score + flags).
5. PMS 10-run determinism 측정 결과 (§4.5.1.6 9.2% 와 비교).
6. `activity/phase-4-result.md §4.1.3` 상세 기록 + `plan/phase-4-todo.md §4.1.3` 체크박스 모두 `[x]`.
7. 단일 commit + push.

---

## 3. 상세 설계

### 3.1 §4.1.3.1 — `buildDoclingArgs` mode 파라미터 (default / no-ocr / force-ocr)

**수정 파일**: `wikey-core/src/ingest-pipeline.ts::buildDoclingArgs`

**현재**:
```ts
function buildDoclingArgs(fullPath, outputDir, config, forceOcr = false): string[] {
  // ... --ocr-engine / --ocr-lang 을 forceOcr 여부와 무관하게 포함
  if (forceOcr) args.push('--force-ocr')
  return args
}
```

**변경** — 명시적 3-mode 파라미터로 전환:
```ts
export type DoclingMode = 'default' | 'no-ocr' | 'force-ocr'

function buildDoclingArgs(
  fullPath: string,
  outputDir: string,
  config?: WikeyConfig,
  mode: DoclingMode = 'default',
): string[] {
  const tableMode = config?.DOCLING_TABLE_MODE || 'accurate'
  const device = config?.DOCLING_DEVICE || (process.platform === 'darwin' ? 'mps' : 'cpu')
  const ocrEngine = config?.DOCLING_OCR_ENGINE || (process.platform === 'darwin' ? 'ocrmac' : 'rapidocr')
  const ocrLang = config?.DOCLING_OCR_LANG || 'ko-KR,en-US'
  const args = [
    fullPath,
    '--to', 'md',
    '--output', outputDir,
    '--table-mode', tableMode,
    '--device', device,
    '--image-export-mode', 'embedded',
  ]
  switch (mode) {
    case 'default':
      // Tier 1: docling CLI 기본값 그대로. bitmap OCR (--ocr) on by Docling default.
      args.push('--ocr-engine', ocrEngine, '--ocr-lang', ocrLang)
      break
    case 'no-ocr':
      // Tier 1a (escalation on image-ocr-pollution): bitmap OCR 억제
      args.push('--no-ocr')
      break
    case 'force-ocr':
      // Tier 1b (escalation on korean whitespace loss): vector text 무시, 전체 OCR 재생성
      args.push('--force-ocr', '--ocr-engine', ocrEngine, '--ocr-lang', ocrLang)
      break
  }
  return args
}
```

**Key 변경**: Tier 1 은 **여전히 docling 기본값**. `--no-ocr` 는 escalation 전용 옵션. 사용자 원칙 ("default + failure-specific escalation") 반영.

**캐시 키**: `doclingMajorOptions` 에 `mode` 필드 추가 → Tier 1 / Tier 1a / Tier 1b 결과가 서로 다른 캐시 키로 저장.

**TDD**:
```ts
describe('buildDoclingArgs — §4.1.3.1 mode parameter', () => {
  it("mode='default': docling CLI 기본값 유지 (--no-ocr 없음, --force-ocr 없음)", () => {
    const args = buildDoclingArgs('/p.pdf', '/tmp', config, 'default')
    expect(args).not.toContain('--no-ocr')
    expect(args).not.toContain('--force-ocr')
    expect(args).toContain('--ocr-engine')
  })
  it("mode='no-ocr': --no-ocr 포함, ocr-engine/ocr-lang 생략", () => {
    const args = buildDoclingArgs('/p.pdf', '/tmp', config, 'no-ocr')
    expect(args).toContain('--no-ocr')
    expect(args).not.toContain('--force-ocr')
    expect(args).not.toContain('--ocr-engine')
  })
  it("mode='force-ocr': --force-ocr + engine/lang 포함", () => {
    const args = buildDoclingArgs('/p.pdf', '/tmp', config, 'force-ocr')
    expect(args).toContain('--force-ocr')
    expect(args).toContain('--ocr-engine')
    expect(args).not.toContain('--no-ocr')
  })
})
```

### 3.2 §4.1.3.2 — `scoreConvertOutput` `image-ocr-pollution` signal

(구 §4.1.3.3 — 선행 구현으로 이동. §4.1.3.3 은 `extractPdfText` 루틴 확장.)

**수정 파일**: `wikey-core/src/convert-quality.ts`

**설계 원칙 확장**:
- 기존: "text-layer 실패 감지".
- 신규: "**본문 흐름에 섞인 non-body 콘텐츠 감지**" 까지 확장.

**신규 함수** `hasImageOcrPollution(md: string): boolean`:

기준 3 가지 (2 이상 true → pollution 판정):
1. **기준 A — 마커 근접 파편 클러스터**:
   - `<!-- image -->` 또는 `![image](...)` placeholder 마커의 전후 ±5 라인 윈도우.
   - 해당 윈도우 내 비어있지 않은 라인 중 **<20 자 라인이 3 개 이상 연속** 출현.
2. **기준 B — 파편 라인 비율**:
   - 전체 비어있지 않은 라인 중 "1-3 단어 + 총 20 자 미만" 패턴 비율.
   - > 20% 이면 flag on.
3. **기준 C — 언어 혼재 변동성**:
   - 연속 라인 간 한국어/영어/숫자 혼재 비율의 변동.
   - Z-score 기반 임계: 인접 라인 대비 혼재율 차이 > 0.5 인 구간이 전체의 > 15%.

**v1 구현**: 기준 A 만 (신호 강함 + false positive 위험 낮음). B, C 는 실측 후 추가.

**`scoreConvertOutput` 통합**:
```ts
export type QualityDecision = 'accept' | 'retry' | 'retry-no-ocr' | 'reject'

if (hasImageOcrPollution(md)) {
  flags.push('image-ocr-pollution')
  score -= 0.4
  // decision 우선순위: korean-whitespace-loss 먼저 (retry),
  //                    없으면 image-ocr-pollution (retry-no-ocr),
  //                    그 외 점수 기반.
  if (!koreanLoss) {
    decision = 'retry-no-ocr'
  }
}
```

**TDD**:
```ts
it('detects image-ocr-pollution in PMS sidecar', () => {
  const pmsMd = fs.readFileSync('docs/samples/pms-polluted.md', 'utf8')
  expect(hasImageOcrPollution(pmsMd)).toBe(true)
})
it('clean PMS (--no-ocr version) has no pollution', () => {
  const cleanMd = fs.readFileSync('docs/samples/pms-clean.md', 'utf8')
  expect(hasImageOcrPollution(cleanMd)).toBe(false)
})
it('short list items without image markers are not flagged', () => {
  const listMd = '# Title\n\n- item 1\n- item 2\n- item 3\n\n본문...'
  expect(hasImageOcrPollution(listMd)).toBe(false)
})
it("scoreConvertOutput returns 'retry-no-ocr' when pollution detected without whitespace loss", () => {
  const result = scoreConvertOutput(pmsMd)
  expect(result.flags).toContain('image-ocr-pollution')
  expect(result.decision).toBe('retry-no-ocr')
})
```

### 3.3 §4.1.3.3 — `extractPdfText` 루틴 확장 (default-first, failure-specific escalation)

**수정 파일**: `wikey-core/src/ingest-pipeline.ts::extractPdfText`

**현재 흐름**:
```
Tier 1 (docling 기본값, --ocr on by default) → scoreConvertOutput
  ├─ accept AND !isScan → finalize
  ├─ retry (korean whitespace) → Tier 1b (--force-ocr)
  └─ reject OR isScan → Tier 1b (--force-ocr)
```

**신규 흐름** (사용자 원칙: default-first + failure-specific escalation):
```
Tier 1 (docling 기본값 그대로) → scoreConvertOutput (+ pollution signal)
  ├─ accept AND !isScan                     → finalize (Tier 1)
  ├─ decision='retry-no-ocr' (pollution)    → Tier 1a (--no-ocr) 재시도 + 비교
  │     ├─ Tier 1a score > Tier 1 score    → finalize (Tier 1a)
  │     └─ Tier 1a score ≤ Tier 1 score    → finalize (Tier 1, pollution 경고 로그)
  ├─ decision='retry' (korean whitespace)   → Tier 1b (--force-ocr) 재시도
  │     └─ regression guard (기존 유지)     → finalize (Tier 1 or 1b)
  └─ decision='reject' OR isLikelyScanPdf   → Tier 1b (--force-ocr) 재시도
        └─ 기존 regression guard            → finalize 또는 Tier 2 fallthrough
```

**핵심 변경 점**:
- **Tier 1 = docling CLI 기본값 그대로** — `--no-ocr` 추가 안 함 (사용자 원칙 준수, skill 문서와 정합).
- **Tier 1a 신규** — pollution 감지 시 `--no-ocr` 로 재시도 후 점수 비교. 더 좋은 쪽 채택.
- **Tier 1b 기존 유지** — korean whitespace loss 및 scan PDF 경로.
- **비교 기반 채택** — Tier 1a 가 무조건 이기는 것이 아니라 score 비교 후 선택 (false positive 방어).

**의사코드**:
```ts
// Tier 1 — docling 기본값
const tier1Md = runDocling(fullPath, 'default')
const tier1Quality = scoreConvertOutput(tier1Md)
const tier1IsScan = isLikelyScanPdf(tier1Md, pageCount)

if (tier1Quality.decision === 'accept' && !tier1IsScan) {
  return finalize(tier1Md, '1-docling')
}

// Escalation A: image-ocr-pollution → Tier 1a (--no-ocr) 비교
if (tier1Quality.decision === 'retry-no-ocr') {
  const tier1aMd = runDocling(fullPath, 'no-ocr')
  const tier1aQuality = scoreConvertOutput(tier1aMd)
  if (tier1aQuality.score > tier1Quality.score) {
    return finalize(tier1aMd, '1a-docling-no-ocr')
  }
  // Tier 1a 가 더 나쁘면 Tier 1 채택 (false positive 방어)
  warn('image-ocr-pollution detected but --no-ocr retry not improved — keeping Tier 1')
  return finalize(tier1Md, '1-docling')
}

// Escalation B: korean whitespace loss OR scan PDF → Tier 1b (--force-ocr)
if (tier1Quality.decision === 'retry' || tier1IsScan) {
  // 기존 Tier 1b 경로 유지 (regression guard 포함)
  return tryTier1b(tier1Md)
}

// decision='reject' 그 외 → Tier 2 fallthrough
```

**TDD** (기존 테스트 유지 + 신규):
- Tier 1 accept 시 재시도 호출 안 함.
- `retry-no-ocr` decision 시 `--no-ocr` mode 로 Tier 1a 호출.
- Tier 1a score > Tier 1 score 시 Tier 1a 채택.
- Tier 1a score ≤ Tier 1 score 시 Tier 1 채택 (false positive 방어).
- `retry` (korean whitespace) decision 은 기존대로 Tier 1b 직행.
- `isLikelyScanPdf` 는 기존대로 Tier 1b 로 라우팅 (scan PDF 는 pollution retry 무의미).

### 3.4 §4.1.3.4 — 5 개 코퍼스 회귀 테스트

**대상**:
| 문서 | 특성 | 기대 Tier |
|---|---|---|
| PMS_제품소개_R10 | Vector PDF + UI screenshots | Tier 1 (no-ocr) accept |
| ROHM_Wi-SUN | 한국어 공백 소실 | Tier 1 → retry → Tier 1b force-ocr accept |
| TWHB | Tables 많음 | Tier 1 accept |
| OMRON_HEM-7600T | 스캔 PDF | Tier 1 reject+scan → Tier 1a accept (또는 Tier 1b) |
| GOODSTREAM 사업자등록증 | Simple | Tier 1 accept |

**실행**:
```bash
# 1. 캐시 invalidate
rm -rf ~/.cache/wikey/convert/

# 2. 각 문서 재변환 (ingest 대신 직접 docling 호출 + scoreConvertOutput)
for src in PMS ROHM TWHB OMRON 사업자등록증; do
  # 테스트 스크립트 작성: runTier1 → quality → runTier1a (if reject/scan) → quality → ...
done
```

**기록 형식** (activity/phase-4-1-3-regression-benchmark.md):
| 문서 | Tier 채택 | score | flags | 본문 품질 육안 |
|---|---|---|---|---|
| PMS | 1-docling-no-ocr | 0.9 | [] | 정상 |
| ROHM | 1b-docling-force-ocr | 0.85 | [] | 정상 |
| ... | | | | |

### 3.5 §4.1.3.5 — PMS 재측정 + §4.5.1.5/6 재해석

**실행**:
```bash
# PMS sidecar 삭제 + 캐시 invalidate
rm raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf.md
rm -rf ~/.cache/wikey/convert/

# 10-run 측정
./scripts/measure-determinism.sh raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf \
  -n 10 -d -o activity/phase-4-1-3-pms-10run-clean-2026-MM-DD.md
```

**비교 매트릭스**:
| 지표 | §4.5.1.4 | §4.5.1.5 | §4.5.1.6 10-run | §4.5.1.6 29-run | §4.1.3.5 (신규) |
|---|---|---|---|---|---|
| Total CV | 32.5% | 24.3% | 7.2% | 9.2% | ? |
| 입력 | 오염 | 오염 | 오염 | 오염 | 깨끗 |

**시나리오별 §4.5.1.7 재평가**:
- **새 CV < 5%**: §4.5.1.6 의 개선 상당 부분이 OCR 파편 흡수였음. §4.5.1.7 대부분 불필요.
- **새 CV 5-10%**: 현 canonicalizer 3차 가치 확증. §4.5.1.7.2 (Concepts prompt) 만 선택적 검토.
- **새 CV 10-20%**: canonicalizer 3차는 진짜 legitimate variance 도 잡았으나 잔여 많음. §4.5.1.7 전체 sub-task 재평가.
- **새 CV > 20%**: canonicalizer 3차가 주로 OCR 파편 흡수. 문제 재설계 필요.

### 3.6 §4.1.3.6 — 문서 동기화

**업데이트 대상**:
1. `activity/phase-4-result.md §4.1.3` — 각 sub-task 증거 상세화 (§4.1.3.4 결과표, §4.1.3.5 CV 비교표).
2. `plan/phase-4-todo.md §4.1.3` — 체크박스 모두 `[x]`, 상단 status 갱신.
3. `plan/phase-4-todox-4.1.3-bitmap-ocr-fix.md` (이 파일) — 실제 값으로 업데이트 (예상 → 실측).
4. `plan/session-wrap-followups.md` — §4.1.3 완료 선언 + §4.5.1.7 gate 해제 + 시나리오별 권장 우선순위.
5. `wiki/log.md` — `fix` + `eval` 엔트리.
6. `~/.claude/projects/-Users-denny-Project-wikey/memory/project_phase4_status.md` + `MEMORY.md` — Phase 4 상태 업데이트.

**커밋 구조** (권장):
- Commit 1 (fix): `fix(phase-4.1.3): --no-ocr Tier 1 기본 + tier 1a/1b 체인 + image-ocr-pollution signal`
  - 포함: §4.1.3.1~3 코드 + TDD.
- Commit 2 (eval): `eval(phase-4.1.3): 5 코퍼스 회귀 + PMS 재측정 — CV ??% (오염 제거 후)`
  - 포함: §4.1.3.4 결과표 + §4.1.3.5 CV 비교.
- Commit 3 (docs): `docs(phase-4.1.3): result/todo/followups 동기화 + §4.5.1.7 gate 해제`

---

## 4. 리스크 및 mitigation

### 4.1 `--no-ocr` 로 본문 손실 위험

**시나리오**: 스캔 PDF 를 `--no-ocr` 로 처리하면 본문이 거의 안 뽑힘.

**Mitigation**:
- `isLikelyScanPdf` 가 기존 로직으로 감지 → Tier 1a escalation.
- 5 코퍼스 회귀 테스트 (§4.1.3.4) 에 OMRON 포함 → 스캔 PDF 경로 커버.

### 4.2 `image-ocr-pollution` false positive

**시나리오**: 짧은 리스트 항목이 많은 문서를 OCR 파편으로 오인.

**Mitigation**:
- 기준 A 는 반드시 `<!-- image -->` 마커 근접 요구 → 리스트는 걸리지 않음.
- 기준 B, C 는 초기엔 생략. PMS 외 4 코퍼스가 pollution=false 나오는지 확인.

### 4.3 §4.5.1.6 결과 무효화 위험

**시나리오**: §4.1.3.5 측정에서 새 CV 가 §4.5.1.6 보다 나쁘면 "이전 커밋의 가치" 가 논란.

**Mitigation**:
- 솔직 보고. "과거 9.2% 는 오염 입력 위에서의 값" 을 명시.
- canonicalizer alias/pin 3차 확장은 legitimate 변형도 흡수하므로 rollback 불필요. 측정 기준만 재설정.

### 4.4 캐시 키 충돌

**시나리오**: `--no-ocr` 도입 후 기존 캐시가 stale. `doclingMajorOptions` 에 포함 안 됨.

**Mitigation**:
- `doclingMajorOptions` 에 `no_ocr: true/false` 필드 추가 → 캐시 키에 반영.
- §4.1.3.1 작업에 포함.

---

## 5. 완료 후 §4.5.1.7 재평가 체크리스트

| Sub-task | gate | 재평가 결정 규칙 |
|---|---|---|
| §4.5.1.7.1 attribution ablation | §4.1.3.5 완료 | 새 CV < 10% → 축소 (A/D 점 2 points only); 새 CV > 10% → 유지 |
| §4.5.1.7.2 Concepts prompt (PMBOK 9) | §4.1.3.5 완료 | Concepts CV < 15% → 불필요; > 15% → 유지 |
| §4.5.1.7.3 측정 infra | — (독립) | 유지 (run 30 outlier 는 §4.1.3 와 독립) |
| §4.5.1.7.4 Route SEGMENTED | — (독립) | 유지 (Ollama 환경 production guide) |
| §4.5.1.7.5 Lotus-prefix variance | §4.1.3.5 완료 | Entities CV < 8% → 불필요; > 8% → 유지 |
| §4.5.1.7.6 BOM 축 재분할 | — (독립) | 유지 (실무 판단) |
| §4.5.1.7.7 log_entry cosmetic | — (독립) | 유지 (cosmetic, 빠름) |

---

## 6. 참고

- 실증 결과 (이 세션): `/tmp/docling-noocr/`, `/tmp/docling-placeholder/`, `/tmp/docling-json/`
- 현재 오염된 sidecar: `raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf.md` (1921 라인)
- 검증 모듈: `wikey-core/src/convert-quality.ts::scoreConvertOutput`
- Docling 스킬 문서: `~/.claude/skills/docling/SKILL.md` (Tier 1/2 정책 명시)
- §4.5.1.6 결과 (재해석 대상): `activity/phase-4-resultx-4.5.1.6-pms-10run-2026-04-22.md`, `activity/phase-4-resultx-4.5.1.6-pms-30run-final-2026-04-22.md`
