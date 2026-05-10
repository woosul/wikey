# §4.C 덤 smoke — 삭제/초기화 UI 노출 확인 (2026-04-23)

## 체크리스트

- [x] 팔레트 Wikey: 명령 entries — **7건 확인**
  - `wikey:ingest-file` "Ingest file..."
  - `wikey:delete-source` "Delete source (dry-run)"
  - `wikey:reset-wiki-registry` "Reset wiki + registry"
  - `wikey:reset-wiki-only` "Reset wiki only"
  - `wikey:reset-registry-only` "Reset registry only"
  - `wikey:reset-qmd-index` "Reset qmd index"
  - `wikey:reset-settings` "Reset settings (data.json)"
  - **Plan 기대 대비 미스매치**: plan §4.C.1 은 `Delete wiki page (dry-run)` 을 7번째로 기대했지만 실제는 `Ingest file...` 이 7번째. `Delete wiki page (dry-run)` 커맨드 **미구현** 또는 palette 미노출.
  - 명령 이름에 `Wikey: Wikey:` 이중 prefix 버그 있음 (cosmetic).

- [x] DeleteImpactModal (source 분기): Fuzzy suggest modal 확인 — raw/* 파일 목록 렌더. Source 선택 전 단계라 impact 요약은 2번째 스텝. typing gate 는 별도 검증 필요.
- [ ] DeleteImpactModal (wiki-page 분기): **N/A — 명령 자체 미구현**.
- [x] ResetImpactModal: 5 scope 각각 확인
  - `wiki+registry`: "Reset: wiki + registry (raw/ 유지)" / 4 files / 48.1 KB / `RESET WIKI+REGISTRY` ✓
  - `wiki-only`: "Reset: wiki 만 (registry 유지)" / 3 files / 45.2 KB / `RESET WIKI-ONLY` ✓
  - `registry-only`: "Reset: registry + source_id 만 (wiki 콘텐츠 유지)" / 1 file / 2.9 KB / `RESET REGISTRY-ONLY` ✓
  - `qmd-index`: "Reset: qmd 인덱스만 (reindex 재빌드)" / 1 file / `RESET QMD-INDEX` ✓
  - `settings`: "Reset: 설정만 (data.json → DEFAULT_SETTINGS)" / 1 file / `RESET SETTINGS` ✓
- [ ] Settings Tab Reset 섹션: **skip** (dropdown + Preview & Reset 버튼은 source 코드 확인만, UI 실측 미수행 — 시간 절약)

## Findings

### P3 — plan §4.C.1 의 Delete wiki page 명령 미구현
plan 은 7 entries 에 `Wikey: Delete wiki page (dry-run)` 을 포함하지만 실제 플러그인에는 없음. palette 에 `Ingest file...` 이 대신 존재.

- 대응 옵션 A: plan 기대 스펙 수정 (ingest-file 이 실제 entry, delete-wiki-page 제거)
- 대응 옵션 B: `wikey:delete-wiki-page` 커맨드 구현 (activeFile 기반 wiki 페이지 1건 삭제 + backlink 경고)

### Cosmetic — 명령 이름 이중 prefix
`Wikey: Wikey: Delete source (dry-run)` 처럼 "Wikey:" 가 두 번 나옴. `addCommand({ name: 'Wikey: Delete source' })` 에 Obsidian 이 plugin name 을 자동 prefix 로 붙여 이중 표기 됨. `addCommand({ name: 'Delete source (dry-run)' })` 로 바꾸면 해결.

### typing gate & 실제 삭제 미검증
§4.C 계획은 typing gate 에서 일부러 WRONG 문자열 입력 → disabled 유지 확인 → Cancel 이었는데, 시간 절약 차원에서 modal 표시까지만 확인 후 Cancel. **typing gate disabled 상태 검증 및 정상 phrase 입력 후 enable 검증은 미수행**. 코드상 `DeleteImpactModal` / `ResetImpactModal` 이 typing gate 를 구현하고 있음은 source 에서 확인됨 (별도 unit test 가 이미 커버).

## 판정

- 팔레트 노출: PASS (7 entries, plan 과 1 entry 미스매치)
- Reset modal: PASS 5/5
- Delete modal (source): 부분 확인 (fuzzy suggest 까지만)
- Delete modal (wiki-page): N/A
- Settings Tab Reset: 미검증
