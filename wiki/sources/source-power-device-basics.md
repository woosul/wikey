---
title: SiC 파워 디바이스의 기초 (Tech Web Hand Book)
type: source
created: 2026-04-12
updated: 2026-04-12
sources: [TWHB-16_001_kr_파워디바이스의기초.pdf]
tags: [SiC, power-device, semiconductor, MOSFET, SBD]
---

# SiC 파워 디바이스의 기초

> 원시 소스: `raw/3_resources/20_report/TWHB-16_001_kr_파워디바이스의기초.pdf` (37p, 3MB)
> 인제스트 방법: Gemini 2.5 Flash 1차 요약 → Claude Code 위키 통합 (Step 5-1-2 파이프라인 검증)

## 문서 개요

로옴(ROHM) 반도체의 Tech Web Hand Book 시리즈 중 SiC(실리콘 카바이드) 파워 디바이스 기초 교재. SiC 소재의 물성부터 SBD(쇼트키 배리어 다이오드), MOSFET의 구조, 특성, 응용까지 체계적으로 다룬다.

## 섹션 인덱스 (Gemini 요약 기반)

| 페이지 | 섹션 | 핵심 키워드 | 우선순위 |
|--------|------|-----------|----------|
| p1 | 표지 — SiC 파워 디바이스의 기초 | SiC, Power Device, Handbook | reference |
| p2-3 | 목차 | 전체 구조 | reference |
| p4 | 서론 + SiC란? + SiC 물성과 특징 | SiC, Silicon Carbide, 4H-SiC, 물성 | core |
| p5 | SiC 파워 디바이스 특징 + 개발 배경 | 고내압, 저저항, 고속, 고온 동작 | core |
| p6 | SiC 파워 디바이스 메리트 + SiC SBD 특징 | SBD, Schottky Barrier Diode, Si 비교 | core |
| p7 | SiC SBD vs Si PN 다이오드 비교 | PND, FRD, 고속 스위칭 | core |
| p8-12 | SiC SBD 상세 — 역회복 전류, 온도 특성 | trr, 역방향 누설, 서지 내량 | detail |
| p13-20 | SiC MOSFET — 구조, 특성, Si IGBT 비교 | MOSFET, IGBT, 게이트 구동, Ron | core |
| p21-25 | SiC MOSFET 응용 — 스위칭 손실, 병렬 운전 | 스위칭 손실, 기생 인덕턴스, 병렬 | detail |
| p26-30 | 열 설계 + 패키지 | 방열, 열저항, PCB 실장 | detail |
| p31-37 | 부록 — 용어집, 제품 라인업 | 용어, 로옴 제품 | reference |

## 핵심 시사점

1. **SiC vs Si 핵심 차이**: SiC는 Si 대비 밴드갭 3배, 절연파괴 전계 10배, 열전도율 3배 → 고전압/고온/고속 환경에서 압도적 우위
2. **SBD의 역할**: 역회복 전류(trr)가 Si FRD 대비 극소 → 스위칭 손실 대폭 감소, 고주파 동작에 유리
3. **MOSFET 전환**: Si IGBT 대비 SiC MOSFET은 온저항(Ron)이 낮고 테일 전류 없음 → 인버터 효율 향상
4. **열 설계 중요성**: SiC의 고온 동작 가능이 곧 열 설계 부담 감소를 의미하지는 않음 — 적절한 방열 설계 필수

## 관련 페이지

- [[fpv-digital-transmission]] — ESC/모터 구동에 파워 디바이스 기술 적용
- [[dji-o3-air-unit]] — FPV 시스템의 전력 관리 맥락
