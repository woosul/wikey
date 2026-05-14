# CCS (Claude Code Switch) 설치 및 사용 가이드

> **CCS** — Claude Code에서 Codex, Gemini, GLM, Ollama 등 다른 모델을 손쉽게 전환하는 멀티 프로바이더 프로파일 매니저
>
> - GitHub: https://github.com/kaitranntt/ccs
> - 공식 사이트: https://ccs.kaitran.ca
> - 공식 문서: https://docs.ccs.kaitran.ca

---

## 1. 설치 계획

### 1-1. 사전 요구사항

| 항목 | 버전 | 확인 명령어 |
|------|------|-------------|
| Node.js | 18+ | `node --version` |
| Claude Code CLI | 최신 | `claude --version` |
| npm / bun / pnpm | 최신 | `npm --version` |

### 1-2. 설치

```bash
# npm (권장)
npm install -g @kaitranntt/ccs

# bun (속도 우선)
bun add -g @kaitranntt/ccs

# pnpm
pnpm add -g @kaitranntt/ccs
```

### 1-3. 설치 확인

```bash
ccs --version
```

---

## 2. 설정 계획

### 2-1. 설정 구조

CCS는 `~/.ccs/` 디렉토리에 모든 설정을 저장한다.

```
~/.ccs/
├── config.json                  # 메인 설정 (프로파일 목록)
├── claude.settings.json         # Claude 기본 프로파일
├── gemini.settings.json         # Gemini 프로파일
├── glm.settings.json            # GLM-5.1 프로파일
├── kimi.settings.json           # Kimi 프로파일
├── ollama.settings.json         # Ollama (로컬) 프로파일
└── cliproxy/auth/               # OAuth 토큰 캐시
```

### 2-2. 메인 설정 파일 (`~/.ccs/config.json`)

```json
{
  "profiles": {
    "default": "~/.claude/settings.json",
    "glm": "~/.ccs/glm.settings.json",
    "gemini": "~/.ccs/gemini.settings.json",
    "kimi": "~/.ccs/kimi.settings.json",
    "ollama": "~/.ccs/ollama.settings.json"
  }
}
```

### 2-3. 프로바이더별 설정

**프로바이더는 두 가지 유형으로 나뉜다:**

| 유형 | 방식 | 예시 |
|------|------|------|
| OAuth (무설정) | 브라우저 인증, API 키 불필요 | Gemini, Codex, Copilot |
| API Key | 직접 API 키 입력 | GLM, Kimi, OpenRouter, Ollama |

---

#### OAuth 프로바이더 설정 (API 키 불필요)

별도 설정 파일 없이 아래 명령어로 즉시 인증 가능:

```bash
ccs gemini --auth    # Gemini 인증
ccs codex --auth     # Codex (ChatGPT Plus 필요)
ccs copilot --auth   # GitHub Copilot 인증
```

인증 완료 후 토큰은 `~/.ccs/cliproxy/auth/<provider>/`에 자동 저장된다.

---

#### GLM-5.1 설정 (`~/.ccs/glm.settings.json`)

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.z.ai/api/anthropic",
    "ANTHROPIC_AUTH_TOKEN": "YOUR_GLM_API_KEY",
    "ANTHROPIC_MODEL": "glm-5",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-5",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-5",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-5"
  }
}
```

API 키 발급: https://api.z.ai

---

#### Kimi 설정 (`~/.ccs/kimi.settings.json`)

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://127.0.0.1:8317/api/provider/kimi",
    "ANTHROPIC_AUTH_TOKEN": "ccs-internal-managed",
    "ANTHROPIC_MODEL": "kimi-k2.5",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "kimi-k2.5",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "kimi-k2-thinking",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "kimi-k2"
  }
}
```

---

#### Ollama 설정 (로컬 모델, `~/.ccs/ollama.settings.json`)

```bash
# Ollama 먼저 설치 (https://ollama.com)
ollama pull qwen3-coder  # 원하는 모델 다운로드
```

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:11434",
    "ANTHROPIC_AUTH_TOKEN": "ollama",
    "ANTHROPIC_MODEL": "qwen3-coder",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "qwen3-coder",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "qwen3-coder",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "qwen3-coder"
  }
}
```

---

#### Claude 다중 계정 설정 (업무/개인 분리)

```bash
ccs auth create work      # 업무용 계정
ccs auth create personal  # 개인용 계정
```

두 계정은 자격증명을 공유하지 않으며 동시에 실행 가능하다.

---

### 2-4. 대시보드 UI로 설정 (CLI 대안)

```bash
ccs config
```

브라우저에서 `http://localhost:3000`이 열리며, 다음을 GUI로 관리할 수 있다:

- 프로바이더 추가 / OAuth 인증 상태 확인
- API 키 입력 및 프로파일 생성
- 사용량 분석 및 비용 추적
- 실시간 인증 상태 모니터링

---

## 3. 사용 방법

### 3-1. 기본 사용

```bash
# 기본 Claude 사용
ccs "프롬프트"

# 특정 프로바이더로 전환
ccs gemini "프롬프트"
ccs codex "프롬프트"
ccs glm "프롬프트"
ccs kimi "프롬프트"
ccs ollama "프롬프트"

# 다중 계정 사용
ccs work "업무 관련 요청"
ccs personal "개인 작업 요청"
```

### 3-2. 주요 CLI 명령어

| 명령어 | 설명 |
|--------|------|
| `ccs` | 기본 Claude 실행 |
| `ccs config` | 대시보드 UI 열기 |
| `ccs doctor` | 헬스 체크 (인증, 연결 상태) |
| `ccs --version` | 버전 확인 |
| `ccs --help` | 전체 도움말 |
| `ccs auth list` | 인증 프로파일 목록 |
| `ccs auth create <name>` | 새 Claude 계정 프로파일 생성 |
| `ccs api create` | API 키 기반 프로파일 생성 |
| `ccs <provider> --auth` | OAuth 인증 |
| `ccs <provider> --logout` | OAuth 토큰 초기화 |
| `ccs <provider> --headless` | 브라우저 없는 서버 환경 인증 |
| `ccs cleanup` | 오래된 세션/로그 정리 |

### 3-3. 런타임 타겟 전환 (고급)

CCS는 Claude Code 외 다른 런타임도 지원한다:

```bash
ccs --target droid glm   # Factory Droid 런타임으로 GLM 실행
ccs --target codex       # Codex CLI 런타임
ccs --target cursor      # Cursor IDE 런타임
```

단축 별칭:
- `ccsd` = `ccs --target droid`
- `ccsx` = `ccs --target codex`

### 3-4. 워크플로우 예시

**비용 최적화 패턴** (설계는 Claude, 구현은 저렴한 모델):

```bash
# 설계 — Claude Sonnet
ccs "인증 플로우 설계해줘"

# 구현 — GLM (70% 비용 절감)
ccs glm "plan.md 기반으로 JWT 엔드포인트 구현해줘"

# 테스트 정리 — GLM
ccs glm "테스트 정리하고 문서 업데이트해줘"

# 프라이버시 필요한 작업 — 로컬 Ollama
ccs ollama "이 로그 요약해줘"
```

**병렬 멀티 계정 패턴:**

```bash
# 터미널 1: 업무
ccs work "엔터프라이즈 대시보드 기능 구현"

# 터미널 2: 개인 (동시 실행 가능)
ccs personal "블로그 포스트 작성"
```

---

## 4. 주요 API 엔드포인트 참조

| 프로바이더 | Base URL | API 키 발급처 |
|-----------|----------|---------------|
| GLM-5.1 | `https://api.z.ai/api/anthropic` | https://api.z.ai |
| Kimi | `https://api.moonshot.cn/v1` | https://platform.moonshot.cn |
| OpenRouter | `https://openrouter.io/api/v1` | https://openrouter.ai |
| Ollama (로컬) | `http://localhost:11434` | 불필요 |

---

## 5. 트러블슈팅

```bash
# 전체 상태 확인
ccs doctor

# 토큰 초기화 후 재인증
ccs <provider> --logout
ccs <provider> --auth

# 구버전 설정 마이그레이션
ccs migrate
```

공식 트러블슈팅: https://docs.ccs.kaitran.ca/reference/troubleshooting

---

## 6. 참고 링크

- [공식 문서](https://docs.ccs.kaitran.ca)
- [CLI 명령어 레퍼런스](https://docs.ccs.kaitran.ca/reference/cli-commands)
- [제품 투어](https://docs.ccs.kaitran.ca/getting-started/product-tour)
- [GitHub 이슈](https://github.com/kaitranntt/ccs/issues)
- [npm 패키지](https://www.npmjs.com/package/@kaitranntt/ccs)
