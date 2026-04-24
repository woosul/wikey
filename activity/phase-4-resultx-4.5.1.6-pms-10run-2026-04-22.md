# 결정성 측정 — PMS_제품소개_R10_20220815.pdf

> **상위 문서**: [`activity/phase-4-result.md`](./phase-4-result.md) · [`plan/phase-4-todo.md`](../plan/phase-4-todo.md) — 본 문서는 §4.5.1.6 (PMS 10-run 결정성) 보조 자료. 명명규칙: `phase-N-todox-<section>-<topic>.md` / `phase-N-resultx-<section>-<topic>-<date>.md` — `CLAUDE.md §문서 명명규칙·조직화` 참조.


> 일시: 2026-04-22
> Source: `raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf`
> Runs: 9 (1 failed)
> Determinism: ON (temperature=0, seed=42)
> 도구: `scripts/measure-determinism.sh`

## 결과

| Run | Entities | Concepts | Total | Time(s) |
|----:|---------:|---------:|------:|--------:|
| 1 | 22 | 22 | 45 | 258.6 |
| 2 | 21 | 21 | 43 | 212.2 |
| 3 | 28 | 12 | 41 | 410.4 |
| 4 | 28 | 12 | 41 | 224.2 |
| 5 | 22 | 12 | 35 | 351.9 |
| 6 | 21 | 21 | 43 | 391.9 |
| 7 | 28 | 12 | 41 | 362.4 |
| 8 | 22 | 22 | 45 | 356.4 |
| 9 | 21 | 21 | 43 | 374.4 |

실패 run:
- run 10: timeout 10min

## 통계

| 지표 | Mean | Std | **CV %** | Range |
|------|-----:|----:|---------:|------:|
| Entities | 23.67 | 3.28 | **13.9%** | 21–28 |
| Concepts | 17.22 | 4.97 | **28.9%** | 12–22 |
| Total | 41.89 | 3.02 | **7.2%** | 35–45 |
| Time | 326.9s | 74.6s | 22.8% | 212.2–410.4 |

## Core / Variable

### Entities — 18/31 core (58%)

**Always present** (18): apache-http-server, apache-tomcat, c-sharp, centos, erlang-otp, executive-information-system, java, linux, lotus-pms, lotus-scm, mariadb, mqtt, oracle-database, postgresql, project-management-institute, rabbitmq, single-sign-on-api, warehouse-management-system

**Sometimes**: alimtalk, database-interface-table, gantt-chart, groupware, hong-gil-dong, lee-da-young, lotus-mes, mobile-app, project-management-system, sk-innovation-asan, ski-co-ltd, windows-server, yi-sun-sin

### Concepts — 11/22 core (50%)

**Always present** (11): advanced-planning-and-scheduling, bill-of-materials, enterprise-resource-planning, manufacturing-execution-system, product-lifecycle-management, project-management-body-of-knowledge, restful-api, supply-chain-management, tcp-ip, virtual-private-network, work-breakdown-structure

**Sometimes**: gantt-chart, project-communications-management, project-cost-management, project-human-resource-management, project-integration-management, project-procurement-management, project-quality-management, project-risk-management, project-scope-management, project-stakeholder-management, project-time-management

