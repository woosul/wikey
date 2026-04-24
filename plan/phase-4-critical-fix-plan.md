# Phase 4 본체 완성 D.0 — Critical Fix 보완 계획서 (v6 — 구현 착수 가능)

> **목적**: 2026-04-23 통합 smoke 의 5 Critical (C1~C5) + CDP 5 UX (C6.1~C6.5) 를 해결하고 Phase 4 본체 완성 선언 (D 블록) 재시도 가능 상태 만들기.
>
> **작성일**: 2026-04-24 (v6)
> **상태**: **구현 착수 승인** — codex Panel Mode D v5 판정 = **APPROVE-WITH-CHANGES (CRITICAL: None)**. v5 의 잔여 2건 (extractPdfText 시그니처 중복 서술 · ScriptResult/runScript 확장 prerequisite 명시 · status enum membership 검증) 을 v6 에서 최종 정리.
> **수립 근거**: `activity/phase-4-smoke-2026-04-23/README.md §3` + 사용자 결정 + codex v1/v3 피드백
> **실행 단일 소스**: 본 문서 (v4 APPROVE 이후 `plan/phase-4-todo.md` D.0 블록 병합)
>
> **실행 주체**: Claude Code (개발) + codex (2차 검증)
> **예상 소요**: 실구현 ~10~14h + smoke 재실행 ~1.5h

---

## 1. 결정 요약 테이블

| # | 결정 |
|---|---|
| C1 | 2-layer. basic `allowPiiIngest` (OFF default = block / ON = redact). advanced `piiGuardEnabled` (OFF = detect 자체 skip, 공시용 문서). 모든 ingest 경로 (md/pdf/hwp/docx...) 에 공통 적용 |
| C2 | `piiRedactionMode` = display / **mask (default)** / hide. hide 는 sentence 시도 후 line/block fallback |
| C3 | 런타임 capability map. TS/UI + Python audit 가 동일 source 공유. `main.ts` create detection 도 HWP/HWPX 포함 |
| C4 | onLayoutReady + delayed fallback + idempotent flag |
| C5 | `reindex()` 동기 실행 + `reindex.sh --check --json` 신규 contract + `waitUntilFresh` polling |
| C6 | 5 UX 이슈 수정 |

---

## 2. v1 → v2 → v3 → v4 진화

| 항목 | v1 (REJECT) | v2 | v3 (REJECT) | v4 (current) |
|------|-------------|-----|-------------|--------------|
| PII gate 위치 | 변환 전 pre-gate | 변환 후 wrapper | v2 유지 | v2 유지. **+ PDF sidecar 경로 재설계** |
| PDF sidecar | 언급 없음 | sourceContent 공유 가정 (사실 오판) | v2 유지 (오판) | **`extractPdfText::finalize()` 의 sidecar write 제거** → 중앙 wrapper 가 redact 후 sidecar 저장 |
| redact 분기 | 단순 block | block OR redact | 2-layer (Guard + Allow) | v3 유지 |
| redact default | 모호 | mask (모순) | mask 확정 | v3 유지 |
| reindex contract | 언급 없음 | `reindexCheck()` 만 (status) | `reindex() + waitUntilFresh --stale=0` (contract 부재) | **`scripts/reindex.sh` 에 `--check --json` 신규** + runner 가 JSON parse |
| C3 audit-ingest.py | static | static (B 안) | static 유지 (지적됨) | **runtime bridge**: 플러그인 onload 가 `~/.cache/wikey/capabilities.json` 덤프 → python 이 파일 read |
| main.ts create doc 감지 | 언급 없음 | 언급 없음 | 언급 없음 | **md\|txt\|pdf\|hwp\|hwpx\|docx\|pptx\|xlsx\|html** 공통 상수화 |
| RenameGuard TTL | "2000→3000ms" 오인 | 동일 오인 | 동일 오인 | **이미 5s default** 확인 — TTL 수정 없음, `consume()` 호출만 추가 |
| C6.2 rawVaultPath 우선순위 | 언급 없음 | history 기본 | history 기본 | **current path 우선**, tombstoned/missing 시 history fallback |
| C6.2 fallback 문구 | — | "(없음)" | 동일 | **citation 있지만 resolve 실패 시 WARN + 가능한 raw 링크**. citation 자체 0개면 fail closed |
| hide 모드 표/인용 | — | sentence 기반만 | 동일 | **sentence 시도 → line 시도 → block replacement** 3단 fallback |
| piiGuardEnabled=OFF 성격 | — | 기능 ON/OFF | 기능 ON/OFF | **명시: user-trust boundary — 기술 safety 아님** |

---

## 3. 스코프

### 3.1 In-scope
- C1+C2: 중앙 wrapper + 2-layer gate + PDF sidecar 재설계 (v4 신규)
- C3: runtime capability map + capabilities.json bridge (v4 신규)
- C4: onLayoutReady + delayed fallback + idempotent flag
- C5: `reindex.sh --check --json` contract + scripts-runner + polling (v4 신규 contract)
- C6.1: bypassBatch + `renameGuard.consume` + create-path doc detection HWP/HWPX 확장
- C6.2: Citation 기반 원본 링크 자동 append (current path 우선, history fallback)
- C6.3, C6.4: Processing modal UI

### 3.2 Out-of-scope
- Phase 5 §5.3/§5.4, 단건 삭제 (§4.C WARN), Cosmetic 이중 prefix, 기존 dead code

### 3.3 Non-goals
- LLM 답변에 "원본:" 생성 prompt 강제
- harness block 문서를 별도 수락 경로
- `piiGuardEnabled=OFF` 를 기술적 safety boundary 로 포장 — **user-trust only** 명시

---

## 4. 구현 계획

### 4.1 C1+C2 — 중앙 redact wrapper + PDF sidecar 재설계

#### 4.1.1 신규 `wikey-core/src/pii-redact.ts`

```ts
export type PiiRedactionMode = 'display' | 'mask' | 'hide'
export interface PiiMatch { kind: 'brn'|'corp-rn'|'ceo-labeled'; value: string; start: number; end: number }
export function detectPii(markdown: string): readonly PiiMatch[]
export function redactPii(markdown: string, mode: PiiRedactionMode): string
export class PiiIngestBlockedError extends Error { readonly matches: readonly PiiMatch[] }
```

**Regex** (codex v1 피드백 유지):
- BRN hyphenated: `/\b\d{3}-\d{2}-\d{5}\b/g`
- BRN contiguous (label): `/(?<=사업자(?:등록)?번호[\s:：]*)\d{10}(?!\d)/g`
- 법인번호 (label): `/(?<=법인(?:등록)?번호[\s:：]*)\d{6}-?\d{7}\b/g`
- CEO label: `/(?:대표이사|대표자|CEO)\s*[:：]\s*([가-힣]{2,4})/g`
- Unlabeled \d{13} 은 미감지 (FP 회피)

**Redact**:
- `display`: no-op
- `mask`: 자릿수 보존 치환
- `hide`: **3-단 fallback** (v4 신규):
  1. 1차: Korean sentence split (`~다\.`, `~요\.`, `~까\?`, `~죠\.`, `~네\.`, `…`, `!`, `?`) → match 포함 segment 를 `[PII 제거]` 로 치환
  2. 2차 (표/인용/목록): segment 분할이 match 범위와 불일치 (단일 긴 줄 OR 표 셀) → `\n` 기준 line replacement
  3. 3차 (모든 것 실패): match 전후 20 chars window 를 `[PII 제거]` 로 치환 (마지막 보루)

#### 4.1.2 중앙 wrapper — `ingest-pipeline.ts:150` 이후

```ts
const guardEnabled = opts?.piiGuardEnabled ?? true
const allowIngest = opts?.allowPiiIngest ?? false
const redactionMode: PiiRedactionMode = opts?.piiRedactionMode ?? 'mask'

if (guardEnabled) {
  const matches = detectPii(sourceContent)
  if (matches.length > 0) {
    if (!allowIngest) throw new PiiIngestBlockedError(matches)
    sourceContent = redactPii(sourceContent, redactionMode)
    log(`PII redacted — ${matches.length} match, mode=${redactionMode}`)
  }
} else {
  log(`PII guard disabled — skipping detect/redact (user-trust boundary, not a technical safety boundary)`)
}
```

#### 4.1.3 PDF sidecar 재설계 (v4 핵심 추가)

**문제 (codex v3 [P1])**: `ingest-pipeline.ts:1302 finalize()` 이 `wf(${fullPath}.md, sidecarContent)` 로 redact 전 markdown 을 raw/ 옆에 저장. 중앙 wrapper 는 이후 실행되므로 sidecar leak.

**수정 (다음 2 안 중 A 채택, 더 단순)**:

- **A 안 (채택)**: `extractPdfText::finalize()` 에서 **직접 sidecar write 를 제거**. 대신 `finalize()` 가 caller 에게 `{ stripped, sidecarCandidate }` 를 반환해 **sidecar 저장 권한을 caller 로 위임**. caller (`ingest()`) 는 중앙 wrapper 통과 후 `sidecarCandidate` 도 동일 redact 규칙으로 가공하여 저장:

  ```ts
  // ingest-pipeline.ts:156 현재 블록 확장
  // 기존: hwp/hwpx/docx 류만 sidecar 저장
  // 신규: PDF 포함 모든 "변환 필요한" 형식의 sidecar 를 redact 된 sourceContent 로 저장
  if (ext && ext !== 'md' && ext !== 'txt') {
    const sidecarPath = `${sourcePath}.md`
    try {
      // redact 후 상태이므로 sidecar 도 자동으로 안전
      await wikiFS.write(sidecarPath, sourceContent)
      log(`sidecar .md saved (post-redact) → ${sidecarPath}`)
    } catch (err) {
      log(`sidecar save skipped: ${err}`)
    }
  }
  ```

- **B 안 (기각)**: `finalize()` 에 redaction 로직 내장. 변환 계층이 Settings 를 알아야 함 → 결합도 증가.

**변경 파일** (v6 에서 시그니처 단일화 — "stripped만 반환"/"object 반환" 혼재 표현 제거):
- `wikey-core/src/ingest-pipeline.ts`:
  - `1321~1329 try { wf(${fullPath}.md, sidecarContent)... }` 블록 제거
  - `1302 finalize()` 의 반환형을 `string` → **`{ stripped: string; sidecarCandidate: string }`** 로 승격 (최종 단일 시그니처). `hasRedundantEmbeddedImages` 로 유도되는 useStripped 분기는 caller 가 아닌 `finalize()` 내부에서 여전히 수행 (raw vs stripped 판단 책임 유지)
  - `extractPdfText()` 의 반환형도 동일하게 `Promise<{ stripped; sidecarCandidate }>` 로 승격
  - `156~167 sidecar 저장 블록` 의 조건을 `ext !== 'md' && ext !== 'txt'` 로 확장 (기존 `ext !== 'pdf'` 제외 조건 제거). caller 는 `sidecarCandidate` 를 받아 중앙 wrapper 의 redact 규칙을 한 번 더 적용 후 저장

  ```ts
  // finalize() 신규 반환형 — 기존 string 반환을 object 로 승격
  return { stripped, sidecarCandidate: useStripped ? stripped : md }
  ```

  **signature 변경 영향 범위 (v5 codex 피드백 반영)**:
  - `extractPdfText()` 의 반환형을 `Promise<string>` → `Promise<{ stripped: string; sidecarCandidate: string }>` 로 승격
  - **모든 caller 업데이트 필요** — 현재 호출자:
    1. `ingest-pipeline.ts:173 ingest()` — main branch
    2. `ingest-pipeline.ts:781 generateBrief()` — Stay-involved Brief 모달용 (stripped 만 필요)
    3. 관련 vitest fixtures (있으면)
  - Caller 업데이트 패턴: `const { stripped } = await extractPdfText(...)` (브리프/테스트는 sidecarCandidate 무시)

- `ingest-pipeline.ts::ingest()`:
  - PDF branch (`extractPdfText` 호출부) 가 `{ stripped, sidecarCandidate }` destructure
  - `sourceContent = stripped` 로 LLM 투입
  - 중앙 wrapper 통과 후 `sidecarCandidate` 도 동일 wrapper 적용 → 저장

```ts
// PDF branch 수정본 (개략)
const { stripped, sidecarCandidate } = await extractPdfText(sourcePath, opts?.basePath, opts?.execEnv, config)
if (!stripped || stripped.trim().length < 50) throw new Error(...)
sourceContent = stripped
let pdfSidecarCandidate: string | null = sidecarCandidate

// [중앙 wrapper — 위 4.1.2 코드] 
// sourceContent 에 redact 적용. pdfSidecarCandidate 도 동일 로직 재적용:
if (pdfSidecarCandidate && guardEnabled) {
  const mm = detectPii(pdfSidecarCandidate)
  if (mm.length > 0 && allowIngest) {
    pdfSidecarCandidate = redactPii(pdfSidecarCandidate, redactionMode)
  }
}

// sidecar write 블록: PDF 는 pdfSidecarCandidate, 그 외는 sourceContent
if (ext && ext !== 'md' && ext !== 'txt') {
  const content = ext === 'pdf' ? (pdfSidecarCandidate ?? sourceContent) : sourceContent
  await wikiFS.write(`${sourcePath}.md`, content)
}
```

#### 4.1.4 Settings 필드 + UI

WikeySettings:
```ts
allowPiiIngest: boolean                          // basic, default: false
piiRedactionMode: 'display' | 'mask' | 'hide'   // basic, default: 'mask'
piiGuardEnabled: boolean                         // advanced, default: true
```

UI (`settings-tab.ts::renderGeneralSection`):
- Toggle `allowPiiIngest`: "PII 감지 시 인제스트 진행"
- Dropdown `piiRedactionMode`: display / mask (기본) / hide
- Toggle `piiGuardEnabled` (Advanced 섹션): "PII 검사 활성화" + **경고 문구**: "끄면 PII 검사를 수행하지 않습니다. 공시 가능 문서만 끄세요. 이것은 사용자 신뢰 설정이며 기술적 안전 장치가 아닙니다."

#### 4.1.5 테스트 — `pii-redact.test.ts`

- detect positive (4) / FP negative (3)
- mask / display 기본 (3)
- hide 3-단 fallback (4): 산문 / 표 셀 / 인용 / 전부 실패 window
- 2-layer gate integration (5): Guard+Allow 조합 4 + md 원본 동일 분기 1
- **PDF sidecar redact (2)**: PDF branch 에서 sidecar 도 redact / guardOFF 에서 원문 유지

총 **+21 tests** (v3 18 → v4 21).

#### 4.1.6 수락 기준

- file 2 사업자등록증.pdf (allowPiiIngest=ON, mask): sources page + entity + concept + **`raw/0_inbox/사업자등록증C_굿스트림.pdf.md` sidecar** 전부 `***` 로 저장
- file 3 SK 계약서.pdf (OFF 기본 → block / ON+mask → 동일 redact)
- file 1 llm-wiki.md (md 원본): 동일 wrapper 통과
- guardEnabled=OFF: 사업자등록증.pdf sidecar 에 원문 BRN 잔존 (사용자 명시 선택 결과)

---

### 4.2 C3 — runtime capability map + audit-ingest.py bridge

**문제 (codex v3 [P3])**: TS/UI 만 runtime, audit-ingest.py 는 static. docling 미설치 edge 가 JSON/CLI 에서 해결 안 됨.

**구현** — capabilities.json bridge (v4 핵심):

#### 4.2.1 `wikey-core/src/env-detect.ts` 확장

```ts
export interface SupportedExtensionMap {
  readonly supported: ReadonlySet<string>
  readonly unsupported: ReadonlySet<string>
  readonly doclingInstalled: boolean
  readonly unhwpInstalled: boolean
  readonly generatedAt: string  // ISO timestamp
}

export async function buildCapabilityMap(basePath, execEnv): Promise<SupportedExtensionMap>
export async function dumpCapabilityMap(basePath, execEnv, cachePath: string): Promise<void>
```

#### 4.2.2 플러그인 onload 에서 덤프

`wikey-obsidian/src/main.ts::onload()` 에서 (onLayoutReady 직후):

```ts
this.app.workspace.onLayoutReady(async () => {
  try {
    const { join } = await import('node:path')
    const home = process.env.HOME ?? ''
    const cachePath = join(home, '.cache', 'wikey', 'capabilities.json')
    await dumpCapabilityMap(this.basePath, this.execEnv, cachePath)
  } catch (err) {
    console.warn('[Wikey] capabilities dump failed:', err)
  }
})
```

#### 4.2.3 `scripts/audit-ingest.py` runtime bridge

```python
from pathlib import Path
import json, os

CAPABILITIES_CACHE = Path.home() / ".cache" / "wikey" / "capabilities.json"

def load_supported_extensions() -> tuple[set[str], set[str]]:
    """플러그인이 덤프한 runtime capability 읽기. 없으면 fallback."""
    if CAPABILITIES_CACHE.exists():
        try:
            data = json.loads(CAPABILITIES_CACHE.read_text(encoding="utf-8"))
            supported = {e.lower() for e in data.get("supported", [])}
            unsupported = {e.lower() for e in data.get("unsupported", [])}
            return supported, unsupported
        except (json.JSONDecodeError, OSError):
            pass
    # Fallback — 플러그인 미실행 환경에서도 기본 동작
    return ({".md", ".txt", ".pdf"}, {".doc", ".ppt", ".xls"})

SUPPORTED_EXTS, UNSUPPORTED_EXTS = load_supported_extensions()
```

JSON schema 에 `status` 추가:
```python
{ "path": ..., "name": ..., "normalized": ..., "status": "missing" | "unsupported" }
```

#### 4.2.4 UI — Audit rendering

- `buildCapabilityMap` 결과 in-memory 캐시
- unsupported 행: `wikey-audit-row-unsupported` 빨간색 + button disabled + tooltip
- docling/unhwp 미설치 시 상단 경고 배너

#### 4.2.5 `main.ts:223` create detection 확장 (codex v3 gap 반영)

```ts
// 공유 상수로 추출 — capabilities map 의 supported set 기준
// v5 codex 피드백: DOCLING_DOC_FORMATS (ingest-pipeline.ts:64) 와 완전히 일치시키기.
// 기존 v4 예시에 htm/tif/csv 누락 → create/notice 경로에서 감지 어긋남. 전부 포함:
const DOC_EXT_RE = /\.(md|txt|pdf|hwp|hwpx|docx|pptx|xlsx|csv|html|htm|png|jpg|jpeg|tiff|tif)$/i
// ...
const isDoc = DOC_EXT_RE.test(file.path)
```

실제로는 런타임 capability map 과 동기화 → unsupported 감지된 확장자는 우회. 단순하게는 위 re 로 시작, 추후 map 조회로 교체. re 는 반드시 `DOCLING_DOC_FORMATS + ['hwp', 'hwpx', 'md', 'txt']` 의 union 기준으로 유지 (core 상수 변경 시 같이 업데이트).

#### 4.2.6 테스트

- `env-detect.test.ts` +5 (capability map 4 조합 + dumpCapabilityMap JSON 쓰기)
- audit-ingest.py 는 수동 smoke 에서 확인 (TS 테스트 대상 아님)

#### 4.2.7 수락 기준

- smoke Pass B: file 5/6 (hwp/hwpx) Audit 진입 + ingest 완료
- 가상 `.doc`: 빨간 행 + disabled
- docling 제거 상태: PDF 빨간 행 + 상단 배너 + audit-ingest.py JSON 에도 `status=unsupported`
- `capabilities.json` 파일 존재 확인 (플러그인 onload 후)

---

### 4.3 C4 — startup reconcile (v3 확정)

v3 내용 그대로 적용. `main.ts:213` 을 `workspace.onLayoutReady()` 로 이동 + delayed 1500ms fallback + `startupReconcileDone` idempotent flag.

---

### 4.4 C5 — reindex + freshness contract (v4 재설계)

**문제 (codex v3 [P2])**: v3 가 `--stale=0`, `stale: N` 을 가정했으나 현재 `scripts/reindex.sh` 에 contract 미존재.

**구현 — contract 를 먼저 스크립트에 추가**:

#### 4.4.1 `scripts/reindex.sh` 확장

현재 `--check` 는 human-readable 만 출력. 신규 플래그 `--json` 추가:

```bash
# reindex.sh 내부 — --check --json 모드 추가
if [[ "$1" == "--check" && "$2" == "--json" ]]; then
  status=$(check_stale | head -1)
  if [[ "$status" == "fresh" ]]; then
    echo '{"stale":0,"status":"fresh"}'
  elif [[ "$status" == "never" ]]; then
    echo '{"stale":-1,"status":"never"}'
  else
    count=$(check_stale | tail -n +2 | wc -l | tr -d ' ')
    echo "{\"stale\":${count},\"status\":\"stale\"}"
  fi
  exit 0
fi
```

#### 4.4.2 `wikey-core/src/scripts-runner.ts` 확장

**Prerequisite — shared helper 확장 (v6 codex 피드백 반영)**:
- `ScriptResult` 인터페이스 (`scripts-runner.ts:13` 주변) 에 `success: boolean`, `exitCode: number`, `stderr: string` 필드가 노출되어 있는지 확인. 누락된 필드는 신규 추가.
- `runScript(basePath, script, args, env, opts?)` (`scripts-runner.ts:19` 주변) 의 `opts` 에 `timeoutMs?: number` 추가. 내부 `child_process.execFile` 호출에 `AbortController` 로 연결. 기본 동작 (timeout 없음) 은 하위호환 유지.
- 아래 새 helper (`reindexQuick` / `reindexCheckJson`) 가 위 필드·옵션에 의존하므로 **shared helper 확장이 선행**.

```ts
export async function reindexQuick(
  basePath: string, execEnv: Record<string, string>, timeoutMs = 60_000,
): Promise<void> {
  const res = await runScript(basePath, 'scripts/reindex.sh', ['--quick'], execEnv, { timeoutMs })
  // v5 codex 피드백: success=false 는 반드시 실패로 승격 (Stage 2 gate 가 잘못 열리는 것 방지)
  if (!res.success || res.exitCode !== 0) {
    throw new Error(`reindex --quick failed (exit=${res.exitCode}): ${res.stderr?.slice(0, 200) ?? ''}`)
  }
}

export async function reindexCheckJson(
  basePath: string, execEnv: Record<string, string>,
): Promise<{ stale: number; status: 'fresh' | 'stale' | 'never' }> {
  const res = await runScript(basePath, 'scripts/reindex.sh', ['--check', '--json'], execEnv)
  // v5: 계약 엄격화 — exitCode≠0 또는 JSON parse 실패는 즉시 throw
  if (!res.success || res.exitCode !== 0) {
    throw new Error(`reindex --check --json failed (exit=${res.exitCode})`)
  }
  const parsed = JSON.parse(res.stdout.trim())
  // v6: shape + enum membership 둘 다 검증 (codex 피드백)
  const validStatuses = new Set(['fresh', 'stale', 'never'])
  if (typeof parsed.stale !== 'number' || typeof parsed.status !== 'string' || !validStatuses.has(parsed.status)) {
    throw new Error(`reindex --check --json: schema mismatch (stale=${parsed.stale}, status=${parsed.status})`)
  }
  return { stale: parsed.stale, status: parsed.status as 'fresh' | 'stale' | 'never' }
}

export async function waitUntilFresh(
  basePath: string, execEnv: Record<string, string>,
  timeoutMs: number, intervalMs = 500,
): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const { stale, status } = await reindexCheckJson(basePath, execEnv)
      // v5 codex 피드백: "never" 는 fresh 가 아님. stale === 0 AND status === 'fresh' 만 성공.
      // status === 'never' (reindex 한 번도 실행 안 됨) 은 Stage 2 를 열면 안 됨 → polling 지속.
      if (status === 'fresh' && stale === 0) return
    } catch (err) {
      // contract 위반 (구버전 reindex.sh 등) — timeout 까지 재시도
      console.warn('[Wikey] reindexCheckJson transient error:', err)
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`freshness timeout after ${timeoutMs}ms (never reached status=fresh && stale=0)`)
}
```

#### 4.4.3 `ingest-pipeline.ts:423~428` 교체

v3 코드 유지. `reindexQuick` + `waitUntilFresh` 호출.

#### 4.4.4 `WIKEY_REINDEX_TIMEOUT_MS` 설정 (default 60000, max 300000 cap).

#### 4.4.5 테스트

- `scripts-runner.test.ts` +4: `reindexCheckJson` parse / `waitUntilFresh` stale 0/N/timeout
- `reindex.sh --check --json` bash smoke: 세 status 에서 올바른 JSON 출력 확인 (CI 또는 수동)

#### 4.4.6 수락 기준

- smoke Pass A/B Stage 2 "관련 내용이 없어요" 재현 안됨
- `reindex.sh --check --json` 세 status 반환 확인
- vault 100+ 페이지에서 60s 이내 완료 (또는 Notice "지연 — 잠시 후 검색 가능")

---

### 4.5 C6 — UI/UX 5 이슈

#### 4.5.1 C6.1 — bypassBatch guard

- `main.ts:235~247` create listener 에 `this.renameGuard.consume(file.path)` 호출 → true 시 skip
- `RenameGuard` 는 이미 5s TTL default (`vault-events.ts:44`). **추가 조정 불필요** (codex v3 gap 반영 — v3 의 "2000→3000ms" 오인 수정)
- movePair 직전 `renameGuard.register(newPath)` 가 이미 호출되는지 확인. 누락 시 추가

#### 4.5.2 C6.2 — Citation 기반 원본 링크 자동 append (current path priority)

- `query-pipeline.ts::buildSynthesisPrompt` 에서 `원본:` 지시 제거 (LLM 생성 X)
- 신규 `appendOriginalLinks(answer, citations, wikiFS)`:
  - citation.sourceIds → `resolveSource()` 
  - **current path 우선** (registry SourceRecord 의 **`vault_path` 필드**, source-registry.ts:18 기준) — v5 codex 피드백으로 필드명 확정 (v4 에서 `current_path` 로 오기 → 실제는 `vault_path` 단일 필드)
  - tombstone 또는 `vault_path` 미존재 (legacy record) 시: **`path_history` 의 마지막 유효 항목** 을 fallback. `path_history[0]` 은 최초 항목이라 의미가 반대 — "마지막 유효 raw path" 가 정확한 의도
  - 결과 `원본: [[raw/...]], [[raw/...]]` append
  - **citation 있지만 resolve 전부 실패**: `원본: (해석 실패 — registry 점검 필요)` (WARN 표기) — codex v3 피드백
  - **citation 0개**: `원본: (없음 — 외부 근거 없음)` (fail closed)
- `source-resolver.ts::ResolvedSource` 에 `rawVaultPath` 필드 추가 (additive)
- `resolveSource()` 내부 `buildResolved` 가 `record.vault_path` 우선 사용, 없으면 `record.path_history` 의 마지막 비어있지 않은 entry fallback. 둘 다 없으면 null 반환 → caller 가 해석 실패로 처리

- 테스트 `query-pipeline.test.ts` +4:
  - current path 있음 → `원본: [[raw/2_areas/foo.pdf]]`
  - current path 없고 history 있음 → `원본: [[raw/archive/foo.pdf]]`
  - 전부 tombstone → `원본: (해석 실패)`
  - citation 0개 → `원본: (없음)`

#### 4.5.3 C6.3 — modal file label (v3 유지)

`ingest-modals.ts::renderProcessingPhase` 시작부에 fileLabel. CSS accent.

#### 4.5.4 C6.4 — modal layout (v3 유지)

DOM 순서: fileLabel → spinner → progress-bar → button. CSS flex column + `progress-bar { margin-top: auto }`.

#### 4.5.5 C6.5 — C3 로 자동

---

## 5. 검증 계획

### 5.1 단위 테스트 (vitest)
- `pii-redact.test.ts` 신규 — **+21**
- `env-detect.test.ts` 확장 — **+5**
- `scripts-runner.test.ts` 확장 — **+4**
- `query-pipeline.test.ts` 확장 — **+4**

총 **+34 tests**. 462 → **496+ tests**.

### 5.2 통합 smoke 재실행

`plan/phase-4-integrated-test.md v6` Pass A/B + 보조 2b (Guard OFF) + 3b (Allow OFF = block). 상세는 v3 §5.2 표 그대로 적용.

### 5.3 추가 smoke (v4 신규)
- **PDF sidecar redact 확인**: file 2 ingest 후 `raw/0_inbox/사업자등록증C_굿스트림.pdf.md` 내용에 BRN/CEO 가 `***` 으로 치환됐는지 grep
- **capabilities.json 덤프**: Obsidian 시작 후 `~/.cache/wikey/capabilities.json` 존재 + docling/unhwp 감지 상태 JSON 확인
- **reindex.sh --check --json**: 3 status (fresh/stale/never) 수동 유도 후 bash 출력 확인

### 5.4 Codex Panel Mode D (v4) — 대기 중

---

## 6. 실행 순서

```
1. C1+C2 pii-redact (TDD) + 중앙 wrapper                     [~2h]
2. PDF sidecar 재설계 (extractPdfText::finalize 리팩터 + ingest caller) [~1.5h]
3. C3 capability map TS/UI + dumpCapabilityMap               [~1h]
4. C3 audit-ingest.py runtime bridge + main.ts DOC_EXT_RE    [~1h]
5. C4 onLayoutReady fix                                      [~30min]
6. C5 reindex.sh --check --json contract                     [~1h]
7. C5 scripts-runner helpers + ingest-pipeline integration   [~1h]
8. C6.1 bypassBatch consume                                  [~20min]
9. C6.2 appendOriginalLinks + rawVaultPath (current priority) [~1h]
10. C6.3 + C6.4 modal UI                                     [~1h]
11. build + vitest 496+ green                                [~30min]
12. codex Panel Mode D (v4)                                  [~20min]
13. 통합 smoke Pass A + B + 2b + 3b + v4 신규 3건            [~2h]
14. activity/phase-4-smoke-<DATE>-v2/ 리포트                 [~30min]
15. Phase 4 D 블록 선언                                      [~30min]
```

---

## 7. D 블록 승격 기준

1. [ ] vitest 496+ green
2. [ ] esbuild 0 errors
3. [ ] codex Panel Mode D (v4) = APPROVE 또는 APPROVE-WITH-CHANGES (critical 0)
4. [ ] Pass A 6/6 / Pass B 6/6 / 보조 2b / 보조 3b PASS
5. [ ] PDF sidecar redact 확인 (file 2/3 `*.pdf.md` 에 `***`)
6. [ ] capabilities.json 존재 + 세 확장자 상태 검증
7. [ ] `reindex.sh --check --json` 3 status 출력 확인
8. [ ] `activity/phase-4-smoke-<DATE>-v2/README.md` §4 판정 = 승인
9. [ ] 본 문서 §8 codex v4 결과 기록

---

## 8. Codex 검증 결과

### 8.1 v1 → REJECT (2026-04-24)
4 critical. 핵심: pre-gate 위치 / canonicalizer leak / reindexCheck rebuild X / static 테이블.

### 8.2 v2 → skip (v3 로 승계)

### 8.3 v3 → REJECT (2026-04-24)
3 critical + 3 gap. 핵심: **PDF sidecar leak (extractPdfText::finalize)** / **reindex contract 부재** / **audit-ingest.py static 지속**. 그러나 C4/C6.3/C6.4 = OK, 2-layer 분기 순서 = 적정 판정.

**v4 반영**: PDF sidecar 경로 재설계 (finalize 에서 제외 → caller 에서 redact 후 저장) / `reindex.sh --check --json` 신규 contract / capabilities.json bridge / RenameGuard TTL 오인 수정 / rawVaultPath current priority / hide 3-단 fallback / GuardOFF user-trust boundary 명시.

### 8.4 v4 → APPROVE-WITH-CHANGES (2026-04-24)

**판정**: APPROVE-WITH-CHANGES (OK 4 / CHANGES 4). 2-layer 분기 순서·hide 3-단·rawVaultPath additive·60s cap·GuardOFF user-trust — 전부 **적정**.

**OK**: C4 onLayoutReady / C6.1 bypassBatch consume / C6.3 modal label / C6.4 modal layout

**CHANGES 4건 (v5 반영 완료)**:
1. **C5 fresh 조건** — `waitUntilFresh` 가 `stale<=0` 으로 처리하면 `status:"never"` (reindex 한 번도 안 실행) 도 fresh 로 오인. `status === 'fresh' && stale === 0` 만 성공 처리. `reindexQuick` 은 `success=false` 시 throw 로 승격. → v5 §4.4.2 반영
2. **extractPdfText caller 범위** — v4 가 `ingest()` 만 언급했으나 `generateBrief()` (ingest-pipeline.ts:781) 도 같은 함수 호출. 반환형 `Promise<string>` → `Promise<{ stripped, sidecarCandidate }>` 승격 시 **모든 caller 동시 업데이트 필요**. → v5 §4.1.3 반영
3. **C6.2 필드명** — v4 가 `record.current_path` 로 오기. 실제는 `source-registry.ts:18` 의 **`vault_path`** 단일 필드. fallback 은 `path_history` 의 **마지막 유효 항목** (`[0]` 은 최초 항목이므로 의미 반대). → v5 §4.5.2 반영
4. **DOC_EXT_RE 확장자** — v4 의 `md|txt|pdf|hwp|hwpx|docx|pptx|xlsx|html|png|jpg|jpeg|tiff` 에서 `htm`, `tif`, `csv` 누락. core `DOCLING_DOC_FORMATS` 와 맞추기. → v5 §4.2.5 반영

### 8.5 v5 → APPROVE-WITH-CHANGES / CRITICAL: None (2026-04-24)

**판정**: APPROVE-WITH-CHANGES. **CRITICAL FINDINGS: None** — "v4의 4개 blocking change request는 v5 문서상 모두 반영됐습니다."

**OK (6건)**: C3 (DOC_EXT_RE lockstep 명시), C4, C6.1, C6.2 (current_path 혼란 해소 + fallback semantic 정확), C6.3, C6.4.

**CHANGES (2건, 문서 일관성 수준)**:
1. §4.1.3 에 `extractPdfText()` 시그니처가 "stripped만 반환" / "{ stripped, sidecarCandidate } 반환" 로 중복 서술 → **v6 에서 `{ stripped, sidecarCandidate }` 로 단일화**
2. §4.4.2 가 scripts-runner helper 확장을 암시적으로만 언급. `ScriptResult` (`success`/`exitCode`/`stderr`) + `runScript` 의 `timeoutMs` 옵션이 실제로 필요 → **v6 에서 prerequisite 섹션 추가**. 또한 JSON schema 검증이 shape 만 체크 → **`status` enum membership 검증 추가**

### 8.6 v6 → 구현 착수 승인 (2026-04-24)

v5 의 2 CHANGES 반영 완료. 별도 codex 재검증 불필요 (v5 에서 CRITICAL=None 확정, v6 는 문구 일관성만 보정).

---

## 9. 변경 이력

- **v1** (2026-04-24) — 초안. REJECT.
- **v2** (2026-04-24) — v1 REJECT 반영. 사용자 추가 결정으로 v3 승계.
- **v3** (2026-04-24) — 사용자 4회 결정 반영. REJECT (3 critical + 3 gap).
- **v4** (2026-04-24) — codex v3 피드백 전면 반영. PDF sidecar 재설계 / reindex contract 신규 / capabilities.json bridge / TTL 오인 수정 / rawVaultPath priority / hide fallback / OFF 문구. codex 판정 = **APPROVE-WITH-CHANGES** (OK 4 / CHANGES 4).
- **v5** (2026-04-24) — codex v4 의 CHANGES 4건 반영. (1) `waitUntilFresh` 성공 조건을 `status==='fresh' && stale===0` 로 엄격화, `reindexQuick` 실패 승격 (2) `extractPdfText` 반환형 승격 시 `generateBrief()` 포함 모든 caller 업데이트 명시 (3) `record.current_path` → `record.vault_path` 필드명 정정, fallback = path_history 마지막 유효 항목 (4) `DOC_EXT_RE` 에 htm·tif·csv 추가. codex 판정 = **APPROVE-WITH-CHANGES / CRITICAL: None** (6 OK / 2 문서 일관성 CHANGES).
- **v6** (2026-04-24) — v5 잔여 CHANGES 2건 정리: (a) `extractPdfText()` 시그니처를 `{ stripped, sidecarCandidate }` 로 단일 명시 (중복 서술 제거) (b) `scripts-runner.ts` helper 확장 prerequisite 섹션 추가 (`ScriptResult` 필드 / `runScript` timeoutMs) (c) JSON schema 검증에 `status` enum membership 체크. **구현 착수 승인 상태**.

