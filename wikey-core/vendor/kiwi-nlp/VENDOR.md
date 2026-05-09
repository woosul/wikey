# kiwi-nlp Vendor (B-2 sparse vendor pattern, v5)

- **Upstream**: bab2min/Kiwi (Kiwi 본가) — https://github.com/bab2min/Kiwi
- **Vendor scope**: `bindings/wasm/package/` subdir (JS/TS wrapper + 빌드 스크립트)
- **Kiwi git tag**: v0.23.0 (npm `kiwi-nlp@0.23.0` 매칭)
- **Vendor date**: 2026-05-09
- **License**: LGPL-2.1 (root LICENSE 별 fetch — vendor/kiwi-nlp/LICENSE)
- **WASM C++ source**: vendor scope **외** — `bab2min/Kiwi` repo root + `src/` + `include/` (LGPL §6 (d) relink path = 본가 + Emscripten + `bindings/wasm/build.sh`)
- **WASM binary**: `dist/kiwi-wasm.wasm` (npm 0.23.0 mirror — npm 위치와 동일, v6 path 단일화)
- **dist/ 재생성 절차**: vendor 안 `npm run build` 만으로는 `src/build/kiwi-wasm.js` (Emscripten generated) 미생성으로 fail.
  본가 절차 (`bindings/wasm/build.sh` + Emscripten) 으로 src/build/ 생성 후 `npm run build` 로 dist/ 갱신 가능. 또는 npm 의 publish 된 `kiwi-nlp@<version>/dist/` 와 byte-equal mirror 로 갱신.
- **Wikey 측 수정분**:
  - `.gitignore` 정정 (2026-05-09): `build` / `doc` → `/build` / `/doc` (root 만 ignore). 본가 본 형식은 `dist/build/` 도 ignore 매치 → vendor 의 `dist/build/kiwi-wasm.{js,d.ts}` (Emscripten generated artifact) 가 git tracked 안 됨. sparse vendor 의 dist mirror 보존 위해 root prefix `/` 추가. `node_modules` 는 그대로 (모든 위치 ignore).
- **Sync 절차**: ../../docs/kiwi-nlp-vendor-sync.md
