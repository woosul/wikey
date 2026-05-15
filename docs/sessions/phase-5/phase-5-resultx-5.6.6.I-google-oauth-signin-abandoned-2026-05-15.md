---
phase: 5
section: 5.6.6.I
title: §5.6.6.I wikey 내장 Google OAuth sign-in flow — paradigm 한계 발견 후 폐기 (Session 46)
status: ABANDONED
created: 2026-05-15
session: 46
---

# §5.6.6.I wikey 내장 Google OAuth sign-in — Session 46 시도 + 폐기

> **상위 문서**: [`docs/planning/phase-5/phase-5-todo.md §5.6.6`](../../planning/phase-5/phase-5-todo.md) · [`phase-5-resultx-5.6.6-rest-direct-2026-05-15.md`](./phase-5-resultx-5.6.6-rest-direct-2026-05-15.md) (§5.6.6 본체)
>
> **이력**:
> - Session 46 진입 시점에 paradigm shift 가능성 확인 — wikey 가 사용자 본인 OAuth client 로 token 직접 발급해서 user wallet quota 추적
> - 구현 진행 (~280 LOC) + 회귀 GREEN + 라이브 검증 시도 → **paradigm fundamental 한계 발견** → 사용자 결정 (옵션 A) **완전 원복**

## 1. 시도 paradigm

§5.6.6 본체 paradigm 한계 — gemini CLI token 차용 (audience = `681255809395-***`, gemini CLI hardcoded) 으로 사용자 wallet quota attribution X.

§5.6.6.I 목표:
1. **사용자 본인 GCP project (n8n-starter-480602 = ID `n8n-queue`) 의 Obsidian Desktop client (`818938387936-adti9ap8fg4vi20b5rmgtlst44eabou0`)** 로 OAuth 2.0 flow 직접 진행
2. Token storage `~/.config/wikey/google-oauth.json` (chmod 0o600 + atomic write)
3. `GoogleRESTClient.loadToken` path 분기 (env `WIKEY_GOOGLE_OAUTH_TOKEN_PATH` set 시 wikey path, unset 시 default `~/.gemini/oauth_creds.json` — 회귀 0)
4. Settings UI "Sign in with Google (wikey)" 버튼 (Auth Mode = Subscription + Subscription Mode = REST 분기)

## 2. 구현 결과 — 회귀 0 + 단위 테스트 GREEN

**Step A — wikey-core/src/google-rest-client.ts** path 분기 — `CREDS_PATH` const → `getCredsPath()` function (env override).

**Step B — wikey-obsidian/src/oauth-google-signin.ts** (~280 LOC) — Desktop OAuth 2.0 PKCE flow:
- `generateCodeVerifier` / `generateCodeChallenge` (RFC 7636 §4.1)
- `buildAuthURL` — scope `openid email profile cloud-platform`
- `startCallbackServer` — http.createServer loopback + state CSRF + timeout 5min
- `exchangeCodeForToken` — POST oauth2.googleapis.com/token + code_verifier
- `startOAuthFlow` — full chain (verifier + state + server + browser + exchange)
- `saveGoogleOAuthToken` — atomic write + chmod 0o600

**Step C — wikey-obsidian/src/main.ts** — `bootstrapSubscriptionOAuthEnv` 안 token path file 존재 시 `WIKEY_GOOGLE_OAUTH_TOKEN_PATH` 자동 set.

**Step D — wikey-obsidian/src/settings-tab.ts** — Google block 안 "wikey OAuth" row (Subscription Mode = REST 조건 노출) + handleSignIn / handleSignOut.

**Test (RED → GREEN)**:
- wikey-core: T-I1 / T-I2 / T-I3 (path 분기) PASS — 1250 tests (이전 1247 + 3)
- wikey-obsidian: T-B1 ~ T-B5 (PKCE + state CSRF + token exchange) PASS — 242 tests (이전 234 + 8)

**라이브 OAuth flow PASS**:
- 사용자 brower OAuth consent → `woosul@gmail.com` 권한 부여 (~34초)
- Token 저장 ✓ — `~/.config/wikey/google-oauth.json` (mode 0o600)
- **Audience 검증 PASS** — `id_token.aud = 818938387936-adti...` (사용자 본인 client) ≠ `681255809395-***` (gemini CLI hardcoded)
- bootstrap detect → env auto-set ✓

## 3. Paradigm 한계 발견 — cloudcode-pa endpoint audience-restricted

라이브 chat 1 질문 (wikey 의 3계층 아키텍처는?) → **HTTP 403 from cloudcode-pa.googleapis.com**.

| 시도 | Token Audience | Project | 결과 |
|------|---------------|---------|------|
| 기본 §5.6.6 paradigm | `681255809395-***` (gemini CLI) | (auto-resolve) | 200 OK |
| wikey OAuth | `818938387936-adti...` (user) | `n8n-starter-480602` | **403** |
| wikey OAuth | `818938387936-adti...` (user) | `n8n-queue` (project ID) | **403** |

**진단**: `cloudcode-pa.googleapis.com` 은 Google **internal endpoint** — 오직 **Gemini Code Assist Free** 의 hardcoded OAuth client (`681255809395-***`) 만 호출 권한. 일반 GCP project OAuth client 의 token 으로는 **항상 403** (project ID 무관, 권한 부여 무관).

이는 paradigm 의 fundamental 제약 — wikey 내장 sign-in 이 audience-restricted endpoint 우회 불가.

## 4. 사용자 결정 (옵션 A) + 완전 원복

| 옵션 | 설명 | 사용자 결정 |
|------|------|-------------|
| A (회귀) | §5.6.6.I 전체 revert. paradigm 한계 발견 기록만 남김. 기존 §5.6.6 paradigm 유지 (gemini CLI token 차용) | ✅ **채택** |
| B (paradigm shift) | endpoint 를 `generativelanguage.googleapis.com` (public API) 로 교체 — 사용자 wallet ✓, free tier 별도 (gemini-2.5-flash 50 req/day) | future cycle |
| C (Vertex AI) | endpoint `aiplatform.googleapis.com` — 사용자 wallet ✓, paid tier | future cycle |

사용자 raise 명시 (2026-05-15 Session 46): "API 쓰던지 다른 provider 쓰던지 해야한다는 결론이구만." + "기존 설정에도 sign-in/sign-out 버튼이 있었잖아? 뭔가 다른거야 새로만든 로그인 버튼?" — UX 혼란 + paradigm 가치 X 명시 → 완전 원복.

## 5. 원복 산출물

```
git checkout HEAD -- wikey-core/src/__tests__/google-rest-client.test.ts
git checkout HEAD -- wikey-core/src/google-rest-client.ts
git checkout HEAD -- wikey-obsidian/src/main.ts
git checkout HEAD -- wikey-obsidian/src/settings-tab.ts
rm wikey-obsidian/src/oauth-google-signin.ts
rm wikey-obsidian/src/__tests__/oauth-google-signin.test.ts
rm docs/planning/phase-5/phase-5-todox-5.6.6.I-google-oauth-signin.md
```

**회귀 0 확증**:
- wikey-core: 1247 PASS / 4 skipped (이전 §5.6.6 base 와 동일)
- wikey-obsidian: 234 PASS / 1 skipped (동일)
- validate-wiki: PASS
- 라이브 plugin reload + UI 검증: "wikey OAuth" row 미존재 (count=0, 정상 회귀)
- env: `WIKEY_GOOGLE_OAUTH_TOKEN_PATH = unset` → GoogleRESTClient 가 default `~/.gemini/oauth_creds.json` 사용 (기존 paradigm 회복)

**Token file 삭제**: `~/.config/wikey/google-oauth.json` removed (paradigm 한계로 무용).

**credentials.json `gemini` 블록 처리 — Session 47 (2026-05-15) cleanup**: Session 46 종결 시점에서 `gemini.oauthClientId` / `oauthClientSecret` / `cloudProject` 가 §5.6.6 본체에서 활용된다고 판단해 keep 했으나, **이 값들은 §5.6.6.I 시도 때 사용자가 직접 입력한 wikey 자체 OAuth client (`818938387936-adti...`) 의 leftover 였음**. §5.6.6 본체 paradigm 은 gemini CLI bundle 의 hardcoded OAuth client (`681255809395-...`) 만 사용 가능. credentials.json 에 잘못된 client 가 남으면 `bootstrapSubscriptionOAuthEnv` Priority 2 (reference resolution) 가 그 값으로 env 주입 → Priority 3 (bundle grep) skip → `doRefresh` 시 `unauthorized_client` (401).

**Session 47 fix** (사용자 옵션 1 결정 + 라이브 PASS):
- `jq 'del(.gemini)' ~/.config/wikey/credentials.json` 으로 블록 surgical 제거 (backup: `credentials.json.bak-20260515-164612`)
- Plugin reload 후 Priority 3 bundle grep 으로 정확한 `681255809395-...` + `GOCSPX-...` env 주입 확증
- 외부 refresh attempt: HTTP 200 OK, expires_in=3599s, atomic write 성공
- CDP 라이브 chat smoke: "2 더하기 3은?" → "5입니다. 참고: 위키에 아직 관련 내용이 없어요" + citation (`test-stage3-cobit (md)`) PASS
- **장점 (사용자 직관)**: Priority 3 self-healing 으로 최초 로그인 / 로그아웃-로그인 / OAuth client rotation 시에도 사용자 액션 0. credentials.json 의 explicit OAuth client 저장은 §5.6.6 본체 paradigm 과 부합하지 않음.
- `wikey.conf` 의 `${credentials.gemini.*}` reference 라인은 그대로 둬도 무해 (resolve 실패 → Priority 3 fallback chain 정상 작동).

## 6. 학습 (paradigm 발견 가치)

1. **Google 의 internal OAuth client 제약** — `cloudcode-pa.googleapis.com` 같은 internal endpoint 는 hardcoded client 제약. Desktop app OAuth client 로 우회 불가.
2. **Audience-restricted endpoint 식별 패턴** — token aud 가 endpoint owner 의 hardcoded client 와 일치해야만 호출. cross-client token 사용 불가 (=Google 내부 보안).
3. **wikey 내장 sign-in flow 자체는 작동** — PKCE + loopback + state CSRF + token exchange 모두 정상. 이 코드는 미래 paradigm shift (옵션 B / C) 시 재사용 가능.
4. **회귀 0 invariant 보장 단순 구현** — env override pattern (`process.env.X ?? default`). 사용자 액션 없이 default 유지.

## 7. Phase 5 잔여

§5.6.6 본체 = ✅ 종결 (Session 45) — 회귀 paradigm 유지.
§5.6.6.I = ❌ ABANDONED (Session 46) — paradigm 한계 발견.

**다음 진입점 (Session 47+)**: §5.5 / §5.8 / §5.9 (3 subject).

**별 cycle 의제** (future, 사용자 결정 의무):
- (B) generativelanguage.googleapis.com paradigm shift — gemini-2.5-flash free 50 req/day, user wallet ✓
- (C) Vertex AI aiplatform.googleapis.com — paid, user wallet ✓
- (X) API key path 단순화 — Google AI Studio key (기존 §5.6.4 path 강조)

## 8. Session 46 commit chain

```
(Session 46 = revert + docs sync 단일 commit. 코드 변경 0, 문서 추가 2 (본 result + session-wrap), 문서 삭제 1 (post-compact-handoff))
```

**관련 문서**:
- [`docs/sessions/phase-5/phase-5-resultx-5.6.6-rest-direct-2026-05-15.md`](./phase-5-resultx-5.6.6-rest-direct-2026-05-15.md) — §5.6.6 본체 (Session 45 종결)
- [`docs/planning/session-wrap-followups.md`](../../planning/session-wrap-followups.md) — 다음 세션 진입 hint (§5.5/§5.8/§5.9)
