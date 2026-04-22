# 결정성 측정 — PMS_제품소개_R10_20220815.pdf

> 일시: 2026-04-22
> Source: `raw/0_inbox/PMS_제품소개_R10_20220815.pdf`
> Runs: 10 (0 failed)
> Determinism: ON (temperature=0, seed=42)
> 도구: `scripts/measure-determinism.sh`

## 결과

| Run | Entities | Concepts | Total | Time(s) |
|----:|---------:|---------:|------:|--------:|
| 1 | 22 | 21 | 44 | 308.3 |
| 2 | 22 | 21 | 44 | 213.7 |
| 3 | 23 | 12 | 36 | 183.7 |
| 4 | 23 | 12 | 36 | 191.2 |
| 5 | 23 | 22 | 46 | 245.0 |
| 6 | 22 | 21 | 44 | 234.0 |
| 7 | 23 | 22 | 46 | 234.0 |
| 8 | 23 | 12 | 36 | 294.0 |
| 9 | 23 | 22 | 46 | 351.3 |
| 10 | 22 | 21 | 44 | 270.7 |

## 통계

| 지표 | Mean | Std | **CV %** | Range |
|------|-----:|----:|---------:|------:|
| Entities | 22.60 | 0.52 | **2.3%** | 22–23 |
| Concepts | 18.60 | 4.58 | **24.6%** | 12–22 |
| Total | 42.20 | 4.37 | **10.3%** | 36–46 |
| Time | 252.6s | 53.4s | 21.1% | 183.7–351.3 |

## Core / Variable

### Entities — 19/27 core (70%)

**Always present** (19): apache-http-server, apache-tomcat, c-sharp, centos, erlang-otp, executive-information-system, goodstream-co-ltd, java, linux, lotus-pms, lotus-scm, mariadb, mqtt, oracle-database, postgresql, project-management-institute, rabbitmq, single-sign-on-api, warehouse-management-system

**Sometimes**: alimtalk, database-interface-table, gantt-chart, lotus-mes, mobile-app, sk-innovation-asan, ski-co-ltd, windows-server

### Concepts — 11/22 core (50%)

**Always present** (11): advanced-planning-and-scheduling, bill-of-materials, enterprise-resource-planning, manufacturing-execution-system, product-lifecycle-management, project-management-body-of-knowledge, restful-api, supply-chain-management, tcp-ip, virtual-private-network, work-breakdown-structure

**Sometimes**: gantt-chart, project-communications-management, project-cost-management, project-human-resource-management, project-integration-management, project-procurement-management, project-quality-management, project-risk-management, project-scope-management, project-stakeholder-management, project-time-management

