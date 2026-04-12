---
title: raspistill
type: concept
created: 2026-04-12
updated: 2026-04-12
sources: [source-raspberry-pi-high-quality-camera-getting-started.md]
tags: [command-line-tool, raspberry-pi, camera]
---

# raspistill

**raspistill**은 [[raspberry-pi]] 카메라 모듈(예: [[raspberry-pi-high-quality-camera]])을 사용하여 스틸 이미지와 비디오를 캡처하기 위한 명령줄 도구입니다. [[raspbian]] 운영체제에서 카메라 기능을 활성화한 후 터미널을 통해 실행할 수 있습니다.

## 주요 사용법
*   **사진 촬영**: `raspistill -o test.jpg` 명령은 5초 미리보기 후 `test.jpg` 파일로 이미지를 저장합니다.
*   **뷰파인더 모드**: `raspistill -t 0` 명령은 사진을 저장하지 않고 카메라를 뷰파인더로만 작동시킵니다.

이 도구는 Raspberry Pi 카메라의 기본적인 작동 및 테스트에 유용하게 활용됩니다.