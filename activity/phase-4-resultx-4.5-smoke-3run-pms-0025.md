# 결정성 측정 — PMS_제품소개_R10_20220815.pdf

> **상위 문서**: [`activity/phase-4-result.md`](./phase-4-result.md) · [`plan/phase-4-todo.md`](../plan/phase-4-todo.md) — 본 문서는 §4.5 (Smoke 3-run (PMS)) 보조 자료. 명명규칙: `phase-N-todox-<section>-<topic>.md` / `phase-N-resultx-<section>-<topic>-<date>.md` — `CLAUDE.md §문서 명명규칙·조직화` 참조.


> 일시: 2026-04-22
> Source: `raw/3_resources/30_manual/PMS_제품소개_R10_20220815.pdf`
> Runs: 3 (0 failed)
> 도구: `scripts/measure-determinism.sh`

## 결과

| Run | Entities | Concepts | Total | Time(s) |
|----:|---------:|---------:|------:|--------:|
| 1 | 9 | 19 | 29 | 329.3 |
| 2 | 11 | 11 | 23 | 270.8 |
| 3 | 13 | 13 | 27 | 264.8 |

## 통계

| 지표 | Mean | Std | **CV %** | Range |
|------|-----:|----:|---------:|------:|
| Entities | 11.00 | 2.00 | **18.2%** | 9–13 |
| Concepts | 14.33 | 4.16 | **29.0%** | 11–19 |
| Total | 26.33 | 3.06 | **11.6%** | 23–29 |
| Time | 288.3s | 35.6s | 12.4% | 264.8–329.3 |

## Core / Variable

### Entities — 4/20 core (20%)

**Always present** (4): lotus-mes, lotus-pms, lotus-scm, project-management-institute

**Sometimes**: alimtalk, c-sharp, integrated-member-database, intel-core-i5, intel-xeon, java, linux, mariadb, mobile-app, mqtt, oracle-database, pms-integrated-supply-chain-management-system, project-management-system, rabbitmq, single-sign-on-api, virtual-private-network

### Concepts — 8/22 core (36%)

**Always present** (8): bill-of-materials, enterprise-resource-planning, gantt-chart, manufacturing-execution-system, product-lifecycle-management, project-management-body-of-knowledge, supply-chain-management, work-breakdown-structure

**Sometimes**: advanced-planning-and-scheduling, drawing, electronic-bill-of-materials, executive-information-system, message-queuing-telemetry-transport, point-of-production, quality-improvement-request, representational-state-transfer-api, restful-api, single-sign-on-api, tcp-ip, transmission-control-protocol-internet-protocol, virtual-private-network, warehouse-management-system

