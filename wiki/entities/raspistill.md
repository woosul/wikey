---
title: raspistill
type: entity
created: 2026-04-18
updated: 2026-04-18
sources: [source-raspberry-pi-high-quality-camera.md]
tags: [command-line-tool, camera-software, raspberry-pi, utility]
---

# raspistill

`[[raspistill]]`은 [[raspberry-pi]] 카메라 모듈에서 정지 이미지를 캡처하기 위한 명령줄 도구입니다. [[raspbian]] (Raspberry Pi OS) 환경에서 터미널을 통해 실행됩니다.

## 주요 기능

*   **이미지 캡처**: `-o` 옵션을 사용하여 지정된 파일명으로 이미지를 저장할 수 있습니다 (예: `raspistill -o test.jpg`).
*   **라이브 프리뷰**: 이미지를 캡처하기 전에 실시간 미리보기 화면을 제공합니다.
*   **뷰파인더 모드**: `-t 0` 옵션을 사용하여 사진을 저장하지 않고 카메라를 뷰파인더로만 사용할 수 있습니다.

`[[raspistill]]`은 [[raspberry-pi-high-quality-camera]]와 같은 카메라 모듈의 기본적인 작동 및 테스트에 필수적인 도구입니다.