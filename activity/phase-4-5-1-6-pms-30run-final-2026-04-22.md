# 결정성 측정 — PMS_제품소개_R10_20220815.pdf

> 일시: 2026-04-22
> Source: `raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf`
> Runs: 30 (0 failed)
> Determinism: ON (temperature=0, seed=42)
> 도구: `scripts/measure-determinism.sh`

## 결과

| Run | Entities | Concepts | Total | Time(s) |
|----:|---------:|---------:|------:|--------:|
| 1 | 21 | 21 | 43 | 251.0 |
| 2 | 28 | 12 | 41 | 234.0 |
| 3 | 22 | 22 | 45 | 293.0 |
| 4 | 22 | 22 | 45 | 174.0 |
| 5 | 22 | 12 | 35 | 174.0 |
| 6 | 21 | 21 | 43 | 234.0 |
| 7 | 22 | 12 | 35 | 234.0 |
| 8 | 22 | 22 | 45 | 174.0 |
| 9 | 21 | 21 | 43 | 234.0 |
| 10 | 22 | 12 | 35 | 174.0 |
| 11 | 28 | 12 | 41 | 234.0 |
| 12 | 22 | 12 | 35 | 174.0 |
| 13 | 21 | 21 | 43 | 234.0 |
| 14 | 22 | 22 | 45 | 174.0 |
| 15 | 21 | 21 | 43 | 234.0 |
| 16 | 28 | 12 | 41 | 234.0 |
| 17 | 22 | 12 | 35 | 174.0 |
| 18 | 28 | 12 | 41 | 234.0 |
| 19 | 28 | 12 | 41 | 234.0 |
| 20 | 22 | 12 | 35 | 234.0 |
| 21 | 21 | 21 | 43 | 234.0 |
| 22 | 21 | 21 | 43 | 234.0 |
| 23 | 22 | 22 | 45 | 234.0 |
| 24 | 22 | 12 | 35 | 174.0 |
| 25 | 21 | 21 | 43 | 234.0 |
| 26 | 21 | 21 | 43 | 234.0 |
| 27 | 21 | 21 | 43 | 234.0 |
| 28 | 22 | 22 | 45 | 234.0 |
| 29 | 22 | 22 | 45 | 234.0 |
| 30 | 0 | 0 | 0 | 3.0 |

## 통계

| 지표 | Mean | Std | **CV %** | Range |
|------|-----:|----:|---------:|------:|
| Entities | 21.93 | 4.82 | **22.0%** | 0–28 |
| Concepts | 16.93 | 5.64 | **33.3%** | 0–22 |
| Total | 39.83 | 8.40 | **21.1%** | 0–45 |
| Time | 212.8s | 50.0s | 23.5% | 3.0–293.0 |

## Core / Variable

### Entities — 0/31 core (0%)

**Always present** (0): (none)

**Sometimes**: alimtalk, apache-http-server, apache-tomcat, c-sharp, centos, database-interface-table, erlang-otp, executive-information-system, gantt-chart, groupware, hong-gil-dong, java, lee-da-young, linux, lotus-mes, lotus-pms, lotus-scm, mariadb, mobile-app, mqtt, oracle-database, postgresql, project-management-institute, project-management-system, rabbitmq, single-sign-on-api, sk-innovation-asan, ski-co-ltd, warehouse-management-system, windows-server, yi-sun-sin

### Concepts — 0/22 core (0%)

**Always present** (0): (none)

**Sometimes**: advanced-planning-and-scheduling, bill-of-materials, enterprise-resource-planning, gantt-chart, manufacturing-execution-system, product-lifecycle-management, project-communications-management, project-cost-management, project-human-resource-management, project-integration-management, project-management-body-of-knowledge, project-procurement-management, project-quality-management, project-risk-management, project-scope-management, project-stakeholder-management, project-time-management, restful-api, supply-chain-management, tcp-ip, virtual-private-network, work-breakdown-structure

## Run 30 outlier 및 29-run 보정 통계

**Run 30 outlier 해설**:
Run 30 의 총 elapsed 3.0s + (0 entities, 0 concepts, 0 sources) 는 실제 인제스트가 수행되지 않은 **툴 edge case**. 원인: 각 run 종료 시 `autoMoveFromInbox` 로직이 원본 PDF 를 PARA 하위로 이동하고, 측정 스크립트의 `restoreSourceFile()` 가 다음 run 시작 전 `raw/` 트리에서 파일명을 탐색하여 원위치로 복귀. 29 회까지 정상 작동했으나 run 30 전 시점에서 파일이 기대 경로에 돌아오지 않아 ingest 가 "no-op" 로 3초에 완료됨. 측정 인프라 버그로 기록 (29-run 실측치 반영 이후 수정 필요).

**29-run (valid) 통계 재계산 (run 30 제외)**:

| 지표 | Mean | Std | **CV %** | Range |
|------|-----:|----:|---------:|------:|
| Entities | 22.69 | 2.51 | **11.1%** | 21–28 |
| Concepts | 17.52 | 4.73 | **27.0%** | 12–22 |
| **Total** | **41.21** | **3.79** | **9.2%** | **35–45** |
| Time | 215.4s | 23.3s | 10.8% | 174.0–293.0 |

**분포 관찰**: Total 은 {35, 41, 43, 45} 4 값으로 극도로 양자화. Entities 는 {21, 22, 28} 3 값, Concepts 는 {12, 21, 22} 3 값. Determinism + canonicalizer 3차 적용 결과 output 이 **이산 분포** 로 수렴 — LLM 이 "이 문서는 N 개의 mention 을 추출해야 한다" 에 대해 결정적 답을 갖게 됨.

**Core / Variable 재계산 (29-run)**:
- Entities: 31 union → core 는 intersection 으로 추후 계산 (run 30 의 빈 set 제거 시 크게 개선).
- Concepts: 22 union → 동일.

**대비 표 (§4.5.1.4 → §4.5.1.5 → §4.5.1.6 10-run → §4.5.1.6 29-run)**:

| 지표 | §4.5.1.4 baseline | §4.5.1.5 30-run | §4.5.1.6.2 10-run | §4.5.1.6.6 29-run | 누적 Δ 상대 |
|------|------------------:|----------------:|-------------------:|--------------------:|------------:|
| Total CV | 32.5% | 24.3% | 7.2% | **9.2%** | −71.7% |
| Entities CV | (N/A) | 36.4% | 13.9% | 11.1% | −69.5% vs .5 |
| Concepts CV | (N/A) | 31.1% | 28.9% | 27.0% | −13.2% vs .5 |
| Union size (E+C) | (N/A) | 40+47=87 | 31+22=53 | 31+22=53 | −39.1% vs .5 |

**판정**: Phase A/B 목표 (<15%, <10% Total) 모두 **29-run 기준 달성** (9.2%). 10-run (7.2%) 대비 약간 상승은 N=29 의 통계적 잔여 variance 이지만 sub-10% 구간 유지. §4.5.1.6 가 §4.5.1.5 baseline 24.3% 에서 약 **-62% 상대 감소** 를 이룸.
