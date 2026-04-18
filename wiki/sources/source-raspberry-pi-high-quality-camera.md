---
title: Raspberry Pi High Quality Camera Getting Started
type: source
created: 2026-04-18
updated: 2026-04-18
sources: []
tags: [raspberry-pi, camera, hardware, manual, getting-started]
---

# Raspberry Pi High Quality Camera Getting Started

이 문서는 Raspberry Pi High Quality Camera의 시작하기 가이드로, 작동 지침, 규제 준수 정보 및 안전 정보를 포함합니다. 2020년 4월 Raspberry Pi Trading Ltd.에서 발행되었습니다.

## 주요 내용

*   **카메라 구성 요소**: 먼지 캡, C-CS 어댑터, 백 포커스 조절 링, 삼각대 마운트, 리본 케이블, 메인 하우징 및 센서, 메인 회로 기판, 장착 구멍 등이 설명됩니다.
*   **렌즈 장착**: [[raspberry-pi-high-quality-camera]]는 [[cs-mount-lens]]를 기본 지원하며, [[c-cs-adapter]]를 사용하여 [[c-mount-lens]]도 장착할 수 있습니다. 먼지로부터 센서를 보호하기 위해 렌즈가 장착되지 않았을 때는 먼지 캡을 사용해야 합니다. CGL 6mm CS-mount 및 16mm C-mount 렌즈가 호환 가능한 서드파티 제품으로 언급됩니다.
*   **[[back-focus-adjustment]]**: 고정 초점 렌즈의 초점 조절 및 조절 가능한 렌즈의 초점 범위 조절을 위해 사용됩니다. 조절 링을 돌리고 잠금 나사를 조절하여 백 포커스를 설정하는 방법이 설명됩니다.
*   **[[tripod-mount]]**: 선택 사항인 구성 요소로, 필요하지 않을 경우 분리할 수 있습니다. 삼각대 장착 시 리본 케이블 손상에 주의해야 합니다.
*   **Raspberry Pi 연결**: Raspberry Pi가 꺼진 상태에서 카메라 커넥터의 플라스틱 래치를 조심스럽게 풀고, 접촉면이 래치 반대 방향을 향하도록 카메라 리본을 삽입한 후 래치를 다시 잠그는 과정이 설명됩니다.
*   **카메라 작동**: [[raspbian]] (현재 Raspberry Pi OS)에서 카메라를 활성화하는 방법 (Preferences > Raspberry Pi Configuration > Interfaces 탭 > Camera Enabled)이 안내됩니다. `[[raspistill]]` 명령줄 도구를 사용하여 사진을 캡처하거나 뷰파인더로 사용하는 방법이 예시와 함께 제공됩니다.
*   **기타 기능**:
    *   **카메라 회전**: 센서 노출에 주의하며 카메라 회로 기판을 180도 회전시키는 방법이 설명됩니다.
    *   **[[ir-filter]]**: 카메라의 적외선 감도를 줄이는 IR 필터가 내장되어 있으며, 제거 시 제품 보증이 무효화되고 되돌릴 수 없을 가능성이 높다고 명시됩니다.
*   **[[regulatory-compliance]]**: EU의 EMC 2014/30/EU, RoHS 2011/65/EU, WEEE 지침 및 FCC 47 CFR Part 15, Subpart B, Class B Digital Device 요구 사항에 대한 준수 정보가 제공됩니다.
*   **[[safety-information]]**: Raspberry Pi High Quality Camera의 오작동 또는 손상을 방지하기 위한 경고 및 안전 사용 지침이 포함됩니다. 물, 습기, 열 노출을 피하고, 회로 기판 및 커넥터 손상에 주의하며, 전원이 켜진 상태에서 취급을 피하고, 정전기 방전으로 인한 손상 위험을 최소화하기 위해 가장자리나 렌즈 마운트 어셈블리만 만지도록 권고합니다.
*   **상표**: [[mipi-alliance-inc]]의 [[mipi-dsi]] 및 [[mipi-csi]] 서비스 마크와 [[raspberry-pi-foundation]]의 Raspberry Pi 및 Raspberry Pi 로고 상표가 언급됩니다.