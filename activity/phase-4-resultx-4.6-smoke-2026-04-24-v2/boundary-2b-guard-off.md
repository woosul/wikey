# Boundary 2b — Guard OFF

> **상위 문서**: [`README.md`](./README.md) — Phase 4 smoke 최종 집계

## 목적
`piiGuardEnabled=false` 로 설정 시:
- PII detect/redact **skip**
- sidecar `.md` 에 raw BRN 그대로 유지 (user-trust boundary)
- ingest 자체는 진행 (공시용 등 사용자가 의도적으로 PII 공개 시나리오)

## 환경
- settings: `{ piiGuardEnabled: false, allowPiiIngest: false }` (Guard OFF 가 우선 — Allow OFF 여부 무관)
- 대상 파일: `raw/0_inbox/사업자등록증C_(주)굿스트림_***-**-*****(2015).pdf` (registry/wiki 초기화 후 fresh ingest)
- 진입: Ingest 패널 (Pass A handler)

## 실행 결과

### 로그 (핵심)
```
[info] [Wikey ingest] start: raw/0_inbox/사업자등록증C_(주)굿스트림_***-**-*****(2015).pdf
[info] [Wikey ingest][pdf-extract] cache hit — pdf:1-docling (453 chars)
[info] [Wikey ingest] PII guard disabled — skipping detect/redact (user-trust boundary, not a technical safety boundary)
[info] [Wikey ingest] sidecar .md saved → raw/0_inbox/...pdf.md (453 chars)
[info] [Wikey ingest] source: 453 chars, route=FULL, sections=2, provider=gemini, model=gemini-2.5-flash
[info] [Wikey ingest] canonicalize done — entities=3, concepts=2, dropped=3
[info] [Wikey ingest] pages written — created=6, updated=0
[info] [Wikey] post-ingest movePair: raw/0_inbox/... → raw/3_resources/20_report/300_social_sciences/ sidecar=true
```

**핵심 로그**: `PII guard disabled — skipping detect/redact (user-trust boundary, not a technical safety boundary)` ✅ (코드의 명시적 branch)

### 사이드카 검증
```bash
$ grep -cE '[0-9]{3}-[0-9]{2}-[0-9]{5}' raw/3_resources/20_report/300_social_sciences/사업자등록증*.pdf.md
1
$ grep -nE '[0-9]{3}-[0-9]{2}-[0-9]{5}' raw/.../사업자등록증*.pdf.md
9:등록번호 : ***-**-*****
```
**결과**: 1 raw BRN hit — redact 우회 확증 ✅

```bash
$ grep -c '\*\*\*' raw/.../사업자등록증*.pdf.md
0
```
**결과**: 0 mask chars — Guard OFF 시 redact skip ✅

## 판정

**PASS** — 명세 완전 충족:

| 기준 | 기대 | 실측 | 판정 |
|------|------|------|------|
| Guard bypass 로그 | `PII guard disabled — skipping detect/redact` | 동일 | ✅ |
| sidecar raw BRN | 보존 (redact 미적용) | 1 hit (line 9) | ✅ |
| sidecar mask chars | 없음 | 0 | ✅ |
| wiki 페이지 생성 | 정상 진행 | 6 pages created | ✅ |
| Guard 차단 Notice | 없음 | 없음 (Guard OFF 이므로 차단하지 않음) | ✅ |

## 결론

D.0 Critical Fix Plan v6 §4.5 의 2-layer gate 에서 `piiGuardEnabled=false` = **user-trust boundary bypass** 동작 확증. "공시용" 사용자 시나리오 (PII 있는 문서를 의도적으로 전파) 지원. 로그 메시지에 "technical safety boundary 가 아님" 명시 — 문서화·감사용 UI 신호 기대대로.
