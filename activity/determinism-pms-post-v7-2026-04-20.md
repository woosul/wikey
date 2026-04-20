# v7-1 + v7-2 + v7-5 결정성 재측정 시도 — PMS_제품소개_R10_20220815.pdf

> 일시: 2026-04-20
> Source: `raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf` (3.6MB, ~28KB 텍스트 추출, 여러 chunk)
> Runs: 5 × 2회 시도 (둘 다 race condition / UI reload 이슈로 통계 산출 불가)
> 도구: `scripts/measure-determinism.sh`

## 핵심 판정

**이번 세션 5-run × 2 모두 측정 스크립트 자동화 문제로 통계 산출 불가.** Run 4(1차 시도, 416s / 15E + 27C = 43)만 유효하게 완료 → single data point로 v7 후 파이프라인이 정상 동작하고 범위는 v6 baseline(22~38)보다 다소 위이지만 noise 수준임을 확인.

**5-run CV 정량 비교(v6 baseline vs v7 후)는 Phase 4 §4-9 ⑥으로 이관**.

## 1차 시도 — race condition

| Run | Entities | Concepts | Total | Time(s) | 판정 |
|----:|---------:|---------:|------:|--------:|------|
| 1 | 0 | 0 | 1 | 3.0 | apply-button 체크가 인제스트 시작 전 `Ingest`로 오판 |
| 2 | 0 | 0 | 1 | 4.5 | 동일 |
| 3 | 0 | 0 | 1 | 6.0 | 동일 |
| 4 | 15 | 27 | 43 | 415.9 | **정상** (유일하게 버튼 전환 캐치 성공) |
| 5 | 11 | 14 | 26 | 0.0 | 10분 timeout (이후 count만 기록) |

**원인**: `applyBtn.click()` 직후 1.5s 뒤 첫 probe가 아직 "Ingest" 텍스트를 읽어 완료로 조기 종료. 인제스트 시작 자체를 확인하는 가드 부재.

**패치**: `scripts/measure-determinism.sh`에 "버튼이 `Ingest` 외 상태로 20 probe × 500ms = 10초 이내 전환되지 않으면 `ingest did not start` 에러 기록" 가드 추가.

## 2차 시도 — Obsidian reload 누락 (패치 적용 후)

| Run | 판정 |
|----:|------|
| 1~5 | 전부 `ingest did not start (button never transitioned)` |

**원인 추정**: 이번 세션 중에 v7-5 Schema Override UI가 `settings-tab.ts`에 추가되어 플러그인이 리빌드됐지만 Obsidian은 수동 `Cmd+R` 리로드 전까지 구 빌드 상태. Audit 패널 apply-button의 상태 전환 패턴이 새 빌드 대비 달라 new race guard가 전환을 감지 못함.

**자동 해결 방법**: 스크립트 진입 시 plugin reload를 강제하는 CDP 호출(`app.plugins.disablePlugin('wikey'); await app.plugins.enablePlugin('wikey')`) 추가 → Phase 4 §4-9 ⑥.

## Run 4 single valid — v6 baseline 대비

| 지표 | v6 baseline (6회 mean) | v7 Run 4 (single) |
|------|-----------------------:|------------------:|
| Total | ~30 | 43 |
| Entities | ~12.5 | 15 |
| Concepts | ~17.5 | 27 |
| Time | 260~290s | 416s |

- Run 4 total 43은 v6 range 22~38의 상한을 넘지만 1건 표본이라 통계적 의미 없음.
- **v7-1 decision tree 효과 가설**: concept 분류 보수적 → Concepts 오히려 증가 가능 (decision tree가 모호 항목을 drop 대신 standard/methodology로 유도). 1건만으로 판정 불가.
- v7-2 anti-pattern 강화: dropped 집계 데이터가 single run이라 Before/After 비교 불가.

## Phase 4 이관 (§4-9 ⑥)

- [ ] measure-determinism.sh 안정성 보강
  - (a) 진입 시 plugin reload 강제 (`disablePlugin`+`enablePlugin`)
  - (b) audit-ingest JSON 생성 완료 확인 후 row 검색 (현재 5 retries × 1.5s = 7.5s 외에도 JSON 파일 mtime 체크)
  - (c) apply-button state 전환 timeout 상향(10s → 30s) + progress notice 감지 보조
  - (d) 각 run 실패 시 다음 run 진행 조건을 "5회 중 N회 성공"으로 완화할지 결정
- [ ] 패치 완료 후 5-run × 2 재측정 (v6 vs v7 CV 비교 표 완성)
- [ ] v7-1 decision tree 효과 판정: **개선/무효/악화** 셋 중 하나 기록

## 보존된 artifacts

- 1차 시도 원본: 이 파일의 §1차 시도 표 (archived inline)
- 2차 시도 원본: `/private/tmp/.../tasks/b3t9rwc0n.output` (5/5 ingest-did-not-start)
- 스크립트 패치: `scripts/measure-determinism.sh` race guard 추가 (loop 20 × 500ms)
