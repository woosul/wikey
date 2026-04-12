---
title: Raspberry Pi High Quality Camera Getting Started
type: source
created: 2026-04-12
updated: 2026-04-12
sources: []
tags: [raspberry-pi, camera, manual]
---

# Raspberry Pi High Quality Camera 시작 가이드

이 문서는 [[raspberry-pi-high-quality-camera]]의 운영 지침, 규제 준수 정보 및 안전 정보를 제공하는 공식 가이드입니다. 2020년 4월 Raspberry Pi Trading Ltd.에서 발행되었습니다.

## 주요 내용

### 렌즈 장착
카메라는 기본적으로 [[cs-mount-lens]]를 지원하며, 5mm 백 포커스 연장 어댑터를 통해 [[c-mount-lens]]도 호환됩니다. 센서 보호를 위해 렌즈 미장착 시에는 반드시 더스트 캡을 사용해야 합니다. CGL 6mm CS-mount 및 16mm C-mount 렌즈가 호환 가능한 서드파티 제품의 예시로 언급됩니다.

### [[back-focus-adjustment]]
백 포커스 조정 메커니즘은 고정 초점 렌즈의 초점 조정 및 가변 초점 렌즈의 초점 범위 조정 두 가지 목적을 가집니다. 백 포커스 잠금 나사를 풀고 조정 링을 돌려 초점을 맞춘 후 다시 잠급니다.

### 삼각대 마운트
선택 사항인 구성 요소로, 필요하지 않을 때는 분리할 수 있습니다. 장착 시 리본 케이블 손상에 주의해야 합니다.

### Raspberry Pi 연결 및 작동
카메라를 [[raspberry-pi]] 컴퓨터에 연결하려면, Raspberry Pi의 전원을 끄고 카메라 커넥터의 플라스틱 걸쇠를 풀어 리본 케이블을 삽입합니다. 케이블의 접촉면이 걸쇠 반대 방향을 향하도록 합니다. 연결 후 [[raspbian]] 운영체제에서 카메라를 활성화해야 합니다 (Preferences > Raspberry Pi Configuration > Interfaces 탭 > Camera Enabled).

### 카메라 작동
명령줄 도구인 [[raspistill]]을 사용하여 카메라 이미지를 캡처할 수 있습니다. `raspistill -o test.jpg` 명령으로 테스트 사진을 찍거나, `raspistill -t 0` 명령으로 뷰파인더로만 사용할 수 있습니다. 더 자세한 정보는 Raspberry Pi 공식 문서에서 확인할 수 있습니다.

### 기타 기능
*   **카메라 회전**: 메인 회로 기판을 180도 회전시켜 리본 케이블의 방향을 바꿀 수 있습니다. 이 작업은 깨끗하고 먼지 없는 환경에서 센서가 아래를 향하도록 수행해야 합니다.
*   **[[ir-filter]]**: 카메라에는 적외선(IR) 빛에 대한 감도를 줄이는 IR 필터가 포함되어 있습니다. 이 필터는 제거할 수 있지만, 제품 보증이 무효화되고 되돌릴 수 없을 가능성이 높습니다.

## 규제 준수 및 안전 정보
이 문서는 EU의 EMC 2014/30/EU, RoHS 2011/65/EU, WEEE 지침 및 FCC 47 CFR Part 15, Subpart B, Class B 디지털 장치 요구 사항을 포함한 규제 준수 정보를 제공합니다. 또한, Raspberry Pi 컴퓨터에만 연결하고 전원을 공급해야 하며, 통풍이 잘 되는 환경에서 사용하고, 물이나 습기, 열에 노출시키지 않는 등 안전한 사용 지침을 명시합니다.

## 상표
[[mipi-dsi]] 및 [[mipi-csi]]는 MIPI Alliance, Inc.의 서비스 마크입니다. Raspberry Pi 및 Raspberry Pi 로고는 [[raspberry-pi-foundation]]의 상표입니다.