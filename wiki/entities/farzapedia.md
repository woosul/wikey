---
title: Farzapedia
type: entity
created: 2026-04-10
updated: 2026-04-10
sources: [source-llm-wiki-community.md]
tags: [project, use-case, personal-wiki]
---

# Farzapedia

[[llm-wiki]] 패턴의 대표적 실사례. 개인 Wikipedia.

## 개요

일기, Apple Notes, iMessage 대화 **2,500건**을 입력으로 **400개의 상세 위키 문서**를 자동 생성. 친구, 스타트업, 관심 연구 분야, 좋아하는 애니메이션과 그 영향까지 포함하며, 백링크로 상호 연결되어 있다.

## 설계 특징

- 위키는 개인 열람용이 아닌 **에이전트가 활용하는 지식 베이스**로 설계
- 파일 구조와 백링크가 에이전트가 크롤링하기 용이한 형태
- Claude Code를 위키에 연결하고 `index.md`를 진입점으로 에이전트가 직접 탐색

## 활용 예시

"최근 영감을 받은 이미지와 영화를 참고해 카피와 디자인 아이디어를 줘" → 에이전트가 Studio Ghibli 다큐 기반 "철학" 문서, YC 기업 랜딩 페이지, 1970년대 Beatles 굿즈 이미지까지 종합해 답변.

## [[rag-vs-wiki|RAG 대비 효과]]

1년 전 RAG 기반으로 유사 시스템을 구축했으나 **성능이 좋지 않았고**, 에이전트가 파일 시스템을 통해 직접 탐색하는 방식으로 전환 후 효과가 극대화되었다. [[knowledge-compounding|지식 축적]]의 실증 사례.

## [[andrej-karpathy|Karpathy]]의 언급

Farzapedia를 직접 언급하며 LLM Wiki 개인화의 4가지 장점(명시성, 데이터 소유권, 파일 우선, BYOAI)을 정리.

## 관련 항목

- [[llm-wiki]] — 기반 패턴
- [[rag-vs-wiki]] — RAG와의 비교
- [[source-llm-wiki-community]] — 출처
