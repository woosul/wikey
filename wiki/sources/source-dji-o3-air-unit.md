---
title: "DJI O3 Air Unit 사용자 매뉴얼"
type: source
created: 2026-04-10
updated: 2026-04-10
sources: [DJI_O3_Air_Unit_User_Manual_v1.0_EN.pdf]
tags: [dji, fpv, hardware, manual]
---

# DJI O3 Air Unit 사용자 매뉴얼

> 원본: DJI O3 Air Unit User Manual v1.0 (2023.03), 33페이지 PDF
> 원시 소스: `raw/manual/00.게임기기/830 FPV/DJI O3 Air Unit/DJI_O3_Air_Unit_User_Manual_v1.0_EN.pdf`
> 인제스트 방법: 3청크 분할 읽기 (p1-5, p6-15, p16-33)

## 제품 개요

[[dji-o3-air-unit]]는 DJI의 O3+ 기술을 탑재한 [[fpv-digital-transmission|디지털 FPV 영상 전송]] 장치. 레이싱 드론에 장착하여 DJI 고글 및 조종기와 무선으로 영상, 조종 신호, FC 정보를 전송한다.

## 하드웨어 구성

- **카메라 모듈**: 1/1.7" CMOS, f/2.8, 155° FOV, RockSteady EIS
- **전송 모듈**: O3+ 전송, 듀얼밴드 듀얼편파 안테나 (IPEX1)
- **3-in-1 케이블**: 전원(7.4-26.4V), UART RX/TX (FC OSD), DJI HDL (S.Bus)
- **인터페이스**: USB-C, microSD 슬롯

## 핵심 스펙

| 항목 | 사양 |
|------|------|
| 무게 | 약 36.4g (안테나 제외) |
| 전송 | O3+, 5.725-5.850 GHz |
| 지연 | 30ms (1080p/100fps, Goggles 2) |
| 지연 | 28ms (810p/120fps, FPV Goggles V2) |
| 최대 거리 | <10km (FCC), <6km (SRRC), <2km (CE) |
| 저장 | 약 20GB 내장 |
| 영상 | 4K@30-120fps, 2.7K, 1080p (MP4) |
| 동작 온도 | -10°~40°C |

## 설치 및 열관리

- 크기가 이전 세대 대비 **40% 축소**, 전력 소비 **40% 증가** → 열 관리 필수
- 프로펠러 10mm 이내에 장착 (다운워시 냉각 활용)
- 히트싱크 소재로 기체 프레임에 열 전도 권장
- 대기 시간: 25°C에서 8분, 35°C에서 5분 (콜드 스타트)
- 비행 중 과열 시 30초 내 복귀/착륙 필요

## 3-in-1 케이블 핀맵

| PIN | 색상 | 기능 |
|-----|------|------|
| 1 | RED | 전원 (7.4-26.4V) |
| 2 | BLACK | 전원 GND |
| 3 | WHITE | UART RX (FC OSD TX, 0-3.3V) |
| 4 | GRAY | UART TX (FC OSD RX, 0-3.3V) |
| 5 | BROWN | Signal GND |
| 6 | YELLOW | DJI HDL (FC S.Bus, 0-3.3V) |

## 영상 안정화 문제 (트러블슈팅)

- **IMU 공진**: ESC PWM 주파수(기본 24kHz)와 카메라 IMU 주파수(24-30kHz)가 겹칠 때 발생 → PWM을 48kHz 또는 96kHz로 변경
- **롤링 셔터**: 프로펠러 진동이 프레임을 통해 카메라에 전달 → 진동 흡수 구조 조정

## Canvas Mode (OSD)

Betaflight 4.3.0+ 필요. MSP Displayport를 통해 FC의 OSD 요소(배터리 전압, 비행 거리 등)를 고글 화면에 표시. UART TX를 MSP로 설정하고 baud rate 115200으로 구성.

## 호환 장비

- **고글**: DJI Goggles 2 (터치패널, IPD -8.0~+2.0D), DJI FPV Goggles V2 (5D 버튼)
- **조종기**: DJI FPV Remote Controller 2

## 관련 항목

- [[dji-o3-air-unit]] — 제품 상세
- [[fpv-digital-transmission]] — 디지털 FPV 전송 개념
