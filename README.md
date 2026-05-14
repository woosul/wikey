# Wikey — LLM이 만드는 개인 지식 위키

> Bring Your Own AI. 어떤 LLM이든, 하나만 있으면 됩니다.

## 이게 뭔가요?

RAG는 질문할 때마다 문서를 다시 찾습니다. Wikey는 다릅니다.
LLM이 소스를 읽고 **영구적인 위키**를 직접 만들어 놓습니다.

```
당신이 하는 일           LLM이 하는 일
─────────────           ──────────────
소스 파일을 넣는다  →   위키 페이지 자동 생성
질문한다           →   위키 기반으로 답변
(가끔) 린트 요청   →   모순/깨진 링크 수정
```

**Obsidian**에서 그래프뷰, 백링크로 위키를 탐색합니다.

## 빠른 시작

```bash
git clone https://github.com/moosuhan/wikey.git
cd wikey
./scripts/setup.sh
```

하나의 명령어로 설치 완료. 상세 가이드: [docs/guides/getting-started.md](docs/guides/getting-started.md)

### LLM 선택 (하나만 있으면 됩니다)

| 프로바이더 | 비용 | 한 줄 설정 |
|-----------|------|-----------|
| Claude Code | 월 $20~100 | `WIKEY_BASIC_MODEL=claude-code` |
| Codex CLI | 토큰 과금 | `WIKEY_BASIC_MODEL=codex` |
| Gemini | 거의 무료 | `WIKEY_BASIC_MODEL=gemini` |
| Ollama (Gemma 4) | **완전 무료** | `WIKEY_BASIC_MODEL=ollama` |

```bash
# 프로바이더 상태 확인
./scripts/check-providers.sh
```

### 소스 넣기 → 인제스트

```bash
cp ~/Downloads/article.md raw/0_inbox/
./scripts/llm-ingest.sh raw/0_inbox/article.md
```

### 질문하기

```bash
./local-llm/wikey-query.sh "이 위키에서 가장 중요한 개념은?"
```

## BYOAI — 어떤 AI든 연결

| 프로바이더 | 인제스트 | 쿼리 | 대용량 PDF | 린트 |
|-----------|---------|------|-----------|------|
| Claude Code | 최고 | 최고 | 200K ctx | 최고 |
| Codex CLI | 좋음 | 좋음 | 128K ctx | 좋음 |
| Gemini API | 스크립트 | 스크립트 | **1M ctx** | 스크립트 |
| Gemma 4 (로컬) | 기본 | **무료** | 131K ctx | 기본 |
| **로컬 검색 (항상)** | — | **$0** | — | — |

검색/임베딩/쿼리 합성은 항상 **로컬**에서 무료로 동작합니다 (Ollama + qmd).
클라우드 LLM은 인제스트/린트에만 사용합니다.

## 구조

```
wikey/                          ← 이 폴더 = Obsidian 볼트 = Git 저장소
├── wiki/                       ← LLM이 만드는 위키 (마크다운)
│   ├── index.md                   전체 페이지 목록
│   ├── entities/                  사람, 도구, 제품
│   ├── concepts/                  이론, 방법, 패턴
│   ├── sources/                   소스 요약
│   └── analyses/                  분석 결과
├── raw/                        ← 소스 문서 (사용자 소유, git 미추적)
├── scripts/                    ← 자동화 스크립트
│   ├── setup.sh                   원커맨드 설치
│   ├── llm-ingest.sh              스크립트 인제스트
│   ├── reindex.sh                 검색 인덱스 갱신
│   └── check-providers.sh        프로바이더 상태 확인
├── local-llm/                  ← 로컬 LLM 설정
│   ├── wikey.conf                 통합 설정 (BASIC_MODEL)
│   └── wikey-query.sh             로컬 쿼리 CLI
├── tools/qmd/                  ← 검색 엔진 (BM25+벡터+리랭킹)
├── wikey.schema.md             ← 위키 컨벤션 (마스터 스키마)
├── CLAUDE.md                   ← Claude Code 어댑터
└── AGENTS.md                   ← Codex CLI 어댑터
```

### 3계층 아키텍처

| 계층 | 위치 | 소유자 | 역할 |
|------|------|--------|------|
| 원시 소스 | `raw/` | 사용자 | 불변. 진실의 원천. LLM은 읽기만. |
| 위키 | `wiki/` | LLM | 페이지 생성/수정, 교차참조, 일관성 유지 |
| 스키마 | `wikey.schema.md` | 사용자+LLM | 컨벤션, 워크플로우 규칙 |

## 로드맵

| Phase | 목표 | 인터페이스 | 상태 |
|-------|------|----------|------|
| **1** | 개인 위키 기반 | 터미널 + Obsidian | **완료** |
| **2** | 한국어 검색 + 멀티 LLM | CLI + 스크립트 | **완료** |
| **3** | Obsidian 플러그인 | 채팅 사이드바, 드래그앤드롭 | 계획 |
| **4** | 웹 인터페이스 | 브라우저 | 계획 |
| **5+** | 기업용 | 팀 서버, RBAC | 계획 |

## 문서

| 문서 | 내용 |
|------|------|
| [설치 및 활용 가이드](docs/guides/getting-started.md) | 초보자를 위한 단계별 가이드 |
| [모델 선택 가이드](docs/model/model-selection-guide.md) | 프로바이더별 비교, 비용, 시나리오 |
| Phase 3 UX 아키텍처 *(Phase 3 종결 후 산출 예정)* | Obsidian 플러그인 → 웹 확장 계획 |

## 영감

- [Andrej Karpathy — LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)
- [llmbase](https://github.com/Hosuke/llmbase) — React UI 구현
- [seCall](https://github.com/hang-in/seCall) — 한국어 검색
- [qmd](https://github.com/tobi/qmd) — 로컬 하이브리드 검색 엔진

## Search engine rollback

§5.7.4 (2026-05-09) 부터 검색 backend 가 qmd CLI subprocess (1.22s/query) 에서 Orama
in-process (~0.2ms/query) 로 마이그레이션됐다. 회귀 시 3 layer 안전망:

1. **git revert** — 코드 단위 되돌림. commit `0be45c7` 직전으로 reset.
2. **`tools/qmd/` vendored 보존** — qmd binary 134 파일 git-tracked. runtime 호출 가능.
3. **runtime toggle** — `wikey.conf` 에 `WIKEY_SEARCH_ENGINE=qmd` 행 추가 (또는 환경변수
   `WIKEY_SEARCH_ENGINE=qmd` set) 후 plugin reload. 기본값 `'orama'`. 변경 후 `query()`
   가 기존 `findQmdBin` + qmd subprocess 호출 path 으로 회귀 (단위·라이브 검증 완료).

## Developer mode

§5.7.5 (2026-05-09) 부터 *advanced* dependency / vendor / model upstream update
추적용 settings 섹션이 추가됐다. **일반 사용자에게는 노출되지 않음** — settings 의
"General" 섹션에서 `Show developer section` 토글을 켜야 settings *맨 마지막*에
`Developer (advanced)` 섹션이 나타난다.

토글 활성화 절차:
1. Wikey settings 열기 → `General` 섹션 → `Show developer section` 토글 ON
2. `Developer (advanced)` 섹션이 settings 하단에 표시됨 + `Allow upstream update
   check (network)` 토글 (default OFF, opt-in). ON 으로 두면 plugin **재시작 시
   1회만** upstream 정보를 fetch (cron / 자동 polling 없음).

각 row 의미 (5 항목):
- **Kiwi NLP (vendor)** — `wikey-core/vendor/kiwi-nlp/VENDOR.md` 의 git tag 와
  `bab2min/Kiwi` 본가 latest release 비교
- **Orama** — `wikey-core/package.json` 의 `@orama/orama` 와 npm registry latest
- **Qwen3-Embedding-0.6B (GGUF)** — local cache (`~/.cache/qmd/models/`) 와 HF
  model card revision
- **qmd (vendored fallback)** — 회귀 path 의 vendored binary
- **Kiwi dictionary models** — `~/.cache/wikey/kiwi-models/cong/base/` 사전 (~104MB)

Row UI:
- `[upgrade]` 뱃지 — 새 버전 있으면 active, 없으면 회색
- `[분석]` 버튼 — 사용자 클릭 시 wikey 의 LLM provider (BYOAI 의 기본 chain) 가
  changelog / release note 를 요약. update 가 있을 때만 enabled
- `[개발필요]` 마크 — 분석 결과 wikey vendor patch list 와 충돌 가능성 detect 시
  표시. 마크는 *알림* 만 — 실 변경은 master 의 별 SDD+TDD cycle 에서 진행

사용자 직접 토글하지 않으면 모든 path 가 **호출 0** — plugin 정상 동작.

## Third-party software

| 패키지 | 라이선스 | 위치 | 비고 |
|--------|---------|------|------|
| `@orama/orama` | Apache-2.0 | `wikey-core/package.json` deps | In-process BM25/벡터 검색 엔진 |
| `kiwi-nlp` (JS wrapper) | LGPL-2.1-or-later | `wikey-core/vendor/kiwi-nlp/` (sparse vendor) | 한국어 형태소 분석 (Kiwi WASM). LGPL §6 의무 충족 — `NOTICE` 참조 |
| `qmd` | (upstream tobi/qmd) | `tools/qmd/` (vendored binary, 회귀 fallback) | rollback 안전망용 |

상세 라이선스 의무 (LGPL §6 4 항목 + relink mechanism) 는 [`NOTICE`](NOTICE) 참조.

## Subscription REST direct disclaimer (§5.6.6)

`subscriptionMode = 'rest'` (default since 2026-05-15) uses vendor private OAuth endpoints (Google Code Assist `cloudcode-pa.googleapis.com` / OpenAI private Codex backend `chatgpt.com/backend-api/codex/responses` / Anthropic Claude OAuth `api.anthropic.com/v1/messages` with `anthropic-beta: oauth-2025-04-20`) by reusing the OAuth `client_id` shipped inside each vendor's CLI bundle. Step A0 Legal/Terms Gate decision (2026-05-14): **`APPROVED_LOCAL_ONLY`** — local personal use only. Public distribution prohibited; redistributors must surface an equivalent disclaimer or pin `subscriptionMode = 'cli'`. The kill-switch envs `WIKEY_GEMINI_REST_DISABLE=1` / `WIKEY_ANTHROPIC_REST_DISABLE=1` / `WIKEY_OPENAI_REST_DISABLE=1` force the corresponding vendor back to the CLI agentic path.

## 라이선스

[MIT](LICENSE)
