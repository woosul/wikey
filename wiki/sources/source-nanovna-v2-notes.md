---
title: NanoVNA V2 — 개인 노트
type: source
created: 2026-04-11
updated: 2026-04-25
sources: []
tags: [personal-notes, user-manual, rf-measurement, vna, fpv]
source_id: sha256:5d96b65588a65d5a
hash: 5d96b65588a65d5a42b7873cee4b6355bf13c77ea12a938f3d528d6d0dafd93c
size: 1851
first_seen: 2026-04-25T06:43:44.111Z
vault_path: raw/3_resources/60_note/600_technology/nanovna-v2-notes.md
---

> [!warning] 원본 삭제됨 (2026-04-25)
> 원본 파일이 사라졌습니다. registry tombstone 상태. 복원 시 reconcile 이 자동 해제합니다.

# NanoVNA V2 — 개인 노트

> 날짜: 2026-04-11
> 출처: 직접 사용 경험 +

## NanoVNA V2란?

[[nanovna-v2]]는 50kHz~3GHz 대역을 측정하는 소형 ()다. 안테나의 ([[swr]], 정재파비), [[s-parameter]](S11, S21)를 현장에서 바로 측정할 수 있어 아마추어 무선, 안테나 튜닝, 설계에 널리 쓰인다.

## 핵심 특징

- **주파수 범위**: 50kHz~3GHz ([[nanovna-v2-plus4]]는 4.4GHz까지)
- **측정 항목**: S11 (반사), S21 (전송), [[swr]], [[smith-chart]]
- **크기**: 신용카드 크기, 배터리 내장으로 현장 측정 가능
- **가격**: $50~100 수준 (기존 대비 1/100 가격)
- **오픈소스**: 하드웨어 설계 + [[nanovna-qt]] 소프트웨어 모두 공개

## FPV와의 연관

[[dji-o3-air-unit]] 등 장비에서 안테나 성능은 영상 전송 품질에 직결된다. [[nanovna-v2]]로 안테나의 공진 주파수와 [[swr]]을 측정하면:

- **5.8GHz 대역 안테나**: [[swr]] 1.5 이하가 양호 (1.0이 완벽)
- **안테나 길이 트리밍**: 공진점을 목표 주파수에 맞출 수 있음
- **커넥터 손실 확인**: [[sma-connector]]/[[mmcx-connector]] 커넥터의 접촉 불량 감지

## 사용 팁

1. **캘리브레이션 필수**: 측정 전 [[open-short-load-calibration]] 수행
2. **포트 연장 효과**: 케이블 길이가 측정에 영향 → 가능한 짧은 케이블 사용
3. **PC 소프트웨어**: [[nanovna-qt]]로 더 정밀한 분석, 데이터 내보내기 가능
4. **펌웨어 업데이트**: 최신 펌웨어로 측정 정확도와 안정성 향상

## Wikey 관점

이 장비는 [[dji-o3-air-unit]]와 의 안테나 성능 검증 도구로 연결된다. 위키에서 "안테나 측정" 주제를 다룰 때 [[nanovna-v2]]가 핵심 도구 엔티티가 될 수 있다.

## 섹션 인덱스

| § | 제목 | 본문 | priority | 경고 |
|:-:|:-|-:|:-:|:-|
| 0 | NanoVNA V2 — 개인 노트 | 45 chars | skip | mixed-level |
| 1 | NanoVNA V2란? | 149 chars | support | mixed-level |
| 2 | 핵심 특징 | 220 chars | core | mixed-level |
| 3 | FPV와의 연관 | 209 chars | core | mixed-level |
| 4 | 사용 팁 | 190 chars | support | mixed-level |
| 5 | Wikey 관점 | 131 chars | support | mixed-level |
