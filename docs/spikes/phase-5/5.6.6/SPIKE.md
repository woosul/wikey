---
section: 5.6.6
title: Subscription REST direct PoC — 3 vendor spike + endpoint baseline
created: 2026-05-14
---

# §5.6.6 PoC Spike — 3 vendor REST direct (Session 44)

> **상위 문서**: [`phase-5-spec-5.6.6-subscription-rest.md`](../../../planning/phase-5/phase-5-spec-5.6.6-subscription-rest.md) · [`phase-5-todox-5.6.6-subscription-rest.md`](../../../planning/phase-5/phase-5-todox-5.6.6-subscription-rest.md)

본 디렉토리 = §5.6.6 옵션 D (subscription OAuth → vendor REST direct) PoC 보존. plan v0.4 의 `wikey-core/src/{vendor}-rest-client.ts` 구현 단계의 **canonical reference**. version-guard.ts 의 endpoint baseline 도 본 SPIKE.md 가 단일 source.

## 1. spike 파일

| file | vendor | 측정 latency (Session 44) | 함수 |
|------|--------|---------------------------|------|
| `poc-google.mjs` | Google (gemini) | loadCodeAssist 550ms + generateContent ~786ms (429 시) | `loadCreds` `refreshTokenIfExpired` `callCodeAssist` `resolveProjectId` `generateContent` |
| `poc-openai.mjs` | OpenAI (codex) | ttfb 926ms / total 1945ms (gpt-5.5, SSE) | `loadAuth` `refreshTokenViaRefreshGrant` `callResponses` (SSE parse) |
| `poc-anthropic.mjs` | Anthropic (claude) | total 1932ms (claude-sonnet-4-5) | `loadFromKeychain` `saveToKeychain` `refreshAccessToken` `ensureFreshToken` `callMessages` |

## 2. endpoint baseline (version-guard.ts source)

| vendor | endpoint URL | OAuth client_id | refresh URL | bundle 위치 |
|--------|--------------|----------------|-------------|-------------|
| Google | `https://cloudcode-pa.googleapis.com/v1internal:generateContent` | `681255809395-***` (extract from bundle, GitHub secret-scan 회피 마스킹) | `https://oauth2.googleapis.com/token` | `~/.nvm/versions/node/v22.17.0/lib/node_modules/@google/gemini-cli/bundle/chunk-UN6XCVMJ.js` (line 272378 endpoint, 245247-248 client_id/secret) |
| OpenAI | `https://chatgpt.com/backend-api/codex/responses` (private Codex backend, NOT api.openai.com) | `app_EMoam***` | `https://auth.openai.com/oauth/token` | `~/.nvm/versions/node/v22.17.0/lib/node_modules/@openai/codex/node_modules/@openai/codex-darwin-arm64/vendor/aarch64-apple-darwin/codex/codex` (Mach-O strings extract) |
| Anthropic | `https://api.anthropic.com/v1/messages` (Bearer + anthropic-beta: oauth-2025-04-20) | `9d1c250a-***` | `https://console.anthropic.com/v1/oauth/token` | `/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/cli.js` (line 245247 인접 영역) |

**실 값 추출**: 위 bundle 위치에서 `grep -oE "OAUTH_CLIENT_ID = \"[^\"]+\"|var OAUTH_CLIENT_ID = \"[^\"]+\"|CLIENT_ID:\"[^\"]+\""` 또는 implementation 단계에서 const block 직접 사용. SPIKE.md 자체에는 마스킹 — GitHub secret scanning push protection 회피. spike `.mjs` file 도 동일 이유로 `.gitignore` (실 값 포함, on-disk 보존만).

## 3. version-guard.ts baseline hash

Step A 의 `subscription-rest-version-guard.ts` 가 process start 시 본 baseline 과 vendor CLI bundle 의 endpoint string sha256 hash 비교. mismatch 시 Notice "Vendor CLI updated — REST path may break" emit. 구체 hash 는 plan v0.4 진입 시 측정 + 본 SPIKE.md 갱신.

## 4. 휘발 path history

Session 44 Run 시 임시 path: `/tmp/poc-{cloudcode,codex,anthropic}.mjs` — Step A0 통과 전 mv (vendor 명 통일: cloudcode→google, codex→openai). 본 디렉토리 = canonical 영구 reference.

## 5. PoC 검증 결과

3 vendor 모두 paradigm 작동 확증 — Session 44 보고 (`docs/sessions/phase-5/`) 참조. 옵션 D = OAuth REST direct + tool 호출 0 + subscription quota 사용 + 1-3초 latency. 기존 CLI agentic loop 30-60초+ 대비 10-30배 개선.
