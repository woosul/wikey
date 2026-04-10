---
title: 디지털 FPV 영상 전송
type: concept
created: 2026-04-10
updated: 2026-04-10
sources: [source-dji-o3-air-unit.md]
tags: [fpv, video-transmission, wireless, concept]
---

# 디지털 FPV 영상 전송

First Person View(1인칭 시점) 드론 비행을 위한 실시간 디지털 영상 전송 기술. 드론에 장착된 카메라 영상을 고글 또는 모니터에 저지연으로 전송한다.

## 핵심 요소

| 요소 | 역할 |
|------|------|
| **Air Unit (송신기)** | 드론에 장착, 카메라 영상 + FC 데이터 전송 |
| **고글/모니터 (수신기)** | 조종자가 착용, 실시간 영상 수신 |
| **조종기** | 조종 신호를 Air Unit에 전송 |

## DJI O3+ 기술

[[dji-o3-air-unit]]에 탑재된 DJI의 3세대 전송 프로토콜:

- **듀얼밴드**: 2.4GHz (수신) + 5.725-5.850GHz (송수신)
- **듀얼편파 안테나**: 신호 다양성으로 안정성 향상
- **채널 모드**: 자동 (최강 신호 선택) 또는 수동 (10/20/40MHz 대역폭)
- **지연**: 28-40ms (해상도/프레임레이트에 따라)
- **거리**: FCC 기준 최대 10km

## 아날로그 vs 디지털 FPV

| | 아날로그 | 디지털 (DJI O3+) |
|---|---|---|
| 화질 | SD, 노이즈 | HD/4K, 선명 |
| 지연 | ~1ms | 28-40ms |
| 거리 | 간섭에 약함 | 자동 채널/대역 관리 |
| 녹화 | 별도 카메라 필요 | Air Unit 내장 |
| OSD | 직접 오버레이 | Canvas Mode (MSP) |

## Canvas Mode

디지털 FPV에서 OSD(On-Screen Display)를 구현하는 방식. Betaflight 4.3.0+ FC에서 MSP Displayport 프로토콜로 배터리 전압, 비행 거리 등의 정보를 고글 화면에 표시.

## 관련 항목

- [[dji-o3-air-unit]] — 대표 제품
- [[source-dji-o3-air-unit]] — 매뉴얼 출처
