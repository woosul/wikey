# §5.3.1 + §5.3.2 — Hash 기반 증분 재인제스트 + sidecar/wiki 보호

> **상위 문서**: [`plan/phase-5-todo.md`](./phase-5-todo.md) §5.3.1, §5.3.2
> 작성일: 2026-04-25
> 작성자: analyst (Claude)
> 검증: codex Mode D — v1 REJECT (P1 8건 + P2 7건) → **v2 정정 적용 (2026-04-25)** → 재검증 예정

## 변경 이력 (v1 → v2)

> codex Mode D v1 검증 REJECT 사유 8건 (P1) + 7건 (P2) 모두 본 plan 에 반영. 변경 라인 식별용.

| ID | 변경 위치 (섹션) | 핵심 변경 |
|----|-----------|---------|
| **P1-1** | 결정 2 / 결정 8 (Step 0/0.5/0.6) / Step 2 case 8 / Step 3 Implementation | hash 비교 시점을 **포맷 변환 전 raw disk bytes** 로 이동. ingest-pipeline.ts Step 0 신설 (line 138 이전). `decideReingest` 시그니처 docstring invariant: "sourceBytes 는 raw disk bytes" |
| **P1-2** | 결정 6 (Registry 스키마) / Step 1 / Step 3 Hook 1 | `pending_protections: PendingProtection[]` 필드 신규. **sidecar_hash 갱신 단일 규칙**: canonical `<sourcePath>.md` write 직후에만 갱신. `.md.new` write 시 미갱신 + pending append. helper 신규 `appendPendingProtection / clearPendingProtection` |
| **P1-3** | 결정 4 / 결정 7 / Step 2 case 9-10, 12 / Step 3 case 3 / Step 6 case 7 / Risk 5 정정 | action `'skip-with-seed'` 신설. legacy record (sidecar_hash 미존재) 첫 hash-match 시 LLM·page write 0 으로 sidecar_hash 만 채움. 두 번째 ingest 부터 정상 skip |
| **P1-4** | 결정 4 (트리 재명세) / 결정 8 / Step 2 case 11 | conflicts[] **먼저 모두 collect** 후 action 결정 (sequential return 금지). 동시 발생 (A/F + D) test case 추가. ConflictKind union 에 `'legacy-no-sidecar-hash'` 추가 |
| **P1-5** | 결정 5 (시나리오 D) / Step 3 Hook 2 / Step 3 case 7 (negative) / Trade-off 신규 | wiki page 보호를 **`wiki/sources/source-*.md` 한정 (narrowing)** 으로 결정. entity/concept 미보호 + negative test 추가. 후속 #4 등재. todo §5.3.2 라인 234·245 narrowing 필요 (master 처리) |
| **P1-6** | 결정 4 (case E) / 결정 5 (E) / Step 1 helper / Step 3 case 9 | duplicate-hash skip 시 **duplicate_locations** append **필수** (옵션 아님, ★ v4: path_history 아님). 신규 helper `appendDuplicateLocation`. `decision.duplicatePathToAppend` 노출 |
| **P1-7** | 결정 5 (B) / Step 4 (rewrite) / Step 1 helper | movePair sidecar 목적지 **pre-resolve (원본 이동 전)** + `sidecarSkipReason='dest-conflict-exhausted'` 추가. registry 갱신 helper `recordMoveWithSidecar` (vault_path + sidecar_vault_path atomic) |
| **P1-8** | 결정 9 (Audit) / Step 5 case 3-4 / Acceptance | audit JSON 컬럼 **분리**: `source_modified_since_ingest` (raw hash diff) + `sidecar_modified_since_ingest` (sidecar hash diff). 두 fixture 가 각각 한 컬럼만 채우는 negative-cross test |
| **P2-1** | 결정 6 / 결정 9 / Step 5 case 6 / Risk 6 신규 / 후속 #1 | `pending_protections` audit 컬럼 + `clearPendingProtection` helper. 자동 cleanup 은 후속 |
| **P2-2** | Step 3 Implementation 끝 | wikiFS.write best-effort: `.md.new` write 실패 시 `IngestProtectionFailedError` throw 명시 |
| **P2-3** | 결정 7 / Step 6 (default modal 주입) / case 5-6 / Trade-off | plugin onConflict 미제공 시 default = `ConflictModal` 자동 주입 (silent auto-protect 위험 제거) |
| **P2-4** | Step 5 (exit 0 증거) | shell smoke 의 `exit=$?` 캡처 + bats 형식 명시. 기대 JSON 파일 비교 |
| **P2-5** | Step 2 case 18 / Risk 4 | mergeUserMarkers 멱등성 test 추가 |
| **P2-6** | Step 2 Implementation / case 17 | extractUserMarkers `^## ` multiline regex 명시. 코드블록 내부 false positive 최소화 |
| **P2-7** | 결정 9 / Step 2 Implementation / Step 5 Implementation / 후속 #9 | NFC 정규화 가정 명시 (TS `computeSidecarHash` 와 Python `unicodedata.normalize('NFC', ...)` 동등). cross-language 자동 검증은 후속 |

**테스트 카운트 변경**: Step 1 (3→7) + Step 2 (14→23) + Step 3 (5→12) + Step 4 (3→6) + Step 5 (4→6) + Step 6 (5→7) = **30 → 61 신규 case** (회귀 baseline 584 → 예상 645). ★ v7 정정 (codex v6 P2-1): Step 3 `12 cases` (test #12 legacy hook 포함) + Step 4 `6 cases` (★ v5 skip frontmatter preserve test #6 포함) 정확 반영.

---

## 요구사항 (사용자 의도)

1. **§5.3.1 증분 재인제스트**: 같은 raw 파일을 두 번째 ingest 할 때, 내용이 안 바뀌었으면 LLM 호출·wiki page write·reindex 까지 모두 skip 한다. 바뀌었으면 재인제스트하되 사용자가 wiki/sidecar 에 추가한 흔적은 보호한다.
2. **§5.3.2 사용자 수정 보호**: ingest 가 재실행될 때 disk 의 sidecar `.md` 와 `wiki/sources/<source>.md` 본문이 사용자 손에 의해 변경됐으면 그 변경을 LOST 시키지 말 것. 8 시나리오 (A~H) 중 위험 3건 (A/F/D) 은 절대 silent overwrite 금지.
3. **결합 제약**: §5.3.1 의 hash diff 인프라 위에서 §5.3.2 의 보호 로직이 동작. 둘은 같은 helper 모듈로 진입 — `decideReingest(...)`.
4. **Backwards compat**: 기존 `wikey ingest` 명령 인자·동작은 default 유지. 신규 동작은 새 플래그/옵션 또는 자동 감지 후 prompt 로 노출.
5. **Surgical**: `ingest-pipeline.ts` (1965 lines) 본문 수정은 최소화. 새 helper 파일 (`incremental-reingest.ts`) 분리. 본문 수정은 ingest 진입 직후 1 곳 + sidecar/source page write 직전 각 1 곳 (총 3 곳 이내).

---

## 현 상태 분석

### 이미 갖춰진 인프라

| 인프라 | 위치 | 상태 |
|--------|------|------|
| 컨텐츠 hash | `wikey-core/src/uri.ts:26` `computeFullHash(bytes) → sha256 hex` | ✅ |
| Registry source hash | `source-registry.ts:21` `SourceRecord.hash: string` (full sha256) | ✅ |
| Registry sidecar path | `source-registry.ts:20` `sidecar_vault_path?: string` | ✅ (path만, hash 없음) |
| Registry CRUD | `loadRegistry / saveRegistry / upsert / findById / findByHash` | ✅ |
| Reconcile (startup) | `source-registry.ts:149` `reconcile(reg, walker)` — disk vs registry hash 매칭 후 move/tombstone | ✅ |
| Audit (외부) | `scripts/audit-ingest.py` — wiki/sources/ vs raw/ 존재 여부만, hash 비교 없음 | △ (확장 여지) |
| MovePair conflict | `classify.ts:520` `sidecarSkipReason='dest-conflict'` (시나리오 B 부분 cover) | △ (skip 만, prompt 없음) |

### 현 ingest 흐름의 silent overwrite 지점 (§5.3.2 위험 origin)

| 라인 | 동작 | 시나리오 |
|------|------|----------|
| `ingest-pipeline.ts:226-233` | 매 ingest 시 `wikiFS.write(<source>.md, sidecarBody)` 무조건 overwrite | A, F |
| `ingest-pipeline.ts:417` | `await createPage(wikiFS, sourcePage)` (sources/) — exists 여부 체크는 `updatedPages` 분기용일 뿐 본문 보존 없음 | D |
| `ingest-pipeline.ts:447 / 455` | entity/concept page createPage 도 동일 | D |

`createPage` 는 `wiki-ops.ts` 에 있고 `wikiFS.write` 직접 호출. 사용자가 wiki/sources/source-X.md 에 `## 사용자 메모` 같은 추가 H2 를 만들어 둬도 다음 ingest 의 LLM 결과가 그대로 덮어씀.

### Registry 가 갖고 있지 않은 정보

- **`sidecar_hash`**: sidecar `.md` 본문의 sha256. 현재 record 에 없음. → 시나리오 A/F detect 의 핵심 신규 필드.
- **`source_page_hash`**: wiki/sources/source-X.md 본문 hash (사용자 수정 detect). 현재 없음. → 시나리오 D detect 용. 다만 LLM 출력 재현성 떨어지면 오탐 — wiki page 는 marker 보호 패턴이 더 안전.
- **`reingested_at: string[]`**: 매 재인제스트 시각 기록. 현재 `first_seen` 만 있음. 디버깅·UI 표기용 신규 필드.

### Audit 의 확장 여지

`scripts/audit-ingest.py` 는 이미 raw/ vs wiki/ 매칭을 수행. JSON 출력에 hash diff 컬럼만 추가하면 dashboard 가 "변경됨" 행을 시각화 가능. 단, 현재 hash 비교를 안 하고 있고 Python ↔ TS hash 일관성 (sha256 hex) 만 맞으면 됨.

---

## 설계

### 결정 1 — diff 단위: file path × content hash 양쪽

| 단위 | 비교 대상 | 결정 분기 |
|------|----------|----------|
| **vault_path** | registry 의 `vault_path` + `path_history[]` vs 현재 ingest 요청 path | 같은 path → 같은 source 일 가능성, hash 비교로 확증. 다른 path 인데 hash 같음 → 사용자 복사·이동 (시나리오 E) |
| **content hash** | registry 의 `record.hash` vs 현재 disk 의 `computeFullHash(bytes)` | 같음 → no-op skip. 다름 → re-ingest 트리거 |
| **sidecar hash** | registry 의 `record.sidecar_hash` (신규) vs 현재 disk 의 `<sourcePath>.md` hash | 같음 → 무사. 다름 → 사용자가 sidecar 직접 수정 (시나리오 A/F) → 보호 동작 |

### 결정 2 — hash 비교 시점: **포맷 변환 전 raw disk bytes** 로

> **★ codex P1-1 정정 (2026-04-25)**. 변환된 텍스트 (Docling/unhwp/HWP/PDF stripped) 는 비결정적 — 같은 source 라도 변환 결과 hash 가 매번 달라질 수 있다. registry 의 `record.hash` 는 raw bytes 기준 (`ingest-pipeline.ts:1841` `readFileSync(fullPath)`) 이므로 비교도 raw bytes 로 해야 skip 결정이 의미를 가진다.

`ingest()` 함수 가장 앞 `Step 0` (신규) 에서 raw disk bytes 를 먼저 읽어 `decideReingest({ sourceBytes: rawDiskBytes, ... })` 호출. 변환 (Step 1) 은 그 이후. 시점 기준:

```
ingest() 진입
  ↓ ★ NEW Step 0: raw disk bytes read (basePath + sourcePath, fs.readFileSync — buildV3SourceMeta 와 동일 경로)
                  ↳ basePath 없는 환경 (vault-only) 은 wikiFS.read → TextEncoder.encode (buildV3SourceMeta:1846 폴백 mirror)
  ↓ ★ NEW Step 0.5: decideReingest({ sourcePath, sourceBytes: rawDiskBytes, wikiFS, basePath, onConflict? })
                    → ReingestDecision    (★ codex v3 P2 정정: forceReingest 제거 — caller-only override)
  ↓ Step 0.6 ReingestDecision 분기:
       'skip' → 즉시 return (cached IngestResult — registry.ingested_pages 에서 reconstruct, 또는 IngestResult.skipped=true)
                ※ skip 분기에서도 sidecar_hash 가 missing 인 legacy record 는 P1-3 경량 seed 경로 실행 후 return
       'force' (hash 다름, conflicts=[]) → 기존 흐름 그대로
       'protect' (hash 다름 또는 동일 + conflicts!=[]) → 보호 모드. conflicts[] 전체를 ingest-pipeline 의 각 hook 이 참조
       'prompt' (conflicts!=[] + onConflict 제공) → onConflict(ConflictInfo) → overwrite/preserve/cancel 응답에 따라 분기
  ↓ Step 1: 변환 (Docling/unhwp/PDF/HWP) — skip 분기에서는 도달 안 함 → 변환 비용 0
  ↓ Step 2~4: 기존 흐름 (sidecar/source page write 직전에 conflicts[] 기반 ProtectMode 적용)
```

이렇게 하면 변환 (Docling 수십 초) + PII gate + LLM 호출 + reindex 전체가 skip 가능 → 비용 0. raw bytes 읽는 비용은 부수적 (수십 ms).

**`decideReingest` 입력 정의 (Step 2 helper 와 일치)**:
- `sourceBytes: Uint8Array` 는 **반드시 raw disk bytes** (변환 전). caller (ingest-pipeline.ts) 책임.
- helper 는 입력 bytes 를 그대로 `computeFullHash` 에 전달. 어떤 변환도 helper 안에서 수행 안 함.

### 결정 3 — 신규 helper 모듈: `wikey-core/src/incremental-reingest.ts`

```ts
// incremental-reingest.ts (신규, ~200 lines 추정)

// ★ codex P1-3 정정: 'skip-with-seed' 신규 — legacy record (sidecar_hash 없음) 첫 재인제스트 시
//   LLM·page write 없이 registry 의 sidecar_hash 만 채우는 경량 분기.
export type ReingestAction = 'skip' | 'skip-with-seed' | 'force' | 'protect' | 'prompt'

export interface ReingestDecision {
  action: ReingestAction
  preservedSourceId?: string         // ★ codex v3 P1 (v4): R != null 분기에서 R.id 보존, R == null 분기 undefined
  duplicateOfId?: string             // ★ codex v6 P1 (v7): duplicate-hash skip 분기에서 R_byHash.id set. caller 가 appendDuplicateLocation(reg, decision.duplicateOfId, sourcePath) 호출
  // ★ P1-1 정정: reason 어휘 raw bytes 기준 명확화. P1-3 'hash-match-sidecar-seed' 추가.
  reason:
    | 'new-source'
    | 'hash-match'                    // raw bytes hash 동일, sidecar_hash 도 일치
    | 'hash-match-sidecar-seed'       // P1-3: hash 일치 + sidecar_hash missing + disk sidecar 존재 → seed
    | 'hash-match-sidecar-edit-noted' // hash 일치 + 사용자 sidecar 수정 (보존, skip)
    | 'hash-changed-clean'            // raw bytes 변경, conflicts=[]
    | 'hash-changed-with-conflicts'   // raw bytes 변경 + conflicts (sidecar/page user-edit)
    | 'duplicate-hash-other-path'     // 시나리오 E
  sourceHash: string                  // raw bytes hash (P1-1)
  registrySourceHash?: string         // registry 의 hash (없으면 처음 ingest)
  registrySidecarHash?: string
  diskSidecarHash?: string            // disk 에 sidecar 있을 때만, TextEncoder.encode(content) 후 sha256
  // ★ P1-4 정정: conflicts 는 sequential return 이 아닌 "먼저 모두 collect" 방식.
  conflicts: ConflictKind[]           // 동시 발생 가능 (예: ['sidecar-user-edit', 'source-page-user-edit'])
  registryRecord: SourceRecord | null
  // ★ P1-6 + v4 정정: duplicate-hash 시 신규 path 를 caller 가 duplicate_locations append (path_history 아님)
  duplicatePathToAppend?: string
}

export type ConflictKind =
  | 'sidecar-user-edit'         // 시나리오 A/F
  | 'source-page-user-edit'     // 시나리오 D
  | 'duplicate-hash'            // 시나리오 E
  | 'orphan-sidecar'            // 시나리오 C (audit-ingest.py 에서 detect, decideReingest 진입 안 함)
  | 'legacy-no-sidecar-hash'    // ★ P1-3 정정: legacy record 보수적 protect 사유 명시

export interface ConflictInfo {
  decision: ReingestDecision
  diff?: { sidecar?: string; sourcePage?: string } // unified diff snippet
}

export async function decideReingest(args: {
  sourcePath: string
  sourceBytes: Uint8Array
  wikiFS: WikiFS
  basePath?: string
  // optional UI hook for the 'prompt' branch — when not supplied, default = 'protect'
  onConflict?: (info: ConflictInfo) => Promise<'overwrite' | 'preserve' | 'cancel'>
}): Promise<ReingestDecision>

// User-marker preservation (시나리오 D wiki page 보호)
//   - extract H2 starting with `## 사용자 메모` (or override-configurable header) from existing wiki page
//   - injected back via mergeUserMarkers() before createPage() write
export const USER_MARKER_HEADERS = ['## 사용자 메모', '## User Notes', '## 메모']
export function extractUserMarkers(existingPage: string): string  // returns markdown blocks (or '')
export function mergeUserMarkers(newPage: string, markers: string): string  // appends to end if non-empty

// Sidecar protection (시나리오 A/F)
//   - on protect mode: write new sidecar to `<sourcePath>.md.new` instead of `.md`
//   - leave a Notice / log entry pointing user to diff
export function protectSidecarTargetPath(sourcePath: string, wikiFS: WikiFS): Promise<string>  // ★ codex v4 P2 align: wikiFS 인자 추가. default `<sourcePath>.md.new`, 충돌 시 `.md.new.1~.9`, `.10` 도달 시 throw IngestProtectionPathExhaustedError

// Sidecar hash compute helper (registry upsert 시 sidecar 저장 직후 호출)
export async function computeSidecarHash(wikiFS: WikiFS, sidecarPath: string): Promise<string | null>
```

`decideReingest` 가 단일 진입점. `ingest-pipeline.ts` 는 이 함수 결과만 보고 분기.

### 결정 4 — 재인제스트 결정 트리 (★ codex P1-3/P1-4 정정 — conflicts 먼저 collect, legacy seed 경량 경로 신설)

> **P1-4 정정 (2026-04-25)**: 결정 트리는 sequential return 금지. conflicts[] 를 **먼저 모두 모은 뒤** action 결정.
> **P1-3 정정 (2026-04-25)**: hash-match 분기 + sidecar_hash missing + disk sidecar 존재 → 경량 seed 경로 추가. 첫 재인제스트에서 sidecar_hash 채워주지 않으면 영원히 protect.

```
입력:
  H_now      = computeFullHash(rawDiskBytes)
  R_byPath   = registry record found by sourcePath OR path_history[].vault_path
  R_byHash   = registry record found by hash == H_now (different from R_byPath)
  diskSidecarBytes = wikiFS.read(`${sourcePath}.md`) when exists, else null
  H_sidecar_disk   = computeFullHash(TextEncoder.encode(diskSidecarBytes)) when present

Phase A — conflicts[] collection (모든 분기 합산):
  conflicts = []
  R = R_byPath ?? R_byHash ?? null

  # ★ codex v9 P1-A 정정 (v10): R.hash != H_now 가드 제거 — hash-match 케이스에서도 sidecar 수정 conflict 수집.
  #     사유: forceReingest 가 hash-match + sidecar-edit 시 conflicts 비어 force 진행 → canonical 덮어씀 위험.
  if R != null and R.sidecar_hash != null and diskSidecarBytes != null
       and H_sidecar_disk != R.sidecar_hash:
    conflicts.push('sidecar-user-edit')                  # 시나리오 A/F (raw hash 변경 여부 무관)

  if R != null and R.hash != H_now:
    for page in R.ingested_pages:
      if (await wikiFS.exists(page)) and extractUserMarkers(await wikiFS.read(page)) != '':
        conflicts.push('source-page-user-edit')          # 시나리오 D
        break

  if R_byHash != null and R_byPath == null:
    conflicts.push('duplicate-hash')                     # 시나리오 E

  if R != null and R.hash != H_now and diskSidecarBytes != null
       and R.sidecar_hash == null:
    conflicts.push('legacy-no-sidecar-hash')             # P1-3 보수적 protect 사유 명시

Phase B — action 결정:
  if R == null:
    → action='force', reason='new-source', conflicts=[]

  # ── ★ codex v2 P1 정정 (2026-04-25 v3): duplicate-hash 분기를 hash-match 앞으로 ──
  #     사유: 기존 plan 은 R = R_byPath ?? R_byHash 로 R 이 R_byHash 가 됐을 때
  #     `R.hash == H_now` 가 먼저 매치되어 duplicate-hash 분기 unreachable.
  elif R_byHash != null and R_byPath == null:
    # ── 같은 hash 가 다른 path 에서 등록됨 (시나리오 E) ──
    → action='skip', reason='duplicate-hash-other-path', conflicts=['duplicate-hash']
      duplicateOfId = R_byHash.id                # ★ codex v6 P1 정정 (v7): decision.duplicateOfId 명시 노출
      duplicatePathToAppend = sourcePath           # caller 가 appendDuplicateLocation(reg, decision.duplicateOfId, decision.duplicatePathToAppend) 호출 (P1-6)
      ※ canonical R_byHash.vault_path 보존, 신규 path 는 **duplicate_locations** append (path_history 아님).

  elif R.hash == H_now:
    # ── hash-match 정상 skip ──
    if R.sidecar_hash == null and diskSidecarBytes != null:
      → action='skip-with-seed', reason='hash-match-sidecar-seed' (P1-3 경량 경로)
        ※ ingest-pipeline 이 LLM·page write 없이 registry 만 갱신
          (sidecar_hash = H_sidecar_disk, last_action='skip-with-seed').
        canonical sidecar `.md` 는 disk 그대로 — 사용자 직접 수정이었어도 그것이 새 baseline.
    elif R.sidecar_hash != null and diskSidecarBytes != null
         and H_sidecar_disk != R.sidecar_hash:
      → action='skip', reason='hash-match-sidecar-edit-noted'
        (사용자 sidecar 수정 보존, 재인제스트 의미 없음. audit UI 표시만)
    else:
      → action='skip', reason='hash-match'

  elif R.hash != H_now:
    # ── 원본 변경, 재인제스트 필요 ──
    if conflicts.length == 0:
      → action='force', reason='hash-changed-clean', preservedSourceId=R.id  # P1 v3: id 보존
    elif onConflict provided:
      → action='prompt', reason='hash-changed-with-conflicts', conflicts (전체), preservedSourceId=R.id
    else:
      → action='protect', reason='hash-changed-with-conflicts', conflicts (전체), preservedSourceId=R.id

  else:
    → action='force' (방어적 default)
```

**핵심 변화**:
- conflicts 가 동시 발생 (예: A/F + D) 해도 두 항목 모두 conflicts[] 에 들어감 → ingest-pipeline 의 각 hook 이 자기 항목을 보고 보호 동작 적용 (P1-4).
- legacy record (sidecar_hash 없음) 는 첫 hash-match 시점에 LLM 호출 0 으로 sidecar_hash 만 채움 → 두 번째부터 정상 skip (P1-3).
- duplicate-hash 의 **duplicate_locations** append 는 P1-6 + v4 에 명문화 (path_history 아님).

### 결정 5 — 시나리오 ↔ 결정 트리 매핑 (★ codex P1-5/P1-6 정정 반영)

> **P1-5 정정 (2026-04-25)**: 본 plan 의 wiki page 보호 (시나리오 D) 는 **`wiki/sources/source-*.md` 한정 (narrowing)** 으로 결정. todo §5.3.2 acceptance 도 동일하게 narrowing 필요 (master 가 todo §5.3.2 acceptance 라인 240-241 + 245 에서 "wiki page 사용자 메모" 표현을 "source page 사용자 메모" 로 narrowing 하고 entity/concept 보호는 후속 follow-up 으로 등재). 사유: entity/concept 페이지는 LLM 결정적 출력이라 `## 사용자 메모` H2 가 LLM 본문에 들어갈 가능성·충돌 케이스 별도 분석 필요. 후속 (#7) 에 등재.
> **P1-6 정정 (2026-04-25 v3)** + **★ codex v3 P1 정정 (v4)**: 시나리오 E 에서 duplicate path append 는 **필수** (옵션 아님). 단 v4 에서 저장 위치 정정 — `path_history` 가 아니라 신규 `duplicate_locations: string[]` 필드. 사유: 현 `findByPath` 가 path_history 를 identity lookup 으로 사용 + `reconcile` Map<hash, vault_path> 가 historical move 로만 동작. duplicate 를 path_history 에 넣으면 canonical flip 위험. caller 가 `decision.duplicatePathToAppend` truthy → `appendDuplicateLocation(reg, R_byHash.id, sourcePath)` (canonical vault_path 보존, duplicate_locations 만 누적).

| # | 시나리오 (todo §5.3.2) | decideReingest action | 보호 동작 |
|---|----------|------|----------|
| A | sidecar 사용자 수정 후 ingest | `protect` (또는 `prompt`) | sidecar 새 본문은 `<source>.md.new` 로 저장 (canonical `.md` 미변경, P1-2). registry `pending_protections` append. 사용자에게 diff 안내 Notice + log |
| B | inbox 의 같은 이름 sidecar 와 destination 충돌 | (out-of-scope for decideReingest) | classify.ts movePair `sidecarSkipReason='dest-conflict'` 분기에 **opt-in rename** (`onSidecarConflict='rename'`) — sidecar 목적지를 **원본 이동 전 pre-resolve** 후 `.<n>` 자동 증가 (P1-7), `recordMove` 가 새 sidecar path 인자로 atomically 갱신 |
| C | sidecar 만 남고 원본 PDF 삭제 | (decideReingest 진입 자체 안 함 — 원본 없음) | audit-ingest.py 가 .md standalone + paired sibling 부재 + ingest-map miss 시 `orphan_sidecars` 마킹 (현재 5.2.0 v3 의 broken state badge 가 부분 cover). §5.3.1 범위에서는 audit JSON 에 컬럼 추가 |
| D | registry 기록 + `wiki/sources/source-X.md` 남음 (사용자 메모 추가) — **★ source page 한정** | `protect` (raw bytes hash 동일이면 'skip' 인데 sidecar 보호만 필요 — D 는 정의상 hash 변경 케이스, P1-4 conflicts collection 이 처리) | source page createPage 호출 직전 `markers = extractUserMarkers(existing)` → `mergeUserMarkers(newContent, markers)`. **entity/concept page 는 미적용** (사유: LLM 결정적 출력 - 후속 follow-up 으로 등재) |
| E | 같은 hash PDF 두 위치 (사용자 복사) | `skip` (reason='duplicate-hash-other-path', conflicts=['duplicate-hash']) | **★ P1-6 + v4**: caller 가 `decision.duplicatePathToAppend` 보고 **`appendDuplicateLocation(reg, R_byHash.id, sourcePath)`** 호출 — `R_byHash.duplicate_locations` 필드에 append (path_history 아님 — canonical flip 회피). canonical vault_path 보존. UI 노출 + audit `duplicate_hash` 컬럼 |
| F | sidecar hash 변경, 원본 PDF 그대로 | A 와 동일 (raw bytes hash 동일이지만 sidecar disk hash != registry sidecar_hash → conflicts=['sidecar-user-edit']. 단 raw hash 일치 시 action='skip' + reason='hash-match-sidecar-edit-noted' 로 skip — 재인제스트 의미 없음) | sidecar 보존 (skip), audit UI 표시. raw bytes 도 변경된 동시 케이스는 A 와 같이 protect |
| G | paired 에서 PDF 만 삭제, .md 남음 | (decideReingest 진입 시 `.md` 가 source 로 호출되면 그대로 ingest) | 정상 — todo §5.3.2 G 는 "정상". 별도 처리 없음 |
| H | paired 에서 .md 만 삭제, PDF 남음 | `force` (sidecar 가 없으니 새로 생성) | 정상 — sidecar 새로 만듦. canonical write 후 sidecar_hash 갱신 (P1-2 단일 규칙) |

### 결정 6 — Registry 스키마 확장

`SourceRecord` 에 신규 필드 (모두 optional, backwards compat):

```ts
export interface SourceRecord {
  // ── 기존 ──
  readonly vault_path: string
  readonly sidecar_vault_path?: string
  readonly hash: string
  readonly size: number
  readonly first_seen: string
  readonly ingested_pages: readonly string[]
  readonly path_history: readonly PathHistoryEntry[]
  readonly tombstone: boolean

  // ── §5.3.1/§5.3.2 신규 (optional) ──
  readonly sidecar_hash?: string                 // sha256 of canonical sidecar `.md` body at last ingest
  readonly reingested_at?: readonly string[]     // ISO timestamps of subsequent ingests (first_seen 이후)
  readonly last_action?: ReingestAction          // diagnostic: 직전 결정 결과
  // ★ codex v3 P1 정정 (v4): duplicate locations 를 path_history 와 분리.
  //   path_history = historical move 만 (현 findByPath / reconcile 의 identity lookup 의미 유지).
  //   duplicate_locations = 같은 hash 사용자 복사본 — canonical vault_path 와 별개 path 들.
  readonly duplicate_locations?: readonly string[]  // 시나리오 E 누적 (canonical 제외)
  // ★ P1-2 정정: protect 모드에서 `<base>.md.new` 저장 시 canonical `.md` 는 안 바뀌므로
  //   sidecar_hash 갱신 금지. 대신 pending artifact 를 별도 추적 → audit/UI/cleanup 가 처리.
  readonly pending_protections?: readonly PendingProtection[]
}

export interface PendingProtection {
  // ★ codex v2 P2 정정: 'source-page-marker-merged' 는 이미 해소된 history (canonical 본문에 merge 됨) 이라
  //   "pending" 의미와 충돌. 'sidecar-md-new' 만 pending — 사용자가 `.md.new` 를 검토하여
  //   canonical 로 promote 또는 삭제할 때까지 대기하는 항목. source-page merge 이력은 audit/log 만.
  readonly kind: 'sidecar-md-new'
  readonly path: string                          // 예: 'raw/x.pdf.md.new'
  readonly created_at: string                    // ISO 8601
  readonly conflict: ConflictKind                // 'sidecar-user-edit' / 'legacy-no-sidecar-hash'
}
```

**★ P1-2 sidecar_hash 갱신 단일 규칙 (drift 방지)**:
- **canonical `<sourcePath>.md` 가 실제로 (re)write 된 직후에만** `sidecar_hash = computeSidecarHash(canonical)` 로 갱신.
- protect 분기 (`<base>.md.new` 로 저장) 에서는 `sidecar_hash` **미갱신** + `pending_protections` 에 항목 append.
- skip-with-seed (P1-3) 에서는 canonical `.md` 가 변경된 적 없지만 disk = 새 baseline 이라는 **사용자 의도 명시 동작** 이므로 sidecar_hash = `H_sidecar_disk` 로 갱신 (예외 단일).
- recordMove 는 path 만 바꾸고 sidecar_hash 보존 (값 동일).

기존 record 는 이 필드 없이 load 됨 — `decideReingest` 가 raw bytes hash 일치 + sidecar_hash 없음 + disk sidecar 존재 시 P1-3 의 `skip-with-seed` 경로로 채움. raw bytes hash 가 다르면 보수적으로 `legacy-no-sidecar-hash` conflict 와 함께 protect 분기 (sidecar 가 disk 에 있는 경우).

### 결정 7 — UX 플래그 vs 자동 모드

| 모드 | 트리거 | 동작 |
|------|------|------|
| **auto-skip** (default) | hash 동일 + sidecar_hash 일치 → skip | 비용 0, log 만 남김 |
| **auto-skip-with-seed** (★ P1-3) | hash 동일 + registry.sidecar_hash 미존재 + disk sidecar 존재 | LLM·page write 0. registry 의 sidecar_hash 만 = `H_sidecar_disk` 로 갱신, last_action='skip-with-seed' 기록. 두 번째 ingest 부터 auto-skip 분기. 비용은 sidecar bytes read + sha256 (수십 ms) |
| **auto-protect** (default) | conflict 감지 + onConflict 미제공 | sidecar 새 본문은 `<base>.md.new` 저장 (canonical `.md` 미변경, P1-2), wiki page 는 user-marker merge. 사용자 인지는 log/Notice |
| **prompt** (Obsidian plugin / P2-3) | conflict 감지 + onConflict 제공 | UI modal 에서 overwrite/preserve/cancel 선택. **default modal: plugin 이 ConflictModal 신규 component 제공** — onConflict 미제공 시는 protect 자동 fallback (silent 손실 위험 명시) |
| **force** (CLI 신규 플래그 / IngestOptions.forceReingest) | `wikey ingest --force` 또는 plugin "강제 재인제스트" 토글 | decideReingest 결과 skip/skip-with-seed → caller 가 force action 으로 override. 단 conflicts!=[] 면 여전히 protect/prompt 분기 (force 가 보호 무력화 안 함) |

CLI 인자 변경 없음. 플래그 신규: `--force` (skip/skip-with-seed 무시) / `--diff-only` (dry-run, 결정만 출력 후 종료). plugin 은 `IngestOptions` 에 `forceReingest?: boolean` + `onConflict?: ...` 추가.

### 결정 8 — 결합점 명세 (★ P1-1/P1-3/P1-5 반영)

`decideReingest()` 가 §5.3.1 (skip 결정) 과 §5.3.2 (보호 결정) 의 **단일 함수**. 호출 결과 `ReingestDecision` 이 ingest-pipeline.ts 의 분기 지점에 입력:

1. **★ Step 0 (신규, line 138 이전)** — raw disk bytes 읽기. basePath + sourcePath 로 `fs.readFileSync` (basePath 폴백 = wikiFS.read → TextEncoder.encode, buildV3SourceMeta:1846 mirror).
2. **★ Step 0.5 (신규)** — `const decision = await decideReingest({ sourcePath, sourceBytes: rawDiskBytes, wikiFS, basePath, onConflict })`. **★ codex v2 P2 정정**: `forceReingest` 는 helper 시그니처에 **포함 안 함** — caller-only override (ingest-pipeline.ts 가 decision 반환 후 `opts.forceReingest && (decision.action === 'skip' || decision.action === 'skip-with-seed')` 분기에서 force 로 변환). helper 는 결정만, override 는 caller 책임.
3. **Step 0.6 분기**:
   - `decision.action === 'skip'` (force override 안 됨) → duplicate-hash 한정으로 registry.**duplicate_locations** append (P1-6 + v4) → SkippedIngestResult return.
   - `decision.action === 'skip-with-seed'` → **★ P1-3 경량 경로**: LLM·page write·reindex 스킵, sidecar bytes 만 read → `sidecar_hash = computeFullHash(TextEncoder.encode(sidecarBytes))`, `last_action='skip-with-seed'` 으로 registry 갱신, IngestResult.skipped=true return.
   - `decision.action === 'force'` → 기존 흐름.
   - `decision.action === 'protect'` → 기존 흐름이되 hook 2/3 적용.
   - `decision.action === 'prompt'` → `await opts.onConflict?.(...)` → 'overwrite'='force' / 'preserve'='protect' / 'cancel'=throw `IngestCancelledByUserError`.
4. **Hook 1 (sidecar write 분기, line 226-233 부근)** — ★ codex v2 P1 정정 (legacy 도 cover):
   - `conflicts.includes('sidecar-user-edit') || conflicts.includes('legacy-no-sidecar-hash')` → write target = `await protectSidecarTargetPath(sourcePath, wikiFS)` (= `<sourcePath>.md.new[.1~.9]`, ★ v4 wikiFS 인자). canonical `<sourcePath>.md` 는 **건드리지 않음** (P1-2). registry 갱신 시 sidecar_hash 미갱신 + `pending_protections` append.
   - 그 외 → 기존 path. canonical write 후 `sidecar_hash = computeSidecarHash(canonical)` 갱신.
5. **Hook 2 (source page createPage 직전, line 417 부근)** — **★ P1-5: source page 한정**:
   - `conflicts.includes('source-page-user-edit')` → `existing = await wikiFS.read(`wiki/sources/${sourcePage.filename}`).catch(()=>'')` → `markers = extractUserMarkers(existing)` → `sourcePage.content = mergeUserMarkers(sourcePage.content, markers)` → createPage.
   - entity/concept (line 447, 455) 은 본 plan 에서 hook 적용 **안 함** (후속 follow-up #4).
6. **Hook 3 (registry upsert 직후)** — `last_action: decision.action` + `reingested_at: [...prev, today]` (force/protect 분기에서만, skip 분기는 Step 0.6 에서 별도 처리).

세 hook 모두 ingest-pipeline.ts 내부의 작은 conditional 만 추가 (총 4-5 곳). 핵심 로직은 incremental-reingest.ts 에.

### 결정 9 — Audit 확장 (§5.3.1 의존, ★ codex P1-8 정정 + v3 P1 schema additive)

`scripts/audit-ingest.py` JSON 출력에 컬럼 추가. **★ codex v2 P1 정정 (v3): 기존 키 (`total_documents` count + `ingested` count + `ingested_files` array + `files` + `unsupported_files`) 보존, 5 신규 array 만 추가 — additive only**:

```json
{
  // ── 기존 키 (audit-ingest.py 현재 출력, 변경 금지) ──
  "total_documents": 42,
  "ingested": 30,                          // count (number)
  "missing": 10,                           // count (number)
  "unsupported": 2,                        // count (number)
  "ingested_files": [...],                 // ingested 파일 paths
  "files": [...],                          // missing 파일 paths
  "unsupported_files": [...],              // unsupported 파일 paths
  // ── ★ §5.3.1 신규 array (additive — dashboard/audit panel 가정 미파괴) ──
  "orphan_sidecars": [...],                // 시나리오 C — sidecar 만 있고 원본 없음 + ingest-map miss
  "source_modified_since_ingest": [...],   // ★ P1-8: raw bytes hash diff (registry.hash != disk hash)
  "sidecar_modified_since_ingest": [...],  // ★ P1-8: sidecar `.md` body hash diff (registry.sidecar_hash != disk sidecar hash)
  "duplicate_hash": [{"hash": "...", "paths": [...]}],  // 시나리오 E — 같은 hash 다른 path
  "pending_protections": [{"kind": "sidecar-md-new", "path": "raw/x.pdf.md.new", "created_at": "...", "conflict": "..."}]
                                           // ★ P2-1: registry.pending_protections snapshot (cleanup 추적)
}
```

**★ P1-8 분리 사유**: 이전 plan 의 `modified_since_ingest` 라는 단일 컬럼명이 "sidecar 수정 (A/F)" 의도였으나 실제 검출은 raw hash diff. 두 신호가 별개 source-of-truth (registry.hash vs registry.sidecar_hash) 이므로 컬럼도 분리. fixture/JSON/UI 모두 두 컬럼 명시.

`audit-ingest.py` 가 `.wikey/source-registry.json` 도 읽어 hash 비교. Python sha256 = TS sha256 동등 (NFC 정규화 가정 — P2-7). dashboard / audit panel 이 신규 컬럼 시각화 — 단 UI 작업은 본 §5.3.1 범위 밖 (§5.3 후속 또는 별도 follow-up). **본 plan 의 audit-ingest.py 변경은 JSON 컬럼 추가까지만**, UI 표시는 plan §5.3 종결 후 별도 follow-up.

**★ codex v3 P2 정정 (v4 명시 — UI helper 호환)**: `recountAuditAfterPairedExclude` (§5.2.0 v4 helper, sidebar-chat.ts:713) 가 기존 키 (`ingested_files / files / unsupported_files`) 를 입력으로 받음. plan v4 의 5 신규 array 추가는 **additive** 이므로 helper 호환 유지 — UI 는 기존 3 키 계속 입력. 5 신규 array 는 dashboard/audit panel 별도 표시 (§5.3 후속 follow-up #2).

### 결정 10 — source_id Identity Policy (★ codex v2 P1 정정 — v3 신설)

> **★ codex v2 P1 정정 (2026-04-25 v3)**: 현 코드 `source_id = computeFileId(rawBytes)` (content-addressed). raw bytes 변경 시 새 id → wikilink/provenance 깨짐. v3 정책 명시 필요.

**채택: stable per path** (옵션 A — wikilink/provenance 영향 0)

- `source_id` 는 **첫 ingest 시점의 raw bytes 기준** 으로 고정. 이후 raw bytes 변경되어도 id 보존.
- registry record 갱신: `record.hash` 만 새 raw hash 로 교체. `record.id` 는 보존 (또는 record key 기준).
- wiki/sources/<filename>.md 파일명 보존. 본문은 새로 생성되지만 id 안정성 유지.
- 기존 wikilink (`[[entity-foo]]` → `wiki/entities/foo.md` 의 source 참조) 재작성 불필요.
- provenance entry 의 `source_id` 도 보존 — entity/concept page 가 가진 source 참조가 stale 안 됨.

**id 결정 시점**:
- 첫 ingest (R == null 분기): `source_id = computeFileId(rawDiskBytes)` — 기존 동작 그대로 (content-addressed).
- 재인제스트 (R != null force/protect/prompt 분기): `decision.preservedSourceId = R.id`. ingest-pipeline.ts 가 `source_id = decision.preservedSourceId ?? computeFileId(bytes)` 사용.

**이행 (legacy record)**:
- 기존 record 는 이미 `id = computeFileId(첫 ingest bytes)`. raw bytes 가 그 후 변경됐어도 id 보존 (force 분기 진입 시 R.id 그대로 사용). migration 별도 불필요.

**거부된 옵션 B (id migration)**:
- raw 변경 시 새 id 생성 + old → new 매핑 + wiki/sources rename + 모든 provenance 재작성.
- 복잡도 ↑↑↑. wikilink rename + audit panel + 검색 인덱스 모두 영향. 채택 안 함.

**구현 위치**: `incremental-reingest.ts` 의 `ReingestDecision` 에 `preservedSourceId?: string` 필드 추가 (R != null 분기에서 set, R == null 분기에서 undefined). ingest-pipeline.ts 가 force/protect 분기에서 `const sourceId = decision.preservedSourceId ?? computeFileId(rawBytes)` 사용. Step 3 test case (#11 신규) 추가.

---

## 구현 단계

각 단계 RED → GREEN → REFACTOR. 단위/통합 분리. coverage 80%+ (auth 영역 아니므로 100% 강제 아님).

### Step 1 — Registry 스키마 확장 (`sidecar_hash` / `reingested_at` / `last_action` / `pending_protections` 4 필드 + helper 추가)

> ★ codex P1-2/P1-7 정정 반영. helper 추가: `appendPendingProtection / clearPendingProtection / appendDuplicateLocation / recordMoveWithSidecar`.

**파일**:
- `wikey-core/src/source-registry.ts` (수정 — interface 4 필드 추가, helper 4 신규)
- `wikey-core/src/__tests__/source-registry.test.ts` (수정 — 신규 필드 + helper 테스트 추가)

**Test Spec (RED)** — 7 신규 case:

1. **Happy: upsert with all new fields** — `upsert` 가 `sidecar_hash / reingested_at / last_action / pending_protections` 포함 record 저장 → `findById` 가 그대로 반환
2. **Edge: legacy record load** — 기존 record (신규 필드 없음) 로드 → 정상, 4 필드 모두 undefined
3. **Error: 손상된 JSON** → loadRegistry 가 .bak 만들고 빈 객체 반환 (기존 동작 유지)
4. **★ P1-2: appendPendingProtection** — `appendPendingProtection(reg, id, {kind:'sidecar-md-new', path:'raw/x.pdf.md.new', conflict:'sidecar-user-edit'})` → 해당 record.pending_protections 에 entry 추가, 다른 필드 불변
5. **★ P1-2: clearPendingProtection** — `clearPendingProtection(reg, id, 'raw/x.pdf.md.new')` → 해당 path 의 entry 만 제거 (P2-1 cleanup 경로)
6. **★ P1-6 + v4: appendDuplicateLocation** — `appendDuplicateLocation(reg, id, 'raw/copy/x.pdf')` → R_byHash.**duplicate_locations** 필드에 append (★ v4: path_history 아님 — findByPath 의 identity lookup 의미 보존). canonical vault_path 변경 X. 같은 path 중복 append 방지 (멱등). reconcile 은 duplicate_locations 무시 (canonical 만 처리)
7. **★ P1-7 + ★ codex v3 P2 정정 (v4): recordMoveWithSidecar** — discriminated option 시그니처: `recordMoveWithSidecar(reg, id, newOriginalPath, sidecar: { kind: 'preserve' } | { kind: 'clear' } | { kind: 'set', path: string })`. preserve = existing 보존 / clear = null 설정 / set = 신규 path. accidental undefined/null misuse 회피. atomic 갱신 보장.

**Implementation (GREEN)**:
- `SourceRecord` interface 에 4 optional 필드 추가 (`PendingProtection` interface 도 export)
- 기존 helper (`upsert / findById / recordMove / recordDelete / restoreTombstone`) 자체는 변경 없음. ★ codex v7 P1 정정 (v8): **`upsert(reg, id, record)` 는 record 전체 교체 (`{ ...reg, [id]: record }`) — record 내부 필드는 caller 가 책임**. 따라서 신규 필드 (sidecar_hash / pending_protections / duplicate_locations / preservedSourceId 등) 추가 시 caller 가 `existing = findById(reg, id)` 후 `{ ...existing, ...newFields }` 로 명시 merge 후 upsert. spread 자동 보존은 reg 레벨 (id key) 만 적용 — record 내부 필드는 자동 아님.
- **★ codex v4 P1 정정 (v5): `reconcile()` 은 duplicate-aware 로 명시적 변경 필수** (현 source-registry.ts:149 가 `Map<hash, vault_path>` 라 같은 hash 다중 path 시 walker 순서 따라 canonical flip 위험):
  - `Map<hash, paths[]>` 로 확장 — 같은 hash 의 모든 disk path 수집
  - canonical 결정 우선순위: (1) `record.vault_path` 가 paths 배열에 있으면 그것 유지 (move 아님), (2) `record.duplicate_locations` 에 등록된 path 는 canonical 후보에서 제외, (3) 위 둘 다 해당 안 되는 paths 만 move 로 처리 → `recordMove()` 호출
  - 신규 test case: (a) canonical + duplicate 공존 → canonical 보존 + duplicate_locations 안정, (b) walker 순서 reverse 시에도 canonical 보존, (c) canonical 미존재 + duplicate 존재 → duplicate 가 새 canonical 으로 promote (단 duplicate_locations 에서 제거), (d) 진짜 move (duplicate 미등록) → 정상 recordMove
  - Step 1 의 신규 helper 4개에 `reconcileDuplicateAware` (또는 기존 `reconcile` 시그니처 유지하되 본문 정정) 추가
- 신규 helper 4: 모두 immutable spread (rules.md §2 Immutability)
- **★ P1-2 sidecar_hash 갱신 단일 규칙 docstring 명시**: source-registry.ts 헤더 주석에 "sidecar_hash 는 canonical sidecar `.md` write 직후에만 갱신, `.md.new` write 시 미갱신" 한 줄 추가. 코드 자체는 helper 사용자 책임 (registry 는 데이터 구조만).

**Acceptance (실행 증거)**:
- RED: `npm test -- source-registry` → 7 신규 case FAIL (interface 필드/helper 부재)
- GREEN: `npm test -- source-registry` → 기존 N + 7 / N+7 passed, exit 0
- Coverage: source-registry.ts 기존 100% → 신규 helper 통과 후 유지 (≥ 95%)

**Dependencies**: None
**Risk**: Low (additive only — interface 확장 + helper 신규, 기존 동작 변경 없음)

---

### Step 2 — `incremental-reingest.ts` helper 신규 + 단위 테스트 (★ P1-1/P1-3/P1-4/P2-5/P2-6/P2-7 반영)

**파일**:
- `wikey-core/src/incremental-reingest.ts` (신규, ~250 lines — 신규 분기로 약간 증가)
- `wikey-core/src/__tests__/incremental-reingest.test.ts` (신규)

**Test Spec (RED)** — 결정 트리 분기 + user marker 헬퍼 (총 18 case, 신규 4 + 보강):

1. **decideReingest — new source (R==null)** → action='force', reason='new-source', conflicts=[]
2. **decideReingest — hash match clean** → action='skip', reason='hash-match', conflicts=[]
3. **decideReingest — force, clean change (raw bytes 다름, conflicts=[])** → action='force', reason='hash-changed-clean'
4. **decideReingest — protect sidecar user edit (A/F)**: raw bytes 다름 + disk sidecar hash != registry.sidecar_hash → action='protect', conflicts=['sidecar-user-edit']
5. **decideReingest — protect source page user edit (D)**: raw bytes 다름 + ingested_pages 의 source page 에 `## 사용자 메모` 존재 → action='protect', conflicts=['source-page-user-edit']
6. **decideReingest — skip duplicate (E)**: R_byHash != R_byPath → action='skip', reason='duplicate-hash-other-path', conflicts=['duplicate-hash'], `duplicatePathToAppend` truthy
7. **decideReingest — prompt branch**: case 4 + onConflict 제공 → action='prompt', conflicts=['sidecar-user-edit']
8. **★ P1-1: helper 가 raw bytes 만 받음 — 변환된 텍스트 입력하면 hash mismatch**: 같은 raw bytes 두 번 호출 → 두 번째는 'hash-match'. 변환된 텍스트 호출 시뮬레이션 → 'force' (helper 책임 아님 — caller 가 raw 보장). 시그니처상 invariant 명문화 + docstring assertion.
9. **★ P1-3: skip-with-seed (legacy)** — registry hash == raw hash, registry.sidecar_hash == undefined, disk sidecar 존재 → action='skip-with-seed', reason='hash-match-sidecar-seed', diskSidecarHash 채워짐
10. **★ P1-3: skip-with-seed disk sidecar 부재** — registry hash == raw hash, registry.sidecar_hash == undefined, disk sidecar 없음 → action='skip', reason='hash-match' (seed 할 게 없음)
11. **★ P1-4: 동시 conflicts (A/F + D)** — raw bytes 다름 + sidecar 사용자 수정 + source page 에 `## 사용자 메모` → action='protect', conflicts 에 ['sidecar-user-edit', 'source-page-user-edit'] **둘 다** 포함 (sequential return 금지 검증)
12. **★ P1-3: legacy with raw hash mismatch** — registry hash != raw hash, registry.sidecar_hash == undefined, disk sidecar 존재 → action='protect', conflicts=['legacy-no-sidecar-hash'] (보수적)
13. **decideReingest — hash match + sidecar edit noted (F sub-case)**: raw bytes 동일, disk sidecar hash != registry.sidecar_hash → action='skip', reason='hash-match-sidecar-edit-noted'
14. **★ P2-7: NFC 정규화 — extractUserMarkers 가 NFC composed `한글` 과 NFD decomposed 동일 처리**: decomposed `## 사용자 메모` 입력 → NFC 정규화 후 marker match 확증
15. **extractUserMarkers happy**: `## 사용자 메모\n내용\n## 다른 H2\n...` → `## 사용자 메모\n내용` 만 반환
16. **extractUserMarkers edge — no marker**: marker 없음 → 빈 문자열
17. **★ P2-6: extractUserMarkers ^## multiline regex**: `## 사용자 메모` 가 본문 line 시작이 아닌 코드블록 안 (e.g. 4-space indented or fenced) → 매칭 안 함 (정규식 `^## ` multiline flag, 코드블록 인지 없이도 false positive 최소화 — 우선 line-start 만 보장)
18. **★ P2-5: mergeUserMarkers 멱등성** — 같은 markers 두 번 merge → 첫 호출 결과와 두 번째 호출 결과 동일 (이미 같은 헤더 + 본문 존재 시 skip)
19. **mergeUserMarkers happy**: newContent 끝에 markers append (구분자 `\n\n`)
20. **mergeUserMarkers edge**: markers 빈 문자열 → newContent 그대로
21. **protectSidecarTargetPath**: `await protectSidecarTargetPath('raw/x.pdf', wikiFS)` → `raw/x.pdf.md.new` (충돌 없을 때) / `raw/x.pdf.md.new.1` (`.md.new` 이미 존재) / throw `IngestProtectionPathExhaustedError` (`.1~.9` 모두 충돌)
22. **computeSidecarHash happy**: disk 에 sidecar 있을 때 hash 반환 (NFC 정규화 후 sha256)
23. **computeSidecarHash not-found**: disk 에 sidecar 없을 때 null

**Implementation (GREEN)**:
- 결정 트리 1:1 구현. **conflicts 먼저 collect 후 action 결정** 패턴 (P1-4)
- `decideReingest` docstring 에 "**sourceBytes 인자는 raw disk bytes** — 변환된 텍스트 전달 금지" 명시 (P1-1 invariant)
- `extractUserMarkers`: `^## (?:사용자 메모|User Notes|메모)\s*$` multiline regex. NFC 정규화 후 매칭 (P2-7). 다음 `^## ` 또는 EOF 까지 본문 추출
- `mergeUserMarkers`: 멱등 — newContent 에 `## 사용자 메모` (정확한 헤더 라인) 가 이미 있으면 skip (P2-5). 없으면 `\n\n${markers}\n` append
- `computeSidecarHash`: `wikiFS.exists` 후 `wikiFS.read` → `content.normalize('NFC')` (P2-7) → `TextEncoder().encode(...)` → `computeFullHash`
- `protectSidecarTargetPath(sourcePath, wikiFS)` — ★ codex v2 P2 정정 (v3): default `<sourcePath>.md.new`, 이미 존재 시 `<sourcePath>.md.new.1`, `.2`, ... 첫 미존재 path 반환. 한도 `.9` 도달 시 throw `IngestProtectionPathExhaustedError` (caller 가 사용자 alert). 자동 증가는 P2-1 후속 cleanup 과 별개 — 즉시 수행. wikiFS 인자가 추가됨 (충돌 검사용).

**Acceptance (실행 증거)**:
- RED: `npm test -- incremental-reingest` → 23 cases FAIL (모듈 부재) — vitest 출력 캡처
- GREEN: `npm test -- incremental-reingest` → 23/23 passed, exit 0 — vitest 출력 캡처
- Coverage: incremental-reingest.ts ≥ 95% (vitest --coverage 실행 결과 캡처)

**Dependencies**: Step 1
**Risk**: Medium (결정 트리 분기 다수, 시나리오 매핑 정확성이 §5.3.2 의 핵심)

---

### Step 3 — `ingest-pipeline.ts` 진입점 통합 (3 분기 hook)

**파일**:
- `wikey-core/src/ingest-pipeline.ts` (수정 — Step 1.5 hook 1곳, sidecar write 분기 1곳, createPage 분기 3곳)
- `wikey-core/src/__tests__/ingest-pipeline.test.ts` (수정 — skip/protect/force 분기 통합 테스트 추가)

**Test Spec (RED)** — integration 11 case (★ v3 source_id #11 추가):

1. **첫 ingest (force=new-source)**: registry 빈 상태에서 ingest → 기존 동작 그대로 + canonical sidecar `.md` write 후 registry 에 sidecar_hash 기록됨, last_action='force'
2. **두 번째 ingest, 컨텐츠 동일 (skip)**: 같은 source 다시 ingest → LLM 호출 0회 (mock spy assertion), wiki page 미변경, IngestResult.skipped=true return
3. **★ P1-3: 두 번째 ingest, legacy record (sidecar_hash 미존재) — skip-with-seed**: registry hash == raw hash, registry.sidecar_hash undefined, disk sidecar 존재 → LLM·page write·reindex 0, registry.sidecar_hash 갱신 + last_action='skip-with-seed'. 세 번째 ingest 는 skip 분기 (seed 후 정상)
4. **두 번째 ingest, 컨텐츠 변경 (force=clean)**: raw bytes 수정 → 정상 재인제스트, canonical sidecar/source page overwrite, registry hash + reingested_at + sidecar_hash 갱신
5. **★ P1-2: protect 분기 sidecar `.md.new` 저장 (시나리오 A/F)**: sidecar `.md` 를 disk 에서 수정 + raw bytes 도 변경 후 ingest → 새 sidecar 본문은 `<source>.md.new` 로 저장, **canonical `<source>.md` 는 disk 그대로 보존**, registry.sidecar_hash **미갱신**, registry.pending_protections 에 entry append, log `sidecar-user-edit` 표시
6. **사용자가 source page 메모 추가 (protect, 시나리오 D — ★ P1-5 source page 한정)**: wiki/sources/source-X.md 에 `## 사용자 메모\n중요!` 추가 후 raw bytes 변경 후 ingest → 새 source page 본문 끝에 `## 사용자 메모\n중요!` 보존
7. **★ P1-5: entity/concept page 는 미보호 (negative test)**: wiki/entities/foo.md 에 `## 사용자 메모` 추가 후 raw bytes 변경 후 ingest → entity page 새 본문이 marker **없이** 그대로 덮어써짐 (현 plan 의 의도된 narrowing 명시 검증). 후속 follow-up 으로 entity 보호 도입 시 이 test 는 양성으로 전환
8. **★ P1-4: 동시 conflicts (A/F + D)** — sidecar 수정 + source page marker + raw bytes 변경 → action='protect', sidecar `.md.new` 저장 + source page user marker merge **둘 다** 적용
9. **★ P1-6 + v4: duplicate-hash 시나리오 E** — registry 에 raw/x.pdf 등록된 상태에서 raw/copy/x.pdf 로 같은 bytes ingest 호출 → action='skip', LLM 0회, registry.**duplicate_locations** 에 신규 path append (★ v4: path_history 아님). canonical vault_path 보존. SkippedIngestResult.duplicateOfId 노출. findByPath('raw/copy/x.pdf') == undefined (duplicate 는 identity lookup 안 됨 확증)
10. **회귀: 기존 ingest-pipeline.test.ts 전체 PASS** — skip/protect 분기는 첫 ingest 흐름 (R==null) 에 영향 없음 확증
11. **★ v3 source_id stable per path**: 첫 ingest → record.id = X / raw bytes 변경 후 force 재인제스트 → record.id 동일 X 보존 (computeFileId(new_bytes) 와 다름) + record.hash 만 새 hash. 재인제스트 후 wiki/sources/<filename>.md 본문이 X 를 source_id frontmatter 로 유지 (provenance preservation)

**Implementation (GREEN)**:
- **★ Step 0 (신규, line 138 이전)**: raw disk bytes 읽기 (basePath 우선, 없으면 wikiFS.read → TextEncoder.encode). **★ codex v2 P2 정정 (v4 명시 + v5 시그니처 정확화)**: 본 rawDiskBytes 변수는 buildV3SourceMeta (현 ingest-pipeline.ts:1827) 에서도 **재사용** — 두 번 read 금지. 시그니처: `buildV3SourceMeta(wikiFS: WikiFS, sourcePath: string, rawDiskBytes: Uint8Array, ext: string, ingestedPagePath: string, preservedSourceId?: string): Promise<V3SourceMeta>` — 기존 인자 (wikiFS, sourcePath, ext, ingestedPagePath) 보존, rawDiskBytes 인자 신규 (함수 내부 read 제거), preservedSourceId 인자 신규 (force/protect 분기에서 R.id 전달, R==null 분기에서 undefined → 함수 내부 computeFileId 사용).
- **★ Step 0.5**: `const decision = await decideReingest({ sourcePath, sourceBytes: rawDiskBytes, wikiFS, basePath, onConflict: opts?.onConflict })` — **★ P1-1 raw bytes 만 전달**
- **★ Step 0.6 분기**:
  - `'skip'` + `forceReingest != true` → SkippedIngestResult build (registry.ingested_pages 그대로) → return. duplicate-hash conflict 면 `appendDuplicateLocation(reg, decision.duplicateOfId, decision.duplicatePathToAppend)` 후 saveRegistry (★ codex v6 P1 정정 v7: decision 의 명시 필드 사용 — caller 가 R_byHash 별도 보관 불필요)
  - `'skip-with-seed'` → sidecar bytes read → `sidecar_hash = computeFullHash(NFC(content))` → `upsert` 로 registry 갱신, `last_action='skip-with-seed'` → return. **LLM·page write·reindex 미실행** (P1-3)
  - `'force'` 또는 force override → 기존 흐름. canonical write 후 sidecar_hash 갱신 (P1-2)
  - `'protect'` → 기존 흐름이되 hook 1, 2 적용
  - `'prompt'` → `onConflict(info)` 호출. 'overwrite' → force 로 변환 후 진행, 'preserve' → protect 로 변환 후 진행, 'cancel' → throw `IngestCancelledByUserError`
- **Hook 1 (sidecar write block, ingest-pipeline.ts:226-233)** — ★ codex v3 P1 정정 (v4: 명세 = implementation 동기):
  - `conflicts.includes('sidecar-user-edit') || conflicts.includes('legacy-no-sidecar-hash')` → write target = `protectSidecarTargetPath(sourcePath, wikiFS)` (= `<sourcePath>.md.new[.1~.9]`)
  - canonical `<sourcePath>.md` 는 read-only — 사용자 수정 보존 (P1-2)
  - registry 갱신 시 `appendPendingProtection(reg, id, {kind:'sidecar-md-new', path, conflict: 'sidecar-user-edit' OR 'legacy-no-sidecar-hash'})`, **sidecar_hash 미갱신** (P1-2)
  - 그 외 → 기존 path. canonical write 직후 `sidecar_hash = await computeSidecarHash(wikiFS, sidecarPath)` 갱신
  - test case #5 (sidecar user edit) + 신규 #12 (legacy raw-hash mismatch + disk sidecar) 모두 protect 분기 + `<base>.md.new` 생성 + canonical 보존 검증
- **Hook 2 (source page createPage 직전, ingest-pipeline.ts:417 부근) — ★ P1-5 source page 한정**:
  - `conflicts.includes('source-page-user-edit')` → `existing = await wikiFS.read('wiki/sources/' + sourcePage.filename).catch(()=>'')` → `markers = extractUserMarkers(existing)` → `sourcePage.content = mergeUserMarkers(sourcePage.content, markers)` → createPage
  - **entity/concept (line 447, 455) 미적용 — 후속 follow-up #4** (현재 plan 명시적 narrowing). entity/concept Hook 2 미적용을 docstring 으로 명문화
- **Hook 3 (registry upsert 직후)** — ★ codex v6 P1-3 + v7 P1 정정 (v8 명시 merge):
  upsert 가 record 전체 교체 (`{ ...reg, [id]: record }`) 이므로 **caller 가 existing merge 의무**. force/protect 분기 의 명시 merge 패턴:
  ```ts
  const existing = findById(reg, sourceId)  // 또는 R.record (이미 손에 있음)
  // ★ codex v9 P1-B 정정 (v10): protect 분기에서 sidecar_hash / sidecar_vault_path 미갱신 명시 conditional.
  //     기존 주석 의존 패턴 → 명시 spread 조건으로 강제. 구현자가 protect 분기에서 canonical write 안 했음에도
  //     실수로 sidecar_hash 갱신 위험 차단.
  // ★ codex v10 P1 정정 (v11): Hook 1 조건 (sidecar-user-edit OR legacy-no-sidecar-hash) 와 정합.
  //     이전 v10 은 sidecar-user-edit 만 제외 → legacy-no-sidecar-hash protect 케이스에서 canonical 미write 인데도
  //     sidecar_hash 갱신 → 데이터 오염 위험. v11: 두 conflict 모두 protect 분기로 인식.
  const isSidecarProtected =
    decision.action === 'protect' &&
    (decision.conflicts.includes('sidecar-user-edit') ||
     decision.conflicts.includes('legacy-no-sidecar-hash'))
  const isCanonicalSidecarWritten = !isSidecarProtected
  const merged: SourceRecord = {
    ...existing,                             // 기존 모든 필드 보존 (first_seen, path_history, duplicate_locations, pending_protections, sidecar_vault_path, sidecar_hash 등)
    hash: computeFullHash(rawDiskBytes),    // force/protect 분기 새 hash
    size: rawDiskBytes.byteLength,          // size 갱신
    last_action: decision.action,
    reingested_at: [...(existing.reingested_at ?? []), today],
    ingested_pages: newIngestedPages,
    // ★ canonical sidecar 가 실제로 (re)write 된 경우만 sidecar_vault_path / sidecar_hash 갱신 (P1-2 단일 규칙)
    ...(isCanonicalSidecarWritten ? {
      sidecar_vault_path: canonicalSidecarPath,
      sidecar_hash: await computeSidecarHash(wikiFS, canonicalSidecarPath),
    } : {
      // protect 분기 (sidecar `.md.new`): existing.sidecar_vault_path / existing.sidecar_hash 그대로 유지
    }),
  }
  const nextReg = upsert(reg, sourceId, merged)   // ★ codex v8 P1 정정 (v9): upsert 는 immutable — 반환값 사용 의무
  await saveRegistry(wikiFS, nextReg)              // 옛 reg 가 아닌 nextReg 저장
  ```
  skip / skip-with-seed / duplicate-hash 분기도 동일 패턴 — Step 0.6 에서 `nextReg = upsert(...)` + `saveRegistry(wikiFS, nextReg)` 명시.
- **wikiFS.write best-effort 명시 (P2-2)**: protect 분기의 `<base>.md.new` write 가 throw 하면 → log warn + `pending_protections` 미append + 본 ingest 는 force 로 fallback (사용자 수정 LOST 위험 명시 — but throw 시 protect 자체 실패가 더 큰 문제). 본 plan 결정: throw 면 `IngestProtectionFailedError` 신규 throw. caller (plugin) 가 사용자 alert.

**Acceptance (실행 증거)**:
- RED: `npm test -- ingest-pipeline` → 11 신규 case FAIL — vitest 출력 캡처
- GREEN: `npm test -- ingest-pipeline` → 11/11 passed, exit 0 — vitest 출력 캡처
- 회귀: 기존 ingest-pipeline test 전부 PASS (584 → 595 PASS, R==null 분기는 영향 없음)
- Coverage: ingest-pipeline.ts 의 신규 hook 라인 100% (Step 0/0.5/0.6 + Hook 1/2/3 모두)

**Dependencies**: Step 1, Step 2
**Risk**: High (ingest-pipeline.ts 1965 lines, side-effect 다수. mock 정밀도 중요. Step 0/0.5 신규 진입점이 reconcile/movePair 와 정합 검증 필요)

---

### Step 4 — `classify.ts movePair` 시나리오 B fix (★ P1-7 정정 — sidecar pre-resolve + atomic registry 갱신)

> **★ codex P1-7 정정 (2026-04-25)**: 이전 plan 은 원본 이동 후 sidecar 이름 충돌 처리 → exhausted throw 발생 시 원본·sidecar 분리. 정정: **sidecar 목적지 pre-resolve (존재 확인 + suffix 결정) 먼저 → exhausted 면 원본 이동 전 return → 둘 다 옮길 수 있으면 atomic 진행**. registry 갱신은 신규 helper `recordMoveWithSidecar` 로 vault_path + sidecar_vault_path 동시.

**파일**:
- `wikey-core/src/classify.ts` (수정 — sidecar pre-resolve 분기 + `recordMoveWithSidecar` 호출)
- `wikey-core/src/__tests__/move-pair.test.ts` (수정 — 신규 case 5 추가)

**Test Spec (RED)** — 6 신규 case (★ v3 #6 skip frontmatter preserve 추가):

1. **dest-conflict — auto skip (default off, backwards compat)**: 기존 동작 (`sidecarSkipReason='dest-conflict'`, sidecar 미이동, **원본은 이동됨**) 유지 — **단 이 경우도 P1-7 일관성 위해 원본 이동 후 registry sidecar_vault_path 가 stale 안 되도록 신규 helper 사용**
2. **dest-conflict — auto rename (opt-in)**: `MovePairOptions.onSidecarConflict='rename'` 시 sidecar 목적지 pre-resolve → `<base>.<ext>.md.1` (충돌 시 `.2`, `.3`... 자동 증가) 로 sidecar 이동 + return 에 `renamedSidecarTo` 노출
3. **★ P1-7: dest-conflict — exhausted (.10 한계) pre-checked, original 미이동**: sidecar 목적지 `.1`~`.9` 모두 충돌 → **원본 이동 전** return `{movedOriginal: false, movedSidecar: false, sidecarSkipReason: 'dest-conflict-exhausted'}`. caller 는 이 신호 보고 user prompt
4. **★ P1-7: rename 성공 시 registry 가 atomically 갱신** — `recordMoveWithSidecar` 가 vault_path + sidecar_vault_path 한 번에 갱신, 중간 race 없음 확증 (test 는 atomic 갱신 전후 registry snapshot 비교)
5. **★ P1-7: 기본 'skip' 모드도 registry sidecar_vault_path 정합** — sidecar 못 옮겨서 dest-conflict 인 경우, registry 에 남는 sidecar_vault_path 는 **이전 위치 유지** (원본만 옮긴 상태가 의도. 이 경우 audit-ingest.py 가 sidecar 미이동 detect 가능)
6. **★ v3 codex 정정 — skip 분기 source-page frontmatter sidecar_vault_path preserve**: skip 분기에서 wiki/sources frontmatter rewrite 시 sidecar_vault_path 가 **null 로 덮어쓰이지 않고 existing 값 보존**. test: 원본 X.pdf 가 inbox→PARA 이동, sidecar dest-conflict 로 미이동 → wiki/sources/X.md frontmatter.sidecar_vault_path == 이전 inbox 경로 유지 (null 아님)

**Implementation (GREEN)**:
- `MovePairOptions` 에 `onSidecarConflict?: 'skip' | 'rename'` (default `'skip'`) 신규
- **★ P1-7 핵심 변경**: 원본 `renameSync` **이전** sidecar 목적지 pre-resolve 단계 신설:
  ```
  1) registry lookup
  2) sidecar 목적지 후보 결정:
     - 'skip' + dest 충돌 → resolved = null, sidecarSkipReason='dest-conflict'
       ※ ★ codex v2 P1 정정: 이 경우 source-page frontmatter rewrite 시 sidecar_vault_path 는
         existing.sidecar_vault_path **보존** (null 로 덮어쓰지 않음). 원본만 이동 + sidecar 는 이전 위치.
     - 'rename' + 충돌 → .1~.9 순차 시도. 첫 미존재 = resolved. 모두 충돌 = sidecarSkipReason='dest-conflict-exhausted', 원본 이동 전 return
     - dest 없음 → resolved = sidecarDest
  3) 원본 renameSync (이 시점에 sidecar 처리 결정 완료)
  4) sidecar 처리: resolved 있으면 renameSync, 없으면 skip
  5) registry: recordMoveWithSidecar(reg, id, newOriginalVaultPath, sidecarOption)
     sidecarOption = resolved ? { kind: 'set', path: newSidecarVaultPath } : { kind: 'preserve' }
     ※ ★ codex v3 P2 정정 (v4): discriminated option `{ kind: 'preserve' | 'clear' | 'set' }`.
       preserve = existing.sidecar_vault_path 보존 / clear = null / set = path 신규.
       skip 분기 = preserve. dest 충돌 시 frontmatter 도 sidecar_vault_path 보존.
  ```
- `MovePairResult` 에 `renamedSidecarTo?: string` 신규. `sidecarSkipReason` enum 에 `'dest-conflict-exhausted'` 추가
- registry 갱신은 Step 1 의 `recordMoveWithSidecar` 사용 (atomic — race 방지)

**Acceptance (실행 증거)**:
- RED: `npm test -- move-pair` → 6 신규 case FAIL — vitest 출력 캡처
- GREEN: `npm test -- move-pair` → 6/6 passed, exit 0 — vitest 출력 캡처
- 회귀: 기존 movePair test 전부 PASS (default 'skip' 분기는 backwards compat)

**Dependencies**: Step 1 (`recordMoveWithSidecar` helper 필요)
**Risk**: Low-Medium (atomic 갱신은 helper 단위 검증 + integration smoke 로 확증)

---

### Step 5 — `audit-ingest.py` JSON 컬럼 확장 (★ P1-8 분리 + P2-1 pending + P2-4 exit 0)

> **★ codex P1-8 정정**: `modified_since_ingest` 단일 컬럼 → `source_modified_since_ingest` (raw bytes hash diff) + `sidecar_modified_since_ingest` (sidecar hash diff) 두 컬럼 분리. JSON 키, 출력 메시지, fixture 모두 별개.
> **★ P2-1**: `pending_protections` 컬럼 추가 — registry.pending_protections snapshot. cleanup 정책: 다음 ingest 진입 시 protect 해소 (사용자 confirm) 되면 `clearPendingProtection` 호출. 본 plan 의 audit 는 가시화만, cleanup 의무는 후속.

**파일**:
- `scripts/audit-ingest.py` (수정 — registry 로드 + hash 비교 + 신규 컬럼 5개)
- `scripts/__tests__/audit-ingest.bats` (신규 또는 fixture-based shell smoke — bats 인프라 부재 시 `tests/audit-fixtures/<scenario>.sh` 형식)

**Test Spec (RED)** — fixture-based shell smoke (검증 가능 외부 산출물, 6 신규 case):

1. **fixture: clean state** — raw/ + wiki/sources/ + registry 일치 → JSON 의 5 신규 컬럼 모두 `[]`, exit code 0
2. **fixture: orphan sidecar (시나리오 C)** — raw/x.pdf 삭제하고 raw/x.pdf.md 만 남김 → JSON `orphan_sidecars` 에 등장, exit 0
3. **★ P1-8: fixture: source modified (raw bytes 변경)** — raw/x.pdf bytes 변경 (registry.hash != disk hash) → JSON `source_modified_since_ingest` 에 등장, `sidecar_modified_since_ingest` 비어있음
4. **★ P1-8: fixture: sidecar modified (sidecar `.md` 만 변경)** — raw/x.pdf.md 만 수정 (registry.sidecar_hash != disk sidecar hash, raw hash 동일) → JSON `sidecar_modified_since_ingest` 에 등장, `source_modified_since_ingest` 비어있음
5. **fixture: duplicate hash (시나리오 E)** — raw/x.pdf 를 raw/y.pdf 로 복사 (같은 hash) → JSON `duplicate_hash` 에 `[{"hash": "...", "paths": [...]}]`
6. **★ P2-1: fixture: pending_protections** — registry 에 `pending_protections: [{kind:'sidecar-md-new', path:'raw/x.pdf.md.new', ...}]` 있음 → JSON `pending_protections` 에 그대로 노출

**Implementation (GREEN)**:
- `audit-ingest.py` 에 `load_registry()` 함수 추가 — `.wikey/source-registry.json` 파싱 (corrupted 시 빈 dict)
- `scan_raw_docs()` 결과 각 파일에 대해 `hashlib.sha256(open(path,'rb').read()).hexdigest()` 계산 (대용량 파일 영향: 우선 단순 구현, perf 우려는 후속 follow-up — file size + mtime 1차 필터)
- **★ P1-8 분리**:
  - `source_modified_since_ingest`: registry record 의 vault_path 가 disk 에 있고 `record.hash != hashlib.sha256(disk_bytes)`
  - `sidecar_modified_since_ingest`: registry record 의 sidecar_vault_path 가 disk 에 있고 `record.sidecar_hash` 가 truthy 이고 sidecar disk hash 와 다름
- **★ P2-7 NFC**: sidecar 는 markdown 텍스트 — Python 도 `unicodedata.normalize('NFC', content)` 후 utf-8 encode → sha256 (TS computeSidecarHash 와 동일 NFC 가정)
- 신규 컬럼 5개 build 후 JSON output 에 포함
- summary/full 모드 출력에 줄 추가 (`경고: 변경된 소스 N개 / 변경된 sidecar M개 / 고아 sidecar K개 / pending P개 / duplicate Q개`)

**★ P2-4 exit 0 증거 획득 방법 명시**:
- shell smoke 각 fixture 에서 `python3 scripts/audit-ingest.py --json > out.json; echo "exit=$?"` 실행 후 `exit=0` 출력 + `jq '.source_modified_since_ingest'` 등으로 컬럼 검증
- bats 도입 시 `@test "..." { run python3 scripts/audit-ingest.py --json; [ "$status" -eq 0 ]; ... }` 형식
- 본 plan 에서는 6 fixture 각각의 expected JSON 파일 (`tests/audit-fixtures/<scenario>.expected.json`) 과 비교 + exit code assert. CI 통합은 후속

**Acceptance (실행 증거)**:
- RED: shell smoke 6 fixture → JSON 에 신규 컬럼 부재 / 잘못된 값 → FAIL (exit code 0 이지만 JSON diff 존재)
- GREEN: 6 fixture all PASS, JSON 컬럼 정확, exit 0 — shell stdout 캡처
- perf 영향 측정: raw/ 100MB 규모 fixture 에서 audit 실행 시간 < 5s (기준선 측정 후 회귀 임계 설정)
- Coverage: 신규 코드 90%+ (Python coverage 측정 별도 미요구, 분기 수동 확증)

**Dependencies**: Step 1 (sidecar_hash + pending_protections 가 registry 에 저장돼 있어야 detection 정확)
**Risk**: Medium (Python ↔ TS hash 일관성 NFC 가정, 대용량 파일 perf)

---

### Step 6 — CLI / plugin 진입점 (★ P2-3 default modal + onConflict + forceReingest)

> **★ P2-3 정정**: plugin 의 `onConflict` 미제공 시 default = auto-protect (silent `<base>.md.new`). 사용자 가시성 개선을 위해 **plugin 은 ConflictModal 컴포넌트를 default 로 내장 + 제공** — `commands.ts:runIngestCore` 가 default `onConflict = (info) => openConflictModal(info)` 를 주입한다. 사용자가 modal 을 명시적으로 disable 했을 때만 silent auto-protect.

**파일**:
- `wikey-obsidian/src/commands.ts` (plugin entry — `IngestOptions.forceReingest` + `onConflict` 통합, default modal 주입)
- `wikey-obsidian/src/conflict-modal.ts` (신규, ~80 lines — Obsidian Modal 상속, overwrite/preserve/cancel 3 버튼, diff snippet 표시)
- `wikey-core/src/ingest-pipeline.ts` (line 87 — `IngestOptions` interface 확장. ★ codex v6 P2 정정 v7: types.ts 가 아닌 ingest-pipeline.ts 가 실제 정의 위치)
- 통합 smoke: 실 raw/ fixture 로 (a) 첫 ingest → 같은 ingest (skip) → seed (legacy) → 변경 후 ingest (force) → sidecar 수정 후 (protect modal) 5-step 시나리오
- CLI 진입점: 별도 follow-up (#5) — 본 Step 은 plugin path 만

**Test Spec (RED)** — 7 신규 case:

1. **plugin forceReingest=true** — hash 동일이어도 skip 안 됨, 정상 force 재인제스트. 단 conflicts!=[] 이면 여전히 protect 분기 (force 가 보호 무력화 안 함)
2. **plugin onConflict='overwrite'**: callback 이 'overwrite' 반환 → action='force' 변환 후 진행 (사용자 명시 선택, 손실 명시)
3. **plugin onConflict='preserve'**: callback 이 'preserve' → action='protect' 변환, sidecar `.md.new` + source page user marker merge
4. **plugin onConflict='cancel'**: throw `IngestCancelledByUserError`. 기존 PlanRejectedError 패턴과 유사
5. **★ P2-3: plugin default modal 주입** — `runIngestCore` 가 onConflict 미명시 시 default `openConflictModal` 사용. modal 미존재 환경 (test) 에서는 silent protect fallback (warn log)
6. **★ P2-3: plugin ConflictModal — overwrite 클릭 → 'overwrite' resolve**: ConflictModal 단위 (DOM 시뮬레이션) — Obsidian Modal mock
7. **★ P1-3: skip-with-seed end-to-end** — legacy registry record (sidecar_hash 없음) + 같은 source 두 번째 ingest → IngestResult.skipped=true + skipped reason='hash-match-sidecar-seed' + registry 갱신 확증

**Implementation (GREEN)**:
- `IngestOptions` 에 추가:
  ```ts
  forceReingest?: boolean
  onConflict?: (info: ConflictInfo) => Promise<'overwrite' | 'preserve' | 'cancel'>
  ```
- ingest-pipeline.ts 의 `decideReingest` 호출 시 `onConflict: opts?.onConflict` 전달
- decision='skip' 또는 'skip-with-seed' 인데 `opts.forceReingest=true` → force 로 override 진행 (단 conflicts 있으면 여전히 protect/prompt 분기)
- **★ P2-3 plugin default modal**: `commands.ts:runIngestCore` 에서:
  ```ts
  const onConflict = ctx.onConflict ?? (async (info: ConflictInfo) => {
    return new Promise((resolve) => {
      new ConflictModal(plugin.app, info, resolve).open()
    })
  })
  ```
- `ConflictModal` (신규): 3 버튼 (overwrite/preserve/cancel) + diff snippet 표시 (sidecar 변경 시 first 200 char diff)
- **★ codex v2 P1 정정 — IngestResult skip path 명세 (v3 신규)**: 기존 `IngestResult` 는 sourcePage/entities/concepts 보유. skip 분기에서는 그것들 없음. plugin 의 가정 충돌 회피를 위해 union type 으로 분리:
  ```ts
  // wikey-core/src/types.ts
  export interface IngestResult {
    readonly sourceId: string
    readonly sourcePage: WikiPage
    readonly entities: WikiPage[]
    readonly concepts: WikiPage[]
    readonly updatedPages: string[]
  }
  export interface SkippedIngestResult {
    readonly sourceId: string
    readonly skipped: true
    readonly skipReason: 'hash-match' | 'hash-match-sidecar-seed' | 'hash-match-sidecar-edit-noted' | 'duplicate-hash-other-path'
    readonly ingestedPages: readonly string[]   // registry.ingested_pages 그대로
    readonly seededSidecarHash?: boolean        // skip-with-seed 분기에서만 true
    readonly duplicateOfId?: string             // duplicate-hash-other-path 분기에서만
  }
  export type IngestReturn = IngestResult | SkippedIngestResult
  ```
- ingest 함수 시그니처: `Promise<IngestReturn>`. plugin (commands.ts:runIngestCore) 은 `'skipped' in result` type guard 분기 — sourcePage/entities/concepts 가정 케이스를 skip 경로에서 제거.
- **★ codex v3 P2 정정 (v4) — plugin skip handling 명시**:
  - skip 분기에서 plugin 동작: `createdPages: []` 반환, `saveIngestMap` **호출 안 함** (registry 가 이미 ingested_pages 보유, 중복 갱신 회피), `autoMove` (inbox→PARA 자동 이동) **호출 안 함** (재인제스트 결정이 skip 이면 raw 위치 그대로). 단 duplicate-hash 분기는 `appendDuplicateLocation` 만 호출 (registry side-effect, autoMove 별개).
  - skip-with-seed 분기: registry sidecar_hash 갱신만 발생 (saveIngestMap 호출 안 함). plugin notify="이미 ingest 완료, sidecar baseline 만 갱신".
  - duplicate-hash-other-path 분기: plugin notify="중복 detect: <duplicateOfId>", autoMove 안 함.
- **회귀 영향**: master 가 grep `IngestResult` 으로 caller 8 곳 확인 (commands.ts, runIngestCore 등) + skip 분기 처리 추가 명시. Step 3 / Step 6 회귀 PASS 조건에 포함.

**Acceptance (실행 증거)**:
- RED: `npm test -- ingest-pipeline conflict-modal` → 7 신규 case FAIL — vitest 출력 캡처
- GREEN: 7/7 passed, exit 0 — vitest 출력 캡처
- 통합 smoke 5-step: master CDP 환경에서 실 ingest 사이클. 측정값:
  - 1차 첫 ingest: 정상 시간 (baseline)
  - 2차 같은 ingest: skip 분기 < 1s (LLM 0회 확증)
  - 3차 legacy seed: registry sidecar_hash 채워짐 + IngestResult.skipped=true (skip-with-seed)
  - 4차 raw bytes 변경: force, sidecar/source page overwrite, registry 갱신
  - 5차 sidecar disk 수정: protect modal 노출 → preserve 클릭 → `<base>.md.new` 생성, canonical `.md` 보존, registry.pending_protections append
- Coverage: ConflictModal 80%+, plugin runIngestCore 신규 분기 90%+

**Dependencies**: Step 3
**Risk**: Medium (plugin Modal 컴포넌트 mock + Obsidian API 의존. CDP 통합 smoke 5-step 은 master 가 직접 시각 확증)

---

## Acceptance Criteria

> 본 보조 문서는 todo 체크박스 금지 원칙에 따라 평문 리스트만. 진행 추적 체크박스는 [`phase-5-todo.md §5.3`](./phase-5-todo.md#53-인제스트-증분-업데이트-p1) 에 미러링됨.

전체 §5.3.1 + §5.3.2 가 종결되려면 다음 모두 충족:

- **Step 1** — `SourceRecord.sidecar_hash / reingested_at / last_action / pending_protections` 4 필드 + helper 4 신규 (`appendPendingProtection / clearPendingProtection / appendDuplicateLocation / recordMoveWithSidecar`) + 7 신규 case PASS
- **Step 2** — `incremental-reingest.ts` 신규 + 23 unit cases passed (★ P1-1 raw bytes invariant + P1-3 skip-with-seed + P1-4 동시 conflicts + P2-5 멱등성 + P2-6 multiline regex + P2-7 NFC 포함). RED/GREEN 출력 명시
- **Step 3** — ingest-pipeline.ts Step 0/0.5/0.6 + Hook 1/2/3 통합 + 12 integration cases passed (★ skip-with-seed end-to-end + 동시 conflicts + entity/concept 미보호 negative test + ★ v3 source_id stable test #11 + ★ v5 Hook 1 legacy mismatch test #12 포함) + 기존 ingest-pipeline.test.ts 회귀 PASS
- **Step 4** — movePair `onSidecarConflict='rename'` + sidecar pre-resolve + `recordMoveWithSidecar` atomic 갱신 + 6 cases passed (★ P1-7 exhausted pre-checked + atomic 정합 + ★ v3 skip frontmatter preserve)
- **Step 5** — audit-ingest.py 신규 컬럼 5개 (`orphan_sidecars` / **★ `source_modified_since_ingest`** / **★ `sidecar_modified_since_ingest`** / `duplicate_hash` / **★ `pending_protections`**) + 6 fixture smoke PASS + exit 0 명시
- **Step 6** — `IngestOptions.forceReingest` + `onConflict` + ★ default ConflictModal 주입 + 7 cases passed (★ P1-3 skip-with-seed end-to-end + P2-3 default modal 포함)
- **Cycle smoke** (수동, master CDP) — 5-step 시나리오 (첫 ingest → skip → seed → force → protect modal) 실 obsidian 환경 reproduce → 시나리오 A/D/E 사용자 수정 보존 확증
- **회귀**: `npm test` 전체 (현 584 → 신규 60 개 추가 [Step1: 7 + Step2: 23 + Step3: 11 + Step4: 6 + Step5: 6 + Step6: 7], 약 644/644) PASS, build 0 errors
- **Coverage 80%+** — incremental-reingest.ts ≥ 95%, ingest-pipeline.ts 신규 hook 라인 100%, source-registry.ts ≥ 95%, ConflictModal ≥ 80%
- **시나리오 매트릭스 검증**: A/F (sidecar `.md.new` 보호 + canonical 미변경), D (source page user marker — ★ source 한정), E (**duplicate_locations** 필수 append — ★ P1-6 + v4, path_history 아님), B (rename + atomic — ★ P1-7), C (orphan 표시), G/H (정상 동작) 8개 시나리오 매핑 표가 todo §5.3.2 표와 1:1 일치
- **★ codex P1-8 컬럼 분리 확증**: audit JSON 의 `source_modified_since_ingest` (raw hash) 와 `sidecar_modified_since_ingest` (sidecar hash) 가 동일 fixture 에서 별개로 동작 (각각의 fixture 가 한 컬럼만 채움)

---

## 위험 / 트레이드오프

### Risk 1: ingest-pipeline.ts surgical 변경의 회귀 위험
- ingest() 함수가 1965 lines. Step 0/0.5/0.6 신규 + Hook 1/2/3 = 6곳 수정. mock-heavy integration test 가 false-positive 낼 가능성.
- **완화**: Step 2 의 helper 단위 테스트로 결정 트리 isolate. Step 3 integration 은 helper 결과를 input 으로 하는 mock 으로 격리. 기존 ingest-pipeline.test.ts 회귀 확증.

### Risk 2: User marker 헤더 공식화의 임의성
- `## 사용자 메모` / `## User Notes` / `## 메모` 3개 default. 사용자가 다른 헤더 (`## 노트`, `## 추가 정보`) 쓰면 보호 안 됨.
- **완화**: `.wikey/wikey.conf` 또는 schema-override 에 `user_marker_headers` 신규 키 노출 (Step 2 helper 가 config 인자 받게). 본 plan 에서는 default 3 만 hardcoded, 후속 (#2) 에서 config 노출.

### Risk 3: Hash 비교 perf (대용량 PDF)
- 100MB+ PDF 를 매 ingest 시 재read+hash 하면 ~200ms 추가. skip case 에서 LLM 호출 (수십초) 회피 이득 >> hash 비용. trade-off OK.
- **완화 안 함** (필요 시 후속 #3 — file size + mtime 1차 필터 후 hash).

### Risk 4: User marker 가 LLM 출력에 우연 등장
- LLM 이 `## 사용자 메모` 라는 H2 를 자체 생성하면 extractUserMarkers 가 LLM 출력에서 이를 추출 → mergeUserMarkers 가 중복 append.
- **완화**: extractUserMarkers 는 **기존 wiki page** 에서만 추출. mergeUserMarkers 는 새 본문에 같은 헤더 이미 있으면 merge skip (★ P2-5 멱등성). Step 2 test case 18.

### Risk 5 (★ P1-3 정정): Registry sidecar_hash 가 없는 legacy record
- 기존 vault 에는 sidecar_hash 필드 없음. **이전 plan 의 "1 회 이후 정상" 은 거짓** — hash-match (raw bytes 동일) 로 매번 skip 되면 sidecar_hash 영원히 미채움 → 매번 protect 발동.
- **★ 정정 완화**: Step 2 의 `skip-with-seed` 분기가 첫 hash-match 시점에 LLM·page write 0 으로 sidecar_hash 만 채움. 비용 = sidecar bytes read + sha256 (수십 ms). 두 번째 ingest 부터 정상 'skip' 분기. **수동 force ingest 불필요**.
- raw hash 가 mismatch 인 legacy 케이스는 `legacy-no-sidecar-hash` conflict 와 함께 protect 분기 (보수적, 손실 0 분기).

### Risk 6 (신규, ★ P1-2 drift 추적): pending_protections 누적
- protect 분기에서 `<base>.md.new` 가 누적되면 vault 가 `.md.new`, `.md.new.1` 같은 잔여물로 어수선해질 수 있음.
- **완화**: P2-1 cleanup 정책 — 다음 ingest 진입 시 사용자가 protect 해소 (sidecar 검토 후 `.md.new` 를 canonical 로 promote 또는 삭제 결정) 하면 `clearPendingProtection` 호출. 본 plan 에서는 audit 에 가시화 (Step 5 `pending_protections` 컬럼) + log 안내까지. 자동 cleanup 후속 (#1).

### Trade-off: protect mode 의 default 가 "auto-protect" (sidecar.md.new)
- prompt UI 가 없는 CLI 환경에서는 사용자가 모르는 사이 `<base>.md.new` 가 생김. discover 가 audit/log 의존.
- **대안 검토**: protect 시 throw → 사용자 명시적 처리 강제. 하지만 ingest batch (10 files) 중간 1건 throw 면 batch 멈춤 → 사용성 저하.
- **결정**: auto-protect default 유지. Notice/log 강화 + audit-ingest.py 의 `pending_protections` 컬럼 시각화 (Step 5). plugin 은 default ConflictModal 주입 (★ P2-3) 으로 GUI 환경에서는 silent 위험 제거.

### Trade-off (★ P1-5): Wiki page 보호 scope narrowing — source page 한정
- 본 plan 은 `wiki/sources/source-*.md` 만 user marker 보호. entity/concept 페이지는 LLM 결정적 결과 + 사용자가 메모 추가 빈도 낮음 + 우연 H2 등장 시 중복 append 위험.
- **결정**: scope narrowing — source page 한정. todo §5.3.2 acceptance 라인 234, 245 도 narrowing 필요 (master 가 todo 본문 fix). entity/concept 보호는 후속 (#4) — LLM 출력 충돌 케이스 분석 후 도입.
- 위험: 사용자가 entity/concept 에 메모 추가했는데 보호 안 됨 → 손실. 완화: README/안내문에 명시적 "현재 source page 만 보호" 표기 + audit/dashboard 가 entity/concept user marker 감지 시 경고 (후속 follow-up).

---

## 후속 (out-of-scope)

본 plan 에서는 **기능적 fix 까지만**. 다음은 별도 follow-up:

1. **`.md.new` 자동 cleanup 정책 (★ P2-1)** — 다음 ingest 진입 시 protect 해소된 항목 (사용자가 `.md.new` 를 canonical 로 promote 또는 삭제) 을 자동 detect → `clearPendingProtection` 호출. 본 plan 은 audit 가시화까지만, 자동 cleanup 후속.
2. **UI 시각화** — audit panel / dashboard 가 `source_modified_since_ingest` / `sidecar_modified_since_ingest` / `orphan_sidecars` / `duplicate_hash` / `pending_protections` 5 신규 컬럼을 시각화 (배지·필터). §5.2.0 v3 broken state badge 와 통합 검토.
3. **User marker config 노출** — `.wikey/wikey.conf` 또는 schema-override 에 `user_marker_headers: string[]` 키. 사용자가 보호 헤더 추가 가능.
4. **★ P1-5 narrowing 후속 — Entity/Concept page user marker 보호** — 본 plan 은 source page 만. entity/concept 까지 확장 시 LLM 결정적 출력과의 충돌 케이스 분석 + USER_MARKER_HEADERS 가 LLM 본문에 우연 등장 빈도 측정 필요. todo §5.3.2 의 entity/concept 보호 acceptance 도 본 follow-up 에서 narrowing 해제.
5. **Hash perf — file size + mtime 1차 필터** — 100MB+ raw 파일에서 mtime 동일하면 hash 재계산 skip. 대용량 corpus 에서만 영향.
6. **CLI 진입점** (Step 6 plugin path 우선) — `wikey ingest --force` / `--diff-only` CLI 플래그 정식 추가. CLI codebase 위치 확인 후 별도.
7. **Section-level diff (todo §5.3.1 마지막 항목)** — `section-index.ts parseSections` H2 단위 hash 매칭으로 부분 재인제스트. 본 plan 은 file-level diff 까지만, section-level 은 §5.3 후속.
8. **Tombstone restore + sidecar_hash 정합성** — reconcile 의 path-history 복구 시 sidecar_hash 도 갱신 검토. 현 plan 은 hash 만 비교, 사용 사례 적어 후속.
9. **Python ↔ TS NFC 정규화 일관성 검증 자동화 (★ P2-7)** — TS computeFullHash 와 Python sha256 이 NFC 정규화 후 동등함을 cross-language smoke 로 자동 검증. 본 plan 은 가정만, 자동 검증 후속.

---

## 다음 단계

★ codex v2 REJECT 의 잔여 P1 5건 + P2 5건 + skip path 정정 반영. plan v3 재배포. codex Mode D Panel 재검증 — 다음 6 axis cross-model 확증:

1. **Phase B 결정 트리 분기 순서**: duplicate-hash 분기가 hash-match 보다 앞에 와서 reachable 한가 (v2 P1-1)
2. **Hook 1 명세 확장**: `sidecar-user-edit OR legacy-no-sidecar-hash` cover (v2 P1-2)
3. **결정 10 source_id stable per path**: wikilink/provenance 영향 0 + preservedSourceId helper signature (v2 P1-3)
4. **movePair skip 분기 sidecar_vault_path preserve**: existing 보존, null 덮어쓰기 금지 + recordMoveWithSidecar 시그니처 (v2 P1-4)
5. **Audit JSON additive only**: 기존 키 (count + *_files) 보존, 5 신규 array 만 추가 (v2 P1-5)
6. **SkippedIngestResult union type**: plugin 가정 충돌 회피 + IngestReturn 분기 type guard (v2 skip path)

추가: forceReingest caller-only (helper 시그니처 미포함, P2-2), `.md.new` collision suffix `.1~.9` 자동 + `.10` throw (P2-3), pending_protections kind = 'sidecar-md-new' 만 (P2-4), todo §5.3.2 source page narrowing 본 turn 처리 완료 (P2-5), raw bytes 재사용 명시 (P2-1).

### v2 → v3 변경 이력

| # | 항목 | v2 | v3 (★ 정정) |
|---|------|----|-----|
| 1 | Phase B duplicate 분기 위치 | hash-match 뒤 (unreachable) | hash-match **앞** |
| 2 | Hook 1 trigger | sidecar-user-edit 만 | sidecar-user-edit OR **legacy-no-sidecar-hash** |
| 3 | source_id 정책 | 미정 | **stable per path** (결정 10 신설) + preservedSourceId |
| 4 | movePair skip 분기 frontmatter | 명시 없음 | sidecar_vault_path **existing 보존** |
| 5 | Audit JSON 샘플 | array 단순화 (실제 schema 와 충돌) | **기존 키 보존 + 5 신규 array (additive)** |
| 6 | IngestResult skip path | flag 추가 | **SkippedIngestResult union** + IngestReturn type guard |
| 7 | forceReingest 위치 | helper 인자 + caller | **caller-only** override |
| 8 | protectSidecarTargetPath | `.md.new` 단일 | `.md.new[.1~.9]` 자동 증가, `.10` throw |
| 9 | PendingProtection.kind | 2종 | **'sidecar-md-new' 만** ('source-page-marker-merged' 제거) |
| 10 | raw bytes 재사용 | 미명시 | Step 0 + buildV3SourceMeta 동일 변수 |
| 11 | todo §5.3.2 narrowing | 미반영 | 본 turn master 가 todo:234 narrowing 적용 완료 |

총 변경: plan 본문 11 항목. test 카운트 변동 없음 (Step 3 신규 test #11 source_id preservation, Step 4 신규 test #6 skip frontmatter preserve 추가 — 58 → 60 case).
