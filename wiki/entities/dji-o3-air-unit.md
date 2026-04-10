---
title: DJI O3 Air Unit
type: entity
created: 2026-04-10
updated: 2026-04-10
sources: [source-dji-o3-air-unit.md]
tags: [hardware, fpv, dji, video-transmission]
---

# DJI O3 Air Unit

DJI의 3세대 [[fpv-digital-transmission|디지털 FPV 영상 전송]] 장치. 레이싱 드론에 장착하여 저지연 HD 영상을 DJI 고글로 실시간 전송한다.

## 핵심 특징

- **O3+ 전송 기술**: 듀얼밴드(2.4GHz/5.8GHz) 듀얼편파 안테나
- **초저지연**: 28-30ms (세대 최저)
- **4K 녹화**: 최대 4K@120fps, RockSteady EIS
- **소형 경량**: 36.4g, 이전 세대 대비 크기 40% 축소

## 스펙 요약

| 항목 | 사양 |
|------|------|
| 센서 | 1/1.7" CMOS |
| 렌즈 | f/2.8, 155° FOV |
| 전원 | 7.4-26.4V (2S-6S LiPo) |
| 최대 거리 | <10km (FCC) |
| 내장 저장 | ~20GB |
| 동작 온도 | -10°~40°C |

## 열 관리

이전 세대 대비 크기는 줄었지만 전력 소비가 40% 증가하여 열 관리가 핵심 과제:
- 프로펠러 근처(10mm 이내) 장착으로 다운워시 활용
- 히트싱크 소재로 기체 프레임에 열 전도
- 밀폐 공간 설치 금지
- 콜드 스타트 대기: 25°C에서 8분, 35°C에서 5분

## FC 연결 (3-in-1 케이블)

6핀 케이블로 비행 컨트롤러에 직접 납땜 연결:
- 전원 + GND
- UART RX/TX → OSD 데이터 (Canvas Mode)
- DJI HDL → S.Bus 조종 신호

## 호환 장비

| 장비 | 모델 | 특징 |
|------|------|------|
| 고글 | DJI Goggles 2 | 터치패널, 디옵터 조절 (-8.0~+2.0D) |
| 고글 | DJI FPV Goggles V2 | 5D 버튼, 채널 디스플레이 |
| 조종기 | DJI FPV Remote Controller 2 | 스틱 장력 조절 가능 |

## 관련 항목

- [[fpv-digital-transmission]] — 디지털 FPV 전송 개념
- [[source-dji-o3-air-unit]] — 매뉴얼 요약
