# kiwi-nlp Vendor Sync 절차

> §5.7.4 v8 — `wikey-core/vendor/kiwi-nlp/` (B-2 sparse vendor) 의 upstream sync 수동 절차.
> 자동화는 §5.7.5 (`phase-5-todox-5.7.5-orama-update-sync.md`) 별 spec 으로 deferral.

## 현재 vendor 상태

- **출처**: `bab2min/Kiwi` (Kiwi 본가) git tag `v0.23.0` 의 `bindings/wasm/package/` subdir.
- **위치**: `wikey-core/vendor/kiwi-nlp/`
- **LICENSE**: `bab2min/Kiwi` repo root (LGPL-2.1) — 별 fetch 후 `wikey-core/vendor/kiwi-nlp/LICENSE` 에 저장.
- **Vendor date**: 2026-05-09
- **Wikey 측 수정분**: (현 시점 0건; 수정 시 `VENDOR.md` patch list 에 기록)

## 정기 점검 (수동, §5.7.5 자동화 deferral)

### Primary 절차 (B-2 sparse vendor 의 실 sync 대상)

1. `bab2min/Kiwi` releases (https://github.com/bab2min/Kiwi/releases) 확인 — 신 git tag 발견.
2. `bindings/wasm/package/` subdir diff 검토 — 신 tag 의 archive 받아 `wikey-core/vendor/kiwi-nlp/` 와 `git diff` 또는 `diff -r` (단, 자체 build 결과 `dist/` 는 비교 제외).
3. 본가 root `LICENSE` diff 검토 — 신 tag 의 `LICENSE` 와 `wikey-core/vendor/kiwi-nlp/LICENSE` `diff`.
4. 보안 patch / critical fix 만 cherry-pick — minor / patch 만 (major 는 별 spec).
5. wikey 측 수정분 (`smart_tokenize` / `Module.instantiateWasm` hook 은 wrapper *밖* — `wikey-core/src/search/orama-korean-tokenizer.ts`) 보존 검증.
6. 단위 테스트 + 라이브 smoke 재실행.

### Secondary (보조)

- `npm view kiwi-nlp version` — npm 배포 신 버전 cross-check (Kiwi git tag 와 mapping 확인).
- `npm view kiwi-nlp dist.tarball` — npm dist 의 wasm 변경 감지 (vendor wasm mirror 갱신 필요 여부).

## Vendor 재 build 절차 (LGPL §6 (d) relink mechanism — JS wrapper layer)

```bash
cd wikey-core/vendor/kiwi-nlp
if [ -f package-lock.json ]; then npm ci; else npm install; fi
npm run build
# → dist/build/kiwi-wasm.js (Emscripten generated JS) + dist/index.js + dist/*.d.ts 생성
```

> 주의 — `npm run build` 만으로는 `src/build/kiwi-wasm.js` (Emscripten generated) 부재 시 fail.
> 본가 절차 (`bindings/wasm/build.sh` + Emscripten) 으로 `src/build/` 생성 후 `npm run build` 가능.
> 또는 npm 의 publish 된 `kiwi-nlp@<version>/dist/` 와 byte-equal mirror 로 갱신.

## WASM binary 재 build (LGPL §6 (d) relink mechanism — WASM binary layer)

`kiwi-wasm.wasm` 자체는 vendor scope **외**. 자체 build 시 다음 절차:

```bash
git clone https://github.com/bab2min/Kiwi.git
cd Kiwi
git checkout v0.23.0   # vendor 와 동일 tag
cd bindings/wasm
# Emscripten 환경 prerequisite (https://emscripten.org/docs/getting_started/downloads.html)
./build.sh
# → kiwi-wasm.wasm + src/build/kiwi-wasm.js 생성
cp dist/kiwi-wasm.wasm /path/to/wikey/wikey-core/vendor/kiwi-nlp/dist/kiwi-wasm.wasm
# 이후 wikey-obsidian rebuild
```

## 자동화 (§5.7.5 별 spec)

- B1 npm outdated cron / GitHub Actions
- B7 vendor diff 자동 보고 → 사용자 review queue
