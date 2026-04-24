# D.0.m — PDF Sidecar Redact Grep 증거

> **상위 문서**: [`README.md`](./README.md) — Phase 4 smoke 최종 집계

## 목적
D.0 Critical Fix Plan v6 §4.1~§4.5 에서 구현한 PII redact (2-layer gate: `piiGuardEnabled` + `allowPiiIngest`, mask mode 기본) 가 **sidecar `.md`** 에 실제로 적용되는지 grep 기반 검증.

## 환경
- `piiGuardEnabled=true` (기본값, detection 활성)
- `allowPiiIngest=true` (PII PDF 통과 허용 — mask 로 redact)
- mode: `mask` (masked characters = `*`)

## 명령 & 결과

### Pass A — 사업자등록증 (file 2)
```bash
$ grep -n '\*\*\*' raw/3_resources/20_report/300_social_sciences/사업자등록증C_\(주\)굿스트림_***-**-*****\(2015\).pdf.md
9:등록번호 : ***-**-*****
19:개 업 년 월 일 : 2012년 10월 02일 법인등록번호 : ******-*******
```
**결과**: 2 hits (BRN + 법인등록번호 masked). ✅

```bash
$ grep -cE '[0-9]{3}-[0-9]{2}-[0-9]{5}' raw/.../사업자등록증*.pdf.md
0
```
**결과**: 0 raw BRN. ✅

### Pass A — SK바이오텍 계약서 (file 3)
```bash
$ grep -n '\*\*\*' raw/3_resources/20_report/300_social_sciences/C20260410_용역계약서*.pdf.md
(Pass A file teardown — 중간 재설정 시 제거됨, Pass B 에서 재확인)
```

### Pass B — 사업자등록증 (file 2)
```bash
$ grep -n '\*\*\*' raw/3_resources/20_report/300_social_sciences/사업자등록증*.pdf.md
9:등록번호 : ***-**-*****
19:개 업 년 월 일 : 2012년 10월 02일 법인등록번호 : ******-*******
```
**결과**: 2 hits ✅ (Pass A 와 완전 동일 — decoder 결정적 일치)

```bash
$ grep -cE '[0-9]{3}-[0-9]{2}-[0-9]{5}' raw/.../사업자등록증*.pdf.md
0
```
**결과**: 0 raw BRN ✅

### Pass B — SK바이오텍 계약서 (file 3)
```bash
$ grep -n '\*\*\*' raw/3_resources/20_report/300_social_sciences/C20260410*.pdf.md
19:| 도급인   | 사업자번호 | ***-**-*****                           |
23:| 수급인   | 사업자번호 | ***-**-*****                           |
```
**결과**: 2 hits ✅ (세포아 + 굿스트림 BRN 모두 masked)

```bash
$ grep -cE '[0-9]{3}-[0-9]{2}-[0-9]{5}' raw/.../C20260410*.pdf.md
0
```
**결과**: 0 raw BRN ✅

## 결론

**sidecar redact (BRN `\d{3}-\d{2}-\d{5}` + 법인등록번호 `\d{6}-\d{7}`) ACCEPT**:
- 양 pass 모두 `PII redacted — 2 match, mode=mask` 로그 + grep 증거 일치
- 결정적 일치 (Pass A ≡ Pass B)
- `piiGuardEnabled=true` + `allowPiiIngest=true` 일 때 mask mode 정상 작동

## 미커버 (Phase 5 이관)

다음 PII 패턴은 현재 redact 범위 밖이며 `wiki/` 전파 발생:

| 패턴 | 현황 | Phase 5 위임 |
|------|------|--------------|
| CEO 성명 (`*****` / `이 희 림`) | sidecar + wiki entity 페이지로 전파 | §5.4: `entity_type=person` + PII-high source drop, CEO regex 공백 변형 확장 |
| 주소 (도로명) | sidecar + wiki source body 에 전파 | §5.4: ADDR redaction 추가 |
| filename BRN | sidecar path + wiki frontmatter `vault_path` 에 raw BRN | §5.4: filename sanitize (aliasing) |
| LLM filename metadata leak | Pass A 에서 LLM 이 filename 에서 BRN 재구성 후 source body 에 삽입 (Pass B 에선 variance) | §5.4: LLM prompt 에 filename 전달 시 BRN 마스킹 |
