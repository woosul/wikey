# Wikey 설치 및 활용 가이드

> 초보 사용자를 위한 단계별 가이드.
> 이 문서를 따라가면 wikey를 설치하고, 첫 소스를 인제스트하고, 위키에 질문할 수 있습니다.

---

## 목차

1. [wikey란?](#1-wikey란)
2. [사전 준비](#2-사전-준비)
3. [설치](#3-설치)
4. [LLM 프로바이더 선택](#4-llm-프로바이더-선택)
5. [첫 소스 인제스트](#5-첫-소스-인제스트하기)
6. [위키에 질문하기](#6-위키에-질문하기)
7. [Obsidian에서 브라우징](#7-obsidian에서-브라우징)
8. [일상 워크플로우](#8-일상-워크플로우)
9. [스크립트 레퍼런스](#9-스크립트-레퍼런스)
10. [FAQ / 문제 해결](#10-faq--문제-해결)

---

## 1. wikey란?

wikey는 **LLM이 자동으로 구축하고 유지하는 개인 위키**입니다.

일반적인 RAG(검색 증강 생성)는 질문할 때마다 관련 문서를 찾아서 답변을 만듭니다. wikey는 다릅니다. LLM이 소스를 읽고 **영구적인 위키 페이지를 만들어** 놓습니다. 교차참조도 이미 되어 있고, 모순도 이미 잡혀 있습니다.

```
당신이 하는 일:
  1. 소스 파일(PDF, 메모, 기사)을 넣는다
  2. "인제스트해줘"라고 말한다
  3. Obsidian에서 위키를 읽는다

LLM이 하는 일:
  - 소스를 분석하여 위키 페이지 생성
  - 엔티티(사람, 도구), 개념(이론, 방법) 정리
  - 교차참조(위키링크) 자동 연결
  - 기존 지식과 새 지식의 모순 감지
```

### 어떤 LLM을 써야 하나요?

**하나만 있으면 됩니다.** 아래 중 어느 것이든:

| 프로바이더 | 비용 | 특징 |
|-----------|------|------|
| **Claude Code** | 월 $20~100 (구독) | 최고 품질, 추천 |
| **Codex CLI** | 토큰 과금 (~$6/월) | 좋은 품질 |
| **Gemini** | 거의 무료 | 대용량 PDF에 최강 |
| **Ollama (Gemma 4)** | 완전 무료 | 오프라인 동작, 품질 제한 |

상세 비교: [`local-llm/model-selection-guide.md`](../local-llm/model-selection-guide.md)

---

## 2. 사전 준비

### 필수

| 소프트웨어 | 용도 | 설치 방법 |
|-----------|------|----------|
| **Obsidian** | 위키 브라우징 (그래프뷰, 백링크) | [obsidian.md](https://obsidian.md) 에서 다운로드 |
| **Ollama** | 로컬 LLM 검색/쿼리 | [ollama.com](https://ollama.com) 에서 다운로드 |
| **Python 3.9+** | 한국어 형태소 처리 | 대부분의 Mac/Linux에 기본 설치됨 |
| **Git** | 버전 관리 | 대부분의 Mac/Linux에 기본 설치됨 |

### 선택 (있으면 좋은 것)

| 소프트웨어 | 용도 | 필요 시점 |
|-----------|------|----------|
| Claude Code | 최고 품질 인제스트/린트 | 에이전트 세션으로 인제스트할 때 |
| Codex CLI | 교차 검증 린트 | 독립적인 위키 검증할 때 |
| Gemini API 키 | 대용량 PDF 요약 | 20페이지 이상의 PDF를 인제스트할 때 |
| fswatch | inbox 실시간 감시 | `brew install fswatch` (macOS) |
| poppler | PDF 텍스트 추출 | `brew install poppler` (pdftotext 명령) |

---

## 3. 설치

### 3-1. 프로젝트 다운로드

```bash
git clone https://github.com/moosuhan/wikey.git
cd wikey
```

### 3-2. 자동 설정

```bash
./scripts/setup.sh
```

이 명령어 하나로 다음이 자동으로 진행됩니다:

```
[1/7] Obsidian 볼트     — wiki/ 디렉토리 확인
[2/7] Ollama + Gemma 4  — Ollama 설치 확인, gemma4 모델 다운로드 (9.6GB)
[3/7] Python + kiwipiepy — 한국어 형태소 분석기 설치
[4/7] qmd 검색 엔진     — 검색 컬렉션 초기화 + 인덱싱
[5/7] API 키 설정       — .env 파일 생성 (API 키는 직접 입력)
[6/7] wikey.conf 설정   — LLM 설정 파일 확인
[7/7] 스크립트 권한     — 실행 권한 부여
```

모든 항목이 ✓로 표시되면 설치 완료입니다.

### 3-3. 설치 확인만 하기 (변경 없이)

```bash
./scripts/setup.sh --check
```

이미 설치된 상태를 확인만 합니다. 아무것도 설치하거나 변경하지 않습니다.

### 3-4. Obsidian에서 볼트 열기

1. Obsidian 앱 실행
2. 왼쪽 하단의 볼트 아이콘 클릭
3. "Open folder as vault" 선택
4. `wikey` 폴더 선택
5. `wiki/` 폴더가 보이면 성공

---

## 4. LLM 프로바이더 선택

### 4-1. 어떤 프로바이더를 쓸지 결정

먼저 현재 사용 가능한 프로바이더를 확인합니다:

```bash
./scripts/check-providers.sh
```

출력 예시:
```
=== Wikey LLM 프로바이더 상태 ===

  Ollama (로컬 LLM)
    ✓ ollama 설치됨
    ✓ 서버 가동 중
    ✓ 모델: gemma4:latest (9.6GB)

  Google Gemini (API)
    ✓ API 키 유효

  Claude Code (구독)
    ✓ claude CLI 설치됨

  현재 설정 (wikey.conf):
    쿼리 합성:  wikey (Ollama)      $0
    대용량 요약: gemini-2.5-flash    ~$0.01/건
    인제스트:    claude-code (opus)  ~$1.00/건
```

### 4-2. 기본 모델 설정

`local-llm/wikey.conf` 파일을 열어 **단 한 줄**만 수정합니다:

```bash
# 자신의 상황에 맞는 것을 선택하세요:

WIKEY_BASIC_MODEL=claude-code    # Claude Pro/Max 구독자
# WIKEY_BASIC_MODEL=codex        # OpenAI API 키가 있는 사용자
# WIKEY_BASIC_MODEL=gemini       # Gemini API 키만 있는 사용자 (거의 무료)
# WIKEY_BASIC_MODEL=ollama       # 클라우드 계정 없이 완전 무료로 사용
```

### 4-3. API 키 설정 (해당 프로바이더만)

```bash
# .env 파일 편집 (텍스트 에디터로 열기)
open .env    # macOS
# 또는
nano .env    # 터미널
```

`.env` 파일 내용:
```
# 사용하는 프로바이더의 키만 입력하면 됩니다

# Gemini — https://aistudio.google.com/apikey 에서 발급
GEMINI_API_KEY=여기에_키_입력

# OpenAI (Codex용) — https://platform.openai.com/api-keys 에서 발급
OPENAI_API_KEY=여기에_키_입력

# Anthropic (Claude API 직접 호출) — https://console.anthropic.com 에서 발급
ANTHROPIC_API_KEY=여기에_키_입력
```

**중요**: `.env` 파일은 git에 포함되지 않습니다. API 키가 유출될 걱정 없습니다.

---

## 5. 첫 소스 인제스트하기

"인제스트"란 소스 문서를 위키 페이지로 변환하는 과정입니다.

### 5-1. 소스 파일 준비

`raw/0_inbox/` 폴더에 인제스트할 파일을 넣습니다:

```bash
# 예시: 마크다운 파일
cp ~/Downloads/my-article.md raw/0_inbox/

# 예시: PDF 파일
cp ~/Downloads/report.pdf raw/0_inbox/
```

지원 파일 형식: `.md`, `.txt`, `.pdf`

### 5-2. 인제스트 실행 (3가지 방법)

#### 방법 A: 스크립트 인제스트 (가장 간단)

```bash
./scripts/llm-ingest.sh raw/0_inbox/my-article.md
```

프로바이더를 명시적으로 지정할 수도 있습니다:
```bash
./scripts/llm-ingest.sh raw/0_inbox/my-article.md --provider gemini
```

먼저 결과를 미리보기만 하려면:
```bash
./scripts/llm-ingest.sh raw/0_inbox/my-article.md --dry-run
```

#### 방법 B: Claude Code 세션 (최고 품질)

Claude Code가 설치되어 있다면, 프로젝트 폴더에서:

```bash
claude
```

Claude Code 세션에서:
```
raw/0_inbox/my-article.md를 인제스트해줘
```

Claude Code는 CLAUDE.md의 인제스트 체크리스트를 따라 자동으로 위키 페이지를 생성합니다.

#### 방법 C: Codex CLI

```bash
codex exec "Read AGENTS.md and ingest the source at raw/0_inbox/my-article.md"
```

### 5-3. 인제스트 결과 확인

인제스트가 완료되면:

```
[ingest] ✓ wiki/sources/source-my-article.md
[ingest] ✓ wiki/entities/entity-name.md
[ingest] ✓ wiki/concepts/concept-name.md
[ingest] ✓ wiki/index.md 갱신
[ingest] ✓ wiki/log.md 갱신
```

Obsidian에서 `wiki/` 폴더를 열어보면 새 페이지들이 생성되어 있습니다.

### 5-4. 대용량 PDF (20페이지 이상)

큰 PDF는 먼저 요약을 만들고 나서 인제스트합니다:

```bash
# 1단계: PDF 정보 확인
./scripts/summarize-large-source.sh raw/0_inbox/big-report.pdf --dry-run

# 2단계: 섹션 인덱스 생성 (Gemini 사용)
./scripts/summarize-large-source.sh raw/0_inbox/big-report.pdf

# 3단계: 생성된 요약을 기반으로 인제스트
./scripts/llm-ingest.sh raw/0_inbox/big-report.pdf
```

로컬에서만 처리하려면 (Gemini 키 없이):
```bash
./scripts/summarize-large-source.sh raw/0_inbox/big-report.pdf --local
```

---

## 6. 위키에 질문하기

### 6-1. 로컬 쿼리 (무료, $0)

```bash
# 기본 쿼리
./local-llm/wikey-query.sh "BYOAI란 무엇인가?"

# 한국어에 더 정확한 모드 (느리지만 정확)
./local-llm/wikey-query.sh --backend gemma4 "위키 인제스트란?"
```

### 6-2. 검색만 하기 (LLM 합성 없이)

```bash
./local-llm/wikey-query.sh --search "FPV 안테나"
```

검색 결과만 나오고, LLM이 답변을 생성하지 않습니다. 어떤 페이지가 관련 있는지 빠르게 확인할 때 유용합니다.

### 6-3. 특정 페이지를 읽고 질문하기

```bash
./local-llm/wikey-query.sh --pages "byoai,rag-vs-wiki" "두 개념의 차이점은?"
```

지정한 페이지만 컨텍스트로 사용합니다. 검색을 건너뛰므로 빠릅니다.

### 6-4. 쿼리 옵션 요약

| 옵션 | 설명 | 예시 |
|------|------|------|
| (없음) | 기본 쿼리 | `wikey-query.sh "질문"` |
| `--backend gemma4` | 한국어 정확 모드 (느림) | `wikey-query.sh --backend gemma4 "질문"` |
| `--search` | 검색 결과만 | `wikey-query.sh --search "키워드"` |
| `--pages "a,b"` | 특정 페이지 지정 | `wikey-query.sh --pages "byoai" "질문"` |
| `--top N` | 검색 결과 수 조절 | `wikey-query.sh --top 10 "질문"` |

---

## 7. Obsidian에서 브라우징

Obsidian을 열면 `wiki/` 폴더의 모든 마크다운 페이지를 탐색할 수 있습니다.

### 유용한 Obsidian 기능

| 기능 | 사용법 | 효과 |
|------|--------|------|
| **그래프 뷰** | Cmd+G (또는 왼쪽 사이드바) | 페이지 간 연결을 시각적으로 탐색 |
| **백링크** | 오른쪽 사이드바 | 현재 페이지를 참조하는 다른 페이지 목록 |
| **빠른 열기** | Cmd+O | 페이지 이름으로 빠르게 이동 |
| **검색** | Cmd+Shift+F | 위키 전체에서 텍스트 검색 |
| **위키링크 따라가기** | `[[페이지명]]` 클릭 | 연결된 페이지로 이동 |

### 위키 구조

```
wiki/
├── index.md        ← 전체 페이지 목록 (여기서 시작하세요)
├── overview.md     ← 위키 전체 요약
├── log.md          ← 시간순 활동 기록
├── entities/       ← 사람, 도구, 제품 등 고유명사
├── concepts/       ← 이론, 방법, 패턴 등 추상 개념
├── sources/        ← 소스 문서 요약 (원본 1개 = 요약 1개)
└── analyses/       ← 분석 결과 (비교, 탐색)
```

**추천 시작점**: `wiki/index.md`를 열어서 현재 위키에 어떤 페이지가 있는지 확인하세요.

---

## 8. 일상 워크플로우

### 새 소스 추가

```bash
# 1. 소스를 inbox에 넣기
cp ~/Downloads/new-article.md raw/0_inbox/

# 2. 인제스트
./scripts/llm-ingest.sh raw/0_inbox/new-article.md

# 3. Obsidian에서 결과 확인
```

### inbox 감시 (자동 알림)

```bash
# inbox에 파일이 추가되면 macOS 알림으로 알려줌
./scripts/watch-inbox.sh

# 또는 현재 inbox 상태만 확인
./scripts/watch-inbox.sh --status
```

### 검색 인덱스 갱신

인제스트 후 검색 인덱스를 갱신해야 새 페이지가 검색됩니다:

```bash
# 전체 갱신 (추천)
./scripts/reindex.sh

# 빠른 갱신 (qmd만, 형태소/CR 스킵)
./scripts/reindex.sh --quick

# 갱신 필요한지 확인만
./scripts/reindex.sh --check
```

### 위키 검증

```bash
# 위키 구조 검증 (깨진 링크, 인덱스 누락 등)
./scripts/validate-wiki.sh

# PII(개인정보) 스캔
./scripts/check-pii.sh
```

### 비용 확인

```bash
# 이번 달 비용 요약
./scripts/cost-tracker.sh summary --month 2026-04

# 프로바이더별 요금 확인
./scripts/cost-tracker.sh providers
```

---

## 9. 스크립트 레퍼런스

### 핵심 스크립트

| 스크립트 | 용도 | 자주 쓰는 명령 |
|---------|------|--------------|
| `scripts/setup.sh` | 초기 설치 | `./scripts/setup.sh` |
| `scripts/llm-ingest.sh` | 소스 → 위키 변환 | `./scripts/llm-ingest.sh <파일>` |
| `local-llm/wikey-query.sh` | 위키에 질문 | `./local-llm/wikey-query.sh "질문"` |
| `scripts/reindex.sh` | 검색 인덱스 갱신 | `./scripts/reindex.sh` |
| `scripts/check-providers.sh` | 프로바이더 상태 확인 | `./scripts/check-providers.sh` |

### 유지보수 스크립트

| 스크립트 | 용도 | 자주 쓰는 명령 |
|---------|------|--------------|
| `scripts/validate-wiki.sh` | 위키 구조 검증 | `./scripts/validate-wiki.sh` |
| `scripts/check-pii.sh` | 개인정보 스캔 | `./scripts/check-pii.sh` |
| `scripts/cost-tracker.sh` | 비용 추적 | `./scripts/cost-tracker.sh summary` |
| `scripts/watch-inbox.sh` | inbox 감시 | `./scripts/watch-inbox.sh --status` |
| `scripts/classify-inbox.sh` | inbox 분류 | `./scripts/classify-inbox.sh --dry-run` |

### 대용량 처리

| 스크립트 | 용도 | 자주 쓰는 명령 |
|---------|------|--------------|
| `scripts/summarize-large-source.sh` | 대용량 PDF 요약 | `./scripts/summarize-large-source.sh <pdf>` |

### 설정 파일

| 파일 | 용도 | 수정 필요 |
|------|------|----------|
| `local-llm/wikey.conf` | LLM 프로바이더 + 검색 설정 | `WIKEY_BASIC_MODEL` 한 줄만 |
| `.env` | 클라우드 API 키 | 사용하는 프로바이더 키만 |
| `wikey.schema.md` | 위키 컨벤션 (마스터 스키마) | 수정하지 마세요 |
| `CLAUDE.md` | Claude Code용 설정 | 수정하지 마세요 |
| `AGENTS.md` | Codex CLI용 설정 | 수정하지 마세요 |

---

## 10. FAQ / 문제 해결

### Q: Ollama가 설치되지 않았다고 나옵니다

```bash
# macOS
brew install ollama

# 또는 공식 사이트에서 다운로드
# https://ollama.com
```

설치 후 Ollama 앱을 한 번 실행해주세요 (메뉴바에 아이콘이 나타납니다).

### Q: gemma4 모델 다운로드가 너무 오래 걸립니다

gemma4는 9.6GB입니다. 인터넷 속도에 따라 10~30분 걸릴 수 있습니다.

```bash
# 다운로드 진행 상태 확인
ollama pull gemma4
```

### Q: kiwipiepy 설치가 실패합니다

```bash
# pip 업그레이드 후 재시도
pip3 install --upgrade pip
pip3 install kiwipiepy
```

Python 3.9 이상이 필요합니다. `python3 --version`으로 확인하세요.

### Q: 쿼리 결과가 이상합니다 (관련 없는 페이지가 나옴)

검색 인덱스가 오래되었을 수 있습니다:

```bash
# 인덱스 상태 확인
./scripts/reindex.sh --check

# 전체 재인덱싱
./scripts/reindex.sh
```

### Q: 인제스트 시 JSON 파싱 오류가 발생합니다

로컬 모델(ollama)로 인제스트할 때 발생할 수 있습니다. Gemma 4의 응답이 잘리는 경우입니다.

해결 방법:
```bash
# Gemini로 인제스트 (더 안정적)
./scripts/llm-ingest.sh raw/0_inbox/source.md --provider gemini

# 또는 Claude Code 세션에서 인제스트 (최고 품질)
claude
# → "raw/0_inbox/source.md를 인제스트해줘"
```

### Q: validate-wiki.sh에서 오류가 발생합니다

```bash
# 어떤 오류인지 확인
./scripts/validate-wiki.sh

# 일반적인 원인:
# - 프론트매터 누락: 파일 상단에 --- ... --- 블록이 있는지 확인
# - 깨진 위키링크: [[페이지명]]에서 해당 페이지가 실제로 존재하는지 확인
# - 인덱스 미등재: wiki/index.md에 새 페이지가 등록되었는지 확인
```

### Q: API 키가 유효한지 확인하고 싶습니다

```bash
./scripts/check-providers.sh
```

각 프로바이더 옆에 ✓ (유효), △ (경고), ✗ (오류)가 표시됩니다.

### Q: 비용이 얼마나 드나요?

```bash
./scripts/cost-tracker.sh summary
```

월간 예산 목표 $50 대비 사용량을 보여줍니다. 로컬(Ollama)만 쓰면 $0입니다.

### Q: Obsidian 없이 사용할 수 있나요?

네. 모든 스크립트는 터미널에서 동작합니다. Obsidian은 위키를 편하게 읽기 위한 도구일 뿐이고, 필수는 아닙니다. wiki/ 폴더의 마크다운 파일을 아무 에디터로 열어도 됩니다.

### Q: 위키 데이터는 어디에 저장되나요?

| 데이터 | 위치 | 설명 |
|--------|------|------|
| 위키 페이지 | `wiki/` | 마크다운 파일 (git으로 버전 관리) |
| 검색 인덱스 | `~/.cache/qmd/index.sqlite` | SQLite DB (문서, FTS5, 벡터) |
| CR 캐시 | `~/.cache/qmd/contextual-prefixes.json` | Gemma 4 맥락 프리픽스 |
| GGUF 모델 | `~/.cache/qmd/models/` | qmd 내장 모델 캐시 |
| 원시 소스 | `raw/` | 사용자가 넣은 소스 (git 미추적) |
| API 키 | `.env` | 클라우드 LLM 키 (git 미추적) |
