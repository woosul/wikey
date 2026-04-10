---
title: NanoVNA V2
type: entity
created: 2026-04-11
updated: 2026-04-11
sources: [source-nanovna-v2-notes.md]
tags: [tool, measurement, rf, antenna, fpv]
---

# NanoVNA V2

소형 벡터 네트워크 분석기(VNA). 안테나와 RF 경로의 반사·전송 특성을 측정해 튜닝과 진단에 사용한다.

## 핵심 특징

- **대역**: 50kHz~3GHz 측정, 일부 변형 모델은 4.4GHz까지 지원
- **측정값**: S11, S21, 임피던스, SWR, 스미스 차트
- **휴대성**: 배터리 내장 카드형 장비로 현장 계측에 적합
- **접근성**: 저가 장비이지만 RF 튜닝의 핵심 지표를 빠르게 확인 가능

## FPV 안테나 측정 도구로서의 위치

[[fpv-digital-transmission]]에서 안테나는 영상 링크 품질과 직결된다. NanoVNA V2는 특히 5.8GHz 대역 안테나를 다룰 때 공진점, SWR, 커넥터 손실을 확인하는 도구로 유용하다.

[[dji-o3-air-unit]] 같은 시스템을 사용할 때는 다음 점검에 직접 연결된다:

- 안테나가 목표 주파수에서 공진하는지 확인
- SWR이 허용 범위인지 측정
- SMA/MMCX 연결부의 손실이나 접촉 불량 진단
- 트리밍이나 교체 후 성능 변화를 비교

## 사용 시 주의점

- **캘리브레이션 필수**: Open/Short/Load 보정을 먼저 수행해야 한다.
- **케이블 길이 관리**: 연장 케이블은 측정 오차를 키울 수 있다.
- **소프트웨어 연동**: NanoVNA-QT를 사용하면 분석과 기록이 쉬워진다.
- **펌웨어 상태 확인**: 최신 펌웨어가 정확도와 안정성에 유리하다.

## 관련 항목

- [[source-nanovna-v2-notes]] — 개인 노트 요약
- [[dji-o3-air-unit]] — 안테나 성능 검증 대상
- [[fpv-digital-transmission]] — 적용 맥락
