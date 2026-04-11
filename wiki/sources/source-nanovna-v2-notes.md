---
title: "NanoVNA V2 개인 노트"
type: source
created: 2026-04-11
updated: 2026-04-11
sources: [nanovna-v2-notes.md]
tags: [nanovna, vna, rf, fpv, notes]
---

# NanoVNA V2 개인 노트

> 원시 소스: `raw/areas/rf-measurement/nanovna-v2-notes.md`
> 성격: 직접 사용 경험 + User Manual 기반 요약 메모

## 장비 개요

[[nanovna-v2]]는 50kHz~3GHz 대역을 다루는 소형 벡터 네트워크 분석기(VNA)다. 현장에서 안테나의 SWR, 임피던스, S-파라미터를 바로 측정할 수 있어 아마추어 무선과 FPV 안테나 튜닝에 실용적이다.

## 핵심 특징

- **측정 범위**: 기본 모델은 50kHz~3GHz, V2 Plus4는 4.4GHz까지 확장
- **측정 항목**: S11, S21, 임피던스, SWR, 스미스 차트
- **휴대성**: 신용카드 크기 + 배터리 내장으로 현장 측정 가능
- **가격 경쟁력**: 기존 VNA 대비 크게 저렴한 $50~100대
- **오픈소스 생태계**: 하드웨어 설계와 NanoVNA-QT 소프트웨어가 공개

## FPV 맥락에서의 의미

[[dji-o3-air-unit]] 같은 FPV 영상 전송 장비는 안테나 성능이 링크 품질을 좌우한다. 이 노트는 [[nanovna-v2]]를 다음 용도로 위치시킨다:

- 5.8GHz 안테나의 공진 주파수 확인
- SWR 1.5 이하 여부 점검
- 안테나 길이 트리밍 결과 검증
- SMA/MMCX 커넥터 접촉 불량이나 손실 확인

즉, [[fpv-digital-transmission]] 환경에서 안테나 성능을 정량적으로 확인하는 진단 도구다.

## 사용 팁

1. **캘리브레이션 우선**: Open/Short/Load 3종 보정 없이 측정값을 신뢰하면 안 된다.
2. **케이블 영향 관리**: 포트 연장과 긴 케이블이 결과를 왜곡하므로 가능한 짧게 유지한다.
3. **PC 연동 활용**: NanoVNA-QT로 더 정밀한 분석과 데이터 내보내기가 가능하다.
4. **펌웨어 최신화**: 측정 정확도와 안정성을 위해 최신 펌웨어 유지가 중요하다.

## 관련 항목

- [[nanovna-v2]] — 장비 엔티티
- [[dji-o3-air-unit]] — 측정 대상이 될 수 있는 FPV 영상 전송 장치
- [[fpv-digital-transmission]] — 안테나 품질이 중요한 상위 맥락
