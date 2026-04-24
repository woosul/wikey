# §4.C — 팔레트·모달 덤 smoke

> **상위 문서**: [`README.md`](./README.md) — Phase 4 smoke 최종 집계

## 목적
Phase 4.5.2 의 운영 안전 장치 (삭제 / 초기화) UI 가 팔레트에 7 entries 로 노출되고, 각 modal 이 typing gate 직전까지 정상 동작하는지 확인. **파괴 실행은 skip**.

## 4.C.1 팔레트 노출 확인

팔레트 `Cmd+P` 대신 `app.commands.commands` 직접 조회:

```js
Object.keys(window.app.commands.commands).filter(id => id.startsWith('wikey:'))
```

### 결과 (9 entries — 7 delete/reset + 2 ingest)

| ID | Name |
|----|------|
| `wikey:ingest-current-note` | Wikey: Ingest current note |
| `wikey:ingest-file` | Wikey: Ingest file... |
| `wikey:delete-source` | Wikey: Delete source (dry-run) |
| `wikey:delete-wiki-page` | Wikey: Delete wiki page (dry-run) |
| `wikey:reset-wiki-registry` | Wikey: Reset wiki + registry |
| `wikey:reset-wiki-only` | Wikey: Reset wiki only |
| `wikey:reset-registry-only` | Wikey: Reset registry only |
| `wikey:reset-qmd-index` | Wikey: Reset qmd index |
| `wikey:reset-settings` | Wikey: Reset settings (data.json) |

**§4.5.2 기대 7 entries ALL 확인** ✅ (delete 2 + reset 5)

### 참고 — 이름 접두어 중복 버그 (Info, not blocker)
`Wikey: Wikey: Delete source (dry-run)` 처럼 이름 앞에 `Wikey: Wikey:` 로 한 번 더 나옴. Obsidian 자체가 플러그인 manifest 의 `name` ("Wikey") 를 자동 prefix 하는데, `registerCommand` 에서도 수동으로 `Wikey: ` 를 prefix 하기 때문. 기능 영향 없음 (커맨드 ID 는 정상) — Phase 5 UX polish 후보.

## 4.C.2 DeleteImpactModal (source) 검증

### 실행 순서
1. `app.commands.executeCommandById('wikey:delete-source')` → FuzzySuggestModal 표시
2. `.suggestion-item.is-selected` (첫 항목 `raw/_delayed/현대오피스_제단기_hc-700.pdf`) click
3. DeleteImpactModal 표시

### 확인 사항
- **모달 본문**: `"Delete source: raw/_delayed/현대오피스_제단기_hc-700.pdf"` ✅
- **영향 요약**: `"영향 페이지 0건 / registry 레코드 0건 / backlink 0건"` ✅ (_delayed 파일이므로 0)
- **typing gate placeholder**: `"확인하려면 아래에 정확히 \"DEL unknown\" 를 입력하세요."` (registry 미등록이라 id=`unknown`) ✅
- **Confirm delete 버튼**: `disabled=true` (입력 전) ✅
- **Cancel 버튼**: 존재 ✅

### 잘못된 문자열 입력 테스트
1. Input 에 `WRONG` 입력
2. Confirm delete 버튼 → 여전히 `disabled=true` ✅ (typing gate 동작)
3. Cancel 클릭 → 모달 닫힘 ✅

## 4.C.3 ResetImpactModal (wiki + registry) 검증

### 실행
`app.commands.executeCommandById('wikey:reset-wiki-registry')`

### 확인
- **모달 헤더**: `"Reset: wiki + registry (raw/ 유지)"` ✅ (Korean scope label — `docs/rules-archive/` 와 정합)
- **Impact**: `"파일 4건 / 59.5 KB 영향"` ✅
- **파일 목록**:
  - `wiki/index.md`
  - `wiki/log.md`
  - `wiki/overview.md`
  - `.wikey/source-registry.json`
  ✅ (≤ 30 파일 명세 부합)
- **typing gate placeholder**: `"확인하려면 \"RESET WIKI+REGISTRY\" 를 정확히 입력하세요."` ✅
- **Confirm reset 버튼**: `disabled=true` ✅

Cancel 후 모달 닫힘.

## 4.C 체크리스트

- [x] 팔레트 7 entries 노출 (delete 2 + reset 5)
- [x] DeleteImpactModal: source 경로 + impact 요약 + 페이지 목록 + typing gate disabled
- [x] ResetImpactModal: 한글 scope 라벨 + bytes + RESET <SCOPE> phrase + 파일 목록
- [x] 잘못된 문자열 입력 시 Confirm 여전히 disabled
- [x] Cancel → 모달 정상 종료

## 판정

**PASS** — Phase 4.5.2 운영 안전장치 UI 명세 완전 충족. 팔레트 7 entries + modal sequence + typing gate 모두 기대대로 동작. 파괴 실행은 skip (smoke 목표 = 노출 확인).
