# Boundary 3b — Allow OFF (Guard ON)

> **상위 문서**: [`README.md`](./README.md) — Phase 4 smoke 최종 집계

## 목적
`piiGuardEnabled=true` + `allowPiiIngest=false` 조합에서 PII 문서 ingest 시도 시:
- 반드시 **차단** (PiiIngestBlockedError 또는 동등한 차단 Notice)
- wiki 페이지 생성 **없음**
- raw 파일 inbox 유지

## 환경
- settings: `{ piiGuardEnabled: true, allowPiiIngest: false }`
- 대상 파일: `raw/0_inbox/사업자등록증C_(주)굿스트림_***-**-*****(2015).pdf` (재배치 후)
- 진입 경로: Ingest 패널 (Pass A handler)

## 실행 결과

### Notice (UI)
```
1. PII 감지 — 2건 (brn, corp-rn). 설정에서 "PII 감지 시 인제스트 진행" 을 켜거나 원본을 정리해 주세요.
2. Done 0 / Failed 1
```

### 로그
```
[warn] [Wikey ingest] blocked by PII gate: raw/0_inbox/사업자등록증C_(주)굿스트림_***-**-*****(2015).pdf — 2 matches
```

### 파일 상태 (after block)
- `raw/0_inbox/사업자등록증*.pdf`: **잔류** (inbox 유지) ✅
- `wiki/entities/ + wiki/concepts/` 총합: 이전 Pass B 종료시점 55 → **여전히 55** (증가 없음) ✅
- registry: 변화 없음 ✅

## 판정

**PASS** — 명세 완전 충족:

| 기준 | 기대 | 실측 | 판정 |
|------|------|------|------|
| Guard 차단 Notice | 표시 | "PII 감지 — 2건 (brn, corp-rn)..." | ✅ |
| Batch Notice | "Done 0 / Failed 1" | 동일 | ✅ |
| 로그 | `blocked by PII gate` | 동일 | ✅ |
| wiki 페이지 생성 | 없음 | 페이지 수 변화 없음 | ✅ |
| raw 파일 | inbox 유지 | 그대로 | ✅ |

## 결론

D.0 Critical Fix Plan v6 §4.5 의 2-layer gate (C안) 명세대로 **Guard ON + Allow OFF = 강한 차단** 동작 확증. Phase 4 본체 완성 블로커 없음.
