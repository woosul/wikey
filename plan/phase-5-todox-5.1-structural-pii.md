# Phase 5 §5.1 — 구조적 (Multi-line 폼) PII 탐지 보조 계획서

> **상위 문서**: [`plan/phase-5-todo.md`](./phase-5-todo.md) · [`activity/phase-5-result.md`](../activity/phase-5-result.md) — 본 문서는 §5.1 (Multi-line 폼 label↔name 상관 해결, P0 긴급) 보조 자료. 명명규칙: `phase-N-todox-<section>-<topic>.md` / `phase-N-resultx-<section>-<topic>-<date>.md` — `rules/docs-organization.md` 참조.

> **작성일**: 2026-04-25
> **버전**: v4
> **이력**:
> - 2026-04-25 v1 — 초안 (analyst). 안 C 채택, Q1/Q2/Q6 오픈.
> - 2026-04-25 v2 — codex (Mode D Panel) FAIL 판정 8 findings 반영 (P1 2건, P2 4건, P3 2건). 주요 변경: 3-단계 fixture 재현·회사명 접두어 YAML 배제·`windowLines` 재정의·multi-value capture·YAML loader discriminated union·smoke 성공 기준 구조 기반·FP baseline corpus 명시·TDD 순서 RED-first·default bundled YAML.
> - 2026-04-25 v2 사용자 승인 — Q8 (non-goal 확정) · Q9 (N=30 baseline) 결정 반영. §11 "사용자 결정 완료" 로 상태 전환. 착수 가능 (§5.1.1.1~10).
> - 2026-04-25 v3 — codex v2 재검증 FAIL 9 findings 반영 (P2 6 · P3 3). 주요: patternType optional / filename explicit skip / synthetic 회사명 / provenance assertion 정합 / FP 0-of-30 threshold / ESM path / §4.1 용어 통일 / contextBeforeValue 축소.
> - 2026-04-25 v4 — codex v3 재검증 FAIL 6 findings 반영 (P2 2건 / P3 4건). §1 redact · loader 전체 ESM · §4.1/§476/§492 stale 문구 정리 · sidecar 경로 정정 · Q1-3 답변.
> **실행 단일 소스**: `plan/phase-5-todo.md §5.1` (체크박스 = 진행 상태). 본 문서는 설계·비교·테스트 전략만 기술.
> **작성 주체**: analyst (사용자 승인 전 계획 확정 목표)
> **하드코딩 절대 금지**: 사용자 방침 (2026-04-24) — 모든 신규 패턴·접두어·라벨·이름 목록은 yaml 선언으로만 관리. TS literal 리스트 금지 (회사명 접두어·성명 슬러그 포함).

---

## 1. 배경 요약 (P0 긴급 근거)

Phase 4 D.0.l smoke v2 (2026-04-24) 에서 **실누출** 재현. 증거:

- `activity/phase-4-resultx-4.6-smoke-2026-04-24-v2/pass-a-file-2.md §PII 검증 증거 요약 matrix`
- `activity/phase-4-resultx-4.6-smoke-2026-04-24-v2/pass-b-file-2.md` (동일 구조)
- 대상 파일 유형: 사업자등록증 Adobe Scan PDF (1p). 실제 파일명·회사명·CEO 성명·슬러그는 상기 smoke 리포트에 기록된 구조와 동일하며, 본 §5.1 범위 내에서는 **structure-preserving synthetic** 으로 대체해 기술한다 (하드코딩 금지 강화, P2-v3-a).

누출 유형 (synthetic 로 재기술):
- `wiki/sources/<smoke sourceId>.md` 본문에 raw BRN `XXX-XX-XXXXX` × 3
- `wiki/entities/<synthetic-ceo-slug>.md` — CEO 성명 entity 페이지 생성 (양 pass 에서 OCR 변이 포함 복수 슬러그 생성. 실제 슬러그 값은 smoke pass-a-file-2.md 에 기록, 본 문서에는 복제하지 않음)
- `wiki/index.md` · `wiki/log.md` 에 CEO 성명 확산

**실 repro 의 정확한 구조 (docling markdown 기준, synthetic 예시)**:
```
대 표 자

주식회사 테스트벤치

홍 길 동
```
→ label (`대 표 자`) ↔ CEO value (synthetic `홍 길 동`) 사이에 **회사명 줄 (synthetic `주식회사 테스트벤치`)** 이 끼어 있음. 빈 줄 2개 포함. label 다음 **4번째 줄 이후**에 CEO 등장. single-line regex 는 이 구조를 일체 커버 못 함. 실 smoke 입력의 원본 값은 `pass-a-file-2.md` 에 기록된 구조와 동일 — raw 값 본 §5.1 에 복제 금지.

근본 구조 원인 (session 8 코드 분석, `activity/phase-4-result.md §4.8.2`):
- `wikey-core/src/pii-patterns.ts` DEFAULT_PATTERNS 의 `ceo-label` 패턴은 `(?:대표이사|대표자|CEO)\s*[:：]\s*([가-힣](?:[ \t]*[가-힣]){1,3})` — **single-line 에서만 label↔value 연결**. 콜론·라벨·값이 한 줄 안에 있어야 작동.
- 스캔 PDF 폼은 `대 표 자` label 과 synthetic CEO value 사이에 blank line / company name / table cell 구분이 들어감 — regex 미탐.
- 결과: CEO 성명이 non-labeled 한글 이름으로 LLM prompt 에 그대로 전달 → canonicalizer 가 entity 로 매핑.
- 공개 repo 의 `wiki/` 에 개인정보가 축적되는 구조적 위험.

**P0 긴급 사유**: PII-heavy 한국 기업 문서 (사업자등록증 · 계약서 · 법인 등기부등본 · 이력서) 는 대부분 스캔 PDF 폼이며, 세 줄짜리 label-value 구조가 규범. 지금 해결하지 않으면 wikey 인제스트가 모든 비슷한 소스에서 PII 전파.

---

## 2. 해결 방향 3안 비교 분석

### 2.1 안 A — Table-aware parser (Docling table metadata 활용)

| 항목 | 내용 |
|------|------|
| 메커니즘 | Docling 이 PDF → markdown 변환 시 표 구조를 이미 인식. table row/column 을 JSON 메타로 보존 → label cell 이 PII-trigger 키워드 (`대표자` 등) 이면 같은 row/column 의 value cell sanitize |
| 의존성 | docling 출력의 table JSON 레이어 접근 경로 확인 필요 (현재 wikey 는 markdown 만 소비). extraction pipeline 1단 확장 |
| 강점 | 명확한 구조적 근거. false positive 최소. 표가 많은 공문서·계약서에 강력 |
| 약점 | 스캔 PDF 의 OCR 결과는 table 경계가 부정확. 자유형 multi-column (세로 배치) · 줄바꿈 구분 폼은 table 로 인식되지 않음. docling 외 경로 (HWP/DOCX sidecar · web-clipper markdown) 는 미지원 |
| FP 리스크 | 낮음 (구조 신호 강함) |
| 하드코딩 금지 호환 | 양호 — trigger 라벨 목록을 yaml 로 선언 가능 |
| 예상 비용 | docling 출력 타입 조사 + extraction pipeline 분기 신설 · **의존성 +0 but 구조 작업 큼** (~400 LOC) |

### 2.2 안 B — Lightweight NER (한국어 named entity model)

| 항목 | 내용 |
|------|------|
| 메커니즘 | kiwipiepy/KoNLPy PoS 또는 KoELECTRA-NER 로 person 엔티티 식별 → 문서 내에서 PII-trigger 라벨 근처 (window ±N) 에 위치한 person 만 sanitize |
| 의존성 | Python 모델 (KoELECTRA-small ≈ 50MB) 또는 형태소 분석기. wikey 는 TS 본체 — IPC 브리지 필요. kiwipiepy 는 이미 qmd 인덱스에서 사용 중이므로 재활용 가능 |
| 강점 | 라벨이 빠져도 문서 컨텍스트만으로 성명 인식. 문학 텍스트·회의록처럼 폼 구조가 없는 소스에도 작동 |
| 약점 | 모델 로딩 지연 (cold start 1~3초). 오탐: 지명·조직명과 성명 혼동 (`김천` 지역명 vs 성명). 품질이 모델 학습 분포 의존. BRN/법인번호 같은 숫자 PII 는 별개 경로 필요 |
| FP 리스크 | 중 (인명·지명 혼동). 마스킹으로 인한 문장 손상 |
| 하드코딩 금지 호환 | 중간 — 모델 자체는 블랙박스. threshold/window 는 yaml 노출 가능하나 모델 결정 경로 사용자 튜닝 불가 |
| 예상 비용 | IPC 브리지 (audit-ingest.py 패턴 재사용) + NER 호출 + fixture 커버리지. **의존성 +1~2 (kiwipiepy 이미 있음)** · ~500 LOC + 외부 모델 관리 |

### 2.3 안 C — Context window heuristic (label 발견 시 ±N 줄 scan)

| 항목 | 내용 |
|------|------|
| 메커니즘 | yaml 에 `labelPattern` + `valuePattern` + `windowLines`/`windowChars` + `valueExcludePrefixes` 선언. pipeline 이 본문에서 labelPattern 일치 위치마다 forward window 를 열고 window 내 valuePattern **모든 일치 (multi-value capture)** 중 `valueExcludePrefixes` 에 걸리지 않는 후보를 전부 sanitize. 현재 single-line regex 엔진을 "scan + window + exclude" 로 확장 |
| 의존성 | **없음** — 순수 TS, regex 엔진만 확장 |
| 강점 | 가장 단순. 기존 `PiiPattern` 인터페이스를 **discriminated union** 으로 확장해 `SingleLinePiiPattern` + `StructuralPiiPattern` 으로 분리. YAML 선언 그대로 통과 (사용자가 windowLines, labelPattern, 회사명 접두어 추가 가능). 문서 경로 (PDF/HWP/DOCX/markdown) 무관하게 작동 |
| 약점 | label-value 사이 다른 문자가 끼는 경우 windowLines 튜닝이 소스마다 다를 수 있음. 서술형 ("대표자는 ... 홍길동 씨") 에 FP 여지 존재 — yaml 로 valuePattern 엄격화 (양 끝 경계·prefix exclude) 로 완화 |
| FP 리스크 | 중 → 낮음 (v2 에서 multi-value + prefix exclude 도입으로 완화) |
| 하드코딩 금지 호환 | **최상** — 모든 트리거·값 패턴·윈도우·회사명 접두어 blacklist 가 yaml 로 표현 가능. 사용자가 vault 단위로 튜닝 |
| 예상 비용 | `pii-patterns.ts` + `pii-redact.ts` scanner 1단 확장. **의존성 +0** · ~200 LOC + 테스트 |

### 2.4 3안 비교 요약

| 기준 | A Table | B NER | C Window |
|------|---------|-------|----------|
| 의존성 증가 | 0 (구조 작업 大) | 1~2 (모델) | 0 |
| 커버리지 | 표 한정 | 넓음 | PDF/HWP/DOCX 공통 |
| FP 리스크 | 낮음 | 중 | 중 → 낮음 (v2 보정) |
| 구현 규모 | ~400 LOC | ~500 LOC + 모델 | ~200 LOC |
| 사용자 튜닝 가능성 | 보통 (trigger 목록만) | 낮음 | **최상** (선언적 전체) |
| Karpathy #2 Simplicity | 중 | 낮음 | **최상** |
| 하드코딩 금지 친화성 | 양호 | 중 | **최상** |

---

## 3. 권고 설계 — 안 C (Window heuristic) + multi-value + prefix-exclude 가드

**결론**: §5.1 의 default 해법은 **안 C (Context window heuristic)**. 단, v1 의 "first match" 선택 전략은 실 repro (label → 회사명 → CEO 3-단 구조) 를 놓치므로 아래 3 가지 보강:

1. **Multi-value capture** — window 내 valuePattern 의 **모든 일치**를 후보로 수집 (first match 가 아님).
2. **Value prefix exclude (YAML 선언)** — `valueExcludePrefixes` (예: `주식회사`, `(주)`, `㈜`, `유한회사`, `재단법인`, `사단법인`) 를 yaml 로 선언. 후보 value 의 직전 토큰 또는 본문이 접두어 목록에 걸리면 후보에서 배제. **TS 리터럴 금지, YAML 단일 소스**.
3. **windowLines 재정의** — "물리적 N 줄" 이 아닌 **"N 개의 non-empty 줄"** 로 재정의 (Q2 확정). default `5` (실 repro 4번째 줄 이후 CEO 를 여유 있게 커버).

선택 근거를 Karpathy 4원칙으로 정리.

- **Think Before Coding**: 실누출 사례 3건 (CEO 성명) 은 전부 label-value 거리 ≤ 5 non-empty 줄. A/B 로 풀지 않아도 C 로 재현성 100% 해결 가능. 실 repro 구조 (label → 회사명 → CEO) 를 v2 에서 fixture + multi-value + prefix exclude 로 정확히 반영.
- **Simplicity First**: 의존성 0 / 기존 엔진 확장 / LOC 최소. NER 은 오버엔지니어링.
- **Surgical Changes**: `pii-patterns.ts` 의 `PiiPattern` 을 **discriminated union** 으로 전환. 기존 single-line regex 패턴·테스트·mask 경로는 전부 그대로. single-line 4개 패턴 (brn-hyphen, brn-contiguous, corp-rn, ceo-label) 은 건드리지 않음. loader 는 `patternType` (discriminator) 기반 분기 추가 (`kind` 는 reporting 전용, §4.1 참조).
- **Goal-Driven Execution**: 성공 기준이 측정 가능 (§12) — file 2 smoke 재실행에서 entity 페이지 생성 0 + FP baseline corpus 기준 ≤ 1/100 docs.

**A 안의 미래 가치**: docling table metadata 활용은 §5.5 (지식 그래프) 에서 table 구조 추출이 필요해질 때 재고. 지금은 스코프 밖.

**B 안 기각 근거**: 현재 누출 케이스는 label-value 거리 ≤ 5 non-empty 줄 — window heuristic 으로 해결됨. NER 은 label 이 소실된 자유형 서술에만 필요한데 위키 이용자 방침상 그런 소스는 raw/ 큐레이션 단계에서 차단.

---

## 4. 데이터 모델 확장 (discriminated union)

### 4.1 `PiiPattern` discriminated union 전환 (P2-b 대응)

현재 (`wikey-core/src/pii-patterns.ts`):
```ts
export interface PiiPattern {
  readonly id: string
  readonly kind: PiiKind        // 'brn' | 'corp-rn' | 'ceo-labeled' | string
  readonly regex: string
  readonly captureGroup?: number
  readonly mask: 'digits' | 'full'
  readonly description?: string
}
```

문제: `kind` 가 reporting kind (brn/corp-rn/ceo-labeled) 인데, structural 추가 시 discriminator 역할까지 겸임하면 타입이 꼬임. loader 의 `regex` 필수 검증이 structural 에 부적합.

**해결**: 최상위에 `patternType: 'single-line' | 'structural'` **discriminator** 추가 → 타입 분기 기준. 기존 `kind` 는 **reporting label** (BRN leak / CEO leak 집계 등) 로만 사용 — 분기 판단 근거 아님. v3 이후 본 문서에서 "분기/discriminate" 라는 표현은 모두 `patternType` 기준. `kind` 라는 단어는 reporting (audit log · telemetry · 사용자 통계) 맥락에서만 등장.

```ts
export type PiiKind = 'brn' | 'corp-rn' | 'ceo-labeled' | 'ceo-structural' | 'brn-structural' | string

/**
 * 기존 single-line 패턴 — 필드 그대로 유지, 회귀 0.
 *
 * **v3 중요**: `patternType` 은 **optional** (default `'single-line'`).
 * 이유: wikey-core 내부·외부 호출자·기존 테스트는 `{id, kind, regex, mask}`
 * 로 객체 리터럴을 직접 생성한다 (`pii-redact.test.ts :319,348,355` 등 —
 * `PiiPattern` type 을 직접 지정). `patternType` 을 required 로 만들면 모든
 * 호출자가 type error 로 깨지므로 ESM·CJS·벤더 YAML 호환을 위해 optional.
 */
export interface SingleLinePiiPattern {
  readonly id: string
  readonly patternType?: 'single-line'  // optional discriminator (default 'single-line')
  readonly kind: PiiKind                 // reporting kind (label)
  readonly regex: string
  readonly captureGroup?: number
  readonly mask: 'digits' | 'full'
  readonly description?: string
}

/** 신규 structural 패턴. `patternType` 은 이쪽에서는 **필수** — loader/compiler 의 분기 트리거. */
export interface StructuralPiiPattern {
  readonly id: string
  readonly patternType: 'structural'     // required discriminator
  readonly kind: PiiKind                  // reporting kind (ex 'ceo-structural')
  readonly labelPattern: string           // label regex
  readonly valuePattern: string           // value regex (내부 matching 대상)
  readonly windowLines: number            // "non-empty 줄" 수 (§Q2 확정, default 5)
  readonly windowChars?: number           // 보조: 줄 수 대신 char 반경
  readonly valueExcludePrefixes?: readonly string[]  // 회사명 등 접두어 blacklist (YAML 선언)
  readonly mask: 'digits' | 'full'
  readonly description?: string
}

export type PiiPattern = SingleLinePiiPattern | StructuralPiiPattern
```

**하위 호환 (P2-v2-a)**:
- `patternType` 필드가 **없거나 undefined** 인 입력은 `'single-line'` 으로 취급 → 기존 object literal (`{id, kind, regex, mask}`) 및 YAML entry 는 코드 변경 없이 그대로 동작.
- `compilePattern` / `loadPiiPatternsFromYaml` / `detectPiiInternal` 은 `p.patternType === 'structural'` 만 structural 경로로 분기. `undefined` 와 `'single-line'` 은 같은 (기존) 경로.
- 기존 `DEFAULT_PATTERNS` 4개는 **마이그레이션하지 않아도 동작**. 가독성 차원에서만 `patternType: 'single-line'` 명시 권장 (선택 — 명시 없으면 default).
- 영향 범위 (v3 후에도 기존 형태로 동작): `wikey-core/src/__tests__/pii-redact.test.ts` L319 (`{id, kind, regex, mask}`) · L348 (`{id, kind, regex, captureGroup, mask}`) · L355 (`{id, kind, regex, mask}`) + `pii-patterns.test.ts` (존재 시 동일) — TypeScript compile / vitest 전부 GREEN 유지.

### 4.2 bundled default YAML (P3-b, Q6, P3-v2-a 대응)

**Default 는 TS literal 금지, bundled YAML 로 배포**. 경로:

- 소스: `wikey-core/src/defaults/pii-patterns.default.yaml`
- 배포: `wikey-core/dist/defaults/pii-patterns.default.yaml` (빌드 시 복사)

**ESM 전용 프로젝트 확증 (P3-v2-a)**: `wikey-core/package.json` 의 `"type": "module"` 지정됨 (L4). 따라서 `__dirname` 은 런타임에 정의되지 않음. 대안:

- **채택: `new URL('./defaults/pii-patterns.default.yaml', import.meta.url)` + `fs.readFileSync`**.
  - 개발 환경 (vitest / ts-node): 소스 트리 `src/defaults/` 에서 resolve.
  - 배포 환경 (`dist/`): 빌드 스크립트가 `src/defaults/*.yaml` → `dist/defaults/*.yaml` 복사.
- 빌드 hook: `package.json` `scripts.build` 를 `tsc && node -e "require('node:fs').cpSync('src/defaults','dist/defaults',{recursive:true})"` 로 확장 (또는 동등한 npm `postbuild` 스크립트). `node:fs` 는 기본 모듈 — 신규 의존성 0.
- `package.json` `"files"` 에 `"dist"` 만 포함 (이미 L8) → 빌드된 yaml 자동 포함.
- 로드 실패 시 warn + 내장 `DEFAULT_PATTERNS` (TS literal 4종) 로 fallback → single-line 보호는 항상 보장.

**기존 `loadPiiPatterns(basePath?)` 는 `require('node:fs' | 'node:path' | 'node:os')` 를 사용 중** (src/pii-patterns.ts L209-211). `package.json` `"type": "module"` (L4) 이므로 `require` 는 CJS 경로 밖에서는 런타임 동작 보장 안 됨 (v3 에서 bundled YAML 만 ESM 화하면 loader 전체는 여전히 깨질 수 있음, P2-v3-b).

**v4 결정 — loader 전체 ESM 전환 (본 §5.1 범위 포함)**:
- `require('node:fs')` → `import fs from 'node:fs'`
- `require('node:path')` → `import path from 'node:path'`
- `require('node:os')` → `import os from 'node:os'`
- 전환은 module top-level import 로 한 번만. 함수 내부 `require` 호출 패턴 제거.
- bundled YAML 로드도 동일 import 된 `fs` 재사용 (`fs.readFileSync(new URL('./defaults/pii-patterns.default.yaml', import.meta.url))`).
- 실행 단계: §9 §5.1.1.3 (discriminated union 타입 추가) 와 §5.1.1.4 (loader union-aware) 사이에 **"loader ESM 전환"** subject 를 끼워 넣는다 (§5.1.1.4' — 본 v4 에서 단계 분해 재구성 시 §5.1.1.4 직전에 수행해 compile 전체 safe 보장). 기존 `pii-redact.test.ts` 21 tests + 신규 RED tests 10 종이 모두 GREEN 이어야 전환 완료.

로더 순서 (우선순위 낮→높): **bundled default** (`dist/defaults/pii-patterns.default.yaml`) → `~/.config/wikey/pii-patterns.yaml` → `<basePath>/.wikey/pii-patterns.yaml` (뒤가 override).

`DEFAULT_PATTERNS: readonly PiiPattern[]` 상수는 **유지하되 bundled YAML 로드 실패 시 fallback** 으로만 사용 (빈 배열 반환하지 않기 위함 — 빌드 에러·리소스 누락 시에도 single-line 4종은 보장).

YAML 선언 예시 (structural 추가분, bundled default 포함 candidate):

```yaml
patterns:
  # ... (기존 single-line 4종 YAML 로 이관)

  - id: ceo-multiline-form
    patternType: structural
    kind: ceo-structural
    labelPattern: '대\s*표\s*(?:자|이\s*사)|CEO|사\s*장'
    valuePattern: '[가-힣](?:[ \t]*[가-힣]){1,3}'
    windowLines: 5
    valueExcludePrefixes:
      - '주식회사'
      - '(주)'
      - '㈜'
      - '유한회사'
      - '재단법인'
      - '사단법인'
      - '유한책임회사'
    mask: full
    description: '스캔 PDF 폼의 대표자 라벨과 CEO value 사이에 회사명 등이 끼는 경우. non-empty 줄 5개 window 내 모든 value 후보를 마스킹하되 접두어 일치 후보는 배제'

  - id: brn-multiline-form
    patternType: structural
    kind: brn-structural
    labelPattern: '사\s*업\s*자\s*(?:등\s*록\s*)?번\s*호|법\s*인\s*(?:등\s*록\s*)?번\s*호'
    valuePattern: '\d{3}-?\d{2}-?\d{5}|\d{10,13}'
    windowLines: 5
    mask: digits
    description: 'BRN/법인번호 라벨이 value 와 줄 단위 분리된 스캔 폼'
```

### 4.3 `compilePattern` / `loadPiiPatternsFromYaml` 확장 (P2-b 대응)

- `compilePattern(p)` 을 union-aware 로:
  ```ts
  function compilePattern(p: PiiPattern): CompiledPiiPattern | null {
    if (p.patternType === 'structural') {
      // compile labelPattern + valuePattern 두 RegExp. 둘 중 하나 실패 시 null.
    } else {
      // 기존 경로 그대로.
    }
  }
  ```
- `CompiledPiiPattern` 도 discriminated union 으로 전환 (`CompiledSingleLinePiiPattern` + `CompiledStructuralPiiPattern`).
- `loadPiiPatternsFromYaml` parser 확장:
  - `patternType: structural` 감지 시 `labelPattern`/`valuePattern`/`windowLines`/`windowChars`/`valueExcludePrefixes` 필드 인식.
  - `valueExcludePrefixes` 는 YAML list — 기존 줄-단위 parser 는 list 미지원이므로 **js-yaml 도입 고려 or list parsing 로직 추가**. Simplicity First 로 **후자 선택** (기존 줄-단위 parser 에 `- item` 형태 감지 로직 20~30 LOC 추가).
  - `patternType` 누락 + `regex` 존재 → `single-line` 자동 적용 (하위 호환).
  - `patternType: structural` 인데 `labelPattern`/`valuePattern` 누락 → warn + skip (union 검증 실패).
- `mergePatterns` 는 id 기준이므로 수정 불필요.

**회귀 0 보장 조건**: 기존 `pii-patterns.test.ts` (있을 경우) + `pii-redact.test.ts` 21 tests 전부 GREEN. 마이그레이션 (default 4개 → bundled YAML) 도 동일 회귀 0.

---

## 5. Sanitize 실행 지점 연계

`wikey-core/src/ingest-pipeline.ts §L170~L212` 의 순서는 그대로 유지. 확장 지점:

| 단계 | 현재 | 확장 |
|------|------|------|
| 변환 후 markdown 준비 | (기존) | 변경 없음 |
| `applyPiiGate(sourceContent)` | single-line 4 패턴 scan | **+ structural pattern scan** (동일 `applyPiiGate` 내부에서 두 pass 완결) |
| `sanitizeForLlmPrompt(sourceFilename, opts)` | single-line mask | **explicit structural-disabled path** — 호출자가 `structuralAllowed=false` 로 명시. filename 경로는 단일 라인이지만 `대표자 홍길동.pdf` 같은 케이스에서 same-line regex scan 이 structural match 를 유도할 수 있어 **자동 skip 에 의존하지 않는다**. |
| sidecar `applyPiiGate` | single-line 4 패턴 | 동일, structural 포함 |

**filename 자동 skip 불성립 증명 (P2-v2-b)**: 실제 파일명 `대표자 홍길동.pdf` 는 한 줄짜리 문자열이지만 `labelPattern='대\s*표\s*(?:자|이\s*사)'` + `valuePattern='[가-힣](?:[ \t]*[가-힣]){1,3}'` 가 same-line scan 으로도 매칭됨. "windowLines ≥ 2 요구 → filename scan 에서 자동 skip" 주장은 성립하지 않음. 따라서 filename 경로에서 structural 차단은 **엔진 단에서 명시적으로** 수행해야 함.

**v3 설계 선택 — (A) explicit path 채택**:

1. `sanitizeForLlmPrompt` 시그니처 확장:
   ```ts
   export function sanitizeForLlmPrompt(
     input: string,
     opts: { readonly guardEnabled: boolean; readonly structuralAllowed?: boolean }, // default false
     patterns?: readonly CompiledPiiPattern[],
   ): string
   ```
2. 내부 `detectPiiInternal` 호출 시 `structuralAllowed !== true` 면 structural 패턴 전체 필터링 후 single-line 패턴만 실행.
3. body 경로 (`applyPiiGate`) 는 default `structuralAllowed=true`, filename/LLM prompt 경로는 `false`.
4. 호출자 변경 범위: `ingest-pipeline.ts` 의 filename sanitize 호출 지점 (기존 `sanitizeForLlmPrompt(filename, {guardEnabled})`) 은 `structuralAllowed` 미지정 시 기본값 `false` 이므로 **코드 변경 불필요**. body pass 는 `applyPiiGate` 를 사용하므로 영향 없음.
5. 대안 (B) "structural rule 매칭 조건에 실제 line break 존재 필수" 는 기각 — valuePattern 이 labelPattern 과 같은 줄에 있는 3-단 인접 케이스 (예: 표 셀 `| 대표자 | 홍 길 동 |`) 를 놓칠 위험. v3 에서는 명시 flag 로 filename 전용 차단이 가장 안전.

### 5.1 구현 — `pii-redact.ts::detectPiiInternal` structural 분기

v1 의 "first match" 대신 **multi-value + prefix exclude**:

```
for each structural pattern p:
  for each labelMatch of labelPattern.exec(markdown, /g):
    labelEnd = labelMatch.index + labelMatch[0].length
    window = computeWindow(markdown, labelEnd, p.windowLines, p.windowChars)
      # windowLines = "non-empty 줄" — 빈 줄(whitespace-only)은 카운트 제외,
      # non-empty 줄 개수가 p.windowLines 에 도달하거나 EOF 까지 확장.
    for each valueMatch of valuePattern.exec(window, /g):     # ALL matches (not first-only)
      absoluteStart = window.startOffset + valueMatch.index
      absoluteEnd = absoluteStart + valueMatch[0].length
      candidate = valueMatch[0]
      # prefix exclude (P3-v2-c 축소 정의):
      #   contextBeforeValue = "같은 줄 내에서 valueMatch 직전의 공백 분리 토큰 1~2개".
      #   즉 valueMatch.index 직전부터 같은 줄의 line-start 까지만 슬라이스하고,
      #   whitespace split 으로 얻은 마지막 1~2 token 을 검사 대상으로 삼는다.
      #   다른 줄의 내용 (이전 라인의 회사명 등) 은 contextBeforeValue 에 **포함 금지** —
      #   포함하면 뒤의 CEO value 가 회사명으로 인해 skip 되는 오탐이 발생.
      if p.valueExcludePrefixes 가 있고
         (candidate 가 접두어 중 하나로 시작 OR
          contextBeforeValue (same-line prefix token 1~2개) 가 접두어 중 하나로 시작):
        continue
      emit PiiMatchInternal {
        kind: p.kind (reporting),
        mask: p.mask,
        start: absoluteStart,
        end: absoluteEnd,
      }
```

**contextBeforeValue 축소 정의 구현 힌트**:
```ts
// 같은 줄 내에서 valueMatch 직전 단어 최대 2개만 검사.
const windowText = window.text
const lineStartInWindow = windowText.lastIndexOf('\n', valueMatch.index - 1) + 1
const sameLinePrefix = windowText.slice(lineStartInWindow, valueMatch.index)
const prefixTokens = sameLinePrefix.trim().split(/\s+/).filter(Boolean)
const lastTokens = prefixTokens.slice(-2).join(' ')  // 마지막 1~2 token
// excludePrefixes 검사 — `lastTokens` 또는 `candidate` 자체가 접두어로 시작하는지 판단
```

**파이프라인 순서**:
```
content → single-line pass → structural pass → dedup/sort → redact → content'
```
두 pass 를 분리하되 동일 `detectPiiInternal` 호출 내부에서 완결. 호출자 (`applyPiiGate`) 는 단일 진입점 유지.

**non-empty 줄 계산 (Q2 확정 → P1-b 대응)**:
- label 매칭 위치 뒤부터 줄 단위 순회.
- 각 줄이 `/^\s*$/` 이면 "empty" → 카운트 안 함.
- non-empty 줄 카운트 += 1. 카운트가 `windowLines` 도달 또는 EOF 시 window 종료.
- window 의 문자 범위를 반환. → 실 repro (label 다음 blank·회사명·blank·CEO) 에서 non-empty 2개 (회사명·CEO) 이므로 default 5 로 여유 있게 커버.

---

## 6. piiRedactionMode 강도 결정 (Q1 확정 → ACCEPT)

**결론**: 별도 `structural-mask` 강도 **도입하지 않음**. 기존 `display` / `mask` / `hide` 3강도에 structural match 도 합류.

근거:
- Structural match 의 mask 전략은 single-line 과 동일 (`full` = 문자수 * 치환, `digits` = 숫자만 * 치환).
- `hide` 모드의 3-단 fallback (문장/라인/window) 은 structural match 에도 유효 — line fallback 이 table cell 에 자연스럽게 매핑.
- 강도 세분화는 사용자 UI 복잡도만 증가. YAML 로 "structural 패턴만 끄고 싶다" 는 경우 해당 entry 제거 또는 `enabled: false` (후속 과제).

**codex Q1 권고**: ✅ 신규 강도 미도입, 기존 3강도 재사용. ACCEPT.

---

## 7. wiki 재생성 불가 확증

- 본 §5.1 는 ingest path 에 filter 1단 삽입 (`applyPiiGate` 내부 scan 확장).
- frontmatter 스키마 · registry 스키마 · sidecar 경로 · wiki 페이지 format 전부 **불변**.
- 기존에 생성된 PII-leaked wiki entity 페이지 (smoke pass-a/b 결과물) 는 본 작업이 삭제하지 않음 — 사용자가 `Reset wiki` (Phase 4 §4.C 본체) 로 수동 제거.
- 새 인제스트부터 효과 발휘 (이전 raw 재인제스트 시 hash diff 로 §5.3 가 갱신).

Phase 5 전제 (`plan/phase-5-todo.md §전제`) "구조 변경 없음" 위반 없음.

---

## 8. 테스트 전략 (RED → GREEN TDD, P3-a 반영)

### 8.1 Fixture (P1-a 반영 — 실 repro 3-단 구조)

- 경로: `wikey-core/src/__tests__/fixtures/pii-structural/`
- 내용: smoke 재현 케이스의 **redacted 복제본** (원본 PDF 는 `raw/` gitignore 유지).
- 복제 방법: 실 PDF → docling markdown 변환 산출물에서 BRN/법인번호/CEO 성명 외 나머지 레이아웃 보존, PII 위치에만 redacted 표시 (단 테스트용 fixture 는 재현이 목적이므로 synthetic 한글 이름 `홍 길 동` / BRN `123-45-67890` 사용 — 실 PII 는 fixture 에도 금지).

초기 fixture 최소 7종:

**하드코딩 금지 강화 (P2-v2-c)**: 아래 fixture 에 등장하는 회사명·이름은 **완전 synthetic**. 실재 회사명 (예: 사업자등록증 원본의 회사) 은 fixture 에도 위키에도 금지. YAML `valueExcludePrefixes` 에는 **generic 접두어만** (`주식회사`, `(주)`, `㈜`, `유한회사`, `재단법인`, `사단법인`, `유한책임회사`). 실재 회사명은 YAML 에도 포함 금지.

| # | 파일 | 재현 케이스 | 기대 거동 |
|---|------|-------------|-----------|
| 1 | `ceo-3-block-real-repro.md` | **실 repro 3-단 synthetic** — `대 표 자 \n\n 주식회사 테스트벤치 \n\n 홍 길 동` | label → non-empty 2 (회사명·CEO) → 접두어 exclude (`주식회사`) 로 회사명 skip, CEO 만 mask |
| 2 | `ceo-blank-line.md` | label + blank + CEO (synthetic `홍 길 동`) | CEO mask |
| 3 | `ceo-4th-line-ceo.md` | label + blank + blank + blank + CEO (non-empty 1개만, 4 물리줄 뒤, synthetic) | windowLines=5 경계 내 mask |
| 4 | `ceo-out-of-window.md` | non-empty 6개 뒤 CEO (synthetic) | window 밖 → match 0 (boundary negative) |
| 5 | `ceo-table-cell.md` | markdown 표 `| 대표자 | 홍길동 |` (synthetic) | structural or single-line 중 하나 hit |
| 6 | `brn-label-line-break.md` | `사업자등록번호\n\n123-45-67890` (synthetic BRN) | brn-structural digits mask |
| 7 | `false-positive-corp-name.md` | `㈜예시컴퍼니` 또는 `가나다전자` (label 부재, synthetic) | match 0 (label 미일치) |

**synthetic 이름 풀 (fixture 전용)**:
- 회사: `주식회사 테스트벤치`, `㈜예시컴퍼니`, `(주)샘플기업`, `유한회사 더미홀딩스`, `가나다전자` — 모두 가공 이름.
- 개인: `홍 길 동`, `김 철 수`, `이 영 희` — 공백 포함 한글 표기 변형 OCR 재현용. 실재 인물 성명 절대 금지.
- BRN: `123-45-67890` (documentation-friendly, 실재 사업자 아님 확증).

**실 repro 가 놓쳤던 P1-a 문제 완전 반영**: fixture #1 (`ceo-3-block-real-repro.md`) 에서 multi-value capture + `valueExcludePrefixes: [주식회사, ㈜, (주), 유한회사, 재단법인, 사단법인, 유한책임회사]` (generic prefix 만) 가 작동해 synthetic 회사명은 skip, synthetic CEO 만 mask.

### 8.2 RED → GREEN 테스트 케이스 (최소 10종)

파일: `wikey-core/src/__tests__/pii-structural.test.ts` (신규).

| # | 케이스 | 기대 | 대응 finding |
|---|--------|------|--------------|
| 1 | fixture #1 load → detectPii | ceo-structural match 1건 (CEO 만), 회사명 skip | P1-a |
| 2 | fixture #2 load → redactPii mask | `* * *` (full mask, 문자수 보존) | 기본 |
| 3 | fixture #3 load → detectPii | ceo-structural match 1건 (non-empty 1개, windowLines=5 내) | P1-b |
| 4 | fixture #4 load → detectPii | match 0건 (windowLines=5 밖) | P1-b boundary |
| 5 | fixture #5 load → redactPii | 표 내 CEO mask (table cell 인식) | 기본 |
| 6 | fixture #6 load → detectPii | brn-structural match 1건, digits mask `***-**-*****` | 기본 |
| 7 | fixture #7 load → detectPii | match 0건 (label 미일치, 조직명만) | FP 방지 |
| 8 | mixed document (single-line + structural) | 둘 다 걸리고 dedup 후 중복 없음 | §Q3 |
| 9 | `valueExcludePrefixes` override YAML 로 추가 (사용자 커스텀) → reload → match 변화 확인 | YAML override 동작 | Q6 |
| 10 | `patternType` 누락 YAML (legacy) → loader 가 `single-line` 으로 처리 | 하위 호환 | P2-b |

**Reverse order / multi-label run 케이스는 non-goal 로 명시** (§11 Q8 참조, P2-a 반영): "CEO value → label 역순", "대표자 / 주소 / 전화 연속 후 값들이 interleaved" 는 v1 에서 미커버. 본 §5.1 에서는 실 repro (label → value 순서) 에 집중하고, reverse/interleaved 는 향후 별도 구현.

### 8.3 기존 테스트 회귀 보호

- `pii-redact.test.ts` 21 tests 전부 GREEN 유지 (single-line 패턴 변경 없음).
- `pii-patterns.test.ts` (있다면) 의 mergePatterns / loadPiiPatternsFromYaml 회귀 GREEN — **discriminated union 전환 후에도 legacy YAML (no patternType) 로드 테스트 포함**.
- 빌드 `npm run build` 0 errors.
- 전체 테스트 `npm test` 525+ passed (Phase 4 완료 기준).

### 8.4 RED → GREEN 검증 프로토콜 (Karpathy #4)

1. 신규 테스트 10종 작성 (구현 전) → run → 전부 FAIL 확인 (RED 로그 아티팩트 보관)
2. discriminated union 타입 + bundled YAML loader + structural matcher 구현 → 신규 테스트 GREEN 확인
3. 기존 `pii-redact.test.ts` 재실행 → GREEN 유지 확인
4. structural 로직 의도적으로 revert → 신규 테스트 FAIL 재현 → 회귀 테스트 신뢰성 증명
5. 전체 `npm test` fresh 실행 → 525+ passed 증명 (이전 실행 결과 무효)

---

## 9. 구현 단계 분해 (P3-a 반영: RED-first 10단계)

상위 todo (`plan/phase-5-todo.md §5.1.1`) 의 실행 단위 분해. 번호는 §5.1.1.X. v1 (9단계, fixture→타입→...→test) 에서 v2 (10단계, fixture→**RED**→타입→...→**GREEN**) 로 확장.

| 번호 | 작업 | 산출물 | 검증 |
|------|------|--------|------|
| §5.1.1.1 | fixture 7종 확보 (§8.1, 실 repro 3-단 포함) | `wikey-core/src/__tests__/fixtures/pii-structural/*.md` 7종 | 파일 존재 + git add |
| §5.1.1.2 | **RED 테스트 10종 작성** (§8.2, 구현 전) — 전부 FAIL 확인 | `pii-structural.test.ts` (신규) | `npm test` → 10건 FAIL 로그 아티팩트 |
| §5.1.1.3 | `PiiPattern` discriminated union 타입 추가 (`patternType: 'single-line' \| 'structural'`) + `DEFAULT_PATTERNS` 기존 4개에 `patternType: 'single-line'` 마이그레이션 | `pii-patterns.ts` 타입 확장 | `tsc --noEmit` 0 errors, 기존 `pii-redact.test.ts` 21 tests GREEN 유지 |
| §5.1.1.3.5 | **(신규, P2-v3-b)** `pii-patterns.ts` loader ESM 전환 — `require('node:fs' \| 'node:path' \| 'node:os')` (L209-211) 을 top-level `import fs from 'node:fs'` 등으로 대체. bundled YAML 로드에서도 동일 import 재사용. | `pii-patterns.ts` loader 섹션 ESM 정상화 | `npm run build` 0 errors, `pii-redact.test.ts` 21 tests GREEN, `loadPiiPatterns` 경로별 (bundled · ~/.config · basePath) 회귀 확인 |
| §5.1.1.4 | `loadPiiPatternsFromYaml` union-aware 전환 (patternType 분기 + list 파싱 for `valueExcludePrefixes` + legacy patternType 누락 → single-line fallback) | loader 확장 | legacy YAML 로드 회귀 테스트 GREEN (테스트 10 번) |
| §5.1.1.5 | `compilePattern` union-aware 전환 + `CompiledPiiPattern` discriminated union 화 | compiler 확장 | 단위 테스트 yaml fixture RED→GREEN |
| §5.1.1.6 | bundled default YAML 파일 작성 (`wikey-core/src/defaults/pii-patterns.default.yaml`) — 기존 4 single-line + CEO/BRN structural 2종 | yaml 파일 + 빌드 스크립트 (tsc 후 `dist/defaults/` 복사) | 빌드 산출물에 yaml 포함 확인 |
| §5.1.1.7 | structural matcher 구현 (`detectPiiInternal` 확장, multi-value + prefix exclude + non-empty 줄 window) + **`sanitizeForLlmPrompt` 시그니처 확장 (`structuralAllowed?: boolean`, default false)** | matcher 로직 + sanitize flag | 신규 테스트 1~8 GREEN, 기존 pii-redact filename 테스트 GREEN |
| §5.1.1.8 | **GREEN 확증 full run** — `npm test` 전체 + `npm run build` | test log | 525+ passed, 0 errors, 신규 10 포함 |
| §5.1.1.9 | smoke 재실행 (file 2) — Obsidian CDP 또는 audit 패널 + FP baseline corpus 측정 (§12 E7) | `activity/phase-5-resultx-5.1-structural-smoke-YYYY-MM-DD.md` | §12 E1~E3 + E7 전부 PASS |
| §5.1.1.10 | 문서 동기화 — `phase-5-result.md §5.1`, `wiki/log.md`, `wikey-core/README` PII section | commit + push | log entry 존재, commit 메시지 `feat(phase-5): §5.1 structural PII detection — multi-line form coverage` |
| §5.1.1.11 | **(신규, P2-v2-f · v4 Q3 재확인)** `scripts/check-pii.sh --structural-only` flag 추가 — structural pattern 만으로 wiki/ 스캔해 count 출력. 구현 범위: bash 스크립트에서 wikey-core 의 `detectPii` 를 CLI 래퍼 (`wikey-core/dist/cli/detect-pii.js` 또는 node -e 일회성 호출) 로 실행 후 kind='ceo-structural'\|'brn-structural' 만 집계. **selective 구현** — fixture baseline (E7(a) 0/30) 이 주된 FP 측정이며, 이 flag 는 live wiki baseline (E7(b)) 경로 사용 시에만 필요. fixture 경로만 쓸 경우 본 단계 생략 가능. | `scripts/check-pii.sh` + 옵션 CLI | `--structural-only` 실행 시 structural count 출력, 0 이면 exit 0 |

**v1 대비 변경**: v1 은 test 가 맨 뒤 (§5.1.1.7). v2 는 §5.1.1.2 에 RED 먼저 → §5.1.1.8 에 GREEN 확증 분리. Karpathy #4 "테스트 먼저 작성 후 통과시킴" 준수. **v3 추가**: §5.1.1.7 에 `sanitizeForLlmPrompt` 시그니처 확장 포함 (P2-v2-b filename skip). §5.1.1.11 신설 (P2-v2-f check-pii.sh structural flag, E7 (b) 경로 precondition 충족용, **selective** — fixture baseline 0/30 이 주된 FP 측정이며 이 flag 는 live wiki baseline 경로 사용 시에만 필요, Q3 답변). **v4 추가**: §5.1.1.3.5 신설 (P2-v3-b loader ESM 전환) — discriminated union 타입 적용 직후·union-aware loader 확장 직전에 수행해 compile 안전성 확보.

---

## 10. 잠재 영향 · 연관 모듈

- `wikey-core/src/pii-patterns.ts` — 타입·로더·컴파일러 확장 (discriminated union)
- `wikey-core/src/pii-redact.ts` — `detectPiiInternal` 확장 (structural 분기, multi-value + prefix exclude)
- `wikey-core/src/defaults/pii-patterns.default.yaml` (신규) — bundled default
- `wikey-core/src/__tests__/fixtures/pii-structural/` — 신규 fixture 7종
- `wikey-core/src/__tests__/fixtures/pii-structural-baseline/` — FP 측정용 PII-free 샘플 N 개 (§12 E7)
- `wikey-core/src/__tests__/pii-structural.test.ts` — 신규 테스트 10종
- `wikey-core/src/__tests__/pii-redact.test.ts` — 회귀 보호 대상 (수정 없음)
- `wikey-core/src/__tests__/pii-patterns.test.ts` — loader discriminated union 회귀 케이스 추가
- `wikey-core/src/ingest-pipeline.ts` — 코드 변경 **없음** (진입점 동일)
- `wikey-core/package.json` — build 스크립트 yaml 복사 1줄 추가 (`node -e fs.cpSync('src/defaults','dist/defaults',{recursive:true})`). `__dirname` 경로는 ESM 프로젝트 (L4 `"type": "module"`) 특성상 기각 — `new URL('./defaults/...', import.meta.url)` 로 대체됨 (§4.2 참조).
- `.wikey/pii-patterns.yaml` (vault 내) — 사용자 override 경로
- `scripts/check-pii.sh` — `--structural-only` flag 추가 (§12 E7)

---

## 11. 리스크 · 오픈 이슈 (사용자 결정 필요)

| Q# | 쟁점 | 옵션 | 기본 추천 | 상태 |
|----|------|------|-----------|------|
| Q1 | 별도 강도 `structural-mask` 를 piiRedactionMode 에 도입? | A) 미도입 (기존 재사용) / B) 신규 | **A** — §6 근거, codex 권고 ACCEPT | ✅ v2 확정 |
| Q2 | `windowLines` 의미·default | A) 물리 3줄 / B) non-empty 3줄 / C) non-empty 5줄 | **C** — non-empty 5줄 (실 repro + 안전 여유), codex P1-b 반영 | ✅ v2 확정 |
| Q3 | structural ↔ single-line 동일 범위 dedup | A) start/end 일치 시 single 유지 / B) structural 우선 | **A** (기존 dedup 재사용) | v1 유지 |
| Q4 | Docling table metadata (안 A) 이번 §5.1 에 포함? | A) 제외 (§5.5 이관) / B) 병행 | **A** — Simplicity | v1 유지 |
| Q5 | NER fallback (안 B) 개발? | A) 제외 / B) §5.1 optional / C) §5.4 연계 별도 | **A** — 실 failure 에 불필요 | v1 유지 |
| Q6 | `DEFAULT_PATTERNS` 에 structural 포함 vs vault drop-in | A) bundled YAML 에 포함 (즉시 보호) / B) opt-in | **A** — bundled YAML, declarative + overrideable, 이름/슬러그/회사명 blacklist 는 YAML 만 (TS 리터럴 금지), codex Q6 권고 ACCEPT | ✅ v2 확정 |
| Q7 | filename sanitize 에 structural 적용? | A) 제외 (명시 `structuralAllowed=false`) / B) yaml 제어 | **A** — `sanitizeForLlmPrompt(text, ..., { structuralAllowed: false })` 명시 파라미터로 structural 패턴 차단. 자동 감지 아님 (v3 P2-v2-b 증명 — `대표자 홍길동.pdf` 같은 same-line filename 에서도 structural match 발생 가능). | ✅ v3 재확정 |
| Q8 | reverse order (value→label) / multi-label run (interleaved) 커버? | A) non-goal (v2 명시) / B) 별도 RED 추가 | **A** — non-goal 명시, 향후 별도 구현 (P2-a 반영) | ✅ v2 신설 |
| Q9 | FP baseline corpus 소스 | A) raw/ 에서 PII-free N개 선정해 `fixtures/pii-structural-baseline/` 에 redacted 복제 / B) wiki/ 전체 사용 (실 배포된 문서) / C) 둘 다 | **C** — fixtures 로 재현성 + wiki/ 로 현장 검증. `scripts/check-pii.sh --structural-only` flag 가 양쪽 지원 | ✅ v2 신설 (P2-d) |

**사용자 결정 완료 (2026-04-25)**: v1 의 Q1/Q2/Q6 은 v2 에서 codex 권고대로 A 채택. v2 신설 Q8/Q9 도 사용자 승인: **Q8 = A (non-goal 확정)** · **Q9 = N=30 확정** (권고 C 의 fixtures + wiki/ 구조 위에 `fixtures/pii-structural-baseline/` 는 N=30, wiki/ 런타임 체크는 `scripts/check-pii.sh --structural-only` 가 담당).

---

## 12. 성공 기준 (Goal-Driven, Evidence-Based Completion)

다음 체크리스트 **전체 통과** 시 §5.1.1 완료 선언 가능. 단순 구현 완료는 부족 — 증거 산출물 필수.

- [ ] **E1. smoke 재실행 — raw BRN 누출 0건** — `pass-a-file-2` + `pass-b-file-2` wiki body 에서 `grep -rE '\d{3}-\d{2}-\d{5}' wiki/sources/ wiki/entities/` 결과 **0건** (근거: `activity/phase-5-resultx-5.1-structural-smoke-<date>/sidecar-redact-grep.md`)
- [ ] **E2. CEO entity 페이지 생성 구조 기반 0건** (P2-c 반영 — 이름/슬러그 하드코딩 금지. P2-v2-d/e 재작성 — 실 존재 artifact 기반) — 다음 두 조건 **모두** 만족:
  - (a) **structural matcher 작동 확증** — smoke 실행 로그 (analyst 수동 실행 또는 `sidecar-redact-grep.md`) 에서 다음 **둘 중 하나** 수집:
    - (i) `detectPii(sourceMarkdown)` 반환값에 `kind === 'ceo-structural'` 매치가 **1건 이상** (테스트 스크립트로 smoke fixture 동일 입력 재현 → count > 0 증빙)
    - (ii) sidecar 파일 — 실제 경로는 `${원본소스경로}.md` (예: `raw/<...>.pdf` → sidecar `raw/<...>.pdf.md`. `wikey-core/src/uri.ts::sidecarVaultPath` 및 `ingest-pipeline.ts` L220 `${sourcePath}.md` 확증). `wiki/sources/` 하위가 아님 — 그쪽은 source-page 이지 sidecar 가 아니다 (P3-v3-d 정정). 증거 grep 예: `grep -c '\*\{2,\}' raw/<...>.pdf.md` ≥ 1 + 해당 라인에 대표자/대표이사/CEO 라벨 존재 (context line grep). 또는 path 인용 대신 `detectPii(sidecarContent)` 반환 snapshot 으로 대체 가능.
  - (b) **entity 페이지 0 증명** — smoke 수행 후 `wiki/entities/*.md` 중 frontmatter `provenance` 배열 내 `ref` 가 `sources/<본 smoke sourceId>/` 로 시작하는 항목을 포함하는 페이지 수 = **0** (P2-v2-e 정합: `frontmatter.source` 참조 제거. 실제 스키마는 `provenance[].ref`, 값 형식은 `wiki-ops.ts::injectProvenance` 기준으로 `sources/<source_id>` — prefix match 사용)
  - **assertion 실행 힌트**:
    ```bash
    # (b) entity 페이지 provenance prefix scan — sourceId 는 smoke 수행 시 결정됨
    sid="<smoke sourceId>"
    python3 - <<PY
    import re, glob, pathlib
    sid = "$sid"
    hits = []
    for p in glob.glob("wiki/entities/*.md"):
        t = pathlib.Path(p).read_text(encoding='utf-8')
        m = re.match(r'^---\n(.*?)\n---\n', t, re.S)
        if not m: continue
        if re.search(rf'ref:\s*sources/{re.escape(sid)}(?:/|\b)', m.group(1)):
            hits.append(p)
    print(f"entity pages from sid={sid}: {len(hits)}")
    assert len(hits) == 0, hits
    PY
    ```
- [ ] **E3. `wiki/index.md` + `wiki/log.md` 에 CEO 성명 확산 0건** — **구조 기반**: smoke 이후 diff 에서 `wiki/entities/` 아래 신규 페이지가 0 (E2.b 로 증명됨) → index/log 엔트리 0 (이름 grep 불필요)

**E2 구현 범위 결정 (P2-v2-d 옵션 A 채택)**: ingest-audit.jsonl + `piiMasked.ceo-structural` 로깅은 본 §5.1 구현 범위에 **포함하지 않는다** (simplicity). 대신 smoke 실행 시 structural 작동 증거는 (i) 재현 스크립트의 `detectPii()` 반환값 snapshot 또는 (ii) sidecar `*` 치환 grep 으로 대체. 향후 audit log 인프라는 별도 subject (§5.7 운영 계열) 에서 고려.
- [ ] **E4. 기존 `pii-redact.test.ts` 21 tests GREEN** (회귀 없음, fresh 실행)
- [ ] **E5. 신규 `pii-structural.test.ts` 최소 10 tests GREEN** (fresh 실행, exit 0)
- [ ] **E6. `npm test` 전체 525+ passed, `npm run build` 0 errors** (fresh)
- [ ] **E7. FP baseline 측정 (P2-d 반영, P2-v2-f 재조정)** — 다음 **둘 중 하나 이상** 수행하고 증거 제시:
  - (a) **Fixture baseline (필수 권장)** — `wikey-core/src/__tests__/fixtures/pii-structural-baseline/` 에 PII-free N=30 개 md (raw/ 에서 PII-free 로 검증 후 redacted 복제, raw/ 는 gitignore 유지) 배치 → structural pattern 실행 → **match = 0 (0/30)**.
    - threshold 근거 (P2-v2-f): `≤1/100` 목표는 더 큰 N 에서만 통계적으로 의미. N=30 fixture 는 smoke baseline 이라 `≤1/30` 은 목표 달성을 보장하지 못하므로 **0/30 으로 상향**. 1건이라도 나오면 FP 유형을 밝혀 YAML `valueExcludePrefixes`/`windowLines`/`valuePattern` 조정 후 재실행.
    - `≤1/100` 은 fixture N 을 30 → 100+ 로 확대할 때 계속 검증. 본 §5.1 에서는 0/30 로 만족 선언하되, 후속 subject (§5.7 운영 또는 별도 eval) 에서 N=100+ FP 측정 reopen.
  - (b) **Live wiki baseline** — `scripts/check-pii.sh --structural-only` flag 추가 + 현재 커밋된 `wiki/` 전체 스캔 → structural match = 0.
    - **Precondition (P2-v2-f)**: 현재 `scripts/check-pii.sh` 는 단순 grep 기반 전화번호·이메일·주민번호 3종만 커버, structural pipeline counter 는 **미구현**. `--structural-only` flag 추가는 본 §5.1.1 구현 범위에 포함 (단계 §5.1.1.11 신설, 아래 §9 참조). Flag 구현 전에는 (b) 경로 불가 — (a) 를 mandatory 로 보고.
  - 증거: 실행 명령 + 출력 첨부 (`activity/phase-5-resultx-5.1-structural-smoke-<date>/fp-baseline.md`)
- [ ] **E8. 의존성 변화 — `wikey-core/package.json` diff = 0 추가** (js-yaml 등 신규 런타임 의존성 금지, dev 의존성도 최소화)
- [ ] **E9. 하드코딩 금지 준수 — §5.1 범위 내 파일에서 실 PII 및 generic 접두어 TS 리터럴 0 hits** (Q1 답변 기반 범위 재정의):
  - **범위**: `plan/phase-5-todox-5.1-structural-pii.md` + `wikey-core/src/__tests__/fixtures/pii-structural/` (신규 fixture 디렉토리). `canonicalizer.ts` L270/L276 의 기존 few-shot 예시는 **본 §5.1 범위 밖** — 별도 subject 로 이관 (§13 v4 메모 참조).
  - **실 PII grep (본 문서)**: smoke pass-a/b 에 기록된 실 회사명·실 CEO 성명·실 슬러그 패턴을 `grep -nE '<pattern>' plan/phase-5-todox-5.1-structural-pii.md` 로 스캔 = **0 hits** 목표. (pattern 은 공개 repo 에 기록하지 않음. 수행자는 smoke 리포트의 raw 값을 로컬에서만 grep pattern 으로 사용.)
  - **회사명 접두어 TS 리터럴 grep (신규 코드)**: `grep -rnE '주식회사|㈜|유한회사' wikey-core/src/**/*.ts` 결과에서 **§5.1 신규 생성 `.ts` 파일 0 hits**. YAML 파일·`__tests__/fixtures/pii-structural/*.md`·기존 canonicalizer.ts 는 제외. 단 테스트 `.ts` 에서는 assertion string 으로만 사용 가능.
- [ ] **E10. 문서 동기화** — `activity/phase-5-result.md §5.1.1`, `wiki/log.md` 에 lint entry, `plan/phase-5-todo.md §5.1.1` 체크박스 갱신
- [ ] **E11. commit 메시지** `feat(phase-5): §5.1 structural PII detection — multi-line form coverage` + push

**Fresh 실행 증거 원칙** (rules/rules.md §1 Evidence-Based Completion): 이전 실행 결과는 무효 — 각 E# 측정은 최종 코드 상태에서 1회 fresh 실행. "should work" / "probably" 금지.

---

## 13. 변경 이력

### v4 (2026-04-25) — codex v3 재검증 FAIL 판정 6 findings 반영 (P2 2 · P3 4)

| finding | priority | 반영 위치 | 수정 요약 |
|---------|----------|-----------|-----------|
| P2-v3-a §1 실 PII 잔존 | P2 | §1 배경 전체 (L24/L28/L35/L37/L39/L43/L371) | 실 회사명·실 CEO 성명·실 슬러그 (smoke pass-a/b 에 기록된 OCR 변이 포함 3종) 전부 **structure-preserving synthetic** 으로 redact. `(주)테스트벤치`·`홍 길 동` 사용. smoke 증거 경로 (`pass-a-file-2.md`) 는 유지하되 raw 값 간접 기술. L371 실 슬러그 경로 → "smoke pass-a/b 결과물" 로 redact |
| P2-v3-b loader `require(...)` ESM 미안전 | P2 | §4.2 (기존 `loadPiiPatterns` 경로 설명) · §9 §5.1.1.3.5 신설 | `pii-patterns.ts` L209-211 의 `require('node:fs\|path\|os')` 3줄을 top-level `import ... from 'node:fs'` 등으로 전환하는 subject 를 §5.1.1 구현 범위에 포함. discriminated union 타입 적용 (§5.1.1.3) 직후·union-aware loader 확장 (§5.1.1.4) 직전에 수행. v3 "별도 cleanup 후속 task" 문구 철회 — 본 §5.1 범위로 흡수 |
| P3-v3-a §4.1 kind branches 잔존 문구 | P3 | §3 Karpathy #3 Surgical 문단 | "loader 는 discriminator (`kind`) 기반 분기 추가" → "loader 는 `patternType` (discriminator) 기반 분기 추가 (`kind` 는 reporting 전용, §4.1 참조)" 로 정정. §13 v3 의 `patternType = discriminator` 결정과 정합 |
| P3-v3-b §10 stale __dirname 언급 | P3 | §10 `wikey-core/package.json` 행 | "build 스크립트 yaml 복사 1줄 추가 가능 (또는 `__dirname` 런타임 읽기)" → `__dirname` 기각 명시 + `new URL(..., import.meta.url)` 로 대체 (§4.2 참조) |
| P3-v3-c Q7 "자동 skip" 불일치 | P3 | §11 Q7 행 | "A) 제외 (단일 라인) / 자동 skip" → `sanitizeForLlmPrompt(text, ..., { structuralAllowed: false })` 명시 파라미터 기반. v3 P2-v2-b 증명 (`대표자 홍길동.pdf` same-line match) 인용. 상태 ✅ v3 재확정 |
| P3-v3-d sidecar 경로 불일치 | P3 | §12 E2 (a)(ii) | 잘못된 경로 `wiki/sources/*.sidecar.md` → 실제 경로 `${sourcePath}.md` (raw 원본 옆, 예: `raw/<...>.pdf.md`). 근거: `wikey-core/src/uri.ts::sidecarVaultPath` + `ingest-pipeline.ts` L220. path 인용 대신 `detectPii()` snapshot 대체 가능 옵션 추가 |

**Q1 답변 — canonicalizer few-shot 이관 메모**:
- `wikey-core/src/canonicalizer.ts` L270/L276 에 기존 few-shot 예시로 실재 회사명 리터럴이 잔존 (본 문서에는 값 복제 금지).
- 본 §5.1 범위는 **구조적 multi-line PII 탐지** (pii-patterns.ts + pii-redact.ts + fixtures/pii-structural/) 로 한정. canonicalizer 는 별도 책임 모듈.
- E9 (하드코딩 금지) 도 §5.1 범위 내 파일에만 적용 (본 문서 + `wikey-core/src/__tests__/fixtures/pii-structural/` + 신규 §5.1 `.ts`).
- canonicalizer few-shot 정리는 **별도 subject 로 이관** — Phase 5 §5.1 외부에서 추후 reopen. 이관 시 §5.1 완료와 무관하게 독립 진행 가능.

**Q2 답변**: §1 배경 redact 에서 처리 (P2-v3-a 반영 완료).

**Q3 답변**: §5.1.1.11 `check-pii.sh --structural-only` flag 는 **selective**. E7 (a) fixture baseline 0/30 이 **mandatory** FP 측정. §5.1.1.11 문구에 "fixture baseline 이 주된 FP 측정이며, 이 flag 는 live wiki baseline 경로 사용 시에만 필요" 명시 (§9 본문 요약 단락 반영).

### v3 (2026-04-25) — codex v2 재검증 FAIL 판정 9 findings 반영 (P2 6 · P3 3)

| finding | priority | 반영 위치 | 수정 요약 |
|---------|----------|-----------|-----------|
| P2-v2-a patternType 필수화 역회귀 | P2 | §4.1 타입 블록 · 하위 호환 설명 | `SingleLinePiiPattern.patternType` 을 **optional** 으로 변경 (default `'single-line'`). 기존 `pii-redact.test.ts` L319/L348/L355 의 `{id, kind, regex, mask}` 리터럴 호출이 v3 후에도 compile/run GREEN 유지. loader/compiler/detector 는 `p.patternType === 'structural'` 만 structural 로 분기 |
| P2-v2-b filename 자동 skip 불성립 | P2 | §5 sanitize 연계 · §5.1.1.7 | `sanitizeForLlmPrompt` 시그니처를 `structuralAllowed?: boolean` (default false) 로 확장, filename 경로에서 structural 명시 차단. "windowLines ≥ 2 자동 skip" 주장 철회 — `대표자 홍길동.pdf` 같은 same-line filename 에서도 차단됨 |
| P2-v2-c fixture 하드코딩 위반 | P2 | §8.1 fixture 테이블 · synthetic 이름 풀 | fixture #1 의 실 회사명 → synthetic `주식회사 테스트벤치`. synthetic 회사 풀 (`테스트벤치`, `예시컴퍼니`, `샘플기업`, `더미홀딩스`, `가나다전자`) + 개인 풀 (`홍 길 동`, `김 철 수`, `이 영 희`) 명시. YAML `valueExcludePrefixes` 는 generic 접두어만 (`주식회사` 등) |
| P2-v2-d E2 ingest-audit.jsonl 미존재 | P2 | §12 E2 (a) | ingest-audit logging 범위 제외 (옵션 A). Structural 작동 증거는 (i) `detectPii()` 반환값 snapshot 또는 (ii) sidecar `*` 치환 grep 둘 중 하나로 수집. 향후 audit log 는 별도 subject 로 reopen |
| P2-v2-e provenance assertion 미스매치 | P2 | §12 E2 (b) + bash 스크립트 | `frontmatter.source` 참조 제거 → `provenance[].ref.startsWith('sources/<sid>/')` (또는 word-boundary) 로 정정. `wiki-ops.ts::injectProvenance` 의 실제 스키마 기준. assertion 실행 힌트 python 스크립트 제공 |
| P2-v2-f FP threshold 불일치 | P2 | §12 E7 · §9 §5.1.1.11 신설 | `≤1/30` → **0/30** 으로 상향 (N=30 에서 ≤1/100 목표 달성 조건 = 0 건). `≤1/100` 은 N 확대 시 reopen. `scripts/check-pii.sh --structural-only` flag 는 precondition 미충족 — §5.1.1.11 신설 (선택 구현, E7 (b) 경로 사용 시 필수) |
| P3-v2-a bundled YAML ESM 이슈 | P3 | §4.2 | `package.json` `"type": "module"` 확증 (L4) → `__dirname` 미정의. `new URL('./defaults/...', import.meta.url)` + `fs.readFileSync` 채택. 빌드 hook 으로 `src/defaults/*.yaml` → `dist/defaults/` 복사. ESM `import * as fs from 'node:fs'` 로 통일 (기존 `require` cleanup 은 별도 task) |
| P3-v2-b §4.1 본문 kind vs patternType 모순 | P3 | §4.1 해결 문단 | `patternType` = **분기 discriminator**, `kind` = **reporting label** 로 역할 명시 분리. v3 이후 분기 맥락에서는 `patternType` 만 사용, `kind` 는 audit/telemetry/통계 맥락에서만 등장 |
| P3-v2-c contextBeforeValue 정의 과광 | P3 | §5.1 pseudo-code · 구현 힌트 | `contextBeforeValue` = "**같은 줄 내** valueMatch 직전 whitespace-split token 1~2개" 로 축소. 이전 라인 내용 exclude 판단 포함 금지 → 회사명 뒤 CEO 오탐 skip 방지. TS 구현 hint 제공 (`lineStartInWindow` + `slice` + `split(/\s+/)`) |

### v2 (2026-04-25) — codex FAIL 판정 8 findings 반영

| finding | 반영 위치 | 수정 요약 |
|---------|-----------|-----------|
| P1-a fixture 과소 재현 | §1 배경 (실 repro 명시) · §8.1 fixture #1 | 3-단 구조 (label → 회사명 → CEO) fixture 추가 · multi-value capture + `valueExcludePrefixes` (YAML 선언, 하드코딩 금지) 도입 |
| P1-b windowLines=3 부족 | §3 · §4.1 (`windowLines` 설명) · §5.1 (non-empty 정의) · §Q2 | `windowLines` 의미를 "non-empty 줄" 로 재정의, default 5 로 상향. fixture #3 (non-empty 1개, 4 물리줄 뒤) + #4 (window 밖 boundary) RED 테스트 추가 |
| P2-a 방향성/multi-label 부재 | §8.2 note · §Q8 신설 | reverse order · multi-label interleaved 는 **non-goal** 로 명시 |
| P2-b YAML loader 호환성 | §4.1 discriminated union · §4.3 compiler/loader · §5.1.1.3~5 단계 분해 | `PiiPattern` 을 `SingleLinePiiPattern \| StructuralPiiPattern` discriminated union 으로 전환 (`patternType` discriminator 신설, 기존 `kind` 는 reporting kind 로 의미 유지). loader/compiler union-aware 분기. legacy YAML (no patternType) → single-line fallback. 회귀 0 보장 |
| P2-c smoke 성공 기준 이름 하드코딩 | §12 E2/E3 | 특정 슬러그 비교 제거 → **구조 기반 assertion** (CEO sanitize count > 0 AND entity 페이지 수 = 0 by sourceId) |
| P2-d FP 측정 불가 | §12 E7 · §10 fixtures-baseline · §Q9 신설 | baseline corpus 경로 명시 (`fixtures/pii-structural-baseline/` N=30) + `scripts/check-pii.sh --structural-only` flag 추가를 §5.1.1 구현 범위에 포함. 둘 중 하나 이상 수행 의무 |
| P3-a TDD 순서 불일치 | §9 10 단계 (v1 9 → v2 10) · §8.4 프로토콜 | RED 먼저 (§5.1.1.2 = 테스트 작성 후 FAIL 확인) → 타입·loader·compiler·matcher 구현 → GREEN 확증 (§5.1.1.8) 분리 |
| P3-b default-in 모호 (bundled YAML vs TS literal) | §4.2 bundled default YAML · §Q6 | Default 는 **bundled YAML** (`wikey-core/src/defaults/pii-patterns.default.yaml`) + 빌드 시 `dist/defaults/` 복사 or 런타임 `__dirname` 읽기. TS literal 은 fallback 만 (리소스 누락 대비). 이름·슬러그·회사명 blacklist 는 YAML 단일 소스 |

### v1 (2026-04-25) — 초안

- analyst 작성. 안 C (Context window heuristic) 채택. Q1/Q2/Q6 사용자 결정 대기.
- 9 단계 구현 분해 (fixture → 타입 → loader → matcher → sanitize → default → test → smoke → docs).
- `windowLines: 3` default, first match 선택, TS literal DEFAULT_PATTERNS 유지.
