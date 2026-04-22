# Phase 4.2 구현 계획 v3 — ID foundation 우선, URI 는 derive, 이동·분류·listener 는 그 위에

> 작성: 2026-04-22 (v3, codex 2차 검증 반영) / 대상: `plan/phase-4-todo.md` §4.2.1 · §4.2.2 + §4.1.1.9 두 번째 체크박스.
> **핵심 원칙**: 저장하는 것은 `source_id` + `vault_path` 만. URI 는 render/open 시점에 **derive** (Obsidian `obsidian://open?...` or `file://...`). 이동·분류·listener 는 모두 이 foundation 위에 얹는다.
> **v2→v3 변경 동기**: codex 리뷰에서 `wikey://vault/...` 커스텀 scheme 이 Obsidian `registerObsidianProtocolHandler` 로 **작동하지 않음** + 번들 id 가 vault-relative path 기반이면 이동 시 id 변경(불변 key 파괴) 지적. 전면 재설계.

---

## 0. 사용자 제약 (2026-04-22)

**원본 ↔ sidecar md pair 불변 이동**.

> 원본(`.pdf`, `.xls[x]`, `.hwp[x]`, `.doc[x]`, `.ppt[x]`)이 docling/unhwp 으로 변환되어 `<원본>.<ext>.md` sidecar 가 생긴 경우, 시스템 자동 이동 시 반드시 pair 로 함께 움직인다. 사용자 수동 이동은 예외.

시스템 이동 경로: (1) 인제스트 후 auto-classify, (2) Audit "Apply" 이동, (3) bash `classify-inbox.sh --move`, (4) vault `on('rename')` 동행, (5) plugin **startup reconciliation** (bash/외부 이동 누락분 복구).

---

## 1. 의존성 그래프

```
Stage 1. ID & vault_path foundation        Stage 2. Pair move + frontmatter rewrite        Stage 3. 분류 정제            Stage 4. Listener + reconciliation
───────────────────────────────────        ──────────────────────────────────────          ────────────────────          ──────────────────────────────────
source-id.ts (hash, bundle)  ─┐            movePair (registry 경유)                ──┐     classify 4차 prompt           vault.on('rename') + guard
                              ├─> source-registry.ts ─>│                             ├─>  classify 저가 모델 키          vault.on('delete') + tombstone
frontmatter 스키마 (id+path) ─┘            rewriteSourcePageMeta (post-move)     ──┤      Audit "Re-classify" UI         startup reconciliation scan
                                           bash --move + registry-update.mjs    ──┘      CLASSIFY.md 피드백             §4.1.1.9 [ ] 해소
                                           plugin 호출처 통합
```

- **Stage 1 에서 URI 저장 안 함** — 저장은 ID + vault_path. URI 는 open/render 시점 derive.
- **Stage 2 는 movePair + frontmatter rewrite 가 한 단위** — codex High #3 지적 반영.
- **Stage 4 는 listener + startup reconciliation** — codex High #4 지적 반영 (bash 등 외부 이동 유실 복구).

---

## 2. Stage 1 — ID & `vault_path` Foundation

### 2.1 `source_id` (불변 primary key)

| 대상 | 형식 | 근거 |
|------|------|------|
| 일반 파일 | `sha256:<16 hex prefix>` + **full 64 hex hash 병행 저장** | 개인 위키 scale (<10^6). prefix 매칭 시 full-hash verification 필수 (codex Medium #5) |
| 폴더 번들 | `sha256:<16 hex prefix>` | 입력 = 내부 **bundle-relative** `(sorted path, sha256(bytes))` 페어 정렬 → 개행 직렬화 → 재해싱. vault-relative X. 이동 무관 불변 (codex Critical #2 반영) |
| 외부 URI | `uri-hash:<16 hex prefix>` | URI 문자열 자체 해싱. Phase 4 에선 pass-through. |
| Sidecar | **id 없음** | 원본 종속. registry `sidecar_vault_path` 로만 관리 |

**Prefix collision 정책**: registry lookup 은 항상 prefix → full-hash verify 2단계. prefix 충돌 발견 시 warn + full-hash 로 구분. upsert 시 동일 full-hash 면 재사용, 다르면 `sha256:<24hex>` 로 확장 (rare).

### 2.2 URI 는 **저장하지 않고 derive 한다** (v3 핵심 변경)

> codex Critical #1: `wikey://vault/...` 는 Obsidian `registerObsidianProtocolHandler` 가 `obsidian://<action>?...` 만 받으므로 작동 안 함. 커스텀 scheme 폐기.

**저장 필드** (frontmatter + registry):
- `source_id: sha256:<16hex>` — 불변 key
- `vault_path: raw/3_resources/30_manual/500_natural_science/PMS_제품소개_R10_20220815.pdf` — 현재 상대경로 (이동 시 갱신)
- `sidecar_vault_path: …/PMS_….pdf.md` — sidecar 존재 시만
- `hash: <64hex>` — full sha256, 무결성 검증
- `size: 3634821`
- `first_seen: 2026-04-22T12:00:00Z`

**Derive 함수** (render/open 시점 전용, `wikey-core/src/uri.ts`):

```typescript
// Obsidian 내부 링크 (플러그인 UI, 위키 페이지 임베드)
buildObsidianOpenUri(vaultName: string, vaultPath: string): string
// → 'obsidian://open?vault=Wikey&file=raw%2F...%2FPMS_....pdf'

// OS 파일 open (외부 앱, Finder Reveal)
buildFileUri(absPath: string): string
// → 'file:///Users/denny/Project/wikey/raw/.../PMS_....pdf'

// Display (UI 툴팁, 로그) — encoding 안 함, 한국어 원문 유지
formatDisplayPath(vaultPath: string): string
// → 'raw/3_resources/30_manual/500_natural_science/PMS_제품소개_R10_20220815.pdf'
```

저장된 값에는 URI 가 없다. `vault_path` 는 POSIX forward-slash, **percent-encoding 없이** 원문 한국어·공백 유지.

### 2.3 `wiki/sources/<slug>.md` 프론트매터 (신규 포맷)

```yaml
---
source_id: sha256:a3f2b19c4e8d0f72
vault_path: raw/3_resources/30_manual/500_natural_science/PMS_제품소개_R10_20220815.pdf
sidecar_vault_path: raw/3_resources/30_manual/500_natural_science/PMS_제품소개_R10_20220815.pdf.md
hash: a3f2b19c4e8d0f72c9d1e5f6...  # full 64 hex
size: 3634821
first_seen: 2026-04-22T12:00:00Z
# 호환 필드 (경로 기반 API deprecation 후 제거 — Phase 5)
raw_original_path: raw/3_resources/30_manual/500_natural_science/PMS_제품소개_R10_20220815.pdf
---
```

현재 `wiki/sources/` 비어있음(확인됨) → 기존 파일 마이그레이션 불필요. 신규 writes 부터 이 포맷.

### 2.4 `.wikey/source-registry.json` 스키마

```json
{
  "sha256:a3f2b19c4e8d0f72": {
    "vault_path": "raw/3_resources/30_manual/500_natural_science/PMS_제품소개_R10_20220815.pdf",
    "sidecar_vault_path": "raw/3_resources/30_manual/500_natural_science/PMS_제품소개_R10_20220815.pdf.md",
    "hash": "a3f2b19c4e8d0f72c9d1e5f6...",
    "size": 3634821,
    "first_seen": "2026-04-22T12:00:00Z",
    "ingested_pages": ["wiki/sources/source-pms-r10.md"],
    "path_history": [
      { "vault_path": "raw/0_inbox/PMS_제품소개_R10_20220815.pdf", "at": "2026-04-22T11:50:00Z" },
      { "vault_path": "raw/3_resources/30_manual/500_natural_science/PMS_제품소개_R10_20220815.pdf", "at": "2026-04-22T12:00:00Z" }
    ],
    "tombstone": false
  }
}
```

- key = `source_id`.
- `vault_path`/`sidecar_vault_path` 는 파생 — 이동 시 갱신.
- `path_history[]` append-only.

### 2.5 Stage 1 Task

| # | Task | 파일 | 증거 |
|---|------|------|------|
| S1-1 | `wikey-core/src/uri.ts` — `computeFileId(bytes)`, `computeBundleId(entries[])` (bundle-relative path 기반), `computeExternalId(uri)`, `buildObsidianOpenUri`, `buildFileUri`, `formatDisplayPath`, `verifyFullHash(prefix, full, bytes)` | 신규 | vitest 12: 한국어, sidecar 파생, 번들 이동 후 동일 id, prefix 충돌 escalation, bundle 입력 순서 독립성 |
| S1-2 | `wikey-core/src/source-registry.ts` — CRUD + `findByIdPrefix` (full-hash verify 내장), `findByPath`, `findByHash`, `upsert`, `recordMove(id, newVaultPath, newSidecarPath?)`, `recordDelete`, `restoreTombstone`, `reconcile(walker)` (startup scan) | 신규 | vitest 10: CRUD, path_history, tombstone, prefix collision escalation, reconcile 누락 파일 복구 |
| S1-3 | `ingest-pipeline.ts` + `wiki-ops.ts` — source 페이지 frontmatter 를 §2.3 포맷으로 작성. **registry 기록은 ingest 직후 + 이동 전** (이동 후 frontmatter rewrite 는 Stage 2 에서) | `ingest-pipeline.ts`, `wiki-ops.ts` | vitest +3: id/vault_path/hash 정합, 동일 content 재인제스트 → 기존 레코드 재사용 |
| S1-4 | `scripts/migrate-ingest-map.mjs` — `.ingest-map.json` 존재 시 경로 키 → hash 재계산 → registry. 파일 부재 시 tombstone + warn. **inventory 에 `scripts/measure-determinism.sh` 도 포함** (codex Medium #7): migration 후 해당 스크립트의 `.ingest-map.json` 경로 제거 | 신규 + `measure-determinism.sh` patch | `--dry-run` + no-op smoke + measure-determinism 에서 ingest-map 참조 grep 0건 |

**Stage 1 gate**: `npm run build && npm test` green, registry 파일 존재 시 full-hash 확인, `grep -r "\.ingest-map" scripts/` 결과 0.

---

## 3. Stage 2 — Pair Move + Frontmatter Rewrite

### 3.1 핵심 설계 변화 (v2 대비)

- **movePair 와 rewriteSourcePageMeta 가 한 단위**. movePair 호출 직후 해당 id 의 `ingested_pages[]` 를 순회하며 frontmatter `vault_path`/`sidecar_vault_path` 재기록 (codex High #3).
- **bash --move 는 registry 를 직접 갱신** (node CLI `scripts/registry-update.mjs`). Obsidian 오프라인에서도 즉시 반영 (codex High #4).

### 3.2 movePair 시그니처

```typescript
export interface MovePairResult {
  readonly movedOriginal: boolean
  readonly movedSidecar: boolean
  readonly sidecarSkipReason?: 'not-found' | 'dest-conflict' | 'is-md-original'
  readonly sourceId?: string
  readonly rewrittenSourcePages: string[]  // frontmatter 갱신된 wiki/sources/*.md 경로
}

export async function movePair(opts: {
  basePath: string
  sourceVaultPath: string
  destDir: string              // vault-relative, trailing /
  registry: SourceRegistry
  wikiFS: WikiFS               // frontmatter rewrite 에 필요
}): Promise<MovePairResult>
```

내부 절차:
1. registry.findByPath(sourceVaultPath) → id 확보 (없으면 filesystem convention fallback + 신규 upsert).
2. renameSync 원본 → `recordMove`.
3. sidecar_vault_path 존재하면 renameSync sidecar → registry sidecar 필드 갱신.
4. registry.ingested_pages[] 순회 → 각 source 페이지 frontmatter `vault_path`/`sidecar_vault_path` 재기록 (yaml library 로 파싱/rebuild).
5. 결과 반환.

### 3.3 Stage 2 Task

| # | Task | 파일 | 증거 |
|---|------|------|------|
| S2-1 | `wikey-core/src/classify.ts` — `movePair` async export (기존 `moveFile` 은 deprecated wrapper). | `classify.ts` | vitest 8: pair 정상, sidecar 없음, md 원본, dest 충돌, legacy 무registry, 폴더 번들, **post-move frontmatter rewrite 정합**, **여러 source 페이지 동시 rewrite** |
| S2-2 | `wikey-core/src/wiki-ops.ts` — `rewriteSourcePageMeta(pagePath, {vault_path, sidecar_vault_path?})` YAML safe-edit 유틸 | `wiki-ops.ts` | vitest 4: 기존 frontmatter 보존(다른 필드 unaffected), sidecar 필드 add/remove, 잘못된 YAML 복구, 한국어 값 idempotent |
| S2-3 | 플러그인 `commands.ts` `autoMoveFromInbox` 분기 → `movePair` 전환. `.ingest-map.json` 갱신 코드 제거 (registry 가 대체) | `wikey-obsidian/src/commands.ts` | 수동 smoke: inbox → PARA 이동 후 registry 갱신 + frontmatter 정합 |
| S2-4 | 플러그인 `sidebar-chat.ts` Audit Apply → `movePair` 전환 | `sidebar-chat.ts` | 수동 UI smoke |
| S2-5 | `scripts/registry-update.mjs` — CLI. `--record-move <id-or-path> <new-vault-path>`, `--record-delete <id-or-path>`, `--find-by-path <path>`. node 로 실행, JSON atomic write | 신규 | bash smoke: `--record-move` 후 `--find-by-path` round-trip |
| S2-6 | `scripts/classify-inbox.sh --move` — pair 감지 후 `mv` 2회 + `node scripts/registry-update.mjs --record-move` 호출. 실패 시 rollback (원본 이동 전에 registry 갱신 해보고 실패하면 mv 생략) | `scripts/classify-inbox.sh` | smoke: `--move` 후 `cat .wikey/source-registry.json` 으로 갱신 확인 |
| S2-7 | `scripts/lib/classify-hint.sh` — sidecar 존재 시 힌트에 `(+ sidecar)` 표시 | `scripts/lib/classify-hint.sh` | bash smoke |

**Stage 2 gate**:
- `raw/0_inbox/` 3쌍 Apply → `find raw/3_resources -name "*.pdf" | wc -l` == `-name "*.pdf.md" | wc -l` (동수).
- registry JSON 에 3 entries, 각각 `vault_path` 최종 위치.
- `wiki/sources/source-*.md` frontmatter `vault_path` 가 registry 와 일치.
- bash `--move` 후 registry 즉시 갱신 (Obsidian 미실행 상태).

커밋 후보: Stage 1 + Stage 2 묶어서 `feat(phase-4.2): source-registry + pair move + frontmatter rewrite`.

---

## 4. Stage 3 — 분류 정제 (LLM 3/4차, 모델 키, UI, 피드백)

URI/registry 와 독립. Stage 2 뒤 자연스러움.

| # | Task | 파일 | 증거 |
|---|------|------|------|
| S3-1 | `classifyWithLLM` 프롬프트 — 4차 제품 slug 힌트 강화 ("기존 폴더 재사용 우선, 없으면 `NNN_topic` 규칙") | `classify.ts` | vitest 4: 기존/신규/fallback/파싱 실패 |
| S3-2 | `CLASSIFY_PROVIDER` / `CLASSIFY_MODEL` — `resolveProvider('classify', cfg)` 추가. 미지정 시 `ingest` 승계 | `config.ts`, `types.ts`, `wikey.conf` | vitest 2 |
| S3-3 | Audit 패널 "Re-classify with LLM" 토글 | `sidebar-chat.ts` | 수동 UI |
| S3-4 | CLASSIFY.md 피드백 append — 사용자가 dropdown 변경 시 "## 피드백 로그" 섹션에 line append | `sidebar-chat.ts` + 헬퍼 | 로그 파일 변화 |

커밋 후보: `feat(phase-4.2.1): LLM 3/4차 분류 + 모델 키 + 피드백 로그`.

---

## 5. Stage 4 — Vault Listener + Startup Reconciliation

> codex High #4 반영: bash/외부 이동 유실분을 plugin 기동 시 복구.

| # | Task | 파일 | 증거 |
|---|------|------|------|
| S4-1 | `main.ts` `vault.on('rename', (file, oldPath) => …)` — registry recordMove + pair 자동 동행. **debounce 200ms** + **double-move guard**: 방금 movePair 로 발생시킨 이벤트는 skip (move 직전 expectedRename 큐에 등록 → 일치 이벤트 시 소비) | `wikey-obsidian/src/main.ts` | 수동: Obsidian 에서 파일 이동 → registry + sidecar 동행 + frontmatter rewrite |
| S4-2 | `vault.on('delete')` — `recordDelete` + source 페이지에 "원본 삭제됨" callout | `main.ts`, `wiki-ops.ts` | 수동 |
| S4-3 | `main.ts` onload → `registry.reconcile(vault.getFiles())` — registry 의 `vault_path` 와 실제 fs 비교. 누락(이동됨) 은 hash 재계산으로 추적, 없어진 것은 tombstone. bash move 누락 복구 | `main.ts`, `source-registry.ts` | vitest + 수동: bash 로 이동 → Obsidian 재기동 → registry 갱신 확인 |
| S4-4 | Audit 파이프라인 hash 기반 판정 — `findByHash(hash) !== null && current vault_path !== registry vault_path` → 재인제스트 제외. 경로 기반 API deprecation warning | `scripts/audit-ingest.py`, `ingest-pipeline.ts` | audit run 로그에 "skipped: moved" 확인 |

커밋 후보: `feat(phase-4.2.2): vault listener + startup reconciliation + audit hash`.

---

## 6. 이번 세션 실행 순서

1. Stage 1 S1-1 → S1-2 → S1-3 → S1-4 (TDD).
2. Stage 2 S2-1 → S2-2 → S2-5 → S2-6/7 (bash pair + registry CLI) → S2-3/4 (plugin smoke).
3. Stage 1+2 통합 smoke — `raw/0_inbox/` 3쌍 Apply + registry + frontmatter 정합.
4. `npm run build && npm test` 증거 수집.
5. 여력 있으면 Stage 3 S3-1/2.
6. 문서 동기화 (result → todo → followups → memory).
7. 단일 커밋 + push.

Stage 4 는 별도 세션 (listener 회귀 포인트 많음).

---

## 7. 범위 밖 — Phase 5 이관

- Audit 경로 기반 API **완전 제거** (Stage 4 warning only) → §5.3.
- CLASSIFY.md `.meta.yaml` 외부 URI 패턴 (Confluence/SharePoint) → §5.7.
- LLM 피드백 few-shot 자동 재프롬프트 → §5.6.

---

## 7.5 TDD 계획

> rules.md §2 Testing (MANDATORY): RED → GREEN → REFACTOR. Unit/Integration/E2E 모두. 커버리지 80%+.
> rules.md §1 Evidence-Based: fresh `npm test` 출력 + exit 0. "should work" 금지.
> codex Medium #7 반영: 30 → **42+** 테스트로 확장, 통합 시나리오 강화.

### 7.5.1 테스트 파일 목록

| 파일 | 종류 | 테스트 수 |
|------|------|-----------|
| `__tests__/uri.test.ts` | 신규 unit | 12 |
| `__tests__/source-registry.test.ts` | 신규 unit | 10 |
| `__tests__/wiki-ops.test.ts` (rewriteSourcePageMeta) | 확장 +4 | +4 |
| `__tests__/ingest-pipeline.test.ts` | 확장 +3 | +3 |
| `__tests__/classify.test.ts` (movePair) | 확장 +8 | +8 |
| `__tests__/config.test.ts` | 확장 +2 | +2 |
| `__tests__/integration-pair-move.test.ts` | 신규 integration | 3 |
| `scripts/tests/pair-move.smoke.sh` | 신규 bash | 2 |

**총 신규**: **42** (vitest 39 + bash 2 + smoke 1 — 352 → 391 목표).

### 7.5.2 Stage 1 TDD (RED 순서)

**S1-1 `uri.ts`** (12):
1. `computeFileId(bytes)` → `'sha256:<16hex>'` 정규식 매칭.
2. 동일 content 다른 path → 동일 id.
3. `computeBundleId([{path:'a.txt', bytes}])` → 결정적 id.
4. 번들 이동 시나리오: 동일 내부 구조, 다른 vault 위치 → **동일 id** (codex Critical #2 핵심).
5. 번들 입력 순서 독립성.
6. `computeExternalId('https://x')` → `'uri-hash:<16hex>'`.
7. `buildObsidianOpenUri('Wikey', 'raw/x.pdf')` → `'obsidian://open?vault=Wikey&file=raw%2Fx.pdf'`.
8. `buildObsidianOpenUri` 한국어 경로 `encodeURIComponent` 적용.
9. `buildFileUri('/abs/path')` → `'file:///abs/path'`.
10. `formatDisplayPath` 원문 유지 (한국어).
11. `verifyFullHash(prefix, full, bytes)` 정상 / mismatch 두 케이스.
12. Sidecar suffix 헬퍼 (`<name>.pdf` → `<name>.pdf.md`).

**S1-2 `source-registry.ts`** (10):
1. 빈 파일 로드 → 빈 객체.
2. `upsert` + `findById`.
3. `findByIdPrefix` 단일 매칭.
4. `findByIdPrefix` prefix 충돌 시 full-hash verify → 올바른 레코드 반환 (codex Medium #5).
5. `recordMove(id, newPath)` → path_history +1, vault_path 갱신.
6. `recordMove` 에 sidecar 동반 → sidecar_vault_path 갱신.
7. `recordDelete` → tombstone true.
8. `restoreTombstone` → tombstone false.
9. `findByPath` 가 path_history 과거 경로도 매칭.
10. 손상 JSON → `.bak` + 빈 레지스트리 + warn 1회.

**S1-3 ingest-pipeline** (+3):
1. 인제스트 후 registry 레코드 1개.
2. frontmatter 에 §2.3 필드 모두 존재, URI 필드 없음.
3. 동일 content 재인제스트 → 기존 레코드 path_history append, 중복 소스 페이지 생성 안 됨.

**S1-4 migration** — smoke only (no-op 검증 + measure-determinism grep).

### 7.5.3 Stage 2 TDD

**S2-1 `movePair`** (8):
1. pair 정상 → 둘 다 이동, registry recordMove 호출.
2. sidecar 없음 (md 원본) → 원본만, `is-md-original`.
3. pair 중 sidecar 부재 → 원본만, `not-found`.
4. dest 충돌 → 원본만, `dest-conflict`, warn.
5. registry 없는 legacy → fs fallback.
6. 폴더 번들 → 통째로 이동, sidecar 개념 없음.
7. **post-move frontmatter rewrite**: ingested_pages 2개인 경우 둘 다 vault_path 갱신.
8. **multi-page 일관성**: rewrite 중 하나 실패 시 rollback (원자성).

**S2-2 `rewriteSourcePageMeta`** (4):
1. 다른 필드 보존 (`title`, `tags` 등 unaffected).
2. sidecar 필드 add (없던 것 추가).
3. sidecar 필드 remove (있던 것 삭제).
4. 한국어 값 idempotent — 2번 호출해도 파일 동일.

**S2-5/6 bash pair + registry CLI**:
- `pair-move.smoke.sh` (bash 2):
  1. `classify-inbox.sh --move a.pdf dst/` → `dst/a.pdf` + `dst/a.pdf.md` 존재 + registry vault_path 갱신.
  2. Obsidian 미실행 상태에서도 registry JSON 즉시 갱신 (codex High #4 regression guard).

**통합 integration** (3, `integration-pair-move.test.ts`):
1. E2E: ingest → movePair → frontmatter rewrite → registry 정합 전체 플로우.
2. 한 source 가 여러 ingested_pages 를 갖는 경우 이동 후 모두 정합.
3. startup reconciliation mock: bash 이동 후 `registry.reconcile(walker)` 로 복구.

### 7.5.4 Stage 3 TDD

**S3-1** (4): 기존 폴더 재사용, 신규 slug, 2차 fallback, 파싱 실패.
**S3-2** (2): 승계·오버라이드.

### 7.5.5 커버리지 & Evidence

- `uri.ts` / `source-registry.ts` / `classify.ts (movePair)` / `wiki-ops.ts (rewrite)` 라인 커버리지 80%+.
- 증거: `npm test` 출력 + smoke 로그 + registry JSON dump + `git diff --stat`.

### 7.5.6 실행 순서 (Stage 1/2, ~5h)

```
1. S1-1 uri.test.ts RED (12) → uri.ts GREEN → REFACTOR            [~60 min]
2. S1-2 source-registry.test.ts RED (10) → GREEN                 [~50 min]
3. S1-3 ingest-pipeline frontmatter +3 RED → GREEN               [~30 min]
4. S1-4 migration + measure-determinism.sh patch                  [~20 min]
5. Stage 1 `npm test` evidence                                    [~5 min]
6. S2-2 wiki-ops rewrite +4 RED → GREEN (S2-1 선행 유틸)          [~30 min]
7. S2-1 movePair +8 RED → GREEN                                   [~60 min]
8. S2-5 registry-update.mjs CLI                                    [~20 min]
9. S2-6/7 bash --move pair + hint + smoke.sh                      [~25 min]
10. S2-3/4 플러그인 통합 smoke                                    [~30 min]
11. integration-pair-move.test.ts +3                              [~30 min]
12. Stage 1+2 통합 smoke (raw/0_inbox/ 3쌍)                       [~15 min]
13. 최종 `npm run build && npm test`                              [~5 min]
14. 문서 동기화 + 커밋 + push                                    [~40 min]
```

---

## 8. 검증 기준 (Karpathy #4)

| 주장 | 증거 |
|------|------|
| ID/hash 스펙 | `uri.ts` vitest 12 green, prefix collision escalation 재현 |
| Registry CRUD + reconcile | `source-registry.ts` vitest 10 green |
| 번들 id 이동 안정 | S1-1 #4 테스트 green (vault 위치 독립) |
| 신규 frontmatter | ingest → §2.3 스키마 일치, URI 필드 없음 |
| movePair + rewrite | S2-1 #7 #8 green, 통합 smoke 3쌍 pair 이동 + frontmatter 일치 |
| bash immediate registry | `pair-move.smoke.sh` 2개 green (Obsidian 미실행 검증 포함) |
| 테스트 회귀 | 현재 352 → **391+**, 실패 0 |
| 빌드 | 0 errors (core + obsidian) |
| migration inventory | `grep -r "\.ingest-map" scripts/` 0, measure-determinism 패치 |

---

## 9. 리스크와 롤백

| 리스크 | 대응 |
|-------|------|
| 64-bit prefix 충돌 | full-hash verify 루틴 강제. 발견 시 prefix 24hex 로 확장 |
| registry write atomicity | temp file + rename (POSIX atomic). JSON parse 실패 시 `.bak` fallback |
| double-move (listener → movePair 재귀) | movePair 에서 expectedRename 큐 push → listener 에서 skip |
| bash 이동이 registry 누락 | `registry-update.mjs` 호출 실패 시 bash exit != 0, mv 는 이미 실행됨 → reconcile 이 다음 기동 시 복구 안전망 |
| Obsidian 미실행 중 여러 이동 누적 | startup reconciliation 이 walk 로 fs 스캔 + hash 매칭으로 복구 |
| frontmatter rewrite 실패 | rewriteSourcePageMeta 가 atomic write + 원자성 테스트 (S2-1 #8) |
| `scripts/measure-determinism.sh` 의존성 | migration 스크립트 inventory 에 포함, grep 0 확인 |
| 대용량 번들 해시 시간 | lazy: 번들 첫 ingest 시만 계산, registry 에 캐시. `size > 100MB` 경고 |

롤백: Stage 별 commit 분리. registry 파일은 Stage 1 commit 이후 생성 → revert 시 `rm .wikey/source-registry.json` + `.ingest-map.json` 복원.

---

## 10. codex 검증 반영 요약 (v2 → v3)

| codex finding | 반영 |
|---------------|------|
| Critical #1 `wikey://` scheme 작동 안 함 | URI 저장 폐기 → `source_id` + `vault_path` 만 저장, URI 는 `buildObsidianOpenUri`/`buildFileUri` 로 derive |
| Critical #2 번들 id 가 vault path 기반 | 번들 내부 relative path 기반 해싱 (§2.1, S1-1 #4 테스트) |
| High #3 frontmatter stale | `rewriteSourcePageMeta` 신규 (S2-2), movePair 가 후속 실행 (S2-1 #7/#8) |
| High #4 bash move registry 누락 | `scripts/registry-update.mjs` 즉시 갱신 + startup reconciliation 이중 안전망 (§3.3, S4-3) |
| Medium #5 64-bit prefix 충돌 | full-hash verify 루틴 + prefix 24hex escalation (S1-1 #11) |
| Medium #6 movePair↔URI 과결합 | movePair 는 `vault_path` 만 다룸. URI derive 는 render/open 시점 한정 |
| Medium #7 테스트 30→부족 | 42 로 확장 + integration-pair-move.test.ts 3개 + bash smoke 2개. measure-determinism inventory 포함 |
