# Obsidian 플러그인 (Phase 3 산출물)

> CLAUDE.md 에서 분리 (2026-04-24). Phase 3 종료로 구조 고정된 산출물의 디렉터리 맵 + 빌드/개발 흐름. CLAUDE.md 는 진입점·요약만, 상세는 여기.

## 구조

```
wikey-core/                    ← 핵심 로직 (프로바이더 독립)
  src/config.ts                ← wikey.conf 파싱, resolveProvider
  src/llm-client.ts            ← 4 프로바이더 (Gemini/Anthropic/OpenAI/Ollama)
  src/provider-defaults.ts     ← 4 프로바이더 기본 모델 단일 소스 (UI/core 공유)
  src/wiki-ops.ts              ← 페이지 CRUD, index/log 관리
  src/query-pipeline.ts        ← qmd 검색 + LLM 합성
  src/ingest-pipeline.ts       ← 소스→위키 변환 (PDF + chunk v2 프롬프트)
  src/classify.ts              ← inbox 분류 규칙 엔진 + LLM fallback (DEWEY 10개)
  src/scripts-runner.ts        ← validate/pii/reindex/cost exec 래퍼
  src/pii-redact.ts            ← (Phase 4 D.0.a) 2-layer gate + 3-mode redact
  src/capability-map.ts        ← (Phase 4 D.0.d) docling/unhwp 런타임 capability
  src/types.ts                 ← 공유 타입
  src/prompts/                 ← 외부화된 프롬프트 (ingest_prompt_basic.md)
  src/__tests__/               ← vitest (Phase 4 D.0.j 기준 511 tests)

wikey-obsidian/                ← Obsidian 플러그인
  src/main.ts                  ← WikeyPlugin, WikiFS/HttpClient 어댑터
  src/sidebar-chat.ts          ← 채팅 UI, Audit/Ingest 패널
  src/ingest-modals.ts         ← Stay-involved Brief→Processing→Preview 모달 (Drag/Resize)
  src/setup-para.ts            ← PARA 폴더 구조 자동 생성 (0_inbox~4_archives + DDC 3차)
  src/settings-tab.ts          ← 설정 (환경 탐지, 일반 토글, API 키, 고급 LLM)
  src/commands.ts              ← Cmd+Shift+I, URI 프로토콜
  src/status-bar.ts            ← 페이지 수, 통계 모달
  src/env-detect.ts            ← 로그인 셸 PATH + ABI 호환 node 탐지 (kiwipiepy/markitdown/markitdown-ocr 옵셔널 감지 포함)
  styles.css                   ← Purple accent 테마
```

## 개발 명령어

```bash
npm run build          # 전체 빌드 (wikey-core + wikey-obsidian)
npm run build:core     # wikey-core만
npm run build:obsidian # wikey-obsidian만
npm test               # wikey-core vitest
npm run dev            # wikey-obsidian watch 모드
```

## 플러그인 개발 세션

```
1. npm run dev (watch 모드)
2. Obsidian Cmd+R로 리로드
3. 코드 수정 → 자동 빌드 → Cmd+R로 확인
4. npm test → 0 failures 확인
5. npm run build → 0 errors 확인
6. Git 커밋
```
